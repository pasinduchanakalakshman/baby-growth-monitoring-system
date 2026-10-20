import { useRef, useState } from 'react';
import { LogOut, Menu } from 'lucide-react';
import { AuthBranding } from '@/components/auth/AuthBranding';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AppNavigation } from './AppNavigation';

export function MobileNavigation({ onLogout, isLoggingOut }: { onLogout: () => void; isLoggingOut: boolean }) {
  const [open, setOpen] = useState(false);
  const navigating = useRef(false);

  const navigateAndClose = () => { navigating.current = true; setOpen(false); };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-lg lg:hidden" aria-label="Open application navigation">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-modal="true"
        className="flex w-[85vw] max-w-xs flex-col gap-0 rounded-r-2xl bg-card p-0 motion-reduce:animate-none motion-reduce:transition-none [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:opacity-100"
        onCloseAutoFocus={event => {
          if (navigating.current) {
            event.preventDefault();
            navigating.current = false;
            const content = document.getElementById('app-content');
            content?.focus({ preventScroll: true });
            content?.scrollIntoView({ block: 'start' });
          }
        }}
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-5 pt-16 pb-5 text-left">
          <AuthBranding to="/app" label="BabyGrowth dashboard" onClick={navigateAndClose} />
          <SheetTitle className="sr-only">BabyGrowth navigation</SheetTitle>
          <SheetDescription className="text-xs">Your baby's growth, all in one place.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <AppNavigation label="Mobile navigation" onNavigate={navigateAndClose} />
        </div>
        <div className="shrink-0 border-t border-border/60 p-3">
          <Button variant="ghost" className="h-11 w-full justify-start gap-3 rounded-lg text-muted-foreground" disabled={isLoggingOut} onClick={() => { setOpen(false); onLogout(); }}>
            <LogOut aria-hidden="true" />
            Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
