# backend/test_server.py
# Standalone test server for form helper extension

import os
import json
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("form_helper_api")

# Import routes from their proper modules
try:
    from api.routes import form_routes, ai_routes
    logger.info("Successfully imported route modules")
    use_route_modules = True
except ImportError as e:
    logger.error(f"Error importing route modules: {e}")
    logger.warning("Will use built-in routes instead")
    use_route_modules = False

# Import the AICopilot as fallback
try:
    from core.ai.copilot import AICopilot
    logger.info("Successfully imported AICopilot")
except ImportError as e:
    logger.error(f"Error importing AICopilot: {e}")
    # Create a fallback AICopilot if import fails
    class FallbackAICopilot:
        def ask_question(self, question, field_context=None):
            return f"I received your question: '{question}'. However, the AI service is not fully initialized."
            
        def explain_form_field(self, field_name):
            return f"The field '{field_name}' is used for entering information."
            
        def set_form_context(self, form_data):
            return {"status": "success", "message": "Using fallback AI service"}
            
        def validate_field(self, field_name, field_type, value):
            return {"is_valid": True, "message": "Using fallback validation"}
    
    AICopilot = FallbackAICopilot
    logger.warning("Using fallback AICopilot class")

# Try to import HybridCopilot
try:
    from core.ai.hybrid_copilot import HybridCopilot
    logger.info("Successfully imported HybridCopilot")
    has_hybrid_copilot = True
except ImportError as e:
    logger.error(f"Error importing HybridCopilot: {e}")
    logger.warning("HybridCopilot not available. Some AI features will be limited.")
    has_hybrid_copilot = False

# Create FastAPI app
app = FastAPI(title="Form Helper API")

# Add CORS middleware to allow requests from extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the AI Copilot instances
try:
    ai_copilot = AICopilot()
    logger.info("AICopilot initialized")
except Exception as e:
    logger.error(f"Error initializing AICopilot: {e}")
    ai_copilot = FallbackAICopilot()
    logger.warning("Using fallback AICopilot instance")

# Initialize HybridCopilot if available
hybrid_copilot = None
if has_hybrid_copilot:
    try:
        hybrid_copilot = HybridCopilot()
        logger.info("HybridCopilot initialized")
    except Exception as e:
        logger.error(f"Error initializing HybridCopilot: {e}")
        logger.warning("HybridCopilot initialization failed")

# If we have the route modules, use them
if use_route_modules:
    # Include the form routes and AI routes
    app.include_router(form_routes.router, prefix="/api/forms", tags=["Forms"])
    app.include_router(ai_routes.router, prefix="/api/ai", tags=["AI"])
    
    # Also include the legacy routes for backward compatibility
    # These are the routes defined below but will only be used if no modules are found
    logger.info("Using imported route modules")
else:
    # Define models for built-in routes
    class FormProcessRequest(BaseModel):
        type: str
        content: str

    class FieldExplainRequest(BaseModel):
        field_name: str

    class FieldQuestionRequest(BaseModel):
        question: str
        field_name: Optional[str] = None
        field_context: Optional[Dict[str, Any]] = None
        form_context: Optional[Dict[str, Any]] = None
        chat_history: Optional[List[Dict[str, str]]] = None
        
    class ValidationRequest(BaseModel):
        field_name: str
        field_type: str
        value: str

    # Simple debug endpoint
    @app.get("/api/v1/debug")
    async def debug():
        logger.info("Debug endpoint called")
        return {"status": "ok", "message": "API server is running"}
    
    @app.get("/api/ai/ask")
    async def ai_ask_get():
        """
        GET endpoint for /api/ai/ask
        This is just for compatibility with the panel.js connection test
        """
        logger.info("GET request to /api/ai/ask")
        return {"status": "ok", "message": "AI API is working"}

    # Process form endpoint
    @app.post("/api/v1/process-form")
    async def process_form(request: FormProcessRequest):
        logger.info(f"Process form called with type: {request.type}")
        try:
            # Simple field detection logic
            # In a real implementation, this would actually parse the HTML
            if request.type == "html":
                # Extract basic field info from HTML for demo
                # In a real implementation, we would use BeautifulSoup
                fields = []
                
                # Very simple field detection for testing
                content = request.content.lower()
                field_types = ["text", "email", "password", "tel", "number", "checkbox", "radio"]
                
                for field_type in field_types:
                    if f'type="{field_type}"' in content:
                        fields.append({
                            "name": f"sample_{field_type}_field",
                            "type": field_type,
                            "label": f"Sample {field_type.capitalize()} Field"
                        })
                
                logger.info(f"Detected {len(fields)} fields")
                return {
                    "form_type": "sample_form",
                    "fields": fields
                }
            else:
                logger.warning(f"Unsupported form type: {request.type}")
                raise HTTPException(status_code=400, detail="Unsupported form type")
        except Exception as e:
            logger.error(f"Error in process_form: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # Explain field endpoint - routes for both v1 and ai paths for compatibility
    @app.post("/api/v1/explain-field")
    @app.post("/api/v1/ai/explain-field")
    async def explain_field(request: FieldExplainRequest):
        logger.info(f"Explain field called for field: {request.field_name}")
        try:
            # Get explanation from AI Copilot
            explanation = ai_copilot.explain_form_field(request.field_name)
            logger.info(f"Generated explanation: {explanation[:50]}...")
            return {"explanation": explanation}
        except Exception as e:
            logger.error(f"Error in explain_field: {e}")
            # Provide fallback explanation
            fallback = f"This field is for entering your {request.field_name.lower().replace('_', ' ')}."
            logger.info(f"Using fallback explanation: {fallback}")
            return {"explanation": fallback}

    # Answer question endpoint - routes for both v1 and ai paths for compatibility
    @app.post("/api/v1/ask")
    @app.post("/api/v1/ai/ask")
    async def ask_question(request: FieldQuestionRequest):
        logger.info(f"Ask question called: {request.question}")
        try:
            # First, try to use HybridCopilot if available and field_context is provided
            if hybrid_copilot and request.field_context:
                logger.info("Using HybridCopilot for field-specific question")
                try:
                    response = await hybrid_copilot.get_response(
                        question=request.question,
                        field_context=request.field_context
                    )
                    logger.info(f"HybridCopilot response: {response[:50]}...")
                    return {"response": response, "source": "hybrid"}
                except Exception as e:
                    logger.error(f"Error using HybridCopilot: {e}")
                    logger.info("Falling back to legacy copilot")
            
            # Log request details for debugging
            logger.info(f"Has field context: {request.field_context is not None}")
            if request.field_context:
                logger.info(f"Field context: {json.dumps(request.field_context)[:100]}...")
            
            # Check if question is about a specific field
            if request.field_context:
                logger.info("Asking field-specific question with legacy copilot")
                response = ai_copilot.ask_question(
                    question=request.question,
                    field_context=request.field_context
                )
            else:
                # General question
                logger.info("Asking general question with legacy copilot")
                response = ai_copilot.ask_question(request.question)
                
            logger.info(f"Generated response: {response[:50]}...")
            return {"response": response, "source": "legacy"}
        except Exception as e:
            logger.error(f"Error in ask_question: {e}")
            # Generate fallback response based on question content
            question_lower = request.question.lower()
            
            if "password" in question_lower:
                fallback = "A good password should be at least 12 characters long with a mix of uppercase letters, lowercase letters, numbers, and special characters. Avoid using easily guessable information like your name or birthdate."
            elif "email" in question_lower:
                fallback = "The email field is where you enter your email address. This is typically used for account creation, login, and communications from the service."
            elif "name" in question_lower:
                fallback = "The name field is for entering your legal name as it appears on official documents. This helps verify your identity and ensures communications are addressed correctly."
            elif "date" in question_lower or "birth" in question_lower:
                fallback = "For date fields, enter the date in the format shown (typically MM/DD/YYYY in the US). This information is often used for verification and age-appropriate services."
            else:
                fallback = "I'll help you understand this form. Feel free to ask about any specific field you're unsure about."
            
            logger.info(f"Using fallback response: {fallback}")
            return {"response": fallback, "source": "fallback"}

    # Validate field endpoint
    @app.post("/api/v1/validate-field")
    async def validate_field(request: ValidationRequest):
        logger.info(f"Validate field called for field: {request.field_name}, type: {request.field_type}")
        try:
            result = ai_copilot.validate_field(
                request.field_name,
                request.field_type,
                request.value
            )
            logger.info(f"Validation result: {result}")
            return result
        except Exception as e:
            logger.error(f"Error in validate_field: {e}")
            # Basic fallback validation
            is_valid = True
            message = "Looks valid."
            
            # Simple validation rules
            if request.field_type == "email" and "@" not in request.value:
                is_valid = False
                message = "Email address must contain @ symbol."
            elif request.field_type == "password" and len(request.value) < 8:
                is_valid = False
                message = "Password should be at least 8 characters."
                
            logger.info(f"Using fallback validation: {is_valid}, {message}")
            return {"is_valid": is_valid, "message": message}

    # Set form context endpoint
    @app.post("/api/v1/set-context")
    async def set_context(request: Request):
        try:
            form_data = await request.json()
            logger.info(f"Set context called with form data (truncated): {str(form_data)[:100]}...")
            
            result = ai_copilot.set_form_context(form_data)
            logger.info(f"Set context result: {result}")
            return result
        except Exception as e:
            logger.error(f"Error in set_context: {e}")
            return {"status": "error", "message": str(e)}

    # Additional endpoint to handle legacy requests
    @app.post("/api/v1/ai/set-form-context")
    async def set_form_context_legacy(request: Request):
        try:
            data = await request.json()
            logger.info("Legacy set_form_context called")
            
            # Extract form_data from the legacy format
            if "form_data" in data:
                form_data = data["form_data"]
            else:
                form_data = data
                
            result = ai_copilot.set_form_context(form_data)
            return result
        except Exception as e:
            logger.error(f"Error in set_form_context_legacy: {e}")
            return {"status": "error", "message": str(e)}

# Add health check endpoints that will work regardless of which routes are used
@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Check if the API is up and running."""
    response = {
        "status": "healthy",
        "details": {
            "legacy_routes": not use_route_modules,
            "module_routes": use_route_modules,
            "legacy_copilot": True,
            "hybrid_copilot": hybrid_copilot is not None
        }
    }
    return response

@app.get("/api/forms/debug")
async def forms_debug():
    """Debug endpoint for forms API."""
    return {"status": "ok", "message": "API is working"}

@app.get("/api/ai/debug")
async def ai_debug():
    """Debug endpoint for AI API."""
    return {"status": "ok", "message": "API is working"}

# NEW: Add the endpoints expected by panel.js
@app.get("/api/test")
async def api_test():
    """Combined debug endpoint for extension."""
    logger.info("Test endpoint called")
    return {"status": "ok", "message": "API is working"}

@app.post("/api/process-form")
async def process_form_compat(request: FormProcessRequest):
    """Compatibility endpoint for process-form."""
    logger.info("Compatibility process-form endpoint called")
    # Reuse the existing implementation
    return await process_form(request)

@app.post("/api/process-form-upload")
async def process_form_upload(request: Request):
    """Handle uploaded form files."""
    logger.info("Process form upload endpoint called")
    try:
        # Get the file content from the request
        form_data = await request.form()
        file = form_data.get("file")
        
        if not file:
            raise HTTPException(status_code=400, detail="No file uploaded")
        
        content_type = form_data.get("content_type") or file.content_type
        
        # For now, return a basic response (you'll implement full processing later)
        return {
            "form_type": "pdf_form",
            "fields": [
                {"name": "sample_name", "type": "text", "label": "Name"},
                {"name": "sample_email", "type": "email", "label": "Email"}
            ]
        }
    except Exception as e:
        logger.error(f"Error in process_form_upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ask")
async def ask_compat(request: FieldQuestionRequest):
    """Compatibility endpoint for ask."""
    logger.info("Compatibility ask endpoint called")
    # Reuse the existing implementation
    return await ask_question(request)

# Run the server when executed directly
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Form Helper API server")
    # Run on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)