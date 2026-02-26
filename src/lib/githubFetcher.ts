export async function fetchGitHubSource(url: string): Promise<string> {
  // convert blob link to raw if necessary
  try {
    let rawUrl = url;
    if (url.includes('github.com/') && !url.includes('raw.githubusercontent.com')) {
      rawUrl = url
        .replace('github.com/', 'raw.githubusercontent.com/')
        .replace('/blob/', '/');
    }
    const res = await fetch(rawUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${rawUrl}: ${res.status}`);
    }
    return await res.text();
  } catch (err) {
    console.error('githubFetcher error', err);
    throw err;
  }
}
