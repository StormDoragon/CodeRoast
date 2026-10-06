import React from 'react';
import { track } from '../lib/analytics';
import { REPO_URL } from '../lib/config';
import { badRoastUrl } from '../lib/feedback';
import type { Result } from '../lib/result';
import { verdictFor } from '../lib/roastLite';
import { chip, langLabel } from '../lib/ui';
import { RepoCrimeScene } from './RepoCrimeScene';
import { AiRoastView, LiteRoastView, ScoreHeader } from './RoastResult';

interface ResultCardProps {
  result: Result;
  aiStatus: { text: string; progress: number } | null;
  showFixes: boolean;
  onToggleFixes: () => void;
  onRoastAgain: () => void;
  onTryAi?: () => void;
}

function subtitle(result: Result) {
  const a = result.analysis;
  if (result.kind === 'repo') {
    const r = result.repo;
    return `${r.name} · ${r.files.length} files · ${r.totalLines.toLocaleString()} lines · ${a.findings.length} issue types`;
  }
  return `${langLabel(a.lang)} · ${a.metrics.totalLines} lines · ${a.findings.length} issue types · max nesting ${a.metrics.maxDepth}`;
}

const AiProgress: React.FC<{ text: string; progress: number }> = ({ text, progress }) => (
  <div className="mb-4">
    <p className="mb-2 text-sm text-zinc-400">{text}</p>
    <div className="h-1.5 rounded-full bg-zinc-800">
      <div className="h-1.5 rounded-full bg-red-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
    </div>
  </div>
);

export const ResultCard: React.FC<ResultCardProps> = ({ result, aiStatus, showFixes, onToggleFixes, onRoastAgain, onTryAi }) => {
  const v = verdictFor(result.analysis.score);
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <ScoreHeader score={result.analysis.score} title={v.title} emoji={v.emoji} subtitle={subtitle(result)} />
      <div className="my-5 h-px bg-zinc-800" />
      {aiStatus && <AiProgress {...aiStatus} />}
      {result.kind === 'repo' && <RepoCrimeScene repo={result.repo} headline={result.roast.crimeScene} />}
      {result.kind === 'ai' ? (
        <AiRoastView text={result.text} streaming={result.streaming} />
      ) : (
        <LiteRoastView roast={result.roast} showFixes={showFixes} />
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {result.kind !== 'ai' && (
          <>
            <button className={chip(false)} onClick={onRoastAgain}>
              🎲 Roast again
            </button>
            <button className={chip(showFixes)} onClick={onToggleFixes}>
              🩹 {showFixes ? 'Hide' : 'Show'} fixes
            </button>
          </>
        )}
        {onTryAi && (
          <button className={chip(false)} onClick={onTryAi}>
            🧠 Try the AI roast
          </button>
        )}
        <a
          href={badRoastUrl(REPO_URL, result.analysis, result.kind)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('bad_roast')}
          className="ml-auto text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          🙄 Bad roast? Tell the ape
        </a>
      </div>
    </div>
  );
};
