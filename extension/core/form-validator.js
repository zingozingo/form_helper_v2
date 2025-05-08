/**
 * Form Validator - Implements strict validation for form quality
 * 
 * This module applies rigorous standards to ensure forms are legitimate
 * before allowing the Form Helper extension to activate.
 */

/**
 * Form validation configuration with strict defaults
 */
const FormValidatorConfig = {
  // Minimum required visible input elements in a form
  MIN_INPUT_FIELDS: 3,
  
  // Minimum ratio of form elements to total page elements (0-1)
  MIN_FORM_ELEMENT_RATIO: 0.05,
  
  // Maximum ratio to prevent full-page "forms" that are actually content (0-1)
  MAX_FORM_ELEMENT_RATIO: 0.8,
  
  // Types of inputs to count as significant
  SIGNIFICANT_INPUT_TYPES: ['text', 'email', 'password', 'tel', 'number', 'date', 'url', 'search'],
  
  // Types of inputs to NOT count as significant
  EXCLUDED_INPUT_TYPES: ['hidden', 'submit', 'button', 'reset', 'file', 'image', 'range', 'color'],
  
  // Minimum number of non-hidden fields needed to consider a form legitimate
  MIN_VISIBLE_FIELDS: 2,
  
  // Minimum ratio of labeled to unlabeled fields (0-1)
  MIN_LABELED_FIELDS_RATIO: 0.5,
  
  // Minimum score for a form to be considered legitimate (0-100)
  MIN_FORM_QUALITY_SCORE: 60,
  
  // Types of forms to always exclude regardless of other metrics
  EXCLUDED_FORM_TYPES: ['search', 'newsletter', 'comment', 'chat'],
  
  // Score weights for different form quality aspects
  QUALITY_WEIGHTS: {
    HAS_SUBMIT_MECHANISM: 15,    // Has submit button or enter handler
    HAS_LABELED_FIELDS: 15,      // Most fields have associated labels
    HAS_PROPER_STRUCTURE: 20,    // Form is in a proper form element
    HAS_MULTIPLE_FIELDS: 20,     // Has multiple distinct input fields
    HAS_EXPLICIT_SUBMIT: 10,     // Has an explicit submit button (not just handlers)
    HAS_FIELD_VALIDATION: 10,    // Has some form of field validation
    HAS_STRUCTURED_LAYOUT: 10    // Fields are arranged in a structured way
  }
};

/**
 * FormValidator class - Performs strict validation of forms
 */
class FormValidator {
  constructor(config = FormValidatorConfig) {
    this.config = config;
    this.validationResults = new Map();
  }
  
  /**
   * Reset the validation results cache
   */
  clearCache() {
    this.validationResults = new Map();
  }
  
  /**
   * Check if the page has at least one legitimate form
   * @returns {boolean} True if page has a legitimate form
   */
  pageHasLegitimateForms() {
    // Get all forms on the page
    const forms = document.querySelectorAll('form');
    
    // No forms at all - can exit early
    if (forms.length === 0) {
      console.log('📋 FormValidator: No form elements found on page');
      return this.implicitFormsExist();
    }
    
    // Check if any form passes validation
    for (const form of forms) {
      if (this.isFormLegitimate(form)) {
        return true;
      }
    }
    
    // If no explicit forms are legitimate, check for implicit forms
    return this.implicitFormsExist();
  }
  
  /**
   * Check if a specific form passes strict quality validation
   * @param {Element} formElement - The form element to validate
   * @returns {boolean} True if form passes validation
   */
  isFormLegitimate(formElement) {
    // Use cached result if available
    if (this.validationResults.has(formElement)) {
      return this.validationResults.get(formElement).isLegitimate;
    }
    
    // Generate report with detailed validation checks
    const report = this.validateFormWithReport(formElement);
    this.validationResults.set(formElement, report);
    
    return report.isLegitimate;
  }
  
  /**
   * Checks if form is a search form
   * @param {Element} formElement - The form element to check
   * @returns {boolean} True if form is a search form
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
      const name = (input.name || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      
      if (name.includes('search') || name.includes('query') || 
          placeholder.includes('search') || placeholder.includes('find')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if a form is likely a newsletter/subscription form
   * @param {Element} formElement - The form element to check
   * @returns {boolean} True if form appears to be a newsletter form
   */
  isNewsletterForm(formElement) {
    // Check for newsletter keywords in form attributes
    const formId = (formElement.id || '').toLowerCase();
    const formClass = (formElement.className || '').toLowerCase();
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
      if (input.type === 'email' || 
          (input.name && input.name.toLowerCase().includes('email')) || 
          (input.placeholder && input.placeholder.toLowerCase().includes('email'))) {
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
   * Check if a form is likely a comment form
   * @param {Element} formElement - The form element to check
   * @returns {boolean} True if form appears to be a comment form
   */
  isCommentForm(formElement) {
    // Check for comment keywords in form attributes
    const formId = (formElement.id || '').toLowerCase();
    const formClass = (formElement.className || '').toLowerCase();
    
    if (formId.includes('comment') || formClass.includes('comment')) {
      return true;
    }
    
    // Check for textarea + submit button pattern
    const textareas = formElement.querySelectorAll('textarea');
    const inputs = formElement.querySelectorAll('input:not([type="hidden"]):not([type="submit"])');
    
    if (textareas.length === 1 && inputs.length <= 1) {
      // Check for comment in textarea attributes
      const textarea = textareas[0];
      const name = (textarea.name || '').toLowerCase();
      const placeholder = (textarea.placeholder || '').toLowerCase();
      const id = (textarea.id || '').toLowerCase();
      
      if (name.includes('comment') || id.includes('comment') || 
          placeholder.includes('comment') || placeholder.includes('reply')) {
        return true;
      }
    }
    
    // Check page url for comment patterns
    const pageUrl = window.location.href.toLowerCase();
    if (pageUrl.includes('/comments') || pageUrl.includes('/comment/') || 
        pageUrl.includes('comment.php') || pageUrl.includes('reply')) {
      if (textareas.length >= 1) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if a form is likely a chat interface
   * @param {Element} formElement - The form element to check
   * @returns {boolean} True if form appears to be a chat interface
   */
  isChatForm(formElement) {
    // Check form attributes for chat related keywords
    const formId = (formElement.id || '').toLowerCase();
    const formClass = (formElement.className || '').toLowerCase();
    
    if (formId.includes('chat') || formClass.includes('chat') || 
        formId.includes('message') || formClass.includes('message')) {
      return true;
    }
    
    // Check for send/chat buttons
    const buttons = formElement.querySelectorAll('button, input[type="submit"]');
    for (const button of buttons) {
      const buttonText = button.textContent.toLowerCase();
      const buttonValue = (button.value || '').toLowerCase();
      
      if (buttonText.includes('send') || buttonText.includes('chat') || 
          buttonValue.includes('send') || buttonValue.includes('chat')) {
        // Also check if there's only a single text input or textarea
        const inputs = formElement.querySelectorAll('input[type="text"], textarea');
        if (inputs.length === 1) {
          return true;
        }
      }
    }
    
    // Check for chat interface patterns
    const messageContainers = document.querySelectorAll('.messages, .chat, .conversation, .message-list');
    if (messageContainers.length > 0) {
      // If there's a message container and a small form with text input
      const inputs = formElement.querySelectorAll('input:not([type="hidden"]):not([type="submit"])');
      if (inputs.length <= 2) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if the document contains implicit forms (input groups not inside <form> tags)
   * @returns {boolean} True if implicit forms exist
   */
  implicitFormsExist() {
    // Get all potential implicit form containers
    const containers = this.detectImplicitFormContainers();
    
    // Check if any container passes validation
    for (const container of containers) {
      if (this.isImplicitFormLegitimate(container)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Detect potential implicit form containers
   * @returns {Element[]} Array of potential form containers
   */
  detectImplicitFormContainers() {
    // Find input elements not inside form tags
    const standaloneInputs = Array.from(document.querySelectorAll('input, select, textarea')).filter(input => {
      return !input.closest('form');
    });
    
    // Group by common parent
    const containerMap = new Map();
    standaloneInputs.forEach(input => {
      // Skip hidden and button-like inputs
      if (this.config.EXCLUDED_INPUT_TYPES.includes(input.type)) {
        return;
      }
      
      // Find closest potential container
      const container = input.closest('div, section, article, main, aside, fieldset');
      if (!container) return;
      
      // Store input with its container
      if (!containerMap.has(container)) {
        containerMap.set(container, []);
      }
      containerMap.get(container).push(input);
    });
    
    // Filter containers with enough inputs
    const potentialContainers = [];
    containerMap.forEach((inputs, container) => {
      if (inputs.length >= this.config.MIN_VISIBLE_FIELDS) {
        potentialContainers.push({
          container,
          inputs
        });
      }
    });
    
    return potentialContainers;
  }
  
  /**
   * Validate an implicit form container
   * @param {Object} containerObj - Container object with container and inputs properties
   * @returns {boolean} True if implicit form is legitimate
   */
  isImplicitFormLegitimate(containerObj) {
    const { container, inputs } = containerObj;
    
    // Check for minimum inputs
    if (inputs.length < this.config.MIN_VISIBLE_FIELDS) {
      return false;
    }
    
    // Check for form-like properties
    const hasSubmitButton = !!container.querySelector('button, input[type="submit"], input[type="button"], [role="button"]');
    const hasSignificantInputs = inputs.some(input => this.config.SIGNIFICANT_INPUT_TYPES.includes(input.type));
    
    // Check label ratio
    let labeledCount = 0;
    inputs.forEach(input => {
      if (this.inputHasLabel(input)) {
        labeledCount++;
      }
    });
    const labelRatio = labeledCount / inputs.length;
    
    // Check if container appears to be a form-like structure
    return (
      hasSubmitButton && 
      hasSignificantInputs && 
      labelRatio >= this.config.MIN_LABELED_FIELDS_RATIO &&
      inputs.length >= this.config.MIN_INPUT_FIELDS
    );
  }
  
  /**
   * Check if an input element has an associated label
   * @param {Element} input - The input element to check
   * @returns {boolean} True if input has a label
   */
  inputHasLabel(input) {
    // Check for explicit label with for attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) {
        return true;
      }
    }
    
    // Check for parent label
    if (input.parentElement && input.parentElement.tagName === 'LABEL') {
      return true;
    }
    
    // Check for aria-label
    if (input.getAttribute('aria-label')) {
      return true;
    }
    
    // Check for aria-labelledby
    if (input.getAttribute('aria-labelledby')) {
      const labelId = input.getAttribute('aria-labelledby');
      if (document.getElementById(labelId)) {
        return true;
      }
    }
    
    // Check for placeholder as pseudo-label
    if (input.placeholder) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Calculate a quality score for a form
   * @param {Element} formElement - The form element to score
   * @returns {number} Quality score from 0-100
   */
  calculateFormQualityScore(formElement) {
    let score = 0;
    const weights = this.config.QUALITY_WEIGHTS;
    
    // Check for submit mechanism
    if (formElement.querySelector('button, input[type="submit"]')) {
      score += weights.HAS_SUBMIT_MECHANISM;
    }
    
    // Check for labeled fields
    const inputs = formElement.querySelectorAll('input:not([type="hidden"]), select, textarea');
    let labeledCount = 0;
    
    inputs.forEach(input => {
      if (this.inputHasLabel(input)) {
        labeledCount++;
      }
    });
    
    if (inputs.length > 0 && (labeledCount / inputs.length) >= this.config.MIN_LABELED_FIELDS_RATIO) {
      score += weights.HAS_LABELED_FIELDS;
    }
    
    // Check for explicit submit button
    if (formElement.querySelector('button[type="submit"], input[type="submit"]')) {
      score += weights.HAS_EXPLICIT_SUBMIT;
    }
    
    // Check for field validation
    const hasValidation = Array.from(inputs).some(input => {
      return input.required || 
             input.pattern || 
             input.getAttribute('aria-required') === 'true' ||
             input.minLength || 
             input.maxLength;
    });
    
    if (hasValidation) {
      score += weights.HAS_FIELD_VALIDATION;
    }
    
    // Check for multiple fields
    if (inputs.length >= this.config.MIN_INPUT_FIELDS) {
      score += weights.HAS_MULTIPLE_FIELDS;
    }
    
    // Check for form element
    if (formElement.tagName === 'FORM') {
      score += weights.HAS_PROPER_STRUCTURE;
    }
    
    // Check for structured layout
    const hasStructuredLayout = !!formElement.querySelector('fieldset, .form-group, .field-group, .form-row');
    if (hasStructuredLayout) {
      score += weights.HAS_STRUCTURED_LAYOUT;
    }
    
    return score;
  }
  
  /**
   * Generate a detailed report about a form's legitimacy
   * @param {Element} formElement - The form to validate
   * @returns {Object} Detailed validation report
   */
  validateFormWithReport(formElement) {
    // Prepare report object
    const report = {
      isLegitimate: false,
      failReasons: [],
      warnings: [],
      formElement: formElement,
      elementCount: {
        total: 0,
        visible: 0,
        significant: 0,
        withLabels: 0
      },
      formTypeAnalysis: {
        isSearch: false,
        isNewsletter: false,
        isComment: false,
        isChat: false
      },
      qualityScore: 0,
      recommendations: []
    };
    
    // Track fail reasons
    const addFailReason = (reason) => {
      report.failReasons.push(reason);
      return false;
    };
    
    // Track warnings
    const addWarning = (warning) => {
      report.warnings.push(warning);
    };
    
    // Check for excluded form types
    report.formTypeAnalysis.isSearch = this.isSearchForm(formElement);
    report.formTypeAnalysis.isNewsletter = this.isNewsletterForm(formElement);
    report.formTypeAnalysis.isComment = this.isCommentForm(formElement);
    report.formTypeAnalysis.isChat = this.isChatForm(formElement);
    
    // Skip explicitly excluded form types
    if (report.formTypeAnalysis.isSearch && this.config.EXCLUDED_FORM_TYPES.includes('search')) {
      addFailReason('Form appears to be a search form (excluded by configuration)');
    }
    
    if (report.formTypeAnalysis.isNewsletter && this.config.EXCLUDED_FORM_TYPES.includes('newsletter')) {
      addFailReason('Form appears to be a newsletter subscription form (excluded by configuration)');
    }
    
    if (report.formTypeAnalysis.isComment && this.config.EXCLUDED_FORM_TYPES.includes('comment')) {
      addFailReason('Form appears to be a comment form (excluded by configuration)');
    }
    
    if (report.formTypeAnalysis.isChat && this.config.EXCLUDED_FORM_TYPES.includes('chat')) {
      addFailReason('Form appears to be a chat interface (excluded by configuration)');
    }
    
    // Count form elements
    const allInputs = formElement.querySelectorAll('input, select, textarea');
    report.elementCount.total = allInputs.length;
    
    // Count visible inputs (not hidden)
    const visibleInputs = formElement.querySelectorAll('input:not([type="hidden"]), select, textarea');
    report.elementCount.visible = visibleInputs.length;
    
    // Check for minimum visible fields
    if (report.elementCount.visible < this.config.MIN_VISIBLE_FIELDS) {
      addFailReason(`Form has only ${report.elementCount.visible} visible fields, minimum ${this.config.MIN_VISIBLE_FIELDS} required`);
    }
    
    // Count significant inputs (text, email, password, etc.)
    let significantCount = 0;
    visibleInputs.forEach(input => {
      if (this.config.SIGNIFICANT_INPUT_TYPES.includes(input.type)) {
        significantCount++;
      }
    });
    report.elementCount.significant = significantCount;
    
    // Check for minimum significant inputs
    if (significantCount < this.config.MIN_INPUT_FIELDS) {
      addFailReason(`Form has only ${significantCount} significant input fields, minimum ${this.config.MIN_INPUT_FIELDS} required`);
    }
    
    // Check label ratio
    let labeledCount = 0;
    visibleInputs.forEach(input => {
      if (this.inputHasLabel(input)) {
        labeledCount++;
      }
    });
    report.elementCount.withLabels = labeledCount;
    
    // Calculate label ratio
    const labelRatio = visibleInputs.length > 0 ? labeledCount / visibleInputs.length : 0;
    if (labelRatio < this.config.MIN_LABELED_FIELDS_RATIO) {
      addWarning(`Only ${Math.round(labelRatio * 100)}% of fields have labels, minimum ${this.config.MIN_LABELED_FIELDS_RATIO * 100}% recommended`);
    }
    
    // Check for submit mechanism
    const hasSubmitButton = !!formElement.querySelector('button, input[type="submit"]');
    if (!hasSubmitButton) {
      addWarning('Form lacks an explicit submit button');
    }
    
    // Calculate overall quality score
    report.qualityScore = this.calculateFormQualityScore(formElement);
    
    // Check minimum quality score
    if (report.qualityScore < this.config.MIN_FORM_QUALITY_SCORE) {
      addFailReason(`Form quality score ${report.qualityScore} is below minimum threshold ${this.config.MIN_FORM_QUALITY_SCORE}`);
    }
    
    // Generate recommendations
    if (report.elementCount.withLabels < report.elementCount.visible) {
      report.recommendations.push('Add explicit labels for all input fields');
    }
    
    if (!hasSubmitButton) {
      report.recommendations.push('Add an explicit submit button to the form');
    }
    
    // A form must have no fail reasons to be legitimate
    report.isLegitimate = report.failReasons.length === 0 && report.qualityScore >= this.config.MIN_FORM_QUALITY_SCORE;
    
    return report;
  }
  
  /**
   * Generate a detailed report about all forms on the page
   * @returns {Object} Comprehensive page form report
   */
  generatePageFormReport() {
    const forms = document.querySelectorAll('form');
    const implicitContainers = this.detectImplicitFormContainers();
    
    // Prepare page report
    const report = {
      url: window.location.href,
      hasLegitimateForms: false,
      formCount: {
        explicit: forms.length,
        implicit: implicitContainers.length,
        legitimateExplicit: 0,
        legitimateImplicit: 0
      },
      formReports: [],
      implicitFormReports: [],
      overallAssessment: '',
      recommendations: []
    };
    
    // Validate all explicit forms
    for (const form of forms) {
      const formReport = this.validateFormWithReport(form);
      report.formReports.push(formReport);
      
      if (formReport.isLegitimate) {
        report.formCount.legitimateExplicit++;
      }
    }
    
    // Validate implicit forms
    for (const container of implicitContainers) {
      const isLegitimate = this.isImplicitFormLegitimate(container);
      
      // Build simple report for implicit forms
      const implicitReport = {
        isLegitimate,
        container: container.container,
        inputCount: container.inputs.length
      };
      
      report.implicitFormReports.push(implicitReport);
      
      if (isLegitimate) {
        report.formCount.legitimateImplicit++;
      }
    }
    
    // Determine if page has any legitimate forms
    report.hasLegitimateForms = (
      report.formCount.legitimateExplicit > 0 || 
      report.formCount.legitimateImplicit > 0
    );
    
    // Generate overall assessment
    if (report.hasLegitimateForms) {
      report.overallAssessment = `Page contains ${report.formCount.legitimateExplicit + report.formCount.legitimateImplicit} legitimate form(s)`;
    } else if (forms.length > 0 || implicitContainers.length > 0) {
      report.overallAssessment = 'Page contains forms but none meet quality standards';
      
      // Suggestions for borderline cases
      if (forms.length > 0) {
        const borderlineForms = report.formReports.filter(r => r.qualityScore >= this.config.MIN_FORM_QUALITY_SCORE * 0.7);
        if (borderlineForms.length > 0) {
          report.recommendations.push('Some forms almost meet requirements and may be worth examining');
        }
      }
    } else {
      report.overallAssessment = 'Page does not contain any form-like structures';
    }
    
    return report;
  }
}

// Export as a global object
window.FormValidator = FormValidator;
window.FormValidatorConfig = FormValidatorConfig;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FormValidator, FormValidatorConfig };
}