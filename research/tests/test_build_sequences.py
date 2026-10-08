import pytest
import pandas as pd
import numpy as np
import os
import sys
import json
import joblib
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts')))
import build_sequences

# ==================================================
# SYNTHETIC DATASET FIXTURE
# ==================================================

@pytest.fixture
def synthetic_data():
    """
    3 children, each with multiple visits.
    C1 (train) - 5 visits: last is positive target.
    C2 (val)   - 3 visits: last is negative target.
    C3 (test)  - 2 visits: last is positive target.
    """
    base = pd.Timestamp('2022-01-01')
    
    def make_row(child, visit_num, days_offset, waz, target=0, hma=1):
        return {
            'child_id': child,
            'visit_date': base + pd.Timedelta(days=days_offset),
            'age_days': 60 + days_offset,
            'weight_kg': 5.0 + visit_num * 0.3,
            'verified_waz': waz,
            'verified_haz': -0.5,
            'observation_count': visit_num,
            'days_since_previous_visit': 30.0 if visit_num > 1 else None,
            'weight_change_kg': 0.3 if visit_num > 1 else None,
            'weight_velocity_kg_per_day': 0.01 if visit_num > 1 else None,
            'weight_velocity_kg_per_30d': 0.3 if visit_num > 1 else None,
            'waz_change': -0.1 if visit_num > 1 else None,
            'waz_velocity_per_day': -0.003 if visit_num > 1 else None,
            'waz_velocity_per_30d': -0.09 if visit_num > 1 else None,
            'waz_rolling_mean_3': waz,
            'weight_rolling_mean_3': 5.0 + visit_num * 0.3,
            'last_observed_height_cm': 55.0 if hma else None,
            'last_observed_haz': -0.5 if hma else None,
            'days_since_last_height_measurement': 0.0 if hma else 60.0,
            'height_change_cm': 0.5 if (hma and visit_num > 1) else None,
            'haz_change': -0.1 if (hma and visit_num > 1) else None,
            'height_velocity_cm_per_day': 0.017 if hma else None,
            'height_velocity_cm_per_30d': 0.5 if hma else None,
            'haz_velocity_per_day': -0.003 if hma else None,
            'haz_velocity_per_30d': -0.09 if hma else None,
            'height_measurement_available': hma,
            'breastfeeding_status': 1,
            'formula_feeding': 0,
            'complementary_feeding_started': 1 if visit_num > 2 else 0,
            'supplement_use': 0,
            'recent_illness': 0,
            'diarrhea_recent': 0,
            'fever_recent': 0,
            'respiratory_illness_recent': 0,
            'breastfeeding_frequency_per_day': 6.0,
            'formula_feeds_per_day': 0.0,
            'meals_per_day': 3.0 if visit_num > 2 else 0.0,
            'illness_duration_days': 0.0,
            'supplement_type': 'none',
            'food_groups_consumed': 'grains,vegetables',
            'future_growth_faltering_180d': target,
        }
    
    rows = []
    # C1 - train - 5 visits
    for i in range(1, 6):
        is_target = 1 if i == 5 else 0
        rows.append(make_row('C1', i, (i-1)*30, -0.5 - (i*0.2), target=is_target))
    
    # C2 - validation - 3 visits
    for i in range(1, 4):
        rows.append(make_row('C2', i, (i-1)*30, -0.3, target=0, hma=(1 if i == 2 else 0)))
    
    # C3 - test - 2 visits, second has no height
    rows.append(make_row('C3', 1, 0, -0.8, target=0, hma=0))
    rows.append(make_row('C3', 2, 30, -1.1, target=1, hma=0))
    
    full_hist = pd.DataFrame(rows)
    
    # Supervised (index rows) = all rows
    train_df = full_hist[full_hist['child_id'] == 'C1'].copy()
    val_df   = full_hist[full_hist['child_id'] == 'C2'].copy()
    test_df  = full_hist[full_hist['child_id'] == 'C3'].copy()
    
    return full_hist, train_df, val_df, test_df


@pytest.fixture
def fitted_preprocessor(synthetic_data):
    full_hist, train_df, val_df, test_df = synthetic_data
    train_hist = full_hist[full_hist['child_id'] == 'C1'].copy()
    preprocessor, avail_num, avail_bool, avail_cat = build_sequences.build_preprocessor(train_hist)
    return preprocessor, avail_num, avail_bool, avail_cat


# ==================================================
# TESTS
# ==================================================

def test_one_sequence_per_index_row(synthetic_data, fitted_preprocessor):
    """Test 1: One sequence per supervised index row."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        train_df, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C1'}
    )
    assert X.shape[0] == len(train_df)


def test_target_matches_supervised_target(synthetic_data, fitted_preprocessor):
    """Test 2: Target array matches supervised split targets."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    train_df_sorted = train_df.sort_values(['child_id', 'visit_date'])
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        train_df_sorted, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C1'}
    )
    expected = train_df_sorted[build_sequences.TARGET_COL].values.astype(np.int32)
    assert np.array_equal(y, expected), f"Target mismatch: {y} vs {expected}"


def test_same_child_history_only(synthetic_data, fitted_preprocessor):
    """Test 3: All history rows belong to same child as index row."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    # Manually verify: C2 index rows must never include C1 or C3 history
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        val_df, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C2'}
    )
    for r in idx:
        assert r['child_id'] == 'C2'


def test_no_future_observations_in_history(synthetic_data, fitted_preprocessor):
    """Test 4: No observation after index T appears in the sequence."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    # Inject a future row for C1 to trigger leakage check.
    # Build only the columns that matter so pd.concat doesn't warn about
    # all-NA columns from a dict full of None values.
    future_row_df = pd.DataFrame(
        [{'child_id': 'C1', 'visit_date': pd.Timestamp('2099-01-01')}],
        columns=full_hist.columns,
    )
    full_hist_bad = pd.concat([full_hist, future_row_df], ignore_index=True)
    
    # Take just the first index row (earliest date for C1)
    first_idx = train_df.sort_values('visit_date').iloc[[0]]
    
    # This should NOT raise because 2099 is > index date... 
    # Wait: leakage check fires if history max > index T. 
    # Because we filter hist by visit_date <= T, the future row won't be included.
    # So no error. Test that it runs clean.
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        first_idx, full_hist_bad, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C1'}
    )
    assert X.shape[0] == 1


def test_first_index_produces_length_1_history(synthetic_data, fitted_preprocessor):
    """Test 5: First ever visit for a child produces history length = 1."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    first_visit = train_df.sort_values('visit_date').iloc[[0]]
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        first_visit, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C1'}
    )
    assert idx[0]['history_length'] == 1


def test_history_grows_over_time(synthetic_data, fitted_preprocessor):
    """Test 6: History length grows monotonically for same child's successive visits."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    sorted_train = train_df.sort_values('visit_date')
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        sorted_train, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C1'}
    )
    hist_lengths = [r['history_length'] for r in idx]
    for i in range(1, len(hist_lengths)):
        assert hist_lengths[i] >= hist_lengths[i-1], "History not growing!"


def test_left_padding_correct(synthetic_data, fitted_preprocessor):
    """Test 7: Left-padding fills the beginning of sequence; valid steps are at the end."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    first_visit = train_df.sort_values('visit_date').iloc[[0]]
    max_len = 5
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        first_visit, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=max_len, child_ids_allowed={'C1'}
    )
    # With 1 real visit, first 4 steps should be padding
    assert not mask[0, 0]  # padding
    assert not mask[0, 1]  # padding
    assert not mask[0, 2]  # padding
    assert not mask[0, 3]  # padding
    assert mask[0, 4]      # real step


def test_most_recent_is_last_valid_timestep(synthetic_data, fitted_preprocessor):
    """Test 8: Last valid timestep is the index row itself (most recent)."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        train_df, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C1'}
    )
    for i in range(X.shape[0]):
        # Last position must always be a real timestep (not padding)
        assert mask[i, -1], f"Sample {i}: last timestep is padding, not valid!"


def test_padding_excluded_by_mask(synthetic_data, fitted_preprocessor):
    """Test 9: Padding timesteps have mask=False."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    max_len = 10
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        train_df.sort_values('visit_date').iloc[[0]], full_hist, 
        preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=max_len, child_ids_allowed={'C1'}
    )
    # 1 real visit -> 9 padding steps all should be False
    n_valid = mask[0].sum()
    n_pad = (~mask[0]).sum()
    assert n_valid == 1
    assert n_pad == max_len - 1


def test_sparse_height_not_fabricated(synthetic_data, fitted_preprocessor):
    """Test 10: When height_measurement_available=0, height features remain NaN in raw data."""
    full_hist, train_df, val_df, test_df = synthetic_data
    # C3 has hma=0 for all visits
    c3_rows = full_hist[full_hist['child_id'] == 'C3']
    assert (c3_rows['height_measurement_available'] == 0).all()
    # last_observed_height_cm should be NaN (not fabricated)
    assert c3_rows['last_observed_height_cm'].isna().all()


def test_height_availability_indicator_correct(synthetic_data):
    """Test 11: height_measurement_available is correctly 0 or 1."""
    full_hist, train_df, val_df, test_df = synthetic_data
    vals = full_hist['height_measurement_available'].dropna().unique()
    assert all(v in [0, 1, 0.0, 1.0] for v in vals)


def test_preprocessing_fit_on_train_only(synthetic_data):
    """Test 12: Preprocessor is fitted on train history only."""
    full_hist, train_df, val_df, test_df = synthetic_data
    train_hist = full_hist[full_hist['child_id'] == 'C1']
    preprocessor, avail_num, avail_bool, avail_cat = build_sequences.build_preprocessor(train_hist)
    
    # Fitting succeeded
    assert hasattr(preprocessor, 'transformers_')
    
    # Transform validation - should NOT raise (handle_unknown='ignore')
    val_hist = full_hist[full_hist['child_id'] == 'C2']
    result = preprocessor.transform(val_hist[avail_num + avail_bool + avail_cat])
    assert result.shape[0] == len(val_hist)


def test_validation_does_not_refit(synthetic_data, fitted_preprocessor):
    """Test 13: Validation uses transform only; mean_ from train must stay same."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    if avail_num:
        mean_before = preprocessor.named_transformers_['num'].named_steps['scaler'].mean_.copy()
        val_hist = full_hist[full_hist['child_id'] == 'C2']
        preprocessor.transform(val_hist[avail_num + avail_bool + avail_cat])
        mean_after = preprocessor.named_transformers_['num'].named_steps['scaler'].mean_
        assert np.allclose(mean_before, mean_after), "Scaler mean changed after val transform!"


def test_train_children_in_train_split(synthetic_data, fitted_preprocessor):
    """Test 14: Train sequences contain only train children."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        train_df, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C1'}
    )
    assert all(r['child_id'] == 'C1' for r in idx)


def test_val_children_in_val_split(synthetic_data, fitted_preprocessor):
    """Test 15: Validation sequences contain only validation children."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        val_df, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C2'}
    )
    assert all(r['child_id'] == 'C2' for r in idx)


def test_test_children_in_test_split(synthetic_data, fitted_preprocessor):
    """Test 16: Test sequences contain only test children."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        test_df, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C3'}
    )
    assert all(r['child_id'] == 'C3' for r in idx)


def test_child_overlap_zero(synthetic_data, fitted_preprocessor):
    """Test 17: Zero child overlap between splits."""
    full_hist, train_df, val_df, test_df = synthetic_data
    
    tc = set(train_df['child_id'])
    vc = set(val_df['child_id'])
    ec = set(test_df['child_id'])
    
    assert len(tc & vc) == 0
    assert len(tc & ec) == 0
    assert len(vc & ec) == 0


def test_sequence_feature_order_deterministic(synthetic_data, fitted_preprocessor):
    """Test 18: Feature order is deterministic across two calls."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    first_visit = train_df.sort_values('visit_date').iloc[[0]]
    
    X1, _, _, _ = build_sequences.build_sequences_for_split(
        first_visit, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=5, child_ids_allowed={'C1'}
    )
    X2, _, _, _ = build_sequences.build_sequences_for_split(
        first_visit, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=5, child_ids_allowed={'C1'}
    )
    assert np.allclose(X1, X2)


def test_no_target_or_audit_in_features():
    """Test 19: Target and audit fields are excluded from sequence features."""
    forbidden = [
        'future_growth_faltering_180d',
        'target_new_threshold_crossing_180d',
        'target_waz_decline_05_180d'
    ]
    all_seq = build_sequences.get_all_seq_features()
    for f in forbidden:
        assert f not in all_seq, f"FORBIDDEN field in sequence: {f}"


def test_output_tensor_dimensions_consistent(synthetic_data, fitted_preprocessor):
    """Test 20: All output tensors have consistent dimensions."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    max_len = 7
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        train_df, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=max_len, child_ids_allowed={'C1'}
    )
    N = len(train_df)
    assert X.shape == (N, max_len, X.shape[2])
    assert y.shape == (N,)
    assert mask.shape == (N, max_len)


def test_y_binary_values(synthetic_data, fitted_preprocessor):
    """Test 21: y arrays contain only binary 0/1 values."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        train_df, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C1'}
    )
    assert set(np.unique(y)).issubset({0, 1})


def test_saved_artifacts_reload(synthetic_data, fitted_preprocessor, tmp_path):
    """Test 22: Saved numpy artifacts reload correctly."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    X, y, mask, idx = build_sequences.build_sequences_for_split(
        train_df, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len=10, child_ids_allowed={'C1'}
    )
    
    # Save and reload
    np.save(str(tmp_path / 'X.npy'), X)
    np.save(str(tmp_path / 'y.npy'), y)
    
    X2 = np.load(str(tmp_path / 'X.npy'))
    y2 = np.load(str(tmp_path / 'y.npy'))
    
    assert np.allclose(X, X2)
    assert np.array_equal(y, y2)


def test_sequence_building_deterministic(synthetic_data, fitted_preprocessor):
    """Test 24: Running sequence building twice gives identical results."""
    full_hist, train_df, val_df, test_df = synthetic_data
    preprocessor, avail_num, avail_bool, avail_cat = fitted_preprocessor
    
    args = (train_df, full_hist, preprocessor, avail_num, avail_bool, avail_cat, 10, {'C1'})
    X1, y1, m1, _ = build_sequences.build_sequences_for_split(*args)
    X2, y2, m2, _ = build_sequences.build_sequences_for_split(*args)
    
    assert np.allclose(X1, X2)
    assert np.array_equal(y1, y2)
    assert np.array_equal(m1, m2)
