// Paired comparison of two fleet_leg2 JSONs (boats matched by name per seed).
//   node rl_pair.js fleet_leg2_gapfc.json fleet_leg2_rl.json
// Prints per-side totals + paired leg-1/leg-2/finish deltas (median/mean).
const fs = require('fs'); const path = require('path');
const A = JSON.parse(fs.readFileSync(path.join(__dirname, process.argv[2]), 'utf8'));
const B = JSON.parse(fs.readFileSync(path.join(__dirname, process.argv[3]), 'utf8'));

function totals(side) {
    let rounders = 0, fins = 0, n = 0; const finT = [];
    for (const race of side) for (const b of race.info) {
        n++;
        if (b.legT[2] != null) rounders++;
        if (b.fin != null) { fins++; finT.push(b.fin); }
    }
    finT.sort((x, y) => x - y);
    return { rounders, fins, n, finMed: finT.length ? finT[Math.floor(finT.length / 2)] : null };
}
function med(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }

const tA = totals(A), tB = totals(B);
console.log(`A (${process.argv[2]}): rounders ${tA.rounders}/${tA.n}, finishers ${tA.fins}, finMed ${tA.finMed}`);
console.log(`B (${process.argv[3]}): rounders ${tB.rounders}/${tB.n}, finishers ${tB.fins}, finMed ${tB.finMed}`);

// Paired deltas (B - A), matched by (seed, boat name).
const d1 = [], d2 = [], dFin = [], dArm = [], dSweepPhase = [];
for (const raceA of A) {
    const raceB = B.find(r => r.seed === raceA.seed);
    if (!raceB) continue;
    for (const a of raceA.info) {
        const b = raceB.info.find(x => x.name === a.name);
        if (!b) continue;
        // leg-1 time = t(leg2 entered) - t(leg1 entered); finish - t(leg2) = leg 2
        if (a.legT[2] != null && b.legT[2] != null && a.legT[1] != null && b.legT[1] != null)
            d1.push((b.legT[2] - b.legT[1]) - (a.legT[2] - a.legT[1]));
        if (a.fin != null && b.fin != null && a.legT[2] != null && b.legT[2] != null)
            d2.push((b.fin - b.legT[2]) - (a.fin - a.legT[2]));
        if (a.fin != null && b.fin != null) dFin.push(b.fin - a.fin);
        if (a.tArm != null && b.tArm != null && a.tOut != null && b.tOut != null)
            dSweepPhase.push((b.tOut - b.tArm) - (a.tOut - a.tArm));
    }
}
console.log(`paired leg-1 delta (n=${d1.length}): med ${med(d1)} mean ${mean(d1) && mean(d1).toFixed(1)}`);
console.log(`paired sweep-phase (tOut-tArm) delta (n=${dSweepPhase.length}): med ${med(dSweepPhase)} mean ${mean(dSweepPhase) && mean(dSweepPhase).toFixed(1)}`);
console.log(`paired leg-2 delta (n=${d2.length}): med ${med(d2)} mean ${mean(d2) && mean(d2).toFixed(1)}`);
console.log(`paired finish delta (n=${dFin.length}): med ${med(dFin)} mean ${mean(dFin) && mean(dFin).toFixed(1)}`);
