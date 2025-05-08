/**
 * Form Quality Analyzer Module
 * 
 * A specialized module for detecting, analyzing and scoring web forms
 * to determine if they are legitimate interactive forms worth enhancing.
 */

class FormQualityAnalyzer {
  constructor() {
    // Configure scoring weights
    this.weights = {
      // Critical importance factors
      requiredElements: 25, // Has required HTML elements for a form
      
      // High importance factors
      fieldCount: 15,       // Multiple input fields
      submitElement: 15,    // Has submit button/mechanism
      
      // Medium importance factors
      labelAssociation: 10, // Fields have proper labels
      fieldDiversity: 10,   // Has diverse field types
      formAttributes: 10,   // Has form-specific attributes
      semanticMatch: 10,    // Semantic purpose detection
      
      // Lower importance factors
      validation: 5,        // Has validation attributes or JS
      structuredLayout: 5,  // Fields are laid out in a coherent structure
      secureContext: 5,     // Context suggests security considerations
      pageContext: 5        // Page context suggests form purpose
    };
    
    // Confidence threshold (0-100)
    this.defaultThreshold = 75;
    
    // Known form patterns for semantic matching
    this.formPatterns = {
      login: {
        keywords: ['login', 'sign in', 'signin', 'log in', 'authenticate', 'credentials', 'password', 'username'],
        requiredFields: ['password'],
        commonFields: ['email', 'username', 'remember me', 'forgot password'],
        actions: ['login', 'signin', 'authenticate']
      },
      registration: {
        keywords: ['register', 'sign up', 'signup', 'create account', 'join now', 'get started'],
        requiredFields: [],
        commonFields: ['email', 'password', 'confirm password', 'name', 'agree', 'terms'],
        actions: ['register', 'create', 'sign up', 'continue', 'get started']
      },
      checkout: {
        keywords: ['checkout', 'payment', 'billing', 'shipping', 'order', 'purchase', 'credit card'],
        requiredFields: [],
        commonFields: ['address', 'city', 'zip', 'state', 'country', 'card', 'ccv', 'expiration'],
        actions: ['pay', 'place order', 'checkout', 'purchase', 'buy', 'complete order']
      },
      contact: {
        keywords: ['contact', 'message', 'inquiry', 'get in touch', 'send message', 'feedback'],
        requiredFields: [],
        commonFields: ['name', 'email', 'message', 'subject', 'phone', 'comment'],
        actions: ['send', 'submit', 'contact us', 'send message']
      },
      search: {
        keywords: ['search', 'find', 'query', 'lookup'],
        requiredFields: [],
        commonFields: ['search', 'keywords', 'query'],
        actions: ['search', 'find', 'go']
      },
      subscription: {
        keywords: ['subscribe', 'newsletter', 'updates', 'email list', 'notify', 'stay updated'],
        requiredFields: ['email'],
        commonFields: ['email', 'name', 'subscribe'],
        actions: ['subscribe', 'sign up', 'join', 'submit']
      },
      comment: {
        keywords: ['comment', 'discuss', 'reply', 'feedback', 'opinion'],
        requiredFields: [],
        commonFields: ['name', 'email', 'comment', 'message', 'reply', 'website'],
        actions: ['post', 'comment', 'reply', 'submit']
      }
    };
    
    // Excluded form types
    this.excludedFormTypes = {
      documentEditor: {
        detection: (formElement, fields) => {
          // Check if page appears to be a document editor
          
          // Check for editor-specific URL patterns
          const url = window.location.href.toLowerCase();
          const documentPlatforms = [
            'docs.google.com',
            'office.live.com',
            'word-edit.officeapps.live.com',
            'office365.com',
            'sharepoint.com/sites',
            'onedrive.live.com',
            'overleaf.com',
            'dropbox.com/paper',
            'quip.com',
            'notion.so',
            'evernote.com',
            'onenote.com'
          ];
          
          // Check if we're on a known document platform
          if (documentPlatforms.some(platform => url.includes(platform))) {
            return true;
          }
          
          // Check for editor UI elements
          const hasEditorToolbar = document.querySelector('.toolbar, .editor-toolbar, .ql-toolbar, .docs-toolbar');
          const hasEditorClass = document.documentElement.classList.contains('editor') || 
                               document.body.classList.contains('editor') ||
                               document.querySelector('.editor-container, .document-editor');
          const hasContentEditable = document.querySelectorAll('[contenteditable="true"]').length > 0;
          
          // If we have multiple editor indicators, it's likely a document
          let editorSignals = 0;
          if (hasEditorToolbar) editorSignals++;
          if (hasEditorClass) editorSignals++;
          if (hasContentEditable) editorSignals++;
          
          // Return true if we have at least 2 editor signals
          return editorSignals >= 2;
        }
      },
      
      singleSearch: {
        detection: (formElement, fields) => {
          // Check if it's just a search box
          if (fields.length <= 2) {
            // Check for search field
            const hasSearchField = fields.some(field => {
              const name = (field.name || '').toLowerCase();
              const type = (field.type || '').toLowerCase();
              const placeholder = field.placeholder?.toLowerCase() || '';
              
              return name.includes('search') || 
                     name.includes('query') ||
                     placeholder.includes('search') || 
                     (type === 'search') ||
                     field.id?.toLowerCase().includes('search');
            });
            
            // Check for search button
            const hasSearchButton = formElement?.querySelector('button[type="submit"]')?.textContent?.toLowerCase().includes('search') ||
                                    formElement?.querySelector('input[type="submit"]')?.value?.toLowerCase().includes('search');
            
            return hasSearchField && (fields.length === 1 || hasSearchButton);
          }
          return false;
        }
      },
      singleComment: {
        detection: (formElement, fields) => {
          // Check if it's just a comment box
          if (fields.length <= 2) {
            // Is it just a comment/message field?
            const isCommentField = fields.some(field => {
              const name = (field.name || '').toLowerCase();
              const type = (field.type || '').toLowerCase();
              
              return (name.includes('comment') || name.includes('message')) && 
                     (type === 'textarea' || type === 'text');
            });
            
            // Does it have comment submit?
            const hasCommentSubmit = formElement?.querySelector('button[type="submit"]')?.textContent?.toLowerCase().includes('comment') ||
                                     formElement?.querySelector('input[type="submit"]')?.value?.toLowerCase().includes('comment');
                                     
            return isCommentField && (fields.length === 1 || hasCommentSubmit);
          }
          return false;
        }
      },
      chatInterface: {
        detection: (formElement, fields) => {
          // Chat interfaces typically have a single input and are at bottom of page
          if (fields.length <= 2) {
            // Check for chat-related attributes
            const isChatForm = formElement?.className?.toLowerCase().includes('chat') ||
                               formElement?.id?.toLowerCase().includes('chat') ||
                               formElement?.closest('[class*="chat"], [id*="chat"]');
                               
            // Chat forms usually have a single text input and a send button
            const hasChatField = fields.some(f => f.type === 'text' || f.type === 'textarea');
            const hasSendButton = formElement?.querySelector('button[type="submit"]')?.textContent?.toLowerCase().includes('send') ||
                                  formElement?.querySelector('input[type="submit"]')?.value?.toLowerCase().includes('send');
                                  
            return isChatForm && hasChatField && (fields.length === 1 || hasSendButton);
          }
          return false;
        }
      },
      newsletterSignup: {
        detection: (formElement, fields) => {
          // Newsletter signups typically have just an email field
          if (fields.length <= 2) {
            // Check if it has only an email field
            const hasEmailField = fields.some(field => {
              const name = (field.name || '').toLowerCase();
              const type = (field.type || '').toLowerCase();
              
              return (name.includes('email') || type === 'email');
            });
            
            // Check if it mentions newsletter/subscribe
            const isNewsletter = formElement?.textContent?.toLowerCase().includes('newsletter') ||
                                 formElement?.textContent?.toLowerCase().includes('subscribe') ||
                                 formElement?.className?.toLowerCase().includes('newsletter') ||
                                 formElement?.id?.toLowerCase().includes('newsletter');
                                 
            return hasEmailField && isNewsletter && fields.length <= 2;
          }
          return false;
        }
      }
    };
  }

  /**
   * Score form based on required HTML elements
   * @private
   */
  _scoreRequiredElements(formElement, fields) {
    let score = 0;
    
    // Check if we have an actual <form> element (highest importance)
    if (formElement && formElement.tagName === 'FORM') {
      score += 40;
    }
    
    // Check for at least 3 user-interactive elements
    const interactiveFieldTypes = ['text', 'email', 'password', 'tel', 'number', 'url', 
                                 'search', 'date', 'datetime-local', 'time', 'week', 'month',
                                 'color', 'file', 'range', 'select', 'textarea', 'checkbox', 'radio'];
    
    const interactiveFields = fields.filter(field => 
      interactiveFieldTypes.includes(field.type)
    );
    
    if (interactiveFields.length >= 3) {
      score += 30;
    } else if (interactiveFields.length >= 1) {
      score += 15;
    }
    
    // Check for submit mechanism
    const hasSubmitButton = formElement && formElement.querySelector('button[type="submit"], input[type="submit"]');
    const hasGenericButton = formElement && formElement.querySelector('button');
    
    if (hasSubmitButton) {
      score += 30;
    } else if (hasGenericButton) {
      score += 15;
    }
    
    return score;
  }

  /**
   * Analyze a form and determine if it's a legitimate form
   * @param {HTMLFormElement} formElement - The form DOM element
   * @param {Array} fields - Array of field data
   * @param {Object} options - Analysis options
   * @return {Object} Analysis results with score and details
   */
  analyzeForm(formElement, fields, options = {}) {
    // Extract basic inputs if fields not provided
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      fields = this._extractBasicFields(formElement);
    }
    
    // Prepare results object
    const results = {
      score: 0,
      isLegitimateForm: false,
      confidencePercentage: 0,
      formType: 'unknown',
      formPurpose: '',
      detailedScores: {},
      exclusionReason: null,
      fields: fields,
      rawFieldCount: fields.length,
      reasonCodes: []
    };
    
    // First check for explicitly excluded form types
    const exclusion = this._checkExcludedFormTypes(formElement, fields);
    if (exclusion) {
      results.isLegitimateForm = false;
      results.exclusionReason = exclusion;
      results.reasonCodes.push('EXCLUDED_TYPE');
      return results;
    }
    
    // Check for minimum interactive elements (must have at least one input)
    if (fields.length === 0) {
      results.isLegitimateForm = false;
      results.exclusionReason = 'noInputFields';
      results.reasonCodes.push('NO_INPUT_FIELDS');
      return results;
    }
    
    // Calculate scores for various quality indicators
    const scores = {
      fieldCount: this._scoreFieldCount(fields),
      submitElement: this._scoreSubmitElement(formElement, fields),
      labelAssociation: this._scoreLabelAssociation(formElement, fields),
      fieldDiversity: this._scoreFieldDiversity(fields),
      formAttributes: this._scoreFormAttributes(formElement, fields),
      validation: this._scoreValidation(formElement, fields),
      structuredLayout: this._scoreStructuredLayout(formElement, fields),
      secureContext: this._scoreSecureContext(formElement, fields),
      semanticMatch: this._scoreSemanticMatch(formElement, fields),
      pageContext: this._scorePageContext(formElement),
      requiredElements: this._scoreRequiredElements(formElement, fields)
    };
    
    // Apply weights to scores
    let totalScore = 0;
    Object.entries(scores).forEach(([key, score]) => {
      const weightedScore = (score * this.weights[key]) / 100;
      results.detailedScores[key] = {
        rawScore: score,
        weight: this.weights[key],
        weightedScore: weightedScore
      };
      totalScore += weightedScore;
      
      // Track low scores for reason codes
      if (key === 'requiredElements' && score < 50) {
        results.reasonCodes.push('MISSING_REQUIRED_ELEMENTS');
      }
      if (key === 'submitElement' && score < 50) {
        results.reasonCodes.push('NO_SUBMIT_MECHANISM');
      }
      if (key === 'fieldCount' && score < 60) {
        results.reasonCodes.push('INSUFFICIENT_FIELDS');
      }
    });
    
    // Calculate final score (0-100)
    results.score = Math.min(100, Math.round(totalScore));
    results.confidencePercentage = results.score;
    
    // Determine form legitimacy based on threshold
    const threshold = options.threshold || this.defaultThreshold;
    results.isLegitimateForm = results.score >= threshold;
    
    // Add reason code for threshold failure
    if (!results.isLegitimateForm) {
      results.reasonCodes.push('BELOW_THRESHOLD');
    }
    
    // Additional specific checks for contextual requirements
    
    // Check for minimum interactive input fields (at least 3)
    const interactiveFieldTypes = ['text', 'email', 'password', 'tel', 'number', 'url', 
                                 'select', 'textarea', 'checkbox', 'radio'];
    const interactiveFields = fields.filter(field => 
      interactiveFieldTypes.includes(field.type)
    );
    
    if (interactiveFields.length < 3) {
      results.reasonCodes.push('INSUFFICIENT_INTERACTIVE_FIELDS');
      // For strict requirements, force not legitimate regardless of score
      if (options.strictMode) {
        results.isLegitimateForm = false;
      }
    }
    
    // Verify there's at least one submit-type button
    const hasSubmitButton = formElement && formElement.querySelector('button[type="submit"], input[type="submit"]');
    if (!hasSubmitButton) {
      results.reasonCodes.push('NO_SUBMIT_BUTTON');
      // For strict requirements, having no submit button is a significant issue
      if (options.strictMode && !results.reasonCodes.includes('EXCLUDED_TYPE')) {
        results.score = Math.max(results.score - 20, 0);
        results.confidencePercentage = results.score;
        results.isLegitimateForm = results.score >= threshold;
      }
    }
    
    // Determine form type based on semantic analysis
    const semanticResults = this._determineFormType(formElement, fields);
    results.formType = semanticResults.formType;
    results.formPurpose = semanticResults.formPurpose;
    results.semanticConfidence = semanticResults.confidence;
    
    return results;
  }
  
  /**
   * Extract basic field information from a form element
   * @private
   */
  _extractBasicFields(formElement) {
    if (!formElement) return [];
    
    const inputElements = formElement.querySelectorAll('input, select, textarea, button');
    const fields = [];
    
    inputElements.forEach(input => {
      // Skip hidden inputs and submit/button types
      if (input.type === 'hidden' || 
          input.type === 'submit' || 
          input.type === 'reset' || 
          input.type === 'button' ||
          input.type === 'image') {
        return;
      }
      
      // Get basic field info
      fields.push({
        type: input.type || (input.tagName === 'SELECT' ? 'select' : 
                            (input.tagName === 'TEXTAREA' ? 'textarea' : 'text')),
        name: input.name || '',
        id: input.id || '',
        placeholder: input.placeholder || '',
        required: input.hasAttribute('required'),
        hasLabel: !!document.querySelector(`label[for="${input.id}"]`) || 
                  !!input.closest('label'),
        ariaLabel: input.getAttribute('aria-label') || '',
        hasValidation: input.hasAttribute('pattern') || 
                       input.hasAttribute('minlength') || 
                       input.hasAttribute('maxlength') || 
                       input.hasAttribute('min') ||
                       input.hasAttribute('max')
      });
    });
    
    return fields;
  }
  
  /**
   * Check if form matches any excluded form types
   * @private
   */
  _checkExcludedFormTypes(formElement, fields) {
    for (const [type, checker] of Object.entries(this.excludedFormTypes)) {
      if (checker.detection(formElement, fields)) {
        return type;
      }
    }
    return null;
  }
  
  /**
   * Score form based on number of fields (0-100)
   * @private
   */
  _scoreFieldCount(fields) {
    const count = fields.length;
    
    // No fields or too many fields (probably not a real form)
    if (count === 0) return 0;
    if (count > 30) return 60; // Excessively large forms get reduced score
    
    // Score based on field count
    if (count >= 5) return 100;   // 5+ fields: full score
    if (count >= 3) return 85;    // 3-4 fields: good score
    if (count === 2) return 60;   // 2 fields: moderate score
    return 30;                    // 1 field: low score
  }
  
  /**
   * Score form based on presence of submit elements
   * @private
   */
  _scoreSubmitElement(formElement, fields) {
    if (!formElement) return 30; // Much less confident without a form element
    
    // Look for explicit submit buttons
    const submitButton = formElement.querySelector('button[type="submit"], input[type="submit"]');
    if (submitButton) {
      // Check if this is an actual submission button with appropriate text
      const buttonText = (submitButton.textContent || submitButton.value || '').toLowerCase();
      const hasSubmitText = buttonText.includes('submit') || 
                          buttonText.includes('send') || 
                          buttonText.includes('login') ||
                          buttonText.includes('sign in') ||
                          buttonText.includes('register') ||
                          buttonText.includes('create account') ||
                          buttonText.includes('continue') ||
                          buttonText.includes('next') ||
                          buttonText.includes('save') ||
                          buttonText.includes('checkout') ||
                          buttonText.includes('purchase') ||
                          buttonText.includes('buy') ||
                          buttonText.includes('pay');
                          
      // Higher score if it both has the submit type AND appropriate text                    
      return hasSubmitText ? 100 : 90;
    }
    
    // Look for elements that look like submit buttons
    const buttons = Array.from(formElement.querySelectorAll('button, input[type="button"]'));
    let hasLikelySubmitButton = false;
    
    for (const button of buttons) {
      const buttonText = (button.textContent || button.value || '').toLowerCase();
      if (buttonText.includes('submit') || 
          buttonText.includes('send') || 
          buttonText.includes('login') ||
          buttonText.includes('sign in') ||
          buttonText.includes('register') ||
          buttonText.includes('create account') ||
          buttonText.includes('continue') ||
          buttonText.includes('next') ||
          buttonText.includes('save') ||
          buttonText.includes('checkout') ||
          buttonText.includes('purchase') ||
          buttonText.includes('buy') ||
          buttonText.includes('pay')) {
        hasLikelySubmitButton = true;
        break;
      }
    }
    
    if (hasLikelySubmitButton) return 85;
    
    // Check for onsubmit handler
    if (formElement.hasAttribute('onsubmit')) return 80;
    
    // Check for event listeners using a heuristic approach
    const formProps = Object.getOwnPropertyNames(formElement);
    const hasEventListeners = formProps.some(prop => prop.startsWith('on') || prop.includes('listener'));
    if (hasEventListeners) return 70;
    
    // Check for action attribute
    if (formElement.hasAttribute('action') && formElement.getAttribute('action')) return 65;
    
    // No clear submit mechanism found - this is problematic for a real form
    return 20;
  }
  
  /**
   * Score form based on label associations
   * @private
   */
  _scoreLabelAssociation(formElement, fields) {
    if (!formElement || fields.length === 0) return 0;
    
    let labeledFields = 0;
    let ariaLabeledFields = 0;
    let placeholderFields = 0;
    
    // Count various types of labeling
    fields.forEach(field => {
      if (field.hasLabel) {
        labeledFields++;
      } else if (field.ariaLabel || 
                (formElement && formElement.querySelector(`[aria-labelledby="${field.id}"]`))) {
        ariaLabeledFields++;
      } else if (field.placeholder) {
        placeholderFields++;
      }
    });
    
    // Calculate percentage of fields with proper labels
    const totalFields = fields.length;
    const labelPercentage = ((labeledFields + ariaLabeledFields + (placeholderFields * 0.5)) / totalFields) * 100;
    
    // Score based on label percentage
    if (labelPercentage >= 80) return 100;
    if (labelPercentage >= 60) return 80;
    if (labelPercentage >= 40) return 60;
    if (labelPercentage >= 20) return 40;
    return 20;
  }
  
  /**
   * Score form based on field type diversity
   * @private
   */
  _scoreFieldDiversity(fields) {
    if (fields.length === 0) return 0;
    
    // Count unique field types
    const types = new Set();
    fields.forEach(field => types.add(field.type));
    
    // Score based on type diversity
    const uniqueTypes = types.size;
    
    if (uniqueTypes >= 4) return 100;
    if (uniqueTypes === 3) return 80;
    if (uniqueTypes === 2) return 60;
    return 30;
  }
  
  /**
   * Score form based on form-specific attributes
   * @private
   */
  _scoreFormAttributes(formElement, fields) {
    if (!formElement) return 30;
    
    let score = 0;
    
    // Check form attributes
    if (formElement.hasAttribute('action')) score += 20;
    if (formElement.hasAttribute('method')) score += 15;
    if (formElement.hasAttribute('enctype')) score += 10;
    if (formElement.hasAttribute('autocomplete')) score += 10;
    
    // Check field attributes
    let requiredFields = 0;
    let placeholderFields = 0;
    let patternFields = 0;
    
    fields.forEach(field => {
      if (field.required) requiredFields++;
      if (field.placeholder) placeholderFields++;
      if (field.hasValidation) patternFields++;
    });
    
    // Add scores based on percentage of fields with these attributes
    const fieldCount = fields.length;
    if (fieldCount > 0) {
      score += (requiredFields / fieldCount) * 20;
      score += (placeholderFields / fieldCount) * 15;
      score += (patternFields / fieldCount) * 10;
    }
    
    // Cap score at 100
    return Math.min(100, score);
  }
  
  /**
   * Score form based on validation attributes/JS
   * @private
   */
  _scoreValidation(formElement, fields) {
    if (!formElement) return 30;
    
    let score = 0;
    
    // Check form-level validation
    if (formElement.hasAttribute('novalidate')) score += 20; // Intentionally turning off validation suggests JS validation
    
    // Check for common validation libraries
    const docHTML = document.documentElement.innerHTML.toLowerCase();
    if (docHTML.includes('validate.js') || 
        docHTML.includes('validation.js') || 
        docHTML.includes('jquery.validate')) {
      score += 30;
    }
    
    // Check for validation attributes on fields
    let validationAttrCount = 0;
    fields.forEach(field => {
      if (field.hasValidation) validationAttrCount++;
    });
    
    // Add score based on percentage of fields with validation
    const fieldCount = fields.length;
    if (fieldCount > 0) {
      score += (validationAttrCount / fieldCount) * 30;
    }
    
    // Check for common validation patterns in nearby JavaScript
    if (formElement.hasAttribute('onsubmit') && 
        formElement.getAttribute('onsubmit').includes('valid')) {
      score += 20;
    }
    
    // Cap score at 100
    return Math.min(100, score);
  }
  
  /**
   * Score form based on structured field layout
   * @private
   */
  _scoreStructuredLayout(formElement, fields) {
    if (!formElement || fields.length <= 1) return 30;
    
    // Check for common form layout elements
    const hasFieldset = formElement.querySelectorAll('fieldset').length > 0;
    const hasLegend = formElement.querySelectorAll('legend').length > 0;
    const hasFormGroups = formElement.querySelectorAll('.form-group, .field-group, .input-group').length > 0;
    
    let score = 0;
    if (hasFieldset) score += 30;
    if (hasLegend) score += 20;
    if (hasFormGroups) score += 30;
    
    // Look for structured field relationships
    const fieldNames = fields.map(f => f.name.toLowerCase());
    
    // Check for address field groups
    const addressFields = ['address', 'street', 'city', 'state', 'zip', 'country', 'postal'];
    const hasAddressGroup = addressFields.filter(field => 
      fieldNames.some(name => name.includes(field))
    ).length >= 3;
    
    // Check for name field groups
    const nameFields = ['first', 'last', 'name'];
    const hasNameGroup = nameFields.filter(field => 
      fieldNames.some(name => name.includes(field))
    ).length >= 2;
    
    // Check for payment field groups
    const paymentFields = ['card', 'credit', 'expir', 'cvv', 'cvc', 'payment'];
    const hasPaymentGroup = paymentFields.filter(field => 
      fieldNames.some(name => name.includes(field))
    ).length >= 2;
    
    if (hasAddressGroup) score += 20;
    if (hasNameGroup) score += 15;
    if (hasPaymentGroup) score += 25;
    
    // Cap score at 100
    return Math.min(100, score);
  }
  
  /**
   * Score form based on secure context indicators
   * @private
   */
  _scoreSecureContext(formElement, fields) {
    let score = 0;
    
    // Check if page is secure
    if (window.location.protocol === 'https:') {
      score += 40;
    }
    
    // Check for password fields
    const hasPasswordField = fields.some(field => field.type === 'password');
    if (hasPasswordField) score += 30;
    
    // Check for security indicators in form
    if (formElement) {
      const formHTML = formElement.innerHTML.toLowerCase();
      if (formHTML.includes('secure') || 
          formHTML.includes('security') || 
          formHTML.includes('protected') || 
          formHTML.includes('encryption') ||
          formHTML.includes('ssl') ||
          formHTML.includes('https')) {
        score += 20;
      }
      
      // Check for CSRF tokens
      const hasCsrfToken = formElement.querySelector('input[name*="csrf"], input[name*="token"], input[name*="_token"]');
      if (hasCsrfToken) score += 20;
    }
    
    // Cap score at 100
    return Math.min(100, score);
  }
  
  /**
   * Score form based on semantic context matching
   * @private
   */
  _scoreSemanticMatch(formElement, fields) {
    if (!formElement) return 40;
    
    let bestMatchScore = 0;
    let bestMatchType = '';
    
    // Check each form pattern for a match
    for (const [formType, pattern] of Object.entries(this.formPatterns)) {
      let patternScore = 0;
      
      // Check for keywords in form text and attributes
      const formText = formElement.textContent.toLowerCase();
      const formClasses = formElement.className.toLowerCase();
      const formId = formElement.id.toLowerCase();
      
      let keywordMatches = 0;
      pattern.keywords.forEach(keyword => {
        if (formText.includes(keyword) || 
            formClasses.includes(keyword) || 
            formId.includes(keyword)) {
          keywordMatches++;
        }
      });
      
      patternScore += (keywordMatches / pattern.keywords.length) * 40;
      
      // Check for required fields
      let requiredFieldMatches = 0;
      if (pattern.requiredFields.length > 0) {
        pattern.requiredFields.forEach(requiredField => {
          if (fields.some(field => 
            field.name.toLowerCase().includes(requiredField) || 
            field.type.toLowerCase() === requiredField ||
            field.id.toLowerCase().includes(requiredField)
          )) {
            requiredFieldMatches++;
          }
        });
        
        patternScore += (requiredFieldMatches / pattern.requiredFields.length) * 30;
      } else {
        patternScore += 15; // No required fields specified for this pattern
      }
      
      // Check for common fields
      let commonFieldMatches = 0;
      pattern.commonFields.forEach(commonField => {
        if (fields.some(field => 
          field.name.toLowerCase().includes(commonField) || 
          field.type.toLowerCase() === commonField ||
          field.id.toLowerCase().includes(commonField) ||
          field.placeholder?.toLowerCase().includes(commonField)
        )) {
          commonFieldMatches++;
        }
      });
      
      patternScore += (commonFieldMatches / pattern.commonFields.length) * 30;
      
      // Check for action text in submit buttons
      const buttons = formElement.querySelectorAll('button[type="submit"], input[type="submit"], button');
      let actionMatches = 0;
      
      buttons.forEach(button => {
        const buttonText = (button.textContent || button.value || '').toLowerCase();
        
        pattern.actions.forEach(action => {
          if (buttonText.includes(action)) {
            actionMatches++;
          }
        });
      });
      
      if (pattern.actions.length > 0 && buttons.length > 0) {
        patternScore += (actionMatches / pattern.actions.length) * 20;
      }
      
      // Track the best matching pattern
      if (patternScore > bestMatchScore) {
        bestMatchScore = patternScore;
        bestMatchType = formType;
      }
    }
    
    return bestMatchScore;
  }
  
  /**
   * Score form based on page context
   * @private
   */
  _scorePageContext(formElement) {
    let score = 50; // Start with neutral score
    
    // Check page URL for form-related terms
    const url = window.location.href.toLowerCase();
    const pathParts = window.location.pathname.toLowerCase().split('/');
    
    // Common URL patterns
    const urlPatterns = {
      login: ['login', 'signin', 'sign-in', 'authenticate', 'auth'],
      register: ['register', 'signup', 'sign-up', 'join', 'create-account', 'registration'],
      checkout: ['checkout', 'payment', 'billing', 'order', 'purchase', 'cart'],
      contact: ['contact', 'feedback', 'support', 'help', 'inquiry', 'message-us'],
      search: ['search', 'find', 'query', 'results'],
      account: ['account', 'profile', 'settings', 'my-account'],
      password: ['password', 'reset', 'forgot', 'recover']
    };
    
    // Check URL against patterns
    for (const [type, patterns] of Object.entries(urlPatterns)) {
      for (const pattern of patterns) {
        if (url.includes(pattern) || pathParts.includes(pattern)) {
          score += 20;
          break;
        }
      }
    }
    
    // Check page title
    const title = document.title.toLowerCase();
    for (const [type, patterns] of Object.entries(urlPatterns)) {
      for (const pattern of patterns) {
        if (title.includes(pattern)) {
          score += 15;
          break;
        }
      }
    }
    
    // Check nearby headings
    if (formElement) {
      const nearbyHeadings = this._getNearbyHeadings(formElement);
      
      for (const [type, patterns] of Object.entries(urlPatterns)) {
        for (const pattern of patterns) {
          if (nearbyHeadings.some(h => h.toLowerCase().includes(pattern))) {
            score += 25;
            break;
          }
        }
      }
    }
    
    // Cap score at 100
    return Math.min(100, score);
  }
  
  /**
   * Get headings near the form element
   * @private
   */
  _getNearbyHeadings(formElement) {
    const headings = [];
    
    // Look for headings that are siblings before the form
    let prevSibling = formElement.previousElementSibling;
    while (prevSibling && headings.length < 3) {
      if (prevSibling.tagName.match(/H[1-6]/)) {
        headings.push(prevSibling.textContent);
      }
      prevSibling = prevSibling.previousElementSibling;
    }
    
    // Look for headings that are parents or ancestors
    let parent = formElement.parentElement;
    while (parent && headings.length < 5) {
      const parentHeadings = Array.from(parent.querySelectorAll('h1, h2, h3'))
        .filter(h => !formElement.contains(h)) // Exclude headings inside the form
        .map(h => h.textContent);
      
      headings.push(...parentHeadings.slice(0, 5 - headings.length));
      
      parent = parent.parentElement;
    }
    
    return headings;
  }
  
  /**
   * Determine form type and purpose based on analysis
   * @private
   */
  _determineFormType(formElement, fields) {
    let bestMatch = {
      formType: 'unknown form',
      formPurpose: 'collecting information',
      confidence: 0
    };
    
    // Simple cases - no form element or no fields
    if (!formElement || fields.length === 0) {
      return bestMatch;
    }
    
    // Score each form pattern
    let highestScore = 0;
    
    for (const [formType, pattern] of Object.entries(this.formPatterns)) {
      // Skip 'search' pattern for forms with many fields
      if (formType === 'search' && fields.length > 2) continue;
      
      // Skip 'comment' pattern for forms with many fields
      if (formType === 'comment' && fields.length > 3) continue;
      
      // Skip 'subscription' pattern for forms with many fields
      if (formType === 'subscription' && fields.length > 3) continue;
      
      let matchScore = 0;
      
      // 1. Check for field type matches
      const requiredMatches = pattern.requiredFields.filter(req => 
        fields.some(field => this._fieldMatches(field, req))
      ).length;
      
      const commonMatches = pattern.commonFields.filter(common => 
        fields.some(field => this._fieldMatches(field, common))
      ).length;
      
      if (pattern.requiredFields.length > 0) {
        const requiredPercentage = requiredMatches / pattern.requiredFields.length;
        matchScore += requiredPercentage * 40;
      } else {
        matchScore += 20; // No required fields in pattern
      }
      
      if (pattern.commonFields.length > 0) {
        const commonPercentage = commonMatches / pattern.commonFields.length;
        matchScore += commonPercentage * 30;
      }
      
      // 2. Check for keyword matches in form and nearby content
      const formText = formElement.textContent.toLowerCase();
      const formAttrs = (formElement.className + ' ' + (formElement.id || '')).toLowerCase();
      
      const keywordMatches = pattern.keywords.filter(keyword => 
        formText.includes(keyword) || formAttrs.includes(keyword)
      ).length;
      
      if (pattern.keywords.length > 0) {
        const keywordPercentage = keywordMatches / pattern.keywords.length;
        matchScore += keywordPercentage * 30;
      }
      
      // 3. Check submit button text
      const submitButtons = formElement.querySelectorAll('button[type="submit"], input[type="submit"], button');
      let actionMatch = false;
      
      submitButtons.forEach(button => {
        const buttonText = (button.textContent || button.value || '').toLowerCase();
        
        pattern.actions.forEach(action => {
          if (buttonText.includes(action)) {
            actionMatch = true;
          }
        });
      });
      
      if (actionMatch) {
        matchScore += 20;
      }
      
      // Track highest scoring pattern
      if (matchScore > highestScore) {
        highestScore = matchScore;
        
        // Determine form purpose based on type
        let purpose = '';
        switch(formType) {
          case 'login':
            purpose = 'signing in to an account';
            break;
          case 'registration':
            purpose = 'creating a new account';
            break;
          case 'checkout':
            purpose = 'completing a purchase';
            break;
          case 'contact':
            purpose = 'sending a message or inquiry';
            break;
          case 'search':
            purpose = 'finding content on this site';
            break;
          case 'subscription':
            purpose = 'subscribing to updates or newsletters';
            break;
          case 'comment':
            purpose = 'leaving a comment or feedback';
            break;
          default:
            purpose = 'collecting information';
        }
        
        bestMatch = {
          formType: formType + ' form',
          formPurpose: purpose,
          confidence: Math.min(100, matchScore)
        };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Check if a field matches a field type specification
   * @private
   */
  _fieldMatches(field, fieldSpec) {
    const fieldName = (field.name || '').toLowerCase();
    const fieldId = (field.id || '').toLowerCase();
    const fieldType = (field.type || '').toLowerCase();
    const fieldPlaceholder = (field.placeholder || '').toLowerCase();
    
    return fieldName.includes(fieldSpec) || 
           fieldId.includes(fieldSpec) || 
           fieldType === fieldSpec ||
           fieldPlaceholder.includes(fieldSpec);
  }
}

// Export the class with defensive initialization
window.FormQualityAnalyzer = window.FormQualityAnalyzer || FormQualityAnalyzer;

// Create global instance if not already available
if (!window.formQualityAnalyzer) {
  try {
    window.formQualityAnalyzer = new FormQualityAnalyzer();
    console.log("Form Quality Analyzer initialized globally");
  } catch (error) {
    console.warn("Error initializing Form Quality Analyzer:", error.message);
    // Create fallback object with minimum viable functionality
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
}