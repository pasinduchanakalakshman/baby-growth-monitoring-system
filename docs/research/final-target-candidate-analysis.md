# Final Target Candidate Analysis (Stage 5B-PRE)

## Introduction
Following the initial feasibility analysis in Stage 5A, the combined outcome (Candidate C) showed promise for maintaining statistical power while capturing clinically relevant risk. However, it inadvertently grouped children who were *already* severely malnourished (prevalent cases) with those *developing* malnutrition (incident risk) when applying the threshold-crossing condition. 

Stage 5B-PRE refines this target by strictly isolating **incident/emerging risk**. 

## Definition of 'New Crossing'
A child is only considered to have a "New Threshold Crossing" if:
1. Their `verified_waz` at the index visit (T) is `>= -2.0` (not currently flagged as faltering).
2. Their future `verified_waz` drops `< -2.0` within the specified horizon.

If a child is already `< -2.0` at the index visit, they cannot experience a "new" crossing. They require immediate intervention rather than predictive modeling. However, they may still qualify for the outcome if their condition rapidly worsens (captured by the decline condition).

## Exploratory Candidates (180-Day Horizon)

To establish the most statistically robust and clinically valid target, two combined candidates were analyzed:

### Candidate D1: Extreme Sensitivity
**Condition:** `NEW Threshold Crossing (< -2.0) OR WAZ Decline >= 0.25`

- **Purpose:** Captures even minor developmental velocity drops alongside new absolute crossings.
- **Trade-off:** High statistical power (many positive events) at the cost of clinical specificity. A drop of 0.25 SD over 6 months may be a normal fluctuation rather than pathological faltering.

### Candidate D2: Balanced Precision
**Condition:** `NEW Threshold Crossing (< -2.0) OR WAZ Decline >= 0.50`

- **Purpose:** Captures emergent risk by flagging children who either cross into the clinically deficient zone, or who experience a severe, sustained deceleration in growth velocity (>= 0.50 SD) regardless of their starting point.
- **Trade-off:** Lower statistical power (highly imbalanced class) but much higher clinical specificity. Events flagged by D2 are statistically unlikely to be measurement noise.

## Stratification Logic
The analysis explicitly stratifies the cohort based on current status:
- **Index WAZ >= -2.0**: The primary target demographic for early prediction. Can satisfy the outcome via a new crossing or severe decline.
- **Index WAZ < -2.0**: Prevalent cases. Can only satisfy the outcome via a severe decline, indicating worsening severe malnutrition.

## Conclusion & Next Steps
This analysis provides the final metrics needed to select the ultimate research target. The chosen candidate will be used to label the temporal sequences before training the final predictive AI framework.
