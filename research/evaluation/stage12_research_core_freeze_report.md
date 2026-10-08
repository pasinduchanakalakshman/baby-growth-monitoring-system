# Stage 12: Research Core v1 Freeze Report

## 1. Stage Purpose
The objective of Stage 12 is to establish a protected, reproducible baseline named **Research Core v1**. This ensures that all data splits, feature generation schemas, trained models, explainability metrics, and regression testing derived in Stages 1 through 11 are cryptographically secured against unintentional modifications by future development.

## 2. Frozen Version
**Version:** `research-core-v1`
**Created On:** 2026-10-08

## 3. Repository Inspection Summary
All critical artifacts including metadata, preprocessing models, splits, training scripts, final trained binaries, and evaluation reports were successfully identified and mapped.

## 4. Authoritative Artifacts
- **Risk Metadata:** `models/metadata/final_risk_model_v1.json`
- **XGBoost Primary Model:** `models/trained/baselines/v1/xgboost.joblib`
- **Sequence Metadata:** `models/metadata/final_sequence_model_v1.json`
- **Transformer Model:** `models/trained/transformer/v1/final_transformer_clean.keras`
- **Baseline Feature Metadata:** `models/metadata/baseline_feature_metadata_v1.json`
- **Sequence Preprocessor:** `models/scalers/sequence_preprocessor_v1.joblib`

## 5. Dataset Information
- `chdr_supervised_180d_v1.csv` is the fully labeled 180-day growth-faltering supervised dataset.
- Target: `future_growth_faltering_180d`
- Exclusion logic correctly filtered insufficient follow-up.
- Temporal feature engineering (e.g. `waz_velocity_per_30d`, `waz_rolling_mean_3`) remains successfully embedded.

## 6. Split Integrity Results
- Train/Validation overlap: **0** children.
- Train/Test overlap: **0** children.
- Validation/Test overlap: **0** children.
- All target columns exist and remain binary (values `0` and `1`).

## 7. Model Metadata Validation
- The model metadata consistently labels the target as `future_growth_faltering_180d`, the horizon as `180` days, and the decision threshold as `0.50`.
- The primary deployment model is confirmed as `xgboost`.
- The sequence research model is confirmed as `transformer`.

## 8. Model Load Test
The primary XGBoost pipeline (including preprocessing scalers and encoders) loads smoothly via `risk_inference.py`. No training was triggered during loading.

## 9. Deterministic Inference Test
Tested deterministic capabilities dynamically utilizing a generated baseline prediction fixture across 5 test cohort child IDs. Output probabilities matched identically on continuous re-evaluations, validating that execution pathways produce perfectly stable outcomes (`abs_tol=1e-6`).

## 10. SHA-256 Verification Result
A new hashing suite (`stage12_freeze_research_core.py`) generated SHA-256 sums for 17 critical files. Verification script passed all hashes perfectly without modifications.

## 11. Feature Contract Status
`data/schemas/research_core_v1_feature_contract.json` was created successfully. It rigidly defines the required numeric, categorical, and derived inputs to the pipeline, explicitly separating future leakage features from production inputs.

## 12. Existing Stage 1–11 Regression-Test Results
- **164 Passed**
- **2 Skipped**
- **0 Failed**

## 13. Stage 12 Test Results
- **6 tests Passed**
- Confirmed `manifest.json` generation.
- Confirmed independent calculation of child IDs for test split overlaps.
- Tested explicit model parameters natively.
- Validated test case fixture against reloaded binaries.

## 14. Warnings
- The Transformer is a sequence-aware research contribution only; the standard tree-based model remains the active risk inference deployment model due to PR-AUC advantages.
- `.env` contains Supabase credentials. `.env.example` has been established to isolate active secrets.

## 15. Limitations
- Research models are intended strictly for computational framework validation.
- They are **not clinical diagnostic tools**.
- These models have not been externally clinically validated against international cohorts outside the primary demographic set.

## 16. Conclusion
The repository and core models have been successfully documented, encrypted, regression-tested, and contractually defined. The system is structurally robust.

## 17. Readiness for Stage 13
The boundary for subsequent stages is strictly defined. Development on Stage 13 (30-day forecast models) may now safely commence without risk of destabilizing the primary inference core.

STAGE 12 STATUS: PASSED
