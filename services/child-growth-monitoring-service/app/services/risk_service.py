import pandas as pd
import numpy as np
from typing import Dict, Any

from .model_loader import artifact_loader

class RiskService:
    def __init__(self):
        # Trigger lazy load validation for production instantiation
        artifact_loader.get_risk_model()
        artifact_loader.get_risk_preprocessor()
        artifact_loader.get_risk_schema()
        artifact_loader.get_risk_metadata()
        
    def _check_cohort_applicability(self, waz: float) -> str:
        if pd.isna(waz) or waz is None:
            return 'unknown_cohort'
        if float(waz) >= -2.0:
            return 'within_primary_early_risk_cohort'
        return 'outside_primary_early_risk_cohort'

    def calculate_risk(self, features: Dict[str, Any]) -> Dict[str, Any]:
        schema = artifact_loader.get_risk_schema()
        expected_features = (
            schema.get('numeric_features', []) +
            schema.get('boolean_features', []) +
            schema.get('categorical_features', [])
        )
        
        # Check applicability using the verified_waz present in index features
        waz = features.get('verified_waz')
        applicability = self._check_cohort_applicability(waz)
        
        if applicability == 'outside_primary_early_risk_cohort':
            return {
                "risk_available": False,
                "reason": "verified_waz < -2 at index time. Model not applicable.",
                "model_applicable": False
            }
            
        if applicability == 'unknown_cohort':
            return {
                "risk_available": False,
                "reason": "verified_waz missing or invalid at index time.",
                "model_applicable": False
            }
            
        # Extract features
        row_dict = {}
        for f in expected_features:
            row_dict[f] = features.get(f, np.nan)
            
        df = pd.DataFrame([row_dict])
        
        preprocessor = artifact_loader.get_risk_preprocessor()
        model = artifact_loader.get_risk_model()
        meta = artifact_loader.get_risk_metadata()
        
        # Inference without leakage
        X_proc = preprocessor.transform(df)
        prob = float(model.predict_proba(X_proc)[0, 1])
        
        threshold = meta.get("threshold", 0.50)
        
        return {
            "risk_available": True,
            "risk_probability": prob,
            "risk_threshold": threshold,
            "risk_flag": 1 if prob >= threshold else 0,
            "prediction_horizon_days": meta.get("prediction_horizon_days", 180),
            "model_version": meta.get("model_version", "v1"),
            "model_applicable": True
        }

risk_service = RiskService()
