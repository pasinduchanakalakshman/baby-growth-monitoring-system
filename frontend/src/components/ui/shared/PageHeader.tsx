import React, { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {description && (
          <p className="text-slate-500 mt-2 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
