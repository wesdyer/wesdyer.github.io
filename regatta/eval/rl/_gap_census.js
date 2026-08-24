// THE GAP CENSUS (2026-08-23, ICE-CRAFT ARC, Phase 1.2) — where the 11.5k
// odo delta lives. HIS side from the fp-valid corpus, per racing leg:
// odometer (positions, rule 32), exposure seconds under 78/120/300u,
// encounters (<120u contiguous, close >1.0s) and gap-width bins at min-clr
// (nearest + nearest-opposite-side <=400u of track). SAME definitions as
// _bot_pass.js; if _bot_pass_<tree>.json exists the comparison table is
// printed (him vs solo bot per leg).
//   node _gap_census.js <venue> <fp> [tree]
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const FP = process.argv[3] || '19b566b3:82810';
const TREE = process.argv[4] || 'treeBOTH3';
const TD = path.join(__dirname, 'traj');
const segD = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), qx: ax + t * dx, qy: ay + t * dy };
};
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
function nearOnRow(x, y, row, hulls) {
    const poly = hulls[row[0]]; if (!poly) return null;
    const c = Math.cos(row[3] || 0), s = Math.sin(row[3] || 0);
    const pts = poly.map(([px, py]) => [row[1] + px * c - py * s, row[2] + px * s + py * c]);
    let best = null;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const r = segD(x, y, a[0], a[1], b[0], b[1]);
        if (!best || r.d < best.d) best = r;
    }
    return best;
}
const LEG = {}; const gapsAll = []; let laps = 0;
for (const f of fs.readdirSync(TD).filter(f => f.startsWith('traj_' + VENUE + '_'))) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(TD, f))); } catch (e) { continue; }
    if (j.schema !== 2 || j.venueFingerprint !== FP || !j.finished) continue;
    laps++;
    const F = j.format; const iT = F.indexOf('t'), iX = F.indexOf('x'), iY = F.indexOf('y'),
        iL = F.indexOf('leg'), iFl = F.indexOf('floes');
    const S = j.samples.filter(r => r[iL] >= 1).sort((a, b) => a[iT] - b[iT]);
    const H = j.floeHulls || {};
    let enc = null;
    for (let k = 0; k < S.length; k++) {
        const r = S[k], L = r[iL];
        if (L !== 1 && L !== 2) { continue; }
        const T = LEG[L] = LEG[L] || { odo: 0, racing: 0, e78: 0, e120: 0, e300: 0, enc: 0, gaps: [], nLap: {} };
        T.nLap[f] = 1;
        if (k > 0 && S[k - 1][iL] === L) {
            const dt = r[iT] - S[k - 1][iT];
            if (dt > 0 && dt < 1) {
                T.odo += Math.hypot(r[iX] - S[k - 1][iX], r[iY] - S[k - 1][iY]);
                T.racing += dt;
                // clearance
                let best = null, bestRow = null;
                for (const fr of r[iFl] || []) {
                    const nr = nearOnRow(r[iX], r[iY], fr, H);
                    if (nr && (!best || nr.d < best.d)) { best = nr; bestRow = fr; }
                }
                const clr = best ? best.d : Infinity;
                if (clr < 78) T.e78 += dt;
                if (clr < 120) T.e120 += dt;
                if (clr < 300) T.e300 += dt;
                if (clr < 120) {
                    if (!enc) enc = { L, min: clr, k, lastT: r[iT], best, bestRow };
                    else { enc.lastT = r[iT]; if (clr < enc.min) { enc.min = clr; enc.k = k; enc.best = best; enc.bestRow = bestRow; } }
                } else if (enc && r[iT] - enc.lastT > 1.0) {
                    // close: gap at min
                    const km = enc.k, rm = S[km];
                    const kA = Math.max(0, km - 5), kB = Math.min(S.length - 1, km + 5);
                    const tdx = S[kB][iX] - S[kA][iX], tdy = S[kB][iY] - S[kA][iY];
                    const tl = Math.hypot(tdx, tdy);
                    let gap = null;
                    if (tl > 1) {
                        const tx = tdx / tl, ty = tdy / tl;
                        const sideOf = (px, py) => Math.sign((px - rm[iX]) * ty - (py - rm[iY]) * tx);
                        const s1 = sideOf(enc.best.qx, enc.best.qy);
                        let opp = null;
                        for (const fr of rm[iFl] || []) {
                            if (fr[0] === enc.bestRow[0]) continue;
                            const n2 = nearOnRow(rm[iX], rm[iY], fr, H);
                            if (!n2 || n2.d > 400 || sideOf(n2.qx, n2.qy) === s1) continue;
                            if (opp == null || n2.d < opp) opp = n2.d;
                        }
                        gap = opp != null ? enc.min + opp : null;
                    }
                    const TT = LEG[enc.L]; TT.enc++;
                    if (gap != null) { TT.gaps.push(gap); gapsAll.push(gap); }
                    enc = null;
                }
            }
        }
    }
    if (enc) { LEG[enc.L].enc++; enc = null; }
}
console.log(`${VENUE} fp=${FP}: ${laps} laps (HIS side)`);
for (const [L, T] of Object.entries(LEG)) {
    const n = Object.keys(T.nLap).length;
    console.log(`leg ${L}: odo ${(T.odo / n / 1000).toFixed(1)}k u/lap  time ${(T.racing / n).toFixed(0)}s  exposure<78 ${(T.e78 / n).toFixed(1)}s  <120 ${(T.e120 / n).toFixed(1)}s  <300 ${(T.e300 / n).toFixed(1)}s  encounters ${(T.enc / n).toFixed(1)}/lap  gap bins <60:${T.gaps.filter(x => x < 60).length} 60-100:${T.gaps.filter(x => x >= 60 && x < 100).length} 100-150:${T.gaps.filter(x => x >= 100 && x < 150).length} 150+:${T.gaps.filter(x => x >= 150).length}`);
}
// comparison vs bot
const BP = path.join(__dirname, `_bot_pass_${TREE}.json`);
if (fs.existsSync(BP)) {
    const b = JSON.parse(fs.readFileSync(BP));
    console.log(`\n=== HIM vs SOLO BOT (${TREE}) per leg ===`);
    for (const L of ['1', '2']) {
        const T = LEG[L], B = b.LEG[L]; if (!T || !B) continue;
        const n = Object.keys(T.nLap).length;
        console.log(`leg ${L}: odo ${(T.odo / n / 1000).toFixed(1)}k vs ${(B.odo / B.n / 1000).toFixed(1)}k  (Δ ${((B.odo / B.n - T.odo / n) / 1000).toFixed(1)}k)  time ${(T.racing / n).toFixed(0)} vs ${(B.racing / B.n).toFixed(0)}s  exp<78 ${(T.e78 / n).toFixed(1)} vs ${(B.e78 / B.n).toFixed(1)}s  exp<300 ${(T.e300 / n).toFixed(1)} vs ${(B.e300 / B.n).toFixed(1)}s  enc ${(T.enc / n).toFixed(1)} vs ${(B.enc / B.n).toFixed(1)}`);
    }
} else console.log(`(no ${BP} yet — run _bot_pass.js for the comparison)`);
