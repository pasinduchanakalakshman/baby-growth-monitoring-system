import type { ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main id="app-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-content flex-1 scroll-mt-24 px-4 py-6 focus:outline-none md:px-6 lg:mt-4">
      {children}
    </main>
  );
}
