/**
 * Form Context Detector
 * Analyzes forms to determine context information like form type and purpose
 */

class FormContextDetector {
    constructor() {
      // Initialize known form type patterns
      this.formPatterns = {
        registration: {
          fields: ['email', 'password', 'confirm', 'name', 'signup', 'register'],
          urls: ['register', 'signup', 'join', 'create-account', 'new-user'],
          titles: ['register', 'sign up', 'create account', 'join', 'new user']
        },
        login: {
          fields: ['email', 'username', 'password', 'login', 'signin'],
          urls: ['login', 'signin', 'authenticate'],
          titles: ['login', 'sign in', 'member login']
        },
        contact: {
          fields: ['name', 'email', 'message', 'subject', 'phone', 'contact'],
          urls: ['contact', 'support', 'help', 'feedback'],
          titles: ['contact', 'feedback', 'get in touch', 'support']
        },
        payment: {
          fields: ['card', 'credit', 'payment', 'expiry', 'cvv', 'billing'],
          urls: ['checkout', 'payment', 'billing', 'order'],
          titles: ['payment', 'checkout', 'billing information', 'complete order']
        },
        shipping: {
          fields: ['address', 'city', 'state', 'zip', 'postal', 'country', 'shipping'],
          urls: ['shipping', 'delivery', 'address'],
          titles: ['shipping', 'delivery', 'shipping address', 'delivery information']
        },
        survey: {
          fields: ['survey', 'rating', 'feedback', 'opinion', 'comments'],
          urls: ['survey', 'feedback', 'poll', 'questionnaire'],
          titles: ['survey', 'feedback', 'questionnaire', 'your opinion']
        },
        employment: {
          fields: ['resume', 'cv', 'employment', 'job', 'position', 'apply'],
          urls: ['career', 'job', 'employment', 'application'],
          titles: ['job application', 'employment', 'career', 'apply']
        },
        search: {
          fields: ['search', 'query', 'keyword', 'find'],
          urls: ['search', 'find', 'lookup'],
          titles: ['search', 'find', 'lookup']
        }
      };
    }
  
    /**
     * Main method to detect form context
     * @param {HTMLFormElement|null} formElement - Form element or null for virtual forms
     * @param {Array} detectedFields - Array of detected field objects
     * @returns {Object} Form context object
     */
    detectFormContext(formElement, detectedFields) {
      // Start with basic context
      const formContext = {
        form_type: "unknown form",
        form_purpose: "",
        confidence: 0,
        detection_method: ""
      };
  
      // Try different detection methods in order of reliability
      const methods = [
        this.detectFromFormAttributes,
        this.detectFromURL, 
        this.detectFromTitle,
        this.detectFromFields,
        this.detectFromSurroundingText
      ];
  
      // Try each method until we get a good match
      for (const method of methods) {
        const result = method.call(this, formElement, detectedFields);
        
        // If this method produced a result with higher confidence, use it
        if (result && result.confidence > formContext.confidence) {
          Object.assign(formContext, result);
          
          // If we have high confidence, stop checking
          if (formContext.confidence > 0.8) {
            break;
          }
        }
      }
      
      // For forms we recognize but don't have a specific purpose for,
      // add a generic purpose based on form type
      if (formContext.form_type !== "unknown form" && !formContext.form_purpose) {
        formContext.form_purpose = this.getGenericPurpose(formContext.form_type);
      }
  
      console.log("Detected form context:", formContext);
      return formContext;
    }
  
    /**
     * Detect form type from form attributes like id, name, class, action URL
     */
    detectFromFormAttributes(formElement, fields) {
      if (!formElement) return null;
      
      const formId = formElement.id || '';
      const formName = formElement.getAttribute('name') || '';
      const formClass = formElement.className || '';
      const formAction = formElement.getAttribute('action') || '';
      
      // Combine all attributes for checking
      const formText = `${formId} ${formName} ${formClass} ${formAction}`.toLowerCase();
      
      return this.matchTextAgainstPatterns(formText, 'attributes', 0.9);
    }
    
    /**
     * Detect form type from page URL
     */
    detectFromURL(formElement, fields) {
      const currentURL = window.location.href.toLowerCase();
      return this.matchTextAgainstPatterns(currentURL, 'urls', 0.8);
    }
    
    /**
     * Detect form type from page title
     */
    detectFromTitle(formElement, fields) {
      const pageTitle = document.title.toLowerCase();
      return this.matchTextAgainstPatterns(pageTitle, 'titles', 0.7);
    }
    
    /**
     * Detect form type from field names
     */
    detectFromFields(formElement, fields) {
      if (!fields || fields.length === 0) return null;
      
      // Create a string of all field names and labels
      let fieldText = fields.map(field => {
        return `${field.name || ''} ${field.label || ''} ${field.type || ''}`;
      }).join(' ').toLowerCase();
      
      // Check for key fields that strongly indicate form type
      const result = this.matchTextAgainstPatterns(fieldText, 'fields', 0.6);
      
      // Adjust confidence based on number of matching fields
      if (result) {
        // Count how many pattern words match
        const pattern = this.formPatterns[result.form_type].fields;
        let matchCount = 0;
        
        for (const word of pattern) {
          if (fieldText.includes(word)) {
            matchCount++;
          }
        }
        
        // Adjust confidence based on percentage of matching fields
        const matchPercentage = matchCount / pattern.length;
        result.confidence = Math.min(0.9, result.confidence + (matchPercentage * 0.3));
      }
      
      return result;
    }
    
    /**
     * Detect form purpose from surrounding text on the page
     */
    detectFromSurroundingText(formElement, fields) {
      if (!formElement) return null;
      
      // Look for heading elements near the form
      let headings = [];
      let element = formElement.previousElementSibling;
      
      // Check up to 5 previous siblings
      for (let i = 0; i < 5 && element; i++) {
        if (element.tagName.match(/^H[1-6]$/)) {
          headings.push(element.textContent);
        }
        element = element.previousElementSibling;
      }
      
      // Also check for a container with an ID or class that might indicate purpose
      let parent = formElement.parentElement;
      let containers = [];
      
      while (parent && containers.length < 3) {
        if (parent.id || parent.className) {
          containers.push(`${parent.id} ${parent.className}`);
        }
        parent = parent.parentElement;
      }
      
      // Combine all text
      const surroundingText = [...headings, ...containers].join(' ').toLowerCase();
      
      // First determine if we can detect the form type from surrounding text
      const typeResult = this.matchTextAgainstPatterns(surroundingText, 'titles', 0.5);
      
      if (!typeResult) return null;
      
      // Now try to extract a more specific purpose
      const purpose = this.extractPurpose(surroundingText, typeResult.form_type);
      
      return {
        ...typeResult,
        form_purpose: purpose || "",
        detection_method: "surrounding_text"
      };
    }
    
    /**
     * Match text against patterns for different form types
     */
    matchTextAgainstPatterns(text, patternType, baseConfidence) {
      let bestMatch = null;
      let highestMatchCount = 0;
      
      for (const [formType, patterns] of Object.entries(this.formPatterns)) {
        const typePatterns = patterns[patternType];
        let matchCount = 0;
        
        for (const pattern of typePatterns) {
          if (text.includes(pattern)) {
            matchCount++;
          }
        }
        
        // Calculate match percentage
        const matchPercentage = typePatterns.length ? matchCount / typePatterns.length : 0;
        
        // If this is a better match than what we've seen so far
        if (matchCount > 0 && matchPercentage > 0.3 && matchCount > highestMatchCount) {
          highestMatchCount = matchCount;
          bestMatch = {
            form_type: `${formType} form`,
            confidence: baseConfidence * matchPercentage,
            detection_method: patternType
          };
        }
      }
      
      return bestMatch;
    }
    
    /**
     * Extract a more specific purpose from surrounding text
     */
    extractPurpose(text, formType) {
      // Remove "form" suffix if present
      const type = formType.replace(' form', '');
      
      // Look for purpose phrases based on form type
      const purposePhrases = {
        registration: ['create your account', 'join our community', 'become a member', 'sign up to'],
        login: ['access your account', 'sign in to continue', 'log in to your'],
        contact: ['get in touch', 'send us a message', 'contact our team'],
        payment: ['complete your purchase', 'process your payment', 'billing information'],
        shipping: ['delivery details', 'shipping information', 'where to send'],
        survey: ['share your feedback', 'tell us what you think', 'rate your experience'],
        employment: ['apply for', 'job application', 'position at', 'work with us'],
        search: ['find what you need', 'search our catalog', 'discover']
      };
      
      // Check if any purpose phrases are in the text
      const relevantPhrases = purposePhrases[type] || [];
      for (const phrase of relevantPhrases) {
        if (text.includes(phrase)) {
          // Extract some context around the phrase
          const index = text.indexOf(phrase);
          const start = Math.max(0, index - 20);
          const end = Math.min(text.length, index + phrase.length + 30);
          
          return text.substring(start, end).trim();
        }
      }
      
      return null;
    }
    
    /**
     * Get a generic purpose for a known form type
     */
    getGenericPurpose(formType) {
      const purposes = {
        'registration form': 'creating a new user account',
        'login form': 'authenticating and accessing your account',
        'contact form': 'sending a message or inquiry',
        'payment form': 'processing your payment information',
        'shipping form': 'collecting delivery information',
        'survey form': 'gathering feedback or opinions',
        'employment form': 'applying for a position',
        'search form': 'finding specific information or items'
      };
      
      return purposes[formType] || "";
    }
  }
  
  // Export the detector
  export default new FormContextDetector();