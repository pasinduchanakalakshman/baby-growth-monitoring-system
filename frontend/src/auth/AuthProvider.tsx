import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthenticatedUser } from '@/types/auth';
import { authApi } from '@/api/auth';

type AuthState = 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'API_ERROR';

interface AuthContextType {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authState: AuthState;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [authState, setAuthState] = useState<AuthState>('AUTH_LOADING');

  const { data: user, isLoading, isError, refetch } = useQuery({
    queryKey: ['auth.me'],
    queryFn: () => authApi.getCurrentUser(),
    retry: false, // Don't retry on 401s
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (isLoading) {
      setAuthState('AUTH_LOADING');
    } else if (isError) {
      // Typically a 401 Unauthorized
      setAuthState('UNAUTHENTICATED');
    } else if (user) {
      setAuthState('AUTHENTICATED');
    } else {
      setAuthState('UNAUTHENTICATED');
    }
  }, [user, isLoading, isError]);

  const refreshUser = async () => {
    await refetch();
  };

  const logout = async () => {
    try {
      await authApi.logoutMother();
    } catch (e) {
      console.error('Logout failed:', e);
    } finally {
      queryClient.setQueryData(['auth.me'], null);
      queryClient.clear(); // Clear all other queries (baby, growth)
      setAuthState('UNAUTHENTICATED');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isAuthenticated: authState === 'AUTHENTICATED',
        isLoading: authState === 'AUTH_LOADING',
        authState,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
