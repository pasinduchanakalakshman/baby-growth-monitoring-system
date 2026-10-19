// Educational copy only. All chart weights are calculated by FastAPI.
export const journeyPhases = [
  { label: 'Birth', title: 'At Birth', description: "Your baby's birth weight is the starting point of this chart." },
  { label: 'Initial weight loss', title: 'First Few Days', description: 'Newborn babies often lose a little weight during the first few days after birth.' },
  { label: 'Recovery', title: 'Weight Recovery', description: 'Many babies regain their birth weight within approximately 1–2 weeks.' },
  { label: 'Continued growth', title: 'Continued Growth', description: 'After the early recovery period, babies generally continue gaining weight.' },
] as const;
