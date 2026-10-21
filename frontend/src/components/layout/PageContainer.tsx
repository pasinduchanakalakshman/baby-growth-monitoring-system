import type { ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main id="app-content" tabIndex={-1} className="relative isolate mx-auto w-full min-w-0 max-w-content flex-1 scroll-mt-24 px-4 py-6 focus:outline-none md:px-6 lg:mt-4">
      <div aria-hidden="true" className="app-content-background pointer-events-none absolute inset-0 -z-10 overflow-hidden lg:rounded-2xl">
        <div className="absolute inset-0 bg-card/60" />
        <div className="absolute -top-48 right-0 h-80 w-[90%] rotate-12 rounded-[50%] bg-secondary" />
        <div className="absolute right-0 bottom-0 h-2/3 w-1/2 rounded-tl-[70%] bg-accent/50 sm:h-3/4 sm:w-2/3" />
        <div className="absolute -bottom-56 -left-36 size-96 rounded-full bg-brand/5 sm:size-[32rem]" />
      </div>
      {children}
    </main>
  );
}
