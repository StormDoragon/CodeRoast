// Deployment-specific settings. Override with VITE_* env vars at build time.
export const SITE_URL: string =
  import.meta.env.VITE_SITE_URL ||
  (typeof window !== 'undefined' ? new URL(import.meta.env.BASE_URL, window.location.href).href.replace(/\/$/, '') : '');

// Optional monetization links; buttons are hidden when unset.
export const SPONSOR_URL: string = import.meta.env.VITE_SPONSOR_URL || '';
export const PRO_WAITLIST_URL: string = import.meta.env.VITE_PRO_WAITLIST_URL || '';

export const REPO_URL = 'https://github.com/StormDoragon/CodeRoast';
