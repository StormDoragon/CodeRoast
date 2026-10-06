import React from 'react';
import { verdictFor } from '../lib/roastLite';
import type { BattleFighter, Shared } from '../lib/share';
import { ScoreHeader } from './RoastResult';

const frame = 'mb-10 mt-8 rounded-2xl border border-red-900/60 bg-gradient-to-br from-zinc-900 to-red-950/40 p-6';
const cta = 'mt-6 rounded-xl bg-red-600 px-6 py-3 text-lg font-black text-white hover:bg-red-500';

const Fighter: React.FC<{ f: BattleFighter; won: boolean }> = ({ f, won }) => (
  <div className={`flex-1 rounded-xl border p-4 ${won ? 'border-yellow-500/60 bg-yellow-950/20' : 'border-zinc-800'}`}>
    <p className="mb-3 font-bold text-zinc-100">
      {won && '🏆 '}
      {f.m} <span className="font-normal text-zinc-500">· {f.l}</span>
    </p>
    <ScoreHeader score={f.s} title={f.t} emoji={verdictFor(f.s).emoji} />
    <ul className="mt-4 space-y-2 text-sm text-zinc-200">
      {f.r.map((l, i) => (
        <li key={i}>“{l}”</li>
      ))}
    </ul>
  </div>
);

// What someone sees when they open a share link.
export const SharedView: React.FC<{ shared: Shared; onCta: () => void }> = ({ shared, onCta }) => {
  if (shared.kind === 'battle') {
    const { a, b, h, w: winner } = shared.p;
    return (
      <section className={frame}>
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-red-400">⚔️ A roast battle happened</p>
        <div className="flex flex-col gap-4 md:flex-row">
          <Fighter f={a} won={winner === 'a'} />
          <Fighter f={b} won={winner === 'b'} />
        </div>
        {h && <p className="mt-4 font-semibold italic text-zinc-300">{h}</p>}
        <button onClick={onCta} className={cta}>
          Start your own battle →
        </button>
      </section>
    );
  }
  const p = shared.p;
  return (
    <section className={frame}>
      <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-red-400">
        Someone’s {p.l} code ({p.n} lines) just got roasted
      </p>
      <ScoreHeader score={p.s} title={p.t} emoji={verdictFor(p.s).emoji} />
      <ul className="mt-6 space-y-2">
        {p.r.map((l, i) => (
          <li key={i} className="text-zinc-100">
            “{l}”
          </li>
        ))}
      </ul>
      <button onClick={onCta} className={cta}>
        Think you can beat {p.s}/10? Roast your code →
      </button>
    </section>
  );
};
