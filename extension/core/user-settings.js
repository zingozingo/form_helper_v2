/**
 * User Settings Manager for Form Helper
 * 
 * Manages persistent user preferences and site-specific exceptions
 * for the Form Helper extension.
 */

/**
 * Default settings configuration
 */
const DefaultSettings = {
  // Global activation control (master switch)
  enabled: true,
  
  // Developer mode to bypass restrictions
  developerMode: false,
  
  // Form validation strictness level
  validationLevel: 'strict', // 'strict', 'moderate', 'lenient'
  
  // By default, show on sites with legitimate forms
  showOnFormSites: true,
  
  // Automatically activate on known form sites
  autoActivateOnFormSites: true,
  
  // Showing minimal indicator on sites with some forms
  showMinimalOnHasForms: true,
  
  // Site-specific overrides (allow or block specific sites)
  siteOverrides: {},
  
  // Logging level
  loggingLevel: 'info', // 'debug', 'info', 'warn', 'error', 'none'
  
  // Collection of usage metrics (GDPR compliant)
  collectMetrics: false,
  
  // Last updated timestamp
  lastUpdated: 0
};

/**
 * UserSettings class - Manages all user preferences
 */
class UserSettings {
  constructor() {
    this.settings = { ...DefaultSettings };
    this.loaded = false;
    this.saveTimer = null;
  }
  
  /**
   * Initialize settings by loading from storage
   * @returns {Promise<Object>} Loaded settings
   */
  async initialize() {
    if (this.loaded) {
      return this.settings;
    }
    
    try {
      console.log('⚙️ UserSettings: Loading settings from storage');
      const storedSettings = await chrome.storage.local.get('formHelperSettings');
      
      if (storedSettings && storedSettings.formHelperSettings) {
        console.log('⚙️ UserSettings: Found stored settings');
        
        // Merge stored settings with defaults (in case new settings were added)
        this.settings = {
          ...DefaultSettings,
          ...storedSettings.formHelperSettings
        };
      } else {
        console.log('⚙️ UserSettings: No stored settings found, using defaults');
        this.settings = { ...DefaultSettings };
      }
      
      this.loaded = true;
      return this.settings;
    } catch (error) {
      console.error('⚙️ UserSettings ERROR: Failed to load settings', error);
      // Fall back to defaults
      this.settings = { ...DefaultSettings };
      this.loaded = true;
      return this.settings;
    }
  }
  
  /**
   * Get a specific setting
   * @param {string} key - Setting key
   * @param {*} defaultValue - Default value if setting not found
   * @returns {*} Setting value
   */
  async get(key, defaultValue = null) {
    await this.ensureLoaded();
    
    if (key in this.settings) {
      return this.settings[key];
    }
    
    return defaultValue;
  }
  
  /**
   * Set a specific setting
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    await this.ensureLoaded();
    
    this.settings[key] = value;
    this.settings.lastUpdated = Date.now();
    
    // Schedule save to avoid excessive writes
    this.scheduleSave();
    
    return value;
  }
  
  /**
   * Update multiple settings at once
   * @param {Object} settingsUpdate - Object with settings to update
   * @returns {Promise<Object>} Updated settings
   */
  async update(settingsUpdate) {
    await this.ensureLoaded();
    
    // Merge updates with current settings
    this.settings = {
      ...this.settings,
      ...settingsUpdate,
      lastUpdated: Date.now()
    };
    
    // Schedule save
    this.scheduleSave();
    
    return this.settings;
  }
  
  /**
   * Reset all settings to defaults
   * @returns {Promise<Object>} Default settings
   */
  async reset() {
    this.settings = { ...DefaultSettings };
    this.settings.lastUpdated = Date.now();
    
    // Save immediately
    await this.saveNow();
    
    return this.settings;
  }
  
  /**
   * Schedule a delayed save to reduce I/O operations
   */
  scheduleSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    this.saveTimer = setTimeout(() => {
      this.saveNow();
      this.saveTimer = null;
    }, 1000);
  }
  
  /**
   * Save settings to storage immediately
   * @returns {Promise<void>}
   */
  async saveNow() {
    try {
      await chrome.storage.local.set({
        formHelperSettings: this.settings
      });
      
      console.log('⚙️ UserSettings: Settings saved successfully');
    } catch (error) {
      console.error('⚙️ UserSettings ERROR: Failed to save settings', error);
    }
  }
  
  /**
   * Ensure settings are loaded before proceeding
   * @returns {Promise<void>}
   */
  async ensureLoaded() {
    if (!this.loaded) {
      await this.initialize();
    }
  }
  
  /**
   * Get site-specific overrides for the current site
   * @param {string} [url] - URL to check, defaults to current location
   * @returns {Promise<Object|null>} Site override settings or null if none exist
   */
  async getSiteOverride(url) {
    await this.ensureLoaded();
    
    const currentUrl = url || window.location.href;
    const hostname = new URL(currentUrl).hostname.toLowerCase();
    
    // Check if we have specific settings for this site
    if (this.settings.siteOverrides && this.settings.siteOverrides[hostname]) {
      return this.settings.siteOverrides[hostname];
    }
    
    // Check for wildcard domain matches (e.g. *.example.com)
    const domainParts = hostname.split('.');
    for (let i = 1; i < domainParts.length - 1; i++) {
      const wildcardDomain = '*.' + domainParts.slice(i).join('.');
      if (this.settings.siteOverrides && this.settings.siteOverrides[wildcardDomain]) {
        return this.settings.siteOverrides[wildcardDomain];
      }
    }
    
    return null;
  }
  
  /**
   * Set site-specific override for a domain
   * @param {string} domain - Domain to set override for
   * @param {Object} overrideSettings - Override settings
   * @returns {Promise<void>}
   */
  async setSiteOverride(domain, overrideSettings) {
    await this.ensureLoaded();
    
    // Initialize siteOverrides if it doesn't exist
    if (!this.settings.siteOverrides) {
      this.settings.siteOverrides = {};
    }
    
    // Update override for this domain
    this.settings.siteOverrides[domain.toLowerCase()] = {
      ...overrideSettings,
      lastUpdated: Date.now()
    };
    
    this.settings.lastUpdated = Date.now();
    this.scheduleSave();
  }
  
  /**
   * Remove site-specific override for a domain
   * @param {string} domain - Domain to remove override for
   * @returns {Promise<boolean>} True if an override was removed
   */
  async removeSiteOverride(domain) {
    await this.ensureLoaded();
    
    if (this.settings.siteOverrides && this.settings.siteOverrides[domain.toLowerCase()]) {
      delete this.settings.siteOverrides[domain.toLowerCase()];
      this.settings.lastUpdated = Date.now();
      this.scheduleSave();
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if extension should be enabled for current site
   * @param {string} [url] - URL to check, defaults to current location
   * @returns {Promise<boolean>} True if extension should be enabled
   */
  async isEnabledForSite(url) {
    await this.ensureLoaded();
    
    // Check master switch first
    if (!this.settings.enabled) {
      return false;
    }
    
    // Developer mode overrides everything else
    if (this.settings.developerMode) {
      return true;
    }
    
    // Check site-specific override
    const override = await this.getSiteOverride(url);
    if (override !== null) {
      // Site has specific settings
      return override.enabled !== undefined ? override.enabled : true;
    }
    
    // Default to enabled
    return true;
  }
  
  /**
   * Get the appropriate validation strictness based on settings and site overrides
   * @param {string} [url] - URL to check, defaults to current location
   * @returns {Promise<string>} Validation level ('strict', 'moderate', 'lenient')
   */
  async getValidationLevel(url) {
    await this.ensureLoaded();
    
    // Check for site-specific override
    const override = await this.getSiteOverride(url);
    if (override !== null && override.validationLevel) {
      // Site has specific validation level
      return override.validationLevel;
    }
    
    // Use global validation level
    return this.settings.validationLevel;
  }
  
  /**
   * Report usage metrics for improving the extension (if enabled)
   * @param {string} action - Action to report
   * @param {Object} data - Associated data
   * @returns {Promise<void>}
   */
  async reportMetric(action, data = {}) {
    await this.ensureLoaded();
    
    // Only collect metrics if enabled
    if (!this.settings.collectMetrics) {
      return;
    }
    
    // Build metrics report with anonymous data
    const report = {
      action,
      timestamp: Date.now(),
      validationLevel: this.settings.validationLevel,
      // No personally identifiable information
      pageType: data.pageType || 'unknown',
      result: data.result || 'unknown',
      hasLegitimateForm: data.hasLegitimateForm || false,
      // Generate a pseudo-anonymous session ID that changes daily but doesn't identify the user
      sessionId: btoa(new Date().toISOString().split('T')[0] + navigator.userAgent).substr(0, 16)
    };
    
    try {
      // Store metrics locally - in a real extension this might send to a server
      const metrics = await chrome.storage.local.get('formHelperMetrics') || { formHelperMetrics: [] };
      
      if (!Array.isArray(metrics.formHelperMetrics)) {
        metrics.formHelperMetrics = [];
      }
      
      metrics.formHelperMetrics.push(report);
      
      // Keep only last 100 metrics
      if (metrics.formHelperMetrics.length > 100) {
        metrics.formHelperMetrics = metrics.formHelperMetrics.slice(-100);
      }
      
      await chrome.storage.local.set({ formHelperMetrics: metrics.formHelperMetrics });
    } catch (error) {
      console.error('⚙️ UserSettings ERROR: Failed to store metrics', error);
    }
  }
}

// Create singleton instance
window.userSettings = new UserSettings();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UserSettings,
    DefaultSettings,
    userSettings: window.userSettings
  };
}