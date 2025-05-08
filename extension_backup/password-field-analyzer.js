/**
 * PasswordFieldAnalyzer - Enhances password field analysis
 * 
 * This class adds context-aware password field analysis to detect password scenarios and provide helpful guidance.
 */
class PasswordFieldAnalyzer {
    constructor() {
        this.passwordContexts = {
            'login': {
                name: 'Login',
                description: 'Login to an existing account',
                securityTips: 'Use a strong, unique password for each account and consider using a password manager.'
            },
            'registration': {
                name: 'Registration',
                description: 'Create a new account',
                securityTips: 'Create a strong password with at least 12 characters, including a mix of uppercase and lowercase letters, numbers, and special characters.'
            },
            'change_password': {
                name: 'Change Password',
                description: 'Update your existing password',
                securityTips: 'Choose a strong password different from your previous passwords. Don\'t reuse passwords across sites.'
            },
            'reset_password': {
                name: 'Reset Password',
                description: 'Reset your forgotten password',
                securityTips: 'After resetting, consider updating passwords on other sites where you used the same password.'
            },
            'unknown': {
                name: 'Password Field',
                description: 'Enter a password',
                securityTips: 'Always use strong, unique passwords with a mix of character types.'
            }
        };
        
        console.log('PasswordFieldAnalyzer initialized');
    }

    /**
     * Enhances a password field with additional context
     * @param {Object} fieldContext The basic field context object
     * @param {Array} otherFields Array of other fields in the form
     * @param {HTMLElement} formElement The form element if available
     * @param {Object} formContext Optional form context already detected
     * @returns {Object} Enhanced field context
     */
    enhancePasswordFieldContext(fieldContext, otherFields = [], formElement = null, formContext = null) {
        if (!fieldContext) return null;
        
        // Make a copy to avoid modifying the original
        const enhancedContext = {...fieldContext};
        
        // Detect password context type
        const contextType = this.detectPasswordContextType(fieldContext, otherFields, formContext);
        
        // Add password-specific attributes
        enhancedContext.passwordContext = {
            type: contextType,
            ...this.passwordContexts[contextType]
        };
        
        // Add requirement tips based on context
        enhancedContext.requirementTips = this.getRequirementTips(contextType);
        
        // Add enhanced security guidance
        enhancedContext.securityGuidance = this.passwordContexts[contextType].securityTips;
        
        // Mark as enhanced by this component
        enhancedContext._enhancedBy = 'PasswordFieldAnalyzer';
        
        return enhancedContext;
    }

    /**
     * Detect the type of password context based on field and form analysis
     * @param {Object} passwordField The password field context
     * @param {Array} otherFields Other fields in the form
     * @param {Object} formContext The form context if available
     * @returns {string} The context type ID
     */
    detectPasswordContextType(passwordField, otherFields = [], formContext = null) {
        // Check if we already have form context that describes the form type
        if (formContext && formContext.form_type) {
            const formType = formContext.form_type.toLowerCase();
            
            if (formType.includes('login') || formType.includes('sign in')) {
                return 'login';
            } else if (formType.includes('register') || formType.includes('sign up') || formType.includes('create account')) {
                return 'registration';
            } else if (formType.includes('change password') || formType.includes('update password')) {
                return 'change_password';
            } else if (formType.includes('reset password') || formType.includes('forgot password')) {
                return 'reset_password';
            }
        }
        
        // Look at field name and attributes
        const fieldName = (passwordField.name || '').toLowerCase();
        const fieldId = (passwordField.id || '').toLowerCase();
        const label = (passwordField.label || '').toLowerCase();
        
        if (fieldName.includes('new') || fieldId.includes('new') || label.includes('new')) {
            return 'change_password';
        }
        
        if (fieldName.includes('confirm') || fieldId.includes('confirm') || label.includes('confirm') ||
            fieldName.includes('verify') || fieldId.includes('verify') || label.includes('verify')) {
            return 'registration';
        }
        
        // Look at surrounding fields
        const hasEmailField = otherFields.some(field => 
            (field.type === 'email') || 
            ((field.name || '').toLowerCase().includes('email')) || 
            ((field.label || '').toLowerCase().includes('email'))
        );
        
        const hasUsernameField = otherFields.some(field => 
            ((field.name || '').toLowerCase().includes('username')) || 
            ((field.id || '').toLowerCase().includes('username')) || 
            ((field.label || '').toLowerCase().includes('username'))
        );
        
        const hasNameFields = otherFields.some(field => 
            ((field.name || '').toLowerCase().includes('first_name') || 
             (field.name || '').toLowerCase().includes('firstname') ||
             (field.name || '').toLowerCase().includes('last_name') ||
             (field.name || '').toLowerCase().includes('lastname'))
        );
        
        const hasMultiplePasswordFields = otherFields.some(field => 
            (field !== passwordField) && 
            ((field.type === 'password') || 
             (field.name || '').toLowerCase().includes('password'))
        );
        
        // Registration form usually has name fields or multiple password fields
        if (hasNameFields || hasMultiplePasswordFields) {
            return 'registration';
        }
        
        // Login form usually has just one password field with username or email
        if ((hasEmailField || hasUsernameField) && !hasMultiplePasswordFields) {
            return 'login';
        }
        
        // Default to unknown if we can't determine the context
        return 'unknown';
    }

    /**
     * Get specific requirement tips based on password context
     * @param {string} contextType The password context type
     * @returns {Array} Array of requirement tip strings
     */
    getRequirementTips(contextType) {
        const commonTips = [
            "At least 8 characters long",
            "Include uppercase and lowercase letters",
            "Include at least one number",
            "Include at least one special character"
        ];
        
        switch (contextType) {
            case 'registration':
                return [
                    ...commonTips,
                    "Avoid using personal information",
                    "Don't reuse passwords from other sites"
                ];
            case 'change_password':
                return [
                    ...commonTips,
                    "Choose a password different from your previous ones",
                    "Don't reuse passwords from other sites"
                ];
            case 'reset_password':
                return [
                    ...commonTips,
                    "Create a completely new password",
                    "Consider updating passwords on other sites"
                ];
            case 'login':
                return [];  // No tips for login, just enter existing password
            default:
                return commonTips;
        }
    }
}

// Create global instance
window.passwordAnalyzer = new PasswordFieldAnalyzer();