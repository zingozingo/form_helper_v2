/**
 * Refined Panel Script for AI Form Helper
 * Handles communication with extension APIs and form interaction
 */

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initializePanel);

/**
 * Main initialization function
 */
function initializePanel() {
  console.log('Initializing refined panel');
  
  // DOM elements
  const fieldGrid = document.getElementById('field-grid');
  const fieldCount = document.getElementById('field-count');
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
  
  // Request form data from active tab
  requestFormData();
  
  /**
   * Handle chat form submission
   */
  function setupChatForm() {
    chatForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const message = chatInput.value.trim();
      
      if (message) {
        // Add user message to UI
        addUserMessage(message);
        
        // Clear input
        chatInput.value = '';
        
        // Process message
        processUserMessage(message);
      }
    });
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
   * Request form data from content script
   */
  function requestFormData() {
    // Get current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs[0]) {
        tabId = tabs[0].id;
        
        // Try to get form data from content script
        chrome.tabs.sendMessage(tabId, { action: 'getFormData' })
          .then(response => {
            if (response && response.success && response.formData) {
              // Process form data
              currentFormData = response.formData;
              processFormData(currentFormData);
            } else {
              // No form data received
              console.log('No form data received from content script');
              useFallbackDetection();
            }
          })
          .catch(error => {
            console.error('Error getting form data:', error);
            useFallbackDetection();
          });
      } else {
        console.error('No active tab found');
        useFallbackDetection();
      }
    });
  }
  
  /**
   * Use fallback detection if message passing fails
   */
  function useFallbackDetection() {
    if (window.FieldDetector && window.FieldDetector.scanForFields) {
      try {
        // Try direct detection (works in extension panel context)
        currentFormData = window.FieldDetector.scanForFields();
        processFormData(currentFormData);
      } catch (error) {
        console.error('Error in fallback detection:', error);
        
        // Use demo data as last resort
        displayDemoFields();
      }
    } else {
      // Use demo data if detector not available
      displayDemoFields();
    }
  }
  
  /**
   * Process detected form data
   */
  function processFormData(formData) {
    if (!formData || !formData.fields || formData.fields.length === 0) {
      // No form detected
      addAiMessage("I couldn't detect any form fields on this page. Please navigate to a page with a form.");
      return;
    }
    
    // Update field count
    fieldCount.textContent = `(${formData.fields.length})`;
    
    // Display fields
    displayFields(formData.fields);
    
    // Update welcome message with form type info
    updateWelcomeMessage(formData);
  }
  
  /**
   * Update welcome message based on form data
   */
  function updateWelcomeMessage(formData) {
    const welcomeMessages = document.querySelectorAll('.ai-message');
    if (welcomeMessages.length > 0) {
      const firstMessage = welcomeMessages[0].querySelector('.message-bubble');
      
      if (firstMessage && formData.formType && formData.formPurpose) {
        // Create a friendly welcome message based on form type
        let message = `I've analyzed this form. It appears to be a ${formData.formType} form for ${formData.formPurpose}.`;
        
        // Add form-specific tips
        if (formData.formType === 'login') {
          message += " Enter your credentials to access your account.";
        } else if (formData.formType === 'registration') {
          message += " Fill out the required fields to create your account.";
        } else if (formData.formType === 'checkout') {
          message += " Complete all payment and shipping details to proceed.";
        } else if (formData.formType === 'contact') {
          message += " I can help you send a message to this organization.";
        } else if (formData.formType === 'address') {
          message += " Be sure to provide accurate shipping information.";
        } else {
          message += " How can I help you complete it?";
        }
        
        firstMessage.textContent = message;
      }
    }
  }
  
  /**
   * Display fields in the grid
   */
  function displayFields(fields) {
    // Clear existing fields
    fieldGrid.innerHTML = '';
    
    // Add each field as a pill
    fields.forEach(field => {
      const fieldPill = document.createElement('div');
      fieldPill.className = `field-pill ${field.required ? 'required' : 'optional'}`;
      fieldPill.dataset.fieldId = field.id || field.name;
      fieldPill.dataset.tooltip = field.required ? 'Required field' : 'Optional field';
      
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
        
        // Generate field description
        const requiredText = field.required ? "required" : "optional";
        const fieldDescription = getFieldDescription(field);
        
        // Send message to get field explanation from backend
        if (chrome.runtime && tabId) {
          chrome.runtime.sendMessage({
            action: 'explainField',
            fieldName: field.name || field.label,
            fieldId: field.id,
            formId: currentFormData?.formId,
            tabId: tabId
          }).catch(() => {
            // Use local description if message fails
            addAiMessage(`The ${field.label} field is ${requiredText}. ${fieldDescription}`);
          });
        } else {
          // Use local description
          addAiMessage(`The ${field.label} field is ${requiredText}. ${fieldDescription}`);
        }
      });
      
      // Add to grid
      fieldGrid.appendChild(fieldPill);
    });
  }
  
  /**
   * Display demo fields as fallback
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
    fieldCount.textContent = `(${demoFields.length})`;
    
    // Display fields
    displayFields(demoFields);
    
    // Update welcome with generic message
    updateWelcomeMessage({
      formType: 'registration',
      formPurpose: 'creating a new account'
    });
  }
  
  /**
   * Get appropriate icon for field type
   */
  function getFieldIcon(fieldType) {
    // Map field types to Material Icons
    const iconMap = {
      // Derived types
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
      
      // HTML input types
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
   * Process user message and generate response
   */
  function processUserMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    // Send message to extension backend first if available
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
          // Use fallback responses
          generateLocalResponse(lowerMessage);
        }
      }).catch(() => {
        // Use fallback responses if message fails
        generateLocalResponse(lowerMessage);
      });
    } else {
      // Use fallback responses
      generateLocalResponse(lowerMessage);
    }
  }
  
  /**
   * Generate local response based on message content
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
      const formPurpose = currentFormData?.formPurpose || 'creating a new account';
      
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