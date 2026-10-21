import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChartNoAxesCombined, Heart, Menu, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { AuthBranding } from '@/components/auth/AuthBranding';
import { AuthIllustration } from '@/components/auth/AuthIllustration';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const currentYear = new Date().getFullYear();

const features = [
  {
    icon: ChartNoAxesCombined,
    title: 'Growth tracking',
    description: "Record your baby's weight and length, and see how they're growing over time.",
    surface: 'bg-accent',
  },
  {
    icon: TrendingUp,
    title: 'Growth predictions',
    description: "Get a glimpse of your baby's possible growth over the next 30 days.",
    surface: 'bg-secondary',
  },
  {
    icon: UtensilsCrossed,
    title: 'Nutrition & Feeding',
    description: 'Get appropriate feeding guidance and discover healthy meal ideas as your baby grows.',
    surface: 'bg-brand/10',
  },
];

const navigationLink = 'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring';

export default function LandingPage() {
  const aboutFromMenu = useRef(false);

  return (
    <div className="relative isolate min-h-dvh bg-background text-foreground md:p-4 xl:p-6">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-6 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-3 focus:text-primary focus:shadow-card focus:outline-2 focus:outline-ring">
        Skip to content
      </a>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[48rem] overflow-hidden md:inset-x-4 md:top-4 md:h-[42rem] md:rounded-2xl xl:inset-x-6 xl:top-6 xl:h-[46rem]">
        <div className="absolute inset-0 auth-decoration opacity-50" />
        <div className="absolute -top-48 right-0 h-80 w-[90%] rotate-12 rounded-[50%] bg-secondary" />
        <div className="absolute right-0 bottom-0 h-3/4 w-1/2 rounded-tl-[70%] bg-accent/50" />
        <div className="absolute -bottom-56 -left-36 size-[32rem] rounded-full bg-brand/5" />
      </div>

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-6 py-5 sm:px-10 lg:px-12 lg:py-6">
        <AuthBranding />
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-3 md:gap-5">
          <Link to="/" aria-current="page" className={cn(navigationLink, 'hidden text-primary md:inline-flex')}>Home</Link>
          <a href="#about" className={cn(navigationLink, 'hidden md:inline-flex')}>About</a>
          <Link to="/login" className={navigationLink}>Sign In</Link>
          <Button asChild size="lg" className="hidden rounded-lg px-5 md:inline-flex">
            <Link to="/register">Create Account</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 rounded-lg md:hidden" aria-label="Open navigation">
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              aria-modal="true"
              className="w-[85vw] max-w-sm overflow-y-auto rounded-l-2xl bg-card pt-20 motion-reduce:animate-none motion-reduce:transition-none [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:opacity-100"
              onCloseAutoFocus={event => {
                if (aboutFromMenu.current) {
                  event.preventDefault();
                  aboutFromMenu.current = false;
                  const about = document.getElementById('about');
                  about?.focus({ preventScroll: true });
                  about?.scrollIntoView({ block: 'start' });
                }
              }}
            >
              <SheetHeader className="text-left">
                <SheetTitle>BabyGrowth navigation</SheetTitle>
                <SheetDescription>Find out about BabyGrowth or access your account.</SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="mt-8 flex flex-col gap-3">
                <SheetClose asChild><Link to="/" aria-current="page" className={`${navigationLink} text-primary`}>Home</Link></SheetClose>
                <SheetClose asChild><a href="#about" className={navigationLink} onClick={() => { aboutFromMenu.current = true; }}>About</a></SheetClose>
                <SheetClose asChild><Link to="/login" className={navigationLink}>Sign In</Link></SheetClose>
                <Button asChild size="lg" className="mt-3 w-full rounded-lg">
                  <SheetClose asChild><Link to="/register">Create Account</Link></SheetClose>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <section aria-labelledby="welcome-heading" className="mx-auto grid w-full max-w-7xl items-center gap-6 px-6 pt-4 pb-12 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:gap-8 sm:px-10 sm:pt-8 sm:pb-14 lg:px-12 lg:pt-10 lg:pb-16">
          <div className="order-2 min-w-0 text-center sm:order-1 sm:text-left">
            <h1 id="welcome-heading" className="auth-heading font-bold">
              Every{' '}<br />Little Moment{' '}<br /><span className="text-primary">Matters</span>{' '}
              <Heart aria-hidden="true" className="inline size-7 fill-accent text-brand sm:size-8" />
            </h1>
            <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-foreground/85 sm:mx-0">
              Track your baby's growth, get insights, and support their healthy development with confidence.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="h-12 rounded-lg px-7">
                <Link to="/register">Create Account <ArrowRight aria-hidden="true" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-lg px-7">
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
          <div className="relative isolate order-1 mx-auto w-32 sm:order-2 sm:w-full sm:max-w-60 lg:max-w-80 xl:max-w-96">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-8 bottom-2 -z-10 rounded-[48%_52%_46%_54%] bg-accent/70" />
            <AuthIllustration />
          </div>
        </section>

        <section id="about" aria-labelledby="features-heading" tabIndex={-1} className="mx-auto w-full max-w-7xl scroll-mt-6 px-6 py-10 focus:outline-none sm:px-10 sm:py-12 lg:px-12">
          <div className="mx-auto max-w-xl text-center">
            <h2 id="features-heading" className="page-heading">A clearer picture of your baby's growth</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Keep measurements, estimated growth, and past visits together in one place.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description, surface }) => (
              <Card key={title} className="min-w-0 rounded-2xl border-card shadow-card">
                <CardHeader className="space-y-0 pb-3">
                  <span className={`mb-5 flex size-11 items-center justify-center rounded-full text-primary ${surface}`}>
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <CardTitle><h3 className="text-base leading-snug font-semibold">{title}</h3></CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-7xl px-6 pb-4 sm:px-10 lg:px-12">
        <Separator />
        <div className="flex flex-col items-center justify-between gap-2 py-5 text-sm sm:flex-row sm:gap-4">
          <p className="text-center text-muted-foreground">&copy; {currentYear} BabyGrowth. Every little moment matters.</p>
        </div>
      </footer>
    </div>
  );
}
