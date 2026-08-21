// SWAMP STALL-FIELD PROBE (2026-08-21): swamp "wedge" entries collapse in
// CLEAR water on the commanded line (79% bothClear, drift 3°) — so what
// does the WORLD look like where they stall? At each sub-1kt collapse:
// wind speed at the point, the venue's mean wind at that moment (fleet
// median of windAt over all racing boats), and the vegetation/shoal drag
// field if present. If stalls sit in dead-air or drag pockets the fleet
// median doesn't share, the leg-1 stall zone is a LANE choice — routing,
// not avoidance.
//   node _stall_field.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'swamp';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGWE');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const rows = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const slow = new Map();
            const out = [];
            const dragAt = (x, y) => {
                try {
                    if (typeof shoalFieldAt === 'function') return +(shoalFieldAt(x, y) || 0).toFixed(2);
                } catch (e) {}
                return null;
            };
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
                if (state.race.status !== 'racing' || (it % 3)) continue;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished || bt.raceState.leg < 1) continue;
                    let s = slow.get(bt.id) || { t: 0, last: -99 };
                    const slowNow = (bt.speed * 4) < 1.0;
                    s.t = slowNow ? s.t + 3 / 60 : 0;
                    if (s.t >= 3 && state.race.timer - s.last > 10) {
                        s.last = state.race.timer;
                        const w = getWindAt(bt.x, bt.y);
                        // fleet reference: median wind speed across racing rivals
                        const ws = [];
                        for (const ob of state.boats) {
                            if (ob.isPlayer || ob.raceState.finished || ob.raceState.leg < 1) continue;
                            ws.push(getWindAt(ob.x, ob.y).speed);
                        }
                        ws.sort((a, b) => a - b);
                        out.push({ t: +state.race.timer.toFixed(1), n: bt.name, leg: bt.raceState.leg,
                                   x: Math.round(bt.x), y: Math.round(bt.y),
                                   wind: +w.speed.toFixed(2),
                                   fleetWindMed: +ws[Math.floor(ws.length / 2)].toFixed(2),
                                   drag: dragAt(bt.x, bt.y) });
                    }
                    slow.set(bt.id, s);
                }
            }
            return out;
        }, seed);
        for (const r of rows) { r.seed = seed; all.push(r); }
        console.log(`seed ${seed}: ${rows.length} stalls`);
    }
    await browser.close();
    const winds = all.map(r => r.wind).sort((a, b) => a - b);
    const meds = all.map(r => r.fleetWindMed).sort((a, b) => a - b);
    const rel = all.map(r => r.wind - r.fleetWindMed).sort((a, b) => a - b);
    const q = (a, p) => a[Math.floor(a.length * p)];
    console.log(`\n${all.length} stall entries:`);
    console.log(`wind AT stall p25/med/p75: ${q(winds,.25)}/${q(winds,.5)}/${q(winds,.75)} kt`);
    console.log(`fleet median wind (same moments): ${q(meds,.25)}/${q(meds,.5)}/${q(meds,.75)} kt`);
    console.log(`stall wind MINUS fleet median p25/med/p75: ${q(rel,.25).toFixed(2)}/${q(rel,.5).toFixed(2)}/${q(rel,.75).toFixed(2)} kt`);
    const drags = all.map(r => r.drag).filter(x => x != null);
    if (drags.length) {
        drags.sort((a, b) => a - b);
        console.log(`drag field at stall p50/p75/p90: ${q(drags,.5)}/${q(drags,.75)}/${q(drags,.9)} (n=${drags.length})`);
        console.log(`stalls in drag>0 cells: ${drags.filter(d => d > 0).length}/${drags.length}`);
    } else console.log('no drag field readable');
    fs.writeFileSync(path.join(__dirname, `_stall_${VENUE}.json`), JSON.stringify(all));
    console.log('rows → _stall_' + VENUE + '.json');
})();
