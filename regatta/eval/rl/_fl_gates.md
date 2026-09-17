# THE FLATS PUSH — pre-registered gates (2026-09-16 21:23 PT, written from the census
# BEFORE any candidate output existed)

Venue: Spoonbill Flats `flats`, frozen e1a2b607cdd48216 (doc stamp 144108a1:38688); his 3 laps
(stamp 8eb84e74:38655, ADJUDICATED onto the frozen doc — course block identical, tracks replayed
afloat through the frozen field, `_flats_replay.js`): med **172.8** / mean 173.8 / best 172.1.
Anchors fl0fl9400/9500/9600 (ten-bot, treeFL0 == HEAD 765accd): med 224 / mean 218.1 / best 173,
fins 238/240, dirt l/b/m/pen 0.00/0.89/0.12/0.22 (⚠ groundings are NOT `land` events — the bench
is blind to them; `_fl_census.js` counts them). **Ratio 1.296.**

## THE CENSUS (instruments NEW, tracked: _fl_census.js, _fl_chart.js, _fl_start.js, _fl_tacks.js,
## _fl_route.js, _fl_ground.js, _fl_push.js, _flats_replay.js, _flats_livefp.js)
- `_leg_matrix` MEANS: start +4.2 (9%), L1 beat +7.3 (16%), **L2 estuary +33.0 (74%)** of +44.4 s.
- THE LADDER IS THE FLEET'S SHAPE: roster nerve 1 (rocket/freight/leech/metronome) = 19 of 30
  boats in the 3-seed fleet; nerve-1 med 228, nerve-2 205, **nerve-3 213 (worse than nerve-2)**.
  The fleet MEDIAN is a channel sailor by roster composition; his line is a rung-3 line.
- ALL-NERVE-3 fleet (treeFLN3, 80 boats): med 211.2 / mean 211.1, 79/80 fins, aground 10.8 s/boat,
  dist med 28.2k vs his 24.6k; **wantij taken by 39%** (he 3/3); takers med 184.5 (aground 1.0 s)
  vs non-takers 219.5 (aground 14.1 s). TIMING GATE: boats banking the top-mark rounding before
  27 s take the wantij 47-67%, after 30 s 4-5% (`_fl_route`: the router prices the sill by
  arrival time and is right to refuse after ~27 s — the sill −0.45 closes at ~79 s).
- THE BEAT (`_fl_start` 8@9400, 80 boats): line med 3.2 / mean 6.5 s (his 0.7-1.4), speed at the
  gun med 4.9 kt (his 6.7-7.6), **beat line→bank med 24.1 / mean 24.9 (his 15.7-20.9)**, r2 med 30.5;
  by tack count: 0-1 tacks 18.2 s (= his), 2-3 21.8, 4+ 30.4; **tacks/boat 3.08 (his 1)**.
  `_fl_tacks`: **NAV owns 80%** of the beat's tacks (avoid 15%); 54% inside 400 u of the mark;
  inter-tack gap med 7.0 s, 42% < 6 s (churn); first tack med 5.4 s after the line at 957 u.
  Mechanism: OTB1's far target needs dF > 1200 u to the far point (two zones short of the mark)
  — from the line that is ~900 u, so it NEVER fires here and the corridor carrot prices every
  board (the otter short-tacking engine on a 1200 u beat). Start lanes are spread by design
  (script.js favoured-end bias) — not a candidate.
- THE NECK DNF CLASS: 768 s / 776 s / 36 s aground at (−1340..−1357, −2256..−2544) — 5 u outside
  the neck-n flat's west edge, ground +0.43 m: depth at HW 0.57 < draft+refloat 0.60 ⇒ never
  refloats; and `Tide.afterMove`'s shove SUMS the channel-ward pull (−0.71,−0.71) and the downhill
  unit vector (0.72,0.70) ⇒ |sum| 0.012 ⇒ ~0.1 u/s: she never moves (`_fl_push.js`). The router
  hugged the edge because `routeCost`'s edge tax only counts a neighbour that is DRY ON ARRIVAL
  (el > L − mg − draft = 0.38 at HW): a 0.43 lip is "wet" at HW but a hull that touches it is
  lost for the race. Rounding-craft at the top mark: ring 7.6 vs 5.7 s, excess sweep 100° vs 57°,
  ring tax 2.0 s/lap (a second-order item).

## CANDIDATES
FB1 `treeFLB1` (navigation.js OTB1 gate): the far target's admission `dF > 1200` → `dF > 400` —
  the ruler mode (2.1 zones) already takes over the last ~350 u, so the length gate was only
  keeping short beats on the carrot. Rule 1: which TARGET the boards are scored on, not a price.
FN1 `treeFLN1x` (tide.js routeCost edge test): a neighbour cell is `bad` for the edge tax when its
  ground is above the REFLOAT line (el > mid + amp − draft − refloat = 0.40) at ANY level — a
  cell a touching hull can never leave is a wall for the purpose of standing off it.
FE1 `treeFLE1` (tide.js afterMove, ENGINE): the shove uses the downhill direction where the slope
  is steep (|∇z| over 2·res > 0.05 m) and the channel-ward pull where it is flat (a pan) — two
  regimes, no cancellation. Byte-inert off tidal venues (the function returns without state.tide).

## GATES
G1 clock: flats 3×8 vs fl0fl* pooled paired mean ≤ −3.0 s AND med ≤ −3, fins ≥ 238/240;
   lexicographic: boat contacts not up >10% (0.89), mark not up >0.05 (0.12), pen not up >10%.
G2 mechanism FB1 (`_fl_start 8 9400`): tacks/boat 3.08 → ≤ 2.0; beat med 24.1 → ≤ 21; r2 med 30.5
   → ≤ 27. All-nerve-3 census (`_fl_census 8 9400 treeFLN3+FB1`): wantij share 39% → ≥ 55%.
G2 mechanism FN1/FE1 (`_fl_census 8 9400`, n3 tree): no grounding ≥ 30 s (was 1/80; fleet 2/160);
   aground s/boat 10.8 → ≤ 4 (n3).
G3 transfer: every other venue paired vs otb3* within its noise bar (bay/lake ±4, lagoon ±3,
   redrock/arctic/swamp per their pooled rules, others ±2) — a loser is NAMED; FN1/FE1 must be
   byte-identical everywhere off flats (goldens 36/36 unchanged).
Kill: any DNF from a rounding that never banks; a loser on two venues; boat contacts ×1.5.
