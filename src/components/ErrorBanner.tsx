import React from 'react';

interface ErrorBannerProps {
  message: string;
  type?: 'error' | 'info';
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, type = 'error', onDismiss }) => (
  <div
    role={type === 'error' ? 'alert' : 'status'}
    className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
      type === 'error' ? 'border-red-900 bg-red-950/60 text-red-200' : 'border-zinc-800 bg-zinc-900 text-zinc-300'
    }`}
  >
    <p>{message}</p>
    {onDismiss && (
      <button onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
        ✕
      </button>
    )}
  </div>
);
