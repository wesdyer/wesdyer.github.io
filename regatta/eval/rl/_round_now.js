// HIS ROUNDING AGAINST THEIRS, ON THE CURRENT HEAD (2026-08-11, arctic push)
//
// `_leg1_where` put 87.5 s of arctic's 142.7 s leg-1 gap — 61% of the leg, 64% of
// the whole venue — in the last fifth of leg 1, the granite-isle approach and
// rounding. `_nav_src` says the ARMED ORBIT aims 89.4% of that water and that
// 32.3% of its targets lie inside the no-go. So the rounding itself is the venue.
//
// The recorder stores `sweep` and `armed` columns, so his rounding can be read the
// same way the bots' is rather than inferred:
//     armed seconds, sweep accumulated, radius from the mark, distance sailed
// A rounding is a fixed amount of TURNING; everything above the geometric minimum
// is either a bigger circle or time spent not turning.
//
// usage: node _round_now.js <venue> <trials> <seed0> <tree> [fp=a,b]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeARCB');
const FParg = (process.argv[6] || '').startsWith('fp=') ? process.argv[6].slice(3).split(',') : null;

const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

const her = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    if (F.indexOf('armed') < 0 || F.indexOf('sweep') < 0) continue;
    const rows = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'armed'));
    if (rows.length < 5) continue;
    const dts = [];
    for (let i = 1; i < rows.length; i++) { const d = Math.abs(gi(rows[i], 't') - gi(rows[i - 1], 't')); if (d > 0 && d < 1) dts.push(d); }
    dts.sort((a, b) => a - b);
    const DT = dts.length ? dts[Math.floor(dts.length / 2)] : 0.1;
    let odo = 0, irons = 0, slow = 0;
    for (let i = 1; i < rows.length; i++) odo += Math.hypot(gi(rows[i], 'x') - gi(rows[i - 1], 'x'), gi(rows[i], 'y') - gi(rows[i - 1], 'y'));
    for (const s of rows) {
        const d = gi(s, 'hdg') - gi(s, 'windDir');
        if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 0.62) irons += DT;
        if (gi(s, 'spd') * 60 < 40) slow += DT;
    }
    her.push({ t: rows.length * DT, odo, sweep: Math.abs(gi(rows[rows.length - 1], 'sweep')), irons, slow,
               pts: rows.map(s => ({ x: gi(s, 'x'), y: gi(s, 'y') })) });
}
if (!her.length) { console.log('no fingerprint-matching laps with armed/sweep columns'); process.exit(1); }

(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    let mark = null;
    const bots = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const per = {}; const DT = 1 / 60;
            const rm = state.course.roundMark;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || !b.raceState.roundArmed || b.raceState.leg !== 1) continue;
                    const P = per[b.name] || (per[b.name] = { t: 0, odo: 0, irons: 0, slow: 0, px: b.x, py: b.y, r: [], sweep: 0 });
                    P.t += DT; P.odo += Math.hypot(b.x - P.px, b.y - P.py); P.px = b.x; P.py = b.y;
                    P.r.push(Math.hypot(b.x - rm.x, b.y - rm.y));
                    P.sweep = Math.abs(b.raceState.roundSweep || 0);
                    const d = b.heading - getWindAt(b.x, b.y).direction;
                    if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 0.62) P.irons += DT;
                    if (b.speed * 60 < 40) P.slow += DT;
                }
                if (state.race.timer > 895) break;
            }
            const fin = {}; for (const b of state.boats) if (!b.isPlayer) fin[b.name] = b.raceState.finishTime || null;
            const out = [];
            for (const k in per) if (fin[k] && per[k].t > 1) { const P = per[k]; P.r.sort((a, b) => a - b); out.push({ t: P.t, odo: P.odo, irons: P.irons, slow: P.slow, sweep: P.sweep, rMed: P.r[Math.floor(P.r.length / 2)], rMax: P.r[P.r.length - 1] }); }
            return { out, zone: rm.zone, mark: { x: rm.x, y: rm.y }, req: rm.reqSweep };
        }, SEED0 + t);
        bots.push(...r.out); mark = r;
        console.log(`seed ${SEED0 + t}: ${r.out.length} armed roundings`);
    }
    await br.close();

    // his radius profile, computed offline against the same mark
    for (const h of her) {
        const rr = h.pts.map(pt => Math.hypot(pt.x - mark.mark.x, pt.y - mark.mark.y)).sort((a, b) => a - b);
        h.rMed = rr[Math.floor(rr.length / 2)]; h.rMax = rr[rr.length - 1];
    }
    const row = (n, f, d) => {
        const h = mean(her.map(f)), b = mean(bots.map(f));
        console.log(`   ${n.padEnd(24)} his ${h.toFixed(d || 1).padStart(9)}   bot ${b.toFixed(d || 1).padStart(9)}   ratio ${(b / h).toFixed(2)}x`);
    };
    console.log(`\n=== ${VENUE.toUpperCase()}: THE GRANITE-ISLE ROUNDING (zone ${mark.zone.toFixed(0)}u, required sweep ${(mark.req || Math.PI).toFixed(2)} rad) ===`);
    console.log(`   ${bots.length} bot roundings, ${her.length} of his`);
    row('ARMED seconds', x => x.t);
    row('distance sailed (u)', x => x.odo, 0);
    row('sweep banked (rad)', x => x.sweep, 2);
    row('radius median (u)', x => x.rMed, 0);
    row('radius max (u)', x => x.rMax, 0);
    row('seconds head-to-wind', x => x.irons);
    row('seconds under 40 u/s', x => x.slow);
    const bT = mean(bots.map(x => x.t)), hT = mean(her.map(x => x.t));
    console.log(`\n   ⭐ the armed rounding alone is ${(bT - hT).toFixed(1)} s/boat of the venue's 137.7 s/lap gap (${(100 * (bT - hT) / 137.7).toFixed(0)}%)`);
    console.log(`   an ideal ${(mark.req || Math.PI).toFixed(2)} rad sweep at his median radius is ${((mark.req || Math.PI) * mean(her.map(x => x.rMed))).toFixed(0)}u;`);
    console.log(`   he sails ${mean(her.map(x => x.odo)).toFixed(0)}u and they sail ${mean(bots.map(x => x.odo)).toFixed(0)}u`);
})();
