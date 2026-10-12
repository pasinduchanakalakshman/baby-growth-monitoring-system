import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { Activity, TrendingUp } from 'lucide-react';
import { formatCalendarDate } from '@/utils/growthDisplay';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';
import { ResearchDisclaimer } from '@/components/ui/shared/ResearchDisclaimer';
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

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorStateUI message="We couldn't load the risk trajectory right now. Please try again." />;
  }

  const validPoints = trajectory?.filter(p => p.risk_probability !== null && p.risk_probability !== undefined) || [];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <PageHeader
        title="Risk History"
        description="Track how the model-estimated probability changed as genuine visits were added over time."
      />

      {validPoints.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Not enough genuine risk assessments available."
          description="Measurements must be added over time to generate a trajectory."
        />
      ) : (
        <div className="bg-white border rounded-xl shadow-sm p-6" data-testid="trajectory-chart-container">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">
            Probability Trajectory
          </h3>

          <div className="h-80 w-full mt-4">
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
                  tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                  stroke="#94A3B8" 
                  fontSize={12} 
                />
                <Tooltip 
                  formatter={(value: any) => [`${(Number(value) * 100).toFixed(1)}%`, 'Probability']}
                  labelFormatter={(label: any) => formatCalendarDate(label)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                
                {modelInfo?.Risk?.threshold && (
                  <ReferenceLine y={modelInfo.Risk.threshold} stroke="#F59E0B" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Threshold', fill: '#F59E0B', fontSize: 12 }} />
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

          <div className="mt-8 text-sm text-slate-500 space-y-2">
            <p className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
              <span>Each point represents the model's estimated risk at the time of a <strong>genuine recorded visit</strong>.</span>
            </p>
          </div>
        </div>
      )}
      <ResearchDisclaimer />
    </div>
  );
}
