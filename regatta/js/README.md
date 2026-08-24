# regatta/js — layout

The game is plain classic scripts sharing ONE global scope, loaded in the
order stated in the HTML pages (there is no bundler and no module system —
deliberately; see `../guidelines/architecture.md` for the full map, the
load-order contract, tooling contracts, and the known cross-boundary leaks).

Quick map:

- `game/` — CONFIG + RNG streams + math (`core.js`), the shared `state` +
  `settings` + `Boat` (`state.js`), `audio.js`, `telemetry.js`
- `sim/` — `wind.js`, `water.js`, `ice.js`, `physics.js`, `collision.js`,
  `course.js`
- `ai/` — `roster.js` (AI_CONFIG — regex-scraped by eval tools, keep its
  shape), `bot.js`, `navigation.js`, `avoidance.js`
- `render/` — `sprites.js`, `world.js`, `effects.js`, `hud.js`
- `ui/` — `screens.js`, `input.js`
- `script.js` — the hub: `update()`, `draw()`, `loop()`, `resetGame()`, boot,
  window exports. Shared; keep edits here rare.

Rules of thumb: one subsystem per file, no duplicate top-level names anywhere,
new files go into ALL FIVE pages (index, rules, scenario, editor, competitor),
`npm run trace` gates any sim-side change.
