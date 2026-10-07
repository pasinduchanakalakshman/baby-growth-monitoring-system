import pytest
import pandas as pd
import numpy as np
import os
import json
import sys
from io import StringIO
from unittest.mock import patch, mock_open, call

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts')))
import create_child_level_split

@pytest.fixture
def synthetic_supervised_data():
    np.random.seed(42)
    rows = []
    # Create 100 children, 10 visits each
    # 20 children will have at least one positive target
    for i in range(1, 101):
        child_id = f"C{i}"
        has_positive = i <= 20
        for j in range(1, 11):
            visit_date = pd.Timestamp('2023-01-01') + pd.Timedelta(days=j*30)
            target = 1 if (has_positive and j == 10) else 0
            rows.append({
                'child_id': child_id,
                'visit_date': visit_date,
                'future_growth_faltering_180d': target,
                'other_col': np.random.randn()
            })
    return pd.DataFrame(rows)

@patch('os.path.exists', return_value=True)
@patch('pandas.read_csv')
@patch('builtins.open', new_callable=mock_open)
@patch('pandas.DataFrame.to_csv')
def test_child_level_split(mock_to_csv, mock_file, mock_read_csv, mock_exists, synthetic_supervised_data):
    mock_read_csv.return_value = synthetic_supervised_data.copy()
    
    create_child_level_split.process_child_level_split()
    
    # Verify read_csv was called once (source remains unchanged)
    mock_read_csv.assert_called_once()
    
    # 6 DataFrame to_csv calls (3 main splits + 3 children manifests)
    assert mock_to_csv.call_count == 6
    
    # The first 3 calls should be the row-level splits: train, val, test
    train_df = mock_to_csv.call_args_list[0][0][0] if len(mock_to_csv.call_args_list[0][0]) > 0 else mock_to_csv.call_args_list[0][1].get('self', synthetic_supervised_data.iloc[0:0])
    val_df = mock_to_csv.call_args_list[1][0][0] if len(mock_to_csv.call_args_list[1][0]) > 0 else mock_to_csv.call_args_list[1][1].get('self', synthetic_supervised_data.iloc[0:0])
    test_df = mock_to_csv.call_args_list[2][0][0] if len(mock_to_csv.call_args_list[2][0]) > 0 else mock_to_csv.call_args_list[2][1].get('self', synthetic_supervised_data.iloc[0:0])

    # In a patching scenario on bound methods, getting the DataFrame is tricky. 
    # The JSON report contains all the validations we need.
    
    write_calls = mock_file().write.call_args_list
    json_objects = []
    current_obj = ""
    for call_obj in write_calls:
        current_obj += call_obj[0][0]
        try:
            parsed = json.loads(current_obj)
            json_objects.append(parsed)
            current_obj = ""
        except json.JSONDecodeError:
            pass
            
    assert len(json_objects) == 2
    metadata = json_objects[0]
    report = json_objects[1]
    
    assert report["status"] == "PASSED"
    
    meta = report["metadata"]
    assert meta["row_reconciliation_passed"] == True
    assert meta["child_reconciliation_passed"] == True
    
    assert meta["child_overlap"]["train_validation"] == 0
    assert meta["child_overlap"]["train_test"] == 0
    assert meta["child_overlap"]["validation_test"] == 0
    
    # Check that all splits have positives and negatives
    for split in ["train", "validation", "test"]:
        assert meta[split]["positive_observations"] > 0
        assert meta[split]["negative_observations"] > 0
        assert meta[split]["children_with_positive_targets"] > 0
        
    # Check deterministic logic - mock read_csv with same data but shuffled
    synthetic_shuffled = synthetic_supervised_data.sample(frac=1, random_state=123).copy()
    mock_read_csv.return_value = synthetic_shuffled
    
    # Reset mocks
    mock_file.reset_mock()
    mock_to_csv.reset_mock()
    
    create_child_level_split.process_child_level_split()
    
    write_calls2 = mock_file().write.call_args_list
    json_objects2 = []
    current_obj = ""
    for call_obj in write_calls2:
        current_obj += call_obj[0][0]
        try:
            parsed = json.loads(current_obj)
            json_objects2.append(parsed)
            current_obj = ""
        except json.JSONDecodeError:
            pass
            
    meta2 = json_objects2[1]["metadata"]
    
    # Train test counts should be exactly the same
    assert meta["train"]["children"] == meta2["train"]["children"]
    assert meta["validation"]["children"] == meta2["validation"]["children"]
    assert meta["test"]["children"] == meta2["test"]["children"]
