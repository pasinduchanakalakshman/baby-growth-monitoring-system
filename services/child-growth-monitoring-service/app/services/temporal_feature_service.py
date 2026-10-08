import pandas as pd
import numpy as np
from typing import List, Dict, Any

class TemporalFeatureService:
    
    @classmethod
    def calculate_features(cls, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Takes chronologically ordered, genuine child measurements up to and including the index visit.
        Calculates exact Stage 4-compatible features for the index (last) visit.
        """
        if not history:
            return {}
            
        df = pd.DataFrame(history)
        
        # Ensure numeric
        for col in ['weight_kg', 'verified_waz', 'length_height_cm', 'verified_haz']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            else:
                df[col] = np.nan
                
        df['visit_date_dt'] = pd.to_datetime(df['visit_date'])
        
        # We assume the history is strictly for a single child, pre-sorted chronologically.
        df = df.sort_values('visit_date_dt').reset_index(drop=True)
        
        df['observation_count'] = np.arange(1, len(df) + 1)
        df['days_since_previous_visit'] = df['visit_date_dt'].diff().dt.days
        
        df['weight_change_kg'] = df['weight_kg'].diff()
        df['waz_change'] = df['verified_waz'].diff()
        
        df['weight_velocity_kg_per_day'] = np.where(df['days_since_previous_visit'] > 0, df['weight_change_kg'] / df['days_since_previous_visit'], np.nan)
        df['weight_velocity_kg_per_30d'] = df['weight_velocity_kg_per_day'] * 30
        
        df['waz_velocity_per_day'] = np.where(df['days_since_previous_visit'] > 0, df['waz_change'] / df['days_since_previous_visit'], np.nan)
        df['waz_velocity_per_30d'] = df['waz_velocity_per_day'] * 30
        
        df['height_measurement_available'] = np.where(df['length_height_cm'].notna(), 1, 0)
        height_mask = df['length_height_cm'].notna()
        
        df['last_observed_height_cm'] = df['length_height_cm'].ffill()
        df['last_observed_haz'] = df['verified_haz'].ffill()
        
        df['actual_height_date'] = df['visit_date_dt'].copy()
        df.loc[~height_mask, 'actual_height_date'] = pd.NaT
        
        df['prev_actual_height_date'] = df['actual_height_date'].shift(1).ffill()
        df['days_since_last_height_measurement'] = (df['visit_date_dt'] - df['prev_actual_height_date']).dt.days
        
        df['most_recent_earlier_height'] = df['length_height_cm'].shift(1).ffill()
        df['most_recent_earlier_haz'] = df['verified_haz'].shift(1).ffill()
        
        df['height_change_cm'] = np.where(height_mask & df['most_recent_earlier_height'].notna(), df['length_height_cm'] - df['most_recent_earlier_height'], np.nan)
        df['haz_change'] = np.where(height_mask & df['most_recent_earlier_haz'].notna(), df['verified_haz'] - df['most_recent_earlier_haz'], np.nan)
        
        df['height_velocity_cm_per_day'] = np.where(
            height_mask & (df['days_since_last_height_measurement'] > 0) & df['height_change_cm'].notna(),
            df['height_change_cm'] / df['days_since_last_height_measurement'],
            np.nan
        )
        df['height_velocity_cm_per_30d'] = df['height_velocity_cm_per_day'] * 30
        
        df['haz_velocity_per_day'] = np.where(
            height_mask & (df['days_since_last_height_measurement'] > 0) & df['haz_change'].notna(),
            df['haz_change'] / df['days_since_last_height_measurement'],
            np.nan
        )
        df['haz_velocity_per_30d'] = df['haz_velocity_per_day'] * 30
        
        df['waz_rolling_mean_3'] = df['verified_waz'].rolling(window=3, min_periods=1).mean()
        df['weight_rolling_mean_3'] = df['weight_kg'].rolling(window=3, min_periods=1).mean()
        
        # Output the exact final row as a dictionary
        index_row = df.iloc[-1].to_dict()
        
        # Replace NaNs with None for pure JSON/Python compatibility
        clean_row = {}
        for k, v in index_row.items():
            if pd.isna(v):
                clean_row[k] = None
            else:
                clean_row[k] = v
                
        # Remove temporary dataframe calculation columns
        for c in ['visit_date_dt', 'actual_height_date', 'prev_actual_height_date', 'most_recent_earlier_height', 'most_recent_earlier_haz']:
            clean_row.pop(c, None)
            
        return clean_row

temporal_feature_service = TemporalFeatureService()
