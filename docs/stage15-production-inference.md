# Stage 15: Production Inference Integration

## Overview
Stage 15 successfully transitions the validated Research Core artifacts (Stages 1–14) into a production-ready REST API backend serving inference via FastAPI, strictly enforcing parity without retraining or mutating original constraints.

## Architecture
- **Web Framework**: FastAPI handles high-concurrency stateless requests.
- **Database Layer**: SQLAlchemy mapping Pydantic schemas over a deterministic relational structure (User -> Baby -> GrowthMeasurement).
- **Core Domain**: Models isolate demographic and physical inputs from derived logical metrics.

## Artifact Loading
The `model_loader.py` guarantees immutability. It securely deserializes the isolated Stage 12 and Stage 14 artifacts directly from `research_core_v1` tracking hashes and metadata definitions on boot. It avoids loading duplicate or stale artifacts.

## WHO Service
`who_service.py` natively maps to the Stage 3 standard. It computes inverse equations derived from explicit internal LM tables dynamically resolving WAZ and HAZ values exactly tracking research outputs.

## Temporal Feature Service
`temporal_feature_service.py` ensures longitudinal rolling aggregations (velocity, momentum, exponential moving averages) perfectly match the complex logic constructed in Stage 4.

## Forecast Service
`forecast_service.py` applies the Stage 14 pre-trained Linear Regression model over a structured 30-day target timeline (verified internally against the 25–35 day optimal clinical window).

## Risk Service & Dynamic Risk
`risk_service.py` securely evaluates the frozen XGBoost tree for the 180-day growth faltering target logic. `dynamic_risk_service.py` provides trajectory tracking chronologically mapping risk transitions per visit natively.

## Explainable AI (XAI)
`xai_service.py` patches SHAP's raw UBJSON tree interpreter. It strips un-serializable Numpy attributes to output human-readable feature directions mapping safely to frontend diagnostic requirements while keeping a strict disclaimer against causality.

## API Routes
Robust hierarchical routes separated dynamically:
- `/api/v1/baby/register`, `/api/v1/baby/profile` (Demographics)
- `/api/v1/growth/measurements` (Data entry & real-time analytics)
- `/api/v1/growth/overview` (Dashboard unified payload)
- `/api/v1/growth/risk/*` (Advanced logic and XAI logic)

## Parity Testing
API results mapped directly backward to Stage 14 history to guarantee outputs, threshold resolutions, derived weights, temporal mappings, and numerical representations resolve precisely the same locally without variance.

## Limitations
- Predictions are statically bounded to nominal intervals (30-day forecast, 180-day risk).
- Strictly applicable for `WAZ >= -2`.

## Newborn Behavior
Limited history natively flags internal safety checks bypassing prediction steps elegantly by flagging `available=False` resolving safely via standard 200 HTTP payloads rather than crashing via 500 status.
