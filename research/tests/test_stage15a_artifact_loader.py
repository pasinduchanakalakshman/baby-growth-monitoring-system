import os
import sys
import json
import pytest

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

import importlib.util

loader_path = os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'model_loader.py')
spec = importlib.util.spec_from_file_location("model_loader", loader_path)
model_loader = importlib.util.module_from_spec(spec)
sys.modules["model_loader"] = model_loader
spec.loader.exec_module(model_loader)
artifact_loader = model_loader.artifact_loader

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

def test_stage12_verification_passes():
    # 1. Stage 12 verification passes
    # 12. no frozen files were modified
    verify_checksums(os.path.join(project_root, 'models', 'metadata', 'research_core_v1_checksums.json'))

def test_stage13_verification_passes():
    # 2. Stage 13 verification passes
    verify_checksums(os.path.join(project_root, 'models', 'metadata', 'forecast_30d_dataset_v1_checksums.json'))

def test_stage14_verification_passes():
    # 3. Stage 14 verification passes
    verify_checksums(os.path.join(project_root, 'models', 'metadata', 'forecast_model_v1_checksums.json'))

def test_loader_risk_components():
    # 4. risk model loads
    # 5. risk preprocessor loads
    # 9. metadata matches frozen configuration (implicitly checked in get_risk_metadata)
    # 10. feature schemas load
    risk_meta = artifact_loader.get_risk_metadata()
    assert risk_meta['model_type'] == 'xgboost'
    
    risk_model = artifact_loader.get_risk_model()
    assert risk_model is not None
    
    risk_prep = artifact_loader.get_risk_preprocessor()
    assert risk_prep is not None
    
    schema = artifact_loader.get_risk_schema()
    assert schema is not None

def test_loader_forecast_components():
    # 6. forecast model loads
    # 7. forecast preprocessor loads
    forecast_meta = artifact_loader.get_forecast_metadata()
    assert forecast_meta['model_name'] == 'Linear'
    
    forecast_model = artifact_loader.get_forecast_model()
    assert forecast_model is not None
    
    forecast_prep = artifact_loader.get_forecast_preprocessor()
    assert forecast_prep is not None
    
    schema = artifact_loader.get_forecast_schema()
    assert schema is not None

def test_loader_who_files():
    # 8. WHO files load
    assert not artifact_loader.get_who_wfa_boys().empty
    assert not artifact_loader.get_who_wfa_girls().empty
    assert not artifact_loader.get_who_lhfa_boys_0_2().empty
    assert not artifact_loader.get_who_lhfa_girls_0_2().empty
    assert not artifact_loader.get_who_lhfa_boys_2_5().empty
    assert not artifact_loader.get_who_lhfa_girls_2_5().empty

def test_loader_caching_behavior():
    # 11. repeated loader access returns reusable/cached artifacts
    meta1 = artifact_loader.get_risk_metadata()
    meta2 = artifact_loader.get_risk_metadata()
    assert id(meta1) == id(meta2)  # Should be the exact same object from cache
    
    model1 = artifact_loader.get_forecast_model()
    model2 = artifact_loader.get_forecast_model()
    assert id(model1) == id(model2)
