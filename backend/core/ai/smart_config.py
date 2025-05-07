# backend/core/ai/smart_config.py
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class SmartAIConfig:
    """Configuration settings for the Smart AI system"""
    
    # AI Provider Settings
    AI_PROVIDER = os.getenv("AI_PROVIDER", "openai").lower()
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    
    # Model Settings
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4")
    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")
    
    # Performance Settings
    MAX_TOKENS = int(os.getenv("MAX_TOKENS", "800"))
    TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.7"))
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "15"))
    
    # Caching Settings
    ENABLE_CACHE = os.getenv("ENABLE_CACHE", "True").lower() == "true"
    CACHE_EXPIRY = int(os.getenv("CACHE_EXPIRY", str(3600 * 24 * 7)))  # Default 1 week
    
    # Logging Settings
    LOG_API_REQUESTS = os.getenv("LOG_API_REQUESTS", "False").lower() == "true"
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    # Knowledge Base Settings
    KNOWLEDGE_BASE_PATH = os.getenv("KNOWLEDGE_BASE_PATH", "")  # Default to built-in
    PREFER_KNOWLEDGE_BASE = os.getenv("PREFER_KNOWLEDGE_BASE", "True").lower() == "true"
    
    # Security Settings
    DISABLE_SSL_VERIFICATION = os.getenv("DISABLE_SSL_VERIFICATION", "True").lower() == "true"
    
    # Feature Flags
    ENABLE_FORM_ANALYSIS = os.getenv("ENABLE_FORM_ANALYSIS", "True").lower() == "true"
    ENABLE_FIELD_RELATIONSHIPS = os.getenv("ENABLE_FIELD_RELATIONSHIPS", "True").lower() == "true"
    ENABLE_PRIVACY_ANALYSIS = os.getenv("ENABLE_PRIVACY_ANALYSIS", "True").lower() == "true"
    
    @classmethod
    def get_api_key(cls):
        """Get the appropriate API key based on the provider setting"""
        if cls.AI_PROVIDER == "openai":
            return cls.OPENAI_API_KEY
        elif cls.AI_PROVIDER == "anthropic":
            return cls.ANTHROPIC_API_KEY
        return None
    
    @classmethod
    def get_model(cls):
        """Get the appropriate model based on the provider setting"""
        if cls.AI_PROVIDER == "openai":
            return cls.OPENAI_MODEL
        elif cls.AI_PROVIDER == "anthropic":
            return cls.ANTHROPIC_MODEL
        return None
    
    @classmethod
    def is_valid_configuration(cls):
        """Check if the configuration is valid for AI operations"""
        # Check if we have a valid API provider
        if cls.AI_PROVIDER not in ["openai", "anthropic"]:
            return False
        
        # Check if we have an API key
        api_key = cls.get_api_key()
        if not api_key:
            return False
        
        # Check if we have a model
        model = cls.get_model()
        if not model:
            return False
        
        return True
    
    @classmethod
    def get_env_summary(cls):
        """Get a summary of the environment configuration for diagnostics"""
        return {
            "ai_provider": cls.AI_PROVIDER,
            "model": cls.get_model(),
            "has_api_key": bool(cls.get_api_key()),
            "max_tokens": cls.MAX_TOKENS,
            "temperature": cls.TEMPERATURE,
            "cache_enabled": cls.ENABLE_CACHE,
            "cache_expiry_hours": cls.CACHE_EXPIRY / 3600,
            "ssl_verification_disabled": cls.DISABLE_SSL_VERIFICATION,
            "features": {
                "form_analysis": cls.ENABLE_FORM_ANALYSIS,
                "field_relationships": cls.ENABLE_FIELD_RELATIONSHIPS,
                "privacy_analysis": cls.ENABLE_PRIVACY_ANALYSIS
            }
        }