/**
 * Field Detection Debug Script
 * This will be injected by content.js to debug field detection issues
 */

console.log('🔍 Field Detection Debug Script loaded');

// Create debug namespace to avoid conflicts
window.FieldDetectionDebug = window.FieldDetectionDebug || {};

(function(debug) {
  // Track all detection runs
  debug.runs = [];
  debug.lastDetectedFields = [];
  
  // Debug UI elements
  debug.panel = null;
  debug.fieldHighlights = [];
  
  /**
   * Setup debug logging for EnhancedFieldDetector
   */
  debug.setupDetectorLogging = function() {
    if (!window.EnhancedFieldDetector) {
      console.error('❌ EnhancedFieldDetector not found, cannot setup debugging');
      return;
    }
    
    // Store original methods to wrap them
    const originalDetectFields = window.EnhancedFieldDetector.detectFields;
    
    // Wrap the detect fields method to capture results
    window.EnhancedFieldDetector.detectFields = function() {
      console.log('🧪 DEBUG: EnhancedFieldDetector.detectFields called');
      
      // Run the original method
      try {
        // Force test mode on
        window.EnhancedFieldDetector.testMode = true;
        const startTime = performance.now();
        const results = originalDetectFields.apply(this, arguments);
        const endTime = performance.now();
        
        // Track the run
        debug.runs.push({
          timestamp: new Date().toISOString(),
          duration: endTime - startTime,
          fieldsFound: results.fields.length,
          rawFieldsCount: results.rawFields ? results.rawFields.length : 0,
          methods: results.detectionMethods || []
        });
        
        // Store last detected fields
        debug.lastDetectedFields = results.fields;
        
        // Show debug UI
        debug.showDebugUI(results.fields, results.rawFields || []);
        
        // Log the results
        console.log('🧪 DEBUG: EnhancedFieldDetector results:', {
          fieldsFound: results.fields.length,
          rawFieldsCount: results.rawFields ? results.rawFields.length : 0,
          methods: results.detectionMethods || [],
          duration: (endTime - startTime).toFixed(1) + 'ms'
        });
        
        // Log fields found
        console.table(results.fields.map(field => ({
          name: field.name || field.id || 'Unknown',
          type: field.type || 'text',
          label: field.label || 'No Label',
          confidence: field.confidence ? field.confidence.toFixed(2) : 'N/A',
          method: field.detectionMethod || 'unknown'
        })));
        
        // Test message passing to panel
        debug.testMessagePassing(results.fields);
        
        return results;
      } catch (error) {
        console.error('❌ ERROR in detectFields:', error);
        return {
          fields: [],
          error: error.message,
          timing: 0
        };
      }
    };
    
    console.log('✅ Detector logging setup complete');
  };
  
  /**
   * Test message passing to panel and integration with debug panel
   */
  debug.testMessagePassing = function(fields) {
    try {
      console.log('🧪 Testing message passing with', fields.length, 'fields');
      
      // Create test formData structure
      const testFormData = {
        formId: 'test_form_' + Date.now(),
        fields: fields,
        formType: 'test',
        formContext: {
          form_type: 'test form',
          description: 'Test form for debugging',
          confidence: 0.9
        },
        detectionMethod: 'debug',
        detectionMethods: ['debug', 'test']
      };
      
      // First send a test message
      chrome.runtime.sendMessage({
        action: 'testMessage',
        message: 'DEBUG: Testing message passing',
        timestamp: Date.now(),
        fieldsCount: fields.length
      }, response => {
        console.log('🧪 Test message response:', response);
      });
      
      // Send debug specific message for panel-debug-integration.js
      chrome.runtime.sendMessage({
        action: 'debugFieldDetection',
        fields: fields,
        formId: testFormData.formId,
        formType: testFormData.formType,
        methods: testFormData.detectionMethods,
        timestamp: Date.now()
      }, response => {
        console.log('🧪 debugFieldDetection message response:', response);
      });
      
      // Send explicit formDetected message for back-compatibility
      setTimeout(() => {
        console.log('🧪 Sending explicit formDetected message with', fields.length, 'fields');
        chrome.runtime.sendMessage({
          action: 'formDetected',
          formData: testFormData
        }, response => {
          console.log('🧪 formDetected message response:', response);
        });
      }, 500);
    } catch (error) {
      console.error('❌ Error in test message passing:', error);
    }
  };
  
  /**
   * Create debug UI to visualize detected fields
   */
  debug.showDebugUI = function(fields, rawFields) {
    // Remove previous highlights and panel
    debug.clearDebugUI();
    
    // Highlight detected fields
    fields.forEach((field, index) => {
      const element = document.getElementById(field.id) || 
                     (field.name ? document.querySelector(`[name="${field.name}"]`) : null);
      
      if (element) {
        const highlight = debug.highlightElement(element, `#${index + 1}: ${field.label || field.name || field.id}`, field.confidence);
        debug.fieldHighlights.push(highlight);
      }
    });
    
    // Create and show debug panel
    debug.showDebugPanel(fields, rawFields);
  };
  
  /**
   * Clear debug UI elements
   */
  debug.clearDebugUI = function() {
    // Remove field highlights
    debug.fieldHighlights.forEach(highlight => {
      if (highlight && highlight.parentNode) {
        highlight.parentNode.removeChild(highlight);
      }
    });
    debug.fieldHighlights = [];
    
    // Remove debug panel
    if (debug.panel && debug.panel.parentNode) {
      debug.panel.parentNode.removeChild(debug.panel);
      debug.panel = null;
    }
  };
  
  /**
   * Highlight an element on the page
   */
  debug.highlightElement = function(element, label, confidence) {
    try {
      const rect = element.getBoundingClientRect();
      const highlight = document.createElement('div');
      
      // Set highlight style based on confidence
      const confidenceColor = debug.getConfidenceColor(confidence);
      
      highlight.style.cssText = `
        position: absolute;
        top: ${rect.top + window.scrollY - 2}px;
        left: ${rect.left + window.scrollX - 2}px;
        width: ${rect.width + 4}px;
        height: ${rect.height + 4}px;
        border: 2px solid ${confidenceColor};
        background-color: ${confidenceColor}20;
        z-index: 9999;
        pointer-events: none;
        box-shadow: 0 0 5px rgba(0,0,0,0.3);
      `;
      
      // Add label
      const labelEl = document.createElement('div');
      labelEl.style.cssText = `
        position: absolute;
        top: ${rect.height + 5}px;
        left: 0;
        background-color: ${confidenceColor};
        color: white;
        padding: 2px 5px;
        font-size: 12px;
        font-family: Arial, sans-serif;
        border-radius: 3px;
        white-space: nowrap;
        z-index: 10000;
      `;
      labelEl.textContent = `${label} (${confidence ? confidence.toFixed(2) : 'N/A'})`;
      highlight.appendChild(labelEl);
      
      document.body.appendChild(highlight);
      return highlight;
    } catch (error) {
      console.error('Error highlighting element:', error);
      return null;
    }
  };
  
  /**
   * Get color based on confidence score
   */
  debug.getConfidenceColor = function(confidence) {
    if (!confidence) return '#999'; // Gray for unknown
    
    if (confidence >= 0.7) return '#4CAF50'; // Green for high confidence
    if (confidence >= 0.5) return '#FFC107'; // Yellow for medium confidence
    return '#F44336'; // Red for low confidence
  };
  
  /**
   * Show debug panel with field information
   */
  debug.showDebugPanel = function(fields, rawFields) {
    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      max-height: 80vh;
      overflow-y: auto;
      background-color: white;
      border: 1px solid #ccc;
      border-radius: 5px;
      box-shadow: 0 0 10px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 12px;
      padding: 10px;
    `;
    
    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
    `;
    header.textContent = `Field Detection Debug - ${fields.length} fields found`;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-weight: bold;
      color: #666;
    `;
    closeBtn.onclick = function() {
      debug.clearDebugUI();
    };
    header.appendChild(closeBtn);
    panel.appendChild(header);
    
    // Add run stats
    const stats = document.createElement('div');
    stats.style.cssText = `
      margin-bottom: 10px;
      padding: 5px;
      background-color: #f5f5f5;
      border-radius: 3px;
    `;
    
    const lastRun = debug.runs[debug.runs.length - 1] || {};
    stats.innerHTML = `
      <div><strong>Time:</strong> ${lastRun.timestamp || 'N/A'}</div>
      <div><strong>Duration:</strong> ${lastRun.duration ? lastRun.duration.toFixed(1) + 'ms' : 'N/A'}</div>
      <div><strong>Methods:</strong> ${lastRun.methods ? lastRun.methods.join(', ') : 'N/A'}</div>
      <div><strong>Raw Fields:</strong> ${rawFields.length}</div>
      <div><strong>Filtered Fields:</strong> ${fields.length}</div>
    `;
    panel.appendChild(stats);
    
    // Add detected fields list
    const fieldsList = document.createElement('div');
    fieldsList.style.cssText = `
      margin-top: 10px;
    `;
    
    // Fields header
    const fieldsHeader = document.createElement('div');
    fieldsHeader.style.cssText = `
      font-weight: bold;
      margin-bottom: 5px;
      padding-bottom: 3px;
      border-bottom: 1px solid #eee;
    `;
    fieldsHeader.textContent = 'Detected Fields:';
    fieldsList.appendChild(fieldsHeader);
    
    // Add fields
    if (fields.length === 0) {
      const noFields = document.createElement('div');
      noFields.style.cssText = `
        padding: 10px;
        background-color: #ffecec;
        border-radius: 3px;
        color: #f44336;
        text-align: center;
      `;
      noFields.textContent = 'No fields detected!';
      fieldsList.appendChild(noFields);
    } else {
      fields.forEach((field, index) => {
        const fieldItem = document.createElement('div');
        fieldItem.style.cssText = `
          margin-bottom: 5px;
          padding: 5px;
          border: 1px solid #eee;
          border-radius: 3px;
          background-color: ${index % 2 === 0 ? '#f9f9f9' : 'white'};
        `;
        
        const confidenceColor = debug.getConfidenceColor(field.confidence);
        const confidenceBadge = document.createElement('span');
        confidenceBadge.style.cssText = `
          float: right;
          padding: 2px 5px;
          border-radius: 3px;
          color: white;
          background-color: ${confidenceColor};
          font-size: 10px;
        `;
        confidenceBadge.textContent = field.confidence ? field.confidence.toFixed(2) : 'N/A';
        
        // Field content
        fieldItem.innerHTML = `
          <div><strong>${index + 1}. ${field.label || 'No Label'}</strong> ${confidenceBadge.outerHTML}</div>
          <div><small>Name: ${field.name || 'N/A'} | ID: ${field.id || 'N/A'} | Type: ${field.type || 'text'}</small></div>
          <div><small>Method: ${field.detectionMethod || 'unknown'}</small></div>
        `;
        
        // Hover effect to highlight this field
        fieldItem.onmouseover = function() {
          fieldItem.style.backgroundColor = '#e0f7fa';
          const element = document.getElementById(field.id) || 
                         (field.name ? document.querySelector(`[name="${field.name}"]`) : null);
          if (element) {
            element.style.outline = `3px solid ${confidenceColor}`;
            element.style.outlineOffset = '2px';
          }
        };
        
        fieldItem.onmouseout = function() {
          fieldItem.style.backgroundColor = index % 2 === 0 ? '#f9f9f9' : 'white';
          const element = document.getElementById(field.id) || 
                         (field.name ? document.querySelector(`[name="${field.name}"]`) : null);
          if (element) {
            element.style.outline = '';
            element.style.outlineOffset = '';
          }
        };
        
        fieldsList.appendChild(fieldItem);
      });
    }
    
    panel.appendChild(fieldsList);
    
    // Add button to test message passing
    const testMessageBtn = document.createElement('button');
    testMessageBtn.style.cssText = `
      margin-top: 10px;
      padding: 5px 10px;
      background-color: #4285F4;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      width: 100%;
    `;
    testMessageBtn.textContent = 'Test Message Passing to Panel';
    testMessageBtn.onclick = function() {
      debug.testMessagePassing(fields);
    };
    panel.appendChild(testMessageBtn);
    
    // Add button to run detection again
    const detectBtn = document.createElement('button');
    detectBtn.style.cssText = `
      margin-top: 5px;
      padding: 5px 10px;
      background-color: #34A853;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      width: 100%;
    `;
    detectBtn.textContent = 'Run Detection Again';
    detectBtn.onclick = function() {
      debug.clearDebugUI();
      if (window.EnhancedFieldDetector) {
        window.EnhancedFieldDetector.detectFields();
      }
    };
    panel.appendChild(detectBtn);
    
    document.body.appendChild(panel);
    debug.panel = panel;
  };
  
  /**
   * Set up message listener for panel integration
   */
  debug.setupMessageListener = function() {
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      console.log('🧪 Debug script received message:', message);
      
      // Handle action types
      if (message.action === 'runDebugFieldDetection') {
        console.log('🧪 Received request to run field detection from panel');
        
        if (window.EnhancedFieldDetector) {
          // Run detection and send results back
          try {
            const results = window.EnhancedFieldDetector.detectFields();
            sendResponse({
              success: true,
              fieldsFound: results.fields.length
            });
          } catch (error) {
            console.error('❌ Error running detection:', error);
            sendResponse({
              success: false,
              error: error.message
            });
          }
        } else {
          sendResponse({
            success: false,
            error: 'EnhancedFieldDetector not available'
          });
        }
        
        return true;
      }
      
      // Default response for any other messages
      sendResponse({ success: true });
      return true;
    });
  };
  
  /**
   * Initialize debugging
   */
  debug.init = function() {
    console.log('🧪 Initializing field detection debugging');
    debug.setupDetectorLogging();
    debug.setupMessageListener();
    
    // Add a button to trigger detection manually
    const debugButton = document.createElement('button');
    debugButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 15px;
      background-color: #4285F4;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      z-index: 10000;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;
    debugButton.textContent = 'Debug Field Detection';
    debugButton.onclick = function() {
      if (window.EnhancedFieldDetector) {
        window.EnhancedFieldDetector.detectFields();
      } else {
        alert('EnhancedFieldDetector not available!');
      }
    };
    document.body.appendChild(debugButton);
    
    // Run field detection after a delay to ensure everything is loaded
    setTimeout(() => {
      if (window.EnhancedFieldDetector) {
        window.EnhancedFieldDetector.detectFields();
      }
    }, 1000);
  };
  
})(window.FieldDetectionDebug);

// Create explicit test function that can be called from the console
window.testFieldDetection = function() {
  console.log('🧪 MANUAL: Running field detection test from console');
  if (window.FieldDetectionDebug) {
    window.FieldDetectionDebug.init();
    
    // Force detection after init
    setTimeout(() => {
      if (window.EnhancedFieldDetector) {
        console.log('🧪 MANUAL: Running detector explicitly');
        window.EnhancedFieldDetector.detectFields();
      } else {
        console.error('🧪 MANUAL: EnhancedFieldDetector not available');
        alert('EnhancedFieldDetector not available - check console for details');
      }
    }, 500);
  } else {
    console.error('🧪 MANUAL: FieldDetectionDebug not available');
    alert('FieldDetectionDebug not available - check console for details');
  }
};

// Create direct message test function
window.testMessagePassing = function() {
  console.log('🧪 MANUAL: Testing direct message passing');
  
  // Create a test message with random ID to track
  const testId = Math.random().toString(36).substring(2, 10);
  
  const testMessage = {
    action: 'debugFieldDetection',
    testId: testId,
    timestamp: Date.now(),
    fields: [
      {
        name: 'test_username',
        id: 'username',
        type: 'text',
        label: 'Test Username',
        required: true,
        derivedType: 'username',
        confidence: 0.9,
        detectionMethod: 'test'
      },
      {
        name: 'test_password',
        id: 'password',
        type: 'password',
        label: 'Test Password',
        required: true,
        derivedType: 'password',
        confidence: 0.95,
        detectionMethod: 'test'
      }
    ],
    formId: 'test_form_' + testId,
    formType: 'test',
    methods: ['test', 'direct_message']
  };
  
  // Try sending the message
  try {
    chrome.runtime.sendMessage(testMessage, function(response) {
      console.log('🧪 MANUAL: Test message response:', response);
      alert('Test message sent with ID: ' + testId + '\nSee console for details');
    });
  } catch (error) {
    console.error('🧪 MANUAL: Error sending test message:', error);
    alert('Error sending test message: ' + error.message);
  }
};

// Add a button to the page for direct testing
function addTestButton() {
  // Check if button already exists
  if (document.getElementById('field-detection-test-button')) {
    return;
  }
  
  try {
    // Create a test button
    const testButton = document.createElement('button');
    testButton.id = 'field-detection-test-button';
    testButton.innerHTML = '🧪 Test Field Detection';
    testButton.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: #673ab7;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;
    
    testButton.addEventListener('click', function() {
      window.testFieldDetection();
    });
    
    document.body.appendChild(testButton);
    
    // Add a message test button
    const messageButton = document.createElement('button');
    messageButton.id = 'message-test-button';
    messageButton.innerHTML = '📨 Test Message';
    messageButton.style.cssText = `
      position: fixed;
      top: 10px;
      left: 190px;
      background: #2196f3;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;
    
    messageButton.addEventListener('click', function() {
      window.testMessagePassing();
    });
    
    document.body.appendChild(messageButton);
    console.log('🧪 MANUAL: Test buttons added to page');
  } catch (error) {
    console.error('🧪 MANUAL: Error adding test buttons:', error);
  }
}

// Initialize the debug tools
window.addEventListener('load', function() {
  console.log('🧪 INIT: Field detection debug script loaded');
  
  // Delay initialization to ensure everything is loaded
  setTimeout(() => {
    try {
      console.log('🧪 INIT: Initializing FieldDetectionDebug');
      window.FieldDetectionDebug.init();
      
      // Add test buttons after initialization
      console.log('🧪 INIT: Adding test buttons');
      addTestButton();
      
      // Alert that we've loaded (for testing)
      console.log('🧪 INIT: Debug tools initialized successfully');
      
      // Force a detection run after initialization
      setTimeout(() => {
        if (window.EnhancedFieldDetector) {
          console.log('🧪 INIT: Running initial field detection');
          window.EnhancedFieldDetector.detectFields();
        }
      }, 1000);
    } catch (error) {
      console.error('🧪 INIT: Error initializing debug tools:', error);
      alert('Error initializing field detection debug tools: ' + error.message);
    }
  }, 1000);
});