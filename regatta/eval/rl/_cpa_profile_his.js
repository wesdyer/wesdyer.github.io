// HIS FLOE-CPA PROFILE (2026-08-22, C4 push, Phase 1.2 — corpus side).
// Floe ENCOUNTER = contiguous samples with nearest-floe clearance < 300u
// (close after >1.0s above); one min-clearance per encounter — the SAME
// definition and the same polygon segment-distance computation as
// _dev_census.js's bot-side profile, so the two are directly comparable.
// fp-verified laps only (rule 23). Legs 1 and 2 separately + pooled.
//   node _cpa_profile_his.js <venue> <fp>
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const FP = process.argv[3] || '19b566b3:82810';
const TD = path.join(__dirname, 'traj');
const segD = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
function clr(x, y, floes, hulls) {
    let best = Infinity;
    for (const f of floes || []) {
        const [hid, fx, fy, spin] = f; const poly = hulls[hid]; if (!poly) continue;
        const c = Math.cos(spin || 0), s = Math.sin(spin || 0);
        const pts = poly.map(([px, py]) => [fx + px * c - py * s, fy + px * s + py * c]);
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            best = Math.min(best, segD(x, y, a[0], a[1], b[0], b[1]));
        }
    }
    return best;
}
const byLeg = { 1: [], 2: [] }; let laps = 0;
for (const f of fs.readdirSync(TD).filter(f => f.startsWith('traj_' + VENUE + '_'))) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(TD, f))); } catch (e) { continue; }
    if (j.schema !== 2 || j.venueFingerprint !== FP || !j.finished) continue;
    laps++;
    const F = j.format; const iT = F.indexOf('t'), iX = F.indexOf('x'), iY = F.indexOf('y'),
        iL = F.indexOf('leg'), iFl = F.indexOf('floes');
    for (const L of [1, 2]) {
        const S = j.samples.filter(r => r[iL] === L);
        let enc = null; const encs = [];
        for (const r of S) {
            const c = clr(r[iX], r[iY], r[iFl], j.floeHulls || {});
            if (c < 300) {
                if (enc) { enc.min = Math.min(enc.min, c); enc.lastT = r[iT]; }
                else enc = { min: c, lastT: r[iT] };
            } else if (enc && r[iT] - enc.lastT > 1.0) { encs.push(enc); enc = null; }
        }
        if (enc) encs.push(enc);
        byLeg[L].push({ f, encs });
    }
}
console.log(`${VENUE} fp=${FP}: ${laps} laps`);
const pooled = [];
for (const L of [1, 2]) {
    const mins = byLeg[L].flatMap(x => x.encs.map(e => e.min));
    pooled.push(...mins);
    console.log(`leg ${L}: ${mins.length} encounters (${(mins.length / laps).toFixed(1)}/lap)  min-clr p10/p25/med/p75: ${q(mins, .1).toFixed(0)}/${q(mins, .25).toFixed(0)}/${q(mins, .5).toFixed(0)}/${q(mins, .75).toFixed(0)}u`);
}
console.log(`pooled legs 1-2: ${pooled.length} encounters  p10/p25/med/p75: ${q(pooled, .1).toFixed(0)}/${q(pooled, .25).toFixed(0)}/${q(pooled, .5).toFixed(0)}/${q(pooled, .75).toFixed(0)}u`);
console.log(`share under 78u: ${(100 * pooled.filter(x => x < 78).length / pooled.length).toFixed(0)}%  under 50u: ${(100 * pooled.filter(x => x < 50).length / pooled.length).toFixed(0)}%  under 28u: ${(100 * pooled.filter(x => x < 28).length / pooled.length).toFixed(0)}%`);
