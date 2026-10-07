# WHO Feature Engineering Policy

## 1. Why WHO Standards are Used
The World Health Organization (WHO) Child Growth Standards (2006) provide the scientifically accepted benchmark for assessing child growth worldwide. Integrating these allows us to convert raw anthropometric measurements into standardized Z-scores, contextualizing the child's growth relative to a healthy global reference population.

## 2. Input Dataset
The cleaned dataset from Stage 2 (`data/interim/chdr_cleaned_v1.csv`) is used as the input. The raw data remains entirely preserved and untouched.

## 3. Official WHO Reference Files Used
We use the official LMS parameters from the WHO Excel files:
- **Weight-for-Age (WFA)**: `wfa_boys_0-to-5-years_zscores.xlsx`, `wfa_girls_0-to-5-years_zscores.xlsx`
- **Length/Height-for-Age (LHFA)**: `lhfa_boys_0-to-2-years_zscores.xlsx`, `lhfa_boys_2-to-5-years_zscores.xlsx`, `lhfa_girls_0-to-2-years_zscores.xlsx`, `lhfa_girls_2-to-5-years_zscores.xlsx`

## 4. LMS Method
Z-scores are calculated using the LMS method (Cole and Green, 1992), exactly as specified by the WHO:
- When L ≠ 0: Z = ((X / M)^L - 1) / (L * S)
- When L = 0: Z = ln(X / M) / S

## 5. Sex Normalization
The input `sex` column is safely mapped to the corresponding WHO reference files (e.g., "Male" -> male -> Boys reference). Invalid values result in missing features rather than incorrect assumptions.

## 6. Age Matching
Observations are matched to the exact WHO reference age in days using index mapping. Arbitrary monthly/nearest-age interpolation is strictly forbidden. The tables cover exactly 0-1856 days. 

## 7. WAZ Calculation
Calculates the `verified_waz` using valid age, sex, and weight parameters.

## 8. HAZ Calculation
Calculates the `verified_haz` using valid age, sex, and length/height parameters.

## 9. Missing-Height Policy
**CRITICAL**: If `length_height_cm` is missing, `verified_haz` is enforced as NULL. Missing heights are NEVER imputed (forward-filled, backward-filled, or interpolated).

## 10. Length-vs-Height Limitation
The WHO splits length (<2 years) and height (>=2 years). In accordance with exact WHO day-level tables, we enforce a strict transition: children aged 0-730 days map to the `0-to-2-years` length tables, and children 731-1856 days map to the `2-to-5-years` height tables.

## 11. Restricted Tail Handling (Extreme Z-scores)
Following official WHO guidelines for weight-based indicators (like WAZ), measurements that yield raw Z-scores beyond +/- 3 SD are adjusted using restricted tail calculations based on the SD distances between +/- 2 and 3 SD. This prevents exaggerated skewed deviations in extreme malnutrition or obesity cases. Height-based parameters (HAZ) are normally distributed and do not require this restriction.

## 11. No-Extrapolation Policy
Data points falling outside reference bounds are not extrapolated; their resulting Z-scores remain NaN.

## 12. Validation Checks
Rigorous sanity checks guarantee accuracy: when X matches M, Z ≈ 0. Z goes negative when X < M and positive when X > M.

## 13. Output Dataset
The processed data is saved to `data/processed/chdr_who_features_v1.csv`.

## 14. Known Dataset V1 Limitations
The current `Dataset V1` contains 100% height availability across visits, but the code architecture and missing-height policy strictly prepare for sparse real-world data collection in subsequent datasets. The calculated Z-scores are raw features, NOT clinical diagnoses.
