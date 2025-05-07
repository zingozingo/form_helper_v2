import asyncio
import sys
import os
from core.ai.hybrid_copilot import HybridCopilot

async def test_connection():
    print("Creating HybridCopilot instance...")
    c = HybridCopilot()
    
    # Print API key info (safely)
    print(f"API provider: {c.api_provider}")
    if c.api_key:
        masked_key = f"{c.api_key[:5]}...{c.api_key[-4:]}" if len(c.api_key) > 10 else "***"
        print(f"API key loaded: {masked_key}")
    else:
        print("No API key found!")
    
    # Test connection
    print("\nTesting API connection...")
    result = await c.test_api_connection()
    print(f"Test result: {result}")
    
    # Debug connection for OpenAI
    if c.api_provider == "openai":
        print("\nRunning detailed OpenAI debug...")
        debug_info = await c.debug_openai_connection()
        print(f"Debug info: {debug_info}")
    
    return result

if __name__ == "__main__":
    # Print current path and environment variables
    print(f"Current working directory: {os.getcwd()}")
    print(f"OPENAI_API_KEY in env: {'OPENAI_API_KEY' in os.environ}")
    if "OPENAI_API_KEY" in os.environ:
        masked_key = f"{os.environ['OPENAI_API_KEY'][:5]}...{os.environ['OPENAI_API_KEY'][-4:]}"
        print(f"Env API key: {masked_key}")
    
    # Run the async test
    asyncio.run(test_connection())