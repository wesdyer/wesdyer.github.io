// SWAMP VERDICT: paired per-boat comparison against the baseline (2026-08-10).
//
// Gatorgrass is a HIGH-DNF venue — 19 of 72 boats miss the 900 s cutoff on HEAD —
// so a finisher-only median flatters any candidate that merely reorders the tail,
// and a mean over finishers is worse still. Three columns are therefore reported
// together and none of them alone is the verdict:
//   * FINISHERS, which is the raceability question the gate actually failed;
//   * the paired per-boat delta over boats that finished in BOTH trees, which is
//     the only clock comparison where the same boat is on both sides;
//   * DNF-at-900, quoted beside the median exactly as the redrock protocol demands.
//
// ⚠️ A boat that DNFs in one tree and finishes in the other cannot enter the paired
// column at all, so the paired median is blind to precisely the boats a raceability
// fix is meant to rescue. That is why finishers is printed FIRST.
//
//   node _swp_verdict.js <baseLabel> <candLabel> [...more cands]
const fs = require('fs'); const path = require('path');
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const load = (l) => {
    const f = path.join(__dirname, `ocean_bench_${l}.json`);
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
};
const flat = (j) => { const m = {}; for (const s of j) for (const k of Object.keys(s.info)) m[s.seed + '|' + s.info[k].name] = s.info[k]; return m; };

const BASE = process.argv[2], CANDS = process.argv.slice(3);
const bj = load(BASE);
if (!bj) { console.error('no baseline ' + BASE); process.exit(1); }
const bm = flat(bj);
const bAll = Object.values(bm);
const bFin = bAll.filter(x => x.fin != null).map(x => x.fin);
console.log(`\n=== SWAMP VERDICT vs ${BASE} (human med 219.5) ===`);
console.log(`${'tree'.padEnd(10)} ${'boats'.padStart(5)} ${'fin'.padStart(4)} ${'DNF@900'.padStart(8)} ${'med'.padStart(6)} ${'mean'.padStart(7)} ${'p90'.padStart(6)} ${'ratio'.padStart(6)}   paired(n) med / mean`);
const row = (label, j) => {
    const m = flat(j), all = Object.values(m);
    const fin = all.filter(x => x.fin != null).map(x => x.fin);
    const pairs = [];
    for (const k of Object.keys(bm)) {
        const a = bm[k], b = m[k];
        if (a && b && a.fin != null && b.fin != null) pairs.push(b.fin - a.fin);
    }
    console.log(`${label.padEnd(10)} ${String(all.length).padStart(5)} ${String(fin.length).padStart(4)} ${String(all.length - fin.length).padStart(8)}` +
        ` ${q(fin, 0.5).toFixed(0).padStart(6)} ${mean(fin).toFixed(1).padStart(7)} ${q(fin, 0.9).toFixed(0).padStart(6)}` +
        ` ${(q(fin, 0.5) / 219.5).toFixed(2).padStart(5)}x   ${String(pairs.length).padStart(3)}  ${pairs.length ? q(pairs, 0.5).toFixed(1).padStart(7) : '   -   '} / ${pairs.length ? mean(pairs).toFixed(1) : '-'}`);
    return { all, fin, pairs };
};
row(BASE, bj);
for (const c of CANDS) { const j = load(c); if (!j) { console.log(`${c.padEnd(10)}  (missing)`); continue; } row(c, j); }

// dirt columns
console.log(`\n${'tree'.padEnd(10)} land/boat  boat/boat  mark/boat  pen/boat   Q4 mean finish   leg0 mean (her 1.4s, 26.94x)`);
const dirt = (label, j) => {
    const all = Object.values(flat(j));
    const d = k => all.reduce((a, b) => a + ((b.col && b.col[k]) || 0), 0) / all.length;
    const fin = all.filter(x => x.fin != null).map(x => x.fin).sort((a, b) => a - b);
    const q4 = fin.slice(Math.floor(0.75 * fin.length));
    // leg 0 is the START. The stuck timer also drives the leg-0 liveness states
    // (force/recovery at 5 s / 10 s), so a fix to the timer should show here too —
    // and swamp's leg 0 is the worst leg-0 the campaign has measured at 26.94x.
    const l0 = all.map(b => (b.legT && b.legT['0'] != null) ? b.legT['0'] : null).filter(x => x != null);
    console.log(`${label.padEnd(10)} ${d('land').toFixed(2).padStart(9)} ${d('boat').toFixed(2).padStart(10)} ${d('mark').toFixed(2).padStart(10)}` +
        ` ${(all.reduce((a, b) => a + (b.pen || 0), 0) / all.length).toFixed(2).padStart(9)}   ${mean(q4).toFixed(0).padStart(14)}   ${l0.length ? mean(l0).toFixed(1) : '-'}`);
};
dirt(BASE, bj);
for (const c of CANDS) { const j = load(c); if (j) dirt(c, j); }
console.log(`\n⚠️ read FINISHERS first: a paired median cannot see a boat that DNFs on one side.`);
