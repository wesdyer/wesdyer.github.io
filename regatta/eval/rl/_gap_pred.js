// GAP-SCALE DRIFT PREDICTABILITY (2026-08-23, ICE-CRAFT ARC, Phase 1.4).
// [[regatta-map-staleness]] says floe drift is unpredictable past ~5s at
// PACK scale. R3 (gap admission) and H1 (edge tracking) need it at GAP
// scale over 3-5s: for every corpus sub-78u pass (his laps), at t*−Δ
// predict the passed floe's pose at t* (x+vx·Δ, spin+ω·Δ, ω differenced at
// the EARLIER time) and compare the predicted clearance to HIS ACTUAL
// position at t* vs the actual recorded clearance. Also the FROZEN
// prediction (pose at t*−Δ unchanged) — the map-staleness null.
// Error must be << his 28-50u shave band for drift-compensated tracking
// to be buildable. Same hull math as _his_pass.js.
//   node _gap_pred.js <venue> <fp>
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const FP = process.argv[3] || '19b566b3:82810';
const TD = path.join(__dirname, 'traj');
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const segD = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
function clrTo(x, y, row, hulls, dtAhead, om) {
    const poly = hulls[row[0]]; if (!poly) return null;
    const fx = row[1] + row[4] * dtAhead, fy = row[2] + row[5] * dtAhead;
    const sp = row[3] + (om || 0) * dtAhead;
    const c = Math.cos(sp), s = Math.sin(sp);
    let best = Infinity;
    const pts = poly.map(([px, py]) => [fx + px * c - py * s, fy + px * s + py * c]);
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        best = Math.min(best, segD(x, y, a[0], a[1], b[0], b[1]));
    }
    return best;
}
const res = { 3: { drift: [], frozen: [] }, 5: { drift: [], frozen: [] } };
let nEnc = 0, laps = 0;
for (const f of fs.readdirSync(TD).filter(f => f.startsWith('traj_' + VENUE + '_'))) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(TD, f))); } catch (e) { continue; }
    if (j.schema !== 2 || j.venueFingerprint !== FP || !j.finished) continue;
    laps++;
    const F = j.format; const iT = F.indexOf('t'), iX = F.indexOf('x'), iY = F.indexOf('y'),
        iL = F.indexOf('leg'), iFl = F.indexOf('floes');
    const S = j.samples.filter(r => r[iL] >= 1).sort((a, b) => a[iT] - b[iT]);
    const H = j.floeHulls || {};
    // find sub-78 minima (same encounter logic as _his_pass, simplified:
    // local minima of nearest-floe clearance under 78u, >=3s apart)
    const mins = [];
    let lastMinT = -10;
    for (let k = 1; k < S.length - 1; k++) {
        const r = S[k];
        let best = null, bestRow = null;
        for (const fr of r[iFl] || []) {
            const c = clrTo(r[iX], r[iY], fr, H, 0, 0);
            if (c != null && (best == null || c < best)) { best = c; bestRow = fr; }
        }
        if (best == null || best >= 78) continue;
        if (r[iT] - lastMinT < 3) continue;
        mins.push({ k, row: bestRow, clr: best }); lastMinT = r[iT];
    }
    nEnc += mins.length;
    for (const m of mins) {
        const tStar = S[m.k][iT], x = S[m.k][iX], y = S[m.k][iY];
        for (const D of [3, 5]) {
            // sample at t*-D
            let kb = null;
            for (let k = m.k; k >= 0; k--) { if (tStar - S[k][iT] >= D) { kb = k; break; } }
            if (kb == null) continue;
            const rb = S[kb], dtA = tStar - rb[iT];
            const rowB = (rb[iFl] || []).find(fr => fr[0] === m.row[0]);
            if (!rowB) continue;
            // omega at kb (difference vs previous sample carrying the floe)
            let om = 0;
            for (let k = kb - 1; k >= Math.max(0, kb - 5); k--) {
                const rp = (S[k][iFl] || []).find(fr => fr[0] === m.row[0]);
                if (rp) { const dt2 = rb[iT] - S[k][iT]; if (dt2 > 0.05) om = wrap(rowB[3] - rp[3]) / dt2; break; }
            }
            const cD = clrTo(x, y, rowB, H, dtA, om);   // drift+spin prediction
            const cF = clrTo(x, y, rowB, H, 0, 0);       // frozen snapshot
            if (cD != null) res[D].drift.push(Math.abs(cD - m.clr));
            if (cF != null) res[D].frozen.push(Math.abs(cF - m.clr));
        }
    }
}
console.log(`${VENUE} fp=${FP}: ${laps} laps, ${nEnc} sub-78u minima`);
for (const D of [3, 5]) {
    for (const kind of ['drift', 'frozen']) {
        const a = res[D][kind];
        console.log(`Δ=${D}s ${kind.padEnd(6)} n=${a.length}  |err| p25/med/p75/p90: ${q(a, .25).toFixed(1)}/${q(a, .5).toFixed(1)}/${q(a, .75).toFixed(1)}/${q(a, .9).toFixed(1)}u  share<10u: ${(100 * a.filter(x => x < 10).length / a.length).toFixed(0)}%  share<28u: ${(100 * a.filter(x => x < 28).length / a.length).toFixed(0)}%`);
    }
}
console.log('(his shave band 28-50u — drift med error must sit well under 28u at Δ=3-5s for H1/R3 admission to be honest)');
