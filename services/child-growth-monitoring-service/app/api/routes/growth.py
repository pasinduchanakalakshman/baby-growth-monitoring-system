from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Dict, Any
from app.core.database import get_db
from app.models import Baby, User, GrowthMeasurement
from app.schemas.growth import (
    GrowthMeasurementCreate, GrowthMeasurementResponse, 
    GrowthOverviewResponse, CurrentGrowthOutput, Forecast30dOutput, Risk180dOutput
)
from app.api.deps import get_current_user

# Import our ML services
from app.services.who_service import who_service
from app.services.temporal_feature_service import temporal_feature_service
from app.services.forecast_service import forecast_service
from app.services.risk_service import risk_service
from app.services.dynamic_risk_service import dynamic_risk_service
from app.services.xai_service import xai_service
from app.services.model_loader import artifact_loader

router = APIRouter(prefix="/api/v1/growth", tags=["growth"])

def get_baby(db: Session, user: User) -> Baby:
    baby = db.query(Baby).filter(Baby.owner_id == user.id).first()
    if not baby:
        raise HTTPException(status_code=404, detail="Baby not found. Please register a baby first.")
    return baby

def format_history_for_ml(baby: Baby, db: Session) -> List[Dict[str, Any]]:
    # ML services expect history as list of dicts with all base fields
    measurements = db.query(GrowthMeasurement).filter(GrowthMeasurement.baby_id == baby.id).order_by(GrowthMeasurement.visit_date).all()
    history = []
    for m in measurements:
        history.append({
            "visit_date": str(m.visit_date),
            "weight_kg": m.weight_kg,
            "length_height_cm": m.length_height_cm,
            "age_days": m.age_days,
            "verified_waz": m.verified_waz,
            "verified_haz": m.verified_haz,
            "currently_breastfeeding": m.currently_breastfeeding,
            "formula_feeding": m.formula_feeding,
            "solid_foods_started": m.solid_foods_started,
            "diarrhea_last_14_days": m.diarrhea_last_14_days,
            "fever_last_14_days": m.fever_last_14_days,
            "cough_last_14_days": m.cough_last_14_days,
            "sex": baby.sex.value,
            "birth_weight_kg": baby.birth_weight_kg
        })
    return history

@router.post("/measurements", response_model=GrowthMeasurementResponse, status_code=status.HTTP_201_CREATED)
def add_measurement(meas_in: GrowthMeasurementCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    baby = get_baby(db, current_user)
    
    if meas_in.visit_date < baby.date_of_birth:
        raise HTTPException(status_code=400, detail="Visit date cannot be before date of birth.")
        
    # WHO Status
    who_res = who_service.calculate_who_metrics(
        sex=baby.sex.value,
        date_of_birth=baby.date_of_birth,
        visit_date=meas_in.visit_date,
        weight_kg=meas_in.weight_kg,
        length_height_cm=meas_in.length_height_cm
    )
    
    meas = GrowthMeasurement(
        baby_id=baby.id,
        visit_date=meas_in.visit_date,
        weight_kg=meas_in.weight_kg,
        length_height_cm=meas_in.length_height_cm,
        currently_breastfeeding=meas_in.currently_breastfeeding,
        formula_feeding=meas_in.formula_feeding,
        solid_foods_started=meas_in.solid_foods_started,
        diarrhea_last_14_days=meas_in.diarrhea_last_14_days,
        fever_last_14_days=meas_in.fever_last_14_days,
        cough_last_14_days=meas_in.cough_last_14_days,
        age_days=who_res.get("age_days"),
        verified_waz=who_res.get("verified_waz"),
        verified_haz=who_res.get("verified_haz")
    )
    db.add(meas)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Measurement for this date already exists.")
    db.refresh(meas)
    return meas

@router.get("/overview", response_model=GrowthOverviewResponse)
def get_overview(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    baby = get_baby(db, current_user)
    history = format_history_for_ml(baby, db)
    
    res = {"baby": {"name": baby.name, "sex": baby.sex.value, "date_of_birth": baby.date_of_birth}}
    
    if not history:
        return res
        
    latest = history[-1]
    res["current_growth"] = {
        "visit_date": latest["visit_date"],
        "age_days": latest["age_days"],
        "weight_kg": latest["weight_kg"],
        "length_height_cm": latest["length_height_cm"],
        "waz": latest["verified_waz"],
        "haz": latest["verified_haz"]
    }
    
    # Forecast
    f_out = forecast_service.generate_forecast(history, baby.sex.value, latest["age_days"])
    if f_out["forecast_available"]:
        res["forecast_30d"] = {
            "available": True,
            "estimated_waz": f_out.get("estimated_future_waz"),
            "estimated_weight_kg": f_out.get("estimated_future_weight_kg"),
            "estimated_weight_change_kg": f_out.get("estimated_weight_change_kg"),
            "horizon_days": f_out.get("nominal_horizon_days")
        }
    else:
        res["forecast_30d"] = {"available": False, "reason": f_out.get("reason")}
        
    # Risk
    temporal_feats = temporal_feature_service.calculate_features(history)
    for k, v in latest.items():
        if k not in temporal_feats:
            temporal_feats[k] = v
    
    r_out = risk_service.calculate_risk(temporal_feats)
    res["risk_180d"] = {
        "available": r_out["risk_available"],
        "applicable": r_out.get("model_applicable"),
        "probability": r_out.get("risk_probability"),
        "threshold": r_out.get("risk_threshold"),
        "flag": r_out.get("risk_flag"),
        "horizon_days": r_out.get("prediction_horizon_days"),
        "reason": r_out.get("reason")
    }
    
    return res

@router.get("/history", response_model=List[GrowthMeasurementResponse])
def get_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    baby = get_baby(db, current_user)
    measurements = db.query(GrowthMeasurement).filter(GrowthMeasurement.baby_id == baby.id).order_by(GrowthMeasurement.visit_date).all()
    return measurements

@router.get("/forecast")
def get_forecast(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    baby = get_baby(db, current_user)
    history = format_history_for_ml(baby, db)
    if not history:
        raise HTTPException(status_code=400, detail="No history available for forecast.")
    return forecast_service.generate_forecast(history, baby.sex.value, history[-1]["age_days"])

@router.get("/risk/latest")
def get_latest_risk(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    baby = get_baby(db, current_user)
    history = format_history_for_ml(baby, db)
    if not history:
        raise HTTPException(status_code=400, detail="No history available for risk.")
        
    features = temporal_feature_service.calculate_features(history)
    for k, v in history[-1].items():
        if k not in features:
            features[k] = v
            
    return risk_service.calculate_risk(features)

@router.get("/risk/trajectory")
def get_risk_trajectory(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    baby = get_baby(db, current_user)
    history = format_history_for_ml(baby, db)
    if not history:
        return []
    return dynamic_risk_service.calculate_dynamic_risk(history)

@router.get("/risk/explanation")
def get_risk_explanation(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    baby = get_baby(db, current_user)
    history = format_history_for_ml(baby, db)
    if not history:
        raise HTTPException(status_code=400, detail="No history available for explanation.")
        
    features = temporal_feature_service.calculate_features(history)
    for k, v in history[-1].items():
        if k not in features:
            features[k] = v
            
    r_out = risk_service.calculate_risk(features)
    if not r_out["risk_available"]:
        raise HTTPException(status_code=400, detail="Risk not available. Cannot generate explanation.")
        
    return xai_service.explain_prediction(features)

@router.get("/model-info")
def get_model_info():
    risk_meta = artifact_loader.get_risk_metadata()
    f_meta = artifact_loader.get_forecast_metadata()
    return {
        "Risk": {
            "model": risk_meta.get("model_type", "XGBoost"),
            "horizon_days": risk_meta.get("prediction_horizon_days", 180),
            "threshold": risk_meta.get("threshold", 0.50)
        },
        "Forecast": {
            "model": f_meta.get("model_name", "Linear Regression"),
            "nominal_horizon_days": f_meta.get("nominal_forecast_horizon", 30),
            "training_target": f_meta.get("selected_operational_window", "25-35 days")
        },
        "Disclaimers": [
            "For research use only.",
            "Not a clinical diagnosis.",
            "Not clinically validated."
        ]
    }
