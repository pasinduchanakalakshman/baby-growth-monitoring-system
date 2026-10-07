# Classical Baseline Modelling (Stage 7)

## Overview
Before implementing complex sequence models (like GRUs or Transformers), it is absolutely vital to establish rigorous classical machine learning baselines. These baselines act as the "skill floor." If a deep learning model cannot significantly outperform a carefully tuned Logistic Regression or Random Forest, the added complexity of the sequence model is unjustified.

## Training, Validation, and Test Roles
This stage strictly adheres to the data boundaries established in Stage 6:

1. **Training Set (70%):**
   - Fits the preprocessing pipelines (e.g., imputers, scalers, OneHotEncoders).
   - Fits the parameters of the baseline models.
   
2. **Validation Set (15%):**
   - Transforms data using exclusively the TRAIN-fitted preprocessors.
   - Used to generate out-of-sample probability predictions for all baseline models.
   - Evaluates models using metrics like PR-AUC and ROC-AUC.
   - **Crucially:** Model selection (choosing the "best" baseline) is done entirely on this set.

3. **Held-out Test Set (15%):**
   - The final, uncorrupted benchmark.
   - Evaluated exactly *once* using only the single best baseline model.
   - > **CRITICAL RULE:** The held-out test partition was not used for model selection, preprocessing fitting, threshold selection, or hyperparameter tuning.

## Preprocessing Strategy
To avoid data leakage, `scikit-learn` `Pipeline` and `ColumnTransformer` objects were used.

- **Numeric Features:** Imputed using the median (fitted on Train) and standardized using `StandardScaler`. This is safe for linear models and robust to outliers.
- **Categorical Features:** Imputed using a constant 'missing' string and encoded using `OneHotEncoder(handle_unknown='ignore')`. This prevents the pipeline from crashing if a rare category appears in the Validation/Test set that was not seen in Training.
- **Boolean Features:** Imputed with `0` and standardized.

## Class Imbalance
The target (`future_growth_faltering_180d`) is highly imbalanced (~4.2% positive). Instead of synthetically altering the dataset at this baseline stage (e.g., using SMOTE, which can complicate probability calibration), imbalance is handled using algorithm-native mechanisms:
- `class_weight='balanced'` in Logistic Regression and Random Forest.
- `scale_pos_weight` in XGBoost.

## Models Evaluated
1. **DummyClassifier (Prior Strategy):** Acts as the absolute no-skill baseline, predicting probabilities based solely on the class distribution of the training set.
2. **Logistic Regression (Standard & Balanced):** Establishes linear separability.
3. **Random Forest (Standard & Balanced):** Establishes non-linear boundary capabilities and handles local interactions.
4. **XGBoost (Standard & Balanced):** State-of-the-art tree-boosting.

## Validation Metrics & Model Selection
Due to the low positive class prevalence, **Accuracy** and **ROC-AUC** can be heavily misleading (they can score > 95% while missing almost all true positive cases).

Therefore, **PR-AUC (Precision-Recall Area Under Curve)** is the primary optimization metric. It correctly penalizes false positives and rewards true positives in a highly imbalanced context.

## Limitations
Classical ML models generally treat each temporal visit as an independent observation (I.I.D. assumption), ignoring the rich sequence of previous visits for a child. While some rolling-window features were generated in Stage 4, these baselines lack the inherent temporal memory that RNNs or LSTMs possess. Thus, they represent a strong lower bound for what the subsequent deep learning models must beat.
