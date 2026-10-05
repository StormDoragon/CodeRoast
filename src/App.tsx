import React from 'react';
import { analyze, langFromPath, type Analysis, type Lang } from './lib/analyzer';
import { liteRoast, liteRoastToText, verdictFor, type Intensity, type LiteRoast } from './lib/roastLite';
import { encodeShare, readShareFromHash, shareUrl, type SharePayload } from './lib/share';
import { listRoasts, saveRoast, clearRoasts, getPref, setPref, type SavedRoast } from './lib/storage';
import { AI_MODELS, DEFAULT_MODEL, isKnownModel } from './lib/models';
import { EXAMPLES } from './lib/examples';
import { SITE_URL, SPONSOR_URL, PRO_WAITLIST_URL, REPO_URL } from './lib/config';
import { checkWebGPUSupport } from './lib/webgpu-check';
import { initAnalytics, track, scoreBucket } from './lib/analytics';
import type { WorkerRequest, WorkerResponse } from './lib/worker';
import { analyzeRepo, fetchRepo, parseRepoUrl, repoRoast, type RepoAnalysis, type RepoRoast } from './lib/repoRoast';
import { CodeEditor } from './components/CodeEditor';
import { ErrorBanner } from './components/ErrorBanner';
import { ScoreHeader, LiteRoastView, AiRoastView } from './components/RoastResult';
import { SharePanel } from './components/SharePanel';
import { RepoCrimeScene } from './components/RepoCrimeScene';

type Mode = 'instant' | 'ai';

type Result =
  | { kind: 'lite'; analysis: Analysis; roast: LiteRoast }
  | { kind: 'ai'; analysis: Analysis; text: string; streaming: boolean }
  | { kind: 'repo'; analysis: Analysis; repo: RepoAnalysis; roast: RepoRoast };

const LANG_OPTIONS: Array<{ value: Lang | 'auto'; label: string }> = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java / Kotlin' },
];

const LANG_LABEL: Record<string, string> = Object.fromEntries(LANG_OPTIONS.map((o) => [o.value, o.label]));

const INTENSITIES: Array<{ value: Intensity; label: string }> = [
  { value: 'gentle', label: '😌 Gentle' },
  { value: 'savage', label: '🔥 Savage' },
  { value: 'unhinged', label: '💢 Unhinged' },
];

const chip = (active: boolean) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    active ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
  }`;

// Splits an AI roast into short shareable lines.
function aiShareLines(text: string) {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*([-*•]|\d+\.)\s*/, '').trim())
    .filter((l) => l && !/^(fix:|↳|banana score)/i.test(l))
    .slice(0, 6);
}

function App() {
  const [code, setCode] = React.useState(EXAMPLES[0].code);
  const [lang, setLang] = React.useState<Lang | 'auto'>('auto');
  const [intensity, setIntensity] = React.useState<Intensity>('savage');
  const [mode, setMode] = React.useState<Mode>('instant');
  const [model, setModel] = React.useState(DEFAULT_MODEL);
  const [seed, setSeed] = React.useState(0);
  const [showFixes, setShowFixes] = React.useState(true);
  const [result, setResult] = React.useState<Result | null>(null);
  const [aiStatus, setAiStatus] = React.useState<{ text: string; progress: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [webgpu, setWebgpu] = React.useState<boolean | null>(null);
  const [shared, setShared] = React.useState<SharePayload | null>(() => readShareFromHash(window.location.hash));
  const [history, setHistory] = React.useState<SavedRoast[]>([]);
  const [ghUrl, setGhUrl] = React.useState('');
  const [ghLoading, setGhLoading] = React.useState(false);
  const [repoProgress, setRepoProgress] = React.useState<{ done: number; total: number } | null>(null);

  const workerRef = React.useRef<Worker | null>(null);
  const requestId = React.useRef(0);
  const pendingAi = React.useRef<{ analysis: Analysis; code: string } | null>(null);
  const resultRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<HTMLDivElement>(null);

  const busy = result?.kind === 'ai' && result.streaming;
  const effectiveLang: Lang | undefined = lang === 'auto' ? undefined : lang;

  React.useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).catch(() => {});
    }
    initAnalytics();
    if (readShareFromHash(window.location.hash)) track('share_open');
    checkWebGPUSupport().then((s) => setWebgpu(s.supported));
    getPref('model', DEFAULT_MODEL).then((m) => setModel(isKnownModel(m) ? m : DEFAULT_MODEL));
    getPref<Intensity>('intensity', 'savage').then(setIntensity);
    listRoasts().then(setHistory).catch(() => {});

    const onHash = () => {
      const payload = readShareFromHash(window.location.hash);
      if (payload) track('share_open');
      setShared(payload);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      workerRef.current?.terminate();
    };
  }, []);

  const getWorker = () => {
    if (!workerRef.current) {
      const w = new Worker(new URL('./lib/worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const m = e.data;
        if (m.id !== requestId.current) return;
        if (m.type === 'progress') {
          setAiStatus({ text: m.text, progress: m.progress });
        } else if (m.type === 'token') {
          setAiStatus(null);
          setResult((r) => (r?.kind === 'ai' ? { ...r, text: r.text + m.token } : r));
        } else if (m.type === 'done') {
          setAiStatus(null);
          if (pendingAi.current) persist(pendingAi.current.analysis, m.full, pendingAi.current.code);
          pendingAi.current = null;
          setResult((r) => (r?.kind === 'ai' ? { ...r, text: m.full, streaming: false } : r));
        } else if (m.type === 'error') {
          setAiStatus(null);
          setResult((r) => (r?.kind === 'ai' ? { ...r, streaming: false } : r));
          setError(`AI roast failed: ${m.error}. Instant mode still works everywhere.`);
        }
      };
      w.onerror = (e) => {
        setAiStatus(null);
        setResult((r) => (r?.kind === 'ai' ? { ...r, streaming: false } : r));
        setError(`AI worker crashed: ${e.message || 'unknown error'}`);
        workerRef.current = null;
      };
      workerRef.current = w;
    }
    return workerRef.current;
  };

  const persist = (analysis: Analysis, text: string, source: string, label: string = analysis.lang) => {
    const v = verdictFor(analysis.score);
    saveRoast({
      createdAt: Date.now(),
      lang: label,
      score: analysis.score,
      title: v.title,
      text,
      snippet: source.slice(0, 400),
    })
      .then(() => listRoasts().then(setHistory))
      .catch(() => {});
  };

  const roast = (nextSeed = seed) => {
    if (!code.trim()) {
      setError('Paste some code first. I can’t roast thin air.');
      return;
    }
    setError(null);
    const analysis = analyze(code, effectiveLang);
    track('roast', { mode, lang: analysis.lang, intensity, score: scoreBucket(analysis.score) });

    if (mode === 'instant') {
      const r = liteRoast(code, analysis, intensity, nextSeed);
      setResult({ kind: 'lite', analysis, roast: r });
      persist(analysis, liteRoastToText(r), code);
    } else {
      if (webgpu === false) {
        setError('AI mode needs WebGPU (desktop Chrome/Edge, recent Safari). Instant mode works on any device.');
        return;
      }
      const id = ++requestId.current;
      pendingAi.current = { analysis, code };
      setResult({ kind: 'ai', analysis, text: '', streaming: true });
      setAiStatus({ text: 'Waking up the ape…', progress: 0 });
      const req: WorkerRequest = { id, code, analysis, intensity, model };
      getWorker().postMessage(req);
    }
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Ctrl/Cmd + Enter roasts.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !busy) {
        e.preventDefault();
        roast();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const roastRepo = async (ref: NonNullable<ReturnType<typeof parseRepoUrl>>) => {
    setGhLoading(true);
    setError(null);
    setRepoProgress({ done: 0, total: 0 });
    try {
      const { files, branch } = await fetchRepo(ref, (done, total) => setRepoProgress({ done, total }));
      const name = `${ref.owner}/${ref.repo}${ref.path ? `/${ref.path}` : ''}`;
      const repo = analyzeRepo(name, branch, files);
      const r = repoRoast(repo, intensity, seed);
      setResult({ kind: 'repo', analysis: repo.aggregate, repo, roast: r });
      track('repo_roast', { files: repo.files.length, score: scoreBucket(repo.score) });
      persist(repo.aggregate, [r.crimeScene, liteRoastToText(r)].join('\n\n'), name, name);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to roast that repo.');
    } finally {
      setGhLoading(false);
      setRepoProgress(null);
    }
  };

  const loadGitHub = async () => {
    if (!ghUrl.trim()) return;
    const repoRef = parseRepoUrl(ghUrl);
    if (repoRef) return roastRepo(repoRef);
    setGhLoading(true);
    setError(null);
    try {
      const { fetchGitHubSource } = await import('./lib/githubFetcher');
      const { code: text, path } = await fetchGitHubSource(ghUrl);
      setCode(text);
      setLang(langFromPath(path) ?? 'auto');
      track('github_load');
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load that GitHub URL.');
    } finally {
      setGhLoading(false);
    }
  };

  const goRoastYourOwn = () => {
    track('share_cta');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setShared(null);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };

  const share = React.useMemo(() => {
    if (!result || (result.kind === 'ai' && result.streaming)) return null;
    const v = verdictFor(result.analysis.score);
    const lines =
      result.kind === 'ai'
        ? aiShareLines(result.text)
        : [
            ...(result.kind === 'repo' ? [result.roast.crimeScene] : []),
            ...result.roast.lines.map((l) => l.joke),
            result.roast.closer,
          ];
    const langLabel = result.kind === 'repo' ? result.repo.name : (LANG_LABEL[result.analysis.lang] ?? result.analysis.lang);
    const encoded = encodeShare({
      s: result.analysis.score,
      t: v.title,
      l: langLabel,
      n: result.analysis.metrics.totalLines,
      r: lines,
    });
    return {
      url: shareUrl(SITE_URL, encoded),
      tweet: result.kind === 'repo'
        ? `My repo ${langLabel} just got roasted 🔥🐵 Banana Score: ${result.analysis.score}/10 — "${v.title}". Roast yours:`
        : `My ${langLabel} code just got roasted 🔥🐵 Banana Score: ${result.analysis.score}/10 — "${v.title}". Think yours is better?`,
      card: { score: result.analysis.score, title: v.title, emoji: v.emoji, lang: langLabel, lines, site: SITE_URL },
    };
  }, [result]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="./" className="text-xl font-black tracking-tight text-zinc-50">
            CodeRoast <span aria-hidden>🔥🐵</span>
          </a>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-100">
              GitHub
            </a>
            {SPONSOR_URL && (
              <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-100">
                🍌 Buy the ape a banana
              </a>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24">
        {shared && (
          <section className="mb-10 mt-8 rounded-2xl border border-red-900/60 bg-gradient-to-br from-zinc-900 to-red-950/40 p-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-red-400">
              Someone’s {shared.l} code ({shared.n} lines) just got roasted
            </p>
            <ScoreHeader score={shared.s} title={shared.t} emoji={verdictFor(shared.s).emoji} />
            <ul className="mt-6 space-y-2">
              {shared.r.map((l, i) => (
                <li key={i} className="text-zinc-100">
                  “{l}”
                </li>
              ))}
            </ul>
            <button
              onClick={goRoastYourOwn}
              className="mt-6 rounded-xl bg-red-600 px-6 py-3 text-lg font-black text-white hover:bg-red-500"
            >
              Think you can beat {shared.s}/10? Roast your code →
            </button>
          </section>
        )}

        {!shared && (
          <section className="py-10 text-center md:py-14">
            <h1 className="text-4xl font-black tracking-tight text-zinc-50 md:text-6xl">
              Your code, <span className="text-red-500">roasted</span>.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
              Paste code or a GitHub link. Get a brutally funny roast with line-numbered receipts, real fixes, and a
              Banana Score to brag about. Runs 100% in your browser. Your code never leaves your device.
            </p>
          </section>
        )}

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="grid gap-6 lg:grid-cols-2" ref={editorRef}>
          <section aria-label="Your code" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => {
                    track('example', { label: ex.label });
                    setCode(ex.code);
                    setLang(ex.lang);
                    setResult(null);
                  }}
                  className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:border-red-500"
                >
                  {ex.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setCode('');
                  setResult(null);
                }}
                className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500 hover:border-zinc-600"
              >
                Clear
              </button>
            </div>

            <CodeEditor value={code} onChange={setCode} language={effectiveLang ?? analyze(code).lang} />

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                loadGitHub();
              }}
            >
              <input
                type="url"
                value={ghUrl}
                onChange={(e) => setGhUrl(e.target.value)}
                placeholder="…or paste a GitHub file or repo URL"
                aria-label="GitHub file or repo URL"
                className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={ghLoading || !ghUrl.trim()}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
              >
                {ghLoading
                  ? repoProgress && repoProgress.total > 0
                    ? `Reading ${repoProgress.done}/${repoProgress.total}…`
                    : 'Loading…'
                  : parseRepoUrl(ghUrl)
                    ? '🔥 Roast repo'
                    : 'Load'}
              </button>
            </form>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Language
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang | 'auto')}
                  className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100"
                >
                  {LANG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Engine
                <div className="mt-1 flex gap-2">
                  <button className={chip(mode === 'instant')} onClick={() => setMode('instant')}>
                    ⚡ Instant
                  </button>
                  <button
                    className={chip(mode === 'ai')}
                    onClick={() => setMode('ai')}
                    title={webgpu === false ? 'Needs WebGPU' : 'Runs a small LLM locally on your GPU'}
                  >
                    🧠 AI {webgpu === false && '(n/a)'}
                  </button>
                </div>
              </div>
            </div>

            {mode === 'ai' && (
              <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Local model (downloaded once, then cached)
                <select
                  value={model}
                  disabled={busy}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setPref('model', e.target.value);
                  }}
                  className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100"
                >
                  {AI_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} · {m.size}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">Intensity</div>
              <div className="flex flex-wrap gap-2">
                {INTENSITIES.map((i) => (
                  <button
                    key={i.value}
                    className={chip(intensity === i.value)}
                    onClick={() => {
                      setIntensity(i.value);
                      setPref('intensity', i.value);
                    }}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => roast()}
              disabled={busy}
              className="w-full rounded-xl bg-red-600 py-4 text-xl font-black text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? '🔥 Roasting…' : '🔥 Roast my code'}
            </button>
            <p className="text-center text-xs text-zinc-600">Ctrl/⌘ + Enter</p>
          </section>

          <section aria-label="Roast" ref={resultRef} className="scroll-mt-4 space-y-6">
            {!result && (
              <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-600">
                Your roast will appear here.
                <br />
                Hit the big red button. If you dare.
              </div>
            )}

            {result && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <ScoreHeader
                  score={result.analysis.score}
                  title={verdictFor(result.analysis.score).title}
                  emoji={verdictFor(result.analysis.score).emoji}
                  subtitle={
                    result.kind === 'repo'
                      ? `${result.repo.name} · ${result.repo.files.length} files · ${result.repo.totalLines.toLocaleString()} lines · ${result.analysis.findings.length} issue types`
                      : `${LANG_LABEL[result.analysis.lang] ?? result.analysis.lang} · ${result.analysis.metrics.totalLines} lines · ${result.analysis.findings.length} issue types · max nesting ${result.analysis.metrics.maxDepth}`
                  }
                />
                <div className="my-5 h-px bg-zinc-800" />
                {aiStatus && (
                  <div className="mb-4">
                    <p className="mb-2 text-sm text-zinc-400">{aiStatus.text}</p>
                    <div className="h-1.5 rounded-full bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-red-500 transition-all"
                        style={{ width: `${Math.round(aiStatus.progress * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {result.kind === 'repo' && <RepoCrimeScene repo={result.repo} headline={result.roast.crimeScene} />}
                {result.kind !== 'ai' ? (
                  <LiteRoastView roast={result.roast} showFixes={showFixes} />
                ) : (
                  <AiRoastView text={result.text} streaming={result.streaming} />
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {result.kind !== 'ai' && (
                    <>
                      <button
                        className={chip(false)}
                        onClick={() => {
                          const s = seed + 1;
                          setSeed(s);
                          track('roast_again');
                          if (result.kind === 'repo') {
                            setResult({ ...result, roast: repoRoast(result.repo, intensity, s) });
                          } else {
                            roast(s);
                          }
                        }}
                      >
                        🎲 Roast again
                      </button>
                      <button className={chip(showFixes)} onClick={() => setShowFixes((v) => !v)}>
                        🩹 {showFixes ? 'Hide' : 'Show'} fixes
                      </button>
                    </>
                  )}
                  {mode === 'instant' && webgpu && (
                    <button
                      className={chip(false)}
                      onClick={() => {
                        setMode('ai');
                      }}
                    >
                      🧠 Try the AI roast
                    </button>
                  )}
                </div>
              </div>
            )}

            {share && <SharePanel card={share.card} url={share.url} tweet={share.tweet} />}

            {PRO_WAITLIST_URL && result && (
              <a
                href={PRO_WAITLIST_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-yellow-700/50 bg-yellow-950/20 p-4 text-sm text-yellow-100 hover:border-yellow-500"
              >
                <strong>CodeRoast Pro (coming soon):</strong> roast whole repos and every pull request automatically,
                with a smarter cloud model. Join the waitlist →
              </a>
            )}
          </section>
        </div>

        {history.length > 0 && (
          <section className="mt-16">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-100">Your past roasts</h2>
              <button
                className="text-xs text-zinc-500 hover:text-zinc-300"
                onClick={() => clearRoasts().then(() => setHistory([]))}
              >
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
                        {h.title} · {LANG_LABEL[h.lang] ?? h.lang} · {new Date(h.createdAt).toLocaleString()}
                      </span>
                    </summary>
                    <pre className="whitespace-pre-wrap px-4 pb-4 text-sm text-zinc-300">{h.text}</pre>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-900 py-8 text-center text-xs text-zinc-600">
        <p>
          Made with spite and bananas. Open source on{' '}
          <a href={REPO_URL} className="underline hover:text-zinc-400" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          . Roasts are jokes about code, never about people.
        </p>
      </footer>
    </div>
  );
}

export default App;
