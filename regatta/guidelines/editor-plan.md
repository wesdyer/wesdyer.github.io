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

## 4b. Scenery vs arena — a design correction

The checks originally warned about **land outside the boundary**, on the reasoning
that land a boat cannot reach is waste. That was backwards.

The arena bounds **boats**. Land and drifting ice are **scenery**, and they should
extend past it — otherwise a sailor who reaches the limit watches the world stop at
an invisible wall. Ice especially: it does not respect an imaginary line.

So the model is now two extents:

| | bounds | who respects it |
|---|---|---|
| **arena** (`world.boundary`) | the sailing limit | boats (clamp, AI exit test, laylines) |
| **scenery** (derived) | arena ∪ land, plus `sceneryMargin` (default 1200u) | ice placement, drift, brash recycling |

Consequences, all of them corrections to earlier work:

- `land-outside` **inverted** into `scenery-depth`: land past the limit is reported
  as depth; the *warning* is now the opposite case — an arena edge with nothing
  beyond it to look at.
- `floe-outside` **inverted** into `floe-scenery`: ice past the limit is the point.
  The defect is ice outside the *scenery* extent, where nothing can ever see it.
- `arena-coverage` **halved**: painted map outside the arena is scenery, not waste.
  Only *unpainted arena* — water a boat may enter that the mask never described —
  is a defect.
- The arena default became the map rect **inset 700u**, so land continues past the
  sailing limit. Flush with the map edge there is nothing out there; inset too far
  and sailable water is thrown away.
- Pathfinding now skips scenery outside the arena. Ice a boat can never reach is
  pure cost in the A* visibility graph, where every extra node multiplies expansion.

Measured on Glacier Sound: **1 warning, 10 ok** — only race length, which is a
design decision. 35 of 54 floes now sit beyond the sailing limit as scenery, and two
land shapes continue up to 990u past it.

## 4c. One leg engine

`updateBoatRaceState` had two hardcoded course types. It now has **one walker over
the route**, and each entry states how its leg ends:

| entry | ends when |
|---|---|
| `line`, `role: 'start'` | crossed once in `dir` (and OCS before the gun) |
| `line`, `finish: true` | crossed once in `dir` |
| `gate` | crossed in, then back out past an end |
| `round` | swept ~160° about a mark, on the correct side |

The insight that made this small: **a gate leg was already a rounding** — cross in,
leave round an end. So the only genuinely new primitive was the swept-angle test, and
one walker now races lines, gates and roundings **in any order**. Start and finish are
identified by `role` and `finish`, never by leg number.

`npm run test:route` drives a boat along a known path through line → gate → rounding →
line (12 assertions). Driven rather than AI-sailed, so a failure means the engine.

Roundings resolve from either a land shape (`landId`) or a course mark (`markIdx`), and
marks carry a `kind` appearance — an orange inflatable or a yellow can. The editor's
**Route panel** lists the legs in order with `+ Gate` and `+ Rounding mark`, plus
per-leg flip-direction, flip-side, toggle-beat and delete.

Two traps found on the way:

- **`setupPreRaceOverlay()` → `updateCourseConfig()` runs on every `resetGame` and was
  clobbering the compiled route** with `buildRoute(...)`, discarding roundings' resolved
  marks. Latent until the engine started actually reading the route. Now guarded on
  `!state.course.doc`: a document's route is authored, never regenerated.
- **Sweep accumulates from the moment the zone is entered**, so an approach that curls
  the wrong way round a mark banks negative credit the rounding must then undo. That is
  correct — it is a real rounding requirement — but it means an approach has to be
  radial, not tangential-the-wrong-way.

### A pre-existing failure the traces were hiding

While testing this: **the AI cannot complete Glacier Sound, and never could.** Max leg
reached is 1 in the Phase-1 golden, recorded before any arena, scenery or walker work.
Boats start, beat away from the island, and never get within ~4450u of the rounding mark
(the leg is 5525u), accumulating ~25 000 grounding-frames each. Tested against five
arena shapes — map rect, inset 400, inset 700, circle 4375, circle 6187 — **identical in
every case**, so the arena is not the cause.

The user deferred AI performance explicitly, so this is known-deferred rather than new.
But it is worth stating plainly what it means for the test net: **golden traces prove
"nothing changed", not "this works."** They locked in a broken Glacier Sound as the
baseline without complaint. The validation checks are what should catch this, and the
"can the fleet actually sail it?" harness listed in §7 is still unbuilt.

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

### Phase 4c — Course authoring: modes, wind regions, route ✅ DONE

**Mode palette instead of a flat tool list.** `mode` (shape | vertex | marks |
boundary | wind | map | measure, keys 1–7) × `sub` (drag | sculpt | smooth), with
`syncTool()` deriving the legacy `tool` string. Each mode owns a panel and *only
that mode's geometry is hit-testable*, which is what makes marks draggable without
grabbing coastline vertices by accident. Measure has its own mode, so the
measurement overlay can be switched off by leaving it.

**One vertex-selection layer, shared by every mode that owns vertices.** `vsel` is
a list of refs (`{kind: land|arena|wind, id, ring, i}`) in click order, so
marquee-drag and Shift-click behave identically on a coastline, the arena and a wind
region's outline — and **align X/Y snaps to `vsel[0]`**, the first thing clicked,
which is the only anchor rule that does not need explaining. Ring deletion has a
hard floor of 3 points, because below that the validator rejects the document.

**Wind regions.** Overlapping polygons rather than a partition, summed as
*deltas* in `getWindAt`: `base + Σ (target − base) × intensity`, with a smoothstep
falloff band. Two regions therefore compose into a convergence nobody authored.
Direction is summed **as vectors** — 350° and 10° do not average to 180°.
`eval/test_wind.js` (11 assertions) pins the additivity, the monotone edge ramp, and
that sampling the field **consumes zero `rng()` draws**, which is what keeps a wind
region from being able to move the eval anchor.

**The route list is the course.** Rows carry the leg's identity and its controls:
crossing direction, rounding side, and for gates a **pass mode** — `through`
(cross once in the required direction and you are done) versus `round` (cross in,
then leave round an end). `eval/test_gates.js` drives a boat up through a gate and
straight back down and asserts a round-gate does *not* count, which is the whole
difference between the two.

**Reordering is a drag, not a pair of arrows.** HTML5 drag-and-drop on the row, with
the start and finish rendered `pinned` (undraggable): the leg engine walks the route
in order, so those two cannot leave their ends. The drop maths thinks in **insertion
slots** clamped to `[1, len−1]`, and the blue drop indicator is drawn from the same
clamped slot — so the gesture can never promise a drop the reorder will refuse.

**Names are authored or derived, never blank.** `entryLabel` / `markLabel` prefer an
authored `name` and otherwise derive one from what the thing *is* — "Start/finish
pin", "Committee boat", "Leg 2 gate, left", "Leg 3: gate (round an end)",
"Leg 1: round granite-isle". Clearing the text field deletes `name`, so the smart
default comes straight back. Leg labels are keyed on the **leg number**, not on
their marks: a gate's marks are themselves auto-named after their leg, so naming the
leg after its marks said the same thing twice and wrapped to three lines.

**Shared start/finish has no separate concept.** The route always ends with a
`finish` entry (the validator enforces it); "shared" simply means that entry
references the same two marks as the start, with its own `dir` — so the direction
you cross still matters and is still authored. The ⇄ button repoints the entry and
creates or drops a mark pair.

Three traps this run:

- **`.fixed` collides with Tailwind's `position: fixed` utility.** The pinned
  start/finish rows were being taken out of flow and stacked on top of each other;
  Playwright caught it as "row 0 intercepts pointer events" at row 1's centre, which
  is a far better error message than the screenshot would have given. Renamed
  `.pinned`. Any class name in this file has to be checked against Tailwind first.
- **Selecting a row on `mousedown` kills the drag.** The re-render replaces the
  element mid-gesture and `dragstart` never fires. Select on `click`; a completed
  drag does not fire click, so the two never collide.
- **A test hook that duplicates production logic tests nothing.** The first version
  of the reorder test called an `_reorder(from, to)` hook — which passed while the
  real handler was broken. Now the test does a real `dragTo` on the real rows, and
  the drop point has to land in a row's *lower* half for "after it" to be tested at
  all.

### Phase 4d — Inventory vs ordering ✅ DONE

The feedback that drove this: *"we need to be able to reuse marks and gates in a route
list… then we shouldn't delete gates, marks in the route because that is just an
ordering. The gates and marks are deleted on the map."* That is a data-model
observation, and it was right.

#### A LINE is a first-class object

A route entry used to carry `marks: [i, j]` — indices into `course.marks`. Two things
were impossible as a result:

- **Deleting a mark renumbered every index after it**, so marks could not be deleted on
  the map at all. (The reported bug — "deleting a gate keeps the end marks there" — was
  this seen from the other end.)
- **A gate had no identity.** It was a pair of indices that happened to appear in an
  entry, so the same gate used twice was two unrelated entries that merely looked alike.

So the document now holds `course.lines[]` — a named pair of marks, referenced by id —
and a route entry is a *use* of one, carrying only what varies per use: `dir`, and
`pass` (through / round an end). References are ids throughout: `lineId`, `markId`,
`landId`. **The route is therefore purely an ordering**, which is what makes ✕ on a row
mean "remove this leg" and nothing else.

`VenueDoc.compile` resolves ids back to the indices the leg engine already reads
(`marks: [i, j]`, `markIdx`), so **the runtime shape is unchanged** — all 40 golden
traces stayed byte-identical through the whole refactor, including after the shipped
document was rewritten on disk in the new form.

`VenueDoc.migrate` converts the old form on load and is idempotent; `VenueDoc.get`
migrates on the way out, so the game, the editor, the checks and the tests all see
exactly one reference form. `eval/test_course_model.js` races a course that uses **one
gate twice, crossed in opposite directions on consecutive legs** — the thing indices
could not express — and asserts both uses register independently.

#### Derived rather than stored

- **`course.legs` is gone.** Every entry after the start ends a leg, so the count is
  `route.length - 1`. Storing it as well meant two sources of truth a reorder could
  separate.
- **`course.type` is gone**, replaced by `course.description` — free text. Course type
  was a switch between two hardcoded course shapes; a designed course does not need one.
- **The time limit is measured from the ROUTE**: mark to mark, with a leg that nets
  upwind costing ×1.45 because it cannot be sailed in a straight line. This replaces
  `legs × legLength` (which only ever described a windward-leeward) *and* the
  `islandRound` special case in `updateRace`, which was that same gap patched for one
  venue. `compile` returns `sailedDist` and `cutoffAuto`; an authored `course.cutoff`
  overrides both. **Glacier Sound's limit therefore moved 601 s → 508 s** and its
  race-length warning went from 7:07 to 6:00 expected — the old number was an artifact
  of applying the beat factor to both legs.
- **`course.startTime`** authors the prestart (default 30 s). It goes through
  `state.race.userStartTime` exactly as `userLegs` does, because the slider writes the
  value out on one reset and reads it back on the next — the leak that hit `legLength`
  and `totalLegs` before it.

#### Deleting says what goes with it

Deletion belongs to the inventory, in Marks & gates mode, on the map or in the list:

- a **mark** takes its gates, and the legs that used them
- a **gate** takes its two marks (they exist to *be* that gate) and its legs
- a **start or finish mark refuses**, because no amount of undo makes a course with no
  start line obvious

Every case toasts what it removed. Hovering a mark, a gate or a route row highlights the
geometry and names it on the map, which is the other half of the same problem: a list of
three similar gates is a list of words until you can see which is which.

#### Units, and the seed

**Everything reads in metres.** 5 u = 1 m, 55 u = 11 m = a boat length (a J111, from the
game's 165 u three-length RRS zone). World units survive only in the cursor HUD, where
they are the coordinates a document stores. The check findings were converted too — and
gaps that are really "can two boats pass?" now also read in hulls.

**The Seed box is gone.** It only ever chose which random *ice layout* the preview showed
— the game seeds that per race — so it was a property of the preview asking for a number
whose meaning was never stated. It is now a **Reroll ice** button with a small layout
number beside it.

**The legend is derived** from what the document actually contains. A fixed list told you
about white land and grey granite on a course that has neither, which is worse than no
legend: it is a legend for a different map.

#### Water & current

Water itself is not an editable object — it is wherever land and the arena are not. What
*is* authorable is what the water does, and that is regions, so the mode hosts the first
of them: **current**. Same construction as wind regions (polygon, smoothstep edge,
additive, zero RNG draws) but the quantity is a **flow** — an absolute direction and
speed — because a patch of water either has a stream running through it or it does not.
Summed as vectors on top of whatever ambient current the venue already has, so two
overlapping streams give a resultant. `getCurrentAt` gained the summation and
`ambientCurrentAt` was split out of it; the river field is now the ambient term rather
than a competing branch. The field preview skips land.

#### Four bugs found in the process

- **The Checks tab blanked the page.** Two independent tab groups both used `.tab`, and
  the view switcher was bound to all of them: clicking a *pane* tab read an undefined
  `dataset.view` and hid both views. Scoped to `.tab[data-view]`.
- **A check that stops running reads as a pass.** The editor passed `VenueCheck.run` a
  hand-built `compiled` object with only the fields it knew about, so when the
  race-length check started reading `sailedDist` it silently vanished — 11 ok, no
  warning, nothing to see. It now passes the real `compile()` output.
- **`sailedDist` measured the wrong array**: the document's route, whose entries have no
  resolved marks (resolution happens on the compiled copies). It came out 0, which is
  what made the check disappear rather than warn.
- **`.fixed` collides with Tailwind's `position: fixed`** — see Phase 4c.

### Phase 4e — Separating what was fused ✅ DONE

Six items of feedback, and five of them were the same shape: two things that had been
treated as one.

#### A rounding mark is not the island it stands on

`{kind: 'round', landId: 'granite-isle'}` made the mark *be* the island's centroid, so
dragging the rounding handle translated the whole landmass and the island could not be
moved without moving the course. A rounding now names a **MARK**, always; migration lays
one at the island's centroid and carries `radius` (what the mark is standing at, which is
what floors the zone). The island goes back to being ordinary land — `deleteSelectedShape`
no longer has to refuse, because nothing in the route points at land any more.

Which land is being rounded is now **discovered** by the checks — the shape the mark
stands on, or the nearest one inside its zone — rather than declared. That generalises:
the clearance check now also fires for a buoy laid next to a shoal.

#### Route mode orders; Marks & gates mode edits

The rounding centre and ring are *handles*, so they only exist in the mode that owns the
geometry. In Route mode the map is an index you point at: clicking a gate or mark adds a
leg that uses it, and nothing there can move or reshape anything.

#### There is no base wind

A region states the wind **there** — an absolute mean direction, and optionally an
absolute speed — and "the wind is the same everywhere" is one region over the whole map,
which is exactly what an authored base direction meant. So that is what it migrates into,
and `wind.baseDirection` is gone from documents.

**Overlaps AVERAGE, they do not sum.** This was the user's correction and it is the right
one: summing deltas meant building a curving breeze out of two regions also doubled its
strength through the overlap, so every curve came with a squall attached and the only
remedy was to author compensating lulls. The blend is a partition of unity — each region
contributes its falloff intensity as a *weight*, and whatever weight is left over goes to
the venue's own wind — so edges still fade smoothly, full coverage means the regions decide
entirely, and nothing anywhere can exceed the strongest thing blowing. Direction averages
as unit vectors and speed as a scalar, deliberately: averaging full velocity vectors makes
two opposed regions cancel to a calm, which is a convergence nobody asked for when all they
wanted was a bend.

Two properties keep it faithful. **The day's shift rides on top** of every region's mean,
or a course fully covered by regions would never see a wind shift at all. And **an absent
speed means "whatever the venue is doing here"**, which is what preserves race-to-race
variety on a course that only authors direction — and is why migrating Glacier Sound to
one whole-map region left **all 20 traces byte-identical**.

`windBase`, the one direction the rest of the game needs a single answer for (laylines,
whether a leg nets upwind, the start-line orientation check), is now derived: the
region-weighted mean at the middle of the course.

#### Hand-placed ice

`doc.ice[]` holds authored outlines. Drag in Ice mode to place one — the drag sets its
size, the outline comes from the game's own floe generator so authored ice is shaped by
the same harmonics as the scattered kind — and `scatter` drops several inside the drag,
spaced apart, which is how density gets authored. Click to select, drag to move, Delete to
remove, and reshape vertex by vertex in Vertices mode.

**Position and shape are authored; drift, spin and wander are drawn from the race RNG**,
which is what the user asked for: a designed ice field that still plays out differently
every time. `makeFloe` gained an `artOverride` parameter and nothing else changed.
`seeded.ice` is now a checkbox, so a venue can have hand-placed ice only.

#### Water is not an object; its colour is

There is nothing to edit about water itself — it is wherever land and the arena are not.
What *is* authorable is how it looks, so `doc.palette` overrides the venue's water colours
and the swatches show whatever is in force.

#### Snapping, and a panel that stopped shouting

Dragging a vertex to exactly the x or y of the one next to it is something people do
constantly and cannot do by hand, so within 7 *screen* pixels of a ring neighbour's axis it
snaps, per axis, with a guide line drawn along the axis being held. Multi-vertex drags do
not snap, because "which of the six is aligned with what" has no useful answer.

The vertex-selection panel now lives in Vertices mode, and appears in Arena / Wind / Water
only once something is actually selected.

### Phase 4f — The time limit, measured honestly ✅ DONE

The user's diagnosis was exactly right: *"the derived time limit is wrong because it is
probably using straight line route completion instead of path finding and almost certainly
doesn't take wind into account."* Both halves were true.

**Distance.** `SailCheck.routeEstimate` measures the hull-width path — the same grid the
sailability check drives a boat along — so the distance being priced is a distance that has
been proven sailable. On Glacier Sound the sailable path is **1.9–2.1× the straight line**,
because the direct line from the start to the island crosses a coast. The old figure was
measuring a route no boat can take.

**Speed.** Each hop is priced by the game's own J111 polar: the best VMG toward that hop's
bearing, maximised over true wind angle, which is what tacking upwind and gybing downwind
actually cost. Per hop, not per leg — a single end-to-end bearing priced the arctic beat as
a broad reach, because the rounding arc leaves the boat on the far side of the island.

Knots become world units per second from two facts in `script.js` rather than a fudge:
`boat.speed` is units per *frame* at 60 fps, and `boatKnots = boat.speed * 4`, so
units/s = knots × 15. (Getting this wrong first time made the estimate 4× too slow, which
is how the anchor came to be checked at all.)

Result for Glacier Sound: **5.6 km of sailable path, best ~3:20, fleet ~4:30 — in the
3–5 minute band.** The course was never too long; the old formula's "7:07, 40% too long"
was measuring the wrong thing twice over.

**Where each number lives.** The honest estimate needs a nav grid and a BFS per leg
(42 ms), so it lives in the editor, which reports it and offers a button that writes it
into `course.cutoff`. The engine keeps a deliberately generous straight-line fallback for
documents that have not been through the editor — and a check now says so out loud, with
the number to set. Pricing the *straight line* with the polar was tried and rejected: it
looks more rigorous and is worse, because it would have DNF'd the fleet at 2:12 on a course
whose path is twice as long. The old beat factor was accidentally covering for the detour.

#### Bugs found on the way

- **A read that writes.** `dice()` and `dlines()` created `doc.ice = []` / `course.lines = []`
  on access, so merely *looking* at a pristine document marked it unsaved. Third instance
  of this exact bug (after `windRefresh`), now split into read-only and writer accessors.
- **A check that vanished** rather than warning — see Phase 4d; the second-order cause was
  `sailedDist` measuring the document's route instead of the compiled one.
- **The scale-map test asserted a verdict, not a mechanism.** It required "out of band
  before, in band after scaling to 60%", which inverted once the measurement got honest.
  It now asserts the *relationship* — 60% of the geometry is ~40% less race — which is what
  the tool actually guarantees.

### Phase 4g — Contextual venue objects, and things you can see ✅ DONE

Twelve items of feedback. Several were the same complaint from different angles: the
editor was telling you *about* things instead of *showing* them.

#### Ice belongs to the venue, not to a tool

Ice mode became **Venue** mode, whose panel is contextual: it reads the venue's effect
flags and shows only what that venue has. Glacier Sound gets the ice section because its
`fx.ice` is set; a venue without it gets told there is nothing venue-specific to place.
The next venue-specific object drops into the same frame instead of needing its own mode.

**Random ice is gone from designed venues.** Where the ice is, is a design decision, and
scattering it per race made the one thing a designer most wants to place the one thing they
could not. `_bake_ice.js` captured the layout the generator was already producing — 54
floes, 781 vertices — and wrote it into the document, so Glacier Sound keeps the look it
had and every floe is now draggable. The generator still serves the nine randomized venues,
which have no document to author. **This changed arctic's behaviour** (its RNG stream no
longer spends draws on placement) and the traces were re-recorded; every other venue stayed
byte-identical.

Ice vertices are now editable — they were *listed* as selectable but never hit-tested, so
they could be marquee-selected and not dragged. Placement also refuses to put a floe on
land: the scatter retries, and places fewer rather than placing them badly.

#### A boat, to scale

"Does this fit?" is the question a course designer asks most, and metres in your head is a
poor way to answer it. Measure mode can now drop a **J111 at true size** (55 × 17 world
units) — drag the hull to move it, drag the ring at its bow to turn it, with the
three-length RRS zone drawn as a dashed circle because that is what a rounding has to
accommodate. Below ~14 screen pixels it draws a locator instead: the point is to zoom in
and look, and you cannot zoom to something you cannot find. The panel reads out its
heading against the wind, and says when it is inside the no-go zone.

#### Marks: what is actually on the water

A mark can now carry **nothing**. An island rounding or a transit is a *position*, so the
race marks it with a pulsing ring-and-cross indicator instead of planting an orange
inflatable in the middle of a rock — which is exactly what Glacier Sound was doing, and it
now uses `kind: 'none'`. A yellow can is drawn as a drum rather than reusing the cone
sprite.

Two related bugs fell out. `drawMarkBodies` skipped every mark past the first two on an
island course — a leftover from the placeholder-marks era that was hiding the rounding mark
itself. And the marks list showed `inf` for every mark, which read as an ID; it now says
"orange buoy", "yellow can", "no buoy".

The rename fields say what they do: the label above shows the name in force and whether it
is *automatic* or *renamed*, and the empty box's placeholder repeats that name — so "what
goes in this field" answers itself, and clearing it visibly returns to the default.

#### One crossing at a time

A shared start/finish line is crossed in both directions, so drawing every entry's arrow at
once put a saltire on the line and said nothing about which crossing you were looking at.
Hovering or selecting a route row now draws **only that leg's** arrow, enlarged, labelled
`START` / `FINISH` / `THROUGH` / `IN, THEN ROUND AN END`, and suppresses its twin's.

The net-direction ↑↓ indicator is gone — it was derived correctly and communicated nothing.

#### Everything else

- **Land shapes → Land**, and leaving the mode clears its selection. A shape left selected
  kept its inspector populated and its outline lit while you edited something else.
- **A dragged rounding mark takes its zone and arrow with it.** The circle was drawn from
  the compiled course, which only updates on commit, so it stayed behind mid-drag.
- **Route mode cannot create geometry.** The "New gate" / "New rounding" shortcuts are gone;
  marks and gates are made in their own mode and the Route panel only orders what exists.
  It says so when there is nothing to add.
- **The water preview is real water.** A 230 × 104 canvas driven by the game's own
  `WaterRenderer` — ripple lattice, caustics, depth ramp — animating only while the Water
  panel is open. Four swatches cannot tell you what water will look like, because the
  colours tint each other.

#### The check that vanished, again

Baking the ice emptied the editor's generated-floe list, and the ice checks — which guard
on `floes.length` — **fell silent rather than checking the 54 floes actually in the
course.** Third instance of this exact failure in one session. Two fixes: the editor passes
every floe (authored included), and the check now reports "no ice on this venue" instead of
skipping. A check that stops running reads as a pass.

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
