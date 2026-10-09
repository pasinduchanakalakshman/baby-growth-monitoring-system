import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, authState } = useAuth();

  if (isLoading || authState === 'AUTH_LOADING') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FB]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
