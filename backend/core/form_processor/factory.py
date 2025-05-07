# backend/core/form_processor/factory.py
import logging
import os
from typing import Dict, Optional

from .html_processor import HTMLFormProcessor
from .pdf_processor import PDFFormProcessor

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FormProcessorFactory:
    """
    Factory for creating form processors based on form type or content type.
    Follows the Factory pattern to allow easy addition of new form processors.
    """
    
    def __init__(self):
        """Initialize the factory with processor instances."""
        # Load configuration
        tesseract_path = os.getenv("TESSERACT_PATH")
        
        # Create processor instances (lazy loaded - we create one per request)
        self._processor_types = {
            # Form types
            "html": HTMLFormProcessor,
            "pdf": PDFFormProcessor,
            
            # MIME types
            "text/html": HTMLFormProcessor,
            "application/pdf": PDFFormProcessor,
            "image/jpeg": PDFFormProcessor,
            "image/png": PDFFormProcessor,
            "image/tiff": PDFFormProcessor
        }
        
        # Store configuration
        self._config = {
            "tesseract_path": tesseract_path
        }
        
        logger.info(f"FormProcessorFactory initialized with {len(self._processor_types)} processor types")
    
    def get_processor(self, form_type: str):
        """
        Get the appropriate processor for a given form type or content type.
        
        Args:
            form_type: Type of form (html, pdf, etc.) or MIME type (text/html, application/pdf, etc.)
            
        Returns:
            BaseFormProcessor: An instance of the appropriate processor
            
        Raises:
            ValueError: If an unsupported form type is provided
        """
        if form_type is None:
            logger.warning("Form type is None, defaulting to 'html'")
            form_type = "html"
        
        # Normalize the form_type
        form_type = str(form_type).lower().split(';')[0].strip()
        logger.info(f"Getting processor for form type: {form_type}")
        
        # Try to find exact matches
        if form_type in self._processor_types:
            processor_class = self._processor_types[form_type]
            
            # Initialize with config if it's a PDF processor
            if processor_class == PDFFormProcessor:
                logger.info(f"Creating PDF processor with tesseract_path: {self._config.get('tesseract_path')}")
                return processor_class(tesseract_path=self._config.get("tesseract_path"))
            else:
                logger.info(f"Creating processor of type: {processor_class.__name__}")
                return processor_class()
        
        # Try to find partial matches for MIME types
        for processor_type, processor_class in self._processor_types.items():
            if form_type.startswith(processor_type) or processor_type in form_type:
                logger.info(f"Found partial match processor for form type: {form_type} -> {processor_type}")
                
                # Initialize with config if it's a PDF processor
                if processor_class == PDFFormProcessor:
                    return processor_class(tesseract_path=self._config.get("tesseract_path"))
                else:
                    return processor_class()
        
        # Default to HTML for unknown types with a warning
        logger.warning(f"Unsupported form type: {form_type}, defaulting to HTML processor")
        return HTMLFormProcessor()
    
    def register_processor(self, form_type: str, processor_class):
        """
        Register a new processor for a specific form type.
        
        Args:
            form_type: Type of form to register
            processor_class: Processor class to handle this type
        """
        self._processor_types[form_type.lower()] = processor_class
        logger.info(f"Registered new processor for form type: {form_type}")
    
    def get_supported_types(self) -> list:
        """
        Get a list of all supported form types.
        
        Returns:
            List of supported form types
        """
        return list(self._processor_types.keys())