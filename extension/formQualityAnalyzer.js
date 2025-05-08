/**
 * Form Quality Analyzer - Validates forms to determine if they're legitimate
 * and suitable for AI assistance
 */

// Create global analyzer object
window.FormQualityAnalyzer = window.FormQualityAnalyzer || function() {
    // Debug mode
    this.debugMode = false;
    
    /**
     * Log debug messages when debug mode is enabled
     */
    this.log = function(message, data = {}) {
        if (this.debugMode) {
            console.log(`FormQualityAnalyzer: ${message}`, data);
        }
    };

    /**
     * Enable debug mode
     */
    this.enableDebug = function() {
        this.debugMode = true;
        this.log("Debug mode enabled");
    };

    /**
     * Scores a form based on various quality factors
     * Higher score = more likely to be a legitimate form worth providing AI assistance for
     * 
     * @param {HTMLElement|Element} container - The form or container element to analyze
     * @param {Array} fields - Array of field objects detected within this container
     * @returns {Object} Quality assessment with score and details
     */
    this.analyzeFormQuality = function(container, fields) {
        this.log("Analyzing form quality", { containerId: container?.id, fieldsCount: fields?.length });
        
        // Starting quality score
        let qualityScore = 50;
        let reasons = [];
        
        // If no fields, this isn't even a form
        if (!fields || !Array.isArray(fields) || fields.length === 0) {
            return {
                score: 0,
                isLegitimate: false,
                reasons: ["No form fields detected"]
            };
        }
        
        // 1. Field count check
        const fieldCount = fields.length;
        if (fieldCount === 1) {
            qualityScore -= 30;
            reasons.push("Single-field form (likely search or newsletter)");
        } else if (fieldCount >= 2 && fieldCount <= 4) {
            qualityScore += 10;
            reasons.push("Reasonable field count");
        } else if (fieldCount > 4) {
            qualityScore += 20;
            reasons.push("Substantial form with multiple fields");
        }
        
        // 2. Check for submission mechanism (submit button or similar)
        const hasSubmitButton = container && (
            container.querySelector('button[type="submit"]') || 
            container.querySelector('input[type="submit"]') ||
            container.querySelector('button:not([type])') ||
            container.querySelector('[role="button"]')
        );
        
        if (hasSubmitButton) {
            qualityScore += 15;
            reasons.push("Has submit button");
        } else {
            qualityScore -= 15;
            reasons.push("No submit button detected");
        }
        
        // 3. Check for specific field types
        const fieldTypes = fields.map(f => f.type?.toLowerCase() || '');
        const fieldNames = fields.map(f => f.name?.toLowerCase() || '');
        const fieldLabels = fields.map(f => f.label?.toLowerCase() || '');
        
        // 3a. Required fields present?
        const requiredFieldsCount = fields.filter(f => f.required).length;
        if (requiredFieldsCount > 0) {
            qualityScore += 10;
            reasons.push(`Has ${requiredFieldsCount} required fields`);
        }
        
        // 3b. Check for search-specific patterns (likely not a form we want to assist with)
        const isLikelySearch = 
            fieldTypes.includes('search') || 
            fieldNames.some(name => name.includes('search') || name.includes('query')) ||
            fieldLabels.some(label => label.includes('search'));
        
        if (isLikelySearch && fieldCount < 3) {
            qualityScore -= 25;
            reasons.push("Appears to be a search form");
        }
        
        // 3c. Check for newsletter signup patterns (likely not a form we want to assist with)
        const isLikelyNewsletter = 
            (fieldTypes.includes('email') || 
             fieldNames.some(name => name.includes('email')) ||
             fieldLabels.some(label => label.includes('email'))) &&
            (fieldCount < 3) &&
            (fieldNames.some(name => name.includes('subscribe') || name.includes('newsletter')) ||
             fieldLabels.some(label => label.includes('subscribe') || label.includes('newsletter')));
        
        if (isLikelyNewsletter) {
            qualityScore -= 20;
            reasons.push("Appears to be a newsletter signup");
        }
        
        // 3d. Check for important field types that indicate a substantial form
        const hasNameField = 
            fieldNames.some(name => name.includes('name') || name.includes('first') || name.includes('last')) ||
            fieldLabels.some(label => label.includes('name') || label.includes('first') || label.includes('last'));
        
        const hasAddressField =
            fieldNames.some(name => name.includes('address') || name.includes('street')) ||
            fieldLabels.some(label => label.includes('address') || label.includes('street'));
        
        const hasContactField =
            fieldNames.some(name => name.includes('phone') || name.includes('email') || name.includes('contact')) ||
            fieldLabels.some(label => label.includes('phone') || label.includes('email') || label.includes('contact'));
        
        let substantialFieldScore = 0;
        
        if (hasNameField) {
            substantialFieldScore += 10;
            reasons.push("Contains name fields");
        }
        
        if (hasAddressField) {
            substantialFieldScore += 15;
            reasons.push("Contains address fields");
        }
        
        if (hasContactField) {
            substantialFieldScore += 10;
            reasons.push("Contains contact fields");
        }
        
        qualityScore += substantialFieldScore;
        
        // 4. Check for potential dialog/chat interfaces
        const isChatLike = 
            container && 
            (container.querySelector('textarea') || fields.some(f => f.type === 'textarea')) &&
            fieldCount < 3 &&
            (container.id?.toLowerCase().includes('chat') || 
             container.className?.toLowerCase().includes('chat') ||
             fieldNames.some(name => name.includes('chat') || name.includes('message')) ||
             fieldLabels.some(label => label.includes('chat') || label.includes('message')));
        
        if (isChatLike) {
            qualityScore -= 20;
            reasons.push("Appears to be a chat/messaging interface");
        }
        
        // 5. Check field diversity - forms with different types of fields are more likely legitimate
        const uniqueFieldTypes = new Set(fieldTypes).size;
        if (uniqueFieldTypes >= 3) {
            qualityScore += 15;
            reasons.push("Diverse field types");
        }
        
        // Final score calculation
        qualityScore = Math.max(0, Math.min(100, qualityScore));
        
        return {
            score: qualityScore,
            isLegitimate: qualityScore >= 60,
            reasons: reasons
        };
    };
    
    /**
     * Checks if a form meets minimum quality standards to warrant AI assistance
     * 
     * @param {HTMLElement|Element} container - The form or container element to analyze
     * @param {Array} fields - Array of field objects detected within this container
     * @param {number} threshold - Minimum score threshold (0-100)
     * @returns {boolean} True if form quality meets or exceeds threshold
     */
    this.isQualityForm = function(container, fields, threshold = 60) {
        const quality = this.analyzeFormQuality(container, fields);
        this.log("Form quality assessment", { 
            score: quality.score, 
            threshold: threshold,
            meetsThreshold: quality.score >= threshold,
            reasons: quality.reasons
        });
        return quality.score >= threshold;
    };
};

// Initialize global instance if needed
if (!window.formQualityAnalyzer) {
    window.formQualityAnalyzer = new window.FormQualityAnalyzer();
}