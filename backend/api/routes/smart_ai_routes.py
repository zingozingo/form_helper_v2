# backend/api/routes/smart_ai_routes.py
from fastapi import APIRouter, HTTPException, Depends, Body, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, validator
from typing import Dict, List, Any, Optional
import traceback
import logging
import os
import json
import time

# Import the SmartCopilot
from backend.core.ai.smart_copilot import SmartCopilot

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/smart", tags=["SmartAI"])

# Singleton instance
_smart_copilot_instance = None

def get_smart_copilot():
    """
    Factory function to get or create the SmartCopilot instance.
    This ensures we only create one instance throughout the application.
    """
    global _smart_copilot_instance
    if _smart_copilot_instance is None:
        _smart_copilot_instance = SmartCopilot()
    return _smart_copilot_instance

# Request models with improved validation
class FormContextRequest(BaseModel):
    form_data: Dict[str, Any]
    
    @validator('form_data')
    def validate_form_data(cls, v):
        if not v:
            raise ValueError("Form data cannot be empty")
        return v
    
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

class QuestionRequest(BaseModel):
    question: str
    form_id: Optional[str] = None
    field_context: Optional[Dict[str, Any]] = None
    form_context: Optional[Dict[str, Any]] = None
    
    @validator('question')
    def validate_question(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError("Question must be at least 2 characters")
        if len(v) > 500:
            raise ValueError("Question must be less than 500 characters")
        return v.strip()
    
    class Config:
        schema_extra = {
            "example": {
                "question": "What is this field for?",
                "field_context": {
                    "name": "email",
                    "type": "email",
                    "label": "Email Address",
                    "required": True
                }
            }
        }

class FieldAnalysisRequest(BaseModel):
    field_name: str
    field_type: str
    form_context: Optional[Dict[str, Any]] = None
    
    @validator('field_name')
    def validate_field_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("Field name cannot be empty")
        return v.strip()
    
    @validator('field_type')
    def validate_field_type(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("Field type cannot be empty")
        return v.strip()
    
    class Config:
        schema_extra = {
            "example": {
                "field_name": "email",
                "field_type": "email",
                "form_context": {
                    "form_type": "registration",
                    "fields": [
                        {"name": "email", "type": "email", "required": True},
                        {"name": "password", "type": "password", "required": True}
                    ]
                }
            }
        }

# Response models
class AIResponse(BaseModel):
    response: str
    metadata: Dict[str, Any]

class FormAnalysisResponse(BaseModel):
    analysis: Dict[str, Any]

class FieldAnalysisResponse(BaseModel):
    analysis: Dict[str, Any]

# Routes
@router.post("/analyze-form", response_model=FormAnalysisResponse)
async def analyze_form(
    request: FormContextRequest,
    smart_copilot: SmartCopilot = Depends(get_smart_copilot)
):
    """
    Analyze a form to extract enhanced context and insights.
    
    This analyzes the form structure, field relationships, and extracts
    useful information to help understand the form better.
    """
    try:
        logger.info(f"Analyzing form of type: {request.form_data.get('form_type', 'Unknown')}")
        
        # Analyze the form
        analysis = smart_copilot.analyze_form(request.form_data)
        
        # Return the analysis
        return FormAnalysisResponse(analysis=analysis)
    except Exception as e:
        logger.error(f"Error analyzing form: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error analyzing form: {str(e)}")

@router.post("/analyze-field", response_model=FieldAnalysisResponse)
async def analyze_field(
    request: FieldAnalysisRequest,
    smart_copilot: SmartCopilot = Depends(get_smart_copilot)
):
    """
    Analyze a specific form field to get enhanced context.
    
    This provides detailed information about the field purpose, format,
    privacy implications, and relationships with other fields.
    """
    try:
        logger.info(f"Analyzing field: {request.field_name} ({request.field_type})")
        
        # Get field context
        field_analysis = smart_copilot.get_field_context(
            request.field_name,
            request.field_type,
            request.form_context
        )
        
        # Return the analysis
        return FieldAnalysisResponse(analysis=field_analysis)
    except Exception as e:
        logger.error(f"Error analyzing field: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error analyzing field: {str(e)}")

@router.post("/ask", response_model=AIResponse)
async def ask_question(
    request: QuestionRequest,
    smart_copilot: SmartCopilot = Depends(get_smart_copilot)
):
    """
    Ask a question about a form or field with enhanced AI understanding.
    
    The smart AI assistant analyzes the context, question intent, and provides
    a more intelligent and helpful response.
    """
    start_time = time.time()
    try:
        logger.info(f"Processing question: {request.question}")
        
        # Sanitize field context
        field_context = request.field_context
        if field_context:
            # Ensure minimal required keys are present
            if "name" not in field_context:
                field_context["name"] = ""
            if "type" not in field_context:
                field_context["type"] = "text"
        
        # Get response with enhanced context
        result = await smart_copilot.get_response(
            request.question,
            field_context,
            request.form_context
        )
        
        # Calculate total processing time including our overhead
        total_time = time.time() - start_time
        
        # Add total processing time to metadata
        if "processing_time" in result:
            result["api_processing_time"] = result["processing_time"]
        result["total_processing_time"] = total_time
        
        # Extract response and metadata
        response = result.pop("response", "")
        metadata = result  # All other fields become metadata
        
        logger.info(f"Response generated from {metadata.get('source', 'unknown')} in {total_time:.2f}s")
        return AIResponse(response=response, metadata=metadata)
    except Exception as e:
        logger.error(f"Error in ask_question: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Create error response
        error_message = "I apologize, but I encountered an error processing your question. Please try rephrasing or asking about a different aspect of the form."
        return JSONResponse(
            status_code=500,
            content={"response": error_message, "metadata": {"error": str(e), "source": "error"}}
        )

@router.get("/stats")
async def get_stats(
    smart_copilot: SmartCopilot = Depends(get_smart_copilot)
):
    """
    Get usage statistics for the SmartCopilot.
    
    Returns information about API calls, cache hits, and other metrics.
    """
    try:
        stats = smart_copilot.get_stats()
        return {"stats": stats}
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test")
async def test_connection(
    smart_copilot: SmartCopilot = Depends(get_smart_copilot)
):
    """
    Test the SmartCopilot's API connection.
    
    Useful for verifying configuration and API key validity.
    """
    try:
        result = await smart_copilot.test_api_connection()
        return result
    except Exception as e:
        logger.error(f"Error testing connection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))