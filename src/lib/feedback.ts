// "Bad roast?" links open a prefilled GitHub issue. Only rule names, line
// numbers and the score are included, never the user's code.

import type { Analysis } from './analyzer';

export function badRoastUrl(repoUrl: string, analysis: Analysis, context: string) {
  const findings = analysis.findings
    .map((f) => `- \`${f.rule}\` ×${f.count}${f.lines.length ? ` (lines ${f.lines.join(', ')})` : ''}`)
    .join('\n');
  const body = [
    `**What was wrong with the roast?**`,
    `<!-- e.g. "line 12 is not a secret", "missed an obvious eval", "joke was mean, not funny" -->`,
    ``,
    `**Minimal snippet (optional, only if you're happy to share it publicly)**`,
    '```' + analysis.lang,
    '',
    '```',
    ``,
    `---`,
    `Context: ${context} · language \`${analysis.lang}\` · score ${analysis.score}/10 · ${analysis.metrics.totalLines} lines`,
    `Findings:`,
    findings || '- none',
  ].join('\n');
  const params = new URLSearchParams({ title: `Bad roast: ${analysis.lang}, ${analysis.score}/10`, body, labels: 'bad-roast' });
  return `${repoUrl}/issues/new?${params.toString()}`;
}
