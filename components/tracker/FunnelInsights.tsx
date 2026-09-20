'use client';

import React from 'react';
import { Activity, BarChart2, TrendingUp, CheckCircle, Percent, Share2 } from 'lucide-react';
import SkillGapPanel from './SkillGapPanel';

interface FunnelInsightsProps {
  insights: {
    totalTracked: number;
    appliedOrBeyond: number;
    byStage: Record<string, number>;
    byChannel: Record<string, number>;
    byTier: Record<string, number>;
    responseRate: number;
  } | null;
}

export default function FunnelInsights({ insights }: FunnelInsightsProps) {
  if (!insights) {
    return (
      <div className="glass-panel p-12 text-center rounded-3xl animate-pulse">
        <Activity className="w-8 h-8 text-slate-500 mx-auto mb-3" />
        <p className="text-slate-400 font-mono text-sm">Loading Funnel Insights...</p>
      </div>
    );
  }

  const { totalTracked, appliedOrBeyond, byStage, byChannel, byTier, responseRate } = insights;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-cyan-500 flex items-center justify-center text-white shadow-glow-magenta">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Application Funnel & Conversion Analytics</h2>
          <p className="text-xs text-slate-400">
            Real-time conversion metrics across outreach channels, stages, and quality tiers.
          </p>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs font-mono text-slate-400 uppercase">Total Opportunities Tracked</span>
          <div className="text-2xl font-extrabold font-mono text-white">{totalTracked}</div>
          <span className="text-[11px] text-slate-500 font-mono">Pipeline inventory</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs font-mono text-cyan-400 uppercase">Applications Dispatched</span>
          <div className="text-2xl font-extrabold font-mono text-cyan-300">{appliedOrBeyond}</div>
          <span className="text-[11px] text-slate-500 font-mono">Sent past saved stage</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs font-mono text-emerald-400 uppercase">Response Rate</span>
          <div className="text-2xl font-extrabold font-mono text-emerald-300">{responseRate}%</div>
          <span className="text-[11px] text-slate-500 font-mono">Screening or interview rate</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs font-mono text-amber-400 uppercase">Active Interviews</span>
          <div className="text-2xl font-extrabold font-mono text-amber-300">
            {(byStage['screening'] || 0) + (byStage['interview'] || 0)}
          </div>
          <span className="text-[11px] text-slate-500 font-mono">In evaluation rounds</span>
        </div>
      </div>

      {/* DETAILED BREAKDOWNS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. BY STAGE */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
            Funnel by Stage
          </h3>
          <div className="space-y-2.5">
            {[
              { label: 'Saved', count: byStage['saved'] || 0, color: 'bg-slate-500' },
              { label: 'Applied', count: byStage['applied'] || 0, color: 'bg-cyan-400' },
              { label: 'Screening', count: byStage['screening'] || 0, color: 'bg-purple-400' },
              { label: 'Interview', count: byStage['interview'] || 0, color: 'bg-amber-400' },
              { label: 'Offer', count: byStage['offer'] || 0, color: 'bg-emerald-400' },
              { label: 'Accepted', count: byStage['accepted'] || 0, color: 'bg-emerald-500' },
              { label: 'Ghosted', count: byStage['ghosted'] || 0, color: 'bg-slate-600' },
              { label: 'Rejected', count: byStage['rejected'] || 0, color: 'bg-rose-500' },
            ].map((st) => (
              <div key={st.label} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">{st.label}</span>
                  <span className="text-white font-bold">{st.count}</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${st.color} rounded-full`}
                    style={{
                      width: `${totalTracked > 0 ? (st.count / totalTracked) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. BY CHANNEL */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
            Outreach Channels
          </h3>
          <div className="space-y-3">
            {Object.entries(byChannel).length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">No channels recorded yet.</p>
            ) : (
              Object.entries(byChannel).map(([ch, cnt]) => (
                <div key={ch} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="flex justify-between text-xs font-mono capitalize">
                    <span className="text-slate-300">{ch} Channel</span>
                    <span className="text-cyan-300 font-bold">{cnt}</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full"
                      style={{
                        width: `${totalTracked > 0 ? (cnt / totalTracked) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. BY TIER */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
            Quality Distribution
          </h3>
          <div className="space-y-3">
            {[
              { tier: 'tier_a', label: 'Tier A (Top Fit ≥75)', count: byTier['tier_a'] || 0, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
              { tier: 'tier_b', label: 'Tier B (Qualifying 60-74)', count: byTier['tier_b'] || 0, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
              { tier: 'tier_c', label: 'Tier C / Gated (<60)', count: (byTier['tier_c'] || 0) + (byTier['unclassified'] || 0), color: 'text-slate-400 border-white/10 bg-white/5' },
            ].map((t) => (
              <div key={t.tier} className={`p-3 rounded-xl border ${t.color} flex items-center justify-between`}>
                <span className="text-xs font-mono font-bold">{t.label}</span>
                <span className="text-base font-mono font-extrabold">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SKILL GAP ANALYZER PANEL */}
      <SkillGapPanel />
    </div>
  );
}
