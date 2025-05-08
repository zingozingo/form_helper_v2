/**
 * Minimal Panel Script for AI Form Helper
 * A clean, chat-focused UI for the form helper extension
 */

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializePanel);

// Main initialization function
function initializePanel() {
  console.log('Initializing minimal panel');
  
  // Setup DOM elements
  const fieldsContainer = document.getElementById('fields-container');
  const fieldsToggle = document.getElementById('fields-toggle');
  const fieldChips = document.getElementById('field-chips');
  const messages = document.getElementById('messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const autofillButton = document.getElementById('autofill-button');
  const clearButton = document.getElementById('clear-button');
  
  // Setup event listeners
  setupFieldsToggle();
  setupChatForm();
  setupButtons();
  setupKeyboardShortcuts();
  
  // Request form data from content script
  requestFormData();
  
  // Setup UI functionality
  function setupFieldsToggle() {
    fieldsToggle.addEventListener('click', () => {
      fieldsContainer.classList.toggle('collapsed');
    });
  }
  
  function setupChatForm() {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = chatInput.value.trim();
      
      if (message) {
        // Add user message to UI
        addUserMessage(message);
        
        // Clear input
        chatInput.value = '';
        
        // Send message to background script
        chrome.runtime.sendMessage({
          action: 'askQuestion',
          question: message,
          formId: window.currentFormId || 'unknown'
        });
      }
    });
  }
  
  function setupButtons() {
    // Autofill button
    autofillButton.addEventListener('click', () => {
      triggerAutofill();
    });
    
    // Clear button
    clearButton.addEventListener('click', () => {
      triggerClearForm();
    });
  }
  
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Alt+A for autofill
      if (e.altKey && e.key === 'a') {
        triggerAutofill();
      }
    });
  }
}

// Request form data from content script
function requestFormData() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'scanForms' })
        .then(response => {
          console.log('Form scan initiated');
        })
        .catch(error => {
          console.error('Error initiating form scan:', error);
          addAiMessage("I'm having trouble analyzing the form on this page. Please try refreshing the page.");
        });
    }
  });
  
  // Listen for messages from extension
  setupMessageListeners();
}

// Setup extension message listeners
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message.action);
    
    if (message.action === 'formDetected') {
      processFormData(message.formData);
    } else if (message.action === 'fieldExplained') {
      addAiMessage(message.explanation);
    } else if (message.action === 'aiResponse') {
      addAiMessage(message.response);
    } else if (message.action === 'noFormsFound') {
      updateFieldCount(0);
      addAiMessage("I couldn't find any forms on this page. Please navigate to a page with a form.");
    }
    
    return true; // Keep the message channel open for async responses
  });
}

// Process form data
function processFormData(formData) {
  // Store form ID for future reference
  window.currentFormId = formData.formId;
  
  // Update field count badge
  updateFieldCount(formData.fields.length);
  
  // Clear existing fields
  const fieldChips = document.getElementById('field-chips');
  fieldChips.innerHTML = '';
  
  // Add fields as chips
  formData.fields.forEach((field) => {
    addFieldChip(field);
  });
  
  // Add form context information to chat
  if (formData.formContext && formData.formContext.description) {
    addAiMessage(formData.formContext.description);
  } else {
    addAiMessage("I've analyzed the form. Click on any field to learn more about it, or ask me any questions.");
  }
}

// Add a field chip to the field chips container
function addFieldChip(field) {
  const fieldChips = document.getElementById('field-chips');
  
  // Create field chip element
  const chipElement = document.createElement('div');
  chipElement.className = `field-chip ${field.required ? 'required' : 'optional'}`;
  chipElement.dataset.fieldId = field.id || field.name;
  chipElement.dataset.tooltip = 'Click to ask about this field';
  
  // Determine icon based on field type
  const iconName = getFieldIcon(field.type, field.name);
  
  // Set chip content
  chipElement.innerHTML = `
    <i class="material-icons field-icon">${iconName}</i>
    <span>${field.label || field.name}</span>
  `;
  
  // Add click handler
  chipElement.addEventListener('click', () => {
    const fieldName = field.label || field.name;
    
    // Add user message
    addUserMessage(`Tell me about the ${fieldName} field`);
    
    // Send message to get field explanation
    chrome.runtime.sendMessage({
      action: 'explainField',
      fieldName: field.name,
      fieldId: field.id || field.name,
      formId: window.currentFormId
    });
  });
  
  // Add to field chips container
  fieldChips.appendChild(chipElement);
}

// Get appropriate icon for field type
function getFieldIcon(type, name) {
  const fieldType = type ? type.toLowerCase() : '';
  const fieldName = name ? name.toLowerCase() : '';
  
  if (fieldType === 'email' || fieldName.includes('email')) {
    return 'email';
  } else if (fieldType === 'password' || fieldName.includes('password')) {
    return 'password';
  } else if (fieldType === 'tel' || fieldName.includes('phone') || fieldName.includes('tel')) {
    return 'phone';
  } else if (fieldName.includes('name') || fieldName.includes('first') || fieldName.includes('last')) {
    return 'person';
  } else if (fieldName.includes('address') || fieldName.includes('street')) {
    return 'home';
  } else if (fieldName.includes('city') || fieldName.includes('state') || fieldName.includes('zip') || fieldName.includes('postal')) {
    return 'location_city';
  } else if (fieldType === 'date' || fieldName.includes('date') || fieldName.includes('birth')) {
    return 'calendar_today';
  } else if (fieldType === 'checkbox' || fieldType === 'radio') {
    return 'check_box';
  } else if (fieldType === 'file' || fieldName.includes('upload')) {
    return 'attach_file';
  } else {
    return 'text_fields';
  }
}

// Update field count badge
function updateFieldCount(count) {
  const countElement = document.getElementById('field-count');
  countElement.textContent = `(${count})`;
}

// Helper functions to add messages to chat
function addUserMessage(text) {
  const messages = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.className = 'message user-message';
  messageElement.innerHTML = `
    <div class="message-bubble">${text}</div>
  `;
  messages.appendChild(messageElement);
  scrollToBottom();
}

function addAiMessage(text) {
  const messages = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.className = 'message ai-message';
  messageElement.innerHTML = `
    <div class="message-bubble">${text}</div>
  `;
  messages.appendChild(messageElement);
  scrollToBottom();
}

function scrollToBottom() {
  const chatContainer = document.querySelector('.chat-container');
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Action functions
function triggerAutofill() {
  console.log('Auto-fill triggered');
  
  // Visual feedback
  const autofillButton = document.getElementById('autofill-button');
  autofillButton.style.backgroundColor = '#34A853';
  setTimeout(() => {
    autofillButton.style.backgroundColor = '';
  }, 1000);
  
  // Send autofill message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'autoFillForm',
        formId: window.currentFormId || 'unknown'
      })
        .then(response => {
          if (response && response.success) {
            addAiMessage(`I've auto-filled ${response.count || 'all'} fields for you. Please review the information before submitting.`);
          }
        })
        .catch(error => {
          console.error('Error auto-filling form:', error);
          addAiMessage("I've attempted to auto-fill the form. Please check if the fields were filled correctly.");
        });
    }
  });
}

function triggerClearForm() {
  console.log('Clear form triggered');
  
  // Send clear form message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'clearForm',
        formId: window.currentFormId || 'unknown'
      })
        .then(response => {
          if (response && response.success) {
            addAiMessage("I've cleared all form fields for you.");
          }
        })
        .catch(error => {
          console.error('Error clearing form:', error);
          addAiMessage("I've attempted to clear the form fields. Please check if they were cleared correctly.");
        });
    }
  });
}