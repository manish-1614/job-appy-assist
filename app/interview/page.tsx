'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Mic,
  MicOff,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Clock,
  History,
  ArrowRight,
  Layers,
  Code,
  Users,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import Sidebar from '@/components/navigation/Sidebar';
import { QuestionDefinition } from '@/lib/interview/prompts';
import { BudgetInfo } from '@/lib/interview/protocol';

export default function InterviewSetupPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionDefinition[]>([]);
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Form selections
  const [companyStyle, setCompanyStyle] = useState<'google' | 'toptal'>('google');
  const [roundType, setRoundType] = useState<
    'system_design' | 'advanced_dsa_cpp' | 'behavioral' | 'communication'
  >('system_design');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');

  // Mic test
  const [micTesting, setMicTesting] = useState<boolean>(false);
  const [micRms, setMicRms] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/interview/questions');
        const data = await res.json();
        if (data.success) {
          setQuestions(data.questions);
          setBudget(data.budget);

          // Select first question matching initial round
          const matching = data.questions.filter(
            (q: QuestionDefinition) => q.roundType === 'system_design'
          );
          if (matching.length > 0) {
            setSelectedQuestionId(matching[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load setup data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Update selected question when roundType changes
  useEffect(() => {
    const matching = questions.filter((q) => q.roundType === roundType);
    if (matching.length > 0 && !matching.some((q) => q.id === selectedQuestionId)) {
      setSelectedQuestionId(matching[0].id);
    }
  }, [roundType, questions, selectedQuestionId]);

  // Test microphone
  const toggleMicTest = async () => {
    if (micTesting) {
      setMicTesting(false);
      setMicRms(0);
      return;
    }

    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);

      setMicTesting(true);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const check = () => {
        if (!stream.active) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setMicRms(Math.sqrt(sum / data.length));
        if (stream.active) {
          requestAnimationFrame(check);
        }
      };
      requestAnimationFrame(check);
    } catch (err: any) {
      setMicError(err.message || 'Microphone access denied');
      setMicTesting(false);
    }
  };

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId);

  const startSession = () => {
    if (!selectedQuestionId) return;
    const sessionId = `ses_${Date.now()}`;
    router.push(
      `/interview/${sessionId}?company=${companyStyle}&round=${roundType}&question=${selectedQuestionId}`
    );
  };

  const roundOptions = [
    {
      id: 'system_design',
      label: 'System Design',
      icon: Layers,
      desc: 'Excalidraw canvas, 50x spikes, backpressure, decoupling, outbox pattern',
    },
    {
      id: 'advanced_dsa_cpp',
      label: 'Advanced DSA (C++)',
      icon: Code,
      desc: 'Monaco C++ editor, complexity analysis, hint ladder, dry-run, memory safety',
    },
    {
      id: 'behavioral',
      label: 'Behavioral & Leadership',
      icon: Users,
      desc: 'Googleyness, STAR framework, resolving ambiguity, unearned praise defense',
    },
    {
      id: 'communication',
      label: 'Communication Screen',
      icon: MessageSquare,
      desc: 'Toptal style, structured explanations, technical precision, pushback test',
    },
  ] as const;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto p-8 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-glow-purple">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    Mock-Interview Voice Simulator
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      Gemini Live Duplex
                    </span>
                  </h1>
                  <p className="text-sm text-slate-400">
                    Multimodal voice interviews with real-time Excalidraw topology &amp; Monaco C++ ingestion.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push('/interview/history')}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition text-sm font-medium"
            >
              <History className="w-4 h-4" />
              <span>Past Sessions</span>
            </button>
          </div>

          {/* Monthly Budget Meter Card (ADR-004) */}
          {budget && (
            <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-slate-200">
                    Monthly Gemini Live Budget Cap (ADR-004)
                  </span>
                </div>
                <div className="font-mono text-xs text-slate-300">
                  <span className="text-emerald-400 font-bold">₹{budget.monthlyCostInr.toFixed(2)}</span> / ₹
                  {budget.budgetInr.toLocaleString()} ({budget.percentUsed}%)
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    budget.percentUsed >= 80
                      ? 'bg-amber-500'
                      : budget.percentUsed >= 95
                      ? 'bg-red-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, budget.percentUsed)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Remaining: ₹{budget.budgetRemainingInr.toFixed(2)}</span>
                <span className="capitalize">
                  Status:{' '}
                  <strong
                    className={
                      budget.warningLevel === 'none'
                        ? 'text-emerald-400'
                        : budget.warningLevel === 'warning'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }
                  >
                    {budget.warningLevel}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* Form Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Setup Options */}
            <div className="lg:col-span-2 space-y-6">
              {/* 1. Company Style */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                  1. Target Interviewer Persona
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setCompanyStyle('google')}
                    className={`p-4 rounded-xl border text-left transition ${
                      companyStyle === 'google'
                        ? 'bg-blue-950/40 border-blue-500 text-white shadow-glow-blue'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-base text-blue-300">Google Style</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Rigorous technical evaluation, scale verification, zero praise, STAR metrics.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompanyStyle('toptal')}
                    className={`p-4 rounded-xl border text-left transition ${
                      companyStyle === 'toptal'
                        ? 'bg-purple-950/40 border-purple-500 text-white shadow-glow-purple'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-base text-purple-300">Toptal Style</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Fast-paced technical screening, structured communication, edge case testing.
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Round Type */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                  2. Round Format &amp; Tooling
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {roundOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = roundType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRoundType(opt.id as any)}
                        className={`p-4 rounded-xl border text-left transition flex items-start space-x-3 ${
                          isSelected
                            ? 'bg-slate-800/90 border-purple-500 text-white shadow-md'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-200">{opt.label}</div>
                          <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                            {opt.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Question Bank */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                  3. Select Problem from Question Bank
                </label>
                <select
                  value={selectedQuestionId}
                  onChange={(e) => setSelectedQuestionId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  {questions
                    .filter((q) => q.roundType === roundType)
                    .map((q) => (
                      <option key={q.id} value={q.id}>
                        [{q.category}] {q.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Right 1 Col: Preview & Mic Check */}
            <div className="space-y-6">
              {/* Question Preview Card */}
              <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="text-xs font-mono font-semibold uppercase text-purple-400 tracking-wider">
                  Question Preview
                </div>

                {selectedQuestion ? (
                  <div className="space-y-3">
                    <h3 className="font-bold text-base text-white">{selectedQuestion.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                      &quot;{selectedQuestion.interviewerPrompt}&quot;
                    </p>

                    {selectedQuestion.expectedScale && (
                      <div className="space-y-1 text-xs">
                        <div className="font-semibold text-slate-400">Scale Parameters:</div>
                        {Object.entries(selectedQuestion.expectedScale).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-slate-300 font-mono">
                            <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                            <span>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">No question selected</div>
                )}
              </div>

              {/* Microphone Pre-Flight Test */}
              <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono font-semibold uppercase text-slate-400 tracking-wider">
                    Audio Input Test
                  </div>
                  <button
                    type="button"
                    onClick={toggleMicTest}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                      micTesting
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {micTesting ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{micTesting ? 'Stop Test' : 'Test Mic'}</span>
                  </button>
                </div>

                {micTesting && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>Mic Input Level</span>
                      <span>{Math.round(micRms * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-75"
                        style={{ width: `${Math.min(100, micRms * 300)}%` }}
                      />
                    </div>
                  </div>
                )}

                {micError && (
                  <div className="text-xs text-red-400 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{micError}</span>
                  </div>
                )}
              </div>

              {/* Start Button */}
              <button
                type="button"
                onClick={startSession}
                disabled={loading || !selectedQuestionId || (budget?.allowed === false)}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-98"
              >
                <span>Enter Interview Room</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
