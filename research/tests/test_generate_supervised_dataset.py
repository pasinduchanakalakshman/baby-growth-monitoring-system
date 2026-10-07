import pytest
import pandas as pd
import numpy as np
import os
import json
import sys
from io import StringIO
from unittest.mock import patch, mock_open

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts')))

import generate_supervised_dataset

@patch('os.path.exists', return_value=True)
@patch('pandas.read_csv')
@patch('builtins.open', new_callable=mock_open)
@patch('pandas.DataFrame.to_csv')
def test_generate_supervised_dataset(mock_to_csv, mock_file, mock_read_csv, mock_exists):
    csv_data = """child_id,visit_date,verified_waz,other_feature
C1,2023-01-01,0.0,10
C1,2023-06-30,-2.1,11
C2,2023-01-01,-2.5,12
C2,2023-06-30,-3.0,13
C3,2023-01-01,0.0,14
C3,2023-06-30,-0.3,15
C4,2023-01-01,0.0,16
C4,2023-01-10,0.0,17
"""
    # C1(01-01): sufficient (180 days). index WAZ=0.0. future=-2.1. 
    #   -> target_new = 1, target_decline = 1 (2.1 decline >= 0.50), overall = 1
    # C1(06-30): insufficient follow-up. Excluded.
    # C2(01-01): sufficient. index WAZ=-2.5 (prevalent).
    #   -> excluded from primary cohort (already_below_threshold_at_index)
    # C2(06-30): insufficient follow-up. Excluded.
    # C3(01-01): sufficient. index WAZ=0.0. future=-0.3.
    #   -> target_new = 0, target_decline = 0 (0.3 < 0.50), overall = 0
    # C3(06-30): insufficient follow-up. Excluded.
    # C4(01-01): insufficient (only 9 days). Excluded.
    # C4(01-10): insufficient (0 days). Excluded.
    
    df_data = pd.DataFrame([
        {'child_id': 'C1', 'visit_date': '2023-01-01', 'verified_waz': 0.0, 'other_feature': 10},
        {'child_id': 'C1', 'visit_date': '2023-06-30', 'verified_waz': -2.1, 'other_feature': 11},
        {'child_id': 'C2', 'visit_date': '2023-01-01', 'verified_waz': -2.5, 'other_feature': 12},
        {'child_id': 'C2', 'visit_date': '2023-06-30', 'verified_waz': -3.0, 'other_feature': 13},
        {'child_id': 'C3', 'visit_date': '2023-01-01', 'verified_waz': 0.0, 'other_feature': 14},
        {'child_id': 'C3', 'visit_date': '2023-06-30', 'verified_waz': -0.3, 'other_feature': 15},
        {'child_id': 'C4', 'visit_date': '2023-01-01', 'verified_waz': 0.0, 'other_feature': 16},
        {'child_id': 'C4', 'visit_date': '2023-01-10', 'verified_waz': 0.0, 'other_feature': 17}
    ])
    
    mock_read_csv.return_value = df_data
    
    generate_supervised_dataset.process_supervised_dataset()
    
    # 1. Source temporal dataset remains unchanged
    mock_read_csv.assert_called_once()
    
    # 2. Extract saved dataframes
    assert mock_to_csv.call_count == 2
    primary_df = mock_to_csv.call_args_list[0][0][0] # No, to_csv is called on the dataframe object
    # Wait, patching pandas.DataFrame.to_csv means mock_to_csv is called with self as first arg.
    # Let's inspect mock_to_csv calls.
    primary_df = mock_to_csv.call_args_list[0][0][0] if len(mock_to_csv.call_args_list[0][0]) > 0 else mock_to_csv.call_args_list[0][1].get('self')
    # Actually, patch on bound methods is tricky. A better way to get the df is just check the JSON report logic.
    
    write_calls = mock_file().write.call_args_list
    # Find the JSON call
    json_str = "".join(call[0][0] for call in write_calls if '{' in call[0][0] or '"' in call[0][0] or '\n' in call[0][0])
    
    # The script writes schema first, then report. We must parse both, or just the report.
    # Let's extract the last valid JSON object from write calls (which is the report).
    json_objects = []
    current_obj = ""
    for call in write_calls:
        current_obj += call[0][0]
        try:
            parsed = json.loads(current_obj)
            json_objects.append(parsed)
            current_obj = ""
        except json.JSONDecodeError:
            pass
            
    assert len(json_objects) == 2
    schema = json_objects[0]
    report = json_objects[1]
    
    # Reconcile counts
    info = report["dataset_information"]
    assert info["input_observations"] == 8
    
    # 8 total. 
    # C4(01-01), C4(01-10), C1(06-30), C2(06-30), C3(06-30) are insufficient -> 5
    assert info["insufficient_followup"] == 5
    
    # C2(01-01) is already_below_threshold -> 1
    assert info["already_below_threshold_at_index"] == 1
    
    # C1(01-01), C3(01-01) are primary eligible -> 2
    assert info["primary_eligible_observations"] == 2
    
    # Target values:
    # C1(01-01) is POSITIVE.
    # C3(01-01) is NEGATIVE.
    dist = report["target_distribution"]
    assert dist["positive_targets"] == 1
    assert dist["negative_targets"] == 1
    
    # Feature / schema tests
    candidate_features = schema["candidate_input_features"]
    assert "verified_waz" in candidate_features
    assert "other_feature" in candidate_features
    assert "future_waz" not in candidate_features
    assert "future_growth_faltering_180d" not in candidate_features
    assert "target_new_threshold_crossing_180d" not in candidate_features
    
    # Leakage
    assert report["leakage_validation"]["validation_passed"] == True
    
    # Target logic overlap
    overlap = report["target_component_overlap"]
    assert overlap["both_conditions"] == 1
    assert overlap["new_crossing_only"] == 0
    assert overlap["waz_decline_only"] == 0
