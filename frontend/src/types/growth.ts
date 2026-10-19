export interface NewbornJourneyPoint {
  day: number;
  weight_kg: number;
  value_type: 'recorded_birth_weight' | 'illustrative';
  phase: 'Birth' | 'Initial weight loss' | 'Recovery' | 'Continued growth';
}

export interface NewbornWeightJourney {
  available: boolean;
  reason: string | null;
  chart_type: 'educational_illustration';
  birth_weight_kg: number | null;
  duration_days: 30;
  points: NewbornJourneyPoint[];
  method: string;
  message: string;
  limitations: string[];
  assumptions: { loss_fraction: number; nadir_day: number; recovery_day: number; interpolation: string } | null;
  reference_version: string | null;
  reference_birth_weight_group_g: number[] | null;
  reference_rates: { interval_start_day: number; interval_end_day: number; median_velocity_g_per_day: number; value_type: 'published_population_reference' }[];
}

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

export interface ModelCombination {
  xgboost_weight: number;
  transformer_weight: number;
  xgboost_score: number;
  transformer_score: number;
  xgboost_weighted_contribution: number;
  transformer_weighted_contribution: number;
  hybrid_score: number;
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
  model_combination?: ModelCombination | null;
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
    raw_value: number | string | boolean | null;
    shap_contribution: number;
  }[];
}

export interface RiskExplanation {
  technical_explanation: TechnicalExplanation;
  frontend_safe_explanation: FrontendSafeExplanation[];
  disclaimer: string;
  model_coverage_disclosure?: string;
  model_combination?: ModelCombination | null;
  explanation_scope?: {
    shap_branch: 'xgboost_only';
    shap_value_space: 'log_odds';
    transformer_feature_attribution_available: false;
  };
  assessment?: { visit_date: string; recorded_visit_count: number };
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
