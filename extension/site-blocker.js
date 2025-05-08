/**
 * Site Blocker - Clean implementation to prevent the extension from running on non-form sites
 * 
 * This script runs at document_start and prevents the extension from running on
 * non-form sites like social media sites. It uses a clean implementation with no
 * exceptions or error throwing.
 */

(function() {
  // Create a safe console logger
  const safeLog = function(message, style) {
    try {
      if (console && console.log) {
        console.log(
          '%c' + message,
          style || 'color: #b71c1c; font-weight: bold;'
        );
      }
    } catch (e) {
      // Ignore any console errors
    }
  };

  // Function to check if this is a form site (whitelist approach)
  const isFormSite = function() {
    try {
      // Get current hostname
      const hostname = window.location.hostname.toLowerCase();
      if (!hostname) return false;

      // List of known form sites
      const FORM_SITES = [
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
        'localhost',
        '127.0.0.1'
      ];

      // Check if the current site is a known form site
      for (const site of FORM_SITES) {
        if (hostname === site || 
            hostname.endsWith('.' + site) || 
            hostname.includes(site) ||
            (site.includes('/') && window.location.href.includes(site))) {
          return true;
        }
      }

      return false;
    } catch (e) {
      // Any error means it's safer to return false
      return false;
    }
  };

  // Function to check if this is a blocked site (blacklist approach)
  const isBlockedSite = function() {
    try {
      // Get current hostname
      const hostname = window.location.hostname.toLowerCase();
      if (!hostname) return false;

      // List of blocked sites
      const BLOCKED_SITES = [
        'instagram.com',
        'facebook.com',
        'linkedin.com',
        'twitter.com',
        'x.com',
        'youtube.com',
        'tiktok.com',
        'pinterest.com',
        'reddit.com',
        'netflix.com',
        'amazon.com',
        'ebay.com',
        'walmart.com',
        'google.com',
        'microsoft.com',
        'apple.com',
        'github.com',
        'stackoverflow.com',
        'discord.com',
        'gmail.com',
        'outlook.com',
        'yahoo.com',
        'twitch.tv'
      ];

      // Check if the current site is blocked
      for (const site of BLOCKED_SITES) {
        if (hostname === site || hostname.endsWith('.' + site)) {
          return true;
        }
      }

      return false;
    } catch (e) {
      // Any error means it's safer to return true (block by default)
      return true;
    }
  };

  // Function to inject CSS to hide UI elements
  const injectBlockingCSS = function() {
    try {
      // Only proceed if document is available
      if (document) {
        // Create style element
        const style = document.createElement('style');
        style.id = 'form-helper-blocker-style';
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
            width: 0 !important;
            height: 0 !important;
            position: fixed !important;
            top: -10000px !important;
            left: -10000px !important;
            pointer-events: none !important;
            z-index: -99999 !important;
          }
        `;

        // Function to safely append style to document
        const appendStyle = function() {
          if (document.head) {
            document.head.appendChild(style);
            return true;
          } else if (document.body) {
            document.body.appendChild(style);
            return true;
          } else if (document.documentElement) {
            document.documentElement.appendChild(style);
            return true;
          }
          return false;
        };

        // Try to append now
        if (!appendStyle()) {
          // If we couldn't append, set up a MutationObserver to try again when DOM changes
          if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(function() {
              if (appendStyle()) {
                observer.disconnect();
              }
            });
            
            // Observe document for changes
            observer.observe(document, { childList: true, subtree: true });
            
            // Set a timeout to disconnect the observer after a few seconds
            setTimeout(function() {
              observer.disconnect();
            }, 5000);
          }
          
          // Also try again after a short delay
          setTimeout(appendStyle, 100);
        }
      }
    } catch (e) {
      // Ignore errors
    }
  };

  // Function to set up global blocking
  const setupGlobalBlocking = function() {
    try {
      // Set global variables to indicate blocking
      window.FORM_HELPER_BLOCKED_SITE = true;
      window.FORM_HELPER_TERMINATED = true;
      window.FORM_HELPER_EMERGENCY_TERMINATED = true;
      
      // Create a global no-op function
      window.formHelperNoop = function() { return false; };

      // Replace core functions with no-op
      window.initializeFormHelper = window.formHelperNoop;
      window.detectForms = window.formHelperNoop;
      window.scanFormsForPanel = window.formHelperNoop;
      window.processEnhancedFieldDetectorResults = window.formHelperNoop;
      window.emergencyTerminate = window.formHelperNoop;
      
      // Log blocking
      safeLog('Form Helper: Extension blocked on this site', 
              'background: #ffebee; color: #b71c1c; font-weight: bold; padding: 3px; border-radius: 3px;');
    } catch (e) {
      // Ignore errors
    }
  };

  // Function to notify background script
  const notifyBackground = function() {
    try {
      // Only proceed if chrome runtime is available
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'siteBlocked',
          url: window.location.href,
          hostname: window.location.hostname,
          timestamp: Date.now()
        }).catch(function() {
          // Ignore any messaging errors
        });
      }
    } catch (e) {
      // Ignore errors
    }
  };

  // Main function that safely determines if extension should be blocked
  const determineBlocking = function() {
    // Default to blocked if we can't determine
    let shouldBlock = true;
    
    // Check whitelist first
    if (isFormSite()) {
      shouldBlock = false;
      safeLog('Form Helper: Running on form site', 
              'background: #e8f5e9; color: #2e7d32; font-weight: bold; padding: 3px; border-radius: 3px;');
    }
    // Then check blacklist as a backup
    else if (isBlockedSite()) {
      shouldBlock = true;
      safeLog('Form Helper: Site in blocklist', 
              'background: #ffebee; color: #b71c1c; font-weight: bold; padding: 3px; border-radius: 3px;');
    }
    
    // If blocked, set up blocking
    if (shouldBlock) {
      // Inject CSS to hide UI elements
      injectBlockingCSS();
      
      // Set up global blocking
      setupGlobalBlocking();
      
      // Notify background script
      notifyBackground();
    }
    
    // Store result globally for other scripts
    window.FORM_HELPER_SHOULD_BLOCK = shouldBlock;
    
    return shouldBlock;
  };

  // Run the blocking determination immediately
  determineBlocking();

  // Set up MutationObserver to catch any Form Helper UI elements
  try {
    if (window.FORM_HELPER_SHOULD_BLOCK && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(function(mutations) {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              if (node && node.nodeType === 1) { // Element node
                // Check for Form Helper UI elements
                if (node.id && (
                    node.id.indexOf('form-helper') !== -1 || 
                    node.id.indexOf('formHelper') !== -1)) {
                  if (node.style) {
                    node.style.display = 'none';
                    node.style.visibility = 'hidden';
                  }
                  
                  // Try to remove the node
                  try {
                    node.remove();
                  } catch (e) {
                    // Ignore errors
                  }
                }
                
                // Look for nested UI elements
                try {
                  if (node.querySelectorAll) {
                    const helperElements = node.querySelectorAll(
                      '[id*="form-helper"], [id*="formHelper"], [class*="form-helper"], [class*="formHelper"], [data-form-helper-element]'
                    );
                    
                    for (let i = 0; i < helperElements.length; i++) {
                      const el = helperElements[i];
                      if (el && el.style) {
                        el.style.display = 'none';
                        el.style.visibility = 'hidden';
                      }
                      
                      // Try to remove the element
                      try {
                        el.remove();
                      } catch (e) {
                        // Ignore errors
                      }
                    }
                  }
                } catch (e) {
                  // Ignore errors with querySelectorAll
                }
              }
            }
          }
        }
      });
      
      // Observe the entire document
      if (document && document.documentElement) {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
        
        // Set a timeout to disconnect the observer after 30 seconds
        setTimeout(function() {
          observer.disconnect();
        }, 30000);
      }
    }
  } catch (e) {
    // Ignore any errors with MutationObserver
  }
})();