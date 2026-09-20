'use client';

import React, { useState } from 'react';
import { 
  Layers, 
  Clock, 
  ExternalLink, 
  CheckCircle2, 
  ChevronRight, 
  Search,
  Filter,
  MoreVertical,
  Plus
} from 'lucide-react';
import { ApplicationRecord, ApplicationStatus } from '@/lib/applications';

interface PipelineKanbanProps {
  applications: ApplicationRecord[];
  onSelectJobId: (jobId: string) => void;
  onAdvanceStatus: (applicationId: string, status: ApplicationStatus) => void;
}

interface ColumnDef {
  id: string;
  title: string;
  statuses: ApplicationStatus[];
  color: string;
}

const COLUMNS: ColumnDef[] = [
  { id: 'saved', title: 'Saved for Later', statuses: ['saved'], color: 'border-slate-500/40 text-slate-300' },
  { id: 'applied', title: 'Applied', statuses: ['applied'], color: 'border-cyan-500/40 text-cyan-300' },
  { id: 'screening', title: 'Screening', statuses: ['screening'], color: 'border-purple-500/40 text-purple-300' },
  { id: 'interview', title: 'Interviewing', statuses: ['interview'], color: 'border-amber-500/40 text-amber-300' },
  { id: 'offer', title: 'Offer Received', statuses: ['offer'], color: 'border-emerald-500/40 text-emerald-300' },
  { id: 'closed', title: 'Archived / Closed', statuses: ['accepted', 'rejected', 'withdrawn', 'ghosted'], color: 'border-rose-500/40 text-rose-300' },
];

export default function PipelineKanban({
  applications,
  onSelectJobId,
  onAdvanceStatus,
}: PipelineKanbanProps) {
  const [pipelineSearch, setPipelineSearch] = useState('');

  const filteredApps = applications.filter((app) => {
    if (!pipelineSearch.trim()) return true;
    const term = pipelineSearch.toLowerCase();
    return (
      app.title?.toLowerCase().includes(term) ||
      app.company?.toLowerCase().includes(term) ||
      app.channel?.toLowerCase().includes(term) ||
      app.notes?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* KANBAN HEADER & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Application Pipeline (Kanban)</h2>
            <p className="text-xs text-slate-400">
              Track and transition active job applications through each hiring stage.
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Filter pipeline..."
            value={pipelineSearch}
            onChange={(e) => setPipelineSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
          />
        </div>
      </div>

      {/* KANBAN BOARD COLUMNS */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colApps = filteredApps.filter((a) => col.statuses.includes(a.status));

          return (
            <div
              key={col.id}
              className="glass-panel p-3 rounded-2xl border border-white/5 bg-slate-950/50 flex flex-col min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5 px-1">
                <span className={`text-xs font-mono font-bold ${col.color}`}>
                  {col.title}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5">
                  {colApps.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[700px] pr-0.5">
                {colApps.length === 0 ? (
                  <div className="py-12 text-center text-[11px] font-mono text-slate-600 border border-dashed border-white/5 rounded-xl">
                    No roles
                  </div>
                ) : (
                  colApps.map((app) => (
                    <div
                      key={app.id}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-cyan-500/40 transition-all space-y-2.5 shadow-lg group relative"
                    >
                      {/* Top metadata */}
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <span className="text-xs font-mono text-slate-400 font-bold block line-clamp-1">
                            {app.company}
                          </span>
                          <h4 
                            onClick={() => onSelectJobId(app.jobId)}
                            className="text-xs font-bold text-white hover:text-cyan-300 cursor-pointer line-clamp-2 transition-colors mt-0.5"
                          >
                            {app.title}
                          </h4>
                        </div>
                        {app.score !== undefined && (
                          <span className={`text-xs font-mono font-bold shrink-0 ${app.tier === 'tier_a' ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {app.score}
                          </span>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {app.channel && (
                          <span className="text-[9px] font-mono uppercase bg-white/5 text-slate-400 px-1.5 py-0.5 rounded border border-white/5">
                            {app.channel}
                          </span>
                        )}
                        {app.tier === 'tier_a' && (
                          <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            Tier A
                          </span>
                        )}
                      </div>

                      {/* Follow-up / dates */}
                      {app.nextFollowUpAt && app.status !== 'accepted' && app.status !== 'rejected' && (
                        <div className="text-[10px] font-mono text-amber-400/90 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            Next FU: {new Date(app.nextFollowUpAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}

                      {/* Quick Stage Transitions */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-1">
                        {col.id === 'saved' && (
                          <button
                            onClick={() => onAdvanceStatus(app.id, 'applied')}
                            className="w-full py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold transition-all"
                          >
                            Mark Applied →
                          </button>
                        )}
                        {col.id === 'applied' && (
                          <div className="flex gap-1 w-full">
                            <button
                              onClick={() => onAdvanceStatus(app.id, 'screening')}
                              className="flex-1 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold transition-all"
                            >
                              Screening
                            </button>
                            <button
                              onClick={() => onAdvanceStatus(app.id, 'ghosted')}
                              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-mono transition-all"
                            >
                              Ghosted
                            </button>
                          </div>
                        )}
                        {col.id === 'screening' && (
                          <button
                            onClick={() => onAdvanceStatus(app.id, 'interview')}
                            className="w-full py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold transition-all"
                          >
                            Interview →
                          </button>
                        )}
                        {col.id === 'interview' && (
                          <button
                            onClick={() => onAdvanceStatus(app.id, 'offer')}
                            className="w-full py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold transition-all"
                          >
                            🎉 Offer Received
                          </button>
                        )}
                        {col.id === 'offer' && (
                          <button
                            onClick={() => onAdvanceStatus(app.id, 'accepted')}
                            className="w-full py-1 rounded bg-emerald-500 text-slate-950 font-bold text-[10px] font-mono transition-all"
                          >
                            Accept Offer
                          </button>
                        )}
                        {col.id === 'closed' && (
                          <span className="text-[10px] font-mono text-slate-500 uppercase">
                            {app.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
