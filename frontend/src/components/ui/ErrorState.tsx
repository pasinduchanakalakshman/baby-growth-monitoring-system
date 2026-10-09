import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function ErrorState({ message = 'Something went wrong' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-full">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Error</h3>
      <p className="text-slate-500 text-sm max-w-sm">{message}</p>
    </div>
  );
}
