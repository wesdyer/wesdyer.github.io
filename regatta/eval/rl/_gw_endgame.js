// GIVE-WAY PUSH PROBE (phase 1a): the rub probe MERGED with the __AVDBG
// cost ledger — for every boat-boat contact episode, what did the GIVE-WAY
// boat's argmin read in the last ~3s before contact? Names the endgame
// mechanism per episode:
//   readClear  — zero (straight) carried NO boatCollision on the last tick
//                before contact (the sampling floor: the term never saw it)
//   allCollide — zero AND best both carried boatCollision (the 500000/d²
//                lottery — memoryless argmin over colliding candidates)
//   vetoed     — zero collided, best clear (the term worked; execution or
//                physics lost anyway)
// plus the flap count over the window (changes of commanded off: sign flip
// or |Δoff| ≥ 0.35 rad between consecutive deflecting ticks).
//
//   node _gw_endgame.js <trials> <seed0> <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeDFC');
const VENUE = process.argv[5] || 'bay';
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
            window.__AVDBG = {};          // ledger on, all boats
            window.__AVLOG = [];
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
                        const gw = row === a.name ? b : row === b.name ? a : null;
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
                        // the give-way boat's ledger over the last ~3.3 real s
                        // (0.8 state units — state.time is a 0.24x clock)
                        let led = null;
                        if (gw) {
                            const log = window.__AVLOG, tNow = state.time;
                            const mine = [];
                            for (let k = log.length - 1; k >= 0 && log.length - k < 4000; k--) {
                                const r = log[k];
                                if (r.t < tNow - 0.8) break;
                                if (r.n === gw.name) mine.unshift(r);
                            }
                            if (mine.length) {
                                const last = mine[mine.length - 1];
                                // flap: sign flips or ≥0.35 rad jumps of best.off
                                // between consecutive DEFLECTING ticks
                                let flaps = 0, prevOff = null;
                                for (const r of mine) {
                                    if (!r.best || r.dev <= 0.02) continue;
                                    const o = r.best.off;
                                    if (prevOff !== null && ((o > 0) !== (prevOff > 0) || Math.abs(o - prevOff) >= 0.35)) flaps++;
                                    prevOff = o;
                                }
                                const clearTail = mine.filter(r => r.t >= tNow - 0.25 && r.zero && !r.zero.bc).length;
                                led = { n: mine.length,
                                        lastRng: last.rng, lastDev: +(last.dev * 57.3).toFixed(0),
                                        lastOff: last.best ? last.best.off : null,
                                        zeroBC: last.zero ? last.zero.bc : null,
                                        bestBC: last.best ? last.best.bc : null,
                                        clearTail, flaps,
                                        offs: mine.slice(-10).map(r => r.best ? r.best.off : 0) };
                            }
                        }
                        rubs.push({ t: +now.toFixed(1), row, rule, gwN: gw ? gw.name : null,
                                    a: side(a, b), b: side(b, a), led });
                    }
                }
                if (inner) inner(ty, d);
            };
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
                // keep the ledger bounded: drop rows older than 1.2 state units
                if ((it % 600) === 0 && window.__AVLOG.length > 200000) {
                    const cut = state.time - 1.2;
                    window.__AVLOG = window.__AVLOG.filter(r => r.t >= cut);
                }
            }
            window.onRaceEvent = inner;
            window.__AVDBG = undefined; window.__AVLOG = [];
            return rubs;
        }, seed);
        for (const r of rows) { r.seed = seed; all.push(r); }
        console.log(`seed ${seed}: ${rows.length} rub episodes`);
    }
    await browser.close();
    // census over episodes WITH a give-way side and a ledger
    const cls = {}; let nLed = 0, flapTot = 0, flapEp = 0;
    for (const r of all) {
        if (!r.led) continue;
        nLed++;
        const L = r.led;
        let mech;
        if (L.zeroBC === 0) mech = 'readClear';
        else if (L.bestBC === 1) mech = 'allCollide';
        else mech = 'vetoed';
        const devB = L.lastDev <= 6 ? 'dev0-6' : L.lastDev <= 25 ? 'devSmall' : 'devBig';
        const gwSide = r.gwN === r.a.n ? r.a : r.b;
        const bits = [mech, devB];
        if (gwSide.pen) bits.push('pen');
        if (gwSide.tk) bits.push('tacking');
        if (L.flaps >= 2) { bits.push('flappy'); flapEp++; }
        flapTot += L.flaps;
        const k = bits.join('/');
        cls[k] = (cls[k] || 0) + 1;
    }
    console.log(`\n${all.length} episodes, ${nLed} with give-way ledger — mechanism census:`);
    for (const [k, v] of Object.entries(cls).sort((x, y) => y[1] - x[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
    console.log(`flaps: ${flapTot} total, ${flapEp}/${nLed} episodes with ≥2`);
    for (const r of all.filter(x => x.led).slice(0, 15))
        console.log(`  s${r.seed} t=${r.t} gw=${r.gwN} rule=${r.rule} led=${JSON.stringify(r.led)}`);
})();
