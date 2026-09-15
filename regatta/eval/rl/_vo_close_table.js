// VO CLOSE TABLE — THE VOLCANO PUSH (2026-09-13; derived from _wb_close_table.js).
// PRE = the anchors at session open: pa* (eight venues), wbsw* (swamp, the +0.75 kt doc),
// vo0vo* (volcanic, benched this session on HEAD 1a33a12 == em*). POST = fresh benches on
// the FINAL HEAD (869acaa, F3 landed): fv* on the ten carried venues (an unchanged venue's
// number is a verification — F3 is state.volcano-guarded and the goldens verify passed
// 30/30 with 0 behaviour changes) and vf3vo* on volcanic.
//   node _vo_close_table.js
const fs = require('fs'); const path = require('path');
const HUMAN = { arctic: 209.4, bay: 239.0, lagoon: 174.7, lake: 194.8, ocean: 214.2, river: 187.4,
    glowtide: 204.4, redrock: 204.2, seatrials: 185.7, swamp: 173.3, volcanic: 195.5 };
const HUMAN_N = { arctic: 3, bay: 3, lagoon: 3, lake: 3, ocean: 3, river: 3, glowtide: 4, redrock: 3, seatrials: 10, swamp: 3, volcanic: 5 };
const VENUES = {
    arctic:   { base: ['paarc9100','paarc9200','paarc9400','paarc9600'], cand: ['fvarc9100'], note: 'POST = one 8-seed set (9100) on the final HEAD; PRE pooled 32' },
    swamp:    { base: ['wbsw9400','wbsw9500','wbsw9600'], cand: ['fvsw9400'], note: 'POST = set 9400 only' },
    redrock:  { base: ['parr9400','parr9500','parr9600','parr9700','parr9800','parr9900'], cand: ['fvrr9400'], note: 'POST = set 9400 only; PRE pooled 48' },
    river:    { base: ['pariv9400','pariv9408','pariv9500'], cand: ['fvriv9400'], note: 'POST = set 9400 only' },
    lagoon:   { base: ['palag'], cand: ['fvlag'], note: 'PRE 16 @ 9400; POST 8 @ 9400' },
    volcanic: { base: ['vo0vo9400','vo0vo9500','vo0vo9600'], cand: ['f3ndvo9400','f3ndvo9500','f3ndvo9600'], note: 'NEW venue; F3 landed 869acaa + D1 (dodge dropped; treeVD1 == treeVF3ND byte-identical 8/8, so f3nd* are its sets)' },
    glowtide: { base: ['paglow'], cand: ['fvglow'] },
    bay:      { base: ['pabay9400','pabay9600'], cand: ['fvbay9400'], note: 'POST = set 9400 only' },
    lake:     { base: ['palk6100','palk6200'], cand: ['fvlk6100'], note: 'POST = set 6100 only' },
    ocean:    { base: ['paoc'], cand: ['fvoc'] },
    seatrials:{ base: ['past'], cand: ['fvst'] },
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
    console.log(`| ${r.v} | ${HUMAN[r.v]} (${HUMAN_N[r.v]}) | ${f(r.B)} | ${f(C)} | ${r.ratioB.toFixed(3)} → **${r.ratio.toFixed(3)}${r.ratio <= 1.05 ? ' ✅' : ''}** | ${C.dnf.toFixed(1)} | ${C.colMed} | ${C.penMed} | ${C.land.toFixed(2)}/${C.boat.toFixed(2)}/${C.floe.toFixed(2)}/${C.mark.toFixed(2)}/${C.pen.toFixed(2)} | ${C.fins}/${C.n} | ${r.v === 'volcanic' ? 'F3 landed' : sameSeq(r.cfg.base, r.cfg.cand[0])} |${C.missing.length ? ' MISSING ' + C.missing.join(',') : ''}`);
}
console.log('\nnotes:'); for (const r of rows) if (r.cfg.note) console.log(`  ${r.v}: ${r.cfg.note}`);
