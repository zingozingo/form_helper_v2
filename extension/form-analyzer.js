/**
 * AI Form Helper - Form Analyzer
 * 
 * This script is injected only when the user explicitly activates the extension
 * or on allowed sites with auto-detection enabled.
 * It analyzes forms on the page and sends the results back to the background script.
 * On allowed sites, it can also display the form detection UI.
 */

(function() {
  // Configuration settings received from background
  let settings = {
    highlightFields: true,
    autoDetection: false,
    showFormUI: true,
    confidenceThreshold: 70,
    debugMode: false
  };
  
  // UI elements
  let formPanel = null;
  let formHighlights = [];
  let activatedFields = new Set();
  
  // Safely log messages
  function safeLog(message, data = {}) {
    try {
      console.log(`AI Form Helper: ${message}`, {
        timestamp: new Date().toISOString(),
        ...data
      });
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Send results to background script
  function sendResults(results, autoDetection = false) {
    try {
      chrome.runtime.sendMessage({
        action: 'formDetectionResult',
        results: results,
        autoDetection: autoDetection
      });
    } catch (e) {
      // Ignore messaging errors
    }
  }
  
  // Get label for a field
  function getFieldLabel(field) {
    try {
      // Check for label element with 'for' attribute
      if (field.id) {
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label && label.textContent) {
          return label.textContent.trim();
        }
      }
      
      // Check if field is inside a label
      let parent = field.parentElement;
      while (parent && parent.tagName !== 'BODY') {
        if (parent.tagName === 'LABEL') {
          // Get text content but exclude the input's own text
          let labelText = parent.textContent;
          if (labelText) {
            // Remove field's value from label text if it exists
            labelText = labelText.replace(field.value || '', '').trim();
            if (labelText) return labelText;
          }
        }
        parent = parent.parentElement;
      }
      
      // Check for aria-label attribute
      if (field.getAttribute('aria-label')) {
        return field.getAttribute('aria-label');
      }
      
      // Check for placeholder attribute
      if (field.placeholder) {
        return field.placeholder;
      }
      
      // Fall back to name or id
      return field.name || field.id || '';
    } catch (e) {
      // In case of error, return an empty string
      return '';
    }
  }
  
  // Guess field purpose based on name, id, or other attributes
  function guessFieldPurpose(field) {
    try {
      const nameAttr = (field.name || '').toLowerCase();
      const idAttr = (field.id || '').toLowerCase();
      const typeAttr = (field.type || '').toLowerCase();
      const classAttr = (field.className || '').toLowerCase();
      const placeholderAttr = (field.placeholder || '').toLowerCase();
      const labelText = getFieldLabel(field).toLowerCase();
      
      // Business registration specific fields - EIN/Tax ID
      if (
        nameAttr.includes('ein') || idAttr.includes('ein') || 
        labelText.includes('employer identification') || labelText.includes('ein') ||
        nameAttr.includes('tax_id') || idAttr.includes('tax_id') || 
        labelText.includes('tax id') || labelText.includes('tax identification')
      ) {
        return 'businessEIN';
      }
      
      // Business Name
      if (
        (nameAttr.includes('business') && nameAttr.includes('name')) || 
        (idAttr.includes('business') && idAttr.includes('name')) || 
        (labelText.includes('business') && labelText.includes('name')) ||
        nameAttr.includes('company_name') || idAttr.includes('company_name') ||
        labelText.includes('company name') || labelText.includes('organization name')
      ) {
        return 'businessName';
      }
      
      // Entity Type (LLC, Corporation, etc)
      if (
        nameAttr.includes('entity') || idAttr.includes('entity') || 
        labelText.includes('entity type') || labelText.includes('business type') ||
        nameAttr.includes('business_type') || idAttr.includes('business_type') ||
        nameAttr.includes('company_type') || idAttr.includes('company_type')
      ) {
        return 'entityType';
      }
      
      // LLC-specific fields
      if (
        nameAttr.includes('llc') || idAttr.includes('llc') || labelText.includes('llc') ||
        labelText.includes('limited liability')
      ) {
        return 'llcDetails';
      }
      
      // Corporation-specific fields
      if (
        nameAttr.includes('incorporation') || idAttr.includes('incorporation') || 
        labelText.includes('incorporation') || labelText.includes('articles of incorporation') ||
        nameAttr.includes('corporation') || idAttr.includes('corporation') ||
        labelText.includes('corporation')
      ) {
        return 'corporationDetails';
      }
      
      // Other business registration fields
      
      // Registered Agent
      if (
        (nameAttr.includes('registered') && nameAttr.includes('agent')) ||
        (idAttr.includes('registered') && idAttr.includes('agent')) ||
        (labelText.includes('registered') && labelText.includes('agent'))
      ) {
        return 'registeredAgent';
      }
      
      // Filing State or Jurisdiction
      if (
        (nameAttr.includes('filing') && nameAttr.includes('state')) ||
        (idAttr.includes('filing') && idAttr.includes('state')) ||
        (labelText.includes('filing') && labelText.includes('state')) ||
        nameAttr.includes('jurisdiction') || idAttr.includes('jurisdiction') ||
        labelText.includes('jurisdiction')
      ) {
        return 'filingState';
      }
      
      // Business Purpose
      if (
        (nameAttr.includes('business') && nameAttr.includes('purpose')) ||
        (idAttr.includes('business') && idAttr.includes('purpose')) ||
        (labelText.includes('business') && labelText.includes('purpose')) ||
        nameAttr.includes('company_purpose') || idAttr.includes('company_purpose') ||
        labelText.includes('company purpose') || labelText.includes('business description')
      ) {
        return 'businessPurpose';
      }
      
      // Business Address
      if (
        (nameAttr.includes('business') && nameAttr.includes('address')) ||
        (idAttr.includes('business') && idAttr.includes('address')) ||
        (labelText.includes('business') && labelText.includes('address')) ||
        nameAttr.includes('company_address') || idAttr.includes('company_address') ||
        labelText.includes('company address')
      ) {
        return 'businessAddress';
      }
      
      // Standard field types
      if (typeAttr === 'email' || nameAttr.includes('email') || idAttr.includes('email') || 
          labelText.includes('email') || placeholderAttr.includes('email')) {
        return 'email';
      }
      
      if (typeAttr === 'password' || nameAttr.includes('password') || idAttr.includes('pass') || 
          labelText.includes('password') || placeholderAttr.includes('password')) {
        return 'password';
      }
      
      if (nameAttr.includes('name') || idAttr.includes('name') || 
          labelText.includes('name') || placeholderAttr.includes('name')) {
        if (nameAttr.includes('first') || idAttr.includes('first') || 
            labelText.includes('first') || placeholderAttr.includes('first')) {
          return 'firstName';
        }
        if (nameAttr.includes('last') || idAttr.includes('last') || 
            labelText.includes('last') || placeholderAttr.includes('last')) {
          return 'lastName';
        }
        return 'name';
      }
      
      if (typeAttr === 'tel' || nameAttr.includes('phone') || idAttr.includes('phone') || 
          nameAttr.includes('tel') || idAttr.includes('tel') ||
          labelText.includes('phone') || labelText.includes('telephone') || 
          placeholderAttr.includes('phone')) {
        return 'phone';
      }
      
      if (nameAttr.includes('address') || idAttr.includes('address') || 
          labelText.includes('address') || placeholderAttr.includes('address')) {
        return 'address';
      }
      
      if (nameAttr.includes('city') || idAttr.includes('city') || 
          labelText.includes('city') || placeholderAttr.includes('city')) {
        return 'city';
      }
      
      if (nameAttr.includes('state') || idAttr.includes('state') || 
          labelText.includes('state') || placeholderAttr.includes('state')) {
        return 'state';
      }
      
      if (nameAttr.includes('zip') || idAttr.includes('zip') || 
          nameAttr.includes('postal') || idAttr.includes('postal') ||
          labelText.includes('zip') || labelText.includes('postal') || 
          placeholderAttr.includes('zip') || placeholderAttr.includes('postal')) {
        return 'zipCode';
      }
      
      if (nameAttr.includes('country') || idAttr.includes('country') || 
          labelText.includes('country') || placeholderAttr.includes('country')) {
        return 'country';
      }
      
      // Default: unknown
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }
  
  // Detect if form is a business registration form
  function detectBusinessRegistrationForm(form, fields) {
    try {
      // Check for business-specific field types
      const businessFieldTypes = [
        'businessEIN', 'businessName', 'entityType', 
        'llcDetails', 'corporationDetails', 'registeredAgent',
        'filingState', 'businessPurpose', 'businessAddress'
      ];
      
      // Count business fields
      let businessFieldCount = 0;
      
      for (const field of fields) {
        if (businessFieldTypes.includes(field.purpose)) {
          businessFieldCount++;
        }
      }
      
      // Check if form has significant business fields (at least 2)
      const hasBusinessFields = businessFieldCount >= 2;
      
      // Look for business keywords in form text and attributes
      let formHtml = '';
      if (form) {
        formHtml = form.outerHTML.toLowerCase();
      } else {
        // Get all field containers and combine their HTML
        for (const field of fields) {
          if (field.element && field.element.parentElement) {
            formHtml += field.element.parentElement.outerHTML.toLowerCase();
          }
        }
      }
      
      // Check for business keywords
      const businessKeywords = [
        'business registration', 'business filing', 'llc', 'corporation',
        'ein', 'tax id', 'employer identification', 'company formation',
        'business license', 'articles of incorporation', 'business entity',
        'registered agent', 'secretary of state', 'entity type', 'business name',
        'business address', 'company name', 'business purpose'
      ];
      
      // Count keyword matches
      let keywordCount = 0;
      for (const keyword of businessKeywords) {
        if (formHtml.includes(keyword)) {
          keywordCount++;
        }
      }
      
      const hasBusinessKeywords = keywordCount >= 2;
      
      // Check page URL for business registration indicators
      const pageUrl = window.location.href.toLowerCase();
      const businessUrlPatterns = [
        'business', 'registration', 'llc', 'corporation', 'entity',
        'secretary', 'state', 'filing', 'formation', 'register',
        'incorporate', 'business-registration', 'business-filing'
      ];
      
      let urlMatchCount = 0;
      for (const pattern of businessUrlPatterns) {
        if (pageUrl.includes(pattern)) {
          urlMatchCount++;
        }
      }
      
      const hasBusinessUrl = urlMatchCount >= 2;
      
      // Check page title for business indicators
      const pageTitle = document.title.toLowerCase();
      const businessTitlePatterns = [
        'business', 'registration', 'llc', 'corporation', 'form',
        'filing', 'secretary of state', 'application', 'register',
        'entity', 'incorporate'
      ];
      
      let titleMatchCount = 0;
      for (const pattern of businessTitlePatterns) {
        if (pageTitle.includes(pattern)) {
          titleMatchCount++;
        }
      }
      
      const hasBusinessTitle = titleMatchCount >= 2;
      
      // Final determination
      const isBusinessForm = 
        (hasBusinessFields && (hasBusinessKeywords || hasBusinessUrl || hasBusinessTitle)) ||
        (hasBusinessKeywords && hasBusinessUrl) ||
        (businessFieldCount >= 3);
      
      // Calculate confidence score
      let confidenceScore = 0;
      confidenceScore += businessFieldCount * 15;
      confidenceScore += keywordCount * 5;
      confidenceScore += urlMatchCount * 5;
      confidenceScore += titleMatchCount * 5;
      
      // Cap score at 100
      confidenceScore = Math.min(confidenceScore, 100);
      
      return {
        isBusinessForm,
        confidenceScore,
        businessFieldCount,
        keywordCount,
        urlMatchCount,
        titleMatchCount
      };
    } catch (e) {
      safeLog('Error detecting business registration form', { error: e.message });
      return {
        isBusinessForm: false,
        confidenceScore: 0
      };
    }
  }
  
  // Calculate field quality score
  function calculateFieldQuality(field) {
    try {
      let score = 0;
      
      // Has a proper label
      if (field.label && field.label.length > 0) {
        score += 25;
      }
      
      // Has a name attribute
      if (field.name && field.name.length > 0) {
        score += 15;
      }
      
      // Has an ID attribute
      if (field.id && field.id.length > 0) {
        score += 15;
      }
      
      // Has a placeholder
      if (field.placeholder && field.placeholder.length > 0) {
        score += 10;
      }
      
      // Field purpose is known
      if (field.purpose !== 'unknown') {
        score += 15;
      }
      
      // Has aria attributes
      if (field.hasAriaLabel || field.hasAriaRequired || field.hasAriaDescribedby) {
        score += 10;
      }
      
      // Field is required
      if (field.required) {
        score += 10;
      }
      
      return Math.min(score, 100);
    } catch (e) {
      return 50; // Default middle score
    }
  }
  
  // Analyze forms on the page
  function analyzeForms() {
    try {
      safeLog('Analyzing forms on the page', { autoDetection: settings.autoDetection });
      
      // Get all forms on the page
      const forms = document.forms;
      
      // Check if there are any forms
      if (!forms || forms.length === 0) {
        safeLog('No forms found on the page');
        
        // Try to find inputs outside of form tags
        const standaloneInputs = document.querySelectorAll('input:not(form input), select:not(form select), textarea:not(form textarea)');
        
        if (standaloneInputs && standaloneInputs.length > 0) {
          safeLog('Found standalone inputs outside of form tags', { count: standaloneInputs.length });
          
          // Process standalone inputs
          return analyzeStandaloneInputs(standaloneInputs);
        }
        
        // No forms or standalone inputs found
        sendResults({
          formFound: false,
          message: 'No forms or form fields found on the page'
        }, settings.autoDetection);
        
        return;
      }
      
      // Process all forms and pick the best one
      let bestForm = null;
      let bestFormScore = 0;
      let bestFormFields = [];
      
      // Analyze each form
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const formScore = analyzeForm(form);
        
        if (formScore.score > bestFormScore) {
          bestForm = form;
          bestFormScore = formScore.score;
          bestFormFields = formScore.fields;
        }
      }
      
      // If no good form found
      if (!bestForm || bestFormScore < settings.confidenceThreshold) {
        safeLog('No high-quality forms found', { bestScore: bestFormScore });
        
        // Try standalone inputs as fallback
        const standaloneInputs = document.querySelectorAll('input:not(form input), select:not(form select), textarea:not(form textarea)');
        if (standaloneInputs && standaloneInputs.length > 0) {
          return analyzeStandaloneInputs(standaloneInputs);
        }
        
        sendResults({
          formFound: false,
          message: 'No high-quality forms found on the page',
          bestScore: bestFormScore
        }, settings.autoDetection);
        
        return;
      }
      
      // Send results for best form
      const results = {
        formFound: true,
        formId: bestForm.id || 'form_' + Date.now(),
        formAction: bestForm.action || '',
        formMethod: bestForm.method || 'get',
        fields: bestFormFields,
        formScore: bestFormScore
      };
      
      sendResults(results, settings.autoDetection);
      
      safeLog('Form analysis complete', { 
        formId: bestForm.id || 'form_' + Date.now(),
        fieldCount: bestFormFields.length,
        score: bestFormScore
      });
      
      // Add visual indicators
      if (settings.highlightFields) {
        addVisualIndicator(bestForm, results.businessForm !== null);
        highlightFormFields(bestForm, bestFormFields);
      }
      
      // If not auto-detection, show form panel
      if (!settings.autoDetection && settings.showFormUI) {
        createFormPanel(results);
      }
      
      return results;
    } catch (e) {
      safeLog('Error analyzing forms', { error: e.message });
      
      // Send error to background
      sendResults({
        formFound: false,
        error: e.message
      }, settings.autoDetection);
    }
  }
  
  // Analyze a single form
  function analyzeForm(form) {
    try {
      // Get all fields in the form
      const formFields = form.querySelectorAll('input, select, textarea');
      
      // Process fields
      const fields = [];
      let formScore = 0;
      let fieldCount = 0;
      
      for (const field of formFields) {
        // Skip hidden, submit, and button fields
        if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button' || field.type === 'reset') {
          continue;
        }
        
        // Get field information
        const fieldInfo = {
          name: field.name || field.id || '',
          id: field.id || '',
          type: field.type || field.tagName.toLowerCase(),
          label: getFieldLabel(field),
          required: field.required || field.getAttribute('aria-required') === 'true' || false,
          placeholder: field.placeholder || '',
          hasAriaLabel: !!field.getAttribute('aria-label'),
          hasAriaRequired: !!field.getAttribute('aria-required'),
          hasAriaDescribedby: !!field.getAttribute('aria-describedby'),
          element: field // Reference to the DOM element
        };
        
        // Add field purpose
        fieldInfo.purpose = guessFieldPurpose(field);
        
        // Calculate field quality
        fieldInfo.quality = calculateFieldQuality(fieldInfo);
        
        // Add to fields array
        fields.push(fieldInfo);
        formScore += fieldInfo.quality;
        fieldCount++;
      }
      
      // Calculate average form score
      const averageScore = fieldCount > 0 ? formScore / fieldCount : 0;
      
      // Boost score for forms with proper attributes
      let finalScore = averageScore;
      
      if (form.id && form.id.length > 0) finalScore += 5;
      if (form.action && form.action.length > 0) finalScore += 5;
      if (form.method && form.method.length > 0) finalScore += 5;
      
      // Form has a submit button
      if (form.querySelector('input[type="submit"], button[type="submit"]')) {
        finalScore += 10;
      }
      
      // Form has appropriate field count (3+ fields is good)
      if (fieldCount >= 3) finalScore += 10;
      
      // Check if this is a business registration form
      const businessFormInfo = detectBusinessRegistrationForm(form, fields);
      
      // Boost score for business registration forms
      if (businessFormInfo.isBusinessForm) {
        finalScore += 10;
      }
      
      // Cap score at 100
      finalScore = Math.min(finalScore, 100);
      
      // Prepare fields array to return (without DOM elements)
      const fieldsToReturn = fields.map(f => {
        // Remove element reference before sending
        const { element, ...rest } = f;
        return rest;
      });
      
      return {
        score: finalScore,
        fields: fieldsToReturn,
        businessForm: businessFormInfo.isBusinessForm ? {
          confidenceScore: businessFormInfo.confidenceScore,
          businessFieldCount: businessFormInfo.businessFieldCount,
          keywordCount: businessFormInfo.keywordCount,
          urlMatchCount: businessFormInfo.urlMatchCount,
          titleMatchCount: businessFormInfo.titleMatchCount
        } : null
      };
    } catch (e) {
      safeLog('Error analyzing form', { error: e.message });
      return { score: 0, fields: [] };
    }
  }
  
  // Analyze standalone inputs outside of form tags
  function analyzeStandaloneInputs(inputs) {
    try {
      // Process fields
      const fields = [];
      let formScore = 0;
      let fieldCount = 0;
      
      for (const field of inputs) {
        // Skip hidden, submit, and button fields
        if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button' || field.type === 'reset') {
          continue;
        }
        
        // Skip invisible fields
        const style = window.getComputedStyle(field);
        if (style.display === 'none' || style.visibility === 'hidden' || field.offsetParent === null) {
          continue;
        }
        
        // Get field information
        const fieldInfo = {
          name: field.name || field.id || '',
          id: field.id || '',
          type: field.type || field.tagName.toLowerCase(),
          label: getFieldLabel(field),
          required: field.required || field.getAttribute('aria-required') === 'true' || false,
          placeholder: field.placeholder || '',
          hasAriaLabel: !!field.getAttribute('aria-label'),
          hasAriaRequired: !!field.getAttribute('aria-required'),
          hasAriaDescribedby: !!field.getAttribute('aria-describedby'),
          element: field // Reference to the DOM element
        };
        
        // Add field purpose
        fieldInfo.purpose = guessFieldPurpose(field);
        
        // Calculate field quality
        fieldInfo.quality = calculateFieldQuality(fieldInfo);
        
        // Add to fields array
        fields.push(fieldInfo);
        formScore += fieldInfo.quality;
        fieldCount++;
      }
      
      // If no valid fields found, return no form
      if (fields.length === 0) {
        sendResults({
          formFound: false,
          message: 'No visible form fields found on the page'
        }, settings.autoDetection);
        return;
      }
      
      // Calculate average form score
      const averageScore = fieldCount > 0 ? formScore / fieldCount : 0;
      
      // Standalone inputs need a higher threshold (more fields) to be considered a form
      let finalScore = fieldCount >= 3 ? averageScore : averageScore * 0.7;
      
      // Find a common container for the fields
      let commonContainer = null;
      if (inputs.length > 0) {
        // Try to find common parent
        const firstInput = inputs[0];
        let container = firstInput.parentElement;
        
        // Walk up to find a container that contains at least half of the inputs
        while (container && container.tagName !== 'BODY') {
          const containedInputs = container.querySelectorAll('input, select, textarea');
          if (containedInputs.length >= inputs.length / 2) {
            commonContainer = container;
            break;
          }
          container = container.parentElement;
        }
        
        // Fallback to first input's parent
        if (!commonContainer) {
          commonContainer = firstInput.parentElement;
        }
      }
      
      // Check if this is a business registration form
      const businessFormInfo = detectBusinessRegistrationForm(null, fields);
      
      // Boost score for business registration forms
      if (businessFormInfo.isBusinessForm) {
        finalScore += 15;
        safeLog('Detected business registration form', businessFormInfo);
      }
      
      // Cap score at 100
      finalScore = Math.min(finalScore, 100);
      
      // Only proceed if score is above threshold
      if (finalScore < settings.confidenceThreshold) {
        sendResults({
          formFound: false,
          message: 'Standalone inputs did not meet quality threshold',
          score: finalScore
        }, settings.autoDetection);
        return;
      }
      
      // Prepare fields array to return (without DOM elements)
      const fieldsToReturn = fields.map(f => {
        // Remove element reference before sending
        const { element, ...rest } = f;
        return rest;
      });
      
      // Send results
      const results = {
        formFound: true,
        formId: 'standalone_' + Date.now(),
        formAction: '',
        formMethod: 'post', // Assume post for standalone inputs
        fields: fieldsToReturn,
        isStandalone: true,
        formScore: finalScore,
        businessForm: businessFormInfo.isBusinessForm ? {
          confidenceScore: businessFormInfo.confidenceScore,
          businessFieldCount: businessFormInfo.businessFieldCount,
          keywordCount: businessFormInfo.keywordCount,
          urlMatchCount: businessFormInfo.urlMatchCount,
          titleMatchCount: businessFormInfo.titleMatchCount
        } : null
      };
      
      sendResults(results, settings.autoDetection);
      
      safeLog('Standalone fields analysis complete', { 
        fieldCount: fields.length,
        score: finalScore,
        isBusinessForm: businessFormInfo.isBusinessForm
      });
      
      // Add visual indicators
      if (settings.highlightFields) {
        if (commonContainer) {
          addVisualIndicator(commonContainer, businessFormInfo.isBusinessForm);
        }
        highlightFormFields(null, fields);
      }
      
      // If not auto-detection, show form panel
      if (!settings.autoDetection && settings.showFormUI) {
        createFormPanel(results);
      }
      
      return results;
    } catch (e) {
      safeLog('Error analyzing standalone inputs', { error: e.message });
      
      // Send error to background
      sendResults({
        formFound: false,
        error: e.message
      }, settings.autoDetection);
    }
  }
  
  // Add visual indicator to the form
  function addVisualIndicator(element, isBusinessForm = false) {
    try {
      if (!settings.highlightFields) return;
      
      // Create indicator element
      const indicator = document.createElement('div');
      
      // Use different colors for business forms
      const backgroundColor = isBusinessForm ? 
        'rgba(52, 168, 83, 0.1)' : 'rgba(66, 133, 244, 0.1)';
      
      const borderColor = isBusinessForm ? 
        'rgba(52, 168, 83, 0.8)' : 'rgba(66, 133, 244, 0.8)';
      
      indicator.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        background-color: ${backgroundColor};
        border: 2px solid ${borderColor};
        border-radius: 4px;
        pointer-events: none;
        z-index: 9999;
        transition: opacity 0.5s ease;
      `;
      indicator.className = 'form-helper-indicator';
      if (isBusinessForm) {
        indicator.className += ' business-form-indicator';
      }
      
      // Get element position and dimensions
      const rect = element.getBoundingClientRect();
      indicator.style.width = rect.width + 'px';
      indicator.style.height = rect.height + 'px';
      indicator.style.top = (rect.top + window.scrollY) + 'px';
      indicator.style.left = (rect.left + window.scrollX) + 'px';
      
      // Add label for business forms
      if (isBusinessForm) {
        const label = document.createElement('div');
        label.style.cssText = `
          position: absolute;
          top: -30px;
          left: 0;
          background-color: rgba(52, 168, 83, 0.9);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          pointer-events: none;
          z-index: 10000;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        label.textContent = 'Business Registration Form';
        indicator.appendChild(label);
      }
      
      // Add to document
      document.body.appendChild(indicator);
      
      // Store reference to remove later
      formHighlights.push(indicator);
      
      // Fade out after 3 seconds if auto-detection
      if (settings.autoDetection) {
        setTimeout(() => {
          indicator.style.opacity = '0';
          // Remove after fade out
          setTimeout(() => {
            indicator.remove();
            const index = formHighlights.indexOf(indicator);
            if (index !== -1) formHighlights.splice(index, 1);
          }, 500);
        }, 3000);
      }
      
      return indicator;
    } catch (e) {
      // Ignore errors - indicator is optional
      return null;
    }
  }
  
  // Highlight individual form fields
  function highlightFormFields(form, fields) {
    try {
      if (!settings.highlightFields) return;
      
      // Remove existing field highlights
      removeFieldHighlights();
      
      // Add highlight to each field
      fields.forEach(field => {
        if (!field.element) return;
        
        // Create highlight element
        const highlight = document.createElement('div');
        highlight.style.cssText = `
          position: absolute;
          background-color: rgba(52, 168, 83, 0.1);
          border: 2px solid rgba(52, 168, 83, 0.8);
          border-radius: 4px;
          pointer-events: none;
          z-index: 9998;
          transition: all 0.3s ease;
        `;
        highlight.className = 'form-helper-field-highlight';
        
        // Set position
        updateFieldHighlightPosition(highlight, field.element);
        
        // Add to document
        document.body.appendChild(highlight);
        
        // Store for later removal
        formHighlights.push(highlight);
        
        // Add data attribute for identification
        field.element.dataset.formHelperField = field.purpose !== 'unknown' ? field.purpose : field.type;
        
        // Add highlight/unhighlight on hover
        field.element.addEventListener('mouseenter', () => {
          highlight.style.backgroundColor = 'rgba(52, 168, 83, 0.2)';
          highlight.style.borderColor = 'rgba(52, 168, 83, 1)';
          highlight.style.boxShadow = '0 0 8px rgba(52, 168, 83, 0.5)';
        });
        
        field.element.addEventListener('mouseleave', () => {
          highlight.style.backgroundColor = 'rgba(52, 168, 83, 0.1)';
          highlight.style.borderColor = 'rgba(52, 168, 83, 0.8)';
          highlight.style.boxShadow = 'none';
        });
        
        // Show tooltip when clicked
        field.element.addEventListener('click', () => {
          if (settings.showFormUI && !settings.autoDetection) {
            showFieldTooltip(field);
            activatedFields.add(field.id || field.name || field.type);
          }
        });
        
        // Fade out after 3 seconds if auto-detection
        if (settings.autoDetection) {
          setTimeout(() => {
            highlight.style.opacity = '0';
            // Remove after fade out
            setTimeout(() => {
              highlight.remove();
              const index = formHighlights.indexOf(highlight);
              if (index !== -1) formHighlights.splice(index, 1);
            }, 500);
          }, 3000);
        }
      });
      
      // Add window resize listener to update positions
      window.addEventListener('resize', updateAllHighlightsPositions);
      window.addEventListener('scroll', updateAllHighlightsPositions);
      
    } catch (e) {
      safeLog('Error highlighting fields', { error: e.message });
    }
  }
  
  // Update position of a field highlight
  function updateFieldHighlightPosition(highlight, element) {
    const rect = element.getBoundingClientRect();
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.style.top = (rect.top + window.scrollY) + 'px';
    highlight.style.left = (rect.left + window.scrollX) + 'px';
  }
  
  // Update positions of all highlights
  function updateAllHighlightsPositions() {
    try {
      document.querySelectorAll('.form-helper-field-highlight').forEach(highlight => {
        const fieldId = highlight.dataset.fieldId;
        if (!fieldId) return;
        
        const element = document.querySelector(`[data-form-helper-field="${fieldId}"]`);
        if (element) {
          updateFieldHighlightPosition(highlight, element);
        }
      });
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Remove all field highlights
  function removeFieldHighlights() {
    formHighlights.forEach(highlight => {
      if (highlight && highlight.parentNode) {
        highlight.parentNode.removeChild(highlight);
      }
    });
    formHighlights = [];
  }
  
  // Show tooltip with field information
  function showFieldTooltip(field) {
    try {
      if (!field.element) return;
      
      // Remove existing tooltip
      const existingTooltip = document.querySelector('.form-helper-tooltip');
      if (existingTooltip) {
        existingTooltip.remove();
      }
      
      // Create tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'form-helper-tooltip';
      tooltip.style.cssText = `
        position: absolute;
        background-color: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 8px 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 14px;
        max-width: 300px;
        transition: opacity 0.3s ease;
      `;
      
      // Get field information
      const fieldName = field.label || field.name || field.id || field.type;
      const fieldType = field.purpose !== 'unknown' ? field.purpose : field.type;
      const fieldRequired = field.required ? 'Required' : 'Optional';
      
      // Create tooltip content
      tooltip.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">${fieldName}</div>
        <div style="color: #666; margin-bottom: 4px;">Type: ${fieldType}</div>
        <div style="color: ${field.required ? '#d32f2f' : '#666'};">${fieldRequired}</div>
        <div style="font-size: 12px; color: #4285F4; margin-top: 8px; cursor: pointer;" id="tooltip-more-info">
          Get AI assistance with this field
        </div>
      `;
      
      // Position tooltip
      const rect = field.element.getBoundingClientRect();
      tooltip.style.top = (rect.bottom + window.scrollY + 8) + 'px';
      tooltip.style.left = (rect.left + window.scrollX) + 'px';
      
      // Add to document
      document.body.appendChild(tooltip);
      
      // Close on click outside
      document.addEventListener('click', function closeTooltip(e) {
        if (!tooltip.contains(e.target) && e.target !== field.element) {
          tooltip.style.opacity = '0';
          setTimeout(() => {
            if (tooltip.parentNode) {
              tooltip.parentNode.removeChild(tooltip);
            }
          }, 300);
          document.removeEventListener('click', closeTooltip);
        }
      });
      
      // Handle "Get AI assistance" click
      const moreInfo = document.getElementById('tooltip-more-info');
      if (moreInfo) {
        moreInfo.addEventListener('click', () => {
          // Show field in form panel
          if (formPanel) {
            formPanel.activateField(field);
          }
          
          // Remove tooltip
          tooltip.style.opacity = '0';
          setTimeout(() => {
            if (tooltip.parentNode) {
              tooltip.parentNode.removeChild(tooltip);
            }
          }, 300);
        });
      }
    } catch (e) {
      safeLog('Error showing tooltip', { error: e.message });
    }
  }
  
  // Create form panel UI
  function createFormPanel(formData) {
    try {
      if (!settings.showFormUI || settings.autoDetection) return;
      
      // Remove existing panel
      if (formPanel) {
        formPanel.remove();
      }
      
      // Create panel container
      const panel = document.createElement('div');
      panel.id = 'form-helper-panel';
      panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        overflow: hidden;
        transition: all 0.3s ease;
        max-height: calc(100vh - 40px);
        display: flex;
        flex-direction: column;
      `;
      
      // Create panel header
      const header = document.createElement('div');
      header.style.cssText = `
        background-color: #4285F4;
        color: white;
        padding: 12px 16px;
        font-weight: 500;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
      `;
      header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">&#x1F4CB;</span>
          <span>AI Form Helper</span>
        </div>
        <div>
          <span id="form-helper-minimize" style="cursor: pointer; margin-right: 8px; font-size: 18px;">−</span>
          <span id="form-helper-close" style="cursor: pointer; font-size: 18px;">×</span>
        </div>
      `;
      panel.appendChild(header);
      
      // Create content area
      const content = document.createElement('div');
      content.style.cssText = `
        padding: 16px;
        overflow-y: auto;
        flex: 1;
      `;
      
      // Form information section
      const formInfo = document.createElement('div');
      formInfo.style.cssText = `
        margin-bottom: 16px;
      `;
      formInfo.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 8px;">Form Information</div>
        <div style="background-color: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 14px;">
          <div>Type: ${formData.isStandalone ? 'Standalone Fields' : 'Standard Form'}</div>
          <div>Fields: ${formData.fields.length} detected</div>
          <div>Quality: ${Math.round(formData.formScore)}%</div>
        </div>
      `;
      content.appendChild(formInfo);
      
      // Fields section
      const fieldsSection = document.createElement('div');
      fieldsSection.style.cssText = `
        margin-bottom: 16px;
      `;
      fieldsSection.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 8px;">Form Fields</div>
        <div id="form-helper-fields" style="max-height: 200px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px;"></div>
      `;
      content.appendChild(fieldsSection);
      
      // Create field list
      const fieldList = document.createElement('div');
      fieldList.id = 'form-helper-fields';
      fieldsSection.appendChild(fieldList);
      
      // Add fields to list
      formData.fields.forEach((field, index) => {
        const fieldItem = document.createElement('div');
        fieldItem.style.cssText = `
          padding: 8px 12px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          transition: background-color 0.2s;
        `;
        fieldItem.className = 'form-helper-field-item';
        fieldItem.dataset.fieldIndex = index;
        
        // Get field info
        const fieldName = field.label || field.name || field.id || 'Unnamed Field';
        const fieldType = field.purpose !== 'unknown' ? field.purpose : field.type;
        
        fieldItem.innerHTML = `
          <div style="font-weight: 500;">${fieldName}</div>
          <div style="font-size: 12px; color: #666;">
            <span>${fieldType}</span>
            ${field.required ? ' <span style="color: #d32f2f;">(Required)</span>' : ''}
          </div>
        `;
        
        // Highlight on hover
        fieldItem.addEventListener('mouseenter', () => {
          fieldItem.style.backgroundColor = '#f5f5f5';
        });
        
        fieldItem.addEventListener('mouseleave', () => {
          fieldItem.style.backgroundColor = 'transparent';
        });
        
        // Click to get more info about field
        fieldItem.addEventListener('click', () => {
          activateField(field, index);
        });
        
        fieldList.appendChild(fieldItem);
      });
      
      // Field details section (initially hidden)
      const fieldDetails = document.createElement('div');
      fieldDetails.id = 'form-helper-field-details';
      fieldDetails.style.cssText = `
        display: none;
        margin-bottom: 16px;
      `;
      content.appendChild(fieldDetails);
      
      // AI assistance section
      const aiSection = document.createElement('div');
      aiSection.style.cssText = `
        margin-bottom: 16px;
      `;
      aiSection.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 8px;">AI Assistance</div>
        <button id="form-helper-assist-all" style="
          background-color: #4285F4;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
        ">Explain All Fields</button>
      `;
      content.appendChild(aiSection);
      
      // Add panel to page
      panel.appendChild(content);
      document.body.appendChild(panel);
      
      // Make panel draggable
      makeDraggable(panel, header);
      
      // Handle close button
      document.getElementById('form-helper-close').addEventListener('click', () => {
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(-20px)';
        setTimeout(() => {
          if (panel.parentNode) {
            panel.parentNode.removeChild(panel);
            formPanel = null;
          }
        }, 300);
      });
      
      // Handle minimize button
      let minimized = false;
      document.getElementById('form-helper-minimize').addEventListener('click', () => {
        if (minimized) {
          content.style.display = 'block';
          panel.style.height = 'auto';
          document.getElementById('form-helper-minimize').textContent = '−';
          minimized = false;
        } else {
          content.style.display = 'none';
          panel.style.height = 'auto';
          document.getElementById('form-helper-minimize').textContent = '+';
          minimized = true;
        }
      });
      
      // Handle "Explain All Fields" button
      document.getElementById('form-helper-assist-all').addEventListener('click', () => {
        // Implement AI assistance for all fields
        sendAIRequest(formData);
      });
      
      // Function to activate a field
      function activateField(field, index) {
        // Highlight selected field in list
        document.querySelectorAll('.form-helper-field-item').forEach(item => {
          item.style.backgroundColor = 'transparent';
          item.style.borderLeft = 'none';
        });
        
        const fieldItem = document.querySelector(`.form-helper-field-item[data-field-index="${index}"]`);
        if (fieldItem) {
          fieldItem.style.backgroundColor = '#e8f0fe';
          fieldItem.style.borderLeft = '3px solid #4285F4';
        }
        
        // Show field details
        fieldDetails.style.display = 'block';
        
        // Get field info
        const fieldName = field.label || field.name || field.id || 'Unnamed Field';
        const fieldType = field.purpose !== 'unknown' ? field.purpose : field.type;
        
        // Update field details
        fieldDetails.innerHTML = `
          <div style="font-weight: 500; margin-bottom: 8px;">Field Details: ${fieldName}</div>
          <div style="background-color: #f5f5f5; padding: 12px; border-radius: 4px; margin-bottom: 12px;">
            <div><strong>Type:</strong> ${fieldType}</div>
            <div><strong>Required:</strong> ${field.required ? 'Yes' : 'No'}</div>
            <div><strong>ID:</strong> ${field.id || 'None'}</div>
            <div><strong>Name:</strong> ${field.name || 'None'}</div>
            <div><strong>Quality Score:</strong> ${field.quality}%</div>
          </div>
          <button id="form-helper-field-explain" style="
            background-color: #4285F4;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
          ">Explain This Field</button>
          <div id="form-helper-field-ai-response" style="
            display: none;
            margin-top: 12px;
            padding: 12px;
            background-color: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #4285F4;
            font-size: 14px;
          "></div>
        `;
        
        // Handle "Explain This Field" button
        document.getElementById('form-helper-field-explain').addEventListener('click', () => {
          // Implement AI assistance for this field
          sendFieldAIRequest(field);
        });
      }
      
      // Function to send AI request for field explanation
      function sendFieldAIRequest(field) {
        // Show loading state
        const aiResponse = document.getElementById('form-helper-field-ai-response');
        aiResponse.style.display = 'block';
        aiResponse.innerHTML = '<div style="text-align: center;">Loading AI response...</div>';
        
        // For demonstration, simulate AI response
        setTimeout(() => {
          let response = '';
          
          // Generate response based on field type
          switch (field.purpose) {
            case 'email':
              response = 'This is an email address field. It should contain a valid email format like example@domain.com.';
              break;
            case 'password':
              response = 'This is a password field. For security, use a strong password with a mix of letters, numbers, and symbols.';
              break;
            case 'firstName':
              response = 'This field is for your first name (given name).';
              break;
            case 'lastName':
              response = 'This field is for your last name (family name or surname).';
              break;
            case 'name':
              response = 'This field is for your full name.';
              break;
            case 'phone':
              response = 'This field is for your phone number. It may require a specific format depending on the website.';
              break;
            case 'address':
              response = 'This field is for your street address.';
              break;
            case 'city':
              response = 'This field is for the city name in your address.';
              break;
            case 'state':
              response = 'This field is for the state, province, or region in your address.';
              break;
            case 'zipCode':
              response = 'This field is for your postal or ZIP code.';
              break;
            case 'country':
              response = 'This field is for your country name.';
              break;
            case 'business':
              response = 'This appears to be a business-related field, possibly for registration or tax purposes.';
              break;
            default:
              response = `This is a ${field.type} field. It's used to collect information from you on this form.`;
          }
          
          if (field.required) {
            response += ' This field is required to submit the form.';
          }
          
          aiResponse.innerHTML = response;
        }, 1000);
      }
      
      // Function to send AI request for all fields
      function sendAIRequest(formData) {
        // For demonstration, show a message
        const explanation = document.createElement('div');
        explanation.style.cssText = `
          margin-top: 12px;
          padding: 12px;
          background-color: #f8f9fa;
          border-radius: 4px;
          border-left: 3px solid #4285F4;
          font-size: 14px;
        `;
        
        explanation.innerHTML = `
          <div style="margin-bottom: 8px;"><strong>Form Analysis</strong></div>
          <p>This appears to be a ${formData.isStandalone ? 'collection of form fields' : 'standard web form'} 
             with ${formData.fields.length} input fields.</p>
          <p>The form includes fields for: ${formData.fields.map(f => 
            f.purpose !== 'unknown' ? f.purpose : f.type).join(', ')}.</p>
          <p>Click on individual fields in the list above to get more specific information about each field.</p>
        `;
        
        // Add to AI section
        aiSection.appendChild(explanation);
        
        // Hide the button after use
        document.getElementById('form-helper-assist-all').style.display = 'none';
      }
      
      // Store reference to panel
      formPanel = {
        element: panel,
        activateField: activateField,
        remove: () => {
          if (panel.parentNode) {
            panel.parentNode.removeChild(panel);
          }
        }
      };
      
    } catch (e) {
      safeLog('Error creating form panel', { error: e.message });
    }
  }
  
  // Make an element draggable
  function makeDraggable(element, handle) {
    try {
      let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
      
      if (handle) {
        // If handle is specified, make only the handle draggable
        handle.style.cursor = 'move';
        handle.addEventListener('mousedown', dragMouseDown);
      } else {
        // Otherwise, make the whole element draggable
        element.addEventListener('mousedown', dragMouseDown);
      }
      
      function dragMouseDown(e) {
        e.preventDefault();
        // Get initial mouse position
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Add listeners for move and release
        document.addEventListener('mousemove', elementDrag);
        document.addEventListener('mouseup', closeDragElement);
      }
      
      function elementDrag(e) {
        e.preventDefault();
        // Calculate new position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set element's new position
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
      }
      
      function closeDragElement() {
        // Remove listeners
        document.removeEventListener('mousemove', elementDrag);
        document.removeEventListener('mouseup', closeDragElement);
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Clean up when page unloads
  function cleanup() {
    try {
      // Remove highlights
      removeFieldHighlights();
      
      // Remove panel
      if (formPanel) {
        formPanel.remove();
        formPanel = null;
      }
      
      // Remove event listeners
      window.removeEventListener('resize', updateAllHighlightsPositions);
      window.removeEventListener('scroll', updateAllHighlightsPositions);
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Listen for settings from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'formAnalyzerSettings') {
      // Update settings
      settings = { ...settings, ...message.settings };
      safeLog('Received settings from background', { settings });
    }
  });
  
  // Add unload handler
  window.addEventListener('beforeunload', cleanup);
  
  // Run form analysis
  analyzeForms();
  
  // Send completion message to background script
  safeLog('Form analyzer script completed execution', { autoDetection: settings.autoDetection });
})();