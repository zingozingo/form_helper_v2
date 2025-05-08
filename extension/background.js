/**
 * AI Form Helper - Background Service Worker
 * 
 * This service worker controls automatic form detection with social media blocking.
 * Forms are detected and processed automatically on all non-blocked sites.
 */

// Safely log messages
function safeLog(message, data = {}) {
  try {
    console.log(`AI Form Helper: ${message}`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  } catch (e) {
    // Ignore errors
  }
}

// Form-related domains and patterns
const FORM_DOMAINS = [
  'testpages.herokuapp.com', 'forms.google.com', 'jotform.com', 'typeform.com',
  'formstack.com', 'wufoo.com', 'formsites.com', 'formsite.com', 'formassembly.com'
];

const GOVERNMENT_DOMAINS_PATTERNS = [
  '.gov', '.gov.', '.sos.', '.state.', '.federal.'
];

const BUSINESS_REGISTRATION_PATTERNS = [
  'business', 'registration', 'register', 'apply', 'application', 'license',
  'permit', 'filing', 'incorporate', 'llc', 'corporation', 'entity', 'ein',
  'tax', 'irs', 'sba', 'secretary', 'state', 'commerce'
];

const FORM_URL_PATTERNS = [
  'form', 'register', 'signup', 'sign-up', 'application', 'apply',
  'registration', 'account', 'checkout', 'contact', 'login', 'subscribe'
];

// Social media domains to block
const BLOCKED_DOMAINS = [
  'instagram.com', 'facebook.com', 'linkedin.com', 
  'twitter.com', 'tiktok.com', 'pinterest.com', 
  'youtube.com', 'reddit.com', 'snapchat.com'
];

// Initialize storage when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  safeLog('Extension installed or updated');
  
  try {
    // Initialize with default values
    await chrome.storage.local.set({
      'formhelper_blocklist': BLOCKED_DOMAINS,
      'formhelper_settings': {
        'enabled': true,
        'autoDetectForms': true,
        'showNotifications': true,
        'highlightFields': true,
        'developerMode': false,
        'lastUpdated': Date.now()
      },
      'formhelper_first_run': true
    });
    
    // Show welcome notification
    chrome.notifications.create('welcome', {
      type: 'basic',
      iconUrl: 'icons/android-chrome-192x192.png',
      title: 'AI Form Helper Installed',
      message: 'AI Form Helper will automatically detect forms on pages you visit.',
      priority: 2
    });
    
    safeLog('Storage initialized with default values');
  } catch (e) {
    console.error('Error initializing storage:', e);
  }
});

// Check if a domain is in the blocklist
async function isDomainBlocked(domain) {
  try {
    // Check the memory cache first for performance
    const memoryCacheKey = `domain_blocked_${domain}`;
    const memoryCache = await chrome.storage.session.get(memoryCacheKey);
    if (memoryCache[memoryCacheKey] !== undefined) {
      return memoryCache[memoryCacheKey];
    }
    
    // Check blocklist
    const data = await chrome.storage.local.get('formhelper_blocklist');
    const blocklist = data.formhelper_blocklist || BLOCKED_DOMAINS;
    
    // Exact match
    if (blocklist.includes(domain)) {
      // Cache the result
      await chrome.storage.session.set({ [memoryCacheKey]: true });
      return true;
    }
    
    // Pattern matching (*.example.com)
    for (const pattern of blocklist) {
      // Handle wildcards (*.example.com)
      if (pattern.startsWith('*.') && domain.endsWith(pattern.substring(1))) {
        // Cache the result
        await chrome.storage.session.set({ [memoryCacheKey]: true });
        return true;
      }
      // Handle subdomain inclusion (example.com includes sub.example.com)
      if (domain.endsWith('.' + pattern)) {
        // Cache the result
        await chrome.storage.session.set({ [memoryCacheKey]: true });
        return true;
      }
    }
    
    // Domain-specific override in settings
    const domainSettingsData = await chrome.storage.local.get('formhelper_domain_settings');
    const domainSettings = domainSettingsData.formhelper_domain_settings || {};
    if (domainSettings[domain] && domainSettings[domain].blocked === true) {
      await chrome.storage.session.set({ [memoryCacheKey]: true });
      return true;
    }
    
    // Cache the negative result
    await chrome.storage.session.set({ [memoryCacheKey]: false });
    return false;
  } catch (e) {
    console.error('Error checking blocklist:', e);
    return false;
  }
}

// Update domain-specific settings
async function updateDomainSettings(domain, blocked = false, persistent = true) {
  try {
    // For temporary settings, just update session storage
    if (!persistent) {
      const memoryCacheKey = `domain_blocked_${domain}`;
      await chrome.storage.session.set({ [memoryCacheKey]: blocked });
      return true;
    }
    
    // Get current domain settings
    const data = await chrome.storage.local.get('formhelper_domain_settings');
    let domainSettings = data.formhelper_domain_settings || {};
    
    // Update or create settings for this domain
    if (!domainSettings[domain]) {
      domainSettings[domain] = {};
    }
    
    // Set block state
    domainSettings[domain].blocked = blocked;
    
    // Add timestamp
    domainSettings[domain].lastUpdated = Date.now();
    
    // Add visit count
    if (!domainSettings[domain].visitCount) {
      domainSettings[domain].visitCount = 1;
    } else {
      domainSettings[domain].visitCount++;
    }
    
    // Save settings
    await chrome.storage.local.set({ 'formhelper_domain_settings': domainSettings });
    
    // Clear any session cache
    const memoryCacheKey = `domain_blocked_${domain}`;
    await chrome.storage.session.remove(memoryCacheKey);
    
    return true;
  } catch (e) {
    console.error('Error updating domain settings:', e);
    return false;
  }
}

// Get the domain from a URL
function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error('Error extracting domain:', e);
    return null;
  }
}

// Inject form detection scripts into the page (without panel/highlighting)
async function injectFormHelper(tabId) {
  try {
    // Check if extension is enabled and get settings
    const data = await chrome.storage.local.get('formhelper_settings');
    const settings = data.formhelper_settings || {};
    
    if (!settings.enabled) {
      safeLog('Extension is disabled, not injecting form helper', { tabId });
      return false;
    }
    
    // Set highlight to false - only show button
    const highlightFields = false;
    
    // Inject the content script if not already present
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.formHelperInitialized
      });
    } catch (e) {
      // If the script fails, it means the content script isn't loaded
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      
      safeLog('Content script injected', { tabId });
    }
    
    // Send message to activate form detection (but not panel or highlighting)
    await chrome.tabs.sendMessage(tabId, {
      action: 'activateFormHelper',
      settings: {
        highlightFields,
        showPanel: false // Only show the button, not the panel
      }
    }).catch((e) => {
      console.error('Error activating form helper:', e);
    });
    
    // Update the icon to show active state (subtler indication)
    await chrome.action.setBadgeText({
      text: '●', // Small dot instead of check mark
      tabId
    });
    
    await chrome.action.setBadgeBackgroundColor({
      color: '#4285F4', // Google blue instead of green
      tabId
    });
    
    safeLog('Form helper activated with button-only mode', { tabId });
    return true;
  } catch (e) {
    console.error('Error injecting form helper:', e);
    
    // Update the icon to show error state
    await chrome.action.setBadgeText({
      text: '!',
      tabId
    });
    
    await chrome.action.setBadgeBackgroundColor({
      color: '#F44336',
      tabId
    });
    
    return false;
  }
}

// Show a notification to the user
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/android-chrome-192x192.png',
    title: title,
    message: message,
    priority: 1
  });
}

// Track domain visits for better user experience
async function trackDomainVisit(domain, tabId) {
  try {
    if (!domain) return;
    
    // Get domain visit history
    const data = await chrome.storage.local.get('formhelper_domain_history');
    let domainHistory = data.formhelper_domain_history || {};
    
    // Update or create entry for this domain
    if (!domainHistory[domain]) {
      domainHistory[domain] = {
        firstVisit: Date.now(),
        visits: 0,
        lastVisit: Date.now(),
        formDetections: 0,
        formScore: 0
      };
    }
    
    // Update visit count and time
    domainHistory[domain].visits++;
    domainHistory[domain].lastVisit = Date.now();
    
    // Save history
    await chrome.storage.local.set({ 'formhelper_domain_history': domainHistory });
    
    // Also update domain settings
    await updateDomainVisitInSettings(domain);
    
    return domainHistory[domain];
  } catch (e) {
    console.error('Error tracking domain visit:', e);
    return null;
  }
}

// Update domain visit info in domain settings
async function updateDomainVisitInSettings(domain) {
  try {
    // Get current domain settings
    const data = await chrome.storage.local.get('formhelper_domain_settings');
    let domainSettings = data.formhelper_domain_settings || {};
    
    // Update or create settings for this domain
    if (!domainSettings[domain]) {
      domainSettings[domain] = {};
    }
    
    // Add visit timestamp
    domainSettings[domain].lastVisit = Date.now();
    
    // Add visit count
    if (!domainSettings[domain].visitCount) {
      domainSettings[domain].visitCount = 1;
      domainSettings[domain].firstVisit = Date.now();
    } else {
      domainSettings[domain].visitCount++;
    }
    
    // Save settings
    await chrome.storage.local.set({ 'formhelper_domain_settings': domainSettings });
    
    return true;
  } catch (e) {
    console.error('Error updating domain visit in settings:', e);
    return false;
  }
}

// Update form detection info for a domain
async function updateFormDetection(domain, formInfo) {
  try {
    if (!domain || !formInfo) return;
    
    // Get domain visit history
    const data = await chrome.storage.local.get('formhelper_domain_history');
    let domainHistory = data.formhelper_domain_history || {};
    
    // Make sure domain entry exists
    if (!domainHistory[domain]) {
      await trackDomainVisit(domain);
      domainHistory = (await chrome.storage.local.get('formhelper_domain_history')).formhelper_domain_history || {};
    }
    
    // Update form detection stats
    domainHistory[domain].formDetections++;
    
    // Update form score (using a weighted average)
    const oldScore = domainHistory[domain].formScore || 0;
    const detections = domainHistory[domain].formDetections || 1;
    domainHistory[domain].formScore = 
      ((oldScore * (detections - 1)) + formInfo.formScore) / detections;
    
    // Save history
    await chrome.storage.local.set({ 'formhelper_domain_history': domainHistory });
    
    return domainHistory[domain];
  } catch (e) {
    console.error('Error updating form detection:', e);
    return null;
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle form detection results from content script
  if (message.action === 'formDetectionResult') {
    const tabId = sender.tab?.id;
    if (!tabId) return true;
    
    // Store results in session storage
    chrome.storage.session.set({
      [`formhelper_results_${tabId}`]: message.results
    }).then(() => {
      // If forms are found and settings allow, show notification
      if (message.results && message.results.formFound) {
        chrome.storage.local.get('formhelper_settings', (data) => {
          const settings = data.formhelper_settings || {};
          
          if (settings.showNotifications) {
            const fieldCount = message.results.fields ? message.results.fields.length : 0;
            showNotification(
              'Form Detected',
              `Found a form with ${fieldCount} fields. Click on the extension icon for assistance.`
            );
          }
        });
      }
    });
    
    return true;
  }
  
  // Handle "toggle extension" request from popup
  if (message.action === 'toggleExtension') {
    const enabled = message.enabled;
    
    chrome.storage.local.get('formhelper_settings', async (data) => {
      const settings = data.formhelper_settings || {};
      settings.enabled = enabled;
      
      await chrome.storage.local.set({ 'formhelper_settings': settings });
      
      // If enabling, check the current tab for forms
      if (enabled) {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (tabs.length > 0) {
            const tabId = tabs[0].id;
            const domain = getDomainFromUrl(tabs[0].url);
            
            if (domain && !(await isDomainBlocked(domain))) {
              injectFormHelper(tabId);
            }
          }
        });
      }
      
      sendResponse({ success: true, enabled });
    });
    
    return true; // Keep the channel open for async response
  }
  
  // Handle "add to blocklist" request from popup
  if (message.action === 'addToBlocklist') {
    const domain = message.domain;
    
    if (!domain) {
      sendResponse({ success: false, error: 'No domain provided' });
      return true;
    }
    
    chrome.storage.local.get('formhelper_blocklist', async (data) => {
      let blocklist = data.formhelper_blocklist || BLOCKED_DOMAINS;
      
      if (!blocklist.includes(domain)) {
        blocklist.push(domain);
        await chrome.storage.local.set({ 'formhelper_blocklist': blocklist });
        await updateDomainSettings(domain, true, true);
      }
      
      sendResponse({ success: true, domain, blocked: true });
    });
    
    return true; // Keep the channel open for async response
  }
  
  // Handle "remove from blocklist" request from popup
  if (message.action === 'removeFromBlocklist') {
    const domain = message.domain;
    
    if (!domain) {
      sendResponse({ success: false, error: 'No domain provided' });
      return true;
    }
    
    chrome.storage.local.get('formhelper_blocklist', async (data) => {
      let blocklist = data.formhelper_blocklist || BLOCKED_DOMAINS;
      
      blocklist = blocklist.filter(item => item !== domain);
      await chrome.storage.local.set({ 'formhelper_blocklist': blocklist });
      await updateDomainSettings(domain, false, true);
      
      sendResponse({ success: true, domain, blocked: false });
    });
    
    return true; // Keep the channel open for async response
  }
  
  // Handle "show notification" request
  if (message.action === 'showNotification') {
    showNotification(message.title, message.message);
    sendResponse({ success: true });
    return true;
  }
});

// Check if a page likely has forms
async function checkForForms(tabId) {
  try {
    // Execute script to check for form elements
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Check for forms
        const forms = document.forms;
        const formCount = forms.length;
        
        // Check for standalone inputs
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
        const selects = document.querySelectorAll('select');
        const textareas = document.querySelectorAll('textarea');
        
        // Count visible standalone fields (not in forms)
        let standaloneFieldCount = 0;
        
        // Check inputs
        for (const input of inputs) {
          if (!input.closest('form') && 
              input.type !== 'hidden' && 
              window.getComputedStyle(input).display !== 'none' &&
              window.getComputedStyle(input).visibility !== 'hidden' &&
              input.offsetParent !== null) {
            standaloneFieldCount++;
          }
        }
        
        // Check selects
        for (const select of selects) {
          if (!select.closest('form') && 
              window.getComputedStyle(select).display !== 'none' &&
              window.getComputedStyle(select).visibility !== 'hidden' &&
              select.offsetParent !== null) {
            standaloneFieldCount++;
          }
        }
        
        // Check textareas
        for (const textarea of textareas) {
          if (!textarea.closest('form') && 
              window.getComputedStyle(textarea).display !== 'none' &&
              window.getComputedStyle(textarea).visibility !== 'hidden' &&
              textarea.offsetParent !== null) {
            standaloneFieldCount++;
          }
        }
        
        // Count visible form fields
        let formFieldCount = 0;
        for (const form of forms) {
          const formInputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
          const formSelects = form.querySelectorAll('select');
          const formTextareas = form.querySelectorAll('textarea');
          
          for (const input of formInputs) {
            if (window.getComputedStyle(input).display !== 'none' &&
                window.getComputedStyle(input).visibility !== 'hidden' &&
                input.offsetParent !== null) {
              formFieldCount++;
            }
          }
          
          for (const select of formSelects) {
            if (window.getComputedStyle(select).display !== 'none' &&
                window.getComputedStyle(select).visibility !== 'hidden' &&
                select.offsetParent !== null) {
              formFieldCount++;
            }
          }
          
          for (const textarea of formTextareas) {
            if (window.getComputedStyle(textarea).display !== 'none' &&
                window.getComputedStyle(textarea).visibility !== 'hidden' &&
                textarea.offsetParent !== null) {
              formFieldCount++;
            }
          }
        }
        
        // Check for submit buttons
        const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
        const hasSubmitButton = submitButtons.length > 0;
        
        // Check for form-related keywords in the page
        const bodyText = document.body.innerText.toLowerCase();
        const formKeywords = ['register', 'sign up', 'login', 'log in', 'submit', 'apply', 'complete', 'form', 'fill'];
        const keywordMatches = formKeywords.filter(keyword => bodyText.includes(keyword)).length;
        
        // URL check for form-related paths
        const currentUrl = window.location.href.toLowerCase();
        const urlFormWords = ['form', 'register', 'signup', 'login', 'apply', 'account', 'contact'];
        const urlMatches = urlFormWords.filter(word => currentUrl.includes(word)).length;
        
        // Score the page for form likelihood
        let formScore = 0;
        
        // Regular forms found
        formScore += Math.min(formCount * 30, 50);
        
        // Form fields found
        formScore += Math.min(formFieldCount * 5, 40);
        
        // Standalone fields found
        formScore += Math.min(standaloneFieldCount * 8, 40);
        
        // Has submit button
        if (hasSubmitButton) formScore += 20;
        
        // Keyword matches in content
        formScore += Math.min(keywordMatches * 5, 20);
        
        // URL contains form-related words
        formScore += Math.min(urlMatches * 10, 20);
        
        // Determine if form is detected based on criteria
        const formDetected = (
          (formCount > 0 && formFieldCount >= 3) ||  // At least one form with 3+ fields
          standaloneFieldCount >= 3 ||               // At least 3 standalone fields
          (hasSubmitButton && (formFieldCount + standaloneFieldCount) >= 2) || // Submit button with at least 2 fields
          formScore >= 70                            // High form score
        );
        
        return {
          formCount,
          formFieldCount,
          standaloneFieldCount,
          totalFieldCount: formFieldCount + standaloneFieldCount,
          hasSubmitButton,
          keywordMatches,
          urlMatches,
          formScore,
          formDetected
        };
      }
    });
    
    // Script results are in an array (one per frame)
    if (results && results.length > 0) {
      return results[0].result;
    }
    
    return null;
  } catch (e) {
    console.error('Error checking for forms:', e);
    return null;
  }
}

// Tab update listener for automatic form detection
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only trigger when the tab has finished loading
  if (changeInfo.status !== 'complete' || !tab.active) {
    return;
  }
  
  try {
    // Get domain from URL
    const domain = getDomainFromUrl(tab.url);
    if (!domain) return;
    
    // Track this domain visit
    await trackDomainVisit(domain, tabId);
    
    // Check if domain is in blocklist
    const blocked = await isDomainBlocked(domain);
    if (blocked) {
      safeLog('Domain is blocked, skipping form detection', { domain, tabId });
      return;
    }
    
    // Check for forms on the page
    const formInfo = await checkForForms(tabId);
    if (formInfo) {
      // Save form detection info for this domain
      await updateFormDetection(domain, formInfo);
      
      // If forms are detected and settings allow, inject form helper
      if (formInfo.formDetected) {
        const data = await chrome.storage.local.get('formhelper_settings');
        const settings = data.formhelper_settings || {};
        
        if (settings.enabled && settings.autoDetectForms) {
          await injectFormHelper(tabId);
          safeLog('Form detected and helper injected', { domain, tabId, formInfo });
        } else {
          // Update badge to show forms are available but not activated
          await chrome.action.setBadgeText({
            text: '!',
            tabId
          });
          
          await chrome.action.setBadgeBackgroundColor({
            color: '#FBBC05', // Yellow
            tabId
          });
          
          safeLog('Form detected but auto-detection disabled', { domain, tabId, formInfo });
        }
      }
    }
  } catch (e) {
    console.error('Error in tab update listener:', e);
  }
});

// Popup open listener - for providing current tab's form status
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getTabStatus') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ success: false, error: 'No active tab' });
        return;
      }
      
      const tabId = tabs[0].id;
      const domain = getDomainFromUrl(tabs[0].url);
      if (!domain) {
        sendResponse({ success: false, error: 'Invalid URL' });
        return;
      }
      
      // Check if domain is blocked
      const blocked = await isDomainBlocked(domain);
      
      // Get extension settings
      const data = await chrome.storage.local.get('formhelper_settings');
      const settings = data.formhelper_settings || {};
      
      // Get any cached form detection results
      const resultsData = await chrome.storage.session.get(`formhelper_results_${tabId}`);
      const formResults = resultsData[`formhelper_results_${tabId}`];
      
      sendResponse({
        success: true,
        domain,
        blocked,
        settings,
        formResults,
        tabId
      });
    });
    
    return true; // Keep channel open for async response
  }

  if (message.action === 'activateOnCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ success: false, error: 'No active tab' });
        return;
      }
      
      const tabId = tabs[0].id;
      const success = await injectFormHelper(tabId);
      
      sendResponse({ success });
    });
    
    return true; // Keep channel open for async response
  }
});

// Extension icon click handler - toggle for current page
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const domain = getDomainFromUrl(tab.url);
    if (!domain) return;
    
    // Check if domain is blocked
    const blocked = await isDomainBlocked(domain);
    if (blocked) {
      showNotification(
        'Domain Blocked',
        'This domain is blocked. You can unblock it in the extension settings.'
      );
      return;
    }
    
    // Get extension settings
    const data = await chrome.storage.local.get('formhelper_settings');
    const settings = data.formhelper_settings || {};
    
    if (!settings.enabled) {
      showNotification(
        'Extension Disabled',
        'The extension is currently disabled. Enable it in the popup settings.'
      );
      return;
    }
    
    // Toggle form helper for this tab
    await injectFormHelper(tab.id);
    
  } catch (e) {
    console.error('Error handling icon click:', e);
  }
});