# Stage 16F: 180-Day Risk, Dynamic Risk, and XAI UI

## Overview
This stage implements the mother-facing presentation of the project's primary early-risk model (XGBoost v1) trained to predict 180-day growth faltering. It provides three main interfaces: Latest Risk Assessment, Risk History (Trajectory), and Risk Explanation (Why This Risk?).

## 180-Day Target Definition
The target `future_growth_faltering_180d` is defined as a future event within 180 days where a child (whose WAZ >= -2 at index time) experiences either:
- A new crossing from WAZ >= -2 to future WAZ < -2
- A WAZ decline >= 0.50

The model predicts the probability of this outcome based on genuine historical recorded data.

## Primary Frozen Model
The UI relies strictly on the frozen backend XGBoost v1 model. No predictions or probabilistic aggregations are performed on the frontend. The Transformer sequence model is reserved for research evaluation. 

## Endpoints
- **Latest Risk**: `GET /api/v1/growth/risk/latest`
- **Dynamic Risk Trajectory**: `GET /api/v1/growth/risk/trajectory`
- **XAI / Explanation**: `GET /api/v1/growth/risk/explanation`
- **Model Info**: `GET /api/v1/growth/model-info`

## Dynamic Risk Trajectory
The dynamic risk view plots the model's estimated probability at each recorded genuine visit. No synthetic interpolations or artificial assessments are created between genuine records. 

## Explainable AI (SHAP)
The XAI feature consumes backend-generated SHAP values from the `TreeExplainer`. The frontend displays the most significant contributing factors that increased or reduced the model-predicted risk.
- **Interpretation Rule**: Explanations strictly use non-causal wording (e.g., "influenced the model-predicted risk" rather than "caused malnutrition").

## Separation from 30-Day Forecast
The approximately 30-day forecast is an entirely separate output from the 180-day early risk model. Forecast output is NOT fed into the risk model as features.

## Responsive UX
The UI is fully responsive (mobile, tablet, desktop) without relying on arbitrary fixed phone frames. Skeletons and loading states provide fluid transitions, and error states (e.g., missing records or unavailable cohort eligibility) are presented cleanly.

## Limitations
- Model assessments are decision-support information, not guaranteed clinical outcomes or diagnoses.
- Explanations are local model contributions (SHAP) and do not establish clinical causality.
- Known sklearn warning: Training environment (1.7.2) mismatches slightly with production backend (1.9.1) causing minor UserWarnings during artifact loading, which has been documented.
