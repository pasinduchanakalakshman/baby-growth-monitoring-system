import { apiClient } from './client';
import { AuthenticatedUser } from '@/types/auth';

export const authApi = {
  getCurrentUser: () => {
    return apiClient.get<AuthenticatedUser>('/auth/me');
  },
  
  loginMother: (payload: any) => {
    return apiClient.post<any>('/auth/login', payload);
  },
  
  registerMother: (payload: any) => {
    return apiClient.post<AuthenticatedUser>('/auth/register', payload);
  },
  
  logoutMother: () => {
    return apiClient.post<{ message: string }>('/auth/logout');
  }
};
