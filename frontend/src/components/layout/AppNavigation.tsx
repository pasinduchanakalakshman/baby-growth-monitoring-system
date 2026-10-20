import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { appNavigation } from './navigationConfig';

export function AppNavigation({ label, onNavigate }: { label: string; onNavigate?: () => void }) {
  return (
    <nav aria-label={label} className="space-y-5">
      {appNavigation.map(group => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">{group.label}</p>
          <ul aria-label={group.label} className="space-y-1">
            {group.items.map(({ title, href, icon: Icon }) => (
              <li key={href}>
                <NavLink
                  to={href}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) => cn(
                    'relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    isActive
                      ? 'bg-primary/10 text-primary before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0" />
                  <span>{title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
