'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Compass, 
  Link as LinkIcon, 
  Zap, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Check, 
  AlertTriangle, 
  ExternalLink, 
  BookmarkPlus, 
  Sparkles, 
  ArrowLeft,
  X,
  FileText,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import Sidebar from '@/components/navigation/Sidebar';
import KitStudio from '@/components/kit/KitStudio';
import { UrlEvaluationResponse } from '@/lib/url-evaluator';

export default function EvaluatePage() {
  const [manualUrl, setManualUrl] = useState('');
  const [isEvaluatingUrl, setIsEvaluatingUrl] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [manualEvalResult, setManualEvalResult] = useState<UrlEvaluationResponse | null>(null);
  const [isSavingEvaluatedJob, setIsSavingEvaluatedJob] = useState(false);
  const [evalSaveSuccess, setEvalSaveSuccess] = useState(false);
  const [showKitModal, setShowKitModal] = useState(false);

  const validateUrl = (input: string): { valid: boolean; error?: string } => {
    const trimmed = input.trim();
    if (!trimmed) {
      return { valid: false, error: 'Please enter a job posting URL.' };
    }
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: 'URL must start with http:// or https://' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format. Please enter a complete URL (e.g. https://...)' };
    }
  };

  const handleManualUrlEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateUrl(manualUrl);
    if (!validation.valid) {
      setEvalError(validation.error || 'Invalid URL');
      return;
    }

    setIsEvaluatingUrl(true);
    setEvalError(null);
    setEvalSaveSuccess(false);

    try {
      const res = await fetch('/api/eval/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: manualUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setManualEvalResult(data);
      } else {
        setEvalError(data.error || 'Failed to evaluate URL. The page may be blocked by bot protection or unparseable.');
      }
    } catch (err: any) {
      setEvalError(err.message || 'Network error occurred while evaluating job opening URL.');
    } finally {
      setIsEvaluatingUrl(false);
    }
  };

  const handleSaveEvaluatedJob = async () => {
    if (!manualUrl.trim() || !manualEvalResult?.evaluatedJob) return;
    setIsSavingEvaluatedJob(true);
    try {
      const res = await fetch('/api/eval/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: manualUrl.trim(), saveToJobs: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEvalSaveSuccess(true);
      } else {
        alert(data.error || 'Failed to save job to active openings.');
      }
    } catch (err) {
      console.error('Failed to save evaluated job:', err);
    } finally {
      setIsSavingEvaluatedJob(false);
    }
  };

  const handleClear = () => {
    setManualUrl('');
    setManualEvalResult(null);
    setEvalError(null);
    setEvalSaveSuccess(false);
  };

  const job = manualEvalResult?.evaluatedJob;

  return (
    <div className="flex h-screen w-full bg-[#060B08] text-emerald-50 overflow-hidden font-sans">
      {/* Shared Reusable Sidebar */}
      <Sidebar />

      {/* Main Content Pane */}
      <main className="flex-1 h-full overflow-y-auto p-8 space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Evaluate Any Job Opening URL</h2>
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  Universal Scraper
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Directly evaluate any job posting link (Greenhouse, Lever, Ashby, SmartRecruiters, or general careers page) against your calibrated candidate profile.
              </p>
            </div>
          </div>

          {manualEvalResult && (
            <button
              onClick={handleClear}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Clear Analysis</span>
            </button>
          )}
        </div>

        {/* URL Input Form Card */}
        <section className="glass-panel p-6 rounded-3xl border border-white/10 bg-slate-900/40 shadow-2xl space-y-4">
          <form onSubmit={handleManualUrlEvaluation} className="space-y-3">
            <label className="text-xs font-mono text-emerald-400 font-semibold block uppercase tracking-wider">
              Job Opening URL
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <LinkIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  placeholder="https://boards.greenhouse.io/... or https://jobs.lever.co/... or https://company.com/careers/..."
                  value={manualUrl}
                  onChange={(e) => {
                    setManualUrl(e.target.value);
                    if (evalError) setEvalError(null);
                  }}
                  className="w-full bg-slate-950/90 border border-emerald-500/20 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/40 transition-all font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isEvaluatingUrl || !manualUrl.trim()}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-glow-emerald active:scale-95 transition-all shrink-0"
              >
                {isEvaluatingUrl ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Calculating Match %...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Analyze Match</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Validation / Server Error Banner */}
          {evalError && (
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{evalError}</p>
                <p className="text-red-300/80">
                  Ensure the URL is public, points directly to a single job posting, and is accessible without a login wall.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Empty State / Instructional Guide */}
        {!job && !isEvaluatingUrl && !evalError && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-3 bg-slate-900/20">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Compass className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-sm">Specialized ATS Handlers</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Direct native API integration for Greenhouse (`boards-api`), Lever, Ashby, and SmartRecruiters for 100% structured data precision.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-3 bg-slate-900/20">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <FileText className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-sm">Universal HTML Extraction</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cheerio cleans navigation, footers, and tracking scripts, targeting `article`, `main`, and `job-description` semantic tags.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-3 bg-slate-900/20">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Zap className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-sm">Deterministic Scorer v2</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Passes through hard qualification gates (seniority, location class, compensation floor) with zero hallucinated points.
              </p>
            </div>
          </div>
        )}

        {/* EVALUATED MATCH RESULT CARD */}
        {job && (
          <section className="p-6 rounded-3xl bg-slate-950/80 border border-cyan-500/40 space-y-6 shadow-glow-cyan animate-in fade-in duration-300">
            {/* Header: Company, Title & Score */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-mono text-cyan-300 bg-cyan-500/20 px-2.5 py-0.5 rounded-full border border-cyan-500/30 uppercase">
                    {job.source}
                  </span>
                  <span className="text-sm font-semibold text-white">{job.company}</span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-400">{job.location}</span>
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  {job.title}
                </h3>
                <p className="text-xs text-slate-300 mt-2 max-w-3xl leading-relaxed">
                  {job.matchReason}
                </p>
              </div>

              {/* Prominent Match Gauge */}
              <div className="flex flex-col items-end shrink-0 bg-slate-900/90 p-4 rounded-2xl border border-white/10 min-w-[150px] text-right shadow-lg">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Fit Score</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-4xl font-extrabold font-mono ${
                    job.score >= 70 
                      ? 'text-emerald-400' 
                      : job.score >= 50 
                        ? 'text-amber-400' 
                        : 'text-slate-400'
                  }`}>
                    {job.score}%
                  </span>
                  <span className="text-xs text-slate-500 font-mono">MATCH</span>
                </div>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full mt-2 border capitalize ${
                  job.score >= 70
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : job.score >= 50
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {job.score >= 70 ? 'High Alignment' : job.score >= 50 ? 'Moderate Fit' : 'Low Overlap'}
                </span>
              </div>
            </div>

            {/* Strengths & Considerations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
                <span className="font-mono text-cyan-300 uppercase tracking-wider block font-semibold text-[11px]">
                  Matched Strengths & Verified Claims
                </span>
                <ul className="space-y-2 text-slate-300">
                  {(manualEvalResult.evaluation?.strengths || job.evidence).slice(0, 4).map((st, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{st}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
                <span className="font-mono text-amber-300 uppercase tracking-wider block font-semibold text-[11px]">
                  Key Considerations & Eligibility Notes
                </span>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                    <span><strong>Sponsorship:</strong> <span className="capitalize">{job.sponsorship}</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                    <span><strong>Work Mode:</strong> {job.isRemote ? 'Remote Friendly' : 'Location-Specific'}</span>
                  </li>
                  {job.salary && (
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                      <span><strong>Salary / Comp:</strong> {job.salary}</span>
                    </li>
                  )}
                  {manualEvalResult.evaluation?.concerns && manualEvalResult.evaluation.concerns.length > 0 && (
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <span>{manualEvalResult.evaluation.concerns[0]}</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Detected Tech Stack */}
            {job.techStack.length > 0 && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <span className="text-xs font-mono text-slate-400 block uppercase tracking-wider">Detected Tech Stack</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {job.techStack.map((tech) => (
                    <span key={tech} className="text-xs px-2.5 py-1 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10 flex-wrap gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <a
                  href={job.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium text-xs flex items-center gap-2 shadow-glow-emerald transition-all hover:scale-[1.02]"
                >
                  <span>Open Job Opening Directly</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => setShowKitModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 shadow-glow-emerald transition-all active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>Tailor Application Kit ↗</span>
                </button>
              </div>

              <div>
                {evalSaveSuccess ? (
                  <span className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Saved to Active Openings!</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveEvaluatedJob}
                    disabled={isSavingEvaluatedJob}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-xs font-medium flex items-center gap-2 transition-all"
                  >
                    {isSavingEvaluatedJob ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-4 h-4" />
                        <span>Save to Active Openings</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Kit Studio Modal */}
      {showKitModal && job && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Tailored Application Kit — {job.title} at {job.company}</h3>
              </div>
              <button
                onClick={() => setShowKitModal(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <KitStudio
                jobId={job.id}
                jobTitle={job.title}
                company={job.company}
                onClose={() => setShowKitModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
