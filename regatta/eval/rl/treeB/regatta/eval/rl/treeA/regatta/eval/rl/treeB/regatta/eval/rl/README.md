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
- `rl_shared.js` — shared in-page source: rival-aware 42-float obs (26 original
  + 16-sector rival ring occupancy), tanh-squashed linear policy (86 params,
  init = classical 0.85/1.0), whole-episode in-page rollout (batch stepping),
  and `__rlInstallActFor` (policy drives EVERY armed bot via the script.js
  `window.__rl.actFor` hook — still inert without the flags).
- `rl_train_cem.js` — CEM trainer: parallel page pool, common-random-number
  seeds per iteration, elite 25%, decaying sigma noise. `--stage solo` (rivals
  parked) / `--stage fleet` (rivals race classically; adds the arc-blocking
  proxy: -0.05/step per armed rival within 350u). `--probe` = reset-only
  arming probe. Fleet-arming seeds: 4242,4244,4245,4246,4247,4248,4250,4251,
  4252 (4243/4249/4253 never arm in traffic). Checkpoints rl_policy_<stage>.json.
- `rl_gate.js` — THE acceptance gate for a trained policy: fleet_leg2's exact
  measurement with the policy driving every armed bot; seeds parallel across
  pages. `--baseline` (hooks inert) byte-diffs against the stored accepted-
  stack JSON. `rl_pair.js` — paired comparison of two fleet_leg2 JSONs.
- `solo_trace.js` / `jam_trace.js` — 1Hz steering traces (solo hero / all bots).
- `fleet_leg2_phases.json` / `fleet_leg2_gapfc.json` — accepted-stack baseline
  runs for paired comparison.

## Lighthouse Cove (bay) instruments (Aug 3 2026)

Same treeA-snapshot convention; treeB = a second snapshot holding baseline
script.js (git HEAD) so experiment and baseline benches run concurrently.

- `bay_bench.js <trials> <seed0> <label> <tree>` — fleet profiler for the bay
  (7-leg, 5-rounding course; player parked at 5900,-6100; cutoff 900).
  Reference: base20 (seeds 9100-9119, clean HEAD) = 180/180 finishers,
  fin med 277, 0 pens. Accepted stack (clean-run exits + local planing gate):
  fin med 268, paired +6/-6.8 med/mean vs base20.
- `bay_report.js <label> [labelB]` — per-leg durations vs the HUMAN reference
  (7 trajs: fin med 226; legs 42/27/39/53/40/20), plus paired deltas.
- `bay_trace.js <seed> [maxT] [tree]` — 1Hz all-bot traces (twa, planing,
  exitClean, outbound) for line-quality diagnosis vs the human trajectories.
- `bay_diag.js <seed>` — per-leg dur/dist-ratio/tacks/slow-secs vs human.
- `bay_dmc_dump.js [tree]` — course type, marks, DMC ruler paths (bay_dmc.json).
