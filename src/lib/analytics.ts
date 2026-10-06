import { inject, track as vercelTrack } from '@vercel/analytics';

// Event names are the funnel we optimise for: roast → share → share_open → roast.
export type EventName = 'roast' | 'roast_again' | 'example' | 'github_load' | 'share' | 'share_open' | 'share_cta' | 'repo_roast' | 'pr_action_cta' | 'pro_waitlist_cta' | 'bad_roast' | 'battle';

let enabled = false;

export function initAnalytics() {
  if (!import.meta.env.PROD) return;
  enabled = true;
  inject({
    mode: 'production',
    // Share links carry the roast in the URL hash; never send it.
    beforeSend: (event) => ({ ...event, url: event.url.split('#')[0] }),
  });
}

export function track(name: EventName, props?: Record<string, string | number | boolean>) {
  if (!enabled) return;
  try {
    vercelTrack(name, props);
  } catch {
    // Analytics must never break the app.
  }
}

export function scoreBucket(score: number) {
  return score <= 2 ? '1-2' : score <= 4 ? '3-4' : score <= 6 ? '5-6' : score <= 8 ? '7-8' : '9-10';
}
