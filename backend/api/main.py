# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from api.routes import form_routes, ai_routes  # Use relative import
try:
    from api.routes import smart_ai_routes  # Import the smart AI routes
except ImportError as e:
    logging.warning(f"Smart AI routes not available: {str(e)}")
    smart_ai_routes = None
from core.db.database import Base, engine  # Import database components

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Create database directory if it doesn't exist
os.makedirs(os.path.join(os.path.dirname(__file__), 'data'), exist_ok=True)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Form Helper API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with the correct prefixes to match your extension's expectations
app.include_router(form_routes.router, prefix="/api")  # Changed from /api/v1
app.include_router(ai_routes.router, prefix="/api")    # Changed from /api/v1/ai

# Add profile routes
from api.routes.profile_routes import router as profile_router
app.include_router(profile_router, prefix="/api")

# Add smart AI routes if available
if smart_ai_routes:
    app.include_router(smart_ai_routes.router, prefix="/api")
    logger.info("Smart AI routes registered with prefix /api/smart")
else:
    logger.warning("Smart AI routes could not be registered. Check import: from api.routes import smart_ai_routes")

# Debug endpoints to help diagnose routing issues
@app.get("/api/debug")
async def debug():
    return {"status": "ok", "message": "API is running"}

@app.get("/api/test")
async def test():
    return {"status": "ok", "routes": ["/api/ai/ask", "/api/forms/debug", "/api/profiles"]}

@app.get("/")
async def root():
    return {"message": "Welcome to Form Helper API"}

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Form Helper API server...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)