// Pin-escape analyzer: how do HUMANS resolve floe pins? For every pinned
// episode (speed<0.3 for >=3s near a floe, same def as traj_report) print the
// second-by-second mechanics: heading vs course-over-ground, turn rate, AWA,
// throttle (speed build), nearest-floe bearing — then classify the escape:
//   BACK-OUT   motion opposite heading (sails aback / drift astern)
//   ROTATE     heading swings >45deg with little translation, then departs
//   POWER      heading roughly held, speed builds, grinds along/through
//   node pin_report.js [dir=./traj] [venueFilter=arctic]
const fs = require('fs'); const path = require('path');
const DIR = process.argv[2] || path.join(__dirname, 'traj');
const VENUE = process.argv[3] || 'arctic';
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const deg = r => Math.round(r * 180 / Math.PI);

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f.includes(VENUE)).sort();
for (const f of files) {
    const t = JSON.parse(fs.readFileSync(path.join(DIR, f)));
    const S = t.samples.filter(s => s[1] === 1);
    // pinned runs, same def as traj_report
    const runs = [];
    let rs = null;
    for (let i = 0; i < S.length; i++) {
        const s = S[i];
        const slow = s[5] < 0.3 && Array.isArray(s[14]) && s[14].length;
        if (slow && rs == null) rs = i;
        if (!slow && rs != null) {
            if (S[i][0] - S[rs][0] >= 3) runs.push([rs, i]);
            rs = null;
        }
    }
    if (!runs.length) continue;
    console.log(`\n${f}`);
    for (const [i0, i1] of runs) {
        const t0 = S[i0][0], t1 = S[i1][0];
        console.log(`  PIN t=${t0.toFixed(0)}..${t1.toFixed(0)} (${(t1 - t0).toFixed(1)}s) — escape mechanics (1s cadence, pin + 6s after):`);
        // sample at ~1s through pin and 6s beyond
        const iEnd = S.findIndex((s, k) => k > i1 && s[0] > t1 + 6);
        const seg = S.slice(Math.max(0, i0 - 10), iEnd < 0 ? S.length : iEnd);
        let lastP = null;
        const rows = [];
        for (const s of seg) {
            if (lastP != null && s[0] - lastP < 0.95) continue;
            lastP = s[0];
            const k = seg.indexOf(s);
            // course over ground from +/-0.5s neighbours
            const kA = Math.max(0, k - 5), kB = Math.min(seg.length - 1, k + 5);
            const dx = seg[kB][2] - seg[kA][2], dy = seg[kB][3] - seg[kA][3];
            const dist = Math.hypot(dx, dy);
            const cog = Math.atan2(dx, -dy); // game heading convention: 0=N, sin/x -cos/y
            const hdg = s[4];
            const hvsm = deg(norm(cog - hdg));
            // turn rate over same window
            const dtW = seg[kB][0] - seg[kA][0] || 1;
            const rot = deg(norm(seg[kB][4] - seg[kA][4])) / dtW;
            // nearest floe bearing/dist (bounding-circle approx is fine for bearing)
            let nf = null, nfd = Infinity;
            if (Array.isArray(s[14])) for (const g of s[14]) {
                const gx = g.length > 5 ? g[1] : g[0], gy = g.length > 5 ? g[2] : g[1];
                const d = Math.hypot(s[2] - gx, s[3] - gy);
                if (d < nfd) { nfd = d; nf = deg(norm(Math.atan2(gx - s[2], -(gy - s[3])) - hdg)); }
            }
            rows.push(`    t${s[0].toFixed(0).padStart(4)} spd ${s[5].toFixed(2)} hdg ${String(deg(hdg)).padStart(4)} cog-hdg ${String(hvsm).padStart(4)} rot ${String(Math.round(rot)).padStart(4)}°/s mv ${dist.toFixed(0).padStart(3)}u awa ${s[18] != null ? String(deg(s[18])).padStart(4) : '  ?'} aws ${s[19] != null ? s[19].toFixed(0) : '?'} floe@${nf != null ? String(nf).padStart(4) : '?'} d${nfd < Infinity ? nfd.toFixed(0) : '?'}`);
        }
        console.log(rows.join('\n'));
        // classification over the escape (pin end -> +4s)
        const esc = seg.filter(s => s[0] >= t1 - 0.5 && s[0] <= t1 + 4);
        if (esc.length >= 2) {
            const a = esc[0], b = esc[esc.length - 1];
            const dx = b[2] - a[2], dy = b[3] - a[3];
            const cog = Math.atan2(dx, -dy);
            const along = Math.cos(norm(cog - b[4]));
            const swing = Math.abs(deg(norm(b[4] - S[i0][4])));
            const cls = along < -0.3 ? 'BACK-OUT' : (swing > 45 && Math.hypot(dx, dy) < 60 ? 'ROTATE' : 'POWER');
            console.log(`    => escape class: ${cls} (along ${along.toFixed(2)}, hdg swing vs pin-start ${swing}°, moved ${Math.hypot(dx, dy).toFixed(0)}u in ${(b[0] - a[0]).toFixed(1)}s)`);
        }
    }
}
