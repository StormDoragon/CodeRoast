import React from 'react';
import { drawCard, cardToBlob, type CardData } from '../lib/card';
import { badgeMarkdown } from '../lib/share';

interface SharePanelProps {
  card: CardData;
  url: string;
  tweet: string;
}

const btn =
  'inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-red-500 hover:bg-zinc-800';

export const SharePanel: React.FC<SharePanelProps> = ({ card, url, tweet }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (canvasRef.current) drawCard(canvasRef.current, card);
  }, [card]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${label} copied`);
    } catch {
      setToast('Copy failed — select and copy manually');
    }
  };

  const download = async () => {
    if (!canvasRef.current) return;
    const blob = await cardToBlob(canvasRef.current);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `coderoast-${card.score}-of-10.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const nativeShare = async () => {
    if (!canvasRef.current) return;
    try {
      const file = new File([await cardToBlob(canvasRef.current)], 'coderoast.png', { type: 'image/png' });
      const data: ShareData = { title: 'CodeRoast', text: tweet, url };
      if (navigator.canShare?.({ ...data, files: [file] })) await navigator.share({ ...data, files: [file] });
      else await navigator.share(data);
    } catch {
      // user cancelled
    }
  };

  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(url)}`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="w-full rounded-xl border border-zinc-800" aria-label="Roast card preview" />
      <div className="flex flex-wrap gap-2">
        {canNativeShare && (
          <button className={`${btn} border-red-600 bg-red-600 hover:bg-red-500`} onClick={nativeShare}>
            📤 Share
          </button>
        )}
        <a className={btn} href={xUrl} target="_blank" rel="noopener noreferrer">
          𝕏 Post
        </a>
        <a className={btn} href={liUrl} target="_blank" rel="noopener noreferrer">
          in Share
        </a>
        <button className={btn} onClick={() => copy(url, 'Link')}>
          🔗 Copy link
        </button>
        <button className={btn} onClick={download}>
          🖼️ Download card
        </button>
        <button className={btn} onClick={() => copy(badgeMarkdown(card.score, card.site), 'README badge')}>
          🍌 README badge
        </button>
      </div>
      <p className="text-xs text-zinc-500">Share links contain only the roast and score, never your code.</p>
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};
