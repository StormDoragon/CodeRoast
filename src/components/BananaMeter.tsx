import React from 'react';

export function scoreTone(score: number) {
  if (score >= 8) return { text: 'text-green-400', bar: 'bg-green-500' };
  if (score >= 6) return { text: 'text-yellow-300', bar: 'bg-yellow-400' };
  if (score >= 4) return { text: 'text-orange-400', bar: 'bg-orange-500' };
  return { text: 'text-red-500', bar: 'bg-red-600' };
}

export const BananaMeter: React.FC<{ score: number }> = ({ score }) => {
  const tone = scoreTone(score);
  return (
    <div
      className="flex gap-1"
      role="meter"
      aria-valuemin={1}
      aria-valuemax={10}
      aria-valuenow={score}
      aria-label="Banana Score"
    >
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className={`h-2 flex-1 rounded-full ${i < score ? tone.bar : 'bg-zinc-800'}`} />
      ))}
    </div>
  );
};
