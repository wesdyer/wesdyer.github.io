# Venue Editor — Build Plan

*Working plan, not design reference. Venue design lives in [venues.md](venues.md);
art rules in [venue-art.md](venue-art.md); the Arctic build in
[glacier-sound-plan.md](glacier-sound-plan.md).*

The editor exists to unlock **fixed courses**. Today a venue is either fully
randomized (nine venues) or hand-wired into `initCourse` with hardcoded logic
reading green pixels off a mask (Glacier Sound). Neither scales. The editor makes
a venue a *document* you author, and the game a thing that *reads* documents.

**Standing constraint:** Sea Trial Bay is the eval anchor and must not change.
It has no document and never gets one — it takes the generator path, and the gate
on every phase is that its numbers are byte-identical:
`100t → Race 213.30/209.72, Pen 0.30, collB 0.56, DNS/DNF 0%`.

---

## 0. The refactor this actually requires

Measured coupling, because it sets the size of the job:

| Coupling | Count | Where |
|---|---|---|
| `state.course.marks[0..3]` by literal index | **60** | `script.js` (51) + `rules.js` (via `mIdx`/`activeMarkIndex`) |
| `state.course.islands` / `navIslands` | 42 | collision, avoidance, pathfinding, wind shadow, render |
| `boundary.radius` (world is a **circle**) | 13 | placement, drift, render, minimap, `rayCircleIntersection` ×2 |

**`marks[0..3]` is a windward-leeward course encoded as a data structure**, and it
is the thing blocking every future course. `[0]`/`[1]` are the start line,
`[2]`/`[3]` the windward gate. Triangle needs three marks, Trapezoid four to six,
Round the Cans N, Slalom N gates with sides. None of them fit.

It already misbehaves. `islandRound` parks two **fake** marks beside the granite
island — not because the course has them, but because sixty sites index `[2]` and
`[3]` and would throw otherwise. That is what produced the phantom gate at the
rounding, and it is the shape of every bug this array will cause from here.

So it goes. The replacement:

```js
state.course.marks = [            // physical objects, any number
  { id: 'sf',    kind: 'line',     a: {x,y}, b: {x,y} },
  { id: 'rock',  kind: 'rounding', x, y, radius, zone },
  { id: 'lee',   kind: 'gate',     a: {x,y}, b: {x,y} },
]
state.course.route = [            // ordered passage instructions
  { markId: 'sf',   pass: 'cross', dir: 'up' },
  { markId: 'rock', pass: 'round', side: 'starboard' },
  { markId: 'sf',   pass: 'cross', dir: 'down', finish: true },
]
```

Leg *n* is `route[n]`. `activeMarkIndex` becomes `route[legIndex].markId`. Laps are
a repeat count over a route slice rather than a modulo on a four-element array.
Both existing course types fall out of it, `roundMark` stops being a special case
parallel to `marks`, and `drawMarkZones` selects by route position instead of
guessing indices from leg number.

### How to do 60 sites safely

Not by being careful. By building the net first.

**Characterization tests before any refactor.** The eval harness is already a
deterministic, seeded, whole-system oracle — that is exactly what this needs, it
just needs to run per-venue and record more than summary stats:

1. **Golden traces.** For each venue at fixed seeds, run N sim steps and hash the
   full observable state — boat positions/headings, leg indices, penalties, mark
   roundings. Commit the hashes.
2. **Refactor.** Hashes byte-identical ⇒ provably behaviour-preserving. Any drift
   points at a specific venue and step.
3. **Sea Trial Bay stays the headline gate** on top of that, unchanged.

`playwright` and `jsdom` are already dev deps, so the infrastructure exists and is
currently unused for anything but the AI eval.

This test net is worth building regardless of the editor — it is the thing that has
been missing every time a session claimed a regression from a stale baseline. It is
the first phase for that reason, not just as refactor cover.

---

## 1. Land: vector as source of truth

Agreed direction, and it's the right one. The argument that settles it:

**Local edits stay local.** With the raster as truth, every stroke re-bakes and
re-simplifies the whole shape, so nudging one headland shifts vertices across the
entire coastline. The diff is global for a local change. As vectors, you move what
you touched.

Three more that follow:

- **Identity is stable.** Today a shape's identity is its connected-component
  order in the raster, re-derived on every bake. Bridge two islands with one pixel
  and they merge, every index shifts, and `mask.granite` silently points somewhere
  else. As vectors each shape has a persistent `id` and carries its own class,
  `soft` flag and style.
- **No lossy round trip.** What you author ships. Polygons are currently an
  approximation regenerated every bake at `EPSILON = 2.2`.
- **The runtime already wants vectors.** `pointInPoly`, `circlePolyCollide` and
  `inMaskWater` all consume polygons. `buildMaskGeography` exists purely to convert
  one representation to the other. Vector-as-truth *deletes* that function.

### Real holes, not keyholes

The current main landmass is a **keyholed ring** — the Moore trace walks into the
sound and back out along a one-cell seam. That is why every fill needs
`evenodd`, and why `pointInPoly` and the canvas disagreed until the winding was
matched. It would also be miserable to edit: dragging near the seam tears the shape.

The document stores proper polygons-with-holes:

```js
{ id: 'main-coast', cls: 'snow', soft: true, style: 'ice',
  outer: [[x, y], …],
  holes: [ [[x, y], …] ] }
```

Cleaner to edit, cleaner to render, and it retires a bug we hit twice.

### Coordinates: world units, not normalized

The mask is normalized 0..1 so it can map to any world size. The document should
be in **world units**.

The reason is the 3–5 minute target. Course design is a question about *time*, so
the editor should be able to say "this leg is 2:40 at target upwind VMG" — which
requires real distances. It also makes the scale explicit: `MASK_WORLD` went
12500 → 25000 → 8750 this month, and each change silently rescaled every derived
number. A bulk scale transform in the editor is a better way to do that than a
constant that reaches into everything.

### The mask becomes a one-way importer

`bake_mask.py` keeps its job — trace, simplify, classify — but its output is now a
**seed**, read once at import and never again. Re-importing is destructive and
replaces the vectors; the editor should say so plainly, because the failure mode
is losing an afternoon of tuning.

The green start line migrates *out* of the mask. Painting a course line into a
land mask conflates two different kinds of fact. The line becomes a document
object you drag, which is also how you get the width right — currently the painted
line is overridden by a hardcoded `w0 = 1100` two lines after it's read.

### The new cost: vectors can be invalid

A raster is always topologically sound. A dragged vertex is not. The standard
validity rules ([PostGIS](https://www.postgis.net/workshops/postgis-intro/validity.html),
[GDAL](https://gdal.org/en/stable/user/geometry_validity.html)) give the checklist:

- rings simple — no self-intersection, no repeated points
- holes strictly inside their shell
- rings don't touch other rings except at a point
- consistent orientation (shell one way, holes the other — note canvas is y-down,
  so visual handedness is flipped from the textbook)
- interior path-connected (no pinched-off lobes)

This becomes part of the validation panel (§4), and the runtime must tolerate a
briefly-invalid shape mid-drag rather than throwing.

---

## 2. The document

One file per venue, `venues/<key>.venue.js`.

**Emitted as JS assigning to a window global, not JSON.** Non-negotiable and easy
to forget: the eval harness loads the page over `file://` where `fetch` is
blocked by CORS. `bake_mask.py` already learned this the hard way and says so in
its output header.

```js
window.VENUE_DOC = window.VENUE_DOC || {};
window.VENUE_DOC['arctic'] = {
  schema: 1,
  world:  { size: 8750, boundary: { kind: 'circle', x: 0, y: 0, r: 4375 } },

  land: [
    { id, cls: 'snow'|'granite'|…, soft: bool, style: 'ice'|'granite'|…,
      outer: [[x,y],…], holes: [[[x,y],…]] }
  ],

  course: {
    marks: [
      { id: 'sf',   kind: 'line',     a: [x,y], b: [x,y] },
      { id: 'rock', kind: 'rounding', landId: 'granite-isle', zone: 1.9 }
    ],
    route: [
      { markId: 'sf',   pass: 'cross', dir: 'up' },
      { markId: 'rock', pass: 'round', side: 'starboard' },
      { markId: 'sf',   pass: 'cross', dir: 'down', finish: true }
    ],
    laps: { repeat: 1 }                       // or { repeat: 3, slice: [1, 3] }
  },

  wind: {
    mode: 'fixed'|'sector',
    baseDirection: <rad>,                     // or sector: { centre, spread }
    zones: [ { x, y, rx, ry, rot, speedDelta, dirDelta } ]   // Phase 2 of Arctic
  },

  spawn:  { mode: 'lanes', backOff: 55 },
  props:  [ { id, kind, x, y, rot, scale } ],
  seeded: { ice: { density, bias } }           // what stays randomized
};
```

Notes on specific fields:

- **The start line is authored**, as a `kind: 'line'` mark. Today it is painted,
  then thrown away and re-laid at a hardcoded width 1100 along the painted axis.
  Authoring it directly removes a step and lets the editor show the line at true
  scale against the fleet that has to fit on it.
- **`wind.baseDirection` is authored, not derived.** Today it's computed square to
  the painted line, with a sign flip decided by which side the granite island sits
  on, and a *second* flip to order the line's vertices so the crossing normal
  points up-course. That inference chain broke twice. Authoring the direction and
  *drawing the arrow in the editor* makes it a thing you see rather than a thing
  you derive.
- **`seeded`** is the boundary between designed and randomized. Land, marks and
  lines are designed; ice, gusts and traffic stay generated per-seed. Keeping that
  split explicit in the document is what stops "fixed course" from meaning "same
  race every time."

### `boundary.kind` — what the arena edge is shaped like

The **boundary** is the invisible wall that keeps boats in the race area, plus the
extent used for scattering ice, bouncing drift, drawing the limit line, and sizing
the minimap. It is a **circle** today, in 13 places.

A circle is right for a generated venue in open water — there is no natural edge,
so a soft round one is honest. It is wrong for a painted map. Arctic's boundary is
`MASK_WORLD * 0.5`, the circle *inscribed* in a square map, so the painted map's
corners fall outside the arena. That is the direct cause of two complaints: ocean
visible past the cut-off land, and the minimap not showing the whole map.

**One representation: a polygon.** Circle and rect are *drawing tools* that emit
one — an N-gon and a 4-gon. No union type in the runtime, and the boundary becomes
a placeable object like any other: drawn, dragged, and reshaped in the editor
rather than derived from `MASK_WORLD * 0.5`.

Most of the 13 sites get simpler or stay even:

| Today | Polygon |
|---|---|
| `rayCircleIntersection` ×2 to render the limit | stroke the path — *simpler* |
| `dist > radius + 100` outside test | `pointInPoly`, already written |
| `radius - 150` inset | distance-to-nearest-edge, ~10 lines |
| minimap extent, `radius * 2` "full map" | bounding box |

### ⚠️ The one that isn't free: uniform sampling and the RNG stream

Four sites scatter objects with `Math.sqrt(rng()) * boundary.radius` — the
standard uniform-disc trick, which consumes a **fixed** number of `rng()` calls
per placement. The polygon equivalent is rejection sampling inside the bounding
box, which consumes a **variable** number.

That changes the RNG stream, which changes every generated venue, **which moves
the eval anchor.** Sea Trial Bay's numbers would shift for a reason that has
nothing to do with sailing.

So the boundary carries its analytic form when it has one:

```js
boundary: { poly: [[x,y],…], circle: { x, y, r } | null }
```

`poly` is the truth for containment, inset, render and minimap. `circle` is a
sampling fast path — present when the boundary was authored as one, absent when
it was drawn freehand. Generated venues keep the exact disc math and the exact RNG
consumption they have today; authored venues rejection-sample, and their ice
placement is seeded separately anyway.

Not a union type in the ugly sense — a cached analytic form alongside the
canonical geometry, kept for a specific measurable reason.

### Authored vs derived

Designed venues author the boundary in the document. Generated venues must keep
deriving it (`Math.max(3500, dist + 500)`), because their course scales with leg
length and rotates with the wind — a fixed boundary there would clip the course.

---

## 3. Editor architecture

**`editor.html`**, plain script tags, no build step — matching `competitor.html`
(133 lines, loads `js/script.js` directly). The repo has no bundler and shouldn't
grow one for this; `package.json` carries one script (`eval:ai`) and two dev deps.

```
editor.html
js/editor/doc.js       document load / save / validate / migrate
js/editor/history.js   undo
js/editor/tools.js     select, vertex, sculpt, line, mark, prop
js/editor/view.js      pan/zoom schematic render
js/editor/panels.js    inspector, validation, roster
```

### Undo: snapshot, not command pattern

The literature says command pattern ([Game Programming Patterns](https://gameprogrammingpatterns.com/command.html)),
and at scale it's right. Here it isn't, and the reason is measurable: Glacier
Sound is ~9 shapes and ~300 vertices — roughly **5 KB of JSON**, under 20 KB with
props. Deep-cloning the document per committed edit gives 100 undo levels for
~2 MB.

Snapshot undo is ten lines and cannot get the object-lifetime bugs the command
approach is known for (undoing a delete of a thing that was moved first). Both
approaches need drag coalescing — a sculpt stroke commits one entry on mouse-up,
not one per mouse-move — so the command pattern's usual advantage doesn't apply.

Revisit if a venue document ever exceeds ~1 MB. It won't.

### Two view modes

- **Schematic** — pan/zoom, vector outlines, marks, laylines, wind arrow, grid,
  distance/time readout. This is where the work happens.
- **Preview** — the actual game render, locked at 1:1. **The renderer assumes
  1 world unit = 1 screen pixel** (the camera is translate-only, no zoom) and
  `plates.js` must stay at dsf 1. Preview does not zoom; it pans.

Keeping these separate is what avoids fighting the renderer's scale assumption.

### Land editing tooling

Vertex-by-vertex on an organic coast is a chore — the main landmass is 79 vertices
*after* aggressive simplification. The tools that make it bearable:

| Tool | Why |
|---|---|
| **Sculpt brush** | drag with a radius, push vertices with falloff. The one that makes vector land feel like painting. Without it the editor gets avoided and the mask quietly becomes truth again. |
| **Smooth brush** | pull vertices toward the local average — cleans up sculpt chatter |
| **Vertex** drag / insert / delete | precision work |
| **Move / rotate / scale shape** | the capability raster never had |
| **Scale whole map** | one factor applied to all land + marks + lines. Replaces editing `MASK_WORLD`, which silently rescaled every derived number. Prop sprites don't scale with it — accepted. |
| **Resample** | redistribute vertices evenly along a ring after heavy sculpting |
| **Draw / delete shape** | new land from scratch, not only imported land |
| **Add / remove hole** | a lagoon, a sound, a lake in an island |
| **Split / merge shapes** | the operations that mask painting made trivial and vectors make hard |
| **Measure** | distance and estimated leg time between two points |
| **Boundary** | draw freehand, or drop a circle / rect that emits a polygon; then drag it like any other shape |

Everything above is v1. The set is deliberately generous because the failure mode
is a tool that is *almost* good enough to use — the moment an edit is easier to do
by repainting the mask, the vector document stops being the source of truth in
practice regardless of what the architecture says. More tools get added as they're
wanted.

### Saving

`showSaveFilePicker` (File System Access API) writes in place from a local page,
which is the whole problem solved in about fifteen lines, and this is a Chrome
workflow already. Fall back to a blob download if unavailable. No dev server.

---

## 4. Validation panel

This is where this month's manual probes become permanent, and it's the part most
likely to pay for itself. Each check below corresponds to a bug that actually
shipped.

**Geometry**
- polygon validity per §1 (self-intersection, hole containment, orientation)
- no land shape outside `world.boundary`

**Navigability**
- **rounding clearance** — measured gap between the rounding island and every
  other landmass, against hull diameter. *The granite island sat 43u from the
  coast with a ~56u hull: literally unroundable, 4377 groundings per boat.*
- start line clear of shore at both ends across its full width
- a water path exists start → rounding → finish (flood fill the water region)

**Placement**
- every spawn lane in water and behind the line
- seeded ice/props sample the real polygon, not a bounding radius. *Bounding-radius
  reasoning on a concave mask broke floe placement, collision, and wind shadow —
  three separate times — because the landmass bounding circle covers half the world.*

**Course**
- start-line crossing normal points up-course (vertex order)
- leg length → estimated time, against the 3–5 minute target
- laylines from the start line clear land

**Render**
- fills use `evenodd` where holes exist

---

## 5. Phases

Each ships and reverts independently. Eval anchor gated at every one.

### Phase 0 — The test net ✅ DONE

**Built:** `eval/trace_harness.js` (in-page, hashes every primitive on every boat,
raceState and controller each frame), `eval/run_traces.js` (driver: verify /
update / determinism / per-venue subset), `eval/golden/traces.json` (30 traces —
10 venues × 3 seeds × 300s), and `editor.html` (shell + roster + read-only course
schematic).

```
node regatta/eval/run_traces.js                 verify against golden
node regatta/eval/run_traces.js --update        re-record
node regatta/eval/run_traces.js --determinism   same-page repeat, leak detector
node regatta/eval/run_traces.js --venue arctic  subset (must match full sweep)
```

**The gate immediately failed — 4 of 10 venues were non-deterministic**, including
`seatrials`, the eval anchor. Two genuine bugs, both now fixed:

1. **Visual particles were drawing from the simulation RNG.** Particle spawning
   lives in `update()`, not `draw()`, so it used `Math.random`. The spawn point is
   sampled near `state.camera`, and the follow-up draws are *conditional* on
   what is there (`if (local.speed > 0.15)`). Look somewhere else → a different
   *number* of draws → the whole stream shifts. The camera is never reset between
   races, so **race 2 in a session raced differently from race 1**, and the AI
   eval — 100 trials in one page — carried each trial's final camera position into
   the next. Fixed with a dedicated `fxRand` stream (`script.js`, next to the
   `snowRand` precedent).
2. **Glacier Sound clobbered the player's Course Distance setting.** The mask
   branch did `state.race.legLength = cl`, but `legLength` is the config slider's
   value and `resetGame` deliberately preserves it. So racing Arctic silently
   resized every subsequent venue's course. The island cutoff is measured from the
   real start→mark distance anyway, so the assignment was dead. Removed.

After both: **10/10 deterministic**, and `seatrials` now hashes identically to
`bay` — correct, since both are pure defaults, and previously masked by the
`legLength` leak.

**Consequence:** the documented eval anchor (`Race 213.30/209.72, Pen 0.30,
collB 0.56`) was measured on a contaminated stream and must be re-baselined.

**Design notes worth keeping:**
- Goldens use a **fresh page per trace**, so a subset run matches the full sweep
  (verified). `--determinism` deliberately reuses one page — that mode exists to
  catch exactly the cross-race leaks above.
- `OBS_VERSION` in the harness is recorded in the golden, so changing *what* is
  observed reports "observation changed" instead of faking a regression.
- Hashing every primitive matters: the first divergence in `river` looked like a
  tiny heading difference, but widening the observation moved it 2500 frames
  earlier to `turbulenceTimer` — whose values were shifted by exactly one boat,
  which is what identified an RNG-stream offset rather than a physics change.

### Phase 1 — The marks refactor ✅ DONE

`state.course.route` is now the single source of truth for what each leg targets.
`buildRoute(type, totalLegs)` emits one entry per leg —
`{ kind, marks:[i,j], dir, beat, role, finish }` — and every consumer reads it
through `routeLeg / legMarks / legDir / legIsBeat / legTargetsWindward / legMid /
courseAxis / startLineMarks / finishMarks`, exposed to `rules.js` as
`window.Course` (it loads first but runs later).

Leg parity now appears in exactly **one** place: inside `buildRoute`, which is the
definition of what a windward-leeward *is*. It was previously in about a dozen
consumers plus `rules.js`.

**Six sites recomputed the course axis** (start-line midpoint → windward-gate
midpoint) from `marks[0..3]`; that is now `courseAxis()`. It falls back to the
rounding mark when a course has no windward gate, which is byte-identical for
Glacier Sound because its two placeholder marks straddled the granite island
symmetrically — their midpoint already *was* the island centre.

**The placeholder marks are gone.** `islandRound` now has two marks, not four.

#### Three bugs found, all the same shape

Mark selection was **enumerated** rather than derived — `leg === 1 || leg === 3`,
`leg === 2 || leg === 4`, `leg === 0 || leg === 2 || leg === 4` — in the AI's
target selection, its past-the-gate test, and the waypoint/zone block. The legs
slider goes to **10**.

Measured on a 6-leg course before and after: **max leg reached 5, zero finishers**
across 18 traces → **max leg 7, 132 finishers**. On any course longer than four
legs the AI could not finish at all; it sailed to the leeward line while beating,
never completed leg 5, and the race timed out. 4-leg traces were bit-identical
across the fix, which is why nothing ever caught it.

A fourth was hiding behind a length guard: the waypoint/zone block was gated on
`marks.length >= 4`, so a two-mark course skipped it and stopped resetting
`raceState.inZone` each frame, leaving a stale value feeding the mark-room rules.

#### What the traces said

- All 9 W/L venues × 3 seeds: **byte-identical** through every step.
- arctic ×2 seeds: *behaviour identical, geometry changed* — the exact signal
  `courseGeomHash` was built to give.
- arctic ×1 seed: behaviour changed, and the cause was pinned precisely —
  **islands 59 → 60**. Floe placement rejects candidates within `450 + r` of any
  mark, so the placeholders had been carving an invisible ice-free bubble around
  the rounding island. Removing them lets ice pack the mark, which is what the
  venue wants. The other two seeds had no candidate land there, which is why they
  were unaffected.

**Coverage added:** `--legs N` on the trace runner, with `golden/traces-6leg.json`
alongside the default. Leg count is not persisted in settings, so without it every
trace ran 4 legs forever and legs 5+ were untested.

### Phase 2 — Documents ✅ DONE

**Built:** `js/venuedoc.js` (load / validate / compile), `assets/venues/arctic.venue.js`
(the document — vector land in world units, authored marks, route and wind),
`art/export_venue_doc.js` (one-time mask → document importer),
`eval/test_venuedoc.js` (18 assertions, `npm run test:venue`).

**Deleted:** `buildMaskGeography`, the mask branch of `initCourse`, the wind
derivation, the start-line re-laying, and the green-pixel parsing. Nothing derives
geometry at runtime any more, and `arctic-geo.js` is no longer loaded by the game —
it survives only as the importer's input.

**Gate met:** all 50 traces (30 at 4 legs + 20 at 6) byte-identical, including
`courseGeomHash`. The migration is provably faithful.

#### There were no keyholes

Measured before doing the work: all six Arctic land rings have **zero repeated
vertices**, and each ring's polygon area matches its pixel area to within 1–9%
(`0.986, 0.969, 0.956, 0.959, 0.931, 0.913`), consistently wound. The water reaches
the image edge, so the land is simply connected. The "keyholed ring" hazard I
recorded earlier does not hold for the current mask — corrected in §6.

That removed a chunk of planned work, but left a real latent bug: `bake_mask.py`
only ever traced a component's **outer** boundary, so a mask that fully enclosed
water would trace as solid land and say nothing about it. Fixed — enclosed water is
now detected by flood-filling inward from the image border and assigned as a hole to
the *smallest* containing ring.

#### Rounding the document changed the race

The first export rounded coordinates to 6 decimals. Traces failed: boat headings
diverged by ~1e-4 by t=180s. A 1e-10 relative change in a mark position compounds
through a chaotic sim into a measurably different race. **Authored geometry is
stored at full precision** — `JSON.stringify` already emits the shortest
round-trippable double.

A second trap followed: the exporter originally read the finished course out of the
running game, which silently became a no-op the moment `initCourse` started reading
the document — it began re-exporting itself. It now derives from the geo file in
pure Node, and *asserts* it reproduces the previous document to within 2e-6, which
is a real check on the replicated wind/vertex-order chain.

#### Testing what Arctic cannot reach

Arctic has no holes, so hole support and the topology validators would have shipped
untested. `test_venuedoc.js` builds a synthetic mask — a land annulus with an
enclosed lagoon — and asserts the hole survives mask → geo → document → runtime
island, that a sound document validates clean, and that each validator actually
fires: escaped hole vertex, duplicate id, unknown rounding target, bad side, route
mark out of range, degenerate ring, wrong schema, bowtie self-intersection (with a
square and a concave L accepted).

### Phase 3 — Read-only editor ✅ DONE

**Built:** `js/venuecheck.js` (the check engine — findings are *data*, carrying
geometry so they can be drawn), a Checks panel in `editor.html` where selecting a
finding highlights the offending shapes / points / measured gap on the schematic,
and `eval/check_venues.js` (`npm run check:venues`) so the same engine runs
headlessly and can fail a build.

`venuecheck.js` is loaded by the editor only — the game does not need it, and
`index.html` deliberately does not reference it.

#### Gate met: the checks found real defects unprompted

On Glacier Sound, **5 warnings / 7 ok**, and the warnings are the two problems that
were previously only noticed by staring at a screenshot:

- `coast` 11/84, `isle-2` 12/14, `isle-4` 1/8 vertices **beyond the arena edge**.
- **Arena vs map:** a circular arena of r=4375 covers 79% of an 8750×8750 map —
  **21% of what was painted is out of bounds.** This is the inscribed-circle
  problem, quantified. It is what `boundary.poly` is for.
- **Race length** 7:07 against the 3–5 min target.

#### Two things the checks settled

**The fleet-stacking bug is gone.** Measured: 10 boats spanning 757u of an 1100u
line, gaps of 68–96u (min 68u vs a 60u hull), all ~400u behind the line, across-line
extent only 112u. That was listed as "the biggest remaining blocker to racing it";
it is a proper lane layout now. The note was stale.

**Rounding clearance passes at 738u.** The island was moved to open water in an
earlier session, and the check now confirms it rather than taking it on trust —
the same check would have caught the original 43u gap against a 56u hull.

#### Principle applied

**Passing checks are reported, not silenced.** A check that only speaks up on
failure is indistinguishable from a check nobody wrote, and the whole reason this
panel exists is that no one could tell which probes had actually been run. So
"0.0% of water unreachable (3 of 10242 cells)" and "all 54 floe centres are in
water" are shown as `ok` rows rather than omitted.

#### The checks

| Check | Catches |
|---|---|
| Document validity | delegated to `VenueDoc.validate` — self-intersection, hole containment, ids, route references |
| Land outside boundary | decoration a boat can never reach; worse, water that *looks* sailable |
| Arena vs map | how much of the painted map the arena discards |
| Rounding clearance | measured polygon-to-polygon gap vs hull width — the unroundable island |
| Rounding zone vs island radius | a "rounding" satisfiable without going round anything |
| Start line clearance | an end tight to the beach makes that end unusable |
| Start line orientation | crossing normal pointing the wrong way — invisible until sailed |
| Navigability | flood fill: is the rounding zone reachable from the start by water |
| Unreachable water | water inside the boundary that is cut off |
| Fleet spread | along **and across** the line — a column has a healthy along-line spread if you never measure the other axis |
| Drifting ice on land | polygon test, never a bounding radius |
| Race length | against the 3–5 min band |

### Phase 4 — Editing ✅ DONE

**Built:** `js/editor.js` (the editing app, extracted from `editor.html`), a tool
palette, snapshot undo/redo, save via the File System Access API with a download
fallback, and `eval/test_editor.js` (`npm run test:editor`, 30 assertions).
`npm test` runs the document tests, the editor tests and the venue checks together.

Tools: **select/move** (drag = move, Shift+drag = rotate, Alt+drag = scale about
the centroid), **vertex** (drag, double-click an edge to insert, Delete to remove),
**sculpt**, **smooth**, **marks & zone**, **boundary radius**, **measure** (reports
distance and the leg time it implies), plus **resample** and **scale whole map**.

#### The architecture that matters

**Edit the document; let the GAME recompile the course.** On drag the document is
drawn directly (fast path); on commit it is installed and `resetGame()` rebuilds
from it, so the checks and the floe layout describe exactly what would be raced
rather than a second interpretation of the document. The tests assert this loop
specifically — an edit that mutates the document but never reaches the compiled
course is the failure mode most likely to go unnoticed.

**One undo entry per drag**, coalesced on mouse-up. Snapshot undo confirmed cheap:
the document is **12.5 KB**, so 100 levels is ~1.2 MB.

#### Two bugs the work surfaced

**The document was not self-consistent.** `bake_mask.py` rounds `c`, `r` and `ring`
*independently* to 5 decimals, so a shape's baked radius disagreed with its own
vertices by up to **0.044u** — and the first edit silently "corrected" it, shifting
an island radius that feeds placement, wind shadow and pathfinding. `c` and `r` are
now **derived** from `outer` at import and re-derived on every edit, so the two can
never drift. Traces flagged arctic (0.01u position shifts), which was the intended
one-time migration; re-recorded. `test_venuedoc.js` now asserts derivability.

**Scaling the map was shrinking the start line.** Line length is set by the
*fleet* — ten boats need ~1100u or lane neighbours end up closer than a hull width
and the start jams structurally — not by the geography. At 60% the tightest lane gap
fell to **43u against a 60u hull**, and the fleet-spread check reported it
immediately, unprompted. `scaleMap` now moves the line's midpoint and preserves its
length (and its vertex order, which sets the crossing normal).

That second one is the clearest evidence the checks are worth having: a design bug
in a brand-new tool, caught by a check written before the tool existed.

#### Glacier Sound, demonstrated in the editor

Scaling to 60% and growing the arena to circumscribe the map takes it from
**5 warnings to 2**, entirely through the tools and without touching the mask or
the code:

| | before | after |
|---|---|---|
| Race length | 7:07 (out of band) | **4:16 (in band)** |
| Land outside arena | 3 shapes | **none** |
| Trade-off | — | 37% of the arena becomes off-map water |

That last row is why `boundary.poly` matters: a circle either clips the corners of a
square map or admits empty water. **Not applied to the shipped document** — course
length is a design decision, and it is yours to make.

### Phase 4b — Polygon arena ✅ DONE

**Built:** `js/arena.js` — the boundary as a *shape* rather than a radius, with
`contains / signedDist / clamp / outward / sample / rimPoint / rayHit / extent /
rectPoly / boundingCircle`. Eleven runtime sites migrated. `eval/test_arena.js`
(33 unit assertions) and `eval/test_boundary_race.js` (races circle, rect **and a
rotated octagon**, asserting boats, floes and brash all stay contained).

**The arena is now the map rectangle for painted venues** — the edge of the mask
*is* the boundary. Glacier Sound went from **5 warnings to 1** (only race length,
which is a design decision):

| Arena | painted map sailable | arena that is off-map water |
|---|---|---|
| inscribed circle (was) | 79% | 0% |
| circumscribed circle | 100% | 37% |
| **map rectangle (now)** | **100%** | **0%** |

The minimap now fills with the whole map, driven by `Arena.extent` rather than the
`MASK_WORLD` constant — which also means it follows a scaled map.

#### RNG neutrality, asserted rather than hoped for

`Arena.sample` keeps the analytic circle path making **exactly two `rng()` draws,
angle then distance**, because `Math.sqrt(rng()) * r` is fixed-cost and rejection
sampling is not. `test_arena.js` counts the draws and checks the returned point
against the retired inline formula, so the property that protects the eval anchor
is a test rather than a comment. All 30 traces stayed byte-identical through the
migration; only arctic moved, and only once its arena shape actually changed.

#### The gap this exposed: golden traces never render

Removing the placeholder marks in Phase 1 left **two latent crashes in draw paths**,
and every trace still passed — because the harness drives `update()` only.

- `drawActiveGateLine` oriented its START/FINISH label by looking up "the other
  gate" as `marks[2]`, and read `undefined`. Now derived from the route's crossing
  direction (`n × dir`), which needs no special-casing: the start crosses with
  `dir +1` and the finish with `dir -1`.
- `drawMinimap` drew a hardcoded gate at marks 2,3. Now iterates the route's
  distinct gates.

`eval/test_render.js` closes it: **186 `draw()` calls** across all ten venues ×
prestart / every leg / one past the finish / finished / three camera modes × nav
aids on and off. This is the one class of bug the traces structurally cannot see.

`npm test` now runs arena → venuedoc → editor → render → boundary-race → checks.

### Phase 5 — Props
The runtime prop system does not exist (`grep -c "placedProps\|propPlacement"` = 0),
so this means building placement *and* rendering *and* collision opt-in. A separate
project that happens to live in the same editor. Do not let it into Phase 4.

---

## 6. Hazards learned

Encoded here so the next session doesn't re-find them.

- **Bounding radius lies on mask shapes.** The main landmass has radius 9388 —
  more than half the world. Any "is this near land?" test must use the polygon.
  This bug shipped three times.
- **SAT is convex-only.** `satPolygonPolygon` against a concave coastline collides
  with its convex hull → invisible walls in open water. Use `circlePolyCollide`.
- **Douglas-Peucker destroys closed rings.** Start and end coincide → zero-length
  baseline → a 185-point island returns 2 points, silently. `simplify_closed`
  splits at the farthest vertex first.
- ~~Keyholed rings need `evenodd` everywhere~~ — **measured false** for the current
  Arctic mask (July 29 2026): zero repeated vertices, polygon area matches pixel
  area to within 9% on all six rings. The water reaches the image edge, so the land
  is simply connected. `evenodd` fills are harmless but unnecessary. Real holes are
  now a first-class part of the document instead.
- **A Moore trace only walks a component's OUTER boundary.** Water fully enclosed
  by land is invisible to it and bakes as solid land, silently. `bake_mask.py`
  detects it by flood-filling inward from the image border.
- **Do not round authored geometry.** Rounding mark positions to 6 decimals moved
  boat headings by 1e-4 within three minutes of race time. The sim is chaotic;
  store full precision.
- **A migration exporter that reads the running game stops working the moment the
  game reads the new format** — it starts re-exporting itself, and the output looks
  plausible. Derive from the source artifact instead, and assert agreement with
  what is already on disk.
- **Start-line vertex order defines the crossing normal** `n = (dy, -dx)`. Flipping
  the wind without flipping the order puts the whole fleet on the wrong side.
- **`drawMarkZones` selects marks by leg index** — on an island course it drew a
  phantom gate at marks [2],[3], parked beside the granite island.
- **Race cutoff derived from `legLength`** — unused by island courses, so the race
  capped at exactly 300s.
- **1 world unit = 1 screen pixel.** Camera is translate-only. `plates.js` at dsf 1.
- **Render must never call `Math.random`** — it desyncs the eval stream. This
  includes *visual* code that happens to live in `update()`: particle spawning did,
  and because its draw count was conditional on what was near the camera, the
  simulation silently depended on where the player was looking. Visual effects use
  `fxRand`; if you add a particle, use it.
- **`legLength` is a player setting**, not scratch space. `resetGame` preserves it
  on purpose. A venue that writes to it corrupts every venue raced afterwards.
- **Chase a divergence by widening what you observe, not by reasoning about it.**
  A narrow field set puts the "first" divergence thousands of frames downstream of
  the cause.
- **Changing how many `rng()` calls a placement consumes moves every generated
  venue**, eval anchor included. `Math.sqrt(rng()) * r` is fixed-cost; rejection
  sampling is not. Swapping one for the other is a behaviour change disguised as
  a geometry change.
- **Emit generated data as JS, not JSON** — eval loads over `file://`.
- **Bump `?v=N` on script tags.** A stale cached `index.html` cost an hour: the
  script tag was on disk and absent from the DOM.

---

## 7. Decisions

**Settled:**
- Vector land is the source of truth; the mask is a one-way importer.
- `marks[] + route[]` replaces `marks[0..3]`, behind golden traces.
- World units, with a scale-whole-map tool. Prop sprites won't scale with it.
- Full land tool set in v1, extended on demand.
- Boundary is a placeable polygon; circle and rect are drawing tools that emit one.
  Analytic circle kept as a sampling fast path to protect the RNG stream.
- Import once, then edit in the editor — never re-import as a workflow.

**Still open:**
1. **Do the other nine venues get documents?** Recommended no, not yet. They work,
   and Sea Trial Bay must not change. Documents are for *designed* venues; a
   randomized venue can gain one later if it wants designed land.
2. **Where does the 3–5 minute check live** — an editor estimate, or a headless
   "sail it" run? Estimate is cheap and approximate, the harness accurate and slow.
   Recommended: estimate in the editor, harness button once editing works. The
   target is rough anyway and gets tuned by playing.
3. **How much does the route model own?** A gate is two marks or one mark with two
   ends; a rounding is a mark or a reference to a land shape. The schema above
   picks one of each — worth a second look when the refactor starts, since it is
   cheap to change then and expensive later.
