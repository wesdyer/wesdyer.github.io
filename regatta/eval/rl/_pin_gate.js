// WHICH GATE KEEPS THE STUCK-ESCAPE OFF A PINNED RIVER BOAT? (2026-08-14 night)
//
// The landed HEAD still loses ~7/144 river boats to 740-780 s continuous-contact
// pins. They are SOLO (nearest rival 3200u+), slow (7 u/s), reflex-owned 99-100%
// of the helm — yet escActive never fires in 700 s. The trigger needs, each frame:
// escVenueOK (venue `_avCurMax` < 2.0 kt), speed < 40 u/s, a NOSED test (grid
// blocked 90 or 180u dead ahead), no rival within 150u, then 25 s of leaky
// accumulation. This samples every term for the pinned population.
//
//   node _pin_gate.js <seed> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9400;
const ROOT = path.join(__dirname, process.argv[3] || 'treeCHAIN3');
const VENUE = process.argv[4] || 'river';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    const r = await page.evaluate(async (seed) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
        const dt = 1 / 60;
        const acc = {}; // per boat: pinned-frame gate tallies
        for (let it = 0; it < 60 * 940; it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            const t = state.race.timer;
            if (t > 900) break;
            if (it % 12 !== 0) continue; // 0.2 s cadence
            for (const b of bots) {
                if (b.raceState.finished) continue;
                const c = b.controller; if (!c) continue;
                // "pinned" sample = reflex active + slow, past the start
                if (!(c.iceEscapeTimer > 0 && b.speed * 60 < 40 && t > 60)) continue;
                const a = acc[b.name] = acc[b.name] || { n: 0, nosed: 0, riv: 0, sus: [], esc: 0, wig: 0, spin: 0 };
                a.n++;
                const g = state.course.botGrid;
                let nosed = false;
                if (g) for (const dN of [90, 180]) {
                    const cc = g.cell(b.x + Math.sin(b.heading) * dN, b.y - Math.cos(b.heading) * dN);
                    if (!g.at(cc[0], cc[1])) { nosed = true; break; }
                }
                if (nosed) a.nosed++;
                let rivNear = false;
                for (const o of state.boats) {
                    if (o === b || o.raceState.finished || o.isPlayer) continue;
                    if (Math.hypot(o.x - b.x, o.y - b.y) < 150) { rivNear = true; break; }
                }
                if (rivNear) a.riv++;
                a.sus.push(+(c.escSustain || 0).toFixed(1));
                if (c.escActive) a.esc++;
                if (c.wiggleActive) a.wig++;
                if (c.penaltySpin) a.spin++;
            }
        }
        const gridFixed = !!(state.course._gridFixed && state.course._gridFixed.length);
        const floes = !!(state.course._floeObjs && state.course._floeObjs.length);
        return { avCurMax: state.course._avCurMax, gridFixed, floes, acc,
                 fins: bots.filter(b => b.raceState.finished).length };
    }, SEED);
    console.log(`seed ${SEED} ${VENUE}: fins ${r.fins}  _avCurMax ${r.avCurMax}  gridFixed ${r.gridFixed}  floes ${r.floes}`);
    console.log(`escVenueOK = ${r.gridFixed && !r.floes && (r.avCurMax === undefined || r.avCurMax < 2.0)}`);
    for (const [n, a] of Object.entries(r.acc)) {
        if (a.n < 50) continue; // only boats with real pinned time
        const mx = Math.max(...a.sus), last = a.sus[a.sus.length - 1];
        console.log(`${n}: pinned samples ${a.n} (~${(a.n / 5).toFixed(0)} s)  nosed ${(100 * a.nosed / a.n).toFixed(0)}%  rivNear ${(100 * a.riv / a.n).toFixed(0)}%  escActive ${(100 * a.esc / a.n).toFixed(0)}%  wiggle ${(100 * a.wig / a.n).toFixed(0)}%  spin ${(100 * a.spin / a.n).toFixed(0)}%  escSustain max ${mx} last ${last}`);
    }
    await browser.close();
})();
