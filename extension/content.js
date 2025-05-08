/**
 * Content script for AI Form Helper extension
 * 
 * This script automatically detects forms on the page and injects the helper panel.
 * It works with background.js to provide form assistance on non-blocked sites.
 */

// Global flag to prevent duplicate initialization
window.formHelperInitialized = false;

// Safe console logging
function safeLog(message, data = {}) {
  try {
    console.log(`AI Form Helper: ${message}`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  } catch (e) {
    // Ignore logging errors
  }
}

// Configuration
const API_URL = 'http://127.0.0.1:8000/api/process-form';
let debugMode = false;
let panelInjected = false;
let highlightEnabled = false; // No automatic highlighting
let actionButtonInjected = false;
let formDetectionInProgress = false;

// Element references
let panelFrame = null;
let highlightedFields = [];

// Form detection results
let detectedFormData = null;

// Initialize form helper when the page is ready
function initializeFormHelper() {
  if (window.formHelperInitialized) {
    safeLog('Form Helper already initialized');
    return;
  }
  
  safeLog('Initializing Form Helper');
  window.formHelperInitialized = true;
  
  // Setup message listeners
  setupMessageListeners();
  
  // Check for forms automatically
  detectForms();
}

// Setup message listeners for communication with background script and panel
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    safeLog('Message received', { action: message.action });
    
    // Handle form detection request
    if (message.action === 'scanForms') {
      detectForms();
      sendResponse({ success: true });
      return true;
    }
    
    // Handle activation request from background script
    if (message.action === 'activateFormHelper') {
      const settings = message.settings || {};
      highlightEnabled = settings.highlightFields === true; // Default to false
      
      detectForms();
      
      // Don't auto-inject panel, only action button
      if (!actionButtonInjected && detectedFormData && detectedFormData.fields && detectedFormData.fields.length > 0) {
        injectActionButton(detectedFormData.fields.length);
      }
      
      sendResponse({ success: true });
      return true;
    }
    
    // Handle form field actions from panel
    if (message.action === 'highlightField') {
      highlightField(message.fieldId);
      sendResponse({ success: true });
      return true;
    }
    
    if (message.action === 'fillField') {
      fillField(message.fieldId, message.value);
      sendResponse({ success: true });
      return true;
    }
    
    // Toggle field highlighting on/off
    if (message.action === 'toggleHighlighting') {
      highlightEnabled = message.enabled === true;
      safeLog('Field highlighting ' + (highlightEnabled ? 'enabled' : 'disabled'));
      
      if (highlightEnabled && detectedFormData && detectedFormData.fields) {
        highlightFormFields(detectedFormData.fields);
      } else {
        removeAllHighlights();
      }
      
      sendResponse({ success: true, highlightEnabled: highlightEnabled });
      return true;
    }
    
    // Toggle debug mode
    if (message.action === 'toggleDebugMode') {
      debugMode = message.enabled;
      safeLog('Debug mode ' + (debugMode ? 'enabled' : 'disabled'));
      sendResponse({ success: true });
      return true;
    }
    
    // Get current form data
    if (message.action === 'getFormData') {
      sendResponse({ success: true, formData: detectedFormData });
      return true;
    }
    
    return true;
  });
}

// Detect forms on the page
function detectForms() {
  if (formDetectionInProgress) {
    safeLog('Form detection already in progress');
    return;
  }
  
  formDetectionInProgress = true;
  safeLog('Detecting forms');
  
  try {
    // Try using the enhanced detector if available
    let formData;
    if (window.EnhancedFieldDetector && typeof window.EnhancedFieldDetector.detectFields === 'function') {
      safeLog('Using EnhancedFieldDetector');
      formData = processEnhancedFieldDetectorResults(window.EnhancedFieldDetector.detectFields());
    }
    // Fall back to field detector
    else if (window.FieldDetector && typeof window.FieldDetector.scanForFields === 'function') {
      safeLog('Using FieldDetector');
      formData = window.FieldDetector.scanForFields();
    } else {
      // Fall back to basic scan
      safeLog('Using basic form scan');
      formData = scanForBasicForms();
    }
    
    // Store the results
    detectedFormData = formData;
    
    // Check if we found any forms
    if (formData && formData.fields && formData.fields.length > 0) {
      safeLog('Form detected', { 
        formId: formData.formId,
        fieldsCount: formData.fields.length
      });
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'formDetectionResult',
        results: {
          formFound: true,
          formId: formData.formId,
          fields: formData.fields,
          formType: formData.formType,
          url: window.location.href
        }
      }).catch(e => {
        safeLog('Error sending detection results', { error: e.message });
      });
      
      // Don't highlight automatically - only show action button
      if (!actionButtonInjected && formData.fields && formData.fields.length > 0) {
        injectActionButton(formData.fields.length);
      }
    } else {
      safeLog('No forms found');
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'formDetectionResult',
        results: {
          formFound: false,
          url: window.location.href
        }
      }).catch(e => {
        safeLog('Error sending detection results', { error: e.message });
      });
    }
  } catch (e) {
    safeLog('Error detecting forms', { error: e.message, stack: e.stack });
  } finally {
    formDetectionInProgress = false;
  }
}

// Process results from EnhancedFieldDetector
function processEnhancedFieldDetectorResults(detectorResults) {
  // Default empty form if results are invalid
  if (!detectorResults || !detectorResults.fields || !Array.isArray(detectorResults.fields)) {
    return {
      formId: 'form_' + Date.now(),
      formType: 'unknown',
      fields: [],
      formContext: { form_type: "unknown" }
    };
  }
  
  // Return the results directly
  return detectorResults;
}

// Basic form detection function
function scanForBasicForms() {
  // Get all forms on the page
  const forms = document.forms;
  const formFields = [];
  let formId = 'form_' + Date.now();
  
  // Process each form
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    
    // Set form ID if the form has one
    if (form.id) {
      formId = form.id;
    }
    
    // Get all input elements
    const inputs = form.querySelectorAll('input, select, textarea');
    for (let j = 0; j < inputs.length; j++) {
      const input = inputs[j];
      
      // Skip hidden and button inputs
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || input.type === 'reset') {
        continue;
      }
      
      // Try to find a label for this input
      let labelText = '';
      const labelElement = document.querySelector(`label[for="${input.id}"]`);
      if (labelElement) {
        labelText = labelElement.textContent.trim();
      }
      
      // Add field to the list
      formFields.push({
        id: input.id || `field_${j}`,
        name: input.name || '',
        type: input.type || input.tagName.toLowerCase(),
        label: labelText || input.placeholder || input.name || 'Field ' + (j + 1),
        required: input.required || false,
        element: input
      });
    }
  }
  
  // Also check for standalone fields (not in a form)
  const standaloneInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
  for (let i = 0; i < standaloneInputs.length; i++) {
    const input = standaloneInputs[i];
    
    // Skip if already in a form
    if (input.closest('form')) {
      continue;
    }
    
    // Try to find a label for this input
    let labelText = '';
    const labelElement = document.querySelector(`label[for="${input.id}"]`);
    if (labelElement) {
      labelText = labelElement.textContent.trim();
    }
    
    // Add field to the list
    formFields.push({
      id: input.id || `standalone_${i}`,
      name: input.name || '',
      type: input.type || input.tagName.toLowerCase(),
      label: labelText || input.placeholder || input.name || 'Field ' + (i + 1),
      required: input.required || false,
      element: input
    });
  }
  
  // Return form data
  return {
    formId: formId,
    formType: 'html',
    fields: formFields,
    formContext: { form_type: "html_form" }
  };
}

// Inject the helper panel using sidebar design
function injectPanel() {
  if (panelInjected) {
    safeLog('Panel already injected');
    // Show panel if it exists but is hidden
    const panelContainer = document.getElementById('form-helper-panel-container');
    if (panelContainer && panelContainer.style.display === 'none') {
      // Animate panel sliding in
      panelContainer.style.display = 'block';
      setTimeout(() => {
        panelContainer.style.transform = 'translateX(0)';
      }, 10);
    }
    return;
  }
  
  safeLog('Injecting sidebar panel');
  
  try {
    // Create panel container with slide-in animation
    const panelContainer = document.createElement('div');
    panelContainer.id = 'form-helper-panel-container';
    panelContainer.className = 'form-helper-sidebar';
    panelContainer.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 350px;
      height: 100%;
      z-index: 2147483647;
      border: none;
      box-shadow: -5px 0 15px rgba(0, 0, 0, 0.2);
      background: white;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    
    // Create panel iframe using the sidebar panel design
    panelFrame = document.createElement('iframe');
    panelFrame.id = 'form-helper-panel';
    panelFrame.src = chrome.runtime.getURL('panel.html');
    panelFrame.style.cssText = `
      border: none;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;
    
    // Add iframe to container
    panelContainer.appendChild(panelFrame);
    document.body.appendChild(panelContainer);
    
    panelInjected = true;
    
    // Animate panel sliding in
    setTimeout(() => {
      panelContainer.style.transform = 'translateX(0)';
    }, 10);
    
    // Send form data to panel once it's loaded
    panelFrame.addEventListener('load', function() {
      if (detectedFormData) {
        panelFrame.contentWindow.postMessage({
          action: 'formData',
          formData: detectedFormData
        }, '*');
      }
      
      // Add message listener for close button clicks from inside the panel
      window.addEventListener('message', function(event) {
        if (event.source === panelFrame.contentWindow && event.data.action === 'closePanel') {
          panelContainer.style.transform = 'translateX(100%)';
          // Remove field highlights when panel is closed
          removeAllHighlights();
          highlightEnabled = false;
          // Hide panel after animation completes
          setTimeout(() => {
            panelContainer.style.display = 'none';
          }, 300);
        }
      });
    });
    
  } catch (e) {
    safeLog('Error injecting panel', { error: e.message });
  }
}

// Highlight form fields
function highlightFormFields(fields) {
  // Remove any existing highlights
  removeAllHighlights();
  
  // Add highlights for each field
  fields.forEach(field => {
    if (field.element) {
      highlightElement(field.element, field.id);
    } else {
      // Try to find the element by ID or name
      const element = document.getElementById(field.id) || 
                      document.getElementsByName(field.name)[0] ||
                      document.querySelector(`[data-field-id="${field.id}"]`);
      
      if (element) {
        highlightElement(element, field.id);
      }
    }
  });
}

// Highlight a specific field
function highlightField(fieldId) {
  safeLog('Highlighting field', { fieldId });
  
  // First remove all highlights
  removeAllHighlights();
  
  // Try to find the element
  const field = detectedFormData?.fields?.find(f => f.id === fieldId);
  if (field && field.element) {
    highlightElement(field.element, fieldId);
  } else {
    // Try to find by ID or name
    const element = document.getElementById(fieldId) || 
                    document.getElementsByName(fieldId)[0] ||
                    document.querySelector(`[data-field-id="${fieldId}"]`);
    
    if (element) {
      highlightElement(element, fieldId);
    }
  }
}

// Add highlight to an element
function highlightElement(element, fieldId) {
  // Create highlight overlay
  const rect = element.getBoundingClientRect();
  const highlight = document.createElement('div');
  highlight.classList.add('form-helper-highlight');
  highlight.dataset.fieldId = fieldId;
  highlight.style.cssText = `
    position: absolute;
    z-index: 2147483646;
    background-color: rgba(77, 144, 254, 0.2);
    border: 2px solid rgba(77, 144, 254, 0.8);
    border-radius: 3px;
    box-shadow: 0 0 8px rgba(77, 144, 254, 0.4);
    box-sizing: border-box;
    pointer-events: none;
    transition: opacity 0.3s ease;
  `;
  
  // Position the highlight over the element
  updateHighlightPosition(highlight, element);
  
  // Add the highlight to the page
  document.body.appendChild(highlight);
  highlightedFields.push({ highlight, element, fieldId });
  
  // Add scroll listener to update position
  window.addEventListener('scroll', function() {
    updateHighlightPosition(highlight, element);
  });
  
  // Add resize listener to update position
  window.addEventListener('resize', function() {
    updateHighlightPosition(highlight, element);
  });
}

// Update the position of a highlight
function updateHighlightPosition(highlight, element) {
  const rect = element.getBoundingClientRect();
  
  highlight.style.top = `${rect.top + window.scrollY}px`;
  highlight.style.left = `${rect.left + window.scrollX}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;
}

// Remove all highlights
function removeAllHighlights() {
  const highlights = document.querySelectorAll('.form-helper-highlight');
  highlights.forEach(highlight => {
    highlight.remove();
  });
  highlightedFields = [];
}

// Fill a field with a value
function fillField(fieldId, value) {
  safeLog('Filling field', { fieldId, value });
  
  // Find the field
  const field = detectedFormData?.fields?.find(f => f.id === fieldId);
  let element = null;
  
  if (field && field.element) {
    element = field.element;
  } else {
    // Try to find by ID or name
    element = document.getElementById(fieldId) || 
              document.getElementsByName(fieldId)[0] ||
              document.querySelector(`[data-field-id="${fieldId}"]`);
  }
  
  if (!element) {
    safeLog('Could not find element for field', { fieldId });
    return;
  }
  
  // Fill the field based on its type
  if (element.tagName === 'SELECT') {
    // For select elements, try to find the option with the given value
    const option = Array.from(element.options).find(opt => 
      opt.value === value || opt.text === value
    );
    
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } else if (element.type === 'checkbox' || element.type === 'radio') {
    // For checkboxes and radios
    const shouldCheck = value === true || value === 'true' || value === '1' || value === 'yes';
    element.checked = shouldCheck;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // For text inputs, textareas, etc.
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  // Highlight the field briefly
  highlightField(fieldId);
  
  // After a delay, remove the highlight
  setTimeout(() => {
    removeAllHighlights();
  }, 2000);
}

// Handle window messages from the panel iframe
window.addEventListener('message', function(event) {
  // Only accept messages from our panel
  if (event.source !== (panelFrame?.contentWindow)) {
    return;
  }
  
  const message = event.data;
  safeLog('Received message from panel', { action: message.action });
  
  if (message.action === 'highlightField') {
    highlightField(message.fieldId);
  }
  
  if (message.action === 'fillField') {
    fillField(message.fieldId, message.value);
  }
  
  if (message.action === 'scanForms') {
    detectForms();
  }
  
  if (message.action === 'closePanel') {
    safeLog('Closing panel from iframe message');
    const container = document.getElementById('form-helper-panel-container');
    if (container) {
      // Slide panel away and then hide it
      container.style.transform = 'translateX(100%)';
      // Remove field highlights when panel is closed
      removeAllHighlights();
      highlightEnabled = false;
      // Hide panel after animation completes
      setTimeout(() => {
        container.style.display = 'none';
      }, 300);
    }
  }
  
  if (message.action === 'formData') {
    // Handle any form data requests from the panel
    if (detectedFormData) {
      panelFrame.contentWindow.postMessage({
        action: 'formData',
        formData: detectedFormData
      }, '*');
    }
  }
});

// Run on page load
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  // Run after a short delay to ensure everything is loaded
  setTimeout(initializeFormHelper, 500);
} else {
  // Wait for page to load
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initializeFormHelper, 500);
  });
}

// Inject floating action button
function injectActionButton(fieldCount) {
  if (actionButtonInjected) {
    return;
  }
  
  safeLog('Injecting action button');
  
  try {
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'form-helper-action-button';
    buttonContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483646; /* Just below max to avoid conflicts with modals */
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      border-radius: 50px;
      background-color: #4285F4;
      color: white;
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 12px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      border: none;
      overflow: hidden;
      max-width: 56px;
      transition: max-width 0.3s ease, padding 0.3s ease;
    `;
    
    // Add button content
    buttonContainer.innerHTML = `
      <div style="display: flex; align-items: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" style="margin-right: 8px; min-width: 24px;">
          <path d="M21 3H3C1.9 3 1 3.9 1 5V19C1 20.1 1.9 21 3 21H21C22.1 21 23 20.1 23 19V5C23 3.9 22.1 3 21 3ZM21 19H3V5H21V19ZM7 10.5H5V9H7V10.5ZM7 13.5H5V12H7V13.5ZM7 16.5H5V15H7V16.5ZM19 16.5H9V15H19V16.5ZM19 13.5H9V12H19V13.5ZM19 10.5H9V9H19V10.5Z"/>
        </svg>
        <span style="white-space: nowrap; opacity: 0;" id="form-helper-button-text">AI Form Helper (${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'})</span>
      </div>
    `;
    
    // Add hover effect
    buttonContainer.addEventListener('mouseenter', () => {
      buttonContainer.style.maxWidth = '300px';
      buttonContainer.style.padding = '12px 24px';
      const textElement = buttonContainer.querySelector('#form-helper-button-text');
      if (textElement) {
        textElement.style.opacity = '1';
        textElement.style.transition = 'opacity 0.3s ease';
      }
    });
    
    buttonContainer.addEventListener('mouseleave', () => {
      buttonContainer.style.maxWidth = '56px';
      buttonContainer.style.padding = '12px 20px';
      const textElement = buttonContainer.querySelector('#form-helper-button-text');
      if (textElement) {
        textElement.style.opacity = '0';
      }
    });
    
    // Add click handler for sidebar panel integration
    buttonContainer.addEventListener('click', () => {
      // Track button click
      safeLog('Action button clicked');
      
      // Get the sidebar panel element
      const sidebarPanel = document.getElementById('sidebar-panel');
      
      // Inject panel if not already done
      if (!panelInjected) {
        injectPanel();
      } else {
        // Toggle panel visibility with slide animation
        const panelContainer = document.getElementById('form-helper-panel-container');
        if (panelContainer) {
          if (panelContainer.style.display === 'none') {
            // Show panel with animation
            panelContainer.style.display = 'block';
            setTimeout(() => {
              panelContainer.style.transform = 'translateX(0)';
            }, 10);
          } else {
            // Hide panel with animation
            panelContainer.style.transform = 'translateX(100%)';
            setTimeout(() => {
              panelContainer.style.display = 'none';
            }, 300);
          }
        }
      }
      
      // Enable highlighting when panel is shown
      highlightEnabled = true;
      if (detectedFormData && detectedFormData.fields) {
        highlightFormFields(detectedFormData.fields);
      }
    });
    
    // Add to page
    document.body.appendChild(buttonContainer);
    actionButtonInjected = true;
    
  } catch (e) {
    safeLog('Error injecting action button', { error: e.message });
  }
}

// Expose to window for debugging
window.formHelper = {
  detectForms,
  injectPanel,
  injectActionButton,
  highlightField,
  fillField,
  removeAllHighlights
};