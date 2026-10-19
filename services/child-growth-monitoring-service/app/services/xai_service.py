import shap
import numpy as np
import pandas as pd
from typing import Dict, Any, List

from .model_loader import artifact_loader
from .risk_service import prepare_feature_dataframe

def patch_shap_xgboost():
    """Matches the exact SHAP UBJSON patching mechanism required for the frozen XGBoost tree."""
    try:
        import shap.explainers._tree
        _orig_decode = shap.explainers._tree.decode_ubjson_buffer
        
        def _patched_decode(fd):
            jmodel = _orig_decode(fd)
            param = jmodel.get("learner", {}).get("learner_model_param", {})
            if "base_score" in param and isinstance(param["base_score"], str) and param["base_score"].startswith("["):
                param["base_score"] = param["base_score"].strip("[]")
            return jmodel
            
        shap.explainers._tree.decode_ubjson_buffer = _patched_decode
    except Exception:
        pass

patch_shap_xgboost()

FEATURE_DISPLAY_LABELS = {
    "weight_kg": "Current weight",
    "length_height_cm": "Current length / height",
    "birth_weight_kg": "Birth weight",
    "birth_length_cm": "Length at birth",
    "gestational_age_weeks": "Gestational age",
    "birth_order": "Birth order",
    "apgar_score_5min": "5-minute APGAR score",
    "age_days": "Child age",
    "verified_waz": "Weight-for-age growth score",
    "verified_haz": "Length-for-age growth score",
    "observation_count": "Number of clinic visits",
    "days_since_previous_visit": "Time since previous growth check",
    "weight_change_kg": "Weight change between visits",
    "waz_change": "Change in weight-for-age score",
    "weight_velocity_kg_per_day": "Average daily weight change",
    "weight_velocity_kg_per_30d": "Monthly weight change rate",
    "waz_velocity_per_day": "Daily change in weight-for-age score",
    "waz_velocity_per_30d": "Monthly change in weight-for-age score",
    "height_measurement_available": "Length / height recorded at visit",
    "last_observed_height_cm": "Previous recorded length / height",
    "last_observed_haz": "Previous length-for-age score",
    "days_since_last_height_measurement": "Time since last length / height check",
    "height_change_cm": "Change in length / height",
    "haz_change": "Change in length-for-age growth score",
    "height_velocity_cm_per_day": "Daily change in length / height",
    "height_velocity_cm_per_30d": "Monthly change in length / height",
    "haz_velocity_per_day": "Change in length-for-age growth score",
    "haz_velocity_per_30d": "Monthly change in length-for-age score",
    "waz_rolling_mean_3": "Recent average weight-for-age score",
    "weight_rolling_mean_3": "Recent average weight",
    "breastfeeding_status": "Breastfeeding status",
    "breastfeeding_frequency_per_day": "Daily breastfeeding frequency",
    "formula_feeding": "Formula feeding",
    "formula_feeds_per_day": "Daily formula feeds",
    "complementary_feeding_started": "Solid foods introduced",
    "complementary_feeding_start_age_months": "Age solid foods started",
    "meals_per_day": "Meals per day",
    "food_groups_consumed": "Dietary food diversity",
    "supplement_use": "Nutritional supplement use",
    "supplement_type": "Type of supplement",
    "recent_illness": "Recent illness recorded",
    "diarrhea_recent": "Recent diarrhea reported",
    "fever_recent": "Recent fever reported",
    "respiratory_illness_recent": "Recent cough or cold reported",
    "illness_duration_days": "Duration of illness",
    "sex": "Biological sex",
    "delivery_type": "Type of delivery",
    "date_of_birth": "Date of birth"
}

def get_display_label(f_name: str) -> str:
    if f_name in FEATURE_DISPLAY_LABELS:
        return FEATURE_DISPLAY_LABELS[f_name]
    for cat_prefix in ("sex_", "delivery_type_", "supplement_type_"):
        if f_name.startswith(cat_prefix):
            val = f_name[len(cat_prefix):].replace('_', ' ').title()
            cat_label = FEATURE_DISPLAY_LABELS.get(cat_prefix[:-1], cat_prefix[:-1].replace('_', ' ').title())
            return f"{cat_label}: {val}"
    return f_name.replace('_', ' ').title()

class XAIService:
    def __init__(self):
        self.explainer = None
        self._feature_names = None
        
    def _init_explainer(self):
        if self.explainer is None:
            model = artifact_loader.get_risk_model()
            self.explainer = shap.TreeExplainer(model)
            
            preprocessor = artifact_loader.get_risk_preprocessor()
            try:
                names = preprocessor.get_feature_names_out()
                cleaned = []
                for name in names:
                    if '__' in name:
                        name = name.split('__', 1)[1]
                    cleaned.append(name)
                self._feature_names = cleaned
            except Exception:
                # Fallback empty list safely if scikit-learn version mismatch (should not happen in frozen docker)
                self._feature_names = []

    def explain_prediction(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Explain the probability logic for one visit prediction safely masking internal technical variables.
        """
        self._init_explainer()
        
        schema = artifact_loader.get_risk_schema()
        
        # Build identical dataframe shape as risk_service matching frozen preprocessor schema
        df = prepare_feature_dataframe(features, schema)
        preprocessor = artifact_loader.get_risk_preprocessor()
        X_proc = preprocessor.transform(df)
        
        shap_vals = self.explainer.shap_values(X_proc)[0]
        
        technical = []
        frontend = []
        
        for i, name in enumerate(self._feature_names):
            sv = float(shap_vals[i])
            if abs(sv) < 1e-6:
                continue
                
            raw_val = features.get(name)
            # Find original categorical string if dummy one-hot encoded
            if raw_val is None:
                for cat_f in schema.get('categorical_features', []):
                    if name.startswith(f"{cat_f}_"):
                        raw_val = features.get(cat_f)
                        break
            
            tv = float(X_proc[0, i])
            if np.isnan(tv):
                tv = None
                
            if isinstance(raw_val, float) and np.isnan(raw_val):
                raw_val = None

            technical.append({
                "feature": name,
                "transformed_value": tv,
                "raw_value": raw_val,
                "shap_contribution": sv
            })
            
        # Select top directionals
        pos = sorted([t for t in technical if t['shap_contribution'] > 0], key=lambda x: x['shap_contribution'], reverse=True)[:3]
        neg = sorted([t for t in technical if t['shap_contribution'] < 0], key=lambda x: x['shap_contribution'])[:3]
        
        for p in pos:
            frontend.append({
                "feature": p['feature'], 
                "display_label": get_display_label(p['feature']),
                "direction": "increased model-predicted risk",
                "importance_rank": pos.index(p) + 1
            })
            
        for n in neg:
            frontend.append({
                "feature": n['feature'], 
                "display_label": get_display_label(n['feature']),
                "direction": "decreased model-predicted risk",
                "importance_rank": neg.index(n) + 1
            })
            
        base_val = self.explainer.expected_value
        if isinstance(base_val, np.ndarray):
            base_val = base_val[0]
            
        return {
            "technical_explanation": {
                "base_value": float(base_val),
                "contributions": technical
            },
            "frontend_safe_explanation": frontend,
            "disclaimer": "These features influenced the model-predicted risk. They do not establish clinical causality.",
            "model_coverage_disclosure": "This explanation applies to the XGBoost tabular model (90% weight in the hybrid architecture). The longitudinal Transformer model (10% weight) does not produce individual feature SHAP attributions."
        }

xai_service = XAIService()
