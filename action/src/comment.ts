import type { RepoAnalysis, RepoRoast } from '../../src/lib/repoRoast';
import type { RuleId } from '../../src/lib/analyzer';
import { verdictFor } from '../../src/lib/roastLite';

export const MARKER = '<!-- coderoast:pr-comment -->';

export interface CommentContext {
  repo: string; // owner/name of the head repo (for blob links)
  sha: string;
  site: string;
  shareUrl?: string;
  changed: Map<string, Set<number>>; // path -> changed line numbers
}

const MAX_CRIME_ROWS = 8;
const MAX_LOCATIONS = 4;

function bar(score: number) {
  return '█'.repeat(score) + '░'.repeat(10 - score);
}

function blob(ctx: CommentContext, path: string, line?: number) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${ctx.repo}/blob/${ctx.sha}/${encoded}${line ? `#L${line}` : ''}`;
}

// Where a rule fired, preferring lines this PR touched.
function locations(r: RepoAnalysis, rule: RuleId, ctx: CommentContext) {
  const out: { path: string; line?: number; inPr: boolean }[] = [];
  for (const f of r.files) {
    const finding = f.analysis.findings.find((x) => x.rule === rule);
    if (!finding) continue;
    const touched = ctx.changed.get(f.path) ?? new Set<number>();
    if (finding.lines.length === 0) out.push({ path: f.path, inPr: false });
    for (const line of finding.lines) out.push({ path: f.path, line, inPr: touched.has(line) });
  }
  return out.sort((a, b) => Number(b.inPr) - Number(a.inPr)).slice(0, MAX_LOCATIONS);
}

export function buildComment(r: RepoAnalysis, roast: RepoRoast, ctx: CommentContext): string {
  const v = verdictFor(r.score);
  const out: string[] = [MARKER];
  out.push(`## 🔥🐵 CodeRoast: ${r.score}/10, ${v.emoji} ${v.title}`);
  out.push(
    `\`${bar(r.score)}\` **${r.score}/10** · ${r.files.length} changed file${r.files.length === 1 ? '' : 's'} · ${r.totalLines.toLocaleString('en-US')} lines`,
  );
  out.push('', `> ${roast.opener}`);

  if (r.files.length > 1) {
    out.push('', '<details open><summary><b>Crime scene</b></summary>', '', '| Score | File | Issues |', '|---:|---|---:|');
    for (const f of r.files.slice(0, MAX_CRIME_ROWS)) {
      const issues = f.analysis.findings.filter((x) => x.rule !== 'tooShort').length;
      out.push(`| ${f.analysis.score}/10 | [\`${f.path}\`](${blob(ctx, f.path)}) | ${issues} |`);
    }
    if (r.files.length > MAX_CRIME_ROWS) out.push(`| | …and ${r.files.length - MAX_CRIME_ROWS} more | |`);
    out.push('', '</details>');
  }

  if (roast.lines.length) {
    out.push('', '### Receipts');
    for (const l of roast.lines) {
      const locs = locations(r, l.rule, ctx)
        .map((loc) => `[\`${loc.path}${loc.line ? `:${loc.line}` : ''}\`](${blob(ctx, loc.path, loc.line)})${loc.inPr ? ' 🆕' : ''}`)
        .join(', ');
      out.push(`- ${l.joke}${locs ? `<br>${locs}` : ''}`, `  - 🩹 **Fix:** ${l.fix}`);
    }
    out.push('', '<sub>🆕 = a line this PR added or changed.</sub>');
  } else {
    out.push('', 'No receipts. Suspiciously clean. 🧐');
  }

  out.push('', `**${roast.closer}**`, '');
  const links = [
    ctx.shareUrl ? `[Share this roast](${ctx.shareUrl})` : null,
    `[Roast your own code](${ctx.site})`,
    `[What is this?](https://github.com/StormDoragon/CodeRoast#coderoast-for-pull-requests)`,
  ].filter(Boolean);
  out.push(`<sub>${links.join(' · ')}. Scores are heuristics, roasts are jokes about code, never people.</sub>`);
  return out.join('\n');
}
