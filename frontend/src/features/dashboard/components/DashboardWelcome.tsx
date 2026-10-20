import { Baby, Heart, Sparkles } from 'lucide-react';

export function DashboardWelcome({ name, babyName }: { name?: string; babyName?: string }) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-secondary px-5 py-6 sm:px-7 sm:py-7">
      <div className="relative z-10 pr-20 sm:pr-52">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">A LITTLE GROWTH, A LOT OF LOVE</p>
        <h1 className="break-words font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{name?.trim() ? `Welcome, ${name.trim()}!` : 'Welcome back!'}</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-foreground/80">Monitor {babyName?.trim() || 'your baby'}'s growth, one little moment at a time.</p>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-20 sm:w-56">
        <div className="absolute -right-7 -bottom-12 size-32 rounded-full bg-card/70 sm:-bottom-16 sm:size-56" />
        <div className="absolute right-3 bottom-4 flex size-16 items-center justify-center rounded-full bg-accent sm:right-12 sm:bottom-4 sm:size-28"><Baby className="size-11 text-primary sm:size-20" strokeWidth={1.25} /></div>
        <Heart className="absolute top-6 right-5 size-4 fill-accent text-primary/50 sm:right-8 sm:size-6" />
        <Sparkles className="absolute top-5 left-3 hidden size-5 text-primary/50 sm:block" />
        <div className="absolute right-2 bottom-3 size-6 rounded-full bg-card sm:right-7 sm:size-10" />
        <div className="absolute -right-2 bottom-1 h-6 w-16 rounded-full bg-card sm:w-24" />
      </div>
    </section>
  );
}
