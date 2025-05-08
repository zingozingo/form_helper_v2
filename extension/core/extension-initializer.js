/**
 * Extension Initializer
 * 
 * Controls the activation of the Form Helper extension based on page content.
 * Runs a lightweight pre-scan before activating the full extension.
 */

// Extension activation states
const ActivationState = {
  INACTIVE: 'inactive',           // Extension should not be active on this page
  MINIMAL: 'minimal',             // Show only minimal icon indicator
  ACTIVE: 'active',               // Fully activate extension
  DEVELOPER: 'developer'          // Developer mode (debug tools enabled)
};

/**
 * ExtensionInitializer class - Controls when and how the extension activates
 */
class ExtensionInitializer {
  constructor() {
    this.pageAnalyzer = new window.PageAnalyzer();
    this.currentState = ActivationState.INACTIVE;
    this.developerMode = false;
    this.initialized = false;
    
    // Listen for messages from background script
    this.setupMessageListeners();
  }
  
  /**
   * Setup message listeners for communication with background script
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleDeveloperMode') {
        this.developerMode = request.enabled;
        this.updateActivationState();
        sendResponse({success: true, developerMode: this.developerMode});
        return true;
      }
      
      if (request.action === 'getPageType') {
        const pageType = this.pageAnalyzer.determinePageType();
        sendResponse({pageType: pageType});
        return true;
      }
      
      if (request.action === 'forceActivate') {
        this.forceActivation();
        sendResponse({success: true, state: this.currentState});
        return true;
      }
      
      return false;
    });
  }
  
  /**
   * Run initial lightweight check to see if this page is worth analyzing
   * @returns {boolean} True if the page should be analyzed further
   */
  quickPreScan() {
    console.log('🚀 ExtensionInitializer: Running quick pre-scan');
    
    // Get current URL
    const currentUrl = window.location.href.toLowerCase();
    
    // Skip if URL contains typical excluded paths
    const excludedTerms = ['login', 'signup', 'register', 'account', 'profile', 'checkout', 'contact'];
    const isLikelyFormPath = excludedTerms.some(term => currentUrl.includes(term));
    
    if (isLikelyFormPath) {
      console.log('🚀 ExtensionInitializer: URL suggests form page', { url: currentUrl });
      return true;
    }
    
    // Check for quick form indicators
    return this.pageAnalyzer.quickFormCheck();
  }
  
  /**
   * Determines the appropriate activation state
   * @returns {string} The activation state
   */
  determineActivationState() {
    // Always activate in developer mode
    if (this.developerMode) {
      return ActivationState.DEVELOPER;
    }
    
    // Otherwise analyze page content
    const pageType = this.pageAnalyzer.determinePageType();
    console.log('🚀 ExtensionInitializer: Page type determined', { pageType });
    
    switch (pageType) {
      case window.PageTypes.PRIMARY_FORM:
        return ActivationState.ACTIVE;
      case window.PageTypes.HAS_FORMS:
        return ActivationState.MINIMAL;
      case window.PageTypes.NO_FORMS:
      case window.PageTypes.EXCLUDED:
      default:
        return ActivationState.INACTIVE;
    }
  }
  
  /**
   * Updates the extension's activation state based on page content
   */
  updateActivationState() {
    // Determine the appropriate state
    const newState = this.determineActivationState();
    
    // If state hasn't changed, do nothing
    if (this.currentState === newState && this.initialized) {
      return;
    }
    
    console.log('🚀 ExtensionInitializer: Updating activation state', {
      previousState: this.currentState,
      newState: newState
    });
    
    // Update current state
    this.currentState = newState;
    this.initialized = true;
    
    // Notify background script of state change
    chrome.runtime.sendMessage({
      action: 'activationStateChanged',
      state: this.currentState
    });
    
    // Apply activation based on state
    this.applyActivationState();
  }
  
  /**
   * Applies the current activation state
   */
  applyActivationState() {
    // Remove any existing UI elements
    this.removeUIElements();
    
    // Apply based on state
    switch (this.currentState) {
      case ActivationState.ACTIVE:
        this.activateFullExtension();
        break;
      case ActivationState.MINIMAL:
        this.activateMinimalMode();
        break;
      case ActivationState.DEVELOPER:
        this.activateDeveloperMode();
        break;
      case ActivationState.INACTIVE:
      default:
        // Do nothing - extension remains inactive
        console.log('🚀 ExtensionInitializer: Extension inactive on this page');
        break;
    }
  }
  
  /**
   * Removes any UI elements the extension may have added
   */
  removeUIElements() {
    // Remove debug indicator
    const debugIndicator = document.querySelector('.ai-form-helper-debug-indicator');
    if (debugIndicator) {
      debugIndicator.remove();
    }
    
    // Remove minimal indicator
    const minimalIndicator = document.querySelector('.form-helper-minimal-indicator');
    if (minimalIndicator) {
      minimalIndicator.remove();
    }
    
    // Remove any form buttons
    const helperButtons = document.querySelectorAll('.ai-form-helper-button-container');
    helperButtons.forEach(button => button.remove());
  }
  
  /**
   * Activates the full extension
   */
  activateFullExtension() {
    console.log('🚀 ExtensionInitializer: Activating full extension');
    
    // Notify content script to activate
    window.dispatchEvent(new CustomEvent('formHelperActivate', { 
      detail: { mode: 'full' } 
    }));
    
    // Run the main form detection
    if (typeof detectForms === 'function') {
      detectForms(true);
    }
  }
  
  /**
   * Activates minimal mode with just an indicator icon
   */
  activateMinimalMode() {
    console.log('🚀 ExtensionInitializer: Activating minimal mode');
    
    // Create minimal indicator
    const indicator = document.createElement('div');
    indicator.className = 'form-helper-minimal-indicator';
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: rgba(66, 133, 244, 0.9);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 999999;
      font-family: Arial, sans-serif;
      font-weight: bold;
      font-size: 18px;
      transition: all 0.3s ease;
    `;
    indicator.innerHTML = 'AI';
    indicator.title = 'AI Form Helper Available - Click to activate';
    
    // Add hover effect
    indicator.onmouseover = () => {
      indicator.style.transform = 'scale(1.1)';
      indicator.style.backgroundColor = 'rgba(66, 133, 244, 1)';
    };
    indicator.onmouseout = () => {
      indicator.style.transform = 'scale(1)';
      indicator.style.backgroundColor = 'rgba(66, 133, 244, 0.9)';
    };
    
    // Add click handler to activate full extension
    indicator.addEventListener('click', () => {
      this.forceActivation();
    });
    
    // Add to the page
    document.body.appendChild(indicator);
    
    // Notify content script
    window.dispatchEvent(new CustomEvent('formHelperActivate', { 
      detail: { mode: 'minimal' } 
    }));
  }
  
  /**
   * Activates developer mode with debugging tools
   */
  activateDeveloperMode() {
    console.log('🚀 ExtensionInitializer: Activating developer mode');
    
    // Create debug indicator
    const indicator = document.createElement('div');
    indicator.className = 'ai-form-helper-debug-indicator';
    indicator.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      background-color: rgba(255, 0, 0, 0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      cursor: pointer;
    `;
    indicator.textContent = 'AI Form Helper: Debug Mode';
    
    // Add click handler to show debug info
    indicator.addEventListener('click', () => {
      const pageInfo = {
        url: window.location.href,
        title: document.title,
        pageType: this.pageAnalyzer.determinePageType(),
        analysis: this.pageAnalyzer.analyzePageFormContent(),
        timestamp: new Date().toISOString()
      };
      
      alert('AI Form Helper Debug Info:\n' + JSON.stringify(pageInfo, null, 2));
    });
    
    // Add to the page
    document.body.appendChild(indicator);
    
    // Activate full extension
    this.activateFullExtension();
    
    // Notify debug mode is active
    window.dispatchEvent(new CustomEvent('formHelperActivate', { 
      detail: { mode: 'developer' } 
    }));
  }
  
  /**
   * Forces activation of the full extension
   */
  forceActivation() {
    console.log('🚀 ExtensionInitializer: Forcing full activation');
    this.currentState = ActivationState.ACTIVE;
    this.applyActivationState();
    
    // Notify background script
    chrome.runtime.sendMessage({
      action: 'activationStateChanged',
      state: this.currentState,
      forced: true
    });
  }
  
  /**
   * Initializes the extension initializer
   */
  initialize() {
    console.log('🚀 ExtensionInitializer: Initializing');
    
    // First check if the extension is in developer mode
    chrome.runtime.sendMessage({ action: 'getDeveloperMode' }, (response) => {
      if (response && response.developerMode) {
        this.developerMode = true;
        this.updateActivationState();
        return;
      }
      
      // Otherwise, run the pre-scan
      const shouldActivate = this.quickPreScan();
      
      if (shouldActivate) {
        // If pre-scan suggests this page has forms, update activation state
        this.updateActivationState();
      } else {
        // Otherwise, stay inactive
        this.currentState = ActivationState.INACTIVE;
        this.initialized = true;
        
        // Notify background script
        chrome.runtime.sendMessage({
          action: 'activationStateChanged',
          state: this.currentState
        });
      }
    });
    
    // Listen for DOM changes to update state if needed
    this.observeDOMChanges();
  }
  
  /**
   * Observe DOM changes to update activation state if forms appear later
   */
  observeDOMChanges() {
    // Only observe if extension is not active
    if (this.currentState !== ActivationState.INACTIVE) {
      return;
    }
    
    // Create a MutationObserver instance
    const observer = new MutationObserver((mutations) => {
      // Only check if we see significant DOM changes
      let formElementsAdded = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any form elements were added
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if node is a form or contains form elements
              if (node.tagName === 'FORM' || 
                  node.querySelector('form, input, select, textarea')) {
                formElementsAdded = true;
                break;
              }
            }
          }
        }
        
        if (formElementsAdded) break;
      }
      
      // If we detected form elements, clear cache and re-evaluate
      if (formElementsAdded && this.currentState === ActivationState.INACTIVE) {
        console.log('🚀 ExtensionInitializer: DOM changes detected, re-evaluating');
        this.pageAnalyzer.clearCache();
        this.updateActivationState();
      }
    });
    
    // Start observing the document
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: false,
      characterData: false
    });
  }
}

// Create and export initializer
window.ExtensionInitializer = ExtensionInitializer;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExtensionInitializer, ActivationState };
}