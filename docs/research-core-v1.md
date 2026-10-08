# Research Core v1

## Purpose
The purpose of this document is to define the exact, protected research core established at the end of Stage 11. It provides a reproducible baseline called **Research Core v1**. 

Future development and stages (e.g. forecasting, production APIs, frontends) must branch from this baseline but **must not** overwrite or alter these validated artifacts.

## Completed Stages
Stage 1 through Stage 11 have been fully executed, verified, tested, and locked in this core.

## Primary Prediction
The core evaluates the **180-day growth-faltering risk** (`future_growth_faltering_180d`).

## Primary Model
**XGBoost** is the designated primary risk and deployment model (optimized for PR-AUC on tabular data).

## Sequence-Aware Research Model
**Transformer** is retained as the baseline sequence-aware research contribution for analyzing sequential and temporal embeddings.

## Explainability
- **XGBoost**: Explained natively via **SHAP (TreeExplainer)** in raw log-odds margin space.
- **Transformer**: Explained longitudinally via **Integrated Gradients** over a 20-step padded history, strictly avoiding attribution to padding tokens.

## Dynamic Risk
Risk is recalculated *dynamically* as new genuine child observations become available in the longitudinal record.

## Data Integrity Principles
- No fabricated monthly measurements.
- No fabricated height.
- Actual visit timing is strictly preserved.
- Insufficient follow-up horizons are excluded, not labelled negative.
- Child-level data splitting prevents all leakage.
- No future leakage in testing.

## Intended Output
The frozen inference pipeline provides:
- Current growth tracking.
- 180-day early risk probability.
- Dynamic risk history tracking.
- XAI explanation for local predictions.

## Limitations
- **Research use only.**
- **Not a clinical diagnosis.**
- **Not externally clinically validated.**

## Future Extensions
The safe development boundary has been established. Future extensions will read from Research Core v1, but output to their own namespaces:

- **Stage 13:** 30-day forecast feasibility / dataset construction.
- **Stage 14:** Future WAZ + derived weight forecast modeling.
- **Stage 15:** Production FastAPI implementation.
- **Stage 16:** Mother-facing frontend.
- **Stage 17:** Sri Lankan nutrition recommendation logic.
- **Stage 18:** End-to-end clinical deployment evaluation.
