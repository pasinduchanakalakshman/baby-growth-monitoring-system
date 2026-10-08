import os
import sys
import json
import hashlib
import pandas as pd
import numpy as np

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

def calculate_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def get_child_splits():
    splits = {}
    for s in ['train', 'validation', 'test']:
        path = os.path.join(project_root, 'data', 'splits', 'v1', f'{s}_children.csv')
        df = pd.read_csv(path)
        for child in df['child_id'].unique():
            splits[child] = s
    return splits

def main():
    # Verify Research Core
    print("Verifying Research Core v1...")
    chk_script = os.path.join(project_root, 'research', 'scripts', 'stage12_freeze_research_core.py')
    res = os.system(f'python "{chk_script}" --verify')
    if res != 0:
        print("ERROR: Research Core verification failed. Halting Stage 13.")
        sys.exit(1)
        
    print("Research Core verified. Proceeding to Stage 13 feasibility.")
    
    # Load Temporal Features Dataset
    data_path = os.path.join(project_root, 'data', 'features', 'chdr_temporal_features_v1.csv')
    df = pd.read_csv(data_path)
    df['visit_date'] = pd.to_datetime(df['visit_date'])
    df = df.sort_values(by=['child_id', 'visit_date']).reset_index(drop=True)
    
    splits = get_child_splits()
    # Apply splits, removing any children not in Stage 6 splits
    df['split'] = df['child_id'].map(splits)
    df = df.dropna(subset=['split']).copy()
    
    # Build candidate pairs
    print("Building candidate future visits...")
    
    candidates = {'A': (30, 30), 'B': (28, 32), 'C': (25, 35), 'D': (20, 40)}
    results = {}
    
    all_pairs = []
    
    # Iterate through each child's visits
    for child, group in df.groupby('child_id'):
        dates = group['visit_date'].values
        indices = group.index.values
        for i in range(len(indices)):
            for j in range(i + 1, len(indices)):
                gap = (dates[j] - dates[i]).astype('timedelta64[D]').astype(int)
                if gap > 0:
                    all_pairs.append({
                        'child_id': child,
                        'split': group['split'].iloc[0],
                        'index_idx': indices[i],
                        'target_idx': indices[j],
                        'gap': gap
                    })
                    
    pairs_df = pd.DataFrame(all_pairs)
    
    # Evaluate candidates
    for name, (min_gap, max_gap) in candidates.items():
        valid = pairs_df[(pairs_df['gap'] >= min_gap) & (pairs_df['gap'] <= max_gap)]
        
        # Deterministic target selection for this window
        valid = valid.copy()
        valid['diff'] = (valid['gap'] - 30).abs()
        # sort by index_idx, diff, gap (gap tie-break means smaller gap = earlier visit)
        valid = valid.sort_values(['index_idx', 'diff', 'gap'])
        # pick exactly one per index
        deduped = valid.drop_duplicates(subset=['index_idx'], keep='first')
        
        results[name] = {
            'pairs': len(deduped),
            'children': deduped['child_id'].nunique(),
            'train': len(deduped[deduped['split'] == 'train']),
            'val': len(deduped[deduped['split'] == 'validation']),
            'test': len(deduped[deduped['split'] == 'test']),
            'mean_gap': float(deduped['gap'].mean()) if len(deduped) > 0 else 0,
            'min_gap': int(deduped['gap'].min()) if len(deduped) > 0 else 0,
            'max_gap': int(deduped['gap'].max()) if len(deduped) > 0 else 0,
            'median_gap': float(deduped['gap'].median()) if len(deduped) > 0 else 0,
            'deduped_df': deduped
        }
    
    # Select preferred operational window
    # We prefer the NARROWEST window that gives enough support.
    # We want at least ~2000 total pairs, ~300 test pairs, etc.
    # Let's dynamically pick. 
    selected_window = 'C' # 25-35 usually strikes a good balance in longitudinal monthly data
    if results['B']['test'] >= 200:
        selected_window = 'B'
    if results['A']['test'] >= 100:
        selected_window = 'A'
        
    print(f"Selected operational target window: {selected_window} ({candidates[selected_window][0]} - {candidates[selected_window][1]} days)")
    
    selected_pairs = results[selected_window]['deduped_df']
    
    # Build Forecast Dataset
    print("Constructing forecast dataset snapshot...")
    # Index features: those known at index time
    # From Task 7
    index_cols = [c for c in df.columns if c not in ['child_id', 'visit_date', 'split']]
    
    out_rows = []
    for _, row in selected_pairs.iterrows():
        idx_row = df.loc[row['index_idx']]
        tgt_row = df.loc[row['target_idx']]
        
        out_row = {
            'child_id': row['child_id'],
            'split': row['split'],
            'index_visit_date': str(idx_row['visit_date'].date()),
            'target_visit_date': str(tgt_row['visit_date'].date()),
            'forecast_horizon_days': row['gap'],
            'target_age_days': tgt_row['age_days'],
            'target_weight_kg': tgt_row['weight_kg'],
            'target_verified_waz': tgt_row.get('verified_waz', np.nan),
            'target_verified_haz': tgt_row.get('verified_haz', np.nan),
            'weight_change_kg_30d_observed': tgt_row['weight_kg'] - idx_row['weight_kg']
        }
        
        for c in index_cols:
            out_row[f"index_{c}"] = idx_row[c]
            
        out_rows.append(out_row)
        
    forecast_df = pd.DataFrame(out_rows)
    
    # Quality Analysis
    waz_stats = forecast_df['target_verified_waz'].describe().to_dict()
    weight_stats = forecast_df['target_weight_kg'].describe().to_dict()
    weight_change_stats = forecast_df['weight_change_kg_30d_observed'].describe().to_dict()
    
    # Save outputs
    out_dir = os.path.join(project_root, 'data', 'forecasting')
    os.makedirs(out_dir, exist_ok=True)
    
    full_path = os.path.join(out_dir, 'chdr_30d_forecast_pairs_v1.csv')
    forecast_df.to_csv(full_path, index=False)
    
    train_path = os.path.join(out_dir, 'train_30d_forecast_v1.csv')
    forecast_df[forecast_df['split'] == 'train'].to_csv(train_path, index=False)
    
    val_path = os.path.join(out_dir, 'validation_30d_forecast_v1.csv')
    forecast_df[forecast_df['split'] == 'validation'].to_csv(val_path, index=False)
    
    test_path = os.path.join(out_dir, 'test_30d_forecast_v1.csv')
    forecast_df[forecast_df['split'] == 'test'].to_csv(test_path, index=False)
    
    # Create Schemas & Manifests
    schema = {
        "version": "forecast_30d_target_schema_v1",
        "selected_forecast_window": f"{candidates[selected_window][0]}-{candidates[selected_window][1]} days",
        "nominal_forecast_horizon": 30,
        "target_selection_rule": "Min abs(gap - 30), tie-break earlier visit",
        "primary_prediction_target": "target_verified_waz",
        "secondary_observed_target": "target_weight_kg",
        "evaluation_field": "weight_change_kg_30d_observed",
        "stage_6_split_inheritance": True,
        "forbidden_future_fields": [
            "target_visit_date", "target_age_days", "target_weight_kg", 
            "target_verified_waz", "target_verified_haz", "weight_change_kg_30d_observed"
        ],
        "no_interpolation_policy": True,
        "no_fabricated_monthly_measurements_policy": True,
        "explicit_warning": "The Stage 14 forecast output MUST NOT be used as an input to the frozen 180-day XGBoost risk model without a completely new research experiment and revalidation."
    }
    
    schema_dir = os.path.join(project_root, 'data', 'schemas')
    os.makedirs(schema_dir, exist_ok=True)
    schema_path = os.path.join(schema_dir, 'forecast_30d_target_schema_v1.json')
    with open(schema_path, 'w') as f:
        json.dump(schema, f, indent=4)
        
    manifest = {
        "source_dataset": "data/features/chdr_temporal_features_v1.csv",
        "selected_target_window": schema['selected_forecast_window'],
        "creation_timestamp": pd.Timestamp.now().isoformat(),
        "pair_count": len(forecast_df),
        "unique_children": forecast_df['child_id'].nunique(),
        "train_pairs": len(forecast_df[forecast_df['split'] == 'train']),
        "train_children": forecast_df[forecast_df['split'] == 'train']['child_id'].nunique(),
        "validation_pairs": len(forecast_df[forecast_df['split'] == 'validation']),
        "validation_children": forecast_df[forecast_df['split'] == 'validation']['child_id'].nunique(),
        "test_pairs": len(forecast_df[forecast_df['split'] == 'test']),
        "test_children": forecast_df[forecast_df['split'] == 'test']['child_id'].nunique(),
        "actual_horizon_statistics": {
            "mean": float(forecast_df['forecast_horizon_days'].mean()),
            "median": float(forecast_df['forecast_horizon_days'].median()),
            "min": int(forecast_df['forecast_horizon_days'].min()),
            "max": int(forecast_df['forecast_horizon_days'].max())
        },
        "target_definitions": {
            "primary": schema['primary_prediction_target']
        },
        "stage12_research_core_version": "research-core-v1",
        "stage12_checksum_verification_status": "PASS"
    }
    
    manifest_dir = os.path.join(project_root, 'models', 'metadata')
    os.makedirs(manifest_dir, exist_ok=True)
    manifest_path = os.path.join(manifest_dir, 'forecast_30d_dataset_v1_manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=4)
        
    # Generate Stage 13 checksums
    checksum_files = {
        "data/forecasting/chdr_30d_forecast_pairs_v1.csv": calculate_sha256(full_path),
        "data/forecasting/train_30d_forecast_v1.csv": calculate_sha256(train_path),
        "data/forecasting/validation_30d_forecast_v1.csv": calculate_sha256(val_path),
        "data/forecasting/test_30d_forecast_v1.csv": calculate_sha256(test_path),
        "data/schemas/forecast_30d_target_schema_v1.json": calculate_sha256(schema_path),
        "models/metadata/forecast_30d_dataset_v1_manifest.json": calculate_sha256(manifest_path)
    }
    checksums = {
        "version": "forecast_dataset_v1",
        "algorithm": "SHA256",
        "files": checksum_files
    }
    checksums_path = os.path.join(manifest_dir, 'forecast_30d_dataset_v1_checksums.json')
    with open(checksums_path, 'w') as f:
        json.dump(checksums, f, indent=4)
        
    # Write summary for report consumption
    report_data = {
        "candidates": {k: {kk: vv for kk, vv in v.items() if kk != 'deduped_df'} for k, v in results.items()},
        "selected": selected_window,
        "waz_stats": waz_stats,
        "weight_stats": weight_stats,
        "weight_change_stats": weight_change_stats,
        "manifest": manifest,
        "correlation": {
            "index_waz_vs_future_waz": float(forecast_df['index_verified_waz'].corr(forecast_df['target_verified_waz'])),
            "index_weight_vs_future_weight": float(forecast_df['index_weight_kg'].corr(forecast_df['target_weight_kg']))
        }
    }
    os.makedirs(os.path.join(project_root, 'research', 'forecasting', 'evaluation'), exist_ok=True)
    with open(os.path.join(project_root, 'research', 'forecasting', 'evaluation', 'stage13_feasibility_data.json'), 'w') as f:
        json.dump(report_data, f, indent=4)
        
    print("Stage 13 feasibility analysis and dataset construction complete.")

if __name__ == "__main__":
    main()
