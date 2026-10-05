// Instant roast generator: turns analyzer findings into jokes + fixes.
// Deterministic for a given (code, seed) so a shared roast is reproducible,
// and "Roast again" just bumps the seed.

import type { Analysis, Finding, RuleId } from './analyzer';

export type Intensity = 'gentle' | 'savage' | 'unhinged';

export interface Verdict {
  title: string;
  emoji: string;
}

export interface RoastLine {
  rule: RuleId;
  joke: string;
  fix: string;
  lines: number[];
}

export interface LiteRoast {
  opener: string;
  lines: RoastLine[];
  closer: string;
  verdict: Verdict;
  score: number;
}

interface Template {
  jokes: string[]; // {n} = count, {d} = detail, {s} = plural "s"
  fix: string;
}

const T: Record<RuleId, Template> = {
  secret: {
    jokes: [
      'You hardcoded a secret. In the code. That you were about to commit. Bold.',
      'Found {n} credential{s} sitting in plain text like a house key under the doormat with a neon sign.',
      'Congratulations, your API key is now open source.',
    ],
    fix: 'Move secrets to environment variables or a secret manager, then rotate the leaked one. Today.',
  },
  eval: {
    jokes: [
      '`eval` spotted. Remote code execution, but make it a feature.',
      'Using eval is like hiring a stranger off the street to run your production server.',
      '{n} eval{s}. Even JavaScript is embarrassed for you.',
    ],
    fix: 'Parse data explicitly (JSON.parse, a lookup table, a real parser) instead of executing strings.',
  },
  emptyCatch: {
    jokes: [
      'Empty catch block{s} ({n}). The error happened. You chose peace. The bug chose violence.',
      'catch {} is the code equivalent of putting tape over the check-engine light.',
      'You caught {n} exception{s} and then just… let them die quietly in a ditch.',
    ],
    fix: 'At minimum log the error with context; better, handle it or let it propagate.',
  },
  bareExcept: {
    jokes: [
      'A bare `except:` catches everything, including Ctrl+C and your will to live.',
      '`except: pass` — Python for "la la la I can\'t hear you".',
      '{n} bare except{s}. Your error handling strategy is denial.',
    ],
    fix: 'Catch specific exceptions (e.g. `except ValueError as e:`) and log or re-raise.',
  },
  debugLog: {
    jokes: [
      '{n} debug print{s} left behind. Your debugger is "print and pray".',
      'So many log statements, your console needs a therapist.',
      'Shipping {n} console log{s} to prod is a cry for help, and the logs are the cries.',
    ],
    fix: 'Remove debug output or route it through a real logger with levels.',
  },
  debugger: {
    jokes: [
      'A `debugger` statement. In committed code. Somebody\'s browser is about to freeze mid-demo.',
      'Left a `debugger` in there like a fork in a microwave.',
    ],
    fix: 'Delete it, then add a lint rule (no-debugger) so it never happens again.',
  },
  todo: {
    jokes: [
      '{n} TODO{s}. Your codebase has more unfinished business than a ghost.',
      'TODO count: {n}. Estimated completion date: heat death of the universe.',
      'These TODOs have seen things. They have outlived sprints, managers, and maybe you.',
    ],
    fix: 'Turn TODOs into tracked issues, or just do them. They are not decorations.',
  },
  varKeyword: {
    jokes: [
      '`var` in the year 2026. Did you find this code in a time capsule?',
      '{n} `var` declaration{s}. Function scoping called from 2009, it wants its bugs back.',
      'Using `var` is a personality, and not a good one.',
    ],
    fix: 'Use `const` by default and `let` when you must reassign.',
  },
  looseEquality: {
    jokes: [
      '{n} loose equality check{s}. Bold of you to trust JavaScript type coercion.',
      'Using `==` means "0" == 0 == false == []. Sleep well.',
      '`==` is just `===` with commitment issues.',
    ],
    fix: 'Use `===` and `!==`. Always.',
  },
  anyType: {
    jokes: [
      '{n} `any`{s}. You installed TypeScript and then politely asked it to leave.',
      '`any` is not a type, it\'s a surrender flag.',
      'This is JavaScript wearing a TypeScript costume to a party it wasn\'t invited to.',
    ],
    fix: 'Replace `any` with real types, `unknown` + narrowing, or generics.',
  },
  suppression: {
    jokes: [
      '{n} lint/type suppression{s}. When the compiler warns you, you mute it. Classic.',
      'Every @ts-ignore is a tiny confession.',
      'You didn\'t fix the warnings, you just put them in witness protection.',
    ],
    fix: 'Fix the underlying issue; if suppression is truly needed, add a comment explaining why.',
  },
  deepNesting: {
    jokes: [
      'Nesting depth {d}. I needed a rope and a headlamp to get to the bottom of this.',
      '{d} levels deep. This isn\'t code, it\'s Inception.',
      'The indentation is so deep it\'s registered as a geological feature.',
    ],
    fix: 'Use early returns, guard clauses and extract helper functions to flatten the logic.',
  },
  longLines: {
    jokes: [
      '{n} line{s} over 120 characters. Was this written on an ultrawide monitor turned sideways?',
      'Some of these lines need a passport to cross the screen.',
      'Horizontal scrolling is not a lifestyle.',
    ],
    fix: 'Break long expressions up and let a formatter (Prettier, Black, gofmt) handle the rest.',
  },
  hugeFile: {
    jokes: [
      '{d} lines of code in one file. This isn\'t a module, it\'s a novel.',
      'This file has its own weather system.',
      '{d} lines. Somewhere a single-responsibility principle is crying.',
    ],
    fix: 'Split by responsibility into smaller modules with clear names.',
  },
  vagueNames: {
    jokes: [
      '{n} variable{s} named like a cat walked across the keyboard. `data`, `temp`, `x`… poetry.',
      'Naming things is hard, but you didn\'t even try.',
      'Your variable names are so vague they could be horoscopes.',
    ],
    fix: 'Name variables after what they hold: `userEmails`, not `data`.',
  },
  commentedCode: {
    jokes: [
      '{n} line{s} of commented-out code. Git exists. You can let go.',
      'A graveyard of commented-out code. Pour one out.',
      'Keeping dead code "just in case" is how hoarders start.',
    ],
    fix: 'Delete it. Version control remembers so you don\'t have to.',
  },
  nestedTernary: {
    jokes: [
      'Nested ternary detected. Reading it requires a whiteboard and a priest.',
      '{n} nested ternar{ies}. Code golf is not a team sport.',
    ],
    fix: 'Use if/else, a switch, or a lookup object.',
  },
  duplicateLines: {
    jokes: [
      'Same lines copy-pasted {n} time{s} over. Ctrl+C, Ctrl+V, Ctrl+Regret.',
      'DRY? This code is soaking wet.',
      'The copy-paste here is so strong it should pay rent.',
    ],
    fix: 'Extract the repeated logic into a function or loop.',
  },
  mutableDefault: {
    jokes: [
      'Mutable default argument. Every call shares the same list. Surprise!',
      '`def f(x=[])` — the gift that keeps on giving, to every caller, forever.',
    ],
    fix: 'Default to `None` and create the list/dict inside the function.',
  },
  wildcardImport: {
    jokes: [
      'Wildcard import: invite everyone to the party and act surprised when names collide.',
      '`import *` — because who needs to know where anything comes from?',
    ],
    fix: 'Import exactly the names you use.',
  },
  globalKeyword: {
    jokes: [
      '`global` spotted. Shared mutable state, the root of all 3 a.m. pages.',
      'Using globals is like leaving your toothbrush in a public restroom.',
    ],
    fix: 'Pass values in and return them out; wrap state in a class if you must.',
  },
  unwrap: {
    jokes: [
      '{n} `.unwrap()`{s}. Rust gave you Result and you said "nah, panic is fine".',
      'Unwrapping everything like it\'s Christmas morning and nothing can go wrong.',
    ],
    fix: 'Propagate with `?` or handle the error case with `match`/`if let`.',
  },
  ignoredError: {
    jokes: [
      'Assigning errors to `_`. Go told you to check errors and you ghosted it.',
      '{n} ignored error{s}. `_` is not error handling, it\'s a blindfold.',
    ],
    fix: 'Handle `err` explicitly: `if err != nil { return fmt.Errorf("context: %w", err) }`.',
  },
  tooShort: {
    jokes: [
      'Is this even code? I\'ve seen longer commit messages.',
      'You gave me three lines and expected a roast. That\'s the roast.',
      'Too short to judge. Like a haiku, but with less meaning.',
    ],
    fix: 'Paste a real file. I can take it. Can you?',
  },
};

const OPENERS: Record<Intensity, string[]> = {
  gentle: [
    'Okay, deep breath. Let\'s look at this together.',
    'I\'ve seen worse. Not much worse, but worse.',
    'Bless your heart. Here\'s what I found.',
  ],
  savage: [
    'I read your code so you don\'t have to. You\'re welcome.',
    'Grab a banana, this is going to hurt.',
    'Your code walked in here like it owned the place. Let\'s fix that.',
  ],
  unhinged: [
    'WHO WROTE THIS. NO, SERIOUSLY. I NEED A NAME.',
    'The ape has seen your code and the ape is SCREAMING.',
    'I have flung better code than this, and I fling things for a living.',
  ],
};

const CLEAN_LINES = [
  'I came here to roast and found… clean code? Suspicious. Did you copy this from the docs?',
  'No red flags. I\'m not impressed, I\'m worried. What are you hiding?',
  'This is annoyingly decent. Go touch grass, you\'ve earned it.',
];

export function verdictFor(score: number): Verdict {
  if (score <= 2) return { title: 'War Crime', emoji: '☠️' };
  if (score <= 4) return { title: 'Dumpster Fire', emoji: '🔥' };
  if (score <= 6) return { title: 'Aggressively Mid', emoji: '😐' };
  if (score <= 8) return { title: 'Actually Decent', emoji: '🍌' };
  return { title: 'Suspiciously Clean', emoji: '🧐' };
}

const CLOSERS: Record<string, string[]> = {
  low: [
    'Final verdict: delete it and blame the intern.',
    'My recommendation is a small, controlled fire.',
    'This code doesn\'t need a review, it needs an exorcism.',
  ],
  mid: [
    'It runs. That\'s the nicest thing I can say.',
    'Not a disaster, just a strong case of "works on my machine".',
    'Mid code for a mid world. Fix the receipts above and come back.',
  ],
  high: [
    'Fine. FINE. It\'s good. Don\'t let it go to your head.',
    'Ship it. I\'ll pretend I didn\'t see the small stuff.',
    'Respectable work. The ape grudgingly nods.',
  ],
};

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fill(tpl: string, f: Finding) {
  return tpl
    .replace(/\{n\}/g, String(f.count))
    .replace(/\{d\}/g, f.detail ?? String(f.count))
    .replace(/\{ies\}/g, f.count === 1 ? 'y' : 'ies')
    .replace(/\{s\}/g, f.count === 1 ? '' : 's');
}

const MAX_ROASTED: Record<Intensity, number> = { gentle: 4, savage: 6, unhinged: 8 };

export function liteRoast(code: string, analysis: Analysis, intensity: Intensity = 'savage', seed = 0): LiteRoast {
  const rand = mulberry32(hashString(code) ^ seed);
  const pick = <X,>(xs: X[]) => xs[Math.floor(rand() * xs.length)];
  const shout = (s: string) => (intensity === 'unhinged' ? s.toUpperCase() : s);

  const lines: RoastLine[] = analysis.findings.slice(0, MAX_ROASTED[intensity]).map((f) => ({
    rule: f.rule,
    joke: shout(fill(pick(T[f.rule].jokes), f)),
    fix: T[f.rule].fix,
    lines: f.lines,
  }));

  const score = analysis.score;
  const real = analysis.findings.filter((f) => f.rule !== 'tooShort');
  const opener = real.length === 0 && analysis.findings.length === 0 ? pick(CLEAN_LINES) : pick(OPENERS[intensity]);
  const bucket = score <= 4 ? 'low' : score <= 7 ? 'mid' : 'high';

  return {
    opener: shout(opener),
    lines,
    closer: shout(pick(CLOSERS[bucket])),
    verdict: verdictFor(score),
    score,
  };
}

export function liteRoastToText(r: LiteRoast, withFixes = true): string {
  const body = r.lines
    .map((l) => {
      const where = l.lines.length ? ` (line${l.lines.length > 1 ? 's' : ''} ${l.lines.join(', ')})` : '';
      return `• ${l.joke}${where}${withFixes ? `\n  ↳ Fix: ${l.fix}` : ''}`;
    })
    .join('\n');
  return [r.opener, body, r.closer, `Banana Score: ${r.score}/10 (${r.verdict.title})`].filter(Boolean).join('\n\n');
}
