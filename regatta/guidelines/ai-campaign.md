# AI Campaign Scoreboard

Tracks bot racing quality against the human reference, per venue, over time.
Only the three built-out venues are scored: **Sea Trials** (venue key
`seatrials` — the run_eval anchor course), **Lighthouse Cove** (`bay`), and
**Glacier Sound** (`arctic`). Append a new dated snapshot per venue after each
accepted round — never overwrite old rows; the point of this file is the trend.

⚠️ Numbers are only comparable INSIDE a protocol (same harness, seeds, trials,
cutoff). Every snapshot states its protocol and commit. Human rows come from
the banked trajectories in `regatta/eval/rl/traj/` (`traj_report.js` prints
them); they were sailed against a live bot fleet, so they are fleet-context
numbers, same as the bots'.

---

## Sea Trials (`seatrials`)

Protocol: `node regatta/eval/run_eval.js <trials> 100` (100-trial anchor is
canonical; 40t noise band ≈ ±0.5s on medians). Human = 12 trajectories.

### Starts (time to cross after gun, s)

OCS% = share of boat-races penalized for an early start (a rules event — an
OCS hold that returns cleanly before the gun is NOT one).

| Snapshot | Who | DNS% | OCS% | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|---|
| 2026-08-06 anchor @100t (fb9f641) | bots | 0 | n/i | 3.31 | 6.51 | — | — |
| 2026-08-03 stack @40t (855379a) | bots | 0 | n/i | 3.19 | 6.25 | — | 49.1 |
| 2026-08-03 instr @100t (a0c3633) | bots | 0 | 14.7 | 3.41 | 6.30 | 0.0 | 62.5 |
| 2026-08-03 tacktax @40t (6aa46ea) | bots | 0 | 13.6 | 3.37 | 6.36 | 0.0 | 53.3 |
| 2026-08-03 (12 traj) | human | 0 | 11 (1/9 v7) | 2.3 | 3.3 | 0.7 | 13.9 |

### Course (finish time, s)

| Snapshot | Who | DNF% | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|
| 2026-08-06 anchor @100t (fb9f641) | bots | 0 | 200.44 | 204.34 | — | — |
| 2026-08-03 stack @40t (855379a) | bots | 0 | 200.47 | 204.67 | — | 360.0 |
| 2026-08-03 instr @100t (a0c3633) | bots | 0 | 199.63 | 203.55 | — | — |
| 2026-08-03 tacktax @40t (6aa46ea) | bots | 0 | 199.25 | 203.21 | — | — |
| 2026-08-03 post-merge @40t (721e8ce) | bots | 0 | 200.25 | 202.87 | — | — |
| 2026-08-03 (12 traj) | human | 0 | 192.2 | 191.4 | 180.9 | 200.6 |

⚠️ Owner merge 11a8f4b (VENUES card copy → venue documents) shifts init RNG
draws: every seed reshuffles, goldens were re-recorded (PASS at 721e8ce),
and rows before/after the merge are NOT seed-comparable — compare classes,
not per-seed values, across that line. Anchor and bay medians held.

The a0c3633 row is the fresh 100t reading on the tree that contains the Aug-6
overnight arctic stack (fb9f641 + 14 commits); slightly better than the stored
fb9f641 anchor, so the anchor HOLDS on current HEAD. Instrumentation itself is
byte-inert (10t A/B: identical 204.42/200.75 with the old and new harness).

### Collisions (per boat-race)

Categories, uniform across venues: **Boat** (boat-on-boat), **Land** (shore/
banks/islands), **Mark**, **Other** (venue objects: floes, bergs; plus arena
bounds). "n/a" = the venue has none of that object; "n/i" = not instrumented.
Penalties are a SEPARATE table — a penalty is a rules event (RRS infraction +
360 turn), not a contact event; each can occur without the other.

| Snapshot | Who | Boat | Land | Mark | Other |
|---|---|---|---|---|---|
| 2026-08-03 stack @40t (855379a) | bots | 0.52 | n/a | 0.25 | 0.00 (bounds) |
| 2026-08-03 instr @100t (a0c3633) | bots | 0.50 | n/a | 0.19 | 0.02 (bounds) |
| 2026-08-03 tacktax @40t (6aa46ea) | bots | 0.57 | n/a | 0.18 | 0.00 (bounds) |
| 2026-08-03 (12 traj) | human | 0.25 (3 in 12) | n/a | 0 | 0 |

Bot rows here use run_eval's incident convention (2s cooldown per boat+type,
legs ≥ 1); the human recorder counts one event per type per 0.5s from prestart.

### Penalties (per boat-race)

| Snapshot | Who | Penalties |
|---|---|---|
| 2026-08-06 anchor @100t (fb9f641) | bots | 0.44 |
| 2026-08-03 stack @40t (855379a) | bots | 0.50 |
| 2026-08-03 instr @100t (a0c3633) | bots | 0.42 |
| 2026-08-03 tacktax @40t (6aa46ea) | bots | 0.47 |
| 2026-08-03 (12 traj) | human | 0 |

**Read:** the median bot start and finish are within ~8s of the human median;
the human's edge is consistency (max 200.6 vs bot max at the 360 cap) and a
cleaner race (0 pens vs 0.50). The bot tail — not the bot median — is the gap.

---

## Lighthouse Cove (`bay`)

Protocol: `regatta/eval/rl/bay_bench.js 20-seed set (9100-9119)`, cutoff 900,
9 bots (player parked). `bay_report.js <label> [labelB]` prints these + paired
deltas. Human = 7 trajectories. Since 2026-08-03 the bench counts per-boat
contacts (0.5s dedup per category, prestart included — the human recorder's
convention), true penalties (`raceState.totalPenalties`), and OCS.
⚠️ The 855379a "0.00 penalties" row was a bug: the bench read `b.penalties`,
a field that does not exist on live boats (the engine stores
`raceState.totalPenalties`). True pens/boat on the same races is 0.57.

### Starts (time to cross, s)

| Snapshot | Who | DNS% | OCS% | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|---|
| 2026-08-03 baseline (614b20b) | bots | 0 | n/i | 5 | — | — | — |
| 2026-08-03 stack (855379a) | bots | 0 | n/i | 5 | 9.3 | 0 | 147 |
| 2026-08-03 instr (a0c3633) | bots | 0 | 3.9 | 5 | 9.3 | 0 | 147 |
| 2026-08-03 tacktax (6aa46ea) | bots | 0 | 3.9 | 6 | 9.3 | 0 | 130 |
| 2026-08-03 (7 traj) | human | 0 | 0 (0/7) | 0.9 | 4.5 | 0.6 | 19.1 |

### Course (finish time, s)

| Snapshot | Who | DNF% | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|
| 2026-08-03 baseline (614b20b) | bots | 0 | 277 | — | 216 | — |
| 2026-08-03 stack (855379a) | bots | 0 | 268 | 269.7 | 215 | 365 |
| 2026-08-03 instr (a0c3633) | bots | 0 | 268 | 269.7 | 215 | 365 |
| 2026-08-03 tacktax (6aa46ea) | bots | 0 | 261 | 265.1 | 218 | 365 |
| 2026-08-03 post-merge (721e8ce) | bots | 0 | 264 | 266.8 | 220 | 351 |
| 2026-08-03 (7 traj) | human | 0 | 226.1 | 226.7 | 219.5 | 241.1 |

(instr row = byte-identical races to the stack — instrumentation verified
inert against the stored stack JSON — with the new columns now measured.)

Per-leg medians vs human (tacktax): L1 +3, L2 +1, L3 +5, L4 +3, L5 +6,
L6 +4 = +22 (stack was +27). Paired vs instr: +4 med / +4.6 mean, n=180;
L1 tail 29→25 boats; >40s winners 25 vs losers 14.

Per-leg medians vs human (stack): L1 +3, L2 +1, L3 +6, L4 +6, L5 +6, L6 +5.

### Collisions (per boat-race)

| Snapshot | Who | Boat | Land | Mark | Other |
|---|---|---|---|---|---|
| 2026-08-03 stack (855379a) | bots | n/i | n/i | n/i | n/a |
| 2026-08-03 instr (a0c3633) | bots | 1.89 | 0.31 | 0.91 | 0.00 (bounds) |
| 2026-08-03 tacktax (6aa46ea) | bots | 2.54 | 0.27 | 0.61 | 0.00 (bounds) |
| 2026-08-03 (7 traj) | human | 0.14 (1 in 7) | 0 | 0 | n/a |

⚠️ tacktax raised boat rubs (1.89→2.54, penalties flat — non-foul contact:
boats now duck/hold in traffic instead of flipping away) while cutting mark
(−33%) and land contacts. Accepted pace-first; contact discipline in traffic
is an open vein.

### Penalties (per boat-race)

| Snapshot | Who | Penalties |
|---|---|---|
| 2026-08-03 stack (855379a) | bots | 0.00 (BUG — see protocol note; true 0.57) |
| 2026-08-03 instr (a0c3633) | bots | 0.57 |
| 2026-08-03 tacktax (6aa46ea) | bots | 0.57 |
| 2026-08-03 (7 traj) | human | 0 |

**Angle-level bulge verdicts (2026-08-03d, no row — nothing landed):** the
L3/L5 bulge is measured angle-level, not nav-level (nav targets sit ~180-230u
east of the DMC line; the human sails ~130-180u east too). Bots sail 74% of
run time hotter than 145° TWA vs human 43%; heat-gate fires 75% of L3 samples
at 13.0kt but the plane holds only 37%. THREE fixes A/B'd at 20 seeds, all
non-landing: (1) downwind fine-VMG scan (polar-table gridpoint bug — the
optimizer could only answer 150/180; true interpolated optimum ~165, +3.7%
VMG) REJECTED −8 med/−6.1 mean: deeper = slower hull speed loses more in
fleet traffic than the polar gains, and L4 loses via L3 arrival state.
(2) static heat margin (entry+0.5kt): bay +2/+2.8 BUT seatrials −2.9 mean —
steady-13kt water planes fine; sticking is venue truth, a static predictor
can't have both. (3) try-the-plane gate (6s try / 15s cooldown on measured
isPlaning): seatrials median byte-exact, bay NEUTRAL −2/−0.4 — at marginal
TWS the plane briefly engages just often enough to reset the fail timer.
Residual bulge cost lives in the fat tail (ratio ≥1.7 boats: 5 gybes, 60s
legs, traffic/rounding-driven), not the median angle choice. Do not retry
these three blind; instruments: _bay_bulge_probe.js + bay_bulge_*.json.

**Read:** the whole gap is pace (median −42s vs human), but the race is NOT
as clean as previously believed: 0.57 pens/boat and 1.89 boat contacts per
race (human: 0, 0.14). The winning bot (min 215) edges the human best (219.5).
**L1 tail diagnosis (2026-08-03, l1diag bench + per-tack traces):** the
"early starters get buried" story is FALSE — corr(L1 duration, start time) =
−0.08. The tail is EXCESS TACKING: corr(L1, tacks) = 0.72; tail boats (L1 ≥
60s) tack med 7 (up to 14) vs fleet med 3 vs human 2, while dirty-air time
(5%/5%) and headed-tack share (52%/54%) are IDENTICAL between tail and rest
(the human sails headed 35-58% of their beat too — nobody meaningfully plays
the 45-120s oscillation inside a 40s leg). Per-tack attribution: ~40% of tail
tacks are AVOIDANCE-forced (traffic dodges through head-to-wind), and the
rest chain off them — after an avoidance flip, scoreTack's tackCooldown was
never set (it only arms on its OWN switches), so the strategic layer tacks
straight back: two deciders sawing (bursts of 5 flips in 3s observed).

---

## Glacier Sound (`arctic`)

Protocol: `regatta/eval/rl/fleet_leg2.js`, 16 seeds (9100-9115), cutoff RAISED
to 900 (uncapped profiler — the real race cutoff is 420, so "in-time" is the
race-condition finisher count). Human = 16 trajectories. ⚠️ A fresh capped
`arctic_eval.js` round (true DNS/DNF at 420) was NOT run this session.

### Starts (time to cross, s)

| Snapshot | Who | DNS% | OCS% | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|---|
| 2026-08-03 stack (855379a) | bots | 0 | n/i | 4 | 8.7 | 0 | 113 |
| 2026-08-03 instr (a0c3633) | bots | 0 | 6.9 | 4 | 8.7 | 0 | 113 |
| 2026-08-03 tacktax (6aa46ea) | bots | 0 | 6.9 | 4 | 8.0 | 0 | 71 |
| 2026-08-03 (16 traj) | human | 0 | 0 (0/13 v7) | 1.2 | 3.6 | 0.1 | 22.6 |

### Course (finish time, s; uncapped-900 protocol)

⚠️ Rows below the merge line (11a8f4b) are a fresh seed-class — compare
classes, not per-seed values, across it.

| Snapshot | Who | DNF@900% | in-time ≤420 | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|---|
| 2026-08-03 HEAD baseline (614b20b) | bots | 6.9 (10/144) | — | 530 | — | — | — |
| 2026-08-03 stack (855379a) | bots | 9.0 (13/144) | 35/144 (24%) | 538 | 537.6 | 257 | 899 |
| 2026-08-03 instr (a0c3633) | bots | 9.0 (13/144) | 35/144 (24%) | 538 | 537.6 | 257 | 899 |
| 2026-08-03 tacktax (6aa46ea) | bots | 7.6 (11/144) | 30/144 (21%) | 536 | 531.5 | 239 | 865 |
| 2026-08-03d post-merge base (d363cde) | bots | 9.7 (14/144) | 29/144 (20%) | 517 | 546.7 | 315 | 896 |
| 2026-08-03d floe grind-pricing (15c0be2) | bots | 6.9 (10/144) | 40/144 (28%) | 498 | 522.2 | 285 | — |
| 2026-08-03d notch2 (band 1200/farHit 3500/clr disc) | bots | 9.0 (13/144) | 40/144 (28%) | 500 | 504.9 | 270 | — |
| 2026-08-03 (16 traj) | human | 0 | 16/16 | 229.1 | 230.3 | 200.1 | 299.2 |

(floe grind-pricing: rounders 137→140; paired +13 med / +25.0 mean n=125,
winners>10s 64 vs 47, >40s 52 vs 36, finished-only 9 vs 5 — no tail price.
Mechanism: 1Hz transit attribution showed 50% of the 15.3k-u excess transit
distance sailed under active avoidance deflection (mean 49°, 16 tacks vs
human 3) because graded floe proximity (band 10000, farHit 25000) dwarfed
deviation costs (max ~59); cut to 2500/6000 for floes only. Seatrials anchor
byte-exact; only the 2 arctic goldens moved, re-recorded PASS 20/20.

notch2 on top: band→1200, farHit→3500, plus the low-clearance endpoint term
priced 10000→4000 where the static land-only grid is clear (floe-caused
narrowness grindable; lee-shore weight kept; inert without floes). Return
dist ratio 1.91→1.70, ret med 171→147. Gate vs notch1: paired +12 med /
+18.8 mean n=123, winners 62/54 >10s and 48/39 >40s, min 270 record; priced
by fins@900 134→131 churn with in-time flat 40 — accepted per the pace-first
precedent. Anchor byte-exact again; arctic goldens re-recorded PASS 20/20.
SESSION CUMULATIVE vs post-merge baseline: med 517→500, mean 547→505,
in-time 29→40 (+38%), min 315→270. Transit ratio 1.99→1.83, return
1.97→1.70 (probe): the track-length wall is ~40% closed; remaining excess
bins after notch2 — avoid-boat 2303 (RRS dances on the shared line, spacing/
stagger vein untried), avoid-none 2495 (unattributed graded shaping), offrt
2676, turn 2064 (grid carrot jumps >150u every ~4s, sticky-carrot untried).)

(instr row = byte-identical races to stackcheck16 — verified — with the new
columns measured; 143/144 rounders. tacktax: 140/144 rounders; paired +4 med
/ +8.6 mean faster; accepted with the in-time 35→30 / rounders −3 churn
priced in, per the tight-orbit precedent.)

### Collisions (per boat-race)

| Snapshot | Who | Boat | Land | Mark | Other (floes) |
|---|---|---|---|---|---|
| 2026-08-03 stack (855379a) | bots | n/i | n/i | n/i | n/i |
| 2026-08-03 instr (a0c3633) | bots | 8.84 | 29.93 | 0.69 | 24.25 (+0.11 bounds) |
| 2026-08-03 tacktax (6aa46ea) | bots | 7.35 | 30.14 | 0.40 | 25.40 (+0.25 bounds) |
| 2026-08-03 (16 traj) | human | 0.6/run | 0.4/run | 0 | 4.4/run (0-24; grind-through is cheap) |

Same 0.5s-dedup convention as the human recorder. Bot land contact is ~75x
the human's; floes ~6x. Contact discipline, not just routing, separates the
fleets here.

### Penalties (per boat-race)

| Snapshot | Who | Penalties |
|---|---|---|
| 2026-08-03 stack (855379a) | bots | n/i in fleet_leg2 |
| 2026-08-03 instr (a0c3633) | bots | 1.96 |
| 2026-08-03 tacktax (6aa46ea) | bots | 1.89 |
| 2026-08-03 (16 traj) | human | 0.13 (2 in 16) |

**Read (rewritten 2026-08-03b):** every human run finishes inside the 420
cutoff; only ~21% of bot races do, and the bot median race is 2.3x the
human's. **The previously-targeted "131s ARM→outbound wall" is STALE — on
current HEAD the rounding is med 19s (mean 39), FASTER than the human's 35s
armed median.** The real gap, measured: TRANSIT start→ARM med 257 vs human
~100, RETURN med 195 vs 83, driven by contact grinding (30 land + 25 floe
episodes per boat-race vs human 0.4/4.4). CREW-level RL ran and returned
PARITY (the classical executor is fine); the approved-next-scope evidence
now points at DRIVER-level transit quality. The old 51/30 reference stays
dead.

---

## Instrumentation TODO (to make the tables complete)

DONE 2026-08-03 (a0c3633 + instr commit): items 1-3 — bay_bench/fleet_leg2
count per-boat boat/land/mark/floe/bounds contacts (0.5s dedup, prestart
incl.), true penalties and OCS; eval_harness logs collision_island as
land/floe and tracks OCS-after-the-gun per boat; run_eval prints OCS%,
land/floe columns and start min/max; traj_report decodes human OCS from
recorder-v7 sample field 16 (racing-phase `raceState.ocs`). OCS definition
everywhere: the flag can only be SET during prestart, so ocs-while-racing =
over at the gun, paying the return.

Remaining:
1. A capped arctic_eval round per snapshot for true DNS/DNF at 420.
2. run_eval race-time min/max onto the course rows (in eval_results.json now,
   not yet in the console line).

## Next session brief (prepared 2026-08-03d, tree at notch2 HEAD)

Read `regatta-bay-ai.md` + `regatta-arctic-ai.md` memory first. treeA/B/D =
HEAD-before-notch2, treeC = notch2 (now == HEAD) — refresh ALL from HEAD
before the first bench. Arctic 16-seed baseline for the next A/B =
`fleet_leg2_notch2.json` (500 med / 504.9 mean / min 270 / in-time 40 /
fins@900 131). Bay 20-seed baseline = still `bay_bench_bulge.json` (264 med;
no bay behaviour change landed). Seatrials anchor = 202.87/200.25 pen 0.33
@40t — byte-reproduced twice this session. ⚠️ Run the 100t anchor before the
first big landing (only 40t spots were run on 2026-08-03d).

Priorities, in order:

1. **Arctic transit, remaining bins** (attribution now in _transit_probe.js
   — run it 8 seeds before/after every candidate; excess after notch2:
   avoid-boat 2303 / avoid-none 2495 / offrt 2676 / turn 2064 / rec+sail
   ~1800; transit ratio 1.83, return 1.70, vs human 1.21/1.16):
   (a) **Turn churn — target PLAN CHURN, not carrot stickiness.** ⚠️ JUDGED
   2026-08-03d: sticky grid carrot (DMC-style: hold the pursuit point until
   fetched 220u / behind / off-plan 260u / blocked, transit-scoped) is
   REJECTED at the probe level — WORSE everywhere (transit med 227→240, ret
   147→178, turn bin +23%) and carrotJump barely moved (14.2→13.4/min).
   Mechanism: the jumps are REPLAN churn — drifting-pack replans move the
   whole path >260u, forcing adoption as often as the glide re-aimed, while
   a held point goes stale against moving ice. Next levers for the 2.1k turn
   bin: replan path continuity (reuse the previous thread as A* guidance /
   penalize plans that diverge from the current one), or scoreTack board
   re-decision cadence on transit. Bots tack 14-16 per transit vs human 3.
   (b) **avoid-boat (RRS dances on the shared line)**: 9 boats converge on
   one DMC line; give-way bubbles (150u), duck rewards (−800) and R16 terms
   produce 49° mean deflections in open water. Spacing/stagger vein (per-boat
   lateral offset of the far-mode destination?) — untried, touchy (start-pack
   tuning is sacred; racing legs only).
   (c) **Floe-shaping notch3** (band <1200 / farHit <3500): the knee was NOT
   found — both notches paid. But notch2 already churned fins@900 134→131;
   watch the 900-cap finisher count FIRST, and stop at the first tail price.
   (d) **avoid-none attribution**: 2495u of deflection with no boat threat
   and no blockage within 360u dead ahead — the 3-point probe look may just
   be too coarse (diagonal/lateral shaping, `_clear` gradients). Extend the
   sub-binning before attacking it.
2. **Bay, what's left** (angle-level bulge vein CLOSED 2026-08-03d — three
   measured non-landings in the scoreboard note; do not retry blind):
   (a) **Fat-tail runs**: ratio ≥1.7 boats sail 60s L3/L5 legs with 5 gybes
   — traffic/rounding-driven, the lean half already sails 1.18. Instrument
   WHERE the tail's time goes (per-tail-boat 1Hz traces on bay_bulge JSONs).
   (b) **L3→L4 hairpin entry overshoot** (10% of leg-3→4 roundings ≥16s
   armed-to-advance, p90 16s max 61) — needs a NEW mechanism (ruler-entry
   skip is rejected).
   (c) **Traffic contact discipline** (rubs 2.54/race vs human 0.14,
   penalties flat) — try-the-plane cut rubs to 1.67 as a side effect but was
   pace-neutral; there may be a discipline win hiding in that direction.
3. **Owner question in flight (2026-08-03d): fast-spinning bergs.** Wes asked
   whether to cap floe rotational speed. Recommendation given: cap EDGE speed
   (ω·r), not angular rate — collision spin-up runs to the flat ±0.75 rad/s
   clampSpin regardless of size, so a big berg's lobes sweep at 100-225 u/s
   (2-7× boat speed) while every AI predictor (grid stamps, movePad drift
   shift, planner rollouts, futBlk) is TRANSLATION-ONLY and cannot see
   rotation at all. `clampSpin` radius-aware (ω ≤ min(0.75, ~30/r)) keeps
   small-pan twirl, kills the big rotors, matches the authored "bergs barely
   turn" intent. If taken up: it's a venue-feel change (goldens re-record,
   Wes's call on the constant); optionally first extend the contact
   instrumentation to attribute floe contacts by ω·r at contact to size the
   AI benefit honestly.
4. **Instrumentation remainder**: capped arctic_eval per snapshot (true
   DNS/DNF at 420); race min/max in run_eval console line; 100t anchor.

Gates, unchanged: paired A/B at 20 seeds bay / 16 seeds arctic on the target
venue; seatrials anchor 40t spot each landing, 100t before big stacks;
goldens (`npm run trace`, re-record only WITH an accepted behaviour change —
re-recorded twice at 2026-08-03d, both times arctic-only); judge tails by
paired per-boat deltas (positive = experiment faster, `_fleet_pair.js` /
bay_report paired line — ⚠️ the report's "negative = A faster" parenthetical
is misworded; trust the ledger convention).
