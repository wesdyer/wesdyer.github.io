// WHAT COSTS THE FLEET THE CLEARANCE HE KEEPS? (2026-08-12, glowtide)
//
// `_glow_clear`: the router's leg-1 plan runs in WIDER water than his line
// (clearance med 350u against his 300u, 11% under 100u against his 14%) and the
// boats nevertheless sail at med 200u with 28% under 100u and 5% inside a blocked
// cell. `_glow_box`: inside the rock box the contact escape owns 37% of ticks at
// 11 u/s against 2.7% outside. So the route is sound and the HOLDING is not.
//
// ⚠️ Distance-off-plan cannot answer this — `gridPath` is rebuilt from the boat's
// own position, so it reads ~0 everywhere (the correction in [[regatta-glowtide]]).
// The honest instrument is the GRID: track each boat's clearance over time and ask
// who owned the helm while it was being SPENT.
//
// For every 10 Hz tick on leg 1 it records clearance now, the change since the last
// tick, and the helm's last writer — so "clearance lost per second, by owner" is a
// number, and a layer that spends clearance is separable from one that merely
// happens to be running when it is already low.
//   node _glow_hold.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGTW');
const BOX = { x0: -750, x1: 0, y0: -1750, y1: -500 };
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const R = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate(({ seed, BOX }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const clr = (x, y) => {
                const g = state.course.botGrid; if (!g) return null;
                const R2 = g.res || 50;
                for (let ring = 0; ring <= 10; ring++)
                    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                        const cc = g.cell(x + dx * R2, y + dy * R2);
                        if (!g.at(cc[0], cc[1])) return ring * R2;
                    }
                return 10 * R2;
            };
            const out = []; const prev = {};
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (it % 6) continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg !== 1) continue;
                    const c = clr(b.x, b.y);
                    const P = prev[b.name];
                    const own = (b.controller && b.controller.__ovOwner) || 'nav';
                    if (P != null && c != null) {
                        out.push([own, c, c - P,
                            (b.x >= BOX.x0 && b.x <= BOX.x1 && b.y >= BOX.y0 && b.y <= BOX.y1) ? 1 : 0,
                            +(b.speed * 60).toFixed(0)]);
                    }
                    prev[b.name] = c;
                }
                if (state.race.timer > 895) break;
            }
            return out;
        }, { seed: SEED0 + t, BOX });
        R.push(...rows);
        console.log(`seed ${SEED0 + t}: ${rows.length} samples`);
    }
    await br.close();
    const q = (a, pp) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const show = (name, rows) => {
        console.log(`\n${name} — ${rows.length} samples (0.1 s each)`);
        console.log(`   owner        share     med clearance   CLEARANCE SPENT (u/s, only losses)   time under 100u`);
        const own = {};
        for (const r of rows) (own[r[0]] = own[r[0]] || []).push(r);
        for (const o of Object.keys(own).sort((a, b) => own[b].length - own[a].length)) {
            const g = own[o];
            const lost = g.filter(x => x[2] < 0).reduce((a, x) => a - x[2], 0) / (g.length * 0.1);
            console.log(`   ${o.padEnd(10)} ${(100 * g.length / rows.length).toFixed(1).padStart(5)}%  ${String(q(g.map(x => x[1]), .5)).padStart(12)}u  ${lost.toFixed(1).padStart(28)}  ${(100 * g.filter(x => x[1] < 100).length / g.length).toFixed(0).padStart(14)}%`);
        }
    };
    console.log(`\n=== ${VENUE.toUpperCase()} LEG 1: WHO SPENDS THE CLEARANCE ===`);
    show('INSIDE the rock box', R.filter(r => r[3] === 1));
    show('OUTSIDE it', R.filter(r => r[3] === 0));
})();
