// GIVE-WAY ENDGAME CLOSE TABLE: per venue, base (dfd*) vs candidate (gwe*)
// med/mean/best/fins + dirt, plus the ratio vs the owner's median refs
// (regatta-venue-table, fp-verified). Lake base = cmblk* (script.js is
// byte-identical 3f6e86d..f6488d7, so those anchors carry).
//   node _gwe_close_table.js
const fs = require('fs'); const path = require('path');
const HUMAN = { redrock: 216.7, arctic: 207.0, river: 167.8, swamp: 235.3,
    glowtide: 202.6, lagoon: 170.6, bay: 230.1, lake: 206.2, ocean: 213.9, seatrials: 185.6 };
const VENUES = {
    redrock: { base: ['dfdrr9400','dfdrr9500','dfdrr9600','dfdrr9700','dfdrr9800','dfdrr9900'],
               cand: ['gwerr9400','gwerr9500','gwerr9600','gwerr9700','gwerr9800','gwerr9900'] },
    arctic:  { base: ['dfdarc9400','dfdarc9600'], cand: ['gwearc9400','gwearc9600'] },
    river:   { base: ['dfdriv9400','dfdriv9408','dfdriv9500'], cand: ['gweriv9400','gweriv9408','gweriv9500'] },
    swamp:   { base: ['dfdsw9400','dfdsw9500','dfdsw9600'], cand: ['gwesw9400','gwesw9500','gwesw9600'] },
    glowtide:{ base: ['dfdglow'], cand: ['gweglow'] },
    lagoon:  { base: ['dfdlag'], cand: ['gwelag'] },
    bay:     { base: ['dfdbay9400','dfdbay9600'], cand: ['gwebay9400','gwebay9600'] },
    lake:    { base: ['dfdlk6100','dfdlk6200'], cand: ['gwelk6100','gwelk6200'] },
    ocean:   { base: ['dfdoc'], cand: ['gweoc'] },
    seatrials:{ base: ['dfdst'], cand: ['gwest'] },
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
