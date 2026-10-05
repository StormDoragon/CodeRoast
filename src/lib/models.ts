export interface ModelOption {
  id: string;
  label: string;
  size: string;
}

// IDs must exist in @mlc-ai/web-llm's prebuiltAppConfig.
export const AI_MODELS: ModelOption[] = [
  { id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 Coder 1.5B (recommended)', size: '~1 GB' },
  { id: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 Coder 0.5B (fastest)', size: '~400 MB' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B (funnier)', size: '~900 MB' },
  { id: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 Coder 3B (smartest)', size: '~2 GB' },
];

export const DEFAULT_MODEL = AI_MODELS[0].id;

export function isKnownModel(id: string) {
  return AI_MODELS.some((m) => m.id === id);
}
