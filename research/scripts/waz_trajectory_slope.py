"""
WAZ Trajectory Slope Feature Module (Task 3.4B)
==============================================
Project: Baby-growth-monitoring-system
Approved Design: research/evaluation/temporal_feature_experiment_design_v1.json

This module implements `waz_trajectory_slope_3v` as a reusable, point-in-time-safe,
leak-free feature function.

Mathematical Specification:
---------------------------
Ordinary Least Squares (OLS) linear slope of WHO Weight-for-Age Z-score (verified_waz)
over the child's last 3 observed clinic visits (terminal point at visit t plus up to 2
distinct prior visits on strictly earlier dates), scaled to a 30-day standardized rate:

    beta_daily = Sum((d_i - mean_d) * (z_i - mean_z)) / Sum((d_i - mean_d)^2)
    waz_trajectory_slope_3v = beta_daily * 30.0   [WAZ units / 30 days]

Methodological Safeguards Enforced:
-----------------------------------
1. Zero Intraday Precedence:
   Historical observations must have strictly earlier calendar visit_date AND strictly
   younger age_days than the index observation. No same-day record may ever be used as
   a lagged baseline or historical evidence for another same-day record.
2. Deterministic Missing-Value Policy:
   - Fewer than 2 valid (age, WAZ) pairs: returns np.nan.
   - Missing or unparseable visit_date or age_days: rejected from window.
   - Age variance < 1e-6 (e.g. duplicate dates / zero variance): returns np.nan.
   - No median imputation is performed inside this module; missing values remain np.nan.
3. Target Isolation:
   Only inputs (child_id, visit_date, age_days, verified_waz) are accessed. Future
   growth-faltering labels or prediction targets are never referenced.
"""

import numpy as np
import pandas as pd


def compute_ols_slope_30d(age_days: np.ndarray, waz_values: np.ndarray) -> float:
    """
    Compute OLS linear slope across points (age_days, waz_values) scaled to 30 days.

    Parameters:
        age_days: 1D array of ages in days (must have len >= 2).
        waz_values: 1D array of verified WAZ values corresponding to age_days.

    Returns:
        float: Rate of WAZ change in WAZ units per 30 days, or np.nan if undefined.
    """
    if len(age_days) < 2 or len(waz_values) < 2 or len(age_days) != len(waz_values):
        return np.nan

    d = np.asarray(age_days, dtype=np.float64)
    z = np.asarray(waz_values, dtype=np.float64)

    # Filter any internal NaNs
    valid_mask = (~np.isnan(d)) & (~np.isnan(z))
    d = d[valid_mask]
    z = z[valid_mask]

    if len(d) < 2:
        return np.nan

    d_mean = np.mean(d)
    z_mean = np.mean(z)

    d_diff = d - d_mean
    z_diff = z - z_mean

    s_dd = np.sum(d_diff * d_diff)
    if s_dd < 1e-6:
        # Zero or near-zero variance in age (e.g. identical recorded ages)
        return np.nan

    s_dz = np.sum(d_diff * z_diff)
    beta_daily = s_dz / s_dd
    slope_30d = beta_daily * 30.0

    return float(slope_30d)


def calculate_waz_trajectory_slope_series(
    df: pd.DataFrame,
    child_id_col: str = 'child_id',
    visit_date_col: str = 'visit_date',
    age_days_col: str = 'age_days',
    waz_col: str = 'verified_waz'
) -> pd.Series:
    """
    Calculate the waz_trajectory_slope_3v feature for each observation in df.

    Enforces point-in-time safety and zero-intraday precedence. Preserves the
    exact original index of df.

    Parameters:
        df: Input DataFrame containing child growth records.
        child_id_col: Name of child identifier column.
        visit_date_col: Name of clinic visit date column (string or datetime).
        age_days_col: Name of child age in days column.
        waz_col: Name of WHO Weight-for-Age Z-score column.

    Returns:
        pd.Series: waz_trajectory_slope_3v indexed identically to df.index.
    """
    if df.empty:
        return pd.Series(dtype=np.float64, index=df.index, name='waz_trajectory_slope_3v')

    # Work with a minimal internal dataframe to ensure target isolation
    work_df = pd.DataFrame(index=df.index)
    work_df['child_id'] = df[child_id_col].astype(str)
    work_df['visit_date_dt'] = pd.to_datetime(df[visit_date_col], errors='coerce', format='mixed')
    work_df['age_days'] = pd.to_numeric(df[age_days_col], errors='coerce')
    work_df['waz'] = pd.to_numeric(df[waz_col], errors='coerce')
    work_df['orig_idx'] = df.index

    out_dict = {}

    # Group by child_id
    for _, child_group in work_df.groupby('child_id', sort=False):
        valid_records = child_group[
            child_group['visit_date_dt'].notna() &
            child_group['age_days'].notna() &
            child_group['waz'].notna()
        ]

        if valid_records.empty:
            continue

        # Sort strictly earlier historical candidates chronologically
        sorted_valid = valid_records.sort_values(by=['visit_date_dt', 'age_days'], ascending=[True, True])

        # Aggregate by distinct date once per child (mean WAZ and mean age for same-day encounters)
        date_agg = (
            sorted_valid.groupby('visit_date_dt', as_index=False)
            .agg({'age_days': 'mean', 'waz': 'mean'})
            .sort_values(by='visit_date_dt', ascending=True)
        )
        date_history = date_agg.to_dict('records')

        for curr_orig_idx, curr_row in child_group.iterrows():
            curr_date = curr_row['visit_date_dt']
            curr_age = curr_row['age_days']
            curr_waz = curr_row['waz']

            # If current observation is missing essential values -> np.nan
            if pd.isna(curr_date) or pd.isna(curr_age) or pd.isna(curr_waz):
                out_dict[curr_orig_idx] = np.nan
                continue

            # Zero Intraday Precedence Rule:
            # Historical candidates must have strictly earlier visit_date AND strictly younger age_days.
            # Same-day records or non-positive intervals (delta_t <= 0) are strictly excluded.
            eligible_priors = [
                r for r in date_history
                if r['visit_date_dt'] < curr_date and r['age_days'] < curr_age
            ]

            if not eligible_priors:
                # First visit or no valid strictly earlier history -> np.nan
                out_dict[curr_orig_idx] = np.nan
                continue

            # Take up to 2 most recent prior distinct dates
            recent_priors = eligible_priors[-2:]

            history_ages = [r['age_days'] for r in recent_priors] + [curr_age]
            history_wazs = [r['waz'] for r in recent_priors] + [curr_waz]

            slope_val = compute_ols_slope_30d(np.array(history_ages), np.array(history_wazs))
            out_dict[curr_orig_idx] = slope_val

    results = pd.Series(out_dict, dtype=np.float64, name='waz_trajectory_slope_3v')
    return results.reindex(df.index)


def add_waz_trajectory_slope_feature(
    df: pd.DataFrame,
    child_id_col: str = 'child_id',
    visit_date_col: str = 'visit_date',
    age_days_col: str = 'age_days',
    waz_col: str = 'verified_waz',
    output_col: str = 'waz_trajectory_slope_3v'
) -> pd.DataFrame:
    """
    Append waz_trajectory_slope_3v as a new column to a copy of df.

    Parameters:
        df: Input DataFrame.
        child_id_col: Name of child ID column.
        visit_date_col: Name of visit date column.
        age_days_col: Name of age in days column.
        waz_col: Name of verified WAZ column.
        output_col: Name of output feature column.

    Returns:
        pd.DataFrame: Copy of df with output_col added.
    """
    out_df = df.copy()
    slope_series = calculate_waz_trajectory_slope_series(
        out_df,
        child_id_col=child_id_col,
        visit_date_col=visit_date_col,
        age_days_col=age_days_col,
        waz_col=waz_col
    )
    out_df[output_col] = slope_series
    return out_df
