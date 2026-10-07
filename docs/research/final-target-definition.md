# Final Target Definition (Stage 5B)

## Overview
This document officially defines the research target to be used for the supervised learning phase of the early prediction framework. The definition was established following rigorous feasibility and refinement analysis (Stages 5A and 5B-PRE) to ensure strict causal ordering, clinical relevance, and statistical feasibility without exposing the model to future leakage.

## Operational Research Target Definition

- **Prediction Horizon:** 180 days
- **Primary Supervised Cohort:** Observations where `verified_waz` >= -2.0 at index time (T).

**Target Label:** `future_growth_faltering_180d`

The target is `1` (Positive) if, within the 180 days following observation T, the SAME child experiences *either* of the following events:

1. **New WHO Threshold Crossing:**
   The child's WAZ drops into the severely malnourished range (future `verified_waz` < -2.0) after having been at or above -2.0 at time T.
2. **Severe WAZ Deterioration:**
   The child's growth velocity decelerates sharply, resulting in a future `verified_waz` drop of at least `0.50` standard deviations from their index WAZ.

Otherwise, the target is `0` (Negative).

## Methodological Rules & Exclusions

### 1. Insufficient Follow-Up (Censoring)
If the index observation (T) occurs within 180 days of the child's final recorded visit in the entire dataset, we cannot definitively know if a 180-day event occurred. 
- These rows are **EXCLUDED** from the supervised training dataset.
- They are **NOT** labeled as negative (`0`), as doing so introduces a severe negative bias for all recent observations.

### 2. Prevalent Risk Exclusion (Already Below Threshold)
The primary predictive objective of this framework is *early prediction* and preventative intervention. If a child's WAZ is already < -2.0 at index time T, they are suffering from prevalent severe malnutrition. 
- These rows are **EXCLUDED** from the primary predictive dataset (`chdr_supervised_180d_v1.csv`).
- They are preserved in `chdr_supervised_exclusions_180d_v1.csv` as they may be utilized in secondary modeling for tracking recovery or predicting further deterioration.

### 3. Absolute Prevention of Future Leakage
To ensure strict separation between features (X) and the target (Y):
- No future measurements (e.g., `future_waz`, `event_weight`) are appended to the candidate feature space.
- The component targets used to calculate the binary label (`target_new_threshold_crossing_180d`, `target_waz_decline_05_180d`) are preserved purely for auditability and are strictly defined as `audit_only_columns` in the schema. They must NEVER be used as model inputs.

## Disclaimer
> **IMPORTANT:** This target is an operational research definition strictly for ML model development, training, and evaluation. It is not itself a clinical diagnosis, nor is it an internationally validated medical threshold for growth faltering. Final clinical and domain validation of the model's predictions based on this target is still pending.
