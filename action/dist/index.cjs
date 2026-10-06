"use strict";

// action/src/index.ts
var import_node_fs = require("node:fs");

// src/lib/analyzer.ts
var SEVERITY_WEIGHT = { low: 0.4, medium: 0.9, high: 2.2 };
var MAX_PENALTY_PER_RULE = 3;
var MAX_LINES_REPORTED = 5;
var C_LIKE = ["javascript", "typescript", "go", "rust", "java", "csharp", "php", "c", "other"];
var INDENT_LANGS = ["python", "ruby"];
var HASH_COMMENT_LANGS = ["python", "ruby"];
var JS_LIKE = ["javascript", "typescript"];
var EXT_TO_LANG = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "java",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  c: "c",
  h: "c",
  cc: "c",
  cpp: "c",
  cxx: "c",
  hpp: "c"
};
function langFromPath(path) {
  const ext = path.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? null;
}
function detectLang(code) {
  if (/^\s*(def \w+[?!]?(\(.*\))?|class \w+( < \w+)?|module \w+)\s*$/m.test(code) && /^\s*end\s*$/m.test(code)) return "ruby";
  if (/^\s*(def |class \w+(\(.*\))?:|import \w+$|from \S+ import )/m.test(code) && !/[{};]\s*$/m.test(code)) {
    return "python";
  }
  if (/^\s*<\?php/m.test(code) || /^\s*\$\w+\s*=[^=>].*;\s*$/m.test(code) && /\bfunction\s+\w+\s*\(\s*\$/.test(code)) return "php";
  if (/^\s*#include\s*[<"]/m.test(code)) return "c";
  if (/^\s*using System|\bConsole\.Write/m.test(code)) return "csharp";
  if (/^\s*package \w+\s*$/m.test(code) && /\bfunc\b/.test(code)) return "go";
  if (/\bfn \w+\s*[<(]/.test(code) && /\blet (mut )?\w+/.test(code)) return "rust";
  if (/\b(public|private) (static )?(class|void|int|String)\b/.test(code)) return "java";
  if (/:\s*(string|number|boolean|any)\b|\binterface \w+\s*\{|\btype \w+\s*=/.test(code)) return "typescript";
  return "javascript";
}
function commentPrefix(lang) {
  return HASH_COMMENT_LANGS.includes(lang) ? "#" : "//";
}
function stripStrings(s) {
  return s.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, (m) => m[0] + m[0]);
}
function splitLines(code, lang) {
  const prefix = commentPrefix(lang);
  let inBlock = false;
  return code.split("\n").map((raw, i) => {
    const trimmed = raw.trim();
    let isComment = false;
    if (!HASH_COMMENT_LANGS.includes(lang)) {
      if (inBlock) {
        isComment = true;
        if (trimmed.includes("*/")) inBlock = false;
      } else if (trimmed.startsWith("/*")) {
        isComment = true;
        inBlock = !trimmed.includes("*/");
      }
    }
    if (trimmed.startsWith(prefix)) isComment = true;
    let stripped = stripStrings(raw);
    const idx = stripped.indexOf(prefix);
    if (idx >= 0) stripped = stripped.slice(0, idx);
    return { n: i + 1, raw, code: isComment ? "" : stripped, isComment };
  });
}
function indentWidth(raw) {
  const m = raw.match(/^[\t ]*/)[0];
  return m.replace(/\t/g, "    ").length;
}
function computeMaxDepth(lines, lang) {
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
      if (ch === "{") max = Math.max(max, ++depth);
      else if (ch === "}") depth = Math.max(0, depth - 1);
    }
  }
  return max;
}
var VAGUE_NAME = /\b(?:let|const|var|val)\s+(data\d*|temp\d*|tmp\d*|foo|bar|baz|stuff|thing\d*|obj\d*|res\d*|val\d*|x\d+|asdf|lol|test\d*|[a-hm-z])\s*[=:;]/;
var PHP_VAGUE_NAME = /^\s*\$(data\d*|temp\d*|tmp\d*|foo|bar|baz|stuff|thing\d*|obj\d*|x\d+|asdf|lol|[a-hm-z])\s*=[^=]/;
var PY_VAGUE_NAME = /^\s*(data\d*|temp\d*|tmp\d*|foo|bar|baz|stuff|thing\d*|obj\d*|x\d+|asdf|lol|[a-hm-z])\s*=[^=]/;
var LINE_RULES = [
  {
    id: "secret",
    severity: "high",
    useRaw: true,
    test: (l) => /(api[_-]?key|secret|passw(or)?d|access[_-]?token|auth[_-]?token|private[_-]?key)\w*["']?\s*[:=]\s*["'][^"'\s]{6,}["']/i.test(l.raw) || /\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[bp]-[A-Za-z0-9-]{10,})\b/.test(l.raw)
  },
  { id: "eval", severity: "high", test: (l) => /(^|[^.\w])(eval|exec)\s*\(|new Function\s*\(/.test(l.code) },
  { id: "emptyCatch", severity: "high", langs: C_LIKE, test: (l) => /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(l.code) },
  {
    id: "bareExcept",
    severity: "high",
    langs: ["python"],
    test: (l) => /^\s*except\s*:/.test(l.code) || /^\s*except\b.*:\s*pass\s*$/.test(l.code)
  },
  {
    id: "debugLog",
    severity: "low",
    test: (l, lang) => lang === "python" ? /^\s*print\s*\(/.test(l.code) : lang === "ruby" ? /^\s*(puts|p|pp|print)\s/.test(l.code) : lang === "c" ? false : /\bconsole\.(log|debug|dir)\s*\(|\bSystem\.out\.print|\bConsole\.Write(Line)?\s*\(|\b(var_dump|print_r|dd)\s*\(|\bfmt\.Print(ln|f)?\s*\(|\bprintln!\s*\(|\bdbg!\s*\(/.test(l.code)
  },
  { id: "debugger", severity: "medium", langs: JS_LIKE, test: (l) => /^\s*debugger\s*;?\s*$/.test(l.code) },
  { id: "todo", severity: "low", useRaw: true, test: (l) => /\b(TODO|FIXME|HACK|XXX)\b/.test(l.raw) },
  { id: "varKeyword", severity: "medium", langs: JS_LIKE, test: (l) => /(^|[;{(\s])var\s+\w/.test(l.code) },
  { id: "looseEquality", severity: "medium", langs: [...JS_LIKE, "php"], test: (l) => /[^=!<>]==[^=]|!=[^=]/.test(l.code) },
  {
    id: "anyType",
    severity: "medium",
    langs: ["typescript", "csharp"],
    test: (l, lang) => lang === "csharp" ? /\bdynamic\s+\w/.test(l.code) : /:\s*any\b|\bas any\b|<any>/.test(l.code)
  },
  {
    id: "suppression",
    severity: "medium",
    useRaw: true,
    test: (l, lang) => /@ts-ignore|@ts-nocheck|eslint-disable|#\s*type:\s*ignore|#\s*noqa|@SuppressWarnings|#\[allow\(|#pragma warning disable|rubocop:disable/.test(l.raw) || lang === "php" && /(^|[=(\s])@\$?\w+/.test(l.code)
  },
  { id: "longLines", severity: "low", useRaw: true, test: (l) => l.raw.length > 120 },
  {
    id: "vagueNames",
    severity: "low",
    test: (l, lang) => INDENT_LANGS.includes(lang) ? PY_VAGUE_NAME.test(l.code) : lang === "php" ? PHP_VAGUE_NAME.test(l.code) : VAGUE_NAME.test(l.code)
  },
  {
    id: "commentedCode",
    severity: "low",
    useRaw: true,
    test: (l, lang) => {
      if (!l.isComment) return false;
      const body = l.raw.trim().replace(/^(\/\/|#|\/\*|\*)\s?/, "");
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(body)) return false;
      return HASH_COMMENT_LANGS.includes(lang) ? /^(def |return\b|import |require |from |if .*:?$|for .*:$|\w+\s*=\s*\S|\w+(\.\w+)*\(.*\)$)/.test(body) : /(;\s*$|^(const|let|var|return|if|for|while|function)\b.*[;{(]|^\w+(\.\w+)*\(.*\);?$|^}\s*$)/.test(body);
    }
  },
  { id: "nestedTernary", severity: "medium", langs: C_LIKE, test: (l) => /\?[^?:]+:[^?;]*\?[^?:]+:/.test(l.code) },
  {
    id: "mutableDefault",
    severity: "medium",
    langs: ["python"],
    test: (l) => /^\s*def \w+\(.*=\s*(\[\]|\{\}|set\(\))/.test(l.code)
  },
  {
    id: "wildcardImport",
    severity: "medium",
    test: (l, lang) => lang === "python" ? /^\s*from \S+ import \*/.test(l.code) : /^\s*import .*\.\*;/.test(l.code)
  },
  { id: "globalKeyword", severity: "medium", langs: ["python", "php"], test: (l) => /^\s*global\s+\$?\w/.test(l.code) },
  { id: "unwrap", severity: "low", langs: ["rust"], test: (l) => /\.unwrap\(\)|\.expect\(/.test(l.code) },
  { id: "ignoredError", severity: "medium", langs: ["go"], test: (l) => /(^|,)\s*_\s*(,\s*\w+\s*)?:?=\s*\w/.test(l.code) },
  {
    id: "rescueNil",
    severity: "high",
    langs: ["ruby"],
    test: (l) => /\brescue\s+nil\b/.test(l.code) || /^\s*rescue\s*(=>\s*\w+)?\s*$/.test(l.code)
  },
  { id: "unsafeC", severity: "high", langs: ["c"], test: (l) => /\b(gets|strcpy|strcat|sprintf|vsprintf)\s*\(/.test(l.code) },
  { id: "gotoStatement", severity: "medium", langs: ["c", "csharp", "php"], test: (l) => /^\s*goto\s+\w+\s*;/.test(l.code) },
  {
    id: "rawInput",
    severity: "high",
    langs: ["php"],
    // Request data dropped straight into output or a query: XSS / SQL injection.
    test: (l) => /\$_(GET|POST|REQUEST|COOKIE)\[/.test(l.code) && /\b(echo|print|mysql_query|mysqli_query|query|exec|system)\b/.test(l.code)
  }
];
function analyze(code, langHint) {
  const lang = langHint && langHint !== "other" ? langHint : detectLang(code);
  const lines = splitLines(code.replace(/\r\n?/g, "\n"), lang);
  const nonBlank = lines.filter((l) => l.raw.trim());
  const commentLines = nonBlank.filter((l) => l.isComment).length;
  const metrics = {
    totalLines: lines.length,
    codeLines: nonBlank.length - commentLines,
    commentLines,
    maxDepth: computeMaxDepth(lines, lang),
    longestLine: Math.max(0, ...lines.map((l) => l.raw.length))
  };
  const findings = [];
  const push = (rule, severity, hitLines, detail, count = hitLines.length) => {
    if (count > 0) findings.push({ rule, severity, count, lines: hitLines.slice(0, MAX_LINES_REPORTED), detail });
  };
  if (metrics.codeLines < 3) {
    push("tooShort", "low", [], void 0, 1);
  }
  for (const rule of LINE_RULES) {
    if (rule.langs && !rule.langs.includes(lang)) continue;
    const hits = [];
    for (const l of lines) {
      if (!rule.useRaw && l.isComment) continue;
      if (rule.test(l, lang)) hits.push(l.n);
    }
    push(rule.id, rule.severity, hits);
  }
  if (metrics.maxDepth >= 5) {
    push("deepNesting", metrics.maxDepth >= 7 ? "high" : "medium", [], String(metrics.maxDepth), 1);
  }
  if (metrics.codeLines > 400) {
    push("hugeFile", metrics.codeLines > 1e3 ? "high" : "medium", [], String(metrics.codeLines), 1);
  }
  const seen = /* @__PURE__ */ new Map();
  for (const l of lines) {
    const t = l.code.trim();
    if (t.length < 25) continue;
    seen.set(t, [...seen.get(t) ?? [], l.n]);
  }
  const dupes = [...seen.values()].filter((ns) => ns.length >= 3);
  if (dupes.length) {
    push("duplicateLines", "medium", dupes.flat().sort((a, b) => a - b), void 0, dupes.length);
  }
  findings.sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || b.count - a.count);
  return { lang, metrics, findings, score: scoreFindings(findings) };
}
function scoreFindings(findings) {
  let penalty = 0;
  for (const f of findings) {
    const w = SEVERITY_WEIGHT[f.severity];
    penalty += Math.min(MAX_PENALTY_PER_RULE, w * (1 + Math.log2(f.count)));
  }
  return Math.max(1, Math.min(10, Math.round(10 - penalty)));
}

// src/lib/roastLite.ts
var T = {
  secret: {
    jokes: [
      "You hardcoded a secret. In the code. That you were about to commit. Bold.",
      "Found {n} credential{s} sitting in plain text like a house key under the doormat with a neon sign.",
      "Congratulations, your API key is now open source."
    ],
    fix: "Move secrets to environment variables or a secret manager, then rotate the leaked one. Today."
  },
  eval: {
    jokes: [
      "`eval` spotted. Remote code execution, but make it a feature.",
      "Using eval is like hiring a stranger off the street to run your production server.",
      "{n} eval{s}. Even JavaScript is embarrassed for you."
    ],
    fix: "Parse data explicitly (JSON.parse, a lookup table, a real parser) instead of executing strings."
  },
  emptyCatch: {
    jokes: [
      "Empty catch block{s} ({n}). The error happened. You chose peace. The bug chose violence.",
      "catch {} is the code equivalent of putting tape over the check-engine light.",
      "You caught {n} exception{s} and then just\u2026 let them die quietly in a ditch."
    ],
    fix: "At minimum log the error with context; better, handle it or let it propagate."
  },
  bareExcept: {
    jokes: [
      "A bare `except:` catches everything, including Ctrl+C and your will to live.",
      '`except: pass` \u2014 Python for "la la la I can\'t hear you".',
      "{n} bare except{s}. Your error handling strategy is denial."
    ],
    fix: "Catch specific exceptions (e.g. `except ValueError as e:`) and log or re-raise."
  },
  debugLog: {
    jokes: [
      '{n} debug print{s} left behind. Your debugger is "print and pray".',
      "So many log statements, your console needs a therapist.",
      "Shipping {n} console log{s} to prod is a cry for help, and the logs are the cries.",
      "Your observability strategy is printing things and squinting.",
      "I see {n} debug print{s}. The logs are just you talking to yourself at this point."
    ],
    fix: "Remove debug output or route it through a real logger with levels."
  },
  debugger: {
    jokes: [
      "A `debugger` statement. In committed code. Somebody's browser is about to freeze mid-demo.",
      "Left a `debugger` in there like a fork in a microwave."
    ],
    fix: "Delete it, then add a lint rule (no-debugger) so it never happens again."
  },
  todo: {
    jokes: [
      "{n} TODO{s}. Your codebase has more unfinished business than a ghost.",
      "TODO count: {n}. Estimated completion date: heat death of the universe.",
      "These TODOs have seen things. They have outlived sprints, managers, and maybe you.",
      "{n} TODO{s}. This file is less code, more a to-do list with syntax highlighting.",
      "A TODO is a promise. You have {n} broken promise{s} in one file."
    ],
    fix: "Turn TODOs into tracked issues, or just do them. They are not decorations."
  },
  varKeyword: {
    jokes: [
      "`var` in the year 2026. Did you find this code in a time capsule?",
      "{n} `var` declaration{s}. Function scoping called from 2009, it wants its bugs back.",
      "Using `var` is a personality, and not a good one."
    ],
    fix: "Use `const` by default and `let` when you must reassign."
  },
  looseEquality: {
    jokes: [
      "{n} loose equality check{s}. Bold of you to trust type coercion with your life.",
      'Using `==` means "0" == 0 == false == []. Sleep well.',
      "`==` is just `===` with commitment issues."
    ],
    fix: "Use `===` and `!==`. Always."
  },
  anyType: {
    jokes: [
      "{n} `any`{s}. You installed TypeScript and then politely asked it to leave.",
      "`any` is not a type, it's a surrender flag.",
      "This is JavaScript wearing a TypeScript costume to a party it wasn't invited to."
    ],
    fix: "Replace `any` with real types, `unknown` + narrowing, or generics."
  },
  suppression: {
    jokes: [
      "{n} lint/type suppression{s}. When the compiler warns you, you mute it. Classic.",
      "Every @ts-ignore is a tiny confession.",
      "You didn't fix the warnings, you just put them in witness protection."
    ],
    fix: "Fix the underlying issue; if suppression is truly needed, add a comment explaining why."
  },
  deepNesting: {
    jokes: [
      "Nesting depth {d}. I needed a rope and a headlamp to get to the bottom of this.",
      "{d} levels deep. This isn't code, it's Inception.",
      "The indentation is so deep it's registered as a geological feature.",
      "Nesting depth {d}. The right margin has filed a missing-persons report.",
      "This code goes so deep, the last `}` has never seen daylight."
    ],
    fix: "Use early returns, guard clauses and extract helper functions to flatten the logic."
  },
  longLines: {
    jokes: [
      "{n} line{s} over 120 characters. Was this written on an ultrawide monitor turned sideways?",
      "Some of these lines need a passport to cross the screen.",
      "{n} line{s} so long they have their own weather at the far end.",
      "Horizontal scrolling is not a lifestyle."
    ],
    fix: "Break long expressions up and let a formatter (Prettier, Black, gofmt) handle the rest."
  },
  hugeFile: {
    jokes: [
      "{d} lines of code in one file. This isn't a module, it's a novel.",
      "This file has its own weather system.",
      "{d} lines. Somewhere a single-responsibility principle is crying."
    ],
    fix: "Split by responsibility into smaller modules with clear names."
  },
  vagueNames: {
    jokes: [
      "{n} variable{s} named like a cat walked across the keyboard. `data`, `temp`, `x`\u2026 poetry.",
      "Naming things is hard, but you didn't even try.",
      "Your variable names are so vague they could be horoscopes.",
      "`data`, `temp`, `x`\u2026 Your variables are in witness protection."
    ],
    fix: "Name variables after what they hold: `userEmails`, not `data`."
  },
  commentedCode: {
    jokes: [
      "{n} line{s} of commented-out code. Git exists. You can let go.",
      "A graveyard of commented-out code. Pour one out.",
      'Keeping dead code "just in case" is how hoarders start.'
    ],
    fix: "Delete it. Version control remembers so you don't have to."
  },
  nestedTernary: {
    jokes: [
      "Nested ternary detected. Reading it requires a whiteboard and a priest.",
      "{n} nested ternar{ies}. Code golf is not a team sport."
    ],
    fix: "Use if/else, a switch, or a lookup object."
  },
  duplicateLines: {
    jokes: [
      "Same lines copy-pasted {n} time{s} over. Ctrl+C, Ctrl+V, Ctrl+Regret.",
      "DRY? This code is soaking wet.",
      "The copy-paste here is so strong it should pay rent.",
      "Same code, {n} location{s}. When one breaks, the rest will follow, like a boy band."
    ],
    fix: "Extract the repeated logic into a function or loop."
  },
  mutableDefault: {
    jokes: [
      "Mutable default argument. Every call shares the same list. Surprise!",
      "`def f(x=[])` \u2014 the gift that keeps on giving, to every caller, forever."
    ],
    fix: "Default to `None` and create the list/dict inside the function."
  },
  wildcardImport: {
    jokes: [
      "Wildcard import: invite everyone to the party and act surprised when names collide.",
      "`import *` \u2014 because who needs to know where anything comes from?"
    ],
    fix: "Import exactly the names you use."
  },
  globalKeyword: {
    jokes: [
      "`global` spotted. Shared mutable state, the root of all 3 a.m. pages.",
      "Using globals is like leaving your toothbrush in a public restroom."
    ],
    fix: "Pass values in and return them out; wrap state in a class if you must."
  },
  unwrap: {
    jokes: [
      '{n} `.unwrap()`{s}. Rust gave you Result and you said "nah, panic is fine".',
      "Unwrapping everything like it's Christmas morning and nothing can go wrong."
    ],
    fix: "Propagate with `?` or handle the error case with `match`/`if let`."
  },
  ignoredError: {
    jokes: [
      "Assigning errors to `_`. Go told you to check errors and you ghosted it.",
      "{n} ignored error{s}. `_` is not error handling, it's a blindfold."
    ],
    fix: 'Handle `err` explicitly: `if err != nil { return fmt.Errorf("context: %w", err) }`.'
  },
  rescueNil: {
    jokes: [
      "`rescue nil`: when something explodes, just pretend it never happened. Very Zen. Very broken.",
      "{n} bare rescue{s}. Your error handling is a trapdoor into silence.",
      "Rescuing everything and returning nil is how bugs get witness protection."
    ],
    fix: "Rescue specific exceptions (e.g. `rescue ActiveRecord::RecordNotFound => e`) and log or re-raise."
  },
  unsafeC: {
    jokes: [
      "`gets`/`strcpy` spotted. This is how buffer overflows get their start in show business.",
      "{n} unbounded string call{s}. Somewhere, an exploit writer just smiled.",
      "Using `sprintf` without bounds is a love letter to the CVE database."
    ],
    fix: "Use bounded versions (`fgets`, `snprintf`, `strncpy`/`strlcpy`) and always pass the buffer size."
  },
  gotoStatement: {
    jokes: [
      "`goto` spotted. Dijkstra is spinning in his grave fast enough to power a data center.",
      "{n} goto{s}. Your control flow is a choose-your-own-adventure book with missing pages."
    ],
    fix: "Restructure with loops, early returns, or a cleanup function."
  },
  rawInput: {
    jokes: [
      "Request input going straight into output or a query. Bobby Tables says hi.",
      "{n} line{s} where user input walks right in unescaped. That's not an API, it's an open door.",
      "Echoing `$_GET` directly: the XSS starter kit, now with free shipping."
    ],
    fix: "Escape output (`htmlspecialchars`) and use prepared statements (PDO/mysqli with bound parameters)."
  },
  tooShort: {
    jokes: [
      "Is this even code? I've seen longer commit messages.",
      "You gave me three lines and expected a roast. That's the roast.",
      "Too short to judge. Like a haiku, but with less meaning."
    ],
    fix: "Paste a real file. I can take it. Can you?"
  }
};
var OPENERS = {
  gentle: [
    "Okay, deep breath. Let's look at this together.",
    "I've seen worse. Not much worse, but worse.",
    "Bless your heart. Here's what I found."
  ],
  savage: [
    "I read your code so you don't have to. You're welcome.",
    "Grab a banana, this is going to hurt.",
    "Your code walked in here like it owned the place. Let's fix that."
  ],
  unhinged: [
    "WHO WROTE THIS. NO, SERIOUSLY. I NEED A NAME.",
    "The ape has seen your code and the ape is SCREAMING.",
    "I have flung better code than this, and I fling things for a living."
  ]
};
var GOOD_OPENERS = [
  "I sharpened my claws for this and\u2026 huh. It's actually fine. Mostly.",
  "Okay, this is better than I expected. Don't get cocky, I still found something.",
  "Respectable. Annoyingly respectable. But I didn't come here for nothing."
];
var CLEAN_LINES = [
  "I came here to roast and found\u2026 clean code? Suspicious. Did you copy this from the docs?",
  "No red flags. I'm not impressed, I'm worried. What are you hiding?",
  "This is annoyingly decent. Go touch grass, you've earned it."
];
function verdictFor(score) {
  if (score <= 2) return { title: "War Crime", emoji: "\u2620\uFE0F" };
  if (score <= 4) return { title: "Dumpster Fire", emoji: "\u{1F525}" };
  if (score <= 6) return { title: "Aggressively Mid", emoji: "\u{1F610}" };
  if (score <= 8) return { title: "Actually Decent", emoji: "\u{1F34C}" };
  return { title: "Suspiciously Clean", emoji: "\u{1F9D0}" };
}
var CLOSERS = {
  low: [
    "Final verdict: delete it and blame the intern.",
    "My recommendation is a small, controlled fire.",
    "This code doesn't need a review, it needs an exorcism."
  ],
  mid: [
    "It runs. That's the nicest thing I can say.",
    'Not a disaster, just a strong case of "works on my machine".',
    "Mid code for a mid world. Fix the receipts above and come back."
  ],
  high: [
    "Fine. FINE. It's good. Don't let it go to your head.",
    "Ship it. I'll pretend I didn't see the small stuff.",
    "Respectable work. The ape grudgingly nods."
  ]
};
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function fill(tpl, f) {
  return tpl.replace(/\{n\}/g, String(f.count)).replace(/\{d\}/g, f.detail ?? String(f.count)).replace(/\{ies\}/g, f.count === 1 ? "y" : "ies").replace(/\{s\}/g, f.count === 1 ? "" : "s");
}
var MAX_ROASTED = { gentle: 4, savage: 6, unhinged: 8 };
function liteRoast(code, analysis, intensity = "savage", seed = 0) {
  const rand = mulberry32(hashString(code) ^ seed);
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const shout = (s) => intensity === "unhinged" ? s.toUpperCase() : s;
  const lines = analysis.findings.slice(0, MAX_ROASTED[intensity]).map((f) => ({
    rule: f.rule,
    joke: shout(fill(pick(T[f.rule].jokes), f)),
    fix: T[f.rule].fix,
    lines: f.lines
  }));
  const score = analysis.score;
  const real = analysis.findings.filter((f) => f.rule !== "tooShort");
  const opener = real.length === 0 && analysis.findings.length === 0 ? pick(CLEAN_LINES) : analysis.score >= 8 ? pick(GOOD_OPENERS) : pick(OPENERS[intensity]);
  const bucket = score <= 4 ? "low" : score <= 7 ? "mid" : "high";
  return {
    opener: shout(opener),
    lines,
    closer: shout(pick(CLOSERS[bucket])),
    verdict: verdictFor(score),
    score
  };
}

// src/lib/repoRoast.ts
var IGNORED_DIR = /(^|\/)(node_modules|vendor|dist|build|out|target|coverage|\.next|third_party|__snapshots__|fixtures?)\//;
var IGNORED_FILE = /\.(min|bundle|generated|pb)\.|\.d\.ts$/;
function isRoastable(path) {
  return langFromPath(path) !== null && !IGNORED_DIR.test(path) && !IGNORED_FILE.test(path);
}
var SEVERITY_RANK = { low: 0, medium: 1, high: 2 };
function analyzeRepo(name, branch, files) {
  const results = files.map((f) => ({
    path: f.path,
    analysis: analyze(f.code, langFromPath(f.path) ?? void 0)
  }));
  const totalLines = results.reduce((n, r) => n + r.analysis.metrics.totalLines, 0);
  const weighted = results.reduce((n, r) => n + r.analysis.score * r.analysis.metrics.totalLines, 0);
  const score = Math.max(1, Math.min(10, Math.round(weighted / Math.max(1, totalLines))));
  const byRule = /* @__PURE__ */ new Map();
  for (const r of results) {
    for (const f of r.analysis.findings) {
      if (f.rule === "tooShort") continue;
      const cur = byRule.get(f.rule);
      if (!cur) {
        byRule.set(f.rule, { ...f, lines: [], files: 1 });
      } else {
        cur.count += f.count;
        cur.files += 1;
        if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[cur.severity]) cur.severity = f.severity;
        if (f.rule === "deepNesting" && Number(f.detail) > Number(cur.detail)) cur.detail = f.detail;
        if (f.rule === "hugeFile" && Number(f.detail) > Number(cur.detail)) cur.detail = f.detail;
      }
    }
  }
  const findings = [...byRule.values()].map(({ files: _files, ...f }) => f).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.count - a.count);
  const sorted = [...results].sort(
    (a, b) => a.analysis.score - b.analysis.score || b.analysis.findings.length - a.analysis.findings.length
  );
  const langs = [...new Set(results.map((r) => r.analysis.lang))];
  return {
    name,
    ref: branch,
    files: sorted,
    totalLines,
    score,
    langs,
    aggregate: {
      lang: langs[0] ?? "other",
      metrics: {
        totalLines,
        codeLines: results.reduce((n, r) => n + r.analysis.metrics.codeLines, 0),
        commentLines: results.reduce((n, r) => n + r.analysis.metrics.commentLines, 0),
        maxDepth: Math.max(0, ...results.map((r) => r.analysis.metrics.maxDepth)),
        longestLine: Math.max(0, ...results.map((r) => r.analysis.metrics.longestLine))
      },
      findings,
      score
    }
  };
}
function repoRoast(r, intensity, seed = 0) {
  const base = liteRoast(r.name, r.aggregate, intensity, seed);
  const worst = r.files[0];
  const best = r.files[r.files.length - 1];
  const shout = (s) => intensity === "unhinged" ? s.toUpperCase() : s;
  const crimeScene = r.files.length > 1 && worst.analysis.score < best.analysis.score ? `The crime scene is \`${worst.path}\` at ${worst.analysis.score}/10. Your best file, \`${best.path}\`, scored ${best.analysis.score}/10, so you clearly know better.` : `I read ${r.files.length} file${r.files.length === 1 ? "" : "s"} and they're all equally guilty.`;
  return { ...base, crimeScene: shout(crimeScene) };
}

// src/lib/share.ts
var MAX_LINES = 8;
var MAX_LINE_LEN = 280;
function toBase64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function encodeShare(p) {
  const payload = {
    v: 1,
    s: p.s,
    t: p.t,
    l: p.l,
    n: p.n,
    r: p.r.slice(0, MAX_LINES).map((x) => x.slice(0, MAX_LINE_LEN))
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}
function shareUrl(base, encoded) {
  return `${base}/r/${encoded}`;
}

// action/src/comment.ts
var MARKER = "<!-- coderoast:pr-comment -->";
var MAX_CRIME_ROWS = 8;
var MAX_LOCATIONS = 4;
function bar(score) {
  return "\u2588".repeat(score) + "\u2591".repeat(10 - score);
}
function blob(ctx, path, line) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${ctx.repo}/blob/${ctx.sha}/${encoded}${line ? `#L${line}` : ""}`;
}
function locations(r, rule, ctx) {
  const out = [];
  for (const f of r.files) {
    const finding = f.analysis.findings.find((x) => x.rule === rule);
    if (!finding) continue;
    const touched = ctx.changed.get(f.path) ?? /* @__PURE__ */ new Set();
    if (finding.lines.length === 0) out.push({ path: f.path, inPr: false });
    for (const line of finding.lines) out.push({ path: f.path, line, inPr: touched.has(line) });
  }
  return out.sort((a, b) => Number(b.inPr) - Number(a.inPr)).slice(0, MAX_LOCATIONS);
}
function buildComment(r, roast, ctx) {
  const v = verdictFor(r.score);
  const out = [MARKER];
  out.push(`## \u{1F525}\u{1F435} CodeRoast: ${r.score}/10, ${v.emoji} ${v.title}`);
  out.push(
    `\`${bar(r.score)}\` **${r.score}/10** \xB7 ${r.files.length} changed file${r.files.length === 1 ? "" : "s"} \xB7 ${r.totalLines.toLocaleString("en-US")} lines`
  );
  out.push("", `> ${roast.opener}`);
  if (r.files.length > 1) {
    out.push("", "<details open><summary><b>Crime scene</b></summary>", "", "| Score | File | Issues |", "|---:|---|---:|");
    for (const f of r.files.slice(0, MAX_CRIME_ROWS)) {
      const issues = f.analysis.findings.filter((x) => x.rule !== "tooShort").length;
      out.push(`| ${f.analysis.score}/10 | [\`${f.path}\`](${blob(ctx, f.path)}) | ${issues} |`);
    }
    if (r.files.length > MAX_CRIME_ROWS) out.push(`| | \u2026and ${r.files.length - MAX_CRIME_ROWS} more | |`);
    out.push("", "</details>");
  }
  if (roast.lines.length) {
    out.push("", "### Receipts");
    for (const l of roast.lines) {
      const locs = locations(r, l.rule, ctx).map((loc) => `[\`${loc.path}${loc.line ? `:${loc.line}` : ""}\`](${blob(ctx, loc.path, loc.line)})${loc.inPr ? " \u{1F195}" : ""}`).join(", ");
      out.push(`- ${l.joke}${locs ? `<br>${locs}` : ""}`, `  - \u{1FA79} **Fix:** ${l.fix}`);
    }
    out.push("", "<sub>\u{1F195} = a line this PR added or changed.</sub>");
  } else {
    out.push("", "No receipts. Suspiciously clean. \u{1F9D0}");
  }
  out.push("", `**${roast.closer}**`, "");
  const links = [
    ctx.shareUrl ? `[Share this roast](${ctx.shareUrl})` : null,
    `[Roast your own code](${ctx.site})`,
    `[What is this?](https://github.com/StormDoragon/CodeRoast#coderoast-for-pull-requests)`
  ].filter(Boolean);
  out.push(`<sub>${links.join(" \xB7 ")}. Scores are heuristics, roasts are jokes about code, never people.</sub>`);
  return out.join("\n");
}

// action/src/diff.ts
function changedLines(patch) {
  const lines = /* @__PURE__ */ new Set();
  if (!patch) return lines;
  let n = 0;
  for (const row of patch.split("\n")) {
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      n = Number(hunk[1]);
      continue;
    }
    if (row.startsWith("+")) lines.add(n++);
    else if (row.startsWith("-")) continue;
    else n++;
  }
  return lines;
}

// action/src/run.ts
var API = "https://api.github.com";
var INTENSITIES = ["gentle", "savage", "unhinged"];
var MAX_FILE_BYTES = 15e4;
function input(env, name, fallback = "") {
  return (env.get(`INPUT_${name.toUpperCase()}`) ?? "").trim() || fallback;
}
var MAX_COMMENT_PAGES = 30;
async function findOwnComment(gh, repo, number) {
  for (let page = 1; page <= MAX_COMMENT_PAGES; page++) {
    const batch = await (await gh(`/repos/${repo}/issues/${number}/comments?per_page=100&page=${page}`)).json();
    const hit = batch.find((c) => c.body?.includes(MARKER));
    if (hit || batch.length < 100) return hit;
  }
  return void 0;
}
async function run(env, io, fetchImpl = fetch) {
  const token = input(env, "github-token");
  const intensityRaw = input(env, "intensity", "savage");
  const intensity = INTENSITIES.includes(intensityRaw) ? intensityRaw : "savage";
  const failBelow = Number(input(env, "fail-below", "0")) || 0;
  const maxFiles = Math.max(1, Math.min(100, Number(input(env, "max-files", "30")) || 30));
  const site = input(env, "site-url", "https://code-roast-five.vercel.app").replace(/\/$/, "");
  const shouldComment = input(env, "comment", "true") !== "false";
  const eventPath = env.get("GITHUB_EVENT_PATH");
  const event = eventPath ? JSON.parse(io.readFile(eventPath)) : {};
  const pr = event.pull_request;
  if (!pr) {
    return { score: null, failed: false, message: "Not a pull_request event; nothing to roast." };
  }
  const baseRepo = env.get("GITHUB_REPOSITORY") ?? event.repository?.full_name;
  const sha = pr.head.sha;
  const number = pr.number;
  const gh = async (path, init = {}) => {
    const res = await fetchImpl(path.startsWith("http") ? path : `${API}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "coderoast-action",
        ...token ? { Authorization: `Bearer ${token}` } : {},
        ...init.headers ?? {}
      }
    });
    if (!res.ok) throw new Error(`GitHub API ${init.method ?? "GET"} ${path} \u2192 ${res.status}`);
    return res;
  };
  const prFiles = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await (await gh(`/repos/${baseRepo}/pulls/${number}/files?per_page=100&page=${page}`)).json();
    prFiles.push(...batch);
    if (batch.length < 100) break;
  }
  const candidates = prFiles.filter((f) => f.status !== "removed" && isRoastable(f.filename)).sort((a, b) => b.changes - a.changes).slice(0, maxFiles);
  if (candidates.length === 0) {
    io.log("No supported source files changed (JS/TS/Python/Go/Rust/Java/C#/PHP/Ruby/C/C++; built, vendored and minified files are skipped).");
    return { score: null, failed: false, message: "No supported source files changed." };
  }
  const files = [];
  for (const f of candidates) {
    const path = f.filename.split("/").map(encodeURIComponent).join("/");
    try {
      const res = await gh(`/repos/${baseRepo}/contents/${path}?ref=${sha}`, {
        headers: { Accept: "application/vnd.github.raw" }
      });
      const code = await res.text();
      if (code.length <= MAX_FILE_BYTES) files.push({ path: f.filename, code });
    } catch (err) {
      io.log(`Skipping ${f.filename}: ${err.message}`);
    }
  }
  if (files.length === 0) {
    return { score: null, failed: false, message: "Could not read any changed files." };
  }
  const analysis = analyzeRepo(`${baseRepo}#${number}`, sha, files);
  const roast = repoRoast(analysis, intensity, number);
  const v = verdictFor(analysis.score);
  const encoded = encodeShare({
    s: analysis.score,
    t: v.title,
    l: `${baseRepo}#${number}`,
    n: analysis.totalLines,
    r: [roast.crimeScene, ...roast.lines.map((l) => l.joke), roast.closer]
  });
  const body = buildComment(analysis, roast, {
    repo: baseRepo,
    sha,
    site,
    shareUrl: shareUrl(site, encoded),
    changed: new Map(prFiles.map((f) => [f.filename, changedLines(f.patch)]))
  });
  const summary = env.get("GITHUB_STEP_SUMMARY");
  if (summary) io.appendFile(summary, `${body}
`);
  const output = env.get("GITHUB_OUTPUT");
  if (output) io.appendFile(output, `score=${analysis.score}
verdict=${v.title}
`);
  if (shouldComment) {
    try {
      const existing = await findOwnComment(gh, baseRepo, number);
      await gh(
        existing ? `/repos/${baseRepo}/issues/comments/${existing.id}` : `/repos/${baseRepo}/issues/${number}/comments`,
        { method: existing ? "PATCH" : "POST", body: JSON.stringify({ body }), headers: { "Content-Type": "application/json" } }
      );
      io.log(existing ? "Updated the CodeRoast comment." : "Posted a CodeRoast comment.");
    } catch (err) {
      io.log(`Could not comment on the PR (${err.message}). The roast is in the job summary.`);
    }
  }
  const failed = failBelow > 0 && analysis.score < failBelow;
  const message = `Banana Score ${analysis.score}/10 (${v.title})${failed ? `, below the fail-below threshold of ${failBelow}` : ""}.`;
  return { score: analysis.score, failed, message };
}

// action/src/index.ts
run(
  { get: (name) => process.env[name] },
  {
    readFile: (p) => (0, import_node_fs.readFileSync)(p, "utf8"),
    appendFile: (p, d) => (0, import_node_fs.appendFileSync)(p, d),
    log: (m) => console.log(m)
  }
).then((r) => {
  console.log(r.message);
  if (r.failed) {
    console.log(`::error title=CodeRoast::${r.message}`);
    process.exitCode = 1;
  }
}).catch((err) => {
  console.log(`::error title=CodeRoast::${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
