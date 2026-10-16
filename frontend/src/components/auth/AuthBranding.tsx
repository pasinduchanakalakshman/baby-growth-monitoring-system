import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AuthBranding() {
  return (
    <Link to="/" aria-label="BabyGrowth home" className="inline-flex min-h-11 items-center gap-2 rounded-md font-heading text-lg font-bold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
      <Heart aria-hidden="true" className="size-8 fill-accent text-brand" strokeWidth={2.5} />
      BabyGrowth
    </Link>
  );
}
