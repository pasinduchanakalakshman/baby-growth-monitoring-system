import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { Baby, CalendarDays, Weight, Ruler, Activity, Loader2, type LucideIcon } from 'lucide-react';
import { babyApi } from '@/api/baby';

const notProvided = 'Not provided';

function profileValue(value: unknown, unit?: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return unit ? `${value} ${unit}` : String(value);
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return notProvided;
}

function birthDate(value: string): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  // Treat a date of birth as a local calendar date, never as a UTC timestamp.
  const date = new Date(`${value}T00:00:00`);
  const [year, month, day] = value.split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function currentAge(born: Date | null, today: Date): string {
  if (!born || born > today) return notProvided;
  let months = (today.getFullYear() - born.getFullYear()) * 12 + today.getMonth() - born.getMonth();
  // Month-end birthdays fall on the last day of a shorter month.
  const anniversaryDay = Math.min(born.getDate(), new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
  if (today.getDate() < anniversaryDay) months -= 1;

  if (months === 0) {
    const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(born.getFullYear(), born.getMonth(), born.getDate())) / 86400000);
    return `${days} ${days === 1 ? 'day' : 'days'} old`;
  }
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts = [];
  if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (remainingMonths) parts.push(`${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`);
  return `${parts.join(', ')} old`;
}

function BirthDetail({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl bg-background/70 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 text-primary">
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 space-y-1">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="text-base font-semibold leading-relaxed text-foreground [overflow-wrap:anywhere]">{value}</dd>
      </div>
    </div>
  );
}

export default function BabyProfilePage() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const nextDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const timer = window.setTimeout(() => setToday(new Date()), Math.max(0, nextDay.getTime() - Date.now()) + 50);
    const refreshDate = () => {
      if (document.visibilityState === 'visible') setToday(new Date());
    };
    document.addEventListener('visibilitychange', refreshDate);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshDate);
    };
  }, [today]);

  const { data: baby, isLoading, error } = useQuery({
    queryKey: ['baby.profile'],
    queryFn: babyApi.getBabyProfile,
    retry: false
  });

  if (isLoading) {
    return (
      <div role="status" className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-8 animate-spin text-primary motion-reduce:animate-none" />
        <p className="text-sm">Loading your baby's profile...</p>
      </div>
    );
  }

  if (error || !baby) {
    return (
      <div role="status" className="flex h-64 flex-col items-center justify-center px-4 text-center text-muted-foreground">
        <Baby aria-hidden="true" className="mb-4 size-12 text-primary/50" />
        <p>We couldn't load your baby's profile.</p>
        <p className="mt-2 text-sm">Please try again later.</p>
      </div>
    );
  }

  const born = birthDate(baby.date_of_birth);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
      <PageHeader title="Baby Profile" description="Your little one's information, all in one place." />

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="flex min-w-0 flex-col rounded-2xl shadow-sm lg:justify-center">
          <CardHeader className="items-center px-6 pb-5 pt-7 text-center">
            <div aria-hidden="true" className="mb-4 flex size-20 items-center justify-center rounded-full bg-primary/10 ring-8 ring-primary/5">
              <Baby className="size-10 text-primary" strokeWidth={1.5} />
            </div>
            <CardTitle className="w-full">
              <h2 className="text-2xl font-semibold leading-snug [overflow-wrap:anywhere]">{profileValue(baby.name)}</h2>
            </CardTitle>
            <CardDescription className="text-sm">
              Biological sex <span className="mx-1" aria-hidden="true">&middot;</span> <span className="font-medium text-foreground">{profileValue(baby.sex)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <dl className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-center">
              <dt className="text-sm font-medium text-muted-foreground">Current Age</dt>
              <dd className="mt-2 text-xl font-semibold leading-snug text-primary">{currentAge(born, today)}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl shadow-sm">
          <CardHeader className="pb-5">
            <CardTitle><h2 className="text-xl font-semibold leading-snug">Birth Information</h2></CardTitle>
            <CardDescription>Important details about your baby's birth.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <BirthDetail label="Date of Birth" value={born?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? notProvided} icon={CalendarDays} />
              <BirthDetail label="Birth Weight" value={profileValue(baby.birth_weight_kg, 'kg')} icon={Weight} />
              <BirthDetail label="Birth Length" value={profileValue(baby.birth_length_cm, 'cm')} icon={Ruler} />
              <BirthDetail label="Gestational Age" value={profileValue(baby.gestational_age_weeks, 'weeks')} icon={Activity} />
            </dl>

            <section aria-labelledby="additional-birth-details" className="border-t border-border/60 pt-5">
              <h3 id="additional-birth-details" className="mb-4 text-sm font-semibold text-foreground">Additional Birth Details</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-1">
                  <dt className="text-sm text-muted-foreground">Birth Order</dt>
                  <dd className="font-medium text-foreground">{profileValue(baby.birth_order)}</dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <dt className="text-sm text-muted-foreground">APGAR Score (5 min)</dt>
                  <dd className="font-medium text-foreground">{profileValue(baby.apgar_score_5min)}</dd>
                </div>
                <div className="min-w-0 space-y-1 sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">Delivery Type</dt>
                  <dd className="font-medium leading-relaxed text-foreground [overflow-wrap:anywhere]">{profileValue(baby.delivery_type)}</dd>
                </div>
              </dl>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
