# ARCHIVE.json — the campaign after the rows are gone

`ARCHIVE.json` is the durable record of the character re-rating campaign: **66,670 races,
ten venues, 100 characters, 148.9 hours**. 0.43 MB, tracked in git.

## Why it exists

The race rows live in `rating/*.jsonl` (~25 MB) and `.gitignore` excludes them, on the
reasonable grounds that seeds are a pure function of `(venue, shard)` so the rows are
reproducible. They are — but only at **149 hours of compute**, on a checkout with matching
line endings (the `codeHash` gate is eol-sensitive — see `BASELINE.json`) and the same
pinned Chromium build. That is a thin thread to hang 149 hours on.

So the aggregates that answer the questions worth asking are pre-computed and committed.
Regenerate with:

```sh
node regatta/eval/gen_archive.js
```

## What it can answer

Verified against the live data — every one of these was run from the archive alone, with no
`.jsonl` opened:

| Question | Where |
|---|---|
| Fastest characters at any venue | `characters[name][venue].deltaPct` |
| Whole pooled total order, rebuilt | mean `deltaPct` across the ten venues — reproduces −5.02 Talon … +5.04 Splash exactly |
| Head-to-head: does A beat B? | `headToHead.pairs` — all 4,950 pairs (Stomp is ahead of Talon in 211 of 430 shared races, 49.1%) |
| What a stat point buys, per venue | `venues[venue].prices.stats` — β and SE for all ten stats |
| Archetype effects, per venue | `venues[venue].prices.archetypes`, `bully` as reference |
| Who is exposed to river's DNF | `characters[name].river.dnfPct` (reproduces r = +0.462 against authored `downwind`) |
| Per-leg time splits | `characters[name][venue].legMean` |
| Distribution shape, not just the mean | `finishMean`, `finishSd`, `finishP10/P50/P90` |
| Which legs are mixed points of sail | `legComposition` — measured beat/reach/run fractions at 10 Hz |
| Penalties, manoeuvres, win%, top3% | per character per venue |
| Points rating on the 9→1 scale | `pts`, `ptsSd`, `ptsEffect` |

## What it deliberately cannot answer

Ask these **before** deleting the rows, because the archive cannot recover them:

- **Joint outcomes inside a single race.** Head-to-head is aggregated pairwise, so "did A
  and B fail in the *same* race?" is gone. So is any three-way or fleet-shape question.
- **Anything conditioned on a per-race covariate that was not aggregated.** Only mean/min/max
  wind is kept per venue, so "how does Talon do in the top decile of wind direction?" needs
  the rows.
- **Any re-fit at a different model specification.** The character effects here come from the
  fixed-effects fit and the stat prices from OLS on stats + archetype dummies. A different
  spec — interactions, a robust loss, per-leg regression — needs the cells back.

## Schema

Top level:

| key | contents |
|---|---|
| `campaign` | races, venues, per-char, shard layout, wall clock, cutoff policy, scoring rule, toolchain, the CRLF codeHash note |
| `statOrder` | the ten stat names, in the order `roster[n].stats` uses |
| `names` | all 100, sorted — `headToHead` indices point into this |
| `roster` | per character: `archetype`, `beat`, `stats[10]`, `total` |
| `venues` | per venue: race count, hashes, mean finish time, mean duration, residual sd, cutoff, legs, marks, wind, DNF%, `prices` |
| `characters` | `[name][venue]` → the per-character block below |
| `headToHead` | `pairs: [i, j, racesTogether, timesIFinishedAheadOfJ]`, upper triangle |
| `legComposition` | per venue per leg: measured `beatPct` / `reachPct` / `runPct`, the modal `sequence`, and the chord label it supersedes |

Each `characters[name][venue]`:

```
n            boat-slots at this venue          winPct, top3Pct
delta        seconds vs an average character   dnfPct, shipDnfPct
se           bootstrap SE of delta             penPerRace, manPerRace
deltaPct     delta as % of mean finish time    finishMean, finishSd
pts          mean points, 9..1, DNF = 0        finishP10, finishP50, finishP90
ptsSd        sd of points                      legMean[]  mean seconds per leg
ptsEffect    points vs an average character
```

## Two cautions for whoever reads this next

**`legtypes.json` is wrong and `legComposition` supersedes it.** The chord classifier in
`rate_legtypes.js` labels each leg by one straight-line bearing, which is right only at
seatrials. Arctic leg 2 is chord-labelled *reach* and measures **39% beat**; swamp's single
leg is chord-labelled *beat* and is **59% reach**. Use `legComposition` for any
point-of-sail attribution.

**`deltaPct` is normalised by mean boat finish time, not race duration.** `meanFinishTime`
is the denominator (`rate_report.js:68`); `meanRaceDuration` is kept alongside it but is a
different and larger number. Dividing by the wrong one shrinks every percentage by ~30%.

See [../RATING.md](../RATING.md) for the findings themselves.
