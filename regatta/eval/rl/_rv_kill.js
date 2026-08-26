// RIVER ENTRY PUSH P1 — the pre-registered kill stat over _rv_entry output.
//   Population: FIRST land episodes (idx=0 per boat per race), leg >= 1
//   (start-box scrapes are a different phenomenon; count reported).
//   Owner (rr convention): wig if preWig>=0.5, esc if preEsc>=0.5,
//   av if preAvMax>=30deg, else nav.
//   KILL BAR (memory regatta-rventry-push-plan): buildable iff the TOP owner
//   holds >=60% of first entries AND >=60% of that owner's entries show the
//   precondition "clr <= 2 cells at t0-5s" — at n(first, leg>=1) >= 60.
//   Everything else printed is anatomy: clearance trajectories per owner,
//   ground-frame gap, speed, leg split, 200u position clusters.
//   node _rv_kill.js <entryJson...>
const fs = require('fs');
const E = [];
for (const f of process.argv.slice(2)) {
    for (const race of JSON.parse(fs.readFileSync(f, 'utf8'))) {
        for (const ep of race.eps) { ep.seed = race.seed; E.push(ep); }
    }
}
const own = (e) => e.preWig >= 0.5 ? 'wig' : e.preEsc >= 0.5 ? 'esc' : (e.preAvMax || 0) >= 30 ? 'av' : 'nav';
const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '--';
const med = (a) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const first = E.filter(e => e.idx === 0);
const pop = first.filter(e => e.leg >= 1);
console.log(`episodes total ${E.length}; FIRST ${first.length}; first & leg>=1 (population) ${pop.length}  [leg0 firsts: ${first.length - pop.length}]`);
const byOwner = {};
for (const e of pop) (byOwner[own(e)] = byOwner[own(e)] || []).push(e);
console.log('== OWNER SPLIT (first entries, leg>=1) ==');
for (const k of ['av', 'nav', 'wig', 'esc']) {
    const g = byOwner[k] || [];
    const c5 = g.filter(e => e.clrT && e.clrT[2] != null);
    const pre = c5.filter(e => e.clrT[2] <= 2);
    console.log(`  ${k.padEnd(4)} n ${String(g.length).padStart(4)} (${pct(g.length, pop.length).padStart(4)})  clr@-5<=2: ${pct(pre.length, c5.length).padStart(4)} of ${c5.length}  clrT med [-10,-7.5,-5,-2.5,-1]: ${[0,1,2,3,4].map(i => med(g.map(e => e.clrT && e.clrT[i]))).join(',')}  gfGap med ${med(g.map(e => e.gfGap))}deg  kt@-5 med ${med(g.map(e => e.ktT && e.ktT[1]))}`);
}
const top = Object.entries(byOwner).sort((a, b) => b[1].length - a[1].length)[0];
if (top) {
    const g = top[1], c5 = g.filter(e => e.clrT && e.clrT[2] != null);
    const pre = c5.filter(e => e.clrT[2] <= 2);
    const ownerPct = 100 * g.length / pop.length, prePct = c5.length ? 100 * pre.length / c5.length : 0;
    console.log(`== KILL BAR ==  top owner '${top[0]}' ${ownerPct.toFixed(0)}% (bar >=60) | precondition clr@-5<=2 ${prePct.toFixed(0)}% (bar >=60) | n ${pop.length} (bar >=60)`);
    console.log(`   VERDICT: ${ownerPct >= 60 && prePct >= 60 && pop.length >= 60 ? 'MECHANISM SURVIVES' : 'KILLED'}`);
}
console.log('-- leg split (population):', Object.entries(pop.reduce((m, e) => (m[e.leg] = (m[e.leg] || 0) + 1, m), {})).map(([k, v]) => `leg${k}:${v}`).join(' '));
console.log('-- re-entries per first (context):', (E.filter(e => e.idx >= 1).length / Math.max(1, first.length)).toFixed(1));
const clus = {};
for (const e of pop) { const k = `${Math.round(e.x / 200) * 200},${Math.round(e.y / 200) * 200}`; clus[k] = (clus[k] || 0) + 1; }
console.log('-- top position clusters (200u bins):', Object.entries(clus).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `(${k})x${v}`).join(' '));

// v2 — rival context at t0-3s (fields present only in v2 census JSONs).
// BUILD-DECISION RULE (registered 2026-08-26 ~3:15am, before reading v2
// output): the ONE-LANE FOLLOW candidate (extend the defile meter to a
// moving leader in a <2-clearance corridor) is buildable iff >=60% of
// av-owned first entries (leg>=1) have a rival within 300u at t0-3s AND
// the within-300u group is majority same-direction (rivAlign < 60deg).
// Meetings/crossings dominating instead => the follow is the wrong action;
// close or pivot per the owner ruling.
{
    const av = pop.filter(e => own(e) === 'av' && e.rivD3 !== undefined);
    if (av.length) {
        const w300 = av.filter(e => e.rivD3 < 300);
        const same = w300.filter(e => e.rivAlign < 60);
        const opp = w300.filter(e => e.rivAlign > 135);
        const ahead = w300.filter(e => e.rivRel < 60);
        console.log('== RIVAL CONTEXT (av-owned firsts with v2 fields) ==');
        console.log(`  n ${av.length}; rival<300u ${w300.length} (${pct(w300.length, av.length)}); of those: same-dir(<60) ${pct(same.length, w300.length)}, opposed(>135) ${pct(opp.length, w300.length)}, ahead(rel<60) ${pct(ahead.length, w300.length)}`);
        console.log(`  rivD3 med ${med(av.map(e => e.rivD3))}u  rivKt med ${med(w300.map(e => e.rivKt))}  n300 med ${med(av.map(e => e.n300))}`);
        const okA = w300.length / av.length >= 0.6, okB = same.length / Math.max(1, w300.length) > 0.5;
        console.log(`  BUILD DECISION: rival<300 ${ (100 * w300.length / av.length).toFixed(0)}% (>=60) ${okA ? 'ok' : 'FAIL'}; same-dir majority ${okB ? 'ok' : 'FAIL'} => ${okA && okB ? 'BUILD one-lane follow' : 'DO NOT BUILD (wrong action)'}`);
    } else console.log('== RIVAL CONTEXT: no v2 fields in input ==');
}

// v3 — off-path at t0-3s/-1s (pd3/pd1, redrock pivot). REGISTERED before
// reading v3 output (2026-08-26 ~3:50am): the RETURN-TO-PATH candidate (the
// redrock-todo pre-scoped ACTIONS change) is the right action iff >=50% of
// av-owned first entries with a pd3 reading have pd3 >= 60u (the
// _contact_ante displacement bar, re-verified on current code).
{
    const av = pop.filter(e => own(e) === 'av' && e.pd3 != null);
    if (av.length) {
        const off = av.filter(e => e.pd3 >= 60);
        console.log('== OFF-PATH (av-owned firsts with v3 fields) ==');
        console.log(`  n ${av.length}; pd3 med ${med(av.map(e => e.pd3))}u p75 ${av.map(e=>e.pd3).sort((a,b)=>a-b)[Math.floor(av.length*.75)]}u; pd3>=60u: ${pct(off.length, av.length)}  | pd1 med ${med(av.map(e => e.pd1))}u`);
        console.log(`  RETURN-TO-PATH DECISION (>=50% displaced): ${off.length / av.length >= 0.5 ? 'BUILD' : 'DO NOT BUILD'}`);
    } else console.log('== OFF-PATH: no v3 fields in input ==');
}
