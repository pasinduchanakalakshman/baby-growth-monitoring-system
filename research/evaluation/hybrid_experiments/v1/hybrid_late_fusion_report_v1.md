# Task 3.5B: XGBoost + Transformer Late-Fusion Experiment Report

**Project:** Baby-growth-monitoring-system  
**Scope:** Controlled Late-Fusion Evaluation of Standard XGBoost and Clean Transformer  
**Date:** October 2026  
**Auditor / Data Scientist:** Antigravity AI  
**Status Verdict:** **PASS**  

---

## 1. Executive Summary & Beginner-Friendly Explanation

### What Was the Question?
In Task 3.5A, we confirmed that the validation predictions from our two best models—**Standard XGBoost** (our best classical tabular model) and **Clean Transformer** (our best deep sequence neural network)—match up with 100% precision on all 1,143 clinic visits.

In **Task 3.5B**, we performed the actual **Late-Fusion Experiment** to answer:
> *Does blending the prediction scores from XGBoost and the Transformer produce better discrimination (higher PR-AUC) than using XGBoost by itself?*

### What Formula Was Used?
We calculated a blended risk score for each clinic visit using a simple weighted combination:
$$\text{Fusion Score} = \alpha \cdot P_{\text{XGBoost}} + (1 - \alpha) \cdot P_{\text{Transformer}}$$
where $\alpha$ is the weight given to XGBoost, and $(1 - \alpha)$ is the weight given to the Transformer.

We evaluated **only** the 7 predefined candidate weights:
- $\alpha = 1.00$: XGBoost standalone (100% XGBoost, 0% Transformer)
- $\alpha = 0.90$: 90% XGBoost, 10% Transformer
- $\alpha = 0.80$: 80% XGBoost, 20% Transformer
- $\alpha = 0.70$: 70% XGBoost, 30% Transformer
- $\alpha = 0.60$: 60% XGBoost, 40% Transformer
- $\alpha = 0.50$: 50% XGBoost, 50% Transformer (simple equal-weight average)
- $\alpha = 0.00$: Transformer standalone (0% XGBoost, 100% Transformer)

### What Did We Find?
1. **The 90/10 Blend Performed Best:** Giving **90% weight to XGBoost and 10% weight to the Transformer ($\alpha = 0.90$)** yielded the highest validation PR-AUC of **0.309740**, a nominal gain of **+0.018805 (+1.88 percentage points)** over standalone XGBoost (0.290935).
2. **Equal-Weight Averaging Hurt Performance:** A naive 50/50 blend ($\alpha = 0.50$) actually **reduced** PR-AUC to **0.281087** (-0.98 percentage points lower than XGBoost alone). Giving too much weight to the Transformer polluted the ranking because the Transformer was trained with extreme class weighting and outputs systematically higher, less calibrated scores.
3. **Statistical Uncertainty (Bootstrap):** In a 2,000-iteration child-clustered bootstrap, the 95% confidence interval for the improvement of the 90/10 blend over XGBoost was **[-0.003754, +0.050754]**. Because the lower bound slightly dips below zero, and because this weight was selected as the best among candidates on this specific validation sample, this gain is **exploratory**, not an independently confirmed guarantee.

---

## 2. Experimental Results Summary

All models were evaluated across the 1,143 validation visits (75 children, 42 positive growth faltering events, 3.67% prevalence):

| Candidate Name | Weight ($\alpha_{\text{XGB}}$) | Weight ($1-\alpha_{\text{Trans}}$) | PR-AUC (Primary) | Delta vs. Standalone XGBoost | ROC-AUC | Brier Score | Score Mean $\pm$ Std |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Transformer Standalone** | 0.00 | 1.00 | 0.187861 | -0.103074 (-10.31%) | 0.807556 | 0.141081 | 0.2423 $\pm$ 0.2987 |
| **Equal-Weight Average** | 0.50 | 0.50 | 0.281087 | -0.009849 (-0.98%) | 0.829160 | 0.057875 | 0.1390 $\pm$ 0.1983 |
| **Hybrid Blend (60/40)** | 0.60 | 0.40 | 0.282783 | -0.008153 (-0.82%) | 0.829419 | 0.048608 | 0.1184 $\pm$ 0.1809 |
| **Hybrid Blend (70/30)** | 0.70 | 0.30 | 0.286371 | -0.004564 (-0.46%) | 0.830825 | 0.041801 | 0.0977 $\pm$ 0.1654 |
| **Hybrid Blend (80/20)** | 0.80 | 0.20 | 0.291938 | +0.001002 (+0.10%) | 0.835972 | 0.037451 | 0.0770 $\pm$ 0.1522 |
| **Hybrid Blend (90/10) [BEST]** | **0.90** | **0.10** | **0.309740** | **+0.018805 (+1.88%)** | **0.837442** | **0.035560** | 0.0564 $\pm$ 0.1432 |
| **Standard XGBoost [ANCHOR]** | **1.00** | **0.00** | **0.290935** | **0.000000 (Baseline)** | **0.822802** | **0.036127** | 0.0357 $\pm$ 0.1414 |

---

## 3. Statistical Uncertainty: Paired Child-Clustered Bootstrap

To evaluate whether the +0.0188 PR-AUC improvement of the 90/10 blend over standalone XGBoost is statistically reliable, we ran a **2,000-iteration paired child-clustered bootstrap**:
- Resampled entire children with replacement (75 clusters).
- Evaluated both the 90/10 hybrid and standalone XGBoost on the exact same resamples.

| Bootstrap Metric | Observed Value |
| :--- | :---: |
| **Valid Resamples** | 2,000 / 2,000 (0 degenerate samples) |
| **Point Estimate Delta PR-AUC** | **+0.018805** |
| **Bootstrap Mean Delta** | **+0.017546** |
| **Bootstrap Standard Error** | **0.014457** |
| **95% Clustered Confidence Interval** | **[-0.003754, +0.050754]** |
| **Empirical Probability $P(\text{Hybrid}_{0.90} > \text{XGBoost})$** | **91.95%** |
| **Spans Zero?** | **Yes (Lower bound is -0.0038)** |

### Scientific Interpretation:
In 91.95% of child-clustered bootstrap samples, the 90/10 hybrid outperformed standalone XGBoost. However, because the 95% confidence interval slightly crosses zero, and because $\alpha = 0.90$ was selected *post hoc* as the top performer among the 7 candidates on this specific validation cohort, **this improvement must be treated as exploratory**. It does not constitute independently confirmed proof of superiority.

---

## 4. Why Score Distributions and Calibration Differ Fundamentally

A critical finding of this experiment is why equal-weight fusion ($\alpha = 0.50$) failed while XGBoost-heavy fusion ($\alpha = 0.90$) succeeded:

1. **Massive Score Disparity:**
   - Standard XGBoost was trained unweighted, so its average prediction (0.0357) closely mirrors real population prevalence (3.67%).
   - Clean Transformer was trained with an intentional ~22:1 positive class weight penalty, forcing its average prediction up to 0.2423 (nearly 7 times population prevalence).
2. **Impact on Blending:**
   - In a 50/50 blend, the Transformer's numerical scale completely dominates the score magnitude, pulling low-risk children into high score brackets and generating excessive false positives.
   - In a 90/10 blend, XGBoost acts as the "calibration anchor," keeping the score scale grounded, while the 10% Transformer signal provides just enough sequence-attention refinement to break ties and elevate genuine faltering cases.
3. **Uncalibrated Risk Scores:**
   - **Blended scores are ordinal ranking scores, NOT calibrated clinical probabilities.**
   - A threshold of 0.50 is completely meaningless for these fused scores.
   - Any future deployment would require empirical validation threshold tuning or isotonic recalibration.

---

## 5. Study Limitations & Methodological Guardrails

1. **Exploratory Status:** Finding that $\alpha = 0.90$ was best on this validation split is hypothesis-generating. Testing multiple weights on the same validation data introduces selection optimization bias.
2. **Held-Out Test Split Untouched:** The final test set (`test_v2.csv` / `X_test.npy`) was **strictly untouched and unexamined**. Confirmatory evaluation can only happen when a final model architecture is permanently locked.
3. **Small Sample of Positive Cases:** The validation split contains only 42 true faltering events across 75 children, resulting in finite-sample variance.
4. **No Threshold Tuning Performed:** As required by the task protocol, no classification thresholds or operational decision points were tuned. Primary evaluation was strictly threshold-independent (PR-AUC).

---

## 6. Generated Output Artifacts

All experiment artifacts have been written to dedicated versioned directories:

1. **Aligned Predictions Dataset (CSV):**  
   [`research/evaluation/hybrid_experiments/v1/hybrid_validation_predictions_v1.csv`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/evaluation/hybrid_experiments/v1/hybrid_validation_predictions_v1.csv)  
   *(Contains child_id, visit_date, true_target, xgboost_probability, transformer_probability, and all 7 fusion scores)*
2. **Structured Numerical Results (JSON):**  
   [`research/evaluation/hybrid_experiments/v1/hybrid_late_fusion_results_v1.json`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/evaluation/hybrid_experiments/v1/hybrid_late_fusion_results_v1.json)
3. **Comprehensive Markdown Audit Report:**  
   [`research/evaluation/hybrid_experiments/v1/hybrid_late_fusion_report_v1.md`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/evaluation/hybrid_experiments/v1/hybrid_late_fusion_report_v1.md)
4. **Reproducible Experiment Script:**  
   [`research/scripts/run_hybrid_fusion_experiment.py`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/scripts/run_hybrid_fusion_experiment.py)

---

## 7. Final Task Verdict

# **OVERALL STATUS: PASS**

The controlled late-fusion experiment was executed with full mathematical rigor. Invariants were verified, all 7 predefined candidate weights were evaluated, the 90/10 blend was identified as the best observed candidate (+0.0188 PR-AUC), and child-clustered bootstrap uncertainty was fully documented.
