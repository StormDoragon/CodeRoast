// Share links carry the roast (never the code) in the URL hash, so sharing
// needs no backend and nothing leaves the browser until the user shares.

export interface SharePayload {
  v: 1;
  s: number; // score 1–10
  t: string; // verdict title
  l: string; // language
  n: number; // lines of code
  r: string[]; // roast lines
}

const MAX_LINES = 8;
const MAX_LINE_LEN = 280;

function toBase64Url(bytes: Uint8Array) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeShare(p: Omit<SharePayload, 'v'>): string {
  const payload: SharePayload = {
    v: 1,
    s: p.s,
    t: p.t,
    l: p.l,
    n: p.n,
    r: p.r.slice(0, MAX_LINES).map((x) => x.slice(0, MAX_LINE_LEN)),
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

// Validates untrusted input from the URL; returns null on anything odd.
// A roast battle: two fighters, each with a name and their top jokes.
export interface BattleFighter {
  m: string; // name
  s: number;
  t: string;
  l: string;
  n: number;
  r: string[];
}

export interface BattlePayload {
  v: 1;
  k: 'b';
  a: BattleFighter;
  b: BattleFighter;
  h: string; // headline, e.g. "Alice wins by 3 bananas…"
}

export type Shared = { kind: 'roast'; p: SharePayload } | { kind: 'battle'; p: BattlePayload };

const MAX_BATTLE_LINES = 3;
const MAX_NAME_LEN = 24;

type Untrusted = Record<string, unknown> | null | undefined;

function parse(encoded: string): Untrusted {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
  } catch {
    return null;
  }
}

// Validates the parts shared by roasts and battle fighters.
function scored(p: Untrusted, maxLines: number) {
  if (!p || !Array.isArray(p.r)) return null;
  const s = Math.round(Number(p.s));
  if (!(s >= 1 && s <= 10)) return null;
  return {
    s,
    t: String(p.t ?? '').slice(0, 40),
    l: String(p.l ?? '').slice(0, 60),
    n: Math.max(0, Math.min(1e6, Math.round(Number(p.n) || 0))),
    r: (p.r as unknown[]).slice(0, maxLines).map((x) => String(x).slice(0, MAX_LINE_LEN)),
  };
}

// Validates untrusted input from the URL; returns null on anything odd.
export function decodeShare(encoded: string): SharePayload | null {
  const p = parse(encoded);
  if (!p || p.v !== 1 || p.k !== undefined) return null;
  const base = scored(p, MAX_LINES);
  return base ? { v: 1, ...base } : null;
}

function fighter(p: unknown): BattleFighter | null {
  const f = p as Untrusted;
  const base = scored(f, MAX_BATTLE_LINES);
  return base && f ? { m: String(f.m ?? '').slice(0, MAX_NAME_LEN) || '?', ...base } : null;
}

export function decodeBattle(encoded: string): BattlePayload | null {
  const p = parse(encoded);
  if (!p || p.v !== 1 || p.k !== 'b') return null;
  const a = fighter(p.a);
  const b = fighter(p.b);
  return a && b ? { v: 1, k: 'b', a, b, h: String(p.h ?? '').slice(0, MAX_LINE_LEN) } : null;
}

export function decodeAny(encoded: string): Shared | null {
  const battle = decodeBattle(encoded);
  if (battle) return { kind: 'battle', p: battle };
  const roast = decodeShare(encoded);
  return roast ? { kind: 'roast', p: roast } : null;
}

export function encodeBattle(p: Omit<BattlePayload, 'v' | 'k'>): string {
  const trim = (f: BattleFighter): BattleFighter => ({
    ...f,
    m: f.m.slice(0, MAX_NAME_LEN),
    r: f.r.slice(0, MAX_BATTLE_LINES).map((x) => x.slice(0, MAX_LINE_LEN)),
  });
  const payload: BattlePayload = { v: 1, k: 'b', a: trim(p.a), b: trim(p.b), h: p.h.slice(0, MAX_LINE_LEN) };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

// Path-based so social crawlers can render a per-roast preview (they never see
// the hash). /r/<d> redirects into the app at /#r=<d>.
export function shareUrl(base: string, encoded: string) {
  return `${base}/r/${encoded}`;
}

export function readShareFromHash(hash: string): Shared | null {
  const m = hash.match(/^#r=([A-Za-z0-9_-]+)$/);
  return m ? decodeAny(m[1]) : null;
}

export function badgeMarkdown(score: number, siteUrl: string) {
  const color = score >= 8 ? 'brightgreen' : score >= 6 ? 'yellow' : score >= 4 ? 'orange' : 'red';
  const img = `https://img.shields.io/badge/Banana_Score-${score}%2F10-${color}?labelColor=1f2937`;
  return `[![Banana Score: ${score}/10](${img})](${siteUrl})`;
}
