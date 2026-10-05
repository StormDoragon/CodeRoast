import { CreateMLCEngine, type MLCEngine, type InitProgressReport } from '@mlc-ai/web-llm';
import type { Analysis } from './analyzer';
import type { Intensity } from './roastLite';

let current: { model: string; engine: Promise<MLCEngine> } | null = null;

// Keep one engine alive; switching models unloads the previous one so we
// don't hold two multi-hundred-MB models in GPU memory.
export function getEngine(model: string, onProgress?: (r: InitProgressReport) => void) {
  if (current?.model !== model) {
    current?.engine.then((e) => e.unload()).catch(() => {});
    current = { model, engine: CreateMLCEngine(model, { initProgressCallback: onProgress }) };
    current.engine.catch(() => {
      current = null;
    });
  }
  return current.engine;
}

const MAX_CODE_CHARS = 6000;

const TONE: Record<Intensity, string> = {
  gentle: 'Be playful and kind, like a senior dev teasing a friend. Every joke should come with a helpful tip.',
  savage: 'Be savage, specific and funny, like a comedy roast. Punch at the code, never at the person.',
  unhinged: 'Be completely unhinged and dramatic, maximum chaos energy. Still stay specific to the code. No slurs, no attacks on the person.',
};

export function buildPrompt(code: string, analysis: Analysis, intensity: Intensity) {
  const clipped = code.length > MAX_CODE_CHARS ? `${code.slice(0, MAX_CODE_CHARS)}\n… (truncated)` : code;
  const receipts = analysis.findings.length
    ? analysis.findings
        .map((f) => `- ${f.rule} x${f.count}${f.lines.length ? ` (lines ${f.lines.join(', ')})` : ''}`)
        .join('\n')
    : '- none found';

  return [
    {
      role: 'system' as const,
      content: `You are CodeRoast, a stand-up comedian ape who reviews code. ${TONE[intensity]}
Rules: 4-7 short bullet points, each a specific joke about a real issue in the code, followed by "Fix:" and a one-line fix.
Finish with exactly: "Banana Score: ${analysis.score}/10".`,
    },
    {
      role: 'user' as const,
      content: `Language: ${analysis.lang}. Lines: ${analysis.metrics.totalLines}. Max nesting: ${analysis.metrics.maxDepth}.
Static analysis receipts:
${receipts}

Code:
\`\`\`${analysis.lang}
${clipped}
\`\`\``,
    },
  ];
}

export async function aiRoast(
  code: string,
  analysis: Analysis,
  intensity: Intensity,
  model: string,
  onToken: (t: string) => void,
  onProgress?: (r: InitProgressReport) => void,
): Promise<string> {
  const engine = await getEngine(model, onProgress);
  const temperature = intensity === 'gentle' ? 0.6 : intensity === 'savage' ? 0.9 : 1.2;
  const stream = await engine.chat.completions.create({
    messages: buildPrompt(code, analysis, intensity),
    temperature,
    max_tokens: 700,
    stream: true,
  });
  let full = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || '';
    full += token;
    onToken(token);
  }
  return full;
}
