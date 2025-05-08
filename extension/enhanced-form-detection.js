/**
 * Enhanced Form Detection - Advanced form detection for challenging sites
 * Updated with improved table detection and text proximity analysis
 */

// Create namespace to avoid conflicts
window.EnhancedFormDetection = window.EnhancedFormDetection || {};

(function(namespace) {
  // Debug mode
  namespace.debugMode = true; // Default to true for troubleshooting

  /**
   * Log debug messages when debug mode is enabled
   */
  namespace.log = function(message, data = {}) {
    if (namespace.debugMode) {
      console.log(`🔍 Enhanced Form Detection: ${message}`, {
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  };
  
  /**
   * Log errors always
   */
  namespace.error = function(message, error = {}) {
    console.error(`❌ Enhanced Form Detection Error: ${message}`, {
      timestamp: new Date().toISOString(),
      error: error
    });
  };

  /**
   * Enable debug mode
   */
  namespace.enableDebug = function() {
    namespace.debugMode = true;
    namespace.log("Debug mode enabled");
  };
  
  /**
   * Main detection function that combines multiple strategies
   * Handles table-based forms and special test form patterns
   */
  namespace.detectAllForms = function() {
    const startTime = performance.now();
    namespace.log("Starting comprehensive form detection");
    
    let formData = {
      formId: 'form_' + Date.now(),
      fields: [],
      detectionMethod: 'comprehensive',
      formType: 'unknown',
      detectedAt: new Date().toISOString(),
      detectionDuration: 0
    };
    
    try {
      // 1. First try standard form detection
      const standardFields = detectStandardForms();
      if (standardFields && standardFields.length > 0) {
        namespace.log('Standard form detection successful', { fields: standardFields.length });
        formData.fields = standardFields;
        formData.detectionMethod = 'standard';
      } 
      // 2. If no standard forms, try table-based detection
      else {
        namespace.log('Standard detection failed, trying table detection');
        const tableFields = detectTableBasedForms();
        if (tableFields && tableFields.length > 0) {
          namespace.log('Table form detection successful', { fields: tableFields.length });
          formData.fields = tableFields;
          formData.detectionMethod = 'table';
        }
        // 3. Try detection using text proximity for common patterns
        else {
          namespace.log('Table detection failed, trying text proximity detection');
          const proximityFields = detectByTextProximity();
          if (proximityFields && proximityFields.length > 0) {
            namespace.log('Text proximity detection successful', { fields: proximityFields.length });
            formData.fields = proximityFields;
            formData.detectionMethod = 'proximity';
          }
          // 4. Fall back to modern frameworks detection
          else {
            const modernForms = namespace.detectModernFrameworkForms();
            if (modernForms && modernForms.length > 0) {
              const fields = extractFieldsFromModernForms(modernForms);
              if (fields.length > 0) {
                namespace.log('Modern framework detection successful', { fields: fields.length });
                formData.fields = fields;
                formData.detectionMethod = 'modern';
              }
            }
          }
        }
      }
      
      // Post-process the results
      formData.fields = deduplicateFields(formData.fields);
      formData.formType = classifyFormType(formData.fields);
      
      // Measure detection time
      const endTime = performance.now();
      formData.detectionDuration = Math.round(endTime - startTime);
      
      namespace.log('Form detection completed', {
        duration: formData.detectionDuration + 'ms',
        fields: formData.fields.length,
        method: formData.detectionMethod,
        type: formData.formType
      });
      
      return formData;
    } catch (error) {
      namespace.error('Error in comprehensive detection', error);
      
      const endTime = performance.now();
      return {
        formId: 'error_' + Date.now(),
        fields: [],
        error: error.message,
        detectionMethod: 'error',
        formType: 'unknown',
        detectedAt: new Date().toISOString(),
        detectionDuration: Math.round(endTime - startTime)
      };
    }
  };

  /**
   * Find forms in shadow DOM
   */
  namespace.findShadowDomForms = function() {
    namespace.log("Searching for shadow DOM forms");
    const shadowRoots = [];
    
    // Recursively walk the DOM to find shadow roots
    const walkNode = (node) => {
      if (node.shadowRoot) {
        shadowRoots.push(node.shadowRoot);
      }
      
      // Continue looking in child nodes
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 1) { // Element node
          walkNode(child);
        }
      });
    };
    
    // Start from body
    walkNode(document.body);
    
    // Find forms in shadow roots
    const shadowForms = [];
    shadowRoots.forEach(root => {
      // Find explicit forms
      const forms = Array.from(root.querySelectorAll('form'));
      
      // Find implicit forms (input clusters)
      const containers = Array.from(root.querySelectorAll('div, section, article'));
      const implicitForms = containers.filter(container => {
        const inputs = container.querySelectorAll('input, select, textarea');
        const buttons = container.querySelectorAll('button, input[type="submit"]');
        return inputs.length >= 2 && buttons.length > 0;
      });
      
      shadowForms.push(...forms, ...implicitForms);
    });
    
    namespace.log("Shadow DOM form detection", { count: shadowForms.length });
    return shadowForms;
  };

  /**
   * Detect forms built with modern frameworks (React, Vue, etc.)
   */
  namespace.detectModernFrameworkForms = function() {
    namespace.log("Searching for modern framework forms");
    
    // Common component patterns in modern frameworks
    const possibleFormElements = document.querySelectorAll(
      // Common class, ID, and data attribute patterns
      '[class*="form"], [class*="Form"], [data-testid*="form"], ' +
      '[id*="form"], [id*="Form"], ' +
      // Components with form-like structure but without form tags
      'div:has(input):has(button), ' +
      // Single page app patterns
      '[role="form"], [data-component*="form"], ' +
      // Framework-specific attributes
      '[ng-submit], [v-on:submit], [formGroup]'
    );
    
    const modernForms = [];
    possibleFormElements.forEach(el => {
      // Skip if already in a form element or already detected
      if (el.closest('form') || modernForms.some(form => form.contains(el) || el.contains(form))) {
        return;
      }
      
      // Check if this element has multiple inputs and a button
      const inputs = el.querySelectorAll('input, select, textarea');
      const buttons = el.querySelectorAll('button, [role="button"], input[type="submit"]');
      
      if (inputs.length >= 2 && buttons.length > 0) {
        modernForms.push(el);
      }
    });
    
    namespace.log("Modern framework form detection", { count: modernForms.length });
    return modernForms;
  };

  /**
   * Find forms in iframes
   */
  namespace.findIframeForms = function() {
    namespace.log("Searching for forms in iframes");
    const iframeForms = [];
    
    // Get all iframes
    const iframes = document.querySelectorAll('iframe');
    
    // Check each iframe
    iframes.forEach((iframe, index) => {
      try {
        // Try to access iframe content (same-origin policy applies)
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Find explicit forms
        const explicitForms = Array.from(iframeDoc.querySelectorAll('form'));
        
        // Find implicit forms in iframe
        const containers = Array.from(iframeDoc.querySelectorAll('div, section, article'));
        const implicitForms = containers.filter(container => {
          const inputs = container.querySelectorAll('input, select, textarea');
          const buttons = container.querySelectorAll('button, input[type="submit"]');
          return inputs.length >= 2 && buttons.length > 0;
        });
        
        // Collect all forms
        const allIframeForms = [...explicitForms, ...implicitForms];
        
        if (allIframeForms.length > 0) {
          namespace.log(`Found ${allIframeForms.length} forms in iframe #${index}`);
          
          // Push iframe reference with forms
          iframeForms.push({
            iframe: iframe,
            forms: allIframeForms
          });
        }
      } catch (error) {
        // Cross-origin iframe - we can't access it directly
        namespace.log(`Cannot access iframe #${index} (likely cross-origin)`);
      }
    });
    
    return iframeForms;
  };

  /**
   * Setup mutation observer to detect dynamically added forms
   */
  namespace.setupFormObserver = function(callback) {
    namespace.log("Setting up form mutation observer");
    
    const formObserver = new MutationObserver((mutations) => {
      let needsRescan = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          // Check if any added nodes contain forms
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { // Element node
              if (node.tagName === 'FORM' || 
                  (node.querySelector && (node.querySelector('form') || 
                                         (node.querySelector('input, select, textarea') && 
                                          node.querySelector('button, input[type="submit"]'))))) {
                needsRescan = true;
                break;
              }
            }
          }
        }
      });
      
      if (needsRescan) {
        namespace.log("DOM changes detected, rescanning for forms", {
          timestamp: new Date().toISOString()
        });
        // Call the callback function to rescan
        setTimeout(callback, 500);
      }
    });
    
    // Start observing the document
    formObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    return formObserver;
  };

  /**
   * Add floating indicator when debug mode is active
   */
  namespace.addDebugIndicator = function() {
    // Remove existing debug indicator if any
    const existing = document.querySelector('.enhanced-form-debug-indicator');
    if (existing) {
      existing.remove();
    }
    
    // Create a floating indicator
    const indicator = document.createElement('div');
    indicator.className = 'enhanced-form-debug-indicator';
    indicator.style.cssText = `
      position: fixed;
      bottom: 40px;
      left: 10px;
      background-color: rgba(45, 122, 255, 0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 10001;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      cursor: pointer;
    `;
    indicator.textContent = 'Enhanced Form Detection Active';
    
    // Add click handler to show more info
    indicator.addEventListener('click', () => {
      const formStats = namespace.getFormStats();
      alert('Enhanced Form Detection Stats:\n' + JSON.stringify(formStats, null, 2));
    });
    
    document.body.appendChild(indicator);
  };

  /**
   * Get statistics about detected forms
   */
  namespace.getFormStats = function() {
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input:not([type="hidden"])');
    const selects = document.querySelectorAll('select');
    const textareas = document.querySelectorAll('textarea');
    
    return {
      explicitForms: forms.length,
      inputElements: inputs.length,
      selectElements: selects.length,
      textareaElements: textareas.length,
      detectableForms: forms.length > 0 || (inputs.length + selects.length + textareas.length >= 2),
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
  };

  /**
   * Force form detection on problematic sites
   */
  namespace.forceFormDetection = function() {
    namespace.log("Force detecting forms on problematic site");
    
    // Combine all form detection methods for maximum coverage
    const explicitForms = Array.from(document.querySelectorAll('form'));
    const shadowForms = namespace.findShadowDomForms();
    const modernForms = namespace.detectModernFrameworkForms();
    const iframeForms = namespace.findIframeForms();
    
    // Combine all forms (except iframe forms which need special handling)
    const allForms = [...explicitForms, ...shadowForms, ...modernForms];
    
    namespace.log("Force detection results", {
      explicitForms: explicitForms.length,
      shadowForms: shadowForms.length,
      modernForms: modernForms.length,
      iframeForms: iframeForms.length,
      total: allForms.length + iframeForms.length
    });
    
    return {
      allForms,
      iframeForms
    };
  };
  
  /**
   * Detect standard form elements (the most common case)
   * @returns {Array} List of field objects
   */
  function detectStandardForms() {
    namespace.log('Starting standard form detection');
    
    const formElements = document.querySelectorAll('form');
    const fields = [];
    
    // If no forms, return empty array
    if (formElements.length === 0) {
      return [];
    }
    
    // Find the form with the most inputs
    let bestForm = null;
    let maxInputs = 0;
    
    for (const form of formElements) {
      const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
      if (inputs.length > maxInputs) {
        maxInputs = inputs.length;
        bestForm = form;
      }
    }
    
    if (!bestForm) {
      return [];
    }
    
    // Extract fields from the form
    const inputs = bestForm.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
    for (const input of inputs) {
      const fieldInfo = extractFieldInfo(input);
      if (fieldInfo) {
        fields.push(fieldInfo);
      }
    }
    
    return fields;
  }
  
  /**
   * Detect forms organized in tables (common in older websites)
   * @returns {Array} List of field objects
   */
  function detectTableBasedForms() {
    namespace.log('Starting table-based form detection');
    
    const tables = document.querySelectorAll('table');
    const fields = [];
    
    // Look for tables that might contain forms
    for (const table of tables) {
      // Look for inputs in table cells
      const inputs = table.querySelectorAll('input:not([type="hidden"]), select, textarea');
      if (inputs.length < 2) continue; // Skip tables with just one input
      
      namespace.log(`Examining table with ${inputs.length} potential inputs`);
      
      // Process each input
      inputs.forEach(input => {
        // Skip submit buttons and hidden fields
        if (input.type === 'submit' || input.type === 'button' || 
            input.type === 'hidden' || input.type === 'reset') {
          return;
        }
        
        // Get the containing cell
        const cell = input.closest('td');
        if (!cell) return;
        
        // Try to get label from previous cell
        let label = '';
        const row = cell.closest('tr');
        if (row) {
          const cells = Array.from(row.querySelectorAll('td'));
          const cellIndex = cells.indexOf(cell);
          if (cellIndex > 0) {
            label = cells[cellIndex - 1].textContent.trim();
            // Keep the colon for test forms that use "Username:" format
            // but fix capitalization if needed
            if (label.endsWith(':') && label.length > 1) {
              // Keep the colon but standardize capitalization
              const withoutColon = label.slice(0, -1).trim();
              const capitalized = withoutColon.charAt(0).toUpperCase() + 
                                 withoutColon.slice(1).toLowerCase();
              label = capitalized;
            }
          }
        }
        
        // Add field
        fields.push({
          name: input.name || input.id || '',
          id: input.id || '',
          type: input.type || input.tagName.toLowerCase(),
          label: label || input.placeholder || input.name || 'Field',
          required: input.required || input.getAttribute('aria-required') === 'true' || false,
          derivedType: deriveFieldType(input, label)
        });
      });
    }
    
    // Handle special case for login forms (common pattern)
    if (fields.length === 0) {
      const passwordFields = document.querySelectorAll('input[type="password"]');
      if (passwordFields.length === 1) {
        namespace.log('No table form found, but detected password field - checking for login form');
        
        const passwordField = passwordFields[0];
        const formContainer = passwordField.closest('form') || 
                            passwordField.closest('div') || 
                            passwordField.closest('fieldset');
        
        if (formContainer) {
          // Look for text/email inputs that could be username
          const userFields = formContainer.querySelectorAll('input[type="text"], input[type="email"]');
          
          if (userFields.length >= 1) {
            namespace.log('Detected login form pattern with username/password');
            
            // Add username field
            fields.push({
              name: userFields[0].name || userFields[0].id || 'username',
              id: userFields[0].id || '',
              type: userFields[0].type,
              label: 'Username',
              required: true,
              derivedType: 'username'
            });
            
            // Add password field
            fields.push({
              name: passwordField.name || passwordField.id || 'password',
              id: passwordField.id || '',
              type: 'password',
              label: 'Password',
              required: true,
              derivedType: 'password'
            });
          }
        }
      }
    }
    
    return fields;
  }
  
  /**
   * Detect form fields using text proximity analysis
   * Useful for forms that don't use standard label-for associations
   * @returns {Array} List of field objects
   */
  function detectByTextProximity() {
    namespace.log('Starting text proximity form detection');
    
    // Find all visible inputs
    const inputElements = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
    );
    
    // Skip if no inputs
    if (inputElements.length < 2) {
      return [];
    }
    
    // Check for Username/Password pattern specifically
    const passwordFields = Array.from(inputElements).filter(input => input.type === 'password');
    const usernameFields = Array.from(inputElements).filter(input => 
      input.type === 'text' || input.type === 'email' || 
      input.name?.toLowerCase().includes('user') || 
      input.id?.toLowerCase().includes('user')
    );
    
    // Collection for all detected fields
    const fields = [];
    
    // If we have password + text field, check for "Username:" and "Password:" patterns
    if (passwordFields.length === 1 && usernameFields.length >= 1) {
      // Find text that contains "Username:" or "Password:"
      const textWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      // Track the nearest matches
      let usernameLabel = null;
      let passwordLabel = null;
      let minUsernameDistance = 200; // Max pixel distance to consider
      let minPasswordDistance = 200;
      
      let node;
      while (node = textWalker.nextNode()) {
        const text = node.nodeValue.trim();
        if (!text) continue;
        
        // Check for Username: pattern
        const usernameMatch = text.match(/\b(username|user|login)\s*:/i);
        if (usernameMatch && usernameFields.length > 0) {
          // Get element positions
          const textRect = getTextNodeRect(node);
          
          // Check distance to each potential username field
          for (const usernameField of usernameFields) {
            const fieldRect = usernameField.getBoundingClientRect();
            const distance = getDistance(textRect, fieldRect);
            
            if (distance < minUsernameDistance) {
              minUsernameDistance = distance;
              usernameLabel = 'Username';
            }
          }
        }
        
        // Check for Password: pattern
        const passwordMatch = text.match(/\b(password|pass)\s*:/i);
        if (passwordMatch && passwordFields.length > 0) {
          // Get element positions
          const textRect = getTextNodeRect(node);
          
          // Check distance to each potential password field
          for (const passwordField of passwordFields) {
            const fieldRect = passwordField.getBoundingClientRect();
            const distance = getDistance(textRect, fieldRect);
            
            if (distance < minPasswordDistance) {
              minPasswordDistance = distance;
              passwordLabel = 'Password';
            }
          }
        }
      }
      
      // If we found at least one label, add the fields
      if (usernameLabel || passwordLabel) {
        namespace.log('Found login form via text proximity', {
          usernameDistance: minUsernameDistance,
          passwordDistance: minPasswordDistance
        });
        
        // Add username field if found
        if (usernameLabel && usernameFields.length > 0) {
          const usernameField = usernameFields[0];
          fields.push({
            name: usernameField.name || usernameField.id || 'username',
            id: usernameField.id || '',
            type: usernameField.type,
            label: usernameLabel,
            required: true,
            derivedType: 'username'
          });
        }
        
        // Add password field if found
        if (passwordLabel && passwordFields.length > 0) {
          const passwordField = passwordFields[0];
          fields.push({
            name: passwordField.name || passwordField.id || 'password',
            id: passwordField.id || '',
            type: 'password', 
            label: passwordLabel,
            required: true,
            derivedType: 'password'
          });
        }
      }
    }
    
    // If we didn't find fields through specific patterns, try generic approach
    if (fields.length === 0) {
      // Process each input to find nearby text
      for (const input of inputElements) {
        // Skip submit buttons and hidden fields
        if (input.type === 'submit' || input.type === 'button' || 
            input.type === 'hidden' || input.type === 'reset') {
          continue;
        }
        
        // Find the closest text node that could be a label
        const label = findNearestText(input);
        
        // Add field with the detected label
        fields.push({
          name: input.name || input.id || '',
          id: input.id || '',
          type: input.type || input.tagName.toLowerCase(),
          label: label || input.placeholder || input.name || 'Field',
          required: input.required || input.getAttribute('aria-required') === 'true' || false,
          derivedType: deriveFieldType(input, label)
        });
      }
    }
    
    return fields;
  }
  
  /**
   * Find the nearest text node that could be a label for an input
   */
  function findNearestText(input) {
    // First try standard label
    if (input.id) {
      const labelEl = document.querySelector(`label[for="${input.id}"]`);
      if (labelEl) {
        return labelEl.textContent.trim();
      }
    }
    
    // If input is inside a label
    if (input.parentElement && input.parentElement.tagName === 'LABEL') {
      return input.parentElement.textContent.replace(input.value || '', '').trim();
    }
    
    // Try to find nearby text
    const inputRect = input.getBoundingClientRect();
    const textWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let closestText = '';
    let minDistance = 150; // Max pixel distance to consider
    
    let node;
    while (node = textWalker.nextNode()) {
      const text = node.nodeValue.trim();
      if (!text || text.length < 2) continue;
      
      // Skip if this text node is inside the input
      if (node.parentNode === input || input.contains(node.parentNode)) {
        continue;
      }
      
      // Get positions
      const textRect = getTextNodeRect(node);
      const distance = getDistance(textRect, inputRect);
      
      // Keep the closest text
      if (distance < minDistance) {
        minDistance = distance;
        closestText = text;
      }
    }
    
    // Clean up the text
    if (closestText) {
      // Remove trailing colon if present
      if (closestText.endsWith(':')) {
        closestText = closestText.slice(0, -1).trim();
      }
      
      // Limit length
      if (closestText.length > 30) {
        closestText = closestText.substring(0, 30) + '...';
      }
      
      // Capitalize first letter
      closestText = closestText.charAt(0).toUpperCase() + closestText.slice(1);
    }
    
    return closestText;
  }
  
  /**
   * Get the bounding rectangle for a text node
   */
  function getTextNodeRect(node) {
    try {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect();
    } catch (error) {
      // Fallback for cases where we can't get the rect
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    }
  }
  
  /**
   * Calculate distance between two DOM rectangles
   */
  function getDistance(rect1, rect2) {
    // Calculate centers
    const center1 = {
      x: rect1.left + rect1.width / 2,
      y: rect1.top + rect1.height / 2
    };
    
    const center2 = {
      x: rect2.left + rect2.width / 2,
      y: rect2.top + rect2.height / 2
    };
    
    // Return distance between centers
    return Math.sqrt(
      Math.pow(center1.x - center2.x, 2) +
      Math.pow(center1.y - center2.y, 2)
    );
  }
  
  /**
   * Extract field information from an input element
   */
  function extractFieldInfo(input) {
    const name = input.name || '';
    const id = input.id || '';
    const type = input.type || input.tagName.toLowerCase();
    let label = '';
    
    // Skip if no identifiable info
    if (!name && !id) {
      return null;
    }
    
    // Try to find a label
    if (id) {
      const labelElement = document.querySelector(`label[for="${id}"]`);
      if (labelElement) {
        label = labelElement.textContent.trim();
      }
    }
    
    // Check for parent label
    if (!label && input.parentElement && input.parentElement.tagName === 'LABEL') {
      label = input.parentElement.textContent.replace(input.value || '', '').trim();
    }
    
    // Fallback to placeholder or name
    if (!label) {
      label = input.placeholder || name;
      
      // Clean up the label
      if (label) {
        label = label.replace(/[-_]/g, ' ')
                .replace(/([a-z])([A-Z])/g, '$1 $2'); // Convert camelCase to spaces
      
        // Capitalize first letter
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
    }
    
    return {
      name: name,
      id: id,
      type: type,
      label: label || 'Field',
      required: input.required || input.getAttribute('aria-required') === 'true' || false,
      derivedType: deriveFieldType(input, label)
    };
  }
  
  /**
   * Derive field type from attributes
   */
  function deriveFieldType(input, label) {
    // Use the HTML type if sufficient
    if (input.type === 'email') return 'email';
    if (input.type === 'password') return 'password';
    if (input.type === 'tel') return 'phone';
    
    // Check name and id for keywords
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const labelText = (label || '').toLowerCase();
    
    // Username fields
    if (name.includes('user') || id.includes('user') || 
        name.includes('login') || id.includes('login') ||
        labelText.includes('username') || labelText.includes('user name')) {
      return 'username';
    }
    
    // Email fields
    if (name.includes('email') || id.includes('email') || 
        labelText.includes('email') || labelText.includes('e-mail')) {
      return 'email';
    }
    
    // Password fields
    if (name.includes('pass') || id.includes('pass') || 
        labelText.includes('password') || labelText.includes('pass word')) {
      return 'password';
    }
    
    // Name fields
    if (name.includes('name') || id.includes('name') || labelText.includes('name')) {
      if (name.includes('first') || id.includes('first') || labelText.includes('first')) {
        return 'firstName';
      }
      if (name.includes('last') || id.includes('last') || labelText.includes('last')) {
        return 'lastName';
      }
      return 'name';
    }
    
    // Default to text
    return 'text';
  }
  
  /**
   * Remove duplicate fields
   */
  function deduplicateFields(fields) {
    const uniqueFields = [];
    const seen = new Map();
    
    fields.forEach(field => {
      // Create a unique key from name, id, and label
      const key = [
        field.name || '',
        field.id || '',
        field.type || ''
      ].join('|');
      
      if (!seen.has(key)) {
        seen.set(key, true);
        uniqueFields.push(field);
      }
    });
    
    return uniqueFields;
  }
  
  /**
   * Classify form type based on fields
   */
  function classifyFormType(fields) {
    if (!fields || fields.length === 0) {
      return 'unknown';
    }
    
    // Get field types
    const fieldTypes = fields.map(f => f.derivedType);
    
    // Login form: password + username/email
    if (fieldTypes.includes('password') && 
        (fieldTypes.includes('username') || fieldTypes.includes('email')) &&
        fields.length <= 4) {
      return 'login';
    }
    
    // Registration form: password, confirmPassword, plus email or username
    if (fieldTypes.includes('password') && 
        fieldTypes.filter(t => t === 'password').length > 1 &&
        (fieldTypes.includes('email') || fieldTypes.includes('username'))) {
      return 'registration';
    }
    
    // Contact form: email and message
    if (fieldTypes.includes('email') && fields.some(f => f.type === 'textarea')) {
      return 'contact';
    }
    
    // Address form: address fields
    if ((fieldTypes.includes('address') || fieldTypes.includes('city') || 
         fieldTypes.includes('state') || fieldTypes.includes('zip'))) {
      return 'address';
    }
    
    // Search form: 1-2 fields with search in name
    if (fields.length <= 2 && fields.some(f => 
        f.name?.toLowerCase().includes('search') || 
        f.id?.toLowerCase().includes('search') ||
        f.label?.toLowerCase().includes('search'))) {
      return 'search';
    }
    
    // Default to generic form
    return 'form';
  }
  
  /**
   * Extract fields from modern framework forms
   */
  function extractFieldsFromModernForms(forms) {
    const fields = [];
    
    forms.forEach(form => {
      const inputs = form.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
      );
      
      inputs.forEach(input => {
        const field = extractFieldInfo(input);
        if (field) {
          fields.push(field);
        }
      });
    });
    
    return fields;
  }

})(window.EnhancedFormDetection);

// Initialize when script loads
console.log("🟢 Enhanced Form Detection loaded with improved table detection and text proximity analysis");