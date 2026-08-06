// WHERE does redrock's leg-3 wall actually stand, and what state are the boats in?
// 55 of 71 boats enter leg 3 (m4 -> m5) and never leave; the human beats through it
// in 23s with one tack and zero contacts. Sample every stuck boat every 5s:
// position (clustered), speed, wiggle, grid-blocked-ahead, plan presence/length,
// distance to the leg's destination mark.
//   node _redrock_wall.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeNOW');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const cl = {}; const stats = { n: 0, wig: 0, noPlan: 0, blocked: 0, slow: 0, pen: 0, spd: [], dMark: [], planLen: [] };
    const legEvery = {};
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const out = { rows: [], legAt: {} };
            const dt = 1 / 60; let tick = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++tick < 300) continue;   // every 5s
                tick = 0;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const leg = b.raceState.leg;
                    out.legAt[leg] = (out.legAt[leg] || 0) + 1;
                    if (leg !== 3) continue;
                    const c = b.controller;
                    const g = state.course.botGrid;
                    let blocked = false;
                    if (g) {
                        for (const dd of [90, 180]) {
                            const cc2 = g.cell(b.x + Math.sin(b.heading) * dd, b.y - Math.cos(b.heading) * dd);
                            if (!g.at(cc2[0], cc2[1])) { blocked = true; break; }
                        }
                    }
                    // destination of the current leg via the course path carrot
                    let mk = null;
                    try {
                        const lgs = state.course.dmc && state.course.dmc.legs;
                        if (lgs && lgs[leg]) { const e = lgs[leg].pts[lgs[leg].pts.length - 1]; mk = { x: e.x, y: e.y }; }
                    } catch (e) {}
                    out.rows.push([Math.round(b.x), Math.round(b.y), +b.speed.toFixed(2),
                        c && c.wiggleActive ? 1 : 0,
                        c && c.gridPath ? c.gridPath.length : -1,
                        blocked ? 1 : 0,
                        b.raceState.penalty ? 1 : 0,
                        mk ? Math.round(Math.hypot(b.x - mk.x, b.y - mk.y)) : -1]);
                }
            }
            return out;
        }, SEED0 + i);
        for (const [leg, cnt] of Object.entries(r.legAt)) legEvery[leg] = (legEvery[leg] || 0) + cnt;
        for (const row of r.rows) {
            const [x, y, spd, wig, plan, blocked, pen, dm] = row;
            stats.n++; stats.wig += wig; stats.blocked += blocked; stats.pen += pen;
            if (plan <= 0) stats.noPlan++;
            if (spd < 0.5) stats.slow++;
            stats.spd.push(spd); if (dm >= 0) stats.dMark.push(dm);
            if (plan > 0) stats.planLen.push(plan);
            const key = `${Math.round(x / 300) * 300},${Math.round(y / 300) * 300}`;
            cl[key] = (cl[key] || 0) + 1;
        }
        console.log(`seed ${SEED0 + i}: leg-3 samples so far ${stats.n}`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
    console.log(`\nboat-5s samples by leg:`, legEvery);
    console.log(`LEG-3 samples ${stats.n}: wiggle ${(100 * stats.wig / stats.n).toFixed(0)}% | ` +
        `blocked-ahead ${(100 * stats.blocked / stats.n).toFixed(0)}% | no-plan ${(100 * stats.noPlan / stats.n).toFixed(0)}% | ` +
        `spd<0.5 ${(100 * stats.slow / stats.n).toFixed(0)}% | mid-penalty ${(100 * stats.pen / stats.n).toFixed(0)}%`);
    console.log(`speed med ${med(stats.spd)} | dist-to-leg-end med ${med(stats.dMark)} | plan pts med ${med(stats.planLen)}`);
    console.log('top position clusters (300u):');
    for (const [k, v] of Object.entries(cl).sort((a, b) => b[1] - a[1]).slice(0, 10))
        console.log(`  (${k}) ${v} (${(100 * v / stats.n).toFixed(0)}%)`);
    console.log('\n(human leg-3: (408,2288) -> (1998,2763), 23s, one tack, never under 0.8 kt)');
    await browser.close();
})();
