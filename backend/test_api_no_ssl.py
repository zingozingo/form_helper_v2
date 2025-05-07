import asyncio
import os
import ssl
import aiohttp

async def test_openai_connection():
    print("Testing OpenAI connection with SSL verification disabled...")
    
    # Get the API key from environment
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("No OpenAI API key found in environment variables!")
        return False
    
    masked_key = f"{api_key[:5]}...{api_key[-4:]}" if len(api_key) > 10 else "***"
    print(f"API key loaded: {masked_key}")
    
    # Create a custom SSL context that ignores certificate verification
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    try:
        # Create a client session with SSL verification disabled
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=ssl_context)) as session:
            payload = {
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Say hello!"}
                ],
                "max_tokens": 50
            }
            
            print("Sending test request to OpenAI API...")
            
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=10
            ) as response:
                status = response.status
                text = await response.text()
                
                print(f"Response status: {status}")
                print(f"Response body: {text[:500]}..." if len(text) > 500 else f"Response body: {text}")
                
                return {
                    "success": status == 200,
                    "status": status,
                    "response": text
                }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    print(f"Current working directory: {os.getcwd()}")
    asyncio.run(test_openai_connection())