/**
 * Enhanced Field Detector - Comprehensive form field detection with multi-phase strategy
 * - Advanced table detection with row/column analysis
 * - ARIA compliance for accessible controls
 * - Spatial proximity analysis for label association
 * - Scoring system to prioritize legitimate fields
 * - Debug tracing for detection reasons
 * - Filtering system for non-input elements
 */

// Create namespace to avoid conflicts
window.EnhancedFieldDetector = window.EnhancedFieldDetector || {};

(function(ns) {
  // Debug configuration
  ns.debugMode = true;
  ns.detectionReasons = new Map();
  ns.usedMethods = [];
  ns.startTime = 0;
  ns.lastRawCount = 0;
  ns.lastFilteredCount = 0;
  ns.testMode = true; // ENABLE TEST MODE for detailed diagnostics
  
  // Debug logging
  ns.log = function(message, data = {}) {
    if (ns.debugMode) {
      console.log(`[Enhanced Field Detector] ${message}`, data);
    }
  };
  
  // Error logging - always show errors
  ns.error = function(message, error) {
    console.error(`[Enhanced Field Detector Error] ${message}`, error);
  };
  
  // Track detection reason for a field
  ns.trackReason = function(fieldId, reason) {
    if (!ns.detectionReasons.has(fieldId)) {
      ns.detectionReasons.set(fieldId, []);
    }
    ns.detectionReasons.get(fieldId).push(reason);
  };
  
  // Get detection reasons for debugging
  ns.getReasons = function(fieldId) {
    return ns.detectionReasons.get(fieldId) || [];
  };
  
  // Comprehensive selectors for input elements
  ns.selectors = {
    // Standard HTML form controls
    standard: 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea',
    
    // ARIA roles that represent form controls
    aria: '[role="textbox"], [role="combobox"], [role="listbox"], [role="checkbox"], [role="radio"], [role="spinbutton"], [role="slider"], [role="searchbox"], [contenteditable="true"]',
    
    // Table-based form patterns
    tableBased: 'table tr td input, table tr td select, table tr td textarea, table tbody tr td input, table tbody tr td select, table tbody tr td textarea',
    
    // Modern framework patterns
    modern: '[data-input], [data-field], .form-control, .input-control, [ng-model], [v-model], [formcontrolname]',
    
    // Shadow DOM queries can't use these directly but keep for reference
    shadow: 'input, select, textarea'
  };
  
  // Field type patterns for identification
  ns.fieldPatterns = {
    username: {
      patterns: [/username/i, /user[_-]?name/i, /user[_-]?id/i, /login[_-]?id/i, /account[_-]?name/i, /account[_-]?id/i],
      score: 0.9
    },
    email: {
      patterns: [/email/i, /e[_-]?mail/i, /mail/i],
      score: 0.9
    },
    password: {
      patterns: [/password/i, /pass[_-]?word/i, /pwd/i, /passwd/i],
      score: 0.95
    },
    confirmPassword: {
      patterns: [/confirm[_-]?password/i, /password[_-]?confirm/i, /verify[_-]?password/i, /password[_-]?verify/i, /password[_-]?again/i, /re[_-]?password/i],
      score: 0.9
    },
    firstName: {
      patterns: [/first[_-]?name/i, /given[_-]?name/i, /first/i, /fname/i],
      score: 0.8
    },
    lastName: {
      patterns: [/last[_-]?name/i, /family[_-]?name/i, /surname/i, /lname/i],
      score: 0.8
    },
    name: {
      patterns: [/full[_-]?name/i, /your[_-]?name/i, /name/i],
      score: 0.7
    },
    phone: {
      patterns: [/phone/i, /telephone/i, /tel/i, /mobile/i, /cell[_-]?phone/i],
      score: 0.85
    },
    address: {
      patterns: [/address/i, /addr/i, /street/i],
      score: 0.85
    },
    city: {
      patterns: [/city/i, /town/i],
      score: 0.8
    },
    state: {
      patterns: [/state/i, /province/i, /region/i],
      score: 0.8
    },
    zip: {
      patterns: [/zip/i, /postal[_-]?code/i, /post[_-]?code/i, /zip[_-]?code/i],
      score: 0.8
    },
    country: {
      patterns: [/country/i, /nation/i],
      score: 0.8
    },
    creditCard: {
      patterns: [/credit[_-]?card/i, /card[_-]?number/i, /cc[_-]?number/i, /card[_-]?#/i, /cc[_-]?#/i, /payment/i],
      score: 0.9
    },
    expiry: {
      patterns: [/expir/i, /exp[_-]?date/i, /expiration/i],
      score: 0.85
    },
    cvv: {
      patterns: [/cvv/i, /cvc/i, /cv2/i, /security[_-]?code/i, /card[_-]?verification/i],
      score: 0.9
    },
    search: {
      patterns: [/search/i, /find/i, /query/i, /look[_-]?up/i],
      score: 0.7
    },
    comment: {
      patterns: [/comment/i, /feedback/i, /review/i],
      score: 0.7
    },
    message: {
      patterns: [/message/i, /msg/i],
      score: 0.8
    },
    subject: {
      patterns: [/subject/i, /topic/i, /regarding/i, /re:/i],
      score: 0.8
    },
    // Generic field types
    checkbox: {
      patterns: [/checkbox/i, /check/i, /agree/i, /accept/i, /consent/i, /opt[_-]?in/i],
      score: 0.75
    },
    radio: {
      patterns: [/radio/i, /option/i, /choice/i, /select[_-]?one/i],
      score: 0.75
    },
    dropdown: {
      patterns: [/dropdown/i, /select/i, /choose/i],
      score: 0.75
    },
    date: {
      patterns: [/date/i, /day/i, /month/i, /year/i, /dob/i, /birth/i],
      score: 0.85
    },
    time: {
      patterns: [/time/i, /hour/i, /minute/i, /second/i],
      score: 0.8
    },
    file: {
      patterns: [/file/i, /upload/i, /attachment/i, /document/i],
      score: 0.85
    }
  };
  
  /**
   * Enhanced field detection with multi-phase strategy
   * Combines multiple approaches for maximum coverage
   */
  ns.detectFields = function() {
    ns.startTime = performance.now();
    ns.log("⭐ Starting enhanced field detection", { testMode: ns.testMode });
    ns.detectionReasons.clear();
    ns.usedMethods = [];
    
    let detectedFields = [];
    let detectionMethod = "none";
    
    // Add this for debugging - collect results from each phase separately
    const phaseResults = {};
    
    try {
      // Phase 1: Standard form field detection
      const standardFields = ns.detectStandardFields();
      phaseResults.standard = standardFields.length;
      console.log("🔍 Phase 1 - Standard form field detection:", standardFields.length, "fields");
      if (ns.testMode) {
        console.log("Standard fields:", standardFields);
      }
      
      if (standardFields.length > 0) {
        detectedFields = [...standardFields];
        detectionMethod = "standard";
        ns.usedMethods.push("standard");
      }
      
      // Phase 2: Table-based form detection if standard detection failed
      const tableFields = ns.detectTableFields();
      phaseResults.table = tableFields.length;
      console.log("🔍 Phase 2 - Table-based form detection:", tableFields.length, "fields");
      if (ns.testMode) {
        console.log("Table fields:", tableFields);
      }
      
      if (detectedFields.length === 0 && tableFields.length > 0) {
        detectedFields = [...tableFields];
        detectionMethod = "table";
        ns.usedMethods.push("table");
      } else if (tableFields.length > 0) {
        // Add unique table fields even if we already have standard fields
        const newTableFields = tableFields.filter(tableField => 
          !detectedFields.some(field => 
            (field.id && field.id === tableField.id) || 
            (field.name && field.name === tableField.name)
          )
        );
        
        if (newTableFields.length > 0) {
          console.log(`Adding ${newTableFields.length} unique table fields`);
          detectedFields = [...detectedFields, ...newTableFields];
          ns.usedMethods.push("table");
        }
      }
      
      // Phase 3: ARIA-based detection (always run for accessibility)
      const ariaFields = ns.detectAriaFields();
      phaseResults.aria = ariaFields.length;
      console.log("🔍 Phase 3 - ARIA-based detection:", ariaFields.length, "fields");
      if (ns.testMode) {
        console.log("ARIA fields:", ariaFields);
      }
      
      if (ariaFields.length > 0) {
        // Only add if we haven't already found these fields
        const newAriaFields = ariaFields.filter(ariaField => 
          !detectedFields.some(field => 
            (field.id && field.id === ariaField.id) || 
            (field.name && field.name === ariaField.name)
          )
        );
        
        if (newAriaFields.length > 0) {
          console.log(`Adding ${newAriaFields.length} unique ARIA fields`);
          detectedFields = [...detectedFields, ...newAriaFields];
          ns.usedMethods.push("aria");
          if (detectionMethod === "none") {
            detectionMethod = "aria";
          }
        }
      }
      
      // Phase 4: Modern framework detection
      const modernFields = ns.detectModernFrameworkFields();
      phaseResults.modern = modernFields.length;
      console.log("🔍 Phase 4 - Modern framework detection:", modernFields.length, "fields");
      if (ns.testMode) {
        console.log("Modern framework fields:", modernFields);
      }
      
      if (modernFields.length > 0) {
        // Only add new fields
        const newModernFields = modernFields.filter(modernField => 
          !detectedFields.some(field => 
            (field.id && field.id === modernField.id) || 
            (field.name && field.name === modernField.name)
          )
        );
        
        if (newModernFields.length > 0) {
          console.log(`Adding ${newModernFields.length} unique modern framework fields`);
          detectedFields = [...detectedFields, ...newModernFields];
          ns.usedMethods.push("modern");
          if (detectionMethod === "none") {
            detectionMethod = "modern";
          }
        }
      }
      
      // Phase 5: Proximity-based detection for unlabeled fields
      const proximityFields = ns.detectByProximity();
      phaseResults.proximity = proximityFields.length;
      console.log("🔍 Phase 5 - Proximity-based detection:", proximityFields.length, "fields");
      if (ns.testMode) {
        console.log("Proximity fields:", proximityFields);
      }
      
      if (detectedFields.length === 0 && proximityFields.length > 0) {
        detectedFields = [...proximityFields];
        detectionMethod = "proximity";
        ns.usedMethods.push("proximity");
      } else if (proximityFields.length > 0) {
        // Add unique proximity fields
        const newProximityFields = proximityFields.filter(proxField => 
          !detectedFields.some(field => 
            (field.id && field.id === proxField.id) || 
            (field.name && field.name === proxField.name)
          )
        );
        
        if (newProximityFields.length > 0) {
          console.log(`Adding ${newProximityFields.length} unique proximity fields`);
          detectedFields = [...detectedFields, ...newProximityFields];
          ns.usedMethods.push("proximity");
        }
      }
      
      // Phase 6: Special case detection for login forms with username/password
      const loginFields = ns.detectLoginForm();
      phaseResults.login = loginFields.length;
      console.log("🔍 Phase 6 - Login form detection:", loginFields.length, "fields");
      if (ns.testMode) {
        console.log("Login fields:", loginFields);
      }
      
      if (detectedFields.length === 0 && loginFields.length > 0) {
        detectedFields = [...loginFields];
        detectionMethod = "login";
        ns.usedMethods.push("login");
      } else if (loginFields.length > 0) {
        // Add unique login fields
        const newLoginFields = loginFields.filter(loginField => 
          !detectedFields.some(field => 
            (field.id && field.id === loginField.id) || 
            (field.name && field.name === loginField.name)
          )
        );
        
        if (newLoginFields.length > 0) {
          console.log(`Adding ${newLoginFields.length} unique login fields`);
          detectedFields = [...detectedFields, ...newLoginFields];
          ns.usedMethods.push("login");
        }
      }
      
      // Phase 7: Shadow DOM detection as last resort
      const shadowFields = ns.detectShadowDomFields();
      phaseResults.shadow = shadowFields.length;
      console.log("🔍 Phase 7 - Shadow DOM detection:", shadowFields.length, "fields");
      if (ns.testMode) {
        console.log("Shadow DOM fields:", shadowFields);
      }
      
      if (detectedFields.length === 0 && shadowFields.length > 0) {
        detectedFields = [...shadowFields];
        detectionMethod = "shadow";
        ns.usedMethods.push("shadow");
      } else if (shadowFields.length > 0) {
        // Add unique shadow DOM fields
        const newShadowFields = shadowFields.filter(shadowField => 
          !detectedFields.some(field => 
            (field.id && field.id === shadowField.id) || 
            (field.name && field.name === shadowField.name)
          )
        );
        
        if (newShadowFields.length > 0) {
          console.log(`Adding ${newShadowFields.length} unique shadow DOM fields`);
          detectedFields = [...detectedFields, ...newShadowFields];
          ns.usedMethods.push("shadow");
        }
      }
      
      // Phase 8: Fallback to any input on the page as absolute last resort
      const allFields = ns.detectAllVisibleFields();
      phaseResults.fallback = allFields.length;
      console.log("🔍 Phase 8 - Fallback detection:", allFields.length, "fields");
      if (ns.testMode) {
        console.log("Fallback fields:", allFields);
      }
      
      if (detectedFields.length === 0 && allFields.length > 0) {
        detectedFields = [...allFields];
        detectionMethod = "fallback";
        ns.usedMethods.push("fallback");
      } else if (allFields.length > 0 && detectedFields.length < 2) {
        // If we have less than 2 fields detected so far, check fallback method for more
        const newFallbackFields = allFields.filter(fallbackField => 
          !detectedFields.some(field => 
            (field.id && field.id === fallbackField.id) || 
            (field.name && field.name === fallbackField.name)
          )
        );
        
        if (newFallbackFields.length > 0) {
          console.log(`Adding ${newFallbackFields.length} unique fallback fields`);
          detectedFields = [...detectedFields, ...newFallbackFields];
          ns.usedMethods.push("fallback");
        }
      }
      
      // Count the fields before filtering (for debugging)
      ns.lastRawCount = detectedFields.length;
      console.log(`🧮 BEFORE FILTERING: Total detected fields: ${detectedFields.length}`);
      
      // Log summary for each field before filtering
      if (ns.testMode) {
        console.table(detectedFields.map(field => ({
          id: field.id,
          name: field.name,
          type: field.type,
          label: field.label,
          required: field.required,
          derivedType: field.derivedType,
          confidence: field.confidence,
          method: field.detectionMethod,
        })));
      }
      
      // Apply scoring to prioritize likely form fields
      const scoredFields = ns.scoreAndFilterFields(detectedFields);
      ns.lastFilteredCount = scoredFields.length;
      
      // Log detection summary
      const endTime = performance.now();
      const duration = Math.round(endTime - ns.startTime);
      
      console.log(`📊 PHASE RESULTS:`, phaseResults);
      console.log(`🧮 AFTER FILTERING: Kept ${scoredFields.length} of ${detectedFields.length} fields`);
      
      ns.log(`Field detection complete`, {
        fieldsFound: scoredFields.length,
        rawFields: detectedFields.length,
        primaryMethod: detectionMethod,
        allMethods: ns.usedMethods,
        duration: `${duration}ms`
      });
      
      if (ns.testMode) {
        console.log("FINAL FIELDS AFTER FILTERING:", scoredFields);
      }
      
      return {
        fields: scoredFields,
        rawFields: detectedFields,
        timing: duration,
        detectionMethod: detectionMethod,
        detectionMethods: ns.usedMethods
      };
    } catch (error) {
      ns.error("Error during field detection", error);
      return {
        fields: [],
        error: error.message,
        timing: performance.now() - ns.startTime
      };
    }
  };
  
  /**
   * Detect fields in standard form elements
   */
  ns.detectStandardFields = function() {
    ns.log("Starting standard form detection");
    const fields = [];
    
    try {
      // Find all form elements
      const formElements = document.querySelectorAll('form');
      
      if (formElements.length === 0) {
        ns.log("No standard form elements found");
        return [];
      }
      
      // Find the best form (with most fields)
      let bestForm = null;
      let maxInputCount = 0;
      
      for (const form of formElements) {
        const inputSelector = ns.selectors.standard;
        const inputs = form.querySelectorAll(inputSelector);
        
        if (inputs.length > maxInputCount) {
          maxInputCount = inputs.length;
          bestForm = form;
        }
      }
      
      if (!bestForm || maxInputCount === 0) {
        ns.log("No form with input fields found");
        return [];
      }
      
      // Process each input in the best form
      const inputs = bestForm.querySelectorAll(ns.selectors.standard);
      
      for (const input of inputs) {
        try {
          const fieldInfo = ns.extractFieldInfo(input, "standard");
          if (fieldInfo) {
            fields.push(fieldInfo);
          }
        } catch (err) {
          ns.error(`Error processing standard input: ${input.name || input.id}`, err);
        }
      }
      
      ns.log(`Standard detection found ${fields.length} fields`);
    } catch (error) {
      ns.error("Error in standard form detection", error);
    }
    
    return fields;
  };
  
  /**
   * Detect fields in table-based layouts
   */
  ns.detectTableFields = function() {
    ns.log("Starting table-based form detection");
    const fields = [];
    
    try {
      // Find tables that might contain form fields
      const tables = document.querySelectorAll('table');
      
      for (const table of tables) {
        // Check if this table has inputs
        const inputs = table.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
        );
        
        if (inputs.length < 2) {
          continue; // Skip tables with fewer than 2 inputs
        }
        
        ns.log(`Found table with ${inputs.length} potential form fields`);
        
        for (const input of inputs) {
          try {
            // Special extraction for table inputs that handles TD-based labels
            const fieldInfo = ns.extractTableFieldInfo(input, table);
            if (fieldInfo) {
              fields.push(fieldInfo);
            }
          } catch (err) {
            ns.error(`Error processing table input: ${input.name || input.id}`, err);
          }
        }
      }
      
      ns.log(`Table-based detection found ${fields.length} fields`);
    } catch (error) {
      ns.error("Error in table-based form detection", error);
    }
    
    return fields;
  };
  
  /**
   * Extract field information specifically for table-based layouts
   */
  ns.extractTableFieldInfo = function(input, table) {
    // Skip non-interactive or hidden inputs
    if (!ns.isInteractiveField(input)) {
      return null;
    }
    
    const name = input.name || '';
    const id = input.id || '';
    const type = input.type || input.tagName.toLowerCase();
    const required = input.required || input.getAttribute('aria-required') === 'true';
    let label = '';
    
    // Find containing cell
    const cell = input.closest('td, th');
    if (!cell) {
      // Not in a table cell, use standard extraction
      return ns.extractFieldInfo(input, "table-fallback");
    }
    
    // Track the reason for debugging
    const fieldId = id || name || Math.random().toString(36).substring(2, 10);
    
    // Try to find label in multiple ways:
    
    // 1. Check for label in previous cell in the same row
    const row = cell.closest('tr');
    if (row) {
      const cells = Array.from(row.querySelectorAll('td, th'));
      const cellIndex = cells.indexOf(cell);
      
      if (cellIndex > 0) {
        const potentialLabelCell = cells[cellIndex - 1];
        const potentialLabel = potentialLabelCell.textContent.trim();
        
        if (potentialLabel) {
          label = potentialLabel.replace(/[\*:]$/, '').trim(); // Remove trailing asterisks or colons
          ns.trackReason(fieldId, `Found label "${label}" in previous table cell`);
        }
      }
    }
    
    // 2. Check for label in header cell vertically aligned
    if (!label && table) {
      // Find the column index of this cell
      if (row) {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const colIndex = cells.indexOf(cell);
        
        if (colIndex >= 0) {
          // Look for header cells in the same column
          const headerRow = table.querySelector('tr:first-child, thead tr');
          if (headerRow) {
            const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
            if (headerCells.length > colIndex) {
              const headerCell = headerCells[colIndex];
              const headerText = headerCell.textContent.trim();
              
              if (headerText) {
                label = headerText.replace(/[\*:]$/, '').trim();
                ns.trackReason(fieldId, `Found label "${label}" in table header cell`);
              }
            }
          }
        }
      }
    }
    
    // 3. Check for standard label if we have an ID
    if (!label && id) {
      const labelElement = document.querySelector(`label[for="${id}"]`);
      if (labelElement) {
        label = labelElement.textContent.trim().replace(/[\*:]$/, '').trim();
        ns.trackReason(fieldId, `Found standard label element with for="${id}"`);
      }
    }
    
    // 4. Check for labels within the same cell
    if (!label) {
      const labelInCell = cell.querySelector('label');
      if (labelInCell && !labelInCell.querySelector('input, select, textarea')) {
        label = labelInCell.textContent.trim().replace(/[\*:]$/, '').trim();
        ns.trackReason(fieldId, `Found label element within same table cell`);
      }
    }
    
    // 5. Fallback to nearby text in the same cell
    if (!label) {
      // Get all text in the cell that's not inside the input
      const clone = cell.cloneNode(true);
      const inputToRemove = clone.querySelector('input, select, textarea');
      if (inputToRemove) {
        inputToRemove.remove();
      }
      const cellText = clone.textContent.trim();
      
      if (cellText) {
        label = cellText.replace(/[\*:]$/, '').trim();
        ns.trackReason(fieldId, `Found text "${label}" within same table cell`);
      }
    }
    
    // If still no label, try input attributes
    if (!label) {
      label = input.placeholder || input.title || name || id || 'Field';
      label = label.replace(/[-_]/g, ' ')
                  .replace(/([a-z])([A-Z])/g, '$1 $2') // Convert camelCase to spaces
                  .trim();
        
      // Capitalize first letter
      label = label.charAt(0).toUpperCase() + label.slice(1);
      ns.trackReason(fieldId, `Using fallback label from attributes: ${label}`);
    }
    
    // Determine field type
    const derivedType = ns.deriveFieldType(input, name, id, label);
    
    // Calculate confidence score
    const confidence = ns.calculateFieldConfidence(input, derivedType, label);
    
    return {
      name: name,
      id: id,
      type: type,
      label: label,
      required: required,
      derivedType: derivedType,
      confidence: confidence,
      detectionMethod: "table",
      reasons: ns.getReasons(fieldId)
    };
  };
  
  /**
   * Detect fields using ARIA attributes
   */
  ns.detectAriaFields = function() {
    ns.log("Starting ARIA-based form detection");
    const fields = [];
    
    try {
      // Find elements with ARIA roles that indicate they are form controls
      const ariaElements = document.querySelectorAll(ns.selectors.aria);
      
      for (const element of ariaElements) {
        try {
          // Check if this element is already a standard form control
          if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
            continue; // Skip to avoid duplicates with standard detection
          }
          
          const fieldInfo = ns.extractAriaFieldInfo(element);
          if (fieldInfo) {
            fields.push(fieldInfo);
          }
        } catch (err) {
          ns.error(`Error processing ARIA element`, err);
        }
      }
      
      ns.log(`ARIA-based detection found ${fields.length} fields`);
    } catch (error) {
      ns.error("Error in ARIA-based form detection", error);
    }
    
    return fields;
  };
  
  /**
   * Extract field information from an ARIA element
   */
  ns.extractAriaFieldInfo = function(element) {
    const role = element.getAttribute('role') || '';
    const id = element.id || '';
    const name = element.getAttribute('name') || '';
    const required = element.getAttribute('aria-required') === 'true';
    let label = '';
    
    // Generate a unique identifier for this field
    const fieldId = id || name || Math.random().toString(36).substring(2, 10);
    
    // Try to find the label in different ways
    
    // 1. Check for aria-label attribute
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      label = ariaLabel.trim();
      ns.trackReason(fieldId, `Found aria-label attribute: ${label}`);
    }
    
    // 2. Check for aria-labelledby attribute
    if (!label) {
      const labelledby = element.getAttribute('aria-labelledby');
      if (labelledby) {
        const labelElement = document.getElementById(labelledby);
        if (labelElement) {
          label = labelElement.textContent.trim();
          ns.trackReason(fieldId, `Found element referenced by aria-labelledby: ${label}`);
        }
      }
    }
    
    // 3. Check for associated label element
    if (!label && id) {
      const labelElement = document.querySelector(`label[for="${id}"]`);
      if (labelElement) {
        label = labelElement.textContent.trim();
        ns.trackReason(fieldId, `Found standard label element with for="${id}": ${label}`);
      }
    }
    
    // 4. Check for parent label
    if (!label && element.parentElement && element.parentElement.tagName === 'LABEL') {
      label = element.parentElement.textContent.trim();
      ns.trackReason(fieldId, `Found parent label element: ${label}`);
    }
    
    // 5. Use other attributes as fallback
    if (!label) {
      label = element.getAttribute('placeholder') || 
              element.getAttribute('title') ||
              name || id || 'Field';
      
      label = label.replace(/[-_]/g, ' ')
                    .replace(/([a-z])([A-Z])/g, '$1 $2') // Convert camelCase to spaces
                    .trim();
      
      // Capitalize first letter
      label = label.charAt(0).toUpperCase() + label.slice(1);
      ns.trackReason(fieldId, `Using fallback label from attributes: ${label}`);
    }
    
    // Map ARIA role to input type
    let inputType = 'text'; // Default
    
    switch (role) {
      case 'textbox':
        inputType = 'text';
        break;
      case 'searchbox':
        inputType = 'search';
        break;
      case 'combobox':
      case 'listbox':
        inputType = 'select';
        break;
      case 'checkbox':
        inputType = 'checkbox';
        break;
      case 'radio':
        inputType = 'radio';
        break;
      case 'spinbutton':
        inputType = 'number';
        break;
      case 'slider':
        inputType = 'range';
        break;
      default:
        if (element.getAttribute('contenteditable') === 'true') {
          inputType = 'textarea';
        }
    }
    
    // Determine field type
    const derivedType = ns.deriveFieldType(element, name, id, label);
    
    // Calculate confidence score
    const confidence = 0.7; // Base confidence for ARIA elements
    
    return {
      name: name,
      id: id,
      type: inputType,
      label: label,
      required: required,
      derivedType: derivedType,
      confidence: confidence,
      detectionMethod: "aria",
      isAriaElement: true,
      role: role,
      reasons: ns.getReasons(fieldId)
    };
  };
  
  /**
   * Detect fields in modern frameworks (React, Vue, Angular, etc.)
   */
  ns.detectModernFrameworkFields = function() {
    ns.log("Starting modern framework detection");
    const fields = [];
    
    try {
      // Find elements with framework-specific attributes
      const modernElements = document.querySelectorAll(ns.selectors.modern);
      
      for (const element of modernElements) {
        try {
          // Skip elements already found by standard HTML form detection
          if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
            // Only skip if they're in a form - standalone framework inputs should be detected
            if (element.closest('form')) {
              continue;
            }
          }
          
          const fieldInfo = ns.extractModernFieldInfo(element);
          if (fieldInfo) {
            fields.push(fieldInfo);
          }
        } catch (err) {
          ns.error(`Error processing modern framework element`, err);
        }
      }
      
      ns.log(`Modern framework detection found ${fields.length} fields`);
    } catch (error) {
      ns.error("Error in modern framework detection", error);
    }
    
    return fields;
  };
  
  /**
   * Extract field information from a modern framework element
   */
  ns.extractModernFieldInfo = function(element) {
    // Check if element is a real input or just a container
    const isContainer = !['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);
    
    // If it's a container, look for the actual input inside
    const inputElement = isContainer ? 
      element.querySelector('input, select, textarea') : element;
    
    // Use either the container or the nested input
    const targetElement = inputElement || element;
    
    // Get basic properties
    const id = targetElement.id || '';
    const name = targetElement.name || 
                targetElement.getAttribute('name') || 
                targetElement.getAttribute('data-name') || 
                targetElement.getAttribute('ng-model') || 
                targetElement.getAttribute('v-model') || 
                targetElement.getAttribute('formControlName') || '';
                
    let type = targetElement.type || 
              targetElement.getAttribute('type') || 
              'text';
              
    const required = targetElement.required || 
                    targetElement.getAttribute('aria-required') === 'true' || 
                    targetElement.hasAttribute('required') ||
                    targetElement.getAttribute('data-required') === 'true';
    
    // Generate a unique identifier for this field
    const fieldId = id || name || Math.random().toString(36).substring(2, 10);
    
    // Try to find the label
    let label = '';
    
    // 1. Check for associated label element
    if (id) {
      const labelElement = document.querySelector(`label[for="${id}"]`);
      if (labelElement) {
        label = labelElement.textContent.trim();
        ns.trackReason(fieldId, `Found standard label element with for="${id}": ${label}`);
      }
    }
    
    // 2. Check for parent or ancestor label
    if (!label) {
      let parent = targetElement.parentElement;
      while (parent && !label && parent !== document.body) {
        if (parent.tagName === 'LABEL') {
          // Clone to avoid getting the input's text
          const clone = parent.cloneNode(true);
          const inputToRemove = clone.querySelector('input, select, textarea');
          if (inputToRemove) {
            inputToRemove.remove();
          }
          label = clone.textContent.trim();
          ns.trackReason(fieldId, `Found ancestor label element: ${label}`);
          break;
        }
        
        // Check for elements often used as labels in frameworks
        if (parent.classList.contains('form-label') || 
            parent.classList.contains('control-label') || 
            parent.classList.contains('field-label') ||
            parent.getAttribute('aria-label')) {
          label = parent.textContent.trim();
          ns.trackReason(fieldId, `Found framework label element: ${label}`);
          break;
        }
        
        parent = parent.parentElement;
      }
    }
    
    // 3. Check for label element in a common pattern (sibling or nearby element)
    if (!label) {
      // Look for previous sibling with common label classes
      let prevElement = targetElement.previousElementSibling;
      if (prevElement && (
          prevElement.tagName === 'LABEL' || 
          prevElement.classList.contains('label') ||
          prevElement.classList.contains('form-label') || 
          prevElement.getAttribute('aria-label'))) {
        label = prevElement.textContent.trim();
        ns.trackReason(fieldId, `Found previous sibling label element: ${label}`);
      }
    }
    
    // 4. Try looking for a field wrapper pattern common in frameworks
    if (!label) {
      // Get parent with field container classes
      const fieldContainer = targetElement.closest('.form-group, .field-group, .form-field, .field-container, .form-control-group');
      if (fieldContainer) {
        // Look for label within this container, but not containing our input
        const containerLabels = Array.from(fieldContainer.querySelectorAll('label, .form-label, .field-label, .control-label'));
        for (const containerLabel of containerLabels) {
          if (!containerLabel.contains(targetElement)) {
            label = containerLabel.textContent.trim();
            ns.trackReason(fieldId, `Found label in field container: ${label}`);
            break;
          }
        }
      }
    }
    
    // 5. Use other attributes as fallback
    if (!label) {
      label = targetElement.getAttribute('placeholder') || 
              targetElement.getAttribute('aria-label') || 
              targetElement.getAttribute('title') ||
              name || id || 'Field';
      
      label = label.replace(/[-_]/g, ' ')
                    .replace(/([a-z])([A-Z])/g, '$1 $2') // Convert camelCase to spaces
                    .trim();
      
      // Capitalize first letter
      label = label.charAt(0).toUpperCase() + label.slice(1);
      ns.trackReason(fieldId, `Using fallback label from attributes: ${label}`);
    }
    
    // Check for framework-specific attributes to determine field type
    const ngModel = targetElement.getAttribute('ng-model') || '';
    const vModel = targetElement.getAttribute('v-model') || '';
    const formControlName = targetElement.getAttribute('formControlName') || '';
    const dataType = targetElement.getAttribute('data-type') || '';
    
    // Combine all potential type indicators
    const typeHints = [ngModel, vModel, formControlName, dataType, name, id].join(' ').toLowerCase();
    
    // Override type based on framework hints
    if (typeHints.includes('password')) {
      type = 'password';
    } else if (typeHints.includes('email')) {
      type = 'email';
    } else if (typeHints.includes('phone') || typeHints.includes('tel')) {
      type = 'tel';
    } else if (typeHints.includes('date')) {
      type = 'date';
    }
    
    // Special handling for checkboxes and radio buttons
    if (targetElement.tagName === 'INPUT' && targetElement.getAttribute('type') === 'checkbox') {
      type = 'checkbox';
    } else if (targetElement.tagName === 'INPUT' && targetElement.getAttribute('type') === 'radio') {
      type = 'radio';
    } else if (targetElement.tagName === 'SELECT') {
      type = 'select';
    } else if (targetElement.tagName === 'TEXTAREA') {
      type = 'textarea';
    }
    
    // Determine field type
    const derivedType = ns.deriveFieldType(targetElement, name, id, label);
    
    // Calculate confidence score (slightly lower for framework detection)
    const confidence = ns.calculateFieldConfidence(targetElement, derivedType, label) * 0.9;
    
    return {
      name: name,
      id: id,
      type: type,
      label: label,
      required: required,
      derivedType: derivedType,
      confidence: confidence,
      detectionMethod: "modern",
      reasons: ns.getReasons(fieldId)
    };
  };
  
  /**
   * Detect form fields by analyzing spatial proximity of text and inputs
   */
  ns.detectByProximity = function() {
    ns.log("Starting proximity-based form detection");
    const fields = [];
    
    try {
      // Find all visible inputs
      const inputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
      );
      
      if (inputs.length === 0) {
        return [];
      }
      
      for (const input of inputs) {
        try {
          const fieldInfo = ns.extractProximityFieldInfo(input);
          if (fieldInfo) {
            fields.push(fieldInfo);
          }
        } catch (err) {
          ns.error(`Error processing input in proximity detection`, err);
        }
      }
      
      ns.log(`Proximity-based detection found ${fields.length} fields`);
    } catch (error) {
      ns.error("Error in proximity-based form detection", error);
    }
    
    return fields;
  };
  
  /**
   * Extract field information using text proximity analysis
   */
  ns.extractProximityFieldInfo = function(input) {
    // Skip non-interactive or hidden inputs
    if (!ns.isInteractiveField(input)) {
      return null;
    }
    
    const name = input.name || '';
    const id = input.id || '';
    const type = input.type || input.tagName.toLowerCase();
    const required = input.required || input.getAttribute('aria-required') === 'true';
    
    // Generate a unique identifier for this field
    const fieldId = id || name || Math.random().toString(36).substring(2, 10);
    
    // Try standard label methods first
    let label = ns.findStandardLabel(input);
    
    // If no label found, try proximity detection
    if (!label) {
      label = ns.findNearestText(input);
      if (label) {
        ns.trackReason(fieldId, `Found label "${label}" by proximity analysis`);
      }
    }
    
    // If still no label, use attributes
    if (!label) {
      label = input.placeholder || input.title || name || id || 'Field';
      label = label.replace(/[-_]/g, ' ')
                  .replace(/([a-z])([A-Z])/g, '$1 $2') // Convert camelCase to spaces
                  .trim();
        
      // Capitalize first letter
      label = label.charAt(0).toUpperCase() + label.slice(1);
      ns.trackReason(fieldId, `Using fallback label from attributes: ${label}`);
    }
    
    // Determine field type
    const derivedType = ns.deriveFieldType(input, name, id, label);
    
    // Calculate confidence score (lower for proximity detection)
    const confidence = ns.calculateFieldConfidence(input, derivedType, label) * 0.8;
    
    return {
      name: name,
      id: id,
      type: type,
      label: label,
      required: required,
      derivedType: derivedType,
      confidence: confidence,
      detectionMethod: "proximity",
      reasons: ns.getReasons(fieldId)
    };
  };
  
  /**
   * Find the nearest text that could be a label for an input
   */
  ns.findNearestText = function(input) {
    // Get input position
    const inputRect = input.getBoundingClientRect();
    
    // Create the text walker to examine text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let closestText = '';
    let minDistance = 150; // Max pixel distance to consider
    
    let node;
    while (node = walker.nextNode()) {
      // Skip empty nodes or those with just whitespace
      const text = node.nodeValue.trim();
      if (!text || text.length < 2) {
        continue;
      }
      
      // Skip if inside the input itself
      if (input.contains(node) || node.parentNode === input) {
        continue;
      }
      
      // Get text node position
      const range = document.createRange();
      range.selectNodeContents(node);
      const textRect = range.getBoundingClientRect();
      
      // Calculate distance between centers
      const distance = ns.getDistance(textRect, inputRect);
      
      // Keep closest text
      if (distance < minDistance) {
        minDistance = distance;
        
        // Trim and clean up the text
        let cleanText = text;
        
        // Remove trailing colon (common in labels)
        if (cleanText.endsWith(':')) {
          cleanText = cleanText.slice(0, -1).trim();
        }
        
        // Limit length
        if (cleanText.length > 50) {
          cleanText = cleanText.substring(0, 50) + '...';
        }
        
        // Capitalize first letter
        cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
        
        closestText = cleanText;
      }
    }
    
    return closestText;
  };
  
  /**
   * Calculate distance between two DOM rectangles
   */
  ns.getDistance = function(rect1, rect2) {
    // Calculate centers
    const center1 = {
      x: rect1.left + rect1.width / 2,
      y: rect1.top + rect1.height / 2
    };
    
    const center2 = {
      x: rect2.left + rect2.width / 2,
      y: rect2.top + rect2.height / 2
    };
    
    // Return Euclidean distance between centers
    return Math.sqrt(
      Math.pow(center1.x - center2.x, 2) +
      Math.pow(center1.y - center2.y, 2)
    );
  };
  
  /**
   * Special detection for login forms with username and password
   */
  ns.detectLoginForm = function() {
    ns.log("Starting login form detection");
    const fields = [];
    
    try {
      // Look for password fields
      const passwordFields = document.querySelectorAll('input[type="password"]');
      
      if (passwordFields.length === 0) {
        return [];
      }
      
      // For each password field, try to find an associated username field
      for (const passwordField of passwordFields) {
        // Look for container that might hold both fields
        const possibleContainers = [
          passwordField.closest('form'),
          passwordField.closest('div'),
          passwordField.closest('fieldset'),
          passwordField.closest('.form-group'),
          passwordField.closest('.login-form'),
          passwordField.closest('.signin-form')
        ].filter(Boolean); // Remove nulls
        
        if (possibleContainers.length === 0) {
          continue;
        }
        
        // Find most specific container (the smallest one)
        let bestContainer = possibleContainers[0];
        let minArea = Number.MAX_VALUE;
        
        for (const container of possibleContainers) {
          const rect = container.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (area < minArea) {
            minArea = area;
            bestContainer = container;
          }
        }
        
        // Look for username/email input in this container
        const potentialUserFields = Array.from(bestContainer.querySelectorAll(
          'input[type="text"], input[type="email"], input:not([type])'
        )).filter(input => {
          // Filter by name/id containing username/email patterns
          const identifier = (input.name || '') + ' ' + (input.id || '');
          return identifier.toLowerCase().match(/user|email|login|account/);
        });
        
        // If no username field found by type, look for the input that comes before password
        if (potentialUserFields.length === 0) {
          const allInputs = Array.from(bestContainer.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])'
          ));
          
          const passwordIndex = allInputs.indexOf(passwordField);
          if (passwordIndex > 0) {
            // Use the input that comes just before the password
            potentialUserFields.push(allInputs[passwordIndex - 1]);
          }
        }
        
        // If we found a username field, create the login form
        if (potentialUserFields.length > 0) {
          const usernameField = potentialUserFields[0];
          
          // Create username field
          fields.push({
            name: usernameField.name || usernameField.id || 'username',
            id: usernameField.id || '',
            type: usernameField.type || 'text',
            label: ns.findStandardLabel(usernameField) || 'Username',
            required: true,
            derivedType: 'username',
            confidence: 0.9,
            detectionMethod: "login",
            reasons: ['Detected as part of username/password pair']
          });
          
          // Create password field
          fields.push({
            name: passwordField.name || passwordField.id || 'password',
            id: passwordField.id || '',
            type: 'password',
            label: ns.findStandardLabel(passwordField) || 'Password',
            required: true,
            derivedType: 'password',
            confidence: 0.95,
            detectionMethod: "login",
            reasons: ['Detected password field in login form']
          });
          
          // Only need to process one login form
          break;
        }
      }
      
      ns.log(`Login form detection found ${fields.length} fields`);
    } catch (error) {
      ns.error("Error in login form detection", error);
    }
    
    return fields;
  };
  
  /**
   * Detect fields in Shadow DOM
   */
  ns.detectShadowDomFields = function() {
    ns.log("Starting Shadow DOM detection");
    const fields = [];
    
    try {
      // Find all elements that may have shadow roots
      const allElements = document.querySelectorAll('*');
      const shadowRoots = [];
      
      // Collect all shadow roots
      for (const element of allElements) {
        if (element.shadowRoot) {
          shadowRoots.push(element.shadowRoot);
        }
      }
      
      if (shadowRoots.length === 0) {
        return [];
      }
      
      ns.log(`Found ${shadowRoots.length} shadow roots`);
      
      // Process each shadow root
      for (const root of shadowRoots) {
        try {
          // Find form elements in shadow DOM
          const shadowInputs = root.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
          );
          
          if (shadowInputs.length === 0) {
            continue;
          }
          
          for (const input of shadowInputs) {
            try {
              // Use standard extraction but mark as shadow DOM
              const fieldInfo = ns.extractFieldInfo(input, "shadow");
              if (fieldInfo) {
                // Add shadow DOM specific information
                fieldInfo.inShadowDOM = true;
                fields.push(fieldInfo);
              }
            } catch (err) {
              ns.error(`Error processing shadow DOM input`, err);
            }
          }
        } catch (err) {
          ns.error(`Error processing shadow root`, err);
        }
      }
      
      ns.log(`Shadow DOM detection found ${fields.length} fields`);
    } catch (error) {
      ns.error("Error in Shadow DOM detection", error);
    }
    
    return fields;
  };
  
  /**
   * Fallback method: detect all visible input fields on the page
   */
  ns.detectAllVisibleFields = function() {
    ns.log("Starting fallback detection for any visible inputs");
    const fields = [];
    
    try {
      // Find all input elements with an expanded selector in test mode
      const standardSelector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea';
      
      // In test mode, add more specific selectors to catch important field types
      const testModeSelector = ns.testMode ? 
                          standardSelector + ', input[type="file"], input[type="checkbox"], input[type="radio"]' : 
                          standardSelector;
      
      const allInputs = document.querySelectorAll(testModeSelector);
      
      console.log(`🔍 Fallback detection running with selector: ${testModeSelector}`);
      console.log(`🔍 Found ${allInputs.length} potential input elements`);
      
      // Count inputs by type for debugging
      if (ns.testMode) {
        const typeCount = {};
        allInputs.forEach(input => {
          const type = input.type || input.tagName.toLowerCase();
          typeCount[type] = (typeCount[type] || 0) + 1;
        });
        console.log("📊 Input types found:", typeCount);
      }
      
      // In test mode, always log details about certain key field types
      if (ns.testMode) {
        // Log details about file inputs, textareas, and radio/checkboxes
        const specialInputs = Array.from(document.querySelectorAll('input[type="file"], textarea, input[type="checkbox"], input[type="radio"]'));
        if (specialInputs.length > 0) {
          console.log(`🔍 Found ${specialInputs.length} special input elements:`);
          specialInputs.forEach((input, index) => {
            console.log(`  - Special input ${index + 1}: ${input.tagName} type=${input.type || 'N/A'} id=${input.id || 'none'} name=${input.name || 'none'}`);
          });
        }
      }
      
      // Track excluded fields for debugging
      const excludedFields = [];
      
      // Process each input
      for (const input of allInputs) {
        try {
          // Check interactivity with test mode considerations
          const isInteractive = ns.isInteractiveField(input);
          
          if (!isInteractive) {
            excludedFields.push({
              type: input.type || input.tagName.toLowerCase(),
              id: input.id || '',
              name: input.name || '',
              reason: 'Not interactive'
            });
            continue;
          }
          
          // In test mode, force examination of special field types
          let forceExamine = false;
          if (ns.testMode) {
            if (input.type === 'file' || input.tagName === 'TEXTAREA' || 
                input.type === 'checkbox' || input.type === 'radio') {
              forceExamine = true;
              console.log(`⚠️ TEST MODE: Force examining special field type: ${input.type || input.tagName}`);
            }
          }
          
          // Check visibility - in test mode special fields get special treatment
          if (forceExamine || ns.isVisibleElement(input)) {
            const fieldInfo = ns.extractFieldInfo(input, "fallback");
            if (fieldInfo) {
              fields.push(fieldInfo);
            } else {
              excludedFields.push({
                type: input.type || input.tagName.toLowerCase(),
                id: input.id || '',
                name: input.name || '',
                reason: 'Failed to extract field info'
              });
            }
          } else {
            excludedFields.push({
              type: input.type || input.tagName.toLowerCase(),
              id: input.id || '',
              name: input.name || '',
              reason: 'Not visible'
            });
          }
        } catch (err) {
          ns.error(`Error processing fallback input`, err);
          excludedFields.push({
            type: input.type || input.tagName.toLowerCase(),
            id: input.id || '',
            name: input.name || '',
            reason: `Error: ${err.message}`
          });
        }
      }
      
      if (ns.testMode && excludedFields.length > 0) {
        console.log(`⚠️ Excluded ${excludedFields.length} fields in fallback detection:`, excludedFields);
      }
      
      ns.log(`Fallback detection found ${fields.length} fields (excluded ${excludedFields.length})`);
    } catch (error) {
      ns.error("Error in fallback detection", error);
    }
    
    return fields;
  };
  
  /**
   * Standard extraction of field information
   */
  ns.extractFieldInfo = function(input, method) {
    // Skip non-interactive or hidden inputs
    if (!ns.isInteractiveField(input)) {
      return null;
    }
    
    const name = input.name || '';
    const id = input.id || '';
    const type = input.type || input.tagName.toLowerCase();
    const placeholder = input.placeholder || '';
    const required = input.required || input.getAttribute('aria-required') === 'true';
    
    // Skip if no way to identify
    if (!name && !id && !placeholder) {
      return null;
    }
    
    // Generate a unique identifier for this field
    const fieldId = id || name || Math.random().toString(36).substring(2, 10);
    
    // Find label
    let label = ns.findStandardLabel(input);
    
    // If no label found, use attributes
    if (!label) {
      label = placeholder || input.title || name || id || 'Field';
      label = label.replace(/[-_]/g, ' ')
                  .replace(/([a-z])([A-Z])/g, '$1 $2') // Convert camelCase to spaces
                  .trim();
        
      // Capitalize first letter
      label = label.charAt(0).toUpperCase() + label.slice(1);
      ns.trackReason(fieldId, `Using fallback label from attributes: ${label}`);
    }
    
    // Determine field type
    const derivedType = ns.deriveFieldType(input, name, id, label);
    
    // Calculate confidence score
    const confidence = ns.calculateFieldConfidence(input, derivedType, label);
    
    return {
      name: name,
      id: id,
      type: type,
      label: label,
      required: required,
      derivedType: derivedType,
      confidence: confidence,
      detectionMethod: method || "standard",
      reasons: ns.getReasons(fieldId)
    };
  };
  
  /**
   * Find label using standard methods
   */
  ns.findStandardLabel = function(input) {
    let label = '';
    const id = input.id || '';
    
    // Generate a unique identifier for this field
    const fieldId = id || input.name || Math.random().toString(36).substring(2, 10);
    
    // 1. Check for explicit label with 'for' attribute
    if (id) {
      const labelElement = document.querySelector(`label[for="${id}"]`);
      if (labelElement) {
        label = labelElement.textContent.trim();
        ns.trackReason(fieldId, `Found standard label element with for="${id}": ${label}`);
        return label;
      }
    }
    
    // 2. Check for parent label
    if (input.parentElement && input.parentElement.tagName === 'LABEL') {
      // Clone to avoid getting the input's text
      const clone = input.parentElement.cloneNode(true);
      const inputToRemove = clone.querySelector('input, select, textarea');
      if (inputToRemove) {
        inputToRemove.remove();
      }
      label = clone.textContent.trim();
      ns.trackReason(fieldId, `Found parent label element: ${label}`);
      return label;
    }
    
    // 3. Look for labels in common wrappers
    const wrapper = input.closest('.form-group, .input-group, .field-group, .form-row');
    if (wrapper) {
      const wrapperLabel = wrapper.querySelector('label');
      if (wrapperLabel && !wrapperLabel.querySelector('input, select, textarea')) {
        label = wrapperLabel.textContent.trim();
        ns.trackReason(fieldId, `Found label in form group wrapper: ${label}`);
        return label;
      }
    }
    
    // 4. Check for ARIA attributes
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) {
      label = ariaLabel.trim();
      ns.trackReason(fieldId, `Found aria-label attribute: ${label}`);
      return label;
    }
    
    const labelledby = input.getAttribute('aria-labelledby');
    if (labelledby) {
      const labelElement = document.getElementById(labelledby);
      if (labelElement) {
        label = labelElement.textContent.trim();
        ns.trackReason(fieldId, `Found element referenced by aria-labelledby: ${label}`);
        return label;
      }
    }
    
    // 5. Look for preceding element that could be a label
    let prevElem = input.previousElementSibling;
    if (prevElem && (prevElem.tagName === 'LABEL' || 
                    prevElem.tagName === 'SPAN' || 
                    prevElem.tagName === 'DIV')) {
      // Make sure it doesn't contain other inputs
      if (!prevElem.querySelector('input, select, textarea')) {
        label = prevElem.textContent.trim();
        ns.trackReason(fieldId, `Found preceding sibling as label: ${label}`);
        return label;
      }
    }
    
    // No label found using standard methods
    return '';
  };
  
  /**
   * Determine field type from various attributes
   */
  ns.deriveFieldType = function(input, name, id, label) {
    // If this is already a specific HTML type, use it
    if (input.type === 'email') return 'email';
    if (input.type === 'password') return 'password';
    if (input.type === 'tel') return 'phone';
    if (input.type === 'checkbox') return 'checkbox';
    if (input.type === 'radio') return 'radio';
    if (input.type === 'file') return 'file';
    if (input.type === 'date') return 'date';
    if (input.type === 'time') return 'time';
    if (input.type === 'number') return 'number';
    if (input.type === 'range') return 'range';
    if (input.type === 'search') return 'search';
    if (input.type === 'url') return 'url';
    if (input.type === 'color') return 'color';
    if (input.tagName === 'TEXTAREA') return 'textarea';
    if (input.tagName === 'SELECT') return 'select';
    
    // Pattern matching on name, id, and label
    const attributeText = [
      (name || '').toLowerCase(), 
      (id || '').toLowerCase(), 
      (label || '').toLowerCase(),
      (input.placeholder || '').toLowerCase()
    ].join(' ');
    
    // Check against all field patterns
    for (const [fieldType, config] of Object.entries(ns.fieldPatterns)) {
      for (const pattern of config.patterns) {
        if (pattern.test(attributeText)) {
          return fieldType;
        }
      }
    }
    
    // Default to text
    return 'text';
  };
  
  /**
   * Calculate confidence score for a field
   */
  ns.calculateFieldConfidence = function(input, derivedType, label) {
    if (!input) {
      if (ns.testMode) {
        console.log("⚠️ Cannot calculate confidence: input element is null");
      }
      return 0.4; // Neutral confidence when element not available
    }
    
    let score = 0.5; // Start with neutral score
    const scoreFactors = {}; // Track factors affecting the score
    
    // Having identifiers increases confidence
    if (input.name) {
      score += 0.1;
      scoreFactors.name = "+0.1";
    }
    
    if (input.id) {
      score += 0.1;
      scoreFactors.id = "+0.1";
    }
    
    if (input.placeholder) {
      score += 0.05;
      scoreFactors.placeholder = "+0.05";
    }
    
    // Required fields more likely to be important
    if (input.required || input.getAttribute('aria-required') === 'true') {
      score += 0.1;
      scoreFactors.required = "+0.1";
    }
    
    // Label presence significantly increases confidence
    if (label && label !== input.name && label !== input.id) {
      score += 0.15;
      scoreFactors.label = "+0.15";
    }
    
    // Specific HTML types increase confidence
    const specificTypes = ['email', 'password', 'tel', 'date', 'number', 'file', 'checkbox', 'radio', 'textarea'];
    if (specificTypes.includes(input.type) || input.tagName.toLowerCase() === 'textarea' || 
        input.tagName.toLowerCase() === 'select') {
      score += 0.15;
      scoreFactors.specificType = `+0.15 (${input.type || input.tagName.toLowerCase()})`;
    }
    
    // Field type patterns
    const pattern = ns.fieldPatterns[derivedType];
    if (pattern && pattern.score) {
      const oldScore = score;
      score = (score + pattern.score) / 2; // Average with pattern score
      scoreFactors.patternMatch = `pattern match: ${derivedType} (${oldScore} → ${score.toFixed(2)})`;
    }
    
    // Presence in a form element increases confidence
    if (input.closest('form')) {
      score += 0.05;
      scoreFactors.inForm = "+0.05";
    }
    
    // Special common form field types
    if (input.type === 'file') {
      score += 0.1; // File inputs are almost always legitimate form fields
      scoreFactors.fileInput = "+0.1";
    }
    
    if (input.type === 'checkbox' || input.type === 'radio') {
      score += 0.05; // Checkboxes and radios are likely form elements
      scoreFactors.checkboxOrRadio = "+0.05";
    }
    
    // Look for text area elements
    if (input.tagName === 'TEXTAREA') {
      score += 0.15; // Text areas are almost definitely form fields
      scoreFactors.textarea = "+0.15";
    }
    
    // Size check (elements too small might be decorative)
    try {
      const rect = input.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) {
        score -= 0.1;
        scoreFactors.tooSmall = "-0.1 (size too small)";
      }
    } catch (e) {
      // Ignore any errors getting element size
    }
    
    // Adjust for elements that are likely not real form fields
    
    // Check for potential decorative or non-interactive elements
    let isLikelyDecorative = false;
    if (input.readOnly && !input.required) {
      isLikelyDecorative = true;
      scoreFactors.readOnly = "-0.2 (read-only without required)";
    }
    
    if (input.disabled && !input.required) {
      isLikelyDecorative = true;
      scoreFactors.disabled = "-0.2 (disabled without required)";
    }
    
    if (input.classList.contains('disabled')) {
      isLikelyDecorative = true;
      scoreFactors.cssDisabled = "-0.2 (CSS disabled class)";
    }
    
    if (input.getAttribute('tabindex') === '-1') {
      isLikelyDecorative = true;
      scoreFactors.tabindex = "-0.2 (tabindex=-1)";
    }
    
    if (input.getAttribute('aria-hidden') === 'true') {
      isLikelyDecorative = true;
      scoreFactors.ariaHidden = "-0.2 (aria-hidden=true)";
    }
    
    if (isLikelyDecorative) {
      score -= 0.2;
    }
    
    // Check for common CSS classes that indicate non-field elements
    const nonFieldClasses = ['hidden', 'invisible', 'display-none', 'sr-only', 'visually-hidden'];
    for (const cls of nonFieldClasses) {
      if (input.classList.contains(cls)) {
        score -= 0.1;
        scoreFactors.hiddenClass = `-0.1 (class: ${cls})`;
      }
    }
    
    // TEST MODE: Special handling for checkbox, radio, file, and textarea
    if (ns.testMode) {
      // Ensure certain field types are detected reliably in test mode
      if (input.type === 'file' || input.tagName === 'TEXTAREA' || 
          input.type === 'checkbox' || input.type === 'radio') {
        // Ensure minimum score of 0.5 for these types
        if (score < 0.5) {
          const oldScore = score;
          score = Math.max(0.5, score);
          scoreFactors.testModeBump = `Special field type boost: ${oldScore.toFixed(2)} → ${score.toFixed(2)}`;
        }
      }
    }
    
    // Clamp to 0-1 range
    const finalScore = Math.max(0, Math.min(1, score));
    
    // In test mode, log score factors
    if (ns.testMode) {
      console.log(`🧮 Confidence factors for "${input.name || input.id || 'unnamed'}" (${input.type || input.tagName.toLowerCase()}):`, 
                  scoreFactors, `Final score: ${finalScore.toFixed(2)}`);
    }
    
    return finalScore;
  };
  
  /**
   * Check if an element is an interactive field that should be included
   */
  ns.isInteractiveField = function(element) {
    // Element must exist
    if (!element) {
      return false;
    }
    
    if (ns.testMode) {
      console.log(`🔎 Checking if element is interactive: ${element.tagName} ${element.type || ''} ${element.id || element.name || ''}`);
    }
    
    // Must be an input, select, or textarea
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName) && 
        element.getAttribute('contenteditable') !== 'true' &&
        !element.getAttribute('role')) {
      if (ns.testMode) {
        console.log(`❌ Not interactive: Not a form element or contenteditable - ${element.tagName}`);
      }
      return false;
    }
    
    // Skip non-visible elements unless in test mode
    if (!ns.isVisibleElement(element)) {
      if (ns.testMode) {
        console.log(`❌ Not interactive: Element not visible - ${element.id || element.name || element.tagName}`);
        // In test mode, allow invisible elements if they are specific types we care about
        if (element.type === 'file' || element.type === 'checkbox' || 
            element.type === 'radio' || element.tagName === 'TEXTAREA') {
          console.log(`⚠️ TEST MODE OVERRIDE: Including invisible ${element.type || element.tagName} element`);
          return true;
        }
      }
      return false;
    }
    
    // Skip certain input types
    if (element.tagName === 'INPUT') {
      const excludedTypes = ['hidden', 'submit', 'button', 'reset', 'image'];
      
      if (excludedTypes.includes(element.type)) {
        if (ns.testMode) {
          console.log(`❌ Not interactive: Input type '${element.type}' is excluded`);
        }
        return false;
      }
    }
    
    if (ns.testMode) {
      console.log(`✅ Element is interactive: ${element.tagName} ${element.type || ''} ${element.id || element.name || ''}`);
    }
    
    return true;
  };
  
  /**
   * Check if an element is visible
   */
  ns.isVisibleElement = function(element) {
    if (!element) {
      return false;
    }
    
    try {
      const style = window.getComputedStyle(element);
      
      // Check CSS visibility properties
      if (style.display === 'none') {
        if (ns.testMode) {
          console.log(`⚠️ Visibility check: Element has display:none - ${element.id || element.name || element.tagName}`);
        }
        return false;
      }
      
      if (style.visibility === 'hidden') {
        if (ns.testMode) {
          console.log(`⚠️ Visibility check: Element has visibility:hidden - ${element.id || element.name || element.tagName}`);
        }
        return false;
      }
      
      if (style.opacity === '0') {
        if (ns.testMode) {
          console.log(`⚠️ Visibility check: Element has opacity:0 - ${element.id || element.name || element.tagName}`);
        }
        return false;
      }
      
      // Check element dimensions
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        if (ns.testMode) {
          console.log(`⚠️ Visibility check: Element has zero size - ${element.id || element.name || element.tagName}`);
          
          // For special field types in test mode, print more details
          if (element.type === 'file' || element.type === 'checkbox' || element.type === 'radio' ||
              element.tagName === 'TEXTAREA') {
            console.log(`📏 Element dimensions: ${JSON.stringify({
              width: rect.width,
              height: rect.height,
              top: rect.top,
              left: rect.left,
              type: element.type || element.tagName,
              id: element.id || '',
              name: element.name || ''
            })}`);
          }
        }
        return false;
      }
      
      // Specific check for file inputs which might be deliberately hidden by CSS
      // but are still functional form elements
      if (element.type === 'file' && (rect.width < 5 || rect.height < 5)) {
        if (ns.testMode) {
          console.log(`⚠️ Found tiny file input - likely deliberately hidden for styling`);
          // In test mode, count this as visible despite small size
          return true;
        }
      }
      
      // Check aria-hidden attribute
      if (element.getAttribute('aria-hidden') === 'true') {
        if (ns.testMode) {
          console.log(`⚠️ Visibility check: Element has aria-hidden="true" - ${element.id || element.name || element.tagName}`);
        }
        return false;
      }
      
      // Check if really offscreen (might be a technique to hide elements)
      // But we need to be careful with this check as some legitimate elements might be offscreen initially
      if (rect.top < -2000 || rect.left < -2000) {
        if (ns.testMode) {
          console.log(`⚠️ Element positioned far offscreen - ${element.id || element.name || element.tagName} - Position: ${rect.top}, ${rect.left}`);
        }
        // Don't automatically exclude offscreen elements in test mode
        if (!ns.testMode) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      if (ns.testMode) {
        console.log(`⚠️ Error checking visibility:`, error);
      }
      // If any error occurs, assume it's visible
      return true;
    }
  };
  
  /**
   * Remove duplicate fields from detection
   */
  ns.deduplicate = function(fields) {
    const uniqueFields = [];
    const seen = new Map();
    
    for (const field of fields) {
      // Create a unique identifier using name, id, and type
      const key = [
        field.name || '',
        field.id || '',
        field.type || ''
      ].join('|');
      
      // If we've already seen this field, keep the one with highest confidence
      if (seen.has(key)) {
        const existingIndex = seen.get(key);
        const existing = uniqueFields[existingIndex];
        
        // Replace only if this field has higher confidence
        if (field.confidence > existing.confidence) {
          uniqueFields[existingIndex] = field;
        }
      } else {
        // Add new field and track its index
        seen.set(key, uniqueFields.length);
        uniqueFields.push(field);
      }
    }
    
    return uniqueFields;
  };
  
  /**
   * Score fields and filter out unlikely ones
   */
  ns.scoreAndFilterFields = function(fields) {
    if (!fields || fields.length === 0) {
      console.log("⚠️ No fields to score and filter");
      return [];
    }
    
    console.log(`⚖️ Scoring and filtering ${fields.length} fields`);
    
    // Define the minimum confidence threshold
    const MIN_CONFIDENCE = ns.testMode ? 0.3 : 0.4; // Lower threshold in test mode
    
    // First ensure all fields have confidence scores
    const scoredFields = fields.map(field => {
      // If no confidence value, calculate one
      if (field.confidence === undefined) {
        const element = document.getElementById(field.id) || 
                      (field.name ? document.querySelector(`[name="${field.name}"]`) : null);
        
        if (element) {
          field.confidence = ns.calculateFieldConfidence(
            element,
            field.derivedType,
            field.label
          );
        } else {
          // Element not found in DOM, use basic confidence
          field.confidence = 0.5;
          if (ns.testMode) {
            console.log(`⚠️ Element not found in DOM for scoring: ${field.id || field.name}`);
          }
        }
      }
      
      // In test mode, log detailed confidence scores
      if (ns.testMode) {
        console.log(`Field scoring: "${field.name || field.id}" (${field.type}) - Confidence: ${field.confidence.toFixed(2)}`);
      }
      
      return field;
    });
    
    // Filter out low-confidence fields (likely decorative or false positives)
    const filteredFields = [];
    const rejectedFields = [];
    
    scoredFields.forEach(field => {
      if (field.confidence >= MIN_CONFIDENCE) {
        // Keep this field
        filteredFields.push(field);
      } else {
        if (ns.testMode) {
          console.log(`❌ Rejected field "${field.name || field.id}" - low confidence: ${field.confidence.toFixed(2)}`);
        }
        rejectedFields.push({
          name: field.name,
          id: field.id, 
          type: field.type,
          confidence: field.confidence,
          reason: `Low confidence score: ${field.confidence.toFixed(2)} < ${MIN_CONFIDENCE}`
        });
      }
    });
    
    // Deduplicate fields
    const uniqueFields = ns.deduplicate(filteredFields);
    
    // Log all field rejections
    if (ns.testMode) {
      console.log(`❌ Rejected ${rejectedFields.length} low-confidence fields:`, rejectedFields);
      console.log(`♻️ Removed ${filteredFields.length - uniqueFields.length} duplicate fields`);
    }
    
    // Sort by confidence (highest first)
    uniqueFields.sort((a, b) => b.confidence - a.confidence);
    
    // If we're in test mode and few fields were found, reduce the confidence threshold
    if (ns.testMode && uniqueFields.length < 3 && scoredFields.length > uniqueFields.length) {
      console.log(`⚠️ TEST MODE: Too few fields detected (${uniqueFields.length}), reducing confidence threshold`);
      return ns.scoreAndFilterFieldsLenient(scoredFields);
    }
    
    ns.log(`Scored ${fields.length} fields, kept ${uniqueFields.length} after filtering`);
    
    return uniqueFields;
  };
  
  /**
   * More lenient scoring for test mode
   */
  ns.scoreAndFilterFieldsLenient = function(scoredFields) {
    console.log("🔍 Using lenient field filtering in test mode");
    
    // Use a much lower threshold
    const LENIENT_THRESHOLD = 0.2;
    
    const filteredFields = scoredFields.filter(field => field.confidence >= LENIENT_THRESHOLD);
    const uniqueFields = ns.deduplicate(filteredFields);
    
    console.log(`🧮 Lenient filtering: Kept ${uniqueFields.length} of ${scoredFields.length} fields`);
    
    return uniqueFields;
  };
  
  /**
   * Create debug info function for testing
   */
  ns.getDebugInfo = function() {
    return {
      detectionMethods: ns.usedMethods,
      detectionReasons: Array.from(ns.detectionReasons.entries()).reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {}),
      fieldCount: {
        rawFields: ns.lastRawCount || 0,
        filteredFields: ns.lastFilteredCount || 0
      }
    };
  };

})(window.EnhancedFieldDetector);

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
  console.log("✨ Enhanced Field Detector loaded - combining multiple detection methods");
});