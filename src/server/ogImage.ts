// Builds the per-roast social preview image (1200x630) as a Satori element
// tree. Plain objects instead of JSX keep the Vercel function build simple.
import type { SharePayload } from '../lib/share';

type El = { type: string; props: Record<string, unknown> & { children?: unknown } };

const h = (type: string, style: Record<string, unknown>, children?: unknown): El => ({
  type,
  props: { style, children },
});

export function scoreColor(score: number) {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#facc15';
  if (score >= 4) return '#f97316';
  return '#ef4444';
}

const MAX_QUOTES = 3;
const MAX_QUOTE_CHARS = 120;

function clip(s: string) {
  return s.length > MAX_QUOTE_CHARS ? `${s.slice(0, MAX_QUOTE_CHARS - 1).trimEnd()}…` : s;
}

export function ogTree(p: SharePayload | null, site: string): El {
  const host = site.replace(/^https?:\/\//, '');
  if (!p) {
    return h(
      'div',
      {
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 90px', background: 'linear-gradient(135deg, #0b0b0f, #2a0a0a)', color: '#fafafa',
      },
      [
        h('div', { fontSize: 40, fontWeight: 800, color: '#f87171' }, 'CodeRoast'),
        h('div', { fontSize: 92, fontWeight: 900, marginTop: 20 }, 'Your code, roasted.'),
        h('div', { fontSize: 32, color: '#a1a1aa', marginTop: 30 }, host),
      ],
    );
  }

  const color = scoreColor(p.s);
  const quotes = p.r.slice(0, MAX_QUOTES).map((q) =>
    h('div', { fontSize: 30, color: '#e4e4e7', marginBottom: 22, lineHeight: 1.3 }, `“${clip(q)}”`),
  );

  return h(
    'div',
    {
      width: '100%', height: '100%', display: 'flex', padding: 56,
      background: 'linear-gradient(135deg, #0b0b0f, #2a0a0a)', color: '#fafafa',
    },
    [
      h(
        'div',
        {
          width: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.04)', borderTop: `8px solid ${color}`,
        },
        [
          h('div', { fontSize: 24, fontWeight: 600, color: '#a1a1aa', letterSpacing: 2 }, 'BANANA SCORE'),
          h('div', { fontSize: 180, fontWeight: 800, color, lineHeight: 1 }, String(p.s)),
          h('div', { fontSize: 36, fontWeight: 600, color: '#71717a' }, '/ 10'),
          h('div', { fontSize: 28, fontWeight: 800, marginTop: 36, textAlign: 'center', padding: '0 16px' }, p.t.toUpperCase()),
        ],
      ),
      h('div', { flex: 1, display: 'flex', flexDirection: 'column', paddingLeft: 48 }, [
        h('div', { fontSize: 32, fontWeight: 800, color: '#f87171', marginBottom: 28 }, `CodeRoast · ${p.l} · ${p.n} lines`),
        h('div', { display: 'flex', flexDirection: 'column', flex: 1 }, quotes),
        h('div', { fontSize: 26, fontWeight: 700, color: '#a1a1aa' }, `Think you can beat ${p.s}/10? → ${host}`),
      ]),
    ],
  );
}
