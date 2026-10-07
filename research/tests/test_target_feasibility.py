import pytest
import pandas as pd
import numpy as np
import os
import json
import tempfile
import sys
from io import StringIO
from unittest.mock import patch, mock_open

# Add research/scripts to path to import process_target_feasibility
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts')))

import target_feasibility

@pytest.fixture
def synthetic_data():
    # C1: 181 days follow up
    # C2: 120 days follow up
    # C3: 9 days follow up
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
def test_target_feasibility_logic(mock_file, mock_read_csv, mock_exists, synthetic_data):
    mock_read_csv.return_value = synthetic_data
    
    # 1. Run function
    target_feasibility.process_target_feasibility()
    
    # 2. Verify read_csv was called (input file unchanged/not written back to)
    mock_read_csv.assert_called_once()
    
    # 3. Get JSON written to the report
    write_calls = mock_file().write.call_args_list
    json_str = "".join(call[0][0] for call in write_calls)
    report = json.loads(json_str)
    
    # Validation 1: Child isolation / Matching
    assert report["dataset_information"]["children"] == 3
    assert report["dataset_information"]["input_observations"] == 9
    
    # C3 has 9 days follow up. 
    # C1 has 181 days max follow up from index 1.
    # Total sufficient for 90 days:
    # C1: 01-01 (181d) -> Yes, 02-01 (150d) -> Yes, 04-01 (91d) -> Yes, 07-01 (0d) -> No. (3 rows)
    # C2: 01-01 (120d) -> Yes, 03-01 (61d) -> No, 05-01 (0d) -> No. (1 row)
    # C3: 01-01 (9d) -> No, 01-10 (0d) -> No. (0 rows)
    # Total 90-day sufficient: 4 rows
    assert report["follow_up"]["90_day"]["sufficient_followup"] == 4
    assert report["follow_up"]["90_day"]["insufficient_followup"] == 5
    
    # Total sufficient for 180 days:
    # C1: 01-01 (181d) -> Yes. 02-01 (150d) -> No. (1 row)
    # C2: 01-01 (120d) -> No. (0 rows)
    # C3: 0 rows.
    # Total 180-day sufficient: 1 row
    assert report["follow_up"]["180_day"]["sufficient_followup"] == 1
    assert report["follow_up"]["180_day"]["insufficient_followup"] == 8
    
    # Validation 2: Threshold crossing logic (A1 and A2)
    # 90 day usable rows: C1(01-01), C1(02-01), C1(04-01), C2(01-01)
    # C1(01-01) WAZ=0.0. Future in 90 days: 02-01 (-0.5), 04-01 (-2.5). A1=Positive (has -2.5). A2=Positive (started >=-2.0, went < -2.0)
    # C1(02-01) WAZ=-0.5. Future in 90 days: 04-01 (-2.5). A1=Positive, A2=Positive.
    # C1(04-01) WAZ=-2.5. Future in 90 days: 07-01 (-2.1) is 91 days away! A1=Negative. A2=Negative
    # C2(01-01) WAZ=-2.1. Future in 90 days: 03-01 (-2.5). A1=Positive. A2=Negative (started < -2.0)
    
    a1_90 = report["candidate_threshold_crossing"]["90_day"]["A1_any_future_below_threshold"]
    a2_90 = report["candidate_threshold_crossing"]["90_day"]["A2_new_threshold_crossing"]
    
    assert a1_90["positive"] == 3
    assert a2_90["positive"] == 2
    
    # Validation 3: WAZ Decline logic
    # C1(01-01) WAZ=0.0. Future in 90 days: -0.5, -2.5. Decline = 0.0 - (-2.5) = 2.5. >= 0.75? Yes.
    # C1(02-01) WAZ=-0.5. Future in 90 days: -2.5. Decline = 2.0. >= 0.75? Yes.
    # C1(04-01) WAZ=-2.5. Future in 90 days: NONE. Decline = 0. >= 0.25? No.
    # C2(01-01) WAZ=-2.1. Future in 90 days: -2.5. Decline = -2.1 - (-2.5) = 0.4. >= 0.25? Yes. >= 0.50? No.
    
    d_25_90 = report["candidate_waz_decline"]["90_day"]["0.25"]
    d_50_90 = report["candidate_waz_decline"]["90_day"]["0.5"]
    d_75_90 = report["candidate_waz_decline"]["90_day"]["0.75"]
    
    assert d_25_90["positive"] == 3
    assert d_50_90["positive"] == 2
    assert d_75_90["positive"] == 2
    
    # Validation 4: Event time min/max calculation
    # C1(01-01) -> reaches -2.5 on 04-01 (90 days).
    # C1(02-01) -> reaches -2.5 on 04-01 (59 days assuming non leap year).
    assert report["event_time"]["A2_90_day"]["max"] == 90.0
    
    # Validation 5: Combined candidate
    # A1 OR Decline >= 0.50
    # C1(01-01) => A1=yes, Decline=yes => Positive
    # C1(02-01) => A1=yes, Decline=yes => Positive
    # C1(04-01) => A1=no, Decline=no => Negative
    # C2(01-01) => A1=yes, Decline=no => Positive
    c_90 = report["candidate_combined"]["90_day"]
    assert c_90["positive"] == 3
