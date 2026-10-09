# Stage 16F Evaluation Report: Risk, Dynamic Risk, and XAI UI

## 1. Purpose
Evaluate the successful integration of the 180-Day Early Growth-Faltering Risk models into the mother-facing production frontend, encompassing latest risk, dynamic risk trajectory, and explainable AI (XAI) features.

## 2. Backend Risk Contract
The frontend accurately conforms to the backend contracts of `GET /growth/risk/latest`, `GET /growth/risk/trajectory`, and `GET /growth/risk/explanation`.

## 3. Primary XGBoost Verification
The frontend relies strictly on the `XGBoost v1` primary frozen model exposed via the backend endpoints. No client-side recalculations or model substitutions were made.

## 4. 180-Day Target Definition
The backend enforces the 180-day growth-faltering horizon and eligibility (WAZ >= -2 at index). The UI correctly displays "180 days" as defined by `prediction_horizon_days`.

## 5. Latest Risk UI
The `RiskLatestPage` provides a clean dashboard showing the latest probability, assessment date, risk category (Standard vs. Elevated based on model threshold), and Model Info details.

## 6. Dynamic Risk Trajectory
The `RiskHistoryPage` visualizes the historical probability progression of risk evaluations across genuine recorded visits.

## 7. Genuine-Visit Preservation
No daily interpolation, synthetic points, or fabricated assessments are plotted. Every point on the risk trajectory chart is directly tied to a genuine measurement visit.

## 8. Explainable AI
The `RiskExplanationPage` renders SHAP values derived by the backend's `TreeExplainer`, categorizing features into factors that increased or reduced the predicted risk.

## 9. SHAP Interpretation
Magnitudes and directions are precisely matched to the backend's technical output without arbitrary UI manipulation.

## 10. Non-Causal Wording
Strict rules against causal language are enforced. Feature influences are described as having "influenced the model-predicted risk", rather than "caused clinical malnutrition".

## 11. Forecast/Risk Separation
Forecast output endpoints remain fully uncoupled from the Risk endpoints. Forecast inputs are not evaluated or visualized on the Risk pages.

## 12. Missing-Data Handling
If insufficient records are available or the model is not applicable (e.g. initial WAZ < -2), the Risk UI components gracefully display a safe fallback (e.g., "Risk assessment is not available for the current record.").

## 13. Responsive UX
The UI integrates natively into the `AppShell`, functioning robustly across Mobile, Tablet, and Desktop resolutions without relying on fixed device frames.

## 14. Frontend Tests
Comprehensive Vitest coverage for `RiskLatestPage`, `RiskHistoryPage`, and `RiskExplanationPage` was added and successfully passed, asserting non-causal language and correct state displays.

## 15. Gateway/Backend Regression
Passed natively. No existing backend functionalities regressed.

## 16. Research Regression
Research regressions remain compliant and unaffected by presentation changes.

## 17. Frozen-Artifact Verification
`stage12_freeze_research_core.py` successfully verified that the research core SHAP and XGBoost assets remain securely hashed and unmodified.

## 18. Known Sklearn Warning
The discrepancy between the training scikit-learn version (1.7.2) and the deployment runtime (1.9.1) produces a safe `UserWarning` during initial deserialization, which does not impact the scientific accuracy of the frozen binary artifact operations.

## 19. Limitations
- Visualizations are limited to simple categorical bars and lines.
- Only the top +/- 3 influencing factors are displayed to avoid overwhelming non-technical users.

## 20. Readiness for Stage 16G
With the successful UI integration of predictive models (Risk, Forecast, History), the system is poised for **Stage 16G**: Full Growth Module Integration and End-to-End User Flow.
