import unittest
from backend.core.form_processor.factory import FormProcessorFactory
from backend.core.form_processor.html_processor import HTMLFormProcessor
from backend.core.form_processor.pdf_processor import PDFFormProcessor

class TestFormProcessorFactory(unittest.TestCase):
    def setUp(self):
        """Set up test fixtures"""
        self.factory = FormProcessorFactory()
    
    def test_get_html_processor(self):
        """Test that the factory returns an HTML processor for HTML content"""
        processor = self.factory.get_processor("text/html")
        self.assertIsInstance(processor, HTMLFormProcessor)
        
        # Test with alternative content type string
        processor = self.factory.get_processor("html")
        self.assertIsInstance(processor, HTMLFormProcessor)
    
    def test_get_pdf_processor(self):
        """Test that the factory returns a PDF processor for PDF content"""
        processor = self.factory.get_processor("application/pdf")
        self.assertIsInstance(processor, PDFFormProcessor)
        
        # Test with alternative content type string
        processor = self.factory.get_processor("pdf")
        self.assertIsInstance(processor, PDFFormProcessor)
    
    def test_unsupported_content_type(self):
        """Test that the factory raises an error for unsupported content types"""
        with self.assertRaises(ValueError):
            self.factory.get_processor("image/jpeg")

if __name__ == "__main__":
    unittest.main()