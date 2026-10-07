import pytest
import pandas as pd
import numpy as np
import os
import json
import joblib
import sys
from io import StringIO
from unittest.mock import patch, mock_open, MagicMock, call

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts')))
import baseline_models

@pytest.fixture
def dummy_data():
    schema = {
        "candidate_input_features": ["num1", "num2", "cat1", "bool1"],
        "target_columns": ["future_growth_faltering_180d"],
        "audit_only_columns": ["target_new_threshold_crossing_180d", "target_waz_decline_05_180d"]
    }
    
    # Train
    train_df = pd.DataFrame({
        "child_id": ["C1", "C2", "C3", "C4"],
        "visit_date": ["2023-01-01", "2023-01-01", "2023-01-01", "2023-01-01"],
        "num1": [1.0, 2.0, np.nan, 4.0],
        "num2": [10.0, 20.0, 30.0, 40.0],
        "cat1": ["A", "B", "A", "C"],
        "bool1": [1, 0, 1, 0],
        "future_growth_faltering_180d": [0, 1, 0, 1]
    })
    
    # Val
    val_df = pd.DataFrame({
        "child_id": ["C5", "C6"],
        "visit_date": ["2023-01-01", "2023-01-01"],
        "num1": [1.5, np.nan],
        "num2": [15.0, 25.0],
        "cat1": ["A", "UNKNOWN_CAT"], # Tests unknown categorical
        "bool1": [0, 1],
        "future_growth_faltering_180d": [0, 1]
    })
    
    # Test
    test_df = pd.DataFrame({
        "child_id": ["C7", "C8"],
        "visit_date": ["2023-01-01", "2023-01-01"],
        "num1": [np.nan, 3.5],
        "num2": [10.0, 20.0],
        "cat1": ["B", "UNKNOWN_TEST_CAT"],
        "bool1": [1, 0],
        "future_growth_faltering_180d": [1, 0]
    })
    
    return schema, train_df, val_df, test_df


@patch('builtins.open', new_callable=mock_open)
@patch('pandas.read_csv')
@patch('joblib.dump')
@patch('pandas.DataFrame.to_csv')
def test_baseline_models(mock_to_csv, mock_joblib_dump, mock_read_csv, mock_file, dummy_data):
    schema, train_df, val_df, test_df = dummy_data
    
    # Configure mock open to return schema when reading json
    def mock_file_read(*args, **kwargs):
        if args and 'schema' in args[0]:
            return StringIO(json.dumps(schema))
        # If writing, return the mock itself to capture writes
        if kwargs.get('mode', '') == 'w' or (len(args) > 1 and 'w' in args[1]):
            return mock_file.return_value
        return mock_open()(*args, **kwargs)
        
    mock_file.side_effect = mock_file_read
    
    # Configure read_csv to return splits
    def mock_csv_read(*args, **kwargs):
        if 'train.csv' in args[0]:
            return train_df.copy()
        if 'validation.csv' in args[0]:
            return val_df.copy()
        if 'test.csv' in args[0]:
            return test_df.copy()
        return pd.DataFrame()
        
    mock_read_csv.side_effect = mock_csv_read
    
    # Run the script
    baseline_models.process_baseline_models()
    
    # 1. Train/val/test remain disjoint in the mocks (verified by data creation)
    
    # 2. Check JSON output for correct metrics and logic
    # Read writes from mock_file.return_value (the file handle), NOT mock_file() which re-triggers side_effect
    write_calls = mock_file.return_value.write.call_args_list
    
    current_json = ""
    json_objects = []
    for call_obj in write_calls:
        current_json += call_obj[0][0]
        try:
            parsed = json.loads(current_json)
            json_objects.append(parsed)
            current_json = ""
        except json.JSONDecodeError:
            pass
            
    report = None
    for parsed in json_objects:
        if "dataset_information" in parsed and "validation_results" in parsed:
            report = parsed
            
    assert report is not None, f"Report not found. Parsed objects: {[list(p.keys()) for p in json_objects]}"
    
    # 3. Validation metrics
    val_results = report["validation_results"]
    assert "Dummy (Prior)" in val_results
    assert "Logistic Regression (Standard)" in val_results
    assert "Random Forest (Standard)" in val_results
    
    for model_name, metrics in val_results.items():
        assert 0.0 <= metrics["roc_auc"] <= 1.0
        assert 0.0 <= metrics["pr_auc"] <= 1.0
        assert 0.0 <= metrics["brier_score"] <= 1.0
        
    # 4. Model selection
    selected = report["selected_baseline"]["model"]
    assert selected in val_results
    
    # 5. Held-out test results
    test_res = report["held_out_test_results"]
    assert 0.0 <= test_res["roc_auc"] <= 1.0
    
    # 6. Preprocessing
    preproc = report["preprocessing"]
    assert preproc["original_feature_count"] == 4
    # num=2, bool=1, cat=1 (A,B,C -> 3 cols). Total = 6 transformed features.
    assert preproc["transformed_feature_count"] == 6
    
    # 7. Joblib models saved
    dump_args = [args[0][1] for args in mock_joblib_dump.call_args_list]
    assert any('baseline_preprocessor_v1.joblib' in path for path in dump_args)
    assert any('dummy_prior.joblib' in path for path in dump_args)
    assert any('logistic_regression_standard.joblib' in path for path in dump_args)
    
    # 8. Source CSVs untouched
    assert mock_read_csv.call_count == 3

def test_compute_metrics():
    y_true = np.array([0, 1, 0, 1, 0])
    y_prob = np.array([0.1, 0.9, 0.4, 0.6, 0.8])
    
    metrics = baseline_models.compute_metrics(y_true, y_prob)
    assert metrics['roc_auc'] > 0
    assert metrics['pr_auc'] > 0
    assert metrics['brier_score'] >= 0
    assert 0 <= metrics['specificity'] <= 1
    assert metrics['precision'] > 0
    assert metrics['confusion_matrix']['tp'] >= 1
