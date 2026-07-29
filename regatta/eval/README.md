# AI Race Eval Instructions

This directory contains two harnesses with different jobs:

| | Question it answers | Compares |
|---|---|---|
| **AI eval** (`run_eval.js`) | *Does the AI race well?* | summary statistics |
| **Golden traces** (`run_traces.js`) | *Did this change alter behaviour at all?* | per-frame hashes |

Use the AI eval to judge a tuning change. Use golden traces to prove a **refactor**
changed nothing — the eval cannot do that, because a boat taking a completely
different path to the same finish time produces the same statistics.

---

## Golden traces

```bash
npm run trace              # verify against the committed golden
npm run trace:update       # re-record (10 venues x 3 seeds x 300s, ~2.3 min)
npm run trace:det          # determinism check (same page, back-to-back races)

node regatta/eval/run_traces.js --venue arctic --seeds 3   # subset
```

`trace_harness.js` hashes **every primitive** on each boat, its `raceState` and its
controller, on every frame, plus the ordered race-event log. Two digests:

- `behaviorHash` — the gate. Must be identical across a behaviour-preserving change.
- `courseGeomHash` — course geometry only (mark endpoints, boundary, island
  vertices), so a *schema* change alone does not move it.

Baselines live in `golden/traces.json` and record `OBS_VERSION`; bump that constant
in the harness whenever you change **what** is observed, so a stale golden reports
"observation changed" instead of masquerading as a regression.

Verification runs use a **fresh page per trace**, so a `--venue` subset matches the
full sweep. `--determinism` deliberately reuses one page — that mode exists to catch
state surviving from one race into the next, which is how two real bugs were found
(visual particles consuming the simulation RNG stream, and Glacier Sound clobbering
the player's Course Distance setting).

**Chasing a divergence** — `_det.js` (repeat / seq / fresh), `_bisect.js` (first
divergent frame + full state diff), `_rngdiff.js` (records the call site of every
`Math.random()` draw and diffs the sequences). Widen what you observe rather than
reasoning about it: a narrow field set puts the apparent first divergence thousands
of frames downstream of its cause.

---

## AI eval

## Setup

1. Install dependencies:
   ```bash
   npm install playwright
   npx playwright install
   ```

## Running the Eval

Run the evaluation script via the npm script (from root):

```bash
npm run eval:ai [NUM_TRIALS] [SEED_BASE]
```

- **NUM_TRIALS**: Number of race simulations to run (default: 10).
- **SEED_BASE**: Starting random seed for reproducibility (default: 12345).

Example:
```bash
npm run eval:ai 20 5000
```

## Running Tests

To run unit tests for the metric calculation logic:

```bash
node regatta/eval/tests.js
```

## Output

1. **Console Report**: A summary table of aggregated metrics (times, DNF%, penalties, collisions) is printed to stdout.
2. **JSON Data**: Detailed results are saved to `regatta/eval/eval_results.json`, including per-trial event logs and per-character statistics.

## Configuration

The harness is configured in `regatta/eval/eval_harness.js`. You can modify:
- **Simulation Speed**: The harness runs as fast as possible by default.
- **Time Limit**: Default 600s (10 minutes game time).
