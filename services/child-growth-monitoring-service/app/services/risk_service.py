import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List

from .model_loader import artifact_loader
from .sequence_service import sequence_service

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
        artifact_loader.get_hybrid_manifest()
        artifact_loader.get_sequence_schema()
        artifact_loader.get_sequence_preprocessor()
        artifact_loader.get_transformer_model()
        
    def _check_cohort_applicability(self, waz: float) -> str:
        if pd.isna(waz) or waz is None:
            return 'unknown_cohort'
        if float(waz) >= -2.0:
            return 'within_primary_early_risk_cohort'
        return 'outside_primary_early_risk_cohort'

    def calculate_risk(
        self,
        features: Dict[str, Any],
        history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        schema = artifact_loader.get_risk_schema()
        manifest = artifact_loader.get_hybrid_manifest()
        meta = artifact_loader.get_risk_metadata()
        
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
            
        # 1. XGBoost tabular inference branch
        df = prepare_feature_dataframe(features, schema)
        preprocessor = artifact_loader.get_risk_preprocessor()
        model = artifact_loader.get_risk_model()
        X_proc = preprocessor.transform(df)
        prob_xgb = float(model.predict_proba(X_proc)[0, 1])

        if not np.isfinite(prob_xgb) or not (0.0 <= prob_xgb <= 1.0):
            raise ValueError(f"XGBoost probability {prob_xgb} is not finite or outside [0, 1].")

        # 2. Clean Transformer longitudinal sequence branch
        # Use provided historical encounters or fallback to single index encounter
        seq_history = history if (history is not None and len(history) > 0) else [features]
        index_date = str(features.get("visit_date")) if features.get("visit_date") else None

        try:
            tensor = sequence_service.prepare_sequence_tensor(seq_history, index_visit_date=index_date)
            transformer_model = artifact_loader.get_transformer_model()
            prob_transformer = float(transformer_model.predict(tensor, verbose=0)[0, 0])
        except Exception as e:
            # Strict Rule: Do not silently fall back to XGBoost-only predictions
            return {
                "risk_available": False,
                "reason": f"Hybrid inference failed on Transformer branch: {str(e)}",
                "model_applicable": False
            }

        if not np.isfinite(prob_transformer) or not (0.0 <= prob_transformer <= 1.0):
            return {
                "risk_available": False,
                "reason": f"Transformer probability {prob_transformer} is not finite or outside [0, 1].",
                "model_applicable": False
            }

        # 3. Hybrid fusion: 0.90 * XGBoost + 0.10 * Clean Transformer
        fusion_spec = manifest.get("fusion_specification", {})
        alpha_xgb = float(fusion_spec.get("alpha_xgboost", 0.90))
        weight_trans = float(fusion_spec.get("weight_transformer", 0.10))
        hybrid_score = float(alpha_xgb * prob_xgb + weight_trans * prob_transformer)

        if not np.isfinite(hybrid_score) or not (0.0 <= hybrid_score <= 1.0):
            raise ValueError(f"Hybrid score {hybrid_score} is not finite or outside [0, 1].")

        threshold = meta.get("threshold", 0.50)

        return {
            "risk_available": True,
            "risk_probability": hybrid_score,
            "risk_threshold": threshold,
            "risk_flag": 1 if hybrid_score >= threshold else 0,
            "prediction_horizon_days": meta.get("prediction_horizon_days", 180),
            "model_version": meta.get("model_version", "v1"),
            "model_type": manifest.get("selected_architecture", "XGBoost + Transformer Late Fusion Hybrid"),
            "component_scores": {
                "xgboost_probability": prob_xgb,
                "transformer_probability": prob_transformer,
                "alpha_xgboost": alpha_xgb,
                "weight_transformer": weight_trans
            },
            "model_applicable": True
        }

risk_service = RiskService()
