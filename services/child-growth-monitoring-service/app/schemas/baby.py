from pydantic import BaseModel, ConfigDict, Field
from datetime import date
from typing import Optional
from app.models.baby import SexEnum

class BabyCreate(BaseModel):
    name: str
    sex: SexEnum
    date_of_birth: date
    birth_weight_kg: float = Field(..., gt=0)
    birth_length_cm: Optional[float] = Field(None, gt=0)
    gestational_age_weeks: Optional[int] = None
    birth_order: Optional[int] = None
    delivery_type: Optional[str] = None
    apgar_score_5min: Optional[int] = None

class BabyUpdate(BaseModel):
    name: Optional[str] = None
    birth_length_cm: Optional[float] = Field(None, gt=0)
    gestational_age_weeks: Optional[int] = None
    birth_order: Optional[int] = None
    delivery_type: Optional[str] = None
    apgar_score_5min: Optional[int] = None

class BabyResponse(BabyCreate):
    id: int
    owner_id: int
    model_config = ConfigDict(from_attributes=True)
