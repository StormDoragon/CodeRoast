import React from 'react';
import type { Analysis } from '../lib/analyzer';
import type { Intensity } from '../lib/roastLite';
import type { WorkerRequest, WorkerResponse } from '../lib/worker';

export interface AiHandlers {
  onProgress: (text: string, progress: number) => void;
  onToken: (token: string) => void;
  onDone: (full: string) => void;
  onError: (message: string) => void;
}

// Owns the WebLLM worker: created lazily on the first AI roast, reused after,
// and responses from superseded requests are ignored.
export function useAiWorker(handlers: AiHandlers) {
  const workerRef = React.useRef<Worker | null>(null);
  const requestId = React.useRef(0);
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => () => workerRef.current?.terminate(), []);

  const getWorker = () => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL('../lib/worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data;
      if (m.id !== requestId.current) return;
      const h = handlersRef.current;
      if (m.type === 'progress') h.onProgress(m.text, m.progress);
      else if (m.type === 'token') h.onToken(m.token);
      else if (m.type === 'done') h.onDone(m.full);
      else h.onError(`AI roast failed: ${m.error}. Instant mode still works everywhere.`);
    };
    w.onerror = (e) => {
      handlersRef.current.onError(`AI worker crashed: ${e.message || 'unknown error'}`);
      workerRef.current = null;
    };
    workerRef.current = w;
    return w;
  };

  return (code: string, analysis: Analysis, intensity: Intensity, model: string) => {
    const req: WorkerRequest = { id: ++requestId.current, code, analysis, intensity, model };
    getWorker().postMessage(req);
  };
}
