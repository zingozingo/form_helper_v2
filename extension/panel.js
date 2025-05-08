// AI Form Helper panel.js - Enhanced UI version

// Ensure the DOM is fully loaded before initializing
document.addEventListener('DOMContentLoaded', function() {
    console.log("Panel.js: DOMContentLoaded triggered");
    
    // Debug button visibility
    console.log("Checking buttons in DOM:");
    const allButtons = document.querySelectorAll('button');
    console.log(`Found ${allButtons.length} button elements:`, allButtons);
    
    // Look for specific buttons
    const sendBtn = document.getElementById('send-button');
    const autofillBtn = document.getElementById('autofill-button');
    const autofillProfileBtn = document.getElementById('autofill-profile');
    const uploadPdfBtn = document.getElementById('upload-pdf-button');
    const helpBtn = document.getElementById('help-button');
    
    console.log("Button visibility check:", {
        "send-button": sendBtn ? "Found" : "Missing",
        "autofill-button": autofillBtn ? "Found" : "Missing",
        "autofill-profile": autofillProfileBtn ? "Found" : "Missing",
        "upload-pdf-button": uploadPdfBtn ? "Found" : "Missing",
        "help-button": helpBtn ? "Found" : "Missing"
    });
    
    // API Configuration
    const API_CONFIG = {
        BASE_URL: 'http://localhost:8000',
        ENDPOINTS: {
            PROCESS_FORM: '/api/process-form',
            ASK: '/api/ask',
            PROFILE_GET: '/api/profiles/',
            PROFILE_CREATE: '/api/profiles/create',
            PROFILE_UPDATE: '/api/profiles/update'
        }
    };
    
    // Field type to icon mapping
    const FIELD_ICONS = {
        'text': 'text_fields',
        'email': 'email',
        'password': 'password',
        'tel': 'phone',
        'number': 'pin',
        'date': 'calendar_today',
        'select': 'arrow_drop_down_circle',
        'checkbox': 'check_box',
        'radio': 'radio_button_checked',
        'file': 'attach_file',
        'textarea': 'subject',
        'url': 'link',
        'search': 'search',
        'time': 'access_time',
        'color': 'palette',
        'range': 'tune',
        'default': 'input'
    };
    
    // Common validation patterns
    const VALIDATION_PATTERNS = {
        'email': [
            { 
                pattern: 'Must contain @ symbol',
                example: 'example@domain.com'
            }
        ],
        'password': [
            {
                pattern: 'At least 8 characters',
                example: 'Use a strong password with mixed characters'
            }
        ],
        'tel': [
            {
                pattern: 'Numbers only',
                example: '1234567890'
            }
        ]
    };
    
    // UI Elements
    const container = document.querySelector('.container');
    const fieldsPanel = document.getElementById('fields-panel');
    const fieldsList = document.getElementById('fields-list');
    const fieldsCount = document.getElementById('fields-count');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInputField = document.getElementById('chat-input-field');
    const sendButton = document.getElementById('send-button');
    const autofillButton = document.getElementById('autofill-button');
    const autofillProfileButton = document.getElementById('autofill-profile');
    const uploadPdfButton = document.getElementById('upload-pdf-button');
    const panelToggle = document.getElementById('panel-toggle');
    const typingIndicator = document.getElementById('typing-indicator');
    const activeFieldIndicator = document.getElementById('active-field-indicator');
    const activeFieldName = document.getElementById('active-field-name');
    const suggestionChips = document.getElementById('suggestion-chips');
    const helpButton = document.getElementById('help-button');
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const closeModalButton = document.querySelector('.close-button');
    const highContrastToggle = document.getElementById('high-contrast-toggle');
    const profileAddButton = document.getElementById('profile-add');
    const profileSelector = document.getElementById('profile-selector');
    
    // State variables
    let currentFormData = null;
    let formFields = [];
    let lastSystemMessage = null;
    let currentFieldIndex = null;
    let isTyping = false;
    let profiles = {
        'default': {
            name: 'Default Profile',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '1234567890',
            address: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zip: '12345'
        }
    };
    
    // Initialize panel by scanning for forms
    function initPanel() {
        // Add event listeners
        setupEventListeners();
        
        // Initialize markdown renderer
        initializeMarkdown();
        
        // Load user preferences
        loadPreferences();
        
        // Request form scan from content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'scanForms'}, function(response) {
                    console.log('Scan forms response:', response);
                });
            }
        });
    }
    
    // Initialize markdown renderer
    function initializeMarkdown() {
        if (typeof marked !== 'undefined') {
            // Configure marked options
            marked.setOptions({
                breaks: true,
                gfm: true
            });
        } else {
            console.warn('Marked library not loaded');
        }
    }
    
    // Load user preferences from storage
    function loadPreferences() {
        chrome.storage.sync.get(['highContrast', 'profiles'], function(result) {
            // Set high contrast if enabled
            if (result.highContrast) {
                document.body.classList.add('high-contrast');
            }
            
            // Load saved profiles
            if (result.profiles) {
                profiles = result.profiles;
                updateProfileSelector();
            }
        });
    }
    
    // Save user preferences to storage
    function savePreferences() {
        chrome.storage.sync.set({
            highContrast: document.body.classList.contains('high-contrast'),
            profiles: profiles
        });
    }
    
    // Set up all event listeners
    function setupEventListeners() {
        // Chat form submission
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const userMessage = chatInputField.value.trim();
            if (userMessage) {
                addMessage('user', userMessage);
                chatInputField.value = '';
                
                // Show typing indicator
                showTypingIndicator();
                
                // Process the user's message
                processUserMessage(userMessage);
            }
        });
        
        // Fallback command input (disabled - using side panel instead)
        /* Command input functionality has been removed */
        
        // Auto-fill button
        if (autofillButton) {
            console.log("Adding click handler to autofillButton:", autofillButton);
            autofillButton.addEventListener('click', function() {
                console.log("autofillButton clicked!");
                animateButton(autofillButton);
                autoFillForm();
            });
        } else {
            console.error("Cannot add click handler - autofillButton not found in DOM");
        }
        
        // Auto-fill with profile button
        autofillProfileButton.addEventListener('click', function() {
            animateButton(autofillProfileButton);
            const profileId = profileSelector.value;
            if (profileId && profiles[profileId]) {
                autoFillFormWithProfile(profileId);
            } else {
                addMessage('system', 'Please select a profile first');
            }
        });
        
        // Profile selector change
        profileSelector.addEventListener('change', function() {
            const profileId = profileSelector.value;
            if (profileId && profiles[profileId]) {
                addMessage('system', `Selected profile: ${profiles[profileId].name}`);
            }
        });
        
        // Add profile button
        profileAddButton.addEventListener('click', function() {
            animateButton(profileAddButton);
            // This would open a modal to create a profile in a more complete version
            addMessage('system', 'Profile creation coming soon!');
        });
        
        // Upload PDF button
        uploadPdfButton.addEventListener('click', function() {
            animateButton(uploadPdfButton);
            // This would be implemented in a more complete version
            addMessage('system', 'PDF upload functionality coming soon!');
        });
        
        // Panel toggle
        panelToggle.addEventListener('click', function() {
            togglePanel();
        });
        
        // Help button (keyboard shortcuts)
        helpButton.addEventListener('click', function() {
            animateButton(helpButton);
            toggleShortcutsModal(true);
        });
        
        // Close modal button
        closeModalButton.addEventListener('click', function() {
            toggleShortcutsModal(false);
        });
        
        // High contrast toggle
        highContrastToggle.addEventListener('click', function() {
            animateButton(highContrastToggle);
            document.body.classList.toggle('high-contrast');
            savePreferences();
            addMessage('system', document.body.classList.contains('high-contrast') ? 
                'High contrast mode enabled' : 'High contrast mode disabled');
        });
        
        // Suggestion chips
        const chips = suggestionChips.querySelectorAll('.chip');
        chips.forEach(chip => {
            chip.addEventListener('click', function() {
                const question = chip.dataset.value;
                chatInputField.value = question;
                chatInputField.focus();
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // ? key to show shortcuts
            if (e.key === '?') {
                toggleShortcutsModal(true);
            }
            
            // Escape key to close modals
            if (e.key === 'Escape') {
                toggleShortcutsModal(false);
            }
            
            // Alt + F to focus on fields panel
            if (e.altKey && e.key === 'f') {
                if (fieldsList.firstElementChild) {
                    fieldsList.firstElementChild.focus();
                }
            }
            
            // Alt + C to focus on chat input
            if (e.altKey && e.key === 'c') {
                chatInputField.focus();
            }
            
            // Alt + A to auto-fill
            if (e.altKey && e.key === 'a') {
                autoFillForm();
            }
            
            // Alt + P to toggle panel
            if (e.altKey && e.key === 'p') {
                togglePanel();
            }
        });
        
        // Click outside modal to close
        shortcutsModal.addEventListener('click', function(e) {
            if (e.target === shortcutsModal) {
                toggleShortcutsModal(false);
            }
        });
        
        // Listen for messages from content scripts
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            console.log('📣 Panel received message:', request);
            
            // Debug: Log full message details
            if (request.formData) {
                console.log('📊 Form Data Details:', {
                    formId: request.formData.formId,
                    fields: request.formData.fields?.length || 0,
                    formType: request.formData.formType,
                    methods: request.formData.detectionMethod || request.formData.detectionMethods
                });
            }
            
            if (request.action === 'formDetected') {
                console.log('🔄 Processing formDetected message with', 
                            request.formData?.fields?.length || 0, 'fields');
                handleFormDetected(request.formData);
                sendResponse({received: true, status: 'processed formDetected'});
            }
            else if (request.action === 'formDataUpdated') {
                console.log('🔄 Processing formDataUpdated message with', 
                            request.formData?.fields?.length || 0, 'fields');
                handleFormDetected(request.formData);
                sendResponse({received: true, status: 'processed formDataUpdated'});
            }
            else if (request.action === 'formsFound') {
                console.log('🔄 Processing formsFound message with', 
                            request.details?.fieldsCount || 0, 'fields');
                
                // This is just a notification without data, wait for the formDetected message
                sendResponse({received: true, status: 'acknowledged formsFound'});
            }
            else if (request.action === 'noFormsFound') {
                console.log('🔄 Processing noFormsFound message');
                showNoFormsMessage();
                sendResponse({received: true, status: 'processed noFormsFound'});
            }
            else if (request.action === 'testMessage') {
                console.log('🧪 TEST MESSAGE RECEIVED:', request.message);
                sendResponse({received: true, status: 'test message acknowledged'});
            }
            
            return true;
        });
    }
    
    // Show/hide the shortcuts modal
    function toggleShortcutsModal(show) {
        if (show) {
            shortcutsModal.classList.add('visible');
            shortcutsModal.setAttribute('aria-hidden', 'false');
        } else {
            shortcutsModal.classList.remove('visible');
            shortcutsModal.setAttribute('aria-hidden', 'true');
        }
    }
    
    // Show typing indicator animation
    function showTypingIndicator() {
        isTyping = true;
        typingIndicator.classList.add('visible');
    }
    
    // Hide typing indicator animation
    function hideTypingIndicator() {
        isTyping = false;
        typingIndicator.classList.remove('visible');
    }
    
    // Animate button click
    function animateButton(button) {
        button.classList.add('click-animation');
        setTimeout(() => button.classList.remove('click-animation'), 300);
    }
    
    // Toggle the fields panel
    function togglePanel() {
        container.classList.toggle('panel-collapsed');
        fieldsPanel.classList.toggle('collapsed');
        panelToggle.classList.toggle('collapsed');
        
        const isCollapsed = fieldsPanel.classList.contains('collapsed');
        panelToggle.querySelector('.toggle-icon').textContent = isCollapsed ? 'chevron_right' : 'chevron_left';
        
        // Announce panel state for screen readers
        const message = isCollapsed ? 'Fields panel collapsed' : 'Fields panel expanded';
        addMessage('system', message);
    }
    
    // Update profile selector dropdown with available profiles
    function updateProfileSelector() {
        // Clear current options except the placeholder
        while (profileSelector.options.length > 1) {
            profileSelector.options.remove(1);
        }
        
        // Add profiles to selector
        Object.keys(profiles).forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = profiles[id].name;
            profileSelector.appendChild(option);
        });
    }
    
    // Handle form detection data
    function handleFormDetected(formData) {
        currentFormData = formData;
        formFields = formData.fields || [];
        
        // Update fields count
        fieldsCount.textContent = formFields.length;
        
        // Clear and populate fields list
        fieldsList.innerHTML = '';
        formFields.forEach(function(field, index) {
            const fieldItem = createFieldItem(field, index);
            fieldsList.appendChild(fieldItem);
        });
        
        // Add keyboard navigation to field items
        addKeyboardNavigation();
        
        // Show a form detected message
        const formType = formData.formContext?.form_type || 'form';
        addMessage('system', `Detected a ${formType} with ${formFields.length} fields`);
    }
    
    // Add keyboard navigation to field items
    function addKeyboardNavigation() {
        const fieldItems = fieldsList.querySelectorAll('.field-item');
        
        fieldItems.forEach((item, index) => {
            item.tabIndex = 0; // Make item focusable
            
            item.addEventListener('keydown', function(e) {
                // Enter or Space to click
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.click();
                }
                
                // Arrow down to move to next field
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextItem = fieldItems[index + 1];
                    if (nextItem) nextItem.focus();
                }
                
                // Arrow up to move to previous field
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevItem = fieldItems[index - 1];
                    if (prevItem) prevItem.focus();
                }
            });
        });
    }
    
    // Create a field item element with icon and expandable details
    function createFieldItem(field, index) {
        const fieldItem = document.createElement('div');
        fieldItem.className = 'field-item';
        fieldItem.dataset.index = index;
        fieldItem.tabIndex = 0; // Make focusable
        fieldItem.setAttribute('role', 'button');
        fieldItem.setAttribute('aria-expanded', 'false');
        
        // Get field details
        const fieldLabel = field.label || field.name || 'Field ' + (index + 1);
        const fieldType = field.type || 'text';
        const iconName = FIELD_ICONS[fieldType] || FIELD_ICONS.default;
        
        // Create field icon
        const iconEl = document.createElement('i');
        iconEl.className = 'material-icons field-icon';
        iconEl.textContent = iconName;
        iconEl.setAttribute('aria-hidden', 'true');
        
        // Create field details container
        const detailsEl = document.createElement('div');
        detailsEl.className = 'field-details';
        
        // Create field header with actions
        const headerEl = document.createElement('div');
        headerEl.className = 'field-header';
        
        // Create field name element
        const nameEl = document.createElement('div');
        nameEl.className = 'field-name';
        nameEl.textContent = fieldLabel;
        
        // Create field actions
        const actionsEl = document.createElement('div');
        actionsEl.className = 'field-actions';
        
        // Add quick-fill button
        const fillBtn = document.createElement('button');
        fillBtn.className = 'field-fill-button';
        fillBtn.textContent = 'Fill';
        fillBtn.setAttribute('aria-label', `Fill ${fieldLabel} field`);
        fillBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent fieldItem click
            animateButton(fillBtn);
            fillSingleField(field);
        });
        
        // Add expand/collapse button
        const expandBtn = document.createElement('button');
        expandBtn.className = 'field-expand-button';
        expandBtn.setAttribute('aria-label', 'Expand field details');
        expandBtn.innerHTML = '<i class="material-icons">expand_more</i>';
        expandBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent fieldItem click
            toggleFieldDetails(fieldItem);
        });
        
        // Add required badge if field is required
        if (field.required) {
            const requiredBadge = document.createElement('span');
            requiredBadge.className = 'required-badge';
            requiredBadge.textContent = 'Required';
            nameEl.appendChild(requiredBadge);
        }
        
        // Create field type element with icon
        const typeEl = document.createElement('div');
        typeEl.className = 'field-type';
        
        const typeIconEl = document.createElement('i');
        typeIconEl.className = 'material-icons';
        typeIconEl.textContent = iconName;
        typeIconEl.setAttribute('aria-hidden', 'true');
        
        typeEl.appendChild(typeIconEl);
        typeEl.appendChild(document.createTextNode(fieldType));
        
        // Create expandable details section
        const expandedDetailsEl = document.createElement('div');
        expandedDetailsEl.className = 'field-details-expanded';
        
        // Add validation patterns if available for this field type
        if (VALIDATION_PATTERNS[fieldType]) {
            const validationEl = document.createElement('div');
            validationEl.className = 'field-validation-patterns';
            
            const validationTitle = document.createElement('div');
            validationTitle.className = 'field-suggestion-title';
            validationTitle.textContent = 'Validation patterns:';
            validationEl.appendChild(validationTitle);
            
            VALIDATION_PATTERNS[fieldType].forEach(pattern => {
                const patternEl = document.createElement('div');
                patternEl.className = 'validation-pattern';
                
                const checkIcon = document.createElement('i');
                checkIcon.className = 'material-icons';
                checkIcon.textContent = 'check_circle';
                checkIcon.setAttribute('aria-hidden', 'true');
                
                patternEl.appendChild(checkIcon);
                patternEl.appendChild(document.createTextNode(`${pattern.pattern} (e.g., ${pattern.example})`));
                validationEl.appendChild(patternEl);
            });
            
            expandedDetailsEl.appendChild(validationEl);
        }
        
        // Add field suggestions section
        const suggestionsEl = document.createElement('div');
        suggestionsEl.className = 'field-suggestions';
        
        const suggestionsTitle = document.createElement('div');
        suggestionsTitle.className = 'field-suggestion-title';
        suggestionsTitle.textContent = 'Suggested values:';
        suggestionsEl.appendChild(suggestionsTitle);
        
        const suggestionsList = document.createElement('div');
        suggestionsList.className = 'field-suggestions-list';
        
        // Add sample suggestions based on field type
        let suggestions = [];
        switch (fieldType) {
            case 'email':
                suggestions = ['john.doe@example.com', 'jane.doe@example.com'];
                break;
            case 'tel':
                suggestions = ['1234567890', '(123) 456-7890'];
                break;
            case 'text':
                if (fieldLabel.toLowerCase().includes('name')) {
                    suggestions = ['John Doe', 'Jane Doe'];
                } else if (fieldLabel.toLowerCase().includes('address')) {
                    suggestions = ['123 Main St', '456 Oak Ave'];
                }
                break;
            default:
                suggestions = ['Sample value'];
        }
        
        suggestions.forEach(suggestion => {
            const suggestionEl = document.createElement('div');
            suggestionEl.className = 'field-suggestion';
            suggestionEl.textContent = suggestion;
            suggestionEl.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent fieldItem click
                fillFieldWithValue(field, suggestion);
            });
            suggestionsList.appendChild(suggestionEl);
        });
        
        suggestionsEl.appendChild(suggestionsList);
        expandedDetailsEl.appendChild(suggestionsEl);
        
        // Assemble the field header
        actionsEl.appendChild(fillBtn);
        actionsEl.appendChild(expandBtn);
        headerEl.appendChild(nameEl);
        headerEl.appendChild(actionsEl);
        
        // Assemble the field item
        detailsEl.appendChild(headerEl);
        detailsEl.appendChild(typeEl);
        detailsEl.appendChild(expandedDetailsEl);
        
        fieldItem.appendChild(iconEl);
        fieldItem.appendChild(detailsEl);
        
        // Add click handler
        fieldItem.addEventListener('click', function() {
            // Remove selected class from all fields
            const allFields = fieldsList.querySelectorAll('.field-item');
            allFields.forEach(item => item.classList.remove('selected'));
            
            // Add selected class to clicked field
            fieldItem.classList.add('selected');
            
            // Update current field index
            currentFieldIndex = index;
            
            // Update active field indicator
            updateActiveFieldIndicator(fieldLabel);
            
            // Highlight the field on the page
            highlightField(field.name || field.id);
            
            // Get information about this field
            getFieldInfo(field);
            
            // Pre-populate chat input with question about field
            chatInputField.value = `Tell me about ${fieldLabel}`;
            chatInputField.focus();
            chatInputField.setSelectionRange(0, chatInputField.value.length);
        });
        
        return fieldItem;
    }
    
    // Toggle field details expansion
    function toggleFieldDetails(fieldItem) {
        const isExpanded = fieldItem.getAttribute('aria-expanded') === 'true';
        fieldItem.setAttribute('aria-expanded', !isExpanded);
        
        const expandBtn = fieldItem.querySelector('.field-expand-button');
        if (expandBtn) {
            expandBtn.setAttribute('aria-label', isExpanded ? 'Expand field details' : 'Collapse field details');
        }
    }
    
    // Update active field indicator in chat header
    function updateActiveFieldIndicator(fieldName) {
        activeFieldName.textContent = fieldName;
        activeFieldIndicator.classList.add('active');
    }
    
    // Fill a single field with a sample value
    function fillSingleField(field) {
        if (!field || !field.name) return;
        
        // Get a sample value based on field type and name
        const value = getSampleValue(field);
        fillFieldWithValue(field, value);
    }
    
    // Fill a field with a specific value
    function fillFieldWithValue(field, value) {
        if (!field || !field.name) return;
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'fillField',
                    fieldName: field.name,
                    value: value
                }, function(response) {
                    if (response && response.success) {
                        addMessage('system', `Filled field "${field.label || field.name}" with "${value}"`);
                    } else {
                        addMessage('system', `Failed to fill field "${field.label || field.name}"`);
                    }
                });
            }
        });
    }
    
    // Get a sample value based on field type and name
    function getSampleValue(field) {
        const fieldName = (field.name || '').toLowerCase();
        const fieldLabel = (field.label || '').toLowerCase();
        const fieldType = field.type || 'text';
        
        // Check field name/label for common patterns
        if (fieldName.includes('email') || fieldLabel.includes('email') || fieldType === 'email') {
            return 'user@example.com';
        }
        
        if (fieldName.includes('phone') || fieldLabel.includes('phone') || fieldType === 'tel') {
            return '1234567890';
        }
        
        if (fieldName.includes('password') || fieldLabel.includes('password') || fieldType === 'password') {
            return 'P@ssw0rd!';
        }
        
        if (fieldName.includes('name') || fieldLabel.includes('name')) {
            if (fieldName.includes('first') || fieldLabel.includes('first')) {
                return 'John';
            }
            if (fieldName.includes('last') || fieldLabel.includes('last')) {
                return 'Doe';
            }
            return 'John Doe';
        }
        
        if (fieldName.includes('address') || fieldLabel.includes('address')) {
            return '123 Main St';
        }
        
        if (fieldName.includes('city') || fieldLabel.includes('city')) {
            return 'New York';
        }
        
        if (fieldName.includes('state') || fieldLabel.includes('state')) {
            return 'NY';
        }
        
        if (fieldName.includes('zip') || fieldLabel.includes('zip') || fieldName.includes('postal') || fieldLabel.includes('postal')) {
            return '10001';
        }
        
        if (fieldName.includes('country') || fieldLabel.includes('country')) {
            return 'USA';
        }
        
        if (fieldType === 'checkbox') {
            return true;
        }
        
        if (fieldType === 'date') {
            return '2023-01-01';
        }
        
        // Default sample text
        return 'Sample Text';
    }
    
    // Get information about a specific field
    function getFieldInfo(field) {
        const fieldName = field.name || field.id || field.label || 'this field';
        const fieldType = field.type || 'text';
        
        // Create a simple message about the field
        let message = `## ${fieldName}\n\n`;
        message += `This is a ${fieldType} field`;
        
        if (field.required) {
            message += " and it's **required**";
        } else {
            message += " and it's optional";
        }
        
        if (field.purpose) {
            message += `.\n\nIt's used for ${field.purpose}.`;
        } else {
            message += '.';
        }
        
        if (field.helpText) {
            message += `\n\n${field.helpText}`;
        }
        
        // Add specific guidance based on field type
        message += '\n\n### Tips:';
        
        switch (fieldType) {
            case 'email':
                message += '\n- Enter a valid email address (e.g., example@domain.com)';
                message += '\n- Email addresses must contain an @ symbol';
                message += '\n- Make sure to use the correct domain';
                break;
            case 'password':
                message += '\n- Use a strong, unique password';
                message += '\n- Include a mix of upper and lowercase letters, numbers, and symbols';
                message += '\n- Avoid using easily guessable information';
                break;
            case 'tel':
                message += '\n- Enter a valid phone number in the required format';
                message += '\n- Some forms require area codes or country codes';
                message += '\n- Check for any specific format requirements';
                break;
            case 'date':
                message += '\n- Use the correct date format (usually YYYY-MM-DD)';
                message += '\n- Most forms provide a date picker for easier selection';
                break;
            default:
                message += '\n- Enter information accurately';
                message += '\n- Check for any specific format requirements';
        }
        
        // Add validation patterns if available
        if (VALIDATION_PATTERNS[fieldType]) {
            message += '\n\n### Validation Requirements:';
            VALIDATION_PATTERNS[fieldType].forEach(pattern => {
                message += `\n- ${pattern.pattern} (e.g., ${pattern.example})`;
            });
        }
        
        // Show the message after a brief delay to simulate processing
        showTypingIndicator();
        setTimeout(() => {
            hideTypingIndicator();
            addMessage('ai', message);
        }, 600);
    }
    
    // Show message when no forms are found
    function showNoFormsMessage() {
        fieldsList.innerHTML = '<div class="no-forms-message">No forms detected on this page</div>';
        fieldsCount.textContent = '0';
        
        addMessage('system', 'No forms detected on this page. You can upload a PDF form instead.');
    }
    
    // Get formatted timestamp for messages
    function getFormattedTimestamp() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert 0 to 12
        
        return `${hours}:${minutes} ${ampm}`;
    }
    
    // Add a message to the chat
    function addMessage(type, text) {
        // For system messages, check if it's duplicating previous ones
        if (type === 'system') {
            if (lastSystemMessage === text) {
                // Don't add duplicate system messages
                return;
            }
            lastSystemMessage = text;
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        // Create message container
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        
        // Create message avatar for AI or user messages
        if (type === 'ai' || type === 'user') {
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'message-avatar';
            
            const iconEl = document.createElement('i');
            iconEl.className = `material-icons ${type}-icon`;
            iconEl.textContent = type === 'ai' ? 'smart_toy' : 'person';
            iconEl.setAttribute('aria-hidden', 'true');
            
            avatarDiv.appendChild(iconEl);
            messageDiv.appendChild(avatarDiv);
        }
        
        // Create message content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Use markdown for AI messages if available
        if (type === 'ai' && typeof marked !== 'undefined') {
            contentDiv.innerHTML = marked.parse(text);
        } else {
            contentDiv.textContent = text;
        }
        
        // Add timestamp for ai and user messages
        if (type === 'ai' || type === 'user') {
            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'message-timestamp';
            timestampDiv.textContent = getFormattedTimestamp();
            messageContainer.appendChild(contentDiv);
            messageContainer.appendChild(timestampDiv);
            messageDiv.appendChild(messageContainer);
        } else {
            // For system messages, keep it simple
            messageDiv.appendChild(contentDiv);
        }
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Process user message and generate a response
    function processUserMessage(message) {
        // In a real implementation, this would call the backend API
        // For now, just generate a simple response after a delay to simulate thinking
        setTimeout(() => {
            hideTypingIndicator();
            let response;
            
            if (message.toLowerCase().includes('what is this form')) {
                response = "# Form Analysis\n\nThis appears to be a data collection form. I can help you understand what information is being requested.\n\n## Form Purpose\nBased on the fields present, this form is likely used for:\n- Collecting personal information\n- Creating an account or profile\n\nI can help you understand any field in more detail - just click on a field in the left panel to learn more about it.";
            }
            else if (message.toLowerCase().includes('help')) {
                response = "# How I Can Help\n\nI can assist you with this form in several ways:\n\n- **Understanding Fields**: Click any field on the left panel to get detailed information\n- **Auto-filling**: Use the \"Auto-fill Form\" button to populate all fields with sample data\n- **Form Guidance**: Ask me any questions about the form's purpose or requirements\n- **Field-specific Help**: I can explain validation requirements and provide suggestions for specific fields\n\nWhat would you like help with today?";
            }
            else if (message.toLowerCase().includes('autofill') || message.toLowerCase().includes('fill') || message.toLowerCase().includes('complete')) {
                response = "# Auto-fill Options\n\nI can help fill out this form for you in a few ways:\n\n1. **Complete Form**: Click the \"Auto-fill Form\" button to fill all fields with sample data\n2. **Use Profile**: Select a saved profile from the dropdown and click \"Auto-fill With Profile\"\n3. **Individual Fields**: Click the \"Fill\" button next to any field to auto-fill just that field\n\nWould you like me to explain any of these options in more detail?";
            }
            else if (message.toLowerCase().includes('tell me about')) {
                // This is a field-specific question
                let fieldName = message.toLowerCase().replace('tell me about', '').trim();
                
                // Find the field
                const matchingField = formFields.find(field => {
                    const name = (field.name || '').toLowerCase();
                    const label = (field.label || '').toLowerCase();
                    return name.includes(fieldName) || label.includes(fieldName);
                });
                
                if (matchingField) {
                    getFieldInfo(matchingField);
                    return; // Early return as getFieldInfo will add the message
                }
                
                // Default response if no matching field
                response = `I couldn't find a specific field matching "${fieldName}". You can click on any field in the left panel to learn more about it.`;
            }
            else {
                response = "I'm here to help with this form. You can:\n\n- Click on any field in the left panel to learn more about it\n- Ask me about specific fields or form sections\n- Use the \"Auto-fill Form\" button to populate the form with sample data\n- Ask me about form validation requirements\n\nWhat would you like to know more about?";
            }
            
            addMessage('ai', response);
        }, 1000);
    }
    
    // Auto-fill the form with sample data
    function autoFillForm() {
        if (!currentFormData || !currentFormData.formId) {
            addMessage('system', 'No form available to auto-fill');
            return;
        }
        
        showTypingIndicator();
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'autoFillForm',
                    formId: currentFormData.formId
                }, function(response) {
                    hideTypingIndicator();
                    
                    if (response && response.success) {
                        addMessage('system', `Auto-filled ${response.count} fields`);
                        
                        // Add a success message from the AI
                        addMessage('ai', `I've filled out ${response.count} fields with sample data. Here's what I did:\n\n- Detected and filled all visible form fields\n- Used contextually appropriate values for each field type\n- Ensured all required fields have values\n\nYou can review and modify any values before submitting the form. Let me know if you'd like to change anything!`);
                    } else {
                        addMessage('system', 'Failed to auto-fill the form');
                    }
                });
            }
        });
    }
    
    // Auto-fill form with profile data
    function autoFillFormWithProfile(profileId) {
        if (!currentFormData || !currentFormData.formId || !profiles[profileId]) {
            addMessage('system', 'Cannot auto-fill: missing form or profile data');
            return;
        }
        
        const profile = profiles[profileId];
        
        showTypingIndicator();
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'autoFillWithProfile',
                    formId: currentFormData.formId,
                    profile: profile
                }, function(response) {
                    hideTypingIndicator();
                    
                    if (response && response.success) {
                        addMessage('system', `Auto-filled form with profile "${profile.name}"`);
                        
                        // Add a success message from the AI
                        addMessage('ai', `I've filled the form using your "${profile.name}" profile. Values were mapped to the appropriate fields based on field names and types. You can review the form before submitting.`);
                    } else {
                        addMessage('system', 'Failed to auto-fill with profile');
                    }
                });
            }
        });
    }
    
    // Highlight a field on the page
    function highlightField(fieldName) {
        if (!fieldName) return;
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'highlightField',
                    fieldName: fieldName
                });
            }
        });
    }
    
    // Execute fallback command from text input - DEPRECATED
    /* 
    Command input functionality has been removed as we're now using the side panel
    */
    
    // Initialize the panel
    initPanel();
});