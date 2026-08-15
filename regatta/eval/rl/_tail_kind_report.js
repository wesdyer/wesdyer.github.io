// ANALYZER for _tail_kind.js — the tail discriminator's verdict.
//
// Splits finisher boat-races into fastest/slowest quartiles (pooled, as _tail.js)
// and compares land-contact EPISODE STRUCTURE between them. The decision rule is
// stated in _tail_kind.js and was fixed before the collection ran.
//
//   node _tail_kind_report.js <label> [label ...]
const fs = require('fs'), path = require('path');
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const med = a => q(a, 0.5);
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const f1 = x => x == null ? '  -' : (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));

for (const label of process.argv.slice(2)) {
    const p = path.join(__dirname, `_tailkind_${label}.json`);
    if (!fs.existsSync(p)) { console.log(`(missing ${label})`); continue; }
    const sets = JSON.parse(fs.readFileSync(p, 'utf8'));
    const R = [];
    for (const s of sets) for (const b of (s.info || [])) {
        if (b.fin == null) continue;
        // per-race episode post-processing
        const eps = b.eps.map(e => ({ ...e, dur: +(e.t1 - e.t0 + 1 / 60).toFixed(2) }));
        // spatial re-hit: episode starting within 120u of ANY earlier episode this race
        for (let i = 0; i < eps.length; i++) {
            eps[i].rehit = 0;
            for (let j = 0; j < i; j++) {
                const dx = eps[i].x - eps[j].x, dy = eps[i].y - eps[j].y;
                if (dx * dx + dy * dy < 120 * 120) { eps[i].rehit = 1; break; }
            }
        }
        R.push({
            fin: b.fin, pen: b.pen, eps,
            nEp: eps.length,
            contactT: +eps.reduce((t, e) => t + e.dur, 0).toFixed(1),
            maxDur: eps.length ? Math.max(...eps.map(e => e.dur)) : 0,
            long3: eps.filter(e => e.dur >= 3).length,
            long5: eps.filter(e => e.dur >= 5).length,
            rehits: eps.filter(e => e.rehit).length,
            rehitT: +eps.filter(e => e.rehit).reduce((t, e) => t + e.dur, 0).toFixed(1),
            slow15: b.slow15, slow30: b.slow30, slowNear: b.slowNear,
        });
    }
    if (R.length < 8) { console.log(`(${label}: only ${R.length} finisher races)`); continue; }
    R.sort((a, b) => a.fin - b.fin);
    const k = Math.floor(R.length / 4);
    const F = R.slice(0, k), S = R.slice(-k);
    const finGap = med(S.map(r => r.fin)) - med(F.map(r => r.fin));

    console.log(`\n=== ${label}: ${R.length} finisher boat-races, fast n=${k} vs slow n=${k} ===`);
    console.log(`  finish med          ${f1(med(F.map(r => r.fin)))} -> ${f1(med(S.map(r => r.fin)))}   gap ${f1(finGap)} s`);
    const row = (nm, fn) => console.log(`  ${nm.padEnd(20)} ${String(f1(med(F.map(fn)))).padStart(6)} -> ${String(f1(med(S.map(fn)))).padStart(6)}   (mean ${f1(mean(F.map(fn)))} -> ${f1(mean(S.map(fn)))})`);
    row('episodes/race', r => r.nEp);
    row('contact TIME/race', r => r.contactT);
    row('max ep dur/race', r => r.maxDur);
    row('eps >=3s /race', r => r.long3);
    row('eps >=5s /race', r => r.long5);
    row('re-hits/race', r => r.rehits);
    row('re-hit TIME/race', r => r.rehitT);
    row('slow15 s/race', r => r.slow15);
    row('slow30 s/race', r => r.slow30);
    row('slowNearLand s/race', r => r.slowNear);

    // EPISODE-LEVEL duration distributions — the (a) test
    const Fd = F.flatMap(r => r.eps.map(e => e.dur)), Sd = S.flatMap(r => r.eps.map(e => e.dur));
    console.log(`  --- episode DURATION distribution (episode-level, n ${Fd.length} vs ${Sd.length}):`);
    console.log(`      fast  p25 ${f1(q(Fd, .25))}  med ${f1(med(Fd))}  p75 ${f1(q(Fd, .75))}  p90 ${f1(q(Fd, .9))}  p99 ${f1(q(Fd, .99))}  max ${f1(q(Fd, 1))}`);
    console.log(`      slow  p25 ${f1(q(Sd, .25))}  med ${f1(med(Sd))}  p75 ${f1(q(Sd, .75))}  p90 ${f1(q(Sd, .9))}  p99 ${f1(q(Sd, .99))}  max ${f1(q(Sd, 1))}`);
    console.log(`      TEST (a): slow med ${f1(med(Sd))} vs fast p75 ${f1(q(Fd, .75))}  ${med(Sd) > q(Fd, .75) ? 'SEPARATES' : 'overlaps'}`);
    const f5 = Fd.filter(d => d >= 5).length / Math.max(1, Fd.length), s5 = Sd.filter(d => d >= 5).length / Math.max(1, Sd.length);
    console.log(`      >=5s class: fast ${(100 * f5).toFixed(1)}% of episodes, slow ${(100 * s5).toFixed(1)}%`);

    // (b) repetition
    const fReh = mean(F.map(r => r.nEp ? r.rehits / r.nEp : 0)), sReh = mean(S.map(r => r.nEp ? r.rehits / r.nEp : 0));
    const sRehT = mean(S.map(r => r.contactT ? r.rehitT / r.contactT : 0));
    console.log(`  --- TEST (b): re-hit share fast ${(100 * fReh).toFixed(0)}% vs slow ${(100 * sReh).toFixed(0)}% (${fReh > 0 ? (sReh / fReh).toFixed(1) : 'inf'}x); re-hit time share of slow contact time ${(100 * sRehT).toFixed(0)}%`);

    // (c) stuck-near-land share of the gap
    const dNear = med(S.map(r => r.slowNear)) - med(F.map(r => r.slowNear));
    console.log(`  --- TEST (c): slowNearLand delta ${f1(dNear)} s = ${(100 * dNear / finGap).toFixed(0)}% of the ${f1(finGap)} s gap`);

    // where the slow quartile's contact time lives, by leg
    const legT = {};
    for (const r of S) for (const e of r.eps) legT[e.leg] = (legT[e.leg] || 0) + e.dur;
    const totLegT = Object.values(legT).reduce((a, b) => a + b, 0) || 1;
    console.log(`  --- slow-quartile contact time by leg: ` + Object.entries(legT).sort((a, b) => b[1] - a[1]).map(([l, t]) => `leg${l} ${(100 * t / totLegT).toFixed(0)}%`).join('  '));
}
