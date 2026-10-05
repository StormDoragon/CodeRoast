# CodeRoast Launch Kit

Everything needed to run Phase 2 of [the roadmap](../ROADMAP.md). The copy is ready to paste, and the assets are in this folder.

**Live URL:** https://code-roast-five.vercel.app (replace it everywhere once a custom domain is live)

## Assets

| File | Use |
|---|---|
| `demo.mp4` (14 s, 1280×720) | X/LinkedIn video post, Product Hunt gallery, README |
| `cards/intern-s-first-pr.png` (1/10, War Crime) | Lead image: the most shareable result |
| `cards/left-pad-broke-npm-2016.png` (9/10) | The hook: "the code that broke npm scores 9/10" |
| `cards/typescript-in-name-only.png` (3/10) | TypeScript crowd |
| `cards/python-script-from-2011.png` (1/10) | Python crowd |
| `cards/go-the-2-a-m-hotfix.png` (4/10) | Go crowd |
| `../../public/og.png` | Generic link preview |

To regenerate the assets after UI changes: build with `VITE_SITE_URL` set, roast each example in the app, and use **Download card**.

## Launch timeline

| When | What | Owner |
|---|---|---|
| T-7 days | Turn on Vercel Analytics; buy domain; ask 10 dev friends to try it and send their worst score | You |
| T-5 | Post the left-pad card on X/LinkedIn ("teaser" below). Note which hook gets more engagement | You |
| T-3 | Reach out to 20 creators (DM template below) | You |
| **T-0 (Tue)** | Product Hunt at 00:01 PT, then Show HN around 08:00 PT | You |
| T-0 | X thread + LinkedIn post + r/webdev (only on its weekly showoff thread) | You |
| T+1 | r/ProgrammerHumor: post a *card image* (humor sub, so no self-promo text; link in a comment only if asked) | You |
| T+1–7 | Reply to every comment. Turn every "it missed X" into an issue, and ship fixes daily | You + me |
| T+7 | Retro: check share-open rate, roasts per visitor, and top referrers; pick the Phase 3 priority | You + me |

Hacker News and Reddit penalize vote-asking, so never ask for upvotes. Ask people to "roast their code and post the score".

---

## Show HN

**Title** (≤80 chars, no hype words):
```
Show HN: CodeRoast – a code roaster that runs entirely in your browser
```

**URL:** https://code-roast-five.vercel.app

**First comment:**
```
Hi HN! CodeRoast roasts your code: paste a file (or a GitHub link) and you get jokes with
line-numbered receipts, an actual fix for each issue, and a "Banana Score" out of 10.

A few design choices that might interest this crowd:

- Nothing is uploaded. The default engine is a small deterministic static analyzer (about 24
  rules across JS/TS/Python/Go/Rust/Java; strings and comments are stripped before matching)
  feeding seeded joke templates, so it's instant on any phone and roasts are reproducible.
- There's an optional AI mode that runs a 0.5–3B code model locally via WebGPU (WebLLM). The
  prompt is grounded in the analyzer's findings so the model riffs on real issues instead
  of hallucinating them.
- Share links put the roast (never the code) in the URL hash, so there's still no backend.

Fun fact: left-pad, the 11 lines that broke npm in 2016, scores 9/10. Its only sin is `var`.

It's MIT and on GitHub: https://github.com/StormDoragon/CodeRoast. I'd love to hear which
rules are wrong or missing. Every false positive becomes a test case.
```

## Product Hunt

- **Name:** CodeRoast
- **Tagline (≤60):** `Get your code roasted with receipts, fixes and a score`
- **Topics:** Developer Tools, Humor, Open Source, Artificial Intelligence
- **Gallery:** `demo.mp4`, `cards/intern-s-first-pr.png`, `cards/left-pad-broke-npm-2016.png`, `cards/typescript-in-name-only.png`, `../../public/og.png`
- **Description:**
```
Paste code or a GitHub link and CodeRoast tears it apart. It's brutally funny, but every joke
points at real line numbers and comes with a real fix. You get a Banana Score out of 10 to brag
about (or hide).

⚡ Instant: works on any device, no signup, no download
🔒 Private: runs 100% in your browser, so your code never leaves your device
🧠 Optional local AI roasts via WebGPU
🔗 Share a roast card, challenge friends, or put your score badge in your README
```
- **Maker comment:**
```
I built CodeRoast because code review is useful but painful, and roasts are painful but
funny. So why not both? Try the "Intern's first PR" example for a 1/10, then paste your own
code. Post your score in the comments; the lowest one gets a shoutout 🍌
```

## X / Twitter

**Teaser (T-5, attach `cards/left-pad-broke-npm-2016.png`):**
```
I built a tool that roasts your code.

The 11 lines of left-pad that broke npm in 2016? 9/10. Its only crime is `var`.

Your code is probably worse. Find out 👇
https://code-roast-five.vercel.app
```

**Launch thread (attach `demo.mp4` to tweet 1):**
```
1/ I made CodeRoast: paste your code, get roasted 🔥🐵

Savage jokes, but with line-numbered receipts, real fixes, and a Banana Score /10.

Runs 100% in your browser. Your code never leaves your device.
https://code-roast-five.vercel.app

2/ My intern's first PR scored 1/10: "War Crime" ☠️
[cards/intern-s-first-pr.png]

3/ TypeScript with `any` everywhere gets: "You installed TypeScript and then politely asked it to leave." 3/10.
[cards/typescript-in-name-only.png]

4/ Under the hood: a tiny static analyzer + joke engine (instant, works on phones), plus an
optional local LLM via WebGPU. No server. Open source (MIT):
https://github.com/StormDoragon/CodeRoast

5/ Roast your worst file and reply with your score. Lowest score wins nothing but my respect 🍌
```

## LinkedIn

```
Code review, but make it a comedy roast. 🔥

I built CodeRoast: paste any code and get a brutally funny breakdown. Every joke cites the exact
lines and comes with a real fix, plus a "Banana Score" out of 10.

What I'm proudest of: it runs entirely in your browser. No signup, no server, and your code never
leaves your device, so you can safely try it on work code.

The left-pad function that broke half the internet in 2016 scores 9/10. What does yours score?

👉 https://code-roast-five.vercel.app
(Open source: https://github.com/StormDoragon/CodeRoast)
```

## Reddit

**r/webdev (Showoff Saturday thread only):**
```
I built CodeRoast: a code roaster that runs entirely client-side (static analyzer + optional
WebGPU LLM). Jokes come with line numbers and fixes. Feedback on false positives very welcome!
https://code-roast-five.vercel.app
```

**r/ProgrammerHumor:** post `cards/intern-s-first-pr.png` with the title
`My intern's first PR got rated "War Crime" (1/10)`. Don't put a link in the post.

## Creator outreach DM

```
Hey {name}! Loved your {specific video/post}. I built a free tool that roasts code: jokes with
line numbers, actual fixes, and a score out of 10. It runs entirely in the browser, so it's safe
to use on stream with viewers' code.

Thought it might make a fun "roast my viewers' code" segment. No strings attached, just here if
you want it: https://code-roast-five.vercel.app
```

Target list: dev YouTubers/streamers who do code reviews or "rating your code" segments, plus
newsletter authors (JavaScript Weekly, Python Weekly, Golang Weekly, TLDR Web Dev, Bytes, Console.dev).

## Demo video script (if you re-shoot with voice-over)

| Time | Shot | Line |
|---|---|---|
| 0–2 s | Landing page | "Think your code is good?" |
| 2–4 s | Click "Intern's first PR", hit Roast | "Let's find out." |
| 4–9 s | Roast scrolls in, with 1/10 War Crime | "Receipts, line numbers, and actual fixes." |
| 9–13 s | Share card, Copy link | "Then share the damage." |
| 13–14 s | URL | "CodeRoast. Runs in your browser." |
