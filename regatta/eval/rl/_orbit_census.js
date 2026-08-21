// WRONG-SIDE / ORBIT CENSUS (2026-08-21, from the Zone Entry lab finding):
// how often do venue boats ORBIT a mark — accumulate far more turn near it
// than a rounding needs before the leg advances? Lab showed a displaced
// boat arriving on the wrong side of a rounding orbits 600°+ without leg
// credit (solo control rounds clean at ~350°). This measures the venue
// incidence: per boat per 'round'-leg, total |heading change| and dwell
// time while within RADIUS of that leg's mark, plus whether the leg
// advanced. Orbit event = turn > 450° near one mark on one leg.
//   node _orbit_census.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay';
const TRIALS = parseInt(process.argv[3]) || 3;
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
            const RADIUS = 400;
            // which legs round a single mark? route entries with a mark/point
            const route = (state.course.route || []);
            const legMark = {};
            route.forEach((lg, ix) => {
                // leg index in raceState is 1-based over the route
                const m = lg && (lg.mark || (lg.marks && lg.marks.length === 1 && lg.marks[0]));
                if (lg && lg.type && String(lg.type).includes('round') && m) legMark[ix + 1] = { x: m.x, y: m.y };
                else if (m && lg.type !== 'gate' && lg.type !== 'line') legMark[ix + 1] = { x: m.x, y: m.y };
            });
            // fallback: use course marks nearest to each boat when rounding-armed
            const acc = new Map();  // id -> {leg, turn, dwell, prevH, near}
            const out = [];
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
                if (state.race.status !== 'racing' || (it % 3)) continue;   // 20Hz sampling
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished || bt.raceState.leg < 1) continue;
                    let s = acc.get(bt.id);
                    if (!s || s.leg !== bt.raceState.leg) {
                        if (s && s.dwell > 0.5) out.push({ n: bt.name, leg: s.leg, turn: Math.round(s.turn * 57.3), wind: Math.round(s.windMax * 57.3), dwell: +s.dwell.toFixed(1), advanced: 1 });
                        s = { leg: bt.raceState.leg, turn: 0, dwell: 0, prevH: bt.heading, wind: 0, windMax: 0, prevBrg: null, mk: null };
                        acc.set(bt.id, s);
                    }
                    // nearest course mark within RADIUS (venue-agnostic: any mark)
                    let near = null;
                    if (state.course.marks) {
                        let best = RADIUS * RADIUS;
                        for (const m of state.course.marks) {
                            const d2 = (m.x - bt.x) ** 2 + (m.y - bt.y) ** 2;
                            if (d2 < best) { best = d2; near = m; }
                        }
                    }
                    if (near) {
                        let dh = (bt.heading - s.prevH) % (Math.PI * 2);
                        if (dh > Math.PI) dh -= Math.PI * 2;
                        if (dh < -Math.PI) dh += Math.PI * 2;
                        s.turn += Math.abs(dh);
                        s.dwell += 3 / 60;
                        // NET WINDING of the boat's bearing about the mark —
                        // a tack-chain oscillates (net ~0 per pass); a true
                        // orbit accumulates. Reset when the tracked mark
                        // changes; keep the max |winding| seen this leg.
                        const brg = Math.atan2(bt.x - near.x, -(bt.y - near.y));
                        if (s.mk !== near) { s.mk = near; s.prevBrg = brg; s.wind = 0; }
                        let db = (brg - s.prevBrg) % (Math.PI * 2);
                        if (db > Math.PI) db -= Math.PI * 2;
                        if (db < -Math.PI) db += Math.PI * 2;
                        s.wind += db;
                        s.prevBrg = brg;
                        if (Math.abs(s.wind) > Math.abs(s.windMax)) s.windMax = s.wind;
                    }
                    s.prevH = bt.heading;
                }
            }
            // flush unadvanced legs (DNF near a mark = the worst case)
            for (const [id, s] of acc) {
                if (s.dwell > 0.5) {
                    const bt = state.boats.find(b => b.id === id);
                    out.push({ n: bt ? bt.name : '?', leg: s.leg, turn: Math.round(s.turn * 57.3), wind: Math.round(s.windMax * 57.3), dwell: +s.dwell.toFixed(1), advanced: bt && bt.raceState.finished ? 1 : 0 });
                }
            }
            return out;
        }, seed);
        for (const r of rows) { r.seed = seed; all.push(r); }
        const orb = rows.filter(r => r.turn > 450).length;
        console.log(`seed ${seed}: ${rows.length} mark-leg visits, ${orb} orbit events (>450°)`);
    }
    await browser.close();
    const orb = all.filter(r => r.turn > 450);
    const turns = all.map(r => r.turn).sort((a, b) => a - b);
    console.log(`\n${all.length} mark-leg visits over ${TRIALS} seeds — turn-near-mark p50/p75/p90/p99: `
        + `${turns[Math.floor(turns.length * .5)]}/${turns[Math.floor(turns.length * .75)]}/${turns[Math.floor(turns.length * .9)]}/${turns[Math.floor(turns.length * .99)]}°`);
    console.log(`HIGH-TURN VISITS (>450° heading change): ${orb.length} (${(100 * orb.length / all.length).toFixed(1)}% of visits), dwell p50 ${orb.length ? orb.map(r => r.dwell).sort((a, b) => a - b)[Math.floor(orb.length / 2)] : '-'}s`);
    // TRUE ORBITS: net bearing-winding about one mark past 540° — a tack
    // chain oscillates and nets ~0, so this cleanly separates the two.
    const tru = all.filter(r => Math.abs(r.wind) > 540);
    console.log(`TRUE ORBITS (|net winding| > 540°): ${tru.length} (${(100 * tru.length / all.length).toFixed(1)}% of visits), dwell p50 ${tru.length ? tru.map(r => r.dwell).sort((a, b) => a - b)[Math.floor(tru.length / 2)] : '-'}s`);
    const byLeg = {};
    for (const r of tru) byLeg[r.leg] = (byLeg[r.leg] || 0) + 1;
    console.log('true orbits by leg:', JSON.stringify(byLeg), ' unadvanced:', tru.filter(r => !r.advanced).length);
    for (const r of tru.slice(0, 12)) console.log(' ', JSON.stringify(r));
})();
