import { Activity, Baby, ChartNoAxesCombined, History, LayoutDashboard, Lightbulb, ListChecks, PlusCircle, Settings, ShieldCheck, TrendingUp, UtensilsCrossed } from 'lucide-react';

// Existing App.tsx destinations; onboarding stays outside the shell navigation.
export const appNavigation = [
  {
    label: 'Your Baby',
    items: [
      { title: 'Dashboard', href: '/app', icon: LayoutDashboard },
      { title: 'Baby Profile', href: '/baby', icon: Baby },
    ],
  },
  {
    label: 'Growth Monitoring',
    items: [
      { title: 'Add Measurement', href: '/growth/add', icon: PlusCircle },
      { title: 'Growth Overview', href: '/growth', icon: Activity },
      { title: 'Growth History', href: '/growth/history', icon: History },
      { title: 'Growth Charts', href: '/growth/charts', icon: ChartNoAxesCombined },
    ],
  },
  {
    label: 'AI Growth Insights',
    items: [
      { title: 'Growth Forecast', href: '/growth/forecast', icon: TrendingUp },
      { title: 'Growth Risk', href: '/growth/risk', icon: ShieldCheck },
      { title: 'Risk History', href: '/growth/risk/history', icon: ListChecks },
      { title: 'Risk Explanation', href: '/growth/explanation', icon: Lightbulb },
    ],
  },
  {
    label: 'Nutrition',
    items: [
      { title: 'Nutrition & Feeding', href: '/nutrition', icon: UtensilsCrossed },
    ],
  },
  {
    label: 'Account',
    items: [{ title: 'Account', href: '/account', icon: Settings }],
  },
];

export function getAppPageTitle(pathname: string) {
  return appNavigation.flatMap(group => group.items).find(item => item.href === pathname)?.title ?? 'BabyGrowth';
}
