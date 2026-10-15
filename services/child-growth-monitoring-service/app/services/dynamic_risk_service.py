import pandas as pd
from typing import List, Dict, Any

from .temporal_feature_service import temporal_feature_service
from .risk_service import risk_service

class DynamicRiskService:
    def calculate_dynamic_risk(self, visits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Takes a child's entire genuine historical visits array and reconstructs the risk trajectory
        chronologically without leakage or interpolation.
        """
        if not visits:
            return []
            
        # Ensure chronological ordering
        visits = sorted(visits, key=lambda x: pd.to_datetime(x['visit_date']))
        
        trajectory = []
        for i in range(1, len(visits) + 1):
            history = visits[:i]
            
            # Extract sequence features strictly at this historical point
            features = temporal_feature_service.calculate_features(history)
            
            latest = history[-1]
            
            # Merge base features not returned by temporal derivation but required by risk schema
            for k, v in latest.items():
                if k not in features:
                    features[k] = v
            
            # Predict risk using genuine historical sequence up to this point
            risk_out = risk_service.calculate_risk(features, history=history)
            
            trajectory.append({
                "visit_date": str(pd.to_datetime(latest.get('visit_date')).date()),
                "age_days": latest.get('age_days'),
                "weight_kg": latest.get('weight_kg'),
                "verified_waz": latest.get('verified_waz'),
                "risk_probability": risk_out.get('risk_probability') if risk_out.get('risk_available') else None
            })
            
        return trajectory

dynamic_risk_service = DynamicRiskService()
