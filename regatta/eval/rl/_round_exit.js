// WHERE DOES THE ROUNDING SPIT THEM OUT? (2026-08-11, redrock mark-6)
//
// `_channel.js`: on leg 3, in the band y in [-1500,-1300), the fleet spends
// 18.1 s/lap in the 100-140u WEST slot at 22 u/s and 5.6 s/lap in the wide EAST
// channel at 73 u/s. He spends 0.7 s/lap west and 3.1 east. Their own east-channel
// speed proves the east channel works for them, so this is a CHOICE, not a
// capability — 76% of their leg-3 time in that band is spent in the slow way past
// the rock.
//
// Mark-6 (`sw`, -883,-1628) is a hairpin: leg 2 arrives from the north-east and
// leg 3 leaves back to the north-east, so the rounding sweeps the boat WEST of the
// mark before she can point at the next one. `_slot_line` says that at the mark's
// own latitude the fleet is already ~123u west of the mark against his ~30u, and
// that offset is 200-300u by y=-1400. Hypothesis: a WIDE rounding hands the boat
// to the west slot, and every later layer is then choosing between bad options.
//
// So measure the rounding on its own terms, per boat, and test the link directly:
//   * closest approach to the mark during the leg2->leg3 transition
//   * x where she crosses y=-1500 outbound (which channel the rounding chose)
//   * time she then spends in the west slot
//   * and the CORRELATION between the two — if wide roundings are not the ones
//     that end up west, the hypothesis is dead and the slot is chosen later.
//
// usage: node _round_exit.js <venue> <trials> <seed0> <tree> [fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeTRK2');
const FParg = (process.argv[6] || '').startsWith('fp=') ? process.argv[6].slice(3).split(',') : null;
const MX = -883.298875214051, MY = -1628.4782082367296;

// his side
const hers = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const rows = j.samples.filter(s => gi(s, 'phase') === 1);
    const dts = [];
    for (let i = 1; i < rows.length; i++) { const d = Math.abs(gi(rows[i], 't') - gi(rows[i - 1], 't')); if (d > 0 && d < 1) dts.push(d); }
    dts.sort((a, b) => a - b); const DT = dts.length ? dts[Math.floor(dts.length / 2)] : 0.1;
    let closest = Infinity, cross = null, west = 0, prev = null;
    for (const s of rows) {
        const lg = gi(s, 'leg'), x = gi(s, 'x'), y = gi(s, 'y');
        if (lg === 2 || lg === 3) { const d = Math.hypot(x - MX, y - MY); if (d < closest) closest = d; }
        if (lg === 3 && prev && prev.y < -1500 && y >= -1500 && cross === null) cross = x;
        if (lg === 3 && y >= -1500 && y < -1300 && x < -950) west += DT;
        prev = { x, y, lg };
    }
    if (closest < Infinity) hers.push({ closest, cross, west });
}

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, MX, MY }) => {
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
                    const lg = bo.raceState.leg;
                    if (lg !== 2 && lg !== 3) continue;
                    const P = per[bo.name] || (per[bo.name] = { closest: 1e9, cross: null, west: 0, prevY: null, prevX: null });
                    const d = Math.hypot(bo.x - MX, bo.y - MY); if (d < P.closest) P.closest = d;
                    if (lg === 3) {
                        if (P.prevY !== null && P.prevY < -1500 && bo.y >= -1500 && P.cross === null) P.cross = bo.x;
                        if (bo.y >= -1500 && bo.y < -1300 && bo.x < -950) P.west += DT;
                    }
                    P.prevY = bo.y; P.prevX = bo.x;
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return Object.values(per).map(o => ({ closest: o.closest, cross: o.cross, west: o.west }));
        }, { seed: SEED0 + t, MX, MY });
        all.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} boats rounded`);
    }
    await b.close();

    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    console.log(`\n=== ${VENUE.toUpperCase()} MARK-6 ROUNDING: HOW WIDE, AND WHERE IT LEADS ===`);
    const hc = hers.map(o => o.closest), bc = all.map(o => o.closest);
    console.log(`closest approach to the mark   him  med ${q(hc, .5).toFixed(0)}u (n=${hc.length})   fleet med ${q(bc, .5).toFixed(0)}u  p75 ${q(bc, .75).toFixed(0)}u  p90 ${q(bc, .9).toFixed(0)}u (n=${bc.length})`);
    const hx = hers.map(o => o.cross).filter(v => v !== null), bx = all.map(o => o.cross).filter(v => v !== null);
    console.log(`x where leg 3 crosses y=-1500   him  med ${q(hx, .5).toFixed(0)}   fleet med ${q(bx, .5).toFixed(0)}   west (<-950): him ${hx.filter(v => v < -950).length}/${hx.length}  fleet ${bx.filter(v => v < -950).length}/${bx.length}`);
    console.log(`\n  DOES A WIDE ROUNDING PUT HER WEST? (fleet, by closest-approach quartile)`);
    const srt = all.filter(o => o.cross !== null).sort((a, c) => a.closest - c.closest);
    const Q = Math.ceil(srt.length / 4);
    for (let i = 0; i < 4; i++) {
        const g = srt.slice(i * Q, (i + 1) * Q); if (!g.length) continue;
        console.log(`    Q${i + 1} closest ${q(g.map(o => o.closest), .5).toFixed(0)}u  ->  crossed west ${(100 * g.filter(o => o.cross < -950).length / g.length).toFixed(0)}%   west-slot time ${mean(g.map(o => o.west)).toFixed(1)}s`);
    }
    const west = all.filter(o => o.cross !== null && o.cross < -950), east = all.filter(o => o.cross !== null && o.cross >= -950);
    console.log(`\n  AND WHAT DOES THE CHOICE COST? west-crossers ${west.length}: slot time mean ${mean(west.map(o => o.west)).toFixed(1)}s` +
        `   |   east-crossers ${east.length}: slot time mean ${mean(east.map(o => o.west)).toFixed(1)}s`);
})();
