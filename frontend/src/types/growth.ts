export interface GrowthMeasurementRequest {
  date: string; // ISO date string
  weight_kg: number;
  length_cm?: number;
  head_circumference_cm?: number;
  muac_cm?: number;
  notes?: string;
}

export interface GrowthHistoryPoint {
  id: number;
  baby_id: number;
  visit_date: string;
  weight_kg: number;
  length_cm?: number | null;
  head_circumference_cm?: number | null;
  muac_cm?: number | null;
  age_days?: number | null;
  waz?: number | null;
  haz?: number | null;
}

export interface GrowthOverview {
  latest_measurement?: GrowthHistoryPoint | null;
  total_measurements: number;
  waz?: number | null;
  haz?: number | null;
  weight_status?: string | null;
  height_status?: string | null;
}

export interface ForecastPoint {
  forecast_date: string;
  predicted_weight_kg: number;
  lower_bound?: number | null;
  upper_bound?: number | null;
}

export interface Forecast30Day {
  forecast_generated_at: string;
  forecast_points: ForecastPoint[];
  model_version?: string | null;
}

export interface Risk180Day {
  risk_probability: number;
  risk_category: string;
  assessment_date: string;
  model_version?: string | null;
}

export interface RiskTrajectoryPoint {
  assessment_date: string;
  risk_probability: number;
  risk_category: string;
}

export interface ShapFeature {
  feature_name: string;
  feature_value: number | string;
  shap_value: number;
  impact_direction: 'positive' | 'negative' | 'neutral';
}

export interface RiskExplanation {
  risk_probability: number;
  risk_category: string;
  top_features: ShapFeature[];
  assessment_date: string;
}

export interface ModelInfo {
  model_type: string;
  trained_at?: string | null;
  version?: string | null;
  features_used?: string[] | null;
}

export interface ApiError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>;
}
