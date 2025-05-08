/**
 * Enhanced Form Context Analyzer
 * 
 * Provides comprehensive form type detection and context-aware responses
 * about the form's purpose and structure.
 */

class FormContextAnalyzer {
  constructor() {
    // Initialize form type patterns and indicators
    this.formPatterns = {
      login: {
        attributes: ['login', 'signin', 'sign-in', 'log-in', 'logon', 'authenticate', 'access-account'],
        urls: ['login', 'signin', 'sign-in', 'log-in', 'authenticate', 'member'],
        buttonText: ['login', 'sign in', 'log in', 'access', 'continue', 'submit'],
        requiredFields: ['password'],
        optionalFields: ['email', 'username', 'remember', 'forgot'],
        purpose: "authenticating existing users to access their accounts",
        description: "This login form verifies your identity to grant access to your account. You'll need to enter your credentials (typically email/username and password) to continue."
      },
      
      registration: {
        attributes: ['register', 'signup', 'sign-up', 'create account', 'join', 'create-user', 'new account', 'registration'],
        urls: ['register', 'signup', 'sign-up', 'join', 'create-account', 'new-user', 'register.php', 'signup.php', 'register.aspx'],
        buttonText: ['register', 'sign up', 'create account', 'join now', 'get started', 'submit'],
        requiredFields: ['password', 'email'],
        optionalFields: ['name', 'confirm_password', 'terms', 'agree', 'first_name', 'last_name'],
        purpose: "creating a new user account on this website or service",
        description: "This registration form allows you to create a new account. You'll typically need to provide personal information and choose login credentials that you'll use to access your account in the future."
      },
      
      contact: {
        attributes: ['contact', 'feedback', 'message', 'inquiry', 'support', 'help'],
        urls: ['contact', 'feedback', 'support', 'inquiry', 'help', 'contact-us', 'contactus'],
        buttonText: ['send', 'submit', 'send message', 'contact us'],
        requiredFields: ['email'],
        optionalFields: ['name', 'message', 'subject', 'phone', 'company', 'department'],
        purpose: "sending a message or inquiry to the website owner or support team",
        description: "This contact form allows you to send a message to the organization. Your information will be used to respond to your inquiry or feedback."
      },
      
      checkout: {
        attributes: ['checkout', 'payment', 'billing', 'order', 'purchase', 'cart'],
        urls: ['checkout', 'payment', 'order', 'cart', 'purchase', 'buy'],
        buttonText: ['pay', 'purchase', 'complete order', 'place order', 'buy now', 'continue to payment'],
        requiredFields: ['payment', 'credit_card', 'card', 'total'],
        optionalFields: ['billing', 'shipping', 'address', 'name', 'email', 'phone'],
        purpose: "processing a payment to complete a purchase",
        description: "This checkout form collects payment and shipping information to process your order. You'll need to provide payment details and delivery information."
      },
      
      search: {
        attributes: ['search', 'find', 'query', 'lookup', 'search-form'],
        urls: ['search', 'find', 'results', 'query'],
        buttonText: ['search', 'find', 'go', 'lookup'],
        requiredFields: ['search', 'query', 'q', 'keyword'],
        optionalFields: ['filter', 'category', 'sort', 'date', 'location'],
        purpose: "finding specific content or items on the website",
        description: "This search form helps you find specific information or content. Enter keywords or apply filters to narrow down the results."
      },
      
      survey: {
        attributes: ['survey', 'questionnaire', 'feedback', 'opinion', 'poll'],
        urls: ['survey', 'feedback', 'poll', 'questionnaire', 'opinion'],
        buttonText: ['submit', 'complete', 'finish', 'next', 'submit survey', 'send feedback'],
        requiredFields: [],
        optionalFields: ['rating', 'feedback', 'opinion', 'comment', 'suggestion', 'email'],
        purpose: "collecting feedback, opinions, or survey responses",
        description: "This survey form collects your feedback or opinions. Your responses help the organization improve their products, services, or content."
      },
      
      subscription: {
        attributes: ['subscribe', 'newsletter', 'updates', 'mailing list', 'subscription'],
        urls: ['subscribe', 'newsletter', 'signup', 'mailing-list'],
        buttonText: ['subscribe', 'sign up', 'join', 'submit', 'get updates'],
        requiredFields: ['email'],
        optionalFields: ['name', 'preferences', 'interests', 'frequency'],
        purpose: "subscribing to newsletters, updates, or notifications",
        description: "This subscription form adds you to a mailing list for receiving updates, newsletters, or notifications. You'll typically need to provide your email address."
      },
      
      password: {
        attributes: ['password', 'pwd', 'forgot', 'reset', 'change password'],
        urls: ['password', 'reset', 'forgot', 'recover', 'change-password'],
        buttonText: ['reset', 'submit', 'change password', 'update password', 'continue'],
        requiredFields: ['email', 'password'],
        optionalFields: ['username', 'current_password', 'new_password', 'confirm_password'],
        purpose: "resetting, recovering, or changing your password",
        description: "This form allows you to reset or change your password. You'll typically need to verify your identity first, then create a new password."
      },
      
      upload: {
        attributes: ['upload', 'file', 'document', 'attachment', 'image', 'media'],
        urls: ['upload', 'file', 'document', 'attachment', 'media', 'images'],
        buttonText: ['upload', 'submit', 'attach', 'select files', 'continue'],
        requiredFields: ['file'],
        optionalFields: ['name', 'description', 'category', 'tags'],
        purpose: "uploading files, documents, or media to the website",
        description: "This upload form allows you to share files or documents with the website. You may need to provide additional information about what you're uploading."
      }
    };
    
    // Store the last detected form context
    this.lastDetectedContext = null;
  }
  
  /**
   * Analyze a form and its fields to determine the form type and purpose
   * 
   * @param {HTMLElement} formElement - The form DOM element (can be null)
   * @param {Array} fields - Array of field objects with type, name, etc.
   * @param {Object} pageInfo - Information about the page (title, URL, etc.)
   * @returns {Object} Enhanced form context object with type, purpose, confidence, etc.
   */
  analyzeFormContext(formElement, fields, pageInfo = {}) {
    // Start with basic context structure
    const formContext = {
      form_type: "unknown form",
      form_purpose: "",
      description: "",
      confidence: 0,
      detection_method: [],
      reasoning: [],
      field_count: fields ? fields.length : 0,
      identified_fields: {}
    };
    
    // Step 1: Check form attributes
    const attributeContext = this.detectFromAttributes(formElement);
    if (attributeContext && attributeContext.confidence > formContext.confidence) {
      Object.assign(formContext, attributeContext);
    }
    
    // Step 2: Check URL and page title if available
    if (pageInfo.url || pageInfo.title) {
      const urlContext = this.detectFromUrlAndTitle(pageInfo.url, pageInfo.title);
      if (urlContext && urlContext.confidence > formContext.confidence) {
        Object.assign(formContext, urlContext);
      }
    }
    
    // Step 3: Check form fields and button text
    if (fields && fields.length > 0) {
      const fieldContext = this.detectFromFields(fields, formElement);
      
      // If field detection has higher confidence or adds new information
      if (fieldContext) {
        if (fieldContext.confidence > formContext.confidence) {
          // Replace with higher confidence result
          Object.assign(formContext, fieldContext);
        } else if (fieldContext.confidence > 0) {
          // Combine reasoning and detection methods
          formContext.detection_method = [...new Set([...formContext.detection_method, ...fieldContext.detection_method])];
          formContext.reasoning = [...new Set([...formContext.reasoning, ...fieldContext.reasoning])];
          
          // Increase confidence slightly when multiple methods agree
          if (formContext.form_type === fieldContext.form_type) {
            formContext.confidence = Math.min(0.95, formContext.confidence + 0.1);
          }
        }
      }
    }
    
    // Store the result for future reference
    this.lastDetectedContext = {...formContext};
    
    console.log("Enhanced form context detection:", formContext);
    return formContext;
  }
  
  /**
   * Detect form type from form attributes like ID, name, class, action
   */
  detectFromAttributes(formElement) {
    if (!formElement) return null;
    
    // Get form attributes
    const formId = formElement.id || '';
    const formName = formElement.getAttribute('name') || '';
    const formClass = formElement.className || '';
    const formAction = formElement.getAttribute('action') || '';
    const formMethod = formElement.getAttribute('method') || '';
    const formEnctype = formElement.getAttribute('enctype') || '';
    
    // Combine all attributes for checking
    const attributeText = `${formId} ${formName} ${formClass} ${formAction} ${formMethod} ${formEnctype}`.toLowerCase();
    
    // Check each form type's attribute patterns
    let bestMatch = null;
    let highestScore = 0;
    
    for (const [formType, patterns] of Object.entries(this.formPatterns)) {
      let matchCount = 0;
      const matches = [];
      
      // Check each attribute keyword
      for (const keyword of patterns.attributes) {
        if (attributeText.includes(keyword)) {
          matchCount++;
          matches.push(keyword);
        }
      }
      
      // Calculate score based on matches
      const score = matchCount / patterns.attributes.length;
      
      if (score > 0 && score > highestScore) {
        highestScore = score;
        bestMatch = {
          form_type: `${formType} form`,
          form_purpose: patterns.purpose,
          description: patterns.description,
          confidence: Math.min(0.8, 0.5 + (score * 0.3)),
          detection_method: ['attributes'],
          reasoning: [`Form attributes contain ${matches.join(', ')}`]
        };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Detect form type from URL and page title
   */
  detectFromUrlAndTitle(url = '', title = '') {
    const combinedText = `${url} ${title}`.toLowerCase();
    if (combinedText.trim() === '') return null;
    
    // Check each form type's URL patterns
    let bestMatch = null;
    let highestScore = 0;
    
    for (const [formType, patterns] of Object.entries(this.formPatterns)) {
      let matchCount = 0;
      const matches = [];
      
      // Check URL keywords
      for (const keyword of patterns.urls) {
        if (combinedText.includes(keyword)) {
          matchCount++;
          matches.push(keyword);
        }
      }
      
      // Calculate score based on matches
      const score = matchCount / patterns.urls.length;
      
      if (score > 0 && score > highestScore) {
        highestScore = score;
        bestMatch = {
          form_type: `${formType} form`,
          form_purpose: patterns.purpose,
          description: patterns.description,
          confidence: Math.min(0.7, 0.4 + (score * 0.3)),
          detection_method: ['url_and_title'],
          reasoning: [`URL/title contain ${matches.join(', ')}`]
        };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Detect form type from fields and button text
   */
  detectFromFields(fields, formElement) {
    if (!fields || fields.length === 0) return null;
    
    // Create a dictionary of field types for easy lookup
    const fieldTypes = {};
    fields.forEach(field => {
      const fieldName = (field.name || '').toLowerCase();
      const fieldPurpose = field.purpose || '';
      const fieldType = field.type || '';
      const fieldLabel = (field.label || '').toLowerCase();
      
      // Store in field types dictionary
      const allKeys = [fieldName, fieldPurpose, fieldType];
      if (fieldLabel) allKeys.push(fieldLabel);
      
      allKeys.forEach(key => {
        if (key) fieldTypes[key] = true;
      });
    });
    
    // Get button text if form element is available
    let buttonText = '';
    if (formElement) {
      const submitButton = formElement.querySelector('button[type="submit"], input[type="submit"]');
      if (submitButton) {
        buttonText = (submitButton.textContent || submitButton.value || '').toLowerCase();
      }
    }
    
    // Check each form type against our fields
    let bestMatch = null;
    let highestScore = 0;
    
    for (const [formType, patterns] of Object.entries(this.formPatterns)) {
      let requiredMatches = 0;
      let optionalMatches = 0;
      let buttonMatches = 0;
      const matches = [];
      
      // Check required fields
      for (const fieldType of patterns.requiredFields) {
        for (const key in fieldTypes) {
          if (key.includes(fieldType)) {
            requiredMatches++;
            matches.push(fieldType);
            break;
          }
        }
      }
      
      // Check optional fields
      for (const fieldType of patterns.optionalFields) {
        for (const key in fieldTypes) {
          if (key.includes(fieldType)) {
            optionalMatches++;
            matches.push(fieldType);
            break;
          }
        }
      }
      
      // Check button text
      if (buttonText) {
        for (const text of patterns.buttonText) {
          if (buttonText.includes(text)) {
            buttonMatches++;
            matches.push(`button text: ${text}`);
            break;
          }
        }
      }
      
      // Calculate overall score
      // Required fields count more than optional fields
      const requiredFieldsWeight = patterns.requiredFields.length > 0 ? 
                                  requiredMatches / patterns.requiredFields.length : 0;
      const optionalFieldsWeight = patterns.optionalFields.length > 0 ? 
                                  optionalMatches / patterns.optionalFields.length : 0;
      
      const score = (requiredFieldsWeight * 0.6) + (optionalFieldsWeight * 0.3) + (buttonMatches > 0 ? 0.1 : 0);
      
      if (score > 0 && score > highestScore) {
        highestScore = score;
        
        // Build reasoning array
        const reasoning = [];
        if (requiredMatches > 0) {
          reasoning.push(`Found ${requiredMatches}/${patterns.requiredFields.length} required fields`);
        }
        if (optionalMatches > 0) {
          reasoning.push(`Found ${optionalMatches}/${patterns.optionalFields.length} optional fields`);
        }
        if (buttonMatches > 0) {
          reasoning.push(`Button text indicates ${formType} form`);
        }
        
        bestMatch = {
          form_type: `${formType} form`,
          form_purpose: patterns.purpose,
          description: patterns.description,
          confidence: Math.min(0.85, 0.4 + (score * 0.45)),
          detection_method: ['fields', buttonMatches > 0 ? 'button_text' : null].filter(Boolean),
          reasoning: reasoning,
          identified_fields: {
            matched: matches
          }
        };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Generate a response to questions about the form based on its context
   * 
   * @param {string} question - The user's question
   * @param {Object} formContext - The detected form context
   * @returns {string} A context-aware response about the form
   */
  generateFormContextResponse(question, formContext = null) {
    // Use provided context or fall back to last detected
    const context = formContext || this.lastDetectedContext;
    
    // If no context is available, return a generic response
    if (!context || context.form_type === "unknown form") {
      return "This appears to be a form that collects information. I can help you understand what each field is for if you have specific questions about any of them.";
    }
    
    const questionLower = question.toLowerCase();
    
    // Questions about form type
    if (questionLower.includes("what") && 
        (questionLower.includes("form") || questionLower.includes("page")) && 
        (questionLower.includes("is this") || questionLower.includes("type") || questionLower.includes("kind"))) {
      
      return `This is a ${context.form_type.replace("form", "").trim()} form ${context.form_purpose}. ${context.description}`;
    }
    
    // Questions about form purpose
    if (questionLower.includes("why") || 
        (questionLower.includes("what") && questionLower.includes("for")) ||
        questionLower.includes("purpose")) {
      
      return `This form is for ${context.form_purpose}. ${context.description}`;
    }
    
    // Questions about what to do with the form
    if (questionLower.includes("how") && 
        (questionLower.includes("use") || questionLower.includes("fill") || questionLower.includes("complete"))) {
      
      return `To complete this ${context.form_type}, ${this.getFormUsageInstructions(context.form_type)}`;
    }
    
    // Questions about what happens after submitting
    if (questionLower.includes("what") && 
        (questionLower.includes("happen") || questionLower.includes("next") || questionLower.includes("after"))) {
      
      return `After submitting this ${context.form_type}, ${this.getFormSubmissionOutcome(context.form_type)}`;
    }
    
    // Default response about the form
    return `This is a ${context.form_type.replace("form", "").trim()} form ${context.form_purpose}. ${context.description}`;
  }
  
  /**
   * Get usage instructions based on form type
   */
  getFormUsageInstructions(formType) {
    const type = formType.replace(" form", "").trim();
    
    switch (type) {
      case "login":
        return "enter your email/username and password to access your account. If you've forgotten your password, look for a 'Forgot Password' link.";
      case "registration":
        return "fill in your personal information and create login credentials (username/email and password). Make sure to use a strong, unique password.";
      case "contact":
        return "provide your contact information and write your message or inquiry. Be clear and specific about what you're asking.";
      case "checkout":
        return "enter your payment details, billing address, and shipping information if applicable. Double-check all information for accuracy.";
      case "search":
        return "enter keywords related to what you're looking for. You can also use filters to narrow down results if available.";
      case "survey":
        return "answer the questions honestly based on your experience or opinions. Your feedback helps improve products or services.";
      case "subscription":
        return "enter your email address and select any preference options if available. You may need to verify your email after subscribing.";
      case "password":
        return "follow the instructions to reset or change your password. You'll typically need to create a new password that meets the security requirements.";
      case "upload":
        return "select the file(s) you want to upload and provide any requested information about the files. Be sure your files meet any size or format requirements.";
      default:
        return "fill in the required fields accurately and submit the form when you're done.";
    }
  }
  
  /**
   * Get submission outcome based on form type
   */
  getFormSubmissionOutcome(formType) {
    const type = formType.replace(" form", "").trim();
    
    switch (type) {
      case "login":
        return "you'll be granted access to your account and redirected to your account dashboard or the main content area.";
      case "registration":
        return "your account will be created and you may receive a verification email to confirm your email address before you can access your account.";
      case "contact":
        return "your message will be sent to the organization and you may receive an acknowledgment or response to your inquiry.";
      case "checkout":
        return "your payment will be processed and your order will be confirmed. You should receive an order confirmation via email.";
      case "search":
        return "you'll see search results matching your query, which you can then browse through to find what you're looking for.";
      case "survey":
        return "your feedback will be recorded and used to improve products, services, or content. You may see a thank you page.";
      case "subscription":
        return "you'll be added to the mailing list and will start receiving updates or newsletters. You may need to confirm your subscription via email.";
      case "password":
        return "your password will be reset or changed. You may receive an email confirmation, and you'll be able to log in with your new password.";
      case "upload":
        return "your files will be uploaded to the server and processed according to the purpose of the upload.";
      default:
        return "your information will be processed and you'll typically see a confirmation or next steps on screen.";
    }
  }
}

// Create global instance
window.formContextAnalyzer = new FormContextAnalyzer();