/**
 * Simplified Panel Logic for AI Form Helper
 */

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializePanel);

// Main initialization function
function initializePanel() {
  console.log('Initializing simplified panel');
  
  // Setup UI interactions
  setupSectionToggles();
  setupProfilesAccordion();
  setupFieldSelection();
  setupChatForm();
  setupCommandInput();
  setupActionButtons();
  setupKeyboardShortcuts();
  
  // Request form data from content script
  requestFormData();
}

// Set up section toggles (collapsible sections)
function setupSectionToggles() {
  document.getElementById('fields-header').addEventListener('click', function() {
    document.querySelector('.fields-section').classList.toggle('collapsed');
  });
  
  document.getElementById('chat-header').addEventListener('click', function() {
    document.querySelector('.chat-section').classList.toggle('collapsed');
  });
}

// Set up profiles accordion
function setupProfilesAccordion() {
  document.getElementById('profiles-header').addEventListener('click', function() {
    document.getElementById('profiles-content').classList.toggle('expanded');
  });
}

// Set up field selection
function setupFieldSelection() {
  // Will be populated dynamically when fields are loaded
  document.addEventListener('click', function(e) {
    if (e.target.closest('.field-item')) {
      const fieldItem = e.target.closest('.field-item');
      document.querySelectorAll('.field-item').forEach(f => f.classList.remove('active'));
      fieldItem.classList.add('active');
      
      const fieldName = fieldItem.querySelector('strong').textContent;
      const fieldId = fieldItem.dataset.fieldId;
      
      // Send message to get field explanation
      chrome.runtime.sendMessage({
        action: 'explainField',
        fieldName: fieldName,
        fieldId: fieldId
      });
      
      // Add placeholder response while waiting for real explanation
      addAiMessage(`Let me explain this "${fieldName}" field...`);
    }
  });
}

// Set up chat form
function setupChatForm() {
  document.getElementById('chat-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
      // Add user message to UI
      addUserMessage(message);
      
      // Clear input
      input.value = '';
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'askQuestion',
        question: message,
        formId: window.currentFormId || 'unknown'
      });
    }
  });
}

// Set up command input
function setupCommandInput() {
  document.getElementById('command-button').addEventListener('click', processCommand);
  document.getElementById('command-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      processCommand();
    }
  });
}

// Process commands from the command input
function processCommand() {
  const commandInput = document.getElementById('command-input');
  const command = commandInput.value.trim().toLowerCase();
  
  if (command === 'autofill') {
    triggerAutofill();
    addAiMessage("I'll help you fill out the form automatically!");
  } else if (command === 'help') {
    addAiMessage("You can use the following commands: 'autofill' to fill the form automatically, 'clear' to reset all fields, or ask me any question about the form.");
  } else if (command === 'clear') {
    triggerClearForm();
    addAiMessage("I've cleared all form fields for you.");
  } else {
    // Treat as a chat message
    document.getElementById('chat-input').value = command;
    document.getElementById('chat-form').dispatchEvent(new Event('submit'));
  }
  
  commandInput.value = '';
}

// Set up action buttons
function setupActionButtons() {
  // Autofill button
  document.getElementById('autofill-button').addEventListener('click', function() {
    triggerAutofill();
  });
  
  // Clear button
  document.getElementById('clear-button').addEventListener('click', function() {
    triggerClearForm();
  });
  
  // Profile autofill button
  document.getElementById('autofill-profile').addEventListener('click', function() {
    const profileSelector = document.getElementById('profile-selector');
    const selectedProfile = profileSelector.value;
    
    if (selectedProfile) {
      triggerProfileAutofill(selectedProfile);
    } else {
      addAiMessage("Please select a profile first.");
    }
  });
}

// Set up keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    // Alt+A for autofill
    if (e.altKey && e.key === 'a') {
      triggerAutofill();
    }
  });
}

// Request form data from content script
function requestFormData() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'scanForms' })
        .then(response => {
          if (response && response.success) {
            console.log('Form scan initiated');
          }
        })
        .catch(error => {
          console.error('Error initiating form scan:', error);
          addAiMessage("I'm having trouble analyzing the form on this page. Please try refreshing the page.");
        });
    }
  });
  
  // Listen for form data
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'formDetected') {
      processFormData(message.formData);
    } else if (message.action === 'fieldExplained') {
      addAiMessage(message.explanation);
    } else if (message.action === 'aiResponse') {
      addAiMessage(message.response);
    } else if (message.action === 'noFormsFound') {
      // Handle no forms found
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
  const fieldsList = document.getElementById('fields-list');
  fieldsList.innerHTML = '';
  
  // Add fields to the list
  formData.fields.forEach((field, index) => {
    const fieldItem = document.createElement('div');
    fieldItem.className = 'field-item';
    fieldItem.dataset.fieldId = field.id || field.name || `field-${index}`;
    
    // Required indicator
    const requiredText = field.required ? 'Required' : 'Optional';
    
    fieldItem.innerHTML = `
      <strong>${field.label || field.name || `Field ${index + 1}`}</strong>
      <div class="field-details">${requiredText} • Type: ${field.type || 'text'}</div>
    `;
    
    fieldsList.appendChild(fieldItem);
  });
  
  // Add form context information to chat
  if (formData.formContext && formData.formContext.description) {
    addAiMessage(formData.formContext.description);
  } else {
    addAiMessage("I've analyzed the form. Click on any field to learn more about it, or ask me any questions you have.");
  }
}

// Update field count badge
function updateFieldCount(count) {
  const badge = document.getElementById('fields-count');
  badge.textContent = count;
}

// Helper functions to add messages to chat
function addUserMessage(text) {
  const messagesContainer = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user-message';
  messageDiv.innerHTML = `
    <div class="message-content">${text}</div>
    <div class="message-avatar">
      <i class="material-icons" style="font-size: 14px;">person</i>
    </div>
  `;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addAiMessage(text) {
  const messagesContainer = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ai-message';
  messageDiv.innerHTML = `
    <div class="message-avatar">
      <i class="material-icons" style="font-size: 14px;">smart_toy</i>
    </div>
    <div class="message-content">${text}</div>
  `;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Action functions
function triggerAutofill() {
  console.log('Auto-fill triggered');
  
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'autoFillForm',
        formId: window.currentFormId || 'unknown'
      })
        .then(response => {
          if (response && response.success) {
            addAiMessage(`I've auto-filled ${response.count || 'all'} fields for you! Please review the information before submitting.`);
          }
        })
        .catch(error => {
          console.error('Error auto-filling form:', error);
          addAiMessage("I had trouble auto-filling the form. Please try again.");
        });
    }
  });
}

function triggerClearForm() {
  console.log('Clear form triggered');
  
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
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
          addAiMessage("I had trouble clearing the form. Please try again.");
        });
    }
  });
}

function triggerProfileAutofill(profileName) {
  console.log('Profile auto-fill triggered:', profileName);
  
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'autoFillWithProfile',
        formId: window.currentFormId || 'unknown',
        profile: profileName
      })
        .then(response => {
          if (response && response.success) {
            addAiMessage(`I've auto-filled the form using your "${profileName}" profile! Please review the information before submitting.`);
          }
        })
        .catch(error => {
          console.error('Error auto-filling with profile:', error);
          addAiMessage("I had trouble auto-filling with your profile. Please try again.");
        });
    }
  });
}