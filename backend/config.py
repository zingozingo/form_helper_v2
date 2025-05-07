# backend/config.py
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Configuration settings for the Form Helper application"""
    
    # API Settings
    API_HOST = os.getenv("API_HOST", "localhost")
    API_PORT = int(os.getenv("API_PORT", 8000))
    DEBUG = os.getenv("DEBUG", "False").lower() == "true"
    
    # AI Model Settings
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    DEFAULT_AI_MODEL = os.getenv("DEFAULT_AI_MODEL", "gpt-4")
    AI_TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.7"))
    MAX_TOKENS = int(os.getenv("MAX_TOKENS", "1000"))
    
    # OCR Settings
    TESSERACT_PATH = os.getenv("TESSERACT_PATH", "")
    OCR_LANGUAGE = os.getenv("OCR_LANGUAGE", "eng")
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE = os.getenv("LOG_FILE", "form_helper.log")
    
    # Security
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "chrome-extension://").split(",")
    
    # Performance
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
    MAX_WORKERS = int(os.getenv("MAX_WORKERS", "4"))
    
    @classmethod
    def get_tesseract_config(cls):
        """Get configuration string for Tesseract OCR"""
        return f"--oem 1 --psm 3 -l {cls.OCR_LANGUAGE}"

# Create a .env.example file to document environment variables
env_example = """# API Settings
API_HOST=localhost
API_PORT=8000
DEBUG=False

# AI Model Settings
OPENAI_API_KEY=your_openai_api_key_here
DEFAULT_AI_MODEL=gpt-4
AI_TEMPERATURE=0.7
MAX_TOKENS=1000

# OCR Settings
TESSERACT_PATH=/usr/bin/tesseract
OCR_LANGUAGE=eng

# Logging
LOG_LEVEL=INFO
LOG_FILE=form_helper.log

# Security
CORS_ORIGINS=chrome-extension://,http://localhost:3000

# Performance
REQUEST_TIMEOUT=30
MAX_WORKERS=4
"""

# Write the .env.example file if it doesn't exist
if not os.path.exists(os.path.join(os.path.dirname(__file__), ".env.example")):
    with open(os.path.join(os.path.dirname(__file__), ".env.example"), "w") as f:
        f.write(env_example)

# Create a .env file if it doesn't exist
if not os.path.exists(os.path.join(os.path.dirname(__file__), ".env")):
    with open(os.path.join(os.path.dirname(__file__), ".env"), "w") as f:
        f.write(env_example)
    print("Created .env file with default values. Please update with your actual settings.")