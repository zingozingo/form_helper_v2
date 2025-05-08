/**
 * Enhanced content script integration for field detection
 * This file solves the issue with field counting in the panel
 */

// Store the original sendMessage function
const originalSendMessage = chrome.runtime.sendMessage;

// Override chrome.runtime.sendMessage to debug all messages
chrome.runtime.sendMessage = function(message, callback) {
  console.log('🔄 INTERCEPTED MESSAGE:', message);
  
  // Check for formDetected message to debug
  if (message.action === 'formDetected' && message.formData) {
    console.log('🔎 Field count in formDetected message:', message.formData.fields?.length || 0);
    
    // Log deep data about fields for debugging
    if (message.formData.fields && message.formData.fields.length > 0) {
      console.log('🔎 First 3 fields:', message.formData.fields.slice(0, 3));
    } else {
      console.log('⚠️ NO FIELDS in message!');
    }
    
    // Ensure fields is an array
    if (!Array.isArray(message.formData.fields)) {
      console.error('⚠️ fields is not an array:', message.formData.fields);
      message.formData.fields = [];
    }
  }
  
  // Call the original function
  return originalSendMessage.call(chrome.runtime, message, function(response) {
    console.log('🔄 RESPONSE:', response);
    if (callback) callback(response);
  });
};

// Function to fix field detection integration
function fixFieldDetection() {
  console.log('🔧 Field detection integration fix loaded');
  
  // Fix for detection-panel integration
  const originalProcessEnhancedFieldDetectorResults = window.processEnhancedFieldDetectorResults;
  
  if (typeof originalProcessEnhancedFieldDetectorResults === 'function') {
    console.log('🔍 Found processEnhancedFieldDetectorResults function, applying fix');
    
    // Override the function to ensure fields are properly passed
    window.processEnhancedFieldDetectorResults = function(detectorResults) {
      console.log('🔧 Running fixed processEnhancedFieldDetectorResults');
      
      // First run the original function
      const results = originalProcessEnhancedFieldDetectorResults(detectorResults);
      
      // Log the results
      console.log('📊 AFTER ORIGINAL PROCESSING:', {
        fields: results.fields?.length || 0,
        formId: results.formId,
        formType: results.formType
      });
      
      // Ensure results is valid and fields is an array
      if (!results) {
        console.error('⚠️ Original function returned null/undefined results');
        return {
          formId: 'error_form_' + Date.now(),
          formType: 'unknown',
          fields: [],
          formContext: {
            form_type: "error form",
            description: "Error in results processing",
            confidence: 0
          }
        };
      }
      
      // Ensure fields array exists and has items
      if (!Array.isArray(results.fields)) {
        console.error('⚠️ Original function returned non-array fields:', results.fields);
        results.fields = [];
      }
      
      // If we had detection results but ended up with no fields, this is likely a bug
      if (detectorResults && detectorResults.fields && 
          detectorResults.fields.length > 0 && 
          results.fields.length === 0) {
        console.warn('⚠️ Original detector had fields but results has none - using original fields');
        
        // Copy the original fields as a fallback
        results.fields = detectorResults.fields.map(field => ({
          name: field.name || field.id || 'field_' + Math.random().toString(36).substring(2, 10),
          id: field.id || '',
          type: field.type || 'text',
          label: field.label || 'Field',
          required: field.required || false,
          derivedType: field.derivedType || 'text',
          confidence: field.confidence || 0.5,
          detectionMethod: field.detectionMethod || "enhanced"
        }));
      }
      
      // Now explicitly send the message to the panel to ensure it's received
      setTimeout(() => {
        console.log('🚀 SENDING FIXED FORM DATA with', results.fields.length, 'fields');
        
        chrome.runtime.sendMessage({
          action: 'formDetected',
          formData: results
        }, response => {
          console.log('🚀 FIXED message response:', response);
        });
      }, 500);
      
      return results;
    };
  } else {
    console.warn('⚠️ Could not find processEnhancedFieldDetectorResults function');
  }
  
  // Add a fix for the panel's form detection handler
  window.addEventListener('message', function(event) {
    // Only handle messages from our extension
    if (event.source !== window) return;
    if (!event.data || !event.data.type) return;
    
    // Check for special debug messages
    if (event.data.type === 'DEBUG_FIELD_COUNT') {
      console.log('📊 DEBUG FIELD COUNT:', event.data.count);
      
      // Force a field detection run
      if (window.EnhancedFieldDetector && window.EnhancedFieldDetector.detectFields) {
        console.log('🔄 Running field detection due to debug message');
        const results = window.EnhancedFieldDetector.detectFields();
        
        if (results && results.fields) {
          if (typeof window.processEnhancedFieldDetectorResults === 'function') {
            const formData = window.processEnhancedFieldDetectorResults(results);
            
            console.log('📨 Sending formDetected message with', formData.fields.length, 'fields');
            chrome.runtime.sendMessage({
              action: 'formDetected',
              formData: formData
            });
          }
        }
      }
    }
  });
  
  // Patch the detectForms function to ensure it always sends the data to the panel
  if (typeof window.detectForms === 'function') {
    console.log('🔍 Found detectForms function, applying patch');
    
    const originalDetectForms = window.detectForms;
    
    window.detectForms = function() {
      console.log('🔧 Running patched detectForms');
      
      // Run the original function
      const result = originalDetectForms.apply(this, arguments);
      
      // After a delay, ensure we have sent field data to the panel
      setTimeout(() => {
        // Only run enhanced detection if we have the detector
        if (window.EnhancedFieldDetector && window.EnhancedFieldDetector.detectFields) {
          console.log('🔄 Running backup field detection');
          
          const results = window.EnhancedFieldDetector.detectFields();
          
          if (results && results.fields && results.fields.length > 0) {
            console.log('📊 Backup detection found', results.fields.length, 'fields');
            
            if (typeof window.processEnhancedFieldDetectorResults === 'function') {
              const formData = window.processEnhancedFieldDetectorResults(results);
              
              console.log('📨 Sending backup formDetected message with', formData.fields.length, 'fields');
              chrome.runtime.sendMessage({
                action: 'formDetected',
                formData: formData
              });
            }
          }
        }
      }, 1000);
      
      return result;
    };
  }
  
  // Patch the global field count to ensure proper detection
  // This function will be called periodically to check field count
  function checkAndUpdateFieldCount() {
    console.log('🔍 Checking field count');
    
    // Count form fields on the page
    const allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
    
    if (allInputs.length > 0) {
      console.log('🔍 Found', allInputs.length, 'potential form fields on page');
      
      // Check if we've previously detected fields
      if (window.lastDetectedFieldCount === undefined || window.lastDetectedFieldCount < allInputs.length) {
        window.lastDetectedFieldCount = allInputs.length;
        
        // Force field detection
        if (window.EnhancedFieldDetector && window.EnhancedFieldDetector.detectFields) {
          console.log('🔄 Running field detection due to new fields');
          const results = window.EnhancedFieldDetector.detectFields();
          
          if (results && results.fields) {
            if (typeof window.processEnhancedFieldDetectorResults === 'function') {
              const formData = window.processEnhancedFieldDetectorResults(results);
              
              console.log('📨 Sending formDetected message with', formData.fields.length, 'fields');
              chrome.runtime.sendMessage({
                action: 'formDetected',
                formData: formData
              });
            }
          }
        }
      }
    }
  }
  
  // Run the check once after load and then periodically
  setTimeout(checkAndUpdateFieldCount, 1500);
  setInterval(checkAndUpdateFieldCount, 5000);
  
  // Add manual field detection runner button (only in debug mode)
  if (window.debugMode) {
    const debugButton = document.createElement('button');
    debugButton.style.cssText = `
      position: fixed;
      bottom: 60px;
      right: 20px;
      padding: 10px 15px;
      background-color: #ff5722;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      z-index: 10000;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;
    debugButton.textContent = 'Run Field Detection';
    debugButton.onclick = function() {
      if (window.EnhancedFieldDetector && window.EnhancedFieldDetector.detectFields) {
        console.log('🔄 Manually running field detection');
        const results = window.EnhancedFieldDetector.detectFields();
        
        if (results && results.fields) {
          if (typeof window.processEnhancedFieldDetectorResults === 'function') {
            const formData = window.processEnhancedFieldDetectorResults(results);
            
            console.log('📨 Sending manual formDetected message with', formData.fields.length, 'fields');
            chrome.runtime.sendMessage({
              action: 'formDetected',
              formData: formData
            });
          }
        }
      } else {
        alert('EnhancedFieldDetector not available!');
      }
    };
    document.body.appendChild(debugButton);
  }
}

// Run the fix function after the page loads
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(fixFieldDetection, 1000);
} else {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(fixFieldDetection, 1000);
  });
}