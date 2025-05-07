# backend/api/routes/ai_routes.py
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import traceback
import logging
import os
import json

# Ensure these imports work correctly
from backend.core.ai.copilot import AICopilot
from backend.core.ai.hybrid_copilot import HybridCopilot

# Import SmartCopilot for enhanced capability
try:
    from backend.core.ai.smart_copilot import SmartCopilot
    SMART_COPILOT_AVAILABLE = True
except ImportError:
    import logging
    logging.warning("SmartCopilot unavailable, using HybridCopilot only")
    SMART_COPILOT_AVAILABLE = False

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# IMPORTANT: Don't use tags in the router definition as it might interfere with routing
router = APIRouter()

# Create global instances of AI assistants to maintain context
ai_copilot = AICopilot()  # Legacy copilot

# Hybrid copilot singleton instance
_hybrid_copilot_instance = None

def get_hybrid_copilot():
    """
    Factory function to get or create the HybridCopilot instance.
    This ensures we only create one instance throughout the application.
    """
    global _hybrid_copilot_instance
    if _hybrid_copilot_instance is None:
        _hybrid_copilot_instance = HybridCopilot()
    return _hybrid_copilot_instance

# SmartCopilot singleton instance
_smart_copilot_instance = None

def get_smart_copilot():
    """
    Factory function to get or create the SmartCopilot instance.
    This ensures we only create one instance throughout the application.
    """
    global _smart_copilot_instance
    if SMART_COPILOT_AVAILABLE:
        if _smart_copilot_instance is None:
            _smart_copilot_instance = SmartCopilot()
        return _smart_copilot_instance
    else:
        # Fall back to HybridCopilot if SmartCopilot isn't available
        return get_hybrid_copilot()

# Request models
class FormContextRequest(BaseModel):
    form_data: Dict[str, Any]
    
    class Config:
        schema_extra = {
            "example": {
                "form_data": {
                    "form_type": "registration",
                    "fields": [
                        {"name": "email", "type": "email", "required": True},
                        {"name": "password", "type": "password", "required": True}
                    ]
                }
            }
        }
    
    def validate_form_data(cls, v):
        if not v:
            raise ValueError("Form data cannot be empty")
            
        # Ensure it has at least minimal required structure
        if not isinstance(v, dict):
            raise ValueError("Form data must be a dictionary")
            
        # At minimum, form_type or fields should be present
        if "form_type" not in v and "fields" not in v:
            raise ValueError("Form data must include at least form_type or fields")
            
        return v

class QuestionRequest(BaseModel):
    question: str
    form_id: Optional[str] = None
    field_context: Optional[Dict[str, Any]] = None
    form_context: Optional[Dict[str, Any]] = None  # Added form_context for improved AI responses
    
    class Config:
        # Adding schema extra for OpenAPI docs
        schema_extra = {
            "example": {
                "question": "What is this field for?",
                "form_id": "registration_form",
                "field_context": {
                    "name": "email",
                    "type": "email",
                    "label": "Email Address",
                    "required": True
                }
            }
        }
    
    # Add validation for the question
    def validate_question(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError("Question must be at least 2 characters")
        if len(v) > 500:
            raise ValueError("Question must be less than 500 characters")
        return v.strip()

class ChatRequest(BaseModel):
    message: str
    form_id: Optional[str] = None

class FieldExplanationRequest(BaseModel):
    field_name: str
    
    class Config:
        schema_extra = {
            "example": {
                "field_name": "email"
            }
        }
    
    def validate_field_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("Field name cannot be empty")
        if len(v) > 100:
            raise ValueError("Field name must be less than 100 characters")
        return v.strip()

class ValidationRequest(BaseModel):
    field_name: str
    expected_format: str
    current_value: str
    
    class Config:
        schema_extra = {
            "example": {
                "field_name": "email",
                "expected_format": "email",
                "current_value": "user@example.com"
            }
        }
    
    def validate_field_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("Field name cannot be empty")
        return v.strip()
        
    def validate_current_value(cls, v):
        if v is None:
            return ""  # Allow empty values (they might need validation too)
        if len(v) > 1000:
            raise ValueError("Value is too long")
        return v

# Response models
class AIResponse(BaseModel):
    status: str
    response: str
    source: Optional[str] = None  # "hardcoded", "api", or "fallback"

class ChatResponse(BaseModel):
    response: str
    suggestions: List[str]
    field_context: Optional[str] = None
    timestamp: Optional[str] = None
    source: Optional[str] = None

@router.post("/set-form-context")
async def set_form_context(request: FormContextRequest):
    """Set the form context for the AI"""
    try:
        logger.info(f"Setting form context: {request.form_data.get('form_type', 'Unknown')}")
        ai_copilot.set_form_context(request.form_data)
        return {"status": "success", "message": "Form context set"}
    except Exception as e:
        logger.error(f"Error in set_form_context: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error setting form context: {str(e)}")

@router.post("/explain-field")
async def explain_field(request: FieldExplanationRequest):
    """Explain what a form field is used for"""
    try:
        logger.info(f"Explaining field: {request.field_name}")
        explanation = ai_copilot.explain_form_field(request.field_name)
        logger.info(f"Generated explanation: {explanation}")
        return {"status": "success", "explanation": explanation}
    except Exception as e:
        logger.error(f"Error in explain_field: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# CRITICAL: Make sure the route is defined as "/ai/ask" to match your extension's API call
@router.post("/ai/ask") 
async def ask_question(
    request: QuestionRequest,
    hybrid_copilot: HybridCopilot = Depends(get_hybrid_copilot)
):
    """
    Process a general question using the AI assistant.
    Uses the new HybridCopilot if field_context is provided, 
    otherwise falls back to legacy copilot.
    """
    try:
        logger.info(f"Processing question: {request.question}")
        
        # Use hybrid copilot if field context is available
        if request.field_context:
            logger.info("Using hybrid copilot with field context")
            
            # Sanitize field context to ensure it has required structure
            field_context = request.field_context
            if field_context and isinstance(field_context, dict):
                # Ensure minimal required keys are present
                if "name" not in field_context:
                    field_context["name"] = ""
                if "type" not in field_context:
                    field_context["type"] = "text"
            
            # Enhanced: Pass both field_context and form_context for improved responses
            response = await hybrid_copilot.get_response(
                question=request.question,
                field_context=field_context,
                form_context=request.form_context
            )
            
            # Check if we got an enhanced response (dict with metadata)
            if isinstance(response, dict) and "response" in response:
                # This is likely from SmartCopilot
                response_text = response.get("response", "")
                source = response.get("source", "smart_ai")
                
                logger.info(f"Enhanced AI response from {source}")
                return AIResponse(
                    status="success",
                    response=response_text,
                    source=source
                )
            else:
                # This is a plain string response, determine the source
                source = "fallback"
                field_name = request.field_context.get("name", "").lower()
                field_type = request.field_context.get("type", "").lower()
                
                # Check if the answer came from hardcoded knowledge
                kb = hybrid_copilot.knowledge_base
                if (field_name in kb.get("fields", {}) or 
                    field_type in kb.get("fields", {})):
                    source = "hardcoded"
                elif any(pattern in request.question.lower() for pattern in kb.get("common_questions", {})):
                    source = "hardcoded"
                elif hybrid_copilot.api_key:
                    source = "api"
                    
                logger.info(f"Hybrid copilot generated response from {source}")
                return AIResponse(
                    status="success",
                    response=response,
                    source=source
                )
        else:
            # Use legacy copilot for general questions
            logger.info("Using legacy copilot for general question")
            response = ai_copilot.ask_question(request.question)
            logger.info(f"Legacy copilot generated response: {response[:50]}...")
            return AIResponse(
                status="success",
                response=response,
                source="legacy"
            )
            
    except Exception as e:
        logger.error(f"Error in ask_question: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ALSO ADDING a simple route that directly matches "/ask" for backward compatibility
@router.post("/ask")
async def ask_question_compat(
    request: QuestionRequest,
    hybrid_copilot: HybridCopilot = Depends(get_hybrid_copilot)
):
    """
    Compatibility endpoint that redirects to the main ask_question function
    """
    return await ask_question(request, hybrid_copilot)

# NEW: SmartCopilot endpoint for enhanced responses
@router.post("/smart/ask")
async def smart_ask_question(
    request: QuestionRequest
):
    """
    Process a question using the enhanced SmartCopilot system.
    This provides more detailed and context-aware answers.
    """
    try:
        logger.info(f"Processing question with SmartCopilot: {request.question}")
        
        # Get SmartCopilot instance
        smart_copilot = get_smart_copilot()
        
        # Check if SmartCopilot is available
        if not SMART_COPILOT_AVAILABLE:
            logger.warning("SmartCopilot not available, using HybridCopilot fallback")
        
        # Sanitize field context
        field_context = request.field_context
        if field_context and isinstance(field_context, dict):
            # Ensure minimal required keys are present
            if "name" not in field_context:
                field_context["name"] = ""
            if "type" not in field_context:
                field_context["type"] = "text"
        
        # Get enhanced response
        result = await smart_copilot.get_response(
            question=request.question,
            field_context=field_context,
            form_context=request.form_context
        )
        
        # For SmartCopilot, we return the complete result with metadata
        if isinstance(result, dict) and "response" in result:
            return {
                "status": "success",
                "response": result["response"],
                "metadata": {k: v for k, v in result.items() if k != "response"},
                "source": "smart_copilot"
            }
        else:
            # Fallback for unexpected response format
            return {
                "status": "success",
                "response": result if isinstance(result, str) else str(result),
                "source": "smart_copilot"
            }
            
    except Exception as e:
        logger.error(f"Error in smart_ask_question: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Enhanced chat interface with conversation history and context awareness.
    Returns a richer response including suggestions for follow-up questions.
    """
    try:
        logger.info(f"Processing chat message: {request.message}")
        
        # Use the enhanced chat method from AICopilot
        if hasattr(ai_copilot, 'chat'):
            result = ai_copilot.chat(request.message)
            logger.info(f"Chat generated response: {result['response'][:50]}...")
            return result
        else:
            # Fallback to ask_question if chat method doesn't exist
            logger.info("Using legacy ask_question method")
            response = ai_copilot.ask_question(request.message)
            return ChatResponse(
                response=response,
                suggestions=["What else would you like to know?", "Tell me more about this form"],
                source="legacy_fallback"
            )
            
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}")
        logger.error(traceback.format_exc())
        error_response = "I apologize, but I encountered an error processing your message. Could you try rephrasing your question?"
        return ChatResponse(
            response=error_response,
            suggestions=["What is this form for?", "Help me fill out this form"],
            source="error"
        )

@router.post("/validate")
async def validate_field(request: ValidationRequest):
    """Endpoint for validating field values"""
    try:
        logger.info(f"Validating field: {request.field_name}, value: {request.current_value}")
        validation = ai_copilot.validate_field(
            request.field_name,
            request.expected_format,
            request.current_value
        )
        return validation
    except Exception as e:
        logger.error(f"Error in validate_field: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/field-suggestion")
async def field_suggestion(field_name: str, field_type: Optional[str] = None):
    """Get a suggestion for a field value based on its type"""
    try:
        # Input validation
        if not field_name or len(field_name.strip()) == 0:
            raise HTTPException(status_code=400, detail="Field name cannot be empty")
            
        if len(field_name) > 100:
            raise HTTPException(status_code=400, detail="Field name is too long")
            
        # Default and sanitize field type
        if field_type:
            # Normalize field type
            field_type = field_type.lower().strip()
            # Allow only specific field types
            allowed_types = ["text", "email", "password", "date", "number", "phone", "tel", "select", "textarea"]
            if field_type not in allowed_types:
                field_type = "text"  # Default to text if invalid type
        else:
            field_type = "text"
        
        logger.info(f"Generating suggestion for field: {field_name}, type: {field_type}")
        field_context = {
            "name": field_name.strip(),
            "type": field_type
        }
        suggestion = ai_copilot.suggest_field_value(field_context)
        return {"suggestion": suggestion}
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error getting field suggestion: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# NEW! Add API testing endpoint
@router.get("/test-api")
async def test_api_connection(
    hybrid_copilot: HybridCopilot = Depends(get_hybrid_copilot)
):
    """
    Test the OpenAI API connection.
    
    Returns:
        dict: Connection test results
    """
    logger.info("Testing API connection")
    
    try:
        result = await hybrid_copilot.test_api_connection()
        return result
    except Exception as e:
        logger.error(f"Error testing API connection: {e}")
        return {
            "success": False,
            "error": str(e)
        }

# NEW! Add detailed API debugging endpoint
@router.get("/debug-api")
async def debug_api_connection(
    hybrid_copilot: HybridCopilot = Depends(get_hybrid_copilot)
):
    """
    Debug the OpenAI API connection with detailed logs.
    
    Returns:
        dict: Detailed debug info
    """
    logger.info("Running API debug")
    
    try:
        if hybrid_copilot.api_provider == "openai":
            result = await hybrid_copilot.debug_openai_connection()
            return result
        else:
            return {
                "success": False,
                "error": f"Debug only supported for OpenAI, current provider: {hybrid_copilot.api_provider}"
            }
    except Exception as e:
        logger.error(f"Error in API debug: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@router.get("/health", response_model=None)
async def health_check(
    hybrid_copilot: HybridCopilot = Depends(get_hybrid_copilot)
):
    """
    Check if the AI system is operational.
    
    Returns:
        Status information for both AI systems
    """
    try:
        # Check if knowledge base is loaded for hybrid copilot
        kb_loaded = len(hybrid_copilot.knowledge_base.get("fields", {})) > 0
        
        # Check if API is configured
        api_available = hybrid_copilot.api_key is not None
        api_key_valid = False
        
        if api_available:
            if hybrid_copilot.api_provider == "openai" and hybrid_copilot.api_key.startswith("sk-"):
                api_key_valid = True
            elif hybrid_copilot.api_provider == "anthropic" and len(hybrid_copilot.api_key) > 20:
                # Anthropic keys don't necessarily start with sk-, just check for sufficient length
                api_key_valid = True
        
        # Check if chat functionality is available in the AICopilot
        chat_available = hasattr(ai_copilot, 'chat')
        
        # Check SmartCopilot availability
        smart_copilot_status = {
            "available": SMART_COPILOT_AVAILABLE,
            "api_provider": hybrid_copilot.api_provider if api_available else None,
            "enhanced_capabilities": SMART_COPILOT_AVAILABLE
        }
        
        # If SmartCopilot is available, get its knowledge base and capabilities
        if SMART_COPILOT_AVAILABLE:
            try:
                smart_copilot = get_smart_copilot()
                analyzer_loaded = hasattr(smart_copilot, 'analyzer')
                smart_copilot_status.update({
                    "initialization_complete": True,
                    "analyzer_loaded": analyzer_loaded,
                    "api_available": api_available,
                    "field_knowledge_loaded": hasattr(smart_copilot.analyzer, 'knowledge_base') if analyzer_loaded else False
                })
            except Exception as sc_error:
                logger.error(f"Error checking SmartCopilot health: {str(sc_error)}")
                smart_copilot_status.update({
                    "initialization_error": str(sc_error),
                    "initialization_complete": False
                })
        
        return {
            "status": "operational",
            "legacy_ai": {
                "available": True,
                "chat_support": chat_available
            },
            "hybrid_ai": {
                "knowledge_base_loaded": kb_loaded,
                "api_available": api_available,
                "api_key_valid_format": api_key_valid if api_available else False,
                "api_provider": hybrid_copilot.api_provider if api_available else None
            },
            "smart_ai": smart_copilot_status
        }
    except Exception as e:
        logger.error(f"Error checking AI health: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test")
async def test_endpoint():
    """Simple test endpoint to verify API routing"""
    return {"message": "AI routes are working!"}

# ADDING additional test endpoint for the /ai/ask route
@router.get("/ai/test")
async def test_ai_endpoint():
    """Simple test endpoint to verify AI API routing"""
    return {"message": "AI /ai endpoints are working!"}