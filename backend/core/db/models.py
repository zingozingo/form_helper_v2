# backend/core/db/models.py
from sqlalchemy import Column, Integer, String, JSON, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)  # Could be email or browser ID
    display_name = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Store common form field values as JSON
    field_values = Column(JSON, default=dict)
    
    # Relationships
    saved_forms = relationship("SavedForm", back_populates="profile")
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "display_name": self.display_name,
            "field_values": self.field_values,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

class SavedForm(Base):
    __tablename__ = "saved_forms"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("user_profiles.id"))
    form_name = Column(String)
    form_url = Column(String)
    form_data = Column(JSON)  # Store form structure and field values
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationship
    profile = relationship("UserProfile", back_populates="saved_forms")