/**
 * Enhanced Password Field Analyzer
 * Provides better detection and context-aware response for password fields
 */

class PasswordFieldAnalyzer {
  constructor() {
    // Registration form indicators
    this.registrationIndicators = {
      urls: ['register', 'signup', 'join', 'create-account', 'new-user', 'create'],
      titles: ['register', 'sign up', 'create account', 'join', 'new user', 'create a profile'],
      fieldNames: ['new-password', 'newpassword', 'create-password', 'signup-password'],
      buttonText: ['register', 'sign up', 'create account', 'join now', 'get started', 'create']
    };

    // Login form indicators
    this.loginIndicators = {
      urls: ['login', 'signin', 'authenticate', 'log-in', 'sign-in'],
      titles: ['login', 'sign in', 'member login', 'log in', 'account login'],
      fieldNames: ['current-password', 'login-password', 'signin-password'],
      buttonText: ['login', 'sign in', 'log in', 'access', 'authenticate']
    };
  }

  /**
   * Determine if a password field is in a registration or login context
   * @param {Object} field - The password field object
   * @param {Array} allFields - All fields in the form
   * @param {Object} formElement - The form DOM element
   * @param {Object} formContext - The detected form context
   * @returns {Object} Enhanced field context
   */
  enhancePasswordFieldContext(field, allFields, formElement, formContext) {
    // Start with the current field data
    const enhancedField = { ...field };
    
    // Always make password fields required by default unless explicitly marked optional
    enhancedField.required = field.required !== false; 
    
    // Check if we're in a registration form
    let formType = this.determineFormType(allFields, formElement, formContext);
    enhancedField.formType = formType;
    
    // Enhance purpose description based on context
    if (formType === 'registration') {
      enhancedField.purpose = 'This field is for creating a secure password that will protect your new account.';
      enhancedField.contextSpecificInfo = {
        purpose: 'Creating a strong password for your new account',
        requirements: 'Usually requires 8+ characters with a mix of letters, numbers, and symbols',
        strength: 'Use a unique password that you don\'t use on other sites for better security',
        formContext: 'This is part of the account creation process'
      };
    } else if (formType === 'login') {
      enhancedField.purpose = 'This field is for entering your existing password to access your account.';
      enhancedField.contextSpecificInfo = {
        purpose: 'Authenticating your identity to access your existing account',
        requirements: 'Must match the password you created when registering',
        formContext: 'This is part of the login process'
      };
    } else {
      // Generic password context
      enhancedField.purpose = 'This field is for your password, which secures your account from unauthorized access.';
      enhancedField.contextSpecificInfo = {
        purpose: 'Protecting your account with a secure password',
        requirements: 'Usually requires 8+ characters with a mix of letters, numbers, and symbols'
      };
    }
    
    return enhancedField;
  }
  
  /**
   * Determine if we're in a registration or login context
   */
  determineFormType(allFields, formElement, formContext) {
    // 1. Check if form context already has a definitive type
    if (formContext && formContext.form_type) {
      if (formContext.form_type.includes('registration') || 
          formContext.form_type.includes('signup') || 
          formContext.form_type.includes('create account')) {
        return 'registration';
      } else if (formContext.form_type.includes('login') || 
                formContext.form_type.includes('sign in')) {
        return 'login';
      }
    }
    
    // 2. Check for confirm password field (strong registration indicator)
    const hasConfirmPassword = allFields.some(f => {
      const name = (f.name || '').toLowerCase();
      const label = (f.label || '').toLowerCase();
      return name.includes('confirm') && name.includes('password') || 
             label.includes('confirm') && label.includes('password') ||
             name.includes('verify') && name.includes('password') ||
             label.includes('verify') && label.includes('password') ||
             name.includes('retype') && name.includes('password') ||
             label.includes('retype') && label.includes('password');
    });
    
    if (hasConfirmPassword) {
      return 'registration';
    }
    
    // 3. Check for other registration fields
    const registrationFieldCount = allFields.filter(f => {
      const name = (f.name || '').toLowerCase();
      const label = (f.label || '').toLowerCase();
      return name.includes('first') || label.includes('first name') ||
             name.includes('last') || label.includes('last name') ||
             name.includes('full_name') || label.includes('full name') ||
             name.includes('birth') || label.includes('date of birth') ||
             name.includes('agree') || label.includes('terms') ||
             name.includes('newsletter') || label.includes('subscribe');
    }).length;
    
    const loginFieldCount = allFields.filter(f => {
      const name = (f.name || '').toLowerCase();
      const label = (f.label || '').toLowerCase();
      return name.includes('remember') || label.includes('remember me') ||
             name.includes('forgot') || label.includes('forgot password');
    }).length;
    
    // 4. Check form button text if available
    let buttonText = '';
    if (formElement) {
      const submitButton = formElement.querySelector('button[type="submit"], input[type="submit"]');
      if (submitButton) {
        buttonText = (submitButton.textContent || submitButton.value || '').toLowerCase();
      }
    }
    
    // Check button text against patterns
    let buttonIndicatesRegistration = false;
    let buttonIndicatesLogin = false;
    
    for (const text of this.registrationIndicators.buttonText) {
      if (buttonText.includes(text)) {
        buttonIndicatesRegistration = true;
        break;
      }
    }
    
    for (const text of this.loginIndicators.buttonText) {
      if (buttonText.includes(text)) {
        buttonIndicatesLogin = true;
        break;
      }
    }
    
    // 5. Check page URL and title
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    
    let urlIndicatesRegistration = false;
    let urlIndicatesLogin = false;
    let titleIndicatesRegistration = false;
    let titleIndicatesLogin = false;
    
    for (const pattern of this.registrationIndicators.urls) {
      if (url.includes(pattern)) {
        urlIndicatesRegistration = true;
        break;
      }
    }
    
    for (const pattern of this.loginIndicators.urls) {
      if (url.includes(pattern)) {
        urlIndicatesLogin = true;
        break;
      }
    }
    
    for (const pattern of this.registrationIndicators.titles) {
      if (title.includes(pattern)) {
        titleIndicatesRegistration = true;
        break;
      }
    }
    
    for (const pattern of this.loginIndicators.titles) {
      if (title.includes(pattern)) {
        titleIndicatesLogin = true;
        break;
      }
    }
    
    // 6. Make final determination based on all evidence
    let registrationScore = registrationFieldCount + 
                            (buttonIndicatesRegistration ? 2 : 0) + 
                            (urlIndicatesRegistration ? 2 : 0) + 
                            (titleIndicatesRegistration ? 1 : 0);
                            
    let loginScore = loginFieldCount + 
                     (buttonIndicatesLogin ? 2 : 0) + 
                     (urlIndicatesLogin ? 2 : 0) + 
                     (titleIndicatesLogin ? 1 : 0);
    
    // If email and password are the only visible fields, likely login
    if (allFields.length <= 3 && allFields.some(f => f.type === 'email' || (f.name || '').includes('email'))) {
      loginScore += 1;
    }
    
    // Make the determination
    if (registrationScore > loginScore) {
      return 'registration';
    } else if (loginScore > registrationScore) {
      return 'login';
    } else {
      // Default to generic if we can't determine
      return 'generic';
    }
  }
  
  /**
   * Generate a response about a password field based on context and question
   */
  getPasswordFieldResponse(field, question, formContext) {
    const questionLower = question.toLowerCase();
    const fieldName = field.label || field.name || 'password field';
    
    // Enhance the field with context information if needed
    const enhancedField = field.formType ? field : 
                          this.enhancePasswordFieldContext(field, [], null, formContext);
    
    // Check for specific questions
    if (questionLower.includes('required') || questionLower.includes('need') || 
        questionLower.includes('must') || questionLower.includes('optional')) {
      return `Yes, the ${fieldName} is required for security purposes. All password fields must be completed to protect your account.`;
    }
    
    if (questionLower.includes('what') || questionLower.includes('why') || 
        questionLower.includes('purpose') || questionLower.includes('used for')) {
      return enhancedField.purpose;
    }
    
    if (questionLower.includes('how') || questionLower.includes('format') || 
        questionLower.includes('many') || questionLower.includes('characters')) {
      if (enhancedField.formType === 'registration') {
        return `Create a strong password with at least 8 characters, including uppercase and lowercase letters, numbers, and special characters. This will help protect your new account.`;
      } else {
        return `Enter your existing password. For security, it should be at least 8 characters with a mix of letters, numbers, and symbols.`;
      }
    }
    
    if (questionLower.includes('secure') || questionLower.includes('safe') || 
        questionLower.includes('strong')) {
      return `A secure password should be at least 8 characters long with a mix of uppercase letters, lowercase letters, numbers, and special characters. Avoid using personal information or common words. Consider using a password manager to generate and store strong, unique passwords.`;
    }
    
    // Default response based on context
    if (enhancedField.formType === 'registration') {
      return `This is where you create a password for your new account. Use a strong, unique password that's at least 8 characters long with a mix of letters, numbers, and symbols.`;
    } else if (enhancedField.formType === 'login') {
      return `This is where you enter your existing password to access your account. If you've forgotten your password, look for a "Forgot Password" link near the login form.`;
    } else {
      return `This is a password field that helps secure your account. Always use strong, unique passwords and never share them with anyone.`;
    }
  }
}

// Make the analyzer available globally
window.passwordAnalyzer = new PasswordFieldAnalyzer();