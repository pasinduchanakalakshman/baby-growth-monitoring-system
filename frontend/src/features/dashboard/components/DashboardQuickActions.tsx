import { ArrowUpRight, ChartNoAxesCombined, FileClock, Heart, Plus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DashboardQuickActions({ newborn, olderBaby, hasProfile, hasHistory, forecastAvailable }: {
  newborn: boolean; olderBaby: boolean; hasProfile: boolean; hasHistory: boolean; forecastAvailable: boolean;
}) {
  return (
    <Card className="min-w-0 rounded-2xl border-border/40">
      <CardHeader className="p-5 pb-3"><h2 className="font-semibold">Explore your baby's growth</h2></CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        {hasProfile && <Button asChild variant="ghost" className="h-auto min-h-14 w-full justify-start gap-3 rounded-xl px-3 py-3 text-left whitespace-normal"><Link to="/growth"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent"><Heart aria-hidden="true" className="size-4 text-primary" /></span><span className="flex-1 text-sm">{newborn ? 'View Weight Journey' : 'Growth Overview'}</span><ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></Link></Button>}
        {!newborn && hasHistory && <>
          <Button asChild variant="ghost" className="h-auto min-h-14 w-full justify-start gap-3 rounded-xl px-3 py-3 text-left whitespace-normal"><Link to="/growth/charts"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary"><ChartNoAxesCombined aria-hidden="true" className="size-4 text-primary" /></span><span className="flex-1 text-sm">Growth Charts</span><ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></Link></Button>
          <Button asChild variant="ghost" className="h-auto min-h-14 w-full justify-start gap-3 rounded-xl px-3 py-3 text-left whitespace-normal"><Link to="/growth/history"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><FileClock aria-hidden="true" className="size-4 text-primary" /></span><span className="flex-1 text-sm">Growth History</span><ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></Link></Button>
        </>}
        {!newborn && <div className="rounded-xl bg-secondary/50 p-3">
          <p className="flex items-center gap-2 text-sm font-medium"><Sparkles aria-hidden="true" className="size-4 text-primary" />Growth forecast</p>
          {forecastAvailable ? <Button asChild variant="prediction-link" className="mt-1 min-h-11 px-0"><Link to="/growth/forecast">View Forecast<ArrowUpRight aria-hidden="true" className="size-4" /></Link></Button> : <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No forecast is available for the recorded growth history yet.</p>}
        </div>}
        {olderBaby && <div className="border-t border-border/60 px-3 pt-3 pb-2"><Button disabled variant="outline" className="min-h-11 w-full gap-2"><Plus aria-hidden="true" className="size-4" />Add Measurement</Button><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Not available from the dashboard yet.</p></div>}
        {newborn && <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">Your first-month journey uses the birth weight already in your baby's profile.</p>}
      </CardContent>
    </Card>
  );
}
