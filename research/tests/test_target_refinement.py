import pytest
import pandas as pd
import numpy as np
import os
import json
import tempfile
import sys
from io import StringIO
from unittest.mock import patch, mock_open

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts')))

import target_refinement

@pytest.fixture
def synthetic_data():
    csv_data = """child_id,visit_date,verified_waz
C1,2023-01-01,0.0
C1,2023-02-01,-0.5
C1,2023-04-01,-2.5
C1,2023-07-01,-2.1
C2,2023-01-01,-2.1
C2,2023-03-01,-2.5
C2,2023-05-01,-1.5
C3,2023-01-01,0.0
C3,2023-01-10,0.0
"""
    return pd.read_csv(StringIO(csv_data))

@patch('os.path.exists', return_value=True)
@patch('pandas.read_csv')
@patch('builtins.open', new_callable=mock_open)
def test_target_refinement_logic(mock_file, mock_read_csv, mock_exists, synthetic_data):
    mock_read_csv.return_value = synthetic_data
    
    target_refinement.process_target_refinement()
    
    # Verify read_csv was called (input file unchanged)
    mock_read_csv.assert_called_once()
    
    write_calls = mock_file().write.call_args_list
    json_str = "".join(call[0][0] for call in write_calls)
    report = json.loads(json_str)
    
    # 1. No child boundary leakage & insufficient follow-up remains excluded
    # C1 max = 181 days => 01-01 is sufficient. 02-01 (150d) is insufficient.
    # C2 max = 120 days => 01-01 is insufficient.
    # C3 max = 9 days => insufficient.
    # So ONLY C1(01-01) is sufficient. Usable count = 1.
    assert report["follow_up"]["sufficient_followup"] == 1
    assert report["follow_up"]["insufficient_followup"] == 8
    
    # Let's adjust the test to have more usable rows to test D1 and D2 logic properly.
    pass

@patch('os.path.exists', return_value=True)
@patch('pandas.read_csv')
@patch('builtins.open', new_callable=mock_open)
def test_target_refinement_d_logic(mock_file, mock_read_csv, mock_exists):
    csv_data = """child_id,visit_date,verified_waz
C1,2023-01-01,0.0
C1,2023-06-30,-2.1
C2,2023-01-01,-2.5
C2,2023-06-30,-3.0
C3,2023-01-01,0.0
C3,2023-06-30,-0.3
"""
    # C1(01-01): sufficient (185 days). Index WAZ = 0.0. Future = -2.1.
    # New crossing = TRUE. Decline = 2.1 (TRUE for 0.25 and 0.50).
    # C2(01-01): sufficient (185 days). Index WAZ = -2.5. Future = -3.0.
    # New crossing = FALSE (already below -2). Decline = 0.5 (TRUE for 0.25 and 0.50).
    # C3(01-01): sufficient (185 days). Index WAZ = 0.0. Future = -0.3.
    # New crossing = FALSE. Decline = 0.3 (TRUE for 0.25, FALSE for 0.50).
    
    df_data = pd.DataFrame([
        {'child_id': 'C1', 'visit_date': '2023-01-01', 'verified_waz': 0.0},
        {'child_id': 'C1', 'visit_date': '2023-06-30', 'verified_waz': -2.1},
        {'child_id': 'C2', 'visit_date': '2023-01-01', 'verified_waz': -2.5},
        {'child_id': 'C2', 'visit_date': '2023-06-30', 'verified_waz': -3.0},
        {'child_id': 'C3', 'visit_date': '2023-01-01', 'verified_waz': 0.0},
        {'child_id': 'C3', 'visit_date': '2023-06-30', 'verified_waz': -0.3},
    ])
    
    mock_read_csv.return_value = df_data
    
    target_refinement.process_target_refinement()
    
    write_calls = mock_file().write.call_args_list
    json_str = "".join(call[0][0] for call in write_calls)
    report = json.loads(json_str)
    
    assert report["follow_up"]["sufficient_followup"] == 3
    
    d1 = report["candidates"]["D1"]
    d2 = report["candidates"]["D2"]
    
    # D1 (New cross OR decline >= 0.25)
    # C1: True (both)
    # C2: True (decline only)
    # C3: True (decline only)
    assert d1["positive_observations"] == 3
    assert d1["overlap"]["both_conditions"] == 1
    assert d1["overlap"]["new_crossing_only"] == 0
    assert d1["overlap"]["waz_decline_only"] == 2
    
    # D2 (New cross OR decline >= 0.50)
    # C1: True (both)
    # C2: True (decline only)
    # C3: False (neither)
    assert d2["positive_observations"] == 2
    assert d2["overlap"]["both_conditions"] == 1
    assert d2["overlap"]["waz_decline_only"] == 1
    
    # Stratification Check
    # C1 (index 0.0 >= -2.0) -> positive
    # C2 (index -2.5 < -2.0) -> positive
    # C3 (index 0.0 >= -2.0) -> negative
    above = d2["current_status_stratification"]["index_waz_above_threshold"]
    below = d2["current_status_stratification"]["index_waz_below_threshold"]
    
    assert above["total"] == 2 # C1, C3
    assert above["positive"] == 1 # C1
    assert below["total"] == 1 # C2
    assert below["positive"] == 1 # C2

