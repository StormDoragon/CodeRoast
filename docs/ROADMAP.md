# CodeRoast: Goal & Roadmap

## The goal

**Make CodeRoast the internet's default "roast my code" button, one of the breakout dev projects of 2026, and make it a business that pays for itself.**

"One of the best" is vague, so this is how we'll measure it:

| Milestone | Target | Why it matters |
|---|---|---|
| Launch week | Hacker News front page **or** Product Hunt top 5 of the day | Proves the hook works on a cold audience |
| 30 days | 100k roasts, 2k GitHub stars, 10k share links opened | Proves people share, not just try |
| 90 days | 1M roasts, 5k ⭐, 1k READMEs showing the Banana Score badge | Proves the loop works without us pushing |
| 6 months | $5k MRR from Pro + sponsors | Proves it's a business, not just a toy |

North-star metric: **share links opened per day.** Every opened link is a new person who saw a roast and the "Think you can beat 3/10?" challenge.

## Why it can win

1. **Zero friction.** No signup, no download, no server. The instant engine roasts in under 50 ms on any phone.
2. **Private by design.** Code never leaves the browser, so devs can paste work code. That is the #1 objection to "AI code review" sites.
3. **Funny *and* useful.** Every joke cites line numbers and comes with a real fix. People share the funny part and come back for the useful part.
4. **Built-in viral loops:**
   - Share link → opens a roast card → "Think you can beat X/10?" → visitor roasts their own code → shares.
   - README badge (`Banana Score 8/10`) → every repo that shows it links back.
   - Meme card PNG sized for X/LinkedIn previews.
   - Competitive frame (scores, verdicts like "War Crime" / "Suspiciously Clean") invites dueling.

## Where we are (v1.0, this branch)

Done in this pass, and why each item mattered:

- [x] **Fixed broken production build.** The AI worker was never bundled and was recreated on every keystroke, which re-downloaded the model.
- [x] **Instant engine.** A deterministic analyzer covering 24 rules across JS/TS/Python/Go/Rust/Java, plus a joke generator with receipts and fixes. Works on every device, with no WebGPU and no download.
- [x] **AI engine (optional).** Local WebLLM with valid model IDs (Qwen2.5-Coder, Llama 3.2), a download progress bar, and a prompt grounded in the analyzer's receipts.
- [x] **Share links** (roast only, never code) with a dedicated shared-roast landing view and challenge CTA.
- [x] Meme card PNG (1200×630), X/LinkedIn share, native share sheet, README badge.
- [x] One-click example "crimes" so first-time visitors get a laugh in one click.
- [x] Local roast history, fixed IndexedDB version bug.
- [x] Redesigned dark UI, mobile-ready, keyboard shortcut.
- [x] PWA: real PNG icons, safe service worker (no longer caches multi-GB model shards).
- [x] OG/Twitter meta + preview image.
- [x] Tests (vitest), CI, and a GitHub Pages deploy workflow.
- [x] Removed fake claims (the "tree-sitter" WASM files were placeholders).

## Plan

### Phase 1: Ship (week 1)
- [ ] Enable GitHub Pages (Settings → Pages → Source: GitHub Actions) and merge to `main`.
- [ ] Buy a short domain (`coderoast.dev` or similar), then set the `SITE_URL` repo variable.
- [ ] Set up privacy-friendly analytics (Plausible/Umami) with events: `roast`, `share_click`, `share_open`, `badge_copy`, `ai_roast`.
- [ ] Set `SPONSOR_URL` (GitHub Sponsors / Ko-fi) so the "Buy the ape a banana" link appears.
- [ ] Do a manual QA pass on Safari iOS, Chrome Android, and Firefox.

### Phase 2: Launch (weeks 2–3)
- [ ] **Roast famous code** content series: roast well-known open-source files (left-pad, the original Facebook PHP, the Apollo 11 source). Post cards to X, Reddit (r/ProgrammerHumor), and LinkedIn. These are the launch assets.
- [ ] Show HN: "CodeRoast: a code roaster that runs entirely in your browser (no server, your code never leaves)." Lead with privacy + the tech.
- [ ] Product Hunt launch on a Tuesday, with the meme cards as the gallery.
- [ ] Short demo video (15 s): paste awful code → 1/10 War Crime → share.
- [ ] Reach out to 20 dev YouTubers/streamers. "Roast your viewers' code live" is a ready-made segment.

### Phase 3: Go viral (month 1–2)
- [ ] **Dynamic OG images per share link** (edge function rendering the card), so every shared link previews with its own score. This is the single biggest lever on click-through.
- [ ] **Roast a whole repo:** paste `github.com/user/repo` and get a repo-level verdict ("your repo is 40% TODOs").
- [ ] **Roast battles:** two snippets, side by side, with a winner card.
- [ ] **Hall of Shame / Fame:** opt-in public leaderboard of the worst and best scores.
- [ ] More languages (C#, PHP, Ruby, C/C++, Swift, SQL) and 3× the joke pool per rule.
- [ ] i18n of jokes (ES, PT-BR, DE, JA, HI) for big dev communities.

### Phase 4: Earn (month 2–6)
Free stays free and local. Revenue comes from things that cost us money or save teams time:

| Product | Price | What you get |
|---|---|---|
| **Free** | $0 | Instant + local AI roasts, share, badge |
| **Pro** | $5/mo | Cloud model roasts (sharper, funnier), whole-repo roasts, custom card themes, no watermark |
| **CodeRoast for GitHub** (App) | $19/mo per org | Auto-roasts every PR with a comment + score, with a team leaderboard. "Fun" code review that teams actually read. |
| **Sponsors** | Variable | GitHub Sponsors / Ko-fi, plus a tasteful "This roast brought to you by" dev-tool sponsor slot on share cards |
| **Merch** | One-off | "War Crime 1/10" / "Suspiciously Clean" stickers and shirts |

Steps:
- [ ] Waitlist (set `PRO_WAITLIST_URL`); the Pro teaser only shows after a roast.
- [ ] Payments via Stripe or Lemon Squeezy behind a small serverless API (the first piece of backend).
- [ ] GitHub App MVP: reuse `analyzer.ts` + `roastLite.ts` server-side; they're already dependency-free.

## Risks & how we handle them
- **"It's just a joke app" fatigue** → the fixes make it genuinely useful; lean into the "funniest linter" positioning.
- **Mean-spirited roasts** → jokes target code, never people; templates are curated; AI prompt forbids personal attacks.
- **Heuristic false positives** → line-numbered receipts make mistakes visible; add a "that's wrong" button to collect bad cases and turn them into test fixtures.
- **WebGPU availability** → instant engine is the default and needs nothing.
- **Virality isn't guaranteed** → we control the loop (share → challenge → roast); we iterate on share-open rate weekly until it compounds.
