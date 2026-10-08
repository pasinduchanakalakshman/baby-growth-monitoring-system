# Explainable AI (XAI) Strategy

## 1. Why XAI is Required
Predictive models in healthcare must be interpretable to establish trust, debug model behavior, and support clinical insights. The XAI module provides transparency into how the frozen models (XGBoost and Transformer) arrive at their predictions.

## 2. Primary XGBoost Explanation Method
The primary risk model (XGBoost) is explained using **SHAP (SHapley Additive exPlanations)**. Specifically, `shap.TreeExplainer` is used because it provides exact, efficient calculation of Shapley values for tree-based models.

## 3. SHAP Concept
SHAP values allocate the difference between the model's expected output (base value) and the actual prediction across all input features. 
- **Additivity**: `Base Value + Sum(SHAP Values) = Prediction (in log-odds space)`
- Explanations are provided in the raw margin (log-odds) space, which mathematically translates to the final probability.

## 4. Local Explanations
For any single prediction, the model identifies:
- **Positive Contributors**: Features pushing the risk probability upward.
- **Negative Contributors**: Features pushing the risk probability downward.
These are reported to provide individual-level context to a prediction.

## 5. Global Explanations
By aggregating local SHAP values across a large dataset (e.g., the training set), we determine the global feature importance. This reveals which variables (e.g., recent WAZ decline, lower current WAZ) most strongly influence the model on average.

## 6. One-Hot Aggregation
Because categorical variables are one-hot encoded during preprocessing, their SHAP values are distributed across multiple dummy variables (e.g., `sex_Male`, `sex_Female`). The global importance is computed at both the transformed level and the aggregated original-variable level by summing the absolute SHAP contributions of all related dummy columns.

## 7. Dynamic-Risk Explanation
For children with multiple chronological visits, the dynamic-risk module calculates risk at each step. XAI is applied to consecutive visits to observe how the top contributors change when the model's predicted risk shifts (e.g., a sudden flag being driven by a sharp drop in weight velocity).

## 8. Transformer Temporal Attribution
The sequence-aware research model (Transformer) is explained using **Integrated Gradients**. This gradient-based method attributes the model's prediction back to specific historical timesteps and features across the longitudinal sequence.

## 9. Why Attention Alone is Not Treated as Explanation
Transformer attention weights indicate where the model is "looking," but they do not directly equate to feature importance or prediction contribution. Integrated Gradients provides a more rigorous, mathematically grounded attribution of feature influence on the final output.

## 10. Padding and Masking
Historical sequences are often padded to a maximum length (e.g., 20 visits). The temporal XAI implementation guarantees that **padded timesteps receive exactly zero attribution**. Padded data does not represent historical visits and must not influence the explanation.

## 11. Association vs. Causality
> **SHAP and temporal attribution identify factors that influence the model's prediction. They do not establish clinical causality.**
If "recent illness" strongly increases the model's risk score, we can say "This feature increased the model's predicted risk," but we MUST NOT say "This illness caused growth faltering." XAI explains the *model*, not the biology.

## 12. Limitations
- SHAP values explain the model's learned associations, which may include confounding biases present in the training data.
- Feature correlations can distribute SHAP importance across related features, making interpretation complex.
- Integrated gradients can be computationally expensive and rely on a chosen baseline (typically zero/mean for scaled features).

## 13. Need for Expert Validation
Ultimately, the clinical usefulness of these explanations requires evaluation by healthcare professionals to ensure the model's reasoning aligns with domain knowledge and highlights actionable risks.
