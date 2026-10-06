import React from 'react';
import type { SavedRoast } from '../lib/storage';
import { langLabel } from '../lib/ui';

export const HistoryList: React.FC<{ history: SavedRoast[]; onClear: () => void }> = ({ history, onClear }) => {
  if (history.length === 0) return null;
  return (
    <section className="mt-16">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-100">Your past roasts</h2>
        <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={onClear}>
          Clear history
        </button>
      </div>
      <ul className="space-y-2">
        {history.map((h) => (
          <li key={h.id} className="rounded-lg border border-zinc-900 bg-zinc-900/40">
            <details>
              <summary className="cursor-pointer px-4 py-3 text-sm">
                <span className="font-bold text-zinc-100">{h.score}/10</span>{' '}
                <span className="text-zinc-400">
                  {h.title} · {langLabel(h.lang)} · {new Date(h.createdAt).toLocaleString()}
                </span>
              </summary>
              <pre className="whitespace-pre-wrap px-4 pb-4 text-sm text-zinc-300">{h.text}</pre>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
};
