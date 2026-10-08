# Dynamic Risk Assessment

This document explains the conceptual flow and implementation of the dynamic risk trajectory logic (Stage 10).

## 1. Core Concept

Risk prediction is not a one-time event. As a child returns for subsequent Child Health Development Record (CHDR) visits, new clinical information becomes available.

The **Dynamic Risk Trajectory** is the chronological sequence of risk assessments for a single child across all their eligible visits.

## 2. Assessment Flow at Visit Time *T*

At any given visit time *T*, the following process occurs:

1. **New CHDR Observation:** A new row of CHDR data is recorded for the child.
2. **WHO Features:** Anthropometric measurements are converted to WHO z-scores (WAZ, HAZ) using standard references.
3. **Temporal Features:** Longitudinal context (e.g., days since previous visit, weight velocity, WAZ change) is computed using the child's history up to and including time *T*.
4. **Preprocessing:** The model-ready observation is passed through the **frozen preprocessing pipeline** (imputation, scaling, encoding). **Crucially, the preprocessor only applies `transform()` – it is never re-fitted.**
5. **Frozen Risk Model:** The preprocessed features are fed into the **frozen primary XGBoost model**.
6. **Risk Probability:** The model outputs a probability (0.0 to 1.0) that the 180-day growth-faltering event will occur.
7. **Assessment Stored:** The probability, the boolean risk flag (based on the frozen 0.5 threshold), and the assessment date (*T*) are recorded in the child's trajectory.

## 3. The Risk Trajectory

When the child returns for their next visit (*T+1*), the process repeats.

The trajectory allows calculation of the **risk probability change**:
`change = risk_probability(T+1) - risk_probability(T)`

## 4. Key Constraints and Limitations

- **No Interpolation:** Risk is **not** interpolated daily or monthly between visits. Risk exists only at actual assessment times (when new clinical data is collected).
- **No Future Leakage:** An assessment at time *T* uses strictly information known at or before *T*. Future measurements or target indicators are explicitly rejected by the inference module.
- **Not a Clinical Diagnosis:** Changes in risk probability (even rapid increases) do not automatically constitute a clinical diagnosis of malnutrition. They represent changing model confidence based on the training cohort patterns.
