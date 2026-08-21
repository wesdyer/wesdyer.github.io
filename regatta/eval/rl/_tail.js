// WHAT MAKES A BAD RACE BAD? (2026-08-14)
//
// The 1.1x goal needs 429 s removed across the ten median columns, and no single
// mechanism this campaign has landed is worth more than ~35 s. So the question that
// matters is whether the slow races are slow for ONE reason that repeats across
// venues — a cross-cutting failure mode pays everywhere at once.
//
// Same course, same code, same fleet: glowtide's p90 boat-race is 56 s worse than
// its p50. This splits every boat-race in a bench into its fastest and slowest
// quartiles and asks what actually differs. All of it is already recorded per
// boat-race by ocean_bench — leg times, up/down distance AND time, penalties, OCS,
// and contacts by type — so this is pure offline arithmetic on existing benches.
//
// ⚠️ `xtrk`/`xN` are dead columns (the controller has no `navTarget`; they have
// recorded 0 in every bench ever run) and are not reported.
// ⚠️ Quartiles WITHIN a seed-set, pooled across seeds: a boat-race is the unit.
//
//   node _tail.js <benchLabel> [benchLabel ...]      e.g. base_glowtide base_redrock
const fs = require('fs'), path = require('path');
const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const f1 = x => x == null ? '  -' : (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));

for (const label of process.argv.slice(2)) {
    const p = path.join(__dirname, `ocean_bench_${label}.json`);
    if (!fs.existsSync(p)) { console.log(`(missing ${label})`); continue; }
    const sets = JSON.parse(fs.readFileSync(p, 'utf8'));
    const R = [];
    for (const s of sets) for (const b of (s.info || [])) {
        if (b.fin == null) continue;
        const c = b.col || {};
        R.push({
            fin: b.fin, pen: b.pen || 0, ocs: b.ocs || 0,
            land: c.land || 0, boat: c.boat || 0, mark: c.mark || 0, bounds: c.bounds || 0,
            upD: b.upD || 0, upT: b.upT || 0, dnD: b.dnD || 0, dnT: b.dnT || 0,
            dist: (b.upD || 0) + (b.dnD || 0), legT: b.legT || {}
        });
    }
    if (R.length < 8) { console.log(`(${label}: only ${R.length} races)`); continue; }
    R.sort((a, b) => a.fin - b.fin);
    const k = Math.floor(R.length / 4);
    const F = R.slice(0, k), S = R.slice(-k);
    const col = (g, f) => med(g.map(f));

    console.log(`\n=== ${label} — ${R.length} boat-races, fastest quartile (n=${k}) vs slowest (n=${k}) ===`);
    console.log(`  finish            ${f1(col(F, r => r.fin))}  ->  ${f1(col(S, r => r.fin))}   (+${f1(col(S, r => r.fin) - col(F, r => r.fin))} s is what we are explaining)`);
    const rows = [
        ['land contacts', r => r.land], ['boat contacts', r => r.boat],
        ['mark contacts', r => r.mark], ['bounds', r => r.bounds],
        ['penalties', r => r.pen], ['OCS', r => r.ocs],
        ['upwind DIST', r => r.upD], ['upwind TIME', r => r.upT],
        ['downwind DIST', r => r.dnD], ['downwind TIME', r => r.dnT],
        ['total DIST', r => r.dist],
    ];
    for (const [nm, fn] of rows) {
        const a = col(F, fn), b = col(S, fn);
        const pct = a ? (100 * (b - a) / a) : null;
        console.log(`  ${nm.padEnd(17)} ${String(f1(a)).padStart(7)}  ->  ${String(f1(b)).padStart(7)}   ${pct == null ? '' : (pct >= 0 ? '+' : '') + pct.toFixed(0) + '%'}`);
    }
    // speed decomposition: is the slow quartile slower per unit distance, or longer?
    const fd = col(F, r => r.dist), sd = col(S, r => r.dist);
    const ft = col(F, r => r.upT + r.dnT), st = col(S, r => r.upT + r.dnT);
    if (fd && sd && ft && st) {
        const fv = fd / ft, sv = sd / st;
        const distTerm = (sd - fd) / fv, speedTerm = sd / sv - sd / fv;
        console.log(`  --- of the +${f1(st - ft)} s of sailing time: DISTANCE ${f1(distTerm)} s (${(100 * distTerm / (st - ft)).toFixed(0)}%)  SPEED ${f1(speedTerm)} s (${(100 * speedTerm / (st - ft)).toFixed(0)}%)`);
        console.log(`      (${f1(fv)} u/s fast quartile  ->  ${f1(sv)} u/s slow quartile)`);
    }
    // which leg opens the gap?
    const legs = [...new Set(R.flatMap(r => Object.keys(r.legT)))].map(Number).sort((a, b) => a - b);
    const segs = [];
    for (let i = 1; i < legs.length; i++) {
        const L = legs[i], P = legs[i - 1];
        const fa = med(F.map(r => (r.legT[L] ?? 0) - (r.legT[P] ?? 0)));
        const sa = med(S.map(r => (r.legT[L] ?? 0) - (r.legT[P] ?? 0)));
        segs.push([L, fa, sa, sa - fa]);
    }
    const tot = segs.reduce((t, s) => t + Math.max(0, s[3]), 0) || 1;
    console.log(`  --- where the gap opens (leg-by-leg, fast -> slow):`);
    for (const [L, fa, sa, d] of segs.sort((a, b) => b[3] - a[3]))
        console.log(`      leg ${L}: ${f1(fa)} -> ${f1(sa)}   +${f1(d)} s   ${(100 * Math.max(0, d) / tot).toFixed(0)}% of the gap`);
}
