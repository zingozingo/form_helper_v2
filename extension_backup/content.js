// Configuration
// Updated API URL to match the correct endpoint structure
const API_URL = 'http://127.0.0.1:8000/api/process-form';

// Debug logging at script load
console.log("Form Helper content script loaded");

// Extension settings
const extensionSettings = {
  // Threshold for considering a form legitimate (0-100)
  formQualityThreshold: 75,
  
  // Developer mode toggle - when true, displays form scores in console
  // and allows helper UI to appear for forms below threshold
  developerMode: false,
  
  // Strict mode - enforces additional requirements beyond score
  strictMode: true,
  
  // Control which form types are automatically excluded
  excludeSearchForms: true,
  excludeSingleInputForms: true,
  excludeNewsletterForms: true,
  excludeChatInterfaces: true,
  excludeCommentForms: true,
  
  // Document editor detection
  excludeDocumentEditors: true,
  
  // Exclusion domains and URLs (partial matches)
  excludedDomains: [
    'docs.google.com',
    'office.live.com',
    'sharepoint.com',
    'onedrive.live.com',
    'overleaf.com',
    'dropbox.com/paper',
    'notion.so',
    'quip.com',
    'evernote.com',
    'onenote.com',
    'classroom.google.com'
  ]
};

// ===============================
// Initialize analyzers with defensive programming
// ===============================
// NOTE: Password analyzer temporarily disabled until properly implemented
let passwordAnalyzer = null;
/* 
try {
  // Check if PasswordFieldAnalyzer is available
  if (typeof PasswordFieldAnalyzer !== 'undefined') {
    passwordAnalyzer = new PasswordFieldAnalyzer();
    window.passwordAnalyzer = passwordAnalyzer; // Make globally available
    console.log("Form Helper: Password analyzer initialized");
  } else {
    console.warn("Form Helper: PasswordFieldAnalyzer class not found, password enhancement features will be limited");
  }
} catch (error) {
  console.warn("Form Helper: Error initializing password analyzer:", error.message);
}
*/

// Create minimal fallback for password analyzer
window.passwordAnalyzer = {
  enhancePasswordFieldContext: function(fieldContext) {
    // Add minimal password context if not already present
    if (fieldContext && !fieldContext.passwordContext) {
      fieldContext.passwordContext = {
        type: 'default',
        name: 'Password Field',
        description: 'Enter your password',
        securityTips: 'Use a strong, unique password with a mix of character types.'
      };
    }
    return fieldContext;
  }
};

// Initialize form context analyzer
try {
  if (typeof FormContextAnalyzer !== 'undefined') {
    window.formContextAnalyzer = new FormContextAnalyzer();
    console.log("Form Helper: Form context analyzer initialized");
  } else {
    console.warn("Form Helper: FormContextAnalyzer class not found, form context features will be limited");
    // Create minimal fallback
    window.formContextAnalyzer = {
      analyzeFormContext: function() {
        return { form_type: "unknown form", confidence: 0.5 };
      },
      generateFormContextResponse: function(question) {
        return "This appears to be a form for collecting information.";
      }
    };
  }
} catch (error) {
  console.warn("Form Helper: Error initializing form context analyzer:", error.message);
  // Create minimal fallback
  window.formContextAnalyzer = {
    analyzeFormContext: function() {
      return { form_type: "unknown form", confidence: 0.5 };
    },
    generateFormContextResponse: function(question) {
      return "This appears to be a form for collecting information.";
    }
  };
}

// Initialize form quality analyzer
try {
  if (typeof FormQualityAnalyzer !== 'undefined') {
    window.formQualityAnalyzer = new FormQualityAnalyzer();
    console.log("Form Helper: Form quality analyzer initialized");
  } else {
    console.warn("Form Helper: FormQualityAnalyzer class not found, form quality features will be limited");
    // Create minimal fallback
    window.formQualityAnalyzer = {
      analyzeForm: function() {
        return { 
          isLegitimateForm: true, 
          score: 75, 
          confidencePercentage: 75,
          formType: "unknown form"
        };
      }
    };
  }
} catch (error) {
  console.warn("Form Helper: Error initializing form quality analyzer:", error.message);
}

// Add debug function to help diagnose issues
window.debugFormHelper = function() {
  const status = {
    version: "1.0",
    components: {
      passwordAnalyzer: {
        available: typeof PasswordFieldAnalyzer !== 'undefined',
        initialized: passwordAnalyzer !== null,
        instance: passwordAnalyzer ? true : false
      },
      formContextAnalyzer: {
        available: typeof FormContextAnalyzer !== 'undefined',
        initialized: window.formContextAnalyzer ? true : false,
        isFallback: window.formContextAnalyzer && !window.formContextAnalyzer.constructor
      },
      formQualityAnalyzer: {
        available: typeof FormQualityAnalyzer !== 'undefined',
        initialized: window.formQualityAnalyzer ? true : false,
        isFallback: window.formQualityAnalyzer && !window.formQualityAnalyzer.constructor
      }
    },
    environment: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }
  };
  
  console.log("Form Helper Debug Information:", status);
  return status;
};

// Log initialization complete
console.log("Form Helper: Analyzer initialization complete");

// Set up test to verify analyzers are working
setTimeout(() => {
  console.log("Testing form quality analyzer...");
  
  // Find a form on the page for testing
  const testForm = document.querySelector('form');
  
  if (testForm) {
    // Run test analysis on an actual form
    try {
      const testAnalysis = window.formQualityAnalyzer.analyzeForm(testForm);
      console.log("Form Quality Test Results:", testAnalysis);
      
      // Also test form context analyzer
      const testContext = {
        form_type: testAnalysis.formType,
        form_purpose: testAnalysis.formPurpose,
        description: `This appears to be a ${testAnalysis.formType} for ${testAnalysis.formPurpose}.`,
        confidence: testAnalysis.confidencePercentage / 100
      };
      
      const testResponse = window.formContextAnalyzer.generateFormContextResponse(
        "what is this form for?", 
        testContext
      );
      
      console.log("Form Context Test Response:", testResponse);
    } catch (error) {
      console.error("Error during analyzer tests:", error);
    }
  } else {
    console.log("No forms available for testing analyzers");
  }
}, 1000);

/**
 * Determines if a form is a "real" interactive form worth analyzing
 * @param {HTMLFormElement} formElement - The form element to analyze
 * @param {Array} fields - Array of extracted field information
 * @returns {Object} Result with isReal boolean and confidence score
 */
function isRealForm(formElement, fields) {
  // Start with base confidence of 0.1
  let confidence = 0.1;
  let reasons = [];
  
  // If we don't have fields data, extract it
  if (!fields || fields.length === 0) {
    if (formElement) {
      const inputs = formElement.querySelectorAll('input, select, textarea');
      fields = Array.from(inputs).map(input => ({
        type: input.type || 'text',
        name: input.name || '',
        id: input.id || ''
      }));
    } else {
      return { isReal: false, confidence: 0, reasons: ['No form element or fields provided'] };
    }
  }
  
  // Check 1: Forms with multiple input fields (at least 3)
  const fieldCount = fields.length;
  if (fieldCount >= 5) {
    confidence += 0.25;
    reasons.push(`Has ${fieldCount} fields (5+ fields)`);
  } else if (fieldCount >= 3) {
    confidence += 0.15;
    reasons.push(`Has ${fieldCount} fields (3+ fields)`);
  } else if (fieldCount >= 1) {
    confidence += 0.05;
    reasons.push(`Has ${fieldCount} fields (1+ fields)`);
  } else {
    reasons.push('No input fields');
    return { isReal: false, confidence: 0, reasons };
  }
  
  // Check 2: Forms with submit buttons
  let hasSubmitButton = false;
  
  if (formElement) {
    // Look for submit buttons within the form
    const submitButtons = formElement.querySelectorAll('button[type="submit"], input[type="submit"]');
    if (submitButtons.length > 0) {
      hasSubmitButton = true;
    }
    
    // Also look for buttons that look like submit buttons even if not explicitly typed
    const possibleSubmitButtons = Array.from(formElement.querySelectorAll('button, input[type="button"]'));
    for (const button of possibleSubmitButtons) {
      const buttonText = button.textContent.toLowerCase() || button.value?.toLowerCase() || '';
      if (buttonText.includes('submit') || 
          buttonText.includes('send') || 
          buttonText.includes('sign in') || 
          buttonText.includes('login') ||
          buttonText.includes('register') ||
          buttonText.includes('create account') ||
          buttonText.includes('save') ||
          buttonText.includes('continue') ||
          buttonText.includes('checkout') ||
          buttonText.includes('pay') ||
          buttonText.includes('sign up')) {
        hasSubmitButton = true;
        break;
      }
    }
  }
  
  // If form doesn't have a submit button, check for JavaScript-driven forms with certain event handlers
  if (!hasSubmitButton && formElement) {
    // Forms with onsubmit handlers are likely real forms
    if (formElement.hasAttribute('onsubmit') || 
        formElement.querySelectorAll('[onclick]').length > 0) {
      hasSubmitButton = true;
    }
  }
  
  if (hasSubmitButton) {
    confidence += 0.15;
    reasons.push('Has submit button or submission mechanism');
  }
  
  // Check 3: Forms with field labels
  let labelCount = 0;
  if (formElement) {
    labelCount = formElement.querySelectorAll('label').length;
    
    // Also check for aria-label attributes
    const ariaLabeledFields = formElement.querySelectorAll('[aria-label]').length;
    labelCount += ariaLabeledFields;
    
    // Consider placeholder attributes as a weak form of labeling
    const placeholderFields = formElement.querySelectorAll('[placeholder]').length;
    labelCount += placeholderFields * 0.5; // Count placeholders as half a label
  }
  
  if (labelCount >= fieldCount * 0.7) {
    confidence += 0.15;
    reasons.push('Most fields have labels');
  } else if (labelCount >= fieldCount * 0.4) {
    confidence += 0.1;
    reasons.push('Some fields have labels');
  }
  
  // Check 4: Forms with input fields of different types
  const fieldTypes = new Set();
  fields.forEach(field => {
    if (field.type) fieldTypes.add(field.type);
  });
  
  if (fieldTypes.size >= 3) {
    confidence += 0.15;
    reasons.push(`Has diverse field types (${fieldTypes.size} different types)`);
  } else if (fieldTypes.size >= 2) {
    confidence += 0.1;
    reasons.push(`Has multiple field types (${fieldTypes.size} different types)`);
  }
  
  // Check 5: Check for common form structures, classes, and IDs
  const formClasses = formElement ? formElement.className.toLowerCase() : '';
  const formId = formElement ? formElement.id.toLowerCase() : '';
  const formAction = formElement ? formElement.getAttribute('action') : '';
  
  // Look for common form identifiers in classes, IDs, and action URLs
  const commonFormPatterns = [
    { pattern: /login|signin|log-in|sign-in/, boost: 0.2, reason: 'Login form pattern' },
    { pattern: /register|signup|sign-up|registration|create-account|join/, boost: 0.2, reason: 'Registration form pattern' },
    { pattern: /checkout|payment|billing|order|purchase/, boost: 0.2, reason: 'Checkout/Payment form pattern' },
    { pattern: /contact|feedback|enquiry|inquiry|message/, boost: 0.2, reason: 'Contact form pattern' },
    { pattern: /search/, boost: 0.15, reason: 'Search form pattern' },
    { pattern: /subscribe|newsletter/, boost: 0.15, reason: 'Subscription form pattern' },
    { pattern: /form/, boost: 0.05, reason: 'Generic form pattern' }
  ];
  
  for (const pattern of commonFormPatterns) {
    if ((formId && pattern.pattern.test(formId)) || 
        (formClasses && pattern.pattern.test(formClasses)) || 
        (formAction && pattern.pattern.test(formAction))) {
      confidence += pattern.boost;
      reasons.push(pattern.reason);
      break; // Only apply the highest matching pattern
    }
  }
  
  // Check 6: Has field groups or specific sets of related fields
  // Look for field name patterns that suggest a cohesive form
  const fieldNames = fields.map(f => f.name ? f.name.toLowerCase() : '').filter(Boolean);
  
  // Define known field groupings that suggest real forms
  const fieldGroups = [
    {
      group: ['email', 'password'],
      boost: 0.15,
      reason: 'Login field group (email+password)'
    },
    {
      group: ['first', 'last', 'email'],
      boost: 0.15,
      reason: 'Personal info field group'
    },
    {
      group: ['card', 'number', 'expir', 'cvv'],
      boost: 0.2,
      reason: 'Payment field group'
    },
    {
      group: ['address', 'city', 'state', 'zip'],
      boost: 0.15,
      reason: 'Address field group'
    }
  ];
  
  for (const group of fieldGroups) {
    // Count how many fields from this group are present
    const matchingFields = group.group.filter(groupField => 
      fieldNames.some(fieldName => fieldName.includes(groupField))
    );
    
    // If we have most of the fields in this group
    if (matchingFields.length >= group.group.length * 0.7) {
      confidence += group.boost;
      reasons.push(group.reason);
    }
  }
  
  // Look for sensitive fields that suggest a significant form
  const hasSensitiveFields = fields.some(field => {
    const fieldName = (field.name || '').toLowerCase();
    const fieldType = (field.type || '').toLowerCase();
    
    return fieldType === 'password' || 
           fieldName.includes('password') ||
           fieldName.includes('credit') ||
           fieldName.includes('card') ||
           fieldName.includes('ssn') ||
           fieldName.includes('social');
  });
  
  if (hasSensitiveFields) {
    confidence += 0.15;
    reasons.push('Contains sensitive information fields');
  }
  
  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);
  
  // Consider a form "real" if confidence is above threshold
  const isReal = confidence >= 0.4;
  
  return {
    isReal,
    confidence,
    reasons,
    fieldCount,
    fieldTypes: Array.from(fieldTypes)
  };
}

// Store global form context for the page
let globalFormContext = null;

// Listen for page load to detect forms
document.addEventListener('DOMContentLoaded', detectForms);

// Also run immediately in case page is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(detectForms, 500);  // Small delay to ensure DOM is fully available
}

// Listen for messages from the side panel or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request);
  
  // Handle form scanning request from side panel
  if (request.action === 'scanForms') {
    console.log('Scanning forms for side panel');
    
    // Run scan process asynchronously to prevent message channel from closing
    setTimeout(() => {
      try {
        const formData = scanFormsForPanel();
        
        if (formData.fields.length > 0) {
          chrome.runtime.sendMessage({
            action: 'formDetected',
            formData: formData
          });
        } else {
          chrome.runtime.sendMessage({
            action: 'noFormsFound'
          });
        }
      } catch (error) {
        console.error('Error scanning forms:', error);
        // Notify of error
        chrome.runtime.sendMessage({
          action: 'formError',
          error: error.message
        });
      }
    }, 0);
    
    // Send an immediate response before the async operation completes
    sendResponse({success: true, message: 'Form scan initiated'});
    return true;
  }
  
  // Handle open panel request
  if (request.action === 'openPanel') {
    console.log('Opening form helper panel');
    // Notify background script to open the panel
    chrome.runtime.sendMessage({
      action: 'openPanel'
    });
    sendResponse({success: true});
    return true;
  }
  
  // Handle form context response request from panel
  if (request.action === 'getFormContextResponse') {
    console.log('Generating form context response for:', request.question);
    
    // Always provide a response - if no context is available, create a basic one
    try {
      // Use a fallback context if necessary
      const context = globalFormContext || {
        form_type: "web form",
        form_purpose: "collecting information",
        description: "This form allows you to submit information to the website.",
        confidence: 0.5
      };
      
      // Log the context we're using for debugging
      console.log('Using form context for response:', context);
      
      // Generate a response using the analyzer
      let response;
      
      if (typeof window.formContextAnalyzer !== 'undefined') {
        response = window.formContextAnalyzer.generateFormContextResponse(
          request.question, 
          context
        );
      } else {
        // Fallback if analyzer isn't available
        console.warn('FormContextAnalyzer not available, using manual response');
        response = `This appears to be a ${context.form_type} for ${context.form_purpose}. I can help you understand what each field is for if you have specific questions.`;
      }
      
      console.log('Generated form context response:', response);
      
      // Send the response back
      sendResponse({
        success: true, 
        formContextResponse: response
      });
    } catch (error) {
      console.error('Error generating form context response:', error);
      
      // Even if there's an error, provide a helpful fallback response
      sendResponse({
        success: true, 
        formContextResponse: "This appears to be a form for collecting information. I can help you understand what specific fields are for if you have questions about them."
      });
    }
    
    return true;
  }
  
  // Handle auto-fill request from side panel
  if (request.action === 'autoFillForm') {
    console.log('Auto-filling form fields');
    const formId = request.formId;
    const profileData = request.profileData || null;
    const fieldsCount = autoFillFormFields(formId, profileData);
    sendResponse({success: true, count: fieldsCount});
    return true;
  }
  
  // Handle field highlight request
  if (request.action === 'highlightField') {
    console.log('Highlighting field:', request.fieldName);
    const success = highlightField(request.fieldName);
    sendResponse({success: success});
    return true;
  }
  
  // Handle field question from chat
  if (request.action === 'fieldQuestion') {
    console.log('Field question:', request.fieldName, request.question);
    
    // Find field context
    let fieldContext = null;
    const allInputs = document.querySelectorAll('input, select, textarea');
    
    for (const input of allInputs) {
      if ((input.name && input.name === request.fieldName) || 
          (input.id && input.id === request.fieldName)) {
        fieldContext = extractFieldContext(input);
        break;
      }
    }
    
    // Find form context - use any form the field belongs to, or any form on the page
    let form = null;
    if (fieldContext) {
      // Find the form that contains this field
      const input = document.querySelector(`[name="${request.fieldName}"], [id="${request.fieldName}"]`);
      if (input) {
        form = input.closest('form');
      }
    }
    
    // If no form found for the field, take the first form on the page
    if (!form) {
      const forms = document.querySelectorAll('form');
      if (forms.length > 0) {
        form = forms[0];
      }
    }
    
    // Get enhanced form context with deep analysis
    const enhancedFormContext = detectFormContext(form, [fieldContext].filter(Boolean));
    
    // Add additional form context analysis to help the SmartCopilot AI
    enhancedFormContext.formStructure = {
      field_count: Array.from(document.querySelectorAll('input, select, textarea')).length,
      form_title: document.title,
      form_url: window.location.href,
      page_headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim()).join(' | ')
    };
    
    // Get page context
    const pageTitle = document.title;
    const pageURL = window.location.href;
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    
    // Send context to panel for AI processing
    sendResponse({
      success: true,
      fieldContext: fieldContext,
      formContext: enhancedFormContext,
      pageContext: {
        title: pageTitle,
        url: pageURL,
        description: metaDescription
      }
    });
    
    return true;
  }
  
  // Original message handlers from popup
  if (request.action === 'getFormFields') {
    console.log('Getting form fields for popup');
    
    // Find all forms on the page
    const forms = document.querySelectorAll('form');
    if (forms.length === 0) {
      sendResponse({fields: []});
      return true;
    }
    
    // Extract fields from the first form
    const form = forms[0];
    const fields = [];
    
    // Process all input elements
    form.querySelectorAll('input, select, textarea').forEach(input => {
      const fieldType = input.type || input.tagName.toLowerCase();
      
      // Skip submit buttons and hidden fields
      if (['submit', 'button', 'image', 'reset', 'hidden'].includes(fieldType)) {
        return;
      }
      
      // Get field identifiers
      const fieldName = input.name || '';
      const fieldId = input.id || '';
      
      // Skip if no identifier
      if (!fieldName && !fieldId) {
        return;
      }
      
      // Get field label
      let label = '';
      if (fieldId) {
        const labelElement = document.querySelector(`label[for="${fieldId}"]`);
        if (labelElement) {
          label = labelElement.textContent.trim();
        }
      }
      
      // Use fallbacks if no label found
      if (!label) {
        label = input.getAttribute('placeholder') || 
               input.getAttribute('aria-label') || 
               fieldName.replace(/_/g, ' ');
      }
      
      // Add to fields array
      fields.push({
        name: fieldName || fieldId,
        id: fieldId,
        type: fieldType,
        label: label,
        required: input.required
      });
    });
    
    sendResponse({fields: fields});
    return true;
  }
  
  if (request.action === 'fillField') {
    console.log('Filling field from popup:', request.fieldName);
    
    // Find the field
    const fieldName = request.fieldName;
    const forms = document.querySelectorAll('form');
    if (forms.length === 0) {
      sendResponse({success: false, message: 'No forms found'});
      return true;
    }
    
    const form = forms[0];
    const field = form.querySelector(`[name="${fieldName}"], [id="${fieldName}"]`);
    
    if (field) {
      // Generate appropriate value based on field type
      let value = 'Sample text';
      
      switch (field.type) {
        case 'email':
          value = 'example@example.com';
          break;
        case 'password':
          value = 'SecurePassword123!';
          break;
        case 'date':
          value = '2023-01-01';
          break;
        case 'number':
          value = '42';
          break;
        case 'tel':
          value = '555-123-4567';
          break;
      }
      
      // Set the value
      field.value = value;
      
      // Highlight the field briefly
      const originalBackground = field.style.backgroundColor;
      field.style.backgroundColor = '#fffacd';
      setTimeout(() => {
        field.style.backgroundColor = originalBackground;
      }, 1000);
      
      sendResponse({success: true});
    } else {
      sendResponse({success: false, message: 'Field not found'});
    }
    
    return true;
  }
  
  // Always return true for async sendResponse
  return true;
});

// Check if current page is a document editor or excluded domain
function isExcludedEnvironment() {
  // Check URL against excluded domains
  const currentUrl = window.location.href.toLowerCase();
  
  // Check against excluded domains list
  if (extensionSettings.excludedDomains && extensionSettings.excludedDomains.length > 0) {
    for (const domain of extensionSettings.excludedDomains) {
      if (currentUrl.includes(domain.toLowerCase())) {
        console.log(`Form Helper: Skipping detection - page matches excluded domain: ${domain}`);
        return true;
      }
    }
  }
  
  // Check for content editable sections (common in document editors)
  const editableSections = document.querySelectorAll('[contenteditable="true"]');
  if (editableSections.length > 0 && editableSections[0].offsetHeight > 300) {
    console.log('Form Helper: Skipping detection - page has large editable sections');
    return true;
  }
  
  // Check for editor-specific UI elements
  const hasEditorToolbar = document.querySelector('.toolbar, .editor-toolbar, .ql-toolbar, .docs-toolbar');
  const hasEditorClass = document.documentElement.classList.contains('editor') || 
                        document.body.classList.contains('editor') ||
                        document.querySelector('.editor-container, .document-editor');
  
  if (hasEditorToolbar && hasEditorClass) {
    console.log('Form Helper: Skipping detection - page has editor UI elements');
    return true;
  }
  
  return false;
}

// Detect forms on the page with enhanced formQualityAnalyzer
function detectForms() {
  console.log("Form Helper: Scanning for forms on page...");
  
  // Check if we're in an excluded environment
  if (isExcludedEnvironment()) {
    console.log("Form Helper: Page appears to be a document editor or excluded domain - skipping form detection");
    return;
  }
  
  // Find all forms in the document
  const forms = document.querySelectorAll('form');
  
  // Track legitimate forms found
  let legitimateFormCount = 0;
  let detectedForms = [];
  const threshold = extensionSettings.formQualityThreshold;
  
  // Process traditional HTML forms first
  if (forms.length > 0) {
    console.log(`Form Helper: Found ${forms.length} potential forms on page`);
    
    // Analyze each form with the quality analyzer
    forms.forEach((form, index) => {
      // Add a unique identifier if not present
      if (!form.id) {
        form.id = `form-helper-form-${index}`;
      }
      
      // Analyze with the quality analyzer
      const formAnalysis = window.formQualityAnalyzer.analyzeForm(form, {
        threshold: threshold,
        strictMode: extensionSettings.strictMode
      });
      
      // Store analysis on the form element for reference
      form._formHelper = {
        isLegitimate: formAnalysis.isLegitimateForm,
        score: formAnalysis.score,
        confidence: formAnalysis.confidencePercentage / 100,
        formType: formAnalysis.formType,
        formPurpose: formAnalysis.formPurpose,
        detailedScores: formAnalysis.detailedScores,
        exclusionReason: formAnalysis.exclusionReason,
        reasonCodes: formAnalysis.reasonCodes || []
      };
      
      // Log analysis in developer mode
      if (extensionSettings.developerMode) {
        console.log(`Form #${index} (${form.id}) analysis:`, formAnalysis);
      }
      
      // Only process legitimate forms or lower threshold in dev mode
      const isLegitimateForm = formAnalysis.isLegitimateForm;
      const showInDevMode = extensionSettings.developerMode && formAnalysis.score >= 50;
      
      if (isLegitimateForm || showInDevMode) {
        legitimateFormCount++;
        detectedForms.push(form);
        
        // Add processing button next to the form
        addFormHelperButton(form, form._formHelper);
      }
    });
    
    console.log(`Form Helper: Detected ${legitimateFormCount} legitimate forms out of ${forms.length} total forms`);
  }
  
  // Enhanced form detection - look for virtual forms from standalone inputs
  // Only do this if explicitly allowed in strict mode
  let hasLegitimateVirtualForm = false;
  
  if (legitimateFormCount === 0 && (!extensionSettings.strictMode || extensionSettings.developerMode)) {
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    
    // Check number of unique interactive input fields - require 3+ in strict mode
    const interactiveFieldTypes = ['text', 'email', 'password', 'tel', 'number', 'url', 
                                 'select', 'textarea', 'checkbox', 'radio'];
    
    // Filter and count unique interactive input fields
    const interactiveInputs = Array.from(inputs).filter(input => {
      const inputType = input.type || (input.tagName === 'SELECT' ? 'select' : 
                                    (input.tagName === 'TEXTAREA' ? 'textarea' : 'text'));
      return interactiveFieldTypes.includes(inputType);
    });
    
    // Only proceed if we have sufficient interactive inputs
    const minRequiredInputs = extensionSettings.strictMode ? 3 : 2;
    
    if (interactiveInputs.length >= minRequiredInputs) {
      console.log(`Form Helper: Found ${interactiveInputs.length} interactive input fields outside of forms`);
      
      // Check for submit-like buttons on the page
      const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
      const submitLikeButtons = Array.from(document.querySelectorAll('button, input[type="button"]')).filter(btn => {
        const text = (btn.textContent || btn.value || '').toLowerCase();
        return text.includes('submit') || text.includes('send') || text.includes('save') ||
               text.includes('continue') || text.includes('next') || text.includes('sign in') ||
               text.includes('login') || text.includes('register');
      });
      
      // In strict mode, require a submit mechanism
      const hasSubmitMechanism = submitButtons.length > 0 || submitLikeButtons.length > 0;
      if (extensionSettings.strictMode && !hasSubmitMechanism && !extensionSettings.developerMode) {
        console.log("Form Helper: No submit mechanism found for virtual form in strict mode, skipping");
        return;
      }
      
      // Create a virtual form wrapper for these inputs
      const virtualForm = document.createElement('div');
      virtualForm.id = 'form-helper-virtual-form';
      virtualForm._isVirtual = true; // Mark as virtual
      
      // Collect fields for analysis without requiring a form element
      const fields = interactiveInputs.map(input => ({
        type: input.type || (input.tagName === 'SELECT' ? 'select' : 
                           (input.tagName === 'TEXTAREA' ? 'textarea' : 'text')),
        name: input.name || '',
        id: input.id || '',
        placeholder: input.placeholder || '',
        required: input.hasAttribute('required'),
        hasLabel: !!document.querySelector(`label[for="${input.id}"]`) || 
                  !!input.closest('label'),
        ariaLabel: input.getAttribute('aria-label') || ''
      }));
      
      // Run the quality analyzer on the virtual form
      const formAnalysis = window.formQualityAnalyzer.analyzeForm(null, fields, {
        threshold: threshold,
        strictMode: extensionSettings.strictMode
      });
      
      if (extensionSettings.developerMode) {
        console.log("Standalone inputs analysis:", formAnalysis);
      }
      
      // Only treat as a form if it passes our legitimacy threshold
      const isLegitimateForm = formAnalysis.isLegitimateForm;
      const showInDevMode = extensionSettings.developerMode && formAnalysis.score >= 50;
      
      if (isLegitimateForm || showInDevMode) {
        hasLegitimateVirtualForm = true;
        legitimateFormCount++;
        
        // Store analysis on the virtual form element for reference
        virtualForm._formHelper = {
          isLegitimate: formAnalysis.isLegitimateForm,
          score: formAnalysis.score,
          confidence: formAnalysis.confidencePercentage / 100,
          formType: formAnalysis.formType,
          formPurpose: formAnalysis.formPurpose,
          detailedScores: formAnalysis.detailedScores,
          reasonCodes: formAnalysis.reasonCodes || [],
          isVirtual: true
        };
        
        // Add Form Helper button for these standalone inputs
        addFormHelperButton(virtualForm, virtualForm._formHelper);
        
        // Notify the extension popup about found "forms"
        chrome.runtime.sendMessage({
          action: 'formsFound',
          count: 1,
          isVirtual: true,
          score: formAnalysis.score,
          confidence: formAnalysis.confidencePercentage / 100,
          formType: formAnalysis.formType
        });
      }
    }
  }
  
  // Only notify about legitimate forms
  if (legitimateFormCount > 0) {
    // Notify the extension popup about found forms
    chrome.runtime.sendMessage({
      action: 'formsFound',
      count: legitimateFormCount,
      forms: detectedForms.map(form => ({
        id: form.id,
        score: form._formHelper?.score || 0,
        confidence: form._formHelper?.confidence || 0,
        formType: form._formHelper?.formType || 'Unknown form',
        formPurpose: form._formHelper?.formPurpose || ''
      }))
    });
  } else {
    console.log("Form Helper: No legitimate forms detected on page");
    chrome.runtime.sendMessage({
      action: 'noFormsFound'
    });
  }
}

// Extract rich context from form fields
function extractFieldContext(input) {
  // Basic field properties
  const fieldType = input.type || input.tagName.toLowerCase();
  const fieldName = input.name || '';
  const fieldId = input.id || '';
  
  // Skip if no way to identify it
  if (!fieldName && !fieldId && !input.placeholder) {
    return null;
  }
  
  // Get field label using various methods
  let label = '';
  
  // Method 1: Associated label element
  if (fieldId) {
    const labelElement = document.querySelector(`label[for="${fieldId}"]`);
    if (labelElement) {
      label = labelElement.textContent.trim();
    }
  }
  
  // Method 2: Parent label element
  if (!label && input.parentElement && input.parentElement.tagName === 'LABEL') {
    const labelText = input.parentElement.textContent.replace(input.value, '').trim();
    if (labelText) {
      label = labelText;
    }
  }
  
  // Method 3: Look for heading elements or divs near the input
  if (!label) {
    const parent = input.parentElement;
    if (parent) {
      // Look for sibling elements that might be labels
      const siblings = Array.from(parent.childNodes);
      for (const sibling of siblings) {
        if (sibling !== input && sibling.nodeType === Node.ELEMENT_NODE) {
          if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL', 'SPAN', 'DIV', 'P'].includes(sibling.tagName)) {
            const siblingText = sibling.textContent.trim();
            if (siblingText && siblingText.length < 50) { // Reasonable label length
              label = siblingText;
              break;
            }
          }
        }
      }
    }
  }
  
  // Method 4: Use fallbacks if no label found
  if (!label) {
    label = input.getAttribute('placeholder') || 
           input.getAttribute('aria-label') || 
           fieldName.replace(/_/g, ' ') ||
           fieldId.replace(/_/g, ' ') ||
           fieldType.charAt(0).toUpperCase() + fieldType.slice(1) + ' Field';
  }
  
  // Find nearby help text
  let helpText = '';
  
  // Look for common help text patterns
  const parentNode = input.parentNode;
  if (parentNode) {
    // Find siblings with help text classes
    const helpElements = parentNode.querySelectorAll('.help-text, .hint, .description, .form-text, .field-hint, [aria-describedby], .help-block');
    if (helpElements.length > 0) {
      helpText = helpElements[0].textContent.trim();
    }
    
    // Look for elements with IDs referenced by aria-describedby
    const ariaDescribedBy = input.getAttribute('aria-describedby');
    if (ariaDescribedBy && !helpText) {
      const helpElement = document.getElementById(ariaDescribedBy);
      if (helpElement) {
        helpText = helpElement.textContent.trim();
      }
    }
    
    // Look for small tags or spans that might contain help text
    if (!helpText) {
      const smallElements = parentNode.querySelectorAll('small, .text-muted, .form-text');
      if (smallElements.length > 0) {
        helpText = smallElements[0].textContent.trim();
      }
    }
  }
  
  // Get validation rules
  let validationRules = {};
  
  // HTML5 validation attributes
  if (input.hasAttribute('required')) {
    validationRules.required = true;
  }
  
  // Special handling for password fields - make them required by default
  // unless explicitly marked as optional with aria-required="false"
  if (input.type === 'password' || 
      (input.name && input.name.toLowerCase().includes('password'))) {
    validationRules.required = 
      !(input.getAttribute('aria-required') === 'false' || 
        input.hasAttribute('data-optional'));
  }
  
  if (input.hasAttribute('pattern')) {
    validationRules.pattern = input.getAttribute('pattern');
  }
  
  if (input.hasAttribute('minlength')) {
    validationRules.minLength = input.getAttribute('minlength');
  }
  
  if (input.hasAttribute('maxlength')) {
    validationRules.maxLength = input.getAttribute('maxlength');
  }
  
  if (input.hasAttribute('min')) {
    validationRules.min = input.getAttribute('min');
  }
  
  if (input.hasAttribute('max')) {
    validationRules.max = input.getAttribute('max');
  }
  
  // For select elements, get options
  let options = [];
  if (input.tagName === 'SELECT') {
    options = Array.from(input.options).map(option => ({
      value: option.value,
      text: option.text,
      selected: option.selected
    }));
  }
  
  // For radio buttons and checkboxes, get all options in the same group
  if (fieldName && (fieldType === 'radio' || fieldType === 'checkbox')) {
    const sameNameInputs = document.querySelectorAll(`input[name="${fieldName}"]`);
    options = Array.from(sameNameInputs).map(option => {
      let optionLabel = '';
      
      // Try to find label for this option
      if (option.id) {
        const labelEl = document.querySelector(`label[for="${option.id}"]`);
        if (labelEl) {
          optionLabel = labelEl.textContent.trim();
        }
      }
      
      // If no label found and option is inside a label
      if (!optionLabel && option.parentElement && option.parentElement.tagName === 'LABEL') {
        optionLabel = option.parentElement.textContent.replace(option.value, '').trim();
      }
      
      return {
        value: option.value,
        text: optionLabel || option.value,
        checked: option.checked
      };
    });
  }
  
  // Guess field purpose by analyzing name, id, and label
  let fieldPurpose = guessFieldPurpose(fieldName, fieldId, label, fieldType);
  
  // Determine if the field is required
  // For password fields, set required to true by default unless explicitly marked optional
  let isRequired = input.required;
  
  if (fieldType === 'password' || (fieldName && fieldName.toLowerCase().includes('password'))) {
    isRequired = validationRules.required !== false; // Default to true unless explicitly set to false
  } else {
    isRequired = input.required || validationRules.required === true;
  }
  
  // Create base field context
  const fieldContext = {
    name: fieldName || fieldId || label.toLowerCase().replace(/\s+/g, '_'),
    id: fieldId,
    type: fieldType,
    element: fieldName || fieldId || input.placeholder, // Store reference to find element later
    label: label,
    required: isRequired,
    value: input.value || '',
    helpText: helpText,
    validationRules: validationRules,
    options: options,
    purpose: fieldPurpose,
    placeholder: input.placeholder || '',
    ariaLabel: input.getAttribute('aria-label') || '',
    ariaRequired: input.getAttribute('aria-required') || '',
    ariaInvalid: input.getAttribute('aria-invalid') || '',
    className: input.className || ''
  };
  
  // Enhance password fields with context awareness
  if (fieldType === 'password' || (fieldName && fieldName.toLowerCase().includes('password'))) {
    try {
      // Get all fields in the form for context
      let allFields = [];
      let formElement = null;
      
      if (input.form) {
        formElement = input.form;
        const formInputs = formElement.querySelectorAll('input, select, textarea');
        // Just use basic field information to avoid recursion
        formInputs.forEach(formInput => {
          if (formInput !== input) {
            allFields.push({
              name: formInput.name || '',
              id: formInput.id || '',
              type: formInput.type || formInput.tagName.toLowerCase(),
              label: formInput.getAttribute('aria-label') || ''
            });
          }
        });
      }
      
      // Get form context with defensive check
      let formContext = null;
      try {
        if (typeof detectFormContext === 'function') {
          formContext = detectFormContext(formElement, [fieldContext, ...allFields]);
        }
      } catch (error) {
        console.warn('Error detecting form context:', error.message);
        // Use basic fallback context
        formContext = { form_type: "unknown form", confidence: 0.5 };
      }
      
      // Check for password analyzer using both global variables and direct reference
      // This provides multiple fallback paths
      const analyzer = window.passwordAnalyzer || passwordAnalyzer;
      
      if (analyzer && typeof analyzer.enhancePasswordFieldContext === 'function') {
        // Use the available analyzer with try/catch for safety
        try {
          const enhancedContext = analyzer.enhancePasswordFieldContext(
            fieldContext, allFields, formElement, formContext
          );
          
          if (enhancedContext) {
            return enhancedContext;
          }
        } catch (error) {
          console.warn('Error in password enhancement:', error.message);
          // Fall through to return the basic context
        }
      } else {
        // Add basic password context even without the analyzer
        fieldContext.passwordContext = {
          type: 'unknown',
          name: 'Password Field',
          description: 'Enter a password',
          securityTips: 'Always use strong, unique passwords with a mix of character types.'
        };
      }
    } catch (error) {
      console.warn('Error enhancing password field:', error.message);
    }
  }
  
  return fieldContext;
}

// Helper function to guess field purpose
function guessFieldPurpose(name, id, label, type) {
  const textToCheck = (name + ' ' + id + ' ' + label).toLowerCase();
  
  // Common field purposes
  const patterns = {
    'email': ['email', 'e-mail'],
    'password': ['password', 'pwd', 'pass', 'current-password', 'new-password', 
                 'create-password', 'confirm-password', 'verify-password', 'passwd'],
    'confirm_password': ['confirm password', 'verify password', 'retype password', 
                       'repeat password', 'confirm pwd', 'verify pwd', 'password again'],
    'username': ['username', 'user name', 'login', 'userid', 'user id', 'account name'],
    'first_name': ['first name', 'firstname', 'fname', 'given name', 'forename'],
    'last_name': ['last name', 'lastname', 'lname', 'surname', 'family name'],
    'full_name': ['full name', 'fullname', 'name', 'your name', 'display name'],
    'phone': ['phone', 'telephone', 'tel', 'mobile', 'cell', 'phone number'],
    'address': ['address', 'street', 'addr', 'address line', 'street address'],
    'city': ['city', 'town', 'municipality', 'locality'],
    'state': ['state', 'province', 'region', 'territory', 'prefecture'],
    'zip': ['zip', 'postal', 'postcode', 'zip code', 'postal code'],
    'country': ['country', 'nation', 'nationality'],
    'date_of_birth': ['birth', 'dob', 'birthday', 'date of birth', 'birth date', 'birthdate'],
    'credit_card': ['credit card', 'card number', 'cc number', 'ccnum', 'card no', 'credit card no'],
    'cvv': ['cvv', 'cvc', 'security code', 'card verification', 'card security code', 'csv'],
    'expiration': ['expiration', 'expiry', 'exp date', 'expiry date', 'valid thru', 'valid until'],
    'search': ['search', 'find', 'query', 'lookup', 'search for'],
    'comment': ['comment', 'message', 'feedback', 'additional information', 'notes'],
    'subject': ['subject', 'title', 'topic', 'regarding', 're:'],
    'quantity': ['quantity', 'qty', 'amount', 'number', 'count', 'how many'],
    'price': ['price', 'cost', 'amount', 'fee', 'charge', 'total'],
    'coupon': ['coupon', 'discount', 'promo', 'voucher', 'offer code', 'discount code'],
    'newsletter': ['newsletter', 'subscribe', 'subscription', 'updates', 'mailing list']
  };
  
  // Check against patterns
  for (const [purpose, keywords] of Object.entries(patterns)) {
    if (keywords.some(keyword => textToCheck.includes(keyword))) {
      return purpose;
    }
  }
  
  // Special case for password fields identified by type
  if (type === 'password') {
    return 'password';
  }
  
  // If no specific match, use the field type as fallback
  return type;
}

// Enhanced form context detection using the FormContextAnalyzer with fallbacks
function detectFormContext(formElement, fields) {
  try {
    // Check if we have the formContextAnalyzer available
    if (window.formContextAnalyzer && typeof window.formContextAnalyzer.analyzeFormContext === 'function') {
      // Get page information
      const pageInfo = {
        url: window.location.href,
        title: document.title,
        metaDescription: document.querySelector('meta[name="description"]')?.content || ''
      };
      
      // Use the enhanced analyzer with error handling
      try {
        const enhancedContext = window.formContextAnalyzer.analyzeFormContext(formElement, fields, pageInfo);
        
        // Store the context globally for later use
        globalFormContext = enhancedContext;
        
        return enhancedContext;
      } catch (analyzerError) {
        console.warn("Form Helper: Error in form context analyzer:", analyzerError.message);
        // Fall through to basic context
      }
    } else {
      console.warn("Form Helper: Form context analyzer not available or missing method");
    }
  } catch (error) {
    console.warn("Form Helper: Error accessing form context analyzer:", error.message);
  }
  
  // Fallback to basic context if analyzer isn't available or fails
  const basicContext = {
    form_type: "unknown form",
    form_purpose: "",
    confidence: 0
  };
  
  // Perform basic form type detection based on fields
  if (fields && fields.length > 0) {
    // Check for common field combinations
    const hasEmail = fields.some(f => (f.name || '').toLowerCase().includes('email') || f.type === 'email');
    const hasPassword = fields.some(f => (f.name || '').toLowerCase().includes('password') || f.type === 'password');
    const hasConfirmPassword = fields.some(f => {
      const fieldName = (f.name || '').toLowerCase();
      const fieldLabel = (f.label || '').toLowerCase();
      return (fieldName.includes('confirm') && fieldName.includes('password')) || 
             (fieldLabel.includes('confirm') && fieldLabel.includes('password'));
    });
    const hasName = fields.some(f => (f.name || '').toLowerCase().includes('name'));
    const hasMessage = fields.some(f => (f.name || '').toLowerCase().includes('message') || (f.name || '').toLowerCase().includes('comment'));
    
    // Simple form type detection
    if (hasPassword && hasConfirmPassword) {
      basicContext.form_type = "registration form";
      basicContext.form_purpose = "creating a new user account";
      basicContext.confidence = 0.8;
    } else if (hasEmail && hasPassword && !hasName) {
      basicContext.form_type = "login form";
      basicContext.form_purpose = "authenticating user access";
      basicContext.confidence = 0.7;
    } else if (hasEmail && hasMessage) {
      basicContext.form_type = "contact form";
      basicContext.form_purpose = "sending a message or inquiry";
      basicContext.confidence = 0.7;
    }
  }
  
  // Store this basic context globally
  globalFormContext = basicContext;
  
  console.log("Detected basic form context:", basicContext);
  return basicContext;
}

// Enhanced function for side panel form scanning with new formQualityAnalyzer
function scanFormsForPanel() {
  console.log("Form Helper: Scanning forms for side panel");
  
  // Find all forms in the document
  const forms = document.querySelectorAll('form');
  
  // Generate a unique form ID for this page
  let formId = 'form_' + Date.now();
  
  // Prepare fields array
  let fields = [];
  
  // Will track the form element we're working with
  let activeForm = null;
  
  // Will hold our form quality analysis results
  let formQualityResults = null;
  
  const threshold = extensionSettings.formQualityThreshold;
  
  // First try to find legitimate forms
  if (forms.length > 0) {
    // Look for forms already analyzed during initial detection
    const legitimateForms = Array.from(forms).filter(form => 
      form._formHelper && form._formHelper.isLegitimate === true
    );
    
    // If we found pre-analyzed legitimate forms, use the highest scoring one
    if (legitimateForms.length > 0) {
      // Sort by score (highest first)
      legitimateForms.sort((a, b) => 
        (b._formHelper?.score || 0) - (a._formHelper?.score || 0)
      );
      
      // Use the highest scoring form
      activeForm = legitimateForms[0];
      formQualityResults = activeForm._formHelper;
      formId = activeForm.id;
      
      console.log(`Using highest scoring form (${formQualityResults.score}):`, activeForm.id);
    } else {
      // No pre-analyzed forms, let's analyze them now
      let bestForm = null;
      let bestResults = null;
      
      // Analyze all forms and pick the best one
      for (const form of forms) {
        // Run quality analysis
        const analysisResults = window.formQualityAnalyzer.analyzeForm(form, {
          threshold: threshold
        });
        
        // Store on form element for future reference if not already there
        if (!form._formHelper) {
          form._formHelper = {
            isLegitimate: analysisResults.isLegitimateForm,
            score: analysisResults.score,
            confidence: analysisResults.confidencePercentage / 100,
            formType: analysisResults.formType,
            formPurpose: analysisResults.formPurpose,
            detailedScores: analysisResults.detailedScores,
            exclusionReason: analysisResults.exclusionReason
          };
        }
        
        // Track the best form based on score
        if (analysisResults.isLegitimateForm && 
            (!bestResults || analysisResults.score > bestResults.score)) {
          bestForm = form;
          bestResults = analysisResults;
        }
      }
      
      // If we found a legitimate form, use it
      if (bestForm && bestResults) {
        activeForm = bestForm;
        formQualityResults = bestForm._formHelper;
        
        // Add a unique identifier if not present
        if (!activeForm.id) {
          activeForm.id = formId;
        } else {
          formId = activeForm.id;
        }
        
        console.log(`Using best legitimate form (${formQualityResults.score}):`, activeForm.id);
      }
    }
    
    // If we have an active form, process its fields
    if (activeForm) {
      // Process all input elements in the form with enhanced field context
      activeForm.querySelectorAll('input, select, textarea').forEach(input => {
        // Skip submit buttons and hidden fields
        if (['submit', 'button', 'image', 'reset', 'hidden'].includes(input.type)) {
          return;
        }
        
        // Get rich field context
        const fieldContext = extractFieldContext(input);
        
        // Skip if no valid context could be extracted
        if (!fieldContext) {
          return;
        }
        
        // Add to fields array
        fields.push(fieldContext);
      });
    }
  }
  
  // If no legitimate forms found in standard form elements, check standalone inputs
  if (!activeForm || fields.length === 0) {
    console.log("No legitimate forms found, checking for standalone inputs");
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    
    if (inputs.length >= 2) { // Only bother if there are at least 2 inputs
      console.log(`Found ${inputs.length} standalone input fields`);
      
      // Collect fields for analysis without requiring a form element
      const fieldsForAnalysis = Array.from(inputs).map(input => ({
        type: input.type || (input.tagName === 'SELECT' ? 'select' : 
                           (input.tagName === 'TEXTAREA' ? 'textarea' : 'text')),
        name: input.name || '',
        id: input.id || '',
        placeholder: input.placeholder || '',
        required: input.hasAttribute('required'),
        hasLabel: !!document.querySelector(`label[for="${input.id}"]`) || 
                  !!input.closest('label'),
        ariaLabel: input.getAttribute('aria-label') || ''
      }));
      
      // Run the quality analyzer on these standalone fields
      const analysisResults = window.formQualityAnalyzer.analyzeForm(null, fieldsForAnalysis, {
        threshold: threshold
      });
      
      if (extensionSettings.developerMode) {
        console.log("Standalone inputs analysis:", analysisResults);
      }
      
      // Consider these inputs a form if they pass the quality threshold
      if (analysisResults.isLegitimateForm || 
          (extensionSettings.developerMode && analysisResults.score >= 40)) {
          
        formQualityResults = {
          isLegitimate: analysisResults.isLegitimateForm,
          score: analysisResults.score,
          confidence: analysisResults.confidencePercentage / 100,
          formType: analysisResults.formType,
          formPurpose: analysisResults.formPurpose,
          detailedScores: analysisResults.detailedScores
        };
        
        // Process these inputs with enhanced field context to get proper field metadata
        inputs.forEach(input => {
          // Skip submit buttons
          if (['submit', 'button', 'image', 'reset'].includes(input.type)) {
            return;
          }
          
          // Get rich field context
          const fieldContext = extractFieldContext(input);
          
          // Skip if no valid context could be extracted
          if (!fieldContext) {
            return;
          }
          
          // Add to fields array
          fields.push(fieldContext);
        });
        
        formId = 'standalone_inputs';
      }
    }
  }
  
  // If we still have no usable fields, abort
  if (fields.length === 0) {
    console.log("No usable form fields found on this page");
    return { 
      formId: null, 
      fields: [],
      formContext: { form_type: "unknown form", confidence: 0 },
      pageContext: {
        title: document.title,
        url: window.location.href
      },
      isLegitimateForm: false,
      score: 0
    };
  }
  
  console.log(`Form Helper: Found ${fields.length} usable fields in form/page`);
  
  // Extract form level context (if available)
  let basicFormContext = {};
  if (activeForm) {
    basicFormContext = {
      id: activeForm.id,
      name: activeForm.getAttribute('name') || '',
      action: activeForm.getAttribute('action') || '',
      method: activeForm.getAttribute('method') || '',
      enctype: activeForm.getAttribute('enctype') || '',
      novalidate: activeForm.hasAttribute('novalidate'),
      autocomplete: activeForm.getAttribute('autocomplete') || '',
      score: formQualityResults?.score || 0,
      confidence: formQualityResults?.confidence || 0,
      formType: formQualityResults?.formType || 'unknown form',
      formPurpose: formQualityResults?.formPurpose || ''
    };
  } else {
    basicFormContext = {
      id: formId,
      type: 'virtual',
      context: document.title,
      score: formQualityResults?.score || 0,
      confidence: formQualityResults?.confidence || 0,
      formType: formQualityResults?.formType || 'unknown form',
      formPurpose: formQualityResults?.formPurpose || ''
    };
  }

  // Create a detailed form context
  const formContext = {
    ...basicFormContext,
    form_type: formQualityResults?.formType || 'unknown form',
    form_purpose: formQualityResults?.formPurpose || 'collecting information',
    description: `This appears to be a ${formQualityResults?.formType || 'form'} for ${formQualityResults?.formPurpose || 'collecting information'}.`,
    confidence: formQualityResults?.confidence || 0,
    field_count: fields.length,
    quality_score: formQualityResults?.score || 0,
    details: {
      fields_analyzed: fields.length,
      field_types: [...new Set(fields.map(f => f.type))],
      form_scores: formQualityResults?.detailedScores || {}
    }
  };
  
  // Store globally for future reference
  globalFormContext = formContext;
  
  // Send a message to the background script
  chrome.runtime.sendMessage({
    action: 'formProcessed',
    formData: { 
      formId: formId, 
      fields: fields,
      formContext: formContext,
      pageContext: {
        title: document.title,
        url: window.location.href,
        metaDescription: document.querySelector('meta[name="description"]')?.content || ''
      },
      isLegitimateForm: formQualityResults?.isLegitimate || false,
      score: formContext.quality_score
    }
  });
  
  // Return the form data
  return { 
    formId: formId, 
    fields: fields,
    formContext: formContext,
    pageContext: {
      title: document.title,
      url: window.location.href
    },
    isLegitimateForm: formQualityResults?.isLegitimate || false,
    score: formContext.quality_score
  };
}

// Auto-fill all form fields - new function for side panel
function autoFillFormFields(formId, profileData) {
  console.log(`Auto-filling form: ${formId}`, profileData);
  
  // Find the form
  let form = document.getElementById(formId);
  let inputs = [];
  
  // If dealing with standalone inputs or virtual form
  if (formId === 'standalone_inputs' || !form) {
    inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
  } else {
    // Get all input elements within the form
    inputs = form.querySelectorAll('input, select, textarea');
  }
  
  let filledCount = 0;
  
  // Fill each field based on type
  inputs.forEach(input => {
    // Skip hidden, submit, buttons
    if (['submit', 'button', 'image', 'reset', 'hidden'].includes(input.type)) {
      return;
    }
    
    const fieldName = input.name || input.id || '';
    const fieldLabel = input.getAttribute('placeholder') || 
                       input.getAttribute('aria-label') || 
                       '';
    const lowerName = fieldName.toLowerCase();
    const lowerLabel = fieldLabel.toLowerCase();
    
    let value = '';
    let usedProfileData = false;
    
    // Try to get value from profile first if available
    if (profileData && Object.keys(profileData).length > 0) {
      // Try exact field name match first
      if (profileData[fieldName]) {
        value = profileData[fieldName];
        usedProfileData = true;
      } 
      // Try field name variations
      else if (profileData[lowerName]) {
        value = profileData[lowerName];
        usedProfileData = true;
      }
      // Try fuzzy matching based on field type and name patterns
      else {
        // Email fields
        if ((lowerName.includes('email') || lowerLabel.includes('email')) && profileData.email) {
          value = profileData.email;
          usedProfileData = true;
        } 
        // Name fields
        else if (lowerName.includes('name') || lowerLabel.includes('name')) {
          if ((lowerName.includes('first') || lowerLabel.includes('first')) && profileData.first_name) {
            value = profileData.first_name;
            usedProfileData = true;
          } else if ((lowerName.includes('last') || lowerLabel.includes('last')) && profileData.last_name) {
            value = profileData.last_name;
            usedProfileData = true;
          } else if (profileData.name) {
            value = profileData.name;
            usedProfileData = true;
          }
        } 
        // Phone fields
        else if ((lowerName.includes('phone') || lowerLabel.includes('phone') ||
                 lowerName.includes('tel') || lowerLabel.includes('tel')) && profileData.phone) {
          value = profileData.phone;
          usedProfileData = true;
        } 
        // Address fields
        else if (lowerName.includes('address') || lowerLabel.includes('address')) {
          if (profileData.address) {
            value = profileData.address;
            usedProfileData = true;
          }
        }
        // City fields
        else if (lowerName.includes('city') || lowerLabel.includes('city')) {
          if (profileData.city) {
            value = profileData.city;
            usedProfileData = true;
          }
        }
        // State fields
        else if ((lowerName.includes('state') || lowerLabel.includes('state') ||
                 lowerName.includes('province') || lowerLabel.includes('province')) && profileData.state) {
          value = profileData.state;
          usedProfileData = true;
        }
        // ZIP/Postal code fields
        else if ((lowerName.includes('zip') || lowerLabel.includes('zip') ||
                 lowerName.includes('postal') || lowerLabel.includes('postal')) && profileData.zip) {
          value = profileData.zip;
          usedProfileData = true;
        }
        // Country fields
        else if (lowerName.includes('country') || lowerLabel.includes('country')) {
          if (profileData.country) {
            value = profileData.country;
            usedProfileData = true;
          }
        }
      }
    }
    
    // If no profile data matched, generate sample value
    if (!usedProfileData) {
      // Generate appropriate value based on field type and name
      if (lowerName.includes('email') || lowerLabel.includes('email') || input.type === 'email') {
        value = 'example@example.com';
      } else if (lowerName.includes('name') || lowerLabel.includes('name')) {
        if (lowerName.includes('first') || lowerLabel.includes('first')) {
          value = 'John';
        } else if (lowerName.includes('last') || lowerLabel.includes('last')) {
          value = 'Doe';
        } else {
          value = 'John Doe';
        }
      } else if (lowerName.includes('phone') || lowerLabel.includes('phone') ||
                 lowerName.includes('tel') || lowerLabel.includes('tel') || input.type === 'tel') {
        value = '555-123-4567';
      } else if (lowerName.includes('address') || lowerLabel.includes('address')) {
        value = '123 Main St';
      } else if (lowerName.includes('city') || lowerLabel.includes('city')) {
        value = 'New York';
      } else if (lowerName.includes('state') || lowerLabel.includes('state')) {
        value = 'NY';
      } else if (lowerName.includes('zip') || lowerLabel.includes('zip') ||
                 lowerName.includes('postal') || lowerLabel.includes('postal')) {
        value = '10001';
      } else if (lowerName.includes('country') || lowerLabel.includes('country')) {
        value = 'United States';
      } else if (lowerName.includes('password') || lowerLabel.includes('password') || input.type === 'password') {
        value = 'SecurePassword123!';
      } else {
        // Default based on input type
        switch (input.type) {
          case 'date':
            value = '2023-01-01';
            break;
          case 'number':
            value = '42';
            break;
          case 'checkbox':
            input.checked = true;
            filledCount++;
            return;
          case 'radio':
            input.checked = true;
            filledCount++;
            return;
          default:
            value = 'Sample text';
        }
      }
      
      // If this was generated data, save it to the profile for future use
      if (fieldName) {
        // Send message to panel to save this value
        chrome.runtime.sendMessage({
          action: 'saveFieldValue',
          fieldName: fieldName,
          fieldValue: value
        });
      }
    }
    
    // Set the value
    input.value = value;
    filledCount++;
    
    // Trigger change event
    const event = new Event('change', { bubbles: true });
    input.dispatchEvent(event);
    
    // Highlight the field briefly
    highlightField(input.name || input.id);
  });
  
  // Return the number of fields filled
  return filledCount;
}

// Highlight a specific field - new function for side panel
function highlightField(fieldSelector) {
  if (!fieldSelector) return false;
  
  console.log(`Highlighting field: ${fieldSelector}`);
  
  // Find the field by name or id
  let field = document.querySelector(`[name="${fieldSelector}"], [id="${fieldSelector}"]`);
  
  // If not found, try looking by placeholder
  if (!field) {
    field = document.querySelector(`[placeholder="${fieldSelector}"]`);
  }
  
  // If still not found, try a case-insensitive match on various attributes
  if (!field) {
    const allInputs = document.querySelectorAll('input, select, textarea');
    for (const input of allInputs) {
      if (input.name && input.name.toLowerCase() === fieldSelector.toLowerCase() ||
          input.id && input.id.toLowerCase() === fieldSelector.toLowerCase() ||
          input.placeholder && input.placeholder.toLowerCase() === fieldSelector.toLowerCase() ||
          input.getAttribute('aria-label') && input.getAttribute('aria-label').toLowerCase() === fieldSelector.toLowerCase()) {
        field = input;
        break;
      }
    }
  }
  
  if (field) {
    // Save original style
    const originalBackground = field.style.backgroundColor;
    const originalBorder = field.style.border;
    const originalBoxShadow = field.style.boxShadow;
    
    // Apply highlight style
    field.style.backgroundColor = '#fffacd';
    field.style.border = '2px solid #4285f4';
    field.style.boxShadow = '0 0 8px rgba(66, 133, 244, 0.6)';
    
    // Scroll the field into view
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Remove highlight after a delay
    setTimeout(() => {
      field.style.backgroundColor = originalBackground;
      field.style.border = originalBorder;
      field.style.boxShadow = originalBoxShadow;
    }, 2000);
    
    return true;
  }
  
  console.log(`Could not find field: ${fieldSelector}`);
  return false;
}

// Add a helper button next to the form with confidence indicator
function addFormHelperButton(form, formAnalysis = null) {
  // Create button container for better styling
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'form-helper-button-container';
  buttonContainer.style.cssText = `
    display: flex;
    align-items: center;
    margin: 10px 0;
    font-family: Arial, sans-serif;
    position: relative;
    z-index: 9999;
  `;
  
  // Create the main button
  const button = document.createElement('button');
  
  // Set button text based on form type
  const formType = formAnalysis?.formType || 'form';
  const formPurpose = formAnalysis?.formPurpose || '';
  const score = formAnalysis?.score || 0;
  
  // Format form type for display (remove 'form' word and capitalize)
  let displayType = formType.replace(' form', '').trim();
  displayType = displayType.charAt(0).toUpperCase() + displayType.slice(1);
  
  // Format text based on confidence and form type
  if (score >= 80 && displayType !== 'Unknown') {
    button.textContent = `Form Helper - ${displayType}`;
  } else {
    button.textContent = 'Form Helper';
  }
  
  // Only show score in developer mode
  if (extensionSettings.developerMode) {
    // In developer mode, add score to button text
    button.textContent += ` (${score})`;
  }
  
  button.className = 'form-helper-button';
  
  // Set button color based on score
  let buttonColor = '#4285f4'; // Default blue
  if (formAnalysis) {
    if (score >= 80) {
      buttonColor = '#0f9d58'; // Green for high confidence
    } else if (score >= 65) {
      buttonColor = '#4285f4'; // Blue for medium confidence
    } else if (score >= 50) {
      buttonColor = '#f4b400'; // Yellow for lower confidence
    } else {
      buttonColor = '#db4437'; // Red for very low confidence
    }
  }
  
  button.style.cssText = `
    position: relative;
    background-color: ${buttonColor};
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    display: flex;
    align-items: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    transition: background-color 0.2s, transform 0.1s;
  `;
  
  // Hover and active states
  button.onmouseover = () => {
    button.style.backgroundColor = adjustColor(buttonColor, 1.1);
  };
  button.onmouseout = () => {
    button.style.backgroundColor = buttonColor;
  };
  button.onmousedown = () => {
    button.style.transform = 'scale(0.98)';
  };
  button.onmouseup = () => {
    button.style.transform = 'scale(1)';
  };
  
  // Add confidence indicator dot
  if (formAnalysis) {
    const confidenceIndicator = document.createElement('span');
    confidenceIndicator.className = 'form-helper-confidence';
    confidenceIndicator.style.cssText = `
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
      background-color: ${buttonColor};
      box-shadow: 0 0 3px rgba(0,0,0,0.3);
    `;
    button.prepend(confidenceIndicator);
    
    // Generate tooltip content
    const tooltipContent = [];
    
    // Add form type and purpose
    if (displayType !== 'Unknown') {
      tooltipContent.push(`Form Type: ${displayType}`);
    }
    if (formPurpose) {
      tooltipContent.push(`Purpose: ${formPurpose}`);
    }
    
    // Only show score and detailed info in developer mode
    if (extensionSettings.developerMode) {
      // Add score info in developer mode
      tooltipContent.push(`Form Quality Score: ${score}/100`);
      
      // Add detailed scoring breakdown
      if (formAnalysis.detailedScores) {
        tooltipContent.push('');
        tooltipContent.push('Detailed Scores:');
        
        // Get top 3-5 contributing factors
        const scores = Object.entries(formAnalysis.detailedScores)
          .sort((a, b) => b[1].weightedScore - a[1].weightedScore)
          .slice(0, 5);
        
        scores.forEach(([key, value]) => {
          tooltipContent.push(`- ${formatScoreKey(key)}: ${Math.round(value.weightedScore * 10) / 10}`);
        });
      }
      
      // Add reason codes if available
      if (formAnalysis.reasonCodes && formAnalysis.reasonCodes.length > 0) {
        tooltipContent.push('');
        tooltipContent.push('Reason Codes:');
        formAnalysis.reasonCodes.forEach(code => {
          tooltipContent.push(`- ${formatReasonCode(code)}`);
        });
      }
      
      // Add exclusion reason if applicable
      if (formAnalysis.exclusionReason) {
        tooltipContent.push('');
        tooltipContent.push(`Exclusion: ${formatExclusionReason(formAnalysis.exclusionReason)}`);
      }
    } else {
      // For regular users, just show what the helper can do
      tooltipContent.push('Click to get help with this form');
    }
    
    // Set tooltip
    button.title = tooltipContent.join('\n');
  }
  
  // Add button to container
  buttonContainer.appendChild(button);
  
  // For dev mode, add small indicator showing form details
  if (extensionSettings.developerMode) {
    const devIndicator = document.createElement('div');
    devIndicator.className = 'form-helper-dev-indicator';
    devIndicator.style.cssText = `
      font-size: 10px;
      margin-left: 10px;
      color: #555;
      background: #f5f5f5;
      padding: 3px 6px;
      border-radius: 3px;
      border: 1px solid #ddd;
    `;
    
    // Include score and reason codes in developer mode
    let indicatorText = `${displayType} | Score: ${score}`;
    
    // Add first reason code if available
    if (formAnalysis?.reasonCodes && formAnalysis.reasonCodes.length > 0) {
      indicatorText += ` | ${formAnalysis.reasonCodes[0]}`;
    }
    
    devIndicator.textContent = indicatorText;
    buttonContainer.appendChild(devIndicator);
  }
  
  // Insert button container before the form
  if (form._isVirtual) {
    // For virtual forms, find a good location for the button
    const goodLocation = document.querySelector('form') || 
                         document.querySelector('input') || 
                         document.querySelector('h1') ||
                         document.body.firstChild;
    
    if (goodLocation && goodLocation.parentNode) {
      goodLocation.parentNode.insertBefore(buttonContainer, goodLocation);
    } else {
      document.body.appendChild(buttonContainer);
    }
  } else {
    // For regular forms, insert before the form
    if (form.parentNode) {
      form.parentNode.insertBefore(buttonContainer, form);
    }
  }
  
  // Update click handler to open side panel
  button.addEventListener('click', () => {
    // Send message to background script to open side panel
    chrome.runtime.sendMessage({
      action: 'openSidePanel',
      formId: form.id,
      formAnalysis: {
        score: formAnalysis?.score || 0,
        confidence: formAnalysis?.confidence || 0,
        formType: formAnalysis?.formType || 'unknown form',
        formPurpose: formAnalysis?.formPurpose || ''
      }
    });
    
    // Also trigger form scan with a short delay to ensure panel is open
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: 'scanForm',
        formId: form.id
      });
    }, 500);
  });
  
  return buttonContainer;
}

// Helper functions for formatting
function adjustColor(hexColor, factor) {
  // Convert hex to RGB
  let r = parseInt(hexColor.substring(1, 3), 16);
  let g = parseInt(hexColor.substring(3, 5), 16);
  let b = parseInt(hexColor.substring(5, 7), 16);
  
  // Adjust colors
  r = Math.min(255, Math.round(r * factor));
  g = Math.min(255, Math.round(g * factor));
  b = Math.min(255, Math.round(b * factor));
  
  // Convert back to hex
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function formatScoreKey(key) {
  // Convert camelCase to words with proper capitalization
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatExclusionReason(reason) {
  switch(reason) {
    case 'documentEditor':
      return 'Document editor detected';
    case 'singleSearch':
      return 'Single search field';
    case 'singleComment':
      return 'Comment field only';
    case 'chatInterface':
      return 'Chat interface';
    case 'newsletterSignup':
      return 'Simple newsletter signup';
    case 'noInputFields':
      return 'No input fields found';
    default:
      return reason;
  }
}

function formatReasonCode(code) {
  switch(code) {
    case 'EXCLUDED_TYPE':
      return 'Form type is excluded';
    case 'NO_INPUT_FIELDS':
      return 'No input fields found';
    case 'MISSING_REQUIRED_ELEMENTS':
      return 'Missing required HTML elements';
    case 'NO_SUBMIT_MECHANISM':
      return 'No submit button or mechanism';
    case 'INSUFFICIENT_FIELDS':
      return 'Too few form fields';
    case 'INSUFFICIENT_INTERACTIVE_FIELDS':
      return 'Not enough interactive fields';
    case 'NO_SUBMIT_BUTTON':
      return 'Missing submit button';
    case 'BELOW_THRESHOLD':
      return 'Below quality threshold';
    default:
      return code.replace(/_/g, ' ').toLowerCase();
  }
}

// Process form and send to backend
function processForm(form) {
  console.log(`Processing form: ${form.id}`);
  
  // Get the form HTML
  const formHTML = form.outerHTML;
  
  // Debug: log the form HTML length
  console.log(`Form HTML length: ${formHTML.length} characters`);
  console.log(`Form HTML preview: ${formHTML.substring(0, 100)}...`);
  
  // Create overlay to show processing
  showProcessingOverlay(form);
  
  // First test the debug endpoint
  console.log("Testing debug endpoint first...");
  fetch('http://127.0.0.1:8000/api/debug', {
    method: 'GET'
  })
  .then(response => {
    console.log("Debug endpoint response status:", response.status);
    return response.json();
  })
  .then(data => {
    console.log("Debug endpoint response:", data);
    
    // If debug endpoint works, proceed with main API call
    console.log("Debug endpoint successful, now calling main API...");
    
    // Updated payload structure to match backend expectations
    const payload = {
      type: "html",  // Changed from content_type to type
      content: formHTML
    };
    
    console.log("Sending payload to API:", payload);
    
    // Send to backend
    return fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  })
  .then(response => {
    console.log('Main API response status:', response.status);
    if (!response.ok) {
      return response.text().then(text => {
        console.error('Error response body:', text);
        throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('Success data:', data);
    hideProcessingOverlay();
    displayFormFields(form, data.fields);
  })
  .catch(error => {
    console.error('Detailed Error:', error);
    hideProcessingOverlay();
    showError(form, "Failed to process form. Please try again.");
  });
}

// Show processing overlay
function showProcessingOverlay(form) {
  const overlay = document.createElement('div');
  overlay.id = 'form-helper-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  `;
  
  const spinner = document.createElement('div');
  spinner.textContent = 'Processing...';
  overlay.appendChild(spinner);
  
  document.body.appendChild(overlay);
}

// Hide processing overlay
function hideProcessingOverlay() {
  const overlay = document.getElementById('form-helper-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Display detected form fields
function displayFormFields(form, fields) {
  // Debug: log the fields received
  console.log('Displaying fields:', fields);
  
  // Create container for field information
  const container = document.createElement('div');
  container.className = 'form-helper-results';
  container.style.cssText = `
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 15px;
    margin: 10px 0;
    background-color: #f8f9fa;
    font-family: Arial, sans-serif;
  `;
  
  // Add heading
  const heading = document.createElement('h3');
  heading.textContent = 'Form Helper Results';
  heading.style.margin = '0 0 10px 0';
  container.appendChild(heading);
  
  // Create table for fields
  const table = document.createElement('table');
  table.style.cssText = `
    width: 100%;
    border-collapse: collapse;
  `;
  
  // Add table header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Field</th>
      <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Type</th>
      <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Actions</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Add fields to table
  const tbody = document.createElement('tbody');
  fields.forEach(field => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${field.name || 'Unnamed'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${field.type || 'Unknown'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">
        <button class="form-helper-fill-btn" data-field="${field.name}">Fill</button>
        <button class="form-helper-explain-btn" data-field="${field.name}">Explain</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
  
  // Insert results before the form
  form.parentNode.insertBefore(container, form);
  
  // Add event listeners for fill and explain buttons
  const fillButtons = container.querySelectorAll('.form-helper-fill-btn');
  fillButtons.forEach(button => {
    button.addEventListener('click', () => {
      const fieldName = button.getAttribute('data-field');
      fillField(form, fieldName);
    });
  });
  
  const explainButtons = container.querySelectorAll('.form-helper-explain-btn');
  explainButtons.forEach(button => {
    button.addEventListener('click', () => {
      const fieldName = button.getAttribute('data-field');
      explainField(fieldName);
    });
  });
}

// Fill a form field with sample data
function fillField(form, fieldName) {
  const field = form.querySelector(`[name="${fieldName}"]`);
  if (field) {
    // Add logic here to get appropriate values based on field type
    if (field.type === 'email') {
      field.value = 'example@example.com';
    } else if (field.type === 'text') {
      field.value = 'Sample Text';
    } else if (field.type === 'date') {
      field.value = '2023-01-01';
    } else if (field.type === 'password') {
      field.value = 'SecurePassword123!';
    } else if (field.type === 'tel' || field.type === 'phone') {
      field.value = '555-123-4567';
    } else if (field.type === 'number') {
      field.value = '42';
    } else {
      field.value = 'Sample Value';
    }
    
    // Highlight the field briefly
    const originalBackground = field.style.backgroundColor;
    field.style.backgroundColor = '#fffacd';
    setTimeout(() => {
      field.style.backgroundColor = originalBackground;
    }, 1000);
  }
}

// Show error message
function showError(form, message) {
  console.error('Showing error:', message);
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'form-helper-error';
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    color: red;
    margin: 10px 0;
    padding: 10px;
    border: 1px solid red;
    border-radius: 4px;
    background-color: #ffeeee;
  `;
  
  form.parentNode.insertBefore(errorDiv, form);
  
  // Remove after 5 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Explain field function
function explainField(fieldName) {
  console.log(`Explaining field: ${fieldName}`);
  
  // AI assistant endpoint for field explanations
  const AI_ENDPOINT = 'http://127.0.0.1:8000/api/explain-field';
  
  // Create a small popup for the explanation
  const explanationDiv = document.createElement('div');
  explanationDiv.className = 'form-helper-explanation';
  explanationDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    padding: 15px;
    max-width: 400px;
    z-index: 10000;
  `;
  
  const header = document.createElement('h3');
  header.textContent = `About the "${fieldName}" field`;
  header.style.margin = '0 0 10px 0';
  
  const content = document.createElement('p');
  content.textContent = 'Loading explanation...';
  
  const closeButton = document.createElement('button');
  closeButton.textContent = 'OK';
  closeButton.style.cssText = `
    background-color: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    margin-top: 10px;
    cursor: pointer;
    float: right;
  `;
  closeButton.onclick = () => explanationDiv.remove();
  
  explanationDiv.appendChild(header);
  explanationDiv.appendChild(content);
  explanationDiv.appendChild(closeButton);
  document.body.appendChild(explanationDiv);
  
  // Call the AI endpoint
  fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      field_name: fieldName
    })
  })
  .then(response => {
    console.log('Response status:', response.status);
    return response.text().then(text => {
      console.log('Response body:', text);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        throw new Error('Invalid JSON response');
      }
    });
  })
  .then(data => {
    console.log('Success data:', data);
    content.textContent = data.explanation || 'No explanation provided';
  })
  .catch(error => {
    console.error('Detailed Error:', error);
    content.textContent = `Could not get explanation for "${fieldName}". Please try again later.`;
  });
}