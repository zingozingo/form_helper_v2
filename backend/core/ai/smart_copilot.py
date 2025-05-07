# backend/core/ai/smart_copilot.py

import os
import json
import logging
import ssl
import time
import asyncio
from typing import Dict, List, Any, Optional, Union
import aiohttp
import traceback
from threading import Lock

from dotenv import load_dotenv
from .form_context_analyzer import FormContextAnalyzer

# Import prompts
from .prompts.enhanced_prompts import (
    FORM_CONTEXT_SYSTEM_PROMPT,
    ENHANCED_FIELD_EXPLANATION_PROMPT,
    FORM_TYPE_ANALYSIS_PROMPT,
    FIELD_RELATIONSHIP_PROMPT,
    PRIVACY_FOCUSED_PROMPT,
    COMPLEX_FIELD_PROMPT,
    VALIDATION_EXPLANATION_PROMPT
)

# Load environment variables from .env file
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smart_copilot")

class SmartCopilot:
    """
    An enhanced AI assistant that combines:
    1. Local knowledge base of common form fields and patterns
    2. Advanced form analysis
    3. Context-aware prompting
    4. API integration with LLMs
    5. Response caching with threading support
    """
    
    def __init__(self, disable_ssl_verification=True):
        """Initialize the smart copilot system."""
        # Load form context analyzer
        self.analyzer = FormContextAnalyzer()
        
        # Set up API configuration
        self.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
        self.api_provider = os.getenv("AI_PROVIDER", "openai").lower()
        
        # Set default models with environment variable overrides
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4")
        self.anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")
        
        # SSL verification setting
        self.disable_ssl_verification = disable_ssl_verification
        
        # Set up response cache with thread safety
        self.response_cache = {}
        self.cache_expiry = 3600 * 24 * 7  # 1 week by default
        self.cache_lock = Lock()  # Thread lock for cache access
        
        # Tracking variables for insights
        self.total_api_calls = 0
        self.cache_hits = 0
        self.knowledge_base_hits = 0
        
        # Log API key status (safely)
        if self.api_key:
            masked_key = f"{self.api_key[:5]}...{self.api_key[-4:]}" if len(self.api_key) > 10 else "***"
            logger.info(f"API key loaded: {masked_key}")
        else:
            logger.warning("No API key found in environment variables!")
            
        logger.info(f"Initialized SmartCopilot with {self.api_provider} API")
    
    async def get_response(self, question: str, field_context: Optional[Dict[str, Any]] = None, form_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Enhanced response generator with additional context and metadata.
        
        Args:
            question: User's question
            field_context: Optional context about the form field
            form_context: Optional context about the overall form
            
        Returns:
            Dict with response and metadata
        """
        start_time = time.time()
        
        # Generate cache key
        cache_key = f"{question}|{json.dumps(field_context) if field_context else ''}|{json.dumps(form_context) if form_context else ''}"
        
        # Check cache first
        cached = self._check_cache(cache_key)
        if cached:
            logger.info("Using cached response")
            self.cache_hits += 1
            # Create response with metadata
            return {
                "response": cached,
                "source": "cache",
                "processing_time": 0.0,
                "cached": True,
                "enhanced_context_used": True,
                "model": "cached"
            }
        
        # Enhance context for better understanding
        enhanced_context = self._enhance_context(question, field_context, form_context)
        
        # Try knowledge base response first
        kb_response = self._get_knowledge_base_response(question, enhanced_context)
        if kb_response:
            logger.info("Using knowledge base response")
            self.knowledge_base_hits += 1
            processing_time = time.time() - start_time
            
            # Cache the response
            self._cache_response(cache_key, kb_response)
            
            # Create response with metadata
            return {
                "response": kb_response,
                "source": "knowledge_base",
                "processing_time": processing_time,
                "cached": False,
                "enhanced_context_used": True,
                "field_category": enhanced_context.get("field_category", "unknown") if field_context else None,
                "question_type": enhanced_context.get("question_type", "unknown")
            }
            
        # If no knowledge base response, try API
        try:
            if self.api_key:
                logger.info(f"Calling {self.api_provider} API")
                
                # Select appropriate prompt template based on context
                prompt_template, system_message = self._select_prompt_template(enhanced_context)
                
                # Prepare the formatted prompt
                formatted_prompt = self._format_prompt(prompt_template, enhanced_context)
                
                # Make API call
                self.total_api_calls += 1
                api_response = await self._call_ai_api(formatted_prompt, system_message)
                
                if api_response:
                    logger.info(f"Received API response: {api_response[:50]}...")
                    # Cache the response
                    self._cache_response(cache_key, api_response)
                    
                    processing_time = time.time() - start_time
                    
                    # Create response with metadata
                    return {
                        "response": api_response,
                        "source": "api",
                        "model": self.openai_model if self.api_provider == "openai" else self.anthropic_model,
                        "processing_time": processing_time,
                        "cached": False,
                        "enhanced_context_used": True,
                        "prompt_template": prompt_template.__name__ if hasattr(prompt_template, "__name__") else "custom",
                        "context_enhancement": list(enhanced_context.keys())
                    }
                else:
                    logger.warning("API call returned None or empty response")
            else:
                logger.warning("Skipping API call - no API key available")
        except Exception as e:
            logger.error(f"API error: {str(e)}")
            logger.error(traceback.format_exc())
        
        # Fallback response if all else fails
        logger.info("Using fallback response")
        fallback = self._get_fallback_response(question, enhanced_context)
        
        # In development, make it clear we're using fallback
        if os.getenv("ENVIRONMENT") != "production":
            fallback = f"[FALLBACK: API unavailable] {fallback}"
            
        processing_time = time.time() - start_time
        self._cache_response(cache_key, fallback)
        
        # Create response with metadata
        return {
            "response": fallback,
            "source": "fallback",
            "processing_time": processing_time,
            "cached": False,
            "enhanced_context_used": True,
            "error": "API call failed or no API key available"
        }
    
    def analyze_form(self, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a form to extract enhanced context.
        
        Args:
            form_data: Dictionary with form information
            
        Returns:
            Enhanced form context analysis
        """
        return self.analyzer.analyze_form(form_data)
    
    def get_field_context(self, field_name: str, field_type: str, form_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get enhanced context for a specific field.
        
        Args:
            field_name: Name of the field
            field_type: Type of the field
            form_context: Optional context about the form
            
        Returns:
            Enhanced field context
        """
        return self.analyzer.get_field_context(field_name, field_type, form_context or {})
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about copilot usage.
        
        Returns:
            Dictionary with usage statistics
        """
        with self.cache_lock:
            cache_size = len(self.response_cache)
        
        return {
            "total_api_calls": self.total_api_calls,
            "cache_hits": self.cache_hits,
            "knowledge_base_hits": self.knowledge_base_hits,
            "cache_size": cache_size,
            "api_provider": self.api_provider,
            "model": self.openai_model if self.api_provider == "openai" else self.anthropic_model
        }
    
    def _enhance_context(self, question: str, field_context: Optional[Dict[str, Any]], form_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Enhance the context for more intelligent responses.
        
        Args:
            question: The user's question
            field_context: Optional context about the field
            form_context: Optional context about the form
            
        Returns:
            Enhanced context dictionary
        """
        # Start with question analysis
        enhanced_context = self.analyzer.enhance_question_context(question, field_context, form_context)
        
        # If we have a field_context, enhance it
        if field_context and isinstance(field_context, dict):
            field_name = field_context.get("name", "")
            field_type = field_context.get("type", "")
            
            # Add field category based on name patterns
            if any(term in field_name.lower() for term in ["name", "first", "last"]):
                enhanced_context["field_category"] = "personal_information"
            elif any(term in field_name.lower() for term in ["email", "phone", "tel"]):
                enhanced_context["field_category"] = "contact_information"
            elif any(term in field_name.lower() for term in ["password", "username", "login"]):
                enhanced_context["field_category"] = "credentials"
            elif any(term in field_name.lower() for term in ["address", "city", "state", "zip"]):
                enhanced_context["field_category"] = "address"
            elif any(term in field_name.lower() for term in ["card", "payment", "cvv"]):
                enhanced_context["field_category"] = "payment"
            else:
                enhanced_context["field_category"] = "other"
            
            # Add enhanced field information if we have form context
            if form_context:
                enhanced_field_context = self.analyzer.get_field_context(field_name, field_type, form_context)
                enhanced_context["enhanced_field_context"] = enhanced_field_context
        
        # If we have form_context but not enhanced version, analyze it
        if form_context and "form_type_info" not in form_context:
            enhanced_form_context = self.analyzer.analyze_form(form_context)
            enhanced_context["enhanced_form_context"] = enhanced_form_context
        
        return enhanced_context
    
    def _get_knowledge_base_response(self, question: str, enhanced_context: Dict[str, Any]) -> Optional[str]:
        """
        Get response from local knowledge base.
        
        Args:
            question: User's question
            enhanced_context: Enhanced context dictionary
            
        Returns:
            Knowledge base response or None if not found
        """
        question_lower = question.lower()
        
        # Check for common questions first
        if "common_question_match" in enhanced_context:
            return enhanced_context["standard_response"]
        
        # Check if this is about a specific field
        field_context = enhanced_context.get("field_context")
        if field_context:
            field_name = field_context.get("name", "").lower()
            field_type = field_context.get("type", "").lower()
            
            # Try to find field in knowledge base
            field_info = None
            kb = self.analyzer.knowledge_base
            
            # Try direct name match
            if field_name in kb.get("fields", {}):
                field_info = kb["fields"][field_name]
            
            # Try type match
            elif field_type in kb.get("fields", {}):
                field_info = kb["fields"][field_type]
            
            if field_info:
                # Determine question type from enhanced context
                question_type = enhanced_context.get("question_type", "general")
                focus_areas = enhanced_context.get("focus_areas", [])
                
                # Build a comprehensive response with relevant information
                response_parts = []
                
                # Start with purpose information for most questions
                if "purpose" in field_info:
                    response_parts.append(field_info.get("purpose", ""))
                
                # Add format information for most question types
                if "format" in field_info and (question_type != "purpose" or "format" in focus_areas):
                    response_parts.append(field_info.get("format", ""))
                
                # Add importance information when relevant
                if "importance" in field_info and (question_type in ["requirement", "general"] or not focus_areas):
                    response_parts.append(field_info.get("importance", ""))
                
                # Add privacy implications for security/privacy questions
                if "privacy_implications" in field_info and (question_type == "security" or "privacy" in focus_areas):
                    response_parts.append(field_info.get("privacy_implications", ""))
                
                # Add examples for format/procedural questions or example requests
                if "examples" in field_info and (question_type in ["procedural", "example_request"] or "format" in focus_areas):
                    response_parts.append(f"Examples: {field_info.get('examples', '')}")
                
                # Add common mistakes for general questions or when specifically requested
                if "common_mistakes" in field_info:
                    response_parts.append(f"Common mistakes to avoid: {field_info.get('common_mistakes', '')}")
                
                # Add required/optional status for requirement questions
                if question_type == "requirement":
                    required_status = "Yes, this field is required." if field_context.get("required") else "No, this field is optional."
                    if not response_parts:  # Put at beginning if nothing else
                        response_parts.insert(0, required_status)
                    else:  # Otherwise after purpose
                        response_parts.insert(1, required_status)
                
                # If we still have no specific parts (unlikely), default to purpose + format
                if not response_parts and field_info:
                    basic_info = []
                    if "purpose" in field_info:
                        basic_info.append(field_info.get("purpose", ""))
                    if "format" in field_info:
                        basic_info.append(field_info.get("format", ""))
                    if "common_mistakes" in field_info:
                        basic_info.append(f"Common mistakes to avoid: {field_info.get('common_mistakes', '')}")
                    return " ".join(basic_info)
                
                # Join the parts with spaces for better readability
                return " ".join(response_parts)
                
        # No knowledge base response found
        return None
    
    def _select_prompt_template(self, enhanced_context: Dict[str, Any]) -> tuple:
        """
        Select the most appropriate prompt template based on context.
        
        Args:
            enhanced_context: Enhanced context dictionary
            
        Returns:
            Tuple of (prompt_template, system_message)
        """
        # Default system message
        system_message = FORM_CONTEXT_SYSTEM_PROMPT
        
        # Check if this is a field-specific question
        if "field_context" in enhanced_context:
            # Check question type and focus
            question_type = enhanced_context.get("question_type", "general")
            focus_areas = enhanced_context.get("focus_areas", [])
            
            if "privacy" in focus_areas or question_type == "security":
                return PRIVACY_FOCUSED_PROMPT, system_message
            elif "validation" in question_type or "format" in focus_areas:
                return VALIDATION_EXPLANATION_PROMPT, system_message
            elif "relationships" in enhanced_context.get("enhanced_field_context", {}):
                return FIELD_RELATIONSHIP_PROMPT, system_message
            elif enhanced_context.get("field_category") in ["credentials", "payment"]:
                return COMPLEX_FIELD_PROMPT, system_message
            else:
                return ENHANCED_FIELD_EXPLANATION_PROMPT, system_message
        # If this is about the overall form
        elif "form_context" in enhanced_context or "enhanced_form_context" in enhanced_context:
            return FORM_TYPE_ANALYSIS_PROMPT, system_message
        else:
            # Default to enhanced field explanation
            return ENHANCED_FIELD_EXPLANATION_PROMPT, system_message
    
    def _format_prompt(self, template: str, context: Dict[str, Any]) -> str:
        """
        Format a prompt template with the provided context.
        
        Args:
            template: Prompt template string
            context: Context dictionary
            
        Returns:
            Formatted prompt
        """
        # Extract variables needed for different templates
        field_name = context.get("field_context", {}).get("name", "Unknown")
        field_type = context.get("field_context", {}).get("type", "Unknown")
        required = "Yes" if context.get("field_context", {}).get("required", False) else "No"
        form_type = context.get("form_context", {}).get("form_type", "Unknown")
        form_purpose = context.get("form_context", {}).get("form_purpose", "")
        question = context.get("original_question", "")
        
        # Try to extract enhanced context variables
        if "enhanced_form_context" in context:
            efc = context["enhanced_form_context"]
            form_type = efc.get("form_type", form_type)
            key_fields = ", ".join(efc.get("key_fields", []))
            field_count = efc.get("field_count", 0)
        else:
            key_fields = "Unknown"
            field_count = 0
        
        # Get field relationships if available
        if "enhanced_field_context" in context and "relationships" in context["enhanced_field_context"]:
            related_fields = ", ".join([r["field"] for r in context["enhanced_field_context"]["relationships"]])
        else:
            related_fields = "None"
            
        # Initialize all required variables with default values
        field_purpose = "processing information in this form"
        constraints = "standard validation rules"
        format_requirements = "standard format"
        error_message = "Invalid format"
        input_method = "keyboard input"
        validation = "standard validation"
        
        # Get extra field info if available
        field_kb = self.analyzer.knowledge_base.get("fields", {}).get(field_name.lower(), {})
        if field_kb:
            if "purpose" in field_kb:
                field_purpose = field_kb["purpose"]
            if "format" in field_kb:
                constraints = field_kb["format"]
                format_requirements = field_kb["format"]
                validation = field_kb["format"]
        
        # Prepare format variables
        # For validation prompt
        format_requirements = constraints
        error_message = "Invalid format"
        validation_info = context.get("field_context", {}).get("validation", {})
        if validation_info:
            if isinstance(validation_info, dict):
                if "pattern" in validation_info:
                    format_requirements = f"Pattern: {validation_info['pattern']}"
                if "message" in validation_info:
                    error_message = validation_info["message"]
            elif isinstance(validation_info, str):
                format_requirements = validation_info
        
        # For accessibility prompt
        input_method = "keyboard input"
        if field_type in ["checkbox", "radio"]:
            input_method = "click/tap selection"
        elif field_type in ["select"]:
            input_method = "dropdown selection"
        elif field_type in ["file"]:
            input_method = "file upload"
        
        format_vars = {
            "field_name": field_name,
            "field_type": field_type,
            "required": required,
            "form_type": form_type,
            "form_purpose": form_purpose,
            "question": question,
            "key_fields": key_fields,
            "field_count": field_count,
            "related_fields": related_fields,
            "field_purpose": field_purpose,
            "constraints": constraints,
            "format_requirements": format_requirements,
            "error_message": error_message,
            "input_method": input_method,
            "validation": format_requirements
        }
        
        # Format with available variables
        try:
            return template.format(**format_vars)
        except KeyError as e:
            logger.warning(f"Missing format variable in template: {e}")
            # Fallback to basic formatting
            return f"Please answer this question about a form field: {question}"
    
    def _get_fallback_response(self, question: str, enhanced_context: Dict[str, Any]) -> str:
        """
        Generate a more intelligent fallback response based on enhanced context.
        
        Args:
            question: User's question
            enhanced_context: Enhanced context dictionary
            
        Returns:
            Fallback response
        """
        # Get field context if available
        field_context = enhanced_context.get("field_context")
        
        if field_context:
            field_name = field_context.get("label") or field_context.get("name") or "this field"
            field_category = enhanced_context.get("field_category", "other")
            
            # Provide different responses based on field category
            if field_category == "personal_information":
                return f"This field collects your {field_name.lower()}, which helps identify you and process your information correctly. This is typically required for personalization and identification purposes."
            elif field_category == "contact_information":
                return f"The {field_name.lower()} field allows the organization to contact you for important notifications, updates, or verification purposes. Make sure to provide accurate information."
            elif field_category == "credentials":
                return f"This {field_name.lower()} field is part of your account security and access credentials. Choose a secure value that follows the required format."
            elif field_category == "address":
                return f"This field collects your {field_name.lower()} as part of your address information, usually for shipping, billing, or identity verification purposes."
            elif field_category == "payment":
                return f"The {field_name.lower()} field is required for payment processing. This sensitive information is securely transmitted and processed according to industry standards."
            else:
                return f"This field is for entering your {field_name.lower()}. It helps identify you and process your information correctly."
        
        # Analyze question type for more relevant fallback
        question_type = enhanced_context.get("question_type", "general")
        
        if question_type == "purpose" or "why" in question.lower():
            return "This information is typically collected to process your request, verify your identity, or provide the service you're requesting. The specific purpose depends on the form's overall function."
        elif question_type == "security" or "privacy" in enhanced_context.get("focus_areas", []):
            return "Organizations should protect your information according to their privacy policy. Reputable services use encryption and security measures to safeguard sensitive data."
        elif question_type == "requirement":
            return "Required fields are typically marked with an asterisk (*) and must be completed to submit the form. Optional fields can be left blank."
        else:
            return "I can help you understand this form. Feel free to ask about specific fields or the form's purpose for more detailed information."
    
    def _check_cache(self, key: str) -> Optional[str]:
        """
        Thread-safe cache check.
        
        Args:
            key: Cache key
            
        Returns:
            Cached response or None
        """
        with self.cache_lock:
            if key in self.response_cache:
                entry = self.response_cache[key]
                if time.time() - entry["timestamp"] < self.cache_expiry:
                    return entry["response"]
                else:
                    # Clean up expired entry
                    del self.response_cache[key]
        
        return None
    
    def _cache_response(self, key: str, response: str) -> None:
        """
        Thread-safe response caching.
        
        Args:
            key: Cache key
            response: Response to cache
        """
        with self.cache_lock:
            self.response_cache[key] = {
                "response": response,
                "timestamp": time.time()
            }
    
    async def _call_ai_api(self, prompt: str, system_message: str) -> Optional[str]:
        """
        Call the appropriate AI API with the prompt.
        
        Args:
            prompt: Formatted prompt
            system_message: System message/instructions
            
        Returns:
            API response or None if unavailable
        """
        if not self.api_key:
            logger.warning("No API key available for API call")
            return None
        
        if self.api_provider == "openai":
            return await self._call_openai(prompt, system_message)
        elif self.api_provider == "anthropic":
            return await self._call_anthropic(prompt, system_message)
        else:
            logger.error(f"Unknown API provider: {self.api_provider}")
            return None
    
    async def _call_openai(self, prompt: str, system_message: str) -> Optional[str]:
        """
        Call OpenAI API with improved prompting.
        
        Args:
            prompt: Formatted prompt
            system_message: System message for context
            
        Returns:
            API response or None if failed
        """
        # Create a custom SSL context if SSL verification is disabled
        ssl_context = None
        if self.disable_ssl_verification:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        connector = aiohttp.TCPConnector(ssl=ssl_context) if self.disable_ssl_verification else None
        
        # Get configurable values from environment
        max_tokens = int(os.getenv("MAX_TOKENS", "800"))
        temperature = float(os.getenv("AI_TEMPERATURE", "0.7"))

        async with aiohttp.ClientSession(connector=connector) as session:
            try:
                logger.info("Sending request to OpenAI API...")
                
                payload = {
                    "model": self.openai_model,
                    "messages": [
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature
                }
                
                logger.debug(f"Request payload: {json.dumps(payload, indent=2)}")
                
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=60  # Increased timeout to 60 seconds to avoid timeout errors
                ) as response:
                    response_text = await response.text()
                    logger.info(f"API response status: {response.status}")
                    
                    if response.status != 200:
                        logger.error(f"OpenAI API error: {response_text}")
                        return None
                        
                    data = await response.json()
                    return data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.error(f"OpenAI API request failed: {str(e)}")
                logger.error(traceback.format_exc())
                return None
    
    async def _call_anthropic(self, prompt: str, system_message: str) -> Optional[str]:
        """
        Call Anthropic API with Claude model.
        
        Args:
            prompt: Formatted prompt
            system_message: System message for context
            
        Returns:
            API response or None if failed
        """
        # Create a custom SSL context if SSL verification is disabled
        ssl_context = None
        if self.disable_ssl_verification:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        connector = aiohttp.TCPConnector(ssl=ssl_context) if self.disable_ssl_verification else None
        
        # Get configurable values from environment
        max_tokens = int(os.getenv("MAX_TOKENS", "800"))
        temperature = float(os.getenv("AI_TEMPERATURE", "0.7"))

        async with aiohttp.ClientSession(connector=connector) as session:
            try:
                logger.info("Sending request to Anthropic API...")
                
                # Format messages for Anthropic API
                messages = [
                    {"role": "user", "content": prompt}
                ]
                
                # Add system message if API version supports it
                system = system_message
                
                async with session.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.anthropic_model,
                        "messages": messages,
                        "system": system,
                        "max_tokens": max_tokens,
                        "temperature": temperature
                    },
                    timeout=60  # Increased timeout to 60 seconds to avoid timeout errors
                ) as response:
                    response_text = await response.text()
                    logger.info(f"API response status: {response.status}")
                    
                    if response.status != 200:
                        logger.error(f"Anthropic API error: {response_text}")
                        return None
                        
                    data = await response.json()
                    return data["content"][0]["text"]
            except Exception as e:
                logger.error(f"Anthropic API request failed: {str(e)}")
                logger.error(traceback.format_exc())
                return None
    
    async def test_api_connection(self) -> Dict[str, Any]:
        """
        Test the API connection directly.
        
        Returns:
            dict: Connection test results
        """
        logger.info("======= TESTING API CONNECTION =======")
        
        if not self.api_key:
            logger.error("No API key available for testing!")
            return {
                "success": False,
                "error": "No API key found in environment variables"
            }
        
        # Check API key format based on provider
        if self.api_provider == "openai":
            if not self.api_key.startswith("sk-"):
                logger.error(f"OpenAI API key has invalid format. Should start with 'sk-', found: {self.api_key[:3]}")
                return {
                    "success": False,
                    "error": "Invalid OpenAI API key format"
                }
        elif self.api_provider == "anthropic":
            if len(self.api_key) < 20:  # Basic length check for Anthropic keys
                logger.error("Anthropic API key appears too short")
                return {
                    "success": False,
                    "error": "Invalid Anthropic API key format"
                }
        else:
            logger.error(f"Unknown API provider: {self.api_provider}")
            return {
                "success": False,
                "error": f"Unknown API provider: {self.api_provider}. Supported providers are 'openai' and 'anthropic'."
            }
        
        # Test message
        test_prompt = "This is a test message. Please respond with 'API Connection Successful'"
        
        # Call API
        if self.api_provider == "openai":
            test_result = await self._call_openai(test_prompt, "You are a helpful assistant.")
        else:
            test_result = await self._call_anthropic(test_prompt, "You are a helpful assistant.")
        
        if test_result:
            logger.info(f"API TEST SUCCESSFUL! Response: {test_result}")
            return {
                "success": True,
                "response": test_result,
                "model": self.openai_model if self.api_provider == "openai" else self.anthropic_model
            }
        else:
            logger.error("API TEST FAILED! No response received")
            return {
                "success": False,
                "error": "API call failed or returned empty response"
            }