// OT CLOSE TABLE — THE OTTER PUSH (2026-09-14; derived from _vo_close_table.js).
// PRE = ot0* (every venue re-benched on the owner's HEAD fc56ade after the courseSig-v3 re-freeze;
// the old pa*/wbsw*/f3nd* anchors are RETIRED by that cut). POST = fo* on the FINAL HEAD.
//   node _ot_close_table.js



const fs = require('fs'); const path = require('path');
const HUMAN = { arctic: 209.4, bay: 239.0, lagoon: 174.7, lake: 194.8, ocean: 214.2, river: 187.4,
    glowtide: 204.4, redrock: 204.2, seatrials: 185.7, swamp: 173.3, volcanic: 195.5, otter: 200.8 };
const HUMAN_N = { arctic: 3, bay: 3, lagoon: 3, lake: 3, ocean: 3, river: 3, glowtide: 4, redrock: 3, seatrials: 10, swamp: 3, volcanic: 5, otter: 5 };
const VENUES = {
    arctic:   { base: ['ot0arc9100'], cand: ['foarc9100'], note: '8 @ 9100 both' },
    swamp:    { base: ['ot0sw9400'], cand: ['fosw9400'], note: '8 @ 9400 both' },
    redrock:  { base: ['ot0rr9400'], cand: ['forr9400'], note: '8 @ 9400 both' },
    river:    { base: ['ot0riv9400'], cand: ['foriv9400'], note: '8 @ 9400 both' },
    lagoon:   { base: ['ot0lag'], cand: ['folag'], note: '8 @ 9400 both' },
    volcanic: { base: ['ot0vo9400','ot0vo9500','ot0vo9600'], cand: ['fovo9400','fovo9500','fovo9600'], note: '3×8 both' },
    glowtide: { base: ['ot0glow'], cand: ['foglow'], note: '16 @ 9400 both' },
    bay:      { base: ['ot0bay9400'], cand: ['fobay9400'], note: '8 @ 9400 both' },
    lake:     { base: ['ot0lk6100'], cand: ['folk6100'], note: '8 @ 6100 both' },
    ocean:    { base: ['ot0oc'], cand: ['fooc'], note: '16 @ 9400 both' },
    seatrials:{ base: ['ot0st'], cand: ['fost'], note: '16 @ 9400 both' },
    otter:    { base: ['ot0ot9400','ot0ot9500','ot0ot9600'], cand: ['foot9400','foot9500','foot9600'], note: 'NEW venue; 3×8 both; his 5 laps stamp the frozen doc' },
};
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const load = (l) => { const f = path.join(__dirname, `ocean_bench_${l}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const stats = (labels) => {
    const fins = [], colPB = [], penPB = []; let n = 0, land = 0, boat = 0, floe = 0, mark = 0, pen = 0, missing = [];
    for (const l of labels) {
        const J = load(l); if (!J) { missing.push(l); continue; }
        for (const r of J) for (const b of r.info) {
            n++; if (b.fin != null) fins.push(b.fin);
            const c = b.col || {}; colPB.push(Object.values(c).reduce((x, y) => x + y, 0)); penPB.push(b.pen || 0);
            land += c.land || 0; boat += c.boat || 0; floe += c.floe || 0; mark += c.mark || 0; pen += b.pen || 0;
        }
    }
    return { med: med(fins), mean: mean(fins), best: fins.length ? Math.min(...fins) : NaN, fins: fins.length, n, dnf: n ? 100 * (1 - fins.length / n) : NaN,
             colMed: med(colPB), penMed: med(penPB), land: land / n, boat: boat / n, floe: floe / n, mark: mark / n, pen: pen / n, missing };
};
// byte-identity of the POST set against the PRE set that shares its seed0 (a verification)
const sameSeq = (baseLabels, candLabel) => {
    const C = load(candLabel); if (!C) return 'n/a';
    for (const bl of baseLabels) { const B = load(bl); if (!B || B[0].seed !== C[0].seed) continue;
        let same = 0; const n = Math.min(B.length, C.length); for (let i = 0; i < n; i++) if (JSON.stringify(B[i].info) === JSON.stringify(C[i].info)) same++;
        return `${same}/${n} vs ${bl}`; }
    return 'no shared seed0';
};
const rows = [];
for (const [v, cfg] of Object.entries(VENUES)) { const B = stats(cfg.base), C = stats(cfg.cand); rows.push({ v, cfg, B, C, ratio: C.med / HUMAN[v], ratioB: B.med / HUMAN[v] }); }
rows.sort((a, b) => b.ratio - a.ratio);
const f = (s) => `${s.med}/${isNaN(s.mean) ? '—' : s.mean.toFixed(1)}/${s.best}`;
console.log('| venue | human med (n) | PRE bot med/mean/best | POST bot med/mean/best | ratio pre → post | DNF% | col med/boat | pen med/boat | dirt l/b/f/m/pen (mean/boat, post) | fins post | byte-check |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    const C = r.C;
    console.log(`| ${r.v} | ${HUMAN[r.v]} (${HUMAN_N[r.v]}) | ${f(r.B)} | ${f(C)} | ${r.ratioB.toFixed(3)} → **${r.ratio.toFixed(3)}${r.ratio <= 1.05 ? ' ✅' : ''}** | ${C.dnf.toFixed(1)} | ${C.colMed} | ${C.penMed} | ${C.land.toFixed(2)}/${C.boat.toFixed(2)}/${C.floe.toFixed(2)}/${C.mark.toFixed(2)}/${C.pen.toFixed(2)} | ${C.fins}/${C.n} | ${sameSeq(r.cfg.base, r.cfg.cand[0])} |${C.missing.length ? ' MISSING ' + C.missing.join(',') : ''}`);
}
console.log('\nnotes:'); for (const r of rows) if (r.cfg.note) console.log(`  ${r.v}: ${r.cfg.note}`);
