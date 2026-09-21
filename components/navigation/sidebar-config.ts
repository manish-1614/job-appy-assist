import { LucideIcon } from 'lucide-react';
import { 
  Flame, 
  Sparkles, 
  Building2, 
  Layers, 
  BarChart2, 
  ShieldCheck, 
  UserCheck, 
  Activity,
  Compass
} from 'lucide-react';

export type TabId = 
  | 'today' 
  | 'fresh' 
  | 'all' 
  | 'pipeline' 
  | 'insights' 
  | 'review' 
  | 'watchlist' 
  | 'profile' 
  | 'runs';

export interface SidebarNavItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  href?: string;
  tab?: TabId;
  activeClass: string;
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    id: 'today',
    tab: 'today',
    label: 'Today Cockpit',
    shortLabel: 'Today',
    icon: Flame,
    activeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-glow-amber font-bold',
  },
  {
    id: 'fresh',
    tab: 'fresh',
    label: 'Fresh (Last 24h)',
    shortLabel: 'Fresh',
    icon: Sparkles,
    activeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-glow-emerald font-bold',
  },
  {
    id: 'evaluate',
    href: '/evaluate',
    label: 'Evaluate Any Job Opening URL',
    shortLabel: 'Evaluate URL',
    icon: Compass,
    activeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-glow-emerald font-bold',
  },
  {
    id: 'all',
    tab: 'all',
    label: 'Top 50 Companies',
    shortLabel: 'Top 50',
    icon: Building2,
    activeClass: 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-glow-mint font-bold',
  },
  {
    id: 'pipeline',
    tab: 'pipeline',
    label: 'Pipeline (Kanban)',
    shortLabel: 'Pipeline',
    icon: Layers,
    activeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-glow-emerald font-bold',
  },
  {
    id: 'insights',
    tab: 'insights',
    label: 'Funnel Analytics',
    shortLabel: 'Analytics',
    icon: BarChart2,
    activeClass: 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-glow-mint font-bold',
  },
  {
    id: 'review',
    tab: 'review',
    label: 'Review Queue',
    shortLabel: 'Review',
    icon: ShieldCheck,
    activeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-glow-amber',
  },
  {
    id: 'watchlist',
    tab: 'watchlist',
    label: 'Employer Watchlist',
    shortLabel: 'Watchlist',
    icon: Building2,
    activeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  },
  {
    id: 'profile',
    tab: 'profile',
    label: 'Candidate Profile',
    shortLabel: 'Profile',
    icon: UserCheck,
    activeClass: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
  },
  {
    id: 'runs',
    tab: 'runs',
    label: 'Scan History',
    shortLabel: 'History',
    icon: Activity,
    activeClass: 'bg-slate-700/50 text-white border border-slate-600',
  },
];
