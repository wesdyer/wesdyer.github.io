// PER-LEG ODOMETER, human vs fleet — is a leg's gap DISTANCE or SPEED? (2026-08-09)
// The subsection tables keep showing the fleet FASTER through the water yet slower to
// the mark, which can only be extra distance; this measures the distance directly so
// the claim never rests on inference. Bay leg 1 was the first: 4390u vs her 3716u on a
// 2943u leg.
//   node _leg_odo.js <venue> <leg> <trials> <seed0> <tree> [fp=<hash>]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const VENUE = process.argv[2], LEG = parseInt(process.argv[3]);
const TRIALS = parseInt(process.argv[4]) || 6, SEED0 = parseInt(process.argv[5]) || 9100;
const ROOT = path.join(__dirname, process.argv[6] || 'treeNOW');
const FP = (process.argv[7] || '').startsWith('fp=') ? process.argv[7].slice(3) : null;
const H = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_'))) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FP && j.venueFingerprint !== FP) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    let odo = 0, tk = 0, last = null;
    for (let i = 1; i < S.length; i++) {
        const d = Math.hypot(gi(S[i], 'x') - gi(S[i - 1], 'x'), gi(S[i], 'y') - gi(S[i - 1], 'y'));
        if (d < 200) odo += d;
        const t = gi(S[i], 'playerTack'); if (last != null && t !== last && t !== 0) tk++; last = t;
    }
    if (odo > 0) H.push([Math.round(odo), tk]);
}
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = []; let legLen = 0;
    for (let i = 0; i < TRIALS; i++) {
        const r = await p.evaluate(async (arg) => {
            const { seed, LEG } = arg;
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900; const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const odo = {}, prev = {}, dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'racing') for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    if (b.raceState.leg !== LEG) { prev[b.name] = null; continue; }
                    const q = prev[b.name];
                    if (q) { const d = Math.hypot(b.x - q[0], b.y - q[1]); if (d < 200) odo[b.name] = (odo[b.name] || 0) + d; }
                    prev[b.name] = [b.x, b.y];
                }
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return { odo: Object.values(odo).map(Math.round), len: Math.round(state.course.dmc.legs[LEG].length) };
        }, { seed: SEED0 + i, LEG });
        all.push(...r.odo); legLen = r.len;
    }
    await b.close();
    const q = (a, pp) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const hm = q(H.map(h => h[0]), 0.5), bm = q(all, 0.5);
    console.log(`${VENUE.toUpperCase()} LEG ${LEG}  straight-line ${legLen}u`);
    console.log(`  HER  odometer ${H.map(h => h[0]).join(', ')}  tacks ${H.map(h => h[1]).join(', ')}   med ${hm} = ${(hm / legLen).toFixed(2)}x`);
    console.log(`  BOT  n=${all.length}  med ${bm} (p25 ${q(all, 0.25)} p75 ${q(all, 0.75)}) = ${(bm / legLen).toFixed(2)}x`);
    console.log(`  EXCESS vs her: ${bm - hm}u  (${((bm / hm - 1) * 100).toFixed(0)}% further)`);
})();
