import pandas as pd
import numpy as np
import os
import json
import sys

def process_target_feasibility():
    print("==================================================")
    print("STARTING STAGE 5A: TARGET FEASIBILITY ANALYSIS")
    print("==================================================")

    input_path = os.path.join('data', 'features', 'chdr_temporal_features_v1.csv')
    output_report = os.path.join('research', 'evaluation', 'target_feasibility_report_v1.json')

    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        sys.exit(1)

    df = pd.read_csv(input_path)
    
    if df.empty:
        print("Input dataset is empty.")
        sys.exit(1)
        
    df['visit_date'] = pd.to_datetime(df['visit_date'])
    df['verified_waz'] = pd.to_numeric(df['verified_waz'], errors='coerce')
    
    # Calculate max follow-up date per child
    child_max_date = df.groupby('child_id')['visit_date'].transform('max')
    df['max_followup_date'] = child_max_date
    df['obs_idx'] = df.index
    
    # Self-join to find future observations
    df_future = df[['child_id', 'visit_date', 'verified_waz']].rename(
        columns={'visit_date': 'future_date', 'verified_waz': 'future_waz'}
    )
    
    merged = pd.merge(df[['obs_idx', 'child_id', 'visit_date', 'verified_waz', 'max_followup_date']], 
                      df_future, on='child_id', how='left')
    
    # Strictly future
    merged = merged[merged['future_date'] > merged['visit_date']].copy()
    merged['days_to_future'] = (merged['future_date'] - merged['visit_date']).dt.days
    merged['waz_decline'] = merged['verified_waz'] - merged['future_waz']
    
    report = {
        "dataset_information": {
            "input_observations": len(df),
            "children": df['child_id'].nunique()
        },
        "follow_up": {},
        "candidate_threshold_crossing": {},
        "candidate_waz_decline": {},
        "candidate_combined": {},
        "class_balance": {},
        "event_time": {},
        "child_level_distribution": {},
        "insufficient_followup_counts": {},
        "warnings": [],
        "final_target_selected": False
    }

    horizons = [90, 180]
    waz_threshold = -2.0
    decline_thresholds = [0.25, 0.50, 0.75]
    
    def update_event_times(candidate_key, days_series):
        if len(days_series) == 0:
            report["event_time"][candidate_key] = None
            return
        report["event_time"][candidate_key] = {
            "min": float(days_series.min()),
            "max": float(days_series.max()),
            "mean": float(days_series.mean()),
            "median": float(days_series.median()),
            "25th_percentile": float(days_series.quantile(0.25)),
            "75th_percentile": float(days_series.quantile(0.75))
        }

    for H in horizons:
        h_str = f"{H}_day"
        
        # Sufficient follow-up mask (for index observations)
        sufficient_mask = (df['max_followup_date'] - df['visit_date']).dt.days >= H
        usable_idx = df[sufficient_mask]['obs_idx'].unique()
        
        insufficient_count = (~sufficient_mask).sum()
        usable_count = sufficient_mask.sum()
        
        report["follow_up"][h_str] = {
            "index_observations": len(df),
            "sufficient_followup": int(usable_count),
            "insufficient_followup": int(insufficient_count),
            "percentage_usable": float(usable_count / len(df) * 100) if len(df) > 0 else 0,
            "children_represented": int(df[sufficient_mask]['child_id'].nunique())
        }
        report["insufficient_followup_counts"][h_str] = int(insufficient_count)
        
        if usable_count == 0:
            report["warnings"].append(f"No usable observations for {H}-day horizon.")
            continue
            
        # Future events within horizon
        future_h = merged[(merged['days_to_future'] <= H) & (merged['days_to_future'] > 0)].copy()
        
        # A1: Any future WAZ < threshold
        a1_events = future_h[future_h['future_waz'] < waz_threshold].groupby('obs_idx')['days_to_future'].min()
        a1_events = a1_events[a1_events.index.isin(usable_idx)]
        
        # A2: New threshold crossing
        a2_mask = (future_h['verified_waz'] >= waz_threshold) & (future_h['future_waz'] < waz_threshold)
        a2_events = future_h[a2_mask].groupby('obs_idx')['days_to_future'].min()
        a2_events = a2_events[a2_events.index.isin(usable_idx)]
        
        a1_pos = len(a1_events)
        a2_pos = len(a2_events)
        
        report["candidate_threshold_crossing"][h_str] = {
            "A1_any_future_below_threshold": {
                "positive": a1_pos,
                "negative": int(usable_count - a1_pos),
                "positive_percentage": float(a1_pos / usable_count * 100),
                "unique_children": int(df[df['obs_idx'].isin(a1_events.index)]['child_id'].nunique())
            },
            "A2_new_threshold_crossing": {
                "positive": a2_pos,
                "negative": int(usable_count - a2_pos),
                "positive_percentage": float(a2_pos / usable_count * 100),
                "unique_children": int(df[df['obs_idx'].isin(a2_events.index)]['child_id'].nunique())
            }
        }
        
        update_event_times(f"A1_{h_str}", a1_events)
        update_event_times(f"A2_{h_str}", a2_events)
        
        report["class_balance"][f"A1_{h_str}"] = {
            "positive": a1_pos, "negative": int(usable_count - a1_pos),
            "ratio": float(a1_pos / max(usable_count - a1_pos, 1)),
            "percentage": float(a1_pos / usable_count * 100)
        }
        report["class_balance"][f"A2_{h_str}"] = {
            "positive": a2_pos, "negative": int(usable_count - a2_pos),
            "ratio": float(a2_pos / max(usable_count - a2_pos, 1)),
            "percentage": float(a2_pos / usable_count * 100)
        }
        
        if h_str not in report["candidate_waz_decline"]:
            report["candidate_waz_decline"][h_str] = {}
            
        for d_thresh in decline_thresholds:
            d_events = future_h[future_h['waz_decline'] >= d_thresh].groupby('obs_idx')['days_to_future'].min()
            d_events = d_events[d_events.index.isin(usable_idx)]
            d_pos = len(d_events)
            
            report["candidate_waz_decline"][h_str][str(d_thresh)] = {
                "positive": d_pos,
                "negative": int(usable_count - d_pos),
                "positive_percentage": float(d_pos / usable_count * 100),
                "unique_children": int(df[df['obs_idx'].isin(d_events.index)]['child_id'].nunique())
            }
            update_event_times(f"B_decline_{d_thresh}_{h_str}", d_events)
            report["class_balance"][f"B_decline_{d_thresh}_{h_str}"] = {
                "positive": d_pos, "negative": int(usable_count - d_pos),
                "ratio": float(d_pos / max(usable_count - d_pos, 1)),
                "percentage": float(d_pos / usable_count * 100)
            }

        # Candidate C: Combined
        c_events = future_h[(future_h['future_waz'] < waz_threshold) | (future_h['waz_decline'] >= 0.50)].groupby('obs_idx')['days_to_future'].min()
        c_events = c_events[c_events.index.isin(usable_idx)]
        c_pos = len(c_events)
        
        report["candidate_combined"][h_str] = {
            "positive": c_pos,
            "negative": int(usable_count - c_pos),
            "positive_percentage": float(c_pos / usable_count * 100),
            "unique_children": int(df[df['obs_idx'].isin(c_events.index)]['child_id'].nunique())
        }
        update_event_times(f"C_combined_{h_str}", c_events)
        report["class_balance"][f"C_combined_{h_str}"] = {
            "positive": c_pos, "negative": int(usable_count - c_pos),
            "ratio": float(c_pos / max(usable_count - c_pos, 1)),
            "percentage": float(c_pos / usable_count * 100)
        }
        
    # Check for severe class imbalances and add warnings
    for k, bal in report["class_balance"].items():
        if bal["positive"] > 0 and bal["ratio"] < 0.05:
            report["warnings"].append(f"Severe class imbalance detected in {k}: {bal['positive']} positive vs {bal['negative']} negative (ratio {bal['ratio']:.3f})")
        
    # Child level overall events (using 180 day A2 or B0.50)
    H = 180
    future_180 = merged[(merged['days_to_future'] <= H) & (merged['days_to_future'] > 0)].copy()
    event_mask = ((future_180['verified_waz'] >= waz_threshold) & (future_180['future_waz'] < waz_threshold)) | (future_180['waz_decline'] >= 0.50)
    obs_with_events = future_180[event_mask]['obs_idx'].unique()
    
    # We only count events where the index obs actually had sufficient follow-up for 180 days
    sufficient_mask = (df['max_followup_date'] - df['visit_date']).dt.days >= H
    usable_idx = df[sufficient_mask]['obs_idx'].unique()
    valid_events = set(obs_with_events).intersection(set(usable_idx))
    
    df['has_event_180'] = df['obs_idx'].isin(valid_events).astype(int)
    
    children_with_events = df[df['has_event_180'] == 1]['child_id'].nunique()
    total_children = df['child_id'].nunique()
    
    report["child_level_distribution"] = {
        "children_with_at_least_one_event_180_A2_or_B05": int(children_with_events),
        "children_with_no_events": int(total_children - children_with_events)
    }

    os.makedirs(os.path.dirname(output_report), exist_ok=True)
    with open(output_report, 'w') as f:
        json.dump(report, f, indent=4)

    print(f"Feasibility analysis completed. Report saved to {output_report}")

if __name__ == '__main__':
    process_target_feasibility()
