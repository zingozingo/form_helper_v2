/**
 * Strict Initializer - Controls Form Helper extension activation
 * 
 * Implements multi-layered validation to ensure the extension
 * only activates on legitimate form pages and never on
 * restricted sites like Instagram.
 */

/**
 * Activation states
 */
const ActivationStates = {
  BLOCKED: 'blocked',          // Site explicitly blocked
  INACTIVE: 'inactive',        // Not activated due to no forms
  MINIMAL: 'minimal',          // Show minimal indicator
  ACTIVE: 'active',            // Fully activated
  DEVELOPER: 'developer'       // Developer mode override
};

/**
 * Result constants for verification
 */
const VerificationResult = {
  PASS: 'pass',                // Check passed
  FAIL_BLOCKLIST: 'fail_blocklist',  // Failed due to blocklist
  FAIL_NO_FORMS: 'fail_no_forms',    // Failed due to no legitimate forms
  FAIL_SETTINGS: 'fail_settings',    // Failed due to user settings
  OVERRIDE_DEVELOPER: 'override_developer',  // Passed due to developer override
  OVERRIDE_USER: 'override_user'     // Passed due to user override
};

/**
 * StrictInitializer class - Controls extension activation with strict validation
 */
class StrictInitializer {
  constructor() {
    // Initialize dependencies with error handling
    this.log = window.logger?.getLogger('StrictInitializer') || 
      {
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
      };
      
    this.initialized = false;
    this.verificationStack = [];
    this.activationState = ActivationStates.INACTIVE;
    this.analysisData = null;
    
    // Flag to avoid repeated analysis
    this.analyzed = false;
  }
  
  /**
   * Initialize the strict initializer
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    this.log.info("Initializing with strict activation controls");
    
    try {
      // Ensure user settings are loaded
      if (window.userSettings) {
        await window.userSettings.initialize();
      }
      
      // Perform strict verification
      await this.performVerification();
      
      this.initialized = true;
      
      // Register message listeners
      this.setupMessageListeners();
      
      // Apply activation state
      this.applyActivationState();
      
      // Report state to background script
      this.reportActivationState();
    } catch (error) {
      this.log.error("Failed to initialize", error);
      
      // Safety fallback - remain inactive
      this.activationState = ActivationStates.INACTIVE;
      this.initialized = true;
    }
  }
  
  /**
   * Set up message listeners for communication with background script
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // Handle requests for activation status
      if (request.action === 'getActivationState') {
        sendResponse({
          state: this.activationState,
          verificationStack: this.verificationStack,
          analysisData: this.analysisData
        });
        return true;
      }
      
      // Handle request to override activation
      if (request.action === 'forceActivate' || request.action === 'overrideActivation') {
        this.log.warn("Activation override requested", { 
          previousState: this.activationState,
          reason: request.reason || 'manual_override'
        });
        
        this.activationState = request.state || ActivationStates.ACTIVE;
        this.verificationStack.push({
          checkpoint: 'manual_override',
          result: VerificationResult.OVERRIDE_USER,
          timestamp: Date.now(),
          reason: request.reason || 'User requested activation'
        });
        
        this.applyActivationState();
        this.reportActivationState();
        
        sendResponse({ success: true, state: this.activationState });
        return true;
      }
      
      // Handle request for analysis report
      if (request.action === 'requestAnalysis') {
        this.generateAnalysisReport()
          .then(report => {
            sendResponse({ success: true, report });
          })
          .catch(error => {
            this.log.error("Failed to generate analysis report", error);
            sendResponse({ success: false, error: error.message });
          });
        
        return true;
      }
      
      // Handle developer mode toggle
      if (request.action === 'toggleDeveloperMode') {
        this.handleDeveloperModeToggle(request.enabled);
        sendResponse({ success: true });
        return true;
      }
      
      return false;
    });
  }
  
  /**
   * Handle developer mode toggle
   * @param {boolean} enabled - Whether developer mode is enabled
   */
  async handleDeveloperModeToggle(enabled) {
    this.log.info(`Developer mode ${enabled ? 'enabled' : 'disabled'}`);
    
    if (enabled) {
      this.activationState = ActivationStates.DEVELOPER;
      
      this.verificationStack.push({
        checkpoint: 'developer_mode',
        result: VerificationResult.OVERRIDE_DEVELOPER,
        timestamp: Date.now()
      });
    } else {
      // Revert to normal verification
      await this.performVerification();
    }
    
    this.applyActivationState();
    this.reportActivationState();
  }
  
  /**
   * Record a verification check result
   * @param {string} checkpoint - Name of the verification checkpoint
   * @param {string} result - Result of the verification
   * @param {string} message - Detailed explanation
   * @param {Object} data - Additional data about the verification
   */
  recordVerification(checkpoint, result, message, data = {}) {
    this.verificationStack.push({
      checkpoint,
      result,
      message,
      data,
      timestamp: Date.now()
    });
    
    if (result !== VerificationResult.PASS) {
      this.log.info(`Verification checkpoint "${checkpoint}" ${result}`, { message, ...data });
    } else {
      this.log.debug(`Verification checkpoint "${checkpoint}" passed`, { message, ...data });
    }
  }
  
  /**
   * Perform the complete verification process
   * @returns {Promise<string>} Final activation state
   */
  async performVerification() {
    this.log.info("Performing strict activation verification");
    
    // Reset verification stack
    this.verificationStack = [];
    
    // CHECKPOINT 1: Developer mode override check
    let isDeveloperMode = false;
    
    if (window.userSettings) {
      isDeveloperMode = await window.userSettings.get('developerMode', false);
    }
    
    if (isDeveloperMode) {
      this.recordVerification(
        'developer_mode_check',
        VerificationResult.OVERRIDE_DEVELOPER,
        'Developer mode is enabled, bypassing other checks'
      );
      
      this.activationState = ActivationStates.DEVELOPER;
      return this.activationState;
    }
    
    // CHECKPOINT 2: Blocklist check - the absolute earliest check
    if (window.SiteBlocklist) {
      const report = window.SiteBlocklist.checkSiteWithReport();
      
      if (report.isBlocked) {
        this.recordVerification(
          'blocklist_check',
          VerificationResult.FAIL_BLOCKLIST,
          `Site blocked: ${report.reason}`,
          report
        );
        
        this.activationState = ActivationStates.BLOCKED;
        return this.activationState;
      } else {
        this.recordVerification(
          'blocklist_check',
          VerificationResult.PASS,
          `Site not in blocklist: ${report.reason}`,
          report
        );
      }
    } else {
      // Blocklist module not available - log warning
      this.log.warn("SiteBlocklist module not available, cannot perform blocklist check");
    }
    
    // CHECKPOINT 3: User settings check
    if (window.userSettings) {
      const isEnabled = await window.userSettings.isEnabledForSite();
      
      if (!isEnabled) {
        this.recordVerification(
          'user_settings_check',
          VerificationResult.FAIL_SETTINGS,
          'Extension disabled by user settings for this site'
        );
        
        this.activationState = ActivationStates.INACTIVE;
        return this.activationState;
      } else {
        this.recordVerification(
          'user_settings_check',
          VerificationResult.PASS,
          'Extension enabled by user settings for this site'
        );
      }
      
      // Check for site-specific override
      const siteOverride = await window.userSettings.getSiteOverride();
      if (siteOverride && siteOverride.forceActivate) {
        this.recordVerification(
          'site_override_check',
          VerificationResult.OVERRIDE_USER,
          'Site has force activation override in user settings',
          { siteOverride }
        );
        
        this.activationState = ActivationStates.ACTIVE;
        return this.activationState;
      }
    }
    
    // CHECKPOINT 4: Form validation check
    if (window.FormValidator) {
      const validator = new window.FormValidator();
      const hasLegitimateForms = validator.pageHasLegitimateForms();
      
      // Store analysis data for reporting
      if (!this.analyzed) {
        this.analysisData = validator.generatePageFormReport();
        this.analyzed = true;
      }
      
      if (hasLegitimateForms) {
        this.recordVerification(
          'form_validation_check',
          VerificationResult.PASS,
          'Page contains legitimate forms'
        );
        
        // Check for type of form page
        const formReport = this.analysisData;
        
        if (formReport.formCount.legitimateExplicit > 0 || 
            formReport.formCount.legitimateImplicit > 1) {
          // Major form presence - fully activate
          this.activationState = ActivationStates.ACTIVE;
        } else {
          // Minor form presence - minimal activation
          this.activationState = ActivationStates.MINIMAL;
        }
      } else {
        this.recordVerification(
          'form_validation_check',
          VerificationResult.FAIL_NO_FORMS,
          'Page does not contain legitimate forms'
        );
        
        this.activationState = ActivationStates.INACTIVE;
      }
    } else {
      // Form validator not available - default to minimal activation for safety
      this.log.warn("FormValidator module not available, cannot perform form validation");
      this.activationState = ActivationStates.MINIMAL;
    }
    
    return this.activationState;
  }
  
  /**
   * Apply the current activation state
   */
  applyActivationState() {
    this.log.info(`Applying activation state: ${this.activationState}`);
    
    // Clear any existing UI elements
    this.clearUI();
    
    // Apply state-specific behaviors
    switch (this.activationState) {
      case ActivationStates.BLOCKED:
        // Do nothing - extension completely inactive
        this.log.info("Extension blocked on this site - no UI shown");
        break;
        
      case ActivationStates.INACTIVE:
        // Do nothing - extension inactive due to no forms
        this.log.info("Extension inactive - no UI shown");
        break;
        
      case ActivationStates.MINIMAL:
        // Show minimal indicator
        this.showMinimalIndicator();
        break;
        
      case ActivationStates.ACTIVE:
        // Fully activate the extension
        this.activateExtension();
        break;
        
      case ActivationStates.DEVELOPER:
        // Activate with debug indicator
        this.activateExtensionWithDebug();
        break;
    }
    
    // Dispatch activation event
    this.dispatchActivationEvent();
  }
  
  /**
   * Clear any UI elements the extension may have added
   */
  clearUI() {
    // Remove minimal indicator if present
    const minimalIndicator = document.getElementById('form-helper-minimal-indicator');
    if (minimalIndicator) {
      minimalIndicator.remove();
    }
    
    // Remove debug indicator if present
    const debugIndicator = document.getElementById('form-helper-debug-indicator');
    if (debugIndicator) {
      debugIndicator.remove();
    }
  }
  
  /**
   * Show minimal indicator for sites with some forms
   */
  showMinimalIndicator() {
    // Create minimal indicator
    const indicator = document.createElement('div');
    indicator.id = 'form-helper-minimal-indicator';
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
    indicator.innerHTML = 'F';
    indicator.title = 'Form Helper Available - Click to activate';
    
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
      this.log.info("Minimal indicator clicked - activating extension");
      this.activationState = ActivationStates.ACTIVE;
      this.applyActivationState();
      this.reportActivationState();
    });
    
    // Add to the page
    document.body.appendChild(indicator);
  }
  
  /**
   * Fully activate the extension
   */
  activateExtension() {
    this.log.info("Activating extension fully");
    
    // Dispatch a custom event to trigger form detection
    this.dispatchActivationEvent();
    
    // Apply any additional activation steps
    this.postActivationSetup();
  }
  
  /**
   * Activate extension with debug features
   */
  activateExtensionWithDebug() {
    this.log.info("Activating extension in developer mode");
    
    // Add debug indicator
    const indicator = document.createElement('div');
    indicator.id = 'form-helper-debug-indicator';
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
    indicator.textContent = 'Form Helper: Developer Mode';
    
    // Add click handler to show verification info
    indicator.addEventListener('click', () => {
      this.showDebugInfo();
    });
    
    // Add to the page
    document.body.appendChild(indicator);
    
    // Activate the extension
    this.activateExtension();
  }
  
  /**
   * Show debug information for developers
   */
  showDebugInfo() {
    // Generate a report with verification info
    const report = {
      activationState: this.activationState,
      verificationStack: this.verificationStack,
      analysisData: this.analysisData,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    // Create a debug panel
    const debugPanel = document.createElement('div');
    debugPanel.style.cssText = `
      position: fixed;
      top: 10%;
      left: 10%;
      width: 80%;
      height: 80%;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 100000;
      font-family: Arial, sans-serif;
      overflow: auto;
      padding: 20px;
    `;
    
    // Panel header
    debugPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0;">Form Helper Debug Info</h2>
        <button id="close-debug-panel" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
      </div>
      <div style="display: flex; margin-bottom: 10px;">
        <div style="font-weight: bold; width: 180px;">Activation State:</div>
        <div>${this.activationState}</div>
      </div>
      <div style="display: flex; margin-bottom: 10px;">
        <div style="font-weight: bold; width: 180px;">URL:</div>
        <div>${window.location.href}</div>
      </div>
      
      <h3>Verification Checks</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Checkpoint</th>
            <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Result</th>
            <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Message</th>
            <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Timestamp</th>
          </tr>
        </thead>
        <tbody>
          ${this.verificationStack.map(check => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${check.checkpoint}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${check.result}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${check.message || ''}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${new Date(check.timestamp).toLocaleTimeString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <h3>Form Analysis</h3>
      <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">
${JSON.stringify(this.analysisData, null, 2)}
      </pre>
    `;
    
    // Add to the page
    document.body.appendChild(debugPanel);
    
    // Add close button handler
    document.getElementById('close-debug-panel').addEventListener('click', () => {
      debugPanel.remove();
    });
  }
  
  /**
   * Generate a detailed analysis report for the current page
   * @returns {Promise<Object>} Analysis report
   */
  async generateAnalysisReport() {
    this.log.info("Generating analysis report");
    
    // If analysis data is already available, use it
    if (!this.analysisData && window.FormValidator) {
      const validator = new window.FormValidator();
      this.analysisData = validator.generatePageFormReport();
      this.analyzed = true;
    }
    
    // Get site blocklist report
    let blocklistReport = { isBlocked: false, reason: 'Blocklist check not available' };
    if (window.SiteBlocklist) {
      blocklistReport = window.SiteBlocklist.checkSiteWithReport();
    }
    
    // Compile comprehensive report
    const report = {
      url: window.location.href,
      hostname: window.location.hostname,
      timestamp: new Date().toISOString(),
      verificationStack: this.verificationStack,
      activationState: this.activationState,
      blocklistReport,
      formAnalysis: this.analysisData,
      userAgent: navigator.userAgent,
      
      // Only include non-sensitive settings data
      settings: {
        developerMode: await window.userSettings?.get('developerMode', false),
        enabled: await window.userSettings?.get('enabled', true),
        validationLevel: await window.userSettings?.get('validationLevel', 'strict')
      }
    };
    
    return report;
  }
  
  /**
   * Post-activation setup work
   */
  postActivationSetup() {
    this.log.debug("Performing post-activation setup");
    
    // Code to run after activation
    // (Intentionally minimal to avoid running code on non-form sites)
  }
  
  /**
   * Dispatch activation event to notify content script
   */
  dispatchActivationEvent() {
    this.log.debug(`Dispatching activation event: ${this.activationState}`);
    
    // Create and dispatch custom event
    const event = new CustomEvent('formHelperActivate', {
      detail: {
        mode: this.activationState,
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
  }
  
  /**
   * Report activation state to background script
   */
  reportActivationState() {
    this.log.debug(`Reporting activation state to background: ${this.activationState}`);
    
    chrome.runtime.sendMessage({
      action: 'activationStateChanged',
      state: this.activationState,
      url: window.location.href
    }).catch(error => {
      // Ignore expected disconnection errors
      if (!error.message.includes('disconnected')) {
        this.log.error("Failed to report activation state", error);
      }
    });
  }
}

// Create and export the strict initializer
window.strictInitializer = new StrictInitializer();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    StrictInitializer,
    ActivationStates,
    VerificationResult,
    strictInitializer: window.strictInitializer
  };
}