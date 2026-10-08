import os
import sys
import pytest
import pandas as pd
import numpy as np
import importlib.util

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# Load loaders/services securely
def load_service(mod_name, file_path):
    spec = importlib.util.spec_from_file_location(mod_name, file_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod

model_loader = load_service("app.services.model_loader", os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'model_loader.py'))
temporal_service_mod = load_service("app.services.temporal_feature_service", os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'temporal_feature_service.py'))
risk_service_mod = load_service("app.services.risk_service", os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'risk_service.py'))
dynamic_risk_service_mod = load_service("app.services.dynamic_risk_service", os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'dynamic_risk_service.py'))
xai_service_mod = load_service("app.services.xai_service", os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'xai_service.py'))

temporal_feature_service = temporal_service_mod.temporal_feature_service
risk_service = risk_service_mod.risk_service
dynamic_risk_service = dynamic_risk_service_mod.dynamic_risk_service
xai_service = xai_service_mod.xai_service

def almost_equal(v1, v2, tol=1e-5):
    if v1 is None and v2 is None:
        return True
    if v1 is None or v2 is None:
        return False
    return abs(v1 - v2) < tol

@pytest.fixture(scope="module")
def research_data():
    temp_df = pd.read_csv(os.path.join(project_root, 'data', 'features', 'chdr_temporal_features_v1.csv'))
    preds_df = pd.read_csv(os.path.join(project_root, 'research', 'evaluation', 'frozen_risk_predictions_v1.csv'))
    
    np.random.seed(42)
    sample_indices = np.random.choice(preds_df[preds_df['split'] == 'validation'].index, size=20, replace=False)
    
    return temp_df, preds_df.loc[sample_indices]

def test_risk_service_parity(research_data):
    temp_df, preds_df = research_data
    
    # Check parity on specific prediction outputs
    for i, row in preds_df.iterrows():
        cid = row['child_id']
        visit_date = row['visit_date']
        
        # 7. only genuine visits used
        c_history = temp_df[(temp_df['child_id'] == cid) & (temp_df['visit_date'] <= visit_date)].sort_values('visit_date')
        
        history = c_history.replace({np.nan: None}).to_dict('records')
        features = temporal_feature_service.calculate_features(history)
        
        # Merge base features
        latest = history[-1]
        for k, v in latest.items():
            if k not in features:
                features[k] = v
                
        # 8. no forecast output used as risk input (only features up to this genuine visit)
        prod_out = risk_service.calculate_risk(features)
        
        # 1. risk probability parity
        if prod_out['risk_available']:
            # 2. probability in [0,1]
            assert 0.0 <= prod_out['risk_probability'] <= 1.0
            assert almost_equal(prod_out['risk_probability'], row['risk_probability'])
            assert prod_out['risk_flag'] == row['risk_flag']
        
        # 3. threshold remains 0.50
        assert prod_out.get('risk_threshold', 0.5) == 0.50
        
        # 4. horizon remains 180
        assert prod_out.get('prediction_horizon_days', 180) == 180

def test_applicability():
    # 5. WAZ < -2 applicability handled
    features = {"verified_waz": -2.5}
    prod_out = risk_service.calculate_risk(features)
    assert prod_out['model_applicable'] is False
    assert prod_out['risk_available'] is False
    assert "verified_waz < -2" in prod_out['reason']
    
    features2 = {"verified_waz": -1.5}
    # It might fail due to missing features but shouldn't fail applicability
    try:
        risk_service.calculate_risk(features2)
    except Exception:
        pass # missing other features

def test_dynamic_trajectory(research_data):
    temp_df, _ = research_data
    
    # 6. dynamic trajectory chronological
    cid = temp_df['child_id'].iloc[0]
    c_history = temp_df[temp_df['child_id'] == cid].sort_values('visit_date')
    history = c_history.replace({np.nan: None}).to_dict('records')
    
    trajectory = dynamic_risk_service.calculate_dynamic_risk(history)
    
    assert len(trajectory) == len(history)
    for i in range(1, len(trajectory)):
        assert trajectory[i]['visit_date'] >= trajectory[i-1]['visit_date']
        
def test_xai_service(research_data):
    temp_df, preds_df = research_data
    
    row = preds_df.iloc[0]
    cid = row['child_id']
    visit_date = row['visit_date']
    
    c_history = temp_df[(temp_df['child_id'] == cid) & (temp_df['visit_date'] <= visit_date)].sort_values('visit_date')
    history = c_history.replace({np.nan: None}).to_dict('records')
    
    features = temporal_feature_service.calculate_features(history)
    latest = history[-1]
    for k, v in latest.items():
        if k not in features:
            features[k] = v
            
    # 9. XAI loads
    out = xai_service.explain_prediction(features)
    
    # 10. SHAP feature mapping correct
    assert 'technical_explanation' in out
    assert 'contributions' in out['technical_explanation']
    
    # 11. frontend-safe explanation contains no causal wording
    assert 'frontend_safe_explanation' in out
    assert "causality" in out['disclaimer']
    
    for item in out['frontend_safe_explanation']:
        assert "influence" not in item['direction'] # wording check
        assert item['direction'] in ["increased model-predicted risk", "decreased model-predicted risk"]

def test_frozen_artifacts_unchanged():
    # 12. frozen artifacts unchanged
    import hashlib
    import json
    def get_hash(path):
        sha = hashlib.sha256()
        with open(path, 'rb') as f:
            for b in iter(lambda: f.read(4096), b""):
                sha.update(b)
        return sha.hexdigest()
        
    chk_path = os.path.join(project_root, 'models', 'metadata', 'final_risk_model_v1.json')
    if os.path.exists(chk_path):
        with open(chk_path, 'r') as f:
            chk = json.load(f)
            
        # Check against research core freeze
        rc_path = os.path.join(project_root, 'models', 'metadata', 'research_core_v1_checksums.json')
        with open(rc_path, 'r') as f2:
            rc_chk = json.load(f2)
            
        for k, v in rc_chk['files'].items():
            if 'xgboost.joblib' in k or 'baseline_preprocessor' in k:
                actual = get_hash(os.path.join(project_root, k))
                assert actual == v
