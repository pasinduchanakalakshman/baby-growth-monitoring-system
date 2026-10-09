# Stage 16D: Growth Dashboard and Longitudinal Charts

## 1. Data Flow & Contract
The frontend directly hooks into the existing `services/child-growth-monitoring-service/app/api/routes/growth.py` endpoints:
- `GET /api/v1/growth/overview`: Fetches the baby's profile data, the latest measurement data (weight, length/height), current WAZ, and current HAZ.
- `GET /api/v1/growth/history`: Fetches the array of chronologically stored historical measurements for rendering longitudinal graphs.

All WAZ, HAZ, and age calculation is strictly maintained as the backend's responsibility. The frontend acts exclusively as a secure display layer.

## 2. WHO-Status Presentation
Z-scores retrieved from the backend are evaluated for presentation using WHO reference thresholds:
- `z < -3`: Markedly below WHO threshold
- `-3 <= z < -2`: Below WHO threshold
- `z >= -2`: Within expected WHO threshold

The UI displays the raw z-score alongside these mother-friendly phrases. No clinical diagnostic labels (e.g., "malnourished") are used.

## 3. Handling Missing Height
The API permits optional `length_height_cm`. When `length_height_cm` is `null`:
- The "Length/Height" display shows `Not recorded`.
- The HAZ value display shows `Not available — length/height was not recorded for this visit.`
- The `HeightChart` omits the node without breaking the visual timeline.
- No interpolation, zero-filling, forward-filling, or back-filling occurs.

## 4. Chart Construction
Using Recharts, the frontend graphs observations along the true chronological axis (`visit_date`). Horizontal reference lines for WHO Thresholds (`-2` and `-3`) are overlaid on WAZ and HAZ charts.

## 5. Genuine Visit Preservation
No synthetic data points (e.g., artificial "monthly rows") are inserted into the charts. Every point visible in the dashboard corresponds exactly to a single physical row in PostgreSQL created by a mother submitting actual measurements.

## 6. Date Handling
The utility function `formatCalendarDate` correctly splits the `"YYYY-MM-DD"` ISO date directly into integer parts and forces construction into local browser time to avoid UTC-midnight conversion edge cases, guaranteeing that calendar dates stay locked exactly as entered.

## 7. Responsive Behavior
- **Mobile Devices**: Single column summary cards. Charts are fully responsive with scrollable navigation tabs to switch between Weight, Height, WAZ, and HAZ.
- **Tablet / Desktop**: The summary layout snaps into a grid (`md:grid-cols-3`). 

## 8. Limitations
Currently, forecasting and dynamic risk charts (Stage 16E/16F) are hidden pending future integration phases. Only actual historical measurements are analyzed on the dashboard.
