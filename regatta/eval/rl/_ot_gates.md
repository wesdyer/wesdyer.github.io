# THE OTTER PUSH — pre-registered gates (2026-09-14 22:45 PT, written from the census
# BEFORE any candidate output existed)

Venue: Otter Point `otter`, frozen 5bf8725299b7b502 (doc stamp 5817c877:142328); his 5 laps
stamp the frozen doc exactly: med **200.8** / mean 201.1 / best 197.8. Anchors ot0ot9400/9500/9600
(ten-bot, treeOT0 == HEAD fc56ade): med 222 / mean 221.1 / best 186, fins 240/240, dirt
l/b/m/pen 0.70/0.39/0.00/0.13. **Ratio 1.106.** Owner: "roundings at the mark are not good."

## THE CENSUS
- `_leg_matrix` MEANS: start +1.8 (9%), L1 beat +9.6 (48%), L2 reach +8.6 (43%) of +19.9 s.
  ⚠ his leg boundary is the engine's sweep bank, not geometry (lap 4 credited 2600 u past
  the mark): read L1+L2 together.
- `_roundcraft` (26 fleet episodes vs his 4): ring time 8.4 vs 4.0 s (mean), ring dist 940
  vs 436 u, **excess sweep med 156° (sweepAtAdv 274° for a 129° requirement)**, closest 64
  vs 80 (med), wrong-way entry 58% vs 25%. Ring tax 4.4 s/lap on the mean.
- `_ot_trace` (seed 9400, 1 Hz): TWO ENTRY CLASSES. East class (6/10, bearing-from-mark 68°,
  TWA 50, starboard tack laying the mark's EAST side = wrong side): two tacks inside 300 u,
  window 17-19 s, ring 9-10 s, v→79-87, then the orbit carrot carries the heading to 68-79°
  (TWA 117-128) past the exit heading (~23°, TWA 70) and the outbound follower turns back
  to heading 4-12 — a ~70° over-rotation and correction. West class (4/10, reaching in from
  WSW at TWA 87-126, like his laps 1/4/5): 8-11 s, no tacks, but still over-rotated to
  heading 98 (TWA 146) at the bank before turning back to heading 7.
- HIS rounding: laps 1/4/5 = ONE early bear-away far outside the zone, a straight pass at
  161/215/609 u, no turn inside 700 u, full speed (126-138 u/s). Laps 2/3 = east-class entry,
  two tacks at 310/244 u, closest 80/58, then ONE turn straight to the exit heading (19-22),
  no overshoot.
- Engine: zone 165, reqSweep 129°, side starboard, orbitTightR 70 (whole ring clear water),
  _roundR 90, approach TWA 17.6° (unsailable ruler line from the SE), exit TWA 70°.

## CANDIDATE CX1 `treeOTC1` — THE CORNER AS AN EARLY EXIT-LINE HANDOFF (navigation.js)
On a floe-free, open-water mark (`orbitTightR(rm) != null`), once the engine has re-based
the sweep (`rs.roundRebased`, hull inside 2 zones) and the boat is not yet outbound: project
the boat onto the NEXT leg's DMC path, take the carrot LOOKP ahead, and test the CHORD
boat→carrot against the mark: the mark must lie on the REQUIRED side of the chord with
perpendicular clearance in [orbitTightR, zone×0.7] (≥ 70 u: no graze; ≤ 115 u: a straight
pass from a 330 u re-base sweeps ≥ 139° > 129°, so the engine banks by geometry), or already
astern. If admitted, hand the follower to the next leg NOW (the R1a `followLeg = leg+1`
path) — one turn to the exit line; otherwise the existing hunt/orbit runs unchanged and
re-tests every tick. Rule 1: this changes WHICH ACTION EXISTS (the direct exit line),
not a price. Off: arctic (`_hasFloes`), redrock marks (orbitTightR null), seatrials/ocean
W-L legs without a `round` route element.

## GATES
G1 clock: otter 3×8 vs ot0ot* pooled paired mean ≤ −2.0 s AND med ≤ −2, fins 240/240;
   lexicographic: mark contacts not up (0.00 base → ≤ 0.05), boat contacts not up >10%,
   pen not up >10%.
G2 mechanism (`_roundcraft otter 3 9400 treeOTC1`): fleet excess sweep med 156° → ≤ 60°;
   ring time mean 8.4 → ≤ 5.5 s; ring dist 940 → ≤ 650 u; closest not below 60 u med.
G3 transfer: every clear-ring venue (bay/lake/lagoon/glowtide/ocean/volcanic/swamp/river)
   paired mean non-positive within its noise bar (bay/lake ±4, lagoon ±3, others ±2) — a
   loser is NAMED; arctic/redrock/seatrials cmp-identical to ot0* (byte-inert where off).
Kill: any DNF from a rounding that never banks (a wide pass the engine refuses); mark
contacts ×2; a loser on two venues.

## OUTCOMES (23:40 PT; verdicts vs ot0ot* — `_vo_pool.js ot0ot <cand> 9400 9500 9600`, CAND − BASE)
- CX1 (side + band, astern any side): −3.2 mean / −3 med, **fins 228/240** ⇒ KILL (wrong-side astern
  admitted; Breeze 9401 milled at the finish 650 s). Census: ring 8.4→5.7, excess 156→105°.
- CX1b (+latch, astern needs winding ≥ 0.5): **−3.6 / −4, fins 240/240** (G1 ✓), boat 0.39→0.50
  (lexicographic ✗ +28%), ring tax 4.4→2.3 (G2 ring ≤5.5 ✗ 6.4, dist 700 ✗, excess 106 ✗),
  lagoon −1.6, lake 0 — **bay seed 9400 finished 2/10 ⇒ KILL** (G3 DNF).
- CX1c (asymptotic bank test): −2.6 / −1, fins 239/240; bay 0/10 ⇒ KILL.
- CX1d (bank at the carrot): −2.4 / −1, fins 238/240; bay 0/10 (leg 3 leeward hairpin: a carrot
  450 u dead upwind, tack-loop 600+ s) ⇒ KILL.
- **CX1e (+ sailable exit chord ≥ optTWA+0.1, hard LOS)**: −2.3 / −1, **fins 240/240**, land
  0.70→0.83, boat 0.39→0.45; **bay 9400 10/10, −0.85 / 0, dirt flat**. G2: ring 8.4→6.6 (✗ 5.5),
  excess 156→97 mean (med 106 ✗ 60), closest 67 ✓, ring tax 4.4→2.5. On top of the beat (OTF vs
  OTB3): −1.6 / −2, fins 240/240, land 1.13→1.32. ⇒ A SMALL, SAFE WIN; landing decided on its
  transfer set (`otf*`).
- OTB1 (open-water beat, clearance+losClear gate): byte-identical to CX1b — never fired
  (`_ot_open.js`: LOS clear 15%, the shallows apron reads as a wall).
- OTB1d (beat, three soft-tolerant rays, on CX1d): **−13.3 / −13, fins 240/240**; tacks 14.1→5.6.
- OTB2 (the beat alone on HEAD): **−11.7 / −12, med 222→206, fins 240/240, ratio 1.026**; land
  0.70→1.15, boat 0.39→0.78 — ALL of it at the mark approach (82 of 96 boat contacts, 62 of 76
  land contacts inside 1000 u of the mark on leg 1: the cone's one final board through the rock
  field, rafting). ocean −2.3, seatrials identical, bay −0.2, lake +0.6, lagoon −2.0, volcanic −2.2.
- **OTB3 (the cone's apex two zones out on the required side)**: **−12.3 / −12, med 222→206, mean
  221.05→208.8, fins 240/240, worst 265→255, winner 204→193 ⇒ ratio 1.106 → 1.026 ✅**; land
  0.70→1.13 (named: ~1 boat a race hits the rock ~850 u SSE of the mark at speed), boat 0.39→0.55
  (mark-approach rafting 82→2 in the 5-seed census). Tacks 14.1→4.8 (his 3.8), leg-1 105.9 s (his
  111.1). Transfer: ocean −3.0/−6, seatrials identical 160/160, lake +0.9/0, lagoon −0.4/−1,
  [bay/volcanic/glowtide/swamp/river/redrock/arctic: see the campaign log].
- **CX1e TRANSFER (`otf*` = beat + corner, vs the landed beat `otb3*`)**: otter −1.6/−2 (240/240),
  bay +0.7/+1, ocean −0.5/0, volcanic −0.8/−3 BUT one boat 194→426 (leg 2, a port gybe mark), lake
  −0.3, lagoon identical, seatrials/redrock/arctic identical — and **RIVER fins 79 → 65 (14 DNF)**,
  land 77→24 (the DNF boats never reach the land) ⇒ **KILL (G3 DNF).** The corner family in its safe
  form still leaves a never-bank/late-bank class on river's and volcanic's roundings. NOT LANDED.
  Landing set = OTB3 alone.
