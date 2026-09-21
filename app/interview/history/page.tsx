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
  Award,
  Sparkles,
  X,
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

interface ScoreDetail {
  id: number;
  dimension: string;
  score: number;
  evidence_json: string;
  grader_model: string;
}

export default function InterviewHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected session modal
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [isGrading, setIsGrading] = useState<boolean>(false);

  useEffect(() => {
    fetchSessions();
  }, []);

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

  const openSessionDetail = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/interview/sessions/${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setActiveDetail(data);
      }
    } catch (err) {
      console.error('Error fetching session details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const triggerGrading = async () => {
    if (!activeSessionId) return;
    setIsGrading(true);
    try {
      const res = await fetch(`/api/interview/sessions/${activeSessionId}/grade`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        // Refresh details
        await openSessionDetail(activeSessionId);
        await fetchSessions();
      }
    } catch (err) {
      console.error('Failed to trigger grading:', err);
    } finally {
      setIsGrading(false);
    }
  };

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
                  Review past simulation transcripts, whiteboards, C++ snapshots, and rubric evaluations.
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
                  onClick={() => openSessionDetail(ses.id)}
                  className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-600 cursor-pointer transition flex items-center justify-between group"
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

                    <div className="text-base font-semibold text-white group-hover:text-purple-300 transition">
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
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Session Details & Rubric Grading Modal */}
      {activeSessionId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-3xl w-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    Session Dossier
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{activeSessionId}</span>
                </div>
                <h2 className="text-lg font-bold text-white">
                  {activeDetail?.session?.question_id?.replace(/_/g, ' ')}
                </h2>
              </div>

              <button
                onClick={() => {
                  setActiveSessionId(null);
                  setActiveDetail(null);
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail ? (
                <div className="text-center py-12 text-slate-500 font-mono text-sm">
                  Loading session details...
                </div>
              ) : activeDetail ? (
                <>
                  {/* Rubric Scores Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                        <Award className="w-4 h-4 text-purple-400" />
                        <span>Bar Raiser Rubric Evaluation</span>
                      </h3>

                      {(!activeDetail.scores || activeDetail.scores.length === 0) && (
                        <button
                          onClick={triggerGrading}
                          disabled={isGrading}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold disabled:opacity-50 transition shadow-md"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isGrading ? 'Grading...' : 'Run Rubric Evaluation'}</span>
                        </button>
                      )}
                    </div>

                    {activeDetail.scores && activeDetail.scores.length > 0 ? (
                      <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 bg-slate-950/60">
                        {activeDetail.scores.map((sc: ScoreDetail) => {
                          let evidence: any = {};
                          try {
                            evidence = JSON.parse(sc.evidence_json);
                          } catch {}
                          return (
                            <div key={sc.id} className="p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-white">
                                  {evidence.name || sc.dimension.replace(/_/g, ' ')}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                                    sc.score >= 3.3
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                      : sc.score >= 2.5
                                      ? 'bg-blue-950 text-blue-400 border border-blue-800'
                                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                                  }`}
                                >
                                  {sc.score.toFixed(1)} / 4.0
                                </span>
                              </div>
                              <div className="text-xs text-slate-300 italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                                &quot;{evidence.quote || 'No direct quote cited'}&quot;
                              </div>
                              {evidence.rationale && (
                                <div className="text-xs text-slate-400 leading-relaxed">
                                  {evidence.rationale}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2 text-xs text-slate-400">
                        <div>This session has not been scored yet.</div>
                        <p className="text-slate-500">
                          Click &quot;Run Rubric Evaluation&quot; to evaluate transcript against calibrated rubric standards.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Transcript History */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                      Chronological Transcript ({activeDetail.turns?.length || 0} turns)
                    </h3>
                    <div className="max-h-60 overflow-y-auto space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800 font-sans text-xs">
                      {activeDetail.turns?.map((t: any) => (
                        <div key={t.id} className="space-y-0.5">
                          <span className="font-mono text-[10px] text-slate-500 uppercase">
                            [{t.speaker}]
                          </span>
                          <p className="text-slate-200 leading-relaxed">{t.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
