import React from 'react';
import { BananaMeter, scoreTone } from './BananaMeter';
import type { LiteRoast } from '../lib/roastLite';

interface ScoreHeaderProps {
  score: number;
  title: string;
  emoji: string;
  subtitle?: string;
}

export const ScoreHeader: React.FC<ScoreHeaderProps> = ({ score, title, emoji, subtitle }) => {
  const tone = scoreTone(score);
  return (
    <div className="flex items-center gap-5">
      <div className="text-center">
        <div className={`text-6xl font-black leading-none ${tone.text}`}>{score}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">/ 10</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Banana Score</div>
        <div className="mb-2 text-2xl font-extrabold text-zinc-50">
          {emoji} {title}
        </div>
        <BananaMeter score={score} />
        {subtitle && <div className="mt-2 text-xs text-zinc-500">{subtitle}</div>}
      </div>
    </div>
  );
};

interface LiteRoastViewProps {
  roast: LiteRoast;
  showFixes: boolean;
}

export const LiteRoastView: React.FC<LiteRoastViewProps> = ({ roast, showFixes }) => (
  <div className="space-y-4">
    <p className="text-lg font-semibold text-zinc-100">{roast.opener}</p>
    <ul className="space-y-3">
      {roast.lines.map((l, i) => (
        <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-zinc-100">{l.joke}</p>
          {l.lines.length > 0 && (
            <p className="mt-1 font-mono text-xs text-red-400">receipts: line{l.lines.length > 1 ? 's' : ''} {l.lines.join(', ')}</p>
          )}
          {showFixes && <p className="mt-2 text-sm text-emerald-300">↳ Fix: {l.fix}</p>}
        </li>
      ))}
    </ul>
    <p className="font-semibold italic text-zinc-300">{roast.closer}</p>
  </div>
);

export const AiRoastView: React.FC<{ text: string; streaming: boolean }> = ({ text, streaming }) => (
  <div className="whitespace-pre-wrap leading-relaxed text-zinc-100">
    {text}
    {streaming && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-red-500 align-middle" />}
  </div>
);
