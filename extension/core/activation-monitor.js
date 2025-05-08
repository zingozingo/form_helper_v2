/**
 * Activation Monitor - Tracks extension activation status
 * 
 * This module provides real-time monitoring of activation status
 * and coordinates behavior of components based on strict verification.
 */

/**
 * Activation states (duplicated for standalone usage)
 */
const MonitorActivationStates = {
  BLOCKED: 'blocked',
  INACTIVE: 'inactive',
  MINIMAL: 'minimal',
  ACTIVE: 'active',
  DEVELOPER: 'developer'
};

/**
 * ActivationMonitor class - Monitors extension activation status
 */
class ActivationMonitor {
  constructor() {
    this.activationState = null;
    this.listeners = [];
    this.initialized = false;
    
    // For logging
    this.log = window.logger?.getLogger('ActivationMonitor') ||
      {
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
      };
  }
  
  /**
   * Initialize the activation monitor
   */
  initialize() {
    if (this.initialized) {
      return;
    }
    
    this.log.info("Initializing activation monitor");
    
    // Check for early termination flag
    if (window.FORM_HELPER_TERMINATED) {
      this.activationState = MonitorActivationStates.BLOCKED;
      this.log.info("Activation monitor detected early termination flag");
    } 
    // Check for developer mode flag
    else if (window.FORM_HELPER_DEVELOPER_MODE) {
      this.activationState = MonitorActivationStates.DEVELOPER;
      this.log.info("Activation monitor detected developer mode flag");
    }
    
    // Set up listener for activation events
    window.addEventListener('formHelperActivate', (event) => {
      this.handleActivationEvent(event);
    });
    
    // Monitor changes from the strict initializer
    this.monitorStrictInitializer();
    
    // Process any listeners that were added before initialization
    this.initialized = true;
  }
  
  /**
   * Monitor the strict initializer for state changes
   */
  monitorStrictInitializer() {
    // Only monitor if StrictInitializer is available
    if (!window.strictInitializer) {
      this.log.debug("StrictInitializer not available yet");
      
      // Check again in a moment
      setTimeout(() => {
        if (window.strictInitializer) {
          this.monitorStrictInitializer();
        }
      }, 100);
      
      return;
    }
    
    // Initialize if needed
    if (!window.strictInitializer.initialized) {
      try {
        window.strictInitializer.initialize();
      } catch (error) {
        this.log.error("Error initializing StrictInitializer", error);
      }
    }
    
    // Set initial state
    if (this.activationState === null && window.strictInitializer.activationState) {
      this.activationState = window.strictInitializer.activationState;
      this.log.debug(`Initial activation state set to ${this.activationState}`);
      this.notifyListeners();
    }
    
    // Poll for changes
    setInterval(() => {
      if (window.strictInitializer.activationState !== this.activationState) {
        this.log.info(`Activation state changed: ${this.activationState} → ${window.strictInitializer.activationState}`);
        
        this.activationState = window.strictInitializer.activationState;
        this.notifyListeners();
      }
    }, 1000);
  }
  
  /**
   * Handle activation event from other components
   * @param {CustomEvent} event - Activation event
   */
  handleActivationEvent(event) {
    const newState = event.detail.mode;
    
    this.log.debug(`Received activation event: ${newState}`);
    
    if (newState !== this.activationState) {
      this.log.info(`Activation state changed via event: ${this.activationState} → ${newState}`);
      this.activationState = newState;
      this.notifyListeners();
    }
  }
  
  /**
   * Get current activation state
   * @returns {string} Activation state
   */
  getActivationState() {
    return this.activationState;
  }
  
  /**
   * Check if extension is currently active
   * @returns {boolean} True if extension is in active or developer mode
   */
  isActive() {
    return this.activationState === MonitorActivationStates.ACTIVE || 
           this.activationState === MonitorActivationStates.DEVELOPER;
  }
  
  /**
   * Check if extension is showing minimal indicator
   * @returns {boolean} True if extension is in minimal mode
   */
  isMinimal() {
    return this.activationState === MonitorActivationStates.MINIMAL;
  }
  
  /**
   * Check if extension is completely inactive or blocked
   * @returns {boolean} True if extension is inactive or blocked
   */
  isInactive() {
    return this.activationState === MonitorActivationStates.INACTIVE || 
           this.activationState === MonitorActivationStates.BLOCKED;
  }
  
  /**
   * Check if extension is in developer mode
   * @returns {boolean} True if extension is in developer mode
   */
  isDeveloperMode() {
    return this.activationState === MonitorActivationStates.DEVELOPER;
  }
  
  /**
   * Add listener for activation state changes
   * @param {Function} callback - Callback function
   */
  addListener(callback) {
    if (typeof callback !== 'function') {
      this.log.warn("Attempted to add non-function listener");
      return;
    }
    
    this.listeners.push(callback);
    
    // If already initialized, call with current state immediately
    if (this.initialized && this.activationState !== null) {
      try {
        callback(this.activationState);
      } catch (error) {
        this.log.error("Error in activation listener callback", error);
      }
    }
  }
  
  /**
   * Remove listener
   * @param {Function} callback - Callback function to remove
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.activationState);
      } catch (error) {
        this.log.error("Error in activation listener callback", error);
      }
    }
  }
  
  /**
   * Request activation state change
   * @param {string} newState - New activation state
   * @param {string} reason - Reason for change
   * @returns {Promise<boolean>} True if change was successful
   */
  async requestActivationState(newState, reason = 'user_request') {
    this.log.info(`Requesting activation state change to ${newState}`, { reason });
    
    try {
      // Send request to background script
      const response = await chrome.runtime.sendMessage({
        action: 'requestActivationChange',
        state: newState,
        reason: reason
      });
      
      if (response && response.success) {
        this.log.info(`Activation state change to ${newState} approved`);
        return true;
      } else {
        this.log.warn(`Activation state change to ${newState} rejected`, { response });
        return false;
      }
    } catch (error) {
      this.log.error(`Error requesting activation state change to ${newState}`, error);
      return false;
    }
  }
  
  /**
   * Force immediate activation state change
   * @param {string} newState - New activation state
   * @param {string} reason - Reason for override
   */
  forceActivationState(newState, reason = 'manual_override') {
    this.log.warn(`Forcing activation state to ${newState}`, { reason });
    
    // Update local state
    this.activationState = newState;
    
    // Notify listeners
    this.notifyListeners();
    
    // Report to background script
    try {
      chrome.runtime.sendMessage({
        action: 'activationStateChanged',
        state: newState,
        forced: true,
        reason: reason
      }).catch(error => {
        // Ignore expected disconnection errors
        if (!error.message.includes('disconnected')) {
          this.log.error("Failed to report forced activation state", error);
        }
      });
    } catch (error) {
      this.log.error("Error reporting forced activation state", error);
    }
    
    // Dispatch activation event
    const event = new CustomEvent('formHelperActivate', {
      detail: {
        mode: newState,
        forced: true,
        reason: reason,
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
  }
}

// Create singleton instance
window.activationMonitor = new ActivationMonitor();

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.activationMonitor.initialize();
  });
} else {
  window.activationMonitor.initialize();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ActivationMonitor,
    MonitorActivationStates,
    activationMonitor: window.activationMonitor
  };
}