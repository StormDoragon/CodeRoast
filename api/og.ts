import { ImageResponse } from '@vercel/og';
import { decodeShare } from '../src/lib/share';
import { ogTree } from '../src/server/ogImage';

export const config = { runtime: 'edge' };

export default function handler(req: Request) {
  const url = new URL(req.url);
  const d = url.searchParams.get('d') ?? '';
  const payload = /^[A-Za-z0-9_-]{1,4000}$/.test(d) ? decodeShare(d) : null;
  // Content is addressed by the payload itself, so it can be cached forever.
  return new ImageResponse(ogTree(payload, url.origin) as never, {
    width: 1200,
    height: 630,
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
