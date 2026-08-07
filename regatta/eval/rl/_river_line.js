// P1 verification — does the tight-water route approach the owner's chute line?
// Records the DMC leg polylines, then runs races and bins bot positions inside
// the rapids chute (y 1680..3640) into 200u y-slices; compares per-slice median
// x against the owner's lap (traj_river_1786084446572) and reports how much of
// the fleet's chute time sits in tight cells vs open cells.
//   node _river_line.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4TIGHT');
const TRAJ = path.join(__dirname, 'traj', 'traj_river_1786084446572.json');
(async () => {
    // owner's chute line, binned
    const T = JSON.parse(fs.readFileSync(TRAJ, 'utf8'));
    const fmt = T.format; const ix = fmt.indexOf('x'), iy = fmt.indexOf('y');
    const her = {};
    for (const s of T.samples) {
        const x = s[ix], y = s[iy];
        if (y < 1680 || y > 3640) continue;
        const k = Math.round(y / 200) * 200;
        (her[k] = her[k] || []).push(x);
    }
    const med = a => { const s2 = [...a].sort((p, q) => p - q); return s2.length ? s2[Math.floor(s2.length / 2)] : null; };

    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.waitForTimeout(2500);
    const dmc = await page.evaluate(() => {
        const d = state.course.dmc;
        return d ? d.legs.map((l, i) => ({
            leg: i, len: Math.round(l.length),
            pts: (l.pts || []).filter((q, k) => k % 2 === 0).map(q => [Math.round(q.x), Math.round(q.y)])
        })) : null;
    });
    const fleet = {}; let tightT = 0, openT = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const bins = {}; let tightT = 0, openT = 0;
            const g = state.course.botGrid;
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    if (b.y < 1680 || b.y > 3640) continue;
                    const k = Math.round(b.y / 200) * 200;
                    (bins[k] = bins[k] || []).push(Math.round(b.x));
                    if (g && g._tight) {
                        const [ci, cj] = g.cell(b.x, b.y);
                        const id = cj * g.n + ci;
                        if (!g.nav[id] && g._tight[id]) tightT += 0.1; else openT += 0.1;
                    }
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            return { bins, tightT, openT };
        }, seed);
        for (const [k, v] of Object.entries(r.bins)) (fleet[k] = fleet[k] || []).push(...v);
        tightT += r.tightT; openT += r.openT;
        console.log('seed', seed, 'done');
    }
    console.log('\nDMC legs:', dmc ? dmc.map(l => `leg${l.leg}:${l.len}u`).join(' ') : 'none');
    if (dmc) for (const l of dmc) if (l.pts.some(p => p[1] > 1680 && p[1] < 3640))
        console.log('  leg', l.leg, 'chute pts:', JSON.stringify(l.pts.filter(p => p[1] > 1400 && p[1] < 3900)));
    console.log('\nchute line, per 200u y-slice: herX | fleetX | |delta|');
    const keys = [...new Set([...Object.keys(her), ...Object.keys(fleet)])].map(Number).sort((a, b) => a - b);
    const deltas = [];
    for (const k of keys) {
        const h = her[k] ? med(her[k]) : null, f = fleet[k] ? med(fleet[k]) : null;
        if (h != null && f != null) deltas.push(Math.abs(h - f));
        console.log('  y', k, ':', h === null ? '—' : Math.round(h), '|', f === null ? '—' : Math.round(f),
            '|', h != null && f != null ? Math.round(Math.abs(h - f)) : '—');
    }
    console.log('median |x-delta| across slices:', med(deltas), 'u');
    console.log('fleet chute time in TIGHT cells:', Math.round(tightT), 's vs open', Math.round(openT),
        's (', (100 * tightT / Math.max(1, tightT + openT)).toFixed(1) + '% tight )');
    await browser.close();
})();
