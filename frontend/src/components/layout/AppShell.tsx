import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { Loader2 } from 'lucide-react';
import { babyApi } from '@/api/baby';
import { ApiClientError } from '@/api/client';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { PageContainer } from './PageContainer';
import { getAppPageTitle } from './navigationConfig';

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Fetch baby profile to determine onboarding status
  const { data: baby, isLoading, error } = useQuery({
    queryKey: ['baby.profile'],
    queryFn: babyApi.getBabyProfile,
    retry: (failureCount, err) => {
      // Don't retry if it's a 404 (baby not found -> needs onboarding)
      if (err instanceof ApiClientError && err.status === 404) return false;
      return failureCount < 3;
    }
  });

  const isBabyNotFound = error instanceof ApiClientError && error.status === 404;

  if (isLoading) {
    return (
      <div role="status" className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-background">
        <Loader2 aria-hidden="true" className="size-10 animate-spin text-primary motion-reduce:animate-none" />
        <p className="animate-pulse font-medium text-muted-foreground motion-reduce:animate-none">Loading application data...</p>
      </div>
    );
  }

  // If no baby is found, and we're not already on the registration page, redirect to onboarding.
  if (isBabyNotFound && location.pathname !== '/baby/register') {
    return <Navigate to="/baby/register" replace />;
  }

  // If baby exists and we're on the registration page, redirect to dashboard.
  if (baby && location.pathname === '/baby/register') {
    return <Navigate to="/app" replace />;
  }

  // If we are currently ON the onboarding page, we don't render the AppShell navigation.
  if (location.pathname === '/baby/register') {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background lg:flex-row lg:gap-4 lg:p-4">
      <a href="#app-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-6 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-3 focus:text-primary focus:shadow-card focus:outline-2 focus:outline-ring">
        Skip to content
      </a>
      <AppSidebar onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col lg:min-h-0">
        <AppHeader title={getAppPageTitle(location.pathname)} user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
        <PageContainer><Outlet /></PageContainer>
      </div>
    </div>
  );
}
