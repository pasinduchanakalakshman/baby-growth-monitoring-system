import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function GrowthStatCard({ title, value, unit, description, icon: Icon, loading, compactOnMobile = false, className = '' }: {
  title: string; value: string | null; unit?: string; description: string; icon: LucideIcon; loading: boolean; compactOnMobile?: boolean; className?: string;
}) {
  return (
    <Card className={`min-w-0 rounded-2xl border-border/40 ${className}`}>
      <CardContent className={compactOnMobile ? 'relative h-full py-4 pr-4 pl-16 text-left md:flex md:flex-col md:items-center md:p-5 md:text-center' : 'flex h-full flex-col items-center p-4 text-center sm:p-5'}>
        <span aria-hidden="true" className={`flex size-8 items-center justify-center rounded-full bg-secondary ${compactOnMobile ? 'absolute top-5 left-5 md:static md:mb-3' : 'mb-3'}`}><Icon className="size-4 text-primary" /></span>
        <h2 className="text-xs font-medium leading-relaxed text-muted-foreground">{title}</h2>
        {loading ? <div role="status" aria-label={`Loading ${title.toLowerCase()}`} className="mt-3 space-y-2"><Skeleton className="h-7 w-20" /><Skeleton className="h-3 w-24" /></div> : <>
          <p className={`mt-2 break-words font-semibold text-primary ${value ? compactOnMobile ? 'text-lg tracking-tight md:text-2xl' : 'text-xl tracking-tight sm:text-2xl' : 'text-base'}`}>{value ?? 'Not recorded'}{value && unit && <>{' '}<span className="text-sm font-medium text-foreground">{unit}</span></>}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </>}
      </CardContent>
    </Card>
  );
}
