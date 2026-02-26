import React from 'react';

interface TemperatureControlProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const TemperatureControl: React.FC<TemperatureControlProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const labels = [
    { value: 0.5, label: 'Chill 😌' },
    { value: 0.7, label: 'Normal 👍' },
    { value: 0.95, label: 'Savage 🔥' },
    { value: 1.2, label: 'UNLEASHED 💢' },
  ];

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-gray-700">Roast Intensity:</label>
      <div className="flex gap-2">
        {labels.map((item) => (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            disabled={disabled}
            className={`px-3 py-1 text-sm rounded transition ${
              Math.abs(value - item.value) < 0.1
                ? 'bg-red-600 text-white font-bold'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <input
        type="range"
        min="0.5"
        max="1.2"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full disabled:opacity-50"
      />
      <p className="text-xs text-gray-600">Temperature: {value.toFixed(2)}</p>
    </div>
  );
};
