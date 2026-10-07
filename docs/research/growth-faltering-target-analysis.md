# Growth Faltering Target Analysis: Feasibility & Methodology

## 1. Why target definition must occur before ML training
In longitudinal health prediction tasks, the precise definition of what constitutes an "event" heavily dictates model performance, class balance, and clinical utility. Defining the target *before* training ensures that the model optimizes for a strictly defined, causally valid future occurrence rather than overfitting to arbitrary changes. Stage 5A is dedicated entirely to evaluating the statistical feasibility of candidate target definitions over different future horizons without exposing any future information to model inputs.

## 2. Difference between current status and future risk
A critical distinction in this framework is separating *prevalence* (already growth-faltering) from *incidence* (newly developing growth-faltering risk). A child already possessing a WAZ < -2.0 requires immediate intervention (diagnosis), whereas a child currently at WAZ = -0.5 who will cross into WAZ < -2.0 within 180 days represents future risk (prediction). Mixing these two groups causes the model to "predict" what is already known.

## 3. Difference between next-visit prediction and fixed-horizon prediction
Early proofs-of-concept often predict "WAZ at the next visit." However, real-world CHDR data reveals that the time between visits varies wildly (from a few days to many months). A fixed-horizon approach (e.g., predicting an event *within 90 days*) normalizes the prediction target to a specific clinical window, allowing consistent risk assessment regardless of when the next visit organically occurs.

## 4. Candidate A: Future WHO Threshold Crossing
Candidate A evaluates whether a child's future WAZ drops below a clinically recognized threshold (e.g., WAZ < -2.0). 
- **A1** evaluates if *any* future observation within the horizon drops below the threshold.
- **A2** evaluates *new* crossings, specifically excluding children who were already below the threshold at the index visit.

## 5. Candidate B: Future WAZ Decline
Candidate B evaluates growth velocity trajectories rather than absolute thresholds. A rapid decline in WAZ (e.g., dropping by 0.25, 0.50, or 0.75 standard deviations) may signal acute nutritional risk even if the child has not yet crossed the -2.0 threshold. This candidate evaluates the feasibility of predicting significant downward momentum.

## 6. Candidate C: Combined Outcome
Candidate C combines both absolute status and relative velocity. An event is triggered if the child *either* crosses the -2.0 WAZ threshold *or* experiences a severe WAZ decline (e.g., >= 0.50). This captures both acute faltering and steady deterioration toward malnutrition.

## 7. 90-day horizon
A 90-day (approx. 3-month) prediction horizon represents near-term risk. It offers an actionable window for rapid nutritional intervention but limits the number of usable index observations because any observation within 90 days of the end of a child's record must be excluded due to insufficient follow-up.

## 8. 180-day horizon
A 180-day (approx. 6-month) prediction horizon evaluates medium-term risk. While it provides a longer runway for early intervention programs, it significantly increases the censoring rate, as observations must have at least 6 months of future data to be deemed "usable" for evaluating the target.

## 9. Insufficient follow-up/censoring
If an index observation occurs too close to the end of a child's recorded dataset (e.g., an observation on June 1st with the dataset ending on July 1st), it is impossible to definitively know if a 180-day event occurred. These rows are marked as having *insufficient follow-up* and must be excluded from target calculation for that horizon rather than falsely labeled as "negative".

## 10. Class imbalance
Severe class imbalance is a natural property of preventative healthcare datasets (most children do not falter). Candidate targets that occur too infrequently (e.g., severe WAZ decline > 0.75 within 90 days) will yield a highly imbalanced dataset that classical models may struggle to learn from without advanced weighting or sampling strategies.

## 11. Why no candidate is automatically selected
The purpose of Stage 5A is descriptive and statistical feasibility analysis. An automated script cannot determine which clinical outcome is most appropriate for Sri Lankan public health objectives. The script provides the event rates, sample sizes, and required follow-up times so that human researchers can make an informed final decision.

## 12. Why domain/supervisor validation is still required
The outputs of this feasibility stage must be reviewed by the principal investigator or domain experts. They must weigh the clinical utility of early detection (e.g., 180-day decline) against the statistical power (number of usable observations) before approving the final label generation for Stage 5B.

**IMPORTANT:** The candidate definitions analysed in this document are research feasibility definitions and are not automatically clinical diagnoses.
