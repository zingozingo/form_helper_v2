// AI Form Helper panel.js - Enhanced with PDF processing and backend integration

// Ensure the DOM is fully loaded before initializing
document.addEventListener('DOMContentLoaded', function() {
    console.log("Panel.js: DOMContentLoaded triggered");
    
    // Ensure panel is visible during initialization
    document.body.style.visibility = 'visible';
    
    // API Configuration - override with localhost for development, set to production URL for release
    const API_CONFIG = {
        BASE_URL: 'http://localhost:8000',
        ENDPOINTS: {
            FORMS_DEBUG: '/api/test',           // Changed from /api/forms/debug
            AI_DEBUG: '/api/test',              // Changed from /api/ai/ask
            PROCESS_FORM: '/api/process-form',  // Changed from /api/forms/process-form
            PROCESS_FORM_UPLOAD: '/api/process-form-upload', // Changed from /api/forms/process-form-upload
            ASK: '/api/ask',                    // Changed from /api/ai/ask
            SMART_ASK: '/api/smart/ask',        // New enhanced SmartCopilot endpoint
            PROFILE_GET: '/api/profiles/',
            PROFILE_CREATE: '/api/profiles',
            PROFILE_UPDATE: '/api/profiles/'
        }
    };

    // Field knowledge base - comprehensive explanations for all common field types
    // Used as fallback when server isn't available
    const FIELD_KNOWLEDGE = {
      "email": {
        purpose: "An email address is used for account creation, login, and communications from the service.",
        format: "username@domain.com",
        examples: "john.doe@example.com, jane_smith123@company.co.uk",
        required: "Email addresses are usually required as they're the primary means of communication and account recovery.",
        privacy: "Your email may be used to send you updates and notifications. Check the privacy policy for how it will be used.",
        security: "Use a secure email provider with good spam filtering."
      },
      "password": {
        purpose: "A password protects your account from unauthorized access.",
        format: "Usually 8+ characters with a mix of letters, numbers, and symbols.",
        examples: "(Examples aren't shown for security reasons)",
        required: "Yes, password fields are always required for security purposes.",
        privacy: "Never share your password with anyone. Legitimate services will never ask for it.",
        security: "Create a unique password not used on other sites. Consider using a password manager.",
        login_context: "This field is for entering your existing password to access your account.",
        registration_context: "This field is for creating a secure password that will protect your new account.",
        strength_guidance: "A strong password should include uppercase and lowercase letters, numbers, and special characters. Avoid using personal information or common words."
      },
      "name": {
        purpose: "Your name is used for personalization and identification.",
        format: "Text, as it appears on your official documents.",
        examples: "John Smith, Jane Doe",
        required: "Names are typically required for personalization and identification.",
        privacy: "Your name may appear in your profile or account information.",
        security: "Use your legal name for official forms."
      },
      "first_name": {
        purpose: "Your first/given name is used for personalization.",
        format: "Text, as it appears on your official documents.",
        examples: "John, Jane, María",
        required: "First names are typically required for personalization.",
        privacy: "Your first name may appear in your profile or account information.",
        security: "Use your legal first name for official forms."
      },
      "last_name": {
        purpose: "Your last/family name is used for identification.",
        format: "Text, as it appears on your official documents.",
        examples: "Smith, Johnson, García",
        required: "Last names are typically required for identification.",
        privacy: "Your last name may appear in your profile or account information.",
        security: "Use your legal last name for official forms."
      },
      "address": {
        purpose: "Your address is used for shipping, billing, or location-based services.",
        format: "Street address with house/apartment number",
        examples: "123 Main St, Apt 4B",
        required: "Addresses are required for physical deliveries or location-based services.",
        privacy: "Your address is sensitive information that should only be shared with trusted services.",
        security: "Verify a site is legitimate before entering your address."
      },
      "city": {
        purpose: "Your city or town is used as part of your address for shipping or regional services.",
        format: "Text, city or town name",
        examples: "New York, London, Tokyo",
        required: "City is typically required as part of a complete address.",
        privacy: "Your city may be used for regional targeting or demographics.",
        security: "Ensure the site is legitimate before providing location information."
      },
      "state": {
        purpose: "Your state/province is used as part of your address for shipping or regional services.",
        format: "Full name or standard abbreviation",
        examples: "California, CA, Ontario",
        required: "State/province is typically required as part of a complete address in many countries.",
        privacy: "Your state may be used for regional targeting or demographics.",
        security: "Ensure the site is legitimate before providing location information."
      },
      "zip": {
        purpose: "Your postal/zip code is used for mail delivery and location identification.",
        format: "Standard postal code format for your country",
        examples: "10001 (US), SW1A 1AA (UK)",
        required: "Postal codes are required for mail delivery and shipping.",
        privacy: "Your postal code can reveal your approximate location.",
        security: "Verify a site is legitimate before entering your postal code."
      },
      "country": {
        purpose: "Your country is used for shipping, regional settings, or compliance requirements.",
        format: "Full country name or standard country code",
        examples: "United States, Canada, FR",
        required: "Country is typically required for international services and shipping.",
        privacy: "Your country may determine what features or content you can access.",
        security: "This is generally low-risk information."
      },
      "phone": {
        purpose: "Your phone number is used for account verification, two-factor authentication, or contact purposes.",
        format: "Full number with country code when required",
        examples: "+1 555-123-4567",
        required: "Phone numbers may be required for verification or important communications.",
        privacy: "Your phone number is sensitive personal information.",
        security: "Providing your phone number could lead to SMS spam or phishing attempts."
      },
      "credit_card": {
        purpose: "Your credit card details are used for payment processing.",
        format: "16-digit card number, expiration date, and security code",
        examples: "(Examples aren't shown for security reasons)",
        required: "Credit card information is required for making purchases.",
        privacy: "Card details should only be shared on secure payment pages.",
        security: "Only enter card details on HTTPS sites with a padlock icon. Never share your CVV via email or chat."
      },
      "cvv": {
        purpose: "The CVV/security code verifies you have physical possession of the card.",
        format: "3-4 digit code found on your credit card",
        examples: "(Examples aren't shown for security reasons)",
        required: "CVV is required for secure online transactions.",
        privacy: "Legitimate sites never store your CVV after the transaction.",
        security: "Never share your CVV via email or chat. Only enter it on trusted payment pages."
      },
      "date_of_birth": {
        purpose: "Your date of birth is used for age verification, personalization, or account recovery.",
        format: "MM/DD/YYYY or DD/MM/YYYY depending on region",
        examples: "01/15/1990",
        required: "Date of birth may be required for age verification or account security.",
        privacy: "This is sensitive personal information that could be used for identity theft.",
        security: "Only provide your real date of birth to trusted services."
      },
      "username": {
        purpose: "A username identifies your account and may be visible to others.",
        format: "Usually letters, numbers, and some special characters",
        examples: "john_doe123, cool_cat22",
        required: "Usernames are required for account identification.",
        privacy: "Usernames are often public, so avoid including sensitive information.",
        security: "Use a unique username that doesn't reveal your identity or personal details."
      },
      "gender": {
        purpose: "Gender information may be used for personalization, demographics, or product recommendations.",
        format: "Usually provided as a selection from options",
        examples: "Male, Female, Non-binary, Prefer not to say",
        required: "Gender is sometimes optional depending on the service.",
        privacy: "Gender information is sensitive personal data.",
        security: "Consider whether you're comfortable sharing this information."
      },
      "terms": {
        purpose: "This confirms your agreement to the service's terms and conditions.",
        format: "Checkbox",
        examples: "I agree to the Terms of Service",
        required: "Agreeing to terms is almost always required to use a service.",
        privacy: "Reading the terms helps you understand how your data will be used.",
        security: "Consider reviewing key points of the terms before agreeing."
      },
      "search": {
        purpose: "A search field lets you find specific content within the website or database.",
        format: "Free text entry",
        examples: "product name, topic, keyword",
        required: "Search fields are optional for finding content.",
        privacy: "Your search terms may be tracked to improve results.",
        security: "Avoid entering sensitive personal information in search fields."
      },
      "quantity": {
        purpose: "This field lets you specify how many items you want to purchase.",
        format: "Numeric value, often with minimum of 1",
        examples: "1, 2, 10",
        required: "Quantity is typically required for product orders.",
        privacy: "This isn't sensitive personal information.",
        security: "Check that the quantity and resulting price are correct before ordering."
      },
      "message": {
        purpose: "A message field allows you to communicate with the service provider.",
        format: "Free text entry, often multi-line",
        examples: "I have a question about my recent order...",
        required: "Message fields are typically required on contact forms.",
        privacy: "Avoid sharing sensitive personal information unless necessary.",
        security: "Be cautious about what information you include in messages."
      },
      "subject": {
        purpose: "The subject summarizes what your message or inquiry is about.",
        format: "Brief text summary",
        examples: "Order Inquiry, Product Question",
        required: "Subject lines are often required for contact forms.",
        privacy: "Keep subjects informative but avoid unnecessary personal details.",
        security: "This isn't typically sensitive information."
      },
      "file": {
        purpose: "This field allows you to upload documents, images, or other files.",
        format: "File upload based on accepted file types",
        examples: "Resume.pdf, profile_photo.jpg",
        required: "File uploads may be required or optional depending on the form purpose.",
        privacy: "Be cautious about the content of files you upload.",
        security: "Only upload files to trusted websites. Ensure no sensitive metadata is included."
      },
      "promo_code": {
        purpose: "A promotional code field allows you to enter special codes for discounts or benefits.",
        format: "Alphanumeric code, often case-sensitive",
        examples: "SAVE10, SUMMER2023",
        required: "Promo code fields are typically optional.",
        privacy: "Promo codes may be tracked for marketing effectiveness.",
        security: "This isn't sensitive personal information."
      }
    };

    // DOM Elements
    const statusMessage = document.getElementById('status-message');
    const fieldsPanel = document.getElementById('fields-panel');
    const fieldsContainer = document.getElementById('fields-container');
    const fieldsList = document.getElementById('fields-list');
    const fieldsCount = document.getElementById('fields-count');
    const toggleFieldsBtn = document.getElementById('toggle-fields-btn');
    const chatPanel = document.getElementById('chat-panel');
    const chatContainer = document.getElementById('chat-container');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const uploadContainer = document.getElementById('upload-container');
    const uploadButton = document.getElementById('upload-button');
    const pdfUpload = document.getElementById('pdf-upload');
    const uploadPdfButton = document.getElementById('upload-pdf-button');
    const loaderContainer = document.getElementById('loader-container');
    const loaderText = document.getElementById('loader-text');
    const autoFillButton = document.getElementById('autofill-button');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    // State Management
    let detectedFields = [];
    let currentFormId = null;
    let currentFieldContext = null;
    let isBackendConnected = false;
    let isProcessingPdf = false;
    let userProfile = {
        id: null,
        name: "Default Profile",
        field_values: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    // Settings
    let appSettings = {
        debugMode: false,  // Toggle to show/hide form score and detection details
        panelState: {
            collapsed: false
        }
    };

    // Panel State
    let isPanelCollapsed = false;

    // Load settings from storage
    chrome.storage.local.get(['formHelperSettings'], function(result) {
        if (result.formHelperSettings) {
            appSettings = result.formHelperSettings;
            
            // Apply panel state
            isPanelCollapsed = appSettings.panelState.collapsed || false;
            
            // Apply debug mode
            if (appSettings.debugMode) {
                const debugModeIndicator = document.createElement('div');
                debugModeIndicator.className = 'debug-mode-indicator';
                debugModeIndicator.textContent = 'Debug Mode';
                debugModeIndicator.style.cssText = `
                    position: absolute;
                    top: 5px;
                    right: 120px;
                    background-color: #FBBC05;
                    color: black;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: bold;
                    z-index: 11;
                `;
                document.querySelector('.header').appendChild(debugModeIndicator);
                
                // Also add a debug flag to the body element for CSS targeting
                document.body.classList.add('debug-mode');
            }
            
            // Apply panel collapsed state
            if (isPanelCollapsed) {
                fieldsPanel.classList.add('collapsed');
                toggleFieldsBtn.innerHTML = '&#10095;'; // Right arrow
                toggleFieldsBtn.setAttribute('title', 'Expand fields panel');
            } else {
                toggleFieldsBtn.innerHTML = '&#10094;'; // Left arrow
                toggleFieldsBtn.setAttribute('title', 'Collapse fields panel');
            }
            
            // Make sure the panels container is visible
            document.querySelector('.panels-container').style.display = 'flex';
            
            console.log("Applied settings:", appSettings);
            console.log("Panel collapsed state:", isPanelCollapsed);
        } else {
            // Initialize with default settings if none exist
            console.log("No settings found, initializing defaults");
            saveSettings();
        }
        
        // Force layout calculation after the panel state is applied
        setTimeout(function() {
            console.log("Forcing layout recalculation");
            // Dispatch resize event to ensure proper layout
            window.dispatchEvent(new Event('resize'));
            
            // Verify panel structure
            console.log("Panel structure:", {
                isPanelCollapsed: isPanelCollapsed,
                leftPanelClassList: fieldsPanel.classList.toString(),
                leftPanelWidth: fieldsPanel.offsetWidth + 'px',
                rightPanelWidth: chatPanel.offsetWidth + 'px',
                containerDisplay: document.querySelector('.panels-container').style.display
            });
        }, 100);
    });
    
    // Function to save settings
    function saveSettings() {
        // Update panel state
        appSettings.panelState.collapsed = isPanelCollapsed;
        
        // Save to storage
        chrome.storage.local.set({
            formHelperSettings: appSettings
        }, function() {
            console.log('Settings saved:', appSettings);
        });
    }

    // Toggle Fields Panel
    toggleFieldsBtn.addEventListener('click', function() {
        isPanelCollapsed = !isPanelCollapsed;
        
        if (isPanelCollapsed) {
            fieldsPanel.classList.add('collapsed');
            toggleFieldsBtn.innerHTML = '&#10095;'; // Right arrow
            toggleFieldsBtn.setAttribute('title', 'Expand fields panel');
        } else {
            fieldsPanel.classList.remove('collapsed');
            toggleFieldsBtn.innerHTML = '&#10094;'; // Left arrow
            toggleFieldsBtn.setAttribute('title', 'Collapse fields panel');
        }
        
        // Update and save panel state to storage
        appSettings.panelState.collapsed = isPanelCollapsed;
        saveSettings();
        
        // Force layout recalculation to ensure smooth transition
        window.requestAnimationFrame(function() {
            window.requestAnimationFrame(function() {
                // Dispatch resize event to handle any layout adjustments
                window.dispatchEvent(new Event('resize'));
            });
        });
    });

    // Initialize: Check backend status, load profile and wait for messages
    init();

    // Initialization function
    function init() {
        // Check backend connection
        checkBackendConnection();

        // Load user profile
        loadUserProfile();

        // Set up message listener for communication with content script
        chrome.runtime.onMessage.addListener(handleMessage);

        // Ask content script to start scanning for forms
        requestFormScan();

        // Set up UI event listeners
        setupEventListeners();
    }

    // Set up UI event listeners
    function setupEventListeners() {
        // Chat form submission
        chatForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const message = chatInput.value.trim();
            if (message) {
                sendChatMessage(message);
                chatInput.value = '';
            }
        });

        // PDF upload button
        if (uploadButton) {
            uploadButton.addEventListener('click', function() {
                pdfUpload.click();
            });
        }

        // PDF upload from fields panel button
        if (uploadPdfButton) {
            uploadPdfButton.addEventListener('click', function() {
                pdfUpload.click();
            });
        }

        // PDF file input change
        if (pdfUpload) {
            pdfUpload.addEventListener('change', function(event) {
                const file = event.target.files[0];
                if (file && file.type === 'application/pdf') {
                    processPdfUpload(file);
                }
            });
        }

        // Auto-fill button
        if (autoFillButton) {
            autoFillButton.addEventListener('click', autoFillAllFields);
        }
    }

    // Show the status message
    function updateStatus(message) {
      if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.style.display = 'block';
      }
    }

    // Check backend connection
    function checkBackendConnection() {
      const endpoint = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AI_DEBUG}`;
      
      fetch(endpoint)
        .then(response => {
          if (response.ok) {
            return response.json().then(data => {
              console.log('Backend connection established:', data);
              isBackendConnected = true;
              updateConnectionStatus(true);
            });
          } else {
            throw new Error(`Server returned ${response.status}`);
          }
        })
        .catch(error => {
          console.error('Backend connection failed:', error);
          isBackendConnected = false;
          updateConnectionStatus(false);
        });
    }

    // Update the connection status indicators
    function updateConnectionStatus(isConnected) {
      if (statusDot && statusText) {
        if (isConnected) {
          statusDot.className = 'status-dot connected';
          statusText.textContent = 'Connected';
        } else {
          statusDot.className = 'status-dot disconnected';
          statusText.textContent = 'Offline Mode';
        }
      }
    }

    // Load user profile from Chrome Storage
    function loadUserProfile() {
      chrome.storage.local.get(['userProfile'], function(result) {
        if (result.userProfile) {
          userProfile = result.userProfile;
          console.log('Loaded user profile:', userProfile);
        } else {
          // Create a new default profile
          console.log('Creating new default profile');
          saveUserProfile();
        }
      });
    }

    // Save user profile to Chrome Storage
    function saveUserProfile() {
      // Update timestamp
      userProfile.updated_at = new Date().toISOString();
      
      chrome.storage.local.set({userProfile: userProfile}, function() {
        console.log('User profile saved:', userProfile);
      });
    }

    // Save field value to user profile
    function saveFieldToProfile(fieldName, fieldValue) {
      if (!fieldName || !fieldValue) return;
      
      console.log(`Saving field value to profile: ${fieldName} = ${fieldValue}`);
      
      // Update the profile with the new value
      userProfile.field_values[fieldName] = fieldValue;
      
      // Save the updated profile
      saveUserProfile();
    }

    // Request content script to scan for forms
    function requestFormScan() {
      updateStatus('Scanning for forms...');
      showLoader('Analyzing page...');
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'scanForms'});
        } else {
          updateStatus('Unable to access page. Try refreshing.');
          hideLoader();
        }
      });
    }

    // Show the loader with specified message
    function showLoader(message) {
      if (loaderContainer) {
        if (loaderText) {
          loaderText.textContent = message || 'Processing...';
        }
        loaderContainer.style.display = 'flex';
      }
      
      // Hide other containers
      if (fieldsContainer) fieldsContainer.style.display = 'none';
      if (uploadContainer) uploadContainer.style.display = 'none';
    }
    
    // Hide loading spinner
    function hideLoader() {
      if (loaderContainer) {
        loaderContainer.style.display = 'none';
      }
    }
    
    // Show upload container when no form is detected
    function showUploadContainer() {
      if (uploadContainer) {
        uploadContainer.style.display = 'flex';
      }
      
      // Hide other containers
      if (fieldsContainer) fieldsContainer.style.display = 'none';
      if (loaderContainer) loaderContainer.style.display = 'none';
    }
  
    // Add this to your handleMessage function inside the function body
    // Right after the other message handling cases
    function handleMessage(message, sender, sendResponse) {
        console.log('Received message:', message);
        
        if (message.action === 'formDetected') {
            handleFormDetected(message.formData);
            sendResponse({success: true});
        } else if (message.action === 'noFormsFound') {
            updateStatus('No forms found on this page.');
            showUploadContainer();
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
  
    // Handle form detection
    function handleFormDetected(formData) {
      console.log('Form detected:', formData);
      
      // Store form data - Make sure to store the complete formData, not just the fields
      currentFormId = formData.formId;
      
      // Store in both ways to ensure availability
      window.formData = formData;
      
      // Ensure we have the fields properly stored
      if (formData.fields && Array.isArray(formData.fields)) {
        detectedFields = formData.fields;
      } else {
        detectedFields = [];
      }
      
      // Also store the form context separately for easier access
      if (formData.formContext) {
        console.log("Storing form context:", formData.formContext);
        detectedFields.formContext = formData.formContext;
      }
      
      // Hide loader and upload container
      hideLoader();
      if (uploadContainer) uploadContainer.style.display = 'none';
      
      // Update UI
      updateStatus(`Found ${formData.fields.length} field${formData.fields.length === 1 ? '' : 's'}`);
      displayFields(formData.fields);
      
      // Display form score if in debug mode
      if (appSettings.debugMode && formData.formScore) {
        // Create or update debug info element
        let debugInfo = document.getElementById('debug-info');
        if (!debugInfo) {
          debugInfo = document.createElement('div');
          debugInfo.id = 'debug-info';
          debugInfo.className = 'debug-info';
          debugInfo.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background-color: rgba(251, 188, 5, 0.9);
            color: black;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-family: monospace;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          `;
          document.body.appendChild(debugInfo);
        }
        
        // Populate with form detection details
        let debugContent = `<strong>Form Score: ${formData.formScore}</strong><br>`;
        
        if (formData.detectionReason) {
          debugContent += `<strong>Detection Reason:</strong> ${formData.detectionReason}<br>`;
        }
        
        if (formData.formContext) {
          debugContent += `<strong>Form Type:</strong> ${formData.formContext.form_type || 'Unknown'}<br>`;
          debugContent += `<strong>Confidence:</strong> ${(formData.formContext.confidence * 100).toFixed(1)}%<br>`;
        }
        
        debugInfo.innerHTML = debugContent;
      } else {
        // Remove debug info if exists and not in debug mode
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
          debugInfo.remove();
        }
      }
      
      // Add welcome message if this is first detection
      if (chatContainer.childElementCount === 0) {
        // Add a more descriptive welcome message if form type is known
        if (formData.formContext && formData.formContext.form_type && 
            formData.formContext.form_type !== "unknown form") {
          const formType = formData.formContext.form_type.replace(" form", "").trim();
          addChatMessage('ai', `I found a ${formType} form with ${formData.fields.length} field${formData.fields.length === 1 ? '' : 's'}. This form is for ${formData.formContext.form_purpose || 'collecting information'}. Click on any field to learn more about it, or ask me a question.`);
        } else {
          addChatMessage('ai', `I found a form with ${formData.fields.length} field${formData.fields.length === 1 ? '' : 's'}. Click on any field to learn more about it, or ask me a question.`);
        }
      } else if (isProcessingPdf) {
        // We've already added a message in PDF processing
        isProcessingPdf = false;
      }
    }
  
    // Display fields in sidebar - MODIFIED to update the fields counter
    function displayFields(fields) {
      if (!fieldsContainer || !fieldsList) return;
      
      // Clear the fields list
      fieldsList.innerHTML = '';
      
      // Show the fields container
      fieldsContainer.style.display = 'block';
      
      // Update fields counter
      if (fieldsCount) {
        fieldsCount.textContent = fields.length;
      }
      
      // Create field items
      fields.forEach(field => {
        const fieldItem = document.createElement('div');
        fieldItem.className = 'field-item';
        
        // Determine icon based on field type
        let icon = '📄';
        if (field.type === 'email') icon = '📧';
        else if (field.type === 'password') icon = '🔒';
        else if (field.type === 'tel') icon = '📞';
        else if (field.type === 'number') icon = '🔢';
        else if (field.type === 'date') icon = '📅';
        else if (field.type === 'checkbox') icon = '☑️';
        else if (field.type === 'radio') icon = '⚪';
        else if (field.type === 'textarea') icon = '📝';
        
        fieldItem.innerHTML = `
          <div class="field-icon">${icon}</div>
          <div class="field-details">
            <div class="field-label">${field.label || field.name || 'Unnamed Field'}</div>
            <div class="field-type">${field.type || 'text'} ${field.required ? '(required)' : ''}</div>
          </div>
        `;
        
        // Add click handler to select and highlight field
        fieldItem.addEventListener('click', function() {
          // Update UI to show selected field
          document.querySelectorAll('.field-item').forEach(el => {
            el.classList.remove('selected');
          });
          fieldItem.classList.add('selected');
          
          // Set current field context
          currentFieldContext = field;
          
          // Highlight field on page (not for PDFs)
          if (!isProcessingPdf) {
            highlightField(field.name || field.id || field.element);
          }
          
          // Add message to chat
          const fieldName = field.label || field.name || 'this field';
          addChatMessage('user', `What is ${fieldName} for?`);
          
          // Get field explanation (from server if available, otherwise fallback)
          getFieldExplanation(field).then(explanation => {
            addChatMessage('ai', explanation);
          });
        });
        
        fieldsList.appendChild(fieldItem);
      });
      
      // Ensure buttons are visible in the container
      const formActions = fieldsContainer.querySelector('.form-actions');
      if (!formActions) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'form-actions';
        actionsDiv.innerHTML = `
          <button id="autofill-button" class="action-button">Auto-fill Form</button>
          <button id="upload-pdf-button" class="action-button secondary">Upload PDF</button>
        `;
        
        // Add event listeners
        actionsDiv.querySelector('#autofill-button').addEventListener('click', autoFillAllFields);
        actionsDiv.querySelector('#upload-pdf-button').addEventListener('click', function() {
          pdfUpload.click();
        });
        
        fieldsContainer.appendChild(actionsDiv);
      }
    }
  
    // Highlight field on page
    function highlightField(fieldSelector) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'highlightField',
          fieldName: fieldSelector
        });
      });
    }
  
    // Auto-fill all fields
    function autoFillAllFields() {
        if (!currentFormId) return;
        
        // Check if we have a profile with field values
        const hasProfileData = userProfile && 
                              userProfile.field_values && 
                              Object.keys(userProfile.field_values).length > 0;
        
        // Log profile data being used for autofill
        if (hasProfileData) {
            console.log('Using profile data for autofill:', userProfile.field_values);
        }
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'autoFillForm',
                formId: currentFormId,
                profileData: hasProfileData ? userProfile.field_values : null
            }, function(response) {
                if (response && response.success) {
                    // Provide feedback based on whether profile data was used
                    const messageText = hasProfileData ? 
                        `I've filled ${response.count} field${response.count === 1 ? '' : 's'} with your saved data where available, and sample data for the rest.` :
                        `I've filled ${response.count} field${response.count === 1 ? '' : 's'} with sample data.`;
                        
                    addChatMessage('ai', messageText);
                } else {
                    addChatMessage('system', 'Unable to auto-fill form. Please try again.');
                }
            });
        });
    }
    
    // Handle auto-fill result
    function handleAutoFillResult(result) {
        if (result && result.success) {
            addChatMessage('system', `Auto-filled ${result.count} fields`);
        } else {
            addChatMessage('system', 'Failed to auto-fill fields');
        }
    }

    // Process a PDF upload
    function processPdfUpload(file) {
        showLoader('Analyzing PDF...');
        isProcessingPdf = true;
        
        // Create FormData with the file
        const formData = new FormData();
        formData.append('file', file);
        
        // Add message to chat
        addChatMessage('system', `Uploading PDF: ${file.name}`);
        
        // Send to backend
        fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROCESS_FORM_UPLOAD}`, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('PDF processed successfully:', data);
            
            // Hide loader
            hideLoader();
            
            // Handle the processed form data
            if (data && data.fields) {
                // Create formData object similar to what we'd get from content script
                const formData = {
                    formId: 'pdf-form-' + Date.now(),
                    fields: data.fields,
                    formContext: data.formContext || {
                        form_type: "PDF form",
                        form_purpose: "submitting information",
                        description: "This is a PDF form that was uploaded for analysis.",
                        confidence: 1.0
                    }
                };
                
                // Store form data
                handleFormDetected(formData);
                
                // Add message to chat
                addChatMessage('ai', `I've analyzed the PDF form and found ${data.fields.length} field${data.fields.length === 1 ? '' : 's'}. Click on any field to learn more about it, or ask me a question.`);
            } else {
                // Handle empty or invalid response
                showUploadContainer();
                addChatMessage('ai', 'I couldn\'t extract any fields from this PDF. This may not be a fillable PDF form, or it might use a format I can\'t process yet.');
            }
        })
        .catch(error => {
            console.error('Error processing PDF:', error);
            
            // Hide loader
            hideLoader();
            showUploadContainer();
            
            // Add error message to chat
            addChatMessage('ai', 'Sorry, I couldn\'t process that PDF. The file might be too large, protected, or in a format I can\'t handle yet.');
        });
    }

    // Send chat message to AI and display in chat window
    function sendChatMessage(message) {
        // Don't send empty messages
        if (!message.trim()) return;
        
        // Add user message to chat
        addChatMessage('user', message);
        
        // Show the thinking indicator
        const thinkingIndicator = document.createElement('div');
        thinkingIndicator.className = 'thinking-indicator';
        thinkingIndicator.textContent = 'Thinking...';
        chatContainer.appendChild(thinkingIndicator);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Check if we have form context
        const hasFormContext = detectedFields && detectedFields.formContext;
        const context = {
            fields: detectedFields,
            formContext: hasFormContext ? detectedFields.formContext : null,
            currentFieldContext: currentFieldContext
        };
        
        // Use backend if connected, otherwise use fallback
        if (isBackendConnected) {
            try {
                // Send to SmartCopilot endpoint 
                console.log("Sending to SmartCopilot with context:", context);
                
                fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SMART_ASK}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: message,
                        context: context
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Remove thinking indicator
                    thinkingIndicator.remove();
                    
                    // Add AI response to chat
                    addChatMessage('ai', data.response || 'Sorry, I couldn\'t understand that.');
                    
                    // If we got field context back, update the current field context
                    if (data.field_context) {
                        currentFieldContext = data.field_context;
                    }
                })
                .catch(error => {
                    console.error('Error getting AI response:', error);
                    
                    // Remove thinking indicator
                    thinkingIndicator.remove();
                    
                    // Fall back to simple response
                    addChatMessage('ai', getFieldExplanation(currentFieldContext) || 'Sorry, I couldn\'t process that request. Please try again.');
                });
            } catch (error) {
                // Handle any errors in the fetch call setup
                console.error('Error setting up AI request:', error);
                thinkingIndicator.remove();
                
                // Fall back to simple response
                addChatMessage('ai', 'Sorry, I encountered an error. Please try again.');
            }
        } else {
            // No backend connection, use local fallback
            setTimeout(() => {
                // Remove thinking indicator
                thinkingIndicator.remove();
                
                // Generate a simple fallback response based on the message
                const response = getFallbackResponse(message, currentFieldContext);
                addChatMessage('ai', response);
            }, 800); // Small delay to simulate thinking
        }
    }

    // Add message to chat container
    function addChatMessage(type, messageText) {
        // Don't add empty messages
        if (!messageText || !messageText.trim()) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-text';
        messageContent.textContent = messageText;
        
        messageElement.appendChild(messageContent);
        chatContainer.appendChild(messageElement);
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Get AI explanation of a field - enhanced with context awareness
    async function getFieldExplanation(field) {
        // If no field is selected, return a general message
        if (!field) {
            return "Please select a field you'd like to learn about, or ask a question about this form.";
        }
        
        // Try to get explanation from backend
        if (isBackendConnected) {
            try {
                const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ASK}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: `What is the "${field.label || field.name}" field for?`,
                        field_context: field,
                        form_context: detectedFields.formContext || null
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    return data.response || getFallbackFieldExplanation(field);
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                console.error('Error getting field explanation from server:', error);
                // Fall back to local explanation when server fails
                return getFallbackFieldExplanation(field);
            }
        } else {
            // Use local fallback when not connected
            return getFallbackFieldExplanation(field);
        }
    }

    // Get a fallback explanation for a field from the knowledge base
    function getFallbackFieldExplanation(field) {
        if (!field) return "Please select a field to learn more about it.";
        
        const fieldName = field.label || field.name || 'this field';
        const fieldType = field.type || 'text';
        const purpose = field.purpose || '';
        
        // Check if we have knowledge about this field type
        let knowledgeField = null;
        
        // First try to match on name
        const fieldKey = field.name ? field.name.toLowerCase() : '';
        
        // Common variations of field names
        const commonFieldMappings = {
            'email': ['email', 'e-mail', 'emailaddress', 'user_email'],
            'name': ['name', 'fullname', 'full_name', 'display_name'],
            'first_name': ['first_name', 'firstname', 'fname', 'given_name', 'forename'],
            'last_name': ['last_name', 'lastname', 'lname', 'surname', 'family_name'],
            'password': ['password', 'pass', 'pwd', 'userpass', 'user_password'],
            'username': ['username', 'user_name', 'login', 'user_id', 'userid'],
            'phone': ['phone', 'telephone', 'phone_number', 'mobile', 'cell', 'tel'],
            'address': ['address', 'street', 'addr', 'street_address', 'address_line1'],
            'city': ['city', 'town', 'municipality', 'locality'],
            'state': ['state', 'province', 'region', 'territory', 'prefecture'],
            'zip': ['zip', 'zipcode', 'zip_code', 'postal', 'postal_code', 'postcode'],
            'country': ['country', 'nation', 'country_code'],
            'date_of_birth': ['dob', 'date_of_birth', 'birthdate', 'birth_date', 'birthday'],
            'credit_card': ['credit_card', 'card_number', 'cc_number', 'ccnum', 'creditcard'],
            'cvv': ['cvv', 'cvc', 'security_code', 'card_verification'],
            'gender': ['gender', 'sex'],
            'message': ['message', 'comment', 'feedback', 'content', 'text', 'body']
        };
        
        // Try to find a matching field type in our knowledge base
        for (const [baseField, variations] of Object.entries(commonFieldMappings)) {
            if (FIELD_KNOWLEDGE[baseField] && variations.some(v => fieldKey.includes(v))) {
                knowledgeField = FIELD_KNOWLEDGE[baseField];
                break;
            }
        }
        
        // If no match on name, try to match on type
        if (!knowledgeField) {
            // Email and password types have dedicated entries
            if (fieldType === 'email' && FIELD_KNOWLEDGE['email']) {
                knowledgeField = FIELD_KNOWLEDGE['email'];
            } else if (fieldType === 'password' && FIELD_KNOWLEDGE['password']) {
                knowledgeField = FIELD_KNOWLEDGE['password'];
            } else if (fieldType === 'tel' && FIELD_KNOWLEDGE['phone']) {
                knowledgeField = FIELD_KNOWLEDGE['phone'];
            }
        }
        
        // If we have knowledge, build a detailed explanation
        if (knowledgeField) {
            let explanation = `**${fieldName}**: ${knowledgeField.purpose}\n\n`;
            
            // Special handling for password fields based on context
            if ((field.type === 'password' || fieldKey.includes('password')) && 
                knowledgeField.login_context && knowledgeField.registration_context) {
                
                // Determine if we're in a login or registration context
                const formContext = detectedFields.formContext || {};
                const formType = (formContext.form_type || '').toLowerCase();
                
                if (formType.includes('login') || formType.includes('sign in')) {
                    explanation += knowledgeField.login_context + '\n\n';
                } else if (formType.includes('register') || formType.includes('sign up') || 
                        formType.includes('create account')) {
                    explanation += knowledgeField.registration_context + '\n\n';
                    explanation += '**Strength Guidance**: ' + knowledgeField.strength_guidance + '\n\n';
                }
            }
            
            // Add details about format and examples if available
            if (knowledgeField.format) {
                explanation += `**Format**: ${knowledgeField.format}\n`;
            }
            
            if (knowledgeField.examples) {
                explanation += `**Examples**: ${knowledgeField.examples}\n`;
            }
            
            // Add info about whether it's required
            if (field.required) {
                explanation += `**Required**: Yes, this field must be filled in.\n`;
            } else if (knowledgeField.required) {
                explanation += `**Required**: ${knowledgeField.required}\n`;
            } else {
                explanation += `**Required**: This field appears to be optional.\n`;
            }
            
            // Privacy and security considerations
            if (knowledgeField.privacy) {
                explanation += `**Privacy**: ${knowledgeField.privacy}\n`;
            }
            
            if (knowledgeField.security) {
                explanation += `**Security Tip**: ${knowledgeField.security}`;
            }
            
            return explanation;
        }
        
        // Generic fallback if no specific knowledge is available
        let fallback = `This field is labeled "${fieldName}" and appears to be for entering ${fieldType} information.`;
        
        if (field.required) {
            fallback += " This field is required to submit the form.";
        } else {
            fallback += " This field appears to be optional.";
        }
        
        if (purpose) {
            fallback += ` Purpose: ${purpose}`;
        }
        
        return fallback;
    }

    // Generate a fallback response for when backend is unavailable
    function getFallbackResponse(message, fieldContext) {
        // Check if the message is asking about a specific field
        const lowercaseMessage = message.toLowerCase();
        
        // If we have a current field context, use that for field-specific questions
        if (fieldContext) {
            const fieldName = fieldContext.label || fieldContext.name || 'this field';
            
            // Check for common question patterns about fields
            if (lowercaseMessage.includes('what is') || lowercaseMessage.includes('explain')) {
                return getFallbackFieldExplanation(fieldContext);
            }
            
            if (lowercaseMessage.includes('required')) {
                return `${fieldName} ${fieldContext.required ? 'is required' : 'appears to be optional'} for this form.`;
            }
            
            if (lowercaseMessage.includes('fill') || lowercaseMessage.includes('enter') || 
                lowercaseMessage.includes('complete')) {
                return `For ${fieldName}, you should enter ${getExampleValue(fieldContext)}.`;
            }
            
            if (lowercaseMessage.includes('format') || lowercaseMessage.includes('example')) {
                return `For ${fieldName}, an appropriate format would be: ${getExampleValue(fieldContext)}.`;
            }
            
            // Generic response for other questions about the current field
            return `${fieldName} is a ${fieldContext.type} field${fieldContext.required ? ' that is required' : ''}. ${getFieldPurpose(fieldContext)}`;
        }
        
        // Check for help/assistance queries
        if (lowercaseMessage.includes('help') || lowercaseMessage.includes('assist') || 
            lowercaseMessage.includes('what can you do')) {
            return "I can help you understand this form and its fields. Click on any field to learn more about it, or ask me specific questions like 'What information should I enter here?' or 'Is this field required?'";
        }
        
        // Check for form-wide queries
        if (lowercaseMessage.includes('this form') || lowercaseMessage.includes('the form')) {
            if (detectedFields.formContext && detectedFields.formContext.form_type) {
                const formType = detectedFields.formContext.form_type.replace(' form', '').trim();
                const purpose = detectedFields.formContext.form_purpose || 'collecting information';
                return `This appears to be a ${formType} form for ${purpose}. It has ${detectedFields.length} field${detectedFields.length === 1 ? '' : 's'} that you need to fill out.`;
            } else {
                return `This form has ${detectedFields.length} field${detectedFields.length === 1 ? '' : 's'} that you need to fill out. Click on specific fields to learn more about them.`;
            }
        }
        
        // If asking about auto-filling
        if (lowercaseMessage.includes('auto') || lowercaseMessage.includes('fill all') || 
            lowercaseMessage.includes('fill out') || lowercaseMessage.includes('complete form')) {
            return "I can auto-fill the form with sample data. Click the 'Auto-fill Form' button in the fields panel to do this.";
        }
        
        // Generic response for other queries
        return "I can help you understand this form. You can click on any field to learn more about it, or ask me specific questions about the form or any field.";
    }

    // Generate an example value for a field based on its type
    function getExampleValue(field) {
        if (!field) return "appropriate information";
        
        const fieldType = field.type || 'text';
        const fieldName = field.name ? field.name.toLowerCase() : '';
        
        // Handle special field types
        switch (fieldType) {
            case 'email':
                return "your email address (e.g., john.doe@example.com)";
            case 'password':
                return "a secure password with a mix of letters, numbers, and symbols";
            case 'tel':
            case 'phone':
                return "your phone number (e.g., 555-123-4567)";
            case 'date':
                return "a date in the format YYYY-MM-DD";
            case 'number':
                return "a numeric value";
            case 'checkbox':
                return "check this if it applies to you";
            case 'radio':
                return "select the appropriate option";
            case 'textarea':
                return "your detailed message or comments";
            default:
                // Check field name for clues
                if (fieldName.includes('name')) {
                    if (fieldName.includes('first') || fieldName.includes('given')) {
                        return "your first name";
                    } else if (fieldName.includes('last') || fieldName.includes('family') || fieldName.includes('sur')) {
                        return "your last name";
                    } else {
                        return "your full name";
                    }
                } else if (fieldName.includes('address')) {
                    return "your street address";
                } else if (fieldName.includes('city')) {
                    return "your city or town";
                } else if (fieldName.includes('state') || fieldName.includes('province')) {
                    return "your state or province";
                } else if (fieldName.includes('zip') || fieldName.includes('postal')) {
                    return "your postal/zip code";
                } else if (fieldName.includes('country')) {
                    return "your country";
                }
                
                // Generic fallback
                return "the appropriate information";
        }
    }

    // Get a generic purpose description for a field
    function getFieldPurpose(field) {
        if (!field) return "";
        
        const fieldType = field.type || 'text';
        const fieldName = field.name ? field.name.toLowerCase() : '';
        
        // Handle special field types
        switch (fieldType) {
            case 'email':
                return "This is used for communication and account access.";
            case 'password':
                return "This protects your account from unauthorized access.";
            case 'tel':
            case 'phone':
                return "This may be used for account verification or contact purposes.";
            case 'date':
                return "This collects date information in a standardized format.";
            case 'checkbox':
                return "This allows you to indicate your preference or agreement.";
            case 'radio':
                return "This lets you select from predefined options.";
            case 'textarea':
                return "This allows you to enter longer text content.";
            default:
                // Check field name for clues
                if (fieldName.includes('name')) {
                    return "This is used for identification and personalization.";
                } else if (fieldName.includes('address') || fieldName.includes('city') || 
                        fieldName.includes('state') || fieldName.includes('zip') || 
                        fieldName.includes('country')) {
                    return "This is part of your address information.";
                }
                
                // Generic fallback
                return "This collects information needed for this form.";
        }
    }
});