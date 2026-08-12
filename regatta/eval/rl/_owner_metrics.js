// THE FOUR NUMBERS THE OWNER ACTUALLY JUDGES ON (2026-08-10)
//
// Owner, verbatim in substance: "I care most about median finish, mean finish,
// best finish, % finish" — and, of the dirt columns, "the other numbers help
// drive down those numbers", i.e. land/boat/penalty counts are DIAGNOSTICS that
// explain a finish-time move, not goals in their own right. He also noted that
// `MAX_LAND_PER_RACE = 120` in check_raceable was set by a prior iteration, not
// by him, so a land-contact threshold is not a bar to clear.
//
// So score a candidate the way he scores it, pooled across seeds/sets:
//   MEDIAN finish   over finishers
//   MEAN   finish   over finishers
//   BEST   finish   (the fleet's fastest boat — is the ceiling rising?)
//   % FINISH        of all boat-slots, DNFs included
// plus the dirt columns underneath, explicitly labelled as explanation.
//
// ⚠️ % finish and the time columns move together and can mislead in opposite
// directions: rescuing slow boats RAISES the median because those boats join
// the pool. Both are printed so that trade is visible rather than hidden.
//
//   node _owner_metrics.js <baseLabel> <candLabel> [sets...]
const fs = require('fs'); const path = require('path');
const [BASE, CAND] = process.argv.slice(2, 4);
const SETS = process.argv.slice(4).length ? process.argv.slice(4) : [''];

const load = (l, s) => {
    const f = path.join(__dirname, `ocean_bench_${l}${s}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const collect = (label) => {
    const fins = [], all = [];
    let land = 0, boat = 0, mark = 0, pen = 0, n = 0;
    for (const s of SETS) {
        const j = load(label, s);
        if (!j) { console.log(`  (missing ocean_bench_${label}${s}.json)`); continue; }
        for (const k of Object.keys(j)) {
            const e = j[k]; if (!e || !e.info) continue;
            for (const b of e.info) {
                n++; all.push(b);
                if (b.fin != null && b.fin > 0) fins.push(b.fin);
                const c = b.col || {};
                land += c.land || 0; boat += c.boat || 0; mark += c.mark || 0;
                pen += b.pen || 0;
            }
        }
    }
    return { fins, n, land, boat, mark, pen };
};
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

const B = collect(BASE), C = collect(CAND);
const row = (name, b, c, unit, lowerBetter = true) => {
    const d = c - b;
    const better = lowerBetter ? d < 0 : d > 0;
    const tag = Math.abs(d) < 1e-9 ? '  =  ' : (better ? ' BETTER' : ' worse ');
    console.log(`  ${name.padEnd(16)} ${b.toFixed(1).padStart(8)} ${unit}  ->  ${c.toFixed(1).padStart(8)} ${unit}   ${(d >= 0 ? '+' : '') + d.toFixed(1)}${tag}`);
};

console.log(`\n=== ${BASE} -> ${CAND}   (${SETS.length} set(s), ${B.n} vs ${C.n} boat-slots) ===`);
console.log(`\n  THE FOUR THAT COUNT`);
row('median finish', med(B.fins), med(C.fins), 's');
row('mean finish', mean(B.fins), mean(C.fins), 's');
row('best finish', Math.min(...B.fins), Math.min(...C.fins), 's');
row('% finish', 100 * B.fins.length / B.n, 100 * C.fins.length / C.n, '%', false);
console.log(`\n  WHY (diagnostics, per boat-race — these drive the four above)`);
row('land contacts', B.land / B.n, C.land / C.n, ' ');
row('boat contacts', B.boat / B.n, C.boat / C.n, ' ');
row('mark contacts', B.mark / B.n, C.mark / C.n, ' ');
row('penalties', B.pen / B.n, C.pen / C.n, ' ');
console.log(`\n  finishers ${B.fins.length}/${B.n}  ->  ${C.fins.length}/${C.n}`);
