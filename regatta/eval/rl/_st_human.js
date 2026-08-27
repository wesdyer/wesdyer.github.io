// HIS PRE-START, from the corpus (2026-08-27). The recordings carry phase 0 —
// the whole 30 s countdown is in every lap — so the human reference for the
// start is not just "he crosses 2.2 s after the gun", it is the trace of how he
// gets there. This prints his distance behind the line and his speed second by
// second, the same columns _st_branch.js prints for the fleet, so the two can be
// laid side by side. fp-filtered: only laps on the frozen benchmark document.
//   node _st_human.js <venue> [fp]
const fs = require('fs'), path = require('path');
const VENUE = process.argv[2] || 'river';
const FP = process.argv[3] || null;
const TD = path.join(__dirname, 'traj');
const files = fs.readdirSync(TD).filter(f => f.startsWith('traj_' + VENUE + '_'));
const rows = {};
let used = 0;
for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
    if (FP && String(j.venueFingerprint) !== FP) continue;
    if (!j.course || !j.course.startLine) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const [[ax, ay], [bx, by]] = j.course.startLine;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    // Sign it so that the boat is BEHIND the line before the gun: take the sign
    // from his own first racing sample (he is, by construction, on the pre-start
    // side at T-30 and across it once racing) rather than assuming a convention.
    const off = (x, y) => ((x - ax) * dy - (y - ay) * dx) / L;
    const pre = j.samples.filter(s => gi(s, 'phase') === 0);
    if (!pre.length) continue;
    const sgn = off(gi(pre[0], 'x'), gi(pre[0], 'y')) > 0 ? 1 : -1;
    used++;
    for (const s of pre) {
        const t = Math.round(gi(s, 't'));
        (rows[t] = rows[t] || []).push({
            behind: sgn * off(gi(s, 'x'), gi(s, 'y')),
            kt: gi(s, 'spd') * 4,
            cur: (gi(s, 'current') || [0, 0]),
        });
    }
}
const med = a => { const z = [...a].sort((x, y) => x - y); return z.length ? z[Math.floor(z.length / 2)] : NaN; };
const ts = Object.keys(rows).map(Number).sort((a, b) => b - a);
console.log(`\n══ HIS pre-start — ${VENUE}, ${used} fp-valid lap(s)`);
console.log('   T-  behind(u)   kt');
for (const t of ts) console.log(`   ${String(t).padStart(2)}  ${med(rows[t].map(r => r.behind)).toFixed(0).padStart(8)}  ${med(rows[t].map(r => r.kt)).toFixed(2).padStart(5)}`);
