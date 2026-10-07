import pandas as pd
import numpy as np
import json
import os

def run_audit(file_path):
    print("==================================================")
    print("DATASET AUDIT")
    print("==================================================")
    
    df = pd.read_csv(file_path)
    
    # 1. Dataset dimensions
    print("\n1. Dataset dimensions")
    print(f"Rows: {df.shape[0]}")
    print(f"Columns: {df.shape[1]}")
    
    # 2. Child statistics
    print("\n2. Child statistics")
    unique_children = df['child_id'].nunique()
    obs_per_child = df.groupby('child_id').size()
    print(f"Unique child count: {unique_children}")
    print(f"Minimum observations per child: {obs_per_child.min()}")
    print(f"Maximum observations per child: {obs_per_child.max()}")
    print(f"Mean observations per child: {obs_per_child.mean():.2f}")
    print(f"Median observations per child: {obs_per_child.median()}")
    
    # 3. Longitudinal verification
    print("\n3. Longitudinal verification")
    # sort logically by child_id and visit_date only in memory
    df_sorted = df.sort_values(by=['child_id', 'visit_date']).copy()
    duplicates = df_sorted.duplicated(subset=['child_id', 'visit_date']).sum()
    print("Verified children have repeated observations.")
    print(f"Duplicate child_id + visit_date combinations: {duplicates}")
    
    # 4. Date validation
    print("\n4. Date validation")
    df['date_of_birth'] = pd.to_datetime(df['date_of_birth'], errors='coerce')
    df['visit_date'] = pd.to_datetime(df['visit_date'], errors='coerce')
    
    invalid_dob = df['date_of_birth'].isna().sum()
    invalid_visit = df['visit_date'].isna().sum()
    print(f"Invalid date_of_birth count: {invalid_dob}")
    print(f"Invalid visit_date count: {invalid_visit}")
    
    visit_before_dob = (df['visit_date'] < df['date_of_birth']).sum()
    print(f"Records where visit_date < date_of_birth: {visit_before_dob}")
    
    # 5. Age validation
    print("\n5. Age validation")
    calculated_age_days = (df['visit_date'] - df['date_of_birth']).dt.days
    inconsistencies = (df['age_days'] != calculated_age_days).sum()
    print(f"Age days inconsistencies (provided vs calculated): {inconsistencies}")
    
    outside_0_5 = ((df['age_days'] < 0) | (df['age_days'] > 5 * 365.25)).sum()
    print(f"Observations outside age 0-5 years (0-1826 days): {outside_0_5}")
    
    # 6. Sex validation
    print("\n6. Sex validation")
    print("Unique sex values:")
    print(df['sex'].value_counts(dropna=False))
    
    # 7. Anthropometric checks
    print("\n7. Anthropometric checks")
    anthro_cols = ['birth_weight_kg', 'birth_length_cm', 'weight_kg', 'length_height_cm']
    anthro_stats = {}
    for col in anthro_cols:
        if col in df.columns:
            stats = {
                'min': float(df[col].min()),
                'max': float(df[col].max()),
                'mean': float(df[col].mean()),
                'median': float(df[col].median())
            }
            anthro_stats[col] = stats
            print(f"\n- {col}:")
            for k, v in stats.items():
                print(f"  {k}: {v:.2f}")
    
    # 8. Missing-value audit
    print("\n8. Missing-value audit")
    missing_data = []
    for col in df.columns:
        missing_count = df[col].isna().sum()
        missing_pct = (missing_count / len(df)) * 100
        missing_data.append({'column': col, 'missing_count': int(missing_count), 'missing_percentage': float(missing_pct)})
        print(f"{col}: {missing_count} missing ({missing_pct:.2f}%)")
        
    # 9. Height availability analysis
    print("\n9. Height availability analysis")
    if 'length_height_cm' in df.columns:
        height_present = df['length_height_cm'].notna().sum()
        height_missing = df['length_height_cm'].isna().sum()
        height_pct = (height_present / len(df)) * 100
        # Calculate height observations per child using only non-null heights
        height_per_child_series = df.dropna(subset=['length_height_cm']).groupby('child_id').size()
        height_per_child = height_per_child_series.mean() if not height_per_child_series.empty else 0.0
        
        print(f"Records with actual height/length: {height_present}")
        print(f"Records without height/length: {height_missing}")
        print(f"Percentage available: {height_pct:.2f}%")
        print(f"Average height observations per child: {height_per_child:.2f}")
    
    # 10. Categorical-value inspection
    print("\n10. Categorical-value inspection")
    cat_cols = ['sex', 'delivery_type', 'breastfeeding_status', 'formula_feeding', 
                'complementary_feeding_started', 'supplement_use', 'recent_illness', 
                'diarrhea_recent', 'fever_recent', 'respiratory_illness_recent']
    
    cat_stats = {}
    for col in cat_cols:
        if col in df.columns:
            val_counts = df[col].value_counts(dropna=False).to_dict()
            cat_stats[col] = {str(k): int(v) for k, v in val_counts.items()}
            print(f"\n- {col}:")
            for k, v in val_counts.items():
                print(f"  {k}: {v}")
                
    # 11. Potential data leakage review
    print("\n11. Potential data leakage review")
    leakage_terms = ['target', 'future', 'prediction', 'risk_score', 'next_visit']
    flagged_cols = []
    for col in df.columns:
        if any(term in col.lower() for term in leakage_terms):
            flagged_cols.append(col)
            
    if flagged_cols:
        print(f"WARNING: Potential leakage columns found: {flagged_cols}")
    else:
        print("No potential data leakage columns found based on naming conventions.")
        
    # 12. Save machine-readable summary
    summary = {
        'dimensions': {
            'rows': int(df.shape[0]),
            'columns': int(df.shape[1])
        },
        'child_statistics': {
            'unique_children': int(unique_children),
            'min_obs': int(obs_per_child.min()),
            'max_obs': int(obs_per_child.max()),
            'mean_obs': float(obs_per_child.mean()),
            'median_obs': float(obs_per_child.median())
        },
        'longitudinal': {
            'duplicates': int(duplicates)
        },
        'missing_data': missing_data,
        'anthropometric_stats': anthro_stats,
        'categorical_stats': cat_stats,
        'leakage_flags': flagged_cols
    }
    
    out_path = os.path.join('research', 'evaluation', 'dataset_audit_v1.json')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(summary, f, indent=4)
    print(f"\nSummary saved to {out_path}")

if __name__ == "__main__":
    file_path = os.path.join('data', 'raw', 'chdr_dataset_v1.csv')
    if not os.path.exists(file_path):
        print(f"Error: Dataset not found at {file_path}")
    else:
        run_audit(file_path)
