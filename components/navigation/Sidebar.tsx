'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Briefcase, Clock, Play, RefreshCw } from 'lucide-react';
import { SIDEBAR_NAV_ITEMS, TabId } from './sidebar-config';

export interface SidebarProps {
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  todayDueCount?: number;
  freshJobsCount?: number;
  topCompaniesCount?: number;
  pipelineCount?: number;
  responseRate?: number;
  reviewCount?: number;
  companiesCount?: number;
  historyCount?: number;
  isScanning?: boolean;
  cooldownRemaining?: number;
  onTriggerLiveScan?: () => void;
}

export default function Sidebar({
  activeTab = 'today',
  onTabChange,
  todayDueCount = 0,
  freshJobsCount = 0,
  topCompaniesCount = 0,
  pipelineCount = 0,
  responseRate = 0,
  reviewCount = 0,
  companiesCount = 0,
  historyCount = 0,
  isScanning = false,
  cooldownRemaining = 0,
  onTriggerLiveScan,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === '/' || pathname === '';

  const formatCooldownTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  const handleTabClick = (tab: TabId) => {
    if (isHome && onTabChange) {
      onTabChange(tab);
    } else {
      router.push(`/?tab=${tab}`);
    }
  };

  const renderBadge = (id: string) => {
    switch (id) {
      case 'today':
        return todayDueCount > 0 ? (
          <span className="bg-amber-500 text-slate-950 text-xs px-2.5 py-0.5 rounded-full font-mono font-extrabold animate-pulse">
            {todayDueCount} Due
          </span>
        ) : (
          <span className="text-slate-500 text-xs font-mono">10/wk</span>
        );
      case 'fresh':
        return (
          <span className="bg-emerald-500/30 text-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
            {freshJobsCount}
          </span>
        );
      case 'evaluate':
        return (
          <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border border-emerald-500/30">
            Live
          </span>
        );
      case 'all':
        return (
          <span className="bg-teal-500/30 text-teal-200 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
            {topCompaniesCount}
          </span>
        );
      case 'pipeline':
        return (
          <span className="bg-emerald-500/30 text-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
            {pipelineCount}
          </span>
        );
      case 'insights':
        return (
          <span className="text-teal-300 text-xs font-mono font-bold">
            {responseRate}%
          </span>
        );
      case 'review':
        return reviewCount > 0 ? (
          <span className="bg-amber-500/30 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
            {reviewCount}
          </span>
        ) : null;
      case 'watchlist':
        return <span className="text-slate-500 text-xs font-mono">{companiesCount}</span>;
      case 'profile':
        return <span className="text-sky-400 text-xs font-mono">8.5y</span>;
      case 'runs':
        return <span className="text-slate-500 text-xs font-mono">{historyCount}</span>;
      default:
        return null;
    }
  };

  return (
    <aside className="w-[280px] h-full glass-panel border-r border-emerald-500/10 p-6 flex flex-col justify-between z-20 shrink-0 select-none overflow-y-auto">
      <div>
        {/* Brand Header */}
        <Link href="/" className="flex items-center gap-3 mb-8 group block">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-glow-emerald group-hover:scale-105 transition-transform">
            <Briefcase className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white leading-none">JobAppy</h1>
            <span className="text-xs text-emerald-400 font-mono tracking-wider font-semibold">INTELLIGENCE v2.0</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="space-y-1.5" aria-label="Main Navigation">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isRouteActive = Boolean(item.href && pathname === item.href);
            const isTabActive = Boolean(isHome && item.tab && activeTab === item.tab);
            const isActive = isRouteActive || isTabActive;

            const baseClass = `w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-sm transition-all duration-200 ${
              isActive
                ? item.activeClass
                : 'text-slate-400 hover:text-white hover:bg-emerald-500/5'
            }`;

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  title={item.label}
                  className={baseClass}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-1">
                    <Icon className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span className="truncate font-medium">{item.label}</span>
                  </div>
                  <div className="shrink-0">{renderBadge(item.id)}</div>
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => item.tab && handleTabClick(item.tab)}
                title={item.label}
                className={baseClass}
              >
                <div className="flex items-center gap-3 min-w-0 pr-1">
                  <Icon className={`w-4 h-4 shrink-0 ${
                    item.id === 'today' 
                      ? 'text-amber-400' 
                      : item.id === 'insights' || item.id === 'all'
                        ? 'text-teal-400'
                        : item.id === 'profile'
                          ? 'text-sky-400'
                          : 'text-emerald-400'
                  }`} />
                  <span className="truncate font-medium">{item.label}</span>
                </div>
                <div className="shrink-0">{renderBadge(item.id)}</div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Live Manual Trigger Control */}
      <div className="pt-6 border-t border-white/10 mt-6">
        <div className="bg-white/5 p-4 rounded-2xl mb-4 border border-white/5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Cron Schedule
            </span>
            <span className="text-white font-mono font-medium">9 AM & 9 PM IST</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Background runner actively monitors direct ATS & RSS feeds.
          </p>
        </div>

        {onTriggerLiveScan ? (
          <button
            type="button"
            onClick={onTriggerLiveScan}
            disabled={isScanning || cooldownRemaining > 0}
            className={`w-full py-3.5 px-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-lg ${
              cooldownRemaining > 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : isScanning
                  ? 'bg-emerald-600/50 text-white cursor-wait'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-glow-emerald active:scale-95'
            }`}
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Ingesting Feeds...</span>
              </>
            ) : cooldownRemaining > 0 ? (
              <>
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Cooldown ({formatCooldownTime(cooldownRemaining)})</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Trigger Live Scan</span>
              </>
            )}
          </button>
        ) : (
          <Link
            href="/?scan=trigger"
            className="w-full py-3.5 px-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-glow-emerald active:scale-95"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Go to Dashboard</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
