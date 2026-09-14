# THE VOLCANO PUSH — pre-registered gates (2026-09-13 18:10 PT, written from the
# census BEFORE any candidate output existed)

Venue: Emberfall Isle `volcanic`, frozen b79ac315b9dfc104, his 5 laps fp 4ac8c0e5:45501
(med 195.5). Anchors on THIS machine: vo0vo9400/9500/9600 (ten-bot, HEAD 1a33a12 ==
treeVO0) = med 240 / mean 241.3 / best 162, fins 240/240, ratio 1.228 — reproduces
the owner's em* row exactly. 9-bot profiler vo0base reproduces the campaign table
(239.5 / OCS 55% / 30.1 s fried). Seatrials control vo0st == past 16/16 (js inert off
Emberfall).

## THE CENSUS (`_vo_census.js` treeVO0 9400+9500, 16 races, fins 16/16 validated)
Per-leg MEANS (`_leg_matrix`): start +12.0 (26%), L1 +16.6 (36%), L2 +5.5, L3 +6.8,
L4 +5.5 of +46.8 s. Distance atlas (`_leg_odo`, 8 races): L1 +17.3 = 9.6 distance /
7.0 speed, fleet flips 6 vs his 2; L2 speed; L3 distance.
- FRY 5.35/boat-race, 31.1 s fried; clock lost 8.3 s/boat-race. THE SPLIT: fries
  preceded by a DODGE (562) lose 2.32 s med; fries with no dodge (294) lose 0.08 s.
  Mechanism: `_friedIntent = prevDesired` latches the DODGE heading (and last tick's
  avoidance deflection) for the outage. Wind drift during a fry is 0.03 rad med — the
  "compass heading in a shifting breeze" mechanism is DEAD PRE-BUILD.
- DODGE 6.06/boat-race, lost 3.6 s; ratePost/rate0 0.35 (the latched fry after it);
  57% are fried anyway (dur 4.4 s med vs 6.6 undodged).
- BOIL 4.74/boat-race, 9.5 s, lost 4.0 s/boat-race; his exposure 0.7 s/lap
  (`_vo_human_boil.js`). Entries at |TWA| 1.71 med (reaching/running, NOT beating).
- DEAD AIR 0.
- START: OCS at the gun 50.6%; OCS boats cross at 22.9 s med vs 1.57 s (≈ −21 s each,
  = the whole +12 s leg-0 mean). At the gun the fleet is CENTRED on the line
  (behind −1.7 u med, p25 −30 / p75 +49). OCS rate is ~50% in every wind-offset bin
  and on both tacks: a ZERO-MARGIN timing design meeting a ±0.6 s estimate error, not
  an angle bias. He is 129 u behind at 7 kt at the gun and crosses at 1.2 s.

## CANDIDATES (one mechanism per tree; ten-bot; 3×8 seeds 9400/9500/9600 vs vo0vo*)
- **F3 `treeVF3`** — the fried helm holds the last STRATEGIC heading (captured each
  non-fried strategic tick, before the dodge override and before avoidance), not
  `prevDesired`. Avoidance still runs live on top. Off Emberfall: byte-inert by
  construction (inside `if (fried)` + a write-only field).
- **VND `treeVND`** — ATTRIBUTION ONLY (dodgeChance → 0): what the dodge is worth
  under the current latch. Not a landing candidate (the dodge is the owner's design).
- **S* (start)** — designed after census v2 (wind trend commit→gun, OCS return split).

## GATES
G1 F3: volcanic pooled 240 boats med ≤ 234 (−6) AND mean ≤ 236 AND fins ≥ 240/240;
   lexicographic: pen mean not up >10%, boat contacts not up >10%, land not up.
G2 F3: seatrials 16 @ 9400 byte-identical to vo0st (cmp finT+info).
G3 F3 mechanism read: re-census — dodged-before fries lost med < 0.5 s (from 2.32).
G4 any start candidate: OCS at the gun ≤ 25% AND crossing mean ≤ 8 s AND lap med
   improves; other ten venues via `_st_ledger2` FAST screen + full bench on movers.
Kill: a candidate that fails its own mechanism read (G3) is not landed on a lap win.

## S1 (registered 18:24, before its first bench output was read) — `treeVS1` = F3 +
## the crossing run priced in the LINE's frame
- aim = lane target + course-side NORMAL × PAST (was: + wind × PAST, dead upwind of the
  stage, tack a coin toss);
- tCross run = STAGE·cos|off| / cos(0.7 − min(|off|, 0.7)) (was STAGE/cos 0.7), off = the
  wind's offset from the normal at the lane. Square line ⇒ both identical to today.
- G4 as registered: OCS at the gun ≤ 25% AND crossing mean ≤ 8 s AND lap med improves
  (vs vf3vo*); dirt lexicographic. G5: seatrials byte-identical (off = 0). G6: ocean moves
  (|off| 0.22 at commit) — bench 16 @ 9400 vs paoc; a loss there is a NAMED loser.
- Kill: if OCS stays > 35% the geometry was not the lever and the margin (owner) is.
