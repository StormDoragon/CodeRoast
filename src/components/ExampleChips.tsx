import React from 'react';
import { EXAMPLES, type Example } from '../lib/examples';

const pill = 'rounded-full border border-zinc-800 px-3 py-1 text-xs hover:border-red-500';

export const ExampleChips: React.FC<{ onPick: (ex: Example) => void; onClear: () => void }> = ({ onPick, onClear }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Try:</span>
    {EXAMPLES.map((ex) => (
      <button key={ex.label} onClick={() => onPick(ex)} className={`${pill} text-zinc-300`}>
        {ex.label}
      </button>
    ))}
    <button onClick={onClear} className={`${pill} text-zinc-500`}>
      Clear
    </button>
  </div>
);
