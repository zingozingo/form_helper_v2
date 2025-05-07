#!/usr/bin/env python3

"""
Test the enhanced integration between HybridCopilot and SmartCopilot.
This script simulates a form request and tests if the system can provide
enhanced responses using the SmartCopilot.
"""

import asyncio
import logging
import json
from typing import Dict, Any

# Import both copilot systems
from core.ai.hybrid_copilot import HybridCopilot
from core.ai.smart_copilot import SmartCopilot

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("test_smart_integration")

# Sample form data for testing
REGISTRATION_FORM = {
    "form_type": "registration",
    "fields": [
        {"name": "firstName", "type": "text", "label": "First Name", "required": True},
        {"name": "lastName", "type": "text", "label": "Last Name", "required": True},
        {"name": "email", "type": "email", "label": "Email Address", "required": True},
        {"name": "password", "type": "password", "label": "Password", "required": True},
        {"name": "confirmPassword", "type": "password", "label": "Confirm Password", "required": True},
        {"name": "phone", "type": "text", "label": "Phone Number", "required": False},
        {"name": "dateOfBirth", "type": "text", "label": "Date of Birth", "required": False},
        {"name": "country", "type": "select", "label": "Country", "required": True},
        {"name": "gender", "type": "radio", "label": "Gender", "required": False},
        {"name": "interests", "type": "checkbox", "label": "Interests", "required": False},
        {"name": "bio", "type": "textarea", "label": "About Yourself", "required": False},
        {"name": "terms", "type": "checkbox", "label": "Terms and Conditions", "required": True},
        {"name": "newsletter", "type": "checkbox", "label": "Subscribe to newsletter", "required": False}
    ]
}

# Test cases
TEST_QUESTIONS = [
    {
        "question": "What is this form for?",
        "field_context": None,
        "description": "General form purpose question"
    },
    {
        "question": "Why do you need my email?",
        "field_context": {"name": "email", "type": "email", "label": "Email Address", "required": True},
        "description": "Email field question"
    },
    {
        "question": "Is it secure to enter my password here?",
        "field_context": {"name": "password", "type": "password", "label": "Password", "required": True},
        "description": "Security question about password"
    },
    {
        "question": "Why do I need to confirm my password?",
        "field_context": {"name": "confirmPassword", "type": "password", "label": "Confirm Password", "required": True},
        "description": "Question about confirm password field"
    },
    {
        "question": "Is my data protected when I submit this form?",
        "field_context": None,
        "description": "Privacy question about form submission"
    }
]

async def test_copilot_integration():
    """Test the integration between HybridCopilot and SmartCopilot."""
    logger.info("=== TESTING ENHANCED COPILOT INTEGRATION ===")
    
    # Create both copilot instances
    hybrid_copilot = HybridCopilot()
    
    # Only create SmartCopilot if needed
    smart_copilot = None
    try:
        smart_copilot = SmartCopilot()
        logger.info("Both copilot systems initialized")
    except ImportError:
        logger.warning("SmartCopilot not available - only testing HybridCopilot")
    
    # Test API connection
    connection_result = await hybrid_copilot.test_api_connection()
    if not connection_result:
        logger.error("API connection test failed - cannot proceed with testing")
        return
    
    logger.info(f"API connection successful: {connection_result}")
    
    # Test direct access to the SmartCopilot for comparison
    if smart_copilot:
        logger.info("\n=== TESTING SMARTCOPILOT DIRECTLY ===")
        example_question = "Why do I need to confirm my password?"
        example_field = {"name": "confirmPassword", "type": "password", "label": "Confirm Password", "required": True}
        
        logger.info(f"Question: {example_question}")
        logger.info(f"Field: {example_field.get('name')} ({example_field.get('type')})")
        
        direct_result = await smart_copilot.get_response(
            question=example_question,
            field_context=example_field,
            form_context=REGISTRATION_FORM
        )
        
        logger.info("SmartCopilot direct response:")
        if isinstance(direct_result, dict):
            source = direct_result.get("source", "smart")
            logger.info(f"Source: {source}")
            logger.info(f"Response: {direct_result.get('response', 'No response')}")
            logger.info(f"Metadata: {json.dumps({k: v for k, v in direct_result.items() if k != 'response'}, indent=2)}")
        else:
            logger.info(f"Response: {direct_result}")
    
    # Run test cases
    results = []
    for i, test_case in enumerate(TEST_QUESTIONS):
        question = test_case["question"]
        field_context = test_case["field_context"]
        description = test_case["description"]
        
        logger.info(f"\n\nTest {i+1}: {description}")
        logger.info(f"Question: {question}")
        
        if field_context:
            logger.info(f"Field: {field_context.get('name')} ({field_context.get('type')})")
        
        # Get response from HybridCopilot (should utilize SmartCopilot if available)
        logger.info("Getting response from HybridCopilot...")
        hybrid_result = await hybrid_copilot.get_response(
            question=question,
            field_context=field_context,
            form_context=REGISTRATION_FORM
        )
        
        logger.info("Response details:")
        if isinstance(hybrid_result, dict):
            # This likely came from SmartCopilot
            source = hybrid_result.get("source", "unknown")
            logger.info(f"Source: {source}")
            logger.info(hybrid_result.get("response", "No response"))
            
            # Check if we got an enhanced response from SmartCopilot
            enhanced_contexts = hybrid_result.get("context_enhancement", [])
            enhanced_metadata = hybrid_result.get("metadata", {})
            smart_model = hybrid_result.get("model", "")
            
            # More accurate check for SmartCopilot (either explicit or through capabilities)
            used_smart = (
                "smart" in source or 
                "enhanced" in source or
                hybrid_result.get("enhanced_context_used", False) or
                len(enhanced_contexts) > 0 or
                smart_model.startswith("gpt-4") or
                isinstance(enhanced_metadata, dict) and len(enhanced_metadata) > 0
            )
            
            logger.info(f"Used SmartCopilot capabilities: {used_smart}")
            
            results.append({
                "test_number": i + 1,
                "description": description,
                "question": question,
                "field_context": field_context,
                "response_type": "enhanced" if used_smart else "standard",
                "source": source,
                "response": hybrid_result.get("response", "No response")
            })
        else:
            # This is a plain string response from HybridCopilot
            logger.info(f"Source: regular HybridCopilot")
            logger.info(hybrid_result)
            
            results.append({
                "test_number": i + 1,
                "description": description,
                "question": question,
                "field_context": field_context,
                "response_type": "standard",
                "source": "hybrid_copilot",
                "response": hybrid_result
            })
    
    # Save results
    with open("smart_integration_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    logger.info("\n\nAll tests completed. Results saved to smart_integration_results.json")
    
    # Print summary
    enhanced_count = sum(1 for r in results if r["response_type"] == "enhanced")
    logger.info(f"Summary: {enhanced_count}/{len(results)} responses used enhanced capabilities")

if __name__ == "__main__":
    asyncio.run(test_copilot_integration())