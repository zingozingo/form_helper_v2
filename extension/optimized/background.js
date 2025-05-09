/**
 * Optimized Form Helper Background Script
 *
 * Handles background tasks for the Form Helper extension:
 * - Installation and setup
 * - Tab and action event handling
 * - Communication between content scripts and panel
 * - Badge updates and notifications
 * 
 * Uses the event bus for better message handling and reduces duplication.
 */

const FormHelperBackground = (function() {
  /**
   * Initialize the background script
   */
  function initialize() {
    UTILS.logInfo('AI Form Helper extension initialized');
    setupEventListeners();
  }

  /**
   * Set up all event listeners
   */
  function setupEventListeners() {
    // Install event
    chrome.runtime.onInstalled.addListener(handleInstalled);
    
    // Extension icon click
    chrome.action.onClicked.addListener(handleIconClick);
    
    // Tab updates
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    
    // Message listener
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Register with the event bus
    registerEventHandlers();
  }

  /**
   * Register for event bus events
   */
  function registerEventHandlers() {
    // Form events
    EventBus.subscribe(EventBus.EVENTS.FORM_DETECTED, updateBadgeSuccess);
    EventBus.subscribe(EventBus.EVENTS.FORM_ERROR, updateBadgeError);
    
    // Server events
    EventBus.subscribe(EventBus.EVENTS.SERVER_STATUS_CHANGED, handleServerStatusChanged);
  }

  /**
   * Handle extension installation
   * @param {Object} details - Installation details
   */
  function handleInstalled(details) {
    UTILS.logInfo('AI Form Helper extension installed', details);
    
    // Could set up initial configuration here
    // chrome.storage.sync.set({...});
  }

  /**
   * Handle extension icon click
   * @param {Object} tab - Current tab
   */
  function handleIconClick(tab) {
    // Open the side panel
    chrome.sidePanel.open({ tabId: tab.id });
    
    // Trigger form detection in the content script
    sendScanMessage(tab.id);
  }

  /**
   * Handle tab updates
   * @param {number} tabId - Tab ID
   * @param {Object} changeInfo - Change info
   * @param {Object} tab - Tab object
   */
  function handleTabUpdated(tabId, changeInfo, tab) {
    // Only run when page is fully loaded
    if (changeInfo.status === 'complete') {
      // Trigger form detection in the content script
      sendScanMessage(tabId);
    }
  }

  /**
   * Send scan message to content script
   * @param {number} tabId - Tab ID
   */
  function sendScanMessage(tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'scanForms' })
      .catch(error => {
        // Content script might not be loaded yet, which is fine
        UTILS.logDebug('Content script not ready yet:', error);
      });
  }

  /**
   * Handle messages from content script or panel
   * @param {Object} message - Message object
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response function
   * @return {boolean} Keep message channel open
   */
  function handleMessage(message, sender, sendResponse) {
    UTILS.logDebug('Background script received message:', message);
    
    // Handle form detection messages
    if (message.action === 'formProcessed' || message.action === 'formDetected') {
      EventBus.publish(EventBus.EVENTS.FORM_DETECTED, {
        formData: message.formData,
        tabId: sender.tab?.id
      });
      
      sendResponse({success: true});
    }
    
    // Handle form error
    else if (message.action === 'formError') {
      EventBus.publish(EventBus.EVENTS.FORM_ERROR, {
        error: message.error,
        tabId: sender.tab?.id
      });
      
      sendResponse({success: true});
    }
    
    // Handle open side panel request
    else if (message.action === 'openSidePanel') {
      if (sender.tab) {
        chrome.sidePanel.open({ tabId: sender.tab.id });
        
        // Store the current form ID if needed
        chrome.storage.local.set({ currentFormId: message.formId });
        
        sendResponse({success: true});
      }
    }
    
    // Handle form scan request
    else if (message.action === 'scanForm') {
      if (sender.tab) {
        sendScanMessage(sender.tab.id);
        sendResponse({success: true});
      }
    }
    
    // Handle field explanation request
    else if (message.action === 'explainField') {
      fetchFieldExplanation(message.fieldName, message.formId)
        .then(explanation => {
          chrome.runtime.sendMessage({
            action: 'fieldExplained',
            fieldName: message.fieldName,
            explanation: explanation
          });
          
          sendResponse({success: true});
        });
      
      return true;  // Keep message channel open for async
    }
    
    // Handle AI question
    else if (message.action === 'askQuestion') {
      fetchAIResponse(message.question, message.formId)
        .then(response => {
          chrome.runtime.sendMessage({
            action: 'aiResponse',
            response: response
          });
          
          sendResponse({success: true});
        });
      
      return true;  // Keep message channel open for async
    }
    
    // Handle legacy field helper request
    else if (message.action === 'openAiHelper') {
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
      
      sendResponse({success: true});
    }
    
    // Handle finding forms
    else if (message.action === 'formsFound') {
      UTILS.logInfo(`Forms found: ${message.count}`);
      sendResponse({success: true});
    }
    
    // Unknown action
    else {
      sendResponse({success: false, error: 'Unknown action'});
    }
    
    // Allow async response
    return true;
  }

  /**
   * Update badge for successful form detection
   * @param {Object} data - Form detection data
   */
  function updateBadgeSuccess(data) {
    if (data.tabId) {
      chrome.action.setBadgeText({
        text: '✓',
        tabId: data.tabId
      });
      
      chrome.action.setBadgeBackgroundColor({
        color: '#4CAF50',
        tabId: data.tabId
      });
    }
  }

  /**
   * Update badge for form error
   * @param {Object} data - Error data
   */
  function updateBadgeError(data) {
    if (data.tabId) {
      chrome.action.setBadgeText({
        text: '!',
        tabId: data.tabId
      });
      
      chrome.action.setBadgeBackgroundColor({
        color: '#F44336',
        tabId: data.tabId
      });
    }
  }

  /**
   * Handle server status change
   * @param {Object} status - Server status
   */
  function handleServerStatusChanged(status) {
    UTILS.logInfo('Server status changed:', status);
    // Background script doesn't need to do anything with this yet,
    // but could update storage or UI in the future
  }

  /**
   * Fetch field explanation from backend
   * @param {string} fieldName - Field name
   * @param {string} formId - Form ID
   * @return {Promise<string>} Field explanation
   */
  async function fetchFieldExplanation(fieldName, formId) {
    try {
      const response = await UTILS.fetchWithTimeout(
        `${CONFIG.API.BASE_URL}/api/v1/explain-field`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            field_name: fieldName,
            form_id: formId || 'unknown'
          })
        }
      );
      
      if (!response.ok) {
        throw new Error('API request failed');
      }
      
      const data = await response.json();
      return data.explanation || 'No explanation available for this field.';
    } catch (error) {
      UTILS.logError('Error fetching field explanation:', error);
      return 'Sorry, I couldn\'t get an explanation for this field right now.';
    }
  }

  /**
   * Fetch AI response from backend
   * @param {string} question - User question
   * @param {string} formId - Form ID
   * @return {Promise<string>} AI response
   */
  async function fetchAIResponse(question, formId) {
    try {
      const response = await UTILS.fetchWithTimeout(
        `${CONFIG.API.BASE_URL}/api/v1/ask`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            question: question,
            form_id: formId || 'unknown'
          })
        }
      );
      
      if (!response.ok) {
        throw new Error('API request failed');
      }
      
      const data = await response.json();
      return data.response || 'I don\'t have an answer for that question.';
    } catch (error) {
      UTILS.logError('Error fetching AI response:', error);
      return 'Sorry, I couldn\'t process your question right now.';
    }
  }

  // Initialize module
  initialize();

  // Return public API
  return {
    // Expose methods for testing and extension
    sendScanMessage,
    updateBadgeSuccess,
    updateBadgeError
  };
})();

// Make available globally
window.FormHelperBackground = FormHelperBackground;