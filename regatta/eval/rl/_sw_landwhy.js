// SWAMP CLAW-BACK PROBE (arctic-avoidance push, phase 0.1): anatomy of
// LAND-contact episodes — was the boat mid-avoidance-dodge when she hit
// the grass, what did the argmin read (via __AVDBG), who was near, what
// role/risk/leg. Dedupe 2s per boat (grinds compound). Run on BOTH trees
// (dfd base = treeDFC, gwe cand = treeGWE) and diff the censuses: the gwe
// landing raised swamp land contacts +56% — this names where.
//
//   node _sw_landwhy.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeGWE');
const VENUE = process.argv[5] || 'swamp';
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
            window.__AVDBG = {};
            window.__AVLOG = [];
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const eps = [];
            const lastT = new Map();
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && !d.isFloe && state.race.status === 'racing' && d.boat && !d.boat.isPlayer) {
                    const bt = d.boat;
                    const now = state.race.timer;
                    if (!(lastT.has(bt.id) && now - lastT.get(bt.id) < 2.0)) {
                        lastT.set(bt.id, now);
                        const c = bt.controller || {};
                        // nearest rival + range
                        let rng = Infinity, nb = null;
                        for (const ob of state.boats) {
                            if (ob === bt || ob.isPlayer || ob.raceState.finished) continue;
                            const dd = Math.hypot(ob.x - bt.x, ob.y - bt.y);
                            if (dd < rng) { rng = dd; nb = ob; }
                        }
                        // her recent ledger (last ~2.5 real s = 0.6 state units)
                        const log = window.__AVLOG, tNow = state.time;
                        let led = null;
                        const mine = [];
                        for (let k = log.length - 1; k >= 0 && log.length - k < 4000; k--) {
                            const r = log[k];
                            if (r.t < tNow - 0.6) break;
                            if (r.n === bt.name) mine.unshift(r);
                        }
                        if (mine.length) {
                            const last = mine[mine.length - 1];
                            const devTicks = mine.filter(r => r.dev > 0.02).length;
                            led = { n: mine.length, devTicks,
                                    lastDev: +(last.dev * 57.3).toFixed(0),
                                    lastOff: last.best ? last.best.off : null,
                                    zeroBC: last.zero ? last.zero.bc : null,
                                    zeroSC: last.zero ? last.zero.sc : null,
                                    bestBC: last.best ? last.best.bc : null,
                                    bestSC: last.best ? last.best.sc : null };
                        }
                        eps.push({ t: +now.toFixed(1), n: bt.name,
                                   x: Math.round(bt.x), y: Math.round(bt.y),
                                   leg: bt.raceState.leg,
                                   role: c.avoidanceRole || '-', risk: c.riskState || '-',
                                   dev: +((c.lastAvoidDeviation || 0) * 57.3).toFixed(0),
                                   spd: +((bt.speed || 0) * 4).toFixed(1),
                                   pen: bt.raceState.penalty ? 1 : 0,
                                   wig: c.wiggleActive ? 1 : 0, esc: c.escActive ? 1 : 0,
                                   rng: rng === Infinity ? null : Math.round(rng),
                                   led });
                    }
                }
                if (inner) inner(ty, d);
            };
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
                if ((it % 600) === 0 && window.__AVLOG.length > 200000) {
                    const cut = state.time - 1.0;
                    window.__AVLOG = window.__AVLOG.filter(r => r.t >= cut);
                }
            }
            window.onRaceEvent = inner;
            window.__AVDBG = undefined; window.__AVLOG = [];
            return eps;
        }, seed);
        for (const r of rows) { r.seed = seed; all.push(r); }
        console.log(`seed ${seed}: ${rows.length} land episodes`);
    }
    await browser.close();
    // census: was avoidance driving her at the moment of grounding?
    const cls = {};
    for (const r of all) {
        const bits = [];
        bits.push(r.dev > 20 ? 'devBig' : r.dev > 2 ? 'devSmall' : 'dev0');
        if (r.led && r.led.zeroBC === 1) bits.push('rivalVeto');       // straight blocked by a RIVAL
        else if (r.led && r.led.zeroSC === 1) bits.push('staticVeto'); // straight blocked by land/mark
        if (r.role === 'GIVE_WAY') bits.push('gw');
        else if (r.role === 'STAND_ON') bits.push('row');
        if (r.pen) bits.push('pen');
        if (r.wig || r.esc) bits.push('wig/esc');
        if (r.rng != null && r.rng < 300) bits.push('rival<300');
        const k = bits.join('/');
        cls[k] = (cls[k] || 0) + 1;
    }
    console.log(`\n${all.length} land episodes — census (dev at contact / what vetoed straight / role / context):`);
    for (const [k, v] of Object.entries(cls).sort((x, y) => y[1] - x[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
    // leg histogram + speed
    const byLeg = {};
    for (const r of all) byLeg[r.leg] = (byLeg[r.leg] || 0) + 1;
    console.log('by leg:', JSON.stringify(byLeg));
    const spds = all.map(r => r.spd).sort((a, b) => a - b);
    console.log('speed at contact p25/med/p75:', spds[Math.floor(spds.length * .25)], spds[Math.floor(spds.length * .5)], spds[Math.floor(spds.length * .75)]);
    for (const r of all.slice(0, 12)) console.log(' ', JSON.stringify(r));
})();
