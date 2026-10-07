# Temporal Feature Engineering Policy

## 1. Purpose
This stage computes time-aware (temporal) sequence features for the child growth dataset. These features are strictly historical (past and current observations only), serving as valid, un-leaked inputs for future sequence-aware models.

## 2. Input and Output
- **Input**: `data/processed/chdr_who_features_v1.csv` (contains official WHO Z-scores).
- **Output**: `data/features/chdr_temporal_features_v1.csv`.
The pipeline preserves all original rows (9,325) and children (500).

## 3. Observation Metrics
- `observation_count`: Chronological rank of the visit for a specific child (starts at 1).
- `days_since_previous_visit`: Interval in days from the immediately prior visit.

## 4. Change and Velocity Features
- `weight_change_kg`, `waz_change`: Difference between the current and immediately prior measurement.
- `weight_velocity_kg_per_day`, `waz_velocity_per_day`: Change divided by `days_since_previous_visit`. Scaled equivalents for `_30d` are also generated.

## 5. Sparse Height Handling
The policy anticipates scenarios where height might not be measured at every visit.
- `height_measurement_available`: Boolean flag (1 if present, 0 if missing).
- **Missing heights remain strictly missing** in the `length_height_cm` and `verified_haz` columns. They are NEVER imputed or forward-filled.

## 6. Last-Observed Height Features
To allow models to reference historical height when current height is missing:
- `last_observed_height_cm` and `last_observed_haz` carry the most recent *actual* measurement available at or before the current visit.
- **This is NOT imputation**. It is a historical memory field explicitly designed for sparse data scenarios.

## 7. Height Velocity
Height and HAZ changes/velocities are computed *only* when a valid current measurement exists. If current height is missing, current height-velocity is `NaN`. The denominator for velocity is precisely `days_since_last_height_measurement`.

## 8. First-Observation Policy
For `observation_count == 1`, all historical change, velocity, and previous-interval features are firmly set to `NaN`. No artificial zero-histories are fabricated.

## 9. Irregular Visit Support
The velocities divide strictly by the actual `days_since_previous_visit`. Month-approximations are not used. Intervals of 0 days (duplicates) are gracefully handled to prevent division-by-zero errors.

## 10. Leakage Prevention
**CRITICAL**: Absolutely no future information is present. The `shift(-1)` or `lead()` functions are forbidden. Rolling averages (`waz_rolling_mean_3`, `weight_rolling_mean_3`) use trailing windows (`center=False`) strictly constrained within individual child trajectories. A strict test explicitly flags any column containing words like `future`, `target`, `next`, or `prediction`.

## 11. Known Limitation of Dataset V1
The current iteration (Dataset V1) has 100% height availability (no missing heights). However, this temporal architecture correctly models sparse logic, guaranteeing seamless integration when sparser real-world data is introduced.
