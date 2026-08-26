# TEN-BOT ERA CUT — pre-registration (2026-08-25 night, owner-approved in session)

Owner: "I think it's probably worth it to move to 10 boat bot races" -> agreed
rationale (density parity with his 10-hull reference laps; the traffic-shaped
frontier is under-dosed by one rival hull in every bench) -> "Let's do it."
Infra push: NO AI-behavior changes in this cut. HEAD at registration: e6b9b4a.

## The mechanism (bench-side conversion; shipping code untouched)
`ocean_bench.js` only. Construction stays byte-identical to shipping through
`startRace()` (player + 9-draw, same RNG stream), THEN the player boat is
converted to a full bot in-page:
1. Bench settings write becomes `{venue, character: <pinned name>}` — the
   shipping "NEVER RACE YOURSELF" exclusion (a 99-wide draw). Without it the
   9-draw can duplicate the 10th boat's name and poison every name-keyed
   stat (bench JSONs, poolers, fins maps). Pinned name = AI_CONFIG[0].name
   (what `playerCharacter()` already resolves to under bench settings).
2. After startRace: `applyBoatIdentity(pl, playerCharacter(), false)` — the
   player boat takes the character's STATS + AI_STAT_BONUS ("the player
   takes none of them" would otherwise field a weak 10th hull); traits/
   archetype were already applied in the constructor for every boat.
3. `pl.isPlayer = false; pl.manualTrim = false;` — `updateAI` picks it up
   next frame (controller is created lazily; `boat.ai` exists with its RNG
   draws already made identically to shipping).
4. Deterministic AI start setup (the 9-draw's fields the player never got):
   `pl.ai.startLinePct` = mean of the nine drawn bots' startLinePct
   (clamped 0.05–0.90), `pl.ai.setupDist = 300` (the draw's mean). NO RNG
   drawn by the conversion.
5. Default ON. `OCEAN_BENCH_PARKED=1` restores the parked-player 9-bot path
   for reproducing a pre-cut number ONLY (the rule-30 opt-out pattern).
Deref audit done pre-registration: every `find(b => b.isPlayer)` consumer is
null-guarded (telemetry.js:16, collision.js:203), per-boat `isPlayer`
branches are no-ops, and eval_harness stubs requestAnimationFrame so
render/HUD player derefs never run in a bench.

## Gates (before any anchor is recorded)
- **G-COUNT**: a 10-bot bench race reports 10 info rows, 10 distinct names,
  and >=9 finishers on ocean (sanity: the converted boat actually starts,
  races, and finishes — not a drifting hulk; system-level per rule 36).
- **G-DET**: river 3-race 10-bot bench, TWO processes -> byte-identical
  JSONs (river is the historically fragile venue, rules 30/34); redrock
  1-race two-process cmp likewise.
- **G-SHIP**: `git diff --stat` shows ZERO js/ changes; goldens verify PASS
  30/30 (run, not assumed); npm test same-7 red.
- **G-PARK**: `OCEAN_BENCH_PARKED=1` on one redrock set reproduces the rw*
  anchor byte-identically (the old path is preserved exactly).

## The measurement (then the cut)
Full anchor-width suite 10-bot on current HEAD, labels tb* — simultaneously
(a) the marginal-hull DENSITY TAX per venue vs the same-code rw* 9-bot
anchors (a capability-map finding: how much of each remaining gap is
traffic), and (b) the NEW ANCHOR SET of the era.
⛔ THE CUT RULE, effective at the first tb* anchor: NEVER compare a 10-bot
number to any 9-bot-era number (every anchor before tb*). The venue-table
history breaks here by design; the human column is unaffected (his laps
were always 10-hull races — that is the point of the cut).
Deferred, noted: _rb_census.js and the other replay probes still park the
player — retrofit before their next use on tb* benches; goldens stay
shipping-construction (they test the game, not the bench).

## VERDICTS (2026-08-26, all PASS; suite recorded)
- G-COUNT PASS: 10 rows, 10 distinct names, 10 finishers (ocean smoke + every
  suite log). G-DET PASS: river 3-race and redrock two-process byte-identical.
- G-PARK PASS: OCEAN_BENCH_PARKED=1 on treeRW reproduces rwrr9400 byte-exactly.
  (First attempt ran on stale treeCTL == pre-landing HEAD and DIFFERED — tree
  retired; the near-miss is the lesson: G-PARK must run on the anchor's tree.)
- G-SHIP PASS: zero js/ diffs; goldens verify PASS 30/30, 0 behaviour changes
  (run, not assumed); npm test same-7 stands (js unchanged since it passed).
- tb* anchors recorded (full widths, treeRW == HEAD). Density tax at the cut
  (rw->tb, med): arctic +6 rr +3 glow +4 oc +5 st +2 bay +2 sw +1 lk 0
  riv -3 lag -4 (last two = re-rolled lotteries; river mean +5.1). Boat-
  contact columns carry the tenth hull everywhere. Goal still 2/10.
