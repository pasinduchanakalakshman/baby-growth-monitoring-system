import { apiClient } from './client';
import {
  GrowthMeasurementRequest,
  GrowthOverview,
  GrowthHistoryPoint,
  Forecast30Day,
  Risk180Day,
  RiskTrajectoryPoint,
  RiskExplanation,
  ModelInfo,
  NewbornWeightJourney
} from '@/types/growth';

export const growthApi = {
  getNewbornWeightJourney: () => {
    return apiClient.get<NewbornWeightJourney>('/growth/newborn-weight-journey');
  },
  addGrowthMeasurement: (payload: GrowthMeasurementRequest) => {
    return apiClient.post<GrowthHistoryPoint>('/growth/measurements', payload);
  },

  getGrowthOverview: () => {
    return apiClient.get<GrowthOverview>('/growth/overview');
  },

  getGrowthHistory: () => {
    return apiClient.get<GrowthHistoryPoint[]>('/growth/history');
  },

  getGrowthForecast: () => {
    return apiClient.get<Forecast30Day>('/growth/forecast');
  },

  getLatestRisk: () => {
    return apiClient.get<Risk180Day>('/growth/risk/latest');
  },

  getRiskTrajectory: () => {
    return apiClient.get<RiskTrajectoryPoint[]>('/growth/risk/trajectory');
  },

  getRiskExplanation: (signal?: AbortSignal) => {
    return apiClient.get<RiskExplanation>('/growth/risk/explanation', { signal });
  },

  getModelInfo: () => {
    return apiClient.get<ModelInfo>('/growth/model-info');
  }
};
