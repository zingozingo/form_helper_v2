# backend/api/routes/profile_routes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime
import logging

from backend.core.db.database import get_db
from backend.core.db.models import UserProfile, SavedForm

router = APIRouter(tags=["profiles"])

# Pydantic models for request/response
class ProfileCreate(BaseModel):
    user_id: str
    display_name: Optional[str] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    field_values: Optional[dict] = None

class ProfileResponse(BaseModel):
    id: int
    user_id: str
    display_name: Optional[str]
    field_values: dict
    created_at: datetime.datetime
    updated_at: datetime.datetime

logger = logging.getLogger(__name__)

@router.post("/profiles", response_model=ProfileResponse)
async def create_profile(profile: ProfileCreate, db: Session = Depends(get_db)):
    """Create a new user profile"""
    existing_profile = db.query(UserProfile).filter(UserProfile.user_id == profile.user_id).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="User ID already exists")
    
    new_profile = UserProfile(user_id=profile.user_id, display_name=profile.display_name, field_values={})
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    
    return new_profile

@router.get("/profiles/{user_id}", response_model=ProfileResponse)
async def get_profile(user_id: str, db: Session = Depends(get_db)):
    """Get a user profile by user_id"""
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile

@router.put("/profiles/{user_id}", response_model=ProfileResponse)
async def update_profile(user_id: str, profile_update: ProfileUpdate, db: Session = Depends(get_db)):
    """Update a user profile"""
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Update display name if provided
    if profile_update.display_name is not None:
        profile.display_name = profile_update.display_name
    
    # Update field values if provided
    if profile_update.field_values is not None:
        # Merge with existing field values instead of replacing
        current_fields = profile.field_values or {}
        current_fields.update(profile_update.field_values)
        profile.field_values = current_fields
    
    db.commit()
    db.refresh(profile)
    
    return profile

# Add routes for saved forms if needed