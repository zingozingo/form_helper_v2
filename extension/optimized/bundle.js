/**
 * Form Helper Extension Bundle
 * 
 * Combined and optimized JavaScript modules for the Form Helper browser extension.
 * Includes all dependencies in a single file to minimize load time and improve performance.
 * 
 * This bundle contains:
 * - Configuration
 * - Utility functions
 * - Event bus
 * - Form analyzer
 * - Content script
 * - Panel script
 * - Background script
 * 
 * @version 1.0.0
 */

/**
 * Global configuration for Form Helper extension
 */
const CONFIG = {
  /**
   * API configuration
   */
  API: {
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
    },
    // Default timeout in milliseconds for fetch requests
    TIMEOUT: 3000
  },

  /**
   * Field type icons for visual representation
   */
  FIELD_ICONS: {
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
  },

  /**
   * Form patterns for detection
   */
  FORM_PATTERNS: {
    registration: {
      fields: ['email', 'password', 'confirm', 'name', 'signup', 'register'],
      urls: ['register', 'signup', 'join', 'create-account', 'new-user'],
      titles: ['register', 'sign up', 'create account', 'join', 'new user'],
      buttonText: ['register', 'sign up', 'create account', 'join now', 'get started', 'submit'],
      requiredFields: ['password', 'email'],
      optionalFields: ['name', 'confirm_password', 'terms', 'agree', 'first_name', 'last_name'],
      purpose: "creating a new user account on this website or service",
      description: "This registration form allows you to create a new account. You'll typically need to provide personal information and choose login credentials."
    },
    login: {
      fields: ['email', 'username', 'password', 'login', 'signin'],
      urls: ['login', 'signin', 'authenticate', 'log-in', 'sign-in'],
      titles: ['login', 'sign in', 'member login', 'log in', 'account login'],
      buttonText: ['login', 'sign in', 'log in', 'access', 'continue', 'submit'],
      requiredFields: ['password'],
      optionalFields: ['email', 'username', 'remember', 'forgot'],
      purpose: "authenticating existing users to access their accounts",
      description: "This login form verifies your identity to grant access to your account. You'll need to enter your credentials to continue."
    },
    contact: {
      fields: ['name', 'email', 'message', 'subject', 'phone', 'contact'],
      urls: ['contact', 'support', 'help', 'feedback'],
      titles: ['contact', 'feedback', 'get in touch', 'support'],
      buttonText: ['send', 'submit', 'send message', 'contact us'],
      requiredFields: ['email'],
      optionalFields: ['name', 'message', 'subject', 'phone', 'company', 'department'],
      purpose: "sending a message or inquiry to the website owner or support team",
      description: "This contact form allows you to send a message to the organization. Your information will be used to respond to your inquiry or feedback."
    },
    payment: {
      fields: ['card', 'credit', 'payment', 'expiry', 'cvv', 'billing'],
      urls: ['checkout', 'payment', 'billing', 'order'],
      titles: ['payment', 'checkout', 'billing information', 'complete order'],
      buttonText: ['pay', 'purchase', 'complete order', 'place order', 'buy now', 'continue to payment'],
      requiredFields: ['payment', 'credit_card', 'card', 'total'],
      optionalFields: ['billing', 'shipping', 'address', 'name', 'email', 'phone'],
      purpose: "processing a payment to complete a purchase",
      description: "This checkout form collects payment and shipping information to process your order."
    }
  },

  /**
   * Default values for auto-fill
   */
  DEFAULT_FIELD_VALUES: {
    email: 'example@example.com',
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    phone: '555-123-4567',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    country: 'United States',
    password: 'SecurePassword123!',
    date: '2023-01-01',
    number: '42',
    text: 'Sample text'
  },

  /**
   * CSS selectors for DOM elements
   * Used for caching selectors and improving performance
   */
  SELECTORS: {
    FORM: 'form',
    INPUTS: 'input:not([type="hidden"]), select, textarea',
    SUBMIT_BUTTONS: 'input[type="submit"], button[type="submit"], button:contains("Submit"), button:contains("Send")',
    LABELS: 'label',
    FIELD_CONTAINERS: '.form-group, .input-group, .field-container'
  },

  /**
   * Logging configuration
   */
  LOGGING: {
    ENABLED: true,
    LEVEL: 'info' // 'debug', 'info', 'warn', 'error'
  }
};

/**
 * Utility functions for Form Helper extension
 */
const UTILS = (function() {
  /**
   * Creates a timeout promise that rejects after the specified time
   * @param {number} ms - Timeout in milliseconds
   * @return {Promise} A promise that rejects after the specified time
   */
  function timeoutPromise(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));
  }

  /**
   * Performs a fetch with a timeout
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} timeout - Timeout in milliseconds
   * @return {Promise<Response>} The fetch response or error
   */
  async function fetchWithTimeout(url, options = {}, timeout = CONFIG.API.TIMEOUT) {
    try {
      return await Promise.race([
        fetch(url, options),
        timeoutPromise(timeout)
      ]);
    } catch (error) {
      logError(`Fetch failed for ${url}:`, error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Logs a message with the specified level
   * @param {string} level - Log level ('debug', 'info', 'warn', 'error')
   * @param {string} message - The message to log
   * @param {any} data - Optional data to log
   */
  function log(level, message, data) {
    if (!CONFIG.LOGGING.ENABLED) return;
    
    const levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    const configLevel = levels[CONFIG.LOGGING.LEVEL] || 1;
    const messageLevel = levels[level] || 1;
    
    if (messageLevel >= configLevel) {
      const prefix = '[Form Helper]';
      
      switch (level) {
        case 'debug':
          console.debug(prefix, message, data || '');
          break;
        case 'warn':
          console.warn(prefix, message, data || '');
          break;
        case 'error':
          console.error(prefix, message, data || '');
          break;
        default:
          console.log(prefix, message, data || '');
      }
    }
  }

  // Specific log level functions
  function logDebug(message, data) {
    log('debug', message, data);
  }

  function logInfo(message, data) {
    log('info', message, data);
  }

  function logWarning(message, data) {
    log('warn', message, data);
  }

  function logError(message, data) {
    log('error', message, data);
  }

  /**
   * Cached DOM element selection to improve performance
   * @param {string} selector - CSS selector
   * @param {Element} context - Parent element (defaults to document)
   * @return {Element} The selected element
   */
  const domCache = {};
  function $(selector, context = document) {
    const cacheKey = `${selector}_${context === document ? 'document' : context.id || 'custom'}`;
    
    if (!domCache[cacheKey]) {
      domCache[cacheKey] = context.querySelector(selector);
    }
    
    return domCache[cacheKey];
  }

  /**
   * Select multiple elements with caching
   * @param {string} selector - CSS selector
   * @param {Element} context - Parent element (defaults to document)
   * @return {NodeList} The selected elements
   */
  function $$(selector, context = document) {
    return context.querySelectorAll(selector);
  }

  /**
   * Clear the DOM cache for a selector or all selectors
   * @param {string} selector - Optional selector to clear
   */
  function clearDomCache(selector) {
    if (selector) {
      const pattern = new RegExp(`^${selector}`);
      Object.keys(domCache).forEach(key => {
        if (pattern.test(key)) {
          delete domCache[key];
        }
      });
    } else {
      Object.keys(domCache).forEach(key => delete domCache[key]);
    }
  }

  /**
   * Creates a DOM element with attributes and content
   * @param {string} tag - The HTML tag name
   * @param {Object} attributes - Element attributes to set
   * @param {string|Element|Array} children - Element content or child elements
   * @return {Element} The created element
   */
  function createElement(tag, attributes = {}, children = null) {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'style' && typeof value === 'object') {
        Object.entries(value).forEach(([prop, val]) => {
          element.style[prop] = val;
        });
      } else if (key === 'className') {
        element.className = value;
      } else if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else if (key === 'textContent') {
        element.textContent = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Add content/children
    if (children !== null) {
      if (Array.isArray(children)) {
        children.forEach(child => {
          if (child instanceof Element) {
            element.appendChild(child);
          } else {
            element.appendChild(document.createTextNode(String(child)));
          }
        });
      } else if (children instanceof Element) {
        element.appendChild(children);
      } else {
        element.textContent = String(children);
      }
    }
    
    return element;
  }

  /**
   * Safely parse JSON with error handling
   * @param {string} text - The JSON string to parse
   * @param {any} defaultValue - Default value to return if parsing fails
   * @return {any} The parsed object or default value
   */
  function safeJsonParse(text, defaultValue = {}) {
    try {
      return JSON.parse(text);
    } catch (error) {
      logError('JSON parse error:', error.message);
      return defaultValue;
    }
  }

  /**
   * Debounce function to limit how often a function can be called
   * @param {Function} func - The function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @return {Function} Debounced function
   */
  function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Creates a unique ID
   * @param {string} prefix - Optional prefix for the ID
   * @return {string} A unique ID
   */
  function generateId(prefix = 'fh') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Guesses field purpose by analyzing name, ID, and label
   * @param {string} name - Field name attribute
   * @param {string} id - Field ID attribute
   * @param {string} label - Field label text
   * @param {string} type - Field type attribute
   * @return {string} Guessed field purpose
   */
  function guessFieldPurpose(name, id, label, type) {
    const textToCheck = ((name || '') + ' ' + (id || '') + ' ' + (label || '')).toLowerCase();
    
    // Common field purposes
    const patterns = {
      'email': ['email', 'e-mail'],
      'password': ['password', 'pwd', 'pass'],
      'confirm_password': ['confirm password', 'verify password', 'retype password'],
      'username': ['username', 'user name', 'login', 'userid'],
      'first_name': ['first name', 'firstname', 'fname', 'given name'],
      'last_name': ['last name', 'lastname', 'lname', 'surname'],
      'full_name': ['full name', 'fullname', 'name', 'your name'],
      'phone': ['phone', 'telephone', 'tel', 'mobile', 'cell'],
      'address': ['address', 'street', 'addr', 'address line'],
      'city': ['city', 'town', 'municipality', 'locality'],
      'state': ['state', 'province', 'region', 'territory'],
      'zip': ['zip', 'postal', 'postcode', 'zip code'],
      'country': ['country', 'nation', 'nationality'],
      'date_of_birth': ['birth', 'dob', 'birthday', 'date of birth'],
      'search': ['search', 'find', 'query', 'lookup']
    };
    
    // Check against patterns
    for (const [purpose, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => textToCheck.includes(keyword))) {
        return purpose;
      }
    }
    
    // Special case for password fields
    if (type === 'password') {
      return 'password';
    }
    
    // Use field type as fallback
    return type;
  }

  /**
   * Returns the default value for a field based on its type and name
   * @param {string} fieldName - The field name
   * @param {string} fieldType - The field type
   * @param {Object} profileData - Optional user profile data
   * @return {string} Default field value
   */
  function getDefaultFieldValue(fieldName, fieldType, profileData = null) {
    // Convert field name to lowercase for comparison
    const lowerName = (fieldName || '').toLowerCase();
    
    // Try to get value from profile first if available
    if (profileData && Object.keys(profileData).length > 0) {
      // Check exact matches and common patterns
      if (profileData[fieldName]) return profileData[fieldName];
      if (profileData[lowerName]) return profileData[lowerName];
      
      // Check field type matches
      if (fieldType === 'email' && profileData.email) return profileData.email;
      if (lowerName.includes('name')) {
        if (lowerName.includes('first') && profileData.firstName) return profileData.firstName;
        if (lowerName.includes('last') && profileData.lastName) return profileData.lastName;
        return profileData.name || CONFIG.DEFAULT_FIELD_VALUES.name;
      }
    }
    
    // Fall back to default values based on field type and name
    if (fieldType === 'email' || lowerName.includes('email')) {
      return CONFIG.DEFAULT_FIELD_VALUES.email;
    } else if (fieldType === 'tel' || lowerName.includes('phone')) {
      return CONFIG.DEFAULT_FIELD_VALUES.phone;
    } else if (fieldType === 'password' || lowerName.includes('password')) {
      return CONFIG.DEFAULT_FIELD_VALUES.password;
    } else if (lowerName.includes('address')) {
      return CONFIG.DEFAULT_FIELD_VALUES.address;
    } else if (lowerName.includes('city')) {
      return CONFIG.DEFAULT_FIELD_VALUES.city;
    } else if (lowerName.includes('state')) {
      return CONFIG.DEFAULT_FIELD_VALUES.state;
    } else if (lowerName.includes('zip') || lowerName.includes('postal')) {
      return CONFIG.DEFAULT_FIELD_VALUES.zip;
    } else if (lowerName.includes('country')) {
      return CONFIG.DEFAULT_FIELD_VALUES.country;
    } else if (lowerName.includes('first') && lowerName.includes('name')) {
      return CONFIG.DEFAULT_FIELD_VALUES.firstName;
    } else if (lowerName.includes('last') && lowerName.includes('name')) {
      return CONFIG.DEFAULT_FIELD_VALUES.lastName;
    } else if (lowerName.includes('name')) {
      return CONFIG.DEFAULT_FIELD_VALUES.name;
    }
    
    // Default by field type
    switch (fieldType) {
      case 'date':
        return CONFIG.DEFAULT_FIELD_VALUES.date;
      case 'number':
        return CONFIG.DEFAULT_FIELD_VALUES.number;
      default:
        return CONFIG.DEFAULT_FIELD_VALUES.text;
    }
  }

  // Return the public API
  return {
    fetchWithTimeout,
    logDebug,
    logInfo,
    logWarning,
    logError,
    $,
    $$,
    clearDomCache,
    createElement,
    safeJsonParse,
    debounce,
    generateId,
    guessFieldPurpose,
    getDefaultFieldValue
  };
})();

/**
 * Event Bus for Form Helper Extension
 */
const EventBus = (function() {
  // Private event registry
  const events = {};
  
  /**
   * Subscribe to an event
   * @param {string} event - Event name to subscribe to
   * @param {Function} callback - Function to call when event is triggered
   * @return {Object} Subscription object with unsubscribe method
   */
  function subscribe(event, callback) {
    if (!events[event]) {
      events[event] = [];
    }
    
    // Add callback to event subscribers
    events[event].push(callback);
    
    // Return subscription object with unsubscribe method
    return {
      unsubscribe: function() {
        events[event] = events[event].filter(cb => cb !== callback);
      }
    };
  }
  
  /**
   * Publish an event with data
   * @param {string} event - Event name to publish
   * @param {any} data - Data to pass to subscribers
   */
  function publish(event, data) {
    if (!events[event]) {
      return;
    }
    
    // Call all subscribers with data
    events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event subscriber for "${event}":`, error);
      }
    });
  }
  
  /**
   * Remove all subscribers for an event
   * @param {string} event - Event name to clear
   */
  function clear(event) {
    if (event) {
      delete events[event];
    }
  }
  
  /**
   * Remove all subscribers for all events
   */
  function clearAll() {
    Object.keys(events).forEach(event => {
      delete events[event];
    });
  }
  
  /**
   * Get count of subscribers for an event
   * @param {string} event - Event name
   * @return {number} Number of subscribers
   */
  function count(event) {
    return events[event] ? events[event].length : 0;
  }
  
  // Return public API
  return {
    subscribe,
    publish,
    clear,
    clearAll,
    count
  };
})();

// Define standard event types to ensure consistency
EventBus.EVENTS = {
  FORM_DETECTED: 'form:detected',
  FORM_PROCESSED: 'form:processed',
  FORM_ERROR: 'form:error',
  FIELD_SELECTED: 'field:selected',
  FIELD_HIGHLIGHTED: 'field:highlighted',
  FIELD_AUTOFILLED: 'field:autofilled',
  SERVER_STATUS_CHANGED: 'server:status-changed',
  PROFILE_UPDATED: 'profile:updated',
  AI_RESPONSE_RECEIVED: 'ai:response-received',
  AI_ERROR: 'ai:error',
  CHAT_MESSAGE_SENT: 'chat:message-sent',
  PANEL_INITIALIZED: 'panel:initialized',
  PDF_PROCESSING_STARTED: 'pdf:processing-started',
  PDF_PROCESSING_COMPLETE: 'pdf:processing-complete',
  PDF_PROCESSING_ERROR: 'pdf:processing-error',
  DOM_CONTENT_LOADED: 'dom:content-loaded'
};

/**
 * Form Analyzer Class
 */
class FormAnalyzer {
  /**
   * Creates a new form analyzer instance
   */
  constructor() {
    // Use the shared form patterns from CONFIG
    this.formPatterns = CONFIG.FORM_PATTERNS;
    
    // Cache for analyzed forms
    this.formCache = new Map();
  }

  /**
   * Analyzes a form element and its fields to determine context and purpose
   * @param {Element} formElement - The form DOM element (can be null for automatic detection)
   * @param {Array} fields - Array of field objects detected in the form
   * @param {Object} pageInfo - Additional page information (URL, title, etc.)
   * @return {Object} Enhanced form context
   */
  analyzeFormContext(formElement, fields, pageInfo = {}) {
    // Check cache first
    const cacheKey = formElement ? formElement.id || formElement.name : 'auto-detected-form';
    if (this.formCache.has(cacheKey)) {
      return this.formCache.get(cacheKey);
    }
    
    // Extract page information
    const url = pageInfo.url || (typeof window !== 'undefined' ? window.location.href : '');
    const title = pageInfo.title || (typeof document !== 'undefined' ? document.title : '');
    const metaDescription = pageInfo.metaDescription || this._getMetaDescription();
    
    // Extract basic form attributes
    const formAttributes = this._extractFormAttributes(formElement);
    
    // Analyze fields to get form type indicators
    const fieldTypes = this._categorizeFields(fields);
    
    // Determine form type based on various signals
    const formTypeAnalysis = this._determineFormType(formElement, fields, fieldTypes, url, title);
    
    // Build comprehensive form context
    const formContext = {
      form_type: formTypeAnalysis.formType || "unknown form",
      form_purpose: formTypeAnalysis.purpose || "collecting information",
      confidence: formTypeAnalysis.confidence || 0.5,
      description: formTypeAnalysis.description || "This form collects information from users.",
      field_count: fields ? fields.length : 0,
      required_fields: fieldTypes.requiredFields || [],
      optional_fields: fieldTypes.optionalFields || [],
      detected_fields: fieldTypes.fieldTypes || [],
      page_info: {
        url,
        title,
        meta_description: metaDescription
      },
      form_attributes: formAttributes
    };
    
    // Cache the result
    this.formCache.set(cacheKey, formContext);
    
    return formContext;
  }

  /**
   * Extracts basic form attributes from a form element
   * @param {Element} formElement - The form DOM element
   * @return {Object} Form attributes
   * @private
   */
  _extractFormAttributes(formElement) {
    if (!formElement) {
      return {
        id: '',
        name: '',
        action: '',
        method: '',
        enctype: '',
        novalidate: false
      };
    }
    
    return {
      id: formElement.id || '',
      name: formElement.getAttribute('name') || '',
      action: formElement.getAttribute('action') || '',
      method: formElement.getAttribute('method') || '',
      enctype: formElement.getAttribute('enctype') || '',
      novalidate: formElement.hasAttribute('novalidate'),
      autocomplete: formElement.getAttribute('autocomplete') || ''
    };
  }

  /**
   * Gets meta description from the page
   * @return {string} Meta description or empty string
   * @private
   */
  _getMetaDescription() {
    if (typeof document === 'undefined') return '';
    
    const metaDesc = document.querySelector('meta[name="description"]');
    return metaDesc ? metaDesc.getAttribute('content') : '';
  }

  /**
   * Categorizes form fields by type and required status
   * @param {Array} fields - Array of field objects
   * @return {Object} Field categories
   * @private
   */
  _categorizeFields(fields) {
    if (!fields || !Array.isArray(fields)) {
      return {
        fieldTypes: [],
        requiredFields: [],
        optionalFields: []
      };
    }
    
    const fieldTypes = new Set();
    const requiredFields = [];
    const optionalFields = [];
    
    fields.forEach(field => {
      if (!field) return;
      
      // Get basic field info
      const fieldName = field.name || field.id || '';
      const fieldType = field.type || '';
      const lowerName = fieldName.toLowerCase();
      
      // Add to field types
      fieldTypes.add(fieldType);
      
      // Add to required or optional fields
      if (field.required) {
        requiredFields.push({
          name: fieldName,
          type: fieldType
        });
      } else {
        optionalFields.push({
          name: fieldName,
          type: fieldType
        });
      }
      
      // Add to field types based on name patterns
      Object.entries(this.formPatterns).forEach(([formType, pattern]) => {
        pattern.fields.forEach(keyword => {
          if (lowerName.includes(keyword)) {
            fieldTypes.add(keyword);
          }
        });
      });
    });
    
    return {
      fieldTypes: Array.from(fieldTypes),
      requiredFields,
      optionalFields
    };
  }

  /**
   * Determines form type based on multiple signals
   * @param {Element} formElement - The form DOM element
   * @param {Array} fields - Array of field objects
   * @param {Object} fieldTypes - Categorized field types
   * @param {string} url - Page URL
   * @param {string} title - Page title
   * @return {Object} Form type analysis
   * @private
   */
  _determineFormType(formElement, fields, fieldTypes, url, title) {
    // Prepare form type candidates with initial score
    const candidates = Object.entries(this.formPatterns).map(([formType, pattern]) => ({
      formType,
      pattern,
      score: 0,
      confidence: 0
    }));
    
    // Score URL matches
    this._scoreUrlMatches(candidates, url);
    
    // Score title matches
    this._scoreTitleMatches(candidates, title);
    
    // Score field type matches
    this._scoreFieldMatches(candidates, fieldTypes, fields);
    
    // Score form attributes
    this._scoreFormAttributes(candidates, formElement);
    
    // Find the highest scoring candidate
    candidates.sort((a, b) => b.score - a.score);
    const bestMatch = candidates[0];
    
    // Calculate confidence based on score difference from next best match
    const nextBestScore = candidates.length > 1 ? candidates[1].score : 0;
    const scoreDifference = bestMatch.score - nextBestScore;
    bestMatch.confidence = Math.min(0.5 + (scoreDifference / 10), 0.95);
    
    // If best match has a very low score, return unknown
    if (bestMatch.score < 2) {
      return {
        formType: "unknown form",
        purpose: "collecting information",
        confidence: 0.5,
        description: "This appears to be a form for collecting information. The exact purpose couldn't be determined."
      };
    }
    
    // Return the best match with its pattern details
    return {
      formType: bestMatch.formType + " form",
      purpose: bestMatch.pattern.purpose,
      confidence: bestMatch.confidence,
      description: bestMatch.pattern.description
    };
  }

  /**
   * Scores URL matches for form type detection
   * @param {Array} candidates - Form type candidates
   * @param {string} url - Page URL
   * @private
   */
  _scoreUrlMatches(candidates, url) {
    if (!url) return;
    
    const lowerUrl = url.toLowerCase();
    
    candidates.forEach(candidate => {
      candidate.pattern.urls.forEach(keyword => {
        if (lowerUrl.includes(keyword)) {
          // URL matches are strong indicators
          candidate.score += 3;
        }
      });
    });
  }

  /**
   * Scores title matches for form type detection
   * @param {Array} candidates - Form type candidates
   * @param {string} title - Page title
   * @private
   */
  _scoreTitleMatches(candidates, title) {
    if (!title) return;
    
    const lowerTitle = title.toLowerCase();
    
    candidates.forEach(candidate => {
      candidate.pattern.titles.forEach(keyword => {
        if (lowerTitle.includes(keyword)) {
          // Title matches are good indicators
          candidate.score += 2;
        }
      });
    });
  }

  /**
   * Scores field matches for form type detection
   * @param {Array} candidates - Form type candidates
   * @param {Object} fieldTypes - Categorized field types
   * @param {Array} fields - Original field objects
   * @private
   */
  _scoreFieldMatches(candidates, fieldTypes, fields) {
    if (!fieldTypes || !fieldTypes.fieldTypes || !fields) return;
    
    // Check field types
    candidates.forEach(candidate => {
      // Check required fields
      candidate.pattern.requiredFields.forEach(requiredField => {
        if (this._hasFieldType(fieldTypes.fieldTypes, requiredField) || 
            this._hasFieldName(fields, requiredField)) {
          candidate.score += 2;
        } else {
          // Missing required fields is a negative signal
          candidate.score -= 1;
        }
      });
      
      // Check optional fields
      candidate.pattern.optionalFields.forEach(optionalField => {
        if (this._hasFieldType(fieldTypes.fieldTypes, optionalField) || 
            this._hasFieldName(fields, optionalField)) {
          candidate.score += 1;
        }
      });
    });
  }

  /**
   * Scores form attributes for form type detection
   * @param {Array} candidates - Form type candidates
   * @param {Element} formElement - The form DOM element
   * @private
   */
  _scoreFormAttributes(candidates, formElement) {
    if (!formElement) return;
    
    // Check form ID, name, action, and class
    const formId = (formElement.id || '').toLowerCase();
    const formName = (formElement.getAttribute('name') || '').toLowerCase();
    const formAction = (formElement.getAttribute('action') || '').toLowerCase();
    const formClass = (formElement.className || '').toLowerCase();
    
    // Check submit button text
    let submitButtonText = '';
    const submitButton = formElement.querySelector('button[type="submit"], input[type="submit"]');
    if (submitButton) {
      submitButtonText = (submitButton.textContent || submitButton.value || '').toLowerCase();
    }
    
    candidates.forEach(candidate => {
      // Check form attributes
      if (candidate.pattern.attributes) {
        candidate.pattern.attributes.forEach(attr => {
          if (formId.includes(attr) || formName.includes(attr) || 
              formAction.includes(attr) || formClass.includes(attr)) {
            candidate.score += 2;
          }
        });
      }
      
      // Check button text
      candidate.pattern.buttonText.forEach(text => {
        if (submitButtonText.includes(text)) {
          candidate.score += 2;
        }
      });
    });
  }

  /**
   * Checks if field types array includes a specific type
   * @param {Array} fieldTypes - Array of field types
   * @param {string} typeToFind - Type to search for
   * @return {boolean} True if type is found
   * @private
   */
  _hasFieldType(fieldTypes, typeToFind) {
    return fieldTypes.some(type => type === typeToFind || type.includes(typeToFind));
  }

  /**
   * Checks if fields array includes a field with a specific name pattern
   * @param {Array} fields - Array of field objects
   * @param {string} namePattern - Name pattern to search for
   * @return {boolean} True if field name is found
   * @private
   */
  _hasFieldName(fields, namePattern) {
    return fields.some(field => {
      const fieldName = (field.name || field.id || '').toLowerCase();
      return fieldName.includes(namePattern);
    });
  }

  /**
   * Generates a response to a question about the form
   * @param {string} question - User's question about the form
   * @param {Object} formContext - Form context information
   * @return {string} Response to the question
   */
  generateFormContextResponse(question, formContext) {
    // Handle null or invalid inputs
    if (!question || !formContext) {
      return "I couldn't determine what this form is for. It appears to be collecting information from users.";
    }
    
    const lowerQuestion = question.toLowerCase();
    const formType = formContext.form_type?.replace(" form", "").trim() || "unknown";
    const formPurpose = formContext.form_purpose || "collecting information";
    
    // Questions about form type/what kind of form
    if ((lowerQuestion.includes('what') || lowerQuestion.includes('which')) && 
        (lowerQuestion.includes('kind') || lowerQuestion.includes('type'))) {
      
      let response = `This is a ${formType} form`;
      if (formPurpose) {
        response += ` for ${formPurpose}`;
      }
      
      if (formContext.field_count) {
        response += `. It contains ${formContext.field_count} fields`;
        
        if (formContext.detected_fields && formContext.detected_fields.length > 0) {
          const mainFields = formContext.detected_fields.slice(0, 3).join(', ');
          response += `, including ${mainFields}`;
        }
      }
      
      return response + '.';
    }
    
    // Questions about form purpose
    if (lowerQuestion.includes('purpose') || 
        (lowerQuestion.includes('what') && lowerQuestion.includes('for'))) {
      
      let response = `This ${formType} form is used for ${formPurpose}`;
      
      if (formContext.required_fields && formContext.required_fields.length > 0) {
        response += `. You'll need to fill out required fields like `;
        const requiredFieldExamples = formContext.required_fields
          .slice(0, 2)
          .map(f => f.name || f.type)
          .join(' and ');
          
        response += requiredFieldExamples;
      }
      
      return response + '.';
    }
    
    // Default response with form description
    if (formContext.description) {
      return formContext.description;
    }
    
    // Very generic fallback
    return `This appears to be a ${formType} form for ${formPurpose}. I can help you understand what each field is for if you have specific questions.`;
  }

  /**
   * Enhances a password field with contextual information
   * @param {Object} field - The password field object
   * @param {Array} allFields - All fields in the form
   * @param {Element} formElement - The form DOM element
   * @param {Object} formContext - The detected form context
   * @return {Object} Enhanced password field
   */
  enhancePasswordField(field, allFields, formElement, formContext) {
    // Start with the current field data
    const enhancedField = { ...field };
    
    // Always make password fields required by default unless explicitly marked optional
    enhancedField.required = field.required !== false;
    
    // Determine if we're in a registration or login form
    let formType = "unknown";
    
    if (formContext && formContext.form_type) {
      // Extract form type from context
      const contextType = formContext.form_type.toLowerCase();
      if (contextType.includes('register') || contextType.includes('signup')) {
        formType = 'registration';
      } else if (contextType.includes('login') || contextType.includes('signin')) {
        formType = 'login';
      }
    } else {
      // Try to determine from field patterns if context is not available
      formType = this._determinePasswordFormType(allFields, formElement);
    }
    
    enhancedField.formType = formType;
    
    // Enhance purpose description based on context
    if (formType === 'registration') {
      enhancedField.purpose = 'This field is for creating a secure password that will protect your new account.';
      enhancedField.contextSpecificInfo = {
        purpose: 'Creating a strong password for your new account',
        requirements: 'Usually requires 8+ characters with a mix of letters, numbers, and symbols',
        strength: "Use a unique password that you don't use on other sites for better security",
        suggestion: "Consider using a password manager to generate and store a strong password"
      };
    } else if (formType === 'login') {
      enhancedField.purpose = 'This field is for entering your existing password to access your account.';
      enhancedField.contextSpecificInfo = {
        purpose: 'Authenticating your identity to access your account',
        recovery: 'If you forgot your password, look for a "Forgot Password" link near the login form',
        security: "Never share your password with anyone, and ensure you're on the correct website before entering it"
      };
    } else {
      enhancedField.purpose = 'This password field helps secure your information or access.';
      enhancedField.contextSpecificInfo = {
        purpose: 'Protecting access to sensitive information',
        security: 'Always use strong, unique passwords for better security',
        suggestion: 'Include a mix of uppercase and lowercase letters, numbers, and symbols'
      };
    }
    
    return enhancedField;
  }

  /**
   * Determines if a password field is in a registration or login form
   * @param {Array} allFields - All fields in the form
   * @param {Element} formElement - The form DOM element
   * @return {string} Form type ('registration', 'login', or 'unknown')
   * @private
   */
  _determinePasswordFormType(allFields, formElement) {
    // Registration indicators
    const hasConfirmPassword = this._hasFieldWithNamePattern(allFields, ['confirm', 'password']);
    const hasTermsCheckbox = this._hasFieldWithNamePattern(allFields, ['terms', 'agree', 'accept']);
    const hasRegistrationName = this._hasElementWithText(formElement, ['register', 'sign up', 'create account', 'join']);
    
    // Login indicators
    const hasForgotPassword = this._hasElementWithText(formElement, ['forgot password', 'reset password']);
    const hasRememberMe = this._hasFieldWithNamePattern(allFields, ['remember', 'stay logged in']);
    const hasLoginName = this._hasElementWithText(formElement, ['login', 'sign in', 'log in']);
    
    // Count indicators
    const registrationScore = (hasConfirmPassword ? 2 : 0) + 
                              (hasTermsCheckbox ? 1 : 0) + 
                              (hasRegistrationName ? 2 : 0);
                              
    const loginScore = (hasForgotPassword ? 2 : 0) + 
                        (hasRememberMe ? 1 : 0) + 
                        (hasLoginName ? 2 : 0) + 
                        (allFields && allFields.length <= 3 ? 1 : 0);
    
    if (registrationScore > loginScore) {
      return 'registration';
    } else if (loginScore > registrationScore) {
      return 'login';
    } else {
      return 'unknown';
    }
  }

  /**
   * Checks if fields array includes fields with specific name patterns
   * @param {Array} fields - Array of field objects
   * @param {Array} patterns - Arrays of name patterns to search for
   * @return {boolean} True if field name patterns are found
   * @private
   */
  _hasFieldWithNamePattern(fields, patterns) {
    if (!fields || !Array.isArray(fields)) return false;
    
    return fields.some(field => {
      const fieldName = ((field.name || '') + ' ' + (field.label || '') + ' ' + (field.id || '')).toLowerCase();
      return patterns.some(pattern => fieldName.includes(pattern.toLowerCase()));
    });
  }

  /**
   * Checks if form element contains elements with specific text patterns
   * @param {Element} formElement - The form DOM element
   * @param {Array} patterns - Arrays of text patterns to search for
   * @return {boolean} True if text patterns are found
   * @private
   */
  _hasElementWithText(formElement, patterns) {
    if (!formElement) return false;
    
    // Get all text content inside the form
    const formText = formElement.textContent.toLowerCase();
    
    // Check for patterns in the entire form text
    for (const pattern of patterns) {
      if (formText.includes(pattern.toLowerCase())) {
        return true;
      }
    }
    
    // Check for specific elements like links, buttons, labels
    const textElements = formElement.querySelectorAll('a, button, label, h1, h2, h3, h4, span, div, p');
    
    for (const element of textElements) {
      const elementText = element.textContent.toLowerCase();
      for (const pattern of patterns) {
        if (elementText.includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }
    
    return false;
  }
}

// Initialize form analyzer instance
if (typeof window !== 'undefined') {
  window.formAnalyzer = new FormAnalyzer();
}

/**
 * Determine which script to execute based on the current file
 */
function initializeExtension() {
  // Export to global scope for backward compatibility 
  // and access from other extension components
  window.CONFIG = CONFIG;
  window.UTILS = UTILS;
  window.EventBus = EventBus;
  window.formAnalyzer = window.formAnalyzer || new FormAnalyzer();
  
  // Get the current script URL to determine which module to initialize
  const currentScript = document.currentScript?.src || '';
  
  // Initialize appropriate module based on file path
  if (currentScript.includes('panel')) {
    // We're in the panel context
    initializePanel();
  } else if (currentScript.includes('background')) {
    // We're in the background context
    initializeBackground();
  } else {
    // Default to content script if not in panel or background
    initializeContent();
  }
  
  // Log initialization
  UTILS.logInfo('Form Helper extension initialized');
}

/**
 * Initialize panel functionality
 */
function initializePanel() {
  document.addEventListener('DOMContentLoaded', () => {
    UTILS.logInfo('Panel DOM loaded, initializing panel...');
    
    // Implementation details for panel initialization
    // will be loaded from FormHelperPanel code below
  });
}

/**
 * Initialize background script functionality
 */
function initializeBackground() {
  UTILS.logInfo('Background script initializing...');
  
  // Implementation details for background initialization
  // will be loaded from FormHelperBackground code below
}

/**
 * Initialize content script functionality
 */
function initializeContent() {
  UTILS.logInfo('Content script initializing...');
  
  // Implementation details for content script initialization
  // will be loaded from FormHelperContent code below
}

// Initialize the extension when script is loaded
if (typeof window !== 'undefined') {
  initializeExtension();
}