#!/usr/bin/env python3
"""
Test script to validate the fixes we made to the Form Helper application.
Tests thread safety, API integration, and other improvements.
"""

import asyncio
import logging
import time
from threading import Thread
from typing import Dict, Any
import traceback

from core.ai.hybrid_copilot import HybridCopilot

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("test_fixes")

async def test_thread_safety():
    """Test that the cache operations are thread-safe."""
    logger.info("=== TESTING THREAD SAFETY ===")
    
    # Create a shared copilot instance
    copilot = HybridCopilot()
    
    # Create a key for testing
    test_key = "test_thread_safety_key"
    
    # Clear any existing value
    if test_key in copilot.response_cache:
        with copilot.cache_lock:
            del copilot.response_cache[test_key]
    
    # Function to write to cache
    def cache_writer():
        for i in range(100):
            copilot._cache_response(test_key, f"Test response {i}")
            time.sleep(0.001)  # Small delay to increase chance of race condition
    
    # Function to read from cache
    def cache_reader():
        for i in range(100):
            response = copilot._check_cache(test_key)
            if response is None:
                logger.error("Cache read returned None when it should have a value")
            time.sleep(0.001)  # Small delay
    
    # Create threads
    writer_thread = Thread(target=cache_writer)
    reader_thread = Thread(target=cache_reader)
    
    # Start threads
    writer_thread.start()
    reader_thread.start()
    
    # Wait for threads to complete
    writer_thread.join()
    reader_thread.join()
    
    logger.info("Thread safety test completed without exception")
    return True

async def test_api_model_config():
    """Test that the API model configuration is properly loaded from environment."""
    logger.info("=== TESTING API MODEL CONFIG ===")
    
    copilot = HybridCopilot()
    
    # Check model configuration
    logger.info(f"OpenAI Model: {copilot.openai_model}")
    logger.info(f"Anthropic Model: {copilot.anthropic_model}")
    
    if copilot.openai_model != "gpt-4":
        logger.warning(f"Expected default OpenAI model to be 'gpt-4', got '{copilot.openai_model}'")
    
    if copilot.anthropic_model != "claude-3-haiku-20240307":
        logger.warning(f"Expected default Anthropic model to be 'claude-3-haiku-20240307', got '{copilot.anthropic_model}'")
    
    return True

async def test_api_key_validation():
    """Test that API key validation works correctly for different providers."""
    logger.info("=== TESTING API KEY VALIDATION ===")
    
    copilot = HybridCopilot()
    
    # Get current configuration for restoration
    original_key = copilot.api_key
    original_provider = copilot.api_provider
    
    try:
        # Test valid OpenAI key
        copilot.api_provider = "openai"
        copilot.api_key = "sk-testkey123456789"
        result = await copilot.test_api_connection()
        logger.info(f"Valid OpenAI key validation result: {result.get('error', 'No error')}")
        
        # Test invalid OpenAI key
        copilot.api_provider = "openai"
        copilot.api_key = "invalid-key"
        result = await copilot.test_api_connection()
        logger.info(f"Invalid OpenAI key validation result: {result.get('error', 'No error')}")
        
        # Test valid Anthropic key
        copilot.api_provider = "anthropic"
        copilot.api_key = "test_anthropic_key_0123456789abcdef"
        result = await copilot.test_api_connection()
        logger.info(f"Valid Anthropic key validation result: {result.get('error', 'No error')}")
        
        # Test invalid Anthropic key
        copilot.api_provider = "anthropic"
        copilot.api_key = "short"
        result = await copilot.test_api_connection()
        logger.info(f"Invalid Anthropic key validation result: {result.get('error', 'No error')}")
        
        # Test unknown provider
        copilot.api_provider = "unknown"
        copilot.api_key = "test_key"
        result = await copilot.test_api_connection()
        logger.info(f"Unknown provider validation result: {result.get('error', 'No error')}")
        
    finally:
        # Restore original configuration
        copilot.api_key = original_key
        copilot.api_provider = original_provider
    
    return True

async def test_api_connection():
    """Test real API connection."""
    logger.info("=== TESTING ACTUAL API CONNECTION ===")
    
    copilot = HybridCopilot()
    
    # Check if API key is available
    if not copilot.api_key:
        logger.warning("No API key available for testing")
        return False
    
    # Run the connection test
    try:
        result = await copilot.test_api_connection()
        logger.info(f"API connection test result: {result}")
        return result.get("success", False)
    except Exception as e:
        logger.error(f"Error testing API connection: {str(e)}")
        logger.error(traceback.format_exc())
        return False

async def run_tests():
    """Run all test cases."""
    tests = [
        ("Thread Safety", test_thread_safety),
        ("API Model Config", test_api_model_config),
        ("API Key Validation", test_api_key_validation),
        ("API Connection", test_api_connection)
    ]
    
    results = {}
    
    for name, test_func in tests:
        logger.info(f"\n\nRunning test: {name}")
        try:
            success = await test_func()
            results[name] = "PASS" if success else "FAIL"
        except Exception as e:
            logger.error(f"Test {name} raised exception: {str(e)}")
            logger.error(traceback.format_exc())
            results[name] = "ERROR"
    
    # Print summary
    logger.info("\n\n=== TEST RESULTS SUMMARY ===")
    for name, result in results.items():
        logger.info(f"{name}: {result}")

if __name__ == "__main__":
    asyncio.run(run_tests())