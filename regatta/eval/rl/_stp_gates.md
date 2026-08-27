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
