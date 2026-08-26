// RE-BEACHING PUSH P1 — the pre-registered kill stat over _rb_census output.
//   Population: triggers leg>=1, cause in {rand8, obs, rand} (rounding/weed
//   sides excluded — the candidate would not touch them), clr0 <= 2 cells.
//   score(side) = sum over d in {80,150} of min(clr_d, 4); asymmetric if
//   |scoreP - scoreM| >= 2; blocked = chosen side has the LOWER score.
//   KILL STAT: P(re-beach | wiggled blocked side) vs P(re-beach | open side).
//   Re-entry ownership: land episodes idx>=1 — owner = wig (preWig>=0.5),
//   esc (preEsc>=0.5), av (preAvMax>=30deg), else nav.
//   node _rb_kill.js <censusJson...>
const fs = require('fs');
const files = process.argv.slice(2);
const T = [], EPS = [];
for (const f of files) {
    for (const race of JSON.parse(fs.readFileSync(f, 'utf8'))) {
        for (const tr of race.triggers) { tr.seed = race.seed; tr.file = f; T.push(tr); }
        for (const ep of race.eps) { ep.seed = race.seed; EPS.push(ep); }
    }
}
const score = (bp) => bp.reduce((a, c) => a + Math.min(c == null ? 0 : c, 4), 0);
const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '--';
console.log(`triggers total ${T.length}; by cause:`, Object.entries(T.reduce((m, t) => (m[t.cause] = (m[t.cause] || 0) + 1, m), {})).map(([k, v]) => `${k} ${v}`).join(' '));
const pop = T.filter(t => ['rand8', 'obs', 'rand'].includes(t.cause) && t.clr0 != null && t.clr0 <= 2);
console.log(`census population (cause rand8/obs/rand, clr0<=2): ${pop.length}`);
const asym = pop.filter(t => Math.abs(score(t.bp) - score(t.bm)) >= 2);
console.log(`  with side asymmetry >=2: ${asym.length} (${pct(asym.length, pop.length)} of population)`);
const blocked = asym.filter(t => (t.side === 1 ? score(t.bp) : score(t.bm)) < (t.side === 1 ? score(t.bm) : score(t.bp)));
const open = asym.filter(t => !blocked.includes(t));
const line = (tag, g) => {
    const rb = g.filter(t => t.reB).length;
    const cw = g.map(t => t.cw || 0).sort((a, b) => a - b);
    const clr10 = g.filter(t => t.clr10 != null).map(t => t.clr10).sort((a, b) => a - b);
    console.log(`  ${tag.padEnd(26)} n ${String(g.length).padStart(4)}  P(re-beach) ${pct(rb, g.length).padStart(4)}  contactS<=10 med ${cw.length ? cw[cw.length >> 1] : '--'}  clr@+10 med ${clr10.length ? clr10[clr10.length >> 1] : '--'}`);
};
console.log('== KILL STAT ==');
line('wiggled BLOCKED side', blocked);
line('wiggled OPEN side', open);
console.log('-- splits --');
for (const c of ['rand8', 'obs', 'rand']) {
    line(`blocked & ${c}`, blocked.filter(t => t.cause === c));
    line(`open & ${c}`, open.filter(t => t.cause === c));
}
line('blocked & inContact', blocked.filter(t => t.inC));
line('open & inContact', open.filter(t => t.inC));
line('blocked & clear-at-trig', blocked.filter(t => !t.inC));
line('open & clear-at-trig', open.filter(t => !t.inC));
// context: no-asymmetry group + how often chooser already picks open
line('NO asymmetry (context)', pop.filter(t => !asym.includes(t)));
console.log(`  chooser already picks OPEN on ${pct(open.length, asym.length)} of asymmetric triggers (random = ~50%)`);
// re-entry ownership
const own = (e) => e.preWig >= 0.5 ? 'wig' : e.preEsc >= 0.5 ? 'esc' : (e.preAvMax || 0) >= 30 ? 'av' : 'nav';
for (const [tag, g] of [['FIRST land episodes (idx=0)', EPS.filter(e => e.idx === 0)], ['RE-entries (idx>=1)', EPS.filter(e => e.idx >= 1)]]) {
    const m = g.reduce((mm, e) => (mm[own(e)] = (mm[own(e)] || 0) + 1, mm), {});
    console.log(`${tag}: n ${g.length} — owners: ${['wig', 'esc', 'av', 'nav'].map(k => `${k} ${pct(m[k] || 0, g.length)}`).join(' ')}`);
}
const re = EPS.filter(e => e.idx >= 1), durs = re.map(e => e.dur).sort((a, b) => a - b);
if (re.length) console.log(`re-entry dur med ${durs[durs.length >> 1]}s p90 ${durs[Math.floor(durs.length * 0.9)]}s; per-boat re-entry episodes: ${(re.length / new Set(EPS.map(e => e.seed + e.name)).size).toFixed(1)}`);
