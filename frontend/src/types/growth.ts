export interface GrowthMeasurementRequest {
  visit_date: string;
  weight_kg: number;
  length_height_cm?: number | null;
  currently_breastfeeding?: boolean | null;
  formula_feeding?: boolean | null;
  solid_foods_started?: boolean | null;
  diarrhea_last_14_days?: boolean | null;
  fever_last_14_days?: boolean | null;
  cough_last_14_days?: boolean | null;
}

export interface GrowthHistoryPoint {
  id: number;
  baby_id: number;
  visit_date: string;
  weight_kg: number;
  length_height_cm?: number | null;
  currently_breastfeeding?: boolean | null;
  formula_feeding?: boolean | null;
  solid_foods_started?: boolean | null;
  diarrhea_last_14_days?: boolean | null;
  fever_last_14_days?: boolean | null;
  cough_last_14_days?: boolean | null;
  age_days?: number | null;
  verified_waz?: number | null;
  verified_haz?: number | null;
}

export interface CurrentGrowthOutput {
  visit_date: string;
  age_days?: number | null;
  weight_kg: number;
  length_height_cm?: number | null;
  waz?: number | null;
  haz?: number | null;
}

export interface GrowthOverviewForecast {
  available: boolean;
  estimated_waz?: number | null;
  estimated_weight_kg?: number | null;
  estimated_weight_change_kg?: number | null;
  horizon_days?: number | null;
  reason?: string | null;
}

export interface Forecast30Day {
  forecast_available: boolean;
  estimated_future_waz?: number | null;
  estimated_future_weight_kg?: number | null;
  estimated_weight_change_kg?: number | null;
  nominal_horizon_days?: number | null;
  training_window_days?: number[] | null;
  model_version?: string | null;
  methodology_note?: string | null;
  reason?: string | null;
}

export interface Risk180Day {
  available: boolean;
  applicable?: boolean | null;
  probability?: number | null;
  threshold?: number | null;
  flag?: number | null;
  horizon_days?: number | null;
  reason?: string | null;
}

export interface GrowthOverview {
  baby: Record<string, any>;
  current_growth?: CurrentGrowthOutput | null;
  forecast_30d?: GrowthOverviewForecast | null;
  risk_180d?: Risk180Day | null;
}

export interface RiskTrajectoryPoint {
  // Just placeholders for later stages
  [key: string]: any;
}

export interface RiskExplanation {
  [key: string]: any;
}

export interface ModelInfo {
  [key: string]: any;
}
