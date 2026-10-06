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

  it('roasts the Go example', () => {
    const go = EXAMPLES.find((e) => e.lang === 'go')!;
    expect(rules(go.code, 'go')).toEqual(expect.arrayContaining(['secret', 'ignoredError', 'deepNesting', 'debugLog', 'todo']));
  });
});

describe('more languages', () => {
  const ids = (code: string, lang?: Parameters<typeof analyze>[1]) => analyze(code, lang).findings.map((f) => f.rule);

  it('maps file extensions', () => {
    expect(langFromPath('a/Program.cs')).toBe('csharp');
    expect(langFromPath('index.php')).toBe('php');
    expect(langFromPath('app/models/user.rb')).toBe('ruby');
    expect(langFromPath('src/main.c')).toBe('c');
    expect(langFromPath('src/engine.cpp')).toBe('c');
    expect(langFromPath('include/engine.hpp')).toBe('c');
  });

  it('detects languages without stealing JS or TS', () => {
    expect(detectLang('<?php\necho "hi";')).toBe('php');
    expect(detectLang('#include <stdio.h>\nint main() { return 0; }')).toBe('c');
    expect(detectLang('using System;\nclass A { }')).toBe('csharp');
    expect(detectLang('class User < Base\n  def name\n    @name\n  end\nend')).toBe('ruby');
    expect(detectLang("const $el = $('#app');\n$el.hide();")).toBe('javascript');
    expect(detectLang('namespace Utils {\n  export const x: number = 1;\n}')).toBe('typescript');
  });

  it('flags PHP injection, loose equality and @-suppression', () => {
    const php = `<?php
$data = $_GET['id'];
echo "Hello " . $_GET['name'];
$result = mysql_query("SELECT * FROM users WHERE id = " . $_GET['id']);
if ($data == 0) { $x = @file_get_contents('x'); }
var_dump($result);
`;
    expect(ids(php, 'php')).toEqual(expect.arrayContaining(['rawInput', 'looseEquality', 'suppression', 'vagueNames', 'debugLog']));
  });

  it('flags Ruby rescue nil and puts, with indentation-based depth', () => {
    const rb = 'def load\n  data = File.read("x") rescue nil\n  puts data\nend\n';
    expect(ids(rb, 'ruby')).toEqual(expect.arrayContaining(['rescueNil', 'debugLog', 'vagueNames']));
    expect(ids('def a\n  b\nend\n', 'ruby')).not.toContain('rescueNil');
  });

  it('flags unsafe C and goto, but not printf', () => {
    const c = '#include <stdio.h>\nint main() {\n  char buf[8];\n  gets(buf);\n  printf("%s", buf);\n  goto done;\ndone:\n  return 0;\n}\n';
    const found = ids(c, 'c');
    expect(found).toEqual(expect.arrayContaining(['unsafeC', 'gotoStatement']));
    expect(found).not.toContain('debugLog');
  });

  it('flags C# dynamic, empty catch, pragma and Console.WriteLine', () => {
    const cs = 'using System;\nclass A {\n  void B() {\n    dynamic x = Get();\n    try { Run(); } catch { }\n#pragma warning disable CS0168\n    Console.WriteLine(x);\n  }\n}\n';
    expect(ids(cs, 'csharp')).toEqual(expect.arrayContaining(['anyType', 'emptyCatch', 'suppression', 'debugLog']));
  });
});
