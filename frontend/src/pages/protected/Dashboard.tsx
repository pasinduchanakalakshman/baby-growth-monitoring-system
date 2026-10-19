import { useAuth } from '@/auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, CalendarDays, Info, RefreshCw, Scale } from 'lucide-react';
import { babyApi } from '@/api/baby';
import { growthApi } from '@/api/growth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DashboardWelcome } from '@/features/dashboard/components/DashboardWelcome';
import { BabySummaryCard } from '@/features/dashboard/components/BabySummaryCard';
import { GrowthStatCard } from '@/features/dashboard/components/GrowthStatCard';
import { GrowthChartPreview } from '@/features/dashboard/components/GrowthChartPreview';
import { DashboardQuickActions } from '@/features/dashboard/components/DashboardQuickActions';
import { ageInDays, isRecordedWeight, shortDate } from '@/features/dashboard/dashboardDisplay';
import { useNewbornWeightJourney } from '@/features/growth/useNewbornWeightJourney';

export default function Dashboard() {
  const { user } = useAuth();
  const profile = useQuery({ queryKey: ['baby.profile'], queryFn: babyApi.getBabyProfile, staleTime: Infinity });
  const baby = profile.data;
  const days = ageInDays(baby?.date_of_birth);
  const newborn = days !== null && days <= 30;
  const journey = useNewbornWeightJourney(baby, newborn && !profile.isError);
  const overview = useQuery({ queryKey: ['growth.overview'], queryFn: growthApi.getGrowthOverview, enabled: !!baby });
  const history = useQuery({ queryKey: ['growth.history'], queryFn: growthApi.getGrowthHistory, enabled: !!baby && !newborn });
  const current = overview.data?.current_growth;
  const weight = isRecordedWeight(current?.weight_kg) ? current.weight_kg : null;
  const birthWeight = isRecordedWeight(baby?.birth_weight_kg) ? baby.birth_weight_kg : null;
  const change = weight !== null && birthWeight !== null ? weight - birthWeight : null;
  const measurementDate = shortDate(current?.visit_date);
  const loading = profile.isLoading || overview.isLoading;
  const forecast = overview.data?.forecast_30d;
  const dataError = overview.isError || (!newborn && history.isError);

  return (
    <div className="min-w-0 space-y-5">
      <DashboardWelcome name={user?.name} babyName={baby?.name} />
      <div className="grid min-w-0 grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <div className="col-span-2 min-w-0 md:col-span-3 xl:col-span-2"><BabySummaryCard baby={baby} loading={profile.isLoading} error={profile.isError} /></div>
        <GrowthStatCard title="Latest recorded weight" value={weight !== null ? weight.toFixed(2) : null} unit="kg" icon={Scale} loading={loading} description={overview.isError ? 'Weight could not be loaded' : weight !== null ? 'From a recorded visit' : 'No current measurement available'} />
        <GrowthStatCard title="Change from birth" value={change !== null ? (change > 0 ? '+' : '') + change.toFixed(2) : null} unit="kg" icon={ArrowLeftRight} loading={loading} description={change !== null ? 'Latest recorded weight minus birth weight' : 'Requires birth and recorded weights'} />
        <GrowthStatCard title="Latest measurement" value={measurementDate} icon={CalendarDays} loading={loading} description={measurementDate ? 'Recorded visit date' : 'No visit date available'} compactOnMobile className="col-span-2 md:col-span-1" />
      </div>
      {(profile.isError || dataError) && <Alert className="rounded-xl border-border/60 bg-secondary/50" role="status"><Info aria-hidden="true" className="size-4" /><AlertDescription><p>{profile.isError ? "Some baby details couldn't be loaded." : "Some growth details couldn't be loaded. Available profile and birth information are shown."}</p><Button variant="link" className="mt-1 min-h-11 gap-2 px-0" onClick={() => { if (profile.isError) void profile.refetch(); if (overview.isError) void overview.refetch(); if (history.isError) void history.refetch(); }}><RefreshCw aria-hidden="true" className="size-4" />Try again</Button></AlertDescription></Alert>}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <GrowthChartPreview baby={baby} newborn={newborn} journey={journey.data} history={history.data ?? []} loading={profile.isLoading || (newborn ? journey.isLoading : history.isLoading)} error={profile.isError || (newborn ? journey.isError : history.isError)} onRetry={() => void journey.refetch()} />
        <DashboardQuickActions newborn={newborn} olderBaby={days !== null && days > 30} hasProfile={!!baby} hasHistory={!!history.data?.length && !history.isError} forecastAvailable={forecast?.available === true && isRecordedWeight(forecast.estimated_weight_kg)} />
      </div>
      <Alert role="note" aria-label="System disclaimer" className="rounded-xl border-primary/15 bg-primary/5 py-4 text-foreground [&>svg]:text-primary">
        <Info aria-hidden="true" className="size-4" />
        <AlertDescription className="text-xs leading-relaxed sm:text-sm"><p><strong>System Disclaimer:</strong> This system provides growth estimates and risk assessments and is not a medical diagnosis. Always consult with a healthcare professional for medical advice.</p></AlertDescription>
      </Alert>
    </div>
  );
}
