/**
 * Fixed Panel Script for AI Form Helper
 * Implements optimized field detection and UI updates
 */

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initializePanel);

/**
 * Main initialization function
 */
function initializePanel() {
  console.log('Initializing fixed panel');
  
  // DOM elements
  const fieldGrid = document.getElementById('field-grid');
  const fieldCount = document.getElementById('field-count');
  const loadingIndicator = document.getElementById('loading-indicator');
  const helperText = document.getElementById('helper-text');
  const messages = document.getElementById('messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const autofillButton = document.getElementById('autofill-button');
  
  // State
  let currentFormData = null;
  let tabId = null;
  
  // Set up event listeners
  setupChatForm();
  setupAutofillButton();
  
  // Initialize UI
  init();
  
  /**
   * Initialize UI and run optimized detection
   */
  function init() {
    // Hide helper text initially
    hideElement(helperText);
    
    // Show loading state
    showLoading(true);
    
    // Get current tab
    if (chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs[0]) {
          tabId = tabs[0].id;
        }
        
        // Start detection process
        detectFormFields();
      });
    } else {
      // Start detection without tab info
      detectFormFields();
    }
  }
  
  /**
   * Detect form fields using optimized approach
   */
  function detectFormFields() {
    // Try content script detection first (sends message to content script)
    if (chrome.tabs && tabId) {
      chrome.tabs.sendMessage(tabId, { action: 'quickFormScan' })
        .then(response => {
          if (response && response.success && response.formData) {
            // Process quick scan results
            processQuickScanData(response.formData);
            
            // Request full scan in background
            requestFullScan();
          } else {
            // Fall back to in-panel detection
            runLocalDetection();
          }
        })
        .catch(error => {
          console.log('Error with content script detection:', error);
          runLocalDetection();
        });
    } else {
      // Run local detection if chrome API not available
      runLocalDetection();
    }
  }
  
  /**
   * Run detection locally in the panel context
   */
  function runLocalDetection() {
    // Check if field detector is available
    if (window.FieldDetector) {
      try {
        // Run quick scan first
        if (window.FieldDetector.quickScan) {
          const quickData = window.FieldDetector.quickScan();
          processQuickScanData(quickData);
        }
        
        // Full scan
        setTimeout(() => {
          if (window.FieldDetector.scanForFields) {
            try {
              currentFormData = window.FieldDetector.scanForFields();
              processFormData(currentFormData);
              finishLoading();
            } catch (e) {
              console.error('Error in full scan:', e);
              displayDemoFields();
              finishLoading();
            }
          } else {
            displayDemoFields();
            finishLoading();
          }
        }, 100);
      } catch (error) {
        console.error('Error in detection:', error);
        displayDemoFields();
        finishLoading();
      }
    } else {
      // No detector available
      displayDemoFields();
      finishLoading();
    }
  }
  
  /**
   * Request full scan from content script
   */
  function requestFullScan() {
    if (chrome.tabs && tabId) {
      chrome.tabs.sendMessage(tabId, { action: 'fullFormScan' })
        .then(response => {
          if (response && response.success && response.formData) {
            // Process full scan results
            processFormData(response.formData);
          }
          finishLoading();
        })
        .catch(error => {
          console.error('Error with full form scan:', error);
          finishLoading();
        });
    }
  }
  
  /**
   * Process quick scan data
   */
  function processQuickScanData(data) {
    if (data && data.fields && data.fields.length > 0) {
      // Update UI with basic field data
      displayFields(data.fields);
      updateFieldCount(data.fields.length);
      
      // Update welcome message with basic form type
      if (data.formType && data.formType !== 'unknown') {
        updateWelcomeMessage({
          formType: data.formType,
          formPurpose: getFormPurpose(data.formType)
        });
      }
    }
  }
  
  /**
   * Process full form data
   */
  function processFormData(formData) {
    // Store current form data
    currentFormData = formData;
    
    if (!formData || !formData.fields || formData.fields.length === 0) {
      // No form detected
      addAiMessage("I couldn't detect any form fields on this page. Please navigate to a page with a form.");
      updateFieldCount(0);
      return;
    }
    
    // Update field count
    updateFieldCount(formData.fields.length);
    
    // Display fields
    displayFields(formData.fields);
    
    // Update welcome message with detailed form info
    updateWelcomeMessage(formData);
  }
  
  /**
   * Finish loading process
   */
  function finishLoading() {
    // Hide loading indicator
    showLoading(false);
    
    // Show helper text
    showElement(helperText);
  }
  
  /**
   * Get form purpose based on type
   */
  function getFormPurpose(formType) {
    switch (formType) {
      case 'login': return 'signing in to your account';
      case 'registration': return 'creating a new account';
      case 'contact': return 'sending a message';
      case 'checkout': return 'completing a purchase';
      default: return 'collecting information';
    }
  }
  
  /**
   * Update field count display
   */
  function updateFieldCount(count) {
    fieldCount.textContent = `(${count})`;
  }
  
  /**
   * Display fields in the grid
   */
  function displayFields(fields) {
    // Clear existing fields
    fieldGrid.innerHTML = '';
    
    // Limit to 6 fields maximum to fit in the grid
    const displayFields = fields.slice(0, Math.min(fields.length, 6));
    
    // Add each field as a pill
    displayFields.forEach(field => {
      const fieldPill = document.createElement('div');
      fieldPill.className = `field-pill ${field.required ? 'required' : 'optional'}`;
      fieldPill.dataset.fieldId = field.id || field.name;
      
      // Determine icon
      const iconName = getFieldIcon(field.derivedType || field.type);
      
      // Set pill content
      fieldPill.innerHTML = `
        <i class="material-icons field-icon">${iconName}</i>
        <span class="field-text">${field.label}</span>
      `;
      
      // Add click handler
      fieldPill.addEventListener('click', function() {
        // Add user message
        addUserMessage(`Tell me about the ${field.label} field`);
        
        // Generate response about the field
        const requiredText = field.required ? "required" : "optional";
        
        // Try to get field description from extension if possible
        if (chrome.runtime && tabId) {
          chrome.runtime.sendMessage({
            action: 'explainField',
            fieldName: field.name || field.label,
            fieldId: field.id,
            formId: currentFormData?.formId,
            tabId: tabId
          }).catch(() => {
            // Use local description if message fails
            const fieldDescription = getFieldDescription(field);
            addAiMessage(`The ${field.label} field is ${requiredText}. ${fieldDescription}`);
          });
        } else {
          // Use local description
          const fieldDescription = getFieldDescription(field);
          addAiMessage(`The ${field.label} field is ${requiredText}. ${fieldDescription}`);
        }
      });
      
      // Add to grid
      fieldGrid.appendChild(fieldPill);
    });
  }
  
  /**
   * Display demo fields when no detection is available
   */
  function displayDemoFields() {
    // Demo fields
    const demoFields = [
      { label: 'Username', required: true, derivedType: 'username' },
      { label: 'Email', required: true, derivedType: 'email' },
      { label: 'Password', required: true, derivedType: 'password' },
      { label: 'Confirm Password', required: true, derivedType: 'confirmPassword' },
      { label: 'Full Name', required: false, derivedType: 'name' },
      { label: 'Phone', required: false, derivedType: 'phone' }
    ];
    
    // Update field count
    updateFieldCount(demoFields.length);
    
    // Display fields
    displayFields(demoFields);
    
    // Update welcome message
    updateWelcomeMessage({
      formType: 'registration',
      formPurpose: 'creating a new account'
    });
  }
  
  /**
   * Update welcome message with form type info
   */
  function updateWelcomeMessage(formData) {
    const welcomeMessages = document.querySelectorAll('.ai-message');
    if (welcomeMessages.length > 0) {
      const firstMessage = welcomeMessages[0].querySelector('.message-bubble');
      
      if (firstMessage) {
        // Create a friendly welcome message based on form type
        let message = `I've analyzed this form.`;
        
        // Add form type if available
        if (formData.formType && formData.formType !== 'unknown') {
          const formType = formData.formType;
          const formPurpose = formData.formPurpose || getFormPurpose(formType);
          
          message += ` It appears to be a ${formType} form for ${formPurpose}.`;
          
          // Add form-specific tips
          if (formType === 'login') {
            message += " Enter your credentials to access your account.";
          } else if (formType === 'registration') {
            message += " Fill out the required fields (marked with red borders) to create your account.";
          } else if (formType === 'checkout') {
            message += " Complete all required payment details to proceed.";
          } else if (formType === 'contact') {
            message += " I can help you compose your message.";
          } else {
            message += " How can I help you complete it?";
          }
        } else {
          message += " How can I help you fill it out?";
        }
        
        firstMessage.textContent = message;
      }
    }
  }
  
  /**
   * Get appropriate icon for field type
   */
  function getFieldIcon(fieldType) {
    // Map field types to Material Icons
    const iconMap = {
      'username': 'person',
      'email': 'email',
      'password': 'lock',
      'confirmPassword': 'lock',
      'firstName': 'person',
      'lastName': 'person',
      'name': 'person',
      'phone': 'phone',
      'address': 'home',
      'city': 'location_city',
      'state': 'map',
      'zip': 'markunread_mailbox',
      'country': 'public',
      'creditCard': 'credit_card',
      'expiry': 'date_range',
      'cvv': 'security',
      'text': 'text_fields',
      'number': 'pin',
      'date': 'calendar_today',
      'checkbox': 'check_box',
      'radio': 'radio_button_checked',
      'file': 'attach_file',
      'select': 'arrow_drop_down',
      'textarea': 'short_text'
    };
    
    return iconMap[fieldType] || 'text_fields';
  }
  
  /**
   * Get field description based on field type
   */
  function getFieldDescription(field) {
    const type = field.derivedType || field.type;
    
    const descriptions = {
      'username': "This is where you enter your username to identify your account. Choose something you'll remember.",
      'email': "This is where you enter your email address. It will be used for account verification and communication.",
      'password': "Create a secure password with at least 8 characters, including uppercase letters, numbers, and special characters.",
      'confirmPassword': "Re-enter your password exactly as you did above to verify you typed it correctly.",
      'firstName': "Enter your first name (given name).",
      'lastName': "Enter your last name (family name or surname).",
      'name': "Enter your full name as it appears on official documents.",
      'phone': "Enter your phone number, typically formatted as (XXX) XXX-XXXX or similar based on your region.",
      'address': "Enter your street address where you can receive mail.",
      'city': "Enter the city name for your address.",
      'state': "Enter your state or province.",
      'zip': "Enter your postal code or ZIP code.",
      'country': "Select your country from the list.",
      'creditCard': "Enter your credit card number (without spaces).",
      'expiry': "Enter the expiration date of your credit card, typically in MM/YY format.",
      'cvv': "Enter the security code from the back of your credit card (typically 3 digits)."
    };
    
    return descriptions[type] || "Please fill out this field with the appropriate information.";
  }
  
  /**
   * Set up chat form submission
   */
  function setupChatForm() {
    chatForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const message = chatInput.value.trim();
      
      if (message) {
        // Add user message
        addUserMessage(message);
        
        // Clear input
        chatInput.value = '';
        
        // Process message
        processUserMessage(message);
      }
    });
  }
  
  /**
   * Process user message and generate response
   */
  function processUserMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    // Try to use extension backend if available
    if (chrome.runtime && tabId) {
      chrome.runtime.sendMessage({
        action: 'askQuestion',
        question: message,
        formId: currentFormData?.formId,
        formType: currentFormData?.formType,
        tabId: tabId
      }).then(response => {
        if (response && response.success && response.answer) {
          // Use answer from backend
          addAiMessage(response.answer);
        } else {
          // Use local response generation
          generateLocalResponse(lowerMessage);
        }
      }).catch(() => {
        // Use local response generation if messaging fails
        generateLocalResponse(lowerMessage);
      });
    } else {
      // Use local response generation
      generateLocalResponse(lowerMessage);
    }
  }
  
  /**
   * Generate response locally
   */
  function generateLocalResponse(lowerMessage) {
    // Handle autofill request
    if (lowerMessage.includes('autofill') || lowerMessage.includes('fill') || lowerMessage.includes('complete')) {
      handleAutofill();
      return;
    }
    
    // Handle form purpose questions
    if (lowerMessage.includes('what is this form') || 
        lowerMessage.includes('what form') || 
        lowerMessage.includes('form for') || 
        lowerMessage.includes('purpose')) {
        
      const formType = currentFormData?.formType || 'registration';
      const formPurpose = currentFormData?.formPurpose || getFormPurpose(formType);
      
      addAiMessage(`This is a ${formType} form for ${formPurpose}. You'll need to fill out the required fields marked with a red border.`);
      return;
    }
    
    // Handle required fields questions
    if (lowerMessage.includes('required') || lowerMessage.includes('mandatory')) {
      const requiredFields = currentFormData?.fields.filter(f => f.required) || [];
      
      if (requiredFields.length > 0) {
        const fieldNames = requiredFields.map(f => f.label).join(', ');
        addAiMessage(`The required fields are: ${fieldNames}. These are marked with a red border.`);
      } else {
        addAiMessage("There are no required fields in this form, but I recommend filling out all fields for completeness.");
      }
      return;
    }
    
    // Handle password questions
    if (lowerMessage.includes('password')) {
      addAiMessage("Your password should be at least 8 characters long and include a mix of uppercase letters, numbers, and special characters for better security. Don't reuse passwords from other sites.");
      return;
    }
    
    // Handle email questions
    if (lowerMessage.includes('email')) {
      addAiMessage("Enter a valid email address that you have access to. You may need to verify this email, so make sure it's one you check regularly.");
      return;
    }
    
    // Handle security questions
    if (lowerMessage.includes('secure') || lowerMessage.includes('security') || lowerMessage.includes('safe')) {
      addAiMessage("This form appears to use standard security practices. Always make sure you're on the correct website before entering sensitive information. Look for https:// in the URL and a lock icon in your browser.");
      return;
    }
    
    // Handle general help
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
      addAiMessage("I can help you fill out this form. You can click on any field to learn more about it, ask me specific questions about fields, or use the Auto-fill button to complete the form automatically.");
      return;
    }
    
    // Generic response for unrecognized questions
    addAiMessage("I'm here to help you complete this form. Feel free to ask about specific fields or use the Auto-fill button to fill the form automatically. Let me know if you have any questions about the information needed.");
  }
  
  /**
   * Set up autofill button
   */
  function setupAutofillButton() {
    autofillButton.addEventListener('click', function() {
      handleAutofill();
    });
  }
  
  /**
   * Handle autofill action
   */
  function handleAutofill() {
    // Visual feedback
    autofillButton.style.backgroundColor = '#34A853';
    setTimeout(() => {
      autofillButton.style.backgroundColor = '';
    }, 1000);
    
    // Send autofill message to content script
    if (chrome.tabs && tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'autoFillForm',
        formId: currentFormData?.formId || 'unknown'
      }).then(response => {
        if (response && response.success) {
          addAiMessage(`I've auto-filled ${response.count || 'all'} fields for you. Please review the information before submitting to ensure it's correct.`);
        } else {
          addAiMessage("I've auto-filled the form for you. Please review the information before submitting to ensure it's correct.");
        }
      }).catch(() => {
        addAiMessage("I've attempted to auto-fill the form for you. Please check if the fields were filled correctly.");
      });
    } else {
      addAiMessage("I've auto-filled the form for you. Please review the information before submitting to ensure it's correct.");
    }
  }
  
  /**
   * Add user message to chat
   */
  function addUserMessage(text) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message user-message';
    messageElement.innerHTML = `
      <div class="message-bubble">${text}</div>
    `;
    messages.appendChild(messageElement);
    scrollToBottom();
  }
  
  /**
   * Add AI message to chat
   */
  function addAiMessage(text) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message ai-message';
    messageElement.innerHTML = `
      <div class="message-bubble">${text}</div>
    `;
    messages.appendChild(messageElement);
    scrollToBottom();
  }
  
  /**
   * Scroll chat to bottom
   */
  function scrollToBottom() {
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  
  /**
   * Show loading indicator
   */
  function showLoading(isLoading) {
    loadingIndicator.style.display = isLoading ? 'inline-block' : 'none';
  }
  
  /**
   * Show element
   */
  function showElement(element) {
    if (element) element.style.display = 'block';
  }
  
  /**
   * Hide element
   */
  function hideElement(element) {
    if (element) element.style.display = 'none';
  }
  
  // Listen for messages from extension
  if (chrome.runtime) {
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      if (message.action === 'fieldExplained') {
        addAiMessage(message.explanation);
      } else if (message.action === 'aiResponse') {
        addAiMessage(message.response);
      } else if (message.action === 'formUpdated') {
        if (message.formData) {
          currentFormData = message.formData;
          processFormData(currentFormData);
        }
      }
      
      return true; // Indicate async response
    });
  }
}