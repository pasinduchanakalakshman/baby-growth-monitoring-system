import type { ReactNode } from 'react';
import { ChartNoAxesCombined, Heart, NotebookPen, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthBranding } from './AuthBranding';
import { AuthIllustration } from './AuthIllustration';

const features = [
  { icon: ChartNoAxesCombined, title: 'Growth tracking', description: 'Follow weight and length over time.', surface: 'bg-accent' },
  { icon: Sparkles, title: 'Personalized insights', description: 'Explore growth forecasts and risk insights.', surface: 'bg-secondary' },
  { icon: NotebookPen, title: 'Your baby’s growth story', description: 'Keep measurements together in one place.', surface: 'bg-brand/10' },
];

export function AuthLayout({ children, mode = 'login' }: { children: ReactNode; mode?: 'login' | 'register' }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col bg-background text-foreground lg:p-4 xl:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden lg:inset-4 lg:rounded-2xl xl:inset-6">
        <div className="absolute inset-0 bg-card/60" />
        <div className="absolute -top-48 right-0 h-80 w-[90%] rotate-12 rounded-[50%] bg-secondary" />
        <div className="absolute right-0 bottom-0 h-3/4 w-2/3 rounded-tl-[70%] bg-accent/50" />
        <div className="absolute -bottom-56 -left-36 size-[32rem] rounded-full bg-brand/5" />
      </div>

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-5 sm:px-10 lg:px-12 lg:py-6">
        <AuthBranding />
        <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm sm:flex">
          <Link to="/" className="inline-flex min-h-11 items-center rounded-md hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Home</Link>
          {mode === 'register' ? (
            <>
              <span aria-current="page" className="inline-flex min-h-11 items-center font-medium text-primary">Create Account</span>
              <Link to="/login" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-6 py-2.5 text-primary-foreground shadow-control hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Sign In</Link>
            </>
          ) : (
            <>
              <Link to="/register" className="inline-flex min-h-11 items-center rounded-md hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Create Account</Link>
              <span aria-current="page" className="rounded-lg bg-primary px-6 py-2.5 text-primary-foreground shadow-control">Sign In</span>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 items-start gap-8 px-5 pt-6 pb-12 sm:px-10 sm:pt-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:px-12 lg:pt-0 lg:pb-10">
        <section aria-labelledby="auth-welcome" className="relative hidden h-full min-h-[36rem] items-start gap-4 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="relative z-10 min-w-0 self-start pt-16 xl:pt-20">
            <h1 id="auth-welcome" className="auth-heading font-bold">
              Every<br />Little Moment<br /><span className="text-primary">Matters</span>{' '}
              <Heart aria-hidden="true" className="inline size-8 fill-accent text-brand/70" />
            </h1>
            <p className="mt-5 max-w-64 text-sm leading-relaxed text-foreground/85">
              Track your baby's growth, get insights, and support their healthy development with confidence.
            </p>
            <ul className="mt-8 space-y-5">
              {features.map(({ icon: Icon, title, description, surface }) => (
                <li key={title} className="flex items-center gap-3">
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-full text-primary ${surface}`}>
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 self-start pt-16 xl:pt-20">
            <AuthIllustration />
          </div>
        </section>
        <div className="relative z-10 mx-auto w-full max-w-auth lg:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
