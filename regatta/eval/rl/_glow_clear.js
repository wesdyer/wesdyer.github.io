// HOW NARROW IS THE WATER THE ROUTER BUYS ON GLOWTIDE? (2026-08-12)
//
// `_glow_l1` (corrected — the first version sampled path VERTICES and reported
// 0/36 where the truth is 36/36, rule 18): **every boat plans through** a leg-1
// box that is 37% blocked on the router's own grid, spends 45.7 s/boat in it
// against a whole-leg gap of 42.1 s, and `_glow_entry` says they arrive there
// ON PLAN (0u off), at 103 u/s, undeflected, with no wiggle and no escape.
// He never enters it at all.
//
// So the route is admissible and ruinous, and the question is what the router is
// accepting. This walks each boat's own leg-1 plan and HIS recorded track through
// the same grid, and reports the CLEARANCE — the distance to the nearest blocked
// cell — at every step of each. A route threaded through gaps a hull barely fits
// is a bet that every small deflection loses.
//   node _glow_clear.js <venue> <trials> <seed0> <tree> [fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeM');
const FParg = (process.argv[6] || '').startsWith('fp=') ? process.argv[6].slice(3).split(',') : null;

const her = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const rows = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === 1);
    if (rows.length < 10) continue;
    her.push(rows.map(s => [gi(s, 'x'), gi(s, 'y')]));
}
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = { plan: [], bot: [], herC: [] };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, her }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const S = { plan: [], bot: [], herC: [] };
            // clearance = distance to the nearest blocked cell, by expanding rings
            const clr = (x, y) => {
                const g = state.course.botGrid; if (!g) return null;
                const R = g.res || 50;
                for (let ring = 0; ring <= 12; ring++) {
                    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                        const cc = g.cell(x + dx * R, y + dy * R);
                        if (!g.at(cc[0], cc[1])) return ring * R;
                    }
                }
                return 12 * R;
            };
            const seen = {};
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg !== 1) continue;
                    if (it % 30 === 0) S.bot.push(clr(b.x, b.y));
                    const c = b.controller;
                    if (c && c.gridPath && c.gridPath.length > 1 && !seen[b.name]) {
                        seen[b.name] = 1;
                        let ax = b.x, ay = b.y;
                        for (const q of c.gridPath) {
                            const L = Math.hypot(q.x - ax, q.y - ay), st = Math.max(1, Math.ceil(L / 60));
                            for (let i = 1; i <= st; i++) S.plan.push(clr(ax + (q.x - ax) * i / st, ay + (q.y - ay) * i / st));
                            ax = q.x; ay = q.y;
                        }
                    }
                }
                if (state.race.timer > 895) break;
            }
            for (const lap of her) for (let i = 0; i < lap.length; i += 30) S.herC.push(clr(lap[i][0], lap[i][1]));
            return S;
        }, { seed: SEED0 + t, her });
        A.plan.push(...r.plan); A.bot.push(...r.bot);
        if (!A.herC.length) A.herC = r.herC;
        console.log(`seed ${SEED0 + t}: ${r.plan.length} plan samples, ${r.bot.length} boat samples`);
    }
    await br.close();
    const q = (a, pp) => { const s = a.filter(v => v != null).slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const line = (n, a) => console.log(`   ${n.padEnd(22)} p05 ${q(a, .05).toFixed(0).padStart(4)}u  p25 ${q(a, .25).toFixed(0).padStart(4)}u  med ${q(a, .5).toFixed(0).padStart(4)}u  p75 ${q(a, .75).toFixed(0).padStart(4)}u   under 100u: ${(100 * a.filter(v => v != null && v < 100).length / a.length).toFixed(0)}%`);
    console.log(`\n=== ${VENUE.toUpperCase()} LEG 1: CLEARANCE OF THE WATER EACH SIDE USES ===`);
    line('the ROUTER\'S PLAN', A.plan);
    line('where boats ACTUALLY go', A.bot);
    line('HIS recorded track', A.herC);
})();
