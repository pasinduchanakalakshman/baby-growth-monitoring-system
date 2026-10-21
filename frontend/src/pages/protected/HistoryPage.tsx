import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { Activity, Plus, Ruler, Scale, FileText } from 'lucide-react';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';

export default function HistoryPage() {
  const navigate = useNavigate();

  const { data: history, isLoading, error } = useQuery({
    queryKey: ['growth.history'],
    queryFn: growthApi.getGrowthHistory
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorStateUI message="We couldn't load history right now. Please try again." />;
  }

  // Backend returns ascending order. We want most recent first.
  const reversedHistory = history ? [...history].reverse() : [];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <PageHeader
        title="Measurement History"
        description="Review your child's past growth recordings."
        actions={
          <button
            onClick={() => navigate('/growth/add')}
            className="bg-btn-primary text-btn-primary-foreground hover:bg-btn-primary-hover active:bg-btn-primary-active px-4 py-2 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btn-primary"
          >
            <Plus className="h-4 w-4" />
            Add Measurement
          </button>
        }
      />

      {reversedHistory.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No measurements yet"
          description="You haven't recorded any growth measurements for your baby yet. Add your first measurement to start tracking their growth."
          action={
            <button
              onClick={() => navigate('/growth/add')}
              className="bg-btn-primary text-btn-primary-foreground hover:bg-btn-primary-hover active:bg-btn-primary-active px-6 py-2 rounded-xl font-medium transition-colors shadow-sm inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btn-primary"
            >
              <Plus className="h-4 w-4" />
              Add First Measurement
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {reversedHistory.map((meas) => (
            <div key={meas.id} className="bg-card border rounded-xl shadow-sm p-5 md:p-6 transition-all hover:shadow-md flex flex-col md:flex-row gap-6 md:items-center">
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-primary/10 text-primary p-2 rounded-full">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900">
                      {new Date(meas.visit_date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {meas.age_days !== undefined && meas.age_days !== null 
                        ? `Age: ${meas.age_days} days` 
                        : 'Age not calculated'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:flex gap-4 md:gap-8">
                <div className="bg-slate-50 p-3 rounded-lg border flex items-center gap-3 md:w-32">
                  <Scale className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Weight</p>
                    <p className="font-bold text-slate-800">{meas.weight_kg} kg</p>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-3 rounded-lg border flex items-center gap-3 md:w-40">
                  <Ruler className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Length/Height</p>
                    <p className="font-bold text-slate-800">
                      {meas.length_height_cm ? `${meas.length_height_cm} cm` : <span className="text-slate-400 font-normal italic">Not recorded</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Optional metrics section, just a summary if available */}
              {(meas.currently_breastfeeding !== null || meas.formula_feeding !== null || meas.diarrhea_last_14_days !== null) && (
                <div className="w-full md:w-auto border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 text-sm text-slate-600 flex flex-col gap-1">
                  {meas.currently_breastfeeding === true && <div>✓ Breastfed</div>}
                  {meas.formula_feeding === true && <div>✓ Formula fed</div>}
                  {meas.diarrhea_last_14_days === true && <div className="text-amber-600">⚠ Recent diarrhea</div>}
                  {meas.fever_last_14_days === true && <div className="text-amber-600">⚠ Recent fever</div>}
                  {meas.cough_last_14_days === true && <div className="text-amber-600">⚠ Recent cough</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
