import { Loader2, LogOut } from 'lucide-react';
import { AuthBranding } from '@/components/auth/AuthBranding';
import { Button } from '@/components/ui/button';
import { AppNavigation } from './AppNavigation';

export function AppSidebar({ onLogout, isLoggingOut }: { onLogout: () => void; isLoggingOut: boolean }) {
  return (
    <aside aria-label="Application sidebar" className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-56 shrink-0 flex-col rounded-2xl border border-border/60 bg-card shadow-card lg:flex xl:w-60">
      <div className="flex min-h-20 shrink-0 items-center border-b border-border/60 px-5">
        <AuthBranding to="/app" label="BabyGrowth dashboard" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <AppNavigation label="Desktop navigation" />
      </div>
      <div className="shrink-0 border-t border-border/60 p-3">
        <Button variant="ghost" className="h-11 w-full justify-start gap-3 rounded-lg text-muted-foreground" onClick={onLogout} disabled={isLoggingOut}>
          {isLoggingOut ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <LogOut aria-hidden="true" />}
          {isLoggingOut ? 'Signing out...' : 'Logout'}
        </Button>
      </div>
    </aside>
  );
}
