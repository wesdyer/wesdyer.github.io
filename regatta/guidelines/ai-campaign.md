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
| 2026-08-03 (12 traj) | human | 0 | n/i | 2.3 | 3.3 | 0.7 | 13.9 |

### Course (finish time, s)

| Snapshot | Who | DNF% | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|
| 2026-08-06 anchor @100t (fb9f641) | bots | 0 | 200.44 | 204.34 | — | — |
| 2026-08-03 stack @40t (855379a) | bots | 0 | 200.47 | 204.67 | — | 360.0 |
| 2026-08-03 (12 traj) | human | 0 | 192.2 | 191.4 | 180.9 | 200.6 |

### Collisions (per boat-race)

Categories, uniform across venues: **Boat** (boat-on-boat), **Land** (shore/
banks/islands), **Mark**, **Other** (venue objects: floes, bergs; plus arena
bounds). "n/a" = the venue has none of that object; "n/i" = not instrumented.
Penalties are a SEPARATE table — a penalty is a rules event (RRS infraction +
360 turn), not a contact event; each can occur without the other.

| Snapshot | Who | Boat | Land | Mark | Other |
|---|---|---|---|---|---|
| 2026-08-03 stack @40t (855379a) | bots | 0.52 | n/a | 0.25 | 0.00 (bounds) |
| 2026-08-03 (12 traj) | human | 0.25 (3 in 12) | n/a | 0 | 0 |

### Penalties (per boat-race)

| Snapshot | Who | Penalties |
|---|---|---|
| 2026-08-06 anchor @100t (fb9f641) | bots | 0.44 |
| 2026-08-03 stack @40t (855379a) | bots | 0.50 |
| 2026-08-03 (12 traj) | human | 0 |

**Read:** the median bot start and finish are within ~8s of the human median;
the human's edge is consistency (max 200.6 vs bot max at the 360 cap) and a
cleaner race (0 pens vs 0.50). The bot tail — not the bot median — is the gap.

---

## Lighthouse Cove (`bay`)

Protocol: `regatta/eval/rl/bay_bench.js 20-seed set (9100-9119)`, cutoff 900,
9 bots (player parked). `bay_report.js <label> [labelB]` prints these + paired
deltas. Human = 7 trajectories. ⚠️ Bot collision counts NOT yet instrumented
in bay_bench (TODO next round) — only penalties are.

### Starts (time to cross, s)

| Snapshot | Who | DNS% | OCS% | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|---|
| 2026-08-03 baseline (614b20b) | bots | 0 | n/i | 5 | — | — | — |
| 2026-08-03 stack (855379a) | bots | 0 | n/i | 5 | 9.3 | 0 | 147 |
| 2026-08-03 (7 traj) | human | 0 | n/i | 0.9 | 4.5 | 0.6 | 19.1 |

### Course (finish time, s)

| Snapshot | Who | DNF% | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|
| 2026-08-03 baseline (614b20b) | bots | 0 | 277 | — | 216 | — |
| 2026-08-03 stack (855379a) | bots | 0 | 268 | 269.7 | 215 | 365 |
| 2026-08-03 (7 traj) | human | 0 | 226.1 | 226.7 | 219.5 | 241.1 |

Per-leg medians vs human (stack): L1 +3, L2 +1, L3 +6, L4 +6, L5 +6, L6 +5.

### Collisions (per boat-race)

| Snapshot | Who | Boat | Land | Mark | Other |
|---|---|---|---|---|---|
| 2026-08-03 stack (855379a) | bots | n/i | n/i | n/i | n/a |
| 2026-08-03 (7 traj) | human | 0.14 (1 in 7) | 0 | 0 | n/a |

### Penalties (per boat-race)

| Snapshot | Who | Penalties |
|---|---|---|
| 2026-08-03 stack (855379a) | bots | 0.00 |
| 2026-08-03 (7 traj) | human | 0 |

**Read:** every bot finishes cleanly; the whole gap is pace (median −42s vs
human). The winning bot (min 215) now edges the human best (219.5). Biggest
remaining sinks: L1 mid-beat tail (31/180 boats lose 20-100s and they are
EARLY starters getting buried — see the 147s start-cross max), the east-
pressure gybe bulge on the runs, entry-overshoot tails at marks 2/3.

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
| 2026-08-03 (16 traj) | human | 0 | n/i | 1.2 | 3.6 | 0.1 | 22.6 |

### Course (finish time, s; uncapped-900 protocol)

| Snapshot | Who | DNF@900% | in-time ≤420 | Median | Mean | Min | Max |
|---|---|---|---|---|---|---|---|
| 2026-08-03 HEAD baseline (614b20b) | bots | 6.9 (10/144) | — | 530 | — | — | — |
| 2026-08-03 stack (855379a) | bots | 9.0 (13/144) | 35/144 (24%) | 538 | 537.6 | 257 | 899 |
| 2026-08-03 (16 traj) | human | 0 | 16/16 | 229.1 | 230.3 | 200.1 | 299.2 |

### Collisions (per boat-race)

| Snapshot | Who | Boat | Land | Mark | Other (floes) |
|---|---|---|---|---|---|
| 2026-08-03 stack (855379a) | bots | n/i | n/i | n/i | n/i |
| 2026-08-03 (16 traj) | human | 0.6/run | 0.4/run | 0 | 4.4/run (0-24; grind-through is cheap) |

### Penalties (per boat-race)

| Snapshot | Who | Penalties |
|---|---|---|
| 2026-08-03 stack (855379a) | bots | n/i in fleet_leg2 |
| 2026-08-03 (16 traj) | human | 0.13 (2 in 16) |

**Read:** every human run finishes inside the 420 cutoff; only ~24% of bot
races do. The bot median race is 2.3x the human's. Per the arctic campaign
ledger the wall is the ARM→outbound sweep (131s med vs human 35s); CREW-level
RL is the approved next escalation. Note the fresh HEAD baseline (144/144
rounders, 134/144 finishers @900) makes the old stored 51/30 reference
obsolete — never compare against it again.

---

## Instrumentation TODO (to make the tables complete)

1. `bay_bench.js` / `fleet_leg2.js`: count per-boat boat/land/mark/other
   contacts + penalties (arctic_eval.js already shows how: `b.penalties`,
   `iceCounts`). Then every venue fills Collisions AND Penalties.
2. **OCS%** everywhere: benches should record boats penalized for an early
   start (rules event, distinct from a clean pre-gun return); run_eval needs
   the same. Human OCS is already in the recorder's event stream (v7) — decode
   it in `traj_report.js` and backfill the human rows.
3. Capture bot start min (run_eval reports median/mean/max only).
4. A capped arctic_eval round per snapshot for true DNS/DNF at 420.

## Next session brief (prepared 2026-08-03, tree at ba33366)

Read `regatta-bay-ai.md` + `regatta-arctic-ai.md` memory first. In order:

1. **Instrument collisions** per TODO above (small, do it first, re-baseline).
2. **Bay pace, next levers** (gap −42s median): (a) L1 mid-beat tail — early
   starters get buried; instrument dirty-air time + wrong-side-of-shift time
   on L1 for the 31/180 tail boats before touching anything (shift-chasing is
   trait-driven; changing it re-tunes every venue); (b) east-pressure gybe
   bulge on L3/L5 — scoreTack's pressure bonus vs the distance it buys; the
   human takes the shorter 10-11kt corridor and wins; (c) entry-overshoot
   tails at marks 2/3 (armed-to-advance 16-45s on ~10% of roundings).
3. **Arctic CREW-level RL** (approved): target ARM→outbound 131s vs human 35s.
   Re-baseline on fresh HEAD first (fleet_leg2_headbase16.json is the current
   reference). rl_train_cem.js + the four-level architecture notes are in the
   arctic campaign doc.

Gates, unchanged: paired A/B at 20 seeds on the target venue; seatrials
anchor (run_eval 40t spot, 100t before landing big stacks); goldens
(`npm run trace`, re-record only with an accepted behaviour change); arctic
fleet_leg2 paired when a change can reach arctic. Judge tails by paired
per-boat deltas, not distribution medians. treeA = experiment snapshot,
treeB = baseline snapshot; refresh BOTH from HEAD at session start.
