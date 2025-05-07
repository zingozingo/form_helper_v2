# backend/core/db/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Create db directory if it doesn't exist
os.makedirs(os.path.join(os.path.dirname(__file__), '..', '..', 'data'), exist_ok=True)

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./backend/data/form_helper.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()