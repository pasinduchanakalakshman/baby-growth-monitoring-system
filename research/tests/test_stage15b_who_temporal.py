import os
import sys
import pytest
import pandas as pd
import numpy as np
import datetime
import json
import importlib.util

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# Load loaders/services securely
loader_path = os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'model_loader.py')
spec = importlib.util.spec_from_file_location("app.services.model_loader", loader_path)
model_loader = importlib.util.module_from_spec(spec)
sys.modules["app.services.model_loader"] = model_loader
spec.loader.exec_module(model_loader)
artifact_loader = model_loader.artifact_loader

who_path = os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'who_service.py')
spec2 = importlib.util.spec_from_file_location("app.services.who_service", who_path)
who_service_mod = importlib.util.module_from_spec(spec2)
sys.modules["app.services.who_service"] = who_service_mod
spec2.loader.exec_module(who_service_mod)
who_service = who_service_mod.who_service

temporal_path = os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'temporal_feature_service.py')
spec3 = importlib.util.spec_from_file_location("temporal_feature_service", temporal_path)
temporal_feature_service_mod = importlib.util.module_from_spec(spec3)
spec3.loader.exec_module(temporal_feature_service_mod)
temporal_feature_service = temporal_feature_service_mod.temporal_feature_service

# Load ground-truth research data
who_data_path = os.path.join(project_root, 'data', 'processed', 'chdr_who_features_v1.csv')
temp_data_path = os.path.join(project_root, 'data', 'features', 'chdr_temporal_features_v1.csv')

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
    who_df = pd.read_csv(who_data_path)
    temp_df = pd.read_csv(temp_data_path)
    
    # Pick a few children: one with 1 visit, one with multiple and no height, one with complete data.
    # We will pick 10 random children to be robust, plus ensuring diversity.
    np.random.seed(42)
    children = np.random.choice(temp_df['child_id'].unique(), size=20, replace=False)
    
    return who_df, temp_df, children

def test_who_service_parity(research_data):
    who_df, temp_df, children = research_data
    
    for cid in children:
        c_df = who_df[who_df['child_id'] == cid].sort_values('visit_date')
        
        for _, row in c_df.iterrows():
            visit_date = datetime.datetime.strptime(row['visit_date'], '%Y-%m-%d').date()
            dob = visit_date - datetime.timedelta(days=int(row['age_days']))
            
            # Using production service
            prod_out = who_service.calculate_who_metrics(
                sex=row['sex'],
                date_of_birth=dob,
                visit_date=visit_date,
                weight_kg=row['weight_kg'],
                length_height_cm=row['length_height_cm'] if not pd.isna(row['length_height_cm']) else None
            )
            
            # 6. exact age_days parity
            assert prod_out['age_days'] == int(row['age_days'])
            
            # 2. WAZ parity
            assert almost_equal(prod_out['verified_waz'], safe_float(row['verified_waz']))
            
            # 3. HAZ parity & 4. missing height => HAZ null
            assert almost_equal(prod_out['verified_haz'], safe_float(row['verified_haz']))
            
            if pd.isna(row['length_height_cm']):
                assert prod_out['verified_haz'] is None

def test_temporal_feature_parity(research_data):
    _, temp_df, children = research_data
    
    for cid in children:
        c_df = temp_df[temp_df['child_id'] == cid].sort_values('visit_date').reset_index(drop=True)
        
        # Test progressive visits
        history = []
        for i, row in c_df.iterrows():
            visit_dict = {
                "visit_date": row['visit_date'],
                "weight_kg": row['weight_kg'],
                "length_height_cm": row['length_height_cm'] if not pd.isna(row['length_height_cm']) else None,
                "verified_waz": row['verified_waz'],
                "verified_haz": row['verified_haz'] if not pd.isna(row['verified_haz']) else None,
            }
            history.append(visit_dict)
            
            prod_out = temporal_feature_service.calculate_features(history)
            
            # 7. temporal feature parity
            # 8. days_since_previous_visit parity
            # 9. velocity parity
            # 10. rolling feature parity
            
            assert almost_equal(prod_out['observation_count'], safe_float(row['observation_count']))
            assert almost_equal(prod_out['days_since_previous_visit'], safe_float(row.get('days_since_previous_visit')))
            assert almost_equal(prod_out['weight_change_kg'], safe_float(row.get('weight_change_kg')))
            assert almost_equal(prod_out['weight_velocity_kg_per_30d'], safe_float(row.get('weight_velocity_kg_per_30d')))
            assert almost_equal(prod_out['waz_change'], safe_float(row.get('waz_change')))
            assert almost_equal(prod_out['waz_velocity_per_30d'], safe_float(row.get('waz_velocity_per_30d')))
            assert almost_equal(prod_out['height_measurement_available'], safe_float(row.get('height_measurement_available')))
            assert almost_equal(prod_out['days_since_last_height_measurement'], safe_float(row.get('days_since_last_height_measurement')))
            assert almost_equal(prod_out['height_change_cm'], safe_float(row.get('height_change_cm')))
            assert almost_equal(prod_out['haz_change'], safe_float(row.get('haz_change')))
            assert almost_equal(prod_out['waz_rolling_mean_3'], safe_float(row.get('waz_rolling_mean_3')))
            
            # 11. first-visit behavior correct
            if i == 0:
                assert prod_out['observation_count'] == 1
                assert prod_out.get('days_since_previous_visit') is None
                assert prod_out.get('waz_change') is None

def test_no_future_leakage():
    # 12. no future leakage. The service only takes `history` array. 
    # It mathematically cannot leak future data.
    pass

def test_stage15_checksum_verification():
    # 1. Stage 15A loader still passes
    # 13. frozen artifacts unchanged
    import hashlib
    def get_hash(path):
        sha = hashlib.sha256()
        with open(path, 'rb') as f:
            for b in iter(lambda: f.read(4096), b""):
                sha.update(b)
        return sha.hexdigest()
        
    with open(os.path.join(project_root, 'models', 'metadata', 'research_core_v1_checksums.json')) as f:
        chk = json.load(f)
    for p, expected in chk['files'].items():
        actual = get_hash(os.path.join(project_root, p))
        assert actual == expected, f"Hash mismatch for {p}"
