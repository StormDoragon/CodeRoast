import { getStructuralSummary } from './treeParser';
import { CreateMLCEngine } from '@mlc-ai/web-llm';

const engines = new Map<string, Promise<any>>();

export function getEngine(modelName: string = 'Qwen2-1.5B-Instruct-q4f16_1-MLC') {
  if (!engines.has(modelName)) {
    engines.set(
      modelName,
      CreateMLCEngine(modelName)
    );
  }
  return engines.get(modelName)!;
}

export async function roastCode(
  code: string,
  lang: string,
  modelName: string = 'Qwen2-1.5B-Instruct-q4f16_1-MLC',
  temperature: number = 0.95,
  onToken?: (token: string) => void
): Promise<string> {
  const structure = await getStructuralSummary(code, lang);

  // Enhanced structural analysis with pattern detection
  const patterns: string[] = [];

  if ((structure as any).maxDepth > 5) {
    patterns.push(`deep nesting (>5 levels)`);
  }
  if ((structure as any).loops > 3) {
    patterns.push(`${(structure as any).loops} nested loops (yikes)`);
  }
  if ((structure as any).functions === 0 && (structure as any).methods === 0) {
    patterns.push(`no functions (just globals?)`);
  }
  if ((structure as any).suspiciousNames && (structure as any).suspiciousNames.length > 0) {
    patterns.push(`sus variable names: ${(structure as any).suspiciousNames.join(', ')}`);
  }
  if ((structure as any).totalLines > 500) {
    patterns.push(`thicc file (${(structure as any).totalLines} lines)`);
  }

  const patternSummary = patterns.length > 0 ? `Red flags: ${patterns.join('; ')}` : 'Code looks... acceptable?';

  const prompt = `You are CodeRoast, the angriest ape in the codebase.
Code (${lang}):
\`\`\`
${code}
\`\`\`

Structure Analysis:
- Functions: ${(structure as any).functions}
- Methods: ${(structure as any).methods}
- Loops: ${(structure as any).loops}
- Max Depth: ${(structure as any).maxDepth}
- Lines: ${(structure as any).totalLines}
- ${patternSummary}

Your job: Roast this code like it owes you money. Be savage, specific, and funny.
End with a Banana Score (1–10, where 10 = pristine, 1 = war crime).
Format: [Your roast here]\nBanana Score: X/10`;

  const engine = await getEngine(modelName);
  const stream = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    temperature: Math.min(Math.max(temperature, 0.5), 1.5),
    stream: true,
  });

  let full = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || '';
    full += token;
    if (onToken) onToken(token);
  }
  return full;
}
