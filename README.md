# Row

Carl Meyer's personal fitness/life dashboard — a set of vanilla HTML/JS pages, no build step, no framework. Deployed to Vercel at [row-sage.vercel.app](https://row-sage.vercel.app).

## Pages

| File | What it is |
|---|---|
| `index.html` | Home |
| `main.html` | Main dashboard |
| `gym.html` | Progressive-overload gym/workout tracker, posing coach, macro/barcode logging |
| `health.html` | Supplement / daily stack tracker |
| `mobility.html` | Mobility, warm-ups, joint care |
| `macros.html` | Macro calculator |
| `offline.html` | PWA offline fallback |

## How it works

- **Persistence:** Supabase `app_state` key-value table via `sync.js` — no accounts, passphrase-gated (`topbar.js`, `AUTH_PASS`/`AUTH_KEY`).
- **No framework, no build step:** plain HTML/CSS/JS per page, opened directly or served statically.
- **Shared modules:** `topbar.js` (nav + auth), `sync.js` (cloud sync), `gym-weight-photos.js`/`gym-workout-events.js` (gym.html support modules), `hype-audio.js` (motivation-audio mini-player, byte-identical copy shared with the `hype-audio` repo).
- **Web Push:** service worker + `web-push` for workout/macro-drift notifications.

See this repo's `CLAUDE.md` for development rules (TypeScript strictness, TDD, architecture intentions) and `project-row-dashboard.md` (Claude memory) for Supabase keys, key functions, and standing rules.
