// Deterministic, dependency-free static analysis.
// Runs instantly on any device and produces "receipts" (findings with line
// numbers) that both the instant roast and the AI roast are built on.

export type Lang =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'c'
  | 'other';

export type Severity = 'low' | 'medium' | 'high';

export interface Finding {
  rule: RuleId;
  severity: Severity;
  count: number;
  lines: number[]; // 1-based, first few occurrences
  detail?: string;
}

export interface Metrics {
  totalLines: number;
  codeLines: number;
  commentLines: number;
  maxDepth: number;
  longestLine: number;
}

export interface Analysis {
  lang: Lang;
  metrics: Metrics;
  findings: Finding[];
  score: number; // 1–10, 10 = pristine
}

export type RuleId =
  | 'secret'
  | 'eval'
  | 'emptyCatch'
  | 'bareExcept'
  | 'debugLog'
  | 'debugger'
  | 'todo'
  | 'varKeyword'
  | 'looseEquality'
  | 'anyType'
  | 'suppression'
  | 'deepNesting'
  | 'longLines'
  | 'hugeFile'
  | 'vagueNames'
  | 'commentedCode'
  | 'nestedTernary'
  | 'duplicateLines'
  | 'mutableDefault'
  | 'wildcardImport'
  | 'globalKeyword'
  | 'unwrap'
  | 'ignoredError'
  | 'rescueNil'
  | 'unsafeC'
  | 'gotoStatement'
  | 'rawInput'
  | 'tooShort';

const SEVERITY_WEIGHT: Record<Severity, number> = { low: 0.4, medium: 0.9, high: 2.2 };
// Repeated sins hurt more, but with diminishing returns so one rule can't
// zero the score on its own.
const MAX_PENALTY_PER_RULE = 3;

const MAX_LINES_REPORTED = 5;

const C_LIKE: Lang[] = ['javascript', 'typescript', 'go', 'rust', 'java', 'csharp', 'php', 'c', 'other'];
// Languages whose blocks are delimited by indentation or `end`, not braces.
const INDENT_LANGS: Lang[] = ['python', 'ruby'];
const HASH_COMMENT_LANGS: Lang[] = ['python', 'ruby'];
const JS_LIKE: Lang[] = ['javascript', 'typescript'];

const EXT_TO_LANG: Record<string, Lang> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'java',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  c: 'c',
  h: 'c',
  cc: 'c',
  cpp: 'c',
  cxx: 'c',
  hpp: 'c',
};

export function langFromPath(path: string): Lang | null {
  const ext = path.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_LANG[ext] ?? null;
}

export function detectLang(code: string): Lang {
  // Ruby before Python: both use `def`, but only Ruby closes blocks with `end`.
  if (/^\s*(def \w+[?!]?(\(.*\))?|class \w+( < \w+)?|module \w+)\s*$/m.test(code) && /^\s*end\s*$/m.test(code)) return 'ruby';
  if (/^\s*(def |class \w+(\(.*\))?:|import \w+$|from \S+ import )/m.test(code) && !/[{};]\s*$/m.test(code)) {
    return 'python';
  }
  if (/^\s*<\?php/m.test(code) || /^\s*\$\w+\s*=[^=>].*;\s*$/m.test(code) && /\bfunction\s+\w+\s*\(\s*\$/.test(code)) return 'php';
  if (/^\s*#include\s*[<"]/m.test(code)) return 'c';
  if (/^\s*using System|\bConsole\.Write/m.test(code)) return 'csharp';
  if (/^\s*package \w+\s*$/m.test(code) && /\bfunc\b/.test(code)) return 'go';
  if (/\bfn \w+\s*[<(]/.test(code) && /\blet (mut )?\w+/.test(code)) return 'rust';
  if (/\b(public|private) (static )?(class|void|int|String)\b/.test(code)) return 'java';
  if (/:\s*(string|number|boolean|any)\b|\binterface \w+\s*\{|\btype \w+\s*=/.test(code)) return 'typescript';
  return 'javascript';
}

interface Line {
  n: number; // 1-based
  raw: string;
  code: string; // with line comments and string contents stripped
  isComment: boolean;
}

// Index where a line comment starts in (string-stripped) code, or -1.
// PHP accepts both `//` and `#`, but `#[...]` is a PHP 8 attribute, not a comment.
function lineCommentStart(code: string, lang: Lang) {
  if (HASH_COMMENT_LANGS.includes(lang)) return code.indexOf('#');
  const slash = code.indexOf('//');
  if (lang !== 'php') return slash;
  const hash = code.search(/#(?!\[)/);
  if (slash < 0) return hash;
  return hash < 0 ? slash : Math.min(slash, hash);
}

// Removes string literal contents so rules don't fire on text inside strings.
function stripStrings(s: string) {
  return s.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, (m) => m[0] + m[0]);
}

function splitLines(code: string, lang: Lang): Line[] {
  let inBlock = false;
  return code.split('\n').map((raw, i) => {
    const trimmed = raw.trim();
    let isComment = false;
    if (!HASH_COMMENT_LANGS.includes(lang)) {
      if (inBlock) {
        isComment = true;
        if (trimmed.includes('*/')) inBlock = false;
      } else if (trimmed.startsWith('/*')) {
        isComment = true;
        inBlock = !trimmed.includes('*/');
      }
    }
    if (lineCommentStart(trimmed, lang) === 0) isComment = true;
    let stripped = stripStrings(raw);
    const idx = lineCommentStart(stripped, lang);
    if (idx >= 0) stripped = stripped.slice(0, idx);
    return { n: i + 1, raw, code: isComment ? '' : stripped, isComment };
  });
}

function indentWidth(raw: string) {
  const m = raw.match(/^[\t ]*/)![0];
  return m.replace(/\t/g, '    ').length;
}

function computeMaxDepth(lines: Line[], lang: Lang) {
  if (INDENT_LANGS.includes(lang)) {
    const widths = lines.filter((l) => l.code.trim()).map((l) => indentWidth(l.raw));
    const nonZero = widths.filter((w) => w > 0);
    if (nonZero.length === 0) return 0;
    const unit = Math.max(2, Math.min(...nonZero));
    return Math.max(...widths.map((w) => Math.round(w / unit)));
  }
  let depth = 0;
  let max = 0;
  for (const l of lines) {
    for (const ch of l.code) {
      if (ch === '{') max = Math.max(max, ++depth);
      else if (ch === '}') depth = Math.max(0, depth - 1);
    }
  }
  return max;
}

type Matcher = (line: Line, lang: Lang) => boolean;

interface LineRule {
  id: RuleId;
  severity: Severity;
  langs?: Lang[];
  test: Matcher;
  useRaw?: boolean;
}

const VAGUE_NAME = /\b(?:let|const|var|val)\s+(data\d*|temp\d*|tmp\d*|foo|bar|baz|stuff|thing\d*|obj\d*|res\d*|val\d*|x\d+|asdf|lol|test\d*|[a-hm-z])\s*[=:;]/;
const PHP_VAGUE_NAME = /^\s*\$(data\d*|temp\d*|tmp\d*|foo|bar|baz|stuff|thing\d*|obj\d*|x\d+|asdf|lol|[a-hm-z])\s*=[^=]/;
const PY_VAGUE_NAME = /^\s*(data\d*|temp\d*|tmp\d*|foo|bar|baz|stuff|thing\d*|obj\d*|x\d+|asdf|lol|[a-hm-z])\s*=[^=]/;

const LINE_RULES: LineRule[] = [
  {
    id: 'secret',
    severity: 'high',
    useRaw: true,
    test: (l) =>
      /(api[_-]?key|secret|passw(or)?d|access[_-]?token|auth[_-]?token|private[_-]?key)\w*["']?\s*[:=]\s*["'][^"'\s]{6,}["']/i.test(l.raw) ||
      /\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[bp]-[A-Za-z0-9-]{10,})\b/.test(l.raw),
  },
  { id: 'eval', severity: 'high', test: (l) => /(^|[^.\w])(eval|exec)\s*\(|new Function\s*\(/.test(l.code) },
  { id: 'emptyCatch', severity: 'high', langs: C_LIKE, test: (l) => /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(l.code) },
  {
    id: 'bareExcept',
    severity: 'high',
    langs: ['python'],
    test: (l) => /^\s*except\s*:/.test(l.code) || /^\s*except\b.*:\s*pass\s*$/.test(l.code),
  },
  {
    id: 'debugLog',
    severity: 'low',
    test: (l, lang) =>
      lang === 'python'
        ? /^\s*print\s*\(/.test(l.code)
        : lang === 'ruby'
          ? /^\s*(puts|p|pp|print)\s/.test(l.code)
          : lang === 'c'
            ? false // printf is how C programs talk; not a debugging smell on its own
            : /\bconsole\.(log|debug|dir)\s*\(|\bSystem\.out\.print|\bConsole\.Write(Line)?\s*\(|\b(var_dump|print_r|dd)\s*\(|\bfmt\.Print(ln|f)?\s*\(|\bprintln!\s*\(|\bdbg!\s*\(/.test(l.code),
  },
  { id: 'debugger', severity: 'medium', langs: JS_LIKE, test: (l) => /^\s*debugger\s*;?\s*$/.test(l.code) },
  { id: 'todo', severity: 'low', useRaw: true, test: (l) => /\b(TODO|FIXME|HACK|XXX)\b/.test(l.raw) },
  { id: 'varKeyword', severity: 'medium', langs: JS_LIKE, test: (l) => /(^|[;{(\s])var\s+\w/.test(l.code) },
  { id: 'looseEquality', severity: 'medium', langs: [...JS_LIKE, 'php'], test: (l) => /[^=!<>]==[^=]|!=[^=]/.test(l.code) },
  {
    id: 'anyType',
    severity: 'medium',
    langs: ['typescript', 'csharp'],
    test: (l, lang) => (lang === 'csharp' ? /\bdynamic\s+\w/.test(l.code) : /:\s*any\b|\bas any\b|<any>/.test(l.code)),
  },
  {
    id: 'suppression',
    severity: 'medium',
    useRaw: true,
    test: (l, lang) =>
      /@ts-ignore|@ts-nocheck|eslint-disable|#\s*type:\s*ignore|#\s*noqa|@SuppressWarnings|#\[allow\(|#pragma warning disable|rubocop:disable/.test(l.raw) ||
      (lang === 'php' && /(^|[=(\s])@\$?\w+/.test(l.code)),
  },
  { id: 'longLines', severity: 'low', useRaw: true, test: (l) => l.raw.length > 120 },
  {
    id: 'vagueNames',
    severity: 'low',
    test: (l, lang) =>
      INDENT_LANGS.includes(lang)
        ? PY_VAGUE_NAME.test(l.code)
        : lang === 'php'
          ? PHP_VAGUE_NAME.test(l.code)
          : VAGUE_NAME.test(l.code),
  },
  {
    id: 'commentedCode',
    severity: 'low',
    useRaw: true,
    test: (l, lang) => {
      if (!l.isComment) return false;
      const body = l.raw.trim().replace(/^(\/\/|#|\/\*|\*)\s?/, '');
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(body)) return false;
      return HASH_COMMENT_LANGS.includes(lang)
        ? /^(def |return\b|import |require |from |if .*:?$|for .*:$|\w+\s*=\s*\S|\w+(\.\w+)*\(.*\)$)/.test(body)
        : /(;\s*$|^(const|let|var|return|if|for|while|function)\b.*[;{(]|^\w+(\.\w+)*\(.*\);?$|^}\s*$)/.test(body);
    },
  },
  { id: 'nestedTernary', severity: 'medium', langs: C_LIKE, test: (l) => /\?[^?:]+:[^?;]*\?[^?:]+:/.test(l.code) },
  {
    id: 'mutableDefault',
    severity: 'medium',
    langs: ['python'],
    test: (l) => /^\s*def \w+\(.*=\s*(\[\]|\{\}|set\(\))/.test(l.code),
  },
  {
    id: 'wildcardImport',
    severity: 'medium',
    test: (l, lang) => (lang === 'python' ? /^\s*from \S+ import \*/.test(l.code) : /^\s*import .*\.\*;/.test(l.code)),
  },
  { id: 'globalKeyword', severity: 'medium', langs: ['python', 'php'], test: (l) => /^\s*global\s+\$?\w/.test(l.code) },
  { id: 'unwrap', severity: 'low', langs: ['rust'], test: (l) => /\.unwrap\(\)|\.expect\(/.test(l.code) },
  { id: 'ignoredError', severity: 'medium', langs: ['go'], test: (l) => /(^|,)\s*_\s*(,\s*\w+\s*)?:?=\s*\w/.test(l.code) },
  {
    id: 'rescueNil',
    severity: 'high',
    langs: ['ruby'],
    test: (l) => /\brescue\s+nil\b/.test(l.code) || /^\s*rescue\s*(=>\s*\w+)?\s*$/.test(l.code),
  },
  { id: 'unsafeC', severity: 'high', langs: ['c'], test: (l) => /\b(gets|strcpy|strcat|sprintf|vsprintf)\s*\(/.test(l.code) },
  { id: 'gotoStatement', severity: 'medium', langs: ['c', 'csharp', 'php'], test: (l) => /^\s*goto\s+\w+\s*;/.test(l.code) },
  {
    id: 'rawInput',
    severity: 'high',
    langs: ['php'],
    // Request data dropped straight into output or a query: XSS / SQL injection.
    test: (l) =>
      /\$_(GET|POST|REQUEST|COOKIE)\[/.test(l.code) && /\b(echo|print|mysql_query|mysqli_query|query|exec|system)\b/.test(l.code),
  },
];

export function analyze(code: string, langHint?: Lang): Analysis {
  const lang: Lang = langHint && langHint !== 'other' ? langHint : detectLang(code);
  const lines = splitLines(code.replace(/\r\n?/g, '\n'), lang);
  const nonBlank = lines.filter((l) => l.raw.trim());
  const commentLines = nonBlank.filter((l) => l.isComment).length;

  const metrics: Metrics = {
    totalLines: lines.length,
    codeLines: nonBlank.length - commentLines,
    commentLines,
    maxDepth: computeMaxDepth(lines, lang),
    longestLine: Math.max(0, ...lines.map((l) => l.raw.length)),
  };

  const findings: Finding[] = [];
  const push = (rule: RuleId, severity: Severity, hitLines: number[], detail?: string, count = hitLines.length) => {
    if (count > 0) findings.push({ rule, severity, count, lines: hitLines.slice(0, MAX_LINES_REPORTED), detail });
  };

  if (metrics.codeLines < 3) {
    push('tooShort', 'low', [], undefined, 1);
  }

  for (const rule of LINE_RULES) {
    if (rule.langs && !rule.langs.includes(lang)) continue;
    const hits: number[] = [];
    for (const l of lines) {
      if (!rule.useRaw && l.isComment) continue;
      if (rule.test(l, lang)) hits.push(l.n);
    }
    push(rule.id, rule.severity, hits);
  }

  if (metrics.maxDepth >= 5) {
    push('deepNesting', metrics.maxDepth >= 7 ? 'high' : 'medium', [], String(metrics.maxDepth), 1);
  }
  if (metrics.codeLines > 400) {
    push('hugeFile', metrics.codeLines > 1000 ? 'high' : 'medium', [], String(metrics.codeLines), 1);
  }

  const seen = new Map<string, number[]>();
  for (const l of lines) {
    // Compare the raw text: with string contents stripped, every row of a
    // data table ({ value: '…', label: '…' }) would look identical.
    if (l.isComment) continue;
    const t = l.raw.trim();
    if (t.length < 25) continue;
    seen.set(t, [...(seen.get(t) ?? []), l.n]);
  }
  const dupes = [...seen.values()].filter((ns) => ns.length >= 3);
  if (dupes.length) {
    push('duplicateLines', 'medium', dupes.flat().sort((a, b) => a - b), undefined, dupes.length);
  }

  findings.sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || b.count - a.count);

  return { lang, metrics, findings, score: scoreFindings(findings) };
}

export function scoreFindings(findings: Finding[]): number {
  let penalty = 0;
  for (const f of findings) {
    const w = SEVERITY_WEIGHT[f.severity];
    penalty += Math.min(MAX_PENALTY_PER_RULE, w * (1 + Math.log2(f.count)));
  }
  return Math.max(1, Math.min(10, Math.round(10 - penalty)));
}
