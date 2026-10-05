import { describe, expect, it } from 'vitest';
import { badgeMarkdown, decodeShare, encodeShare, readShareFromHash, shareUrl } from '../share';
import { toRawUrl } from '../githubFetcher';

describe('share links', () => {
  it('round-trips unicode roasts', () => {
    const enc = encodeShare({ s: 3, t: 'Dumpster Fire', l: 'Python', n: 42, r: ['“quotes” 🔥 émoji', 'line two'] });
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(readShareFromHash(`#r=${enc}`)).toEqual({ v: 1, s: 3, t: 'Dumpster Fire', l: 'Python', n: 42, r: ['“quotes” 🔥 émoji', 'line two'] });
    expect(shareUrl('https://x.dev', enc)).toBe(`https://x.dev/r/${enc}`);
  });

  it('rejects garbage and out-of-range scores', () => {
    expect(decodeShare('not-base64!!')).toBeNull();
    expect(readShareFromHash('#other')).toBeNull();
    const bad = btoa(JSON.stringify({ v: 1, s: 99, t: 'x', l: 'x', n: 1, r: [] }));
    expect(decodeShare(bad)).toBeNull();
  });

  it('caps payload size', () => {
    const enc = encodeShare({ s: 5, t: 'Mid', l: 'JS', n: 1, r: Array(50).fill('a'.repeat(1000)) });
    const d = decodeShare(enc)!;
    expect(d.r.length).toBe(8);
    expect(d.r[0].length).toBe(280);
  });

  it('builds a shields badge', () => {
    expect(badgeMarkdown(9, 'https://x.dev')).toBe(
      '[![Banana Score: 9/10](https://img.shields.io/badge/Banana_Score-9%2F10-brightgreen?labelColor=1f2937)](https://x.dev)',
    );
  });
});

describe('toRawUrl', () => {
  it('converts blob URLs and rejects repo roots', () => {
    expect(toRawUrl('https://github.com/a/b/blob/main/src/x.ts')).toBe('https://raw.githubusercontent.com/a/b/main/src/x.ts');
    expect(() => toRawUrl('https://github.com/a/b')).toThrow();
    expect(() => toRawUrl('https://evil.com/x.js')).toThrow();
  });
});
