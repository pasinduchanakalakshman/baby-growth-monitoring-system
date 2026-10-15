import os
import json
import joblib
import pandas as pd
from typing import Dict, Any

# Resolve paths safely relative to this file's position in the repository
# We assume this file is at services/child-growth-monitoring-service/app/services/model_loader.py
# Therefore project root is 5 directories up
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(_CURRENT_DIR, "..", "..", "..", ".."))

class ArtifactLoader:
    """
    Singleton Artifact Loader for centralizing the safe resolution, loading,
    and metadata validation of frozen research models and schema.
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ArtifactLoader, cls).__new__(cls)
            cls._instance._cache = {}
        return cls._instance

    def _get_path(self, relative_path: str) -> str:
        return os.path.join(PROJECT_ROOT, relative_path)

    def _load_json(self, relative_path: str) -> Dict[str, Any]:
        path = self._get_path(relative_path)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Missing artifact: {path}")
        with open(path, 'r') as f:
            return json.load(f)

    def _load_joblib(self, relative_path: str) -> Any:
        path = self._get_path(relative_path)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Missing artifact: {path}")
        return joblib.load(path)

    def _load_excel(self, relative_path: str) -> pd.DataFrame:
        path = self._get_path(relative_path)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Missing artifact: {path}")
        return pd.read_excel(path)

    def get_risk_metadata(self) -> Dict[str, Any]:
        if "risk_metadata" not in self._cache:
            meta = self._load_json("models/metadata/final_risk_model_v1.json")
            # Validation
            if meta.get("model_type") != "xgboost":
                raise ValueError("Risk model type mismatch. Expected 'xgboost'.")
            if meta.get("target") != "future_growth_faltering_180d":
                raise ValueError("Risk model target mismatch.")
            if meta.get("prediction_horizon_days") != 180:
                raise ValueError("Risk model horizon mismatch.")
            if meta.get("threshold") != 0.5:
                raise ValueError("Risk model threshold mismatch.")
            self._cache["risk_metadata"] = meta
        return self._cache["risk_metadata"]

    def get_forecast_metadata(self) -> Dict[str, Any]:
        if "forecast_metadata" not in self._cache:
            meta = self._load_json("models/metadata/final_forecast_model_v1.json")
            # Validation
            if meta.get("model_name") != "Linear":
                raise ValueError("Forecast model type mismatch. Expected 'Linear'.")
            if meta.get("nominal_forecast_horizon") != 30:
                raise ValueError("Forecast model horizon mismatch.")
            if meta.get("selected_operational_window") != "25-35 days":
                raise ValueError("Forecast model operational window mismatch.")
            if meta.get("primary_target") != "target_verified_waz":
                raise ValueError("Forecast model target mismatch.")
            self._cache["forecast_metadata"] = meta
        return self._cache["forecast_metadata"]

    def get_risk_model(self):
        if "risk_model" not in self._cache:
            # Load metadata first to ensure it validates
            meta = self.get_risk_metadata()
            path = meta.get("artifact_paths", {}).get("model", "models/trained/baselines/v1/xgboost.joblib")
            self._cache["risk_model"] = self._load_joblib(path)
        return self._cache["risk_model"]

    def get_risk_preprocessor(self):
        if "risk_preprocessor" not in self._cache:
            meta = self.get_risk_metadata()
            path = meta.get("artifact_paths", {}).get("preprocessing_pipeline", "models/scalers/baseline_preprocessor_v1.joblib")
            self._cache["risk_preprocessor"] = self._load_joblib(path)
        return self._cache["risk_preprocessor"]

    def get_forecast_model(self):
        if "forecast_model" not in self._cache:
            meta = self.get_forecast_metadata()
            path = meta.get("model_artifact", "models/forecasting/v1/final_model_v1.joblib")
            self._cache["forecast_model"] = self._load_joblib(path)
        return self._cache["forecast_model"]

    def get_forecast_preprocessor(self):
        if "forecast_preprocessor" not in self._cache:
            meta = self.get_forecast_metadata()
            path = meta.get("preprocessing_artifact", "models/forecasting/v1/final_preprocessor_v1.joblib")
            self._cache["forecast_preprocessor"] = self._load_joblib(path)
        return self._cache["forecast_preprocessor"]

    def get_risk_schema(self) -> Dict[str, Any]:
        if "risk_schema" not in self._cache:
            meta = self.get_risk_metadata()
            path = meta.get("artifact_paths", {}).get("feature_schema", "models/metadata/baseline_feature_metadata_v1.json")
            self._cache["risk_schema"] = self._load_json(path)
        return self._cache["risk_schema"]

    def get_forecast_schema(self) -> Dict[str, Any]:
        if "forecast_schema" not in self._cache:
            meta = self.get_forecast_metadata()
            path = meta.get("feature_schema", "data/schemas/forecast_30d_model_feature_schema_v1.json")
            self._cache["forecast_schema"] = self._load_json(path)
        return self._cache["forecast_schema"]

    def get_who_wfa_boys(self) -> pd.DataFrame:
        if "who_wfa_boys" not in self._cache:
            self._cache["who_wfa_boys"] = self._load_excel("data/external/WHO Standards/wfa_boys_0-to-5-years_zscores.xlsx")
        return self._cache["who_wfa_boys"]

    def get_who_wfa_girls(self) -> pd.DataFrame:
        if "who_wfa_girls" not in self._cache:
            self._cache["who_wfa_girls"] = self._load_excel("data/external/WHO Standards/wfa_girls_0-to-5-years_zscores.xlsx")
        return self._cache["who_wfa_girls"]

    def get_who_lhfa_boys_0_2(self) -> pd.DataFrame:
        if "who_lhfa_boys_0_2" not in self._cache:
            self._cache["who_lhfa_boys_0_2"] = self._load_excel("data/external/WHO Standards/lhfa_boys_0-to-2-years_zscores.xlsx")
        return self._cache["who_lhfa_boys_0_2"]

    def get_who_lhfa_girls_0_2(self) -> pd.DataFrame:
        if "who_lhfa_girls_0_2" not in self._cache:
            self._cache["who_lhfa_girls_0_2"] = self._load_excel("data/external/WHO Standards/lhfa_girls_0-to-2-years_zscores.xlsx")
        return self._cache["who_lhfa_girls_0_2"]

    def get_who_lhfa_boys_2_5(self) -> pd.DataFrame:
        if "who_lhfa_boys_2_5" not in self._cache:
            self._cache["who_lhfa_boys_2_5"] = self._load_excel("data/external/WHO Standards/lhfa_boys_2-to-5-years_zscores.xlsx")
        return self._cache["who_lhfa_boys_2_5"]

    def get_who_lhfa_girls_2_5(self) -> pd.DataFrame:
        if "who_lhfa_girls_2_5" not in self._cache:
            self._cache["who_lhfa_girls_2_5"] = self._load_excel("data/external/WHO Standards/lhfa_girls_2-to-5-years_zscores.xlsx")
        return self._cache["who_lhfa_girls_2_5"]

    def get_hybrid_manifest(self) -> Dict[str, Any]:
        if "hybrid_manifest" not in self._cache:
            manifest = self._load_json("models/metadata/frozen_hybrid_pipeline_manifest_v1.json")
            if manifest.get("selected_architecture") != "XGBoost + Transformer Late Fusion Hybrid":
                raise ValueError("Hybrid manifest architecture mismatch.")
            fusion_spec = manifest.get("fusion_specification", {})
            if fusion_spec.get("alpha_xgboost") != 0.9 or fusion_spec.get("weight_transformer") != 0.1:
                raise ValueError("Hybrid fusion weights mismatch.")
            self._cache["hybrid_manifest"] = manifest
        return self._cache["hybrid_manifest"]

    def get_sequence_schema(self) -> Dict[str, Any]:
        if "sequence_schema" not in self._cache:
            schema = self._load_json("data/schemas/sequence_feature_schema_v1.json")
            if schema.get("sequence_length") != 20:
                raise ValueError("Sequence length mismatch in schema.")
            if schema.get("n_transformed_features") != 49:
                raise ValueError("Transformed features count mismatch in schema.")
            self._cache["sequence_schema"] = schema
        return self._cache["sequence_schema"]

    def get_sequence_preprocessor(self):
        if "sequence_preprocessor" not in self._cache:
            path = "models/scalers/sequence_preprocessor_v1.joblib"
            self._cache["sequence_preprocessor"] = self._load_joblib(path)
        return self._cache["sequence_preprocessor"]

    def get_transformer_model(self):
        if "transformer_model" not in self._cache:
            try:
                import keras
                from .transformer_layers import TRANSFORMER_CUSTOM_OBJECTS
                model_path = self._get_path("models/trained/transformer/v1/final_transformer_clean.keras")
                if not os.path.exists(model_path):
                    raise FileNotFoundError(f"Missing transformer model artifact: {model_path}")
                model = keras.models.load_model(
                    model_path,
                    custom_objects=TRANSFORMER_CUSTOM_OBJECTS,
                    compile=False
                )
                self._cache["transformer_model"] = model
            except Exception as e:
                raise RuntimeError(f"Failed to load Clean Transformer model: {str(e)}") from e
        return self._cache["transformer_model"]

    def clear_cache(self):
        self._cache = {}

# Global instance for easy import
artifact_loader = ArtifactLoader()
