import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { Activity } from 'lucide-react';
import { formatCalendarDate } from '@/utils/growthDisplay';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';
import { ResearchDisclaimer } from '@/components/ui/shared/ResearchDisclaimer';
import { calendarDate } from '@/features/dashboard/dashboardDisplay';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

export default function RiskHistoryPage() {
  const { data: trajectory, isLoading, error } = useQuery({
    queryKey: ['risk.trajectory'],
    queryFn: growthApi.getRiskTrajectory
  });

  const { data: modelInfo } = useQuery({
    queryKey: ['model.info'],
    queryFn: growthApi.getModelInfo
  });

  const validPoints = (trajectory ?? []).flatMap(point => {
    const date = calendarDate(point.visit_date);
    return date && typeof point.risk_probability === 'number' && Number.isFinite(point.risk_probability)
      && point.risk_probability >= 0 && point.risk_probability <= 1
      ? [{ ...point, chartTime: Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) }] : [];
  }).sort((a, b) => a.chartTime - b.chartTime);
  const threshold = modelInfo?.Risk?.threshold;
  const hasThreshold = typeof threshold === 'number' && Number.isFinite(threshold) && threshold >= 0 && threshold <= 1;

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorStateUI message="We couldn't load the risk trajectory right now. Please try again." />;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <PageHeader
        title="Risk History"
        description="Track how the growth-faltering risk score changed as genuine visits were added over time."
      />

      {validPoints.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Not enough genuine risk assessments available."
          description="Measurements must be added over time to generate a trajectory."
        />
      ) : (
        <div className="bg-white border rounded-xl shadow-sm p-6" data-testid="trajectory-chart-container">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Growth-Faltering Risk Score Trajectory</h3>
            {hasThreshold && <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"><span aria-hidden="true" className="w-6 border-t-2 border-dashed border-amber-600" />Threshold ({threshold.toFixed(3)})</span>}
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500"><span aria-hidden="true" className="size-2 rounded-full bg-blue-500" />Recorded risk score</p>
          <div className="mt-4 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={validPoints} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="visit_date"
                  tickFormatter={formatCalendarDate}
                  stroke="#94A3B8" 
                  fontSize={12} 
                  tickMargin={10} 
                />
                <YAxis 
                  domain={[0, 1]} 
                  tickFormatter={(val) => Number(val).toFixed(2)}
                  stroke="#94A3B8" 
                  fontSize={12} 
                />
                <Tooltip 
                  formatter={(value: any) => [Number(value).toFixed(3), 'Risk Score']}
                  labelFormatter={(label: any) => formatCalendarDate(label)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                
                {hasThreshold && (
                  <ReferenceLine 
                    y={threshold}
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                )}

                <Line 
                  type="monotone" 
                  dataKey="risk_probability" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#2563EB" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
      <ResearchDisclaimer />
    </div>
  );
}
