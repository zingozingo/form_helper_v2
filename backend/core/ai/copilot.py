# backend/core/ai/copilot.py
import os
import traceback
import logging
import re
import json
from typing import Dict, List, Optional, Union, Any
from datetime import datetime

# Updated imports for langchain
try:
    from langchain_community.llms import OpenAI
    from langchain.chains import LLMChain
    from langchain.prompts import PromptTemplate
    HAS_LANGCHAIN = True
except ImportError:
    HAS_LANGCHAIN = False
    logging.warning("Could not import langchain modules. Using fallback explanations.")

# Try to import prompts if available
try:
    from backend.core.ai.prompts.form_helper_prompts import (
        FIELD_EXPLANATION_PROMPT,
        FORM_QUESTION_PROMPT,
        FIELD_VALIDATION_PROMPT,
        FIELD_SUGGESTION_PROMPT
    )
except ImportError:
    # Default prompts
    FIELD_EXPLANATION_PROMPT = "Explain what the form field '{field_name}' is typically used for in 2-3 sentences."
    FORM_QUESTION_PROMPT = "Answer the following question about forms: {question}"
    FIELD_VALIDATION_PROMPT = "Is '{user_input}' a valid value for the {field_type} field '{field_name}'? Explain why or why not."
    FIELD_SUGGESTION_PROMPT = "Suggest a good value for the {field_type} field '{field_name}'."

# Set up logging
logger = logging.getLogger(__name__)

# Import your existing FIELD_KNOWLEDGE and NAME_VARIATIONS from the original file
from backend.core.ai.field_knowledge import FIELD_KNOWLEDGE, NAME_VARIATIONS

class AICopilot:
    def __init__(self):
        """Initialize the AI Copilot with OpenAI integration and enhanced field knowledge."""
        # Store current form context
        self.current_form = None
        
        # Store conversation history
        self.conversation_history = []
        
        # Load field knowledge bases
        self.field_knowledge = FIELD_KNOWLEDGE
        self.name_variations = NAME_VARIATIONS
        
        # Common question patterns
        self.question_patterns = {
            "purpose": [
                r"what\s+is\s+(\w+|\s+)*\s*for",
                r"why\s+(\w+|\s+)*\s+need",
                r"purpose\s+of\s+(\w+|\s+)*",
                r"used\s+for",
                r"what\s+does\s+(\w+|\s+)*\s+mean",
                r"why\s+(\w+|\s+)*\s+asking",
            ],
            "format": [
                r"format",
                r"how\s+should\s+I\s+(\w+|\s+)*\s*fill",
                r"what\s+format",
                r"how\s+do\s+I\s+(\w+|\s+)*\s*enter",
                r"how\s+to\s+(\w+|\s+)*\s*enter",
                r"valid\s+format",
                r"correct\s+way",
            ],
            "required": [
                r"required",
                r"mandatory",
                r"do\s+I\s+need\s+to\s+(\w+|\s+)*\s*fill",
                r"must\s+I\s+(\w+|\s+)*\s*provide",
                r"can\s+I\s+(\w+|\s+)*\s*skip",
                r"optional",
            ],
            "privacy": [
                r"privacy",
                r"safe\s+to\s+(\w+|\s+)*\s*enter",
                r"secure",
                r"data\s+(\w+|\s+)*\s*use",
                r"share\s+(\w+|\s+)*\s*information",
                r"what\s+(\w+|\s+)*\s*do\s+with",
            ],
            "examples": [
                r"example",
                r"sample",
                r"what\s+should\s+I\s+(\w+|\s+)*\s*enter",
                r"show\s+me\s+(\w+|\s+)*\s*example",
            ],
            "validation": [
                r"valid",
                r"accepted",
                r"error",
                r"doesn't\s+work",
                r"not\s+working",
                r"rejected",
                r"requirements",
            ],
            "tips": [
                r"tip",
                r"advice",
                r"best\s+(\w+|\s+)*\s*practice",
                r"recommendation",
                r"should\s+I\s+(\w+|\s+)*\s*use",
            ]
        }
        
        # New conversation patterns for better chatbot functionality
        self.conversation_patterns = {
            "greeting": [
                r"hi\b",
                r"hello\b",
                r"hey\b",
                r"what's up",
                r"howdy",
                r"good morning",
                r"good afternoon",
                r"good evening"
            ],
            "thanks": [
                r"thank",
                r"thanks",
                r"appreciate",
                r"helpful"
            ],
            "help": [
                r"help\b",
                r"assist",
                r"guide",
                r"how (can|do) (you|I)",
                r"what (can|do) (you|I)"
            ],
            "form_completion": [
                r"finished",
                r"complete",
                r"done",
                r"filled out",
                r"submitted"
            ],
            "confusion": [
                r"confused",
                r"don't understand",
                r"what do you mean",
                r"unclear",
                r"explain"
            ]
        }
        
        # Initialize OpenAI integration
        api_key = os.getenv("OPENAI_API_KEY")
        
        # Add fallback mechanism if API key is missing
        if not api_key or not HAS_LANGCHAIN:
            logger.warning("OpenAI integration not available. Using rule-based responses.")
            self.has_api = False
        else:
            try:
                self.llm = OpenAI(
                    temperature=0.7,
                    model_name="gpt-3.5-turbo-instruct",
                    openai_api_key=api_key
                )
                self.has_api = True
                logger.info("OpenAI integration initialized successfully.")
            except Exception as e:
                logger.error(f"Error initializing OpenAI: {e}")
                self.has_api = False
    
    def set_form_context(self, form_data):
        """Set the current form context for the AI"""
        self.current_form = form_data
        
        # Reset conversation history when a new form is loaded
        self.conversation_history = []
        
        # Log form context
        logger.info(f"Form context set: {form_data.get('form_type', 'Unknown form')}")
        
        # Add greeting to conversation history
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Detect form type for a more specific greeting
        form_type = form_data.get('form_type', 'form')
        num_fields = len(form_data.get('fields', []))
        required_fields = sum(1 for field in form_data.get('fields', []) if field.get('required', False))
        
        greeting = f"I've analyzed this {form_type}. I found {num_fields} fields"
        if required_fields > 0:
            greeting += f", {required_fields} of which are required."
        else:
            greeting += "."
        
        greeting += " How can I help you fill it out? You can ask me about specific fields or general questions about the form."
        
        self.conversation_history.append({
            "role": "assistant",
            "content": greeting,
            "timestamp": timestamp
        })
        
        return {"status": "success", "message": greeting}
    
    def get_standardized_field_key(self, field_context):
        """
        Get the standardized key to use with the field knowledge base.
        
        Args:
            field_context: Dictionary containing field information
            
        Returns:
            String key for the knowledge base
        """
        if not field_context:
            return ""
        
        # Try to match by field name
        field_name = field_context.get("name", "").lower()
        field_id = field_context.get("id", "").lower()
        field_label = field_context.get("label", "").lower()
        field_type = field_context.get("type", "").lower()
        field_purpose = field_context.get("purpose", "").lower()
        
        # First check if purpose was already determined
        if field_purpose and field_purpose in self.field_knowledge:
            return field_purpose
        
        # Check if we can directly map the field name
        name_key = field_name.replace("-", "_").replace(" ", "_")
        if name_key in self.field_knowledge:
            return name_key
        
        # Try with ID
        id_key = field_id.replace("-", "_").replace(" ", "_")
        if id_key in self.field_knowledge:
            return id_key
        
        # Try to match using name variations
        for possible_key in [name_key, id_key]:
            for variation, standard_key in self.name_variations.items():
                if possible_key == variation or possible_key.startswith(variation) or possible_key.endswith(variation):
                    return standard_key
        
        # Check if the name/id/label contains known keys
        for standard_key in self.field_knowledge.keys():
            if standard_key in field_name or standard_key in field_id or standard_key in field_label:
                return standard_key
        
        # Search for variation matches in name/id/label
        for variation, standard_key in self.name_variations.items():
            if variation in field_name or variation in field_id or variation in field_label:
                return standard_key
        
        # If we still don't have a match, use field type as a fallback
        return field_type
    
    def get_field_aspect(self, field_key, aspect):
        """
        Get a specific aspect of knowledge about a field.
        
        Args:
            field_key: Standardized field key
            aspect: The aspect of the field to retrieve (purpose, format, etc.)
            
        Returns:
            String containing information about the requested aspect
        """
        if not field_key or field_key not in self.field_knowledge:
            return ""
            
        if aspect in self.field_knowledge[field_key]:
            return self.field_knowledge[field_key][aspect]
            
        return ""
    
    def identify_question_type(self, question):
        """
        Determine what aspect of a field the question is asking about.
        
        Args:
            question: The user's question text
            
        Returns:
            String identifying the question type (purpose, format, etc.)
        """
        if not question:
            return "purpose"
            
        question_lower = question.lower()
        
        for aspect, patterns in self.question_patterns.items():
            for pattern in patterns:
                if re.search(pattern, question_lower):
                    return aspect
        
        # Default to purpose if we can't identify the question type
        return "purpose"
    
    def identify_conversation_type(self, message):
        """
        Determine the type of conversational message.
        
        Args:
            message: The user's message text
            
        Returns:
            String identifying the conversation type (greeting, thanks, etc.)
        """
        if not message:
            return "general"
            
        message_lower = message.lower()
        
        for conv_type, patterns in self.conversation_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower):
                    return conv_type
        
        # Default to general if we can't identify the conversation type
        return "general"
    
    def detect_field_reference(self, message):
        """
        Detect if the user is asking about a specific field in the form.
        
        Args:
            message: The user's message text
            
        Returns:
            Dictionary with field context if found, None otherwise
        """
        if not self.current_form or not self.current_form.get("fields"):
            return None
            
        message_lower = message.lower()
        
        # Check for direct field name references
        for field in self.current_form.get("fields", []):
            field_name = field.get("name", "").lower()
            field_label = field.get("label", "").lower()
            field_id = field.get("id", "").lower()
            
            # Check if field name/label/id is mentioned in the message
            if (field_name and field_name in message_lower) or \
               (field_label and field_label in message_lower) or \
               (field_id and field_id in message_lower):
                return field
                
        # Check for common field type references
        for field in self.current_form.get("fields", []):
            field_key = self.get_standardized_field_key(field)
            if field_key and field_key in message_lower:
                return field
                
            # Check name variations
            for variation, standard_key in self.name_variations.items():
                if variation in message_lower and standard_key == field_key:
                    return field
        
        # No field reference found
        return None
    
    def chat(self, message):
        """
        Enhanced chat interface for form assistance with context awareness.
        
        Args:
            message: The user's message text
            
        Returns:
            Dictionary with the assistant's response and metadata
        """
        try:
            # Record user message in conversation history
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.conversation_history.append({
                "role": "user",
                "content": message,
                "timestamp": timestamp
            })
            
            # Identify conversation type
            conv_type = self.identify_conversation_type(message)
            
            # Check if the message is about a specific field
            field_context = self.detect_field_reference(message)
            
            # Generate response based on conversation type and field context
            response = None
            
            if conv_type == "greeting":
                if not self.current_form:
                    response = "Hello! I can help you understand and fill out forms. Please load a form to get started."
                else:
                    form_type = self.current_form.get("form_type", "form")
                    response = f"Hello! I'm here to help you with this {form_type}. What would you like to know?"
            
            elif conv_type == "thanks":
                response = "You're welcome! Is there anything else you'd like to know about this form?"
                
            elif conv_type == "help":
                if not self.current_form:
                    response = "I can help explain form fields, provide suggestions for values, and answer questions about forms. Please load a form to get started."
                else:
                    field_list = []
                    for field in self.current_form.get("fields", [])[:5]:  # Limit to first 5 fields
                        if field.get("label"):
                            field_list.append(field.get("label"))
                        elif field.get("name"):
                            field_list.append(field.get("name"))
                    
                    if field_list:
                        fields_text = ", ".join(field_list)
                        if len(self.current_form.get("fields", [])) > 5:
                            fields_text += ", and others"
                        response = f"I can help you understand this form and its fields like {fields_text}. You can ask me about specific fields, what information to enter, or any other questions you have."
                    else:
                        response = "I can help you understand this form. Ask me about specific fields or what information you should provide."
            
            elif conv_type == "form_completion":
                response = "Great! Have you checked that all required fields are properly filled out? If you have any questions before submitting, I'm here to help."
                
            elif conv_type == "confusion":
                # Try to provide clarification based on recent conversation
                if len(self.conversation_history) >= 3:
                    # Get the last assistant message
                    last_response = None
                    for msg in reversed(self.conversation_history[:-1]):  # Exclude current user message
                        if msg.get("role") == "assistant":
                            last_response = msg.get("content")
                            break
                    
                    if last_response:
                        response = f"I apologize for any confusion. Let me clarify: {last_response} Is there something specific you'd like me to explain better?"
                
                # Fallback clarification
                if not response:
                    response = "I apologize for any confusion. Could you please specify what you'd like me to explain or help with?"
            
            # If it's a field-specific question
            if field_context:
                field_name = field_context.get("label") or field_context.get("name") or "this field"
                question_type = self.identify_question_type(message)
                
                # Answer with field-specific information
                field_answer = self.answer_field_question(message, field_context)
                
                if not response:  # Only set if not already set by conversation type
                    response = field_answer
                    
                # Add supplementary information if appropriate
                standard_key = self.get_standardized_field_key(field_context)
                if question_type == "purpose" and standard_key:
                    format_info = self.get_field_aspect(standard_key, "format")
                    if format_info and format_info not in response:
                        response += f" {format_info}"
            
            # If not a specific conversation type or field question, treat as general question
            if not response:
                response = self.ask_question(message, field_context)
            
            # Record assistant response in conversation history
            self.conversation_history.append({
                "role": "assistant",
                "content": response,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
            # Add follow-up suggestions based on context
            suggestions = self.generate_followup_suggestions(message, response, field_context)
            
            return {
                "response": response,
                "suggestions": suggestions,
                "field_context": field_context.get("name", "") if field_context else None,
                "timestamp": timestamp
            }
            
        except Exception as e:
            logger.error(f"Error in chat: {e}")
            logger.error(traceback.format_exc())
            error_response = "I apologize, but I encountered an error processing your message. Could you try rephrasing your question?"
            
            # Record error response in conversation history
            self.conversation_history.append({
                "role": "assistant",
                "content": error_response,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
            return {
                "response": error_response,
                "suggestions": ["What is this form for?", "Help me fill out this form"],
                "field_context": None,
                "timestamp": timestamp
            }
    
    def generate_followup_suggestions(self, user_message, assistant_response, field_context):
        """
        Generate contextual follow-up suggestions based on the conversation.
        
        Args:
            user_message: The user's last message
            assistant_response: The assistant's response
            field_context: Context about the field being discussed (if any)
            
        Returns:
            List of suggested follow-up questions
        """
        suggestions = []
        
        # If discussing a specific field
        if field_context:
            field_name = field_context.get("label") or field_context.get("name")
            field_type = field_context.get("type", "text")
            standard_key = self.get_standardized_field_key(field_context)
            
            # Add field-specific follow-ups
            if "format" not in user_message.lower() and "format" not in assistant_response.lower():
                suggestions.append(f"What format should I use for {field_name}?")
                
            if "example" not in user_message.lower() and "example" not in assistant_response.lower():
                suggestions.append(f"Give me an example for {field_name}")
                
            if "required" not in user_message.lower() and "require" not in assistant_response.lower():
                suggestions.append(f"Is {field_name} required?")
            
            # Special field-type suggestions
            if field_type == "password" or standard_key == "password":
                suggestions.append("What makes a strong password?")
            
            if field_type == "email" or standard_key == "email":
                suggestions.append("What if I don't have an email address?")
            
        # Form-level suggestions
        if not field_context and self.current_form:
            # Find required fields
            required_fields = []
            for field in self.current_form.get("fields", []):
                if field.get("required", False):
                    field_name = field.get("label") or field.get("name")
                    if field_name:
                        required_fields.append(field_name)
            
            if required_fields:
                suggestions.append("What fields are required?")
                
            # Add general form suggestions
            suggestions.append("What is this form used for?")
            suggestions.append("What happens after I submit?")
            
        # If suggestions list is still empty, add generic suggestions
        if not suggestions:
            if self.current_form:
                suggestions = [
                    "Tell me about this form",
                    "What information do I need to provide?",
                    "Is my data secure on this form?"
                ]
            else:
                suggestions = [
                    "How can you help me?",
                    "What types of forms can you assist with?",
                    "How do I get started?"
                ]
                
        # Limit to 3 suggestions
        return suggestions[:3]
    
    def ask_question(self, question, field_context=None):
        """
        Intelligent question answering about forms or specific fields.
        
        Args:
            question: The user's question
            field_context: Optional context about the field being asked about
            
        Returns:
            String response answering the question
        """
        try:
            # If question is about a specific field and we have context
            if field_context:
                return self.answer_field_question(question, field_context)
            
            # Check if API is available
            if not self.has_api:
                # Use rule-based responses
                return self._get_rule_based_answer(question)
                
            if self.current_form:
                # If we have form context, use the form-specific prompt
                prompt = PromptTemplate(
                    input_variables=["question", "form_type", "fields"],
                    template=FORM_QUESTION_PROMPT
                )
                
                # Extract field names for context
                field_names = []
                for field in self.current_form.get('fields', []):
                    if 'label' in field and field['label']:
                        field_names.append(field['label'])
                    elif 'name' in field and field['name']:
                        field_names.append(field['name'])
                
                chain = LLMChain(llm=self.llm, prompt=prompt)
                response = chain.run(
                    question=question,
                    form_type=self.current_form.get("form_type", "Unknown"),
                    fields=", ".join(field_names)
                )
            else:
                # Generic question answering
                prompt = PromptTemplate(
                    input_variables=["question"],
                    template="Answer the following question about forms: {question}"
                )
                
                chain = LLMChain(llm=self.llm, prompt=prompt)
                response = chain.run(question=question)
                
            return response.strip()
        except Exception as e:
            logger.error(f"Error in ask_question: {e}")
            logger.error(traceback.format_exc())
            return "I'm sorry, I couldn't process that question. Please try again."
    
    def answer_field_question(self, question, field_context):
        """
        Answer questions specifically about a form field with rich context.
        
        Args:
            question: The user's question about the field
            field_context: Dictionary with field details
            
        Returns:
            String response with information about the field
        """
        # Determine what aspect of the field the question is asking about
        question_type = self.identify_question_type(question)
        
        # Get standardized field key for our knowledge base
        field_key = self.get_standardized_field_key(field_context)
        
        # Get display name for the field
        field_label = field_context.get("label", "")
        field_name = field_context.get("name", "")
        display_name = field_label or field_name or "this field"
        
        # Get information from knowledge base
        field_info = self.get_field_aspect(field_key, question_type)
        
        # If we have knowledge base info, return it
        if field_info:
            return field_info
            
        # If no specific info for this aspect, get the purpose
        purpose_info = self.get_field_aspect(field_key, "purpose")
        if purpose_info:
            if question_type == "required":
                required = field_context.get("required", False)
                if required:
                    return f"Yes, the {display_name} field is required and must be filled out."
                else:
                    return f"No, the {display_name} field appears to be optional."
            
            # Default to purpose info for other question types
            return purpose_info
            
        # If using OpenAI, generate a response
        if self.has_api:
            try:
                # Create a custom prompt based on the field and question
                prompt_template = f"""
                You are explaining a form field to a user.
                
                Field name: {display_name}
                Field type: {field_context.get('type', 'text')}
                Field is required: {field_context.get('required', False)}
                Help text: {field_context.get('helpText', '')}
                
                The user asked: "{question}"
                
                Provide a concise, helpful response in 1-2 sentences focusing on the {question_type} of this field.
                """
                
                chain = LLMChain(llm=self.llm, prompt=PromptTemplate.from_template(prompt_template))
                return chain.run().strip()
            except Exception as e:
                logger.error(f"Error generating field answer: {e}")
        
        # Fallback responses based on question type
        if question_type == "purpose":
            return f"The {display_name} field is used to collect information about your {display_name.lower()}."
        elif question_type == "format":
            if field_context.get("type") == "email":
                return f"Enter your email address in the standard format (e.g., name@example.com)."
            elif field_context.get("type") == "password":
                return f"Create a strong password using a combination of letters, numbers, and special characters."
            elif field_context.get("type") == "tel":
                return f"Enter your phone number, typically in the format XXX-XXX-XXXX."
            else:
                return f"Enter your {display_name.lower()} in the requested format."
        elif question_type == "required":
            required = field_context.get("required", False)
            if required:
                return f"Yes, the {display_name} field is required and must be filled out."
            else:
                return f"No, the {display_name} field appears to be optional."
        elif question_type == "examples":
            if field_context.get("type") == "email":
                return "Examples include: user@example.com, john.doe@company.org"
            elif field_context.get("type") == "tel":
                return "Examples include: 555-123-4567, (555) 123-4567"
            else:
                return f"Enter your {display_name.lower()} as it appears on your records or ID."
        else:
            return f"The {display_name} field is where you enter your {display_name.lower()}. This helps the organization process your information correctly."
    
    def _get_rule_based_answer(self, question):
        """Provide rule-based answers when API is not available"""
        question_lower = question.lower()
        
        # Password related questions
        if "password" in question_lower:
            if "strong" in question_lower or "good" in question_lower or "choose" in question_lower:
                return "A strong password should be at least 12 characters long, include uppercase and lowercase letters, numbers, and special characters. Avoid using personal information like names or birthdays."
            else:
                return "The password field is where you create a secure password for your account. This will be used to access your account in the future."
        
        # Email related questions
        elif "email" in question_lower:
            return "The email field is where you enter your email address. This will be used for communication and possibly as your login username."
        
        # Name related questions
        elif "name" in question_lower:
            if "first" in question_lower:
                return "The first name field is where you enter your given name or first name. Enter it exactly as it appears on your official documents."
            elif "last" in question_lower:
                return "The last name field is where you enter your family name or surname. Enter it exactly as it appears on your official documents."
            else:
                return "The name fields are for your legal name as it appears on your official documents. This helps verify your identity."
        
        # Date related questions
        elif "date" in question_lower or "birth" in question_lower:
            return "Enter your birth date in the format MM/DD/YYYY. For example, January 15, 1990 would be entered as 01/15/1990."
        
        # Form related questions
        elif "form" in question_lower:
            if self.current_form:
                form_type = self.current_form.get("form_type", "registration")
                return f"This appears to be a {form_type} form where you'll enter personal information to create an account."
            else:
                return "This appears to be a registration form where you'll enter personal information to create an account."
        
        # Help related questions
        elif "help" in question_lower:
            return "I can help you understand what different fields are for and how to fill out this form correctly. Is there something specific you'd like to know?"
        
        # Default response
        else:
            return "I can help you understand what different fields are for and how to fill out this form correctly. Is there something specific you'd like to know?"
    
    def explain_form_field(self, field_name):
        """Explain what a form field is used for."""
        logger.info(f"Explaining field: {field_name}")
        
        # Check if we have form context
        if self.current_form:
            # Try to find the field in the current form
            for field in self.current_form.get('fields', []):
                if (field.get('name', '').lower() == field_name.lower() or 
                    field.get('label', '').lower() == field_name.lower() or 
                    field.get('id', '').lower() == field_name.lower()):
                    
                    # Check for extended field context
                    field_context = field
                    
                    # Get standardized field key
                    field_key = self.get_standardized_field_key(field_context)
                    
                    # Try to get purpose from knowledge base first
                    purpose_info = self.get_field_aspect(field_key, "purpose")
                    if purpose_info:
                        return purpose_info
                    
                    # Use context-aware explanation with OpenAI
                    if self.has_api:
                        prompt_template = """
                        You are explaining the purpose of a form field to a user.
                        
                        Field name: {field_name}
                        Field type: {field_type}
                        Form type: {form_type}
                        Required: {required}
                        
                        Provide a concise 1-2 sentence explanation of what this field is used for.
                        """
                        
                        prompt = PromptTemplate(
                            input_variables=["field_name", "field_type", "form_type", "required"],
                            template=prompt_template
                        )
                        
                        chain = LLMChain(llm=self.llm, prompt=prompt)
                        return chain.run(
                            field_name=field.get('label', field_name),
                            field_type=field.get('type', 'text'),
                            form_type=self.current_form.get('form_type', 'Generic Form'),
                            required=field.get('required', False)
                        ).strip()
                    
                    # Fallback to basic explanation
                    return f"This field is for your {field.get('label', field_name).lower()}."
        
        # Fallback explanations for common fields - check against our knowledge base
        for standard_key, variations in self.name_variations.items():
            field_key = field_name.lower().replace(" ", "_").replace("-", "_")
            if field_key == standard_key or field_key in variations:
                purpose_info = self.get_field_aspect(standard_key, "purpose")
                if purpose_info:
                    return purpose_info
        
        # Additional fallback explanations for common fields
        explanations = {
            "first_name": "Your first or given name.",
            "last_name": "Your family or surname.",
            "email": "Your email address used for communication.",
            "password": "A secure password to protect your account.",
            "dob": "Your date of birth in the format shown.",
            "date_of_birth": "Your date of birth in the format shown.",
            "name": "Your full name.",
            "address": "Your physical mailing address.",
            "phone": "Your phone number including area code.",
            "ssn": "Your Social Security Number (9 digits).",
            "zip": "Your postal or ZIP code."
        }
        
        try:
            # Check if we have a pre-defined explanation
            field_key = field_name.lower().replace(" ", "_")
            if field_key in explanations:
                logger.info(f"Using predefined explanation for {field_name}")
                return explanations[field_key]
                
            # Check if API is available
            if not self.has_api:
                logger.info("API not available, using generic explanation")
                return f"This field is used to collect your {field_name}."
                
            # Use AI to generate explanation
            logger.info(f"Generating AI explanation for {field_name}")
            prompt = f"Explain what the form field '{field_name}' is typically used for in 2-3 sentences."
            
            completion = self.llm(prompt)
            logger.info(f"AI generated explanation: {completion.strip()}")
            return completion.strip()
        except Exception as e:
            logger.error(f"Error in explain_form_field: {e}")
            logger.error(traceback.format_exc())
            # Fallback to generic explanation
            return f"This field is used to collect your {field_name}."
    
    def validate_field(self, field_name, expected_format, current_value):
        """Validate user input for a specific field type."""
        try:
            # Check if API is available
            if not self.has_api:
                # Simple rule-based validation
                if expected_format == "email" and "@" not in current_value:
                    return {"is_valid": False, "message": "Email address must contain @ symbol."}
                elif expected_format == "password" and len(current_value) < 8:
                    return {"is_valid": False, "message": "Password should be at least 8 characters."}
                elif expected_format == "tel" and not re.match(r"^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$", current_value):
                    return {"is_valid": False, "message": "Phone number should be in format XXX-XXX-XXXX."}
                return {"is_valid": True, "message": "Field looks valid."}
                
            prompt = PromptTemplate(
                input_variables=["field_name", "field_type", "user_input"],
                template=FIELD_VALIDATION_PROMPT
            )
            
            chain = LLMChain(llm=self.llm, prompt=prompt)
            response = chain.run(
                field_name=field_name,
                field_type=expected_format,
                user_input=current_value
            )
            
            return {"is_valid": "invalid" not in response.lower(), "message": response.strip()}
        except Exception as e:
            logger.error(f"Error in validate_field: {e}")
            logger.error(traceback.format_exc())
            return {"is_valid": False, "message": "Could not validate field."}
    
    def suggest_field_value(self, field_context):
        """Suggest a valid value for a field based on its type and purpose."""
        try:
            field_name = field_context.get("name", "")
            field_type = field_context.get("type", "text")
            field_key = self.get_standardized_field_key(field_context)
            
            # Common suggestions based on field type
            suggestions = {
                "email": "example@example.com",
                "password": "SecurePass123!",
                "first_name": "John",
                "last_name": "Doe",
                "full_name": "John Doe",
                "phone": "555-123-4567",
                "address": "123 Main St",
                "city": "New York",
                "state": "NY",
                "zip": "10001",
                "date_of_birth": "01/15/1990",
                "credit_card": "4111 1111 1111 1111",
                "cvv": "123",
                "expiration": "05/25"
            }
            
            # Check if we have a standard suggestion
            if field_key in suggestions:
                return suggestions[field_key]
                
            # Fallback to type-based suggestion
            if field_type == "email":
                return "example@example.com"
            elif field_type == "password":
                return "SecurePass123!"
            elif field_type == "tel" or field_type == "telephone":
                return "555-123-4567"
            elif field_type == "number":
                return "42"
            elif field_type == "date":
                return "2023-01-01"
            elif field_type == "checkbox":
                return "Checked"
            elif field_type == "radio":
                return "Selected"
            elif field_type == "text":
                return f"Sample {field_name}"
            else:
                return "Sample value"
                
        except Exception as e:
            logger.error(f"Error in suggest_field_value: {e}")
            return "Sample value"