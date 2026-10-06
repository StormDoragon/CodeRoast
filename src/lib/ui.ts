import type { Lang } from './analyzer';
import type { Intensity } from './roastLite';

export const LANG_OPTIONS: Array<{ value: Lang | 'auto'; label: string }> = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java / Kotlin' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'c', label: 'C / C++' },
];

const LANG_LABEL: Record<string, string> = Object.fromEntries(LANG_OPTIONS.map((o) => [o.value, o.label]));

export function langLabel(lang: string) {
  return LANG_LABEL[lang] ?? lang;
}

export const INTENSITIES: Array<{ value: Intensity; label: string }> = [
  { value: 'gentle', label: '😌 Gentle' },
  { value: 'savage', label: '🔥 Savage' },
  { value: 'unhinged', label: '💢 Unhinged' },
];

export const chip = (active: boolean) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    active ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
  }`;

export const field =
  'mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100';

export const label = 'text-xs font-semibold uppercase tracking-widest text-zinc-500';
