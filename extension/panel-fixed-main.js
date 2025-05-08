/**
 * Main JavaScript for panel-fixed.html
 * Fixed CSP-compliant implementation without inline scripts
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const fieldGrid = document.getElementById('field-grid');
    const fieldCount = document.getElementById('field-count');
    const loadingIndicator = document.getElementById('loading-indicator');
    const helperText = document.getElementById('helper-text');
    const messages = document.getElementById('messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const autofillButton = document.getElementById('autofill-button');
    const retryButton = document.getElementById('retry-detection');
    const errorMessage = document.getElementById('error-message');
    
    // Constants
    const DETECTION_TIMEOUT = 8000; // 8 seconds timeout for field detection
    const DEBUG_MODE = false; // Set to true to enable detailed logging
    
    // State - make currentFormData global for debug panel
    window.currentFormData = null;
    let detectionTimer = null;
    let detectionAttempts = 0;
    
    // Initialize debug integration if available
    if (window.PanelDebugIntegration && typeof window.PanelDebugIntegration.initializeDebugIntegration === 'function') {
        console.log('Initializing debug integration from panel-fixed-main.js');
        window.PanelDebugIntegration.initializeDebugIntegration();
    } else {
        console.log('Debug integration not available or already initialized');
    }
    
    // Initialize
    init();
    
    /**
     * Initialize the panel
     */
    function init() {
        console.log('Initializing form helper panel');
        
        // Hide helper text and error message initially
        hideElement(helperText);
        hideElement(errorMessage);
        
        // Show loading state
        showLoading(true);
        
        // Set up event listeners
        setupEventListeners();
        
        // Start detection process
        startDetection();
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Chat form submission
        if (chatForm) {
            chatForm.addEventListener('submit', handleChatSubmit);
        }
        
        // Autofill button
        if (autofillButton) {
            autofillButton.addEventListener('click', handleAutofill);
        }
        
        // Retry button
        if (retryButton) {
            retryButton.addEventListener('click', handleRetryDetection);
        }
        
        // Listen for messages from extension
        if (chrome.runtime) {
            chrome.runtime.onMessage.addListener(handleRuntimeMessages);
        }
    }
    
    /**
     * Start field detection process
     */
    function startDetection() {
        console.log('Starting form field detection (attempt ' + (detectionAttempts + 1) + ')');
        detectionAttempts++;
        
        // Reset any previous timer
        if (detectionTimer) {
            clearTimeout(detectionTimer);
        }
        
        // Clear field grid and error message
        if (fieldGrid) {
            fieldGrid.innerHTML = '';
        }
        hideElement(errorMessage);
        
        // Show loading indicator
        showLoading(true);
        
        // Update welcome message
        const welcomeMessages = document.querySelectorAll('.ai-message');
        if (welcomeMessages.length > 0) {
            const firstMessage = welcomeMessages[0].querySelector('.message-bubble');
            if (firstMessage) {
                firstMessage.textContent = "Analyzing form fields on this page...";
            }
        }
        
        // Set timeout for detection
        detectionTimer = setTimeout(() => {
            console.log('Field detection timeout reached after ' + DETECTION_TIMEOUT + 'ms');
            handleDetectionTimeout();
        }, DETECTION_TIMEOUT);
        
        // Log detection start with timing info
        console.info('Starting detection process at ' + new Date().toISOString());
        
        // Enable debug mode in field detector if needed
        if (DEBUG_MODE && window.FieldDetector && window.FieldDetector.debug) {
            window.FieldDetector.debug.enabled = true;
        }
        
        // First try in-page detection - this is the fastest option and works with Chrome's sandboxing
        if (window.FieldDetector) {
            try {
                // Start with quick scan for immediate feedback
                console.info('Starting in-page quick scan');
                const quickData = window.FieldDetector.quickScan();
                
                if (quickData && quickData.fields && quickData.fields.length > 0) {
                    console.info('Quick scan found ' + quickData.fields.length + ' fields');
                    processQuickScanData(quickData);
                    
                    // Continue with full scan for better results
                    setTimeout(() => {
                        runLocalDetection();
                    }, 100);
                    return;
                } else {
                    console.info('Quick scan found no fields, trying other methods');
                }
            } catch (err) {
                console.warn('In-page quick scan failed:', err);
            }
        }
        
        // Try message-based detection if available
        if (chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                let tabId = tabs && tabs[0] ? tabs[0].id : null;
                
                if (tabId) {
                    // Try message-based detection
                    console.info('Starting message-based detection using tab ID:', tabId);
                    detectFormFieldsInTab(tabId);
                } else {
                    console.warn('No active tab found, falling back to local detection');
                    runLocalDetection();
                }
            });
        } else {
            console.warn('Chrome tabs API not available, using local detection');
            runLocalDetection();
        }
    }
    
    /**
     * Detect form fields in a tab via messaging
     */
    function detectFormFieldsInTab(tabId) {
        console.log('Attempting tab-based detection for tab:', tabId);
        
        try {
            // First try quick scan
            chrome.tabs.sendMessage(tabId, { action: 'quickFormScan' })
                .then(response => {
                    if (response && response.success && response.formData) {
                        // Process quick results
                        processQuickScanData(response.formData);
                        
                        // Request full scan
                        requestFullScan(tabId);
                    } else {
                        console.log('Quick scan returned no results, trying full scan');
                        requestFullScan(tabId);
                    }
                })
                .catch(error => {
                    console.log('Error in quick scan:', error);
                    requestFullScan(tabId);
                });
        } catch (error) {
            console.error('Error sending message to tab:', error);
            runLocalDetection();
        }
    }
    
    /**
     * Request full scan from content script
     */
    function requestFullScan(tabId) {
        console.log('Requesting full form scan');
        
        try {
            chrome.tabs.sendMessage(tabId, { action: 'fullFormScan' })
                .then(response => {
                    if (response && response.success && response.formData) {
                        // Clear the timeout as we got results
                        clearTimeout(detectionTimer);
                        detectionTimer = null;
                        
                        // Process full results
                        processFormData(response.formData);
                        finishLoading();
                    } else {
                        console.warn('Full scan returned no results');
                        handleNoFieldsDetected();
                    }
                })
                .catch(error => {
                    console.error('Error in full form scan:', error);
                    runLocalDetection();
                });
        } catch (error) {
            console.error('Error requesting full scan:', error);
            runLocalDetection();
        }
    }
    
    /**
     * Use local detector as fallback
     */
    function runLocalDetection() {
        console.log('Running local form detection');
        
        // Check if field detector is available
        if (window.FieldDetector) {
            try {
                // Try quick scan first
                if (window.FieldDetector.quickScan) {
                    const quickData = window.FieldDetector.quickScan();
                    processQuickScanData(quickData);
                }
                
                // Run full scan after a delay
                setTimeout(() => {
                    try {
                        if (window.FieldDetector.scanForFields) {
                            currentFormData = window.FieldDetector.scanForFields();
                            
                            // Clear the timeout as we got results
                            if (detectionTimer) {
                                clearTimeout(detectionTimer);
                                detectionTimer = null;
                            }
                            
                            processFormData(currentFormData);
                            finishLoading();
                        } else {
                            console.warn('No scanForFields method available');
                            handleNoFieldsDetected();
                        }
                    } catch (e) {
                        console.error('Error in local full scan:', e);
                        handleDetectionError(e);
                    }
                }, 100);
            } catch (error) {
                console.error('Error in local detection:', error);
                handleDetectionError(error);
            }
        } else {
            console.warn('FieldDetector not available, showing demo fields');
            displayDemoFields();
            finishLoading();
        }
    }
    
    /**
     * Process initial quick scan results
     */
    function processQuickScanData(data) {
        console.log('Processing quick scan data:', data);
        
        if (data && data.fields && data.fields.length > 0) {
            // Update UI with basic field data
            displayFields(data.fields);
            updateFieldCount(data.fields.length);
            
            // Update welcome message with basic form type
            if (data.formType && data.formType !== 'unknown') {
                updateWelcomeMessage({
                    formType: data.formType,
                    formPurpose: getFormPurpose(data.formType)
                });
            }
        }
    }
    
    /**
     * Process full scan results
     */
    function processFormData(formData) {
        console.log('Processing complete form data:', formData);
        
        // Store current form data
        currentFormData = formData;
        
        if (!formData || !formData.fields || formData.fields.length === 0) {
            // No form detected
            handleNoFieldsDetected();
            return;
        }
        
        // Update field count
        updateFieldCount(formData.fields.length);
        
        // Display fields
        displayFields(formData.fields);
        
        // Update welcome message with detailed form info
        updateWelcomeMessage(formData);
    }
    
    /**
     * Handle detection timeout
     */
    function handleDetectionTimeout() {
        console.warn('Field detection timed out after ' + DETECTION_TIMEOUT + 'ms');
        
        // Always hide the loading indicator when we time out
        showLoading(false);
        
        // Check if we have any fields from quick scan
        if (fieldGrid && fieldGrid.children.length > 0) {
            // We have some fields from the quick scan
            finishLoading();
            addAiMessage("I've shown the fields I could find quickly. I'll continue looking for more in the background.");
        } else {
            // No fields detected at all - try one last desperate attempt with table detection
            tryTableSpecificDetection()
                .then(hasFields => {
                    if (hasFields) {
                        finishLoading();
                        addAiMessage("I found some form fields using specialized detection. Let me know if any are missing.");
                    } else {
                        handleNoFieldsDetected();
                    }
                })
                .catch(() => {
                    handleNoFieldsDetected();
                });
        }
    }
    
    /**
     * Try special detection methods specifically for table-based forms
     * This is a last resort for older HTML formats
     */
    async function tryTableSpecificDetection() {
        console.info('Trying table-specific form detection');
        
        if (!chrome.tabs) {
            return false;
        }
        
        try {
            // Look specifically for table-based patterns
            const result = await new Promise((resolve) => {
                chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
                    if (!tabs || !tabs[0]) {
                        resolve({ fields: [] });
                        return;
                    }
                    
                    const tabId = tabs[0].id;
                    
                    // Execute a script directly in the page to look for table-based forms
                    chrome.scripting.executeScript({
                        target: { tabId },
                        function: searchForTableForms
                    })
                    .then(results => {
                        if (results && results[0] && results[0].result) {
                            resolve(results[0].result);
                        } else {
                            resolve({ fields: [] });
                        }
                    })
                    .catch(() => {
                        resolve({ fields: [] });
                    });
                });
            });
            
            if (result.fields && result.fields.length > 0) {
                console.info('Table detection found ' + result.fields.length + ' fields');
                
                // Process these fields
                currentFormData = {
                    formId: 'table_form_' + Date.now(),
                    formType: 'tabular',
                    fields: result.fields
                };
                
                // Update field count
                updateFieldCount(result.fields.length);
                
                // Display fields
                displayFields(result.fields);
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error in table-specific detection:', error);
            return false;
        }
    }
    
    /**
     * Specialized function to detect form fields in table-based layouts
     * This runs directly in the page context via executeScript
     */
    function searchForTableForms() {
        // This function runs in the context of the page
        console.log('Running table-form search');
        
        const fields = [];
        
        // Search for common table patterns
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            // Look for inputs in table cells
            const inputs = table.querySelectorAll('input, select, textarea');
            if (inputs.length < 2) return; // Skip tables with just one input
            
            inputs.forEach(input => {
                // Skip submit buttons and hidden fields
                if (input.type === 'submit' || input.type === 'button' || 
                    input.type === 'hidden' || input.type === 'reset') {
                    return;
                }
                
                // Get the containing cell
                const cell = input.closest('td');
                if (!cell) return;
                
                // Try to get label from previous cell
                let label = '';
                const row = cell.closest('tr');
                if (row) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const cellIndex = cells.indexOf(cell);
                    if (cellIndex > 0) {
                        label = cells[cellIndex - 1].textContent.trim();
                    }
                }
                
                // Add field
                fields.push({
                    name: input.name || input.id || '',
                    id: input.id || '',
                    type: input.type || input.tagName.toLowerCase(),
                    label: label || input.placeholder || input.name || 'Field',
                    required: input.required || false,
                    derivedType: input.type === 'password' ? 'password' : 'text',
                });
            });
        });
        
        // Specialized detection for login forms (2 fields, one is password)
        if (fields.length === 0) {
            // Look for any password field 
            const passwordFields = document.querySelectorAll('input[type="password"]');
            
            if (passwordFields.length === 1) {
                // Likely a login form - get the parent container
                const passwordField = passwordFields[0];
                
                // Get common container that might hold both username and password
                const container = passwordField.closest('form') || 
                                  passwordField.closest('div') || 
                                  passwordField.closest('fieldset');
                
                if (container) {
                    // Look for text inputs in this container
                    const textInputs = container.querySelectorAll('input[type="text"], input[type="email"]');
                    
                    if (textInputs.length >= 1) {
                        // Probably a username/password pair
                        fields.push({
                            name: textInputs[0].name || textInputs[0].id || 'username',
                            id: textInputs[0].id || '',
                            type: textInputs[0].type,
                            label: 'Username',
                            required: true,
                            derivedType: 'username'
                        });
                        
                        fields.push({
                            name: passwordField.name || passwordField.id || 'password',
                            id: passwordField.id || '',
                            type: 'password',
                            label: 'Password',
                            required: true,
                            derivedType: 'password'
                        });
                    }
                }
            }
        }
        
        console.log('Table form search found ' + fields.length + ' fields');
        return { fields };
    }
    
    /**
     * Handle case when no fields are detected
     */
    function handleNoFieldsDetected() {
        console.warn('No form fields were detected');
        
        // Update error message to include manual option
        if (errorMessage) {
            errorMessage.innerHTML = `
                <div>
                    No form fields detected. This might be due to:
                    <ul style="margin-top: 5px; margin-bottom: 5px; padding-left: 20px; text-align: left;">
                        <li>Non-standard form implementation</li>
                        <li>Dynamically loaded form fields</li>
                        <li>Custom input elements</li>
                    </ul>
                    <div style="margin-top: 8px;">
                        <button id="retry-detection" class="retry-button">Retry Detection</button>
                        <button id="manual-detection" class="retry-button" style="background-color: #34A853;">Manual Select</button>
                    </div>
                </div>
            `;
            
            // Add event listener for manual detection button
            const manualButton = document.getElementById('manual-detection');
            if (manualButton) {
                manualButton.addEventListener('click', startManualFieldSelection);
            }
            
            // Re-add event listener for retry button since we rebuilt the HTML
            const retryButton = document.getElementById('retry-detection');
            if (retryButton) {
                retryButton.addEventListener('click', handleRetryDetection);
            }
            
            showElement(errorMessage);
        }
        
        // Update welcome message
        addAiMessage("I couldn't detect any form fields automatically. You can try again with 'Retry Detection' or use 'Manual Select' to click on fields yourself.");
        
        // Finish loading
        finishLoading();
        
        // Update field count
        updateFieldCount(0);
    }
    
    /**
     * Start manual field selection mode
     */
    function startManualFieldSelection() {
        console.info('Starting manual field selection mode');
        
        // Show message to user
        addAiMessage("Manual field selection mode activated. Please click on form fields in the page to identify them. When done, click 'Finish Selection' below.");
        
        // Add a finish button in the chat
        const finishButton = document.createElement('button');
        finishButton.textContent = 'Finish Selection';
        finishButton.className = 'retry-button';
        finishButton.style.backgroundColor = '#34A853';
        finishButton.style.marginTop = '8px';
        finishButton.addEventListener('click', () => {
            stopManualFieldSelection();
            
            // Update messaging
            addAiMessage("Manual field selection complete. I'll use these fields to help you fill out the form.");
        });
        
        // Add button to the last message
        const lastMessage = document.querySelector('.messages .ai-message:last-child .message-bubble');
        if (lastMessage) {
            lastMessage.appendChild(document.createElement('br'));
            lastMessage.appendChild(finishButton);
        }
        
        // Hide error message
        hideElement(errorMessage);
        
        // Clear any existing fields
        if (fieldGrid) {
            fieldGrid.innerHTML = '';
        }
        
        // Initialize manual selection array
        if (!currentFormData) {
            currentFormData = {
                formId: 'manual_form_' + Date.now(),
                formType: 'manual',
                fields: []
            };
        }
        
        // Inject content script to handle element selection
        if (chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs && tabs[0]) {
                    const tabId = tabs[0].id;
                    
                    // Send message to activate selection mode
                    chrome.tabs.sendMessage(tabId, {
                        action: 'startManualFieldSelection'
                    }).catch(error => {
                        console.warn('Error starting manual selection:', error);
                        
                        // Inject selection script directly if messaging fails
                        chrome.scripting.executeScript({
                            target: { tabId },
                            function: injectManualSelectionMode
                        }).catch(error => {
                            console.error('Failed to inject manual selection script:', error);
                            addAiMessage("I couldn't activate manual selection mode. Please try reloading the page.");
                        });
                    });
                }
            });
        }
    }
    
    /**
     * Inject manual selection mode script directly into the page
     */
    function injectManualSelectionMode() {
        // This runs in the page context
        console.log('Injecting manual field selection mode');
        
        // Store original styles to restore later
        const originalOutlines = new Map();
        let selectedElements = [];
        
        // Create highlighting style
        const style = document.createElement('style');
        style.id = 'form-helper-manual-selection-style';
        style.textContent = `
            .form-helper-hoverable {
                cursor: pointer !important;
                transition: outline 0.2s ease !important;
            }
            .form-helper-hoverable:hover {
                outline: 2px dashed #4285F4 !important;
                outline-offset: 2px !important;
            }
            .form-helper-selected {
                outline: 3px solid #34A853 !important;
                outline-offset: 2px !important;
            }
        `;
        document.head.appendChild(style);
        
        // Make inputs hoverable
        const inputElements = document.querySelectorAll('input, select, textarea, [contenteditable="true"], [role="textbox"]');
        inputElements.forEach(el => {
            // Store original outline
            originalOutlines.set(el, {
                outline: el.style.outline,
                outlineOffset: el.style.outlineOffset
            });
            
            // Add hoverable class
            el.classList.add('form-helper-hoverable');
            
            // Add click handler
            el.addEventListener('click', handleElementClick);
        });
        
        // Handle element click
        function handleElementClick(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const element = event.currentTarget;
            
            // Toggle selection
            if (element.classList.contains('form-helper-selected')) {
                element.classList.remove('form-helper-selected');
                selectedElements = selectedElements.filter(el => el !== element);
            } else {
                element.classList.add('form-helper-selected');
                selectedElements.push(element);
            }
            
            // Send message about selection
            chrome.runtime.sendMessage({
                action: 'manualFieldSelected',
                field: {
                    name: element.name || element.id || '',
                    id: element.id || '',
                    type: element.type || element.tagName.toLowerCase(),
                    label: extractLabel(element) || element.placeholder || element.name || 'Field',
                    required: element.required || false,
                    derivedType: guessFieldType(element)
                }
            });
            
            return false;
        }
        
        // Extract label text from an element
        function extractLabel(element) {
            // Check for label element
            if (element.id) {
                const label = document.querySelector(`label[for="${element.id}"]`);
                if (label) {
                    return label.textContent.trim();
                }
            }
            
            // Check for parent label
            if (element.parentElement && element.parentElement.tagName === 'LABEL') {
                return element.parentElement.textContent.replace(element.value || '', '').trim();
            }
            
            // Check if in table cell
            if (element.closest('td')) {
                const cell = element.closest('td');
                const row = cell.closest('tr');
                if (row) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const cellIndex = cells.indexOf(cell);
                    if (cellIndex > 0) {
                        return cells[cellIndex - 1].textContent.trim();
                    }
                }
            }
            
            // Check for nearby elements that could be labels
            const previousElement = element.previousElementSibling;
            if (previousElement) {
                return previousElement.textContent.trim();
            }
            
            // Use aria label
            return element.getAttribute('aria-label') || 
                   element.getAttribute('placeholder') || 
                   '';
        }
        
        // Guess field type based on element properties
        function guessFieldType(element) {
            const type = element.type || '';
            const name = (element.name || '').toLowerCase();
            const id = (element.id || '').toLowerCase();
            const placeholder = (element.placeholder || '').toLowerCase();
            
            if (type === 'password') return 'password';
            if (type === 'email') return 'email';
            if (type === 'tel') return 'phone';
            
            if (name.includes('user') || id.includes('user')) return 'username';
            if (name.includes('email') || id.includes('email') || placeholder.includes('email')) return 'email';
            if (name.includes('pass') || id.includes('pass') || placeholder.includes('password')) return 'password';
            if (name.includes('name') || id.includes('name')) {
                if (name.includes('first') || id.includes('first')) return 'firstName';
                if (name.includes('last') || id.includes('last')) return 'lastName';
                return 'name';
            }
            
            return 'text';
        }
        
        // Listen for cleanup message
        chrome.runtime.onMessage.addListener(function(request) {
            if (request.action === 'stopManualFieldSelection') {
                // Clean up
                inputElements.forEach(el => {
                    el.classList.remove('form-helper-hoverable', 'form-helper-selected');
                    
                    // Restore original outline
                    const original = originalOutlines.get(el);
                    if (original) {
                        el.style.outline = original.outline;
                        el.style.outlineOffset = original.outlineOffset;
                    }
                    
                    // Remove event listener
                    el.removeEventListener('click', handleElementClick);
                });
                
                // Remove style
                const styleElement = document.getElementById('form-helper-manual-selection-style');
                if (styleElement) {
                    styleElement.remove();
                }
            }
        });
    }
    
    /**
     * Stop manual field selection mode
     */
    function stopManualFieldSelection() {
        console.info('Stopping manual field selection mode');
        
        // Send message to clean up selection mode
        if (chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs && tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'stopManualFieldSelection'
                    }).catch(e => console.warn('Error stopping manual selection:', e));
                }
            });
        }
        
        // Show helper text if we have fields
        if (fieldGrid && fieldGrid.children.length > 0) {
            showElement(helperText);
        }
    }
    
    /**
     * Handle detection error
     */
    function handleDetectionError(error) {
        console.error('Error during field detection:', error);
        
        // Show error message with details
        if (errorMessage) {
            errorMessage.textContent = 'Error detecting form fields. Please try again.';
            showElement(errorMessage);
        }
        
        // Add error message to chat
        addAiMessage("I encountered an error while analyzing this form. Please click 'Retry Detection' or try a different page.");
        
        // Show retry button
        finishLoading();
    }
    
    /**
     * Handle retry button click
     */
    function handleRetryDetection() {
        console.log('Manual retry of field detection requested');
        
        // Clear any existing fields
        if (fieldGrid) {
            fieldGrid.innerHTML = '';
        }
        
        // Hide error message
        hideElement(errorMessage);
        
        // Show loading indicator
        showLoading(true);
        
        // Reset welcome message
        const welcomeMessages = document.querySelectorAll('.ai-message');
        if (welcomeMessages.length > 0) {
            const firstMessage = welcomeMessages[0].querySelector('.message-bubble');
            if (firstMessage) {
                firstMessage.textContent = "Analyzing form fields on this page...";
            }
        }
        
        // Start detection process again
        startDetection();
    }
    
    /**
     * Finish loading process
     */
    function finishLoading() {
        console.log('Finishing loading process');
        
        // Always hide loading indicator
        showLoading(false);
        
        // Show helper text if we have fields
        if (fieldGrid && fieldGrid.children.length > 0) {
            showElement(helperText);
        } else {
            // If no fields were found, make sure error message is visible
            if (errorMessage) {
                showElement(errorMessage);
            }
        }
        
        // Show retry button
        if (retryButton) {
            showElement(retryButton);
        }
        
        // Update the welcome message if we're still showing the loading text
        const welcomeMessages = document.querySelectorAll('.ai-message');
        if (welcomeMessages.length > 0) {
            const firstMessage = welcomeMessages[0].querySelector('.message-bubble');
            if (firstMessage && firstMessage.textContent.includes('Analyzing form fields')) {
                firstMessage.textContent = "I've completed scanning the page. " + 
                    (fieldGrid && fieldGrid.children.length > 0 
                        ? "Here are the form fields I found." 
                        : "I didn't find any form fields. You can try manual selection if needed.");
            }
        }
    }
    
    /**
     * Get form purpose based on type
     */
    function getFormPurpose(formType) {
        switch (formType) {
            case 'login': return 'signing in to your account';
            case 'registration': return 'creating a new account';
            case 'contact': return 'sending a message';
            case 'checkout': return 'completing a purchase';
            default: return 'collecting information';
        }
    }
    
    /**
     * Update field count display
     */
    function updateFieldCount(count) {
        if (fieldCount) {
            fieldCount.textContent = `(${count})`;
        }
    }
    
    /**
     * Display fields in the grid
     */
    function displayFields(fields) {
        if (!fieldGrid) return;
        
        // Clear existing fields
        fieldGrid.innerHTML = '';
        
        // If no fields, show message
        if (!fields || fields.length === 0) {
            return;
        }
        
        console.log('Displaying ' + fields.length + ' fields');
        
        // Limit to 6 fields maximum to fit in the grid
        const displayFields = fields.slice(0, Math.min(fields.length, 6));
        
        // Add each field as a pill
        displayFields.forEach(field => {
            const fieldPill = document.createElement('div');
            fieldPill.className = `field-pill ${field.required ? 'required' : 'optional'}`;
            fieldPill.dataset.fieldId = field.id || field.name;
            
            // Determine icon
            const iconName = getFieldIcon(field.derivedType || field.type);
            
            // Set pill content
            fieldPill.innerHTML = `
                <i class="material-icons field-icon">${iconName}</i>
                <span class="field-text">${field.label || 'Field'}</span>
            `;
            
            // Add click handler
            fieldPill.addEventListener('click', function() {
                handleFieldClick(field);
            });
            
            // Add to grid
            fieldGrid.appendChild(fieldPill);
        });
    }
    
    /**
     * Handle field click
     */
    function handleFieldClick(field) {
        // Add user message
        addUserMessage(`Tell me about the ${field.label || 'this'} field`);
        
        // Generate response about the field
        const requiredText = field.required ? "required" : "optional";
        
        // Try to get field description from extension if possible
        if (chrome.runtime && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const tabId = tabs && tabs[0] ? tabs[0].id : null;
                
                if (tabId) {
                    chrome.runtime.sendMessage({
                        action: 'explainField',
                        fieldName: field.name || field.label,
                        fieldId: field.id,
                        formId: currentFormData?.formId,
                        tabId: tabId
                    }).catch(() => {
                        // Use local description if message fails
                        const fieldDescription = getFieldDescription(field);
                        addAiMessage(`The ${field.label || 'field'} is ${requiredText}. ${fieldDescription}`);
                    });
                } else {
                    // No active tab, use local description
                    const fieldDescription = getFieldDescription(field);
                    addAiMessage(`The ${field.label || 'field'} is ${requiredText}. ${fieldDescription}`);
                }
            });
        } else {
            // Use local description
            const fieldDescription = getFieldDescription(field);
            addAiMessage(`The ${field.label || 'field'} is ${requiredText}. ${fieldDescription}`);
        }
    }
    
    /**
     * Display demo fields when no detection is available
     */
    function displayDemoFields() {
        console.log('Displaying demo fields');
        
        // Demo fields
        const demoFields = [
            { label: 'Username', required: true, derivedType: 'username' },
            { label: 'Email', required: true, derivedType: 'email' },
            { label: 'Password', required: true, derivedType: 'password' },
            { label: 'Confirm Password', required: true, derivedType: 'confirmPassword' },
            { label: 'Full Name', required: false, derivedType: 'name' },
            { label: 'Phone', required: false, derivedType: 'phone' }
        ];
        
        // Update field count
        updateFieldCount(demoFields.length);
        
        // Display fields
        displayFields(demoFields);
        
        // Update welcome message
        updateWelcomeMessage({
            formType: 'registration',
            formPurpose: 'creating a new account'
        });
    }
    
    /**
     * Update welcome message with form type info
     */
    function updateWelcomeMessage(formData) {
        const welcomeMessages = document.querySelectorAll('.ai-message');
        if (welcomeMessages.length > 0) {
            const firstMessage = welcomeMessages[0].querySelector('.message-bubble');
            
            if (firstMessage) {
                // Create a friendly welcome message based on form type
                let message = `I've analyzed this form.`;
                
                // Add form type if available
                if (formData.formType && formData.formType !== 'unknown') {
                    const formType = formData.formType;
                    const formPurpose = formData.formPurpose || getFormPurpose(formType);
                    
                    message += ` It appears to be a ${formType} form for ${formPurpose}.`;
                    
                    // Add form-specific tips
                    if (formType === 'login') {
                        message += " Enter your credentials to access your account.";
                    } else if (formType === 'registration') {
                        message += " Fill out the required fields (marked with red borders) to create your account.";
                    } else if (formType === 'checkout') {
                        message += " Complete all required payment details to proceed.";
                    } else if (formType === 'contact') {
                        message += " I can help you compose your message.";
                    } else {
                        message += " How can I help you complete it?";
                    }
                } else {
                    message += " How can I help you fill it out?";
                }
                
                firstMessage.textContent = message;
            }
        }
    }
    
    /**
     * Handle chat form submission
     */
    function handleChatSubmit(e) {
        e.preventDefault();
        const message = chatInput.value.trim();
        
        if (message) {
            // Add user message
            addUserMessage(message);
            
            // Clear input
            chatInput.value = '';
            
            // Process message
            processUserMessage(message);
        }
    }
    
    /**
     * Process user message and generate response
     */
    function processUserMessage(message) {
        const lowerMessage = message.toLowerCase();
        
        // Try to use extension backend if available
        if (chrome.runtime && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const tabId = tabs && tabs[0] ? tabs[0].id : null;
                
                if (tabId) {
                    chrome.runtime.sendMessage({
                        action: 'askQuestion',
                        question: message,
                        formId: currentFormData?.formId,
                        formType: currentFormData?.formType,
                        tabId: tabId
                    }).then(response => {
                        if (response && response.success && response.answer) {
                            // Use answer from backend
                            addAiMessage(response.answer);
                        } else {
                            // Use local response generation
                            generateLocalResponse(lowerMessage);
                        }
                    }).catch(() => {
                        // Use local response generation if messaging fails
                        generateLocalResponse(lowerMessage);
                    });
                } else {
                    // No active tab, use local response
                    generateLocalResponse(lowerMessage);
                }
            });
        } else {
            // Use local response generation
            generateLocalResponse(lowerMessage);
        }
    }
    
    /**
     * Generate response locally
     */
    function generateLocalResponse(lowerMessage) {
        // Handle autofill request
        if (lowerMessage.includes('autofill') || lowerMessage.includes('fill') || lowerMessage.includes('complete')) {
            handleAutofill();
            return;
        }
        
        // Handle form purpose questions
        if (lowerMessage.includes('what is this form') || 
            lowerMessage.includes('what form') || 
            lowerMessage.includes('form for') || 
            lowerMessage.includes('purpose')) {
            
            const formType = currentFormData?.formType || 'registration';
            const formPurpose = currentFormData?.formPurpose || getFormPurpose(formType);
            
            addAiMessage(`This is a ${formType} form for ${formPurpose}. You'll need to fill out the required fields marked with a red border.`);
            return;
        }
        
        // Handle required fields questions
        if (lowerMessage.includes('required') || lowerMessage.includes('mandatory')) {
            const requiredFields = currentFormData?.fields.filter(f => f.required) || [];
            
            if (requiredFields.length > 0) {
                const fieldNames = requiredFields.map(f => f.label).join(', ');
                addAiMessage(`The required fields are: ${fieldNames}. These are marked with a red border.`);
            } else {
                addAiMessage("There are no required fields in this form, but I recommend filling out all fields for completeness.");
            }
            return;
        }
        
        // Handle password questions
        if (lowerMessage.includes('password')) {
            addAiMessage("Your password should be at least 8 characters long and include a mix of uppercase letters, numbers, and special characters for better security. Don't reuse passwords from other sites.");
            return;
        }
        
        // Handle email questions
        if (lowerMessage.includes('email')) {
            addAiMessage("Enter a valid email address that you have access to. You may need to verify this email, so make sure it's one you check regularly.");
            return;
        }
        
        // Handle security questions
        if (lowerMessage.includes('secure') || lowerMessage.includes('security') || lowerMessage.includes('safe')) {
            addAiMessage("This form appears to use standard security practices. Always make sure you're on the correct website before entering sensitive information. Look for https:// in the URL and a lock icon in your browser.");
            return;
        }
        
        // Handle general help
        if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
            addAiMessage("I can help you fill out this form. You can click on any field to learn more about it, ask me specific questions about fields, or use the Auto-fill button to complete the form automatically.");
            return;
        }
        
        // Handle retry questions
        if (lowerMessage.includes('retry') || lowerMessage.includes('refresh') || lowerMessage.includes('reload') || lowerMessage.includes('try again')) {
            addAiMessage("I'll retry detecting form fields on this page now.");
            handleRetryDetection();
            return;
        }
        
        // Generic response for unrecognized questions
        addAiMessage("I'm here to help you complete this form. Feel free to ask about specific fields or use the Auto-fill button to fill the form automatically. Let me know if you have any questions about the information needed.");
    }
    
    /**
     * Handle autofill action
     */
    function handleAutofill() {
        // Visual feedback
        autofillButton.style.backgroundColor = '#34A853';
        setTimeout(() => {
            autofillButton.style.backgroundColor = '';
        }, 1000);
        
        // Send autofill message to content script
        if (chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const tabId = tabs && tabs[0] ? tabs[0].id : null;
                
                if (tabId) {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'autoFillForm',
                        formId: currentFormData?.formId || 'unknown'
                    }).then(response => {
                        if (response && response.success) {
                            addAiMessage(`I've auto-filled ${response.count || 'all'} fields for you. Please review the information before submitting to ensure it's correct.`);
                        } else {
                            addAiMessage("I've auto-filled the form for you. Please review the information before submitting to ensure it's correct.");
                        }
                    }).catch(() => {
                        addAiMessage("I've attempted to auto-fill the form for you. Please check if the fields were filled correctly.");
                    });
                } else {
                    addAiMessage("I've auto-filled the form for you. Please review the information before submitting to ensure it's correct.");
                }
            });
        } else {
            addAiMessage("I've auto-filled the form for you. Please review the information before submitting to ensure it's correct.");
        }
    }
    
    /**
     * Handle runtime messages
     */
    function handleRuntimeMessages(message, sender, sendResponse) {
        console.log('Received runtime message:', message);
        
        if (message.action === 'fieldExplained') {
            addAiMessage(message.explanation);
        } else if (message.action === 'aiResponse') {
            addAiMessage(message.response);
        } else if (message.action === 'formUpdated') {
            if (message.formData) {
                currentFormData = message.formData;
                processFormData(currentFormData);
            }
        } else if (message.action === 'manualFieldSelected') {
            // Handle manually selected field
            if (message.field) {
                console.info('Manual field selected:', message.field);
                
                // Add to current form data
                if (!currentFormData) {
                    currentFormData = {
                        formId: 'manual_form_' + Date.now(),
                        formType: 'manual',
                        fields: []
                    };
                }
                
                // Check if this field already exists (by id or name)
                const existingIndex = currentFormData.fields.findIndex(f => 
                    (f.id && f.id === message.field.id) || 
                    (f.name && f.name === message.field.name)
                );
                
                if (existingIndex >= 0) {
                    // Replace existing field
                    currentFormData.fields[existingIndex] = message.field;
                } else {
                    // Add new field
                    currentFormData.fields.push(message.field);
                }
                
                // Update UI
                updateFieldCount(currentFormData.fields.length);
                displayFields(currentFormData.fields);
            }
        } else if (message.action === 'manualSelectionComplete') {
            // Handle completion of manual selection
            stopManualFieldSelection();
            
            // Update messaging
            addAiMessage("Manual field selection complete. I'll use these fields to help you fill out the form.");
        } else if (message.action === 'detectionFailedTabletFormat') {
            // Special handler for when we detect a table-based form but can't display it
            console.warn('Table format detected but couldn\'t parse fields');
            addAiMessage("I detected a table-based form but couldn't automatically identify the fields. You can try the 'Manual Select' option to pick fields yourself.");
            
            // Show error with manual selection option
            handleNoFieldsDetected();
        }
        
        // Allow async response
        return true;
    }
    
    /**
     * Add user message to chat
     */
    function addUserMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.innerHTML = `
            <div class="message-bubble">${text}</div>
        `;
        messages.appendChild(messageElement);
        scrollToBottom();
    }
    
    /**
     * Add AI message to chat
     */
    function addAiMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message ai-message';
        messageElement.innerHTML = `
            <div class="message-bubble">${text}</div>
        `;
        messages.appendChild(messageElement);
        scrollToBottom();
    }
    
    /**
     * Scroll chat to bottom
     */
    function scrollToBottom() {
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
    
    /**
     * Show loading indicator
     */
    function showLoading(isLoading) {
        if (loadingIndicator) {
            loadingIndicator.style.display = isLoading ? 'inline-block' : 'none';
        }
    }
    
    /**
     * Show element
     */
    function showElement(element) {
        if (element) element.style.display = 'block';
    }
    
    /**
     * Hide element
     */
    function hideElement(element) {
        if (element) element.style.display = 'none';
    }
    
    /**
     * Get appropriate icon for field type
     */
    function getFieldIcon(fieldType) {
        // Map field types to Material Icons
        const iconMap = {
            'username': 'person',
            'email': 'email',
            'password': 'lock',
            'confirmPassword': 'lock',
            'firstName': 'person',
            'lastName': 'person',
            'name': 'person',
            'phone': 'phone',
            'address': 'home',
            'city': 'location_city',
            'state': 'map',
            'zip': 'markunread_mailbox',
            'country': 'public',
            'creditCard': 'credit_card',
            'expiry': 'date_range',
            'cvv': 'security',
            'text': 'text_fields',
            'number': 'pin',
            'date': 'calendar_today',
            'checkbox': 'check_box',
            'radio': 'radio_button_checked',
            'file': 'attach_file',
            'select': 'arrow_drop_down',
            'textarea': 'short_text'
        };
        
        return iconMap[fieldType] || 'text_fields';
    }
    
    /**
     * Get field description based on field type
     */
    function getFieldDescription(field) {
        const type = field.derivedType || field.type;
        
        const descriptions = {
            'username': "This is where you enter your username to identify your account. Choose something you'll remember.",
            'email': "This is where you enter your email address. It will be used for account verification and communication.",
            'password': "Create a secure password with at least 8 characters, including uppercase letters, numbers, and special characters.",
            'confirmPassword': "Re-enter your password exactly as you did above to verify you typed it correctly.",
            'firstName': "Enter your first name (given name).",
            'lastName': "Enter your last name (family name or surname).",
            'name': "Enter your full name as it appears on official documents.",
            'phone': "Enter your phone number, typically formatted as (XXX) XXX-XXXX or similar based on your region.",
            'address': "Enter your street address where you can receive mail.",
            'city': "Enter the city name for your address.",
            'state': "Enter your state or province.",
            'zip': "Enter your postal code or ZIP code.",
            'country': "Select your country from the list.",
            'creditCard': "Enter your credit card number (without spaces).",
            'expiry': "Enter the expiration date of your credit card, typically in MM/YY format.",
            'cvv': "Enter the security code from the back of your credit card (typically 3 digits)."
        };
        
        return descriptions[type] || "Please fill out this field with the appropriate information.";
    }
    
    // Expose key functions for debug integration
    window.displayFields = displayFields;
    window.updateFieldCount = updateFieldCount;
    window.updateWelcomeMessage = updateWelcomeMessage;
    window.processFormData = processFormData;
});