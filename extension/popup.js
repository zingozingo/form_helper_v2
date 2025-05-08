/**
 * AI Form Helper - Popup Script
 * 
 * Simple popup UI for controlling the extension.
 */

// DOM elements
const elements = {
  // Site information
  currentSite: document.getElementById('current-site'),
  statusIcon: document.getElementById('status-icon'),
  statusText: document.getElementById('status-text'),
  
  // Messages
  blocklistMessage: document.getElementById('blocklist-message'),
  
  // Toggles
  extensionToggle: document.getElementById('extension-toggle'),
  autoDetectToggle: document.getElementById('auto-detect-toggle')
};

// Current tab info
let currentTab = null;
let currentDomain = null;
let isBlocked = false;

// Initialize popup
async function initializePopup() {
  try {
    // Get current tab status
    await getTabStatus();
    
    // Set up event listeners for toggles
    elements.extensionToggle.addEventListener('change', async () => {
      await toggleExtension(elements.extensionToggle.checked);
    });
    
    elements.autoDetectToggle.addEventListener('change', async () => {
      await toggleAutoDetect(elements.autoDetectToggle.checked);
    });
  } catch (e) {
    console.error('Error initializing popup:', e);
  }
}

// Get current tab status from background script
async function getTabStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getTabStatus'
    });
    
    if (response && response.success) {
      // Store tab info
      currentTab = response.tabId;
      currentDomain = response.domain;
      isBlocked = response.blocked;
      
      // Update UI
      updateUI(response);
    } else {
      console.error('Failed to get tab status:', response?.error);
    }
  } catch (e) {
    console.error('Error getting tab status:', e);
  }
}

// Update UI based on current status
function updateUI(status) {
  // Update domain display
  elements.currentSite.textContent = status.domain || 'unknown';
  
  // Update toggle states
  elements.extensionToggle.checked = status.settings?.enabled !== false;
  elements.autoDetectToggle.checked = status.settings?.autoDetectForms !== false;
  
  // Update status indicator
  if (status.blocked) {
    // Domain is blocked
    elements.statusIcon.className = 'status-icon blocked';
    elements.statusText.textContent = 'Blocked domain';
    elements.blocklistMessage.classList.add('visible');
    elements.extensionToggle.disabled = true;
    elements.autoDetectToggle.disabled = true;
  } else if (status.settings?.enabled === false) {
    // Extension is disabled globally
    elements.statusIcon.className = 'status-icon disabled';
    elements.statusText.textContent = 'Extension disabled';
    elements.autoDetectToggle.disabled = true;
  } else {
    // Extension is active
    elements.statusIcon.className = 'status-icon enabled';
    elements.statusText.textContent = 'Extension active';
    elements.autoDetectToggle.disabled = false;
    
    // If forms were detected, show that info
    if (status.formResults && status.formResults.formFound) {
      const fieldCount = status.formResults.fields ? status.formResults.fields.length : 0;
      elements.statusText.textContent = `Form detected (${fieldCount} fields)`;
    }
  }
}

// Toggle the whole extension
async function toggleExtension(enabled) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'toggleExtension',
      enabled
    });
    
    if (response && response.success) {
      // Update UI
      if (enabled) {
        elements.statusIcon.className = 'status-icon enabled';
        elements.statusText.textContent = 'Extension active';
        elements.autoDetectToggle.disabled = false;
        
        // Activate on the current tab if not blocked
        if (!isBlocked) {
          chrome.runtime.sendMessage({
            action: 'activateOnCurrentTab'
          });
        }
      } else {
        elements.statusIcon.className = 'status-icon disabled';
        elements.statusText.textContent = 'Extension disabled';
        elements.autoDetectToggle.disabled = true;
      }
    } else {
      // Revert toggle state on failure
      elements.extensionToggle.checked = !enabled;
      console.error('Failed to toggle extension:', response?.error);
    }
  } catch (e) {
    // Revert toggle state on error
    elements.extensionToggle.checked = !enabled;
    console.error('Error toggling extension:', e);
  }
}

// Toggle auto-detect setting
async function toggleAutoDetect(enabled) {
  try {
    // Get current settings
    const data = await chrome.storage.local.get('formhelper_settings');
    const settings = data.formhelper_settings || {};
    
    // Update auto-detect setting
    settings.autoDetectForms = enabled;
    
    // Save updated settings
    await chrome.storage.local.set({ 'formhelper_settings': settings });
    
    console.log('Auto-detect setting updated:', enabled);
  } catch (e) {
    // Revert toggle state on error
    elements.autoDetectToggle.checked = !enabled;
    console.error('Error updating auto-detect setting:', e);
  }
}

// Run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);