'use client';

import React from 'react';

export type RobotState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted';

interface RobotAvatarProps {
  state: RobotState;
  rms?: number;
  size?: number;
}

export const RobotAvatar: React.FC<RobotAvatarProps> = ({
  state,
  rms = 0,
  size = 140,
}) => {
  // Map state to theme colors
  const stateThemes: Record<
    RobotState,
    {
      glow: string;
      accent: string;
      eye: string;
      label: string;
      badgeBg: string;
      badgeText: string;
    }
  > = {
    idle: {
      glow: 'rgba(148, 163, 184, 0.2)',
      accent: '#94a3b8',
      eye: '#cbd5e1',
      label: 'IDLE',
      badgeBg: 'bg-slate-800 text-slate-400 border-slate-700',
      badgeText: 'text-slate-400',
    },
    listening: {
      glow: 'rgba(16, 185, 129, 0.35)',
      accent: '#10b981',
      eye: '#34d399',
      label: 'LISTENING',
      badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
      badgeText: 'text-emerald-400',
    },
    thinking: {
      glow: 'rgba(59, 130, 246, 0.4)',
      accent: '#3b82f6',
      eye: '#60a5fa',
      label: 'THINKING',
      badgeBg: 'bg-blue-950/80 text-blue-300 border-blue-500/40',
      badgeText: 'text-blue-400',
    },
    speaking: {
      glow: 'rgba(217, 70, 239, 0.45)',
      accent: '#d946ef',
      eye: '#f0abfc',
      label: 'SPEAKING',
      badgeBg: 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-500/40',
      badgeText: 'text-fuchsia-400',
    },
    interrupted: {
      glow: 'rgba(239, 68, 68, 0.5)',
      accent: '#ef4444',
      eye: '#f87171',
      label: 'INTERRUPTED',
      badgeBg: 'bg-red-950/80 text-red-300 border-red-500/40',
      badgeText: 'text-red-400',
    },
  };

  const currentTheme = stateThemes[state] || stateThemes.idle;

  // Compute mouth open scale based on RMS
  const clampedRms = Math.min(1, Math.max(0, rms));
  const mouthScaleY = state === 'speaking' ? Math.max(0.3, clampedRms * 3.5) : 0.15;

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <div
        className="relative flex items-center justify-center transition-all duration-300"
        style={{
          width: size,
          height: size,
        }}
      >
        {/* Ambient Glow Aura */}
        <div
          className="absolute inset-0 rounded-full blur-xl transition-all duration-300 pointer-events-none"
          style={{
            backgroundColor: currentTheme.glow,
            transform: state === 'speaking' ? `scale(${1 + clampedRms * 0.4})` : 'scale(1)',
          }}
        />

        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-lg"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Antenna */}
          <line
            x1="50"
            y1="25"
            x2="50"
            y2="10"
            stroke={currentTheme.accent}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="8"
            r="4.5"
            fill={currentTheme.accent}
            className={state === 'thinking' ? 'animate-ping' : ''}
          />

          {/* Ears */}
          <rect x="18" y="44" width="4" height="12" rx="2" fill="#475569" />
          <rect x="78" y="44" width="4" height="12" rx="2" fill="#475569" />

          {/* Head Chassis */}
          <rect
            x="22"
            y="25"
            width="56"
            height="50"
            rx="12"
            fill="#1e293b"
            stroke="#334155"
            strokeWidth="2.5"
          />

          {/* Face Screen Plate */}
          <rect
            x="27"
            y="31"
            width="46"
            height="38"
            rx="8"
            fill="#0f172a"
            stroke={currentTheme.accent}
            strokeWidth="1.5"
          />

          {/* Eyes */}
          {state === 'thinking' ? (
            // Rotating or spinning indicator for thinking
            <g transform="translate(50, 44)">
              <circle cx="0" cy="0" r="8" fill="none" stroke={currentTheme.eye} strokeWidth="2" strokeDasharray="6 4" className="animate-spin" />
            </g>
          ) : (
            <>
              {/* Left Eye */}
              <circle
                cx="40"
                cy="44"
                r={state === 'interrupted' ? 5.5 : 4}
                fill={currentTheme.eye}
              />
              {/* Right Eye */}
              <circle
                cx="60"
                cy="44"
                r={state === 'interrupted' ? 5.5 : 4}
                fill={currentTheme.eye}
              />
            </>
          )}

          {/* Mouth Bar (Dynamic RMS wave or bar) */}
          <g transform="translate(50, 58)">
            <rect
              x="-12"
              y={-2 * mouthScaleY}
              width="24"
              height={Math.max(3, 10 * mouthScaleY)}
              rx="2"
              fill={currentTheme.accent}
              className="transition-all duration-75"
            />
          </g>
        </svg>
      </div>

      {/* State Badge */}
      <div
        className={`mt-2 px-3 py-0.5 text-xs font-mono font-semibold tracking-wider rounded-full border ${currentTheme.badgeBg} transition-colors duration-200`}
      >
        {currentTheme.label}
      </div>
    </div>
  );
};
