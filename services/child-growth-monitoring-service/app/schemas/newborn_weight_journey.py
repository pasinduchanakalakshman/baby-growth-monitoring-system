from typing import Literal

from pydantic import BaseModel, Field


class NewbornJourneyPoint(BaseModel):
    day: int = Field(ge=0, le=30)
    weight_kg: float = Field(gt=0, allow_inf_nan=False)
    value_type: Literal["recorded_birth_weight", "illustrative"]
    phase: Literal["Birth", "Initial weight loss", "Recovery", "Continued growth"]


class JourneyAssumptions(BaseModel):
    loss_fraction: float = 0.05
    nadir_day: int = 3
    recovery_day: int = 10
    interpolation: str = "piecewise_linear"


class JourneyReferenceRate(BaseModel):
    interval_start_day: int
    interval_end_day: int
    median_velocity_g_per_day: float
    value_type: Literal["published_population_reference"] = "published_population_reference"


class NewbornWeightJourneyResponse(BaseModel):
    available: bool
    reason: str | None = None
    chart_type: Literal["educational_illustration"] = "educational_illustration"
    birth_weight_kg: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    duration_days: Literal[30] = 30
    points: list[NewbornJourneyPoint] = Field(default_factory=list)
    method: str = "documented_newborn_reference_illustration_v1"
    message: str
    limitations: list[str] = Field(default_factory=list)
    assumptions: JourneyAssumptions | None = None
    reference_version: str | None = None
    reference_birth_weight_group_g: list[int] | None = None
    reference_rates: list[JourneyReferenceRate] = Field(default_factory=list)
