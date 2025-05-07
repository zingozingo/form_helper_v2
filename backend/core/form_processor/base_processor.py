# backend/core/form_processor/base_processor.py
from abc import ABC, abstractmethod

class BaseFormProcessor(ABC):
    """Base class for all form processors"""
    
    @abstractmethod
    def extract_fields(self, content):
        """Extract fields from the given content
        
        Args:
            content: The content to extract fields from (HTML, PDF bytes, etc.)
            
        Returns:
            dict: A dictionary with form fields and metadata
        """
        pass