import { Baby } from 'lucide-react';

export function DashboardWelcome({ name }: { name?: string }) {
  return (
    <section className="flex min-w-0 items-center justify-between gap-4 rounded-2xl bg-secondary px-5 py-5 sm:px-6">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{name?.trim() ? `Welcome back, ${name.trim()}!` : 'Welcome back!'}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Here's your baby's growth journey.</p>
      </div>
      <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card/70 sm:size-14">
        <Baby className="size-8 text-primary" strokeWidth={1.5} />
      </div>
    </section>
  );
}
