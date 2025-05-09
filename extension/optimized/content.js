/**
 * Optimized Form Helper Content Script
 *
 * Handles all page-level interactions for the Form Helper extension:
 * - Form detection and analysis
 * - Field extraction and context analysis
 * - Message handling from background script and panel
 * - Form interaction (highlighting, auto-filling, etc.)
 * 
 * Uses the shared utility modules and improved event handling.
 */

const FormHelperContent = (function() {
  // Private module variables
  let globalFormContext = null;
  const domCache = {};
  
  /**
   * Initialize the content script
   */
  function initialize() {
    UTILS.logInfo("Form Helper content script loaded");
    
    // Check if the formAnalyzer is available
    if (typeof window.formAnalyzer === 'undefined') {
      UTILS.logError("Form analyzer not available");
      return;
    }

    // Set up message listener
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Set up DOM listeners
    setupDomListeners();
    
    // Detect forms when ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(detectForms, 500);  // Small delay to ensure DOM is fully available
    }
  }
  
  /**
   * Set up DOM event listeners
   */
  function setupDomListeners() {
    document.addEventListener('DOMContentLoaded', detectForms);
    
    // Listen for form submissions
    document.addEventListener('submit', (event) => {
      // Check if the submitted element is a form and we know about it
      if (event.target.tagName === 'FORM') {
        UTILS.logDebug('Form submitted:', event.target);
        
        // Could track form submissions here if needed
        // EventBus.publish(EventBus.EVENTS.FORM_SUBMITTED, {...});
      }
    });
    
    // Listen for field input changes to save to profile
    document.addEventListener('change', (event) => {
      // Check if the changed element is a form field
      if (isFormField(event.target)) {
        const fieldName = event.target.name || event.target.id;
        const fieldValue = event.target.value;
        
        if (fieldName && fieldValue) {
          // Notify panel script to save value
          chrome.runtime.sendMessage({
            action: 'saveFieldValue',
            fieldName: fieldName,
            fieldValue: fieldValue
          });
        }
      }
    });
  }
  
  /**
   * Handle messages from background script or panel
   * @param {Object} request - Request message
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response function
   * @return {boolean} Keep message channel open
   */
  function handleMessage(request, sender, sendResponse) {
    UTILS.logDebug('Content script received message:', request);
    
    // Handle form scanning request from panel
    if (request.action === 'scanForms') {
      UTILS.logInfo('Scanning forms for panel');
      
      // Run scan process asynchronously to prevent message channel from closing
      setTimeout(() => {
        try {
          const formData = scanFormsForPanel();
          
          if (formData.fields.length > 0) {
            chrome.runtime.sendMessage({
              action: 'formDetected',
              formData: formData
            });
          } else {
            chrome.runtime.sendMessage({
              action: 'noFormsFound'
            });
          }
        } catch (error) {
          UTILS.logError('Error scanning forms:', error);
          // Notify of error
          chrome.runtime.sendMessage({
            action: 'formError',
            error: error.message
          });
        }
      }, 0);
      
      // Send an immediate response before the async operation completes
      sendResponse({success: true, message: 'Form scan initiated'});
      return true;
    }
    
    // Handle form context response request from panel
    if (request.action === 'getFormContextResponse') {
      UTILS.logInfo('Generating form context response for:', request.question);
      
      // Always provide a response - if no context is available, create a basic one
      try {
        // Use a fallback context if necessary
        const context = globalFormContext || {
          form_type: "web form",
          form_purpose: "collecting information",
          description: "This form allows you to submit information to the website.",
          confidence: 0.5
        };
        
        // Generate a response using the analyzer
        let response = "This appears to be a form for collecting information.";
        
        if (typeof window.formAnalyzer !== 'undefined') {
          response = window.formAnalyzer.generateFormContextResponse(
            request.question, 
            context
          );
        }
        
        UTILS.logDebug('Generated form context response:', response);
        
        // Send the response back
        sendResponse({
          success: true, 
          formContextResponse: response
        });
      } catch (error) {
        UTILS.logError('Error generating form context response:', error);
        
        // Provide a helpful fallback response
        sendResponse({
          success: true, 
          formContextResponse: "This appears to be a form for collecting information. I can help you understand what specific fields are for if you have questions about them."
        });
      }
      
      return true;
    }
    
    // Handle auto-fill request from panel
    if (request.action === 'autoFillForm') {
      UTILS.logInfo('Auto-filling form fields');
      const formId = request.formId;
      const profileData = request.profileData || null;
      
      const fieldsCount = autoFillFormFields(formId, profileData);
      
      sendResponse({success: true, count: fieldsCount});
      return true;
    }
    
    // Handle field highlight request
    if (request.action === 'highlightField') {
      UTILS.logInfo('Highlighting field:', request.fieldName);
      const success = highlightField(request.fieldName);
      
      sendResponse({success: success});
      return true;
    }
    
    // Always return true for async sendResponse
    return true;
  }
  
  /**
   * Detect all forms on the page
   */
  function detectForms() {
    UTILS.logInfo("Scanning for forms on page...");
    
    // Find all forms in the document
    const forms = document.querySelectorAll(CONFIG.SELECTORS.FORM);
    
    // Enhanced form detection - look for inputs outside of forms too
    let hasStandaloneInputs = false;
    if (forms.length === 0) {
      const inputs = document.querySelectorAll(CONFIG.SELECTORS.INPUTS);
      hasStandaloneInputs = inputs.length > 0;
      
      if (hasStandaloneInputs) {
        UTILS.logInfo(`Found ${inputs.length} input fields outside of forms`);
        
        // Create a virtual form wrapper for these inputs
        const virtualForm = document.createElement('div');
        virtualForm.id = 'form-helper-virtual-form';
        virtualForm._isVirtual = true; // Mark as virtual
        
        // Add Form Helper button for these standalone inputs
        addFormHelperButton(virtualForm);
        
        // Notify the extension popup about found "forms"
        chrome.runtime.sendMessage({
          action: 'formsFound',
          count: 1,
          isVirtual: true
        });
      }
    }
    
    if (forms.length > 0) {
      UTILS.logInfo(`Found ${forms.length} forms on page`);
      
      // Add Form Helper buttons to each form
      forms.forEach((form, index) => {
        // Add a unique identifier if not present
        if (!form.id) {
          form.id = `form-helper-form-${index}`;
        }
        
        // Add processing button next to the form
        addFormHelperButton(form);
      });
      
      // Notify the extension popup about found forms
      chrome.runtime.sendMessage({
        action: 'formsFound',
        count: forms.length
      });
    } else if (!hasStandaloneInputs) {
      UTILS.logInfo("No forms or input fields detected on page");
    }
  }
  
  /**
   * Scan forms for the panel interface
   * @return {Object} Form data
   */
  function scanFormsForPanel() {
    UTILS.logInfo("Scanning forms for side panel");
    
    // Find all forms in the document
    const forms = document.querySelectorAll(CONFIG.SELECTORS.FORM);
    
    // Generate a unique form ID for this page
    let formId = 'form_' + Date.now();
    
    // Prepare fields array
    let fields = [];
    let formElement = null;
    
    // If no traditional forms found, look for standalone inputs
    if (forms.length === 0) {
      UTILS.logInfo("No forms found, checking for standalone inputs");
      const inputs = document.querySelectorAll(CONFIG.SELECTORS.INPUTS);
      
      if (inputs.length > 0) {
        UTILS.logInfo(`Found ${inputs.length} standalone input fields`);
        
        // Process these standalone inputs with enhanced field context
        inputs.forEach(input => {
          // Skip submit buttons
          if (['submit', 'button', 'image', 'reset'].includes(input.type)) {
            return;
          }
          
          // Get rich field context
          const fieldContext = extractFieldContext(input);
          
          // Skip if no valid context could be extracted
          if (!fieldContext) {
            return;
          }
          
          // Add to fields array
          fields.push(fieldContext);
        });
        
        formId = 'standalone_inputs';
      }
    } else {
      // For simplicity, focus on the first form for now
      formElement = forms[0];
      
      // Add a unique identifier if not present
      if (!formElement.id) {
        formElement.id = formId;
      } else {
        formId = formElement.id;
      }
      
      // Process all input elements in the form with enhanced field context
      formElement.querySelectorAll(CONFIG.SELECTORS.INPUTS).forEach(input => {
        // Skip submit buttons and hidden fields
        if (['submit', 'button', 'image', 'reset', 'hidden'].includes(input.type)) {
          return;
        }
        
        // Get rich field context
        const fieldContext = extractFieldContext(input);
        
        // Skip if no valid context could be extracted
        if (!fieldContext) {
          return;
        }
        
        // Add to fields array
        fields.push(fieldContext);
      });
    }
    
    UTILS.logInfo(`Found ${fields.length} fields in form/page`);
    
    // Extract form level context (if available)
    let basicFormContext = {};
    if (formElement) {
      basicFormContext = {
        id: formElement.id,
        name: formElement.getAttribute('name') || '',
        action: formElement.getAttribute('action') || '',
        method: formElement.getAttribute('method') || '',
        enctype: formElement.getAttribute('enctype') || '',
        novalidate: formElement.hasAttribute('novalidate'),
        autocomplete: formElement.getAttribute('autocomplete') || ''
      };
    } else {
      basicFormContext = {
        id: formId,
        type: 'virtual',
        context: document.title
      };
    }
    
    // Enhanced intelligent form context detection
    const enhancedFormContext = window.formAnalyzer.analyzeFormContext(formElement, fields, {
      url: window.location.href,
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.content || ''
    });
    
    // Merge the technical form data with the intelligent context detection
    const formContext = {
      ...basicFormContext,
      ...enhancedFormContext
    };
    
    // Store globally for future reference
    globalFormContext = formContext;
    
    // Send a message to the background script
    chrome.runtime.sendMessage({
      action: 'formProcessed',
      formData: { 
        formId: formId, 
        fields: fields,
        formContext: formContext,
        pageContext: {
          title: document.title,
          url: window.location.href,
          metaDescription: document.querySelector('meta[name="description"]')?.content || ''
        }
      }
    });
    
    // Return the form data
    return { 
      formId: formId, 
      fields: fields,
      formContext: formContext,
      pageContext: {
        title: document.title,
        url: window.location.href
      }
    };
  }
  
  /**
   * Extract rich context from form fields
   * @param {Element} input - Input element
   * @return {Object|null} Field context or null if invalid
   */
  function extractFieldContext(input) {
    // Basic field properties
    const fieldType = input.type || input.tagName.toLowerCase();
    const fieldName = input.name || '';
    const fieldId = input.id || '';
    
    // Skip if no way to identify it
    if (!fieldName && !fieldId && !input.placeholder) {
      return null;
    }
    
    // Get field label using various methods
    const label = getFieldLabel(input, fieldId);
    
    // Find nearby help text
    const helpText = getFieldHelpText(input);
    
    // Get validation rules
    const validationRules = getFieldValidationRules(input);
    
    // For select elements, get options
    let options = [];
    if (input.tagName === 'SELECT') {
      options = Array.from(input.options).map(option => ({
        value: option.value,
        text: option.text,
        selected: option.selected
      }));
    }
    
    // For radio buttons and checkboxes, get all options in the same group
    if (fieldName && (fieldType === 'radio' || fieldType === 'checkbox')) {
      options = getFieldOptions(fieldName, input);
    }
    
    // Guess field purpose by analyzing name, id, and label
    const fieldPurpose = UTILS.guessFieldPurpose(fieldName, fieldId, label, fieldType);
    
    // Determine if the field is required
    // For password fields, set required to true by default unless explicitly marked optional
    let isRequired = input.required;
    
    if (fieldType === 'password' || (fieldName && fieldName.toLowerCase().includes('password'))) {
      isRequired = validationRules.required !== false; // Default to true unless explicitly set to false
    } else {
      isRequired = input.required || validationRules.required === true;
    }
    
    // Create base field context
    const fieldContext = {
      name: fieldName || fieldId || label.toLowerCase().replace(/\s+/g, '_'),
      id: fieldId,
      type: fieldType,
      element: fieldName || fieldId || input.placeholder, // Store reference to find element later
      label: label,
      required: isRequired,
      value: input.value || '',
      helpText: helpText,
      validationRules: validationRules,
      options: options,
      purpose: fieldPurpose,
      placeholder: input.placeholder || '',
      ariaLabel: input.getAttribute('aria-label') || '',
      ariaRequired: input.getAttribute('aria-required') || '',
      ariaInvalid: input.getAttribute('aria-invalid') || '',
      className: input.className || ''
    };
    
    // Enhance password fields with context awareness
    if (fieldType === 'password' || (fieldName && fieldName.toLowerCase().includes('password'))) {
      try {
        // Get all fields in the form for context
        let allFields = [];
        let formElement = null;
        
        if (input.form) {
          formElement = input.form;
          const formInputs = formElement.querySelectorAll(CONFIG.SELECTORS.INPUTS);
          
          // Just use basic field information to avoid recursion
          formInputs.forEach(formInput => {
            if (formInput !== input) {
              allFields.push({
                name: formInput.name || '',
                id: formInput.id || '',
                type: formInput.type || formInput.tagName.toLowerCase(),
                label: formInput.getAttribute('aria-label') || ''
              });
            }
          });
        }
        
        // Get form context using analyzer
        const formContext = window.formAnalyzer.analyzeFormContext(formElement, [fieldContext, ...allFields], {
          url: window.location.href,
          title: document.title
        });
        
        // Enhance password field
        return window.formAnalyzer.enhancePasswordField(fieldContext, allFields, formElement, formContext);
      } catch (error) {
        UTILS.logError('Error enhancing password field:', error);
      }
    }
    
    return fieldContext;
  }
  
  /**
   * Get field label using multiple strategies
   * @param {Element} input - Input element
   * @param {string} fieldId - Field ID
   * @return {string} Field label
   */
  function getFieldLabel(input, fieldId) {
    let label = '';
    
    // Method 1: Associated label element
    if (fieldId) {
      const labelElement = document.querySelector(`label[for="${fieldId}"]`);
      if (labelElement) {
        label = labelElement.textContent.trim();
      }
    }
    
    // Method 2: Parent label element
    if (!label && input.parentElement && input.parentElement.tagName === 'LABEL') {
      const labelText = input.parentElement.textContent.replace(input.value, '').trim();
      if (labelText) {
        label = labelText;
      }
    }
    
    // Method 3: Look for heading elements or divs near the input
    if (!label) {
      const parent = input.parentElement;
      if (parent) {
        // Look for sibling elements that might be labels
        const siblings = Array.from(parent.childNodes);
        for (const sibling of siblings) {
          if (sibling !== input && sibling.nodeType === Node.ELEMENT_NODE) {
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL', 'SPAN', 'DIV', 'P'].includes(sibling.tagName)) {
              const siblingText = sibling.textContent.trim();
              if (siblingText && siblingText.length < 50) { // Reasonable label length
                label = siblingText;
                break;
              }
            }
          }
        }
      }
    }
    
    // Method 4: Use fallbacks if no label found
    if (!label) {
      label = input.getAttribute('placeholder') || 
             input.getAttribute('aria-label') || 
             input.name?.replace(/_/g, ' ') ||
             input.id?.replace(/_/g, ' ') ||
             input.type?.charAt(0).toUpperCase() + input.type?.slice(1) + ' Field';
    }
    
    return label;
  }
  
  /**
   * Get help text associated with a field
   * @param {Element} input - Input element
   * @return {string} Help text
   */
  function getFieldHelpText(input) {
    let helpText = '';
    
    // Look for common help text patterns
    const parentNode = input.parentNode;
    if (parentNode) {
      // Find siblings with help text classes
      const helpElements = parentNode.querySelectorAll('.help-text, .hint, .description, .form-text, .field-hint, [aria-describedby], .help-block');
      if (helpElements.length > 0) {
        helpText = helpElements[0].textContent.trim();
      }
      
      // Look for elements with IDs referenced by aria-describedby
      const ariaDescribedBy = input.getAttribute('aria-describedby');
      if (ariaDescribedBy && !helpText) {
        const helpElement = document.getElementById(ariaDescribedBy);
        if (helpElement) {
          helpText = helpElement.textContent.trim();
        }
      }
      
      // Look for small tags or spans that might contain help text
      if (!helpText) {
        const smallElements = parentNode.querySelectorAll('small, .text-muted, .form-text');
        if (smallElements.length > 0) {
          helpText = smallElements[0].textContent.trim();
        }
      }
    }
    
    return helpText;
  }
  
  /**
   * Get validation rules for a field
   * @param {Element} input - Input element
   * @return {Object} Validation rules
   */
  function getFieldValidationRules(input) {
    const validationRules = {};
    
    // HTML5 validation attributes
    if (input.hasAttribute('required')) {
      validationRules.required = true;
    }
    
    // Special handling for password fields - make them required by default
    // unless explicitly marked as optional with aria-required="false"
    if (input.type === 'password' || 
        (input.name && input.name.toLowerCase().includes('password'))) {
      validationRules.required = 
        !(input.getAttribute('aria-required') === 'false' || 
          input.hasAttribute('data-optional'));
    }
    
    if (input.hasAttribute('pattern')) {
      validationRules.pattern = input.getAttribute('pattern');
    }
    
    if (input.hasAttribute('minlength')) {
      validationRules.minLength = input.getAttribute('minlength');
    }
    
    if (input.hasAttribute('maxlength')) {
      validationRules.maxLength = input.getAttribute('maxlength');
    }
    
    if (input.hasAttribute('min')) {
      validationRules.min = input.getAttribute('min');
    }
    
    if (input.hasAttribute('max')) {
      validationRules.max = input.getAttribute('max');
    }
    
    return validationRules;
  }
  
  /**
   * Get options for radio or checkbox fields
   * @param {string} fieldName - Field name
   * @param {Element} currentInput - Current input element
   * @return {Array} Options
   */
  function getFieldOptions(fieldName, currentInput) {
    const sameNameInputs = document.querySelectorAll(`input[name="${fieldName}"]`);
    
    return Array.from(sameNameInputs).map(option => {
      let optionLabel = '';
      
      // Try to find label for this option
      if (option.id) {
        const labelEl = document.querySelector(`label[for="${option.id}"]`);
        if (labelEl) {
          optionLabel = labelEl.textContent.trim();
        }
      }
      
      // If no label found and option is inside a label
      if (!optionLabel && option.parentElement && option.parentElement.tagName === 'LABEL') {
        optionLabel = option.parentElement.textContent.replace(option.value, '').trim();
      }
      
      return {
        value: option.value,
        text: optionLabel || option.value,
        checked: option.checked
      };
    });
  }
  
  /**
   * Add a helper button next to the form
   * @param {Element} form - Form element
   */
  function addFormHelperButton(form) {
    const button = UTILS.createElement('button', {
      textContent: 'Form Helper',
      className: 'form-helper-button',
      style: {
        position: 'relative',
        margin: '10px 0',
        backgroundColor: '#4285f4',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '8px 12px',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif'
      },
      onClick: () => {
        // Send message to background script to open side panel
        chrome.runtime.sendMessage({
          action: 'openSidePanel',
          formId: form.id
        });
        
        // Also trigger form scan
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: 'scanForm',
            formId: form.id
          });
        }, 500); // Short delay to ensure panel is open
      }
    });
    
    // Insert button before the form
    if (form._isVirtual) {
      // For virtual forms, find a good location for the button
      const goodLocation = document.querySelector('form') || 
                           document.querySelector('input') || 
                           document.querySelector('h1') ||
                           document.body.firstChild;
      
      if (goodLocation && goodLocation.parentNode) {
        goodLocation.parentNode.insertBefore(button, goodLocation);
      } else {
        document.body.appendChild(button);
      }
    } else {
      // For regular forms, insert before the form
      form.parentNode.insertBefore(button, form);
    }
  }
  
  /**
   * Auto-fill all form fields
   * @param {string} formId - Form ID
   * @param {Object} profileData - Optional profile data
   * @return {number} Number of fields filled
   */
  function autoFillFormFields(formId, profileData) {
    UTILS.logInfo(`Auto-filling form: ${formId}`, profileData);
    
    // Find the form
    let form = document.getElementById(formId);
    let inputs = [];
    
    // If dealing with standalone inputs or virtual form
    if (formId === 'standalone_inputs' || !form) {
      inputs = document.querySelectorAll(CONFIG.SELECTORS.INPUTS);
    } else {
      // Get all input elements within the form
      inputs = form.querySelectorAll(CONFIG.SELECTORS.INPUTS);
    }
    
    let filledCount = 0;
    
    // Fill each field based on type
    inputs.forEach(input => {
      // Skip hidden, submit, buttons
      if (['submit', 'button', 'image', 'reset', 'hidden'].includes(input.type)) {
        return;
      }
      
      const fieldName = input.name || input.id || '';
      if (!fieldName) return;
      
      const fieldLabel = input.getAttribute('placeholder') || 
                      input.getAttribute('aria-label') || 
                      '';
      
      // Get appropriate value for this field
      let value = UTILS.getDefaultFieldValue(fieldName, input.type, profileData);
      
      // If this was generated data, save it to the profile for future use
      if (fieldName && value) {
        // Send message to panel to save this value
        chrome.runtime.sendMessage({
          action: 'saveFieldValue',
          fieldName: fieldName,
          fieldValue: value
        });
      }
      
      // Set the value based on input type
      if (input.type === 'checkbox') {
        input.checked = true;
      } else if (input.type === 'radio') {
        input.checked = true;
      } else {
        input.value = value;
      }
      
      filledCount++;
      
      // Trigger change event
      const event = new Event('change', { bubbles: true });
      input.dispatchEvent(event);
      
      // Highlight the field briefly
      highlightField(input.name || input.id);
    });
    
    return filledCount;
  }
  
  /**
   * Highlight a specific field
   * @param {string} fieldSelector - Field selector
   * @return {boolean} Success
   */
  function highlightField(fieldSelector) {
    if (!fieldSelector) return false;
    
    UTILS.logInfo(`Highlighting field: ${fieldSelector}`);
    
    // Find the field by name or id
    let field = document.querySelector(`[name="${fieldSelector}"], [id="${fieldSelector}"]`);
    
    // If not found, try looking by placeholder
    if (!field) {
      field = document.querySelector(`[placeholder="${fieldSelector}"]`);
    }
    
    // If still not found, try a case-insensitive match on various attributes
    if (!field) {
      const allInputs = document.querySelectorAll(CONFIG.SELECTORS.INPUTS);
      for (const input of allInputs) {
        if (input.name && input.name.toLowerCase() === fieldSelector.toLowerCase() ||
            input.id && input.id.toLowerCase() === fieldSelector.toLowerCase() ||
            input.placeholder && input.placeholder.toLowerCase() === fieldSelector.toLowerCase() ||
            input.getAttribute('aria-label') && input.getAttribute('aria-label').toLowerCase() === fieldSelector.toLowerCase()) {
          field = input;
          break;
        }
      }
    }
    
    if (field) {
      // Save original style
      const originalBackground = field.style.backgroundColor;
      const originalBorder = field.style.border;
      const originalBoxShadow = field.style.boxShadow;
      
      // Apply highlight style
      field.style.backgroundColor = '#fffacd';
      field.style.border = '2px solid #4285f4';
      field.style.boxShadow = '0 0 8px rgba(66, 133, 244, 0.6)';
      
      // Scroll the field into view
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Remove highlight after a delay
      setTimeout(() => {
        field.style.backgroundColor = originalBackground;
        field.style.border = originalBorder;
        field.style.boxShadow = originalBoxShadow;
      }, 2000);
      
      return true;
    }
    
    UTILS.logInfo(`Could not find field: ${fieldSelector}`);
    return false;
  }
  
  /**
   * Check if an element is a form field
   * @param {Element} element - DOM element
   * @return {boolean} True if element is a form field
   */
  function isFormField(element) {
    if (!element) return false;
    
    // Check tag name
    const tagName = element.tagName.toLowerCase();
    if (['input', 'select', 'textarea'].includes(tagName)) {
      // Exclude submit buttons and hidden fields
      if (tagName === 'input') {
        return !['submit', 'button', 'image', 'reset', 'hidden'].includes(element.type);
      }
      return true;
    }
    
    return false;
  }
  
  // Initialize module
  initialize();
  
  // Return public API
  return {
    // Expose methods for testing and extension
    detectForms,
    scanFormsForPanel,
    autoFillFormFields,
    highlightField,
    extractFieldContext
  };
})();

// Make available globally
window.FormHelperContent = FormHelperContent;