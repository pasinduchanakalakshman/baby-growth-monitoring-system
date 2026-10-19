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
  risk_available: boolean;
  risk_probability?: number | null;
  risk_score?: number | null;
  risk_threshold?: number | null;
  risk_flag?: number | null;
  screening_status?: string | null;
  screening_threshold_note?: string | null;
  prediction_horizon_days?: number | null;
  model_version?: string | null;
  model_type?: string | null;
  component_scores?: {
    xgboost_probability: number;
    transformer_probability: number;
    alpha_xgboost?: number;
    weight_transformer?: number;
  } | null;
  model_applicable?: boolean | null;
  reason?: string | null;
}

export interface GrowthOverview {
  baby: Record<string, any>;
  current_growth?: CurrentGrowthOutput | null;
  forecast_30d?: GrowthOverviewForecast | null;
  risk_180d?: Risk180Day | null;
}

export interface RiskTrajectoryPoint {
  visit_date: string;
  age_days?: number | null;
  weight_kg?: number | null;
  verified_waz?: number | null;
  risk_probability?: number | null;
}

export interface FrontendSafeExplanation {
  feature: string;
  display_label: string;
  direction: string;
  importance_rank: number;
}

export interface TechnicalExplanation {
  base_value: number;
  contributions: {
    feature: string;
    transformed_value: number | null;
    raw_value: number | null;
    shap_contribution: number;
  }[];
}

export interface RiskExplanation {
  technical_explanation: TechnicalExplanation;
  frontend_safe_explanation: FrontendSafeExplanation[];
  disclaimer: string;
  model_coverage_disclosure?: string;
}

export interface ModelInfo {
  Risk: {
    model: string;
    horizon_days: number;
    threshold: number;
  };
  Forecast: {
    model: string;
    nominal_horizon_days: number;
    training_target: string;
  };
  Disclaimers: string[];
}
