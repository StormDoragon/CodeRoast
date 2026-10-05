import { ImageResponse } from '@vercel/og';
import { decodeShare } from '../src/lib/share.js';
import { ogTree } from '../src/server/ogImage.js';

// Node.js runtime: Vercel's edge runtime refuses to compile @vercel/og's
// WebAssembly outside Next.js ("Wasm code generation disallowed by embedder").
export async function GET(req: Request) {
  const url = new URL(req.url);
  const d = url.searchParams.get('d') ?? '';
  const payload = /^[A-Za-z0-9_-]{1,4000}$/.test(d) ? decodeShare(d) : null;
  const image = new ImageResponse(ogTree(payload, url.origin) as never, { width: 1200, height: 630 });
  // Render fully before responding so a failure becomes a 500, not an empty 200.
  const body = await image.arrayBuffer();
  return new Response(body, {
    headers: {
      'Content-Type': 'image/png',
      // Content is addressed by the payload itself, so it can be cached forever.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
