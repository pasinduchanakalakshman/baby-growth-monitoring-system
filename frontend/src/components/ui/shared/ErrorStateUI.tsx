import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorStateUIProps {
  message: string;
  testId?: string;
}

export function ErrorStateUI({ message, testId = "error-state" }: ErrorStateUIProps) {
  return (
    <div className="p-4 max-w-4xl mx-auto" data-testid={testId}>
      <div className="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 flex gap-3 shadow-sm">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}
