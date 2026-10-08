from pydantic import BaseModel, ConfigDict, Field
from datetime import date
from typing import Optional, List, Dict, Any

class GrowthMeasurementCreate(BaseModel):
    visit_date: date
    weight_kg: float = Field(..., gt=0)
    length_height_cm: Optional[float] = Field(None, gt=0)
    
    # Feeding
    currently_breastfeeding: Optional[bool] = None
    formula_feeding: Optional[bool] = None
    solid_foods_started: Optional[bool] = None
    
    # Illness
    diarrhea_last_14_days: Optional[bool] = None
    fever_last_14_days: Optional[bool] = None
    cough_last_14_days: Optional[bool] = None

class GrowthMeasurementResponse(GrowthMeasurementCreate):
    id: int
    baby_id: int
    age_days: Optional[int] = None
    verified_waz: Optional[float] = None
    verified_haz: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)

class Forecast30dOutput(BaseModel):
    available: bool
    estimated_waz: Optional[float] = None
    estimated_weight_kg: Optional[float] = None
    estimated_weight_change_kg: Optional[float] = None
    horizon_days: Optional[int] = None
    reason: Optional[str] = None

class Risk180dOutput(BaseModel):
    available: bool
    applicable: Optional[bool] = None
    probability: Optional[float] = None
    threshold: Optional[float] = None
    flag: Optional[int] = None
    horizon_days: Optional[int] = None
    reason: Optional[str] = None

class CurrentGrowthOutput(BaseModel):
    visit_date: date
    age_days: Optional[int] = None
    weight_kg: float
    length_height_cm: Optional[float] = None
    waz: Optional[float] = None
    haz: Optional[float] = None

class GrowthOverviewResponse(BaseModel):
    baby: Dict[str, Any]
    current_growth: Optional[CurrentGrowthOutput] = None
    forecast_30d: Optional[Forecast30dOutput] = None
    risk_180d: Optional[Risk180dOutput] = None
