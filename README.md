# CodeRoast 🔥🐵

**The only in-browser code roaster that actually understands structure.**  
Paste code or a GitHub URL → get a savage, hilarious breakdown with real AST insights. Multi-language. Persistent chat. Zero backend.

Built for devs who want the truth, delivered by an angry ape.

## Killer Features
- Supports **JavaScript, TypeScript, Python, Rust, Go** (more coming)
- Tree-sitter structural analysis (no more blind LLM guesses)
- Drop any GitHub file URL — it just works
- Multi-turn chat with the code in context
- Streaming roasts + banana score meter
- Roast history (IndexedDB)
- Export as PNG meme card

## Live Demo
(once deployed — link here)

## Quick Start
```bash
git clone https://github.com/SarcasticApeSquad/coderoast.git
cd coderoast
npm install
npm run dev
```

Open in Chrome/Edge (WebGPU required). First model load ~10–45s, then cached forever.

**Default model**: Qwen2-1.5B (fast + surprisingly savage on code)

## Supported Languages
- JavaScript / TypeScript
- Python
- Rust / Go (add more WASM in public/)

## Tech (2026 edition)
- Vite + React + TypeScript + Tailwind
- web-tree-sitter v0.26.5
- @mlc-ai/web-llm v0.2.81 (WebGPU)
- CodeMirror 6

## Limitations (honest)
- First model download is chunky (1.5–3 GB total)
- WebGPU only (Chrome/Edge best, Safari partial)
- Small models = occasional dumb roasts (still funnier than most humans)

## Contributing
PRs for:
- Meaner prompts / new roast templates
- More languages
- Banana-themed loading animations
- PWA install button

Made with pure spite and WebGPU by @sarcasticapes  
License: MIT
