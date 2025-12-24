# AI Race Eval Instructions

This directory contains an automated evaluation harness for the Regatta AI.

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
