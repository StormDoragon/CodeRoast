import React from 'react';

export interface ModelOption {
  name: string;
  label: string;
  size: string;
  speed: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    name: 'Qwen2-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2-1.5B (Default)',
    size: '~1.8 GB',
    speed: 'Fast ⚡',
  },
  {
    name: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
    label: 'Phi-3-mini (Compact)',
    size: '~1.4 GB',
    speed: 'Very Fast ⚡⚡',
  },
  {
    name: 'Gemma-2-2b-it-q4f16_1-MLC',
    label: 'Gemma-2-2B (Balanced)',
    size: '~1.5 GB',
    speed: 'Fast ⚡',
  },
  {
    name: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama-3.2-1B (Quality)',
    size: '~2.1 GB',
    speed: 'Moderate ⏱️',
  },
];

interface ModelSelectorProps {
  value: string;
  onChange: (modelName: string) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const selectedModel = AVAILABLE_MODELS.find((m) => m.name === value);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-gray-700">
        LLM Model {disabled && <span className="text-xs text-gray-500">(locked during roast)</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {AVAILABLE_MODELS.map((model) => (
          <option key={model.name} value={model.name}>
            {model.label} ({model.size}, {model.speed})
          </option>
        ))}
      </select>
      {selectedModel && (
        <p className="text-xs text-gray-500">
          Selected: <span className="font-mono">{selectedModel.label}</span>
        </p>
      )}
    </div>
  );
};
