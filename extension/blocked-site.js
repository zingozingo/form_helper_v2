// blocked-site.js - Script for the blocked site information page

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get current tab information
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab) {
      console.error('No active tab found');
      return;
    }
    
    // Get hostname of blocked site
    const url = new URL(currentTab.url);
    const hostname = url.hostname;
    
    // Update the UI
    document.getElementById('site-hostname').textContent = hostname;
    
    // Try to get block reason from session storage
    try {
      const result = await chrome.storage.session.get(`blocked_tab_${currentTab.id}`);
      const blockData = result[`blocked_tab_${currentTab.id}`];
      
      if (blockData && blockData.reason) {
        document.getElementById('block-reason').textContent = blockData.reason;
      }
    } catch (error) {
      console.error('Error getting block reason from storage:', error);
    }
    
    // Check if developer mode is enabled (only for real extension developers)
    const devModeSection = document.getElementById('developer-section');
    
    // Get developer mode setting (if it exists)
    try {
      const result = await chrome.storage.local.get('developerMode');
      if (result.developerMode === true) {
        devModeSection.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error checking developer mode:', error);
    }
    
    // Add event listener to override button
    const overrideButton = document.getElementById('override-button');
    overrideButton.addEventListener('click', async () => {
      try {
        // This is a temporary override for the current tab only
        // It will be reset when the tab is navigated or closed
        
        // Set emergency override flag in session storage
        await chrome.storage.session.set({
          [`emergency_override_${currentTab.id}`]: {
            enabled: true,
            timestamp: Date.now(),
            url: currentTab.url
          }
        });
        
        // Notify the background script of override
        chrome.runtime.sendMessage({
          action: 'developerOverride',
          tabId: currentTab.id,
          url: currentTab.url
        });
        
        // Update badge text and background
        chrome.action.setBadgeText({
          text: 'DEV',
          tabId: currentTab.id
        });
        
        chrome.action.setBadgeBackgroundColor({
          color: '#FF9800',
          tabId: currentTab.id
        });
        
        // Update UI to show override is active
        overrideButton.textContent = 'Override Activated';
        overrideButton.disabled = true;
        
        // Add a message to let the user know it's activated
        const message = document.createElement('p');
        message.textContent = 'Override active for this tab only. Refresh the page to see Form Helper.';
        message.style.color = '#FF9800';
        message.style.fontWeight = 'bold';
        message.style.marginTop = '10px';
        devModeSection.appendChild(message);
      } catch (error) {
        console.error('Error setting override:', error);
        alert('Failed to activate override: ' + error.message);
      }
    });
  } catch (error) {
    console.error('Error initializing blocked site page:', error);
  }
});