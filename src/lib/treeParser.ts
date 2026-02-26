// Simple code structure analyzer using regex and heuristics
// (Full tree-sitter integration requires language-specific WASM files)

export async function getStructuralSummary(code: string, lang: string) {
  const lines = code.split('\n');
  const totalLines = lines.length;
  
  // Simple function/method counting using regex
  let functions = 0;
  let methods = 0;
  let loops = 0;
  
  // Count function declarations and arrow functions
  const functionRegex = /\b(?:function|const|let|var)\s+\w+\s*=?\s*(?:async\s*)?\(|(?:async\s+)?function\s+\w+\s*\(|^\s*\w+\s*\(/gm;
  functions = (code.match(functionRegex) || []).length;
  
  // Count method calls/definitions
  const methodRegex = /\.\w+\s*\(|\.\w+\s*=\s*function/gm;
  methods = (code.match(methodRegex) || []).length;
  
  // Count loops
  const loopRegex = /\b(?:for|while|do\s*\{|forEach|map|filter|reduce)\b/g;
  loops = (code.match(loopRegex) || []).length;
  
  // Calculate max nesting depth
  let maxDepth = 0;
  let currentDepth = 0;
  for (const char of code) {
    if (char === '{' || char === '(' || char === '[') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === '}' || char === ')' || char === ']') {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }
  
  // Detect suspicious variable names (like xO0l1)
  const suspiciousNames: string[] = [];
  const identifierRegex = /\b([xXoO01l]{2,})\b/g;
  let match;
  const seen = new Set<string>();
  while ((match = identifierRegex.exec(code)) !== null) {
    if (!seen.has(match[1]) && suspiciousNames.length < 3) {
      suspiciousNames.push(match[1]);
      seen.add(match[1]);
    }
  }

  return {
    functions: Math.max(1, functions),
    methods: Math.max(0, methods),
    loops: Math.max(0, loops),
    maxDepth,
    suspiciousNames,
    totalLines,
  };
}
