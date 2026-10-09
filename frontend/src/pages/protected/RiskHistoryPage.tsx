import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { Activity, AlertCircle, TrendingUp } from 'lucide-react';
import { formatCalendarDate } from '@/utils/growthDisplay';
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
    return (
      <div className="flex items-center justify-center p-12" data-testid="loading-state">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto" data-testid="error-state">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md border border-destructive/20 flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Failed to load risk trajectory. Please try again.</p>
        </div>
      </div>
    );
  }

  const validPoints = trajectory?.filter(p => p.risk_probability !== null && p.risk_probability !== undefined) || [];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Risk History</h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Track how the model-estimated probability changed as genuine visits were added over time.
        </p>
      </div>

      {validPoints.length === 0 ? (
        <div className="bg-card border rounded-xl shadow-sm p-12 text-center" data-testid="no-data-state">
          <div className="flex justify-center mb-4">
            <Activity className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Not enough genuine risk assessments available.</h3>
        </div>
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
            <p className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
              <span>This trajectory shows past risk predictions, not actual clinical outcomes.</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
