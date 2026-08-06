// Paired bench comparison: same seeds, same boats, candidate minus baseline.
// Usage: node paired_compare.js <baseline.json> <candidate.json>
// Works on bay_bench / fleet_leg2 / ocean_bench / gauntlet_bench output arrays.
const fs = require('fs');
const [A, B] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const label = process.argv.slice(2).map(f => f.replace(/^.*\//, ''));

const bySeed = arr => Object.fromEntries(arr.map(t => [t.seed, t]));
const bA = bySeed(A), bB = bySeed(B);
const seeds = Object.keys(bA).filter(s => bB[s]);

const deltas = [], finsA = [], finsB = [];
let colA = { boat: 0, mark: 0, land: 0, floe: 0 }, colB = { boat: 0, mark: 0, land: 0, floe: 0 };
let penA = 0, penB = 0, nA = 0, nB = 0, finCA = 0, finCB = 0;
for (const s of seeds) {
  const mapB = Object.fromEntries(bB[s].info.map(b => [b.name, b]));
  for (const a of bA[s].info) {
    const b = mapB[a.name];
    if (!b) continue;
    nA++; nB++;
    penA += a.pen || 0; penB += b.pen || 0;
    for (const k of Object.keys(colA)) { colA[k] += (a.col && a.col[k]) || 0; colB[k] += (b.col && b.col[k]) || 0; }
    if (a.fin != null) { finsA.push(a.fin); finCA++; }
    if (b.fin != null) { finsB.push(b.fin); finCB++; }
    if (a.fin != null && b.fin != null) deltas.push(b.fin - a.fin);
  }
}
const q = (arr, p) => { const s = arr.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
console.log(`baseline  ${label[0]}: n=${nA} finishers=${finCA} fin med=${q(finsA, 0.5).toFixed(1)} mean=${mean(finsA).toFixed(1)} pen/boat=${(penA / nA).toFixed(2)} col b/m/l/f=${(colA.boat / nA).toFixed(2)}/${(colA.mark / nA).toFixed(2)}/${(colA.land / nA).toFixed(2)}/${(colA.floe / nA).toFixed(2)}`);
console.log(`candidate ${label[1]}: n=${nB} finishers=${finCB} fin med=${q(finsB, 0.5).toFixed(1)} mean=${mean(finsB).toFixed(1)} pen/boat=${(penB / nB).toFixed(2)} col b/m/l/f=${(colB.boat / nB).toFixed(2)}/${(colB.mark / nB).toFixed(2)}/${(colB.land / nB).toFixed(2)}/${(colB.floe / nB).toFixed(2)}`);
console.log(`PAIRED (cand-base) n=${deltas.length}: med=${q(deltas, 0.5).toFixed(1)} mean=${mean(deltas).toFixed(1)} p25=${q(deltas, 0.25).toFixed(1)} p75=${q(deltas, 0.75).toFixed(1)}`);
