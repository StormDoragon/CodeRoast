import React from 'react';

interface ErrorBannerProps {
  error?: string | null;
  onDismiss?: () => void;
  type?: 'error' | 'warning' | 'info';
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss, type = 'error' }) => {
  if (!error) return null;

  const colors = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const icons = {
    error: '⚠️',
    warning: '⚡',
    info: 'ℹ️',
  };

  return (
    <div className={`border rounded p-4 mb-4 flex justify-between items-start ${colors[type]}`}>
      <div className="flex gap-2">
        <span className="text-lg">{icons[type]}</span>
        <p className="text-sm">{error}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 text-xs opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
};
