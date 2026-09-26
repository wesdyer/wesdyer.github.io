---
name: venue-objectives
description: Design, then build, one regatta venue's character objectives and its four animals (unlocks.js rows, feats, wildlife config, tests, venue-roster.md). Use when Wes says "let's do <venue> next" or asks for a venue's achievements/unlocks/objectives.
---

# Venue objectives — design first, then build

Done so far: Lighthouse Cove (`bay`), Sailing School (`pond`), Stillwater Lake (`lake`),
Pearl Lagoon (`lagoon`), Gatorgrass Bayou (`swamp`), Sockeye Run (`river`), Bluewater
Bonanza (`ocean`), Redrock Reservoir (`redrock`). Remaining: glowtide, arctic, otter, flats, volcanic.
The recommended character map for every venue is in `regatta/guidelines/venue-roster.md`
(the audit plus the "as built" sections). Read that venue's row and the latest "as built"
section before proposing anything.

## Wes's standing rules (never re-ask)

- **Nothing is hidden.** Every objective is spelled out on the silhouette, the venue card and
  the ceremony card.
- **Rungs:** First win · Mechanic · Explorer · Target time (Time Trials) · Four stars, plus
  an optional Wildlife rung. The template bends to the venue: the school had no four-star
  rung because it forces auto trim, so Wisp became "clean report card".
- **Four animal types per venue, except the Sailing School's pond** (Wes, Sep 25 2026 —
  it was three). At least one is the subject of an objective (Explorer or Wildlife); the
  rest can be scenery.
- **Target time** = the mean of Wes's recorded trajectories × 1.1, rounded UP to the next 5 s
  (`node regatta/eval/set_venue_targets.js [--write]`). Every course has `course.cutoff: 600`.
  Wes records new trajectories only after all the achievements are done.
- **Golden traces:** do NOT re-record. Every new roster entry changes fleet draws; Wes will
  say when.
- Characters are real wildlife of the venue, at least partly aquatic.

## Phase 1 — Design (stop and discuss with Wes before building)

1. **Read the venue as built:** `assets/venues/<key>.venue.js` (course, marks, shapes, props,
   wind regions), its `guidelines/*` design doc, and the venue-roster row.
2. **Find the venue's mechanic** in the code, not in the old spec (the tide at the Flats,
   rapids on the river, eruptions at Emberfall). A mechanic objective must be something the
   sim can judge.
3. **Look at Wes's own recorded races** (`regatta/eval/rl/traj/traj_<venue>_*.json`; each
   sample's [2], [3] is the player's x, y; group by `venueFingerprint`, since the course
   changes). Overlay them on the venue with the fleet's tracks. At the Bayou his fastest route
   was one no bot ever takes, and it defined the mechanic.
   `node regatta/eval/_venue_map.js <venue> out.png [survey tracks...]` draws the chart
   (land, current, rapids, marks, props, Wes's races in red, the fleet in orange; FP= picks
   fingerprints, BOX= crops). `eval/_venue_survey.js <venue>` runs the fleet and dumps tracks
   (TRACKS=prefix). Split the race BY LEG before looking for the mechanic: at Sockeye Run one
   leg decided everything, and the fleet never took an arm Wes took six times in nine.
   ⚠️ A probe that reads a venue field (current, rapids) must `resetGame()` on that venue
   first. `_river_legs.js` once read Wes's races against the default venue and reported no
   rapids at all.
4. **Measure feasibility before proposing a threshold.** Write a headless probe
   (`eval/_<venue>_<thing>.js`, following `eval/_lake_glass.js` / `eval/_cove_cross.js`)
   that runs the autopilot and the fleet, and logs the quantity the objective reads. Two
   thresholds were wrong until measured:
   - **Glass pass:** 2 kn was free, since the autopilot never drops below 3.4 kn, so it is
     4.5 kn.
   - **Bow crossing:** it was never free, since the autopilot comes no closer than 211 units.

   A threshold should sit where it takes deliberate sailing: not free, not impossible.
5. **Pick the four animals.** Choose real species of the place and give each one a behaviour
   kit (see the `venue-wildlife` skill), plus the prop or shape it lives on. Offer Wes shape
   or prop ids to pick from; he often chooses the spot himself (shape-36, shape-39, the log he
   placed).
6. **Propose** a table: rung → character (species) → objective in player words → how it is
   judged → measured feasibility. Give one recommendation per open choice, not a menu.

## Phase 2 — Build

1. **Rows in `js/game/unlocks.js`:** add a section comment with the venue key, the date and the
   animals. Rows look like `{ char, venue, rung, title, hint, test }`; the target rung's
   `hint` is a function of the target (copy the Lake's Gasket row).
   - **Feats:** judged elsewhere and emitted as `GameEvents.emit('player-feat', { id:
     '<venue>:<thing>' })`. Emit only while `state.race.status === 'racing'`, only for the
     player, only before they finish, once per race.
   - **A feat can carry a value:** `emit('player-feat', { id, value })`. The latest value
     per race is kept in `r.vals`. That covers "how many alligators", or "which passage":
     a finished race's `'<venue>:route'` value is added to `career.venues[venue].routes`,
     for objectives that accumulate across races (Croak's three passages). Give those rows
     a `progress(c)` so the picker shows N of M.
   - ⚠️ **Never add fields to raceState.** Every raceState primitive is in the golden-trace
     hash; use GameEvents or `state.race.unlocks` instead.
2. **Mechanic checks** go in `js/sim/course.js` beside `checkBowCrossing` / `checkGlassPass`,
   called from `update()` in `script.js`. That file is 22k lines of look-alike loops: splice
   only on unique anchors and back it up first.
   ⚠️ **Every script is a classic script: a top-level `function NAME` is a global, and a
   second one anywhere replaces the first everywhere.** On Sep 25 2026 a 4-argument
   `segCross` added to course.js for the Bayou gates replaced collision.js's 8-argument one,
   and boats hit phantom walls (Sockeye Run went from 8 finishers to 0). Give helpers a
   specific `_venueThing` name, `grep -rn "function NAME" js` first, and run
   `eval/test_globals.js`, plus a golden-trace spot check (`run_traces.js --venue river`)
   after touching sim code.
3. **Wildlife:** add a `WILDLIFE.<venue>` config in `js/wildlife.js`, and new draw functions
   if the animals are new. Follow the `venue-wildlife` skill: references, scale, bench,
   in-scene.
4. **Test file** `eval/test_<venue>.js`, modelled on `test_cove.js` / `test_lake.js`. Check
   that:
   - the animals sit where they should;
   - `Math.random` is never called;
   - a bot does not earn the feat;
   - no feat is earned before the gun;
   - the player racing earns it, and a near-miss does not.
5. **Characters with no art yet** still get live rows; earning is remembered until they ship
   (`Unlocks.shipped`). Add each one to the `unshipped` list in `eval/test_unlocks.js`, then add
   manifest portrait entries so Wes can generate them (see the `ship-character` skill).
6. **Docs:** add a "<Venue>, as built (date)" section to `guidelines/venue-roster.md`, and bold
   the shipped characters in its map.
7. **Run:** `test_<venue>`, `test_globals`, `test_unlocks`, `test_pages`, and the other venue tests
   (`test_cove`, `test_pond`, `test_lake`), from the repo root: `node regatta/eval/<t>.js`.
8. **Update memory:** the regatta-venue-objectives note, with the venue done and the
   decisions Wes made.

## Pitfalls seen

- Stale browser cache made working code look broken. Reload with cache bypass, or serve
  on a fresh port.
- Venue files: Wes edits them live in `editor.html`. Never revert them; tell him to reload
  the editor before he saves over a file you changed.
- When Wes reports something missing, first render the exact view he means (headless
  screenshot) before editing code. It was a stale tab once (Timber in the Fleet view).
- A probe that comes back negative can be the probe's own bug (a name matcher that looked
  for heading tags). Check it against a known positive first. The reverse happens too:
  - At the Lagoon a probe read `VenueDoc.SHAPE_KINDS`, which doesn't exist; the API is
    `VenueDoc.traits(shape)`. It saw no walls at all and called two reef-bound islands
    circleable.
  - A test that asserts something must be true of the venue should also assert it catches a
    known wall.
- **A "clean" objective is a feat you must NOT get.** Snag's row is `finished &&
  !feats.includes('river:scraped')`, and `js/sim/collision.js` emits `player-contact` for it.
  Reuse that event rather than wrapping `window.onRaceEvent`, which belongs to the eval harness.
- **An ambient animal that hunts another needs one in reach.** Two of the three river eagles
  first circled more than 900 u from any salmon run, so they would never have stooped.
  `test_river.js` asserts reach.
- **Prove an explorer spot is sailable before building on it.** Use rings round it against
  every wall (`hard` or `reef`), as `eval/_lagoon_ring_probe.js` does. Islands on an atoll's
  rim can't be circled; that's why Landfall is reef to reef.
- **A physics change Wes asks for mid-design** (the Lagoon's squalls) goes in the venue doc's
  own block, so the records hash resets the book. Re-measure the mechanic after it, never
  before.
