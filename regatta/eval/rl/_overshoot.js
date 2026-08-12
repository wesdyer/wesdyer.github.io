// HOW FAR PAST THE MARK DOES THE FLEET GO? (2026-08-11, redrock mark-6)
//
// `_gap_grid` run PER LEG splits redrock's remaining 116.5 s/lap into two
// unrelated failures:
//   LEG 3 = the west-wall grind at (-1125,-1375), 12.3 s/lap, 85% of its time
//           under 40 u/s with the contact reflex owning 71% — execution.
//   LEG 2 = something nobody has attributed: 64% of that leg's gap is water he
//           NEVER ENTERS, and three cells SOUTH of the sw mark (-875,-2125),
//           (-875,-1875), (-1125,-2125) carry 11.4 s/lap = 45% of the leg.
// The mark is at y = -1628. Those cells span 120-500u south of it, and his time
// in all three is 0.0 s/lap.
//
// ⚠️ Going south is not obviously wrong — mark-6 is rounded to PORT arriving from
// the north-east, so the boat must pass on the mark's far side before turning
// back. The question is HOW FAR. And `_round_exit` already showed the fleet's
// CLOSEST APPROACH is only 34u wider than his (78u vs 44u median), so whatever
// this is, it is not the rounding radius at the mark — it is the approach.
//
// Per boat on the approach leg: the southernmost point reached, where the track
// crosses the mark's own latitude, and how long is spent below the mark.
//
// usage: node _overshoot.js <venue> <trials> <seed0> <tree> [leg my fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeHD12');
const LEG = parseInt(process.argv[6] !== undefined ? process.argv[6] : 2);
const MY = parseFloat(process.argv[7] !== undefined ? process.argv[7] : -1628.4782082367296);
const MX = -883.298875214051;
const FParg = (process.argv[8] || '').startsWith('fp=') ? process.argv[8].slice(3).split(',') : null;

const hers = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const rows = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (!rows.length) continue;
    const dts = [];
    for (let i = 1; i < rows.length; i++) { const d = Math.abs(gi(rows[i], 't') - gi(rows[i - 1], 't')); if (d > 0 && d < 1) dts.push(d); }
    dts.sort((a, b) => a - b); const DT = dts.length ? dts[Math.floor(dts.length / 2)] : 0.1;
    let minY = Infinity, below = 0, cross = null, prev = null;
    for (const s of rows) {
        const x = gi(s, 'x'), y = gi(s, 'y');
        if (y < minY) minY = y;
        if (y < MY) below += DT;
        if (prev && prev.y >= MY && y < MY && cross === null) cross = x;
        prev = { x, y };
    }
    hers.push({ minY, below, cross });
}

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, LEG, MY }) => {
            const per = {};
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    if (bo.raceState.leg !== LEG) continue;
                    const P = per[bo.name] || (per[bo.name] = { minY: 1e9, below: 0, cross: null, prevY: null, armedBelow: 0 });
                    if (bo.y < P.minY) P.minY = bo.y;
                    if (bo.y < MY) { P.below += DT; if (bo.raceState.roundArmed) P.armedBelow += DT; }
                    if (P.prevY !== null && P.prevY >= MY && bo.y < MY && P.cross === null) P.cross = bo.x;
                    P.prevY = bo.y;
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return Object.values(per);
        }, { seed: SEED0 + t, LEG, MY });
        all.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} boats on leg ${LEG}`);
    }
    await b.close();

    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    console.log(`\n=== ${VENUE.toUpperCase()} LEG ${LEG}: HOW FAR PAST THE MARK (y=${MY.toFixed(0)}) ===`);
    const hd = hers.map(o => MY - o.minY), bd = all.map(o => MY - o.minY);
    console.log(`overshoot south of the mark   him  med ${q(hd, .5).toFixed(0)}u  max ${Math.max(...hd).toFixed(0)}u  (n=${hd.length})`);
    console.log(`                              fleet med ${q(bd, .5).toFixed(0)}u  p75 ${q(bd, .75).toFixed(0)}u  p90 ${q(bd, .9).toFixed(0)}u  max ${Math.max(...bd).toFixed(0)}u  (n=${bd.length})`);
    console.log(`time spent BELOW the mark's latitude   him  med ${q(hers.map(o => o.below), .5).toFixed(1)}s   fleet med ${q(all.map(o => o.below), .5).toFixed(1)}s  mean ${mean(all.map(o => o.below)).toFixed(1)}s`);
    console.log(`   of the fleet's time below, ARMED for the rounding: ${(100 * mean(all.map(o => o.armedBelow)) / (mean(all.map(o => o.below)) || 1)).toFixed(0)}%`);
    const hc = hers.map(o => o.cross).filter(v => v !== null), bc = all.map(o => o.cross).filter(v => v !== null);
    console.log(`x where the track first crosses the mark's latitude   him med ${q(hc, .5).toFixed(0)}   fleet med ${q(bc, .5).toFixed(0)}   (mark x = ${MX.toFixed(0)})`);
    for (const lim of [100, 200, 300, 400]) {
        console.log(`   fleet boats going more than ${lim}u past: ${(100 * bd.filter(v => v > lim).length / bd.length).toFixed(0)}%   him ${(100 * hd.filter(v => v > lim).length / (hd.length || 1)).toFixed(0)}%`);
    }
})();
