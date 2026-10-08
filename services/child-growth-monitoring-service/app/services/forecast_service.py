import pandas as pd
import numpy as np
from typing import List, Dict, Any

from .model_loader import artifact_loader
from .temporal_feature_service import temporal_feature_service

class ForecastService:
    def __init__(self):
        # We process WHO WFA tables once on init for the inverse calculation
        self._boys_wfa = artifact_loader._load_excel("data/external/WHO Standards/wfa_boys_0-to-5-years_zscores.xlsx").copy()
        self._girls_wfa = artifact_loader._load_excel("data/external/WHO Standards/wfa_girls_0-to-5-years_zscores.xlsx").copy()
        
        for df in [self._boys_wfa, self._girls_wfa]:
            df.columns = df.columns.str.strip()
            if 'Month' in df.columns:
                df.rename(columns={'Month': 'age_days'}, inplace=True)
            if 'Day' in df.columns:
                df['age_days'] = df['Day']
            df.set_index('age_days', inplace=True)

    def invert_waz_to_weight(self, sex: str, age_days: float, waz: float) -> float:
        try:
            normalized_sex = str(sex).strip().lower()
            if normalized_sex in ['male', 'm']:
                ref = self._boys_wfa
            else:
                ref = self._girls_wfa
                
            # Exact logic from Stage 14 validation
            age_months = int(round(age_days / 30.4375))
            age_months = min(max(age_months, ref.index.min()), ref.index.max())
            lms = ref.loc[age_months]
            L = float(lms['L'])
            M = float(lms['M'])
            S = float(lms['S'])
            
            if L != 0:
                weight = M * ((1 + L * S * waz) ** (1 / L))
            else:
                weight = M * np.exp(S * waz)
            return float(weight)
        except Exception:
            return np.nan

    def generate_forecast(self, history: List[Dict[str, Any]], sex: str, index_age_days: float, forecast_horizon_days: int = None) -> Dict[str, Any]:
        if not history:
            return {
                "forecast_available": False,
                "reason": "No history provided."
            }
            
        # 1. Base requirements check
        latest_visit = history[-1]
        index_weight = latest_visit.get('weight_kg')
        index_waz = latest_visit.get('verified_waz')
        
        if pd.isna(index_weight) or pd.isna(index_waz) or index_weight is None or index_waz is None:
            return {
                "forecast_available": False,
                "reason": "Missing weight_kg or verified_waz at index visit. Cannot reliably forecast."
            }
            
        # 2. Extract temporal features
        temporal_feats = temporal_feature_service.calculate_features(history)
        
        # 3. Get schema and artifacts
        schema = artifact_loader.get_forecast_schema()
        model_inputs = schema.get('model_inputs', [])
        
        meta = artifact_loader.get_forecast_metadata()
        preprocessor = artifact_loader.get_forecast_preprocessor()
        model = artifact_loader.get_forecast_model()
        
        nominal_horizon = meta.get('nominal_forecast_horizon', 30)
        actual_horizon = forecast_horizon_days if forecast_horizon_days is not None else nominal_horizon
        
        # 4. Map temporal features to model input dictionary
        # The schema uses 'index_' prefix for variables and 'forecast_horizon_days'
        model_features = {}
        for col in model_inputs:
            if col == 'forecast_horizon_days':
                model_features[col] = actual_horizon
            elif col == 'index_sex':
                model_features[col] = sex
            elif col == 'index_age_days':
                model_features[col] = index_age_days
            else:
                # Remove 'index_' prefix to match temporal_features output
                base_name = col.replace('index_', '', 1)
                
                # Check if it was in the original visit dict directly
                if base_name in latest_visit:
                    model_features[col] = latest_visit[base_name]
                else:
                    model_features[col] = temporal_feats.get(base_name)
                    
        # 5. DataFrame formatting for Preprocessor
        input_df = pd.DataFrame([model_features])
        
        # 6. Transform and Predict
        X_proc = preprocessor.transform(input_df)
        pred_future_waz = float(model.predict(X_proc)[0])
        
        # 7. Convert to weight
        future_age_days = index_age_days + actual_horizon
        pred_future_weight = self.invert_waz_to_weight(sex, future_age_days, pred_future_waz)
        
        if pd.isna(pred_future_weight) or pred_future_weight <= 0:
            return {
                "forecast_available": False,
                "reason": "Inverse WHO weight conversion failed or produced invalid weight."
            }
            
        predicted_weight_change = pred_future_weight - index_weight

        return {
            "forecast_available": True,
            "estimated_future_waz": pred_future_waz,
            "estimated_future_weight_kg": pred_future_weight,
            "estimated_weight_change_kg": predicted_weight_change,
            "nominal_horizon_days": nominal_horizon,
            "training_window_days": [25, 35],
            "model_version": meta.get("model_version", "v1"),
            "methodology_note": "Approximately 30-day estimate based on genuine 25–35 day training follow-up observations."
        }

forecast_service = ForecastService()
