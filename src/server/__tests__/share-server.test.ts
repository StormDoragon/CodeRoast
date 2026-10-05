import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ImageResponse } from '@vercel/og';
import { encodeShare } from '../../lib/share';
import { sharePage } from '../sharePage';
import { ogTree } from '../ogImage';

const payload = { s: 3, t: 'Dumpster Fire', l: 'TypeScript', n: 11, r: ['3 `any`s. You installed TypeScript and then politely asked it to leave.', 'Second joke.'] };

describe('sharePage', () => {
  it('renders preview tags and redirects into the app', () => {
    const d = encodeShare(payload);
    const { status, html } = sharePage(d, 'https://roast.dev');
    expect(status).toBe(200);
    expect(html).toContain(`<meta property="og:image" content="https://roast.dev/api/og?d=${d}" />`);
    expect(html).toContain('CodeRoast: 3/10, “Dumpster Fire”');
    expect(html).toContain(`location.replace("/#r=${d}")`);
    expect(html).toContain('summary_large_image');
  });

  it('escapes hostile payload text', () => {
    const d = encodeShare({ ...payload, t: '"><script>alert(1)</script>', r: ['</title><img src=x onerror=alert(1)>'] });
    const { html } = sharePage(d, 'https://roast.dev');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falls back for invalid payloads', () => {
    for (const bad of ['', 'not valid!', '"><x>', 'AAAA']) {
      const { status, html } = sharePage(bad, 'https://roast.dev');
      expect(status).toBe(404);
      expect(html).toContain('location.replace("/")');
      expect(html).toContain('https://roast.dev/og.png');
    }
  });
});

describe('og image', () => {
  it('renders a 1200x630 PNG for a roast and for the fallback', async () => {
    for (const [name, p] of [['roast', { v: 1 as const, ...payload }], ['fallback', null]] as const) {
      const res = new ImageResponse(ogTree(p, 'https://roast.dev') as never, { width: 1200, height: 630 });
      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.subarray(1, 4).toString()).toBe('PNG');
      expect(buf.readUInt32BE(16)).toBe(1200);
      expect(buf.readUInt32BE(20)).toBe(630);
      if (process.env.OG_OUT) writeFileSync(`${process.env.OG_OUT}/og-${name}.png`, buf);
    }
  }, 30000);
});
