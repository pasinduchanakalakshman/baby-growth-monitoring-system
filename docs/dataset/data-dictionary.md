# Data Dictionary: CHDR Dataset v1

This document describes the columns available in the raw CHDR dataset (`data/raw/chdr_dataset_v1.csv`).

| Column Name | Meaning | Raw/Derived | Expected Datatype | Required/Optional | May Be Missing? | Candidate Model Feature? |
|-------------|---------|-------------|-------------------|-------------------|-----------------|--------------------------|
| `child_id` | Unique identifier for each child | Raw | String/Integer | Required | No | No (Identifier) |
| `sex` | Biological sex of the child | Raw | String/Categorical | Required | No | Yes |
| `date_of_birth` | Child's date of birth | Raw | Date (YYYY-MM-DD) | Required | No | No (Use age) |
| `birth_weight_kg` | Child's weight at birth in kg | Raw | Float | Required | Rare | Yes |
| `birth_length_cm` | Child's length at birth in cm | Raw | Float | Optional | Yes | Yes |
| `gestational_age_weeks` | Weeks of gestation at birth | Raw | Integer/Float | Optional | Yes | Yes |
| `birth_order` | Child's order of birth in the family | Raw | Integer | Optional | Yes | Yes |
| `delivery_type` | Mode of delivery (e.g., normal, c-section) | Raw | Categorical | Optional | Yes | Yes |
| `apgar_score_5min` | APGAR score at 5 minutes | Raw | Integer | Optional | Yes | Yes |
| `visit_date` | Date of the current clinic visit | Raw | Date (YYYY-MM-DD) | Required | No | No (Temporal marker) |
| `age_days` | Age of child in days at visit | Derived | Integer | Required | No | Yes |
| `weight_kg` | Child's weight at visit in kg | Raw | Float | Required | No (Core metric) | Yes |
| `length_height_cm` | Child's length/height at visit in cm | Raw | Float | Optional | Yes (Nullable) | Yes |
| `breastfeeding_status` | Current breastfeeding status | Raw | Categorical | Optional | Yes | Yes |
| `breastfeeding_frequency_per_day` | Number of breastfeeds per day | Raw | Integer | Optional | Yes | Yes |
| `formula_feeding` | Whether child receives formula | Raw | Categorical | Optional | Yes | Yes |
| `formula_feeds_per_day` | Number of formula feeds per day | Raw | Integer | Optional | Yes | Yes |
| `complementary_feeding_started` | Has complementary feeding begun? | Raw | Categorical/Boolean | Optional | Yes | Yes |
| `complementary_feeding_start_age_months` | Age when complementary feeding started | Raw | Float | Optional | Yes | Yes |
| `meals_per_day` | Number of meals per day | Raw | Integer | Optional | Yes | Yes |
| `food_groups_consumed` | Number of food groups consumed | Raw | Integer | Optional | Yes | Yes |
| `supplement_use` | Is the child taking supplements? | Raw | Categorical/Boolean | Optional | Yes | Yes |
| `supplement_type` | Type of supplement taken | Raw | Categorical | Optional | Yes | Yes |
| `recent_illness` | Any recent illness in past 2 weeks | Raw | Categorical/Boolean | Optional | Yes | Yes |
| `diarrhea_recent` | Diarrhea episode in past 2 weeks | Raw | Categorical/Boolean | Optional | Yes | Yes |
| `fever_recent` | Fever episode in past 2 weeks | Raw | Categorical/Boolean | Optional | Yes | Yes |
| `respiratory_illness_recent` | Respiratory illness in past 2 weeks | Raw | Categorical/Boolean | Optional | Yes | Yes |
| `illness_duration_days` | Duration of the recent illness | Raw | Integer | Optional | Yes | Yes |
