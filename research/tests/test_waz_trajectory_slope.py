"""
Unit Tests for WAZ Trajectory Slope Feature (Task 3.4B)
======================================================
Project: Baby-growth-monitoring-system
Target Module: research.scripts.waz_trajectory_slope
"""

import os
import sys
import numpy as np
import pandas as pd
import pytest

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from research.scripts.waz_trajectory_slope import (
    compute_ols_slope_30d,
    calculate_waz_trajectory_slope_series,
    add_waz_trajectory_slope_feature
)


# ---------------------------------------------------------------------------
# Test 1: Clearly Falling WAZ Trajectory
# ---------------------------------------------------------------------------
def test_clearly_falling_trajectory():
    """Verify negative slope when WAZ is steadily declining."""
    # 3 visits spaced 30 days apart, declining by 0.4 WAZ each time:
    # d = [30, 60, 90], z = [0.0, -0.4, -0.8] -> slope = -0.4 WAZ / 30d
    df = pd.DataFrame({
        'child_id': ['CH001', 'CH001', 'CH001'],
        'visit_date': ['2023-01-01', '2023-01-31', '2023-03-02'],
        'age_days': [30, 60, 90],
        'verified_waz': [0.0, -0.4, -0.8]
    })
    slopes = calculate_waz_trajectory_slope_series(df)

    assert np.isnan(slopes.iloc[0])  # Visit 1: single visit -> NaN
    assert np.isclose(slopes.iloc[1], -0.4, atol=1e-5)  # Visit 2: 2-point slope (-0.4 in 30d)
    assert np.isclose(slopes.iloc[2], -0.4, atol=1e-5)  # Visit 3: 3-point OLS slope (-0.4 / 30d)
    assert slopes.iloc[2] < 0.0


# ---------------------------------------------------------------------------
# Test 2: Clearly Rising WAZ Trajectory
# ---------------------------------------------------------------------------
def test_clearly_rising_trajectory():
    """Verify positive slope when WAZ is steadily recovering."""
    # d = [30, 60, 90], z = [-1.0, -0.5, 0.0] -> slope = +0.5 WAZ / 30d
    df = pd.DataFrame({
        'child_id': ['CH002', 'CH002', 'CH002'],
        'visit_date': ['2023-01-01', '2023-01-31', '2023-03-02'],
        'age_days': [30, 60, 90],
        'verified_waz': [-1.0, -0.5, 0.0]
    })
    slopes = calculate_waz_trajectory_slope_series(df)

    assert np.isnan(slopes.iloc[0])
    assert np.isclose(slopes.iloc[1], 0.5, atol=1e-5)
    assert np.isclose(slopes.iloc[2], 0.5, atol=1e-5)
    assert slopes.iloc[2] > 0.0


# ---------------------------------------------------------------------------
# Test 3: Irregular Visit Intervals
# ---------------------------------------------------------------------------
def test_irregular_visit_intervals():
    """Verify that OLS slope correctly uses actual age_days elapsed rather than visit index."""
    # Visit 1: age 30, WAZ 1.0
    # Visit 2: age 75 (45d elapsed), WAZ 0.5
    # Visit 3: age 165 (90d elapsed), WAZ 0.0
    # Analytical OLS check:
    # d = [30, 75, 165], mean_d = 90, d_diff = [-60, -15, 75], S_dd = 3600 + 225 + 5625 = 9450
    # z = [1.0, 0.5, 0.0], mean_z = 0.5, z_diff = [0.5, 0.0, -0.5], S_dz = -30 + 0 - 37.5 = -67.5
    # beta_daily = -67.5 / 9450 = -1/140 = -0.007142857
    # beta_30d = beta_daily * 30 = -30 / 140 = -3/14 ≈ -0.2142857 WAZ / 30d
    df = pd.DataFrame({
        'child_id': ['CH003', 'CH003', 'CH003'],
        'visit_date': ['2023-01-01', '2023-02-15', '2023-05-16'],
        'age_days': [30, 75, 165],
        'verified_waz': [1.0, 0.5, 0.0]
    })
    slopes = calculate_waz_trajectory_slope_series(df)

    expected_slope_v3 = (-3.0 / 14.0)
    assert np.isclose(slopes.iloc[2], expected_slope_v3, atol=1e-5)


# ---------------------------------------------------------------------------
# Test 4: Only One Historical Visit
# ---------------------------------------------------------------------------
def test_only_one_historical_visit_returns_nan():
    """Verify that any visit without at least 1 strictly earlier valid visit returns NaN."""
    df = pd.DataFrame({
        'child_id': ['CH004'],
        'visit_date': ['2023-01-01'],
        'age_days': [45],
        'verified_waz': [-0.5]
    })
    slopes = calculate_waz_trajectory_slope_series(df)
    assert len(slopes) == 1
    assert np.isnan(slopes.iloc[0])


# ---------------------------------------------------------------------------
# Test 5: Missing WAZ Handling
# ---------------------------------------------------------------------------
def test_missing_waz_handling():
    """Verify robust handling of NaN values in WAZ."""
    # Child with missing WAZ at visit 2:
    # Visit 1: age 30, waz 0.0
    # Visit 2: age 60, waz NaN
    # Visit 3: age 90, waz -0.6
    # Visit 2 dropped -> 2 points remain: (30, 0.0) and (90, -0.6)
    # Expected slope at visit 3 = (-0.6 - 0.0) / (90 - 30) * 30 = -0.3 WAZ / 30d
    df = pd.DataFrame({
        'child_id': ['CH005', 'CH005', 'CH005'],
        'visit_date': ['2023-01-01', '2023-01-31', '2023-03-02'],
        'age_days': [30, 60, 90],
        'verified_waz': [0.0, np.nan, -0.6]
    })
    slopes = calculate_waz_trajectory_slope_series(df)

    assert np.isnan(slopes.iloc[0])  # Visit 1: single point -> NaN
    assert np.isnan(slopes.iloc[1])  # Visit 2: current WAZ is NaN -> NaN
    assert np.isclose(slopes.iloc[2], -0.3, atol=1e-5)  # Visit 3: uses visits 1 & 3

    # Child where both historical visits are NaN -> only 1 valid point remains -> NaN
    df_missing_all_prior = pd.DataFrame({
        'child_id': ['CH005B', 'CH005B', 'CH005B'],
        'visit_date': ['2023-01-01', '2023-01-31', '2023-03-02'],
        'age_days': [30, 60, 90],
        'verified_waz': [np.nan, np.nan, -0.6]
    })
    slopes_all_prior_nan = calculate_waz_trajectory_slope_series(df_missing_all_prior)
    assert np.isnan(slopes_all_prior_nan.iloc[2])


# ---------------------------------------------------------------------------
# Test 6: Duplicate Same-Day Visits & Zero Intraday Precedence
# ---------------------------------------------------------------------------
def test_duplicate_sameday_visits_zero_intraday_precedence():
    """Verify that multiple visits on the same calendar date do NOT use each other as history."""
    # Child has Visit 1 on Jan 1.
    # On Feb 1, child has TWO measurements (e.g. clinic nurse re-weighed child).
    # Visit 2A: age 61, WAZ 0.2
    # Visit 2B: age 61, WAZ 0.1
    df = pd.DataFrame({
        'child_id': ['CH006', 'CH006', 'CH006'],
        'visit_date': ['2023-01-01', '2023-02-01', '2023-02-01'],
        'age_days': [30, 61, 61],
        'verified_waz': [0.5, 0.2, 0.1]
    })

    slopes = calculate_waz_trajectory_slope_series(df)

    # Visit 1 has no strictly earlier visits -> NaN
    assert np.isnan(slopes.iloc[0])

    # Visit 2A must use ONLY Visit 1 (Jan 1) as history, NOT Visit 2B!
    # Interval = 61 - 30 = 31 days. Delta WAZ = 0.2 - 0.5 = -0.3.
    # Expected slope 2A = (-0.3 / 31) * 30 ≈ -0.2903225
    expected_slope_2a = (-0.3 / 31.0) * 30.0
    assert np.isclose(slopes.iloc[1], expected_slope_2a, atol=1e-5)

    # Visit 2B must also use ONLY Visit 1 (Jan 1) as history, NOT Visit 2A!
    # Interval = 61 - 30 = 31 days. Delta WAZ = 0.1 - 0.5 = -0.4.
    # Expected slope 2B = (-0.4 / 31) * 30 ≈ -0.3870967
    expected_slope_2b = (-0.4 / 31.0) * 30.0
    assert np.isclose(slopes.iloc[2], expected_slope_2b, atol=1e-5)

    # Invariance to row order: shuffle rows 1 and 2, verify exact same outputs
    df_shuffled = df.iloc[[0, 2, 1]].copy()
    slopes_shuffled = calculate_waz_trajectory_slope_series(df_shuffled)
    assert np.isclose(slopes_shuffled.loc[1], expected_slope_2a, atol=1e-5)
    assert np.isclose(slopes_shuffled.loc[2], expected_slope_2b, atol=1e-5)


# ---------------------------------------------------------------------------
# Test 7: Invalid Dates and Zero-Length Intervals
# ---------------------------------------------------------------------------
def test_invalid_dates_and_zero_length_intervals():
    """Verify that unparseable dates or non-positive intervals are rejected from history."""
    df = pd.DataFrame({
        'child_id': ['CH007', 'CH007', 'CH007'],
        'visit_date': ['not-a-date', '2023-02-01', '2023-03-01'],
        'age_days': [np.nan, 60, 90],
        'verified_waz': [0.5, 0.2, -0.1]
    })
    slopes = calculate_waz_trajectory_slope_series(df)

    # Visit 1 has corrupt date -> NaN
    assert np.isnan(slopes.iloc[0])
    # Visit 2 cannot use Visit 1 (corrupt) -> single valid visit -> NaN
    assert np.isnan(slopes.iloc[1])
    # Visit 3 can use Visit 2 (both valid) -> 2 points: (60, 0.2) and (90, -0.1)
    expected_slope_v3 = (-0.3 / 30.0) * 30.0  # -0.3
    assert np.isclose(slopes.iloc[2], expected_slope_v3, atol=1e-5)

    # Zero age variance test: two points with identical age in days
    df_zero_var = pd.DataFrame({
        'child_id': ['CH007B', 'CH007B'],
        'visit_date': ['2023-01-01', '2023-02-01'],
        'age_days': [60, 60],  # recorded age didn't advance
        'verified_waz': [0.5, 0.2]
    })
    slopes_zero_var = calculate_waz_trajectory_slope_series(df_zero_var)
    # Zero age variance -> undefined slope -> NaN
    assert np.isnan(slopes_zero_var.iloc[1])


# ---------------------------------------------------------------------------
# Test 8: Future Information Isolation
# ---------------------------------------------------------------------------
def test_future_information_isolation():
    """Verify that adding a future visit does NOT alter the slope computed at earlier visits."""
    df_past = pd.DataFrame({
        'child_id': ['CH008', 'CH008', 'CH008'],
        'visit_date': ['2023-01-01', '2023-01-31', '2023-03-02'],
        'age_days': [30, 60, 90],
        'verified_waz': [0.0, -0.3, -0.6]
    })
    slopes_past = calculate_waz_trajectory_slope_series(df_past)

    # Add a 4th future visit with an extreme drop (growth faltering shock)
    df_future = pd.concat([
        df_past,
        pd.DataFrame({
            'child_id': ['CH008'],
            'visit_date': ['2023-04-01'],
            'age_days': [120],
            'verified_waz': [-2.5]
        })
    ], ignore_index=True)
    slopes_future = calculate_waz_trajectory_slope_series(df_future)

    # The slopes at visits 0, 1, and 2 must be IDENTICAL before and after adding visit 3
    assert np.isnan(slopes_past.iloc[0]) and np.isnan(slopes_future.iloc[0])
    assert np.isclose(slopes_past.iloc[1], slopes_future.iloc[1], atol=1e-10)
    assert np.isclose(slopes_past.iloc[2], slopes_future.iloc[2], atol=1e-10)


# ---------------------------------------------------------------------------
# Test 9: Child ID Independence
# ---------------------------------------------------------------------------
def test_child_id_independence():
    """Verify that observations from different children never cross-contaminate slopes."""
    # Child A is steadily declining
    df_a = pd.DataFrame({
        'child_id': ['CH009_A', 'CH009_A', 'CH009_A'],
        'visit_date': ['2023-01-01', '2023-01-31', '2023-03-02'],
        'age_days': [30, 60, 90],
        'verified_waz': [0.5, 0.1, -0.3]
    })
    # Child B is steadily gaining
    df_b = pd.DataFrame({
        'child_id': ['CH009_B', 'CH009_B', 'CH009_B'],
        'visit_date': ['2023-01-01', '2023-01-31', '2023-03-02'],
        'age_days': [30, 60, 90],
        'verified_waz': [-1.5, -1.0, -0.5]
    })

    slopes_a_alone = calculate_waz_trajectory_slope_series(df_a)
    slopes_b_alone = calculate_waz_trajectory_slope_series(df_b)

    # Interleave Child A and Child B rows with unique index
    df_combined = pd.concat([df_a, df_b], ignore_index=True).sample(frac=1.0, random_state=42)
    slopes_combined = calculate_waz_trajectory_slope_series(df_combined)

    # Verify Child A and Child B results match their standalone computations exactly
    # For Child A
    a_rows = df_combined[df_combined['child_id'] == 'CH009_A'].sort_values('visit_date')
    slopes_a_extracted = slopes_combined.loc[a_rows.index].values
    for val_alone, val_comb in zip(slopes_a_alone.values, slopes_a_extracted):
        if np.isnan(val_alone):
            assert np.isnan(val_comb)
        else:
            assert np.isclose(val_alone, val_comb, atol=1e-10)

    # For Child B
    b_rows = df_combined[df_combined['child_id'] == 'CH009_B'].sort_values('visit_date')
    slopes_b_extracted = slopes_combined.loc[b_rows.index].values
    for val_alone, val_comb in zip(slopes_b_alone.values, slopes_b_extracted):
        if np.isnan(val_alone):
            assert np.isnan(val_comb)
        else:
            assert np.isclose(val_alone, val_comb, atol=1e-10)


# ---------------------------------------------------------------------------
# Test 10: Prefix-Invariance Test
# ---------------------------------------------------------------------------
def test_prefix_invariance():
    """
    Computing the feature using a child's history up to visit t must give
    the exact same result as computing it using the full history, then selecting visit t.
    """
    # 6 visits for a child over 6 months
    df_full = pd.DataFrame({
        'child_id': ['CH010'] * 6,
        'visit_date': [
            '2023-01-01', '2023-02-01', '2023-03-03',
            '2023-04-05', '2023-05-08', '2023-06-10'
        ],
        'age_days': [30, 61, 91, 124, 157, 190],
        'verified_waz': [0.2, 0.1, -0.1, -0.4, -0.7, -1.0]
    })

    # Slope computed on the full 6-visit history
    slopes_full = calculate_waz_trajectory_slope_series(df_full)

    # For each prefix t in 1..6:
    for t in range(1, len(df_full) + 1):
        df_prefix = df_full.iloc[:t].copy()
        slopes_prefix = calculate_waz_trajectory_slope_series(df_prefix)

        # The slope at index t-1 in prefix must match the slope at index t-1 in full
        val_prefix = slopes_prefix.iloc[-1]
        val_full = slopes_full.iloc[t - 1]

        if np.isnan(val_prefix):
            assert np.isnan(val_full), f"Mismatch at prefix t={t}: prefix was NaN but full was {val_full}"
        else:
            assert np.isclose(val_prefix, val_full, atol=1e-10), (
                f"Mismatch at prefix t={t}: prefix={val_prefix} vs full={val_full}"
            )


# ---------------------------------------------------------------------------
# Test 11: Wrapper Function API
# ---------------------------------------------------------------------------
def test_add_waz_trajectory_slope_feature_wrapper():
    """Verify add_waz_trajectory_slope_feature returns a dataframe with the new column."""
    df = pd.DataFrame({
        'child_id': ['CH011', 'CH011'],
        'visit_date': ['2023-01-01', '2023-01-31'],
        'age_days': [30, 60],
        'verified_waz': [0.0, -0.3]
    })
    out_df = add_waz_trajectory_slope_feature(df)

    assert 'waz_trajectory_slope_3v' in out_df.columns
    assert len(out_df) == len(df)
    assert np.isnan(out_df['waz_trajectory_slope_3v'].iloc[0])
    assert np.isclose(out_df['waz_trajectory_slope_3v'].iloc[1], -0.3, atol=1e-5)
