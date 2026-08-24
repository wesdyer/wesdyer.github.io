// ARCTIC-ROUTER CLOSE TABLE: base = n4*/n5sw* (the narrow-passage anchors), cand = ar1*/c2v3arc* (this HEAD)
// med/mean/best/fins + dirt, plus the ratio vs the owner's median refs
// (regatta-venue-table, fp-verified). Lake base = cmblk* (script.js is
// byte-identical 3f6e86d..f6488d7, so those anchors carry).
//   node _np_close_table.js
const fs = require('fs'); const path = require('path');
const HUMAN = { redrock: 216.7, arctic: 207.0, river: 167.8, swamp: 235.3,
    glowtide: 202.6, lagoon: 170.6, bay: 230.1, lake: 206.2, ocean: 213.9, seatrials: 185.6 };
const VENUES = {
    redrock: { base: ['ar1rr9400','ar1rr9500','ar1rr9600','ar1rr9700','ar1rr9800','ar1rr9900'], cand: ['c4rr9400','c4rr9500','c4rr9600','c4rr9700','c4rr9800','c4rr9900'] },
    arctic:  { base: ['c2v3arc9400','c2v3arc9600'], cand: ['d3barc9400','d3barc9600'] },
    river:   { base: ['ar1riv9400','ar1riv9408','ar1riv9500'], cand: ['c4riv9400','c4riv9408','c4riv9500'] },
    swamp:   { base: ['ar1sw9400','ar1sw9500','ar1sw9600'], cand: ['c4sw9400','c4sw9500','c4sw9600'] },
    glowtide:{ base: ['ar1glow'], cand: ['c4glow'] },
    lagoon:  { base: ['ar1lag'], cand: ['c4lag'] },
    bay:     { base: ['ar1bay9400','ar1bay9600'], cand: ['c4bay9400','c4bay9600'] },
    lake:    { base: ['ar1lk6100','ar1lk6200'], cand: ['c4lk6100','c4lk6200'] },
    ocean:   { base: ['ar1oc'], cand: ['c4oc'] },
    seatrials:{ base: ['ar1st'], cand: ['c4st'] },
};
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const stats = (labels) => {
    const fins = []; let n = 0, land = 0, boat = 0, pen = 0, missing = [];
    for (const l of labels) {
        const f = path.join(__dirname, `ocean_bench_${l}.json`);
        if (!fs.existsSync(f)) { missing.push(l); continue; }
        for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
            for (const b of r.info) {
                n++;
                if (b.fin != null) fins.push(b.fin);
                land += (b.col && b.col.land) || 0; boat += (b.col && b.col.boat) || 0;
                pen += b.pen || 0;
            }
        }
    }
    return { med: med(fins), mean: mean(fins), best: Math.min(...fins), fins: fins.length, n,
             land: land / n, boat: boat / n, pen: pen / n, missing };
};
const rows = [];
for (const [v, cfg] of Object.entries(VENUES)) {
    const B = stats(cfg.base), C = stats(cfg.cand);
    rows.push({ v, B, C, ratio: C.med / HUMAN[v], ratioB: B.med / HUMAN[v] });
}
rows.sort((a, b) => b.ratio - a.ratio);
console.log('venue      | his med | base med/mean best fins        | cand med/mean best fins        | ratio B->C | dirt l/b/pen B -> C');
for (const r of rows) {
    const f = (s) => `${s.med}/${s.mean.toFixed(1)} ${s.best} ${s.fins}/${s.n}(${(100 * s.fins / s.n).toFixed(1)}%)`;
    console.log(`${r.v.padEnd(10)} | ${String(HUMAN[r.v]).padStart(6)} | ${f(r.B).padEnd(30)} | ${f(r.C).padEnd(30)} | ${r.ratioB.toFixed(3)}->${r.ratio.toFixed(3)} | ${r.B.land.toFixed(2)}/${r.B.boat.toFixed(2)}/${r.B.pen.toFixed(2)} -> ${r.C.land.toFixed(2)}/${r.C.boat.toFixed(2)}/${r.C.pen.toFixed(2)}`);
    if (r.B.missing.length || r.C.missing.length) console.log(`  MISSING: ${[...r.B.missing, ...r.C.missing].join(', ')}`);
}
