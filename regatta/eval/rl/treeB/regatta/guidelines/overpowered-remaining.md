# Overpowered — what is left to do

**Date:** August 3, 2026 · **Status:** phases 0, 1, 2 **BUILT and verified on master**;
phases 3 and 4 **not started**
**Companion:** [overpowered-plan.md](overpowered-plan.md) — the model, the division of
labour, and the full phase sequence. **Read §2 and §3 of that doc before touching anything
here.** This file is the resume point, not a replacement for it.

Markers follow [visual-style.md](visual-style.md) §0: **Observed** = what the code does
today · **Rule** = a decision new work must follow · **Intent** = direction not yet realized.

> **Why this was paused.** Work stopped deliberately on Aug 2 so the arctic AI overhaul
> could land without the boat model moving underneath it. Phase 3 changes `boat.leeway`,
> which the AI reads for layline and VMG planning, and phase 4 requires teaching the bots to
> depower — both would have fought the AI campaign for the same ground. **Do not start phase
> 3 until the AI work is settled and its own baseline is recorded.**

---

## 1. Verify the ground before you start — **Rule**

Phases 0-2 were confirmed present and passing on master on Aug 3, after the AI overhaul
merged. Re-confirm anyway; it is two minutes and the alternative is debugging a ghost.

```
node regatta/eval/test_apparent.js          # 11 checks, all must pass
node regatta/eval/_heavyair.js --seeds 2 12 18 25 32
```

Symbols that must exist in `regatta/js/script.js` (cited by name, never line number):
`heelPressure`, `overpoweredFactor`, `OVERPOWERED`, `AWA_CLOSE_HAULED`, `AWA_KITE_SET`,
`AWA_KITE_DOUSE`, `SAIL_CHANGE_COST`, and `J111_POLARS.speeds[25]` / `[30]`.

⚠️ **The Aug 2 eval anchor (Race 203.75/199.84) is STALE.** The AI overhaul has certainly
moved it. Re-measure a clean baseline in the same session as any comparison — this project
has been misled by stale round numbers more than once.

---

## 2. Where it stands — **Observed**

### What landed

| Phase | What | Key symbols |
|---|---|---|
| 0 | Sail trim, luffing and kite set/douse moved from **true** to **apparent** wind | `AWA_CLOSE_HAULED` 25°, `AWA_KITE_SET` 100°, `AWA_KITE_DOUSE` 82°, `SAIL_CHANGE_COST` 0.08 |
| 1 | Flat true-wind tax replaced by **heel** from `AWS²·sin(AWA)`, lagged | `heelPressure()`, `boat.heel`, `OVERPOWERED` |
| 2 | Polar extended past ORC's 20 kt cap to **25 and 30 kt** | `J111_POLARS.speeds[25]`, `[30]` |
| — | HUD wind readout re-referenced to the course's own p10/p90 | `state.wind.pressure` |

### The tuning constants, as they stand

```js
const OVERPOWERED = {
    threshold: 18,        // kt TRUE the calibration is anchored at
    refMoment: 355,       // AWS²·sin(AWA) for a beam reach in 18 kt -> heel 1.0
    heelThreshold: 1.0,   // nothing is charged below this
    costPerHeel: 0.45,    // calibrated so a beam reach in 25 kt pays ~21%, as the old rule did
    heavyAirRelief: 0.08, // heavyAir stat raises what the boat can carry
    maxCost: 0.25,
    lagSeconds: 1.5       // heel is STATE — the lag is the mechanic
};
```

### Current measured behaviour

`_heavyair.js`, 2 seeds, Bluewater Bonanza, **measured Aug 3 on master after the AI merge.**
Boat speed in knots; heel is the lagged pressure; over% is the fraction of frames past
`heelThreshold`.

| TWS | | beat | close | beam | broad | run | race |
|---|---|---|---|---|---|---|---|
| 12 kt | speed | 6.97 | 6.64 | 6.90 | 7.75 | 7.53 | 226.6 s |
| | heel | 0.37 | 0.38 | 0.35 | 0.14 | 0.12 | over 0% |
| 18 kt | speed | 7.99 | 7.79 | 8.43 | 10.82 | 10.29 | 200.6 s |
| | heel | 0.77 | 0.77 | 0.76 | 0.45 | 0.35 | over ~1% |
| 25 kt | speed | 8.05 | 8.52 | 10.09 | **13.46** | **12.55** | 183.1 s |
| | heel | 1.38 | 1.39 | 1.39 | 0.88 | 0.68 | over 98/97/96/14/9% |
| 32 kt | speed | 7.14 | 7.12 | 9.23 | 13.09 | 12.52 | 205.3 s |
| | heel | 2.11 | 2.38 | 2.35 | 1.53 | 1.26 | over 100/100/100/98/70% |

The shape is the point: heel peaks on the **beam reach**, is high upwind, and collapses
downwind — so bearing away is a real escape, and 25 kt downwind is now genuinely fast
(it was 9.0/9.4 kt before this work, and *slower than 20 kt* because of the ORC flatline).

---

## 3. Phase 3 — heel → leeway — **Intent**

**Size:** small. Half a session. This is the natural next step.

### What is there now — **Observed**

In `updateBoat`, just after the rudder-drag block:

```js
if (angleToWind < Math.PI * 0.5 && boat.speed > 0.05) {
    const spdK  = Math.max(1.5, boat.speed / 0.25);
    const shape = 1.0 - angleToWind / (Math.PI * 0.5);   // 1 head-to-wind -> 0 at beam
    const lwDeg = Math.min(3.0, 3.0 * shape * (localWind.speed / 12) * (12 / (spdK * spdK)));
    ...
    boat.leeway  = (lwDeg * Math.PI / 180) * lwSign;
    cogHeading   = normalizeAngle(boat.heading + boat.leeway);
}
```

Two of those three factors are **proxies for side force keyed on true wind**: `shape` stands
in for the athwartships component (TWA), and `localWind.speed / 12` for its magnitude (TWS).
`boat.heel` already *is* side force, measured in apparent, which is where it actually acts.

### The change

The plan says: feed `boat.heel` into the **existing** term, do not add a second one.

The physics gives a clean substitution. A keel balances the rig's side force with lift, and
lift goes as `v²·α`, so:

> `side force ∝ heel` and `keel lift ∝ v²·α`  ⟹  **`α ∝ heel / v²`**

That is the whole formula — **and it does not need the `shape` term at all**, because the
angle dependence is already inside `heel` via `sin(AWA)`. Keeping both would double-count
the angle.

Sanity check against the Aug 3 table above, at 25 kt (`heel / v²`, relative):

| | heel | speed | `heel/v²` | vs close-hauled |
|---|---|---|---|---|
| close-hauled | 1.38 | 8.05 | 0.0213 | 1.00 |
| beam reach | 1.39 | 10.09 | 0.0137 | 0.64 |
| run | 0.68 | 12.55 | 0.0043 | 0.20 |

Leeway falls by 5× from close-hauled to running **with no shape term** — the correct
behaviour drops out of the physics. Note that this is a *different* reason from the one the
current comment gives: leeway does not fade reaching because the side force fades (it peaks
there), it fades because the boat is going faster. Fix the comment when you fix the code.

### Rules for doing it — **Rule**

- ⚠️ **Keep the 3.0° cap and calibrate to it.** Close-hauled leeway must stay ~3° or laylines
  move. Pick the coefficient so 25 kt close-hauled still lands near today's value, then
  check 12 kt and 32 kt have not gone silly.
- ⚠️ **`boat.leeway` is read by the AI** for layline and VMG planning (`boat.leeway is
  exposed so the AI can compensate` — its own comment). **This change moves AI behaviour.**
  That is the reason phase 3 waited for the AI overhaul.
- ⚠️ **Judge at 20 seeds, not 2.** A planner change once looked worse at 2 and 6 seeds and
  reversed at 20.
- The `angleToWind < π/2` gate can go: `heel/v²` already yields a small number downwind.
  Decide deliberately whether downwind leeway should be exactly zero or merely tiny.

### Verify

`npm run trace` (determinism must hold), `_heavyair.js` for speed by point of sail, and a
layline check on a W/L venue — if boats start overstanding or pinching the windward mark,
the coefficient is wrong.

---

## 4. Phase 4 — telegraph, escalate, recover — **Intent**

**Size:** the big one. The larger half is the AI, not the player.

An unavoidable punishment is not a mechanic, it is a tax — which is exactly what the old flat
−25% was. The loop is: the player is **warned**, can **act**, and can still **save it** after
it starts.

### Agreed with Wes, Aug 1-2 — **Rule**

These are settled decisions, not proposals:

1. **AMBER at a sustained heel, carrying a DIRECTION.** The correct escape is opposite by
   point of sail — head up beating or reaching, bear away broad or running — so a tag reading
   only "OVERPOWERED" is a coin flip, and guessing wrong makes it worse. The cue carries the
   answer: **"EASE UP" / "BEAR AWAY"**, or an arrow.
2. **A visible clock while it is sustained.** Two discrete states mean the red tag is the
   first moment you learn you were late.
3. **AMBER → RED: 2 seconds**, scaled **1.6–2.8 s by the `heavyAir` stat**, and scaled by how
   far past threshold 2 the boat is.
4. **RED = rudder authority falls; the boat rounds up (beating/reaching) or broaches (broad/
   running).**
5. **Recovery works DURING the broach, not only before it.** Correct input visibly shortens
   it: **~3 s if ignored, ~1.2 s if sailed out.** If amber is the only window, red is a
   cutscene — this is where the fun lives.
6. **~2 s immunity afterwards**, or you recover still overpowered and immediately broach
   again, which reads as broken rather than hard.
7. **Auto-trim stays optimal** but provides **no steering assist**. Trim is not the skill
   being tested here; steering is.
8. **`heavyAir` raises the threshold, lengthens the grace, and speeds recovery.** `pressure`
   still exposes a boat sooner — the existing trade for extracting more from puffs.

### Two traps — **Rule**

⚠️ **DO NOT reuse `heelThreshold` for amber.** Measured on Aug 3: heel exceeds 1.0 on
**96–100% of upwind frames at 25 kt** and 100% at 32 kt. That is fine for a speed cost, which
should scale continuously from the moment the boat is pressed. It is **fatal** for amber —
the tag would be lit for an entire windy race and become wallpaper inside a minute, and red
would then arrive as a surprise anyway. Amber needs its **own, higher** threshold ("threshold
2" in the plan), chosen so it means *you are pressing too hard right now*. Pick it from
measured heel distributions, not by eye.

⚠️ **The AI must depower on amber.** Otherwise the bots either broach constantly or never,
and if never, the player is the only one paying. This is the larger half of the phase. The
hook already exists: `boat.ai.forcedLuff` (in `updateAITrim`) eases the sheet up to 90° past
optimal, and the bots already answer a low `speedLimit` that way — but **easing is only half
the escape and the wrong half here**: the AI must also *steer*, up or down according to point
of sail, exactly as the player is being asked to.

---

## 5. The heel visual — prerequisite for phase 4 — **Intent**

**Build this before or with phase 4, not after.** At a 2-second amber→red, a player with no
visible lean gets the amber tag as their *first* warning, and 2 seconds is not enough to
learn from. The boat leaning is what teaches — it is continuous rather than binary and
readable in peripheral vision while watching the fleet. The tag only confirms.

Heel is one of the few things a top-down view shows *better* than expected, because the rig
is tall and the projection is honest about it.

- **The rig leans to leeward — primary.** A masthead at height `h` displaces `h·sin(heel)`
  athwartships: large and unambiguous from above. `drawBoat` already draws the sails in their
  own `translate/rotate`, so this is a lateral offset on the rig only, **no new art**.
- **The hull narrows — secondary.** A heeled hull presents `cos(heel)` of its beam from
  overhead. Geometrically exact, subtle alone (0.91 at 25°), sells the lean in combination.
- **The shadow shifts to windward.** `drawBoat`'s shadow is a constant `(5, 5)` offset today;
  driving it from heel is nearly free and reads instantly.
- **Asymmetric bow wave** — a heeled boat pushes more water to leeward. Cheap addition to the
  existing wake.
- A **HUD gauge** is the non-diegetic backup, not the primary.

⚠️ `boat.heel` is a *pressure ratio*, not an angle. Map it to a plausible degree range before
feeding it to a renderer — a boat at heel 2.4 is not heeled 137°.

---

## 6. Benches and how to verify — **Observed**

| Tool | What it answers |
|---|---|
| `regatta/eval/_heavyair.js` | The main bench. Speed, heel, trim quality, kite %, mid-hoist % by point of sail, at any wind. `--seeds N [knots...]` |
| `regatta/eval/_luffcheck.js` | Is a close-hauled boat luffing? Sweep + race, **distribution not mean** |
| `regatta/eval/_hudwind.js` | HUD wind colour rates per venue |
| `regatta/eval/test_apparent.js` | 11 physics invariants. **In `npm test`** |
| `npm run trace` | Determinism / behaviour hashing |
| `node regatta/eval/run_eval.js 100 100` | The Clubhouse Point anchor |

**Why the bench is Bluewater Bonanza (`ocean`)** — Wes's call, and it is right: a 4-leg
windward-leeward, **one uniform wind region, and no land at all**, so anything that moves is
the boat model rather than navigation. The wind is raised **at runtime** (`setWind()` writes
`state.course.windRegions[].speed` *and* `state.wind.baseSpeed`), so the venue on disk stays
the venue the player races. ⚠️ Do **not** bench this on Glacier Sound: its fleet cannot get
round the ice, so a change that made boats faster would show up as *fewer finishes* for a
reason that has nothing to do with wind.

---

## 7. Pitfalls carried forward — **Rule**

⚠️ **The polar stays indexed on TWS/TWA.** A polar table is *defined* against true wind and
the apparent physics is already inside those numbers. Indexing it by AWS/AWA double-counts
**and** is self-referential (AWS depends on boat speed → runaway loop needing a fake damper).
`test_apparent.js` guards this. AWS/AWA drives trim, luffing, kite, heel and planing — nothing
else.

⚠️ **The HUD stays TWS/TWA.** Wes's call, and independently right: laylines, the wind arrow
and the AI's tactics are all true-wind objects that would disagree with an apparent HUD.

⚠️ **`boomSide` is a continuous gybe ANIMATION, not a ±1 side flag.** It sweeps through zero.
Anything that reads `Math.abs(boat.sailAngle)` as "where the sheet is" will collapse mid-gybe
and score a correctly trimmed boat as completely mistrimmed. Use `boat.manualSailAngle`. This
cost a full diagnostic cycle once already.

⚠️ **ORC's 20 kt cap is a RATING rule, not physics.** `6/8/10/12/14/16/20` is exactly the ORC
VPP solve set, and "use the 20-knot allowances above 20 knots" is a scoring-fairness
convention the game had inherited as a speed limit. Do not "correct" the 25/30 kt rows toward
ORC's flattening — ORC is a rating VPP and is conservative about planing (it puts a J/111 at
8.75 kt in 12 kt of breeze at 120°, where real ones plane at 12–13).

⚠️ **Measure distributions, not means, for anything the renderer reads.** `luffIntensity` is
read only by `drawBoat`, where *any* non-zero value shears the sail into a visible flutter —
a boat luffing 8% of the time at intensity 0.4 averages 0.03 and looks like it is shaking
constantly.

⚠️ **This is the boat model.** Every golden trace and the eval anchor WILL move. Re-measure a
clean baseline in the same session as any comparison, and **snapshot `script.js` alongside
it** — one mid-session A/B was invalidated by another agent editing the same file, and the
giveaway was that the measured delta was arithmetically impossible for the change made.

⚠️ **Judge AI-adjacent changes at 20 seeds, not 2.**

---

## 8. Known-failing tests, all pre-existing — **Observed**

Confirmed identical on clean HEAD before this workstream began; **not** caused by it:

- `test_editor.js` — 9 failures, all in the wind-arrow renderer.
- `test_results.js` — 1 failure, "no points column".
- `test_route.js` — 3 assertions where the synthetic course's mark requires **331°** of sweep
  but its test boat sweeps **175°**. ⚠️ Fixing this means rewriting the test's **track**, not
  flipping the expectations — the expectations are right.

Note `npm test` chains with `&&`, so a failure stops everything after it. Run the tail
explicitly when checking your own work.

---

## 9. Open questions for the author

1. Should downwind leeway be exactly zero, or merely small? `heel/v²` gives ~20% of the
   close-hauled value on a run; the current code forces it to zero past a beam reach.
2. Where should amber's threshold sit? It must be uncommon on a 25 kt venue but must not be
   so rare that a player never learns the mechanic. Pick from measured heel distributions.
3. Should a broach cost the player rudder authority *entirely*, or heavily damp it? Entirely
   is more dramatic; damped keeps the "sail it out" loop honest.
4. Does manual trim become genuinely rewarding here — and if so should auto-trim be slightly
   worse than a good human, the classic trade? (Settled for now: auto-trim stays optimal.)
