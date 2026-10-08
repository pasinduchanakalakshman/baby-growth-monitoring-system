# Stage 15D: Risk, Dynamic Risk, and XAI Services Evaluation Report

## Stage Purpose
The objective of this stage is to productionize the frozen 180-day growth-faltering risk model (XGBoost), the chronological dynamic risk trajectory mapping, and the local SHAP explainability mechanics into clean, scalable backend services.

## Architecture and Components

### 1. Risk Service (`risk_service.py`)
- **Frozen Pipeline**: Employs the frozen Stage 10 XGBoost artifact (`baseline_preprocessor_v1` and `xgboost.joblib`).
- **Feature Extraction**: Uses `ArtifactLoader` to fetch the strict Stage 10 `baseline_feature_metadata_v1.json` schema and maps `temporal_feature_service` inputs accordingly.
- **Applicability Filter**: Integrates `_check_cohort_applicability(waz)`. Gracefully returns `model_applicable = False` if the `verified_waz < -2.0`, mirroring Stage 10 clinical boundaries.
- **Output**: Returns safely isolated `risk_probability`, `risk_flag` (based on frozen 0.50 threshold), and horizon constraints without exposing arbitrary targets.

### 2. Dynamic Risk Service (`dynamic_risk_service.py`)
- **Strict Chronological Construction**: Traverses a full genuine child history sequentially.
- **Zero Leakage**: Reconstructs sequence features *strictly* using data available up to each discrete historical checkpoint (`visits[:i]`).
- **Output**: Returns a list of discrete time-step probability objects tracking chronological progression. No synthetic visits are interpolated.

### 3. XAI Service (`xai_service.py`)
- **SHAP Engine**: Implements `shap.TreeExplainer` exactly as in the Stage 11 research script, maintaining numerical log-odds parity.
- **UBJSON Patch**: Integrates the exact `decode_ubjson_buffer` patch required to reliably parse XGBoost models encoded with string-array base scores.
- **Frontend Safe Output**:
  - Filters all internal complex feature prefixes.
  - Limits output to Top 3 Positive and Top 3 Negative contributors.
  - Excludes any terms implying clinical causality (uses `increased/decreased model-predicted risk`).

## Parity Tests Performed
1. **Risk probability parity**: Passed (Identical probabilities matched to frozen dataset output).
2. **Probability in [0,1]**: Passed.
3. **Threshold remains 0.50**: Passed.
4. **Horizon remains 180**: Passed.
5. **WAZ < -2 applicability handled**: Passed.
6. **Dynamic trajectory chronological**: Passed.
7. **Only genuine visits used**: Passed.
8. **No forecast output used as risk input**: Passed.
9. **XAI loads**: Passed.
10. **SHAP feature mapping correct**: Passed.
11. **Frontend-safe explanation contains no causal wording**: Passed.
12. **Frozen artifacts unchanged**: Passed (Hash verification successful).

## Results
**Full regression suite:** 195 passed, 2 skipped, 0 failed.

**STAGE 15D STATUS: PASSED**
