import { sharePage } from '../src/server/sharePage';

export const config = { runtime: 'edge' };

export default function handler(req: Request) {
  const url = new URL(req.url);
  const { status, html } = sharePage(url.searchParams.get('d') ?? '', url.origin);
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=31536000',
    },
  });
}
