// AI Form Helper panel.js - Enhanced with PDF processing and backend integration

document.addEventListener('DOMContentLoaded', function() {
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
        purpose: "Your first or given name for personalization and identification.",
        format: "Text, as it appears on your official documents.",
        examples: "John, Jane, Robert",
        required: "First names are typically required for personalization.",
        privacy: "Your first name may appear in your profile or communications.",
        security: "Use your legal first name for official forms."
      },
      "last_name": {
        purpose: "Your family name or surname for identification.",
        format: "Text, as it appears on your official documents.",
        examples: "Smith, Johnson, Williams",
        required: "Last names are typically required for identification.",
        privacy: "Your last name may appear in your profile or account information.",
        security: "Use your legal last name for official forms."
      },
      "phone": {
        purpose: "A contact number for verification, account recovery, or communication.",
        format: "Varies by country. In the US, typically (XXX) XXX-XXXX or XXX-XXX-XXXX.",
        examples: "555-123-4567, (555) 123-4567",
        required: "Phone numbers may be required for verification or security purposes.",
        privacy: "Your phone number may be used for account recovery or two-factor authentication.",
        security: "Use a reliable phone number you have regular access to."
      },
      "address": {
        purpose: "Your physical location for shipping, billing, or identification.",
        format: "Street number and name, often with apartment/unit number if applicable.",
        examples: "123 Main St, 456 Oak Ave Apt 7B",
        required: "Addresses are required for shipping, billing, or geographic verification.",
        privacy: "Your address may be used for location-based services or shipping.",
        security: "Ensure your address is current and accurate."
      },
      "city": {
        purpose: "The city component of your address.",
        format: "Text name of your city or town.",
        examples: "New York, San Francisco, Chicago",
        required: "City is typically required when an address is needed.",
        privacy: "Your city may be used for location-based services.",
        security: "Enter your city as it officially appears on mail or IDs."
      },
      "state": {
        purpose: "The state or province component of your address.",
        format: "In the US, typically a two-letter abbreviation.",
        examples: "CA, NY, TX, FL",
        required: "State is typically required when an address is needed.",
        privacy: "Your state may be used for location-based services or tax purposes.",
        security: "Use the standard abbreviation when applicable."
      },
      "zip": {
        purpose: "Postal code for mail delivery and location identification.",
        format: "In the US, a 5-digit code or 9-digit extended code (ZIP+4).",
        examples: "10001, 94107-2282",
        required: "ZIP codes are typically required for shipping and geographic verification.",
        privacy: "Your ZIP code may be used for location-based services.",
        security: "Ensure your ZIP code matches your address."
      },
      "country": {
        purpose: "The country component of your address.",
        format: "Full country name or standard country code.",
        examples: "United States, Canada, UK, Australia",
        required: "Country is typically required for international forms.",
        privacy: "Your country may be used for localization and geographic services.",
        security: "Select the country where you currently reside or hold citizenship."
      },
      "date_of_birth": {
        purpose: "Your birth date for age verification, identity confirmation, or personalization.",
        format: "Usually MM/DD/YYYY in the US or DD/MM/YYYY in many other countries.",
        examples: "01/15/1985, 15/01/1985",
        required: "Date of birth is often required for age verification or identity confirmation.",
        privacy: "Your birth date is sensitive personal information used for identity verification.",
        security: "Ensure the format matches what the form requires (MM/DD/YYYY vs DD/MM/YYYY)."
      },
      "username": {
        purpose: "A unique identifier you use to log into an account.",
        format: "Often alphanumeric, may allow special characters like underscores.",
        examples: "jsmith42, jane_doe, robert.williams",
        required: "Usernames are required for logging into your account.",
        privacy: "Your username may be visible to other users depending on the service.",
        security: "Choose something memorable but not too personally identifying."
      },
      "search": {
        purpose: "Enter keywords to find specific information.",
        format: "Free text input, supporting keywords and sometimes special operators.",
        examples: "coffee shops near me, javascript tutorials",
        required: "Search fields are optional but help you find specific content.",
        privacy: "Your search queries may be stored to improve search results.",
        security: "Avoid entering sensitive personal information in search fields."
      },
      "checkbox": {
        purpose: "Allows selecting or deselecting a specific option.",
        format: "Click to toggle between selected (checked) and not selected (unchecked).",
        examples: "Agree to terms, Subscribe to newsletter",
        required: "Some checkboxes may be required, especially for agreeing to terms.",
        privacy: "Check what you're agreeing to before selecting required checkboxes.",
        security: "Read associated text carefully before checking boxes."
      },
      "radio": {
        purpose: "Select a single option from a group of choices.",
        format: "Click to select. Only one option in a group can be selected at a time.",
        examples: "Gender selection, payment method choice",
        required: "Radio button groups are often required when a selection is necessary.",
        privacy: "Your selection indicates a preference that may be stored in your profile.",
        security: "Make sure you understand what each option means before selecting."
      },
      "textarea": {
        purpose: "Enter longer text responses or comments.",
        format: "Multi-line text field that can contain paragraphs and line breaks.",
        examples: "Comments, feedback, message content",
        required: "Text areas may be optional or required depending on the form.",
        privacy: "Be mindful of what personal information you share in comments.",
        security: "Avoid sharing sensitive information in public comments."
      },
      "college": {
        purpose: "This field is where you enter your college or university name.",
        format: "Enter the full official name of your college or university.",
        examples: "University of Phoenix, Harvard University, Stanford University",
        required: "College name is typically required for educational applications.",
        privacy: "Your educational information may be used for verification or eligibility.",
        security: "Use the official name as it appears on transcripts or diplomas."
      }
    };
  
    // Add field-specific knowledge that might not match standard types
    const SPECIFIC_FIELDS = {
      "email": FIELD_KNOWLEDGE.email,
      "mail": FIELD_KNOWLEDGE.email,
      "e-mail": FIELD_KNOWLEDGE.email,
      "emailaddress": FIELD_KNOWLEDGE.email,
      "password": FIELD_KNOWLEDGE.password,
      "pass": FIELD_KNOWLEDGE.password,
      "pwd": FIELD_KNOWLEDGE.password,
      "first_name": FIELD_KNOWLEDGE.first_name,
      "firstname": FIELD_KNOWLEDGE.first_name,
      "fname": FIELD_KNOWLEDGE.first_name,
      "last_name": FIELD_KNOWLEDGE.last_name,
      "lastname": FIELD_KNOWLEDGE.last_name,
      "lname": FIELD_KNOWLEDGE.last_name,
      "name": FIELD_KNOWLEDGE.name,
      "fullname": FIELD_KNOWLEDGE.name,
      "full_name": FIELD_KNOWLEDGE.name,
      "phone": FIELD_KNOWLEDGE.phone,
      "telephone": FIELD_KNOWLEDGE.phone,
      "tel": FIELD_KNOWLEDGE.phone,
      "mobile": FIELD_KNOWLEDGE.phone,
      "phone_number": FIELD_KNOWLEDGE.phone,
      "address": FIELD_KNOWLEDGE.address,
      "street": FIELD_KNOWLEDGE.address,
      "address1": FIELD_KNOWLEDGE.address,
      "address_line_1": FIELD_KNOWLEDGE.address,
      "city": FIELD_KNOWLEDGE.city,
      "town": FIELD_KNOWLEDGE.city,
      "state": FIELD_KNOWLEDGE.state,
      "province": FIELD_KNOWLEDGE.state,
      "region": FIELD_KNOWLEDGE.state,
      "zip": FIELD_KNOWLEDGE.zip,
      "zipcode": FIELD_KNOWLEDGE.zip,
      "postalcode": FIELD_KNOWLEDGE.zip,
      "postal": FIELD_KNOWLEDGE.zip,
      "country": FIELD_KNOWLEDGE.country,
      "nation": FIELD_KNOWLEDGE.country,
      "dob": FIELD_KNOWLEDGE.date_of_birth,
      "birth_date": FIELD_KNOWLEDGE.date_of_birth,
      "birthdate": FIELD_KNOWLEDGE.date_of_birth,
      "date_of_birth": FIELD_KNOWLEDGE.date_of_birth,
      "birthday": FIELD_KNOWLEDGE.date_of_birth,
      "user": FIELD_KNOWLEDGE.username,
      "username": FIELD_KNOWLEDGE.username,
      "userid": FIELD_KNOWLEDGE.username,
      "login": FIELD_KNOWLEDGE.username,
      "search": FIELD_KNOWLEDGE.search,
      "query": FIELD_KNOWLEDGE.search,
      "find": FIELD_KNOWLEDGE.search,
      "checkbox": FIELD_KNOWLEDGE.checkbox,
      "check": FIELD_KNOWLEDGE.checkbox,
      "radio": FIELD_KNOWLEDGE.radio,
      "option": FIELD_KNOWLEDGE.radio,
      "textarea": FIELD_KNOWLEDGE.textarea,
      "comment": FIELD_KNOWLEDGE.textarea,
      "message": FIELD_KNOWLEDGE.textarea,
      "college": FIELD_KNOWLEDGE.college,
      "university": FIELD_KNOWLEDGE.college,
      "school": FIELD_KNOWLEDGE.college
    };
  
    // Common questions and answers about forms
    const COMMON_QUESTIONS = {
      "what is this form for": "This appears to be a college application form where you'll enter your personal information to create an account or log in to an existing one.",
      "how long will this take": "This form should take about 5-10 minutes to complete, depending on how familiar you are with the requested information.",
      "is this secure": "This form is on a secure connection (https). Always make sure you're on the official website before entering personal information.",
      "what happens next": "After completing this form, you'll likely move to the next steps in the application process, such as providing educational history or selecting programs of interest.",
      "can i save and continue later": "Many application forms allow you to save your progress and continue later. Look for a 'Save' button or automatic saving indicators."
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
    const chatContainer = document.getElementById('chat-container');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const uploadContainer = document.querySelector('.upload-container') || createUploadContainer();
    const loaderContainer = document.createElement('div');
    loaderContainer.className = 'loader-container';
    loaderContainer.style.display = 'none';
    loaderContainer.innerHTML = `
      <div class="spinner"></div>
      <p id="loader-text">Processing form...</p>
    `;
    
    // Add loader container to DOM if not already present
    if (!document.querySelector('.loader-container')) {
      const main = document.querySelector('.main');
      if (main) {
        main.insertBefore(loaderContainer, chatContainer);
      }
    }

    // Create fixed action buttons container (NEW)
    const formActionsDiv = document.createElement('div');
    formActionsDiv.className = 'form-actions-fixed';
    formActionsDiv.style.cssText = `
      padding: 10px;
      background-color: white;
      border-top: 1px solid #ddd;
      border-bottom: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      z-index: 100;
      margin-bottom: 10px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      width: 100%;
    `;
    
    // Add auto-fill button (NEW)
    const autoFillButton = document.createElement('button');
    autoFillButton.id = 'autofill-button';
    autoFillButton.className = 'action-button';
    autoFillButton.style.cssText = `
      flex: 1;
      margin-right: 5px;
      padding: 10px;
      background-color: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    autoFillButton.textContent = 'Auto-fill All Fields';
    autoFillButton.addEventListener('click', autoFillAllFields);
    formActionsDiv.appendChild(autoFillButton);
    
    // Add upload PDF button (NEW)
    const uploadPdfFixedButton = document.createElement('button');
    uploadPdfFixedButton.id = 'upload-pdf-fixed-button';
    uploadPdfFixedButton.className = 'action-button secondary';
    uploadPdfFixedButton.style.cssText = `
      flex: 1;
      margin-left: 5px;
      padding: 10px;
      background-color: #f1f1f1;
      color: #333;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
    `;
    uploadPdfFixedButton.textContent = 'Upload PDF';
    uploadPdfFixedButton.addEventListener('click', triggerPdfUpload);
    formActionsDiv.appendChild(uploadPdfFixedButton);
    
    // Insert the fixed action buttons after the status message and before the fields container (NEW)
    const main = document.querySelector('.main');
    if (main && fieldsContainer) {
      main.insertBefore(formActionsDiv, fieldsContainer);
    } else if (document.body) {
      document.body.insertBefore(formActionsDiv, document.body.firstChild);
    }
  
    // Create upload container if it doesn't exist
    function createUploadContainer() {
      const container = document.createElement('div');
      container.className = 'upload-container';
      container.style.display = 'none';
      container.innerHTML = `
        <div class="upload-icon">📄</div>
        <div class="upload-text">
          <p>No form detected on this page.</p>
          <p>Upload a PDF form to get help filling it out.</p>
        </div>
        <button id="upload-button" class="upload-button">Upload PDF Form</button>
        <input type="file" id="pdf-upload" accept="application/pdf" style="display: none;">
      `;
      
      // Add to DOM
      const main = document.querySelector('.main');
      if (main) {
        main.insertBefore(container, chatContainer);
      }
      
      return container;
    }
  
    // Add PDF Upload elements if not already in HTML
    const pdfUpload = document.getElementById('pdf-upload') || createPdfUploadInput();
    const uploadButton = document.getElementById('upload-button') || createUploadButton();
    
    function createPdfUploadInput() {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'pdf-upload';
      input.accept = 'application/pdf';
      input.style.display = 'none';
      document.body.appendChild(input);
      return input;
    }
    
    function createUploadButton() {
      const button = document.createElement('button');
      button.id = 'upload-button';
      button.className = 'upload-button';
      button.textContent = 'Upload PDF Form';
      
      // If we have an upload container, add it there
      const container = document.querySelector('.upload-container');
      if (container) {
        container.appendChild(button);
      } else {
        document.body.appendChild(button);
      }
      
      return button;
    }
  
    // Profile management functions
    // Get or create user profile using Chrome storage
    async function getOrCreateProfile() {
        return new Promise((resolve) => {
            // Try to get the browser ID from localStorage first
            let userId = localStorage.getItem('formHelperUserId');
            if (!userId) {
                // Generate a unique ID if none exists
                userId = 'user_' + Date.now();
                localStorage.setItem('formHelperUserId', userId);
            }
            
            // Try to get the profile from Chrome storage
            chrome.storage.sync.get(['userProfile'], function(result) {
                if (result.userProfile && result.userProfile.user_id === userId) {
                    console.log('Profile loaded from Chrome storage:', result.userProfile);
                    resolve(result.userProfile);
                } else {
                    // Create a new profile if not found
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
        });
    }

    // Save field value to profile in Chrome storage
    async function saveFieldToProfile(fieldName, fieldValue) {
        if (!userProfile || !userProfile.user_id) {
            console.error('Cannot save field: profile not loaded');
            return;
        }
        
        try {
            // Update the field value in memory
            if (!userProfile.field_values) {
                userProfile.field_values = {};
            }
            
            userProfile.field_values[fieldName] = fieldValue;
            userProfile.updated_at = new Date().toISOString();
            
            // Save the updated profile to Chrome storage
            chrome.storage.sync.set({ userProfile: userProfile }, function() {
                console.log(`Saved ${fieldName} to profile in Chrome storage`);
            });
        } catch (error) {
            console.error('Error saving field to profile:', error);
        }
    }

    // Set initial status
    updateStatus('Scanning for forms...');

    // Combined initialization function
    async function initializeApp() {
        // Check server connection
        serverConnected = await checkServerConnection();
        
        // Get or create user profile (regardless of server connection status)
        try {
            userProfile = await getOrCreateProfile();
            console.log('User profile loaded:', userProfile);
            
            // Update UI to show profile is loaded
            if (userProfile && userProfile.display_name && statusText) {
                const connectionStatus = serverConnected ? 'Server Connected' : 'Server Disconnected';
                statusText.textContent = `${connectionStatus} | Profile: ${userProfile.display_name}`;
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            // Create a default in-memory profile if loading fails
            userProfile = {
                user_id: 'default_user_' + Date.now(),
                display_name: 'User',
                field_values: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }
        
        // Request form scan
        requestFormScan();
    }

    // Call the initialization function
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
    
    // Check if backend server is available
    async function checkServerConnection() {
      try {
        // Check forms API
        const formsResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FORMS_DEBUG}`);
        
        // Check AI API
        const aiResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AI_DEBUG}`);
        
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
            console.log('Server connection failed');
          }
        }
      } catch (error) {
        console.error('Error checking server connection:', error);
        serverConnected = false;
        
        // Update UI
        if (statusDot && statusText) {
          statusDot.classList.remove('connected');
          statusDot.classList.add('disconnected');
          statusText.textContent = 'Server Disconnected';
        }
      }
      
      return serverConnected;
    }
  
    // Request form scan from content script
    function requestFormScan() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) {
          updateStatus('No active tab found');
          showUploadContainer();
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {action: 'scanForms'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            updateStatus('Could not communicate with the page. Try uploading a PDF instead.');
            showUploadContainer();
            return;
          }
        });
      });
    }
    
    // Set up all event listeners
    function setupListeners() {
      // Remove existing listeners first
      chrome.runtime.onMessage.removeListener(handleMessage);
      
      // Add message listener for content script
      chrome.runtime.onMessage.addListener(handleMessage);
      
      // Chat form submission
      if (chatForm) {
        chatForm.removeEventListener('submit', handleChatSubmit);
        chatForm.addEventListener('submit', handleChatSubmit);
      }
      
      // PDF upload - connect both buttons to the same function
      if (uploadButton) {
        uploadButton.removeEventListener('click', triggerPdfUpload);
        uploadButton.addEventListener('click', triggerPdfUpload);
      }
      
      if (uploadPdfFixedButton) {
        uploadPdfFixedButton.removeEventListener('click', triggerPdfUpload);
        uploadPdfFixedButton.addEventListener('click', triggerPdfUpload);
      }
      
      if (pdfUpload) {
        pdfUpload.removeEventListener('change', handlePdfUpload);
        pdfUpload.addEventListener('change', handlePdfUpload);
      }
    }
    
    // Trigger PDF upload dialog
    function triggerPdfUpload() {
      if (pdfUpload) {
        pdfUpload.click();
      }
    }
    
    // Handle PDF file upload
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
      
      if (serverConnected) {
        try {
          await processPdfWithServer(file);
        } catch (error) {
          console.error('Error processing PDF with server:', error);
          addChatMessage('ai', 'There was an error processing the PDF. Please try again or use a different file.');
          hideLoader();
          isProcessingPdf = false;
        }
      } else {
        // Fallback to local processing (very limited)
        addChatMessage('ai', 'Server connection is not available. PDF processing requires server connection for OCR capabilities.');
        hideLoader();
        isProcessingPdf = false;
      }
    }
    
    // Process PDF with server
    async function processPdfWithServer(file) {
      // Create FormData
      const formData = new FormData();
      formData.append('content_type', file.type);
      formData.append('file', file);
      
      try {
        // Send to server
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROCESS_FORM_UPLOAD}`, {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('PDF processing result:', result);
        
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
          
          // Process like a regular form
          handleFormDetected(formData);
          
          // Add confirmation message
          addChatMessage('ai', `I've processed your PDF form and detected ${result.fields.length} fields. You can now ask questions about any field.`);
        } else {
          addChatMessage('ai', 'I couldn\'t detect any fields in this PDF. The document might be scanned at a low quality or doesn\'t contain form fields. Please try another PDF or a clearer scan.');
        }
      } catch (error) {
        console.error('Error processing PDF:', error);
        addChatMessage('ai', 'An error occurred while processing the PDF. Please try again with a different file or check your connection.');
        hideLoader();
      }
      
      // Reset flag
      isProcessingPdf = false;
    }
    
    // Show loading spinner
    function showLoader(message) {
      if (loaderContainer) {
        const loaderText = document.getElementById('loader-text');
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
  
    // Display fields in sidebar - MODIFIED to not add buttons inside this container
    function displayFields(fields) {
      if (!fieldsContainer) return;
      
      fieldsContainer.innerHTML = '';
      fieldsContainer.style.display = 'block';
      
      // Create a container for the fields (scrollable)
      const fieldsList = document.createElement('div');
      fieldsList.className = 'fields-list';
      fieldsList.style.cssText = `
        max-height: 300px;
        overflow-y: auto;
        padding-bottom: 10px;
      `;
      
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
      
      // Add the fields list to the fieldsContainer
      fieldsContainer.appendChild(fieldsList);
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
                }
            });
        });
    }
    
    // Handle auto-fill result
    function handleAutoFillResult(result) {
      if (result && result.success) {
        // Check if we have a profile with field values
        const hasProfileData = userProfile && 
                              userProfile.field_values && 
                              Object.keys(userProfile.field_values).length > 0;
                              
        // Provide feedback based on whether profile data was used
        const messageText = hasProfileData ? 
            `I've filled ${result.count} field${result.count === 1 ? '' : 's'} with your saved data where available, and sample data for the rest.` :
            `I've filled ${result.count} field${result.count === 1 ? '' : 's'} with sample data.`;
            
        addChatMessage('ai', messageText);
      } else {
        addChatMessage('ai', 'There was an issue auto-filling the form. Please try again or fill the form manually.');
      }
    }
  
    // Handle chat form submission
    function handleChatSubmit(e) {
      e.preventDefault();
      
      const input = document.getElementById('chat-input');
      const message = input.value.trim();
      
      if (!message) return;
      
      // Add user message to chat
      addChatMessage('user', message);
      
      // Clear input
      input.value = '';
      
      // Special handling for "what is this form for" question
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('what') && 
          lowerMessage.includes('form') && 
          (lowerMessage.includes('for') || lowerMessage.includes('about') || lowerMessage.includes('is this'))) {
          
        // Add a temporary "thinking" message
        const thinkingId = 'thinking-' + Date.now();
        addChatMessage('ai', 'Analyzing form...', thinkingId);
        
        // Special handling to directly ask the content script about the form
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs && tabs.length > 0) {
            // Send message directly to content script
            chrome.tabs.sendMessage(
              tabs[0].id, 
              {action: 'getFormContextResponse', question: message},
              function(response) {
                // Remove the thinking message
                const thinkingElement = document.getElementById(thinkingId);
                if (thinkingElement) {
                  thinkingElement.remove();
                }
                
                if (response && response.formContextResponse) {
                  // Success: add the response
                  addChatMessage('ai', response.formContextResponse);
                } else {
                  // Fall back to standard AI response
                  getAIResponse(message).then(result => {
                    addChatMessage('ai', result);
                  }).catch(error => {
                    console.error('Error getting fallback response:', error);
                    addChatMessage('ai', "This appears to be a form for collecting information. I can help you understand specific fields if you have questions about them.");
                  });
                }
              }
            );
          } else {
            // No tab found, remove thinking message
            const thinkingElement = document.getElementById(thinkingId);
            if (thinkingElement) {
              thinkingElement.remove();
            }
            
            // Use standard AI response
            getAIResponse(message).then(result => {
              addChatMessage('ai', result);
            }).catch(error => {
              console.error('Error getting response:', error);
              addChatMessage('ai', "I'm sorry, I couldn't determine what this form is for. Please ask about specific fields if you need help with them.");
            });
          }
        });
        
        return; // Skip the standard AI response flow
      }
      
      // Standard flow for other questions
      
      // Add a temporary "thinking" message
      const thinkingId = 'thinking-' + Date.now();
      addChatMessage('ai', 'Thinking...', thinkingId);
      
      // Get AI response (from server if available, otherwise fallback)
      getAIResponse(message).then(response => {
        // Remove the thinking message
        const thinkingElement = document.getElementById(thinkingId);
        if (thinkingElement) {
          thinkingElement.remove();
        }
        
        // Add AI response to chat
        addChatMessage('ai', response);
      }).catch(error => {
        console.error('Error getting AI response:', error);
        
        // Remove the thinking message
        const thinkingElement = document.getElementById(thinkingId);
        if (thinkingElement) {
          thinkingElement.remove();
        }
        
        // Add error message
        addChatMessage('ai', "I'm sorry, I couldn't generate a response. Please try asking another question.");
      });
    }
  
    // Get AI response to user question
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
          
          // We'll just use the regular AI endpoint with our enhanced context
          // The backend will use the best available AI system (Smart, Hybrid or Legacy) to process this
          
          // Call regular AI endpoint as fallback
          const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ASK}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('AI response from server:', data);
            return data.response || data.answer;
          } else {
            console.warn('Server response not OK:', response.status);
            // Fall back to local processing
          }
        } catch (error) {
          console.error('Error getting AI response from server:', error);
          // Fall back to local processing
        }
      }
      
      // Fallback to local processing
      console.log('Using fallback AI response');
      // Handle the async fallback function properly
      return await getFallbackAIResponse(question);
    }
    
    // Fallback AI response using local knowledge base
    // Now returns a promise for async handling
    async function getFallbackAIResponse(question) {
      const questionLower = question.toLowerCase();
      
      // Check if it's about form context
      if ((questionLower.includes('what') || questionLower.includes('which')) && 
          (questionLower.includes('form') || questionLower.includes('page')) &&
          (questionLower.includes('is this') || questionLower.includes('type') || 
           questionLower.includes('kind') || questionLower.includes('purpose'))) {
        
        return await getFormContextResponse(question);
      }
      
      // Check if it's about a specific field
      if (currentFieldContext) {
        const fieldName = currentFieldContext.label || currentFieldContext.name || 'this field';
        const fieldNameLower = fieldName.toLowerCase();
        
        // If question mentions the current field
        if (questionLower.includes(fieldNameLower) || 
            questionLower.includes('this field') || 
            questionLower.includes('the field') ||
            questionLower.includes('field')) {
            
          // Get field-specific response
          return getFieldResponse(currentFieldContext, question);
        }
      }
      
      // Check predefined questions
      for (const [key, value] of Object.entries(COMMON_QUESTIONS)) {
        if (questionLower.includes(key)) {
          return value;
        }
      }
      
      // Check if about specific field types
      for (const [key, value] of Object.entries(SPECIFIC_FIELDS)) {
        if (questionLower.includes(key)) {
          // Determine which aspect they're asking about
          if (questionLower.includes('what') || questionLower.includes('why') || questionLower.includes('purpose')) {
            return value.purpose;
          } else if (questionLower.includes('format') || questionLower.includes('how')) {
            return `${value.format} Examples: ${value.examples}`;
          } else if (questionLower.includes('require') || questionLower.includes('need')) {
            return value.required;
          } else if (questionLower.includes('privacy') || questionLower.includes('use')) {
            return value.privacy;
          } else if (questionLower.includes('secure') || questionLower.includes('safe')) {
            return value.security;
          } else {
            return value.purpose;
          }
        }
      }
      
      // Generic responses for form questions
      if (questionLower.includes('form')) {
        return await getFormContextResponse(question);
      } else if (questionLower.includes('help')) {
        return "I can help you understand what different fields are for and how to fill them out correctly. Click on any field to see more information, or ask me a specific question.";
      } else if (questionLower.includes('auto') && questionLower.includes('fill')) {
        return "Click the 'Auto-fill All Fields' button to automatically fill out the form with sample data. This can be useful for testing or quickly completing the form.";
      } else if (questionLower.includes('pdf')) {
        return "You can upload a PDF form by clicking the 'Upload PDF' button. I'll analyze the form and help you understand the fields it contains.";
      } else if (questionLower.includes('personal') && questionLower.includes('info')) {
        return "Personal information is collected to identify you and communicate with you. This typically includes your name, contact information, and sometimes demographic details.";
      }
      
      // Default response
      return "I can help you understand this form better. Feel free to ask about specific fields or the purpose of this form. You can also click on any field in the list to get information about it.";
    }
    
    // Get a response about the form context
    // Changed to return a Promise that resolves with the response
    async function getFormContextResponse(question) {
      console.log("Getting form context response for question:", question);
      
      // Check if we have detected form context
      const formContext = getCurrentFormContext();
      console.log("Current form context:", formContext);
      
      // Use a Promise to handle async communication with content script
      return new Promise((resolve) => {
        // Try to get a response from content script first
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          try {
            // Get the current tab to access content script
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              if (tabs && tabs.length > 0) {
                console.log("Sending message to content script in tab:", tabs[0].id);
                
                // Set a timeout to ensure we don't wait forever
                const timeoutId = setTimeout(() => {
                  console.log("Content script response timed out, using local fallback");
                  resolve(generateLocalFormResponse(question, formContext));
                }, 1000);
                
                // Try to use the formContextAnalyzer from the content script
                chrome.tabs.sendMessage(
                  tabs[0].id, 
                  {action: 'getFormContextResponse', question: question},
                  function(response) {
                    clearTimeout(timeoutId); // Clear the timeout
                    console.log("Received response from content script:", response);
                    
                    if (response && response.formContextResponse) {
                      resolve(response.formContextResponse);
                    } else {
                      // Fall back to local processing
                      resolve(generateLocalFormResponse(question, formContext));
                    }
                  }
                );
              } else {
                // No tabs found, use local fallback
                resolve(generateLocalFormResponse(question, formContext));
              }
            });
          } catch (error) {
            console.error('Error getting form context response from content script:', error);
            // Continue to fallback
            resolve(generateLocalFormResponse(question, formContext));
          }
        } else {
          // Chrome API not available, use local fallback
          resolve(generateLocalFormResponse(question, formContext));
        }
      });
    }
    
    // Generate a form response with the local context
    function generateLocalFormResponse(question, formContext) {
      console.log("Generating local form response with context:", formContext);
      
      // If we have valid form context
      if (formContext && formContext.form_type && formContext.form_type !== "unknown form") {
        // Construct a response based on the available context
        const formType = formContext.form_type.replace(" form", "").trim();
        
        // Questions about form type/what kind of form
        if ((question.toLowerCase().includes('what') || question.toLowerCase().includes('which')) && 
            (question.toLowerCase().includes('kind') || question.toLowerCase().includes('type'))) {
          
          const fieldCount = Array.isArray(detectedFields) ? detectedFields.length : 'multiple';
          return `This is a ${formType} form for ${formContext.form_purpose || 'collecting information'}. It contains ${fieldCount} fields, including ${getMainFieldTypes(detectedFields)}.`;
        }
        
        // Questions about form purpose
        if (question.toLowerCase().includes('purpose') || 
            (question.toLowerCase().includes('what') && question.toLowerCase().includes('for'))) {
          
          return `This ${formType} form is for ${formContext.form_purpose || 'collecting information'}. You'll need to fill out the required fields to ${getFormAction(formType)}.`;
        }
        
        // Default form context response
        return `This is a ${formType} form for ${formContext.form_purpose || 'collecting information'}.`;
      }
      
      // Check fields to make an educated guess about form type
      if (detectedFields && Array.isArray(detectedFields) && detectedFields.length > 0) {
        // Simple form type detection based on fields
        const hasPassword = detectedFields.some(f => 
          (f.type === 'password') || (f.name && f.name.toLowerCase().includes('password'))
        );
        
        const hasEmail = detectedFields.some(f => 
          (f.type === 'email') || (f.name && f.name.toLowerCase().includes('email'))
        );
        
        const hasMessage = detectedFields.some(f => 
          (f.name && f.name.toLowerCase().includes('message')) || 
          (f.type === 'textarea')
        );
        
        if (hasPassword && hasEmail) {
          return "This appears to be a login or registration form where you can enter your credentials to access or create an account. I can help explain any of the fields if you're unsure about them.";
        } else if (hasEmail && hasMessage) {
          return "This appears to be a contact form where you can send a message to the website owner or organization. I can help explain any of the fields if you're unsure about them.";
        }
      }
      
      // Very generic fallback if no context is available
      return "This appears to be a form collecting your information. You'll need to fill out the fields to proceed. I can help explain any field you're unsure about.";
    }
    
    // Get a summary of the main field types in the form
    function getMainFieldTypes(fields) {
      // Ensure fields is an array and not empty
      if (!fields || !Array.isArray(fields) || fields.length === 0) return 'various fields';
      
      const fieldTypes = {};
      
      // Count occurrences of each field type
      fields.forEach(field => {
        if (field && typeof field === 'object') {
          const type = field.purpose || field.type || 'text';
          fieldTypes[type] = (fieldTypes[type] || 0) + 1;
        }
      });
      
      // If no field types were processed, return early
      if (Object.keys(fieldTypes).length === 0) return 'various fields';
      
      // Get the top 3 most common field types
      const topTypes = Object.entries(fieldTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
      
      if (topTypes.length === 0) return 'various fields';
      if (topTypes.length === 1) return topTypes[0] + ' fields';
      if (topTypes.length === 2) return topTypes[0] + ' and ' + topTypes[1] + ' fields';
      return topTypes[0] + ', ' + topTypes[1] + ', and ' + topTypes[2] + ' fields';
    }
    
    // Get the typical action for a form type
    function getFormAction(formType) {
      switch(formType.toLowerCase()) {
        case 'login':
          return 'sign in to your account';
        case 'registration':
          return 'create a new account';
        case 'contact':
          return 'send your message or inquiry';
        case 'checkout':
        case 'payment':
          return 'complete your purchase';
        case 'search':
          return "find what you're looking for";
        case 'survey':
          return 'submit your feedback';
        case 'subscription':
          return 'sign up for updates';
        case 'upload':
          return 'upload your files';
        default:
          return 'submit the form';
      }
    }
    
    // Get the current form context
    function getCurrentFormContext() {
      try {
        // First check if we have it directly in the formData structure
        if (currentFormId) {
          // Check if formContext is directly available in detectedFields
          if (detectedFields && detectedFields.formContext) {
            console.log("Found form context directly in detectedFields:", detectedFields.formContext);
            return detectedFields.formContext;
          }
        }
        
        // If we didn't find it there, try to extract it from the data we have
        const formData = getStoredFormData();
        if (formData && formData.formContext) {
          console.log("Found form context in stored data:", formData.formContext);
          return formData.formContext;
        }
        
        // Check if we have window.formData 
        if (window.formData && window.formData.formContext) {
          console.log("Found form context in window.formData:", window.formData.formContext);
          return window.formData.formContext;
        }
        
        // If still no context found, create a basic context from what we know
        if (detectedFields && Array.isArray(detectedFields) && detectedFields.length > 0) {
          // Analyze fields to determine form type
          const hasPassword = detectedFields.some(f => f.type === 'password' || (f.name && f.name.toLowerCase().includes('password')));
          const hasEmail = detectedFields.some(f => f.type === 'email' || (f.name && f.name.toLowerCase().includes('email')));
          const hasText = detectedFields.some(f => f.type === 'textarea' || (f.name && f.name.toLowerCase().includes('message')));
          
          let formType = "unknown form";
          let formPurpose = "collecting information";
          
          if (hasPassword && hasEmail) {
            formType = hasPassword && detectedFields.some(f => 
              f.name && (f.name.toLowerCase().includes('confirm') || f.name.toLowerCase().includes('signup'))) 
              ? "registration form" 
              : "login form";
            formPurpose = formType === "registration form" 
              ? "creating a new account" 
              : "signing into an existing account";
          } else if (hasEmail && hasText) {
            formType = "contact form";
            formPurpose = "sending a message to the website owner";
          } else if (detectedFields.some(f => 
            f.name && (f.name.toLowerCase().includes('payment') || f.name.toLowerCase().includes('card') || 
                      f.name.toLowerCase().includes('credit') || f.name.toLowerCase().includes('checkout')))) {
            formType = "payment form";
            formPurpose = "processing a payment or checkout";
          }
          
          console.log("Created basic form context from field analysis");
          return {
            form_type: formType,
            form_purpose: formPurpose,
            confidence: 0.7,
            fields_count: detectedFields.length
          };
        }
      } catch (error) {
        console.error("Error retrieving form context:", error);
      }
      
      // If all else fails, return a minimal generic context
      console.log("No form context found, using generic context");
      return {
        form_type: "web form",
        form_purpose: "collecting information",
        confidence: 0.5
      };
    }
    
    // Helper to get form data from storage
    function getStoredFormData() {
      // Check if we have global form data
      if (window.formData) {
        return window.formData;
      }
      
      // Check the detectedFields array if it has formContext
      if (detectedFields) {
        if (Array.isArray(detectedFields)) {
          // It's just fields array, construct basic context
          return {
            formId: currentFormId,
            fields: detectedFields,
            formContext: {
              form_type: "form",
              form_purpose: "collecting information",
              confidence: 0.5
            }
          };
        } else {
          // It might be the full data structure
          return detectedFields;
        }
      }
      
      return null;
    }
  
    // Get explanation for a specific field
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
          
          // Call regular server
          const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ASK}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Field explanation from server:', data);
            return data.response || data.answer;
          } else {
            console.warn('Server response not OK:', response.status);
            // Fall back to local processing
          }
        } catch (error) {
          console.error('Error getting field explanation from server:', error);
          // Fall back to local processing
        }
      }
      
      // Fallback to local knowledge base
      const fieldType = field.type || 'text';
      const fieldName = field.label || field.name || 'this field';
      const fieldNameLower = fieldName.toLowerCase();
      
      // Check for specific field matches first
      for (const [key, value] of Object.entries(SPECIFIC_FIELDS)) {
        if (fieldNameLower.includes(key)) {
          return value.purpose;
        }
      }
      
      // Check field type
      if (FIELD_KNOWLEDGE[fieldType]) {
        return FIELD_KNOWLEDGE[fieldType].purpose;
      }
      
      // Default explanation
      return `This field is for entering your ${fieldName.toLowerCase()}. It helps the organization collect the information they need to process your application or request.`;
    }
  
    // Get response to question about specific field
    function getFieldResponse(field, question) {
      const questionLower = question.toLowerCase();
      const fieldType = field.type || 'text';
      const fieldName = field.label || field.name || 'this field';
      const fieldNameLower = fieldName.toLowerCase();
      
      // Special handling for password fields with context awareness
      if (fieldType === 'password' || fieldNameLower.includes('password')) {
        return getPasswordFieldResponse(field, question);
      }
      
      // Find the right knowledge base entry
      let knowledgeEntry = null;
      
      // Check specific fields first
      for (const [key, value] of Object.entries(SPECIFIC_FIELDS)) {
        if (fieldNameLower.includes(key)) {
          knowledgeEntry = value;
          break;
        }
      }
      
      // Fall back to field type
      if (!knowledgeEntry && FIELD_KNOWLEDGE[fieldType]) {
        knowledgeEntry = FIELD_KNOWLEDGE[fieldType];
      }
      
      // If we have knowledge, determine which aspect they're asking about
      if (knowledgeEntry) {
        if (questionLower.includes('what') || questionLower.includes('why') || questionLower.includes('purpose') || questionLower.includes('used for')) {
          return knowledgeEntry.purpose;
        } else if (questionLower.includes('format') || questionLower.includes('how')) {
          return `${knowledgeEntry.format} Examples: ${knowledgeEntry.examples}`;
        } else if (questionLower.includes('required') || questionLower.includes('need')) {
          return field.required ? 
            `Yes, the ${fieldName} field is required and must be filled out.` : 
            `No, the ${fieldName} field appears to be optional, but it's generally good to provide this information if you can.`;
        } else if (questionLower.includes('privacy') || questionLower.includes('use')) {
          return knowledgeEntry.privacy;
        } else if (questionLower.includes('secure') || questionLower.includes('safe')) {
          return knowledgeEntry.security;
        } else if (questionLower.includes('example')) {
          return `Examples for ${fieldName}: ${knowledgeEntry.examples}`;
        }
      }
      
      // Field-specific generic response if no knowledge base entry
      return `The ${fieldName} field is where you enter your ${fieldName.toLowerCase()}. This helps identify you and process your application correctly.`;
    }
    
    // Special handler for password fields with context awareness
    function getPasswordFieldResponse(field, question) {
      const questionLower = question.toLowerCase();
      const fieldName = field.label || field.name || 'password field';
      
      // If the field already has formType from our enhanced analyzer, use it
      if (field.formType) {
        const formContext = field.formType;
        // Pass through to specific function
        return generatePasswordResponse(field, question, formContext, fieldName);
      }
      
      // Otherwise do our own detection
      let formContext = "unknown";
      
      // Check if we have form context information
      if (detectedFields && detectedFields.length > 0) {
        // Look for indicators of registration vs login
        const hasConfirmPassword = detectedFields.some(f => {
          const name = (f.name || '').toLowerCase();
          const label = (f.label || '').toLowerCase();
          return (name.includes('confirm') && name.includes('password')) || 
                 (label.includes('confirm') && label.includes('password'));
        });
        
        const hasTermsCheckbox = detectedFields.some(f => {
          const name = (f.name || '').toLowerCase();
          const label = (f.label || '').toLowerCase();
          return (name.includes('terms') || name.includes('agree')) || 
                 (label.includes('terms') || label.includes('agree'));
        });
        
        const hasForgotPassword = detectedFields.some(f => {
          const name = (f.name || '').toLowerCase();
          const label = (f.label || '').toLowerCase();
          return name.includes('forgot') || label.includes('forgot password');
        });
        
        if (hasConfirmPassword || hasTermsCheckbox) {
          formContext = "registration";
        } else if (hasForgotPassword || (detectedFields.length <= 3)) {
          formContext = "login";
        }
      }
      
      return generatePasswordResponse(field, question, formContext, fieldName);
    }
    
    // Helper function to generate password responses based on context and question
    function generatePasswordResponse(field, question, formContext, fieldName) {
      const questionLower = question.toLowerCase();
      const passwordKnowledge = FIELD_KNOWLEDGE.password;
      
      // Check for specific questions about the password field
      if (questionLower.includes('required') || questionLower.includes('need') || 
          questionLower.includes('must') || questionLower.includes('optional')) {
        return `Yes, the ${fieldName} is required for security purposes. Password fields must always be completed.`;
      }
      
      if (questionLower.includes('what') || questionLower.includes('why') || 
          questionLower.includes('purpose') || questionLower.includes('used for')) {
        if (formContext === "registration") {
          return passwordKnowledge.registration_context;
        } else if (formContext === "login") {
          return passwordKnowledge.login_context;
        } else {
          return passwordKnowledge.purpose;
        }
      }
      
      if (questionLower.includes('how') || questionLower.includes('format') || 
          questionLower.includes('many') || questionLower.includes('characters')) {
        return passwordKnowledge.format;
      }
      
      if (questionLower.includes('strong') || questionLower.includes('secure') || 
          questionLower.includes('good') || questionLower.includes('strength')) {
        return passwordKnowledge.strength_guidance;
      }
      
      if (questionLower.includes('safe') || questionLower.includes('security')) {
        return passwordKnowledge.security;
      }
      
      if (questionLower.includes('privacy') || questionLower.includes('share')) {
        return passwordKnowledge.privacy;
      }
      
      // Default context-aware response
      if (formContext === "registration") {
        return passwordKnowledge.registration_context + " " + passwordKnowledge.strength_guidance;
      } else if (formContext === "login") {
        return passwordKnowledge.login_context + " If you've forgotten your password, look for a 'Forgot Password' link near the login form.";
      } else {
        return passwordKnowledge.purpose + " " + passwordKnowledge.security;
      }
    }
  
    // Add message to chat
    function addChatMessage(sender, text, messageId = null) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `chat-message ${sender}-message`;
      
      // Add unique ID if provided
      if (messageId) {
        messageDiv.id = messageId;
      }
      
      if (sender === 'ai') {
        // Format AI messages with simple markdown
        let formattedText = text;
        
        // Bold: **text** -> <strong>text</strong>
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic: *text* -> <em>text</em>
        formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Line breaks
        formattedText = formattedText.replace(/\n/g, '<br>');
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
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