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
        
        def _get_display_label(f_name: str) -> str:
            return f_name.replace('_', ' ').title()
        
        for p in pos:
            frontend.append({
                "feature": p['feature'], 
                "display_label": _get_display_label(p['feature']),
                "direction": "increased model-predicted risk",
                "importance_rank": pos.index(p) + 1
            })
            
        for n in neg:
            frontend.append({
                "feature": n['feature'],
                "display_label": _get_display_label(n['feature']),
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
            "disclaimer": "These features influenced the model-predicted risk. They do not establish clinical causality."
        }

xai_service = XAIService()
