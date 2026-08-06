# Benchmark venues — frozen copies the AI is measured against

## Why this directory exists

Every stored bench baseline (`regatta/eval/rl/bay_bench_*.json`,
`fleet_leg2_*.json`, `ocean_bench_*.json`) is a set of numbers produced on **one
specific version of a venue document**. Edit `regatta/assets/venues/bay.venue.js`
— move a mark, redraw a shoreline, change the wind — and every one of those
baselines silently becomes incomparable. The bench still runs. It still prints a
number. The number just means something different, and nothing says so.

That is the worst failure mode an eval harness can have, and this campaign has
already been bitten by the cheaper version of it (a bench label collided with a
tracked baseline and overwrote it; a merge shifted init RNG draws and every seed
reshuffled).

## The policy

**1. The venues in this directory are the ones the AI is benchmarked on.**
They are frozen copies of `regatta/assets/venues/*.venue.js`, taken at a known
commit, and they do not change when the shipping venue changes. Edit the
shipping venue freely.

**2. Every bench JSON is stamped with the fingerprint of the venue it ran on.**
`fingerprint.json` here records a content hash per venue. A comparison across
two different fingerprints is refused by `cmp_bench.py` rather than quietly
reported — a loud failure instead of a wrong conclusion.

**3. When a shipping venue changes, it is an explicit decision, and there are
three options.** None of them is automatic:

  - **PROMOTE** — the new cut becomes the benchmark. Re-freeze it here, re-run
    the anchors, and record the new numbers in `ai-campaign.md` with a note
    saying the venue moved. Old baselines are retired, not compared against.
  - **KEEP BOTH** — freeze the new cut alongside the old one (`bay@v2`). Useful
    when the change is a design variant and you want to know whether the AI
    handles both. Doubles the bench cost, so it needs a reason.
  - **DON'T TRACK** — the venue is content, not a benchmark. It races, it never
    appears in an anchor. This is the right answer for most venues; only the
    ones actually used for AI measurement need freezing.

**4. The benchmark set is deliberately small.** Today: `bay` (technical, land,
five roundings), `arctic` (open water, ice, one big rounding), `seatrials` (the
clean windward-leeward control), `ocean` (the swell). Redrock is content until
the AI can sail it.

## Refreezing

    node regatta/eval/freeze_venues.js            # re-freeze the benchmark set
    node regatta/eval/freeze_venues.js --check    # do the shipping venues still
                                                  # match the frozen ones?

`--check` is the one to run before trusting a bench result, and it is cheap.
