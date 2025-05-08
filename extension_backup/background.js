// extension/background.js

// Initialize when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Form Helper extension installed');
});

// Handle extension icon click to open side panel
chrome.action.onClicked.addListener((tab) => {
  // Open the side panel
  chrome.sidePanel.open({ tabId: tab.id });
  
  // Trigger form detection in the content script
  chrome.tabs.sendMessage(tab.id, { action: 'scanForms' })
    .catch(error => {
      // Content script might not be loaded yet, which is fine
      console.log('Content script not ready yet:', error);
    });
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run when page is fully loaded
  if (changeInfo.status === 'complete') {
    // Trigger form detection in the content script
    chrome.tabs.sendMessage(tabId, { action: 'scanForms' })
      .catch(error => {
        // Content script might not be loaded yet, which is fine
        console.log('Content script not ready yet:', error);
      });
  }
});

// Listen for messages from content script or panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  // Handle form detection messages
  if (message.action === 'formProcessed' || message.action === 'formDetected') {
    console.log('Form processed:', message.formData);
    
    // Update the extension icon with badge to show forms detected
    if (sender.tab) {
      chrome.action.setBadgeText({
        text: '✓',
        tabId: sender.tab.id
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#4CAF50',
        tabId: sender.tab.id
      });
    }
  }
  
  // Handle openPanel action to create panel in a new tab
  if (message.action === 'openPanel') {
    console.log('Opening panel in new tab');
    chrome.tabs.create({
      url: chrome.runtime.getURL('panel.html'),
      active: true
    });
  }
  
  // Handle open side panel request
  if (message.action === 'openSidePanel') {
    if (sender.tab) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
      
      // Store the current form ID if needed
      chrome.storage.local.set({ currentFormId: message.formId });
    }
  }
  
  // Handle form scan request
  if (message.action === 'scanForm') {
    if (sender.tab) {
      chrome.tabs.sendMessage(sender.tab.id, { action: 'scanForms' });
    }
  }
  
  // Handle field explanation request
  if (message.action === 'explainField') {
    // Call your backend API to get field explanation
    fetchFieldExplanation(message.fieldName, message.formId)
      .then(explanation => {
        chrome.runtime.sendMessage({
          action: 'fieldExplained',
          fieldName: message.fieldName,
          explanation: explanation
        });
      });
  }
  
  // Handle AI question
  if (message.action === 'askQuestion') {
    // Call your backend API to get AI response
    fetchAIResponse(message.question, message.formId)
      .then(response => {
        chrome.runtime.sendMessage({
          action: 'aiResponse',
          response: response
        });
      });
  }
  
  // Handle legacy field helper request
  if (message.action === 'openAiHelper') {
    // Store the field info temporarily
    chrome.storage.local.set({
      currentField: message.field,
      currentForm: message.form
    });
    
    // Open the popup
    chrome.windows.create({
      url: 'popup.html',
      type: 'popup',
      width: 400,
      height: 500
    });
  }
  
  // Handle finding forms
  if (message.action === 'formsFound') {
    console.log(`Forms found: ${message.count}`);
  }
  
  // Error handling
  if (message.action === 'formError') {
    console.error('Form processing error:', message.error);
    if (sender.tab) {
      chrome.action.setBadgeText({
        text: '!',
        tabId: sender.tab.id
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#F44336',
        tabId: sender.tab.id
      });
    }
  }
  
  // Allow async response
  return true;
});

// Function to fetch field explanation from backend
async function fetchFieldExplanation(fieldName, formId) {
  try {
    const response = await fetch('http://localhost:8000/api/v1/explain-field', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        field_name: fieldName,
        form_id: formId || 'unknown'
      })
    });
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    const data = await response.json();
    return data.explanation || 'No explanation available for this field.';
  } catch (error) {
    console.error('Error fetching field explanation:', error);
    return 'Sorry, I couldn\'t get an explanation for this field right now.';
  }
}

// Function to fetch AI response from backend
async function fetchAIResponse(question, formId) {
  try {
    const response = await fetch('http://localhost:8000/api/v1/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: question,
        form_id: formId || 'unknown'
      })
    });
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    const data = await response.json();
    return data.response || 'I don\'t have an answer for that question.';
  } catch (error) {
    console.error('Error fetching AI response:', error);
    return 'Sorry, I couldn\'t process your question right now.';
  }
}