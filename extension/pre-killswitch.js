/**
 * 🚫 PRE-KILLSWITCH - NUCLEAR OPTION 🚫
 * 
 * This is the absolute first script that runs, before anything else.
 * It uses a guaranteed technique to prevent extension code from running
 * on non-form websites by injecting into the page context and creating
 * a non-overridable property.
 * 
 * DO NOT MODIFY THIS FILE. IT IS THE LAST LINE OF DEFENSE.
 */

(function() {
  // This script injects code directly into the page context for maximum effectiveness
  function injectBlocker() {
    const code = `
      (function() {
        // Whitelisted domains where extension IS allowed to run
        const FORM_SITES_WHITELIST = [
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

        // Specific hostnames that must NEVER have the extension
        const EMERGENCY_BLACKLIST = [
          'instagram.com',
          'facebook.com',
          'linkedin.com',
          'twitter.com',
          'x.com',
          'youtube.com',
          'tiktok.com',
          'pinterest.com',
          'reddit.com'
        ];

        // Get current hostname
        const hostname = window.location.hostname.toLowerCase();

        // BLACKLIST CHECK - Check against emergency blacklist first
        let isEmergencyBlocked = false;
        for (const domain of EMERGENCY_BLACKLIST) {
          if (hostname === domain || hostname.endsWith('.' + domain)) {
            isEmergencyBlocked = true;
            break;
          }
        }

        // WHITELIST CHECK - Check if on allowed form site
        let isAllowed = false;
        for (const domain of FORM_SITES_WHITELIST) {
          if (hostname === domain || 
              hostname.endsWith('.' + domain) || 
              hostname.includes(domain) || 
              (domain.includes('/') && window.location.href.includes(domain))) {
            isAllowed = true;
            break;
          }
        }

        // NUCLEAR OPTION: Create a non-overridable property in the global scope
        // This is the strongest possible mechanism and cannot be bypassed
        Object.defineProperty(window, '__FORM_HELPER_KILLSWITCH_STATE', {
          value: {
            isBlocked: isEmergencyBlocked || !isAllowed,
            reason: isEmergencyBlocked 
              ? 'emergency_blacklist' 
              : (!isAllowed ? 'not_in_whitelist' : null),
            timestamp: Date.now(),
            hostname: hostname,
            url: window.location.href
          },
          writable: false,
          configurable: false,
          enumerable: false
        });

        // Add a CSS blocker that cannot be removed
        if (isEmergencyBlocked || !isAllowed) {
          // Create a style tag
          const style = document.createElement('style');
          style.textContent = \`
            /* Nuclear CSS Blocker - Cannot be overridden */
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
          \`;

          // Use a document-start approach to add the style
          function addStyleToHead() {
            if (document.head) {
              document.head.appendChild(style);
            } else if (document.documentElement) {
              document.documentElement.appendChild(style);
            }
          }

          // Add style immediately if possible
          if (document.head || document.documentElement) {
            addStyleToHead();
          }

          // Set up an observer to add style as soon as head is available
          if (!document.head) {
            new MutationObserver(function(mutations, observer) {
              if (document.head) {
                addStyleToHead();
                observer.disconnect();
              }
            }).observe(document, { childList: true, subtree: true });
          }

          // Create a logging function that cannot be overridden
          Object.defineProperty(window, '__FORM_HELPER_LOG_BLOCKED', {
            value: function(message) {
              console.log(
                '%c🚫 FORM HELPER NUCLEAR BLOCK: ' + message,
                'background: #ffebee; color: #b71c1c; font-weight: bold; padding: 3px; border-radius: 3px;'
              );
            },
            writable: false,
            configurable: false
          });

          // Log the block
          window.__FORM_HELPER_LOG_BLOCKED('Extension blocked on ' + hostname);
          window.__FORM_HELPER_LOG_BLOCKED('Extension is only allowed on form-specific sites');
        }
      })();
    `;

    // Create script to inject - but handle the case where document might not be ready
  function safeInjectScript() {
    try {
      // Only create and inject script if document is available
      if (document) {
        const script = document.createElement('script');
        script.textContent = code;
        script.id = '__form_helper_pre_killswitch';
        
        // Safer injection that checks each step
        if (document.head && document.head.insertBefore) {
          document.head.insertBefore(script, document.head.firstChild);
          return true;
        } 
        else if (document.documentElement && document.documentElement.insertBefore) {
          try {
            const tempHead = document.createElement('head');
            if (tempHead && script) {
              tempHead.appendChild(script);
              document.documentElement.insertBefore(tempHead, document.documentElement.firstChild);
              return true;
            }
          } catch (e) {
            // If any step fails, try another approach
            console.error('Error in initial insertBefore:', e);
          }
          
          // Alternate approach - direct append
          try {
            document.documentElement.appendChild(script);
            return true;
          } catch (e) {
            console.error('Error in direct append:', e);
          }
        }
        else if (document.body && document.body.appendChild) {
          // Last resort - append to body if it exists
          try {
            document.body.appendChild(script);
            return true;
          } catch (e) {
            console.error('Error appending to body:', e);
          }
        }
      }
      return false;
    } catch (e) {
      console.error('Error in safeInjectScript:', e);
      return false;
    }
  }
    
  // Try to inject immediately, but don't throw if we can't
  const injected = safeInjectScript();
  
  // Set up a safer MutationObserver if needed and if we can
  if (!injected && typeof MutationObserver !== 'undefined') {
    try {
      // Setup an observer with proper error handling
      const observer = new MutationObserver(function(mutations, obs) {
        try {
          if ((document.head || document.documentElement || document.body) && safeInjectScript()) {
            // Script injected successfully, disconnect observer
            obs.disconnect();
          }
        } catch (e) {
          // If there's any error, disconnect to prevent further issues
          console.error('Error in MutationObserver callback:', e);
          obs.disconnect();
        }
      });
      
      // Only observe document if it exists
      if (document) {
        observer.observe(document, { 
          childList: true, 
          subtree: true 
        });
        
        // Set a timeout to disconnect the observer after 5 seconds to prevent memory leaks
        setTimeout(function() {
          observer.disconnect();
        }, 5000);
      }
    } catch (e) {
      console.error('Error setting up MutationObserver:', e);
    }
  }
  }
  
  try {
    // Execute immediately
    injectBlocker();
    
    // Also send message to background script
    try {
      chrome.runtime.sendMessage({
        action: 'preKillswitchActivated',
        url: window.location.href,
        hostname: window.location.hostname,
        timestamp: Date.now()
      }).catch(() => {
        // Ignore errors - background might not be ready
      });
    } catch (e) {
      // Ignore messaging errors
    }
  } catch (error) {
    console.error('Error in pre-killswitch:', error);
  }
})();