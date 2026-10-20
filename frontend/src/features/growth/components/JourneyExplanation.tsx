import type { NewbornWeightJourney } from '@/types/growth';

export function JourneyExplanation({ journey, compact = false }: { journey?: NewbornWeightJourney; compact?: boolean }) {
  return <div className={`space-y-3 rounded-xl bg-secondary/60 p-4 leading-relaxed text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
    <p>This chart shows an example of how a newborn's weight may change. Only the birth weight is a recorded measurement. The other values are illustrations, not exact predictions.</p>
    <p className="text-muted-foreground">Recorded visit weights, when available, come from saved visit data and are separate from this illustration. They do not indicate who took or entered the measurement.</p>
    {journey?.limitations.map(limitation => <p key={limitation} className="text-muted-foreground">{limitation}</p>)}
    <p className="font-medium">No extra weight entries are needed during the first 30 days to view this journey. Keep routine clinical checks.</p>
  </div>;
}
