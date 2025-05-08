/**
 * EMERGENCY TOOL: Force Debug Panel to appear
 * This file can be loaded in content.js or via the console
 * for testing and fixing debug panel visibility issues
 */

console.log('💥 FORCE DEBUG PANEL TOOL LOADED');

/**
 * Send a test message to the panel
 */
function sendTestMessage() {
  try {
    // Create synthetic form data with a unique test ID
    const testId = 'test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    
    // Create message
    const testMessage = {
      action: 'debugFieldDetection',
      testId: testId,
      message: 'Test message from content script',
      timestamp: Date.now(),
      fields: [
        {
          name: 'username',
          id: 'username_' + testId,
          type: 'text',
          label: 'Test Username',
          required: true,
          derivedType: 'username',
          confidence: 0.9,
          detectionMethod: 'force_debug_tool'
        },
        {
          name: 'password',
          id: 'password_' + testId,
          type: 'password',
          label: 'Test Password',
          required: true,
          derivedType: 'password',
          confidence: 0.95,
          detectionMethod: 'force_debug_tool'
        }
      ],
      formId: 'test_form_' + testId,
      formType: 'forced_test'
    };
    
    console.log('💥 FORCE DEBUG: Sending test message:', testMessage);
    
    // Send message
    chrome.runtime.sendMessage(testMessage, function(response) {
      console.log('💥 FORCE DEBUG: Got response from panel:', response);
    });
    
    return testId;
  } catch (error) {
    console.error('💥 FORCE DEBUG: Error sending test message:', error);
    return null;
  }
}

/**
 * Force show debug panel via direct message
 */
function forceShowDebugPanel() {
  try {
    console.log('💥 FORCE DEBUG: Attempting to force-show debug panel');
    
    // Send special message to show debug panel
    chrome.runtime.sendMessage({
      action: 'forceShowDebugPanel',
      timestamp: Date.now()
    }, function(response) {
      console.log('💥 FORCE DEBUG: Force show response:', response);
    });
  } catch (error) {
    console.error('💥 FORCE DEBUG: Error forcing debug panel:', error);
  }
}

/**
 * Run multiple debug tests
 */
function runDebugTests() {
  console.log('💥 FORCE DEBUG: Running complete debug test suite');
  
  // Send multiple test messages with delay
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      console.log(`💥 FORCE DEBUG: Running test message ${i+1}/3`);
      const testId = sendTestMessage();
      console.log(`💥 FORCE DEBUG: Test ${i+1} ID: ${testId}`);
    }, i * 1000);
  }
  
  // Force show debug panel after messages
  setTimeout(() => {
    console.log('💥 FORCE DEBUG: Forcing debug panel to show');
    forceShowDebugPanel();
  }, 3500);
}

/**
 * Create debug testing UI
 */
function createDebugTestUI() {
  try {
    // Create container
    const container = document.createElement('div');
    container.id = 'force-debug-panel-tools';
    container.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: #673ab7;
      border: 2px solid #512da8;
      border-radius: 4px;
      padding: 10px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    // Add title
    const title = document.createElement('div');
    title.textContent = '🛠️ Debug Panel Tools';
    title.style.cssText = `
      font-weight: bold;
      color: white;
      font-family: Arial, sans-serif;
      margin-bottom: 5px;
      font-size: 14px;
    `;
    container.appendChild(title);
    
    // Create buttons
    const buttons = [
      { label: 'Send Test Message', action: sendTestMessage, color: '#2196f3' },
      { label: 'Force Show Debug Panel', action: forceShowDebugPanel, color: '#ff5722' },
      { label: 'Run All Tests', action: runDebugTests, color: '#4caf50' }
    ];
    
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.textContent = btn.label;
      button.style.cssText = `
        background: ${btn.color};
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: bold;
        width: 100%;
      `;
      button.addEventListener('click', btn.action);
      container.appendChild(button);
    });
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✖ Close';
    closeBtn.style.cssText = `
      background: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px;
      margin-top: 5px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-size: 11px;
    `;
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(container);
    });
    container.appendChild(closeBtn);
    
    // Add to page
    document.body.appendChild(container);
    
    console.log('💥 FORCE DEBUG: Test UI created');
    return container;
  } catch (error) {
    console.error('💥 FORCE DEBUG: Error creating test UI:', error);
    return null;
  }
}

// Add global functions
window.forceDebugTools = {
  sendTestMessage,
  forceShowDebugPanel,
  runDebugTests,
  createDebugTestUI
};

// Create UI automatically
createDebugTestUI();

// Also run a test message by default
setTimeout(() => {
  console.log('💥 FORCE DEBUG: Sending initial test message');
  sendTestMessage();
}, 1000);

console.log('💥 FORCE DEBUG: Tool initialized. Use window.forceDebugTools to access functions');