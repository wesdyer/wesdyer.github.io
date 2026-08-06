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
