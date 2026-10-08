# Stage 15A: Frozen Artifact Loader

## Overview
The `ArtifactLoader` acts as the foundational data access layer for the Child Growth Monitoring Service. It centrally resolves, validates, and lazy-loads all required frozen research artifacts (models, preprocessors, schemas, metadata, and WHO references) into the production memory space.

## Artifact Locations
All models are loaded relative to the project root directory to ensure stability across environments (Docker, local testing, or manual execution).

- **Risk Model:** `models/trained/baselines/v1/xgboost.joblib`
- **Risk Preprocessor:** `models/scalers/baseline_preprocessor_v1.joblib`
- **Risk Schema:** `models/metadata/baseline_feature_metadata_v1.json`
- **Risk Metadata:** `models/metadata/final_risk_model_v1.json`
- **Forecast Model:** `models/forecasting/v1/final_model_v1.joblib`
- **Forecast Preprocessor:** `models/forecasting/v1/final_preprocessor_v1.joblib`
- **Forecast Schema:** `data/schemas/forecast_30d_model_feature_schema_v1.json`
- **Forecast Metadata:** `models/metadata/final_forecast_model_v1.json`
- **WHO References:** Located under `data/external/WHO Standards/`

## Caching Behavior
The loader implements the **Singleton** pattern. When a service requests an artifact (e.g., `artifact_loader.get_risk_model()`), the loader:
1. Checks the in-memory `_cache` dictionary.
2. If present, returns the instantiated object immediately.
3. If absent, resolves the file path, loads the artifact via `joblib`, `json`, or `pandas`, validates it, and saves it into `_cache` before returning it.

This guarantees that large model files and WHO tables are loaded exactly once during the application's lifecycle, eliminating I/O overhead on subsequent inference requests.

## Metadata Validation
To prevent severe production incidents (e.g., accidentally loading a development model into production), the loader performs strict metadata validation:
- **Risk Model:** Validates that the model is `xgboost`, the target is `future_growth_faltering_180d`, the prediction horizon is exactly `180` days, and the risk threshold is `0.5`.
- **Forecast Model:** Validates that the model is `Linear`, the nominal horizon is `30` days, the operational training window was `25-35 days`, and the primary target is `target_verified_waz`.

## Failure Behavior
If a file is missing, the loader natively raises a `FileNotFoundError`. If metadata fails validation, it raises a `ValueError`. The system explicitly crashes on startup rather than serving predictions using unverified artifacts.

## Checksum Protection
The `ArtifactLoader` strictly adheres to the frozen states defined in Stages 12, 13, and 14. Cryptographic SHA-256 validation is enforced via the `test_stage15a_artifact_loader.py` test suite, guaranteeing that no frozen file was modified during the implementation of the backend layer.
