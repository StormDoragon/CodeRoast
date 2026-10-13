import { describe, expect, it } from 'vitest';
import { analyze, langFromPath, type Lang, type RuleId } from '../analyzer';

interface LabeledSnippet {
  file: string;
  lang: Lang;
  code: string;
  finding: RuleId;
  line: number;
  label: string;
}

// Small, hand-reviewed fixtures: one representative actionable finding per
// supported language family, plus safe code containing look-alike text.
const positiveCases: LabeledSnippet[] = [
  {
    file: 'src/render.js',
    lang: 'javascript',
    finding: 'eval',
    line: 2,
    label: 'untrusted input is executed as JavaScript',
    code: `export function parseUserInput(input) {
  return eval(input);
}
`,
  },
  {
    file: 'src/response.ts',
    lang: 'typescript',
    finding: 'anyType',
    line: 1,
    label: 'an API boundary opts out of TypeScript checking',
    code: `export function getName(payload: any): string {
  return payload.name;
}
`,
  },
  {
    file: 'src/options.py',
    lang: 'python',
    finding: 'mutableDefault',
    line: 1,
    label: 'a list is shared as a function default',
    code: `def add_tag(name, tags=[]):
    tags.append(name)
    return tags
`,
  },
  {
    file: 'src/config.go',
    lang: 'go',
    finding: 'ignoredError',
    line: 2,
    label: 'a returned error is discarded',
    code: `func readConfig(path string) ([]byte, error) {
  data, _ := os.ReadFile(path)
  return data, nil
}
`,
  },
  {
    file: 'src/config.rs',
    lang: 'rust',
    finding: 'unwrap',
    line: 2,
    label: 'file IO can panic instead of returning its error',
    code: `fn read_config(path: &str) -> String {
    let text = std::fs::read_to_string(path).unwrap();
    text
}
`,
  },
  {
    file: 'src/Names.java',
    lang: 'java',
    finding: 'wildcardImport',
    line: 1,
    label: 'a wildcard import hides the symbols in use',
    code: `import java.util.*;

public class Names {
  public List<String> all() { return Collections.emptyList(); }
}
`,
  },
  {
    file: 'src/ValueReader.cs',
    lang: 'csharp',
    finding: 'anyType',
    line: 2,
    label: 'dynamic removes compile-time checking at an API boundary',
    code: `class ValueReader {
  public string Read(dynamic value) { return value.ToString(); }
}
`,
  },
  {
    file: 'src/greeting.php',
    lang: 'php',
    finding: 'rawInput',
    line: 3,
    label: 'request data is written into HTML without escaping',
    code: `<?php
function greet() {
  echo $_GET['name'];
}
`,
  },
  {
    file: 'app/config.rb',
    lang: 'ruby',
    finding: 'rescueNil',
    line: 2,
    label: 'a failed configuration read is silently replaced with nil',
    code: `def read_config
  File.read('config.yml') rescue nil
end
`,
  },
  {
    file: 'src/input.c',
    lang: 'c',
    finding: 'unsafeC',
    line: 3,
    label: 'gets reads into a buffer without a size limit',
    code: `int main(void) {
  char name[16];
  gets(name);
  return 0;
}
`,
  },
];

const cleanCases: Array<{ file: string; lang: Lang; code: string; label: string }> = [
  {
    file: 'src/render.js',
    lang: 'javascript',
    label: 'dangerous-looking words in documentation strings are inert',
    code: `const note = "eval(input); TODO; @ts-ignore; var x;";
export function render(value) {
  return String(value);
}
`,
  },
  {
    file: 'src/response.ts',
    lang: 'typescript',
    label: 'a string that mentions any and a suppression directive is not a finding',
    code: `const note: string = "any @ts-ignore eslint-disable TODO";
export function identity(value: string): string {
  return value;
}
`,
  },
  {
    file: 'src/options.py',
    lang: 'python',
    label: 'ordinary functions and safe defaults remain unflagged',
    code: `def add_tag(name, tags=None):
    current = [] if tags is None else list(tags)
    current.append(name)
    return current
`,
  },
  {
    file: 'src/config.go',
    lang: 'go',
    label: 'comments that mention logging or ignored errors are not findings',
    code: `package demo
// The example text mentions fmt.Println and a discarded error.
func ready() bool { return true }
`,
  },
  {
    file: 'src/config.rs',
    lang: 'rust',
    label: 'a string mentioning unwrap does not trigger the unwrap rule',
    code: `const NOTE: &str = "unwrap() TODO eval";
fn ready() -> bool {
    let available = true;
    available
}
`,
  },
  {
    file: 'src/Names.java',
    lang: 'java',
    label: 'console API names in a string are not treated as logging calls',
    code: `public class Names {
  String note = "System.out.println TODO";
  public int ready() { return 1; }
}
`,
  },
  {
    file: 'src/ValueReader.cs',
    lang: 'csharp',
    label: 'dynamic and Console.WriteLine inside a string are inert',
    code: `class ValueReader {
  string note = "dynamic Console.WriteLine TODO";
  public int Read() { return 1; }
}
`,
  },
  {
    file: 'src/greeting.php',
    lang: 'php',
    label: 'HTML output is escaped and SQL values use a prepared statement',
    code: `<?php
function greet() {
  echo htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8');
}
function find(PDO $pdo) {
  $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ?');
  $stmt->execute([$_GET['id']]);
  return $stmt->fetch();
}
`,
  },
  {
    file: 'app/config.rb',
    lang: 'ruby',
    label: 'a string that mentions rescue nil is not a rescue clause',
    code: `def read_config
  message = "rescue nil TODO"
  message
end
`,
  },
  {
    file: 'src/input.c',
    lang: 'c',
    label: 'an unsafe function name inside a string is not a call',
    code: `int main(void) {
  const char *note = "gets(name); TODO eval";
  return note[0] == '\\0';
}
`,
  },
];

const lookAlikeRules: RuleId[] = [
  'secret', 'eval', 'emptyCatch', 'bareExcept', 'debugLog', 'debugger', 'todo', 'varKeyword',
  'looseEquality', 'anyType', 'suppression', 'vagueNames', 'commentedCode', 'nestedTernary',
  'mutableDefault', 'wildcardImport', 'globalKeyword', 'unwrap', 'ignoredError', 'rescueNil',
  'unsafeC', 'gotoStatement', 'rawInput',
];

describe('hand-labeled cross-language accuracy fixtures', () => {
  it.each(positiveCases)('$lang: $label', ({ file, lang, code, finding, line }) => {
    expect(langFromPath(file)).toBe(lang);
    const analysis = analyze(code, lang);
    const receipt = analysis.findings.find((f) => f.rule === finding);
    expect(receipt).toBeDefined();
    expect(receipt!.lines).toContain(line);
  });

  it.each(cleanCases)('$lang: $label', ({ lang, code }) => {
    const found = analyze(code, lang).findings.map((f) => f.rule);
    expect(found.filter((rule) => lookAlikeRules.includes(rule))).toEqual([]);
  });
});
