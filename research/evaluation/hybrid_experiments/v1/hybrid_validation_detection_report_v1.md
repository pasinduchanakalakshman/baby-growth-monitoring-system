# Task 3.5D: Hybrid Validation Detection Analysis Report

**Project:** Baby-growth-monitoring-system  
**Scope:** Clinical Detection Comparison: Standard XGBoost vs. 90/10 Hybrid across Operating Thresholds  
**Date:** October 2026  
**Auditor / Data Scientist:** Antigravity AI  
**Status Verdict:** **PASS**  

---

## 1. Executive Summary & Beginner-Friendly Explanation

### What Was the Goal?
In Task 3.5B, we saw that blending **90% Standard XGBoost and 10% Clean Transformer ($\alpha = 0.90$)** produced a higher overall PR-AUC score (0.3097 vs. 0.2909) than XGBoost alone.

However, clinical doctors and nurses cannot act on an abstract curve like PR-AUC. In a clinic, an algorithm must issue an **alert** ("this baby needs immediate attention") or **no alert** ("this baby is growing normally").

The goal of **Task 3.5D** was to evaluate how both models perform in practice when tuned to catch different proportions of growth-faltering cases:
> *If a clinic wants to catch 50%, 70%, or 80% of all babies who will experience growth faltering, how many false alarms does each model generate, and how many distinct children does each model protect?*

### What Did We Discover?
1. **At Standard Cutoff 0.50 (Illustrative Only):** Both models behave similarly because 0.50 catches only ~28% to 31% of faltering events. However, 0.50 is **not** a calibrated clinical threshold and should never be used as the primary basis of comparison.
2. **At High-Recall Screening Targets ($\ge 70\%$ and $\ge 80\%$), the Hybrid Excels:**
   - **At $\ge 70\%$ Recall (catching 30 out of 42 faltering visits):** The 90/10 Hybrid generated **42 fewer false alarms** (237 vs. 279, a **15.1% reduction in false alarms**), dropped the clinic alert workload from 27.0% down to 23.4%, and protected 1 extra child (21 vs. 20 children).
   - **At $\ge 80\%$ Recall (catching 34 out of 42 faltering visits):** The 90/10 Hybrid generated **73 fewer false alarms** (345 vs. 418, a **17.5% reduction in false alarms**), dropped clinic workload by 6.4 percentage points (33.2% vs. 39.5%), and protected **23 out of 24 positive children (95.8% coverage)** compared to 21 out of 24 for XGBoost.
3. **Why Matched-Recall Comparison is Essential:** Because the hybrid's score distribution is shifted upward by the Transformer, comparing models at the same numerical threshold (like 0.50) is mathematically misleading. Comparing them at **matched clinical sensitivity (recall)** reveals the true operational workload benefit.

---

## 2. Overview of the Validation Detection Cohort

- **Total Observation Visits:** 1,143
- **Unique Children in Validation:** 75
- **Positive Growth Faltering Visits:** Exactly 42 events (3.67% prevalence)
- **Distinct Children with Positive Visits:** **24 unique children** (32.0% of cohort children had $\ge 1$ faltering encounter)
- **Negative Observation Visits:** Exactly 1,101 events (96.33%)

---

## 3. Illustrative Baseline: Operating Threshold 0.50

> [!WARNING]
> **Threshold 0.50 is NOT a Validated Clinical Threshold:**  
> Neither model was calibrated to use 0.50. It is reported here strictly as an illustrative reference point.

| Model Candidate | Operating Threshold ($\tau$) | TP | FP | FN | TN | Precision (PPV) | Recall (Sens.) | Specificity | F1-Score | Clinic Alert Rate | Positive Children Detected |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Standard XGBoost** | 0.5000 | 12 | 18 | 30 | 1,083 | 40.00% (12/30) | 28.57% (12/42) | 98.37% | 0.3333 | 2.62% (30 visits) | 12 / 24 children (50.0%) |
| **90/10 Hybrid** | 0.5000 | 13 | 19 | 29 | 1,082 | 40.62% (13/32) | 30.95% (13/42) | 98.27% | 0.3514 | 2.80% (32 visits) | 13 / 24 children (54.2%) |

---

## 4. Matched-Recall Clinical Operating Regimes

To evaluate true clinical utility, we swept the threshold for each model to identify the highest cutoff that achieves at least **50%**, **70%**, and **80%** validation recall:

### Target 1: Moderate Detection Policy (Recall $\ge 50\%$, $\ge 21/42$ events)
- **Standard XGBoost ($\tau = 0.1246$):** 21 TP, 45 FP, 21 FN, 1,056 TN | Prec: 31.82%, Spec: 95.91%, Alert Rate: 5.77% | **17 / 24 children (70.8%)**
- **90/10 Hybrid ($\tau = 0.1624$):** 21 TP, 47 FP, 21 FN, 1,054 TN | Prec: 30.88%, Spec: 95.73%, Alert Rate: 5.95% | **17 / 24 children (70.8%)**
- **Comparison:** At 50% sensitivity, performance is virtually identical. XGBoost has 2 fewer false alarms (45 vs. 47).

---

### Target 2: Balanced Screening Policy (Recall $\ge 70\%$, $\ge 30/42$ events)
- **Standard XGBoost ($\tau = 0.005452$):** 30 TP, 279 FP, 12 FN, 822 TN | Prec: 9.71%, Spec: 74.66%, Alert Rate: 27.03% | **20 / 24 children (83.3%)**
- **90/10 Hybrid ($\tau = 0.064055$):** 30 TP, 237 FP, 12 FN, 864 TN | Prec: 11.24%, Spec: 78.47%, Alert Rate: 23.36% | **21 / 24 children (87.5%)**
- **Workload & Accuracy Impact:**
  - The **Hybrid eliminates 42 false alarms** (237 vs. 279, a **15.1% reduction** in unnecessary alerts).
  - Clinic alert workload drops from 27.03% down to 23.36% of all visits.
  - Precision improves from 9.71% to 11.24%.
  - Detects **1 additional at-risk child** (21 vs. 20 children).

---

### Target 3: High-Sensitivity Screening Policy (Recall $\ge 80\%$, $\ge 34/42$ events)
- **Standard XGBoost ($\tau = 0.002553$):** 34 TP, 418 FP, 8 FN, 683 TN | Prec: 7.52%, Spec: 62.03%, Alert Rate: 39.55% | **21 / 24 children (87.5%)**
- **90/10 Hybrid ($\tau = 0.047440$):** 34 TP, 345 FP, 8 FN, 756 TN | Prec: 8.97%, Spec: 68.66%, Alert Rate: 33.16% | **23 / 24 children (95.8%)**
- **Workload & Accuracy Impact:**
  - The **Hybrid eliminates 73 false alarms** (345 vs. 418, a **17.5% reduction** in false alarms!).
  - Clinic alert workload drops by **6.39 percentage points** (33.16% vs. 39.55%).
  - Precision improves from 7.52% to 8.97%.
  - Child-level detection expands to **23 out of 24 positive children (95.83% coverage)**, missing only a single child across the entire validation cohort.

---

## 5. Comprehensive Operating Point Comparison Table

| Operating Regime | Model Candidate | Operating Threshold ($\tau$) | TP | FP | FN | TN | Precision | Recall | Specificity | Clinic Alert Rate | Positive Children Detected |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Illustrative (0.50)** | Standard XGBoost | 0.500000 | 12 | 18 | 30 | 1,083 | 40.00% | 28.57% | 98.37% | 2.62% | 12 / 24 (50.0%) |
| | **90/10 Hybrid** | 0.500000 | 13 | 19 | 29 | 1,082 | 40.62% | 30.95% | 98.27% | 2.80% | 13 / 24 (54.2%) |
| **Recall $\ge$ 50%** | Standard XGBoost | 0.124559 | 21 | 45 | 21 | 1,056 | 31.82% | 50.00% | 95.91% | 5.77% | 17 / 24 (70.8%) |
| | **90/10 Hybrid** | 0.162368 | 21 | 47 | 21 | 1,054 | 30.88% | 50.00% | 95.73% | 5.95% | 17 / 24 (70.8%) |
| **Recall $\ge$ 70%** | Standard XGBoost | 0.005452 | 30 | 279 | 12 | 822 | 9.71% | 71.43% | 74.66% | 27.03% | 20 / 24 (83.3%) |
| | **90/10 Hybrid** | 0.064055 | 30 | **237** | 12 | 864 | **11.24%** | 71.43% | **78.47%** | **23.36%** | **21 / 24 (87.5%)** |
| **Recall $\ge$ 80%** | Standard XGBoost | 0.002553 | 34 | 418 | 8 | 683 | 7.52% | 80.95% | 62.03% | 39.55% | 21 / 24 (87.5%) |
| | **90/10 Hybrid** | 0.047440 | 34 | **345** | 8 | 756 | **8.97%** | 80.95% | **68.66%** | **33.16%** | **23 / 24 (95.8%)** |

---

## 6. Critical Methodological & Clinical Guardrails

1. **Thresholds are Strictly Exploratory:**  
   All operating thresholds identified in this report were selected *post hoc* on validation data. **None of these thresholds are claimed to be clinically safe, optimal, or deployment-ready.** Threshold selection on validation data is subject to optimistic selection bias.
2. **Confirmatory Testing Still Required:**  
   Confirmatory validation must take place on the untouched held-out test split (`test.csv` / `test_v2.csv`) only after model selection and operating policies are permanently frozen.
3. **Preserved Dataset Limitations:**  
   - **46 Uncertain Negatives:** 46 validation encounters had no follow-up in $(0, 180]$ days and were defaulted to negative. While Task 3.5C proved that the hybrid advantage is robust to their exclusion, unmeasured loss to follow-up remains a real-world reality.
   - **Data Provenance:** The dataset mixes ~400 real clinic records with 100 synthetic profiles whose data generation parameters are undocumented.
   - **Small Number of Positive Events:** The validation set contains only 42 true faltering events across 24 children, meaning a shift of 1 or 2 events can visibly move percentages.

---

## 7. Generated Output Artifacts

All detection analysis artifacts have been written to `research/evaluation/hybrid_experiments/v1/`:

1. **Structured Numerical Results (JSON):**  
   [`research/evaluation/hybrid_experiments/v1/hybrid_validation_detection_results_v1.json`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/evaluation/hybrid_experiments/v1/hybrid_validation_detection_results_v1.json)
2. **Comprehensive Markdown Audit Report:**  
   [`research/evaluation/hybrid_experiments/v1/hybrid_validation_detection_report_v1.md`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/evaluation/hybrid_experiments/v1/hybrid_validation_detection_report_v1.md)
3. **Reproducible Analysis Script:**  
   [`research/scripts/run_hybrid_detection_analysis.py`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/scripts/run_hybrid_detection_analysis.py)

---

## 8. Final Task Verdict

# **OVERALL STATUS: PASS**

The clinical detection analysis was successfully executed. Operating points across illustrative (0.50) and matched-recall targets ($\ge 50\%$, $\ge 70\%$, $\ge 80\%$) were quantified. The 90/10 Hybrid was shown to provide **substantial false-alarm reductions (15% to 17.5% fewer false positives) and superior child-level coverage (up to 95.8%)** at high-sensitivity screening operating points.
