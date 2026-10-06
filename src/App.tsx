import React from 'react';
import { analyze, langFromPath, type Analysis, type Lang } from './lib/analyzer';
import { liteRoast, liteRoastToText, verdictFor, type Intensity } from './lib/roastLite';
import { readShareFromHash, type Shared } from './lib/share';
import { listRoasts, saveRoast, clearRoasts, getPref, setPref, type SavedRoast } from './lib/storage';
import { DEFAULT_MODEL, isKnownModel } from './lib/models';
import { EXAMPLES, type Example } from './lib/examples';
import { SITE_URL } from './lib/config';
import { checkWebGPUSupport } from './lib/webgpu-check';
import { initAnalytics, track, scoreBucket } from './lib/analytics';
import { analyzeRepo, fetchRepo, parseRepoUrl, repoRoast, type RepoRef } from './lib/repoRoast';
import { shareForResult, type Result } from './lib/result';
import { chip } from './lib/ui';
import { useAiWorker } from './hooks/useAiWorker';
import { CodeEditor } from './components/CodeEditor';
import { ErrorBanner } from './components/ErrorBanner';
import { SharePanel } from './components/SharePanel';
import { SiteFooter, SiteHeader } from './components/SiteChrome';
import { SharedView } from './components/SharedView';
import { HistoryList } from './components/HistoryList';
import { IntensityPicker, RoastControls, type Mode } from './components/Controls';
import { ResultCard } from './components/ResultCard';
import { Upsells } from './components/Upsells';
import { ExampleChips } from './components/ExampleChips';
import { BattleMode } from './components/BattleMode';

type Tab = 'roast' | 'battle';

const scrollTo = (ref: React.RefObject<HTMLElement | null>) =>
  requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

function App() {
  const [tab, setTab] = React.useState<Tab>('roast');
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
  const [shared, setShared] = React.useState<Shared | null>(() => readShareFromHash(window.location.hash));
  const [history, setHistory] = React.useState<SavedRoast[]>([]);
  const [ghUrl, setGhUrl] = React.useState('');
  const [ghLoading, setGhLoading] = React.useState(false);
  const [repoProgress, setRepoProgress] = React.useState<{ done: number; total: number } | null>(null);

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
      const s = readShareFromHash(window.location.hash);
      if (s) track('share_open');
      setShared(s);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const persist = (analysis: Analysis, text: string, source: string, label: string = analysis.lang) => {
    const v = verdictFor(analysis.score);
    saveRoast({ createdAt: Date.now(), lang: label, score: analysis.score, title: v.title, text, snippet: source.slice(0, 400) })
      .then(() => listRoasts().then(setHistory))
      .catch(() => {});
  };

  const stopStreaming = () => setResult((r) => (r?.kind === 'ai' ? { ...r, streaming: false } : r));
  const startAi = useAiWorker({
    onProgress: (text, progress) => setAiStatus({ text, progress }),
    onToken: (token) => {
      setAiStatus(null);
      setResult((r) => (r?.kind === 'ai' ? { ...r, text: r.text + token } : r));
    },
    onDone: (full) => {
      setAiStatus(null);
      if (pendingAi.current) persist(pendingAi.current.analysis, full, pendingAi.current.code);
      pendingAi.current = null;
      setResult((r) => (r?.kind === 'ai' ? { ...r, text: full, streaming: false } : r));
    },
    onError: (message) => {
      setAiStatus(null);
      stopStreaming();
      setError(message);
    },
  });

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
    } else if (webgpu === false) {
      setError('AI mode needs WebGPU (desktop Chrome/Edge, recent Safari). Instant mode works on any device.');
      return;
    } else {
      pendingAi.current = { analysis, code };
      setResult({ kind: 'ai', analysis, text: '', streaming: true });
      setAiStatus({ text: 'Waking up the ape…', progress: 0 });
      startAi(code, analysis, intensity, model);
    }
    scrollTo(resultRef);
  };

  // Ctrl/Cmd + Enter roasts.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tab !== 'roast' || !(e.metaKey || e.ctrlKey) || e.key !== 'Enter' || busy) return;
      e.preventDefault();
      roast();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const roastRepo = async (ref: RepoRef) => {
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
      scrollTo(resultRef);
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

  const roastAgain = () => {
    if (!result || result.kind === 'ai') return;
    const s = seed + 1;
    setSeed(s);
    track('roast_again');
    if (result.kind === 'repo') setResult({ ...result, roast: repoRoast(result.repo, intensity, s) });
    else roast(s);
  };

  const pickExample = (ex: Example) => {
    track('example', { label: ex.label });
    setCode(ex.code);
    setLang(ex.lang);
    setResult(null);
  };

  const changeIntensity = (i: Intensity) => {
    setIntensity(i);
    setPref('intensity', i);
  };

  const goRoastYourOwn = () => {
    track('share_cta');
    if (shared?.kind === 'battle') setTab('battle');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setShared(null);
    scrollTo(editorRef);
  };

  const share = React.useMemo(() => shareForResult(result, SITE_URL), [result]);

  const repoButtonLabel = ghLoading
    ? repoProgress && repoProgress.total > 0
      ? `Reading ${repoProgress.done}/${repoProgress.total}…`
      : 'Loading…'
    : parseRepoUrl(ghUrl)
      ? '🔥 Roast repo'
      : 'Load';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pb-24">
        {shared ? (
          <SharedView shared={shared} onCta={goRoastYourOwn} />
        ) : (
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

        <div ref={editorRef} role="tablist" aria-label="Mode" className="mb-6 flex scroll-mt-4 gap-2">
          <button role="tab" aria-selected={tab === 'roast'} className={chip(tab === 'roast')} onClick={() => setTab('roast')}>
            🔥 Roast
          </button>
          <button role="tab" aria-selected={tab === 'battle'} className={chip(tab === 'battle')} onClick={() => setTab('battle')}>
            ⚔️ Battle
          </button>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {tab === 'battle' ? (
          <BattleMode intensity={intensity} onIntensity={changeIntensity} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Your code" className="space-y-3">
              <ExampleChips
                onPick={pickExample}
                onClear={() => {
                  setCode('');
                  setResult(null);
                }}
              />
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
                  {repoButtonLabel}
                </button>
              </form>
              <RoastControls
                lang={lang}
                onLang={setLang}
                mode={mode}
                onMode={setMode}
                webgpu={webgpu}
                model={model}
                onModel={(m) => {
                  setModel(m);
                  setPref('model', m);
                }}
                busy={busy}
              />
              <IntensityPicker value={intensity} onChange={changeIntensity} />
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
              {result ? (
                <>
                  <ResultCard
                    result={result}
                    aiStatus={aiStatus}
                    showFixes={showFixes}
                    onToggleFixes={() => setShowFixes((v) => !v)}
                    onRoastAgain={roastAgain}
                    onTryAi={mode === 'instant' && webgpu ? () => setMode('ai') : undefined}
                  />
                  {share && <SharePanel card={share.card} url={share.url} tweet={share.tweet} />}
                  <Upsells />
                </>
              ) : (
                <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-600">
                  Your roast will appear here.
                  <br />
                  Hit the big red button. If you dare.
                </div>
              )}
            </section>
          </div>
        )}

        <HistoryList history={history} onClear={() => clearRoasts().then(() => setHistory([]))} />
      </main>

      <SiteFooter />
    </div>
  );
}

export default App;
