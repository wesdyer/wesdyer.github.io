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
