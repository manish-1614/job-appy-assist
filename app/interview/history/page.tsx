'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  History,
  Bot,
  Clock,
  Coins,
  ChevronRight,
  Plus,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import Sidebar from '@/components/navigation/Sidebar';

interface SessionItem {
  id: string;
  started_at: string;
  ended_at: string | null;
  company_style: string;
  round_type: string;
  question_id: string;
  status: string;
  cost_inr_est: number;
  turn_count: number;
  snapshot_count: number;
}

export default function InterviewHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/interview/sessions');
        const data = await res.json();
        if (data.success) {
          setSessions(data.sessions);
        }
      } catch (err) {
        console.error('Failed to load session history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  const calculateDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress';
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diffSec = Math.max(0, Math.round((e - s) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/interview')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Mock-Interview Session History
                </h1>
                <p className="text-sm text-slate-400">
                  Review past simulation transcripts, whiteboards, C++ snapshots, and cost breakdowns.
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push('/interview')}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition shadow-lg shadow-purple-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Start New Interview</span>
            </button>
          </div>

          {/* Session Cards */}
          {loading ? (
            <div className="text-center py-16 text-slate-500 font-mono text-sm">
              Loading session archive...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <Bot className="w-12 h-12 text-purple-400/50 mx-auto" />
              <div className="text-base font-semibold text-slate-300">No mock sessions recorded yet</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Ready to practice? Launch a new session with Google or Toptal interviewer persona.
              </p>
              <button
                onClick={() => router.push('/interview')}
                className="mt-2 inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                <span>Launch First Session</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((ses) => (
                <div
                  key={ses.id}
                  className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {ses.company_style}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {ses.round_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(ses.started_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-base font-semibold text-white">
                      {ses.question_id.replace(/_/g, ' ')}
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-slate-400 font-mono">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{calculateDuration(ses.started_at, ses.ended_at)}</span>
                      </div>
                      <div>•</div>
                      <div className="flex items-center space-x-1">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>{ses.turn_count} turns</span>
                      </div>
                      <div>•</div>
                      <div className="flex items-center space-x-1">
                        <span>{ses.snapshot_count} snapshots</span>
                      </div>
                      <div>•</div>
                      <div className="flex items-center space-x-1 text-emerald-400 font-semibold">
                        <Coins className="w-3.5 h-3.5 text-emerald-500" />
                        <span>₹{Number(ses.cost_inr_est || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-mono capitalize ${
                        ses.status === 'completed'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {ses.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
