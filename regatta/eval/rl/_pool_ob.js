// POOLED PAIRED COMPARISON over ocean_bench JSONs (2026-08-22, arctic router
// push). Pairs boats by (seed, name) across any number of label pairs and
// pools the paired deltas — the arctic 2x16 POOLED 32 gate's arithmetic in
// one place, with the per-set spread printed beside the pooled figure
// (rule 20's shape).
//
//   node _pool_ob.js <candLabels,comma> <baseLabels,comma>
//   e.g. node _pool_ob.js c2arc9400,c2arc9600 n4arc9400,n4arc9600
//
// SIGN: reports cand - base — NEGATIVE = candidate faster (the _pool_rr
// convention; the header restates it so nobody reads it blind — rule 21/21b).
const fs = require('fs'); const path = require('path');
const CAND = (process.argv[2] || '').split(','), BASE = (process.argv[3] || '').split(',');
if (CAND.length !== BASE.length || !CAND[0] || !BASE[0]) {
    console.log('usage: node _pool_ob.js <candLabels,comma> <baseLabels,comma>'); process.exit(1);
}
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const load = l => JSON.parse(fs.readFileSync(path.join(__dirname, `ocean_bench_${l}.json`)));
const meta = l => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, `ocean_bench_${l}.meta.json`))); } catch (e) { return null; } };
let allD = [], candFins = [], baseFins = [], nCF = 0, nBF = 0, nTot = 0, candOnly = 0, baseOnly = 0;
const dirt = { cand: {}, base: {} };
const addDirt = (t, b) => {
    for (const k of ['boat', 'mark', 'land', 'floe', 'bounds']) t[k] = (t[k] || 0) + ((b.col && b.col[k]) || 0);
    t.pen = (t.pen || 0) + (b.pen || 0); t.n = (t.n || 0) + 1;
};
console.log('SIGN: cand - base; NEGATIVE = candidate faster\n');
for (let i = 0; i < CAND.length; i++) {
    const mC = meta(CAND[i]), mB = meta(BASE[i]);
    if (mC && mB && mC.fingerprint !== mB.fingerprint) { console.log(`set ${CAND[i]} FP MISMATCH ${mC.fingerprint} vs ${mB.fingerprint}`); continue; }
    const C = load(CAND[i]), B = load(BASE[i]);
    const dSet = [];
    for (let ri = 0; ri < Math.min(C.length, B.length); ri++) {
        const bi = {}; for (const b of B[ri].info) bi[b.name] = b;
        for (const c of C[ri].info) {
            const b = bi[c.name]; if (!b) continue;
            nTot++;
            addDirt(dirt.cand, c); addDirt(dirt.base, b);
            if (c.fin != null) { candFins.push(c.fin); nCF++; }
            if (b.fin != null) { baseFins.push(b.fin); nBF++; }
            if (c.fin != null && b.fin != null) { dSet.push(c.fin - b.fin); }
            else if (c.fin != null) candOnly++;
            else if (b.fin != null) baseOnly++;
        }
    }
    allD.push(...dSet);
    console.log(`set ${CAND[i]} vs ${BASE[i]}: n ${dSet.length}  paired med ${med(dSet).toFixed(1)}  mean ${mean(dSet).toFixed(1)}`);
}
console.log(`\nPOOLED: n ${allD.length}  paired med ${med(allD).toFixed(1)}  mean ${mean(allD).toFixed(1)}`);
console.log(`fins: cand ${nCF}/${nTot}  base ${nBF}/${nTot}   cand-only fins ${candOnly}  base-only ${baseOnly}`);
console.log(`fin med: cand ${med(candFins)}  base ${med(baseFins)}   fin mean: cand ${mean(candFins).toFixed(1)}  base ${mean(baseFins).toFixed(1)}`);
const f = (t) => `boat ${(t.boat / t.n).toFixed(2)} mark ${(t.mark / t.n).toFixed(2)} land ${(t.land / t.n).toFixed(2)} floe ${(t.floe / t.n).toFixed(2)} bounds ${(t.bounds / t.n).toFixed(2)} pen ${(t.pen / t.n).toFixed(2)}`;
console.log(`dirt/boat: cand ${f(dirt.cand)}`);
console.log(`           base ${f(dirt.base)}`);
