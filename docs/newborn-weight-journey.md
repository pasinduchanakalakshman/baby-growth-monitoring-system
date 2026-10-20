# Task 4.8 — Newborn weight journey

## Data flow and scope

Registration (`frontend/src/pages/protected/BabyRegistrationPage.tsx`) posts
`birth_weight_kg` to `/api/v1/baby/register`; `Baby.birth_weight_kg` is a non-null
float in the existing `babies` table. `/api/v1/baby/profile` filters by the
authenticated user's owner ID and returns the stored weight and optional
gestational age. The existing `babyApi.getBabyProfile` and `['baby.profile']`
query supply this feature. No schema, endpoint, service or backend change is needed.

Growth Monitoring shows the new section before measurement history, including
when there are no visits or when the existing overview is loading or fails.
The overview already calls its existing forecasting/risk services; those calls
and logic are unchanged. The journey itself only uses the profile and a local
pure calculation. The component performs no API calls or database writes.
It never creates visits, measurements, alerts, WHO scores or forecasts.

The existing Recharts library, primary color, card styles, spacing and loading
component are reused. Existing WHO charts, 30-day forecast and 180-day risk
features remain separate. For babies aged 0–30 calendar days inclusive, this
overview omits its measurement-entry prompts. Existing clinical measurement
routes remain available. Older children retain their existing controls and can
view the clearly labeled educational example.

## Clinical background and illustrative assumptions

Reviewed 2026-10-16. Internal references only; never rendered in the application:

- [American Academy of Pediatrics: First Office Visit, 3–5 Days](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-health-assessment-and-promotion/first-office-visit-3-5-days/)
  describes birth-weight recovery commonly taking 7–14 days and assessment of
  hydration and urine/stool patterns.
- [NHS: Your baby's weight and height](https://www.nhs.uk/baby/babys-development/height-weight-and-reviews/baby-height-and-weight/)
  describes early weight loss followed by gain. Recovery timing varies; the
  illustration does not set a deadline for an individual baby.
- [NHS: Breastfeeding — is my baby getting enough milk?](https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding-problems/enough-milk/)
  discusses early weight loss and signs of feeding adequacy.

These sources support the general educational narrative, not the exact numerical
curve. The requested teaching assumptions are 5% below birth weight at day 3,
recovery to birth weight at day 12, and 0.025 kg/day thereafter to day 30.
They are not a validated model, individual prediction, clinical limits or normal
range. No arbitrary upper/lower bands are calculated. No health status is inferred.

The utility linearly interpolates daily values across days 0–3 and 3–12; after
day 12 it adds the teaching daily gain. Recharts monotone interpolation smooths
the displayed line without overshoot. There are 31 finite positive daily values.
Day 0 retains the exact input; rounding is only for tooltip presentation. Invalid,
missing or numerically unrepresentable input yields no curve.

For 3.2 kg: day 0 = 3.200 kg (recorded), day 3 = 3.040 kg, day 12 = 3.200 kg,
day 20 = 3.400 kg, day 30 = 3.650 kg (all later values illustrative).

Gestational age only changes the limitation text, never the numerical curve.
Recorded whole weeks 37–41 enable the term-example wording. Missing gestational
age, prematurity or other values receive explicit uncertainty wording. No
medical-vulnerability field exists; every chart therefore warns that the example
may not suit unwell babies or those needing special care and directs families to
individual clinical advice. No suitability or health classification is attempted.

## Presentation and validation

A responsive card titled “Your Baby's First 30 Days” contains a dashed curve, a
solid recorded birth marker, labeled axes, distinct tooltip wording, a visible
illustration disclaimer, four phase explanations and general seek-advice guidance.
Explanations stack on mobile and use two columns on larger screens. There are no
inputs, citation links, technical formulas or model scores in the section.

Automated checks cover multiple birth weights, all milestones and daily
directions, positive finite outputs, invalid weights, a real Recharts SVG at
320px chart width, dashed styling, recorded marker, axes, tooltip wording,
prematurity/unknown-status limitations, no component API reads/writes, profile
weight selection over overview values, absence of newborn entry prompts, and
continued availability when the existing dashboard fails.

The mobile SVG test does not replace a visual browser/device check. No live
clinical data or held-out datasets are used.

## Final verification report

Verdict: PASS for implementation and automated frontend checks, with live
Docker and visual browser verification outstanding.

Exact files created:

- `frontend/src/utils/newbornWeightJourney.ts`
- `frontend/src/utils/newbornWeightJourney.test.ts`
- `frontend/src/features/growth/components/NewbornWeightJourneyChart.tsx`
- `frontend/src/features/growth/components/NewbornWeightJourneyChart.test.tsx`
- `docs/newborn-weight-journey.md`

Exact existing files changed:

- `frontend/src/pages/protected/GrowthOverviewPage.tsx`
- `frontend/src/pages/protected/GrowthOverviewPage.test.tsx`

Results:

- Calculation checkpoint: 14/14 tests passed.
- Component and overview checkpoint: 26/26 tests passed before the additional
  API-isolation test; final full suite includes that test.
- `npm.cmd test`: 17 files, 129 tests passed, including existing chart,
  forecast, risk, authentication and API tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed, including `tsc -b` application/test compilation.
  Vite reports a non-fatal JavaScript chunk warning above 500 kB.
- `git diff --check`: passed.
- `docker compose config --quiet`: passed.
- `docker compose ps`: succeeded; no application containers running. A live
  Docker smoke test and container build were not performed.
- Backend tests: not required; no backend files changed.

No additional weight entry is required for this chart. No trained AI model is
involved in its calculations. No illustrative values are saved as actual
measurements. Frozen artifacts, prediction logic and held-out datasets were
not changed or used. The chart is a general educational illustration and is
not validated as a child-specific clinical standard.
