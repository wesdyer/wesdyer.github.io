// HIS-CORRIDORS ADMISSION GAP (2026-08-23, R3 push Phase 1.2).
// Which of HIS sub-120u transits would today's stamps refuse? The stamp
// closes any cell whose CENTRE is within CLEARANCE=44u of a floe hull
// (worst-case-rotation bar), so a pass at true-hull clearance c sits in
// stamped-blocked water when c < 44 (±half-cell, RES=50 -> +25u smear).
// Corpus walk identical to _gap_pred.js: fp-valid laps, racing legs, hull
// polys from the recording. Reports (a) share of racing SAMPLES in
// refused water at three bars (44 / 44+25 / 78 = the fairing demand), and
// (b) share of sub-120u pass MINIMA under each bar — the like-for-like
// admission gap R3 would have to open to sail his lines.
//   node _his_admit.js <venue> <fp>
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const FP = process.argv[3] || '19b566b3:82810';
const TD = path.join(__dirname, 'traj');
const segD = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
function clrTo(x, y, row, hulls) {
    const poly = hulls[row[0]]; if (!poly) return null;
    const c = Math.cos(row[3]), s = Math.sin(row[3]);
    let best = Infinity;
    const pts = poly.map(([px, py]) => [row[1] + px * c - py * s, row[2] + px * s + py * c]);
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        best = Math.min(best, segD(x, y, a[0], a[1], b[0], b[1]));
    }
    return best;
}
let laps = 0, nSamp = 0;
const sampClr = [], minima = [];
for (const f of fs.readdirSync(TD).filter(f => f.startsWith('traj_' + VENUE + '_'))) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(TD, f))); } catch (e) { continue; }
    if (j.schema !== 2 || j.venueFingerprint !== FP || !j.finished) continue;
    laps++;
    const F = j.format; const iT = F.indexOf('t'), iX = F.indexOf('x'), iY = F.indexOf('y'),
        iL = F.indexOf('leg'), iFl = F.indexOf('floes');
    const S = j.samples.filter(r => r[iL] >= 1).sort((a, b) => a[iT] - b[iT]);
    const H = j.floeHulls || {};
    let lastMinT = -10;
    for (let k = 0; k < S.length; k++) {
        const r = S[k];
        let best = Infinity;
        for (const fr of r[iFl] || []) {
            const c = clrTo(r[iX], r[iY], fr, H);
            if (c != null && c < best) best = c;
        }
        if (best === Infinity) continue;
        nSamp++; sampClr.push(best);
        // sub-120 minima, 3s dedup (same logic family as _gap_pred)
        if (best < 120 && r[iT] - lastMinT >= 3) {
            // confirm local minimum within ±1 sample
            const prev = k > 0 ? S[k - 1] : null, next = k < S.length - 1 ? S[k + 1] : null;
            const cOf = (rr) => { if (!rr) return Infinity; let b2 = Infinity; for (const fr of rr[iFl] || []) { const c = clrTo(rr[iX], rr[iY], fr, H); if (c != null && c < b2) b2 = c; } return b2; };
            if (cOf(prev) >= best && cOf(next) >= best) { minima.push(best); lastMinT = r[iT]; }
        }
    }
}
const pct = (a, bar) => (100 * a.filter(x => x < bar).length / a.length).toFixed(1);
console.log(`${VENUE} fp=${FP}: ${laps} laps, ${nSamp} racing samples, ${minima.length} sub-120u pass minima`);
console.log(`racing SAMPLES in refused water:  <44u (stamped): ${pct(sampClr, 44)}%   <69u (44+half-cell): ${pct(sampClr, 69)}%   <78u (fairing demand): ${pct(sampClr, 78)}%`);
console.log(`sub-120u pass MINIMA refused:     <44u: ${pct(minima, 44)}%   <69u: ${pct(minima, 69)}%   <78u: ${pct(minima, 78)}%`);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
console.log(`pass minima p10/p25/med/p75: ${q(minima, .1).toFixed(0)}/${q(minima, .25).toFixed(0)}/${q(minima, .5).toFixed(0)}/${q(minima, .75).toFixed(0)}u  (his shave spec: 24/32/41/55)`);
