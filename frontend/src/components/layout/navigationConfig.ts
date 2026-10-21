import { Activity, Baby, ChartNoAxesCombined, History, LayoutDashboard, Lightbulb, ListChecks, PlusCircle, Settings, ShieldCheck, TrendingUp, UtensilsCrossed } from 'lucide-react';

// Existing App.tsx destinations; onboarding stays outside the shell navigation.
export const appNavigation = [
  {
    label: 'Your baby',
    items: [
      { title: 'Dashboard', href: '/app', icon: LayoutDashboard },
      { title: 'Baby Profile', href: '/baby', icon: Baby },
    ],
  },
  {
    label: 'Nutrition',
    items: [
      { title: 'Nutrition & Feeding', href: '/nutrition', icon: UtensilsCrossed },
    ],
  },
  {
    label: 'Growth',
    items: [
      { title: 'Growth Overview', href: '/growth', icon: Activity },
      { title: 'Growth Charts', href: '/growth/charts', icon: ChartNoAxesCombined },
      { title: 'Growth Forecast', href: '/growth/forecast', icon: TrendingUp },
      { title: 'Growth History', href: '/growth/history', icon: History },
      { title: 'Add Measurement', href: '/growth/add', icon: PlusCircle },
    ],
  },
  {
    label: 'Insights',
    items: [
      { title: 'Growth Risk', href: '/growth/risk', icon: ShieldCheck },
      { title: 'Risk History', href: '/growth/risk/history', icon: ListChecks },
      { title: 'Risk Explanation', href: '/growth/explanation', icon: Lightbulb },
    ],
  },
  {
    label: 'Your account',
    items: [{ title: 'Account', href: '/account', icon: Settings }],
  },
];

export function getAppPageTitle(pathname: string) {
  return appNavigation.flatMap(group => group.items).find(item => item.href === pathname)?.title ?? 'BabyGrowth';
}
