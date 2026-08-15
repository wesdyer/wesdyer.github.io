// HIS SIDE OF THE BEAT DECOMPOSITION — offline, no browser. (2026-08-14)
// _beat_decomp.js gives the FLEET's odometer / straight line / tacks / waste per leg.
// Without his same columns the split "further" vs "slower" is unanswerable. This reads
// the fingerprint-verified laps straight out of the corpus and prints the same shape.
//
// ⚠️ UNITS (rule 18): the recorded `spd` column is NOT knots — it is the raw PER-FRAME
// speed (`boat.speed`), so u/s = spd × 60, the same convention _beat_decomp.js uses on
// the bot side. (knots × 15 = u/s is the OTHER conversion, for the wind columns.)
// Everything here is derived from POSITIONS instead — odo is Σ|Δp| — so neither
// conversion can bite; the recorded column is only cross-checked at the end.
// ⚠️ vmc target: the engine's live nextWaypoint is not in the recording, so the leg's
// LAST SAMPLE stands in for it. The boat ends a leg at the mark, so this is close, and
// it is the same convention for every lap.
//   node _glow_odo.js [venue] [fingerprint]
const fs = require('fs'), path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const FP = process.argv[3] || null;

const TD = path.join(__dirname, 'traj');
const files = fs.readdirSync(TD).filter(f => f.startsWith(`traj_${VENUE}_`)).sort();
const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };

const laps = [];
for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
    if (FP && j.venueFingerprint !== FP) continue;
    if (!FP && laps.length === 0) console.log(`(no fingerprint given — taking all; stamps seen below)`);
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1);
    const byLeg = {};
    for (const s of S) (byLeg[gi(s, 'leg')] = byLeg[gi(s, 'leg')] || []).push(s);
    laps.push({ f, fp: j.venueFingerprint, fin: j.finishTime, byLeg, gi });
}
if (!laps.length) { console.log('no laps matched'); process.exit(1); }

console.log(`\n=== ${VENUE.toUpperCase()} — HIS per-leg decomposition (${laps.length} lap(s), fp ${laps[0].fp}) ===`);
const allLegs = [...new Set(laps.flatMap(l => Object.keys(l.byLeg).map(Number)))].sort((a, b) => a - b);
const table = {};
for (const LEG of allLegs) {
    const rows = [];
    for (const lap of laps) {
        const S = lap.byLeg[LEG]; if (!S || S.length < 3) continue;
        const gi = lap.gi;
        const ex = gi(S[S.length - 1], 'x'), ey = gi(S[S.length - 1], 'y');
        let odo = 0, waste = 0, tacks = 0, last = null, knotSum = 0, knotN = 0;
        for (let i = 1; i < S.length; i++) {
            const dx = gi(S[i], 'x') - gi(S[i - 1], 'x'), dy = gi(S[i], 'y') - gi(S[i - 1], 'y');
            const d = Math.hypot(dx, dy); if (d >= 200) continue;      // same jump guard as _bay_odo
            const dt = gi(S[i], 't') - gi(S[i - 1], 't'); if (dt <= 0) continue;
            odo += d;
            // VMC toward the leg end, from the actual displacement over this step
            const tx = ex - gi(S[i - 1], 'x'), ty = ey - gi(S[i - 1], 'y');
            const tn = Math.hypot(tx, ty) || 1;
            const made = (dx * tx + dy * ty) / tn;                      // u closed on the target
            waste += Math.max(0, d - made);
            if (d > 0) { knotSum += gi(S[i], 'spd') * 60 * dt; knotN += dt; }   // HULL-frame odo
            const t = gi(S[i], 'playerTack');
            if (last != null && t !== last && t !== 0) tacks++;
            last = t;
        }
        const t0 = gi(S[0], 't'), t1 = gi(S[S.length - 1], 't');
        const secs = t1 - t0;
        rows.push({
            odo: Math.round(odo), straight: Math.round(Math.hypot(ex - gi(S[0], 'x'), ey - gi(S[0], 'y'))),
            tacks, secs: +secs.toFixed(1), waste: Math.round(waste),
            ups: +(odo / secs).toFixed(1), hull: Math.round(knotSum), gh: +(odo / knotSum).toFixed(3)
        });
    }
    if (!rows.length) continue;
    table[LEG] = {
        odo: med(rows.map(r => r.odo)), straight: med(rows.map(r => r.straight)),
        tacks: med(rows.map(r => r.tacks)), secs: med(rows.map(r => r.secs)),
        waste: med(rows.map(r => r.waste)), ups: med(rows.map(r => r.ups)),
        hull: med(rows.map(r => r.hull)), gh: med(rows.map(r => r.gh)), n: rows.length
    };
    const T = table[LEG];
    console.log(`leg ${LEG}: GROUND odo med ${T.odo}  hull odo med ${T.hull}  (g/h ${T.gh})`);
    console.log(`        straight med ${T.straight}  tacks med ${T.tacks}  ` +
        `secs med ${T.secs}  waste med ${T.waste}u  ground speed med ${T.ups} u/s  (n=${T.n})`);
    console.log(`        per-lap odo ${rows.map(r => r.odo).join('/')}   secs ${rows.map(r => r.secs).join('/')}   u/s ${rows.map(r => r.ups).join('/')}`);
}
// FRAME CROSS-CHECK. _frame_odo.js settled this INSIDE the game: |velocity|×60 is the
// travel rate exactly (g/v 1.001) and speed×60 runs 4.8% low — `speed` omits the leeway
// component. So ground ≈ 1.05 × hull is the physical expectation. The per-leg g/h below
// scatters 0.87–1.21 instead, because the corpus samples at 10 Hz and a rectangle-rule
// integration of a speed that swings through every tack is simply coarse. That is why
// EVERY number quoted from this probe is the GROUND odometer, taken from positions.
const gh = Object.entries(table).map(([lg, T]) => `${lg}:${T.gh}`).join(' ');
console.log(`\nframe check — per-leg ground/hull ${gh}  (physical expectation ~1.05; scatter here is the 10 Hz corpus, not physics)`);
console.log(`⚠️ Quote the GROUND column only, and only against a fleet GROUND column (_beat_decomp godo).`);
fs.writeFileSync(path.join(__dirname, `_glow_odo_${VENUE}.json`), JSON.stringify(table, null, 1));
