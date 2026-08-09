# OPENING PROMPT — THE HUMAN-LEVEL PUSH (paste this to the next instance)

THE HUMAN-LEVEL PUSH. Overnight run. **DO NOT STOP** — keep working until I stop
you. The goal is human-level performance on every venue; work the biggest gaps
first, find the specific sections where the gap is most extreme, identify causes,
propose fixes, and improve. Analyze → research → hypothesize → experiment →
evaluate → iterate. When a candidate dies, name the mechanism in ai-campaign.md
and move to the next shape; never idle the machine, keep ≥4 probes/benches in
flight.

**Open with**: memory `regatta-venue-table` (the current scoreboard, read it
first), `regatta-river-leg3`, `regatta-corpus-fingerprints`,
`regatta-standing-rules`, and THE HUMAN-LEVEL PUSH directive at the bottom of
`regatta/guidelines/ai-campaign.md`.

**Where things stand.** Eight venues now carry fresh, fingerprint-verified human
references (3 laps each) and five were promoted, so `freeze_venues --check` is
clean for the first time. Ratios, worst first: **redrock 2.82x** (bot 616 vs
218.2), **arctic 1.73x** (367 vs 212.4), **lagoon 1.68x** (277 vs 164.9),
**river 1.56x** (261 vs 167.4), **lake 1.25x** (278 vs 223.1), ocean 1.07x,
bay 1.06x, seatrials 1.03x. The gaps sort into three mechanisms — stalling
against land (river/redrock), extra distance on the beat (bay/lake/ocean), and
mark approach (arctic/lake L2) — each with per-section attribution already done.

**P0, before anything else: REBASELINE.** I merged mid-session
(`3594d11`/`a148db6`, script.js +487/−121) adding a **wind oscillator**
(`windOsc`, `computeWindPressureScaleRaw`), so every race on every venue changed.
Tonight's anchors span three code cuts and are a SURVEY, not gates. Pin HEAD,
build ONE tree, re-anchor all eight venues on it, and record them with the HEAD
hash. **Also unresolved and blocking: `bay/90210` and `bay/90211` fail the golden
verify reproducibly straight after a full `--update`** — deterministic, so a
harness/module-state bug (suspect the new windOsc time base; hunt it the way the
swell-clock bug was hunted). Landing gates are untrustworthy until that is closed.

**Then, in ratio order:**
- **P1 redrock (2.82x)** — leg3 sub0 at (−747,−1416) is +103.2 s/boat = 65% of
  that leg with the fleet at 16 u/s against her 83; leg5 has two more pockets. But
  every leg is 1.77–2.78x. Mechanism A. The sized candidate is the **clearance-bar
  ladder**: `CLEARANCE = HULL_R + 14 = 44u` against a 30u hull forbids 8.6% of the
  line she sails at 122–125 u/s with two contacts all lap. Ladder B1 38u → B2 34u
  → B3 30u → B4 scope on a measured grid property (never on venue name). This is a
  GLOBAL routing change, so every venue gates.
- **P2 river (1.56x)** — leg3 is 72% of the gap, four pockets hold 91% of its slow
  time, same signature. It is the transfer test: if the bar is the cause it must
  move river too; if redrock moves and river does not, the ladder dies.
- **P3 arctic (1.73x) + lake L2** — mechanism C, the mark approach (armed 45–65%).
  ⚠️ This re-addresses arctic: it has been carried as a tack-count/beat class and
  eight shapes have died against that address, but the subsection view says the
  beat's middle is near her pace and the time is at the rounding. Measure first.
- **P4 the beat-distance class (bay/lake/ocean)** — the fleet sails 16–27% further
  while being faster through the water, and that excess is their whole gap.
  Decompose it into avoidance deviation vs router path length vs tacking overhead
  BEFORE building anything.
- **P5 lagoon (1.68x)** — spread across legs, no single pocket, venue still moving.

**Constraints** (all binding, details in `regatta-standing-rules`):
actions-not-prices; episodes-not-frames; redrock pooled 6-set minimum and the
96-seed protocol near threshold; arctic pooled 4-set; river pooled fins/med; bay
≥4 disjoint sets under ~5s; probe audits; bench pairs together; goldens full
`--update` per landing; `freeze_venues --check` from the repo root; check `date`;
close with the venue table. ⚠️ Trap 21: `_pool_rr.js` and `_pool_arc.js` use
OPPOSITE sign conventions. Trap 22: judge inertness against a current-HEAD
baseline, never an old anchor. Trap 23: `_traj_fp.js` before quoting any human
reference. Trap 24: an `--update` that fails its own verify is a bug, not noise.
⛔ Closed, do not reopen: RR1–4, LANE1/LANE2 and tack-count-by-routing,
curved-on-redrock, laylines, station-keeping/holds/commitment/reservation, SIPP,
closing-lead pricing, occupancy stamps, current pricing, clearance-extension,
rollout speed, point-boat, arctic radius selection, arctic wide-ride, and start
calibration (ask me before reopening that one — the evidence is new but the
family is closed). Swamp and glowtide are not fully built and are not gates.
