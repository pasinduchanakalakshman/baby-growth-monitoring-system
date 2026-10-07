import pandas as pd
import numpy as np
import os
import json
import sys

def process_temporal_features():
    print("==================================================")
    print("STARTING STAGE 4: TEMPORAL FEATURE ENGINEERING")
    print("==================================================")

    input_path = os.path.join('data', 'processed', 'chdr_who_features_v1.csv')
    output_path = os.path.join('data', 'features', 'chdr_temporal_features_v1.csv')
    report_path = os.path.join('research', 'evaluation', 'temporal_feature_report_v1.json')

    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        sys.exit(1)

    df = pd.read_csv(input_path)
    input_rows = len(df)
    unique_children = df['child_id'].nunique()

    # Force numeric on expected WHO features
    for col in ['weight_kg', 'verified_waz', 'length_height_cm', 'verified_haz']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # 1. Chronological Sorting
    df = df.sort_values(['child_id', 'visit_date']).reset_index(drop=True)

    # 2. Observation Count
    df['observation_count'] = df.groupby('child_id').cumcount() + 1

    # Date parsing
    df['visit_date_dt'] = pd.to_datetime(df['visit_date'])

    # 3. Time Since Previous Visit
    df['days_since_previous_visit'] = df.groupby('child_id')['visit_date_dt'].diff().dt.days

    # 4 & 6. Weight and WAZ Change
    # STRICTLY within child
    df['weight_change_kg'] = df.groupby('child_id')['weight_kg'].diff()
    df['waz_change'] = df.groupby('child_id')['verified_waz'].diff()

    # 5 & 7. Velocities
    df['weight_velocity_kg_per_day'] = np.where(df['days_since_previous_visit'] > 0, df['weight_change_kg'] / df['days_since_previous_visit'], np.nan)
    df['weight_velocity_kg_per_30d'] = df['weight_velocity_kg_per_day'] * 30

    df['waz_velocity_per_day'] = np.where(df['days_since_previous_visit'] > 0, df['waz_change'] / df['days_since_previous_visit'], np.nan)
    df['waz_velocity_per_30d'] = df['waz_velocity_per_day'] * 30

    # 8. Height Measurement Availability
    df['height_measurement_available'] = np.where(df['length_height_cm'].notna(), 1, 0)
    height_mask = df['length_height_cm'].notna()

    # 10. Last Observed Height Features
    df['last_observed_height_cm'] = df.groupby('child_id')['length_height_cm'].ffill()
    df['last_observed_haz'] = df.groupby('child_id')['verified_haz'].ffill()

    # 9. Days Since Last Height Measurement
    df['actual_height_date'] = df['visit_date_dt'].copy()
    df.loc[~height_mask, 'actual_height_date'] = pd.NaT
    
    # Strictly isolate by child: shift(1) then ffill within group
    df['prev_actual_height_date'] = df.groupby('child_id')['actual_height_date'].transform(lambda x: x.shift(1).ffill())
    
    df['days_since_last_height_measurement'] = (df['visit_date_dt'] - df['prev_actual_height_date']).dt.days

    # 11 & 12. Height and HAZ Change
    # Strictly isolated by child
    df['most_recent_earlier_height'] = df.groupby('child_id')['length_height_cm'].transform(lambda x: x.shift(1).ffill())
    df['most_recent_earlier_haz'] = df.groupby('child_id')['verified_haz'].transform(lambda x: x.shift(1).ffill())

    df['height_change_cm'] = np.where(height_mask & df['most_recent_earlier_height'].notna(), df['length_height_cm'] - df['most_recent_earlier_height'], np.nan)
    df['haz_change'] = np.where(height_mask & df['most_recent_earlier_haz'].notna(), df['verified_haz'] - df['most_recent_earlier_haz'], np.nan)

    # 13 & 14. Height and HAZ Velocity
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

    # 15. Optional Historical Trend Features (Rolling means)
    df['waz_rolling_mean_3'] = df.groupby('child_id')['verified_waz'].transform(lambda x: x.rolling(window=3, min_periods=1).mean())
    df['weight_rolling_mean_3'] = df.groupby('child_id')['weight_kg'].transform(lambda x: x.rolling(window=3, min_periods=1).mean())

    # Drop temporary columns
    cols_to_drop = [
        'visit_date_dt', 'actual_height_date', 'prev_actual_height_date', 
        'most_recent_earlier_height', 'most_recent_earlier_haz'
    ]
    df = df.drop(columns=cols_to_drop)

    # 19. Leakage Check
    leakage_terms = ['future', 'next_visit', 'target', 'prediction', 'predicted', 'risk_score', 'risk_probability']
    found_leakage_cols = [c for c in df.columns if any(term in c.lower() for term in leakage_terms)]

    if found_leakage_cols:
        print(f"CRITICAL: Leakage detected in columns: {found_leakage_cols}")
        sys.exit(1)

    # 6. Dataset Invariants Test
    expected_calculable = input_rows - unique_children
    
    waz_calculated = int(df['waz_change'].notna().sum())
    waz_missing = int(df['waz_change'].isna().sum())
    waz_change_count_valid = waz_calculated == expected_calculable

    height_calculated = int(df['height_change_cm'].notna().sum())
    height_missing = int(df['height_change_cm'].isna().sum())
    height_change_count_valid_for_complete_height_dataset = height_calculated == expected_calculable

    haz_calculated = int(df['haz_change'].notna().sum())
    haz_missing = int(df['haz_change'].isna().sum())
    haz_change_count_valid_for_complete_height_dataset = haz_calculated == expected_calculable

    dataset_invariants = {
        "expected_non_first_records": expected_calculable,
        "waz_change_count_valid": waz_change_count_valid,
        "height_change_count_valid_for_complete_height_dataset": height_change_count_valid_for_complete_height_dataset,
        "haz_change_count_valid_for_complete_height_dataset": haz_change_count_valid_for_complete_height_dataset
    }

    warnings = []
    has_invariant_failures = False
    
    if not waz_change_count_valid:
        warnings.append(f"WAZ change calculated ({waz_calculated}) != expected ({expected_calculable}).")
        has_invariant_failures = True
    if not height_change_count_valid_for_complete_height_dataset:
        warnings.append(f"Height change calculated ({height_calculated}) != expected ({expected_calculable}).")
        has_invariant_failures = True
    if not haz_change_count_valid_for_complete_height_dataset:
        warnings.append(f"HAZ change calculated ({haz_calculated}) != expected ({expected_calculable}).")
        has_invariant_failures = True

    if has_invariant_failures:
        print("CRITICAL INVARIANT FAILURES DETECTED:")
        for w in warnings:
            print(" -", w)
        sys.exit(1)

    # Output preservation
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)

    # Report Generation
    report = {
        "input_file": input_path,
        "output_file": output_path,
        "input_rows": input_rows,
        "output_rows": len(df),
        "unique_children": unique_children,
        "features_created": [
            "observation_count", "days_since_previous_visit", "weight_change_kg",
            "weight_velocity_kg_per_day", "weight_velocity_kg_per_30d",
            "waz_change", "waz_velocity_per_day", "waz_velocity_per_30d",
            "height_measurement_available", "days_since_last_height_measurement",
            "last_observed_height_cm", "last_observed_haz", "height_change_cm",
            "haz_change", "height_velocity_cm_per_day", "height_velocity_cm_per_30d",
            "haz_velocity_per_day", "haz_velocity_per_30d",
            "waz_rolling_mean_3", "weight_rolling_mean_3"
        ],
        "first_observation_count": int((df['observation_count'] == 1).sum()),
        "days_since_previous_visit": {
            "missing": int(df['days_since_previous_visit'].isna().sum()),
            "min": float(df['days_since_previous_visit'].min()),
            "max": float(df['days_since_previous_visit'].max()),
            "mean": float(df['days_since_previous_visit'].mean()),
            "median": float(df['days_since_previous_visit'].median())
        },
        "weight_change": {
            "calculated": int(df['weight_change_kg'].notna().sum()),
            "missing": int(df['weight_change_kg'].isna().sum()),
            "min": float(df['weight_change_kg'].min()),
            "max": float(df['weight_change_kg'].max()),
            "mean": float(df['weight_change_kg'].mean())
        },
        "waz_change": {
            "calculated": waz_calculated,
            "missing": waz_missing,
            "min": float(df['waz_change'].min()),
            "max": float(df['waz_change'].max()),
            "mean": float(df['waz_change'].mean())
        },
        "waz_velocity": {
            "calculated": int(df['waz_velocity_per_day'].notna().sum()),
            "missing": int(df['waz_velocity_per_day'].isna().sum())
        },
        "height_measurement_available": {
            "available": int((df['height_measurement_available'] == 1).sum()),
            "missing": int((df['height_measurement_available'] == 0).sum())
        },
        "height_change": {
            "calculated": height_calculated,
            "missing": height_missing
        },
        "haz_change": {
            "calculated": haz_calculated,
            "missing": haz_missing
        },
        "height_velocity": {
            "calculated": int(df['height_velocity_cm_per_day'].notna().sum()),
            "missing": int(df['height_velocity_cm_per_day'].isna().sum())
        },
        "haz_velocity": {
            "calculated": int(df['haz_velocity_per_day'].notna().sum()),
            "missing": int(df['haz_velocity_per_day'].isna().sum())
        },
        "dataset_invariants": dataset_invariants,
        "leakage_check": {
            "future_columns_found": found_leakage_cols
        },
        "warnings": warnings
    }

    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=4)

    print(f"Temporal features calculated. Dataset saved to {output_path}")
    print(f"Report saved to {report_path}")

if __name__ == '__main__':
    process_temporal_features()
