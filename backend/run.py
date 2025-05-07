# backend/run.py
import uvicorn
import sys
import os
from dotenv import load_dotenv

# Get the absolute path of the current file (run.py)
current_dir = os.path.dirname(os.path.abspath(__file__))
# Get the parent directory (project root)
parent_dir = os.path.dirname(current_dir)

# Try to load from multiple possible locations
env_paths = [
    os.path.join(parent_dir, '.env'),  # Root directory
    os.path.join(current_dir, '.env'),  # Backend directory
    '.env'  # Current working directory
]

env_loaded = False
for env_path in env_paths:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"Loaded environment from: {env_path}")
        env_loaded = True
        break

if not env_loaded:
    print("Warning: Could not find .env file")

# Print for debugging
api_key = os.getenv("OPENAI_API_KEY")
if api_key:
    print("OpenAI API key loaded successfully")
else:
    print("OpenAI API key not found in environment")

# Add the parent directory to the Python path
sys.path.insert(0, parent_dir)

if __name__ == "__main__":
    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=True)