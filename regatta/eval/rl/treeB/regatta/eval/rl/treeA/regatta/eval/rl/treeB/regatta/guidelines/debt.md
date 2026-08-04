# Known Visual Debt

**Updated:** July 28, 2026
**Companion docs:** [visual-style.md](visual-style.md) · [race-view.md](race-view.md) · [venue-art.md](venue-art.md) · [README.md](README.md)

The single register of verified gaps between the shipped product and the guidelines.
One list, so it can't drift across documents. Ordered by value-per-effort.

Each item is **verified** — measured or read out of the code, not suspected. When one
lands, delete the row and move whatever it established into the relevant Observed
section.

| # | Item | Where | Guide | Effort |
|---|---|---|---|---|
| 1 | Course overlay measures 1.04–1.99:1 on bright venues — needs a dark under-stroke or shadow as a contrast carrier | `drawLadderLines()`, `drawMarkZones()` | [race-view.md](race-view.md) §6.3 | small, high value |
| 2 | HUD uses Tailwind `font-mono` (OS mono stack) instead of `.t-mono` — 26 sites | `grep font-mono` | [visual-style.md](visual-style.md) §5.4 | mechanical |
| 3 | `slate-500` sub-label at 3.38:1 fails the contrast floor → `slate-400` (6.27:1) | "Fine-tune wind…" line | [visual-style.md](visual-style.md) §4.4, §7.1 | one class |
| 4 | Type sizes not snapped to the nine-step ramp — 12 inline `font-size` values, three pairs under 1.12× apart | pre-race builders | [visual-style.md](visual-style.md) §5.2 | mechanical |
| 5 | HUD headings hardcode `font-family:'Archivo'` instead of `.t-display` | `#hud-leg-info`, Results H1, Paused | [visual-style.md](visual-style.md) §5.4 | mechanical |
| 6 | `prefers-reduced-motion` not honoured anywhere | `index.html` `<style>` | [visual-style.md](visual-style.md) §7.4 | small |
| 7 | Two wordmark lockups in two typefaces; `.t-wordmark` pins the *system* sans so the brand mark differs per OS | in-race logo vs pre-race `<h1>` | [visual-style.md](visual-style.md) §5.4 | design call |
| 8 | Canvas text uses OS `monospace`/`sans-serif` at 8 of 10 sites | `grep 'ctx.font ='` | [visual-style.md](visual-style.md) §5.4 | needs `document.fonts.ready` |
| 9 | Same meaning ships in two shades: `yellow-300`/`yellow-400`, `red-400`/`red-500` | DOM vs canvas | [visual-style.md](visual-style.md) §4.3 | pick the DOM value |
| 10 | No keyboard/controller focus state on venue cards | `renderVenuePicker()` | [visual-style.md](visual-style.md) §6.5, §7.4 | new state |
| 11 | Selection relies on hue alone — no color-blind-safe cue | `renderVenuePicker()` | [visual-style.md](visual-style.md) §7.3 | new state |
| 12 | Venue grid clips mid-card at 1280×720, the stated minimum | pre-race browse column | [visual-style.md](visual-style.md) §6.1 | layout |
| 13 | Boat labels collide in a crowded start — no leader line | `drawBoatIndicator()` | [race-view.md](race-view.md) §6.4 | layout |
| 14 | Leaderboard shows distance deltas but no position-change chevrons | `updateLeaderboard()` | [race-view.md](race-view.md) §6.4 | small feature |
| 15 | Wind pressure invisible to the player as anything but gust tint | wind field | [race-view.md](race-view.md) §6.4 | feature |
| 16 | Dark hulls lose all interior linework (20 of 66) to multiply tinting | `getTintedBoatPart()` | [race-view.md](race-view.md) §10.2 | prototyped, deferred |
| 17 | Sailing gear inconsistent across the 81-portrait roster | `assets/images/competitors/` | [visual-style.md](visual-style.md) §8.6 | art backlog |

## Deliberately deferred

Not debt — decisions to *not* do something, recorded so they aren't relitigated.

| Item | Why |
|---|---|
| Dark-hull linework composite-op fix | Prototyped and working, never committed. At race scale (~55px) the lines are sub-pixel regardless, so the payoff is confined to the profile-card boat garnish. Revisit if the profile card grows or boats render larger. |
