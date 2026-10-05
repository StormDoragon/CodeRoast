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
export function decodeShare(encoded: string): SharePayload | null {
  try {
    const p = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    if (!p || p.v !== 1 || !Array.isArray(p.r)) return null;
    const s = Math.round(Number(p.s));
    if (!(s >= 1 && s <= 10)) return null;
    return {
      v: 1,
      s,
      t: String(p.t ?? '').slice(0, 40),
      l: String(p.l ?? '').slice(0, 60),
      n: Math.max(0, Math.min(1e6, Math.round(Number(p.n) || 0))),
      r: p.r.slice(0, MAX_LINES).map((x: unknown) => String(x).slice(0, MAX_LINE_LEN)),
    };
  } catch {
    return null;
  }
}

// Path-based so social crawlers can render a per-roast preview (they never see
// the hash). /r/<d> redirects into the app at /#r=<d>.
export function shareUrl(base: string, encoded: string) {
  return `${base}/r/${encoded}`;
}

export function readShareFromHash(hash: string): SharePayload | null {
  const m = hash.match(/^#r=([A-Za-z0-9_-]+)$/);
  return m ? decodeShare(m[1]) : null;
}

export function badgeMarkdown(score: number, siteUrl: string) {
  const color = score >= 8 ? 'brightgreen' : score >= 6 ? 'yellow' : score >= 4 ? 'orange' : 'red';
  const img = `https://img.shields.io/badge/Banana_Score-${score}%2F10-${color}?labelColor=1f2937`;
  return `[![Banana Score: ${score}/10](${img})](${siteUrl})`;
}
