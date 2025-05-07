import unittest
from backend.core.form_processor.html_processor import HTMLFormProcessor

class TestHTMLProcessor(unittest.TestCase):
    def setUp(self):
        """Set up test fixtures"""
        self.processor = HTMLFormProcessor()
        
        # Sample HTML form for testing
        self.sample_html = """
        <form>
            <label for="name">Full Name:</label>
            <input type="text" id="name" name="fullname">
            
            <label for="email">Email:</label>
            <input type="email" id="email" name="email">
            
            <label for="phone">Phone:</label>
            <input type="tel" id="phone" name="phone">
        </form>
        """
    
    def test_extract_fields(self):
        """Test basic extraction of form fields"""
        result = self.processor.extract_fields(self.sample_html)
        
        # Check if result has the expected structure
        self.assertIn("fields", result)
        self.assertIsInstance(result["fields"], list)
        
        # Check if all fields were extracted
        field_names = [field.get("name") for field in result["fields"]]
        self.assertIn("fullname", field_names)
        self.assertIn("email", field_names)
        self.assertIn("phone", field_names)
        
        # Check if field types were correctly identified
        for field in result["fields"]:
            if field.get("name") == "email":
                self.assertEqual(field.get("type"), "email")
            elif field.get("name") == "phone":
                self.assertEqual(field.get("type"), "tel")

if __name__ == "__main__":
    unittest.main()