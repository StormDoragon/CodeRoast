// Roast battles: two snippets, one winner. Pure and deterministic, so a
// battle can be replayed from its share link.

import { analyze, type Analysis, type Lang } from './analyzer';
import { hashString, liteRoast, type Intensity, type LiteRoast } from './roastLite';

export interface Fighter {
  name: string;
  code: string;
  lang?: Lang;
}

export interface BattleSide {
  name: string;
  analysis: Analysis;
  roast: LiteRoast;
}

export interface BattleResult {
  a: BattleSide;
  b: BattleSide;
  winner: 'a' | 'b' | 'tie';
  margin: number; // score difference
  headline: string;
}

export const MAX_NAME = 24;

export function cleanName(name: string, fallback: string) {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return n || fallback;
}

// Total occurrences across all findings: the tie-breaker when scores match.
function sinCount(a: Analysis) {
  return a.findings.reduce((n, f) => (f.rule === 'tooShort' ? n : n + f.count), 0);
}

const WIN_LINES = [
  '{W} wins by {m} banana{s}. {L}, go sit in the corner and think about your code.',
  '{W} takes it, {m} banana{s} clear. {L} has been sent back to code review.',
  'Flawless? No. Better than {L}? By {m} banana{s}. {W} wins.',
];
const SINS_LINES = [
  'Dead even on bananas, but {L} sinned more. {W} wins on a technicality.',
  'Same score, fewer crimes. {W} squeaks past {L}.',
];
const TIE_LINES = [
  'A perfect tie. You are both equally guilty. Detention for everyone.',
  'Tie. The ape refuses to pick a favorite between two disappointments.',
];

export function battle(a: Fighter, b: Fighter, intensity: Intensity = 'savage', seed = 0): BattleResult {
  const sideA: BattleSide = { name: cleanName(a.name, 'Fighter A'), ...roastSide(a, intensity, seed) };
  const sideB: BattleSide = { name: cleanName(b.name, 'Fighter B'), ...roastSide(b, intensity, seed + 1) };
  const sa = sideA.analysis.score;
  const sb = sideB.analysis.score;
  let winner: BattleResult['winner'];
  let pool = WIN_LINES;
  if (sa !== sb) winner = sa > sb ? 'a' : 'b';
  else {
    const ca = sinCount(sideA.analysis);
    const cb = sinCount(sideB.analysis);
    winner = ca === cb ? 'tie' : ca < cb ? 'a' : 'b';
    pool = winner === 'tie' ? TIE_LINES : SINS_LINES;
  }
  const margin = Math.abs(sa - sb);
  const [w, l] = winner === 'b' ? [sideB, sideA] : [sideA, sideB];
  const pick = pool[((hashString(a.code + '\u0000' + b.code) ^ seed) >>> 0) % pool.length];
  const headline = pick
    .replace(/\{W\}/g, w.name)
    .replace(/\{L\}/g, l.name)
    .replace(/\{m\}/g, String(margin))
    .replace(/\{s\}/g, margin === 1 ? '' : 's');
  return { a: sideA, b: sideB, winner, margin, headline };
}

function roastSide(f: Fighter, intensity: Intensity, seed: number) {
  const analysis = analyze(f.code, f.lang);
  return { analysis, roast: liteRoast(f.code, analysis, intensity, seed) };
}
