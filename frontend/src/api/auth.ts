import { apiClient } from './client';
import { AuthenticatedUser } from '@/types/auth';

export const authApi = {
  getCurrentUser: () => {
    return apiClient.get<AuthenticatedUser>('/auth/me');
  },
  
  loginMother: (payload: any) => {
    // Stage 15H-A backend /api/v1/auth/login uses OAuth2 form data
    const formData = new URLSearchParams();
    formData.append('username', payload.email); // OAuth2 spec uses username
    formData.append('password', payload.password);
    
    return apiClient.request<any>('/auth/login', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },
  
  registerMother: (payload: any) => {
    return apiClient.post<AuthenticatedUser>('/auth/register', payload);
  },
  
  logoutMother: () => {
    return apiClient.post<{ message: string }>('/auth/logout');
  }
};
