// Renders a 1200x630 roast card (the social-preview size) with plain canvas.

export interface CardData {
  kind?: 'roast';
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

export interface BattleCardData {
  kind: 'battle';
  a: { m: string; s: number; t: string; r: string[] };
  b: { m: string; s: number; t: string; r: string[] };
  headline: string;
  site: string;
}

export function drawBattleCard(canvas: HTMLCanvasElement, d: BattleCardData) {
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

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f87171';
  ctx.font = font(32, 800);
  ctx.fillText('⚔️ CodeRoast Battle', 56, 84);

  const winner = d.a.s === d.b.s ? null : d.a.s > d.b.s ? 'a' : 'b';
  const colW = (W - 56 * 2 - 80) / 2;
  const sides: Array<[BattleCardData['a'], number, boolean]> = [
    [d.a, 56, winner === 'a'],
    [d.b, 56 + colW + 80, winner === 'b'],
  ];
  for (const [f, x, won] of sides) {
    const color = scoreColor(f.s);
    ctx.fillStyle = won ? 'rgba(250,204,21,0.08)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(x, 120, colW, 400);
    ctx.fillStyle = won ? '#facc15' : color;
    ctx.fillRect(x, 120, colW, 8);
    ctx.textAlign = 'center';
    const cx = x + colW / 2;
    ctx.fillStyle = '#fafafa';
    ctx.font = font(30, 800);
    ctx.fillText(`${won ? '🏆 ' : ''}${f.m}`, cx, 180, colW - 32);
    ctx.fillStyle = color;
    ctx.font = font(150, 800);
    ctx.fillText(String(f.s), cx, 340);
    ctx.fillStyle = '#71717a';
    ctx.font = font(26, 600);
    ctx.fillText(`/ 10 · ${f.t.toUpperCase()}`, cx, 385, colW - 32);
    ctx.fillStyle = '#d4d4d8';
    ctx.font = font(22, 500);
    const lines = f.r[0] ? wrap(ctx, `“${f.r[0]}”`, colW - 48).slice(0, 3) : [];
    lines.forEach((l, i) => ctx.fillText(l, cx, 430 + i * 30));
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#71717a';
  ctx.font = font(44, 900);
  ctx.fillText('VS', W / 2, 330);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#a1a1aa';
  ctx.font = font(22, 600);
  const head = wrap(ctx, d.headline, W - 112)[0] ?? '';
  ctx.fillText(head, 56, 560);
  ctx.fillStyle = '#71717a';
  ctx.fillText(`Start your own battle → ${d.site.replace(/^https?:\/\//, '')}`, 56, 596);
}

export function drawAnyCard(canvas: HTMLCanvasElement, d: CardData | BattleCardData) {
  if (d.kind === 'battle') drawBattleCard(canvas, d);
  else drawCard(canvas, d);
}

export function cardToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'),
  );
}
