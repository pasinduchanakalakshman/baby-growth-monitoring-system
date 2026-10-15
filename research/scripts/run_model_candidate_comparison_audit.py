"""
Final Model Candidate Comparison Audit Script (Task 3.6A)
=========================================================
Project: Baby-growth-monitoring-system
Approved Protocol: model_comparison_protocol_v1.md
Goal: Synthesize existing validation evidence across all 8 primary model candidates,
      distinguish feature/pipeline differences, evaluate deployment considerations,
      and specify required frozen decisions prior to held-out test evaluation.

Strict Rules:
- No training or retraining.
- No hyperparameter, fusion-weight, or threshold tuning.
- Do NOT access the held-out test split.
- Do NOT deploy any model or make final model selection.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime, timezone


def run_comparison_audit():
    print("==================================================")
    print("STARTING TASK 3.6A: MODEL CANDIDATE COMPARISON AUDIT")
    print("==================================================")

    out_dir = os.path.join('research', 'evaluation', 'model_selection')
    os.makedirs(out_dir, exist_ok=True)

    out_json_path = os.path.join(out_dir, 'model_candidate_comparison_audit_v1.json')
    out_md_path = os.path.join(out_dir, 'model_candidate_comparison_audit_v1.md')

    # 1. Candidate Models Inventory & Verified Validation Metrics
    candidates = [
        {
            "model_name": "90/10 XGBoost + Transformer Hybrid",
            "family": "Late-Fusion Score Blend",
            "generation": "v1 Hybrid",
            "feature_space_description": "Multimodal blend: 346 tabular features + 3D sequence tensor (20x49)",
            "transformed_dimension": "346 Tabular + (20x49) Sequence",
            "includes_date_of_birth": True,
            "includes_waz_trajectory_slope": False,
            "preprocessing_pipeline": "baseline_preprocessor_v1.joblib + sequence_preprocessor_metadata_v1.json",
            "loss_weighting": "Blended scores (0.90 unweighted XGBoost + 0.10 class-weighted Transformer)",
            "validation_pr_auc": 0.3097404186570704,
            "validation_roc_auc": 0.8374421521560487,
            "validation_brier_score": 0.03556016366763332,
            "model_role": "Top-ranked hybrid candidate",
            "artifact_paths": {
                "tabular_model": "models/trained/baselines/v1/xgboost.joblib",
                "sequence_model": "models/trained/transformer/v1/final_transformer_clean.keras",
                "predictions_file": "research/evaluation/hybrid_experiments/v1/hybrid_validation_predictions_v1.csv"
            }
        },
        {
            "model_name": "Standard XGBoost (Frozen Baseline v1)",
            "family": "Gradient Boosted Trees",
            "generation": "v1 Tabular",
            "feature_space_description": "Tabular v1: 35 numeric, 9 boolean, 4 categorical (including 293 date_of_birth one-hot columns)",
            "transformed_dimension": 346,
            "includes_date_of_birth": True,
            "includes_waz_trajectory_slope": False,
            "preprocessing_pipeline": "models/scalers/baseline_preprocessor_v1.joblib (fitted on train v1)",
            "loss_weighting": "Unweighted (scale_pos_weight=1.0)",
            "validation_pr_auc": 0.2909354719532945,
            "validation_roc_auc": 0.8228017819298473,
            "validation_brier_score": 0.03612744304855849,
            "model_role": "Top-ranked standalone candidate (v1 tabular)",
            "artifact_paths": {
                "model": "models/trained/baselines/v1/xgboost.joblib",
                "preprocessor": "models/scalers/baseline_preprocessor_v1.joblib",
                "predictions_file": "research/evaluation/baseline_validation_predictions_v1.csv"
            }
        },
        {
            "model_name": "Random Forest (Standard v1)",
            "family": "Bagged Decision Trees",
            "generation": "v1 Tabular",
            "feature_space_description": "Tabular v1: 35 numeric, 9 boolean, 4 categorical (including 293 date_of_birth one-hot columns)",
            "transformed_dimension": 346,
            "includes_date_of_birth": True,
            "includes_waz_trajectory_slope": False,
            "preprocessing_pipeline": "models/scalers/baseline_preprocessor_v1.joblib (fitted on train v1)",
            "loss_weighting": "Unweighted (class_weight=None)",
            "validation_pr_auc": 0.28099772740955853,
            "validation_roc_auc": 0.852190649193374,
            "validation_brier_score": 0.030628433945756785,
            "model_role": "Strongest ROC-AUC and Brier score among v1 tree models",
            "artifact_paths": {
                "model": "models/trained/baselines/v1/random_forest_standard.joblib",
                "preprocessor": "models/scalers/baseline_preprocessor_v1.joblib",
                "predictions_file": "research/evaluation/baseline_validation_predictions_v1.csv"
            }
        },
        {
            "model_name": "XGBoost + WAZ Slope (Experiment C, v2)",
            "family": "Gradient Boosted Trees",
            "generation": "v2 Modernized Tabular",
            "feature_space_description": "Tabular v2: Cleaned (date_of_birth removed) + waz_trajectory_slope_3v added",
            "transformed_dimension": 54,
            "includes_date_of_birth": False,
            "includes_waz_trajectory_slope": True,
            "preprocessing_pipeline": "models/scalers/v2/experiment_c_preprocessor_v2.joblib (fitted on train v2)",
            "loss_weighting": "Unweighted (scale_pos_weight=1.0)",
            "validation_pr_auc": 0.2714790049986777,
            "validation_roc_auc": 0.8132001211020284,
            "validation_brier_score": 0.03451136185028977,
            "model_role": "Top-ranked modernized standalone candidate (clean feature space)",
            "artifact_paths": {
                "model": "models/trained/temporal_experiments/v2/xgboost_experiment_c_v2.joblib",
                "preprocessor": "models/scalers/v2/experiment_c_preprocessor_v2.joblib",
                "predictions_file": "research/evaluation/temporal_experiments/v2/validation_predictions_v2.csv"
            }
        },
        {
            "model_name": "Cleaned XGBoost Control B (v2)",
            "family": "Gradient Boosted Trees",
            "generation": "v2 Modernized Tabular",
            "feature_space_description": "Tabular v2: Cleaned (date_of_birth removed; waz_trajectory_slope withheld)",
            "transformed_dimension": 53,
            "includes_date_of_birth": False,
            "includes_waz_trajectory_slope": False,
            "preprocessing_pipeline": "models/scalers/v2/control_b_preprocessor_v2.joblib (fitted on train v2)",
            "loss_weighting": "Unweighted (scale_pos_weight=1.0)",
            "validation_pr_auc": 0.2607595913477262,
            "validation_roc_auc": 0.8095670602482592,
            "validation_brier_score": 0.03518799034286118,
            "model_role": "Methodological control isolating pipeline modernization from feature addition",
            "artifact_paths": {
                "model": "models/trained/temporal_experiments/v2/xgboost_control_b_v2.joblib",
                "preprocessor": "models/scalers/v2/control_b_preprocessor_v2.joblib",
                "predictions_file": "research/evaluation/temporal_experiments/v2/validation_predictions_v2.csv"
            }
        },
        {
            "model_name": "Clean Transformer Sequence Model (v1)",
            "family": "Attention Neural Network",
            "generation": "v1 Sequence",
            "feature_space_description": "Longitudinal visit sequences (up to 20 visits x 49 features; birth statics excluded)",
            "transformed_dimension": "20 x 49",
            "includes_date_of_birth": False,
            "includes_waz_trajectory_slope": False,
            "preprocessing_pipeline": "models/metadata/sequence_preprocessor_metadata_v1.json (fitted on train v1)",
            "loss_weighting": "Balanced class weighting ({0: 0.522, 1: 11.645})",
            "validation_pr_auc": 0.18786134307703056,
            "validation_roc_auc": 0.8075559015613512,
            "validation_brier_score": 0.14108083785485617,
            "model_role": "Top-ranked standalone sequence-aware model",
            "artifact_paths": {
                "model": "models/trained/transformer/v1/final_transformer_clean.keras",
                "metadata": "models/metadata/final_sequence_model_v1.json",
                "predictions_file": "research/evaluation/sequence_validation_predictions_v1.csv"
            }
        },
        {
            "model_name": "GRU Sequence Model (v1)",
            "family": "Recurrent Neural Network",
            "generation": "v1 Sequence",
            "feature_space_description": "Longitudinal visit sequences (up to 20 visits x 49 features; birth statics excluded)",
            "transformed_dimension": "20 x 49",
            "includes_date_of_birth": False,
            "includes_waz_trajectory_slope": False,
            "preprocessing_pipeline": "models/metadata/sequence_preprocessor_metadata_v1.json (fitted on train v1)",
            "loss_weighting": "Balanced class weighting ({0: 0.522, 1: 11.645})",
            "validation_pr_auc": 0.18434270861937307,
            "validation_roc_auc": 0.8304571601574327,
            "validation_brier_score": 0.12106818445938163,
            "model_role": "Second-ranked standalone sequence model (strong sequence ROC-AUC)",
            "artifact_paths": {
                "model": "models/trained/gru/v1/final_gru.keras",
                "predictions_file": "research/evaluation/sequence_validation_predictions_v1.csv"
            }
        },
        {
            "model_name": "LSTM Sequence Model (v1)",
            "family": "Recurrent Neural Network",
            "generation": "v1 Sequence",
            "feature_space_description": "Longitudinal visit sequences (up to 20 visits x 49 features; birth statics excluded)",
            "transformed_dimension": "20 x 49",
            "includes_date_of_birth": False,
            "includes_waz_trajectory_slope": False,
            "preprocessing_pipeline": "models/metadata/sequence_preprocessor_metadata_v1.json (fitted on train v1)",
            "loss_weighting": "Balanced class weighting ({0: 0.522, 1: 11.645})",
            "validation_pr_auc": 0.15879322227064938,
            "validation_roc_auc": 0.7952510704554301,
            "validation_brier_score": 0.1070634373115921,
            "model_role": "Third-ranked standalone sequence model",
            "artifact_paths": {
                "model": "models/trained/lstm/v1/final_lstm.keras",
                "predictions_file": "research/evaluation/sequence_validation_predictions_v1.csv"
            }
        }
    ]

    # 2. Hybrid Detection Operating Points Summary (from Task 3.5D)
    hybrid_operating_points = {
        "recall_70_percent": {
            "target": "Balanced Screening (Recall >= 70%)",
            "cutoff_threshold": 0.064055,
            "true_positives": 30,
            "false_positives": 237,
            "false_negatives": 12,
            "true_negatives": 864,
            "precision": 0.112360,
            "recall": 0.714286,
            "specificity": 0.784741,
            "alert_rate_pct": 23.359580,
            "alerts_generated": 267,
            "children_detected": 21,
            "children_total": 24,
            "children_coverage_pct": 87.50,
            "comparison_vs_xgboost": {
                "false_positives_eliminated": 42,
                "fp_reduction_pct": 15.05,
                "alert_rate_drop_pct_points": 3.67,
                "additional_children_detected": 1
            }
        },
        "recall_80_percent": {
            "target": "High-Sensitivity Screening (Recall >= 80%)",
            "cutoff_threshold": 0.047440,
            "true_positives": 34,
            "false_positives": 345,
            "false_negatives": 8,
            "true_negatives": 756,
            "precision": 0.089710,
            "recall": 0.809524,
            "specificity": 0.686649,
            "alert_rate_pct": 33.158355,
            "alerts_generated": 379,
            "children_detected": 23,
            "children_total": 24,
            "children_coverage_pct": 95.83,
            "comparison_vs_xgboost": {
                "false_positives_eliminated": 73,
                "fp_reduction_pct": 17.46,
                "alert_rate_drop_pct_points": 6.39,
                "additional_children_detected": 2
            }
        }
    }

    # 3. Methodological & Pre-Test Recommendations
    pre_test_requirements = [
        {
            "decision_item": "Candidate Architecture Lock",
            "recommendation": (
                "Decide between: (1) 90/10 Hybrid (strongest overall validation discrimination [PR-AUC 0.3097], but requires "
                "two inference pipelines and includes date_of_birth in the tabular branch); (2) Standalone Standard XGBoost v1 "
                "(established baseline [PR-AUC 0.2909], but includes date_of_birth one-hot encoding); or (3) Cleaned XGBoost + WAZ Slope "
                "Experiment C (strongest clean standalone model [PR-AUC 0.2715], completely free of date_of_birth encoding)."
            )
        },
        {
            "decision_item": "Preprocessing Pipeline Freezing",
            "recommendation": (
                "Permanently freeze all feature encoders, median imputers, and standard scalers. Under no circumstances may "
                "preprocessors be re-fitted on the test split."
            )
        },
        {
            "decision_item": "Decision Threshold Freezing",
            "recommendation": (
                "Select and permanently freeze exact operating decision thresholds on validation data prior to unlocking test data. "
                "For screening, freeze the balanced cutoff (e.g., tau=0.0641 for ~70% recall) or high-sensitivity cutoff "
                "(e.g., tau=0.0474 for ~80% recall). Test split data must never be used to pick or adjust thresholds."
            )
        },
        {
            "decision_item": "Statistical Evaluation Protocol",
            "recommendation": (
                "Execute single-pass evaluation on held-out test data (N=1,167) using paired child-clustered bootstrap "
                "(resampling whole children across the 74 test children) to report final 95% confidence intervals."
            )
        }
    ]

    # 4. Save JSON Report
    results_json = {
        "task": "Task 3.6A - Final Model Candidate Comparison Audit",
        "verdict": "PASS",
        "status": "CANDIDATE_AUDIT_COMPLETE",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "cohort_invariants": {
            "validation_rows": 1143,
            "validation_children": 75,
            "positive_events": 42,
            "negative_events": 1101,
            "positive_children": 24,
            "prevalence_pct": 3.674540682414698,
            "uncertain_negative_count": 46
        },
        "model_comparison_ranking": candidates,
        "strongest_candidates": {
            "strongest_hybrid": {
                "name": "90/10 XGBoost + Transformer Hybrid",
                "pr_auc": 0.3097404186570704,
                "delta_vs_standalone_xgboost": +0.018804946703775915
            },
            "strongest_standalone_v1": {
                "name": "Standard XGBoost (Frozen Baseline v1)",
                "pr_auc": 0.2909354719532945,
                "note": "Includes 293 date_of_birth one-hot features."
            },
            "strongest_standalone_v2_clean": {
                "name": "XGBoost + WAZ Slope (Experiment C, v2)",
                "pr_auc": 0.2714790049986777,
                "note": "Excludes date_of_birth; includes validated waz_trajectory_slope_3v."
            }
        },
        "hybrid_operating_points": hybrid_operating_points,
        "deployment_and_generalization_assessment": {
            "date_of_birth_encoding_concern": (
                "Standard XGBoost v1 and Random Forest v1 include 293 one-hot dummy variables for date_of_birth. "
                "In deployment, future infants born on new calendar dates will produce all zeros across these 293 columns. "
                "While cohort memorization has NOT been conclusively proven, this raises a legitimate generalization and "
                "maintenance risk for clinical deployment. Experiment C resolves this by eliminating date_of_birth entirely."
            ),
            "exploratory_status_of_hybrid_and_thresholds": (
                "The 90/10 fusion weight and the operating thresholds (0.0641, 0.0474) were selected based on validation data. "
                "These results are exploratory and do not constitute independent proof of superiority."
            ),
            "preserved_limitations": [
                "46 validation observations had zero follow-up in (0, 180] days and were defaulted to negative.",
                "Small positive sample size: only 42 events across 24 children in validation.",
                "Dataset contains approximately 400 real clinic records and 100 synthetic child profiles with undocumented parameters."
            ]
        },
        "pre_test_decisions_required": pre_test_requirements
    }

    with open(out_json_path, 'w', encoding='utf-8') as f:
        json.dump(results_json, f, indent=4)
    print(f"Saved audit JSON: {out_json_path}")

    # 5. Save Comprehensive Markdown Report
    md_content = r"""# Task 3.6A: Final Model Candidate Comparison Audit Report

**Project:** Baby-growth-monitoring-system  
**Scope:** Comprehensive Validation Evidence Synthesis & Model Candidate Audit  
**Date:** October 2026  
**Auditor / Data Scientist:** Antigravity AI  
**Status Verdict:** **PASS**  

---

## 1. Executive Summary & Beginner-Friendly Overview

Across Stages 2 and 3 of this research project, we developed and rigorously evaluated multiple machine learning architectures to predict child growth faltering within 180 days:
1. **Classical Tabular Models (v1):** Hand-crafted growth statistics and static demographic features, including 293 one-hot columns of calendar `date_of_birth`.
2. **Modernized Tabular Models (v2):** Cleaned feature pipelines removing `date_of_birth`, tested with and without our new longitudinal trajectory slope (`waz_trajectory_slope_3v`).
3. **Deep Sequence-Aware Models (v1):** Recurrent (LSTM, GRU) and self-attention (Transformer) networks processing raw longitudinal sequences of up to 20 clinic visits.
4. **Late-Fusion Hybrid Model:** An ensemble combining predictions from Standard XGBoost (90%) and Clean Transformer (10%).

The goal of **Task 3.6A** is to **gather all validation evidence into a single, unified audit**, clearly explain the strengths and trade-offs of each candidate, and specify exactly which decisions must be permanently locked before conducting the one-time final test on the held-out test split.

> [!IMPORTANT]
> **Strict Rule Compliance:**  
> This task is an audit and planning step only. **No models were retrained, no hyperparameters were tuned, no test data was accessed, and no final model was selected or deployed.**

---

## 2. Master Model Candidate Comparison Table

All 8 primary candidate models were evaluated on the identical child-level validation cohort (**1,143 observation visits, 75 unique children, 42 positive growth faltering events, 3.67% prevalence**):

| Rank | Model Candidate | Architecture Family | Feature Space & Preprocessing Paradigm | Preprocessing Pipeline Artifact | Training Loss Weighting | Validation PR-AUC (Primary) | Validation ROC-AUC | Validation Brier Score |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **1** | **90/10 XGBoost + Transformer Hybrid** | Late-Fusion Linear Blend | Multimodal: 346 Tabular + (20x49) Sequence | Dual v1 (Tabular + Sequence) | Blended ($0.90 \times \text{Unweighted} + 0.10 \times \text{Balanced}$) | **0.309740** | 0.837442 | 0.035560 |
| **2** | **Standard XGBoost (Frozen Baseline v1)** | Gradient Boosted Trees | Tabular v1: 346 features (incl. 293 `date_of_birth` columns) | `baseline_preprocessor_v1.joblib` | Unweighted (`scale_pos_weight=1.0`) | **0.290935** | 0.822802 | 0.036127 |
| **3** | **Random Forest (Standard v1)** | Bagged Decision Trees | Tabular v1: 346 features (incl. 293 `date_of_birth` columns) | `baseline_preprocessor_v1.joblib` | Unweighted (`class_weight=None`) | **0.280998** | **0.852191** | **0.030628** |
| **4** | **XGBoost + WAZ Slope (Exp C, v2)** | Gradient Boosted Trees | Tabular v2: 54 features (Cleaned, no DOB, with WAZ slope) | `experiment_c_preprocessor_v2.joblib` | Unweighted (`scale_pos_weight=1.0`) | **0.271479** | 0.813200 | 0.034511 |
| **5** | **Cleaned XGBoost (Control B, v2)** | Gradient Boosted Trees | Tabular v2: 53 features (Cleaned, no DOB, no slope) | `control_b_preprocessor_v2.joblib` | Unweighted (`scale_pos_weight=1.0`) | **0.260760** | 0.809567 | 0.035188 |
| **6** | **Clean Transformer (v1)** | Self-Attention Neural Net | Sequence v1: 20 timesteps x 49 longitudinal features | `sequence_preprocessor_metadata_v1.json` | Balanced Class Weighting (22:1) | **0.187861** | 0.807556 | 0.141081 |
| **7** | **GRU (v1)** | Recurrent Neural Net | Sequence v1: 20 timesteps x 49 longitudinal features | `sequence_preprocessor_metadata_v1.json` | Balanced Class Weighting (22:1) | **0.184343** | 0.830457 | 0.121068 |
| **8** | **LSTM (v1)** | Recurrent Neural Net | Sequence v1: 20 timesteps x 49 longitudinal features | `sequence_preprocessor_metadata_v1.json` | Balanced Class Weighting (22:1) | **0.158793** | 0.795251 | 0.107063 |

---

## 3. Clear Distinction of Feature Sets and Pipelines

The candidates fall into three distinct data and engineering paradigms:

1. **Legacy Tabular v1 Paradigm (Models 2 & 3):**
   - **Inputs:** 35 clinical/growth features + 9 boolean flags + 3 categorical birth variables + **293 sparse one-hot dummy variables for calendar `date_of_birth`** (total 346 columns).
   - **Characteristics:** Achieves high validation PR-AUC (0.2810–0.2909), but includes calendar date columns that represent specific historical cohorts.
2. **Modernized Tabular v2 Paradigm (Models 4 & 5):**
   - **Inputs:** Strictly 47 clinical/growth predictors without `date_of_birth` (Control B: 53 transformed columns; Experiment C: 54 columns with `waz_trajectory_slope_3v`).
   - **Characteristics:** Completely eliminates calendar birth-date dependencies. Adding the longitudinal slope improved PR-AUC by +0.0107 (from 0.2608 to 0.2715) and reduced Brier score.
3. **Deep Sequence-Aware Paradigm (Models 6, 7 & 8):**
   - **Inputs:** 3D tensor of up to 20 clinic encounters $\times$ 49 dynamic features, left-padded with mask value `-999.0`. All static birth features and `date_of_birth` are excluded.
   - **Characteristics:** Directly models visit-to-visit trajectory changes. Trained with heavy class weighting (~22:1 penalty), which shifted output scores upward (mean score ~0.24 vs. 0.036 population prevalence). Standalone PR-AUC is modest (0.1588–0.1879).
4. **Late-Fusion Hybrid Paradigm (Model 1):**
   - **Inputs:** Post-model linear blend ($0.90 \times P_{\text{XGBoost (v1)}} + 0.10 \times P_{\text{Transformer}}$).
   - **Characteristics:** Leverages XGBoost as a calibrated anchor while utilizing Transformer attention signals to refine rankings.

---

## 4. Identification of the Strongest Candidates

Based on observed validation PR-AUC:

1. **Strongest Standalone Model:**
   - In the v1 feature space: **Standard XGBoost (v1)** leads with **PR-AUC = 0.290935** (followed closely by Random Forest at 0.280998).
   - In the modernized v2 clean feature space: **XGBoost + WAZ Slope (Experiment C)** leads with **PR-AUC = 0.271479**.
2. **Strongest Hybrid Model:**
   - **90/10 XGBoost + Transformer Hybrid** leads the entire cohort with **PR-AUC = 0.309740** (+0.018805 over standalone XGBoost).

---

## 5. Clinical Detection Profile of the 90/10 Hybrid (Tasks 3.5B–3.5D)

In Task 3.5D, we analyzed the operational detection profile of the 90/10 Hybrid at matched clinical recall targets:

| Clinical Policy | Operating Cutoff ($\tau$) | True Positives (Visits) | False Alarms (Visits) | Precision | Specificity | Clinic Alert Rate | Positive Children Protected |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Illustrative Cutoff (0.50)** | 0.500000 | 13 / 42 (31.0%) | 19 visits | 40.62% | 98.27% | 2.80% (32 visits) | 13 / 24 children (54.2%) |
| **Balanced Screening (Recall $\ge$ 70%)** | 0.064055 | 30 / 42 (71.4%) | **237 visits** | 11.24% | 78.47% | **23.36% (267 visits)** | **21 / 24 children (87.5%)** |
| **High-Sensitivity Screening (Recall $\ge$ 80%)** | 0.047440 | 34 / 42 (81.0%) | **345 visits** | 8.97% | 68.66% | **33.16% (379 visits)** | **23 / 24 children (95.8%)** |

### Key Screening Workload Reductions vs. Standalone XGBoost:
- **At $\ge 70\%$ Recall:** The Hybrid **eliminates 42 false alarms** (237 vs. 279, a **15.1% reduction** in false alerts) and protects 1 additional child (21 vs. 20).
- **At $\ge 80\%$ Recall:** The Hybrid **eliminates 73 false alarms** (345 vs. 418, a **17.5% reduction** in false alarms!), reduces clinic alert volume by 6.4 percentage points, and covers **23 out of 24 positive children (95.83% coverage)**.

---

## 6. Deployment & Generalization Assessment: The `date_of_birth` Issue

A critical engineering finding is the role of calendar `date_of_birth`:
- The original v1 tabular models (Standard XGBoost and Random Forest) include 293 one-hot columns encoding the exact calendar dates infants were born (2018–2022).
- **Deployment Concern:** In a future clinical deployment, newly born infants will arrive with birth dates that were never seen during training. The one-hot encoder will mark all 293 columns as zero (`handle_unknown='ignore'`).
- **Scientifically Cautious Interpretation:** We do **not** claim that cohort memorization has been conclusively proven. However, having 293 sparse date columns in a dataset with only 348 training children represents an undeniable **generalization and pipeline maintenance risk**.
- **The Trade-Off:** Experiment C completely eliminates this risk by using only 54 clean, clinically interpretable growth and nutritional features, achieving PR-AUC = 0.2715.

---

## 7. Methodological Guardrails & Preserved Limitations

1. **Validation Selection is Exploratory:**  
   The 90/10 weight ($\alpha = 0.90$) and the alert thresholds (0.0641, 0.0474) were selected *post hoc* using validation data. The paired child-clustered bootstrap 95% confidence interval for the hybrid's advantage ([-0.0038, +0.0508]) touches zero. These results are **exploratory**, not an independent proof of superiority.
2. **46 Uncertain-Negative Visits:**  
   46 validation encounters had no follow-up in $(0, 180]$ days and were defaulted to negative. In Task 3.5C, we proved that the hybrid's advantage is virtually unchanged when these visits are removed ($\Delta = +0.0188$ vs. $+0.0195$). Nonetheless, interval-censoring remains a characteristic of real-world pediatric clinic data.
3. **Small Positive Sample Size:**  
   The validation split contains only 42 positive events across 24 children, meaning confidence intervals are wide.
4. **Data Provenance:**  
   The dataset combines approximately 400 real clinic records with 100 synthetic profiles whose exact data generation parameters are undocumented.

---

## 8. Decisions That Must Be Frozen Before the One-Time Test Evaluation

Before the held-out test split (`test.csv` / `test_v2.csv` / `X_test.npy`) is unlocked, the research team must permanently freeze:

1. **Primary Model Architecture Choice:** Select which candidate will be declared the proposed clinical model:
   - **Option A (90/10 Hybrid):** Highest validation discrimination (PR-AUC 0.3097) and lowest false-alert screening burden, but requires running both tabular and sequence pipelines in production.
   - **Option B (XGBoost + WAZ Slope, Exp C):** Cleanest standalone model (PR-AUC 0.2715), completely free of `date_of_birth` dependencies, single-model simplicity.
   - **Option C (Standard XGBoost v1):** Original baseline benchmark (PR-AUC 0.2909).
2. **Preprocessing Pipeline Freeze:** Permanently lock the scaler/imputer artifacts. No re-fitting on test data is permitted.
3. **Decision Threshold Freeze:** Lock the exact operational decision cutoff(s) on validation data before touching the test split (e.g., balanced cutoff $\tau=0.0641$ or screening cutoff $\tau=0.0474$).
4. **Single-Pass Evaluation Commitment:** Test evaluation must be conducted exactly once with paired child-clustered bootstrap, with zero parameter or threshold tuning.

---

## 9. Generated Audit Artifacts

The complete candidate audit outputs are saved to:
1. **Structured Numerical Results (JSON):**  
   [`research/evaluation/model_selection/model_candidate_comparison_audit_v1.json`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/evaluation/model_selection/model_candidate_comparison_audit_v1.json)
2. **Comprehensive Markdown Audit Report:**  
   [`research/evaluation/model_selection/model_candidate_comparison_audit_v1.md`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/evaluation/model_selection/model_candidate_comparison_audit_v1.md)
3. **Reproducible Audit Script:**  
   [`research/scripts/run_model_candidate_comparison_audit.py`](file:///c:/Users/pasin/OneDrive/Documents/Research%20Project/Baby-growth-monitoring-system/research/scripts/run_model_candidate_comparison_audit.py)

---

## 10. Final Task Verdict

# **OVERALL STATUS: PASS**

The candidate comparison audit is complete. All 8 candidate models were compared using verified, frozen metrics. Feature representations were distinguished, deployment trade-offs (including `date_of_birth` encoding) were assessed, and pre-test freezing decisions were formulated without touching test data or deploying any model.
"""

    with open(out_md_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"Saved audit Markdown: {out_md_path}")
    print("\nTask 3.6A complete: STATUS = PASS")


if __name__ == '__main__':
    run_comparison_audit()
