/**
 * Panel Debug Integration
 * Adds debug mode and field confirmation features to the panel
 */

// Debug mode state
let debugModeActive = false;
let fieldConfirmations = new Map();
let confidenceThreshold = 0.4; // Default threshold

// Field learning system
const fieldLearningSystem = {
  // Store confirmed patterns
  confirmedPatterns: {},
  
  // Load saved patterns from storage
  loadPatterns: function() {
    chrome.storage.local.get(['fieldPatterns'], function(result) {
      if (result.fieldPatterns) {
        fieldLearningSystem.confirmedPatterns = result.fieldPatterns;
        console.log('Loaded saved field patterns:', 
          Object.keys(fieldLearningSystem.confirmedPatterns).length);
      }
    });
  },
  
  // Save patterns to storage
  savePatterns: function() {
    chrome.storage.local.set({
      'fieldPatterns': fieldLearningSystem.confirmedPatterns
    }, function() {
      console.log('Saved field patterns to storage');
    });
  },
  
  // Confirm a field detection
  confirmField: function(field) {
    console.log('Confirming field:', field);
    
    // Create pattern key from field attributes
    const patternKey = createPatternKey(field);
    
    // Store or update the pattern
    if (!fieldLearningSystem.confirmedPatterns[patternKey]) {
      fieldLearningSystem.confirmedPatterns[patternKey] = {
        confirmCount: 1,
        lastConfirmed: new Date().toISOString(),
        fieldType: field.type,
        derivedType: field.derivedType,
        examples: [field]
      };
    } else {
      // Update existing pattern
      const pattern = fieldLearningSystem.confirmedPatterns[patternKey];
      pattern.confirmCount++;
      pattern.lastConfirmed = new Date().toISOString();
      
      // Only store up to 5 examples
      if (pattern.examples.length < 5) {
        pattern.examples.push(field);
      }
    }
    
    // Track this confirmation for the current session
    fieldConfirmations.set(field.id || field.name, true);
    
    // Save to storage
    fieldLearningSystem.savePatterns();
    
    return fieldLearningSystem.confirmedPatterns[patternKey];
  },
  
  // Check if a field matches known patterns
  checkFieldPattern: function(field) {
    const patternKey = createPatternKey(field);
    return fieldLearningSystem.confirmedPatterns[patternKey] || null;
  },
  
  // Apply learned patterns to boost confidence of matching fields
  applyLearnedPatterns: function(fields) {
    return fields.map(field => {
      const pattern = fieldLearningSystem.checkFieldPattern(field);
      
      if (pattern) {
        // Found a match - boost confidence based on confirmation count
        const boostFactor = Math.min(0.3, 0.1 * Math.log2(pattern.confirmCount + 1));
        
        // Apply boost but don't exceed 1.0
        const oldConfidence = field.confidence || 0.5;
        field.confidence = Math.min(1.0, oldConfidence + boostFactor);
        
        // Add learned status
        field.learnedPattern = true;
        field.confirmCount = pattern.confirmCount;
      }
      
      return field;
    });
  }
};

// Helper to create a pattern key from field attributes
function createPatternKey(field) {
  // Use combination of attributes as pattern key
  const nameKey = (field.name || '').toLowerCase().replace(/[0-9]/g, '#');
  const idKey = (field.id || '').toLowerCase().replace(/[0-9]/g, '#');
  const typeKey = field.type || 'text';
  const labelKey = (field.label || '').toLowerCase()
    .replace(/[0-9]/g, '#')
    .replace(/[a-zA-Z]{20,}/g, 'longword'); // normalize long words
  
  return `${typeKey}|${nameKey}|${idKey}|${labelKey}`;
}

// Create debug UI for the panel
function createDebugUI() {
  if (document.getElementById('debug-panel-container')) {
    return; // Already created
  }
  
  const container = document.createElement('div');
  container.id = 'debug-panel-container';
  container.className = 'debug-panel-container';
  container.style.display = 'none'; // Start hidden
  
  // Add debug panel header
  const header = document.createElement('div');
  header.className = 'debug-panel-header';
  header.innerHTML = `
    <h3>Debug Mode: Field Detection</h3>
    <div class="debug-actions">
      <button id="apply-debug-results" class="debug-button primary">Apply & Return</button>
      <button id="close-debug-panel" class="debug-button">Close</button>
    </div>
  `;
  container.appendChild(header);
  
  // Add threshold adjustment
  const thresholdContainer = document.createElement('div');
  thresholdContainer.className = 'threshold-container';
  thresholdContainer.innerHTML = `
    <label for="confidence-threshold">Confidence Threshold: <span id="threshold-value">0.4</span></label>
    <input type="range" id="confidence-threshold" min="0.1" max="0.9" step="0.05" value="0.4">
    <button id="apply-threshold" class="debug-button small">Apply</button>
  `;
  container.appendChild(thresholdContainer);
  
  // Add tabs for different views
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'debug-tabs';
  tabsContainer.innerHTML = `
    <div class="tab active" data-tab="fields">Fields</div>
    <div class="tab" data-tab="raw">Raw Data</div>
    <div class="tab" data-tab="learning">Learning</div>
    <div class="tab" data-tab="messages">Messages</div>
  `;
  container.appendChild(tabsContainer);
  
  // Add tab content containers
  const tabContent = document.createElement('div');
  tabContent.className = 'tab-content';
  
  // Fields tab (default view)
  const fieldsTab = document.createElement('div');
  fieldsTab.id = 'fields-tab';
  fieldsTab.className = 'tab-pane active';
  fieldsTab.innerHTML = `
    <div class="field-stats">
      <div>Detected: <span id="detected-count">0</span></div>
      <div>Filtered: <span id="filtered-count">0</span></div>
      <div>Confirmed: <span id="confirmed-count">0</span></div>
    </div>
    <div id="debug-fields-list" class="debug-fields-list">
      <div class="loading-message">Running field detection...</div>
    </div>
  `;
  tabContent.appendChild(fieldsTab);
  
  // Raw data tab
  const rawTab = document.createElement('div');
  rawTab.id = 'raw-tab';
  rawTab.className = 'tab-pane';
  rawTab.innerHTML = `
    <div class="raw-data-container">
      <textarea id="raw-data-display" readonly></textarea>
    </div>
  `;
  tabContent.appendChild(rawTab);
  
  // Learning tab
  const learningTab = document.createElement('div');
  learningTab.id = 'learning-tab';
  learningTab.className = 'tab-pane';
  learningTab.innerHTML = `
    <div class="learning-stats">
      <div>Saved Patterns: <span id="patterns-count">0</span></div>
      <div>Total Confirmations: <span id="total-confirmations">0</span></div>
    </div>
    <div id="learning-patterns-list" class="learning-patterns-list">
      <div class="loading-message">Loading saved patterns...</div>
    </div>
  `;
  tabContent.appendChild(learningTab);
  
  // Messages tab
  const messagesTab = document.createElement('div');
  messagesTab.id = 'messages-tab';
  messagesTab.className = 'tab-pane';
  messagesTab.innerHTML = `
    <div class="messages-container">
      <div id="message-log" class="message-log">
        <div class="loading-message">Monitoring messages...</div>
      </div>
    </div>
  `;
  tabContent.appendChild(messagesTab);
  
  container.appendChild(tabContent);
  
  // Add debugging controls at the bottom
  const debugControls = document.createElement('div');
  debugControls.className = 'debug-controls';
  debugControls.innerHTML = `
    <button id="test-detection" class="debug-button">Re-run Detection</button>
    <button id="test-message" class="debug-button">Test Message Passing</button>
    <button id="save-learning" class="debug-button">Save Learning Data</button>
  `;
  container.appendChild(debugControls);
  
  // Add CSS for debug panel
  const style = document.createElement('style');
  style.textContent = `
    .debug-panel-container {
      background: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 8px;
      margin-top: 10px;
      overflow: hidden;
      font-size: 13px;
    }
    
    .debug-panel-header {
      background: #4285F4;
      color: white;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .debug-panel-header h3 {
      margin: 0;
      font-size: 16px;
    }
    
    .debug-actions {
      display: flex;
      gap: 8px;
    }
    
    .debug-button {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      background: rgba(255,255,255,0.3);
      color: white;
    }
    
    .debug-button.primary {
      background: #34A853;
    }
    
    .debug-button.small {
      font-size: 11px;
      padding: 2px 6px;
    }
    
    .debug-button:hover {
      background: rgba(255,255,255,0.4);
    }
    
    .debug-button.primary:hover {
      background: #2E8F49;
    }
    
    .threshold-container {
      padding: 10px;
      background: #eee;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    #confidence-threshold {
      flex-grow: 1;
    }
    
    .debug-tabs {
      display: flex;
      border-bottom: 1px solid #ddd;
    }
    
    .tab {
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 3px solid transparent;
    }
    
    .tab.active {
      border-bottom-color: #4285F4;
      font-weight: bold;
    }
    
    .tab-content {
      max-height: 300px;
      overflow-y: auto;
    }
    
    .tab-pane {
      display: none;
      padding: 10px;
    }
    
    .tab-pane.active {
      display: block;
    }
    
    .field-stats, .learning-stats {
      display: flex;
      justify-content: space-around;
      background: #e9ecef;
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 10px;
      font-weight: bold;
    }
    
    .debug-fields-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .debug-field-item {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 8px;
      background: white;
    }
    
    .debug-field-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .debug-field-name {
      font-weight: bold;
    }
    
    .confidence-badge {
      padding: 2px 6px;
      border-radius: 3px;
      color: white;
      font-size: 11px;
    }
    
    .debug-field-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: #666;
    }
    
    .debug-field-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
    }
    
    .debug-field-button {
      padding: 3px 6px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      background: #f1f3f4;
      font-size: 11px;
    }
    
    .debug-field-button.confirm {
      background: #34A853;
      color: white;
    }
    
    .debug-field-button.reject {
      background: #EA4335;
      color: white;
    }
    
    .debug-field-button.confirmed {
      background: #ceead6;
      color: #1e8e3e;
      cursor: default;
    }
    
    .raw-data-container {
      height: 250px;
    }
    
    #raw-data-display {
      width: 100%;
      height: 100%;
      font-family: monospace;
      font-size: 12px;
      border: 1px solid #ddd;
      padding: 8px;
      background: #f5f5f5;
    }
    
    .learning-patterns-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .pattern-item {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 8px;
      background: white;
    }
    
    .pattern-header {
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .pattern-stats {
      font-size: 12px;
      color: #666;
    }
    
    .message-log {
      font-family: monospace;
      font-size: 11px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      height: 250px;
      overflow-y: auto;
      padding: 8px;
    }
    
    .message-entry {
      margin-bottom: 4px;
      border-bottom: 1px dotted #ddd;
      padding-bottom: 4px;
    }
    
    .message-time {
      color: #666;
    }
    
    .message-direction {
      display: inline-block;
      padding: 0 4px;
      border-radius: 3px;
      margin: 0 4px;
    }
    
    .message-outgoing {
      background: #e1f5fe;
    }
    
    .message-incoming {
      background: #f1f8e9;
    }
    
    .debug-controls {
      padding: 10px;
      background: #eee;
      display: flex;
      justify-content: space-around;
    }
    
    .loading-message {
      text-align: center;
      color: #666;
      padding: 20px;
      font-style: italic;
    }
    
    /* Field highlight animation */
    @keyframes highlight-pulse {
      0% { background-color: rgba(66, 133, 244, 0.1); }
      50% { background-color: rgba(66, 133, 244, 0.3); }
      100% { background-color: rgba(66, 133, 244, 0.1); }
    }
    
    .field-highlight {
      animation: highlight-pulse 2s infinite;
    }
  `;
  document.head.appendChild(style);
  
  // Add to main container
  document.querySelector('.container').appendChild(container);
  
  // Setup event listeners for the debug panel
  setupDebugPanelListeners();
  
  return container;
}

// Setup event listeners for debug panel controls
function setupDebugPanelListeners() {
  // Tab switching
  document.querySelectorAll('.debug-tabs .tab').forEach(tab => {
    tab.addEventListener('click', function() {
      // Remove active class from all tabs and panes
      document.querySelectorAll('.debug-tabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding pane
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab') + '-tab';
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Close debug panel
  document.getElementById('close-debug-panel').addEventListener('click', function() {
    toggleDebugMode(false);
  });
  
  // Apply debug results
  document.getElementById('apply-debug-results').addEventListener('click', function() {
    applyDebugResults();
    toggleDebugMode(false);
  });
  
  // Threshold slider
  const thresholdSlider = document.getElementById('confidence-threshold');
  const thresholdValue = document.getElementById('threshold-value');
  
  thresholdSlider.addEventListener('input', function() {
    thresholdValue.textContent = this.value;
  });
  
  // Apply threshold button
  document.getElementById('apply-threshold').addEventListener('click', function() {
    confidenceThreshold = parseFloat(thresholdSlider.value);
    console.log('Applied new confidence threshold:', confidenceThreshold);
    
    // Re-filter fields with new threshold
    if (window.currentFormData && window.currentFormData.fields) {
      applyConfidenceFilter(window.currentFormData.fields);
    }
  });
  
  // Re-run detection button
  document.getElementById('test-detection').addEventListener('click', function() {
    runFieldDetection();
  });
  
  // Test message passing button
  document.getElementById('test-message').addEventListener('click', function() {
    testMessagePassing();
  });
  
  // Save learning data button
  document.getElementById('save-learning').addEventListener('click', function() {
    fieldLearningSystem.savePatterns();
    updateLearningTab();
  });
}

// Apply confidence threshold filter to fields
function applyConfidenceFilter(fields) {
  // First apply any learned patterns to boost confidence
  const enhancedFields = fieldLearningSystem.applyLearnedPatterns(fields);
  
  // Filter by confidence threshold
  const filteredFields = enhancedFields.filter(field => {
    return (field.confidence || 0) >= confidenceThreshold;
  });
  
  console.log(`Applied confidence filter (${confidenceThreshold}): ${filteredFields.length} of ${fields.length} fields kept`);
  
  // Update the debug UI with new counts
  updateFieldStats(fields.length, filteredFields.length);
  
  // Redraw the fields list with new data
  renderDebugFieldsList(enhancedFields, filteredFields);
  
  return filteredFields;
}

// Toggle debug mode
function toggleDebugMode(enable) {
  console.log('🐞 UI: Toggling debug mode:', enable);
  
  try {
    let debugPanel = document.getElementById('debug-panel-container');
    if (!debugPanel) {
      console.log('🐞 UI: Debug panel not found, creating it');
      debugPanel = createDebugUI();
      
      // Double check it was created
      if (!debugPanel) {
        console.error('🐞 ERROR: Failed to create debug panel');
        alert('ERROR: Failed to create debug panel - see console for details');
        return;
      }
    }
    
    // Check if the panel is in the DOM
    if (!document.body.contains(debugPanel)) {
      console.warn('🐞 WARN: Debug panel exists but not in DOM, re-adding it');
      document.querySelector('.container').appendChild(debugPanel);
    }
    
    debugModeActive = enable;
    console.log('🐞 UI: Debug mode set to:', debugModeActive);
    
    if (enable) {
      // Force panel to be visible with important styles
      debugPanel.style.cssText = `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 10000 !important;
        position: relative !important;
        margin-top: 20px !important;
        border: 3px solid #4285F4 !important;
      `;
      console.log('🐞 UI: Debug panel display set to:', debugPanel.style.display);
      
      // Log the panel's status in the DOM
      console.log('🐞 UI: Debug panel in DOM:', document.body.contains(debugPanel));
      console.log('🐞 UI: Debug panel clientHeight:', debugPanel.clientHeight);
      console.log('🐞 UI: Debug panel offsetHeight:', debugPanel.offsetHeight);
      
      // Initialize debug panel with current data
      if (window.currentFormData && window.currentFormData.fields) {
        console.log('🐞 UI: Updating panel with current form data');
        updateDebugPanelWithFormData(window.currentFormData);
      } else {
        // No current data, run detection
        console.log('🐞 UI: No current form data, running detection');
        runFieldDetection();
      }
      
      // Load learning data
      console.log('🐞 UI: Loading field learning patterns');
      fieldLearningSystem.loadPatterns();
      updateLearningTab();
      
      // Start message monitoring
      console.log('🐞 UI: Starting message monitoring');
      startMessageMonitoring();
      
      // Alert that debug panel should be visible
      console.log('🐞 UI: Debug panel should now be visible');
      
      // Add an emergency fix if panel seems hidden
      setTimeout(() => {
        const visibleHeight = debugPanel.offsetHeight;
        if (!visibleHeight || visibleHeight < 10) {
          console.warn('🐞 UI: Debug panel may be hidden (height check). Trying emergency fix...');
          // Force recreate the panel
          document.body.removeChild(debugPanel);
          const newPanel = createDebugUI();
          newPanel.style.cssText = `
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 10000 !important;
            position: fixed !important;
            top: 50px !important;
            right: 10px !important;
            width: 80% !important;
            height: 80% !important;
            background: white !important;
            border: 5px solid red !important;
            overflow: auto !important;
          `;
          
          // Alert about emergency panel
          alert('Emergency debug panel created - check fixed position panel');
        }
      }, 1000);
    } else {
      debugPanel.style.display = 'none';
      console.log('🐞 UI: Debug panel hidden');
    }
  } catch (error) {
    console.error('🐞 ERROR in toggleDebugMode:', error);
    alert('Error toggling debug mode: ' + error.message);
    
    // Last resort emergency panel
    try {
      const emergencyPanel = document.createElement('div');
      emergencyPanel.id = 'emergency-debug-panel';
      emergencyPanel.innerHTML = '<h3>EMERGENCY DEBUG PANEL</h3><p>The regular debug panel failed to load.</p>';
      emergencyPanel.style.cssText = `
        position: fixed !important;
        top: 50px !important;
        right: 10px !important;
        width: 300px !important;
        height: 400px !important;
        background: white !important;
        border: 5px solid red !important;
        z-index: 99999 !important;
        padding: 20px !important;
        overflow: auto !important;
      `;
      document.body.appendChild(emergencyPanel);
      console.log('🐞 UI: Created emergency debug panel as last resort');
    } catch (e) {
      console.error('🐞 FATAL: Even emergency panel failed:', e);
    }
  }
}

// Run field detection
function runFieldDetection() {
  // Clear current field list
  document.getElementById('debug-fields-list').innerHTML = '<div class="loading-message">Running field detection...</div>';
  
  // Request a field scan from the content script
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'fullFormScan',
        forceDetect: true,
        debug: true
      }, function(response) {
        console.log('Field detection response:', response);
        
        if (response && response.success && response.formData) {
          updateDebugPanelWithFormData(response.formData);
        } else {
          document.getElementById('debug-fields-list').innerHTML = 
            '<div class="loading-message">No field data received from content script.</div>';
        }
      });
    }
  });
}

// Update debug panel with form data
function updateDebugPanelWithFormData(formData) {
  console.log('Updating debug panel with form data:', formData);
  
  // Save reference to current form data
  window.currentFormData = formData;
  
  // Update raw data tab
  document.getElementById('raw-data-display').value = JSON.stringify(formData, null, 2);
  
  // Process and display fields
  if (formData.fields && formData.fields.length > 0) {
    // Apply confidence filter
    const filteredFields = applyConfidenceFilter(formData.fields);
    
    // Update field count in main panel header
    updateMainPanelFieldCount(filteredFields.length);
  } else {
    document.getElementById('debug-fields-list').innerHTML = 
      '<div class="loading-message">No fields in form data.</div>';
    
    updateFieldStats(0, 0);
  }
}

// Render the fields list in the debug panel
function renderDebugFieldsList(allFields, filteredFields) {
  const fieldsList = document.getElementById('debug-fields-list');
  fieldsList.innerHTML = ''; // Clear current list
  
  // Track which fields have been confirmed
  updateConfirmedCount();
  
  // Sort fields by confidence (highest first)
  allFields.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  
  // Create set of filtered field IDs for quick lookup
  const filteredFieldIds = new Set(filteredFields.map(f => f.id || f.name));
  
  // Add field items to the list
  allFields.forEach(field => {
    const fieldItem = document.createElement('div');
    fieldItem.className = 'debug-field-item';
    
    // Highlight fields that pass the filter
    if (filteredFieldIds.has(field.id || field.name)) {
      fieldItem.classList.add('field-highlight');
    }
    
    // Determine confidence color
    const confidence = field.confidence || 0;
    let confidenceColor = '#999'; // Default gray
    
    if (confidence >= 0.7) {
      confidenceColor = '#34A853'; // Green for high confidence
    } else if (confidence >= 0.5) {
      confidenceColor = '#FBBC05'; // Yellow for medium confidence
    } else if (confidence >= confidenceThreshold) {
      confidenceColor = '#4285F4'; // Blue for threshold passing
    } else {
      confidenceColor = '#EA4335'; // Red for below threshold
    }
    
    // Check if this field has been confirmed
    const isConfirmed = fieldConfirmations.has(field.id || field.name);
    
    // Create field item content
    const fieldHeader = document.createElement('div');
    fieldHeader.className = 'debug-field-header';
    
    const fieldName = document.createElement('div');
    fieldName.className = 'debug-field-name';
    fieldName.textContent = field.label || field.name || field.id || 'Unknown Field';
    fieldHeader.appendChild(fieldName);
    
    const confidenceBadge = document.createElement('div');
    confidenceBadge.className = 'confidence-badge';
    confidenceBadge.style.backgroundColor = confidenceColor;
    confidenceBadge.textContent = confidence.toFixed(2);
    fieldHeader.appendChild(confidenceBadge);
    
    fieldItem.appendChild(fieldHeader);
    
    // Field details
    const fieldDetails = document.createElement('div');
    fieldDetails.className = 'debug-field-details';
    
    fieldDetails.innerHTML = `
      <div>Name: ${field.name || 'N/A'} | ID: ${field.id || 'N/A'}</div>
      <div>Type: ${field.type || 'text'} | Derived: ${field.derivedType || 'text'}</div>
      <div>Method: ${field.detectionMethod || 'unknown'}</div>
      ${field.learnedPattern ? `<div>Learned Pattern: ${field.confirmCount} confirmations</div>` : ''}
    `;
    
    fieldItem.appendChild(fieldDetails);
    
    // Field actions
    const fieldActions = document.createElement('div');
    fieldActions.className = 'debug-field-actions';
    
    if (isConfirmed) {
      // Already confirmed
      const confirmedButton = document.createElement('button');
      confirmedButton.className = 'debug-field-button confirmed';
      confirmedButton.textContent = '✓ Confirmed';
      confirmedButton.disabled = true;
      fieldActions.appendChild(confirmedButton);
    } else {
      // Confirm button
      const confirmButton = document.createElement('button');
      confirmButton.className = 'debug-field-button confirm';
      confirmButton.textContent = 'Confirm Field';
      confirmButton.addEventListener('click', function() {
        fieldLearningSystem.confirmField(field);
        renderDebugFieldsList(allFields, filteredFields); // Re-render the list
      });
      fieldActions.appendChild(confirmButton);
      
      // Reject button
      const rejectButton = document.createElement('button');
      rejectButton.className = 'debug-field-button reject';
      rejectButton.textContent = 'Reject';
      rejectButton.addEventListener('click', function() {
        // Mark as rejected by setting confidence to 0
        field.confidence = 0;
        fieldItem.style.opacity = '0.5';
        rejectButton.disabled = true;
        confirmButton.disabled = true;
      });
      fieldActions.appendChild(rejectButton);
    }
    
    // Highlight button
    const highlightButton = document.createElement('button');
    highlightButton.className = 'debug-field-button';
    highlightButton.textContent = 'Highlight on Page';
    highlightButton.addEventListener('click', function() {
      highlightFieldOnPage(field);
    });
    fieldActions.appendChild(highlightButton);
    
    fieldItem.appendChild(fieldActions);
    fieldsList.appendChild(fieldItem);
  });
  
  // If no fields, show message
  if (allFields.length === 0) {
    fieldsList.innerHTML = '<div class="loading-message">No fields detected.</div>';
  }
}

// Update field statistics
function updateFieldStats(totalCount, filteredCount) {
  document.getElementById('detected-count').textContent = totalCount;
  document.getElementById('filtered-count').textContent = filteredCount;
  updateConfirmedCount();
}

// Update confirmed count
function updateConfirmedCount() {
  document.getElementById('confirmed-count').textContent = fieldConfirmations.size;
}

// Update learning tab with current patterns
function updateLearningTab() {
  const patternsList = document.getElementById('learning-patterns-list');
  const patterns = fieldLearningSystem.confirmedPatterns;
  const patternKeys = Object.keys(patterns);
  
  // Update stats
  document.getElementById('patterns-count').textContent = patternKeys.length;
  
  let totalConfirmations = 0;
  patternKeys.forEach(key => {
    totalConfirmations += patterns[key].confirmCount;
  });
  document.getElementById('total-confirmations').textContent = totalConfirmations;
  
  // Clear current list
  patternsList.innerHTML = '';
  
  // If no patterns, show message
  if (patternKeys.length === 0) {
    patternsList.innerHTML = '<div class="loading-message">No saved patterns yet.</div>';
    return;
  }
  
  // Sort patterns by confirmation count (highest first)
  patternKeys
    .sort((a, b) => patterns[b].confirmCount - patterns[a].confirmCount)
    .slice(0, 20) // Only show top 20
    .forEach(key => {
      const pattern = patterns[key];
      
      const patternItem = document.createElement('div');
      patternItem.className = 'pattern-item';
      
      const patternHeader = document.createElement('div');
      patternHeader.className = 'pattern-header';
      patternHeader.textContent = `${pattern.derivedType || pattern.fieldType || 'Unknown'} (${pattern.confirmCount} confirmations)`;
      patternItem.appendChild(patternHeader);
      
      const patternStats = document.createElement('div');
      patternStats.className = 'pattern-stats';
      patternStats.innerHTML = `
        <div>Type: ${pattern.fieldType || 'unknown'}</div>
        <div>Last confirmed: ${new Date(pattern.lastConfirmed).toLocaleString()}</div>
        <div>Examples: ${pattern.examples.length}</div>
      `;
      patternItem.appendChild(patternStats);
      
      patternsList.appendChild(patternItem);
    });
}

// Start monitoring message passing
function startMessageMonitoring() {
  const messageLog = document.getElementById('message-log');
  messageLog.innerHTML = ''; // Clear log
  
  // Setup message tracking
  trackMessagePassing();
}

// Track message passing between panel and content script
function trackMessagePassing() {
  // This is mostly informational as we can't directly intercept messages
  // But we can show what messages the panel is sending and receiving
  
  // Add a log entry to the message log
  function addMessageLogEntry(direction, action, details) {
    const messageLog = document.getElementById('message-log');
    
    const entry = document.createElement('div');
    entry.className = 'message-entry';
    
    const time = new Date().toLocaleTimeString();
    
    entry.innerHTML = `
      <span class="message-time">${time}</span>
      <span class="message-direction message-${direction}">${direction}</span>
      <span class="message-action">${action}</span>
      ${details ? `<span class="message-details">${details}</span>` : ''}
    `;
    
    messageLog.appendChild(entry);
    messageLog.scrollTop = messageLog.scrollHeight; // Auto-scroll to bottom
  }
  
  // Add initial entry
  addMessageLogEntry('system', 'Message monitoring started');
  
  // Add test message button
  const testBtn = document.getElementById('test-message');
  if (testBtn) {
    testBtn.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          const testMsg = {
            action: 'testMessage',
            message: 'Panel debug test message',
            timestamp: Date.now()
          };
          
          addMessageLogEntry('outgoing', 'testMessage', 'Debug test message');
          
          chrome.tabs.sendMessage(tabs[0].id, testMsg, function(response) {
            addMessageLogEntry('incoming', 'response', JSON.stringify(response));
          });
        }
      });
    });
  }
}

// Test message passing
function testMessagePassing() {
  // Send a test message to content script
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      console.log('Sending test message to content script');
      
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'testMessage',
        message: 'Testing message passing from panel to content script',
        timestamp: Date.now()
      }, function(response) {
        console.log('Test message response:', response);
      });
    }
  });
}

// Highlight a field on the page
function highlightFieldOnPage(field) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'highlightField',
        fieldName: field.name || field.id,
        duration: 3000 // Highlight for 3 seconds
      });
    }
  });
}

// Apply debug results to main panel
function applyDebugResults() {
  // Get filtered fields based on current threshold
  const filteredFields = window.currentFormData?.fields.filter(field => {
    // Apply learned patterns first
    const pattern = fieldLearningSystem.checkFieldPattern(field);
    if (pattern) {
      // Found a match - boost confidence based on confirmation count
      const boostFactor = Math.min(0.3, 0.1 * Math.log2(pattern.confirmCount + 1));
      field.confidence = Math.min(1.0, (field.confidence || 0.5) + boostFactor);
    }
    
    // Include confirmed fields automatically
    if (fieldConfirmations.has(field.id || field.name)) {
      return true;
    }
    
    // Otherwise apply threshold
    return (field.confidence || 0) >= confidenceThreshold;
  });
  
  // If we have filtered fields, update main panel
  if (filteredFields && filteredFields.length > 0) {
    // Update the current form data with filtered fields
    const updatedFormData = {
      ...window.currentFormData,
      fields: filteredFields,
      detectionStats: {
        ...(window.currentFormData?.detectionStats || {}),
        filteredCount: filteredFields.length,
        confidenceThreshold: confidenceThreshold
      }
    };
    
    // Update main panel
    applyFieldsToMainPanel(updatedFormData);
    
    // Save confidence threshold to storage
    chrome.storage.local.set({ confidenceThreshold: confidenceThreshold });
    
    console.log('Applied filtered fields to main panel:', filteredFields.length);
  }
}

// Function to apply fields to the main panel
function applyFieldsToMainPanel(formData) {
  if (!formData || !formData.fields) return;
  
  console.log('Applying fields to main panel:', formData.fields.length);
  
  // Set the current form data
  window.currentFormData = formData;
  
  // Get display functions from the main panel script
  if (typeof displayFields === 'function') {
    // Direct function call if available
    displayFields(formData.fields);
    
    // Update field count
    if (typeof updateFieldCount === 'function') {
      updateFieldCount(formData.fields.length);
    }
    
    // Update welcome message if available
    if (typeof updateWelcomeMessage === 'function') {
      updateWelcomeMessage(formData);
    }
  } else {
    console.log('Using custom form data application');
    
    // Find field grid
    const fieldGrid = document.getElementById('field-grid');
    if (!fieldGrid) {
      console.error('Could not find field grid element');
      return;
    }
    
    // Clear existing fields
    fieldGrid.innerHTML = '';
    
    // Add each field as a pill
    formData.fields.slice(0, 6).forEach(field => {
      const fieldPill = document.createElement('div');
      fieldPill.className = `field-pill ${field.required ? 'required' : 'optional'}`;
      fieldPill.dataset.fieldId = field.id || field.name;
      
      // Determine icon 
      let iconName = 'text_fields'; // Default
      
      // Map field types to icons
      const typeToIcon = {
        'username': 'person',
        'email': 'email',
        'password': 'lock',
        'confirmPassword': 'lock',
        'name': 'person',
        'phone': 'phone',
        'checkbox': 'check_box',
        'radio': 'radio_button_checked',
        'file': 'attach_file',
        'select': 'arrow_drop_down',
        'textarea': 'short_text'
      };
      
      if (typeToIcon[field.derivedType]) {
        iconName = typeToIcon[field.derivedType];
      } else if (typeToIcon[field.type]) {
        iconName = typeToIcon[field.type];
      }
      
      // Set pill content
      fieldPill.innerHTML = `
        <i class="material-icons field-icon">${iconName}</i>
        <span class="field-text">${field.label || 'Field'}</span>
      `;
      
      // Add to grid
      fieldGrid.appendChild(fieldPill);
    });
    
    // Update field count
    const fieldCount = document.getElementById('field-count');
    if (fieldCount) {
      fieldCount.textContent = `(${formData.fields.length})`;
    }
  }
  
  // Add notification message
  const messages = document.getElementById('messages');
  if (messages) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message ai-message';
    messageElement.innerHTML = `
      <div class="message-bubble">I've updated the form fields from debug mode. Now showing ${formData.fields.length} fields.</div>
    `;
    messages.appendChild(messageElement);
    
    // Scroll chat
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
}

// Update main panel field count
function updateMainPanelFieldCount(count) {
  const fieldCount = document.getElementById('field-count');
  if (fieldCount) {
    fieldCount.textContent = `(${count})`;
  }
}

// Add debug toggle button to main panel
function addDebugToggleButton() {
  // Check if button already exists
  if (document.getElementById('debug-toggle-button')) {
    console.log('🐞 UI: Debug toggle button already exists, skipping creation');
    return;
  }
  
  console.log('🐞 UI: Creating debug toggle button');
  
  try {
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'debug-toggle-container';
    buttonContainer.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 9999;
    `;
    
    // Create debug toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'debug-toggle-button';
    toggleButton.innerHTML = '🐞';
    toggleButton.title = 'Toggle Debug Mode';
    toggleButton.style.cssText = `
      background: #f0f0f0;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      padding: 4px 8px;
      opacity: 0.9;
      z-index: 9999;
    `;
    
    // Add hover effect
    toggleButton.onmouseover = () => { 
      toggleButton.style.opacity = '1';
      toggleButton.style.background = '#e0e0e0';
    };
    toggleButton.onmouseout = () => {
      toggleButton.style.opacity = '0.9';
      toggleButton.style.background = '#f0f0f0';
    };
    
    // Add click handler
    toggleButton.addEventListener('click', function() {
      console.log('🐞 UI: Debug toggle button clicked');
      toggleDebugMode(!debugModeActive);
    });
    
    buttonContainer.appendChild(toggleButton);
    
    // Add to header - try multiple selectors
    const header = document.querySelector('.header') || document.querySelector('header');
    
    if (header) {
      console.log('🐞 UI: Found header element to attach button:', header);
      header.style.position = 'relative'; // Ensure positioning context
      header.appendChild(buttonContainer);
      console.log('🐞 UI: Toggle button added to header');
    } else {
      // Try fallbacks
      console.warn('🐞 UI: Header not found, trying fallbacks');
      const container = document.querySelector('.container');
      
      if (container) {
        console.log('🐞 UI: Adding button to container');
        container.style.position = 'relative'; // Ensure positioning context
        container.appendChild(buttonContainer);
      } else {
        // Emergency fallback - add to body
        console.warn('🐞 UI: Container not found, adding to document body');
        document.body.appendChild(buttonContainer);
        
        // Position the button in top right corner
        buttonContainer.style.position = 'fixed';
        buttonContainer.style.top = '10px';
        buttonContainer.style.right = '10px';
      }
    }
    
    // Create an emergency floating button
    const emergencyButton = document.createElement('button');
    emergencyButton.id = 'emergency-debug-button';
    emergencyButton.innerHTML = '🐞 DEBUG';
    emergencyButton.title = 'Emergency Debug Toggle';
    emergencyButton.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: #ff5722;
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
    
    emergencyButton.addEventListener('click', function() {
      console.log('🐞 UI: Emergency debug button clicked');
      toggleDebugMode(true);
      
      // Remove the emergency button after click
      document.body.removeChild(emergencyButton);
    });
    
    document.body.appendChild(emergencyButton);
    console.log('🐞 UI: Emergency debug button added to document body');
    
    // Log DOM after adding to verify
    setTimeout(() => {
      console.log('🐞 UI: Checking if button exists in DOM:', document.getElementById('debug-toggle-button'));
      console.log('🐞 UI: Emergency button in DOM:', document.getElementById('emergency-debug-button'));
    }, 100);
    
    return toggleButton;
  } catch (error) {
    console.error('🐞 ERROR creating debug toggle button:', error);
    
    // Emergency recovery - create a global function that can be called from console
    window.showDebugPanel = function() {
      alert('Showing debug panel via emergency function');
      toggleDebugMode(true);
    };
    
    console.log('🐞 RECOVERY: Created global window.showDebugPanel() function for emergency use');
    return null;
  }
}

// Listen for message from content script
function setupMessageListener() {
  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('Debug panel received message:', message);
    
    // Handle different message types
    if (message.action === 'debugFieldDetection') {
      // Update debug panel with fields from content script
      if (message.fields) {
        console.log('Received', message.fields.length, 'fields from content script');
        
        // Create form data structure if needed
        const formData = {
          formId: message.formId || 'debug_form_' + Date.now(),
          fields: message.fields,
          formType: message.formType || 'unknown',
          detectionMethod: 'debug',
          detectionMethods: message.methods || ['debug']
        };
        
        // Update debug panel if active
        if (debugModeActive) {
          updateDebugPanelWithFormData(formData);
        }
        
        // Store in current form data for later use
        window.currentFormData = formData;
      }
      
      // Send response
      sendResponse({ success: true, debugActive: debugModeActive });
      return true;
    }
    
    // Default response
    sendResponse({ success: true });
    return true;
  });
}

// Function to request field detection from content script
function requestFieldDetection() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'runDebugFieldDetection',
        debug: true
      }, function(response) {
        console.log('Field detection response:', response);
      });
    }
  });
}

// Initialize debug integration
function initializeDebugIntegration() {
  console.log('🐞 INIT: Initializing panel debug integration');
  
  try {
    // Add debug toggle button to panel
    console.log('🐞 INIT: Adding debug toggle button');
    addDebugToggleButton();
    
    // Preload debug UI (hidden)
    console.log('🐞 INIT: Creating debug UI');
    const debugUI = createDebugUI();
    console.log('🐞 INIT: Debug UI created:', debugUI);
    
    // Log DOM structure to verify elements exist
    console.log('🐞 INIT: Debug panel container in DOM:', document.getElementById('debug-panel-container'));
    console.log('🐞 INIT: Debug toggle button in DOM:', document.getElementById('debug-toggle-button'));
    
    // Set up message listener
    console.log('🐞 INIT: Setting up message listener');
    setupMessageListener();
    
    // Load saved confidence threshold
    console.log('🐞 INIT: Loading saved confidence threshold');
    chrome.storage.local.get(['confidenceThreshold'], function(result) {
      if (result.confidenceThreshold) {
        confidenceThreshold = result.confidenceThreshold;
        console.log('🐞 INIT: Loaded saved confidence threshold:', confidenceThreshold);
        
        // Update the threshold slider
        const thresholdSlider = document.getElementById('confidence-threshold');
        const thresholdValue = document.getElementById('threshold-value');
        console.log('🐞 INIT: Threshold UI elements:', { slider: thresholdSlider, value: thresholdValue });
        
        if (thresholdSlider && thresholdValue) {
          thresholdSlider.value = confidenceThreshold;
          thresholdValue.textContent = confidenceThreshold;
        } else {
          console.error('🐞 ERROR: Threshold slider or value elements not found in DOM');
        }
      }
    });
    
    // Initialize field learning system
    console.log('🐞 INIT: Initializing field learning system');
    fieldLearningSystem.loadPatterns();
    
    // Request field detection from content script after a delay
    console.log('🐞 INIT: Setting timeout for field detection request');
    setTimeout(requestFieldDetection, 1000);
    
    // TESTING: Force show debug panel immediately for testing
    console.log('🐞 INIT: Force showing debug panel for testing');
    setTimeout(() => {
      console.log('🐞 TEST: Forcing debug panel visibility');
      toggleDebugMode(true);
      
      // Verify debug panel is visible
      const debugPanel = document.getElementById('debug-panel-container');
      console.log('🐞 TEST: Debug panel after force show:', debugPanel);
      console.log('🐞 TEST: Debug panel visibility:', debugPanel ? debugPanel.style.display : 'element not found');
      
      // Alert for visual confirmation
      alert('Debug panel should now be visible. Check the console for details.');
    }, 2000);
    
  } catch (error) {
    console.error('🐞 CRITICAL ERROR in debug integration initialization:', error);
    alert('Error initializing debug integration: ' + error.message);
  }
}

// Export functions for use in panel.js
window.PanelDebugIntegration = {
  initializeDebugIntegration,
  toggleDebugMode,
  updateDebugPanelWithFormData,
  fieldLearningSystem,
  applyDebugResults,
  requestFieldDetection,
  confidenceThreshold
};

// Add a load listener to initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit to ensure panel.js has initialized
  setTimeout(initializeDebugIntegration, 500);
});