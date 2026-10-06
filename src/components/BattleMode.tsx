import React from 'react';
import { track } from '../lib/analytics';
import { battle, MAX_NAME, type BattleResult } from '../lib/battle';
import { SITE_URL } from '../lib/config';
import { EXAMPLES } from '../lib/examples';
import { shareForBattle } from '../lib/result';
import type { Intensity } from '../lib/roastLite';
import { verdictFor } from '../lib/roastLite';
import { field, label } from '../lib/ui';
import { analyze } from '../lib/analyzer';
import { CodeEditor } from './CodeEditor';
import { IntensityPicker } from './Controls';
import { ScoreHeader } from './RoastResult';
import { SharePanel } from './SharePanel';

interface Corner {
  name: string;
  code: string;
}

const CornerInput: React.FC<{ id: string; corner: Corner; onChange: (c: Corner) => void }> = ({ id, corner, onChange }) => (
  <div className="space-y-2">
    <label className={`block ${label}`}>
      Fighter {id}
      <input
        value={corner.name}
        maxLength={MAX_NAME}
        onChange={(e) => onChange({ ...corner, name: e.target.value })}
        placeholder={`Fighter ${id}'s name`}
        className={field}
      />
    </label>
    <CodeEditor
      value={corner.code}
      onChange={(code) => onChange({ ...corner, code })}
      language={analyze(corner.code).lang}
      className="h-64"
      label={`Fighter ${id} code`}
    />
  </div>
);

const SideResult: React.FC<{ side: BattleResult['a']; won: boolean }> = ({ side, won }) => {
  const v = verdictFor(side.analysis.score);
  return (
    <div className={`flex-1 rounded-2xl border p-4 ${won ? 'border-yellow-500/70 bg-yellow-950/20' : 'border-zinc-800 bg-zinc-900/40'}`}>
      <p className="mb-3 font-bold text-zinc-100">
        {won && '🏆 '}
        {side.name}
      </p>
      <ScoreHeader score={side.analysis.score} title={v.title} emoji={v.emoji} />
      <ul className="mt-4 space-y-2 text-sm text-zinc-200">
        {side.roast.lines.slice(0, 3).map((l, i) => (
          <li key={i}>{l.joke}</li>
        ))}
      </ul>
    </div>
  );
};

export const BattleMode: React.FC<{ intensity: Intensity; onIntensity: (i: Intensity) => void }> = ({
  intensity,
  onIntensity,
}) => {
  const [a, setA] = React.useState<Corner>({ name: 'left-pad', code: EXAMPLES[3].code });
  const [b, setB] = React.useState<Corner>({ name: 'The intern', code: EXAMPLES[0].code });
  const [result, setResult] = React.useState<BattleResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const resultRef = React.useRef<HTMLDivElement>(null);

  const fight = () => {
    if (!a.code.trim() || !b.code.trim()) {
      setError('Both fighters need code. Nobody wins by forfeit here.');
      return;
    }
    setError(null);
    const r = battle({ name: a.name, code: a.code }, { name: b.name, code: b.code }, intensity);
    setResult(r);
    track('battle', { winner: r.winner, margin: r.margin });
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const share = React.useMemo(() => (result ? shareForBattle(result, SITE_URL) : null), [result]);

  return (
    <section aria-label="Roast battle" className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <CornerInput id="A" corner={a} onChange={setA} />
        <CornerInput id="B" corner={b} onChange={setB} />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <IntensityPicker value={intensity} onChange={onIntensity} />
        </div>
        <button
          onClick={fight}
          className="rounded-xl bg-red-600 px-10 py-4 text-xl font-black text-white shadow-lg shadow-red-900/40 hover:bg-red-500"
        >
          ⚔️ Fight!
        </button>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {result && (
        <div ref={resultRef} className="scroll-mt-4 space-y-6">
          <p className="text-center text-2xl font-black text-zinc-50">{result.headline}</p>
          <div className="flex flex-col gap-4 md:flex-row">
            <SideResult side={result.a} won={result.winner === 'a'} />
            <SideResult side={result.b} won={result.winner === 'b'} />
          </div>
          {share && <SharePanel card={share.card} url={share.url} tweet={share.tweet} />}
        </div>
      )}
    </section>
  );
};
