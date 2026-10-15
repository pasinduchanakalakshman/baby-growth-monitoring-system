import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional

from .model_loader import artifact_loader

MASK_VALUE = -999.0
MAX_SEQUENCE_LENGTH = 20
N_TRANSFORMED_FEATURES = 49

class SequenceService:
    def prepare_sequence_tensor(
        self,
        history: List[Dict[str, Any]],
        index_visit_date: Optional[str] = None
    ) -> np.ndarray:
        """
        Builds a left-padded (1, 20, 49) float32 numpy tensor strictly following
        the frozen research pipeline (build_sequences.py).

        1. Filter visits strictly at or before index_visit_date (no future leakage).
        2. Sort chronologically.
        3. Compute temporal signals across all child visits up to the index encounter.
        4. Extract the exact 38 sequence features matching sequence_feature_schema_v1.json.
        5. Transform rows using frozen sequence_preprocessor_v1.joblib -> shape (n_hist, 49).
        6. Truncate to most recent 20 encounters if n_hist > 20.
        7. Left-pad with MASK_VALUE (-999.0) if n_hist < 20 -> shape (1, 20, 49).
        """
        if not history:
            raise ValueError("Cannot prepare sequence tensor from empty visit history.")

        # Point-in-time safety: filter out any encounters after index date
        if index_visit_date is not None:
            cutoff = pd.to_datetime(index_visit_date)
            valid_visits = [v for v in history if pd.to_datetime(v.get("visit_date")) <= cutoff]
        else:
            valid_visits = list(history)

        if not valid_visits:
            raise ValueError("No visits available at or prior to index visit date.")

        df = pd.DataFrame(valid_visits)

        # Ensure numeric core fields
        for col in ['weight_kg', 'verified_waz', 'length_height_cm', 'verified_haz']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            else:
                df[col] = np.nan

        df['visit_date_dt'] = pd.to_datetime(df['visit_date'])
        df = df.sort_values('visit_date_dt').reset_index(drop=True)

        # Derive longitudinal features matching research temporal feature generation
        df['observation_count'] = np.arange(1, len(df) + 1)
        df['days_since_previous_visit'] = df['visit_date_dt'].diff().dt.days
        df['weight_change_kg'] = df['weight_kg'].diff()
        df['waz_change'] = df['verified_waz'].diff()

        df['weight_velocity_kg_per_day'] = np.where(
            df['days_since_previous_visit'] > 0,
            df['weight_change_kg'] / df['days_since_previous_visit'],
            np.nan
        )
        df['weight_velocity_kg_per_30d'] = df['weight_velocity_kg_per_day'] * 30

        df['waz_velocity_per_day'] = np.where(
            df['days_since_previous_visit'] > 0,
            df['waz_change'] / df['days_since_previous_visit'],
            np.nan
        )
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

        df['height_change_cm'] = np.where(
            height_mask & df['most_recent_earlier_height'].notna(),
            df['length_height_cm'] - df['most_recent_earlier_height'],
            np.nan
        )
        df['haz_change'] = np.where(
            height_mask & df['most_recent_earlier_haz'].notna(),
            df['verified_haz'] - df['most_recent_earlier_haz'],
            np.nan
        )

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

        # Load schema and preprocessor
        schema = artifact_loader.get_sequence_schema()
        preprocessor = artifact_loader.get_sequence_preprocessor()

        numeric_cols = schema.get("numeric_features", [])
        boolean_cols = schema.get("boolean_features", [])
        categorical_cols = schema.get("categorical_features", [])
        all_seq_cols = numeric_cols + boolean_cols + categorical_cols

        # Ensure all columns exist and formats match SimpleImputer expectations
        for col in all_seq_cols:
            if col not in df.columns:
                df[col] = np.nan

        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        for col in boolean_cols:
            df[col] = df[col].apply(
                lambda x: 1.0 if x is True else (0.0 if x is False else (float(x) if pd.notna(x) else np.nan))
            )

        for col in categorical_cols:
            df[col] = df[col].apply(lambda x: str(x) if pd.notna(x) and x is not None else np.nan)

        raw_features = df[all_seq_cols]
        transformed = preprocessor.transform(raw_features)

        n_hist = len(transformed)
        if n_hist > MAX_SEQUENCE_LENGTH:
            transformed = transformed[-MAX_SEQUENCE_LENGTH:]
            n_hist = MAX_SEQUENCE_LENGTH

        n_pad = MAX_SEQUENCE_LENGTH - n_hist
        pad_rows = np.full((n_pad, N_TRANSFORMED_FEATURES), MASK_VALUE, dtype=np.float32)

        if n_hist > 0:
            seq = np.vstack([pad_rows, transformed.astype(np.float32)])
        else:
            seq = pad_rows

        tensor = np.expand_dims(seq, axis=0)

        if tensor.shape != (1, MAX_SEQUENCE_LENGTH, N_TRANSFORMED_FEATURES):
            raise ValueError(f"Unexpected tensor shape {tensor.shape}, expected (1, 20, 49)")

        # Verify no un-imputed NaNs in transformed valid rows
        if np.isnan(seq[n_pad:]).any():
            raise ValueError("Transformed sequence contains un-imputed NaN values.")

        return tensor

sequence_service = SequenceService()
