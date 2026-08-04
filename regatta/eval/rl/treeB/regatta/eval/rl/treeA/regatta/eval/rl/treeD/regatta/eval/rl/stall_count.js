// Pinned-boat dwell comparison between two fleet_leg2 JSONs: counts 15s
// samples below a speed floor (default 0.5), split by leg, plus per-boat max
// consecutive slow run — the bot-side mirror of the human pin analysis.
//   node stall_count.js fleet_leg2_A.json fleet_leg2_B.json [speedFloor]
const fs = require('fs'); const path = require('path');
const FLOOR = parseFloat(process.argv[4]) || 0.5;
function stats(file) {
    const J = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    let slow1 = 0, slow2 = 0, n = 0; const runs = [];
    for (const race of J) for (const b of race.info) {
        n++;
        let run = 0, best = 0;
        for (const p of b.prog) {
            if (p[5] < FLOOR) {
                if (p[1] === 1) slow1++; else slow2++;
                run += 15; if (run > best) best = run;
            } else run = 0;
        }
        if (best) runs.push(best);
    }
    runs.sort((a, b) => a - b);
    const med = runs.length ? runs[Math.floor(runs.length / 2)] : 0;
    return { slow1, slow2, boats: n, pinnedBoats: runs.length, maxRunMed: med, maxRunMax: runs[runs.length - 1] || 0 };
}
for (const f of [process.argv[2], process.argv[3]]) {
    if (!f) continue;
    const s = stats(f);
    console.log(`${f}: leg1 slow-samples ${s.slow1} (${(s.slow1 * 15 / s.boats).toFixed(0)}s/boat) leg2 ${s.slow2}`
        + ` | boats with a pin ${s.pinnedBoats}/${s.boats}, longest-pin med ${s.maxRunMed}s max ${s.maxRunMax}s`);
}
