/**
 * Optimized Form Helper Panel JavaScript
 * 
 * Handles the form helper panel UI and functionality, including:
 * - Field display as horizontal tiles
 * - Chat interaction with AI
 * - Auto-fill functionality
 * - Server connection status
 * - PDF form processing
 * 
 * Uses module pattern for better organization and leverages
 * shared utility modules for improved performance.
 */

const FormHelperPanel = (function() {
  // Private module variables
  let currentFormId = null;
  let detectedFields = [];
  let currentFieldContext = null;
  let serverConnected = false;
  let isProcessingPdf = false;
  let userProfile = null;
  
  // DOM Element cache for improved performance
  const dom = {
    statusMessage: null,
    fieldsContainer: null,
    fieldsList: null,
    fieldCount: null,
    chatContainer: null,
    chatForm: null,
    chatInput: null,
    statusDot: null,
    statusText: null,
    uploadContainer: null,
    loaderContainer: null,
    autofillButton: null,
    uploadButton: null,
    pdfUpload: null
  };
  
  /**
   * Initialize the panel and all its components
   */
  async function initialize() {
    // Initialize DOM cache
    cacheDomElements();
    
    // Set initial status
    updateStatus('Scanning for forms...');
    
    // Check server connection
    serverConnected = await checkServerConnection();
    
    // Get or create user profile
    try {
      userProfile = await getOrCreateProfile();
      UTILS.logInfo('User profile loaded:', userProfile);
      
      if (userProfile && userProfile.display_name && dom.statusText) {
        const connectionStatus = serverConnected ? 'Server Connected' : 'Server Disconnected';
        dom.statusText.textContent = `${connectionStatus} | Profile: ${userProfile.display_name}`;
      }
    } catch (error) {
      UTILS.logError('Error loading profile:', error);
      userProfile = createDefaultProfile();
    }
    
    // Set up mutation observer for dynamically added elements
    setupMutationObserver();
    
    // Set up event listeners
    setupEventListeners();
    
    // Register with event bus
    registerEventHandlers();
    
    // Request form scan
    requestFormScan();
    
    // Publish initialization event
    EventBus.publish(EventBus.EVENTS.PANEL_INITIALIZED, {
      serverConnected,
      userProfile: userProfile ? userProfile.user_id : null
    });
  }
  
  /**
   * Cache DOM elements for improved performance
   */
  function cacheDomElements() {
    dom.statusMessage = document.getElementById('status-message');
    dom.fieldsContainer = document.getElementById('fields-container');
    dom.fieldsList = document.getElementById('fields-list');
    dom.fieldCount = document.getElementById('field-count');
    dom.chatContainer = document.getElementById('chat-container');
    dom.chatForm = document.getElementById('chat-form');
    dom.chatInput = document.getElementById('chat-input');
    dom.statusDot = document.getElementById('status-dot');
    dom.statusText = document.getElementById('status-text');
    dom.uploadContainer = document.getElementById('upload-container');
    dom.loaderContainer = document.getElementById('loader-container');
    dom.autofillButton = document.getElementById('autofill-button');
    dom.uploadButton = document.getElementById('upload-button');
    dom.pdfUpload = document.getElementById('pdf-upload');
  }
  
  /**
   * Set up all event listeners
   */
  function setupEventListeners() {
    // Chat form submission
    if (dom.chatForm) {
      dom.chatForm.removeEventListener('submit', handleChatSubmit);
      dom.chatForm.addEventListener('submit', handleChatSubmit);
    }
    
    // Auto-fill button
    if (dom.autofillButton) {
      dom.autofillButton.removeEventListener('click', autoFillAllFields);
      dom.autofillButton.addEventListener('click', autoFillAllFields);
      dom.autofillButton.setAttribute('data-listener', 'true');
    }
    
    // PDF upload button
    if (dom.uploadButton) {
      dom.uploadButton.removeEventListener('click', triggerPdfUpload);
      dom.uploadButton.addEventListener('click', triggerPdfUpload);
    }
    
    // PDF file input
    if (dom.pdfUpload) {
      dom.pdfUpload.removeEventListener('change', handlePdfUpload);
      dom.pdfUpload.addEventListener('change', handlePdfUpload);
    }
    
    // Chrome message listener
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.removeListener(handleChromeMessage);
      chrome.runtime.onMessage.addListener(handleChromeMessage);
    }
  }
  
  /**
   * Register event bus handlers
   */
  function registerEventHandlers() {
    // Form events
    EventBus.subscribe(EventBus.EVENTS.FORM_DETECTED, handleFormDetected);
    EventBus.subscribe(EventBus.EVENTS.FORM_ERROR, handleFormError);
    
    // Field events
    EventBus.subscribe(EventBus.EVENTS.FIELD_SELECTED, selectField);
    EventBus.subscribe(EventBus.EVENTS.FIELD_AUTOFILLED, handleAutoFillResult);
    
    // Server events
    EventBus.subscribe(EventBus.EVENTS.SERVER_STATUS_CHANGED, updateServerStatus);
    
    // Profile events
    EventBus.subscribe(EventBus.EVENTS.PROFILE_UPDATED, updateProfile);
    
    // AI events
    EventBus.subscribe(EventBus.EVENTS.AI_RESPONSE_RECEIVED, handleAiResponse);
    EventBus.subscribe(EventBus.EVENTS.AI_ERROR, handleAiError);
    
    // PDF events
    EventBus.subscribe(EventBus.EVENTS.PDF_PROCESSING_COMPLETE, handlePdfProcessed);
    EventBus.subscribe(EventBus.EVENTS.PDF_PROCESSING_ERROR, handlePdfError);
  }
  
  /**
   * Set up mutation observer to handle dynamically added elements
   */
  function setupMutationObserver() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          // Check if any autofill-button was added
          const addedButtons = document.querySelectorAll('#autofill-button:not([data-listener])');
          if (addedButtons.length > 0) {
            addedButtons.forEach(button => {
              button.addEventListener('click', autoFillAllFields);
              button.setAttribute('data-listener', 'true');
              UTILS.logDebug('Added click handler to dynamically added Auto-fill button');
            });
          }
        }
      });
    });
    
    // Start observing the document
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * Update status message
   * @param {string} message - Status message to display
   */
  function updateStatus(message) {
    if (dom.statusMessage) {
      dom.statusMessage.textContent = message;
      dom.statusMessage.style.display = 'block';
    } else {
      UTILS.logInfo('Status:', message);
    }
  }
  
  /**
   * Update server connection status
   * @param {Object} status - Server status object
   */
  function updateServerStatus(status) {
    serverConnected = status.connected;
    
    if (dom.statusDot && dom.statusText) {
      if (serverConnected) {
        dom.statusDot.classList.remove('disconnected');
        dom.statusDot.classList.add('connected');
        dom.statusText.textContent = 'Server Connected';
      } else {
        dom.statusDot.classList.remove('connected');
        dom.statusDot.classList.add('disconnected');
        dom.statusText.textContent = 'Server Disconnected';
      }
      
      // Add profile info if available
      if (userProfile && userProfile.display_name) {
        dom.statusText.textContent += ` | Profile: ${userProfile.display_name}`;
      }
    }
  }
  
  /**
   * Check server connection with improved error handling
   * @return {Promise<boolean>} True if server is connected
   */
  async function checkServerConnection() {
    try {
      // Function to safely fetch with timeout
      const safeFetch = async (endpoint) => {
        const url = `${CONFIG.API.BASE_URL}${endpoint}`;
        return await UTILS.fetchWithTimeout(url, { method: 'GET' });
      };
      
      // Check forms API & AI API
      const formsResponse = await safeFetch(CONFIG.API.ENDPOINTS.FORMS_DEBUG);
      const aiResponse = await safeFetch(CONFIG.API.ENDPOINTS.AI_DEBUG);
      
      // Both need to be available
      const isConnected = formsResponse.ok && aiResponse.ok;
      
      // Update UI and publish event
      EventBus.publish(EventBus.EVENTS.SERVER_STATUS_CHANGED, {
        connected: isConnected
      });
      
      return isConnected;
    } catch (error) {
      UTILS.logError('Error checking server connection:', error.message);
      
      // Update UI for disconnected state
      EventBus.publish(EventBus.EVENTS.SERVER_STATUS_CHANGED, {
        connected: false,
        error: error.message
      });
      
      return false;
    }
  }
  
  /**
   * Request form scan from content script
   */
  function requestFormScan() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        updateStatus('No active tab found');
        showUploadContainer();
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, {action: 'scanForms'}, function(response) {
        if (chrome.runtime.lastError) {
          UTILS.logError('Error sending message:', chrome.runtime.lastError);
          updateStatus('Could not communicate with the page. Try uploading a PDF instead.');
          showUploadContainer();
          return;
        }
      });
    });
  }
  
  /**
   * Handle chrome message events
   * @param {Object} message - Message object
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Function to send response
   * @return {boolean} True to keep message channel open
   */
  function handleChromeMessage(message, sender, sendResponse) {
    UTILS.logDebug('Received message:', message);
    
    if (message.action === 'formDetected') {
      EventBus.publish(EventBus.EVENTS.FORM_DETECTED, message.formData);
      sendResponse({success: true});
    } else if (message.action === 'noFormsFound') {
      updateStatus('No forms found on this page.');
      showUploadContainer();
      addChatMessage('ai', 'I didn\'t find any forms on this page. You can upload a PDF form if you have one, or navigate to a page with a form.');
      sendResponse({success: true});
    } else if (message.action === 'autoFillResult') {
      EventBus.publish(EventBus.EVENTS.FIELD_AUTOFILLED, message.result);
      sendResponse({success: true});
    } else if (message.action === 'saveFieldValue') {
      saveFieldToProfile(message.fieldName, message.fieldValue);
      sendResponse({success: true});
    } else if (message.action === 'formError') {
      EventBus.publish(EventBus.EVENTS.FORM_ERROR, {
        error: message.error
      });
      sendResponse({success: true});
    }
    
    return true;
  }
  
  /**
   * Handle form detection event
   * @param {Object} formData - Detected form data
   */
  function handleFormDetected(formData) {
    UTILS.logInfo('Form detected:', formData);
    
    // Store form data
    currentFormId = formData.formId;
    
    // Store in both ways to ensure availability
    window.formData = formData;
    
    // Store fields
    if (formData.fields && Array.isArray(formData.fields)) {
      detectedFields = formData.fields;
    } else {
      detectedFields = [];
    }
    
    // Store form context separately
    if (formData.formContext) {
      UTILS.logDebug("Storing form context:", formData.formContext);
      detectedFields.formContext = formData.formContext;
    }
    
    // Hide loader and upload container
    hideLoader();
    if (dom.uploadContainer) dom.uploadContainer.style.display = 'none';
    
    // Update UI
    updateStatus(`Found ${formData.fields.length} field${formData.fields.length === 1 ? '' : 's'}`);
    if (dom.fieldCount) dom.fieldCount.textContent = `(${formData.fields.length})`;
    displayFieldsAsTiles(formData.fields);
    
    // Add welcome message if this is first detection
    if (dom.chatContainer.childElementCount === 0) {
      // More descriptive welcome message if form type is known
      if (formData.formContext && formData.formContext.form_type && 
          formData.formContext.form_type !== "unknown form") {
        const formType = formData.formContext.form_type.replace(" form", "").trim();
        addChatMessage('ai', `I found a ${formType} form with ${formData.fields.length} field${formData.fields.length === 1 ? '' : 's'}. This form is for ${formData.formContext.form_purpose || 'collecting information'}. Click on any field tile to learn more about it, or ask me a question.`);
      } else {
        addChatMessage('ai', `I found a form with ${formData.fields.length} field${formData.fields.length === 1 ? '' : 's'}. Click on any field tile to learn more about it, or ask me a question.`);
      }
    } else if (isProcessingPdf) {
      // We've already added a message in PDF processing
      isProcessingPdf = false;
    }
  }
  
  /**
   * Handle form error event
   * @param {Object} error - Error object
   */
  function handleFormError(errorData) {
    UTILS.logError('Form error:', errorData.error);
    updateStatus('Error processing form. Please try again.');
    showUploadContainer();
    addChatMessage('ai', `I encountered an error while processing the form: ${errorData.error}`);
  }
  
  /**
   * Display fields as horizontal tiles
   * @param {Array} fields - Array of form fields
   */
  function displayFieldsAsTiles(fields) {
    if (!dom.fieldsContainer || !dom.fieldsList) return;
    
    // Show fields container
    dom.fieldsContainer.style.display = 'block';
    
    // Create a document fragment for efficient DOM operations
    const fragment = document.createDocumentFragment();
    
    // Handle no fields case
    if (!fields || fields.length === 0) {
      const noFieldsMessage = UTILS.createElement('div', {className: 'no-fields-message'}, 'No fields found');
      fragment.appendChild(noFieldsMessage);
      
      // Clear and update the fields list
      dom.fieldsList.innerHTML = '';
      dom.fieldsList.appendChild(fragment);
      return;
    }
    
    // Create field tiles
    fields.forEach(field => {
      // Get field icon
      const fieldType = field.type || 'text';
      const icon = CONFIG.FIELD_ICONS[fieldType] || CONFIG.FIELD_ICONS.default;
      
      // Create field tile using utility function
      const fieldTile = UTILS.createElement('div', {
        className: 'field-item',
        role: 'button',
        'aria-label': `${field.label || field.name || 'Unnamed Field'} - ${field.type || 'text'}`
      });
      
      // Create icon element
      const iconDiv = UTILS.createElement('div', {className: 'field-icon'}, icon);
      
      // Create details container
      const detailsDiv = UTILS.createElement('div', {className: 'field-details'});
      
      // Create label element with tooltip
      const labelDiv = UTILS.createElement('div', {
        className: 'field-label',
        title: field.label || field.name || 'Unnamed Field'
      }, field.label || field.name || 'Unnamed Field');
      
      // Create type element with tooltip
      const typeDiv = UTILS.createElement('div', {
        className: 'field-type',
        title: field.type || 'text'
      }, field.type || 'text');
      
      // Add elements to details div
      detailsDiv.appendChild(labelDiv);
      detailsDiv.appendChild(typeDiv);
      
      // Add required badge if needed
      if (field.required) {
        const requiredBadge = UTILS.createElement('span', {className: 'required-badge'}, 'Required');
        detailsDiv.appendChild(requiredBadge);
      }
      
      // Assemble the tile
      fieldTile.appendChild(iconDiv);
      fieldTile.appendChild(detailsDiv);
      
      // Add click handler for field selection
      fieldTile.addEventListener('click', function() {
        // Handle field selection through event bus
        EventBus.publish(EventBus.EVENTS.FIELD_SELECTED, {
          field,
          element: fieldTile
        });
      });
      
      // Add to document fragment
      fragment.appendChild(fieldTile);
    });
    
    // Clear and update the fields list
    dom.fieldsList.innerHTML = '';
    dom.fieldsList.appendChild(fragment);
  }
  
  /**
   * Handle field selection
   * @param {Object} data - Field selection data
   */
  function selectField(data) {
    const { field, element } = data;
    
    // Remove selected class from all tiles
    document.querySelectorAll('.field-item').forEach(el => {
      el.classList.remove('selected');
    });
    
    // Add selected class to clicked tile
    element.classList.add('selected');
    
    // Set current field context
    currentFieldContext = field;
    
    // Highlight field on page (not for PDFs)
    if (!isProcessingPdf) {
      highlightField(field.name || field.id || field.element);
    }
    
    // Add message to chat
    const fieldName = field.label || field.name || 'this field';
    addChatMessage('user', `What is ${fieldName} for?`);
    
    // Show thinking indicator
    const thinkingId = 'thinking-' + Date.now();
    addChatMessage('ai', 'Analyzing field...', thinkingId);
    
    // Get field explanation
    getFieldExplanation(field).then(explanation => {
      // Remove thinking message
      const thinkingEl = document.getElementById(thinkingId);
      if (thinkingEl) thinkingEl.remove();
      
      // Add AI response
      addChatMessage('ai', explanation);
    });
  }
  
  /**
   * Highlight field on page
   * @param {string} fieldSelector - Field selector
   */
  function highlightField(fieldSelector) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'highlightField',
        fieldName: fieldSelector
      });
    });
  }
  
  /**
   * Auto-fill all fields
   */
  function autoFillAllFields() {
    if (!currentFormId) return;
    
    // Check if we have a profile with field values
    const hasProfileData = userProfile && 
                          userProfile.field_values && 
                          Object.keys(userProfile.field_values).length > 0;
    
    // Log profile data for autofill
    if (hasProfileData) {
      UTILS.logDebug('Using profile for autofill:', userProfile.field_values);
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'autoFillForm',
        formId: currentFormId,
        profileData: hasProfileData ? userProfile.field_values : null
      }, function(response) {
        if (response && response.success) {
          const messageText = hasProfileData ? 
            `I've filled ${response.count} field${response.count === 1 ? '' : 's'} with your saved data where available, and sample data for the rest.` :
            `I've filled ${response.count} field${response.count === 1 ? '' : 's'} with sample data.`;
          
          addChatMessage('ai', messageText);
        }
      });
    });
  }
  
  /**
   * Handle auto-fill result
   * @param {Object} result - Auto-fill result
   */
  function handleAutoFillResult(result) {
    if (result && result.success) {
      const hasProfileData = userProfile && 
                            userProfile.field_values && 
                            Object.keys(userProfile.field_values).length > 0;
                            
      const messageText = hasProfileData ? 
        `I've filled ${result.count} field${result.count === 1 ? '' : 's'} with your saved data where available, and sample data for the rest.` :
        `I've filled ${result.count} field${result.count === 1 ? '' : 's'} with sample data.`;
          
      addChatMessage('ai', messageText);
    } else {
      addChatMessage('ai', 'There was an issue auto-filling the form. Please try again or fill the form manually.');
    }
  }
  
  /**
   * Get or create user profile
   * @return {Promise<Object>} User profile
   */
  async function getOrCreateProfile() {
    return new Promise((resolve) => {
      // Try to get browser ID from localStorage first
      let userId = localStorage.getItem('formHelperUserId');
      if (!userId) {
        userId = 'user_' + Date.now();
        localStorage.setItem('formHelperUserId', userId);
      }
      
      // Try to get profile from Chrome storage
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['userProfile'], function(result) {
          if (result.userProfile && result.userProfile.user_id === userId) {
            UTILS.logInfo('Profile loaded from Chrome storage:', result.userProfile);
            resolve(result.userProfile);
          } else {
            // Create new profile
            const newProfile = createDefaultProfile(userId);
            
            // Save to Chrome storage
            chrome.storage.sync.set({ userProfile: newProfile }, function() {
              UTILS.logInfo('Created new profile in Chrome storage:', newProfile);
              resolve(newProfile);
            });
          }
        });
      } else {
        // If no Chrome storage, create a basic profile
        resolve(createDefaultProfile(userId));
      }
    });
  }
  
  /**
   * Create default user profile
   * @param {string} userId - Optional user ID
   * @return {Object} Default profile
   */
  function createDefaultProfile(userId = null) {
    return {
      user_id: userId || 'default_user_' + Date.now(),
      display_name: 'User',
      field_values: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
  
  /**
   * Save field value to profile
   * @param {string} fieldName - Field name
   * @param {string} fieldValue - Field value
   */
  async function saveFieldToProfile(fieldName, fieldValue) {
    if (!userProfile || !userProfile.user_id) {
      UTILS.logError('Cannot save field: profile not loaded');
      return;
    }
    
    try {
      // Update field value in memory
      if (!userProfile.field_values) {
        userProfile.field_values = {};
      }
      
      userProfile.field_values[fieldName] = fieldValue;
      userProfile.updated_at = new Date().toISOString();
      
      // Save to Chrome storage
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ userProfile: userProfile }, function() {
          UTILS.logDebug(`Saved ${fieldName} to profile`);
          
          // Publish profile update event
          EventBus.publish(EventBus.EVENTS.PROFILE_UPDATED, {
            profile: userProfile
          });
        });
      }
    } catch (error) {
      UTILS.logError('Error saving field to profile:', error);
    }
  }
  
  /**
   * Update profile with new data
   * @param {Object} data - Profile update data
   */
  function updateProfile(data) {
    if (data && data.profile) {
      userProfile = data.profile;
      
      // Update status text if needed
      if (dom.statusText && userProfile.display_name) {
        const connectionStatus = serverConnected ? 'Server Connected' : 'Server Disconnected';
        dom.statusText.textContent = `${connectionStatus} | Profile: ${userProfile.display_name}`;
      }
    }
  }
  
  /**
   * Handle chat form submission
   * @param {Event} e - Submit event
   */
  function handleChatSubmit(e) {
    e.preventDefault();
    
    const userMessage = dom.chatInput.value.trim();
    if (!userMessage) return;
    
    // Add user message to chat
    addChatMessage('user', userMessage);
    
    // Clear input
    dom.chatInput.value = '';
    
    // Show thinking indicator
    const thinkingId = 'thinking-' + Date.now();
    addChatMessage('ai', 'Thinking...', thinkingId);
    
    // Get AI response
    getAIResponse(userMessage).then(response => {
      // Remove thinking message
      const thinkingEl = document.getElementById(thinkingId);
      if (thinkingEl) thinkingEl.remove();
      
      // Add AI response
      addChatMessage('ai', response);
      
      // Publish event
      EventBus.publish(EventBus.EVENTS.AI_RESPONSE_RECEIVED, {
        question: userMessage,
        response: response
      });
    }).catch(error => {
      // Remove thinking message
      const thinkingEl = document.getElementById(thinkingId);
      if (thinkingEl) thinkingEl.remove();
      
      // Add error message
      addChatMessage('ai', "I'm sorry, I couldn't generate a response. Please try asking another question.");
      
      // Publish error event
      EventBus.publish(EventBus.EVENTS.AI_ERROR, {
        question: userMessage,
        error: error.message
      });
    });
  }
  
  /**
   * Handle AI response event
   * @param {Object} data - AI response data
   */
  function handleAiResponse(data) {
    // This is handled directly in handleChatSubmit, but here for completeness
    UTILS.logDebug('AI response received:', data);
  }
  
  /**
   * Handle AI error event
   * @param {Object} data - AI error data
   */
  function handleAiError(data) {
    // This is handled directly in handleChatSubmit, but here for completeness
    UTILS.logError('AI error:', data.error);
  }
  
  /**
   * Get AI response to question
   * @param {string} question - User question
   * @return {Promise<string>} AI response
   */
  async function getAIResponse(question) {
    // Try server first if connected
    if (serverConnected) {
      try {
        // Prepare enhanced payload with more context
        const payload = {
          question: question,
          field_context: currentFieldContext,
          form_context: {
            form_type: "html_form",
            fields: detectedFields
          }
        };
        
        // Call AI endpoint
        const response = await fetch(`${CONFIG.API.BASE_URL}${CONFIG.API.ENDPOINTS.ASK}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          const data = await response.json();
          UTILS.logDebug('AI response from server:', data);
          return data.response || data.answer;
        } else {
          UTILS.logWarning('Server response not OK:', response.status);
          // Fall back to local processing
        }
      } catch (error) {
        UTILS.logError('Error getting AI response from server:', error);
        // Fall back to local processing
      }
    }
    
    // Fallback to local processing
    UTILS.logInfo('Using fallback AI response');
    return getFallbackAIResponse(question);
  }
  
  /**
   * Get explanation for a specific field
   * @param {Object} field - Field object
   * @return {Promise<string>} Field explanation
   */
  async function getFieldExplanation(field) {
    // Try server first if connected
    if (serverConnected) {
      try {
        // Prepare enhanced payload with more context
        const payload = {
          question: `What is ${field.label || field.name || 'this field'} for?`,
          field_context: field,
          form_context: {
            form_type: "html_form",
            fields: detectedFields
          }
        };
        
        // Call AI endpoint
        const response = await fetch(`${CONFIG.API.BASE_URL}${CONFIG.API.ENDPOINTS.ASK}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          const data = await response.json();
          UTILS.logDebug('Field explanation from server:', data);
          return data.response || data.answer;
        } else {
          UTILS.logWarning('Server response not OK:', response.status);
          // Fall back to local processing
        }
      } catch (error) {
        UTILS.logError('Error getting field explanation from server:', error);
        // Fall back to local processing
      }
    }
    
    // Generate a simple fallback explanation
    const fieldType = field.type || 'text';
    const fieldName = field.label || field.name || 'this field';
    
    return `This ${fieldType} field labeled "${fieldName}" is used to collect information for the form. ${field.required ? 'This field is required.' : 'This field is optional.'}`;
  }
  
  /**
   * Get fallback AI response using local context
   * @param {string} question - User question
   * @return {Promise<string>} Response
   */
  async function getFallbackAIResponse(question) {
    // Simplified fallback response
    const questionLower = question.toLowerCase();
    
    // Check if it's about form context
    if ((questionLower.includes('what') || questionLower.includes('which')) && 
        (questionLower.includes('form') || questionLower.includes('page'))) {
      
      // Get basic form info from context
      const formContext = detectedFields.formContext || {
        form_type: "form",
        form_purpose: "collecting information"
      };
      
      const formType = formContext.form_type?.replace(" form", "").trim() || "unknown";
      return `This appears to be a ${formType} form for ${formContext.form_purpose || 'collecting information'}. It contains ${detectedFields.length} fields that you can fill out.`;
    }
    
    // Check if about specific field
    if (currentFieldContext) {
      const fieldName = currentFieldContext.label || currentFieldContext.name || 'this field';
      
      if (questionLower.includes(fieldName.toLowerCase()) || 
          questionLower.includes('this field') || 
          questionLower.includes('field')) {
        
        return `The ${fieldName} field is where you enter your ${fieldName.toLowerCase()}. This helps identify you and process your information correctly.`;
      }
    }
    
    // Default response
    return "I can help you understand this form better. Feel free to ask about specific fields or the purpose of this form. You can also click on any field in the list to get information about it.";
  }
  
  /**
   * Add message to chat
   * @param {string} sender - Message sender ('user', 'ai', or 'system')
   * @param {string} text - Message text
   * @param {string} messageId - Optional ID for the message
   * @return {Element} Message element
   */
  function addChatMessage(sender, text, messageId = null) {
    // Create container for message
    const messageDiv = UTILS.createElement('div', {
      className: `chat-message ${sender}-message`,
      id: messageId || null
    });
    
    if (sender === 'ai') {
      // Format AI messages with simple markdown
      let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
      
      const textDiv = UTILS.createElement('div', {className: 'message-text'});
      textDiv.innerHTML = formattedText;
      messageDiv.appendChild(textDiv);
    } else if (sender === 'system') {
      messageDiv.className = 'system-message';
      messageDiv.textContent = text;
    } else {
      messageDiv.textContent = text;
    }
    
    // Add to chat container and scroll to bottom
    dom.chatContainer.appendChild(messageDiv);
    dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
    
    return messageDiv;
  }
  
  /**
   * Trigger PDF upload dialog
   */
  function triggerPdfUpload() {
    if (dom.pdfUpload) {
      dom.pdfUpload.click();
    }
  }
  
  /**
   * Handle PDF file upload
   * @param {Event} event - Change event
   */
  async function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      addChatMessage('ai', 'Please upload a PDF file. Other file types are not supported.');
      return;
    }
    
    // Show loading spinner
    showLoader('Processing PDF form...');
    
    // Set flag
    isProcessingPdf = true;
    
    // Add message about processing
    addChatMessage('ai', 'Processing your PDF form. This may take a moment...');
    
    // Publish event
    EventBus.publish(EventBus.EVENTS.PDF_PROCESSING_STARTED, {
      fileName: file.name,
      fileSize: file.size
    });
    
    if (serverConnected) {
      try {
        await processPdfWithServer(file);
      } catch (error) {
        UTILS.logError('Error processing PDF with server:', error);
        
        // Publish error event
        EventBus.publish(EventBus.EVENTS.PDF_PROCESSING_ERROR, {
          error: error.message
        });
        
        // Add error message
        addChatMessage('ai', 'There was an error processing the PDF. Please try again or use a different file.');
        hideLoader();
        isProcessingPdf = false;
      }
    } else {
      // Fallback to local processing (very limited)
      addChatMessage('ai', 'Server connection is not available. PDF processing requires server connection for OCR capabilities.');
      hideLoader();
      isProcessingPdf = false;
      
      // Publish error event
      EventBus.publish(EventBus.EVENTS.PDF_PROCESSING_ERROR, {
        error: 'Server connection not available'
      });
    }
  }
  
  /**
   * Process PDF with server
   * @param {File} file - PDF file
   * @return {Promise<void>}
   */
  async function processPdfWithServer(file) {
    // Create FormData
    const formData = new FormData();
    formData.append('content_type', file.type);
    formData.append('file', file);
    
    try {
      // Send to server
      const response = await fetch(`${CONFIG.API.BASE_URL}${CONFIG.API.ENDPOINTS.PROCESS_FORM_UPLOAD}`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      UTILS.logDebug('PDF processing result:', result);
      
      // Hide loader
      hideLoader();
      
      // Check if we got valid results
      if (result && result.fields && result.fields.length > 0) {
        // Create a form data object for compatibility
        const formData = {
          formId: 'pdf-form-' + Date.now(),
          formType: result.form_type || 'pdf',
          fields: result.fields.map(field => ({
            ...field,
            element: field.name
          }))
        };
        
        // Publish PDF processing complete event
        EventBus.publish(EventBus.EVENTS.PDF_PROCESSING_COMPLETE, {
          formData: formData
        });
        
        // Process like a regular form
        handleFormDetected(formData);
        
        // Add confirmation message
        addChatMessage('ai', `I've processed your PDF form and detected ${result.fields.length} fields. You can now ask questions about any field.`);
      } else {
        addChatMessage('ai', 'I couldn\'t detect any fields in this PDF. The document might be scanned at a low quality or doesn\'t contain form fields. Please try another PDF or a clearer scan.');
        
        // Publish error event
        EventBus.publish(EventBus.EVENTS.PDF_PROCESSING_ERROR, {
          error: 'No fields detected in PDF'
        });
      }
    } catch (error) {
      UTILS.logError('Error processing PDF:', error);
      throw error; // Re-throw to be handled by the caller
    }
    
    // Reset flag
    isProcessingPdf = false;
  }
  
  /**
   * Handle PDF processed event
   * @param {Object} data - PDF processing result
   */
  function handlePdfProcessed(data) {
    // This is handled directly in processPdfWithServer, but here for completeness
    UTILS.logDebug('PDF processing complete:', data);
  }
  
  /**
   * Handle PDF error event
   * @param {Object} data - PDF error data
   */
  function handlePdfError(data) {
    // This is handled directly in handlePdfUpload, but here for completeness
    UTILS.logError('PDF processing error:', data.error);
  }
  
  /**
   * Show loading spinner
   * @param {string} message - Optional loading message
   */
  function showLoader(message) {
    if (dom.loaderContainer) {
      const loaderText = document.getElementById('loader-text');
      if (loaderText) {
        loaderText.textContent = message || 'Processing...';
      }
      dom.loaderContainer.style.display = 'flex';
    }
    
    // Hide other containers
    if (dom.fieldsContainer) dom.fieldsContainer.style.display = 'none';
    if (dom.uploadContainer) dom.uploadContainer.style.display = 'none';
  }
  
  /**
   * Hide loading spinner
   */
  function hideLoader() {
    if (dom.loaderContainer) {
      dom.loaderContainer.style.display = 'none';
    }
  }
  
  /**
   * Show upload container
   */
  function showUploadContainer() {
    if (dom.uploadContainer) {
      dom.uploadContainer.style.display = 'flex';
    }
    
    // Hide other containers
    if (dom.fieldsContainer) dom.fieldsContainer.style.display = 'none';
    if (dom.loaderContainer) dom.loaderContainer.style.display = 'none';
  }
  
  // Initialize module when DOM is loaded
  document.addEventListener('DOMContentLoaded', initialize);
  
  // Return public API
  return {
    // Expose public methods for testing and extension
    updateStatus,
    addChatMessage,
    displayFieldsAsTiles,
    checkServerConnection,
    autoFillAllFields,
    triggerPdfUpload
  };
})();

// Make available globally
window.FormHelperPanel = FormHelperPanel;