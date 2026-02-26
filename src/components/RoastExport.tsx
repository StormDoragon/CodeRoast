import React from 'react';

interface RoastExportProps {
  roastText: string;
  code: string;
  lang: string;
  bananaScore?: number;
}

export const RoastExport: React.FC<RoastExportProps> = ({ roastText, code, lang, bananaScore }) => {
  const handleCopyRoast = async () => {
    try {
      await navigator.clipboard.writeText(roastText);
      alert('✅ Roast copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy roast');
    }
  };

  const handleExportAsText = () => {
    const content = `CodeRoast Export
================
Language: ${lang}
Banana Score: ${bananaScore || '?'}/10

Code:
---
${code}

Roast:
---
${roastText}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roast-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareTweet = () => {
    const tweetText = `Just got roasted by CodeRoast for my ${lang} code 🔥🐵 Banana Score: ${bananaScore || '?'}/10`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank');
  };

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={handleCopyRoast}
        disabled={!roastText}
        className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        📋 Copy Roast
      </button>
      <button
        onClick={handleExportAsText}
        disabled={!roastText}
        className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        ⬇️ Export
      </button>
      <button
        onClick={handleShareTweet}
        disabled={!roastText}
        className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        𝕏 Share
      </button>
    </div>
  );
};
