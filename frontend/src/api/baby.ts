import { apiClient } from './client';
import { BabyProfile, BabyRegistrationRequest, BabyUpdateRequest } from '@/types/baby';

export const babyApi = {
  getBabyProfile: () => {
    return apiClient.get<BabyProfile>('/baby/profile');
  },

  registerBaby: (payload: BabyRegistrationRequest) => {
    return apiClient.post<BabyProfile>('/baby/register', payload);
  },

  updateBabyProfile: (payload: BabyUpdateRequest) => {
    return apiClient.put<BabyProfile>('/baby/profile', payload);
  }
};
