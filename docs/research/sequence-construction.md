# Longitudinal Sequence Construction (Stage 8)

## Overview
Classical machine learning models (Stage 7) treat each clinical visit as an independent observation. They cannot directly model the *trajectory* of a child's growth across visits — the slope, acceleration, or irregular gaps in measurements.

Sequence models (GRU, LSTM, Transformer) can learn directly from the temporal trajectory of a child's history up to each prediction point T. Stage 8 constructs the input tensors for these models.

## Index Row vs. Historical Observation

A critical distinction must be understood:

- **Index Row (T):** A single observation from `data/splits/v1/train.csv` (or val/test) that is eligible for a prediction. It defines:
  - The exact point in time T where the prediction is made.
  - The target label: `future_growth_faltering_180d` (whether faltering occurs within the next 180 days).
  
- **Historical Observation:** Any visit record for the **same child** with `visit_date <= T` from the **full** temporal feature dataset `data/features/chdr_temporal_features_v1.csv`.

> **Key principle:** A visit that was excluded from supervised eligibility (e.g., because of insufficient 180-day follow-up, or because WAZ was already below -2.0 at that time) may still be *used as historical context* when building sequences for later eligible visits of the same child.

## Full History Source
Sequence history is always derived from `data/features/chdr_temporal_features_v1.csv`, NOT from the split files.

This ensures the model sees the complete growth trajectory, not just the subset of visits that were eligible as prediction index points.

## Child-Level Partition Preservation

The Stage 6 child-level split (train/validation/test) is strictly preserved:

- A child assigned to **training** contributes their complete history only to training sequences.
- A child assigned to **validation** contributes history only to validation sequences.
- A child assigned to **test** contributes history only to test sequences.

**Zero child overlap is maintained.**

> For each prediction at time T, only observations at or before T are included in the sequence.

## Sequence Feature List

The sequence features are selected for their clinical interpretability, availability, and longitudinal relevance. Features are grouped into:

**Numeric (time-varying measurements):**
- `age_days`, `weight_kg`, `verified_waz`, `verified_haz`
- `observation_count`, `days_since_previous_visit`
- `weight_change_kg`, `weight_velocity_kg_per_day/30d`
- `waz_change`, `waz_velocity_per_day/30d`
- `waz_rolling_mean_3`, `weight_rolling_mean_3`
- Height-related: `last_observed_height_cm`, `last_observed_haz`, `days_since_last_height_measurement`, `height_change_cm`, `haz_change`, `height_velocity_cm_per_day/30d`, `haz_velocity_per_day/30d`
- Feeding/illness numeric: `breastfeeding_frequency_per_day`, `formula_feeds_per_day`, `meals_per_day`, `illness_duration_days`

**Boolean indicators:**
- `height_measurement_available`, `breastfeeding_status`, `formula_feeding`, `complementary_feeding_started`, `supplement_use`, `recent_illness`, `diarrhea_recent`, `fever_recent`, `respiratory_illness_recent`

**Categorical (encoded):**
- `supplement_type`, `food_groups_consumed`

**Explicitly excluded from sequences:**
- `child_id`, `visit_date`, `date_of_birth`
- `future_growth_faltering_180d`, `target_new_threshold_crossing_180d`, `target_waz_decline_05_180d` (target/audit — never in features)
- `sex`, `birth_weight_kg`, `birth_length_cm`, `gestational_age_weeks`, `birth_order`, `delivery_type`, `apgar_score_5min` (static birth variables — excluded from time-varying sequence; may be added as a static input branch in future multi-input architecture)

## Maximum Sequence Length Selection

Before choosing a fixed padding length, the distribution of historical observation counts was inspected across all supervised index rows. If the 95th percentile is ≤ 20, a `max_seq_len = 20` is used, which is well-supported by the data. Otherwise, the sequence length is set to `⌈p95⌉`.

## Left-Padding

To ensure the **most recent observation is always aligned at the last timestep** (position T), left-padding is applied:

```
PAD, PAD, ..., Visit_1, Visit_2, ..., Visit_N (= index T)
```

This is the standard convention for variable-length sequences in RNNs: the model reads history chronologically from left to right, with padding at the beginning. Masking prevents the model from attending to padding tokens.

## Masking

A boolean mask array is generated for each sequence:
- `mask[i] = True`: valid timestep (real observation)
- `mask[i] = False`: padding

The **mask value** used to fill padding rows in `X` is `MASK_VALUE = -999.0`, which is far outside any real normalized range and cannot be confused with a genuine zero.

## Sparse-Height Handling

Height measurements in the CHDR dataset are **sparsely recorded**. Never replace missing height values with synthetic measurements.

- When `height_measurement_available = 0`, all height-derived features (`last_observed_height_cm`, `haz_change`, etc.) remain `NaN` in the raw data.
- The preprocessing pipeline imputes these `NaN` values using the **train-set median** of those features.
- The `height_measurement_available` boolean indicator is preserved in the sequence so the model can learn to discount height features at timesteps where they were not measured.

## Train-Only Preprocessing

All preprocessing objects (imputers, scalers, OneHotEncoders) are fit exclusively on rows from the training children's history. Validation and test sequences are transformed using the train-fitted objects via `.transform()` only.

The preprocessor is saved to:  
`models/scalers/sequence_preprocessor_v1.joblib`

## Output Tensor Shapes

| Artifact | Shape | Description |
|----------|-------|-------------|
| `X_train.npy` | (5380, T, F) | Padded sequences |
| `y_train.npy` | (5380,) | Binary targets |
| `mask_train.npy` | (5380, T) | Valid timestep mask |
| `index_train.csv` | (5380, 4) | Audit: child_id, date, target, history_length |

*(Same structure for validation and test)*

## Leakage Prevention

For every sequence sample a hard check asserts:
- `max(history_visit_date) <= index_visit_date`
- All history rows belong to the same `child_id` as the index row

The script will raise a `ValueError` immediately if any violation is detected.
