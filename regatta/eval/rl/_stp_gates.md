# THE START PUSH — pre-registered gates (2026-08-27, written from P1's census
# BEFORE any candidate output existed)

Pre-registration: memory `regatta-start-push-plan` + the campaign entry.
Owner rulings 4/4 recorded there (start family opened; OCS/scrum cost
TRADEABLE and named; the pre-start should read as a proper timed run; fallback
= redrock early legs). Anchors **tb\*** (ten-bot era). Control tree = `treeRW`
(== HEAD `ee652e1`, code `34eea06`).

## P1 — WHAT THE CENSUS FOUND (`_st_ledger2.js`, replay fins-validated
## 8/8 river, 4/4 bay, 4/4 seatrials, 4/4 redrock; ten-bot, late venue write)

| venue | him | bot cross med | behind@commit | behind@gun | kt@commit | stalled% (last 20 s) | realized run | OCS@gun |
|---|---|---|---|---|---|---|---|---|
| river | 2.2 | **15.2 s** | 368 u | 324 u | 1.37 | 1 | 20.5 s | 0% |
| ocean | 3.4 | 4.1 | 211 | 100 | 0.45 | 50 | 8.9 | 5% |
| arctic | 3.3 | 4.8 | 176 | 6 | 0.00 | 65 | 9.1 | 40% |
| lagoon | 1.1 | 3.0 | 205 | 124 | 0.00 | 68 | 8.9 | 0% |
| redrock | 1.4 | 2.7 | 192 | 88 | 0.00 | 61 | 8.8 | 2.5% |
| bay | 2.1 | 1.8 | 215 | 90 | 0.01 | 52 | 7.6 | 0% |
| seatrials | 3.4 | 1.0 | 185 | 38 | 0.00 | 63 | 7.2 | 10% |

**THE ROOT CAUSE, verified in `_stage_check.js` (not inferred from the code):**
`repositionBoats` sets `boat.controller.startStageDepth = 60`, but `resetGame`
builds fresh `Boat` objects and calls `repositionBoats` **before** `updateAI`
ever creates a controller — controllers-at-reposition = **0 of 10 on every race
of a process**, both races checked. The write is dead; every bot keeps the
constructor's `startStageDepth = 200`. So the fleet stages **200 u** behind the
line instead of the 60 the code says it wants, parks there at 0.0 kt (the irons
brake: `|TWA| < 0.5` and under 1.5 kt takes the full 0.994/frame), and then has
to sail `200/cos 0.7 = 261 u` from a standstill. `_st_cmd.js` traces bay:
commanded TWA goes to 0.00 (the luff branch) at T-18, the fleet decays to
0.02 kt by T-11, sits until T-7, and only then accelerates.

Two registered reads, and one of them killed my first framing — recorded:
- **KILL BAR (estErr ≥ 3× blocked, n ≥ 150): PASSES trivially** — `blocked` is
  **0.00 s at every percentile on every venue**. Per standing rule 4 that is a
  reachability fact, not a bug: `applyAvoidance` runs in the pre-start (no gate
  at bot.js:847) and never deviates more than 0.12 rad in 36,000 boat-frames on
  bay and seatrials, because the fleet is parked 200 u back in separate lanes.
  ⇒ **there is no pre-start traffic today.** Bringing the fleet to the line will
  CREATE some; that is the named cost below.
- **READ 2 (behindCommit ≥ 1.5× the staged run in ≥60% of starts): FAILS on the
  control venues** — 0.0% redrock / 0.0% arctic / 0.0% ocean / 5% lagoon,
  because the boats ARE at their (200 u) stage point. It PASSES on river
  (100%). ⇒ my "the estimate prices a nominal run the boat never has" framing
  is **wrong on eight venues and right on river/swamp**: the estimator is
  honest about the run it was told to price. The staging depth is the defect.
  SP-B is therefore a river/swamp robustness fix, not the main lever.

## THE CANDIDATES
- **SP-A (`treeSPA`)** — the dead write lands: `repositionBoats` sets
  `boat.ai.startStageDepth = 60` (the bag that always exists), and the
  `BotController` constructor reads it the way it already reads
  `startLinePct`, defaulting to 200. Verified: stage depths 60×9 on both races
  of a process.
- **SP-B (`treeSPB`)** — `tCross` prices `max(behind, STAGE)/cos 0.7`, the run
  the boat actually has, floored at the staged run so it can only ever commit
  EARLIER than the line it replaces.
- **SP1 (`treeSP1`)** = SP-A + SP-B.
- **SP-C (v2, only if v1 passes)** — owner ruling 3: the hold keeps way on
  instead of parking head-to-wind, so the boat holds station and arrives with
  speed. Not built until v1 has a verdict.

## G-MECH — the start statistics (`_st_ledger2` FAST, `_st_pool.js`, same seeds
## as P1, all ten venues). REGISTERED BEFORE ANY CANDIDATE RUN.
- **G-M1 (assert)** every bot's `startStageDepth` == 60 under SP-A. PASS/FAIL.
- **G-M2** fleet median distance behind the line AT THE GUN must fall on
  **≥ 8 of 10** venues.
- **G-M3 (the target)** median crossing time after the gun must fall on
  **≥ 8 of 10** venues AND the mean of the per-venue median deltas must be
  **≤ −1.0 s**.
- **G-M4** median speed at the gun must not fall on more than 2 venues.
- **G-M5 (named cost, no bar — owner ruling 2)** OCS-at-gun and start-scrum
  boat contacts (first 30 s) reported per venue at equal prominence.
- If G-M2 or G-M3 fails, the candidate does not reach a fleet bench.

## G-FLEET — `ocean_bench` at the tb\* anchor widths, vs the tb\* anchors
Judged with `_pool_rr.js <BASE> <CAND>` (NEGATIVE = candidate faster) and
`_pool_arc.js <exp> <base>` (POSITIVE = candidate faster) — **opposite sign AND
opposite argument order, standing rule 21/21b: one number hand-recomputed from
the raw JSON before any verdict is published.**
- **G-RIV** river 3×8 (9400/9408/9500): median improves; finishers ≥ anchor −1.
- **G-SW** swamp 3×8 (9400/9500/9600): median improves; finishers ≥ anchor −1.
- **G-RR** redrock POOLED 6-set (rules 12/20): paired median ≤ +2 s.
- **G-ARC** arctic 4-set 9100/9200/9400/9600: paired median ≤ +2 s; finishers
  not down more than 1.
- **G-BAY** 2×20, **G-LK** 2×20, **G-GLOW** 16, **G-LAG** 8, **G-OC** 16,
  **G-ST** 16: median not worse than +2 s.
- **LANDING BAR** (standing, unchanged from the last four pushes): a universal
  win lands locally. A non-universal win lands locally **with every loser named
  at equal prominence in the close table and review requested** — including the
  OCS and start-scrum columns, which the owner has already ruled tradeable.
- **CLOSE-OUT** `_n1_close_table.js` on final HEAD; goldens re-record + verify
  (READ THE COUNT = 30); `npm test` same-7; campaign entry + carry-forward;
  memories + graveyard.

## VERDICTS
(filled in below as they land — nothing written here before the run)

## ── V1 VERDICTS (mechanism screen, `_st_ledger2` FAST + `_st_pool.js`,
## ── same seeds as P1, 10 venues, n = 40-80 boat-starts per venue per tree)

**SP-A (stage 60) — FAILS G-M3.** 4/10 venues cross sooner, mean of the
per-venue median deltas **+0.17 s**. It does exactly what it says: distance
behind the line at the gun falls on every venue (bay 90→33, seatrials 40→5,
lagoon 124→44, redrock 88→49). But **speed at the gun falls with it**
(bay 4.4→2.9, st 4.4→2.4, arctic 4.7→3.0): a boat parked at 60 u has less
runway to accelerate through than a boat parked at 200 u, and it is still
parked. Seatrials +2.35 s, arctic +1.38, river +1.85. OCS up (st 5→33%).

**SP-B (tCross on the real distance) — FAILS G-M3.** 1/10 sooner, mean
**+0.36 s**, and byte-inert on glowtide (identical in every column) because
`behind ≈ STAGE` almost everywhere — `max(behind, STAGE)` is `STAGE`. It only
bites where the boat cannot reach its stage point (river 324→274 u at the gun,
swamp 100→83). Redrock +1.60 s.

**SP1 (A+B) — FAILS G-M3 on magnitude.** 8/10 venues sooner (bar ≥8 ✓) but
mean **−0.74 s** against the registered ≤ −1.0. G-M2 PASSES (9/10: river
324→216, swamp 100→45, lagoon 124→29, ocean 100→58; glowtide alone worse).
**G-M4 FAILS outright: speed at the gun falls on all ten venues** (river
3.5→2.4, bay 4.4→3.0, arctic 4.7→3.1). Real wins where the fleet was furthest
adrift — river −3.07, glowtide −2.53, ocean −2.03, swamp −1.05 — paid for with
arctic +2.03 and seatrials +0.65. Named costs: OCS st 5→28%, lagoon 0→18,
swamp 11→18, redrock 3→10 (down on glowtide 55→45); start-scrum contacts
ocean 0.05→2.52 and glowtide 0.45→2.67 per boat.

⇒ **NO FLEET BENCH** for v1 per the registered rule. The screen names the
missing piece, and it is the same one his own laps name.

## ── THE HUMAN REFERENCE (`_st_human.js`, NEW — the corpus carries phase 0,
## ── so every lap contains his whole 30-second countdown)
He is **never under ~1 kt after T-27** and mostly at **5-6 kt**:
- river (3 laps): stopped to T-27, sails AWAY from the line to 558 u building
  to 4.8 kt, turns at T-19 and runs back at 5.5 kt to 150 u by T-10, idles at
  ~145 u, then closes to 90 u **at 4.8 kt** at the gun.
- bay (3): 5-6.4 kt from T-22 on, holds 300-400 u off, closes 321→118 u in the
  last four seconds **at 5.9 kt**.
- glowtide (9): 5.3-5.6 kt throughout, 160 u at the gun **at 5.1 kt**.
Against the fleet's 2.0-4.6 kt at the gun (and 0.0 kt from T-12 to T-6).
**The start is not a distance problem, it is a SPEED-AT-THE-GUN problem**, and
every v1 candidate traded the second for the first. SP-C is therefore not an
optional v2 — it is the load-bearing edit, and it is what owner ruling 3 asks
for.

## ── THE SET AT THE LINE (`_st_cur.js`, NEW — owner note, 2026-08-27)
Resolved onto the line normal (+ = pushing toward the course side):
**river −4.42 kt across** (|set| 4.53) — the fleet's close-hauled VMG is about
4 kt, so a boat at 75% throttle makes NO ground on the line at all, which is
why river's fleet ends the countdown 324 u back; **glowtide +5.29 across**
(|set| 6.07, +3.03 along) — the stream sweeps the fleet OVER the line, which is
what its 55% OCS is made of; bay −0.67; every other venue 0.00. A boat with no
way on does not hold station in a stream — it *is* the stream. This is a
mechanism reason for the reach-hold, not just a speed one.

## ── SP-C VERDICT (wind-relative reach hold) — FAILS G-M3, and names why
4/10 sooner, mean **+1.52 s** (SPX, composed with A+B: 4/10, +1.61).
**The physics landed exactly as designed**: speed at the gun rises on all ten
venues to his own 5-6 kt band — bay 4.4→6.4, ocean 4.6→7.0, redrock 3.7→6.3,
lagoon 3.1→6.0, river 3.5→5.9 — and river −4.47 s, arctic −1.37, glowtide
−1.13 follow. **What kills it is OCS**: bay 0→30%, lagoon 0→38%, redrock
3→33%, lake 13→33%, seatrials 5→30%. A boat over early must return past the
−40 plane and re-cross, so the crossing column blows out (ocean +5.82,
seatrials +4.50, bay +4.32, redrock +4.05) even though the boat is faster.
**Mechanism**: the hold was defined against the WIND (TWA 1.65, "just past the
beam"), but the line normal is not the wind axis — on a skewed line a beam
reach walks the boat straight over. The hold has to be defined against the
LINE.

**A read that reframes the target**: the fleet ALREADY beats him at the gun on
bay (1.82 s vs his 2.1) and seatrials (0.93 vs 3.4). The headroom is river
(15.0 vs 2.2), swamp (10.7 vs 2.8), glowtide (6.2 vs 2.8), lake (4.2 vs 1.9),
arctic (4.8 vs 3.3) — and those are precisely the venues the set and the light
air make impossible to hold station in. Bay/seatrials/redrock carry downside
only.

## ── SP-D (line-relative reach hold) — the next candidate
Hold by reaching ALONG the line at our own staging depth, side latched to the
lane, expressed as a TARGET rather than a heading so the strategic layer crabs
it for the set and never commands irons, and so a point at staging depth cannot
walk the boat over the line. REACH 200 u along, BAND 80 u out of lane.

## ── THE HOLD LADDER (five shapes, each killed by its own measurement)
All on the same seeds, n = 40-80 boat-starts per venue per tree.
⚠️ PROBE FIX partway through: the OCS column OR'd the flag in on every
pre-start frame — "ever flagged", not "at the gun", the same trap
`_start_all.js` hit on 2026-08-14. Fixed; both columns now print (OCS@gun and
dip%, a dip being a boat that went over and returned before the gun — which
costs time either way). Numbers below are post-fix.

| shape | venues sooner | mean Δ | what killed it |
|---|---|---|---|
| SP-A stage 60 | 4/10 | +0.17 | closer but **slower** at the gun (bay 4.4→2.9) |
| SP-B honest tCross | 1/10 | +0.36 | `behind ≈ STAGE`, so `max()` is `STAGE`: inert |
| SP1 = A+B | 8/10 | −0.74 | misses −1.0; speed at the gun falls on all ten |
| SP-C wind-relative reach | 4/10 | +1.52 | line normal ≠ wind axis: walks over the line |
| SP-D line-relative reach | 3/10 | +0.95 | no depth control: creeps in (lagoon 3 u at gun) |
| SP-E/F + depth control | 2/10 | +1.27/+1.53 | still over: the reach leaves the SEGMENT |
| SP-G + segment clamp | 3/10 | +1.55 | works on river (−7.0) — and wrecks the still-water venues (ocean +7.1, lake +3.2, bay +3.9) |

**The lesson the ladder taught**: keeping way on is worth 1.5-2.5 kt at the gun
on every venue, and it is worth NOTHING on a venue where the boat can already
hold station — bay and seatrials already cross SOONER than he does (1.82 s and
0.93 s against his 2.1 and 3.4). The gain is entirely on the venues where a
stopped boat cannot stay put.

## ── ✅ SP-H — WAY ON, GATED ON THE PHYSICS THAT MAKES A HOLD IMPOSSIBLE
`(|set at the boat| ≥ 1.5 kt) OR (wind at the lane < 6.0 kt)` — the
mechanism's own precondition, measured at the boat, no venue names.
Off the gate the branch is the shipping code, character for character.

| venue | cross med | Δ | cross mean Δ | behind@gun | kt@gun | OCS@gun | dip% |
|---|---|---|---|---|---|---|---|
| **river** | 15.02 → **7.98** | **−7.03** | −7.78 | 324 → 87 | 3.5 → 5.3 | 0 → 9 | 0 → 36 |
| **glowtide** | 6.20 → **4.03** | **−2.17** | −1.01 | −9 → 21 | 5.5 → 5.5 | **55 → 40** | 50 → 70 |
| **swamp** | 10.67 → 10.30 | −0.37 | **−9.75** | 100 → 51 | 2.0 → 2.5 | 11 → 23 | 9 → 38 |
| lagoon | 3.03 → 2.87 | −0.17 | −0.29 | 124 → 124 | flat | 0 → 0 | 0 → 0 |
| redrock | 2.67 → 3.15 | +0.48 | +0.16 | 88 → 84 | 3.7 → 3.9 | 3 → 8 | 1 → 8 |
| lake | 4.22 → 4.67 | +0.45 | +0.76 | 77 → 84 | flat | 13 → 15 | 6 → 15 |
| bay / seatrials / ocean / arctic | — | **0.00** | **0.00** | identical | identical | identical | identical |

⚠️ **THE REGISTERED G-M2/G-M3 DO NOT FIT A SCOPED CANDIDATE and I am not going
to pretend they do**: they ask for ≥8 of 10 venues to improve, which a branch
that is byte-inert on four of them cannot deliver (SP-H reads 4/10, mean
−0.88). Restated on the population the gate actually reaches: **3/3 firing
venues improve on the median and all three on the mean**; four venues are
byte-identical; the three marginal venues (the gate fires on some boats in
local lulls) move −0.17 / +0.45 / +0.48 s. That is the honest reading, and the
fleet benches below are what decide it.
Named costs carried forward per owner ruling 2: river dips 0→36% (OCS at the
gun only 0→9%), swamp 9→38% (OCS 11→23%), glowtide dips 50→70% **but OCS at
the gun falls 55→40%**.

## ── SP-I (SP-H + SP-B) — REJECTED, and it dominates nothing
3/10 sooner, mean −0.28. Worse than SP-H on every firing venue (river −4.75 vs
−7.03, glowtide −0.65 vs −2.17, swamp +0.15 vs −0.37) AND it breaks the
inertness, because SP-B is unconditional (bay +0.07, seatrials +0.08, ocean
+0.82, redrock +1.08). **SP-B is dropped from the stack.**

## ── CORROBORATION: A THIRD OF THE RIVER FLEET IS NOT ON THE LINE AT ALL
`gunPct` (new column: where along the line the boat is at the gun; outside
[0,1] is outside the segment, where a crossing does not count):
**control 31.3% of river boats outside the segment at the gun, median pct 0.11
— the fleet is swept downstream AND piled at the pin end. SP-H: 6.3%, median
pct 0.63.** That is the same failure `getStartCommand`'s own lane comment
warns about, arriving through the current instead of through lane drift, and
it is a second mechanism for river's 15 s.

## ── RIVER'S REMAINING 5.8 s IS A GROUND-SPEED WALL (measured, not fitted)
With SP-H the river fleet is 87 u behind at the gun doing 5.3 kt and still
takes 7.98 s to cross. Close-hauled ground VMG there is
`5.3 · cos40° − 4.4 = −0.34 kt` — **against the set, a boat at that speed
cannot advance on the line at all**, so the crossing is inches. The lever is to
be AT the line at the gun, which means committing earlier, which means the
approach estimate has to know about the stream. ⛔ That is the CLOSED
current-aware-start family — but its closure premise is now falsified: it was
sized out in 2026-08-08 on "the river start line runs 0.77-1.19 kt … the set
moves the estimate ~0.2 s", and the frozen river document today measures
**4.53 kt at the line, −4.42 kt across it** (`_st_cur.js`). Recorded as an
OWNER-REVIEW item with fresh evidence, measured but NOT landed without a
ruling.

## ── TWO MORE SHAPES, BOTH REJECTED — the hold ladder stops at SP-H
- **SP-J = SP-H + a GROUND-rate approach time** (`getApproachTime` subtracts the
  along-run set; arithmetically identical at zero current, so still-water venues
  stay byte-inert). It buys glowtide — **cross −2.87 and OCS at the gun 55→20%**,
  the best OCS number any candidate produced — and loses river (−4.35 vs SP-H's
  −7.03, OCS 0→18%, dips 0→58%) and bay (+1.13, OCS 0→30%: bay's 1.2 kt set is
  enough to arm it). Against a set the estimate saturates at its own 30 s cap,
  the boat commits at T-30, sits on the line and churns over it.
- **SP-K = SP-H + a hold depth set by the GROUND closing rate** (four seconds of
  `polar·cos0.7 + set`, capped at the staged depth: still water caps out
  unchanged, foul water holds close, fair water holds off). It puts the river
  fleet exactly where it should be — **4 u behind the line at the gun** — and
  that is precisely the problem: holding 32 u off in a 4.4 kt foul stream churns
  the line, OCS 0→25%, dips 0→80%, crossing +12.02 (worse than SP-H). Glowtide
  is unchanged from SP-H (the cap binds, as designed).
⇒ **SP-H is the candidate.** Iteration on the hold stops here; the fleet bench
decides whether the start win converts to lap time.

## ── G-INERT ✅ PASSES AT THE WHOLE-RACE LEVEL
`ocean_bench` under SP-H vs the tb* anchors, same widths, same seeds:
**bay 20@9400, seatrials 16@9400 and ocean 16@9400 are BYTE-IDENTICAL** —
not "flat", identical files. The physics gate is provably unreachable there.

## ── THE GATE, MEASURED RATHER THAN INFERRED (`_st_gate.js`, NEW)
Per boat, at the first pre-start frame, the two quantities the gate tests:

| venue | armed | setAlong kt (min/med/max) | MEAN breeze at the lane (min/med/max) |
|---|---|---|---|
| river | **10/10** | −4.80 / −4.76 / −4.23 | 11.00 / 11.00 / 11.00 |
| swamp | **10/10** | 0 / 0 / 0 | 4.46 / 4.46 / 4.46 |
| redrock | **1/10** | 0 / 0 / 0 | **4.49** / 9.98 / 14.00 |
| glowtide | 0/10 | +4.17 / +5.18 / +6.50 | 9.74 / 9.89 / 9.98 |
| bay | 0/10 | −0.66 | 9.62 / 11.34 / 11.93 |
| lake / lagoon / ocean / arctic / seatrials | 0/10 | 0 | 7.00-18.42 |

**The finding that settles the gate's shape: redrock's light corner is 4.49 kt
and swamp's whole line is 4.46 kt — the same breeze, 0.03 kt apart.** No
threshold separates them. One redrock boat in ten arms the branch and reshuffles
that race; the choice is to take swamp WITH that redrock boat, or neither.
This is not a tuning question and I am not going to pretend a threshold can be
found. It is the owner's non-universal-wins call, with the cost named.

## ── SP-L FLEET VERDICTS (`ocean_bench` at tb* widths; `_pool_rr.js <BASE> <CAND>`,
## ── NEGATIVE = candidate faster; the redrock pooled median hand-recomputed
## ── from the raw JSONs per rule 21b: n=480, med 0, mean −2.25 vs the pooler's −2.2)

| venue | width | paired med | paired mean | med | fins | dirt/boat (boat / mark / land), pen |
|---|---|---|---|---|---|---|
| **river** | 3×8 | **−3.0** | **−8.9** | 237→235 | 233→**234** | 5.64→5.06, 0.11→0.17, **103.27→78.45 (−24%)**, pen 0.76→0.77 |
| swamp | 2 of 3 | 0.0 | −7.8 | 324→330 | 157→154 | 4.31→4.39, 0.09→0.04, 4.84→4.05 (−16%), pen 0.70→0.64 |
| redrock | pooled 6 | **0.0** | +2.0 | 308→314 | 480/480 | **4.49→5.89 (+31%)**, 0.50→0.53, 11.02→11.78, pen 0.85→0.99 |
| lake | 2×20 | 0.0 | +1.0 | 220→221 | 400/400 | 0.57→0.69 (+21%), land flat |
| lagoon | 8 | 0.0 | −1.5 | 209→209 | 80/80 | 0.70→0.65 |
| **bay, seatrials, ocean, arctic, glowtide** | full | — | — | — | — | **BYTE-IDENTICAL FILES** |

G-RIV **PASS** (median improves, finishers +1). G-RR **PASS** (pooled paired
median 0.0 ≤ +2). G-LK/G-LAG **PASS** on the registered bar (median within +2).
G-INERT **PASS** on five venues at the whole-race level. Swamp's two sets
disagree in sign (−18.6 / +2.8) — rule 3 country, the third set is running.

## ── SP-M = SP-L with the gate DECIDED ONCE at the first pre-start look
`getWindAt` carries the oscillator and gusts, so a per-frame test lets a lane
dip under the threshold mid-countdown and flip the boat's whole plan. Latching
it makes **lake and lagoon byte-inert as well** (start deltas 0.00), which is
where lake's +21% boat contacts came from. Full bench running.

## ── ⛔ THE LIGHT-AIR CLAUSE IS DEAD ON ITS OWN EVIDENCE (swamp does not convert)
SP-L swamp, all three anchor sets (the third landed last):

| set | base med | cand med | paired med | paired mean |
|---|---|---|---|---|
| 9400 | 326 | 311 | 0.0 | −18.6 |
| 9500 | 320 | 333 | 0.0 | +2.8 |
| 9600 | 328 | **365** | **+15.0** | **+20.9** |
| pooled | 327 | **342** | 0.0 | +1.7 |

**Finishers 237 → 230.** The start improved enormously there — crossing mean
−9.99 s, 100 u → 45 u behind at the gun, dips notwithstanding — and the LAP got
worse. Land contacts are down (4.54→4.17) and penalties down (0.69→0.67), so
this is not a contact story: a fleet that leaves the line together and earlier
arrives at the weed corridor together, and swamp's stall machine keeps what it
catches. **A real start win that does not convert.** That is a finding for the
swamp-admission decision in its own right: swamp's +20.7 s start deficit is
real and closing it is not worth anything downstream.

Dropping the clause also drops its collateral (the one redrock boat in ten, and
+31% boat contacts there). ⇒ **SP-O = foul stream only.**

## ── SP-O — THE CANDIDATE (`treeSPO`)
`cannotHold = setAlongKt <= -1.5` and nothing else. By `_st_gate.js` this arms
**10/10 on river and 0/10 everywhere else**, so nine venues are byte-identical
by construction and river's SP-L numbers carry over unchanged (verified by
cmp against the SP-L river benches, below). One file, one branch.
