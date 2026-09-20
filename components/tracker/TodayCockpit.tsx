'use client';

import React from 'react';
import { 
  Target, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Flame,
  Calendar
} from 'lucide-react';
import { ApplicationRecord } from '@/lib/applications';

interface TodayCockpitProps {
  todayData: {
    weeklyGoal: {
      target: number;
      completed: number;
      remaining: number;
      percent: number;
    };
    followUpsDue: ApplicationRecord[];
    closedTrackedAlerts: Array<{
      applicationId: string;
      jobId: string;
      title: string;
      company: string;
    }>;
    savedAtRisk: ApplicationRecord[];
    newTierAJobs: Array<{
      id: string;
      title: string;
      company: string;
      location: string;
      score: number;
      applyUrl: string;
    }>;
    trackedCount: number;
  } | null;
  onSelectJobId: (jobId: string) => void;
  onTrackJob: (jobId: string, status: any) => void;
  onAdvanceStatus: (applicationId: string, status: any) => void;
}

export default function TodayCockpit({
  todayData,
  onSelectJobId,
  onTrackJob,
  onAdvanceStatus,
}: TodayCockpitProps) {
  if (!todayData) {
    return (
      <div className="glass-panel p-12 text-center rounded-3xl animate-pulse">
        <Clock className="w-8 h-8 text-slate-500 mx-auto mb-3" />
        <p className="text-slate-400 font-mono text-sm">Loading Today Cockpit...</p>
      </div>
    );
  }

  const { weeklyGoal, followUpsDue, closedTrackedAlerts, savedAtRisk, newTierAJobs } = todayData;

  return (
    <div className="space-y-6">
      {/* 1. WEEKLY APPLICATION GOAL BANNER (D11) */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <Target className="w-4 h-4 text-cyan-400" />
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">Weekly Application Goal (D11)</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                10 TARGET / WEEK
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Target cadence: Send 10 deliberate, tailored applications every week.
            </p>
          </div>

          <div className="flex items-baseline gap-2 shrink-0">
            <span className="text-3xl font-extrabold font-mono text-white">{weeklyGoal.completed}</span>
            <span className="text-sm font-mono text-slate-400">/ {weeklyGoal.target} sent</span>
            <span className="text-xs font-mono font-bold text-cyan-400 ml-2">
              ({weeklyGoal.percent}%)
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, weeklyGoal.percent)}%` }}
          ></div>
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-mono text-slate-500">
          <span>Monday 00:00 IST</span>
          <span>{weeklyGoal.remaining > 0 ? `${weeklyGoal.remaining} remaining this week` : '🎉 Goal achieved!'}</span>
        </div>
      </div>

      {/* 2. URGENT: TRACKED ROLES CLOSED BY EMPLOYER */}
      {closedTrackedAlerts.length > 0 && (
        <div className="p-5 rounded-3xl bg-rose-950/40 border border-rose-500/40 shadow-glow-rose space-y-3">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>URGENT: {closedTrackedAlerts.length} Tracked Role(s) Closed by Employer</span>
          </div>
          <div className="space-y-2">
            {closedTrackedAlerts.map((alert) => (
              <div
                key={alert.applicationId}
                onClick={() => onSelectJobId(alert.jobId)}
                className="p-3 rounded-2xl bg-slate-950/60 border border-rose-500/20 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition-all"
              >
                <div>
                  <h4 className="text-sm font-bold text-white">{alert.title}</h4>
                  <span className="text-xs font-mono text-slate-400">{alert.company}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
                    Listing Removed
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. FOLLOW-UPS DUE TODAY */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-tight uppercase font-mono">
              Follow-Ups Due Today ({followUpsDue.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">Default: +7d / +14d cadences</span>
        </div>

        {followUpsDue.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/5">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-xs text-slate-300 font-mono">No follow-ups overdue today. All applications current!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {followUpsDue.map((fu) => (
              <div
                key={fu.id}
                className="p-4 rounded-2xl bg-slate-900/60 border border-amber-500/20 hover:border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
              >
                <div className="cursor-pointer" onClick={() => onSelectJobId(fu.jobId)}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      {fu.status}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{fu.company}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white hover:text-cyan-300 transition-colors">
                    {fu.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onAdvanceStatus(fu.id, 'screening')}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-all"
                  >
                    Got Screen
                  </button>
                  <button
                    onClick={() => onAdvanceStatus(fu.id, 'ghosted')}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-mono transition-all"
                  >
                    Mark Ghosted
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. FRESH TIER A UNTRACKED ROLES */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight uppercase font-mono">
              Top Untracked Tier A Openings ({newTierAJobs.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-emerald-400">Score ≥ 75 & Passed All Gates</span>
        </div>

        {newTierAJobs.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/5">
            <p className="text-xs text-slate-400 font-mono">All current Tier A openings are already tracked!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {newTierAJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-400 font-mono">{job.company}</span>
                    <span className="text-xs font-bold font-mono text-emerald-400">{job.score}/100</span>
                  </div>
                  <h4 
                    onClick={() => onSelectJobId(job.id)}
                    className="text-sm font-bold text-white hover:text-cyan-300 cursor-pointer line-clamp-1"
                  >
                    {job.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">{job.location}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onTrackJob(job.id, 'applied')}
                    className="flex-1 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Applied</span>
                  </button>
                  <button
                    onClick={() => onTrackJob(job.id, 'saved')}
                    className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-all"
                  >
                    Save
                  </button>
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. SAVED ROLES AT RISK */}
      {savedAtRisk.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm font-mono">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Saved Roles at Risk of Closing ({savedAtRisk.length})</span>
          </div>
          <p className="text-xs text-slate-400">
            These saved roles are &gt;30 days old or were missing from the latest scan. Apply soon before they close.
          </p>
          <div className="space-y-2">
            {savedAtRisk.map((app) => (
              <div
                key={app.id}
                className="p-3 rounded-2xl bg-slate-900/60 border border-amber-500/20 flex items-center justify-between"
              >
                <div onClick={() => onSelectJobId(app.jobId)} className="cursor-pointer">
                  <h4 className="text-sm font-bold text-white hover:text-cyan-300">{app.title}</h4>
                  <span className="text-xs text-slate-400 font-mono">{app.company}</span>
                </div>
                <button
                  onClick={() => onAdvanceStatus(app.id, 'applied')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold"
                >
                  Mark Applied
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
