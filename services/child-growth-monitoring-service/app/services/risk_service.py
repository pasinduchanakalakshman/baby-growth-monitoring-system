import pandas as pd
import numpy as np
from typing import Dict, Any

from .model_loader import artifact_loader

def prepare_feature_dataframe(features: Dict[str, Any], schema: Dict[str, Any]) -> pd.DataFrame:
    """
    Constructs a 1-row DataFrame strictly following the frozen preprocessor schema.
    Converts missing values (None / pd.isna) to np.nan for numeric and boolean columns
    so that scikit-learn's SimpleImputer(missing_values=np.nan) can properly impute them.
    Converts Python booleans to float (1.0/0.0).
    Converts categorical columns to str or np.nan.
    Guarantees that no target labels or future leakage columns enter the predictor DataFrame.
    """
    row_dict = {}

    # Numeric features
    for col in schema.get('numeric_features', []):
        val = features.get(col)
        if val is None or pd.isna(val):
            row_dict[col] = np.nan
        else:
            try:
                row_dict[col] = float(val)
            except (ValueError, TypeError):
                row_dict[col] = np.nan

    # Boolean features
    for col in schema.get('boolean_features', []):
        val = features.get(col)
        if val is None or pd.isna(val):
            row_dict[col] = np.nan
        elif isinstance(val, (bool, np.bool_)):
            row_dict[col] = 1.0 if val else 0.0
        else:
            try:
                row_dict[col] = float(val)
            except (ValueError, TypeError):
                row_dict[col] = np.nan

    # Categorical features
    for col in schema.get('categorical_features', []):
        val = features.get(col)
        if val is None or pd.isna(val):
            row_dict[col] = np.nan
        else:
            row_dict[col] = str(val)

    return pd.DataFrame([row_dict])

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
            
        # Extract features into properly prepared DataFrame matching frozen preprocessor schema
        df = prepare_feature_dataframe(features, schema)
        
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
