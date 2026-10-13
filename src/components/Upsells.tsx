import React from 'react';
import { track } from '../lib/analytics';
import { PRO_WAITLIST_URL, REPO_URL } from '../lib/config';

export const Upsells: React.FC = () => (
  <>
    <a
      href={`${REPO_URL}#coderoast-for-pull-requests`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('pr_action_cta')}
      className="block rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300 hover:border-red-500"
    >
      <strong className="text-zinc-100">🤖 Roast every pull request automatically.</strong> Add the free CodeRoast GitHub
      Action and every PR gets a self-updating roast comment with receipts and fixes. →
    </a>
    {PRO_WAITLIST_URL && (
      <a
        href={PRO_WAITLIST_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('pro_waitlist_cta')}
        className="block rounded-2xl border border-yellow-700/50 bg-yellow-950/20 p-4 text-sm text-yellow-100 hover:border-yellow-500"
      >
        <strong>CodeRoast Pro (coming soon):</strong> a smarter cloud model, private repos, team leaderboards and quality
        gates for every PR. Join the waitlist →
      </a>
    )}
  </>
);
