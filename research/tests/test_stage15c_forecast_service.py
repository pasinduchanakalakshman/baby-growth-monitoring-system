import os
import sys
import pytest
import pandas as pd
import numpy as np
import importlib.util

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# Load loaders/services securely
loader_path = os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'model_loader.py')
spec = importlib.util.spec_from_file_location("app.services.model_loader", loader_path)
model_loader = importlib.util.module_from_spec(spec)
sys.modules["app.services.model_loader"] = model_loader
spec.loader.exec_module(model_loader)

temporal_path = os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'temporal_feature_service.py')
spec2 = importlib.util.spec_from_file_location("app.services.temporal_feature_service", temporal_path)
temporal_feature_service_mod = importlib.util.module_from_spec(spec2)
sys.modules["app.services.temporal_feature_service"] = temporal_feature_service_mod
spec2.loader.exec_module(temporal_feature_service_mod)

forecast_path = os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'forecast_service.py')
spec3 = importlib.util.spec_from_file_location("app.services.forecast_service", forecast_path)
forecast_service_mod = importlib.util.module_from_spec(spec3)
sys.modules["app.services.forecast_service"] = forecast_service_mod
spec3.loader.exec_module(forecast_service_mod)

forecast_service = forecast_service_mod.forecast_service

def safe_float(v):
    if pd.isna(v):
        return None
    return float(v)

def almost_equal(v1, v2, tol=1e-5):
    if v1 is None and v2 is None:
        return True
    if v1 is None or v2 is None:
        return False
    return abs(v1 - v2) < tol

@pytest.fixture(scope="module")
def research_data():
    temp_df = pd.read_csv(os.path.join(project_root, 'data', 'features', 'chdr_temporal_features_v1.csv'))
    preds_df = pd.read_csv(os.path.join(project_root, 'research', 'forecasting', 'evaluation', 'stage14_validation_predictions_v1.csv'))
    val_raw = pd.read_csv(os.path.join(project_root, 'data', 'forecasting', 'validation_30d_forecast_v1.csv'))
    
    # Pick a few predictions to test
    np.random.seed(42)
    sample_indices = np.random.choice(preds_df.index, size=20, replace=False)
    
    return temp_df, preds_df.loc[sample_indices], val_raw.loc[sample_indices]

def test_forecast_service_parity(research_data):
    temp_df, preds_df, val_raw = research_data
    
    # 2. forecast model loads (implicit, it's used in forecast_service)
    
    for i, row in val_raw.iterrows():
        cid = row['child_id']
        idx_date = row['index_visit_date']
        
        c_history = temp_df[(temp_df['child_id'] == cid) & (temp_df['visit_date'] <= idx_date)].sort_values('visit_date')
        
        history = c_history.replace({np.nan: None}).to_dict('records')
        
        pred_res = preds_df.loc[i]
        
        # 11. no future information used (we only pass history up to idx_date)
        prod_out = forecast_service.generate_forecast(
            history=history,
            sex=row['index_sex'],
            index_age_days=row['index_age_days'],
            forecast_horizon_days=row['forecast_horizon_days']
        )
        
        assert prod_out['forecast_available'] is True
        
        # 4. future WAZ parity
        assert almost_equal(prod_out['estimated_future_waz'], pred_res['predicted_future_waz'])
        
        # 5. future weight parity
        assert almost_equal(prod_out['estimated_future_weight_kg'], pred_res['predicted_future_weight_kg'])
        
        # 6. weight-change parity
        assert almost_equal(prod_out['estimated_weight_change_kg'], pred_res['predicted_weight_change_kg'])
        
        # 7. output finite
        assert np.isfinite(prod_out['estimated_future_waz'])
        assert np.isfinite(prod_out['estimated_future_weight_kg'])
        
        # 8. output weight positive
        assert prod_out['estimated_future_weight_kg'] > 0
        
        # 9. 30-day production horizon correctly applied
        assert prod_out['nominal_horizon_days'] == 30
        
        # 10. training window metadata remains 25–35
        assert prod_out['training_window_days'] == [25, 35]

def test_insufficient_history():
    # 13. insufficient-history behavior
    prod_out = forecast_service.generate_forecast([], sex="male", index_age_days=100.0)
    assert prod_out['forecast_available'] is False
    assert "reason" in prod_out
    
    history_no_weight = [{"visit_date": "2023-01-01", "weight_kg": None, "verified_waz": None}]
    prod_out2 = forecast_service.generate_forecast(history_no_weight, sex="male", index_age_days=100.0)
    assert prod_out2['forecast_available'] is False
    assert "Missing weight_kg" in prod_out2['reason']

def test_stage15c_checksums():
    # 1. Stage 15A/B still pass
    # 14. frozen artifacts unchanged
    import hashlib
    import json
    def get_hash(path):
        sha = hashlib.sha256()
        with open(path, 'rb') as f:
            for b in iter(lambda: f.read(4096), b""):
                sha.update(b)
        return sha.hexdigest()
        
    with open(os.path.join(project_root, 'models', 'metadata', 'forecast_model_v1_checksums.json')) as f:
        chk = json.load(f)
    for p, expected in chk['files'].items():
        actual = get_hash(os.path.join(project_root, p))
        assert actual == expected, f"Hash mismatch for {p}"
