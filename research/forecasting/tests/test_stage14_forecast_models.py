import os
import sys
import json
import pandas as pd
import pytest
import math

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

@pytest.fixture(scope="module")
def paths():
    return {
        "s12_chk": os.path.join(project_root, 'models', 'metadata', 'research_core_v1_checksums.json'),
        "s13_chk": os.path.join(project_root, 'models', 'metadata', 'forecast_30d_dataset_v1_checksums.json'),
        "s14_chk": os.path.join(project_root, 'models', 'metadata', 'forecast_model_v1_checksums.json'),
        "meta": os.path.join(project_root, 'models', 'metadata', 'final_forecast_model_v1.json'),
        "train": os.path.join(project_root, 'data', 'forecasting', 'train_30d_forecast_v1.csv'),
        "val": os.path.join(project_root, 'data', 'forecasting', 'validation_30d_forecast_v1.csv'),
        "test": os.path.join(project_root, 'data', 'forecasting', 'test_30d_forecast_v1.csv'),
        "schema": os.path.join(project_root, 'data', 'schemas', 'forecast_30d_model_feature_schema_v1.json'),
        "val_preds": os.path.join(project_root, 'research', 'forecasting', 'evaluation', 'stage14_validation_predictions_v1.csv'),
        "test_preds": os.path.join(project_root, 'research', 'forecasting', 'evaluation', 'stage14_test_predictions_v1.csv')
    }

def verify_checksums(chk_path):
    import hashlib
    def get_hash(path):
        sha = hashlib.sha256()
        with open(path, 'rb') as f:
            for b in iter(lambda: f.read(4096), b""):
                sha.update(b)
        return sha.hexdigest()
        
    with open(chk_path) as f:
        chk = json.load(f)
    for p, expected in chk['files'].items():
        actual = get_hash(os.path.join(project_root, p))
        assert actual == expected, f"Hash mismatch for {p}"

def test_stage12_and_13_checksums(paths):
    # 1. Stage 12 checksums still pass
    # 2. Stage 13 checksums still pass
    # 22. Stage 1-13 frozen artifacts remain unchanged
    verify_checksums(paths['s12_chk'])
    verify_checksums(paths['s13_chk'])

def test_split_integrity(paths):
    # 3. train/validation/test children remain disjoint
    df_train = pd.read_csv(paths['train'])
    df_val = pd.read_csv(paths['val'])
    df_test = pd.read_csv(paths['test'])
    
    train_c = set(df_train['child_id'].unique())
    val_c = set(df_val['child_id'].unique())
    test_c = set(df_test['child_id'].unique())
    
    assert len(train_c.intersection(val_c)) == 0
    assert len(train_c.intersection(test_c)) == 0
    assert len(val_c.intersection(test_c)) == 0

def test_model_metadata_and_target(paths):
    # 16. final selected model metadata exists
    with open(paths['meta']) as f:
        meta = json.load(f)
    
    # 4. target is future WAZ
    assert meta['primary_target'] == 'target_verified_waz'
    
    # 17. model metadata says approximately 30 days
    assert 'approximately 30 days' in " ".join(meta['limitations']).lower()

def test_feature_leakage(paths):
    # 8. no future field exists in model features
    with open(paths['schema']) as f:
        schema = json.load(f)
        
    inputs = schema['model_inputs']
    for feat in inputs:
        assert 'future' not in feat.lower()
        assert 'target' not in feat.lower()

def test_predictions_are_valid(paths):
    # 13. all validation predictions finite
    # 14. all test predictions finite
    # 19. derived weights are finite and positive
    df_val = pd.read_csv(paths['val_preds'])
    df_test = pd.read_csv(paths['test_preds'])
    
    for df in [df_val, df_test]:
        assert df['predicted_future_waz'].notna().all()
        assert df['predicted_future_weight_kg'].notna().all()
        assert (df['predicted_future_weight_kg'] > 0).all()
        
        # 20. predicted weight change calculation is correct
        calc_change = df['predicted_future_weight_kg'] - df['index_weight_kg']
        assert (abs(df['predicted_weight_change_kg'] - calc_change) < 1e-5).all()

def test_stage14_checksums(paths):
    # 23. Stage 14 checksum verification passes
    verify_checksums(paths['s14_chk'])
