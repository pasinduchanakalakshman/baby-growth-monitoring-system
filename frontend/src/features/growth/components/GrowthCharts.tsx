import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, TooltipProps
} from 'recharts';
import { GrowthHistoryPoint } from '@/types/growth';
import { formatCalendarDate } from '@/utils/growthDisplay';

interface GrowthChartsProps {
  history: GrowthHistoryPoint[];
}

// Custom tooltip renderer to safely display dates and values
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as GrowthHistoryPoint;
    const value = payload[0].value;
    const dataKey = payload[0].dataKey;
    
    let unit = '';
    let labelText = '';
    
    if (dataKey === 'weight_kg') { unit = 'kg'; labelText = 'Weight'; }
    if (dataKey === 'length_height_cm') { unit = 'cm'; labelText = 'Length/Height'; }
    if (dataKey === 'verified_waz') { unit = 'Z-score'; labelText = 'Weight-for-Age'; }
    if (dataKey === 'verified_haz') { unit = 'Z-score'; labelText = 'Length/Height-for-Age'; }
    
    return (
      <div className="bg-white border shadow-md p-3 rounded-md text-sm">
        <p className="font-semibold text-slate-700 mb-1">{formatCalendarDate(data?.visit_date)}</p>
        <p className="text-primary font-medium">
          {labelText}: {value !== undefined && value !== null ? Number(value).toFixed(2) : 'N/A'} {unit}
        </p>
      </div>
    );
  }
  return null;
};

export default function GrowthCharts({ history }: GrowthChartsProps) {
  const [activeTab, setActiveTab] = useState<'weight' | 'height' | 'waz' | 'haz'>('weight');

  // Chart requires ascending chronological order for proper line drawing
  const chartData = [...history].sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime());

  // Filter out data points that don't have the required value
  const heightData = chartData.filter(d => d.length_height_cm !== null && d.length_height_cm !== undefined);
  const hazData = chartData.filter(d => d.verified_haz !== null && d.verified_haz !== undefined);

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
      <div className="px-4 py-4 border-b flex items-center justify-between overflow-x-auto gap-2">
        <h3 className="font-semibold whitespace-nowrap hidden sm:block mr-4">Growth Charts</h3>
        <div className="flex gap-2 min-w-max">
          <button 
            onClick={() => setActiveTab('weight')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'weight' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Weight
          </button>
          <button 
            onClick={() => setActiveTab('height')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'height' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Length / Height
          </button>
          <button 
            onClick={() => setActiveTab('waz')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'waz' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            WAZ
          </button>
          <button 
            onClick={() => setActiveTab('haz')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'haz' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            HAZ
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 w-full h-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="visit_date" 
              tickFormatter={(val) => {
                const parts = val.split('-');
                if (parts.length === 3) {
                  return `${parts[1]}/${parts[2]}`; // MM/DD
                }
                return val;
              }}
              allowDuplicatedCategory={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickMargin={10}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#64748b' }} 
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {activeTab === 'weight' && (
              <Line 
                data={chartData}
                type="monotone" 
                dataKey="weight_kg" 
                stroke="var(--color-primary, #0f172a)" 
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                name="Weight (kg)"
                connectNulls={false} // Never interpolate missing visits
              />
            )}

            {activeTab === 'height' && (
              <>
                {heightData.length === 0 ? (
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#64748b">
                    No length/height data recorded yet.
                  </text>
                ) : (
                  <Line 
                    data={heightData}
                    type="monotone" 
                    dataKey="length_height_cm" 
                    stroke="var(--color-primary, #0f172a)" 
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                    name="Length/Height (cm)"
                    connectNulls={false} // Missing height remains missing
                  />
                )}
              </>
            )}

            {activeTab === 'waz' && (
              <>
                <ReferenceLine y={-2} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'WHO -2', fill: '#f59e0b', fontSize: 12 }} />
                <ReferenceLine y={-3} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: 'WHO -3', fill: '#ef4444', fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#22c55e" strokeOpacity={0.3} />
                <Line 
                  data={chartData}
                  type="monotone" 
                  dataKey="verified_waz" 
                  stroke="var(--color-primary, #0f172a)" 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  name="Weight-for-Age (Z-score)"
                  connectNulls={false} // Never invent z-scores
                />
              </>
            )}

            {activeTab === 'haz' && (
              <>
                {hazData.length === 0 ? (
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#64748b">
                    No HAZ available (requires length/height).
                  </text>
                ) : (
                  <>
                    <ReferenceLine y={-2} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'WHO -2', fill: '#f59e0b', fontSize: 12 }} />
                    <ReferenceLine y={-3} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: 'WHO -3', fill: '#ef4444', fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="#22c55e" strokeOpacity={0.3} />
                    <Line 
                      data={hazData}
                      type="monotone" 
                      dataKey="verified_haz" 
                      stroke="var(--color-primary, #0f172a)" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                      name="Length/Height-for-Age (Z-score)"
                      connectNulls={false}
                    />
                  </>
                )}
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
