// Human trajectory analyzer: per-run and aggregate report over recorded
// traj_*.json files (recorder v3+; later fields used when present).
//   node traj_report.js [dir=./traj] [venueFilter]
// Reports: segment splits, speeds, contacts/penalties, ROW exposure, tack
// stats, closest floe approach (exact hulls when recorded, v6+), pinned
// episodes (speed<0.3 for >3s with floe contact) and how they resolved.
const fs = require('fs'); const path = require('path');
const DIR = process.argv[2] || path.join(__dirname, 'traj');
const VENUE = process.argv[3] || null;

function distPointSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function distToHull(px, py, hull, hx, hy, spin) {
    const c = Math.cos(spin), s = Math.sin(spin);
    const w = hull.map(p => [hx + p[0] * c - p[1] * s, hy + p[0] * s + p[1] * c]);
    let d = Infinity;
    for (let i = 0; i < w.length; i++) {
        const a = w[i], b = w[(i + 1) % w.length];
        d = Math.min(d, distPointSeg(px, py, a[0], a[1], b[0], b[1]));
    }
    return d; // distance to hull boundary (0 if touching; inside not handled)
}
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'))
    .filter(f => !VENUE || f.includes(VENUE));
const agg = { finT: [], leg1: [], leg2: [], armed: [], minFloe: [], contacts: [], pens: [], pinned: [], ocs: [], ocsKnown: 0 };
for (const f of files.sort()) {
    const t = JSON.parse(fs.readFileSync(path.join(DIR, f)));
    const S = t.samples;
    const legStart = {};
    for (const s of S) if (legStart[s[8]] == null) legStart[s[8]] = s[0];
    const armed = S.filter(s => s[10] === 1);
    const evs = t.events || [];
    const nCol = ty => evs.filter(e => e[1] === ty).length;

    // Closest floe approach — exact hulls (v6+) or bounding-circle fallback.
    let minFloe = Infinity, minFloeT = null;
    for (const s of S) {
        const fl = s[14]; if (!Array.isArray(fl)) continue;
        for (const g of fl) {
            let d;
            if (t.floeHulls && t.floeHulls[g[0]] !== undefined && g.length >= 4)
                d = distToHull(s[2], s[3], t.floeHulls[g[0]], g[1], g[2], g[3]);
            else d = Math.hypot(s[2] - g[g.length > 5 ? 1 : 0], s[3] - g[g.length > 5 ? 2 : 1]) - (g.length > 5 ? 0 : g[2]);
            if (d < minFloe) { minFloe = d; minFloeT = s[0]; }
        }
    }

    // Pinned episodes: speed < 0.3 for >= 3s while in racing phase near a floe.
    const pinned = [];
    let runStart = null;
    for (const s of S) {
        const slow = s[1] === 1 && s[5] < 0.3 && Array.isArray(s[14]) && s[14].length;
        if (slow && runStart == null) runStart = s[0];
        if (!slow && runStart != null) {
            if (s[0] - runStart >= 3) pinned.push([+runStart.toFixed(0), +(s[0] - runStart).toFixed(0)]);
            runStart = null;
        }
    }

    // ROW exposure: share of racing samples with giveWayN>0 (v3+), tack split (v7+: s[20]).
    const racing = S.filter(s => s[1] === 1);
    const gw = racing.filter(s => (s[15] ?? 0) > 0).length;
    const stbd = racing.filter(s => s[20] === 1).length;
    // OCS-after-the-gun (v7+: s[16] = raceState.ocs). The flag can only be SET
    // during prestart, so a racing-phase sample with it up means the sailor was
    // over the line at the gun and paying the return — the scoreboard's
    // "penalized early start". A hold cleared before the gun never shows here.
    const ocsRecorded = S.some(s => s[16] !== undefined);
    const ocsStart = racing.some(s => s[16] === 1 || s[16] === true);
    const ocsDur = racing.filter(s => s[16] === 1 || s[16] === true).length * 0.1;

    // Per-leg splits, generalized to any leg count (leg N start -> leg N+1 start).
    const legIds = Object.keys(legStart).map(Number).sort((a, b) => a - b).filter(l => l >= 1);
    const splits = legIds.map(l => {
        const end = legStart[l + 1] != null ? legStart[l + 1] : t.finishTime;
        return end != null ? `L${l} ${(end - legStart[l]).toFixed(0)}s` : null;
    }).filter(Boolean).join(' ');
    const leg1 = legStart[2] != null && legStart[1] != null ? legStart[2] - legStart[1] : null;
    const leg2 = legStart[2] != null && t.finishTime ? t.finishTime - legStart[2] : null;
    const armedDur = armed.length ? armed[armed.length - 1][0] - armed[0][0] : null;

    console.log(`${f}`);
    console.log(`  fin ${t.finished} ${t.finishTime ? t.finishTime.toFixed(1) + 's' : ''}` +
        ` | ${splits}${armedDur != null ? ' armed ' + armedDur.toFixed(0) + 's' : ''}` +
        ` | contacts floe ${evs.filter(e => e[1] === 'collision_island' && e[2] === 'floe').length}` +
        ` land ${evs.filter(e => e[1] === 'collision_island' && e[2] === 'land').length}` +
        ` boat ${nCol('collision_boat')} mark ${nCol('collision_mark')} pen ${nCol('penalty')}` +
        ` | minFloeDist ${isFinite(minFloe) ? minFloe.toFixed(0) + 'u@t' + minFloeT.toFixed(0) : '-'}` +
        ` | giveWay ${(100 * gw / Math.max(1, racing.length)).toFixed(0)}%` +
        (racing.some(s => s[20] !== undefined) ? ` stbd ${(100 * stbd / racing.length).toFixed(0)}%` : '') +
        (ocsRecorded ? (ocsStart ? ` | OCS-AT-GUN (${ocsDur.toFixed(1)}s returning)` : ' | ocs clean') : '') +
        (pinned.length ? ` | PINNED ${pinned.map(p => p[1] + 's@t' + p[0]).join(',')}` : ''));
    if (t.finishTime) agg.finT.push(t.finishTime);
    if (leg1) agg.leg1.push(leg1);
    if (leg2) agg.leg2.push(leg2);
    if (armedDur) agg.armed.push(armedDur);
    if (isFinite(minFloe)) agg.minFloe.push(minFloe);
    agg.contacts.push(evs.filter(e => e[1].startsWith('collision')).length);
    agg.pens.push(nCol('penalty'));
    agg.pinned.push(...pinned);
    if (ocsRecorded) { agg.ocsKnown++; agg.ocs.push(ocsStart ? 1 : 0); }
}
console.log(`\nAGGREGATE (${files.length} runs${VENUE ? ', ' + VENUE : ''}):` +
    ` finT med ${med(agg.finT) && med(agg.finT).toFixed(1)} | leg1 med ${med(agg.leg1) && med(agg.leg1).toFixed(0)}` +
    ` | leg2 med ${med(agg.leg2) && med(agg.leg2).toFixed(0)} | armed med ${med(agg.armed) && med(agg.armed).toFixed(0)}` +
    ` | minFloe med ${med(agg.minFloe) && med(agg.minFloe).toFixed(0)}u` +
    ` | contacts/run ${med(agg.contacts)} | pens/run ${med(agg.pens)} | pinned episodes ${agg.pinned.length}` +
    (agg.ocsKnown ? ` | OCS ${agg.ocs.reduce((a, b) => a + b, 0)}/${agg.ocsKnown} runs` : ' | OCS n/i (pre-v7 trajs)'));
console.log('Bot reference (fleet_leg2 accepted stack): leg1 med 465s (min 249), leg2 med 243s (min 104), sweep med 125s; best in-time finish 391s.');
