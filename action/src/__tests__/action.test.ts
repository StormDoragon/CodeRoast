import { describe, expect, it } from 'vitest';
import { changedLines } from '../diff';
import { run, type Env, type Io } from '../run';
import { MARKER } from '../comment';
import { EXAMPLES } from '../../../src/lib/examples';

describe('changedLines', () => {
  it('collects added lines across hunks and skips removed ones', () => {
    const patch = ['@@ -1,3 +1,4 @@', ' a', '-b', '+B', '+C', ' d', '@@ -20,2 +21,3 @@', ' x', '+y', ' z'].join('\n');
    expect([...changedLines(patch)]).toEqual([2, 3, 22]);
    expect(changedLines(undefined).size).toBe(0);
  });
});

type Call = { method: string; url: string; body?: string };

function harness(opts: { comments?: { id: number; body: string }[][]; failComment?: boolean; inputs?: Record<string, string>; event?: unknown } = {}) {
  const calls: Call[] = [];
  const written: Record<string, string> = {};
  const logs: string[] = [];
  const event = opts.event ?? {
    pull_request: { number: 7, head: { sha: 'abc123', repo: { full_name: 'fork/app' } } },
    repository: { full_name: 'acme/app' },
  };
  const envVars: Record<string, string> = {
    GITHUB_EVENT_PATH: '/event.json',
    GITHUB_REPOSITORY: 'acme/app',
    GITHUB_STEP_SUMMARY: '/summary.md',
    GITHUB_OUTPUT: '/output.txt',
    'INPUT_GITHUB-TOKEN': 't0ken',
    ...Object.fromEntries(Object.entries(opts.inputs ?? {}).map(([k, v]) => [`INPUT_${k.toUpperCase()}`, v])),
  };
  const env: Env = { get: (n) => envVars[n] };
  const io: Io = {
    readFile: () => JSON.stringify(event),
    appendFile: (p, d) => (written[p] = (written[p] ?? '') + d),
    log: (m) => logs.push(m),
  };
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url, body: init.body as string | undefined });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t0ken');
    if (url.includes('/pulls/7/files')) {
      return Response.json([
        { filename: 'src/bad.js', status: 'modified', changes: 30, patch: '@@ -0,0 +1,3 @@\n+var apiKey = "x";\n+\n+function getData(x) {' },
        { filename: 'lib/pad.js', status: 'added', changes: 10, patch: '@@ -0,0 +1,2 @@\n+a\n+b' },
        { filename: 'README.md', status: 'modified', changes: 5 },
        { filename: 'old.py', status: 'removed', changes: 9 },
        { filename: 'action/dist/index.cjs', status: 'modified', changes: 900 },
        { filename: 'vendor/lib.min.js', status: 'added', changes: 500 },
      ]);
    }
    if (url.includes('/contents/src/bad.js?ref=abc123')) return new Response(EXAMPLES[0].code);
    if (url.includes('/contents/lib/pad.js?ref=abc123')) return new Response(EXAMPLES[3].code);
    const commentsPage = url.match(/\/issues\/7\/comments\?per_page=100&page=(\d+)$/);
    if (commentsPage) return Response.json(opts.comments?.[Number(commentsPage[1]) - 1] ?? []);
    if (opts.failComment && method !== 'GET') return new Response('forbidden', { status: 403 });
    if (url.includes('/comments')) return Response.json({ id: 1 });
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return { env, io, fetchImpl, calls, written, logs };
}

describe('run', () => {
  it('roasts a fork PR via the base repo (the token is scoped to it) and posts a comment', async () => {
    const h = harness();
    const r = await run(h.env, h.io, h.fetchImpl);
    expect(r.failed).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(1);
    // Only supported, non-removed, non-generated files; read from the base repo at the head SHA.
    const contentCalls = h.calls.filter((c) => c.url.includes('/contents/'));
    expect(contentCalls.map((c) => c.url)).toEqual([
      'https://api.github.com/repos/acme/app/contents/src/bad.js?ref=abc123',
      'https://api.github.com/repos/acme/app/contents/lib/pad.js?ref=abc123',
    ]);
    expect(h.calls.some((c) => c.url.includes('/repos/fork/'))).toBe(false);
    const post = h.calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('https://api.github.com/repos/acme/app/issues/7/comments');
    const body = JSON.parse(post.body!).body as string;
    expect(body).toContain(MARKER);
    expect(body).toContain('CodeRoast:');
    expect(body).toContain('https://github.com/acme/app/blob/abc123/src/bad.js#L1) 🆕');
    expect(body).toContain('https://code-roast-five.vercel.app/r/');
    expect(h.written['/summary.md']).toContain(MARKER);
    expect(h.written['/output.txt']).toMatch(/^score=\d+\nverdict=.+\n$/);
  });

  it('updates its previous comment instead of posting a new one', async () => {
    const h = harness({ comments: [[{ id: 99, body: `old\n${MARKER}` }]] });
    await run(h.env, h.io, h.fetchImpl);
    expect(h.calls.some((c) => c.method === 'POST')).toBe(false);
    expect(h.calls.find((c) => c.method === 'PATCH')!.url).toBe('https://api.github.com/repos/acme/app/issues/comments/99');
  });

  it('finds its comment past the first page instead of posting a duplicate', async () => {
    const others = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, body: 'lgtm' }));
    const h = harness({ comments: [others, [{ id: 555, body: MARKER }]] });
    await run(h.env, h.io, h.fetchImpl);
    expect(h.calls.filter((c) => c.url.includes('/issues/7/comments?')).map((c) => c.url.split('&')[1])).toEqual(['page=1', 'page=2']);
    expect(h.calls.some((c) => c.method === 'POST')).toBe(false);
    expect(h.calls.find((c) => c.method === 'PATCH')!.url).toBe('https://api.github.com/repos/acme/app/issues/comments/555');
  });

  it('still succeeds (summary only) when the token cannot comment, e.g. fork PRs', async () => {
    const h = harness({ failComment: true });
    const r = await run(h.env, h.io, h.fetchImpl);
    expect(r.score).not.toBeNull();
    expect(h.logs.join('\n')).toMatch(/Could not comment.*job summary/);
    expect(h.written['/summary.md']).toContain(MARKER);
  });

  it('fails the check below the fail-below threshold and respects comment: false', async () => {
    const h = harness({ inputs: { 'fail-below': '9', comment: 'false' } });
    const r = await run(h.env, h.io, h.fetchImpl);
    expect(r.failed).toBe(true);
    expect(r.message).toMatch(/below the fail-below threshold of 9/);
    expect(h.calls.some((c) => c.url.includes('/issues/'))).toBe(false);
  });

  it('does nothing outside pull_request events', async () => {
    const h = harness({ event: { push: {} } });
    const r = await run(h.env, h.io, h.fetchImpl);
    expect(r).toEqual({ score: null, failed: false, message: 'Not a pull_request event; nothing to roast.' });
    expect(h.calls).toEqual([]);
  });
});
