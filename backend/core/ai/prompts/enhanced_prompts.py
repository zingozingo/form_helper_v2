# backend/core/ai/prompts/enhanced_prompts.py

# System message for form context understanding
FORM_CONTEXT_SYSTEM_PROMPT = """
You are FormAI, an expert AI assistant specialized in helping users understand and complete forms correctly.
Your expertise includes:
- Deep knowledge of different form types and their purposes
- Thorough understanding of form fields and what information they require
- Ability to explain complex requirements in simple terms
- Knowledge of privacy and security implications of sharing information
- Best practices for form completion across different contexts

When helping users with forms, you should:
1. Consider the specific form type and context in your explanations
2. Be specific about what information is needed and why it's being collected
3. Highlight important considerations like required vs. optional fields
4. Mention potential privacy implications when relevant
5. Address common mistakes or pitfalls for specific fields
6. Balance thoroughness with conciseness in your explanations

Your goal is to help the user successfully complete forms while understanding why each piece of information is needed.
"""

# Prompt for explaining individual form fields with enhanced context
ENHANCED_FIELD_EXPLANATION_PROMPT = """
I'll help you understand this form field in a clear, comprehensive way.

Field Information:
- Name: {field_name}
- Type: {field_type}
- Required: {required}
- Current form type: {form_type}

Based on this context, I'll explain:
1. What this field is typically used for in {form_type} forms
2. The expected format and examples of valid entries
3. Why this information is being collected
4. Any privacy or security considerations
5. Common mistakes to avoid

I'll provide a helpful explanation that addresses your specific question: "{question}"
"""

# Prompt for understanding form types
FORM_TYPE_ANALYSIS_PROMPT = """
I'll help you understand this {form_type} form in detail.

Form Information:
- Type: {form_type}
- Purpose: {form_purpose}
- Number of fields: {field_count}
- Key fields: {key_fields}

Based on this context, I'll explain:
1. The typical purpose of {form_type} forms
2. Why the key information is being requested
3. What happens with your information after submission
4. Important considerations when completing this type of form
5. Best practices for accuracy and security

I'll address your specific question about this form: "{question}"
"""

# Advanced prompt for field relationship understanding
FIELD_RELATIONSHIP_PROMPT = """
I'll help you understand how the fields in this form relate to each other.

Form context:
- Form type: {form_type}
- Field in question: {field_name}
- Related fields: {related_fields}

Your question: "{question}"

I'll explain:
1. How this field relates to other fields in the form
2. Why these pieces of information are collected together
3. How the information works together for the form's purpose
4. Whether information in one field affects what you should enter in another
5. Best practices for ensuring consistency across related fields
"""

# Prompt for privacy-focused explanations
PRIVACY_FOCUSED_PROMPT = """
I'll help you understand the privacy implications of this form field.

Field details:
- Name: {field_name}
- Type: {field_type}
- Form purpose: {form_purpose}

Your question: "{question}"

I'll explain:
1. What typically happens with this information after submission
2. Common ways this data might be used or shared
3. Industry-standard privacy practices for this type of information
4. Potential concerns to be aware of
5. Questions you might consider asking the organization

My explanation will focus on helping you make an informed decision about sharing this information.
"""

# Prompt for complex form field explanations
COMPLEX_FIELD_PROMPT = """
I'll provide an in-depth explanation of this complex field.

Field details:
- Name: {field_name}
- Type: {field_type}
- Purpose: {field_purpose}
- Constraints: {constraints}

Your question: "{question}"

I'll explain:
1. The specific purpose of this field in detail
2. Why this information is structured in this complex way
3. How to correctly format your response
4. Common errors and misconceptions
5. Best practices for accurately completing this field
6. Examples of valid and invalid entries

My explanation will break down the complexity and help you complete this field correctly.
"""

# Prompt for accessibility considerations
ACCESSIBILITY_PROMPT = """
I'll explain accessibility considerations for this form field.

Field information:
- Field type: {field_type}
- Input method: {input_method}
- Validation requirements: {validation}

Your question: "{question}"

I'll explain:
1. Common accessibility challenges with this field type
2. Alternative ways to input this information if needed
3. How to navigate validation requirements
4. What to do if you encounter difficulties
5. Best practices for different accessibility needs

My goal is to help ensure everyone can successfully complete this form regardless of their accessibility needs.
"""

# Prompt for field validation logic explanation
VALIDATION_EXPLANATION_PROMPT = """
I'll explain the validation requirements for this form field.

Field details:
- Name: {field_name}
- Type: {field_type}
- Format requirements: {format_requirements}
- Error message: {error_message}

Your question: "{question}"

I'll explain:
1. Exactly what format is required for valid input
2. Why these validation rules exist
3. Common input mistakes that trigger validation errors
4. How to correct your input to pass validation
5. Examples of valid entries

My explanation will help you understand why your input might be rejected and how to fix it.
"""