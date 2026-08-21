// IS `boat.speed × 60` THE RATE THE BOAT ACTUALLY TRAVELS? (2026-08-14)
// _glow_odo.js (his laps, ground frame, Σ|Δp|) and _beat_decomp.js (the fleet, hull
// frame, Σ speed·dt) disagree by 21% on glowtide leg 1 with the recorded current
// column at ZERO. With no current those two must coincide, so one of them is wrong
// about the physics — and if it is the hull-frame one, every _beat_decomp odometer
// ever published (bay/lake/ocean) is understated by that factor.
// This settles it INSIDE the game: per frame, per bot, accumulate both.
//   node _frame_odo.js <venue> <seed> <tree>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const SEED = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || process.argv[4] || 'treeFINAL');

(async () => {
    const b = await chromium.launch();
    const p = await b.newPage();
    await p.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await p.evaluate(async (seed) => {
        window.evalHarness.seed = seed; window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const dt = 1 / 60;
        const acc = {}, prev = {};
        let curSeen = 0, curMax = 0, frames = 0;
        for (let it = 0; it < 60 * 900; it++) {
            // sample BEFORE and AFTER one update so the pairing is exact
            const pre = {};
            if (state.race.status === 'racing') for (const bt of state.boats) {
                if (bt.isPlayer || bt.raceState.finished) continue;
                pre[bt.id] = { x: bt.x, y: bt.y, s: bt.speed, vx: bt.velocity.x, vy: bt.velocity.y };
            }
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            frames++;
            for (const bt of state.boats) {
                if (bt.isPlayer || bt.raceState.finished) continue;
                const q = pre[bt.id]; if (!q) continue;
                const a = acc[bt.id] || (acc[bt.id] = { g: 0, h: 0, v: 0, n: 0, name: bt.name });
                const d = Math.hypot(bt.x - q.x, bt.y - q.y);
                if (d > 50) continue;                       // teleport / reset guard
                a.g += d;                                   // ground: actual travel
                a.h += q.s * 60 * dt;                       // hull: what _beat_decomp counts
                a.v += Math.hypot(q.vx, q.vy) * 60 * dt;    // velocity-vector magnitude
                a.n++;
            }
            if (typeof state.getCurrentAt === 'function') {
                const bt = state.boats.find(x => !x.isPlayer);
                if (bt) { const c = state.getCurrentAt(bt.x, bt.y); if (c) { const m = Math.hypot(c.x || 0, c.y || 0); if (m > 0.001) curSeen++; if (m > curMax) curMax = m; } }
            }
        }
        return {
            rows: Object.values(acc).map(a => ({ name: a.name, g: Math.round(a.g), h: Math.round(a.h), v: Math.round(a.v), n: a.n })),
            frames, curSeen, curMax
        };
    }, SEED);
    await b.close();
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
    console.log(`\n=== ${VENUE} seed ${SEED} — ground vs hull odometer, ${r.rows.length} bots, ${r.frames} racing frames ===`);
    for (const q of r.rows) console.log(`  ${q.name.padEnd(10)} ground ${String(q.g).padStart(6)}  hull(speed×60) ${String(q.h).padStart(6)}  |velocity|×60 ${String(q.v).padStart(6)}   g/h ${(q.g / q.h).toFixed(3)}  g/v ${(q.g / q.v).toFixed(3)}`);
    console.log(`\nfleet med g/h ${med(r.rows.map(q => q.g / q.h)).toFixed(3)}   med g/v ${med(r.rows.map(q => q.g / q.v)).toFixed(3)}`);
    console.log(`current: ${r.curSeen} frames non-zero at boat 1, max |c| ${r.curMax.toFixed(3)}`);
    console.log(med(r.rows.map(q => q.g / q.h)) > 1.05 || med(r.rows.map(q => q.g / q.h)) < 0.95
        ? '⚠️ `speed × 60` IS NOT THE TRAVEL RATE — every hull-frame odometer is biased'
        : '✓ hull-frame odometer agrees with actual travel');
})();
