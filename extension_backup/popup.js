// AI Form Helper popup.js

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const debugModeToggle = document.getElementById('debug-mode-toggle');
    const panelExpandedToggle = document.getElementById('panel-expanded-toggle');
    const openPanelButton = document.getElementById('open-panel-button');
    
    // API Configuration
    const API_URL = 'http://localhost:8000/api/test';
    
    // Default settings
    let appSettings = {
        debugMode: false,
        panelState: {
            collapsed: false
        }
    };
    
    // Initialize the popup
    init();
    
    function init() {
        // Load settings from storage
        loadSettings();
        
        // Check backend connection
        checkBackendConnection();
        
        // Set up event listeners
        setupEventListeners();
    }
    
    // Load settings from storage
    function loadSettings() {
        chrome.storage.local.get(['formHelperSettings'], function(result) {
            if (result.formHelperSettings) {
                appSettings = result.formHelperSettings;
                
                // Update UI to reflect current settings
                debugModeToggle.checked = appSettings.debugMode;
                panelExpandedToggle.checked = !appSettings.panelState.collapsed;
                
                console.log('Settings loaded:', appSettings);
            } else {
                // Initialize with default settings if none exist
                saveSettings();
            }
        });
    }
    
    // Save settings to storage
    function saveSettings() {
        chrome.storage.local.set({
            formHelperSettings: appSettings
        }, function() {
            console.log('Settings saved:', appSettings);
        });
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Debug mode toggle
        if (debugModeToggle) {
            debugModeToggle.addEventListener('change', function() {
                appSettings.debugMode = debugModeToggle.checked;
                saveSettings();
            });
        }
        
        // Panel expanded toggle
        if (panelExpandedToggle) {
            panelExpandedToggle.addEventListener('change', function() {
                appSettings.panelState.collapsed = !panelExpandedToggle.checked;
                saveSettings();
            });
        }
        
        // Open panel button
        if (openPanelButton) {
            openPanelButton.addEventListener('click', function() {
                // Open the form helper panel
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs && tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, {action: 'openPanel'});
                    }
                });
                
                // Close the popup
                window.close();
            });
        }
    }
    
    // Check backend connection
    function checkBackendConnection() {
        fetch(API_URL)
            .then(response => {
                if (response.ok) {
                    updateConnectionStatus(true);
                } else {
                    throw new Error('Server responded with status: ' + response.status);
                }
            })
            .catch(error => {
                console.error('Connection error:', error);
                updateConnectionStatus(false);
            });
    }
    
    // Update connection status in UI
    function updateConnectionStatus(isConnected) {
        if (statusDot && statusText) {
            if (isConnected) {
                statusDot.className = 'status-dot connected';
                statusText.textContent = 'Server Connected';
            } else {
                statusDot.className = 'status-dot disconnected';
                statusText.textContent = 'Offline Mode';
            }
        }
    }
});