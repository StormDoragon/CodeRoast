import { analyzeRepo, isRoastable, repoRoast } from '../../src/lib/repoRoast';
import { verdictFor, type Intensity } from '../../src/lib/roastLite';
import { encodeShare, shareUrl } from '../../src/lib/share';
import { buildComment, MARKER } from './comment';
import { changedLines } from './diff';

export interface Env {
  get(name: string): string | undefined;
}

export interface Io {
  readFile(path: string): string;
  appendFile(path: string, data: string): void;
  log(msg: string): void;
}

export interface RunResult {
  score: number | null;
  failed: boolean;
  message: string;
}

const API = 'https://api.github.com';
const INTENSITIES: Intensity[] = ['gentle', 'savage', 'unhinged'];
const MAX_FILE_BYTES = 150_000;

// Action inputs arrive as INPUT_<NAME> with the name upper-cased.
export function input(env: Env, name: string, fallback = '') {
  return (env.get(`INPUT_${name.toUpperCase()}`) ?? '').trim() || fallback;
}

interface PrFile {
  filename: string;
  status: string;
  patch?: string;
  changes: number;
}

const MAX_COMMENT_PAGES = 30;

// Busy PRs can have more than one page of comments; keep looking until the
// marker turns up so we update our comment instead of posting duplicates.
async function findOwnComment(gh: (path: string) => Promise<Response>, repo: string, number: number) {
  for (let page = 1; page <= MAX_COMMENT_PAGES; page++) {
    const batch: { id: number; body?: string }[] = await (
      await gh(`/repos/${repo}/issues/${number}/comments?per_page=100&page=${page}`)
    ).json();
    const hit = batch.find((c) => c.body?.includes(MARKER));
    if (hit || batch.length < 100) return hit;
  }
  return undefined;
}

export async function run(env: Env, io: Io, fetchImpl: typeof fetch = fetch): Promise<RunResult> {
  const token = input(env, 'github-token');
  const intensityRaw = input(env, 'intensity', 'savage') as Intensity;
  const intensity = INTENSITIES.includes(intensityRaw) ? intensityRaw : 'savage';
  const failBelow = Number(input(env, 'fail-below', '0')) || 0;
  const maxFiles = Math.max(1, Math.min(100, Number(input(env, 'max-files', '30')) || 30));
  const site = input(env, 'site-url', 'https://code-roast-five.vercel.app').replace(/\/$/, '');
  const shouldComment = input(env, 'comment', 'true') !== 'false';

  const eventPath = env.get('GITHUB_EVENT_PATH');
  const event = eventPath ? JSON.parse(io.readFile(eventPath)) : {};
  const pr = event.pull_request;
  if (!pr) {
    return { score: null, failed: false, message: 'Not a pull_request event; nothing to roast.' };
  }
  const baseRepo: string = env.get('GITHUB_REPOSITORY') ?? event.repository?.full_name;
  // Fork PR commits are reachable from the base repo, whose token we hold, so
  // contents and blob links always use the base repo at the head SHA.
  const sha: string = pr.head.sha;
  const number: number = pr.number;

  const gh = async (path: string, init: RequestInit = {}) => {
    const res = await fetchImpl(path.startsWith('http') ? path : `${API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'coderoast-action',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} → ${res.status}`);
    return res;
  };

  // 1. Changed files (up to 300, GitHub's limit for this endpoint is 3000).
  const prFiles: PrFile[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch: PrFile[] = await (await gh(`/repos/${baseRepo}/pulls/${number}/files?per_page=100&page=${page}`)).json();
    prFiles.push(...batch);
    if (batch.length < 100) break;
  }
  const candidates = prFiles
    .filter((f) => f.status !== 'removed' && isRoastable(f.filename))
    .sort((a, b) => b.changes - a.changes)
    .slice(0, maxFiles);

  if (candidates.length === 0) {
    io.log('No supported source files changed (JS/TS/Python/Go/Rust/Java; built, vendored and minified files are skipped).');
    return { score: null, failed: false, message: 'No supported source files changed.' };
  }

  // 2. File contents at the PR head.
  const files: { path: string; code: string }[] = [];
  for (const f of candidates) {
    const path = f.filename.split('/').map(encodeURIComponent).join('/');
    try {
      const res = await gh(`/repos/${baseRepo}/contents/${path}?ref=${sha}`, {
        headers: { Accept: 'application/vnd.github.raw' },
      });
      const code = await res.text();
      if (code.length <= MAX_FILE_BYTES) files.push({ path: f.filename, code });
    } catch (err) {
      io.log(`Skipping ${f.filename}: ${(err as Error).message}`);
    }
  }
  if (files.length === 0) {
    return { score: null, failed: false, message: 'Could not read any changed files.' };
  }

  // 3. Roast.
  const analysis = analyzeRepo(`${baseRepo}#${number}`, sha, files);
  const roast = repoRoast(analysis, intensity, number);
  const v = verdictFor(analysis.score);
  const encoded = encodeShare({
    s: analysis.score,
    t: v.title,
    l: `${baseRepo}#${number}`,
    n: analysis.totalLines,
    r: [roast.crimeScene, ...roast.lines.map((l) => l.joke), roast.closer],
  });
  const body = buildComment(analysis, roast, {
    repo: baseRepo,
    sha,
    site,
    shareUrl: shareUrl(site, encoded),
    changed: new Map(prFiles.map((f) => [f.filename, changedLines(f.patch)])),
  });

  // 4. Report: job summary always; PR comment (updated in place) when allowed.
  const summary = env.get('GITHUB_STEP_SUMMARY');
  if (summary) io.appendFile(summary, `${body}\n`);
  const output = env.get('GITHUB_OUTPUT');
  if (output) io.appendFile(output, `score=${analysis.score}\nverdict=${v.title}\n`);

  if (shouldComment) {
    try {
      const existing = await findOwnComment(gh, baseRepo, number);
      await gh(
        existing ? `/repos/${baseRepo}/issues/comments/${existing.id}` : `/repos/${baseRepo}/issues/${number}/comments`,
        { method: existing ? 'PATCH' : 'POST', body: JSON.stringify({ body }), headers: { 'Content-Type': 'application/json' } },
      );
      io.log(existing ? 'Updated the CodeRoast comment.' : 'Posted a CodeRoast comment.');
    } catch (err) {
      // Fork PRs get a read-only token; the job summary still has the roast.
      io.log(`Could not comment on the PR (${(err as Error).message}). The roast is in the job summary.`);
    }
  }

  const failed = failBelow > 0 && analysis.score < failBelow;
  const message = `Banana Score ${analysis.score}/10 (${v.title})${failed ? `, below the fail-below threshold of ${failBelow}` : ''}.`;
  return { score: analysis.score, failed, message };
}
