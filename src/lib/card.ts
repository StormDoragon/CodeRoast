// Renders a 1200x630 roast card (the social-preview size) with plain canvas.

export interface CardData {
  score: number;
  title: string;
  emoji: string;
  lang: string;
  lines: string[];
  site: string;
}

const W = 1200;
const H = 630;

function scoreColor(score: number) {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#facc15';
  if (score >= 4) return '#f97316';
  return '#ef4444';
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && cur) {
      out.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function drawCard(canvas: HTMLCanvasElement, d: CardData) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = (size: number, weight = 400) =>
    `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b0b0f');
  bg.addColorStop(1, '#2a0a0a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Score panel
  const color = scoreColor(d.score);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(56, 56, 300, 518);
  ctx.fillStyle = color;
  ctx.fillRect(56, 56, 300, 8);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#a1a1aa';
  ctx.font = font(24, 600);
  ctx.fillText('BANANA SCORE', 206, 130);
  ctx.fillStyle = color;
  ctx.font = font(170, 800);
  ctx.fillText(String(d.score), 206, 320);
  ctx.fillStyle = '#71717a';
  ctx.font = font(36, 600);
  ctx.fillText('/ 10', 206, 375);
  ctx.font = font(64);
  ctx.fillText(d.emoji, 206, 470);
  ctx.fillStyle = '#fafafa';
  let titleSize = 28;
  ctx.font = font(titleSize, 700);
  while (ctx.measureText(d.title.toUpperCase()).width > 270 && titleSize > 16) {
    ctx.font = font(--titleSize, 700);
  }
  ctx.fillText(d.title.toUpperCase(), 206, 535);

  // Roast text
  ctx.textAlign = 'left';
  const x = 400;
  const maxW = W - x - 56;
  ctx.fillStyle = '#f87171';
  ctx.font = font(30, 800);
  const label = d.lang.length > 34 ? `${d.lang.slice(0, 33)}…` : d.lang;
  ctx.fillText(`🔥 CodeRoast · ${label}`, x, 108);

  ctx.fillStyle = '#e4e4e7';
  ctx.font = font(28, 500);
  let y = 170;
  const lineH = 38;
  const maxY = H - 110;
  // Only draw quotes that fit completely; a joke cut mid-sentence isn't funny.
  for (const raw of d.lines) {
    const wrapped = wrap(ctx, `“${raw}”`, maxW);
    if (y + (wrapped.length - 1) * lineH > maxY) break;
    for (const w of wrapped) {
      ctx.fillText(w, x, y);
      y += lineH;
    }
    y += 16;
  }

  ctx.fillStyle = '#71717a';
  ctx.font = font(24, 600);
  ctx.fillText(`Get roasted → ${d.site.replace(/^https?:\/\//, '')}`, x, H - 64);
}

export function cardToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'),
  );
}
