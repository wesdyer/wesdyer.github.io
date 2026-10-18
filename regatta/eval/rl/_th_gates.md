# THE THREADING PUSH — gates (pre-registered 2026-10-17 20:45 PT, before any candidate bench)

Owner: "Do a push to improve it. Follow the normal AI campaign guidelines." Context: PT-050 Phase 0.
Gatorgrass Bayou (`swamp`): the east route through the cypress was closed to the bots (a ~70 u
tree gap at (717, 1561); tupelo grove at (1090, 766)). Owner approved moving knee-156 and tree-910
30 u each, plus an AI change that lets bots thread gaps between props. Goal of the push: drive down
contacts — land (trees + banks), boat — and the time they cost.

## Venue
- swamp PROMOTED: frozen `b917116ef482f76a` → `e2cc7ba11fb733f1` (old copy kept in `_venues_preTH/`).
  Baselines on the old cut are retired. The promoted cut also carries the owner's earlier live edits.
- Human column: his laps in `traj/` (stamped on older cuts; the two prop moves are 30 u on the line
  he sailed, so the laps stand as the reference, noted in the table).

## Trees
- `treeTH0` = HEAD js (37f3f79c) on the frozen venues — the PRE anchor.
- `treeTH1` = HEAD + TH (thread steering: SailCheck.trueClear, planThread, avoidance land-probe stand-down
  while threading, ±0.4 rad dodge clamp, thread queue speed, close-hauled threads).
- Every further candidate = its own tree, one mechanism, A/B against the tree it builds on.

## Protocol
- `ocean_bench.js` ten-bot. swamp 3×8 @ 9400/9500/9600 (24 races, 240 boats) for PRE and every judged candidate;
  8-seed probes (9400) to screen.
- Instruments: ocean_bench `col` (land/boat/floe/mark), `pen`, fins; plus `_th_census.js` (trees vs banks,
  wiggle/escape contacts, seconds under 1 kt by place) where a mechanism needs attribution.

## Acceptance (lexicographic, per the campaign ground rules)
1. DNF must not rise (fins), OCS must not rise.
2. Penalties per boat must not rise beyond the per-seed spread of PRE.
3. Then pace: paired median and mean finish over the 24 races.
4. Contacts are the push's target: a candidate that holds 1–3 and cuts land or boat contacts lands
   even at neutral pace; a pace gain that raises contacts is named, and judged by the owner.

## Transfer
- Close table on all thirteen venues, PRE (TH0) vs POST: byte-identical wherever threading never fires;
  where it fires, 1–2 must hold and pace stay inside the venue's noise bar.
- Goldens re-recorded only for venues the accepted change moves.
