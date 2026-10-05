import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeRepo, fetchRepo, parseRepoUrl, pickFiles, repoRoast } from '../repoRoast';
import { EXAMPLES } from '../examples';

describe('parseRepoUrl', () => {
  it('accepts repo roots and tree URLs, rejects files and other hosts', () => {
    expect(parseRepoUrl('https://github.com/a/b')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseRepoUrl('https://github.com/a/b.git/')).toEqual({ owner: 'a', repo: 'b' });
    expect(parseRepoUrl('https://github.com/a/b/tree/dev/src/lib')).toEqual({ owner: 'a', repo: 'b', ref: 'dev', path: 'src/lib' });
    expect(parseRepoUrl('https://github.com/a/b/blob/main/x.ts')).toBeNull();
    expect(parseRepoUrl('https://gitlab.com/a/b')).toBeNull();
    expect(parseRepoUrl('not a url')).toBeNull();
  });
});

describe('pickFiles', () => {
  it('keeps the largest supported source files and skips vendored/generated ones', () => {
    const tree = [
      { path: 'src/big.ts', type: 'blob', size: 9000 },
      { path: 'src/small.py', type: 'blob', size: 100 },
      { path: 'node_modules/x/index.js', type: 'blob', size: 99999 },
      { path: 'dist/app.min.js', type: 'blob', size: 50000 },
      { path: 'types/index.d.ts', type: 'blob', size: 5000 },
      { path: 'README.md', type: 'blob', size: 7000 },
      { path: 'src', type: 'tree' },
      { path: 'huge.js', type: 'blob', size: 10_000_000 },
    ];
    expect(pickFiles(tree).map((e) => e.path)).toEqual(['src/big.ts', 'src/small.py']);
    expect(pickFiles(tree, 'src', 1).map((e) => e.path)).toEqual(['src/big.ts']);
  });
});

describe('analyzeRepo + repoRoast', () => {
  const files = [
    { path: 'src/intern.js', code: EXAMPLES[0].code },
    { path: 'lib/left-pad.js', code: EXAMPLES[3].code },
    { path: 'scripts/old.py', code: EXAMPLES[2].code },
  ];

  it('aggregates findings, orders worst-first and line-weights the score', () => {
    const r = analyzeRepo('a/b', 'main', files);
    expect(r.files[r.files.length - 1].path).toBe('lib/left-pad.js');
    expect(r.files[0].analysis.score).toBe(1);
    expect(r.score).toBeGreaterThanOrEqual(1);
    expect(r.score).toBeLessThanOrEqual(5);
    const varRule = r.aggregate.findings.find((f) => f.rule === 'varKeyword')!;
    expect(varRule.count).toBe(4); // 3 in intern.js + 1 in left-pad
    expect(r.aggregate.findings.find((f) => f.rule === 'secret')!.count).toBe(2);
    expect(r.langs.sort()).toEqual(['javascript', 'python']);
  });

  it('names the crime scene', () => {
    const roast = repoRoast(analyzeRepo('a/b', 'main', files), 'savage');
    expect(roast.crimeScene).toContain('lib/left-pad.js');
    expect(roast.lines.length).toBeGreaterThan(2);
  });
});

describe('fetchRepo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves the default branch, fetches files and reports progress', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      if (url === 'https://api.github.com/repos/a/b') return Response.json({ default_branch: 'trunk' });
      if (url.startsWith('https://api.github.com/repos/a/b/git/trees/trunk')) {
        return Response.json({ tree: [{ path: 'src/x.ts', type: 'blob', size: 10 }, { path: 'y.py', type: 'blob', size: 5 }] });
      }
      if (url.startsWith('https://raw.githubusercontent.com/a/b/trunk/')) return new Response('const x = 1;\n');
      return new Response('nope', { status: 500 });
    });
    const progress: number[] = [];
    const { files, branch } = await fetchRepo({ owner: 'a', repo: 'b' }, (d) => progress.push(d));
    expect(branch).toBe('trunk');
    expect(files.map((f) => f.path).sort()).toEqual(['src/x.ts', 'y.py']);
    expect(progress.at(-1)).toBe(2);
  });

  it('explains rate limits and missing repos', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 403 }));
    await expect(fetchRepo({ owner: 'a', repo: 'b' })).rejects.toThrow(/rate limit/);
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
    await expect(fetchRepo({ owner: 'a', repo: 'b' })).rejects.toThrow(/not found/);
  });
});
