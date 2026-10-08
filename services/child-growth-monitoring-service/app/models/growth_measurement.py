from sqlalchemy import Column, Integer, Float, Date, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from sqlalchemy.schema import UniqueConstraint

class GrowthMeasurement(Base):
    __tablename__ = "growth_measurements"
    
    id = Column(Integer, primary_key=True, index=True)
    baby_id = Column(Integer, ForeignKey("babies.id"), nullable=False)
    
    visit_date = Column(Date, nullable=False)
    weight_kg = Column(Float, nullable=False)
    length_height_cm = Column(Float, nullable=True)
    
    # Feeding variables
    currently_breastfeeding = Column(Boolean, nullable=True)
    formula_feeding = Column(Boolean, nullable=True)
    solid_foods_started = Column(Boolean, nullable=True)
    
    # Illness variables
    diarrhea_last_14_days = Column(Boolean, nullable=True)
    fever_last_14_days = Column(Boolean, nullable=True)
    cough_last_14_days = Column(Boolean, nullable=True)
    
    # WHO output variables
    age_days = Column(Integer, nullable=True)
    verified_waz = Column(Float, nullable=True)
    verified_haz = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    baby = relationship("Baby", back_populates="measurements")

    __table_args__ = (
        UniqueConstraint('baby_id', 'visit_date', name='uq_baby_visit_date'),
    )
