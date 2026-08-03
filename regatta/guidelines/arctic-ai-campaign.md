# Glacier Sound AI Campaign — results log

*Running log of experiments and results for making the bots competitive on the arctic
map. Target: DNS 0%, DNF 0%, then median/max race time down toward the human benchmark
(4:13 = 253s). Course ideal-path estimate: 175s. Cutoff: 420s.*

## Best stats so far (CURRENT — updated Aug 3 night)

| Metric | Session start | Now |
|---|---|---|
| DNS (fleet, 20 seeds) | 41.7% | **0.0%** (7 consecutive rounds) |
| Fleet leg-1 roundings per eval | 0 (never, anywhere) | **5** (round18; banked t=329-419) |
| DNF/finishes | 0 finishes ever | **FIRST FLEET FINISH: t=404 (round20)**; 29/180 roundings |
| 12-seed solo benchmark (leg-1 progress) | n/a | mean ~80-82%, min 54, max 100; 1 in-time rounding |
| Solo, no floes | never finished | 213-240s (human best: 253s) |
| Solo @25% floes | — | ~285s finishes |
| Groundings/boat (fleet) | ~6,900 | ~630 |
| Penalties/boat | 5.1 | 2.03 |
| Clubhouse anchor | 203.4 | 203.7 — preserved, repeatedly re-verified |

**Current campaign state: every existence problem is solved (33+ root causes below).
The entire remaining gap to DNF-zero is PACE — roughly 60-120s across the transit
(worst: cove-mouth exit wobble on weak seeds — up to 120s lost) and the armed phase.**

## 🏁🏁 MILESTONE (Aug 3, latest): COMPLETE RACES AT FULL DENSITY
**Seed 4244 FINISHED t=531; seed 4246 FINISHED t=650** (true-uncapped runs — engine
cutoff raised in-page). The full chain start→finish works. Gap to the 420 cutoff:
~111s. Budget for 4244: bank at 330 (target ~250, transit pace) + return 201s (target
~150; return-leg route freedom just landed — #35 gated ALL rounding machinery to the
rounding leg after the entrance hunt was re-arming on leg 2 and steering finished
rounders back into the zone). Removal of hold-and-charge (#owner concern) also GAINED
+3.9 benchmark points (mean 90.0, min 55, roundings 3/12).
⚠️ METHOD BUG FIXED: "uncapped" tests previously extended only the harness loop — the
ENGINE's own cutoff (state.course.cutoff=420) still ended racing, so all t>420
readings in earlier extended runs were post-race parking noise. True-uncapped = also
raise state.course.cutoff in-page.

## #36 ACCEPTED (Aug 4): downwind carrot minimum — benchmark records
The return-leg 75s mill was a GYBING LOOP: the downwind twin of the upwind
carrot-orbit (tgt flipped between gybes every tick around a close dead-downwind
carrot). Lookahead minimum now applies within ~28 deg of dead downwind too.
**Benchmark: mean 92.3 (record), min 75 (was 55 — weak tail transformed), 3
roundings incl. NEW banks 4242@373 and 4247@384 (former exit-shell class).**
Also A/B'd and REVERTED: straightening 3.5s/80 (mean 90->83.8). Fleet round19:
12 roundings, DNS 0.0% x8, pen 1.75 (low). Remaining to in-time finishes: banks
330-384 need ~270 (outbound transit), returns ~200 need ~150.

## A/B ledger (Aug 4, cycle 2) — two clean rejections
- Straightening 3.5s/80: mean 90.0 -> 83.8, roundings 3 -> 1. REVERTED. 4.5s/50 optimal.
- Churn-wide orbit (swing rounding target out of _floeRisk water): 92.3 -> 91.3,
  roundings 3 -> 2. REVERTED — the longer arc costs more than the churn it avoids.
- #37 Tabu memory (repel candidates from recent floe-pin spots, 25s): 92.3 -> 87.8,
  roundings 3 -> 2, seed 4243 collapsed 100 -> 57 with 2x groundings. REVERTED.
  Same lesson as the soft cells: hard repulsion at a plugged gateway makes the boat
  WEAVE in front of it — the pocket is often the route, and grinding through is
  cheaper. Do not retry spot-repulsion; fix the escape completion instead.
- #38 Entry-hunt sector hysteresis (+8 margin to switch): mean 92.3 unchanged,
  roundings 3 -> 2 (4242 lost its bank; churn just moved elsewhere). REVERTED.
  The washing machine was NOT the entry rescan.
- #39 No-go-cone tax in applyAvoidance (+15000 max, |twa| < 0.55): mean 92.3 -> 73.6,
  ZERO roundings. REVERTED — worst rejection of the campaign. ⚠️ LESSON: this engine's
  polar still makes way at low TWA; the fleet's threading lines RELY on pinching
  through wind-facing gaps. Do not import real-world sailing constraints without
  checking the game polar first. The ring-lap disease (boat pinches to 0.7 at the
  gateway, bears away, laps ~250u circles for 90s) is REAL but its fix is not
  "forbid the pinch" — likely "beat through in short tacks" or accept the grind.
- (Also removed for real: the dead trough-timed lead in the orbit — its wind EMA died
  with hold-and-charge.)
Current accepted stack = the 92.3/75/3-roundings configuration. The benchmark's
determinism is now double-confirmed (identical decimals on unchanged code).

## 🏁🏁🏁 MILESTONE (Aug 4): FIRST FLEET FINISH UNDER THE CUTOFF
Round20: **1 finish at t=404** in a real 10-boat race, full density — plus **29 leg-1
roundings** (12 -> 29; the downwind-carrot fix compounding through the fleet). DNS
0.0% x9 rounds, pen 1.83. DNF has moved off 100% for the first time in the venue's
history. Next: raise the finish rate — 29 rounders is the pipeline, and the ~100s of
mapped slow segments (cove-mouth ~25s, NW entrance ~25s, ring churn ~75s) is the ore.

## Trace findings (Aug 4, seed 4242 solo, 1Hz steering trace)
Remaining sinks and their MECHANISMS (solo_trace.js + 15s-window profile):
- t150-180 NW entrance (~25s): boat bleeds to 0.07 speed close-hauled, then a wiggle
  frees it. Not yet diagnosed why it pinched to a stop.
- t270-302 "washing machine" (~30s): boat sails literal circles at the ring approach —
  target flips 0.79 (straight at entry) <-> -2.5 (SW detour) every 2-4s, dmc progress
  pinned. The ENTRY-hunt has no commitment lock (exit-hunt does); floes drifting
  reshuffle the best sector every rescan. Fix candidate #38.
- t313-345 wiggle/re-pin loop (~30s): wiggle finds the right beam-reach escape and
  gains speed, but land clearance is 1.5s and a near-stationary boat's avoidance
  rollout can't see the floe it rests on (dev=0 while col=floe), so nav commands
  straight back into the pocket. Fix #37 TABU MEMORY (in A/B): remember pin spots
  25s, price candidate rays that re-enter them.

## THE TIME BUDGET (Aug 4, first uncapped FLEET profile — fleet_leg2.js, 8 seeds)
Uncapped (cutoff 900): **40/72 boats round, 25/72 FINISH** (t 394-900; one in-time at
394, three near-misses 516-537). The pipeline is complete; everything left is pace.
- Leg 1 (outbound, 12467u): median 465s, p25 405, MIN 249. THE BOTTLENECK.
- Leg 2 (return, 11274u): median 243, p25 172, MIN 104. Fast returns already exist.
- Budget for a 420 finish: ~10 start + ~250 out + ~150 back. Both minimums exist
  singly; they just never co-occur yet.
- Stall map (both legs): one cluster — the WEST CHANNEL corridor, x -1800..-3600,
  y 0..1800. Fast returners cross the band in 1-2 samples; slow ones sit 4-5 min.
- Seed 9104: FIVE boats milled in a 1500u box for 300+s — mutual GIVE_WAY/STAND_ON
  deflections at 0.3-1.0 kt compounding with floe deflections (the multi-boat
  washing machine; the convergence failure Wes warned about). -> #40 jam-speed
  damping of the RRS SHAPING terms only (hold-course/bow-cross/duck/R16 scaled by
  min(1, spd/1.4); hard Rule-14 collision terms untouched). Gate = fleet_leg2, NOT
  the solo bench (solo cannot see boat-boat costs).
- **#40 ACCEPTED (paired A/B, 8 seeds, boats matched by name):** paired leg-2 delta
  med -80s / mean -64s; corridor dwell 123 -> 109s/rounder; rounders 40 -> 44; finish
  median 742 -> 701. Paired leg-1 med -3 (neutral). The raw finisher drop (25 -> 20)
  was a 900-cap threshold artifact of later rounding times. Baseline rerun reproduced
  the original byte-identically — instrument now writes labeled JSONs
  (fleet_leg2_<label>.json); never overwrite an A/B side again. Solo bench: 92.3/3
  roundings, unchanged — PASS. Clubhouse PAIRED anchor (100 races, both trees):
  pre-#40 204.23/200.08 vs with-#40 204.34/200.44, pen equal, collB 0.55 -> 0.51 —
  NEUTRAL, #40 confirmed safe ungated. (Note: the working tree's Clubhouse anchor
  has drifted +0.5 from the stored 203.75/199.84 across this session's accepted
  arctic work — refresh the stored number when landing.)
- #41/#41b REJECTED — the whole WIND-CONE FAMILY is closed. Three shapes, tightening
  scope each time: global 15000 tax -> 73.6; global 900 nudge -> 82.7; wall-scoped
  900 nudge -> 87.1 (baseline 92.3). Monotone recovery with scope says even perfect
  scoping only reaches par. ⚠️ WORKING THEORY: the irons-hover at a plugged wall is
  LOAD-BEARING — a hovering boat takes the slot the moment drift cracks it open; a
  boat that tacked decisively away misses it. The ring laps are crude GAP-WAITING,
  not pure waste. Future ring-time attacks should improve WHERE/WHEN to wait (gap
  timing, stagger, entry choice), not punish the waiting itself.
- (#41 original note, superseded) — sailability NUDGE: avoidance prices candidates by deviation only, so
  with open water dead upwind an irons candidate (cost ~5) beats the honest tack
  (cost ~18) and the boat parks/laps at the ring wall. #39's 15000-point 31-degree
  tax broke threading; #41 is (1 - twa/0.6) * 900, only at speed > 1.0 — breaks the
  deviation tie toward the sailable board without forbidding the pinch. Outbound
  stall map says the ring basin holds ~half of all fleet stall time (700/1437
  windows) — this is the biggest remaining prize.

## #42 ACCEPTED (Aug 4): ENTRY-SECTOR CROWDING
Rivals nearer the mark (same leg, unarmed, within zone*2.5) claim their approach
sector; the entry-hunt penalizes sectors within 0.6 rad of a claimed one (-7 * ramp).
Deterministic, no randomness; fires only when a queue actually forms (3/8 seeds ran
byte-identical). Paired fleet A/B vs the #40 stack, same seeds: rounders 44 -> 47,
finishers 20 -> 25 (+25%), paired leg-1 mean -11s, paired leg-2 neutral. Solo-neutral
by construction (rival scan skips finished boats). Follows the standing theory:
waiting at a slot is load-bearing; QUEUEING at one slot is the waste.

## #43 ACCEPTED (Aug 4): GAP FORECAST IN THE RING SCANS
The +8s floe-occupancy map (already computed for soft-cell classification) is now
persisted (g._futBlk) and the entry/exit sector scans discount CLOSING cells (clear
now, blocked at +8s: credit 1 -> 0.3). Sea-ice pilotage applied to where-to-wait:
take the opening lead, never the closing one. Paired fleet A/B vs the #42 stack:
rounders 47 -> 51, finishers 25 -> 30 (42% of fleet), paired leg-1 neutral — it
unblocks marginal boats rather than speeding leaders (finish median moves with the
growing tail). Solo 92.3 -> 91.3/2 roundings: one-seed reshuffle, accepted.
Session uncapped trajectory: finishers 25 -> 20 -> 25 -> 30 across #40/#42/#43;
rounders 40 -> 44 -> 47 -> 51.

## #44 REJECTED (Aug 4): far entry-hunt (wake at 3.5x zone, was 2.1x)
Fleet: rounders 51 -> 43, finishers 30 -> 20, paired leg-1 +36s; solo 89.4/2.
REVERTED. From 3.5 zones out the sector forecast is STALE by arrival, and the
direct sector aim bypasses the route's channel threading. The entry choice
belongs at ruler range where the +8s forecast is still live. Round21 note: at the
420 cutoff the stack scores 0 finishes on seeds 100-119 (round20's t=404 was a
tail event); the wall is pace, uncapped throughput is up (25 -> 30 finishers).

## #45 REJECTED-NEUTRAL (Aug 4): door-hold at plugged entry slot
Hold at 1.35x ring, speed 0.45, when the chosen sector's door cell is plugged.
Solo neutral (91.3/2, mostly byte-identical; 4242 groundings halved where it
fired), fleet EXACTLY neutral (51->50/30->30/dwell p90 375->360). The plugged-door
cut-in is a rare path — the ring laps originate in armed churn and avoidance
bounces, not the charge at the door. Reverted: neutral complexity is still cost.
⚠️ Method note: do NOT rsync treeA while a bench reads from it — stop, sync,
relaunch (one bench was killed and rerun for this).
RING DWELL WALL STATUS: med 165s / p90 360-375s has now resisted SEVEN mechanisms
(orbit widening, tabu, entry hysteresis, wind-cone x3, far entry, door-hold —
crowding and gap forecast are the two that paid). Classical seam is thinning;
Wes pre-approved an RL pilot when classical plateaus — the ring/channel
micro-control is the natural first RL scope if the next 1-2 classical ideas miss.

## CHECKPOINT (Aug 4 end): THE RING PLATEAU, QUANTIFIED — AND THE RL FORK
Phase decomposition (fleet, 8 seeds): pre-arm med 21s (fixed by entry-hunt+#42+#43),
exit med 20s (fixed by exit commitment), **SWEEP med 125s / p90 354s = the wall.**
#46 orbit-hold epilogue: solo BEST EVER (93.2 mean / 4 roundings / 4242 ice 495->108)
but fleet-negative under all three rival gatings — even empty-ring holds hurt the
holder. **Engine economics finding: soft cells are passable, contact is cheap, sweep
unwinds only on net drift-back — GRINDING FORWARD BEATS WAITING.** The fleet's laps
were near-optimal already; ring mechanisms 10, paid 2 (#42 crowding, #43 forecast),
both about SPREADING boats across options, never about individual restraint.

Classical status vs mission: DNS 0% permanent; uncapped 51/72 round + 30/72 finish
(from 0 finishes EVER at campaign start); capped-420 finishes 0-1/round — the wall
is ~150s of sweep grind that ten classical mechanisms did not dent.

**RL GROUNDWORK BUILT (Aug 4, end of session):** `scratchpad/rl_env.js` — a working
reset/step environment over the SWEEP PHASE (reset fast-forwards a solo hero to ring
arming; step = 0.5s; action = [orbit-advance angle 0.15-1.2, speed 0.4-1.0]; obs =
26 floats: 16-sector ring occupancy w/ opening/plugged/closing grades + sweep frac +
bearing/dist/speed/drift/twa/time; reward = 3*dSweepFrac - 0.02 - 0.3*contact, +5
bank / -2 timeout). Hooks live in script.js gated on `window.__rl && boat ===
window.__hero` — inert in play/eval (bench-verified). FIRST RESULT: on seed 4244 a
RANDOM policy banked in 160s where the classical orbit TIMED OUT at 300s; across 6
seeds random completes 3 (101-160s) and craters on churn seeds — real headroom,
learning needed. Next session: batch stepping (steps-per-call up), parallel envs,
then policy search (2-D action space — even CEM/CMA over a small linear policy
before neural PPO), fleet fine-tune with an arc-blocking penalty.

**⚠️ TRANSFER LESSON (the day's most important):** #46 (orbit-hold) and #47
(advance 1.1, found by the env's own grid search) were BOTH solo-superior and BOTH
fleet-rejected with the same signature (rounders -10, sweep +20-100s). The solo env
systematically overrates aggressive/patient unilateral tweaks because traffic is
the binding constraint. Consequences for the pilot: (1) obs MUST include rival
positions (current 26-float obs lacks them); (2) training MUST include fleet
episodes or a fleet fine-tune stage — a solo-trained policy will ace its env and
fail the game; (3) the fleet_leg2 8-seed paired gate stays the ONLY acceptance
criterion. Classical constants are CONFIRMED at a traffic-local optimum: 10+ ring
interventions, 2 paid, both distributional (#42 crowding, #43 forecast).

**THE CLOSING EVIDENCE (traffic grid):** the same constant-action grid run IN
TRAFFIC (hero among 8 classical bots): advance 0.6 / 0.85 / 1.1 all bank 1/4 at
meanT 236-246 — indistinguishable. Solo, constants matter (1.1 > 0.85 by 15s);
in traffic, NO constant matters. Three-way proof that only a state-dependent
(traffic- and ice-aware) sweep policy can beat the ring. The RL pilot's thesis is
now evidence-backed from every direction the classical toolkit could probe.

**RL fork (Wes pre-approved at classical plateau):** the natural pilot is a SWEEP
POLICY — observation: local 16-sector occupancy/soft/futBlk + drift + sweep state +
rival positions; action: orbit-advance angle + speed request; reward: sweep-rate
minus contact minus unwind; trained in the existing headless harness (deterministic
seeds, 10Hz). Scope: replaces ONLY the armed-orbit target selection on land venues;
classical stack stays for everything else. Next session: build the gym wrapper
around eval_harness + a small policy (even a table/linear baseline first), behavior-
clone from the 93.2-solo trajectories, then fleet-fine-tune with the gridlock
lesson in the reward (penalize blocking arcs).

## RL PILOT ROUND 1 (Aug 2 2026 session, evening): loop BUILT, first policies fleet-REJECTED
The full training loop from the pilot scope now exists in `regatta/eval/rl/`:
- **Batch stepping**: whole episodes run inside ONE page.evaluate (policy computed
  in-page) — was 601 round-trips per episode.
- **Parallel envs**: pool of headless pages (6 used; 12 logical cores).
- **Rival positions in obs**: 42 floats = the 26 + a 16-sector rival-occupancy
  ring around the mark (each rival within zone*2.5 adds 1−d/R to its sector).
- **Policy**: LINEAR, 86 params, tanh-squashed into the action box, initialized
  at the classical constants (0.85 advance / 1.0 speed). CEM: pop 16 solo /
  12 fleet, elite 25%, common seeds per iteration, decaying sigma noise.
- **Fleet episodes**: `--stage fleet` leaves the 8 rivals racing classically and
  adds an arc-blocking proxy (−0.05/step per armed rival within 350u).
- **Gate**: `rl_gate.js` = fleet_leg2's exact measurement with the policy driving
  EVERY armed bot via the new `window.__rl.actFor(boat)` hook in script.js
  (inert without the flag — PROVEN: a baseline gate rerun was byte-identical to
  the stored accepted-stack JSON after stripping the newer tArm/tOut fields).

Arming probes: all 12 solo seeds arm (t=203–439); in traffic 9/12 (4243/4249/
4253 never arm). Training learns on matched seed windows in both stages (solo
window B best −96.8→−36.3 across revisits; fleet window B −100.4→−60.2, hard
window banked 1/3→3/3). Learned weights are sensible: advance head keys on
drift dir + ice/rival sectors, speed head almost entirely on rival sectors.

**GATE (sole criterion, seeds 9100-9107 paired vs accepted stack 51/72 rounders,
30/72 finishers):**
- bestEver candidate: 43/72 rounders, 23 finishers — REJECTED (survivors faster:
  paired leg-1 −13s med, leg-2 −37s; throughput down = the #46/#47 signature).
- Final CEM mean: **48/72 rounders, 25 finishers — REJECTED, but nearly
  paired-neutral on times** (leg-1 +10s med, finish −1s med, sweep-phase −21s
  mean). The gap is 3 rounders / 5 finishers of marginal-boat throughput.

**Diagnosis**: even with rival obs + fleet episodes, training still optimizes
HERO return in classical traffic while the gate scores ALL-bots-policy fleet
throughput. Two mismatches remain: (a) credit — hero reward can't see the
throughput of the other 8; (b) regime — training traffic is classical, gate
traffic is the policy itself. **Next lever (cheap, ~9 min/iter feasible): CEM
scored directly on fleet-level return — install actFor for all bots in the
training episode and score rounders/finish-time over a 600s window. That
optimizes the exact gate quantity.** After that: neural policy, and extending
scope to the approach beat (owner play-report: bots stuck head-to-wind on the
push up to the glacier, refusing sailable gaps, weak upwind — the beat is
outside the current pilot scope).

## RL PILOT ROUND 2 (same session, late): FLEET-RETURN CEM — gate-REJECTED but
## the picture changed
`--stage fleetret`: CEM scored on the GATE QUANTITY itself — all 9 bots run the
candidate (actFor), score = rounders/finishers + time & leg-1-progress credit
over a 700s window, cached CLASSICAL reference per training seed, gate seeds
9100-9107 strictly held out. 8 iters, pop 12, 3 seeds/iter, init from round-1
fleet mean. TRAINING: elites beat classical on 3 of 4 first-visit windows; on
revisits the MEAN beat classical on windows B (9.86 vs 8.99, +2 fins) and D
(11.72 vs 10.91, +3 fins), lost A and C. **HELD-OUT GATE: 43/72 rounders, 24
finishers vs 51/30 — REJECTED (3rd rejection: 43/23, 48/25, 43/24).** But: the
survivors are FAR faster (paired finish −39s med / −98s mean, leg-1 −35s mean),
and seed 9102 produced the FIRST PERFECT RACE in venue history (9/9 finishers,
two in-time 391/414) plus another in-time at 9107 (404). The policy trades
tail-boats for speed; classical nurses tails at the cost of pace. ⚠️ LESSON:
training-window wins on 12 seeds did NOT transfer to 8 held-out seeds — a
LINEAR policy at this budget overfits seed-specific structure. Queued rerun
prescription: score-v2 (gated per-leg DMC — current score has NO leg-2 gradient
for non-finishers, penalizing exactly the tail-nursing the gate rewards),
seedsPer 4-6 for less noisy elites, more training seeds (any seed works for
fleetret — no arming precondition), then neural if linear still overfits.

## ═══ NEXT MAJOR SECTION (approved Aug 5 night, owner going to bed): ═══
## FROM HUMAN EVIDENCE TO BOT PACE — trajectory-informed classical round
The 26-trajectory human reference (traj/, traj_report.js) replaces guesswork
with measured targets. Overnight scope, in priority order, ALL under the
standing discipline (A/B ledger; paired fleet_leg2 vs basecheck + 12-seed solo
bench as gates; DNS 0% held; Clubhouse anchor + goldens re-verified before any
land; treeA re-synced only between benches):

1. **MARGIN REDUCTION A/B** — the 15-for-15 finding: human clearance floor
   14-19u vs bot reactive pads 70-120u (movePad 70, planner floe margin 120,
   grid floe stamps, traj-planner contact thresholds). Step them toward the
   human envelope (not TO it — bots lack human reflexes; try ~50%, ~30%).
   Hypothesis: leg-1 transit med 465 drops materially; watch groundings and
   the 4246-entrapment class for the failure mode.
2. **UNSTICK REFLEX v2** — first ANALYZE the 8 recorded human escapes (heading
   vs motion-vector during pins: do they back out, rotate, or power through?),
   then build the reflex the data describes; gate = pinned-boat dwell in
   fleet_leg2 stalls + solo bench. The human pins all resolved ≤13s; bots sit
   30-300s.
3. **LEG-1 LINE STUDY** — overlay human tracks vs bot routes (same course
   doc); find the systematic line difference behind human 129-185s vs bot
   249-465s; derive at most ONE router/pursuit change and A/B it.
4. (stretch) **OCS BANNER** — owner mistook a correct OCS hold for a missed
   crossing; make the OCS state loud (banner + return arrow). UI-only.
Non-goals overnight: neural RL (decision deferred until 1-3 report), new
venues, engine sweep-semantics changes (owner-consult only).

## CARRY-FORWARD PROMPT (for the next session / overnight continuation)
"Continue the arctic AI campaign, section: FROM HUMAN EVIDENCE TO BOT PACE.
Read regatta/guidelines/arctic-ai-campaign.md (this section + the four-level
architecture + RL rounds 1-2b) and memory regatta-arctic-ai. Repo is committed
clean at the session-close checkpoint; treeA snapshot convention per
regatta/eval/rl/README.md; human data in regatta/eval/rl/traj/ with
traj_report.js. Run experiments 1-3 above under the standing gates (paired
fleet_leg2 vs fleet_leg2_basecheck.json, solo bench ref 91.3/2, DNS 0%,
Clubhouse anchor 204.34/200.44, goldens npm run trace). Keep the A/B ledger in
this doc; commit accepted checkpoints; leave a session-close STATE entry in
memory."

## RL PILOT ROUND 2b (score-v2): REJECTED — LINEAR-POLICY CHAPTER CLOSED
Score-v2 (gated per-leg DMC incl. leg-2 credit, finisher bonus 3.0, seedsPer 4,
init from v1 mean): training again beat classical on window revisits (window 2
mean 9.19->11.29 vs classical 9.92; iter-7 best 13.71 = 19r/12f), and the gate
again rejected the mean: **42/72 rounders, 18 finishers vs 51/30** — the leg-2
credit bought tail-nursing by GIVING BACK ring pace (paired sweep-phase +60s
med) and still overfit the 12 training seeds. **Four-verdict ledger: 43/23,
48/25, 43/24, 42/18.** Conclusion, evidence-backed from four angles: an
86-param LINEAR policy at CEM budgets of this size cannot hold pace AND tails
across unseen seeds — the policy class is the binding constraint now, not the
objective (three different objectives produced the same transfer failure).
Escalation options (owner decision): (a) small NEURAL policy (2-layer, ~1-2k
params) on the fleetret objective — needs bigger budgets, likely overnight
runs; (b) FIRST: the cheap classical experiment the human trajectories
motivated — cut reactive floe margins toward the measured 14-19u human
clearance (bots use 70-120u pads) and A/B at the gate; (c) crew-level RL with
BC warm-start from the recorded trajectories. Recommendation: (b) next — it's
an hour, it's evidence-driven, and its result informs whether (a) is even
needed at the tactician level.

## THE FOUR-LEVEL PLANNING ARCHITECTURE (owner proposal, Aug 5 — working direction)
⚠️ **OWNER RULE (Aug 5): everything in this section — and the RL-per-level
priority and scoring ideas below — is HYPOTHESIS until an experiment supports
it.** Nothing here is pre-accepted: each refactor toward the levels must hold
the Clubhouse anchor + trace goldens like any change, and each RL-scoped level
must pass its own paired fleet_leg2 gate ALONE before it ships or stacks.
Wes: structure the AI as four levels with real-life parallels — **navigator**
(high-level path planning / routing), **tactician** (localized sailing planning:
wind, tacking, gybing, current), **driver** (near-term response to moving objects:
boats, bergs), **crew** (controls: turning and trim done well).

**Why this is right for THIS codebase:** the game already has proto-versions of
all four (grid A* router ≈ navigator; scoreTack/getStrategicHeading ≈ tactician;
planFloeTrajectory + applyAvoidance ≈ driver; wiggle/escape/speed-discipline ≈
crew) — but they are tangled, and most of this campaign's root causes were LAYER
VIOLATIONS, not missing capability: #34 two deciders sawing the rudder (planner
threads a gap, grid probe vetoes it), #11 a reactive commitment discount
overriding strategy for 30s, #14/#15 frozen nav targets in the seam between
router and pursuit, #7/#31 rounding handoff fights, and the round-5-8 lesson
that wiggle/escape/avoidance deadlock when ownership is unclear. The proposal's
value is CONTRACTS, not new machinery.

**The contracts (target state):**
- Each level owns ONE question at ONE horizon, and outputs a clean artifact to
  the level below. Navigator: corridor route + time costs (recompute ~4s).
  Tactician: a "board plan" — target TWA/tack, maneuver schedule, speed plan
  (~1s cadence, 10–30s horizon; owns laylines, shift/pressure timing, current).
  Driver: a trajectory honoring the board plan while dodging moving obstacles
  (0.1s cadence, 2–10s horizon; owns velocity-obstacle reasoning). Crew:
  rudder/trim execution with GUARANTEES — never park in irons, carry way
  through tacks, turn at the rate the boat can actually turn.
- ONE owner of the rudder per tick. Intent flows down; lower levels have
  BOUNDED, EXPIRING authority to deviate (the ≤2.5 router-weight cap and the
  −60 tie-break commitment are the proven sizing pattern). Hard-safety
  (Rule 14, grounding-imminent) may bypass upward but must be visible in traces.
- Every level readable in one trace line (goal/board/traj/helm) — the
  goal/gp0/navT/strH/tgt trace that cracked #11 becomes the standard format.

**Mapping the owner's play observations to levels:** head-to-wind hangs on the
glacier push = missing CREW guarantee (irons is always a controls failure even
when the plan is bad); refusing sailable gaps / not turning hard enough =
DRIVER (13-heading fan too coarse for "hard turn now"; candidate costs can't
express commit-through-a-closing-gap); weak upwind in the katabatic =
TACTICIAN (VMG/shift timing at 25–32kt).

**RL mapping (why the levels help the RL campaign):** a level is a trainable
scope with a clean observation/action/reward seam and a classical fallback —
swap ONE level at a time. The sweep pilot is a phase-scoped TACTICIAN policy.
Driver and crew have the densest rewards (contact avoided, way kept on) and the
shortest horizons — the best next RL candidates, and exactly where the play
observations point. Navigator stays classical (A* with time costs is already
near-optimal and debuggable).

**RL-per-level priority (owner + assessment, Aug 5): CREW first, then DRIVER,
tactician already in flight, navigator never.** Crew is the best RL target in
the whole stack: densest reward (VMG to commanded heading, way kept on, no
irons time), shortest horizon, tiny obs/action, and VENUE-AGNOSTIC (pure boat
physics + wind — one trained crew works everywhere, validatable on open-water
anchors). Driver second (replaces planFloeTrajectory's fan scoring; local
occupancy + drift obs; progress-minus-predicted-contact reward). Tactician is
measurably the hardest (sparse reward, traffic coupling — round 1 proved it);
finish the in-flight pilot but don't start new work there first. Train
BOTTOM-UP (a tactician atop a flaky crew learns bug compensations), ONE learned
level at a time, each behind its own inert flag-gated hook (the actFor
pattern), each passing the fleet_leg2 gate ALONE before stacking.

**Migration rule — no big-bang rewrite:** every new fix or mechanism DECLARES
its level and goes through that level's interface; refactor toward the
contracts as files are touched. The venue-scoped gating pattern (land venues
only) stays orthogonal to the levels.

## Fixed root causes (chronological)
1. Visibility planner blind to keyholed coast → bots route on SailCheck grid.
2. Global vs local wind in wiggle/start/nav (110° apart here) → getWindAt everywhere tactical.
3. BotController timers 6× slow (frame-dt in 10Hz body) → TICK, with open-venue parity constants.
4. No island/wall contact reflex; polygon-arena boundary check never fired.
5. Stale-carrot path following → pure pursuit + sticky carrots + cross-track lookahead.
6. Rounding orbit at zone*0.92 through a 1.3-hull gap → follow the DMC ruler path.
7. Rounding never released (path ends inside completion radius) → next-leg handoff at sweep.
8. Router weights inverted topology (7× wall cost → detours away from course) → bounded ≤2.5.
9. Avoidance "commitment" became a lock (−400 ≫ deviation costs) → tie-break only (−60).
10. **Phantom walls: reactive avoidance ran segmentIntersectsPoly against the keyholed
    coast — the keyhole slit is an invisible wall crossing open water.** This was THE
    dominant bug: solo boats were deflected (dev 1.6–3.0) at the slit until they piled
    onto real shores. Land avoidance now samples the grid; polygons only for floes.
11. widen() radii > arming zone → boat never armed the rounding, sweep unearnable →
    widen capped at zone*0.94 + orbit-continuation when under-swept at path end.

## Architecture (current)
- **Routing**: time-cost A* on the sailability grid (polar speed toward each step's
  bearing in that cell's wind, 16 dir × 6 speed bins; isochrone-style objective) +
  bounded hints (clearance, lee shore). Floe-aware grid rebuilt every 4 sim-s with
  floes stamped at mid-cadence predicted positions.
- **Local**: pure pursuit with clearance-adaptive lookahead + cross-track shrink;
  DMC-path following on the rounding leg with sticky carrots.
- **Reactive**: candidate-heading avoidance; land via grid sampling; floes via
  drift-predicted polygon tests (velocity-obstacle-lite); boats via RRS-aware costs.
- **Recovery**: wiggle (venue-scoped eagerness), 2s ice-escape reflex, mid-race
  liveness (land venues only), penalty spiral deferred near ice.
- All arctic-specific behavior gates on "venue has authored land" → Clubhouse anchor intact.

## Open problems (priority order)
1. **Floe-field transit**: solo boats stall in the west-channel pack (~62–296s cove exit,
   then bogged). Predictive avoidance + grid stamps landed; not yet sufficient.
2. **Fleet start**: DNS ~14% with floes — start-line rafts on the north shore.
3. Fleet-context pace once solo pace holds.

## Round of Aug 2 (late): route freedom, soft cells, leads, pack speed
- **DNS reached 0.0% fleet-wide** (round12, 20 seeds, 180 boats) — goal #1 done.
- Solo no-floes: 4/4 finish 213–240s (beats human 253s). @25% floes: finishes 277–294s.
- Density cliff between 28 and 56 floes. At 100%: best boats reach 60±10% of leg 1.
- Fixes this round: route freedom outside the rounding zone (sticky ruler carrots had
  pinned boats to the ideal line so the router could never go wide — one bend plateau
  held a fast boat 300s with an open corridor next door); soft floe-plug cells
  (grind > wait); lead opening/closing pricing from known drift (+8s horizon);
  pack speed discipline (contacts collapsed 1112→83-436, progress flat).
- **Classical plateau reached**: routing is good, local execution among 5-10 drifting
  floes at 15-25kt is the bottleneck.

## Next: proper local trajectory planner (then RL if needed)
The current reactive layer evaluates STRAIGHT 4s probes per heading — it cannot
represent "turn between these two floes then bear away." The right classical answer to
moving obstacles is a short-horizon TRAJECTORY search: sample arc/tack trajectories over
~8-12s, roll floe positions forward along each (drift is known exactly), score by
progress-along-route minus predicted contact. Replaces the floe portion of
applyAvoidance on land venues. If that plus tuning cannot break full density, train a
small RL policy for local steer (user-approved escalation).

## Trajectory planner round (Aug 2, night)
- **planFloeTrajectory**: 13-heading fan, 9s rollouts (turn-toward then straight),
  floes rolled forward on known drift per step, land via grid, score = progress toward
  nav target − predicted contact − deviation; keep-if-clean short-circuit; per-boat
  aggro/handling weights for fleet diversity. applyAvoidance skips floes when it ran.
- Results (solo, full density, sMax% of leg 1): TRAJ 69/38/68/70 (one seed ZERO
  contacts); +predictive-only speed discipline: 72/38/58/70/69/30 with THREE clean
  seeds; grind-commitment rebalance: flat (72/36/69/70/70/32).
- Fleet round13: DNS 0.0% holds, groundings 863, pen 2.19. Round14 pending.
- **THE WALL: s≈70% = cum 8700 = the NE beat into the katabatic through the NW narrows.**
  Every config caps there. 25-32kt on the nose (±7 osc, 120s period) + narrows + plug.
  Clean-track plot (seed 4248): perfect green sailing everywhere EXCEPT a dense knot
  exactly there.

## The 70% wall — solved (root cause #14: dead-band orbit)
The "katabatic wall" at s=70% was NOT wind and NOT ice: the route-freedom far
destination (path vertex before zone-approach, 2428u from mark) sat OUTSIDE the
ruler-mode switch radius (zone*2.1 = 1787u). Dead band: destination reached, mode never
switched, boat ORBITS ITS OWN DESTINATION at full speed. (Instrumented: navT frozen at
(-1708,-1364) while the boat circled it for 150s; the hold-and-charge experiment showed
even an 18kt trough didn't help — correctly falsifying the wind theory.) Fix: far-dest =
the zone-entry point itself, so arrival implies the switch. After: best seeds 84%/79% of
leg 1 (wall was 72%); two seeds now pay more ice at the basin ring; two still choke
earlier (~35%). Round14 fleet: DNS 0.0%, groundings 269/boat (was 6,900), pen 2.37.
LESSON (three times now): "boat mills at spot X at full speed" = FROZEN/CONFLICTING
NAVIGATION TARGET, not water conditions. Trace goal/navT/strH/tgt FIRST.

## Root cause #15: grid-path pursuit lacked sticky carrots on beats
Cross-track shrink pulled the pursuit carrot to ~150u; dead upwind that is unfetchable
in one board and the boat orbits it at full speed (seed 4249 milled at s=30% for 250s).
Fix: minimum lookahead 420 when the path ahead runs upwind. 4249: 30->50%. Round15
fleet: DNS 0.0%, pen 2.01 (best), ground 357.

## Method note (Aug 3): the gate metric needs to be statistical now
Single knobs move individual seeds +/-30% (chaotic reshuffling). Adopt a fixed 12-seed
solo benchmark (mean sMaxPct of leg 1 + finishes + contacts) as the experiment gate;
6-seed eyeballs are no longer decisive. Current benchmark state (6 seeds, latest stack):
85/35/57/36/79/50, several clean (0-contact) full-density transits.

## Benchmark era (12-seed solo gate)
| config | mean | min | max | roundings | clean |
|---|---|---|---|---|---|
| baseline-post15 | 67.5 | 35 | 91 | 0/12 | 1/12 |
| +mode hysteresis (#16) | 68.1 | 35 | 91 | 0/12 | 1/12 |
| +hull stamps (#17) | 69.9 | 43 | 92 | 0/12 | 0/12 |

#16: ruler/far mode flapped at the single switch radius (orbit of the whole basin ring
at d 1500-2300); dual thresholds (enter 2.1x, exit 2.8x zone). #17: floes were stamped
into the grid as BOUNDING CIRCLES +59 — physically-open 200u gaps read closed; now
stamped as their true hull polygons (contacts rose: tighter real threads get taken).
NOTE: benchmark sMax is partly lateral projection onto the arc — boats orbiting at
d1500 project onto arc segments; treat 85%+ as "at the rounding", not "around it".

## THE BOSS FIGHT (all that remains for DNF): the zone endgame at full density
Boats now reliably reach the basin ring (~85-92%). No configuration has ever armed the
rounding at full density (arm=0 always; the 18kt-clamp teleport test DID round). The
ring rafts shut on the ruler's southern entry (wind from NE drifts floes SW onto it);
the windward (NE) sector is drift-swept clean. Next: dedicated zone-approach behavior —
choose the clearest radial sector from the LIVE grid (line-of-sight into the zone),
enter there, and let orbit-to-sweep machinery finish; the ruler's entry bearing is a
fair-weather suggestion only.

## MILESTONE (Aug 3): first full-density zone entry + active rounding
Entry-hunt (#18: scan 16 zone sectors against the live grid, ride the ring the required
way to the clearest radial, cut in) + soft goal snapping (#19: pathSailable endpoint
snapping now accepts soft cells — before this, every zone-interior target was silently
relocated OUTSIDE the pack ring, which is why no config ever armed): **seed 4244 armed
at full density, minD 494, actively rounding the north side when the race ended at
t=425** (arrived at the zone at t~360). Benchmark: mean 71.8/71.7, max 95.
THE WHOLE CHAIN NOW WORKS AT FULL DENSITY — remaining problem is PACE: zone arrival
needs to move t~360 -> t~250. Next: fresh transit loss budget on the current stack;
the 200-300s cove-to-basin transit is where the race is lost now.

## Straighteners + wide sweep (Aug 3, late)
- #20 straighteners (trajectory planner deviates only for contact <4.5s and clearly
  better lines; speed discipline only <3s): benchmark mean 71.8 -> **80.0** (biggest
  single gain of the benchmark era; 4 seeds at 90+).
- Uncapped 600s runs: arming now at t=271/319, but the ROUNDING still never completes.
  #21 armed-wide-sweep (after arming, widen ladder to 1.75x zone — sweep counts to
  2.5x, completion needs >1.25x, so the fast line is: nick the zone, sweep outside the
  ring): 4244 improved (no longer flung to the map corner) but not completing;
  4245 is BYTE-IDENTICAL across runs — physically TRAPPED on the pack inside the zone
  from ~t350 (endPos (-483,-2641), d=769). Nav changes cannot matter while pinned.
- Two remaining endgame defect classes: (a) post-arming wander (4244) — needs the
  target-chain trace treatment on the armed phase; (b) in-pack entrapment (4245) —
  needs a real unstick (sternway/back-out, or prevention: don't cut into sectors that
  are closing behind you).
- Clubhouse anchor re-verified byte-stable: 203.71/199.23.

## Rounding endgame campaign (Aug 3, night) — #22-#25, unfinished
First fleet-context leg-1 completion (round16: 1 rounding in a full 10-boat race,
DNS 0.0%, pen 2.05). Endgame fixes so far: #22 sweep-aware escapes/wiggles (rotation-
tangent tie-break near the zone — escapes were refunding sweep, +0.6 -> -0.85); #23
latched outbound handoff (sweep oscillates around the 2.55 requirement); #24 radial-out
exit (engine banks on LIVE sweep at departure, not max); #25 outward-spiral orbit
(sweep beyond zone*1.25 so completion happens by construction). State: seed 4244
repeatedly peaks sweep 2.89-2.90 vs need 2.55 and STILL never banks — the peak and the
departure condition (d>1064, moving out) apparently never coincide. NEXT DIAGNOSTIC:
joint sweep(t)+d(t) series around the peak; if sweep>=need only ever happens inside
d<1064, the spiral is being dragged in by locals — consider stronger radius hold, or
(with user sign-off) revisit how the engine's departure test interacts with pack chaos.
4245/4246 peak lower (0.77-0.95) — they lose the rotation battle earlier; entrapment
class. Counters removed; orbit confirmed executing 739 ticks.

## The knife's edge (Aug 3, latest) — where classical stands
Endgame refinements #26-28 (always-on outbound latch in update() — the nav-side latch
was dead code while wiggle/escape owned the boat; buffered bank; sweet-spot latch at
need+0.25 with full-power exit): seed 4244's cycle is now fully characterized:
- Orbit sweep ceiling in this ice/wind: ~2.89 rad (sawtooths at the windward sector).
- Departure requirement: LIVE sweep >= 2.553 beyond d=1063 moving out.
- Exit cost from d~460 through the ring in the katabatic: ~0.35 rad of unwind.
- Margin: 2.89 - 0.35 = 2.54 vs 2.553 needed. ZERO, reproducibly.
Remaining classical options: (a) raise the sweep ceiling via trough-timed pushes at the
windward sector (wind oscillation is deterministic ±7kt/120s); (b) discuss engine-side
sweep semantics with the owner (drift-back unwind during a committed departure is
arguably harsh — affects players too); (c) RL local pilot (pre-approved escalation) —
the maneuver is genuinely at expert-human skill level.
4245/4246/4250 remain entrapment-class (peaks 0.55-0.91) — a different, earlier fight.

## 🏁 MILESTONE (Aug 3, night): THE ROUNDING BANKED AT FULL DENSITY
Seed 4244: **leg 2 at t=378**, organic race, full ice, full katabatic. The chain that
did it: churn-aware entrance hunt (#29 — sector scan penalizes floe-RISK density, not
just blockage; the old W entry fed boats into a washing-machine sector that ate 104 of
146 armed seconds) → orbit → outbound latch (in update()) → **exit-hunt (#30 — mirror
of the entrance hunt; a blind outward spiral orbited UNDER the pack's outer shell for
380s with 4.32 rad banked)** → #31 removed the pre-bank handoff to the next leg's path
(it preempted the exit-hunt — dmcFollowLeg flipped to leg+1 at the latch and the boat
detoured toward home through the pack instead of punching out).
Projected finish for 4244 ≈ 480-530s vs the 420 cutoff: the existence problem is DEAD;
what remains everywhere is PACE (zone arrival ~230-290 needs ~180; the armed phase
~110-150s needs ~60).
Remaining defect classes: 4245 sweeps 5.65 (a lap and a half!) but its exit sector
never clears — exit-hunt needs a grind-through fallback when no sector scans clean;
4246/4250 entrapment class (sweep never builds — lose the rotation battle early).

## Round18 (fleet): FIVE roundings, DNS 0.0% (7th straight)
leg_complete {0:180, 1:5}, pen 2.03, ground 630. The exit machinery generalized to
fleet racing at once (1 -> 5 roundings). Zero finishes still: the 5 banked too late to
sail home by 420. THE CAMPAIGN IS NOW PURELY PACE:
budget = start ~20 + cove ~30-70 + transit 150-250 (!) + rounding 110-150 + return
80-120 vs cutoff 420. Targets: transit <=150 (rate profile: first 130s produced only
32% — biggest sink), rounding <=80 (churn-entry helped; armed phase still weaves).

## Decider separation (#34, Aug 3 latest): benchmark record
The cove-mouth wobble decoded: the trajectory planner picked threads through floe gaps
and the per-candidate grid probe (floe-stamped, fatter) hard-vetoed those exact threads
— two deciders sawing the rudder (dev 3.0 swings, navT thrashing, 120s lost at the
mouth on weak seeds). Fix: when the planner steered this tick, the probe checks LAND
ONLY (static grid). **Benchmark: mean 86.1 (record), min 55, max 100, roundings 3/12.**

## Next hypotheses (in order)
1. ~~Wind-phase hold-and-charge~~ — RETIRED (Aug 3, owner concern + falsified premise):
   the walls proved to be navigation bugs, not wind (an 18kt trough didn't help), the
   mechanism never fired in the final stack, and even though the shipped version sensed
   phase from the boat's own wind EMA (no config reading), it was course-shape-flavored
   design. Removed from the code. The strategies that survived are fully general:
   sense-the-world scans (churn-aware entrance/exit hunts), time-cost routing, floe
   drift prediction — nothing keys on this venue's constants.
2. Verify at 25-30 seeds once something moves.
3. RL local policy remains the approved escalation if classical pace work plateaus.

## Ideas queue (RL scoring — owner suggestions Aug 5, assessed)
- **Gated per-leg DMC as the fleetret score v2** (ADOPT on next rerun): keep the
  rounding/finish bonuses as gates, add continuous DMC credit on leg 1
  (pre-round) AND leg 2 (post-round) — the current score has no leg-2 gradient
  for non-finishers. Raw ungated DMC is a REWARD-HACKING TRAP: it's lateral
  projection onto the path, orbiting boats farm it, and it cannot see sweep.
- **Ice curriculum**: sequential annealing (low→high ice) is risky with CEM
  (sigma collapses around low-ice optima = the #46/#47 aggressive-orbit style
  that full density rejects). Safer: MIXED-DENSITY scoring within an iteration
  (__FLOEFRAC 0.5/0.75/1.0 on the same seeds, summed) — obs includes ice
  sectors so one policy can be right at all densities. Reserve for the neural
  stage / if full-density signal goes sparse.

## ═══ OVERNIGHT ROUND (Aug 5→6): FROM HUMAN EVIDENCE TO BOT PACE ═══

### Baseline re-measurement (FIRST, before any experiment — the standing rule)
Clean HEAD (5f4c816) does NOT reproduce either stored gate number:
- 12-seed solo: **92.8 / min 80 / 1 rounding** (stored ref 91.3/74/2 — STALE)
- fleet_leg2 seeds 9100-9107: **45/72 rounders, 24 finishers, finMed 705**
  (stored basecheck 51/30 — STALE; paired deltas vs stored: leg1 med +33,
  leg2 med +157 on n=3)
The recorder-v7/RL-hook landing was goldens-verified on the golden seeds, but
these bench seeds shuffled (chaotic sensitivity, the known ±30%-per-seed
lesson). Tonight's pairings therefore use the FRESH JSONs:
`fleet_leg2_headcheck.json` + solo headcheck. Stall dwell on HEAD baseline:
108s/boat of leg-1 slow time (<0.5 spd at 15s samples), 72/72 boats pin ≥15s,
longest-pin med 30s (humans: all pins ≤13s).

### Human evidence (26 trajectories, traj_report.js + pin_report.js)
- Arctic (15 runs, ALL finished): finT med 213.7, leg1 med 126 (min 120),
  leg2 med ~84, armed med 35s. Clearance floor 14-19u in EVERY contested run.
- **All 8 recorded pin escapes are ONE maneuver: rotate IN PLACE (10-40°/s at
  zero speed, swinging up to 230° hunting the lane) until the bow points down
  an open lane at a powered wind angle, then hold heading DEAD STEADY and
  accelerate out (0→1.0 in ~3-4s), passing ice at 50-80u.** Zero back-outs,
  zero pure rotations, zero wiggling. The old "reverse-out sternway" idea in
  the queue below is REFUTED by data — do not build it.
- Leg-1 dwell per progress decile, bot vs human (s/boat):
  bots 44/15/37/86/40/43/28/68/193/106 vs humans 14/11/10/9/11/12/14/17/15/22.
  Bots bleed everywhere; hemorrhage in deciles 9-10 (ring basin + north-shore
  pile-up above the island) and decile 4 (west-corridor pack).

### Experiment 1: MARGIN REDUCTION stage 1 (~50% of pads) — ✅ ACCEPTED
Knobs (all floe-specific pads, land pads untouched): reactive movePad 70→35,
planner floe MARGIN 120→60, traj-planner contact rr +45→+25, grid futureBlk
pad +44→+22, router _floeRisk band +120→+60.
**Fleet paired vs headcheck: rounders 45→48, finishers 24→33 (+9 — the biggest
single-change finisher jump of the campaign), finMed 705→675; paired leg-1 med
−3, leg-2 med −76, finish med −58; sweep-phase med +13 (small ring cost, paid
back double on the return leg). Stall dwell 108→101 s/boat, longest pin max
105→90. DNS-like (never reached leg 1) 0/72 both sides (start registration
verified per owner's warning). Solo: 92.8→91.4 mean — the delta is ENTIRELY
seed 4249 collapsing 96→39 (1833 ice contacts, entrapment class); 2 roundings
(was 1) and the FIRST-EVER in-time solo finish (4247 rounds t=279, finishes
t=387).** The human-evidence hypothesis holds: the pads, not the boats, were
refusing the threads. Stage 2 (~30% of original: 21/36/+14/+13/+36) queued.

### Experiment 1 stage 2 (~30% of original pads) — ✅ ACCEPTED (record night)
movePad 21, planner 36, traj +14, futBlk +13, floeRisk +36.
**Fleet vs stage 1: rounders 48→57, finishers 33→43, finMed 675→635, paired
leg-1 med −44, sweep-phase med −23. Cumulative vs clean HEAD: rounders 45→57,
finishers 24→43 (+19), paired finish med −101s; FOUR in-time (<420) fleet
finishes in one bench (380/403/404/409) — previous record was ~1/run. Solo:
mean 95.7 RECORD / min 78 / 6 roundings of 12 (record; 4249 recovered 39→93).
DNS-like 0/72.** Failure-mode watch: stall tail slightly longer (one 150s pin,
was 90s max) — the entrapment class survives at reduced margins but does not
spread. Stage 3 probe (~15%: movePad 14, planner 24, traj +10, futBlk +9,
floeRisk +24) queued to find the knee; human floor is 14-19u.

### Experiment 1 stage 3 (~15% probe) — ❌ REVERTED; THE KNEE IS AT STAGE 2
movePad 14, planner 24, traj +10, futBlk +9, floeRisk +24.
Fleet: rounders 57→61 but finishers FLAT 43, finMed 635→658, paired deltas
neutral (leg-1 med +16, finish med +2). Solo: mean 95.7→87.5, roundings 6→1,
two fresh seed collapses (4242 100→51, 4247 100→69) — below ~20u pads the
rollout stops flagging contacts the boat cannot dodge and the reflexes can't
cash the thinner slack. **FINAL margin config (accepted): movePad 21, planner
MARGIN 36, traj rr +14, futBlk +13, floeRisk +36 — fleet 57/43/635 vs HEAD
45/24/705, solo 95.7/6-roundings record.** The pads were sized for pre-#12
avoidance; predictive avoidance + human evidence retired two-thirds of them.

### Experiment 2: UNSTICK V2 (human pin-escape reflex)
Wall-pin trace (seed 9100 "Seam", channel pocket, wall_trace.js): 3 pins in
30s at one spot — carrot demands blocked NNE, avoidance command flip-flops
tick to tick (tgt 174→−14→−86 in 3s), wiggle's beam-reach escapes but the
1.5s clearance releases straight back into the pocket. Built the human
maneuver: pickEscapeLane (16 powered headings scored by grid-clear distance,
soft cells half credit, nav bias) + steer-the-lane wiggle burst (6s) + 3.5s
clearance + re-pick-away-from-contact on floe touch (1s rate limit).
- **v2 first cut (lane everywhere): fleet-REJECTED with the pace-for-tails
  signature** — survivors paired finish −106s med (!), but finishers 43→35,
  stall dwell 99→120 s/boat. Solo was fine (95.9, rounding t=212 record).
  Same shape as #46/#47: a 9.5s committed escape is wrong in a RAFT, and
  raft-mates all picking the same best lane converge (round-5-8 lesson).
- **v2b: lane escape gated to TRAFFIC-FREE pins** (no unfinished rival within
  300u): fleet-REJECTED HARDER — finishers 34, paired leg-1 +50 med, stall
  dwell 113 s/boat, and the survivor-pace win evaporated too (finish med −7).
- **❌ UNSTICK V2 REVERTED ENTIRELY (both variants).** Mechanism understood:
  the lane scan is a STATIC snapshot of a DRIFTING pack, and the 6s+3.5s
  commitment suppresses planFloeTrajectory exactly when the boat is driving
  at floes it can no longer dodge. v1's short blind burst + immediate return
  to normal control beats a smart-but-stale plan. ⚠️ Do not retry
  committed-lane escapes; the human maneuver works because humans keep
  re-perceiving during the drive-out.
- **The REAL finding from the pin analysis: bot pins recur because the CARROT
  keeps demanding the same blocked pocket** (Seam re-entered one pocket 3× in
  30s; the wiggle escaped fine every time). Post-margin stall dwell med is
  30s, not 300s — escape mechanics are no longer the bottleneck; the
  re-approach cycle is. That is pursuit territory → experiment 3.

### Experiment 3: LEG-1 LINE STUDY → LOS carrot — ❌ REJECTED
Overlay result first (the study's actual finding): bots take the SAME route
as humans (start arc → eastern channel beat → NE approach) — the difference
is EXECUTION SPREAD, not line choice, and the margin acceptance closed most
of it (stage-2 bot cloud hugs the human ribbon). Remaining sinks: ring basin
(decile 9: 161 s/boat vs human 15) and the channel walls (decile 4: 86 vs 9 —
boats ride tacks into the shore; humans tack short of it).
The ONE change tried: line-of-sight carrot (walk the pursuit carrot forward
to ~2.2× lookahead until the boat→carrot line is land-free on the static
grid; nearest-point fallback). Fleet: finishers 43→34, rounders 57→55,
paired finish −85s med for survivors — REJECTED, third occurrence of the
same trade signature.
**⚠️ PATTERN (three independent mechanisms, one night): at the accepted
margins the fleet sits at a finisher-count optimum where ANY change that
makes individual lines more direct/committed (lane escape, LOS carrot)
produces faster survivors and fewer finishers. Traffic redistribution, not
individual routing, now binds the tail. Next classical lever should target
TRAFFIC (stagger, spacing, queue shaping) or the ring basin itself — not
transit lines. The land-layline tack idea (tack BEFORE the channel wall)
remains untried and is the most human-evidenced residual candidate.**

### Experiment 4: WALL-TACK GUARD EXCEPTION — ✅ ACCEPTED (2nd win)
The >16kt low-speed no-tack guard (scoreTack) FORBADE exactly the escape the
channel walls demand: a boat slowed under 1.1 near the shore could not tack
away and had to grind (decile-4 dwell 86 s/boat vs human 9). Exception: hard
grid blockage (land or stamped floe, soft ice excused) within 90/180u dead
ahead on the current board waives the guard — the human pins prove a hull
rotates fine without way on; slow is a cost, the wall is a trap.
**Fleet paired vs margin30: rounders 57→61, finishers 43→45, paired finish
med −8 (survivors NOT traded — the finMed 635→701 rise is composition: two
more tail-boats now finish late), leg-1 dwell 99→91 s/boat, longest pin max
150→90; new fastest in-time finish 371s (seed 9107). Solo 94.8/4 (reshuffle
noise vs 95.7/6, no collapse). DNS-like 0/72.** Unlike the three rejected
mechanisms this does not commit boats to lines — it removes a forbidden
transition exactly at the trap. Open venues: provably inert (grid-gated).

### Experiment 5/6: RING-BASIN PACE — the sweep phase is 159s vs the human 35s
Human armed-phase data (12 runs): radius med 0.45-0.9x zone, min ~0.35x,
sweep rate 0.12-0.20 rad/s, armed 21-54s; max radius ~1.24x = the exit
crossing itself. Three attempts to route that into the bots:
- Tight-first armed widen ladder: **proven byte-identical no-op** (order only
  matters when multiple rungs are clear at once — rare at density). Reverted.
- Sector-adaptive DMC arc (planner _arc: per-bearing radius, human envelope,
  slope-capped) + trust-the-arc widen: geometry landed (arc dips to 475u ≈
  0.56x zone through clear sectors, leg1 −418u) but **behaviour byte-identical
  again** — ⚠️ ARMED BOATS NEVER READ THE ARC OR widen(): "ARMED = PURE
  ORBIT" (getNavigationTarget) owns them outright. Both reverted as inert
  scaffolding (the arc change also moves course-length metadata). Lesson
  recorded: on the rounding leg, radius decisions live in the ORBIT TARGET
  ONLY — everything else is display.
- **✅ TIGHT ORBIT (the live lever, ACCEPTED as a JUDGMENT CALL):** the armed
  orbit target was an outward spiral `max(dRm+140, 0.8z)` capped 1.6x zone —
  double the human circumference. Now `min(1.6z, max(0.85z, dRm−80))`: far
  boats still close on the ring; inside, the target sits at the human 0.85x
  ring instead of 140u beyond wherever the boat is.
  Fleet paired vs walltack: rounders flat 61, **finMed 701→611, paired finish
  −23 med/−51 mean, sweep-phase −21 med, IN-TIME (≤420) finishes 1→3, seed
  9101 = 9/9 finishers**; solo 95.8/6 ties the record with faster arrivals
  (4244 309→279, two new rounders). COST: uncapped-window finishers 45→42.
  Capped 420s eval cannot discriminate (both sides ~saturated; pen/boat
  2.07→1.94 favours tight). Accepted because the campaign's stated mission is
  PACE toward the 420 cutoff and every pace metric moved; committed
  separately so one revert flips it if the 900s tail is weighted higher.

### ✅ HELD-OUT VALIDATION (16 fresh seeds 9200-9215, 144 boats): THE STACK
### TRANSFERS
Full overnight stack (margins + wall-tack + tight-orbit, e65cc75) vs the
original clean HEAD (5f4c816), seeds never used in any decision tonight:
**rounders 79→104 (+25), finishers 47→76 (+29, +62%), finMed 689→690 (equal
on a 62% larger, tail-heavier finisher set), paired leg-1 −7 med/−31 mean,
leg-2 −39 med, finish −7 med/−30 mean, sweep −13 med. DNS 0/144 both.**
This is the transfer test that rejected all four RL policies — the
human-evidence classical stack passes it on the first try. (On these seeds
the tight-orbit uncapped-finisher concern does not manifest.) In-time
finishes: 1 vs 1 here — the 9100-9107 in-time gains are seed-dependent;
pace to the 420 line remains the open frontier.

### NEXT SESSION TARGET (post-stack phase split, held-out data)
Leg 2 is essentially solved (≤22 s/boat per decile). Leg-1 transit is
human-competitive through decile 8. The LAST MOUNTAIN, isolated:
- reach-80%-of-leg1 → ARM: **med 9s** (entry hunt + margins fixed this)
- **ARM → outbound: med 131s, p75 223s — vs the human 35s.** This is the
  whole game now. The armed sweep resisted 10 classical mechanisms + 4 RL
  policies; tight-orbit took the first real bite (159→131). What the humans
  do differently INSIDE the sweep (from pin_report + armed-phase stats):
  hold 0.5-0.9x radius CONTINUOUSLY (sweep rate 0.12-0.20 rad/s with no
  pauses), grind soft ice rather than deviate, and never surrender the
  rotation direction. Bot sweep is bursts separated by churn/blocked-arc
  stalls. Candidate levers: armed-phase speed discipline exemption (pack
  discipline slows armed boats mid-sweep), per-sector orbit radius (the
  orbit target is one global radius; humans cut sectors), or the CREW-level
  RL scope (densest reward, now with a 131s target to beat).

## Ideas queue
- Gap-aware channel selection: route around the *pack*, not through it, when the time
  cost table says the detour is cheap (the "wider than narrowest channel" idea).
- Per-character perception radius on wind/current sampling (stats hook).
- Unstick v2: reverse-out maneuver (sternway) when bow-pinned; measured raft dispersal.
- RL policy for local control (steer+trim) if classical control plateaus — user-approved
  escalation path.
