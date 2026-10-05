// Whole-repo roasts: fetch the largest source files of a public GitHub repo,
// analyze each one, and aggregate into a repo-level verdict.

import { analyze, langFromPath, type Analysis, type Finding, type Lang, type RuleId, type Severity } from './analyzer';
import { liteRoast, type Intensity, type LiteRoast } from './roastLite';

export interface RepoRef {
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
}

export interface RepoFile {
  path: string;
  code: string;
}

export interface FileResult {
  path: string;
  analysis: Analysis;
}

export interface RepoAnalysis {
  name: string; // owner/repo
  ref: string;
  files: FileResult[]; // worst first
  totalLines: number;
  score: number;
  langs: Lang[];
  aggregate: Analysis; // summed findings, for joke generation
}

export const MAX_FILES = 30;
const MAX_FILE_BYTES = 150_000;
const CONCURRENCY = 6;
const IGNORED_DIR = /(^|\/)(node_modules|vendor|dist|build|out|target|coverage|\.next|third_party|__snapshots__|fixtures?)\//;
const IGNORED_FILE = /\.(min|bundle|generated|pb)\.|\.d\.ts$/;

export function parseRepoUrl(input: string): RepoRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.hostname !== 'github.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, rawRepo, kind, ref, ...rest] = parts;
  const repo = rawRepo.replace(/\.git$/, '');
  if (parts.length === 2) return { owner, repo };
  if (kind === 'tree' && ref) return { owner, repo, ref, path: rest.join('/') || undefined };
  return null; // blob links and other pages are not repo URLs
}

interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

// Source files worth roasting: a supported language, and not vendored,
// built, minified or generated (those would be roasted for someone else's sins).
export function isRoastable(path: string): boolean {
  return langFromPath(path) !== null && !IGNORED_DIR.test(path) && !IGNORED_FILE.test(path);
}

export function pickFiles(tree: TreeEntry[], path?: string, max = MAX_FILES): TreeEntry[] {
  const prefix = path ? `${path.replace(/\/$/, '')}/` : '';
  return tree
    .filter(
      (e) =>
        e.type === 'blob' &&
        e.path.startsWith(prefix) &&
        isRoastable(e.path) &&
        (e.size ?? 0) > 0 &&
        (e.size ?? 0) <= MAX_FILE_BYTES,
    )
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
    .slice(0, max);
}

async function gh<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 404) throw new Error('Repo not found. Is it private?');
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub rate limit hit (60 requests/hour without login). Try again later, or paste a file URL.');
  }
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchRepo(
  ref: RepoRef,
  onProgress?: (done: number, total: number) => void,
): Promise<{ files: RepoFile[]; branch: string }> {
  const base = `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
  const branch = ref.ref ?? (await gh<{ default_branch: string }>(base)).default_branch;
  const tree = await gh<{ tree: TreeEntry[] }>(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const picked = pickFiles(tree.tree, ref.path);
  if (picked.length === 0) throw new Error('No supported source files found (JS/TS/Python/Go/Rust/Java).');

  const files: RepoFile[] = [];
  let next = 0;
  let done = 0;
  onProgress?.(0, picked.length);
  const worker = async () => {
    while (next < picked.length) {
      const entry = picked[next++];
      const raw = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${branch}/${entry.path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;
      try {
        const res = await fetch(raw);
        if (res.ok) files.push({ path: entry.path, code: await res.text() });
      } catch {
        // Skip files that fail to download; the rest still make a roast.
      }
      onProgress?.(++done, picked.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, picked.length) }, worker));
  if (files.length === 0) throw new Error('Could not download any files from that repo.');
  return { files, branch };
}

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

export function analyzeRepo(name: string, branch: string, files: RepoFile[]): RepoAnalysis {
  const results: FileResult[] = files.map((f) => ({
    path: f.path,
    analysis: analyze(f.code, langFromPath(f.path) ?? undefined),
  }));

  const totalLines = results.reduce((n, r) => n + r.analysis.metrics.totalLines, 0);
  const weighted = results.reduce((n, r) => n + r.analysis.score * r.analysis.metrics.totalLines, 0);
  const score = Math.max(1, Math.min(10, Math.round(weighted / Math.max(1, totalLines))));

  // Sum findings per rule across files; "count" becomes the total occurrences
  // and "detail" the number of files affected.
  const byRule = new Map<RuleId, Finding & { files: number }>();
  for (const r of results) {
    for (const f of r.analysis.findings) {
      if (f.rule === 'tooShort') continue;
      const cur = byRule.get(f.rule);
      if (!cur) {
        byRule.set(f.rule, { ...f, lines: [], files: 1 });
      } else {
        cur.count += f.count;
        cur.files += 1;
        if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[cur.severity]) cur.severity = f.severity;
        if (f.rule === 'deepNesting' && Number(f.detail) > Number(cur.detail)) cur.detail = f.detail;
        if (f.rule === 'hugeFile' && Number(f.detail) > Number(cur.detail)) cur.detail = f.detail;
      }
    }
  }
  const findings = [...byRule.values()]
    .map(({ files: _files, ...f }) => f)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.count - a.count);

  const sorted = [...results].sort(
    (a, b) => a.analysis.score - b.analysis.score || b.analysis.findings.length - a.analysis.findings.length,
  );
  const langs = [...new Set(results.map((r) => r.analysis.lang))];

  return {
    name,
    ref: branch,
    files: sorted,
    totalLines,
    score,
    langs,
    aggregate: {
      lang: langs[0] ?? 'other',
      metrics: {
        totalLines,
        codeLines: results.reduce((n, r) => n + r.analysis.metrics.codeLines, 0),
        commentLines: results.reduce((n, r) => n + r.analysis.metrics.commentLines, 0),
        maxDepth: Math.max(0, ...results.map((r) => r.analysis.metrics.maxDepth)),
        longestLine: Math.max(0, ...results.map((r) => r.analysis.metrics.longestLine)),
      },
      findings,
      score,
    },
  };
}

export interface RepoRoast extends LiteRoast {
  crimeScene: string; // headline about the worst file
}

export function repoRoast(r: RepoAnalysis, intensity: Intensity, seed = 0): RepoRoast {
  const base = liteRoast(r.name, r.aggregate, intensity, seed);
  const worst = r.files[0];
  const best = r.files[r.files.length - 1];
  const shout = (s: string) => (intensity === 'unhinged' ? s.toUpperCase() : s);
  const crimeScene =
    r.files.length > 1 && worst.analysis.score < best.analysis.score
      ? `The crime scene is \`${worst.path}\` at ${worst.analysis.score}/10. Your best file, \`${best.path}\`, scored ${best.analysis.score}/10, so you clearly know better.`
      : `I read ${r.files.length} file${r.files.length === 1 ? '' : 's'} and they're all equally guilty.`;
  return { ...base, crimeScene: shout(crimeScene) };
}
