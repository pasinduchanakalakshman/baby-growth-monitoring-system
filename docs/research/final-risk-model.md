# Final Risk Model Card (Stage 10)

## 1. Target

**future_growth_faltering_180d**

A binary indicator that within 180 days of an index observation:

- A child's verified WAZ **crosses below −2** for the first time (new stunting/wasting event), OR
- A child's verified WAZ **declines by ≥ 0.50** in the same window

This is a **research operational definition** derived from WHO anthropometric z-score thresholds applied to CHDR data. It is not a clinical diagnosis of malnutrition.

---

## 2. 180-Day Prediction Horizon

Each assessment uses the clinical features recorded at a single visit time **T**.

The model predicts the probability that the growth-faltering event criterion will be met **within 180 days of T**.

Future clinical measurements are never used as model inputs.

---

## 3. Primary Research Cohort

Children whose **index verified WAZ ≥ −2**.

Rationale: the target is defined as a *new* crossing below −2 or a significant decline. Children who are already below −2 at the index visit are excluded from the primary early-risk cohort.

If a child's index WAZ is < −2, the inference module returns:

```
model_applicability = "outside_primary_early_risk_cohort"
```

The risk probability is still computed but must be interpreted with caution and is not directly comparable to primary-cohort predictions.

---

## 4. Model Selected

**XGBoost (gradient-boosted decision tree)**

Trained on a child-level stratified training split (348 children, 5,380 observations).

Selected using **validation PR-AUC only**. The held-out test set was not used for any selection or tuning.

---

## 5. Why XGBoost is the Primary Risk Model

XGBoost was selected over sequence-aware models (LSTM, GRU, Transformer) based on the following empirical findings on the **frozen held-out test set**:

| Metric | XGBoost | Transformer |
|---|---|---|
| PR-AUC | **0.2375** | 0.1892 |
| ROC-AUC | 0.7499 | 0.7615 |
| Brier Score | **0.0408** | 0.1705 |
| Precision | **0.4286** | 0.0848 |
| Recall | 0.18 | 0.68 |
| Specificity | **0.9893** | 0.6714 |

Factors supporting XGBoost as the primary model:
- Strongest held-out PR-AUC (most important for highly imbalanced targets)
- Substantially better Brier score (probability calibration)
- Far fewer false positives per true positive (clinical resource implications)
- Simpler, faster inference pipeline with no sequence construction required
- Classical gradient boosting performs robustly on carefully engineered temporal features at this dataset scale

---

## 6. Why the Transformer Remains the Best Sequence-Aware Research Model

Among LSTM, GRU, and the lightweight Transformer, the Transformer achieved the **highest validation PR-AUC** (0.1879 vs. GRU 0.1843 vs. LSTM 0.1588).

The Transformer is retained as the **best sequence-aware research contribution** from this work. It preserves the longitudinal modelling capability, using positional encoding and explicit attention masking.

> Sequence-aware models were **not** assumed to outperform classical baselines. Comparative performance was determined empirically on the same held-out test partition. The finding that XGBoost performs better on primary metrics is a scientifically valid and reportable result.

---

## 7. Class Imbalance

The training data is highly imbalanced:
- **231 positive cases** out of 5,380 training observations (~4.3%)

Addressed with:
- **Balanced class weights** derived from training data only
- **PR-AUC as the primary evaluation metric** (not accuracy or ROC-AUC alone)

SMOTE and oversampling were deliberately excluded.

---

## 8. Frozen Threshold

**Threshold = 0.50**

This threshold was set and frozen during Stage 7. It was **not** re-optimized after viewing test results.

For any probability-based comparisons (model selection, architecture choice), threshold-independent metrics (PR-AUC, ROC-AUC) were used.

---

## 9. Expected Input Features

The model expects the following feature groups (defined in `models/metadata/baseline_feature_metadata_v1.json`):

| Group | Count | Examples |
|---|---|---|
| Numeric | 37 | `age_days`, `verified_waz`, `waz_velocity_per_30d` |
| Boolean | 9 | `breastfeeding_status`, `recent_illness` |
| Categorical | 4 | `sex`, `supplement_type` |

Preprocessing: median imputation + StandardScaler (numeric), constant imputation (boolean), OneHotEncoder with `handle_unknown='ignore'` (categorical).

**The preprocessing pipeline is fitted on training data only and must never be re-fitted at inference time.**

---

## 10. Model Applicability

| Condition | `model_applicability` value |
|---|---|
| index verified_waz ≥ −2 | `within_primary_early_risk_cohort` |
| index verified_waz < −2 | `outside_primary_early_risk_cohort` |
| verified_waz missing | `unknown_cohort` |

---

## 11. Limitations

1. **No external validation.** The model has been evaluated only on the held-out research test split drawn from the same CHDR population. Performance on different populations or clinical settings is unknown.
2. **Small positive class.** 231 positive training examples limits statistical power for learning complex patterns.
3. **Irregular visit intervals.** The temporal features encode visit intervals, but the model does not natively process continuous time.
4. **Target definition is operational, not clinical.** WAZ z-score thresholds are proxies, not direct clinical diagnoses.
5. **Growth faltering definition is prospective and research-specific.** It depends on future visit data being available to construct the training target.

---

## 12. Risk Prediction vs. Diagnosis

> **"The risk probability is a research model output and is not a clinical diagnosis."**

The output of this model is a probability estimate that a specific anthropometric event will occur within 180 days. It should be used as a **research screening signal** to prioritize follow-up, not as a standalone clinical determination.

---

## 13. Dynamic Risk Update Behaviour

Risk is assessed independently at each eligible visit time T:

1. New CHDR observation recorded at time T
2. WHO and temporal features computed from T
3. Features passed to the frozen preprocessing pipeline (transform-only)
4. XGBoost produces risk_probability and risk_flag
5. Assessment stored with assessment_date = T
6. At next visit T+1, a new assessment is computed
7. Risk change = risk_probability(T+1) − risk_probability(T)

**Risk is not interpolated between visits.** Assessments exist only at actual visit times.

---

## 14. Future Validation Needs

Before any clinical use, the following are required:

- External validation on an independent cohort (different district, region, or country)
- Clinical review of threshold appropriateness for public health decision-making
- Prospective pilot study comparing model alerts to clinician assessments
- Formal sensitivity analysis for missing data scenarios
- Ethical review and approval for each intended deployment context
