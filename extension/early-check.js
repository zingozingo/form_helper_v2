/**
 * ⚠️ EARLY TERMINATION CHECK ⚠️
 * 
 * This script runs at document_start and provides the second layer of
 * protection to prevent the extension from running on non-form websites.
 * 
 * ! IMPORTANT: DO NOT MODIFY OR REMOVE THIS FILE !
 * ! CRITICAL SECURITY CONTROL !
 * 
 * This script is part of the multi-layered protection system that works
 * together with emergency-killswitch.js to ensure the extension ONLY
 * activates on appropriate form-related websites.
 *
 * While emergency-killswitch.js uses a whitelist approach (allowing only
 * specific sites), this script implements a blacklist approach (blocking
 * specific high-traffic social media sites) as a complementary safeguard.
 *
 * This file must be loaded immediately after emergency-killswitch.js
 * with "run_at": "document_start" as configured in manifest.json.
 *
 * See EMERGENCY-KILLSWITCH.md for a complete explanation of the
 * multi-layered protection system and testing instructions.
 */

(function() {
  // Early simple check that does not depend on any other modules
  const earlyBlocklist = [
    "instagram.com",
    "twitter.com", 
    "x.com",
    "facebook.com",
    "youtube.com",
    "reddit.com",
    "tiktok.com",
    "snapchat.com",
    "pinterest.com",
    "linkedin.com"
  ];
  
  // Early termination function
  function earlyTerminationCheck() {
    try {
      // Get current hostname
      const currentHost = window.location.hostname.toLowerCase();
      
      // Check against early blocklist
      for (const blockedDomain of earlyBlocklist) {
        if (currentHost === blockedDomain || currentHost.endsWith(`.${blockedDomain}`)) {
          console.log(`🛑 Form Helper early termination: site blocked - ${currentHost}`);
          
          // Set a flag to prevent other scripts from running
          window.FORM_HELPER_TERMINATED = true;
          
          // Report termination to background script
          try {
            chrome.runtime.sendMessage({
              action: 'earlyTermination',
              reason: 'blocked_site',
              site: currentHost
            }).catch(() => {
              // Silent catch - background might not be ready
            });
          } catch (e) {
            // Ignore messaging errors at this early stage
          }
          
          return true; // Terminated
        }
      }
      
      // Extension allowed to continue on this site
      return false;
    } catch (error) {
      // Log but let extension run in case of errors
      console.error("Error in early termination check:", error);
      return false;
    }
  }
  
  // Check if we should terminate immediately
  const terminated = earlyTerminationCheck();
  
  // Setup complete earliest verification as soon as SiteBlocklist is available
  function setupCompleteVerification() {
    // Skip if already terminated or blocklist not available yet
    if (window.FORM_HELPER_TERMINATED || !window.SiteBlocklist) {
      return;
    }
    
    // Perform full blocklist check
    try {
      const blocklist = window.SiteBlocklist;
      const report = blocklist.checkSiteWithReport();
      
      if (report.isBlocked) {
        console.log(`🛑 Form Helper complete verification: site blocked - ${report.reason}`);
        
        // Set termination flag
        window.FORM_HELPER_TERMINATED = true;
        
        // Report detailed termination to background script
        chrome.runtime.sendMessage({
          action: 'siteBlocked',
          report: report
        }).catch(() => {
          // Silent catch
        });
      }
    } catch (error) {
      console.error("Error in complete verification:", error);
    }
  }
  
  // Try once at start, then wait for modules to load
  if (!terminated) {
    // Check for modules now
    if (window.SiteBlocklist) {
      setupCompleteVerification();
    }
    
    // Check again after a short delay to catch async loading
    setTimeout(() => {
      setupCompleteVerification();
    }, 50);
  }
  
  // Early user settings check
  function earlySettingsCheck() {
    // Skip if already terminated
    if (window.FORM_HELPER_TERMINATED) {
      return;
    }
    
    // Skip if settings not available yet
    if (!window.userSettings || !window.userSettings.loaded) {
      return;
    }
    
    try {
      // Check for developer mode - this overrides everything
      if (window.userSettings.settings.developerMode) {
        console.log("🔧 Form Helper: Developer mode enabled, bypassing termination");
        window.FORM_HELPER_DEVELOPER_MODE = true;
        return;
      }
      
      // Check if extension is enabled globally
      if (!window.userSettings.settings.enabled) {
        console.log("🛑 Form Helper: Disabled globally in user settings");
        window.FORM_HELPER_TERMINATED = true;
        return;
      }
      
      // Check for site-specific overrides
      const hostname = window.location.hostname.toLowerCase();
      const siteOverrides = window.userSettings.settings.siteOverrides || {};
      
      if (siteOverrides[hostname] && siteOverrides[hostname].enabled === false) {
        console.log(`🛑 Form Helper: Disabled for site ${hostname} in user settings`);
        window.FORM_HELPER_TERMINATED = true;
      }
    } catch (error) {
      console.error("Error in early settings check:", error);
    }
  }
  
  // Check settings when available
  if (!terminated) {
    // Try to check now
    if (window.userSettings && window.userSettings.loaded) {
      earlySettingsCheck();
    }
    
    // Check again after a delay
    setTimeout(() => {
      earlySettingsCheck();
    }, 100);
  }
  
  // Export status to global window for other scripts to check
  window.FORM_HELPER_EARLY_CHECK_COMPLETE = true;

  // Add a mutation observer to immediately remove any Form Helper UI elements
  // if the extension is terminated
  if (window.MutationObserver && window.FORM_HELPER_TERMINATED) {
    try {
      console.log(
        '%c🚫 EARLY CHECK: Setting up UI element removal observer',
        'background: #ffebee; color: #b71c1c; font-weight: bold; padding: 3px; border-radius: 3px;'
      );
      
      const observer = new MutationObserver(function(mutations) {
        // Skip processing if we're in developer mode
        if (window.FORM_HELPER_DEVELOPER_MODE) {
          return;
        }
        
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check for Form Helper UI elements by ID
                if (node.id && (
                    node.id.includes('form-helper') || 
                    node.id.includes('formHelper') ||
                    node.id === 'ai-form-assistant-button')) {
                  console.log(
                    '%c🚫 EARLY CHECK: Removing Form Helper UI element',
                    'background: #ffebee; color: #b71c1c; font-weight: bold; padding: 3px; border-radius: 3px;',
                    node
                  );
                  node.remove();
                  continue;
                }
                
                // Check for Form Helper UI elements by class
                if (node.classList && Array.from(node.classList).some(cls => 
                    cls.includes('form-helper') || 
                    cls.includes('formHelper') ||
                    cls.includes('ai-form-assistant'))) {
                  console.log(
                    '%c🚫 EARLY CHECK: Removing Form Helper UI element by class',
                    'background: #ffebee; color: #b71c1c; font-weight: bold; padding: 3px; border-radius: 3px;',
                    node
                  );
                  node.remove();
                  continue;
                }
                
                // Look for specific attributes
                if (node.hasAttribute && node.hasAttribute('data-form-helper-element')) {
                  console.log(
                    '%c🚫 EARLY CHECK: Removing Form Helper UI element by attribute',
                    'background: #ffebee; color: #b71c1c; font-weight: bold; padding: 3px; border-radius: 3px;',
                    node
                  );
                  node.remove();
                  continue;
                }
                
                // Search deeper for nested UI elements
                if (node.querySelectorAll) {
                  const helperElements = node.querySelectorAll(
                    '[id*="form-helper"], [id*="formHelper"], [class*="form-helper"], [class*="formHelper"], [data-form-helper-element]'
                  );
                  
                  if (helperElements.length > 0) {
                    console.log(
                      '%c🚫 EARLY CHECK: Removing nested Form Helper UI elements',
                      'background: #ffebee; color: #b71c1c; font-weight: bold; padding: 3px; border-radius: 3px;',
                      helperElements
                    );
                    
                    helperElements.forEach(el => el.remove());
                  }
                }
              }
            }
          }
        }
      });
      
      // Observe the entire document for added nodes
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      
      // Also inject emergency CSS to hide any UI elements
      const style = document.createElement('style');
      style.id = 'early-check-emergency-css';
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
          position: absolute !important;
          top: -9999px !important;
          left: -9999px !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
          pointer-events: none !important;
          z-index: -9999 !important;
        }
      `;
      
      // Add the style to the document
      if (document.head) {
        document.head.appendChild(style);
      } else {
        // Wait for head to be available
        const headObserver = new MutationObserver(() => {
          if (document.head) {
            document.head.appendChild(style);
            headObserver.disconnect();
          }
        });
        
        headObserver.observe(document.documentElement, { childList: true });
      }
    } catch (error) {
      // Ignore MutationObserver errors
      console.error('Error setting up UI element removal observer:', error);
    }
  }
})();