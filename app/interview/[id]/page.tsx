'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mic,
  MicOff,
  PhoneOff,
  Clock,
  Coins,
  Radio,
  Sparkles,
  AlertCircle,
  FileText,
  Layers,
  Code,
  CheckCircle,
} from 'lucide-react';
import { RobotAvatar, RobotState } from '@/components/interview/RobotAvatar';
import { MonacoCppEditor } from '@/components/interview/MonacoCppEditor';
import { ExcalidrawCanvas } from '@/components/interview/ExcalidrawCanvas';
import { AudioRecorder } from '@/lib/interview/audio-recorder';
import { AudioPlayer } from '@/lib/interview/audio-player';
import {
  ClientMessage,
  ServerMessage,
  serializeServerMessage,
  SessionUsageInfo,
} from '@/lib/interview/protocol';
import { INTERVIEW_CONFIG } from '@/lib/interview/config';

interface TranscriptItem {
  id: string;
  speaker: 'interviewer' | 'candidate' | 'system' | 'observer';
  text: string;
  timestamp: string;
}

export default function InterviewRoomPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.id;

  const companyStyle = (searchParams.get('company') || 'google') as 'google' | 'toptal';
  const roundType = (searchParams.get('round') || 'system_design') as
    | 'system_design'
    | 'advanced_dsa_cpp'
    | 'behavioral'
    | 'communication';
  const questionId = searchParams.get('question') || 'sys_flash_sale';

  // Room state
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
  const [robotState, setRobotState] = useState<RobotState>('listening');
  const [robotRms, setRobotRms] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [observerCue, setObserverCue] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [candidateSpeaking, setCandidateSpeaking] = useState<boolean>(false);
  const [usage, setUsage] = useState<SessionUsageInfo | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [scratchpadText, setScratchpadText] = useState<string>('');

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const transcriptsEndRef = useRef<HTMLDivElement | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Session timer
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const sendWsMessage = useCallback((msg: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Initialize Web Audio Player & Recorder
  useEffect(() => {
    const player = new AudioPlayer({
      onRms: (rms) => setRobotRms(rms),
      onPlaybackStateChange: (isPlaying) => {
        if (isPlaying) {
          setRobotState('speaking');
        } else {
          setRobotState('listening');
        }
      },
    });
    playerRef.current = player;

    const recorder = new AudioRecorder({
      chunkDurationMs: 150,
      onAudioChunk: (pcm16Base64) => {
        if (!isMicMuted) {
          sendWsMessage({
            type: 'audio.chunk',
            pcm16Base64,
          });
        }
      },
      onSpeechStateChange: (state) => {
        setCandidateSpeaking(state === 'speaking');
        if (state === 'speaking') {
          // Barge-in: flush local playback instantly
          playerRef.current?.stopAndFlush();
          setRobotState('interrupted');
        }
        sendWsMessage({
          type: 'candidate.speech_state',
          state: state === 'speaking' ? 'speaking' : 'silent',
        });
      },
    });
    recorderRef.current = recorder;

    // Start mic recording
    recorder.start().catch((err) => {
      console.error('Failed to start mic recorder:', err);
    });

    return () => {
      player.close();
      recorder.stop();
    };
  }, [isMicMuted, sendWsMessage]);

  // Connect to Local WebSocket Proxy (:4001)
  useEffect(() => {
    const wsUrl = `ws://${INTERVIEW_CONFIG.wsHost}:${INTERVIEW_CONFIG.wsPort}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      // Send session.start
      ws.send(
        JSON.stringify({
          type: 'session.start',
          sessionId,
          companyStyle,
          roundType,
          questionId,
          candidateProfile: {
            name: 'Manish Kumar Prajapati',
            yearsExperience: 8.5,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;

        switch (msg.type) {
          case 'session.ready':
            console.log('[WS] Session ready:', msg);
            break;

          case 'audio.chunk':
            if (msg.pcm24Base64 && playerRef.current) {
              playerRef.current.enqueueChunk(msg.pcm24Base64);
            }
            break;

          case 'transcript.entry':
            setTranscripts((prev) => {
              const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              return [
                ...prev,
                {
                  id: `tr_${Date.now()}_${Math.random()}`,
                  speaker: msg.speaker,
                  text: msg.text,
                  timestamp: now,
                },
              ];
            });
            break;

          case 'interviewer.state':
            setRobotState(msg.state as RobotState);
            if (msg.state === 'interrupted') {
              playerRef.current?.stopAndFlush();
            }
            break;

          case 'observer.cue':
            setObserverCue(msg.message);
            setTimeout(() => setObserverCue(null), 8000);
            break;

          case 'usage.update':
            setUsage(msg.usage);
            break;

          case 'session.ended':
            setSessionCompleted(true);
            break;

          case 'error':
            console.error('[WS] Server error:', msg);
            break;
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    };

    ws.onclose = () => {
      setWsStatus('closed');
    };

    ws.onerror = (err) => {
      console.error('[WS] Connection error:', err);
      setWsStatus('error');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [sessionId, companyStyle, roundType, questionId]);

  // End interview handler
  const endInterview = () => {
    if (confirm('Are you sure you want to conclude this interview session?')) {
      sendWsMessage({
        type: 'session.end',
        reason: 'candidate_concluded',
      });
      recorderRef.current?.stop();
      playerRef.current?.stopAndFlush();
      setSessionCompleted(true);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center space-x-3">
          <div className="px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {companyStyle}
          </div>
          <div className="px-2.5 py-1 rounded-md text-xs font-semibold font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {roundType.replace(/_/g, ' ')}
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="text-sm font-semibold text-slate-200 truncate max-w-md">
            {questionId.replace(/_/g, ' ')}
          </div>
        </div>

        <div className="flex items-center space-x-5">
          {/* Live Timer */}
          <div className="flex items-center space-x-1.5 font-mono text-sm text-slate-300 bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          {/* Session Cost Tally (INR) */}
          <div className="flex items-center space-x-1.5 font-mono text-xs text-slate-300 bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-800">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>₹{usage?.costInr ? usage.costInr.toFixed(2) : '0.00'}</span>
          </div>

          {/* WS Status Badge */}
          <div className="flex items-center space-x-1.5 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                wsStatus === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : wsStatus === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-red-400'
              }`}
            />
            <span className="text-slate-400 capitalize">{wsStatus}</span>
          </div>

          {/* End Session Button */}
          <button
            onClick={endInterview}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold text-xs transition"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call</span>
          </button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel: Robot Avatar & Live Transcript (40%) */}
        <div className="w-2/5 flex flex-col border-r border-slate-800 bg-slate-950/40">
          {/* Avatar Stage */}
          <div className="py-6 px-4 flex flex-col items-center justify-center border-b border-slate-800/80 bg-slate-900/30 relative">
            <RobotAvatar state={robotState} rms={robotRms} size={130} />

            {/* Candidate Voice Activity Indicator */}
            <div className="mt-2 text-xs font-mono text-slate-400 flex items-center space-x-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  candidateSpeaking ? 'bg-purple-400 animate-ping' : 'bg-slate-600'
                }`}
              />
              <span>
                {candidateSpeaking ? 'Candidate Speaking (Barge-In Active)' : 'Mic Live & Listening'}
              </span>
            </div>

            {/* Observer Alert Banner */}
            {observerCue && (
              <div className="absolute bottom-2 left-4 right-4 bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs px-3 py-1.5 rounded-lg flex items-center space-x-2 animate-pulse shadow-lg">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="truncate">{observerCue}</span>
              </div>
            )}
          </div>

          {/* Live Transcript Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
            <div className="text-xs font-mono font-semibold uppercase text-slate-500 tracking-wider mb-2">
              Spoken Transcript Captions
            </div>

            {transcripts.length === 0 ? (
              <div className="text-xs text-slate-500 italic text-center py-8">
                Conversation starting... Spoken captions will appear here in real time.
              </div>
            ) : (
              transcripts.map((t) => {
                const isInterviewer = t.speaker === 'interviewer';
                return (
                  <div
                    key={t.id}
                    className={`flex flex-col ${
                      isInterviewer ? 'items-start' : 'items-end'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-slate-500 mb-0.5">
                      {isInterviewer ? 'Interviewer' : 'Candidate'} • {t.timestamp}
                    </div>
                    <div
                      className={`max-w-[85%] text-xs rounded-xl px-3.5 py-2 leading-relaxed ${
                        isInterviewer
                          ? 'bg-slate-900 text-slate-200 border border-slate-800'
                          : 'bg-purple-950/60 text-purple-200 border border-purple-800/40'
                      }`}
                    >
                      {t.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={transcriptsEndRef} />
          </div>

          {/* Bottom Audio Controls */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <button
              onClick={() => setIsMicMuted(!isMicMuted)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                isMicMuted
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMicMuted ? 'Mic Muted' : 'Mic Active'}</span>
            </button>

            <div className="text-xs text-slate-500 font-mono">
              24kHz Audio • Full Duplex
            </div>
          </div>
        </div>

        {/* Right Panel: Excalidraw Canvas / Monaco Editor / Notes (60%) */}
        <div className="w-3/5 flex flex-col p-4 bg-slate-950">
          {roundType === 'system_design' && (
            <ExcalidrawCanvas
              onDiagramSnapshot={(digest, hash) => {
                sendWsMessage({
                  type: 'artifact.update',
                  kind: 'diagram',
                  contentText: digest,
                  contentHash: hash,
                });
              }}
            />
          )}

          {roundType === 'advanced_dsa_cpp' && (
            <MonacoCppEditor
              onCodeSnapshot={(code, digest, hash) => {
                sendWsMessage({
                  type: 'artifact.update',
                  kind: 'code',
                  contentText: digest,
                  contentHash: hash,
                });
              }}
            />
          )}

          {(roundType === 'behavioral' || roundType === 'communication') && (
            <div className="h-full flex flex-col bg-slate-900 rounded-lg border border-slate-800 p-4">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 mb-3 border-b border-slate-800 pb-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="font-semibold text-slate-200">Scratchpad / STAR Framework Notes</span>
              </div>
              <textarea
                value={scratchpadText}
                onChange={(e) => setScratchpadText(e.target.value)}
                placeholder="Use this scratchpad to jot down STAR bullet points (Situation, Task, Action, Result), scale metrics, or communication anchors..."
                className="flex-1 w-full bg-slate-950 text-slate-200 p-4 rounded-lg font-mono text-xs resize-none focus:outline-none focus:border-purple-500 border border-slate-800 leading-relaxed"
              />
            </div>
          )}
        </div>
      </div>

      {/* Session Completed Dialog */}
      {sessionCompleted && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Interview Session Ended</h2>
              <p className="text-xs text-slate-400">
                Your session transcript and artifacts have been saved into SQLite.
              </p>
            </div>

            {usage && (
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 font-mono text-xs space-y-1.5 text-left">
                <div className="flex justify-between text-slate-400">
                  <span>Duration:</span>
                  <span className="text-slate-200">{formatTimer(elapsedSeconds)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Estimated Cost:</span>
                  <span className="text-emerald-400 font-bold">₹{usage.costInr.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Audio In/Out Tokens:</span>
                  <span className="text-slate-200">
                    {usage.inputAudioTokens} / {usage.outputAudioTokens}
                  </span>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => router.push('/interview')}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Back to Setup
              </button>
              <button
                onClick={() => router.push('/interview/history')}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition shadow-lg shadow-purple-900/30"
              >
                View History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
