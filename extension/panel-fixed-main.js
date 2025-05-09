// AI Form Helper panel-fixed-main.js - Enhanced with horizontal field tiles

document.addEventListener('DOMContentLoaded', function() {
    // API Configuration
    const API_CONFIG = {
        BASE_URL: 'http://localhost:8000',
        ENDPOINTS: {
            FORMS_DEBUG: '/api/test',
            AI_DEBUG: '/api/test',              
            PROCESS_FORM: '/api/process-form',
            PROCESS_FORM_UPLOAD: '/api/process-form-upload',
            ASK: '/api/ask',                    
            SMART_ASK: '/api/smart/ask',
            PROFILE_GET: '/api/profiles/',
            PROFILE_CREATE: '/api/profiles',
            PROFILE_UPDATE: '/api/profiles/'
        }
    };

    // Initialize variables
    let currentFormId = null;
    let detectedFields = [];
    let currentFieldContext = null;
    let serverConnected = false;
    let isProcessingPdf = false;
    let userProfile = null;

    // DOM Elements
    const statusMessage = document.getElementById('status-message');
    const fieldsContainer = document.getElementById('fields-container');
    const fieldsList = document.getElementById('fields-list');
    const fieldCount = document.getElementById('field-count');
    const chatContainer = document.getElementById('chat-container');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const uploadContainer = document.getElementById('upload-container');
    const loaderContainer = document.getElementById('loader-container');
    const autofillButton = document.getElementById('autofill-button');
    const uploadButton = document.getElementById('upload-button');
    const pdfUpload = document.getElementById('pdf-upload');

    // Field type icons
    const FIELD_ICONS = {
        'text': '📝',
        'email': '📧',
        'password': '🔒',
        'tel': '📞',
        'number': '🔢',
        'date': '📅',
        'select': '📋',
        'checkbox': '☑️',
        'radio': '⚪',
        'file': '📎',
        'textarea': '📄',
        'url': '🔗',
        'search': '🔍',
        'time': '⏰',
        'color': '🎨',
        'range': '📊',
        'default': '📄'
    };

    // Set initial status
    updateStatus('Scanning for forms...');

    // Combined initialization function
    async function initializeApp() {
        // Check server connection
        serverConnected = await checkServerConnection();
        
        // Get or create user profile
        try {
            userProfile = await getOrCreateProfile();
            console.log('User profile loaded:', userProfile);
            
            if (userProfile && userProfile.display_name && statusText) {
                const connectionStatus = serverConnected ? 'Server Connected' : 'Server Disconnected';
                statusText.textContent = `${connectionStatus} | Profile: ${userProfile.display_name}`;
            }
        } catch (error) {
            console.log('Error loading profile:', error);
            // Create default profile
            userProfile = {
                user_id: 'default_user_' + Date.now(),
                display_name: 'User',
                field_values: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }
        
        // Set up mutation observer for dynamically added elements
        setupMutationObserver();
        
        // Request form scan
        requestFormScan();
    }

    // Setup mutation observer to handle dynamically added elements
    function setupMutationObserver() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    // Check if any autofill-button was added
                    const addedAutofillButtons = document.querySelectorAll('#autofill-button:not([data-listener])');
                    if (addedAutofillButtons.length > 0) {
                        addedAutofillButtons.forEach(button => {
                            button.addEventListener('click', autoFillAllFields);
                            button.setAttribute('data-listener', 'true');
                            console.log('Mutation observer added click handler to Auto-fill button');
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

    // Call initialization function
    initializeApp();

    // Set up event listeners
    setupListeners();

    // Update status message
    function updateStatus(message) {
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.style.display = 'block';
        } else {
            console.log('Status:', message);
        }
    }

    // Check server connection with improved error handling
    async function checkServerConnection() {
        try {
            // Use timeout promise to avoid long waits
            const timeoutPromise = (ms) => new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), ms)
            );
            
            // Function to safely fetch with timeout
            const safeFetch = async (url) => {
                try {
                    return await Promise.race([
                        fetch(url, { method: 'GET' }),
                        timeoutPromise(3000) // 3 second timeout
                    ]);
                } catch (err) {
                    console.log(`Connection attempt to ${url} failed:`, err.message);
                    return { ok: false };
                }
            };
            
            // Check forms API
            const formsResponse = await safeFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FORMS_DEBUG}`);
            
            // Check AI API
            const aiResponse = await safeFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AI_DEBUG}`);
            
            // Both need to be available
            serverConnected = formsResponse.ok && aiResponse.ok;
            
            // Update UI
            if (statusDot && statusText) {
                if (serverConnected) {
                    statusDot.classList.remove('disconnected');
                    statusDot.classList.add('connected');
                    statusText.textContent = 'Server Connected';
                    console.log('Server connection established');
                } else {
                    statusDot.classList.remove('connected');
                    statusDot.classList.add('disconnected');
                    statusText.textContent = 'Server Disconnected';
                    console.log('Server disconnected - operating in offline mode');
                }
            }
        } catch (error) {
            console.log('Error checking server connection:', error.message);
            serverConnected = false;
            
            if (statusDot && statusText) {
                statusDot.classList.remove('connected');
                statusDot.classList.add('disconnected');
                statusText.textContent = 'Server Disconnected';
            }
        }
        
        return serverConnected;
    }

    // Set up all event listeners
    function setupListeners() {
        // Remove existing listeners first
        if (chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.removeListener(handleMessage);
            chrome.runtime.onMessage.addListener(handleMessage);
        }
        
        // Set up Auto-fill button
        if (autofillButton) {
            autofillButton.removeEventListener('click', autoFillAllFields);
            autofillButton.addEventListener('click', autoFillAllFields);
            autofillButton.setAttribute('data-listener', 'true');
        }
        
        // Chat form submission
        if (chatForm) {
            chatForm.removeEventListener('submit', handleChatSubmit);
            chatForm.addEventListener('submit', handleChatSubmit);
        }
        
        // PDF upload button
        if (uploadButton) {
            uploadButton.removeEventListener('click', triggerPdfUpload);
            uploadButton.addEventListener('click', triggerPdfUpload);
        }
        
        // PDF file input change
        if (pdfUpload) {
            pdfUpload.removeEventListener('change', handlePdfUpload);
            pdfUpload.addEventListener('change', handlePdfUpload);
        }
    }

    // Handle messages from content script
    function handleMessage(message, sender, sendResponse) {
        console.log('Received message:', message);
        
        if (message.action === 'formDetected') {
            handleFormDetected(message.formData);
            sendResponse({success: true});
        } else if (message.action === 'noFormsFound') {
            updateStatus('No forms found on this page.');
            if (uploadContainer) uploadContainer.style.display = 'flex';
            addChatMessage('ai', 'I didn\'t find any forms on this page. You can upload a PDF form if you have one, or navigate to a page with a form.');
            sendResponse({success: true});
        } else if (message.action === 'autoFillResult') {
            handleAutoFillResult(message.result);
            sendResponse({success: true});
        } else if (message.action === 'saveFieldValue') {
            saveFieldToProfile(message.fieldName, message.fieldValue);
            sendResponse({success: true});
        }
        
        return true;
    }

    // Request form scan from content script
    function requestFormScan() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]) {
                updateStatus('No active tab found');
                if (uploadContainer) uploadContainer.style.display = 'flex';
                return;
            }
            
            chrome.tabs.sendMessage(tabs[0].id, {action: 'scanForms'}, function(response) {
                if (chrome.runtime.lastError) {
                    console.log('Error sending message:', chrome.runtime.lastError);
                    updateStatus('Could not communicate with the page. Try uploading a PDF instead.');
                    if (uploadContainer) uploadContainer.style.display = 'flex';
                }
            });
        });
    }

    // Handle form detection
    function handleFormDetected(formData) {
        console.log('Form detected:', formData);
        
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
            console.log("Storing form context:", formData.formContext);
            detectedFields.formContext = formData.formContext;
        }
        
        // Hide loader and upload container
        if (loaderContainer) loaderContainer.style.display = 'none';
        if (uploadContainer) uploadContainer.style.display = 'none';
        
        // Update UI
        updateStatus(`Found ${formData.fields.length} field${formData.fields.length === 1 ? '' : 's'}`);
        if (fieldCount) fieldCount.textContent = `(${formData.fields.length})`;
        displayFieldsAsTiles(formData.fields);
        
        // Add welcome message if this is first detection
        if (chatContainer.childElementCount === 0) {
            // Add a more descriptive welcome message if form type is known
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

    // Display fields as horizontal tiles
    function displayFieldsAsTiles(fields) {
        if (!fieldsContainer || !fieldsList) return;
        
        // Show fields container
        fieldsContainer.style.display = 'block';
        
        // Clear existing fields
        fieldsList.innerHTML = '';
        
        // Handle no fields case
        if (!fields || fields.length === 0) {
            fieldsList.innerHTML = '<div class="no-fields-message">No fields found</div>';
            return;
        }
        
        // Create field tiles
        fields.forEach(field => {
            // Create field tile
            const fieldTile = document.createElement('div');
            fieldTile.className = 'field-item';
            fieldTile.setAttribute('role', 'button');
            fieldTile.setAttribute('aria-label', `${field.label || field.name || 'Unnamed Field'} - ${field.type || 'text'}`);
            
            // Get field icon
            const fieldType = field.type || 'text';
            const icon = FIELD_ICONS[fieldType] || FIELD_ICONS.default;
            
            // Create inner HTML for the tile
            let tileHTML = `
                <div class="field-icon">${icon}</div>
                <div class="field-details">
                    <div class="field-label" title="${field.label || field.name || 'Unnamed Field'}">${field.label || field.name || 'Unnamed Field'}</div>
                    <div class="field-type" title="${field.type || 'text'}">${field.type || 'text'}</div>
            `;
            
            // Add required badge if needed
            if (field.required) {
                tileHTML += `<span class="required-badge">Required</span>`;
            }
            
            // Close field details div
            tileHTML += `</div>`;
            
            // Set the inner HTML
            fieldTile.innerHTML = tileHTML;
            
            // Add click handler
            fieldTile.addEventListener('click', function() {
                // Remove selected class from all tiles
                document.querySelectorAll('.field-item').forEach(el => {
                    el.classList.remove('selected');
                });
                
                // Add selected class to clicked tile
                fieldTile.classList.add('selected');
                
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
                
                // Get field explanation (will be replaced with actual AI response)
                getFieldExplanation(field).then(explanation => {
                    // Remove thinking message
                    const thinkingEl = document.getElementById(thinkingId);
                    if (thinkingEl) thinkingEl.remove();
                    
                    // Add AI response
                    addChatMessage('ai', explanation);
                });
            });
            
            // Add to fields list
            fieldsList.appendChild(fieldTile);
        });
    }

    // Auto-fill all fields
    function autoFillAllFields() {
        if (!currentFormId) return;
        
        // Check if we have a profile with field values
        const hasProfileData = userProfile && 
                              userProfile.field_values && 
                              Object.keys(userProfile.field_values).length > 0;
        
        // Log profile data for autofill
        if (hasProfileData) {
            console.log('Using profile for autofill:', userProfile.field_values);
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

    // Handle auto-fill result
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

    // Get field explanation - simplified placeholder
    async function getFieldExplanation(field) {
        const fieldName = field.label || field.name || 'this field';
        const fieldType = field.type || 'text';
        
        // This would normally call the AI API for a proper explanation
        // For now we'll return a basic explanation based on field type
        return `This is a ${fieldType} field labeled "${fieldName}". ` +
            `It's used to collect ${getFieldPurpose(fieldType, fieldName)}. ` +
            `${field.required ? 'This field is required.' : 'This field is optional.'}`;
    }

    // Helper to determine field purpose based on type and name
    function getFieldPurpose(fieldType, fieldName) {
        const nameLower = fieldName.toLowerCase();
        
        if (fieldType === 'email' || nameLower.includes('email')) {
            return 'your email address for communication and account management';
        } else if (fieldType === 'password' || nameLower.includes('password')) {
            return 'a secure password to protect your account';
        } else if (fieldType === 'tel' || nameLower.includes('phone') || nameLower.includes('mobile')) {
            return 'your phone number for contact purposes';
        } else if (nameLower.includes('name')) {
            if (nameLower.includes('first')) {
                return 'your first name for identification';
            } else if (nameLower.includes('last')) {
                return 'your last name for identification';
            } else {
                return 'your name for identification';
            }
        } else if (nameLower.includes('address')) {
            return 'your address for shipping or billing purposes';
        } else if (fieldType === 'date' || nameLower.includes('date')) {
            return 'a date, likely for scheduling or record-keeping';
        } else {
            return 'information needed to process your request';
        }
    }

    // Highlight field on the page
    function highlightField(fieldSelector) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'highlightField',
                fieldName: fieldSelector
            });
        });
    }

    // Trigger PDF upload dialog
    function triggerPdfUpload() {
        if (pdfUpload) {
            pdfUpload.click();
        }
    }

    // Handle PDF file upload
    function handlePdfUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (file.type !== 'application/pdf') {
            addChatMessage('ai', 'Please upload a PDF file. Other file types are not supported.');
            return;
        }
        
        // Show loading spinner
        if (loaderContainer) {
            loaderContainer.style.display = 'flex';
            if (document.getElementById('loader-text')) {
                document.getElementById('loader-text').textContent = 'Processing PDF form...';
            }
        }
        
        // Set flag for PDF processing
        isProcessingPdf = true;
        
        // Add message about processing
        addChatMessage('ai', 'Processing your PDF form. This may take a moment...');
        
        // Process PDF with mock data since we don't have server access
        setTimeout(() => {
            // Hide loader
            if (loaderContainer) loaderContainer.style.display = 'none';
            
            // Create mock form data with sample fields
            const mockFormData = {
                formId: 'pdf-' + Date.now(),
                formType: 'pdf',
                fields: [
                    { name: 'name', label: 'Full Name', type: 'text', required: true },
                    { name: 'email', label: 'Email Address', type: 'email', required: true },
                    { name: 'phone', label: 'Phone Number', type: 'tel', required: false },
                    { name: 'address', label: 'Address', type: 'text', required: true },
                    { name: 'dob', label: 'Date of Birth', type: 'date', required: true }
                ],
                formContext: {
                    form_type: 'registration form',
                    form_purpose: 'collecting your information for account creation'
                }
            };
            
            // Process like a regular form
            handleFormDetected(mockFormData);
            
            // Add confirmation message
            addChatMessage('ai', `I've processed your PDF form and detected ${mockFormData.fields.length} fields. You can now ask questions about any field.`);
            
            // Reset flag
            isProcessingPdf = false;
        }, 2000);
    }

    // Save field value to profile
    async function saveFieldToProfile(fieldName, fieldValue) {
        if (!userProfile || !userProfile.user_id) {
            console.log('Cannot save field: profile not loaded');
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
                    console.log(`Saved ${fieldName} to profile`);
                });
            }
        } catch (error) {
            console.log('Error saving field to profile:', error);
        }
    }

    // Get or create user profile
    async function getOrCreateProfile() {
        return new Promise((resolve) => {
            // Try to get browser ID from localStorage
            let userId = localStorage.getItem('formHelperUserId');
            if (!userId) {
                userId = 'user_' + Date.now();
                localStorage.setItem('formHelperUserId', userId);
            }
            
            // Try to get profile from Chrome storage
            if (chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get(['userProfile'], function(result) {
                    if (result.userProfile && result.userProfile.user_id === userId) {
                        console.log('Profile loaded from Chrome storage:', result.userProfile);
                        resolve(result.userProfile);
                    } else {
                        // Create new profile
                        const newProfile = {
                            user_id: userId,
                            display_name: 'User',
                            field_values: {},
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };
                        
                        // Save to Chrome storage
                        chrome.storage.sync.set({ userProfile: newProfile }, function() {
                            console.log('Created new profile in Chrome storage:', newProfile);
                            resolve(newProfile);
                        });
                    }
                });
            } else {
                // If no Chrome storage, create a basic profile
                resolve({
                    user_id: userId,
                    display_name: 'User',
                    field_values: {},
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
        });
    }

    // Handle chat form submission
    function handleChatSubmit(e) {
        e.preventDefault();
        
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;
        
        // Add user message to chat
        addChatMessage('user', userMessage);
        
        // Clear input
        chatInput.value = '';
        
        // Show thinking indicator
        const thinkingId = 'thinking-' + Date.now();
        addChatMessage('ai', 'Thinking...', thinkingId);
        
        // Process message (in a real implementation, this would call an AI API)
        setTimeout(() => {
            // Remove thinking indicator
            const thinkingEl = document.getElementById(thinkingId);
            if (thinkingEl) thinkingEl.remove();
            
            // Add AI response
            if (userMessage.toLowerCase().includes('what') && userMessage.toLowerCase().includes('form')) {
                const formType = detectedFields.formContext?.form_type?.replace(" form", "").trim() || "data collection";
                const purpose = detectedFields.formContext?.form_purpose || "collecting your information";
                
                addChatMessage('ai', `This is a ${formType} form for ${purpose}. It contains ${detectedFields.length} fields that you'll need to fill out. I can help explain any of these fields - just click on one of the field tiles above or ask me about a specific field.`);
            } else if (userMessage.toLowerCase().includes('autofill') || userMessage.toLowerCase().includes('fill')) {
                addChatMessage('ai', `I can automatically fill the form for you. Just click the "Auto-fill Form" button at the bottom of the panel. This will fill all fields with appropriate sample data.`);
            } else {
                addChatMessage('ai', `I'm here to help you with this form. You can ask me about any field by clicking on it, or ask general questions about the form. I can also auto-fill the form for you using the button at the bottom.`);
            }
        }, 1000);
    }

    // Add message to chat
    function addChatMessage(sender, text, messageId = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        
        // Add ID if provided
        if (messageId) {
            messageDiv.id = messageId;
        }
        
        if (sender === 'ai') {
            // Format with basic markdown
            const textDiv = document.createElement('div');
            textDiv.className = 'message-text';
            
            // Simple formatting
            let formattedText = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
                
            textDiv.innerHTML = formattedText;
            messageDiv.appendChild(textDiv);
        } else if (sender === 'system') {
            messageDiv.className = 'system-message';
            messageDiv.textContent = text;
        } else {
            messageDiv.textContent = text;
        }
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return messageDiv;
    }
});