// HTML served at /r/<payload>: preview tags for social crawlers (which never
// see URL hashes) and an instant client-side hop into the app for humans.
import { decodeShare } from '../lib/share.js';

const ENCODED = /^[A-Za-z0-9_-]{1,4000}$/;

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function sharePage(encoded: string, origin: string): { status: number; html: string } {
  const valid = ENCODED.test(encoded) ? decodeShare(encoded) : null;
  const target = valid ? `/#r=${encoded}` : '/';
  const title = valid ? `CodeRoast: ${valid.s}/10, “${valid.t}”` : 'CodeRoast: get your code roasted';
  const description = valid
    ? `${valid.r[0] ?? 'This code got roasted.'} Think your code can beat ${valid.s}/10?`
    : 'Brutally funny code roasts with receipts, fixes, and a Banana Score.';
  const image = valid ? `${origin}/api/og?d=${encoded}` : `${origin}/og.png`;
  const url = valid ? `${origin}/r/${encoded}` : origin;

  const e = escapeHtml;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${e(title)}</title>
<meta name="description" content="${e(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="CodeRoast" />
<meta property="og:url" content="${e(url)}" />
<meta property="og:title" content="${e(title)}" />
<meta property="og:description" content="${e(description)}" />
<meta property="og:image" content="${e(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${e(title)}" />
<meta name="twitter:description" content="${e(description)}" />
<meta name="twitter:image" content="${e(image)}" />
<meta name="robots" content="noindex" />
<script>location.replace(${JSON.stringify(target)});</script>
<style>body{background:#09090b;color:#e4e4e7;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0}a{color:#f87171}</style>
</head>
<body><p>Loading your roast… <a href="${e(target)}">Open CodeRoast</a></p></body>
</html>`;
  return { status: valid ? 200 : 404, html };
}
