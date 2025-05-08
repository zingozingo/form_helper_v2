/**
 * Utility script for loading test forms directly into the current page
 * This helps with testing the FormQualityAnalyzer without needing to switch tabs
 */

// Create a test controls container
function createTestControls() {
  // Check if controls already exist
  if (document.getElementById('form-helper-test-controls')) {
    return;
  }
  
  // Create container
  const container = document.createElement('div');
  container.id = 'form-helper-test-controls';
  container.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 10px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 9999;
    font-family: Arial, sans-serif;
    max-width: 300px;
  `;
  
  // Add title
  const title = document.createElement('h3');
  title.textContent = 'Form Helper Test Controls';
  title.style.margin = '0 0 10px 0';
  container.appendChild(title);
  
  // Add threshold slider
  const thresholdLabel = document.createElement('label');
  thresholdLabel.textContent = 'Form Quality Threshold: ';
  thresholdLabel.for = 'test-threshold-slider';
  container.appendChild(thresholdLabel);
  
  const thresholdValue = document.createElement('span');
  thresholdValue.id = 'test-threshold-value';
  thresholdValue.textContent = '65';
  container.appendChild(thresholdValue);
  
  const thresholdSlider = document.createElement('input');
  thresholdSlider.type = 'range';
  thresholdSlider.id = 'test-threshold-slider';
  thresholdSlider.min = '0';
  thresholdSlider.max = '100';
  thresholdSlider.value = '65';
  thresholdSlider.style.width = '100%';
  thresholdSlider.style.margin = '10px 0';
  container.appendChild(thresholdSlider);
  
  // Apply button
  const applyButton = document.createElement('button');
  applyButton.textContent = 'Apply Threshold';
  applyButton.style.cssText = `
    background: #4285f4;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 5px;
  `;
  container.appendChild(applyButton);
  
  // Scan button
  const scanButton = document.createElement('button');
  scanButton.textContent = 'Rescan Forms';
  scanButton.style.cssText = `
    background: #0f9d58;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
  `;
  container.appendChild(scanButton);
  
  // Results
  const results = document.createElement('div');
  results.id = 'test-results';
  results.style.marginTop = '10px';
  results.style.fontSize = '12px';
  results.style.maxHeight = '300px';
  results.style.overflow = 'auto';
  results.style.padding = '5px';
  results.style.border = '1px solid #ddd';
  results.style.borderRadius = '4px';
  results.style.backgroundColor = '#f9f9f9';
  container.appendChild(results);
  
  // Minimize button
  const minimizeButton = document.createElement('button');
  minimizeButton.textContent = '-';
  minimizeButton.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  `;
  container.appendChild(minimizeButton);
  
  // Add to page
  document.body.appendChild(container);
  
  // Event handlers
  thresholdSlider.addEventListener('input', function() {
    thresholdValue.textContent = this.value;
  });
  
  applyButton.addEventListener('click', function() {
    const newThreshold = parseInt(thresholdSlider.value);
    if (window.extensionSettings) {
      window.extensionSettings.formQualityThreshold = newThreshold;
      updateResults(`Threshold updated to ${newThreshold}`);
    } else {
      updateResults('Error: Extension settings not found');
    }
  });
  
  scanButton.addEventListener('click', function() {
    if (typeof detectForms === 'function') {
      detectForms();
      updateResults('Forms rescanned with new threshold');
    } else {
      updateResults('Error: detectForms function not found');
    }
  });
  
  minimizeButton.addEventListener('click', function() {
    if (container.style.height === '30px') {
      container.style.height = 'auto';
      minimizeButton.textContent = '-';
      results.style.display = 'block';
      thresholdSlider.style.display = 'block';
      applyButton.style.display = 'inline-block';
      scanButton.style.display = 'inline-block';
      thresholdLabel.style.display = 'inline';
    } else {
      container.style.height = '30px';
      minimizeButton.textContent = '+';
      results.style.display = 'none';
      thresholdSlider.style.display = 'none';
      applyButton.style.display = 'none';
      scanButton.style.display = 'none';
      thresholdLabel.style.display = 'none';
    }
  });
}

// Update results in the test controls
function updateResults(message) {
  const results = document.getElementById('test-results');
  if (results) {
    const timestamp = new Date().toLocaleTimeString();
    results.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    results.scrollTop = results.scrollHeight;
  }
}

// Function to analyze all forms on the page and show results
function analyzeAllForms() {
  if (!window.FormQualityAnalyzer) {
    updateResults('Error: FormQualityAnalyzer not found');
    return;
  }
  
  const analyzer = new FormQualityAnalyzer();
  const forms = document.querySelectorAll('form');
  updateResults(`Found ${forms.length} forms on the page`);
  
  forms.forEach((form, index) => {
    try {
      // Extract fields
      const fields = Array.from(form.querySelectorAll('input, select, textarea'))
        .filter(input => !['submit', 'button', 'image', 'reset', 'hidden'].includes(input.type))
        .map(input => ({
          type: input.type || input.tagName.toLowerCase(),
          name: input.name || '',
          id: input.id || '',
          placeholder: input.placeholder || '',
          required: input.hasAttribute('required'),
          hasLabel: !!document.querySelector(`label[for="${input.id}"]`) || 
                   !!input.closest('label')
        }));
      
      // Analyze form
      const result = analyzer.analyzeForm(form, fields, {
        threshold: window.extensionSettings?.formQualityThreshold || 65
      });
      
      // Update results
      updateResults(`Form #${index+1} (${form.id || 'unnamed'}):`);
      updateResults(`- Score: ${result.score}`);
      updateResults(`- Type: ${result.formType}`);
      updateResults(`- Legitimate: ${result.isLegitimateForm ? 'Yes' : 'No'}`);
      if (result.exclusionReason) {
        updateResults(`- Excluded as: ${result.exclusionReason}`);
      }
      updateResults('---');
    } catch (error) {
      updateResults(`Error analyzing form #${index+1}: ${error.message}`);
    }
  });
}

// Initialize
createTestControls();
updateResults('Test controls loaded');
updateResults('Click "Rescan Forms" to analyze forms on this page');

// Export functions
window.formHelperTest = {
  analyzeAllForms,
  updateResults
};