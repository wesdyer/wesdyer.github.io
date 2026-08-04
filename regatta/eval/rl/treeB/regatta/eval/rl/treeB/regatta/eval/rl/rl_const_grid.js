// Constant-action grid over the sweep env: is there a better (advance, speed)
// constant than the classical (0.85, 1.0)? node rl_const_grid.js
const { execSync } = require('child_process');
const fs = require('fs');
// Patch rl_env's smoke main via env var instead: simplest is a dedicated runner.
const { SweepEnv } = require('./rl_env.js');
(async () => {
    const SEEDS = [4242, 4243, 4244, 4246];
    const GRID = [];
    for (const adv of [0.6, 0.85, 1.1]) GRID.push([adv, 1.0]);
    const results = [];
    const env = await SweepEnv.make();
    await env.page.evaluate(() => {
        window.__rlObs = () => [0]; // obs unused for constants
        window.__rlFleet = true;    // TRAFFIC: other bots race classically
    });
    for (const act of GRID) {
        let banked = 0, tSum = 0, contacts = 0;
        for (const seed of SEEDS) {
            const r0 = await env.reset(seed);
            if (r0.failed) { tSum += 300; continue; }
            let done = false, steps = 0, info = null;
            while (!done && steps < 601) {
                const r = await env.step(act);
                done = r.done; info = r.info; steps++;
            }
            const t = info ? info.t : 300;
            const ok = info && info.sweep >= info.need;
            if (ok) banked++;
            tSum += Math.min(300, t);
            contacts += info ? info.contacts : 0;
        }
        results.push({ act, banked, meanT: (tSum / SEEDS.length).toFixed(0) });
        console.log(`adv ${act[0]} spd ${act[1]}: banked ${banked}/${SEEDS.length} meanT ${(tSum / SEEDS.length).toFixed(0)}`);
    }
    fs.writeFileSync(__dirname + '/rl_const_grid_fleet.json', JSON.stringify(results));
    await env.close();
})();
