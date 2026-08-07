// P1 anatomy — the TIGHT tree trades: survivors -14s/-12s paired but fins
// -12/-14 with land +26/+33% and boat rubs x2.9/x4.0. WHERE is the new dirt?
// Hooks collision events with positions; bins land and boat contacts into
// 400u cells; also samples chute occupancy (boats in the y1680-3640 slot at
// once) and how many contacts involve a boat in a TIGHT cell.
//   node _river_contacts.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4TIGHT');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const landH = {}, boatH = {}; const occ = []; let landTight = 0, landOther = 0, nLand = 0, nBoat = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const landH = {}, boatH = {}; const occ = [];
            let landTight = 0, landOther = 0, nLand = 0, nBoat = 0;
            const g = state.course.botGrid;
            const lastT = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (d && d.boat && !d.boat.isPlayer && !d.boat.raceState.finished
                        && (ty === 'collision_island' || ty === 'collision_boat')) {
                        const k0 = d.boat.name + ':' + ty, t = state.race.timer;
                        if (lastT[k0] == null || t - lastT[k0] >= 0.5) {
                            lastT[k0] = t;
                            const b = d.boat;
                            const k = (Math.round(b.x / 400) * 400) + ',' + (Math.round(b.y / 400) * 400);
                            if (ty === 'collision_island') {
                                landH[k] = (landH[k] || 0) + 1; nLand++;
                                if (g && g._tight) {
                                    const [ci, cj] = g.cell(b.x, b.y);
                                    const id = cj * g.n + ci;
                                    if (!g.nav[id] && g._tight[id]) landTight++; else landOther++;
                                }
                            } else { boatH[k] = (boatH[k] || 0) + 1; nBoat++; }
                        }
                    }
                } catch (e) { }
                if (inner) inner(ty, d);
            };
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 120;
                if (fr === 0) occ.push(bots.filter(b => !b.raceState.finished
                    && b.y > 1680 && b.y < 3640).length);
                if (bots.every(b => b.raceState.finished)) break;
            }
            return { landH, boatH, occ, landTight, landOther, nLand, nBoat };
        }, seed);
        for (const [k, v] of Object.entries(r.landH)) landH[k] = (landH[k] || 0) + v;
        for (const [k, v] of Object.entries(r.boatH)) boatH[k] = (boatH[k] || 0) + v;
        occ.push(...r.occ); landTight += r.landTight; landOther += r.landOther;
        nLand += r.nLand; nBoat += r.nBoat;
        console.log('seed', seed, 'land', r.nLand, 'boat', r.nBoat);
    }
    const top = (h) => Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([k, v]) => `${k}:${v}`).join('  ');
    console.log('\nLAND episodes', nLand, ' at-tight-cell', landTight, 'vs-other', landOther);
    console.log('land heat:', top(landH));
    console.log('\nBOAT episodes', nBoat);
    console.log('boat heat:', top(boatH));
    const s = [...occ].sort((a, b) => a - b);
    console.log('\nchute occupancy (boats in slot, 2s samples): med', s[Math.floor(s.length / 2)],
        'p90', s[Math.floor(s.length * 0.9)], 'max', s[s.length - 1]);
    await browser.close();
})();
