import pandas as pd
import numpy as np
import os
import json
import joblib
import sys
import datetime

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder

# ==================================================
# SEQUENCE FEATURE DEFINITION
# ==================================================
# These are the features used at each timestep in the sequence.
# They represent ONLY information available at or before time T.
# Strictly excludes: child_id, visit_date, target, audit, future values.

NUMERIC_SEQ_FEATURES = [
    # Core growth measurements
    'age_days',
    'weight_kg',
    'verified_waz',
    'verified_haz',
    # Temporal growth history
    'observation_count',
    'days_since_previous_visit',
    'weight_change_kg',
    'weight_velocity_kg_per_day',
    'weight_velocity_kg_per_30d',
    'waz_change',
    'waz_velocity_per_day',
    'waz_velocity_per_30d',
    # Rolling smoothed signals
    'waz_rolling_mean_3',
    'weight_rolling_mean_3',
    # Height (sparse - may be NaN)
    'last_observed_height_cm',
    'last_observed_haz',
    'days_since_last_height_measurement',
    'height_change_cm',
    'haz_change',
    'height_velocity_cm_per_day',
    'height_velocity_cm_per_30d',
    'haz_velocity_per_day',
    'haz_velocity_per_30d',
    # Feeding/illness numeric
    'breastfeeding_frequency_per_day',
    'formula_feeds_per_day',
    'meals_per_day',
    'illness_duration_days',
]

BOOLEAN_SEQ_FEATURES = [
    'height_measurement_available',
    'breastfeeding_status',
    'formula_feeding',
    'complementary_feeding_started',
    'supplement_use',
    'recent_illness',
    'diarrhea_recent',
    'fever_recent',
    'respiratory_illness_recent',
]

CATEGORICAL_SEQ_FEATURES = [
    'supplement_type',
    'food_groups_consumed',
]

EXCLUDED_FROM_SEQUENCE = [
    'child_id', 'visit_date', 'date_of_birth',
    'future_growth_faltering_180d',
    'target_new_threshold_crossing_180d',
    'target_waz_decline_05_180d',
    'has_180d_followup',
    # Birth statics excluded from sequence (could be added as static branch later)
    'sex', 'birth_weight_kg', 'birth_length_cm', 'gestational_age_weeks',
    'birth_order', 'delivery_type', 'apgar_score_5min',
    'length_height_cm',  # raw height at visit; we use last_observed_height_cm instead
]

TARGET_COL = 'future_growth_faltering_180d'
MASK_VALUE = -999.0  # Distinct from any real value or 0


def get_all_seq_features():
    return NUMERIC_SEQ_FEATURES + BOOLEAN_SEQ_FEATURES + CATEGORICAL_SEQ_FEATURES


def build_preprocessor(train_history_df):
    """Build and fit a preprocessor on the TRAIN history rows only."""
    all_seq = get_all_seq_features()
    
    # Only use columns that exist in the data
    available_num = [c for c in NUMERIC_SEQ_FEATURES if c in train_history_df.columns]
    available_bool = [c for c in BOOLEAN_SEQ_FEATURES if c in train_history_df.columns]
    available_cat = [c for c in CATEGORICAL_SEQ_FEATURES if c in train_history_df.columns]
    
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])
    boolean_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value=0)),
        ('scaler', StandardScaler())
    ])
    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])
    
    transformers = []
    if available_num:
        transformers.append(('num', numeric_transformer, available_num))
    if available_bool:
        transformers.append(('bool', boolean_transformer, available_bool))
    if available_cat:
        transformers.append(('cat', categorical_transformer, available_cat))
    
    preprocessor = ColumnTransformer(transformers=transformers, remainder='drop')
    preprocessor.fit(train_history_df[available_num + available_bool + available_cat])
    return preprocessor, available_num, available_bool, available_cat


def transform_row(row_df, preprocessor, available_num, available_bool, available_cat):
    """Transform a single-row or multi-row dataframe of feature columns."""
    all_avail = available_num + available_bool + available_cat
    return preprocessor.transform(row_df[all_avail])


def build_sequences_for_split(
    index_df,         # supervised split rows (index observations)
    full_history_df,  # all temporal features for allowed children
    preprocessor,
    available_num, available_bool, available_cat,
    max_seq_len,
    child_ids_allowed
):
    """
    For each index row in index_df, build a left-padded sequence
    of history (visit_date <= index_visit_date, same child).
    Returns:
        X: (N, T, F) float32 array
        y: (N,) int array
        mask: (N, T) bool array (True = valid timestep, False = padding)
        index_records: list of dicts for audit CSV
    """
    # Safety: only use allowed children
    index_df = index_df[index_df['child_id'].isin(child_ids_allowed)].copy()
    full_history_df = full_history_df[full_history_df['child_id'].isin(child_ids_allowed)].copy()
    
    index_df['visit_date'] = pd.to_datetime(index_df['visit_date'])
    full_history_df['visit_date'] = pd.to_datetime(full_history_df['visit_date'])
    
    index_df = index_df.sort_values(['child_id', 'visit_date']).reset_index(drop=True)
    
    all_avail = available_num + available_bool + available_cat
    n_features_raw = len(all_avail)
    # We'll determine transformed feature count after first transform
    
    # Pad row = zero vector (MASK_VALUE before transform)
    # We build raw rows and transform batch later
    
    X_list = []
    y_list = []
    mask_list = []
    index_records = []
    
    for _, idx_row in index_df.iterrows():
        child = idx_row['child_id']
        t = idx_row['visit_date']
        target = int(idx_row[TARGET_COL])
        
        # Get history: same child, visit_date <= T
        child_hist = full_history_df[
            (full_history_df['child_id'] == child) &
            (full_history_df['visit_date'] <= t)
        ].sort_values('visit_date').reset_index(drop=True)
        
        # Leakage check
        if child_hist['visit_date'].max() > t:
            raise ValueError(
                f"FUTURE LEAKAGE DETECTED: child {child} has observation after index date {t}"
            )
        
        n_hist = len(child_hist)
        
        # Build raw feature matrix for this child's history
        if n_hist > 0:
            hist_features = child_hist[all_avail].copy()
            transformed = preprocessor.transform(hist_features)
        else:
            # No history at all (shouldn't happen since index T is in history)
            transformed = np.zeros((0, 0))
        
        n_features = transformed.shape[1] if transformed.ndim == 2 and transformed.shape[0] > 0 else 0
        
        # Truncate to max_seq_len (keep most recent)
        if n_hist > max_seq_len:
            transformed = transformed[-max_seq_len:]
            n_hist = max_seq_len
        
        # Left-pad
        n_pad = max_seq_len - n_hist
        
        if n_features == 0:
            # Edge case: determine from preprocessor
            dummy = child_hist[all_avail].iloc[[0]].copy() if len(child_hist) > 0 else pd.DataFrame(columns=all_avail)
            n_features = preprocessor.transform(dummy).shape[1] if len(dummy) > 0 else 0
        
        pad_rows = np.full((n_pad, n_features), MASK_VALUE, dtype=np.float32)
        
        if n_hist > 0:
            seq = np.vstack([pad_rows, transformed.astype(np.float32)])
        else:
            seq = pad_rows
        
        mask = np.array([False] * n_pad + [True] * n_hist, dtype=bool)
        
        X_list.append(seq)
        y_list.append(target)
        mask_list.append(mask)
        index_records.append({
            'child_id': child,
            'index_visit_date': str(t.date()),
            'target': target,
            'history_length': n_hist,
        })
    
    X = np.stack(X_list, axis=0)
    y = np.array(y_list, dtype=np.int32)
    mask = np.stack(mask_list, axis=0)
    
    return X, y, mask, index_records


def process_build_sequences():
    print("==================================================")
    print("STARTING STAGE 8: LONGITUDINAL SEQUENCE CONSTRUCTION")
    print("==================================================")
    
    # Paths
    history_path = os.path.join('data', 'features', 'chdr_temporal_features_v1.csv')
    train_path = os.path.join('data', 'splits', 'v1', 'train.csv')
    val_path = os.path.join('data', 'splits', 'v1', 'validation.csv')
    test_path = os.path.join('data', 'splits', 'v1', 'test.csv')
    
    seq_dir = os.path.join('data', 'sequences', 'v1')
    schema_dir = os.path.join('data', 'schemas')
    report_path = os.path.join('research', 'evaluation', 'sequence_build_report_v1.json')
    preprocessor_path = os.path.join('models', 'scalers', 'sequence_preprocessor_v1.joblib')
    preproc_meta_path = os.path.join('models', 'metadata', 'sequence_preprocessor_metadata_v1.json')
    
    os.makedirs(seq_dir, exist_ok=True)
    os.makedirs(schema_dir, exist_ok=True)
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    os.makedirs(os.path.dirname(preprocessor_path), exist_ok=True)
    
    # Load data
    full_hist = pd.read_csv(history_path)
    df_train = pd.read_csv(train_path)
    df_val = pd.read_csv(val_path)
    df_test = pd.read_csv(test_path)
    
    full_hist['visit_date'] = pd.to_datetime(full_hist['visit_date'])
    df_train['visit_date'] = pd.to_datetime(df_train['visit_date'])
    df_val['visit_date'] = pd.to_datetime(df_val['visit_date'])
    df_test['visit_date'] = pd.to_datetime(df_test['visit_date'])
    
    # Child sets from Stage 6
    train_children = set(df_train['child_id'].unique())
    val_children = set(df_val['child_id'].unique())
    test_children = set(df_test['child_id'].unique())
    
    # Verify child overlap
    assert len(train_children & val_children) == 0, "CRITICAL: Train/Val child overlap!"
    assert len(train_children & test_children) == 0, "CRITICAL: Train/Test child overlap!"
    assert len(val_children & test_children) == 0, "CRITICAL: Val/Test child overlap!"
    
    # Verify forbidden features not in sequence
    all_seq = get_all_seq_features()
    for forbidden in [TARGET_COL, 'target_new_threshold_crossing_180d', 'target_waz_decline_05_180d']:
        if forbidden in all_seq:
            raise ValueError(f"FORBIDDEN FIELD in sequence features: {forbidden}")
    
    # ==================================================
    # SEQUENCE LENGTH ANALYSIS
    # ==================================================
    print("Analysing sequence length distribution...")
    
    def get_hist_lengths(index_df, hist_df):
        lengths = []
        for _, row in index_df.iterrows():
            child = row['child_id']
            t = row['visit_date']
            n = len(hist_df[(hist_df['child_id'] == child) & (hist_df['visit_date'] <= t)])
            lengths.append(n)
        return lengths
    
    train_lengths = get_hist_lengths(df_train, full_hist)
    val_lengths = get_hist_lengths(df_val, full_hist)
    test_lengths = get_hist_lengths(df_test, full_hist)
    all_lengths = train_lengths + val_lengths + test_lengths
    
    def length_stats(lengths):
        a = np.array(lengths)
        return {
            'min': int(a.min()), 'max': int(a.max()),
            'mean': float(a.mean()), 'median': float(np.median(a)),
            'p25': float(np.percentile(a, 25)),
            'p75': float(np.percentile(a, 75)),
            'p95': float(np.percentile(a, 95))
        }
    
    all_stats = length_stats(all_lengths)
    print(f"  Overall: min={all_stats['min']}, max={all_stats['max']}, "
          f"mean={all_stats['mean']:.1f}, p95={all_stats['p95']:.0f}")
    
    # Choose max_seq_len based on data
    p95 = all_stats['p95']
    observed_max = all_stats['max']
    max_seq_len = 20  # default
    if p95 > 20:
        max_seq_len = int(np.ceil(p95))
        print(f"  p95 ({p95:.0f}) > 20. Setting max_seq_len = {max_seq_len}")
    else:
        print(f"  p95 ({p95:.0f}) <= 20. Using max_seq_len = 20 (confirmed by data).")
    
    # ==================================================
    # FIT PREPROCESSOR ON TRAIN HISTORY ONLY
    # ==================================================
    print("Fitting sequence preprocessor on TRAIN history only...")
    train_hist = full_hist[full_hist['child_id'].isin(train_children)].copy()
    preprocessor, avail_num, avail_bool, avail_cat = build_preprocessor(train_hist)
    
    joblib.dump(preprocessor, preprocessor_path)
    
    # Determine transformed feature count
    sample_row = train_hist.iloc[[0]][avail_num + avail_bool + avail_cat]
    n_features = preprocessor.transform(sample_row).shape[1]
    
    print(f"  Sequence features: {len(avail_num)} numeric, {len(avail_bool)} boolean, "
          f"{len(avail_cat)} categorical -> {n_features} transformed features")
    
    preproc_meta = {
        "numeric_features": avail_num,
        "boolean_features": avail_bool,
        "categorical_features": avail_cat,
        "n_transformed_features": n_features,
        "fit_on": "train_history_only",
        "mask_value": MASK_VALUE,
        "max_seq_len": max_seq_len,
        "training_dataset_version": "v1",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    with open(preproc_meta_path, 'w') as f:
        json.dump(preproc_meta, f, indent=4)
    
    # ==================================================
    # BUILD SEQUENCES
    # ==================================================
    print("Building TRAIN sequences...")
    X_train, y_train, mask_train, idx_train = build_sequences_for_split(
        df_train, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len, train_children
    )
    
    print("Building VALIDATION sequences...")
    X_val, y_val, mask_val, idx_val = build_sequences_for_split(
        df_val, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len, val_children
    )
    
    print("Building TEST sequences...")
    X_test, y_test, mask_test, idx_test = build_sequences_for_split(
        df_test, full_hist, preprocessor, avail_num, avail_bool, avail_cat,
        max_seq_len, test_children
    )
    
    # ==================================================
    # RECONCILIATION CHECKS
    # ==================================================
    assert X_train.shape[0] == len(df_train), \
        f"TRAIN sample count mismatch: {X_train.shape[0]} != {len(df_train)}"
    assert X_val.shape[0] == len(df_val), \
        f"VAL sample count mismatch: {X_val.shape[0]} != {len(df_val)}"
    assert X_test.shape[0] == len(df_test), \
        f"TEST sample count mismatch: {X_test.shape[0]} != {len(df_test)}"
    
    assert np.array_equal(y_train, df_train[TARGET_COL].values.astype(np.int32)), \
        "TRAIN target mismatch!"
    assert np.array_equal(y_val, df_val[TARGET_COL].values.astype(np.int32)), \
        "VAL target mismatch!"
    assert np.array_equal(y_test, df_test[TARGET_COL].values.astype(np.int32)), \
        "TEST target mismatch!"
    
    # ==================================================
    # SAVE ARTIFACTS
    # ==================================================
    print("Saving sequence artifacts...")
    np.save(os.path.join(seq_dir, 'X_train.npy'), X_train)
    np.save(os.path.join(seq_dir, 'y_train.npy'), y_train)
    np.save(os.path.join(seq_dir, 'mask_train.npy'), mask_train)
    pd.DataFrame(idx_train).to_csv(os.path.join(seq_dir, 'index_train.csv'), index=False)
    
    np.save(os.path.join(seq_dir, 'X_validation.npy'), X_val)
    np.save(os.path.join(seq_dir, 'y_validation.npy'), y_val)
    np.save(os.path.join(seq_dir, 'mask_validation.npy'), mask_val)
    pd.DataFrame(idx_val).to_csv(os.path.join(seq_dir, 'index_validation.csv'), index=False)
    
    np.save(os.path.join(seq_dir, 'X_test.npy'), X_test)
    np.save(os.path.join(seq_dir, 'y_test.npy'), y_test)
    np.save(os.path.join(seq_dir, 'mask_test.npy'), mask_test)
    pd.DataFrame(idx_test).to_csv(os.path.join(seq_dir, 'index_test.csv'), index=False)
    
    # ==================================================
    # SAVE SEQUENCE SCHEMA
    # ==================================================
    seq_schema = {
        "sequence_features": avail_num + avail_bool + avail_cat,
        "numeric_features": avail_num,
        "boolean_features": avail_bool,
        "categorical_features": avail_cat,
        "n_raw_sequence_features": len(avail_num) + len(avail_bool) + len(avail_cat),
        "n_transformed_features": n_features,
        "excluded_features": EXCLUDED_FROM_SEQUENCE,
        "target": TARGET_COL,
        "sequence_length": max_seq_len,
        "padding_policy": "left_pad_with_mask_value",
        "mask_value": MASK_VALUE,
        "mask_convention": "True = valid timestep, False = padding",
        "static_features_design": "Birth/demographic statics excluded from sequence; may be added as static branch in future multi-input architecture"
    }
    with open(os.path.join(schema_dir, 'sequence_feature_schema_v1.json'), 'w') as f:
        json.dump(seq_schema, f, indent=4)
    
    # ==================================================
    # BUILD REPORT
    # ==================================================
    def split_report(X, y, mask, lengths):
        return {
            "samples": int(X.shape[0]),
            "positives": int(y.sum()),
            "tensor_shape": list(X.shape),
            "sequence_length_distribution": length_stats(lengths)
        }
    
    report = {
        "feature_list": avail_num + avail_bool + avail_cat,
        "n_raw_features": len(avail_num) + len(avail_bool) + len(avail_cat),
        "n_transformed_features": n_features,
        "max_sequence_length": max_seq_len,
        "overall_sequence_length_distribution": all_stats,
        "padding_policy": "left_pad",
        "masking_policy": f"mask_value={MASK_VALUE}, True=valid timestep",
        "train": split_report(X_train, y_train, mask_train, train_lengths),
        "validation": split_report(X_val, y_val, mask_val, val_lengths),
        "test": split_report(X_test, y_test, mask_test, test_lengths),
        "checks": {
            "child_overlap_train_val": len(train_children & val_children),
            "child_overlap_train_test": len(train_children & test_children),
            "child_overlap_val_test": len(val_children & test_children),
            "future_leakage_violations": 0,
            "train_sample_reconciliation": X_train.shape[0] == len(df_train),
            "val_sample_reconciliation": X_val.shape[0] == len(df_val),
            "test_sample_reconciliation": X_test.shape[0] == len(df_test),
            "train_target_reconciliation": bool(np.array_equal(y_train, df_train[TARGET_COL].values.astype(np.int32))),
            "val_target_reconciliation": bool(np.array_equal(y_val, df_val[TARGET_COL].values.astype(np.int32))),
            "test_target_reconciliation": bool(np.array_equal(y_test, df_test[TARGET_COL].values.astype(np.int32))),
        },
        "warnings": []
    }
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=4)
    
    print(f"Stage 8 complete.")
    print(f"  Train:      {X_train.shape}")
    print(f"  Validation: {X_val.shape}")
    print(f"  Test:       {X_test.shape}")
    print(f"Report saved to {report_path}")


if __name__ == '__main__':
    process_build_sequences()
