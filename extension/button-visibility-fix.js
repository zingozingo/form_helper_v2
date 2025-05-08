/**
 * Button Visibility Fix - Ensures that buttons are properly visible and clickable
 */

// Create namespace to avoid conflicts
window.ButtonVisibilityFix = window.ButtonVisibilityFix || {};

(function(namespace) {
  // Debug mode
  namespace.debugMode = false;

  /**
   * Log debug messages when debug mode is enabled
   */
  namespace.log = function(message, data = {}) {
    if (namespace.debugMode) {
      console.log(`🔘 Button Fix: ${message}`, {
        timestamp: new Date().toISOString(),
        ...data
      });
    } else {
      console.log(`🔘 Button Fix: ${message}`);
    }
  };

  /**
   * Enable debug mode
   */
  namespace.enableDebug = function() {
    namespace.debugMode = true;
    namespace.log("Debug mode enabled");
  };

  /**
   * Fix button visibility in panel.html
   */
  namespace.fixPanelButtons = function() {
    namespace.log("Fixing panel buttons visibility");
    
    // Important buttons to fix
    const buttonIds = [
      'send-button',
      'autofill-button',
      'clear-button', 
      'help-button',
      'explain-field-button',
      'toggle-fields-btn'
    ];
    
    let fixedCount = 0;
    
    // Fix each button
    buttonIds.forEach(id => {
      const button = document.getElementById(id);
      if (button) {
        // Apply overriding styles to ensure button visibility
        button.style.cssText = `
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          position: relative !important;
          z-index: 9999 !important;
          min-height: 36px !important;
          min-width: 36px !important;
          border: 2px solid #4285F4 !important;
          background-color: #FFFFFF !important;
          color: #4285F4 !important;
          font-weight: bold !important;
          margin: 5px !important;
          padding: 8px 16px !important;
          border-radius: 4px !important;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
        `;
        
        // Double-check event listeners
        ensureButtonClickable(button);
        
        fixedCount++;
        namespace.log(`Fixed button: ${id}`);
      } else {
        namespace.log(`Button not found: ${id}`);
      }
    });
    
    // Fix container elements if needed
    fixContainerElements();
    
    return fixedCount;
  };
  
  /**
   * Ensure button has click listeners and is clickable
   */
  function ensureButtonClickable(button) {
    // Check if button already has click listeners
    const hasClickListeners = button.onclick || 
                              (button._events && button._events.click) || 
                              button.getAttribute('onclick');
    
    // If no click listeners detected, try to add one based on button ID
    if (!hasClickListeners) {
      switch (button.id) {
        case 'send-button':
          button.addEventListener('click', function() {
            namespace.log('send-button clicked (added listener)');
            const chatForm = document.getElementById('chat-form');
            if (chatForm) {
              const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
              chatForm.dispatchEvent(submitEvent);
            }
          });
          break;
          
        case 'autofill-button':
          button.addEventListener('click', function() {
            namespace.log('autofill-button clicked (added listener)');
            // Try to find the autofill function in window scope
            if (typeof window.autoFillForm === 'function') {
              window.autoFillForm();
            } else if (typeof window.autofillForm === 'function') {
              window.autofillForm();
            } else {
              // If function not found, try to send a message to request auto-fill
              chrome.runtime.sendMessage({
                action: 'autoFillForm',
                formId: window.currentFormId || document.querySelector('form')?.id || 'form_default'
              });
            }
          });
          break;
          
        case 'toggle-fields-btn':
          button.addEventListener('click', function() {
            namespace.log('toggle-fields-btn clicked (added listener)');
            // Find fields panel
            const fieldsPanel = document.getElementById('fields-panel');
            if (fieldsPanel) {
              // Toggle collapsed class
              fieldsPanel.classList.toggle('collapsed');
              // Update toggle icon
              const toggleIcon = button.querySelector('.toggle-icon');
              if (toggleIcon) {
                toggleIcon.innerHTML = fieldsPanel.classList.contains('collapsed')
                  ? '&raquo;'
                  : '&laquo;';
              }
            }
          });
          break;
          
        default:
          button.addEventListener('click', function() {
            namespace.log(`${button.id} clicked (added default listener)`);
          });
      }
      
      namespace.log(`Added click listener to ${button.id}`);
    }
    
    // Remove any pointer-events: none that might be preventing clicks
    button.style.pointerEvents = 'auto';
  }
  
  /**
   * Fix container elements that might be affecting button visibility
   */
  function fixContainerElements() {
    // Fix panel-actions container
    const panelActions = document.querySelector('.panel-actions');
    if (panelActions) {
      panelActions.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 9000 !important;
        min-height: 50px !important;
        width: 100% !important;
        padding: 10px !important;
        background-color: white !important;
        border-top: 1px solid #e0e0e0 !important;
        justify-content: center !important;
        align-items: center !important;
      `;
      namespace.log("Fixed panel-actions container");
    }
    
    // Fix chat-form container
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
      chatForm.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 8000 !important;
        width: 100% !important;
        padding: 10px !important;
        background-color: white !important;
        border-top: 1px solid #e0e0e0 !important;
        justify-content: center !important;
        align-items: center !important;
      `;
      namespace.log("Fixed chat-form container");
    }
  }

  /**
   * Create emergency floating button if all else fails
   */
  namespace.createEmergencyButton = function() {
    namespace.log("Creating emergency floating button");
    
    // Check if emergency button already exists
    const existingButton = document.getElementById('emergency-button');
    if (existingButton) {
      existingButton.style.display = 'flex';
      return existingButton;
    }
    
    // Create the button
    const emergencyButton = document.createElement('button');
    emergencyButton.id = 'emergency-button';
    emergencyButton.textContent = '🤖 AI Form Help';
    emergencyButton.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      background-color: #4285F4 !important;
      color: white !important;
      border: none !important;
      border-radius: 50px !important;
      padding: 12px 24px !important;
      font-weight: bold !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
      font-size: 14px !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      transition: transform 0.2s !important;
    `;
    
    // Add hover effect
    emergencyButton.addEventListener('mouseover', () => {
      emergencyButton.style.transform = 'scale(1.05)';
      emergencyButton.style.backgroundColor = '#3367d6';
    });
    
    emergencyButton.addEventListener('mouseout', () => {
      emergencyButton.style.transform = 'scale(1)';
      emergencyButton.style.backgroundColor = '#4285F4';
    });
    
    // Add click handler
    emergencyButton.addEventListener('click', () => {
      namespace.log("Emergency button clicked");
      
      // If auto-fill function is available, call it
      if (typeof window.autoFillForm === 'function') {
        namespace.log("Calling autoFillForm() function");
        window.autoFillForm();
      } else if (typeof window.autofillForm === 'function') {
        namespace.log("Calling autofillForm() function");
        window.autofillForm();
      } else {
        // Send message to background script
        namespace.log("Sending autoFillForm message to background");
        chrome.runtime.sendMessage({
          action: 'autoFillForm',
          formId: window.currentFormId || document.querySelector('form')?.id || 'form_default'
        });
      }
      
      // Try to open the side panel
      chrome.runtime.sendMessage({ action: 'openSidePanel' });
    });
    
    // Add to document
    document.body.appendChild(emergencyButton);
    
    // Schedule to hide after 10 seconds
    setTimeout(() => {
      // Only hide if regular buttons are working
      const workingButtons = document.querySelectorAll('button:not(#emergency-button)');
      if (workingButtons.length > 0) {
        emergencyButton.style.opacity = '0.5';
        emergencyButton.style.transform = 'scale(0.8)';
      }
    }, 10000);
    
    return emergencyButton;
  };

  /**
   * Add command input for text-based control
   */
  namespace.addCommandInput = function() {
    namespace.log("Adding command input fallback");
    
    // Check if command input already exists
    const existingInput = document.getElementById('command-input');
    if (existingInput) {
      return existingInput;
    }
    
    // Create container for command input
    const commandContainer = document.createElement('div');
    commandContainer.id = 'command-container';
    commandContainer.style.cssText = `
      position: fixed !important;
      bottom: 80px !important;
      right: 20px !important;
      z-index: 2147483646 !important;
      background-color: white !important;
      border: 2px solid #4285F4 !important;
      border-radius: 8px !important;
      padding: 10px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
      display: flex !important;
      flex-direction: column !important;
      width: 300px !important;
    `;
    
    // Add label
    const label = document.createElement('label');
    label.for = 'command-input';
    label.textContent = 'Enter command (autofill, help, explain):';
    label.style.cssText = `
      margin-bottom: 5px !important;
      font-size: 12px !important;
      color: #666 !important;
    `;
    
    // Create input field
    const commandInput = document.createElement('input');
    commandInput.id = 'command-input';
    commandInput.type = 'text';
    commandInput.placeholder = 'Type command here...';
    commandInput.style.cssText = `
      padding: 8px !important;
      border: 1px solid #ccc !important;
      border-radius: 4px !important;
      margin-bottom: 5px !important;
      width: 100% !important;
    `;
    
    // Create submit button
    const submitButton = document.createElement('button');
    submitButton.textContent = 'Run Command';
    submitButton.style.cssText = `
      background-color: #4285F4 !important;
      color: white !important;
      border: none !important;
      border-radius: 4px !important;
      padding: 8px !important;
      cursor: pointer !important;
    `;
    
    // Handle command submission
    function handleCommand() {
      const command = commandInput.value.trim().toLowerCase();
      namespace.log(`Command input: ${command}`);
      
      if (command === 'autofill') {
        if (typeof window.autoFillForm === 'function') {
          window.autoFillForm();
        } else {
          chrome.runtime.sendMessage({
            action: 'autoFillForm',
            formId: window.currentFormId || document.querySelector('form')?.id || 'form_default'
          });
        }
      } else if (command === 'help') {
        alert('Available commands:\n- autofill: Fill form fields automatically\n- help: Show this help\n- explain: Get explanation of current form fields\n- toggle: Show/hide fields panel');
      } else if (command === 'explain') {
        chrome.runtime.sendMessage({
          action: 'explainField',
          fieldName: 'all',
          formId: window.currentFormId || document.querySelector('form')?.id || 'form_default'
        });
      } else if (command === 'toggle') {
        const fieldsPanel = document.getElementById('fields-panel');
        if (fieldsPanel) {
          fieldsPanel.classList.toggle('collapsed');
        }
      } else {
        // Try to interpret as a question for AI
        chrome.runtime.sendMessage({
          action: 'askQuestion',
          question: command,
          formId: window.currentFormId || document.querySelector('form')?.id || 'form_default'
        });
      }
      
      // Clear input
      commandInput.value = '';
    }
    
    // Add event listeners
    submitButton.addEventListener('click', handleCommand);
    commandInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        handleCommand();
      }
    });
    
    // Assemble the UI
    commandContainer.appendChild(label);
    commandContainer.appendChild(commandInput);
    commandContainer.appendChild(submitButton);
    
    // Add to document
    document.body.appendChild(commandContainer);
    
    return commandInput;
  };

  /**
   * Initialize button fixes
   */
  namespace.initialize = function() {
    namespace.log("Initializing button visibility fixes");
    
    // Schedule multiple attempts to fix buttons
    const scheduleButtonFix = () => {
      // Fix immediately
      namespace.fixPanelButtons();
      
      // Schedule more fixes with increasing delays to catch late-loaded elements
      setTimeout(namespace.fixPanelButtons, 500);
      setTimeout(namespace.fixPanelButtons, 1500);
      setTimeout(namespace.fixPanelButtons, 3000);
    };
    
    // Run on DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scheduleButtonFix);
    } else {
      scheduleButtonFix();
    }
    
    // Emergency button is no longer needed - we're using the side panel instead
    // setTimeout(namespace.createEmergencyButton, 2000);
    
    // Command input is no longer needed - we're using the side panel instead
    // setTimeout(namespace.addCommandInput, 2500);
    
    // Setup mutation observer to keep fixing buttons if DOM changes
    const observer = new MutationObserver(mutations => {
      let buttonAdded = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && (node.tagName === 'BUTTON' || node.querySelector('button'))) {
              buttonAdded = true;
              break;
            }
          }
        }
      });
      
      if (buttonAdded) {
        namespace.log("Buttons added to DOM, running fix again");
        namespace.fixPanelButtons();
      }
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    
    return true;
  };

})(window.ButtonVisibilityFix);

// Initialize when script loads
console.log("🟢 Button Visibility Fix loaded");
window.ButtonVisibilityFix.initialize();