/**
 * ⚠️ EMERGENCY KILLSWITCH ⚠️
 * 
 * This module implements an absolute first-run killswitch
 * that blocks the Form Helper extension on all sites except
 * explicitly allowed form-related sites.
 * 
 * ! IMPORTANT: DO NOT MODIFY OR REMOVE THIS FILE !
 * ! THIS IS A CRITICAL SECURITY CONTROL !
 *
 * This is an EMERGENCY HOTFIX that MUST be loaded BEFORE ANY other script.
 * 
 * The extension has been configured to ONLY run on a specific whitelist
 * of known form-related sites to prevent it from incorrectly activating
 * on social media sites like Instagram, LinkedIn, etc.
 *
 * This file MUST remain the very first script loaded in manifest.json
 * with "run_at": "document_start" to ensure maximum protection.
 *
 * See EMERGENCY-KILLSWITCH.md for a complete explanation of the
 * multi-layered protection system and testing instructions.
 */

// Execute immediately to prevent any chance of race conditions
(function() {
  // ***********************************************
  // EMERGENCY KILLSWITCH - DO NOT MODIFY OR REMOVE
  // ***********************************************
  
  // Define emergency killswitch in the global scope
  window.FormHelperKillswitch = {
    isTerminated: false,
    terminationReason: null,
    terminationRecord: null,
    
    // Log with distinct emergency formatting for easy identification
    log: function(message) {
      console.log(
        '%c🔴 EMERGENCY KILLSWITCH: ' + message, 
        'background: #ffebee; color: #b71c1c; font-weight: bold; padding: 3px; border-radius: 3px;'
      );
    },
    
    error: function(message) {
      console.error(
        '%c🔴 EMERGENCY KILLSWITCH ERROR: ' + message, 
        'background: #ffebee; color: #b71c1c; font-weight: bold; padding: 3px; border-radius: 3px;'
      );
    },
    
    // Terminate extension completely
    terminate: function(reason, details) {
      // Set state
      this.isTerminated = true;
      this.terminationReason = reason;
      
      // Create termination record
      this.terminationRecord = {
        hostname: window.location.hostname || document.location.hostname || '',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        reason: reason,
        details: details,
        source: 'emergency-killswitch.js'
      };
      
      // Set ALL possible global termination flags for maximum compatibility
      window.FORM_HELPER_TERMINATED = true;
      window.FORM_HELPER_EMERGENCY_TERMINATED = true;
      window.__FORM_HELPER_KILLSWITCH_ACTIVATED = true;
      window.formHelperDisabled = true;
      window.EXTENSION_DISABLED = true;
      window.FORM_HELPER_TERMINATION_RECORD = this.terminationRecord;
      
      // Notify background script
      this.notifyBackground();
      
      // Replace critical functions with no-ops
      this.disableFunctions();
      
      // Log termination
      this.log(`Extension BLOCKED on "${this.terminationRecord.hostname}" - Reason: ${reason}`);
      this.log("Only allowed on specific form testing sites until issue is resolved");
      
      // Inject CSS to prevent UI elements from appearing (nuclear option)
      this.injectBlockingCSS();
    },
    
    // Notify background script of termination
    notifyBackground: function() {
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            action: 'emergencyTermination',
            terminationRecord: this.terminationRecord
          }).catch(() => {
            // Silent catch - background script might not be ready
          });
        }
      } catch (e) {
        // Ignore messaging errors - killswitch should continue regardless
      }
    },
    
    // Override extension functions with no-ops
    disableFunctions: function() {
      const disabledFn = function() { return false; };
      
      // Core functions
      if (window.activateExtension) window.activateExtension = disabledFn;
      if (window.initializeFormHelper) window.initializeFormHelper = disabledFn;
      if (window.detectForms) window.detectForms = disabledFn;
      if (window.scanFormsForPanel) window.scanFormsForPanel = disabledFn;
      
      // Event handlers
      document.addEventListener = (function(originalFn) {
        return function(type, listener, options) {
          // Block form helper related event listeners
          if (type.includes('formHelper') || 
              type === 'DOMContentLoaded' && listener.toString().includes('formHelper')) {
            return false;
          }
          return originalFn.call(document, type, listener, options);
        };
      })(document.addEventListener);
      
      // Chrome message handling
      if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        const originalAddListener = chrome.runtime.onMessage.addListener;
        chrome.runtime.onMessage.addListener = function(listener) {
          // Wrap listener to block form helper messages
          const wrappedListener = function(message, sender, sendResponse) {
            if (message && (
                message.action === 'scanForms' || 
                message.action === 'quickFormScan' ||
                message.action === 'fullFormScan' ||
                message.action === 'autoFillForm' ||
                message.action === 'highlightField')) {
              // Block form helper messages by sending error response
              if (sendResponse) {
                sendResponse({success: false, error: 'FORM_HELPER_EMERGENCY_KILLSWITCH_ACTIVATED'});
              }
              return false;
            }
            // Pass through other messages
            return listener(message, sender, sendResponse);
          };
          return originalAddListener.call(chrome.runtime.onMessage, wrappedListener);
        };
      }
    },
    
    // Inject CSS to block all Form Helper UI elements
    injectBlockingCSS: function() {
      try {
        const style = document.createElement('style');
        style.id = 'form-helper-emergency-killswitch-css';
        style.textContent = `
          /* Hide all Form Helper UI elements */
          #form-helper-container, 
          #form-helper-panel, 
          #form-helper-button,
          #form-helper-debug-panel,
          #form-helper-minimal-indicator,
          #form-helper-debug-indicator,
          .form-helper-highlight,
          .form-helper-field-marker,
          .form-helper-hoverable,
          .form-helper-selected,
          div[id^="form-helper-"],
          div[class^="form-helper-"],
          [data-form-helper-element="true"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -9999 !important;
            position: fixed !important;
            top: -9999px !important;
            left: -9999px !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
          }
        `;
        
        document.head.appendChild(style);
        
        // Also add to document.documentElement to ensure it's applied even if head is modified
        const inlineStyle = document.documentElement.style;
        inlineStyle.setProperty('--form-helper-display', 'none', 'important');
        inlineStyle.setProperty('--form-helper-visibility', 'hidden', 'important');
      } catch (e) {
        this.error('Failed to inject blocking CSS: ' + e.message);
      }
    },
    
    // Check if hostname is allowed
    checkHostname: function() {
      try {
        // Get current hostname - use multiple methods for maximum reliability
        const currentHostname = window.location.hostname || document.location.hostname || '';
        
        // ALLOWED LIST - EXTENSION ONLY WORKS ON THESE DOMAINS
        const ALLOWED_DOMAINS = [
          'testpages.herokuapp.com',
          'form-test.com',
          'formtestpage.com',
          'forms.gle',
          'forms.office.com',
          'docs.google.com/forms',
          'jotform.com',
          'formstack.com',
          'typeform.com',
          'surveymonkey.com',
          'localhost',  // For local development only
          '127.0.0.1'   // For local development only
        ];
        
        // Check if current hostname is in the allowed list
        let isAllowed = false;
        for (const domain of ALLOWED_DOMAINS) {
          if (currentHostname === domain || 
              currentHostname.endsWith('.' + domain) || 
              currentHostname.includes(domain) || 
              (domain.includes('/') && window.location.href.includes(domain))) {
            isAllowed = true;
            break;
          }
        }
        
        if (!isAllowed) {
          this.terminate('blocked_domain', { domain: currentHostname });
          return false;
        }
        
        // Site is allowed
        this.log(`Site "${currentHostname}" is ALLOWED by emergency killswitch`);
        window.FORM_HELPER_EMERGENCY_ALLOWED = true;
        return true;
      } catch (error) {
        // Even in case of error, terminate for safety
        this.error(`Error in hostname check: ${error.message}`);
        this.terminate('check_error', { error: error.message });
        return false;
      }
    }
  };
  
  // Execute the check immediately
  window.FormHelperKillswitch.checkHostname();
  
  // Add a failsafe check in case DOM is manipulated
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Re-check if still needed
      if (!window.FORM_HELPER_TERMINATED && !window.FORM_HELPER_EMERGENCY_ALLOWED) {
        window.FormHelperKillswitch.checkHostname();
      }
    });
  }
  
  // Add MutationObserver to catch any attempts to remove our CSS blocker
  if (window.MutationObserver) {
    try {
      const observer = new MutationObserver(function(mutations) {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
            for (const node of mutation.removedNodes) {
              if (node.id === 'form-helper-emergency-killswitch-css') {
                // Someone removed our CSS blocker - add it back
                window.FormHelperKillswitch.injectBlockingCSS();
                break;
              }
            }
          }
        }
      });
      
      observer.observe(document.documentElement, { 
        childList: true, 
        subtree: true
      });
    } catch (e) {
      // Ignore errors with MutationObserver
    }
  }
  
  // Throw error if terminated to stop execution
  if (window.FORM_HELPER_TERMINATED) {
    throw new Error('FORM_HELPER_EMERGENCY_KILLSWITCH_ACTIVATED');
  }
})();