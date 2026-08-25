# Regatta code architecture (the 2026-08-24 split)

`js/script.js` (27k lines) was split into 21 subsystem files. **Behavior-preserving
by construction and by proof**: pure line motion (a splitter tool enforced that
every source line lands in exactly one file), verified by 30/30 golden traces
byte-identical at 3 seeds, `_sim_unchanged` 4/4 venues identical over 5,400
stepped frames, the full `npm test` matrix, and zero pageerrors on all five
entry pages. Module boundaries were chosen from **423 commits of co-change
history**, not from taxonomy: 57% of historical commits touch exactly one of
these areas, 75% at most two.

## The mechanism (read this before "modernizing")

Everything is **classic `<script>` tags sharing one global scope**. This is a
choice, not an accident:

- ~520 eval scripts, the trace harness, and every sibling file call the game by
  **bare global name** (`state`, `resetGame()`, `getWindAt`, `BotController`,
  `settings`, …). Top-level `function` declarations are implicit `window.*`;
  top-level `const/let/class` live in the shared script scope. Probes
  monkey-patch implicit globals (`drawIslands`, `pressureAt`, `update`,
  `resetGame`, `hullCrossedLine`, `triggerPenalty`, `regionWindAt`, …), which
  only works because callers resolve them at call time.
- An ES-module refactor was tried on 2026-01-04 (PR #475) and **reverted the
  same day** (`e2d7191`) after import wiring broke startup.

**Rules that keep the mechanism working:**
1. Every file is a plain classic script. No IIFE around existing symbols, no
   `import`/`export`, no bundler.
2. No top-level name may be declared in two files (a duplicate `const` is a
   SyntaxError that kills the later script).
3. A new file must be added to **all five pages** in the same relative slot:
   `index.html`, `rules.html`, `scenario.html` (both regenerated from
   index.html — their comments say so), `editor.html`, `competitor.html`.
4. Load-time code (anything that executes at script evaluation) may only read
   bindings from files loaded **earlier**. Runtime code may reference anything.
   The boot (`resetGame(); requestAnimationFrame(loop);`) stays at the end of
   `js/script.js`, the last script — editor.html/competitor.html/eval stub
   `requestAnimationFrame` before the block and rely on that position.

## File map and ownership lanes

Load order inside the game block (after arena/venuedoc/venue docs/ai-quotes/
water/swell/seafx/icefx/traffic/planner/sailcheck/rules):

| file | contents | lane |
|---|---|---|
| `js/game/core.js` | CONFIG, fonts, RNG streams (`mulberry32`, visuals-only `fxRand`/`snowRand`), mask geometry, angle/segment math, time formatting | shared (rarely changes) |
| `js/game/state.js` | `state` (the master object), `settings` + defaults, venue table/palette, `class Boat` | shared |
| `js/game/audio.js` | `MUSIC_TRACKS`, `Sound` | audio |
| `js/sim/wind.js` | base wind, gusts, island shadows, oscillation, pressure, squalls, `getWindAt`, turbulence, streak/comet layer, gust tone. Sim + its viz deliberately together (highest co-change pair in history, lift 5.8) | physics/world |
| `js/sim/water.js` | current field (`getCurrentAt`), rapids, wind waves, surf | physics/world |
| `js/sim/ice.js` | floes, bot occupancy grid, floe hull queries | physics/world |
| `js/sim/physics.js` | rig/heel/overpowered, J/111 polars, VMG, `updateBoat`, `hullCrossedLine`, `updateBoatRaceState`, progress/rank | physics |
| `js/sim/collision.js` | hull polygons, SAT, boat/mark/traffic/island collisions, rule-19 ledger | physics/rules |
| `js/sim/course.js` | route DSL (`window.Course`), `initCourse`, `buildCoursePaths`, `repositionBoats`, harbor-traffic lifecycle | course/world |
| `js/game/telemetry.js` | trajectory recorder, `runBatchSim` | eval |
| `js/ai/roster.js` | archetypes, traits, stats, **`AI_CONFIG`** (see contract below) | **AI worker** |
| `js/ai/bot.js` | `class BotController` core (constructor, wind tracker, update), `updateAI` plumbing | **AI worker** |
| `js/ai/navigation.js` | `getNavigationTarget`, `getStrategicHeading`, prestart/start | **AI worker** |
| `js/ai/avoidance.js` | `updateRiskAssessment`, `planFloeTrajectory`, `applyAvoidance` | **AI worker** |
| `js/render/sprites.js` | land textures, boat/mark/prop sprite bakes, spinnaker looks | **visuals worker** |
| `js/render/world.js` | props, traffic wakes, island/shoal/veg/reef bakes, world-tile cache, boundary, islands | **visuals worker** |
| `js/render/effects.js` | particles, wakes, night/bio/jelly, water delegation, snow | **visuals worker** |
| `js/render/hud.js` | `drawBoat`, rules overlay, nav aids, minimap, leaderboard, edge indicators, instruments | **visuals worker** |
| `js/ui/screens.js` | Sayings overlay, `canvas`/`ctx`/`UI` cache, race-day board + chart, competitor cards, character picker, venue load & `startRace` flow, settings, records, results | **screens worker** |
| `js/ui/input.js` | resize, keyboard, click-to-init-audio | screens worker |
| `js/script.js` | the hub (~1.2k lines): `update()`, `draw()`, `loop()`, `resetGame()`, boot, water-debug UI, the `window.*` export block | **shared — the expected merge-conflict point; keep edits here rare and small** |

The `js/ai/navigation.js` and `js/ai/avoidance.js` methods are installed with
`Object.assign(BotController.prototype, {...})` — identical behavior for callers
and for probes that wrap prototype methods (the class itself is declared in
`js/ai/bot.js`, which loads first).

## Contracts that tooling depends on (do not break)

- **`const AI_CONFIG = [` … `\n];`** must stay in `js/ai/roster.js`, at column 0,
  matchable by `/const AI_CONFIG = \[[\s\S]*?\n\];/`. Scraped by
  `eval/gen_roster.js`, `gen_archive.js`, `rate_report.js`, `rate_run.js`,
  `tier_model.py`, `tier_grid.py`, `gen_stats.py`, `art/review.py`.
- **`eval/rate_run.js` `AI_FILES`** must list every file that affects racing
  behavior — extend it when adding a sim/AI file (it fails SOFT if you forget).
- The **`Rule 31` comment** must stay inside `updateBoatRaceState`
  (`js/sim/physics.js`) — `eval/test_contact.js` asserts on
  `String(updateBoatRaceState)`.
- All **`window.__*` eval hooks** (`__CHAR __rl __rlCrew __RULES __START __NAV
  __PHYS __COMET __AV __AVDBG __AVLOG __TDBG __TDBG2 __escLog __hero __FLOEFRAC
  __NOFLOES __streakPalette __wtBakes __recEvWrapped __DNS_KEEP_SAYINGS_LEAK`)
  and the explicit `window.X =` exports in `js/script.js` must survive.
- **RNG discipline**: `Math.random` is the seeded SIM stream (the eval harness
  replaces it); `fxRand`/`snowRand` are visuals-only; audio uses its own
  xorshift (`Sound.fillNoise`). Moving or adding a `Math.random()` call site
  changes golden traces. Visual effects living in `update()` must draw from
  `fxRand`.
- `js/sim/wind.js` reads `window.VenueDoc.U_PER_M` at **top level** — venuedoc.js
  must stay above the game block in every page.
- The eval harness needs no changes for new files: `eval/rl/mktree.sh` copies
  `regatta/js` recursively, and every runner boots a page rather than injecting
  js by path. **Never touch `eval/rl/tree*` snapshots** — they are self-contained
  (own index.html + own js/) and mostly unregenerable.

## Cross-boundary couplings (leak fixes landed 2026-08-24)

The five leaks the split documented were closed the same day, all verified
trace-neutral (goldens byte-identical):

1. **Results overlay**: `update()` only raises a hub-local `_resultsPending`
   flag; `loop()` opens the overlay presentation-side. Headless drivers calling
   `update()` directly never touch DOM.
2. **Penalty feedback**: `triggerPenalty` emits `GameEvents.emit('player-penalty')`
   (the internal bus in game/core.js — distinct from `window.onRaceEvent`, the
   eval hook slot); audio and the banner subscribe in their own files.
3. **Leaderboard**: `boat.lbRank`/`prevRank` are RENDER-LOCAL — nothing sim-side
   reads them (`runBatchSim` now picks the winner from finish times; it formerly
   read `lbRank`, which is never set headless, so it counted no winners at all).
   Sayings triggers stay on the render cadence deliberately: their `Math.random`
   draws must never enter `update()`'s seeded stream.
4. **Drifting props & jellyfish**: integrate in `update(dt)` on the sim clock —
   pause-correct, gameSpeed-correct, identical headless and rendered. Both are
   RNG-free and purely visual (drifting props force `contact: none`).
5. **Player input**: `updateBoat` reads a controls struct via
   `sampleKeyControls()`/`NO_CONTROLS` (game/state.js) — the one seam where a
   replay driver, RL crew, or gamepad would plug in. `state.keys` itself is
   owned by ui/input.js.

Still true and deliberate: `Sayings` is AI-triggered but DOM-owning (lives in
ui/screens.js); `window.onRaceEvent` is a single mutable slot that harness code
replaces wholesale — use `GameEvents` for game-internal wiring instead.

## Working in parallel (multiple Claude instances / people)

- Stay in your lane's files; the hub (`js/script.js`) and `js/game/state.js`
  are shared — coordinate before editing them.
- New cross-subsystem symbols are API: add them consciously, and prefer adding
  to the file that owns the data.
- Any change to sim-side files must re-run `npm run trace` (and a golden
  re-record belongs to whoever changed behavior — never re-record mid-way
  through someone else's session).
