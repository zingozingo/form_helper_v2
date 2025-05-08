/**
 * Enhanced Logging System for Form Helper
 * 
 * Provides consistent, structured logging across the extension with
 * various log levels and integration with user settings.
 */

/**
 * Log levels in order of severity
 */
const LogLevels = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  NONE: 'none'
};

/**
 * Log level numbers for comparison
 */
const LogLevelValues = {
  [LogLevels.DEBUG]: 0,
  [LogLevels.INFO]: 1,
  [LogLevels.WARN]: 2,
  [LogLevels.ERROR]: 3,
  [LogLevels.NONE]: 4
};

/**
 * Logger class - Provides enhanced, filtered logging capabilities
 */
class Logger {
  constructor() {
    // Default to info level until settings are loaded
    this.level = LogLevels.INFO;
    this.initialized = false;
    
    // Named loggers for different components
    this.loggers = {};
    
    // Log buffer for early logs before initialization
    this.preInitBuffer = [];
    
    // Initialize by loading settings asynchronously
    this.initialize();
  }
  
  /**
   * Initialize logger by loading settings
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    try {
      // Use userSettings if available
      if (window.userSettings) {
        await window.userSettings.ensureLoaded();
        this.level = window.userSettings.settings.loggingLevel;
      } else {
        // Fall back to local storage
        const settings = await chrome.storage.local.get('formHelperSettings');
        if (settings && settings.formHelperSettings && settings.formHelperSettings.loggingLevel) {
          this.level = settings.formHelperSettings.loggingLevel;
        }
      }
      
      console.log(`📝 Logger: Initialized with level "${this.level}"`);
      this.initialized = true;
      
      // Process any buffered logs
      this.processBufferedLogs();
    } catch (error) {
      console.error('📝 Logger ERROR: Failed to initialize', error);
      this.initialized = true; // Mark as initialized to prevent retries
    }
  }
  
  /**
   * Process any logs that were buffered before initialization
   */
  processBufferedLogs() {
    if (this.preInitBuffer.length === 0) {
      return;
    }
    
    console.log(`📝 Logger: Processing ${this.preInitBuffer.length} buffered logs`);
    
    for (const log of this.preInitBuffer) {
      this.logInternal(log.level, log.component, log.message, log.data);
    }
    
    // Clear buffer
    this.preInitBuffer = [];
  }
  
  /**
   * Check if a particular log level should be shown
   * @param {string} logLevel - The log level to check
   * @returns {boolean} True if this level should be logged
   */
  shouldLog(logLevel) {
    return LogLevelValues[logLevel] >= LogLevelValues[this.level];
  }
  
  /**
   * Internal logging implementation
   * @param {string} level - Log level
   * @param {string} component - Component name
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  logInternal(level, component, message, data = {}) {
    // Skip logging if this level is below the current threshold
    if (!this.shouldLog(level)) {
      return;
    }
    
    // Format the log entry
    const timestamp = new Date().toISOString();
    const prefix = component ? `${component}:` : '';
    
    // Emoji indicators for log levels
    const indicators = {
      [LogLevels.DEBUG]: '🔍',
      [LogLevels.INFO]: '📘',
      [LogLevels.WARN]: '⚠️',
      [LogLevels.ERROR]: '❌'
    };
    
    const indicator = indicators[level] || '';
    
    // Log with appropriate console method
    switch (level) {
      case LogLevels.DEBUG:
        console.debug(`${indicator} ${prefix} ${message}`, {
          timestamp,
          ...data
        });
        break;
      case LogLevels.INFO:
        console.info(`${indicator} ${prefix} ${message}`, {
          timestamp,
          ...data
        });
        break;
      case LogLevels.WARN:
        console.warn(`${indicator} ${prefix} ${message}`, {
          timestamp,
          ...data
        });
        break;
      case LogLevels.ERROR:
        console.error(`${indicator} ${prefix} ${message}`, {
          timestamp,
          ...data,
          stack: data.error?.stack || new Error().stack
        });
        break;
    }
  }
  
  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @param {string} component - Optional component name
   */
  debug(message, data = {}, component = '') {
    if (!this.initialized) {
      this.preInitBuffer.push({ level: LogLevels.DEBUG, component, message, data });
      return;
    }
    
    this.logInternal(LogLevels.DEBUG, component, message, data);
  }
  
  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @param {string} component - Optional component name
   */
  info(message, data = {}, component = '') {
    if (!this.initialized) {
      this.preInitBuffer.push({ level: LogLevels.INFO, component, message, data });
      return;
    }
    
    this.logInternal(LogLevels.INFO, component, message, data);
  }
  
  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @param {string} component - Optional component name
   */
  warn(message, data = {}, component = '') {
    if (!this.initialized) {
      this.preInitBuffer.push({ level: LogLevels.WARN, component, message, data });
      return;
    }
    
    this.logInternal(LogLevels.WARN, component, message, data);
  }
  
  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or additional data
   * @param {string} component - Optional component name
   */
  error(message, error = {}, component = '') {
    if (!this.initialized) {
      this.preInitBuffer.push({ level: LogLevels.ERROR, component, message, data: { error } });
      return;
    }
    
    this.logInternal(LogLevels.ERROR, component, message, { error });
  }
  
  /**
   * Get a named logger for a specific component
   * @param {string} component - Component name
   * @returns {Object} Logger instance for the component
   */
  getLogger(component) {
    if (this.loggers[component]) {
      return this.loggers[component];
    }
    
    // Create a new logger with this component name prefilled
    this.loggers[component] = {
      debug: (message, data = {}) => this.debug(message, data, component),
      info: (message, data = {}) => this.info(message, data, component),
      warn: (message, data = {}) => this.warn(message, data, component),
      error: (message, error = {}) => this.error(message, error, component)
    };
    
    return this.loggers[component];
  }
  
  /**
   * Set the current log level
   * @param {string} level - New log level
   */
  setLevel(level) {
    if (LogLevelValues[level] !== undefined) {
      this.level = level;
      console.log(`📝 Logger: Level set to "${level}"`);
      
      // Update in settings if available
      if (window.userSettings && window.userSettings.loaded) {
        window.userSettings.set('loggingLevel', level);
      }
    } else {
      console.error(`📝 Logger ERROR: Invalid log level "${level}"`);
    }
  }
  
  /**
   * Generate a complete log report for debugging
   * @returns {Object} Detailed log report
   */
  generateLogReport() {
    // Include current settings and state
    const report = {
      timestamp: new Date().toISOString(),
      level: this.level,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      domInfo: {
        forms: document.forms.length,
        inputs: document.querySelectorAll('input').length,
        frames: window.frames.length
      }
    };
    
    // Include user settings if available
    if (window.userSettings && window.userSettings.loaded) {
      report.settings = { ...window.userSettings.settings };
      
      // Remove sensitive info
      if (report.settings.siteOverrides) {
        report.settings.siteOverridesCount = Object.keys(report.settings.siteOverrides).length;
        delete report.settings.siteOverrides;
      }
    }
    
    // Include form validation report if available
    if (window.FormValidator) {
      const validator = new window.FormValidator();
      report.formValidation = validator.generatePageFormReport();
    }
    
    return report;
  }
}

// Create global logger instance
window.logger = new Logger();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Logger,
    LogLevels,
    logger: window.logger
  };
}