# Sequence-Aware Model Comparison (Stage 9)

## Overview
This stage evaluates whether explicitly modeling the temporal trajectory of a child's clinical visits improves the prediction of early growth faltering compared to the best classical machine learning baseline (XGBoost from Stage 7).

We train and evaluate three sequence-aware architectures:
1. **LSTM (Long Short-Term Memory):** Excellent at capturing long-term dependencies in time series data.
2. **GRU (Gated Recurrent Unit):** A streamlined alternative to LSTM that is often faster to train and less prone to overfitting on smaller datasets.
3. **Lightweight Transformer:** Uses self-attention mechanisms to weigh the importance of different timesteps. We specifically designed a lightweight version (small embed dimension and few heads) to prevent overfitting given the dataset size.

## Class Imbalance Handling
The training dataset exhibits severe class imbalance (231 positives out of 5380 samples, ~4.3% prevalence). 
To address this:
- **Class Weights:** Class weights were calculated using the `balanced` strategy on the **TRAIN** split exclusively. These weights scale the loss function to penalize misclassifying the minority class more heavily.
- The same class weights were applied consistently across all three sequence models to ensure a fair comparison.
- We deliberately avoided using SMOTE (Synthetic Minority Over-sampling Technique) on sequence tensors due to the complexity and risks of interpolating high-dimensional padded temporal data.

## Common Training Policy
To ensure fair comparison, all models shared the following hyperparameters and procedures:
- **Optimizer:** Adam (learning_rate = 0.001)
- **Loss Function:** Binary Crossentropy
- **Batch Size:** 32
- **Max Epochs:** 100
- **Early Stopping:** `monitor="val_loss"`, `patience=10`, `restore_best_weights=True`
- **Learning Rate Reduction:** `ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5)`

## Sequence and Attention Masking
Because sequences vary in length, they were left-padded up to a maximum length of 20 using a `MASK_VALUE` of `-999.0`.
- **RNNs (LSTM/GRU):** Keras `Masking` layers automatically propagate the mask to skip padded timesteps.
- **Transformer:** We explicitly derived an attention mask from the inputs (`inputs != MASK_VALUE`) and passed it to the `MultiHeadAttention` layer to ensure padded timesteps received zero attention weight. A masked global average pooling layer was used before the final classification layers to ensure pooling only considered valid timesteps.

## Validation-Based Model Selection
Model selection was performed **strictly using the Validation set**.
- The primary metric for selection was **PR-AUC (Precision-Recall Area Under Curve)**, as it is far more sensitive to minority class performance than ROC-AUC in highly imbalanced datasets.
- The Test set remained entirely untouched during architecture tuning, epoch selection, class-weight calculation, and probability threshold analysis.

The explicit instruction: 
> "The held-out test partition was not used for architecture selection, hyperparameter tuning, class-weight selection, threshold selection, or early stopping."
was strictly followed.

## Comparison with XGBoost
Once the best sequence model was selected using the Validation set, it was evaluated **once** on the held-out Test set.
This test performance was then directly compared to the test performance of the frozen Stage 7 XGBoost baseline.

> "Sequence-aware models were not assumed to outperform classical baselines; comparative performance was determined empirically."

## Limitations
- **Dataset Size:** With only 231 positive training cases, extremely deep or complex sequence models may overfit, favoring simpler models or classical tree-based models like XGBoost that handle tabular features extremely efficiently.
- **Irregular Time Steps:** Currently, time is implicitly modeled through features like `days_since_previous_visit` and `age_days`. The sequence models treat each visit as a discrete step, relying on these features to understand temporal gaps, which is standard but could be extended to continuous-time models.
