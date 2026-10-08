"""
dynamic_risk.py – Stage 10

Dynamic risk trajectory assessment module.

Given multiple chronological eligible observations from the same child,
computes a risk assessment at each index observation and returns a
risk trajectory (not interpolated – risk exists only at actual visit times).

DO NOT:
  - use future observations for any assessment
  - invent risk estimates between visits
  - interpolate daily/monthly risk
  - retrain or refit anything
  - assign unsupported clinical meaning to changes
"""

import os
import sys
import json
import math
from datetime import datetime

import numpy as np
import pandas as pd

# Module-level import of the frozen inference engine
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
from risk_inference import (
    predict_risk, batch_predict, get_artifacts,
    PRIMARY_COHORT_WAZ_MIN, FORBIDDEN_FIELDS,
    _get_expected_features,
)

FROZEN_THRESHOLD = 0.5


# ---------------------------------------------------------------------------
# Dynamic risk for a single child
# ---------------------------------------------------------------------------
def compute_child_risk_trajectory(
    child_obs_df: pd.DataFrame,
    child_id: str,
) -> pd.DataFrame:
    """
    Compute risk trajectory for a single child across all eligible observations.

    Parameters
    ----------
    child_obs_df : pd.DataFrame
        All observations for the child, sorted chronologically.
        Must NOT contain future/target columns (they are dropped if present).
    child_id : str

    Returns
    -------
    pd.DataFrame with columns:
        child_id, assessment_date, risk_probability, risk_flag,
        model_version, model_applicability,
        risk_probability_change, days_since_previous_risk_assessment
    """
    # Sort by visit date ascending
    df = child_obs_df.copy().sort_values('visit_date')

    rows = []
    prev_prob   = None
    prev_date   = None

    for _, obs in df.iterrows():
        obs_no_target = obs.drop(
            labels=[c for c in FORBIDDEN_FIELDS if c in obs.index],
            errors='ignore'
        )
        assessment_date = str(obs.get('visit_date', ''))

        result = predict_risk(
            obs        = obs_no_target,
            child_id   = child_id,
            assessment_date = assessment_date,
        )

        # Risk change
        if prev_prob is None:
            risk_change = float('nan')
        else:
            risk_change = round(result['risk_probability'] - prev_prob, 6)

        # Days since previous assessment
        if prev_date is None:
            days_since = float('nan')
        else:
            try:
                curr_dt = pd.Timestamp(assessment_date)
                prev_dt = pd.Timestamp(prev_date)
                days_since = (curr_dt - prev_dt).days
            except Exception:
                days_since = float('nan')

        rows.append({
            'child_id':                          child_id,
            'assessment_date':                   assessment_date,
            'risk_probability':                  result['risk_probability'],
            'risk_flag':                         result['risk_flag'],
            'model_version':                     result['model_version'],
            'model_applicability':               result['model_applicability'],
            'risk_probability_change':           risk_change,
            'days_since_previous_risk_assessment': days_since,
        })

        prev_prob = result['risk_probability']
        prev_date = assessment_date

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Dynamic risk across multiple children (DataFrame interface)
# ---------------------------------------------------------------------------
def compute_cohort_risk_trajectories(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute risk trajectories for all children in a DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        Must have 'child_id' and 'visit_date' columns.

    Returns
    -------
    pd.DataFrame of all trajectories concatenated.
    """
    results = []
    for child_id, group in df.groupby('child_id'):
        traj = compute_child_risk_trajectory(group, child_id=str(child_id))
        results.append(traj)

    if results:
        return pd.concat(results, ignore_index=True)
    return pd.DataFrame()


# ---------------------------------------------------------------------------
# Dynamic risk demonstration examples
# ---------------------------------------------------------------------------
def select_demonstration_children(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    frozen_preds: pd.DataFrame,
) -> list:
    """
    Select a small deterministic set of example children for demonstration.
    Prefers:
      - one child with >= 1 positive target
      - one child with all negative targets
      - one child whose risk increases naturally (if present)
    Does NOT cherry-pick only successful predictions.
    """
    all_df = pd.concat([train_df, val_df, test_df], ignore_index=True)

    # Identify children with at least one positive target
    pos_children = (
        all_df[all_df['future_growth_faltering_180d'] == 1]['child_id']
        .value_counts()
        .index.tolist()
    )
    neg_children = list(
        set(all_df['child_id'].unique()) - set(pos_children)
    )

    selected = []

    # 1. Child with positive target (most observations)
    if pos_children:
        pos_cand = (
            all_df[all_df['child_id'].isin(pos_children)]
            .groupby('child_id')
            .size()
            .sort_values(ascending=False)
            .index[0]
        )
        selected.append(str(pos_cand))

    # 2. Child with only negative targets (most observations)
    if neg_children:
        neg_cand = (
            all_df[all_df['child_id'].isin(neg_children)]
            .groupby('child_id')
            .size()
            .sort_values(ascending=False)
            .index[0]
        )
        if str(neg_cand) not in selected:
            selected.append(str(neg_cand))

    # 3. Child with naturally increasing risk trajectory (optional)
    if frozen_preds is not None and len(frozen_preds) > 0:
        child_trends = []
        for cid, grp in frozen_preds.groupby('child_id'):
            if str(cid) in selected:
                continue
            grp = grp.sort_values('visit_date')
            if len(grp) >= 3:
                probs = grp['risk_probability'].values
                diffs = np.diff(probs)
                # Monotonically increasing trend
                if (diffs > 0).all():
                    child_trends.append(str(cid))

        if child_trends:
            selected.append(child_trends[0])

    return selected[:3]  # Cap at 3 demonstration children


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    print("=" * 50)
    print("STAGE 10: DYNAMIC RISK ASSESSMENT")
    print("=" * 50)

    # Load all splits
    splits = {}
    for split_name in ['train', 'validation', 'test']:
        path = os.path.join('data', 'splits', 'v1', f'{split_name}.csv')
        if not os.path.exists(path):
            raise FileNotFoundError(f"Split not found: {path}")
        splits[split_name] = pd.read_csv(path)
        print(f"Loaded {split_name}: {len(splits[split_name])} rows")

    # Load frozen predictions (generated by risk_inference.py)
    frozen_preds_path = os.path.join('research', 'evaluation', 'frozen_risk_predictions_v1.csv')
    frozen_preds = None
    if os.path.exists(frozen_preds_path):
        frozen_preds = pd.read_csv(frozen_preds_path)
        print(f"Loaded frozen predictions: {len(frozen_preds)} rows")
    else:
        print("WARNING: frozen_risk_predictions_v1.csv not found. Run risk_inference.py first.")

    # Select demonstration children
    demo_children = select_demonstration_children(
        splits['train'], splits['validation'], splits['test'],
        frozen_preds
    )
    print(f"\nDemonstration children selected: {demo_children}")

    # Compute full trajectories for demonstration children
    all_df = pd.concat(list(splits.values()), ignore_index=True)
    demo_rows = []

    for child_id in demo_children:
        child_df = all_df[all_df['child_id'].astype(str) == str(child_id)].copy()
        print(f"\n  Child {child_id}: {len(child_df)} observations")

        traj = compute_child_risk_trajectory(child_df, child_id=str(child_id))
        demo_rows.append(traj)

        for _, row in traj.iterrows():
            flag  = '⚑ FLAGGED' if row['risk_flag'] else ''
            chg   = f"Δ{row['risk_probability_change']:+.3f}" if not math.isnan(row['risk_probability_change']) else 'Δ N/A'
            print(f"    {row['assessment_date']}  prob={row['risk_probability']:.4f}  {chg}  {row['model_applicability']}  {flag}")

    if demo_rows:
        demo_df = pd.concat(demo_rows, ignore_index=True)
        out_path = os.path.join('research', 'evaluation', 'dynamic_risk_examples_v1.csv')
        demo_df.to_csv(out_path, index=False)
        print(f"\nDynamic risk examples saved: {out_path}")

    # Stats
    print(f"\nChildren evaluated (demo): {len(demo_children)}")
    print(f"Assessments generated: {sum(len(r) for r in demo_rows)}")
    print("Dynamic risk assessment complete.")
