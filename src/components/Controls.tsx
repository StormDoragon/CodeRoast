import React from 'react';
import type { Lang } from '../lib/analyzer';
import { AI_MODELS } from '../lib/models';
import type { Intensity } from '../lib/roastLite';
import { chip, field, INTENSITIES, label, LANG_OPTIONS } from '../lib/ui';

export type Mode = 'instant' | 'ai';

export const IntensityPicker: React.FC<{ value: Intensity; onChange: (v: Intensity) => void }> = ({ value, onChange }) => (
  <div>
    <div className={`mb-1 ${label}`}>Intensity</div>
    <div className="flex flex-wrap gap-2">
      {INTENSITIES.map((i) => (
        <button key={i.value} className={chip(value === i.value)} onClick={() => onChange(i.value)}>
          {i.label}
        </button>
      ))}
    </div>
  </div>
);

interface ControlsProps {
  lang: Lang | 'auto';
  onLang: (l: Lang | 'auto') => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  webgpu: boolean | null;
  model: string;
  onModel: (m: string) => void;
  busy: boolean;
}

export const RoastControls: React.FC<ControlsProps> = ({ lang, onLang, mode, onMode, webgpu, model, onModel, busy }) => (
  <>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>
        Language
        <select value={lang} onChange={(e) => onLang(e.target.value as Lang | 'auto')} className={field}>
          {LANG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className={label}>
        Engine
        <div className="mt-1 flex gap-2">
          <button className={chip(mode === 'instant')} onClick={() => onMode('instant')}>
            ⚡ Instant
          </button>
          <button
            className={chip(mode === 'ai')}
            onClick={() => onMode('ai')}
            title={webgpu === false ? 'Needs WebGPU' : 'Runs a small LLM locally on your GPU'}
          >
            🧠 AI {webgpu === false && '(n/a)'}
          </button>
        </div>
      </div>
    </div>
    {mode === 'ai' && (
      <label className={`block ${label}`}>
        Local model (downloaded once, then cached)
        <select value={model} disabled={busy} onChange={(e) => onModel(e.target.value)} className={field}>
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · {m.size}
            </option>
          ))}
        </select>
      </label>
    )}
  </>
);
