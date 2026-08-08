// UNDERLAY anatomy — WHAT BUYS THE WIDE DODGE? The 1.2/1.6-rad fan rungs
// carry 17-23% of deflected transit time on redrock/river (the excess-distance
// generator). At the rising edge of a WIDE-DODGE episode (|lastAvoidDeviation|
// >= 1.0 rad sustained), re-score the small candidates (0, ±0.2, ±0.4 rad off
// desired) with the same geometry the argmin saw: does the straight/near
// candidate fail on LAND (grid probe within the 140u hard zone), on a RIVAL
// (5-sample pairSafe breach), on BOTH, or on NEITHER (i.e. the wide pick is
// bought by soft costs alone)? Episode counts by leg and by blocker class.
//   node _rr_dodge.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4H');
const VENUE = process.argv[5] || 'redrock';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = {};
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const st = bots.map(() => ({ wide: 0 }));
            const out = {};
            const bump = k => out[k] = (out[k] || 0) + 1;
            const dt = 1 / 60; let fr = 0;
            const probeLand = (b, h) => {
                const g = state.course.botGrid;
                if (!g) return false;
                const spd = Math.max(70, b.speed * 60);
                for (const fr2 of [0.35, 0.7, 1.0]) {
                    const d = Math.min(140, spd * 4 * fr2);   // the hard zone is 140u
                    const cc = g.cell(b.x + Math.sin(h) * d, b.y - Math.cos(h) * d);
                    const id = cc[1] * g.n + cc[0];
                    if (!g.at(cc[0], cc[1]) && !(g._soft && g._soft[id])) return true;
                }
                return false;
            };
            const rivalBreach = (b, h) => {
                const spd = b.speed * 60;
                const vx = Math.sin(h) * spd, vy = -Math.cos(h) * spd;
                for (const o of state.boats) {
                    if (o === b || o.isPlayer || o.raceState.finished) continue;
                    const ovx = (o.velocity && o.velocity.x) ? o.velocity.x * 60 : Math.sin(o.heading) * o.speed * 60;
                    const ovy = (o.velocity && o.velocity.y) ? o.velocity.y * 60 : -Math.cos(o.heading) * o.speed * 60;
                    for (let s2 = 1; s2 <= 5; s2++) {
                        const t = s2 * 0.8;
                        const dx = (b.x + vx * t) - (o.x + ovx * t);
                        const dy = (b.y + vy * t) - (o.y + ovy * t);
                        if (dx * dx + dy * dy < 80 * 80) return true;
                    }
                }
                return false;
            };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], c = b.controller;
                    if (b.raceState.finished || b.raceState.leg < 1) continue;
                    const dev = (c && c.lastAvoidDeviation) || 0;
                    if (dev >= 1.0) st[k].wide += 0.1; else { st[k].wide = 0; continue; }
                    if (Math.abs(st[k].wide - 0.2) > 0.001) continue;   // rising edge at 0.2s sustained
                    // What fails the SMALL candidates right now? Tested around the
                    // current heading — at 0.2s into the dodge the boat has barely
                    // turned, so this is the pre-dodge course's neighborhood.
                    let landSmall = false, rivalSmall = false;
                    for (const off of [0, 0.2, -0.2, 0.4, -0.4]) {
                        const h = b.heading + off;   // relative to current (deflected) heading's neighborhood
                        if (probeLand(b, h)) landSmall = true;
                        if (rivalBreach(b, h)) rivalSmall = true;
                        if (landSmall && rivalSmall) break;
                    }
                    const cls = landSmall && rivalSmall ? 'land+rival' : landSmall ? 'land-only'
                        : rivalSmall ? 'rival-only' : 'soft-costs-only';
                    bump(`L${b.raceState.leg} ${cls}`);
                    bump(`ALL ${cls}`);
                }
            }
            return out;
        }, seed);
        for (const [k, v] of Object.entries(r)) agg[k] = (agg[k] || 0) + v;
        console.log('seed', seed, 'done');
    }
    console.log('\nWIDE-DODGE (>=1.0 rad sustained 0.2s) rising-edge episodes — what fails the small candidates:');
    for (const k of Object.keys(agg).sort()) console.log(' ', k.padEnd(22), agg[k]);
    await browser.close();
})();
