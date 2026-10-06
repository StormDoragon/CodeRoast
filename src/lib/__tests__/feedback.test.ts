import { describe, expect, it } from 'vitest';
import { analyze } from '../analyzer';
import { badRoastUrl } from '../feedback';
import { EXAMPLES } from '../examples';

describe('badRoastUrl', () => {
  it('builds a prefilled issue with findings but never the code', () => {
    const code = EXAMPLES[0].code;
    const url = new URL(badRoastUrl('https://github.com/acme/roast', analyze(code, 'javascript'), 'lite'));
    expect(url.pathname).toBe('/acme/roast/issues/new');
    expect(url.searchParams.get('labels')).toBe('bad-roast');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('`secret`');
    expect(body).toContain('lines 1');
    expect(body).not.toContain('sk-live');
    expect(body).not.toContain('getData');
  });
});
