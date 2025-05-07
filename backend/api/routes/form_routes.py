# backend/api/routes/form_routes.py
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from ...core.form_processor.factory import FormProcessorFactory
import logging
import traceback
from typing import Optional

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Simple debug endpoint that doesn't depend on any imports
@router.get("/debug")
async def debug_endpoint():
    """Simple endpoint to test API connectivity"""
    return {"status": "ok", "message": "API is working"}

@router.post("/process-form")
async def process_form(form_data: dict):
    """
    Process a form submitted from the extension.
    This endpoint handles JSON form data submitted directly.
    """
    try:
        # Print detailed debug info
        print("=" * 50)
        print("FORM DATA RECEIVED:")
        print(f"Keys: {form_data.keys()}")
        
        if 'type' in form_data:
            print(f"Type: {form_data['type']}")
        else:
            print("No 'type' key found!")
            
        if 'content' in form_data:
            content_length = len(form_data['content'])
            print(f"Content length: {content_length} characters")
            # Print first 100 chars of content for debugging
            print(f"Content preview: {form_data['content'][:100]}...")
        else:
            print("No 'content' key found!")
        print("=" * 50)
            
        # Validate form data
        if 'content' not in form_data:
            print("Error: Missing content field")
            return JSONResponse(
                status_code=400,
                content={"error": "Missing form content", "message": "Form content is required"}
            )
            
        # Ensure we have a valid type
        form_type = form_data.get("type", "html")
        print(f"Using form type: {form_type}")
            
        # Get appropriate processor
        try:
            factory = FormProcessorFactory()
            processor = factory.get_processor(form_type)
            print(f"Got processor: {processor.__class__.__name__}")
        except Exception as e:
            print(f"Error getting processor: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            return JSONResponse(
                status_code=500,
                content={"error": str(e), "message": "Failed to create form processor"}
            )
            
        # Process the form
        try:
            print(f"Starting to extract fields from content of length {len(form_data['content'])}")
            result = processor.extract_fields(form_data["content"])
            print(f"Processing result: {result}")
                
            # Validate result structure
            if not isinstance(result, dict):
                print(f"Warning: Result is not a dictionary: {type(result)}")
                result = {"fields": []}
                    
            if "fields" not in result:
                print(f"Warning: No 'fields' key in result: {result.keys()}")
                result["fields"] = []
                    
            # Count fields for logging
            field_count = len(result.get("fields", []))
            print(f"Returning {field_count} fields to client")
                
            return result
                
        except Exception as e:
            print(f"Error during processing: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            return JSONResponse(
                status_code=500,
                content={"error": str(e), "message": "Failed to extract fields from form"}
            )
    
    except Exception as e:
        # Log detailed error information
        print(f"Unhandled error: {str(e)}")
        print(f"Full traceback: {traceback.format_exc()}")
        logger.error(f"Error processing form: {str(e)}")
            
        # Return user-friendly error
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "message": "Failed to process form. Please try again."}
        )

@router.post("/process-form-upload")
async def process_form_upload(
    content_type: str = Form(...),
    file: Optional[UploadFile] = File(None),
    html_content: Optional[str] = Form(None)
):
    """
    Process a form from either HTML content or an uploaded file.
    This endpoint handles multipart form data, including file uploads.
    
    Args:
        content_type: MIME type of the content (text/html, application/pdf, etc.)
        file: Optional file upload for PDF or image forms
        html_content: Optional HTML content for web forms
    """
    try:
        logger.info(f"Processing form upload with content type: {content_type}")
        
        # Get the appropriate processor for this content type
        factory = FormProcessorFactory()
        processor = factory.get_processor(content_type)
        
        if not processor:
            logger.error(f"Unsupported content type: {content_type}")
            raise HTTPException(status_code=400, detail=f"Unsupported content type: {content_type}")
        
        # Process based on input type
        if "text/html" in content_type and html_content:
            logger.info("Processing HTML content")
            result = processor.extract_fields(html_content)
            
        elif file and (content_type.startswith("application/pdf") or content_type.startswith("image/")):
            # Read file content
            logger.info(f"Processing uploaded file: {file.filename}, content-type: {content_type}")
            file_content = await file.read()
            result = processor.extract_fields(file_content)
            
        else:
            logger.error("Missing required input (file or HTML content)")
            raise HTTPException(status_code=400, detail="Missing required input (file or HTML content)")
        
        # Validate result
        if not isinstance(result, dict):
            logger.warning(f"Result is not a dictionary: {type(result)}")
            result = {"fields": []}
                
        if "fields" not in result:
            logger.warning(f"No 'fields' key in result: {result.keys()}")
            result["fields"] = []
            
        logger.info(f"Successfully processed form. Found {len(result.get('fields', []))} fields")
        return result
        
    except Exception as e:
        logger.error(f"Error processing form upload: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/supported-formats")
async def supported_formats():
    """
    Get a list of supported form formats.
    """
    factory = FormProcessorFactory()
    supported_types = factory.get_supported_types()
    
    # Format for display
    formatted_types = []
    for content_type in supported_types:
        name = "HTML Forms" if "html" in content_type else "PDF Forms" if "pdf" in content_type else "Image Forms"
        formatted_types.append({"name": name, "content_type": content_type})
    
    return {
        "supported_formats": formatted_types
    }