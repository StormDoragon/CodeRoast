import { describe, expect, it } from 'vitest';
import { analyze, detectLang, langFromPath } from '../analyzer';
import { EXAMPLES } from '../examples';

const rules = (code: string, lang?: Parameters<typeof analyze>[1]) => analyze(code, lang).findings.map((f) => f.rule);

describe('analyze', () => {
  it('flags the classic JS sins with line numbers', () => {
    const a = analyze(EXAMPLES[0].code, 'javascript');
    const ids = a.findings.map((f) => f.rule);
    for (const r of ['secret', 'eval', 'emptyCatch', 'varKeyword', 'looseEquality', 'debugLog', 'todo', 'debugger', 'deepNesting', 'commentedCode']) {
      expect(ids).toContain(r);
    }
    expect(a.findings.find((f) => f.rule === 'secret')!.lines).toEqual([1]);
    expect(a.score).toBeLessThanOrEqual(3);
  });

  it('gives clean code a high score', () => {
    const clean = `export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function average(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}
`;
    const a = analyze(clean, 'typescript');
    expect(a.findings).toEqual([]);
    expect(a.score).toBe(10);
  });

  it('ignores sins inside strings and comments', () => {
    expect(rules(`const msg = "use var and == and eval( here";\nconst ok = msg.length;\nexport { ok };`, 'javascript')).toEqual([]);
  });

  it('handles python specifics', () => {
    const ids = rules(EXAMPLES[2].code, 'python');
    for (const r of ['wildcardImport', 'secret', 'mutableDefault', 'globalKeyword', 'bareExcept', 'debugLog', 'deepNesting']) {
      expect(ids).toContain(r);
    }
    expect(ids).not.toContain('varKeyword');
  });

  it('flags TypeScript any and suppressions', () => {
    const ids = rules(EXAMPLES[1].code, 'typescript');
    expect(ids).toEqual(expect.arrayContaining(['anyType', 'suppression', 'nestedTernary', 'longLines']));
  });

  it('flags tiny input and never scores below 1', () => {
    expect(rules('x', 'javascript')).toContain('tooShort');
    const awful = Array.from({ length: 50 }, () => 'var x = eval("1") == 2; console.log(x); // TODO').join('\n');
    expect(analyze(awful, 'javascript').score).toBe(1);
  });

  it('detects languages', () => {
    expect(detectLang('def foo():\n    return 1')).toBe('python');
    expect(detectLang('package main\nfunc main() {}')).toBe('go');
    expect(detectLang('fn main() { let mut x = 1; }')).toBe('rust');
    expect(detectLang('const x: number = 1;')).toBe('typescript');
    expect(detectLang('const x = 1;')).toBe('javascript');
    expect(langFromPath('/a/b/c.tsx')).toBe('typescript');
    expect(langFromPath('/a/b/README.md')).toBeNull();
  });
});
