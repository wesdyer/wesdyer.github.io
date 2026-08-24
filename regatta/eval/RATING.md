# The character re-rating campaign

*August 2026. Re-rate all 100 characters against the current AI and the current ten
venues, and produce a total order.*

Commissioned by the owner with three answers given up front: **all ten venues at equal
weight**, **600 races per character**, and **all four deliverables** — the total order,
whether the venues agree enough for one order to be honest, the price of all ten stats,
and an audit of every character's `beat` line.

---

## Run it

```sh
node regatta/eval/rate_legtypes.js                              # once, per venue set
node regatta/eval/rate_campaign.js --per-char 600 --workers 10 --shard 100
node regatta/eval/rate_campaign.js --status                     # progress, any time
node regatta/eval/rate_report.js --venue seatrials              # one venue
node regatta/eval/rate_report.js --all --json out.json          # pooled order + agreement
```

**Interrupting is safe and resuming is the same command.** A shard file only exists once
it is complete and its venue file was stable throughout; anything unfinished is a
`.part` that gets rewritten. Nothing is ever double-counted, because a shard's seed
range is a pure function of `(venue index, shard index)`.

**Restarting on another machine reproduces the same numbers.** The RNG is seeded per
trial and the seed allocation is deterministic, so nothing is lost by starting over —
`playwright` is pinned at `^1.57.0` in `package.json` and the same Chromium build gives
the same races. Only pass `--workers` above 10 if the machine has more than 12 cores;
at 10 workers this saturates a 12-core box completely.

---

## The pieces

| file | what it is |
|---|---|
| `rate_harness.js` | in-page harness. **The four observational changes live here — read its header first.** |
| `rate_run.js` | one shard. Writes JSONL, one line per race. Stamps venue/roster/AI hashes. |
| `rate_campaign.js` | the driver. Sharding, worker pool, resume, per-venue cutoff policy, run order. |
| `rate_legtypes.js` | asks the game what kind of leg each leg is. Run once per venue set. |
| `rate_lib.js` | loading, the fixed-effects fit, cluster bootstrap, Kendall's tau, OLS. |
| `rate_report.js` | the five reports. |
| `rating/` | campaign output. `BASELINE.json` records the AI it was raced against. |
| `rating-preAI/` | the pre-merge run. See its README — it is a paired experiment, not spare data. |

`tier_eval.js` is the previous generation and is superseded. Its metric was right; see
"what changed and why" below for what it could not do.

---

## ⚠️ The AI is frozen

Owner constraint: **the sailing code and the venue documents must not be changed.**
Everything this campaign does is eval-side. The harness header carries the argument
that none of its four changes can move a boat that finishes.

Every shard stamps a `codeHash` over the seven files that decide how a boat sails
(`script.js`, `rules.js`, `planner.js`, `traffic.js`, `venuedoc.js`, `swell.js`,
`water.js`). `loadVenue` **refuses to pool shards across a change**. This matters more
than it sounds: a mid-campaign AI change leaves every other hash identical and would
surface as *venue disagreement*, which is the one result the campaign exists to
produce. If `BASELINE.json` no longer matches the tree, every venue must be re-raced.

---

## Five things that were wrong before this campaign, and are corrected in it

Each was found by measurement, not by reading.

**1. DNFs were being scored as finishers.** At the course cutoff `script.js` marks every
unfinished boat `finished = true` with `finishTime = the cutoff`. `tier_eval.js` tests
only `b.finished`, so a boat that never finished was scored as one whose time was
exactly the cutoff — identical fake times for a third of the fleet at redrock, 39% at
glowtide, **74% at swamp**. It was invisible: every character's `dnfPct` read 0.0. Fixed
by believing `resultStatus`, and by raising the cutoff (below).

**2. Finley had never been measured. Ever.** The fleet is drawn as
`AI_CONFIG.filter(c => c.name !== settings.character)` — you never race yourself — and
the eval always sailed as the default character. He was absent from every measurement in
the project's history. Fixed by rotating the held-out character each trial, which also
spreads the hole evenly across all 100.

**3. Every race ran to the full cutoff for nothing.** The old loop exited when *all*
boats finished, and the undriven player boat parked on the start line never finishes.
So every race simulated to the ceiling even after the last AI was home — 32–40% waste.
Fixed by exiting on the AI fleet. The player boat is left exactly where it is; only the
stopping rule changed, so race physics are untouched.

**4. Leg types cannot be read off `state.course.marks`.** That array is not the course
order — seatrials is `[startPin, startBoat, windwardPin, windwardBoat]`, so walking it
pairwise calls a windward-leeward course "reach beat reach". Ask `window.Course`
(`rate_legtypes.js`). `script.js:22762` warns that even the authored `beat` flag has
disagreed with the geometry before.

**5. `reach` is no longer decorative.** It was measured at −0.180 s/pt and written off
because every venue was windward-leeward. Six of ten venues now have real reaching legs,
and it prices at **−0.631 s/pt on seatrials alone** — 3.5× larger, 6 SE from zero, on a
course with no reaching leg at all.

---

## The cutoff policy, and why it is per venue

The rule is the owner's: *double the cutoff so the laggards come in; if they still don't
finish, score them last with DNF = 0*. Measured, the ten venues split three ways.

| | venues | DNF shipped → doubled | cost of doubling |
|---|---|---|---|
| **nothing changes** | seatrials, ocean, lake, lagoon, bay | 0% → 0% | free |
| **large win, free** | redrock 33%→0%, glowtide 39%→0%, arctic 11%→0% | | **free** |
| **pinned at the ceiling** | river, swamp | | 2× |

Doubling is free wherever the fleet comes home, because the loop exits at the last
finisher — redrock stops at 450 s of a possible 720 s. The cost only appears at the two
venues that stay pinned.

- **swamp ×2.** 74% → 15%. The largest data-quality gain in the campaign; at the shipped
  cutoff three quarters of the fleet share one identical fake time.
- **river ×1.25.** Doubling recovers *nothing* (17% → 17%). Measured over 54 boat-slots
  the distribution is bimodal with an empty middle: 45 finish (slowest 344 s) and 9 never
  finish at all, **all nine stuck on leg 3 of 3** after 720 s — longer than the winning
  race took. 1.25× (450 s) covers 106 s beyond anything observed for +25% instead of
  +100%.

**Swamp runs last** — most expensive (~387 s/race) and least certain, so the other nine
rankings exist before it starts and the option to cut it short stays open.

---

## Reading the output

Two ratings are reported side by side and they answer different questions.

- **TIME** — seconds faster or slower than an average character *in the same race*. This
  is the physics, and it is what the stat regression runs against.
- **POINTS** — the owner's scoring rule, 9 down to 1 by finish order, DNF and DNS score
  0. This is what a player experiences, because it counts a blown race as a disaster
  rather than as a slow time.

Where they disagree, the character is inconsistent. That is worth seeing, not averaging.

**What the numbers can and cannot support.** From the 1,200-race predecessor: the true
spread between characters is 5.81 s against 1.47 s of measurement error, so the ordering
as a whole is ~94% signal — but the median gap between *adjacent* characters is 0.10 SE.
Neighbours are a coin flip and always will be; closing that would take ~400× the races.
At 600/char the typical rank error is **±3 places out of 100**. So: the total order is
real, the tiers are solid, the top and bottom are unambiguous, and **rank 47 vs rank 48
is noise**. Report tiers and confidence, never bare adjacency.

---

## Open questions for whoever picks this up

- **Does one total order hold?** Kendall's τ between venue pairs decides it. Arctic has
  *no upwind leg* (two reaches) and swamp is a single leg in 4 kn, so if the venues
  disagree anywhere it will be there. If τ is low, the venue×character matrix is the
  real deliverable and the total order is a headline on top of it.
- **River's stuck boats.** 17% reach the final leg and never finish. Test whether it
  correlates with any character trait: if it does, river's points ranking is *biased*
  rather than noisy, and its time ranking is biased too by conditioning on finishing.
- **The paired AI comparison.** `rating-preAI/` holds seatrials on the pre-merge AI at
  the same seeds. Differencing it against the new seatrials measures exactly what the
  63-line merge did, at 6,667 paired races — far stronger than the 8–20-seed benches in
  `eval/rl/` that AI changes are usually judged on.
- **A known regression, not caused here.** The merge left `test_apparent.js` failing at
  99.99% of 19,790 boat-frames — roughly two frames violate "apparent is always forward
  of true". Pre-merge it passed. Unrelated to the ratings; worth someone's time.

---

# RESULTS — the campaign completed 2026-08-20

**66,670 races. All ten venues at 600/char. 670/670 shards, none tainted, none lost.**
148.9 h on 10 workers. Everything below supersedes the sections above where they differ.

## The four open questions, answered

**Does one total order hold? Partly — mean Kendall τ = 0.435 over all 45 venue pairs.**
Not high enough to call the total order a complete summary, not low enough to throw it
away. Report it as a headline over the venue×character matrix, which is what the
`spread` column is for: Lure swings **12.2%** of a race between its best venue and its
worst, wider than the gap from rank 1 to rank 60. The endpoints of the order are
unambiguous; the middle is a band, not a sequence.

**The predicted outlier was wrong.** The section above expects arctic to be where
disagreement shows, because arctic "has no upwind leg". It does have one (below), and
arctic turns out to be the *second most representative* venue in the set (mean τ 0.520).
Ranked by how much each venue resembles the other nine:

| least like the rest | | | | | | | | | most |
|---|---|---|---|---|---|---|---|---|---|
| seatrials | swamp | redrock | ocean | lake | river | bay | glowtide | arctic | lagoon |
| 0.289 | 0.356 | 0.381 | 0.393 | 0.445 | 0.475 | 0.480 | 0.487 | 0.520 | 0.523 |

**seatrials is the least representative course in the venue set** — and it is the venue
every historical measurement, including `stat_prices.json`, was fitted on. See the
leg-composition finding below for why.

**River's stuck boats are a BIAS, not noise.** 21.1% of 60,003 boat-slots DNF (the 17%
above was measured on 54 slots), and **12,030 of 12,657 die on leg 3**. Per-character DNF
runs 15.2%–27.6%, sd 2.69 against a binomial 1.67 if it were a lottery — **1.62×, so
there is real structure**. It tracks a stat: DNF% vs `downwind` **r = +0.462** (reach
+0.308, pressure +0.239, upwind +0.218). Strong-downwind characters get stuck more, so
river's points ranking encodes good downwind as a penalty. The time ranking is
conditioned on finishing and DNF% vs mean finish time is **r = −0.388** — the boats that
vanish are the *faster* ones, so river deletes strong characters from a quarter of its
races. Not fixed: the AI is frozen.

**The paired preAI experiment returns a strong null, by construction.** Differencing
`rating-preAI/` seatrials against the new seatrials at identical seeds — pairing verified
clean, 0 wind / 0 held-out / 0 fleet mismatches — gives **exactly zero difference across
6,667 races and 60,003 boat-slots**, DNFs included (66 vs 66). That is correct and not a
bug: the 63-line merge is wrapped entirely in `if (state.traffic && state.traffic.length)`
and **bay is the only venue with authored traffic**. Confirmed against git: `ff2f78a`
hashes to `bfa5aae9efa2bdcd` and HEAD to `4f6bd728bd731167`, 63 pure insertions to
`script.js`, the other six sailing files byte-identical.

So the claim above — that this "measures exactly what the 63-line merge did" — is not
right. It measures the merge **at a venue where the changed code cannot execute**. What
it genuinely establishes is that nine of ten venues are unaffected, which rules out the
campaign's own nightmare (an AI change masquerading as venue disagreement). To actually
measure the merge, race `ff2f78a` at **bay** and difference that. No pre-merge bay data
exists; `rating-preAI/` holds only seatrials and a partial ocean, both traffic-free.

## The points rating, and whether it neutralises the courses

Owner's question, 2026-08-23: finish time is in seconds, and a second is worth different
amounts at swamp (352 s mean race) and seatrials (197 s). The pooled order handles that by
converting to `deltaPct`, but **average points per race sidesteps it entirely** — a
finishing position is scale-free, so no normalisation is involved and course length cannot
leak in through the units. Built from the existing 66,670 races; nothing was re-raced.

**Scale.** 1st = 9 down to 9th = 1, DNF and DNS = 0. Note this *is* the stored rule: the AI
fleet is nine boats (`fleetSize = ai.length`, the undriven player never finishes), and
`fleetSize + 1 - place` = `10 - place` = 9…1. A 10-point top score would need `11 - place`,
which would be a uniform +1 to every finisher — not a neutral relabel, since it raises the
value of merely finishing and therefore re-weights the DNF-heavy venues.

**It agrees with the time rating: Kendall τ = 0.848.** The two ratings are substantially
measuring the same thing, which is the reassuring result.

**But it does NOT neutralise cross-course effects — it is slightly worse at it.** Mean τ
*between venues* is **0.387 on points against 0.435 on time**. Two reasons: finishing order
discards margin, so each race carries less information than its time does; and DNF = 0
injects venue-specific bias exactly where the time rating simply had no reading. The
venue×character matrix remains the real deliverable on either metric.

**The band is tight, as expected:** 3.960 to 5.979 out of 9, a 2.02-point spread around a
fleet mean of 4.952. Median adjacent gap 0.18 SE with 4 of 99 pairs separated at 2 SE —
marginally better resolution than the time order's 1 of 99, but still a tier list and not a
sequence. Top: Stomp 5.979, Talon 5.947, Cruz 5.891, Muninn 5.875, Hug 5.852. Bottom:
Viper 3.960, Splash 4.054, Pulse 4.055, Knot 4.126.

**Where the two ratings disagree** is where a character is inconsistent — fast on average
but not converting it, or the reverse. Largest moves: Zing (time #35 → points #59), Anvil
(#44 → #22), Regal (#30 → #52), Saffron (#34 → #55), Bruce (#60 → #40), Riffle (#27 → #46).

### Average points per venue is a measure of attrition, not difficulty

Scoring is zero-sum inside a race, so a venue's mean points per boat-slot is **pinned at
exactly 5.000 when every boat finishes**. It can only fall, and only by the DNF rate.

| venue | avg pts | DNF% |
|---|---|---|
| lagoon, bay, lake, ocean, arctic | 5.000 | 0.0 |
| redrock, seatrials, glowtide | 4.999 | 0.1 |
| **swamp** | 4.873 | 9.2 |
| **river** | **4.648** | **21.1** |

Best venue by average score: **lagoon** (and the four others tied at 5.000). Worst:
**river** at 4.648. That gap is entirely river's stuck boats — and since those DNFs are
`downwind`-correlated (r = +0.462, above), river's points rating is where the bias bites
hardest of all: a DNF costs a full 5 points against the fleet mean, every time.

## There is no intended-tier list — but the modelled one was right

Asked 2026-08-23: is there a per-character intended tier anywhere? **No.** Checked the
guidelines, the eval JSONs, `AI_CONFIG` (which has no tier field) and git history including
deleted files. `guidelines/skills.md` §0 refers to a design sketch that assigned every
character S–D, but only the verdict on it survives — *16/66, exactly chance* — and the
sketch itself was never committed. `guidelines/roster-ranking.md` does rank all 100, but it
is explicitly "a merchandising problem, not a balance problem": desirability for the
new-player slate, not skill.

What does exist is `tier_grid.json`, and its `future` column is better than intent — it is a
**falsifiable forecast**. Per `tier_grid.py`: `today` is measured (1,200 races, seatrials,
when every venue was windward-leeward) and `future` is the same stat lines re-priced for the
course shapes specced in `guidelines/venues.md`, built to isolate "who is propped up by a
W/L-only game". Those venues now exist and have been raced. The forecast can be scored:

| predictor | exact tier | within one tier | Kendall τ vs the new pooled order |
|---|---|---|---|
| `today` — measured, 1,200 races, seatrials only | 28/81 (35%) | 74% | 0.289 |
| **`future` — modelled** | **33/81 (41%)** | **90%** | **0.465** |
| `future_aggr` — aggressive variant | 32/81 (40%) | 93% | — |

**The model predicts the 66,670-race result better than the real 1,200-race measurement it
was built from, by +0.177 τ**, and **29 of its 40 called movers moved in the predicted
direction** (Croak S→C landed C, Splat B→D landed D, Wobble B→A landed A, Torch B→A landed
A). Misses exist: Pearl was called B→S and did not move, Wiggle was called B→S and went to C.

So the tier history splits cleanly. The hand-drawn sketch was chance-level, which is what
skills.md §0 records. The modelled projection was substantially right, and nothing had
confirmed that until this campaign.

## A sixth thing that was wrong: leg types are not single-valued

Finding 4 above fixed *which* marks a leg runs between. It did not fix the assumption
underneath: `rate_legtypes.js:80` classifies a whole leg by **one straight-line bearing**
from its start point to its end point. That chord is only the point of sail if the leg is
sailed straight. Measured at 10 Hz over real races (sampling every AI boat's TWA and
binning by progress through the leg), **legs are mixed almost everywhere**:

- **arctic** — chord says "reach, reach". Measured: leg 1 is 23% beat / 31% reach / 45%
  run; leg 2 is **39% beat** / 30% reach / 31% run. *Arctic has substantial upwind
  sailing*, which is why the prediction built on "no upwind leg" failed.
- **redrock** — every leg mixed. Leg 3 is chord-labelled `beat (twa 38)` and is
  **46% reach**.
- **swamp** — its single leg is chord-labelled `beat (twa 48)`, right against the 51.4°
  threshold, and is actually **59% reach** / 32% beat.
- **seatrials** — the *only* venue whose legs are genuinely pure (87/84/88/99%).

That last point is the important one. The chord classifier was never obviously broken
because it was only ever asked about the one course that cannot expose it — and that
course is also the least representative venue in the set.

Two consequences. **Stat pricing is unaffected** — it regresses a character's whole-race
delta on their stats and never touches a leg label. **The beat-line audit was affected**,
and has been rebuilt: each leg's delta is now split across beat/reach/run in the measured
proportions, relative to the fleet's mean time on that leg in that race, pooled over
253,336 race-legs. That changed the findings — it dropped `Zing/beat` and `Bramble/beat`
(chord artifacts) and added `Talon/run`, `Puff/run`, `Snag/reach`.

## What the ten stats are actually worth

`upwind` is the only stat that prices significantly at **all ten** venues (−0.80 to
−3.00 s/pt). `reach` prices at **nine of ten** — it is emphatically not decorative, and
finding 5 above is upheld in direction even though its −0.631 figure does not reproduce
(seatrials measures **−0.383 ±0.065** at 6,667 races). Its framing is wrong, though:
seatrials is not "a course with no reaching leg at all" — the start sequence alone is
36% reach and every leg carries 9–13% reach in approaches and roundings.

The three stats `stat_prices.json` never priced, resolved:

| stat | verdict |
|---|---|
| `heavyAir` | **real, conditional** — ocean −0.838, arctic −0.707, zero at the other eight |
| `lightAir` | **real, single-venue** — swamp **−4.107**, the largest price in the campaign; zero at the other nine |
| `memory` | **buys nothing** — not distinguishable from zero at all ten venues |

And the headline for balance work: **a single-venue stat price is not a price.** `handling`
reads −0.112 ⌀ at seatrials and **−2.415 at redrock**; `pressure` reads −0.011 ⌀ at
seatrials and **−2.010 at lake**, **−3.516 at swamp**. Both were called weak by the old
fit because the old fit only ever saw seatrials.

Against the stored `stat_prices.json` (same specification — stats plus archetype dummies,
bully as reference), `downwind` was the big miss: **−1.724 stored vs −1.105 measured, 36%
overpriced**. `upwind` held (−1.001 → −1.123).

## Archetypes are a one-sided lever

Only two of the seven non-reference archetypes have a measurable effect, and both are the
slow ones — `corner` (+0.475 intended, **+2.642** measured) and `freight` (+1.558 →
**+2.877**). All four intended-*fast* archetypes (`gambler`, `metronome`, `rocket`,
`shift`) are statistically indistinguishable from `bully`. Metronomes do finish fast, but
entirely through their stats, with nothing left over for the archetype. Rank agreement
with intent is τ 0.571. Note the ~0.7 s SEs come from having only 12–13 characters per
archetype, not from race count — more races will not sharpen them.

The stat budget itself is honest: correlation between total stat points and pooled finish
is **−0.818**, and ten extra points buys about **1.9% of a race**.

## Reproducing this on another machine

`loadVenue` compares shards against **each other**, never against `BASELINE.json`, so
pooling is safe — but a CRLF checkout and an LF checkout stamp different `codeHash` values
for the identical tree (`30c4272fa461bec1` vs `4f6bd728bd731167`) and will refuse to pool
with each other. `core.autocrlf=true` with no `.gitattributes` is the cause. The numbers
reproduce; the hash gate does not. See `rating/BASELINE.json` for the full argument.
