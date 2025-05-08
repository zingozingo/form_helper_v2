/**
 * Enhanced Field Detector for AI Form Helper
 * Provides accurate form field detection with validation and pattern recognition
 * - Improved error handling
 * - Multiple detection methods (explicit forms, ARIA roles, visual heuristics)
 * - Performance optimizations and caching
 * - Detailed logging for debugging
 */

// Create namespace to avoid conflicts
window.FieldDetector = window.FieldDetector || {};

// Set up debug logging - set to true to see detailed logs
window.FieldDetector.debug = {
  enabled: true, // Enable debug logging by default for troubleshooting
  log: function(message, data) {
    if (this.enabled) {
      console.log(`[FieldDetector] ${message}`, data || '');
    }
  },
  error: function(message, error) {
    // Always log errors regardless of debug mode
    console.error(`[FieldDetector Error] ${message}`, error || '');
  },
  warn: function(message, data) {
    // Always log warnings regardless of debug mode
    console.warn(`[FieldDetector Warning] ${message}`, data || '');
  },
  time: function(label) {
    if (this.enabled) {
      console.time(`[FieldDetector] ${label}`);
    }
  },
  timeEnd: function(label) {
    if (this.enabled) {
      console.timeEnd(`[FieldDetector] ${label}`);
    }
  },
  // Add a method to log the state of detection
  state: function(stage, data) {
    if (this.enabled) {
      console.info(`[FieldDetector Stage: ${stage}]`, data || '');
    }
  }
};

(function(ns) {
  // Configuration
  ns.config = {
    // Field type patterns for accurate detection
    fieldPatterns: {
      username: [
        /username/i, /user[_-]?name/i, /user[_-]?id/i, /login[_-]?id/i,
        /account[_-]?name/i, /account[_-]?id/i
      ],
      email: [
        /email/i, /e[_-]?mail/i, /mail/i
      ],
      password: [
        /password/i, /pass[_-]?word/i, /pwd/i, /passwd/i
      ],
      confirmPassword: [
        /confirm[_-]?password/i, /password[_-]?confirm/i, 
        /verify[_-]?password/i, /password[_-]?verify/i,
        /password[_-]?again/i, /re[_-]?password/i
      ],
      firstName: [
        /first[_-]?name/i, /given[_-]?name/i, /first/i, /fname/i
      ],
      lastName: [
        /last[_-]?name/i, /family[_-]?name/i, /surname/i, /lname/i
      ],
      name: [
        /full[_-]?name/i, /your[_-]?name/i, /name/i
      ],
      phone: [
        /phone/i, /telephone/i, /tel/i, /mobile/i, /cell[_-]?phone/i
      ],
      address: [
        /address/i, /addr/i, /street/i
      ],
      city: [
        /city/i, /town/i
      ],
      state: [
        /state/i, /province/i, /region/i
      ],
      zip: [
        /zip/i, /postal[_-]?code/i, /post[_-]?code/i, /zip[_-]?code/i
      ],
      country: [
        /country/i, /nation/i
      ],
      creditCard: [
        /credit[_-]?card/i, /card[_-]?number/i, /cc[_-]?number/i, 
        /card[_-]?#/i, /cc[_-]?#/i
      ],
      expiry: [
        /expir/i, /exp[_-]?date/i, /expiration/i
      ],
      cvv: [
        /cvv/i, /cvc/i, /cv2/i, /security[_-]?code/i, /card[_-]?verification/i
      ]
    },
    
    // Form type patterns for form classification
    formTypes: {
      login: {
        requiredFields: ['username|email', 'password'],
        optionalFields: ['remember', 'captcha'],
        keywords: ['login', 'sign in', 'signin', 'log in']
      },
      registration: {
        requiredFields: ['username|email', 'password', 'confirm-password|password-confirm'],
        optionalFields: ['name', 'first-name', 'last-name', 'phone', 'terms', 'newsletter'],
        keywords: ['register', 'sign up', 'signup', 'create account', 'join']
      },
      contact: {
        requiredFields: ['name|email'],
        optionalFields: ['subject', 'message', 'phone', 'company'],
        keywords: ['contact', 'message us', 'get in touch', 'inquiry']
      },
      checkout: {
        requiredFields: ['name|email|credit-card|card-number'],
        optionalFields: ['address', 'city', 'state', 'zip', 'country', 'phone'],
        keywords: ['checkout', 'payment', 'order', 'purchase', 'buy']
      },
      address: {
        requiredFields: ['name|address'],
        optionalFields: ['address2', 'city', 'state', 'zip', 'country', 'phone'],
        keywords: ['address', 'shipping', 'billing', 'delivery']
      },
      search: {
        requiredFields: ['search|query|keywords'],
        optionalFields: ['category', 'filter'],
        keywords: ['search', 'find', 'lookup']
      }
    }
  };
  
  /**
   * Core function to scan a page for form fields with validation
   * @returns {Object} Detected form data with fields and metadata
   */
  ns.scanForFields = function() {
    console.time('fieldDetection');
    
    // Always clear the cache and perform a fresh scan each time
    ns.cachedFormData = null;
    
    // Get all form elements and input elements on the page
    const formElements = document.querySelectorAll('form');
    const allInputElements = document.querySelectorAll('input, select, textarea');
    
    // Filter out hidden, submit, button, and reset inputs
    const inputElements = Array.from(allInputElements).filter(input => {
      const inputType = input.type?.toLowerCase() || '';
      return !['hidden', 'submit', 'button', 'reset'].includes(inputType);
    });
    
    // Log detection stats
    ns.debug.log('Starting comprehensive form detection', {
      formElements: formElements.length,
      inputElements: inputElements.length,
      allInputs: allInputElements.length
    });
    
    // Start with form detection
    let formData = {
      formId: 'form_' + Date.now(),
      formType: 'unknown',
      formAction: '',
      formMethod: 'post',
      formName: '',
      fields: [],
      pageMeta: {
        title: document.title,
        url: window.location.href
      },
      detectionMethod: 'fresh-detection',
      detectionTime: new Date().toISOString()
    };
    
    // Try multiple detection strategies
    
    // 1. First try to get fields from explicit form elements
    if (formElements.length > 0) {
      ns.debug.log('Trying to extract fields from explicit form elements');
      
      // Find the form with the most input fields
      let bestFormIndex = 0;
      let maxInputCount = 0;
      
      formElements.forEach((form, index) => {
        const formInputs = form.querySelectorAll('input, select, textarea');
        const inputCount = Array.from(formInputs).filter(input => {
          const inputType = input.type?.toLowerCase() || '';
          return !['hidden', 'submit', 'button', 'reset'].includes(inputType);
        }).length;
        
        if (inputCount > maxInputCount) {
          maxInputCount = inputCount;
          bestFormIndex = index;
        }
      });
      
      const bestForm = formElements[bestFormIndex];
      
      // Extract form metadata
      formData.formId = bestForm.id || 'form_' + Date.now();
      formData.formAction = bestForm.action || '';
      formData.formMethod = bestForm.method || 'post';
      formData.formName = bestForm.name || '';
      
      // Extract fields from the best form
      const formFields = extractFields(bestForm);
      
      if (formFields.length > 0) {
        ns.debug.log(`Found ${formFields.length} fields in explicit form`, {
          formId: formData.formId
        });
        formData.fields = formFields;
        formData.detectionMethod = 'explicit-form';
      }
    }
    
    // 2. If no fields found in explicit forms, try table-based detection
    if (formData.fields.length === 0) {
      ns.debug.log('No fields found in explicit forms, trying table-based detection');
      
      const tables = document.querySelectorAll('table');
      
      // Examine each table for potential form fields
      for (const table of tables) {
        const tableInputs = table.querySelectorAll('input, select, textarea');
        const validInputs = Array.from(tableInputs).filter(input => {
          const inputType = input.type?.toLowerCase() || '';
          return !['hidden', 'submit', 'button', 'reset'].includes(inputType);
        });
        
        if (validInputs.length >= 2) {
          ns.debug.log(`Found table with ${validInputs.length} form fields`);
          
          // Extract fields from the table structure
          const tableFields = extractTableFields(table);
          
          if (tableFields.length > 0) {
            ns.debug.log(`Extracted ${tableFields.length} fields from table`);
            formData.fields = tableFields;
            formData.detectionMethod = 'table-form';
            break;
          }
        }
      }
    }
    
    // 3. If still no fields, try password-based login form detection
    if (formData.fields.length === 0) {
      ns.debug.log('No fields found in tables, trying password-based detection');
      
      const passwordFields = Array.from(inputElements).filter(input => 
        input.type?.toLowerCase() === 'password'
      );
      
      if (passwordFields.length > 0) {
        ns.debug.log(`Found ${passwordFields.length} password fields`);
        
        // For each password field, try to find nearby username/email field
        for (const passwordField of passwordFields) {
          const container = passwordField.closest('form') || 
                           passwordField.closest('div') || 
                           passwordField.closest('fieldset');
          
          if (container) {
            const textInputs = Array.from(container.querySelectorAll('input')).filter(input => 
              input.type === 'text' || input.type === 'email' || 
              (input.type !== 'password' && 
               (input.name?.toLowerCase().includes('user') || 
                input.id?.toLowerCase().includes('user') || 
                input.name?.toLowerCase().includes('email') || 
                input.id?.toLowerCase().includes('email')))
            );
            
            if (textInputs.length > 0) {
              ns.debug.log('Found potential username/password pair');
              
              // Create fields for username and password
              formData.fields = [
                {
                  name: textInputs[0].name || textInputs[0].id || 'username',
                  id: textInputs[0].id || '',
                  type: textInputs[0].type || 'text',
                  label: findLabel(textInputs[0]) || 'Username',
                  required: true,
                  derivedType: 'username'
                },
                {
                  name: passwordField.name || passwordField.id || 'password',
                  id: passwordField.id || '',
                  type: 'password',
                  label: findLabel(passwordField) || 'Password',
                  required: true,
                  derivedType: 'password'
                }
              ];
              
              formData.detectionMethod = 'password-form';
              
              // Add additional fields if present
              for (let i = 1; i < textInputs.length; i++) {
                const fieldInfo = extractFieldInfo(textInputs[i]);
                if (fieldInfo) {
                  formData.fields.push(fieldInfo);
                }
              }
              
              // No need to check other password fields once we've found a match
              break;
            }
          }
        }
      }
    }
    
    // 4. If still no fields, use all input elements on the page as a last resort
    if (formData.fields.length === 0 && inputElements.length > 0) {
      ns.debug.log('No structured form detected, using all input elements');
      
      formData.fields = extractAllFields(inputElements);
      formData.detectionMethod = 'all-inputs';
    }
    
    // Filter out duplicates and non-interactive fields
    formData.fields = validateAndFilterFields(formData.fields);
    
    // Determine form type
    const formTypeInfo = determineFormType(formData.fields);
    formData.formType = formTypeInfo.type;
    formData.formPurpose = formTypeInfo.purpose;
    
    // Log final results
    ns.debug.log('Form detection completed', {
      fields: formData.fields.length,
      method: formData.detectionMethod,
      type: formData.formType
    });
    
    // Cache the results
    ns.cachedFormData = formData;
    
    console.timeEnd('fieldDetection');
    return formData;
  };
  
  /**
   * Quick initial scan - performs a fast detection pass for immediate feedback
   * @returns {Object} Basic form data with minimal processing
   */
  ns.quickScan = function() {
    try {
      ns.debug.time('quickScan');
      ns.debug.log('Starting quick scan');
      
      // Define comprehensive selectors for all possible form fields
      const standardSelectors = [
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])', 
        'select', 
        'textarea'
      ];
      
      // ARIA role-based selectors
      const ariaSelectors = [
        '[role="textbox"]', 
        '[role="combobox"]', 
        '[role="listbox"]', 
        '[role="checkbox"]', 
        '[role="radio"]', 
        '[role="spinbutton"]', 
        '[role="slider"]', 
        '[role="searchbox"]',
        '[role="option"]',
        '[aria-selected]'
      ];
      
      // Editable content selectors
      const editableSelectors = [
        'div[contenteditable="true"]',
        'span[contenteditable="true"]',
        '*[aria-haspopup="listbox"]'
      ];
      
      // Table-based form selectors (common in older websites)
      const tableFormSelectors = [
        'table tr td input',
        'table tr td select',
        'table tr td textarea',
        'table tbody tr td input',
        'table tbody tr td select',
        'table tbody tr td textarea',
        'tr td input', // Simplified version for directly accessible table rows
        'tr td select',
        'tr td textarea'
      ];
      
      // Create a master selector string
      const masterSelector = [
        ...standardSelectors,
        ...ariaSelectors, 
        ...editableSelectors,
        ...tableFormSelectors
      ].join(', ');
      
      ns.debug.log('Using master selector for field detection', masterSelector);
      
      // Collect inputs using our comprehensive selector
      const allInputs = Array.from(document.querySelectorAll(masterSelector));
      
      // Log detection metrics
      ns.debug.log('Field detection counts', {
        total: allInputs.length,
        standard: document.querySelectorAll(standardSelectors.join(', ')).length,
        aria: document.querySelectorAll(ariaSelectors.join(', ')).length,
        editable: document.querySelectorAll(editableSelectors.join(', ')).length,
        tableForm: document.querySelectorAll(tableFormSelectors.join(', ')).length
      });
      
      const inputElements = allInputs.filter(el => {
        try {
          // Only consider visible elements
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          
          // Check if element is visible and has dimensions
          return !(
            style.display === 'none' || 
            style.visibility === 'hidden' || 
            style.opacity === '0' ||
            (rect.width === 0 && rect.height === 0)
          );
        } catch (e) {
          ns.debug.error('Error checking visibility', e);
          return false;
        }
      });
      
      ns.debug.log(`Found ${inputElements.length} visible input elements`);
      
      // Basic form data
      const quickFormData = {
        formId: 'quick_form_' + Date.now(),
        formType: 'unknown',
        fields: [],
        isQuickScan: true,
        detectedAt: new Date().toISOString()
      };
      
      // Extract basic field information
      for (const input of inputElements) {
        try {
          const name = input.name || '';
          const id = input.id || '';
          const type = input.type || input.tagName.toLowerCase();
          const placeholder = input.placeholder || '';
          const required = input.required || input.getAttribute('aria-required') === 'true' || false;
          
          // Also check for contenteditable divs that might be acting as inputs
          const isContentEditable = input.getAttribute('contenteditable') === 'true';
          
          // Skip if no way to identify
          if (!name && !id && !placeholder && !isContentEditable) continue;
          
          // Simple label detection (faster than full version)
          let label = '';
          
          // Check for explicit label
          if (id) {
            const labelElement = document.querySelector(`label[for="${id}"]`);
            if (labelElement) {
              label = labelElement.textContent.trim();
            }
          }
          
          // Check for aria-label or aria-labelledby
          if (!label) {
            const ariaLabel = input.getAttribute('aria-label');
            if (ariaLabel) {
              label = ariaLabel;
            } else {
              const labelledby = input.getAttribute('aria-labelledby');
              if (labelledby) {
                const labelElement = document.getElementById(labelledby);
                if (labelElement) {
                  label = labelElement.textContent.trim();
                }
              }
            }
          }
          
          // Check for parent label
          if (!label && input.parentElement && input.parentElement.tagName === 'LABEL') {
            label = input.parentElement.textContent.trim();
          }
          
          // Use name or placeholder as fallback
          if (!label) {
            label = placeholder || name || id || 'Field';
            // Clean up label
            label = label.replace(/[-_]/g, ' ')
              .replace(/([a-z])([A-Z])/g, '$1 $2') // Convert camelCase to spaces
              .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
          }
          
          // Quick type detection (simplified)
          let derivedType = 'text';
          
          if (type === 'email' || name.includes('email') || label.toLowerCase().includes('email')) {
            derivedType = 'email';
          } else if (type === 'password' || name.includes('password') || label.toLowerCase().includes('password')) {
            derivedType = 'password';
          } else if (type === 'checkbox' || input.getAttribute('role') === 'checkbox') {
            derivedType = 'checkbox';
          } else if (type === 'radio' || input.getAttribute('role') === 'radio') {
            derivedType = 'radio';
          } else if (type === 'file' || label.toLowerCase().includes('upload')) {
            derivedType = 'file';
          } else if (name.includes('name') || label.toLowerCase().includes('name')) {
            if (name.includes('first') || label.toLowerCase().includes('first')) {
              derivedType = 'firstName';
            } else if (name.includes('last') || label.toLowerCase().includes('last')) {
              derivedType = 'lastName';
            } else {
              derivedType = 'name';
            }
          } else if (type === 'tel' || name.includes('phone') || label.toLowerCase().includes('phone')) {
            derivedType = 'phone';
          }
          
          quickFormData.fields.push({
            name: name,
            id: id,
            type: type,
            label: label,
            required: required,
            derivedType: derivedType,
            isContentEditable: isContentEditable
          });
        } catch (e) {
          ns.debug.error('Error processing input element', e);
        }
      }
      
      ns.debug.log(`Processed ${quickFormData.fields.length} fields`);
      
      // Basic form type detection based on field types
      const fieldTypes = quickFormData.fields.map(f => f.derivedType);
      
      if (fieldTypes.includes('password')) {
        if (fieldTypes.filter(t => t === 'password').length > 1) {
          quickFormData.formType = 'registration';
          ns.debug.log('Detected registration form (multiple password fields)');
        } else {
          quickFormData.formType = 'login';
          ns.debug.log('Detected login form (single password field)');
        }
      } else if (fieldTypes.includes('email') && fieldTypes.some(t => t.includes('message'))) {
        quickFormData.formType = 'contact';
        ns.debug.log('Detected contact form (email + message fields)');
      } else if (fieldTypes.some(f => f.includes('card') || f.includes('payment') || f.includes('credit'))) {
        quickFormData.formType = 'payment';
        ns.debug.log('Detected payment form');
      } else if (fieldTypes.includes('email') && fieldTypes.length <= 2) {
        quickFormData.formType = 'newsletter';
        ns.debug.log('Detected newsletter form');
      }
      
      ns.debug.timeEnd('quickScan');
      return quickFormData;
    } catch (error) {
      ns.debug.error('Error in quickScan', error);
      
      // Return minimal data on error
      return {
        formId: 'error_' + Date.now(),
        formType: 'unknown',
        fields: [],
        isQuickScan: true,
        error: error.message,
        detectedAt: new Date().toISOString()
      };
    }
  };
  
  /**
   * Find the best container that likely represents a form
   * @param {NodeList} inputElements - List of input elements
   * @returns {Element} Best form container element
   */
  function findBestFormContainer(inputElements) {
    // Group inputs by their parent container
    const containerMap = new Map();
    
    Array.from(inputElements).forEach(input => {
      // Look up to 3 levels for a good container
      let container = input.parentElement;
      let level = 0;
      
      while (container && level < 3) {
        if (!containerMap.has(container)) {
          containerMap.set(container, []);
        }
        containerMap.get(container).push(input);
        
        container = container.parentElement;
        level++;
      }
    });
    
    // Find container with the most inputs
    let bestContainer = null;
    let maxInputs = 0;
    
    containerMap.forEach((inputs, container) => {
      if (inputs.length > maxInputs) {
        maxInputs = inputs.length;
        bestContainer = container;
      }
    });
    
    return bestContainer;
  }
  
  /**
   * Extract fields from a table element
   * @param {Element} table - Table element that might contain form fields
   * @returns {Array} List of field objects
   */
  function extractTableFields(table) {
    const fields = [];
    
    // Look for inputs in table cells
    const inputs = table.querySelectorAll('input, select, textarea');
    const validInputs = Array.from(inputs).filter(input => {
      const inputType = input.type?.toLowerCase() || '';
      return !['hidden', 'submit', 'button', 'reset'].includes(inputType);
    });
    
    // Process each input
    validInputs.forEach(input => {
      // Skip if already processed
      if (fields.some(f => f.id === input.id || f.name === input.name)) {
        return;
      }
      
      // Get the containing cell
      const cell = input.closest('td, th');
      if (!cell) return;
      
      // Try multiple approaches to find a label
      let label = '';
      
      // 1. Try to get label from previous cell in same row
      const row = cell.closest('tr');
      if (row) {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const cellIndex = cells.indexOf(cell);
        
        if (cellIndex > 0) {
          // Get text from previous cell - likely a label
          label = cells[cellIndex - 1].textContent.trim();
          
          // Fix common patterns like "Username:" - keep the word but standardize
          if (label.endsWith(':')) {
            label = label.slice(0, -1).trim();
            // Capitalize for consistency
            if (label && label.length > 0) {
              label = label.charAt(0).toUpperCase() + label.slice(1);
            }
          }
        }
      }
      
      // 2. If no label found in table structure, try standard methods
      if (!label) {
        label = findLabel(input);
      }
      
      // 3. Last resort - use name, id, or placeholder
      if (!label) {
        label = input.placeholder || input.name || input.id || 'Field';
        // Clean up the label
        label = label.replace(/[-_]/g, ' ')
                 .replace(/([a-z])([A-Z])/g, '$1 $2'); // Convert camelCase to spaces
        
        // Capitalize first letter
        if (label && label.length > 0) {
          label = label.charAt(0).toUpperCase() + label.slice(1);
        }
      }
      
      // Add field
      fields.push({
        name: input.name || input.id || '',
        id: input.id || '',
        type: input.type || input.tagName.toLowerCase(),
        label: label,
        required: input.required || input.getAttribute('aria-required') === 'true' || false,
        derivedType: deriveFieldType(input, label)
      });
    });
    
    return fields;
  }
  
  /**
   * Extract field information from a container
   * @param {Element} container - Container element (form or form-like)
   * @returns {Array} Extracted field data
   */
  function extractFields(container) {
    const fields = [];
    const inputs = container.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
    
    inputs.forEach(input => {
      const fieldInfo = extractFieldInfo(input);
      if (fieldInfo) {
        fields.push(fieldInfo);
      }
    });
    
    return fields;
  }
  
  /**
   * Extract all input fields from a NodeList
   * @param {NodeList} inputElements - List of input elements
   * @returns {Array} Extracted field data
   */
  function extractAllFields(inputElements) {
    const fields = [];
    
    inputElements.forEach(input => {
      const fieldInfo = extractFieldInfo(input);
      if (fieldInfo) {
        fields.push(fieldInfo);
      }
    });
    
    return fields;
  }
  
  /**
   * Extract detailed information from an input element
   * @param {Element} input - Input element
   * @returns {Object|null} Field information or null if invalid
   */
  function extractFieldInfo(input) {
    // Skip non-interactive elements
    if (!isInteractiveField(input)) {
      return null;
    }
    
    const name = input.name || '';
    const id = input.id || '';
    const type = input.type || input.tagName.toLowerCase();
    let label = findLabel(input);
    const placeholder = input.placeholder || '';
    const required = input.required || input.getAttribute('aria-required') === 'true';
    const pattern = input.pattern || '';
    const value = input.value || '';
    const disabled = input.disabled;
    
    // Skip if no way to identify the field
    if (!name && !id && !label && !placeholder) {
      return null;
    }
    
    // Derive a field type based on various attributes
    const derivedType = deriveFieldType(input, name, id, label, placeholder);
    
    // Generate a clean label if none was found
    if (!label) {
      label = generateLabel(name, id, placeholder, derivedType);
    }
    
    return {
      name: name,
      id: id,
      type: type,
      htmlType: input.type || input.tagName.toLowerCase(),
      derivedType: derivedType,
      label: label,
      placeholder: placeholder,
      required: required,
      pattern: pattern,
      value: value,
      disabled: disabled,
      confidence: calculateFieldConfidence(input, derivedType)
    };
  }
  
  /**
   * Check if an element is truly an interactive field
   * @param {Element} element - Element to check
   * @returns {boolean} True if interactive
   */
  function isInteractiveField(element) {
    // Check if it's one of the form field types
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
      return false;
    }
    
    // Check if it's visible in the DOM
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    // For input elements, check if they're not submit/button/reset/hidden
    if (element.tagName === 'INPUT') {
      const excludedTypes = ['submit', 'button', 'reset', 'hidden', 'image'];
      if (excludedTypes.includes(element.type)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Find the label for an input element
   * @param {Element} input - Input element
   * @returns {string} Label text or empty string
   */
  function findLabel(input) {
    let label = '';
    
    // Method 1: Check for explicit label
    if (input.id) {
      const labelElement = document.querySelector(`label[for="${input.id}"]`);
      if (labelElement) {
        label = labelElement.textContent.trim();
      }
    }
    
    // Method 2: Check for parent label
    if (!label && input.parentElement && input.parentElement.tagName === 'LABEL') {
      const labelText = input.parentElement.textContent.replace(input.value || '', '').trim();
      if (labelText) {
        label = labelText;
      }
    }
    
    // Method 3: Check for table-based form layouts (common in older websites)
    if (!label && (input.closest('td') || input.closest('tr'))) {
      // Special handling for table-based forms
      const cell = input.closest('td');
      if (cell) {
        // Try to get label from previous cell in the same row
        const row = cell.closest('tr');
        if (row) {
          const cells = Array.from(row.querySelectorAll('td'));
          const cellIndex = cells.indexOf(cell);
          
          // The label is usually in the previous cell
          if (cellIndex > 0) {
            const labelCell = cells[cellIndex - 1];
            if (labelCell) {
              label = labelCell.textContent.trim();
            }
          }
          
          // If no label found and this is the second field in a form,
          // look for username/password or email/password patterns
          if (!label && cellIndex === 0 && cells.length > 1) {
            // Check for password field
            const isPassword = input.type === 'password';
            if (isPassword) {
              // This might be a password field, check the row above for username/email
              const prevRow = row.previousElementSibling;
              if (prevRow && prevRow.tagName === 'TR') {
                // Look for first cell of previous row
                const prevCell = prevRow.querySelector('td:first-child');
                if (prevCell) {
                  const prevInput = prevCell.querySelector('input');
                  if (prevInput && (prevInput.type === 'text' || prevInput.type === 'email')) {
                    // Likely a username/password pair
                    label = 'Password';
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Method 4: Check for nearby heading or div
    if (!label) {
      // Look for preceding siblings that might be labels
      let sibling = input.previousElementSibling;
      while (sibling && !label) {
        if (['LABEL', 'DIV', 'SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(sibling.tagName)) {
          label = sibling.textContent.trim();
          // Limit to reasonable length
          if (label.length > 50) {
            label = label.substring(0, 50).trim();
          }
        }
        sibling = sibling.previousElementSibling;
      }
    }
    
    // Method 5: Special check for test form patterns with "Username:" and "Password:" in table cells or divs
    if (!label) {
      // Look for tables with text nodes containing "Username:" or "Password:"
      const documentText = document.body.innerText;
      const usernameColonPattern = /username\s*:/i;
      const passwordColonPattern = /password\s*:/i;
      
      if (documentText.match(usernameColonPattern) || documentText.match(passwordColonPattern)) {
        ns.debug.log('Detected potential test form with Username: or Password: format');
        
        // Check all text nodes in the document
        const textWalker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        let foundLabel = null;
        let minDistance = Infinity;
        
        // Iterate through text nodes looking for closest "Username:" or "Password:" text
        while(node = textWalker.nextNode()) {
          const text = node.nodeValue.trim();
          
          // Skip empty text nodes
          if (!text) continue;
          
          // Check for username pattern for text input
          if (input.type === 'text' && usernameColonPattern.test(text)) {
            // Calculate distance between text node and input
            const textRect = getNodeRect(node);
            const inputRect = input.getBoundingClientRect();
            const distance = getDistance(textRect, inputRect);
            
            if (distance < minDistance) {
              minDistance = distance;
              foundLabel = 'Username';
            }
          }
          
          // Check for password pattern for password input
          else if (input.type === 'password' && passwordColonPattern.test(text)) {
            // Calculate distance between text node and input
            const textRect = getNodeRect(node);
            const inputRect = input.getBoundingClientRect();
            const distance = getDistance(textRect, inputRect);
            
            if (distance < minDistance) {
              minDistance = distance;
              foundLabel = 'Password';
            }
          }
        }
        
        // Use found label if distance is reasonable (within 200px)
        if (foundLabel && minDistance < 200) {
          label = foundLabel;
          ns.debug.log(`Found ${foundLabel} field by text proximity`, { distance: minDistance });
        }
      }
    }
    
    // Method 6: Look for pattern-based labels for common field types
    if (!label) {
      // Check if this could be a username field
      if (input.type === 'text' && (
          input.name?.toLowerCase().includes('user') || 
          input.id?.toLowerCase().includes('user') ||
          input.placeholder?.toLowerCase().includes('user'))
      ) {
        label = 'Username';
      }
      // Check for common password field patterns
      else if (input.type === 'password') {
        label = 'Password';
      }
      // Check for email patterns
      else if (input.type === 'email' || 
               input.name?.toLowerCase().includes('email') || 
               input.id?.toLowerCase().includes('email')) {
        label = 'Email';
      }
    }
    
    // Helper function to get bounding rectangle for text node
    function getNodeRect(node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect();
    }
    
    // Helper function to calculate distance between two rectangles
    function getDistance(rect1, rect2) {
      const centerX1 = rect1.left + rect1.width / 2;
      const centerY1 = rect1.top + rect1.height / 2;
      const centerX2 = rect2.left + rect2.width / 2;
      const centerY2 = rect2.top + rect2.height / 2;
      
      return Math.sqrt(
        Math.pow(centerX1 - centerX2, 2) + 
        Math.pow(centerY1 - centerY2, 2)
      );
    }
    
    // Method 6: Use ARIA attributes
    if (!label) {
      label = input.getAttribute('aria-label') || 
              input.getAttribute('placeholder') || 
              input.getAttribute('title') || '';
      
      // Try to get label from labelledby element
      if (!label) {
        const labelledby = input.getAttribute('aria-labelledby');
        if (labelledby) {
          const labelledbyEl = document.getElementById(labelledby);
          if (labelledbyEl) {
            label = labelledbyEl.textContent.trim();
          }
        }
      }
    }
    
    // Clean up label - but keep colons for matching fields like "Username:" in test forms
    if (label) {
      // Only remove asterisks, keep colons since many test forms use "Username:" format
      label = label.replace(/[\*]/g, '').trim();
      
      // Intelligent truncation - keep important words
      if (label.length > 50) {
        // Try to find a good breakpoint
        const breakPoint = label.indexOf(' ', 40);
        if (breakPoint > -1) {
          label = label.substring(0, breakPoint).trim() + '...';
        } else {
          label = label.substring(0, 47).trim() + '...';
        }
      }
    }
    
    return label;
  }
  
  /**
   * Derive field type based on various attributes
   * @param {Element} input - Input element
   * @param {string} name - Field name
   * @param {string} id - Field ID
   * @param {string} label - Field label
   * @param {string} placeholder - Field placeholder
   * @returns {string} Derived field type
   */
  function deriveFieldType(input, name, id, label, placeholder) {
    const attributeText = [
      name.toLowerCase(), 
      id.toLowerCase(), 
      label.toLowerCase(), 
      placeholder.toLowerCase()
    ].join(' ');
    
    // Check against field patterns
    for (const [fieldType, patterns] of Object.entries(ns.config.fieldPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(attributeText)) {
          return fieldType;
        }
      }
    }
    
    // Use HTML type as fallback
    if (input.type === 'email') return 'email';
    if (input.type === 'tel') return 'phone';
    if (input.type === 'password') return 'password';
    
    return 'text';
  }
  
  /**
   * Generate a clean label when none exists
   * @param {string} name - Field name
   * @param {string} id - Field ID
   * @param {string} placeholder - Field placeholder
   * @param {string} type - Derived field type
   * @returns {string} Generated label
   */
  function generateLabel(name, id, placeholder, type) {
    // Try placeholder first as it's often descriptive
    if (placeholder) {
      return placeholder.charAt(0).toUpperCase() + placeholder.slice(1);
    }
    
    // Try name or ID
    let text = name || id;
    
    // Clean up the text
    if (text) {
      // Remove prefixes like frm_, txt_, etc.
      text = text.replace(/^(frm|txt|fld|input|field)_/i, '');
      
      // Convert camelCase to spaces
      text = text.replace(/([a-z])([A-Z])/g, '$1 $2');
      
      // Convert snake_case to spaces
      text = text.replace(/_+/g, ' ');
      
      // Convert kebab-case to spaces
      text = text.replace(/-+/g, ' ');
      
      // Capitalize first letter
      text = text.charAt(0).toUpperCase() + text.slice(1);
      
      return text;
    }
    
    // Use derived type as last resort
    const typeLabels = {
      'username': 'Username',
      'email': 'Email',
      'password': 'Password',
      'confirmPassword': 'Confirm Password',
      'firstName': 'First Name',
      'lastName': 'Last Name',
      'name': 'Name',
      'phone': 'Phone Number',
      'address': 'Address',
      'city': 'City',
      'state': 'State/Province',
      'zip': 'ZIP/Postal Code',
      'country': 'Country',
      'creditCard': 'Credit Card Number',
      'expiry': 'Expiration Date',
      'cvv': 'Security Code'
    };
    
    return typeLabels[type] || 'Field';
  }
  
  /**
   * Calculate confidence score for field identification
   * @param {Element} input - Input element
   * @param {string} derivedType - Derived field type
   * @returns {number} Confidence score (0-1)
   */
  function calculateFieldConfidence(input, derivedType) {
    let score = 0.5; // Start with neutral score
    
    // Explicit attributes increase confidence
    if (input.name) score += 0.1;
    if (input.id) score += 0.1;
    if (input.placeholder) score += 0.1;
    if (input.required) score += 0.1;
    
    // Label increases confidence significantly
    if (findLabel(input)) score += 0.2;
    
    // Specific HTML types increase confidence
    if (input.type === 'email' || input.type === 'tel' || 
        input.type === 'password' || input.type === 'date') {
      score += 0.2;
    }
    
    // Strong pattern matches increase confidence
    if (['email', 'password', 'phone', 'creditCard', 'firstName', 'lastName'].includes(derivedType)) {
      score += 0.1;
    }
    
    // Ensure score is within bounds
    return Math.min(Math.max(score, 0), 1);
  }
  
  /**
   * Validate and filter duplicate or low-confidence fields
   * @param {Array} fields - Extracted fields
   * @returns {Array} Filtered fields
   */
  function validateAndFilterFields(fields) {
    if (!fields || !fields.length) return [];
    
    // Track seen fields to remove duplicates
    const seenFields = new Set();
    
    return fields
      // Filter out low confidence and duplicate fields
      .filter(field => {
        // Skip low confidence fields
        if (field.confidence < 0.3) return false;
        
        // Generate a unique key based on field properties
        const fieldKey = `${field.derivedType}:${field.name || field.id || field.label}`;
        
        // Skip if we've seen this field before
        if (seenFields.has(fieldKey)) return false;
        
        // Mark as seen and keep
        seenFields.add(fieldKey);
        return true;
      })
      // Sort by confidence and required status
      .sort((a, b) => {
        // Required fields first
        if (a.required !== b.required) {
          return a.required ? -1 : 1;
        }
        // Then by confidence
        return b.confidence - a.confidence;
      });
  }
  
  /**
   * Determine form type based on field composition
   * @param {Array} fields - Form fields
   * @param {Element} formContainer - Form container element
   * @returns {Object} Form type information
   */
  function determineFormType(fields, formContainer) {
    if (!fields || !fields.length) {
      return { type: 'unknown', purpose: 'collecting information' };
    }
    
    // Generate list of field types present
    const fieldTypes = fields.map(f => f.derivedType);
    
    // Check for text in the form or nearby elements
    let formText = '';
    if (formContainer) {
      // Get text from the form itself
      formText = formContainer.innerText || '';
      
      // Get text from headings above the form
      let sibling = formContainer.previousElementSibling;
      while (sibling) {
        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LEGEND'].includes(sibling.tagName)) {
          formText += ' ' + sibling.innerText;
        }
        sibling = sibling.previousElementSibling;
      }
      
      // Simplify text for matching
      formText = formText.toLowerCase();
    }
    
    // Check against form type patterns
    let bestMatch = null;
    let highestScore = 0;
    
    for (const [formType, criteria] of Object.entries(ns.config.formTypes)) {
      let score = 0;
      
      // Check required fields
      const requiredFieldsCount = criteria.requiredFields.length;
      let matchedRequiredFields = 0;
      
      for (const requiredField of criteria.requiredFields) {
        // Handle OR conditions (e.g. 'username|email')
        const options = requiredField.split('|');
        if (options.some(opt => fieldTypes.includes(opt))) {
          matchedRequiredFields++;
        }
      }
      
      // Calculate required fields score
      if (requiredFieldsCount > 0) {
        score += (matchedRequiredFields / requiredFieldsCount) * 0.6;
      }
      
      // Check optional fields
      const optionalFieldsCount = criteria.optionalFields.length;
      let matchedOptionalFields = 0;
      
      for (const optionalField of criteria.optionalFields) {
        // Handle OR conditions
        const options = optionalField.split('|');
        if (options.some(opt => fieldTypes.includes(opt))) {
          matchedOptionalFields++;
        }
      }
      
      // Calculate optional fields score
      if (optionalFieldsCount > 0) {
        score += (matchedOptionalFields / optionalFieldsCount) * 0.2;
      }
      
      // Check keywords in form text
      if (formText) {
        for (const keyword of criteria.keywords) {
          if (formText.includes(keyword)) {
            score += 0.2;
            break; // Only count one keyword match
          }
        }
      }
      
      // Update best match if score is higher
      if (score > highestScore) {
        highestScore = score;
        bestMatch = formType;
      }
    }
    
    // Map form type to purpose description
    const formTypePurposes = {
      'login': 'signing in to your account',
      'registration': 'creating a new account',
      'contact': 'sending a message or inquiry',
      'checkout': 'completing a purchase',
      'address': 'providing shipping or billing information',
      'search': 'finding specific content',
      'unknown': 'collecting information'
    };
    
    const type = bestMatch || 'unknown';
    const purpose = formTypePurposes[type];
    
    return { type, purpose };
  }
})(window.FieldDetector);