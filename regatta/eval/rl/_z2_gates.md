# Z1-v2 MULTI-BOAT MARK-ROOM HOLD — pre-registered gates (2026-08-25 ~19:15,
# written BEFORE any treeZ2 measurement was read; treeZ2 anatomy jobs launched
# minutes ago, none read yet)

Candidate: treeZ2 = HEAD (a50a741 code == 736e105) + the v1 `_rowHold`
entitlement edit in js/ai/avoidance.js (mrMineZ1). Multi-boat reach comes
from the landed isOverlappedThrough (rules.js): the zone snapshot entitles
the holder pairwise against every raft boat. AI-only, umpire untouched.
Owner ruling: this is the pre-agreed fallback after P1 killed the wiggle-side
primary (river re-beach saturated ~98% both sides; see _rb_census/_rb_kill).

## HEAD baselines (treeF1, read before gates were set)
- bay: PENDING at gate time (2 of 4 seeds in; gates on bay use the DELTA, not
  a level, so they are fixed now regardless of the final baseline number)
- redrock: holder-inside 46% (conceded @maxDev: thirdBoat 48%, landNear 52%)
- lake: holder-inside 52% (conceded @maxDev: thirdBoat 40%, landNear 53%)
- (roundcraft-era v1 result, for shape: lake 27→65 converted, bay 51→44 and
  rr 38→33 did NOT — bay concessions were third-boat 57%, rr land 43-60%)

## Mechanism gates (anatomy, same seeds as baseline: bay 9400x4, rr 9400x4,
## lake 6100x4)
- G1 (bay, the conversion target): holder-takes-inside >= baseline + 8 pts.
- G2 (lake, hold the prior win): holder-takes-inside >= baseline - 5 pts.
- G3 (rr, partial reach expected — land-forced concessions ~52% are not a
  hold's to fix): holder-takes-inside >= baseline - 3 pts.
- Sanity: bay conceded-episode heldPair share RISES (the hold visibly firing
  at the concession moment).
ALL of G1-G3 pass => fleet benches. G1 fail => mechanism dead, name it, stop
(no fleet round). G2 or G3 fail => named-loser path only with owner review.

## Fleet gates (landing bar = same as last two pushes; anchors = f1sw*/f1riv*/
## f1lag + mr* per _n1_close_table.js maps; poolers: rule 21/21b sign+arg
## order, hand-recompute one number from raw JSON before any verdict)
- Full anchor-width suite: rr pooled 6-set, arctic 4 sets, river 3x8,
  swamp 3x8, bay 2x20, lake 2x20, glow 16, lagoon/ocean/seatrials anchor
  widths.
- Universal-win landing: bay boat or mark contacts improve (primary claim);
  no venue's paired med worse than +3 (rr judged pooled only, rule 12/20);
  river fins >= 213/216; bay clock claims under 5s NOT made (rule 13) —
  bay is judged on dirt columns.
- Any loser => land only with costs named at equal prominence + owner review
  requested (owner ruling 4).
