from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class SexEnum(str, enum.Enum):
    male = "Male"
    female = "Female"

class Baby(Base):
    __tablename__ = "babies"
    
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    name = Column(String, nullable=False)
    sex = Column(Enum(SexEnum), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    birth_weight_kg = Column(Float, nullable=False)
    
    birth_length_cm = Column(Float, nullable=True)
    gestational_age_weeks = Column(Integer, nullable=True)
    birth_order = Column(Integer, nullable=True)
    delivery_type = Column(String, nullable=True)
    apgar_score_5min = Column(Integer, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    owner = relationship("User", back_populates="babies")
    measurements = relationship("GrowthMeasurement", back_populates="baby", cascade="all, delete-orphan", order_by="GrowthMeasurement.visit_date")
    nutrition_preferences = relationship("BabyNutritionPreferences", back_populates="baby", uselist=False, cascade="all, delete-orphan")
