// Integrate the enhanced password field handling into the extension

/**
 * Update the content script with a script tag to load the enhanced password field analyzer
 */
(function() {
  // Check if we've already injected the password analyzer
  if (window.passwordAnalyzerInjected) return;
  
  // Mark as injected
  window.passwordAnalyzerInjected = true;
  
  // Import the enhanced-password-field-analyzer.js
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('enhanced-password-field-analyzer.js');
  script.onload = function() {
    // Once loaded, initialize any required listeners
    console.log('Enhanced password field analyzer loaded');
    
    // Dispatch an event to notify content script
    document.dispatchEvent(new CustomEvent('passwordAnalyzerReady'));
  };
  
  // Add to document
  (document.head || document.documentElement).appendChild(script);
  
  // Initialize event listener to integrate with field extraction
  document.addEventListener('passwordAnalyzerReady', function() {
    console.log('Password analyzer integration ready');
    
    // Patch the extractFieldContext function to use the enhanced analyzer
    const originalExtractFieldContext = window.extractFieldContext;
    if (originalExtractFieldContext) {
      window.extractFieldContext = function(input) {
        // Get the basic field context
        const fieldContext = originalExtractFieldContext(input);
        
        // If it's a password field, enhance it with context awareness
        if (fieldContext && (fieldContext.type === 'password' || 
            (fieldContext.name && fieldContext.name.toLowerCase().includes('password')))) {
          
          // Get all fields in the form for context
          let allFields = [];
          let formElement = null;
          
          if (input.form) {
            formElement = input.form;
            const inputs = formElement.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
              const context = originalExtractFieldContext(input);
              if (context) allFields.push(context);
            });
          }
          
          // Get form context from detectFormContext function if available
          let formContext = null;
          if (window.detectFormContext) {
            formContext = window.detectFormContext(formElement, allFields);
          }
          
          // Enhance the password field context
          return window.passwordAnalyzer.enhancePasswordFieldContext(
            fieldContext, allFields, formElement, formContext
          );
        }
        
        return fieldContext;
      };
    }
  });
})();

/**
 * Get a context-aware response for a password field
 * @param {Object} field - The password field object
 * @param {string} question - The user's question
 * @param {Object} formContext - The detected form context
 * @returns {string} The response text
 */
 
// Make function available in the global scope
window.getPasswordFieldResponse = getPasswordFieldResponse;
function getPasswordFieldResponse(field, question, formContext) {
  if (window.passwordAnalyzer) {
    return window.passwordAnalyzer.getPasswordFieldResponse(field, question, formContext);
  }
  
  // Fallback if analyzer isn't available
  const questionLower = question.toLowerCase();
  const fieldName = field.label || field.name || 'password field';
  
  if (questionLower.includes('required')) {
    return `Yes, the ${fieldName} is required for security purposes.`;
  }
  
  if (questionLower.includes('what') || questionLower.includes('why') || 
      questionLower.includes('purpose')) {
    return `This field is for your password, which secures your account from unauthorized access.`;
  }
  
  return `The ${fieldName} helps secure your account. It should be at least 8 characters with a mix of letters, numbers, and symbols.`;
}