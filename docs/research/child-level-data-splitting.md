# Child-Level Data Splitting Strategy (Stage 6)

## Overview
In longitudinal medical and demographic datasets, multiple observations (rows) often belong to the same entity (a child). When training machine learning models on such data, extreme care must be taken to prevent **data leakage**.

This document explains the rationale and methodology for the Stage 6 data splitting process.

## Why Row-Level Splitting is Invalid
If a standard random row-level split (e.g., `train_test_split` on the raw DataFrame) were used:
1. Observations from Child A might end up in both the Training set and the Test set.
2. The model could "memorize" child-specific static traits or sequences rather than learning generalizable temporal patterns.
3. The evaluation metrics on the Test set would be falsely inflated (over-optimistic) because the model has essentially seen the exact patient it is evaluating.

**Rule:** The split must be strictly at the `child_id` level. A child's entire history exists in exactly one partition.

## The 70/15/15 Design
The dataset is partitioned into three mutually exclusive sets:
- **Training (70%):** Used strictly for model fitting, feature selection, threshold optimization, and preprocessing fitting (e.g., scalers, encoders, SMOTE).
- **Validation (15%):** Used for hyperparameter tuning, early stopping, and model selection.
- **Test (15%):** The hold-out set. 

> **CRITICAL HOLD-OUT RULE:** The test partition must not be used for model selection, hyperparameter tuning, feature selection, threshold optimization, or preprocessing fitting. It is used *only once* at the very end to evaluate final generalization performance.

## Target Imbalance & Child-Level Stratification
The dataset contains a severe class imbalance (~4.20% positive observation prevalence). More importantly, only about 31% of children ever experience a positive event.

If we performed a purely random split of `child_ids`, we risk creating a validation or test set with zero positive events, making evaluation impossible.

**Solution:** 
1. We compute `child_has_positive_target` (a binary flag indicating if a child ever has a positive outcome).
2. We perform a **stratified split** on this child-level flag.
3. This ensures that the proportion of children with positive events remains consistent (~31%) across Train, Validation, and Test sets.

## Reproducibility
The split uses a fixed random seed (`42`). Furthermore, because row-order in the source CSV can occasionally shift depending on earlier database query engines, the splitting script derives unique `child_ids`, sorts them internally, and splits them deterministically. The resulting datasets are guaranteed chronologically sorted per child.

## Preprocessing Constraints
Any data transformations (like imputing missing values or standardizing numerical columns) must strictly follow the temporal boundaries of the splits:
- **FIT** the transformer on the **TRAIN** set only.
- **TRANSFORM** the Train, Validation, and Test sets using those fitted parameters. 
Never fit a preprocessing object on the Validation or Test sets, as this introduces subtle leakage of global dataset distributions.
