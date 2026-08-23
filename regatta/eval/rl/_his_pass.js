// HIS PASS SPEC (2026-08-23, THE ICE-CRAFT ARC, Phase 1.1).
// For every corpus close encounter (context band: nearest-floe clr < 120u,
// close after >1.0s above; ANALYZED if min-clr < 78u — the bot's demand
// floor) on his fp-valid schema-2 laps, racing legs only:
//   - ground-speed profile entry (−3s) / at-min (±0.5s) / exit (+3s)
//     — POSITIONS both sides (rule 32), u/s
//   - hull-track angle vs nearest edge tangent at min-clr (0-90 fold)
//   - pass side vs rim motion: rim-point velocity (drift + spinRate x r)
//     projected on the outward normal toward the boat — ADVANCING (>0,
//     rim coming at him) vs RECEDING (<0)
//   - gap width at min-clr: clr to nearest hull + clr to nearest hull on
//     the OPPOSITE side of his track (<=400u) — else OPEN-side pass
//   - gap drift: d(gap)/dt from the two hulls' drift (recompute at +1s)
//   - TWA (0 = head-to-wind, rule 19), tack, duration
// Deliverable: THE SPEC table (percentiles + shares).
//   node _his_pass.js <venue> <fp>
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const FP = process.argv[3] || '19b566b3:82810';
const TD = path.join(__dirname, 'traj');
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const segD = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), qx: ax + t * dx, qy: ay + t * dy };
};
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
// pose a floe row at +dt seconds (row = [hid,x,y,spin,vx,vy]; om = spin rate rad/s)
function hullPts(row, hulls, dtAhead, om) {
    const poly = hulls[row[0]]; if (!poly) return null;
    const fx = row[1] + row[4] * dtAhead, fy = row[2] + row[5] * dtAhead;
    const sp = row[3] + (om || 0) * dtAhead;
    const c = Math.cos(sp), s = Math.sin(sp);
    return poly.map(([px, py]) => [fx + px * c - py * s, fy + px * s + py * c]);
}
// nearest point on a floe hull to (x,y): {d, qx, qy}
function nearOnHull(x, y, pts) {
    let best = null;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const r = segD(x, y, a[0], a[1], b[0], b[1]);
        if (!best || r.d < best.d) { best = r; best.ai = i; }
    }
    return best;
}
const enc2 = []; let laps = 0, movingSpd = [];
for (const f of fs.readdirSync(TD).filter(f => f.startsWith('traj_' + VENUE + '_'))) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(TD, f))); } catch (e) { continue; }
    if (j.schema !== 2 || j.venueFingerprint !== FP || !j.finished) continue;
    laps++;
    const F = j.format; const iT = F.indexOf('t'), iX = F.indexOf('x'), iY = F.indexOf('y'),
        iH = F.indexOf('hdg'), iL = F.indexOf('leg'), iFl = F.indexOf('floes'),
        iWD = F.indexOf('windDir'), iTk = F.indexOf('playerTack');
    const S = j.samples.filter(r => r[iL] >= 1).sort((a, b) => a[iT] - b[iT]);
    const H = j.floeHulls || {};
    // spin-rate table: hid -> per-sample om via wrap-aware differencing
    const omAt = (k, hid) => { // rad/s at sample k for floe hid
        const find = (kk) => (S[kk] && S[kk][iFl] || []).find(r => r[0] === hid);
        const a = find(k - 1), b = find(k + 1) || find(k);
        const a2 = a || find(k);
        if (!a2 || !b || a2 === b) return 0;
        const ta = a ? S[k - 1][iT] : S[k][iT], tb = (find(k + 1) ? S[k + 1] : S[k])[iT];
        if (tb - ta < 0.01) return 0;
        return wrap(b[3] - a2[3]) / (tb - ta);
    };
    // ground speed over [t-w, t+w] centered at sample k (positions, u/s)
    const gspd = (k, w) => {
        let k0 = k, k1 = k;
        while (k0 > 0 && S[k][iT] - S[k0 - 1][iT] <= w) k0--;
        while (k1 < S.length - 1 && S[k1 + 1][iT] - S[k][iT] <= w) k1++;
        let d = 0; for (let m = k0; m < k1; m++) d += Math.hypot(S[m + 1][iX] - S[m][iX], S[m + 1][iY] - S[m][iY]);
        const dt = S[k1][iT] - S[k0][iT]; return dt > 0.05 ? d / dt : NaN;
    };
    // his overall moving speed reference (racing samples, moving > 20 u/s)
    for (let k = 10; k < S.length - 10; k += 10) { const v = gspd(k, 0.5); if (v > 20) movingSpd.push(v); }
    // encounters
    let enc = null; const encs = [];
    for (let k = 0; k < S.length; k++) {
        const r = S[k];
        let best = null;
        for (const fr of r[iFl] || []) {
            const pts = hullPts(fr, H, 0, 0); if (!pts) continue;
            const nr = nearOnHull(r[iX], r[iY], pts);
            if (!best || nr.d < best.d) { best = { d: nr.d, row: fr, nr }; }
        }
        const c = best ? best.d : Infinity;
        if (c < 120) {
            if (enc) { if (c < enc.min) { enc.min = c; enc.kMin = k; enc.rowMin = best.row; } enc.lastT = r[iT]; enc.kEnd = k; }
            else enc = { min: c, kMin: k, rowMin: best.row, k0: k, t0: r[iT], lastT: r[iT], kEnd: k };
        } else if (enc && r[iT] - enc.lastT > 1.0) { encs.push(enc); enc = null; }
    }
    if (enc) encs.push(enc);
    for (const e of encs) {
        if (e.min >= 78) continue;
        const k = e.kMin, r = S[k], row = e.rowMin;
        const om = omAt(k, row[0]);
        const pts = hullPts(row, H, 0, 0); if (!pts) continue;
        const nr = nearOnHull(r[iX], r[iY], pts);
        // track direction at min-clr (positions +-0.5s)
        const kA = Math.max(0, k - 5), kB = Math.min(S.length - 1, k + 5);
        const tdx = S[kB][iX] - S[kA][iX], tdy = S[kB][iY] - S[kA][iY];
        const tl = Math.hypot(tdx, tdy); if (tl < 1) continue;
        const tx = tdx / tl, ty = tdy / tl;
        // edge tangent at nearest segment
        const a = pts[nr.ai], b = pts[(nr.ai + 1) % pts.length];
        let ex = b[0] - a[0], ey = b[1] - a[1]; const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
        let edgeAng = Math.acos(Math.min(1, Math.abs(tx * ex + ty * ey))) * 180 / Math.PI; // 0=parallel
        // rim motion: outward normal toward the boat
        let ux = r[iX] - nr.qx, uy = r[iY] - nr.qy; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
        const rvx = row[4] + (-om * (nr.qy - row[2])), rvy = row[5] + (om * (nr.qx - row[1]));
        const rimAdv = rvx * ux + rvy * uy; // u/s, >0 = rim advancing toward his side
        const rimSpd = Math.hypot(rvx, rvy);
        // gap: nearest hull on the OPPOSITE side of track
        const sideOf = (px, py) => Math.sign((px - r[iX]) * ty - (py - r[iY]) * tx);
        const side1 = sideOf(nr.qx, nr.qy);
        let opp = null, oppRow = null, oppNr = null;
        for (const fr of r[iFl] || []) {
            if (fr[0] === row[0]) continue;
            const p2 = hullPts(fr, H, 0, 0); if (!p2) continue;
            const n2 = nearOnHull(r[iX], r[iY], p2);
            if (n2.d > 400) continue;
            if (sideOf(n2.qx, n2.qy) === side1) continue;
            if (!opp || n2.d < opp) { opp = n2.d; oppRow = fr; oppNr = n2; }
        }
        const gap = opp != null ? e.min + opp : null;
        // gap drift: recompute both clearances at +1s with drift+spin
        let gapRate = null;
        if (opp != null) {
            const om2 = omAt(k, oppRow[0]);
            const p1b = hullPts(row, H, 1, om), p2b = hullPts(oppRow, H, 1, om2);
            const c1b = nearOnHull(r[iX], r[iY], p1b).d, c2b = nearOnHull(r[iX], r[iY], p2b).d;
            gapRate = (c1b + c2b) - gap;
        } else {
            // open pass: rim advance rate IS the closing measure
            gapRate = -rimAdv;
        }
        const twa = Math.abs(wrap(r[iH] - r[iWD])) * 180 / Math.PI;
        enc2.push({
            f: path.basename('' + f), leg: r[iL], min: +e.min.toFixed(1),
            dur: +(S[e.kEnd][iT] - e.t0).toFixed(1),
            vIn: +gspd(Math.max(0, e.k0), 3).toFixed(0),
            vMin: +gspd(k, 0.5).toFixed(0),
            vOut: +gspd(Math.min(S.length - 1, e.kEnd), 3).toFixed(0),
            edgeAng: +edgeAng.toFixed(0), rimAdv: +rimAdv.toFixed(1), rimSpd: +rimSpd.toFixed(1),
            om: +(om * 180 / Math.PI).toFixed(1), gap: gap != null ? +gap.toFixed(0) : null,
            gapRate: gapRate != null ? +gapRate.toFixed(1) : null,
            twa: +twa.toFixed(0), tack: r[iTk],
        });
    }
}
console.log(`${VENUE} fp=${FP}: ${laps} laps, ${enc2.length} sub-78u encounters (${(enc2.length / laps).toFixed(1)}/lap)`);
console.log(`his moving speed reference: med ${q(movingSpd, .5).toFixed(0)} u/s (p25 ${q(movingSpd, .25).toFixed(0)} p75 ${q(movingSpd, .75).toFixed(0)})`);
const col = (k2) => enc2.map(e => e[k2]).filter(x => x != null && isFinite(x));
const P = (k2, u) => `p10/p25/med/p75/p90: ${q(col(k2), .1).toFixed(0)}/${q(col(k2), .25).toFixed(0)}/${q(col(k2), .5).toFixed(0)}/${q(col(k2), .75).toFixed(0)}/${q(col(k2), .9).toFixed(0)}${u}`;
console.log(`\n=== THE SPEC (sub-78u passes) ===`);
console.log(`min-clr        ${P('min', 'u')}`);
console.log(`duration       ${P('dur', 's')}`);
console.log(`speed entry    ${P('vIn', ' u/s')}`);
console.log(`speed at min   ${P('vMin', ' u/s')}`);
console.log(`speed exit     ${P('vOut', ' u/s')}`);
const eased = enc2.filter(e => e.vIn > 0 && e.vMin / e.vIn < 0.85).length;
console.log(`EASING: at-min < 85% of entry in ${eased}/${enc2.length} (${(100 * eased / enc2.length).toFixed(0)}%)  vMin/vIn med ${q(enc2.map(e => e.vMin / e.vIn).filter(isFinite), .5).toFixed(2)}`);
console.log(`edge angle     ${P('edgeAng', 'deg')} (0 = track parallel to edge)`);
const rec = enc2.filter(e => e.rimAdv < -0.5).length, adv = enc2.filter(e => e.rimAdv > 0.5).length;
console.log(`rim motion:    RECEDING ${rec} (${(100 * rec / enc2.length).toFixed(0)}%)  ADVANCING ${adv} (${(100 * adv / enc2.length).toFixed(0)}%)  neutral ${enc2.length - rec - adv}  rimAdv ${P('rimAdv', ' u/s')}  rimSpd med ${q(col('rimSpd'), .5).toFixed(1)} u/s`);
const gaps = col('gap');
console.log(`gap (2-sided): ${gaps.length}/${enc2.length} threaded  width ${P('gap', 'u')}  bins <60:${gaps.filter(x => x < 60).length} 60-100:${gaps.filter(x => x >= 60 && x < 100).length} 100-150:${gaps.filter(x => x >= 100 && x < 150).length} 150+:${gaps.filter(x => x >= 150).length}`);
const gr = enc2.filter(e => e.gap != null).map(e => e.gapRate);
console.log(`gap drift:     opening(>+1) ${gr.filter(x => x > 1).length}  closing(<-1) ${gr.filter(x => x < -1).length}  static ${gr.filter(x => Math.abs(x) <= 1).length}  rate ${q(gr, .25).toFixed(1)}/${q(gr, .5).toFixed(1)}/${q(gr, .75).toFixed(1)} u/s`);
console.log(`TWA            ${P('twa', 'deg')} (0 = head-to-wind)`);
const byLeg = {};
for (const e of enc2) byLeg[e.leg] = (byLeg[e.leg] || 0) + 1;
console.log(`by leg: ${JSON.stringify(byLeg)}`);
fs.writeFileSync(path.join(__dirname, '_his_pass.json'), JSON.stringify(enc2, null, 1));
console.log('wrote _his_pass.json');
