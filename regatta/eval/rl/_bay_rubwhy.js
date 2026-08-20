// DEFLECTION-PUSH PROBE: anatomy of bay boat-boat contact episodes — who
// held rights (rules answer at contact), what each controller's latched
// role/risk read, each side's avoidance deviation, whether the ROW side's
// _rowHold contained the other (candidate tree only; base has no _rowHold),
// race phase, and both speeds. Pair-deduped 0.5s.
//
//   node _bay_rubwhy.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeDFC');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })); });
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
            const rubs = [];
            const lastT = new Map();
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_boat' && state.race.status === 'racing') {
                    const a = d.boat, b = d.other;
                    const key = [a.id, b.id].sort().join('-');
                    const now = state.race.timer;
                    if (!(lastT.has(key) && now - lastT.get(key) < 0.5)) {
                        lastT.set(key, now);
                        let row = null, rule = null;
                        try { const r = window.Rules.getRightOfWay(a, b); row = r.boat ? r.boat.name : null; rule = r.rule; } catch (e) { }
                        const side = (bt, ot) => {
                            const c = bt.controller || {};
                            return { n: bt.name, role: c.avoidanceRole, risk: c.riskState,
                                     dev: +((c.lastAvoidDeviation || 0) * 57.3).toFixed(0),
                                     spd: +((bt.speed || 0) * 4).toFixed(1),
                                     held: c._rowHold ? (c._rowHold.has(ot) ? 1 : 0) : null,
                                     tk: bt.raceState.isTacking ? 1 : 0,
                                     pen: bt.raceState.penalty ? 1 : 0,
                                     leg: bt.raceState.leg };
                        };
                        rubs.push({ t: +now.toFixed(1), row, rule, a: side(a, b), b: side(b, a) });
                    }
                }
                if (inner) inner(ty, d);
            };
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
            }
            window.onRaceEvent = inner;
            return rubs;
        }, seed);
        for (const r of rows) { r.seed = seed; all.push(r); }
        console.log(`seed ${seed}: ${rows.length} rub episodes`);
    }
    await browser.close();
    // census
    const cls = {};
    for (const r of all) {
        const rowSide = r.row === r.a.n ? r.a : r.row === r.b.n ? r.b : null;
        const gwSide = r.row === r.a.n ? r.b : r.row === r.b.n ? r.a : null;
        let k;
        if (!r.row) k = 'no-determination';
        else {
            const bits = [];
            bits.push(rowSide.held === 1 ? 'ROWheld' : rowSide.held === 0 ? 'ROWfree' : 'ROW?');
            if (gwSide.tk || rowSide.tk) bits.push('tacking');
            if (gwSide.pen || rowSide.pen) bits.push('pen');
            if ((rowSide.leg || 0) === 0) bits.push('leg0');
            bits.push('gwDev' + (gwSide.dev >= 20 ? '20+' : gwSide.dev > 2 ? 'small' : '0'));
            k = bits.join('/');
        }
        cls[k] = (cls[k] || 0) + 1;
    }
    console.log(`\n${all.length} episodes total — census:`);
    for (const [k, v] of Object.entries(cls).sort((x, y) => y[1] - x[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
    for (const r of all.slice(0, 20))
        console.log(`  s${r.seed} t=${r.t} row=${r.row}(${r.rule}) A:${JSON.stringify(r.a)} B:${JSON.stringify(r.b)}`);
})();
