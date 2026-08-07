// P3 attribution — LAKE leg 1 has 35.7s med under-1kt per boat (vs ~6s on
// legs 2/3) and ~1000u excess odometer vs the human. WHERE does the leg-1
// parking live (400u bins), how soon after the start, and what is around the
// parked boat (rival distance, avoidance state, wind)?
//   node _lake_l1.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4H');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const heat = {}; const tHist = {}; const ctx = { rival: [], av: [], wkt: [], defl: [] };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const heat = {}, tHist = {}, ctx = { rival: [], av: [], wkt: [], defl: [] };
            const dt = 1 / 60; let fr = 0, nPark = 0;   // no Math.random: it would advance the seeded RNG
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                const DS = 0.1;
                for (const b of bots) {
                    if (b.raceState.finished || b.raceState.leg !== 1) continue;
                    const kt = b.speed * 4;
                    if (kt >= 1) continue;
                    const k = (Math.round(b.x / 400) * 400) + ',' + (Math.round(b.y / 400) * 400);
                    heat[k] = (heat[k] || 0) + DS;
                    const tb = Math.floor(state.race.timer / 20) * 20;
                    tHist[tb] = (tHist[tb] || 0) + DS;
                    if (++nPark % 20 === 0) {       // sampled context, 1/20 of parked samples
                        let nd = 1e9;
                        for (const o of bots) if (o !== b && !o.raceState.finished) {
                            const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < nd) nd = d;
                        }
                        const c = b.controller;
                        ctx.rival.push(Math.round(nd));
                        ctx.av.push(c && (c.lastAvoidDeviation || 0) > 0.14 ? 1 : 0);
                        ctx.defl.push(+(((c && c.lastAvoidDeviation) || 0) * 180 / Math.PI).toFixed(0));
                        ctx.wkt.push(+getWindAt(b.x, b.y).speed.toFixed(1));
                    }
                }
            }
            return { heat, tHist, ctx };
        }, seed);
        for (const [k, v] of Object.entries(r.heat)) heat[k] = (heat[k] || 0) + v;
        for (const [k, v] of Object.entries(r.tHist)) tHist[k] = (tHist[k] || 0) + v;
        for (const k of Object.keys(ctx)) ctx[k].push(...r.ctx[k]);
        console.log('seed', seed, 'done');
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    console.log('\nL1 parked heat (400u bins, boat-s pooled):',
        Object.entries(heat).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}:${Math.round(v)}`).join('  '));
    console.log('L1 parked time by race-minute bin (20s):',
        Object.entries(tHist).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}s:${Math.round(v)}`).join('  '));
    console.log('parked context: nearest rival med', med(ctx.rival), 'u | avoidance-active',
        (100 * ctx.av.reduce((a, b) => a + b, 0) / Math.max(1, ctx.av.length)).toFixed(0) + '%',
        '| defl med', med(ctx.defl), 'deg | wind med', med(ctx.wkt), 'kt | n', ctx.rival.length);
    await browser.close();
})();
