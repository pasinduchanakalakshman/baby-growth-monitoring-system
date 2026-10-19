# Task 3.5C: Hybrid Validation Sensitivity Analysis Report

**Project:** Baby-growth-monitoring-system  
**Scope:** Sensitivity Stress-Testing of 90/10 Hybrid Advantage Against 46 Uncertain-Negative Visits  
**Date:** October 2026  
**Auditor / Data Scientist:** Antigravity AI  
**Status Verdict:** **PASS**  

---

## 1. Executive Summary & Beginner-Friendly Explanation

### What Was the Concern?
In Task 3.5B, we observed that combining **90% Standard XGBoost and 10% Clean Transformer ($\alpha = 0.90$)** improved validation PR-AUC by **+0.0188 (+1.88%)** over standalone XGBoost.

However, in our longitudinal dataset, there are **46 validation visits where the child never returned to the clinic within the next 180 days**. Under our standard research evaluation heuristic, these visits were labeled as $y = 0$ (negative for growth faltering), because no faltering event was documented within 180 days. But in reality, because the baby was not seen, we cannot know for certain whether they faltered during that window—they are **"uncertain negatives"**.

### What Was the Goal of Task 3.5C?
The goal was to test:
> *Did the 90/10 hybrid's advantage only look good because of how it scored those 46 uncertain-negative visits? Or does the advantage still hold when those 46 questionable visits are completely removed?*

### What Did We Find?
1. **The Advantage is Highly Robust:** When all 46 uncertain-negative rows were excluded (reducing the validation set from 1,143 to 1,097 observations), the hybrid's PR-AUC advantage over XGBoost shifted from **+0.018805 (+1.88%)** to **+0.019493 (+1.95%)**. This is an almost imperceptible change of just **+0.000688 (+0.07 percentage points)**.
2. **Both Models Saw a Slight Rise in Standalone PR-AUC:** Removing 46 negative cases naturally increased the positive prevalence from 3.67% to 3.83%, which raised standalone XGBoost PR-AUC from 0.2909 to 0.3017 and the Hybrid PR-AUC from 0.3097 to 0.3212.
3. **Statistical Uncertainty Remains Consistent:** In a 2,000-iteration child-clustered bootstrap on the reduced subset, the 95% confidence interval is **[-0.003036, +0.051416]**, with the hybrid outperforming XGBoost in **93.15%** of bootstrap samples.
4. **Key Conclusion:** The 90/10 hybrid's performance advantage does **not** depend on the 46 uncertain-negative visits.

---

## 2. Identification of the 46 Uncertain-Negative Records

In accordance with our outcome-follow-up definition:
- An observation at $(c, t)$ is classified as an **uncertain negative** if child $c$ has **zero recorded clinical visits in $(t, t + 180\text{ days}]$**.
- **Audit Findings:**
  - Exactly **46 validation encounters** meet this condition.
  - Across these 46 encounters, **all 46 have ground truth label $y = 0$** (assigned by the right-censoring heuristic).
  - These 46 visits belong to 37 distinct children.

---

## 3. Side-by-Side Comparative Results

We compared performance on the **Full Validation Cohort (1,143 rows)** versus the **Analysis-Only Reduced Subset (1,097 rows)**:

| Evaluation Metric | Full Validation Cohort (N = 1,143) | Reduced Subset (N = 1,097, Excl. 46) | Impact of Excluding Uncertain Negatives |
| :--- | :---: | :---: | :---: |
| **Cohort Rows** | 1,143 | **1,097** | -46 rows |
| **Unique Children** | 75 | **75** | Unchanged |
| **Positive Faltering Cases** | 42 | **42** | Unchanged (0 positives lost) |
| **Negative Observations** | 1,101 | **1,055** | -46 uncertain negatives |
| **Positive Prevalence** | 3.675% | **3.829%** | +0.154% (denser minority class) |
| **Standalone XGBoost PR-AUC** | 0.290935 | **0.301714** | +0.010779 |
| **90/10 Hybrid PR-AUC** | 0.309740 | **0.321207** | +0.011467 |
| **$\Delta$ PR-AUC (Hybrid - XGB)** | **+0.018805 (+1.88%)** | **+0.019493 (+1.95%)** | **+0.000688 (+0.07%)** |
| **Standalone XGBoost ROC-AUC** | 0.822802 | **0.823584** | +0.000782 |
| **90/10 Hybrid ROC-AUC** | 0.837442 | **0.837666** | +0.000224 |
| **$\Delta$ ROC-AUC (Hybrid - XGB)** | **+0.014640** | **+0.014082** | -0.000558 |
| **Standalone XGBoost Brier** | 0.036127 | **0.036471** | +0.000344 |
| **90/10 Hybrid Brier** | 0.035560 | **0.035798** | +0.000238 |
| **$\Delta$ Brier (Hybrid - XGB)** | **-0.000567** | **-0.000673** | -0.000106 (lower is better) |

---

## 4. Paired Child-Clustered Bootstrap on Reduced Subset

To assess sampling uncertainty when uncertain negatives are removed, we repeated the **2,000-iteration paired child-clustered bootstrap** across the 75 validation children clusters:

| Bootstrap Metric | Full Validation (N = 1,143) | Reduced Subset (N = 1,097) | Status |
| :--- | :---: | :---: | :---: |
| **Iterations** | 2,000 (0 degenerate) | **2,000 (0 degenerate)** | Verified |
| **Point Estimate $\Delta$ PR-AUC** | +0.018805 | **+0.019493** | +0.07% shift |
| **Bootstrap Mean $\Delta$ PR-AUC** | +0.017546 | **+0.018249** | +0.07% shift |
| **Bootstrap Standard Error** | 0.014457 | **0.014448** | Identical variability |
| **95% Clustered CI** | [-0.003754, +0.050754] | **[-0.003036, +0.051416]** | Narrower lower boundary |
| **Empirical $P(\text{Hybrid} > \text{XGB})$** | 91.95% | **93.15%** | Slightly higher consistency |
| **Interval Spans Zero?** | Yes | **Yes (Lower bound is -0.0030)** | Still spans zero |

---

## 5. Critical Methodological & Clinical Guardrails

In adherence to strict clinical machine learning research principles:

1. **A Sensitivity Check is Not a Label Fix:**  
   Excluding the 46 uncertain negatives is an analytical stress test to confirm stability. It does **not** mean that the remaining 1,097 labels are perfect ground truth. Potential loss to follow-up and clinical interval-censoring remain inherent real-world data characteristics.
2. **Exploratory Status Preserved:**  
   Because the weight $\alpha = 0.90$ was chosen based on full validation data in Task 3.5B, testing it on the reduced subset remains **exploratory**. It does not replace independent confirmatory validation.
3. **No Datasets Modified:**  
   The reduced subset was constructed purely in memory for this sensitivity analysis. The frozen validation files (`validation.csv`, `validation_v2.csv`) and prediction tables remain completely untouched.
4. **Held-Out Test Split Untouched:**  
   The final test partition (`test.csv` / `test_v2.csv`) was **strictly unexamined and unaccessed**.

---

## 6. Generated Output Artifacts

All sensitivity analysis artifacts have been written to `research/evaluation/hybrid_experiments/v1/`:

1. **Structured Numerical Results (JSON):**  
   [`research/evaluation/hybrid_experiments/v1/hybrid_sensitivity_analysis_v1.json`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/evaluation/hybrid_experiments/v1/hybrid_sensitivity_analysis_v1.json)
2. **Comprehensive Markdown Audit Report:**  
   [`research/evaluation/hybrid_experiments/v1/hybrid_sensitivity_analysis_v1.md`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/evaluation/hybrid_experiments/v1/hybrid_sensitivity_analysis_v1.md)
3. **Reproducible Analysis Script:**  
   [`research/scripts/run_hybrid_sensitivity_analysis.py`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/scripts/run_hybrid_sensitivity_analysis.py)

---

## 7. Final Task Verdict

# **OVERALL STATUS: PASS**

The sensitivity analysis was successfully executed. The 46 uncertain-negative validation visits were verified and excluded in an in-memory stress test. The 90/10 hybrid's PR-AUC advantage over Standard XGBoost was proved to be **exceptionally stable** ($\Delta = +0.0188$ full vs. $+0.0195$ reduced, shift $= +0.0007$).
