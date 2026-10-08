import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, Tuple
from datetime import date
from .model_loader import artifact_loader

class WHOService:
    
    @staticmethod
    def calculate_zscore(x: float, l: float, m: float, s: float, is_weight: bool = False) -> float:
        if pd.isna(x) or pd.isna(l) or pd.isna(m) or pd.isna(s) or x <= 0 or m <= 0 or s <= 0:
            return np.nan
        if l != 0:
            z = (((x / m) ** l) - 1) / (l * s)
        else:
            z = np.log(x / m) / s
            
        if not is_weight:
            return z
            
        # WHO restricted tail handling for weight-based indicators
        if z > 3:
            if l != 0:
                sd3 = m * ((1 + l * s * 3) ** (1 / l))
                sd2 = m * ((1 + l * s * 2) ** (1 / l))
            else:
                sd3 = m * np.exp(3 * s)
                sd2 = m * np.exp(2 * s)
            sd23 = sd3 - sd2
            z = 3 + (x - sd3) / sd23
        elif z < -3:
            if l != 0:
                sd3neg = m * ((1 - l * s * 3) ** (1 / l))
                sd2neg = m * ((1 - l * s * 2) ** (1 / l))
            else:
                sd3neg = m * np.exp(-3 * s)
                sd2neg = m * np.exp(-2 * s)
            sd23neg = sd2neg - sd3neg
            z = -3 + (x - sd3neg) / sd23neg
            
        return z

    @staticmethod
    def _get_lms_for_age(age_days: float, ref_df: pd.DataFrame, has_day: bool) -> Tuple[float, float, float]:
        if has_day:
            # Exact match if possible
            match = ref_df[ref_df['age_days_ref'] == age_days]
            if not match.empty:
                row = match.iloc[0]
                return row['L'], row['M'], row['S']
            # Fallback for exact day lookup if somehow age_days is float and missing exact match, 
            # but WHO tables with Day usually cover 0-1856 days continuously.
            # If missing, we'll fall through to nearest.
        
        # Nearest match (equivalent to merge_asof direction='nearest')
        idx = (ref_df['age_days_ref'] - age_days).abs().idxmin()
        row = ref_df.loc[idx]
        return row['L'], row['M'], row['S']

    @classmethod
    def calculate_who_metrics(cls, sex: str, date_of_birth: date, visit_date: date, weight_kg: float, length_height_cm: Optional[float] = None) -> Dict[str, Any]:
        age_days = (visit_date - date_of_birth).days
        
        normalized_sex = str(sex).strip().lower()
        if normalized_sex not in ['male', 'm', 'female', 'f']:
            return {
                "age_days": age_days,
                "verified_waz": None,
                "verified_haz": None,
                "error": "Invalid sex"
            }
        
        is_male = normalized_sex in ['male', 'm']
        
        # Determine WFA reference
        wfa_ref = artifact_loader.get_who_wfa_boys() if is_male else artifact_loader.get_who_wfa_girls()
        has_day_wfa = 'Day' in artifact_loader._load_excel("data/external/WHO Standards/wfa_boys_0-to-5-years_zscores.xlsx").columns if is_male else 'Day' in artifact_loader._load_excel("data/external/WHO Standards/wfa_girls_0-to-5-years_zscores.xlsx").columns
        # Optimization: We know wfa_0-5 has Month, not Day (Wait, wfa_boys_0-to-5-years_zscores has Day? Actually, let's just inspect the dataframe from the loader since load_who_ref modifies it).
        # Actually in ArtifactLoader we just load the excel as is. We need to do the same preprocessing `load_who_ref` does to create `age_days_ref`.
        
        # We should just preprocess it once in the service or loader.
        return cls._calculate_with_dataframes(age_days, is_male, weight_kg, length_height_cm)
    
    @classmethod
    def _preprocess_ref(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, bool]:
        df = df.copy()
        df.columns = df.columns.str.strip()
        has_day = False
        if 'Day' in df.columns:
            df['age_days_ref'] = df['Day'].astype(float)
            has_day = True
        elif 'Month' in df.columns:
            df['age_days_ref'] = df['Month'].astype(float) * 30.4375
        else:
            raise ValueError("No Day or Month column")
        return df.dropna(subset=['L', 'M', 'S']), has_day

    @classmethod
    def _get_preprocessed_wfa(cls, is_male: bool) -> Tuple[pd.DataFrame, bool]:
        df = artifact_loader.get_who_wfa_boys() if is_male else artifact_loader.get_who_wfa_girls()
        return cls._preprocess_ref(df)

    @classmethod
    def _get_preprocessed_lhfa(cls, is_male: bool) -> Tuple[pd.DataFrame, bool]:
        df_02 = artifact_loader.get_who_lhfa_boys_0_2() if is_male else artifact_loader.get_who_lhfa_girls_0_2()
        df_25 = artifact_loader.get_who_lhfa_boys_2_5() if is_male else artifact_loader.get_who_lhfa_girls_2_5()
        
        p1, hd1 = cls._preprocess_ref(df_02)
        p2, hd2 = cls._preprocess_ref(df_25)
        
        p1 = p1[p1['age_days_ref'] <= 730]
        p2 = p2[p2['age_days_ref'] >= 731]
        
        combined = pd.concat([p1, p2], ignore_index=True)
        return combined, (hd1 and hd2)

    @classmethod
    def _calculate_with_dataframes(cls, age_days: float, is_male: bool, weight_kg: float, length_height_cm: Optional[float]) -> Dict[str, Any]:
        # WAZ
        wfa_ref, wfa_has_day = cls._get_preprocessed_wfa(is_male)
        l, m, s = cls._get_lms_for_age(float(age_days), wfa_ref, wfa_has_day)
        verified_waz = cls.calculate_zscore(weight_kg, l, m, s, is_weight=True)
        
        # HAZ
        verified_haz = np.nan
        if length_height_cm is not None and not pd.isna(length_height_cm) and length_height_cm > 0:
            lhfa_ref, lhfa_has_day = cls._get_preprocessed_lhfa(is_male)
            l_h, m_h, s_h = cls._get_lms_for_age(float(age_days), lhfa_ref, lhfa_has_day)
            verified_haz = cls.calculate_zscore(length_height_cm, l_h, m_h, s_h, is_weight=False)
            
        return {
            "age_days": age_days,
            "verified_waz": verified_waz if not pd.isna(verified_waz) else None,
            "verified_haz": verified_haz if not pd.isna(verified_haz) else None
        }

who_service = WHOService()
