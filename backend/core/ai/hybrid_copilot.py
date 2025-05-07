import os
import json
import time
import logging
import ssl
import traceback
from typing import Dict, Any, Optional
import aiohttp
from threading import Lock
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hybrid_copilot")

# Try to import SmartCopilot for enhanced capabilities
try:
    from .smart_copilot import SmartCopilot
    SMART_COPILOT_AVAILABLE = True
    logger.info("SmartCopilot module loaded successfully - enhanced AI capabilities available")
except ImportError:
    SMART_COPILOT_AVAILABLE = False
    logger.warning("SmartCopilot module not available - using standard capabilities only")

class HybridCopilot:
    """
    A hybrid AI assistant that combines hardcoded knowledge with external AI APIs.
    This allows for fast, reliable responses for common questions while
    still providing flexibility for complex or unusual queries.
    """
    
    def __init__(self, disable_ssl_verification=True):
        """Initialize the hybrid copilot system."""
        # Load hardcoded responses
        self.knowledge_base = self._load_knowledge_base()
        
        # Set up API configuration
        self.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
        self.api_provider = os.getenv("AI_PROVIDER", "openai").lower()
        
        # Set default models with environment variable overrides
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4")
        self.anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")
        
        # SSL verification setting
        self.disable_ssl_verification = disable_ssl_verification
        
        # Log API key status (safely)
        if self.api_key:
            masked_key = f"{self.api_key[:5]}...{self.api_key[-4:]}" if len(self.api_key) > 10 else "***"
            logger.info(f"API key loaded: {masked_key}")
        else:
            logger.warning("No API key found in environment variables!")
        
        # Set up response cache with thread safety
        self.response_cache = {}
        self.cache_expiry = 3600 * 24 * 7  # 1 week
        self.cache_lock = Lock()  # Thread lock for cache access
        
        logger.info(f"Initialized HybridCopilot with {self.api_provider} API")
        
    def _load_knowledge_base(self):
        """
        Load built-in knowledge base from JSON file.
        
        Returns:
            dict: Knowledge base dictionary
        """
        try:
            kb_path = os.path.join(os.path.dirname(__file__), "field_knowledge.json")
            with open(kb_path, "r") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.error(f"Error loading knowledge base: {e}")
            # Return minimal default knowledge base
            return {
                "fields": {},
                "common_questions": {}
            }
    
    async def get_response(self, question: str, field_context: Optional[Dict[str, Any]] = None, form_context: Optional[Dict[str, Any]] = None):
        """
        Main entry point for getting responses.
        Tries hardcoded knowledge first, then SmartCopilot if available, then falls back to API.
        
        Args:
            question: User's question
            field_context: Optional context about the form field
            form_context: Optional context about the overall form
            
        Returns:
            str or dict: Response to the question (str for basic responses, dict for enhanced responses)
        """
        # Generate cache key
        cache_key = f"{question}|{json.dumps(field_context) if field_context else ''}|{json.dumps(form_context) if form_context else ''}"
        
        # Check cache first
        cached = self._check_cache(cache_key)
        if cached:
            logger.info("Using cached response")
            return cached
        
        # Try hardcoded response first
        hardcoded = self._get_hardcoded_response(question, field_context)
        if hardcoded:
            logger.info("Using hardcoded response")
            # Cache the response
            self._cache_response(cache_key, hardcoded)
            return hardcoded
        
        # Try SmartCopilot if it's available - this provides enhanced responses
        if SMART_COPILOT_AVAILABLE:
            try:
                logger.info("Trying SmartCopilot for enhanced response")
                # Initialize SmartCopilot if not already done
                smart_copilot = SmartCopilot(disable_ssl_verification=self.disable_ssl_verification)
                
                # Get enhanced response from SmartCopilot
                smart_response = await smart_copilot.get_response(
                    question=question,
                    field_context=field_context,
                    form_context=form_context
                )
                
                if smart_response:
                    logger.info("Using SmartCopilot response")
                    # For SmartCopilot, we might get a dict with metadata, or just a string
                    if isinstance(smart_response, dict):
                        # Just cache the text response part for simple HybridCopilot compatibility
                        self._cache_response(cache_key, smart_response.get("response", ""))
                        # But return the full response with metadata
                        return smart_response
                    else:
                        # It's a string response
                        self._cache_response(cache_key, smart_response)
                        return smart_response
            except Exception as e:
                logger.warning(f"SmartCopilot error, falling back to regular API: {str(e)}")
                logger.warning(traceback.format_exc())
                # Continue to regular API
            
        # If no SmartCopilot or it failed, try regular API
        try:
            if self.api_key:
                logger.info(f"Calling {self.api_provider} API")
                api_response = await self._call_ai_api(question, field_context, form_context)
                
                if api_response:
                    logger.info(f"Received API response: {api_response[:50]}...")
                    # Cache the response
                    self._cache_response(cache_key, api_response)
                    return api_response
                else:
                    logger.warning("API call returned None or empty response")
            else:
                logger.warning("Skipping API call - no API key available")
        except Exception as e:
            logger.error(f"API error: {str(e)}")
        
        # Fallback response if all else fails
        logger.info("Using fallback response")
        fallback = self._get_fallback_response(question, field_context)
        
        # In development, make it clear we're using fallback
        if os.getenv("ENVIRONMENT") != "production":
            fallback = f"[FALLBACK: API unavailable] {fallback}"
            
        self._cache_response(cache_key, fallback)
        return fallback
    
    def _get_hardcoded_response(self, question: str, field_context: Optional[Dict[str, Any]]):
        """
        Get response from hardcoded knowledge base.
        
        Args:
            question: User's question
            field_context: Optional context about the form field
            
        Returns:
            str: Hardcoded response or None if not found
        """
        question_lower = question.lower()
        
        # Check if question is about a specific field
        if field_context:
            field_name = field_context.get("name", "").lower()
            field_type = field_context.get("type", "").lower()
            
            # Try to find field in knowledge base
            field_info = None
            
            # Try direct name match
            if field_name in self.knowledge_base.get("fields", {}):
                field_info = self.knowledge_base["fields"][field_name]
            
            # Try type match
            elif field_type in self.knowledge_base.get("fields", {}):
                field_info = self.knowledge_base["fields"][field_type]
            
            if field_info:
                # Determine question type
                if any(word in question_lower for word in ["what", "why", "purpose", "used for"]):
                    return field_info.get("purpose", "")
                elif any(word in question_lower for word in ["format", "how"]):
                    return field_info.get("format", "")
                elif any(word in question_lower for word in ["require", "mandatory", "need"]):
                    return "Yes, this field is required." if field_context.get("required") else "No, this field is optional."
                elif any(word in question_lower for word in ["example", "sample"]):
                    return field_info.get("examples", "")
                else:
                    # Default to purpose
                    return field_info.get("purpose", "")
        
        # Check common questions
        for pattern, response in self.knowledge_base.get("common_questions", {}).items():
            if pattern in question_lower:
                return response
                
        # No hardcoded response found
        return None
    
    def _get_fallback_response(self, question: str, field_context: Optional[Dict[str, Any]]):
        """
        Generate a fallback response when hardcoded and API both fail.
        
        Args:
            question: User's question
            field_context: Optional context about the form field
            
        Returns:
            str: Fallback response
        """
        if field_context:
            field_name = field_context.get("label") or field_context.get("name") or "this field"
            return f"This field is for entering your {field_name.lower()}. It helps identify you and process your information correctly."
        
        return "I can help you understand this form. Feel free to ask about specific fields or the form's purpose."
    
    def _check_cache(self, key: str):
        """
        Check if we have a cached response.
        Thread-safe implementation.
        
        Args:
            key: Cache key
            
        Returns:
            str: Cached response or None
        """
        with self.cache_lock:
            if key in self.response_cache:
                entry = self.response_cache[key]
                if time.time() - entry["timestamp"] < self.cache_expiry:
                    return entry["response"]
                else:
                    # Clean up expired cache entry
                    del self.response_cache[key]
            
        return None
    
    def _cache_response(self, key: str, response: str):
        """
        Add a response to the cache.
        Thread-safe implementation.
        
        Args:
            key: Cache key
            response: Response to cache
        """
        with self.cache_lock:
            self.response_cache[key] = {
                "response": response,
                "timestamp": time.time()
            }
    
    async def _call_ai_api(self, question: str, field_context: Optional[Dict[str, Any]], form_context: Optional[Dict[str, Any]] = None):
        """
        Call external AI API for a response.
        
        Args:
            question: User's question
            field_context: Optional context about the form field
            form_context: Optional context about the overall form
            
        Returns:
            str: API response or None if unavailable
        """
        if not self.api_key:
            logger.warning("No API key available for API call")
            return None
            
        # Prepare prompt with context
        prompt = self._prepare_prompt(question, field_context, form_context)
        
        if self.api_provider == "openai":
            return await self._call_openai(prompt, field_context, form_context)
        elif self.api_provider == "anthropic":
            return await self._call_anthropic(prompt)
        else:
            logger.error(f"Unknown API provider: {self.api_provider}")
            return None
    
    def _prepare_prompt(self, question: str, field_context: Optional[Dict[str, Any]], form_context: Optional[Dict[str, Any]] = None):
        """
        Prepare an effective prompt for the AI API.
        
        Args:
            question: User's question
            field_context: Optional context about the form field
            form_context: Optional context about the overall form
            
        Returns:
            str: Formatted prompt
        """
        # Get form type from context if available
        form_type = form_context.get("form_type", "unknown form") if form_context else "unknown form"
        form_purpose = form_context.get("purpose", "") if form_context else ""
        
        prompt = f"The user is completing a {form_type}."
        
        if form_purpose:
            prompt += f" The purpose of this form is {form_purpose}."
        
        if field_context:
            prompt += f"\n\nThe user is asking about a specific field in this form with the following properties:"
            prompt += f"\nField name: {field_context.get('name', 'Unknown')}"
            prompt += f"\nField label: {field_context.get('label', 'Unknown')}"
            prompt += f"\nField type: {field_context.get('type', 'Unknown')}"
            prompt += f"\nRequired: {'Yes' if field_context.get('required', False) else 'No'}"
            
            if field_context.get("helpText"):
                prompt += f"\nForm's original help text: {field_context.get('helpText')}"
                
            if field_context.get("validation"):
                prompt += f"\nValidation rules: {field_context.get('validation')}"
        
        prompt += f"\n\nUser's question: \"{question}\""
        prompt += "\n\nProvide a helpful, informative response that directly answers the question in the context of this specific form and field. Include practical advice and explain both what information is needed and why it's important."
        
        return prompt
    
    async def _call_openai(self, prompt: str, field_context: Optional[Dict[str, Any]] = None, form_context: Optional[Dict[str, Any]] = None):
        """
        Call OpenAI API with improved prompting.
        
        Args:
            prompt: User's question with context
            field_context: Optional field context
            form_context: Optional form context
            
        Returns:
            str: API response or None if failed
        """
        # Create a specialized system message
        system_message = """You are an expert AI assistant specialized in helping users understand and complete forms.
You have deep knowledge about different form types, field requirements, and best practices.
When answering questions:
1. Be specific and detailed about the purpose of fields in the current form context
2. Explain both what information is needed and why it's being collected
3. Provide practical guidance that helps the user complete the form correctly
4. Consider the overall purpose of the form when explaining individual fields
5. If relevant, mention any common mistakes or pitfalls to avoid

Your goal is to be genuinely helpful by providing clear, contextual information about form fields."""

        # Create a custom SSL context if SSL verification is disabled
        ssl_context = None
        if self.disable_ssl_verification:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        connector = aiohttp.TCPConnector(ssl=ssl_context) if self.disable_ssl_verification else None

        async with aiohttp.ClientSession(connector=connector) as session:
            try:
                logger.info("Sending request to OpenAI API...")
                
                # Get configurable values from environment
                max_tokens = int(os.getenv("MAX_TOKENS", "500"))
                temperature = float(os.getenv("AI_TEMPERATURE", "0.7"))
                
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
                    timeout=15  # Increased timeout for GPT-4
                ) as response:
                    response_text = await response.text()
                    logger.info(f"API response status: {response.status}")
                    
                    if response.status != 200:
                        logger.error(f"OpenAI API error: {response_text}")
                        return None
                        
                    data = await response.json()
                    return data["choices"][0]["message"]["content"]
            except aiohttp.ClientError as e:
                logger.error(f"Network error calling OpenAI API: {e}")
                return None
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON response from OpenAI: {e}")
                return None
            except KeyError as e:
                logger.error(f"Unexpected response structure from OpenAI: {e}")
                return None
            except Exception as e:
                logger.error(f"OpenAI API request failed with unexpected error: {e}")
                return None
    
    async def _call_anthropic(self, prompt: str):
        """
        Call Anthropic API.
        
        Args:
            prompt: Formatted prompt
            
        Returns:
            str: API response or None if failed
        """
        # Create a custom SSL context if SSL verification is disabled
        ssl_context = None
        if self.disable_ssl_verification:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        connector = aiohttp.TCPConnector(ssl=ssl_context) if self.disable_ssl_verification else None

        async with aiohttp.ClientSession(connector=connector) as session:
            try:
                logger.info("Sending request to Anthropic API...")
                
                async with session.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.anthropic_model,
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": int(os.getenv("MAX_TOKENS", "500")),
                        "temperature": float(os.getenv("AI_TEMPERATURE", "0.7"))
                    },
                    timeout=15  # Increased timeout
                ) as response:
                    response_text = await response.text()
                    logger.info(f"API response status: {response.status}")
                    
                    if response.status != 200:
                        logger.error(f"Anthropic API error: {response_text}")
                        return None
                        
                    data = await response.json()
                    return data["content"][0]["text"]
            except Exception as e:
                logger.error(f"Anthropic API request failed: {e}")
                return None
    
    async def test_api_connection(self):
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
        
        if self.api_provider == "openai":
            test_result = await self._call_openai(test_prompt)
        else:
            test_result = await self._call_anthropic(test_prompt)
        
        if test_result:
            logger.info(f"API TEST SUCCESSFUL! Response: {test_result}")
            return {
                "success": True,
                "response": test_result
            }
        else:
            logger.error("API TEST FAILED! No response received")
            return {
                "success": False,
                "error": "API call failed or returned empty response"
            }

    async def debug_openai_connection(self):
        """
        Debug OpenAI API connection with full logging.
        
        Returns:
            dict: Detailed debug info
        """
        if not self.api_key:
            logger.error("No API key found!")
            return {"success": False, "error": "No API key"}
        
        # Create a custom SSL context if SSL verification is disabled
        ssl_context = None
        if self.disable_ssl_verification:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        connector = aiohttp.TCPConnector(ssl=ssl_context) if self.disable_ssl_verification else None
        
        try:
            async with aiohttp.ClientSession(connector=connector) as session:
                payload = {
                    "model": "gpt-3.5-turbo",
                    "messages": [
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": "Say hello!"}
                    ],
                    "max_tokens": 50
                }
                
                logger.info(f"Sending test request to OpenAI API")
                
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=10
                ) as response:
                    status = response.status
                    text = await response.text()
                    
                    logger.info(f"API response status: {status}")
                    logger.info(f"API response body: {text}")
                    
                    return {
                        "success": status == 200,
                        "status": status,
                        "response": text
                    }
        except Exception as e:
            logger.error(f"API debug exception: {str(e)}")
            return {"success": False, "error": str(e)}