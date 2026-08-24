// HIS BOARD LADDER (2026-08-22, the arctic router push, Phase 1.3).
// The design target for any commitment shape is HIS number, not zero tacks:
// per fp-verified lap, what does his leg-1 board ladder look like — board
// count, board length (ground, from POSITIONS — rule 32), board duration,
// TWA held on the board, and his clearance to the nearest floe at the
// moment he tacks. Pure corpus read, no browser.
//
//   node _board_ladder.js <venue> <fp>          e.g. _board_ladder.js arctic 19b566b3:82810
//
// Board = a run of constant playerTack (1=stbd, -1=port) on the given leg,
// with flips only counted after the previous side was stable >= 0.5s
// (mirrors _flips.js so the two censuses are comparable). TWA is
// |wrap(hdg - windDir)| per sample (engine convention: 0 = head-to-wind,
// checked against the no-go tax — rule 19). Clearance at a tack = min
// distance from his position to any floe hull polygon (floes column caps
// at 1200u; a tack with no floe in range prints as >1200 and is excluded
// from the clearance median but counted in the ladder).
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const FP = process.argv[3] || '19b566b3:82810';
const LEG = parseInt(process.argv[4] || '1');
const TD = path.join(__dirname, 'traj');
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };

function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx, qy = ay + t * dy; return Math.hypot(px - qx, py - qy);
}
function floeClearance(x, y, floes, hulls) {
    let best = Infinity;
    for (const f of floes || []) {
        const [hid, fx, fy, spin] = f; const poly = hulls[hid]; if (!poly) continue;
        const c = Math.cos(spin || 0), s = Math.sin(spin || 0);
        const pts = poly.map(([px, py]) => [fx + px * c - py * s, fy + px * s + py * c]);
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            best = Math.min(best, segDist(x, y, a[0], a[1], b[0], b[1]));
        }
    }
    return best;
}

const laps = [];
for (const f of fs.readdirSync(TD).filter(f => f.startsWith('traj_' + VENUE + '_'))) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(TD, f))); } catch (e) { continue; }
    if (j.schema !== 2 || j.venueFingerprint !== FP || !j.finished) continue;
    laps.push({ f, j });
}
console.log(`${VENUE} fp=${FP} leg ${LEG}: ${laps.length} laps`);
const allLens = [], allDurs = [], allTwa = [], allClr = [], allCnt = [];
let clrNoFloe = 0;
for (const { f, j } of laps) {
    const F = j.format; const iT = F.indexOf('t'), iX = F.indexOf('x'), iY = F.indexOf('y'),
        iH = F.indexOf('hdg'), iW = F.indexOf('windDir'), iL = F.indexOf('leg'),
        iTk = F.indexOf('playerTack'), iFl = F.indexOf('floes');
    const S = j.samples.filter(r => r[iL] === LEG);
    if (S.length < 5) { console.log(`  ${f}: <5 samples on leg ${LEG}`); continue; }
    // boards: runs of constant tack; a flip counts only if previous side stable >=0.5s
    const boards = []; let cur = { tack: S[0][iTk], t0: S[0][iT], i0: 0 }; let stableSince = S[0][iT];
    for (let i = 1; i < S.length; i++) {
        const tk = S[i][iTk];
        if (tk !== cur.tack) {
            if (S[i - 1][iT] - stableSince >= 0.5) {
                boards.push({ ...cur, t1: S[i][iT], i1: i });
                cur = { tack: tk, t0: S[i][iT], i0: i };
            } else { cur.tack = tk; } // jitter: absorb, no board
            stableSince = S[i][iT];
        }
    }
    boards.push({ ...cur, t1: S[S.length - 1][iT], i1: S.length - 1 });
    const lens = [], durs = [], twas = [], clrs = [];
    for (let b = 0; b < boards.length; b++) {
        const B = boards[b]; let len = 0; const tw = [];
        for (let i = B.i0 + 1; i <= B.i1; i++) {
            len += Math.hypot(S[i][iX] - S[i - 1][iX], S[i][iY] - S[i - 1][iY]);
            tw.push(Math.abs(wrap(S[i][iH] - S[i][iW])));
        }
        lens.push(len); durs.push(B.t1 - B.t0); twas.push(med(tw));
        if (b < boards.length - 1) { // clearance at the tack that ENDS this board
            const r = S[B.i1];
            const c = floeClearance(r[iX], r[iY], r[iFl], j.floeHulls || {});
            if (isFinite(c)) clrs.push(c); else clrNoFloe++;
        }
    }
    allCnt.push(boards.length - 1); // manoeuvre count = boards - 1
    allLens.push(...lens); allDurs.push(...durs); allTwa.push(...twas); allClr.push(...clrs);
    console.log(`  ${f.slice(5, -5)}  boards ${boards.length} (tacks ${boards.length - 1})  len med ${med(lens).toFixed(0)}u p90 ${q(lens, .9).toFixed(0)}  dur med ${med(durs).toFixed(1)}s  TWA med ${(med(twas) * 180 / Math.PI).toFixed(0)}deg  clr@tack ${clrs.map(c => c.toFixed(0)).join('/') || '-'}`);
}
console.log(`\nLADDER (pooled over ${laps.length} laps)`);
console.log(`  tacks/leg:      med ${med(allCnt)}  range ${Math.min(...allCnt)}-${Math.max(...allCnt)}`);
console.log(`  board length u: med ${med(allLens).toFixed(0)}  p25 ${q(allLens, .25).toFixed(0)}  p75 ${q(allLens, .75).toFixed(0)}  p90 ${q(allLens, .9).toFixed(0)}`);
console.log(`  board dur s:    med ${med(allDurs).toFixed(1)}  p25 ${q(allDurs, .25).toFixed(1)}  p75 ${q(allDurs, .75).toFixed(1)}`);
console.log(`  TWA on board:   med ${(med(allTwa) * 180 / Math.PI).toFixed(1)}deg  p25 ${(q(allTwa, .25) * 180 / Math.PI).toFixed(1)}  p75 ${(q(allTwa, .75) * 180 / Math.PI).toFixed(1)}`);
console.log(`  clearance at tack u: med ${med(allClr).toFixed(0)}  p25 ${q(allClr, .25).toFixed(0)}  p75 ${q(allClr, .75).toFixed(0)}  n ${allClr.length} (+${clrNoFloe} tacks with no floe <=1200u)`);
