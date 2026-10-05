// ST CLOSE TABLE — THE PLAYTEST-FIX SESSION (2026-10-04; derived from _fl_close_table.js).
// PRE = stpre* on treeSTPRE (HEAD 8f6b490's js), POST = stpost* on treeSTPOST (the working tree:
// grounding scrape, the continuous ranking, Adaptive AI (inert: the player never sails), the
// starboard start, the two dir:-1 start-line sign fixes). Both trees bench the SAME frozen venue docs.
// HUMAN = the median of his playtest-intake laps (traj/traj_<venue>_{solo,competitive}_*.json:
// three Time Trials + three races per venue, Sep 29-30), with the Sep 16 reference alongside.
//   node _st_close_table.js



const fs = require('fs'); const path = require('path');
const POST = 'v81r81', PRE = 'v81r36';
const OLD_REF = { arctic: 209.4, bay: 239.0, lagoon: 174.7, lake: 194.8, ocean: 214.2, river: 187.4,
    glowtide: 204.4, redrock: 204.2, seatrials: 185.7, swamp: 173.3, volcanic: 195.5, otter: 200.8, flats: 172.8 };
const HUMAN = {}, HUMAN_N = {};
for (const v of Object.keys(OLD_REF)) {
    const fs_ = fs.readdirSync(path.join(__dirname, 'traj')).filter(f => f.startsWith(`traj_${v}_solo_`) || f.startsWith(`traj_${v}_competitive_`));
    const t = fs_.map(f => JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'))).filter(d => d.finished && d.finishTime > 0).map(d => d.finishTime).sort((x, y) => x - y);
    HUMAN[v] = t.length ? +t[Math.floor(t.length / 2)].toFixed(1) : OLD_REF[v]; HUMAN_N[v] = t.length;
}
const VENUES = {
    arctic:   { base: [PRE + 'arc'], cand: [POST + 'arc'], note: '8 @ 9100 both' },
    swamp:    { base: [PRE + 'sw'], cand: [POST + 'sw'], note: '8 @ 9400 both' },
    redrock:  { base: [PRE + 'rr'], cand: [POST + 'rr'], note: '8 @ 9400 both' },
    river:    { base: [PRE + 'riv'], cand: [POST + 'riv'], note: '8 @ 9400 both' },
    lagoon:   { base: [PRE + 'lag'], cand: [POST + 'lag'], note: '8 @ 9400 both' },
    volcanic: { base: [PRE + 'vo9400', PRE + 'vo9500', PRE + 'vo9600'], cand: [POST + 'vo9400', POST + 'vo9500', POST + 'vo9600'], note: '3×8 both' },
    glowtide: { base: [PRE + 'glow'], cand: [POST + 'glow'], note: '16 @ 9400 both' },
    bay:      { base: [PRE + 'bay'], cand: [POST + 'bay'], note: '8 @ 9400 both' },
    lake:     { base: [PRE + 'lk'], cand: [POST + 'lk'], note: '8 @ 6100 both' },
    ocean:    { base: [PRE + 'oc'], cand: [POST + 'oc'], note: '16 @ 9400 both' },
    seatrials:{ base: [PRE + 'st'], cand: [POST + 'st'], note: '16 @ 9400 both' },
    otter:    { base: [PRE + 'ot9400', PRE + 'ot9500', PRE + 'ot9600'], cand: [POST + 'ot9400', POST + 'ot9500', POST + 'ot9600'], note: '3×8 both' },
    flats:    { base: [PRE + 'fl9400', PRE + 'fl9500', PRE + 'fl9600'], cand: [POST + 'fl9400', POST + 'fl9500', POST + 'fl9600'], note: '3×8 both' },
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
console.log('| venue | human med (n) [Sep 16 ref] | PRE bot med/mean/best | POST bot med/mean/best | ratio pre → post | DNF% | col med/boat | pen med/boat | dirt l/b/f/m/pen (mean/boat, post) | fins post | byte-check |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    const C = r.C;
    console.log(`| ${r.v} | ${HUMAN[r.v]} (${HUMAN_N[r.v]}) [${OLD_REF[r.v]}] | ${f(r.B)} | ${f(C)} | ${r.ratioB.toFixed(3)} → **${r.ratio.toFixed(3)}${r.ratio <= 1.1 ? ' ✅' : ''}** | ${C.dnf.toFixed(1)} | ${C.colMed} | ${C.penMed} | ${C.land.toFixed(2)}/${C.boat.toFixed(2)}/${C.floe.toFixed(2)}/${C.mark.toFixed(2)}/${C.pen.toFixed(2)} | ${C.fins}/${C.n} | ${sameSeq(r.cfg.base, r.cfg.cand[0])} |${C.missing.length ? ' MISSING ' + C.missing.join(',') : ''}`);
}
console.log('\nnotes:'); for (const r of rows) if (r.cfg.note) console.log(`  ${r.v}: ${r.cfg.note}`);

// PRE dirt and starts alongside, for the start work
console.log('\n| venue | PRE dirt l/b/f/m/pen | POST dirt l/b/f/m/pen | PRE fins | POST fins |');
console.log('|---|---|---|---|---|');
for (const r of rows) { const d = (S) => `${S.land.toFixed(2)}/${S.boat.toFixed(2)}/${S.floe.toFixed(2)}/${S.mark.toFixed(2)}/${S.pen.toFixed(2)}`;
    console.log(`| ${r.v} | ${d(r.B)} | ${d(r.C)} | ${r.B.fins}/${r.B.n} | ${r.C.fins}/${r.C.n} |`); }
