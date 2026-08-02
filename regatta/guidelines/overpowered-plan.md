# Overpowered, apparent wind, and heavy-air speed — **Intent**

**Date:** August 1, 2026 · **Status:** phases 0, 1 and 2 **BUILT** (Aug 2); phases 3-4 intent
**Companion docs:** [race-view.md](race-view.md) · [realism](../../README.md) · `js/script.js`

Markers follow visual-style.md §0: **Observed** = what the code does today, **Rule** = a
decision new work must follow, **Intent** = direction not yet realized.

---

## 1. What is there now — **Observed**

One line does all of it, in `updateBoat`:

```js
targetKnots *= overpoweredFactor(boat.stats, effectiveWind);
// const OVERPOWERED = { threshold: 18, costPerKnot: 0.03, heavyAirRelief: 0.08, maxCost: 0.25 };
```

Four defects, each independently checkable:

1. **It is keyed on TRUE wind speed.** `effectiveWind` is the local TWS. `boat.apparentWind`
   is computed a few lines later and its own comment says it is for "the flag/telltales and
   HUD" — the force model never sees it.

2. **It is blind to point of sail.** `overpoweredFactor(stats, wind)` takes no angle at all,
   so a boat running dead downwind in 25 kt is taxed identically to one beating. The case
   that should be *fastest* is penalised exactly as hard as the one that should be slowest.

3. **It is a flat speed tax with no dynamics and no agency.** Up to −25%, and nothing the
   sailor does changes it. There is no heel state, no round-up, no broach. Leeway exists but
   is keyed on TWA and TWS, so the heel → leeway link is absent.

4. **Heavy-air downwind is capped twice.** `getTargetSpeed` contains
   `if (windSpeed >= 20) { lower = 20; upper = 20; }` — **the polar flatlines at 20 knots** —
   and then overpowered subtracts from that. 25 kt downwind is strictly slower than 20 kt.

⚠️ Glacier Sound races in 15–29 kt, so it is permanently "overpowered" under today's rule.
It will move more than any other venue.

---

## 2. The model — **Intent**

One quantity replaces the flat tax:

> **heeling moment ∝ AWS² × sin(AWA)**

Sail force goes as the square of apparent wind speed; the athwartships component goes as the
sine of apparent wind angle. That single expression reproduces the whole behaviour without
special cases:

| point of sail | AWS | AWA | heel | outcome |
|---|---|---|---|---|
| close-hauled | high (boat speed adds) | ~25° | high | overpowered; feather to relieve |
| beam reach | highest | ~90° | **maximum** | most overpowered; broach risk |
| broad / run | **low** (boat speed subtracts) | ~150° | low | little heel, all drive — fast |

Drive is the complementary component, so bearing away in a blow genuinely converts heel into
speed rather than merely reducing a penalty. That is the physical reason the escape works.

**Heel is state, not an instantaneous read.** `boat.heel` lags by a second or two, so being
overpowered is a *situation you sail out of* rather than a constant multiplier. The lag is
the mechanic.

**Consequences stack by threshold**, not all at once:
- past threshold 1 → feeds the existing leeway term (a heeled hull loses lateral grip)
- past threshold 2 → rudder authority falls; the boat wants to round up on a beat or reach,
  and to broach when broad
- speed cost applies only above threshold 1, and is smaller than today's flat 25%

**Stats keep their present roles.** `heavyAir` raises the heel threshold; `pressure` still
exposes a boat sooner. That trade is already documented and should survive.

---

## 3. Which wind drives what — **Rule**

⚠️ This is the part that is easy to get wrong, and getting it wrong is not a tuning error.

| quantity | driven by | why |
|---|---|---|
| polar lookup → target speed | **TWS / TWA** | what a polar table *is* |
| sail trim, luffing, spinnaker set/douse | **AWS / AWA** | what the rig and the telltales feel |
| heel / overpowered / planing | **AWS / AWA** | a force question the polar does not answer |
| HUD readout, laylines, AI tactics | **TWS / TWA** | what a tactician reasons in |

**Boat speed must stay indexed on TWS/TWA.** The J/111 table gives boatspeed *for a given TWS
and TWA*; the apparent-wind physics is already inside those numbers. Indexing it by AWS/AWA
would double-count, and it is self-referential — AWS depends on boat speed, so speed → AWS →
speed is a feedback loop that either runs away or needs an artificial damper. The existing
comment in `updateBoat` ("the speed/VMG model stays on TRUE wind angle, which is correct for
polars") is right and stays.

**The HUD stays true** for a second reason beyond familiarity: laylines, the wind arrow and
the AI's tactical model are all true-wind objects, so an apparent HUD would disagree with the
course overlay drawn next to it.

**Trim quality becomes the bridge.** With the polar on true and trim on apparent, the two can
disagree — a boat sheeted correctly by apparent could still be handed a polar speed that
assumes some other trim. Make trim quality a multiplier on the polar target: sheeted right,
you get the polar; badly trimmed, you do not. That is honest, and it finally gives manual
trim something to earn. `luffIntensity` and `windGrooveFactor` are today's partial version.

---

## 4. Sequence — **Intent**

Ordered so each step is separately measurable, and so the pieces that share arithmetic land
together.

**Phase 0 — trim, luff and kite onto apparent. — BUILT**
`optimalSailAngle` currently maps **TWA** 45–180° onto sheeting angle, and `luffIntensity`
uses TWA minus the sail's actual angle. Both move to AWA; spinnaker set/douse moves to AWA
too (which is why a fast boat carries a kite deeper than a slow one). First because heel is
computed from the same apparent quantities and they should be derived once.
*Measured:* the loop closes — `corr(boat speed, sheet angle)` on a beat went from **−0.07
to −0.66** (12 kt) and **−0.07 to −0.47** (25 kt). It cannot be positive: faster boat →
apparent forward → sheet in.

Three defects surfaced doing it, all of them older than this work and all found by
measurement rather than reading:

1. **The hoist crossfade had a hole in the middle.** `jibFactor = max(0, 1-2p)` and
   `spinFactor = max(0, 2p-1)` are the weights of a weighted sum and are **both zero at
   p = 0.5**, so a boat halfway through a five-second sail change had a target speed of
   *exactly zero*. Measured 38–49% of beam-reach and 29–45% of running frames sitting in
   it. Weights now sum to one, with an explicit bounded `SAIL_CHANGE_COST` (8% at worst).
2. **The kite decision had no hysteresis** against that five-second hoist, so it chattered
   across its own threshold. Two thresholds now: `AWA_KITE_SET` 100°, `AWA_KITE_DOUSE` 82°.
   ⚠️ Do NOT extend hysteresis to the `speedLimit` term — that is the AI's throttle, and
   holding a kite through it means flying a spinnaker while deliberately spilling it.
3. ⚠️ **`trimEfficiency` was pricing the BOOM, not the SHEET.** `boat.sailAngle` is
   `manualSailAngle * boomSide`, and `boomSide` is not a side flag — it is a continuous
   gybe *animation* sweeping through zero. So `|sailAngle|` collapsed mid-gybe and every
   gybe scored as a total mistrim: run trim quality **0.64** against 0.96 broad, which
   dropped the fleet out of planing (38% vs 65%) and cost 1.5 kt. Now reads
   `manualSailAngle`; trim quality is **1.000 at every point of sail**.

The luff threshold also had to move: `0.5 rad` (28.6°) was calibrated against *true*-wind
angle of attack. In apparent, a correctly trimmed close-hauled boat reads ~27°, so the old
value had **every** upwind boat shaking its sails. Now 14°, which leaves a 9° margin at the
worst reachable state and 0 luffing frames in 7,919 close-hauled samples (`_luffcheck.js`).

**Phase 1 — heel from AWS, point-of-sail aware. — BUILT**
`heelPressure(aws, awa) = aws² · sin(awa) / refMoment`, lagged into `boat.heel` over
`lagSeconds: 1.5`. `refMoment: 355` is a beam reach in 18 kt, so **heel 1.0 means "as
pressed as the old rule's threshold"**. `costPerHeel: 0.45` is calibrated so a beam reach in
25 kt still pays ≈21% — the size is held, only the shape moves.

*Measured heel by point of sail, 25 kt:* beat 1.36, close reach 1.46, **beam 1.43**,
broad 0.89, run 0.66. Exactly the table in §2 — and the run is now free, which is the whole
point. Downwind at 25 kt went **9.0 → 13.4 kt broad and 9.4 → 13.1 kt on the run**.

⚠️ The HUD badge moved onto `heel` too. On the true-wind test it lit for an entire windy
race *including dead downwind*, where the boat is at her fastest and nothing is wrong — so
it read as "it is breezy" rather than "you are pressing too hard".

⚠️ **Heel exceeds 1.0 on 96-99% of upwind frames at 25 kt.** Fine as a speed-cost trigger,
FATAL as phase 4's amber (§4 warns amber must stay uncommon). Phase 4 needs its own, higher
threshold — do not reuse `heelThreshold`.

**Phase 2 — unclamp the polar above 20 kt. — BUILT**
Rows for **25 and 30 kt** added; the flatline moved from 20 to 30. The measured rows stop at
20 because `6/8/10/12/14/16/20` *is* the ORC VPP solve set, and ORC's "use the 20-knot
allowances above 20 knots" is a **rating-fairness rule, not a claim about boats** — the game
had inherited it as physics.

Extrapolated by continuing the trends the measured rows already show between 16 and 20 kt:
upwind **saturates** (+5.7% over those 4 kt → +2% then 0%), downwind **does not** (+18.7%
→ +18-20% then +17-18%), because past 17-18 kt the boat is planing and a planing hull keeps
taking what it is offered. ⚠️ Do not "correct" these toward ORC's flattening: ORC is a
rating VPP and is conservative about planing — it puts a J/111 at 8.75 kt in 12 kt of breeze
at 120°, where real ones plane at 12-13 kt.

*Sanity:* 25 kt at 120° is 12.99 kt of polar, ~15.6 with the planing bonus; real J/111s are
documented in the high teens with peaks past 20 (one at 20.2).

The planing gate survived unchanged: at 12 kt the fleet makes 7.8 kt broad, still under the
`entrySpeed: 8.5` gate, so the balance [pitfalls] records is intact.

**Phase 3 — heel → leeway.**
Feed `boat.heel` into the existing leeway term instead of adding a second one.

**Phase 4 — round-up and broach: TELEGRAPH, ESCALATE, RECOVER.**

An unavoidable punishment is not a mechanic, it is a tax — which is exactly what today's flat
−25% is. The loop is: the player is warned, can act, and can still save it after it starts.

1. **AMBER at heel threshold 1**, with a **direction**. The correct escape is opposite by
   point of sail — head up beating or reaching, bear away broad or running — so a tag reading
   only "OVERPOWERED" leaves the player guessing, and guessing wrong makes it worse. The cue
   carries the answer: "EASE UP" / "BEAR AWAY", or an arrow.
2. **A visible clock while it is sustained.** Two discrete states mean the red tag is the
   first moment you know you were late. The amber has to show how much budget is left.
3. **RED at threshold 2** — rudder authority falls, the boat rounds up or broaches.
4. **Recovery works DURING the broach, not only before it.** Correct input visibly shortens
   it. If amber is the only window, red is a cutscene; this is where the fun lives, and it is
   what lets a bold sailor push harder and still get away with it.
5. **Brief immunity afterwards.** Otherwise you recover still overpowered and immediately
   broach again — a death spiral that reads as broken rather than hard.

⚠️ **Amber must stay UNCOMMON.** Glacier Sound races 15–29 kt; if amber means "it is windy" it
becomes wallpaper in a minute and red arrives as a surprise anyway. It must mean *you are
pressing too hard right now* — which is the argument for keying it on heel, not on wind.

⚠️ **The AI must depower on amber.** Otherwise the bots either broach constantly or never, and
if never, the player is the only one paying. This is the larger half of phase 4, not a
footnote.

**Character stats own how much overpowering a boat carries.** `heavyAir` raises the heel
threshold, lengthens the amber grace period before red, and speeds recovery; `pressure` still
exposes a boat sooner — the existing trade for extracting more from puffs. A heavy-air
specialist should be able to hold on where a light-air flyer has to depower.

---

### Showing heel in an orthographic top-down view — **Intent**

Heel is one of the few things top-down shows *better* than expected, because the rig is tall
and the projection is honest about it.

- **The rig leans to leeward — primary cue.** A masthead at height h displaces `h·sin(heel)`
  athwartships, and that is a large, unambiguous movement seen from above: the mast and sails
  visibly out over the water to leeward of the hull. `drawBoat` already draws the sails in
  their own `translate/rotate`, so this is a lateral offset on the rig only, no new art.
- **The hull narrows — secondary.** A heeled hull presents `cos(heel)` of its beam from
  directly overhead. Geometrically exact, subtle on its own (0.91 at 25°), but it sells the
  lean when combined with the rig offset.
- **The shadow shifts to windward.** `drawBoat`'s shadow is a constant `(5, 5)` offset today;
  driving it from heel is nearly free and reads instantly.
- **Asymmetric bow wave** — a heeled boat pushes more water to leeward. Cheap addition to the
  existing wake.
- A **HUD gauge** is the non-diegetic backup, not the primary. The tag confirms; the boat
  leaning is what *teaches*, because it is continuous rather than binary and readable in
  peripheral vision while the player is watching the fleet.

---

## 5. Risks — **Rule**

- ⚠️ **This is the boat model, not a rendering layer. The eval anchor WILL move**, and so will
  every golden trace. Re-measure a clean baseline in the same session as any comparison —
  see the process note in [contact](../../CLAUDE.md) about comparing against stale files.
- ⚠️ **Judge at 20 seeds, not 2.** A 2- and a 6-seed A/B once both said a planner change made
  things worse; at 20 it reversed.
- ⚠️ **The AI is tuned against the current model.** `scoreTack`, the layline logic and the
  start all assume today's speeds. Phase 4 especially will need the bots taught to depower.
- Determinism: none of this should touch RNG draw counts. If a phase changes them, that is a
  bug in the phase, not a cost of the feature.

## 6. Open questions for the author

1. How hard should a broach bite — a few seconds of lost control, or a real recovery?
2. Should heel be **visible** (hull tilt in the sprite, or a HUD gauge), or felt only through
   behaviour? A visible cue is what makes the escape learnable.
3. Does manual trim become genuinely rewarding here, and if so should auto-trim be slightly
   worse than a good human — the classic trade — or stay optimal?
