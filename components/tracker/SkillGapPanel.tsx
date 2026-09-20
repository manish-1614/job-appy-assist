'use client';

import React, { useEffect, useState } from 'react';
import { Target, AlertTriangle, CheckCircle2, TrendingUp, Sparkles, HelpCircle } from 'lucide-react';
import { SkillGapSummary } from '@/lib/skill-gap';

export default function SkillGapPanel() {
  const [summary, setSummary] = useState<SkillGapSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSkills() {
      try {
        const res = await fetch('/api/insights/skills');
        const data = await res.json();
        if (data.success && data.summary) {
          setSummary(data.summary);
        }
      } catch (err) {
        console.error('Failed loading skill gaps:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSkills();
  }, []);

  if (loading) {
    return (
      <div className="glass-panel p-6 rounded-3xl border border-white/10 animate-pulse text-center">
        <p className="text-xs font-mono text-slate-400">Aggregating Skill Demand across Tier A/B openings...</p>
      </div>
    );
  }

  if (!summary || summary.totalAnalyzedJobs === 0) {
    return null;
  }

  return (
    <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Market Skill Gap & Demand Analyzer
            </h3>
            <p className="text-xs text-slate-400">
              Aggregated across {summary.totalAnalyzedJobs} open Tier A ({summary.tierAJobsCount}) & Tier B ({summary.tierBJobsCount}) opportunities.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
          <span className="text-xs font-mono text-slate-400">Candidate Stack Fit:</span>
          <span className="text-sm font-extrabold font-mono text-emerald-400">
            {summary.overallCoverageRate}%
          </span>
        </div>
      </div>

      {/* TWO COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. TOP MISSING SKILLS (GAPS) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            Top Missing Skills in Market ({summary.topMissingSkills.length})
          </div>
          <p className="text-[11px] text-slate-400">
            Technologies required in target roles with no verified candidate entry in profile:
          </p>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {summary.topMissingSkills.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono italic">No critical skill gaps identified.</p>
            ) : (
              summary.topMissingSkills.map((item) => (
                <div
                  key={item.skill}
                  className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex flex-col gap-1.5 hover:border-rose-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold font-mono text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                      {item.skill}
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg">
                      {item.demandCount} jobs ({item.demandPercentage}%)
                    </span>
                  </div>
                  {item.sampleJobs.length > 0 && (
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      Required by: {item.sampleJobs.map((j) => j.company).slice(0, 3).join(', ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. TOP MATCHED SKILLS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            Strongest In-Demand Matched Skills ({summary.topMatchedSkills.length})
          </div>
          <p className="text-[11px] text-slate-400">
            Verified candidate skills actively sought after by high-fit employers:
          </p>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {summary.topMatchedSkills.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono italic">No matched skills recorded.</p>
            ) : (
              summary.topMatchedSkills.map((item) => (
                <div
                  key={item.skill}
                  className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col gap-1.5 hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold font-mono text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      {item.skill}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                      {item.demandCount} jobs ({item.demandPercentage}%)
                    </span>
                  </div>
                  {item.sampleJobs.length > 0 && (
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      Demanded by: {item.sampleJobs.map((j) => j.company).slice(0, 3).join(', ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
