/**
 * Form Context Detector - Analyzes forms to determine their purpose
 */

// Ensure we have a global object to avoid reference errors
window.FormContextAnalyzer = window.FormContextAnalyzer || function() {
    // Form type patterns for detection
    this.formTypePatterns = {
        login: {
            keywords: ['login', 'sign in', 'signin', 'log in'],
            fields: ['email', 'password', 'username'],
            requiredFields: ['password'],
            nonFields: ['first_name', 'last_name', 'address', 'postal'],
            confidence: 0.8
        },
        registration: {
            keywords: ['register', 'sign up', 'signup', 'create account', 'join'],
            fields: ['email', 'password', 'confirm', 'name', 'first', 'last'],
            requiredFields: ['email', 'password'],
            confidence: 0.8
        },
        contact: {
            keywords: ['contact', 'message', 'feedback', 'inquiry'],
            fields: ['name', 'email', 'message', 'subject', 'phone'],
            requiredFields: ['email'],
            confidence: 0.7
        },
        checkout: {
            keywords: ['checkout', 'payment', 'billing', 'shipping', 'order'],
            fields: ['card', 'credit', 'expiry', 'cvv', 'address', 'zip'],
            requiredFields: [],
            confidence: 0.8
        },
        search: {
            keywords: ['search', 'find', 'query'],
            fields: ['search', 'query', 'keyword'],
            requiredFields: [],
            confidence: 0.7
        }
    };
    
    console.log("Form Context Analyzer initialized");
    
    /**
     * Analyzes a form to determine its purpose and context
     * @param {HTMLElement} formElement - The form element
     * @param {Array} fields - An array of field objects with metadata
     * @param {Object} pageInfo - Additional page context information
     * @returns {Object} The detected form context
     */
    this.analyzeFormContext = function(formElement, fields, pageInfo = {}) {
        try {
            // Default context
            const baseContext = {
                form_type: "unknown form",
                form_purpose: "collecting information",
                description: "This appears to be a form for collecting information.",
                confidence: 0.5
            };
            
            if (!fields || !Array.isArray(fields) || fields.length === 0) {
                return baseContext;
            }
            
            // Extract field information for analysis
            const fieldTypes = fields.map(f => f.type || '').filter(Boolean);
            const fieldNames = fields.map(f => f.name || '').filter(Boolean);
            const fieldLabels = fields.map(f => f.label || '').filter(Boolean);
            
            // Combine all text for keyword matching
            const formText = [
                pageInfo.title || '',
                pageInfo.metaDescription || '',
                formElement ? formElement.getAttribute('action') || '' : '',
                formElement ? formElement.getAttribute('id') || '' : '',
                formElement ? formElement.getAttribute('name') || '' : '',
                formElement ? formElement.getAttribute('class') || '' : '',
                ...fieldNames,
                ...fieldLabels
            ].join(' ').toLowerCase();
            
            let bestMatch = null;
            let highestScore = 0;
            
            // Check against each form type pattern
            for (const [formType, pattern] of Object.entries(this.formTypePatterns)) {
                let score = 0;
                
                // Keyword matching
                for (const keyword of pattern.keywords) {
                    if (formText.includes(keyword)) {
                        score += 0.3;
                        break; // Only count one keyword match
                    }
                }
                
                // Field type matching
                let fieldMatches = 0;
                for (const fieldType of pattern.fields) {
                    const hasField = fieldNames.some(name => name.toLowerCase().includes(fieldType)) ||
                                  fieldLabels.some(label => label.toLowerCase().includes(fieldType)) ||
                                  fieldTypes.includes(fieldType);
                    
                    if (hasField) {
                        fieldMatches++;
                    }
                }
                
                // Calculate field match score
                const fieldMatchScore = fieldMatches / pattern.fields.length;
                score += fieldMatchScore * 0.5;
                
                // Required fields bonus
                let requiredMatches = 0;
                for (const reqField of pattern.requiredFields) {
                    const hasRequiredField = fieldNames.some(name => name.toLowerCase().includes(reqField)) ||
                                         fieldLabels.some(label => label.toLowerCase().includes(reqField)) ||
                                         fieldTypes.includes(reqField);
                    
                    if (hasRequiredField) {
                        requiredMatches++;
                    }
                }
                
                if (pattern.requiredFields.length > 0) {
                    const requiredMatchScore = requiredMatches / pattern.requiredFields.length;
                    score += requiredMatchScore * 0.2;
                }
                
                // Non-fields penalty (for fields that shouldn't be in this form type)
                if (pattern.nonFields && pattern.nonFields.length > 0) {
                    for (const nonField of pattern.nonFields) {
                        const hasNonField = fieldNames.some(name => name.toLowerCase().includes(nonField)) ||
                                         fieldLabels.some(label => label.toLowerCase().includes(nonField));
                        
                        if (hasNonField) {
                            score -= 0.2;
                        }
                    }
                }
                
                // Make sure score is not negative
                score = Math.max(0, score);
                
                // Update best match if this score is higher
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = {
                        type: formType,
                        score: score,
                        pattern: pattern
                    };
                }
            }
            
            // If we found a good match
            if (bestMatch && bestMatch.score > 0.4) {
                const formType = bestMatch.type;
                const baseConfidence = bestMatch.pattern.confidence || 0.7;
                const finalConfidence = baseConfidence * bestMatch.score;
                
                // Generate form description and purpose
                let description, purpose;
                
                switch (formType) {
                    case 'login':
                        description = "This is a login form for existing users.";
                        purpose = "authenticating users to access an account";
                        break;
                    case 'registration':
                        description = "This is a registration form to create a new account.";
                        purpose = "creating a new user account";
                        break;
                    case 'contact':
                        description = "This is a contact form to send a message.";
                        purpose = "sending a message or inquiry";
                        break;
                    case 'checkout':
                        description = "This is a checkout form to complete a purchase.";
                        purpose = "processing a payment or completing an order";
                        break;
                    case 'search':
                        description = "This is a search form to find content.";
                        purpose = "searching for information";
                        break;
                    default:
                        description = "This appears to be a form for collecting information.";
                        purpose = "collecting information";
                }
                
                return {
                    form_type: `${formType} form`,
                    form_purpose: purpose,
                    description: description,
                    confidence: finalConfidence,
                    field_count: fields.length,
                    analysis_score: bestMatch.score
                };
            }
            
            // Return default context if no good match
            return baseContext;
        } catch (error) {
            console.warn("Error in FormContextAnalyzer:", error.message);
            return {
                form_type: "unknown form",
                form_purpose: "collecting information",
                description: "This appears to be a form for collecting information.",
                confidence: 0.5,
                error: error.message
            };
        }
    };
    
    /**
     * Generates a response to a question about the form based on its context
     * @param {string} question - The user's question about the form
     * @param {Object} context - The form context data
     * @returns {string} A response to the question
     */
    this.generateFormContextResponse = function(question, context) {
        if (!question || !context) {
            return "This appears to be a form for collecting information.";
        }
        
        const formType = context.form_type || "unknown form";
        const formPurpose = context.form_purpose || "collecting information";
        
        // Default response based on form type and purpose
        const defaultResponse = `This appears to be a ${formType} for ${formPurpose}.`;
        
        // Common question patterns
        const questionLC = question.toLowerCase();
        
        if (questionLC.includes('what is this form') || 
            questionLC.includes('what form is this') || 
            questionLC.includes('what kind of form')) {
            return context.description || defaultResponse;
        }
        
        if (questionLC.includes('what do i need') || 
            questionLC.includes('what should i') || 
            questionLC.includes('what information')) {
            switch (formType) {
                case 'login form':
                    return "You'll need to enter your username or email and password to log in.";
                case 'registration form':
                    return "You'll need to provide information to create a new account, typically including email, password, and possibly personal details.";
                case 'contact form':
                    return "You'll need to provide contact information and a message to send to the organization.";
                case 'checkout form':
                    return "You'll need to provide payment and shipping information to complete your purchase.";
                case 'search form':
                    return "Enter keywords or search terms to find what you're looking for.";
                default:
                    return `You'll need to fill out the required fields in this form for ${formPurpose}.`;
            }
        }
        
        if (questionLC.includes('why') || questionLC.includes('purpose')) {
            return `This form is for ${formPurpose}.`;
        }
        
        // Default response if no specific question pattern is matched
        return defaultResponse;
    };
};

// Initialize global instance if needed to ensure availability
if (!window.formContextAnalyzer) {
    window.formContextAnalyzer = new window.FormContextAnalyzer();
}