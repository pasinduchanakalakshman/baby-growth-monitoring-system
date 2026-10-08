"""
risk_inference.py – Stage 10

Frozen risk inference module for the primary growth-faltering risk model (XGBoost v1).

Responsibilities:
  - Load frozen XGBoost model + preprocessing pipeline
  - Validate feature schema
  - Given one prepared observation at time T, produce:
      risk_probability   (float [0,1])
      risk_flag          (0 or 1 using frozen threshold 0.5)
  - Handle outside-primary-cohort cases explicitly (verified_waz < -2)

DO NOT:
  - refit preprocessing
  - retrain the model
  - calculate or use future values
  - call the output a clinical diagnosis
"""

import os
import sys
import json
import math
from datetime import datetime

import numpy as np
import pandas as pd
import joblib

# ---------------------------------------------------------------------------
# Paths (relative to workspace root)
# ---------------------------------------------------------------------------
MODEL_PATH        = os.path.join('models', 'trained', 'baselines', 'v1', 'xgboost.joblib')
PREPROCESSOR_PATH = os.path.join('models', 'scalers', 'baseline_preprocessor_v1.joblib')
SCHEMA_PATH       = os.path.join('models', 'metadata', 'baseline_feature_metadata_v1.json')
FREEZE_META_PATH  = os.path.join('models', 'metadata', 'final_risk_model_v1.json')

FROZEN_THRESHOLD          = 0.5
MODEL_VERSION             = 'v1'
TARGET_DEFINITION_VERSION = 'v1'
PREDICTION_HORIZON_DAYS   = 180
PRIMARY_COHORT_WAZ_MIN    = -2.0   # verified_waz must be >= this at index time

# Fields that must NEVER enter the model as features
FORBIDDEN_FIELDS = {
    'future_growth_faltering_180d',
    'target_new_threshold_crossing_180d',
    'target_waz_decline_05_180d',
    'future_waz',
    'future_weight',
    'future_height',
}


# ---------------------------------------------------------------------------
# Artifact loading (cached at module level)
# ---------------------------------------------------------------------------
_model        = None
_preprocessor = None
_schema       = None
_freeze_meta  = None


def _load_artifacts():
    global _model, _preprocessor, _schema, _freeze_meta

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model artifact not found: {MODEL_PATH}")
    if not os.path.exists(PREPROCESSOR_PATH):
        raise FileNotFoundError(f"Preprocessor artifact not found: {PREPROCESSOR_PATH}")
    if not os.path.exists(SCHEMA_PATH):
        raise FileNotFoundError(f"Feature schema not found: {SCHEMA_PATH}")

    _model        = joblib.load(MODEL_PATH)
    _preprocessor = joblib.load(PREPROCESSOR_PATH)

    with open(SCHEMA_PATH, 'r') as f:
        _schema = json.load(f)

    if os.path.exists(FREEZE_META_PATH):
        with open(FREEZE_META_PATH, 'r') as f:
            _freeze_meta = json.load(f)


def get_artifacts():
    """Return (model, preprocessor, schema, freeze_meta), loading lazily."""
    if _model is None:
        _load_artifacts()
    return _model, _preprocessor, _schema, _freeze_meta


# ---------------------------------------------------------------------------
# Feature validation
# ---------------------------------------------------------------------------
def _get_expected_features(schema):
    """Return ordered list of all expected input features."""
    return (
        schema.get('numeric_features', []) +
        schema.get('boolean_features', []) +
        schema.get('categorical_features', [])
    )


def validate_observation(obs: pd.Series, schema: dict) -> list:
    """
    Validate a single observation row.
    Returns list of warning strings (empty = valid).
    Raises ValueError on hard failures.
    """
    warnings = []
    expected_features = _get_expected_features(schema)

    # 1. Check for forbidden target/audit columns
    for field in FORBIDDEN_FIELDS:
        if field in obs.index:
            raise ValueError(
                f"Forbidden future/target field '{field}' present in observation. "
                "This would cause data leakage."
            )

    # 2. Check all required features present
    missing = [f for f in expected_features if f not in obs.index]
    if missing:
        raise ValueError(f"Required model features missing: {missing}")

    # 3. Check numeric features for NaN/Inf after they are present
    num_features = schema.get('numeric_features', [])
    for f in num_features:
        if f in obs.index:
            val = obs[f]
            if val is not None and not isinstance(val, str):
                try:
                    fval = float(val)
                    if not math.isfinite(fval) and not math.isnan(fval):
                        raise ValueError(f"Non-finite value in feature '{f}': {val}")
                except (TypeError, ValueError):
                    pass

    return warnings


# ---------------------------------------------------------------------------
# Cohort applicability check
# ---------------------------------------------------------------------------
def check_cohort_applicability(obs: pd.Series) -> str:
    """
    Return applicability status string.
    'within_primary_early_risk_cohort' if verified_waz >= -2
    'outside_primary_early_risk_cohort' if verified_waz < -2
    'unknown_cohort' if verified_waz is missing/NaN
    """
    if 'verified_waz' not in obs.index:
        return 'unknown_cohort'

    waz = obs.get('verified_waz')
    if waz is None or (isinstance(waz, float) and math.isnan(waz)):
        return 'unknown_cohort'

    try:
        waz = float(waz)
    except (TypeError, ValueError):
        return 'unknown_cohort'

    if waz >= PRIMARY_COHORT_WAZ_MIN:
        return 'within_primary_early_risk_cohort'
    else:
        return 'outside_primary_early_risk_cohort'


# ---------------------------------------------------------------------------
# Core inference
# ---------------------------------------------------------------------------
def predict_risk(
    obs: pd.Series,
    child_id: str = None,
    assessment_date: str = None,
) -> dict:
    """
    Compute growth-faltering risk for one observation at time T.

    Parameters
    ----------
    obs : pd.Series
        One row of model-ready data. Must NOT contain target/future columns.
    child_id : str, optional
        Identifier for the child (for audit purposes).
    assessment_date : str, optional
        ISO date string of the assessment (for audit purposes).

    Returns
    -------
    dict with keys:
        child_id, assessment_date, model_name, model_version,
        prediction_horizon_days, risk_probability, risk_flag,
        threshold, target_definition_version, model_applicability,
        warnings
    """
    model, preprocessor, schema, _ = get_artifacts()

    # Cohort applicability
    applicability = check_cohort_applicability(obs)

    # Validate
    warnings = validate_observation(obs, schema)

    expected_features = _get_expected_features(schema)

    # Build input DataFrame (one row, columns in schema order)
    row_df = pd.DataFrame([obs.reindex(expected_features)])

    # Preprocess: transform-only (NO fit)
    X_proc = preprocessor.transform(row_df)

    # Predict
    risk_prob = float(model.predict_proba(X_proc)[0, 1])

    # Finite check
    if not math.isfinite(risk_prob):
        raise ValueError(f"Model returned non-finite probability: {risk_prob}")

    risk_flag = int(risk_prob >= FROZEN_THRESHOLD)

    if applicability == 'outside_primary_early_risk_cohort':
        warnings.append(
            "verified_waz < -2 at index time: observation is outside the primary "
            "early-risk prediction cohort. Risk probability is computed but should "
            "be interpreted with caution."
        )

    return {
        "child_id": child_id,
        "assessment_date": assessment_date,
        "model_name": "xgboost",
        "model_version": MODEL_VERSION,
        "prediction_horizon_days": PREDICTION_HORIZON_DAYS,
        "risk_probability": round(risk_prob, 6),
        "risk_flag": risk_flag,
        "threshold": FROZEN_THRESHOLD,
        "target_definition_version": TARGET_DEFINITION_VERSION,
        "model_applicability": applicability,
        "warnings": warnings,
    }


# ---------------------------------------------------------------------------
# Batch inference (research only)
# ---------------------------------------------------------------------------
def batch_predict(df: pd.DataFrame, split_name: str) -> pd.DataFrame:
    """
    Run frozen-model inference on a split DataFrame (for research verification).
    Does NOT refit the preprocessor.

    Parameters
    ----------
    df : pd.DataFrame
        Full split DataFrame (may include target columns – they are excluded
        before inference).
    split_name : str
        e.g. 'train', 'validation', 'test'

    Returns
    -------
    pd.DataFrame with columns:
        child_id, visit_date, split, true_target, risk_probability, risk_flag
    """
    model, preprocessor, schema, _ = get_artifacts()
    expected_features = _get_expected_features(schema)

    # Reject forbidden fields from feature set
    feature_cols = [f for f in expected_features if f in df.columns and f not in FORBIDDEN_FIELDS]
    X_df = df[feature_cols].copy()

    # Ensure all schema columns present (fill missing with NaN for transform)
    for col in expected_features:
        if col not in X_df.columns:
            X_df[col] = np.nan

    X_proc = preprocessor.transform(X_df[expected_features])
    probs  = model.predict_proba(X_proc)[:, 1]
    flags  = (probs >= FROZEN_THRESHOLD).astype(int)

    result = pd.DataFrame({
        'child_id':         df['child_id'].values if 'child_id' in df.columns else None,
        'visit_date':       df['visit_date'].values if 'visit_date' in df.columns else None,
        'split':            split_name,
        'true_target':      df['future_growth_faltering_180d'].values if 'future_growth_faltering_180d' in df.columns else np.nan,
        'risk_probability': probs,
        'risk_flag':        flags,
    })

    return result


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    print("=" * 50)
    print("STAGE 10: RISK INFERENCE MODULE – SMOKE TEST")
    print("=" * 50)

    _load_artifacts()
    print(f"Model loaded:        {MODEL_PATH}")
    print(f"Preprocessor loaded: {PREPROCESSOR_PATH}")
    print(f"Schema loaded:       {SCHEMA_PATH}")
    print(f"Threshold:           {FROZEN_THRESHOLD}")

    # Load train split as a source of example observations
    train_path = os.path.join('data', 'splits', 'v1', 'train.csv')
    if not os.path.exists(train_path):
        raise FileNotFoundError(f"Train split not found: {train_path}")

    train_df = pd.read_csv(train_path)

    # Run batch inference on all three splits
    results = []
    for split_name, path in [
        ('train',      os.path.join('data', 'splits', 'v1', 'train.csv')),
        ('validation', os.path.join('data', 'splits', 'v1', 'validation.csv')),
        ('test',       os.path.join('data', 'splits', 'v1', 'test.csv')),
    ]:
        split_df = pd.read_csv(path)
        batch    = batch_predict(split_df, split_name)
        results.append(batch)
        print(f"  {split_name}: {len(batch)} predictions, "
              f"{batch['risk_flag'].sum()} flagged, "
              f"outside-cohort: {(split_df.get('verified_waz', pd.Series(dtype=float)) < PRIMARY_COHORT_WAZ_MIN).sum()}")

    all_preds = pd.concat(results, ignore_index=True)
    out_path  = os.path.join('research', 'evaluation', 'frozen_risk_predictions_v1.csv')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    all_preds.to_csv(out_path, index=False)
    print(f"\nFrozen risk predictions saved: {out_path}")
    print(f"Total predictions: {len(all_preds)}")
    print("Risk inference smoke test complete.")
