# PT-050 PHASE 1 — CANDIDATE ROUTES (gates pre-registered 2026-10-18, before any candidate bench)

Owner: "Let's do the next step" (after the threading push: "PT-050 Phase 1, where bots choose between routes
and weigh what the boats ahead are doing"). His note (Oct 17): "routing should in part depend on what others
do. ie if I'm considering going through a narrow place and I'm mid fleet I would consider what the fleet
ahead is doing."

## Intake probe (`_cr_probe.js`, seed 9400, first bot into each leg; R1/R2 = the route with the earlier
routes' interior priced out; t = plain polar sailing time, no route hints)
- Bayou: one leg, east R0 vs west R1 t×1.39 (len 8335 vs 10361). Not a near-equal choice: the owner's own
  laps agree (east 159 s, west 191 s). Phase 1 with any sane cutoff leaves the Bayou all-east.
- Genuine forks (sep ≥ 500 u) within 10 % plain time: otter L1 (×1.04, 989 u), lagoon L3 (×1.05, 782 u),
  lake L2 (×0.90 — the hints price the faster line out), volcanic L2 R2 (×1.07) / L4 R2 (×0.91), bay L3/L5
  R2 (×0.93/0.92). Elsewhere R1 is a parallel lane 180–250 u over, not a route.

## Trees
- PRE = `treeTH6` benches (`th6*`, all thirteen venues already run) — HEAD 14d15a77 + inert `out.cost`/`out.tsail`.
- `treeCR1` = candidate routes + commitment + fleet-ahead pick (one mechanism):
  - per leg (leg ≥ 1, land venues; off on floe, tide and ≥2 kt stream venues), up to 3 candidates: R0 the
    stock route, R1/R2 with the earlier routes' interior priced out; kept if plain time ≤ 1.10 × the best
    and the route runs ≥ 500 u from the others with < 30 % shared interior.
  - pick = least plain time + the fleet ahead: each rival on the same leg, nearer the goal, sitting on a
    candidate's own water adds a queue price scaled by how narrow that water is and whether it is moving.
  - re-picked each replan until the fork, with 3 % hysteresis; held after the fork; the other candidates'
    own water is priced out of every replan for the rest of the leg (the jam stamp's ×6 cap — a blocked
    route can still be left).

## Acceptance (lexicographic, campaign ground rules), CR1 vs TH6
1. DNF must not rise, OCS must not rise.
2. Penalties per boat must not rise beyond noise.
3. Pace: paired median and mean finish not worse beyond noise (judged venues at their standard sets; 3×8 where
   a venue moves at 8 seeds).
4. The point of the mechanism: route spread on the venues with forks (census: share of the fleet on its
   most-used candidate per leg) and boat contacts. Spread at neutral pace lands; spread that costs pace is
   named and goes to the owner.

## Transfer
- Close table on all thirteen: byte-identical wherever no leg has a second candidate (ocean, seatrials have
  no grid; arctic floes, flats tide, river stream are scoped off).
