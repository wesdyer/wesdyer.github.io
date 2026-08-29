# THE RE-ENTRY PUSH — pre-registered gates (2026-08-28 night, written from P0
# BEFORE any candidate output existed)

Pre-registration: memory `regatta-reentry-push-plan` + the campaign entry.
Owner ruling: rudder asymmetry is FINE FOR NOW — candidates are judged on HEAD
physics only (treeRUD not required). Control tree = `treeNV` (== HEAD `0d3dd35`,
js/ identical to `7f4a6da`). Anchors: tb* (arctic, bay, lake, lagoon, ocean,
seatrials, swamp), sp* (river), nvglow / nvrr9400..9900 (glowtide, redrock).

## P0 — the census (`_band_owner.js`, NEW tracked; ten-bot; fp-filtered)
Landed 23:31 (first run was a probe bug — the controller body runs at 10 Hz,
so a per-frame "avoidance called" flag read 80% "pre-avoidance"; fixed by
attributing on tick frames and carrying the owner, rule 18):

| leg | out-of-band % (him) | avoid | nav-armed | nav | post | wiggle | spin | currency ratio med / other-board-in-fan |
|---|---|---|---|---|---|---|---|---|
| bay 1 | 33.6 (12.6) | **51.5%** | 27.3 | 15.1 | 1.8 | 2.3 | 1.9 | 42.7x / 92% (n=98) |
| redrock 1 | 43.7 (13.1) | **50.6%** | 17.3 | 15.2 | 8.0 | 5.1 | 3.6 | 15.6x / 97% (n=114) |
| arctic 1 | 62.0 (50.7) | 26.3% | 4.2 | **42.4** | 16.8 | 7.9 | 2.5 | 46.1x / 86% (n=129) |
| lagoon 4 | 25.2 (13.1) | 42.6% | 38.7 | 16.2 | 2.0 | 0 | 0.5 | 24.7x / 96% (n=85) |
| glowtide 1 | 42.3 (—) | 46.1% | 4.6 | 24.5 | 10.7 | 8.3 | 5.7 | 42.7x / 96% (n=143) |

Excursion anatomy (fleet): 4.3-5.7/leg on bay/redrock vs his 1.3-1.7; median
2.5-2.8 s for avoid-owned onsets, depth ~85-105 deg, re-entry by TACK only
15-21% (his 0% — he luffs back, but he has 3x fewer excursions); the
long tail (>= 3 s) carries 80-85% of the seconds. nav-armed excursions are
the roundings (5 s, 150-180 deg, negative progress) — not this push's target.
Risk at avoid onsets: LOW/MEDIUM 77-90% — the spacing gradient, not an
imminent collision.
**GO gate: PASSED** (bay + redrock >= 50% avoid-owned; ratio >= 5x everywhere).
Arctic is NAV-owned (42%) — C1 is not expected to move arctic's band share;
it must not lose there.

GO gate for C1 (registered before the census printed): >= 50% of out-of-band
seconds on >= 2 of {bay 1, redrock 1, arctic 1} have `avoid` as LAST WRITER,
AND the currency counterfactual on avoidance-owned onsets shows the other
board priced >= 5x the chosen bear-away at the median. If NAV owns the time,
C1 is not built in applyAvoidance (re-plan toward the tactician).

## C1 — progress currency (racing legs only; every hard term byte-identical)
MECHANISM gates (`_band_ledger.js` / `_band_owner.js`, same seeds, same tree
pair):
- close-hauled share: bay leg 1 52.7% -> >= 62%; redrock leg 1 43.5% -> >= 55%.
- reaching+deep path per leg: bay 801 u -> <= 560 (-30%); redrock 928 -> <= 650.
- excursion seconds/leg down on both, tack-re-entry share UP (the other board
  became reachable) — read, not gated.
CLOCK gates (paired vs anchors, standing rules 3/12/13/20):
- bay: >= 4 disjoint 20-seed sets agreeing in sign, or a paired median <= -5.
- redrock: pooled 6-set (`_pool_rr.js <BASE> <CAND>`, NEGATIVE = faster).
- arctic: pooled 32 (`_pool_arc.js <exp> <base>`, POSITIVE = faster).
- river (sp*), lagoon, lake, glowtide (nvglow), swamp: 16-seed paired.
- ocean, seatrials (AT GOAL): byte-identical or within +1.0 paired median.
- starts: leg-0 byte-identical by construction (racingLegF) — verify OCS at
  the gun on seatrials + bay unchanged.
DIRT: boat / land / pen per boat not up > 10% on any venue without naming
it as a loser for the owner (non-universal wins rule).
KILL: any venue +2.0 paired median (pooled where pooled) with no compensating
venue; or mechanism gate missed on BOTH bay and redrock.

## C2 — excursion-and-return candidates
Built only if C1 passes its mechanism gate on >= 1 venue but excursion
duration median does not fall (re-entry still slow). Same clock gates; perf
gate: headless update() per frame not up > 25% (the 170 fps budget).

## Hygiene before any landing
goldens full `--update` + verify `--seeds 3` (READ 30); `freeze_venues --check`
from repo root; `_traj_fp.js`; venue table on final HEAD (`_n1_close_table.js`);
`date` on every entry.

## VERDICTS (2026-08-29 00:48, written after the reads)
C1 mechanism gate as REGISTERED: **MISSED** — close-hauled share bay 52.7→53.7
(bar 62), redrock 43.5→43.5 (bar 55); reach+deep path −11% / −7% (bar −30%).
What moved instead: out-of-band time bay 33.6→30.9, redrock 43.7→35.8, lagoon
25.2→18.1 (the recovered time went to the PINCH band, efficiency 0.88-0.90);
avoid-owned excursions −11% / −25% / −49% in count; excursion DURATION flat.
C1 clock gates: **PASSED** — redrock pooled −14 (all 6 sets neg), arctic
pooled −5 (fins +1), bay 4 disjoint sets all negative (−1/−3/−3/−1), lake
−4/−2, glowtide −10, swamp pooled −9, ocean 0, seatrials 0. Dirt: boat/land/
pen down on redrock, glowtide, bay, lake, ocean; arctic boat +5-13% on three
sets (−23% on one). KILL clause not triggered (no venue +2 pooled).
NAMED LOSERS for the owner: river fins 234→231 with the 9400 set land +68%
(pooled med still −3); lagoon +1 (8-seed). Swamp 9400 boat 3.21→5.26.
C1b: INERT-TO-WORSE over C1 (redrock +3/0, bay +2) — dropped.
Landing hygiene: goldens `--update` (running), verify, npm test, freeze
--check, venue table (printed 00:48: rr 1.401, arctic 1.500, glow 1.155,
sw 1.367, riv 1.243, lag 1.214, bay 1.121, lake 1.114, oc 1.074, st 1.029).
