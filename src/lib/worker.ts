import { aiRoast } from './roast';

export type WorkerRequest = {
  id: number;
  code: string;
  analysis: import('./analyzer').Analysis;
  intensity: import('./roastLite').Intensity;
  model: string;
};

export type WorkerResponse =
  | { id: number; type: 'progress'; text: string; progress: number }
  | { id: number; type: 'token'; token: string }
  | { id: number; type: 'done'; full: string }
  | { id: number; type: 'error'; error: string };

const post = (m: WorkerResponse) => self.postMessage(m);

self.addEventListener('message', async (e: MessageEvent<WorkerRequest>) => {
  const { id, code, analysis, intensity, model } = e.data;
  try {
    const full = await aiRoast(
      code,
      analysis,
      intensity,
      model,
      (token) => post({ id, type: 'token', token }),
      (r) => post({ id, type: 'progress', text: r.text, progress: r.progress }),
    );
    post({ id, type: 'done', full });
  } catch (err) {
    post({ id, type: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});
