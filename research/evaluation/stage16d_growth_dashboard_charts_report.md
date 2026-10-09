# Stage 16D Evaluation Report: Growth Dashboard + WHO Charts

## 1. Purpose
The purpose of Stage 16D is to implement the Growth Dashboard (`/growth`) and Detailed Growth Charts (`/growth/charts`) interfaces for the mother. This stage emphasizes scientific integrity by ensuring the frontend remains strictly a presentation layer. It visualizes authenticated, actual longitudinal backend data alongside strict WHO reference thresholds without inventing or interpolating values.

## 2. Backend Contract Inspection
Inspection of `services/child-growth-monitoring-service/app/api/routes/growth.py` verified that:
- `GET /api/v1/growth/overview` provides the latest genuine visit's `weight_kg`, `length_height_cm`, `waz`, and `haz`.
- `GET /api/v1/growth/history` provides chronological measurements.
- Forecasting and Risk endpoints are strictly separated.

## 3. Current Growth Overview
The `/growth` page acts as the main dashboard. It aggregates the baby profile, the single latest measurement, the WHO Z-Score cards, and a compressed view of the longitudinal charts. When no data exists, a prominent "Add First Measurement" CTA is displayed.

## 4. WHO Growth Indicators
The dashboard handles `verified_waz` and `verified_haz`. The `getWhoStatusFromZScore` utility ensures mothers are presented with readable string classifications based on WHO Z-score thresholds (`z >= -2`, `-3 <= z < -2`, `z < -3`) rather than medical diagnoses.

## 5. WAZ Handling
Weight-for-Age Z-Score (WAZ) is securely retrieved from the backend API. No mathematical logic exists in the frontend to compute WAZ or derive WHO LMS values.

## 6. HAZ Handling
Length/Height-for-Age Z-Score (HAZ) is rendered only when valid in the API response. The frontend handles cases gracefully when HAZ is `null`.

## 7. Missing Measurements
Missing length/height observations properly display "Not recorded" instead of rendering `0` or interpolating previous heights.

## 8. Longitudinal Charts
Built using `recharts`, four separate views exist:
- **Weight (kg)**
- **Length / Height (cm)**
- **WAZ**
- **HAZ**
All observations are strictly rendered from API chronologically. `connectNulls={false}` prevents artificial bridging across missing values.

## 9. WHO Reference Thresholds
Horizontal `ReferenceLine` elements at `-2` (Warning/Moderate) and `-3` (Severe) are included in the WAZ and HAZ charts to help mothers interpret changes over time.

## 10. Genuine-Visit Preservation
Synthetic or monthly visits are entirely forbidden. X-Axis plots map perfectly to backend instances. 

## 11. No Interpolation Verification
Verified that `connectNulls` behavior in `recharts` and array filtering rules prevent any interpolation or fabrication of missing observations.

## 12. Responsive Design
- **Mobile Devices**: Nav tabs (`overflow-x-auto`) handle tight screen estates. Cards display linearly.
- **Tablet/Desktop**: Cards span side-by-side using `grid-cols-3`.

## 13. Frontend Test Results
Run via `docker compose run --rm frontend npm test`.
- All `GrowthOverviewPage`, `GrowthChartsPage`, and `GrowthCharts` utility tests successfully passed.
- No-data, single-visit, and missing-height edge cases were thoroughly validated in `vitest`.

## 14. Backend Regression
Executed `pytest` in both gateway and child-growth-monitoring-service. All tests maintained a 100% pass rate with zero new failures.

## 15. Frozen Artifact Verification
The command `python research/scripts/stage12_freeze_research_core.py --verify` confirmed all models, parameters, scalers, and data splits remain byte-for-byte identical.

## 16. Known sklearn Warning
`InconsistentVersionWarning` for `scikit-learn` versions between 1.7.2 (artifact generation) and 1.9.1 (current runtime) is noted but safely managed by the model pipeline architecture.

## 17. Limitations
Predictive layers, dynamic risk projections, and SHAP XAI layers remain unmounted. The architecture correctly segregates them for upcoming stages.

## 18. Readiness for Stage 16E
With Stage 16D passing strictly and displaying authenticated historical growth patterns reliably, the system is now verified and prepared for Stage 16E (30-Day Growth Forecast UI).
