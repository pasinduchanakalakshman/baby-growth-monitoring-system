import { useSyncExternalStore } from 'react';

const query = '(pointer: coarse)';
const snapshot = () => typeof window !== 'undefined' && (window.matchMedia?.(query).matches ?? false);
const serverSnapshot = () => false;

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(query);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

// Preserve mouse hover; touch users can tap without needing a hover gesture.
export function useChartTooltipTrigger() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot) ? 'click' : 'hover';
}
