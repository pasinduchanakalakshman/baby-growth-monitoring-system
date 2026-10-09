import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  testId?: string;
}

export function EmptyState({ icon: Icon, title, description, action, testId = "no-data-state" }: EmptyStateProps) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-12 text-center" data-testid={testId}>
      <div className="flex justify-center mb-4">
        <Icon className="h-12 w-12 text-slate-300" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="text-slate-500 mt-2 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  );
}
