import React from 'react';
import { scoreTone } from './BananaMeter';
import type { RepoAnalysis } from '../lib/repoRoast';

const SHOWN = 5;

export const RepoCrimeScene: React.FC<{ repo: RepoAnalysis; headline: string }> = ({ repo, headline }) => {
  const [owner, name] = repo.name.split('/');
  return (
    <div className="mb-5 space-y-3">
      <p className="text-zinc-100">{headline}</p>
      <div className="rounded-lg border border-zinc-800">
        <div className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Crime scene: worst files
        </div>
        <ol className="divide-y divide-zinc-800/70">
          {repo.files.slice(0, SHOWN).map((f) => (
            <li key={f.path} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className={`w-10 shrink-0 text-right font-black ${scoreTone(f.analysis.score).text}`}>
                {f.analysis.score}/10
              </span>
              <a
                href={`https://github.com/${owner}/${name}/blob/${repo.ref}/${f.path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate font-mono text-zinc-300 hover:text-red-400"
                title={f.path}
              >
                {f.path}
              </a>
              <span className="shrink-0 text-xs text-zinc-500">
                {f.analysis.findings.filter((x) => x.rule !== 'tooShort').length} issues
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
