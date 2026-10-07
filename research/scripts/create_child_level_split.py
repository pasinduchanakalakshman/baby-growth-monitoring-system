import pandas as pd
import numpy as np
import os
import json
import sys

def process_child_level_split():
    print("==================================================")
    print("STARTING STAGE 6: CHILD-LEVEL STRATIFIED SPLIT")
    print("==================================================")

    input_path = os.path.join('data', 'processed', 'chdr_supervised_180d_v1.csv')
    
    splits_dir = os.path.join('data', 'splits', 'v1')
    report_path = os.path.join('research', 'evaluation', 'child_level_split_report_v1.json')
    metadata_path = os.path.join(splits_dir, 'split_metadata.json')

    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        sys.exit(1)

    df = pd.read_csv(input_path)
    if df.empty:
        print("Input dataset is empty.")
        sys.exit(1)
        
    df['visit_date'] = pd.to_datetime(df['visit_date'])
    df = df.sort_values(['child_id', 'visit_date']).reset_index(drop=True)
    
    # 1. Calculate child-level statistics
    child_stats = df.groupby('child_id').agg(
        observation_count_in_supervised_dataset=('visit_date', 'count'),
        positive_observation_count=('future_growth_faltering_180d', 'sum')
    ).reset_index()
    
    child_stats['child_has_positive_target'] = (child_stats['positive_observation_count'] > 0).astype(int)
    
    # 2. Stratified Split (70/15/15)
    train_ids = []
    val_ids = []
    test_ids = []
    
    for _, group in child_stats.groupby('child_has_positive_target'):
        shuffled = group.sample(frac=1, random_state=42)
        n = len(shuffled)
        n_train = int(np.round(n * 0.70))
        n_val = int(np.round(n * 0.15))
        
        train_ids.extend(shuffled.iloc[:n_train]['child_id'].tolist())
        val_ids.extend(shuffled.iloc[n_train:n_train+n_val]['child_id'].tolist())
        test_ids.extend(shuffled.iloc[n_train+n_val:]['child_id'].tolist())
        
    train_children = child_stats[child_stats['child_id'].isin(train_ids)].copy()
    val_children = child_stats[child_stats['child_id'].isin(val_ids)].copy()
    test_children = child_stats[child_stats['child_id'].isin(test_ids)].copy()
    
    # 3. Create observation-level datasets
    train_df = df[df['child_id'].isin(train_children['child_id'])].copy()
    val_df = df[df['child_id'].isin(val_children['child_id'])].copy()
    test_df = df[df['child_id'].isin(test_children['child_id'])].copy()
    
    # Sort them chronically again just to be strictly compliant
    train_df = train_df.sort_values(['child_id', 'visit_date']).reset_index(drop=True)
    val_df = val_df.sort_values(['child_id', 'visit_date']).reset_index(drop=True)
    test_df = test_df.sort_values(['child_id', 'visit_date']).reset_index(drop=True)
    
    # Validation Rules
    train_set = set(train_children['child_id'])
    val_set = set(val_children['child_id'])
    test_set = set(test_children['child_id'])
    all_set = set(child_stats['child_id'])
    
    overlap_train_val = len(train_set.intersection(val_set))
    overlap_train_test = len(train_set.intersection(test_set))
    overlap_val_test = len(val_set.intersection(test_set))
    
    union_set = train_set.union(val_set).union(test_set)
    child_reconciliation = len(union_set) == len(all_set)
    row_reconciliation = (len(train_df) + len(val_df) + len(test_df)) == len(df)
    
    def generate_stats(child_df, obs_df):
        return {
            "children": len(child_df),
            "observations": len(obs_df),
            "positive_observations": int(obs_df['future_growth_faltering_180d'].sum()),
            "negative_observations": int(len(obs_df) - obs_df['future_growth_faltering_180d'].sum()),
            "positive_percentage": float(obs_df['future_growth_faltering_180d'].mean() * 100) if len(obs_df) > 0 else 0,
            "children_with_positive_targets": int(child_df['child_has_positive_target'].sum()),
            "children_with_zero_positive_targets": int(len(child_df) - child_df['child_has_positive_target'].sum()),
            "child_positive_percentage": float(child_df['child_has_positive_target'].mean() * 100) if len(child_df) > 0 else 0,
            "mean_observations_per_child": float(child_df['observation_count_in_supervised_dataset'].mean()) if len(child_df) > 0 else 0,
            "median_observations_per_child": float(child_df['observation_count_in_supervised_dataset'].median()) if len(child_df) > 0 else 0
        }
        
    overall_stats = generate_stats(child_stats, df)
    train_stats = generate_stats(train_children, train_df)
    val_stats = generate_stats(val_children, val_df)
    test_stats = generate_stats(test_children, test_df)
    
    metadata = {
        "version": "v1",
        "random_seed": 42,
        "strategy": "child_level_stratified",
        "ratios": {
            "train": 0.70,
            "validation": 0.15,
            "test": 0.15
        },
        "input_rows": int(len(df)),
        "input_children": int(len(child_stats)),
        "train": train_stats,
        "validation": val_stats,
        "test": test_stats,
        "child_overlap": {
            "train_validation": overlap_train_val,
            "train_test": overlap_train_test,
            "validation_test": overlap_val_test
        },
        "row_reconciliation_passed": bool(row_reconciliation),
        "child_reconciliation_passed": bool(child_reconciliation)
    }
    
    warnings = []
    if overlap_train_val > 0 or overlap_train_test > 0 or overlap_val_test > 0:
        warnings.append("CRITICAL: Child overlap detected between partitions!")
    if not row_reconciliation:
        warnings.append("CRITICAL: Total rows in splits do not match input rows!")
    if not child_reconciliation:
        warnings.append("CRITICAL: Total children in splits do not match input children!")
        
    for name, stats in [("Train", train_stats), ("Validation", val_stats), ("Test", test_stats)]:
        if stats["positive_observations"] == 0:
            warnings.append(f"WARNING: {name} partition contains zero positive observations!")
        if stats["children_with_positive_targets"] == 0:
            warnings.append(f"WARNING: {name} partition contains zero positive-event children!")
            
    # Check prevalence consistency (allow within 5% absolute difference max, or relative ratio)
    child_prev_train = train_stats["child_positive_percentage"]
    child_prev_val = val_stats["child_positive_percentage"]
    child_prev_test = test_stats["child_positive_percentage"]
    max_diff = max(abs(child_prev_train - child_prev_val), abs(child_prev_train - child_prev_test), abs(child_prev_val - child_prev_test))
    if max_diff > 10.0:  # 10% absolute difference might be too big for stratified
        warnings.append(f"WARNING: Child-level target prevalence differs excessively across partitions (Max diff {max_diff:.2f}%)")

    report = {
        "metadata": metadata,
        "warnings": warnings,
        "status": "PASSED" if not warnings else "WARNINGS_OR_FAILED"
    }
    
    # Ensure directories exist
    os.makedirs(splits_dir, exist_ok=True)
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    
    # Save outputs
    # 1. Observation-level data
    train_df.to_csv(os.path.join(splits_dir, 'train.csv'), index=False)
    val_df.to_csv(os.path.join(splits_dir, 'validation.csv'), index=False)
    test_df.to_csv(os.path.join(splits_dir, 'test.csv'), index=False)
    
    # 2. Child manifests
    child_cols = ['child_id', 'child_has_positive_target', 'observation_count_in_supervised_dataset', 'positive_observation_count']
    train_children[child_cols].to_csv(os.path.join(splits_dir, 'train_children.csv'), index=False)
    val_children[child_cols].to_csv(os.path.join(splits_dir, 'validation_children.csv'), index=False)
    test_children[child_cols].to_csv(os.path.join(splits_dir, 'test_children.csv'), index=False)
    
    # 3. Metadata and report
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=4)
        
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=4)
        
    if warnings:
        print("STAGE 6 completed with WARNINGS:")
        for w in warnings:
            print(f" - {w}")
    else:
        print("STAGE 6 completed successfully.")
    print(f"Report saved to {report_path}")

if __name__ == '__main__':
    process_child_level_split()
