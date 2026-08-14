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
