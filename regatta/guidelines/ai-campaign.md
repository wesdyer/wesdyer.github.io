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

---

# 2026-08-04b — THE 8-HOUR PUSH (session log, appended as verdicts land)

Started 09:42 PDT on HEAD `7087af9`. Anchors byte-checked before any A/B:
`_transit_probe.js 8 9100 treeA repro` reproduced `transit_attrib_cad2.json`
**byte for byte** (179 med, ratio 1.54, EXCESS 9601, dev 42°), so the harness,
treeA and the stored baseline all agree on this machine.

Trees: A/C/D were re-synced to HEAD (C and D still held the split-horizon
experiment). **treeE, treeF, treeG added** as APFS clones (instant, copy-on-
write) and gitignored — six scratch trees is what "keep four probes in flight"
actually costs. treeB untouched, as instructed.

## PHASE D (filler, run first because it needed no new code) — 3 REJECTIONS

All three constants were tuned against the 16.7s-stale map, all three were
re-swept on the fresh one, and all three HELD. 8-seed transit probe vs the
`cad2` baseline (179 med / ratio 1.54 / EXCESS 9601 / grind 4.5):

| probe | change | transit med | ratio | EXCESS | grind med | verdict |
|---|---|---|---|---|---|---|
| `pd_margin24` | planner floe `MARGIN` 36→24 | **209** | 1.74 | 10556 | 5.8 | REJECT |
| `pd_risk35` | `_floeRisk` grid tax 0.55→0.35 | **192** | 1.62 | 10236 | 6.1 | REJECT |

**Mechanism, and it is the same one twice: these constants are not detour
taxes, they are plan-quality terms.** Tightening the planner's floe pad does
not shorten the route — the router threads closer to drifting ice, the boat
meets it, and the REACTIVE layer pays: avoid excess 4204→4766 and grind
4.5→5.8. Discounting the grid's drifting-ice tax does the same thing one layer
up, routing the thread through churn (avoid 4204→4597, grind 4.5→6.1). Both
buy their "saving" in planner units and pay it back with interest in driver
units. The knee the margin round found at 36 is still the knee on a correct
map.

| `pd_soft18` | grid soft-cell weights 2.5/6 → 1.8/4.2 | **184** | 1.62 | 10476 | 4.8 | REJECT |

Same mechanism a third time, one layer up again: cheapening plugged-ice cells
routes the thread THROUGH churn and the avoid bin pays for it (4204→4910).
**Phase D's constants are closed: 3 probed, 3 held.** The queue predicted this
("expect these to hold") and it was right; the useful part is that the reason
is uniform — every one of these constants buys route-level SEPARATION, and the
excess they look like they are causing is charged in a different currency
(planner/grid units) from the one they are actually paying (driver units).

## PHASE B — ICE COMMITMENT: v1 REJECTED, AND THE MECHANISM IS NOT RECIPROCITY

The queue's argument for re-opening commitment against ice was sound as far as
it went — a floe does not re-react, so the reciprocity failure that killed the
four rival-commitment probes cannot apply. It is still wrong, for a reason the
rival experiments could not have exposed.

`icecommit1` (treeC — commitment inside `applyAvoidance`: per-side cheapest
candidate, entry gate on the undeflected line carrying floe cost, 3s min hold,
8s hard cap, contact-scale escape hatch):

    transit med  179 → 226        ratio 1.54 → 1.73      EXCESS 9601 → 12146
    grind med    4.5 → 11.3       dev 42° → 47°          avoid 4204 → 5645

**Mechanism: the failure is IDENTITY, not reciprocity.** A committed side is
only meaningful relative to ONE obstacle. Ice is not an obstacle, it is a
FIELD — the thing blocking the boat changes every couple of seconds as the pack
drifts and the boat moves through it. A lock keyed on nothing but a sign
therefore decays into a plain heading bias, and it holds that bias into
whatever has drifted into the committed side since. Grind time is the tell: it
went from 4.5s to 11.3s, which is the boat sailing into ice it had already
decided to pass on that side. Deflection went UP, not down (42°→47°), so it did
not even buy the straighter line the trade was supposed to fund.

Follow-ups launched immediately rather than stopping on the verdict:
`icecommit2` (treeH) moves the episode to `planFloeTrajectory`, which is where
ice decisions are actually made — `applyAvoidance` SKIPS floes entirely on any
tick the trajectory planner steered (`if (isl.isFloe && this._trajFloe)
continue`), so v1 was partly committing in a layer that cannot see the ice.
`icecommit3` (treeJ) keys the episode on the BLOCKING FLOE ITSELF: the lock is
(floe, side), the magnitude-only search runs while that same floe is the one
the undeflected 9s rollout hits, and the episode ends the moment a different
floe becomes the blocker. If identity is the flaw, v3 is the version that
tests the queue's actual hypothesis.

### v2 and v3 REJECTED TOO — and the three verdicts together retire "reciprocity"

    baseline (cad2)          transit 179   ratio 1.54   EXCESS  9601   grind 4.5   dev 42°
    icecommit1 applyAvoid    transit 226   ratio 1.73   EXCESS 12146   grind 11.3  dev 47°
    icecommit2 planner side  transit 217   ratio 1.78   EXCESS 12756   grind 10.2  dev 44°
    icecommit3 floe identity transit 222   ratio 1.81   EXCESS 12639   grind  8.2  dev 44°

Three implementations, three layers, three scopings of the episode — and all
three land in the same place, about +40s of transit and +3000u of excess.
Keying the episode on the blocking FLOE (v3), which was the fix the v1 diagnosis
implied, bought nothing.

**⚡ THE MECHANISM, AND IT UNIFIES SEVEN REJECTIONS: commitment is a bet that
the scene persists, and in this venue the scene does not persist.** The four
rival-commitment rejections were explained by RECIPROCITY (the other boat
re-reacts, so your lock is a tax). That explanation is now incomplete at best:
ice does not re-react and commitment fails against ice just as hard. What both
families actually share is a DRIFTING WORLD. Against a moving pack, per-tick
re-decision is not a "dance" to be cured — it is ADAPTATION, and every hold,
however carefully scoped, is a wager on a stale scene. Grind time is the
receipt: 4.5s → 8.2-11.3s across all three, i.e. the committed boat sailing
into ice that arrived after the decision was made.

Consequences for the campaign:
- **The commitment family is closed at SEVEN lifetime rejections** (4 rival, 3
  ice). Do not re-open it for a different obstacle class; the failure is not
  about what you commit against.
- Of the four structural candidates in `regatta-avoidance-research.md`, #1
  (commitment) is now dead, and #3 (anticipatory rollout) is what
  `planFloeTrajectory` ALREADY is. That leaves ORCA-style objective REPLACEMENT
  and driver-level learning — which is the session's Phase A.

### The dose-response control — the HOLD is the cost, and one second is already too long

Before accepting three rejections it is worth knowing whether the loss came from
the mechanism or from my restriction plumbing. Same tree as v3, hard cap
8.0s → **1.0s**:

    hold  0s (baseline)   transit 179   EXCESS  9601   grind 4.5
    hold  1s              transit 204   EXCESS 11213   grind 8.0
    hold  8s              transit 222   EXCESS 12639   grind 8.2

Monotone in hold duration, and **a ONE-SECOND commitment already costs +25s of
transit**. The plumbing is not the problem; holding is. It also puts a number on
how fast this world goes stale, and that number is consistent with the map
cadence knee (2s good, 4s worse): **the scene a decision was made in survives
about a second.**

## PHASE C — BAY BOAT RUBS: THE ATTRIBUTION FOUND A RULES TRAP, AND IT PAID

`_bay_rub_probe.js` (new, committed): per contact episode, 0.5s dedup per PAIR,
recording leg, phase, mark distance and zone membership, encounter geometry,
speeds, and the rules engine's OWN standing verdict — read from
`Rules.interactions[key].rowOwner`, never by calling `evaluate()`, which writes
`rowOwner`/`rowChangeTime` and would perturb the race it is measuring.

8 seeds, 72 boat-races, 77 rub episodes (1.07/boat-race by pair; the bench's
2.32 counts both boats):

    leg:       L4 32% | L1 31% | L0 (pre-line) 27% | rest 10%
    geometry:  crossing 52% | head-on 22% | overtaken 14% | overtaking 9%
    in zone:   0% (100% of rubs happen OUTSIDE any mark zone — not a mark-room
               problem, which is where I would have looked first)
    own speed <1.0: 62%
    EITHER BOAT MID-PENALTY: 61%

The last line is confounded on its own — a penalty is awarded AT a contact — so
the probe was extended with `penaltyFlagTime` and the live `penaltySpin` flag:

    penalty PREDATES the rub (>2s outstanding): 57%   (median 7.9s, p75 12.3s, max 36.5s)
    a boat was mid-360 SPIRAL at the rub:        9%
    BOTH boats flagged:                         13 of 77
    flagged rubs cluster on L4/L1; UNFLAGGED rubs cluster on L0 (the start)

**The mechanism: a flagged boat is give-way to EVERYONE (Rule 21) and respected
by no one, and it was carrying that flag for a median 8 and up to 36 seconds.**
It is not the 360 that is dangerous — only 9% of rubs happen during one. It is
the WAIT. And the wait was structural: the gate to start the turn requires
`!markNear && !iceNear && (clear || deadline) && risk not HIGH/IMMINENT`, and a
boat in traffic is essentially always at HIGH, so the 12s deadline never fired.

### The candidate, its knee, and the venue split

Two ingredients, each isolated on the bay 8-seed bench (baseline `base8`:
rubs 2.11, pens 0.64):

| variant | boat rubs | land | pens | paired pace |
|---|---|---|---|---|
| deadline 12→6s ALONE | 1.74 | 0.33 | 0.65 | −0.6s |
| sea-room guard ALONE (clearance ≥5, field built if absent) | 2.10 | 0.19 | 0.68 | −1.8s |
| **both** (`penroom`) | **1.46** | 0.39 | **0.60** | **+1.2s** |

Neither ingredient works alone and the guard alone is actively bad — it just
extends the wait. Together they are a real interaction: shortening the deadline
creates turn opportunities, and the guard makes sure the turns happen in water
that can hold them. Knee swept on both sides of both parameters:

    d4/c5  rubs 1.71  land 0.51  pens 0.67  pace −1.4      (too eager)
    d6/c5  rubs 1.46  land 0.39  pens 0.60  pace +1.2      ← knee
    d8/c5  rubs 1.90  land 0.19  pens 0.61  pace +0.2      (gives half the win back)
    d6/c7  rubs 1.46  land 0.36  pens 0.64  pace −0.9      (guard too strict)

**Bay 20-seed gate vs `baycutlead`: rubs 2.32 → 1.94 (−16%), pens 0.62 → 0.57,
OCS flat 5.6%, 180/180 finishers, fin med 260 → 259, paired mean +1.7s
(median 0).** 13 of 20 seeds are BYTE-IDENTICAL — it fires only where a penalty
is actually carried into traffic — and of the 7 that move, 6 are faster and
penalties never rise on any seed. Seatrials anchor 202.83/199.79 pen 0.31 OCS
16.89 (stored 202.64/199.05/0.31/16.9): pens and OCS flat, pace +0.19 mean /
+0.74 median. Not byte-exact, and it should not be — this is a venue-agnostic
change to penalty timing and Clubhouse takes 0.31 penalties a race.

**⚠️ THEN THE ARCTIC FLEET GATE REJECTED IT.** 16 seeds vs `cad2x16`:

    rounders 144 → 141   finishers 142 → 140   med 426 → 446   IN-TIME 71 → 57
    paired med −8 / mean −11.7 (negative = experiment slower)

**Mechanism: the sea-room ask is a different quantity in a floe field.** On bay
"clearance ≥5 cells" is common water; in Glacier Sound the grid is stamped with
112 floes and that clearance is scarce, so a stricter guard does not schedule
better turns, it TRAPS THE FLAG — which is the exact pathology the change was
built to remove. The bay-only measurement could not see this because bay has no
floes at all.

Follow-up in flight: `penbound` (treeO) bounds the wait from BOTH ends — ask for
clearance ≥5 early, relax to ≥2 past 15 seconds, so the flag can never be
carried indefinitely no matter how tight the water is. On bay it reproduces the
full win (rubs 1.46, pens 0.60, pace +1.2); the arctic screen is running, along
with 8-seed arctic isolations of each ingredient.

## THE ARCTIC PLANNER CONSTANTS — a fourth knee, verified on both sides

`glance1/2/3` and `trajgate6/trajmarg10/trajcw7500` probed the one lead the
queue named as genuinely open ("contact discipline: arriving at ice with speed
and a plan", ~1000u):

| probe | change | transit | ratio | grind | dev |
|---|---|---|---|---|---|
| baseline | — | 179 | 1.54 | 4.5 | 42° |
| `glance1` | contact cost × incidence, all candidates | 203 | 1.69 | 8.4 | 45° |
| `glance2` | planner `contactW` 5200→3000 | 217 | 1.68 | 12.2 | 45° |
| `glance3` | incidence discount on hold-the-line only | 203 | 1.67 | 9.4 | 43° |
| `trajcw7500` | planner `contactW` 5200→**7500** | 193 | 1.66 | 5.9 | 43° |
| `trajgate6` | planner entry gate 4.5s→6.0s | 193 | 1.52 | 6.5 | 42° |
| `trajmarg10` | planner deviation margin 50→10 | **177** | **1.51** | 4.6 | 42° |

`glance1` failed for a legible reason worth keeping: discounting every
candidate's graze made "deflect AND graze" the cheapest option, so deflection
went UP. But the corrected forms failed too, and `contactW` is now a knee
verified on BOTH sides (3000 much worse, 7500 worse). Only the deviation margin
moves freely, and it buys ~2s of median — inside noise on 72 boat-races.
**`planFloeTrajectory` is at a local optimum in all three of its constants.**
Together with the twelve traffic re-pricings, the transit routing retirement and
the ice horizons, the classical arctic transit levers are now exhausted at every
layer that has been found.

## PHASE D, part 2 — THE TWO REMAINING `state.time` BUGS, MEASURED (NOT LANDED)

Both are real units bugs. **Both are also provably inert to racing behaviour**,
which was not the expectation going in (the queue predicted they would RAISE
penalty counts and fail the lexicographic gate by construction). They do not,
and the reason is different for each.

**1. `foulCooldowns[id] = state.time + 20` — an 83-second per-pair cooldown, not
20.** It gates only the NO-CONTACT foul (RRS "keep clear" with no touch), and
that path barely fires. `_pen_kind_probe.js` (new, committed), 8 seeds each:

    bay:    3 no-contact fouls in 72 boat-races (0.04/race); same-pair repeats
            within 20s: 0, within 83s: 0
    arctic: 18 in 72 boat-races (0.25/race);  repeats within 20s: 0, within 83s: 0

The cooldown can only matter when the SAME claimant re-fouls the SAME victim
inside the window, and that never happens in 144 boat-races across two venues.
Empirical confirmation: a bay 8-seed bench on the fixed tree is **byte-identical**
to baseline. Fixing the units is free and changes nothing.

**2. rules.js `now - data.rowChangeTime < 2.0` — an 8.3-second Rule 15 grace,
not 2.** Its only effect is `result.constraints.push("Rule 15")`, and
`constraints` has exactly ONE consumer in the codebase: `getDebugInfo()`, which
feeds the debug overlay. No AI path, no scoring path, no penalty path reads it.
This is a DISPLAY-duration bug. Bay 8-seed bench on the fixed tree: **byte-
identical** to baseline.

**Recommendation to the owner: both are safe to land as pure correctness fixes.**
Neither moves a single race. Landing them costs nothing and removes two live
instances of the `state.time`-as-seconds class before something else starts
depending on the wrong number. Still not landed here, per instruction.

### LANDED (commit `3454852`) — and then four more Phase C candidates rejected

`penscoped` is the landed form: deadline 6s + sea-room ≥5, **scoped to floe-free
water** via `state.course._floeObjs`. Bay keeps the full win (byte-identical to
the unscoped `penroom20`); the arctic 8-seed fleet is **byte-identical to
baseline**, so no regression is possible by construction. Goldens re-recorded for
the nine floe-free venues that legitimately moved; arctic untouched; redrock's
two left deliberately red.

⚠️ **A trap worth writing down: `run_traces.js --update --venue X` REWRITES the
whole golden file with only that venue's traces.** Updating seven venues one at
a time left a file with 2 entries and 18 "new". Recovery is `git checkout` the
golden, run a FULL `--update`, then splice redrock's entry back from the HEAD
copy. There is no merge mode.

Then the remaining bins were attacked, and all four attempts failed:

**`r21undamped` / `r21shape` / `r21bubble` — Rule 21 keep-clear, harder.** Half
the surviving rubs still involve a carried penalty, and the classical layer has
a real hole there: jam damping (#40) scales the RRS shaping by speed, and a
flagged boat is usually slow (62% of rubs under 1.0), so exactly when Rule 21
binds hardest the shaping is switched off. Three forms: undamp her keep-clear
shaping, hold her give-way bubble at 120u through recovery liveness, or both.
On the 8-seed bench the isolated halves looked like wins (bubble: rubs
1.46→1.32, pens 0.60→0.54, +0.9s). **At 20 seeds it reversed completely: rubs
1.94→2.41, pens 0.57→0.65, paired mean −3.9s, and the arctic screen lost 7
in-time finishes.** Mechanism: this is the `cpagrad` failure again — the
obligation is fleetwide but the response is per-threat, so honouring it harder
does not remove the contact, it RELOCATES it into a third boat, and charges rent
against every rival on the way. ⚠️ Method note: an 8-seed bay bench is a SCREEN,
not a verdict, for contact metrics — this one inverted at 20.

**`startdepth` — crossing-run timing from actual depth.** `_bay_start_probe.js`
(new) found something clean: boats that cross >12s after the gun sit ~75u deeper
than the on-time group at EVERY sample from −6s, at equal or higher speed, in
`normal` mode with no rival inside 95u. Not jammed, not stopped, not in irons —
just too far back. And the cause was visible in one line: `tCross` is computed
from the NOMINAL staging depth (`STAGE`), never from the boat's actual `behind`,
so a deep boat commits at the same countdown as a perfectly-placed one and
crosses late by exactly its extra depth. Fixing it made things worse:
**boat rubs 1.46 → 3.17** and the mean crossing time got WORSE (7.4 → 8.2s).
**Mechanism: the staggered arrival is not a bug, it is a queue.** Synchronising
the fleet onto the line puts ten boats into adjacent lanes at the same instant,
and the traffic costs more than the late arrival did. The nominal-depth timing is
load-bearing for the same reason the lane layout is.

## ⚡ THE BAY GAP IS DISTANCE, NOT SPEED — measured against the banked human

`_bay_pace_probe.js` (new, committed) puts the bots and the recorded human on
the same footing: per leg, odometer, DMC leg length, ratio, and mean speed.

    leg   len     BOT dur  odo  ratio  spd   |  HUMAN dur  odo  ratio  spd   | decomposition
    L1   2943      46.7  4470  1.52   95.7  |     43.3  4148  1.41   95.8  | +3.4s = 3.4 dist + 0.0 speed
    L2   3088      27.7  3424  1.11  123.7  |     27.4  3078  1.00  112.4  | +0.3s = 3.1 dist − 2.8 speed
    L3   4295      45.0  5940  1.38  131.9  |     38.6  4290  1.00  111.1  | +6.4s = 14.8 dist − 8.4 speed
    L4   4456      55.4  5834  1.31  105.3  |     53.9  5578  1.25  103.6  | +1.6s = 2.5 dist − 0.9 speed
    L5   4125      43.3  5377  1.30  124.1  |     39.6  4348  1.05  109.9  | +3.8s = 9.4 dist − 5.6 speed

**The fleet is FASTER than the human on every leg and loses anyway, because it
sails 30-38% further on the downwind legs.** The human's L3 ratio is 1.00 — she
sails the ruler's own length — while the fleet sails 1.38 of it at 19% more
speed. That is the whole bay deficit, stated as a trade the fleet is losing:
+14.8s of distance bought with 8.4s of speed on L3 alone.

Split by position in the leg (`>3x zone from the mark` vs the approach):
L3 far 4890u / near 998u against a leg of 4295 — so roughly two thirds of the
excess is in the BODY of the leg (the gybing angles), one third in the approach.

### …and the angle family that causes it is now closed at SIX rejections

    (1) downwind fine-VMG scan (deeper polar optimum)   −8 med  (2026-08-03d)
    (2) static heat margin (entry +0.5kt)               bay +2 / seatrials −2.9
    (3) try-the-plane gate (6s try / 15s cooldown)      neutral
    (4) sustained-plane gate (3s continuous hold        bay 20-seed −2 med / −2.1 mean
        required, else 30s cooldown)                    pens 0.57→0.61
    (5) fetch-before-heat (heat only when the mark      bay 20-seed −4 med / −3.2 mean
        cannot be fetched at the deep optimum)          L3 +1 but L4 −2, L5 −1, L6 −1
    (6) arc-aware carrot lookahead (LOOKP 150/250       INERT — inside 2.5x zone the
        inside 2.5x zone)                               ruler carrot is not steering

(4) and (5) are this session's, and each was designed against the STATED failure
mechanism of its predecessor — (4) answers "the plane flickers just often enough
to reset the try timer" with a 3-second continuous-hold test; (5) answers the
geometry directly by refusing to throw away a fetchable mark. Both still lost,
and **both lost the same way: L3 improves by ~1s and L4/L5/L6 give back more.**

**⚡ The unifying mechanism: the hot angle is not a local mistake, it is an
equilibrium.** Every attempt to sail the geometrically-correct deeper line gains
on the leg where it is applied and loses more downstream — through arrival state
at the next rounding, and through being slower in traffic while it happens.
Six independent mechanisms, one wall. The "bots sail too hot" reading that the
angle-level bulge measurement suggested is TRUE as a description and FALSE as a
lever: the fleet is at a constrained optimum, and the constraint is the rest of
the course.

Also verified this session and now closed: bay `ENTRY_CUT_LEAD` is a knee on
both sides (0.35 → −8 med, 0.9 → −3 med, against 0.6).

## ⚡ THE FLEET-DENSITY MEASUREMENT — most of the bay "gap" is traffic, and it changes how bay should be benched

`_bay_pace_probe.js` gained a fleet-size argument (park all but N bots). Same
seeds, same course, same human reference:

    leg    9 boats            4 boats            2 boats           HUMAN (in a full fleet)
    L1     46.7s  r1.52       42.0s  r1.35       37.1s  r1.31      43.3s  r1.41
    L2     27.7s  r1.11       26.4s  r1.07       26.5s  r1.07      27.4s  r1.00
    L3     45.0s  r1.38       43.9s  r1.32       42.9s  r1.29      38.6s  r1.00
    L4     55.4s  r1.31       50.9s  r1.23       50.9s  r1.30      53.9s  r1.25
    L5     43.3s  r1.30       44.0s  r1.33       44.0s  r1.36      39.6s  r1.05
    total  243s               228s               221s              203s

**In clear air the fleet BEATS the human on L1, L2 and L4** (L1 by 6.2s) and
still loses ~4.4s on each of the two DOWNWIND legs. So the bay deficit splits
cleanly in two:

- **~15s is traffic-handling.** L1 alone swings 9.6s between 2 boats and 9, and
  the human — who raced in the same full fleet — gives up far less to it.
- **~9s is downwind geometry**, present at ANY density: ratio 1.29-1.36 against
  the human's 1.00-1.05 on L3/L5.

⚠️ **Method consequence, and it explains several of this session's null results:
a 20-seed bay bench at full density carries enough traffic variance to bury a
4-second effect.** Two of the six downwind rejections were measured only there.
Probe mechanism at 2-4 boats where the signal is clean, then verify at 9.

## THE PLANING HEAT GATE — a real effect, an owner-level trade, NOT landed

Following the density finding back to the heat gate, with the gate simply OFF:

    bay 20-seed (9100-9119) vs HEAD:  fin med 259->257, paired +3 med / +4.8 mean,
                                      pens 0.57->0.50, rubs 1.94->1.91, max 344->308
    bay 20-seed (9200-9219) DISJOINT: fin med 261->259, paired +3 med / +2.2 mean,
                                      pens 0.51->0.49
    arctic 8-seed screen:             med 398->394, in-time 43->44, paired +4/+12.9
    arctic 16-seed GATE:              med 426->440, IN-TIME 71->65, finishers 142->141,
                                      but paired +4 med / +6.5 mean per boat
    Clubhouse 100t (unscoped):        202.83->204.56 mean, PENALTIES 0.31->0.37

Scoped on `_gridFixed` (the same test every other navigation change uses) the
Clubhouse anchor is **byte-identical — 202.83 / 199.79 / pen 0.31 exactly** — and
bay keeps the whole win. The blocker is arctic: the per-boat paired median says
+4s FASTER while the fleet aggregates say 6 fewer in-time finishes and one fewer
finisher. That is the "trades tails for pace" signature, and by the standing
lexicographic rule a finisher drop is disqualifying.

Middle ground tested and rejected: heat angle **150° instead of 140°** (half the
geometric cost, most of the plane) is worse than BOTH endpoints — bay +1 med only,
arctic in-time 43->38, paired mean −24.6. The response is not monotone in the
heat angle.

**Left for the owner rather than landed.** A disjoint 16-seed arctic pair
(9200-9215) is running to establish whether the in-time drop is real or a
threshold artefact; if it is noise, this is a straightforward accept scoped to
`_gridFixed`, worth ~5s of bay median and 0.07 penalties per boat.

### ✅ LANDED (commit `47ef6be`) — and the fine-VMG re-test that followed it

The heat gate is now OFF on courses with authored land. Arctic's in-time metric
disagreed between the two 16-seed sets (71→65 on 9100-9115, **45→65** on
9200-9215), which is itself worth knowing: **in-time finishes are a threshold
statistic and they are noisy at 16 seeds on this venue.** Combined over 32 seeds
the picture is unambiguous — rounders 284→285, finishers 277→280, in-time
116→130, median 446→439 — and the paired per-boat median is positive on BOTH
sets separately (+4 and +14). Bay wins on two disjoint 20-seed sets (+3 median
paired each). The Clubhouse anchor is byte-identical by construction.

Bay profile after the change (9 boats): L3 45.0→42.2s (ratio 1.38→**1.24**),
L4 53.6s which now BEATS the human by 0.3s, L5 43.2s (ratio 1.30→1.26).

**Then the fine VMG scan was re-tested and the original rejection held.** The
polar's downwind gridpoints are 110/120/135/150/180, so the optimizer cannot
answer ~165 — and with the heat gate gone its answer is now what the boat
actually sails, which is a genuinely changed world for that mechanism. Scanning
2.5° between the gridpoints: **bay paired −3 med / −4.0 mean, arctic paired −8
med / −16.7 mean, in-time 44→38.** Same verdict, same stated mechanism as the
2026-08-03d original ("deeper = slower hull speed loses more in fleet traffic
than the polar gains"), now confirmed in the world where the answer binds. The
coarse gridpoint is not a bug being worked around; 150 is genuinely better than
165 in a fleet.

### Where fleet density actually spends its time (bay, 9 boats vs 2)

    L1   dirtyAir 0.013 vs 0.003 | avoidance active 29% vs 7% | board flips 3.0 vs 1.0
    L3   dirtyAir 0.007 vs 0.000 | avoidance active 28% vs 16% | flips 5.0 vs 3.0
    L4   dirtyAir 0.008 vs 0.000 | avoidance active 29% vs 13% | flips 4.0 vs 3.0

**Avoidance is active 29% of L1 time at full density against 7% in clear air,
and the fleet tacks twice more per beat.** Dirty air barely registers. So bay's
~15s traffic bin is an AVOIDANCE bin, not a wind-shadow bin — which puts it in
the same family as the twelve arctic traffic rejections rather than being new
ground, and is the honest reason not to spend more of this session on it.

## END-TO-END SESSION A/B — both landed changes vs `7087af9`, on seeds never used to tune them

`treeQ` holds the session-start AI (`git show 7087af9:regatta/js/script.js`).

    BAY, 20 seeds 9300-9319          start (7087af9)   end (47ef6be)
      fin median                          263               256
      fin mean                          264.5             256.5
      paired vs start                       —      +10 med / +8.1 mean
      boat contacts / race                2.79              2.00   (-28%)
      penalties / boat                    0.58              0.49   (-16%)
      OCS                                 6.1%              5.0%
      max                                  358               319
      finishers                        180/180           180/180

    ARCTIC, 16 seeds 9300-9315       start (7087af9)   end (47ef6be)
      fin median                           417               412
      fin mean                           440.6               429
      min                                  235               224
      in-time finishes                      74                76
      rounders / finishers             143 / 141         143 / 141
      paired vs start                        —      +1 med / +9.2 mean

    CLUBHOUSE 100t                   202.64/199.05     202.83/199.79
      penalties                           0.31              0.31
      OCS                                16.9%            16.89%
      DNS / DNF                          0 / 0             0 / 0

The Clubhouse anchor moved +0.19 mean / +0.74 median, entirely from the
penalty-turn commit, which is venue-agnostic by design (Clubhouse takes 0.31
penalties a race). Penalties, OCS, DNS and DNF are all flat there. **New stored
anchor: 202.83 / 199.79 / min 174.97 / pen 0.31 / OCS 16.89%.**

**Refreshed baselines for the next session:**
- bay 20-seed = `bay_bench_noheat.json` (9100-9119, fin med 257) and
  `bay_bench_sessionend_bay.json` (9300-9319, fin med 256)
- arctic 16-seed = `fleet_leg2_noheat16.json` + `fleet_leg2_noheat16b.json`
  (9100-9115 and 9200-9215; judge this venue on the 32-seed combination)
- arctic transit probe = `transit_attrib_transit_newhead.json` — **180 med,
  ratio 1.50, EXCESS 9182, dev 43°** (was 179 / 1.54 / 9601 / 42°)
- bay rub attribution = `bay_rub_rub_newhead.json` — 60 episodes (was 77);
  leg-0 37%, penalty-predates 43%, mid-spiral 18%

## THE SESSION LEDGER — 2 accepted, 24 rejected, every rejection with a mechanism

**Accepted**
1. `3454852` penalty turns sooner (deadline 12→6s + sea-room ≥5 cells), scoped
   to floe-free water.
2. `47ef6be` planing heat gate OFF on courses with authored land.

**Rejected — arctic / ice**
- ice commitment ×3 (applyAvoidance, planner side-lock, planner floe-identity)
  + the 1s dose-response control. **Family closed at seven lifetime.**
- glancing-contact pricing; the same discount applied only to hold-the-line
  candidates; planner `contactW` 3000 and 7500; planner entry gate 6.0s;
  planner deviation margin 50→10 (flat, buys ~2s = noise).
- Phase-D constants: planner floe `MARGIN` 24, `_floeRisk` 0.35, grid soft
  weights 1.8/4.2.

**Rejected — bay**
- Rule-21 keep-clear harder ×3 (undamped shaping / 120u bubble / both).
- crossing-run timing from actual depth; staging approach at full speed
  (OCS 5.6% → **29.4%** — the 0.75 speed is a brake that stops boats
  overshooting the line); post-gun lane hold.
- no-strategic-undo-after-an-avoidance-tack.
- downwind: sustained-plane gate, fetch-before-heat, heat angle 150°,
  conditioned heat (far-only / near-only), arc-aware carrot lookahead (inert),
  **fine VMG scan re-tested in the changed world — original verdict held.**
- constants at their knee both sides: entry cut-lead 0.35/0.9, start buffer
  0.35/0.65.

**Measured, not landed** — both remaining `state.time`-as-seconds bugs are
provably inert (see above). Both are safe correctness fixes.

**Known-failing tests, unchanged from session start:** `test_sailable` 7,
`test_editor` 10, `test_results` 3, `test_persistence` timeout, **and
`test_dmc` 2** — the last is not on the handoff's list but fails identically on
`7087af9`; it is redrock's path crossing rock (24/1727 segments), i.e. the same
unraceable-venue problem, not a regression.

## QUEUE FOR THE NEXT SESSION

The honest state: **the classical stack is at a local optimum in nearly every
direction tested.** Six constants were verified at their knee on both sides this
session, two whole mechanism families closed, and the one genuinely new win came
from REMOVING a mechanism rather than adding one. Candidate work, in order:

1. **The bay traffic bin (~15s), which is the largest measured and least
   attacked.** Avoidance is active 29% of L1 time at full density vs 7% in clear
   air, and the fleet tacks twice more per beat. It sits in the same family as
   the twelve arctic traffic rejections, so it needs the STRUCTURAL escalation
   (ORCA-style objective REPLACEMENT — additive terms are proven not to work,
   see `cpagrad`), not another price.
2. **Bay downwind, the remaining ~7s.** Ratios are now L3 1.24 / L5 1.26 against
   the human's 1.00 / 1.05. Six mechanisms have failed on the ANGLE. What has
   not been tried is the multi-leg framing the failures all point at: every one
   of them gained on its own leg and lost downstream, which says the angle is
   constrained by the next rounding, not by local VMG.
3. **The start (~5s/boat, and 37% of surviving bay rubs).** Two clean rejections
   here already, both because the fleet's staggered arrival is load-bearing.
   Anything tried here must keep the queue.
4. **Redrock**, when the owner has re-authored the marks — the gauntlet bench is
   wired and it is the only purpose-built traffic lab.

⚠️ Whatever is tried, benchmark it at the resolution the metric needs: bay
mechanism at 2-4 boats then verified at 9; bay contact metrics at 20 seeds, not
8; arctic in-time on 32 seeds or on the paired per-boat median.

## THE BAY BIN TABLE — `_bay_traffic_attrib.js` (new, committed)

The bay analogue of the arctic transit attribution: per boat-second, one owning
mode, excess distance = odometer − DMC progress. Run at both densities so the
traffic share is separated from the geometry share.

    9 BOATS   total excess 7241u/boat-race
      leg |    rec   turn  avoid  offrt   sail
      L1  |     26    197    793    593    285
      L3  |      0    319    454    270    234
      L4  |      0    281    513    304    349
      L5  |      0    261    601    249    232
      ALL |     36   1375   3059   1479   1292      weave 174u vs lateral 7067u

    2 BOATS   total excess 6298u/boat-race
      ALL |      0    851   1996   2002   1449      weave 123u vs lateral 6175u

**Avoidance is the largest single bin at BOTH densities — 3059u of 7241 (42%) —
and it is the bin that density inflates: +1063u going from 2 boats to 9, with
turn adding +524u and `offrt` actually FALLING.** L1 alone carries +636u of
avoidance excess between the two densities, which at ~95 u/s is most of that
leg's measured 9.6s density cost.

The proportion is almost identical to arctic transit (avoid 4100 of 9182 = 45%),
which is worth noticing: **two very different venues, two independent
attributions, and the same 42-45% of excess distance owned by the avoidance
layer.** That is the campaign's largest single quantity and it now has twelve
re-pricing rejections and seven commitment rejections against it. It is not a
tuning problem, and the next attempt on it should be the structural one
(objective REPLACEMENT), not another term.

Also note `form: weave 174u vs lateral 7067u` — as on arctic, the excess is
LATERAL displacement, not curvature. The boats are not wiggling; they are going
somewhere else.

## PHASE A — DRIVER-LEVEL RESIDUAL ES: BUILT, GATED, AND NEGATIVE

Infrastructure committed (`f0e290e`): `rlt_shared.js` (observation, bounded
residual, episode), `rlt_train.js` (mirrored ES), `rlt_inert.js` (the floor
proof), `rlt_gate.js` (fleet_leg2's exact protocol with the policy installed).
**The script.js seam is deliberately NOT committed** — the approach was
rejected, and the one block needed to re-enable it is in that commit message.

    held-out validation, 16 seeds disjoint from the 200-seed training pool:
      gen 4  -8.8s (6/16 wins)      gen 14  -8.1s (6/16)     gen 24 -10.5s (8/16)
      gen 9 -21.1s (4/16)           gen 19 -12.3s (5/16)

    FINAL GATE, 16 seeds disjoint from training AND validation:
      rounders 144->142  finishers 142->140  med 426->451  in-time 71->52
      paired -17 med / -19.9 mean

**The floor held throughout, and that is the part worth keeping.** With zero
parameters the residual is exactly 0 and the race is BYTE-IDENTICAL to
classical; the classical reference run through the gate reproduces the stored
`cad2x16` numbers exactly (144/142/71/426). So the negative result is a
statement about the POLICY, not about a leaky harness.

**Two rebuilds were needed and both are reusable lessons.** (1) CEM walked the
mean 41s below the classical floor in two generations — with 45 parameters and a
fleet-level score, elite selection is mostly selecting noise, and an elite MEAN
inherits every mistake. Mirrored ES with antithetic pairs cancels that noise in
the difference. (2) 44 observation dimensions starved at ~1 evaluation per
parameter per generation, and the log said so: for three straight generations
**the best of twelve perturbations WAS the unperturbed mean.** Twelve signed
dimensions was the workable size.

Three implementation facts that would matter to any retry: centre the
observation (always-positive features turn any random weight into a constant
lean), FREEZE the bias at zero (a constant lean is the easiest direction for a
perturbation to find and it is catastrophic — the bias-only control costs
202->333), and gate the residual to contested frames.

**Honest reading:** a bounded residual has large destructive power and small
constructive power against a stack this well tuned, and the budget arithmetic is
the binding constraint — episodes cost ~20s of wall clock, so ~25 generations is
what eight hours buys at a useful seed count. Any retry should fix the episode
cost first, or drop to a handful of parameters.

## REFRESHED ARCTIC DIAGNOSTICS ON THE FINAL HEAD (for the next session)

`_transit_probe2.js` (avoid-none sub-attribution) and `_defl_hist.js`, 8 seeds:

    TRANSIT  med 180  ratio 1.50  EXCESS 9182 = rec 448 | turn 1331 | avoid 4100
                                                | offrt 2500 | sail 803
    avoid sub-bins   boat 1596 | static 527 | both 436 | none 1541   mean dev 43°
    avoid-none       lat-static 574 | floe<250u 346 | boat<300u 216 | latch 4
                     | TRUE-none 401
    SECONDS by class rec 14 | turn 23 | avoid 77 | offrt 47 | sail 36  (park 3s)
    falsebeat 4% of sail-mode distance | heading-vs-carrot 19° | xtrack mean 491u

    DEFLECTION HISTOGRAM  47% of transit frames carry a deviation
      6°  15.7% | 11°  10.0% | 23°  19.4% | 34°  11.4% | 46°   8.7%
     69°  11.4% | 92°  12.2% | 126°  7.2% | 172°  4.0%
      => 23% of avoiding frames deflect 69° OR MORE, and 4% are near-reversals

Two things to carry forward. **`true-none` is only 401u of 9182 (4%)** — the
avoidance layer is almost always responding to something real, so "spurious
avoidance" is not the bin. And **the deflection distribution is bimodal**: a
large mass of small corrections (45% under 23°) plus a hard tail where a quarter
of avoiding frames swing 69° or more. Any structural replacement should be
judged on whether it moves the TAIL, not the mean — the mean has now sat at
42-43° through twelve re-pricings, three ice commitments, and a map fix that
moved everything else.

**BAY deflection histogram** (`_defl_hist.js` now takes a venue argument),
alongside arctic for comparison:

                  6°    11°    23°    34°    46°    69°    92°   126°   172°   | >=69°
    bay   30%   25.7   13.3   14.9   11.2    9.1   10.1    7.5    5.6    2.4   |  25.6%
    arctic 47%  15.7   10.0   19.4   11.4    8.7   11.4   12.2    7.2    4.0   |  34.8%

(the leading % is the share of ALL frames carrying any deviation). Bay avoids
less often and swings slightly less hard, but **the shape is the same on both
venues: a large mass of small corrections plus a hard tail where a quarter to a
third of avoiding frames swing 69° or more.** That tail is the target.

## ⚡ ENCOUNTER ARITY — how much of the avoidance bin a pairwise structure could even reach

`_encounter_arity_probe.js` (new). The handoff's recommendation for the
avoidance bin is a structural replacement, and the literature candidate
(ORCA/VO) is PAIRWISE by construction — one half-plane per neighbour, exact for
a 1-on-1 crossing and progressively over-constraining as neighbours are added.
So: how many boats are actually in these encounters? Measured at every frame
where avoidance is bending the heading >0.12 rad:

    ARCTIC (113202 avoiding frames, 45650 in the >=69° tail)
      rivals within 600u   0:35%  1:27%  2:19%  3:10%  4:3%  5+:5%
      rivals within 250u   0:71%  1:22%  2:4%   3:1%   4+:2%
      tail, within 250u    0:67%  1:24%  2:6%   3:2%   4+:1%
      DEFLECTING WITH NO RIVAL INSIDE 600u:  35% of all frames, 31% of the tail

    BAY (56483 avoiding frames, 12484 in the tail)
      rivals within 600u   0:15%  1:20%  2:26%  3:17%  4:10%  5+:12%
      rivals within 250u   0:55%  1:32%  2:8%   3:2%   4+:3%
      tail, within 250u    0:43%  1:35%  2:12%  3:4%   4+:6%
      DEFLECTING WITH NO RIVAL INSIDE 600u:  15% of all frames, 12% of the tail

**Two facts that should shape the next design before a line is written.**

1. **At the radius that actually forces a manoeuvre, encounters ARE pairwise.**
   Within 250u, 93% of arctic and 87% of bay avoiding frames involve at most one
   rival. A pairwise half-plane structure is not obviously the wrong shape —
   these are not multi-boat scrums where ORCA would over-constrain.

2. **But a third of arctic avoidance is not about boats at all.** 35% of arctic
   avoiding frames (and 31% of the hard tail) have NO rival within 600u — they
   are deflections around ICE. No boat-to-boat structure can touch them, and
   the ice side of this problem has now absorbed three commitment rejections and
   six pricing rejections. On bay the ice share is only 15%, so a pairwise
   replacement has roughly three times the reachable surface there.

⇒ **If the ORCA-style replacement gets built, build and gate it on BAY, not
arctic.** Arctic's avoidance bin is majority-ice, which is exactly the part the
structure cannot address; bay's is majority-boats, and bay's excess is already
42% avoidance with a bench that runs in six minutes.

## ⚡ CPA AT AVOIDANCE ONSET — the trigger fires on passes that would already clear

`_cpa_onset_probe.js` (new). At the frame avoidance FIRST engages on a boat,
what is the geometry with the rival that caused it? (`getRiskMetrics` is pure
math on positions and headings, so this is read-only.)

    BAY    2950 onsets   with a closing rival 74%   |  ice/land only 26%
      tCPA   p10 0.2  p25 0.5  MED 1.2  p75 2.5  p90 5.9   seconds
      dCPA   p10  58  p25 116  MED 209  p75 345  p90 455   units
      role at onset  NONE 43% | GIVE_WAY 42% | STAND_ON 15%
      risk at onset  LOW 43% | MEDIUM 38% | HIGH 12% | IMMINENT 7%

    ARCTIC 8454 onsets   with a closing rival 45%   |  ice/land only 55%
      tCPA   p10 0.3  p25 0.7  MED 1.6  p75 3.4  p90 6.8
      dCPA   p10  50  p25 111  MED 205  p75 331  p90 451
      role   NONE 42% | GIVE_WAY 41% | STAND_ON 17%
      risk   LOW 42% | MEDIUM 33% | HIGH 16% | IMMINENT 10%

Two venues, independent runs, and the distributions are nearly the same shape.

**The headline: the median onset has a predicted closest approach of ~207 units
— about 2.6x the 80-unit safety bubble — and 42-43% of onsets happen at LOW risk
with NO right-of-way role assigned at all.** These are not encounters being
resolved; they are the soft-proximity gradient nudging the argmin for passes
that were already going to clear. It is the same picture the deflection
histogram gave from the other side (45% of avoiding frames under 23°).

**And for anyone sizing a τ for a velocity-obstacle underlay: 80-85% of real
encounters are engaged with tCPA ≤ 4s and 88-90% by 6s** — which is a strong
independent confirmation of the rival-lookahead knee already found at 4s, from a
completely different measurement.

**The obvious lever off that measurement was tested, and 250u is a knee too.**
The soft-proximity band (`distSq < 250*250`) is what fires on those clearing
passes, and the world it was tuned in HAS changed twice this session, so it was
re-swept both ways on the bay 20-seed bench:

    band 180u   fin med 259  paired -3 med / -4.2 mean   rubs 1.91 -> 2.61  pens 0.50 -> 0.61
    band 250u   fin med 257  (HEAD)                      rubs 1.91          pens 0.50
    band 320u   fin med 260  paired -6 med / -5.1 mean   rubs 1.91 -> 1.81  pens 0.50 -> 0.58

Narrowing it costs contacts badly (rubs +37%), widening it buys a few contacts
and costs pace. **So the band is not miscalibrated — the "unnecessary"
deflections it produces are the price of the contacts it prevents.** That is the
seventh constant verified at its knee on both sides this session, and it means
the 42-45% avoidance bin cannot be reached by adjusting when the existing cost
function speaks. It has to be a different cost function.

---

# ⚡ 2026-08-04b OWNER DIRECTION — SAIL THE RULES, DON'T RUN A POTENTIAL FIELD

Owner, mid-session: *"The rules of sailing dictate who has rights in every
circumstance… which allows boats to cross safely at remarkably small gaps. If a
boat doesn't have rights it must adjust to make sure that crossing happens
safely. If a boat does have rights it should by default keep sailing a proper
course so that it remains predictable… A clean race is a fast race."*

The measurement that arrived the same minute is the empirical case for exactly
that, and it is the strongest single number the campaign has produced.

## THE MEASUREMENT — `_minimal_escape_probe.js`

At every avoidance onset with exactly ONE rival inside 250u (the arity probe says
that is 87-93% of the deciding cases), search the heading circle for the SMALLEST
deflection whose predicted closest approach clears 80u assuming the rival holds
course. Compare it to what the boat actually did.

                              bay                arctic
    pairwise onsets           989                1706
    ALREADY CLEARING at 80u   860  (87%)         1391 (82%)
    deflection TAKEN   med     23°  p90  92°       23°  p90 126°
    minimal NEEDED     med      0°  p90   2°        0°  p90   3°
    took MORE than needed     954/970 (98%)      1557/1579 (99%)
    took LESS (unresolved)     16  (2%)            22  (1%)

**Four boats in five were already going to pass clear, and the fleet swerved a
median 23° anyway.** This is not a tuning error in a good design; it is the wrong
kind of controller. A cost-sum argmin has no concept of "this crossing is already
safe" or "this is not my obligation" — it only has a gradient, and a gradient is
never zero.

## THE CODE AUDIT — what the engine actually implements

**Correct today.** ROW determination for Rule 21 (OCS/penalty boats keep clear),
Rule 13 (while tacking), Rule 10 (opposite tacks), Rule 11 (same tack,
overlapped), Rule 12 (clear astern), Rule 18 (mark-room) and Rule 19 (room at an
obstruction). Contact fault is assigned to the NON-right-of-way boat, with
mark-room immunity, and both boats are penalised when there is no ROW.

**⚠️ Rules 15, 16.2 and 17 are computed and then thrown away.** They are pushed
into `result.constraints`, and `constraints` has exactly ONE consumer in the
entire codebase — `getDebugInfo()`, which feeds the debug overlay. No penalty
path reads them. No AI path reads them. So:
- **Rule 15** (a boat acquiring right of way shall initially give room) — detected, never enforced.
- **Rule 16.2** — detected, never enforced.
- **Rule 17** (leeward boat overlapped from clear astern shall not sail above her proper course) — detected, never enforced.

**⚠️ There is no concept of PROPER COURSE in the AI at all.** `grep -c
"properCourse\|proper course"` over script.js returns 1, and it is a comment. A
stand-on boat gets a hold-course *bonus* scaled by speed (`jamF`), but it has no
defended course, and it still pays the same collision and proximity costs as
everyone else — so it swerves, which is precisely what makes it unpredictable to
the boat that is supposed to be planning around it.

**⚠️ Infringing rights without contact is effectively unpunished.** The
no-contact foul exists (script.js §4, `kind: 'no_contact'`) but its gate is very
narrow: STAND_ON role, risk HIGH or IMMINENT, and a sustained >20° forced
deviation held for 0.8s — and a role is only assigned when predicted CPA is
already under 70u. Measured firing rate: **3 fouls per 72 bay boat-races and 18
per 72 arctic**, against 2.0-2.3 CONTACTS per boat-race. Under the real rules,
forcing a right-of-way boat to alter course at all is a foul; here it almost
never is. The owner's suspicion was right.

**⚠️ Roles are assigned against ONE worst threat and only above LOW risk**, so
42-43% of avoidance onsets happen with NO right-of-way role in play.

**Confound removed.** The first cut of the probe could have been measuring
deflections taken for a mark or the shore with a rival merely nearby, so it was
re-run requiring genuinely clear water — no mark within 300u and at least 4
cells of grid clearance. ⚠️ The first attempt at that filter used island
BOUNDING-CIRCLE radii and excluded 989 of 989 onsets, because a shoreline
polygon's bounding circle covers the venue; clear water is what the navigation
grid says it is, not what a bounding circle says.

    bay, CLEAR WATER only     621 onsets (368 excluded)
      ALREADY CLEARING at 80u     531  (86%)
      deflection TAKEN      p25 11   MED 11   p75 46   p90 92  degrees
      minimal NEEDED        p25  0   MED  0   p75  0   p90  2  degrees
      took MORE than needed       598/605 (99%), median excess 11°, mean 34°

The finding survives the confound: **86% of clear-water pairwise encounters
needed no deflection at all.**

## THE PLAN — RRS-first avoidance, in the order it should be built

**1. Make the rules real in the ENGINE (correctness first, and it is testable
without touching the AI).** Enforce Rules 15, 16.2 and 17 instead of formatting
them for the debug overlay, which needs a real `properCourse` definition — the
course a boat would sail absent the other boat, which the AI already computes
every tick as `desiredHeading` before `applyAvoidance` and simply never names.
Then widen the no-contact infringement so that FORCING a right-of-way boat to
alter course is a foul at realistic thresholds, not just at CPA<70u with a
sustained 20° deviation. ⚠️ Expect penalty counts to RISE, which fails the
standing lexicographic gate by construction — this is a rules-correctness call
for the owner, and it should be judged on whether the fouls are CORRECT, not on
whether the count went down.

**2. Then make the AI sail them.** The asymmetry is the whole point and it is
also, per the avoidance research memo, the documented anti-dance mechanism:
exactly one boat reacts.
   - **Right-of-way boat: hold proper course.** Do not pay a proximity gradient
     against a boat you have rights over; deviate only when Rule 14 bites (it is
     clear the other boat is not keeping clear). A ROW boat that swerves is
     unpredictable, and its swerve is what makes the give-way boat's plan wrong.
   - **Give-way boat: plan against that predictability, and take the MINIMUM.**
     Replace the cost-sum argmin for the give-way pairing with a minimal-escape
     computation against the ROW boat's projected proper course — the smallest
     course change that clears by a sailor's margin, not the argmin of a sum of
     penalties. This is the ORCA-style objective REPLACEMENT the campaign already
     identified as its last structural candidate, but grounded in RRS rather than
     in symmetric reciprocity, which is strictly better: RRS already says who
     yields, so there is no reciprocity to negotiate.
   - **Rule 13:** a boat that tacks LOSES rights while tacking. The tack decision
     should price that — tacking into a converging rival converts you from
     stand-on to keep-clear mid-manoeuvre.
   - **Rule 19:** room at obstructions exists (`rule19Pairs`) and should be
     extended to the ice, since a floe is an obstruction and the give-way boat
     must be left room to pass it safely.

**3. Gate on BAY.** The arity probe says 35% of arctic avoidance frames have no
rival within 600u (they are ice, which no boat-to-boat structure can reach)
against 15% on bay, and bay's bench runs in six minutes.

**First probe of step 2, run at the session's end (`rowhold`):** a stand-on boat
stops paying the soft-proximity gradient against the boat it has rights over.
The hard Rule-14 collision term is untouched, so a boat that genuinely is not
keeping clear is still avoided. Result below.

**`rowhold` RESULT — the halves are not separable, which is itself the finding.**

    bay 20-seed vs HEAD    fin med 257 -> 258, paired 0 med / -3.6 mean
                           boat rubs 1.91 -> 2.10, pens 0.50 -> 0.53
    arctic 8-seed screen   med 398 -> 399, in-time 43 -> 45, finishers 72 -> 70,
                           paired -5 med / +4.3 mean

Slightly negative on bay, mixed on arctic. **Mechanism: a right-of-way boat that
stops avoiding is only safe if the give-way boat is actually keeping clear, and
today it is not — it is running the same undifferentiated cost sum.** Removing
the ROW boat's contribution without simultaneously replacing the give-way boat's
planner just holds course into a boat that was never going to yield enough.

That is the same shape as this session's accepted penalty-turn change, where
neither the shorter deadline nor the sea-room ask worked alone and the pair
worked well. **Steps 2a (ROW holds proper course) and 2b (give-way takes the
minimal escape against that course) must land TOGETHER.** Probing either half on
its own will read as a rejection and should not be taken as one.

## ⚡ BOTH HALVES TOGETHER (`rrspair`) — the rules version works

Half 2a (right-of-way boat stops paying a proximity gradient against the boat she
has rights over) plus half 2b: the give-way boat's flat "duck the stern" reward
(−800) and "don't cross the bow" penalty (+1500) are REPLACED by the obligation
as the rule states it — **keep clear by enough, and no more.** Cost falls to zero
as soon as the candidate clears a 110u gap, so the base deviation cost then picks
the SMALLEST course change that satisfies the obligation. Bow/stern survives only
as a tie-break at equal clearance.

The old shaping was a DIRECTION preference with no notion of enough: −800 against
a base deviation cost of ~2.5 at 23° buys any swing the fan offers, which is
exactly the 86%-already-clearing result.

    bay 20 seeds 9100-9119 vs HEAD    fin med 257->256   paired 0 med / +0.6 mean
      boat rubs   1.91 -> 1.54  (-19%)
      penalties   0.50 -> 0.42  (-16%)
      OCS         5.6% -> 0.0%
    bay 20 seeds 9200-9219 (DISJOINT) fin med 259->253   paired +5 med / +5.3 mean
      boat rubs   1.88 -> 1.84
      penalties   0.49 -> 0.39  (-20%)
      OCS         8.9% -> 2.2%
      land 0.04 -> 0.00, mark 0.67 -> 0.43
    arctic 8-seed screen              med 398->392  paired +3 med / +5.6 mean
      in-time 43 -> 42, finishers 72 -> 71

**Cleaner on every rules metric on both disjoint seed sets, and not slower.** The
owner's claim that a clean race is a fast race shows up directly: penalties
−16-20%, OCS collapsing, mark and land contacts down, and pace neutral to +5s.

⚠️ **NOT LANDED — the session ended with its gates still running.** Outstanding
before it can land: the seatrials 100t anchor (this touches every venue and is
NOT `_gridFixed`-scoped), the arctic 16-seed fleet gate, and goldens. Both were
launched at 17:05. Start-crossing time rises (mean 7.6→10.3 on the first set),
which is plausibly correct — a give-way boat that actually keeps clear does not
barge at the line — but it should be checked rather than assumed.

⚠️ Note the ordering trap this session hit twice: probe each half alone and BOTH
read as rejections (`rowhold` alone was −3.6 mean). The pair is the unit. The
working tree for it is `regatta/eval/rl/treeD`.

### `rrspair` GATES — anchor is a big WIN, arctic is one finisher-count short

    SEATRIALS 100t          HEAD 202.83 / 199.79   RRS pair 199.87 / 195.59
      penalties             0.31                   0.31   (flat)
      OCS                   16.89%                 12.67%
      start time mean/med   7.14 / 3.55            5.87 / 2.46
      min                   174.97                 174.32     DNS/DNF 0 both

**The eval anchor improves by ~3s mean and ~4s median with penalties flat and
OCS down 4 points.** That anchor has sat at 202-204 for the entire campaign, and
this is a venue the change was not tuned on — it is not `_gridFixed`-scoped, so
Clubhouse takes it in full.

    ARCTIC 16-seed gate (9100-9115)   med 440 -> 426, mean 453.4 -> 443.7
      paired +7 med / +8.3 mean, in-time 65 -> 66, rounders 143 = 143
      ⚠️ FINISHERS 141 -> 137

⛔ **NOT LANDED.** Faster on every pace measure and cleaner on every rules
measure, but four fewer boats finish inside the 900s window, and a finisher drop
is disqualifying under the standing lexicographic rule. ⚠️ It is also exactly the
metric this venue disagreed with itself about earlier today (the heat-gate change
read in-time 71→65 on one 16-seed set and 45→65 on another), so the honest next
step is the DISJOINT set — launched at 17:26 as `rrspair16b` (seeds 9200-9215),
comparable against `fleet_leg2_noheat16b.json`.

**If the finisher count holds up on the second set, this lands as-is.** If it
does not, the likely culprit is the 110u KEEP gap being generous in a floe field
where boats also owe room at obstructions (RRS 19) — sweep it at 90 and 130 on
the arctic gate before touching anything else. The tree is `regatta/eval/rl/treeD`.

---

# RULES AUDIT AGAINST THE ACTUAL TEXT (RRS 2025-2028, owner-supplied PDF)

Read from `2025-2028-RRS-with-Changes-and-Corrections.pdf` (World Sailing, incl.
corrections to 20 Apr 2026): Definitions (book p.8-11) and Part 2 in full
(p.16-22). The earlier audit in this doc was against a web summary; this one is
against the text, and it finds more.

## Definitions the engine needs and does not have

**Keep Clear** — *"A boat keeps clear of a right-of-way boat (a) if the
right-of-way boat can sail her course with no need to take avoiding action, and
(b) when the boats are overlapped, if the right-of-way boat can also change
course in both directions without immediately making contact."*

⚠️ **(b) is not modelled at all.** The engine's keep-clear test is proximity and
CPA. For OVERLAPPED boats the rule demands the ROW boat be able to turn EITHER
WAY without contact — a materially larger lateral gap than any CPA test implies,
and it is exactly why real boats hold a specific separation when overlapped.
**This directly sizes the `KEEP` constant in the `rrspair` give-way planner: 110u
of CPA is the wrong quantity when overlapped; it should be a both-directions
clearance test.**

**Proper Course** — *"A course a boat would choose in order to sail the course as
quickly as possible in the absence of the other boats referred to in the rule
using the term. A boat has no proper course before her starting signal."*

That is precisely `desiredHeading` immediately before `applyAvoidance`, computed
every tick and never named. ⚠️ Note the second sentence: **no proper course
before the starting signal** — so any proper-course logic must be gated off in
the prestart, which also means rule 17 cannot bind there.

**Room** — *"The space a boat needs in the existing conditions, including space
to comply with her obligations under the rules of Part 2 and rule 31, while
manoeuvring promptly in a seamanlike way."* Room is therefore SPEED- and
STATE-dependent, not a constant; the engine treats room as fixed distances.

**Obstruction** — an object that could not be passed without changing course
substantially from one hull length away; *"a boat racing is not an obstruction to
other boats unless they are required to keep clear of her."* ⚠️ So a right-of-way
boat IS an obstruction to the boat that must keep clear — which is what makes
three-boat situations resolvable, and is not modelled.

**Continuing Obstruction** — one the boat will pass alongside for at least three
hull lengths. ⚠️ **Every shoreline in this game is a continuing obstruction**, and
under 18.1(a)(4) that means rule 19 applies and rule 18 does not.

## Rules absent from the engine entirely

- **Rule 18.3 Tacking in the Zone** and **18.4 Gybing in the Zone** — 0 matches.
- **Rule 20 Room to Tack at an Obstruction** — 0 matches. In a channel or a floe
  field a close-hauled boat that needs to tack away from land has no way to ask
  for room, and no boat is obliged to give it. A plausible contributor to the
  shore pins and to the L1 tack churn.
- **Rule 22 Capsized, Anchored or AGROUND** — 0 matches. *"If possible, a boat
  shall avoid a boat that is … aground."* **The bots ground constantly** —
  583-713 groundings per boat-race on arctic — and nothing makes the fleet avoid
  a grounded boat, which is both a rules break and a collision source.
- **Rule 23.2 Interfering** — 0 matches. *"a boat shall not interfere with a boat
  that is taking a penalty, sailing on another leg, or subject to rule 21.1."*
  ⚠️ **This is the rule that should have protected the flagged boats this session
  spent the morning working around** — and the "another leg" clause covers the
  17-25% of bay rubs that are between boats on different legs.
- **Rule 21.3** (moving astern / backing a sail) — absent.

## Rules present but wrong or incomplete

- **⚠️ Rule 13 is WRONG when both boats are tacking.** The text: *"If two boats
  are subject to this rule at the same time, the one on the other's PORT SIDE or
  the one ASTERN shall keep clear."* The engine gets clear-astern right, then for
  the side case falls through to a rule 10/11 basis ("Both Tacking (Starboard)",
  "Both Tacking (Leeward)") — but rule 13 says explicitly that *"during that time
  rules 10, 11 and 12 do not apply."* It should be the boat on the other's PORT
  SIDE that keeps clear, which is a geometric test, not a tack test.
- **Rule 18.1 exceptions: only (a)(1) is implemented.** Missing (a)(2) opposite
  tacks where the proper course at the mark for one but not both is to tack;
  **(a)(3) between a boat approaching a mark and one leaving it** — which these
  multi-leg courses generate constantly; (a)(4) continuing obstruction; and
  (b) rule 18 stops applying once mark-room has been given.
- **Rules 15, 16.1, 16.2 and 17 are computed and discarded** — confirmed against
  the text. `constraints` has one consumer, `getDebugInfo()`.
- **Contact fault is assigned to the non-ROW boat only.** Rule 14 binds BOTH
  boats; a right-of-way boat that could have avoided contact once it was clear
  the other was not keeping clear also breaks it. The engine never penalises a
  ROW boat.

## `rrspair` VERDICT — bay and Clubhouse yes, arctic no; the venue split repeats

The disjoint arctic set settled it, and it settled it against landing as-is:

    ARCTIC, 32 SEEDS COMBINED        HEAD          rrspair
      rounders                        285            286
      finishers                       280            276
      IN-TIME                         130            119
      median / mean               439 / 452.6    444 / 455.7

    per set (they disagree, again):
      set1 9100-9115   med 440->426  in-time 65->66  fins 141->137  paired +7 / +8.3
      set2 9200-9215   med 435->454  in-time 65->53  fins 139->139  paired +1 / -13.7

⚠️ The finisher drop from set 1 did NOT replicate (139→139 on set 2), so that
part was noise — but in-time is down 11 across 32 seeds and the median is up.
**Arctic rejects it.**

    BAY (2 disjoint 20-seed sets)   pens -16% / -20%, OCS 5.6->0.0% and 8.9->2.2%,
                                    rubs -19%, pace +0.6 and +5.3 paired
    CLUBHOUSE 100t                  202.83/199.79 -> 199.87/195.59, pens FLAT 0.31,
                                    OCS 16.89% -> 12.67%

**This is the same venue split as the penalty-turn change earlier today, and
probably the same cause: the rules-correct behaviour is calibrated for boat-on-
boat in open water, and arctic is a floe field.** The audit above says exactly
what is missing for the ice case — a boat racing is an OBSTRUCTION to the boat
that must keep clear of her; every shoreline is a CONTINUING obstruction, which
routes to rule 19 not 18; rule 20 (room to tack at an obstruction) does not
exist; and rule 22 (avoid a boat AGROUND) does not exist while arctic bots ground
583-713 times a boat-race.

**So the next step is not to tune `KEEP` — it is to finish the rules.** In order:
1. `keep clear` definition part (b): when OVERLAPPED, the ROW boat must be able
   to change course in BOTH directions without immediately making contact. That
   is the correct quantity for the give-way planner's clearance, and it replaces
   the 110u CPA constant with something the rule actually defines.
2. Rule 23.2 (do not interfere with a boat taking a penalty or on another leg)
   and rule 22 (avoid a boat aground) — both cheap, both currently absent, and
   both target measured contact classes.
3. Rule 19 at ICE (a floe is an obstruction; a shoreline is a continuing one),
   which is the arctic-shaped hole this verdict just exposed.
4. Then re-gate `rrspair`. If arctic still splits, scope it the way the
   penalty-turn change is scoped, on `_floeObjs`.

---

# ⚡ THE RULES ENGINE WAS TELLING THE AI THE WRONG THING

`_row_truth_probe.js` (new) compares the engine's own verdicts against the
definitions, on every close pair (<300u) at 2Hz.

⚠️ **A first run of this probe reported a 99.4% tack disagreement. That was the
PROBE, not the engine** — its sign convention was inverted. The mapping was then
established empirically instead of derived: with the boom settled and
head-to-wind/by-the-lee excluded, sign(TWA) vs sign(boomSide) separates
perfectly — twa<0 ↔ boom+ (1499 samples), twa>0 ↔ boom− (830), zero
counter-examples. **TWA < 0 is starboard tack.** Corrected numbers:

                                                  BAY      ARCTIC
    tack differs from the definition              6.1%      9.0%
    ...and that FLIPS the opposite-tacks test     5.9%      8.7%   (rule 10)
    leeward boat differs, local vs global wind   10.3%     51.7%   (rule 11)
    local-vs-global wind angle              med 12.3°   med 83.2°
                                            p90 27.4°   p90 166.4°
    stern projects ahead of bow                  22.6%     30.7%   (clear astern)
    both boats tacking at once                    3.7%      3.0%   (rule 13)

**On arctic the engine picks the wrong leeward boat for MORE THAN HALF of close
pairs**, because rule 11 is decided from `state.wind.direction` — the
course-centroid blend — which runs a median 83° from the wind between the boats.
Root cause #2 of this entire campaign was that same blend; the AI was moved to
`getWindAt` and **the rules engine never was.**

## The four corrections (`treeK`)

1. **`getTack`** — from the LOCAL wind angle, not `boomSide`. `boomSide` is an
   animation (`boomSide += (target - boomSide) * swingSpeed`), so a boom-derived
   tack flips when the sail finishes swinging rather than when the boat crosses
   the wind. The boom is kept for the one case the definition makes it decisive:
   sailing by the lee or dead downwind.
2. **`getLeewardBoat`** — local wind at the midpoint between the boats.
3. **`isClearAstern`** — project BOTH hull ends of the behind boat and take the
   foremost. "Her hull and equipment" is the whole boat; the bow-only test is
   correct only while the headings are within ~90°.
4. **Rule 13, both boats tacking** — the rule's own test ("the one on the other's
   PORT SIDE or the one astern"), not a fall-through to rules 10/11, which rule
   13 explicitly suspends.

Verified after: tack disagreement **6.1% → 0.0%**, opposite-tacks flips
**5.9% → 0.0%**. (The leeward and stern-ahead figures measure how often the WORLD
presents the condition, not whether the code handles it, so they do not move.)

## What it does to racing — and it splits exactly as the error rates predict

    ENGINE FIX ALONE
      bay 20-seed      fin med 257 -> 260, paired -6 med / -4.6 mean,
                       pens 0.50 -> 0.54, rubs 1.91 -> 2.03, OCS 5.6 -> 8.3%
      arctic 8-seed    med 398 -> 386, paired +17 med, in-time 43 -> 44,
                       finishers 72 = 72

**Bay gets worse and arctic gets better, and that is the predicted sign.** Bay's
leeward error was 10.3%, so correcting it mostly reshuffles; arctic's was 51.7%,
so correcting it is worth a paired median of +17s. ⚠️ The bay regression is not
evidence the fix is wrong — **the AI was tuned against the buggy verdicts**, and
its stand-on/give-way shaping now fires on different pairings than it was
calibrated for.

    CORRECTED ENGINE + THE RRS AI (`rrspair`) TOGETHER — `treeR`
      bay 20-seed      fin med 255 (best of all four builds), paired +1 med,
                       pens 0.44, OCS 5.6% -> 1.1%, land 0.16 -> 0.05

The AI half recovers the engine fix's bay cost (−6 med → +1 med) and gives the
best bay median measured this session. The arctic 16-seed gate for the pair is
the deciding run — the hypothesis being tested is that `rrspair` failed on arctic
BECAUSE the verdicts it faithfully obeys were a coin flip there.

## ✅ LANDED — `b67d610` (engine) + `649a234` (AI) + `0aca536` (goldens)

The disjoint arctic set disagreed with the first AGAIN (set1 in-time 65→76,
set2 65→61 — the third time this venue has contradicted itself in one day), so
the verdict is read on the 32-seed combination, which is what has been reliable:

    ARCTIC, 32 SEEDS            HEAD        corrected engine + RRS AI
      rounders / finishers    285 / 280            286 / 281
      IN-TIME                     130                  137
      median / mean         439 / 452.6          422 / 453.3

    BAY 9100-9119    fin med 257 → 255, paired +1, pens 0.50 → 0.44, OCS 5.6 → 1.1%
    BAY 9200-9219    fin med 259 → 257, paired +3, rubs 1.88 → 1.67, OCS 8.9 → 2.8%
     (DISJOINT)
    SEATRIALS 100t   202.83/199.79 → 198.75/194.91, pens 0.31 → 0.29,
                     OCS 16.89% → 14.89%, max 360.00 → 312.00, DNS/DNF 0

**Nothing reaches the 360-second cutoff on the anchor any more**, and the anchor
is the fastest it has been in the campaign's recorded history with penalties
DOWN. Lexicographic: penalties down on three of four measures and +0.02 on the
fourth (noise), OCS down everywhere, finishers up, then pace.

Goldens re-recorded for all 18; redrock's two left deliberately red.

**⚠️ Neither half is separable, and probing either alone reads as a rejection:**
the engine fix alone costs bay a paired 6 seconds (the AI was tuned against the
buggy verdicts), and the AI alone lost arctic (finishers 280→276, in-time
130→119) because it faithfully obeyed verdicts that were a coin flip there. That
is now the third time this session a change has only worked as a pair.

### What remains, in order

1. **`keep clear` definition part (b)** — when OVERLAPPED, the right-of-way boat
   must be able to change course in BOTH DIRECTIONS without immediately making
   contact. This is the principled replacement for the `KEEP = 110` CPA constant
   the give-way planner currently uses, and the rule defines the quantity.
2. **Rule 23.2** (do not interfere with a boat taking a penalty or on another
   leg) and **rule 22** (avoid a boat aground) — both absent, both cheap, both
   aimed at measured contact classes.
3. **Rule 19 at ice** — a floe is an obstruction and every shoreline is a
   CONTINUING obstruction, which routes to rule 19 rather than 18.
4. **Then** widen the no-contact foul to the real standard ("the right-of-way
   boat can sail her course with no need to take avoiding action"). ⚠️ LAST, and
   deliberately so: done before the deflections collapse it would penalise the
   AI's own timidity rather than real infringement. Expect penalty counts to
   RISE, which fails the lexicographic gate by construction — judge it on whether
   the fouls called are CORRECT.

## KEEP-CLEAR (a)/(b) and RULES 22 + 23.2 — measured, NOT landed

**keep-clear split** (`treeD`): the definition gives two different tests and the
code was using one for both. (a) *"the right-of-way boat can sail her course with
no need to take avoiding action"* is a CPA condition satisfied at a SMALL gap —
which is exactly why sailors cross at gaps that look alarming. (b) *"when the
boats are OVERLAPPED, if the right-of-way boat can also change course in BOTH
DIRECTIONS without immediately making contact"* is not a CPA condition at all: a
windward boat on a diverging track still is not keeping clear if a luff would hit
her. That is LATERAL room off her centreline, sized by how far she can swing her
bow immediately (her turn rate × ~1.2s × hull length + our beam). The `KEEP = 110`
CPA constant was too strict for crossings and too weak alongside.

    bay 9100-9119   fin med 255->255 (mean 257.4->254.6), paired +2 med / +2.8 mean
                    pens 0.44->0.39, OCS 1.1->0.0%, rubs 1.91->1.67, max 375->301
    bay 9200-9219   fin med 257->251, paired +6 med / +5.9 mean
     (DISJOINT)     pens 0.51->0.36, OCS 2.8->0.6%, RUBS 1.67->1.21
    arctic 32 seeds rounders 286->285, finishers 281->281, in-time 137->132,
                    med 422->432, mean 453.3->448.8
    seatrials 100t  198.75/194.91 -> 198.77/194.53, OCS 14.89->13.33%,
                    pens 0.29->0.31, MAX 312->360

**rules 22 + 23.2** (`treeH`, on top): a boat AGROUND is avoided by everyone
(Section D removes Section A between them — she has neither rights nor
obligations, and the arctic fleet grounds 583-713 times a boat-race). And no
interference with a boat taking a penalty, on another leg, or returning — ⚠️ with
the exemption doing the real work: *"this rule does not apply when the boat is
sailing her proper course"*, and our proper course is exactly the UNDEFLECTED
candidate, so the rule constrains our DEVIATIONS and costs nothing while we are
simply racing.

    bay 9100-9119   fin med 255->252, paired +1, rubs 1.67->1.52, land 0.12->0.04
    bay 9200-9219   fin med 251->251, paired -2, RUBS 1.21->1.06, mark 0.43->0.34
    arctic 8 screen finishers 72->71, med 397->396, paired +6 med / -12.0 mean

⛔ **Neither is landed. The venue split has now repeated FOUR times** (penalty
turns, heat gate, `rrspair`, keep-clear): every rules-correctness improvement
wins on bay and Clubhouse and goes neutral-to-negative on arctic. That is not a
coincidence and it is not ice being "harder" — **the audit already named the
hole. Arctic's avoidance is 35% ICE (no rival within 600u at all), and the rules
layer has no proper obstruction model:**
- rule 19 exists and does iterate `state.course.islands` (so floes are included),
  but the definition of *continuing obstruction* — every shoreline here — is
  absent, and 18.1(a)(4) routes those to rule 19 rather than 18;
- *"a boat racing IS an obstruction to other boats… required to keep clear of
  her"* is not modelled, which is what makes three-boat situations resolvable;
- rule 20 (room to tack at an obstruction) does not exist at all, so a boat
  close-hauled at the ice has no way to be given room.

**⇒ The next unit of work is the OBSTRUCTION MODEL, not more keep-clear tuning.**
Bay measurements will keep improving without it and arctic will keep refusing,
because on arctic a third of the problem is not a boat.

Interim option if the bay win is wanted now: scope keep-clear on `_floeObjs` the
way the penalty-turn and heat-gate changes already are — it would be the third
use of that pattern, and it is a stopgap, not the fix.

---

# ⚡ OVERNIGHT QUEUE (prepared 2026-08-05 00:10, for a FRESH INSTANCE)

## READ FIRST — the two things that make this session different

**1. THE BOATS CHEAT AT ROUNDINGS, AND CORRECTNESS OUTRANKS PACE HERE.** Owner,
explicitly: *"Since they were cheating, once you fix this I expect numbers to
drop a bit. But cheating is worse than losses in time."* So the standing
lexicographic gate DOES NOT apply to the rounding fix. Judge it on whether
roundings are real, and report the pace cost honestly rather than treating it as
a rejection.

**2. ROUNDING HAS BEEN GOT WRONG SEVERAL TIMES BEFORE.** Owner: *"be careful —
it's probably worth setting up small tests."* `regatta/eval/test_rounding_string.js`
is that test and it is **deliberately RED on HEAD**. Do not wire it into
`npm test` until it passes. Make it pass; do not edit it to agree with the code.

## WHAT THE CHEAT IS — measured, and it is ONE CONSTANT

`ROUND_SWEEP_TOL = 0.75` (script.js ~15297). A rounding completes at 75% of the
geometric requirement, and **the AI targets that same discounted number** —
`reqSweep * ROUND_SWEEP_TOL` appears in the bot's own outbound/exit logic at
three sites (~343-354, ~796). The boats did not find a loophole; they were aimed
at 75% of a rounding.

`_rounding_truth_probe.js` (committed), 8 seeds:

    bay      360 completed roundings: 34% banked LESS than the full requirement,
             18% under 80%, 28% NEVER ENTERED THE ZONE, min fraction 0.74
    arctic    72 completed roundings: 85% under the full requirement,
             median 0.83, min 0.75 — the typical island rounding is 83% of a real one

Owner has seen it on **bay's windward mark** and **arctic's rounding island (the
more serious one)** — which matches: arctic is 85%.

**⚠️ It does NOT invalidate this session's A/B results.** The tolerance is
identical in baseline and experiment, so it inflates absolute rounding counts on
both sides equally. It invalidates "the fleet rounds N marks", not "change X is
worth +Y seconds". The owner independently confirms the AI gains are visible in
play.

## WHAT THE RULE ACTUALLY SAYS (read it, do not paraphrase from memory)

RRS 2025-2028 **Sail the Course**: *a string representing her track, when drawn
taut, (1) passes each mark on the required side and in the correct order, and
(2) **TOUCHES each mark designated in the sailing instructions to be a rounding
mark**.*

- (1) applies to EVERY mark. (2) is what makes a rounding a rounding, and it is
  the geometric definition: **the taut string must TOUCH the mark** — the track
  has to bend around it.
- **There is NO proximity requirement.** Going all the way round at a distance is
  a legal rounding, merely slow. `test_rounding_string.js` pins this in both
  directions and the current engine already gets it right — a full rounding at
  2.5x zone completes. **Do not "fix" this by adding a zone requirement.**
- There is no tolerance in either sentence.

⇒ The engine's `reqSweep` (the angle the taut string wraps, derived from the
previous and next marks) appears to be the CORRECT quantity. The bug looks like
the 0.75 discount alone. **Verify that before changing anything else** — the
test's 80%-completes / 60%-does-not result is exactly `TOL = 0.75` and nothing
more.

⚠️ Changing TOL to 1.0 will strand boats unless the AI is re-aimed at the same
time: it steers to `need = reqSweep * TOL` at three sites. Change both together
and expect the first bench to look bad.

## THE QUEUE

**A. THE ROUNDING FIX (highest value, owner-flagged, correctness-graded).**
Make `test_rounding_string.js` pass. Re-aim the AI's exit logic at the same
moment. Then re-measure with `_rounding_truth_probe.js` — the target is a median
fraction of ~1.0 with nothing below it. Report the pace cost; do not reject on it.

**B. MARK-ROOM / ROUNDING PRIORITY (owner-reported, rules 18.2-18.4).** Owner:
*"they don't adhere to the priority as they enter the rounding circle — first in
gets rights (still subject to tack rules)."* The precise rule is 18.2(a): at the
moment the FIRST of two boats reaches the zone, if they are overlapped the
OUTSIDE boat gives the inside boat mark-room; if they are not overlapped, the
boat that has NOT reached the zone gives the other mark-room — and it continues
even if the overlap later changes (18.2(a) final sentence). The engine has a
`zoneSnapshot` and implements 18.1(a)(1) only; **18.1(a)(2), (a)(3) "between a
boat approaching a mark and one leaving it", (a)(4), 18.1(b), 18.3 Tacking in the
Zone and 18.4 Gybing in the Zone are all absent.** Also owner: *"they could round
tighter when they do round correctly."*

**C. THE OBSTRUCTION MODEL — the thing four changes have now stalled on.**
Every rules-correctness win this session goes bay-positive and arctic-neutral or
negative (penalty turns, heat gate, `rrspair`, keep-clear). It is not ice being
harder: **35% of arctic avoidance frames have no rival within 600u at all**, and
the rules layer has no obstruction model — no *continuing obstruction* (every
shoreline here is one, which routes to rule 19 and not 18), no *"a boat racing IS
an obstruction to a boat required to keep clear of her"*, and no rule 20 (room to
tack at an obstruction) at all. Build this and the arctic half of the last four
changes should come back. **Then remove the `_floeObjs` scope from keep-clear**
(script.js, `openWaterKC`) and re-gate.

**D. RULES 22 + 23.2 — built, measured, NOT landed.** Sitting in `treeH`
(identifiable by the `otherAground` and `otherProtected` markers; note treeH also
has the UNSCOPED keep-clear beneath it, so lift only those two hunks). Rule 22:
a boat AGROUND is avoided by everyone. Rule 23.2: no interference with a boat
taking a penalty, on another leg, or returning — with the exemption doing the
work, since *"does not apply when the boat is sailing her proper course"* maps
exactly onto the undeflected candidate, so it constrains DEVIATIONS only. Bay
9100 +1 med with rubs 1.67→1.52; bay 9200 −2 med with rubs 1.21→1.06; arctic 8
screen mixed. Needs full gates.

**E. WIDEN THE NO-CONTACT FOUL — LAST, and deliberately so.** Owner: *"if the
boat with rights NEEDS to adjust (not just chooses to) then it is a penalty"* —
which is literally the Keep Clear definition part (a). The detector exists and
fires 3 times per 72 bay boat-races against 2.0 contacts. ⚠️ Do this only after
A-C, or it will penalise the AI's own timidity rather than real infringement:
86% of clear-water pairwise encounters were already clearing and the fleet
deflected anyway. Penalty counts WILL rise — judge on whether the fouls are
correct.

**F. MORE TESTS, per the owner's instruction.** `test_rounding_string.js` is the
model: small, deterministic, no full races, written against the rule text. The
obvious next ones are a ROW test (tack from local wind, leeward from local wind,
clear-astern with divergent headings, rule 13's port-side case — all four were
wrong until today) and a mark-room test for B.

## STATE AT HANDOFF

    HEAD              af7ac41 + fd2a905, tree CLEAN, goldens 18/20
                      (redrock's two deliberately red — leave them)
    seatrials 100t    198.77 / 194.53, pen 0.31, OCS 13.33%, DNS/DNF 0
    bay 20-seed       fin med 255, rubs 1.67, pens 0.39, OCS 0.0%
                      (`bay_bench_kcscoped.json`, seeds 9100-9119)
    arctic 32-seed    rounders 286, finishers 281, in-time 137, med 422
                      (`fleet_leg2_combo16.json` + `combo16b.json`)
    trees             treeA/treeG clean at HEAD, treeB tracked (do not touch),
                      treeH = the un-landed D candidate, treeL = HEAD, treeQ =
                      session start 7087af9. Clone more with `cp -Rc treeG treeX`
                      (APFS, instant). `regatta/eval/rl/*.json` is now gitignored.
    human reference   arctic med 212.1 best 190.4 (NEW, was 229.1/200.1),
                      bay 229.1/220.5, seatrials 187.7/184.1 — 51 trajectories

⚠️ Benching resolution, learned the hard way this session: a 20-seed bay bench at
full density buries a 4s effect (probe mechanism at 2-4 boats, verify at 9); an
8-seed bay bench INVERTED a contact metric that 20 seeds reversed; and arctic
in-time finishes disagreed between two 16-seed sets THREE separate times — read
the 32-seed combination or the paired per-boat median on that venue.

---

# 2026-08-05 — THE OVERNIGHT PUSH (session log, appended as verdicts land)

Started 00:27 PDT on HEAD `3629a65`. Baselines byte-checked before any A/B:
`bay_bench.js 20 9100 repro treeL` reproduced `bay_bench_kcscoped.json` byte for
byte, and `fleet_leg2.js 16 9100 arepro treeL` reproduced `fleet_leg2_combo16.json`
byte for byte.

## A. THE ROUNDING CHEAT — the constant was only half of it

`ROUND_SWEEP_TOL 0.75 -> 1.0` re-aims engine and AI in one edit (all four sites read
the same constant). But **at 1.0 the requirement is unreachable**, and that is the
part the handoff did not know:

`_sweep_delivery_probe.js` (new) walks a scripted arc and reports what the engine
actually banks. The scripted arc delivers faithfully — ratio 1.000-1.006 — but the
sweep **PEAKS INSIDE the completion radius** and unwinds before the departure test can
see it. The ideal path's exit tangent lies inside `zone*1.25`, so on arctic the boat
banked **3.44 rad against a 3.40 requirement and had only 2.97 left** by the time she
was far enough out to be asked. With 0.75 there was slack to absorb that; at 1.0 there
is none. So the fix is a PAIR:

    ROUND_SWEEP_TOL = 1.0        the rule states no tolerance
    rs.roundBanked               a rounding, once made, stays made — the string is
                                 drawn over her whole track, so the wrap is a fact
                                 about the track, not about where she is standing when
                                 the departure test fires. Half a turn of reversal
                                 clears it (she really can sail back round the other way).

**Correctness, measured (`_rounding_truth_probe.js`, 8 seeds):**

    ARCTIC   short of the requirement   81% -> 0%      median fraction 0.83 -> 1.77
             closest approach            0.84 -> 0.39 zone radii
    BAY      under 80% of it             20% -> 0%     min fraction 0.74 -> 0.99

**Pace, honestly:**

    bay 20-seed   fin med 255 -> 251, paired +2 med / +2.7 mean
                  boat rubs 1.67 -> 1.20, land 0.12 -> 0.04, pens 0.39 -> 0.37
    seatrials     198.77/194.53 pen 0.31 OCS 13.33% — UNCHANGED. Clubhouse has no
                  rounding mark, so the change is correctly scoped to rounding legs.
    arctic 16     med 412 -> 518, finishers 143 -> 135, IN-TIME 76 -> 33,
                  paired -83 med / -87.1 mean

Bay gets faster while rounding honestly. **Arctic pays 87 seconds a boat**, which is
the size of the cheat on that venue and is reported, not rejected, per the owner's
instruction. Whether any of it is recoverable is the next question — see the exit-latch
probe below.

## `test_rounding_string.js`: 2 failures -> 1, and the survivor is the FIXTURE

The remaining line is "a FULL rounding well outside the zone still completes" at 2.5
zone radii on arctic. **That circle is not water.** `_stray_cause_probe.js` (new):
`collision_island` 230 and `collision_boundary` 143 in a single scripted arc, the boat
displaced up to 1100 units in one frame, and she banks 0.968 of the arc she was told to
sail. `_string_rule_check.js` (new) sweeps the radius on any venue:

    BAY     0.8z 1.0z 1.5z 2.0z 2.5z 3.0z   all pass, delivery 1.001-1.006, 0% off water
    ARCTIC  0.8z 1.0z 1.5z pass;  2.0z 2.5z 3.0z fail, delivery 0.990/0.968/0.952,
            with 62%/49%/50% of the circle on land

So the engine has NO proximity requirement — proven to 3.0 zone radii on open water,
which is what that test line exists to guarantee. Passing it on arctic would need a
3.2% tolerance, which is the thing being removed. The test was not edited.

## A, continued — WHERE THE ARCTIC 87 SECONDS ACTUALLY WENT

`_round_cost_probe.js` (new) separates "sailing the arc she used to skip" from
"grinding". Arctic, 6 seeds, per rounding passage:

                        HEAD      tolerance fix
    time in the ring    50.1s     142.5s
    distance sailed     4892u     11360u
    sweep banked        1.73 rad  3.28 rad
    mean speed          92.4      84.3 u/s
    WANDER RATIO        2.37      4.56      (1.0 = a circle sailed cleanly)
    passages over 60s   39%       94%

Sweep +90%, distance +132%, speed barely down. **She is not sailing further round,
she is wandering** — so a real share of the cost was AI, not honesty, and two
re-aims took it back:

    +12 med paired   the AI's exit turn reads the ENGINE's banked flag instead of
                     recomputing a discounted threshold and adding a 0.25 buffer
    +26 med paired   the leg completes when she has LEFT THE ZONE (18.2(b)'s own
                     boundary), not at 1.25x it — 213 units of extra outbound
                     orbit on Glacier Sound
    net              arctic -87 -> -50 med paired vs HEAD; finishers 135 -> 140,
                     in-time 33 -> 42. Bay improved too: 251 -> 250, mark
                     contacts 0.41 -> 0.33.

⛔ **NOT the orbit radius.** `_orbit_radius_probe.js`: the AI orbits at 0.85z =
723 against the planner's own `_roundR` = 713, and **no radius round that island
is clean** — 49-71% water at every radius from 0.6z to 1.4z. It is drifting ice
in the ring, not a mis-set constant. Do not re-tune the orbit radius on this
evidence.

## THE STRONGER CORRECTNESS TEST — `_string_truth_probe.js` (new)

The swept-angle threshold is a PROXY and it is wrong in both directions: too
lenient when she approaches off the mark's beam (the straight-line approach banks
bearing change she never spent rounding anything), too strict when she approaches
straight at it. The rule is a WINDING condition, and winding is a homotopy
invariant — over a leg it takes one of exactly two values 2*pi apart, so the
classifier has a full pi of margin and needs no tolerance:

    required = signed angle from (mark -> where she began the leg) to
               (mark -> the next mark), the required way round, in (0, 2pi]
    actual   = roundSweep + the short-way sweep still to come
    ROUNDED iff actual >= required - pi

Arctic completed roundings whose string never wrapped the mark:

    HEAD                                    30%
    tolerance fix + latch                   19%
    + leave-the-zone completion              9%
    + latch give-back 0.5 rad not half a turn 4%

The 19%->4% step is worth reading: at half a turn of grace the latch was letting
boats complete after giving BACK 0.52-1.10 rad, with the winding saying flatly
that the string never wrapped (actual -0.03 against a required 6.25). The latch
exists to survive the 0.19-0.40 rad unwind of an exit through the ring; half a
radian covers that and nothing else.

## D. RULES 22 AND 23.2 — SPLIT, AND 23.2 IS REJECTED WITH A MECHANISM

Lifted from `treeH` (only the two rules hunks; treeH also predates the cosmetic
merge and would have reverted it). Gated ON TOP OF the rounding fix — which
matters, because the interaction is the whole story.

    bay 20 seeds, vs the rounding fix       fin med   rubs   pens   marks
    rounding fix (baseline)                 251       1.20   0.37   0.41
    + rule 22 only                          251  0/-0.2   1.21   0.37   0.41
    + rule 23.2 only                        254 -1/-3.0   1.77   0.43   0.57
    + 23.2 without the "another leg" clause  252  0/-3.3   1.68   0.46   0.58

⛔ **RULE 23.2 REJECTED at two scopings.** Dropping the leg clause did not save
it, so the clause is not the fault — **the mechanism is.** 23.2 is implemented as
a TAX ON DEVIATION near a protected boat, and deviation is the only tool this
planner has for not hitting her. Taxing it makes the fleet hit the protected
boats MORE: penalties 0.37 -> 0.46, rubs 1.20 -> 1.68. A correct 23.2 has to be a
constraint on FORCING HER TO CHANGE COURSE — which is item E's no-contact
detector — not a proximity cost. Do not retry it as a cost term.

⚠️ Note the interaction that made this visible: the first bay gate of the pair
read +1 med with rubs 1.67->1.52 on the OLD baseline. Once roundings became
honest, boats near a mark are far more often on different legs (one rounding it,
one leaving), so the same term fired across the whole mark area. **A change that
passed its gate before the rounding fix is not thereby passed now.**

Rule 22 (a boat AGROUND is avoided by everybody, Section D removing Section A
between them) measures INERT on both venues: bay 0 med / -0.2 mean, arctic +5 med
/ -3.1 mean. It is a rule the engine genuinely lacked and it costs nothing; it is
held for a re-gate on the final rounding tree rather than landed on this evidence.

## C. THE OBSTRUCTION MODEL — ✅ LANDED, and the premise needed one correction

The `openWaterKC` scope was doing **TWO** jobs, and that is why four changes stalled
on it. It gated the keep-clear (a)/(b) split AND chose the non-overlapped gap (110
on ice, 80 in open water). Unscoping both together is the -13 med paired that has
been read as "arctic rejects the rules work" four times. **Unscoping only the split
and leaving the ice gap alone is -3 med — nothing.** The split never needed
protecting from the ice; the 110-unit gap did.

Then **RRS 19.2(c)** pays for the rest. The overlapped keep-clear test is the WEAKER
of the two (a 60u swing off her centreline against an 80-110u gap), so switching it
on in floe-packed water let boats sail closer in the one place there is nowhere to
go. 19.2(c) says the boat squeezed between a rival and a continuing obstruction with
no room to pass is not entitled to room, keeps clear, and rules 10 and 11 do not
apply between them — read off the floe-stamped grid.

    arctic 9100  med 469 -> 468, in-time 42 -> 45, rounders 143 -> 144,
                 slowest finisher 262 -> 302,  paired -3 med / +5.9 mean
    arctic 9200  med 528 -> 497, in-time 24 -> 31, finishers 133 -> 135,
                 paired +19 med / +22.1 mean     (DISJOINT)
    arctic 32    in-time 66 -> 76, finishers 273 -> 275
    bay 20       250 med flat, paired 0 / -0.9, land 0.08 -> 0.05

Landed `bddf04b`. ⚠️ The lesson generalises: **when a change is scoped off a venue,
check what else the scope flag is switching.** This one hid a tuned constant behind a
rules gate for four sessions.

## E. THE NO-CONTACT FOUL — the premise is WRONG, and it is measured

The queue said the detector is too NARROW (3 fires per 72 bay boat-races against 2.0
contacts) and should be widened. `_foul_truth_probe.js` (new) reconstructs what would
have happened had the right-of-way boat held her proper course:

    bay, 12 seeds, shipped thresholds     4 fouls, 0 CORRECT (0%)
      gap on proper courses               med 568u, min 323u  (least favourable)
      gap on proper courses               med 454u, min 323u  (MOST favourable)
    bay, 12 seeds, dev 0.15 / hold 0.5    4 fouls, 0 CORRECT (0%)

**Every no-contact foul the build fires is against an encounter that would have passed
300-800 units clear.** The detector is not narrow, it is aimed at the wrong quantity:
it reads `lastAvoidDeviation`, which is the boat's TOTAL deflection from every cause
at once — a floe, a mark, a third boat, the arena wall — so a stand-on boat dodging
ice is recorded as having been FORCED by her give-way rival, and the rival is
penalised for it. Widening the thresholds multiplies wrong fouls; it cannot make a
right one.

The fix is attribution, not thresholds: compute the closest the two would come if she
sails her PROPER COURSE and the other boat holds hers — Keep Clear (a) verbatim, "the
right-of-way boat can sail her course with no need to take avoiding action" — and
require that to be inside a hull's width. With that guard the detector fires **0 times
in 12 bay races at BOTH threshold settings**, which is the honest answer: there are
currently no genuine no-contact infringements on that venue, because the fleet
over-avoids so thoroughly that nobody is ever actually forced.

### E, continued — the fix, and how much of the problem it reaches

⚠️ **`_foul_truth_probe` must count ONE PER EPISODE.** `triggerPenalty` fires its
event on every eligible frame and only converts it into a turn when the boat is not
already flagged, so raw event counts read 577 fouls in 8 arctic races against a real
rate near 1.5 a boat. Deduped on the flag (which is set AFTER the event, so it still
reads false on the frame that counts):

    ARCTIC, 8 seeds                    master    + need guard
    distinct no-contact fouls          46        27
    correct (contact threshold)        26%       33%
    correct (most favourable)          28%       44%
    median gap on proper courses       101u      70u

    BAY, 12 seeds                      4 fouls, 0 correct -> 0 fouls

The guard removes 41% of arctic fouls and the ones it removes are disproportionately
the wrong ones. ⚠️ **The residual is probably smaller than it looks**: the probe scores
"correct" against CONTACT (55u), while the engine's own keep-clear gap is 80-110u, and
the surviving fouls sit at a median 70u — inside the gap she is owed, so a boat forced
there arguably did need to act. Read 33-44% as a floor, not the number.

Pace: bay 249 med, paired 0 med / -0.9 mean, penalties 0.35 -> 0.33. Arctic 16-seed
0 med / -6.6 mean, rounders 144 -> 141. Judged on correctness per the owner's standing
instruction for this item; the disjoint arctic set is running.

## D. RULE 22 — ⛔ CLOSED AT FOUR IMPLEMENTATIONS, and the reason is the PREDICATE

Every reading of "a boat shall avoid a boat that is aground" was measured, and the
more faithfully it was implemented the WORSE it got:

    cost term only, bay (old master)             0 med / -0.2 mean
    cost term only, arctic (old master)         +5 med / -3.1 mean
    cost term only, arctic (final master)       -2 med / -5.3 mean
    OUT of the ROW evaluation only, arctic       0 med / -11.2 mean, in-time 45->38
    BOTH halves (out of ROW + avoided), arctic -11 med / -22.4 mean, in-time 45->37

**The rule is right; the predicate is wrong.** `iceEscapeTimer > 0 && speed < 1.0` is
not a boat aground in the RRS sense — it is a boat that touched ice half a second ago
and is executing a two-second escape, and on Glacier Sound that happens 583-713 times
per boat-race. Treating a boat who will be moving again in two seconds as a fixed
object, with a 130-unit exclusion zone, closes gaps the fleet needs; ALSO removing her
from the right-of-way evaluation (which the Section D preamble does require) deletes
the rules that were coordinating the pair, and the two together are the worst of all.

⇒ **Do not retry rule 22 until the engine has a real aground state** — grounded and
not moving for several seconds, distinct from contact-recovery. Without one there is
nothing for the rule to attach to. The Section D preamble reading is CORRECT and is
not what failed; the classifier under it is.

## STATE AT THE END OF THE 2026-08-05 OVERNIGHT PUSH

    HEAD           f6f89d5 + gitignore + log commits; tree CLEAN
    goldens        18/20, the two reds redrock's own (verified after re-record)
    npm test       7 failures — ⚠️ BYTE-IDENTICAL ON HEAD BEFORE THIS SESSION.
                   redrock's three deliberate reds, plus a bay AND redrock
                   "every leg registered / recognised the finish" stall in
                   test_sailable.js that predates all of this. NOT a regression;
                   worth someone's attention on its own.

    seatrials 100t 198.77 / 194.53, pen 0.31, OCS 13.33%, DNS/DNF 0
                   — UNCHANGED from HEAD to the printed precision. Clubhouse has
                   no rounding mark, so none of the rounding work touches it.

    bay 20-seed    `bay_bench_base3.json` (9100-9119)
                   fin med 249 mean 250.5, 180/180 finishers, min 211
                   rubs 1.28  land 0.00  mark 0.31  pens 0.34  OCS 0.0%
                   (HEAD was 255/254.6, rubs 1.67, land 0.12, mark 0.39, pen 0.39)

    arctic 32-seed `fleet_leg2_anchor0805A.json` + `...B.json` (9100-9115, 9200-9215)
                   rounders 283, finishers 275, in-time 74, med ~481
                   (HEAD was 286 / 281 / 137 / ~426)
                   paired vs HEAD: -67 med / -49.2 mean (A), -36 / -55.4 (B)

    human ref      arctic med 212.1 best 190.4, bay 229.1/220.5, seatrials 187.7/184.1

**Read the arctic row with the correctness rows next to it.** Roundings short of the
geometric requirement went 81% -> 0%; roundings whose taut string never wrapped the
mark went 30% -> the low teens; closest approach to the island 0.84 -> 0.39 zone radii;
NEVER-ENTERED-THE-ZONE 7% -> 0%. The fleet used to bank a rounding at Glacier Sound
without going round the island. It does not any more, and that costs about fifty
seconds a boat on that venue. Owner's standing instruction: report it, do not treat it
as a rejection.

    trees          treeBase = master. treeL = pre-session HEAD. treeB tracked, untouched.
                   treeR1..R7 (rounding ladder), treeM/M1/M2/M3 (mark-room),
                   treeC1/C2/C3 (obstruction), treeD1..D7 (rules 22/23.2),
                   treeE1/E2 (no-contact foul). All now gitignored.
    ⚠️ bench labels `base2` COLLIDED with a tracked baseline from an earlier session
       (`bay_bench_base2.json`, committed in 855379a). It was restored; this session's
       run is `bay_bench_0805base.json`. **Check `git status` after a bench run.**

## ⚠️ CORRECTION — THE STRING-RULE NUMBERS, MEASURED PROPERLY AT 12 SEEDS

The 4% figure quoted for the give-back commit was a SIX-seed measurement of an
intermediate tree. At twelve seeds (~108 completed roundings each) the ladder is:

    HEAD                                          33/108   31%
    the rounding work alone (treeR6)               2/108    2%
    + mark-room + RRS 19.2(c)   (treeC3)           9/108    8%
    + the no-contact need guard (master)          13/108   12%

**The rounding work alone gets it to 2%.** The two later commits drift it back to 12%,
and the mechanism is understood: neither touches the completion rule, but both change
the RACES, and `reqSweep` sits only about fifteen degrees above the true winding
boundary on Glacier Sound — so the half radian of give-back the latch allows can carry
a boat back across it. Every failing case sits within a few hundredths of a radian of
the boundary.

⚠️ **Six seeds is not enough for this statistic** — the same trap as arctic in-time
finishes. Read it at twelve or more.

---

# ⚡ QUEUE FOR THE NEXT SESSION (prepared 2026-08-05 04:0x)

## READ FIRST

1. **The rounding cheat is FIXED and the arctic price is real.** Do not "recover" it by
   loosening `ROUND_SWEEP_TOL`, `ROUND_GIVEBACK` or the completion radius — those are
   the cheat, in three pieces. Recover it by making the fleet SAIL the rounding better.
2. **`_string_truth_probe.js` is the correctness instrument now**, not the swept-angle
   fraction. Read it at 12+ seeds. The swept-angle proxy is wrong in both directions.
3. **A change that passed its gate before 2026-08-05 is not thereby passed now.** Rules
   22/23.2 both flipped sign once roundings became honest. Re-gate before believing.

## THE QUEUE

**A. THE ARCTIC WANDER — the biggest number on the board.** `_round_cost_probe.js`:
time in the ring 50s (HEAD) -> 117s (now), distance 4892 -> 8448u, **wander ratio 2.37
-> 3.89**. Sweep only went 1.73 -> 2.70 rad, so most of the extra distance is NOT arc,
it is wandering. That is where the ~50s a boat is. ⛔ It is NOT the orbit radius
(`_orbit_radius_probe`: the AI orbits at 0.85z=723 against the planner's own
`_roundR`=713, and NO radius round that island is clean — 49-71% water at every radius
from 0.6z to 1.4z; it is drifting ice). Candidates not yet tried: the orbit LEAD ANGLE
(0.85 rad, last A/B'd in the old world where ring time was a third of what it is now);
an orbit target that scans for a clear RADIUS the way the entrance and exit hunts scan
for a clear SECTOR; and giving the sweep phase the same time-cost routing the transit
gets.

**B. RULE 18's REMAINING HOLES, with tests.** 18.1(a)(2), **18.1(a)(3) "between a boat
approaching a mark and one leaving it"** (constant on these multi-leg courses and the
population rules 23.2 got wrong), 18.1(b), 18.2(c)/(d)/(e), **18.3 tacking in the
zone**, **18.4 gybing in the zone**. `test_markroom.js` is the model — and note how it
asserts its own preconditions, because two earlier versions passed on a broken engine.

**C. RULE 20 (room to tack at an obstruction) is still entirely absent**, as is "a boat
racing IS an obstruction to a boat required to keep clear of her". 19.2(a) and 19.2(b)
proper are absent too — only the `rule19Pairs` squeeze-detector and the new 19.2(c)
exist.

**D. A ROW UNIT TEST**, per the owner's standing request for small tests: tack from
local wind, leeward from local wind, clear-astern with divergent headings, rule 13's
port-side case. All four were wrong until 2026-08-04c and only a full-race probe
caught them.

**E. `test_sailable.js` IS RED ON BAY AND REDROCK AND HAS BEEN FOR A WHILE.** "every leg
registered — reached leg 4 of 7" and "the system recognised the finish". The ideal
path itself does not complete the course. That is a real bug in either the path or the
leg machinery and nobody has looked at it; it is not part of redrock's deliberate reds.

**F. NO REAL AGROUND STATE.** Rule 22 is closed at four implementations because
`iceEscapeTimer > 0 && speed < 1.0` means "touched ice half a second ago", not
"aground". Build a real one (grounded and not moving for several seconds) and rule 22
becomes implementable; until then it has nothing to attach to.

## HARNESS NOTES ADDED THIS SESSION

- `_string_truth_probe.js`   the winding of the track — the rule, not the proxy
- `_rounding_truth_probe.js` the swept-angle fraction — a proxy, keep for continuity
- `_round_cost_probe.js`     time/distance/wander per rounding passage
- `_string_rule_check.js`    the string rule across radii on any venue
- `_sweep_delivery_probe.js` what a scripted arc actually banks
- `_stray_cause_probe.js`    what displaces a boat off a scripted arc
- `_orbit_radius_probe.js`   is the orbit ring on water
- `_foul_truth_probe.js`     did the right-of-way boat NEED to adjust
- `test_markroom.js`         RRS 18 unit tests (wire into npm test when green)

⚠️ **Bench labels can collide with tracked baselines.** `base2` overwrote
`bay_bench_base2.json` from an earlier session. `git status` after benching.
⚠️ **`_foul_truth_probe` must dedup on `raceState.penalty`** — the penalty EVENT fires
every eligible frame, so raw counts read 577 where the real rate is ~1.5 a boat.

## ⚠️⚠️ CORRECTION TO THE CORRECTION — A COMMIT SILENTLY REVERTED AN EARLIER ONE

**`bddf04b` (the obstruction squeeze) put back the whole of `script.js` from `treeC3`,
which had been cloned BEFORE `1083ab6` (the give-back) existed — and so deleted
`ROUND_GIVEBACK` and restored the half-a-turn grace.** Caught at 04:46 when a `sed` for
the constant found nothing in master. Restored in `467c9dd`.

This is the campaign's own standing rule — **never move a whole file out of a tree
unless that tree is at HEAD** — and it cost a wrong diagnosis. The string-rule ladder
read 2% -> 8% -> 12% and that was attributed to the later commits changing the races.
Wrong: **8% and 12% ARE the half-a-turn numbers**, because the trees carrying those
changes predated the give-back. The corrected ladder, arctic, 12 seeds:

    HEAD                                         33/108   31%
    the rounding work alone (treeR6, 0.5 rad)     2/108    2%
    master WITH the give-back restored            6/108    6%
    [the half-a-turn builds that were measured   9-13/108  8-12%  <- not a real state]

⚠️ **What is and is not invalidated.** The A/B VERDICTS for the obstruction squeeze and
the no-contact guard stand — baseline and experiment both lacked the constant, so the
comparisons are internally valid. The ABSOLUTE anchor set measured between 01:56 and
04:46 does not: `bay_bench_base3` and `fleet_leg2_anchor0805A/B` were all taken on a
build missing the give-back. Re-measured as `anchorfixbay` / `anchorfixA` / `anchorfixB`.

## THE WINDING TEST — a ready candidate, NOT landed, and why

`treeW2` adds the rule itself as an AND alongside the swept-angle threshold: complete
only when the winding of her track actually wraps the mark (`roundSweep + short-way
remaining >= required - pi`), with `rs.roundWrapped` exposed so the AI's exit turn reads
it too. **That coupling is essential** — the engine-only version (`treeW1`) stranded 12
boats in 144, because the AI still turned for the exit on the banked flag alone and
sailed away from a mark she had not been round.

Measured ON THE REVERTED BASE (so these numbers need redoing before it lands):

    correctness   12% -> 2%   (arctic, 12 seeds)
    bay           248 med, 180/180, paired 0 med / -0.1 mean — neutral
    arctic 9100   paired 0 med / -21.8 mean, rounders 141 flat, finishers 140 -> 139
    arctic 9200   paired 0 med / -11.2 mean, rounders 142 -> 136, finishers 135 -> 129
    seatrials     198.79/194.53 vs 198.77/194.53 — Clubhouse has NO rounding entry
                  (route: line -> gate -> gate -> gate -> gate), so the +0.02 is field
                  declaration noise, not behaviour

**Not landed** because on the corrected base master is already at 6%, so the trade it
was going to buy (10 points of correctness for 7 lost finishers across 32 seeds) is
probably not the trade any more. Re-measure it against `anchorfix*` before deciding.
The tree is preserved.

## ✅ FINAL, CORRECTED ANCHOR — 2026-08-05, HEAD `7af74bd`

    goldens        18/20, redrock's two the only reds (re-recorded on 467c9dd,
                   redrock spliced from the ORIGINAL pre-session copy)
    npm test       7 failures, BYTE-IDENTICAL to HEAD before this session — not ours
    seatrials 100t 198.77 / 194.53, pen 0.31, OCS 13.33%, DNS/DNF 0 — UNCHANGED

    bay 20-seed    `bay_bench_anchorfixbay.json` (9100-9119)
                   fin med 250 mean 250.3, 180/180 finishers, min 211
                   rubs 1.19  land 0.08  mark 0.31  pens 0.33  OCS 0.0%
                   HEAD was 255/254.6, rubs 1.67, land 0.12, mark 0.39, pen 0.39

    arctic 32-seed `fleet_leg2_anchorfixA.json` + `...fixB.json`
                   9100: rounders 140 finishers 140 in-time 37 med 498 mean 523.5
                   9200: rounders 138 finishers 131 in-time 30 med 501 mean 523.5
                   paired vs HEAD: -80 med / -78.8 mean (A), -43 / -61.7 (B)
                   HEAD was 286 rounders / 281 finishers / 137 in-time / ~426 med

    CORRECTNESS    arctic roundings short of the requirement   81% -> ~0-7%
                   arctic string never wrapped the mark        31% -> 6%
                   arctic closest approach to the island       0.84 -> 0.39 zone radii
                   arctic never entered the zone at all         7% -> 0%
                   bay roundings under 80% of the requirement  20% -> 0%

**The trade, stated plainly.** Bay is faster and cleaner. Clubhouse is untouched. Arctic
pays about seventy seconds a boat and loses ten finishers in 288, and in exchange the
fleet actually sails round Glacier Sound's island instead of banking a rounding it
never made. That was the owner's explicit instruction for this item and it is reported,
not rejected. If the price is judged too high, the single lever is `ROUND_SWEEP_TOL`
and the whole thing reverses with it — but that lever IS the cheat.

## ⛔ THE ORBIT LEAD ANGLE IS NOT THE LEVER FOR THE ARCTIC WANDER

`_round_cost_probe` says most of arctic's extra distance is wander, not arc (ratio 3.89
against a clean circle's 1.0, while sweep only went 1.73 -> 2.70 rad). The orbit lead —
`aA = brgA + sgnA * 0.85`, last A/B'd in a world where ring time was a third of what it
is now — was the obvious re-test. Four variants, arctic 16-seed paired vs `anchorfixA`:

    lead 0.65                    -5 med /  -2.1 mean
    lead 1.10  (9100)            +1 med / +13.0 mean
    lead 1.10  (9200, DISJOINT)  +7 med /  -1.6 mean     <- does not replicate
    lead 1.35  (9100)            +6 med /  +8.8 mean
    lead = 0.85 + 0.5*(radius/zone)   (arctic 1.09, bay 0.89)
               (9100)           +19 med / +20.7 mean
               (9200, DISJOINT)  -1 med /  -2.5 mean     <- does not replicate

**Rejected in both forms.** The 32-seed combination is weakly pace-positive but
finishers go 271 -> 267 and in-time 67 -> 62, which fails the gate; bay rejects the flat
1.10 outright on contacts (land 0.08 -> 0.31, mark 0.31 -> 0.66 — on a 12-unit can a
large lead aims the boat through the mark). The geometry-scaled form was the principled
one and it is the one that most clearly did not replicate.

⚠️ **And it does not do what it was aimed at.** With the scaled lead the wander ratio
only moved 3.89 -> 3.70 and time in the ring went UP, 116.6 -> 128.4s. Whatever is
making the fleet wander round that island, it is not the lead angle. Next candidates
are elsewhere: an orbit target that scans for a clear RADIUS the way the entrance and
exit hunts scan for a clear SECTOR, or giving the sweep phase the same floe-aware
time-cost routing the transit already gets.

⚠️ **Third time tonight a 16-seed arctic result failed to replicate on the disjoint
set** (rules 22/23.2, lead 1.10, lead-scaled). On this venue a 16-seed pair is a SCREEN.

---

# ⚡ PLAN FOR A FRESH INSTANCE (prepared 2026-08-05 ~10:00, after the ocean/redrock pull)

## WHAT CHANGED UNDER US

Merge `20fb9b0` brought: a rewritten **ocean** cut, a rewritten **redrock** cut, and
**`regatta/js/swell.js`** (514 lines) with ~85 lines of call sites in script.js. Also
three new probes: `_swellmeasure.js`, `_ridetrace.js`, `_swellrace.js`.

⚠️ **The swell is scoped to ocean** — `Swell.active()` is false elsewhere and every call
site is behind it — so bay/arctic/seatrials should be byte-identical across the merge.
**VERIFY THAT FIRST** (one bay bench + one arctic bench against `bay_bench_anchorfixbay`
/ `fleet_leg2_anchorfixA`). If it holds, the anchors below survive the merge. If it does
not, everything measured on 2026-08-05 needs re-basing.

## SURVEY FINDINGS — measured this morning, NOT yet acted on

**1. `test_sailable` fails on bay, redrock and ocean; arctic passes.** Root cause found,
and it is in the CHECKER, not the game: `SailCheck.routeWaypoints` builds the rounding
arc as `steps = min(bestRun, 44)` at 5 degrees a step — **capped at 220 degrees**. The
winding those courses actually require:

    bay      legs 1,2,5   269 / 260 / 251 deg      legs 3,4   360 / 360 deg
    ocean    legs 1,2     248 / 286 deg
    redrock  legs 1,2,4   217 / 347 / 315 deg      leg 3      1 deg  (see finding 3)
    arctic   leg 1        360 deg   <-- passes anyway; the approach and departure legs
                                        of an out-and-back contribute the remainder

So the ideal path cannot deliver the sweep on any mark needing more than 220 degrees,
and the venue-authoring gate cries wolf on three venues — **including both of the new
ones, which is exactly when you need it to be trustworthy.**

**2. Same builder, second defect:** `bestStart` is chosen purely by open water, ignoring
which bearing the boat approaches from, so the approach can bank NEGATIVE sweep that the
rounding then has to undo. Observed on ocean: net sweep ranged **-113 to +8 degrees** —
the path winds the wrong way round the mark. The function's own comment names this
hazard and then does not guard against it.

**3. ⚠️ A REAL GAME BUG, on redrock, in `CoursePath.requiredSweep`.** It ends with
`if (sweep < 0.2) sweep = Math.PI * 2;` — a degenerate-geometry guard. **Redrock leg 3's
mark is nearly collinear with its neighbours: the winding the course requires is ONE
DEGREE.** The guard fires and the engine demands **184 degrees** of sweep at a mark that
needs almost none, so a boat sailing the natural line can never complete that leg. This
is engine code, it affects real races, and it is the first thing to fix after the gates.
⚠️ Do not just delete the guard — it exists because a genuine out-and-back also reads as
near-zero winding. The two cases have to be told apart (an out-and-back has the previous
and next anchors in nearly the SAME place; a collinear pass-by has them on OPPOSITE
sides).

**4. Redrock's marks are fixed in the new cut** — all four legs now report 360 degrees of
open water (leg 1 at 142u, the rest at 64u). The old cut had three planted in rock.
`_redrock_marks.js` is the probe; it sweeps radii properly, unlike `test_sailable`'s
single buoy-sized 64u check, which is why the two disagree on island marks.

**5. The two courses are DISTANCE courses, and nothing in the AI has been gated on one.**

    ocean    gate/start -> round -> round -> gate/finish     191,389 navigable cells,
             seamount mark carries a 1000-unit zone
    redrock  gate/start -> round -> round -> round -> round -> gate/finish   4,015 cells

Every bench in this campaign is a lap course. No leg repeats on either of these.

## ⚡ THE BIG ONE: THE SWELL IS A WORLD THE AI CANNOT READ

`swell.js` adds four physical effects, each derived rather than tuned:

    1. YAW        applied on top of the heading the controller just chose
    2. poundMul   multiplies TARGET speed upwind — makes footing worse than pointing,
                  which is why a seaway is sailed higher than flat water
    3. surfKt     added to ACTUAL speed down a face — puts the boat where its own polar
                  cannot go, and trips the planing state machine
    4. drift      orbital velocity on the ground track — sets you to leeward while the
                  log reads the same

**The AI models none of them.** `getStrategicHeading`/`scoreTack` choose an angle from
the POLAR and the wind. In a seaway the polar is no longer the boat's speed: it is wrong
upwind by `poundMul` and wrong downwind by `surfKt`, and neither error is uniform across
angle — which is precisely what makes the correct angle different. There is no wave-phase
term at all, so the AI cannot choose an angle that catches and holds a set, and the
leeward drift is uncompensated (the AI's leeway correction is built for current, not
orbital velocity).

On the venue whose whole identity is *the long surf home*, the fleet will sail it like
flat water. **This is the largest single AI gap on the board and it is brand new.**

## THE PLAN, IN ORDER

**PHASE 1 — MAKE THE VENUE GATE TRUSTWORTHY (half a day, no game code).**
Fix `routeWaypoints`: sweep the winding the course actually requires (`CoursePath`
already computes it) instead of a flat 220-degree cap, and choose `bestStart` from the
approach bearing rather than from open water alone. Then `test_sailable` becomes a real
authoring gate for the two new venues instead of noise. ⚠️ Redrock's and bay's failures
should CLEAR; if one does not, that residue is a genuine course defect and worth a shout.

**PHASE 2 — THE DEGENERATE `requiredSweep` GUARD (engine, small, testable).**
Tell an out-and-back from a collinear pass-by and require the right thing for each. Write
the test first, in the style of `test_markroom.js` — hand-placed geometry, asserted
preconditions, no races. Gate on bay + arctic (must be inert) and redrock (must change).

**PHASE 3 — MEASURE THE AI IN THE SWELL BEFORE CHANGING IT.** `_swellmeasure.js` already
drives the real `updateBoat` at held wind angles with the sea on and off; it is the right
instrument and it exists. Build the AI-facing version: for a fleet on ocean, how far is
the angle the AI chooses from the angle that is actually fastest IN THE SEA, upwind and
down? And what fraction of the downwind leg is spent on a face versus climbing one? That
number is the size of the prize and nothing should be tuned before it exists.

**PHASE 4 — THE AI IN THE SWELL.** Expected shape, to be confirmed by Phase 3, not
assumed: upwind the polar needs the pound multiplier folded in before VMG is taken, or
the AI foots when it should point; downwind it needs a wave-phase term so it sails to
catch and hold rather than to a static angle. ⚠️ **The downwind-angle family is CLOSED at
six rejections on bay** — do not reopen it there. This is a different mechanism on a
different venue and must be scoped to `Swell.active()` so it cannot touch the anchor.

**PHASE 5 — PRESSURE.** Bluewater Bonanza's design question is *"where will the pressure
be an hour from now"*, and with shiftiness 0.05-0.2 pressure is the ONLY tactical lever
there. `scoreTack` has a pressure term and `pressureSense` scales it per archetype, but
neither has ever been measured on a venue where it decides the race. Probe first.

**PHASE 6 — CARRY-OVER FROM 2026-08-05.** The winding-test candidate (`treeW2b`), the
arctic wander (ratio 3.89, and it is NOT the orbit radius or the lead angle — both
eliminated with measurements), rules 18.3/18.4/20, and a ROW unit test. All are described
in the previous queue section, which stands.

## STATE

    HEAD           20fb9b0 (my work 7dcbf76..0a12b94, then the owner's merge)
    anchors        bay `bay_bench_anchorfixbay.json` 250 med / 250.3 mean, rubs 1.19,
                   land 0.08, mark 0.31, pens 0.33, 180/180
                   arctic `fleet_leg2_anchorfixA/B.json` rounders 140+138,
                   finishers 140+131, in-time 37+30, med 498/501
                   seatrials 198.77 / 194.53, pen 0.31, OCS 13.33%
                   ⚠️ ALL MEASURED PRE-MERGE — verify against the merge before use
    goldens        18/20 pre-merge (redrock's two). The merge rewrote redrock and ocean,
                   so those four traces WILL differ; re-record and splice redrock.
    in flight      `treeW2b` (winding test on the corrected base) — bay 248 med,
                   180/180, paired 0 med / -0.2 mean; **12-seed string truth came back
                   1/108 = 1%, against master's 6%** — the best correctness measured on
                   this venue and it is bay-neutral.
                   **BOTH ARCTIC SETS ARE NOW IN, AND IT REPLICATES:**

                       9100  paired 0 med / -7.9 mean, rounders 140->139, fins 140->137,
                             in-time 37->35
                       9200  paired 0 med / -4.5 mean, rounders 138->138, fins 131->130,
                             in-time 30->27          (DISJOINT — it replicates, which
                             three other results last night did not)
                       32    rounders 278->277, finishers 271->267, in-time 67->62
                       bay   248 med, 180/180, paired 0 med / -0.2 mean
                       correctness  6% -> 1% of roundings whose string never wrapped

                   ⇒ **THE DECISION IS FULLY MEASURED AND I RECOMMEND LANDING IT.** The
                   trade is 4 finishers in 288 and ~6s of mean, with the MEDIAN FLAT on
                   both sets, in exchange for five sixths of the remaining fake
                   roundings. That is the trade the owner asked for in as many words
                   ("cheating is worse than losses in time"), and it is a far better one
                   than the version measured on the reverted base (7 finishers for
                   12%->2%). Not landed here only because a fresh instance is taking
                   over and two hands on the same file is how the give-back got reverted.
                   `treeW2b` is ready; it is a straight copy of its script.js once the
                   merge has been verified inert on arctic. Logs in the session
                   scratchpad as w2bA/w2bB/st_w2b; re-run rather than trust them if the
                   merge moved bay/arctic at all.
    new probes     `_sailable_stall_probe.js` (why a leg stalls on the ideal path),
                   `_side_check.js` (authored mark side vs the winding the course needs)

---

# 2026-08-05 AFTERNOON SESSION — VERDICTS AS THEY LAND

## ✅ THE MERGE IS INERT ON BAY AND ARCTIC (10:15)

`bay_bench_mergechk.json` (20 seeds, 9100) is **byte-identical** to
`bay_bench_anchorfixbay.json`; `fleet_leg2_mergechk.json` (16 seeds, 9100) is
**byte-identical** to `fleet_leg2_anchorfixA.json`. The swell is scoped to ocean as
claimed. **Every anchor in the handover plan survives the merge and needs no re-basing.**

Method note: candidate trees are now built by `regatta/eval/rl/mktree.sh`, which copies
the code and SYMLINKS `assets/`. A `cp -R regatta ...` into `regatta/eval/rl/` recurses
into itself and `eval/` is 100 GB.

## ✅ PHASE 1 LANDED — `805889c` — the venue gate is trustworthy again

`test_sailable`: **7 failures -> 0, all ten venues.** All three failing venues were the
CHECKER's fault, and the new `_sailable_stall_probe.js` says which of the engine's
conditions was still false when the ideal path ran out. Three defects, compounding:

    roundingArc asked ONE radius (mark.radius + clearance) — the buoy, not what it is
      planted on. Bluewater's mark is a seamount: 0deg of water at 64u, i.e. "cannot be
      rounded", when the truth was "wrong radius". Now searches out to zone*0.92 and
      takes the tightest all-water circle:  ocean leg 1  0deg@64u -> 360deg@742u
    the arc swept a flat 220 deg — four of the eleven authored rounding legs need more
    the approach was RADIAL on the most-open bearing, ignoring where the boat came
      from, so it banked NEGATIVE winding the rounding then had to undo: bay leg 3
      trough -84 deg against a 183 requirement, ocean leg 1 ranged -113..+8

Replaced with tangent in / the arc the geometry requires / tangent out — the shape
`CoursePath.requiredSweep` is itself derived from, so checker and engine now agree by
construction. Game-inert: `routeWaypoints` and `roundingArc` have no runtime consumers.

## ⚠️ FINDING 3 OF THE HANDOVER SURVEY IS A MISDIAGNOSIS — measured

`_sweep_rule_check.js` prints, for every authored rounding leg, the raw tangent arc, what
`requiredSweep` returns, and the string rule. **The `sweep < 0.2` guard fires on NO leg of
NO venue today.** Redrock leg 3's 184 degrees is the tangent formula's ordinary output.

And its 1 degree is not the winding the course requires — it is the SUBTENDED ANGLE at
the mark between the previous and next anchors, which for that leg is 0.8 deg. Both
anchors lie in the SAME direction from the mark, at 4023u and 2688u: that is a HAIRPIN,
and the winding a hairpin requires is a full 360, not 1. The string rule reads 1 there
only because it is degenerate at subtend 0 — the answer is 0-or-2pi on sign noise, which
is the same reason the guard exists.

The real defect in that family is bigger and different: **the tangent formula measures
only the ARC, tangent to tangent, while the engine accumulates winding for the WHOLE
leg.** It is short by the two tangent legs' contribution at every mark:

    leg           bay1  bay2  bay3  bay4  bay5  ocn1  ocn2  rr1  rr2  rr3  rr4  arc1
    requiredSweep   92    83   183   183    74    89   107   46  171  184  139   195
    string rule    269   260   360   360   251   248   286  217  347  360  315   360

That is the documented "too lenient" bias. Not landed blind — it is a threshold change on
both anchor venues and it gets benched like one.

## ✅ THE WINDING TEST LANDED — `35d6e25` — re-measured on the post-merge base

Reproduced from scratch (`treeW2c` = HEAD + the patch, byte-checked), not trusted from
the pre-merge logs:

    correctness   roundings whose string never wrapped the mark   6% -> 1%
    bay 20        248 med, 180/180, paired 0 med / -0.2 mean
    arctic 9100   paired 0 med / -7.9 mean, rounders 140->139, fins 140->137
    arctic 9200   paired 0 med / -4.5 mean, rounders 138->138, fins 131->130
    seatrials     inert by construction — no rounding leg in its route

Both arctic sets reproduce the pre-merge numbers to the boat.

## ⚠️ 11 EDITOR-TEST FAILURES CAME IN WITH THE MERGE

`npm test` now fails 11 lines, ALL in `test_editor.js` ("document loaded — 123 shapes",
"a typed course name is stored", the arena-corner floor, the wind-region arrows, "scaling
to 60% shortens the race by roughly 40% — 1.02x"). Verified byte-identical on the
pre-session HEAD with my changes stashed, so **they are not mine and they are not the
sailability failures** — those are gone. Flagging: they look like the editor tests
asserting against the OLD redrock document.

## ⚡ PHASE 3 — THE AI IN THE SWELL, MEASURED (11:00)

Four probes, all driving the game's own `updateBoat` and `update`: `_swellangle.js`
(VMG on a 2-degree grid of held true wind angles, sea on and off, 60 s each),
`_vmgangle_check.js` (the AI's optimiser against the polar table it reads),
`_swellrace_angles.js` and `_swellprize.js` (real races, the same seeds with the sea
switched off, binned by the angle actually sailed).

### THE HEADLINE NUMBERS

    UPWIND, held angle, 18 kt          flat        sea
      fastest angle                    38.5 deg    38.8 deg     <- the sea moves it 0.3 deg
      VMG there                        5.09 kt     5.20 kt
      the AI's optimiser says          38.0 deg -> costs 0.08 kt = 1.6%
      VMG at 60 deg                    4.42 kt     3.44 kt      <- footing costs 13% flat,
                                                                   34% in the sea
      leeward set                      0.03-0.14   0.37-0.63 kt

    DOWNWIND, held angle               flat        sea
      fastest angle                    163.9       165.5        <- the sea moves it 1.6 deg
      VMG there                        10.55 kt    13.99 kt     <- the sea is worth +33%
      the AI's optimiser says          180.0 deg   (11.31 kt)
      on a face at the AI's angle                  56%

    IN A REAL RACE (6 seeds, 54 boats, the same races with the sea off)
      upwind VMG made                  4.92 kt     4.35 kt      <- the sea costs 11.7%
      downwind VMG made                10.03 kt    12.17 kt     <- the sea pays 21.4%
      on a face                        0%          77%
      surfing                          0%          53%
      share of the race downwind                   47%
      finish, paired                   the sea makes her 5 s median / 1.7 s mean FASTER

### ⚠️ THE ANGLE ERROR IS NOT THE PRIZE, AND THE MEASUREMENT SAYS SO

Two corrections to the expected shape, both against my own first reading of the data:

**1. Upwind, folding `poundMul` into the VMG optimiser would do NOTHING.** The pound
multiplier is 0.968 at 38 deg and 0.920 at 56 — it costs speed, but it is almost flat
across the top of a sharply peaked VMG curve, so the optimum moves 0.3 deg. Measured, not
assumed. What the sea DOES do is make footing 2.6x dearer (13% -> 34% of VMG from 38 to
60 deg), and the AI's strategic layer already sails 38, so there is nothing to collect
there either.

**2. Downwind, the fleet is AT THE CEILING at the angles it sails.** The aggregate
comparison — fleet 12.17 kt against the best held angle's 13.99 — looks like a 13% gap
and is an artifact of mixing the angle distribution. Binned by the angle actually being
sailed, against the held-angle curve at the same angle:

    TWA    130   134   138   142   146   150   154   158   162   166   170   174   178
    held  9.02  9.28  9.62  9.93 11.01 12.60 13.66 13.87 13.92 13.99 13.05 11.38 11.27
    fleet 9.82 11.14 11.41 10.82  9.06 11.53 13.22 14.02 14.32 14.52 13.53 13.27 13.17

The fleet is at or above the ceiling in ten of thirteen bins. A boat moving through a
varying wind field and gybing catches waves a held angle does not. **The static
downwind-angle hypothesis is refuted on this venue.**

### ⚠️ A REAL BUG FOUND ON THE WAY, and it is NOT the swell

`getOptimalVMGAngle` searches only the polar table's own angle grid, and that grid is
`[..., 120, 135, 150, 180]` — **a 30-degree hole between 150 and 180.** So the optimiser
can only ever answer 150 or 180 downwind, and at 16 kt and above 180 wins:

    the table's own downwind VMG at 18 kt:  150 -> 8.04   165 -> 8.43   180 -> 8.18

The peak is at 165 at EVERY wind speed in the table and the optimiser can never return it.
Consequence on Bluewater (18 kt) and Redrock (16 kt): `optTWA = 180`, and the downwind
fetch gate is `absTWA < optTWA`, so **the boats never VMG-sail downwind at all** — the
gate cannot fail.

⛔ Do NOT fix this with a fine-VMG scan: that is one of the SIX closed rejections in
[[regatta-bay-density]] (−8 med, re-tested −3 bay / −8 arctic). The mechanism there was
that the geometrically-correct deeper line gains on its own leg and loses more downstream.
Anything here must be scoped to `Swell.active()`.

### WHAT THE MEASUREMENT DOES POINT AT

The one quantity where the AI is measurably blind and the size is real:
**0.37 kt of leeward set close-hauled, rising to 0.63 kt at 60 degrees, against 0.03-0.14
in the same water with the sea off** — and `getStrategicHeading` computes a crab angle for
the CURRENT and has never known about the sea. Over a 4000-unit leg at 8 kt that is ~250
units of set she never corrects for. Candidate `treeS1` is in flight.

### ⛔ `treeS1` REJECTED — crabbing for the sea's set (11:05)

Fold the swell's drift, low-passed over ~0.8 s to strip the orbital oscillation, into the
crab angle `getStrategicHeading` already computes for the current. Inert off Bluewater by
construction (`boat.swell` is null) — **bay 20-seed bench BYTE-IDENTICAL, confirmed.**

    ocean 9300   paired +2.5 med / 0.0 mean   pens 0.52->0.41   marks 0.56->0.33
    ocean 9400   paired +0.5 med / +0.1 mean  pens 0.41->0.44   rubs 1.71->2.31
       (DISJOINT — it does not replicate)

**MECHANISM:** the set is 0.4-0.6 kt against a hull doing 8 kt, so the crab is 3-4 degrees,
and the controller re-plans against the boat's ACTUAL position at 10 Hz. The cross-track
error a slow set builds is already being closed by feedback; feeding it forward as well
buys nothing and puts every boat on the same offset, which is why the rubs rose.

**Generalise:** feed-forward compensation for a SMALL, SLOW disturbance is redundant when
the controller closes the loop on ground truth faster than the disturbance accumulates.
Ask what the existing feedback already removes before modelling a disturbance.

### THE UPWIND BINS SAY THE SAME THING AS THE DOWNWIND ONES

VMG made good, binned by the angle actually sailed (8 seeds, sea vs the same races flat):

    TWA     29    31    33    35    37    39    41    43    45    49    53    61    69
    share  1.1%  1.6%  2.2%  1.5% 22.3% 23.3%  3.1% 11.5%  3.2%  4.1%  1.5%  2.9%  1.5%
    sea    4.82  3.90  4.19  4.52  5.06  4.95  4.54  4.30  4.18  4.09  3.56  3.03  2.21
    flat   5.31  5.06  5.21  5.32  5.60  5.49  5.07  4.88  4.80  4.73  4.27  3.56  2.93
    delta -0.49 -1.16 -1.01 -0.80 -0.55 -0.54 -0.53 -0.58 -0.62 -0.64 -0.71 -0.54 -0.73

The fleet spends 45.6% of its upwind time at 37-39 degrees — its own optimum, and the
held-angle ceiling there is 5.11 kt against the 5.06 it makes. **It is at the ceiling.**
And the sea's cost is a nearly FLAT 0.55 kt at every angle in a real race, where the
held-angle measurement showed it growing from 0.03 at 38 to 0.98 at 60. The difference is
that a racing boat is never held at 60 for long.

⇒ **There is no angle-choice prize upwind either.** The 11.7% the sea costs upwind is the
pinch mechanic working as designed, and the only lever against it is to sail less upwind,
which the course decides.

### ⛔ `treeS2` REJECTED — the fine downwind VMG angle, scoped to a running sea (11:20)

The polar table's 30-degree hole means the optimiser can only answer 150 or 180 downwind,
and above 16 kt it answers 180. `getFineOptimalVMGAngle` resolves the same objective on a
1-degree grid through `getTargetSpeed`, which interpolates — so it returns the table's real
peak (165) instead of the nearest rung. Scoped to `Swell.active()` because the unscoped
version is one of the six closed bay rejections. **Bay 20-seed bench BYTE-IDENTICAL.**

    ocean 9300   paired +2 med / +4.2 mean, med 225.5->218
    ocean 9400   paired  0 med / -5.4 mean, pens 0.41->0.51, rubs 1.71->2.41,
       (DISJOINT)         marks 0.36->0.65

**MECHANISM, measured directly** (`_fetchgate_probe.js`, 11772 downwind-branch samples):

    base:  FETCHING straight at the mark 100.0%   GYBE-SAILING 0.0%
           optimum angle used 180 deg at every single sample
           mean angle to the target 159.5 deg

So on Bluewater the boats never VMG-sail downwind at all — and the course points them at
159.5 degrees, which is 6 degrees off the sea's own best angle of 165.5. **The geometry was
already delivering the right angle.** S2 makes the gate fail whenever the target is deeper
than 165, the boats gybe instead of fetching, and the extra manoeuvres and traffic cost
more than the angle gains: rubs +41%, mark contacts +80%.

⇒ **The downwind-angle family is now closed at SEVEN rejections across THREE venues**, and
the mechanism is the same one bay found: the geometrically-correct deeper line gains on its
own leg and loses more downstream. It is not a flat-water artifact.

### ⇒ THE ANSWER TO "HOW BIG IS THE SWELL PRIZE": SMALL, AND HERE IS WHY

    the sea moves the best upwind angle      0.3 deg   -> nothing to collect
    the sea moves the best downwind angle    1.6 deg   -> nothing to collect
    fleet vs the held-angle ceiling, binned  at or above it in 10 of 13 downwind bins,
                                             and at it in the 45.6% of upwind time it
                                             spends at its own optimum
    downwind time on a face                  77% (the held-angle ceiling is 87%)
    what the sea is worth to the fleet       +5 s median on a 225 s race

The AI cannot read the swell, and on this course it does not need to: the two things it
could do about it are unavailable (the optimum barely moves) or already achieved by the
ordinary navigation loop. **Both candidates built from the measurement were rejected on
their disjoint sets, and both had a mechanism, not a shrug.**

⚠️ What would change this verdict is a DIFFERENT COURSE — one whose downwind leg does not
happen to point at 159 degrees. Bluewater's four legs are what make the angle question
moot; the finding is about this course as much as about this AI.

## ⛔ RETRACTED — "THE CHEAT IS STILL ALIVE AT HAIRPIN MARKS" WAS MY OWN PROBE'S BUG

`_string_realised_probe.js` (new) applies the string rule to the REALISED track. The
engine's own winding test has to PREDICT the rest of the leg at the moment the rounding
completes; this predicts nothing — it keeps accumulating the boat's winding about the mark
AFTER the leg completes, all the way to the next anchor, and then asks the rule.

    bay, 8 races, 246 roundings observed

      ORDINARY legs   119 roundings,   7 never wrapped the mark   (5.9%)
      HAIRPIN  legs   127 roundings, 103 NEVER WENT ROUND         (81.1%)

       leg  kind       n   never wrapped    realised winding p10 / med / p90 (deg)
         1  ordinary  72     5  (7%)            257 /  264 /  270
         3  HAIRPIN   56    55 (98%)              0 /    0 /    0
         4  HAIRPIN   71    48 (68%)              0 /    0 /  360
         5  ordinary  47     2  (4%)            249 /  250 /  251

⛔ **THE NUMBERS ABOVE ARE WRONG AND THE CAUSE IS THE PROBE.** It closed each record when
the boat came within a zone-radius of the NEXT anchor — and on an out-and-back the next
anchor is where she came FROM, so at leg start she was already sitting on top of it and the
record closed on frame one with a winding of exactly zero. That is why every hairpin leg
read exactly 0 at p10, median AND p90, and why arctic read 72 of 72. **A statistic that is
exactly zero at every percentile is not a finding, it is a bug**, and it should have been
caught before the entry below was written rather than twenty minutes after.

The probe now ARMS on leaving (`dn > closeAt * 2.5`) before it can close. Corrected
numbers below. Kept in the log rather than deleted, because the failure mode — a proximity
close whose predicate is already true at the moment the record opens — will recur.

**A realised winding of ZERO would be a boat that sailed up one side of the mark and back
down the same side.** She banks the required 183 degrees on the far side, the leg completes
there, and she unwinds every degree of it on the way home. The mark was on her left going
up and on her right coming back — she never left it on the required side at all.

### WHY 183 AND NOT 360 — the mechanism

`CoursePath.requiredSweep` measures the ARC between the two tangent points and nothing
else, while the engine accumulates winding for the WHOLE leg. At an ordinary corner the
difference is a bias; at a HAIRPIN it is the whole answer. A windward mark is the textbook
case: you arrive from the south and leave to the south, so you must pass on one side and
return on the other, and your bearing about the mark sweeps a full turn. The tangent
arithmetic reads 2*pi minus the two tangent half-angles — about 180 — and the guard that
was supposed to catch degenerate geometry (`sweep < 0.2`) fires on the OPPOSITE case, a
collinear pass-by, and on no leg of any authored venue.

`treeH1` tells the two apart by where the anchors are (subtend < 14 deg = hairpin =>
2*pi). Authored courses sit at 0.0-0.8 deg and the nearest non-hairpin leg is at 12.6, so
the classes are cleanly separated. Affects bay legs 3 and 4, arctic leg 1, redrock leg 3.
Benching now — this is a THRESHOLD change on both anchor venues and it gets treated as one.

## ⚠️⚠️ REDROCK IS NOT RACEABLE — 1 FINISHER IN 72 BOAT-RACES

The new cut passes `test_sailable` (the IDEAL path completes it), so a perfect sailor can
sail it. The fleet cannot. 8 races, cutoff raised to 900 against the venue's authored 360:

    finishers                    1 of 72
    furthest leg reached         leg 3: 56 boats   leg 2: 6   leg 4: 6   leg 5: 3
    land collisions              236.9 per boat-race     (bay 0.08, arctic 25-33)
    boat rubs                     17.7 per boat-race     (bay 1.2)
    penalties                      4.35 per boat         (bay 0.33)
    navigable cells                4015                  (bay 36174, arctic 18525,
                                                          ocean 191389)

Fifty-six of seventy-two boats die on **leg 3 — the hairpin**, which is the same leg the
handover flagged. The water is a thin web: at 50-unit cells and hull-width clearance,
4015 cells is an order of magnitude less room than any venue the AI has ever sailed.

**This is an authoring decision, not a bug to fix in the AI**, and it is the owner's call:
either the channels widen, or Redrock is a specialist venue the current fleet cannot race.
Reporting it rather than quietly tuning around it.

## ⛔ RULES 18.3 AND 18.4 ARE NOT WORTH IMPLEMENTING — the predicate, measured first (11:45)

The campaign has already spent four implementations on rule 22 before discovering its
predicate was wrong. So this time the predicate was counted before a line was written.
`_rule18_incidence.js`, bay, 6 races, 54 boat-races, verbatim rule text from the
2025-2028 PDF (not a paraphrase):

    18.3  "If a boat passes head to wind from port to starboard tack in the zone of a
           mark to be left to port, rule 18.2 does not apply between her and another boat
           on starboard tack that is FETCHING the mark."

           head to wind port->starboard inside a port mark's zone     7 events
           ...of which with a starboard boat fetching — THE RULE      1 event
                                                                     0.02 per boat-race

    18.4  "When an inside overlapped right-of-way boat must gybe at a mark to sail her
           proper course, until she gybes she shall sail no farther from the mark than
           needed to sail that course."

           inside boat at a mark whose proper course needs a gybe     0.7 s per boat-race

**One event in fifty-four boat-races, and seven tenths of a second.** Neither can move a
bench, and neither is worth the risk of touching the mark-room path that three corrections
landed on yesterday. Rule 20 was not even counted: it needs a hail mechanism, and its
predicate is a subset of 18.3's — close-hauled, at an obstruction, with a boat to windward.

⇒ **These three go on the "correct but inert" list, not the queue.** If a future venue
authors a windward mark with a crowded zone the count changes and this probe re-runs.

## ⚡ `requiredSweep` IS THE TWO-CLASS BOUNDARY, BY CONSTRUCTION — not a sloppy proxy

Laying the three columns side by side (`_sweep_rule_check.js`) makes the relationship exact
rather than approximate:

    leg          bay1 bay2 bay3 bay4 bay5 ocn1 ocn2  rr1  rr2  rr4 arc1
    requiredSweep  92   83  183  183   74   89  107   46  171  139  195
    string rule   269  260  360  360  251  248  286  217  347  315  360
    string - 180   89   80  180  180   71   68  106   37  167  135  180

The tangent arc is `string - beta_P - beta_Q`, and both tangent half-angles go to 90 degrees
as the anchors get far away — so **the tangent formula IS `string - pi`, which is exactly
the boundary of the two-class decision the string rule poses.** The two outliers (ocean
leg 1 at +21, arctic at +15) are the two marks with big bodies, where the half-angles are
visibly less than 90.

That is worth stating plainly because it changes what `treeH1` is. It is NOT a bug fix: the
threshold is already the right classifier. H1 asks for the WHOLE circuit at a hairpin
instead of the halfway point — a strictly stronger demand — and it is only worth its 8.5 s
if boats that cross halfway do not in fact finish the turn. That is what the corrected
realised-track probe is for.


## ✅ THE CORRECTED HAIRPIN NUMBERS — the cheat is NOT alive there (11:50)

With the probe armed properly (`_string_realised_probe.js`), bay, 8 races, 197 roundings
whose record closed:

       leg  kind       n   never wrapped    realised winding p10 / med / p90 (deg)
         1  ordinary  72     5  (7%)            257 /  264 /  270
         3  HAIRPIN   56     2  (4%)            355 /  357 /  358
         4  HAIRPIN   17     2 (12%)             -2 /  358 /  360
         5  ordinary  52     3  (6%)            247 /  250 /  251

       ORDINARY  124 roundings,  8 never wrapped   (6.5%)
       HAIRPIN    73 roundings,  4 never wrapped   (5.5%)

**The boats deliver 357 degrees at a mark the threshold only asks 183 of.** They go round.
The threshold is the halfway boundary and they sail past it — which is exactly what the
two-class argument predicts and what my artifact had hidden.

⇒ **`treeH1` is REJECTED.** Bay pays **8.5 s of paired median and 9.0 of mean** (180/180
finishers, pens 0.36 -> 0.32) to take a class that is already 94.5% correct to about 100%,
i.e. bay's overall 6.1% -> 4.1%. Against that, the winding test landed this morning bought
6% -> 1% for ZERO median. Wrong end of the curve, and it is not close.

⚠️ The realised-track criterion is STRICTER than the engine's own predicted one: 6.5% of
ordinary bay roundings fail it against the 1% the in-engine test reports. The difference is
boats whose prediction was true at the moment of completion and who then turned back — the
engine cannot wait for the end of the leg to decide the leg is over, and that residue is
the honest cost of an online test. It is the right next target for correctness work, and it
wants a mechanism other than raising the threshold.

---

# ⚡ WHERE THIS SESSION LEFT IT (2026-08-05 afternoon)

## LANDED

    805889c  the venue gate — test_sailable 7 failures -> 0 on all ten venues
    35d6e25  the winding test — roundings whose string never wrapped 6% -> 1%
    b50cf58  goldens re-recorded, PASS 20/20, plus four sea probes
    dd5a878  check_raceable.js — the gate test_sailable is not

## REJECTED, EACH WITH A MECHANISM

    treeS1  crab for the swell's steady set     +2.5 med on one ocean set, +0.5 on the
                                                disjoint one; the 10 Hz nav loop already
                                                closes a 3-4 degree feed-forward error
    treeS2  fine downwind VMG in a sea          +2 med / +4.2 mean on one set, 0 / -5.4 on
                                                the disjoint one; the extra gybes cost more
                                                than the angle gains  => SEVENTH rejection
                                                of the downwind-angle family, third venue
    treeH1  a full circuit at a hairpin         bay -8.5 med to take a 94.5%-correct class
                                                to 100%; wrong end of the curve
    18.3 / 18.4                                 predicate measured FIRST: 1 event in 54
                                                boat-races, and 0.7 s per boat-race

## THE THREE THINGS A FRESH INSTANCE SHOULD KNOW

**1. REDROCK IS NOT RACEABLE AND IT IS THE OWNER'S CALL.** 1 finisher in 72 boat-races,
237 land collisions per boat-race, 4015 navigable cells against bay's 36174. `test_sailable`
passes it because an ideal path CAN sail it. `check_raceable.js redrock` fails it 0/18.
Do not tune the AI around this; the course wants wider water or a different fleet.

**2. THE SWELL PRIZE IS SMALL, AND THAT IS A MEASUREMENT, NOT A SHRUG.** The sea moves the
best upwind angle 0.3 degrees and the best downwind angle 1.6. Binned by the angle actually
sailed, the fleet is at or above the held-angle ceiling in ten of thirteen downwind bins and
at it in the 45.6% of upwind time it spends at its own optimum. ⚠️ The verdict is about
BLUEWATER'S COURSE as much as the AI: its legs happen to point at 159.5 degrees against a
best-in-sea 165.5. A course whose run does not would re-open every question here.

**3. THE NEXT CORRECTNESS TARGET IS THE ONLINE-vs-REALISED GAP, NOT THE THRESHOLD.**
`requiredSweep` is exactly `string - pi`, the two-class boundary, and is right. But the
engine must decide the leg is over while the boat is still sailing it, and 6.5% of ordinary
bay roundings that pass the online test fail the REALISED one. Raising the threshold is the
wrong tool (that is what treeH1 was). It wants a mechanism that defers or revisits.

## OPEN, UNTOUCHED

- **11 editor-test failures** came in with the merge (byte-identical on the pre-session
  HEAD) — they look like `test_editor.js` asserting against the OLD redrock document.
- The arctic wander (ratio 3.89) — still the biggest known pace deficit, still unexplained.
- Rule 20 (room to tack at an obstruction): needs a hail mechanism, predicate not counted.
- Phase 5 (pressure): ocean authors dirVar 0.21 rad and speedVar 4 kt over a 120 s period,
  so there IS something to find there. Not probed.


---

## ⚡⚡ AND ON ARCTIC THE CHEAT IS STILL ALIVE — 56% (12:10)

The corrected probe splits the two venues cleanly, which the artifact had hidden:

    bay      hairpin legs   73 roundings,  4 never went round   (5.5%)
                            realised winding median 357-358 — THEY GO ROUND
    arctic   hairpin leg    72 roundings, 40 never went round  (55.6%)
                            realised winding p10 7 / MEDIAN 10 / p90 369 — BIMODAL

**Glacier Sound's island is the only rounding mark on the venue, and over half the fleet
never gets round it.** The distribution is the two classes the string rule predicts, 2*pi
apart, and 56% of the mass is in the wrong one.

### WHY ARCTIC AND NOT BAY — the mechanism

`reqSweep` accumulates from LEG START at any distance, and arctic's leg starts 5458 units
from a mark whose body is 405 units of rock. **A long off-axis approach banks bearing
change the boat never spent rounding** — that is the documented "too lenient when she
approaches off the mark's beam" bias, and on Glacier Sound the approach alone can deliver
most of the 195 degrees the threshold asks. She passes the island on one side, banks the
requirement from approach geometry, completes the leg, and comes back the same side. On
bay the anchors are 3741 units from a 12-unit buoy and the approach banks almost nothing,
so the same threshold bites properly.

⇒ **`treeH1` is the right change for the wrong reason I first gave it.** Not "the tangent
formula is short at a hairpin" (it is exactly `string - pi`, the correct boundary) but
"the boundary is unreachable-by-cheating only when the approach is short". Requiring the
full circuit removes the approach's contribution from the decision by construction.

Bay's price is 8.5 s of paired median for 5.5% -> ~0% on 37% of its roundings. Arctic's
is being benched. **The owner's standing instruction is that cheating is worse than losses
in time**, and 56% is not a residue.

## ANCHORS RE-CONFIRMED AT SESSION HEAD (11:20)

    seatrials 100t   198.79 / 194.53, pen 0.31, OCS 13.33%, DNS/DNF 0%,
                     min 174.15, max 360.00
                     (pre-session: 198.77 / 194.53, pen 0.31, OCS 13.33% — identical on
                      every figure but the mean, and seatrials has no rounding leg at all,
                      so today's rounding work is inert on it by construction)

## `treeH2` — THE BETTER MECHANISM FOR THE SAME PROBLEM (in flight)

H1 asks for a whole circuit at a hairpin. That is a blunt instrument aimed at a precise
defect, and it charges bay 8.5 s for a class bay already sails correctly. The defect is
this, exactly:

**`roundSweep` accumulates from LEG START at any distance.** That is right for the SIDE
judgement — the sign carries it — and wrong for the magnitude, because a long off-axis
approach banks bearing change the boat never spent rounding. It is the documented "too
lenient when she approaches off the mark's beam" bias, and Glacier Sound is its worst case:
5458 units of approach to a 405-unit island.

So H2 re-bases the accumulator on ARRIVAL instead: the first time the boat comes within
`zone * 2`, `roundSweep` resets to zero and `roundFrom` moves to where she is. Once per
leg — leaving and re-entering does not re-arm it, or a boat could shed a wrong-way
excursion by stepping outside and back. Everything downstream reads the same accumulator,
so the threshold, the winding test and the AI's exit latch re-base together.

Why it should be cheaper than H1: it is anchored on the mark's OWN zone, so it scales from
a 12-unit can to an 810-unit island with no second constant, and on bay — where the
approach banks almost nothing — it should be close to inert.

## ⚡⚡ `treeH1` ON ARCTIC: 56% -> 0%, FOR 21 SECONDS (11:25)

    CORRECTNESS (realised track, 8 races, 72 roundings)
      never went round        40 of 72 (55.6%)  ->  0 of 72 (0.0%)
      realised winding        p10 7 / med 10 / p90 369  ->  p10 366 / med 368 / p90 370

    PACE  arctic 9100 (16 seeds)
      paired                  -21 med / -26.6 mean over 131 boats
      finishers               137 -> 135        rounders 139 -> 140
      pens                    1.67 -> 1.74
    PACE  bay 9100 (20 seeds)
      paired                  -8.5 med / -9.0 mean, 180/180, pens 0.36 -> 0.32

**Every boat now goes all the way round the island.** The distribution is no longer
bimodal — it is a single class at 368 degrees, which is what a rounding is.

⚖️ **Judge it against the curve, not against zero.** The rounding work already accepted
cost arctic ~70 s a boat and 10 finishers in 288 to take "never wrapped the mark" from 31%
to 6%. This costs **21 s and 2 finishers in 144 to take arctic's only rounding from 56% to
0%.** That is a better trade than one the owner has already taken, on the venue where they
first reported the cheat.

Outstanding before it can land: the disjoint 9200 arctic set, and a comparison against
`treeH2`, which aims at the same defect with a sharper instrument.

## ⚡ `treeH2` IS FREE ON BAY — paired -1.0 against H1's -8.5 (11:30)

    bay 20 seeds     A = HEAD                  B = treeH2
      finish med     248.0                     248.0
      paired         -1.0 med / -0.3 mean over 180 boats
      finishers      180/180                   180/180
      boat rubs      1.31                      1.11
      mark contacts  0.38                      0.33
      penalties      0.36                      0.28

Eight times cheaper than H1 on bay, and it takes rubs, mark contacts and penalties DOWN
rather than up — which is what a change that makes boats round tighter and earlier should
do. Arctic's correctness and pace are the remaining question.

## THE THREE CANDIDATES SIDE BY SIDE (11:35)

                            bay pace      bay hairpin   arctic pace   arctic never
                            (paired)      wrong         (paired)      went round
    HEAD                    —             5.5%          —             55.6%
    H1  full circuit at     -8.5 med      ~0%           -21 med       0.0%
        a hairpin           -9.0 mean                   -26.6 mean
    H2  re-base the sweep   -1.0 med      1.5%          (in flight)   18.1%
        on arrival          -0.3 mean
    H3  both                (in flight)

**H2 is eight times cheaper on bay and buys two thirds of arctic's correctness.** It also
takes bay's boat rubs 1.31 -> 1.11, mark contacts 0.38 -> 0.33 and penalties 0.36 -> 0.28 —
a change that makes boats round tighter and earlier should do exactly that, and it does.

⚠️ **They are ORTHOGONAL and can be landed together**: H1 changes what the leg REQUIRES, H2
changes the WINDOW the requirement is measured over. H3 measures the pair.

### H1 ON THE DISJOINT ARCTIC SET — the finisher cost is heavier than 9100 said

    arctic 9200 (DISJOINT)   paired -23.5 med / -35.0 mean over 108 boats
                             finishers 130 -> 117     rounders 138 -> 130
                             pens 1.71 -> 1.99        22 finished in A only, 9 in B only

    combined 32 seeds        finishers 267 -> 252 (15 in 288), rounders 277 -> 270

The median holds at about -22 across both sets, but the FINISHER cost is 2 boats on 9100
and 13 on 9200 — the sort of disagreement between arctic 16-seed sets this campaign has
been bitten by four times, and the reason the standing rule is to read 32 seeds or the
paired median. Read as 15 finishers in 288.

⚖️ Against the precedent (~70 s a boat and 10 finishers in 288 to take 31% -> 6%), H1 is
**cheaper in time and dearer in finishers, for more than twice the correctness**. It is a
defensible trade on the owner's stated standard. Whether it is the RIGHT one depends on
what H2 achieves for almost nothing.

### H2 ON ARCTIC: same price as H1, a third of the correctness

    arctic 9100   paired -22 med / -20.7 mean over 129 boats
                  finishers 137 -> 134,  rounders 139 -> 142,  pens 1.67 -> 1.68
                  boat rubs 7.63 -> 7.31

**H1 and H2 cost arctic the SAME median (-21 vs -22) and H1 takes the cheat to 0% where H2
takes it to 18%.** So on arctic H1 dominates. The whole of H1's extra cost is on BAY, where
it charges 8.5 s against H2's 1.0 — and bay barely has the defect.

    UPDATED TABLE           bay pace   bay hairpin   arctic pace   arctic never
                            (paired)   wrong         (paired)      went round
    HEAD                    —          5.5%          —             55.6%
    H1  full circuit        -8.5       ~0%           -21           0.0%
    H2  re-base on arrival  -1.0       1.5%          -22           18.1%
    H3  both                (in flight)

That reframes the choice. It is not "which mechanism" — it is whether the last 18 points of
arctic correctness are worth 7.5 s of bay, since H2 gets the first 38 points for nothing.

### H3 (THE PAIR) ON ARCTIC CORRECTNESS: 2.8%

    arctic correctness   HEAD 55.6%  ->  H1 0.0%  ->  H2 18.1%  ->  H3 2.8%

H3's 2 of 72 against H1's 0 of 72 is inside sampling noise. **Both fix arctic; H2 alone
does not.** So the pair adds H2's cheaper, more principled measurement window without
giving up H1's correctness — pace on both venues in flight.

## ⚖️ THE FULL COMPARISON, AND THE CALL (11:50)

                       bay pace   bay hairpin   arctic pace   arctic fins   arctic never
                       (paired)   wrong         (paired)      (of 144)      went round
    HEAD               —          5.5%          —             137           55.6%
    H1 full circuit    -8.5       ~0%           -21 / -23.5   135 / 117     0.0%
       at a hairpin                             (9100/9200)
    H2 re-base the     -1.0       1.5%          -22           134           18.1%
       sweep on arrival
    H3 both            -17.0      0.0%          -56           126            2.8%

**H3 is DOMINATED — the two compound rather than complement.** H2 makes the requirement
harder to EARN (it must be won near the mark) and H1 raises the requirement itself, so
together they charge 56 s of arctic and 17 of bay for correctness H1 delivers alone.

**H2 is dominated ON ARCTIC** — the same 22 s as H1 for a third of the correctness. Its
virtue is bay, where it is nearly free and takes rubs, mark contacts and penalties DOWN.

⇒ **H1 is the recommendation, and it is the one I am landing.** Arctic pays about the same
whichever way it goes, so take the version that buys the whole fix. The rule it states is
statable rather than tuned — *a hairpin is a full circuit* — and it is the same trade the
owner has already accepted once, at a LOWER price:

    the rounding fix already accepted   ~70 s a boat, 10 finishers in 288, for 31% -> 6%
    H1                                  ~22 s a boat, 15 finishers in 288, for 56% -> 0%

⚠️ Bay pays 8.5 s for correctness it mostly already had (5.5% -> ~0%). That is the honest
cost of a rule that does not know which venue it is on, and it is the right way round: a
tuned per-venue scope is how a constant ends up hiding behind a rules gate — see the
`_floeObjs` story in [[regatta-obstruction-model]].

⚠️ **`treeH2` IS PRESERVED AND IS NOT A REJECTION.** Re-basing the sweep on arrival is the
correct measurement window and it is free on bay. It is parked because on arctic it does
not go far enough alone and stacks badly with H1. If a future session finds a cheaper way
to close arctic's last 18 points, H2 is the better base to build it on.

## ✅ LANDED `25137d6` — a hairpin is a full circuit (11:55)

    PRICE                   bay 9100   bay 9200   arctic 9100  arctic 9200
      paired median         -8.5       -10.0      -21          -23.5
      paired mean           -9.0       -13.7      -26.6        -35.0
      finishers             180/180    180/180    137->135     130->117
      penalties             0.36->0.32 0.33->0.43 1.67->1.74   1.71->1.99
      mark contacts         0.38->0.46 0.37->0.66 0.46->0.46   0.64->0.64

    CORRECTNESS  arctic 55.6% -> 0.0%   (realised winding p10 366 / med 368 / p90 370)
                 bay     5.5% -> ~0%

⚠️ **The penalty and mark-contact deltas DISAGREE between the two bay sets** — pens down on
one and up on the other, marks +0.08 against +0.29. Only the time cost replicates cleanly.
Reported rather than smoothed over; if the owner wants it reversed it is one revert.

`test_sailable` still passes 0/10. Ocean is untouched — neither of its rounding legs is a
hairpin. Goldens re-recording; seatrials re-checked.


---

# ⚡ FINAL STATE — 2026-08-05 afternoon session

## LANDED (7 commits of code, all with numbers in the message)

    805889c  the venue gate            test_sailable 7 failures -> 0 on all ten venues
    35d6e25  the winding test          roundings whose string never wrapped  6% -> 1%
    25137d6  a hairpin is a circuit    ARCTIC'S ONLY ROUNDING MARK  56% -> 0%
    2bfc90a  a comment correction      the sweep<0.2 guard answers a pass-by wrongly
    dd5a878  check_raceable.js         the authoring gate test_sailable is not
    e55c380  ...floes are not land     and the ceiling calibrated on the passing venues
    b50cf58  goldens + four sea probes
    a4bb4d5  goldens re-recorded       PASS 20/20 after the hairpin fix

## MEASURED AND REJECTED, EACH WITH A MECHANISM

    treeS1   crab for the swell's set    replicates on neither set; the 10 Hz nav loop
                                         already closes a 3-4 degree feed-forward error
    treeS2   fine downwind VMG in a sea  +2/+4.2 on one set, 0/-5.4 on the disjoint one;
                                         SEVENTH rejection of the downwind-angle family,
                                         and the first on a third venue
    treeH2   re-base sweep on arrival    dominated ON ARCTIC (same 22 s, 18% vs 0%) but
                                         nearly free on bay — PRESERVED, not rejected
    treeH3   H1 + H2                     dominated: they compound, 56 s of arctic
    18.3 / 18.4                          predicate counted BEFORE implementing: 1 event
                                         in 54 boat-races, and 0.7 s per boat-race

## THE THREE THINGS THE NEXT INSTANCE SHOULD KNOW

**1. REDROCK IS NOT RACEABLE AND IT IS THE OWNER'S CALL.** 1 finisher in 72 boat-races,
4370 shoreline collisions per boat-race, 4015 navigable cells against bay's 36174. It
PASSES `test_sailable` because an ideal path can sail it. `check_raceable.js redrock`
fails it 0/18. Do not tune the AI around this.

**2. THE SWELL PRIZE IS SMALL, MEASURED.** The sea moves the best upwind angle 0.3 degrees
and the best downwind angle 1.6. Binned by the angle actually sailed the fleet is at or
above the held-angle ceiling in ten of thirteen downwind bins. ⚠️ The verdict is about
BLUEWATER'S COURSE as much as the AI — its legs point at 159.5 degrees against a
best-in-sea 165.5. A course whose run does not would re-open every question here.

**3. THE NEXT CORRECTNESS TARGET IS THE ONLINE-vs-REALISED GAP.** `requiredSweep` is
exactly `string - pi`, the two-class boundary, and is right. But the engine must decide the
leg is over while the boat is still sailing it, and **6.5-8.7% of ORDINARY bay roundings
that pass the online test fail the realised one**. Raising the threshold is the wrong tool
— that is what H1 was, and it is why H1 costs bay 9 s for almost nothing. It wants a
mechanism that defers or revisits the judgement. **`treeH2` is the better base to build
that on**: re-basing the accumulator on arrival is free on bay and takes rubs, mark
contacts and penalties DOWN.

## OPEN, UNTOUCHED

- **11 editor-test failures** came in with the merge (byte-identical on the pre-session
  HEAD) — they look like `test_editor.js` asserting against the OLD redrock document.
- **Arctic's authored cutoff of 420 s no longer matches its fleet**: 4 of 18 finish inside
  it, and today's landing makes that worse. Either the cutoff is re-authored or the wander
  is fixed.
- The arctic wander (ratio 3.89) — still the biggest known pace deficit, still unexplained.
- Rule 20 (room to tack at an obstruction): needs a hail mechanism, predicate not counted.
- Phase 5 (pressure): ocean authors dirVar 0.21 rad and speedVar 4 kt on a 120 s period,
  so there IS something to find. Not probed.

### POST-LANDING VERIFICATION

    goldens     PASS — 20 traces, 0 behaviour changes, 0 new   (a4bb4d5)
    seatrials   198.79 / 194.53, pen 0.31, OCS 13.33%, DNS/DNF 0%, min 174.15, max 360.00
                — IDENTICAL to the pre-landing run, as it must be: seatrials' route is
                  line -> gate -> gate -> gate -> gate and has no rounding leg at all
    test_sailable   PASS 0 failures, all ten venues

---

# ⚡ OWNER SESSION — LIVE BUGS FOUND BY SAILING IT (2026-08-05 evening)

The owner sailed Bluewater and Redrock by hand and reported four things. All four were
real, three are fixed, and one of them was mine.

## ✅ 1. "The AI sails AWAY from the start line and only tries to get across after the gun"

`hullLineOffset` took its sign from the MARK ORDER and ignored the route entry's `dir`.
Two of the ten venues author their start `dir: -1` — Bluewater and Redrock, both gate
starts, both new. On those the prestart read a boat correctly BEHIND the line as OVER
EARLY, and `getStartCommand`'s retreat branch backs off by `STAGE + pDist`, which grows as
she retreats. A runaway.

    fleet median distance from the line, T-30 -> the gun
      ocean    -386 -> -1731  (furthest -1855)      after:  -386 -> -136
      redrock  -383 -> -1078  (furthest -1105)      after:  -383 ->  -74
      bay      -419 ->  -128   <- what it should look like

    ocean 20 seeds   med 225.5 -> 198.0, paired +27 med / +35 mean, land 1.57 -> 0.00,
                     rubs 2.14 -> 1.13, pens 0.52 -> 0.40, max 529 -> 326
    bay 20 seeds     paired 0 / 0 — inert

**The single biggest pace win of the day, and it was a bug, not a tuning change.**

## ✅ 2. OCS false positives AND false negatives

Two causes, both the same family:

  - the PRESTART branch hardcoded `crossingDir === 1` while the racing branch three lines
    below correctly compares `crossingDir === requiredDirection`. On a `dir: -1` line that
    is inverted — a boat crossing to the course side was CLEARED, a boat correctly
    returning was FLAGGED. That is the owner's false positive, and it can only be seen by
    someone who actually reaches the line, which on those two venues the fleet never did.
  - OCS was set only by a crossing EVENT. RRS 29.1 makes it a fact about POSITION AT THE
    STARTING SIGNAL. Now judged from the hull at the gun, against the line BETWEEN its
    marks (past the pin is not on the course side).

    `_ocs_truth.js`, 270 boat-starts:  6 false negatives (one 182u over) -> 2, both
    sitting exactly ON the line — a floating-point tie, not a violation.

## ⛔ 3. "It failed to detect a rounding until an absurdly late period" — THAT ONE WAS MINE

The hairpin full-circuit requirement landed this morning. Redrock's legs 2 and 3 have
co-directional anchors, so it raised both to 360 degrees — and completion fires when the
boat is outside the zone and moving away, by which point a normally-sailed rounding has
banked only part of that circle. The leg then registers whenever the transit to the next
mark finally accumulates the rest. **Reverted (`17c5c9f`).**

⚠️ **A bench cannot see a leg registering late.** The AI absorbed it as a time cost and
every number I had said "expensive but correct". A human noticed in one race. When a change
alters WHEN a state transition fires, the bench measures the consequence and not the fault.

## ✅ 4. "I hit the first rounding circle and tacked outside and it counted as a rounding"

Reproduced exactly (`test_rounding_nibble.js`) on three venues:

    venue     requires   the nibble banked   leg completed?
    redrock      46 deg        82 deg              YES
    bay          92 deg       126 deg              YES
    ocean        89 deg       126 deg              YES
    arctic      360 deg       126 deg              no   (only because of the reverted fix)

**A swept-angle threshold cannot tell a rounding from a near miss**, because coming close
to a mark and turning away genuinely does swing your bearing about it a long way. Raising
the number does not fix it — it only makes real roundings register late, which is defect 3.
Re-basing the accumulator on arrival does not fix it either (measured: still completes).

**What separates them is WHERE SHE IS GOING.** A rounding ends with the boat leaving for
the next mark; a near miss ends with her leaving the way she came. So the requirement is
now the winding from her ARRIVAL bearing round to the bearing of the next anchor, taken
the required way — a per-boat fact about the geometry she actually sailed. The tolerance
is DERIVED: she leaves on a tangent, so at distance d from a mark she rounds at radius R
her bearing falls short by exactly `acos(R/d)`. Allowing that and no more means the leg
completes the moment she is genuinely on her way out, and not before.

    bay correctness   ordinary legs 6.5% -> 0.7% never wrapped the mark
                      overall 6.1% -> 1.9%
    bay pace          paired -10.5 med / -10.9 mean, 180/180, marks 0.38 -> 0.67

## ⚡ TWO HUMAN TRAJECTORIES, AND WHAT THEY SAY (2026-08-05 evening)

The owner sailed both new venues by hand and handed over the recordings. They settle two
arguments that no amount of bench-staring would have.

### REDROCK IS RACEABLE — 221 s against a 360 s cutoff, five legs, comfortably

    HUMAN                                     FLEET (3 races, 27 boats)
     leg   time    dist   medTWA  up%  down%    time    dist   medTWA  up%  down%
      1    37.7    2798      42    97     0    116.5    7953      67    55    24
      2    73.3    7790     166     7    88    227.7   13845      84    45    28
      3    68.3    8001     151     1    80    501.6   26399      97    37    34
      4    15.9    1911     165     0    93    129.7    5588     100    40    37
      5    24.6    2855     168     0   100     (the fleet never got here)

**Beat to the first mark, then run the corridors** — exactly what the owner said. The
fleet instead reaches and beats through the rock garden: 45% UPWIND on a leg the human
sails 88% downwind, 3.3x the distance on leg 3, 4354 shoreline collisions per boat-race.

⚠️ **And the router is NOT the culprit — it plans corridor routes.** Asked directly, it
returns 4347 units for leg 2 against a 2034-unit straight line (2.14x) and 6858 for leg 3
(1.7x). It is wind-aware (`_wbin` present, 25 wind regions, the polar time-cost table).
**Two things are wrong instead:**

  1. **its own plan is 64% upwind through water 50 units wide** on leg 2. The time cost
     prices beating correctly as VMG — but a boat cannot physically tack in a 50-unit
     channel, and nothing in the cost says so. The `narrow` term is a bounded route HINT.
  2. **the boats sail 3.2x their own plan anyway** (13845 against 4347). Whatever the plan
     says, the local layer is not executing it in this water.

⇒ **The core-AI item: an upwind cost that knows whether there is room to tack.**

### BLUEWATER IS CLOSE — human 182.5 s, fleet ~198 s, and it is ALL ONE LEG

    leg 1 (beat)   human 68.8s / 6906u      fleet 83.7s / 8356u    <- -15s, +21% distance
    leg 2 (reach)  human 30.4s / 3754u      fleet 27.9s            <- fleet FASTER
    leg 3 (run)    human 81.4s / 18749u     fleet 76.2s            <- fleet FASTER

The fleet beats the human downwind — the swell work says why it can — and loses the whole
race on the beat, **at the same true wind angle** (38 vs 40). Distance, not speed.

`_beat_attrib.js` (new) attributes it:

    TACKS                  human 4        fleet 7
    % of leg OVERSTOOD     human 37.7%    fleet 46.0%
    distance               6906u          8116u

### ⚠️ A REAL BUG IN THE LAYLINE CALL — it is a WINDOW that can be missed

    if (Math.abs(otherError) < 0.1 * traits.laylineTight) {
        if (this.tackCooldown <= 0) { ...tack... }
    }

Two failures in three lines. The test is a **window**: sail through it and `otherError`
keeps growing, the absolute test goes false, and the layline is never called again — the
boat just keeps going. And the **cooldown can veto the one moment the window is open**
(5-10 s, which at 120 u/s is up to 1200 units past the layline).

The sign was determined by MEASUREMENT rather than by reasoning about tack conventions
(`otherError * currentTack`, 1513 upwind samples on Bluewater):

    the other tack does NOT yet lay the mark    negative,  94% of samples
    the other tack DOES lay it (overstood)      positive, 100% of samples
    ...and 22% of all upwind samples were already past the layline

`treeLAY` makes the test one-sided (at the layline OR past it) and stops the cooldown
vetoing it once genuinely past. Benching.

### ⛔ `treeEX` (orbit clamp) and `treeLAY` (one-sided layline) — NEITHER LANDS

    treeEX   clamp the orbit lead to what is left to the exit bearing
      bay      paired  0 med / +1.3 mean,  MARK CONTACTS 0.67 -> 0.40
      arctic   paired -3 med / -9.9 mean
    treeLAY  one-sided layline call, cooldown cannot veto once past
      ocean unscoped   paired 0 med / -5.2 mean, downwind VMG 12.88 -> 12.49
      ocean scoped     paired 0 med / -0.8 mean
      bay unscoped     paired -6 med, BOAT RUBS 1.59 -> 1.03

⚠️ **The unscoped layline change also fires on downwind GYBES** — `hStarboard`/`hPort` are
`wd ± optTWA` and optTWA is whichever angle the MODE chose, so one block serves both. That
is the downwind regression, and scoping to `mode === 'upwind'` removes it. Worth
remembering: anything touching that block touches gybes too.

**But scoping it did not buy anything either, and the reason is the real finding.**

### ⚡⚡ THE AI CALLS ITS LAYLINE AGAINST THE ROUTING CARROT, NOT THE MARK

`otherError = normalizeAngle(otherCog - angleToTarget)` — and `angleToTarget` is the
bearing to the NAV TARGET. On a rounding leg that is whatever the router is steering for:
a ruler carrot, a zone-approach point, an entry sector. Measured on Bluewater's first leg,
784 samples:

    the nav target sits a MEAN OF 1717 UNITS from the mark, and as much as 3401
    (the mark's own zone is 1000)

So the layline is being called against the wrong point, by a margin larger than the zone.
That is why the fleet sits at 46-49% overstood against a human's 37.7%, and why sharpening
the TEST changed nothing — it sharpened it against the wrong point.

`treeLAY2` calls it against the mark. First read: distance 8412 -> 7955 and time 82.0 ->
80.5 on the same seeds, overstanding barely moved (49.4% -> 46.4%). Benching properly.

### ⛔ `treeLAY2` REJECTED TOO — and the negative is the useful part

    ocean 20 seeds   paired 0 med / -2.5 mean, max 326 -> 530, upwind VMG 4.338 -> 4.329

⚠️ **A 3-race probe said 82.0 -> 80.5 s and 8412 -> 7955 units; the 20-seed bench says
-2.5.** Same trap the campaign has recorded twice before: judge at 20, not at 3.

So the layline target IS wrong — 1717 units off, measured, and that is not in doubt — but
**correcting it does not buy time.** That is worth more than another neutral candidate,
because it refutes the hypothesis the whole beat investigation rested on:

  ⇒ **the fleet's 46-49% overstanding is not caused by the layline test looking at the
    wrong point, and it is not fixed by calling the layline correctly.**

Something else is keeping the boats out past the layline. Three candidates, none tested:

  1. the layline tack is CALLED and then vetoed or overridden downstream — `applyAvoidance`
     runs after `getStrategicHeading`, and a tack it deflects is a tack that did not happen.
     Testable: count layline calls against tacks actually executed within N seconds.
  2. `scoreTack` outweighs it. The shift and pressure terms are free to hold a boat on a
     losing board; the layline branch returns early, but only when it fires.
  3. the fleet is overstood because it was pushed there — traffic on a crowded first beat,
     not a tactical choice at all. The human sailed alone.

⚠️ Candidate 1 is the cheapest to test and the most likely: it needs one counter, not a
new mechanism. Start there.

## THE AI SCOREBOARD AFTER THIS SESSION

    LANDED (bugs, all owner-reported or owner-visible)
      the start line's dir, and OCS judged at the gun      ocean +27 s paired
      rounding completes at the EXIT BEARING               nibble closed, arctic 56% -> 5.6%
      the hairpin full-circuit requirement                 REVERTED — registered too late
      test_start_crossing.js, test_rounding_nibble.js      both in npm test
      frozen + fingerprinted benchmark venues              a venue edit can no longer
                                                           silently invalidate a baseline

    REJECTED, each with a mechanism
      treeS1  crab for the swell's set          feedback already closes it
      treeS2  fine downwind VMG in a sea        7th rejection of that family, 3rd venue
      treeH1  full circuit at a hairpin         registers late — the owner saw it
      treeH2  re-base sweep on arrival          dominated on arctic
      treeH3  H1 + H2                           they compound
      treeEX  clamp the orbit to the exit       bay marks 0.67 -> 0.40 but arctic -9.9
      treeLAY one-sided layline                 fires on gybes too; scoped, still nothing
      treeLAY2 layline against the MARK         the target IS 1717u wrong; fixing it is 0
      18.3 / 18.4                               predicate: 1 event in 54 boat-races

### ⛔ THE LAYLINE THREAD, CLOSED IN FOUR MEASUREMENTS

    HEAD                          layline armed 185, she TOOK it 27%, DID NOT 73%
    treeLAY2 (aim at the MARK)    armed 195, took 30%, did not 70%   -> aim is not it
    treeLAY  (one-sided test)     ocean paired -0.8 mean            -> test is not it
    treeLAY3 (BOTH)               armed 270, took 61%, did not 39%   <- the pair DOES work
                                  ...and TACKS 6 -> 13, overstood 49.4% -> 53.7%,
                                     leg time 82 -> 94 s            -> and it is WORSE

**The pair does move the behaviour and the behaviour was the wrong target.** Once a boat is
past the layline the one-sided condition is PERMANENTLY true, so overriding the cooldown
lets it fire every tick: she tacks, is immediately past the layline on the new tack too
(because she was well past), and tacks back. That is precisely the flapping the cooldown
exists to prevent — my own comment said so while removing it.

⇒ **The overstanding is NOT a layline-logic problem.** Four variants, four rejections, and
the one that changed the behaviour made it worse. What is left:

  - **traffic.** The human sailed alone; the fleet beats 9-up on a first beat. Mean
    avoidance deflection on that leg is 10.6-13.8 degrees. A boat pushed past the layline
    did not choose to be there, and no tactical rule will bring her back cheaply.
  - **it may not be worth what it looks like.** The fleet is 46-49% overstood against a
    human's 37.7% and loses 15 s on the leg — but every attempt to convert overstanding
    into time has come back flat or negative. The correlation may not be the cost.

⚠️ **Next time, test the DIRECTION of the effect before building the mechanism**: a probe
that answers "if these boats had tacked at the layline, how much would they have saved?"
is one trajectory replay, and it would have priced this thread before four trees were cut.

    CONFIRMED on the bench:  treeLAY3   ocean paired -11.0 med / -11.1 mean
                                        bay   paired  -2.0 med /  -3.5 mean

---

# ⚡ PLAN FOR THE NEXT PUSH — ROUTING THAT KNOWS WHETHER IT CAN TACK

Researched and measured 2026-08-05 evening. The core-AI problem and the redrock routing
problem turn out to be ONE problem, and it has a closed-form model.

## THE MEASUREMENT THAT DEFINES IT

The fleet's distance sailed against the ROUTER'S OWN PLAN, by how much free water the plan
runs through (free radius = the largest all-navigable circle at that point):

    venue    leg   plan(u)   fleet sailed   ratio    free water on the plan
    bay       1-6   2797-4653   0.92-1.32x           550-700u
    ocean     1-3   4919-18283  0.83-1.40x           700u
    redrock    1      2352       13260  5.64x         100u    <- 98% upwind
    redrock    2      4347       11588  2.67x          50u    <- 64% upwind
    redrock    3      6858       20932  3.05x           0u

**In open water the fleet sails 0.83-1.40x its plan. In redrock's slots it sails 2.7-5.6x.**
The worst leg is the one that is 98% upwind through 100 units of free water.

⇒ **The router plans beats through channels a boat cannot tack in, and the boat then cannot
execute them.** Those are not two bugs. The second is the consequence of the first.

## THE MODEL — closed form, derived, not tuned

To make good ground upwind in a channel of width B you tack every `B / sin θ` of track and
pay `t_c` seconds each time. So the achievable upwind VMG is

        VMG_eff(B) = (B · V · cos θ) / (B + t_c · V · sin θ)

which tends to `V cos θ` as B grows and to zero as B closes. At 8 kt, TWA 42, a 3-second
tack:

        channel B     VMG_eff    fraction of free-water VMG
             50u        15.3            17%
            100u        26.2            29%
            200u        40.5            45%
            400u        55.7            62%
            800u        68.5            77%
           1600u        77.5            87%

**The router prices every one of those at 100%.** On redrock leg 1 it is wrong by 3.4x, and
that is exactly the error that makes a beat up a slot look cheaper than a longer run.

⚠️ The literature does not cover this. Weather-routing work (isochrone and DP methods,
evolutionary routers, the A*-hybrids) treats land as a HARD CONSTRAINT and prices the polar
— nothing models whether there is room to tack. The gap is real, and the arithmetic to fill
it is ordinary sailing arithmetic.

## THE PLAN

**PHASE 0 — THE PROBE THAT PRICES A CHANGE BEFORE IT IS BUILT (half a day).**
The layline thread cost four candidate trees to learn that a real defect was not worth
fixing. Build the instrument that would have said so: **a trajectory replay that answers
"if these boats had done X, what would they have saved?"** Feed it the recorded human runs
and the fleet's own tracks. Nothing else in this plan starts until this exists.
⚠️ It is also the answer to "judge at 20 seeds, not 3" — the beat probe said 82.0 -> 80.5 s
on 3 races and the bench said -2.5 on 20.

**PHASE 1 — CORRIDOR-AWARE UPWIND COST (the headline).**
`SailCheck.pathSailable` already has the clearance field (`clear[nid]`, used today only as
a bounded route HINT — the `narrow` term). Fold it into the TIME COST instead, through
`VMG_eff(B)` above, for the upwind bins of the `buildTimeCost` table.
  - the table is 16 directions x 6 speeds; it becomes 16 x 6 x (a few clearance bands).
  - `t_c` is not a free parameter: measure it. Time a tack in the engine at each wind speed.
  - GATE: redrock's planned leg 1 stops being 98% upwind; the plan's median free water
    rises; the fleet's sailed/plan ratio falls from 5.64.
  - ⚠️ EXPECT BAY AND OCEAN TO BE NEARLY INERT — their plans already run through 550-700u,
    where the model is within 15% of free-water VMG. If they move much, the model is wrong.
    That is the cheapest possible falsification and it comes for free.

**PHASE 2 — RE-MEASURE THE EXECUTION GAP.**
If Phase 1 works, redrock's plans stop asking for the impossible and the 2.7-5.6x should
collapse on its own. Measure before building anything else: the local-layer work in Phase 3
is only justified by what is LEFT.

**PHASE 3 — THE LOCAL LAYER, ONLY IF PHASE 2 LEAVES A GAP.**
Candidates, in order of how cheaply they can be tested:
  - grid resolution: 50-unit cells with a 44-unit clearance cannot represent a 100-unit
    channel. A finer grid near land, or a clearance-aware carrot, may matter more than any
    steering change.
  - the carrot spacing (450u hops) against a channel that turns inside one hop.
  - `applyAvoidance` in water with nowhere to go — 4370 shoreline collisions per boat-race
    says the avoidance layer is fighting the walls, not the boats.

**PHASE 4 — THE OCEAN BEAT, WHICH IS A DIFFERENT PROBLEM.**
15 s and 21% distance on a beat in OPEN water (700u), where the model above says nothing is
wrong. The layline thread is closed at four rejections; what is left is **traffic** — the
human sailed alone, the fleet beats nine-up with 10-14 degrees of mean avoidance
deflection. Phase 0's replay prices it: how much of the 15 s is recoverable at all?

## STANDING RULES FOR THIS PUSH, EARNED TODAY

  - **Price the direction of an effect before building the mechanism.** Four trees died
    proving a real defect was not worth fixing.
  - **A bench cannot see a state transition firing LATE.** The hairpin change looked
    "expensive but correct" on every number I had; the owner saw it in one race.
  - **A statistic that is exactly zero at every percentile is a bug, not a finding.**
  - **Two halves that each do nothing may still be a change.** The layline pair moved
    73% -> 39%; neither half moved it at all.
  - **Judge at 20 seeds, and on a disjoint set.** Three results this session reversed
    between 3 and 20 races, or between 9100 and 9200.

---

# 2026-08-05 20:45 — PLAN REVIEW BEFORE EXECUTION (new session)

Preconditions verified: freeze_venues --check all four match; npm test exactly the 6
pre-existing editor failures; anchors usable as stated.

## Literature check (web, this evening): the gap claim HOLDS

qtVlm / Expedition / Adrena expose per-maneuver tack penalties; Dalang et al. (JORS 2015,
America's Cup) and Sidoti & Pattipati (IEEE 2023) charge a fixed switching cost in open
water; robotic-sailing work (Stelzer & Pröll hysteresis) lengthens boards implicitly.
Nobody converts channel width into degraded VMG. One partial exception: a 2025 Ocean
Engineering inshore-routing paper (Marseille venue) takes "side distance available for
maneuvering" as a feasibility input — not a VMG_eff(B) pricing. The closed form is the
standard distance-made-good-per-cycle derivation, never published as corridor pricing.
Two refinements it does support: t_c varies with wind speed / sea state (measure per speed
bin), and there is a MINIMUM BOARD TIME — below the speed-rebuild time the formula is
OPTIMISTIC, the boat never regains full V between tacks.

## ⚠️ THREE CORRECTIONS TO PHASE 1, FOUND BEFORE BUILDING

1. **The plan's falsification contradicts its own table.** It expects bay/ocean (550-700u)
   to price "within 15% of free VMG", but raw f(B) = B/(B + t_c·V·sinθ) gives 0.70-0.75
   there — the raw model charges open water 25-30%, because it assumes a tack every
   board-width even where boats naturally tack far less. **Normalize at the natural board
   width**: factor(B) = min(1, f(B)/f(B_nat)), B_nat from measured open-water tracks
   (ocean beat: 7 tacks / 8356u sailed → board ≈ 1194u → B_nat ≈ 800u cross-corridor).
   Then 550-700u prices 0.93-0.97 (inert, as the falsification demands) and 100u prices
   ~0.38. Without this, Phase 1 moves bay/ocean and the falsification kills a correct
   model for the wrong reason.
2. **The tf clamp caps the fix.** `buildTimeCost` clamps `tf = min(4, max(0.6, 10/best))`.
   Free upwind tf ≈ 2; a 0.29 corridor factor wants tf ≈ 7 — clamped to 4, the correction
   arrives halved. The corridor-banded table needs the cap raised (~12). Heuristic
   admissibility is unaffected (`hMul = _tfMin`, the table MINIMUM).
3. **B from clearance is coarse.** `clear[nid]` is Chebyshev cells-to-nearest-blocked;
   mid-channel of a W-wide channel reads c ≈ ceil(W/100), so B(c) = (2c-1)·50 is the
   honest lower-ish band edge {50, 150, 250, ...}. Bands, not precision — and the penalty
   should key on |heading − bearing| of the maximizing candidate (delta = 0 → directly
   sailable → NO penalty at any width; this scopes the correction to the no-go cone by
   construction and prices corridor gybing too, mildly).

## Also noted

- Arctic must be benched alongside bay/ocean: the bots' grid stamps FLOES, so arctic's
  corridors are exactly the water this repricing touches. Not covered by the plan's
  "bay/ocean inert" falsification.
- Redrock's raceability verdict is superseded by the owner's 221s hand-sailed run — the
  memory index's "NOT RACEABLE" entry predates it.

---

# ⚡ 2026-08-05 ~21:00 — PHASE 0 INSTRUMENTS BUILT, AND TWO OF THEM ALREADY SETTLED THINGS

## 1. VMG_eff(B) MEASURED IN THE ENGINE (`_vmgeff_probe.js`) — the model was 2-3x too harsh

An ideal rate-limited helm (player physics: getTurnSpeed · steerageFactor, in-irons decay
and rebuild all live) short-tacks up a virtual corridor; VMG over a bounded climb.
⚠️ First cut ran on a clock, sailed to the arena wall, and reported byte-identical VMG at
every width — the exactly-equal-everywhere rule caught it; now it times a fixed climb.

    usedB(u)   123   150   200   250   351   450   651   852   1251   free
    frac      .639  .688  .747  .788  .834  .870  .899  .920   .943  1.000
    (seatrials 13kt, optTWA 38; free run reproduces the polar: 5.73 vs 5.81 kn.
     Lagoon replicates the corridor VMGs to ±0.04 kn; its free lane is contaminated
     by its own geography — seatrials is the reference.)

**Single-parameter fit: frac = W/(W+K), K ≈ 70u ± 5 at 13 kt ⇒ t_c ≈ 1.0 s against polar
speed.** The game's tacks are CHEAP (natural-maneuver probe `_tackcost.js` agrees: med
0.2-1.3 s across wind bins). Consequences:
  - a 100u slot prices ~0.6 of free VMG, not the plan's 29% — corridor arithmetic
    explains ~1.6x of redrock leg 1's 5.64x, so EXECUTION is the bigger half (Phase 3).
  - per-step form for the router: tf' = tf · (1 + L/W), L = t_c·v_best·|sin δ_best|·15,
    which is ZERO for directly-sailable bearings — self-scoping to the no-go cone,
    prices corridor gybing mildly, and needs no normalization to be open-water-inert.

## 2. TRAFFIC, PRICED DIRECTLY (`_solo_beat.js`) — the fleet-vs-human gap largely IS the fleet

Same seed, same boat, all other bots parked off-map at the first prestart frame.
⚠️ Every stored human run has rivals=0 — the owner sailed ALONE. So solo-bot vs
solo-human is the honest comparison, and it says the core boat is ALREADY human-par:

    OCEAN 20 seeds (9300-19): beat leg paired fleet−solo med +11.3 s / mean +12.8.
      Solo beat 63-73 s (med ~70) vs human 68.8; solo dist ~7.1-7.4k vs human 6906.
      Solo finishes med ~175 vs human 182.5 — the solo bot BEATS the human's race.
    BAY 20 seeds (9100-19): solo fin med 224.2 vs human med 226.2 (11 runs);
      solo best 213.2 vs human best 217.8; 8 of 20 solo runs beat the human's best.
      Paired fleet−solo: L1 med +11s; whole race med ≈ +38 s.

⇒ **The ocean-beat thread's "what is left is traffic" is CONFIRMED and PRICED (~11 s of
the 15), and bay's ~35 s fleet-median gap to the human is fleet-racing cost, not boat
speed.** The competitive question is now: does the AI pay MORE for traffic than a human
in traffic would? (Human rubs 0.14/race vs fleet 2.0 says yes, some of it.) No human
in-fleet recording exists to calibrate against — worth asking the owner for one
race-with-rivals recording per venue.

⛔⛔ **THE PARAGRAPH ABOVE IS WRONG AND CORRECTED THE NEXT MORNING (see the
INSTRUMENTATION AUDIT entry below): the owner ALWAYS raced WITH the fleet.** The
"rivals=0" read indexed a DECORATED format name (`F.rivals` vs
`'rivals[x,y,...]'`) — a nonexistent column, read as undefined, reported as zero.
All 59 recordings carry 9 rivals. The corrected like-for-like picture:

    bay     human 226.2 med IN TRAFFIC   vs fleet bots 259.5 med   -> ~33 s real gap
    ocean   human 182.5 IN TRAFFIC       vs fleet bots ~196-198    -> ~15 s real gap
            (beat: human 68.8 in traffic ≈ a bot ALONE at ~70; traffic costs the
             human ~nothing and costs a bot ~11-13 s)
    arctic  human ~222 med IN THE FLEET  vs fleet bots 540 med     -> 2.4x, the
            largest gap, and like-for-like (both get the lead-opening benefit)
    solo bot ≈ human-in-traffic on bay (224 vs 226): the bots need EMPTY WATER to
    do what the owner does through nine boats.

⇒ The fleet-efficiency family is not "an unfair comparison" — it is THE bay/ocean
frontier, worth ~15-33 s, and the human's near-zero traffic cost proves it is
recoverable in principle. The owner-recorded in-fleet references were in hand all
along.

⚡ **ARCTIC INVERTS: solo is ~90-105 s WORSE paired (8 seeds, 3 solo DNFs vs 0).** The
fleet appears to OPEN LEADS through the pack (same physics family as "rotating ice was a
lead-opener" from the spin-cap thread). Dose-response arm (keep 5 of 9) running to rule
out a probe artifact. Either way: the arctic solo bot (318-580 s) is far behind the solo
human (~229 s best) — arctic's gap is CORE ice navigation, not traffic.

## 3. CORRIDOR PRICING, PRE-PRICED ON EVERY VENUE (`_corridor_price.js`) — Phase 1's gate FAILS BY CONSTRUCTION

Stock A* vs corridor-priced A*, per leg, zero shipping-code changes:

    redrock: paths DO NOT REROUTE (70-95% shared, upW% 92->87 at best) — the stock
             planner ALREADY follows the only corridors; there is no wider alternative.
             The honest price rises (leg 3 est 54->66 s). The 2.7-5.6x sailed/plan is
             EXECUTION, not planning.
    bay/ocean: est moves <= 1-2 s per leg (falsification PASSES); path-cell churn in
             wide water is cost-degenerate tie-breaking, not route change.
    arctic:  est 96->99 / 88->91 s — near-inert on the doc grid (legs barely upwind).

⇒ Phase 1's stated gate ("redrock's planned leg 1 stops being 98% upwind") is
unreachable — not because the model is wrong but because redrock has nothing to reroute
to. The remaining case for landing the cost change is DYNAMIC (in-race floe corridors on
arctic) + honest ETAs; treeCORR benches (arctic 16@9100, bay 20@9100, ocean 20@9300)
are running and will decide land/reject.

## 4. THE REDROCK EXECUTION SMOKING GUN, and treeLOOK

The pure-pursuit lookahead FLOORS at 250u (`LOOK = max(250, min(900, cl·res·1.2))`) and
at 420u when the path ahead runs upwind — in corridors 100-150u wide that turn inside
one hop. The carrot is structurally off-corridor in exactly the water where the fleet
grinds 4370 shoreline hits a race; the boat cuts every wall pure pursuit tells it to.
The floors exist to stop tack-thrash in OPEN water; clearance is already computed at the
boat and is the honest regime signal. `treeLOOK` scales the floors by sea room
(min(250, 2·seaRoom) / upwind floor gated on seaRoom >= 300u); `check_raceable redrock`
12 races vs stock, running.

## ⛔ treeLOOK REJECTED (2026-08-05 ~21:05) — the lookahead floors are not the binding constraint

`check_raceable redrock`, 12 races each, paired:

    stock      0/108 finish, 4260 land hits/boat-race, 246 BOAT rubs, dies on leg 3 (86)
    treeLOOK   0/108 finish, 4607 land hits,           378 boat rubs, dies on leg 3 (87)

Scaling the 250u/420u carrot floors down in narrow water made pursuit LESS stable.
Mechanism worth keeping: **leg 3's median free water is 50u — below the MEASURED minimum
tack width (123u at an ideal helm) and barely over hull width (60u).** No steering change
makes a boat beat in water it cannot turn around in. And 246 boat rubs/race says nine
boats are grinding single-file in the same slots — `_solo_beat redrock` running to split
corridor-traffic from pure execution. If the lone bot also fails, the current redrock
document is an AUTHORING problem (corridors want >= ~250u, twice the physical tack
width), not an AI one.

## ⚡ ARCTIC LEG-1 DEFICIT IS HALF SPEED, HALF LINE (`_track_floor.js`, seed 9100, full fleet)

    leg |  n | actual | speedFloor | lineFloor | speedDef | lineDef | dist
      1 |  9 |  471.0 |     269.2 |      30.0 |    201.7 |   239.2 | 41721u
      2 |  6 |  299.1 |     119.7 |      25.9 |    179.4 |    93.8 | 19017u

The wander thread always framed arctic as a LINE problem (ratio 3.89). Half of it is
SPEED — sailing far below polar on the line actually sailed (wedged in plugs, grinding,
rebuild after collisions). Fixes for the speed half look like "don't get stuck / price
the grind honestly", not like routing.

## ⚡ PHASE 1 FIRST BENCH (2026-08-05 21:15) — ARCTIC SAYS YES, and it is the DYNAMIC case

`treeCORR` = corridor factor tf·(1+L/W) in pathSailable, gated c < PAD so open water
prices exactly stock. Benches vs anchors:

    bay   20@9100   paired 0.0 med / -2.2 mean, pens 0.44->0.37          (inert-positive)
    ocean 20@9300   paired +1.0 med / +3.3 mean, land 0.00->0.11 ⚠️      (flag)
    arctic 16@9100  FINISHERS 129 -> 139 of 144, paired -7.0 med / -17.1 mean,
                    pens 1.86->1.64, col boat 10.86->7.66, land 30.1->27.5,
                    floe 38.9->32.5                                      (CLEAR WIN)

The static pre-pricer said "no venue reroutes" — TRUE at the doc grid — but in-race the
bots' grid stamps DRIFTING FLOES, and arctic's corridors are made and unmade every
replan. That is where honest corridor pricing decides differently, and every arctic
metric moved the right way. Verifying on disjoint sets before landing (arctic 16@9200,
ocean 20@9320 with HEAD baselines from treeHEAD).

**VERIFIED 21:30.** Arctic 16@9200: paired -12.0 med / -17.1 mean (9100 set was
-7.0 / -17.1 — the mean replicates to the decimal), fleet med 555->535, land 36.6->32.8,
floe 38.1->35.3. Finishers +1 (vs +10 on 9100 — threshold statistic, noisy as the bench
memory warns; time is the replicated signal). Ocean disjoint 20@9320: paired 0.0 med /
+3.5 mean, land 0.00/0.00 (the first set's land flag did NOT replicate), rubs down.
Ocean's +3.3/+3.5 mean replicates across sets — the price of shore-adjacent repricing.
`treeCORR5` (gate c<5, W<=400u only) benching on ocean 9320 + arctic 9100 to decide the
gate; then LAND.

**✅ LANDED `c4de193` (gate c < PAD; the c<5 variant was no better: ocean +5 med / +1.6
mean, arctic +1 med / -16.2 mean — the verified configuration wins on medians).**

## POST-LANDING VERIFICATION (2026-08-05 21:45)

    npm test     the SAME 6 pre-existing editor failures, nothing new
                 (test_sailable — the edited file's own suite — green on all ten venues)
    seatrials    100t seed 100: 198.94 / 194.61, pen 0.32, OCS 14.78%, DNS/DNF 0%
                 — IDENTICAL to the anchor; open water is stock by construction,
                 and its two golden traces were byte-identical before re-record
    goldens      17/20 diverged as expected (route-cell churn everywhere; seatrials x2
                 and swamp/90211 held) -> full --update -> PASS 20/20. Redrock's traces
                 were GREEN at HEAD (the "deliberately red" memory note is stale), so
                 no splice was needed. Pre-update copy kept at
                 regatta/eval/golden/traces.pre-corridor.json.

## NEW ANCHORS (HEAD = goldens commit after c4de193)

    seatrials 100t seed 100   198.94 / 194.61, pen 0.32, OCS 14.78%, DNS/DNF 0%
    bay 20@9100               bay_bench_corrbay.json        257.0 med
    ocean 20@9300             ocean_bench_corrocean.json    198.0 med
    ocean 20@9320             ocean_bench_corroc9320.json   196.0 med
    arctic 16@9100            fleet_leg2_corrarc16.json     535 med, 139 finishers
    arctic 16@9200            fleet_leg2_corrarc9200.json   535 med, 125 finishers
    goldens                   PASS 20/20 (re-recorded)

# ⚡ 2026-08-05 ~22:00 — TRAJECTORY INSTRUMENTATION AUDIT (owner-prompted)

The owner: *"I've always sailed with rivals. Check that their trajectories are recorded
correctly — in fact check instrumentation for trajectories overall."* He was right and
the campaign log was wrong:

## ⛔ "THE HUMAN SAILED ALONE" WAS FALSE — a nonexistent column read as zero

All 59 recordings carry **9 rivals per sample** (falling to 3-8 late in a race as boats
finish, `giveWayN` live at 8-70% of samples). The "rivals=0" probe indexed `F.rivals`
against the DECORATED format name `'rivals[x,y,hdg,spd,tack(1=stbd,-1=port)]'` —
undefined, `|| []`, zero. The zero-at-every-percentile rule was ON THE BOOKS and was not
applied to the probe's own output. The corrected competitive picture is in the corrected
solo-vs-fleet entry above; short form: bay/ocean gaps to the human are REAL (~33/~15 s,
like-for-like in traffic), the human's own traffic cost is ~nothing, and arctic is 2.4x
like-for-like.

## AUDIT RESULTS (`traj_audit.js`, new, all 59 files, every column)

    HEALTHY   10 Hz clock true (med 0.100 s, p99 0.120 — no world-clock units bug);
              positions continuous; legs monotone; rivals well-formed (tacks ±1 only);
              ringSect16 gating correct; floes present+well-formed on arctic;
              events typed correctly; 6 older files have shorter formats (columns
              were APPENDED over time — positional prefixes stable, consumers safe).
    FIXED     (1) RESTARTS APPENDED: racing->prestart kept the buffer, so one arctic
              file held THREE prestarts and two abandoned attempts — phase==racing
              analyses silently blended attempts. Recorder now voids the attempt on
              restart. ⚠️ Two existing files are multi-attempt and per-leg analyses
              must split them at race-timer resets: traj_arctic_1785909214735,
              traj_arctic_1785910345764 (their finishTime = the LAST attempt).
              (2) DECORATED FORMAT NAMES: now bare keys + a formatNotes map, so
              F[name] indexing can never silently miss again.
              (3) FLEET ANONYMITY: recordings now carry the rival roster and
              AI_STAT_BONUS once, in the header — like-for-like comparison needs it.
    CONSUMERS _beat_attrib.js / _route_vs_human.js use bare names only (t, phase, x,
              y, hdg, leg, windDir) — their published numbers are UNAFFECTED.
              traj_report.js/pin_report.js index positionally — stable. Only the
              solo-session probe misread, and only for rivals/giveWayN.
    GOLDENS   PASS 20/20 after the recorder edits (flag-off path untouched).

## ⚠️ NEW FINDING: THE WIND FIELD STACKS OVERLAPPING GUSTS WITHOUT A CAP

Two ocean recordings show 37-65 kt at the player (authored base 18, speedVar 4,
gustKt 10 → a SINGLE cell tops out ~34). `getWindAt` sums every overlapping puff
vectorially with no clamp — 3-4 stacked cells reach 55-65 kt, and an eval-race probe
(bots' positions only, 4 min) peaked at 29.1, so it is rare water but the player found
it twice. The polar is only authored to 30 kt, so behavior above that is extrapolation.
Owner call: cap the stack (e.g. strongest-cell-plus-fraction), or keep squalls as a
feature — either way the AI's pressure-seeking and the overpowered model should know
the true ceiling.

# ⚡ WHERE THE NEXT PUSH SHOULD AIM — the venue-by-venue decomposition, measured tonight

The question "is the AI competitive with the human?" now has a per-venue answer, and it
is a DIFFERENT problem on each venue:

1. **ARCTIC is the core-AI prize.** Solo bot 318-580 s vs solo human ~222 med (22 runs).
   The deficit is HALF SPEED (grinding within 120u of ice at 0.56 polar — 72% of all
   slow time), HALF LINE (46% of excess distance is avoidance-bent, a third of that
   with no identified boat/static threat — i.e., drifting ice deflection). Candidates,
   in priced order: (a) re-run `_ice_slow`/`_transit_probe` on the corridor-landed HEAD
   to re-baseline; (b) measure the REAL grind speed through soft plugs vs the A*'s
   2.5x/6x multipliers and set them to the measurement; (c) an ice-standoff term in the
   LOCAL layer (the route layer now has one — that was tonight's landing). ⚠️ The fleet
   OPENS LEADS (solo/keep-5 both ~90-180 s slower than 9-up): never bench arctic solo.
2. **REDROCK is an authoring decision, with numbers.** Corridors 50-150u vs a MEASURED
   123u minimum tack width; keep-N: 1 boat sails leg 1 at 1.2x plan and can finish,
   3 boats already gridlock, 9 never finish (246 rubs/boat-race); even solo, LEG 3
   (50u median) never completes by 900 s. Options: widen to ~250u+, small-fleet or
   time-trial format, or accept. A hand-sailed run on the CURRENT doc would settle
   whether leg 3 is human-possible at all.
3. **BAY/OCEAN are fleet-efficiency problems, not boat problems — and the audit made
   this SHARPER.** The human's recordings are all IN TRAFFIC: human 226 med beats the
   fleet bots' 259.5 like-for-like on bay, and the human's own traffic cost is ~zero
   (ocean beat 68.8 in traffic ≈ a bot ALONE at ~70, vs bots-in-traffic 83.7). The
   in-fleet human reference the traffic threads always lacked WAS IN THE FILES ALL
   ALONG — 59 recordings with 9 rivals each, `giveWayN` live, fleet roster now in the
   header. Mine them: where does the human accept a duck the AI converts into a tack,
   sail through water the AI deflects around (86% of clear-water onsets needed zero
   deflection), or take a transom the AI gives 44 degrees for?
4. **Instruments that should outlive the session**: `_solo_beat` (keep-N), `_vmgeff_probe`,
   `_corridor_price`, `_track_floor`, `_ice_slow`, `paired_compare`. The corridor
   arithmetic (W/(W+70u), 123u min tack width) belongs in venue-authoring guidance —
   `check_raceable` could flag corridors under 2x tack width at authoring time.

---

# ⚡ PLAN FOR THE 10-HOUR OVERNIGHT PUSH — CLOSE ON THE HUMAN, VENUE BY VENUE

Researched 2026-08-05 late evening on the post-corridor HEAD. Read this WHOLE section
before running anything. The like-for-like human gaps (all IN TRAFFIC — the audit entry
above explains why every older "sailed alone" claim is void):

    venue    human (in fleet)   fleet bots      gap        nature (measured)
    bay      226.2 med          259.5→257 med   ~31 s      fleet-traffic efficiency
    ocean    182.5              ~196-198 med    ~15 s      beat traffic (+11.3 s paired
                                                           solo-vs-fleet; human's own
                                                           traffic cost ≈ 0)
    arctic   ~222 med           540→535 med     2.4x       CORE: half ice-grind speed,
                                                           half line (avoidance-bent)
    redrock  (no current-doc recording)         —          ⛔ AUTHORING — do not tune

## STATE / ANCHORS (HEAD = 5350cae, all local, unpushed)

    seatrials 100t seed 100   198.94/194.61 pen 0.32 OCS 14.78% DNS/DNF 0%
    bay 20@9100  bay_bench_corrbay.json 257.0 | ocean 20@9300 corrocean 198.0,
    20@9320 corroc9320 196.0 | arctic 16@9100 corrarc16 535/139fin,
    16@9200 corrarc9200 535/125fin | goldens PASS 20/20 | npm test = 6 editor fails
    ⚠️ rl/treeHEAD, treeCORR etc. are STALE (pre-landing). `mktree.sh` fresh trees
    before ANY bench; bench args: <trials> <seed0> <label> <tree>.

## STANDING RULES (all earned, several this session)

  - The zero-at-every-percentile rule applies to YOUR OWN probes. When reading traj
    files, normalize format names: `F[n.split(/[\[(<]/)[0]] = i`.
  - NEVER bench arctic solo or small-fleet — the fleet opens leads (~90-180 s effect).
  - Wind readings above ~34 kt are the KNOWN GUST-STACKING BUG (owner: it is a bug, do
    not fix now). Do not tune pressure-seeking or heavy-air behavior against them.
  - Redrock: no AI tuning. Two multi-attempt traj files: split at race-timer resets.
  - Judge at 20 seeds on disjoint sets (bay/ocean 9100+9200 / 9300+9320); arctic on
    two 16-seed sets or paired per-boat median; finishers are threshold-noisy.
  - Keep >=4 probes in flight; check `date` at phase boundaries; commit per landing;
    rebuild trees after every landing; a rejection with a mechanism is a result.
  - A bench cannot see a state transition firing late — changes to WHEN something
    fires need a promptness assertion, not just a bench.

## PHASE 0 (first hour) — RE-BASELINE + THE HUMAN-ENCOUNTER LEDGER

1. Rebuild trees; re-run on post-corridor HEAD: `rl/_transit_probe.js 6 9100 <tree>`
   (arctic attribution — the corridor landing changed exposure: floe cols 38.9->32.5),
   `_ice_slow.js` 2-3 seeds, `rl/_bay_traffic_attrib.js`, `rl/_bay_rub_probe.js`.
   These are the aiming tables for Phases 1-3; do not aim from last night's numbers.
2. **Build `_human_ledger.js`** — the instrument this campaign has never had: mine all
   57 single-attempt recordings per ENCOUNTER (rival within 600u, closing): the
   human's deflection (heading vs 5 s trend), speed change, giveWay state, duck/tack/
   cross outcome, and time cost (legProg rate vs clear-air baseline). Output: the
   human's traffic ledger — deflections per encounter class, degrees, seconds. Set it
   beside the fleet's own numbers (`rl/_cpa_onset_probe.js`, `rl/_defl_hist.js`).
   This prices Phase 3 BEFORE any mechanism is built. Expect from priors: the human
   deflects rarely and small; the fleet's mean avoidance deviation is 44-46 deg.

## PHASE 1 (2-3 h) — ARCTIC GRIND (the speed half: 202 s/boat below-polar, 72% of it within 120u of ice)

Aim from the fresh `_ice_slow`/`_transit_probe` tables, then in cheapness order:
  a. MEASURE the real through-soft-cell speed vs the A*'s soft multipliers (2.5x lead /
     6x plug, sailcheck.js pathSailable). If measured grind is slower than priced,
     boats enter plugs they should route around — set the constants to the measurement
     and bench. One-constant change, fully priced by its own probe.
  b. Ice STANDOFF in the local layer: boats graze hulls at 38->32 contacts/boat-race.
     History warns: a blanket risk-water slow-down traded pace for nothing (script.js
     ~line 733 comment) — scope any standoff to GRAZING geometry (small approach
     angle), not all near-ice water.
  c. The `avoid:none` sub-bin (transit probe: ~1800-2000u excess/boat bent with NO
     rival/static identified): add one attribution counter inside applyAvoidance to
     name the source (floes via cScale? wiggle? liveness?) BEFORE building anything.
Bench: arctic 16@9100 + 16@9200 paired vs the corrarc anchors; bay 20@9100 for
inertness; goldens at close.

## PHASE 2 (2 h) — ARCTIC LINE (the other half: 46% of excess is avoidance-bent, 22% off-route)

Only after Phase 1's re-baseline: the corridor landing may have moved these bins.
The off-route bin (xtrack >300u on 55-74% of samples, carrot jumps 15-19/min) points
at replan churn through moving ice — measure carrot-jump size vs floe-map refresh
before proposing anything. ⚠️ Commitment-style holds are CLOSED (7 rejections, dose-
response: the scene survives ~1 s) — do not retry against rivals; the ice-commitment
exemption ("ice does not react back") remains untested and is the ONLY commitment
variant permitted a single cheap probe.

## PHASE 3 (2-3 h) — BAY/OCEAN TRAFFIC, AIMED BY THE LEDGER

The standing finding that re-frames this thread (`rl/_defl_hist.js` header): twelve
candidates re-priced the avoidance COST and the 46-48 deg mean deflection never moved,
because the escape ACTION SET is quantized — the fan is {0, ±.1, ±.2, ±.4, ±.6, ±.8,
±1.2, ±1.6} and the argmin lands on the first point that clears. Two candidate shapes,
in order:
  a. **Densify the fan between 0.2 and 0.8 rad** (add ±.3, ±.5) — pure action-set
     change, no cost re-pricing, directly attacks the quantization. Cheap to build,
     priced by _defl_hist before/after, then benched bay 9100+9200, ocean 9300+9320.
  b. Whatever single encounter class the human ledger says is worth the most seconds
     (expect: give-way onsets where zero deflection was needed — 86% of clear-water
     onsets per the RRS-avoidance memory). Scope ONE class, bench, stop at two
     rejections for the night.
⚠️ Owner direction stands: sail the rules. Rules 15/16.2/17 are display-only; do not
give the AI rule-breaking escapes.

## PHASE 4 (final hour) — CLOSE CLEAN

Goldens (full --update if anything landed; no redrock splice — that note is stale),
seatrials 100t, npm test (6 editor failures = clean), campaign log entries with dated
verdicts and mechanisms, new anchors listed, memory updated, trees left in place,
`pkill -9 -f chrome-headless` when ALL benches are done. Commits small, mechanism in
the message. Push waits for the owner.

## BUDGET NOTES (12 cores)

bay/ocean bench ~15-20 min per 20 seeds; arctic ~25-30 min per 16; goldens 3.5 min;
seatrials 100t ~25 min. A phase = probe (minutes) -> candidate tree -> two disjoint
benches (~1 h wall). Ten hours comfortably fits Phase 0 + three candidate cycles per
venue thread IF benches overlap probes — keep the background full, queue the next
candidate before reading the last verdict.

## ⚡ REDROCK CAPACITY, MEASURED (keep-N sweep, seeds 9100-9103)

    keep 1   L1 50-68 s, ~1.2x plan, one FINISH (583 s) in 4
    keep 3   L1 60-263 s — still gridlocks
    keep 9   L1 50-351 s, 0/108 finish, 246 boat rubs/boat-race

**Redrock is a single-lane venue.** One boat executes its corridors near-plan; three
already jam. Not a steering defect — a capacity fact about 100-150u corridors vs a
123u minimum tack width. Owner options: widen to ~250u+ (two lanes), race it small-fleet
/ time-trial, or accept DNFs as the venue's character.

## ⚠️ DATA PROVENANCE: the redrock human recording predates the current redrock document

`traj_redrock_1785825518447.json` (Aug 3, 140.3 s) — its ENTIRE track lies in cells the
CURRENT redrock document marks as land/off-grid (every sampled cell nav=0; caught by the
zero-at-every-percentile rule while trying to measure the human's tack placement).
Redrock is not among the four frozen venues and the owner's Aug 5 merge changed it. Any
human-vs-fleet redrock table derived from this file is cross-document; do not use it for
placement analysis. The current-doc corridor facts stand on their own: 4015 nav cells,
clearance histogram peaking at 1-2 cells (100-200u), corridors 50-150u at the pinches.
If the owner has a redrock recording made on the CURRENT document, it would reopen the
placement question ("does the human tack in sub-150u water, or tack where there is room?").


# ⚡ 2026-08-06 OVERNIGHT PUSH — PHASE 0: RE-BASELINE ON THE OWNER'S HEAD, AND A NEW VENUE

The plan above was written on `5350cae`. The owner then landed five commits, two of which
move the world: **`b60ba9d` clamps the gust stack** (the bug the last entry reported —
overlapping puffs now add at most the strongest single one of them, and ocean's cells were
re-authored 25x1000m -> 12x600m), and **`4909c1e`+`b60ba9d` add STILLWATER LAKE**, the first
venue to author `dirVar` and the first light-air venue in the game. Three human recordings
came with it.

## RE-BASELINE (HEAD = b60ba9d, all benches on treeHEAD built after it)

    venue    bench                          med    vs the plan's anchor
    bay      bay_bench_headbay 20@9100      257.0  UNCHANGED (corrbay 257.0)
    ocean    ocean_bench_headocean 20@9300  193.0  MOVED -5 (corrocean 198.0) — the gust
             ocean_bench_headoc2 20@9320    193.0  clamp + re-authoring, owner's change
    arctic   fleet_leg2_headarc 16@9100     535.0  UNCHANGED (corrarc16 535, 139 fins)
                                            139/144 finishers, 97%
    lake     ocean_bench_headlake 20@9100   407.5  NEW

⚠️ **Every ocean anchor from before `b60ba9d` is void.** Bay and arctic are byte-comparable.

## ⚡ STILLWATER LAKE IS THE BIGGEST GAP ON THE BOARD

    venue    fleet med   human med (in fleet)   gap
    bay      257.0       226.2                  +31 s
    ocean    193.0       182.5                  +11 s
    lake     407.5       223.0 (3 runs: 209.6/223.0/278.0)   +184 s, 1.83x
    arctic   535.0       ~222                   2.4x

and the fleet does not merely lose — **21% of it would DNF**: lake authors a 480 s cutoff and
the bench (cutoff raised to 900) finishes 143 of 180 boats inside 480. The fastest bot in 180
boat-races is 240 s; the human's SLOWEST of three runs is 278 s and her best is 209.6 s.

## THE MECHANISM, MEASURED

`_ground_probe.js` (new) records every `collision_island` with the state that produced it,
against a control histogram of the water the fleet actually sailed in.

    land contacts per boat-race     lake 30.63   |  bay 0.22   arctic 27.54 (+32.5 floe)
    speed AT the contact            med 0.24 kt, 78% of them under 0.5 kt
    local wind at the contact       med 6.79 kt  <- NOT a light-air hole; she is ashore
    avoidance deflecting her        median 0 deg; >5 deg on only 29% <- not traffic
    liveness state                  'normal' on 92% <- the stuck-watchdog never engages
    fleet time under 1 kt           8.3%   |  the three humans: 0.0%, 0.0%, 1.6%
    where                           44% of 765 hits in ONE place, 340-680u NNW of mark-5

and the human-vs-fleet track map (`_tracks.js`, new) shows the fleet sailing up a blind
finger of water north of mark-5 that the human never enters.

**THE RATCHET.** `applyAvoidance` probes each candidate heading along a segment of length
`boat.speed x 4 s`. Land is checked against that segment. A shore rub costs 60% of speed
(`boat.speed *= 0.4`), so the probe SHORTENS — at 5 kt it is 300 units, at 1 kt it is 60,
which is shorter than its own 140-unit hard-collision zone. Below that, every candidate that
touches land reads as an unavoidable collision, the argmin falls back to least-deviation, and
the boat holds her course into the beach. Then she is slower still. This is the same failure
the floe comment at `collision_island` describes ("sees every candidate blocked... falls back
to least-deviation, and holds course INTO the floe") arriving through the length of the probe
rather than the width of the collider.

Land does not move. It is the ONE obstacle here whose probe has no reason to be time-scaled.

## ROUTER SPEED BINS — a real defect, and a SMALL one (measured, not assumed)

The time-cost table's wind-speed bins were `[8,12,16,20,25,30]`, nearest-binned, so every cell
under 10 kt shared one bin. On lake — 7-9 kt authored, 2-kt shore holes, 2.9% of its water
dead calm — **all 4447 navigable cells landed in bin 0**: the router could not tell a nine-knot
lane from glass. Confirmed by construction and by `_lake_wind.js`.

Extending to `[2,4,6,8,12,16,20,25,30]` is provably scoped: bay's lightest cell is 7.01 kt and
the new 6/8 boundary is 7.0, arctic's is 15.05, ocean's 18, river 12 — **only lake re-bins**.
But `_route_wind.js` (new — prices a planned route in SECONDS by integrating the polar along
it) says the prize is small: total planned time 193.4 s -> 193.1 s, with leg 3's exposure to
sub-4-kt water halved (8.2% -> 4.9% of path) for +271 units. And a TF_MAX sweep (the cost
ceiling, which at 4 was below the honest cost of light air) moves the planned route by 1.1 s
across 4..20. **The route layer is not where lake's 184 seconds are.** Kept as a cheap accuracy
fix to bench alongside, not as the candidate.

⚠️ **I hit the exact hazard the new comment warns about**: my first candidate tree patched the
bin list in `sailcheck.js` but the string replace against `script.js` missed on indentation, so
the table was built with stride 9 and indexed with stride 6. Every cost was garbage and the
first TF_MAX sweep was meaningless. `SPDS` is now exported from SailCheck and read by the
course build — one array, one source.

## LAKE, DECOMPOSED — and three rejections with mechanisms

The grounding story above is real but it is NOT where the 184 seconds are. Measured:

    fleet speed (time-weighted, `_ground_probe` histogram)   4.14 kt
    human speed (3 recordings)                               4.8-5.1 kt      -> -17%
    fleet leg times   L1 154   L2 140   L3 ~110
    human leg times   L1  84   L2  70   L3   56              -> 1.8-2.0x each
    implied fleet distance on L1  ~9550u  vs human 6299u  vs route 4834u

So roughly **a sixth of it is speed and the rest is DISTANCE — the fleet sails 1.5x the
human's track on every leg**, and the deficit is spread across all three legs rather than
concentrated anywhere.

### ⛔ MARK-5 IS TIGHT, AND IT IS NOT THE CAUSE (the measurement that stopped a wrong fix)

`_markroom.js` (new — free water around every mark) says lake's mark-5 is planted in
**100 units of clearance**, with the largest fully-navigable circle around it at 80u and
only 43% of the circle at 220u navigable. Every bay mark has 300-1150u and a clean circle
to 400-600u; lake's own mark-3 has 200u. 44% of all shoreline contacts happen within
~680u of mark-5. It looks like the answer.

It is not. `_queue_probe.js` (new — occupancy and dwell inside a mark's working water):

    mark      peak boats   mean boats   dwell/boat med   max     of which <1.5 kt
    mark-5        5           0.76         35.0 s       114 s      7 s (max 33)
    mark-3        6           0.56         28.5 s        51 s      3.5 s (max 8)
    gate marks    5           0.13-0.22     7.5-13.5 s   31 s      1 s

Mark-5 costs about **6 s more dwell and 3.5 s more crawling than mark-3** — call it 10-15 s
a boat, not 184. There is no standing queue (mean occupancy 0.76 boats). ⚠️ **Owner note,
for authoring rather than for tuning**: 100u of clearance around a rounding mark is inside
the grid's own 44u navigation band plus a 30u hull, and it is the tightest mark in the game
by a factor of two. It is worth moving into the basin 300u southwest — but it is worth ~10 s,
and this session did not spend itself there because the probe said not to.

### ✅ THE LAND-PROBE DISTANCE FLOOR IS A LAKE WIN — and I nearly threw it away on the wrong metric

Floor the land probe at 240u so a slowed boat still sees ahead of herself.

    judged on groundings   71.1 -> 68.8 hits per 1000 boat-seconds   "real, tiny"
    judged on TIME         lake 20@9100 paired med -19.0 s, mean -16.5, fleet med 407 -> 385

⚠️ **The grounding rate was the wrong objective and it said the opposite of the truth.**
Contacts per boat-race went UP (30.63 -> 34.48) while races got 19 seconds shorter: the
boats sail past the same shores faster, so they bank more rubs per race and fewer seconds
per rub. Hits-per-boat-second divides by a denominator the change is trying to shrink.
Judge a steering change on the clock.

### ⛔ REJECTED: grading the blocked candidates by distance-to-blockage (`treeBLOCK`)

Flat `+500000` on every blocked candidate makes them tie, so the argmin falls through to
deviation and picks the smallest turn — into the beach. Grading by how soon each hits:
71.1 -> 67.9. **The reason it barely moves is worth keeping**: the grid marks every cell
within CLEARANCE (44u) of land unnavigable, so a boat against a shore has her FIRST probe
sample blocked on every heading and they tie *again*, one term further down.

### ⛔ REJECTED, AND IT MADE THINGS WORSE: free-water escape scoring (`treeESC`)

Walk the ray past the initial blocked run and charge `40000 x clearAt/140` for how long a
heading stays inside the clearance band before reaching open water. Groundings
71.1 -> **84.3** per 1000 boat-seconds, and boat-seconds per race went UP (10752 -> 12178:
the races got LONGER). Mechanism: on a keyholed basin with only 4447 navigable cells, a
large share of the legitimate water IS within 44u of something, so the term is not a
stranded-boat rescue — it is a permanent mid-channel bias that lengthens every track on
a venue whose whole problem is already track length.

**The lesson for this family**: the clearance band is not a hazard, it is the map's margin,
and any term that treats "inside the band" as a cost will re-price ordinary sailing on
every narrow venue. A stranded-boat rescue has to be gated on being stranded.

### LAKE'S EXCESS DISTANCE, ATTRIBUTED (`_transit_probe`, now venue-parameterised)

    leg          dist ratio   EXCESS      of which avoid   mean deflection   tacks (human)
    L1 (beat)      1.86       3781u       1911u = 51%          45 deg        8 med (5-12)
    L2             1.69       5752u       2495u = 43%          51 deg        6 med

**Half of lake's excess distance is avoidance deflection**, and the tack counts match the
human's — which kills the "light air makes the shift term dominate the VMG term, so the
fleet over-tacks" hypothesis before anything was built for it. Lake is not a light-air
problem wearing a traffic mask; it is the SAME traffic problem as Lighthouse Cove, made
expensive by a venue with 4447 navigable cells and corridors of 150-350u.

Set that beside the human ledger below and the family is clear.

## ⚡ THE HUMAN'S TRAFFIC LEDGER (`_human_ledger.py`, new) — the number this campaign never had

Mined per ENCOUNTER (a rival inside 600u and closing) across all 59 recordings.

⚠️ **A TACK IS NOT A DEFLECTION.** The first cut reported the human deflecting a median
48-69 deg per encounter — LARGER than the fleet's 44-48 — and it was an artefact: 26-69%
of encounters contain a deliberate tack, which is ~90 deg of heading change that had
nothing to do with the rival. Split on that, the picture inverts and the campaign's
standing prior is CONFIRMED:

    venue   no-tack encounters   deflection AT CPA          under 5 deg   median CPA
    bay          n=272           med  8.0  mean 26.7  p90 74.7    40%        355u
    ocean        n= 15           med  5.2  mean  8.8  p90 12.7    47%        455u
    lake         n= 40           med  8.7  mean 24.3  p90 62.6    38%        312u
    arctic       n=196           med 16.4  mean 25.7  p90 70.6    25%        288u

    the fleet, same quantity (`rl/_defl_hist.js`, `_transit_probe`)   mean 44-51 deg

She does not swerve. When she does react hard she TACKS (35% of bay encounters, median
115 deg of it) — she converts an encounter into a tactical move rather than a dodge. The
fleet's mean deflection is ~1.7x her mean and ~5x her median, and it is spending that
difference in distance on every venue with traffic.

### ⛔ PRICED AND DROPPED WITHOUT BUILDING IT: "ease instead of swerve"

`applyAvoidance` returns a heading and nothing else — it has no speed action at all, even
though the machinery exists (`speedLimit`, used by the ice-pack discipline). A boat that
could clear astern by easing 10% has to swerve 45 degrees instead. That looked like a
missing action rather than a mis-priced one, so the ledger was asked whether the human
uses the throttle:

    speed at CPA / speed at onset      bay 1.02 med   lake 1.02   arctic 1.02
    encounters where she slowed >10%   bay   1%       lake  8%    arctic   6%

**She does not ease.** She holds her course (8 deg median deflection) and passes 336-355u
away — in most of her encounters there was never a conflict to resolve. Adding a speed
action to the escape would be imitating something the human does not do. Not built.

⇒ Which leaves the ACTION-SET resolution as the live lever in this family, and that is
exactly what the densified fan is.

# ⚡ CANDIDATE 1: DENSIFY THE ESCAPE FAN — and gate it on drifting ice

`applyAvoidance` picks its escape by argmin over a fixed list of heading offsets:
`{0, ±.1, ±.2, ±.4, ±.6, ±.8, ±1.2, ±1.6}` (+`±2.2, ±3.0` on land venues — the list is
ALREADY venue-conditional, so gating it further is idiomatic here). The gaps from 0.2 to
0.8 are 11.5 degrees each, and that spacing IS the resolution of every dodge the fleet
makes: a boat needing 17 degrees to clear is offered 11, then 23, and buys 23. This is
the standing explanation for why twelve candidates re-priced the avoidance COST and the
mean deflection never left 44-48 degrees. Adding `±.3, ±.5, ±.7` costs nothing else —
same bubbles, same costs, six more points on the fan.

    venue    bench                                 paired med   paired mean   note
    lake     20@9100 vs headlake                     -29.0        -38.1       pens 1.32->1.05,
                                                                              mark 2.83->1.52,
                                                                              land 30.6->27.8
    bay      20@9100 vs headbay                       -5.0         -3.4       pens 0.37->0.48
    bay      20@9200 vs headbay2                      -2.0         -3.1       pens flat
    ocean    20@9300 / 20@9320                        -1.6 mean / -0.1 mean   inert
    arctic   16@9100 vs headarc                       +2.0         +3.8       finishers 139->132,
                                                                              pens 1.64->2.11,
                                                                              floe AND land contacts up

⚠️ **ARCTIC DISAGREED WITH ITSELF, and the mechanism I wrote for it was wrong.** Set 1
said +2.0 med / +3.8 mean with 7 fewer finishers; set 2 said **-9.0 med / -12.7 mean with
finishers unchanged**. Pooled over all 32 seeds:

    POOLED n=235 pairs   paired med -5.0   mean -3.7   finishers 262 -> 255 of 288

i.e. slightly FASTER and slightly fewer finishers — ambiguous, not a rejection. The story
I had written into the code ("finer resolution buys a tighter miss, and a floe neither
holds still nor keeps clear") is a good story and set 2 does not support it. It came out
of the comment before it was shipped. This is the standing arctic rule doing its job:
**two 16-seed sets are not enough to call a threshold statistic on this venue** — the
same trap that gave 71->65 and 45->65 for one change last session. A third set is
running to break the tie; until it lands the gate is a CONSERVATISM (do not move a
marginal venue on mixed evidence), not a mechanism.

⚠️ **The two lists are ordered and the order is the tie-break** (`cost < minCost` keeps
the earlier candidate), so the open-water list is written out in sorted order identical
to the one bay/ocean/lake were benched on rather than pushed onto the end — otherwise
those four 20-seed sets would not have been measuring the shipped code.


# ⚡ CANDIDATE 2: THE LAND PROBE IS A DISTANCE, NOT A DURATION — and the two compound

`applyAvoidance` scores each candidate heading along a segment of length
`boat.speed x 4 s`, and land is checked against that same segment. Every other probe in
that function is time-based because the thing being dodged is also moving. **A shoreline
is not.** Scaling this one with boat speed puts the fleet in a ratchet: a shore rub costs
60% of speed (`boat.speed *= 0.4`), the shortened probe then sees less water, so she rubs
again and it shortens again. At 1 knot the whole probe is 60 units — SHORTER THAN ITS OWN
140-unit hard zone, so every candidate that touches land reads as an unavoidable
collision, the argmin falls through to deviation, and the boat holds her course into the
beach. Floored at 240u (four seconds at four knots); above that nothing changes.

    lake 20@9100      paired med   paired mean   fleet med   land contacts   pen/boat
    HEAD                  —            —           407.0        30.63          1.32
    fan only            -29.0        -38.1         377.0        27.82          1.05
    land probe only     -19.0        -16.5         385.0        34.48          1.41
    BOTH                -53.0        -58.6         352.0        18.28          0.96
    both vs fan alone   -26.0        -20.0

**They compound** (-29 and -19 separately, -53 together), and together they are clean:
every contact class falls, penalties 1.32 -> 0.96, and 180/180 finish where the land
probe alone lost two. The fan lets a boat make a small dodge; the probe floor lets her
see far enough ahead to know a small dodge is enough. Alone, the probe floor just made
her sail faster past the same shores (contacts UP, time down); with the fan she can
also miss them.

⚠️ **Judge a steering change on the clock.** The probe floor was nearly discarded because
`hits per 1000 boat-seconds` barely moved (71.1 -> 68.8) — a denominator the change is
trying to shrink.

### The floe gate is live from frame 1 (checked, because it nearly was not)

`state.course._floeObjs` is populated by `refreshBotGrid`, not by `resetGame` — so
straight after a reset it reads EMPTY on Glacier Sound, and a gate written against it
would hand the ice venue the open-water fan for the first frames. Measured: 0 after
`resetGame()`, **112 after a single `update(1/60)`**, and `applyAvoidance` cannot run
before the first update. The gate is sound. (The two existing `openWater` reads at the
keep-clear terms have the same property and the same answer.)

### The two changes are venue-selective in exactly the way the mechanisms predict

    venue    what the ship tree changes            paired vs HEAD
    lake     dense fan + probe floor (both bind)   -53.0 med / -58.6 mean  (20@9100)
    bay      dense fan only (probe floor inert)     -3.0 med /  -2.9 mean  (20@9100)
             — and SHIP vs FAN-alone on bay is 0.0 med / +0.4 mean, i.e. the floor
               genuinely does nothing there: bay's boats are fast enough that
               `speed x 4 s` already exceeds 240u.
    arctic   probe floor only (fan gated off)      (pending)
    ocean    dense fan only, and it was inert      (pending)

## WHAT REMAINS BEFORE THE LANDING COMMIT (checklist, in case this session is interrupted)

The candidate is `regatta/eval/rl/treeSHIP` and it is applied with
`python3 regatta/eval/rl/_apply_ship.py treeSHIP` (region-verbatim from the tree that was
benched — `--check` reports without writing). Four regions, all in `applyAvoidance`.

    [x] bay    20@9100  ship vs head        -3.0 med / -2.9 mean
    [x] bay    20@9100/9200 fan alone       -5.0 / -2.0 med  (the fan half, two sets)
    [x] ocean  20@9300/9320 fan alone       -1.6 / -0.1 mean (inert)
    [x] ocean  20@9300  ship vs head         0.0 med / +1.8 mean (inert; 2 boats short
                                             of finishing — noted, within lake-free noise)
    [x] lake   20@9100  ship vs head       -53.0 med / -58.6 mean
    [x] lake   20@9200  ship vs head      -32.0 med / -43.7 mean  (386 -> 358,
                                            land contacts 27.8 -> 21.2, 180/180 finish)
    [x] arctic 16@9100  ship vs head       BYTE-IDENTICAL by construction; golden traces
                                            arctic/90210 + 90211 PASS with 0 behaviour
                                            changes (the 2 of 20 that held)
    [~] arctic fan alone, 48 seeds         -7.0 pooled paired med, finishers 396 -> 389,
                                            the loss confined to set 1 — set 4 pending
    [x] ocean  20@9300  ship vs head        0.0 med / +1.8 mean (inert)
    [x] seatrials 100t seed 100            199.15 mean / 194.73 med, pen 0.386,
                                            OCS 14.89%, DNS/DNF 0%, min 174.25
                                            (was 198.94 / 194.61 / 0.32 / 14.78%)
                                            — it takes the dense fan and barely notices:
                                            +0.12 s on the median, which is what ocean
                                            said too. Penalties 0.32 -> 0.386 is the one
                                            number that moved and it is worth watching.
    [ ] goldens: full `--update` (NOT per-venue — that rewrites the file with one venue)
    [x] npm test: 6 test_editor failures = clean (the 6 wind-shadow ones are FIXED)
    [x] test_sailable: PASS on all ten venues
    [ ] goldens: full --update (deferred until the arctic-fan question resolves, so the
        traces are recorded once rather than twice)


# ⚡ THE `avoid: none` BIN, NAMED — and a lock that survived being fixed once

Phase 1c of the plan: *"add one attribution counter inside applyAvoidance to name the
source BEFORE building anything."* Done (`treeWHY` + `_avwhy.js`): whenever the chosen
escape deviates more than 0.12 rad, record which term rejected offset 0.

    arctic, 3 races, 84138 deflections >0.12 rad, mean deflection 69 deg

      a BOAT inside the safety bubble          14.3%
      STATIC (land / grid / boundary)          35.2%
      an RRS rule violation                     0.0%
      nothing hard — only a proximity cost     36.0%
      NOTHING AT ALL — holding course was free 14.4%
      ...and a formal threatBoat existed on only 26.2% of them

**First, the bin was mostly a classifier artefact.** `_transit_probe`'s `hadBoat` test
needs a formal `threatBoat`, and 73.8% of real deflections have none — so dodges for
boats that never became the designated threat were landing in `none`. The mystery bin
was the instrument, not the AI.

**Second, and this one is a bug.** That last row is impossible unless some candidate
scored NEGATIVE, and exactly one term can: the commitment discount, `cost -= 60`. The
whole deviation cost range is 0..20 (`pow(|offset|,1.5)*10`, 20 at the widest candidate
in the fan), so -60 outranks every deviation there is. Its own comment says it *"must
only break NEAR-TIES"* and records being cut from -400 after it "became a lock: one wide
dodge at the start and the boat kept committing to a reversal for thirty seconds". **-60
is the same lock at a lower price**: 14.4% of arctic's deflections are a boat steering
away from a course that nothing — no boat, no land, not even a proximity charge —
objected to, because a heading near her last dodge was scoring -60 against a free 0.

Candidate `treeCOMMIT`: apply the discount only when offset 0 was NOT free. Offset 0 is
the first candidate scored, so the flag is available by the time the discount is applied,
and in traffic (where the anti-saw purpose lives) nothing changes at all.


## THE PROXIMITY-ONLY BIN, BROKEN DOWN BY TERM

Same instrument, now tagging each `proximityCost` contribution at its source and charging
the largest one whenever nothing hard vetoed holding course.

    lake, 2 races, 32138 deflections >0.12 rad, mean 61.4 deg

      a BOAT inside the safety bubble          25.1%
      STATIC (land / grid / boundary)          18.1%
      NOTHING AT ALL (the commitment lock)     12.5%
      proximity only, largest term = `narrow`  33.0%   <- the clearance cost
      proximity only, largest term = `farLand` 11.4%   <- blockage beyond 140u

**A third of every deflection the fleet makes on Stillwater Lake is the CLEARANCE term.**
`proximityCost += cScale * (1 - clr/3)` fires whenever the projected position lands in
water with under 3 cells (150u) of clearance, at `cScale` 10000 for land-caused
narrowness and 4000 for floe-caused. Lake's corridors are 150-350u wide and its clearance
histogram sits at 2-4 cells nearly everywhere, so on this venue the term is not flagging a
pinch — the whole course is a pinch, and it is charging up to 10000 (two thirds of the
`staticCollision` surcharge) for aiming at ordinary water.

This is the same shape as the `clearAt` term I built and rejected earlier tonight: **the
clearance band is the map's margin, not a hazard.** Next candidate on this venue, on top
of the ship tree: unify `cScale` at the floe value and bench lake/bay/arctic.

Arctic, same instrument (2 races, 64607 deflections, mean 70.8 deg):

      STATIC hard blockage                     39.2%   <- the dominant bin on this venue
      a BOAT inside the safety bubble          12.1%
      NOTHING AT ALL (the commitment lock)     14.0%   <- lake said 12.5%: venue-general
      proximity only: narrow 14.3 | softIce 9.1 | farLand 8.2 | islandBand 1.9
                    | bounds 0.7 | boatBand 0.1

Two things worth carrying:
  - **`boatBand` is 0.1%.** Whatever is bending arctic's line, it is not the traffic
    proximity gradient — which is consistent with the STAND_ON nudge already having been
    removed, and it means arctic's remaining avoidance excess is about ICE and WALLS.
  - **`narrow` is 14.3% here against lake's 33%**, because arctic's stamped-floe grid
    lets `cScale` fall to 4000 while a floe-free venue always pays 10000. The clearance
    term is therefore a LAND-VENUE cost in practice, and lake is where it bites.


# ⚡ ARCTIC PHASE 1a: THE SOFT MULTIPLIERS, MEASURED — and one of them is DEAD CODE

The plan asked for the real through-soft-cell speed against the router's 2.5x/6x charges.
`_soft_speed.js` (new): classify every bot at 10 Hz by the `_soft` value of the cell she
stands in, and take her speed as a fraction of what the polar says for HER heading in HER
wind. Arctic, 3 races, 128547 samples:

    class                              share    frac-of-polar   cost vs OPEN   charged
    OPEN (navigable)                   91.3%       0.815            1.00x         1x
    SOFT=1 opening lead                 0.8%       0.358            2.28x        2.5x  ok
    SOFT=2 staying plugged              4.7%       0.214            3.81x          6x  ?
    HARD (land / blocked)               3.2%       0.158            5.16x         wall

So the lead is priced correctly and the plug looked 1.6x over-charged. Setting 6 -> 4 and
benching arctic 16@9100 returned **paired med 0.0, mean 0.0, p25 0.0, p75 0.0 — every
statistic byte-identical.**

⛔ **Because the branch is unreachable.** `pathSailable`'s passability test is
`(id2) => grid._soft[id2] === 1`, so a plugged cell is not passable at all; `isSoft`
therefore always implies `_soft === 1`, and `? 2.5 : 6` always takes the 2.5. The 6 has
never priced anything. The comment above it describes a trade — *"a grind that is nearly
a wall — only worth it against a huge detour"* — that **the router has never been able to
make**: the grind was not on the menu, so every plugged narrows has always cost a full
detour however long it was.

⇒ The measurement's real implication is not a cheaper plug, it is an ENTERABLE one:
`treeSOFT2` admits `_soft > 0` and charges the measured 4x. Benching.

⚠️ Two lessons for the campaign: a bench that returns EXACTLY zero on every statistic is
evidence about reachability, not about the constant — treat it the way the
zero-at-every-percentile rule treats a suspicious zero. And a tuned constant that no
measurement has ever moved may not be tuned at all.


## ⛔ REJECTED: letting a free course beat the commitment discount (`treeCOMMIT`)

The lock is real — 14.0% of arctic's deflections and 12.5% of lake's are a boat steering
away from a course that NOTHING objected to, because a heading near her last dodge scores
-60 against a free course's 0, and -60 outranks the entire deviation range (0..20). The
fix (apply the discount only when offset 0 was not free) is small, correct-looking, and
**costs time**:

    lake 20@9100 vs the landed tree   paired med +4.0  mean +3.6
                                      boat contacts 3.62 -> 4.42, land 18.3 -> 19.5,
                                      pen 0.96 -> 1.09, one boat short of finishing

**Mechanism: it is a bug in DESCRIPTION, not in effect.** The comment calls it a
near-tie-breaker, and it is really hysteresis — and hysteresis that cannot outbid the
momentary state is not hysteresis. "Holding course is free" flickers tick to tick as a
rival's projection crosses the bubble edge, so a boat allowed to snap back the instant it
goes free snaps back and forth. The -60 is buying commitment, and commitment is worth
more than the 12-14% of deflections it wastes.

⇒ If this is retried, the shape that could work is TIME, not state: allow the return to
course only after offset 0 has been free for several consecutive decisions. Not built —
the venue-level prize here is small and the clearance term (33% of lake's deflections) is
three times bigger.


## ARCTIC AND THE FAN, ON 48 SEEDS — the gate may be wrong on this half

    set 9100  n=128  paired med  +4.0  mean  +3.8 | finishers 139 -> 132 of 144
    set 9200  n=107  paired med  -9.0  mean -12.7 | finishers 123 -> 123 of 144
    set 9300  n=126  paired med -13.0  mean  -4.3 | finishers 134 -> 134 of 144
    POOLED    n=361  paired med  -7.0  mean  -3.9 | finishers 396 -> 389 (91.7% -> 90.0%)

Two of three sets are clearly faster and **the entire finisher loss is in set 1**, which
is also the only set that read positive on time. That is the signature of a threshold
statistic on a marginal venue, not of a mechanism — the standing rule about 16-seed
arctic sets, again. A fourth set (9400) is running.

⚠️ Note what this does NOT change: the LAND PROBE FLOOR stays gated on arctic on its own
evidence (+9.0 paired median, 139 -> 130 finishers, floe contacts 32.5 -> 37.8) and on its
own argument — where there is ice, `gAv` is the stamped grid, so a floored probe predicts
240 units through a moving pack rather than looking further down a coastline. The two
halves of the landing are gated for different reasons and deserve to be judged separately;
they were tied to one flag for tidiness, and if the fan un-gates, that flag stops being
shared.

## ⛔ REJECTED: re-pricing the clearance cost (`treeCLR`, 10000 -> 3000)

The term is a third of every deflection the fleet makes on lake. Re-pricing it is INERT:

    lake 20@9200 vs the landed tree   paired med  +1.0  mean  +0.2   contacts 4.16 -> 5.70
    lake 20@9100 vs the landed tree   paired med +11.0  mean +11.8   land 18.3 -> 21.1,
                                                                     pen 0.96 -> 1.16
    — two disjoint sets, both the wrong way

**And that is the campaign's own thesis being confirmed rather than a surprise.** Twelve
earlier candidates re-priced the avoidance COST and the 44-48 degree mean deflection never
moved; the explanation on the books was that the escape is an argmin over a QUANTIZED
action set, so the cost decides only which of a handful of fixed offsets wins. Tonight the
same venue answered both halves of that: densifying the action set paid -29 to -53 paired
seconds, and re-pricing the single largest cost term in the same function paid nothing.

⇒ Standing conclusion, now with both arms measured: **on this avoidance layer, change the
ACTIONS, not the prices.** Any future candidate of the form "term X is too big/small"
should be required to explain why it will change WHICH CANDIDATE WINS, not merely by how
much it wins.

### ⛔ REJECTED: making ice plugs enterable at their measured price (`treeSOFT2`)

    arctic 16@9100   paired med -2.0  mean +13.3
                     finishers 139 -> 131, pen 1.64 -> 2.17
                     FLOE contacts 32.5 -> 45.8 (+41%), land 27.5 -> 35.5

**Mechanism: the measurement was survivorship-biased and I should have said so before
benching it.** `_soft_speed` measures the speed of boats WHO ARE IN a plug — and today
those are only the boats that got caught in one, since the router refuses to route through
them. Letting the router choose plugs adds the boats that would otherwise have gone round,
which is a different population. And a plug's price is not only speed: each rub costs 60%
of it (`boat.speed *= 0.4`) and carries penalty risk, none of which appears in a
fraction-of-polar figure.

⇒ The dead-code finding stands on its own and is worth the owner's attention regardless:
`pathSailable` admits only `_soft === 1`, so the `: 6` multiplier and the comment
describing a grind-vs-detour trade have never done anything. Either the branch should go,
or the trade should be made possible on purpose and priced by an UNBIASED measurement (a
probe that forces a route through a plug and times it end to end, against the same boat
routed around).


## ARCTIC AND THE FAN: CLOSED AT 64 SEEDS — it is noise

    set 9100  paired med  +4.0  mean  +3.8 | finishers 139 -> 132 of 144
    set 9200  paired med  -9.0  mean -12.7 | finishers 123 -> 123
    set 9300  paired med -13.0  mean  -4.3 | finishers 134 -> 134
    set 9400  paired med +10.0  mean  -0.6 | finishers 135 -> 138
    POOLED n=491 pairs    med  -4.0  mean  -3.1 | finishers 531 -> 527 of 576

The set medians alternate sign across a 23-second range. That is a threshold statistic on
a venue that already DNFs ~8% of its fleet at 900 s, not a mechanism. **The gate stays,
and the reason is now the strongest evidence in the session rather than the weakest**: not
"the fan hurts arctic" (it does not), but "four 16-seed sets cannot distinguish it from
zero, and a marginal venue is not worth moving for that." The shipped comment carries the
whole table so the next session does not re-run it.

⇒ **Standing note for arctic benching**: 16 seeds is not enough for ANY effect under about
15 seconds on this venue. Two sets was already the campaign's rule; this says the real
number is four, or a different statistic (paired per-boat median over pooled sets, which
is what the table above reports).


# ⚡ THE LANDED TREE ON TWO DISJOINT SETS PER VENUE (the full table)

    venue    set        paired med   paired mean   fleet med        note
    lake     20@9100      -53.0        -58.6       407 -> 352       180/180 finish
    lake     20@9200      -32.0        -43.7       386 -> 358       180/180 finish
    bay      20@9100       -3.0         -2.9       257 -> 253       pen 0.37 -> 0.41
    bay      20@9200       -5.0         -5.1       257 -> 252       pen 0.43 -> 0.38
    ocean    20@9300        0.0         +1.8       193 -> 196       180 -> 178 finish
    ocean    20@9320       -1.0         +4.8       193 -> 196       180 -> 179 finish
    arctic   16@9100    BYTE-IDENTICAL (verified over 300 s x 9 boats, and its two
                        golden traces pass with 0 behaviour changes)
    seatrials 100@100   199.15 / 194.73 vs 198.94 / 194.61 — +0.12 s on the median

Groundings on lake, counted properly — **as EPISODES, not as dedup'd contacts**
(a pinned boat generates ~5.5 contacts per episode, so the raw count flatters and
frightens in turn):

    HEAD    140 episodes over 3 races = 5.2 per boat-race
    LANDED   77 episodes             = 2.9 per boat-race   (-44%)

## ⚠️ OCEAN IS THE ONE BLEMISH, AND IT IS THE PROBE FLOOR

Pooled over 40 ocean seeds: paired med 0.0, mean **+3.3** (trimmed +1.4), finishers
360 -> 357. But the FAN ALONE on ocean measured -1.6 and -0.1 mean — so the mean cost is
the probe floor, not the fan. Ocean's boats are fast enough that the 240u floor only binds
at starts, roundings and penalty turns, which is exactly where a long probe reaches past
the mark they are working around, and it never saves them because there is nothing to hit.

⇒ `treeTIGHT`: the floor also requires TIGHT WATER (`_clear` at the boat under 6 cells,
~300u). That is a fact about where she is, not about which venue she is on — lake sits at
2-4 cells nearly everywhere, bay at 6-23, ocean in the open. Benching ocean and lake.


### ⛔ REJECTED: a land-only floored probe for ice venues (`treeARCLAND`)

The idea that survived the arctic rejection of the probe floor: a coastline does not move
even where there is ice, so look further ahead at the STATIC grid only, past where the
time-based probe already reached, as a graded hint with no hard veto. Glacier Sound takes
27.5 land contacts per boat-race, so there was something to win.

    arctic 16@9100   paired med +7.0  mean +8.6
                     finishers 139 -> 129, land contacts 27.5 -> 31.6, pen 1.64 -> 1.87

**So it is not about predicting through drift after all.** A land-only probe cannot be
wrong about where the land is, and it still cost time and finishers — which means the harm
from a longer probe on this venue is that it makes boats DEFLECT MORE, and deflecting more
inside the pack is what Glacier Sound punishes. That is the same finding as the twelve
avoidance re-pricings and tonight's clearance rejection, arriving from the other side:
on this venue the local layer is already deflecting too much, and anything that gives it
more reasons to deflect loses.

⇒ Four arctic rejections tonight (fan: ambiguous over 64 seeds and gated; probe floor;
enterable plugs; land-only probe). The venue's remaining deficit is NOT in the local
avoidance layer's inputs. Its own attribution says so: `boatBand` is 0.1% of deflections
and STATIC hard blockage is 39.2%, i.e. the fleet is threading walls, not traffic.

## ⚡ THE PROBE FLOOR NEEDS TIGHT WATER, NOT JUST STILL WATER (`treeTIGHT`)

The floor's justification was always "a boat slowed by a shore rub cannot see the next
shore". **Tight water is that condition stated directly** — and unlike `openWaterAv` it is
a fact about where the boat IS, not about which venue she is on.

    tightAv = gAv._clear[boat's own cell] < 6        (~300u, twice a hull's turning room)

    ocean 20@9300  vs the landed tree   paired med -5.0  mean -1.8   finishers 178 -> 179
    ocean 20@9300  vs pre-session HEAD  paired med  0.0  mean +0.3   <- fully neutral again

Ocean's +1.8/+4.8 mean was the floor binding at starts, roundings and penalty turns —
the only places its fast boats drop under 4 knots, and precisely where a 240u probe
reaches past the mark they are working around while there is nothing there to hit.
Lighthouse Cove sits at 6-23 cells of clearance (so the floor rarely applies, and it
measured inert there anyway); Stillwater Lake sits at 2-4 nearly everywhere, which is
exactly the water the floor was built for.

Benching lake (both sets) and bay to confirm the gain survives the narrower predicate.

## LAKE RE-ATTRIBUTED ON THE LANDED CODE — the landing hit what it aimed at

    leg 1 (beat)          HEAD                LANDED
    EXCESS                3781u               3011u   (-20%)
      avoid               1911u               1428u   (-25%)
        of which static    244u                 42u   (-83%)
        of which boat      988u                935u   (unchanged)
      turn                 333u                272u
      rec                  298u                171u
    mean deflection        45 deg              41 deg
    dist ratio             1.86                 —

    leg 2                 5752u               5185u   (-10%), avoid 2495 -> 2376,
                                                       rec 1240 -> 920, dev 51 deg both

**Static-cause avoidance is gone from the beat**, which is precisely what a land probe
that can see far enough should do. What is left on this venue is BOAT traffic (935u and
706u) plus off-route wandering (430u / 1124u), and a mean deflection still at 41-51 deg
against the human's 8 deg median / 24-27 mean.

⇒ The next lever on lake is not another cost or another probe. The action set is now
5.7 degrees fine from 0 to 0.8 rad and the fleet still chooses 41 degrees, which means the
COST FUNCTION IS DEMANDING A BIG MISS — `safeDist` (80-150u) evaluated over a 4-second
straight-line projection, against a human who passes at a 336-355u median CPA having
deflected 8 degrees. That is the bubble, and it is the one part of this function tonight
has not touched.
    bay   20@9100  vs the landed tree   paired med  0.0  mean -0.3   <- unaffected, as
    bay   20@9100  vs pre-session HEAD  paired med -3.0  mean -3.2      predicted from its
                                                                        6-23 cell clearance


# ⚡ THE FLEET'S OWN LEDGER (`_fleet_ledger.js`, new) — like-for-like at last

Every avoidance thread in this campaign has compared a FLEET number (mean per-tick
avoidance DEVIATION, from `_defl_hist` / `_transit_probe`: 44-51 deg) against a HUMAN
number (deflection per ENCOUNTER with deliberate tacks removed, from the ledger: 8 deg).
**Those are different quantities and always were.** This runs the ledger's exact
definition — encounter opens inside 600u closing, heading change at CPA measured against
the 5 s pre-encounter trend, tacks split out — on the bots.

    Stillwater Lake, no-tack encounters, deflection AT CPA

                  n     med     mean    p90     held course (<5 deg)   CPA med
      human      40    8.7     24.3    62.6           38%               312u
      FLEET     199   23.0     39.9    98.4           17%               299u

**At the same passing distance the fleet turns 2.6x as much and holds its course half as
often.** It also converts 69% of its encounters into a tack against the human's 49%, and
its tacked encounters pass closer (177u vs 201u).

So the over-deflection is REAL and now correctly sized: about 14 degrees of excess median
per no-tack encounter, at roughly 11 encounters per boat-race. It is NOT the 36-degree gap
the old apples-to-oranges comparison implied, which matters — several past candidates were
aimed at closing a gap that was partly an artefact of the two instruments disagreeing.

⇒ And it aims the next candidate precisely. The action set is now 5.7 degrees fine and the
fleet still picks 23 degrees at a 299u CPA, so what demands the swerve is the PREDICTION:
`safeDist` 80-150u evaluated over a 4-second straight-line extrapolation of both boats.
At 5 knots that is 300u of straight line for two boats who are both about to turn.
Bay, same instrument:

                  n     med     mean    p90     held course (<5 deg)   CPA med
      human     272    8.0     26.7    74.7           40%               355u
      FLEET     300   16.2     32.5    97.3           23%               259u

**She keeps a WIDER margin with LESS steering.** That is the shape of the whole thing: the
human positions early and passes clear; the fleet reacts late and hard and still ends up
closer. Tack rate says the same — fleet 50% of encounters vs her 35% on bay, 69% vs 49%
on lake.

## ⚡ NEXT CANDIDATE, ARGUED FROM SYMMETRY: the boat-conflict prediction has no horizon

`applyAvoidance` samples the boat-vs-boat closing at t = 0.8, 1.6, 2.4, 3.2, 4.0 s and
sets a HARD `boatCollision` if ANY of them falls inside `safeDist`. A crossing predicted
3.8 seconds out is exactly as decisive as one 0.5 seconds out.

The land probe two blocks below already refuses to do this in SPACE — hard veto inside
140u, graded beyond, because *"a probe that overshoots a gap into the ice behind it must
not veto the gap the router chose"*. **That argument is strictly stronger against a boat**,
because a boat is also steering: two straight-line extrapolations four seconds out are
300u of fiction each at 5 knots, and both boats are about to turn or tack.

`treeHORIZON`: hard only within 2.4 s; beyond that a graded 4000 falling to zero at 4.0 s.
Next tick sees the same crossing 0.8 s closer, so anything real becomes hard on its own.
Note this is NOT a re-pricing — it changes which candidate WINS (offset 0 becomes free when
the only conflict is three seconds out), which is the bar tonight's clearance rejection set
for this family.

### ⛔ REJECTED: making the probe floor require tight water as well (`treeTIGHT`)

It fixed ocean (paired 0.0 med / +0.3 mean against pre-session HEAD, from +1.8/+4.8) and
left bay untouched — but on lake it gives back half the landing's whole point:

    lake 20@9100 vs the LANDED tree    paired med +1.0  mean +0.3   flat on the clock
                                       land contacts 18.28 -> 27.56 (+51%), pen 0.96 -> 1.11
    lake 20@9100 vs pre-session HEAD   -43.0 med / -57.5 mean  (the landed tree: -53.0 / -58.6)
    lake 20@9200 vs the LANDED tree    paired med -1.0  mean +10.6   — both sets the wrong way

**Mechanism: the predicate reads `_clear` AT THE BOAT'S OWN CELL, and by the time she is
in tight water she is already committed.** The ratchet begins while she is still in open
water approaching a shore — that is exactly the moment the longer probe is supposed to
see the shore coming. Gating on where she IS answers the wrong question; the honest
version of this idea would gate on what is AHEAD, which is what the probe itself is for,
so the gate would be circular.

⇒ **Keep the shipped `openWaterAv` gate.** The trade is explicit and it is the right way
round: ocean pays +1.8 mean on a venue 14 s from the human, and lake keeps 10 s of median
and 9 land contacts a boat on a venue 129 s from her. Recorded so the next session does
not re-derive it.

### ⛔ REJECTED: shortening the boat-conflict prediction horizon (`treeHORIZON`) — and this one explains the thread

    lake 20@9100 vs the landed tree   paired med +13.0  mean +5.2
                                      BOAT contacts 3.62 -> 3.45, mark 1.85 -> 1.73
                                      LAND contacts 18.28 -> 26.49  (+45%)

It did what it was designed to do — the fleet held course through far-off crossings, and
boat and mark contacts both fell. It cost 13 seconds because **holding course longer makes
the eventual escape LATE AND LARGE, and in 150-350u corridors a late large escape ends on
the beach.**

⇒ **The fleet over-deflects because it must.** Its early reaction is not waste; it is what
keeps it off the shore. The human holds her course through the same crossings because she
POSITIONED for them — she arrives at the encounter already on a line that works, which is
why she passes WIDER (355u vs 259u on bay) while steering LESS (8.0 deg vs 16.2). The
fleet is reacting where she is planning, and no adjustment to the reaction's trigger,
price, resolution or horizon can convert one into the other. Tonight tested all four:

    resolution   densified fan            LANDED  -29 to -53 s on lake, -3 to -5 on bay
    price        clearance cost 10000->3000  ⛔    +11.0 and +1.0
    trigger      commitment lock fix         ⛔    +4.0
    horizon      hard only within 2.4 s      ⛔    +13.0

Only the one that gave the reaction MORE CHOICES paid. The remaining gap is a planning
gap, and the honest next candidate for it is lane choice on the approach to a crossing —
which is a strategic-layer change (`getStrategicHeading` / the router's carrot), not
another term in `applyAvoidance`. That function has now been measured from every side it
has.

# ⚡ THE PLANNING THREAD: positioning instead of reacting (`treePOSN`)

The horizon rejection said the fleet reacts where the human plans. So look at what early
signal exists at all: the boat proximity gradient is `5000/(distSq+10)` and it only runs
inside 250u. **At 250u that is 0.08**, against a deviation cost of 0.32 for a six-degree
turn. There is effectively NO long-range positioning signal in this function — every
correction it makes is necessarily a late one, and `treeHORIZON` measured what late
corrections cost in narrow water (+13.0 s, land contacts +45%).

`treePOSN` is deliberately the OPPOSITE of the candidate that just failed. Where the
horizon change made the reaction later, this makes it EARLIER AND SMALLER:

  - project both boats TEN seconds out (past every hard term's four), at 2 s steps
  - only for rivals between 200u and 600u — the ledger's encounter window, excluding
    anyone already close enough for the real terms to own
  - charge `6 * (1 - cpa/350)`, i.e. by how much closer than the human's median CPA the
    candidate would pass
  - sized to compete with the DEVIATION COST ALONE (0.32 at six degrees, 0.89 at twelve):
    it can buy a few degrees ten seconds early and can never outbid a collision term, a
    rule term, or any graded land cost — those are 10^3 to 10^5 larger
  - racing legs only, `normal` liveness only: the start pack is tuned to the boat-length

Benching lake and bay, and running `_fleet_ledger` on the candidate as well — the bench
gives the verdict, the ledger says whether the MECHANISM moved (does CPA widen and
deflection shrink toward 355u/8 deg, or did the clock move for some other reason).

## THE LEDGER ON THE CANDIDATE: the mechanism moved, and only half of it

`_fleet_ledger` on `treePOSN` vs the landed code, lake, no-tack encounters:

                          landed    +positioning    the human
      CPA median           299u        361u           312u
      encounters <150u      47          37             —
      deflection at CPA    23.0        27.3            8.7
      held course (<5deg)   17%         14%            38%
      tacked                69%         66%            49%

**They really do position wider** — the median passing distance moves past the human's own
312u and close encounters fall 21%. **But they buy the width with rudder**: deflection
went UP and course-holding went DOWN. The human gets width AND stillness; this gets width
by steering more, which is the thing it was built to avoid.

⚠️ This is why the ledger was run alongside the bench rather than after it. A clock result
alone — either sign — would have been read as "positioning works / does not work", when
what actually happened is that one of the two properties moved and the other moved the
wrong way. Whatever the bench says, the design conclusion is already available: **a
long-range CPA term produces early WIDTH but not early CALM**, because widening the pass
is itself a course change, and nothing in the term prefers achieving it sooner and
smaller.

## ⛔ THE WHOLE SHAPE IS WRONG, BY DOSE-RESPONSE — CPA-costed positioning cannot be "early and small"

Ran the amplitude at 6 and at 1.2 (the latter capped deliberately below the deviation cost
of a 14-degree turn, so it could only ever tip a near-tie). `_fleet_ledger`, lake, no-tack:

      amplitude      CPA med     deflection at CPA     held course (<5 deg)
      0 (landed)      299u            23.0                   17%
      1.2             329u            29.0                   15%
      6.0             361u            27.3                   14%
      the human       312u             8.7                   38%

**Cutting the term five-fold still widens the pass AND still raises the rudder**, and
course-holding falls monotonically with amplitude. This is not a constant that needs
tuning — it is the SHAPE of the term. A cost written on the projected CPA prices the
OUTCOME of a correction and is completely indifferent to WHEN the correction is made, so
the cheapest way for the argmin to satisfy it is always to turn now, a bit more. Early and
small and late and large look identical to it.

⇒ **Standing conclusion for the planning thread: to get early-and-small you must cost the
correction's LATENESS, not its result.** That means a term over the boat's own recent
heading history or over the schedule of the manoeuvre — not another function of the
predicted geometry. Every geometric term in this file has now been tried: distance
(clearance), time (horizon), outcome (CPA), resolution (the fan, which is the one that
paid) and commitment (the lock).

⚠️ And note the method: the DOSE-RESPONSE is what makes this a closed family rather than
one more rejected constant. Same discipline as the commitment thread's 1-second hold
control. One amplitude would have read as "needs tuning".
And the clock agrees with the ledger, on both venues:

    bay  20@9100 vs the landed tree (amp 6)   paired med +11.0  mean +8.4
                                              boat contacts 1.56 -> 1.77

⇒ `applyAvoidance` is now measured from every side it has: resolution (LANDED), price,
trigger, horizon, outcome-shaped positioning, and commitment. Only the action set paid.
The remaining traffic gap is a planning gap and it does not live in this function.

# ⚡ A NEW FAMILY: THE FLEET STALLS HEAD TO WIND (`_stall_probe.js`, new)

After the landing the fleet still spends 6.4% of its time on Stillwater Lake below one
knot against the human's 0.0%. Classified by cause (3 races, 580 of 9106 boat-seconds):

      ASHORE      (blocked cell within 2)   44.3%
      IN IRONS    (TWA < 35 deg)            31.5%
      PENALTY TURN                          19.2%   <- legitimate, a penalty turn is slow
      IN A HOLE   (local wind < 2.5 kt)      0.2%
      none of the above                      4.8%

      188 episodes over 3 races (~7 per boat-race), med 3.0 s, p90 5.3 s, max 8.1 s
      by leg: L1 221s  L2 192s  L3 161s — spread evenly, not one bad corner

**Two things fall out of this.**

1. ⛔ **The light air is NOT the cause of anything.** 0.2%. The fleet essentially never
   sits in genuinely calm water, which independently confirms the earlier decomposition
   (lake is a traffic-and-narrow-water venue that happens to be light, not a light-air
   problem). Anyone tempted by a glass-avoidance mechanism here should read this number
   first — and note it also explains why the router's sub-8-knot wind bins were worth
   only ~0.3 s.

2. ⚡ **A third of it is IN IRONS** — head to wind with no way on, about 6.8 s per
   boat-race, and NOTHING in this campaign has ever looked at it. The episode profile
   (many ~3 s stalls rather than a few long ones) is the signature of tacks that do not
   complete: in six knots a boat that starts a tack without enough way on stops head to
   wind, and the strategy layer has no concept of building speed before tacking. This is
   a STRATEGY-layer thread, not an avoidance one, which is the right place to be now that
   `applyAvoidance` is exhausted.

### ⛔ REJECTED (mechanism): extending the "no tacking without way on" guard to light air

The guard exists — `speed < 1.1 && wind > 16` — and its own comment says the failure it
prevents is a boat that "tacks slow and parks head-to-wind mid-turn". That is a
NO-MOMENTUM failure, so it should bite hardest in a drifter, and lake (7-9 kt) never gets
it. Added a separate light-air branch at a RELATIVE threshold (a third of close-hauled
target, ~1.4 kt on lake — the absolute 1.1 units is 4.4 kt and lake's fleet averages 4.1,
so the existing test would have forbidden nearly every tack there). Arctic's branch
untouched.

    `_stall_probe`, lake, 3 races      landed        + light-air guard
      in irons                        31.5% (183s)   28.7% (174s)   -5%
      ashore                          44.3% (257s)   50.7% (307s)   +19%
      episodes                        188            187            unchanged
      boat-seconds of racing          9106           9815           races got LONGER

    lake 20@9100 vs the landed tree   paired med +9.0  mean +10.2, pen 0.96 -> 1.20
    — the clock confirms the mechanism reading exactly.

**The stalls are not caused by the tack DECISION.** Blocking slow tacks left the episode
count identical to the boat and simply traded the failure mode: "sail on and build speed
close-hauled" keeps her on a board that is pointing at the shore, so ashore time rose 19%.

⇒ Something else is putting these boats head to wind. I have spent tonight attributing
DEFLECTIONS and never attributed this: the next probe should classify what the boat was
doing at the MOMENT she entered irons — a commanded tack, an avoidance swerve, a wiggle,
a rounding, or a penalty turn. Same shape as `_avwhy`, applied to a different event.
⚠️ Do not build another fix in this family until that exists.
And the clock, on both venues:

    lake 20@9100 vs the landed tree (amp 6)   paired med +17.0  mean +11.3
                                              boat contacts 3.62 -> 3.08 (it DID work)
    bay  20@9100 vs the landed tree (amp 6)   paired med +11.0  mean  +8.4

It reduced boat contacts exactly as designed and cost 11-17 seconds doing it. Family
closed on both the mechanism (dose-response) and the clock (two venues).
The clock dose-response matches the ledger's:

    amplitude 1.2   lake paired med  +3.0  mean  +9.1
    amplitude 6.0   lake paired med +17.0  mean +11.3   |  bay +11.0 / +8.4

# ⚡ WHAT ACTUALLY PUTS THE FLEET HEAD TO WIND (`_irons_entry.js`, new)

Rather than try a second fix in the stall family, attribute the ENTRY. 119 entries into
irons, lake, 3 races, classified by what the boat was doing in the two seconds before:

      AVOID     deflected into the no-go by avoidance    43.7%
      PENALTY   serving a turn (legitimate)              21.8%
      TACK      the strategy layer crossed the wind      19.3%
      WIGGLE    the unstick manoeuvre                    13.4%
      DRIFT     lost way and rounded up                   1.7%
      ROUNDING                                            0.0%

      duration med 1.8 s, p90 3.6 s
      speed TWO SECONDS BEFORE ENTRY: med 2.20 kt, p90 5.13 kt

**She was sailing when it started.** This is not light air killing a drifting boat — it is
her own escape steering her into the no-go. And it explains the previous rejection
exactly: tacks are 19.3% of entries, so gating slow tacks could never move the total by
more than that, and it moved it by 5%.

## THE DEFECT: the fan contains headings that are not courses

`applyAvoidance` taxes a candidate that CROSSES to the other tack (`taxTack`, 600·jamF)
and says nothing about one that simply lands head to wind — yet from close-hauled a
0.8 rad escape to windward IS the no-go zone. Nothing in the cost function knows that such
a candidate does not escape anywhere; the projection flies the boat along it at her
current speed, which is exactly the speed she is about to lose.

`treeNOGO`: tax a candidate by how far inside the no-go it lands (0 at ~31 degrees TWA,
500·jamF at head to wind), shaped and scaled like the tack tax beside it — waived for a
boat with no way on, and three orders below the Rule-14 terms so luffing head to wind
remains available when it is genuinely the only way out.

⚠️ Note this is an ACTION-SET change, not a re-pricing: it removes candidates that were
never sailable. That is the one class that has paid tonight.

## ⚡ THE NO-GO TAX MOVES ITS OWN MECHANISM — 71% of the targeted bin

`_irons_entry`, lake, 3 races:

                                        landed        + no-go tax
      TOTAL entries into irons           119            77      -35%
        of which AVOID-caused             52 (43.7%)    15 (19.5%)   -71%
        penalty (legitimate)              26            21
        tack                              23            19
        wiggle                            16            21

**The targeted bin fell by 71% and the total by a third, with the other causes broadly
unchanged.** That is the first candidate tonight whose mechanism moved exactly as designed
with nothing compensating: the light-air tack guard traded irons for groundings (ashore
+19%), the positioning term traded width for rudder (deflection up at every amplitude),
and this one simply removes the failure. The small rise in wiggle-caused entries is the
expected residue — the unstick manoeuvre still steers head to wind, and it is now a larger
share of a much smaller number.

Bench pending. ⚠️ If it lands, note WHY it is different from the six rejections around it:
it does not re-price a trade-off, it withdraws candidates that were never sailable. Same
class as the fan — the action set, not the cost.

## ⚡ AND IT LANDS ON THE CLOCK: -7.0 paired median on top of the landed tree

    lake 20@9100 vs the landed tree   paired med -7.0  mean -7.3
                                      boat contacts 3.62 -> 2.61 (-28%)
                                      pen 0.96 -> 0.97 (flat), 180/180 finish

**Mechanism and clock both moved in the intended direction with nothing traded away** —
the first candidate tonight to manage that besides the landing itself. Compare the six
rejections around it, every one of which bought its target with something else:

    tack guard      irons -5%      but ashore +19%, and +9.0 on the clock
    positioning     CPA +62u       but deflection +4 deg at both amplitudes, +17.0/+11.0
    horizon         boat rubs down but land contacts +45%, +13.0
    clearance       (nothing)                              +11.0 / +1.0
    commitment      (the lock is real)                     +4.0
    tight water     ocean fixed    but lake's groundings +51%

⇒ The pattern holds and is now five-for-five: **the changes that pay are the ones that
change WHICH ACTIONS EXIST — the fan added candidates that were missing, this one removes
candidates that were never sailable. Every change to the PRICE of a real trade-off has
lost.** That is the single most useful sentence in this file for the next session.

Confirming on lake 9200, and checking bay and arctic (this term is ungated — a no-go zone
is a fact about sailing, not about a venue — so both need to be measured).
    bay  20@9100 vs the landed tree   paired med -3.0  mean -1.8
                                      boat 1.56 -> 1.31, mark 0.68 -> 0.53,
                                      land 0.20 -> 0.12, pen 0.41 -> 0.37

Two venues, both faster and CLEANER on every contact class at once — which is the
signature of removing a bad option rather than trading one cost against another.
    lake 20@9200 vs the landed tree   paired med -3.0  mean -8.4
                                      boat 4.16 -> 4.13 (flat), mark 2.47 -> 1.99,
                                      ⚠️ land 21.23 -> 28.03 (+32%), one boat short

Three benches on two venues, all negative on the clock (med -7.0 / -3.0 / -3.0, mean
-7.3 / -8.4 / -1.8). ⚠️ **But note the land-contact behaviour is not consistent**: bay had
every class down, lake 9100 was +6% on land, lake 9200 +32%. A boat forbidden the windward
escape takes the leeward one, and on a narrow venue the leeward one is sometimes the
shore. The clock says the trade is worth it on every set measured so far; the honest
reading is that this is a trade, not a free win like bay's numbers alone would suggest.

## ⛔ ARCTIC REJECTS IT — and the gate is the same fact for the third time

    arctic 16@9100 vs HEAD   paired med +24.0  mean +28.2
                             finishers 139 -> 126
                             boat 7.66 -> 11.49, land 27.5 -> 32.9, floe 32.5 -> 38.1

**In an ice pack, luffing head to wind IS the right escape.** You stop, rather than hit a
floe that will not keep clear for you. The tax removes the fleet's best emergency option
on exactly the venue where the obstacles do not get out of the way — and arctic priced
that at 13 finishers.

⇒ **`openWaterAv` now gates three separate changes, and the reason has been the same each
time**: where the obstacle is drifting ice, a different set of facts holds — it does not
keep clear, its position is not predictable past a few seconds, and stopping is a
legitimate answer. That is not three venue hacks; it is one physical distinction the
avoidance layer did not previously make. **Anything future sessions add to this function
should be asked which side of that line it belongs on before it is benched.**

# ⚡ LANDED (2) `97a5559` — an escape into the no-go zone is not an escape

    irons entries     119 -> 77 (-35%); the avoidance-caused ones 52 -> 15 (-71%)
    lake 20@9100      paired med -7.0  mean -7.3   boat contacts 3.62 -> 2.61
    lake 20@9200      paired med -3.0  mean -8.4
    bay  20@9100      paired med -3.0  mean -1.8   every contact class down
    arctic            BYTE-IDENTICAL (300 s x 9 boats, and its golden traces pass)

**Both of tonight's landings are the same kind of change**: the fan ADDED candidates that
were missing, this one REMOVES candidates that were never sailable. Six candidates that
re-priced a real trade-off all lost. If there is one sentence to carry forward from this
session, it is that.

# ⚡ FINAL STATE OF THE 2026-08-06 PUSH

## Two landings, both the same KIND of change

    d55eb97  the escape fan densified (+-.3/.5/.7)      — ADDS candidates that were missing
    97a5559  an escape into the no-go is not an escape  — REMOVES candidates never sailable
    both gated on `openWaterAv`; a4d6f06 re-records the goldens

## Anchors (HEAD = a4d6f06)

    venue      pre-session      after        human      note
    lake       407.5 / 386.0    ~345 / ~355  223        two landings, both sets
    bay        257.0            ~250         226.2      -3.0 and -5.0, then -3.0 more
    ocean      193.0            193.0        182.5      inert by measurement
    arctic     535.0            535.0        ~222       BYTE-IDENTICAL, verified 3 ways
    seatrials  198.94 / 194.61  199.30 / 194.18, pen 0.348, OCS 14.89%, DNS/DNF 0%
    goldens    PASS 20/20 (re-recorded twice, verified twice)
    npm test   6 test_editor failures = the documented clean baseline
    test_sailable / check_venues  green on all ten venues

## THE ONE SENTENCE

**Change WHICH ACTIONS EXIST, not what they cost.** Seven-for-seven now:

    ADD candidates      densified fan          LANDED   -29 to -53 lake, -3/-5 bay
    REMOVE candidates   no-go tax              LANDED   -7.0/-3.0 lake, -3.0 bay
    price               clearance cost         ⛔ +11.0 / +1.0
    price               ice plug 6x -> 4x      ⛔ dead code, then +13.3 mean when enabled
    trigger             commitment lock        ⛔ +4.0
    horizon             hard only within 2.4s  ⛔ +13.0
    outcome             CPA positioning        ⛔ +17.0 / +11.0 (dose-response, 2 amplitudes)
    condition           tight-water floor      ⛔ +1.0 / -1.0 med but groundings +51%
    predicate           light-air tack guard   ⛔ +9.0

Require of any future candidate here: *why will this change which candidate WINS?*

## ⛔ REJECTED: a water-aware wiggle (`treeWIG`) — and it SHARPENS the session's rule

The unstick manoeuvre scans BOATS and MARKS for its nearest obstacle and then commits to
`windDir ± 1.75`; on a land venue the thing pinning her is LAND, which it has never looked
at, and the liveness comment already concedes the failure ("beam-reaches it straight back
into the same pocket"). `_irons_entry` said the wiggle was 27.3% of entries into irons
after the two landings — second only to penalty turns. Scored both escapes against free
water on the grid and took the better.

    mechanism   wiggle-caused irons entries  21 -> 14  (-33%)  <- the target moved
                but tack-caused              19 -> 32  (+68%)
                and avoid-caused             15 -> 32  (+113%)
                TOTAL entries                77 -> 103 (+34%)
    clock       lake 20@9100 vs the landed tree   paired med +18.0  mean +10.7
                boat 2.61 -> 3.42, mark 1.99 -> 2.43, land 19.4 -> 21.0, pen 0.97 -> 1.12

⚠️ **This was an ACTION-SET change and it still lost, which refines tonight's rule.** The
distinction is not actions-versus-prices by itself — it is whether the change REMOVES A BAD
OPTION or merely REDIRECTS TO A DIFFERENT ONE:

    fan        added candidates that did not exist         LANDED
    no-go tax  removed candidates that were never sailable LANDED
    wiggle     picked the other of two blind headings      ⛔ +18.0

    arctic 16@9100 vs HEAD   paired med +2.0  mean +13.5
                             finishers 139 -> 133, floe contacts 32.5 -> 39.4

Both venues, both directions of evidence. Choosing better between two bad options is still
choosing a bad option: the boat escapes into water she then has to tack or dodge out of,
and the two failures she trades into cost more than the one she avoids. **The sharpened
rule: DELETE OR ADD options; do not re-aim the ones that are there.**

⚠️ Note also that this candidate was benched on arctic WITHOUT a gate, on the reasoning
that "the grid knows where land is" holds equally in ice. It does — and it lost there too,
for the ordinary reason rather than the ice-specific one. Not every change in this function
divides along `openWaterAv`; this one is simply wrong everywhere.

## ⛔ REJECTED: footing and pinching on the beat (`treeFOOT`)

`getStrategicHeading` chooses between exactly TWO headings, `wd ± optTWA`, so this fleet
physically cannot sail a few degrees low to build speed through a lull or a few degrees
high to hold a lane — a two-element action set, argmin'd, one layer above the escape fan.
Added ±4 and ±8 degrees of trim on the CHOSEN tack only (every guard above compares
`preferredHeading` by identity, and the layline and no-way-on branches return earlier, so
the tack decision is untouched). `scoreTack` already prices exactly what footing trades.

    bay  20@9100 vs the landed tree   paired med  -3.0  mean  -1.4   252 -> 250
                                      but boat 1.31 -> 1.77, mark 0.53 -> 0.72,
                                      land 0.12 -> 0.35, pen 0.37 -> 0.48
    lake 20@9100 vs the landed tree   paired med +14.0  mean +16.5
                                      boat contacts 2.61 -> 4.58 (+75%)
    arctic 16@9100 vs HEAD            paired med +20.0  mean +16.3
                                      finishers 139 -> 134, land 27.5 -> 30.8

**Venue-split against the venue that matters.** Bay is faster and dirtier; lake — 4447
navigable cells, corridors 150-350u — is much slower, because a footed boat is a boat
sailing WIDER, and wide is exactly what that venue does not have. The extra option is
real and it is priced correctly; the problem is that on narrow water the price
`scoreTack` computes does not include what the wider track will cost her later in
traffic and shore contacts.

⚠️ It is worth noting what this shares with the wiggle rejection: both ADD or RE-AIM
options for a boat in open-ended water, and both lose on the venue where space is the
binding constraint. Tonight's two landings did not add freedom — the fan added
RESOLUTION between options that already existed, and the no-go tax REMOVED options that
were never real. **On a narrow venue, more freedom is not obviously good; more precision
and fewer illusions are.**
## ⛔ CLOSED BY MEASUREMENT: the missing SPEED action — the human does not use it either

`applyAvoidance` returns a heading and nothing else. The fleet's only avoidance action is
the rudder, and on Stillwater Lake the fleet sails ~1.5x the human's distance with roughly
half the excess spent on deflection — so "she eases the sheet and lets him cross, which
costs seconds and zero distance" is the obvious missing action, and a genuine action-set
change of exactly the kind that has produced both of tonight's landings.

It is wrong, and the recordings say so before any code was written. `_human_ledger.py`
already carried `dspd` (speed at CPA over speed at encounter onset); `_fleet_ledger.js`
now prints the same statistic, so the two are finally the same quantity:

    no-tack encounters      human spd@cpa   fleet spd@cpa   human slowed>10%  fleet
      Stillwater Lake            1.02           1.04              8%            9%
      Lighthouse Cove            1.02           1.02              1%            3%
    (human, ALL venues: 1.00-1.03; the largest "slowed" share anywhere is 8%)

**The human does not slow down for traffic, and neither does the fleet.** She keeps her
speed and either holds her course or moves the helm a little. There is no throttle gap to
close, on any venue, and the cost of learning it was one statistic already in the file.

What the same table does show is that the gap is entirely in the RUDDER, and it is a gap
in how OFTEN she uses it as much as by how much:

    no-tack, at CPA        deflection med      holds course (<5 deg)
      lake   human               8.7 deg              38%
             fleet              23.2 deg              18%
      bay    human               8.0 deg              40%
             fleet              16.6 deg              26%

## ⛔ REJECTED (lake) / OPEN (bay): a margin to leave the proper course (`treeDEAD`)

The escape is `if (cost < minCost)` with offset 0 first in the list, so holding course
wins only EXACT ties: a candidate cheaper by one unit takes the helm. Against the table
above that looks like the whole story, and the fix is one line. `_margin.js` (new) priced
it first, and the answer is venue-split for a reason worth keeping:

    per avoidance decision, leg>=1        lake            bay
      moved the helm                      51.6%           39.9%
      margin cost(0)-min   p10             236.9             1.6
                           p25            3389.8            55.4
                           med            7495.4          7539.8
      cost(0) itself       med           10133.8          7500.0
      a deadband of 100 converts           9.6%           39.4% of moves

**On lake the deflections are not near-ties.** The winner beats holding course by a
median 7495 against a cost(0) of 10134 — holding course is not narrowly rejected, it is
priced at ten thousand and buried. No deadband small enough to leave Rule 14 alone can
touch that, so the lake half of this candidate is closed without a bench.

Bay is the opposite shape — a quarter of its moves are decided by a margin under 55 —
and that half IS worth the bench it is getting.

## 📐 MEASURED: what the fleet actually chooses, and what it costs her to choose it

`_margin.js` records the winning offset on every avoidance decision. The distribution is
the most useful thing measured this session, because the campaign has spent twenty-odd
candidates re-pricing a cost function without ever looking at which candidate WON.

    share of helm movements, by size of the chosen turn
                      >=1.9 rad     1.4-1.9 rad    total >=1.4 rad
      Glacier Sound     15.0%          25.8%           40.8%
      Stillwater Lake   17.3%          17.0%           34.3%
      Lighthouse Cove    2.3%          16.8%           19.1%
    (>=1.9 rad is the near-reversal pair 2.2/3.0 = 126 and 172 degrees;
     the human's median deflection at CPA, same definition, is 8 degrees)

Two structural facts explain it, and neither is a tuning constant.

**1. The near-reversals are gated on the COURSE, not on the boat.** `candidates.push(2.2,
-2.2, 3.0, -3.0)` fires whenever `state.course._gridFixed` is non-empty — "this venue has
authored land" — so on every land venue a 172-degree turn sits in the fan for the entire
race. The comment above it says they are "the only exit when nosed into a berg or wall",
which is a description of a PREDICAMENT that nothing in the gate tests. The 250 surcharge
below is waived under 1.0 kt, i.e. exactly when a boat pinned in narrow water is slow.

**2. Leaving your proper course is priced three orders of magnitude below arriving at a
rock.** The whole deviation term is `Math.pow(Math.abs(offset), 1.5) * 10`:

      172-degree reversal     52          proximity to a floe     3500
      92-degree swerve        20          proximity to land      25000
      17-degree nudge          0.7        hard constraint       500000

This is the missing piece behind a long line of rejections. Twelve candidates re-priced
avoidance and "the mean deflection never left 44-48 degrees"; the clearance cost was cut
10000 -> 3000 and was INERT. Every one of them lowered a THREAT cost — and 25000 -> 8000
leaves a 52-point U-turn just as free as it was. **The deviation side had never been
raised.** That is not a tuning knob at its knee; it is a term that has never been in the
same units as the function it lives in.

Post-landing decomposition confirms the shape of what is left (`_transit_probe`, HEAD,
lake 6 seeds): the two landings cut L1 excess 3781 -> 3342u and L2 5752 -> 4032u, but the
mean deviation is unchanged at 44/50 degrees and avoidance is still ~half of all excess
distance. **The races got shorter; the dodges did not get smaller.**

### The same turn, measured on both sides (`_hdgrate.js` new, + the recordings)

⚠️ A COMMANDED OFFSET IS NOT A REALISED TURN. The 34-41% above is what the argmin picked;
the boat swings toward it at a limited rate, so a 172-degree command does not produce a
172-degree second. Before leaning on that number, here is the quantity the recordings
actually contain — heading now vs heading 1 s ago, 10 Hz, racing legs, both sides:

                    med    p90    p99   >=45 deg/s  >=80 deg/s
      lake human    1.7   29.0   60.2      5.46%       0.00%   (0 of 6041 windows)
      lake fleet    7.6   50.0   65.5     13.66%       0.75%
      bay  human    0.0   26.2   55.0      5.04%       0.00%   (0 of 27784 windows)
      bay  fleet    3.4   43.0   63.9      9.31%       0.06%
      (arctic human 0.04% >=80; ocean human 0.00%)

So most of the commanded reversals are absorbed by the rate limit — 17.3% commanded
becomes 0.75% realised — and the honest headline is smaller than the raw share suggested.

**But the venue ratio survives the conversion, which is the check that matters.** Lake
commands 7.5x more near-reversals than bay (17.3% vs 2.3%) and realises 12x more hard
turns (0.75% vs 0.06%). The commanded distribution is predicting the realised one across
venues, so it is measuring something real and not an artefact of the fan's spacing.

And the plain comparison stands on either quantity: **the fleet turns 4.5x as much as the
human at the median on lake and 2x as often past 45 deg/s, and she never once turns 80
degrees in a second on any venue but Glacier Sound.**

## ⚡ THE DEVIATION TERM IS OUT OF SCALE — and that is why the re-pricings were inert

Raising `pow(|offset|,1.5) * 10` to `* 1000` (`treeDEV`, no other change):

    lake 20@9100 vs HEAD   paired med +44.0  mean +52.6   349 -> 300, max 675 -> 482
                           pen 0.97 -> 0.83, mark 1.99 -> 1.06, land 19.4 -> 15.9
                           BUT boat contacts 2.61 -> 4.63, and 1 boat DNF
    bay  20@9100 vs HEAD   paired med  +9.0  mean  +7.7
                           BUT mark contacts 0.53 -> 2.07 (4x), land 0.12 -> 0.42,
                           pen 0.37 -> 0.54, 1 boat never rounded, OCS 0.0 -> 0.6%

**Both venues get faster and bay breaks.** The mechanism is legible: a mark rounding IS a
sustained small deviation, and a flat 100x tax on deviation makes the boat resist the
wide swing the rounding needs. The term was out of scale; multiplying it uniformly fixes
the scale and breaks the shape.

So raise the POWER, not the coefficient — `pow(|offset|,3) * 200` (`treeDEVP`):

      offset    0.3    0.8    1.6    3.0
      was       1.6    7.2   20.2   52.0
      *1000   164.0  716.0 2024.0 5196.0     <- taxes the rounding too
      pow3*200    5.0  102.0  819.0 5400.0   <- same U-turn price, small dodge still free

This prices the 172-degree reversal identically to the flat version and leaves a
17-degree nudge at 5 points. It taxes only the manoeuvres the human never makes: she
turns >=80 deg/s in 0 of 6041 lake windows and 0 of 27784 bay windows.

⚠️ **A PRICE CHANGE IS BEATING THE ACTION-SET CHANGES, and the thesis needs amending
rather than defending.** Both of tonight's landings changed WHICH ACTIONS EXIST, and the
standing rule said re-pricing loses. It does — when the price is already in the right
order of magnitude. A term three orders of magnitude below everything it is compared
against is not a mistuned knob, it is a structural bug, and the twelve inert re-pricings
were all on the OTHER side of the ratio (they lowered threat costs; 25000 -> 8000 leaves
a 52-point U-turn just as free). Amended rule: **check that a term is in the same units
as the function before concluding that its value does not matter.**

## ⚡ THE NEAR-REVERSAL GATE — the effect size tracks the measured share, on all three venues

`candidates.push(2.2, -2.2, 3.0, -3.0)` now requires that a hard grid cell actually lies
within ~180u dead ahead (the same test the unplanned-tack waiver uses), and racing legs
only. `treeNOSE2`:

    venue    share of moves >=1.9 rad     paired median        contacts
    lake              17.3%              +41.0 (349 -> 307)   land 19.4 -> 9.6, mark 2.0 -> 1.0
                                          mean +49.1          pen 0.97 -> 0.77, boat 2.61 -> 3.32
                                          max 675 -> 516, min 229 -> 223
    arctic            15.0%              -23.0 faster         land 27.5 -> 25.4, floe 32.5 -> 36.4
                                          (535 -> 511)        pen 1.64 -> 1.96, boat 7.66 -> 12.9
                                          139 -> 139 finishers
    bay                2.3%               +0.5 / mean -1.4    INERT, OCS clean
                                                              pen 0.37 -> 0.44

**The size of the win is predicted by the measured share of the fan that these candidates
win, on three venues with three different values.** That is the strongest mechanism
confirmation this campaign has produced — the number was measured BEFORE the bench, and
bay's 2.3% correctly predicted its own null result.

Two independent reasons the old gate was wrong:
  1. it tested a property of the COURSE (`_gridFixed` = "this venue has land"), never of
     the boat's predicament, so a 172-degree turn sat in the fan for the whole race;
  2. the predicament it names — nosed into a wall — is already owned by `wiggleActive`,
     which returns out of `applyAvoidance` at the top and fires after 3 s below speed.

⚠️ **This is the first change of the session to move Glacier Sound.** All three prior
landings are `openWaterAv`-gated and leave it byte-identical. It is also the only venue
where the trade is not clean: 23 s a boat against +20% penalties and +68% boat contacts.
Arctic is being re-run on a disjoint 16-seed set before any decision — a 16-seed arctic
set cannot resolve under ~15 s, which is why the paired per-boat median is the statistic
being read.

## THE LANDING DECISION: the gate alone, not the pair

Both candidates work on lake and they overlap. Four disjoint 20-seed sets:

                          lake 9100   lake 9200   bay 9100   bay 9200
      nose gate alone       +41.0       +55.0       +0.5      -2.5      (med 349->307, 350->303)
      pow3*200 alone        +34.0         --        +5.0        --
      both together         +56.0       +46.0       +5.0        --      (med 349->295, 350->303)

Pooled over both lake sets the gate alone averages ~+48 s and the pair ~+51 s — **the same
win inside the noise** — and they differ sharply in what they cost elsewhere:

      bay penalties/boat    HEAD 0.37 | gate 0.44, 0.45 | pow3 0.49 | both 0.57
      bay boat contacts     HEAD 1.31 | gate 1.51, 1.73 | pow3 2.31 | both 2.68

So `treeNOSE2` lands and `treeDEVP` does not. The pair buys ~3 s of lake for +54% bay
penalties, and the owner's standing preference is that dirtier sailing is worse than
slower sailing.

⚠️ **`treeDEVP` IS NOT REJECTED — it is a real, unlanded effect** (+34.0 lake, +5.0 bay,
mark contacts held at 0.53 -> 0.56 where the flat 100x version sent them to 2.07). It is
the correct fix for a term that is genuinely out of scale, and it should be revisited with
the deviation cost made proportional to something physical — the DISTANCE the deviation
actually costs over the lookahead, `speed * t * (1 - cos(offset))` — rather than a
hand-set power. Its bay penalty cost is the sign that a flat shape is still the wrong one.

⚠️ **Contact counts do not replicate at 20 seeds; the clock does.** The gate's lake boat
contacts went 2.61 -> 3.32 on set 1 and 4.13 -> 3.96 on set 2 (opposite directions), and
its bay penalties went +19% then +5%. Both lake clock numbers agree (+41, +55) and both
bay clock numbers agree (inert). Read the clock; treat a single-set contact delta as a
hypothesis.

### ✅ The arctic baseline was verified rather than assumed

`fleet_leg2_headarc.json` was recorded at 23:17, BEFORE both of tonight's landings, and
every arctic comparison in this session is measured against it. That is only legitimate if
the `openWaterAv` gating really does leave Glacier Sound untouched — a claim, not a fact.
Re-ran HEAD arctic 16@9100 on the verified-HEAD tree (`headarcT`, `treeNOGO2`):

      headarc  (23:17, pre-landing tree)  139 finishers  med 535  mean 545.3
      headarcT (true HEAD, treeNOGO2)     139 finishers  med 535  mean 545.3

Identical on every statistic. The gating holds and the arctic numbers stand. ⚠️ Worth the
16 seeds: the session had already been burned once by a stale tree (`treeLANDED` turned
out to predate the no-go tax, and three decomposition probes had to be re-run against
`treeNOGO2`).

## ✅ LANDED `b566370` — BOTH changes, after arctic reversed the decision

The earlier entry concluded "the gate alone, not the pair". **Arctic overturned that**, and
the reason is worth keeping: the gate-alone verdict was reached from lake and bay only,
where the two candidates overlap almost completely. On Glacier Sound they do not.

    paired median vs HEAD, two disjoint sets per venue (NEGATIVE arctic = faster)
                        lake 9100  lake 9200 | bay 9100  bay 9200 | arctic 9100  9200
      gate alone          +41.0      +55.0   |   +0.5     -2.5    |   -23.0     -38.0
      both together       +56.0      +46.0   |   +5.0     +2.5    |   -71.0     -86.0
      arctic finishers                                            | 139->142  123->142

The pair roughly DOUBLES the arctic gain and ties on lake. Arctic is the venue furthest
from the human (535 against ~222) and it gains ~78 s a boat plus up to nineteen more
finishers; declining that to spare bay one extra boat rub is the wrong trade.

**Landed, and what it cost.** Reported rather than buried:

      bay boat contacts   1.17 -> 2.26 and 1.31 -> 2.68 (roughly double, BOTH sets)
      bay penalties/boat  0.43 -> 0.52 and 0.37 -> 0.57 (~+35%)
      bay land contacts   0.13 -> 0.04 and 0.12 -> 0.24 (disagree)
      bay mark contacts   0.73 -> 0.52 and 0.53 -> 0.56 (down / flat)
      lake land contacts  19.4 -> 9.9   arctic land 32.9 -> 27.7, mark 0.74 -> 0.60

Boats hold straighter lines, so they pass closer and touch each other more. Every venue is
faster on the clock and no venue loses finishers; bay pays in boat-on-boat contact.

### Where the two venues' numbers now stand against the human

      Stillwater Lake   407.5 at session start -> 295-303   (human 223)
      Glacier Sound     535 -> 462                          (human ~222)
      Lighthouse Cove   252 -> 245                          (human 226.2)
      Ocean             193, untouched                      (human 182.5)

## ⚠️ FOUND WHILE VERIFYING: the escape fan has no `leg >= 1` guard, and it costs OCS

Post-landing seatrials showed OCS 21.11% against a 14.89% figure recorded earlier tonight.
The 14.89% does not reproduce, so the discrepancy was bisected with ONE command against
four commits, and the answer is not this landing:

      b60ba9d  pre-session (owner's gust fix)   OCS 16.67%   race mean 201.25
      d55eb97  the densified escape fan         OCS 21.11%   race mean 197.03
      97a5559  the no-go tax                    OCS 21.11%   race mean 200.29
      b566370  tonight's landing                OCS 21.11%   race mean 197.38

**The fan cost 4.4 points of Clubhouse OCS when it landed, and the check at the time did
not catch it.** The mechanism is the one this session then learned twice more the hard way:
`const candidates = openWaterAv ? [...]` carries NO racing-leg guard, so the densified fan
reshapes the START, and Clubhouse is an open-water venue where it therefore always applies.
The deadband (0 -> 1.7% OCS) and the near-reversal gate (0 -> 2.2%) both did the same thing
on Lighthouse Cove and both were fixed with `leg >= 1` before landing.

Restricting the fan to racing legs (`treeFANG`) recovers it exactly:

      HEAD          OCS 21.11%   start mean 5.83   race mean 197.38  median 194.30
      fan-gated     OCS 16.67%   start mean 4.89   race mean 199.80  median 194.28
                        ^ back to the pre-session baseline to the digit

Benching on lake and bay now to confirm the fan's racing-leg gains survive the gate — the
fan was landed for -29.0 lake and -5.0/-2.0 bay, all of which are racing-leg effects.

⚠️ **STANDING RULE, now earned three times in one session: every term in
`applyAvoidance` needs `this.boat.raceState.leg >= 1` unless it is deliberately tuning the
start.** The tack tax and the no-go tax already carried it; the fan did not, and nobody
looked because the fan was measured on race time, not on OCS.

# ═══ SESSION CLOSE — 2026-08-06 overnight push ═══

## What landed

    d55eb97  densified escape fan + land probe as a DISTANCE   (earlier in the session)
    97a5559  an escape into the no-go zone is not an escape    (earlier in the session)
    b566370  near-reversals gated on the boat, and the deviation cost put in scale
    b85935d  the escape fan restricted to racing legs

## Where the fleet stands against the human

                      session start      close       human      gap closed
      Stillwater Lake     407.5          ~295         223          64%
      Glacier Sound       535            462         ~222          23%
      Lighthouse Cove     252            ~245        226.2         27%
      Ocean               193            193         182.5          0%   (untouched)
      Clubhouse           OCS 16.67%     16.67%       —            n/a   (restored)

## Verification at close

    golden traces   PASS 20/20, 0 behaviour changes (re-recorded twice — the first
                    run was corrupted by a git checkout during a background verify)
    seatrials       OCS 16.67% (= pre-session baseline), median 194.28, DNS/DNF 0.00%
    npm test        6 failures, byte-identical on pre-landing code (test_arena +
                    test_editor, all pre-existing)
    arctic baseline verified byte-identical to true HEAD before its comparisons were used

## The three rules this session earned

1. **A term in the wrong ORDER OF MAGNITUDE is a structural bug, not a knob.** Twelve
   re-pricings were inert because every one lowered a THREAT cost; the proper-course term
   sat three orders of magnitude below them and had never been raised. Amends, rather than
   overturns, "change which actions exist, not what they cost" — a price at the right order
   IS a knob, and knobs have all lost.
2. **Every term in `applyAvoidance` needs `leg >= 1`.** Three separate terms leaked into
   the prestart in one night, one of them already landed and shipping.
3. **Read the clock, not the contact counts.** Contact deltas flipped sign between 20-seed
   sets on every candidate tested; the paired clock median replicated every time.

## Open, with evidence, for whoever picks this up

  - ⚠️ **`treeDEVP`'s successor**: make the deviation cost proportional to the DISTANCE the
    deviation actually costs over the lookahead — `speed * t * (1 - cos(offset))` — instead
    of a hand-set power. The shipped pow3*200 is the right shape found by hand; the
    physical version should be better and would explain itself.
  - ⚠️ **Bay boat-on-boat contacts doubled** with this landing (1.17 -> 2.26, both sets).
    Bay is the venue closest to the human and the one paying for the other two.
  - **Arctic's biggest excess bin is now `offrt` (3630u), not `avoid` (2594u)** — being off
    the planned route, with xtrack mean 867u and the carrot jumping 20.6x a minute. That is
    a routing-churn problem and nothing this session touched addresses it.
  - **Mark 5 on Stillwater Lake sits in 100u of clearance**, tightest in the game by 2x,
    worth ~10-15 s. An authoring fix, not a tuning one.
  - **The router's 6x ice-plug price is dead code** (`pathSailable` admits only `_soft===1`).

## ⛔ REJECTED, and it explains the shipped shape: the PHYSICAL deviation cost (`treePHYS`)

The session-close entry named this as the obvious successor to the hand-tuned `pow3*200`:
what a deviation actually costs is PROGRESS, so price it as the distance given up over the
lookahead, `K * speed * t * (1 - cos(offset))`, with K=5 chosen to match pow3*200 at the
172-degree reversal so the two are comparable at the top of the range.

    vs the shipped term, 20@9100 each
      lake   paired med +5.0 / mean +2.0 faster   BUT land contacts 8.04 -> 15.90 (2x)
                                                  and 180 -> 179 finishers
      bay    paired med +1.5 / mean +2.5 faster   contacts ~neutral, pen 0.46 -> 0.47

**A wash on the clock, and it gives back half of what the land probe and the near-reversal
gate were landed for.** The mechanism is in the units:

    const speed = Math.max(2.0, boat.speed * 60);   // ranges 2 (stopped) to ~120 (fast)

That is a SIXTY-FOLD span, so the physical cost of a 172-degree reversal is 5400 for a boat
at speed but **80 for a boat nearly stopped** — and the boat that most needs restraining is
exactly the slow one pinned against the shore, where lake takes 81% of its groundings.
The physics is right about the world and wrong about the control problem: the term is not
paying for lost distance, it is holding a boat to her course, and a boat with no way on
still needs holding.

A speed floor would repair it — but a floor is speed-independence, which is what
`pow(|offset|,3) * 200` already is. **This is a rejection that explains the landing**: the
shipped shape is not a hand-tuned stand-in for a physical law that nobody got round to
deriving. Speed-independence is the feature.

## 📐 ARCTIC, AFTER THE LANDING: the excess is PLAN INSTABILITY, not plan quality

With avoidance now much improved, Glacier Sound's biggest excess bin is no longer `avoid`
(2594u) but `offrt` (3630u) — being off the planned route. `_route_attrib` on post-landing
HEAD (6 seeds, 54 boat-races, 1 Hz) says that bin is misnamed:

      plan / dmc-remaining ratio    med 0.79   <- the plan is SHORT, not long
      boat off its OWN plan         med  96u   <- she follows it faithfully
      cross-track to the ruler      med 403u
      plan waypoints                mean 118
      seconds with NO plan          0.0 of 184

**At every instant the plan is efficient and the boat is on it — and the odometer still
runs 1.67x the ruler.** Neither of the two stories the probe was built to separate is
true: it is not ROUTER POLICY (the plan is 0.79x) and it is not EXECUTION (96u off). The
excess lives in the third place, which is between the samples: the plan is re-solved
constantly and the SEQUENCE of plans wanders. `carrotJump` is 20.6 per minute on the return
leg, xtrack mean 867u. The boat does something locally sensible twenty times a minute and
integrates to 1.67x.

⚠️ **This is the pathology the SIPP research named and it is NOT what SIPP was retired
for.** That thread was cancelled on a measurement — floe drift is not predictable past ~5s,
so a plan that assumes known drift is worthless. Plan STABILITY is a separate claim and
does not require prediction: committing to a chosen plan for N seconds, or a time-indexed
carrot that cannot be re-adopted backwards, both kill churn by construction without
forecasting anything.

⚠️ **But note what this session did to that family**: hysteresis and commitment have been
rejected TEN times at the avoidance layer. Nothing has tested them at the ROUTING layer,
which is a different loop with a different time constant — a route commitment of a few
seconds is not the same object as holding an escape heading for one. That is the honest
next candidate, and it should be built with the measurement above as its target: drive
`carrotJump` down and see whether the 1.67x follows.

**Not attempted here** — a routing change needs 16-32 seed arctic sets to resolve, which
did not fit the remaining window. Handing it over measured rather than half-benched.

### ⚠️ CORRECTION to the entry above — `carrotJump` does not support a churn story

The entry above concluded "the excess is plan instability" and named a route-commitment
candidate. **Two further measurements withdraw that conclusion**, and the second is another
instance of this session's recurring trap: a statistic that does not measure what its name
suggests.

**1. The map is stable, and so are the re-solved plans** (`_map_validity`, arctic):

      H(s)   floe cells that flipped    plan difference over the first 2000u
        4            3%                          8-12u
        8            5%                         13-17u
       16            8%                         15-36u
       30           30%                        114-278u

Over the 4-8 s horizon the router actually re-plans on, the map barely moves and two
independently-solved plans agree to within noise. So the plan is not thrashing because the
ice moved — the premise a commitment fix would be built on is already satisfied.

**2. `carrotJump` counts the LOOKAHEAD changing, not the plan changing.** It increments
whenever the nav target moves >150u between 1 Hz samples (`_transit_probe:220`). But the
target is a pure-pursuit point at distance `LOOK` ahead, and `LOOK` is not constant:

      LOOK = clamp(clearance * res * 1.2, 250, 900)        // scales with sea room
      if (xtk > 150) LOOK *= max(0.4, 1 - (xtk-150)/400)   // shrinks with cross-track

so a clearance change or a cross-track excursion moves the carrot hundreds of units in one
sample **by design** — that is the cross-track controller steepening the recovery angle,
which is the behaviour the comment above it argues for. Counting those as "churn" and then
fixing them would be removing a working controller.

⛔ **So the arctic 1.67x odometer is NOT yet explained**, and the honest state is: not
router policy (plan 0.79x), not execution (96u off plan), not map decay (3-5% at 4-8 s),
and not carrot churn on the evidence offered. **Do not build the route-commitment
candidate on this** — the family already carries ten rejections at the avoidance layer and
this would be an eleventh built on a mis-read statistic. The next step is a probe that
measures the carrot's motion ALONG the path separately from `LOOK`'s contribution, which
nothing currently does.

## ⚡ ARCTIC, THE REAL SHAPE: the router re-solves at its FLOOR and still changes its mind

`_replan.js` (new) counts what `carrotJump` does not — how often `pathSailable` is actually
re-solved, which the controller marks by resetting `gridAge`. Arctic, 4 races, 16423
boat-seconds:

      FULL RE-SOLVES                          5.5 /min per boat
        (the thread is held 2 s minimum and ages out at 12 s, so ~5/min IS the floor)
      new-vs-old path departure at 250/500/1000u ahead:
        med 177u   p75 460u   p90 845u   max 2796u
      re-solves returning essentially the SAME corridor (<100u):   33%
      carrot movement per 0.1 s sample:  med 0u   p90 71u   p99 290u

**The router is not thrashing — it replans as rarely as its own design permits — and it
still changes its mind about the corridor two times in three.** Put beside the map
measurement, the mechanism is legible and it is not drifting ice:

      re-solve from a FIXED point, 4-8 s apart   ->  plans differ by 8-17u
      re-solve from where the BOAT actually is   ->  plans differ by 177u median

Between replans the boat has sailed ~12 s. The ice barely moved (3-5% of cells flip at
4-8 s), so the near-identical map is yielding a materially different plan **because the
start point moved**. That is not decay, it is **solution instability**: the
clearance-weighted grid holds several near-equal corridors, and a small change in where
the search starts flips which one wins.

⚠️ **This is tonight's finding one layer up.** `applyAvoidance` was an argmin with near-ties
and no preference for the incumbent heading, and the fix was to make holding course
meaningfully cheaper. `pathSailable` is an argmin with near-ties and no preference for the
incumbent CORRIDOR. The candidate is therefore a hysteresis in the ROUTER'S COST — a
discount on cells the previous path already used — and NOT the route-commitment-in-TIME
candidate this log proposed two entries ago, which is already satisfied (5.5/min is the
floor) and which would have been an eleventh rejection in the commitment family.

**Not benched** — a routing change needs 16-32 seed arctic sets and the window closed.
Handed over measured, with the instrument (`_replan.js`) that scores it: drive "same
corridor" up from 33% and see whether the 1.67x odometer follows.

### ⚠️ ...and the third venue refutes the tidy version of that story

The entry above was one measurement away from claiming that router instability explains
arctic's gap. It does not. All three land venues, same probe:

      venue    re-solves/min   departure med   SAME corridor   gap vs human
      arctic       5.5             177u            33%            2.08x
      bay          5.4             121u            38%            1.08x
      lake         4.5              94u            50%            1.32x

**Bay is LESS stable than lake and far closer to the human.** The near-reversal share
predicted its own effect across three venues (17.3 / 15.0 / 2.3% → +41 / -23 / inert) and
that is why it was trustworthy; this statistic does not. So:

  - the instability is REAL and it is UNIVERSAL — every venue replans at its floor and
    still changes corridor half the time or worse. It is a property of `pathSailable`, not
    of any venue's ice or geometry;
  - it therefore CANNOT by itself be why Glacier Sound is 2.08x the human while Lighthouse
    Cove is 1.08x. Something else carries arctic's gap and is still unidentified;
  - a router-cost hysteresis is still the right candidate, but it is a GLOBAL change with
    no prior reason to expect arctic benefits most. Bench it on all three, expect the
    effect to track nothing in particular, and let the clock decide.

⚠️ Recorded this way on purpose. Two candidates were nearly published tonight on a
correlation that a third data point would have killed — and the one instrument this
session trusted most (`_margin.js`) earned that trust by predicting bay's null result
BEFORE the bench. A cross-venue statistic that does not predict is not a mechanism.

## ⚡ ARCTIC'S GAP, AT LAST: the fleet hits the ice 23 times a race. The human hits it once.

The harness counts fleet collisions directly and the recordings carry no collision field,
so the two sides have never been compared — the same apples-to-oranges gap that hid the
traffic numbers for months. `_thump.js` (new) uses a detector BOTH sides support: speed
falling >40% in one 0.1 s sample from above 1 knot, which is what a contact looks like
(a hit costs ~60% of speed). Identical rule on recordings and on live boats.

      venue    fleet/race  fleet/min  knots shed/race  HUMAN/race  gap vs human
      arctic      23.0        3.0          73.3           1.2         2.08x
      lake         3.9        0.8          10.5           0.0         1.32x
      bay          1.6        0.4           5.3           0.0         1.08x
      (4 races x 9 boats per venue; human from 22/3/13 recordings)

**The ordering matches the gap ordering exactly**, which is the property the router-
instability statistic failed to have (33/38/50% "same corridor" against 2.08/1.08/1.32x —
no relation). This one predicts, so it is worth building on.

And the arctic row carries its own control. It is not "Glacier Sound has more ice": the
human sails the SAME ice on the SAME course and takes 1.2 hits a race against the fleet's
23.0 — **nineteen times fewer, and ten times fewer per minute.** The fleet sheds 73 knots
of speed per boat-race in impacts, which at a ~4.5 kt cruise is roughly sixteen dead stops.

⚠️ Contact-avoidance has been worked on all session and this is what is LEFT after it:
the near-reversal gate cut arctic's land contacts 32.9 -> 27.7 and mark 0.74 -> 0.60 while
floe contacts went UP 34.0 -> 38.3. **Floes are the untouched class**, and they are the one
whose obstacle drifts — which is exactly why every open-water fix this session was gated
away from them. The next candidate should aim at the floe-contact rate specifically, with
`_thump.js` as its scoreboard, and it should be judged on the human's 1.2 rather than on
an incremental improvement over 23.

### ⛔ ...and it is NOT the ice fan's resolution (`treeICEFAN`, measured on the new statistic)

The densified escape fan was gated off Glacier Sound because four 16-seed sets could not
tell it from zero on the CLOCK (+4.0, -9.0, -13.0, +10.0; pooled -4.0). The impact rate is
a far sharper instrument than race time, so the question was worth re-asking with it.
Giving the ice branch the same density as open water:

      HEAD          23.0 thumps/boat-race   3.0/min   73.3 kt shed
      ice fan       23.1 thumps/boat-race   3.2/min   71.8 kt shed

**Inert, and now unambiguously so.** Two things follow. The arctic gate on the fan was the
right call and is confirmed by a better statistic than the one that made it. And more
usefully: **the impact rate is not limited by the resolution of the escape options.** The
fleet is not hitting ice because it lacked a fine enough dodge.

Two further causes were checked in the code and are already handled correctly, so do not
spend a session rediscovering them:

  - **floe drift IS predicted, not padded** (`applyAvoidance` ~3160): each floe is tested
    where it WILL BE at mid-lookahead via `driftVx * tMid`, with the honest margin being
    prediction error rather than a blanket pad. The 4 s lookahead sits inside the ~5 s
    window drift was measured to be predictable over, so this is sound;
  - **floes are skipped here only when the trajectory planner already steered this tick**
    (`_trajFloe`), to avoid double-vetoing the thread it chose.

So the 23-per-race is caused by something other than escape resolution, drift blindness,
or double-counting. That is three eliminations and no answer — recorded as such, because
the next session should start from the elimination list rather than from these three.

### ⚠️ `_thump.js`'s impact CLASSIFIER is geometrically biased — do not trust its split

`_thump.js` counts impacts reliably (that is the number in the table above, and both sides
use the same rule). An attempt to also classify WHAT was hit — nearest object at the moment
of the thump — reported **100.0% land, 0 floes, on a course carrying 112 floes.** A
statistic that lands on exactly 100% is a bug, per the standing rule.

The first cut used signed `dist - radius`, which is hugely NEGATIVE everywhere inside
arctic's enclosing shoreline ring, so that ring won every comparison. Switching to distance
to the EDGE, `|dist - radius|`, changed nothing, and the reason is not a coding error:

      arctic land radii: 8685, 3245, 2787, 1137, 869, 650 ...   floe radius ~69

A 2787-radius island has an enormous circumference, so a boat is almost always within a few
hundred units of SOME point on its edge; a 69-radius floe qualifies only when she is right
beside it. Sampled at random moments (not at impacts) the same classifier reads 8 land to
1 floe. **"Nearest edge" is not "what she hit"** on a course whose obstacles differ by two
orders of magnitude in size.

⛔ So the split is withdrawn. The class attribution already exists and needs no new probe —
the harness counts collisions by class in every bench:

      arctic per boat-race, HEAD:   floe 32.5   land 27.5   boat 7.7
      after this session's landing: floe 38.3   land 27.7   boat 10.6

**Floes are the largest class and the only one that rose.** That stands, it comes from the
harness's own counters, and it is what the next candidate should aim at.

## 🗄️ HOUSEKEEPING: 106 GB of `regatta/eval/rl` is 37 pre-`mktree.sh` candidate trees

Not a finding about the AI, but worth an owner decision. `regatta/eval/rl` is **106 GB**,
and it is almost entirely legacy candidate trees built by `cp -R regatta/` before
`mktree.sh` existed:

      37 trees over 1 GB, ~2.9 GB each
        treeA treeB treeBase treeC1-C3 treeD1-D7 treeE1 treeE2 treeG treeH treeL
        treeLD65 treeLD110 treeLD135 treeLDg treeM treeM1-M3 treeQ treeR1-R4 treeR6 treeR7
        treeW1 treeW2 treeW2b treeW3

      inside ONE of them (treeR3):
        regatta/eval/     2.4 GB   <- a nested copy of eval/, containing its own rl/
        regatta/art/      331 MB
        regatta/assets/   188 MB   <- mktree.sh symlinks this now
        regatta/js/       1.6 MB   <- the only part a candidate tree actually needs

This is exactly the hazard `mktree.sh`'s own header warns about ("A full cp -R of regatta/
pulls in eval/ (100G+) and recurses"). Trees built with `mktree.sh` are **1.8 MB** — the 15
built this session total 27 MB.

⚠️ **NOT deleted — owner's call.** The bench RESULTS these trees produced live in the
`*_bench_*.json` files (51 MB total at the top level), not in the trees, so the numbers in
this log survive their removal. But an old tree is the only way to re-run an old
comparison, so this is a judgement about which history is worth 106 GB.

## ⛔ FOURTH ELIMINATION: floes ARE mispriced 7-8x, and fixing it barely moves anything

Reading the collision response settles a question the cost function assumes: **a floe costs
exactly what a rock costs.**

      script.js:16081    boat.speed *= 0.4;      // applied to BOTH; `isFloe` is only
                                                 // carried along for reporting

Yet avoidance prices floe proximity at 3500/1200 against land's 25000/10000 — 7-8x cheaper
for an identical consequence. By the standard this session established (a price that does
not match the thing it prices is structural, not a knob) that is a genuine defect. Pricing
floes as land (`treeFLOEPX`, 4 arctic races, 36 boat-races):

      HEAD          23.0 impacts/boat-race   3.0/min   73.3 kt shed
      floe=land     21.6 impacts/boat-race   2.9/min   71.5 kt shed     (-6%)

**Real, and far too small to be the answer** — and not separately verified on a second set,
because it does not clear the bar to be worth one. The fleet is not hitting ice because it
under-values ice.

⚡ **And that is the sharpest statement of tonight's lesson, from the other side.** The
deviation term was mispriced by THREE ORDERS OF MAGNITUDE and correcting it was worth
71-86 s a boat on this venue. Floe proximity is mispriced by 7-8x — genuinely, verifiably
mispriced — and correcting it is worth 6% of an impact rate. **The magnitude of the
mismatch is the whole signal, not its existence.** A campaign that goes looking for
"mispriced terms" will find them everywhere and mostly waste its time; the question to ask
is whether the term is in the same UNITS as what it is weighed against.

### The arctic elimination list now reads:

    NOT escape-fan resolution   densifying the ice fan: 23.1 vs 23.0
    NOT drift blindness         floes are predicted to mid-lookahead, inside the ~5 s
                                window drift was measured predictable over
    NOT double-counting         `_trajFloe` handoff is deliberate
    NOT floe under-pricing      correcting a real 7-8x mismatch: -6%

Four eliminations, no answer. The next session should start here rather than from any of
these — and should be suspicious of any candidate whose story is "a constant is wrong".

# ═══════════════════════════════════════════════════════════════════════════
# PLAN FOR THE NEXT PUSH — RESEARCHED 2026-08-06 AFTER THE AVOIDANCE LANDING
# ═══════════════════════════════════════════════════════════════════════════

## ⚡ OWNER RULING (2026-08-06 morning, amends P3/P4 below — direct quote)

"Lake is definitely raceable. I gave you several traces where I raced it just fine.
Redrock is also raceable, marks being in rock is part of the course, you round the rock
not head through it."

So: **every `check_raceable` FAIL is an AI deficiency, not authoring.** P3's "move mark 5"
option is DEAD — fix the AI. Redrock moves OUT of P4 (owner-dependent) and INTO scope as
an AI navigation problem: the required skill is rounding rock and threading the thin web
the human threads (1 recording exists). The push goal, stated by the owner: human or
superhuman performance on bay, ocean, redrock, lake, arctic, seatrials.

## PRIME DIRECTIVE (unchanged, and it worked)

Keep >=4 probes in flight; never idle the background; **check `date` — do not infer
elapsed time from how much work has gone by** (this session mis-estimated the clock by two
hours doing exactly that, and killed four benches on a pace figure that was an artefact).
A rejection with a mechanism is a result. Bench at 20 seeds (16 arctic) on two DISJOINT
sets before landing. Commit per landing.

## WHAT THE RESEARCH FOUND (all measured today, after the landing)

### 1. Boat-on-boat contact is now the dominant dirt, on FIVE venues

`check_raceable.js` across all ten venues, contact FRAMES per boat-race:

      venue      land    floe   BOAT RUBS   pen    gate
      redrock  4641.6     0.0      659.6    7.2    FAIL x2  (known broken, owner's call)
      arctic    488.7   782.6      259.0    1.5    FAIL x2
      bay         0.0     0.0       54.7    0.3    ok
      lagoon      0.0     0.0       45.0    0.8    ok
      river       0.0     0.0       44.6    0.7    ok
      swamp       0.0     0.0       40.7    3.6    ok
      seatrials   0.0     0.0       31.3    0.5    ok
      lake      257.7     0.0       29.6    0.7    FAIL x1
      glowtide    0.0     0.0       26.4    0.4    ok
      ocean       0.0     0.0       10.6    0.6    ok

⚠️ These are FRAMES, not events — the benches' `col.boat` counts events (bay 1.17-2.68 per
boat-race). Do not mix the two; this campaign has confused frames/events/episodes three
separate times. But the ORDERING is the finding: **Lighthouse Cove is the dirtiest raceable
venue in the game for boat-on-boat contact, and this session's landing made it worse**
(1.17 -> 2.26 and 1.31 -> 2.68 events, both sets). The human takes ZERO boat impacts on bay
by the same `_thump.js` detector.

### 2. Four venues have NEVER been compared to a human

      recordings:  arctic 22 | seatrials 16 | bay 13 | ocean 7 | lake 3 | redrock 1
      NONE:        glowtide, lagoon, river, swamp

The entire method that produced this session's landings is a like-for-like human
comparison. It cannot reach 40% of the venue roster. **Only the owner can produce
recordings** — this is the single highest-leverage thing they can do for the campaign, and
lagoon/river/swamp are exactly the venues the table above flags as dirty.

### 3. Arctic's 23 impacts are 18.9 SEPARATE episodes, not a few grinds

      23.0 hits / boat-race  ->  18.9 episodes (hits >3 s apart)  ->  1.2 hits per episode

My own standing rule (count EPISODES, from the lake grounding work) had never been applied
here. It rules out the recovery-loop story: she is not getting pinned and ground, she is
having **nineteen distinct collisions a race** where the human has one.

### 4. ⚠️ THE RECORDINGS HAVE THREE INCOMPATIBLE `floes` SCHEMAS

      19 arctic + 13 bay + 7 ocean + 13 seatrials + 1 redrock:
                        floes<=1200u[hullId,x,y,spin,vx,vy]     <- SHIPPING, NO RADIUS
      3 arctic + 3 seatrials:  floes<=1200u[x,y,r,vx,vy]        <- old, HAS radius
      3 lake:                  floes                            <- bare, third variant

The header string is the only discriminator. **I parsed all 22 arctic files as the 5-field
layout and produced an "ice exposure" result that was nonsense** — index 2 is `y` in the
shipping schema, so a quarter of the "radii" came out negative (min -3968) and the p5
clearance read as 1803 units INSIDE a floe. Retracted.

⛔ **This BLOCKS the top arctic measurement.** "Does the human sail through less ice than
the fleet?" needs distance to a floe EDGE, and the shipping schema dropped radius for
`hullId`+`spin`. Unblock it one of two ways before aiming at arctic:
  (a) recover radius by `hullId` from the venue document / runtime floe set, or
  (b) add radius back to the recorder and ask the owner for fresh arctic recordings.

## THE PUSH, IN PRIORITY ORDER

### P1 — BOAT-ON-BOAT CONTACT (bay first, then lagoon/river/swamp)
The biggest number on the board, on the most venues, and the one this session regressed.
Bay has 13 human recordings and the human's score is ZERO impacts, so the target is
unambiguous.
  - measure first: `_thump.js` on bay/lagoon/river/swamp, episodes as well as hits, and
    the `_fleet_ledger` at-CPA deflection that already says fleet 16.6 deg vs human 8.0
  - the standing thesis says look for an ACTION that does not exist or is not real, not a
    price — but check the SCALE of what is there first (see the rule below)
  - ⚠️ any candidate must be checked against `treeNOSE2` (gate-only), which trades ~50 s of
    arctic for bay's clean contact numbers. If P1 cannot fix bay's contacts, reconsider
    landing `treeNOSE2` instead of the shipped pair — that is a live option, not a defeat.

### P2 — ARCTIC PER-ENCOUNTER ICE AVOIDANCE (19 episodes vs 1)

⚡ **OWNER'S OWN STRATEGY (2026-08-06, direct quote):** "I scan ahead in the ice pack
and look for where I believe there will be the largest gaps projecting forward where I
think the rotational state will be when I get there. I then trade off the ideal route
to my goal vs where the gaps are the largest and commit and go." Three testable claims:
gaps priced AT ARRIVAL TIME (with rotation) not at stamp time; criterion = LARGEST gap
(margin, robust to prediction error — not SIPP precision, which stays retired); and
route-level commitment to the chosen gap (distinct from the avoidance-hold commitment
family, rejected x3 and closed).

Blocked on the schema (item 4). Do that first, then:
  - human ice exposure vs fleet ice exposure along track — if she routes through thinner
    ice, arctic is a ROUTING problem and the whole avoidance thread is aimed wrong
  - the fifth hypothesis, untested: **does the boat's own ROUTE lead it into the ice it
    hits?** `pathSailable` plans on a grid that stamps floes at a refresh cadence; if the
    plan threads gaps that have closed by arrival, avoidance is fire-fighting a bad plan
    and no avoidance tuning can win. Measure: at each impact, was the floe on the boat's
    own `gridPath` when the plan was made?
  - four causes already ELIMINATED — do not re-propose: escape-fan resolution (23.1 vs
    23.0), drift blindness (floes ARE predicted to mid-lookahead), double-counting
    (`_trajFloe` is deliberate), floe under-pricing (a real 7-8x mismatch, worth 6%).

### P3 — LAKE STILL FAILS ITS OWN RACEABILITY GATE
257.7 shoreline collision frames per boat-race, `check_raceable` FAIL, even after the
landing halved the event count. The venue is 4447 navigable cells and mark 5 sits in 100u
of clearance. This may be an AUTHORING fix (move mark 5 ~300u southwest, worth ~10-15 s)
rather than a tuning one — put it to the owner with the number.

### P4 — OWNER-DEPENDENT
  - recordings for glowtide, lagoon, river, swamp (P1 needs them to have a target)
  - redrock: 4641 shoreline collisions, 2/18 ever finish — still not raceable
  - 106 GB of `eval/rl` in 37 pre-`mktree.sh` trees

## THE RULE THIS SESSION EARNED, STATED FOR NEXT TIME

**A price in the wrong ORDER OF MAGNITUDE is a structural bug; a price at the right order
is a knob, and knobs lose.** Measured from both sides in one night: the deviation term was
3 orders out and fixing it was worth 71-86 s a boat on arctic; floe proximity is genuinely
7-8x out and fixing it was worth 6%. **Before proposing any re-pricing, compute the ratio
between the term and what it is weighed against.** Under ~10x, expect nothing.

And the corollary that governs P1: *do not* go hunting for "wrong constants". The question
is whether a term is in the same UNITS as the function it lives in.

## 🧹 EVERYTHING THE NEXT SESSION NEEDS IS TRACKED — the rest is disposable

Checked before a repo clean. `git clean -fdx` under `regatta/eval/rl` deletes the candidate
trees and every `*_bench_*.json`, and **that is fine**:

  - **TRACKED, survives:** all the probes (`_thump.js`, `_margin.js`, `_replan.js`,
    `_hdgrate.js`, `_fleet_ledger.js`, `_human_ledger.py`, `_route_attrib.js`,
    `_map_validity.js`, ...) and `traj/` — all 59 human recordings. These are the assets;
    they are in git.
  - **UNTRACKED, deleted, and obsolete anyway:** every bench baseline. `b566370` and
    `b85935d` changed fleet behaviour on lake/bay/arctic, so `bay_bench_nogobay`,
    `ocean_bench_nogolake`, `fleet_leg2_headarc` etc. are all pre-landing and **must be
    re-recorded against the new HEAD before any A/B**. Losing them costs nothing; USING
    them would cost a wrong verdict.
  - **UNTRACKED, deleted, reproducible:** the candidate trees, including `treeNOSE2`.

### Rebuilding `treeNOSE2` (the gate-only fallback the plan names)

It is HEAD with the deviation change reverted and the near-reversal gate kept:

    regatta/eval/rl/mktree.sh treeNOSE2
    # then in treeNOSE2/regatta/js/script.js, restore the ORIGINAL deviation term:
    #   let cost = (this.boat.raceState.leg >= 1)
    #       ? Math.pow(Math.abs(offset), 3) * 200
    #       : Math.pow(Math.abs(offset), 1.5) * 10;
    # back to:
    #   let cost = Math.pow(Math.abs(offset), 1.5) * 10;
    # leave the `nosedIn` gate and the fan's racing-leg guard exactly as shipped.

That reproduces the tree whose numbers are in this log (lake +41.0/+55.0, bay inert,
arctic -23.0/-38.0, and bay's contact classes unchanged rather than doubled).

### First moves for the next instance, in order

    1. re-record baselines on the new HEAD:  bay 20@9100 + 20@9200, lake 20@9100 + 20@9200,
       arctic 16@9100 + 16@9200   (mktree.sh a HEAD tree first; `treeNOW` is gone)
    2. `_thump.js` on bay/lagoon/river/swamp — P1 needs its starting numbers
    3. then P1 proper

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 2026-08-06 DAY PUSH — "HUMAN OR SUPERHUMAN ON ALL SIX" (owner's goal)
# ═══════════════════════════════════════════════════════════════════════════

Started 09:40 PDT. Owner rulings recorded at the top of the previous plan: redrock
and lake are raceable BY DESIGN; gate FAILs are AI deficiencies; no authoring fixes.
Owner's ice strategy quoted under P2 above.

## Phase 0 — baselines on HEAD (treeNOW == HEAD verified byte-identical), all NEW

    bay      20@9100 / 20@9200   fin med 244 / 244   boat col 2.83 / 2.38  pen .46/.54
    lake     20@9100 / 20@9200   fin med 295 / 289   boat 5.01/3.93 land 8.1/9.3 pen .92/.86
    ocean    20@9300             fin med 193         boat 1.80  land 0.03
    arctic   16@9100 / 16@9200   142 finishers both, med 458.5 / 462, in-time 23 / 14
    seatrials 100t seed 100      199.52 / 194.43     OCS 14.78%  pen 0.41
    redrock  check_raceable 8    6/72 finish (0 in cutoff), land 4671, boat rubs 1017/boat-race
    files: bay_bench_base0806A/B, ocean_bench_base0806lkA/B, ocean_bench_base0806oc,
           fleet_leg2_base0806A/B. treeNOSE2 REBUILT per recipe (surviving copy was
           STALE — predated the fan racing-leg guard; diff caught it).

⚠️ Lake is now DIRTIER than bay on boat contact (5.01/3.93 vs 2.83/2.38 events) — P1
candidates get benched on both venues.

## P1 MECHANISM FOUND — bay boat contact is a PENALTY CASCADE (`_bay_rub_probe`, 12 seeds)

    164 episodes = 1.52/boat-race (human 0.14 recorded, 0 impacts by thump)
    78% of episodes: a boat is MID-PENALTY.  56%: penalty outstanding >2s BEFORE the rub.
    17%: a boat is actively mid-360-SPIRAL.  77% at own speed <1 kt.  100% outside zones.
    geometry: crossing 67% | head-on 16% | overtake 14%.  legs: L1 38%, L0 22%, L4 19%.
    45% within 400u of a mark (the Boat end of the line = 53% of those).

Not "clean boats passing too close" — a flagged boat slows/spirals INSIDE the lane and
gets hit (minting more penalties). Both sides are blind by construction:
  - the spiral scheduler takes the turn in traffic once the 6s deadline passes
    ("take it anyway"), and while spiraling the boat SKIPS avoidance except IMMINENT;
  - everyone else projects her LINEARLY — a rotating boat's CPA is noise, so their
    risk reads LOW until contact.
Candidates (both change WHICH ACTIONS EXIST, benching now):
  C1 treeP1: spiral = stationary hazard with a berth (risk by distance 260/170/85,
     stationary projection, pairSafe>=130, no STAND_ON hold vs a spinning threat).
  C2 treeP12: +CLEAR OUT FIRST — past deadline in traffic, steer away from nearest
     boat (no-go-guarded), spin when clear or at hard deadline 14s. OPEN WATER ONLY;
     ice venues keep the old condition byte-for-byte (12s deadline was priced there).

## P2 MEASUREMENTS — the schema block dissolved, and both sides are now measured

The 19 shipping-format arctic recordings carry `floeHulls` (hullId -> exact hull
polygon; recorder comment: per-sample [id,x,y,spin] gives exact extents — spin is
ORIENTATION). `_ice_exposure.py` (human) + `_ice_exposure_fleet.js` (fleet), SAME
definition — signed distance to nearest floe EDGE, racing phase, 10 Hz:

                       human (19 races)      fleet (8 seeds @9100)
    clearance med          206u                  ~206-218u
    share <100u            22.4%                 (comparable)
    share <200u            48.7%                 47.7%
    share <400u            78.7%                 80.0%
    hdg-rate med <50u      14.2 deg/s            31.1 deg/s
    hdg-rate med 50-200u   0.0                   31.0-31.2
    hdg-rate med >400u     0.0                   3.9-12.9
    speed med <50u         1.61 kt               0.23 kt
    floe hits/race         3.9 events (8/19 races = ZERO)   fleet 23.0 (18.9 episodes)

**Same corridors, same proximity — opposite behaviour.** The human picks her line and
holds it (hdg-rate 0.0 outside 50u; turns are planned, p90 ~50 in every band; full
speed through the pack). The fleet steers at 31 deg/s median in EVERY band under 200u
and is nearly STOPPED (0.23 kt) beside the ice — reactive milling at the edge, the
Freezing-Robot signature, now measured against the human in the same water. The
owner's "commit and go" is not a metaphor: it is hdg-rate 0.0 at 100u from a floe.
`_impact_plan_probe.js` (on-plan-threaded / on-plan-clear / off-plan split at each
impact) is running to pick the candidate family.

## Redrock — the human's race, measured (traj_redrock_1785825518447)

    finish 140.3s (authored cutoff 360; fleet: 0 finishers inside it, 6/72 ever).
    ZERO contact events. Never below 0.8 kt in 1300 racing samples.
    legs: L1 beat 36.9s (86% up, 4 tacks, 1.44x authored len) | L2 reach 19.8s |
          L3 beat 23.0s (79% up, 1 tack) | L4 27.9s (19% up) | L5 run 31.6s (3% up).
    Fleet dies ON leg 3: 57 of 72 boats reach it and never leave (bench running for
    the per-leg detail).

## ⚡ OWNER DIRECTION (mid-session, 2026-08-06): venues are CAPABILITY TESTS

"One way to look at the different venues is they test different abilities of the
players whether human or ai. If the ai is behind the human on that venue, it shows
specific gaps in capability vs the human. It should be the case that improving on one
venue will often lead to gains on general ai ability - eg object avoidance in arctic
or routing in redrock."

Operational reading, binding on candidate selection:
  - name the CAPABILITY a candidate improves, not the venue it moves;
  - prefer mechanisms that should transfer, and CHECK the transfer (bench the
    candidate on every venue that exercises the same capability);
  - the current map: bay/lake = traffic discipline under RRS; arctic = moving-object
    avoidance & committed gap-running; redrock = confined-water routing (tack-aware);
    lake = light-air seamanship + shore margins; ocean = sea-state trim; seatrials =
    clean-start execution (the venue with nothing else in it).

⚠️ REDROCK CORRECTION (found while locating the wall): the current redrock DOCUMENT is
NOT the one the human recording was made on — in-game DMC legs are
2300/4472/6874/3948/3129 against the recording's 2504/2307/1733/2623/4150 (the Aug-5
merge that broke test_editor against "the OLD redrock document" is the likely edit).
So the 140.3s human race above is a reference for the OLD course; the CURRENT course
has NO human recording, and its authored 360 cutoff has never been demonstrated by
anyone. The wall leg is leg 3, m4(2847,-391) -> m5(-678,1545), a 6874u DMC thread
through the centre web; the fleet jams at (0,600-1200): plan present 100%, 58%
grid-blocked ahead, 33% wiggle, 0.62 kt, 61 boat rubs + 18% mid-penalty (the pileup).
A fresh owner recording on the CURRENT document would re-anchor the venue.

## ⚡ OWNER TIP (mid-session): how the human routes redrock

"Look at the route the human took - it does not match the shortest path. They
actually went through different canyons and choose to go downwind through narrow
canyons instead of tacking through narrow canyons."

Capability statement: canyon choice is DIRECTION-AWARE — a narrow canyon is cheap
downwind and effectively impassable upwind, so the human buys distance to put beats
in wide water. The router's narrow-upwind term exists (base * (1 + loss/W)) but is
CAPPED AT 20x — if sub-tack-width (123u measured) upwind water is unworkable, that
cap is an order of magnitude low and a short narrow canyon still outbids a long wide
detour. Candidate treeCANYON: steepen/uncap the law below tack width.

## ✅ LANDED 6d6cc4a — Rule 21 both ways (bay -28/-29% boat contacts, all guards green)
New HEAD baselines = the p12 bench files (bay_bench_p12clearoutA/B, fleet_leg2_p12arcticA,
ocean_bench_p12lakeA, seatrials_p12.log). treeNOW/treeP1/treeICE are all PRE-landing.

## ⛔ REJECTED with mechanism — the ice SIDE-LATCH (treeICE, arctic 16@9100)
Owner's "commit to the gap side" implemented as a 900-pt side-switch margin on
planFloeTrajectory's argmax (steering still re-optimised every tick; latch dropped on
own-side degradation). Paired +24.0 med / +25.8 mean AND floe contacts 37.3->39.9 —
worse on both axes. With the heading-hold family's 3 rejections this closes the
STICKINESS half of the strategy: the fleet's 31 deg/s churn near ice is a SYMPTOM of
bad scenes, not the cause of the impacts. The human's 0.0 deg/s comes from choosing
better lines EARLIER, not from refusing to switch. What remains untested from the
owner's description is the ARRIVAL-TIME gap projection (score gaps where they will
be, prefer the largest) and the impact-moment context (what the boat was doing in
the last 2s — next probe).

## LAKE rub attribution (pre-landing tree, 10 seeds): MORE penalty-borne than bay
84% mid-penalty / 81% pre-existing / 6% mid-spiral, but 64% within 400u of a MARK
(mark-3 43%, mark-5 31%), 87% under 1 kt, head-on 32%: flagged boats in ROUNDING
QUEUES, where clear-out has nowhere to go. Post-landing rerun in flight.

## REDROCK solo (1 boat, no traffic): the wall is EXECUTION, not the pileup
Solo boats: FIN 774 (466s of it on leg 3), DNF stuck on leg 3, and one boat spent
900s ON LEG 0 at the start gate (separate start bug, seed 9411). Stuck cluster
(-900,900)-(-971,1336) = the DMC's dead-upwind cl1-2 stretch — "tacking through a
narrow canyon", the exact thing the owner says a human never attempts. Candidate:
uncap/steepen pathSailable's narrow-upwind law (currently min(20, 1+loss/W)) so the
router buys distance through sailable canyons; if no alternative exists A* keeps the
same route and the change is inert by construction.

## LAKE post-landing attribution (treeHEAD2, same 10 seeds): -21% episodes, residual = MARK QUEUES
2.77 -> 2.19 episodes/boat-race. Still 80% mid-penalty / 79% pre-existing, and the mark
share ROSE to 72% (mark-5 41%, mark-3 27%), 85% under 1 kt. The flagged boat in a
rounding funnel has nowhere to clear out to, and the spiral (correctly) won't run
within 220u of a mark — she carries the penalty through the queue and is rubbed in it.
Upstream capability: FOUL GENERATION at tight roundings (lake pens 0.81/boat vs bay
0.42). The next lake candidate should reduce fouls at the funnel, not re-route rubs.

## REDROCK canyon law: INCONCLUSIVE-NEGATIVE on redrock (parked)
treeCANYON (sub-tack-width upwind quadratic, cap 20->90): finishers 10 -> 6 of 72,
leg-3 jam unchanged, rubs 61 -> 45. Route change either unavailable on this document
or no better. The wall is EXECUTION of sub-tack-width beats. Parked pending the
arctic guard; do not land without a demonstrated gain anywhere.

## ✅ LANDED — the CANYON LAW, scoped to drifting ice (owner's routing insight, transferred)
The owner: the human "goes downwind through narrow canyons instead of tacking through
narrow canyons". pathSailable's narrow-upwind term was capped at 20x, an order low for
sub-tack-width (123u) water. Quadratic width-deficit below 140u, cap 90 — and scoped
to grids with drifting floes after the guards spoke: it was built FOR redrock and
WINS ON ARCTIC instead (the transfer the capability frame predicts, arriving
backwards). Evidence:
    arctic A (16@9100 vs P12 head): 144/144 finishers, med 457->424, in-time 24->40,
        paired -8.0/-14.6, floe contacts 36.9->30.3, land 25.6->19.2
    arctic B (16@9200 vs old-head B, P12 ~neutral on arctic): med 462->451, in-time
        14->23, paired -19.5/-17.8, floe 38.3->34.1  [new-head B baseline recording]
    bay: paired +0.0 med (guard, unscoped variant) and now stock by construction
    lake: UNSCOPED variant was a dirt regression (land 8.1->15.4) -> scoping earned;
        scoped tree verified BYTE-IDENTICAL on lake (8 seeds, exact finish times)
    redrock: unscoped variant 10->6 finishers (rock-narrow ≠ ice-narrow) -> scoped out

## ⛔ REJECTED with mechanism — the SIGHTED WIGGLE (treeWIG2)
44% of arctic floe impacts happen mid-wiggle (blind breakout, avoidance bypassed), so
the side-choice was given a 250u grid ray. Arctic: floe contacts 36.9->42.0 UP, paired
+1.5/+6.5; lake wash. The blind wiggle's grind-through is FUNCTIONAL in pack ice — it
pushes through the plug in the direction of travel, where the sighted version detours,
stays slow longer, and accrues MORE exposure ("a 25s grind beats 160s of weaving", now
measured at the wiggle layer too). The 44% is partly the price of escaping, not waste.
Upstream (don't get stuck) is the lever, and the canyon law IS that lever.

⚠️ CANYON-LAW HONESTY NOTE: set B against the PROPER new-HEAD baseline (recorded
after the landing decision) is weaker than the old-head comparison quoted in the
commit: paired -2.5 med / -11.5 mean, in-time 20->23, fins 140=140. Still positive,
and set A (-8.0/-14.6, in-time 24->40, 144/144 fins, floe -18% land -25%) stands as
recorded. Pooled: positive on both disjoint sets, dirt down on both.

## Bay post-landing rub attribution (12 seeds, same probe): -39% EPISODES
1.52 -> 0.93 episodes/boat-race (human 0.14). Pre-existing penalty 56% -> 39%,
mid-spiral 17% -> 8% — the cascade is substantially broken. Residual: leg-1
crossings 40%, LEG 0 post-gun 28% (start pack, sacred tuning), 71% under 1 kt,
51% near marks. Diminishing returns on this thread; the funnel-metering wave
covers the mark-adjacent share.

## ✅ LANDED — FUNNEL METERING (jam-qualified, open water, third landing)
Lake's residual is PARKING (44s+19s per boat under 1 kt on L1/L2; 72% of rubs within
400u of a mark at <1kt). The action that did not exist: arrive when the funnel is
clear. When >=2 rivals on this leg are already PARKED (<1 kt) inside 250u of the DMC
leg endpoint and we are 250-700u out with way on, come down to manoeuvring speed.
The road here was two rejections that shaped the trigger: raw count (bay +5.0 — fires
on every healthy rounding train) and v1 on lake (+4.5 — joins the jam later). The
JAM-qualified trigger: lake contacts 5.07->4.21 (A) and 4.70->4.33 (B), pens
0.93->0.83 (B), clock wash both sets; bay INERT (242/242, trigger never fires);
arctic BYTE-IDENTICAL (open-water gate — unscoped it put boat contacts 12.1->13.5:
holding manoeuvring speed beside a jam in drifting ice means taking hits);
seatrials 199.59/194.13 OCS 14.78% pen 0.40 (baseline-equivalent).

# ═══════════════════════════════════════════════════════════════════════════
# SESSION CLOSE 2026-08-06 DAY — THREE LANDINGS, THE VENUE REPORT
# ═══════════════════════════════════════════════════════════════════════════

Landed: 6d6cc4a (Rule 21 both ways) + 56387c7 (canyon law, icy grids) + 125032f
(funnel metering, jam-qualified, open water). Goldens re-recorded per landing.
npm test = the 6 known editor failures throughout.

## THE VENUE REPORT (owner's standing format: human | pre-session bot | post-session bot)

Clock = fleet median finish (disjoint seed sets shown as A/B). Dirt in parentheses.

  VENUE      HUMAN                    PRE-SESSION BOT               POST-SESSION BOT
  bay        226.2 med / 217.8 best   244/244  (boat 2.83/2.38,     242/245  (boat 2.04/1.73 [-28%],
             0 boat impacts                     pen .46/.54)                  pen .43/.50)
  ocean      182.5 med                193      (boat 1.80)          193      (boat 2.12, pen .44, paired -1.5)
  lake       223 med / 209.6 best     295/289  (boat 5.01/3.93,     292/294  (boat 4.21/4.33 [-17/-8%],
             (3 traces only)                    land 8.1/9.3)                 land 8.8/8.6, pen .81/.83)
  arctic     212.1 med / 190.4 best   458/462  (in-time 23/14,      424/451  (in-time 40/23, fins 144+140,
             3.9 floe hits/race                 fins 142+142,                 floe 30.3/34.1 [-18/-11%],
             (8 of 19 races: zero)              floe 37.3/38.3)               land 19.2 [-25%])
  seatrials  ~190 med / 180.9 best    194.43   (OCS 14.78%,         194.13   (OCS 14.78%, pen .40)
             OCS 1 in 16 races                  pen .41)
  redrock    140.3 — OLD DOCUMENT     10/72 fins, best 611          11/72 fins, best 442
             (current course has NO   (rubs 61.3, pen 9.06,         (rubs 37.2 [-39%], pen 7.47,
             human recording)          leg-3 wall: 55 boats)         leg-3 wall: 49 boats)

Reading guide: bay/lake/redrock moved mostly on DIRT (the owner's stated priority);
arctic moved on both clock (-34 med set A) and dirt; ocean/seatrials were already
near-human and are unchanged within noise (ocean boat 1.80->2.12 is 20-seed noise
on a small count; flagged, not explained). The remaining big gaps, in order:
arctic 2x (residual composition 46% boat-threat + 42% wiggle at impact — the next
lever is research-scale: arrival-time gap routing or driver-level), lake ~70s
(stall composition now 41% ashore / 27% irons / 24% penalty turns), redrock
(execution of sub-tack-width beats; NEEDS a human recording on the current doc).

## WHAT THE OWNER CAN DO THAT NOBODY ELSE CAN
  1. Race the CURRENT redrock document once — the 140.3s reference predates the
     venue edit; nobody knows if the 360 cutoff is achievable on this course.
  2. Recordings for glowtide/lagoon/river/swamp (still zero human data).
  3. A couple more lake races (3 traces is the thinnest reference among the
     raceable venues, and lake is the biggest open clock gap after arctic).

## SESSION METHOD NOTES (for the next instance)
  - The capability frame (owner, this session) paid off immediately: the canyon
    law was built FOR redrock and landed FOR arctic; metering was built for lake
    and its biggest single number was redrock's front (611->442).
  - Two zero-statistic bugs caught by the standing rule (impact classifier's land
    radii; narrow% with unbuilt _clear). ARM the rule: a probe returning zero at
    every percentile is a bug until proven a finding.
  - Baselines on final HEAD = bay_bench_meter2bayA/finalbayB, ocean_bench_meter2lakeA/B,
    ocean_bench_finaloc, fleet_leg2_canyonarcA/B (arctic byte-identical to final),
    ocean_bench_finalrr, seatrials_meter2.log. Trees treeMETER2 == final HEAD.

## ⚡ POST-CLOSE: THE OWNER RACED THE CURRENT REDROCK — 4 RECORDINGS, AND 4 NOTES

Human on the CURRENT document: **206.6 / 226.2 / 227.1 / 231.6 — all inside the 360
cutoff, events 0/5/1/0.** (Fleet post-session: 11/72 finishers, best 442 at cutoff
900.) The venue report's redrock human cell is now: ~227 med / 206.6 best.

Route facts (vs the fleet): her leg 2 is sailed LONG (6.7-6.9ku vs authored 4472) at
only 10% upwind — she reaches around; the AI's upwind leg-2 canyon is, per the owner,
"about the same and maybe even better... hard, and this is good course design." Her
leg 3 runs 14-22% upwind vs the DMC's 33% — she avoids the dead-upwind cl-1 stretch
where 49-55 fleet boats die.

OWNER'S FOUR NOTES (near-verbatim, binding):
 (1) The AI's upwind leg-2 choice is legitimate — venues SHOULD have choices with
     consequences. Do not "fix" route diversity away.
 (2) "AI roundings are not at all like human roundings — go through all of my
     trajectories and see how I round and compare. You'll see a big difference."
     -> THE REQUESTED ANALYSIS; run it across every venue's recordings.
 (3) Avoidance near the human: bots "veer very early away from me in suboptimal
     ways by plowing into other objects. If you don't have rights then you just
     need to change enough to not have a collision if they maintain a proper
     course." -> minimal-change give-way; over-deviation INTO obstacles is the bug.
 (4) "Redrock is very much a maze and that's working as intended - routing and
     traffic are keys."

## Redrock leg-3, the actual route difference (4 new recordings vs the DMC)
Her median off-DMC distance on leg 3 is 49-70u — SAME canyon sequence — except at
the wall: the DMC turns WEST at (-71,636) into the dead-upwind cl-1 slot
((-571,786)->(-971,1336), twa 2-33 deg); she EXTENDS THE REACH due north along
x~-60 to y~1200-1400 and arcs onto m5 from the north (max divergence 545-630u,
all in that region). The upwind slot becomes reach + arc. The fleet's jam cluster
(0,600-1200) is boats dying in/near the same north channel. Next-push candidate:
authored-rock version of the canyon law, surgical — prefer a reach CONTINUATION
over an upwind slot when both connect (the unscoped quadratic repriced the whole
maze and lost; the target is this one decision shape).

## ⛔ P2 RESEARCH DIRECTION CLOSED BY MEASUREMENT — arrival-time gap projection
`_gap_decay.js` (new), 2223 plans over 6 arctic seeds: corridor min-clearance along
the boat's own plan decays a MEDIAN of -10u over 8s (from 132u at plan time) —
gaps are STABLE at plan timescale, so scoring them "where they will be" wins
nothing at the median. The loss lives in the worst decile (-68u/8s, half the
corridor) — gaps that close fast, which the drift-unpredictability result says
cannot be projected, only margined against; and the margin constants are at
verified knees. The owner's strategy works because the LARGEST gap is robust to
the tail — and largest-gap preference is already what clearance-weighted routing
+ the canyon law implement. Arctic's residual is the tail scenes themselves:
46% boat-traffic squeezes and 42% wiggle recoveries. Driver-level or nothing.

## ⚡ THE ROUNDING COMPARISON (owner's request #2) — ANSWERED, with the next candidate named

Same metrics both sides (_rounding_shape.py + _rounding_shape_fleet.js, both new):

                     minD      carry   near-zone   tacks   peak turn
    bay    human      47u       99%      4.1s        1       55 deg/s
           fleet     117u       99%      4.1s        1       56
    redrock human     62u       98%      3.5s        0       56
           fleet      96u      103%      8.4s        1       59
    lake   human      48u       97%      5.5s        0       53

**The entire difference is the RADIUS.** Speed-carry, zone time, tack count and turn
rate are IDENTICAL on bay — the fleet simply rounds 2.5x wider. ~200u of extra arc
per rounding x 6 roundings ≈ ~15s of bay's remaining 16s gap, plus redrock's 2.4x
zone exposure in a maze where exposure is contact.

⛔ REJECTED on the way: collapsing avoidance's soft mark zone while armed (treeSHAVE,
hard+20): minD did NOT move (118u) — avoidance was never the binding constraint —
and the removed shaping cost bay +4.5/dirt up, redrock 11->7 fins. **The binding
constraint is the ORBIT TARGET: `RR = min(zone*1.15, CoursePath._roundR + 45)`
(script.js ~1293).** The +45 pad and the zone fallback put the carrot at 115-138u.

▶ NEXT-PUSH P1: tighten the orbit target toward the human's 47u (e.g. _roundR + 20
with a hard-radius floor), benched against the FULL rounding regression suite — the
winding test, requiredSweep, Glacier Sound's ice-gap orbit history and the hairpin
all live on this constant. Do NOT rush it; it is worth ~15s on bay alone and touches
every venue's roundings.

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 2026-08-06 EVENING PUSH — THE ORBIT RADIUS AND THE GRID THAT LIED
# ═══════════════════════════════════════════════════════════════════════════

Started 15:11 PDT on HEAD 5f929dd. Owner's priorities: P1 rounding orbit radius,
P2 redrock leg-3 (reach-continuation over upwind-slot), P3 minimal-change
give-way. Landed f67e1d2 (orbit) + 1fcbcd9 (grid sampling) + 7d209d7 (gate
driver) + e097cd6 (goldens, PASS 20/20). npm test = the 6 known editor failures.

## ✅ LANDED f67e1d2 — THE ORBIT RADIUS (P1, the session-opener as ordered)
The measured 117u-vs-47u gap is the carrot family: entry cut zone*0.72 (119u),
armed floor zone*0.85 (140u), approach min(zone*1.15, _roundR+45) (135u).
orbitTightR(rm) aims all three at hard(38+bodyR)+20 = 70u, whole-circle
grid-validated, cached per mark. THE SCOPE TOOK TWO ITERATIONS TO EARN:
  A (tight circle only):  bay -4.0 med, minD 117->75 — but redrock 11->6 fins,
     mark contacts 2.3x, lake +1/+3 dirt up.
  B (+ring to zone*1.15): redrock STILL 11->9 / 2.14 — a clear ring with
     rock-walled APPROACHES is still a funnel; lake one tight mark still +2.0.
  C (+rings to zone*2, LANDED): tight orbit only where the mark has TWO ZONES
     of open water all round. bay/ocean qualify; lake/redrock all-stock —
     verified BYTE-IDENTICAL (exact fins) on lake, redrock, arctic (floe gate),
     seatrials (no rounding marks; numerically identical).
Winding regression suite IMPROVED under the tight orbit: shortfall roundings
14->9 (4%->3%), never-entered-zone 14%->9%, closest approach 0.73->0.46 zone
radii, no <80% completions either side; composed-tree minD 74u, carry 100%,
tacks 1, peak 56 deg/s — every column but radius already human-identical.
Remaining bay rounding gap to the human's 47u: she rounds INSIDE the fleet's
hard avoidance mark zone (50u); going tighter than hard+20 means re-opening
avoidance's mark pricing — a different candidate, not this one.

## ✅ LANDED 1fcbcd9 — RASTERISATION IS NOT SAFETY (P2, and it was never the cost law)
Probes (_rr_leg3_cost/_rr_leg3_routers/_rr_northgap/_rr_tightflood, all new):
  - Under pathSailable's own law the human's north line prices 38.5 vs the DMC
    tail's 84 — the router PREFERRED her line and could not have it.
  - The DMC's corridor router is pathBetween: unweighted BFS, wind-blind. Both
    routers looped through the west dead-upwind slot because the north corridor
    is DISCONNECTED in the grid.
  - The corridor passes the game's own CLEARANCE=44u bar in continuous space
    (min 46u against raw polygons). RES=50 cell-centre sampling closes it.
So the fix is sampling, not pricing: buildGridRaw admits a cell when ANY
quarter-offset sub-point passes the SAME land test. Scoped OFF icy grids (floe
drift eats sub-cell margins; unscoped: arctic land +42%, floe +19% — and every
arctic constant was priced on centre sampling): arctic verified EXACT-identical.
Floe hulls + obstacle circles stay centre-tested (centerOnly) so
stampFloes == buildGrid stays exact — checker updated, IDENTICAL 88/88.
  redrock 8@9400: finishers 11 -> 47 of 72, best 442 -> 320 (inside the
    authored 360 for the first time by anyone but the owner), med 593, land
    frames 270->209, rubs 37.2->33.1, pens 7.47->6.19. Mark contacts 0.94->2.94
    (fins 1.0->2.0, nonfin 0.9->4.7): boats now REACH the funnels — flagged.
  lake: -7.0 paired med (A), boat contacts 4.21->2.68 (-36%) / 4.33->3.74 (B),
    pens down. THE TRADE: land events +14-19% mean (median flat 6.0->6.5), and
    ONE pinned DNF in 360 boat-races (1324 contact-frames; would not reproduce
    under the probe harness).
  bay: -10.0 (B) / -1.0 (A) paired med. ocean: -3.0 mean, all dirt down.

## ⛔ RETRACTED IN-SESSION — four "fixes" tuned against noise (v2-v5)
The lake land uptick drew four remedies: probe-treats-_ss-as-wall (+gate
exception), weighted pathBetween (3x _ss hops), _lineClear refusing _ss,
clearanceField seeding _ss at 0, mark keep-out circles. The 8-seed lake ground
probe read 580 -> 636 -> 687 -> 744 across them — every caution "worse" — and
the tell was the CONTROL: HEAD repeats 465 EXACTLY (deterministic), but
per-seed values swung 46->127 / 87->30 between trees. Any grid change reshuffles
races; at 8 seeds the statistic is chaos. ALL FOUR STRIPPED; the landed tree is
the minimal evidenced form, verified byte-identical to the benched v1 on
bay/lake/redrock. ⚠️ STANDING RULE REINFORCED: lake land contact needs 20-seed
benches, exactly like bay traffic — and a deterministic-per-tree number can
still be pure noise ACROSS trees.

## ✅ LANDED 7d209d7 — the venue gate STEERS
The supersampled grid let the ideal path thread redrock's 46-65u channel, and
test_sailable's driver — which teleports along raw pathBetween cell centres —
clipped rock at 4 stair-step sub-steps the channel centreline clears. The
driver now nudges any path point within 44u of land to the greatest-clearance
position within half a cell. The hull-in-land standard is untouched.
test_sailable PASS on all ten venues; the npm chain (which stops at the first
failing script) reaches the editor suite again.

## P3 — MEASURED, PARKED WITH THE MECHANISM NAMED
Fresh HEAD ledger (8@9100 bay): no-tack AT-CPA deflection med 15.0 deg vs human
8.0; holds-course 25% vs 40%; passing distance 331u vs 355u. The minimal action
EXISTS (0.1-rad fan step, b566370) and minimal-change keep-clear is already the
scoring rule (Aug 4b). The residual is the 80u owed-gap constant vs the human's
revealed ~50u comfort — a calibration knob worth ~1-2s on bay; knobs lose, and
the schema-2 recordings that would make per-encounter give-way tracking exact
do not exist yet (0 of 66 traj files carry rivalsX — all predate ba536eb).
NEXT: when the owner records ANY race on the new HEAD, the ledger can split
give-way encounters by rule-21 state and test "deviates into objects" directly.

## THE VENUE REPORT (owner's standing format; disjoint sets A/B where run)
Clock = fleet median finish. All post-session numbers verified on the landed
HEAD (trees byte-identical). Human redrock is the CURRENT document.

  VENUE      HUMAN                    PRE-SESSION BOT               POST-SESSION BOT
  bay        226.2 med / 217.8 best   242/245  (boat 2.04/1.73,     241/237 paired -1.0/-10.0
             0 boat impacts                     mark .37/.52,                 (boat 2.14/1.79, mark .56/.49,
                                                pen .43/.50)                  pen .53/.46, land .08/.11)
  ocean      182.5 med                193      (boat 2.12, mark .53, 192 paired -1.0 med / -3.0 mean
                                                pen .44, land .09)            (boat 1.98, mark .43, pen .42, land 0)
  lake       223 med / 209.6 best     292/294  (boat 4.21/4.33,      288/294 paired -7.0/+1.0 (mean -2.6)
             (3 traces only)                    land 8.78/8.57,               (boat 2.68/3.74 [-36%/-14%],
                                                pen .81/.83)                  land 10.0/17.5*, pen .70/.80)
                                                                     *B incl one pinned DNF boat (1324 fr),
                                                                      179/180 finish; median land flat 6.0->6.5
  arctic     212.1 med / 190.4 best   424/451, in-time 40/23,        BYTE-IDENTICAL (verified exact,
             3.9 floe hits/race       fins 144+140, floe 30.3/34.1,  16@9100; floe-gate scoping)
                                      land 19.2
  seatrials  ~190 med / 180.9 best    194.13 OCS 14.78% pen .40      numerically IDENTICAL
  redrock    ~227 med / 206.6 best    11/72 fins, best 442,          47/72 fins, med 593, best 320,
             ~0 contacts              rubs 37.2, pen 7.47,           rubs 33.1, pen 6.19, land 209,
                                      land frames 270                mark 2.94 (up — boats reach the
                                                                     funnels now; flagged)

Reading guide: the two landings moved redrock from broken (11/72 at 2.5x the
authored cutoff) to raceable-by-most (47/72, best inside the authored limit),
bay by ~5s pooled with roundings now geometrically human-shaped, lake by boat
contact (-36%/-14%, its worst dirt class after land) at a measured land-mean
trade, ocean slightly, arctic/seatrials untouched by construction. The
remaining clock gaps, in order: arctic 2.1x (research-scale, unchanged),
redrock med 593 vs ~227 (traffic + thread execution — see the stall
attribution below), lake ~65s, bay ~11s.

## POST-LANDING REDROCK ATTRIBUTION (vf bench, 8@9400)
Of 25 non-finishers: 15 die on LEG 5 (the straight 2967u run home across the
maze middle), 6 complete the course but beyond the 900 cutoff, 3 on leg 1,
1 on leg 4. The leg-3 wall is GONE (0 die there). Leg 4 departs m5 east — no
head-on traffic in the north thread. The next redrock lever is whatever kills
boats on a straight reach home; stall positions probed below.

## ✅ LANDED 6048c95 — DEFILE METERING (the fourth landing, from the post-landing attribution)
The stall probe on the new HEAD put 5 of 8 redrock non-finishers parked at
0.1-1.9 kt at the thread mouth, 700-900u before m5 — outside the endpoint
metering's 250u rival-count radius. Same action, same jam qualification, same
floe-free line, one trigger wider: a jam at the first sub-two-cells-clearance
point of MY OWN gridPath 250-700u ahead. Verified on SIX venues:
  redrock A 8@9400: finishers 47->56, paired -48 med, all dirt down
  redrock B 8@9500: 56->59, med 747->613, paired -57/-97, rubs -21% land -16%
  lake 20@9100: paired -5.0 mean, land 9.99->7.77 (-22% — BELOW the
    pre-supersampling 8.78: the supersampling land trade is RECOVERED)
  bay BYTE-IDENTICAL / ocean 0.0 med / arctic EXACT-identical / seatrials
    numerically identical. Goldens re-recorded PASS 20/20 (b4503df);
    npm test = the 6 known editor failures.

## FINAL VENUE REPORT (supersedes the table above; final HEAD = b4503df)
  VENUE      HUMAN                    PRE-SESSION BOT               POST-SESSION BOT (final HEAD)
  bay        226.2 med / 217.8 best   242/245                       241/237 paired -1.0/-10.0
                                                                    (boat 2.14/1.79, pen .53/.46)
  ocean      182.5 med                193                           192 (boat 1.98, mark .43, land 0)
  lake       223 med / 209.6 best     292/294 (boat 4.21/4.33,      282/294* (boat 2.56, land 7.77,
                                       land 8.78/8.57, pen .81/.83)  pen .66 on A; *B not re-run
                                                                     post-metering, was 294)
  arctic     212.1 med / 190.4 best   424/451 in-time 40/23         BYTE-IDENTICAL (verified exact x3)
  seatrials  ~190 med / 180.9 best    194.13 OCS 14.78% pen .40     numerically IDENTICAL
  redrock    ~227 med / 206.6 best    11/72 fins, best 442,         A: 56/72 fins best 318; B: 59/72
                                      rubs 37.2, pen 7.47            best 286, med 613, rubs 27.9,
                                                                     pen 5.50, land 192 (-29% vs pre)
  Session total on redrock: finishers 11 -> 56/59 of 72 across two disjoint
  sets, best 442 -> 286-318 (inside the authored 360), every dirt class down.

## NEXT-PUSH POINTERS
  - redrock residual: ~13-16 non-finishers/72 + med 613 vs human ~227 — the
    thread is still single-file; candidates: alternate-corridor spreading
    (leg-3 has only one thread), or the leg-1 start-area class (3 boats).
  - lake ~60s: stall composition 41% ashore / 27% irons / 24% penalty turns.
  - bay ~11s pooled; next orbit step means re-opening the 50u hard mark zone.
  - arctic: research-scale only (see day-push close).
  - P3 give-way needs ANY schema-2 owner recording (0 of 66 have rivalsX).

## ⛔ REJECTED with mechanism — ORBIT STEP 2 (treeORBIT4): the radius family's knee is 70u
Armed hard mark zone 50->40 at qualified marks + ring at 55: minD moved 75->61
(human 47), carry 100% — the mechanism works — and the CLOCK does not respond:
bay A -1.0/-3.1, bay B 0.0/+0.8, mark contacts down on A / up on B (noise). The
dose-response: 135->70u paid -4.0/-10.0; 70->55u pays ~0. Below ~75u the
remaining bay gap is NOT arc length. Family CLOSED at the 70u knee; do not
re-tighten without a new mechanism.

## Post-metering redrock stall re-attribution (4 seeds)
Unfinished 8 -> 5; only ONE truly parked (0.62 kt at the thread, (-54,1344));
the rest are MOVING at 3.5-8 kt — lateness, not stalls. The hard-stuck class is
substantially gone; the residual is one-lane throughput physics (9 boats, one
46u thread) plus the leg-1 start class. Classical redrock closes here.

## NEXT-PUSH P1, MEASURED TONIGHT — lake mark-3's lee-shore pocket
16-seed ground attribution on the final HEAD (1084 hits): 71% of all lake
groundings are on LEG 2, and the top spatial clusters ((2800,-1200) 257,
(2800,-800) 108, (2400,-800) 98, (2000,-800) 79) are all within ~600u of
mark-3 (2459,-867) — roughly HALF the venue's grounding dirt in one pocket.
76% of hits at under 0.5 kt, 59% in 6-8 kt of breeze, 91% liveness normal,
only 19% mid-wiggle: not light air, not stuck-recovery — the rounding QUEUE
parked against a lee shore. Candidate shape: a metered/queued boat near a lee
shore holds station TO WINDWARD (feather close-hauled) instead of parking on
the drift line — a new action, not a price. Needs 20-seed lake benches per
iteration (today's noise lesson) and the bay/redrock funnel guards.

Bay pointer: per-leg splits vs the human now align within ~+-6s leg-for-leg
mid-race; the residual concentrates at the GUN (median first-crossing 6.5s
after the start) and the final leg. The start system is sacred tuning — take
the OCS/start ledger first.

## ⛔ REJECTED with mechanism — METERED LEE-SHORE HOLD (treeLEE)
The mark-3 pocket candidate: a metered boat with shore within 200u downwind
feathers close-hauled (current tack) instead of parking on the drift line.
lake A 0.0 med / +0.7 mean with land 7.77->8.36 UP; lake B 0.0/+1.4 land up;
redrock 56->51 fins, +76 paired (in a maze "downwind is shore" is true
everywhere — a feathering boat inside a one-lane thread IS the jam). The
mechanism that kills it: metering operates 250-700u OUT, but the attribution's
parked-ashore boats are INSIDE the 250u funnel radius — the scrum itself,
where neither metering nor the hold ever applies. The pocket's fix must act on
QUEUE-INTERIOR behaviour (spacing/berth inside the funnel while waiting to
round), a fresh design, not a metering extension.

# ═══════════════════════════════════════════════════════════════════════════
# PLAN FOR THE NEXT PUSHES — RESEARCHED 2026-08-06 EVENING (post-landing reflection)
# ═══════════════════════════════════════════════════════════════════════════

## Where the stack stands (the reflection)

The classical stack is six layers: start (staged-lane + timed crossing), route
(DMC ruler + supersampled grid + pathSailable time-cost), navigation target
(rounding orbit/entry/exit machinery), strategy (scoreTack VMG/shift/pressure),
avoidance (candidate-fan argmin with RRS roles, keep-clear-by-enough, rule 21,
floe trajectory rollout), liveness (wiggle/recovery), plus the metering family.
After this session the SOLO capabilities are essentially closed: fleet min
beats the human's best on bay; solo boats finish redrock; roundings are
geometrically human-shaped at the 70u knee; the winding/rules integrity suite
is green. The remaining gap table and its COMPOSITION:

  seatrials  +2%    start execution (OCS 14.78% vs human ~6%)
  ocean      +5%    sea-state trim ceiling (known, small)
  bay        +5-6%  gun crossing (6.5s median late) + residual boat contact
  lake       +27%   mark-3 scrum (half of all groundings, INSIDE the funnel),
                    irons/penalty stalls
  redrock    ~2.7x med (best +38%)  one-lane thread THROUGHPUT + leg-1 starts
  arctic     ~2x    46% boat-threat squeezes + 42% wiggle recoveries at impact

Every big residual is now a TRAFFIC/SCENE problem or START execution — not
steering, not routing, not rounding geometry. That matches the campaign's
trajectory: the seven-for-seven "actions not prices" wins were all single-boat
actions; what remains is multi-boat structure.

## What the literature adds (delta over the Aug-3 research passes)

1. **RLPP (arXiv 2501.17311, 2025)**: residual RL on a classical pure-pursuit
   base improves lap times up to 6.4% and transfers zero-shot — the exact seam
   our driver residual used (`f0e290e`). Our negative result was BUDGET
   (~600 full-race episodes at 20s wall each), not the seam: Sophy-scale runs
   use millions of steps. Sophy's own fix applies: a MIXED SCENARIO POOL with
   spawn-into-scenario episodes. 20-40s contested scenes at ~20x realtime =
   1-2s wall per episode, a 10-20x budget multiplier, and the scenes ARE the
   residual (squeezes, wiggle recoveries, scrums).
2. **Reservation-based bottleneck management** (local-reservation conflict
   avoidance; deadlock-free social mini-games via discrete-time CBFs, arXiv
   2308.10966; PIBT priority inheritance): the mark scrum and the redrock
   thread are BOTTLENECK problems, and the field's answer is an explicit,
   locally-computed TRANSIT ORDER — not speed shaping (our metering) and not
   station-keeping (treeLEE, rejected). Crucially the RRS already DEFINES the
   priority order at a mark (18: entitlement by overlap at the zone); the
   design writes the queue the rules imply.
3. **Start timing**: the sailing literature's time-on-distance discipline is a
   per-boat calibration problem (distance at full-speed run vs seconds to
   gun, adjusted for line bias). Our staged start estimates approach time
   generically; the 6.5s median late crossing + 14.78% OCS says the estimate
   is mis-calibrated per boat/wind. Measure-first: the start ledger can
   attribute lateness to estimate error vs traffic blocking.
4. The Aug-3 ranked list's ONE unbuilt structural item remains the top
   classical swing: **RRS-asymmetric ORCA/VO underlay** — objective
   REPLACEMENT for pairwise boat avoidance (truncated VO at 6-10s, minimal
   escape vector, responsibility split by RRS role, feasible set intersected
   with the polar lobe). The traffic thread was closed at 10 rejections with
   exactly this exit: "only full objective REPLACEMENT or driver RL remain."

## THE PLAN — three pushes, in order

### PUSH A — the queue is ordered by the rules (classical, 1 session)
Capability: traffic discipline at bottlenecks (lake+redrock+bay+the three
unrecorded traffic venues).
  A1. MARK-QUEUE RESERVATION: at any funnel (zone or defile), boats compute a
      deterministic transit order from the RRS entitlement they already track
      (mark-room/overlap at zone entry; ties by distance-to-funnel). A boat
      whose turn is not yet come holds OUTSIDE the pocket (>=250u, windward of
      the drift line where shore threatens); a boat whose turn has come
      proceeds AT SPEED (no metering slowdown — the reservation replaces the
      jam test where an order exists). Kill criteria: lake 20-seed x2 (land +
      clock), redrock 8@9400+8@9500 finishers, bay byte-or-neutral, arctic
      byte-identical (floe gate).
  A2. START TIME-ON-DISTANCE (measure first): ledger the gun-crossing error
      per boat (estimate error vs blocked-by-traffic vs conservative BUF);
      only then calibrate getApproachTime against the boat's own acceleration
      curve + line bias. OCS must not rise: seatrials 100t + bay OCS are the
      gates. The start is sacred tuning — this is a measurement item first,
      a candidate only if the ledger shows estimate error dominates.

### PUSH B — RRS-ORCA underlay (structural, 1-2 sessions)
Capability: pairwise boat avoidance everywhere (the arctic 46% boat-threat
class, bay/lagoon/river/swamp rubs, thread head-ons).
  Scope: RIVAL BOATS ONLY — floes keep planFloeTrajectory + the ice constants
  (one physical line: ice does not reciprocate). Implementation per the Aug-3
  memo: per-pair truncated VO at tau 6-10s, minimal escape vector, alpha
  split by RRS role (give-way ~0.9, stand-on ~0.1), feasible half-planes
  intersected with the current polar lobe (1-D search), other tack scored
  with tack cost. Behind a flag; the candidate fan stays as fallback for
  multi-constraint emergencies. Bench per the capability map on SIX venues.
  Expected: at-CPA deflection 15deg -> under 10 (human 8), holds-course
  25% -> ~40%, arctic squeeze class down. Kill criteria: any venue's contact
  classes up on both disjoint sets, or OCS/pens up — revert, the fan stands.

### PUSH C — scenario-pool residual (learning, 1-2 sessions, arctic first)
Capability: the last 2x on arctic (squeeze + wiggle scenes RL can shape and
classical argmin cannot).
  Reuse: the f0e290e seam (bounded 2Hz delta-heading residual, zero-init =
  byte-identical floor), rlt_gate protocol (three-way seed separation), CRN
  frozen-classical twins. CHANGE the budget arithmetic: harvest contested
  scenes from bench races (boat-threat onset, wiggle entry, pack entry) into
  a spawn-into-scenario pool (Sophy's mixed proportions), 20-40s episodes,
  fitness = paired delta vs the twin on the same scene + Sophy's symmetric
  passing/contact shaping. Target ~50-100k scene-episodes (feasible at 1-2s
  wall each across 8 workers overnight). Accept ONLY on the full-race
  16+16-seed gate. Kill criteria: two overnight runs without beating the
  classical floor on held-out scenes -> the thread closes like the ES did.

### Continuous (every session)
  - Ingest the owner's new recordings the day they land: the redrock
    schema-2 trajectory unlocks per-encounter give-way validation (rivalsX +
    rule-21 flags) — run the minimal-change ledger split by role before any
    P3 candidate.
  - The venue report on final HEAD at every close; 20-seed benches for all
    contact metrics (the across-trees noise rule).

## What NOT to reopen (closed families, with their mechanisms)
Per-tick re-pricing of threats; avoidance hold/commitment (7 rejections);
sighted wiggle; arrival-time gap projection; SIPP; the orbit radius below the
70u knee; metered lee-shore holds (the parked boats are inside the funnel);
naive-budget driver ES. The 80u owed-gap calibration stays parked until the
give-way ledger runs on schema-2 data.

## ⚡ FIRST SCHEMA-2 RECORDING INGESTED (traj_redrock_1786066623197) — P3 UNBLOCKED
Owner's redrock lap on the post-landing build: **214.7s, zero contacts, never
below 4 kt**, legs 2.9/39.8/64.6/51.2/29.5/26.1, rivals holding ROW over her on
16.6% of frames. Route note: with the fleet now on the north thread she sailed
a DIFFERENT leg-3 line (southwest arc, ~2s in the thread box) — route
diversity, per the owner's earlier ruling. Fleet on the same build: 56-59/72,
med 613, best 286.

`_gw_ledger2.py` (new, tracked): per-encounter ledger with exact identity
(rivalsX), pair roles from the rules' own geometry, and the owner's criterion
computed directly — the UNMODIFIED CPA (both hulls held straight from onset):
  - 17 encounters, both roles: **ucpa >= 80u in 100%** (med 302-361u). In this
    race NO encounter ever required a deviation from either party.
  - Her give-way deflection at CPA: **7.5 deg median** — she reads the ucpa
    and holds.
  - The bots deviated in 100% of encounters, onset at **570u median range**
    when give-way — at detection range, against threats that resolve
    themselves. (Caveat: rival-side deflection MAGNITUDES are confounded by
    their own strategic turns; the onset-range and ucpa columns are the clean
    part, and they corroborate the fleet-side "86% of onsets needed zero".)
This is direct per-encounter evidence for Push B's design premise: the
give-way response should begin when the velocity obstacle is actually
entered, sized to the minimal escape — not at detection range. One race, n=17;
re-run on every new schema-2 recording.

## ⚡ OWNER QUESTION ANSWERED — the arctic LEADER does finish, and it re-weights the plan
"Does the leader typically finish on arctic? They should have less boat-on-boat."
Per-seed winners (canyonarcA/B, 16 seeds each): med 301/340, best 239/262 —
vs human 212.1 med / 190.4 best — with boat contacts 1.5-3.0 (fleet avg 12-13,
essentially traffic-free) and floe contacts 7.5-14 (fleet avg 30-34, still
6-12x the human's 1.2). VERDICT: the leader is clean of traffic and STILL
~45-60% slow. Arctic's residual is TWO components, both real: (1) solo
pack-sailing ~90-130s (line choice + wiggle recovery — the leader's whole gap);
(2) traffic ~another 120s from leader to fleet median. The earlier "46%
boat-threat" framing was fleet-impact-weighted, i.e. mid-pack. PLAN RE-WEIGHT:
Push C's scenario pool should be SOLO ice scenes first (gap approach, wiggle
entry, pack threading) — the leader-vs-human delta is the training corpus —
with squeeze scenes second; Push B keeps the mid-pack 120s + the open-venue
traffic case (today's ledger: 100% of encounters needed zero, bots move at
570u).

## ⚡ FIVE ARCTIC SCHEMA-2 LAPS INGESTED (current build) — the Push-C corpus is live
Finishes 218.5 / 217.6 / 215.0 / 198.2 / 194.7 (med 215.0, best 194.7) — her
historical reference (212.1/190.4) holds on the new build; the fleet winner's
med 301/340 solo gap stands confirmed same-build. What the laps establish:
  - CONTACTS: ice 4/4/1/1/0 (med 2.0/race; fleet 30-34). Boat rubs ONLY in the
    gun scrum, first ~12s (13 of 17 on lap one, then a clean warm-up curve to
    a zero-contact lap) — even the human pays start-pack rubs; the fleet's
    start-adjacent rub class may be partly irreducible.
  - GIVE-WAY LEDGER, ice traffic (83 encounters, 4 files): unmodified CPA
    >= 80u in 81-91% (med 250-545). Her deflection in ice is 14-31 deg — the
    floes constrain lines, unlike redrock's open 7.5 — but the bots still
    fire their deviation at 564-567u range in ~96% of encounters, both roles.
  - SOLO-ICE PROFILE (the residual's target): min floe clearance 15-22u,
    p5 39-51u, at speed, every lap. Corpus now 24 arctic laps, 5 current-build.

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 2026-08-06 NIGHT PUSH (started 19:31 PDT, HEAD a2d5864 = dfa59c8 + a PNG)
# ═══════════════════════════════════════════════════════════════════════════

## ⚡ P2 CLOSED AS MEASUREMENT — THE START LEDGER SAYS THE GUN LATENESS IS TRAFFIC
`_start_ledger.js` (new, tracked): per boat-start, captures the COMMIT FRAME
(`startCommitted` flipping false->true; `getApproachTime` is pure, so the
controller's own estimate is recomputed there), the exact per-boat BUF
(0.5 + traits.startBufAdj), the first leg-0 crossing gun-relative, OCS at the
gun by the hull test, and a 10Hz post-commit traffic ledger (avoidance
deviation > 0.12 rad, risk HIGH+, commanded speed < 0.95). Bay 20@9100 +
seatrials 20@100 on clean HEAD (360 boat-starts):
  - SEATRIALS clean crossers (149): median crossing +0.60s after the gun,
    estimator error median 1.03s — THE ESTIMATE IS CALIBRATED when nothing
    interferes. OCS 16.1% (matches the 14.78% bench), and the OCS class is a
    13.4u-median overshoot at the gun — a fraction of a second against the
    0.5s buffer, timing noise, not gross mis-estimation.
  - BAY clean crossers (179, 0 OCS): median crossing +5.62s (the known 6.5s
    residual), estimator error median 5.95s — but BLOCKED median 7.3s
    (avoidance deviation alone 5.0s of the 11.7s median realized run), and on
    the late tail (>4s, 68% of boats) blocked (9.2s) >= the whole estimate
    inflation (8.2s). The "estimate error" IS the traffic: the realized run
    is what gets bent.
VERDICT per the sacred-tuning rule: estimate error does NOT dominate — no
calibration candidate is justified, the start stays untouched. The bay gun
residual is the SAME capability gap as the onset-at-detection-range class:
boats deflecting in the run-in for encounters that resolve themselves. Push
B's VO-entry onset is therefore also the start candidate, and the start
ledger becomes its gate instrument.

## ⛔ P1 REJECTED with mechanism — MARK-QUEUE RESERVATION (treeQRES v1, treeQW v2)
The researched Push-A design (RRS-18-ordered transit; turn-not-come holds
outside the pocket windward of the drift line; turn-come proceeds AT SPEED
with the metering throttle waived), benched exactly per the brief:
  v1 lake A/B: paired -2.0/-1.0 med, land 7.77->9.17 and 9.68->10.34, boat
    and mark contacts up BOTH disjoint sets. v1 redrock A/B: finishers
    56->43 and 59->57, boat contacts up both sets, pens up.
  v2 (waiver-only, holds deleted): lake A and redrock A results IDENTICAL
    to v1's — the holds almost never fired; ALL of the damage was the
    WAIVER. "Entitled boat proceeds at full speed into a jammed pocket"
    re-creates the pile-in the metering was landed to prevent; there is no
    discrete capacity slot for a reservation to exploit in 10Hz physics
    with liveness-parked boats draining on their own schedule.
The queue-reservation family closes at two forms x two venues x two sets.
Station-keeping among rivals is now 0-for-8 lifetime. Arrival spacing
(the landed metering) IS the queue discipline this engine can express;
the lake mark-3 pocket's open direction remains QUEUE-INTERIOR
spacing/berth INSIDE the funnel (per the Aug-6 attribution), untouched by
any outside-the-pocket mechanism.

## ⚡ LANDED — ONSET AT VO ENTRY (Push B's measured piece), four iterations to scope
The soft proximity gradient (script.js ~:3160, the 1/d^2 against every boat
whose 4s projection comes inside 250u, role-blind and risk-blind — the term
the file's own comment ties to "86% of onsets already clearing by 80u,
median 11deg deflected anyway") is now suppressed per rival when the
truncated velocity obstacle is NOT entered on current courses (tau 8s, CPA
80u, heading-based metrics per Round-10; boats inside 130u always keep the
nudge). The scoping took four measured iterations and the lesson IS the
scoping:
  v1 unscoped:            bay A +4.5 BUT lake land +29% boat +31%, arctic
                          paired -15 in-time -8. Constrained water needs
                          the early spacing.
  v2 current-cell wide:   lake still dirty; redrock A swung +54 -> -93 on
                          the same seeds (8-seed redrock CANNOT resolve
                          this change class — across-trees noise).
  v3 CPA-point wide:      bay best (+5.5, boat contacts DOWN 2.14->1.91)
                          but lake STILL +25% dirt at ~10% suppression
                          active — the damage is not local to where the
                          nudge is dropped; losing en-route spacing
                          anywhere changes the arrival configuration at
                          the corridors.
  v4 VENUE-CLASS gate (landed): suppression active only where the
                          navigable water is open-scale — clearance p50
                          over navigable cells >= 10 (measured knee:
                          bay 10 / ocean 42 / seatrials 40 vs lake 3 /
                          redrock 2; `_clear_dist.js` new, tracked), on
                          top of the openWaterAv floe gate. Same shape as
                          noSubsample: a venue-class physical property,
                          not a venue hack.
FINAL v4 BENCHES: lake, redrock, arctic byte-identical to HEAD (verified
by identical bench JSONs). Bay clock NEUTRAL at four disjoint 20-seed sets
(+4.3/-2.6/-1.1/+1.0 mean paired), contacts pooled flat, A-set OCS
2.8->0.6. Ocean neutral-plus (mark contacts 0.43->0.26). Seatrials
199.52/194.43 -> 199.65/194.23, pen 0.41->0.40, coll_boat 0.51 flat,
OCS 14.78->15.44% (inside the +-0.84 binomial sigma at n=1797). No kill
criterion met on any venue.
THE MECHANISM WIN (why it lands despite a neutral clock — the capability
is the goal, and the researched plan directed landing exactly this piece):
  - `_cpa_onset_probe` bay: onsets with NO closing rival 26% -> 16%;
    onset tCPA med 1.1 -> 0.8s; dCPA at onset 179 -> 219u.
  - `_fleet_ledger` bay close crossings (no tack, CPA < 150u): at-CPA
    deflection med 22.0 -> 11.2 deg (human 8.0; the plan's target was
    "under 10"), ZERO(<5deg) 20% -> 30%, p90 103 -> 66 deg.
  - `_start_ledger` bay: gun-crossing p90 18.2 -> 11.7s (A-set seeds).
The full RRS-ORCA underlay (minimal escape sizing, alpha split by role,
polar-lobe feasibility) now sits on top of THIS onset predicate; the VO
membership set (`this._voIn`) and the venue/water gates are the underlay's
skeleton, already in the shipping cost function behind `window.__AV`
overrides (tau/r/wide).

## Minimal-escape candidate prototyped and INERT — quantization is no longer binding
treeME: for the give-way boat vs her VO-entered threat, bisect the
continuous smallest clearing offset per side (CPA >= 86u, heading-based)
and add both to the fan. Lake byte-identical by construction; bay smoke
unchanged; `_fleet_ledger` close crossings 11.8 med / ZERO 32% vs the
landed 11.2/30% — no mechanism movement on the stat it targets. After the
VO-onset landing the keep-clear zero-at-clearance + pow(3) deviation
already finds the small escapes the rungs allow; the residual vs the human
(11.2 vs 8.0 deg at CPA; holds 30% vs 40%) is NOT fan resolution. Next
session's underlay question is the STAND-ON/priors side (her extra 10% of
outright holds) and the alpha split, not finer give-way offsets. Not
benched further, not landed — an action that never wins the argmin is not
an action.

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 2026-08-06 NIGHT PUSH — CLOSE (HEAD `abb62aa`)
# ═══════════════════════════════════════════════════════════════════════════
Landed: `abb62aa` ONSET AT VO ENTRY (see above). Rejected with mechanism:
the mark-queue reservation family (P1, two forms). Closed as measurement:
the start ledger (P2 — lateness is traffic; the start stays sacred).
Prototyped and set aside: the minimal-escape candidate (inert). Goldens
re-recorded and PASS 20/20 (exactly the six wide venues changed); npm test
= the 6 known editor failures. Lake/redrock/arctic byte-identity vs the
evening anchors re-verified with full fresh benches on the final HEAD
(fin08* == anchors, JSON-identical, all six sets).

## The venue table (final HEAD `abb62aa`; human = traj recordings, like-for-like)
venue     | human med/best      | pre-session bot (dfa59c8)                  | post-session bot (abb62aa)
bay       | 226.2 / 217.8, 0 impacts | 241 / 237 (A/B sets), OCS 2.8/1.1%, boat 2.14/1.79, pen 0.53/~ | 236 / 239, OCS 0.6/1.1%, boat 1.91/1.93, land 0.09/0.05, mark 0.50/0.53, pen 0.43/0.48
ocean     | 182.5               | 192, boat 1.98, mark 0.43                  | 192.5, boat 1.93, mark 0.26, pen 0.40, OCS 0%
lake      | 223 / 209.6         | 282 / 289, boat 2.56/3.44, land 7.77/9.68, pen 0.66/0.79, 180/180 | UNCHANGED (byte-identical, re-verified)
redrock   | ~227 / 206.6 (schema-2: 214.7, 0 contacts) | med 674.5/613, fins 56+59 of 72, best 318/286, boat 30.8/27.9, land 199/193, pen 5.97/5.50 | UNCHANGED (byte-identical, re-verified)
arctic    | 212.1 / 190.4 (schema-2 current build: 215.0/194.7, ice med 2.0) | med 425/451, best 262/239, in-time 70/54, fins 144/140 of 144 | UNCHANGED (byte-identical, re-verified)
seatrials | ~190 / 180.9        | 199.59 / 194.13, OCS 14.78%, pen 0.40      | 199.65 / 194.23, OCS 15.44% (within 1σ), pen 0.40, boat 0.51
Note: bay med carries a real behavioural improvement in the start (gun
crossing p90 18.2→11.7s, OCS A-set 2.8→0.6%) at a neutral pooled clock
(four disjoint sets: +4.3/−2.6/−1.1/+1.0 mean paired).

## OCEAN PROMOTED (owner decision, 2026-08-06 night)
The Aug-5 22:58 "Venue fixes" cut of ocean.venue.js is now the benchmark:
re-frozen at fingerprint `4a64ff07746434a4` (was `b1b5e90f68570567`).
venues:check green on all four benchmark venues. Baselines on the old cut
are RETIRED — do not compare across the fingerprint line. The live ocean
anchors (`ocean_bench_finaloc2` 192, `ocean_bench_meter3oc`,
`ocean_bench_vo4oc` 192.5) were all recorded on the new cut and stand
unchanged; no re-runs were needed.

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 2026-08-06/07 OVERNIGHT PUSH (started 22:15 PDT, HEAD e487124)
# ═══════════════════════════════════════════════════════════════════════════
HEAD verified e487124 = abb62aa + ocean promotion (venue fingerprint/campaign
doc only; behavior tree byte-identical — abb62aa anchors stand).

## ⚡ P2 DELIVERED AS MEASUREMENT — STAND-ON RESIDUAL ATTRIBUTED (no candidate)
`_standon_attrib.js` (new, tracked): pure observer, 10Hz; at every stand-on
deflection EPISODE (rising edge |lastAvoidDeviation| > 2deg, 3s merge) records
riskState, threat geometry (range/dCPA/tCPA via getRiskMetrics), the
properCourseCPA the engine already computes ("did anything need doing"),
VO-set membership, third boats inside the 250u nudge radius, marks, clearance.
Bay 20@9100 (n=760 episodes) + seatrials 20@100 (n=331), both on clean HEAD:
  - risk=LOW n=0 BOTH venues — the role only exists once the risk ladder is
    active; "no hold bonus at LOW" is structurally impossible as a mechanism.
  - ~75-83% of stand-on deflection episodes are LEGITIMATE Rule-14: properCPA
    at onset med 60/64/47u (bay M/H/I; seatrials 60/49/38) — holding course
    would pass inside the 80u owed gap; the give-way rival is genuinely not
    clearing. THE STAND-ON RESIDUAL IS MOSTLY DOWNSTREAM OF THE GIVE-WAY
    SIDE — her extra 10% of holds is largely her rivals clearing for her.
    Push B's remainder (minimal-escape sizing/alpha split) is the fix's
    address, not any stand-on knob.
  - The NEEDLESS class (pCPA>110: bay 23%, seatrials 17%) decomposes into two
    named mechanisms, replicated on both venues:
      (1) RISK-LADDER STALENESS (~14% of all bay episodes): HIGH/IMMINENT
          deflections at NEGATIVE median tCPA (bay -1.2/-2.8s; seatrials
          IMMINENT -4.5s at 647u range, thVO 0%) — the crossing is already
          resolving, the VO set has correctly exited, the ladder is still
          escalated and the hold bonus is weak (1000) or absent exactly there.
      (2) MEDIUM STICKY-DEFLECTION (~9%): pCPA 177u says the PROPER course
          clears while the already-deflected CURRENT course keeps the VO
          entered — the deflection sustains itself (desired-vs-current
          heading hysteresis).
  - Future candidate named, NOT built (avoidance-class change: lake 20x2 +
    arctic judgment required per the nonlocal rule): de-escalate the ladder
    when the VO is exited and tCPA < 0. The 80u owed-gap knob stays closed.

## ⛔ P1 REJECTED with mechanism — SCENARIO-POOL RESIDUAL RL (Push C), THREAD CLOSED
The budget fix WORKED and the verdict is therefore about the SEAM, not the
budget: 92k scene-episodes overnight (78.6k run 2 + 14k run 1; 150x the driver
ES's ~600), 2.1-2.9 min/generation at 8 workers, spawn-into-scenario restores
proven deterministic and inert (`scn_check.js`: DETERMINISM PASS cross-page,
INERTNESS PASS, hook live; twin cache byte-reproducible). Pool: 3,934 scenes
from 40 training seeds (thread 1646, squeeze 846, gap 825, wiggle 180),
85/15 hash split.
  Run 1 (mixed MIX, 29 gens): validation -30.5 -> -17.1, guard x2, meanPol
    oscillating noise-shaped. Mid-run fitness fix: per-scene paired deltas
    are TAIL-DOMINATED (a twin that wedges while the policy escapes is a
    +-2000u outlier; clip at +-250u so a bifurcation is one win, not ten).
  Run 2 (decisive MIX — wiggle .35 gap .35 thread .20 squeeze .10, sigma
    0.25, 56 scenes/gen, 120 gens): 12 validations oscillating -30..+13
    around the floor, no climb; best-by-validation gen 19 (+13.3u on the
    120-scene subsample).
  DEFINITIVE HELD-OUT READ (all 605 scenes, `scn_heldout_eval.js`): mean
    +2.6u, med 0.0, win/loss 262/281, hits 0.668 vs 0.646 — and WIGGLE, the
    class with the clearest classical headroom, is -36.8u mean (13/21): a
    bounded 2Hz heading nudge on top of the classical command makes stuck
    scenes WORSE (it fights the wiggle system that owns escapes). The gen-19
    subsample score was checkpoint-selection noise.
  FULL-RACE GATE (16+16 vs canyonarcA/B): A paired med +13.0 SLOWER, boat
    12.10->14.10 floe 30.26->33.96 land 19.19->22.39 pens 1.81->2.03; B
    paired med +9.0 slower, boat 13.42->15.19. Both disjoint sets slower,
    contacts up. KILL CRITERION MET (two overnight runs without beating the
    classical floor on held-out scenes) — the f0e290e-seam RL thread closes
    at TWO kills (whole-race driver ES, scenario-pool residual). The arctic
    solo-ice residual (~90-130s) goes back to CLASSICAL candidates: the
    stuck-detector latency (wiggle scenes are where classical is measurably
    worst) and lead choice — or a different policy class than a 12-dim
    linear bounded residual, which is beyond this seam's mandate.
  Artifacts: scn_shared/harvest/check/train/heldout_eval.js tracked;
    scn_policy.json (+ run-1 copy) tracked; the 20M scene pool is
    reproducible (scn_harvest.js, seeds 20000-20039) and not tracked. The
    seam patch exists ONLY in treeSCN; master's behavior tree was never
    touched (verified: diff = the 8-line inert seam block alone).

## SESSION CLOSE (HEAD `e487124`, behavior tree byte-identical to `abb62aa`)
Nothing landed in the shipping tree this session — P1 was rejected at its
gate, P2 closed as measurement, P3 had no new recordings (newest traj files
remain the five Aug-6 19:27 arctic laps). Final HEAD's script.js/rules/
planner/sailcheck are the bytes the Aug-6 night close benched fresh
(fin08* == anchors, JSON-identical, all six sets) — those benches ARE the
post-session numbers, re-cited unchanged; no venue's behavior could have
moved without a single byte moving.

## The venue table (final HEAD `e487124` ≡ `abb62aa` behavior; human = traj recordings)
venue     | human med/best      | pre-session bot (abb62aa anchors)           | post-session bot (e487124)
bay       | 226.2 / 217.8, 0 impacts | 236 / 239 (A/B), OCS 0.6/1.1%, boat 1.91/1.93, pen 0.43/0.48 | UNCHANGED (byte-identical tree)
ocean     | 182.5               | 192.5 (vo4oc), boat 1.93, mark 0.26, OCS 0% | UNCHANGED (new-cut anchors stand)
lake      | 223 / 209.6         | 282 / 289, land 7.77/9.68, 180/180 fins     | UNCHANGED (byte-identical tree)
redrock   | ~227 / 206.6 (s2: 214.7, 0 contacts) | med 674.5/613, fins 56+59/72, best 318/286 | UNCHANGED (byte-identical tree)
arctic    | 212.1 / 190.4 (s2 current build: 215.0/194.7, ice med 2.0) | med 425/451 (canyonarcA/B), in-time 70/54, fins 144/140 | UNCHANGED — and re-verified LIVE this session: the gate's classical baselines re-ran canyonarcA/B's races through the paired harness
seatrials | ~190 / 180.9        | 199.65 / 194.23, OCS 15.44%, pen 0.40       | UNCHANGED (byte-identical tree)

## NEXT-PUSH POINTERS
- Arctic solo-ice residual is now a CLASSICAL thread: (1) stuck-detector
  latency (the wiggle corpus: 180 harvested scenes, detector 10-18s blind;
  the human's recovery is seconds), (2) lead choice on approach. The scene
  pool + spawn-into-scenario env survive as a MEASUREMENT harness for any
  classical candidate (scn_heldout_eval.js paired read, no RL required).
- P2's named candidate (NOT built): de-escalate the risk ladder when the VO
  is exited and tCPA < 0 (staleness class, ~14% of stand-on deflections,
  replicated bay+seatrials); MEDIUM sticky-deflection hysteresis second.
  Avoidance-class change: judge on lake 20x2 + arctic per the nonlocal rule.
- Push B remainder unchanged (minimal-escape sizing + alpha split): the
  stand-on attribution says the give-way side's visible response is ALSO the
  stand-on side's fix — 75-83% of stand-on deflections are reactions to
  give-way boats not clearing.

# ═══════════════════════════════════════════════════════════════════════════
# PLAN FOR THE NEXT PUSH — RESEARCHED 2026-08-07 MORNING (owner-directed)
# ═══════════════════════════════════════════════════════════════════════════
Owner direction (verbatim intent): the human sails FAR better on lake, arctic
and redrock — focus there now; bay/ocean/seatrials sit within ~4-5% and their
last X% waits until the big gaps close. River has been ADDED to the roster;
benchmark it first so we know where we stand.

## P0 — RIVER (Sockeye Run): benchmark + analyze (NEW venue, no human reference)
Venue frozen into the benchmark set 2026-08-07: `river @ 2520b114cb5c0ab4`
(fingerprint.json; the other four re-verified matching — venues:check green).
Document: windward-leeward 4 legs, 5 marks, cutoff 360, ~24 authored current
regions (the stream "runs hard down the middle and dawdles along the banks"),
rocky-bank shapes (the ~86 bank islands the avoidance perf work already
prunes), region gusts. The capability card it likely tests: CURRENT-LANE
CHOICE (a strategy-layer question the stack has never been benched on),
narrow-water traffic (lake's class — expect navigable-clearance p50 < 10, so
the VO-onset suppression should be OFF; verify with `_clear_dist.js`), and
bank avoidance under drift.
  P0 protocol:
  1. check_raceable green (smoke started at plan time).
  2. Anchors: 16-seed x 2 DISJOINT sets (9100/9200), fleet bench with leg
     splits + contact classes (land=banks) + OCS + in-time under the 360
     cutoff; label river_bench_r0A/B, stamped with the fingerprint.
  3. Attribution pass: where does the time go — current-lane usage vs the
     midstream (does the router price the current? VMG_eff vs ground speed),
     liveness stalls on banks, start class, traffic queuing at marks.
  4. NO human recording exists (river was in the no-recording list) — the
     venue table carries fleet-only numbers until the owner races it; ask.
  5. Capability mapping per the standing rule: name which existing capability
     each river deficiency shares a line with (lake corridor spacing, redrock
     thread, ocean current trim) — transfer targets before new mechanisms.

## P1 — ARCTIC solo: stuck-recovery latency, scene-harness first
The leader's whole 90-130s gap is solo pack-sailing; wiggle scenes are
classical's MEASURED worst class (the rejected residual made them worse, the
classical twin base rate is the reference). The wiggle detector waits 10-18s
where the human recovers in seconds.
  Candidate class: cut detection latency / earlier commit to the recovery
  turn, judged FIRST on the surviving scene harness (180 harvested wiggle
  scenes, paired deterministic replay, ~2.3s/scene — minutes per verdict via
  `scn_heldout_eval.js`-style paired read with the candidate tree as "policy"),
  THEN the full 16+16 canyonarcA/B gate. Ice-horizon knees are verified — do
  NOT re-tune them; this is about the detector, not the horizons.
  Second candidate if latency lands: lead choice on approach (opening vs
  closing leads at longer range).

## P2 — LAKE mark-3 pocket: queue-interior attribution -> ONE flowing candidate
Half of ALL lake groundings are inside the 250u funnel radius where metering
never acts (76% under 0.5kt, liveness normal — a QUEUE, not a stuck state;
the wiggle fix will not touch it). Closed families stay closed: reservation,
holds, station-keeping. Measure FIRST (same shape as the stand-on
attribution): instrument the funnel interior — berth geometry of grounders vs
survivors, who is parked where, what pushes the grounder onto the lee shore,
roles and overlap state at grounding. Then ONE candidate expressed as flowing
spacing/berth (arrival offset, exit-lane bias — whatever the measurement
names). Judge on lake 20-seed x 2 disjoint sets + redrock finishers both
sets + arctic byte-or-neutral (nonlocal rule).

## P3 — REDROCK: congestion-priced route choice (measure first)
The fleet buys ONE optimal lane (north thread) and queues for minutes; the
owner's schema-2 lap sailed a southwest arc costing ~2s solo and finished
214.7. The router prices time-cost but not occupancy. Measure: lane occupancy
vs time on the thread, realized queue delay per boat, the bots' cost gap for
the southwest arc (is it priced close?). Candidate: congestion term in route
scoring so near-equal lines split the fleet — route CHOICE, not station-
keeping, no closed family touched. Judge on finishers over BOTH 8-seed sets
(8-seed redrock cannot resolve otherwise), plus lake 20x2 (nonlocal rule).

## Standing
- Give-way underlay (Push B remainder) stays queued BEHIND these, and when
  built is judged ON the big three (arctic squeezes, redrock thread head-ons,
  lake corridors) — constrained water is exactly where the VO-onset scoping
  lesson bit.
- The P2-named staleness candidate (de-escalate at VO exit + tCPA<0) waits
  with it — same gate discipline.
- Ingest any new schema-2 recording the day it lands (`_gw_ledger2.py`);
  river/glowtide/lagoon/swamp still have NO human reference.
- Close with the venue table on final HEAD — now SEVEN rows (river added,
  fleet-only until a recording exists).

## P0 SMOKE RESULT (recorded at plan time, 2 races)
check_raceable river: half the fleet finishes inside the 360 cutoff, but the
land gate FAILS at 22,156 shoreline collisions per boat-race (frame-scale —
boats are grinding the banks for most of the race; boat rubs 253.9/boat-race,
pens 1.7; furthest-leg spread {3:4, 4:14}). Per the owner ruling this is an
AI DEFICIENCY, not an authoring problem. Leading hypothesis for P0's
attribution to test FIRST: CURRENT SET COMPENSATION — the river's authored
current is strong and spatially structured (24 regions, fast midstream/slack
banks), and neither the steering projection nor the grid router has ever been
benched against lateral set (ocean's current never punished the miss). Same
physical-line question as floe drift: the thing moving is the WATER. Check
where the 22k contacts happen (upwind legs vs downwind, mid-leg vs mark
approach), whether boats are being SET onto the lee bank while aiming
correctly in heading-space, and whether pathSailable prices current at all.

## ⚠️ PHASE 0 ADDENDUM — THE TREE MOVED (recorded 09:58, before push start)
The owner's morning merge (78bdcb2 river venue + a05acaf scenes, merged as
bd574bf) changes script.js by ~510 lines: the new AWASH shoal class (water a
hull may sail over — pruned from every avoidance obstacle test and from Rule
19), current rendering, venuedoc plumbing. River's smoke above ran on the NEW
tree (valid). Every stored anchor (canyonarcA/B, bay vo3/vo4, lake meter3/fin,
redrock meter3, seatrials) is PRE-merge. Standing rule 6 applies: the next
push OPENS by re-running one bench per judged venue against its anchor —
byte-identical JSON => the anchor stands; anything else => re-baseline that
venue fresh on the new HEAD before any candidate is judged. Do not compare a
candidate on the new tree against a pre-merge anchor without this check.

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 2026-08-07 DAYTIME PUSH (started 10:20 PDT, HEAD at open 1d9cf8c)
# ═══════════════════════════════════════════════════════════════════════════
Owner-directed: the BIG THREE (lake/arctic/redrock) + river P0; bay/ocean/
seatrials wait. ONE LANDING (congestion-priced route choice — redrock +8/+5
finishers), river's first anchors + full attribution, and four candidate
families killed with mechanisms.

## PHASE 0 — ANCHOR RE-VERIFICATION AFTER THE OWNER MERGE (bd574bf → 1d9cf8c)
One bench per judged venue vs its pre-merge anchor, fresh treePH0 from HEAD:
  bay vo3bayA, lake meter3lakeA, redrock meter3rr, arctic canyonarcA:
    BYTE-IDENTICAL JSON — the AWASH/current-rendering merge does not touch
    these venues' behavior. ALL PRE-MERGE ANCHORS STAND (B-sets by construction).
  seatrials: treePH0 run_eval 100@100 == treeVO4 eval_results BYTE-IDENTICAL —
    199.65/194.23 OCS 15.44% stands.
  ocean: MOVED (the AWASH class acts on ocean's shoals) and NEUTRAL: paired
    per-boat med 0 / mean −0.44, boat 1.94 vs 1.93, mark 0.28 vs 0.26.
    RE-BASELINED: ocean_bench_ph0oc (20@9300, fp 4a64ff07) med 192 mean 194.3.
  Fingerprints: all six match anchor metas; river frozen 2520b114cb5c0ab4.
  Current profile measured per venue: river 5.16 kt max over navigable cells,
  bay 1.23, ALL OTHERS EXACTLY ZERO — the venue-class knee used twice below.

## P0 — RIVER (Sockeye Run): ANCHORS + ATTRIBUTION (fleet-only; NO human rec)
ANCHORS (fingerprint-stamped, on the final tree — river is byte-identical
pre/post landing, see the scope):
  river_bench_r0A (16@9100): fins 119/144, in-360 115 (80%), med 272 best 201,
    land 349.7/boat-race, boat 30.5, pen 2.00, OCS 0.
  river_bench_r0B (16@9200): fins 114/144, in-360 111 (77%), med 273 best 210,
    land 374.6, boat 46.4, pen 1.97.
  Leg splits med (both sets): start→1: 10s | 1→2 beat upstream: 65-66s |
  2→3 return: 29-30s | 3→fin downstream run: 158s ← the race lives here.
  _clear_dist: navigable p50 = 5 (<10) ⇒ VO-onset suppression correctly OFF.
ATTRIBUTION (_river_attrib.js, tracked): 100% of land-contact episodes on
  LEG 3, 100% mid-leg, none near marks. At episode open: current 3.6 kt,
  |cross-set| 2.1 kt, SOG 5.4 kt, TWA ~100°, heading ALREADY 75° off the nav
  bearing, avoidance active 48%, liveness normal. SET-CLASS (aiming right,
  silently displaced) = 2.4% — boats are NOT drifting in blind; they are
  carried in while fighting.
THE GEOMETRY: leg 3 threads a RAPIDS CHUTE (y 1680-3640): a 100-400u
  navigable slot, diagonal SE, wall-to-wall 3.8-5.2 kt current between rock
  islands — NO slack lane exists inside it. The fleet grinds it end to end.
  ⚠️ test_sailable FAILS on river at CLEAN HEAD (pre-existing, 1d9cf8c): NO
  HULL-WIDTH PATH exists for exit2→pre3 — part of the chute is narrower than
  the hull-path standard, so the grinding has a geometric floor. OWNER SHOULD
  SEE THIS (raceable-by-design ruling vs a slot the pathfinder cannot thread).
⛔ GROUND-FRAME LAND PROBE closed at 2 kills: rotating the avoidance ray onto
  the ground track (venue-class gate maxCur ≥ 2 kt, byte-inert elsewhere)
  bought paired med −17/−8 but cost 12-14 finishers with boat rubs ×2-3.7
  (v1), pinned-gate v2 no better (fins 119→105) — and the attribution was
  UNCHANGED (episodes 418→385): anticipation was never the binding mechanism.
NEUTRAL, not landed: clearance-capped probe ("the probe cannot be longer than
  the water is wide", cap at clear<3 cells): fins +2 net, boat rubs −29%
  pooled, chute grinding unmoved (350/375→359/353) — the honest verdict is
  the slot is at/below hull scale and probe geometry cannot fix it.
NEXT CLASS for river: threading dynamics at conveyor speed (the pursuit
  carrot is a DISTANCE — 250u floor ≈ 1.7s at the chute's 150u/s ground
  speed) or metering INTO the chute; and ask the owner for a recording.

## P1 — ARCTIC stuck-recovery: MEASURED; the extension family died twice
scn_wiggle_probe.js (tracked; 205 wiggle scenes, classical replay): recovery
  med 6.4s, p90 15.5s, 98% recover <40s; hysteresis dead-band time med 1s
  (NOT the sink); 100/205 scenes recover without wiggling at all. Burst
  early-abort DEAD on measurement: 8/160 bursts truly fail, and a slow burst
  at +2.5s still succeeds 80% — an abort would kill winners.
THE TAIL (61 scenes >10s): re-sticks 2-4×, and 71% of re-sticks gain <120u —
  the SAME pocket; med 3.5s escape→re-stick. The 1.5s clearance hands the
  helm back while the bearing to the nav target is still a wall.
⛔ treeARC (extend every escape while blocked, cap 4): REJECTED at the scene
  gate — wiggle class −9.1u mean, 22/34 W/L on the 774-scene paired read.
  The stock first return-to-route is usually efficient.
⛔ treeARC2 (loop-breaker: extend only when a wiggle re-triggers within 6s of
  the last hand-back): INERT — 763/774 scenes identical, 2/9 where it fired.
THE THREAD'S REAL SHAPE: the tail is an UPSTREAM route-choice problem
  (pocket entry / lead choice) wearing a recovery costume — the same
  conclusion the sighted-wiggle rejection reached. scn_tree_pair.js (tracked)
  now does paired scene reads between two TREES (call __rltInstallCounter or
  hits read zero).

## P2 — LAKE mark-3: THE QUEUE STORY IS DEAD ON THIS TREE
_lake_funnel.js + _lake_stall.js (tracked, 8 seeds): 54% of ALL lake land
  hit-frames are the 600u pocket (confirms "half"), but the grounders are
  SOLO: n100=0, n250 med 0, nearest rival med 326u, wind 6.7 kt, moving 5.6kt
  within the prior 8s. NOT a queue — the funnel-metering/berth framing from
  Aug 6 does not describe the current tree's failure.
THE MECHANISM: mark-3 sits in a DEAD-END COVE (one west mouth; wind presses
  onto the SE back wall). Clean and dirty passes enter on the SAME line
  (−135° bin, all of them); the differentiator is a STALL to ~0 kt inside:
  93% of stalls follow sustained ~34° avoidance deflection DURING the armed
  rounding (LUFF 5%, GLASS 11%, roundArmed 68%, dMark ~177u) — a turning
  boat's straight probe ray always ends in a cove wall, every candidate is
  taxed/vetoed, and the argmin churns the helm until the way dies. The human
  (3 recordings) transits in 17-20s, ONE tack, never <4.3 kt, through the
  same 1.4-3 kt glass.
⛔ treeP2 (armed-rounding probe cap 150u inside zone×1.5): REJECTED — lake
  land UP on BOTH 20-seed sets (7.77→8.62 +11%, 9.68→15.23 +57%) despite
  paired clock −0.2/−6.7 and marks/pens down. The far-half caution does real
  work in the cove; blinding it converts stall-churn into wall contact.
NEXT CLASS: make the mid-rounding deflection COHERENT with the orbit
  (deflect along-arc rather than per-tick argmin re-picks). Judge on lake
  20×2 + redrock both sets + bay.

## ✅ P3 — LANDED: CONGESTION-PRICED ROUTE CHOICE (measure → v1 → v2 → scope)
MEASURED (_rr_occupancy.js, tracked, 4@9400): redrock parked(<1kt) med
  27/25/35s per boat on legs 2/3/4, p90 98-130s; dominant cluster
  (−200..0, 1200-1600) = the north thread; up to 3 boats parked
  simultaneously in one 200u bin. ~90s med per boat lost parked.
MECHANISM: at replan, stamp cells (r=2) around parked rivals (<1 kt, leg≥1,
  ≤1500u, self excluded); pathSailable prices stamped cells like plugged
  water (× min(6, 1.5+1.5·count)). Re-stamped every 2-3s replan, so a jam
  that clears stops pricing within one replan. Route CHOICE — nobody holds
  station; the second-arriving boat just stops buying the parked lane.
REDROCK (judged on finishers over BOTH 8-seed sets):
  A 9400: fins 56→64, paired med −38 / mean −27, land paired −27,
    boat 30.8→23.7, pens 5.97→4.75
  B 9500: fins 59→64, paired med +3 / mean −18.9, land −16 mean,
    boat 27.9→22.8, pens 5.50→4.49
v1 GATES: arctic A neutral (+1/−1.1, in-420 70→75), arctic B
  neutral-positive (0/−7.3, floe 34.2→30.2, land 27.2→24.1, boat 13.4→9.7);
  bay neutral both sets (rubs +0.37/−0.31 sign-flip); ocean neutral;
  seatrials BYTE-IDENTICAL (stamp never fires). LAKE SPLIT: A +5 paired med
  with land +30%, B neutral — the one damage signal.
v2 SCOPE: A QUEUE AT A MARK IS THE ROUNDING ITSELF — every boat must pass
  that water; routing "around" it detours the approach into whatever
  surrounds the mark (lake's cove: land). Skip stamping parked rivals inside
  any mark's 250u funnel; only CORRIDOR jams price. Lake A fixed (paired med
  0, land residual mean-only +1.3, med 0 — inside the landed no-go-escape
  precedent of +6%/+32%); lake B 0/−0.6; redrock unchanged-to-better
  (B fins 58→64 vs v1); arctic A byte-similar neutral, B dirt down across
  the board.
⚠️ THE RIVER GATE THEN CAUGHT v2: river fins 119→107 / 114→105 with land
  +32%/+21% — in a 2+ kt stream a sub-1 kt boat is PINNED BY THE WATER, not
  queuing, and the chute has no alternative lane, so pricing the "jam" only
  deforms routes into rock.
FINAL SCOPE (landed): jam stamps OFF where max blended navigable current
  ≥ 2.0 kt (state.course._avCurMax, lazy, RNG-free; current-free venues
  compute 0 without touching getCurrentAt). VERIFIED: river 4-seed
  BYTE-IDENTICAL to pre-landing (r0A/B stand), redrock 4-seed BYTE-IDENTICAL
  to v2 (win intact), bay 4-seed BYTE-IDENTICAL to its benched v2 read.
Ocean re-read on a DISJOINT set after a +5-med scare on 9300: 20@9400 paired
  med 0 / mean −2.1 with boat/mark/pens all down — sign disagreement across
  sets = noise; ocean NEUTRAL pooled.
Goldens: 10/20 behavior changes → FULL --update re-record on the final code
  (a first update run straddled the scope edit and was killed unwritten —
  never let a golden record cross an edit). npm test: unchanged from clean
  HEAD (the river sailable failure above is PRE-EXISTING and stops the &&
  chain before the 6 known editor failures).
NEW ANCHORS on the landed tree: redrock ocean_bench_p3v2rr/p3v2rrB; lake
  ocean_bench_p3v2lakeA/B; arctic fleet_leg2_p3v2arcA/B; bay
  bay_bench_fin07bayA/B; ocean ocean_bench_fin07oc + ph0ocB/fin07ocB
  (disjoint pair; ph0ocB is the clean-tree 9400 baseline); seatrials
  byte-carried (199.65/194.23); river r0A/B stand (byte-identical).

## The venue table (final HEAD; human = traj recordings; river fleet-only)
venue     | human med/best      | pre-session bot                                   | post-session bot (final HEAD)
bay       | 226.2 / 217.8, 0 impacts | 236 / 239 (A/B), boat 1.91/1.93, pen 0.43/0.48, OCS 0.6/1.1% | 236 / 239 UNCHANGED med (paired +0.6/−1.3 mean), boat 2.16/1.62, pen 0.46/0.44, OCS 0.6/1.1%
ocean     | 182.5               | 192 (ph0oc re-baseline post-merge; old 192.5 anchor retired)  | 193 / 192 (9300/9400 sets), paired med 0 both, mark 0.28→0.19-0.29, boat pooled flat
lake      | 223 / 209.6         | 282 / 289, land 7.77/9.68, 180/180 fins           | 287 / 290, paired med 0 BOTH sets, land 9.11/10.11 (mean-only tail, med 0), 180/180 fins
redrock   | ~227 / 206.6 (s2: 214.7) | med 687/613 (my comparator), fins 56+59/72, land 199/193, pens 5.97/5.50 | med 637/593, FINS 64+64/72, land 184/176, pens 4.75/4.49 ← THE LANDING
arctic    | 212.1 / 190.4 (s2: 215.0/194.7) | med 425/451, in-420 70/54, fins 144/140, floe 30.3/34.2 | med 413/450, in-420 75/53, fins 143/139, floe 32.1/30.3, boat 12.5/9.7, pens 1.66/1.76
seatrials | ~190 / 180.9        | 199.65 / 194.23, OCS 15.44%, pen 0.40             | UNCHANGED — BYTE-IDENTICAL (stamp never fires)
river     | NO RECORDING (ask)  | r0A/B: med 272/273, in-360 80%/77%, land 350/375, boat 30/46, pen 2.0 | UNCHANGED — BYTE-IDENTICAL (current-class scope)

## NEXT-PUSH POINTERS
- REDROCK residual after the landing: med 637/593 vs human ~227 — still 2.7x.
  The congestion term removed ~50s + 13 finishers; the remaining gap is
  one-lane THROUGHPUT physics (defile service rate) + the leg-1 start class.
- RIVER: the chute is the whole game — hull-width path does not exist for
  part of it (owner: authoring look or accept grinding?); threading dynamics
  (time-based pursuit carrot at 150u/s ground speed) is the named candidate;
  fleet-only benching until a recording exists.
- LAKE mark-3: orbit-coherent deflection (deflect along the rounding arc)
  is the named candidate; the queue framing is retired.
- ARCTIC solo: lead choice on approach (route level), NOT recovery latency —
  recovery med is 6.4s and both extension shapes are dead.
- Queued behind these: give-way underlay (Push B remainder) + the VO-exit
  staleness de-escalation, judged on the big three when built.

## ✅ SECOND LANDING — ORBIT-ARC LAND PROBE (P2 continued past the mandate)
The rejected probe-cap named the residual: make the deflection COHERENT with
the rounding. The arc probe does it geometrically — while a rounding is ARMED
inside zone*1.5, the land-probe ray is cast along the CIRCLE the boat is
sailing (radius max(70u, dist-to-mark), curving toward the mark's side of
each candidate heading) instead of a straight line the turning boat will
never sail. The hard-zone wall test keeps full authority along the arc: this
moves WHERE the probe looks, not how much it cares.
THE ROAD (three scopes, each earned by a measurement):
  v1 unscoped: lake A/B paired med −9/−6 with land −31/−26% and the cove
    mechanism VERIFIED (_lake_funnel on the arc tree: grounding episodes
    90→36, stalled passes 41/78→12/74, deflection-at-grounding med 45.8°→0°)
    — but river fins −5 with rubs ×2.1 (arc + 4kt set = fiction) and redrock
    fins 259→235 pooled over four disjoint 8-seed sets.
  current-class scope (arc OFF at _avCurMax ≥ 2kt): river BYTE-IDENTICAL
    (verified 4-seed JSON identity).
  v2 boat-clearance≥3 gate: WRONG discriminator — redrock still −17 pooled
    while the lake win shrank to −4/−1 (the cove is clearance<3 water; the
    gate turned the arc off exactly where it wins). Mark rings at 90u are
    1.00 navigable on every venue — not the discriminator either.
  DNF anatomy (_rr_dnf.js, tracked): the arc tree's extra redrock DNFs die
    UNARMED, at 1.26kt, ~584u from mark-5 — IN THE THREAD QUEUE (11/13 vs
    3/8 baseline). THE ARC ASSUMES AN UNOBSTRUCTED ORBIT; A QUEUE IS NOT ONE.
  v3 queue gate (no arc when a parked rival <400u — the same parked test the
    jam stamps use): redrock resolved NEUTRAL over SIX disjoint 8-seed sets,
    48 seeds pooled: finishers 385→384 (set deltas +2/+2/−7/−3/−3/+8 = noise).
FINAL GATES (all on the P3-landed baseline):
  lake A: paired med −12 mean −11.3, land 9.11→5.63 (−38%), boat 2.73→2.04
  lake B: paired med −12 mean −11.5, land 10.11→6.17 (−39%), boat 3.30→2.56
    (both sets agree on EVERY metric; med 287/290 → 275/278)
  redrock: 48-seed pooled fins −1 (NEUTRAL); land ≈ flat
  bay A/B: 0/−2 med, rubs 2.16→1.95 / 1.62→1.83 (pooled flat) — neutral
  ocean: med 0 mean −4.4, boat 2.49→1.88, pens down — neutral-positive
  river: byte-identical (current-class scope, verified); arctic byte-identical
    by construction (openWaterAv false); seatrials byte-identical (no armed
    roundings on a gates-only course).
Goldens fully re-recorded on the final code, PASS. NEW ANCHORS: lake
  ocean_bench_p2b3lakeA/B, redrock ocean_bench_p2b3rr{A..F} (+ rrbase{C..F}
  clean-tree baselines), bay bay_bench_p2b3bayA/B, ocean ocean_bench_p2b3oc;
  arctic/seatrials/river carry (p3v2arcA/B, eval_results, r0A/B).
LAKE STANDING: med 282/289 → 275/278 vs human 223/209.6 — the gap closes
  ~12s AND the grounding dirt that defined the venue drops ~38%.

## The venue table, FINAL (post both landings; human = traj recordings; river fleet-only)
venue     | human med/best      | pre-session bot                          | post-session bot (final HEAD, both landings)
bay       | 226.2 / 217.8, 0 impacts | 236 / 239, boat 1.91/1.93, pen 0.43/0.48 | 236 / 237 (p2b3bayA/B), boat 1.95/1.83, pen 0.44/0.43, OCS 0.6/1.1% — NEUTRAL
ocean     | 182.5               | 192 (ph0oc post-merge re-baseline)       | 192 (p2b3oc), boat 1.88, mark 0.26, pen 0.39 — NEUTRAL-POSITIVE dirt
lake      | 223 / 209.6         | 282 / 289, land 7.77/9.68               | 275 / 278 (p2b3lakeA/B), land 5.63/6.17 (−38/−39%), boat 2.04/2.56 ← ARC LANDING
redrock   | ~227 / 206.6 (s2: 214.7) | med 687/613, fins 56+59/72, pens 5.97/5.50 | med ~604/585 region, fins 385→384 over 48 seeds ≡ P3 anchors 64+64/72 med 637/593, pens −20% ← CONGESTION LANDING (arc neutral)
arctic    | 212.1 / 190.4       | med 425/451, in-420 70/54, floe 30.3/34.2 | med 413/450, in-420 75/53, floe 32.1/30.3, boat 12.5/9.7 (p3v2arcA/B; arc byte-identical)
seatrials | ~190 / 180.9        | 199.65 / 194.23, OCS 15.44%              | UNCHANGED — byte-identical through both landings
river     | NO RECORDING (ask)  | r0A/B med 272/273, in-360 80/77%, land 350/375 | UNCHANGED — byte-identical through both landings (current-class scopes)

## ADDENDUM (same day) — THE OWNER'S RIVER LAP: test_sailable RECONCILED
Recording landed: traj_river_1786084446572.json (schema-2, tracked). FINISH
161.3s vs fleet med 272 / best 201 — the fleet is 1.69x. Leg splits: beat
~51s (fleet 65), return ~29 (fleet 30), DOWNSTREAM RUN 80.9s vs the fleet's
158 — the whole gap is the run, and she transits the rapids chute in 22.5s
at ~6kt water speed with 4 land touches (fleet: ~350 contacts/boat-race).
RECONCILIATION of the "no hull-width path" flag: overlaying her 1788 samples
on the bot grid, 37 of her 209 chute samples (18%) sit in cells the grid
walls — and those are BANK-CLEARANCE cells: buildGrid inflates every shore by
CLEARANCE = 44u (HULL_R 30 + 14). In a 100-400u slot that eats 88u of width;
the exit2→pre3 segment has water, just not 44u-margin water. test_sailable is
RIGHT about the grid and the grid is the AI's own conservatism — NO AUTHORING
LOOK NEEDED; the flag converts to a capability card: THREADING INSIDE THE
CLEARANCE MARGIN (she sails within ~30-44u of rock at speed; the router
cannot even plan there). Awash integration checked en route: 7/9 river awash
shoals are correctly shoal-priced navigable water; the 2 walled centers are
bank-clearance overlaps, not an awash bug.
NEXT-PUSH CANDIDATE (named, not built): a TIGHT-water grid class — cells
within CLEARANCE of shore but with ≥ hull-width of true water become
navigable-at-a-price (the _soft/_shoal construction, a third instance of
"price it as the seconds it costs"), scoped and judged like every grid
change: goldens + all-venue gates; the 44u margin was tuned for open venues
and lake corridors, so expect nonlocal effects — full stack.
Ledger (_gw_ledger2.py, 15 encounters): her stand-on deflection med 6.5°;
bots deflect 66.5° med at 504u onset against her — river is below the
VO-onset venue-class gate (clearance p50 5 < 10, suppression correctly off),
so the give-way underlay remainder applies here too when it gets built.
VENUE TABLE CORRECTION (river row): human = 161.3 (1 lap).

# ═══════════════════════════════════════════════════════════════════════════
# PLAN FOR THE NEXT PUSH — RESEARCHED 2026-08-07 AFTERNOON (post both landings)
# ═══════════════════════════════════════════════════════════════════════════
Standings on `357e27d` (behavior tree = `819d85d`): redrock 2.7x, arctic ~2x,
river 1.69x (human 161.3, 1 lap), lake ~24% (275/278 vs 223), bay/ocean/
seatrials 4-5% and waiting. Order: redrock, river, arctic, lake.

## P0 — REDROCK: post-landing attribution → ONE throughput candidate
The congestion landing bought 13 finishers and ~30s; med 637/593 vs ~227 is
still the biggest gap and the OLD attribution predates two landings. Measure
FIRST on final HEAD: (a) re-run `_rr_occupancy` — where does parked time live
now, and do boats actually take alternate lanes when jams price (route-split
rate at replan)? (b) defile SERVICE RATE: time per boat through the north
thread solo vs in convoy (the residual hypothesis is one-lane throughput
physics — following distance, mid-thread stalls, re-entry after displacement);
(c) the leg-1 start class share. Then ONE candidate named by the data.
⚠️ JUDGING RULE (hardened today): redrock 8-seed sets swing paired med ±30-40
across near-identical trees and set-pair finisher deltas disagree in sign —
judge ONLY on pooled finishers across ≥4 disjoint 8-seed sets (six baseline
sets exist on disk: p2b3rr{A..F} ARE the anchors on this HEAD, with
p3v2rr/rrB + rrbase{C..F} as their clean-tree counterparts). Plus lake 20×2
+ arctic per the nonlocal rule.

## P1 — RIVER: the TIGHT-WATER grid class (measurement = the owner's lap)
Her line proves 18% of the chute lives inside buildGrid's 44u bank-clearance
inflation (CLEARANCE = HULL_R 30 + 14): water with ≥ hull-width of true room
is WALLED, so the router cannot plan the line she sails at 6kt. Candidate:
cells within CLEARANCE of shore but with ≥ ~hull-width (30u) of true water
become NAVIGABLE AT A PRICE — the _soft/_shoal construction, third instance
of "price it as the seconds it costs" (grind risk priced, not walled).
Success criteria: river fins/in-360 up with land contacts DOWN materially
(not traded), the router's planned line through the chute approaches hers,
and test_sailable's river hull-width assertion flips to PASS.
⚠️ GRID-SEMANTICS CHANGE — the widest blast radius of any candidate this
season: the 44u margin is load-bearing on lake corridors, arctic shorelines,
and every venue's lee-shore caution. FULL stack: goldens + bay/ocean 20-seed
+ lake 20×2 + arctic 16×2 + redrock multi-set + river r0 pair. Expect the
avoidance hard-zone (140u) to fight the tight line next — iterate by
measurement (contact anatomy, not guesses), and remember the probe lessons:
where the water moves ≥2kt or a rival is parked, tight-line assumptions die.

## P2 — ARCTIC: lead choice on approach (the last classical solo thread)
Recovery is measured healthy (med 6.4s); the tail re-enters the same pocket —
an ENTRY decision. Candidate class: at approach range, score leads (gaps
between floes) by whether drift is OPENING or CLOSING them over the next
~5s (drift is unpredictable past ~5s — [[regatta-map-staleness]]; stay under
that horizon), not by current width alone. Scene harness FIRST: gap n=148 +
thread n=272 scenes via scn_tree_pair.js (counter installed — hits read 0
otherwise), verdict in ~20 min; THEN canyonarcA/B 16×2 vs p3v2arc anchors +
lake 20×2. Ice horizons stay at their knees; gap projection/stickiness and
the f0e290e RL seam stay CLOSED.

## P3 — LAKE: post-arc attribution only (build only if a one-liner falls out)
The arc landing changed the venue (land −38/−39%, stall class collapsed).
Re-run _lake_funnel + leg splits vs the 3 recordings on final HEAD; name the
next class. ~55s residual. No candidate unless the measurement names one
physical line; the ONE-candidate discipline resets only with a new mechanism.

## Standing (updated with today's lessons)
- When a candidate SPLITS venues, find the discriminator by FAILURE ANATOMY
  (the _rr_dnf pattern) — two blind grid-property scopes failed today before
  the one the DNF data named. Budget one anatomy probe per split.
- parked-in-current ≠ queued (jam stamps + arc probe both gate on
  _avCurMax ≥ 2kt); the arc assumes an unobstructed orbit (parked rival
  <400u gate). Respect both scopes in any traffic/rounding candidate.
- Queued behind the big four: give-way underlay (river's ledger now also
  wants it: bots 66.5° at 504u vs her 6.5°) + VO-exit staleness candidate.
- P-continuous: ingest new schema-2 recordings the day they land; ask for
  lake/redrock/arctic laps on the current build (both big-three venues
  changed materially today) and more river laps (n=1).
- Anchors on `819d85d`: lake p2b3lakeA/B 275/278 (land 5.63/6.17); redrock
  p2b3rr{A..F} 48-seed fins 384; bay p2b3bayA/B 236/237; ocean p2b3oc 192;
  arctic p3v2arcA/B 413/450 in-420 75/53 (byte-carried); seatrials
  199.65/194.23 OCS 15.44% (byte-carried); river r0A/B 272/273 in-360
  80/77% (byte-carried) + HUMAN 161.3 (1 lap).

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 2026-08-07 EVENING PUSH (started 15:03 PDT, HEAD at open b18c527)
# ═══════════════════════════════════════════════════════════════════════════
Owner-directed continuation of the big gaps in order (redrock 2.7x, river
1.69x, arctic 2x, lake ~24%). ZERO LANDINGS — four candidates built and
rejected with mechanisms, every priority resolved by measurement, and the
next push's candidate is now sized by data on three venues. The measure-first
ledger extends: this session 0-for-4 on builds, 4-for-4 on attributions that
overturned the going story.

## PHASE 0 — trivial: b18c527/357e27d are docs+traj only; behavior tree is
byte-identical to 819d85d. All anchors STAND without re-benching.

## P0 — REDROCK: throughput hypothesis KILLED; residual re-attributed
_rr_service.js (new, tracked; 170 thread transits over 4@9400): the north
  thread SERVES FAST — solo med 7.2s, occ-1 8.7, occ-2 14.2, and legs 3/4
  thread time is ~17s of a ~550s race. One-lane throughput physics is NOT
  the residual. Parked time (occupancy re-run, post-landing): 29/25.5/36s
  med per boat on legs 2/3/4 — real but minority.
_rr_leganat.js + _rr_wander.js (new, tracked): THE RESIDUAL IS DEFLECTED
  DISTANCE. Fleet odometer runs 2.2x route length on legs 2/4 (9626u vs
  4359; 7266 vs 3356); per boat-race on legs 2-4: deflected-moving 194s
  over 15535u at ~80 u/s, parked 115s, clean-moving 164s ≈ the human's
  ENTIRE legs 2-4 (145.6s, s2 lap leg splits 64.7/51.3/29.6 vs fleet med
  163.5/121/132). Deflection is ~2/3 rival-proximate (<500u), ~1/3 solo.
  ⚠️ probe arithmetic trap (recorded in standing rules): every-6th-frame
  sampling credits 0.1s per sample, not 0.6 — the first leganat run
  inflated all time stats 6x (odometer, position-derived, was clean).
⛔ CANDIDATE REJECTED — VO-EXIT LATCH RELEASE (treeP4VOX): release the 2s
  risk-ladder latch when the encounter is over (tCPA<0 AND VO exited) —
  the class _standon_attrib named. Judged per the hardened rule on pooled
  finishers over 4 disjoint 8-seed sets: 253→243 (−10) with boat contacts
  +21/+45/+56% on three of four sets, pens up 3/4. Mechanism: the latch
  coast IS spacing in traffic — instant release snaps boats back onto the
  contested line and re-engages the same corridor. The staleness class is
  real (survivor paired meds improved) but the latch is the wrong lever.

## P1 — RIVER: tight-water grid class BUILT AND REJECTED at the success bar;
##      the mechanism survives solo and the blocker is precisely named
THE BUILD (treeP4TIGHT, sailcheck.js + script.js): cells within CLEARANCE
  (44u) of shore but with ≥ HULL_R (30u) of true water become grid._tight
  (value = true clearance, judged with the SAME quarter-point subsampling
  as nav — centre-only left the chute disconnected, the rasterisation
  comment's exact lesson). pathBetween: tight admitted ONLY as fallback
  when no hull-margin path exists (existing routes byte-identical by
  construction). pathSailable: tight priced 2.5→6x graded by clearance
  (the _soft bounds). Paths through tight cells emit the best-clearance
  sub-point (_tightPt) so the line holds the slot's spine. NOT built on
  noSubsample (drifting-ice) grids — same physical line as that gate.
SOLO MECHANISM PROVEN: test_sailable river flips to PASS (all other venues
  PASS); the fleet chute line matches the owner's lap within med |Δx| 58u
  per 200u slice (_river_line.js, new, tracked); 29.6% of fleet chute time
  rides tight cells; survivors run −10..−17s paired med on EVERY bench.
THE TRADE THAT KILLED IT (both 16-seed sets, v2): fins 119→110 / 114→103,
  land +19/+27%, boat rubs ×3.5/×2.2. Contact anatomy (_river_contacts.js,
  new, tracked), v1 → v2 → v3:
  v1: 88% of new boat contact = ONE exit-pocket pile-up at (2000,3400),
    400u east of both her line and the route — the 140u avoidance hard
    zone vetoed along-slot headings and the 5kt set carried vetoed boats
    into the pocket.
  v2 (tight joins the _soft water class at all avoidance sites — probe
    pricing graded 6000→12000, wallAhead, taxTack, rollout, ring scans,
    replan-skip): exit pocket FIXED, but the pile-up moved mid-slot
    (800,2400) and became binary — 2 of 4 seeds develop a standing
    raft-up when two boats enter together (96% of boat contact in that
    bin; slot occupancy p90 3→4).
  v3 (slot-occupancy stamp: tight cells near a rival-in-tight-water price
    like jams at replan; flowing, no parked test): BYTE-IDENTICAL both
    sets while the stamp verifiably fires — the raft-up rivals sit in the
    DISPLACED pocket, off-route; followers' routes never bought those
    cells. Route pricing cannot reach displacement-driven failures.
THE BLOCKER, NAMED: mid-slot ENCOUNTERS. A deflection in ≥2kt cross-set is
  a one-way door — the deflected boat cannot beat back against the stream
  and lands in the east-bank traps. Encounter RESPONSE in the constrained/
  current class is the gate the tight water waits behind (her stand-on med
  is 6.5°; the fleet's is 34-69° — see the attribution below). The tight
  construction itself is validated and shelf-ready; re-bench it the day
  the response class lands. planFloeTrajectory note: the rollout planner
  EARLY-RETURNS without floes — river/lake/redrock have no trajectory
  planner at all; their avoidance is straight probes only.

## P2 — ARCTIC: closing-lead route pricing DEAD AT TWO SHAPES
v1 (one line in pathSailable: open cells under _futBlk price 2.5x — the
  mirror of the opening-lead discount, reusing the landed 8s horizon):
  SCENE GATE WIN — 774 scenes, +9.8u mean, W/L 209/160, ice hits/scene
  0.846→0.748, thread class (the re-stick target) +16.9u. FULL-RACE
  REJECT — both 16-seed sets agree: paired med −4/−7, in-420 pooled
  128→108, fins 282→281, floe hits DOWN both sets (32.1/30.3→30.7/28.0).
  The price detours whole routes for predictions that expire en route;
  the local win is real and the global tax is bigger.
v2 (approach-scoped ≤8 cells — "price a closing lead only where you arrive
  while the +8s prediction still holds"): INERT — +1.3u, W/L 125/113,
  thread +0.3. The decisive lead choices happen beyond 8 cells.
Same bimodal death as the clearance-extension family (blanket negative /
  scoped inert). Route-level lead pricing on the drift map is CLOSED at
  two kills. Lake gates: BYTE-IDENTICAL both sets (no floes → no _futBlk),
  the cleanest nonlocal result available.

## P3 — LAKE: post-arc attribution only (per mandate; no build)
_lake_funnel re-run (post-arc tree): pocket share of land-hit frames
  54%→27%; 33 grounding episodes/8 seeds (30 on leg 2), grounders MOVING
  (maxRecent8s 4.8kt), avoidance active 58% at med 17.2°, nearest rival
  med 247u, clusters shifted to the y−1000..−1200 band + (2200,−400).
  ⚠️ the probe's overlap-100%/ROW-0% read was artifact: ROW compared
  getRightOfWay's OBJECT to a boat (fixed in the tracked probe), and both
  stats only sampled rivals <150u. Rule-4 catch recorded.
_lake_legs + _lake_l1.js (new, tracked): the "35.7s under-1kt" on L1 was
  under-4KT (raw b.speed<1.0) — true parked is ~3s/boat. L1 slow time
  (~30s vs human, 6x L2/L3's) lives early (gun+20..40s) and near the
  mark-1 approach (bins 0..400,1600..2000), deflection med only 6°, local
  wind 5.7kt: a traffic/light-air LANE class on the first beat, not a
  queue, not deflection churn. L2 residual: the moving-deflection shore
  band above. No single physical line → no build, mandate respected.

## THE MEASUREMENT THAT NAMES THE NEXT BUILD — stand-on attribution on the
## constrained class (_standon_attrib, HEAD tree, new venues)
  redrock 4@9400: 694 episodes; stand-on frames deflected 52.4%; MEDIUM
    dev med 40.1° properCPA 121u NEEDLESS 52.9%; HIGH 45.8°/111u/50.5%;
    IMMINENT 68.8°/57u/36.7%; 3rd-boat 32-53%.
  river 4@9100: 255 episodes; deflected 32.3%; needless 39/52/32% by
    level; dev meds 34-69°.
  lake 8@9100: 448 episodes; deflected 34.6%; needless 19/33/43%; dev
    29-40°; 3rd-boat 55-65% (lake deflections are multi-boat nudges).
  thVO = 0.0% ON ALL THREE — the whole constrained class sits below the
  VO-onset venue gate (clearance p50 < 10); the wide-venue onset landing
  never reaches it. Versus bay's needless 17-23%.
FOUR datasets now converge on the same candidate: redrock deflected-
  distance (2/3 rival-proximate), river raft-up anatomy + her 6.5° vs
  bots' 66.5°, lake shore-band grounders, and this attribution. The
  give-way/deflection RESPONSE in constrained water is the next build —
  onset AND size — under the lake nonlocal caution (naive suppression
  cost +25% contacts; judge lake 20×2 + arctic regardless).

## The venue table (final HEAD b18c527 = behavior 819d85d; ZERO landings —
## every row byte-carried from the standing anchors, which Phase 0 verified)
venue     | human med/best      | pre-session bot                          | post-session bot (final HEAD)
bay       | 226.2 / 217.8, 0 impacts | 236 / 237 (p2b3bayA/B), boat 1.95/1.83, pen 0.44/0.43, OCS 0.6/1.1% | UNCHANGED — byte-carried
ocean     | 182.5               | 192 (p2b3oc), boat 1.88, mark 0.26, pen 0.39 | UNCHANGED — byte-carried
lake      | 223 / 209.6         | 275 / 278 (p2b3lakeA/B), land 5.63/6.17, boat 2.04/2.56, 180/180 fins | UNCHANGED — byte-carried
redrock   | ~227 / 206.6 (s2: 214.7) | p2b3rr{A..F}: 48-seed fins 384/432, med 637/593 (A/B), pens 4.75/4.49 | UNCHANGED — byte-carried
arctic    | 212.1 / 190.4 (s2: 215.0/194.7) | 413 / 450 (p3v2arcA/B), in-420 75/53, fins 143/139, floe 32.1/30.3, boat 12.5/9.7 | UNCHANGED — byte-carried
seatrials | ~190 / 180.9        | 199.65 / 194.23, OCS 15.44%, pen 0.40    | UNCHANGED — byte-carried
river     | 161.3 (1 lap)       | r0A/B med 272/273, in-360 80/77%, land 350/375, boat 30/46, pen 2.0 | UNCHANGED — byte-carried

## NEXT-PUSH POINTERS
- BUILD: the constrained-class deflection response (give-way underlay) —
  now measured on three venues (needless 32-53%, thVO 0%, dev meds 29-69°
  vs her 6.5-8°). Onset (VO-informed, scoped INTO the constrained class
  safely) + response size. Judge redrock pooled-finishers ≥4 sets + lake
  20×2 + arctic 16×2 + river r0 pair + bay. The lake +25%-contacts caution
  is the design constraint, not an afterthought.
- RIVER: the tight-water class is BUILT and shelf-ready (treeP4TIGHT
  work recorded above); it waits behind the response class. Re-bench
  as-is once the underlay lands — the two compose (less deflection →
  fewer displacements → the slot stays single-file).
- REDROCK: deflected-distance is the gap; the VO-exit latch lever is dead;
  throughput/service-rate is measured healthy and CLOSED as attribution.
- ARCTIC: route-level lead pricing CLOSED (2 kills). The solo residual
  (~90-130s) still lacks a live candidate; whatever comes next must act
  at the waiting/entry layer, not the route price, and the scene harness
  alone cannot green-light it (two scene-win/race-loss divergences now).
- LAKE: L1 lane class named (traffic/light-air, deflection-free) — a
  candidate here is start-adjacent; the start stays sacred.
- Closed families extended: VO-exit latch release; closing-lead route
  pricing (both shapes); tight-slot occupancy stamps (byte-inert).

## ADDENDUM — the underlay DESIGN DOSSIER (completed with remaining push time)
_cpa_onset_probe + _defl_hist on HEAD, the numbers the build parameterizes on:
  ONSET (redrock 7878 onsets / river 2624): HALF of rival onsets fire on
    encounters that would pass at dCPA ≥ 191u / 212u med untouched (p75
    313/329); onset range dNow med 316/310u. τ: tCPA ≤6s covers 90%/78% —
    an ORCA-style horizon of ~6s fits the encounters. 52%/49% of ALL
    avoidance onsets have NO closing rival — canyon/bank land probes are
    half the deflection load on the constrained class by onset count.
  ROLE at onset: NONE 40/43% | GIVE_WAY 38/37% | STAND_ON 21/20% — the
    responsibility split has a full spectrum to key on.
  RESPONSE (deflection histograms, transit frames): redrock 63% of frames
    deflected, river 38%. The spectrum is SPREAD across the fan (pricing
    does choose) but the wide-dodge rungs 1.2/1.6 rad (69/92°) carry 23.4%
    of redrock's and 17.0% of river's deflected time — those two rungs are
    the excess-distance generator, and the stand-on dev medians land on
    fan values exactly (0.5/0.6/0.7/0.8/1.2 rad). Her ledger: 6.5° med.
  Shape this implies (next push, not built): a graded response floor —
    onset honesty (don't engage at dCPA ≫ pairSafe), τ ≈ 6s, role-split
    alpha, and finer/curved low-rungs so the argmin can buy 5-15°
    responses in constrained water instead of jumping to 69°. Judge full
    stack per the pointers above; the lake caution binds the design.

## ✅ LANDED (same push, evening continuation) — CLEARANCE-CAPPED LAND PROBE
The dossier's wide-dodge anatomy named it and the full stack passed it.
MECHANISM (one physical line): the land probe reaches only as far as the
  water is wide — in a 300-600u canyon a 240-400u straight ray always ends
  in wall, so the far-blockage term (30000·(1−frac)) taxed every corridor
  candidate and the argmin bought 69-92° swings nothing physical required
  (_rr_dodge.js, new, tracked: 4182 wide-dodge episodes on redrock — small
  candidates blocked by land-only 39%, soft-costs-only 34%, rival-only 15%).
  Where local clearance < 3 cells: landLen = max(180, min(stock, (cl+1)·res·2)).
  Floor 180u keeps the 140u hard zone plus a graded band (the lake ratchet
  lived below that).
SCOPES (each a landed physical line): openWaterAv only (drifting-ice grids
  byte-identical by construction — arctic 4-seed verified bit-exact);
  OFF where _avCurMax ≥ 2kt (v1 died on the river gate fins 119→109 rubs
  ×2.8 — a short-probe tight line in a 5kt stream is water the boat cannot
  hold; river 4-seed verified BYTE-IDENTICAL under the scope); OFF while a
  rounding is ARMED (arcR — the arc probe is the landed rounding geometry);
  not inside a mark's 250u funnel (the congestion scope's line).
REDROCK, judged on the hardened protocol (pooled finishers, SIX disjoint
  8-seed sets, 48 seeds): fins 384→390 (+6); paired MEAN negative in ALL
  SIX sets (−85.7/−13.4/−0.8/−1.9/−64.7/−48.1, pooled ≈ −36s/boat);
  unpaired med 618/618/617/604/634/590 → 533/593/620/612/527/528; land
  DOWN 5/6 (−4..−17%); boat pooled +6% (sign-mixed). THE TRADE, anatomy-
  named (_rr_markhits.js, new, tracked): mark contacts +35% pooled — a
  PRE-EXISTING m3 drift-stall class (83% of cap-tree mark hits: mark 3,
  leg 2, 62% zero-rivals-in-zone, 90% armed, 0.8kt drift-on) that simply
  receives more surviving traffic; m4 contacts collapse 32→5. Pens +8%.
  The m3 stall is the next redrock attribution target.
GATES: lake 20×2 A paired −4 land −10% all-dirt-down / B neutral land −10%
  (v3 byte-identical to v2 on lake — the arc exemption never fires there);
  bay 20×2 neutral with OCS 0.6/1.1% → 0.0/0.0 both sets; ocean 20 neutral
  (boat rubs down); arctic BYTE-IDENTICAL (verified); river BYTE-IDENTICAL
  (verified); seatrials 100@100 moved-neutral (med 194.225→194.125, OCS
  identical 15.44%) — re-baselined; the HEAD-tree control run reproduced
  the memory anchor exactly (194.23/15.44), exposing the repo
  eval_results.json as stale-by-lineage; replaced with the landed run.
ROAD: v1 unscoped (+12 fins but river fins −10) → v2 current+funnel scopes
  (river byte-identical, marks still +52%) → v3 armed-arc exemption (marks
  +35%, principled) — chosen for protecting the arc geometry and land down
  in every set. The funnel/arc exclusions did NOT move the mark trade —
  that is how the m3 class was proven pre-existing and traffic-fed.
GOLDENS: 14/20 behaviour changes → FULL --update re-record on the landed
  code, verified PASS. npm test unchanged from the clean-HEAD snapshot
  (the river sailable failure is pre-existing and stops the chain).
NEW ANCHORS (all fingerprint-stamped, on the landed tree): redrock
  ocean_bench_p4cap3rr{A..F} (48-seed fins 390); lake ocean_bench_
  p4cap3lakeA/B (med 271/274, land 5.08/5.58); bay ocean_bench_
  p4cap3bayA/B (med 236/236, OCS 0/0); ocean ocean_bench_p4cap3oc
  (med 193); seatrials eval_results 199.58/194.13 OCS 15.44%; arctic
  p3v2arcA/B + river r0A/B byte-carried.

## The venue table, FINAL (post-landing; human = traj recordings)
venue     | human med/best      | pre-session bot                          | post-session bot (final HEAD, cap landed)
bay       | 226.2 / 217.8, 0 impacts | 236 / 237, boat 1.95/1.83, OCS 0.6/1.1% | 236 / 236 (p4cap3bayA/B), boat 1.99/2.03, mark 0.36/0.54, pen 0.46/0.48, OCS 0.0/0.0
ocean     | 182.5               | 192 (p2b3oc), boat 1.88, mark 0.26       | 193 (p4cap3oc), boat 1.60, mark 0.38, pen 0.46 — neutral
lake      | 223 / 209.6         | 275 / 278, land 5.63/6.17, boat 2.04/2.56 | 271 / 274 (p4cap3lakeA/B), land 5.08/5.58 (−10% both), boat 1.92/3.51, mark 0.40/0.66 ← cap helps the corridors
redrock   | ~227 / 206.6 (s2: 214.7) | 48-seed fins 384/432; A/B med 618/618 (pair-tool) | 48-seed FINS 390/432; med 533/593/620/612/527/528 per set; land −4..−17% 5/6 sets; mark 2.6→3.5 (m3 stall class, named); pens +8% ← THE CAP LANDING
arctic    | 212.1 / 190.4 (s2: 215.0/194.7) | 413 / 450 (p3v2arcA/B), in-420 75/53 | UNCHANGED — BYTE-IDENTICAL (openWaterAv gate, verified)
seatrials | ~190 / 180.9        | 199.65 / 194.23, OCS 15.44%              | 199.58 / 194.13, OCS 15.44% — moved-neutral, re-baselined
river     | 161.3 (1 lap)       | r0A/B med 272/273, in-360 80/77%         | UNCHANGED — BYTE-IDENTICAL (current-class scope, verified)

## POST-LANDING RESIDUAL (measured on the landed tree — the next push's aim)
_rr_leganat re-run (times ÷6 for the probe's credit factor): legs 1-5 med
  81/121/145/52/51 ≈ 451s total vs pre-landing 77/163/121/132/45 ≈ 538s.
  LEG 2 −42s and LEG 4 −79s (odo 7266→4971, route-speed 55→95 u/s) — the
  corridors the cap freed. LEG 3 WORSENED 121→145s and its slow time now
  piles at (0..−400, 1200) — the m5 north-thread approach is the new
  binding constraint (boats arrive faster and more bunched). Human L3 51.3.
_rr_m3stall.js (new, tracked; 73 funnel passes): m3 stalls are 51% of ALL
  m3 passes — at the MARK (dMark med 34u), RUNNING (TWA med 32°, wind
  13.2kt), solo 70%, deflection 0°, armed 89%, sweep med −54° — the boat
  wraps the WRONG WAY around the starboard rounding and dies on the mark
  face. Entry side: stalls come from the −135° (SW) entry 32/37, but the
  same entry yields 18 clean passes — the discriminator is the wrap
  direction after entry, i.e. the rounding-approach setup, not the entry
  line itself. This is winding/sweep machinery ([Rounding cheat] rules) —
  a DESIGN build for the next push, with this dossier as its measurement.
NEXT-PUSH ORDER suggested by the post-landing data: (1) m3 wrong-way-wrap
  rounding approach (51% stall rate, fully attributed); (2) m5 north-
  thread approach congestion (the new leg-3 constraint); (3) the give-way
  underlay (dossier complete: onset dCPA 191-212u, τ≈6s, role split,
  wide-dodge rungs — its rival-only share of wide dodges is 15-18% after
  the cap landed the land share). River's tight-water class stays shelf-
  ready behind the response work.

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 2026-08-07 NIGHT PUSH (started 17:51 PDT, HEAD at open 9c0438d)
# ═══════════════════════════════════════════════════════════════════════════
Owner-directed continuation on the post-cap constraints in order: redrock m3
wrap (P0), redrock m5/leg-3 approach (P1), the give-way underlay (P2). ZERO
LANDINGS — three candidate families built and rejected with mechanisms, one
probe-convention bug caught and fixed in the tracked probes, the m3 class
attributed three layers deep, and the decomposition that REDIRECTS the
underlay priority. The measure-first ledger extends: 0-for-3 on builds,
4-for-4 on attributions that changed the going story.

## PHASE 0 — trivial: 9c0438d is probe+docs only; behavior tree byte-identical
to ff12c26 (treeP4FINAL diffed clean against HEAD). All anchors STAND.

## P0 — m3 WRONG-WAY WRAP: attributed three layers deep, and it is not a wrap
`_rr_m3replay.js` / `_rr_m3replay2.js` (new, tracked; per-tick replay with
strategy/avoidance instrumented: str = getStrategicHeading, pre/pst =
applyAvoidance in/out), 8 stall episodes + 3 cleans, seeds 9400-9401:
1. THE APPROACH: strategy asks the correct line every time (str −16..−28
   toward the cut-in); the avoidance argmin forces the boat +15..40° EAST
   onto the wrong-way line — solo (nr=0), land-term-driven. The clean/stall
   discriminator is alignment+speed at arm, not entry side.
2. THE TURN: at arm (d ~180-190) the carrot demands 60-140° of turn; turn
   distance at 8 kt ≈ v·χ/ω ≈ 420u (ω = 0.61 rad/s measured, full authority
   ≥3.5 kt) — more room than exists. The miss lands ON the mark face.
3. THE PIN, re-read: ⚠️ PROBE CONVENTION BUG (standing rule 18, fixed in
   _rr_m3stall/_rr_mstall same-day): engine TWA 0 = HEAD-TO-WIND (the no-go
   tax fires at twaCand < 0.55), so the probes' bins were inverted — the
   stalls reported "RUNNING TWA 32" are IN-IRONS FACE PINS. The cut-in
   demands a heading across the wind; the boat attempts a TACK inside the
   funnel with the mark dead ahead mid-arc; the bow sweeps across the mark,
   contacts, and the boat luffs pinned in irons (same family as lake's
   43.7% deflected-into-irons class). Approach itself is a close/beam reach.
4. Downstream: wrong-way crawl around the face (cheap side), east-wall rams
   at 230-275u — `_rr_ringclear.js` (new, tracked): m3's ring is 100% water
   to R=200 and the orbit's outward allowance zone*1.6=264 IS the wall; m5
   walls 200-215u, m6 215-230u; orbitTightR null at all three (zone-scaled
   stock radii don't fit the water). m3 is a HAIRPIN (needExit ≈ 270-340°),
   so every wrong-way excursion costs 400°+ to undo. Blown-out re-approaches
   (armed at 460u, argmin flapping ±90° on land tax) complete the bill.
⛔ CANDIDATE REJECTED — TURN-FEASIBILITY GOVERNOR (treeP4TG, 3 variants, all
mechanism-named): "arrive no faster than you can turn" via speedRequest ease
(metering-family guards). v1 χ-vs-tangent @zone*1.5: m3 stalls 50→42%,
anatomy unchanged. v2 @zone*2.1+margin: 38% and leg-2 med −20s — but the
trigger geometry fires on EVERY fast radial approach (χ against the tangent
at the current bearing ≈ 90° for any radial line): leg-3 med +25s, and the
instrumented rerun showed the governor FIRED ON 23/23 residual stalls and
they stalled anyway (entry 6.8 kt vs clean 5.9). v3 miss-distance-under-
turn-authority (ease only when full rudder can no longer raise the lateral
miss above the 75u berth): collateral eliminated (m5 fired 0/9) but fires
~0.4s pre-stall — too late to shed way. THE SPEED LEVER IS PROVEN
INSUFFICIENT: surgical is too late, early is a blanket tax.
▶ THE NAMED BUILD (design push): the turn-direction choice at the cut-in.
The rudder always takes the SHORT way to the target — through head-to-wind
and across the mark's bearing. The long way round (gybe-around) keeps way on
and never sweeps the bow across the mark. Also on the shelf from this
attribution: the mark exerts ~nothing between hard 50u and soft 115u
(18000/(dSq+100) ≈ 2-7 points) while 0.8kt drift-on turns 51u grazes into
pins — but bay's landed orbit lives at 61-70u, so any berth change is
bay-gated. Rudder-contract machinery: goldens WILL move; full stack.

## P1 — m5/LEG-3: measured (not a wrap), one candidate killed
`_rr_mstall.js` (new, tracked; mark-parameterized) at marks[4]: 13-16%
stalls (vs m3's 51%) at dMark med 242 (funnel EDGE), 86% unarmed, 100%
zero-rival, defl 40-69° — the solo wide-deflection class, not rounding
machinery. Occupancy + service re-runs on the landed tree: thread serves
fast (7.7-11.3s med) and SOLO transits park worse than occ-1/2 (6.8 vs
4.0/3.8 med) — deflection, not queueing; parked clusters pool at
(−200..0, 1000..1400).
⛔ CANDIDATE REJECTED — CAP-IN-FUNNEL (treeP4F4, drop the 250u funnel
exemption): m3/m5 stall rates unchanged AND leg-3 med 145→217s (+72s),
parked 38.5→60s, m5 cluster 879→1177 boat-s. The funnel exemption is
load-bearing on approach quality — pinch lines need the full probe (the
scope comment's claim, now measured directly).

## P2 — THE DECOMPOSITION THAT REDIRECTS THE UNDERLAY (_rr_dodge2.js, new)
_rr_dodge re-run on the landed tree: 4009 wide-dodge edges (redrock 4@9400):
land-only 40% / soft-costs-only 34% / rival-only 13% / land+rival 12%.
_rr_dodge2 decomposes the soft-costs-only class by term with the argmin's
own formulas: redrock farland 62%, none 31% (commitment-latched), irons 7%,
boatprox 0 OF 1382, marksoft ~0. River: farland 47%, none 42%, irons 11%,
boatprox 0. ⚡ THE RIVAL-RESPONSE SHARE OF REDROCK'S CONSTRAINED CLASS IS
~NIL AT THE TERM LEVEL — the deflected-distance residual is the far-blockage
LAND term (30000·(1−frac)) in water wide enough that the clearance cap never
bites (clB ≥ 3): the stock 4s straight ray outlives the plan's bend and
reports the bend wall as a blockage. The give-way underlay (dCPA 191-212u /
τ≈6s / role split) remains the RIVER mid-slot + lake build; it is NOT the
redrock leg-3 lever the plan assumed.
⛔ CANDIDATE REJECTED (blocked-behind, the session's key compositional
finding) — "THE FAR FIELD BELONGS TO THE ROUTER" (treeP4FF): waive the
far-blockage tax for the candidate aligned within 0.3 rad of the local
gridPath direction (140u hard zone untouched; guards: fresh plan <200u
cross-track, never a no-go heading — a beat's plan direction is dead upwind
and the irons shaping is only 500 points — never under the armed arc).
Anatomy: wide-dodge edges −11% (soft-only 1382→1198), legs 3/4/5 odo down
(leg 4 −14%), NO collateral signature — and leg 2 odo +24% with m3 stalls
50→54%: the waiver holds boats on the plan line straight into the unfixed
m3 funnel and pays the corridor gains back into wrong-way re-rounds. FF
COMPOSES WITH THE m3 TURN FIX — bench them together after that lands, the
same dependency shape as river's tight-water class behind the response.

## The venue table (final HEAD = behavior ff12c26; ZERO landings — every row
## byte-carried from the p4cap3 anchors, Phase 0 verified)
venue     | human med/best      | pre-session bot                          | post-session bot (final HEAD)
bay       | 226.2 / 217.8, 0 impacts | 236 / 236 (p4cap3bayA/B), boat 1.99/2.03, mark 0.36/0.54, pen 0.46/0.48, OCS 0.0/0.0 | UNCHANGED — byte-carried
ocean     | 182.5               | 193 (p4cap3oc), boat 1.60, mark 0.38, pen 0.46 | UNCHANGED — byte-carried
lake      | 223 / 209.6         | 271 / 274 (p4cap3lakeA/B), land 5.08/5.58 | UNCHANGED — byte-carried
redrock   | ~227 / 206.6 (s2: 214.7) | p4cap3rr{A..F}: 48-seed fins 390, med 533/593/620/612/527/528, land −4..−17% 5/6, mark 3.5 | UNCHANGED — byte-carried
arctic    | 212.1 / 190.4 (s2: 215.0/194.7) | 413 / 450 (p3v2arcA/B), in-420 75/53, fins 143/139 | UNCHANGED — byte-carried
seatrials | ~190 / 180.9        | 199.58 / 194.13, OCS 15.44%              | UNCHANGED — byte-carried
river     | 161.3 (1 lap)       | r0A/B med 272/273, in-360 80/77%         | UNCHANGED — byte-carried

## NEXT-PUSH POINTERS (ordered by what tonight measured)
- BUILD 1 (the unlock): m3 TURN-DIRECTION at the cut-in — never sweep the
  bow across a mark you are about to hit; take the turn the other way round
  (gybe-around keeps way on). Rudder-contract design build (turn-direction
  hint from controller to updateAI's short-way smooth-turn; penaltySpin is
  the forced-rotation precedent). Judge: m3 stall rate + redrock pooled ≥4
  sets + lake 20×2 + bay (5 roundings!) + goldens re-record.
- BUILD 2 (queued behind 1): treeP4FF far-field waiver — corridor gains
  measured real (legs 3/4/5 odo down), currently paid back into the m3
  funnel. Re-bench the day Build 1 lands.
- The give-way underlay: RIVER (raft-up displacement chain) + lake — its
  redrock share is ~nil at the term level (tonight's decomposition). River's
  tight-water class stays shelf-ready behind it.
- Orbit-vs-water (from _rr_ringclear): zone*1.6 outward allowance ≈ the m3
  east wall; an orbitMaxR (dual of orbitTightR) capping carrot/ride radii is
  measured-ready if wall-rams persist after Build 1.
- ⚠️ TWA CONVENTION (now in standing rules): engine TWA 0 = head-to-wind;
  the no-go tax is twaCand < 0.55. Two probes shipped inverted bins today.

## ✅ LANDED (same push, after a clock-check caught a 3h misestimate — rule 10)
## TURN-DIRECTION AT THE ROUNDING (the m3 build, executed tonight after all)
MECHANISM (two sites, one physical line): NEVER SWEEP THE BOW ACROSS A MARK
YOU ARE ABOUT TO HIT — take the turn the other way round. The rudder always
took the SHORT way to the target; at the m3 cut-in that way crosses
head-to-wind AND the mark's bearing, and the boat died in irons on the face
(51% of passes). Now: when the short-way arc crosses the mark's bearing with
less room than the rotation needs (v·|off|/0.61 > d−75), the controller sets
turnBias and the rudder rotates the other way — and EASES through the
gybe-around (the turn and the throttle are one decision; the 8kt loop is
400u across and fits nothing; at manoeuvring speed it is ~90u).
SCOPES (each a landed line): floe venues OFF (pack-speed law owns that
water; arctic byte-identical, verified); _avCurMax ≥ 2kt OFF (a spin in a
stream is the one-way door squared — v2 cost river boat contacts ×2.6;
river byte-identical under the scope, verified); per-mark LOOP-ROOM ring
gate _gyOK (ring at the zone radius fully water — the orbitTightR family
line; lake's cove is 81% water at 165u and v2 tripled its land contacts;
gated, lake flipped to a both-sets win); no round leg → inert (seatrials
byte-identical, verified).
ROAD: v1 bias-only (m3 51→26%, the face-pin class DIED — residual stalls
are a different class at the funnel edge) → v2 +ease (m3 13%, lake/river
casualties) → cl≥4 scope tried and REMOVED (m3 pocket and m5 zone are both
cl 3 — the field cannot separate them) → v4 the two scopes above. A v2-vs-v4
redrock byte-perturbation reshuffle was caught and pinned (determinism
verified same-tree; rule 3), so v4 was judged on its OWN six sets.
REDROCK (pooled finishers, six disjoint 8-seed sets, 48 seeds): fins
390→392; paired mean −10.9 s/boat pooled (negative 4/6 sets: +50/−22/−50/
−61/+3/+20); MARK CONTACTS −57% IN ALL SIX SETS (19.8→8.4 pooled); pens
down 5/6; land flat; boat −3%. Set A pays (+50 mean, land +30) — the freed
m3 traffic feeding the m5 approach class, the cap landing's own trade shape.
GATES: BAY A WIN both sets (med 236→231/236→234, mean −6.2/−2.9, marks
0.36→0.05/0.54→0.28, pens down both — the bay-vs-human gap narrows to
~5-8s); LAKE positive both sets (med 271→269/274→273, land 5.08→4.49/
5.58→5.52, every dirt class down); OCEAN neutral-positive (mean −3.8, marks
−47%, boat rubs 1.60→2.10 — the recorded trade); river/arctic/seatrials
BYTE-IDENTICAL (all three verified by 4-seed diff, not assumed).
GOLDENS: 6 behaviour changes (divergences at m3, pen 1→0 visible in the
diff) → full --update re-record, verify PASS 20/20. npm test: the one
failure is the documented pre-existing river sailable line (exit2→pre3).
NEW ANCHORS (fingerprint-stamped, on the landed tree): redrock
ocean_bench_gy4rr{9400,9500,9600,9700,9800,9900} (48-seed fins 392; per-set
med 599/590/548/514/529/578); lake ocean_bench_gy4lakeA/B (269/273); bay
ocean_bench_gy4bayA/B (231/234); ocean ocean_bench_gy4oc (192); river
r0A/B, arctic p3v2arcA/B, seatrials eval_results all byte-carried.

## The venue table, FINAL (post-landing; human = traj recordings)
venue     | human med/best      | pre-session bot                          | post-session bot (final HEAD, turn-direction landed)
bay       | 226.2 / 217.8, 0 impacts | 236 / 236 (p4cap3bayA/B), boat 1.99/2.03, mark 0.36/0.54 | 231 / 234 (gy4bayA/B), boat 1.39/2.11, mark 0.05/0.28, pen 0.28/0.40, OCS 0/0 ← gap ~5-8s
ocean     | 182.5               | 193 (p4cap3oc), boat 1.60, mark 0.38     | 192 (gy4oc), boat 2.10, mark 0.20, pen 0.38 — neutral-positive
lake      | 223 / 209.6         | 271 / 274 (p4cap3lakeA/B), land 5.08/5.58 | 269 / 273 (gy4lakeA/B), land 4.49/5.52, boat 1.76/3.21, mark 0.25/0.36 — all dirt down
redrock   | ~227 / 206.6 (s2: 214.7) | 48-seed fins 390; med 533/593/620/612/527/528 | 48-seed FINS 392; med 599/590/548/514/529/578; paired pooled −10.9s/boat; MARKS −57% all six (19.8→8.4); pens −11% ← THE TURN LANDING
arctic    | 212.1 / 190.4 (s2: 215.0/194.7) | 413 / 450 (p3v2arcA/B), in-420 75/53 | UNCHANGED — BYTE-IDENTICAL (floe scope, verified)
seatrials | ~190 / 180.9        | 199.58 / 194.13, OCS 15.44%              | UNCHANGED — BYTE-IDENTICAL (no round legs, verified)
river     | 161.3 (1 lap)       | r0A/B med 272/273, in-360 80/77%         | UNCHANGED — BYTE-IDENTICAL (current scope, verified)

## NEXT-PUSH POINTERS (superseding the pre-landing list above)
- treeP4FF ("the far field belongs to the router") is UNBLOCKED: the m3
  funnel it fed is fixed — re-bench it on the new anchors FIRST.
- Redrock set-A's +50: the m5-approach class now carries more traffic — the
  give-way underlay (RIVER+LAKE per the decomposition) and/or an m5-specific
  look are the next redrock reads. orbitMaxR stays measured-ready.
- The residual m3 stalls (13%) are a NEW class (funnel-edge, reaching, sweep
  +2) — attribute before touching.
- River tight-water + underlay: unchanged plan, behind the response class.
- Ocean boat rubs 1.60→2.10 under the landing — watch it on the next pass.

## ✅ SECOND LANDING, SAME PUSH — THE FAR FIELD BELONGS TO THE ROUTER (FF2)
The waiver rejected three hours earlier as blocked-behind-m3, re-benched on
the turn-direction base per its own dependency note — and the composition
delivered. MECHANISM (one physical line): the route only ever crosses water,
so land beyond the 140u turning zone ALONG THE PLAN is the plan's bend, not
a blockage — waive the far-blockage tax (30000·(1−frac)) for the candidate
aligned within 0.3 rad of the local gridPath direction (260u lookalong).
The 140u hard zone stays for every candidate. Guards: fresh plan the boat is
on (<200u cross-track), never a no-go heading (|h−wind| < 0.62 — the irons
shaping is only 500 points and a beat's plan direction is dead upwind),
never under the armed arc (arcK). Named by _rr_dodge2's decomposition
(soft-only wide dodges: farland 62%, boatprox 0 of 1382).
ANATOMY on the landed base (the dependency test): m3 stalls 13% — NO refeed
(the pre-landing rejection was leg-2 odo +24% + m3 50→54%; with the face-pin
class dead the corridor gains stand alone): vs the GY base at 4@9400 legs
2/3/4 time −14/−39/−38%, odo −6/−18/−13%.
REDROCK (pooled finishers, six disjoint 8-seed sets vs the gy4 anchors):
fins 392→396; paired mean NEGATIVE IN ALL SIX SETS (−83/−24/−15/−13/−14/−60,
pooled ≈ −34 s/boat); med negative 5/6; land −9% pooled (down 4/6); marks
−18% further (8.44→6.94); pens down 5/6; boat −2%.
GATES: BAY BIT-IDENTICAL both sets (no far land on open water — the waiver
provably never fires; paired mean 0.00, stats byte-equal); OCEAN positive
(mean −0.7, boat rubs 2.10→1.75 — recovers most of the turn landing's ocean
trade, marks down); RIVER both sets faster (paired −10/−7 med, −17/−7 mean;
fins 233→238 pooled; land −7/−14%; ⚠️ boat rubs DISAGREE in sign across
sets: A 30→62, B 46→31 — unresolved at this resolution, recorded); LAKE
within anchor noise (A mean +2.7 with land 4.49→5.33, B −1.0 flat — pooled
land 10.9 vs the session-open anchor 10.7); arctic + seatrials
BYTE-IDENTICAL (verified by diff).
GOLDENS: 9 behaviour changes → full --update re-record + verify.
NEW ANCHORS: redrock ocean_bench_ff2rr{9400..9900} (48-seed fins 396;
per-set med 475/540/520/507/538/523); lake ff2lakeA/B 274/273; bay
ff2bayA/B 231/234 (bit-identical to gy4bayA/B); ocean ff2oc 192; river
ff2rivA/B med 264/271 (fins 119/119 of 144 — in-360 improved); arctic
p3v2arcA/B + seatrials byte-carried.
The redrock arc: session open 384 fins/48-seed (pre-cap) → cap 390 →
turn-direction 392 → far-field 396, with per-set meds now 475-540 vs the
session-open 527-620 — the deflected-distance class named two pushes ago is
being drained by three composed landings on three physical lines.

## POST-LANDING RESIDUAL (final HEAD 7b72372) — the next push's aims, measured
- REDROCK legs (occupancy, 4@9400): med {L1 74.5, L2 96.5, L3 147, L4 49.5,
  L5 48} vs human 39.9/64.7/51.3/29.6/26.1 — leg 3 remains the constraint
  (2.9x) and its parked mass still pools at the m5 approach box
  (−200..0, 1000..1400: 1343 boat-s pooled, top cluster unchanged).
  m5 stalls 15%: solo (78%), unarmed (89%), defl 69°, at 223u — the wide-
  deflection class, now with the land share drained by two landings; what
  remains is displaced-off-plan boats (the FF waiver requires <200u
  cross-track — displaced boats lose it exactly when displaced) and the
  broad-reach bends. The underlay (river+lake per _rr_dodge2) plus a
  displacement-tolerant plan reference are the candidate shapes.
- THE m3 RESIDUAL CLASS (13%), replay-named (Lunker): the boat rounds
  CORRECTLY (sweep 88→279, no face pin, no wrong way) but at 7.3 kt the
  pursuit turn radius is v/ω ≈ 184u, so the hairpin's middle bulges to 242u
  — into the east wall band (230-275, _rr_ringclear). The orbit phase is
  pinched between the turning circle at speed and the canyon wall: it needs
  either mid-sweep speed discipline (⛔ the ENTRY-side governor family is
  closed at 3 kills; an ORBIT-PHASE ease at confined marks is a different,
  named design — armed, sweep>0, orbitTightR-null marks) or water that
  isn't there (orbitMaxR stays measured-ready but the carrot was already
  inside — the excursion is pursuit dynamics, not the target). DESIGN BUILD.
- RIVER: 264/271 med vs human 161 (1.64x, from 1.69x); fins 119/119 of 144;
  the rub sign-split (A 30→62 / B 46→31) is the open dirt question. The
  tight-water class (treeP4TIGHT, old base) re-ports after the underlay.
- Session probe additions all tracked: _rr_m3replay(2), _rr_mstall (bins
  fixed), _rr_ringclear, _rr_dodge2, _run_stack.sh.


# SESSION 2026-08-08 EARLY-MORNING PUSH (started 02:52 PDT, HEAD at open 7d47392)
# ═══════════════════════════════════════════════════════════════════════════
Owner-directed continuation on the post-composition constraints: redrock leg 3
(P0), the m3 orbit-phase design build (P1), river + the give-way underlay (P2).
THE VENUE EVENT: the owner shipped a NEW red rock (full course redesign — 7
marks, 5 roundings, 9 wind regions) plus "Gust fixes" (rendering-only script.js
changes, ocean gust-1 region moved ~12000u INTO play, glowtide colors). Owner
ruling: continue on the AI-saved old red rock or take up the new one — this
push CONTINUES ON THE OLD RED ROCK (the entire P0/P1 attribution, all anchors,
and the human refs live on its geometry; the new course has no human laps).

## PHASE 0 — the venue-pinning build + full anchor verification
- OLD red rock FROZEN as the benchmark venue: `eval/venues/redrock.venue.js`
  (hash d30fe85fd2c1bbc6 == every ff2rr anchor stamp). Shipping redrock (the
  new course) stays content until human laps exist. KEEP-BOTH per the frozen-
  venue policy.
- `mktree.sh` now builds per-file venue symlinks: a venue frozen in
  eval/venues WINS over the shipping file — trees bench the venue the anchors
  were made on even after a shipping redesign. Fingerprint stamping in
  ocean_bench/fleet_leg2/bay_bench now reads the TREE's own venue file (was:
  main-repo shipping — a latent wrong-stamp bug once the two diverge).
- OCEAN PROMOTED: the owner's gust fix moved gust-1 into play — behavior
  change. Re-frozen, ff2oc anchor RETIRED, re-baselined on treeHEAD8:
  ocean_bench_hd8oc 20@9300 med 193 (was 192 old-venue), boat 2.61 (1.75),
  mark 0.43 (0.20), pen 0.46, OCS 0 — the in-play gust region's dirt. Lake
  frozen too (was never frozen). NEVER compare ocean across this cut either.
- Anchor verification on HEAD (byte-identity, per standing rule 6): bay 4-seed
  ✓, lake 4-seed ✓, river 4-seed ✓, redrock (old venue pinned) 4-seed ✓,
  arctic 4-seed ✓, seatrials 100@100 whole-file byte-identical ✓. ALL ANCHORS
  STAND. The owner's script.js changes were rendering-only (gust tint
  derivation, minimap gradient cells) — verified inert on behavior.

## P0 — THE m5 APPROACH BOX, RE-ATTRIBUTED THREE TIMES IN ONE NIGHT
The plan's two named shapes both DIED at the measurement step (measure-first
paying again):
1. DISPLACEMENT IS DEAD: `_rr_mdisp.js` (new, tracked) — the box's parked
   mass is 97% ON-plan (d0 med 64-71u to the boat's own gridPath), the FF
   waiver was ACTIVE in 70-77% of parked episodes, cross-track guard binds on
   only ~6%. The displacement-tolerant plan reference would have fixed ~6% of
   nothing. (Also: deflection edges near m5 are 72% on-plan.)
2. WIND IS FINE: `_rr_boxwhy.js` (new, tracked) — parked samples sit in 11.5-
   15 kt (0% under 5 kt), blockAhead only 7-9%, spdLim 1.0 (no governor),
   |defl| med 6°. But land sits INSIDE the 140u hard zone on the plan heading
   for 63-72% of parked samples, TWA med 71-76°, in-irons 26%.
3. THE MECHANISM, REPLAYED (`_rr_boxreplay.js`, new, tracked): the box mass is
   HUNDREDS of 3-8s stutters (zero parks ≥10s). Trace anatomy: the corridor
   BENDS at the box; the plan-aligned sailing candidate has wall <140u on its
   straight ray → 500000 veto; staying head-to-wind is offset-0 + a 500-point
   irons tax; the argmin parks the boat IN IRONS pointing at its own target
   (Sable: 3s at TWA 10 with tg=8° dead upwind, then tg snaps to 99° and it
   sails away at 2.4 kt). The hard zone is turning room, and at 0.6 kt 140u is
   ~90 seconds of travel — the veto is priced for 7 kt.
THE BUILD FAMILY (speed-scaled hard zone, hardZ = clamp(1.4s·v, 60, 140)):
- BP1 (all candidates): box −40% (1394→835 boat-s @4 seeds), m3/m5 stalls
  unchanged, redrock pooled −9.5 s/boat (3/6 neg), OCEAN −5.4 mean (a real
  win), bay neutral, river/arctic BYTE-IDENTICAL (scopes verified) — but
  LAKE FAILS BOTH SETS (+7.9/+8.7 mean, land +44%/+35%: slow corridor boats
  freed toward any shore hug it and grind).
- BP2 (plan-aligned candidate only — the FF waiver's own 0.3-rad test +
  guards, extended to the near field): box −45%, lake mild (+2.6/+3.4 mean,
  land +19%/+9%), redrock pooled −6.0 (3/6 neg).
- BP3 (BP2 + wind ≥8 kt to power out): lake SILENT (deltas all-zero), but
  redrock +5.7 pooled — the wind gate gives back the win (light-air bends
  carry redrock weight too, or variant-to-variant reshuffle noise).
- ✅ LANDED — BP2 AT 96-SEED RESOLUTION (the resolution move: the three
  variants' pooled clocks at 48 seeds (−9.5/−6.0/+5.7) sat inside set-level
  noise, so BP2 — the balanced variant — was judged on SIX FRESH disjoint
  8-seed sets (8400-8900, paired vs same-seed HEAD runs) on top of the six
  anchor sets: fresh sets NEGATIVE 6/6 (means −8.2..−63, meds −5..−89),
  pooled over all 12 sets/96 seeds: −14.79 s/boat, negative 9/12. The
  anchor-seed sets were the noisy draw. Pooled redrock med 517→499, fins
  396 (flat), land/boat/mark/pen all flat-to-down.
  GATES: bay DELTAS ALL-ZERO both 20-seed sets (the ~5-8s gap untouched);
  ocean −2.5 mean with boat rubs 2.61→1.81 (−31%) — recovers the gust-fix
  dirt; lake +2.6/+3.4 mean, land +19%/+9% (med 0 both) — THE RECORDED
  TRADE, the one gate that pays; river byte-identical (4-seed verified,
  ≥2kt scope); arctic byte-identical (4-seed verified, floe scope);
  seatrials byte-identical (BP1's 100@100 whole-file diff — BP2's firing
  set is a strict subset of BP1's).

## P1 — THE ORBIT-PHASE EASE: THE STALL KILL IS REAL, THE SCOPE IS NOT
v1 (OP1: armed, sweep>0.05, speed>1.2, orbitTightR-null, the landed
0.55+0.15·deft floor, per-tick): m3 stalls 14%→4% — the residual class DIES,
survivors' anatomy changes (defl 46° vs 0°). Redrock pooled −2.3 (flat), land
down 5/6 sets, marks down; bay BYTE-IDENTICAL both 20-seed sets (orbitTightR
non-null on every bay mark — by construction, verified); river BYTE-IDENTICAL
(current scope); BUT:
- LAKE set A land 5.33→12.13 (the ease holds slow boats on a lee shore
  through whole passes at some corridor mark), and
- OCEAN med 193→211 (+18!) — ocean HAS orbitTightR-null marks and the ease
  taxes every rounding there. KILLED as landed.
- v2 (wall-room speed threshold, no latch): the trigger TOGGLES mid-sweep
  around the threshold speed — set 9400 fins 64→57. KILLED, mechanism named.
- v3 (threshold + per-pass latch): the latch OVERHOLDS — stalls move to sweep
  306° (the hairpin's exit) at dMark 121: the boat carries the 0.55 cap
  through the whole 306° rotation and starves the exit. m3 41%. KILLED.
- v4 (v1 + wall-room ≥175 scope): REDROCK BYTE-IDENTICAL TO v1 (4-seed
  verified — canyon marks all have walls ≥200) but lake byte-equal to v1's
  grind (the offending lake mark has room ≥175 too) and ocean still fires.
  The wall-room axis does not separate the venues. SHELVED: the m3 kill
  (14→4%) waits for a scope that names what separates canyon hairpins from
  lake/ocean confined marks. ⚠️ The ENTRY-side governor family stays closed —
  this is the ORBIT-phase family, distinct and now measured 4 variants deep.
- COMPOSITION NOTE: OP1+BP1 (treeCX) is ANTI-COMPOSITIONAL: m5 stalls 16→26%
  (the new stalls are UNARMED with rivals — 0-rival 79%→48% — the two
  mechanisms flood the m5 funnel with more surviving traffic), redrock pooled
  +1.1 (worse than either component). The m5 funnel's throughput is the
  binding constraint under composition.

## P2 — RIVER + THE UNDERLAY
- THE RUB SIGN-SPLIT IS CLOSED AS SEED-SET VARIANCE: four disjoint 16-seed
  sets on IDENTICAL behavior (ff2rivA/B + fresh hd8rivC/D) give boat-rubs
  61.6 / 31.2 / 10.9 / 24.7 per boat — a 6x spread with meds stable at
  264-271. River dirt at 16-seed resolution is noise-dominated; judge river
  on pooled fins/med only. (The FF2 "A×2/B−33%" was two draws from this
  distribution.)
- UL1 (onset honesty at the MEDIUM rung: MEDIUM requires the threat to
  converge on my PROPER course too — CPA on the strategy's heading, τ=6s,
  bar 110u; HIGH/IMMINENT untouched, spin-hazard model still re-raises,
  prestart + floe venues out of scope): mechanism PARTIALLY verified —
  needless-MEDIUM collapses (river 42.1%→15.8%, redrock 51.3%→33.8%),
  stand-on episodes −31%/−22%, river IMMINENT episodes −68% (173→55, fewer
  emergencies). But river frame-share deflected went UP (23→36%), the HIGH
  rung's needless share persists (50.7%→57.6% river, 66.4% redrock — the
  current-heading HIGH test has the same honesty problem), and the ACTION
  delta is nil: river fins 239 v 238 pooled, clock flat, dirt inside the
  measured noise band. NOT LANDED (actions-not-prices: no measured action
  win). The build + dossier hand to the next push with the HIGH-rung
  question and lake/redrock/arctic gates unrun.
- treeP4TIGHT stays shelved behind a landed response class, per plan.

## Probes added (all tracked): _rr_mdisp.js, _rr_boxwhy.js, _rr_boxreplay.js.
## Session evidence files: p0id*/hd8*/op1*/op2*/op3*/op4*/cx*/bp1*/bp2*/bp3*/
## ul1* bench JSONs + logs in eval/rl.

## The venue table (final HEAD = BP2 landed; benchmark venues incl. OLD red rock)
venue     | human med/best      | pre-session bot (7b72372 anchors)         | post-session bot (final HEAD, hard-zone landing)
bay       | 226.2 / 217.8, 0 impacts | 231 / 234 (ff2bayA/B), boat 1.39/2.11, mark 0.05/0.28, pen 0.28/0.40, OCS 0/0 | 231 / 234 (bp2bayA/B) — DELTAS ALL-ZERO both sets, gap ~5-8s protected
ocean     | 182.5               | 192 (ff2oc, OLD ocean — RETIRED: owner gust fix moved gust-1 into play) → 193 hd8oc new-venue baseline, boat 2.61, mark 0.43 | 192 (bp2oc), boat 1.81 (−31%), mark 0.36, pen 0.35 — recovers the gust-fix dirt
lake      | 223 / 209.6         | 274 / 273 (ff2lakeA/B), land 5.33/5.58    | 275 / 276 (bp2lakeA/B), land 6.37/6.09, boat 1.98/3.09, mark 0.43/0.32 — the landing's one paying gate (mean +2.6/+3.4, med 0/0), recorded
redrock   | ~227 / 206.6 (s2: 214.7) — OLD red rock, the benchmark | 48-seed fins 396, per-set med 475/540/520/507/538/523, pooled med 517, land 143.1, boat 20.89, mark 1.16 | 48-seed FINS 396, med 481/510/497/542/564/469, POOLED MED 499, land 142.4, boat 19.97, mark 1.14; PAIRED −14.8 s/boat over 96 seeds (12 disjoint sets, 9 negative, fresh 6/6); m5 box −45%
arctic    | 212.1 / 190.4 (s2: 215.0/194.7) | 413 / 450 (p3v2arcA/B), in-420 75/53 | UNCHANGED — BYTE-IDENTICAL (floe scope, 4-seed verified)
seatrials | ~190 / 180.9        | 199.58 / 194.13, OCS 15.44%               | UNCHANGED — BYTE-IDENTICAL (whole-file diff via BP1 superset run)
river     | 161.3 (1 lap)       | 264 / 271 (ff2rivA/B), fins 119/119 of 144 | UNCHANGED — BYTE-IDENTICAL (≥2kt scope, 4-seed verified); +2 fresh HEAD evidence sets hd8rivC/D med 266/263.5 (rub noise-band study)
NEW ANCHORS (fingerprint-stamped on the frozen venues): redrock
ocean_bench_bp2rr{9400..9900} (+ paired evidence hd8rr/bp2rr{8400..8900});
lake bp2lakeA/B; bay bp2bayA/B (byte-equal ff2bay*); ocean bp2oc (vs hd8oc
baseline — ff2oc RETIRED at the venue cut); river ff2rivA/B, arctic
p3v2arcA/B, seatrials eval_results byte-carried. GOLDENS: 7 behaviour changes
→ full --update re-record, verify PASS 20/20. npm test: the one documented
pre-existing river sailable failure (exit2→pre3) only.

## NEXT-PUSH POINTERS (ordered by tonight's measurements)
- THE NEW RED ROCK needs human laps before it can become a target (owner:
  recordings, ideally schema-2 for the ledgers). It races as content;
  benchmark stays the frozen OLD red rock until then. When laps exist,
  decide PROMOTE vs KEEP-BOTH per eval/venues/README.md.
- ⚠️ FRESH LAPS wanted broadly: bay/lake/redrock changed again (hard-zone
  landing); ocean's wind field changed (gust fix); river has ONE lap.
- m3 ORBIT-PHASE EASE: the kill is real (14→4%) and shelved 4 variants deep
  — the missing scope must separate canyon hairpins (wind 13-15kt, walls
  200-275) from lake/ocean confined marks where the ease grinds or taxes.
  Wind ≥8kt on redrock's box worked for the hard zone (BP3 lake-silent) but
  gave back redrock clock — the light-air-bend interaction is unmeasured.
- THE m5 FUNNEL'S THROUGHPUT is the composition constraint: OP1+BP1 flooded
  it (m5 stalls 16→26%, unarmed, rival-present). Any future redrock landing
  pair must be benched TOGETHER before landing separately.
- UL1 (onset honesty): mechanism half-proven; the HIGH rung carries the same
  needless share (50-66%) and is untouched — the design question is whether
  HIGH deserves the same proper-course test or a milder alpha. Gates unrun.
  River clock/action delta nil at current resolution; do not land without a
  measured action win somewhere (rule: actions, not prices).
- RIVER DIRT RULE (new): boat-rub counts at 16-seed resolution span 6x on
  identical behavior (10.9-61.6/boat across 4 sets) — judge river on pooled
  fins/med only, never on rubs, until a 32-seed+ protocol exists.
- Lake's +19%/+9% land under the landing is the open watch item; L1/L2
  classes unchanged otherwise.

## POST-LANDING ADDENDUM (final HEAD a393d61) — the close-out reads
- LEG-3 UNDER THE LANDING, fresh-set contrast (occupancy 4@8600, HEAD vs
  landed): leg-3 med 159.5→134.5 (−25s), leg-3 parked 51→30 s/boat-leg,
  leg-2 101→86. (The 4@9400 probe seeds show leg-3 147→157.5 — set 9400 is
  the landing's one positive-mean set; the 96-seed pooled clock is the
  judge, and the fresh sets carry the mechanism's signature.) Leg 3 vs her
  51.3s: ~2.6x, from 2.9x.
- NEW RED ROCK FIRST-LOOK (landed AI, shipping course via treeNEWRR —
  frozen-venue tree with the redrock symlink repointed at shipping):
  nrr9400/nrr9500 8-seed: med 471/505, fins 67/69 of 72, land 108/101,
  boat 8.2/8.0, mark 1.1/1.4, pen 1.6/2.0 — and ⚠️ BOUNDS 30.3/6.0
  contacts/boat: the new course drives the fleet into the arena boundary
  (a class the old course never had). First attribution target when the
  new course gets human laps. No human ref exists yet.
- LAKE L1 on the landed tree (_lake_l1 4@9100): mild + diffuse — max heat
  bin 14 boat-s, parked mass at race-minute 20-40s (post-start sort-out),
  nearest rival 183u, avoidance-active 56%, defl 11°, wind 6.2kt, n=50.
  No candidate named; the class is small on this base.
- THE EASE-SCOPE HUNT CLOSED THE QUESTION (_op_scope_survey.js, new,
  tracked — per-rounding-mark features across venues): ocean's toxic mark
  is leg-1 mark-3 with ZONE 1000 (boats arm a kilometer out; the v1 ease
  crawls the whole approach — the +18s explained) and wall-room 15u (the
  mark sits ON its rock: the eased ~100u circle cannot fit anyway); lake's
  grinder is leg-1 mark-3 at 5.7 kt (wall-room 180 — room enough, no wind
  to power out; the other lake mark is already _gyOK-excluded); redrock's
  winners are wall-room 120-150, wind 12.6-16 kt, stock zones. NEXT-PUSH
  OP5 IS FULLY PARAMETERIZED: v1's per-tick form + wall-room ≥ 100 (the
  eased circle must fit) + wind ≥ 8 kt at the boat (power to sail out) +
  dG < 250 (the pocket is the scale of the turn, not the zone). The m5
  composition warning still binds: bench OP5 and the hard-zone landing
  TOGETHER on redrock.

## LAP INGEST (post-close, same session): six schema-2 recordings (Aug 7 evening)
Copied to eval/rl/traj/ (corpus now 79 files) and run through _gw_ledger2.py
the day they landed, per standing rule.
- ⚡ THE REDROCK LAPS ARE ON THE NEW COURSE (marks match the redesign; 6
  racing legs): 304.4 (a Talon tangle + penalties at ~93s) and 272.5 CLEAN.
  First human data on the new red rock: bot first-look med 471/505 → the
  new course opens at ~1.7x, and the bot's 30 bounds-contacts/boat class is
  HUMAN-ZERO (no bounds events in either lap) — that class is pure AI
  failure, first attribution target whenever the new course is taken up.
- river: 172.1 (2 land touches at the 118s bank) — corpus n=2 (161.3 best).
- arctic: 313.9 (2 fouls — an outlier lap) and 206.2 clean. seatrials:
  193.8 (bot eval med 199.58 — within 6s; the bot's OCS 15.44% remains the
  gap there).
- _gw_ledger2 on all six (132 encounters): the underlay dossier REPRODUCES
  on fresh data — rival deviation onset fires in 91-100% of encounters at
  med ~565u (detection range), rivals deflect 35.5-59.9° med at CPA vs the
  human's 12.6-23.4°, and 82-93% of encounters had unmodified CPA ≥ 80u.
  The response class the UL1/OP5 work targets is confirmed current.

# RESEARCH SESSION 2026-08-08 MORNING (post-push, owner directive: "uncover new
# substantial gains") — three named build families, sized, none built
# ═══════════════════════════════════════════════════════════════════════════
Method: the schema-2 recordings carry all 9 rivals live at 10Hz — the human
and fleet sailed the SAME races, so gaps decompose with zero seed noise
(_gap_ledger.js, new, tracked). Then per-venue deep probes, ending with an
INSTRUMENTED ARGMIN (treePROBE pattern: applyAvoidance logs every candidate's
cost + collision flags at ≥25° choices; _av_fanlog.js reads it) — the ground
truth that superseded three rounds of external cost-model reconstruction
(_rr_smallwhy v1-v3: its "SMALL_WINS 55-66%" was model gaps — the island
proximity band and heading-based breach projections were missing; the
instrumented fan says no candidate ever wins for free).

## FINDING 1 — ARCTIC IS A ROUTING-DISTANCE PROBLEM (the 2x names itself)
- Human (26 recordings, _ice_exposure/_arc_dist): odometer ~25.0-25.4k vs
  rhumb 23.7k — SHE SAILS THE FLOE FIELD AT 1.06x STRAIGHT-LINE. Median
  clearance from floe edges 200u, only 6.2% of race under 50u, min 15-30u.
  L1 (the beat) 14k units = 1.12x rhumb. Fin med 217.6, ~1 contact/run.
- Solo bot (_arc_solo/_arc_dist, no traffic at all): fin med 465 (352-654),
  odometer 38.7-59.8k = 1.6-2.5x rhumb, 444 floe contacts med — and MOVING
  SPEED IS FINE (130.6 u/s vs her 124.2). deflOdo only 15-29%: the excess is
  NOT avoidance weaving. legOdo L1 23.2-43.5k vs her 14k — the excess lives
  in the ROUTE on the beat. sub1/sub4 32/81s vs her 2/10s.
- THE MECHANISM CANDIDATE (measured-ready, not built): pathSailable's
  wide-water preference (PAD 8 cells ≈ 400u desired clearance, EDGE_W 6 —
  a 300u channel prices 4-5x) is scaled for boat-width corridors; in a floe
  FIELD it turns the pack into a wall maze and buys 15-35k units of detour,
  while the human's revealed clearance demand is ~200u (4 cells). Next-push
  first step: clearance-demand histogram along her tracks vs the router's
  chosen lines; then a floe-venue PAD/EDGE_W knee (⚠️ distinct from the
  CLOSED closing-lead pricing and clearance-extension families — those
  priced DYNAMIC lead changes; this is the static clearance demand scale).
  Also: soft-cell "opening lead" ×2.5 bets on drift prediction that
  [[map-staleness]] already declared unpredictable — the solo bot's 444
  grinding contacts are those bets failing. SIZE: solo gap is 250s/boat;
  the distance share ≈ 150-185s. The biggest single number in the campaign.

## FINDING 2 — THE BIG-DODGE ANATOMY, FROM THE ARGMIN'S OWN LEDGER
(_av_fanlog, 8000 choice snapshots per venue: why did the best ≤15°
candidate lose to the chosen ≥25° dodge?)
- redrock: proxCost 47% (med 3333 — the ISLAND/land proximity band + far
  field, 56% with NO rival within 300u), boatCollision flag 27%, static 24%.
- river:   STATIC 54% (cost gap med 19.5k — the small straight candidate
  hits the BEND WALL the plan curves around; only 28% had a rival near),
  boatCollision 24%, proxCost 17%.
- lake:    boatCollision 47% (97% rival-near, roles dominated by
  GIVE_WAY/MEDIUM 2423/3754), proxCost 28%, static 21%.
TWO BUILD FAMILIES FALL OUT:
- 2a. CURVED SMALL CANDIDATES (the dossier's "finer/curved low rungs",
  now proven needed by the argmin's own flags): in constrained water the
  ≤0.3-rad candidates are STRAIGHT 4s rays and read the corridor's bend as
  static collision / land proximity — while the wide dodge sees open water.
  Roll the small candidates along the PLAN's curvature (the arcK
  constant-curvature machinery generalized from armed-rounding to
  plan-following; same "router owns the bend" line as FF2 + the hard-zone
  landing). SIZE: 54% of river big dodges + the redrock land-flavored 47%
  + the wide rungs carry 17-23% of deflected time; redrock deflected-moving
  alone was 194 s/boat pre-cap.
- 2b. BREACH HONESTY AT MEDIUM (the give-way underlay, now aimed at the
  right term): the 10000-point boatCollision BINARY on small candidates
  fires from a 4s BOTH-BOATS-FROZEN projection; at GIVE_WAY/MEDIUM range
  (the dominant class everywhere) the other boat will steer, and the human
  accepts exactly these gaps (fresh 132-encounter ledger: her 12.6-23.4°
  at CPA, 82-93% of encounters needed nothing). The VO-entry landing
  taught this lesson to the GRADIENT in wide venues; the BINARY in
  constrained venues never learned it. Shape: tCPA-scaled or VO-entered-
  gated breach cost at MEDIUM only (HIGH/IMMINENT keep the binary).
  SIZE: 24-47% of big dodges by venue; UL1's gates + the lake +25%
  caution govern.

## FINDING 3 — THE RIVER START (from the same-race ledger, then live)
Her river race: fleet crossed the start med ~32s after the gun (she: 1s;
5 of 9 rivals 300-550u behind the line at the gun at ~2kt). Live on the
landed tree (_riv_start.js): med 10s, p90 22.6, tail to 36s (seatrials
control: med 3s — its lateness is OCS instead, 4 of 18). MECHANISM: the
staged start's crossing-run estimate (getApproachTime on boat speed+stats)
has NO current term — in a 3-5kt set the run takes 2-3x the estimate.
⚠️ Distinct from the CLOSED start-calibration family (that tuned constants
on correct physics; here ground-speed physics is absent). Scope: fires only
where _avCurMax ≥ 2 (river; bay/lake/ocean/arctic/seatrials byte-identical
by construction). SIZE: ~7-10s med/boat on river + the tail.

## Corroborations + smaller facts
- The gap ledger's same-race rows: fleet <4kt time 45s vs her 10 (arctic),
  105 vs 15 (new redrock), 45 vs 8 (river); moving-speed deficit only
  0-6% on arctic/redrock/seatrials but 22% on river (current handling);
  seatrials near-parity everywhere — the control venue behaves.
- Her arctic: minFloeDist med 16u across 26 runs; the bot's berth demand
  vs her 15-30u shaves is part of Finding 1's clearance-scale story.
- New-course redrock (her 2 laps): fleet loses +37s by the FIRST mark —
  early-leg class, noted for whenever the new course is taken up.
- Probes added (tracked): _gap_ledger.js, _arc_solo.js, _arc_dist.js,
  _riv_start.js, _av_fanlog.js (+ treePROBE instrumentation pattern),
  _rr_smallwhy.js (superseded by fanlog; kept as the lesson).

## NEXT-PUSH ORDER (by size × mechanism confidence)
1. Arctic clearance-demand scale (Finding 1): ~150-185s/boat solo class.
   First step: her-track clearance histogram vs router lines; then the
   floe-venue PAD knee, judged on arctic 16x2 + all-venue gates.
2. Curved small candidates (2a): composes with FF2/BP2; judge on redrock
   pooled (96-seed protocol) + river + lake + bay byte-gates.
3. Breach honesty at MEDIUM (2b): the underlay's correct target; UL1's
   half-proof + these fan numbers parameterize it.
4. River current-aware start (Finding 3): ~10s, small and clean.

## OWNER CORRECTIONS + THE FIFTH CANDIDATE (same research session)
- ⚠️ CORRECTION (owner): the human's arctic laps were NOT solo — verified:
  all 9 rivals in her recordings sailed 18-22k units and progressed legs (a
  full live fleet; her giveWay share 6-45% per lap). Her 217.6 med and the
  1.06x-rhumb line were sailed WHILE DODGING NINE BOATS. The solo-bot
  comparison (465s, 1.6-2.5x rhumb, zero traffic) is therefore CONSERVATIVE
  — Finding 1 is stronger than written, not weaker.
- FINDING 4 — THE ROUTER IS CURRENT-BLIND (owner directive: "make sure the
  AI plans with current"). Verified layer by layer: physics applies drift ✓;
  getStrategicHeading crab-compensates the aim locally ✓; tack choice has a
  mild midstream-push bonus (helping×0.5) ✓; pathSailable prices edges by
  distance/wind-polar/clearance with NO current term ✗ — a 5kt-favorable
  chute and 5kt-adverse water of equal width price identically. This is the
  ledger's river signature exactly: river is the ONLY venue with a large
  moving-speed deficit vs the human (22%; everything else 0-6%) — the fleet
  sails the wrong water at full water-speed while she plans her lines with
  the set (her chute: 22.5s at 6kt over ground). SHAPE (measured-ready):
  extend the _wbin per-cell wind pricing with a per-cell current projection
  — step time = dist / (polarSpeed + current·cos(Δstep)) — so the router
  buys favorable set and refuses adverse. ⚠️ Not blocked by closed
  families: the river ground-frame kills were AVOIDANCE-layer probes; SIPP
  died on drift PREDICTION — authored current regions are static. SIZE:
  river's moving-speed share ≈ 46s/boat over her distance + line choice;
  also swamp/lagoon (current venues, unbenched) and the river start's
  cousin fix. Judge on river pooled fins/med (rub noise rule) + all-venue
  byte-gates (current<2 venues untouched by construction).
- Owner endorsement recorded: the object-avoidance direction (Findings 2a
  curved candidates + 2b breach honesty) is confirmed as wanted.
- NEXT-PUSH ORDER updated: 1. arctic clearance scale; 2. ROUTER CURRENT
  PRICING (new #2 — owner-directed, mechanism verified, sized); 3. curved
  small candidates; 4. breach honesty at MEDIUM; 5. river current-aware
  start (folds into #2's bench wave).

# NEXT-PUSH DIRECTIVE (drafted at close of Aug 8; HEAD at draft 6317d6e)
# ═══════════════════════════════════════════════════════════════════════════
Goal unchanged: human or superhuman on bay, ocean, redrock, lake, arctic,
seatrials. This push works the five researched candidates in size order:
arctic clearance scale (~150-185s/boat), router current pricing (~46s+
river, owner-directed), then the response class (curved candidates + MEDIUM
honesty), with OP5 and the current-aware start as the tail.

⚠️ PHASE 0 GATE: HEAD at open should be 6317d6e or later. If owner commits
moved BEHAVIOR past a393d61: freeze_venues --check first (frozen venues
protect benches from venue edits now — only js/physics changes threaten
anchors), then one 4-seed byte-identity per venue vs the bp2-family anchors;
byte-identical ⇒ stands, else re-baseline (96-seed protocol if near
threshold). Ingest any new laps day-one (_gw_ledger2 + traj_report + refs).
Anchors on a393d61: redrock bp2rr{9400..9900} 48-seed fins 396 pooled med
499 (+ hd8rr/bp2rr{8400..8900} evidence pairs); lake bp2lakeA/B 275/276
(land 6.37/6.09 — WATCH); bay bp2bayA/B 231/234; ocean bp2oc 192 (hd8oc 193
baseline, ff2oc retired at the venue cut); river ff2rivA/B 264/271
byte-carried; arctic p3v2arcA/B 413/450 byte-carried; seatrials
199.58/194.13 byte-carried.

P0 — ARCTIC CLEARANCE SCALE (the ~150-185s/boat solo class; the biggest
number in the campaign). Her 26 laps: 1.06x rhumb IN TRAFFIC, clearance med
200u, 6.2% under 50u. Solo bot: 1.6-2.5x rhumb, 444 grinding contacts,
moving speed FINE — the excess is the ROUTE (pathSailable PAD 8 ≈ 400u
demanded clearance, EDGE_W 6: a 300u lead prices 4-5x; the pack becomes a
wall maze). Measure FIRST (one physical line): clearance histogram along
the ROUTER'S OWN CHOSEN LINES for her legs vs along her tracks — confirm
the router refuses the 150-300u leads she sails. Then the build: floe-grid
clearance-cost knee (PAD/EDGE_W scaled to her revealed ~200u on floe grids
only; land grids keep the landed corridor pricing UNTOUCHED — lake/river/
redrock byte-identical is the scope's own claim, verify not assume). Also
measure (before touching): the soft-cell ×2.5 "opening lead" bet's success
rate at arrival — [[map-staleness]] says drift is unpredictable; the 444
grinds are the bets failing. ⚠️ Distinction to name in every candidate:
STATIC clearance-demand scale ≠ the CLOSED closing-lead-pricing and
clearance-extension families (both priced DYNAMIC lead changes). Gates:
arctic 16×2 vs p3v2arcA/B + the solo probe (_arc_solo 465-med baseline,
_arc_dist odometer 38-60k baseline) + 4-seed byte-identity on every
non-floe venue + goldens. Success bar: solo odometer toward ≤30k, fleet
413/450 down double digits with in-420 up; rule 16 stands (scenes cannot
green-light — full races only).

P1 — ROUTER CURRENT PRICING (owner directive: "make sure the AI plans with
current"). Verified hole: physics/steering/tack know the water; pathSailable
prices still water — favorable chute ≡ adverse eddy. Build: per-cell current
projection in the step cost — time = dist/(polarSpeed + current·cosΔstep) —
alongside the existing _wbin wind pricing; fires only where currentRegions
exist (every current-free venue byte-identical BY CONSTRUCTION — verify
4-seed anyway). Fold Finding 3 into the same wave as a SEPARATE line:
current-aware start (getApproachTime with ground-speed closure; ~10s med +
tail). ⚠️ Bench the pair TOGETHER AND separately (the OP1+BP1 m5-funnel
anti-composition lesson is standing rule now). ⚠️ Distinctions: avoidance
ground-frame probes are CLOSED (this is route pricing); SIPP is retired
(drift PREDICTION — authored current is static); start CALIBRATION is
closed (constants — this is missing physics). Gates: river pooled fins/med
ONLY (rub noise rule — 16×2 minimum, 4 sets if near threshold), all-venue
byte-gates, goldens. Success bar: river 264/271 → ≤240 med; her 161-172.
treeP4TIGHT stays shelved behind the response class regardless.

P2 — THE RESPONSE CLASS (as time allows; at minimum land the measurement):
2a CURVED SMALL CANDIDATES: the ≤0.3-rad rungs rolled along the plan's
curvature (generalize arcK from armed-rounding to plan-following — FF2/
hard-zone's own line). The argmin's ledger says straight small candidates
read the bend as collision: river static 54%, redrock land-band 47%.
2b BREACH HONESTY AT MEDIUM: the 10000 boatCollision binary gated by
VO-entry/tCPA at MEDIUM only (HIGH/IMMINENT untouched); lake GW/MEDIUM
carries 2423/3754 of its big dodges; UL1's half-proof (needless-MEDIUM
collapse, river IMMINENT −68%, HIGH untouched) parameterizes it.
Order: 2a alone → 2b alone → COMPOSED, each on its OWN sets; redrock
verdicts near threshold get the 96-seed protocol; lake 20×2 with the +25%
caution; bay byte-protection; m3 (_rr_mstall 3) and m5 (_rr_mstall 4) stall
gates; full goldens. Use treePROBE/_av_fanlog for any "why did it choose
X" question — external cost models are a documented dead end.

P3 — if time: OP5 (fully parameterized ease: v1 per-tick form + wall-room
≥100 + wind ≥8kt + dG<250 — bench TOGETHER with the hard-zone base on
redrock; m3 target 13-14%→~4%, ocean/lake byte-or-neutral gates); NEW red
rock first attribution (the bounds-contact class, 30/boat, human-zero —
treeNEWRR pattern) if the owner signals the new course is next.

Standing constraints (additions from Aug 8 in caps): prime directive (≥4
probes in flight, check date — read the clock, never infer); episodes not
frames; actions not prices; one physical line per gate; measure first
(three candidate shapes died at the measurement step today — the ledger is
now 4-for-4 landings on anatomy-named builds); 96-SEED PROTOCOL for
near-threshold redrock verdicts (48-seed pooled means carry ±8-10s); RIVER
JUDGED ON POOLED FINS/MED ONLY (rubs span 6x on identical behavior); BENCH
CANDIDATE PAIRS TOGETHER before landing either; INSTRUMENT THE ARGMIN for
choice questions (treePROBE pattern); TWA convention (0 = head-to-wind);
byte-perturbation reshuffle (judge candidates on their OWN sets);
constrained-water damage is NONLOCAL; paired deltas are tail-dominated; all
landed scopes live in any new candidate (floe venues, _avCurMax ≥ 2, _gyOK,
250u funnel exemption, arcK, _voIn wide gate, hPlanFF alignment + the
hard-zone's wind/no-go/arc guards); the lake land watch item (6.37/6.09 vs
5.33/5.58) is P0-adjacent — any lake-touching candidate reports it.

Closed families (do not reopen; additions in caps): ENTRY-side rounding
governors (the ORBIT-phase distinction is mandatory and OP5 is its only
open form); ORBIT-EASE v2 SPEED-THRESHOLD-WITHOUT-LATCH (toggles) and v3
LATCH (overholds — stalls at sweep 306°); OP1+BP1 NAIVE COMPOSITION;
cap-in-funnel; VO-exit latch; closing-lead route pricing ×2; tight-slot
occupancy stamps; river ground-frame AVOIDANCE probes ×2; arctic
clearance-extension ×2; lake armed-probe-cap + boat-clearance gate; RL on
f0e290e ×2; mark-queue reservation; start calibration (CONSTANTS — the
current-physics start is distinct and open); minimal-escape fan;
hold/commitment; sighted wiggle; gap projection; SIPP; orbit radius below
the 70u knee; metered lee-shore holds; 80u owed-gap knob; layline ×4;
station-keeping among rivals (0-for-8 lifetime).

Human refs: bay 226.2/217.8; ocean 182.5 (predates gust fix); lake
223/209.6; OLD redrock ~227/206.6 (s2 214.7, legs 39.9/64.7/51.3/29.6/26.1);
arctic 212.1/190.4 (fresh: 206.2 clean); seatrials ~190/180.9 (fresh:
193.8); river 161.3 best n=2 (172.1). NEW redrock 272.5 clean / 304.4
(n=2) — bot 1.7x, bounds class human-zero. ⚠️ ASK FOR FRESH LAPS: bay,
lake, OLD redrock (hard-zone landing changed all three), post-gust-fix
ocean; more new-course laps whenever it's next. P-continuous: ingest any
schema-2 recording the day it lands.

Close with the standing venue report — SEVEN rows, venue | human |
pre-session bot | post-session bot, all venues benched on final HEAD, dirt
columns included; the lake land watch item gets its own line.

# SESSION 2026-08-08 MIDDAY PUSH (started 11:28 PDT, HEAD at open 9b5e983,
# behavior HEAD a393d61) — THE ARCTIC RE-ATTRIBUTION
# ═══════════════════════════════════════════════════════════════════════════
Working the five researched candidates in the directive's size order. The
headline is P0: the research session's Finding 1 ("arctic's 2x is ROUTING
DISTANCE") does not survive its own first measurement, and four successive
hypotheses died before the real class named itself.

## PHASE 0 — the gate
- `freeze_venues --check`: bay/arctic/seatrials/ocean/river/lake MATCH their
  frozen copies; redrock differs (d30fe85f frozen vs e44ca786 shipping) — the
  EXPECTED keep-both state, the benchmark is the frozen OLD red rock and the
  shipping course is the redesign. ⚠️ The script resolves SRC/DST relative to
  cwd: it must run from the repo root, not from eval/.
- Owner commits since a393d61 (7655252, 4f44118, 2c77e59, a870bc7, 6317d6e,
  9b5e983) touch ONLY eval probes, traj recordings and ai-campaign.md — zero
  lines in js/. Behavior HEAD is a393d61 and every anchor stands unchanged; no
  re-baseline needed.

## P0 — ARCTIC: FOUR HYPOTHESES DIED, THE FIFTH IS THE CLASS
Measure-first, per the directive. Probes added (all tracked): `_arc_clr.js`,
`_arc_why.js`, `_arc_churn.js`, `_arc_beat.js`, `_tk_probe.js`.

1. ✗ "THE ROUTER REFUSES THE LEADS SHE SAILS" — DEAD (`_arc_clr.js`, the
   directive's own first step). The clearance gap is real: the router's OWN
   chosen lines sit at med 328-407u against her 200u (26 laps). But it refuses
   almost nothing — of 23-40 plans per race only 3-6 even HAD a straight
   alternative with ≥150u of floe clearance, and only 1-3 were declined for a
   ≥1.3x route. Its plans run just ~1.4x the straight line. And the soft-cell
   ×2.5 "opening lead" bet, which the research memo guessed was failing (the
   "444 grinding contacts"), NEVER FAILS: 6 win / 0 fail / 6 abandoned pooled.
   ⚠️ Also a correction to the record: those 444 contacts are FRAMES. Deduped
   at 0.5s (standing rule 2) a solo race has 20-33 contact EPISODES.
2. ✗ THE PAD/EDGE_W KNEE ITSELF — BUILT, BENCHED, KILLED (treeAC1: clearance
   demand 8→4 cells wherever the narrowness is DRIFTING ICE, land-only
   clearance keeping full PAD). It fires exactly as designed — route clearance
   med 373/407/353/328 → 302/315/344/308 — and it LOSES: solo fin med 494.5 vs
   382.2, and the ODOMETER GOES UP, 51.1k vs 40.4k on the same 8 seeds. Arctic
   fleet 16-seed set A confirms no gain. Cutting the standoff does not shorten
   the sailed line; it buys gaps the drifting field then closes.
3. ✗ "THE PLAN CHURNS" — DEAD (`_arc_churn.js`). Lateral churn med 30-136u,
   flips ≤26% of replans. The plan is stable. ⚠️ TWO PROBE AUDITS (rule 18)
   were needed to get there: measuring "400u ahead of me now" vs "400u ahead of
   me then" scores a perfectly stable plan at ~250u because the boat ADVANCES
   between replans, and near a mark the plan is shorter than the lookahead so
   ptAt returns its endpoint. The first run's "churn 2095, flips 100%" was
   entirely artifact.
4. ✗ "THE BOT BEATS WATER SHE FETCHES" — DEAD (`_arc_beat.js`, 29 recordings vs
   5 solo races). Her beat share 44% (leg-1 48%), |h−w| med 60°; the bot's 39%
   (leg-1 45-50%), med 71°. Same point-of-sail mix. (⚠️ The recorder's heading
   column is `hdg`, not `heading` — the first run printed "0 laps", rule 4.)

✅ THE CLASS, NAMED: **TACK COUNT.** Her leg-1 median is 5 tacks across 29 laps
(range 4-8). The solo bot sails 21-23. Same beat share, same wind angles, on a
route whose FIRST plan for leg 1 (15.7-15.9k) already equals her sailed leg-1
distance (15.1k med) — and the boat HOLDS that route (d0 med 44-52u; off-plan
>100u only 25-30%). It then sails 23-32k. The excess is not the route, not the
clearance demand, not churn and not the point of sail: it is the manoeuvre
count converting the route into water.
MECHANISM (`_tk_probe.js`): the tack is chosen by scoring starboard vs port
VMG toward the STEERING CARROT — a point ~420u down the plan (measured carrot
distance med 423u). In a floe field the router's upwind route is a staircase
between floes, so that carrot alternates across the rhumb: far-vs-near bearing
gap med 10°, p90 34°, exceeding 8.6° in 59% of ticks. The two tacks' scores
swap with it and the boat tacks as fast as the 5 s cooldown allows.

- ✗ TK1 (score the tack against a 1400u-down-plan reference, floe venues only,
  steering carrot untouched): FIRES (the gap above) and LOSES — solo 9101
  465→726, 9102 654→517, 9100 byte-identical. KILLED, and the kill teaches the
  next shape: **the staircase is not noise, it is the route through the gaps.**
  Committing to a long board across it crosses the floes the staircase threaded.
  The human's 5 tacks are lane CHOICE, not lane averaging — the next candidate
  must pick a lane the pack actually offers and hold it, which is a question
  for the ROUTER (give the beat two boards) rather than for the tack scorer.

  TK1 solo, 8 seeds paired vs HEAD: med 415.5 vs 382.2, moving speed 124.6 vs
  130.6 u/s, odo med unchanged. Per-seed: 9100 =, 9101 +261, 9102 −137, 9103
  +90, 9104 +12, 9105 =, 9107 −33. Not noise-limited — it is worse.

## WHAT P0 LEAVES THE NEXT PUSH
The arctic size estimate (~150-185 s/boat) STANDS; only its address moved. The
target is the beat's MANOEUVRE COUNT (21-23 vs her 5), and the two shapes that
touch the tack scorer are now both measured and dead (the clearance knee, the
far reference). The remaining shape is the ROUTER's: pathSailable prices an
upwind staircase and a two-board beat identically (each upwind step is charged
its own VMG, so length decides and the staircase always wins on length). Give
the beat a MANOEUVRE COST — a step that changes tack pays the measured tack
seconds, the same TACK_SEC=1.0 the corridor-loss term already uses — and the
A* will return long boards a boat can sail. ⚠️ This IS a re-pricing, so rule 1
applies: compute the ratio first (a 21→5 tack change is 16 manoeuvres × ~1 s of
polar speed plus the turn's distance — an order-of-magnitude structural gap,
not a knob at its knee), and it must be judged on full races.

- ✗ TK2 (the router's own manoeuvre cost: a step that CHANGES TACK on an upwind
  bearing pays TACK_SEC·10 in the A*'s time units, floe grids only — the shape
  the TK1 kill named): ALSO LOSES. Solo 9100 352→376.5 with floe contacts
  444→1140, 9101 465→536 with 419→1480. The long boards the router now returns
  cross the ice the staircase was threading.
  ⇒ TWO independent attempts to straighten the beat (at the tack scorer, then
  at the router) both make arctic worse in the same way: MORE ICE. The
  staircase is load-bearing. Her 5 tacks are not a smoother version of the
  bot's 21 — they are a different plan: she picks a LANE the pack offers and
  holds it. Building that means choosing among candidate lanes (a route-level
  decision over the pack's gaps), not smoothing a route computed without them.
  That is the next push's shape, and it is now the only one left standing in
  this class.

## P1 — ROUTER CURRENT PRICING (owner-directed): BUILT, MEASURED, NOT LANDED
Build (treeCUR1, two lines): a per-cell current VECTOR beside the existing
_wbin wind field (sampled once at grid build — every authored current region on
the benchmark venues has period 0, so the field is static and needs no re-key),
and a step cost that divides by GROUND speed rather than water speed:
v_ground = 10/base + cur·cosΔ, floored at 0.8 kt and capped at 30. The A*
heuristic's admissibility floor is lowered by the map's strongest set, or a
favorable chute would break it. Venues with no currentRegions have no field and
price exactly as stock, by construction.
RESULT — river, judged on pooled fins/med per the rub-noise rule:
  set A (9100): med 264 → 265, paired med −1.0 / mean −0.7, finishers 119→115
  set B (9200): med 271 → 262, paired med −7.0 / mean −11.0, finishers 119→117
  land contacts 325→369 (A) and 322→348 (B); boat rubs down slightly in both.
Sign-consistent on the clock but FAR from the ≤240 success bar, six finishers
lost pooled, and the one dirt column the rub rule does not excuse (land) is up
~10% on both sets. The physical reading is coherent: the router now buys
favorable set, and the favorable set on this venue runs where the banks are.
NOT LANDED. The next shape is asymmetric — price ADVERSE water honestly (that
is real time the boat will lose) but do not let a favorable-set discount buy a
bank-hugging line, because the grind the bank costs is not in this term.

## P1b — THE CURRENT-AWARE START: SIZED OUT AT THE AUDIT
Built (treeCST1: getApproachTime takes a `setAlong` term, the current's
component along the crossing run in game units/sec; the loop bails at the cap
when an adverse set exceeds boat speed). River set B benched EXACTLY
byte-identical — all 119 paired deltas 0.0, identical dirt. Rule 17 says audit
the scope before believing that, and the audit (`_riv_startcur.js`, new,
tracked) settles it: the river's START LINE sits in 0.77-1.19 kt (venue max
5.16 kt is downstream), so the ≥2 kt venue-class scope never fires.
⚠️ AND THE SIZE DIES WITH IT, at any scope: the staged crossing run is
STAGE/cos(0.7) ≈ 78 units, about ONE SECOND at 5 kt. A 1.1 kt set shifts that
estimate by ~0.2 s. Finding 3's measured symptom is real (the fleet crosses med
10 s after the gun) but its named mechanism cannot produce it — 0.2 s of
estimate error is not 10 s of lateness. The river start's 10 s lives somewhere
else, and finding where is a fresh measurement, not this build.

## P2a — CURVED SMALL CANDIDATES: WINS RIVER, LOSES REDROCK, NOT LANDED
Build (treeCC1): read a CURVATURE off the plan (a second sample at ~520u past
the first, clamped to the measured 70u-knee radius) and roll the ≤0.3-rad rungs
that are also within 0.3 rad of the plan heading on that arc, reusing the
armed-rounding arcK rollout. ⚠️ Implementation note worth keeping: the rollout
curvature had to be a SEPARATE variable from `arcK`, because arcK is also the
guard that switches OFF the hard-zone scaling and the far-field waiver — reusing
it would have silently un-landed the hard zone for the one candidate the hard
zone exists to protect.
  river set A: med 264 → 257, paired med −6.0 / mean −4.7, finishers 119→118,
    land 325→332, pen 1.85→1.78 — a real if modest WIN, and river is exactly
    where the argmin's ledger put the class (static 54% of big dodges).
  redrock 9400: med 481 → 503, paired med +2.0 / MEAN +32.2, finishers 67→63,
    land 130.8→149.0 (+14%), boat 14.9→18.2 (+22%), mark 1.03→1.39 (+35%).
    Every dirt column worse; not a near-threshold call.
THE MECHANISM OF THE SPLIT (the lesson to keep): a probe is honest only when the
boat will actually sail the shape it probes. Under an ARMED rounding the boat IS
steered along the arc, so the arc probe tells the truth. Following a plan, the
boat sails the candidate HEADING until the next tick — so a curved probe clears
water the boat will not reach and hides land it will. River's corridor bends
gently enough that the arc is a good 4-second approximation; redrock's island
band bends harder than the boat turns, and there the curve is a lie.
⇒ A curved rung needs the boat's OWN achievable turn, not the plan's curvature.
That is the shape for the next attempt; as built this cannot land globally, and
a river-only scope would be venue-fitting, not a physical line.

## P2b — BREACH HONESTY AT MEDIUM: KILLED ON ITS OWN NAMED VENUE
Build (treeBH1): the flat 10000-point boatCollision term, at riskState MEDIUM
only, scaled by when the projected breach actually arrives — full price inside
2 s, floored at a third at the 4 s horizon (`bcT` = the earliest breaching
sample over all pairs). HIGH and IMMINENT keep the binary; the 500000/(d²+10)
weight, the rule-violation term and the stand-on Rule 16 penalty are untouched.
LAKE 20 seeds (the venue the argmin ledger named: boatCollision buys 47% of its
big dodges, GIVE_WAY/MEDIUM carrying 2423 of 3754): paired med +7.0, mean +4.9,
and LAND CONTACTS 6.37 → 16.09 PER BOAT — two and a half times, on the very
metric that is this campaign's open lake watch item. Boat rubs 1.98→2.87, pen
0.54→0.63, one finisher lost.
MECHANISM (and it is standing rule 11 again — constrained-water damage is
nonlocal): the honest MEDIUM price is honest about the OTHER BOAT, who will
indeed steer. It is not honest about the SHORE, which will not. In open water
the accepted gap costs nothing; in lake's confined water the boat that used to
buy its way out early now holds on, arrives at the squeeze committed, and takes
the only remaining exit — the beach. KILLED.

- ~ TK3 (raise the tack cooldown 5 s → 20 s on floe venues, racing legs — the
  one shape that changes NEITHER the route nor the reference, only the minimum
  board length; rule 1's order test: her ~40 s board against the bot's ~10 s is
  8x): NEUTRAL. Solo med 405.5 vs HEAD 382.2 over the same 8 seeds, but FOUR of
  the eight are byte-identical (9100, 9104, 9105, 9106) and the rest split
  −142/+76/+35/. The cooldown is not what binds: the boat's tacks are being
  re-authorised by the LAYLINE path (which sets its own 10 s cooldown and
  returns early), not by the score-flip path this raises. No measured action
  win ⇒ not landed, and the observation is the useful part — a future minimum-
  board shape has to go through the layline return, not around it.

## P2a REDROCK, POOLED — AND WHY THE FIRST TWO SETS BOTH LIED
Standing rule 12 in one candidate. CC1's six anchor sets, paired med per set:
  9400  +2.0     9500  −50.0     9600  +58.0     9700  +38.0
Two 8-seed sets of the SAME tree disagreed by 108 seconds of paired median. Set
9500 alone read like a landing (med −50, land −19%, boat −23%, finishers 66→69)
and set 9400 alone read like a disaster (mean +32, every dirt column up). Neither
was true. Pooled over the four, paired med +20.0 / mean +9.1, negative in 118 of
247 boats — a coin flip, with dirt a shade worse.
⇒ CC1 does not clear redrock. New probe `_pool_rr.js` (tracked) does the pooling
and PRINTS THE PER-SET SPREAD beside the pooled figure, so the noise is visible
instead of assumed — the next candidate should be read through it from the start.

- ✗ CUR3, the asymmetric variant the CUR1 result pointed at (charge ADVERSE
  water, take NO credit for favorable set — so no step is ever cheaper than
  stock and the stock admissibility floor stands): WORSE than CUR1, not better.
  River A paired med −1.0 / mean +1.9, SIX finishers lost (119→113), boat rubs
  61.6→101.2 per boat (+64%), land 325→378 (+16%). Refusing adverse water
  without buying fair water just squeezes the whole fleet into the same
  remaining lanes — the fleet-level version of the same nonlocal lesson lake
  taught P2b. The current-pricing family is two variants deep with no landing;
  the owner's directive is satisfied at the MEASUREMENT level (the hole is real
  and now instrumented), not at the landing level.
FINAL (all six sets, 48 seeds): per-set paired med +2 / −50 / +58 / +38 / −4 /
+65; POOLED paired med +35.0, mean +12.9, negative in 166 of 365 boats; pooled
med 498→507, fins 396→392; dirt boat 19.97→20.19, land 142.38→145.82, pen
3.83→3.85. CC1 is a river-only effect that redrock rejects. NOT LANDED.

## P3 — NOT REACHED
OP5 and the new-red-rock bounds attribution were the tail of the directive and
the session spent its machine time on the P0 re-attribution and five candidate
verdicts instead. OP5 remains build-ready and unchanged (v1 per-tick form +
wall-room ≥100 + wind ≥8 kt + dG<250, benched TOGETHER with the hard-zone base
on redrock). No owner signal arrived on the new course, so it stays content.

## SESSION VERDICT — NO LANDING, ONE RE-ATTRIBUTION, FIVE CANDIDATES CLOSED
Behavior HEAD is UNCHANGED at a393d61: `git diff` over regatta/js and
regatta/assets is empty, so every anchor carries to final HEAD by construction
and no golden re-record was required (npm run trace untouched, no behaviour
change to record). What the session produced is knowledge, not a diff:
- THE ARCTIC RE-ATTRIBUTION (above): the 2x is manoeuvre count, not routing
  distance. Four hypotheses and three builds died naming it. The size stands.
- FIVE CANDIDATE FAMILIES CLOSED OR MEASURED with their mechanisms named:
  the floe clearance knee (kill), the tack reference and the router's manoeuvre
  cost (two kills, one shared lesson), MEDIUM breach honesty (kill on its own
  named venue), router current pricing ×2 (not landed, owner's hole confirmed
  and instrumented), the current-aware start (sized out by arithmetic), curved
  small candidates (river win, redrock rejection, mechanism of the split named).
- THREE STANDING RULES EARNED: lookahead probes need a fixed reference (two
  artifacts in one probe); a path-shaping probe must model the path the boat
  will SAIL; read redrock through pooled sets from the first verdict.

## THE VENUE TABLE (final HEAD = a393d61 behavior, benchmark venues frozen)
venue     | human med/best        | pre-session bot        | post-session bot (final HEAD)
bay       | 226.2 / 217.8, 0 impacts | 231 / 234 (bp2bayA/B), boat 1.39/2.11, mark 0.05/0.28, pen 0.28/0.40, OCS 0 | UNCHANGED — no behavior diff this session
ocean     | 182.5 (predates the gust fix) | 192 (bp2oc), boat 1.81, mark 0.36, pen 0.35 | UNCHANGED
lake      | 223 / 209.6           | 275 / 276 (bp2lakeA/B), land 6.37/6.09, boat 1.98/3.09, mark 0.43/0.32 | UNCHANGED
redrock   | ~227 / 206.6 (s2 214.7) — OLD red rock, the benchmark | 48-seed fins 396, pooled med 499 (per-set 481/510/497/542/564/469), land 142.4, boat 19.97, mark 1.14, pen 3.83 | UNCHANGED (re-measured this session as the CC1 baseline: pooled med 498, fins 396 — the same numbers)
arctic    | 212.1 / 190.4 (fresh clean 206.2) | 413 / 450 (p3v2arcA/B), in-420 75/53 | UNCHANGED — and now ATTRIBUTED: solo fin med 382, odo 40.4k = 1.6x her 25.4k, leg-1 tacks 21-23 vs her 5
seatrials | ~190 / 180.9 (fresh 193.8) | 199.58 / 194.13, OCS 15.44% | UNCHANGED
river     | 161.3 best, n=2 (172.1) | 264 / 271 (ff2rivA/B), fins 119/119 of 144 | UNCHANGED
⚠️ LAKE LAND WATCH ITEM: 6.37 / 6.09 per boat against the pre-hard-zone 5.33 /
5.58 — still open, still unattributed, and it BIT this session: the MEDIUM
breach-honesty candidate drove it to 16.09 (2.5x) and was killed for it. Any
candidate that touches lake must keep reporting this column.

## FOR THE NEXT PUSH
1. ARCTIC LANE CHOICE (the only shape left in the biggest class): choose among
   the lanes the pack actually offers and hold one. Not a smoothing of the
   staircase — two smoothings are already dead.
2. The response class survives as a target but needs the boat's ACHIEVABLE TURN
   as the probe's ceiling (the curved-candidate lesson), not the plan's bend.
3. The river start's 10 s is unexplained again — the current term cannot produce
   it (0.2 s of a 1 s run). Measure where those seconds actually go.
4. Current pricing: the hole is real and instrumented; both symmetric and
   adverse-only pricing move the fleet into worse water. A third shape must
   answer what the bank grind costs, which no route term currently knows.
5. OP5 is still build-ready and still un-benched.

GOLDENS: PASS — 20 traces checked, 0 behaviour changes, 0 geometry-only, 0 new
(4.5 min, run on the unchanged HEAD as the explicit check that the anchors carry
rather than an assumption that they do).

# POST-CLOSE CONTINUATION — THE LANE ROUTER (the shape the P0 kills named)
# ═══════════════════════════════════════════════════════════════════════════
The session did not stop at the write-up: the kills had named one shape and it
was cheap enough to test. Two more builds, and the class is now bounded from
the inside as well as the outside.

## LANE1 — the state is (cell, how you arrived)
TK2 failed because a tack cost CANNOT be expressed over cells alone: it read the
incoming direction off prev[] with a cell-keyed gScore, which is incoherent under
re-expansion, and its "long boards" just aimed through the pack. LANE1 widens
pathSailable's state to cell × incoming direction (8x), charges TACK_SEC·10 on a
genuine upwind side-change, and keeps ice as ice.
IT WORKS AS A ROUTER: solo floe contacts 512 → 116 per race (−77%), sub4 81→60 s,
sub1 32→22 s. The router really does find clear lanes.
AND IT LOSES ANYWAY: solo fin med 392.4 vs 382.2, leg-1 TACKS UP (39/24/37/13 vs
21/23/91/17). The route is long boards; the STEERING still chases a fixed 420u
carrot, which cuts the board into pieces and hands the tack scorer a swinging
target. ⇒ THE STAIRCASE WAS STEERING THE BOAT. Removing it without replacing
what it did costs more than it saves.

## LANE2 — the joint form: steer to the END OF THE BOARD
Carrot walks the plan to its next real corner (direction turn > 0.6 rad, ceiling
2200u, never nearer than the existing LOOK floor), floe venues only.
It does exactly what it was built to do, ON THE RACES THAT WERE BROKEN:
  seed   leg-1 tacks (HEAD → LANE2)   odo/plan0        solo fin
  9101        23 → 15                 2.01 → 1.39      465.4 → 371.7  (−94)
  9102        91 → 49                 2.80 → 2.21      654.2 → 492.4  (−162)
  9100        21 → 27                 1.47 → 1.71      352 → 433.6    (+82)
  9103        17 → 20                 1.43 → 1.40      334.9 → 416.2  (+81)
8-seed paired deltas: −162, −94, −82, +28, +81, +82, +100, +217 — MEDIAN +54.5,
solo med 416.2 vs 382.2. It rescues the disasters and taxes the good races, and
the tax is bigger. NOT LANDED.
GATES RUN: bay 4-seed BYTE-IDENTICAL (36 deltas all 0.0, dirt identical).
⚠️ AND THE BAY GATE EARNED ITS KEEP — it caught a SCOPE BUG on the first run
(paired +4.0, dirt moved): `grid._soft` is NOT a floe test. stampFloes returns
the base grid untouched when a venue has no floes and the caller attaches an
all-zero `_soft` to it anyway, so a `_soft` scope fires on EVERY venue. The
correct test is the one the landed canyon law already uses — does the course
carry live `_floeObjs`. Re-run byte-identical after the fix.

## WHAT SEVEN SHAPES HAVE ESTABLISHED
Every mechanism that touches the beat has now been measured: the clearance
demand (AC1), the tack scorer's reference (TK1), a cell-keyed manoeuvre cost
(TK2), the manoeuvre cooldown (TK3), a correct direction-aware router (LANE1),
and that router plus board-following steering (LANE2). The tack-count gap is
REAL (21-23 vs her 5) and every one of these moves some intended statistic —
LANE1 cuts ice contacts 77%, LANE2 halves the tacks on the worst races — while
NONE improves the median clock.
The pattern across all seven: HEAD's staircase-plus-near-carrot is a locally
CONSISTENT system, and each single-sided change breaks the consistency somewhere
else (TK1/TK2 into the ice, LANE1 into more tacks, LANE2 into the good races).
Her five tacks are not a smoothed version of twenty-one; they are a different
competence — judging which gaps will STILL BE THERE when she arrives, on a field
whose drift [[map-staleness]] already showed is unpredictable past ~5 s.
⇒ THE NEXT SHAPE MUST BE ABOUT WHEN TO COMMIT, NOT ABOUT THE LINE: a board is
worth holding only as long as the gap it aims at survives. That is a prediction
problem the campaign has so far only met in the negative (SIPP), and it should
be attacked as a measurement first — for each board the bot sails, did the gap
it was aimed at still exist on arrival? The instrumentation for that is now
in the tree (the lane router knows its own boards).

## LANE2 arctic FLEET evidence — PARTIAL, and reported as partial
The 16-seed fleet gate could not finish: the widened state space is ~8x the
search and nine boats replanning on a 2 s cadence makes the bench impractically
slow (a cost worth knowing on its own — any future lane router needs a bounded
search, not just a correct one). Six seeds completed, fleet MEDIAN per seed
against the p3v2arcA anchor:
  9100 413→434 (+21)   9101 447→454 (+7)    9102 531→436 (−95)
  9103 375→352 (−23)   9104 389→391 (+2)    9105 372→620 (+248)
median +4, mean +27 over 6 of 16 seeds. Same signature as the solo set — it
rescues the worst race and loses the tail elsewhere. NOT a gate result; the
8-seed paired solo (median +54.5) is the verdict and it stands.

# NEUTRAL-BOT MACHINERY (owner-directed, 2026-08-08)
# ═══════════════════════════════════════════════════════════════════════════
Owner ruling after the roster-variance measurement: keep the stat fleet for
benches, make the SOLO probes race a stat-neutral bot, and put the machinery in
place for a bonus-free fleet later without running it yet.

BUILT on the existing `window.__CHAR` harness switch (which already carried
`traitsOff`), so the layers compose instead of forking:
  traitsOff — the archetype/character behaviour persona
  statsOff  — per-character stat blocks; every bot gets STAT_DEFAULTS
  bonusOff  — the flat +4 AI_STAT_BONUS difficulty handicap
  neutral   — shorthand for traitsOff + statsOff (identical boats, SHIPPED
              difficulty — the bonus stays on)
The bonus is deliberately its OWN knob: `statsOff` answers "is this result a
roster draw?" (a question about VARIANCE between characters), `bonusOff` answers
"how much of the human gap is decisions rather than the handicap?" (a question
about the LEVEL). Independent questions, independent switches. `bonusOff` is
built and UNRUN, per the owner.
INERT VERIFIED, not assumed: nothing sets `__CHAR` in the shipping game — bay
4-seed byte-identical (36 paired deltas all 0.0, dirt identical) and GOLDENS
PASS 20/20, 0 behaviour changes.
WIRED: `_arc_solo`, `_arc_why`, `_arc_churn`, `_arc_beat`, `_arc_clr`,
`_tk_probe` now set `{neutral:1}`. These promote bots[0] to hero and bots[0] is
a DIFFERENT CHARACTER PER SEED (9100 Fathom, 9101 Nimbus, 9102 Anvil), so their
ABSOLUTE numbers were a mixed roster draw against her one unmodified boat.
(The log still prints the character NAME — identity is unchanged; only the
sailor's stats and persona are stripped.)

## THE ARCTIC HEADLINE, RE-MEASURED ON A NEUTRAL BOAT — IT HOLDS
                       stat-based (as reported)   NEUTRAL      human
  solo fin med              382.2                   412.7       217.6
  odometer med             40 438                  41 519      25 373
  odo / her distance         1.59x                   1.64x       1.0
  leg-1 tacks               21-23                   19-21        5 (med, 29 laps)
  moving speed (u/s)        130.6                   127.1       124.2
  floe contacts med           512                     209        ~1
The re-attribution survives its own robustness check: the distance ratio is if
anything slightly WORSE on a neutral boat (1.64x), and the tack gap — the class
this session named — is unchanged at ~4x her median. The roster was not driving
it. Floe contacts fall by more than half without the stat blocks, which is a
character effect (handling/momentum) and not part of the tack-count claim.
⇒ Every arctic conclusion in this session's record stands as written.

# THE GRANITE-ISLE ROUNDING (owner lead, 2026-08-08 afternoon)
# ═══════════════════════════════════════════════════════════════════════════
Owner observation: his son's arctic race (the 313.9 outlier lap) — well back in
the pack until the rounding, where he passed the entire AI fleet. Directive:
compare human and bot trajectories at the rounding and distill the strategies.

## THE SAME-RACE LEDGER (`_arc_round.py`, new, tracked)
The schema-2 recordings carry all nine rivals at 10Hz with stable identity and
per-rival leg, so each recording holds up to TEN roundings of the same mark in
the same water — zero seed noise. Pooled, 7 human vs 17 bot roundings:
                        HUMAN     BOT     (same races)
  600u ring → leg flip   19.0 s   62.9 s
  mean speed in ring    106.6     56.7  u/s
  MIN speed in ring      84.9      3.6  u/s
  seconds under 2.7 kt    0.0      6.6  (up to 17)
  closest approach        314      308  u
  ring odo / straight    1.40     1.18
THE LINE IS THE SAME (dMin ~310u both, and the bots sail LESS distance in the
ring). The difference is that the bots PARK on it and the human never drops
below ~5.7 kt. The son's lap: RANK 9 → 1 → 1 across his own rounding — he
passed eight boats in the last sixty seconds of the approach, exactly as the
owner described. Live fleet re-measure (`_arc_roundlive.js`, new, tracked, 27
ring passages): ring→flip med 75.7 s, vMin med 0 — ~57 s/boat/rounding against
her 19 s, on a fleet whose whole gap to her is ~200 s.

## THE STRATEGY, DISTILLED FROM HIS OWN TRACK (the recorder's ring scan)
The recordings carry `ringSect16` — the AI's OWN 16-sector ring rating around
the round mark (0 clear / 3 closing / 5 lead / 8 plug / 10 hard). At his pass,
the ring read mostly 8s and 3s. He ENTERED THROUGH SECTOR 13 WHILE THE SCAN
RATED IT 8 (PLUG) at 34→74→88 u/s, rounded at 331u, exited at 150-180 u/s. On
clean laps the human spends 19-50% of zone time inside PLUG/HARD-rated sectors,
never under 84 u/s. The distilled strategies:
  HUMAN: the plugged ring is WATER — enter anywhere, carry speed, shave the
         floes (her lifetime min-clearances are 15-30u), let the hull glance.
  BOT:   the plugged ring is a WALL system — wait, dodge, re-route for a
         clear sector; every layer (router ×2.5/×6 soft pricing, avoidance
         6000/12000 soft cost, ring scans preferring clear sectors, give-way
         among the queued fleet, the full 140u hard veto in floe water) points
         the same way, and the boat arrives at 0 kt.
## LIVE ATTRIBUTION of the parked seconds (fleet, 27 passages):
  soft-grind 24% · traffic risk 23% · unexplained 19% · IN IRONS 18% · defl 16%
  ease 0%, orbit 0% — the governors and orbit machinery are NOT involved.
Parked head-to-wind at a mark whose zone is 851u (granite-isle — AUTHORED LAND,
not ice) is the m5-box anatomy again, and the hard-zone speed scaling that
cured it on redrock explicitly excluded floe venues (openWaterAv) — the fix
never reached the one rounding where the fleet loses the most.

## RD1 — THE GRANITE EXCEPTION (built, first evidence STRONG)
Two lines: compute hPlanFF (the plan-heading reference) in floe venues too, and
drop `openWaterAv` from the hard-zone scaling's own test — every other guard
(fresh plan <200u cross-track, no-go, arc, ≥2kt current) stands. Sound because
in floe water the non-soft wall this veto ever sees IS authored land: drifting
ice takes the graded _soft grind cost before this branch is reached, so the
"drifting ice does not keep clear" line the floe exclusion protected is already
enforced one branch earlier, and the exclusion was only withholding the m5 cure
from granite-isle. Open-water venues price bit-for-bit as before (openWaterAv
was already true); river is excluded by the current guard.
SOLO, paired on the measured seeds (ring→flip):
  9100  47.7 → 53.7   (noise)
  9101  24.8 → 14.4   (now FASTER than the human's 19s)
  9102 406.7 → 184.8  (−222s on the disaster draw; in-ring 166.7→46.5)
Blocker split during remaining slow frames: LAND 89s → 15s (the cured class),
FLOE 20s (correctly still vetoed — ice keeps the wall). The mechanism does
exactly what it was aimed at. Fleet 16-seed gate + non-floe byte-gates running.

## RD1 FLEET VERDICT + THE v2 LADDER
RD1 fleet 16-seed: paired med 0.0 / mean +3.9 — FLAT clock; boat rubs −18%,
floe −9%, but LAND +34% (19.8→26.6/boat). The solo cure is real and the fleet
spends it on the granite: RD1 extended BOTH the scaled veto (wanted) and the
30000 far-blockage waiver, and at speed a plan-aligned candidate with no far
tax aims at the isle's bend; traffic finishes the push. NOT landed.
- RD2 (waiver reverted, veto kept): solo seed 9100 ring→flip 89.1s — WORSE
  than HEAD (47.7). The waiver was load-bearing for the solo escape; the far
  tax re-parks it ("other" 20.1s of wandering). Both directions now measured:
  waiver-on cures solo and feeds the isle in traffic; waiver-off re-parks.
  KILLED as a knob — the answer is not on this axis.
- THE STRUCTURAL FIND BEHIND BOTH: `if (arcR && openWaterAv)` — the ARMED-
  ROUNDING ARC ROLLOUT (the landed cove fix, "probe the water the boat will
  sail") has been open-water-only all along. At granite-isle the boat sits
  ARMED for 45-166 s probing an 851u-zone island with STRAIGHT 4-second rays;
  every ray reads the isle as collision and the straight-ray dilemma (veto vs
  far tax) is unresolvable because the probe's SHAPE is wrong. arcR's own
  guards (≥2kt current kill, queued-rival kill from the redrock m5 wedge
  lesson) carry over unchanged.
- RD3 = arc-in-floe alone; RD4 = arc-in-floe + RD1. Benching separately and
  together per the composition rule.
LITERATURE (owner-directed): sailing practice — maintain momentum, wide-in
tight-out, avoid the crowded side ("all the boats rounding a crowded gate will
be going slower"); robotics — distributed avoidance deadlocks at shared
waypoints, cures are stay-in-motion + locally-bounded coordination. Both match
the measured anatomy: the human keeps way on through the plugged ring; the
fleet's layered caution deadlocks it.

## RD3 — THE ARC REACHES THE ICE (solo: the rounding class collapses)
One condition: `if (arcR && openWaterAv)` → `if (arcR)`. The armed-rounding arc
rollout (the landed cove fix) now runs in floe venues; arcR's own guards (≥2kt
current kill, queued-rival kill) carry over unchanged; every non-floe venue is
byte-identical by construction (openWaterAv was already true there).
SOLO ring→flip, the full ladder on the same three seeds:
  seed    HEAD    RD1     RD2     RD3(arc)   human
  9100    47.7    53.7    89.1    24.1       ~19
  9101    24.8    14.4     —      24.8
  9102   406.7   184.8     —      55.8       (−351 s on the disaster draw)
Attribution under RD3: irons 6% (was 17-22%), other 31% (was 37%), soft-grind
47% of a much smaller total — the boat now sails the arc and glances the ice,
which is the human profile from the recordings. RD4 (arc + RD1) is
BYTE-IDENTICAL to RD3 on all three seeds: with the arc owning the rounding
geometry, the veto/waiver axis has nothing left to fix — the straight-ray
dilemma was the wrong axis, and the probe's SHAPE was the class.
Fleet 16-seed gate running.

## RD3 FLEET + OP5 FIRST GATES — AND RD5, THE QUEUE-WIDENED ARC
RD3 fleet 16-seed: paired med +2.0 / mean +2.9 — FLAT, dirt mildly better
across the board (boat 12.5→11.2, land 19.8→19.4, floe 32.1→31.1). The −222s
solo cure does not reach the fleet clock: the arc's QUEUED-RIVAL DISABLE (the
redrock m5 wedge lesson) switches the arc off exactly when the pile forms, and
the pile is the fleet's rounding. NOT landed alone; dirt-favourable, kept as
the base for the pair.
OP5 first gates on set 9400: m3 stalls 55→5 passes = 9.1% (HEAD 13-14%, v1's
full ease reached 4% — the dG<250 gate narrows the window); residual stalls
have governor-fired 0/5 in the prior 20s (a different sub-class); clock +26.0
paired med with boat rubs +19% on the one set. SHELVED again at the scope —
one set cannot kill it (rule 20) but the mechanism's ceiling here (9% not 4%)
plus the m5-composition history make the pooled protocol a poor spend next to
the fleet-pile class. treeOP5 kept.
RD5 (built): at zone ≥ 500 a queue WIDENS the arc (arcR = max(dM, queueR+120))
instead of disabling it — small zones keep the m5 wedge lesson verbatim. The
literature's wide-in-tight-out and the son's own pass (rank 9→1 around the
OUTSIDE of the pile) both draw this shape. Fleet 16-seed running.

- SG1 (commit-the-grind: half-price soft cells beyond the hard zone for the
  plan-aligned straight candidate, on the RD3 base): BYTE-IDENTICAL to RD3 on
  all three solo seeds — rule 17, pricing water no decision buys. With the arc
  active, the aligned straight rung no longer meets the soft cells that
  matter; the residual ring grind rides the ARC's own samples (deliberately
  excluded — the arc's soft cost is what keeps its orbit honest about ice).
  The class this targeted shrank to ~10-20s solo under RD3; the remaining
  arctic rounding prize is the FLEET pile, which is RD5's question.

## RD5 KILLED + THE ENTRY-SECTOR MEASUREMENT + WHERE THE RING CLASS STANDS
RD5 fleet: paired med +15.0 / mean +14.8, finishers 143→140, pen 1.66→1.83,
land 19.8→22.0 — arcing around the pile sweeps boats through more ice and
traffic than waiting behind it. KILLED.
Entry sectors at the ring (same-race recordings): bots 17/17 through three
adjacent sectors (13-15); the human 5 distinct over 7 laps but ALSO mostly
13-15 (5/7). Sector choice is NOT the separator — the separator is that she
crosses the same band at 85+ u/s with 12-23° give-way deflections while the
fleet's ring risk-slow is 23% of its parked time.
THE RING CLASS AFTER SIX SHAPES: the solo geometry is FIXED (RD3: ring→flip
med 24.8s, human 19; −351s on the worst draw) and the fleet is CONVERGENCE-
BOUND — every single-boat cure is flat at the fleet clock (RD1/RD3) or worse
(RD2/RD5). The remaining term is the give-way RESPONSE at the pile: the boats
STOP to give way; she BENDS. That is the cross-venue response class (lake's
GW/MEDIUM 47%, redrock's boat band, the underlay dossier's 35-60° vs her
12-23°), and the next probe instruments the give-way argmin at the ring: when
a bot goes risk-slow, was a speed-keeping DUCK (bear away astern) on the
candidate menu, and what beat it?

## THE DUCK VERDICT (`_duck_fanlog.js` + treeDUCK, new, tracked) — THE RING
## CLASS'S FINAL ANATOMY FOR TODAY
1771 give-way/high-risk slow ticks inside the ring (fleet, instrumented argmin):
  the chosen candidate is a stop/luff only 11%; a wide dodge 23%.
  A CLEAN SAILABLE DUCK EXISTED IN ONLY 21% of ticks — and where it existed it
  was chosen or effectively tied 34% of the time (beaten by proximity 12%, by
  other costs 54%, by ruleViolation 0%).
  ⇒ IN 86% OF TICKS, EVERY DUCK-SHAPED CANDIDATE CARRIES A COLLISION FLAG.
The speed-keeping escape does not LOSE the argmin — it is NOT ON THE MENU,
because the pile of parked boats plus ice genuinely blocks it. Unlike lake's
MEDIUM case (BH1), these flags are mostly TRUE: a frozen projection of a parked
rival is correct. The response layer cannot cure a jam that physically exists;
the cure is UPSTREAM — not arriving into the jam. That is the deadlock-
avoidance coordination class from the robotics literature (stay in motion +
locally-bounded coordination when progress stalls), and it is a DESIGN for the
next push, not a patch for this one. The son's pass is the human version of
exactly that: he saw the pile forming and spent his approach wide of it.

## RD3 SET B — THE LANDING DIES ON THE SECOND SET
Set B (16@9200): paired med +15.0 / mean +20.8, boat rubs 9.70→11.63, pen
1.76→1.85 (finishers 139→141, land/floe flat). Set A was flat-with-better-
dirt; set B is worse-with-worse-dirt — the two arctic 16-seed sets disagree
exactly as standing rule 3 says they can, and pooled the clock does not pay.
RD3 IS NOT LANDED. It remains the proven COMPONENT (the solo rounding geometry
is simply correct with the arc on: 406.7→55.8 on the worst draw) and the base
on which the fleet-arrival design must be built — but on the fleet bar, today
produced no landing.

## THE DAY'S SHAPE, honestly
Thirteen builds across two sessions (AC1, TK1-3, LANE1-2, CUR1/3, CST1, CC1,
BH1, RD1-5, SG1, OP5) and every fleet verdict is flat-or-worse while nearly
every intended micro-statistic moved. The through-line is now measured from
three independent directions (the tack ledger, the lane router, the granite
ring): HEAD's fleet behavior is a LOCALLY CONSISTENT EQUILIBRIUM — router,
steering, tack scorer, avoidance flags and the queue's own physics lean on
each other, and any single-sided change is absorbed or paid for elsewhere.
The human's superiority at the same spots is not a smoother version of one
layer; it is arrival-scale judgement (which gaps survive, where the pile will
be) that no current layer represents.
NEXT-PUSH DESIGN (both today's classes point at it): a FLEET-ARRIVAL layer —
per-boat entry timing/laning at high-traffic zones (the granite ring, redrock
m3/m5, gate approaches), built on RD3's corrected geometry, judged at full
races. The robotics literature calls this locally-bounded coordination on
progress-stall; the sailing literature calls it rounding the gate with less
traffic; the recordings call it what his son did.

## THE LEG-2 SURPRISE THAT COMPLETES THE PICTURE (same-race, old redrock)
Rival leg-2 slow episodes (51 episodes, 247 s, the fleet's worst same-race leg
at +39 s med vs her): only 7% of that time is within 600u of m3 — 74% IS
≥1200u AWAY, clustered 300-500u AFTER m1. The fleet's biggest old-redrock leg
loss is a PILE AT THE EXIT OF THE FIRST ROUNDING — the granite-ring class, on
a land venue, at the mark the whole fleet rounds within seconds of each other.
⚠️ Design constraint from the code's own history: per-boat ENTRY-SECTOR bias
was tried and rejected 2026-08-03f ("rafted the fleet onto one slot") — the
arrival layer must work on TIMING/SPACING of arrivals, not on biasing the
shared sector score.

# NEXT-PUSH DIRECTIVE (drafted at close of Aug 8 afternoon; behavior HEAD
# still a393d61 — NOTHING LANDED today, and that is the finding)
# ═══════════════════════════════════════════════════════════════════════════
P0 — THE FLEET-ARRIVAL LAYER (the one class three independent measurements
name): the pile at high-traffic zones — granite ring (57 s/boat/rounding, the
son's rank-9→1 pass is the human answer), redrock post-m1 exit (74% of the
fleet's worst-leg slow time), and by extension every mark the fleet reaches
together. Facts the design must respect: the duck verdict (86% of give-way
slow ticks have NO sailable escape — the jam is physical; cure is arrival,
not response); the rejected entry-sector bias (do not touch the shared sector
score); station-keeping 0-for-8 (no holds — spacing must come from SPEED
SHAPING on approach or route-length diversity, flowing actions only); RD3 is
the correct geometric base (land it WITH the arrival layer as a pair if the
pair pays — its solo fix is real and its fleet cost is only the pile it
currently feeds). Build on treeRD3. Measure first: arrival-time spread vs the
human races' spread at each site (the recordings carry it).
P1 — the shelved-but-alive tails, each behind its named blocker: OP5 (m3 9.1%,
needs the pooled protocol + the m5 gate); the current-pricing third shape
(needs a bank-grind term the route can see); the response class with the
boat's ACHIEVABLE TURN as the probe ceiling (CC1's lesson).
P-continuous: fresh laps (bay, lake, OLD redrock, post-gust-fix ocean); ingest
day-one; the lake land watch item reports in any lake-touching candidate.

## THE ARRIVAL-COST CURVES (`_arrival_cost.js`, new, tracked) — THE BUDGET
First measurement of the next-push P0, done now. One passage per boat per
rounding (⚠️ v1 counted rim oscillations as passages and flattened the curve —
rule 18, fixed in-probe), first zone entry → leg flip, occupancy read at entry:
  GRANITE RING (600u, 26 passages): 0-2 boats in → transit med 123-148s;
    4 in → 179s; 5 in → 288s. ~40+ s per extra occupant at the tail.
  REDROCK m1 (500u, 64 passages): 0 in → 12.0s; 1 → 18.7s; 3 → 20.3s;
    4 → 41.1s. Same shape at land scale.
The pile has a measurable price and spreading arrivals has a computable budget.
AR1 (built on treeRD3): the LANDED funnel-metering's floe exclusion was earned
on a base where the arc was disabled in floe water (metered boats sat in ice,
12.1→13.5 contacts). On the RD3 base, retry it at WIDE-ZONE floe marks only
(zone ≥ 500 = granite; small zones keep the exclusion verbatim), radii scaled
to the zone (0.7z/1.4z/0.7z for inner/outer/jam) so the trigger can see a pile
that forms 300-600u out; the mid-leg defile form stays open-water-only. Every
non-floe venue is byte-identical by construction (their constants unchanged).
Fleet 16-seed gate running.

## THE QUEUEING ANATOMY — the measurement that inverts the arrival design
Fleet first-arrivals at the granite ring, from the RECORDINGS (the rivals are
the AI): median inter-arrival gap 9.4s, total spread ~97s over 6 races. THE
FLEET ALREADY ARRIVES SPREAD. The pile is not an arrival problem — it is
SERVICE TIME: each transit takes 63-76s against her 19, so occupancy grows at
ρ ≈ 7 regardless of spacing, and no realizable arrival gap (~60s+) could drain
it. AR1 (occupancy-keyed approach metering) was byte-inert on two fleet seeds
— its guard is pre-empted by the pack-speed discipline near ice — and is
KILLED on both counts: inert as built, and aimed at the wrong lever.
⇒ THE ONLY FLEET LEVER IS KEEPING THE FAST SERVICE ALIVE IN THE CROWD. RD3's
24.8s solo service dies in the fleet because the arc's queued-rival gate is a
flat "any parked rival within 400u" — the FIRST boat to park re-disables every
other boat's arc and the 63s service resurrects itself. RD6: the disable
narrows to its earned scope — a parked rival ON MY ORBIT (|its mark-radius −
my arcR| < 120u); a rival parked inside or outside my circle no longer kills
the arc. The m5 wedge lesson (165-189u zones, no room for two radii) behaves
the same by construction; the change binds only where the water admits
parallel orbits. Fleet 16-seed gate running — the day's last build.

## RD6 SET A — THE DAY'S BEST FLEET RESULT
Fleet 16@9100 (RD6 = RD3 + the narrowed queue-disable): paired med −1.0 /
mean −1.7, ALL 144 FINISH (the anchor loses one), boat 12.52→11.42 (−9%),
land 19.84→18.22 (−8%), floe 32.06→30.68 (−4%), pen 1.66→1.77; per-seed
fleet-median deltas med −4.5. One bad seed (9105 +174 — parallel-orbit
interaction under load) offset by 9109 −52, 9113 −34, 9115 −76. Strictly
better than RD3-alone on every column. Set B (the set that killed RD3) and
⚠️ redrock/bay 4-seed checks now decide — the "small zones behave identically"
claim is an ASSUMPTION, not a construction: RD6's |rQ − myR| < 120 test can
re-enable arcs at redrock's m5 where the wedge lesson was earned (a parked
rival within 400u of me but at a different mark-radius no longer disables).
If redrock is NOT byte-identical, the pooled protocol judges it there.

## RD7 FINAL — THE DAY'S BEST CANDIDATE, AND STILL NOT A LANDING
RD7 = RD3 (arc-in-floe) + the on-my-orbit queue test at zone ≥ 500.
Byte-gates: redrock 4-seed EXACTLY 0.0 (the wide-zone gate is a construction —
RD6's unscoped version had re-opened the m5 wedge at +75 paired med), bay
4-seed exactly 0.0, river inert by double construction (zone < 500 AND the
≥2kt current guard kills arcR there).
Arctic: set A paired −1.0 / mean −1.7, ALL 144 finish, boat −9% land −8%
floe −4%. Set B paired +3.0 / mean +9.1, boat +11% floe +7% (land better).
POOLED A+B: ≈ +1 paired med / +3.7 mean — flat clock, dirt mixed. The B seed
family punishes every variant of this family (RD3 alone: A flat, B +15) — a
now-repeated pattern worth naming: THE 9200 FLOE DRAWS ARE HOSTILE TO
ARC-BASED ROUNDING, and any future arctic candidate should treat A/B
disagreement as expected and judge pooled.
NOT LANDED (the dirt clause fails on B). RD7 (treeRD7, kept) is the
recommended BASE for the next push's arrival-layer work: its solo geometry is
right (406.7→55.8 on the worst draw), its fleet cost is bounded at flat, and
the remaining fleet loss is the coordination class every measurement now
points at.

## THE DAY'S FINAL LEDGER
18 builds (AC1, TK1-3, LANE1-2, CUR1/3, CST1, CC1, BH1, RD1-7, SG1, OP5, AR1),
0 landings, and the campaign's map is qualitatively different than this
morning: the arctic 2x is ATTRIBUTED (tack count → the rounding → service
time at the pile), the granite ring is priced (57s/boat, ~40s/occupant), the
fleet's arrival process is measured (already spread — service-bound), the
solo rounding geometry is FIXED in a kept tree, and the next push's design is
constrained by nine specific kills instead of open speculation. Behavior HEAD:
a393d61, untouched; all anchors carry; goldens PASS 20/20 (verified twice);
npm test: the one documented pre-existing river failure only.

## CLOSING VENUE TABLE (end of Aug 8 afternoon session; behavior HEAD a393d61,
## unchanged all day — every anchor carries by check: goldens PASS 20/20 ×2,
## npm test green except the documented river sailable case)
venue     | human med/best        | bot (anchors, unchanged)
bay       | 226.2 / 217.8, 0 impacts | 231 / 234 (bp2bayA/B), boat 1.39/2.11, mark 0.05/0.28, pen 0.28/0.40, OCS 0
ocean     | 182.5 (pre-gust-fix)  | 192 (bp2oc), boat 1.81, mark 0.36, pen 0.35
lake      | 223 / 209.6           | 275 / 276 (bp2lakeA/B), land 6.37/6.09, boat 1.98/3.09, mark 0.43/0.32
redrock   | ~227 / 206.6 (OLD, the benchmark) | 48-seed fins 396, pooled med 499, land 142.4, boat 19.97, mark 1.14, pen 3.83
arctic    | 212.1 / 190.4 (206.2 fresh clean) | 413 / 450 (p3v2arcA/B) — now FULLY ATTRIBUTED: rounding service time at granite (57s/boat), solo geometry FIXED in treeRD7 (406.7→55.8 worst draw), fleet flat pooled under RD7
seatrials | ~190 / 180.9 (193.8)  | 199.58 / 194.13, OCS 15.44%
river     | 161.3 best, n=2       | 264 / 271 (ff2rivA/B), fins 119/119
⚠️ LAKE LAND WATCH ITEM (its own line, standing): 6.37/6.09 vs pre-hard-zone
5.33/5.58 — open, unattributed; it killed BH1 today (6.37→16.09 under the
MEDIUM honesty candidate). Any lake-touching candidate reports this column.

## RD8 — THE LAST BUILD OF THE DAY, KILLED
Per-boat orbit-radius separation (boat.id-keyed ±40u at wide zones, aimed at
RD7's set-B rub failure): set B paired med +24.0 / mean +16.2, boat rubs
9.70→11.55 — UNCHANGED from RD7's failure mode. The separation did not touch
the target statistic; the B-set rubs are not parallel-orbit contact (or not
only), and the next diagnosis belongs to the arrival-layer push with proper
instrumentation rather than a twentieth same-day shape. KILLED; treeRD8
removed; RD7 remains the recommended base.
Nineteen builds. The day's verdict stands as written in the final ledger.

## TAIL-HOURS MEASUREMENT WAVE (machine idle after build 19; two directed
## measurements, no builds)
1. RD7's B-SET RUBS, LOCATED (`_rub_where.js`, new, tracked; hostile seeds
   9201-9202): 199 episodes — 77% ON LEG 1 (the beat), dRM med 1325u (well
   OUTSIDE the ring), 74% under 2.7kt at contact, 52% while armed (arming
   reaches 1277u, so "armed" spans the outer approach). The rubs are SLOW-BOAT
   TRAFFIC ON THE BEAT APPROACH, not the arc's rounding: the arc frees boats
   through the ring and on hostile draws they pack tighter upstream. RD8's
   orbit-separation was aimed at the wrong place — the arrival/laning class is
   the binding constraint, and this is its instrumentation baseline: the next
   push's candidate must be judged on LEG-1 approach rubs at dRM 900-1800u.
2. OP5's pooled protocol: sets 9500-9900 grinding in the background — the
   shelved candidate gets its rule-20 verdict on idle machine time.

## OP5, RE-OPENED BY THE POOLED PROTOCOL — THE GATE SLATE SO FAR
The idle-machine pooled run overturned the morning's one-set shelving (rule 20
in both directions: the +26 first set was noise, and so was the 3-set −13):
  redrock 5 sets pooled (9400/9500/9600/9800/9900): paired med +7.0 /
  mean −1.6 — CLOCK FLAT — with fins 329→332, boat −8%, mark −18%, land −8%,
  pen −9%: EVERY dirt column better and more finishers. Set 9700 pending.
  m3 stall gate: 13-14% → 9.1%. m5 (m4-index) gate, same seeds: HEAD 16/64 =
  25% → OP5 5/56 = 8.9% — the scoped ease COMPOSES where OP1+BP1 flooded the
  funnel (16→26%). OCEAN 8-seed: paired med −6.0 / mean −5.6 — the venue v1
  taxed +18 now GAINS (the dG<250 gate unhooked the zone-1000 arming).
  treeOP5H (the block on clean HEAD) verified byte-equal to the measured tree
  on redrock (34 deltas exactly 0.0).
Remaining: lake 20-seed (the +25% caution + the land watch item), set 9700,
bay 4-seed byte. If clean: LAND per the bp2oc precedent (flat clock, dirt
clearly better) — the day's first landing, and the m3/m5 stall classes with it.

## THE OP5 LANDING — THE DAY'S FIRST BEHAVIOR CHANGE (Aug 8, late afternoon)
The twice-shelved orbit-phase ease LANDED once every gate closed green. The
full slate, verbatim:
  REDROCK 6 sets pooled (9400-9900, 376 paired finishers): base med 498 →
  cand 494, paired med −1.0 / mean −4.7 (flat clock), fins 396→399, and
  EVERY dirt column better: boat 19.97→18.32 (−8%), mark 1.14→0.99 (−13%),
  land 142.38→130.98 (−8%), pen 3.83→3.47 (−9%).
  m3 stall gate: 13-14% → 9.1%. m5 same-seed: 25% → 8.9% (the scoped ease
  COMPOSES where OP1+BP1 flooded the funnel to 26%).
  OCEAN 8-seed: paired −6.0 / −5.6 — the venue v1 taxed +18 now GAINS
  (dG<250 unhooked the zone-1000 arming).
  LAKE 20-seed (the +25% caution venue + the standing land watch): paired
  med 0.0 / mean +1.7, p25=p75=0.0; land 6.37→6.45, boat 1.98→2.07 —
  within-noise, nothing like BH1's 6.37→16.09. PASS.
  BAY byte-identical (36 deltas 0.0). RIVER byte-identical vs ff2rivA
  (119 pairs 0.0, columns equal). ARCTIC byte-identical vs p3v2arcA
  (143 pairs 0.0). SEATRIALS byte-identical vs finseaid (36 pairs 0.0).
  The ease simply never fires on those four — wall-room/wind/orbitTightR
  gates hold, exactly as scoped.
  treeOP5H ≡ treeOP5 on redrock (34 deltas 0.0) — the block is the whole
  candidate.
LANDED: the OP5 block into regatta/js/script.js at the zG anchor (main now
byte-identical to treeOP5H's tree file). Goldens full --update then verify:
PASS — 20 traces, 0 behaviour changes vs the fresh recording.
NEW ANCHORS on this HEAD: redrock ocean_bench_op5rr{9400..9900} (pooled med
494, fins 399/432); ocean ocean_bench_op5hoc (paired −6.0 vs bp2oc); lake
ocean_bench_op5hlakeA (med 278, land 6.45 — the watch column moved +0.08,
recorded); bay/river/arctic/seatrials anchors CARRY byte-identical
(bp2bayA/B, ff2rivA/B + hd8rivC/D, p3v2arcA/B, eval_results 199.58/194.13).
The m3/m5 stall classes close with this landing: the orbit-phase ease at the
survey's scope (wall-room ≥100, wind ≥8kt, dG<250) was the missing shape,
and rule 20 was the missing protocol — one set said +26, three said −13,
six said flat-with-cleaner-dirt, and only the six-set read survived contact
with every other venue.

## CLOSING VENUE TABLE (Aug 8 EOD; behavior HEAD = the OP5 landing)
venue     | human med/best        | bot (current anchors)
bay       | 226.2 / 217.8, 0 impacts | 231 / 234 (bp2bayA/B, byte-carried), boat 1.39/2.11, pen 0.28/0.40, OCS 0
ocean     | 182.5 (pre-gust-fix)  | 186 (op5hoc, paired −6.0 vs bp2oc 192), boat 1.66, mark 0.29
lake      | 223 / 209.6           | 278 / 276 (op5hlakeA/bp2lakeB), land 6.45/6.09 (watch), boat 2.07/3.09
redrock   | ~227 / 206.6 (OLD, the benchmark) | 6-set pooled med 494 fins 399/432 (op5rr*), boat 18.32, mark 0.99, land 130.98, pen 3.47
arctic    | 212.1 / 190.4 (206.2 fresh clean) | 413 / 450 (p3v2arcA/B, byte-carried) — attributed: granite service time; treeRD7 holds the solo fix
seatrials | ~190 / 180.9 (193.8)  | 199.58 / 194.13, OCS 15.44% (byte-carried)
river     | 161.3 best, n=2       | 264 / 271 (ff2rivA/B, byte-carried), fins 119/119
⚠️ LAKE LAND WATCH: now 6.45/6.09 (was 6.37/6.09; pre-hard-zone 5.33/5.58) —
still open, still every lake-touching candidate's reported column.

## THE RD11 LANDING — THE ARC REACHES THE ICE (Aug 8, evening; the day's second)
The granite-rounding class (the biggest located class in the game, ~57s/boat/
rounding of parking) came home. RD11 = RD7's two edits rebuilt on the OP5
HEAD: (1) the arc rollout's openWaterAv gate removed — `if (arcR)` — so the
armed-rounding arc finally works in floe water (solo worst-draw at granite:
406.7 → 55.8s, the RD3 proof); (2) the queued-rival arc-disable narrowed AT
WIDE ZONES ONLY (≥500): a rival parks my arc only when within 120u of MY
orbit radius; small zones keep the flat 400u disable verbatim (the redrock
m5 wedge lesson, byte-identical by construction).
THE RE-ATTRIBUTION THAT UNBLOCKED IT: the set-B "+11% rubs" objection that
shelved RD7 dissolved under matched-population probes. First catch (NEW
STANDING RULE 18b): the original cross-tree probe compared neutral bots on
treeRD7 against FULL-CHARACTER bots on treeHD9 — the __CHAR flag silently
no-ops on trees that predate the machinery; the "start-scrum divergence at
t=1" was two different bot populations, provably impossible as behavior (no
boat arms before t=20). With matched bots (stat, the bench mirror): RD7
HALVES contact episodes on the hostile seeds (107→58, ring band 22→0) and
cuts contact FRAMES −31% (1476→1015); the only rising band is the outer
approach (the queue moves upstream and shrinks).
GATES: arctic 4-set grand pool (A 9100/B 9200 vs p3v2, C 9300/D 9400 vs
fresh HD10 pairs; 64 seeds, 563 paired finishers): med +1 / mean −2.2 —
FLAT — fins 567→570, boat 11.51→11.36, LAND 21.13→19.29 (−9%), floe
30.09→29.91, pen 1.78→1.81. Set verdicts A/B/C/D: −1.0/+3.0/+2.0/−6.0 med,
−1.7/+9.1/−7.8/−7.9 mean (both fresh sets mean-negative). OCEAN (the only
other venue with a zone≥500 mark): paired med 0.0/mean +0.5, boat rubs
2.07→1.50 (−28%). REDROCK/LAKE/BAY/RIVER/SEATRIALS: byte-inert verified
(paired 0.0 across all five, 4-seed each vs anchors).
LANDED: both edits into regatta/js/script.js (main byte-identical to
treeRD11). Goldens full --update + verify.
NEW ANCHORS: arctic fleet_leg2_rd11arc{A,B,C,D} (meds 426/447/427/446;
HEAD evidence hd10arc{C,D} 428/442) — the p3v2arc pair retires; ocean
ocean_bench_rd11oc (med 190, boat 1.50, paired 0.0 vs op5hoc). All other
venue anchors carry byte-identical (rd11*id proofs on file).
The fleet clock does NOT yet cash the 57s solo class — the jam physics
(86% of give-way slow ticks have no sailable escape) still gates the ring.
The arc-on-ice is the structural PREREQUISITE: the next arctic candidate
(the arrival/laning layer, judged on leg-1 approach rubs at dRM 900-1800u,
where RD11 moved the queue) now has something to compose with.

## FINAL VENUE TABLE (Aug 8 EOD; behavior HEAD `8146a8c` = OP5 + RD11)
venue     | human med/best        | bot (current anchors)
bay       | 226.2 / 217.8, 0 impacts | 231 / 234 (bp2bayA/B, byte-carried through both landings)
ocean     | 182.5 (pre-gust-fix)  | 190 (rd11oc; boat rubs 1.50, flat clock vs op5hoc 186 med — same races, med shifts with the 9307 draw)
lake      | 223 / 209.6           | 278 / 276 (op5hlakeA/bp2lakeB; land 6.45 watch)
redrock   | ~227 / 206.6 (OLD)    | 6-set pooled med 494, fins 399/432 (op5rr*; boat 18.32, land 130.98)
arctic    | 212.1 / 190.4         | 426 / 447 / 427 / 446 (rd11arcA-D; land −9% vs HEAD, fins 570/576; the ring jam is now the sole gate on the solo 57s class)
seatrials | ~190 / 180.9 (193.8)  | 199.58 / 194.13, OCS 15.44% (byte-carried)
river     | 161.3 best, n=2       | 264 / 271 (ff2rivA/B, byte-carried)

## THE FL1 LANDING — ICEBERGS ARE NOT CIRCLES (Aug 8, night; the day's third)
Owner-directed, verbatim: "Icebergs ARE NOT CIRCLES. They are moving,
rotating polygons with clear boundaries. My path planning as a human depends
on it and I could not navigate the course without that." And the ruling that
governs every future fidelity fix: an inaccurate understanding of reality is
not acceptable; behavioral trades get fixed downstream ON the accurate model
(recorded in memory: regatta-model-accuracy).
THE SIZING: 53%/51% of the far-field roll()'s floe contact flags were
PHANTOM (bounding circle hit, true rotated hull clear) — the bot dodged
water more often than ice. Trajectory corpus: the human's exit clearances to
the circle are routinely NEGATIVE (−24..−262u) while clean to the hull; her
rounding radius is bimodal (20 tight 261-340u / 5 wide 472-644u) and the
ring is usually ice-free — the choice reads the route through the field.
THE BUILD: per-floe radial profile of the convex localHull (32 bins, cached;
ray-cast per bin), point test rotates the query to the PREDICTED spin
(spin + spinRate·t) — O(1), unit-tested (square hull: face 100/corner 141.4,
rotation and spin-rate anticipation exact). The circle stays as broad phase;
+14 pad survives verbatim (it was always a HULL floor). One site this pass:
the far-field roll(). (Near-field FL1b — predicted-spin polys + dropping the
circle OR-fallbacks — and the grid's stale-spin stamping are the named
follow-ups.)
GATES: arctic 4-set pool vs the rd11 anchors (64 seeds, 567 pairs):
med −16 / mean −13.8 — THE LARGEST ARCTIC CLOCK GAIN OF THE CAMPAIGN — sets
A/B/C/D med +3/−9/−22/−41, fins 570→573, boat 11.36→8.47 (−25%), pen
1.81→1.52 (−16%), land/mark flat, floe 29.91→33.36 (+12%, the recorded
trade). Bay/redrock/lake/river/seatrials byte-inert verified (0.0).
⚠️ NEW HARNESS TRAP, found at the ocean gate: ocean_bench is NOT
run-reproducible on ocean — rd11oc vs rd11oc4 (SAME TREE, same seeds,
4-trial rerun) paired med 0.0 but p25 −11/p75 +12. FL1's ocean "−6" sits
inside that null band and FL1 is inert there by construction (zero floes;
guarded path). Consequences: (1) ocean byte-gates cannot be run at byte
resolution until the nondeterminism is found (goldens still pass — it is
bench-page-specific, not sim-specific); (2) OP5's ocean −6.0 paired claim
is SOFTER than recorded this morning — hold it loosely. Investigation
queued.
LANDED: main byte-identical to treeFL1; goldens full --update + PASS.
NEW ANCHORS: arctic fleet_leg2_fl1arc{A,B,C,D} meds 429/448/408/402
(rd11arc* retire to paired evidence). All other venues carry.

## THE FL1b LANDING — THE NEAR FIELD SEES THE TRUE HULL (Aug 8, night; the
## day's FOURTH landing, and the campaign's largest)
FL1's sibling, one hour later: the near-field wall test's floe branches move
to the same true-hull-at-predicted-spin model (floeSegNear: 9-sample segment
test; floeHullClear: radial clearance for the proximity buffer — the band
keeps its size, it starts at the REAL edge). The circle OR-fallbacks — which
re-added the exact phantom band FL1 removed from the far field — are gone.
Land branches byte-untouched.
GATES (vs the hours-old fl1arc anchors, 64 seeds, 573 pairs):
  A −47.0/−55.4, B −45.0/−61.4 (the HOSTILE family gains most, fins 141→144),
  C −36.0/−33.0, D −32.0/−32.9 — GRAND POOL med −37 / mean −45.6, 68%
  negative, fins 573→576 (ALL boats in ALL 64 races finish), boat 8.47→5.06
  (−40%), land 19.16→12.73 (−34%), floe 33.36→24.66 (−26% — FL1's +12% trade
  REVERSED and then some), pen 1.52→1.14 (−25%), mark flat.
  Bay/redrock/river/lake/seatrials byte-inert verified (0.0 all five).
  Ocean byte-gate remains suspended (the nondeterminism trap); FL1b is inert
  there by the same construction as FL1 (zero floes, floe-branch-only edits).
ARCTIC MEDS: 429/448/408/402 → 379/386/371/367. This morning the anchor pair
was 413/450. Human med 212.1 — the ratio moved from ~2.0x to ~1.77x in one
evening, all of it from making the planner see the world the physics runs.
The day's arc, in one line: the arc reaches the ice (RD11), the ice becomes
its true shape (FL1), and the whole near field follows (FL1b).
NEW ANCHORS: fleet_leg2_fl1barc{A,B,C,D} 379/386/371/367 (fl1arc* retire to
paired evidence). Everything else carries.

## FINAL VENUE TABLE (Aug 8 EOD; behavior HEAD `b33d491` = OP5 + RD11 + FL1 + FL1b)
venue     | human med/best        | bot (current anchors)
bay       | 226.2 / 217.8, 0 impacts | 231 / 234 (byte-carried through all four landings)
ocean     | 182.5 (pre-gust-fix)  | 190 (rd11oc; ⚠️ ocean bench nondeterminism found — clock claims on ocean held loosely until fixed)
lake      | 223 / 209.6           | 278 / 276 (byte-carried; land 6.45 watch)
redrock   | ~227 / 206.6 (OLD)    | 6-set pooled med 494, fins 399/432 (byte-carried since OP5)
arctic    | 212.1 / 190.4         | **379 / 386 / 371 / 367** (fl1barcA-D; was 413/450 at dawn — boat 5.06, land 12.73, floe 24.66, pen 1.14, ALL boats finish)
seatrials | ~190 / 180.9 (193.8)  | 199.58 / 194.13 (byte-carried)
river     | 161.3 best, n=2       | 264 / 271 (byte-carried)
The gap ranking after today: river 1.64x, arctic ~1.77x (was 2.0x), redrock
~2.2x (OLD course), lake 1.25x, seatrials 1.05x, bay 1.02x, ocean ~1.04x.
Next push (committed follow-ups): grid stale-spin stamping + rounding radius
selection (arctic), router current pricing (river, owner-directed P1),
floe-grind buffer calibration, ocean-bench nondeterminism hunt, FL1-class
fidelity audit on wind/current fields.

## NEXT-PUSH DIRECTIVE (authored Aug 8 EOD, owner-directed): THE FIDELITY AUDIT
## "What other approximations are causing inaccurate planning?"
The method that produced today's arctic wins, made systematic: (1) find a
site where the planner's model diverges from the physics; (2) SIZE it with
an instrumented dual-count probe (the FL1 phantom-rate pattern) AND a
human-vs-bot trajectory comparison; (3) build the true model at the same
big-O; (4) gate pooled 4-set + byte-inertness. Fidelity fixes land on sane
clock gates even with behavioral trades (the model-accuracy ruling).

THE AUDITED INVENTORY (all verified in code tonight):

A. THE ROLLOUT PRICES A FICTIONAL BOAT (far-field roll(); every tick, every
   bot, every venue — the hottest planning path in the game):
   - CONSTANT SPEED for all 13 candidate headings across all 12 steps
     (speedU = max(70, current speed)): a candidate that turns through irons
     is priced at full pace; acceleration invisible; polar invisible.
   - NO WIND FIELD along the path: gust regions, lulls, island shadow
     plumes (shadowAt — the physics wind field includes them), and rival
     DIRTY AIR (450u boat shadows, width 20→100) are all invisible to the
     candidate scorer.
   - NO CURRENT displacement of own hull (floes get drift-projected; the
     boat itself does not).
   Sizing probes: (a) rollout-predicted vs realized position/speed at each
   step (dual-count in a measurement tree); (b) corpus: human time-in-shadow
   (shadowAt<1) and time-in-dirty-air per leg vs bot.

B. THE ROUTER PRICES A GEOMETRIC WORLD (pathSailable: verified tonight —
   distance + wall-clearance edge weights ONLY). No current (the standing
   owner P1; river's 22% moving deficit ≈ 46s+), no wind-speed field, no
   shadow plumes. Build: per-edge ground-VMG factor from the current vector
   + wind-speed factor at the cell. ONE FIELD PER GATE, current first
   (already sized), wind second.

C. DIRTY AIR IS REACTIVE, NOT PLANNED: physics carves a 450u shadow behind
   every boat; the bot's ONLY use of it is a tack-escape penalty once
   already suffering (badAirIntensity > 0.15 → ±0.6 tack score). No lane
   choice, no shadow avoidance in the rollout, no covering intent beyond
   the leech heuristics. Her gw-ledger signature (rivals deflect 35-60° at
   CPA where she does 13-23°) reads as planned clean lanes. Probe: fraction
   of upwind time in another boat's shadow, human vs bot, all venues.

D. THE BOAT IS A POINT WITH PADS: physics hull = oriented 30u-beam ×
   55u-LOA polygon (HULL_LOCALS, SAT collision); planning uses center
   distances against scalar thresholds (110u rule-19 gap, 400u parked-rival,
   grid cells at res 50). Orientation matters exactly where the campaign
   hurts: threading (bow-on needs 30u, beam-on 55u), wedges, mark-room.
   Probes: human minimum-pass-gap distribution vs bot refusal threshold;
   contact-pose audit (what orientation do boats hold at rub time?).

E. CARRYOVERS (named, unsized or part-sized): grid stale-spin stamping
   (rims sweep ~30 u/s between refreshes); rounding RADIUS SELECTION (her
   bimodal 261-340/472-644 choice reads the exit route; bots take arrival
   radius); floe-grind buffer calibration ON the true hull; ocean-bench
   nondeterminism hunt (INFRASTRUCTURE — blocks ocean gates; suspect
   cross-trial page state, the camera-RNG class).

ORDER: probe wave first (A/C/D sizings + B is pre-sized), then build in
measured-size order. Prior expectation from today: A and B are the
arctic/river-scale candidates; C is the fleet-racing dark matter.
CONSTRAINTS CARRIED: closed families stay closed (⛔ list); actions-not-
prices; arctic judged pooled 4-set vs fl1barc*; river pooled fins/med;
96-seed redrock protocol near threshold; bench pairs together; goldens
full --update per landing; venue table at close.

## OPENING PROMPT FOR THE NEXT SESSION (paste-ready, authored Aug 8 EOD)
THE FIDELITY PUSH. Goal unchanged: human or superhuman on bay, ocean,
redrock, lake, arctic, seatrials. Open with memory regatta-fidelity-audit +
the NEXT-PUSH DIRECTIVE above; behavior HEAD b33d491 (OP5+RD11+FL1+FL1b;
arctic anchors fl1barc{A-D} 379/386/371/367). Method: find planner-vs-
physics divergence -> size it (dual-count probe + human-vs-bot corpus) ->
build the true model at the same cost -> gate pooled. Model-accuracy ruling
applies: fidelity fixes land on sane clock gates; trades become follow-up
knobs ON the accurate model. Work A (rollout's fictional boat — treeSZA/
_sza_run.js counters exist; extend to the near-field loop, the all-venue
path), B (geometric router — current first, pre-sized ~46s river; wind
second; one field per gate), C (dirty air reactive-only — human baselines
_windtime.js/corpus: arctic 21%, bay 8%, lake 30% below 80% lap-median
wind), D (point-boat vs oriented 30x55 hull — size pass-gaps first), E
(stale spin, radius selection, grind buffer, OCEAN-BENCH NONDETERMINISM
HUNT — ocean gates suspended until found). Constraints: closed families
closed; actions-not-prices; arctic pooled 4-set vs fl1barc*; river pooled
fins/med; 96-seed redrock; bench pairs together; goldens full --update;
probe audits (18/18b/19b); close with the venue table.

## SIZING WAVE RESULTS (Aug 8, late night — the fidelity push's opening numbers)
A. ROLLOUT SPEED MODEL — THE CANDIDATE: 20-21% of all chosen-rollout steps
   on arctic price the boat at >1.67x its polar (getTargetSpeed at the
   step's TWA/wind vs the constant speedU). The rollout scores irons-
   crossing candidates at full pace — the mechanical link to the standing
   TACK-COUNT class (bots 21-23 tacks vs her 5: if turning through the wind
   is free, the argmin over-tacks). Build design: per-step speed integration
   v += clamp(polarTarget(TWA,wind) − v, accel limits) replacing constant
   speedU; sample wind at 2-3 waypoints, not per step, if perf demands.
   (polar/assumed MEAN is 1.16-1.22 — on average the boat could go FASTER
   than assumed off the wind; the fiction cuts both ways: it also
   underprices bearing-away escapes.)
A-wind. Rollout wind-blindness: 1-2% of steps see >20% wind deficit vs
   at-boat; |dDir| 0.02-0.03 rad — SMALL at the 9s rollout scale. The wind
   field matters at router/strategic scale, not the dodger. Down-rank.
C. DIRTY AIR / SHADOW TIME — MEASURED DEAD: time below 80% of own-lap
   median wind, human vs bot: bay 8% vs 6%, arctic 21% vs 11% (the HUMAN
   tolerates lulls MORE — route quality over clearance, again), lake 30%
   vs 27% (same). Bot dirty-air ticks ~3-5%. The bots are NOT losing their
   gap sitting in bad air. ⛔ Deprioritize C; do not build lane-planning on
   this evidence.
B. Router current: stands pre-sized (~46s river). D: unsized, next session.
REVISED ORDER FOR THE PUSH: A speed model (arctic + everywhere the far
field runs) → B current pricing (river) → D sizing → E carryovers.

## SESSION 2026-08-08 NIGHT — THE FIDELITY PUSH: THREE FAMILIES CLOSED, THE OCEAN CLOCK CURED
Behavior HEAD entering: b33d491. The sized order (A speed → B current → D point-boat → E carryovers) was worked in full; the landing came from E.

### A. ROLLOUT SPEED FICTION — CLOSED at two shapes (rule 1 vindicated)
SZ1 (per-step polar integration, physics constants 0.9970/0.9982 + irons brake,
wind once at boat): arctic pooled 4-set vs fl1barc* paired med −9 / mean −9.3
(sets −19/+2/−16/−6), fins 576→575, EVERY dirt column worse (boat +29%, floe
+7%, land +5%, pen +8%). Autopsy: the fictional constant speed was silently
providing ANTICIPATION DISTANCE — honest time shrank the scanned water, the
4.5s trigger fired later, the reactive layer inherited the trouble.
SZ1b (honest speed, SPATIAL horizon: scan span/trigger/penalty ramps in
distance matched to the stock 9s×max(70,v) water): pooled med −2 / mean −2.4,
fins 576/576, dirt still slightly worse (boat +7%, pen +6%). NOT landed.
Mechanism check: solo tacks (\_arc_dist 4 seeds) FL1B 14/30/47/26 → SZ1
26/25/42/14 — mild reduction, heroes faster 3/4, but the fleet pays in
contacts. The tack-count class does NOT live in the dodger's pricing: the
rollout only steers near floes, and its surrounding constants (contactW, the
4.5s trigger, speed discipline's \_trajRisk consumers) are all calibrated TO
the fiction. Re-pricing without changing which actions exist lost again —
seven-for-seven becomes nine-for-nine (SZ1, SZ1b). ⛔ Do not rebuild rollout
speed honesty as pricing; if the tack-count class is ever re-attacked, it must
change WHICH candidates exist at the strategic layer.

### B. ROUTER CURRENT PRICING — CLOSED at shapes 3 & 4 (execution class, not map class)
CUR1 (per-cell current stamp + ground-VMG on pathSailable's time cost,
admissible heuristic): river A med −1 / B −7 BUT fins 238→233, land +10% — a
digit-for-digit REPLICATION of the midday symmetric kill. CUR2 (the "bank
grind" answer: current term × clamp(clear/PAD,0,1), banks price stock): WORSE
— fins 238→226, set-A land mean +105. The lure is not the banks' current
price: pricing the adverse mid-channel jet honestly makes bank water
RELATIVELY cheap no matter how the banks are priced, and the boat cannot
execute bank water (trap 17: route pricing cannot reach displacement-driven
failures). ⛔ Router current pricing closed at four total shapes. The river's
22% moving deficit is an EXECUTION-layer class (deflection + set near banks),
not a routing class. Code reverted; probes _cur1_audit.js tracked.

### D. POINT-BOAT — MEASURED, NO BUILD (the cheap close SIZE-FIRST exists for)
Human min-pass-gap (schema-2 corpus, _d_passgap.py): arctic p10 62/p50 268,
20% inside the 110u rule-19 gap, parked rivals passed at p50 189 (67% inside
the 400u refusal); redrock p50 210, parked p50 122. BUT the bot mirror
(_d_botgap.js, treeFL1B) shows the fleet's REALIZED gaps already match her:
arctic p10 65/p50 246/<110u 22%; redrock p10 61/p50 224/<110u 28%. The scalar
thresholds are not refusing passes the human takes. The dirt is contact POSE:
3756 arctic contacts in 3 seeds at |relHdg| med 104°, 60% with both boats
<1kt — the parked-raft ring jam, which belongs to the ARRIVAL/LANING thread.
⛔ Do not build oriented-hull planning on this evidence.

### E. THE LANDING — OCEAN-BENCH NONDETERMINISM FOUND AND CURED (swell.js TIME)
The hunt (all probes tracked): same tree/seed diverges across fresh pages,
sometimes byte-equal, usually not; initial post-reset state byte-identical;
divergence born at FRAME 0, all boats at once, RNG cursor EQUAL (the leak is
a field, not the stream); asset-decode wait no effect; islandWindDir cache
bypass no effect; bay 600 frames byte-identical across pages (non-swell
venues immune — why arctic's 0.0 stamps were always exact).
ROOT CAUSE: swell.js module clock `let TIME = 0` was NEVER reset —
configure() re-arms TRAINS/CFG/POWER/AMP_TOTAL but not TIME. It accrued
across wall-clock-dependent menu frames before the harness hooks the loop and
across every race in a page: the sea's phase at the gun was a function of
page-load timing and trial history. THE FIX (one physical line): TIME = 0 in
configure().
GATES: two 16-seed ocean bench runs BYTE-EQUAL (reproducibility restored);
clock flat-to-better vs same-day HEAD reference (fl1boc med 193/mean 200.0 →
swtocA med 190/mean 191.6, 144/144 both, boat 1.99→1.76, mark 0.27→0.08, pen
0.40→0.33); goldens PASS 20/20 with ZERO behaviour changes (trace harness
races already ran at phase zero); non-swell venues byte-inert by construction
(every TIME reader gated on TRAINS.length). OCEAN BYTE-GATES UN-SUSPENDED.
New ocean anchor: ocean_bench_swtocA (16@9300, med 190, fins 144/144) — the
rd11oc-era anchors predate deterministic seas; never compare across this cut.

### CLOSING VENUE TABLE (final HEAD 016674e, frozen venues, med s/boat)
| venue     | human (med/best) | pre-session bot (b33d491)      | post-session bot (016674e)                  |
|-----------|------------------|--------------------------------|---------------------------------------------|
| bay       | 226.2 / 217.8    | 231 / 234 (bp2bayA/B)          | byte-identical (no behavior change)          |
| ocean     | 182.5 (pre-gust) | 190 (rd11oc, NONDETERMINISTIC) | **190 (swtocA, DETERMINISTIC — byte-equal reruns; 144/144, boat 1.76, mark 0.08, pen 0.33)** |
| redrock   | ~227 / 206.6 (OLD)| pooled med 494, fins 399/432  | byte-identical                               |
| lake      | 223 / 209.6      | 278 (op5hlakeA), land 6.45 watch| byte-identical                              |
| arctic    | 212.1 / 190.4    | 379/386/371/367 (fl1barcA-D)   | byte-identical                               |
| seatrials | ~190 / 180.9     | 199.58 / 194.13                | byte-identical                               |
| river     | 161.3 (n=2)      | 264 / 271 (ff2rivA/B)          | byte-identical                               |
The landing is infrastructure + ocean determinism: the only behavior delta is the
ocean sea starting at phase zero (clock flat-to-better). All other venues carry
b33d491 anchors verbatim — the swell fix is unreachable without trains.

## SESSION 2026-08-08 LATE NIGHT — ARCTIC: TWO SIZINGS CLOSE TWO SHAPES, THE CONVEYOR NAMED
### Radius selection — DEAD AT SIZING (_arc_radius.py, tracked)
Human and bot rounding-radius distributions are IDENTICAL (med 301 vs 308,
n=26/17, both with wide tails); no ice-in-band correlation in either mode; no
radius→outcome correlation at a FIXED 1000u reference (tight 36.4s vs wide
40.4s). The FL1 "bimodal 261-340/472-644" was substantially a 600u-window
truncation artifact (rule 19b's third catch — two of the five wide events
re-measure tight at the fixed ring). The bot's rounding loss is ~24s AT THE
SAME RADIUS she sails (59.7 vs 36.4s tight-mode med) — service/jam time, not
geometry. ⛔ Do not build radius selection.
### The arrival/laning family — closed at two shapes, mechanism NAMED
THE CONVEYOR: the entrance hunt sectors per boat, but every approaching boat
rides the SAME ring (zone*1.35 = 1149u at granite) the same way round — the
rub band (dRM med 1355u, 78% under 2.7kt, HEAD baseline 255 episodes/2 hostile
seeds, 108 within 900u) sits exactly on it, and the human's band time is pure
transit (15.4s med, 0.0s slow, 26 laps; bots 30.7s med, slow tails to 97s).
AL1 (occupancy-keyed wide ride zone*1.7 past a parked plug, latched, wide
zones only): ring rubs −59% (108→44), band emptied (dRM med 1355→5099), clock
FLAT (pooled med 0/mean −4.0) — but bounds +103%, boat +12%: the wide water
isn't free. AL2 (+sailable-water and 300u-arena-depth guards on the wide
lane; caught a signedDist sign inversion pre-ship — POSITIVE INSIDE): damage
halved (bounds +22%, boat +6%), mechanism holds (in-ring −44%), clock still
flat (med 0/mean −1.6, 576/576) — dirt clause fails, NOT landed.
THE ARITHMETIC THAT CLOSES IT: in-band slow time is only 4-8s/boat mean
(_band_time.js, tracked) — the band is damage-dirt, not a clock reservoir;
relocating the queue trades rubs ~1:1 into wide-water contacts. Ocean gate on
AL1: the campaign's FIRST EXACT 0.00 ocean byte-gate (deterministic seas paying
off same-day). Redrock byte-equal verified. treeAL2 kept.
ARCTIC RESIDUAL now attributes to: the TACK-COUNT class (strategic layer,
3 shapes dead, needs a which-actions shape) + physical jam (relocation
doesn't pay). Next venue per owner order: REDROCK attribution.

## REDROCK ATTRIBUTION + THE RR LADDER (2026-08-08, late night — the class FOUND)
### The attribution chain (one evening, probes tracked)
_rr_where2.js: slow time 176.5 s/boat of the 267 s/boat gap; L3:shore 68.7 +
L3:m4 25.9 s/boat; leg-3 med 140.8s vs her 51.3; land episodes 721 shore/216
m4. _redrock_solo on HEAD: solo blowups 537/516 on 2 of 4 draws, 269-339s on
LEG 3 at (−300..0, 900..1200). _rr_why.js: 109.4 s/boat slow near mark-5,
89% NE pocket, 72% LAND DEAD AHEAD, 49% inside WIGGLE, 21% irons, 20% penalty
turns, **armed 0%** — unarmed mid-leg transit, NOT the OP5 orbit class. Human
mirror: 20-28s through the same water, ZERO slow (8 laps) — HUMAN-ZERO class.
_rr_trace.js (solo 9402): the router's L3 path is CLEAN (threads NW of the
land finger, arcs the mark at ~90u); the boat arrives 150-200u EAST of the
line, hits the finger face at full speed (111 u/s → 0 in 2s at (63,1097)),
then churns 100+s in a 300u pocket: wiggle frees it, the strategic layer
re-aims through the wall, avoidance re-sticks it.
### ROOT CAUSE (in the pure-pursuit follower, script.js ~1866)
The clearance-scaled lookahead exists because "a far carrot in a narrows cuts
the corner into the ice" — but the UPWIND MINIMUM (LOOK=420, the tack-loop
cure) OVERRIDES it unconditionally. Leg 3 is the upwind leg: in the canyon
the floor wins, the carrot lands past the bend, and pure pursuit drives the
straight line into the wall face. The two rules conflict exactly in an upwind
narrows.
### The ladder (treeRR1-4; solo seeds 9400-9403, HEAD 319/396/537/516 mean 442)
- RR1 (420 floor only if straight LOS to the floor carrot): solo 378/353/382/
  399 — 9402's pocket 339→68s, but 9400 +59 (walled carrot → tack-loop).
- RR2 (farthest VISIBLE point along path, ≤420): solo 403/345/311/339 — cure
  deepens (9402 −226, 9403 −177) but the clean draw pays (9400 319→403).
- RR3 (RR2 scoped to nosedIn — the near-reversal fan's own gate): solo
  280/338/328/339, EVERY seed better, mean −121 s/boat, L3 pocket ERASED.
  Fleet 6-set pooled: med +14.0/mean +11.8, per-set +48..−22 — traffic pins
  (nosedIn in crowds, the m5 funnel) inherit the shrunken carrot.
- RR4 (RR3 + solo-pinned only: no rival within 300u): solo byte-identical to
  RR3 (cure preserved by construction). Fleet 6-set pooled: med +7.0/mean
  +0.9, fins 399→397, boat +8% — NEAR-THRESHOLD, not landable tonight.
### Verdict + the parked candidate
The class is FOUND, ATTRIBUTED, SOLO-CURED (−121 s/boat, the biggest solo
delta since the granite arc). Four scopes have not made the fleet cash it —
the granite-arc signature (RD3 solo 406→56, fleet flat, later landed as RD11
flat-with-cleaner-dirt). RR4 sits at med +7 inside the ±8-10 pooled noise
band: per the standing rule it gets the 96-SEED PROTOCOL (12 disjoint sets
incl. 6 fresh-seed HEAD-vs-candidate pairs) as the NEXT SESSION'S opening
run. treeRR4 kept; working tree reverted; probes _rr_where2/_rr_why/_rr_trace
tracked. If the protocol lands it, the follow-up is the traffic diagnosis
(why freed boats pay in the crowd); if not, the ladder closes at four shapes
with the mechanism named.

## NEXT-PUSH DIRECTIVE (authored Aug 8 close, owner-approved): THE RE-VERDICT PUSH
## "With better information, some discarded techniques may perform better."
The reopen principle, applied to the full ⛔ list: a kill is reopenable ONLY
when its evidence was produced by the false world model (pre-FL1/FL1b arctic
= 53% phantom floe flags) or by a bench below today's resolution rules
(8-seed arctic/redrock reads), AND the kill was not a model-independent
mechanism (Freezing-Robot, route-length tax, trap-17 displacement, drift
physics). Three candidates pass the filter; everything else stays closed —
including everything killed THIS session on the accurate model.

P0 — RR4, THE 96-SEED DECISION RUN (redrock mark-5 canyon; treeRR4 kept).
  Existing evidence: 6 sets op5rr↔rr4rr (pooled med +7.0/mean +0.9 — inside
  the ±8-10 noise band). Run the OTHER HALF of the protocol: 6 FRESH sets
  (8400..8900, 8 seeds each) on BOTH trees — treeSWT (byte-matches behavior
  HEAD 016674e) and treeRR4 — then pool ALL TWELVE sets with _pool_rr.js
  (explicit set lists). Landing bar: pooled clearly negative with dirt clean;
  near-threshold again → the ladder CLOSES at four shapes, mechanism named
  (the canyon class survives as attribution for a future traffic-side shape).
  If it lands: cross-venue gates (arctic pooled 4-set vs fl1barc*, lake
  20@9100 vs op5hlakeA, bay 20-seed pair, river pooled fins/med vs ff2riv*,
  ocean 16@9300 vs swtocA — EXACT gate now, seatrials id), goldens FULL
  --update, session log, venue table.

P1 — LANE1 REBUILD + RE-BENCH (the tack-cost router; the strongest reopen).
  The only which-actions shape ever aimed at the ~150s/boat arctic TACK-COUNT
  class, killed at 8 SEEDS (below rule-12 resolution) PRE-FL1 (phantom-flag
  world) — both evidence legs stale. Rebuild from this file's "LANE1 — the
  state is (cell, how you arrived)" section (~line 10068) onto current HEAD;
  trees are gone, the design is documented. Scope as originally built; verify
  byte-inertness on non-floe venues by construction + one bench. Gate: arctic
  pooled 4-set vs fl1barc* WITH the tack instrument (_arc_dist 4-seed
  alongside — the mechanism must move: tacks toward her 5, not just clock).
  LANE2 (board-following steering) only if LANE1 alone is flat-with-mechanism.

P2 — THE FAN UNGATE ON GLACIER SOUND (the cheapest re-verdict).
  The densified avoidance fan is gated off floe venues by an EXPLICIT
  conservatism, not a mechanism kill (script.js ~2831: "four 16-seed sets
  could not tell it from zero... do not move a marginal venue") — and both
  premises are gone: arctic finishes 576/576 (was ~8% DNF) and the candidate
  scorer now tests true hulls. One-line ungate (extend the dense list where
  floes exist; ⚠️ KEEP racingLegF — start tuning is sacred, the 4.4-point
  OCS lesson). Gate: arctic pooled 4-set vs fl1barc*.
  ⚠️ P1 and P2 both touch arctic: gate each SEPARATELY on its own tree; if
  both pass, gate the COMPOSED tree before landing either (the OP1+BP1
  anti-composition lesson).

P3 — RIVER EXECUTION SIZING (probe-only, runs while benches grind).
  Four dead current-pricing shapes narrowed the river's 22% moving deficit to
  EXECUTION: boats displaced into bank water by deflection + 5kt set, where
  route pricing provably cannot reach (trap 17). Probe the corpus (37 river
  encounters + full laps): her behavior at displacement onset near banks —
  crab angle vs track, bear-away timing, commitment distance — vs the bot
  response layer's at the same geometry (live probe, displaced-episode
  detection). NAME the behavioral difference; no build without a named class.

P4 — CONDITIONAL: curved small candidates on redrock, ONLY after P0
  resolves. Their redrock +35 kill was measured midday on a venue whose
  dominant failure (the canyon carrot bug) corrupted exactly the pinned-state
  steering a curved probe models. If RR4 lands, re-test curved on the
  post-RR4 tree (river win −6 stands waiting).

STAYS CLOSED (re-affirmed at this directive, model-independent): station-
keeping/holds/commitment/reservation (Freezing-Robot); SIPP + map staleness
(drift physics); closing-lead pricing, occupancy stamps, current pricing ×4
(route-length tax + trap-17); clearance-extension ×2 (tack-count
re-attribution supersedes); everything killed Aug 8 night on the accurate
model (rollout speed ×2, point-boat, radius selection, wide-ride ×2).

CONSTRAINTS CARRIED: closed families stay closed except the three named
reopens; actions-not-prices; arctic pooled 4-set vs fl1barc*; river pooled
fins/med; redrock 96-seed protocol for near-threshold; bench pairs together;
probe audits (18/18b/19b/19c); freeze_venues --check from repo root; check
date; goldens full --update per landing; close with the venue table.
OWNER ASKS (standing): fresh laps bay/lake/OLD-redrock; post-gust-fix OCEAN
lap (the 182.5 ref predates the fix — ocean's true ratio is unknown);
NEW-redrock schema-2 laps for the promotion decision.

## OPENING PROMPT (paste-ready)
THE RE-VERDICT PUSH. Goal unchanged: human or superhuman on bay, ocean,
redrock, lake, arctic, seatrials. Open with memory regatta-redrock-canyon +
the RE-VERDICT DIRECTIVE at the bottom of ai-campaign.md. Behavior HEAD
016674e (swell-clock); repo HEAD carries the directive. Work P0 (RR4 96-seed
decision: 6 fresh sets 8400..8900 on treeSWT AND treeRR4, pool all 12),
P1 (LANE1 rebuild from the documented design, arctic 4-set + tack
instrument), P2 (fan ungate one-liner, arctic 4-set; compose-gate with P1 if
both pass), P3 (river execution sizing, probe-only), P4 conditional (curved
on redrock post-P0). Reopen principle: stale evidence only (pre-FL1 model or
sub-resolution benches); model-independent kills stay closed. Constraints:
bench pairs together, actions-not-prices, probe audits, goldens full
--update, venue table at close.

## LAGOON ARRIVES (owner drop ae21f2e, Aug 8 ~22:00) — FIRST LOOK + FIRST LAPS
The merge: lagoon venue (5 marks, 7 legs, 29 island shapes, 10 current
regions) + SQUALLS (a new wind mechanic: seeded marching gust cells with a
+front, a core, a dead-air WAKE trap and veer, entering through getWindAt —
"duck the rain or ride it") + seabed/drifting props + river/redrock/swamp
venue edits. ⚠️ SHIPPING RIVER CHANGED (0cd21eb6 vs frozen 2520b114) — the
frozen benchmark river stands per the freeze policy, same as redrock.
HUMAN REFS (3 schema-2 laps, corpus + gw-ledger same-day): 154.0 best /
160.6 med / 162.6. The give-way underlay reproduces on lagoon exactly (73
encounters: rival onset ~557-579u in 91-97%, rivals 31-55° med at CPA vs her
11-15° as give-way, ucpa≥80u in 94%) — seventh venue, same signature.
BOT FIRST-LOOK (treeLAG on merge HEAD, 8 seeds, shipping venue): med 237 /
mean 239.6, 71/72 finish — RATIO ~1.48x. Dirt: LAND 42.3/boat (the coral
maze is the visible class; cf. lake 6.45, redrock 131), boat 4.19, pen 0.83.
NEW CAPABILITY GAP (unsized): SQUALL-AWARENESS. The AI reads wind at-boat
only; squalls are strategic-scale MOVING features, and the router's wbin
field stamps them once at grid-build — a squall-stale routing field by
construction. The human mechanic (duck/ride/avoid-the-wake) is planned
interaction with a moving feature. Size before building: time-in-wake and
front-riding, human vs bot, from the corpus + a live probe.
DIRECTIVE ADDENDUM: P0-P4 stand (pre-merge trees stay internally valid for
P0; any landing PORTS to merge HEAD). Lagoon enters the venue table; its
push waits for the re-verdict queue unless the owner reprioritizes.

## THE CP1 LANDING (Aug 8 lagoon night): THE GRID SEES THE CORAL TEETH
Owner-observed: bots don't avoid coral heads. Audited all four new object
types: coral reef = wall ✓, shoals = priced ✓, shallows/seagrass = free ✓ —
but CORAL HEADS (hard contact props) were invisible to the bot grid: the
compile emits hidden colliders into the COMPILED islands ("the router meets
them as ordinary shapes"), while the grid builds from the RAW document's
shapes — 32 of 37 corals blocked ZERO grid cells while physics stopped boats
dead (probe _lag_corals.js). The model-accuracy ruling applies verbatim.
THE FIX (CP1): the grid callsite appends hard fixed prop colliders — the
same 12-gon at the same scaled contactR the compile emits. Soft props stay
priced via the shoal field (compiled islands), by the awash rule.
GATES: corals 32→0 zero-blocked; lagoon 8-seed paired vs same-day baseline:
med −18 / mean −21.0, ALL 72 finish, LAND 42.28→3.78/boat (−91%), boat −26%,
pen −23%, med 237→217 (human 160.6 → ratio 1.48x→1.35x in one fix); ocean
16-seed BYTE-EQUAL through merge+CP1 (propless venues inert by construction,
verified empirically); goldens: ONLY the two lagoon traces moved, full
--update re-recorded.
ALSO RECORDED: the owner's TACTICAL DOCTRINE (memory:
regatta-tactical-doctrine) — ROW sails its course with last-minute-but-
sufficient avoidance; give-way yields modestly; offensive rule-legal tactics
WANTED (tack-to-cover onto starboard with RRS-16 room; a rival that fails to
respond takes the foul). ROW deflection target = her 11-23° profile. A
future push family; composes with the gw-underlay baselines. Squalls are
LAGOON-UNIQUE (owner) — squall-awareness stays a lagoon-scoped capability
gap (unsized; the router's wbin stamps squalls stale by construction).

## NEXT-PUSH DIRECTIVE (authored Aug 8 lagoon-night close, owner-directed):
## THE SECTION PUSH — biggest gains, biggest venues, shortest sections
Owner: "big gains prioritized to the venues with the biggest gaps... pointed
at the sections and parts of a course where the bots fall shortest." He
records new trajectories while this runs.

THE SECTION-GAP MATRIX (behavior HEAD b1347de, what is already known):
| venue   | ratio | worst section, bot vs human                      | state |
| redrock | 2.18x | LEG 3: 140.8 vs 51.3 (+89 s/boat, mark-5 canyon) | RR4 solo-cures −121; parked at 96-seed |
| arctic  | 1.77x | LEG 1 (the beat): tacks 21-23 vs 5 (~150s class) | 3 shapes dead; LANE1 reopen queued |
| river   | 1.66x | L2 65.5s bot; HUMAN DECOMPOSITION MISSING        | execution-near-banks named, unsized |
| lagoon  | 1.35x | spread; L2 +59% (42.5 vs ~26.8)                  | squall-awareness unsized |
| lake    | 1.26x | L2 114 / L3 88.5; human decomposition missing    | L1 lane + L2 shore unattributed |
| bay/sea/ocean ~1.03-1.04 — at human, hold.

P0 — REDROCK LEG 3: THE RR4 DECISION (the biggest located section class).
  ⚠️ MERGE FIRST: the owner merge changed script.js; frozen redrock has no
  props/squalls so the new code SHOULD be dormant there — VERIFY by running
  one op5rr anchor seed on a merge-HEAD tree and byte-comparing. If inert:
  re-apply the RR4 edit (the pure-pursuit farthest-visible-when-nosedIn
  block; region untouched by the merge) onto b1347de, treeRR4b, and run the
  6 fresh sets (8400..8900, 8 seeds) on BOTH merge-HEAD tree and treeRR4b;
  pool ALL 12 (6 existing + 6 fresh) via _pool_rr.js. If NOT inert: rebuild
  both sides' 12 sets on merge HEAD (a machine-evening; still worth it).
  Landing bar and follow-ups per the parked note in regatta-redrock-canyon.
P1 — ARCTIC LEG 1: LANE1 REBUILD (the tack-count class, ~150 s/boat).
  Rebuild from this file's LANE1 section (~10068) onto b1347de. Gate: arctic
  pooled 4-set vs fl1barc* + the TACK INSTRUMENT (_arc_dist — tacks must
  move toward her 5). ⚠️ fl1barc anchors are pre-merge: arctic frozen venue
  has no props/squalls — same dormancy check as P0 before trusting anchors;
  if not byte-inert, re-anchor arctic on merge HEAD first (4×16 seeds).
P2 — ARCTIC: THE FAN UNGATE (cheap re-verdict, same dormancy caveat).
P3 — THE MEASUREMENT WAVE (fills bench downtime; NO builds without a named
  class): (a) the full per-leg human-vs-bot matrix for river/lagoon/lake —
  corpus leg decomposition vs bench legT (river human n=2 is thin; the
  owner's new laps slot straight in); (b) in-section attribution at each
  worst section — river L2 (execution-near-banks probe: her behavior at
  displacement onset vs the response layer's), lake L2/L3 (the redrock
  decomposition treatment: slow-time by site + why-slow controller states),
  lagoon L2 (+ squall time-in-wake/front-riding, human vs bot — lagoon-
  unique per owner); (c) gw-ledger + per-leg intake for every new recording
  the day it lands.
DEFERRED, EXPLICIT: the tactical doctrine family (regatta-tactical-doctrine)
— a cross-venue quality family, not a section-gap one; it enters after the
matrix names its cost on the clock. Squall-aware ROUTING waits for P3(b)'s
sizing. Curved-on-redrock stays conditional on P0.
TRAJECTORY REQUESTS (owner, in priority order): RIVER (n=2 — thinnest ref on
a 1.66x venue), LAGOON (n=3, new), LAKE + OLD-REDROCK + BAY (stale refs),
post-gust OCEAN (ratio genuinely unknown), NEW-REDROCK (promotion decision).
CONSTRAINTS CARRIED: verbatim from the re-verdict directive (a197317) —
resolution rules, bench pairs together, probe audits, actions-not-prices,
goldens full --update per landing, venue table at close.

## OPENING PROMPT (paste-ready)
THE SECTION PUSH. Goal unchanged. Open with memory regatta-redrock-canyon +
THE SECTION PUSH directive at the bottom of ai-campaign.md (supersedes
a197317's ordering; P0-P2 carried from it). Behavior HEAD b1347de (CP1).
FIRST: the merge-dormancy check (one anchor seed, byte-compare) on frozen
redrock AND arctic — it decides whether old anchors carry. Then P0 (RR4
12-set decision), P1 (LANE1 + tack instrument), P2 (fan ungate), P3
(measurement wave: per-leg matrix river/lagoon/lake + in-section
attribution + squall sizing). Intake every new owner trajectory same-day
(corpus + gw-ledger + per-leg). Close with the venue table.

# THE SECTION PUSH (2026-08-08 night → 08-09) — one landing, two kills, one new class
# ═══════════════════════════════════════════════════════════════════════════════════
## 0. THE MERGE-DORMANCY CHECK (it gated everything, and it passed)
The ae21f2e merge put squalls + drifting props into script.js; frozen redrock and
arctic author neither, so the new code should be dormant on the benched worlds.
Ran one anchor seed per venue on treeCP1 (= behavior HEAD b1347de) and byte-compared:
  redrock seed 9400 vs op5rr9400 — all 9 boats BYTE-EQUAL
  arctic  seed 9100 vs fl1barcA  — all 9 boats BYTE-EQUAL
⇒ every pre-merge anchor CARRIES. The RR4 port was then verified the same way:
treeRR4b (RR4 re-applied to b1347de) reproduced rr4rr9400 BYTE-EQUAL, so both sides
of the existing six sets are valid on merge HEAD and the protocol could be pooled
across the cut rather than rebuilt.

## 1. P0 — THE RR4 DECISION: THE LADDER CLOSES AT FOUR SHAPES
The other half of the 96-seed protocol: 6 fresh sets (8400..8900, 8 seeds) on BOTH
treeCP1 and treeRR4b, pooled with the six existing sets via the new _pool_rr12.js
(explicit pairs — the halves have different label prefixes).
  existing 6 (pre-merge)  paired med +7.0  mean +0.9   1/6 sets favour RR4
  fresh 6    (merge HEAD) paired med +4.0  mean +9.2   2/6 sets favour RR4
  POOLED 12, n=747 pairs  paired med +6.0  mean +5.0   3/12 sets, negative 48.1%
  per-set medians: 1, 42, -10, 16, 2, 24, 17, 32, -21, -42, 40, 4  (spread -42..+42)
  dirt base b/m/l 19.16/1.00/133.65 pen 3.63 | cand 19.77/1.00/132.65 pen 3.70
  finishers 792/864 -> 799/864
The bar was POOLED CLEARLY NEGATIVE WITH DIRT CLEAN. It is pooled slightly POSITIVE,
and the two independently-run halves agree on that. RR4 does not land; the RR ladder
CLOSES at four shapes. The mark-5 canyon class survives as ATTRIBUTION (solo cure
-121 s/boat is still real) for a future traffic-side shape — the freed boat pays in
the crowd, and no scope tried so far separates the two. P4 (curved-on-redrock) was
conditional on this landing and stays closed with it.

## 2. P1 — LANE1: THE REOPEN WAS RIGHT AND THE ANSWER IS STILL NO
Rebuilt from this file's LANE1 section onto b1347de: pathSailable's state widened to
(cell x incoming direction), 8x states, TACK_SEC*10 charged on a genuine upwind
side-change, tack SIDE read off the measured loss table's bestDelta sign. Scoped to
`_floeObjs` (the landed canyon law's test, NOT `grid._soft` — the bug LANE2's bay gate
caught), so ST===1 reduces every index to stock arithmetic and non-floe venues are
byte-identical BY CONSTRUCTION. Verified: bay 4 seeds BYTE-EQUAL.
THE STALE EVIDENCE WAS GENUINELY STALE — the solo verdict FLIPPED on the accurate
model. Pre-FL1 LANE1 lost solo (med 392.4 vs 382.2) with tacks UP; on b1347de:
  seed  HEAD fin  LANE1 fin    HEAD tacks  LANE1 tacks   HEAD leg1 odo  LANE1
  9100     380       331 (-49)     14          29           22920      24565
  9101     468       438 (-30)     30          17           30885      25222
  9102     517       331 (-186)    47          18           32648      23001
  9103     399       411 (+12)     26          25           24644      22413
  solo mean -63.25 s/boat, tack median 28 -> 21 (toward her 5), leg-1 odometer down 3/4
AND THE FLEET STILL WILL NOT CASH IT. Arctic pooled 4-set vs fl1barc*:
  paired med 1 s FASTER, mean 1.3 s SLOWER — flat. Sets +4/+2/+4/-6.
  fleet medians 379->386, 388->393, 373->366, 367->374 (3 of 4 WORSE)
  finishers 576->576 | floe 14206->15181 (+6.9%), boat 2912->3430 (+17.8%)
NOT LANDED. This is the granite-arc signature for the third time: a solo cure the
fleet refuses. The reopen principle held (the old evidence WAS produced by a false
world model) and the verdict survived it anyway — which is the strongest form the
tack-count class has been killed in. Eight shapes have now touched the arctic beat.

## 3. P2 — THE FAN UNGATE: LANDED (arctic -8.3 s/boat, and it costs contact)
One line: `(openWaterAv && racingLegF)` -> `racingLegF`, keeping racingLegF (the 4.4-
point OCS lesson). Both premises of the old conservatism had expired: the venue is no
longer marginal (576/576 finish, was ~8% DNF) and the four sets that "could not tell
it from zero" were measured in the phantom-flag world the finer offsets exist to
resolve. Arctic pooled 4-set vs fl1barc*:
  paired med -7.0  mean -8.3 s/boat FASTER  | 306/576 boats faster (53.1%)
  all four sets agree in sign: -18 / -1 / -3 / -3
  EVERY percentile improved: p10 296->286  p25 331->321  med 376->366  p75 427->423
                             p90 485->481  mean 386.7->378.3 | finishers 576->576
  ⚠️ THE COST IS CONTACT: boat 5.06->5.66 per boat (+12%), mark +21%, land +5%,
     against floe -1% and bounds -48%, PENALTIES IDENTICAL (657->657) — rubs, not
     fouls. Landed as a clock change with the trade recorded in the code comment.
GATES: arctic is the ONLY floe venue (asked the game, not the doc text: _floeObjs is
112 on arctic and 0 on all nine others), so every other venue is byte-identical by
construction — verified bay 4/4, ocean 16/16 @9300 (the EXACT gate), redrock 8/8,
river 16/16. ⚠️ The river gate first read "MOVED" against ff2rivA, which is a STALE
anchor (six landings old); against a true current-HEAD baseline it is 16/16 inert.
Do not gate inertness against an anchor from an older behavior HEAD.
GOLDENS: full --update. Only the two arctic traces moved by this change; swamp's two
were ALREADY failing on the reverted HEAD (owner: swamp and glowtide are not fully
built and are not gates). PASS 20/20 after re-record.
NEW ARCTIC ANCHORS: fan3arc{A,B,C,D} (16 @ 9100/9200/9300/9400), fleet med 366.

## 4. P3 — THE MEASUREMENT WAVE: A CORPUS AUDIT AND A NEW NAMED CLASS
### 4a. THE HUMAN COLUMN HAS THE DISEASE THE BENCHES WERE CURED OF (_traj_fp.js)
`freeze_venues --check` guards the BENCH side of venue drift by hashing the venue
FILE; recordings stamp a djb2 hash of the venue DOC (script.js ~12901). The two
schemes never met. Reproducing the recording-side hash offline (verified exactly
against two stamped laps) and comparing every lap in the corpus:
  RIVER   only the 172.1 lap is on the frozen river. THE QUOTED 161.3 "BEST" IS ON A
          RETIRED DOCUMENT — the river reference on the benched venue is n=1, 172.1.
  REDROCK only 214.7 is on the frozen doc; 226.2/227.1/206.6/231.6/140.3 are
          unstamped schema-1, and BOTH new-redrock laps (272.5/304.4) are on a
          document that is not the shipping new redrock either.
  LAGOON  all three laps are on THREE DIFFERENT documents, none of them shipping.
          Doc length ran 2927 -> 29540 -> 36572 -> 56936 (shipping): the 154.1 "best"
          was sailed on a NEARLY EMPTY LAGOON, before the coral maze existed, and is
          not a reference for a coral-maze bench. Marks and legLens are identical
          across laps 2-3, so 160.7/162.8 remain usable with the caveat.
  ARCTIC  the seven schema-2 laps are on 19adf972:82825; frozen==shipping is
          f05d4732:82888. The 22 schema-1 laps are unstamped.
  BAY/LAKE unstamped schema-1, but frozen==shipping today.
⇒ Only TWO numbers in the whole human column are provably on the benched document
(river 172.1, redrock 214.7). This is not a claim the others are wrong — it is that
they are unverifiable, and river/redrock/lagoon prove the failure mode is real. It is
also the strongest possible argument for the owner's re-recording queue.
### 4b. THE PER-LEG MATRIX (_leg_matrix.js) — and the river target MOVES
Campaign leg naming is L(n) = index n-1; lagoon and lake confirmed the directive's
sections exactly, river did not.
  RIVER  (human 172.1, frozen doc, n=1) idx0 +9.8 | idx1 +7.6 (1.13x) | idx2 -0.9
         | idx3 80.4 vs 151.0 = +70.6 s/boat, 1.88x, 80% OF THE WHOLE GAP
         The directive aimed at "L2 65.5s" — that is idx1, 9% of the gap. The human
         decomposition (which the directive itself flagged as MISSING) moved the
         target to the course's LONGEST leg (legLens 9782).
  LAKE   (n=3) idx1 84.4 vs 114.0 (+29.6, 62%) | idx2 69.6 vs 88.0 (+18.4, 38%)
         | idx3 the BOT IS FASTER, 57.0 vs 68.4 (0.83x). Total 1.25x.
  LAGOON (n=2 comparable) idx1 25.4 vs 42.0 (+16.6, 34%) | idx4 +10.4 (21%)
         | idx5 +9.0 (18%). Spread, as the directive said.
### 4c. IN-SECTION ATTRIBUTION AT RIVER idx3 (_riv_where.js, 10 northing bins)
TWO SUBSECTIONS OF TEN CARRY 90% OF THE LEG'S SLOW TIME:
  bin4 y1722..3015: human 13.7s, bot 138.9 s/boat (+125.2) — 66% of slow time
  bin7 y5599..6891: human  8.4s, bot  60.3 s/boat (+51.9) — 24%
  every other bin is within 0-2 s of her. WHY-SLOW: nearBank 100%, landAhead 85%,
  wiggle 85%, risk_IMMINENT 25%, irons 19%, armed ~0 (unarmed mid-leg transit — the
  same shape as the redrock canyon class).
  AND SHE IS NOT WHERE THEY ARE: bin4 she crosses at x=557 at 124 u/s while the
  stalled bots sit at x=128; bin7 she is at x=-370 at 152 u/s and they are at x=402.
  She crosses the river between the pockets; they do not.
### 4d. THE CLASS: THE ROUTER'S NAVIGABLE BAR IS NARROWER THAN THE WATER SHE SAILS
Overlaying her recorded track on the bot grid (_riv_grid.js): in bin4, 21% of her
track samples sit in cells the grid calls HARD — and she is doing 122-125 u/s in
them. Her ENTIRE lap contains exactly two contacts, both inside one 0.5 s bank scrape
at (1173,2823). In bin7 the figure is 0%: there both use the same mapped ribbon and
merely choose different sides, so the two pockets have DIFFERENT mechanisms.
Sizing the bar (_riv_bar.js — distance from every leg-3 sample to the nearest land
edge): med 154u, p10 47u, p5 37u, p1 22u; her FAST samples (n=737) run to a minimum
of 21u with p1 32u and p5 42u.
  bar 30u (= HULL_R, the physics bar):  2.1% of her line is inside it
  bar 38u:                              5.2%
  bar 44u (= shipping CLEARANCE):       8.6%  <= the router forbids this much of her
                                              line, concentrated in the +125s pocket
This is the third member of a family the campaign already knows: CP1 (the grid missed
hard props the physics enforced) and the noSubsample fix, whose own comment records
the identical disease — "redrock's north channel exit is 46u clear the whole way
through and read as a wall, which is why the fleet's route ran the dead-upwind slot
the human never sails". The model-accuracy ruling applies verbatim. NOT BUILT this
session: lowering a global clearance bar touches every venue's routing and needs the
full gate battery; it is the strongest candidate the measurement wave produced.

## 5. NEW STANDING TRAPS EARNED
21. **The two poolers use OPPOSITE sign conventions.** `_pool_rr.js` reports
    cand-base (NEGATIVE = candidate faster); `_pool_arc.js` reports base-exp
    (POSITIVE = candidate faster). Read the sign off the source before publishing a
    verdict — this session nearly published the fan ungate as a loss when it is an
    8 s/boat win, and it was caught only by recomputing the paired deltas by hand.
22. **Inertness must be judged against a CURRENT-HEAD baseline, not an anchor.** The
    river "MOVED 16/16" against ff2rivA (six landings old) and was 16/16 BYTE-EQUAL
    against a baseline run the same night on the same HEAD.
23. **A human reference is only a reference on the document it was sailed on.**
    See 4a; `_traj_fp.js` is the check and belongs beside `freeze_venues --check`.

## 6. VENUE TABLE ON FINAL HEAD (bot medians; ⚠️ = human ref unverifiable, see 4a)
| venue     | human ref          | pre-session bot | post-session bot | ratio |
|-----------|--------------------|-----------------|------------------|-------|
| bay       | 226.2 ⚠️unstamped  | 232             | 232 (inert)      | 1.03  |
| ocean     | 182.5 ⚠️pre-gust   | 190             | 190 (byte-equal) | 1.04  |
| seatrials | ~190 ⚠️unstamped   | 195             | 195 (inert)      | 1.03  |
| lake      | 223.0 ⚠️unstamped  | 278             | 278 (inert)      | 1.25  |
| lagoon    | 160.7 (2 of 3 laps)| 216             | 216 (inert)      | 1.34  |
| river     | 172.1 (n=1, FROZEN)| 263             | 263 (inert)      | 1.53  |
| arctic    | 212.1 ⚠️unstamped  | 376             | **366** (P2)     | 1.73  |
| redrock   | 214.7 (n=1, FROZEN)| 499             | 499 (RR4 closed) | 2.32  |
⚠️ river 1.53x and redrock 2.32x REPLACE the quoted 1.66x/2.18x: same benches, the
human denominator corrected to the lap actually sailed on the benched document.

## NEXT-PUSH DIRECTIVE (authored 2026-08-09, section-push close): THE BAR PUSH
Two of this session's three build slots closed families; the measurement wave paid
for itself by producing a sized class and correcting the scoreboard. The queue now
leads with the class, not with a leftover candidate.

P0 — THE CLEARANCE BAR (the strongest sized candidate the campaign holds).
  `CLEARANCE = HULL_R + 14 = 44u` (sailcheck.js ~18) against a 30u hull forbids
  8.6% of the human's river leg-3 line — concentrated in the pocket that costs
  +125 s/boat — and she transits those cells at 122-125 u/s with two contacts in a
  whole lap. Third member of the CP1/noSubsample family; [[regatta-model-accuracy]]
  applies. ⚠️ THIS IS A GLOBAL ROUTING CHANGE: it touches every venue, so it is NOT
  a one-venue gate. Build the ladder in scope order, cheapest first:
    B1 bar 38u everywhere (admits 5.2% -> 3.4% of her line's exclusions)
    B2 bar 34u, B3 bar 30u (=physics) — expect a knee, find it
    B4 if the global bar taxes open venues, scope on a MEASURED grid property the
       way noSubsample and the canyon law are scoped (navigable-clearance p50), NOT
       on venue name.
  GATES (all of them, this is global): river pooled fins/med vs a same-night
  current-HEAD baseline; redrock 6-set pooled via _pool_rr.js; lake 20@9100 vs
  op5hlakeA; arctic pooled 4-set vs fan3arc*; bay 20-seed pair; ocean 16@9300 EXACT;
  seatrials identity. Goldens full --update. ⚠️ Rule 22: baseline on the SAME HEAD.
P1 — RIVER bin7 (a different mechanism from bin4, same leg): both sides use the same
  mapped ribbon and she takes the west side while the bots take the east (+51.9
  s/boat, 24% of the leg). Not a bar problem. Measure before building: is the
  router's own path on her side and the boats displaced off it, or does the map
  prefer the east? `_riv_line.js` reads the plan at a northing gate — but note its
  bin4 read returned ZERO plans because a stalled boat's `gridPath` is built to its
  current nav target, not the leg end. Fix that (walk the DMC route, not gridPath)
  before trusting either verdict.
P2 — LAKE idx1/idx2 (62%/38% of a 1.25x venue) and LAGOON idx1 (34%): give both the
  subsection treatment `_riv_where.js` gave the river — bins, slow-time share,
  why-slow controller states, and her line vs theirs. No builds without a class.
P3 — SQUALL SIZING (lagoon-unique, still unsized): time-in-wake and front-riding,
  human vs bot. Needs at least one lagoon lap on the SHIPPING document first — all
  three in the corpus are on retired docs.
TRAJECTORY REQUESTS (now urgent, and the audit says why — [[regatta-corpus-
fingerprints]]): RIVER (n=1 on the benched doc), LAGOON (0 on shipping),
OLD-REDROCK (n=1), then bay/lake/arctic re-stamps, post-gust OCEAN, NEW-REDROCK.
STAYS CLOSED: everything on the standing list, plus RR1-4 (ladder closed at four
shapes), LANE1/LANE2 and the whole tack-count-by-routing family (eight shapes),
curved-on-redrock (was conditional on RR4).
CONSTRAINTS CARRIED: actions-not-prices; arctic pooled 4-set vs fan3arc*; river
pooled fins/med; 96-seed redrock protocol near threshold; bench pairs together;
probe audits (18/18b/19b/19c); ⚠️ NEW traps 21 (pooler sign conventions), 22
(inertness vs current HEAD, never an anchor), 23 (_traj_fp.js before quoting a human
ref); freeze_venues --check from repo root; check date; goldens full --update per
landing; swamp and glowtide are NOT gates (owner: not fully built).

## OPENING PROMPT (paste-ready)
THE BAR PUSH. Goal unchanged. Open with memory regatta-river-leg3 +
regatta-corpus-fingerprints + THE BAR PUSH directive at the bottom of
ai-campaign.md. Behavior HEAD 5e44b55 (the fan-ungate landing; arctic anchors
fan3arc{A,B,C,D} med 366). P0 is the clearance-bar ladder (B1 38u -> B2 34u -> B3
30u -> B4 measured-property scope) — a GLOBAL routing change, so every venue gates,
each against a same-HEAD baseline. Then P1 river bin7 (fix _riv_line's plan read
first), P2 lake/lagoon subsection treatment, P3 squall sizing once a shipping-doc
lagoon lap exists. Intake every new trajectory same-day: _traj_fp.js, corpus,
_gw_ledger2.py, per-leg matrix. Close with the venue table.

# NEXT-PUSH DIRECTIVE (authored 2026-08-09, after the eight-venue intake):
# THE HUMAN-LEVEL PUSH — an overnight run, owner-directed, DO NOT STOP
# ═══════════════════════════════════════════════════════════════════════════════
Owner: "the goal is human level performance. Focus on the biggest gaps... venues
where the gap is the largest. Then identify specific sections where the gap is
most extreme. Then identify causes. Then proposed fixes and improve. Analyze,
research, hypothesize, experiment, evaluate, iterate. DO NOT STOP."

## WHAT THIS SESSION ESTABLISHED (the ground truth to work from)
Eight venues now carry FRESH, FINGERPRINT-VERIFIED human references (3 laps each,
intaken the day they were sailed), and five venues were promoted/frozen, so
`freeze_venues --check` is clean for the first time in the campaign.

| venue     | human med / best | bot | ratio | the section that owns the gap |
|-----------|------------------|-----|-------|-------------------------------|
| seatrials | 189.4 / 179.7    | 194.5 | 1.03x | at human — hold |
| bay       | 219.0 / 211.0    | 232 | 1.06x | leg0 start 27% + leg1 beat 34% |
| ocean     | 177.9 / 177.7    | 190 | 1.07x | leg1 is 99% of it |
| lake      | 223.1 / 218.2    | 278 | 1.25x | leg2 57% + leg1 39% |
| river     | 167.4 / 165.0    | 261 | 1.56x | leg3 is 72%; 4 pockets = 91% of its slow time |
| lagoon    | 164.9 / 160.1    | 277 | 1.68x | spread: leg2 25%, leg4 21%, leg3 20% |
| arctic    | 212.4 / 201.6    | 367 | 1.73x | leg1 subs 8-9 = 65% of the leg (MARK APPROACH) |
| redrock   | 218.2 / 215.2    | 616 | 2.82x | venue-WIDE 1.77-2.78x; leg3 sub0 alone +103 s/boat |

THE GAPS SORT INTO THREE MECHANISMS, and they want different fixes:
 A. STALLING AGAINST LAND (river, redrock, part of lagoon). Discrete pockets where
    the fleet sits at 10-16 u/s and she sails 83-127. landAhead 47-67%, wiggle
    36-77%, **armed ~0** — unarmed mid-leg transit, NOT rounding. Odometer excess
    is small (river L3 +11%) so it is not routing length. SIZED CAUSE IN HAND:
    the grid's navigable bar `CLEARANCE = HULL_R + 14 = 44u` against a 30u hull
    forbids 8.6% of the line she sails at 122-125 u/s with two contacts all lap
    ([[regatta-river-leg3]]). Third member of the CP1/noSubsample family.
 B. EXTRA DISTANCE ON THE BEAT (bay, lake, ocean — and it is their WHOLE gap).
    The fleet sails 16-27% further than she does while being FASTER through the
    water: bay L1 1.49x vs her 1.26x (+674u), lake L1 1.52x vs 1.29x (+1080u),
    lake L2 1.26x vs her 0.99x ON ONE TACK (+1391u), ocean L1 1.62x vs 1.39x
    (+1100u). Her tack counts are tiny (lake L2 1/1/1, ocean L1 4/5/2). CAUSE NOT
    YET DECOMPOSED — that is P4's job and it is measurement-first.
 C. MARK APPROACH (arctic L1 subs 8-9 = 65% of that leg, lake L2 sub9 = 77% of
    its slow time). `armed` is 45-65% here, so it is the rounding machinery, not
    transit. Distinct from A by that flag alone.
 D. THE START, as a separate small class: bay leg0 is 7.69x (she crosses 0.5s
    after the gun, the fleet 5.0s, and even the GOOD boats sit 128u behind the
    line at the gun), river leg0 5.45x. ⛔ "start calibration" is a CLOSED family
    — do not build without owner approval; measurement is free and the evidence
    is now new (a verified human reference).

## P0 — REBASELINE. DO THIS FIRST; NOTHING ELSE IS VALID UNTIL IT IS DONE.
⚠️ The owner merged mid-session (`3594d11`/`a148db6`, script.js +487/-121) adding a
WIND OSCILLATOR (`windOsc`, `computeWindPressureScaleRaw`, WIND_OSC_SUB), squall
field changes and wind-streak rendering. A time-varying wind changes every race on
every venue. Consequences:
  1. Tonight's anchors were produced across THREE code cuts — treeNOW (pre-merge:
     bay/lake/ocean/arctic/redrock), treeNOW2 and the repo (post-merge: lagoon,
     seatrials via run_eval), treeRIVNEW (river). They are a SURVEY, not gates.
  2. Pin HEAD, build ONE tree, and re-anchor ALL EIGHT venues on it:
     bay 2x20@9100/9200 | lake 2x20@9100/9200 | river 2x16@9100/9200 |
     ocean 16@9300 | lagoon 2x8@9100/9200 | redrock 6x8@9400..9900 |
     arctic 4x16@9100..9400 (fleet_leg2) | seatrials run_eval 100 @100.
     Record them in this file with the HEAD hash. ~90 min wall at 6-way parallel.
  3. ⚠️⚠️ THE BLOCKER — BAY IS NONDETERMINISTIC ACROSS PROCESSES (post-merge only).
     CHARACTERISED, NOT FIXED, and it blocks every landing gate:
       - Three separate `run_traces.js --venue bay` runs gave THREE different
         behaviorHashes (3f015185 / f5b2c25b / b4c4ec16) with penalties 4/3/7.
       - The harness's own `--determinism` mode (same page, same seed, twice)
         says DETERMINISTIC. So it is stable WITHIN a page and varies ACROSS
         PROCESSES — a per-process entropy leak, NOT race-to-race state.
       - It reaches the BENCH path too, so it is not a trace-harness artifact:
         two identical `ocean_bench 4 7700 ... bay` runs on the POST-merge tree
         are not byte-equal (fins 238,243,221... vs 262,236,227...), while the
         PRE-merge tree reproduces byte-equal. The owner merge introduced it.
     RULED OUT already (do not redo): the world clock does not free-run
     (`state.time` advances ONLY on explicit update() calls — `_worldclock_audit.js`);
     wind-region phases are identical across three processes and across resets
     (`_wind_phase_audit.js`, seed 714421, phases 1.5331/2.167/2.6919/6.2117/6.2805);
     `computeWindPressureScaleRaw` restores `state.time` before its early return.
     PRIME SUSPECTS: an unseeded `Math.random()` consumed during course/wind setup
     — `script.js:7814` (`phase: Math.random() * Math.PI * 2`) and the `rngW`
     fallback at `script.js:19471` (`state.race.seed ? mulberry32(seed+29) :
     Math.random`) which fires whenever `state.race.seed` is falsy at build time.
     Pre-merge this was harmless because wind did not vary with time; the
     oscillator made it behavioural. Bisect by stubbing `Math.random` to a
     constant at page load and re-running the three-process test.
  4. Re-check the whole human column with `_traj_fp.js` after the merge — a venue
     doc may have moved again.

## P1 — REDROCK, THE BIGGEST GAP (2.82x, 364/432 finishing, land 222/boat)
Sections: leg3 sub0 at (-747,-1416) is +103.2 s/boat = 65% of that leg with the
fleet at 16 u/s; leg5 subs 0-1 at (-1259,431) and 6-7 at (446,-275) = 83% of leg5.
But EVERY leg is 1.77-2.78x, so expect the pockets to be the visible half of a
venue-wide problem. Mechanism A.
BUILD: the clearance-bar ladder, cheapest first, each a separate tree:
  B1 CLEARANCE 38u | B2 34u | B3 30u (=HULL_R, the physics bar)
  B4 if a global bar taxes open venues, scope on a MEASURED grid property
     (navigable-clearance p50), the way noSubsample and the canyon law are scoped
     — NEVER on venue name.
⚠️ GLOBAL ROUTING CHANGE: every venue gates. redrock 6-set pooled (_pool_rr.js),
river pooled fins/med, lake 2x20, arctic pooled 4-set (_pool_arc.js — ⚠️ OPPOSITE
SIGN CONVENTION from _pool_rr, trap 21), bay 2x20, ocean 16 EXACT, lagoon 2x8,
seatrials run_eval. Goldens full --update. Expect the bar to trade land contacts
against clock — read both.

## P2 — RIVER (1.56x): THE TRANSFER TEST
leg3 = 72% of the venue gap; four pockets hold 91% of its slow time; same
mechanism A signature. If the bar ladder is real it MUST move river too — that is
rule 8 (transfer proves mechanism), and it is the cheapest confirmation available.
If redrock moves and river does not, the bar is not the cause and the ladder dies.

## P3 — ARCTIC (1.73x) AND LAKE L2: MECHANISM C, THE MARK APPROACH
Arctic leg 1's last fifth carries 65% of that leg with armed 65%; lake L2's sub9
holds 77% of its slow time with armed 45%. ⚠️ This RE-ADDRESSES arctic: the venue
has been carried as a TACK-COUNT/beat class and eight shapes have died against
that address (AC1, TK1, TK2, TK3, LANE1, LANE2, clearance-extension x2) — the
subsection view says the beat's middle is at or near her pace and the time is at
the rounding. Start with measurement: what is the armed machinery doing in subs
8-9 that it is not doing elsewhere; compare her approach line and speed to the
fleet's. Only then propose. ⛔ orbit-radius, entry-side governors, holds,
station-keeping all stay closed.

## P4 — THE BEAT-DISTANCE CLASS (bay/lake/ocean): MEASURE BEFORE BUILDING
The excess is 16-27% and it IS the whole gap on three venues, but its cause is not
decomposed. Split the excess into: (a) avoidance deviation (integrate
|lastAvoidDeviation| along the leg), (b) router path length vs the straight line
(sum the planned path), (c) tacking overhead (count tacks and the distance lost
per tack vs her 1-7). Attribute the 16-27% across those three before proposing
anything. ⛔ Laylines are CLOSED at 4 rejections; station-keeping 0-for-8. If the
answer is "the router's own path is long", that is a NEW address and legitimate.

## P5 — LAGOON (1.68x) — spread across legs, and the venue is still moving.
Lowest priority of the gapped venues: leg2 25%, leg4 21%, leg3 20%, no single
pocket. Squall-awareness remains unsized. Re-check its fingerprint before use.

## METHOD (owner's words): analyze, research, hypothesize, experiment, evaluate,
## iterate. DO NOT STOP — keep working until the owner stops you.
Run at least 4 probes/benches in flight; never idle the machine. When a candidate
dies, name the mechanism in this file and move to the next shape rather than
stopping. When one lands, gate it fully, re-record goldens, re-anchor, and go on
to the next venue in ratio order.

## CONSTRAINTS CARRIED (all still binding)
actions-not-prices (7-for-7); episodes-not-frames; benching resolution (redrock
pooled 6-set minimum and the 96-seed protocol near threshold; arctic pooled 4-set;
river pooled fins/med; bay >=4 disjoint sets under ~5s); zero-statistic = bug;
gates sit on ONE physical line; probe audits (18/18b/19b/19c); bench pairs
together; goldens FULL --update per landing; `freeze_venues --check` FROM THE REPO
ROOT; check `date`; venue table at every close.
⚠️ TRAPS EARNED THIS SESSION: 21 the two poolers use OPPOSITE sign conventions;
22 judge inertness against a CURRENT-HEAD baseline, never an old anchor; 23 a
human reference is only valid on the document it was sailed on (`_traj_fp.js`).
⛔ CLOSED, do not reopen: RR1-4 (ladder closed at four shapes on 96 seeds), LANE1/
LANE2 and tack-count-by-routing, curved-on-redrock, laylines x4, station-keeping/
holds/commitment/reservation, SIPP/map-staleness, closing-lead pricing, occupancy
stamps, current pricing x4, clearance-extension x2, rollout speed x2, point-boat,
arctic radius selection, arctic wide-ride x2, start calibration (owner approval
required to reopen).

================================================================================
## 2026-08-09 ~09:15 — THE MEAN-FIELD BAKE LANDING (P0a: the bay blocker CURED)

ROOT CAUSE (proven): the bot grid's baked wind stamps — `_wfx/_wfy/_wbin/_leeW`,
67,081 cells, cached on the venue-keyed grid — were baked from `getWindAt`,
which the owner's wind-oscillator merge made a function of `r.phase` and
`state.time`. Neither is in the bake's cache key (`leeKey`). The PAGE-LOAD bake
runs before eval_harness stubs Math.random, so its phases are UNSEEDED; on
authored-windBase venues (bay) leeKey never changes afterwards, so that first
per-process bake won forever: every process shipped a DIFFERENT ROUTER. Within
a page: stable (cache). Across processes: three behaviorHashes. Pre-merge:
byte-equal (no time term in regionWindAt, so phases never entered the bake).

THE HUNT (all probes tracked in eval/rl): `_bay_ndet.js` — two fresh browser
processes, same seed: every one-time constant identical (phases, pressure, base
wind, boats), wind field identical at fixed probes at every sample, BOATS
diverge at frame ~2220. `_bay_ndet2.js` — boat 5 diverges at frame 2257 with
the seeded RNG draw-count IDENTICAL (35501 = 35501): not a stream desync.
`_bay_ndet3.js` — deep state diff: the four stamp arrays are the ONLY
reset-state divergence; downstream, boat 5's legManeuvers read 1 vs 3 — router
decisions, not physics. Wall-clock reads ruled out by grep (only audio/draw).

THE FIX (one mechanism): `WIND_MEAN_FIELD` module flag in script.js; while set,
`regionWindAt` answers the DAY'S MEAN (oscillator 0, liveShift 0). The bake
samples `regionWindAt` under the flag (was `getWindAt`) — the field its own
comment always claimed ("mean regional field, no gusts"). The bake is now a
pure function of what leeKey already carries. Same disease class as the swell
TIME clock; the model-accuracy ruling applied: a static stamp must be the day's
mean, never a random instant of a time-varying day.

VERIFIED: bay 90210, two fresh processes, 600 s sim — byte-identical, stamps
byte-equal; ocean 9300, 300 s — clean. Goldens: full --update, then verify
PASS 20/20 TWICE, the second in a fresh process — bay/90210+90211 now reproduce
their own recordings (trap 24 closed). BYTE-GATES ARE TRUSTWORTHY AGAIN.

NEW TRAP 25: a venue-cached bake must be a pure function of its cache key —
when a merge makes a formerly-static input time-varying, audit every
`_key`-guarded rebuild. The page-load bake runs BEFORE the harness Math.random
stub, so any unseeded draw it captures is per-process entropy.

CONSEQUENCE: the mean-field stamps change routing on EVERY venue whose regions
oscillate (all of them) — P0b re-anchors all eight venues on treeP0 at this
HEAD. Never compare any bench across this cut.

## P0b REBASELINE COMPLETE — treeP0 anchors on HEAD `08310d7` (frozen venues)
Human column re-verified post-merge with _traj_fp.js: all 8 venues' fresh laps
match FROZEN, frozen == shipping everywhere. ALL EIGHT VENUES ANCHORED:
  bay      p0bayA/B   20@9100/9200  med 241/241  fins 360/360   ratio 1.10
  lake     p0lakeA/B  20@9100/9200  med 264/261  fins 360/360   ratio 1.18  land 7.6/8.1
  river    p0rivA/B   16@9100/9200  med 269/269  fins 263/288   ratio 1.61
  ocean    p0oc       16@9300       med 203      fins 144/144   ratio 1.14
  lagoon   p0lagA/B   8@9100/9200   med 277/280  fins 144/144   ratio 1.69
  redrock  p0rr9400..9900  6x8  POOLED med 602  fins 376/432    ratio 2.76  (per-set 580-613)
  arctic   p0arcA..D  4x16@9100..9400  POOLED med 366  fins 575/576  ratio 1.72  (per-set 383/392/350/354)
  seatrials run_eval 100@100  boat means 196.2-198.9 (~197.8)   ratio 1.04
The mean-field stamps moved venues in BOTH directions vs the survey (bay 232→241,
ocean 190→203, lake 278→262, arctic 366→366 pooled-same): the old stamps were a
random instant of the day per process; these are the mean-field truth. The gap
ORDER is unchanged: redrock 2.76 >> arctic 1.72 ≈ lagoon 1.69 > river 1.61 >
lake 1.18 > ocean 1.14 > bay 1.10 > seatrials 1.04.

## P3 MEASUREMENT — THE ARMED APPROACH CRAWL, measured against her (treeP0)
`_appr_matrix.js arctic 1` (both all-laps and fp=19b566b3:82810 verified-only —
identical shape): binned by distance to the rounding mark, the human sails the
ENTIRE approach at 100-117 u/s and never parks; the fleet crawls it:
  150-300u: bot 3.7 u/s, armed 100%, park 64%, wiggle 19% (her: crosses at speed)
  300-450u: 49.6 u/s, armed 100%, avoid 55%   450-600u: 76.1, armed 100%, avoid 68%
  600-900u: 79.2, armed 98%, avoid 66%
Bands 150-900u: her 32 s/lap, fleet 101 s/boat — **+69 s/boat in the armed
approach alone**, avoid% 39-68 throughout. At 900-2700u the fleet is 83-98 u/s
(near her pace — the tack-count/beat address is dead as measured); the far band
2700+ carries +43 s/boat with avoid 41%. The crawl is fleet-vs-fleet avoidance
inside the armed machinery (the ring jam quantified against the human), NOT the
beat. ⛔ arrival/laning wide-ride, orbit-radius, holds all stay closed — the
next shape must change WHICH avoidance actions exist inside the armed approach,
not relocate the queue.

## P4 MEASUREMENT — THE BEAT EXCESS DECOMPOSED (treeP0, units audited per rule 18)
`_beat_decomp.js` — per-frame waste = (speed − VMC-to-waypoint), bucketed:
  bay L1  (odo 4924 vs straight 2848, tacks 6): AVOID 1198u = 57% of waste,
          CLEAN (pointing/route quality) 581u = 28%, TACKWIN 212u = 10%, ARMED 117u
  lake L2 (tacks med 7 vs her 1): AVOID ≈49% of waste, CLEAN ≈24%, TACKWIN ≈24%
Mechanism B's cause is NOT primarily router path length and NOT laylines: it is
**avoidance deviation among the fleet itself on the beat** — the same give-way
underlay the ledger measured (she deflects 0-5° as ROW; bots swing 10-64°).
Ocean L1 run pending. CROSS-VENUE: one address now owns the bulk of bay L1,
lake L2, arctic approach AND redrock/river's extra dirt — THE FLEET AVOIDANCE
TAX. The tactical-doctrine ruling (ROW sails its course; give-way yields
modestly, last-minute-but-sufficient) is the spec the deflection engine does
not yet meet fleet-wide.
Ocean L1 (odo 8105 vs straight 4412, dmcLen 4921, tacks 6): CLEAN 2011u = 38%,
ARMED 1804u = 34% (!), AVOID 968u = 18%, TACKWIN 518u = 10%. Ocean's excess is
ROUTE/POINTING + THE ARMED ROUNDING PATH, not fleet avoidance — a different
mechanism from bay/lake (and ocean is only 1.14x; deprioritized). The
fleet-avoidance-tax address owns bay L1 + lake L2 + the arctic approach.

## ⛔ P1/P2 — THE CLEARANCE-BAR LADDER IS DEAD (killed by monotonic dose-response)
Trees B1 38u / B3 30u, LAND bar only (ice + orbit floor stayed 44u; stamp
equivalence preserved; centerOnly shapes keep CLEARANCE):
  redrock B1 pooled 6-set (_pool_rr, sign checked): paired med +11 (SLOWER),
    fins 376→359, land 200→222/boat.
  river B1 2x16: med 269→272/273, leg idx3 UNMOVED (148/152 → 152/152).
  river B3 (30u = the physics bar, her whole line admitted): med 269→287,
    land 134→237 (+77%), fins 140→130, leg idx3 152→161 — WORSE.
Dose-response 44→38→30u is monotonic in the WRONG direction on every metric.
MECHANISM: the bar was never binding. The human sails 21u off the bank because
she can EXECUTE there; the fleet's pocket stall is a RESPONSE/EXECUTION failure
(landAhead 85%, wiggle 85% in the pockets — displaced arrivals that cannot get
back up to speed near a bank). Admitting nearer-land cells just routes the
fleet into more exposure. Same lesson as rule 17 (route pricing cannot reach
displacement-driven failures) from the ADMISSION side. B2 skipped (bracketed);
B4 scoping moot. ⛔ Do not reopen bar-lowering; the CP1/noSubsample family is
about the grid LYING about hard geometry, not about margins on TRUE geometry.
River leg3 re-address: the pocket class is execution-under-jam near banks —
judge any candidate on the wiggle/landAhead pocket stats, not route admission.

## AV1 — arc-scoped lee-shore band removal: INERT POOLED (mechanism named)
The crawl argmin ledger (treePR2, 11,419 armed-approach choices, dRM<900) said
the static proximity band defeats the 0-rung in 50% of choices (PROX_RIVAL 2 vs
PROX_STATIC 5752 — the rival nudge is NOT the tax; the ±1.2/1.6 rungs win).
AV1 (treeAV1): under the armed arc (arcK) with LAND-caused low clearance, skip
the 10000-scale endpoint band (ice grind kept — rule-5 line). Arctic pooled
4-set vs p0arc*: paired med +3 / mean +4.2 (candidate faster), fins 575→576,
boat rubs −3.5%, land +3.3% — sets split 2-2 (A +12, B +9, C −8, D −5), under
arctic's resolution. NOT a landing. ⚠️ The queued-rival-gate hypothesis was
REFUTED first (arc ACTIVE in 89% of choices, 79% of the slow subset — the RD7
narrow disable is not the lock). MECHANISM: the 0-rung's defeat in the ring is
OVERDETERMINED — the slow subset carries STATIC_VETO 19% + BOTH_BOAT 19%
sufficient defeaters behind the band; removing the top term re-ranks the stack
(the UL1 lesson at the action level). The crawl is not one term's fiction.
NEXT ADDRESS: the HEAD-OF-QUEUE SERVICE TIME — solo granite transit is still
55.8s vs her ~19 after RD11, and ρ≈7 queueing amplifies the residual into the
+69 s/boat. The solo residual is measurable without the jam (neutral solo).

## P5 LAGOON re-attribution on treeP0 (`_leg_matrix.js lagoon p0lagA p0lagB`)
Legs 2+3 own 54% of the gap: leg2 bot 48 vs her 19.5 (**2.46x, 29 s/boat**,
bot p75 78 — huge variance, some boats 4x), leg3 44 vs 19.2-read (2.29x) —
⚠️ but the two fastest human laps are RETIRED-doc; on the three verified laps
leg3's human med is 26.8 (ratio ~1.64), while **leg2's 2.5x stands on verified
laps** (her 17.8-24.0). Legs 4-6 are 1.25-1.37x. The lagoon target is LEG 2
(and its variance tail) — squall-awareness and/or the coral section; unsized.

## UL1-FOR-HIGH: SKIPPED ON EVIDENCE (not built)
The open thread asked whether HIGH deserves UL1's onset-honesty test. Tonight's
argmin ledger answers without a build: at HIGH (and every rung) the needless
stand-on deflections are bought by the STATIC proximity field (PROX_STATIC
5752 vs PROX_RIVAL 2 in the armed approach; the deflection dossier's redrock
figure was proxCost 47% with 56% no-rival), not by the risk-state hold prices
UL1 manipulates. Re-pricing the HIGH hold cannot reach a defeat the static
field owns — same reason UL1-MEDIUM collapsed the label and moved no actions.
Thread closed.

================================================================================
## SESSION CLOSE — 2026-08-09 THE HUMAN-LEVEL PUSH (day). Behavior HEAD `08310d7`.

## THE OSCILLATION-CHASING MODE (found, sized, NOT a uniform tax — read carefully)
Same-seed solo neutral A/B (`_arc_oscab.js`), oscillation removed in-page:
  arctic FULL-zero (dirVar+speedVar): 9100 −31 | 9101 −264 | 9102 +66 | 9103 −21
  arctic dirVar-ONLY:                 9100 flat | 9101 −161 (tacks 67→36)
  river dirVar-only: bot FASTER WITH the oscillation on both seeds (−13/−27 to
  remove it) — swings are exploitable there and the bot exploits them.
VERDICT: a BIMODAL failure mode, tail-dominated — on some seed/phase draws the
board selection tack-chases the direction oscillation (9101: 67 tacks vs her 5,
recovering 161-264s when the swing is removed); on most seeds flat. This is
plausibly a big slice of arctic's per-seed spread (solo fins 363-554, per-set
meds 350-392). The router is EXONERATED: plan(first) 12.9-15.9k ≈ her sailed
line; the excess is manoeuvre/execution. Candidate direction (NOT built): tack
QUALITY against the oscillation — a persistence/hysteresis threshold (tack only
when the observed shift exceeds the noise band windOsc's own unforecastability
defines), judged on the TAIL (p75/p90, pooled sets), and it must NOT blunt
genuine shift-playing (river profits from swings; the windward game is the
skill being measured). ⚠️ Distinct from closed families: LANE1/2 priced the
ROUTER's tacks; this is the strategic-layer board decision chasing a NEW signal
that did not exist before the owner's merge.

## THE VENUE TABLE (final HEAD `08310d7`, treeP0 anchors, frozen venues, verified refs)
venue     | human med/best | pre-bot* | post-bot | ratio | dirt/boat b/m/l/f/bnd (pen) | fins
seatrials | 189.4 / 179.7  | 194.5 | ~197.8 | 1.04 | —                            | run_eval 100
bay       | 219.0 / 211.0  | 232   | 241    | 1.10 | 1.9/0.2/0.1/0/0 (0.42)      | 360/360
ocean     | 177.9 / 177.7  | 190   | 203    | 1.14 | 1.4/0.2/0/0/0 (0.36)        | 144/144
lake      | 223.1 / 218.2  | 278   | 262    | 1.18 | 3.4/0.5/7.8/0/0 (0.66)      | 360/360
river     | 167.4 / 165.0  | 261   | 269    | 1.61 | 76.7/0.3/208.7/0/0 (2.28)   | 263/288
lagoon    | 164.9 / 160.1  | 277   | 278    | 1.69 | 5.4/0.8/10.7/0/0 (1.03)     | 144/144
arctic    | 212.4 / 201.6  | 367   | 366    | 1.72 | 7.0/0.4/13.2/26.3/0.2 (1.15)| 575/576
redrock   | 218.2 / 215.2  | 616   | 602    | 2.76 | 12.6/3.8/199.9/0/37.3 (3.22)| 376/432
*pre-session bots were sailed on per-process random-stamp routers across three
code cuts (the survey) — directional context only, not a same-cut comparison.

## WHAT LANDED / WHAT DIED / WHAT'S NEXT (one screen)
LANDED: the mean-field bake (`08310d7`) — bay/ocean cross-process byte-equal,
goldens PASS 20/20 twice, trap 25; P0b rebaseline (all 8 venues, table above).
DIED: the clearance-bar ladder (monotonic dose-response, leg3 unmoved — river
leg3 is EXECUTION-UNDER-JAM); AV1 arc-scoped band removal (inert pooled;
0-rung defeat OVERDETERMINED); UL1-for-HIGH (skipped on ledger evidence);
the queued-rival-gate hypothesis (arc active in 89% of crawl choices).
MEASURED: the armed approach crawl (+69 s/boat arctic, her 100-117 u/s vs
their 3.7-79); the beat decomposition (bay L1 avoid 57% GW-dominant, lake L2
49%, ocean CLEAN+ARMED instead); stand-on needless ~50% at thVO 0 on
redrock/arctic; lagoon leg2 2.46x (29 s/boat); solo arctic 420 vs fleet 366 vs
her 215 (the gap persists without the jam); the oscillation-chasing mode.
NEXT (size × confidence): 1. the oscillation-chasing tail (tack hysteresis,
judged on p75/p90 + pooled sets; river must stay ≥ flat); 2. redrock 2.76x —
the biggest gap got NO build tonight after the ladder died; re-attribute its
pockets with the execution-under-jam lens (`_leg_where` + `_crawl_argmin`
pattern on redrock's armed sections); 3. the give-way over-response on bay/lake
(the 417u GW slice — response DURATION/SIZE, onset already honest); 4. lagoon
leg2 variance tail (squall-awareness, unsized). Constraints all standing;
anchors are treeP0 on `08310d7`; never compare across the mean-field cut.

## POST-CLOSE ADDENDUM — the redrock leg3 pocket is STATIC-FIELD PARKING
`_pocket_argmin.js redrock [-1350,-2000,-150,-800]` (the leg3-sub0 pocket,
12,000 choices via treePR2's __avBox trigger): slow subset (<40 u/s, n=3051)
= STATIC_VETO 57% + PROX_STATIC 37% — **94% static; boat terms 4%**. The
"execution-under-JAM" framing from the ladder kill is also wrong: rivals are
not the pocket's defeater. The land PROBES veto the 0-rung (500000 hard-zone
veto + the 30000 far term + the clearance band), the argmin buys ±1.2/1.6
swings, and she sails the same water at 83+ u/s. This composes with the B3
result: admitting nearer-land NAV cells made leg3 worse because it added
places to be probe-blocked — the response layer, not the map, owns the pocket.
NEXT SESSION'S FIRST QUESTION: the hard-zone speed-scaled veto (a393d61) is
built for exactly this (time-to-wall instead of fixed 140u) but is scoped
openWaterAv && !arcK && plan-aligned(0.3rad) && not-in-irons && current<2kt —
measure WHICH scope condition fails in the pocket (suspects: the canyon's
current regions tripping _avCurMax≥2, or the plan-alignment window while the
boat is displaced off-plan). If the pocket choices sit just outside one scope,
the candidate is that scope's honest widening — measured first, one line.

## ADDENDUM 2 — the pocket's missing scope, measured (the next build, parameterized)
Scope booleans at the pocket's slow-static choices (n=1933): ow 100% | ir 100%
| cur 100% | arcR 3% | **hp 69% | al 28%**. The hard-zone speed-scaled veto
(a393d61) misses the pocket ONLY on plan-alignment: 72% of parked-boat choices
have desiredHeading off the far-field plan reference by >0.3 rad (31% have no
reference at all) — the displaced boat trying to rejoin the plan is exactly the
boat the fixed 140u veto pins, while the scaling's own formula would give it
the 60u floor (time-to-wall at parked speed). CANDIDATE FOR NEXT SESSION (not
built): widen the alignment scope for SLOW boats — a parked/slow boat's
time-to-wall is long in every direction, so the speed term already bounds the
risk; the alignment window exists to protect fast boats aiming off-plan. Judge
on redrock pooled 6-set + river transfer + the full battery; same physical
line as the hard-zone landing (an honest widening of its own scope).

================================================================================
## 2026-08-09 ~11:30 — THE SLOW-BOAT WAIVER LANDING (HZ2). Behavior HEAD moves.

The pocket-argmin chain (static parking 94% → failing scope = plan-alignment)
converted directly into the build: `hzWaive` (!arcK, speed < 40 u/s, irons +
current guards kept) waives the hard-zone plan-alignment requirement for the
veto scaling AND the 30000 far term. A slow boat's time-to-wall bounds its risk
in every direction; the alignment window exists to protect FAST boats.

GATES (treeHZ2 vs treeP0, all on `08310d7` baselines):
  redrock pooled 6-set: paired med −34.0 / mean −37.2, ALL SIX SETS NEGATIVE
    (−15/−39/−26/−89/−34/−48), fins 376→386, cand med 602→572, boat rubs
    12.55→10.08 (−20%), penalties 3.22→2.88 (−11%), land flat (200→201).
  lake 2x20: A 262 land −18%, B 262 land +2% — flat-to-better, all 360 finish.
  bay 2x20: A BYTE-IDENTICAL, B 240 (−1) boat −9%.
  lagoon 2x8: −7/−7 clock (277→270, 280→273), land A +46% / B −10% (pooled
    +16% — THE WATCH COLUMN for lagoon).
  ocean 16@9300 EXACT: byte-identical. river 2x16: byte-identical (current
    guard scopes it out — its pocket sits in the ≥2kt set; NOT a transfer
    failure, a scope fact). arctic 4x16: byte-identical (floe venue guards).
  seatrials run_eval 100@100: byte-identical.
GOLDENS: full --update then verify PASS 20/20.
NEW ANCHORS on this HEAD: redrock hz2rr{9400..9900} pooled med 572 fins
386/432 (ratio 2.62, was 2.76); lake hz2lakeA/B 262/262; bay hz2bayB 240
(bayA = p0bayA byte-identical); lagoon hz2lagA/B 270/273; all byte-identical
venues keep their p0 anchors (p0oc 203, p0riv 269/269, p0arc pooled 366,
seatrials ~197.8).
REMAINING on redrock at this cut: 572/218.2 = 2.62x — the pocket class is cut
but not closed; river's twin pocket needs a current-honest variant (time-to-
wall in the GROUND frame is the honest form there — future shape, NOT built).

## THE VENUE TABLE, final HEAD `188cd74` (owner format: med/best both bots, fins %)
venue     | human med/best | pre-bot med/best | post-bot med/best | ratio | fins (%)
seatrials | 189.4 / 179.7  | 197.8 / 196.2†   | 197.8 / 196.2†    | 1.04  | 100% (DNS/DNF 0)
bay       | 219.0 / 211.0  | 241 / 205        | 241 / 205         | 1.10  | 360/360 (100%)
ocean     | 177.9 / 177.7  | 203 / 166        | 203 / 166         | 1.14  | 144/144 (100%)
lake      | 223.1 / 218.2  | 262 / 189        | 262 / 190         | 1.18  | 360/360 (100%)
river     | 167.4 / 165.0  | 269 / 189        | 269 / 189         | 1.61  | 263/288 (91%)
lagoon    | 164.9 / 160.1  | 278 / 195        | 271 / 202         | 1.64  | 144/144 (100%)
arctic    | 212.4 / 201.6  | 366 / 217        | 366 / 217         | 1.72  | 575/576 (100%)
redrock   | 218.2 / 215.2  | 602 / 315        | 573 / 299         | 2.62  | 386/432 (89%, was 87%)
† seatrials via run_eval reports per-boat MEANS over 100 trials (means-of-boats,
not single-race times). Pre-bot = P0 rebaseline anchors on `08310d7` (same-cut);
post-bot = final anchors (hz2 where moved, p0 where byte-identical). Sorted by
ratio; this is the standing close format (owner, 2026-08-09).

================================================================================
# OPENING PROMPT — THE REDROCK PUSH (paste this to the next instance)

THE REDROCK PUSH. **Goal (owner): drive redrock below 2x** — pooled med < 436
vs her 218.2 — from 573 today. That is a −137 s/boat campaign; expect 3-4
landings of HZ2's size (−30 to −60 each). DO NOT STOP; analyze → hypothesize →
experiment → evaluate → iterate; ≥4 probes/benches in flight; when a candidate
dies, name the mechanism here and move on. Check `date` first.

**Open with**: memories `regatta-humanlevel-push` (this session: TWO landings),
`regatta-standing-rules` (traps 21-25), `regatta-venue-table`,
`regatta-redrock-canyon`, and this directive.

**Where things stand.** Behavior HEAD `188cd74` (after `08310d7` THE MEAN-FIELD
BAKE — bay/ocean cross-process byte-equal, trap 25 — and `188cd74` THE
SLOW-BOAT WAIVER — hard-zone plan-alignment waived under 40 u/s; redrock pooled
−34 all-sets-negative). Anchors on this HEAD: redrock hz2rr{9400..9900} pooled
572/299 fins 386/432 (2.62x), lake hz2lakeA/B 262/262, bay p0bayA+hz2bayB
241/240, lagoon hz2lagA/B 270/273 (⚠️ land +16% watch), ocean p0oc 203 (16
EXACT), river p0rivA/B 269/269, arctic p0arc pooled 366, seatrials ~197.8.
Goldens PASS 20/20 on `188cd74`. freeze_venues --check CLEAN. Owner table
format: ratio-sorted, med/best both bots, fins n/total (%).

**P0 — finish the Phase-0 attribution wave (partly done):**
- DONE: per-leg matrix, VERIFIED LAPS ONLY (`fp=9b7c82db:21417` — 8 of 11
  redrock traj files are OLD-course, rule 23): legs 3+5 = 58% of the gap
  (+84.8/+79.3 s/boat, 2.51x/2.45x), legs 1/4 = 26% (2.30x/2.34x), leg6 1.73x.
- TO RUN: `_leg_where.js` subsections on legs 3 and 5 (hz2 anchors);
  `_pocket_argmin.js` re-run on an hz2-code tree (what mid-speed stall remains
  in the leg3 pocket after the waiver — build treePR3 from HEAD + the treePR2
  instrumentation patch, see regatta-humanlevel-push); **the BOUNDS class**
  (37 bounds-contacts/boat, HUMAN-ZERO, never attributed — where/which
  legs/what state); **the DNF class** (46/432 — where do they die); solo
  neutral + `_arc_oscab.js` A/B on redrock (9 oscillating regions, never
  A/B'd here; ⚠️ dirVar-only form; river PROFITS from swings — any
  anti-chasing shape must not blunt shift-play and gates everywhere).
**P1 — build in size order from P0.** Shelf: HZ2 siblings (the 40 u/s knee,
the far-term for displaced mid-speed boats), the bounds fix once attributed
(human-zero classes convert cleanly), tack hysteresis if the redrock osc A/B
is big (judge on the TAIL, pooled sets). ⛔ Closed on redrock: RR1-4 (96
seeds), curved-on-redrock, canyon-law entries, occupancy stamps, ENTRY-side
governors, orbit-radius knee; MEDIUM breach honesty (lake kill); UL1 incl.
HIGH (static field owns the defeats, not risk prices); AV1 band removal
(overdetermined); the clearance-bar ladder (dose-response, admission is not
the block). The 0-rung's defeat in constrained water is OVERDETERMINED —
single-term removals re-rank; prefer shapes that change the boat's ACTIONS.
**P2 — gates per landing**: redrock pooled 6-set minimum (_pool_rr, NEGATIVE =
faster — trap 21), 96-seed protocol near threshold, full battery every venue
(river/arctic may be byte-inert behind current/floe guards — verify byte-
identity against CURRENT-HEAD baselines, trap 22), goldens full --update.
**⚠️ OWNER REQUIREMENT (2026-08-09): EVERY STATUS UPDATE — not only the session
close — presents THE TABLE in the decided format: one row per venue, SORTED BY
RATIO, columns = venue | human med/best | pre-session bot med/best |
post/current bot med/best | ratio | fins n/total (%). Update the bot column
from the freshest anchors at the moment of the update; flag any venue whose
number is stale or mid-bench.**
**Constraints carried**: actions-not-prices; episodes-not-frames; probe audits
(18/18b/19b/19c); one-physical-line gates; `_traj_fp.js` before quoting any
human ref; owner asked for MORE REDROCK LAPS — intake same-day when they land.

================================================================================
# 2026-08-09 ~12:00 — THE REDROCK PUSH (goal: below 2x, pooled med < 436)

## P0 ATTRIBUTION WAVE (all on HEAD `188cd74` / treeHZ2; fp-verified refs)
THE FOUR POCKETS ≈ 225 s/boat of the 355 gap (_leg_where, verified laps only):
  leg3-sub0 +114 s/boat (67% of leg3; bot 16 u/s vs her 83; 73% of leg slow
  time) | leg5-sub0/1 +55 (mark-7 exit) | leg5-sub6/7 +30 | leg4-sub5 +25
  (mid-leg narrows, her 116 u/s vs 79). Leg1 is diffuse traffic beat
  (deflected 45%, no pocket — FLEET AVOIDANCE TAX flavor, 47 s/boat).
THREE CLASSES UNIFIED: leg3-sub0 = the DNF class = the bounds class.
  _rr_dnf: ALL 8 DNFs (1/race = bench 46/432 rate) die leg 3 nearest mark-6
  (-883,-1628), med 321u out, 0.59kt, unarmed, liveness normal. _rr_bounds:
  336 grind episodes cluster (-800,-1600)/(-800,-2000) = the same box; legs
  3/5/2 own 83%. The pocket IS the mark-6 departure corridor.
## ⛔ KILLED: the boundary-veto hypothesis (measured, not benched)
The fan's arena check (fixed 80u veto at the speed-projected future point,
no HZ scaling — script.js ~3612) looked like HZ2's missing sibling. treePR3
(HEAD + PR2 instrumentation + source tag) says NO: BND_VETO = 1.4% of slow
defeats; slow boats sit med 500u from the arena edge (within80: 0%) in every
pocket. The bounds grinds are downstream symptom (~19 s/boat), not defeater.
## ⛔ KILLED: tack hysteresis on redrock (the oscillator A/B verdict)
8 solo neutral same-seed A/Bs (dirVar-only): removal deltas −11/+85/−10/−229/
+205/−55/+254/−93 — TWO-SIDED, net ≈ wash. Unlike arctic's one-sided tail,
redrock seeds exploit the swings as often as they chase them. No build.
## THE POCKET MECHANISM (argmin + anatomy, treePR3/treeHZ2)
Slow-static defeats at leg3-sub0 with the HZ2 waiver ACTIVE (scope verified
ow/ir/cur ~100%, arcR 2%): STATIC_VETO 52% (land inside the 60u FLOOR — the
boat is AT the wall face) + PROX_STATIC 34% (the un-waived clearance band).
FAN NOT CLOSED: allClosed 0%, bothOpen 64%, 9.3 open rungs/choice, reversals
present 50% (nosedIn) — ADMISSION IS NOT THE PROBLEM. Anatomy (_pocket_anat):
a park/unpark/re-nose LOOP — 467 short spells (~3.7s), heading churn 0.8 rad
inside spells, drift 20u, nosedIn 60% of box time; worst transits 748-815s
with 73-79 spells (the DNF boats). Each time the boat gains way, the nav
demand re-noses it: the 420 upwind floor's carrot lands past the bend.
leg4-sub5 is DIFFERENT: PROX_STATIC 62% at 94% PLAN-ALIGNED, mid-speed — the
clearance band (10000-scale ≈ cost(0) 7500-15000) flips the winner off the
router's own thread in the narrows. leg5-sub0/1 mixed (al 49%).
## P1 BUILDS (one physical line each)
RR5 (treeRR5): RR3's fetchable-carrot re-aim scoped nosedIn && <40 u/s — the
  HZ2 knee separates the pocket class (slow pinned) from the traffic pin at
  speed (m5 funnel) that killed RR3; RR4's solo-only scope excluded the
  crowded pocket itself. A NEW rung, the one the RR close note asked for.
HZ3B (treeHZ3B): the plan-aligned candidate that passes the hard zone's own
  trust test pays NO clearance-band tax (aligned-only; the slow waiver stays
  OUT — v1 lake shore-hug lesson). Targets leg4-sub5 + PROX_STATIC share.
## ⛔ KILLED at the MECHANISM GATE: RR5 (fetchable carrot, nosedIn && <40 u/s)
Fleet anatomy on treeRR5 is baseline-identical (box 6255s vs 6560s, parkT 1666
vs 1732, the four 748-815s DNF transits unchanged, 69-79 spells each). At the
wall face NO plan point around the bend is line-of-sight, so bestVis≈0 and the
re-aim never produces a different carrot — the RR family's lever does not
reach the NEW course's pocket. (Solo fins swung ±250 BOTH WAYS on this
one-line change — solo cross-tree comparison is unusable on redrock; mechanism
gates or pooled fleets only.) Tree deleted.
## ⭐ THE BLIND WIGGLE IS THE LOOP'S ENGINE (measured, the sharpest number yet)
applyAvoidance line ~2780: `if (this.wiggleActive) return desiredHeading` —
wiggle steering BYPASSES the entire fan, land vetoes included. In the leg3
pocket, wiggle owns 64% of slow time, and the commanded beam-reach heading
(windDir ± 1.75, side chosen from boats/marks/random — land-blind) is
HARD-BLOCKED within 150u for **88% of 5212 wiggle samples** (2295s of blind
wall-aim in 4 races). The loop: nav re-noses → park → blind burst into the
face → clamp/grind (land 199.9/boat!) → fail → flip every 2nd failure →
repeat, up to 815s. leg4-sub5 correction: the anat box there holds only ~6
s/boat (her-line box; bot stall is laterally displaced) — HZ3B's located
target was over-sized; its pooled 6-set is running as the judge anyway.
## HZ3B REDROCK POOLED 6-SET (treeHZ3B vs hz2rr* baselines) — THE BIG ONE
paired med −85.0 / mean −78.7, n=356, negative 250/356, ALL SIX SETS NEGATIVE
(−112/−61/−121/−100/−47/−83), med 572→490, fins 386→391, land 200.9→169.5
(−16%), pen 2.88→2.71 (−6%), boat 10.08→10.50 (+4%), mark −7%. 2.62x→2.25x
from one line. Full battery in flight (lake is the risk venue — v1 shore-hug;
river/arctic expected byte-identical behind current/floe guards, judged vs
CURRENT-HEAD baselines per trap 22).
## W4 (treeW4) — THE AIMED BURST, mechanism gate PASSED (partial cure)
The discriminator run: of blocked blind bursts, other beam side clear 12%,
ANY sailable non-irons heading ≥220u hard-clear = 100%. Build: when hard land
(not floe plug) blocks the commanded burst within 150u, aim the burst at the
clear feasible heading nearest a beam reach; snap wiggleSide to the chosen
side; leg 0 + floe blockage + clear bursts stock verbatim. Box gate vs HZ2:
2 of 4 catastrophic transits GONE (repl. by 200-270s), slow 4082→3455s,
nosedIn 3911→3174s, ws-flips in spells 165→84; TWO 800s loops survive (the
nav re-nose class — the carrot demands wallward; next address if W4's pooled
set lands). W4 redrock 6-set in flight vs hz2rr*.
## ⛔ KILLED at the FLEET GATE: W4 (the aimed burst) — the wiggle layer CLOSES
Pooled 6-set vs hz2rr*: +42 med / +50 mean, ALL SIX SETS WORSE (+4..+86),
fins 386→366, boat rubs +53%, mark +51%, pen +24% — despite the box gate
passing (2 of 4 catastrophic transits cured). MECHANISM: the burst bypasses
avoidance ENTIRELY — including rivals. The stock blind beam-reach into a wall
is at least stationary; an AIMED burst turns the grinding boat into a blind
charge across traffic and marks. The burst's blindness to land is inseparable
from its blindness to boats; giving it eyes for one without the other trades
grind for collisions. With WIG2 (arctic, sighted side-pick) this closes the
wiggle layer 2-for-2: ⛔ do not re-enter via the burst. Tree deleted.
NEXT (in flight): RJ1 — the rejoin is a ROUTE, not a bearing: nosedIn+slow
boats get a SailCheck.pathBetween micro-route to the plan point as their
carrot (the demand itself moves into sailable water; every prior shape edited
prices or LOOK on the same straight line). treeRJ1, box gate running.

================================================================================
## 2026-08-09 ~15:30 — ⭐⭐ THE BAND-TRUST LANDING (HZ3B, `08f734a`). HEAD MOVES.

One line: the candidate passing the hard zone's own trust test (plan-aligned
0.3 rad, open water, !arcK, not irons, <2kt) pays NO clearance-band tax; all
other headings keep full lee-shore caution. The slow-boat waiver deliberately
NOT included (v1 lake shore-hug kill stays honored).
GATES: redrock pooled 6-set paired −85.0 med / −78.7 mean, n=356, ALL SIX
SETS NEGATIVE (−112/−61/−121/−100/−47/−83), med 572→490 (2.62x→2.25x), fins
386→391, land 200.9→169.5 (−16%), pen −6%, boat +4%, mark −7%. Lake A/B
−5/−3 paired med (land A −12%, B +19%); bay A −0.6 mean / B BYTE-IDENTICAL;
ocean 16 EXACT; river 2x16 BYTE-IDENTICAL (current guard); arctic 4x16
BYTE-IDENTICAL (openWaterAv guard, dirt identical to the count); lagoon flat
(−1.4/+1.1 mean) with land A −27%; seatrials ~197.8-198.9 (anchor-equal).
Goldens full --update then PASS 20/20. freeze_venues --check CLEAN.
NEW ANCHORS on `08f734a`: redrock hz3brr{9400..9900} pooled 490/274 fins
391/432 (2.25x); lake hz3blakeA/B 254/247 (pooled med 252/191 — 1.13x, was
1.18); bay 240/205; lagoon hz3blagA/B 271/274 (pooled 273/215); ocean p0oc
203/166 (byte-id); river p0riv 269/189 (byte-id); arctic p0arc 366 (byte-id);
seatrials ~197.8.
## RJ1 VERDICT: SUBSUMED (do not land; shape stays on the shelf)
vs HZ2 alone: med −4.0 (3-3 sets) but fins 386→399 (+13, biggest fins move of
the campaign), land −11%, mark −13%. ON TOP of HZ3B (treeCRJ1 vs hz3brr*):
med +1.0 / mean +7.3, fins 391→394 — the band trust already un-parks the same
boats (the aligned candidate wins and the boat follows the plan out); the
rejoin route then only adds occasional detour carrots. If a future course has
pockets the band cannot cure (no aligned candidate exists), RJ1 is the shelf
shape — its solo evidence is the +13 fins.
## POST-LANDING RE-ATTRIBUTION (treeH3, `08f734a`) — THE MARK-6 BOWL OWNS ~115 s/boat
_rr_map: mark-6 sits in a NEARLY-CLOSED BOWL (x −1150..−750, y −1850..−1400),
outlets = a 2-cell slit going N (x≈−880) and the SE channel the leg-3 plan
threads; the whole bowl interior is LOW-CLEARANCE (clr<3). Two classes:
  leg2-sub9 (ARRIVAL): +35.4 s/boat, 69% of leg 2's gap, armed 81% — the
    rounding-approach crawl through the shared channel (fleet-avoidance-tax
    flavor; entry governors ⛔ closed, funnel metering already active here).
  leg3-sub0 (DEPARTURE): +80.6 s/boat (was 114 pre-HZ3B), 62% of leg 3,
    landAhead 68%, armed 3% — 3 boats per 4 races still run the FULL 780-810s
    loop; DNFs 6/8 races (was 8/8), all mark-6, now at 0.16 kt.
Legs 1/6 diffuse (+43 traffic-beat / +7). Leg 5 softened everywhere (sub0
37→20, sub1 18→13, sub6/7 ~26 — still the second address).
DISCOVERY: a PER-BOAT sailable route already exists (gridPath = pathSailable
from the boat, ≤12s stale, clearance-weighted) and the LOOK carrot rides IT —
so the RJ1 shape duplicated existing machinery (why it subsumed). The
survivors' question is WHICH piece goes stale: _rj_lifecycle.js on treePR4
logs replan segNull/segLen + 1Hz carrot LOS/xtk/age for slow pocket boats.
## THE CARROT-LOS CHAIN (post-landing): RR6 flat, W5R6 = 2 of 3 loops cured
_rj_lifecycle (treePR4): the per-boat gridPath is HEALTHY (replans 100%, age
med 6.2s, threads the bowl) but the straight boat→carrot line crosses hard
land in 67% of slow pocket reads — 321/451 at ONE cluster (-1000,-1400), the
slot between the bowl's interior ISLET and its wall. Builds:
  RR6 (LOS-carrot shrink, slow-scoped — the rung RR1-5 never tried): box gate
  FLAT on the 3 loop boats (818/800/789 persist). Alone: not enough.
  W5 (the aimed burst, scoped nosedIn && <15 u/s && NO rival within 150u —
  W4's kill mechanism excluded by construction) + RR6 (treeW5R6): box slow
  3197→2799, spells 360→304, wsFlips collapse, LOOPS 3→2 (one DNF cured).
THE RESIDUE NAMED: the last survivor is SOLO (rivMed 1549u, near% 2) and
WEDGED in the ~100u islet-wall slot — every rose heading has hard land within
the probe distances, so W5 and RR6 both fall through to stock; the escape is
a multi-point turn (crawl-rotate-crawl) no current layer can express. ~1 boat
per 2 races. W5R6 pooled 6-set in flight vs hz3brr* — the clock decides.
## ⛔ RR6/RR6b DEAD at the box; the DEPARTURE LADDER CLOSES for this session
RR6b (LOS carrot scoped SOLO — the queue exclusion): box shows FOUR full
loops (818/800/789/756s) and ALL FOUR are SOLO (rivNearPct 0-6) — the solo
scope was never the issue; from inside the islet-wall slot NO path point is
LOS-visible, so RR6's re-aim falls through to stock for exactly the boats it
was built for. SEVEN shapes have now failed on the wedged class (band trust,
RJ1 route, RR5 raise, RR6/RR6b shrink, W4 unscoped burst, W5 scoped burst):
the missing capability is a STUCK-STATE MANEUVER — a deliberate multi-point
turn / back-out-along-own-track sequence, which no current layer (fan, carrot,
burst) can express. That is a DESIGN task for a fresh session, with the
reversal-commitment history (30s-commit disease, station-keeping 0-for-8) as
its constraints. Trees deleted; the class is fully attributed and mapped
(the bowl map, the slot at (-1000,-1400), _rj_lifecycle, _pocket_anat rivMed).
## ALSO MEASURED (the arrival side): armed bowl arrivals are STATIC-defeated
Armed subset of bowl choices (n=4019/10589): STATIC_VETO 44% + PROX_STATIC
26% vs boats 25% — the queue's straight probes read the bowl walls as
collision everywhere because the queued-rival gate (m5 wedge lesson) keeps
the ARC off in parked crowds (arcR 0% at slow-static). If the arrival crawl
is ever targeted, the shape is arc-vs-wedge in land-locked roundings — weigh
against the wedge lesson before building.

================================================================================
## SESSION CLOSE 2026-08-09 (day 2) — THE REDROCK PUSH, ONE LANDING: 2.62x → 2.25x

LANDED: ⭐⭐ THE BAND-TRUST LANDING (HZ3B, `08f734a`) — redrock pooled −85 med
ALL SETS, 572→490, fins +5, land −16%; lake −5/−3 (252/247); goldens PASS
20/20 ×1 after full --update; freeze CLEAN. The single biggest redrock move
of the campaign (HZ2 was −34).
KILLED with mechanisms (7): boundary-veto hypothesis (slow boats sit 500u
from the arena edge); redrock tack-hysteresis (osc A/B two-sided at 8 seeds);
RR5 (no LOS around the bend to raise toward); W4 aimed burst (blind to boats
— rubs +53%); RJ1 rejoin route (SUBSUMED — per-boat gridPath already exists);
W5R6 (queue disruption, mark +14%); RR6/RR6b (the wedged class has no
LOS-visible path point — solo scope irrelevant).
ATTRIBUTED to closure: the mark-6 BOWL owns ~115 s/boat (arrival leg2-sub9
+35 armed/static-defeated with the arc queue-gated OFF; departure leg3-sub0
+80 with the wedged islet-wall slot as the DNF residue, ~1 boat/2 races,
needs a stuck-state maneuver that no current layer can express); leg5 pockets
~45 (same family, lighter); leg1 diffuse traffic +43 (THE FLEET AVOIDANCE
TAX); legs 4/6 small.

## THE VENUE TABLE, final HEAD `08f734a` (owner format: ratio-sorted, med/best, fins %)
venue     | human med/best | pre-session bot | post-session bot | ratio | fins (%)
seatrials | 189.4 / 179.7  | 197.8 / 196.2   | 197.8 / 196.2    | 1.04  | 100% (DNS/DNF 0)
bay       | 219.0 / 211.0  | 241 / 205       | 240 / 205        | 1.10  | 360/360 (100%)
lake      | 223.1 / 218.2  | 262 / 190       | 252 / 191        | 1.13  | 360/360 (100%)
ocean     | 177.9 / 177.7  | 203 / 166       | 203 / 166        | 1.14  | 144/144 (100%)
river     | 167.4 / 165.0  | 269 / 189       | 269 / 189        | 1.61  | 263/288 (91%)
lagoon    | 164.9 / 160.1  | 271 / 202       | 273 / 215        | 1.66  | 144/144 (100%)
arctic    | 212.4 / 201.6  | 366 / 217       | 366 / 217        | 1.72  | 575/576 (100%)
redrock   | 218.2 / 215.2  | 573 / 299       | 490 / 274        | 2.25  | 391/432 (91%)
(byte-identical venues keep prior anchors; lagoon 273 vs 271 pre is pooled-
median granularity on 144 boats, clock verdict flat with land −27% on set A.)

================================================================================
# OPENING PROMPT — THE REDROCK PUSH, CONTINUED (paste to the next instance)

THE REDROCK PUSH continues. Goal (owner): redrock below 2x — pooled med < 436
vs her 218.2 — from 490 today (2.25x, was 2.62 at session open). −54 to go:
one HZ3B-half-sized landing. DO NOT STOP; ≥4 probes in flight; check `date`.

Open with: memories regatta-redrock-push (this session), regatta-standing-
rules (traps 21-25), regatta-venue-table, and this directive.

Where things stand. Behavior HEAD `08f734a` (THE BAND-TRUST LANDING: trusted
plan-aligned candidates pay no clearance-band tax; −85 pooled, all sets).
Anchors on this HEAD: redrock hz3brr{9400..9900} pooled 490/274 fins 391/432;
lake hz3blakeA/B 252/191; bay hz3bbay* 240/205; lagoon hz3blag* 273/215;
ocean p0oc 203/166, river p0riv 269/189, arctic p0arc 366/217, seatrials
~197.8 (all byte-identical this landing). Goldens PASS 20/20. freeze CLEAN.

The remaining redrock gap (272 s/boat) in size order:
1. THE MARK-6 BOWL ~115 s/boat, both faces measured to closure this session:
   ARRIVAL (leg2-sub9, +35, armed): straight probes read the bowl walls as
   collision because the queued-rival gate keeps the ARC off in parked crowds
   (armed subset: static 70%, boats 25%). The shape is arc-vs-wedge in
   land-locked roundings — weigh the m5 wedge lesson first.
   DEPARTURE (leg3-sub0, +80): 2-4 solo boats/4 races wedge in the islet-wall
   slot at (-1000,-1400) and loop 750-820s (= the DNF class, fins ceiling).
   SEVEN shapes failed (list in the session log); the missing capability is a
   STUCK-STATE MANEUVER (multi-point turn / back out along own track),
   designed against the reversal-commitment + station-keeping constraints.
   Constraint inventory: fan ±1.6 + reversals exist and are OPEN (9.3 rungs);
   steerage ≈ 0 below a few u/s EXCEPT wiggle snap-turn; wiggle bursts bypass
   ALL avoidance; gridPath is per-boat, fresh, and correct.
2. LEG-5 pockets ~45 (mark-7 exit channel + subs 6-7) — same family, lighter
   traffic; whatever cures the bowl, gate its transfer here.
3. LEG-1 diffuse traffic beat ~43 — THE FLEET AVOIDANCE TAX (AV1 inert,
   overdetermined; deflection ledgers in regatta-humanlevel-push).
⛔ Closed THIS session on redrock: boundary-veto, tack-hysteresis (two-sided),
RR5/RR6/RR6b (the full carrot ladder — six lifetime rungs), W4/W5 (the burst
may not look — blind-to-boats, 2 kills), RJ1 (subsumed by gridPath).
⛔ All prior closed families stand (RR1-4, curved, canyon-law entries, entry
governors, occupancy stamps, UL1, AV1, clearance-bar ladder, orbit knee...).
Gates: pooled 6-set (_pool_rr, NEGATIVE=faster), 96-seed near threshold,
mechanism gate at the box BEFORE benching (this session's method — it killed
3 of 5 builds for the cost of 4 races each), full battery + byte-inertness vs
CURRENT-HEAD baselines, goldens full --update, close with the owner table.
Owner is recording MORE REDROCK LAPS — intake same-day (fp=9b7c82db:21417 is
the current verified fingerprint; re-run _traj_fp.js on arrival).

## THE PLAN (written at close for the fresh instance — execute top-down)

**Phase 0 — orientation (15 min, no builds).** `date`; read memories
regatta-redrock-push + standing-rules traps 21-25; `freeze_venues --check`
from repo root; `_traj_fp.js redrock` (owner may have recorded new laps —
if new fp-verified laps exist, re-verify the human med/best BEFORE anything);
confirm HEAD `08f734a` and that hz3brr* baselines load. If an owner merge
landed overnight: byte-check script.js vs 6485113, keep pre-merge anchors,
re-baseline only what moved (rule 6).

**Phase A — THE BOWL ARRIVAL: arc-vs-wedge (~35 s/boat address; expected
pooled −15..−25 if it converts).**
A1 measure (1 run, treePR4): at mark-6 armed choices, how often is the
   queued-rival gate the ONLY reason arcK==0 (vs current/unarmed/no-arcR)?
   Log the gate's own inputs. If <50%, re-size before building.
A2 build (one line): allow the arc rollout under a parked-crowd queue when
   the rounding is LAND-LOCKED — scope on a measured grid property of the
   MARK (clearance at the mark's zone below a knee, the noSubsample shape),
   so open-water queues (the m5 wedge lesson's home) keep the gate verbatim.
A3 gates: mechanism gate at the bowl box FIRST (leg-2 armed transits must
   speed up; boat rubs must not climb — the wedge lesson is a rubs failure),
   then pooled 6-set vs hz3brr*, then full battery. Kill fast if rubs move.

**Phase B — THE STUCK-STATE MANEUVER (the wedge slot; the DNF class; fins
391→~415+ and the 750-820s tail; med read WITH fins — DNF converts enter as
slow finishers).** This is the session's design task — budget it properly.
B1 the state machine (new, small): enter ESCAPE when parked (<15 u/s) &&
   nosedIn (hard) && the 24-heading rose finds NO hard-clear 220u heading
   (the slot signature — measured, it separates the wedge from everything
   else) && no rival within 150u (Freezing-Robot + W5's lesson) && leg>=1
   && sustained 8s. Maneuver: BACK OUT ALONG OWN TRACK — keep a per-boat
   breadcrumb ring buffer (pos every 1s, 60 deep, trivial memory); steer to
   the breadcrumb 100-150u astern with wiggle-grade snap-turn authority and
   speedRequest 1.0; pop breadcrumbs as reached. EXIT when un-nosed && speed
   >40 u/s, or breadcrumbs exhausted, or 20s HARD CAP (the 30s
   reversal-commitment disease is the constraint — never latch longer);
   afterwards normal nav (the gridPath is correct — measured).
B2 gates: mechanism gate at the box (the 750-820s transits MUST break — that
   is the whole claim), then pooled 6-set + full battery. Floe venues: first
   pass EXCLUDE them entirely (fixed-land signature only) — arctic byte-
   identical by construction, verify per trap 22.
B3 if the box gate fails, STOP the family for the session (8th shape) and
   log; do not ladder.

**Phase C — transfer + residuals.** After any landing: `_leg_where` legs 3+5
on the new HEAD (does the leg-5 mark-7 exit inherit?); `_rr_dnf` (fins
ceiling); re-anchor + table. If A+B land near expectation the pool sits
~440-460: decide with fresh attribution whether the last −10..-25 comes from
leg-1 (THE FLEET AVOIDANCE TAX — enter via the measured needless stand-on
swings, actions not prices) or the leg-5 pockets, and take ONE more swing.

**Standing method (non-negotiable):** mechanism gate at the box before any
6-set; pooled 6-set minimum, trap 21 sign; 96-seed protocol near threshold;
byte-inertness vs CURRENT-HEAD baselines; goldens full --update at landings
only; the owner table with EVERY status update; new owner laps intaken
same-day; ≥4 probes in flight; when a candidate dies, name the mechanism
here and move on.

================================================================================
## 2026-08-09 ~14:45 (day-2 cont.) — PHASE A RE-SIZED at the measurement: the
## arc-ungate build is NOT justified; the arrival crawl lives OUTSIDE arc range
_arc_gate.js (treeA1, 4 races, mark-6 armed choices at 2 Hz): of SLOW (<40 u/s)
armed samples, 85% sit at dM 280-360u — BEYOND the arc's existence range
(zone*1.5 = 248u). The queue gate is the sole blocker in only ~11% of slow
armed time (15% in-range × 72% queue-blocked) — under the 50% build bar set in
the plan. The A2 shape (relax the queued-rival gate for land-locked roundings)
would free the arc for water the crawl never occupies. Moving fast in-range
choices see ARC ON 51% — the gate is not starving them either.
THE RE-SIZE: the arrival crawl is a QUEUE CRAWL at 250-360u behind parked
rivals (nPark p50 2, dPark p50 84u) — and the WEDGED DEPARTURE CLASS sits at
(-1000,-1400), 256u from mark-6, directly beside the approach channel. The
arrival queue is plausibly SEEDED by the wedge class. ORDER OF OPERATIONS
FLIPPED: Phase B (stuck-state maneuver) first; re-measure the arrival with the
wedge cured before any arrival build.

## PHASE B (stuck-state maneuver, treeB1) — v1/v2 box verdicts, v3 in flight
v1 (plan shape: rose-fully-blocked entry + sustained-8s park + breadcrumb
retreat): NEVER FIRES — box byte-identical. TWO PREMISES FALSIFIED BY THE BOX:
(a) the slot signature does not exist — 100% of blocked wiggle samples keep
some non-irons 220u-hard-clear heading, INCLUDING the three loop boats (the
pocket is not geometrically sealed; nothing ever aims at the opening);
(b) sustained-parked (<15 u/s) never holds — the wiggle's own minSpeed
escalation (18-30 u/s) interrupts any park-based sustain test.
v2 (leaky futility accumulator: nosed && <40 u/s && no-rival-150, +TICK/-0.5,
threshold 25s; crumbs recorded only >=40 u/s): TRIGGER IS RIGHT, MANEUVER IS
WRONG. Fires on exactly the loop class (5 boats, 39 episodes, seeds 9400-03;
the three 750-820s slot boats + a leg-5-area boat at (622,1442); zero rival
aborts) but every episode caps at 20s with crumbs static at 48: the boat
ENTERED the trap below the 40 u/s recording floor, so the last crumb predates
the trap and the straight line to it crosses the islet — with avoidance
bypassed the maneuver noses the wall toward an unreachable crumb. Loops
persist (785/768/693). Lake (v2 trigger): 0 escapes in 2+ seeds — specificity
confirmed off-venue.
v3 (LAST SHAPE this session per plan B3): keep the proven trigger; replace the
aim — MULTI-POINT TURN at the longest-hard-clear rose heading, re-evaluated
every tick with hysteresis (30u/rad switch penalty). Rationale: the opening
exists 100% of the time (measured); wiggle can't see it (fixed beam reach,
88% blocked), the burst family looked once and blindly (killed); nothing
re-aims while moving. Box gate + episode log in flight.
## PHASE B v3 box verdict: FAIL — and the SUB-CELL BLINDNESS named
v3 (rose re-aim w/ hysteresis): same three loops (785/768/693), all 39
episodes cap at 20s, positions pinned ±30u, spd sawtooth 0→40→4-11 = the boat
ACCELERATES INTO LAND THE ROSE CALLED CLEAR. Mechanism: the ray rose samples
at 60/100/150/220u — nothing below 60u. Parked against a wall, the first
obstruction sits at 20-40u on EVERY heading; "clear" headings abound at
60u+ scale while the slot is sealed at hull scale. This rehabilitates the
close's original claim (the slot IS sealed) and convicts the roseClr=100%
stat of the same blindness (rule 18 flavor: audit the probe's RESOLUTION,
not just its units). Trigger remains clean: same 5 boats, 0 false fires,
lake 0-for-4-seeds.
v4 (FINAL shape): the CLEARANCE-GRADIENT WALK — step to the sailable
neighbor CELL (RES=50u) with max _clear (BFS distance-to-land, monotone
uphill by construction), aim at its clearance-checked CENTER, corner-guarded
diagonals, radius-2 fallback. The grid is the only honest sensor at hull
scale. Box gate in flight; if it fails the family STOPS this session.
## PHASE B v4 verdict + THE HELM-OWNERSHIP FIND (the real reason v2-v4 "failed")
v4 (clearance-gradient cell walk) box: loops persist BYTE-NEAR-IDENTICAL to
baseline (785.5/767/693.5) — and that identity across three DIFFERENT aims was
the tell. Code audit found it: the ISLAND-CONTACT OVERRIDE runs after the
ESCAPE branch and, while `iceEscapeTimer > 0`, unconditionally rewrites
desiredHeading; a wedged boat is in near-constant land contact, so the timer
re-arms every tick and the contact reflex (off-wind bounce off the contact
normal) owns the helm PERMANENTLY — it IS the ping-pong loop between islet
and wall. planFloeTrajectory can also override toward the stale wallward
_lastNav. v2/v3/v4's commanded headings never reached the rudder: the box
gates tested override precedence, not the aims. (Extends the one-line gate
family: every stuck-boat mechanism — wiggle, clearanceTimer, iceEscape — has
a precedence slot; a NEW mechanism must claim its slot in EVERY override that
can outrank it, or it does not exist.)
v5 = v4's cell walk + helm ownership (escActive suppresses the island reflex,
its application, and planFloeTrajectory while active). Box gate in flight —
this is the FIRST run in which the maneuver actually steers.
## ⭐ PHASE B v5 BOX GATE: PASS — THE WEDGE LOOPS BREAK
v5 = the futility trigger (25s leaky nosed+slow+solo) + the clearance-gradient
cell walk + HELM OWNERSHIP (escActive outranks the island-contact reflex and
planFloeTrajectory while active). Box (seeds 9400-03, slot-inclusive box):
ALL THREE 750-820s loops GONE — worst transit 239s; box time 3594→1749s
(−51%), slow 2486→731s (−70%), nosedIn 2427→671s (−73%), parked spells
988→305s. Episode log: FIVE episodes total, each 1.1-3.1s (rotate to the
uphill cell, 8→39 u/s, un-nosed, out — the 20s cap never hits), fins 9/9 on
ALL FOUR seeds (baseline 8/9 on three), and the leg-5 boat at (622,1442)
cured too (transfer visible at the box). Lake: 0 fires in 4 seeds.
THE MANEUVER IS ~3 SECONDS, NOT 20: the boat was never physically trapped —
it was command-trapped (the contact reflex ping-pong). One cell of correct
aim ends it.
Fleet verdict in flight: b1rr{9400..9900} vs hz3brr*, then full battery.
## PHASE B v5 REDROCK POOLED 6-SET (b1rr* vs hz3brr*) — THE TAIL LANDS, THE MEDIAN PAYS COMPOSITION
_pool_rr (finisher stats): cand med 508 vs base 490; paired (mutual
finishers) med +3.0 / mean +13.4, n=390. Dirt: land −29%/boat
(169.5→120.5), boat rubs FLAT (10.50→10.48), mark +17% (3.47→4.05), pen +5%.
**fins 391→429 of 432 (+38): the DNF class is eliminated** (3 non-finishers
remain in 48 races). best 274→294.
HONEST COMPOSITE (DNF scored at cutoff 900 BOTH sides, per the plan's
"med read WITH fins"): paired ALL-BOATS n=432 med 0.0 mean −19.4, ALL SIX
SET MEANS NEGATIVE (−4/−41/−16/−26/−7/−23), negative 199/432. DNF-at-900
med 501.5→509.5 (+8), mean 534.8→515.4 (−19.4).
READ: the cure is tail-only, as a wedge cure must be — the typical boat is
untouched (med ~0), every set's MEAN improves, 38 boats stop dying, land
falls 29%, rubs (the W-family killer) are flat. The finisher-median rise
(490→508) is composition: 38 ex-DNFs now finish at 700-850s and enter the
median population. Mutual-finisher med +3 pooled = small traffic cost of 38
extra boats racing legs 3-6. mark +17% = the same boats now rounding 4 more
marks each (exposure, not behavior — verify at battery).
Full battery in flight (lake/bay/ocean/river/lagoon/arctic).

================================================================================
## 2026-08-09 ~16:20 (day-2 cont.) — ⭐⭐ THE STUCK-STATE ESCAPE LANDING (B1v5). HEAD MOVES.

One line: a boat that has been nosed-into-land + slow + SOLO for 25 leaky
seconds enters ESCAPE — it OWNS THE HELM (outranks the island-contact reflex
and planFloeTrajectory), walks the clearance gradient one grid cell at a time
(the only hull-scale-honest sensor), with wiggle-grade snap turn + minSpeed,
and exits un-nosed at speed (typ. ~3s), rival-guarded 150u-entry/120u-abort,
20s hard cap, fixed-land venues only (floe + ≥2kt-current excluded verbatim).
THE CAPABILITY THE SEVEN SHAPES MISSED, found by iterating the box gate:
(1) no rose signature exists (the slot seals only BELOW 60u — every ray probe
is blind there); (2) no park-based sustain survives the wiggle's own minSpeed
bursts (use leaky futility); (3) the wedged boat was COMMAND-TRAPPED, not
physically trapped — the island-contact reflex re-armed every tick and
ping-ponged it between islet and wall for 750-820s. Helm ownership is the
cure; the walk is ~3 seconds long.
GATES: box — all three loop transits GONE (worst 239s; slow −70%, nosed −73%,
fins 9/9 all four box seeds). Redrock pooled 6-set vs hz3brr*: **fins 391→429
of 432 (the DNF class eliminated; 3 remain in 48 races)**, land −29%, boat
rubs FLAT, mark +17% (exposure: 38 boats now sail legs 3-6), pen +5%;
finisher-med 490→508 (COMPOSITION: ex-DNFs finish 700-850s); DNF-at-900
paired ALL-BOATS mean −19.4 with ALL SIX SET MEANS NEGATIVE, med 0.0 (the
cure is tail-only, the typical boat untouched). Lake B: land −34%, mean −1.8
(a grinding boat cured); lake A, bay A/B, ocean, river A/B, lagoon A/B,
arctic A/B/C/D, seatrials ALL byte-identical/anchor-equal. Goldens full
--update then PASS 20/20. freeze CLEAN.
NEW ANCHORS (this HEAD): redrock b1rr{9400..9900} pooled finisher-med 508 /
best 294, fins 429/432 (DNF-at-900 med 509.5 mean 515.4); lake b1lakeA=hz3b
(byte-id) b1lakeB 247 land 6.41; all other venues keep hz3b*/p0* anchors.
OWNER-METRIC NOTE: ratio vs her 218.2 on finisher-med reads 2.33x — but the
population changed (99% finish vs 91%). On DNF-at-900 med the ratio is
509.5/218.2 = 2.34 vs base 501.5/218.2 = 2.30 — call it FLAT on med, −19/boat
on mean, +38 boats on fins. The med attack now goes through the ARRIVAL QUEUE
(Phase A re-measure, no longer seeded by wedged boats) + leg-5 + leg-1.

## ⛔ KILLED at the FLEET GATE: B2 (ESCAPE threshold 25s→12s)
Won BOTH box gates (leg-5 subs 6-7 slow −18%, bowl slow −23%, the 239s
residual→98s, lake still 0-for-4, episodes clean 2-3.5s exits reaching new
pockets) and LOST the pooled 6-set vs b1rr*: paired med +7.0 / mean +9.7
(DNF-at-900 med +7.0), 4 of 6 sets positive, boat rubs +10%
(10.48→11.55/boat), fins flat 428/432. MECHANISM: at 12s the maneuver fires
~5x more often; each firing is ~3s of avoidance-bypassed snap-turn steering
plus a navigation interruption, spent mostly on boats that were about to
recover anyway — and the fleet pays the perturbation in rubs. The 25s
conservatism IS the clean battery; the threshold knee is real and 12s is on
the wrong side. (Box gates cannot see fleet-wide perturbation cost — same
lesson as rule 16's scene-vs-race.) Tree deleted. ⛔ Do not re-ladder the
ESCAPE threshold; if the leg-5 medium stalls are ever re-addressed, the
entry needs a SHAPE change (e.g. futility that counts wiggle-failures, not
seconds), not a price change.

================================================================================
## SESSION CLOSE 2026-08-09 (day-2 continuation) — ⭐⭐ THE STUCK-STATE ESCAPE LANDING

LANDED: `458ec5a` — ESCAPE (25s leaky futility: nosed+<40u/s+solo → helm
ownership → clearance-gradient cell walk, ~3s/firing). Redrock fins 391→429
of 432 (THE DNF CLASS ELIMINATED), land −29%, rubs flat, DNF-at-900 paired
mean −19.4 ALL SIX SETS NEGATIVE, med composition-flat; lake B land −34%
bonus; every other venue byte-identical; goldens full --update PASS 20/20;
freeze CLEAN. Three prior "failures" of the same aim were override-precedence
artifacts (the command-trapped lesson).
RE-SIZED/AVERTED: Phase A arc-ungate (the arrival crawl lives at 280-360u,
outside the arc's 248u range; queue-gate sole blocker in only ~11%).
KILLED: B2 threshold ladder (above); the v1 rose-signature entry (no such
signature exists — sub-60u blindness); the v2 breadcrumb aim (entry trail
predates the trap below the recording floor).
REMAINING REDROCK (finisher-med 508 vs goal 436): leg-5 ~91/boat net
(sub0 exit friction 25.8 — DISTRIBUTED, no pocket to gate; subs 6-7 medium
solo stalls — needs an entry-shape change, not a threshold); leg-3 sub0
residual 35.7 (halved, now queue-flavored); leg-2 arrival ~19 (armed queue);
leg-1 unmeasured today (~43 at last measure, THE FLEET AVOIDANCE TAX).

## THE VENUE TABLE, final HEAD `458ec5a` (ratio-sorted, med/best, fins %)
venue     | human med/best | pre-session bot | post-session bot | ratio | fins (%)
seatrials | 189.4 / 179.7  | 197.8 / 196.2   | 197.8 / 196.2    | 1.04  | 100%
bay       | 219.0 / 211.0  | 240 / 205       | 240 / 205        | 1.10  | 360/360 (100%)
lake      | 223.1 / 218.2  | 252 / 191       | 252 / 191        | 1.13  | 360/360 (100%)
ocean     | 177.9 / 177.7  | 203 / 166       | 203 / 166        | 1.14  | 144/144 (100%)
river     | 167.4 / 165.0  | 269 / 189       | 269 / 189        | 1.61  | 263/288 (91%)
lagoon    | 164.9 / 160.1  | 273 / 215       | 273 / 215        | 1.66  | 144/144 (100%)
arctic    | 212.4 / 201.6  | 366 / 217       | 366 / 217        | 1.72  | 575/576 (100%)
redrock   | 218.2 / 215.2  | 490 / 274       | 508* / 294       | 2.33* | 429/432 (99%, was 91%)
(*finisher-med; the rise from 490 is POPULATION COMPOSITION — 38 ex-DNF boats
now finish at 700-850s. DNF-at-900 med 501.5→509.5 (flat), mean 534.8→515.4
(−19.4/boat, all sets). The fins column is the landing.)

================================================================================
# OPENING PROMPT — THE REDROCK PUSH, NEXT (paste to the next instance)

THE REDROCK PUSH continues. Goal (owner): redrock below 2x vs her 218.2.
⚠️ METRIC NOTE FIRST: on HEAD `458ec5a` the fins column changed population —
99% finish (429/432) vs 91% before THE STUCK-STATE ESCAPE LANDING. Finisher-
med 508 (2.33x) is NOT comparable to the old 490 (2.25x): DNF-at-900 med is
FLAT (501.5→509.5) and mean is −19.4/boat. Decide the med target on the
DNF-at-900 basis (goal <436 → currently 509.5 vs 501.5 base; −74 to go) and
quote both columns to the owner. DO NOT STOP; ≥4 probes; check `date`;
mechanism gate at the box BEFORE any 6-set; but remember the B2 lesson —
the box CANNOT see fleet perturbation; only the pooled 6-set lands.

Open with: memories regatta-redrock-push (both sessions), regatta-standing-
rules (traps 21-25 + the command-trapped lesson), regatta-venue-table.

Where the remaining ~74 lives (post-landing attribution, 4-race shape —
re-run at 8 races before building):
1. LEG-5 ~91/boat NET (but population changed — re-attribute first):
   sub0 mark-7 exit +25.8 = DISTRIBUTED thread friction (no pocket; worst
   transit 36.5s; family A: 59 vs her 72 u/s + wiggle-blind). subs 6-7 +36 =
   medium solo stalls (60-115s, rivMed 170-621) BELOW the 25s ESCAPE
   trigger. ⛔ threshold ladder dead — an entry-SHAPE change (e.g. futility
   counted in WIGGLE FAILURES not seconds, or wiggle-fail count >= 3 &&
   solo) is the unexplored shape.
2. LEG-3 sub0 residual +35.7 (halved by the landing; now queue-flavored —
   parked rivals near, ESCAPE correctly refuses; the fleet-avoidance family).
3. LEG-2 arrival ~+19 (armed 49%, queue behind parked service — entry
   governors ⛔, funnel metering already active; weigh before building).
4. LEG-1 unmeasured this session (~43 at last measure — THE FLEET AVOIDANCE
   TAX, AV1 inert/overdetermined).
Also open: owner may deliver new redrock laps (fp=9b7c82db:21417 current;
_traj_fp.js on arrival, intake same-day). The ESCAPE machinery is landed
infrastructure now — `_esc_log.js` shows every firing; lake B profited
(land −34%); if a future venue shows chronic solo wedges, ESCAPE's scope
(fixed-land, no-floe, <2kt) is where to look first.
Gates: pooled 6-set vs b1rr* (redrock), b1lakeB for lake B, hz3b*/p0* for
byte-venues; 96-seed protocol near threshold; goldens full --update at
landings; the owner table with EVERY status update.

## THE MARK-5 APPROACH DECOMPOSITION (_m5_approach.js, 8 races vs 3 laps)
Owner asked where roundings/exits fail. Leg-3 band 4 (last 20% of DMC into
mark-5) splits THREE ways:
1. subs 15-19 (the rounding): bots on HER LINE (offset 19-33u), maneuvers
   match (med 3 vs her 2-3) — but THROTTLED 29-69% (speedLimit<1 at 100%
   armed; funnel/pack clamps) for ~10-20 u/s. Worth ~1-2 s/boat; re-pricing
   a landed win — venue-class scoping + full gates if ever touched.
2. subs 0-7 (the thread before the bend) — THE MONEY: bot 39-57 u/s vs her
   78-90, OFF her line by 81-161u (p75 242), throttle 0%, armed 0%, avoid-
   deviating 55%. Nothing commands the slowness: deflections push boats off
   the thread line into bad water and nothing pushes BACK. Same execution-
   under-jam family as river leg 3.
3. Maneuver count exonerated (median parity; one 237-flip churner in the
   tail).
NEXT-PUSH CANDIDATE #1: "return-to-line pressure after deflection in narrow
water" — the band-trust idea (trust the plan-aligned candidate) applied to
POST-DEFLECTION RECOVERY. Mechanism gate box: leg-3 subs 0-7 thread
(x~150-235, y~1006-1280), judged on bot spd + latOff vs this probe's
baseline. Probe: _m5_approach.js (any venue/leg/band).

## OWNER RULING (2026-08-09, line-holding — constrains candidate #1)
Return-to-line must be ROLE-AWARE, per the rules:
- STAND-ON + not imminent → MAINTAIN COURSE (the line pressure applies here,
  hard). A planned tack that creates a collision is legal if the other boat
  has RRS-16 time to respond — take it; bail only if they never react (they
  take the foul).
- GIVE-WAY → no reactive nibble-deflections; plan a DISCRETE evasive early
  (clear slot, duck, or round after/wider) then re-commit to a line.
- MARK-ZONE ENTRY: first-in on the same tack has rights — plan arrival
  timing/tack to ENTER WITH RIGHTS and commit the aggressive clean line;
  if rights are unavailable, choose the go-behind line EARLY. This addresses
  the leg2-sub9 armed queue and leg3-band0 exit scrum as one decision made
  too late, not two execution problems.
Full verbatim + design constraints in memory regatta-tactical-doctrine.

================================================================================
## 2026-08-09 evening — ⭐ THE RULE-11 INVERSION FIX (owner-reported). HEAD MOVES.

Owner: "I sometimes see a windward boat getting rights over a leeward boat."
CONFIRMED AS A REAL ENGINE BUG: getLeewardBoat projected the pair separation
onto the fixed wind-PERPENDICULAR axis with a tack-based sign. The RRS
definition is HULL-FRAME ("the boat on the leeward side of the other"; on a
run, "the side on which her mainsail lies") — and the hull's leeward side
crosses the wind-perpendicular at a beam reach. Result: RULE 11 WAS INVERTED
ON EVERY BROAD REACH AND RUN, BOTH TACKS, since the engine was written.
test_rule11.js (NEW, 12-case point-of-sail matrix): old engine 7/12 FAIL,
fixed engine 12/12 PASS; test_markroom.js still PASS. Fix: project onto the
pair-averaged hull leeward-side direction (getTack already owns the
by-the-lee boom case).
AUDIT ALSO VERIFIED (same owner request): rule 13 no-sail-zone handling is
CORRECT (physics-level head-to-wind crossing sets isTacking for ANY boat,
incl. drift-through-irons; clears at close-hauled; luff-to-HTW keeps
rights); rule 18 zone entitlement matches RRS 2025-2028 18.2(a)(1)/(2)
(inside-if-overlapped, else first-to-zone) with 18.2(b) exits; STILL MISSING
from rule 18: 18.1(a)(3) approaching-vs-leaving, 18.3, 18.4. Doctrine nit:
tack-to-cover is RRS 13+15, not 16 (memory corrected).
GATES (correctness fix — the model-accuracy ruling applies; benches measure
transitional cost, they do not gate the rule being right): redrock pooled
+3.0 med / +9.8 mean (per-set med −27..+28 — a full interaction reshuffle),
fins 427/432; lake −3.0/+1.0 mean; bay +2.7/+1.6 mean (within the 4-set
band) with rubs +33-35% both sets (the deflection underlay was TUNED AGAINST
THE INVERTED RULE — re-baseline the gw-ledger on the true model); lagoon
−3.3/+6.4; river pooled fins 263→262, med +1..+5 (rub columns 6x-noise,
ignored per rule); **ARCTIC WINS: med −9/−15/+7(mean −3.9)/−8, in-time +32
over 576** — correct downwind roles resolve floe traffic better; ocean −1
med, rubs −7%, one DNF (watch); seatrials byte-equal. Goldens full --update
PASS 20/20. freeze CLEAN.
NEW ANCHORS: r11rr* pooled 520/294-ish fins 427/432; r11lake* r11bay*
r11lag* r11riv* r11oc r11arc{A..D} (arctic in-time 96/106/122/125).

================================================================================
# THE ROUNDING PUSH — directive (written 2026-08-09 evening, owner-aligned)

GOAL: redrock < 2x vs her 218.2 (pooled < 436; at 520 finisher-med / ~510
DNF-at-900 on HEAD `056dc2b`), by attacking what the mark-5 decomposition
and the owner's doctrine identified: the water AROUND roundings — the
approach thread, the zone entry, and the exit — under correct rules.
Anchors: r11* everywhere. Baselines for role/deflection stats are STALE
(pre-rule-11-fix); re-measure before designing against them.

## Phase 0 — re-baseline the trajectory stats on the fixed rules (no builds)
_m5_approach.js on HEAD + add avoidanceRole/threat logging: the key number
is WHAT SHARE OF THREAD DEVIATION IS STAND-ON (under inverted rule 11 it was
unattributed; the fix may have moved it). Also refresh _gw_ledger2 on a new
schema-2 recording if the owner delivers laps. 1-2 runs, ~30 min.

## Phase A — THE THREAD LINE (candidate #1, biggest + cleanest)
Target: leg-3 subs 0-7 (bot 39-57 u/s vs her 78-90, 81-161u off her line,
0% throttle/armed, 55% avoid-deviating pre-fix). Same family: river leg 3,
leg-5 subs 6-7, leg-1 beat share.
BUILD (role-aware, per the owner's line-holding ruling):
  STAND-ON boats in narrow water (navigable-clearance venue-class test, the
  noSubsample shape) suppress avoidance deviation from the PLAN-ALIGNED
  heading until risk is genuinely IMMINENT — hold the line the rules let
  them hold. Give-way boats: unchanged in v1 (discrete-resolution planning
  is Phase B/C material). Precedent: THE BAND-TRUST LANDING (same "trust
  the router's own line" shape, biggest win of the campaign).
GATES: mechanism gate at the subs 0-7 box (bot spd + latOff vs the
_m5_approach baseline) BEFORE any 6-set; then pooled 6-set vs r11rr*; full
battery (bay rubs is the watch column — the underlay is re-tuning to the
fixed rule 11); river 16x2 (transfer expected).

## Phase B — ZONE-ENTRY RIGHTS PLANNING (the owner's unifier; design task)
One decision at 400-700u out (exactly where A1 showed no machinery makes
any decision): WILL I ENTER THE ZONE WITH RIGHTS?
  - predict own zone-arrival vs nearby same-leg rivals (ETA + overlap
    geometry at the zone boundary);
  - CONTEST: arrive first / inside-overlapped (18.2(a) verified) → commit
    the aggressive clean line early (the owner: commitment IS the clean
    rounding);
  - CONCEDE: choose the go-behind / wider entry NOW, not a reactive
    deflection at the mouth.
Addresses BOTH the leg-2 arrival crawl (~19 s/boat, armed queue at
250-360u) and the leg-3 band-0 exit scrum (29.5s vs 10.8, med 8 wall
contacts — scrums are made at entry). Constraints: Freezing-Robot
(station-keeping dead — concede = a different LINE, never a hold);
the m5 wedge lesson (watch rubs); funnel metering stays as the fallback.
GATES: bowl box (leg2 subs7-9 + leg3 band0 TOGETHER — they are one queue),
mark-5 entry box, then 6-set + battery.

## Phase C — residuals (only after A/B verdicts)
  C1 leg-5 subs 6-7 medium solo stalls: ONE ESCAPE entry-shape variant —
     futility counted in WIGGLE FAILURES (>=3 failed bursts && solo), not
     seconds (⛔ threshold ladder dead at the fleet gate). Box-gated, stop
     at one shape.
  C2 the armed-approach throttle (subs 15-19, 29-69% sl<1, worth ~1-2s):
     LAST, only with a venue-class scoping story — it re-prices the landed
     funnel metering (lake queues are its home turf).

## Standing method (unchanged + additions)
Mechanism gate at the box before any 6-set — but remember B2: the box
cannot see fleet perturbation; only the pooled 6-set lands. 96-seed
protocol near threshold. DNF-at-900 med/mean quoted BESIDE finisher-med
(the ESCAPE landing changed the population). The owner table with every
status update. New laps: _traj_fp.js, intake same-day. Rule-18 gaps
(18.1(a)(3), 18.3, 18.4) are a separate rules push — do not mix into A/B.

================================================================================
## 2026-08-09 evening — PHASE 0 + ⭐⭐ THE TACK-AWARE PLAN REFERENCE LANDING (A2)
Behavior HEAD `d8389f3`. Anchors: `a2*` everywhere (a2rr{9400..9900}, a2lakeA/B,
a2bayA/B, a2lagA/B, a2oc, a2seaid; river/arctic keep r11 — byte-identical).

### PHASE 0 — the re-baseline killed Phase A as written
The owner's load-bearing question, answered: **4.0%** of thread deviation is a
STAND-ON boat yielding water the rules let her hold (4.5% whole-leg-3, 5.1%
leg-5, 2.6% river leg-3). It is structural, not marginal: **STAND_ON is 0.2% of
ticks in the target box — 1 of 568** — because the rules deciding the pairings
there are **13 (we are tacking) 54%** and **21 (we are on a penalty) 40%**. A
boat mid-tack has no rights to hold; the thread is a queue, not a crossing.
AUDIT (rule 18): pairwise rights over EVERY rival within 250u are 49.9%/50.1%,
symmetric as the rules require; the 1:3 skew among ELECTED threats is explained
— rule-13/21 states are give-way by the boat's own action and also raise
closure risk. The old "55% avoid-deviating" was `lastAvoidDeviation != 0` =
TOTAL deflection from every cause; it was never a traffic statistic.
WHAT ACTUALLY DEFEATS THE LINE (share of deviation-radians): land 78.9% (L3) /
84.3% (L5) / 91.7% (river); traffic-we-owe 8.8/6.3/2.3; traffic-we-hold 5.6/5.7/
2.7. Hard vetoes are 74.5-100% the router's GRID HARD ZONE; the gradient margin
is 64.6% (box 84.8%) the CLEARANCE BAND.

### THE MECHANISM: the trust test cannot be reached on a beat
`pathSailable` is an A* over a clearance-weighted grid with NO WIND TERM, so
upwind the router's line runs straight up the corridor and `hPlanFF` points dead
into the no-go. The HZ3B trust test then asks a sailing boat to be within 0.3
rad of a heading no boat can sail — with the irons guard at 0.62 the minimum
achievable on a beat is ~0.5. Measured in the thread box: 0-rung passes trust
**3.9%**, 96.1% of failures are the ALIGNMENT clause alone at med **0.78 rad
(45deg)**, and on **72% of ticks NO candidate in the fan earns the trust**.
AND IT COSTS SPEED: 0-rung TWA 0.66 (38deg, sailing) vs winner 0.50 (29deg);
**51.4% of chosen headings sit inside the no-go band against 0.0% of the plan
rung** — the argmin's cheapest escape from an untrusted land term is to luff.

### THE LANDING (A2, `d8389f3`)
When the plan bearing is itself inside the no-go, measure alignment against the
CLOSE-HAULED HEADING FOR THE TACK THE BOAT IS ON. Same 0.62 constant the irons
guard already uses; no clause relaxed (irons/arc/open-water/current all still
apply; other tack or bearing away still fails). Actions-not-prices: it changes
which candidates are TRUSTED, not what anything costs.
GATES: redrock pooled 6-set **-64.0 med / -59.9 mean, ALL SIX SETS NEGATIVE**
(-41,-50,-58,-62,-74,-100), med **520->459 (2.38x -> 2.10x)**, fins 427->430/432,
DNF-at-900 5->2, censored med -64.0, land -13%, mark -23%, boat -4%, pen -9% |
lake -2.0/-8.0 med, land -12%/-24%, boat -16%/-11% (the v1-waiver kill venue
moves the RIGHT way) | bay 0.0/0.0 med, rubs -18%/-4% | lagoon 0.0/-6.0 med,
land +11%/-32%, **boat +16%/+13% = THE WATCH COLUMN** | ocean inert | river +
arctic + seatrials BYTE-IDENTICAL vs same-session baselines | goldens full
--update PASS **30/30** | freeze CLEAN.
BOX GATE (_m5_approach leg-3 subs 0-7): bot 41-52 -> 72-78 u/s vs her 70-90,
time in band -16%; instrumented box: trust pass 3.9%->38.9%, total deviation
192.3 -> 44.7 rad (-77%). Lateral offset RISES in subs 1-5 (91->126, 170->204):
the boats sail a proper beat instead of a pinched one and extend further before
tacking — the fleet bench is what says that is worth it.

### ⚠️ NEW TRAP (harness): `--update` AT THE WRONG SEED WIDTH SILENTLY NARROWS
THE GOLDEN FILE. `node run_traces.js --update` defaults to 2 seeds; the stored
goldens are 3 seeds (30 traces). A plain full `--update` rewrote 30 -> 20 and
then PASSED 20/20 — a green gate on a third less coverage. Same destructive
shape as the recorded `--venue X` trap, on the seed axis. ALWAYS use
`npm run trace:update` (which passes --seeds 3) and check the trace COUNT in
the PASS line against the file.

### NEW TRACKED PROBES
`_thread_role.js` — role/risk deviation ledger, 0-rung defeat attribution with
PER-RIVAL role (role cached per tick; getRightOfWay reads current state, not the
candidate heading), static/veto source buckets, band-trust clause breakdown,
pinch test, pairwise-role audit. Needs an instrumented tree: treeP0R / treeP0S
(source buckets + rule capture + trust flags + TWA), treeA2S (same on A2).
`_pool_rr900.js` — pooled redrock CENSORED at the 900 cutoff; quote it beside
the finisher median (the ESCAPE-landing composition trap).

### NEXT
Goal now 459 -> 436 for 2x. Phase B (zone-entry rights planning) is unchanged and
untouched by this landing. The WIND-AGNOSTIC ROUTER is its own push, not Phase B:
a planner-model change reshuffles every route on every venue and would confound
A/B attribution — and it is now better posed, since the local layer treats a beat
correctly. Lagoon boat rubs (+14% across both sets) is the open watch column.

================================================================================
# NEXT-PUSH DIRECTIVE — THE GROUNDING PUSH (research pass, 2026-08-09 evening)
Measured on `d8389f3` after the A2 landing. NOTHING BUILT — owner decision pending.

## ⚠️ FIRST, A METHODOLOGY CORRECTION (standing rule 26)
The redrock per-leg MEDIAN table reads sub-2x on every leg while the lap ratio is
2.10x. Both are right: medians do not add. Sum of per-leg medians 383.0, sum of
per-leg MEANS 463.4, mean lap 463.4, median lap 459.0. Each leg is right-skewed
and DIFFERENT boats occupy the tail on DIFFERENT legs, so no boat sits at the
median on all seven. **Attribute gap shares on MEANS.** Corrected: legs 1/2/3/5
are 2.29/2.68/2.30/2.09x and **leg 2 is the worst real leg**, not the mildest.
(Also: `_leg_matrix.js` takes `fp=` FIRST — omitting it pools retired-doc laps.)

## THE REMAINING GAP, ATTRIBUTED (mean basis, +246.1 s/boat total)
leg1 +37.6 (2.29x) | leg2 +37.5 (2.68x) | leg3 +71.6 (2.30x) | leg4 +22.7 (1.85x)
| leg5 +59.5 (2.09x) | leg6 +11.1 (1.39x) | leg0 +6.1

## ⭐ FINDING 1 — THE GROUNDING TAX IS THE TAIL (r² = 0.90)
`collision_island` multiplies speed by 0.4 on the spot. The fleet takes **16.4
grinding episodes per boat-race** (median 115 raw contacts each) **entered at 72
u/s** — boats at speed hitting rock. **TAX 90.8 s/boat** (6 seeds, 883 episodes);
legs 3+5 = 67% (30.7 + 30.3); share of each leg: L5 47%, L4 43%, L6 39%, L3 36%,
L2 19%, L1 18%; 33% of the whole gap.
Per-boat tax vs finish: **r = 0.95, r² = 0.90**. Q1 357/48.0s, Q2 432/76.1,
Q3 494/100.0, Q4 581/136.7 (~2.5s of finish per 1s of tax → the integral
UNDERSTATES). ⚠️ Association, not proof — but contacts PER SECOND rise 2.7x
Q1→Q4, which is the argument against pure exposure, and even Q1 pays 48s.
⚠️ Cap-sensitive: median episode 9.7s against a 12s follow cap. Order of
magnitude, never a gate. Probe `_ground_tax.js` (NEW, tracked).
MECHANISM (from the code): the contact reflex steers STRAIGHT OUT along the
collision normal and latches 2.0s at full speed (~script.js:862). In a canyon
that points at the opposite wall — `applyAvoidance`'s own comment calls it "the
very ping-pong (bounce off each wall toward the other)". ESCAPE cannot catch it
(25s futility, <40 u/s, no rival 150u vs ~10s episodes at 72 u/s entry). At 72
u/s the 2.0s latch commits 144u to one frame's normal. Repeating sites: leg 3
(-89,151) (-674,-1634) (-1074,-1356) (89,-326); leg 5 (-1557,645) (-1399,536).

## FINDING 2 — EXTRA DISTANCE ON THE BEAT (legs 1-2, ~61s net of grounding)
`_leg_odo`: leg 1 bot 4068u vs her 2540u on a 1970u straight line (60% further;
her 1.29x, bot 2.06x); leg 2 3040 vs 2252 (35%). `_leg_where` leg 1: NO POCKET —
slow time spreads 12/7/14/16/1/9/10/9/11/11% at near-parity speed. Not "slow
somewhere": a longer path everywhere. Same family as bay/lake/ocean's WHOLE gap
(never decomposed); redrock is where it is big enough to measure, so a win should
transfer to the three venues now at 1.10-1.14x.

## THE PLAN (ranked)
1. **H1 TANGENTIAL PEEL-OFF** — replace the normal-out bounce with a heading along
   the wall tangent toward course progress, when the boat has way on and a
   sailable tangent exists. Action-shaped; precedent in the same function (the
   mid-rounding branch already biases along a rotation tangent). MECHANISM GATE on
   **leg 5** (47%, cleanest) via `_ground_tax`, confirm leg 3, then pooled 6-set +
   battery. Watch column: boat rubs — peeling keeps boats in the lane.
2. **RE-MEASURE THE TAIL AFTER H1** before building for leg 2: if the coupling is
   causal, leg 2's 2.68x skew moves without its own candidate.
3. **H3 BEAT DISTANCE** — measure bot tack count + cross-track spread vs her 2-4
   tacks before proposing any shape.
4. **H2 THE 2.0s LATCH** — LAST, shape-only (re-evaluate when the normal rotates
   past X°), never a threshold ladder (the B2 kill).
Carried forward: lagoon boat rubs +14% (watch), Phase B zone-entry rights, and the
WIND-AGNOSTIC ROUTER as its own push.

## RESEARCH COMPLETED (2026-08-09 late evening) — the full inventory
Four more probes closed the remaining unknowns. The gap is ONE dominant
mechanism with a tributary, ONE pocket, and ONE distance class.

### 1. GROUNDING — robust at 90-100 s/boat, and it IS the tail
Cap sensitivity settled: RECOV 12s -> 90.8 s/boat (16.4 episodes/boat-race),
RECOV 30s -> 100.0 s/boat (10.6 episodes, more merge into one). r stays
0.93-0.95, r^2 0.87-0.90, slope 1.94-2.5s of finish per 1s of tax. The 12s cap
was NOT badly truncating; the sizing is stable.

### 2. PENALTIES — 13.3 s/boat, and HALF OF IT IS DOWNSTREAM OF GROUNDING
`_pen_tax.js` (NEW): 3.07 penalties/boat (matches engine `totalPenalties`
exactly), **94% of boats take >=1**, spin time 13.3 s/boat (med 9.9, p90 24.5),
**0.00 turns unpaid at the finish** so no 15s adders. Rule mix: **Rule 19
(room at an obstruction) 47%**, Rule 31 (mark touch) 20%, Rule 10 17%, Rule 13
7%, Rule 11 6%. Rule 19 is MANUFACTURED BY THE GROUNDING — the collision
handler penalises the outside boat when an overlapped boat hits land. Per-leg
penalties track the grounding legs exactly (L3 0.98, L5 0.65, L2 0.59).
⚠️ PROBE TRAP (rule 18): `onRaceEvent('penalty')` fires BEFORE `rs.penalty` is
set and sustained grinding re-triggers it EVERY FRAME — the raw event count read
304 penalties/boat against a true 3.07. Count the transition (`!rs.penalty` at
event time) or read `totalPenalties`. The re-fire rate is itself a finding: 255
per boat-race.

### 3. LEG 2 IS A POCKET, NOT A TAIL — 69% of the leg in sub 9 alone
`_leg_where` leg 2: sub9 human 3.0s vs bot 24.7s = **+21.7 s/boat, 69% of the
leg's gap**; every other subsection is within 0.3-1.7s. That is the mark-6 bowl
ARRIVAL (armed 69%, landAhead 50%, wiggle 42%), already known and already down
from +35. ⚠️ Corrects the mid-session read that leg 2's 2.68x was diffuse/tail-
driven: it is one place.

### 4. LEG 1 IS AVOIDANCE + TACK COUNT, NOT ROUTING
`_beat_decomp` leg 1: odometer 4140u vs a 1763u straight line, **tacks med 9
against her 2-4**. Waste: AVOID_GW **899u (16s)**, AVOID_NONE 373u (10s),
TACKWIN 349u (11s), CLEAN 263u (10s), ARMED 167u, AVOID_ROW 70u. So the 60%
excess distance is give-way avoidance plus twice the tacks — THE FLEET AVOIDANCE
TAX (open thread) meeting the tack-count class, not a routing defect.

## THE FINALISED PLAN
1. **H1 TANGENTIAL PEEL-OFF** — the contact reflex steers straight out along the
   collision normal and latches 2.0s at full speed; in a canyon that aims at the
   opposite wall. Replace with a heading along the wall tangent toward course
   progress when the boat has way on and a sailable tangent exists. Expect it to
   pay TWICE: the grounding tax AND the 47% of penalties that are Rule 19.
   MECHANISM GATE: `_ground_tax` on leg 5 (47% of that leg), confirm leg 3, then
   `_pen_tax` for the rule-19 knock-on, then pooled 6-set + battery. Watch
   column: boat rubs (peeling keeps boats in the lane instead of bouncing out).
2. **RE-MEASURE EVERYTHING AFTER H1** — the tail coupling, the penalty mix, and
   leg 2's sub9. If the coupling is causal, several of these move together and
   the next candidate should be chosen on fresh numbers, not these.
3. **THE BOWL ARRIVAL (leg2-sub9, +21.7 s/boat)** — a known pocket; the previous
   push re-sized the arc-ungate to death (crawl at 280-360u is outside arc
   range) and named it a queue behind parked rivals. Needs the zone-entry-rights
   design (Phase B), not another local shape.
4. **LEG 1 / THE FLEET AVOIDANCE TAX** — 899u of give-way waste and 9 tacks vs
   her 2-4. Transfers to bay/lake/ocean (their whole gap). Measure before
   building; AV1 was already inert once, so the 0-rung defeat is overdetermined.
5. **H2 THE 2.0s LATCH** — LAST, shape-only, never a threshold ladder.

## ⏭ CARRY-FORWARD PROMPT FOR THE NEXT INSTANCE (verbatim, 2026-08-09 close)
See the finalised plan above for the evidence; this is the paste-ready brief.
State: HEAD d8389f3, redrock 2.10x (459 vs 218.2), goal <436. Anchors a2* (river
+ arctic keep r11, byte-identical). Baseline tree treeA2 (≡ HEAD, comment-only
diff). Goldens 30/30, freeze CLEAN. Read [[regatta-grounding-tax]] first.
RESEARCH IS DONE — do not re-derive: grounding 90-100 s/boat and it IS the tail
(r² 0.87-0.90); penalties 13.3 s/boat of which 47% are Rule 19 manufactured BY
the grounding; leg2-sub9 is a pocket (+21.7, 69% of the leg); leg 1 is avoidance
(899u give-way) + 9 tacks vs her 2-4.
A: H1 TANGENTIAL PEEL-OFF — the contact reflex steers straight out along the
collision normal and latches 2.0s at full speed; in a canyon that aims at the
opposite wall, and ESCAPE cannot reach it. Command the wall TANGENT toward
course progress instead, when the boat has way on. Gate: _ground_tax leg 5 →
leg 3 → _pen_tax (Rule-19 knock-on) → pooled 6-set vs a2rr* → battery. Watch
boat rubs.
B: RE-MEASURE before choosing #2 — tail, penalty mix and leg2-sub9 may move
together.
C: bowl arrival → zone-entry-rights design (NOT another local shape; arc-ungate
is dead); leg-1 give-way waste → the fleet avoidance tax (AV1 already inert
once, measure first).
D: the 2.0s latch, LAST and shape-only, never a ladder (B2 died there).
Guardrails: actions-not-prices; medians do not add (rule 26 — attribute on
MEANS; _leg_matrix takes fp= FIRST); the penalty event re-fires every frame
under grinding contact (count transitions); box gates cannot see fleet
perturbation, only the pooled 6-set lands; DNF-at-900 beside finisher-med;
npm run trace:update (3 seeds/30 traces) never a bare --update; watch lagoon
rubs (+14% from A2) and bay rubs; close with the venue table on final HEAD.

---

# THE GROUNDING PUSH — PHASE A (2026-08-09 night, from HEAD `d8389f3`)

Baselines reproduced before anything was built: leg-5 grounding tax **30.3
s/boat / 305 episodes**, leg-3 **30.7 s/boat**, penalty tax **3.07/boat, 13.3
s/boat spin, Rule 19 47%** — all matching the research pass exactly.

## ⛔ H1 TANGENTIAL PEEL-OFF: KILLED AT THE MECHANISM GATE (`treePEEL`)
Built as specified — the wall tangent toward course progress, chosen off a
20-candidate sailable fan (TWA 0.65-3.1 rad, both tacks), outward candidates
only, scored `tangency + 0.35*outwardness`, gated on way-on + non-floe + not
mid-rounding (the existing rotation-tangent branch keeps that case).

**Leg-5 gate: 30.3 → 41.1 s/boat, episodes 305 → 412.** The probe's own finish
quartiles rose at every quartile (Q2 432→468, Q3 494→539, Q4 581→604). Two
independent reasons, both measured, neither visible in the research pass:

1. **It is nearly unreachable.** `_peel_geom.js` (new; reads the contact normal
   at `collision_island` time, so it needs no candidate tree) says the peel
   fires on **1.8% of land-contact frames**; 98% are blocked by "no way on".
   `boat.speed *= 0.4` compounds EVERY FRAME of overlap, so a boat that enters
   at 72 u/s is under 10 u/s within about six frames. **The research's "entered
   at 72 u/s" is the episode ENTRY speed, not the typical contact frame** —
   median contact-frame speed is ~1 u/s. Rule 2 (episodes ≠ frames) one level
   further down than we had applied it.
2. **The direction was wrong anyway.** When one contact frame costs 60% of
   speed, keeping the boat near the wall is not the prize. Peeling raised the
   episode COUNT by a third.

The ping-pong is real but it is not where the seconds are.

## ⭐⭐ WHAT THE TRACE FOUND INSTEAD: the reflex is switched off by the penalty
`_grind_trace.js` (new) dumps whole episodes frame by frame. It caught a boat at
0.3 u/s taking a land contact on EVERY frame for 1.5s with `iceEscapeTimer` at
zero and the helm owned by plain navigation. script.js ~766 says why:

    if (this.penaltySpin && this.riskState !== 'IMMINENT') { ...; return; }

That `return` is **before `applyAvoidance` (~788), and the island contact reflex
lives inside applyAvoidance (~861/896)**. A boat taking her turns spins at FULL
THROTTLE with no grounding reflex and no avoidance at all. It closes the loop the
penalty research had already half-named: 47% of fouls are the Rule 19 the
collision handler writes when an overlapped boat hits land, so **grounding
manufactures the penalty and the penalty switches off the reflex that would end
the grounding.**

Sized (`_spin_ground.js`, new): spinning 12.3 s/boat, in land contact 29.5
s/boat, **both 2.7 s/boat = 9.2% of all land-contact time**; **22% of
penalty-spin time is spent in contact with land**; 10.4% of grinding-episode
frames; 12% of episodes BEGIN under a spin.

## GRIND ANATOMY (the picture the tax integral could not show)
Episodes ≥1s: median 3.1s, **duty cycle median 58%** — only 5% exceed 80%
("glued"), 19% are under 40% ("bouncing"). Grinding is repeated re-contact, not
one long overlap. Path 39u, net displacement 30u, mean speed 5.3 u/s.
Helm owner across grinding-episode frames: **contact-reflex 84.6%**,
penalty-spin 10.4%, plain-nav 3.3%, clearance 1.1%, wiggle 0.5%.
Command stability: the commanded escape heading changes by a **median 0.0°/frame**
— the reflex is NOT chasing a jittering normal, which removes the motivation for
Phase D as a jitter fix. But the helm sits a standing **51°** away from it, and
at the steerage floor (0.6) the turn rate is `0.015 * 0.6 * 60 ≈ 31°/s`, so **a
90° escape turn takes ~2.9s against a 2.8s median episode — the escape turn
takes as long as the grind it is meant to end.**

⚠️ PROBE TRAP (rule 18, self-caught mid-session): the first ownership table
ranked WIGGLE above the reflex and under-read the reflex by 25 points.
Precedence is NOT source order — update() sets desiredHeading from
wiggle/clearance/nav first (~614/657), `penaltySpin` may return before avoidance
(~766), then applyAvoidance OVERWRITES it (~896). True order: spin > escape >
contact-reflex > mark-reflex > wiggle > clearance > nav.

## THE TWO CANDIDATES THIS PRODUCED
Both are reachability fixes, and neither introduces a number that did not
already exist in the file.

* **`treeSPIN` — a boat taking her turns still has to keep off the rocks.** The
  `riskState !== 'IMMINENT'` exception already says the spiral yields to
  something worse; being aground is something worse. Guard becomes
  `&& !aground && !(this.iceEscapeTimer > 0)`; deferring to the EXISTING 2.0s
  latch (rather than a new timer) stops the spiral's next hard turn putting her
  straight back on the rock. Rotation credit decays at only ~7°/s (~12551), so
  the interruption costs ~0.24 rad of a 2π turn.
* **`treeSNAP` — the contact reflex gets the snap turn the other two escapes
  already have.** ~11219 grants 5x turn authority to wiggle and escape with the
  comment "a wedged boat has no steerage". A boat aground is a wedged boat by
  that same definition, and it was the one escape left out. Same 5x, no new
  number. `treeBOTH` = the pair (composition rule: bench redrock pairs together).

## THE LEG-5 MECHANISM GATE, ALL FOUR TREES (6 seeds, 54 boat-races each)
The finish quartiles are whole-race clocks over the same seeds, so they are the
more trustworthy column — the tax integral is cap-sensitive by construction and
the research already said never to gate on it alone.

| tree | leg-5 tax s/boat | episodes | Q1 | Q2 | Q3 | Q4 |
|---|---|---|---|---|---|---|
| `treeA2` (base) | 30.3 | 305 | 357 | 432 | 494 | 581 |
| `treePEEL` (H1) | **41.1** | 412 | 363 | 468 | 539 | 604 |
| `treeSPIN` | 20.3 | 208 | 295 | 398 | 455 | 531 |
| `treeSNAP` | **15.7** | — | 295 | 357 | 404 | 491 |
| `treeBOTH` | 15.9 | — | 302 | 372 | 419 | 514 |

**The snap turn alone is the strongest single change** — leg-5 tax halved and
every quartile above Q1 improved by 75-90s. The pair is not better than the snap
alone (15.9 vs 15.7, and worse at Q2-Q4), which is the composition rule showing
up again: unscoped pairs go anti-compositional.

⚠️ Six seeds is a box read (rule 20 — redrock is read through the pooled sets or
not at all). These numbers chose which candidate to bench; they do not land it.

### The Rule-19 knock-on is real (`treeSPIN`, `_pen_tax`)
Penalties **3.07 → 2.13 per boat (−31%)**, boats with ≥1 **94% → 87%**, Rule 19
share 47% → 42%, and the foul-detector re-fire rate (itself a grinding signal)
255 → 149 per boat-race. Leg-3 penalties 0.98 → 0.80, leg-5 0.65 → 0.24.
⚠️ WATCH COLUMN, and an honest caveat about its size: measured "spin time" rose
13.3 → 42.8 s/boat, but `_pen_tax` defines that as *time with `penaltySpin`
set*, and treeSPIN deliberately holds the flag while the escape is suspended —
so most of the increase is time NOT spent spiralling. The cost that is
unambiguous is small: unpaid turns at the finish 0.00 → 0.06/boat = 0.8 s/boat.

### The leg-3 tax moves the OTHER way on treeSPIN (30.7 → 43.1)
while the same runs' finish quartiles improve by 40-60s at every quartile. Two
readings, and this session cannot separate them: either the tax integral is
tracking composition (faster boats reach leg 3 in a different fleet
configuration) or leg 3 genuinely trades against leg 5. It is the reason the
verdict below rests on the pooled bench and not on the per-leg integral.

## ⚠️ THE CONTROL THAT CHANGED WHICH TREE LANDS (`treeSNAP2`)
Before believing the snap turn, audit what `iceEscapeTimer > 0` actually selects.
**The timer is decremented in exactly ONE place — inside `applyAvoidance` (~897)
— and a penalty-spinning boat returns before it (~766). So the latch FREEZES for
the whole spin and the flag stays true.** Granting authority on that flag
unscoped therefore hands 5x turn rate to the SPIRAL, for as long as the boat is
flagged, decided by whether she happened to touch land in the previous 2 seconds.
That would clear penalties far faster and masquerade as a grounding win.

`treeSNAP2` is the control: the same grant, plus `&& !penaltySpin`.

| leg-5 gate | tax s/boat | Q1 | Q2 | Q3 | Q4 |
|---|---|---|---|---|---|
| `treeA2` base | 30.3 | 357 | 432 | 494 | 581 |
| `treeSNAP` unscoped | 15.7 | 295 | 357 | 404 | 491 |
| `treeSNAP2` scoped | **18.9** | 316 | 380 | 406 | 509 |

**The mechanism survives the control**: scoped, the escape turn still takes the
tax from 30.3 to 18.9 (−38%) and improves every quartile by 40-72s. The gap to
the unscoped tree is the spiral leak, and it is not something to ship — a 5x
spiral is ~2s per 360°, against a base spiral of ~10s and a real sailor's 10-20s,
and it fires on an arbitrary subset of penalised boats. **`treeSNAP2` is the
tree that goes to the pooled bench**; the frozen latch is logged as a separate
latent defect (it also disables the floe-trajectory refinement at ~844 and the
pack-speed discipline at ~963 for the duration of any penalty).

Corroborating evidence that the leak was never the main driver: spin time PER
PENALTY is unchanged between base and unscoped snap (13.3/3.07 = 4.3s vs
8.8/2.09 = 4.2s) — the spirals are not running faster, there are simply fewer.

## ⭐⭐ THE SNAP-TURN LANDING `3ce099a` — redrock 2.10x → 1.77x
Pooled 6-set vs the `a2rr*` anchors (48 seeds, 432 boats). Both trees were
benched; the SCOPED one landed.

| tree | pooled med | paired med | paired mean | sets negative | fins | DNF@900 |
|---|---|---|---|---|---|---|
| `a2rr*` base | 459.0 | — | — | — | 430/432 | 2 |
| `treeSNAP` unscoped | 386.0 | −69.0 | −72.3 | 6/6 (−53..−96) | 431/432 | 1 |
| **`treeSNAP2` scoped (LANDED)** | **386.0** | **−60.0** | −68.5 | **6/6 (−50..−77)** | **432/432** | **0** |

Dirt per boat, base → landed: boat rubs 11.35 → 8.84 (−22%), mark 3.39 → 2.55
(−25%), **land 110.39 → 47.72 (−57%)**, penalties 2.80 → 2.05 (−27%). 307 of 430
paired boats faster. **386 against her 218.2 = 1.77x**, past the <436 goal for
the first time.

The scoped tree matches the unscoped tree's headline median while finishing the
WHOLE fleet (432/432, zero cutoffs) — so the spiral leak bought a slightly larger
paired median and cost a boat. That is the composition trap `_pool_rr900` exists
to catch, and it argued the same way the mechanism argument did.

Goldens re-recorded, **PASS 30/30** — ⚠️ and note that the bare verify checks 20:
`npm run trace` defaults to 2 seeds while the stored file holds 3 (10 venues × 3).
Trap 24's seed-width lesson applies to the VERIFY side, not only to `--update`.
Verify with `node regatta/eval/run_traces.js --seeds 3`. freeze CLEAN.

## THE VENUE TABLE — final HEAD `3f26634` (anchors `a2*` → `s2*`/`cu2*`)
Every row re-run on the final HEAD at the protocol its `a2*` anchor was recorded
at. Paired medians are cand−base, so NEGATIVE = faster.

| venue | human med | bot (a2, pre) | bot (post) | ratio | paired med | note |
|---|---|---|---|---|---|---|
| seatrials | 189.4 | 196 | 196 | 1.03x | 0.0 | inert (no land contacts) |
| bay | 219.0 | 241 | 241 | 1.10x | 0.0 | inert (4/360 boats differ) |
| lake | 223.1 | 246 | 246 | 1.10x | 0.0 | land contacts −50%; **rubs 2.47→3.03 ⚠️** |
| ocean | 177.9 | 202 | 202 | 1.14x | 0.0 | inert |
| lagoon | 164.9 | 267 | 272 | 1.65x | **+1.0** | ⚠️ gave back the snap turn's −6.0 |
| river | 167.4 | 274 | 279 | 1.67x | **+2.0/+4.0** | ⚠️ the one venue that pays |
| arctic | 212.4 | 374 | **358** | 1.69x | −14.0 | 72/72 finish both |
| **redrock** | 218.2 | 459 | **386** | **1.77x** | **−60.0** | 6/6 sets, 432/432 fins, DNF 2→0 |

Redrock **2.10x → 1.77x**, the goal was <436 and it landed at 386. Arctic gains
16s unasked (the reflex it improves is the same one the granite isle needs).
Bay/ocean/seatrials are inert exactly where predicted — they have no land
contacts for the reflex to act on, which is the cleanest possible confirmation
that the mechanism is the one named.

**The two costs, stated plainly.** Lagoon and river both end slightly slower than
the `a2*` anchors, and both are the ground-frame commit's doing, not the snap
turn's: the snap turn alone had lagoon at −6.0 and river's finishers faster. The
ground-frame escape traded that for river fleet completion (DNF-at-900 pooled
over 162 boat-races: 13 base → 23 snap-only → 15 with the ground frame). Boats
finishing at all was judged worth more than 6s of lagoon median, but it IS a
trade and both should be re-examined; the sets are small (lagoon 2×8, river 6+12)
and neither swing is resolved at these widths by the standing rules.
Lake's boat rubs 2.47 → 3.03 is the third watch column.

## ⏭ CARRY-FORWARD PROMPT FOR THE NEXT INSTANCE (verbatim, 2026-08-09 night close)
State: HEAD `c14e428`, behaviour HEAD `3f26634`. **Redrock 1.77x (386 vs 218.2)**
— the <436 goal is met, so redrock is no longer the biggest venue gap. Anchors:
`s2*` (snap turn) and `cu2lag*`/`rivCU*` (ground frame); the `a2*` set is the
pre-session baseline. Baseline tree `treeFIN` (≡ HEAD, verified). Goldens PASS
30/30 at `--seeds 3`, freeze CLEAN.

READ [[regatta-grounding-tax]] FIRST — the mechanism story is complete and should
not be re-derived. Two landings, both REACHABILITY fixes rather than new prices:
the contact reflex got the 5x snap turn that wiggle/escape already had (its
commanded escape took ~2.9s to reach against a 2.8s median grind), and the escape
now chooses its heading in the GROUND frame instead of the boat frame.

WHAT IS OPEN, IN THE ORDER THE EVIDENCE RANKS IT:
1. **THE TWO COSTS.** Lagoon +1.0 (was −6.0 before the ground-frame commit) and
   river +2/+4 with finishers 5-8s slower. Both are the ground-frame commit's
   doing, both are small sets (lagoon 2×8, river 6+12), neither is resolved at
   those widths. Re-bench WIDER before touching either — a 6s lagoon swing is
   inside the noise the standing rules describe.
2. **`treeSPIN` IS STILL UNFIXED AND IS A REAL BUG.** script.js ~766: a boat
   serving her penalty turns `return`s before `applyAvoidance`, so she has NO
   contact reflex and no avoidance at full throttle — 9.2% of all land-contact
   time. It was the weaker candidate this session (leg 5 30.3→20.3 but leg 3
   30.7→43.1) and it was measured against the OLD weak reflex. The reflex is now
   much stronger, so re-test it on this HEAD; the tree still exists.
   Related latent defect: `iceEscapeTimer` is decremented only inside
   applyAvoidance, so it FREEZES for the whole of any penalty — which also
   suspends the floe-trajectory refinement (~844) and the pack-speed discipline
   (~963) for that duration.
3. **FAMILY B IS NOW THE FRONTIER.** bay/lake/ocean are 1.10/1.10/1.14x and their
   WHOLE gap is extra distance on the beat (16-27% further while sailing FASTER
   through the water) — and all three are byte-inert to everything landed this
   session. Never decomposed. Measure before proposing a shape.
4. Redrock's own residue: leg2-sub9 (the mark-6 bowl, +21.7 s/boat) belongs to the
   zone-entry-rights design, NOT another local shape; leg 1 is the fleet
   avoidance tax (899u of give-way waste, 9 tacks vs her 2-4).
⛔ DEAD, do not rebuild: **H1 TANGENTIAL PEEL-OFF** (leg-5 30.3→41.1; fires on
1.8% of contact frames). Phase D's jitter motivation is also dead — the commanded
escape heading is stable at a median 0.0°/frame.

GUARDRAILS (the ones that actually bit this session):
· Actions-not-prices is now 9-for-9 — both landings changed which actions EXIST.
· An episode's ENTRY statistic is not its typical FRAME statistic (rule 28): "72
  u/s" was the episode entry; the median contact frame is ~1 u/s.
· Override precedence is not source order — find the LAST writer (rule 27).
· A timer decremented in one place freezes wherever that place is skipped (rule
  29) — it nearly attributed the whole win to the wrong mechanism.
· `npm run trace` verifies only 20 of the 30 stored traces. Use
  `node regatta/eval/run_traces.js --seeds 3` and read the count in the PASS line.
· Watch columns: lake boat rubs 2.47→3.03, lagoon, river.

## POST-LANDING: WHY LAGOON, ACTUALLY (`_cur_rank.js`, `_esc_current.js`)
The owner's read was that river and lagoon regressed because they are the two
highest-current venues. The ranking confirms the premise and the site
measurement refutes the conclusion for lagoon:

| venue | mean kt | p50 | p90 | max | % cells >1kt | AT THE ROCKS BOATS HIT |
|---|---|---|---|---|---|---|
| river | 1.38 | 1.00 | 3.05 | 5.14 | 48% | **3.98** |
| lagoon | 0.39 | 0.34 | 0.85 | 1.10 | 3% | **0.00** |
| bay | 0.34 | 0.30 | 0.50 | 0.69 | 0% | — (no land contacts) |
| redrock/lake/ocean/arctic/seatrials | 0.00 | — | — | — | 0% | 0.00 |

Lagoon is second-highest overall and carries **no stream at its own grounding
sites** — its current is not where its rocks are. The ground-frame escape
therefore barely fires there, and lagoon's −6.0 → +1.0 is most likely fleet
reshuffling off a handful of fired escapes rather than a systematic cost.
Re-bench wider before treating it as a regression. **A venue-level property can
be true and still not be the cause; check it at the SITES the mechanism acts on.**

⭐ The same probe found lagoon's actual defect, and it is not current. With no
stream, the outward-track figure reduces to the polar speed at the commanded
heading — and it is ~0 on **29.8% of lagoon's land contacts**: the escape commands
a heading inside the no-go, so the boat is told to sail straight out of the rock
at an angle she cannot sail. Redrock is 1.5%. A sailable heading with a good
outward track existed in ALL of them (best track median 114 u/s).
NEXT CANDIDATE: pick the escape off the sailable fan by best outward track
ALWAYS, not only under a stream. ⚠️ It stops being byte-inert on redrock (1.5% of
contacts), so it needs its own gate against the `3ce099a` landing.

---

# RESEARCH FOR THE NEXT PUSH (2026-08-09 night, on HEAD `3f26634`)
Owner's call: stay on redrock, it is still the highest ratio. Everything below is
measured on the landed HEAD; `_leg_matrix.js` now prints a MEANS table beside the
median one (rule 26 lived only in the memory before — the probe apportioned on
medians, which is the error the owner caught last session).

## REDROCK'S REMAINING 176.4 s/boat (mean), 1.81x
| leg | human | bot | delta | ratio | share |
|---|---|---|---|---|---|
| 0 | 1.2 | 7.6 | 6.4 | 6.43x | 4% |
| 1 | 29.1 | 56.2 | 27.1 | 1.93x | 15% |
| 2 | 22.4 | 52.7 | 30.3 | **2.35x** | 17% |
| 3 | 55.2 | 104.4 | **49.1** | 1.89x | **28%** |
| 4 | 26.5 | 49.5 | 23.0 | 1.87x | 13% |
| 5 | 54.5 | 84.9 | 30.4 | 1.56x | 17% |
| 6 | 28.6 | 38.8 | 10.1 | 1.35x | 6% |
| TOT | 217.4 | 394.0 | 176.4 | 1.81x | |
The landing's −69.4s of mean matches the bench's −68.5 paired mean, and legs 3+5
supplied 51.5s of it (74%) — the legs the grounding research named. Mechanism
confirmed end to end.

## ⭐⭐ FINDING 1 — THE SW-MARK BOWL IS ONE PLACE WORTH 47.7 s/boat (27% OF THE GAP)
`_leg_where` on both legs, and the two pockets are ADJACENT:
| pocket | delta | share of leg | human vs bot | state |
|---|---|---|---|---|
| leg2 sub9 (-920,-1621) | **+21.0** | 66% of leg 2 | 3.0s vs 24.0s | **armed 80%**, landAhead 54%, deflected 44% |
| leg3 sub0 (-747,-1416) | **+26.7** | 54% of leg 3 | 3.8s vs 30.4s, 83 vs **35 u/s** | landAhead 54%, deflected 43%, wiggle 27%, **armed 7%** |
These are the APPROACH and the EXIT of mark 5 `sw` (-883,-1628). The campaign has
carried the bowl as an arrival problem; **the exit is the bigger half and is not a
rounding problem at all.**

`_pocket_split.js` (NEW) settles what kind of problem it is. Pocket (-830,-1520)
r=420, 36 boat-visits: **63.9 s/boat spent inside a 420u circle at 51 u/s**;
23.9 s/boat under 40 u/s, of which **IN LAND CONTACT only 3.5 (15%)** and **SLOW
BUT NOT TOUCHING 20.4 (85%)**. State mix: **deflected 51%**, landAhead 39%,
armed 33%, contact-reflex 25%, wiggle 11%, irons 10%, penalty-spin 3%.
⇒ **THE BOWL IS NOT A CONTACT PROBLEM.** It is the FLEET AVOIDANCE TAX in
constrained water — boats spend half their time in there deflected by rivals.
Geometry note: a 76u rock at (-941,-1373) sits ~260u from the mark, in the exit
corridor.

## FINDING 2 — GROUNDING IS STILL THE TAIL, BUT THE ESCAPE IS NO LONGER THE LEVER
Tax **65.7 s/boat** (was 90-100) and the coupling did NOT weaken: r = 0.95,
**r² = 0.90**, slope 1.90 (quartiles by finish 316/31.4, 380/52.0, 406/65.4,
509/111.4). Episodes/boat-race 16.4 → 14.8 (−10%); tax per episode 5.5 → 4.4
(−20%). And `_esc_current` on redrock says the commanded escape is now
near-optimal AND sailable: track into the rock **1.5%**, achieved 127.2 u/s
against a best-possible 128.6. ⇒ **the remaining lever is ARRIVAL — why boats
reach rock 14.8 times a race against a human who grounds ~0 — not escape quality.**

## FINDING 3 — THE PENALTY-SPIN HOLE TRIPLED IN RELATIVE SIZE
Because the landing fixed everything around it:
| | pre | post |
|---|---|---|
| of land-contact time | 9.2% | **18.1%** |
| of grinding-episode frames | 10.4% | **30.4%** |
| episodes that BEGIN while spinning | 12% | **31%** |
Spin-dominated episodes now last 2.3s against 1.4s for the rest.
⚠️ BUT re-gating `treeSPIN2` (= HEAD + the fix) is AMBIGUOUS, exactly as it was
last time: leg-3 tax 19.7 → 26.9 (worse), leg-5 18.9 → 19.8 (flat), while the
same runs' finish quartiles improve (Q2 380 → 368, Q4 509 → 498). Settle it with
ONE pooled 6-set bench; do not assume it either way.

## FINDING 4 — THE GRIND ANATOMY AFTER THE LANDING
| metric | pre | post |
|---|---|---|
| land-contact time | 29.5 s/boat | **11.5** |
| episodes ≥1s | 435 | **112** |
| median episode | 2.8s | **1.6s** |
| duty cycle | 59% | **30%** |
| "bouncing" (<40% duty) | 19% | **57%** |
| helm tracking error | 51° | **21°** |

## CONTEXT GATHERED BEFORE THE REDIRECT — FAMILY B, AND WHY IT MATTERS HERE
`_beat_decomp` leg 1, 72 boat-legs each:
| venue | odo | straight | tacks | AVOID_GW | AVOID_NONE | TACKWIN | CLEAN | ARMED |
|---|---|---|---|---|---|---|---|---|
| bay | 4942 | 2840 | 6 | **641u**/13s | 303u/8s | 221u/9s | 488u/20s | 123u/1s |
| lake | 7324 | 4627 | **11** | **539u**/17s | 573u/19s | 278u/20s | 763u/36s | 230u/3s |
| ocean | 8142 | 4400 | 6 | **520u**/8s | 367u/5s | 495u/15s | 2043u/35s | 1789u/14s |
| redrock (pre) | 4140 | 1763 | 9 | **899u**/16s | 373u/10s | 349u/11s | 263u/10s | 167u |
**Give-way avoidance costs 520-899u on ALL FOUR venues.** ⚠️ `CLEAN` is not
waste on a beat (the straight line is unsailable upwind), so only the avoidance
and tack buckets are interpretable. Arctic for reference: leg 1 alone is **84%**
of its gap (139.9 s/boat, 2.19x).

## THE RANKED PLAN
1. **THE BOWL / FLEET AVOIDANCE TAX IN CONSTRAINED WATER** — the biggest single
   place on the venue (47.7 s/boat, 27% of the gap), 85% of it NOT contact,
   deflection-dominated. And it is the SAME term (AVOID_GW) that is bay/lake/
   ocean's whole gap, so a win should transfer — the strongest reason to build
   here. ⚠️ AV1 was already inert once and its defeat is overdetermined; this
   time there is a measured PLACE and a measured state mix to aim at, which AV1
   did not have. Measure the encounters inside the pocket before proposing a
   shape.
2. **`treeSPIN2`, one pooled 6-set bench.** Built, cheap, and its share tripled.
   Ambiguous on box gates twice — the bench is the only thing that will settle it.
3. **ARRIVAL-SIDE GROUNDING** — 14.8 arrivals per boat-race at 70+ u/s. Escape
   quality is spent; ask what puts them there. NOT route admission (the clearance
   bar is dead at a monotonic dose-response).
⛔ Do NOT rebuild: H1 peel-off; Phase D latch jitter (command is stable at 0.0°/
frame); escape heading selection on redrock (already 1.5% from optimal).

## ⏭ INCOMING: GATORGRASS BAYOU (owner, 2026-08-09)
A new venue plus **three human trajectories**, to be ingested when the next push
starts — before any building, because a new venue changes the golden trace count
and the candidate-tree symlinks, and both fail silently.

**Settle first: new key, or a rework of `swamp`?** A `swamp` venue already exists
in `VENUE_ORDER` with its own terrain, audio and character, and has never had
recordings so has never been a gate. Ask rather than assume.

Checklist (full version in the memory, `regatta-venue-intake`):
1. document → `regatta/assets/venues/<key>.venue.js`
2. **register the key in `VENUE_ORDER`** (~4538) — an unregistered key does not
   error, it silently races `bay` (~8926)
3. `npm run test:venue` / `check:venues` / `test:raceable`
4. `freeze_venues.js --add <key>`, then `--check` CLEAN from the repo root
5. laps → `regatta/eval/rl/traj/`, then **`_traj_fp.js` immediately** — all three
   must stamp the FROZEN fingerprint (rule 23; 82 corpus laps are already
   stranded on retired docs). Check whether they are schema-1 (no stamp at all).
6. goldens 30 → **33**: `npm run trace:update`, verify with
   `run_traces.js --seeds 3`, and READ THE COUNT
7. rebuild candidate trees — `mktree.sh` symlinks frozen venues per file, so
   existing trees do not have it
8. `ocean_bench.js … <key>` then `_leg_matrix.js fp=<trajFp> <key> <label>`,
   apportioned on the MEANS table
9. classify into the capability families (A land-stall / B beat distance /
   C mark approach / D start)

⭐ **Prediction to test first: `awash` shapes are NOT colliders.**
`checkIslandCollisions` skips `isl.awash` outright — a grass bed is under the
boat, and its whole cost is drag in `shoalFieldAt`. So a grassy bayou can show a
LARGE gap with **near-zero land contacts**, and every contact-system probe will
read clean while the fleet crawls. `_pocket_split.js` is the right first tool:
its "in contact vs SLOW BUT NOT TOUCHING" split is exactly that discriminator.
Also run `_cur_rank.js` at once — if the bayou carries a stream it slots against
river (1.38 kt) and lagoon (0.39), and the ground-frame escape already landed
this session applies directly.
