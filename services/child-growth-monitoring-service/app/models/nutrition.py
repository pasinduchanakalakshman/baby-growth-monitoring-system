from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class BabyNutritionPreferences(Base):
    """
    Persistence model for per-baby nutrition preferences and feeding history.
    Strictly isolated per-baby; referentially linked to Baby with CASCADE delete.
    """
    __tablename__ = "baby_nutrition_preferences"

    id = Column(Integer, primary_key=True, index=True)
    baby_id = Column(
        Integer,
        ForeignKey("babies.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    complementary_feeding_start_date = Column(Date, nullable=True)
    milk_feeding_method = Column(String, nullable=True)

    foods_introduced = Column(JSON, nullable=False, default=list)
    restricted_foods = Column(JSON, nullable=False, default=list)
    available_ingredients = Column(JSON, nullable=False, default=list)
    dietary_preferences = Column(JSON, nullable=False, default=list)
    recent_meal_history = Column(JSON, nullable=False, default=list)
    only_available_ingredients = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    baby = relationship("Baby", back_populates="nutrition_preferences")
