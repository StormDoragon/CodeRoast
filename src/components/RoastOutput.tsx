import React from 'react';

interface RoastOutputProps {
  text: string;
}

export const RoastOutput: React.FC<RoastOutputProps> = ({ text }) => {
  return (
    <div className="whitespace-pre-wrap p-4 bg-white rounded shadow">
      {text}
    </div>
  );
};
