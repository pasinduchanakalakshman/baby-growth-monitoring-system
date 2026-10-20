"""Offline educational chart only. No persistence, clinical scores or ML calls.

See docs/newborn-weight-journey.md for source provenance and applicability.
Published interval rates are used as illustrative slopes, never daily standards.
"""
import json
import math
from pathlib import Path

from app.schemas.newborn_weight_journey import (
    JourneyAssumptions, JourneyReferenceRate, NewbornJourneyPoint,
    NewbornWeightJourneyResponse,
)

REFERENCE_PATH = Path(__file__).resolve().parents[1] / "data/newborn_weight_journey/who_reference.json"
DISCLAIMER = (
    "This chart shows an example of how a newborn's weight may change. "
    "Only the birth weight is a recorded measurement. "
    "The other values are illustrations, not exact predictions."
)
LIMITATIONS = [
    "This general example is for babies born at term. It may not suit babies who are unwell or need special care. Follow your healthcare provider's individual advice.",
    "The early dip and recovery timing are assumed. Later daily values illustrate population rates; they do not assess your baby's health or show normal growth limits.",
]


def load_reference() -> dict:
    """Fail closed for missing/incomplete/invalid offline reference data."""
    data = json.loads(REFERENCE_PATH.read_text(encoding="utf-8"))
    if (data["groups_g"] != [[2500, 3000], [3000, 3500], [3500, 4000]]
            or data["intervals_days"] != [[0, 7], [7, 14], [14, 28], [28, 42]]
            or not isinstance(data["version"], str) or not data["version"]):
        raise ValueError("Unsupported reference structure")
    for sex in ("Male", "Female"):
        rows = data["median_velocity_g_per_day"][sex]
        if len(rows) != 3 or any(
            len(row) != 4 or any(type(v) not in (int, float) or not math.isfinite(v) or not 0 < v < 100 for v in row)
            for row in rows
        ):
            raise ValueError("Invalid reference rates")
    return data


def calculate_newborn_weight_journey(
    birth_weight_kg: object, sex: object, gestational_age_weeks: object,
) -> NewbornWeightJourneyResponse:
    # Accept only real finite stored numbers; booleans are not birth details.
    valid_weight = type(birth_weight_kg) in (int, float) and math.isfinite(birth_weight_kg) and birth_weight_kg > 0
    birth = float(birth_weight_kg) if valid_weight else None

    def unavailable(reason: str, message: str) -> NewbornWeightJourneyResponse:
        return NewbornWeightJourneyResponse(
            available=False, reason=reason, birth_weight_kg=birth, message=message,
        )

    if not valid_weight:
        return unavailable("invalid_birth_weight", "A valid recorded birth weight is unavailable, so this example cannot be drawn.")
    if gestational_age_weeks is None:
        return unavailable("missing_gestational_age", "The recorded birth details do not confirm whether your baby was born at term. This example is unavailable; ask your healthcare provider for individual guidance.")
    if type(gestational_age_weeks) is not int or not 37 <= gestational_age_weeks <= 41:
        return unavailable("unsupported_gestational_age", "This example is for babies born at term and does not suit the recorded gestational age. Ask your healthcare provider for individual guidance.")
    if birth < 2.5:
        return unavailable("low_birth_weight", "This example does not cover your baby's recorded birth weight. Your healthcare provider can guide you about early weight changes.")
    if birth >= 4.0:
        return unavailable("unsupported_birth_weight", "This example does not cover your baby's recorded birth weight. Your healthcare provider can guide you about early weight changes.")
    sex_value = getattr(sex, "value", sex)
    if sex_value not in ("Male", "Female"):
        return unavailable("invalid_sex", "The recorded birth details are incomplete, so this example is unavailable.")

    try:
        reference = load_reference()
    except (OSError, ValueError, KeyError, TypeError):
        return unavailable("reference_unavailable", "We cannot prepare this example right now. Please try again later.")
    group_index = 0 if birth < 3.0 else 1 if birth < 3.5 else 2
    rates = reference["median_velocity_g_per_day"][sex_value][group_index]
    r1, r2, r3 = (v / 1000 for v in rates[1:])
    at_14 = birth + 4 * r1
    at_28 = at_14 + 14 * r2
    low = birth * 0.95
    points = []
    for day in range(31):
        if day == 0:
            weight, phase = birth, "Birth"
        elif day <= 3:
            weight, phase = birth * (1 - 0.05 * day / 3), "Initial weight loss"
        elif day <= 10:
            weight, phase = low + (birth - low) * (day - 3) / 7, "Recovery"
        elif day <= 14:
            weight, phase = birth + (day - 10) * r1, "Continued growth"
        elif day <= 28:
            weight, phase = at_14 + (day - 14) * r2, "Continued growth"
        else:
            weight, phase = at_28 + (day - 28) * r3, "Continued growth"
        points.append(NewbornJourneyPoint(
            day=day, weight_kg=weight, phase=phase,
            value_type="recorded_birth_weight" if day == 0 else "illustrative",
        ))
    return NewbornWeightJourneyResponse(
        available=True, birth_weight_kg=birth, points=points, message=DISCLAIMER,
        limitations=LIMITATIONS, assumptions=JourneyAssumptions(),
        reference_version=reference["version"],
        reference_birth_weight_group_g=reference["groups_g"][group_index],
        reference_rates=[JourneyReferenceRate(
            interval_start_day=start, interval_end_day=end, median_velocity_g_per_day=rate,
        ) for (start, end), rate in zip(reference["intervals_days"][1:], rates[1:])],
    )
