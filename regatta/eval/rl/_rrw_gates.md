# ROCK-WALL WIGGLE push — pre-registered gates (2026-08-25 evening)

Written AFTER the P1 census extension, BEFORE any code edit (the standing
landing bar's order). Plan: memory `regatta-rrwiggle-push-plan` (owner
rulings 2/2). HEAD at registration: b116222 (code == 736e105).

## P1 result the gates are built on (kill bar PASSED)

`_rb_census.js` treeMR (== HEAD on redrock; S3a-inert) on ALL SIX redrock
anchor benches, mrrr9400..9900, 8 races each = 48 races, sequence replay,
**48/48 replay-validated vs bench fins**. Pooled by `_rb_kill.js`
(`_rbw_kill_pooled.log`):

- triggers 500; census population (cause rand8/obs/rand, clr0<=2): 466
- side asymmetry >=2 (score = sum over 80,150u of min(clr,4), wd±1.75): 224 (48%)
- **P(re-beach<=10s | wiggled BLOCKED side) 96% (n=118) vs OPEN side 45%
  (n=106) = 51-point separation** (bar was >=25 at n(asym)>=50)
- consistent every split: obs 94/38, rand 97/48, rand8 100/33 (n tiny),
  inContact 97/38, clear-at-trigger 95/50; no-asymmetry context 96%
- chooser picks open 47% of asymmetric triggers = land-blind coin-flip
- reach caveat (stands): re-entry ownership av 72% / wig 20% / nav 8% —
  expected fleet effect is DIRT/TAIL, not a med headline
- screens: lake 6100 x2 races -> firing population 0 (6 triggers total);
  bay 9400 x2 -> 0 (1 trigger). Blast radius off redrock ~nil by count.

## The edit under test (P3, mirrors S3a)

js/ai/bot.js wiggle-side chain: new land-aware branch AFTER the weed
branch, BEFORE the >8s random. Fires only when ALL hold:
`state.course._gridFixed && length` AND `!(state.course._floeObjs||[]).length`
AND `leg >= 1` AND boat-cell clearance <= 2 cells (botGrid `_clear`, lazily
built via SailCheck.clearanceField — the bot.js:491/743 pattern). Side =
higher score side, decisive only on asymmetry >= 2 (the census threshold);
ties and out-of-population fall through unchanged; no RNG drawn or skipped
outside the firing population. Rounding + weed branches keep precedence.
NO venue-name gate (owner ruling 1).

## Gates (ALL registered before the edit; verdicts quote these numbers)

**G-MECH — mechanism gate.** Re-run `_rb_census.js` on the CANDIDATE tree,
same six seed0s x 8. Recomputed on the candidate's own races:
1. Among asymmetric (>=2) near-beach triggers, chosen-side-is-blocked
   **<= 5%** (baseline 53%).
2. P(re-beach<=10s) over the asymmetric near-beach population **<= 60%**
   (baseline weighted 72% = (118*.96+106*.45)/224; full conversion to the
   open rate would read ~45-55%).

**G-RR — redrock fleet (the win it must show).** Candidate 6-set pooled vs
mrrr* via `node _pool_rr.js mrrr <candPrefix>` (BASE first, NEGATIVE =
candidate faster; rules 12/20/21/21b): land-contact MEAN improves, boat
MEAN not worse than +5%, paired med <= +2.0 s. Hand-recompute one paired
per-boat number from the raw JSONs before any verdict.

**G-RIV — river must not regress** (side-irrelevant there, 98% both ways):
3 sets (9400/9408/9500) x 8 vs f1riv*: total fins >= anchor total − 1;
land-contact total <= anchor x 1.10.

**G-SW — swamp flat, weed precedence intact:** 3 sets x 8 vs f1sw*:
pooled paired med within ±5 s, fins >= anchor − 1, land/boat <= +10%.
(Not byte-inert by construction — near-beach non-weed triggers exist.)

**G-LK / G-BAY — flat:** lake 2x20 vs mrlk6100/6200, bay 2x20 vs
mrbay9400/9600: per-venue pooled paired med within ±3.0 s (bay ~4s noise
floor per rule 13 — a miss inside that band needs a dirt column to convict),
fins >= anchor − 1, land/boat <= +10%.

**G-GLOW / G-LAG / G-OC / G-ST — anchor widths:** vs mrglow/f1lag/mroc/mrst:
med within ±5 s, fins >= anchor − 1, dirt columns <= +10%.

**G-ARC — byte-inert by construction (rule 22):** candidate one-set arctic
(9100 x 8) bench JSON `cmp` BYTE-EQUAL vs a fresh CURRENT-HEAD control tree
run of the same set in the same pattern (never vs an old anchor).

**Fallback (owner ruling 2):** any registered gate FAILs on the build ->
named-loser rule (land only with costs at equal prominence + review
requested) or close and hand back; no pivot to swamp-admission or arctic
substrate work.

## VERDICTS (2026-08-25 night, build on final HEAD; full log in ai-campaign.md)
- G-MECH PASS: blocked choices 9/202 = 4.5% (<=5); asym-pop re-beach 44% (<=60).
- G-RR PASS: paired med 0.0, land 10.50->10.33, boat 4.48->3.73 (hand-recomputed,
  matches pooler). Named: mark 0.45->0.54.
- G-RIV PASS: fins 210->213, med 243->240, land -28%. Named: boat 6.66->10.84/boat-race.
- G-SW FAIL (boat): 922->1242 (+35%, 2/3 sets consistent); med-paired 0, fins =,
  land -34%. Venue-table med 318->326 (+8s) — tail-shaped giveback of ~1/3 of
  S3a's mean win. NAMED LOSER.
- G-LK FAIL (boat): 206->251 (+22%); 33/40 races byte-identical, delta = ONE
  re-rolled race 8->44 (base per-race max 29). Unsizable at n=7 (rule 3). NAMED.
- G-BAY PASS clean (33/40 identical, land -8%).
- G-GLOW PASS: land -9%, mean -2.7 (1/16 identical — it fires here).
- G-LAG FAIL (land): 12->34 abs frames, ONE race (2->24); the +10% bar on base 12
  allowed +-1.2 frames — structurally unmeetable under reshuffle. NAMED.
- G-OC / G-ST PASS byte-identical 16/16. G-ARC PASS: rwarc9100 cmp-EQUAL
  ctlarc9100 (fresh HEAD control; mrarc9100 also equal — arctic anchors valid).
DECISION: not universal -> landed LOCALLY under the named-loser rule, owner
review requested on swamp (the real trade), lake + lagoon (single-race lotteries).
