import type { MouseEventHandler } from 'react';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AuthBranding({ to = '/', label = 'BabyGrowth home', onClick }: { to?: string; label?: string; onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <Link to={to} onClick={onClick} aria-label={label} className="inline-flex min-h-11 items-center gap-2 rounded-md font-heading text-lg font-bold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
      <Heart aria-hidden="true" className="size-8 fill-accent text-brand" strokeWidth={2.5} />
      BabyGrowth
    </Link>
  );
}
