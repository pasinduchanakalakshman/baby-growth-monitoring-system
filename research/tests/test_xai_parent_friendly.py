import os
import sys
import pytest
import importlib.util

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def load_service(mod_name, file_path):
    spec = importlib.util.spec_from_file_location(mod_name, file_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod

xai_service_mod = load_service(
    "app.services.xai_service",
    os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'xai_service.py')
)
get_display_label = xai_service_mod.get_display_label
xai_service = xai_service_mod.xai_service

def test_feature_name_mapping():
    assert get_display_label("weight_kg") == "Current weight"
    assert get_display_label("length_height_cm") == "Current length / height"
    assert get_display_label("birth_length_cm") == "Length at birth"
    assert get_display_label("days_since_previous_visit") == "Time since previous growth check"
    assert get_display_label("weight_velocity_kg_per_day") == "Average daily weight change"
    assert get_display_label("haz_velocity_per_day") == "Change in length-for-age growth score"
    assert get_display_label("sex_Female") == "Biological sex: Female"
    assert get_display_label("delivery_type_Vaginal") == "Type of delivery: Vaginal"

def test_xai_coverage_disclosure_and_safety():
    # Synthetic visit features
    features = {
        "verified_waz": -1.2,
        "verified_haz": -0.8,
        "weight_kg": 7.5,
        "length_height_cm": 68.0,
        "age_days": 180,
        "sex": "Female",
        "date_of_birth": "2020-01-01",
        "days_since_previous_visit": 30,
        "weight_velocity_kg_per_day": 0.015,
        "haz_velocity_per_day": 0.01
    }
    
    out = xai_service.explain_prediction(features)
    
    # 1. Structure
    assert "technical_explanation" in out
    assert "frontend_safe_explanation" in out
    assert "disclaimer" in out
    assert "model_coverage_disclosure" in out
    
    # 2. Coverage disclosure discloses 90% XGBoost branch
    assert "90%" in out["model_coverage_disclosure"]
    assert "XGBoost" in out["model_coverage_disclosure"]
    assert "Transformer" in out["model_coverage_disclosure"]
    
    # 3. Non-causal wording
    assert "causality" in out["disclaimer"]
    
    for item in out["frontend_safe_explanation"]:
        assert item["direction"] in ["increased model-predicted risk", "decreased model-predicted risk"]
        assert "caused" not in item["direction"].lower()
        # Internal identifier preserved
        assert isinstance(item["feature"], str) and len(item["feature"]) > 0
        # Display label is not raw underscored string
        assert "_" not in item["display_label"]
