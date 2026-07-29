# Glacier Sound — Build Plan

*Working plan, not design reference. Design rationale lives in
[venues.md](venues.md); art rules in [venue-art.md](venue-art.md).*

**Order: geography → wind/ice regions → course type.** Regions come before the
course because mark positions depend on where the convergence actually lands, and
because regions are the low-risk half. Each phase ships independently and reverts
independently.

**Standing constraint:** Sea Trial Bay is the eval anchor and must not change in
any phase. Every gate below is measured against its pinned baseline —
`100t → Race 213.30/209.72, Pen 0.30, collB 0.56, DNS/DNF 0%`.

---

## Phase 1 — Geography

Give the venue its glacier. Everything else anchors here.

**Wind-relative, not terrain-fixed.** Place the face off
`state.wind.baseDirection` exactly as `generateRiverBanks` places banks
(`script.js:2212`). The whole scene rotates with the course, so no wind sector,
no terrain-pinned marks, no new course type. The existing W/L keeps working.

### Tasks

1. **`generateGlacierFace(rng)`** — a chain of overlapping island bodies at the
   windward end, `style: 'ice'`. Follow the river-bank construction: fixed step,
   radius jitter bounded so adjacent bodies *always* overlap at minimum vertex
   radius.
2. **Cap the ends.** Either run the chain past the boundary circle or fold it
   back on itself. ⚠️ The river's comments record what happens otherwise: a gap
   lets boats squeeze through and DNF wandering behind it, and open ends stranded
   boats in the wedge between bank and boundary — **29–33% DNF in evals**. A
   single face has two exposed ends where the river's closed stadium had none.
3. **Ice density gradient.** `generateBrash` currently scatters uniformly
   (`Math.sqrt(rng()) * boundary.radius`). Bias it toward the glacier end so
   "more ice / less ice" falls out of the same generator. Nearly free, and it's
   the best idea in the sketch.
4. **Calving.** Spawn floes at the face during the race — the one hazard that
   makes lap three different from lap one. Reuses the existing floe system.
5. **Berg facet shading** (optional, cosmetic). `ISLAND_STYLES.ice` is three flat
   tones today; per-facet tone assignment against a fixed light direction is the
   biggest visual upgrade available and stays on-style. Must be baked —
   `bakeIslandSprite` exists and the live path once cost the swamp 58 → 12 FPS.

### Gate

- Arctic eval: **DNF/DNS still 0%** — this is the shore-trap detector, and the
  single most important number in the phase.
- FPS unchanged (the face is many island bodies; confirm baking covers it).
- Race time still in the 3–5 min band.

### Revert

Self-contained in `generateGlacierFace` + the brash bias. Delete both and the
venue is exactly as it is today.

---

## Phase 2 — Wind & ice regions

The primitive that ten other venues also want: **a region of water where the wind
is different.** Redrock's wall shadows and venturi, Lake's glass patches,
Lagoon's squall interiors, Bayou's dead air, Emberfall's steam vents, Ocean's
cloud shadows, Fjord's downdrafts — all the same thing.

**It is already 80% built.** A gust carries
`x, y, radiusX, radiusY, rotation, speedDelta, dirDelta, age, duration` and
`getWindAt` sums gusts as *vectors* with a `1 - sqrt(distSq)` falloff. **A region
is that struct with infinite duration and an anchored position.** One code path,
two flavours: transient gusts that drift and die, persistent zones that don't.

**The AI is already ready.** `scoreTack` (`script.js:~975`) projects the boat
forward and samples `getWindAt(projX, projY)` at the *future* position, weighted
by per-character `traits.pressureSense`. It plans toward pressure rather than
reacting — the same pattern the river's current-scouting proved. Regions appear
in that lookahead automatically. **Expect little or no new AI work**, which was
this idea's biggest potential cost.

### Tasks

1. **Persistent zone struct + `getWindAt` integration.** Same vector summation,
   same falloff. Zones are placed wind-relative in this phase (like the face).
2. **Three zones for Arctic:**
   - **Katabatic** at the windward end — speed up, direction out of the sound,
     strongest at the face and decaying with distance.
   - **Offshore** over the outer course — the existing base breeze.
   - **Convergence** across the middle, where the two meet. *Do not model this
     directly* — it emerges from summing the two vectors. Author the two sources
     and check what the middle does.
3. **Render persistent zones.** ⚠️ Non-negotiable. The design language is "the
   water tells you the truth if you look"; an invisible wind region is an unfair
   trap. Wants a *steadier* look than a gust — a persistent tone/texture shift
   rather than a moving cat's-paw, so it reads as terrain rather than weather.
4. **Ice density per zone.** Placement-time only, no runtime cost. Supersedes the
   cruder Phase 1 bias if it proves cleaner.

### Design guards

- **Soft edges are mandatory.** Wind snapping 30° as you cross a boundary feels
  awful and isn't physical. With falloff, regions *are* fields mathematically —
  the difference from source-radiation is purely the authoring model, and
  authored shapes are the better one because you can see what you're designing.
- **Three ellipses in the venue config is the right start.** Do not build the
  painted-mask pipeline for this. If the mechanic is fun, the mask becomes an
  authoring upgrade later, not a prerequisite.

### Gate

- **Sail it before measuring.** Does the convergence read? Does the beat escalate
  — wind and ice thickening together toward the mark?
- Arctic eval: DNF 0%, `collB` not worse, race time still in band.
- **OVERPOWERED frequency** — katabatic stacking on `gustStrengthBias 0.75–0.95`
  is the tuning risk. It should stay dramatic, not become constant.

### Revert

Zones are additive contributors. Empty the zone list and `getWindAt` behaves
exactly as it does today.

---

## Phase 3 — Course type

The designed-course pilot. Everything here is terrain-fixed, which is the real
commitment.

### Tasks

1. **Terrain-pinned marks** — the Rock at the glacier mouth as a rounding mark,
   plus marks forcing passage **north of the fixed ice outbound, south on the
   return.** That converts out-and-back into a loop and produces reach / beat /
   run / reach — a trapezoid in disguise, and the reaching legs the whole game
   currently lacks.
2. **Wind sector.** Once marks are pinned, wind can no longer rotate freely or a
   leg eventually becomes unsailable. A down-sound sector is characterful, not a
   limitation.
3. **Rounding an island** — rounding zone, direction, and RRS mark-room against a
   mark with physical extent.
4. **AI pathing validation.** The dominant cost. The river took five fixes for
   one current field in open water; an island rounding plus converging opposite
   legs is harder.

### Gate

- `collB` — outbound and returning boats converge near the Rock and near the
  finish. Great drama, real collision risk, and this is the number that shows it.
- DNF 0%.
- **Lead changes per race** — new metric, and the one that says whether the
  course *races* well rather than merely looking good. Zero across many races
  means a procession.

### Open decisions before starting

- Is **fixed low ice** soft (drag, a shortcut you pay for) or hard (a wall)?
- Does the coastline become a **painted mask**, or stay generated? This phase is
  where that call has to be made.
- Start line needs clearance from the shore — with ten boats on 1100u, a line
  tight to the beach makes one end unusable.

---

## Cross-cutting

- **One phase at a time through the eval.** Geography changes pathing; regions
  change wind; the course changes both. Measured separately, a regression is
  attributable. Measured together, it isn't.
- **`pkill -9 -f chrome-headless` between long eval runs** — orphans slow
  everything.
- **Re-eval clean master before claiming any regression.** Stale baselines have
  misled sessions before.
- Phase 1 alone is a finished, shippable venue. Phase 2 alone makes it the most
  distinctive venue in the game. Phase 3 is a separate project that happens to
  live here.
