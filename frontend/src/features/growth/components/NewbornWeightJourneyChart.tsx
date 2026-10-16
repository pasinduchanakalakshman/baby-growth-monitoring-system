import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
import { createNewbornWeightJourney, journeyPhases } from '@/utils/newbornWeightJourney';

type Props = { birthWeightKg?: number | null; gestationalAgeWeeks?: number | null };

export function JourneyTooltip({ active, payload }: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: { day: number; illustrativeWeightKg: number; phase: string } }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="bg-card border rounded-lg p-3 shadow-md text-sm">
    <p className="font-semibold">Day {point.day} · {point.phase}</p>
    <p>{point.day === 0 ? 'Recorded birth weight' : 'Illustrative example'}: {point.illustrativeWeightKg.toFixed(2)} kg</p>
  </div>;
}

export default function NewbornWeightJourneyChart({ birthWeightKg, gestationalAgeWeeks }: Props) {
  const points = createNewbornWeightJourney(birthWeightKg);
  const termRecorded = typeof gestationalAgeWeeks === 'number' && Number.isInteger(gestationalAgeWeeks) && gestationalAgeWeeks >= 37 && gestationalAgeWeeks <= 41;
  return <section aria-label="Newborn Weight Journey" className="bg-card border rounded-xl p-4 sm:p-6 shadow-sm min-w-0 space-y-4">
    <div>
      <p className="text-sm font-semibold text-primary mb-1">Newborn Weight Journey</p>
      <h2 className="text-xl font-semibold text-slate-900">Your Baby's First 30 Days</h2>
      <p className="text-sm text-slate-600">How a newborn's weight may typically change after birth</p>
    </div>
    <p className="text-sm bg-slate-50 border rounded-lg p-3 text-slate-700">
      This chart shows a typical example of newborn weight changes. Except for the birth weight, the values are illustrative and are not measurements or exact predictions of your baby's weight.
    </p>
    <p className="text-sm text-slate-600">
      {termRecorded ? 'This is a general teaching example for babies born at term.' : 'This general example is for babies born at term. Your baby was born early, or term status is not established in the recorded details.'}
      {' '}It may not suit babies born early or babies who are unwell or need special care. It does not show whether your baby is healthy or growing normally. Follow your healthcare provider's individual advice.
    </p>
    {points.length ? <>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
        <span>● Recorded birth weight: {birthWeightKg} kg</span>
        <span><span aria-hidden="true">┄┄ </span>Dashed line: illustrative example</span>
      </div>
      <div className="h-72 sm:h-80 w-full min-w-0" role="img" aria-label={`Illustrative first-month weight example starting at the recorded birth weight of ${birthWeightKg} kg, dipping in the first few days, recovering, then increasing. All later values are illustrative.`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={points} margin={{ top: 20, right: 15, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="day" type="number" domain={[0, 30]} ticks={[0, 3, 12, 20, 30]} tick={{ fontSize: 12 }} label={{ value: 'Days after birth', position: 'bottom', offset: 5 }} />
            <YAxis width={62} domain={['auto', 'auto']} tick={{ fontSize: 11 }} tickFormatter={v => Number(v).toFixed(2)} label={{ value: 'Illustrative weight (kg)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
            <Tooltip content={<JourneyTooltip />} />
            <ReferenceLine y={points[0].illustrativeWeightKg} stroke="#94a3b8" strokeDasharray="2 5" />
            <Line type="monotone" dataKey="illustrativeWeightKg" name="Illustrative example (kg)" stroke="var(--color-primary, #0f172a)" strokeWidth={3} strokeDasharray="7 5" dot={false} isAnimationActive={false} />
            <ReferenceDot x={0} y={points[0].illustrativeWeightKg} r={5} fill="var(--color-primary, #0f172a)" stroke="#fff" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </> : <p className="text-sm text-slate-600 border rounded-lg p-4">A valid recorded birth weight is unavailable, so this example cannot be drawn. No additional weight measurements are needed for this section.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {journeyPhases.map(phase => <div key={phase.title} className="bg-slate-50 border rounded-lg p-3">
        <p className="text-xs font-medium text-primary">{phase.label}</p>
        <h3 className="font-semibold text-sm text-slate-800">{phase.title}</h3>
        <p className="text-sm text-slate-600 mt-1">{phase.description}</p>
      </div>)}
    </div>
    <p className="text-sm text-slate-600">No extra weight entries are needed to view this example. Keep your baby's routine clinical checks.</p>
    <aside className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-slate-700">
      <h3 className="font-semibold mb-2">When Should You Seek Advice?</h3>
      <p>Contact a doctor, Public Health Midwife or healthcare provider if your newborn:</p>
      <ul className="list-disc pl-5 mt-2 space-y-1">
        <li>Has difficulty feeding.</li><li>Has noticeably fewer wet nappies.</li>
        <li>Appears unusually sleepy, weak or unwell.</li><li>Shows other concerning symptoms.</li>
        <li>Has weight concerns raised during a clinical check.</li>
      </ul>
      <p className="mt-2">This is general guidance only. The illustration cannot assess your baby's health.</p>
    </aside>
  </section>;
}
