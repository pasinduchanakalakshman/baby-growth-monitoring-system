import { Baby, CalendarDays, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { BabyProfile } from '@/types/baby';
import { babyAgeLabel, isRecordedWeight, shortDate } from '../dashboardDisplay';

export function BabySummaryCard({ baby, loading, error }: { baby?: BabyProfile; loading: boolean; error: boolean }) {
  const born = shortDate(baby?.date_of_birth);
  return (
    <Card className="h-full min-w-0 rounded-2xl border-border/40">
      <CardContent className="flex h-full items-center gap-4 p-5">
        <div aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent md:size-20"><Baby className="size-9 text-primary" strokeWidth={1.5} /></div>
        <div className="min-w-0 flex-1">
          {loading ? <div role="status" aria-label="Loading baby profile" className="space-y-2"><Skeleton className="h-5 w-28" /><Skeleton className="h-4 w-36 max-w-full" /><Skeleton className="h-10 w-28" /></div> : <>
            <h2 className="break-words text-lg font-semibold">{baby?.name?.trim() || 'Baby Profile'}</h2>
            {baby ? <>
              <p className="mt-1 text-sm font-medium text-primary">{babyAgeLabel(baby.date_of_birth)}</p>
              <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><CalendarDays aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{born ? `Born ${born}` : 'Birth date unavailable'}</p>
              <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><Scale aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />Birth weight: {isRecordedWeight(baby.birth_weight_kg) ? `${baby.birth_weight_kg.toFixed(2)} kg` : 'Not recorded'}</p>
            </> : <p className="mt-1 text-sm text-muted-foreground">{error ? "We couldn't load your baby's profile." : 'Baby details are not available.'}</p>}
            <Button asChild variant="secondary" className="mt-3 min-h-11 rounded-full bg-accent px-5 text-primary hover:bg-accent/70"><Link to="/baby">View Profile</Link></Button>
          </>}
        </div>
      </CardContent>
    </Card>
  );
}
