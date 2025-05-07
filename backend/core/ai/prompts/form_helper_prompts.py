# backend/core/ai/prompts/form_helper_prompts.py

# Prompt for explaining individual form fields
FIELD_EXPLANATION_PROMPT = """
You are an AI assistant helping a user understand form fields. Explain the following form field in a clear, concise way.

Field name: {field_name}

Provide a brief explanation of:
1. What this field is typically used for
2. What format the user should enter (if applicable)
3. Why this information might be collected

Keep your explanation friendly and helpful, in 2-3 sentences maximum.
"""

# Prompt for general form-related questions
FORM_QUESTION_PROMPT = """
You are an AI assistant helping a user fill out forms. Answer the following question about forms:

Question: {question}

Context about the current form:
Form type: {form_type}
Fields: {fields}

Provide a helpful, concise answer focused on the user's question.
"""

# Prompt for validating form fields
FIELD_VALIDATION_PROMPT = """
You are an AI assistant helping validate form input. Analyze the following input and determine if it's valid.

Field name: {field_name}
Field type: {field_type}
User input: {user_input}

For the given field type, is this input valid? If not, explain why and suggest a correct format.
Keep your explanation brief and helpful.
"""

# Prompt for suggesting values for form fields
FIELD_SUGGESTION_PROMPT = """
You are an AI assistant helping a user complete a form. Suggest appropriate values for the following field.

Field name: {field_name}
Field type: {field_type}
Form context: {form_context}

Provide 2-3 appropriate example values that would be valid for this field.
"""

# Prompt for generating form completion instructions
FORM_COMPLETION_GUIDE_PROMPT = """
You are an AI assistant helping a user complete a form. Create a brief guide for completing the following form.

Form type: {form_type}
Fields: {fields}

Provide step-by-step instructions for completing this form efficiently and correctly.
Include any tips for specific fields that might be confusing.
Keep your guide concise and user-friendly.
"""

# Prompt for understanding complex form requirements
COMPLEX_FORM_ANALYSIS_PROMPT = """
You are an AI assistant analyzing a complex form. Explain the key requirements and considerations for this form.

Form type: {form_type}
Form purpose: {form_purpose}
Form fields: {fields}

Provide an analysis of:
1. The purpose of this form
2. Key required information
3. Any potential challenges or complex fields
4. Best practices for completing it correctly

Make your analysis helpful for someone who needs to understand this form quickly.
"""