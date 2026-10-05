const MAX_BYTES = 200_000;

// Accepts github.com blob URLs, raw.githubusercontent.com URLs and gist raw URLs.
export function toRawUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.hostname === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    // /owner/repo/blob/ref/path...
    if (parts.length >= 5 && parts[2] === 'blob') {
      return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts.slice(3).join('/')}`;
    }
    throw new Error('Paste a link to a single file (…/blob/branch/path/to/file).');
  }
  if (url.hostname === 'raw.githubusercontent.com' || url.hostname === 'gist.githubusercontent.com') {
    return url.href;
  }
  throw new Error('Only GitHub file URLs are supported.');
}

export async function fetchGitHubSource(input: string): Promise<{ code: string; path: string }> {
  const raw = toRawUrl(input);
  const res = await fetch(raw);
  if (!res.ok) throw new Error(res.status === 404 ? 'File not found (is the repo private?)' : `GitHub returned ${res.status}`);
  const text = await res.text();
  return { code: text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text, path: new URL(raw).pathname };
}
