// Parses a unified-diff patch (as returned by the GitHub PR files API) into
// the set of line numbers added or modified in the new version of the file.
export function changedLines(patch: string | undefined): Set<number> {
  const lines = new Set<number>();
  if (!patch) return lines;
  let n = 0;
  for (const row of patch.split('\n')) {
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      n = Number(hunk[1]);
      continue;
    }
    if (row.startsWith('+')) lines.add(n++);
    else if (row.startsWith('-')) continue;
    else n++;
  }
  return lines;
}
