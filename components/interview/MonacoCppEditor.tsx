'use client';

import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { generateCodeDigest } from '@/lib/interview/digest';

interface MonacoCppEditorProps {
  initialCode?: string;
  onCodeSnapshot?: (code: string, digest: string, hash: string) => void;
  debounceMs?: number;
}

const DEFAULT_STARTER_CPP = `#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <algorithm>

using namespace std;

// Solution implementation
class Solution {
public:
    // Write your solution here
};

int main() {
    cout << "Test run initialized." << endl;
    return 0;
}
`;

export const MonacoCppEditor: React.FC<MonacoCppEditorProps> = ({
  initialCode = DEFAULT_STARTER_CPP,
  onCodeSnapshot,
  debounceMs = 2000,
}) => {
  const [code, setCode] = useState<string>(initialCode);
  const lastHashRef = useRef<string>('');
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const { digest, hash } = generateCodeDigest(code);
      if (hash !== lastHashRef.current) {
        lastHashRef.current = hash;
        onCodeSnapshot?.(code, digest, hash);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code, debounceMs, onCodeSnapshot]);

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden border border-slate-800">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 font-mono">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
          <span className="font-semibold text-slate-200">solution.cpp</span>
          <span className="text-slate-500">(C++20, Real-Time Ingestion)</span>
        </div>
        <div className="text-slate-500">
          Autocomplete &amp; snippets disabled for interview realism
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="cpp"
          value={code}
          theme="vs-dark"
          onChange={(val) => setCode(val || '')}
          options={{
            fontSize: 14,
            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
            minimap: { enabled: false },
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            wordBasedSuggestions: 'off',
            parameterHints: { enabled: false },
            snippetSuggestions: 'none',
            tabCompletion: 'off',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
          }}
        />
      </div>
    </div>
  );
};
