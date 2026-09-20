'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  Download, 
  Printer, 
  Mail, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { TailoredApplicationKit } from '@/lib/kit/types';
import { generateGmailDraftUrl } from '@/lib/kit/export';

interface KitStudioProps {
  jobId: string;
  jobTitle: string;
  company: string;
  onClose?: () => void;
}

export default function KitStudio({
  jobId,
  jobTitle,
  company,
  onClose,
}: KitStudioProps) {
  const [kit, setKit] = useState<TailoredApplicationKit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'resume' | 'coverLetter' | 'answers'>('resume');
  const [screeningAnswers, setScreeningAnswers] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadOrGenerateKit = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/kit/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (data.success && data.kit) {
        setKit(data.kit);
      }
    } catch (err) {
      console.error('Failed to generate application kit:', err);
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  const loadAnswers = async () => {
    try {
      const res = await fetch('/api/kit/answers');
      const data = await res.json();
      if (data.success && data.answers) {
        setScreeningAnswers(data.answers);
      }
    } catch (err) {
      console.warn('Failed to load screening answers:', err);
    }
  };

  useEffect(() => {
    loadOrGenerateKit();
    loadAnswers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const handleDownloadDocx = async () => {
    if (!kit) return;
    try {
      const res = await fetch('/api/kit/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitId: kit.id, format: 'docx' }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Manish_Prajapati_${company.replace(/\s+/g, '_')}_Resume.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handlePrintHtml = async () => {
    if (!kit) return;
    try {
      const res = await fetch('/api/kit/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitId: kit.id, format: 'html' }),
      });
      const html = await res.text();
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
      }
    } catch (err) {
      console.error('Print error:', err);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isLoading || isGenerating) {
    return (
      <div className="glass-panel p-12 text-center rounded-3xl space-y-4">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
        <div>
          <h3 className="text-base font-bold text-white">Generating Zero-Fabrication Application Kit</h3>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Mapping requirements → ranking banked bullets → auditing proof points...
          </p>
        </div>
      </div>
    );
  }

  if (!kit) {
    return (
      <div className="glass-panel p-8 text-center rounded-3xl text-rose-300">
        Failed to load Application Kit. Please ensure the job exists in the database.
      </div>
    );
  }

  const gmailUrl = generateGmailDraftUrl({
    subject: `Application: ${jobTitle} — Manish Kumar Prajapati`,
    body: kit.coverLetter.body,
  });

  return (
    <div className="space-y-5">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold">
              Variant: {kit.variantId}
            </span>
            <span className="text-xs text-slate-400 font-mono">{company}</span>
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            Tailored Application Kit Studio
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadDocx}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-glow-emerald"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download DOCX</span>
          </button>
          <button
            onClick={handlePrintHtml}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-mono flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PDF</span>
          </button>
          <a
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-glow-mint"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Gmail Draft ↗</span>
          </a>
        </div>
      </div>

      {/* SKILL COVERAGE & GAP AUDIT PANEL */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 font-bold">JD REQUIREMENT COVERAGE AUDIT</span>
          <span className="text-cyan-400 font-bold">
            {Math.round(kit.coverage.coverageRatio * 100)}% Match
          </span>
        </div>

        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
            style={{ width: `${Math.round(kit.coverage.coverageRatio * 100)}%` }}
          ></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
          <div>
            <span className="text-[11px] font-mono text-emerald-400 font-bold block mb-1">
              ✓ Covered Banked Skills ({kit.coverage.coveredSkills.length}):
            </span>
            <div className="flex flex-wrap gap-1">
              {kit.coverage.coveredSkills.map((s) => (
                <span key={s} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-mono text-amber-400 font-bold block mb-1">
              ⚠️ Explicit Gaps (Never Papered Over):
            </span>
            <div className="flex flex-wrap gap-1">
              {kit.coverage.gapList.length === 0 ? (
                <span className="text-[10px] text-slate-500 font-mono">No gaps detected!</span>
              ) : (
                kit.coverage.gapList.map((g) => (
                  <span key={g} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono">
                    {g}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SUB-TABS */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveSubTab('resume')}
          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
            activeSubTab === 'resume'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Tailored Resume
        </button>
        <button
          onClick={() => setActiveSubTab('coverLetter')}
          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
            activeSubTab === 'coverLetter'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Cover Letter ({kit.coverLetter.wordCount} words)
        </button>
        <button
          onClick={() => setActiveSubTab('answers')}
          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
            activeSubTab === 'answers'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ATS Screening Answers Cheat Sheet
        </button>
      </div>

      {/* 1. TAILORED RESUME PREVIEW */}
      {activeSubTab === 'resume' && (
        <div className="p-6 rounded-2xl bg-slate-950/70 border border-white/10 space-y-4 max-h-[600px] overflow-y-auto">
          <div className="text-center pb-3 border-b border-white/10 space-y-0.5">
            <h4 className="text-base font-bold text-white uppercase tracking-wider">
              {kit.tailoredResume.name}
            </h4>
            <p className="text-xs text-slate-400 font-mono">
              Single-column, ATS-safe format • Prioritized based on {company} tech stack
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase">Summary:</span>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{kit.tailoredResume.summary}</p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase">Experience &amp; Prioritized Bullets:</span>
            {kit.tailoredResume.experience.map((exp, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-white">
                  <span>{exp.role} — {exp.company}</span>
                  <span className="font-mono text-slate-400 text-[11px]">{exp.period}</span>
                </div>
                <ul className="space-y-1.5">
                  {exp.bullets.map((b, bi) => (
                    <li key={bi} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-cyan-400 shrink-0">•</span>
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. COVER LETTER PREVIEW */}
      {activeSubTab === 'coverLetter' && (
        <div className="p-6 rounded-2xl bg-slate-950/70 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-purple-400 font-bold uppercase">
              Zero-Fabrication Cover Letter ({kit.coverLetter.wordCount} words)
            </span>
            <button
              onClick={() => copyToClipboard(kit.coverLetter.body, 'cover_letter')}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono flex items-center gap-1.5"
            >
              {copiedKey === 'cover_letter' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'cover_letter' ? 'Copied!' : 'Copy Letter'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-900 border border-white/5 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
            {kit.coverLetter.body}
          </pre>
        </div>
      )}

      {/* 3. SCREENING ANSWERS CHEAT SHEET */}
      {activeSubTab === 'answers' && (
        <div className="p-5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-3">
          <p className="text-xs text-slate-400">
            Copy-ready answers for ATS application forms (Workday, Greenhouse, Lever, Ashby):
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Notice Period', value: `${screeningAnswers?.availability?.noticePeriodDays || 60} Days (Negotiable)` },
              { label: 'Expected Compensation', value: screeningAnswers?.compensation?.expectedAnnualSalary || '35–65 LPA' },
              { label: 'Minimum Floor', value: screeningAnswers?.compensation?.minimumSalary || '25 LPA' },
              { label: 'Work Authorization (India)', value: screeningAnswers?.workAuthorization?.india || 'Authorized Citizen' },
              { label: 'Visa Sponsorship (Intl)', value: screeningAnswers?.workAuthorization?.international || 'Required for Japan/Korea' },
              { label: 'Portfolio URL', value: screeningAnswers?.personal?.portfolioUrl || 'https://manishprajapati.co.in' },
              { label: 'GitHub Profile', value: screeningAnswers?.personal?.githubUrl || 'https://github.com/manish-1614' },
              { label: 'LinkedIn Profile', value: screeningAnswers?.personal?.linkedinUrl || 'https://linkedin.com/in/mkprajapati1614' },
            ].map((ans) => (
              <div key={ans.label} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">{ans.label}</span>
                  <span className="text-xs font-mono text-white mt-0.5 block">{ans.value}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(ans.value, ans.label)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                  title="Copy"
                >
                  {copiedKey === ans.label ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
