import { describe, expect, it } from 'vitest';
import { badgeMarkdown, decodeAny, decodeBattle, decodeShare, encodeBattle, encodeShare, readShareFromHash, shareUrl } from '../share';
import { battle } from '../battle';
import { EXAMPLES } from '../examples';
import { toRawUrl } from '../githubFetcher';

describe('share links', () => {
  it('round-trips unicode roasts', () => {
    const enc = encodeShare({ s: 3, t: 'Dumpster Fire', l: 'Python', n: 42, r: ['“quotes” 🔥 émoji', 'line two'] });
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(readShareFromHash(`#r=${enc}`)).toEqual({ kind: 'roast', p: { v: 1, s: 3, t: 'Dumpster Fire', l: 'Python', n: 42, r: ['“quotes” 🔥 émoji', 'line two'] } });
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

describe('battles', () => {
  it('picks the better code as the winner, deterministically', () => {
    const r = battle({ name: 'left-pad', code: EXAMPLES[3].code }, { name: 'intern', code: EXAMPLES[0].code });
    expect(r.winner).toBe('a');
    expect(r.margin).toBe(r.a.analysis.score - r.b.analysis.score);
    expect(r.headline).toContain('left-pad');
    expect(r.headline).not.toMatch(/\{[WLms]\}/);
    expect(battle({ name: 'left-pad', code: EXAMPLES[3].code }, { name: 'intern', code: EXAMPLES[0].code })).toEqual(r);
  });

  it('calls identical code a tie and defaults blank names', () => {
    const r = battle({ name: '  ', code: EXAMPLES[1].code }, { name: '', code: EXAMPLES[1].code });
    expect(r.winner).toBe('tie');
    expect([r.a.name, r.b.name]).toEqual(['Fighter A', 'Fighter B']);
  });

  it('round-trips battle payloads and keeps the two formats apart', () => {
    const f = (m: string, s: number) => ({ m, s, t: 'x', l: 'JS', n: 3, r: ['a', 'b', 'c', 'd'] });
    const enc = encodeBattle({ a: f('Alice', 7), b: f('Bob', 3), h: 'Alice wins' });
    const d = decodeBattle(enc)!;
    expect(d.a.m).toBe('Alice');
    expect(d.a.r).toHaveLength(3);
    expect(decodeShare(enc)).toBeNull();
    expect(decodeAny(enc)?.kind).toBe('battle');
    expect(decodeAny(encodeShare({ s: 5, t: 'Mid', l: 'JS', n: 1, r: ['x'] }))?.kind).toBe('roast');
    expect(decodeBattle(btoa(JSON.stringify({ v: 1, k: 'b', a: f('A', 99), b: f('B', 1), h: '' })))).toBeNull();
  });
});
