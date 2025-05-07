#!/usr/bin/env python3
"""
Test script for the SmartCopilot to see the enhanced AI capabilities.
This allows you to test various form-related questions with different contexts.
"""

import os
import asyncio
import logging
import json
import sys
from datetime import datetime
from typing import Dict, Any, List

from core.ai.smart_copilot import SmartCopilot

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("test_smart_copilot")

# Test data: Sample form contexts
REGISTRATION_FORM = {
    "form_type": "registration",
    "fields": [
        {"name": "username", "type": "text", "label": "Username", "required": True},
        {"name": "email", "type": "email", "label": "Email Address", "required": True},
        {"name": "password", "type": "password", "label": "Password", "required": True},
        {"name": "confirm_password", "type": "password", "label": "Confirm Password", "required": True},
        {"name": "first_name", "type": "text", "label": "First Name", "required": True},
        {"name": "last_name", "type": "text", "label": "Last Name", "required": True},
        {"name": "dob", "type": "date", "label": "Date of Birth", "required": True},
        {"name": "agree_terms", "type": "checkbox", "label": "I agree to the Terms of Service", "required": True}
    ]
}

PAYMENT_FORM = {
    "form_type": "payment",
    "fields": [
        {"name": "card_number", "type": "text", "label": "Card Number", "required": True},
        {"name": "card_name", "type": "text", "label": "Name on Card", "required": True},
        {"name": "expiration", "type": "text", "label": "Expiration Date (MM/YY)", "required": True},
        {"name": "cvv", "type": "text", "label": "CVV Code", "required": True},
        {"name": "billing_address", "type": "text", "label": "Billing Address", "required": True},
        {"name": "billing_city", "type": "text", "label": "City", "required": True},
        {"name": "billing_state", "type": "text", "label": "State/Province", "required": True},
        {"name": "billing_zip", "type": "text", "label": "ZIP/Postal Code", "required": True},
        {"name": "billing_country", "type": "select", "label": "Country", "required": True},
        {"name": "save_card", "type": "checkbox", "label": "Save card for future purchases", "required": False}
    ]
}

# Test cases - format: (question, field_name, field_type, form_context, description)
TEST_CASES = [
    # Basic field questions with no context
    ("What is this field for?", "email", "email", None, "Basic email field explanation"),
    ("Is this secure?", "password", "password", None, "Basic password security question"),
    
    # Registration form questions
    ("Why do I need to confirm my password?", "confirm_password", "password", REGISTRATION_FORM, "Purpose of confirmation field"),
    ("What's the difference between username and email?", "username", "text", REGISTRATION_FORM, "Field relationship question"),
    ("What happens if I forget my password?", None, None, REGISTRATION_FORM, "Form process question"),
    ("How secure is this registration form?", None, None, REGISTRATION_FORM, "Form security question"),
    
    # Payment form questions
    ("Where do I find my CVV code?", "cvv", "text", PAYMENT_FORM, "Format guidance"),
    ("Is it safe to enter my credit card here?", "card_number", "text", PAYMENT_FORM, "Security concern"),
    ("Why do you need my billing address?", "billing_address", "text", PAYMENT_FORM, "Purpose explanation"),
    ("What's the relationship between my card number and CVV?", "card_number", "text", PAYMENT_FORM, "Field relationship")
]

async def test_smart_copilot():
    """Run tests for SmartCopilot's enhanced AI capabilities."""
    logger.info("=== TESTING SMART COPILOT'S ENHANCED AI CAPABILITIES ===")
    
    # Create SmartCopilot instance
    copilot = SmartCopilot()
    
    # Test API connection first
    connection_result = await copilot.test_api_connection()
    if not connection_result.get("success", False):
        logger.error(f"API connection test failed: {connection_result.get('error', 'Unknown error')}")
        logger.error("Ensure your API key is correctly set in the environment variables")
        return
    
    logger.info(f"API connection test successful: {connection_result.get('response')}")
    
    # Create results directory
    results_dir = os.path.join(os.path.dirname(__file__), "test_results")
    os.makedirs(results_dir, exist_ok=True)
    
    # Create results file with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = os.path.join(results_dir, f"copilot_test_{timestamp}.json")
    
    # Run test cases
    results = []
    for i, (question, field_name, field_type, form_context, description) in enumerate(TEST_CASES):
        logger.info(f"\n\nTest {i+1}: {description}")
        logger.info(f"Question: {question}")
        
        # Create field context if we have field info
        field_context = None
        if field_name and field_type:
            field_context = {"name": field_name, "type": field_type}
            logger.info(f"Field: {field_name} ({field_type})")
        
        if form_context:
            logger.info(f"Form type: {form_context.get('form_type', 'Unknown')}")
        
        # Get response
        try:
            result = await copilot.get_response(question, field_context, form_context)
            
            # Log results
            logger.info(f"Response from {result.get('source', 'unknown')}:")
            logger.info(result.get("response", "No response"))
            logger.info(f"Processing time: {result.get('processing_time', 0):.2f} seconds")
            
            # Add to results
            results.append({
                "test_number": i + 1,
                "description": description,
                "question": question,
                "field_context": field_context,
                "form_type": form_context.get("form_type") if form_context else None,
                "response": result.get("response"),
                "source": result.get("source"),
                "model": result.get("model", "N/A"),
                "processing_time": result.get("processing_time"),
                "enhanced_context_used": result.get("enhanced_context_used", False)
            })
            
        except Exception as e:
            logger.error(f"Error testing question: {str(e)}")
            results.append({
                "test_number": i + 1,
                "description": description,
                "question": question,
                "error": str(e)
            })
    
    # Save results
    with open(results_file, "w") as f:
        json.dump(results, f, indent=2)
    
    logger.info(f"\n\nAll tests completed. Results saved to {results_file}")
    
    # Print stats
    stats = copilot.get_stats()
    logger.info("\nSmartCopilot Statistics:")
    for key, value in stats.items():
        logger.info(f"  {key}: {value}")

if __name__ == "__main__":
    asyncio.run(test_smart_copilot())