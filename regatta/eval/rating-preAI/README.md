# Pre-merge campaign data — the OLD AI

Raced 2026-08-13 against AI code hash `bfa5aae9efa2bdcd` (see `BASELINE.json`),
immediately before the AI branch was merged into master.

**Do not pool these with `regatta/eval/rating/`.** They measure a different sailing
engine. `rate_lib.js: loadVenue` refuses the merge on `codeHash`, and the shards
written before that field existed carry no hash of their own — which is exactly why
they were moved out of the way rather than left in place.

## What is here

| venue | shards | races | races/char |
|---|---|---|---|
| seatrials | 67 | 6,667 | 600 — **complete** |
| ocean | 10 | 1,000 | 90 — partial |

Plus `legtypes.json` (the per-venue leg classification asked of `window.Course`) and
`BASELINE.json` (the AI hash these were raced against).

## Why it was kept

The re-race uses the SAME SEEDS (`1000000 + venueIndex*100000 + shardIndex*1000`),
because the seed allocation is a pure function of venue and shard index. So seatrials
now has 6,667 fully paired races — identical conditions, identical fleets, one AI on
each side.

That is a free, properly powered measurement of **what the AI rebuild actually did**,
which is a stronger design than the 8–20-seed benches in `eval/rl/` that AI changes
have historically been judged on. It costs nothing to keep and cannot be reproduced
once the old code is gone from the working tree.

To use it: run `rate_report.js --dir regatta/eval/rating-preAI --venue seatrials`
against the new campaign's seatrials and difference the character effects.

## Regenerating it, if it is ever lost

The old AI still exists in git, so this is reproducible — it just costs an hour rather
than being free:

```sh
git worktree add /tmp/premerge ff2f78a
ln -s "$PWD/node_modules" /tmp/premerge/node_modules
cp regatta/eval/rate_harness.js regatta/eval/rate_run.js /tmp/premerge/regatta/eval/
cd /tmp/premerge
node regatta/eval/rate_campaign.js --venues seatrials --per-char 600 \
     --workers 10 --shard 100 --dir <somewhere outside the worktree>
git worktree remove --force /tmp/premerge
```

`ff2f78a` is the last commit before the AI merge. Confirm you got the right tree by
checking the `codeHash` in the shard headers: it must read `bfa5aae9efa2bdcd`. The
campaign driver and the harness are deliberately copied in rather than checked out,
because they postdate that commit — and the copy is safe precisely because they are
eval-side and touch no sailing code.
