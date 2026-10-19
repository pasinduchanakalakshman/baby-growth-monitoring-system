import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { AuthenticatedUser } from '@/types/auth';
import { MobileNavigation } from './MobileNavigation';

type AppHeaderProps = {
  title: string;
  user: AuthenticatedUser | null;
  onLogout: () => void;
  isLoggingOut: boolean;
};

export function AppHeader({ title, user, onLogout, isLoggingOut }: AppHeaderProps) {
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('');

  return (
    <header aria-label="Application header" className="sticky top-0 z-30 flex min-h-20 min-w-0 items-center gap-3 border-b border-border/60 bg-card px-4 py-3 md:px-6 lg:top-4 lg:rounded-2xl lg:border lg:shadow-card">
      <MobileNavigation onLogout={onLogout} isLoggingOut={isLoggingOut} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground lg:hidden">BabyGrowth</p>
        <p aria-label="Current page" className="truncate font-heading text-lg font-semibold text-foreground lg:text-xl">{title}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-11 shrink-0 gap-2 rounded-lg px-1.5 sm:px-3" aria-label="Open account menu">
            <Avatar aria-hidden="true" className="size-9">
              <AvatarFallback className="bg-accent text-sm font-semibold text-primary">{initials || <UserRound className="size-4" />}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-32 truncate text-sm font-medium md:inline">{user?.name || 'Account'}</span>
            <ChevronDown aria-hidden="true" className="hidden sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-64 max-w-[calc(100vw-2rem)] rounded-xl border-border/60 p-2 shadow-card motion-reduce:animate-none">
          <DropdownMenuLabel className="px-3 py-2">
            <p className="break-words font-semibold">{user?.name || 'Your account'}</p>
            {user?.email && <p className="mt-1 break-all text-xs font-normal text-muted-foreground">{user.email}</p>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="min-h-11 cursor-pointer rounded-lg px-3 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <Link to="/account"><Settings aria-hidden="true" />Account</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onLogout} disabled={isLoggingOut} className="min-h-11 cursor-pointer rounded-lg px-3 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <LogOut aria-hidden="true" />{isLoggingOut ? 'Signing out...' : 'Logout'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
