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
| 2026-08-03e anchor @100t (f6d4c98) | bots | 0 | 16.9 | 3.55 | 6.58 | 0.0 | 102.4 |
| 2026-08-03f anchor @100t (post cap+markesc) | bots | 0 | 16.9 | 3.55 | 7.20 | 0.0 | 140.7 |
| 2026-08-03 (12 traj) | human | 0 | 11 (1/9 v7) | 2.3 | 3.3 | 0.7 | 13.9 |

### Course (finish time, s)

| Snapshot | Who | DNF% | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|
| 2026-08-06 anchor @100t (fb9f641) | bots | 0 | 200.44 | 204.34 | — | — |
| 2026-08-03 stack @40t (855379a) | bots | 0 | 200.47 | 204.67 | — | 360.0 |
| 2026-08-03 instr @100t (a0c3633) | bots | 0 | 199.63 | 203.55 | — | — |
| 2026-08-03 tacktax @40t (6aa46ea) | bots | 0 | 199.25 | 203.21 | — | — |
| 2026-08-03 post-merge @40t (721e8ce) | bots | 0 | 200.25 | 202.87 | — | — |
| 2026-08-03e anchor @100t (f6d4c98) | bots | 0 | 199.33 | 202.56 | 175.2 | 347.6 |
| 2026-08-03f anchor @100t (post cap+markesc) | bots | 0 | 199.05 | 202.64 | 175.0 | 360.0 |
| 2026-08-03 (12 traj) | human | 0 | 192.2 | 191.4 | 180.9 | 200.6 |
| 2026-08-03e (13 traj) | human | 0 | 192.2 | 192.5 | 180.9 | 205.8 |

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
| 2026-08-03f anchor @100t (post cap+markesc) | bots | 0.31 |
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
| 2026-08-03f fresh base @cap (bayv2abase) | bots | 0 | 264 | 266.8 | 220 | 351 |
| 2026-08-03f MARK ESCAPE (c3e1313) | bots | 0 | 265 | 267.5 | 211 | 351 |
| 2026-08-03 (7 traj) | human | 0 | 226.1 | 226.7 | 219.5 | 241.1 |
| 2026-08-03e (11 traj) | human | 0 | 226.2 | 228.4 | 217.8 | 243.3 |

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
| 2026-08-03f mark escape (c3e1313) | bots | 2.35 | 0.14 | 0.79 | 0.00 (bounds) |
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
| 2026-08-03f fresh base @ab30d3d (headbase16d) | bots | 9.0 (13/144) | 40/144 (28%) | 500 | 504.9 | 270 | — |
| 2026-08-03f SPIN CAP (d065d0a, world change) | bots | 6.9 (10/144) | 32/144 (22%) | 520 | 528.9 | 247 | — |
| 2026-08-03f MARK ESCAPE (c3e1313) | bots | 9.0 (13/144) | 34/144 (24%) | 514 | 525.9 | 266 | — |
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

Remaining: none — 2026-08-03e closed both: run_eval prints race Min/Max on
the console line (9e4c608), and the capped arctic_eval per snapshot ran for
the notch2/f6d4c98 snapshot (row in the session notes below; re-run it per
future snapshot).

---

## Session notes 2026-08-03e (tree at f6d4c98; NO behaviour change landed)

**Four probe-level rejections closed every cheap classical lever on the
post-notch2 arctic transit wall** (8-seed _transit_probe gate vs a fresh
treeB baseline that byte-reproduced the ledger: transit 227 / ret 147):

| Candidate | Mechanism tried | Probe verdict | Why it fails |
|---|---|---|---|
| transit lane stagger | per-boat ±260u lateral offset of transit dest (boat.id hash, 700-1500u taper) | 227→234 / 147→167, avoid-boat UP 2303→2506 | ~60u lanes pin neighbors abeam inside the 150u give-way bubble; fleet can't string out; return offset fights gybe angles |
| replan path continuity | pathSailable prevPath stamp, +0.18 off-thread hint | 227→237 / 147→179, turn flat, carrotJump flat | old ribbon goes stale vs pack drift; re-approach cycles (sticky-carrot disease from the route side) |
| urgency-graded RRS | duck −800 / bow +1500 / R16 +2000 ×0.35 at MEDIUM | 227→244 / 147→164, avoid-boat UP | flat terms RESOLVE encounters early; weakened, threats escalate to HIGH and cost more (grind 15→19s) |
| floe notch3 | farHit 3500→2000, band 1200→700, cScale 4000→2500 | 227→248 / 147→159, grind med 9.9→12.8 | **KNEE FOUND — notch2 is the optimum** of the grind-pricing family |
| transit board commitment | scoreTack stickiness ×2.5+0.3 on grid-venue transit | 227→247 / 147→153, tacks UP 14→16 | flips are avoidance/carrot-fed, not score-hysteresis-fed; stickier boards hold bad lines longer, then swing harder |

Mean avoidance deflection sat pinned at 46-48° through every experiment —
the swing size is not chosen by the terms we re-priced; open-water traffic
is at a local optimum, like the ring constants were. ⇒ Remaining transit
gains live at DRIVER level (RL, the approved escalation) or in the world
itself (spin cap below).

**Avoid-none attributed** (_transit_probe2.js, byte-identical run): transit
2495u = lat-static 701 (±30° rays the old 3-point probe missed) + floe<250u
777 + boat<300u 349 + true-none 664. Probe2 also adds SECONDS-per-class and
a park counter — the distance attribution is blind to parks (a boat at
speed 0.15 loses 15-20s with odo≈0); time baseline banked (probe_time8):
**avoid-mode windows own 112s of the 258s mean transit (43% of transit
TIME) and 67s of 174 on the return**; parks are negligible on arctic (5s).
Time-wise, avoidance dominates even harder than distance-wise — the
driver-level escalation should be scored on avoid-mode seconds.

**Owner question ANSWERED WITH DATA — fast-spinning bergs** (_floe_spin_probe,
8 seeds, 1223 contact episodes): median floe contact = ice surface moving
**28.6 u/s rotationally vs 5 u/s drift** (~6× the motion every AI predictor
can see); 47% of contacts >30 u/s edge speed, 14% >60; big bergs (r≥300,
11.7% of contacts) sweep 46 med / 74 p90; population max ω·r observed
**821 u/s**. Boats are near-stationary at contact (med speed 0.06) — pinned
boats struck by rotating rims, not boats sailing into ice. The recommended
cap ω ≤ min(0.75, ~30/r) leaves small pans untouched (r<100 med |ω| 0.28 ≈
the cap) and removes exactly the tail translation-only predictors cannot
see. Physics/venue-feel change — Wes's call on constant + goldens re-record.

**Bay attributions** (no behaviour change; instruments 9e4c608):
- Fat tail: L3 tail (13/72, med 63s vs lean 43s) is TRAFFIC-owned (61% of
  windows have a rival <350u; avoid 1874 of 3643 excess). L5 tail (6/72) is
  OPEN-WATER avoid-none (1128u, no rival, no dead-ahead blockage). Sub-binned
  (probe v2): bay avoid-none is **TRUE-NONE dominated** (L3 tail 903 of 995,
  L5 tail 1051 of 1128; lat-static literally 0) — unlike arctic, where
  lat-static+floes explain ~60%. Suspects: CPA-range threats (a converging
  rival 400u+ away sets GIVE_WAY on distCPA<70/tCPA<8s while the probe's
  <300u-now check misses it) and land/boundary inside avoidance's 400-600u
  segment checks but past the probe's 360u rays.
- Hairpin ≥16s class (6/61) splits: (a) WRONG-WAY SWEEP AT ARMING — armed at
  −4.3 rad vs +3.19 required after curling the wrong side on the hot run
  approach; 1500u excursion + re-loop to unwind (36s, 35s cases); (b)
  POST-HAIRPIN HEAD-TO-WIND PARK — carve the run→beat hairpin, park at
  speed ~0.15 for 15+s (36s, 30s cases). Entry-state problems both; exits
  clean. Mechanisms to design: approach-side discipline, powered-carve
  guard (no commands through head-to-wind below ~0.9 speed while armed).

**Capped arctic_eval @420, 16 seeds 9100.., notch2/f6d4c98 snapshot (144
boat-races):** DNS 0.00%, DNF 0.00%, race med 420.0 (cutoff-capped) / mean
400.6, pen/boat 1.50, groundings/boat 627 (raw contact fires, not dedup'd).
True in-time arrival is the fleet_leg2 in-time count (40/144 = 28%); this
row exists so DNS/DNF-at-420 is tracked per snapshot going forward.

**Fresh anchors:** seatrials 100t @ f6d4c98 = 202.56/199.33 pen 0.33
OCS 16.9% min 175.2 max 347.6 (rows above). Goldens NOT re-recorded — no
behaviour change this session; all 2026-08-03d baselines stay exactly valid.

## Next session brief (prepared 2026-08-03e, tree at post-instruments HEAD)

NO behaviour change landed this session — every 2026-08-03d baseline stays
EXACTLY valid: arctic 16-seed = `fleet_leg2_notch2.json` (500 med / 504.9
mean / min 270 / in-time 40 / fins@900 131), bay 20-seed =
`bay_bench_bulge.json` (264 med), goldens NOT re-recorded. Fresh seatrials
anchor = **100t @ f6d4c98: 202.56/199.33 pen 0.33 OCS 16.9%** (use this, not
the 40t spot). Trees A/C/D reverted to HEAD after each experiment; treeB
committed at HEAD (bbc8537). Read `regatta-arctic-ai.md` +
`regatta-bay-ai.md` memory first — the 2026-08-03e entries carry four fresh
probe-level rejections with mechanisms; do not retry any of them blind.

Priorities, in order:

1. **Arctic: the classical transit list is EXHAUSTED post-notch2** (stagger,
   continuity, urgency-grading, notch3 all probe-rejected 2026-08-03e; knee
   found at notch2; mean deflection pinned 46-48° through every candidate —
   traffic is at a local optimum). Two live escalations, either/both:
   (a) **DRIVER-level RL on transit** per the four-level architecture — the
   evidence bar the campaign doc demanded (classical plateau) is now met at
   probe level. Scope per the crew-RL infra pattern (rl/ has the training
   loop; obs needs the DMC path lens + floe ring + rival ring; act = target
   heading bias + speed; gate = fleet_leg2 16-seed paired, the only gate
   that has ever told the truth here).
   (b) **Iceberg spin cap** (world-side; OWNER CALL — numbers are in the
   2026-08-03e session notes: median contact 28.6 u/s rotational vs 5 drift,
   47% of contacts >30 u/s, berg rims sweep to 821 u/s; cap ω≤min(0.75,30/r)
   spares small pans, kills the unpredictable tail). If Wes approves: land
   the cap, re-record goldens (venue-feel change), THEN re-run
   _transit_probe2 + a 16-seed fleet gate to size the realized AI benefit
   before aiming any RL at the post-cap world.
2. **Bay, two designed mechanisms owed** (diagnosis complete, 2026-08-03e):
   (a) **Hairpin wrong-way arm** (worst class, 35-36s): boats arm at −4.3 rad
   vs +3.19 required after curling the wrong side on the hot run approach.
   Mechanism to try: approach-side discipline — when closing a hairpin
   rounding (next-leg bearing reverses), bias the pre-arm approach point to
   the REQUIRED side of the mark so the first zone crossing sweeps the
   right sign. Gate: _bay_hairpin_probe before/after (≥16s count 6/61 →
   target ≤2), then bay 20-seed paired.
   (b) **Post-hairpin head-to-wind park** (30-36s): powered-carve guard —
   while armed, don't command headings within ~0.35 rad of dead upwind
   below speed ~0.9; carve wider on the current tack until way is on.
   Judge with probe2-style SECONDS bins (parks are invisible to distance
   bins — probe_time8 is the banked time baseline).
   (c) L5 avoid-none sub-binning (1128u, no floes on bay — the arctic
   detail probe's floe bin doesn't transfer; write the bay variant).
   ⚠️ For the L3 traffic tail: urgency-weakening of RRS shaping is
   arctic-REJECTED — expect the same local-optimum defense on bay.
3. **Roundabout ideas**: scoreTack board-commitment on transit was probed
   same session — REJECTED (fifth entry in the table above; flips are
   avoidance-fed). Bay contact-discipline vein (rubs 2.54 vs human 0.14)
   still open via try-the-plane's side-effect direction. The human bank
   now holds a ZERO-floe-contact arctic run (207.0s, minFloe 26u) — the
   contact-discipline ceiling is proven, not hypothetical.
4. Instrumentation: DONE this session (run_eval min/max, capped arctic_eval
   row, avoid-none detail, seconds-per-class + park counter). Keep running
   the capped arctic_eval per future snapshot.
5. **TRAFFIC GAUNTLET — Wes is leaning REDROCK RESERVOIR as the host**
   (2026-08-03e chat). Doc facts: 13000 world, only 4 rock-spire shapes,
   uniform 12kt dirVar 0, NO current, currently a generic W/L route. Build
   notes: author the gauntlet route in the open basin with every leg
   >600u from spires (grid stays ON — matches arctic/bay code paths —
   but geometrically irrelevant, so attribution stays clean); KEEP THE
   WIND UNIFORM for the lab role — the card's promised wind-shadows/
   gust-bombs would reintroduce the exact confounds the venue exists to
   remove, so add drama only AFTER baselines are banked, as a protocol
   break. Also noted: river doc has NO current authored (82 bank shapes,
   uniform 12kt) — it is a corridor/Rule-19 lab, not a current venue;
   "tidal flats" has no doc yet. Original design spec (recommended
   2026-08-03e: open water, no land/floes/current, uniform ~12kt wind, long
   beat to a single windward mark → long run → 270° hairpin into a beat →
   wide-gate control leg → finish; ~180-200s ideal pace): first session on
   it = wire `gauntlet_bench` (mirror bay_bench), bank a 20-seed baseline +
   human trajectories, then re-run the rejected RRS-shaping candidates
   there — it isolates boat-on-boat cause (the pinned-47° mystery and the
   bay true-none bin) and cuts gate wall-clock ~4x. Keep its start line
   wide and ordinary (start-pack tuning is sacred).

Gates, unchanged: paired A/B at 20 seeds bay / 16 seeds arctic on the target
venue; seatrials anchor 40t spot each landing (fresh 100t exists at
f6d4c98); goldens re-record only WITH an accepted behaviour change; judge
tails by paired per-boat deltas (positive = experiment faster,
`_fleet_pair.js` — the report's "negative = A faster" parenthetical is
misworded; trust the ledger convention). Byte-check treeB vs stored
baselines before analyzing any A/B.

---

## Session notes 2026-08-03f (research session; owner approved spin cap + autonomous run)

**LITERATURE RESEARCH LANDED (two web passes; full digest in memory
`regatta-avoidance-research.md`).** Headline: the pinned 46-48° mean
avoidance deflection is a DOCUMENTED pathology, not a tuning residue.
Koren & Borenstein (ICRA 1991) proved oscillation/over-deflection is
inherent to instantaneous cost-argmin steering; the Freezing Robot Problem
(Trautman, IROS 2010) explains the pin — a one-tick argmin cannot see the
low-deflection corridor that exists only if the rival also gives way, so
its argmin sits in the big-swing valley at ANY pricing. The five 2026-08-03e
probe rejections were the predicted outcome. The "classical list is
EXHAUSTED" verdict is REVISED: classical *re-pricing* is exhausted; the
literature's structural fixes were never tried. Consensus fixes, ranked by
cross-field convergence (ORCA/crowd + COLREGs-ASV — the latter is RRS's
near-exact analog): (1) maneuver commitment/episodes (entry gate, locked
passing side, min hold, switch penalty); (2) reciprocal responsibility
split by right-of-way role (ORCA half-planes; ROW boat's near-zero share =
RRS 16 for free); (3) horizon planning in velocity/maneuver space;
(4) deterministic side agreement (HRVO/asymmetric domains). Also: the 4x
RL seed-transfer failure matches documented protocol overfitting (fixed
training seeds are memorized — Zhang 1804.06893, Cobbe 1812.02341); the
corrected recipe (bounded zero-init residual policy, seed rotation,
held-out validation) is banked in the same memory file.

**Fleet-boat traffic under racing rules is essentially UNPUBLISHED** — no
prior art for dense RRS fleet racing; nearest donors are COLREGs ASV work
and one pairwise RRS-sailboat paper (Qi 2019). We are on our own past the
structural principles above.

**Owner decisions this session:** iceberg spin cap APPROVED ("looks very
unrealistic"); Wes building Redrock in a separate checkout (only redrock
changes — this checkout stable for A/B; expect an RNG reshuffle when his
branch merges, re-verify baselines then, per the 11a8f4b precedent).

**In flight:** (a) spin cap ω≤min(0.75,30/r) — radius-aware clampSpin at
spawn + collision kick (was flat ±0.75: a collision-kicked r=1100 berg
could sweep its rim at 821 u/s); gating on fresh 16-seed pair
headbase16d(treeB=HEAD ab30d3d) vs spincap1(treeA) — fresh baseline forced
by owner merge f444da9 (+1048 lines script.js, seed-class break); seatrials
40t pair must be byte-identical (clampSpin is floe-only code).
(b) Avoidance commitment layer v1 designed (episode side-lock keyed to the
existing threatBoat pairing, 2500·jamF wrong-side tax, racing legs≥1 only;
avoidance-forced-flip arms scoreTack tackCooldown 2.5s — closes the
two-deciders saw from the bay L1 diagnosis); builds after the cap verdict.

**SPIN CAP LANDED (d065d0a) + PRICED.** Seatrials 40t BYTE-IDENTICAL
(floe-only code). Fresh 16-seed baseline on Wes's new HEAD ab30d3d
reproduced the notch2 ledger EXACTLY (500/504.9/min 270/in-time 40/fins
131) — f444da9's 1048-line script.js change did NOT shift either seed
class; all stored baselines stay valid. The cap itself: paired −20 med /
−22.2 mean (n=125), in-time 40→32, fins@900 131→134, min 270→247,
loser-heavy tails. Read: ROTATING ICE WAS A LEAD-OPENER — spin churned
pack gaps open; capped ice locks a bad orientation in and the router
detours (probe: return med 147→174, offrt/none bins up; avoid-boat
DOWN 2303→1963 as predicted — rims are now predictable). Accepted as an
owner realism call, not an AI lever; the AI campaign re-anchors on the
post-cap world: **arctic 16-seed baseline = fleet_leg2_spincap1.json
(520/528.9/min 247/in-time 32/fins 134), transit probe baseline =
transit_attrib_postcap_base.json (transit med 235 ratio 1.86, ret 174
ratio 1.78)**. The cap constant (30/r) is dialable if Wes wants pack
churn back (60/r would kill only the >60 u/s tail = 14% of contacts).
Human trajectory bank was recorded in the SPINNING world — cross-world
human comparisons carry that asterisk until re-recorded.

**Commitment layer v1 (bundled) probe-REJECTED, split in flight.** v1 =
side-lock (2500·jamF wrong-side tax, bearing-sign side key) + forced-flip
tackCooldown arming, gated on the post-cap probe: transit mean 254→265,
avoid-boat 1963→2618, tacks 14→16 — WORSE. Suspected flaw: bearing-sign
side key degenerates near CPA (sign flips fast exactly where commitment
must be geometric, not angular — HRVO locks side in VELOCITY space).
Split probes running: v2a = flip-cooldown alone; v2b = side-lock alone
with near-CPA suspension (tCPA<1.5s or dist<90 frees the argmin).

**Commitment family REJECTED ON ARCTIC at probe level, all three shapes**
(8-seed _transit_probe vs transit_attrib_postcap_base, post-cap world,
baseline transit EXCESS 12865 / avoid-boat 1963 / ret EXCESS 9947):

| Variant | Mechanism | Verdict |
|---|---|---|
| v1 bundle | side-lock (bearing-sign key) + flip-cooldown | EXCESS 13781, avoid-boat 2618, tacks 14→16 — worst |
| v2a | flip-cooldown 2.5s alone | EXCESS 14010, avoid-boat 2299, turn 1909→2189 |
| v2b | side-lock alone, near-CPA suspended (tCPA<1.5 or <90u free) | EXCESS 13800, turn 2313, ret n=72→70 (two boats never completed) |

Mechanism-level read: against DRIFTING ice+boat compound scenes, per-tick
re-picking is ADAPTIVE — single-boat commitment holds stale geometry
longer and pays exactly where it binds. The literature's warning stands
in a sharper form: commitment kills dances only when paired with
RECIPROCITY (the other boat's predictable response); alone, in a moving
pack, it is a tax. Deflection stayed pinned 45-48° through all three
(eighth consecutive candidate). ⇒ Arctic escalation is now firmly
candidate #2 (RRS-asymmetric ORCA underlay) or driver-level RL.
v2a gets ONE focused bay 20-seed gate (its evidence base — the L1
two-deciders saw — is bay-native, and bay traffic is static-water):
bay_v2abase(treeA) vs bay_v2a(treeC) running.

**v2a bay gate: REJECTED — commitment family closed (4 variants, 2 venues).**
bayv2abase reproduced the stored 264-med baseline exactly (bay seed class
intact post-f444da9/post-cap; cap inert on bay end-to-end). v2a: fin med
266 (+2), mean +4.9 paired slower (n=180), pens 0.58→0.66, boat rubs
1.89→2.15 — BUT L1 med 48→46: the mechanism is RIGHT about the saw on the
diagnosed leg and still loses fleet-wide (held boards export cost to L3+
traffic). Ledger total: NINE traffic candidates rejected across the
campaign. Goldens re-recorded PASS 20/20 at b133b5d (f444da9 had silently
diverged all 20 hashes; verified FAIL on clean HEAD before re-record).
Live candidate in probe: cpagrad1 (reciprocal CPA gradient, τ=8s,
RRS-asymmetric shares 0.85/0.15/0.5, smooth credit for minimal-deviation
resolution — the first candidate that changes the OBJECTIVE SHAPE rather
than re-pricing it).

**cpagrad1 probe-REJECTED — TENTH traffic candidate; traffic thread CLOSED
this session.** Reciprocal CPA gradient (τ=8s, role shares 0.85/0.15/0.5,
smooth 1400·jamF credit under rDes): transit avoid 6264→7267 (boat
1963→2578), mean dev 47→50°, ratio 1.86→2.02, ret 174→184 med. Mechanism
of failure: ADDED on top of the existing binary terms it charges rent for
every sub-rDes CPA against every rival inside 700u — net MORE deviation
pressure. The honest ORCA is a REPLACEMENT of the boat-shaping objective
(binary bubbles + duck/bow swapped for half-plane constraints), which is
start-pack-adjacent surgery that should be built and gated on the REDROCK
GAUNTLET when Wes's venue lands, not patched into the pack blind.
Session traffic ledger: 10 rejections, 3 families (re-pricing ×5 prior,
commitment ×4, additive gradient ×1). Deflection pinned 45-50° through
ALL. ⇒ Next escalations, in order: (1) gauntlet-hosted avoidance-objective
replacement (ORCA-style, full swap); (2) driver-level transit RL with the
corrected protocol (bounded zero-init residual, ≥200-seed rotating pool,
held-out validation — memory regatta-avoidance-research.md has the recipe).

**Bay mechanisms 2a/2b in flight (treeC):** fresh hairpin probe baseline
reproduced the class (L3 6/61 ≥16s, L5 1/52; traces confirm both
anatomies: wrong-way arm at sw −4.32 with 1500u downwind blow-through
re-loop, and armed head-to-wind parks at speed 0.15 for 15-17s).
Implemented: powered-carve guard (armed + speed<0.9 ⇒ commands held
≥0.35 rad off dead upwind, close reach on current tack) + hairpin
approach-side bias (entry-sector scan biased toward the DMC tangent-in
sector, weight 9·hairpinness, FLOE-FREE venues only — arctic hunt
untouched per the ruler-entry rejection). Probe gate: ≥16s count 6→≤2.

**Capped arctic_eval @420, 16 seeds, spin-cap snapshot (d065d0a):** DNS
0.00%, DNF 0.00%, race med 420.0 (cap) / mean 403.7, pen/boat 1.50→1.23
(cap CUT penalties — fewer rim-strike fouls), groundings/boat 628.7
(flat; raw fires, not dedup'd). In-time truth stays the fleet_leg2
in-time count (32/144 = 22%).

**BAY PARK CLASS ROOT-CAUSED — it was the MARK-ESCAPE LATCH, not the
carve.** Split probes: entry-side bias alone = the whole bundle regression
(L3 6→9, L5 1→4, max 73.6s — it rafts the fleet onto the tangent-in
sector, reproducing the REJECTED ruler-entry geometry; do not re-price).
Carve guard alone = zero class effect (fired, changed nothing — the
strategy layer never commands the park). Fresh eyes on the traces: EVERY
park starts at d 28-53 from the mark = contact range. The escape latch
(`markEscapeHeading` = raw radial away-from-mark, wind-blind, 12.0s hold,
speedRequest 1.0) points dead upwind on a hairpin's windward side — the
15-17s parks are that latch, to the second. FIX (treeC): mark escape now
picks the best off-wind candidate ±1.05/±1.75 rad scored for
away-from-mark + 0.7·way-round tangent while armed (the island-escape
pattern, verbatim philosophy: never command an unsailable escape).
Probe: L5 ≥16s 1→0 (max 34.7→13), mark parks now recover in 4-5s;
L3 count flat at 6 but composition FLIPPED to the wrong-way-arm class
(sw −4.1 at arming) + traffic stops — the remaining L3 tail is entry-side
+ traffic, cleanly isolated. Full gate suite running (bay 20-seed,
seatrials 40t — mark rubs exist there, NOT inert — arctic 16-seed).

**✅ MARK ESCAPE ACCEPTED + COMMITTED c3e1313** (rows above). Bay: paired
med 0 / mean −0.7 with mark contacts 0.98→0.79, land 0.37→0.14,
start-cross max 120→62, fleet min 211 — FIRST bot run under the banked
human best (217.8). Boat rubs 1.89→2.35 (the tacktax trade again — held
boats rub instead of parking). Seatrials 40t 203.54/200.08 pen 0.36
(holds). Arctic: paired med 0 / mean +1.3, in-time 32→34, med 520→514,
winners-tilted tails, fins@900 134→131 churn priced per precedent.
Accepted quality-first at pace-neutral: the killed class (15-17s
head-to-wind park AT the mark) is the most player-visible AI stupidity
on the course. Goldens re-recording. NEW ARCTIC BASELINE =
fleet_leg2_markesc16.json; BAY BASELINE = bay_bench_baymarkesc.json.
Remaining bay L3 tail after this: wrong-way-arm class (sw −4.1 at
arming; entry-side bias REJECTED — needs a mechanism that doesn't raft
the fleet onto one sector) + traffic stops (the closed traffic thread).

## Next session brief (prepared 2026-08-03f, HEAD = session close)

**EVAL ANCHOR: 100t @ post cap+markesc HEAD = 202.64/199.05 pen 0.31 OCS
16.9% min 175.0 (canonical — supersedes f6d4c98).** Baselines: arctic
16-seed = fleet_leg2_markesc16.json (514/525.9/min 266/in-time 34/fins
131), bay 20-seed = bay_bench_baymarkesc.json (265/267.5/min 211),
transit probe = transit_attrib_postcap_base.json (PRE-markesc — re-run an
8-seed baseline before any transit A/B). Goldens PASS 20/20 at session
close. All four trees synced to session HEAD. ⚠️ Wes's Redrock branch
will merge from a separate checkout: expect a possible RNG reshuffle at
that merge (11a8f4b precedent) — byte-check baselines before any A/B on
the merged tree.

Priorities:
1. **Redrock gauntlet, when Wes's venue lands**: wire gauntlet_bench
   (mirror bay_bench), bank 20-seed baseline + human trajectories, THEN
   build the ORCA-style avoidance-objective REPLACEMENT there (swap the
   binary bubble + duck/bow shaping for reciprocal half-plane constraints
   in the traffic regime, racing legs only; the ten-rejection ledger says
   additive/re-priced variants are all dead — replacement is the only
   classical move left). Design notes in memory
   regatta-avoidance-research.md.
2. **Driver-level transit RL** (arctic, approved escalation): recipe in
   the same memory file — bounded zero-init residual Δψ≤25° at 2Hz on the
   classical navigator, MLP 2×32, CEM, ≥200-seed rotating pool, held-out
   validation, fitness = paired delta vs frozen-classical twin scored on
   avoid-mode seconds + finish. Fresh transit-probe baseline first.
3. **Bay wrong-way-arm class** (last designed mechanism owed): 6/61 L3
   roundings still ≥16s, now dominated by wrong-side arming (sw −4.1) +
   1100u blow-through. Entry-sector bias is REJECTED (rafts the fleet);
   design a PER-BOAT approach-line mechanism instead (e.g. bias each
   boat's own pre-zone approach point toward the required side, leaving
   the shared sector scan untouched). Also open: bay boat-rub vein
   (2.35/race vs human 0.14).
4. **Spin-cap constant**: 30/r landed; if Wes wants pack churn back
   (the −20s arctic cost), 60/r is the next notch — kills only the >60u/s
   rim tail (14% of contacts). World-side; his call.

---

## 10-HOUR AUTONOMOUS PUSH QUEUE (prepared 2026-08-03f; Redrock NOT ready — all work arctic/bay-hosted)

Research base: memory `regatta-sipp-routing.md` (space-time routing) +
`regatta-avoidance-research.md` (residual RL recipe + Sophy/RHEA digest).
Mission metric: ARCTIC MEDIAN (514 → down; human 229). Gates as always:
paired 16-seed arctic / 20-seed bay, seatrials 40t spot per landing,
goldens re-record only with accepted change, lexicographic acceptance —
pens/OCS/DNF not above baseline before pace counts.

**PHASE 0 (0.5h) — anchors.** Fresh 8-seed transit probe baseline on HEAD
(transit_attrib_markesc_base — RUNNING at queue time). Byte-check
fleet_leg2_markesc16 reproduces. If Wes merged anything: full re-baseline
first (11a8f4b rule).

**PHASE 1 (2.5-3.5h) — SIPP ROUTER + TIME-INDEXED CARROT (highest
conviction).** 2D safe-interval A* in sailcheck.js (pathSailableST):
per-cell safe intervals CLOSED-FORM from known floe drift (quadratic per
floe-cell pair, only floes whose swept corridor crosses the cell); wait ≈
sail-slow or forbidden; per-heading edge times from a coarse polar band;
output (x,y,t); follower carrot = plan position at t+lookahead (NO
nearest-point projection); replan ONLY on tracking deviation >threshold /
goal change / floe-velocity change events (curl makes drift quasi-linear —
re-check intervals against curl staleness ~10-15s); keep planFloeTrajectory
as contact layer; VENUE-GATED to floe courses (bay/seatrials byte-inert —
verify). Kill the 4s refreshBotGrid stamp cadence for routing (keep grid
for avoidance probes). Expected bins: offrt 2788, carrotJump 14/min, part
of avoid 6264. Go/no-go: 8-seed transit probe — dist ratio med 1.86 must
drop ≥0.15 with grind not up; then 16-seed gate. FALLBACK if too invasive
mid-build: TEB-lite band ((x,y,t) nodes, gradient repel from floes at
node timestamps, homotopy switch w/ hysteresis) — smaller, same staleness
fix.

**PHASE 2 (2-3h) — RHEA MACRO-ACTION UPGRADE of planFloeTrajectory.** The
existing 9s one-shot fan IS half an MPC; upgrade per PTSP-competition
findings: macro-actions (5-7 steering intents held ~1s, 6-9 genes),
population 10-14 × 3-5 generations, SHIFT BUFFER (carry last plan, pop
first gene), elites ALWAYS include (a) shifted previous plan (b) the
classical controller's own trajectory — planner provably ≥ today's AI.
Leaf value = progress-per-step along route + VMG − graded floe/RRS cost
(NEVER position-shaped — zig-zag farming). Round-robin boats to fit frame
budget. Go/no-go: 8-seed probe, avoid-mode seconds (112s of 258 transit)
must drop ≥10% with contacts flat; then 16-seed.

**PHASE 3 (3-4h) — RESIDUAL ES ON THE DRIVER (approved escalation,
corrected protocol), only after 1-2 verdicts.** Bounded zero-init residual
Δψ≤25° @2Hz on the (possibly new) navigator; obs = own/plan ~10 + 16-sector
floe ring ×2ch + 3-4 nearest-rival slots w/ ROW flag + 2-3 route lookahead
points (Sophy: lookahead beats rangefinder-only). Trainer sep-CMA-ES/CEM,
CRN-paired vs frozen-classical twin, fitness = Sophy-shaped: 1.0·progress
+ 0.5·symmetric windowed passing term (−20u/+40u) − 4·any-contact −
5·rules-engine-at-fault − small floe-grind term; LEXICOGRAPHIC foul gate.
Seed protocol: ≥200-seed pool, resample 16-24/generation, ~32-seed
held-out validation every 5 gens, checkpoint by validation, final 16-seed
gate disjoint. Scenario mix per generation at FIXED proportions: solo
transit / light traffic / full pack / spawned-mid-pack (Sophy stratified
pool; pure self-play rejected there). BC PRIOR (cheap multiplier, cut
first if time-short): relabel 16 human trajs as residuals (human − classical
at same obs), fit the MLP (GMM head unnecessary at 1-2 dim; short action
chunking), + ~200 DART-noised classical rollouts for recovery states;
checkpoint by ROLLOUT not loss; if greedy BC ≥ baseline−5% on 8 seeds →
CMA mean-init, else one seed individual. Budget truth: ~10k evals per 8h
at 8 seeds/candidate — plan for modest single-digit-% gains, not miracles.

**PARALLEL FILLER (while gates run) — bay wrong-way-arm.** Per-boat
approach-line bias (bias each boat's OWN pre-zone approach point toward
the required side; NEVER the shared sector score — rafting rejection).
Gate: hairpin probe ≥16s 6→≤3 without L5 regression, then bay 20-seed.

**EXPLICITLY DEFERRED:** ORCA objective replacement (needs Redrock lab);
Eureka/FunSearch-style LLM search (viable shape = LLM proposes planner-
cost variants gated by a 3→8→16 seed cascade — good SECOND 10h push once
SIPP/RHEA land); QD/PBT (skip per research); AlphaZero-style (skip).

Cut order if behind: BC prior → Phase 3 entirely → Phase 2 (Phase 1 has
the strongest evidence and the cheapest verdict).

---

## Session notes 2026-08-04a (10-hour autonomous push)

**PHASE 1 PREMISE TESTED BEFORE BUILD — SIPP IS NOT BUILDABLE HERE.** The
space-time router rests on one empirical claim, which the research digest
assumed rather than measured: floe drift is KNOWN and quasi-linear, so safe
intervals are closed-form and exact. Measured (`_drift_pred.js`, 3 seeds,
arctic, every floe sampled every 2s against its own future):

| horizon | linear-drift err | frozen-snapshot err | lin/radius | snap/radius | pans lin/r |
|---|---|---|---|---|---|
| 5s | 82u | 90u | 0.50 | 0.54 | 1.02 |
| 10s | 134u | 132u | 0.81 | 0.81 | 1.66 |
| 15s | 147u | 136u | 0.93 | 0.86 | 1.84 |
| 30s | 232u | **189u** | 1.52 | 1.24 | 3.04 |
| 60s | 500u | **307u** | 3.33 | 2.00 | 6.91 |

Linear extrapolation is BEATEN BY A FROZEN SNAPSHOT beyond 10s, and the
median pan is a full radius from any prediction of it inside 5 seconds.
Cause: 112 floes in a confined arena run mass-weighted elastic floe-on-floe
bounces plus shore reflection, so velocity is not persistent — the pack is
diffusive, not ballistic. Only BERGS (r>200, drift ×0.45) stay predictable
(0.21r @5s, 0.53r @30s, 1.16r @60s). ⇒ A space-time router would compute
exact safe intervals over fictional trajectories. Phase 1 as specified is
CANCELLED; the sipp-routing digest's "~100 LINEAR-drift floes" premise is
retired. (The SIPP *pathology* diagnosis stands — it is the fix that does
not transfer.)

**DEFECT FOUND BY THE SAME PROBE — the floe map refreshes every 16.7s, not
4.** `refreshBotGrid` gates on `state.time - c._botGridT < 4`, but
`state.time` is the WORLD CLOCK (`state.time += 0.24 * dt`, an animation
phase), not seconds. Measured rebuild spacing on arctic: 13.4, 16.68,
16.68, 16.67, … — a 16.67s cadence carrying a `+2s` mid-cadence lead sized
for a 4s one. `_map_validity.js` (3 seeds) prices the consequence:

| H | floe-blocked cells opened | newly blocked | plan churn @500u | @2000u | @8000u |
|---|---|---|---|---|---|
| 4s | 0% | 0% | 0u | 0u | 0u |
| 8s | 0% | 0% | 0u | 0u | 0u |
| 16s | 8% | 8% | 24u | 36u | 72u |
| 30s | 24% | 23% | 63u | 71u | 599u |
| 60s | 44% | 44% | 145u | 217u | 1831u |

The map is FROZEN for five to eight consecutive replans, then snaps — which
is the carrotJump 14/min signature seen from the route side. Rebuild cost
measured at 55.2ms (190×190 grid, 112 floes); pathSailable over leg 1 is
8.6ms.

**Two probe candidates in flight** (8 seeds vs `transit_attrib_markesc_base`,
byte-reproduced in treeB first — `transit_attrib_byteck.json` is bit-identical):
- `cad4` (treeC): cadence truth — gate in real seconds via a named
  `WORLD_CLOCK` constant. One mechanism: map freshness.
- `hgrade` (treeD): horizon-graded floe cost in `pathSailable` — the soft
  (floe-plugged) multiplier holds full value inside 700u and fades to a
  density tax (2.5→1.3 opening, 6→1.8 plugged) past 3000u. Rationale is the
  measurement above: past ~10s the specific gap is noise but the PACK is
  stable, so ice should price as density at range and be threaded locally by
  planFloeTrajectory, which works at 9s where prediction still holds. This
  is the industry split (global planner sees static/slow, movers belong to
  the local layer) that the digest cited — the measurement says floes are
  movers, so they do not belong in the global maze at all.

**`hgrade` PROBE-REJECTED — and the rejection is informative.** Fading the
soft (floe-plugged) multiplier from 2.5/6 inside 700u to 1.3/1.8 past 3000u:
transit med 240→238 but mean 265→269, **dist ratio 1.87→1.87 (moved not at
all)**, EXCESS 13841→14131, avoid 6692→6889, xtrack 587→607. Return was
mildly better (ratio 1.97→1.90, EXCESS −272, med −4) — transit is the
mission metric and the gate (ratio −0.15) is untouched. ⇒ Mechanism read:
THE 1.87x TRANSIT RATIO IS NOT FAR-FIELD FLOE DETOURING. Making distant ice
nearly free changed neither the distance sailed nor the cross-track, so the
route length is set by something else (near-field threading, the wide-water
/ lee-shore weights, or execution). Do not re-price the far field again.

**✅ `cad4` (CADENCE TRUTH) PROBE-PASSED, LARGE — every bin down.** 8 seeds
vs `transit_attrib_markesc_base`:

| metric | base | cad4 | |
|---|---|---|---|
| transit med / mean | 240 / 265 | **208 / 229** | −32 / −36 s |
| transit dist ratio | 1.87 | **1.73** | −0.14 |
| transit EXCESS | 13841 | **11419** | −2422 u |
| ├ avoid | 6692 | 5459 | −1233 |
| ├ offrt | 3101 | 2552 | −549 |
| ├ turn | 2156 | 1725 | −431 |
| └ rec | 1068 | 800 | −268 |
| avoid-boat / -none | 2481 / 2529 | 1930 / 2147 | both down |
| xtrack mean / >300u | 587u / 60% | 505u / 56% | |
| slow mean / grind med | 42 / 10.8 | 32 / 9.9 | |
| tacks med | 14 | 15 | +1 |
| carrotJump | 13.7/min | 14.8/min | +1.1 (see below) |
| RET med / ratio | 183 / 1.97 | **149 / 1.70** | −34 s / −0.27 |
| RET EXCESS | 10645 | **8667** | −1978 u |

Letter-vs-spirit, stated plainly: the go/no-go asked for dist ratio −0.15 and
transit delivered −0.14 (the return delivered −0.27). Median −32s with grind
DOWN carries it to the 16-seed gate; the 0.01 is noted, not hidden.
carrotJump rising while every cost bin falls is the expected signature — a
map that actually updates produces more genuine replans, and the plans it
produces are cheaper. **Mean avoidance deflection 47°→46°: still pinned, as
predicted. Map freshness and the Freezing-Robot deflection are separate
problems** — this fix does not touch the traffic thread's twelve rejections.

**ROUTE ATTRIBUTION — the 1.87x transit ratio is NOT the router's plan.**
New instrument `_route_attrib.js` (8 seeds, baseline HEAD) samples, per
transit second, the boat's OWN gridPath against the ruler:

| plan/dmc-remaining | off-own-plan | xtrack to ruler | plan waypoints | seconds with no plan |
|---|---|---|---|---|
| med **0.81** | med **155u** | med 543u | 116 | 0.0 of 265 |

The router plans a route FOUR FIFTHS the length of the ruler remaining (the
ruler carries rounding arcs the router cuts), and the boat sits 155u from
that plan — yet the odometer is 1.87x. So neither "the plan is long" nor
"the boat is off the plan" is true. What is left is the work between the
waypoints: leg 1 demands 42% upwind by distance (probe header), so ~1.45x
is a legitimate beat, and the remaining ~0.3-0.4x is tacking overhead,
avoidance deflection and re-decision — NOT routing. This retires the whole
"make the router smarter" family for transit, `hgrade` included, and points
the remaining classical headroom at the driver. It is also why the map-
freshness fix works where every route-shaping candidate failed: cad4 does
not change where the route goes, it stops the boat from acting on ice that
has already moved.

**✅ BAY CUT-LEAD ACCEPTED — the owed wrong-way-arm mechanism.** Per-boat
entry lead: on the cut-in the boat aims `_entryBrg + sgnR * 0.6` at 0.72x
zone instead of dead at `_entryBrg`, so it crosses the rim already rotating
the required way. Floe-free venues only (arctic ring untouched, per the
ruler-entry line). Diagnosis: five of six ≥16s roundings arm with sweep
ALREADY at −0.69..−1.99 and run it to −4.8 before unwinding — a radial dive
crosses the rim with no tangential velocity and at v/r = 2.3 rad/s (150 u/s,
65u off the mark) the first second decides the direction.

| gate | baseline | cut-lead |
|---|---|---|
| hairpin L3 ≥16s | 6 | **2** (gate ≤3) |
| hairpin L3 p90 / max | 14.3 / 44.7 | **7.2 / 26.9** |
| hairpin L5 ≥16s / max | 0 / 13.0 | 0 / 13.2 (flat) |
| bay 20-seed fin med / mean | 265 / 267.5 | **260 / 263.8** |
| paired fin med / mean | — | **+4 / +3.7 faster** (n=180) |
| finishers / DNF | 180 / 0 | 180 / 0 |
| pens per boat | 0.59 (107) | 0.62 (111) |
| OCS | 5.6% | 5.6% |
| boat / mark contacts | 423 / 142 | 417 / 142 |
| land contacts | 25 | 39 |
| fleet min | 211 | 214 |

Lexicographic honesty: penalties are UP by four events on a base of 107.
Per-seed it is 9 seeds up, 8 down, 3 flat, range −4..+5 — 0.36 sigma of the
seed-level spread, i.e. noise, not a foul regression. Land contacts 25→39
are concentrated the same way (base: 4 seeds carry all 25; cut-lead: 6 carry
39; seed 9107 goes 6→0 while 9100 goes 0→8) — episode reshuffling, not a
new grounding class. Accepted on: diagnosed class cut by two thirds AND the
fleet 3.7s/boat faster with contacts otherwise flat-to-down.

**✅ cad4 ARCTIC 16-SEED GATE — the largest single gain in this campaign.**
`fleet_leg2_cad4x16` vs `fleet_leg2_markesc16`:

| metric | markesc16 | cad4x16 |
|---|---|---|
| rounders | 140/144 | **144/144** |
| finishers @900 | 131 | **139** |
| fin med / mean | 514 / 525.9 | **461 / 481.5** |
| fleet min | 266 | **250** |
| in-time (≤420) | 34 | **53** |
| paired (n=126) | — | **med +56 / mean +49.4 faster** |
| tails | — | winners>10s 78 v losers 39; >40s 71 v 32 |
| finished-only-in | A 13 | B 5 |

Byte-inert off arctic, verified not assumed: bay hairpin probe JSON is
bit-identical to `bay_hairpin_hp_markesc.json` (a floe-free venue re-stamps
the same grid, and buildGrid's content cache hands back the same object).

**CADENCE SWEEP — fresher keeps winning, AND IT BREAKS THE PINNED
DEFLECTION.** Same 8-seed probe, only `BOT_GRID_EVERY` changed:

| | base (16.7s) | cad4 | cad2 |
|---|---|---|---|
| transit med / mean | 240 / 265 | 208 / 229 | **179 / 202** |
| dist ratio | 1.87 | 1.73 | **1.54** |
| EXCESS | 13841 | 11419 | **9601** |
| ├ avoid | 6692 | 5459 | **4204** |
| ├ offrt | 3101 | 2552 | **2500** |
| └ turn | 2156 | 1725 | **1388** |
| grind med / slow med | 10.8 / 35.1 | 9.9 / 29.4 | **4.5 / 17.2** |
| **mean deflection** | **47°** | **46°** | **42°** |
| RET med / ratio | 183 / 1.97 | 149 / 1.70 | 148 / 1.68 |

**The 46-48° deflection that survived TWELVE traffic candidates moved to 42°
when the map got fresh.** That is the campaign's standing puzzle answered
from an unexpected direction: the swing was not mispriced, it was aimed at
ice that had already drifted away. A cost function cannot be tuned out of a
wrong map, which is exactly why re-pricing, commitment and reciprocity all
failed against it — they were all arguing about the right response to a
phantom. The Freezing-Robot reading of the pinned deflection is now at least
partly retired; how much is left at a correct map is what the sweep measures.

**DEFLECTION HISTOGRAM (`_defl_hist.js`, 4 seeds, 596k transit boat-frames,
51% of them with avoidance active)** — and it kills the fan-resolution idea
before it cost anything: share by rung 0.1→13.8%, 0.2→9.2%, 0.4→16.4%,
0.6→11.2%, 0.8→9.3%, 1.2→11.9%, 1.6→14.3%, 2.2→9.1%, 3.0→4.8%. Nearly FLAT
across the whole fan — no quantization pile-up, so the 47° mean is a broad
distribution's average and finer candidates buy nothing. The real shape
worth naming: **40% of avoiding frames are ≥1.2 rad (69°+) and 28% are ≥1.6 rad
(92°+), with 4.8% at the ±3.0 near-reversal rungs that exist for "nosed into a
berg or wall".** The tail, not the mean, is the story. (Those two shares were
first written here as 28% and 14% — read off the wrong side of the cumulative
column. The corrected figures are above and in the post-fix table below.)

**CADENCE SWEEP CLOSED — knee at 2s.** cad1 (1s) is WORSE than cad2:
transit med 200 / mean 220, ratio 1.63, EXCESS 10142, grind 7.6, dev 44°
— between cad4 and cad2 on every line. Fresher is better only down to 2s.
(Confound named honestly: the stamped lead was a literal +2s across the whole
sweep, so at cad4 it was half a cadence, at cad2 exactly one, at cad1 two.
"Lead = one cadence" and "cadence = 2s" are not yet separated; a derived
half-cadence lead is under its own probe and is NOT what shipped.)

**✅ cad2 ARCTIC 16-SEED GATE — accepted, and it is the campaign's largest
result by a wide margin.**

| metric | markesc16 | cad4x16 | **cad2x16** |
|---|---|---|---|
| rounders | 140/144 | 144/144 | **144/144** |
| finishers @900 | 131 | 139 | **142** |
| fin med / mean | 514 / 525.9 | 461 / 481.5 | **426 / 459** |
| fleet min | 266 | 250 | **219** |
| in-time (≤420) | 34 | 53 | **71** |
| paired vs base | — | +56 / +49.4 | **+72 med / +70.9 mean** |
| tails vs base | — | 78 v 39 | **90 v 36**; >40s **74 v 28** |

cad2 over cad4 head to head: paired +15 med / +25.2 mean, finished-only 5 v 2.
Arctic median **514 → 426**, and the fleet min of 219 is now UNDER the banked
human reference (229) — the first time on this venue.

**PERFORMANCE — the fix quadrupled a 55ms rebuild, so the rebuild got cheap.**
`SailCheck.stampFloes` copies the static land nav and clears only the cells the
ice actually covers, instead of re-testing 36100 cells against every land shape
to re-derive an answer that never changed. `_grid_stamp_check.js` compares it
against a full `buildGrid` CELL FOR CELL at every rebuild of a live race —
**88 rebuilds, 0 mismatched cells, 48.8ms → 1.4ms (35x)**. A faster answer that
was a different answer would be a behaviour change wearing a performance
commit's clothes, so the equality is asserted, not argued.

**Derived half-cadence lead PROBE-REJECTED.** `BOT_GRID_LEAD = BOT_GRID_EVERY/2`
(true mid-life for the map instead of always running late): transit med 203 /
mean 207, ratio 1.62, EXCESS 9674, dev 43° — worse than cad2's literal +2s on
median, mean, ratio and excess (avoid alone was better, 4071 v 4204). The map is
consumed across the whole of its 2s life by planners that look AHEAD, so a lead
of one full cadence beats half of one. Ships as the literal 2.

**LANDED, gated and committed:**
- `83f6293` test suite repair (no behaviour) — `npm test` had been dying early
  on stale `VENUES` globals since the venue-document migration, hiding
  everything behind it.
- `1fa0f32` cadence truth. Verified byte-inert off arctic: bay hairpin probe
  bit-identical to the cut-lead run, seatrials 100t reproduces the anchor
  EXACTLY (202.64/199.05 pen 0.31 OCS 16.9% min 175.0). Goldens re-recorded —
  4 of 20 traces moved, and they are the four that should (bay ×2, arctic ×2);
  the other sixteen venues are bit-identical.
- `0e377eb` + wiring: `stampFloes`.

**NEW ANCHORS (2026-08-04a):** arctic 16-seed = `fleet_leg2_cad2x16.json`
(426 med / 459 mean / min 219 / in-time 71 / fins 142 / rounders 144),
bay 20-seed = `bay_bench_baycutlead.json` (260 med / 263.8 mean / min 214),
transit probe = `transit_attrib_cad2.json` (transit med 179 ratio 1.54,
ret 148 ratio 1.68), seatrials 100t = 202.64/199.05 pen 0.31 OCS 16.9%
(UNCHANGED — it is the anchor precisely because nothing here touches it).

### The prediction-validity family, probed against the new cad2 baseline

The cadence win came from one idea — *the AI's model of the ice must not
outrun the window in which the ice is knowable*. Two more places make the same
assumption, so both were probed. **Both failed, and the failures sharpen the
idea rather than repeating it.**

| | cad2 base | `lead4` (soft horizon 8→4s) | `roll5` (rollout 9→5s) |
|---|---|---|---|
| transit med / mean | 179 / 202 | 186 / 214 | 188 / **199** |
| dist ratio | 1.54 | 1.62 | **1.53** |
| EXCESS | 9601 | 10114 | **9208** |
| ├ avoid | 4204 | 4222 | **4145** |
| ├ offrt | 2500 | 2909 | **2237** |
| └ rec | 627 | 755 | **548** |
| slow med / grind med | 17.2 / 4.5 | 25.8 / 6.6 | 18.3 / 5.5 |
| mean deflection | 42° | 43° | 43° |

**`lead4` REJECTED — and it corrects the idea.** Shortening the opening-lead
classifier made everything worse (offrt +409, slow +8.6s, ratio +0.08). The
classifier is not a position estimate, it is a BINARY BET on whether a plugged
cell will open, and its cost of being wrong is asymmetric: call an opening lead
plugged and the router pays ×6 to route around water that will be clear. At 4s
almost nothing opens within the horizon, so nearly every plug reads as a wall.
A noisy 8s bet beats a precise 4s "no". ⇒ Prediction error bounds where a
POSITION may be trusted, not where a decision may look.

**`roll5` REJECTED on its gate, but it is a real split.** Better on every
aggregate — mean −3, EXCESS −393, offrt −263, rec −79, weave and lateral both
down — and WORSE on the median (179→188), which is the mission metric. Its
Phase-2 gate (avoid-mode −10%) came in at −1.4%. Mechanism: cutting the horizon
removes fictional far contacts (the aggregates) and the real early warning with
them (the median). ⇒ The horizon is not the wrong knob, it is the wrong SHAPE
of knob: a point estimate at t=8 is either precisely wrong or invisible.

**⇒ `cone8` in flight** — keep the 9s horizon and grow the floe's radius with
the prediction it rests on (`+8·t`, half the measured error growth), so a late
contact reads as a fat maybe instead of a sharp miss. And **`lead12`**, pushing
the classifier the way `lead4` says it wants to go.

**`age4` REJECTED HARD — map freshness and plan stickiness are COMPLEMENTS,
not substitutes.** Reasoning that a 12s cap on the route thread lets a boat
follow a plan six map generations old, it was cut to 4s (two generations):
transit med 179→**214** (+35s), mean 202→223, ratio 1.54→1.66, EXCESS
9601→11081, avoid 4204→**5235** (boat 1650→2296), turn 1388→1843, deflection
42→45°. The worst single probe of the session.

The mechanism is the router comment's own warning, reasserting itself in a
world where it finally applies: "replanning every couple of seconds through a
drifting pack threads a DIFFERENT micro-gap each time." Under the FROZEN map
that warning was dormant — replanning against an unchanged map returns the same
path, so the stickiness was costing nothing and protecting nothing. Now the map
genuinely moves, so every replan really does re-thread, and the 12s cap is load
bearing for the first time. ⇒ **Fixing the map made route commitment MORE
valuable, not less.** Probing the other way (`age20`) rather than assuming 12
is the knee.

### HORIZON FAMILY CLOSED — every knee confirmed on BOTH sides

Six probes, all against the cad2 baseline (transit med 179 / EXCESS 9601 /
ratio 1.54 / dev 42°). Each of the AI's three ice horizons was pushed both
ways, which is the only way to tell a knee from a direction:

| knob | shorter | **current** | longer |
|---|---|---|---|
| opening-lead classifier (`HORIZON`) | `lead4`: med 186, EXC 10114, slow 25.8 | **8s — optimum** | `lead12`: med 205, EXC 10409, grind 10.8 |
| route-thread staleness (`gridAge`) | `age4`: med **214**, EXC 11081, avoid 5235 | **12s — optimum** | `age20`: med 198, EXC 10832, avoid 4973 |
| trajectory rollout (`T`) | `roll5`: med 188, EXC **9208** (mean better, median worse) | **9s — optimum** | `cone8` (uncertainty cone +8·t): med **221**, EXC 12227 |

**⇒ THE CADENCE WAS THE ONLY MISTUNED HORIZON.** Every other horizon in the
ice model was already sitting at a local optimum, and three of them are now
verified on both sides rather than merely inherited. That is worth as much as
a win: it says the remaining transit excess is NOT a horizon-tuning problem,
and the next session should not spend an hour rediscovering it.

`cone8` deserves its own line because it failed the way the memory warned:
growing the floe radius with prediction uncertainty (+8 u/s, half the measured
error growth) reproduced the classic over-inflation pathology exactly — "an
over-inflated pack reads as closed water and the planner refuses gaps boats can
take" — offrt 2500→3166, avoid-boat 1650→2040, ratio 1.54→1.77. Uncertainty
belongs in the WEIGHT, not in the radius; the existing `1 − contactT/T` term
already discounts far contacts and is apparently enough.

### The world after the fix — re-measured, so the next session starts from truth

Every bin below was re-run on the committed HEAD. The old numbers describe a
world that no longer exists; do not pair against them.

| | pre-fix HEAD | **cad2 HEAD** |
|---|---|---|
| plan / dmc-remaining | 0.81 | **0.78** |
| off-own-plan | 155u | **126u** |
| cross-track to ruler | 543u | **441u** |
| transit frames with avoidance active | 51% | **45%** |
| deflection ≥69° / ≥92° / near-reversal | 40% / 28% / 4.8% | **35% / 23% / 3.7%** |
| mean deflection | 47° | **42°** |

The deflection histogram is still near-flat across the fan, so the
fan-resolution reading holds: the rungs are not the quantizer. What changed is
that the whole distribution slid down a rung — fewer frames avoiding at all,
and the ones that do avoid swing less. Consistent with the mechanism: a
correct map produces fewer phantom threats AND smaller responses to the real
ones.

**Where the remaining transit excess lives (9601u mean, cad2):** avoid 4204
(sub-bins: boat 1650, none 1487, static 600, both 466), offrt 2500, turn 1388,
sail 883, rec 627. Avoidance is still the largest single bin and is still
BOAT-dominated, which is the closed traffic thread — twelve rejections, and the
next escalations remain (1) the ORCA-style objective REPLACEMENT hosted on the
Redrock gauntlet and (2) driver-level RL. Both were and are the standing plan.

## Next session brief (prepared 2026-08-04a, HEAD = session close)

**ANCHORS — all re-measured on this HEAD, all committed:**
- arctic 16-seed = `fleet_leg2_cad2x16.json` — **426 med / 459 mean / min 219 /
  in-time 71 / fins 142 / rounders 144/144**
- bay 20-seed = `bay_bench_baycutlead.json` — **260 med / 263.8 mean / min 214**,
  180/180 finishers, pens 0.62, OCS 5.6%
- transit probe = `transit_attrib_cad2.json` — transit **179 med, ratio 1.54**,
  EXCESS 9601, dev 42°; return 148 med, ratio 1.68
- seatrials 100t = **202.64 / 199.05 pen 0.31 OCS 16.9% min 175.0 — UNCHANGED**,
  and it stays the anchor precisely because nothing this session touched it
- goldens PASS 20/20 at close; `npm test` runs end to end for the first time in
  a while (three genuine content failures remain, listed below)
- all four trees synced to HEAD except treeB, which is TRACKED IN GIT and still
  holds the pre-fix build — useful as a before/after reference, and the reason
  not to rsync it casually

**What this session did, in one line each:** found the bots' floe map refreshing
every 16.7s instead of 4 (`state.time` is a 0.24x world clock, not seconds),
fixed it, swept the cadence to a 2s knee, and took the arctic median 514→426;
landed the bay wrong-way-arm mechanism the previous session owed; cancelled
SIPP on a measurement before writing it; made the rebuild 35x cheaper so the
new cadence is affordable; and repaired an `npm test` chain that had been dying
early since the venue-document migration.

Priorities, in order:

1. **DO NOT re-tune the ice horizons.** All three are now verified knees on
   BOTH sides (opening-lead 8s, route-thread 12s, rollout 9s). The cadence was
   the only one that was wrong. An hour spent here is an hour wasted.

2. **Driver-level transit RL** (approved escalation, recipe in memory
   `regatta-avoidance-research.md`). This is now the strongest remaining lever
   and the ground under it has improved: the classical driver is 88s/race
   faster than when the RL plan was written, avoidance is active in 45% of
   transit frames rather than 51%, and — importantly for a residual policy —
   the observation is no longer poisoned by a stale map, so what the policy
   sees is what is there. Fresh CRN baseline first (`transit_attrib_cad2`).

3. **ORCA objective replacement on the Redrock gauntlet** when the venue lands.
   Avoidance is still the largest excess bin (4204 of 9601) and still
   boat-dominated (1650). Twelve traffic candidates are dead; replacement, not
   re-pricing, is the only classical move left. Note the deflection is no
   longer "pinned" — it moved 47→42 when the map was fixed — so the
   Freezing-Robot reading should be re-derived on this HEAD before designing
   against it.

4. **Two more `state.time`-as-seconds instances, deliberately NOT fixed** —
   both would move penalties, which the lexicographic gate forbids without
   their own gates, and both are owner calls about rules behaviour rather than
   AI pace:
   - `foulCooldowns[id] = state.time + 20` — a "20 second" no-contact-foul
     cooldown that is really **83 seconds**, i.e. the same pair is
     under-penalised for over a minute.
   - `rules.js`: `now - data.rowChangeTime < 2.0` — "2 seconds" of ROW-change
     hysteresis that is really **8.3 seconds**.
   Fixing either RAISES penalty counts (more fouls caught), so they need to be
   judged as rules correctness, not as pace.

5. **Three genuine test failures now visible** (all fail identically on the
   pre-fix HEAD — they were hidden behind the broken chain, not caused by it):
   - `test_sailable`: Lighthouse Cove's IDEAL path registers 4 of 7 legs and
     never finishes. This is the check whose entire job is to catch that.
   - `test_editor` 10 failures, `test_results` 3 failures.

6. **Bay**: the wrong-way-arm class is cut (L3 ≥16s 6→2) but not gone. Two
   remain, plus the traffic stops. Bay boat rubs are 2.32/race against a human
   0.14 — the largest untouched gap on that venue.

### One horizon that had NEVER been checked — and it is a knee too

`applyAvoidance`'s `lookaheadFrames = 240` (4s) is the only horizon in the
steering stack that is not about ice, so it does not inherit the ~5s floe
validity limit — boats sail smoothly, ice bounces. It had never been probed.
Both ways, against cad2:

| | cad2 base | `look150` (2.5s) | `look360` (6s) |
|---|---|---|---|
| transit med / mean | 179 / 202 | **179** / 204 | 227 / 253 |
| dist ratio | 1.54 | **1.39** | 1.85 |
| EXCESS | 9601 | **8794** | 13572 |
| ├ avoid (boat / none) | 4204 (1650/1487) | **3556 (1266/1282)** | 7160 (2465/3121) |
| └ turn | 1388 | **1090** | 2343 |
| grind med / share | 4.5 / 5% | **7.7 / 8%** | 7.6 / 5% |
| slow med | 17.2 | 21 | 27.4 |

**`look360` REJECTED** decisively (+48s median) — a 6s bubble makes every
neighbour a permanent threat, and avoid-none doubles (1487→3121): the boat is
dodging things that are not going to be there.

**`look150` REJECTED, and it is the most interesting rejection of the session.**
It produces the largest distance improvement anything has produced here —
ratio 1.54→**1.39**, EXCESS −807, avoid-boat −384, turn −298 — and converts
NONE of it into time: median exactly flat at 179, mean +2. The reason is in the
next row: grind median 4.5→7.7 and its share 5%→8%. A shorter lookahead buys a
straighter track by paying in ice contact, and on this engine contact is
expensive (60% speed loss per contact-frame). Lexicographically it fails
outright — contact up, pace not improved — so it does not go to a fleet gate.

⇒ **4s is a knee, like the other three.** But it is a knee on a TRADE CURVE
(distance against contact) rather than a plateau, which makes it the one place
a better mechanism could still bank something: anything that lets a boat hold
the straighter 2.5s line WITHOUT the extra grind converts ~800u of excess
directly. That is a real, sized, open lead for the next session — and it is
about contact discipline, not about avoidance pricing, so it is not in the
closed traffic thread.

**Capped arctic_eval @420, 16 seeds, cad2 HEAD (144 boat-races):** DNS 0.00%,
DNF 0.00%, race med 420.0 (cutoff-capped) / mean **395.4** (was 403.7 at the
03f snapshot), pen/boat **1.26** (was 1.23 — flat), groundings/boat 681
(raw contact fires, not dedup'd; was 628.7). True in-time arrival is the
fleet_leg2 count, **71/144 = 49%** — was 22%. The capped row is cutoff-bound
and will stay 420 median until the fleet median clears the cutoff; the honest
headline is the uncapped 426 and the in-time count more than doubling.

### The lookahead 2×2, mapped — and the trade is real in both directions

`lookaheadFrames` drove BOTH the rival projection and the static/ice probe
segment (marks, boundary, grid walk, floe polygons all test `boat → future`).
Those two want opposite things, so the constant was split (`staticFrames`) and
all four corners measured. All against cad2:

| boat / static | med | mean | ratio | EXCESS | avoid (boat) | grind med | slow med | dev |
|---|---|---|---|---|---|---|---|---|
| **4.0 / 4.0 (shipped)** | **179** | 202 | 1.54 | 9601 | 4204 (1650) | **4.5** | **17.2** | 42° |
| 2.5 / 2.5 (`look150`) | **179** | 204 | **1.39** | 8794 | 3556 (1266) | 7.7 | 21.0 | 43° |
| 2.5 / 4.0 (`split150`) | 197 | 215 | 1.61 | 10297 | 4722 (**1799**) | 6.3 | 18.9 | 44° |
| 4.0 / 2.5 (`split_s150`) | 195 | **198** | 1.50 | **8549** | **3298 (1214)** | 7.2 | 25.8 | **41°** |

**All three alternatives REJECTED on the median.** What the grid buys is a
clean decomposition of a result that was ambiguous when the two horizons were
one number:

- **The rival horizon wants 4s.** Shortening it ALONE (`split150`) is the only
  change that raises avoid-boat (1650→**1799**): a rival reacted to late needs
  a harder swerve, and the harder swerve is the cost. 6s is worse still
  (`look360`, avoid-none doubled). 4s is a genuine two-sided knee.
- **The static probe sits on a trade, not a knee.** Shortening it reliably buys
  distance and avoidance — `split_s150` posts the LOWEST excess (8549), lowest
  avoidance (3298), lowest deflection (41°) and best mean (198) of anything
  measured this session — and reliably pays it back in grind (4.5→7.2) and slow
  time (17.2→25.8). Seeing ice later means deviating for it less and hitting it
  more, and on this engine a contact frame costs 60% of speed.
- **`look150`'s distance win was never about boats.** It came entirely from the
  short static probe; the split proves it by separating them.

⇒ The shipped 4/4 is the MEDIAN optimum and stays. The open lead is unchanged
in shape but now precisely sized and located: ~1000u of excess sits behind the
static probe, and it is unlocked by CONTACT DISCIPLINE (arriving at ice with
speed and a plan) rather than by the horizon constant, which only chooses which
side of the trade to pay on. Explicitly NOT an avoidance-pricing problem, so
not part of the closed traffic thread.

---

## 2026-08-04b — post-merge verification + Redrock gauntlet prep

**Wes's merge `930bb36` is AI-NEUTRAL — verified, not assumed.** It brought
1473 lines of `redrock.venue.js` and 37 lines of `script.js`. The script lines
are a wind-streak spawn RESAMPLE (up to 6 rolls instead of 1), a comment, and
the results-screen gold-tile rule. The resample draws extra RNG, which is
exactly the class of change that has retired baselines before (11a8f4b) — but
it draws from `fxRand`, the isolated visuals stream (comets, particles, wakes;
no gameplay consumer). Confirmed empirically:
- 8-seed arctic transit probe **byte-identical** to `transit_attrib_cad2.json`
- goldens: **18 of 20 bit-identical**; the two that moved are redrock/90210 and
  redrock/90211, i.e. exactly the venue whose document was rewritten
⇒ **All four anchors from 2026-08-04a stand unchanged.** Redrock's two goldens
are deliberately NOT re-recorded: the venue is not raceable yet (below), and
baking a broken course into the reference would make the check pass on a course
nobody can sail.

**⚠️ REDROCK IS NOT READY TO BE THE GAUNTLET — three of four rounding marks are
planted inside rock.** `test_sailable`: the ideal path completes **1 leg of 6**
and never finishes; legs 1, 2 and 3 report "0deg open at 64u". New instrument
`_redrock_marks.js` reports what a fix needs, per mark, at a ladder of radii:

| leg | mark | side | centre on water | nearest water | best unbroken arc by radius | verdict |
|---|---|---|---|---|---|---|
| 1 | mark-3 | port | **NO** | 140u @ 25° | 0° @64-100, 345° @180, **360° @220** | roundable WIDE only |
| 2 | mark-4 | stbd | **NO** | 100u @ 100° | 0° @64, 135° @140, **180° max @180** | **NOT ROUNDABLE at any radius to 420u** |
| 3 | mark-5 | stbd | **NO** | 120u @ 50° | 0° @64-100, **360° @180-260** | roundable WIDE only |
| 4 | mark-6 | stbd | yes | — | **360° @64-140** | fine |

All three bad marks carry `markRadius 12, zone 250` — a dinghy buoy's radius,
planted in a spire. The tight rounding radius the sailability check tests is
`max(radius + CLEARANCE + 8, radius*1.12)` = **64u**, which is solid rock.

**The precedent is already in the repo — arctic solves this exactly.** Glacier
Sound's rounding mark is also planted in land, and it passes:

| | radius | zone | tight rounding radius | arc there |
|---|---|---|---|---|
| arctic `round-1` | **405** | **851** | 457u | 295° open — PASSES |
| redrock `mark-3/4/5` | 12 | 250 | 64u | 0° — FAILS |

⇒ **Fix shape: size the mark to the thing it is mounted on.** A mark on a spire
has the spire's radius (~150-180 here), and a zone that clears it. That makes
the geometry honest, makes the engine's `_roundR` ladder pick a radius a sailor
would recognise, and makes the check pass for the right reason rather than by
loosening it. `mark-4` needs more than a radius: at its BEST radius it still has
only 180° of unbroken water, so it has to move (nearest open water 100u at
bearing 100°) or the spires around it need a gap.

**The bots are not fully blocked, which is why this needs saying carefully.**
`gauntlet_bench.js` is wired (mirrors `bay_bench`, player parked at −6000,6000)
and a 2-seed smoke run completes: legs reached 9/9/9/7/7/6, **finishers 6 and 5
of 9**, finish times **510-828s** (bay 260, arctic 426). The engine's `_roundR`
ladder finds `zone*0.75 = 187.5`, which IS open for marks 3 and 5 — so the
fleet grinds round the wide way and bleeds boats at legs 4-6. A gauntlet
baseline banked on this course would be measuring the venue's geometry, not the
AI, so **no baseline is banked until the marks are fixed.**

---

# ⚡ 8-HOUR AUTONOMOUS PUSH QUEUE (prepared 2026-08-04b, for a FRESH INSTANCE)

## PRIME DIRECTIVE — work the whole eight hours

The previous push stopped after ~2.5 hours of wall clock, and the reason was
structural, not a lack of things to do: the queue was front-loaded with two
phases (SIPP router, RHEA planner) that a single measurement cancelled in the
first forty minutes, and there was nothing independent queued behind them.
Three rules follow, and they are not optional:

1. **KEEP AT LEAST FOUR PROBES IN FLIGHT.** This machine has 12 cores and a
   probe is ~1 core. Last time long stretches ran 1-2 concurrent while waiting
   on a gate. Launch the next candidate BEFORE reading the previous verdict.
2. **NEVER LET THE BACKGROUND GO IDLE.** Phase A below is a multi-hour training
   job on purpose — it is the floor under the whole session. If it dies, restart
   it, then continue the classical stream.
3. **CHECK `date`, DO NOT ESTIMATE ELAPSED TIME.** Last session's own narration
   was off by four hours because probes finished faster than assumed. Log the
   real clock at each phase boundary.

**When a candidate is rejected, that is a result, not a stopping point.** Nine
of the eleven probes last session were rejections and several were worth more
than the wins. Write the mechanism down and launch the next one. Do not wind
down early, do not "prepare a handoff" until the eighth hour, and do not ask
for permission mid-push — the owner is asleep. If the entire queue below is
exhausted, generate new candidates from the attribution bins and keep going.

## STATE AT HANDOFF (all verified on HEAD `3c2cbbc`)

**Anchors — byte-check before any A/B (see `_transit_probe.js` usage):**
- arctic 16-seed = `fleet_leg2_cad2x16.json` — 426 med / 459 mean / min 219 /
  in-time 71 / fins 142 / rounders 144/144
- bay 20-seed = `bay_bench_baycutlead.json` — 260 med / 263.8 mean / min 214,
  180/180 finishers, pens 0.62, OCS 5.6%
- transit probe = `transit_attrib_cad2.json` — transit **179 med, ratio 1.54,
  EXCESS 9601, dev 42°**; return 148 med, ratio 1.68
- seatrials 100t = 202.64 / 199.05 pen 0.31 OCS 16.9% min 175.0
- goldens 18/20 PASS. **redrock/90210 and /90211 are deliberately RED** — the
  venue is unraceable and re-recording would bake a broken course into the
  reference. Do not re-record them. Do not "fix" them.
- trees A/C/D are at HEAD; **treeB is TRACKED IN GIT and holds the PRE-cadence
  build** — leave it, it is the before/after reference.

**REDROCK IS OUT OF SCOPE THIS PUSH.** Three of its four rounding marks are
planted in rock (diagnosis + `_redrock_marks.js` above). The gauntlet bench is
wired and waiting. Do not baseline it, do not tune against it, do not try to
fix the venue — that is the owner's authoring call.

**Known-failing tests, ALL pre-existing, none yours:** `test_sailable` (7 —
bay 4-of-7 legs, redrock 1-of-6), `test_editor` (10), `test_results` (3),
`test_persistence` (UI timeout). Do not sink time here; the suite is otherwise
green and is a usable gate.

## THE THREE CLOSED LISTS — do not reopen

1. **Traffic/avoidance re-pricing: TWELVE rejections.** Re-pricing, commitment
   (×4), reciprocity, additive CPA gradient. Mechanisms documented above.
2. **Transit ROUTING: retired by measurement.** `_route_attrib` says the plan is
   0.78× the ruler remaining and the boat sits 126u off its own plan while the
   odometer is 1.54×. The route is not the problem. `hgrade` confirmed it.
3. **Ice HORIZONS: every knee verified on BOTH sides** — opening-lead 8s,
   route-thread 12s, rollout 9s, rival lookahead 4s. The cadence was the only
   one that was wrong.

⚠️ **A rejected MECHANISM stays rejected. A tuned CONSTANT may be re-swept** if
the world it was tuned in has changed — that distinction is what the horizon
sweep tested, and every horizon held, which is evidence the constants are
robust. Weigh that before spending time on sweeps.

## PHASE A (start FIRST, runs for hours in the background) — DRIVER-LEVEL RESIDUAL ES

The approved escalation, never started, and now the largest remaining headroom.
Full recipe in memory `regatta-avoidance-research.md`; the ground under it
improved overnight — the classical driver is 88s/race faster, avoidance is
active in 45% of transit frames rather than 51%, and **the observation is no
longer poisoned by a stale map**, which is what a residual policy sees.

Build (reuse `rl_shared.js` / `rl_train_cem.js` scaffolding — they exist for the
SWEEP phase; this is the transit analogue):
- **Hook**: `window.__rlT`-gated, inert otherwise, applied to the classical
  desired heading BEFORE `applyAvoidance`. Bounded zero-init residual
  Δψ ∈ ±25° via tanh, 2Hz with a slew limit. Worst case ≈ the classical floor,
  which is what protects the gate.
- **Obs** ~45-55 dims egocentric: own/plan ~10 (incl. avoid-mode flag + class),
  floes as a 16-sector radial ring ×2ch (edge distance, closing rate), 3-4
  nearest rivals with ROW flag, 2-3 route lookahead points (Sophy: lookahead
  beats rangefinder-only).
- **Policy** MLP 2×32 tanh, final layer zero-init. **Trainer** sep-CMA-ES or CEM.
- **Fitness** CRN-paired against a frozen-classical twin on the same seed:
  1.0·progress + 0.5·symmetric windowed passing (−20/+40u) − 4·any-contact
  − 5·at-fault − small floe-grind term. **LEXICOGRAPHIC foul gate.**
- **Seed protocol — this is what failed before, it was PROTOCOL not policy
  class**: pool ≥200 seeds, RESAMPLE 16-24 per generation (fixed CRN within a
  generation, rotate across), held-out ~32-seed validation every ~5 gens,
  checkpoint by VALIDATION, final acceptance on a DISJOINT 16-seed fleet gate.
- Cut first if short on time: the BC prior. Cut second: the passing term.
- Budget truth: ~10k evals per 8h at 8 seeds/candidate. **Expect single-digit
  percent, not a miracle.** Report honestly if it does not beat the classical
  floor — that is a publishable result given twelve classical rejections.

## PHASE B (the headline CLASSICAL candidate) — ICE COMMITMENT

`look150`/`split_s150` proved a sized trade: shortening the static ice probe
buys ~1000u of excess (ratio 1.54→1.39, avoidance 4204→3298, deflection 41°)
and pays every unit of it back in grind (4.5→7.2) and slow time (17.2→25.8).
Anything that holds the straighter line WITHOUT the extra contact banks it.

**The idea, and why it is not on the closed list:** commitment was rejected FOUR
times — but every one of those was commitment against RIVALS, and the
documented failure mechanism is reciprocity ("commitment kills dances only when
paired with the other boat's predictable response; alone, in a moving pack, it
is a tax"). **Ice does not react back.** A floe has no opinion about which side
you pass it, so the mutual re-reaction that killed boat-commitment cannot
occur. Commitment against ICE is a different mechanism wearing a similar name.

Shape: see the gap early (keep the 4s probe), CHOOSE a side once with a
DCPA/TCPA-style entry gate, lock it for a minimum hold, and re-run only the
magnitude within the committed side — never the side. Score the choice on
predicted clearance at the CURRENT prediction horizon, not per-tick.
Gate: 8-seed transit probe, EXCESS must fall ≥400u with grind median NOT above
4.5 and pens/OCS flat; then the 16-seed arctic fleet gate.

## PHASE C (parallel stream) — BAY BOAT-RUB VEIN

Bay boat contacts are **2.32/race against a human 0.14** — a 16× gap and the
largest untouched number on that venue; the bay median (260) is already inside
sight of the human 226. Attribution FIRST (mirror `_transit_probe`'s method):
which leg, which phase, rounding vs open water, overtaking vs converging,
and what the rules engine says the ROW was. Then design against what it shows.
Gate: `_bay_hairpin_probe` class check + bay 20-seed vs `bay_bench_baycutlead`.

## PHASE D (cheap parallel filler, run whenever a core is free)

- **Constants tuned against the broken map**, one probe each, one mechanism per
  tree: planner floe `MARGIN 36`, `_floeRisk` +0.55, soft multipliers 2.5/6.
  ⚠️ The horizon sweep found every knee held, so expect these to hold too —
  they are filler, not a thesis. Do not spend the session here.
- **Measure, DO NOT LAND, the two remaining `state.time`-as-seconds bugs**:
  `foulCooldowns[id] = state.time + 20` (really **83s**) and rules.js
  `now - data.rowChangeTime < 2.0` (really **8.3s**). Both RAISE penalty counts
  when fixed, so they fail the lexicographic gate by construction and are
  rules-correctness calls the owner must make. Produce the numbers and write
  them up; landing them is explicitly NOT authorised.
- **Re-record bay's goldens?** No. Nothing should change them this push unless a
  bay mechanism lands, in which case re-record as normal.

## PHASE E (ONLY if everything above is exhausted or blocked)

The twelve traffic rejections were all measured against the BROKEN map, and the
deflection they were chasing moved 47°→42° when it was fixed. The owner has NOT
authorised re-testing them and the default is that the list stays closed. If —
and only if — the primary queue is genuinely exhausted, re-probe at most THREE
whose stated failure mechanism was explicitly about stale or phantom geometry,
label them clearly as re-tests, and **report rather than land** anything that
flips. Escalate to the owner instead of accepting.

## GROUND RULES (unchanged, non-negotiable)

- Probe-gate at 8 seeds before any 16/20-seed bench. Judge AI changes at 20
  seeds, never 2-6.
- A/B in the treeA-D snapshots, **one mechanism per tree**. Never bundle.
- **Lexicographic acceptance**: penalties / OCS / DNF must not rise before pace
  counts. If penalties move, check whether it is noise (per-seed spread) and say
  so with the numbers either way.
- Byte-check reproduction before every A/B. Re-verify all anchors if a merge
  appears (the 11a8f4b rule — and note `930bb36` was verified AI-neutral).
- Goldens re-record ONLY with an accepted behaviour change, and only the venues
  that should have moved.
- Commit accepted work as you go, small commits, one mechanism each. **Push
  waits for the owner.**
- Append dated results to this doc as verdicts land — rejections WITH their
  mechanism, not just the verdict.

## HARNESS QUICKSTART — exact commands, and the traps that cost time

**Run everything from `regatta/eval/rl/` unless stated.** ⚠️ The Bash tool's
working directory PERSISTS between calls: a `cd` in one command silently
changes where the next one runs. Last session that caused a test to be run from
`treeB`'s copy and a "failure" to be misattributed for ten minutes. `cd` to an
absolute path in the same command whenever it matters.

⚠️ **THE ARGUMENT ORDER IS NOT CONSISTENT BETWEEN SCRIPTS.** Getting it wrong
silently benchmarks the wrong tree — the worst possible failure, because it
looks like a result:

    _transit_probe.js     <trials> <seed0> <TREE> <LABEL>      # tree, then label
    _bay_hairpin_probe.js <trials> <seed0> <TREE> <LABEL>      # tree, then label
    _route_attrib.js      <trials> <seed0> <TREE> <LABEL>      # tree, then label
    fleet_leg2.js         <trials> <seed0> <LABEL> <TREE>      # LABEL, then tree
    bay_bench.js          <trials> <seed0> <LABEL> <TREE>      # LABEL, then tree
    gauntlet_bench.js     <trials> <seed0> <LABEL> <TREE>      # LABEL, then tree

**The gates:**

    # 8-seed transit probe (arctic) — the cheap gate, ~8 min solo
    node _transit_probe.js 8 9100 treeC mylabel
    cmp transit_attrib_mylabel.json transit_attrib_cad2.json   # byte-check a no-op

    # 16-seed arctic fleet gate — THE acceptance gate, ~40 min
    node fleet_leg2.js 16 9100 mylabel treeC
    node _fleet_pair.js mylabel cad2x16        # positive delta = experiment faster

    # 20-seed bay gate, ~30 min
    node bay_bench.js 20 9100 mylabel treeA
    node bay_report.js mylabel baycutlead
    # ⚠️ bay_report's header says "negative = A faster". It is WRONG — the code
    # computes baseline − experiment, so POSITIVE means the experiment is faster.

    # bay rounding-class probe, ~10 min
    node _bay_hairpin_probe.js 8 9100 treeA mylabel

    # seatrials anchor — MUST run with cwd = the tree root
    cd treeA && node regatta/eval/run_eval.js 100 100

    # capped arctic (DNS/DNF row per snapshot)
    node arctic_eval.js mylabel 16 9100 treeA --json arctic_eval_mylabel.json

    # goldens, from the REPO ROOT
    npm run trace                                  # verify
    node regatta/eval/run_traces.js --update       # re-record (accepted change only)

**Diagnostics already built (reuse before writing new ones):**
`_route_attrib` (is the plan long, or is the boat off it), `_defl_hist`
(deflection distribution across the candidate fan), `_drift_pred` (how
predictable the ice is), `_map_validity` (cell flip + plan churn vs horizon),
`_grid_stamp_check` (stampFloes ≡ buildGrid, cell for cell), `_grid_cost`,
`_redrock_marks` (per-mark rounding clearance, works on any venue),
`_transit_probe2` (avoid-none sub-attribution), `_floe_spin_probe`.

**Costs, measured:** 8-seed transit probe ~8 min alone, ~15-20 min with three
concurrent. 16-seed fleet gate ~40 min. 20-seed bay ~30 min. 100-trial
seatrials ~25 min. Budget accordingly and run them CONCURRENTLY — that is the
whole point of the four trees.

**Housekeeping:** `pkill -9 -f chrome-headless` between long runs to clear
orphans, but NEVER while a bench is running. `rsync -a --delete <repo>/regatta/js/
treeX/regatta/js/` to sync a tree to HEAD. treeA/C/D are gitignored scratch;
**treeB is tracked and holds the pre-cadence build — do not touch it.**

## REPORTING RHYTHM

Post a progress update roughly hourly: what landed, what was rejected and WHY
(the mechanism, not just the verdict), and what is in flight. Append the same to
this doc as verdicts land, so the record survives the session. State elapsed
time from `date`, not from estimate. If something is still running when the
owner returns, say so plainly rather than guessing at its result.
