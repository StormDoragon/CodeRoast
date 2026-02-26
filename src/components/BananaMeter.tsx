import React from 'react';

interface BananaMeterProps {
  score: number; // 1–10
}

export const BananaMeter: React.FC<BananaMeterProps> = ({ score }) => {
  const percent = Math.min(Math.max((score - 1) / 9, 0), 1);
  return (
    <div className="w-full bg-gray-200 rounded h-4">
      <div
        className="bg-yellow-400 h-4 rounded"
        style={{ width: `${percent * 100}%` }}
      />
    </div>
  );
};
