import os
import sys
import json
import pandas as pd

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(os.path.join(project_root, 'research', 'scripts'))

import risk_inference as ri

def main():
    test_split_path = os.path.join(project_root, 'data', 'splits', 'v1', 'test.csv')
    df_test = pd.read_csv(test_split_path)
    
    sample_children = ['CH015', 'CH022', 'CH023', 'CH024', 'CH040']
    
    fixture = []
    
    for cid in sample_children:
        child_rows = df_test[df_test['child_id'] == cid].sort_values('visit_date')
        if not child_rows.empty:
            obs = child_rows.iloc[-1]
            
            # Predict
            obs_clean = obs.drop(labels=[c for c in ri.FORBIDDEN_FIELDS if c in obs.index], errors='ignore')
            res = ri.predict_risk(obs_clean, child_id=cid, assessment_date=obs['visit_date'])
            
            fixture.append({
                'child_id': cid,
                'visit_date': str(obs['visit_date']),
                'expected_probability': res['risk_probability'],
                'expected_flag': res['risk_flag']
            })
            
    fixture_dir = os.path.join(project_root, 'research', 'tests', 'fixtures')
    os.makedirs(fixture_dir, exist_ok=True)
    fixture_path = os.path.join(fixture_dir, 'research_core_v1_predictions.json')
    
    with open(fixture_path, 'w') as f:
        json.dump(fixture, f, indent=4)
        
    print(f"Generated fixture with {len(fixture)} cases at {fixture_path}")

if __name__ == '__main__':
    main()
