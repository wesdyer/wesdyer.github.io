# Arctic AI campaign instruments (Aug 2026)

Research tools from the arctic (Glacier Sound) AI campaign. Full context:
`regatta/guidelines/arctic-ai-campaign.md`.

⚠️ All scripts reference a repo snapshot at `path.join(__dirname, 'treeA')` —
they were written to run against a frozen copy so benches stay valid while the
live tree changes. Either create `treeA` as a snapshot next to the script
(`rsync -a <repo>/regatta/ treeA/regatta/`) or point `ROOT` at the repo root.
They also expect `playwright` (`npm i playwright` near the scripts or symlink
node_modules).

- `solo_bench.js` — THE 12-seed solo gate (seeds 4242-4253). Accepted-stack
  reference: mean 91.3 / min 74 / 2 roundings (post-#43).
- `fleet_leg2.js <trials> <seed0> <label> <tree>` — uncapped fleet profiler
  (cutoff raised to 900 in-page), per-boat leg timestamps incl. tArm/tOut phase
  split, 15s progress sampling, labeled JSON out. THE fleet acceptance gate
  (paired by boat name vs a baseline label). Reference (accepted stack,
  seeds 9100-9107): 51/72 rounders, 30/72 finishers.
- `arctic_eval.js` — capped (real 420 cutoff) fleet eval; headline DNS/DNF.
- `rl_env.js` — SweepEnv: reset/step RL environment over the armed-sweep phase.
  Solo by default; `window.__rlFleet = true` for traffic. Consumed by hooks in
  script.js gated on `window.__rl` (inert in play/eval — bench-verified).
- `rl_const_grid.js` — constant-action grid search through SweepEnv.
- `solo_trace.js` / `jam_trace.js` — 1Hz steering traces (solo hero / all bots).
- `fleet_leg2_phases.json` / `fleet_leg2_gapfc.json` — accepted-stack baseline
  runs for paired comparison.
