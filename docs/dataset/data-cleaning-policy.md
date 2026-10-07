# Data Cleaning Policy: Longitudinal CHDR Dataset

## 1. Purpose of Cleaning
This document describes the policies applied in Stage 2 to clean and validate the longitudinal dataset for the sequence-aware early prediction framework. The primary goal is logical consistency, structural missingness validation, and format normalization without altering the clinical truth of the data.

## 2. Raw Dataset Preservation Rule
The original raw dataset (`data/raw/chdr_dataset_v1.csv`) is treated as read-only. All cleaning transformations produce a new file (`data/interim/chdr_cleaned_v1.csv`).

## 3. Type Normalization
- **Strings/Categoricals**: Extraneous whitespace is stripped.
- **Booleans**: Normalized from strings (e.g., 'Yes', 'True', '1') into standard nullable boolean values. Unrecognized strings are left missing and reported.
- **Numerics**: Explicitly cast, with non-parsable values converted to null.

## 4. Date Handling
All date fields (`date_of_birth`, `visit_date`) are parsed into ISO-8601 date objects.

## 5. Age Recalculation
`age_days` is automatically verified and/or derived using `visit_date - date_of_birth`. Any contradictions with pre-provided `age_days` are logged. Negative ages or ages exceeding 1826 days (5 years) are flagged as invalid.

## 6. Static Child Consistency
Fields that represent biological or birth characteristics (`sex`, `date_of_birth`, `birth_weight_kg`, `birth_length_cm`, `gestational_age_weeks`, `birth_order`, `delivery_type`, `apgar_score_5min`) are checked across visits for each child. Inconsistencies are flagged in the report rather than silently resolved.

## 7. Longitudinal Ordering
The dataset is chronologically sorted by `child_id` and `visit_date` to ensure proper time-series sequences.

## 8. Structural vs Unexpected Missingness
Missingness is conditionally evaluated based on dependencies:
- **Complementary Feeding**: Missing start age is *expected* if feeding hasn't started, but *unexpected* if it has.
- **Supplements**: Missing type is *expected* if supplements aren't used, but *unexpected* if they are.
- **Illness**: Missing duration is *expected* if no recent illness occurred, but *unexpected* if it did.

## 9. Nullable Height Policy
To realistically reflect primary care data collection (where height/length is collected less frequently than weight), `length_height_cm` is strictly maintained as a nullable field. 

## 10. Anthropometric Validation
Numeric observations (weight, length) are validated to ensure they are strictly positive (>0). Values ≤ 0 are flagged. 

## 11. No-Imputation Policy
No missing values are imputed during Stage 2. We do NOT perform forward-fill, backward-fill, interpolation, or prediction for missing heights or missing categorical features. Missing values are preserved as null.

## 12. Leakage Prevention
The pipeline validates that no future prediction targets, model output scores, or generated prediction windows exist in the interim data to prevent data leakage.

## 13. Output Dataset
The resulting dataset is saved to `data/interim/chdr_cleaned_v1.csv` and is ready for Stage 3 WHO standards application and feature engineering.

## 14. Known Limitation of Development Dataset V1
While the current `Dataset V1` contains 100% height availability across visits, the final production CHDR dataset will likely contain sparse height measurements (e.g., measured every six months). The cleaning pipeline accommodates this by enforcing nullable heights and zero imputation rules.
