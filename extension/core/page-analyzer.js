/**
 * Page Analyzer - Determines if a page contains legitimate forms
 * 
 * This module provides robust detection of form content on web pages
 * and helps determine whether the Form Helper should be activated.
 */

// Page type constants
const PageTypes = {
  PRIMARY_FORM: 'primary_form',     // Pages where forms are the main content
  HAS_FORMS: 'has_forms',           // Pages that contain forms but aren't primarily form pages
  NO_FORMS: 'no_forms',             // Pages with no significant form elements
  EXCLUDED: 'excluded'              // Known sites to ignore regardless of form content
};

// Configuration for form detection
const CONFIG = {
  // Minimum required input elements for a form to be considered legitimate
  MIN_FORM_INPUTS: 3,
  
  // Minimum ratio of form elements to total page elements for PRIMARY_FORM classification
  PRIMARY_FORM_RATIO: 0.1,
  
  // Weight factors for different element types
  ELEMENT_WEIGHTS: {
    'input': 1.0,
    'select': 1.0,
    'textarea': 1.0,
    'button': 0.5,
    'label': 0.5
  },
  
  // Excluded domains (partial matches)
  EXCLUDED_DOMAINS: [
    'instagram.com',
    'twitter.com',
    'facebook.com',
    'linkedin.com',
    'youtube.com',
    'reddit.com',
    'tiktok.com',
    'pinterest.com',
    'netflix.com',
    'spotify.com',
    'amazon.com',
    'google.com/maps',
    'docs.google.com',
    'calendar.google.com',
    'mail.google.com',
    'outlook.com',
    'yahoo.com/mail'
  ],
  
  // Excluded page patterns (URL paths)
  EXCLUDED_PATHS: [
    '/feed',
    '/home',
    '/timeline',
    '/trending',
    '/popular',
    '/explore',
    '/search',
    '/messages',
    '/notifications',
    '/profile',
    '/settings'
  ],
  
  // Whitelist of domains that should be checked for forms regardless of other rules
  WHITELIST_DOMAINS: [
    'login.microsoftonline.com',
    'accounts.google.com',
    'signin.aws.amazon.com',
    'auth0.com',
    'login.salesforce.com'
  ],
  
  // Search form patterns to exclude
  SEARCH_FORM_PATTERNS: [
    {selector: 'form', attributeValues: {'role': 'search'}},
    {selector: 'input', attributeValues: {'type': 'search'}},
    {selector: 'form input[type="text"]', maxInputs: 1, hasButton: true}
  ],
  
  // Known form pages - will be classified as PRIMARY_FORM
  KNOWN_FORM_PAGES: [
    {domain: 'docs.google.com', pathPattern: /\/forms\//},
    {domain: 'forms.gle', pathPattern: null},
    {domain: 'surveymonkey.com', pathPattern: /\/r\//},
    {domain: 'typeform.com', pathPattern: /\/to\//},
    {domain: 'jotform.com', pathPattern: /\/form\//}
  ],
  
  // Site-specific rules that override default behavior
  SITE_SPECIFIC_RULES: {
    'github.com': {
      excludePaths: ['/pulls', '/issues', '/marketplace', '/explore'],
      includePathPatterns: [/\/login/, /\/join/, /\/settings\/profile/]
    },
    'twitter.com': {
      forceShowOnPatterns: [/\/i\/flow\/signup/, /\/i\/flow\/login/]
    },
    'facebook.com': {
      forceShowOnPatterns: [/\/login/, /\/signup/]
    }
  }
};

/**
 * PageAnalyzer class - Analyzes a page to determine if it contains legitimate forms
 */
class PageAnalyzer {
  constructor(config = CONFIG) {
    this.config = config;
    this.cachedPageType = null;
    this.cachedAnalysis = null;
  }
  
  /**
   * Performs a fast pre-check to quickly determine if this page should be excluded
   * @returns {boolean} True if the page should be immediately excluded
   */
  fastExclusionCheck() {
    const currentUrl = window.location.href.toLowerCase();
    const currentDomain = window.location.hostname.toLowerCase();
    
    // Check excluded domains list
    const isExcludedDomain = this.config.EXCLUDED_DOMAINS.some(domain => {
      return currentDomain.includes(domain);
    });
    
    if (isExcludedDomain) {
      // Check for whitelisted paths on excluded domains
      const currentPath = window.location.pathname.toLowerCase();
      
      // Check site-specific rules
      const domainRule = this.getSiteSpecificRules(currentDomain);
      if (domainRule && domainRule.forceShowOnPatterns) {
        const shouldForceShow = domainRule.forceShowOnPatterns.some(pattern => {
          return pattern.test(currentPath);
        });
        
        if (shouldForceShow) {
          console.log('🔍 PageAnalyzer: Excluded domain but path is whitelisted', {
            domain: currentDomain,
            path: currentPath
          });
          return false; // Don't exclude this page
        }
      }
      
      console.log('🔍 PageAnalyzer: Page is on excluded domain', { domain: currentDomain });
      return true; // Exclude this page
    }
    
    // Check excluded paths
    const currentPath = window.location.pathname.toLowerCase();
    const isExcludedPath = this.config.EXCLUDED_PATHS.some(path => {
      return currentPath.includes(path);
    });
    
    if (isExcludedPath) {
      console.log('🔍 PageAnalyzer: Page has excluded path', { path: currentPath });
      return true; // Exclude this page
    }
    
    // Check site-specific exclusion rules
    const domainRule = this.getSiteSpecificRules(currentDomain);
    if (domainRule && domainRule.excludePaths) {
      const isPathExcluded = domainRule.excludePaths.some(path => {
        return currentPath.includes(path);
      });
      
      if (isPathExcluded) {
        console.log('🔍 PageAnalyzer: Path excluded by site-specific rule', {
          domain: currentDomain,
          path: currentPath
        });
        return true; // Exclude this page
      }
    }
    
    // Check whitelist
    const isWhitelisted = this.config.WHITELIST_DOMAINS.some(domain => {
      return currentDomain.includes(domain);
    });
    
    if (isWhitelisted) {
      console.log('🔍 PageAnalyzer: Page is on whitelisted domain', { domain: currentDomain });
      return false; // Don't exclude this page
    }
    
    // Check known form pages
    const isKnownFormPage = this.config.KNOWN_FORM_PAGES.some(entry => {
      if (currentDomain.includes(entry.domain)) {
        return !entry.pathPattern || entry.pathPattern.test(currentPath);
      }
      return false;
    });
    
    if (isKnownFormPage) {
      console.log('🔍 PageAnalyzer: Page is a known form page', {
        domain: currentDomain,
        path: currentPath
      });
      return false; // Don't exclude this page
    }
    
    // If we get here, further analysis is needed
    return false;
  }
  
  /**
   * Check if a form element is likely just a search form
   * @param {Element} formElement - The form element to check
   * @returns {boolean} True if the form appears to be a search form
   */
  isSearchForm(formElement) {
    // Check form role
    if (formElement.getAttribute('role') === 'search') {
      return true;
    }
    
    // Check for search input
    if (formElement.querySelector('input[type="search"]')) {
      return true;
    }
    
    // Check form action for search keywords
    const action = formElement.getAttribute('action') || '';
    if (action && (action.includes('search') || action.includes('query') || action.includes('find'))) {
      return true;
    }
    
    // Check for search classes or IDs
    const formId = formElement.id.toLowerCase();
    const formClass = formElement.className.toLowerCase();
    
    if (formId.includes('search') || formClass.includes('search')) {
      return true;
    }
    
    // Check if the form has only one text input and a button (typical search form)
    const textInputs = formElement.querySelectorAll('input[type="text"]');
    const buttons = formElement.querySelectorAll('button, input[type="submit"]');
    
    if (textInputs.length === 1 && buttons.length >= 1) {
      // Check the input for search-related attributes
      const input = textInputs[0];
      const name = input.name || '';
      const placeholder = input.placeholder || '';
      
      if (name.includes('search') || name.includes('query') || 
          placeholder.includes('search') || placeholder.includes('find')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if a form element is likely just a newsletter/subscription form
   * @param {Element} formElement - The form element to check
   * @returns {boolean} True if the form appears to be a newsletter form
   */
  isNewsletterForm(formElement) {
    // Check for newsletter keywords in form attributes
    const formId = formElement.id.toLowerCase();
    const formClass = formElement.className.toLowerCase();
    const formAction = (formElement.getAttribute('action') || '').toLowerCase();
    
    if (formId.includes('newsletter') || formId.includes('subscribe') ||
        formClass.includes('newsletter') || formClass.includes('subscribe') ||
        formAction.includes('newsletter') || formAction.includes('subscribe')) {
      return true;
    }
    
    // Check for just email input + submit button pattern
    const inputs = formElement.querySelectorAll('input:not([type="hidden"]):not([type="submit"])');
    
    if (inputs.length === 1) {
      const input = inputs[0];
      if (input.type === 'email' || input.name?.includes('email') || input.placeholder?.includes('email')) {
        return true;
      }
    }
    
    // Check for newsletter texts
    const formText = formElement.textContent.toLowerCase();
    if ((formText.includes('newsletter') || formText.includes('subscribe') || 
         formText.includes('sign up for') || formText.includes('updates')) &&
        inputs.length <= 2) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Checks if a form is a simple comment form
   * @param {Element} formElement - The form element to check
   * @returns {boolean} True if the form appears to be a comment form
   */
  isCommentForm(formElement) {
    // Check for comment keywords in form attributes
    const formId = formElement.id.toLowerCase();
    const formClass = formElement.className.toLowerCase();
    
    if (formId.includes('comment') || formClass.includes('comment')) {
      return true;
    }
    
    // Check for textarea + submit button pattern
    const textareas = formElement.querySelectorAll('textarea');
    const inputs = formElement.querySelectorAll('input:not([type="hidden"]):not([type="submit"])');
    
    if (textareas.length === 1 && inputs.length <= 1) {
      // Check for comment in textarea attributes
      const textarea = textareas[0];
      if (textarea.id?.includes('comment') || textarea.name?.includes('comment') || 
          textarea.placeholder?.includes('comment') || textarea.placeholder?.includes('reply')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Checks if a form element is legitimate (not search, newsletter, etc.)
   * @param {Element} formElement - The form element to check
   * @returns {boolean} True if the form is a legitimate form
   */
  isLegitimateForm(formElement) {
    // Skip if it's a search form
    if (this.isSearchForm(formElement)) {
      return false;
    }
    
    // Skip if it's a newsletter form
    if (this.isNewsletterForm(formElement)) {
      return false;
    }
    
    // Skip if it's a comment form
    if (this.isCommentForm(formElement)) {
      return false;
    }
    
    // Count relevant input elements
    const inputElements = formElement.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
    const selectElements = formElement.querySelectorAll('select');
    const textareaElements = formElement.querySelectorAll('textarea');
    
    const totalInteractiveElements = inputElements.length + selectElements.length + textareaElements.length;
    
    // Check minimum threshold
    return totalInteractiveElements >= this.config.MIN_FORM_INPUTS;
  }
  
  /**
   * Analyzes the page to count form elements and determine form presence
   * @returns {Object} Analysis results with counts and ratios
   */
  analyzePageFormContent() {
    if (this.cachedAnalysis) {
      return this.cachedAnalysis;
    }
    
    // Get all forms on the page
    const allForms = document.querySelectorAll('form');
    
    // Count legitimate forms
    let legitimateForms = 0;
    let totalFormInputs = 0;
    
    // Analyze each form
    const formAnalysis = Array.from(allForms).map(form => {
      const isLegitimate = this.isLegitimateForm(form);
      
      // Count inputs in this form
      const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
      const selects = form.querySelectorAll('select');
      const textareas = form.querySelectorAll('textarea');
      const totalInputs = inputs.length + selects.length + textareas.length;
      
      if (isLegitimate) {
        legitimateForms++;
        totalFormInputs += totalInputs;
      }
      
      return {
        form: form,
        isLegitimate: isLegitimate,
        inputCount: totalInputs,
        isSearch: this.isSearchForm(form),
        isNewsletter: this.isNewsletterForm(form),
        isComment: this.isCommentForm(form)
      };
    });
    
    // Check for implicit forms (input groups not in form tags)
    const standaloneForms = this.detectImplicitForms();
    legitimateForms += standaloneForms.length;
    
    // Calculate form ratio (form elements vs all elements on page)
    const formElements = document.querySelectorAll('input, select, textarea, button, label');
    const allElements = document.querySelectorAll('*');
    
    const formElementRatio = formElements.length / allElements.length;
    
    // Calculate "form density" - weighted count of form elements
    let formDensity = 0;
    
    Object.keys(this.config.ELEMENT_WEIGHTS).forEach(elementType => {
      const elements = document.querySelectorAll(elementType);
      formDensity += elements.length * this.config.ELEMENT_WEIGHTS[elementType];
    });
    
    const analysis = {
      legitimateForms: legitimateForms,
      totalFormInputs: totalFormInputs,
      totalForms: allForms.length,
      standaloneForms: standaloneForms.length,
      formElementRatio: formElementRatio,
      formDensity: formDensity,
      formAnalysis: formAnalysis
    };
    
    this.cachedAnalysis = analysis;
    return analysis;
  }
  
  /**
   * Detects implicit forms - collections of input elements not within <form> tags
   * @returns {Array} Array of element containers that likely represent forms
   */
  detectImplicitForms() {
    // Define containers that might hold implicit forms
    const potentialContainers = [];
    
    // Find input elements not inside form tags
    const inputElements = Array.from(document.querySelectorAll('input, select, textarea')).filter(input => {
      return !input.closest('form');
    });
    
    // Skip if there aren't enough elements
    if (inputElements.length < this.config.MIN_FORM_INPUTS) {
      return [];
    }
    
    // Group inputs by their nearest common container
    const containerMap = new Map();
    
    inputElements.forEach(input => {
      // Find closest div, section, article or similar container
      const container = input.closest('div, section, article, main, aside, fieldset');
      if (!container) return;
      
      // Use the container as a key
      if (!containerMap.has(container)) {
        containerMap.set(container, []);
      }
      
      containerMap.get(container).push(input);
    });
    
    // Check containers with enough inputs
    containerMap.forEach((inputs, container) => {
      if (inputs.length >= this.config.MIN_FORM_INPUTS) {
        // Check if container has a button or submit-like element
        const hasSubmitElement = !!container.querySelector('button, input[type="submit"], input[type="button"], [role="button"], .btn, .button');
        
        // Add to potential forms if it has enough inputs and a submit mechanism
        if (hasSubmitElement) {
          potentialContainers.push(container);
        }
      }
    });
    
    return potentialContainers;
  }
  
  /**
   * Get site-specific rules for a domain
   * @param {string} domain - The domain to get rules for
   * @returns {Object|null} The site-specific rules or null
   */
  getSiteSpecificRules(domain) {
    // Try direct match
    if (this.config.SITE_SPECIFIC_RULES[domain]) {
      return this.config.SITE_SPECIFIC_RULES[domain];
    }
    
    // Try partial match
    for (const key in this.config.SITE_SPECIFIC_RULES) {
      if (domain.includes(key)) {
        return this.config.SITE_SPECIFIC_RULES[key];
      }
    }
    
    return null;
  }
  
  /**
   * Determines the page type based on form presence and content
   * @returns {string} The page type (one of PageTypes values)
   */
  determinePageType() {
    if (this.cachedPageType !== null) {
      return this.cachedPageType;
    }
    
    // First, do quick exclusion check
    if (this.fastExclusionCheck()) {
      this.cachedPageType = PageTypes.EXCLUDED;
      return PageTypes.EXCLUDED;
    }
    
    // Analyze page content for forms
    const analysis = this.analyzePageFormContent();
    console.log('🔍 PageAnalyzer: Page analysis complete', analysis);
    
    let pageType;
    
    // Check for whitelist and known form pages first
    const currentDomain = window.location.hostname.toLowerCase();
    const currentPath = window.location.pathname.toLowerCase();
    
    const isWhitelisted = this.config.WHITELIST_DOMAINS.some(domain => {
      return currentDomain.includes(domain);
    });
    
    const isKnownFormPage = this.config.KNOWN_FORM_PAGES.some(entry => {
      if (currentDomain.includes(entry.domain)) {
        return !entry.pathPattern || entry.pathPattern.test(currentPath);
      }
      return false;
    });
    
    if (isWhitelisted || isKnownFormPage) {
      pageType = PageTypes.PRIMARY_FORM;
    }
    // Check if this is primarily a form page
    else if (analysis.legitimateForms > 0 && 
             (analysis.formElementRatio >= this.config.PRIMARY_FORM_RATIO || 
              analysis.totalFormInputs >= 8)) {
      pageType = PageTypes.PRIMARY_FORM;
    }
    // Check if page has some legitimate forms
    else if (analysis.legitimateForms > 0) {
      pageType = PageTypes.HAS_FORMS;
    }
    // No forms found
    else {
      pageType = PageTypes.NO_FORMS;
    }
    
    // Finally, check for site-specific overrides
    const siteRules = this.getSiteSpecificRules(currentDomain);
    if (siteRules) {
      if (siteRules.forceShowOnPatterns) {
        const shouldForceShow = siteRules.forceShowOnPatterns.some(pattern => {
          return pattern.test(currentPath);
        });
        
        if (shouldForceShow) {
          pageType = PageTypes.PRIMARY_FORM;
        }
      }
      
      if (siteRules.includePathPatterns) {
        const shouldInclude = siteRules.includePathPatterns.some(pattern => {
          return pattern.test(currentPath);
        });
        
        if (shouldInclude && pageType === PageTypes.NO_FORMS) {
          pageType = PageTypes.HAS_FORMS;
        }
      }
    }
    
    this.cachedPageType = pageType;
    return pageType;
  }
  
  /**
   * Performs a lightweight check for form presence without detailed analysis
   * @returns {boolean} True if forms are detected
   */
  quickFormCheck() {
    // Check for explicit forms with enough inputs
    const explicitForms = document.querySelectorAll('form');
    
    for (const form of explicitForms) {
      const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
      const selects = form.querySelectorAll('select');
      const textareas = form.querySelectorAll('textarea');
      
      if (inputs.length + selects.length + textareas.length >= this.config.MIN_FORM_INPUTS) {
        if (!this.isSearchForm(form) && !this.isNewsletterForm(form) && !this.isCommentForm(form)) {
          return true;
        }
      }
    }
    
    // Check for password fields (login forms)
    const passwordFields = document.querySelectorAll('input[type="password"]');
    if (passwordFields.length > 0) {
      return true;
    }
    
    // Quick check for standalone input clusters
    const standaloneForms = this.detectImplicitForms();
    if (standaloneForms.length > 0) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Clears the analyzer cache, forcing re-analysis
   */
  clearCache() {
    this.cachedPageType = null;
    this.cachedAnalysis = null;
  }
}

// Export as a global object and as a module
window.PageAnalyzer = PageAnalyzer;
window.PageTypes = PageTypes;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PageAnalyzer, PageTypes };
}