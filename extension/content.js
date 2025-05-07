// Configuration
// Updated API URL to match the correct endpoint structure
const API_URL = 'http://127.0.0.1:8000/api/process-form';

// Debug logging at script load
console.log("Form Helper content script loaded");

// Initialize analyzers
const passwordAnalyzer = new PasswordFieldAnalyzer();
// Initialize form context analyzer
window.formContextAnalyzer = new FormContextAnalyzer();

// For debugging - generate a test response
console.log("Testing form context analyzer...");
try {
  // Create a basic context for testing
  const testContext = {
    form_type: "login form",
    form_purpose: "signing into your account",
    description: "This form allows you to authenticate and access your user account.",
    confidence: 0.9
  };
  
  // Test the response generation
  const testResponse = window.formContextAnalyzer.generateFormContextResponse(
    "what is this form for?", 
    testContext
  );
  
  console.log("Test form context response:", testResponse);
} catch (error) {
  console.error("Error testing form context analyzer:", error);
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

// Detect forms on the page - Original function
function detectForms() {
  console.log("Form Helper: Scanning for forms on page...");
  
  // Find all forms in the document
  const forms = document.querySelectorAll('form');
  
  // Enhanced form detection - look for inputs outside of forms too
  let hasStandaloneInputs = false;
  if (forms.length === 0) {
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    hasStandaloneInputs = inputs.length > 0;
    
    if (hasStandaloneInputs) {
      console.log(`Form Helper: Found ${inputs.length} input fields outside of forms`);
      
      // Create a virtual form wrapper for these inputs
      const virtualForm = document.createElement('div');
      virtualForm.id = 'form-helper-virtual-form';
      virtualForm._isVirtual = true; // Mark as virtual
      
      // Add Form Helper button for these standalone inputs
      addFormHelperButton(virtualForm);
      
      // Notify the extension popup about found "forms"
      chrome.runtime.sendMessage({
        action: 'formsFound',
        count: 1,
        isVirtual: true
      });
    }
  }
  
  if (forms.length > 0) {
    console.log(`Form Helper: Found ${forms.length} forms on page`);
    
    // Add Form Helper buttons to each form
    forms.forEach((form, index) => {
      // Add a unique identifier if not present
      if (!form.id) {
        form.id = `form-helper-form-${index}`;
      }
      
      // Add processing button next to the form
      addFormHelperButton(form);
    });
    
    // Notify the extension popup about found forms
    chrome.runtime.sendMessage({
      action: 'formsFound',
      count: forms.length
    });
  } else if (!hasStandaloneInputs) {
    console.log("Form Helper: No forms or input fields detected on page");
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
      
      // Get form context
      let formContext = null;
      if (typeof detectFormContext === 'function') {
        formContext = detectFormContext(formElement, [fieldContext, ...allFields]);
      }
      
      // Only try to use passwordAnalyzer if it's defined
      if (typeof passwordAnalyzer !== 'undefined') {
        return passwordAnalyzer.enhancePasswordFieldContext(
          fieldContext, allFields, formElement, formContext
        );
      }
    } catch (error) {
      console.error('Error enhancing password field:', error);
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

// Enhanced form context detection using the FormContextAnalyzer
function detectFormContext(formElement, fields) {
  // Check if we have the formContextAnalyzer available
  if (typeof window.formContextAnalyzer !== 'undefined') {
    // Get page information
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.content || ''
    };
    
    // Use the enhanced analyzer
    const enhancedContext = window.formContextAnalyzer.analyzeFormContext(formElement, fields, pageInfo);
    
    // Store the context globally for later use
    globalFormContext = enhancedContext;
    
    return enhancedContext;
  }
  
  // Fallback to basic context if analyzer isn't available
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

// New function for side panel form scanning
function scanFormsForPanel() {
  console.log("Form Helper: Scanning forms for side panel");
  
  // Find all forms in the document
  const forms = document.querySelectorAll('form');
  
  // Generate a unique form ID for this page
  let formId = 'form_' + Date.now();
  
  // Prepare fields array
  let fields = [];
  
  // If no traditional forms found, look for standalone inputs
  if (forms.length === 0) {
    console.log("No forms found, checking for standalone inputs");
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    
    if (inputs.length > 0) {
      console.log(`Found ${inputs.length} standalone input fields`);
      
      // Process these standalone inputs with enhanced field context
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
  } else {
    // For simplicity, focus on the first form for now
    const form = forms[0];
    
    // Add a unique identifier if not present
    if (!form.id) {
      form.id = formId;
    } else {
      formId = form.id;
    }
    
    // Process all input elements in the form with enhanced field context
    form.querySelectorAll('input, select, textarea').forEach(input => {
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
  
  console.log(`Form Helper: Found ${fields.length} fields in form/page`);
  
  // Extract form level context (if available)
  let basicFormContext = {};
  if (forms.length > 0) {
    const form = forms[0];
    basicFormContext = {
      id: form.id,
      name: form.getAttribute('name') || '',
      action: form.getAttribute('action') || '',
      method: form.getAttribute('method') || '',
      enctype: form.getAttribute('enctype') || '',
      novalidate: form.hasAttribute('novalidate'),
      autocomplete: form.getAttribute('autocomplete') || ''
    };
  } else {
    basicFormContext = {
      id: formId,
      type: 'virtual',
      context: document.title
    };
  }

// Enhanced intelligent form context detection
const enhancedFormContext = detectFormContext(forms.length > 0 ? forms[0] : null, fields);

// Merge the technical form data with the intelligent context detection
const formContext = {
  ...basicFormContext,
  ...enhancedFormContext
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
      }
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
    }
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

// Add a helper button next to the form
function addFormHelperButton(form) {
  const button = document.createElement('button');
  button.textContent = 'Form Helper';
  button.className = 'form-helper-button';
  button.style.cssText = `
    position: relative;
    margin: 10px 0;
    background-color: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-family: Arial, sans-serif;
  `;
  
  // Insert button before the form
  if (form._isVirtual) {
    // For virtual forms, find a good location for the button
    const goodLocation = document.querySelector('form') || 
                         document.querySelector('input') || 
                         document.querySelector('h1') ||
                         document.body.firstChild;
    
    if (goodLocation && goodLocation.parentNode) {
      goodLocation.parentNode.insertBefore(button, goodLocation);
    } else {
      document.body.appendChild(button);
    }
  } else {
    // For regular forms, insert before the form
    form.parentNode.insertBefore(button, form);
  }
  
  // Update click handler to open side panel instead
  button.addEventListener('click', () => {
    // Send message to background script to open side panel
    chrome.runtime.sendMessage({
      action: 'openSidePanel',
      formId: form.id
    });
    
    // Also trigger form scan
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: 'scanForm',
        formId: form.id
      });
    }, 500); // Short delay to ensure panel is open
  });
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