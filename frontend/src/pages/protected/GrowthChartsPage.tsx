import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { growthApi } from '@/api/growth';
import { babyApi } from '@/api/baby';
import GrowthCharts from '@/features/growth/components/GrowthCharts';
import NewbornWeightJourneyChart from '@/features/growth/components/NewbornWeightJourneyChart';
import { useNewbornWeightJourney } from '@/features/growth/useNewbornWeightJourney';
import { ageInDays } from '@/features/dashboard/dashboardDisplay';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function GrowthChartsPage() {
  const profile = useQuery({ queryKey: ['baby.profile'], queryFn: babyApi.getBabyProfile, retry: false });
  const days = ageInDays(profile.data?.date_of_birth);
  const newborn = days !== null && days <= 30;
  const journey = useNewbornWeightJourney(profile.data, newborn && !profile.isError);
  const history = useQuery({ queryKey: ['growth.history'], queryFn: growthApi.getGrowthHistory });

  return <div className="mx-auto min-w-0 max-w-5xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Detailed Growth Charts</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{newborn ? 'An illustrative first-month journey, separate from saved visit measurements.' : 'Longitudinal visualization of actual measurement history.'}</p></div>
      <Button asChild variant="outline" className="min-h-11"><Link to="/growth">Back to Overview</Link></Button>
    </div>
    {profile.isLoading && <div role="status" aria-label="Loading birth details"><Skeleton className="h-28 w-full" /></div>}
    {profile.isError && <Alert role="status" className="rounded-xl bg-secondary/50"><AlertDescription><p>Birth details could not be loaded. Available recorded visits are shown separately below.</p><Button variant="link" className="mt-1 min-h-11 px-0" onClick={() => void profile.refetch()}>Retry birth details</Button></AlertDescription></Alert>}
    {newborn && <NewbornWeightJourneyChart journey={journey.data} isLoading={journey.isLoading} error={journey.isError} onRetry={() => void journey.refetch()} />}
    {history.isLoading ? <div role="status" aria-label="Loading recorded growth charts" className="space-y-3"><Skeleton className="h-10 w-48" /><Skeleton className="h-72 w-full" /></div>
      : history.isError ? <Alert className="rounded-xl bg-secondary/50"><AlertDescription><p>We couldn't load growth charts right now. Please try again.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void history.refetch()}>Retry recorded visits</Button></AlertDescription></Alert>
      : !history.data?.length ? <Card className="rounded-2xl border-border/50"><CardContent className="space-y-3 p-6"><h2 className="text-lg font-semibold">No measurements yet</h2><p className="text-sm leading-relaxed text-muted-foreground">{newborn ? 'There are no saved visit measurements to show. The first-month illustration uses birth details and needs no extra weight entries.' : 'Recorded visit measurements will appear here when available.'}</p>{days !== null && days > 30 && <Button asChild className="min-h-11"><Link to="/growth/add">Add Measurement</Link></Button>}</CardContent></Card>
      : <>{newborn && <div role="note" aria-label="Recorded visit source" className="rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed"><h2 className="font-semibold">Saved visit measurements</h2><p className="mt-2 text-muted-foreground">These are saved visit records, separate from the illustrative journey above. They do not identify who took or entered the measurements. No values from the illustrative curve are added to this history.</p></div>}<GrowthCharts history={history.data} detailed baby={profile.data} /></>}
  </div>;
}
