# backend/core/form_processor/html_processor.py
from .base_processor import BaseFormProcessor
from bs4 import BeautifulSoup
import logging
import traceback

logger = logging.getLogger(__name__)

class HTMLFormProcessor(BaseFormProcessor):
    """Processor for HTML forms."""
    
    def extract_fields(self, html_content: str) -> dict:
        """Extract form fields from HTML content."""
        try:
            logger.info("Starting HTML parsing")
            logger.debug(f"HTML content length: {len(html_content)} characters")
            logger.debug(f"HTML preview: {html_content[:100]}...")
            
            # Parse HTML
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Find all forms
            forms = soup.find_all('form')
            logger.info(f"Found {len(forms)} form elements in HTML")
            
            if forms:
                # Process first form found
                form = forms[0]
                logger.info(f"Processing form with ID: {form.get('id', 'no-id')}")
                result = self._extract_form_fields(form)
            else:
                # No forms found, try to extract from entire document
                logger.info("No form tags found, processing entire document")
                result = self._extract_form_fields(soup)
            
            logger.info(f"Processing complete. Found {len(result['fields'])} fields")
            return result
            
        except Exception as e:
            logger.error(f"ERROR parsing HTML: {str(e)}")
            logger.error(traceback.format_exc())
            # Return empty result rather than raising exception
            return {"form_type": "html", "fields": [], "error": str(e)}
    
    def _extract_form_fields(self, form_element) -> dict:
        """Extract fields from a form element."""
        fields = []
        
        # Find all input elements
        input_elements = form_element.find_all(['input', 'select', 'textarea'])
        logger.info(f"Found {len(input_elements)} input elements")
        
        for input_tag in input_elements:
            try:
                field_info = self._process_input_element(input_tag)
                if field_info:
                    fields.append(field_info)
                    logger.debug(f"Processed field: {field_info['name']} ({field_info['type']})")
            except Exception as e:
                logger.error(f"Error processing input element: {str(e)}")
                logger.debug(traceback.format_exc())
        
        return {
            "form_type": "html",
            "fields": fields,
            "confidence": 1.0
        }
    
    def _process_input_element(self, input_tag) -> dict:
        """Process a single input element."""
        # Determine field type
        if input_tag.name == 'input':
            field_type = input_tag.get('type', 'text')
        else:
            field_type = input_tag.name
        
        # Skip non-data fields
        if field_type in ['submit', 'button', 'image', 'reset', 'hidden']:
            return None
        
        # Get identifiers
        field_name = input_tag.get('name', '')
        field_id = input_tag.get('id', '')
        
        # Skip if no identifier
        if not field_name and not field_id:
            return None
            
        # Find label
        label_text = self._find_label_text(input_tag)
        
        return {
            "name": field_name or field_id,
            "id": field_id,
            "type": field_type,
            "label": label_text,
            "required": input_tag.has_attr('required'),
            "placeholder": input_tag.get('placeholder', ''),
            "value": input_tag.get('value', '')
        }
    
    def _find_label_text(self, input_tag) -> str:
        """Find the label text for an input element."""
        # Try aria-label first
        aria_label = input_tag.get('aria-label', '')
        if aria_label:
            return aria_label
        
        # Try associated label element
        input_id = input_tag.get('id', '')
        if input_id:
            parent_soup = input_tag.find_parent()
            if parent_soup:
                label = parent_soup.find('label', attrs={'for': input_id})
                if label and label.text:
                    return label.text.strip()
        
        # Fallbacks
        return input_tag.get('placeholder', '') or input_tag.get('name', '')