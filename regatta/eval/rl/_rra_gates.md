# REDROCK ARRIVAL push (overnight pivot) — pre-registered gates (2026-08-26 ~4:20am)

Pivot per owner ruling (river primary closed on its own bars — see
_rv_kill_v2.log: no single action >=60%; av entries split 57% traffic / 43%
solo argmin-churn in a 100u channel; current-model gap KILLED at 11.7u med;
one-lane follow DO-NOT-BUILD at 57%<60%). Redrock arrival census
(_rv_kill_rr4.log, 32 races replay-validated 32/32): **av owns 95% of first
entries, all on the sw-mark bowl leg, clr<=2@-5s 63%, rival<300u 84% at
rivKt med 4.8 (a slow-moving melee, NOT a lane: same-dir 49% — the
registered one-lane-follow rule FAILS, recorded, not built), off-path pd3
med 192u / 79%>=60u (displacement confirmed on current code).**

## THE CANDIDATE — defile meter SLOW-JAM extension (v1)
bot.js's landed defile meter (jam at a <2-clearance point 250-700u ahead on
own gridPath, >=2 rivals within 250u of it) qualifies rivals by PARKED
(`ob.speed >= 1.0 -> skip`, raw units ~= 4kt? NO — rule 32/31: ob.speed is
raw; ob.speed*4 = knots; 1.0 raw = 4kt... VERIFY the unit at the edit site
against the existing comment before changing anything). Extension: qualify
rivals by SLOW instead of parked — threshold chosen so parked remains a
subset and the measured melee occupants (rivKt med 4.8kt) begin to count.
One condition, same physical line (authored-land defile, no-floe gate
inherited), same cap (0.55+0.15*handling), no RNG drawn/skipped.

## G-MECH (candidate-tree census, same 4 redrock seed0s x 8)
1. First entries per race <= 7.4 (baseline 297/32 = 9.3; -20%).
2. Total land-contact episodes per race NOT up (baseline 1245+? per set —
   read per-set from the JSONs at verdict time; bar: pooled total <= +5%).
One iteration allowed (v2 = higher slow threshold) under the same gates if
v1 moves entries <20% but >0%; anything else = close and record.

## Fleet gates (widths = tb anchors; ⛔ tb*-era only)
- G-RR: pooled 6-set vs tbrr* (`node _pool_rr.js tbrr <cand>` — BASE first,
  NEGATIVE = faster; hand-recompute one number, rule 21b): paired med <=
  +2.0, land mean improves >= 5%, boat mean <= +5%, fins >= equal, pen <=
  +10%.
- G-RIV: 3x8 vs tbriv*: fins >= -1, land <= +10%.
- G-SW: 3x8 vs tbsw*: med +-5, fins >= -1, land/boat <= +10% AND absolute
  floor (ignore misses under +0.5/boat-race — the lagoon lesson).
- G-LK/G-BAY: 2x20 vs tblk*/tbbay*: med +-3, fins >= -1, dirt <= +10% with
  +0.3/boat-race absolute floor.
- G-GLOW/G-LAG/G-OC/G-ST: anchor widths vs tbglow/tblag/tboc/tbst: med +-5,
  fins >= -1, dirt +10% with +0.3/boat-race floor.
- G-ARC: one-set cmp byte-check vs tbarc9100 (the no-floe gate is inherited
  — the block never runs on arctic; tbarc9100 is same-code same-pattern, so
  rule 22 is satisfied by THIS tree's own bench).
Landing bar: standing (universal -> land locally; named losers -> costs at
equal prominence + review).

## Also recorded for the owner (not built tonight)
- RIVER ENTRY map (the primary): notch channel is ~100u at the routed line
  (pathSailable medClr 2/min 0); DMC ruler leg-3 = a 2-pt chord THROUGH
  land, finish leg has no ruler; entries 83% av-owned at full speed; no
  action covers >=60%. Corridor-level design item.
- REDROCK return-to-path: displacement confirmed (pd3 med 192u) but the
  build is a fan-scoring redesign (the return heading already exists in the
  fan) — flagged for review, not a one-night build.
