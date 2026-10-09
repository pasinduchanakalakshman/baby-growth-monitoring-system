import React from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Baby, Home, LineChart, User, Settings, LogOut, Menu, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { babyApi } from '@/api/baby';
import { ApiClientError } from '@/api/client';

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
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
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#F8F9FB] gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading application data...</p>
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

  const navItems = [
    { name: 'Overview', href: '/app', icon: Home },
    { name: 'Baby Profile', href: '/baby', icon: Baby },
    { name: 'Growth Monitoring', href: '/growth', icon: LineChart },
    { name: 'Account', href: '/account', icon: Settings },
  ];

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-[#F8F9FB]">
      
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r h-screen sticky top-0">
        <div className="h-16 flex items-center px-6 border-b">
          <Link to="/app" className="flex items-center gap-2">
            <Baby className="h-6 w-6 text-primary" />
            <span className="font-bold">Growth Monitor</span>
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {user?.name?.charAt(0) || <User className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2 text-slate-600" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile/Tablet Content Wrapper */}
      <div className="flex-1 flex flex-col min-h-dvh pb-16 lg:pb-0 lg:ml-0">
        
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Baby className="h-6 w-6 text-primary" />
            <span className="font-bold">Growth Monitor</span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="h-16 flex items-center px-6 border-b">
                <span className="font-bold">Menu</span>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <nav className="space-y-1 px-3">
                  {navItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  ))}
                  <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-2 text-slate-600" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                    Logout
                  </Button>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t flex items-center justify-around z-40 px-2 pb-safe">
        {[
          { name: 'Home', href: '/app', icon: Home },
          { name: 'Baby', href: '/baby', icon: Baby },
          { name: 'Growth', href: '/growth', icon: LineChart },
          { name: 'Account', href: '/account', icon: User },
        ].map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
