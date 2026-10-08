import os
import sys
import json
import math
import pandas as pd
import pytest

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(os.path.join(project_root, 'research', 'scripts'))

import risk_inference as ri

@pytest.fixture(scope="module")
def paths():
    return {
        "manifest": os.path.join(project_root, 'models', 'metadata', 'research_core_v1_manifest.json'),
        "checksums": os.path.join(project_root, 'models', 'metadata', 'research_core_v1_checksums.json'),
        "risk_meta": os.path.join(project_root, 'models', 'metadata', 'final_risk_model_v1.json'),
        "seq_meta": os.path.join(project_root, 'models', 'metadata', 'final_sequence_model_v1.json'),
        "schema": os.path.join(project_root, 'models', 'metadata', 'baseline_feature_metadata_v1.json'),
        "contract": os.path.join(project_root, 'data', 'schemas', 'research_core_v1_feature_contract.json'),
        "train": os.path.join(project_root, 'data', 'splits', 'v1', 'train.csv'),
        "val": os.path.join(project_root, 'data', 'splits', 'v1', 'validation.csv'),
        "test": os.path.join(project_root, 'data', 'splits', 'v1', 'test.csv'),
        "fixture": os.path.join(project_root, 'research', 'tests', 'fixtures', 'research_core_v1_predictions.json')
    }

def test_manifest_exists_and_version(paths):
    assert os.path.exists(paths['manifest'])
    with open(paths['manifest'], 'r') as f:
        manifest = json.load(f)
    assert manifest['version'] == 'research-core-v1'

def test_critical_artifacts_exist(paths):
    assert os.path.exists(paths['checksums'])
    with open(paths['checksums'], 'r') as f:
        chk = json.load(f)
    for p in chk['files'].keys():
        assert os.path.exists(os.path.join(project_root, p))

def test_split_integrity(paths):
    df_train = pd.read_csv(paths['train'])
    df_val = pd.read_csv(paths['val'])
    df_test = pd.read_csv(paths['test'])
    
    train_c = set(df_train['child_id'].unique())
    val_c = set(df_val['child_id'].unique())
    test_c = set(df_test['child_id'].unique())
    
    # 5. train/val/test children do not overlap
    assert len(train_c.intersection(val_c)) == 0, "Train and Validation overlap"
    assert len(train_c.intersection(test_c)) == 0, "Train and Test overlap"
    assert len(val_c.intersection(test_c)) == 0, "Validation and Test overlap"
    
    # target remains future_growth_faltering_180d and is binary
    for df in [df_train, df_val, df_test]:
        assert 'future_growth_faltering_180d' in df.columns
        assert set(df['future_growth_faltering_180d'].dropna().unique()).issubset({0, 1})

def test_model_metadata(paths):
    with open(paths['risk_meta'], 'r') as f:
        meta = json.load(f)
    
    # 6. target remains future_growth_faltering_180d
    assert meta['target'] == 'future_growth_faltering_180d'
    # 7. horizon remains 180
    assert meta['prediction_horizon_days'] == 180
    # 8. threshold remains 0.50
    assert meta['threshold'] == 0.50
    # 9. primary model remains XGBoost
    assert meta['model_type'] == 'xgboost'
    
    with open(paths['seq_meta'], 'r') as f:
        smeta = json.load(f)
    # 10. Transformer remains recorded
    assert smeta['model_type'] == 'transformer'

def test_feature_schema(paths):
    # 11. feature schema exists
    assert os.path.exists(paths['schema'])
    assert os.path.exists(paths['contract'])

def test_inference_loads_and_deterministic(paths):
    # 12. primary model loads
    # this implicitly tests loading inside risk_inference.py
    
    assert os.path.exists(paths['fixture'])
    with open(paths['fixture'], 'r') as f:
        cases = json.load(f)
        
    df_test = pd.read_csv(paths['test'])
    
    for case in cases:
        cid = case['child_id']
        vdate = case['visit_date']
        expected_prob = case['expected_probability']
        
        child_rows = df_test[(df_test['child_id'] == cid) & (df_test['visit_date'] == vdate)]
        assert not child_rows.empty
        obs = child_rows.iloc[0]
        
        obs_clean = obs.drop(labels=[c for c in ri.FORBIDDEN_FIELDS if c in obs.index], errors='ignore')
        
        # 16. no Stage 13 forecast model is accidentally treated as input
        assert 'future_waz_30d_forecast' not in obs_clean.index
        
        res = ri.predict_risk(obs_clean, child_id=cid, assessment_date=vdate)
        
        # 13. inference probabilities are finite
        assert math.isfinite(res['risk_probability'])
        
        # 14. probabilities fall within [0,1]
        assert 0.0 <= res['risk_probability'] <= 1.0
        
        # 15. deterministic inference test passes
        assert math.isclose(res['risk_probability'], expected_prob, abs_tol=1e-6)
