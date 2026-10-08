# Stage 15F: FastAPI Endpoints Evaluation Report

## Stage Purpose
The objective of this stage is to safely expose the isolated research pipelines (WHO computation, Temporal feature generation, Linear Regression 30-day forecast, XGBoost 180-day growth faltering risk, SHAP explainability) and the new Baby/Measurement Domain models through robust, frontend-ready REST API endpoints via FastAPI.

## Routes Implemented
The following routes were successfully designed and tested following a clear separation between demographic operations and longitudinal growth analytics:

### Baby Profile Routes
- `POST /api/v1/baby/register`: Securely creates a baby linked to an abstracted authenticated user entity.
- `GET /api/v1/baby/profile`: Retrieves active demographic and static data.
- `PUT /api/v1/baby/profile`: Mutates optional parameters like `name` or `birth_length_cm` natively.

### Growth Measurement Routes
- `POST /api/v1/growth/measurements`: Appends chronological visits. Transparently calculates real-time WHO outputs (`WAZ`, `HAZ`) before saving.
- `GET /api/v1/growth/overview`: The master frontend dashboard payload orchestrating integration across:
    1. Base metrics (age, real metrics).
    2. 30-day Forecasting (`estimated_future_weight_kg`, `estimated_future_waz`).
    3. 180-day Dynamic Risk flag orchestration (`risk_available`, `model_applicable`).
- `GET /api/v1/growth/history`: Chronological historical arrays safely formatted.
- `GET /api/v1/growth/forecast`: Standalone isolated query targeting strictly `forecast_service.py`.
- `GET /api/v1/growth/risk/latest`: Calculates temporal aggregations strictly resolving the frozen XGBoost schema on demand.
- `GET /api/v1/growth/risk/trajectory`: Traverses chronologically rendering historical probability fluctuations.
- `GET /api/v1/growth/risk/explanation`: Extracts top contributors using UBJSON patched SHAP engine exclusively translated for clinical safety.
- `GET /api/v1/growth/model-info`: Retrieves `model_loader.py` static metadata dictating application versioning and rules.

## Add Measurement Workflow Verification
The workflow was correctly mapped to ensure missing historical values are never synthetically imputed. When a measurement is added, it stores native input and calculates cross-sectional WHO logic. Prediction logic triggers only when sequentially robust data is evaluated in standard REST queries (`/risk/latest` etc).

## API Tests Execution
- **baby registration**: Passed
- **baby profile/update**: Passed
- **measurement creation**: Passed
- **overview orchestration**: Passed
- **insufficient history rejection**: Passed (Correctly defaults or skips when data is insufficient without throwing 500 server errors).
- **outside-risk-cohort behavior**: Handled natively by returning `applicable = False` cleanly.
- **XAI JSON generation**: Handled efficiently; converted recursive `np.nan` internal artifacts to explicit JSON standard `None` bounds securely.
- **Model-info**: Passed

## Results
**Full regression suite for API endpoints:** 6 passed tests comprehensively hitting all 11 routes.

**STAGE 15F STATUS: PASSED**
