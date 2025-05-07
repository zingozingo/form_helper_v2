// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Get UI elements
  const fieldList = document.getElementById('field-list');
  const messages = document.getElementById('messages');
  const statusText = document.getElementById('status');
  const explainButton = document.getElementById('explain-button');
  const fillButton = document.getElementById('fill-button');
  
  // Variables to track state
  let currentFields = [];
  let selectedField = null;
  
  // Initialize the extension
  checkForForms();
  
  // Set up button event listeners
  explainButton.addEventListener('click', function() {
    if (selectedField) {
      explainField(selectedField.name);
    } else {
      addMessage('Please select a field first', 'assistant');
    }
  });
  
  fillButton.addEventListener('click', function() {
    if (selectedField) {
      fillField(selectedField.name);
    } else {
      addMessage('Please select a field first', 'assistant');
    }
  });
  
  // Functions
  function checkForForms() {
    statusText.textContent = 'Scanning...';
    
    // Query the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showNoFormsMessage("Couldn't access the current tab");
        return;
      }
      
      // Send message to content script
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getFormFields'}, function(response) {
        if (chrome.runtime.lastError) {
          showNoFormsMessage("Error: " + chrome.runtime.lastError.message);
          return;
        }
        
        if (response && response.fields && response.fields.length > 0) {
          currentFields = response.fields;
          displayFields(currentFields);
          statusText.textContent = `${currentFields.length} fields found`;
        } else {
          showNoFormsMessage("No forms found on this page");
        }
      });
    });
  }
  
  function displayFields(fields) {
    fieldList.innerHTML = '';
    
    fields.forEach(field => {
      const fieldItem = document.createElement('div');
      fieldItem.className = 'field-item';
      
      const fieldName = document.createElement('div');
      fieldName.textContent = field.label || field.name;
      fieldItem.appendChild(fieldName);
      
      const fieldType = document.createElement('div');
      fieldType.className = 'field-type';
      fieldType.textContent = field.type;
      fieldItem.appendChild(fieldType);
      
      fieldItem.dataset.name = field.name;
      
      fieldItem.addEventListener('click', function() {
        // Remove selected class from all items
        document.querySelectorAll('.field-item').forEach(item => {
          item.classList.remove('selected');
        });
        
        // Add selected class to this item
        fieldItem.classList.add('selected');
        
        // Update selected field
        selectedField = field;
        
        // Show info about the selected field
        addMessage(`Field: "${field.label || field.name}"
Type: ${field.type}
${field.required ? 'Required: Yes' : ''}`, 'assistant');
      });
      
      fieldList.appendChild(fieldItem);
    });
  }
  
  function showNoFormsMessage(message) {
    fieldList.innerHTML = '';
    statusText.textContent = 'No forms';
    
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    
    const icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.textContent = '📋';
    emptyState.appendChild(icon);
    
    const text = document.createElement('div');
    text.textContent = message || 'No form fields found on this page';
    emptyState.appendChild(text);
    
    fieldList.appendChild(emptyState);
    
    addMessage('No form detected on this page. Navigate to a page with a form and try again.', 'assistant');
  }
  
  function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    
    // Handle newlines in the text
    const formattedText = text.replace(/\n/g, '<br>');
    messageElement.innerHTML = formattedText;
    
    messages.appendChild(messageElement);
    
    // Scroll to bottom
    messages.scrollTop = messages.scrollHeight;
  }
  
  function explainField(fieldName) {
    addMessage(`Getting explanation for "${fieldName}"...`, 'assistant');
    
    // Call your existing API
    fetch('http://127.0.0.1:8000/api/v1/explain-field', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        field_name: fieldName
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.explanation) {
        addMessage(data.explanation, 'assistant');
      } else {
        addMessage('No explanation available', 'assistant');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      addMessage(`Error: ${error.message}`, 'assistant');
    });
  }
  
  function fillField(fieldName) {
    // Send message to content script to fill the field
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'fillField',
        fieldName: fieldName
      }, function(response) {
        if (response && response.success) {
          addMessage(`✅ Field "${fieldName}" has been filled with a sample value`, 'assistant');
        } else {
          addMessage('❌ Could not fill that field. The field may not be accessible.', 'assistant');
        }
      });
    });
  }
});