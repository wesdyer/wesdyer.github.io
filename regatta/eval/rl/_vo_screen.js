// MULTI-VENUE SCREEN for a candidate prefix (2026-09-13, the volcano push): one line per
// venue, candidate vs its standing anchor over the shared seeds, in the columns the gates
// read — fins, paired med/mean (CAND − BASE, negative = faster), OCS-ever, boat contacts,
// penalties, land. Anchors: f3nd* on volcanic (the D1 base), fv* elsewhere (final HEAD 869acaa
// verification benches, same js as pa*/wbsw* off Emberfall).
//   node _vo_screen.js <candPrefix>      e.g. s2  → s2vo9400.. s2st s2bay9400 ...
const fs = require('fs'); const path = require('path');
const C = process.argv[2] || 's2';
const MAP = {
    volcanic: { base: ['f3ndvo9400', 'f3ndvo9500', 'f3ndvo9600'], cand: [C + 'vo9400', C + 'vo9500', C + 'vo9600'] },
    seatrials: { base: ['fvst'], cand: [C + 'st'] },
    bay: { base: ['fvbay9400'], cand: [C + 'bay9400'] },
    ocean: { base: ['fvoc'], cand: [C + 'oc'] },
    lake: { base: ['fvlk6100'], cand: [C + 'lk6100'] },
    glowtide: { base: ['fvglow'], cand: [C + 'glow'] },
    lagoon: { base: ['fvlag'], cand: [C + 'lag'] },
    river: { base: ['fvriv9400'], cand: [C + 'riv9400'] },
    redrock: { base: ['fvrr9400'], cand: [C + 'rr9400'] },
    arctic: { base: ['fvarc9100'], cand: [C + 'arc9100'] },
    swamp: { base: ['fvsw9400'], cand: [C + 'sw9400'] },
};
const load = (l) => { const f = path.join(__dirname, `ocean_bench_${l}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const q = (a, p) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? +s[Math.floor(p * (s.length - 1))].toFixed(1) : NaN; };
const mean = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : NaN;
console.log(`| venue | n | fins base→cand | paired med / mean | OCS-ever | boat/boat | pen/boat | land/boat | med base→cand | gate |`);
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const [v, m] of Object.entries(MAP)) {
    let pairs = [], nb = 0, nc = 0, fb = 0, fc = 0, ob = 0, oc = 0, bb = 0, bc = 0, pb = 0, pc = 0, lb = 0, lc = 0, finsB = [], finsC = [], missing = [];
    for (let k = 0; k < m.base.length; k++) {
        const B = load(m.base[k]), Cc = load(m.cand[k]);
        if (!B || !Cc) { missing.push(!B ? m.base[k] : m.cand[k]); continue; }
        for (let i = 0; i < Math.min(B.length, Cc.length); i++) {
            if (B[i].seed !== Cc[i].seed) continue;
            const cm = {}; for (const b of Cc[i].info) cm[b.name] = b;
            for (const b of B[i].info) { const c = cm[b.name]; if (!c) continue;
                nb++; nc++; if (b.fin != null) { fb++; finsB.push(b.fin); } if (c.fin != null) { fc++; finsC.push(c.fin); }
                if (b.fin != null && c.fin != null) pairs.push(c.fin - b.fin);
                ob += b.ocs ? 1 : 0; oc += c.ocs ? 1 : 0; bb += (b.col || {}).boat || 0; bc += (c.col || {}).boat || 0; pb += b.pen || 0; pc += c.pen || 0; lb += (b.col || {}).land || 0; lc += (c.col || {}).land || 0; }
        }
    }
    if (!nb) { console.log(`| ${v} | — | MISSING ${missing.join(',')} | | | | | | | |`); continue; }
    const pm = mean(pairs), boatUp = bb ? (bc - bb) / bb : 0;
    const gate = (fc >= fb) && (oc <= ob) && (boatUp <= 0.2) && (pm <= 3) ? 'ok' : `FAIL${fc < fb ? ' fins' : ''}${oc > ob ? ' OCS' : ''}${boatUp > 0.2 ? ' boat' : ''}${pm > 3 ? ' mean' : ''}`;
    console.log(`| ${v} | ${nb} | ${fb}→${fc} | ${q(pairs, .5)} / ${pm} | ${(100 * ob / nb).toFixed(1)}%→${(100 * oc / nc).toFixed(1)}% | ${(bb / nb).toFixed(2)}→${(bc / nc).toFixed(2)} | ${(pb / nb).toFixed(2)}→${(pc / nc).toFixed(2)} | ${(lb / nb).toFixed(2)}→${(lc / nc).toFixed(2)} | ${q(finsB, .5)}→${q(finsC, .5)} | ${gate}${missing.length ? ' (partial: ' + missing.join(',') + ')' : ''} |`);
}
