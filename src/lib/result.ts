// The roast currently on screen, and how it becomes a share link + card.

import type { Analysis } from './analyzer';
import type { BattleResult } from './battle';
import type { CardData, BattleCardData } from './card';
import type { RepoAnalysis, RepoRoast } from './repoRoast';
import { verdictFor, type LiteRoast } from './roastLite';
import { encodeBattle, encodeShare, shareUrl } from './share';
import { langLabel } from './ui';

export type Result =
  | { kind: 'lite'; analysis: Analysis; roast: LiteRoast }
  | { kind: 'ai'; analysis: Analysis; text: string; streaming: boolean }
  | { kind: 'repo'; analysis: Analysis; repo: RepoAnalysis; roast: RepoRoast };

export interface ShareBundle {
  url: string;
  tweet: string;
  card: CardData | BattleCardData;
}

// Splits an AI roast into short shareable lines.
export function aiShareLines(text: string) {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*([-*•]|\d+\.)\s*/, '').trim())
    .filter((l) => l && !/^(fix:|↳|banana score)/i.test(l))
    .slice(0, 6);
}

export function shareForResult(result: Result | null, site: string): ShareBundle | null {
  if (!result || (result.kind === 'ai' && result.streaming)) return null;
  const score = result.analysis.score;
  const v = verdictFor(score);
  const lines =
    result.kind === 'ai'
      ? aiShareLines(result.text)
      : [
          ...(result.kind === 'repo' ? [result.roast.crimeScene] : []),
          ...result.roast.lines.map((l) => l.joke),
          result.roast.closer,
        ];
  const label = result.kind === 'repo' ? result.repo.name : langLabel(result.analysis.lang);
  const encoded = encodeShare({ s: score, t: v.title, l: label, n: result.analysis.metrics.totalLines, r: lines });
  return {
    url: shareUrl(site, encoded),
    tweet:
      result.kind === 'repo'
        ? `My repo ${label} just got roasted 🔥🐵 Banana Score: ${score}/10 — "${v.title}". Roast yours:`
        : `My ${label} code just got roasted 🔥🐵 Banana Score: ${score}/10 — "${v.title}". Think yours is better?`,
    card: { kind: 'roast', score, title: v.title, emoji: v.emoji, lang: label, lines, site },
  };
}

export function shareForBattle(b: BattleResult, site: string): ShareBundle {
  const side = (s: BattleResult['a']) => ({
    m: s.name,
    s: s.analysis.score,
    t: verdictFor(s.analysis.score).title,
    l: langLabel(s.analysis.lang),
    n: s.analysis.metrics.totalLines,
    r: s.roast.lines.slice(0, 3).map((l) => l.joke),
  });
  const a = side(b.a);
  const bb = side(b.b);
  const encoded = encodeBattle({ a, b: bb, h: b.headline });
  return {
    url: shareUrl(site, encoded),
    tweet: `⚔️ CodeRoast battle: ${a.m} (${a.s}/10) vs ${bb.m} (${bb.s}/10). ${b.headline}`,
    card: { kind: 'battle', a, b: bb, headline: b.headline, site },
  };
}
