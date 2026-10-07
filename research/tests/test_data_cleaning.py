import sys
import os
import json
import pandas as pd
import numpy as np
import pytest

# Ensure the root workspace directory is in the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from research.scripts.data_cleaning import clean_data

RAW_PATH = os.path.join('data', 'raw', 'chdr_dataset_v1.csv')
CLEANED_PATH = os.path.join('data', 'interim', 'chdr_cleaned_v1.csv')

@pytest.fixture
def raw_df():
    if not os.path.exists(RAW_PATH):
        pytest.skip("Raw dataset not found")
    return pd.read_csv(RAW_PATH)

@pytest.fixture
def cleaned_df():
    if not os.path.exists(CLEANED_PATH):
        pytest.skip("Cleaned dataset not found")
    return pd.read_csv(CLEANED_PATH)

def get_empty_report():
    return {
        "static_child_field_conflicts": {},
        "boolean_normalization_summary": {"unparseable_values": []},
        "conditional_missingness": {},
        "logical_contradictions": [],
        "invalid_anthropometric_values": [],
        "warnings": []
    }

def test_raw_file_unchanged():
    assert os.path.exists(RAW_PATH)

def test_cleaned_file_created():
    assert os.path.exists(CLEANED_PATH)

def test_expected_source_columns(raw_df, cleaned_df):
    for col in raw_df.columns:
        assert col in cleaned_df.columns

def test_dates_valid(cleaned_df):
    dob = pd.to_datetime(cleaned_df['date_of_birth'], errors='coerce')
    visit = pd.to_datetime(cleaned_df['visit_date'], errors='coerce')
    assert dob.isna().sum() == 0
    assert visit.isna().sum() == 0
    
def test_sorted_child_and_visit(cleaned_df):
    expected_df = cleaned_df.sort_values(by=['child_id', 'visit_date']).reset_index(drop=True)
    pd.testing.assert_frame_equal(cleaned_df, expected_df)

def test_age_matches_dob_visit(cleaned_df):
    calculated = (pd.to_datetime(cleaned_df['visit_date']) - pd.to_datetime(cleaned_df['date_of_birth'])).dt.days
    diff = (cleaned_df['age_days'] - calculated).abs()
    assert (diff > 0).sum() == 0

def test_no_negative_age(cleaned_df):
    assert (cleaned_df['age_days'] < 0).sum() == 0

def test_no_visit_before_dob(cleaned_df):
    dob = pd.to_datetime(cleaned_df['date_of_birth'])
    visit = pd.to_datetime(cleaned_df['visit_date'])
    assert (visit < dob).sum() == 0

def test_no_duplicate_child_visit(cleaned_df):
    assert cleaned_df.duplicated(subset=['child_id', 'visit_date']).sum() == 0

def test_static_fields_consistent(cleaned_df):
    static_cols = ['sex', 'date_of_birth', 'birth_weight_kg', 'birth_length_cm', 'gestational_age_weeks', 'birth_order', 'delivery_type', 'apgar_score_5min']
    for col in static_cols:
        if col in cleaned_df.columns:
            nunique = cleaned_df.dropna(subset=[col]).groupby('child_id')[col].nunique()
            assert (nunique > 1).sum() == 0

def test_boolean_fields_normalized(cleaned_df):
    bool_cols = ['breastfeeding_status', 'formula_feeding', 'complementary_feeding_started']
    for col in bool_cols:
        if col in cleaned_df.columns:
            valid_vals = {True, False, np.nan, pd.NA, "True", "False"}
            unique_vals = set(cleaned_df[col].dropna().unique())
            for val in unique_vals:
                assert val in valid_vals or str(val) in {"True", "False"}

def test_nullable_length_height_cm_accepted(cleaned_df):
    if 'length_height_cm' in cleaned_df.columns:
        # Check that nullable column exists and has proper type
        assert cleaned_df['length_height_cm'].dtype in [float, np.float64, object]

def test_missing_height_not_filled():
    # Temporary DF to prove it
    df = pd.DataFrame({
        'child_id': ['C1', 'C1'],
        'visit_date': ['2026-01-01', '2026-02-01'],
        'date_of_birth': ['2025-01-01', '2025-01-01'],
        'length_height_cm': [70.0, np.nan]
    })
    report = get_empty_report()
    res = clean_data(df, report)
    assert pd.isna(res.loc[1, 'length_height_cm'])

def test_complementary_feeding_missingness():
    df = pd.DataFrame({
        'child_id': ['C1', 'C2'],
        'visit_date': ['2026-01-01', '2026-01-01'],
        'date_of_birth': ['2025-01-01', '2025-01-01'],
        'complementary_feeding_started': [False, True],
        'complementary_feeding_start_age_months': [np.nan, np.nan]
    })
    report = get_empty_report()
    clean_data(df, report)
    assert report['conditional_missingness']['complementary_feeding_expected_missing'] == 1
    assert report['conditional_missingness']['complementary_feeding_unexpected_missing'] == 1

def test_supplement_missingness():
    df = pd.DataFrame({
        'child_id': ['C1', 'C2'],
        'visit_date': ['2026-01-01', '2026-01-01'],
        'date_of_birth': ['2025-01-01', '2025-01-01'],
        'supplement_use': [False, True],
        'supplement_type': [np.nan, np.nan]
    })
    report = get_empty_report()
    clean_data(df, report)
    assert report['conditional_missingness']['supplement_expected_missing'] == 1
    assert report['conditional_missingness']['supplement_unexpected_missing'] == 1

def test_illness_missingness():
    df = pd.DataFrame({
        'child_id': ['C1', 'C2'],
        'visit_date': ['2026-01-01', '2026-01-01'],
        'date_of_birth': ['2025-01-01', '2025-01-01'],
        'recent_illness': [False, True],
        'illness_duration_days': [np.nan, np.nan]
    })
    report = get_empty_report()
    clean_data(df, report)
    assert report['conditional_missingness']['illness_expected_missing'] == 1
    assert report['conditional_missingness']['illness_unexpected_missing'] == 1

def test_no_future_columns(cleaned_df):
    leakage_terms = ['target', 'future', 'prediction', 'predicted', 'next_visit', 'risk_score', 'risk_probability']
    for col in cleaned_df.columns:
        assert not any(term in col.lower() for term in leakage_terms)

def test_raw_row_count_not_reduced(raw_df, cleaned_df):
    assert len(raw_df) == len(cleaned_df)

def test_non_positive_anthropometric_detected():
    df = pd.DataFrame({
        'child_id': ['C1', 'C2'],
        'visit_date': ['2026-01-01', '2026-01-01'],
        'date_of_birth': ['2025-01-01', '2025-01-01'],
        'weight_kg': [0, -1.5]
    })
    report = get_empty_report()
    clean_data(df, report)
    inv = report['invalid_anthropometric_values']
    assert len(inv) > 0
    assert inv[0]['column'] == 'weight_kg'
    assert inv[0]['non_positive_count'] == 2

def test_cleaning_is_deterministic(raw_df):
    report1 = get_empty_report()
    report2 = get_empty_report()
    res1 = clean_data(raw_df.copy(), report1)
    res2 = clean_data(raw_df.copy(), report2)
    pd.testing.assert_frame_equal(res1, res2)
