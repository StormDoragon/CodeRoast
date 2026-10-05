import { describe, expect, it } from 'vitest';
import { analyze } from '../analyzer';
import { liteRoast, liteRoastToText, verdictFor } from '../roastLite';
import { EXAMPLES } from '../examples';

describe('liteRoast', () => {
  const code = EXAMPLES[0].code;
  const a = analyze(code, 'javascript');

  it('is deterministic for the same seed and varies across seeds', () => {
    expect(liteRoast(code, a, 'savage', 0)).toEqual(liteRoast(code, a, 'savage', 0));
    const variants = new Set(Array.from({ length: 6 }, (_, s) => liteRoastToText(liteRoast(code, a, 'savage', s))));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('fills placeholders and attaches fixes', () => {
    const r = liteRoast(code, a, 'savage');
    for (const l of r.lines) {
      expect(l.joke).not.toMatch(/\{[nds]\}|\{ies\}/);
      expect(l.fix.length).toBeGreaterThan(10);
    }
    expect(liteRoastToText(r)).toContain(`Banana Score: ${a.score}/10`);
  });

  it('shouts in unhinged mode and limits gentle mode', () => {
    expect(liteRoast(code, a, 'unhinged').opener).toBe(liteRoast(code, a, 'unhinged').opener.toUpperCase());
    expect(liteRoast(code, a, 'gentle').lines.length).toBeLessThanOrEqual(4);
  });

  it('maps scores to verdicts', () => {
    expect(verdictFor(1).title).toBe('War Crime');
    expect(verdictFor(5).title).toBe('Aggressively Mid');
    expect(verdictFor(10).title).toBe('Suspiciously Clean');
  });
});
