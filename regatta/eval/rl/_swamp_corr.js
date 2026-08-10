// WHERE IS HER LINE CLOSED, AND WHAT DOES THE FLEET SAIL INSTEAD? (2026-08-10)
//
// `_swamp_line` established that 4.1% of her racing samples sit on cells the
// router calls unsailable, 3.8 of those 4.1 points closed by the prop forest.
// 4% sounds survivable — but A* does not care what FRACTION of a corridor is
// closed, only whether the corridor is severed. One blocked cell across a
// one-cell-wide gap closes it completely, and the detour is then unbounded.
//
// So: WHERE are her blocked samples, do they cluster at the sub-3 hotspot that
// owns 60% of leg 1, and what drag does the FLEET actually sail there against her
// 1.000? Both columns come from the same grid and the same shoalField.
//
//   node _swamp_corr.js [trials] [seed0] [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 6;
const SEED0 = parseInt(process.argv[3]) || 4300;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHD11');
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

// the sub-3 hotspot: 60% of leg 1's gap, her median position (497,888)
const HX = 497, HY = 888, HR = 900;

(async () => {
    const dir = path.join(__dirname, 'traj');
    const laps = [];
    for (const f of fs.readdirSync(dir).filter(f => f.startsWith('traj_swamp_')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const F = j.format, I = n => F.indexOf(n);
        laps.push(j.samples.filter(r => r[I('leg')] >= 1).map(r => [r[I('x')], r[I('y')], r[I('spd')] * 60]));
    }
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'swamp' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    // ── 1. her blocked samples, and where they are ──────────────────────────
    const hum = await page.evaluate(({ laps, HX, HY, HR }) => {
        window.evalHarness.seed = 4300; window.resetGame(); window.startRace();
        for (let i = 0; i < 120; i++) window.update(1 / 60);
        const g = state.course.botGrid;
        const awash = (state.course.islands || []).filter(i => i.awash);
        const fixed = state.course._gridFixed || [];
        const gB = window.SailCheck.buildGrid(fixed.filter(s => !/\.hit$/.test(s.id || '')),
                                              state.course.boundary, null, null);
        const pts = [], inHot = { n: 0, blocked: 0, mul: [], spd: [] };
        for (const L of laps) for (const [x, y, v] of L) {
            const c = g.cell(x, y);
            const ok = g.at(c[0], c[1]);
            const okB = gB.at(c[0], c[1]);
            if (!ok) pts.push([Math.round(x), Math.round(y), okB ? 1 : 0]);
            if (Math.hypot(x - HX, y - HY) <= HR) {
                inHot.n++; if (!ok) inHot.blocked++;
                inHot.mul.push(window.VenueDoc.shoalField(awash, x, y)); inHot.spd.push(v);
            }
        }
        return { pts, inHot };
    }, { laps, HX, HY, HR });

    // ── 2. what the fleet sails in the same hotspot ─────────────────────────
    const fleet = { n: 0, mul: [], spd: [], wig: 0, t: 0, blocked: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(({ seed, HX, HY, HR }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const awash = (state.course.islands || []).filter(i => i.awash);
            const g = state.course.botGrid;
            const DT = 1 / 60; const out = { n: 0, mul: [], spd: [], wig: 0, t: 0, blocked: 0 };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg < 1) continue;
                    if (Math.hypot(b.x - HX, b.y - HY) > HR) continue;
                    out.n++; out.t += DT;
                    out.mul.push(b.shoalMul != null ? b.shoalMul : 1);
                    out.spd.push((b.speed || 0) * 60);
                    if (b.controller && b.controller.wiggleActive) out.wig += DT;
                    const c = g.cell(b.x, b.y); if (!g.at(c[0], c[1])) out.blocked++;
                }
            }
            return out;
        }, { seed: SEED0 + t, HX, HY, HR });
        fleet.n += r.n; fleet.t += r.t; fleet.wig += r.wig; fleet.blocked += r.blocked;
        fleet.mul = fleet.mul.concat(r.mul.filter((_, i) => i % 17 === 0));
        fleet.spd = fleet.spd.concat(r.spd.filter((_, i) => i % 17 === 0));
        console.log(`seed ${SEED0 + t}: ${r.n} fleet samples in the hotspot`);
    }
    await browser.close();

    console.log(`\n=== SWAMP SUB-3 HOTSPOT (${HX},${HY}) r=${HR} — 60% of leg 1's gap ===`);
    console.log(`HER LINE     ${hum.inHot.n} samples   drag mul med ${q(hum.inHot.mul, 0.5).toFixed(3)} mean ${mean(hum.inHot.mul).toFixed(3)}` +
        `   speed med ${q(hum.inHot.spd, 0.5).toFixed(0)} u/s   on unsailable cells ${(100 * hum.inHot.blocked / hum.inHot.n).toFixed(1)}%`);
    console.log(`THE FLEET    ${fleet.n} samples   drag mul med ${q(fleet.mul, 0.5).toFixed(3)} mean ${mean(fleet.mul).toFixed(3)}` +
        `   speed med ${q(fleet.spd, 0.5).toFixed(0)} u/s   on unsailable cells ${(100 * fleet.blocked / fleet.n).toFixed(1)}%`);
    console.log(`             wiggle ${(100 * fleet.wig / fleet.t).toFixed(0)}% of hotspot time   (${(fleet.t / TRIALS).toFixed(0)} boat-s per seed)`);

    console.log(`\nHER BLOCKED SAMPLES: ${hum.pts.length} total, ${hum.pts.filter(p => p[2]).length} closed BY THE FOREST`);
    // cluster them coarsely on a 300u lattice so the pinch points are readable
    const cl = {};
    for (const [x, y, byForest] of hum.pts) {
        const k = `${Math.round(x / 300) * 300},${Math.round(y / 300) * 300}`;
        cl[k] = cl[k] || { n: 0, f: 0 }; cl[k].n++; cl[k].f += byForest;
    }
    const rows = Object.entries(cl).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    console.log(`  the pinch points (300u lattice, top ${rows.length}):`);
    for (const [k, v] of rows) {
        const [x, y] = k.split(',').map(Number);
        console.log(`    (${String(x).padStart(6)},${String(y).padStart(6)})  ${String(v.n).padStart(4)} of her samples blocked` +
            `  ${v.f === v.n ? '— ALL by the forest' : `— ${v.f} by the forest`}` +
            `   dist to hotspot ${Math.round(Math.hypot(x - HX, y - HY))}u`);
    }
})();
