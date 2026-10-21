import { useAuth } from '@/auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { babyApi } from '@/api/baby';
import { growthApi } from '@/api/growth';
import { DashboardWelcome } from '@/features/dashboard/components/DashboardWelcome';
import { BabySummaryCard } from '@/features/dashboard/components/BabySummaryCard';
import { GrowthChartPreview } from '@/features/dashboard/components/GrowthChartPreview';
import { isRecordedWeight, shortDate } from '@/features/dashboard/dashboardDisplay';

export default function Dashboard() {
  const { user } = useAuth();
  const profile = useQuery({ queryKey: ['baby.profile'], queryFn: babyApi.getBabyProfile, staleTime: Infinity });
  const baby = profile.data;
  const overview = useQuery({ queryKey: ['growth.overview'], queryFn: growthApi.getGrowthOverview, enabled: !!baby });
  const history = useQuery({ queryKey: ['growth.history'], queryFn: growthApi.getGrowthHistory, enabled: !!baby });
  const current = overview.data?.current_growth;
  const weight = isRecordedWeight(current?.weight_kg) ? current.weight_kg : null;
  const birthWeight = isRecordedWeight(baby?.birth_weight_kg) ? baby.birth_weight_kg : null;
  const change = weight !== null && birthWeight !== null ? weight - birthWeight : null;
  const measurementDate = shortDate(current?.visit_date);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5">
      <DashboardWelcome name={user?.name} />
      <BabySummaryCard
        baby={baby} loading={profile.isLoading} error={profile.isError}
        growthLoading={profile.isLoading || overview.isLoading} growthError={overview.isError}
        weight={weight} change={change} measurementDate={measurementDate}
        onRetry={() => { if (profile.isError) void profile.refetch(); if (overview.isError) void overview.refetch(); }}
      />
      <GrowthChartPreview
        baby={baby} history={history.data ?? []}
        loading={profile.isLoading || history.isLoading} error={profile.isError || history.isError}
        onRetry={() => { if (profile.isError) void profile.refetch(); else void history.refetch(); }}
      />
      <aside role="note" aria-label="System disclaimer" className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>BabyGrowth provides growth monitoring estimates and is not a medical diagnosis. Consult a healthcare professional for medical advice.</p>
      </aside>
    </div>
  );
}
