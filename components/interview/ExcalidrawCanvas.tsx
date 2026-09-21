'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { generateExcalidrawDigest } from '@/lib/interview/digest';

// Dynamic import with SSR disabled to prevent server-side canvas errors
const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-slate-900 text-slate-400 font-mono text-sm">
        Initializing Excalidraw Whiteboard Canvas...
      </div>
    ),
  }
);

interface ExcalidrawCanvasProps {
  onDiagramSnapshot?: (digest: string, hash: string, componentCount: number) => void;
  debounceMs?: number;
}

export const ExcalidrawCanvas: React.FC<ExcalidrawCanvasProps> = ({
  onDiagramSnapshot,
  debounceMs = 3000,
}) => {
  const lastHashRef = useRef<string>('');
  const timerRef = useRef<any>(null);
  const [stats, setStats] = useState({ components: 0, connections: 0 });

  const handleChange = (elements: readonly any[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const { digest, hash, componentCount, connectionCount } = generateExcalidrawDigest(elements);
      setStats({ components: componentCount, connections: connectionCount });

      if (hash !== lastHashRef.current) {
        lastHashRef.current = hash;
        onDiagramSnapshot?.(digest, hash, componentCount);
      }
    }, debounceMs);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 text-xs text-slate-400 font-mono">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
          <span className="font-semibold text-slate-200">Architecture Canvas</span>
          <span className="text-slate-500">(Excalidraw, Real-Time Digest Ingestion)</span>
        </div>
        <div className="flex items-center space-x-3 text-slate-400">
          <span>
            Nodes: <strong className="text-purple-300">{stats.components}</strong>
          </span>
          <span>
            Links: <strong className="text-purple-300">{stats.connections}</strong>
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        <Excalidraw
          onChange={handleChange}
          theme="dark"
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
            },
          }}
        />
      </div>
    </div>
  );
};
