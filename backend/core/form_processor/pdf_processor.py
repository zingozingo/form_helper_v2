# backend/core/form_processor/pdf_processor.py
from .base_processor import BaseFormProcessor
import logging
import re
import io

logger = logging.getLogger(__name__)

class PDFFormProcessor(BaseFormProcessor):
    """
    Processor for PDF forms.
    Extracts form fields from PDF documents using OCR.
    """
    
    def __init__(self, tesseract_path="/opt/homebrew/bin/tesseract", poppler_path="/opt/homebrew/bin"):
        """
        Initialize the PDF processor.
        
        Args:
            tesseract_path: Path to Tesseract executable (needed for Windows)
            poppler_path: Path to Poppler utilities (needed for PDF conversion)
        """
        # We'll lazily import these libraries when needed
        # to avoid dependencies if not using PDF processing
        self.pytesseract = None
        self.pdf2image = None
        self.cv2 = None
        self.np = None
        self.tesseract_path = tesseract_path
        self.poppler_path = poppler_path
        
        # Compile common form field patterns
        self.field_patterns = {
            "name": r"(?i)(full\s*name|first\s*name|last\s*name|middle\s*name|name)[\s\:]*([^\n]*)",
            "email": r"(?i)(e[\-\.]?mail\s*address|e[\-\.]?mail)[\s\:]*([^\n]*)",
            "phone": r"(?i)(phone|telephone|mobile|cell|contact)[\s\:]*([^\n]*)",
            "address": r"(?i)(street\s*address|mailing\s*address|address|city|state|zip|postal\s*code)[\s\:]*([^\n]*)",
            "date": r"(?i)(date|birth\s*date|dob|expiration|start\s*date|end\s*date)[\s\:]*([^\n]*)",
            "ssn": r"(?i)(ssn|social\s*security|tax\s*id|itin)[\s\:]*([^\n]*)",
            "id": r"(?i)(id\s*number|identification|passport|driver\'?s\s*license)[\s\:]*([^\n]*)",
            "gender": r"(?i)(gender|sex)[\s\:]*([^\n]*)",
            "nationality": r"(?i)(nationality|citizenship|country)[\s\:]*([^\n]*)",
            "occupation": r"(?i)(occupation|job\s*title|profession)[\s\:]*([^\n]*)",
            "income": r"(?i)(income|salary|earnings|wages)[\s\:]*([^\n]*)",
            "education": r"(?i)(education|degree|qualification)[\s\:]*([^\n]*)",
            "signature": r"(?i)(signature|sign\s*here)[\s\:]*([^\n]*)",
        }
        
        # Form type detection patterns
        self.form_type_patterns = {
            "tax": r"(?i)(irs|tax\s*return|tax\s*form|w[\-\s]?9|w[\-\s]?2|1040|1099)",
            "medical": r"(?i)(health\s*insurance|patient|medical\s*history|diagnosis|prescription)",
            "employment": r"(?i)(employment|job\s*application|work\s*history|resume|cv)",
            "banking": r"(?i)(bank\s*account|direct\s*deposit|routing\s*number|account\s*number)",
            "immigration": r"(?i)(uscis|visa|passport|i[\-\s]?94|i[\-\s]?551|green\s*card)",
            "consent": r"(?i)(consent\s*form|release\s*form|authorization|permission)",
            "application": r"(?i)(application|apply|form|request)"
        }
    
    def extract_fields(self, pdf_bytes: bytes) -> dict:
        """
        Extract fields from PDF content.
        
        Args:
            pdf_bytes: Raw PDF file content as bytes
            
        Returns:
            dict: Dictionary with form information and extracted fields
        """
        try:
            # Lazily import dependencies
            if self.pytesseract is None:
                self._import_dependencies()
            
            logger.info("Processing PDF document")
            
            # Convert PDF to images - now with poppler_path
            images = self.pdf2image.convert_from_bytes(pdf_bytes, poppler_path=self.poppler_path)
            logger.info(f"Converted PDF to {len(images)} images")
            
            all_text = []
            all_field_boxes = []
            
            for i, image in enumerate(images):
                # Convert PIL Image to numpy array
                img_array = self.np.array(image)
                
                # Preprocess image
                processed_img = self._enhance_image(img_array)
                
                # Extract text using OCR
                text = self.pytesseract.image_to_string(processed_img)
                logger.info(f"Extracted {len(text)} characters from page {i+1}")
                all_text.append(text)
                
                # Try to detect form fields visually (checkboxes, text fields, etc.)
                field_boxes = self._detect_field_boxes(processed_img)
                if field_boxes:
                    all_field_boxes.extend([(i, box) for box in field_boxes])
            
            # Identify fields using text analysis
            text_fields = self._identify_fields(all_text)
            
            # Merge fields from text analysis and visual detection
            merged_fields = self._merge_fields(text_fields, all_field_boxes)
            
            # Determine form type
            form_type = self._detect_form_type("\n".join(all_text))
            
            result = {
                "form_type": form_type,
                "fields": merged_fields,
                "page_count": len(images),
                "text_content": all_text,  # Include full text for debugging
                "confidence": 0.7  # OCR confidence is lower than HTML parsing
            }
            
            return result
            
        except ImportError as e:
            logger.error(f"Missing PDF processing dependencies: {str(e)}")
            raise Exception("PDF processing requires additional dependencies: pytesseract, pdf2image, opencv-python")
        except Exception as e:
            logger.error(f"Error processing PDF: {str(e)}")
            raise Exception(f"PDF processing error: {str(e)}")
    
    def _import_dependencies(self):
        """Import required dependencies for PDF processing."""
        try:
            import pytesseract
            import pdf2image
            import cv2
            import numpy as np
            
            self.pytesseract = pytesseract
            self.pdf2image = pdf2image
            self.cv2 = cv2
            self.np = np
            
            # Set tesseract path if provided
            if self.tesseract_path:
                self.pytesseract.pytesseract.tesseract_cmd = self.tesseract_path
            
            logger.info("Successfully imported PDF processing dependencies")
        except ImportError as e:
            logger.error(f"Failed to import PDF dependencies: {str(e)}")
            raise
    
    def _enhance_image(self, image):
        """
        Enhance image for better OCR results.
        
        Args:
            image: NumPy array containing image data
            
        Returns:
            Enhanced image
        """
        # Convert to grayscale
        gray = self.cv2.cvtColor(image, self.cv2.COLOR_RGB2GRAY)
        
        # Apply adaptive thresholding
        binary = self.cv2.adaptiveThreshold(
            gray, 
            255, 
            self.cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            self.cv2.THRESH_BINARY, 
            11, 2
        )
        
        # Apply noise reduction
        kernel = self.np.ones((1, 1), self.np.uint8)
        opening = self.cv2.morphologyEx(binary, self.cv2.MORPH_OPEN, kernel)
        
        return opening
    
    def _detect_field_boxes(self, image):
        """
        Detect form field boxes in the image using computer vision.
        Looks for rectangles that might represent form fields.
        
        Args:
            image: Preprocessed image
            
        Returns:
            list: List of coordinates for potential form fields
        """
        try:
            # Invert image to find darker rectangles
            inverted = self.cv2.bitwise_not(image)
            
            # Find contours
            contours, _ = self.cv2.findContours(
                inverted, 
                self.cv2.RETR_EXTERNAL, 
                self.cv2.CHAIN_APPROX_SIMPLE
            )
            
            field_boxes = []
            for contour in contours:
                # Filter contours by size and shape
                perimeter = self.cv2.arcLength(contour, True)
                approx = self.cv2.approxPolyDP(contour, 0.02 * perimeter, True)
                
                # Check if it's a quadrilateral (4 sides)
                if len(approx) == 4:
                    x, y, w, h = self.cv2.boundingRect(contour)
                    
                    # Only consider rectangles of appropriate size
                    min_width, min_height = 50, 15  # Minimum field size
                    max_width, max_height = 500, 80  # Maximum field size
                    
                    if (min_width < w < max_width and 
                        min_height < h < max_height and
                        w > h):  # Fields are usually wider than tall
                        
                        field_boxes.append((x, y, w, h))
            
            logger.info(f"Detected {len(field_boxes)} potential field boxes")
            return field_boxes
            
        except Exception as e:
            logger.error(f"Error detecting field boxes: {str(e)}")
            return []
    
    def _identify_fields(self, text_blocks):
        """
        Identify form fields from extracted text.
        
        Args:
            text_blocks: List of text blocks from each page
            
        Returns:
            list: List of identified fields
        """
        fields = []
        
        # Search for each pattern in the text
        for page_idx, block in enumerate(text_blocks):
            for field_type, pattern in self.field_patterns.items():
                matches = re.finditer(pattern, block)
                for match in matches:
                    # Get the label and value
                    label = match.group(1).strip()
                    value = match.group(2).strip() if len(match.groups()) > 1 else ""
                    
                    # Calculate match position for potential field location
                    pos = match.start()
                    
                    fields.append({
                        "name": field_type,
                        "label": label,
                        "type": self._guess_field_type(field_type),
                        "value": value,
                        "page": page_idx + 1,
                        "position": pos,
                        "required": "*" in label or "required" in label.lower(),
                        "confidence": 0.7  # OCR field detection confidence
                    })
        
        logger.info(f"Identified {len(fields)} potential fields from text analysis")
        return fields
    
    def _merge_fields(self, text_fields, field_boxes):
        """
        Merge fields detected from text analysis and visual box detection.
        
        Args:
            text_fields: Fields detected from text patterns
            field_boxes: Visual boxes that might represent form fields
            
        Returns:
            list: Merged and deduplicated fields
        """
        merged_fields = list(text_fields)  # Start with text fields
        
        # Add visually detected fields that don't match existing ones
        box_fields_added = 0
        for page_idx, box in field_boxes:
            x, y, w, h = box
            
            # Check if a text field is already nearby this box
            matches_existing = False
            for field in text_fields:
                if field.get("page") == page_idx + 1:
                    # Assume a match if positions are similar (simplified)
                    # In a real implementation, this would need to compare actual pixel positions
                    matches_existing = True
                    break
            
            if not matches_existing:
                box_fields_added += 1
                merged_fields.append({
                    "name": f"field_{page_idx}_{x}_{y}",
                    "label": f"Unlabeled Field ({page_idx + 1})",
                    "type": "text",
                    "page": page_idx + 1,
                    "position": (x, y),
                    "dimensions": (w, h),
                    "required": False,
                    "confidence": 0.5  # Lower confidence for visually detected fields
                })
        
        logger.info(f"Added {box_fields_added} fields from visual detection")
        return merged_fields
    
    def _guess_field_type(self, field_name):
        """
        Guess the field type based on field name.
        
        Args:
            field_name: Identified field name
            
        Returns:
            str: HTML input type that most closely matches this field
        """
        field_type_map = {
            "email": "email",
            "phone": "tel",
            "date": "date",
            "password": "password",
            "address": "text",
            "ssn": "text",
            "name": "text",
            "id": "text",
            "gender": "select",
            "nationality": "text",
            "occupation": "text",
            "income": "number",
            "education": "text",
            "signature": "text"
        }
        
        return field_type_map.get(field_name.lower(), "text")
    
    def _detect_form_type(self, text):
        """
        Detect the type of form based on text content.
        
        Args:
            text: The extracted text from the PDF
            
        Returns:
            String indicating form type or "generic_form"
        """
        text_lower = text.lower()
        
        for form_type, pattern in self.form_type_patterns.items():
            if re.search(pattern, text_lower):
                logger.info(f"Detected form type: {form_type}")
                return form_type
        
        return "generic_form"