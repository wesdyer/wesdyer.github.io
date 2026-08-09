// Pooled paired arctic comparison across the 4 disjoint sets (A/B/C/D =
// 9100/9200/9300/9400), per-set spread printed beside the pooled figure
// (rule 20's shape, arctic edition).
// node _pool_arc.js <expPrefix> <basePrefix>   e.g. _pool_arc.js sz1arc fl1barc
const fs = require('fs'); const path = require('path');
const EXP = process.argv[2], BASE = process.argv[3];
const SETS = ['A', 'B', 'C', 'D'];
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const load = l => JSON.parse(fs.readFileSync(path.join(__dirname, 'fleet_leg2_' + l + '.json')));
const meta = l => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'fleet_leg2_' + l + '.meta.json'))); } catch (e) { return null; } };
let allD = [], totFinE = 0, totFinB = 0, totN = 0, aOnly = 0, bOnly = 0;
const dirt = { exp: {}, base: {} };
const addDirt = (tgt, b) => {
    for (const k of ['boat', 'mark', 'land', 'floe', 'bounds']) if (b.col && b.col[k]) tgt[k] = (tgt[k] || 0) + b.col[k];
    if (b.pen) tgt.pen = (tgt.pen || 0) + b.pen;
};
for (const s of SETS) {
    let A, B;
    try { A = load(EXP + s); B = load(BASE + s); } catch (e) { console.log('set', s, 'MISSING', e.message); continue; }
    const mA = meta(EXP + s), mB = meta(BASE + s);
    if (mA && mB && mA.fingerprint !== mB.fingerprint) { console.log('set', s, 'FINGERPRINT MISMATCH', mA.fingerprint, mB.fingerprint); continue; }
    const bf = new Map();
    for (const run of B) for (const b of run.info) bf.set(run.seed + ':' + b.name, b);
    const d = []; let finE = 0, finB = 0, n = 0;
    const meds = { e: [], b: [] };
    for (const run of A) for (const b of run.info) {
        n++; totN++;
        const o = bf.get(run.seed + ':' + b.name);
        addDirt(dirt.exp, b);
        if (o) addDirt(dirt.base, o);
        if (b.fin) { finE++; totFinE++; meds.e.push(b.fin); }
        if (o && o.fin) { finB++; totFinB++; meds.b.push(o.fin); }
        if (!o) continue;
        if (b.fin && o.fin) { d.push(o.fin - b.fin); allD.push(o.fin - b.fin); }
        else if (b.fin && !o.fin) aOnly++;
        else if (!b.fin && o.fin) bOnly++;
    }
    console.log(`set ${s}: pairs ${d.length}  paired med ${med(d)}  mean ${mean(d).toFixed(1)}  fins ${finB}->${finE}  meds ${med(meds.b)}->${med(meds.e)}`);
}
console.log(`\nPOOLED: pairs ${allD.length}  paired med ${med(allD)}  mean ${mean(allD).toFixed(1)}  fins ${totFinB}->${totFinE}  expOnlyFin ${aOnly}  baseOnlyFin ${bOnly}`);
console.log('dirt base:', JSON.stringify(dirt.base), '\ndirt exp :', JSON.stringify(dirt.exp));
