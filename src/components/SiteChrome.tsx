import React from 'react';
import { REPO_URL, SPONSOR_URL } from '../lib/config';

export const SiteHeader: React.FC = () => (
  <header className="border-b border-zinc-900">
    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
      <a href="./" className="text-xl font-black tracking-tight text-zinc-50">
        CodeRoast <span aria-hidden>🔥🐵</span>
      </a>
      <nav className="flex items-center gap-4 text-sm text-zinc-400">
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-100">
          GitHub
        </a>
        {SPONSOR_URL && (
          <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-100">
            🍌 Buy the ape a banana
          </a>
        )}
      </nav>
    </div>
  </header>
);

export const SiteFooter: React.FC = () => (
  <footer className="border-t border-zinc-900 py-8 text-center text-xs text-zinc-600">
    <p>
      Made with spite and bananas. Open source on{' '}
      <a href={REPO_URL} className="underline hover:text-zinc-400" target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
      . Roasts are jokes about code, never about people.
    </p>
  </footer>
);
