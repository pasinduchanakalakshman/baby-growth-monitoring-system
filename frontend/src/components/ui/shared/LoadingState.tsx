import React from 'react';

interface LoadingStateProps {
  testId?: string;
}

export function LoadingState({ testId = "loading-state" }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center p-12 min-h-[50vh]" data-testid={testId}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
