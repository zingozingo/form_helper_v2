#!/usr/bin/env python
# backend/test_integration.py
"""
Integration test script for the AI Form Helper project.
This script tests the key components of the system to verify they're working correctly.
"""

import os
import sys
import logging
import json
from pathlib import Path

# Add the parent directory to the path so we can import our modules
sys.path.append(str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("integration_test")

def test_imports():
    """Test that all required modules can be imported."""
    logger.info("Testing imports...")
    
    try:
        # Import form processor components
        from backend.core.form_processor.factory import FormProcessorFactory
        from backend.core.form_processor.html_processor import HTMLFormProcessor
        from backend.core.form_processor.pdf_processor import PDFFormProcessor
        from backend.core.form_processor.base_processor import BaseFormProcessor
        
        # Import AI components
        from backend.core.ai.hybrid_copilot import HybridCopilot
        
        logger.info("✅ All imports successful!")
        return True
    except ImportError as e:
        logger.error(f"❌ Import error: {str(e)}")
        logger.error("Make sure all components are in the correct directories")
        return False

def test_pdf_processor():
    """Test that the PDF processor can be initialized."""
    logger.info("Testing PDF processor initialization...")
    
    try:
        from backend.core.form_processor.pdf_processor import PDFFormProcessor
        
        processor = PDFFormProcessor()
        logger.info("✅ PDF processor initialized successfully!")
        
        # Try to import dependencies
        logger.info("Testing PDF processor dependencies...")
        try:
            processor._import_dependencies()
            logger.info("✅ PDF processor dependencies loaded successfully!")
            return True
        except ImportError as e:
            logger.error(f"❌ PDF processor dependency error: {str(e)}")
            logger.error("Make sure you've installed: pytesseract, pdf2image, opencv-python, and numpy")
            logger.error("Also verify that Tesseract OCR is installed on your system")
            return False
    except Exception as e:
        logger.error(f"❌ PDF processor initialization error: {str(e)}")
        return False

def test_hybrid_copilot():
    """Test that the hybrid copilot can be initialized and loaded."""
    logger.info("Testing HybridCopilot...")
    
    try:
        from backend.core.ai.hybrid_copilot import HybridCopilot
        
        copilot = HybridCopilot()
        kb_size = len(copilot.knowledge_base.get("fields", {}))
        
        if kb_size > 0:
            logger.info(f"✅ HybridCopilot initialized with {kb_size} field entries in knowledge base!")
        else:
            logger.warning("⚠️ HybridCopilot initialized but knowledge base is empty")
            logger.warning("Make sure field_knowledge.json is in the correct location")
        
        # Check if API integration is available
        api_key = copilot.api_key
        if api_key:
            logger.info(f"✅ API integration available with provider: {copilot.api_provider}")
        else:
            logger.warning("⚠️ No API key found. External AI will not be available")
            logger.warning("Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable for full functionality")
        
        # Test a simple field query
        field_context = {
            "name": "email",
            "label": "Email Address",
            "type": "email",
            "required": True
        }
        question = "What is this field for?"
        
        logger.info("Testing local knowledge base query...")
        response = copilot._get_hardcoded_response(question, field_context)
        
        if response:
            logger.info(f"✅ Successfully retrieved hardcoded response!")
            logger.info(f"Response: {response[:50]}...")
            return True
        else:
            logger.warning("⚠️ No hardcoded response found for test query")
            return False
            
    except Exception as e:
        logger.error(f"❌ HybridCopilot error: {str(e)}")
        return False

def test_processor_factory():
    """Test that the form processor factory works correctly."""
    logger.info("Testing FormProcessorFactory...")
    
    try:
        from backend.core.form_processor.factory import FormProcessorFactory
        
        factory = FormProcessorFactory()
        
        # Test HTML processor
        html_processor = factory.get_processor("text/html")
        if html_processor:
            logger.info("✅ Successfully retrieved HTML processor!")
        else:
            logger.error("❌ Failed to retrieve HTML processor")
            return False
        
        # Test PDF processor
        pdf_processor = factory.get_processor("application/pdf")
        if pdf_processor:
            logger.info("✅ Successfully retrieved PDF processor!")
        else:
            logger.error("❌ Failed to retrieve PDF processor")
            return False
        
        # Get supported types
        types = factory.get_supported_types()
        logger.info(f"Supported content types: {', '.join(types)}")
        
        return True
    except Exception as e:
        logger.error(f"❌ FormProcessorFactory error: {str(e)}")
        return False

def check_tesseract():
    """Check if Tesseract OCR is installed and available."""
    logger.info("Checking Tesseract OCR installation...")
    
    # Check for TESSERACT_PATH environment variable
    tesseract_path = os.getenv("TESSERACT_PATH")
    if tesseract_path:
        logger.info(f"TESSERACT_PATH environment variable is set to: {tesseract_path}")
        
        # Check if the file exists
        if os.path.exists(tesseract_path):
            logger.info(f"✅ Tesseract executable found at: {tesseract_path}")
        else:
            logger.error(f"❌ Tesseract executable not found at: {tesseract_path}")
            return False
    else:
        # Try to detect tesseract in PATH
        import subprocess
        try:
            # Run a simple command to check if tesseract is in PATH
            subprocess.run(["tesseract", "--version"], 
                          capture_output=True, 
                          check=True,
                          timeout=5)
            logger.info("✅ Tesseract found in PATH")
            return True
        except (subprocess.SubprocessError, FileNotFoundError):
            logger.warning("⚠️ Tesseract not found in PATH")
            logger.warning("If you plan to process PDFs, please install Tesseract OCR")
            logger.warning("- Windows: https://github.com/UB-Mannheim/tesseract/wiki")
            logger.warning("- macOS: brew install tesseract")
            logger.warning("- Ubuntu: sudo apt-get install tesseract-ocr")
            return False
    
    return True

def main():
    """Run all integration tests."""
    logger.info("Starting integration tests...")
    print("=" * 60)
    print("AI FORM HELPER - INTEGRATION TEST")
    print("=" * 60)
    
    # Track overall success
    success = True
    
    # Run tests
    if not test_imports():
        success = False
    
    print("-" * 60)
    
    if not test_processor_factory():
        success = False
    
    print("-" * 60)
    
    if not test_pdf_processor():
        success = False
        
    print("-" * 60)
    
    if not test_hybrid_copilot():
        success = False
    
    print("-" * 60)
    
    if not check_tesseract():
        # This is a warning, not a failure
        print("Tesseract OCR check: ⚠️ Warning")
    
    print("=" * 60)
    
    # Final result
    if success:
        print("🎉 All integration tests passed! Your system is ready. 🎉")
        print("You can now run your server with: python backend/test_server.py")
    else:
        print("❌ Some tests failed. Please fix the issues before proceeding.")
    
    print("=" * 60)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())