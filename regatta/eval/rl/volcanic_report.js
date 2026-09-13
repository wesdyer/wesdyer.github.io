// Emberfall Isle (volcanic) scoreboard rows: bots from a volcanic_bench JSON, the human
// from the banked traj_volcanic_*.json, in the ai-campaign.md table shapes — starts,
// course, per-leg medians, contacts/penalties, and the venue's weather columns.
//   node regatta/eval/rl/volcanic_report.js <label> [trajDir=regatta/eval/rl/traj]
const fs = require('fs'); const path = require('path');
const LABEL = process.argv[2] || 'base20';
const TRAJ = process.argv[3] || 'regatta/eval/rl/traj';
const bench = JSON.parse(fs.readFileSync(path.join(__dirname, 'volcanic_bench_' + LABEL + '.json')));
let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'volcanic_bench_' + LABEL + '.meta.json'))); } catch (e) {}
const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const f1 = (v) => isNaN(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1);
// dmc.legs[0] is the prestart; the race legs are 1..nLegs-1 and the last ends at the finish.
const nLegs = bench[0].nLegs - 1;
const cutoff = bench[0].venueCutoff;
// ── Bots ──
const boats = bench.flatMap(r => r.info.map(i => ({ ...i, seed: r.seed })));
const N = boats.length;
const fin = boats.filter(b => b.fin != null);
const dnfCut = boats.filter(b => b.fin == null || b.fin > cutoff).length;
const starts = boats.filter(b => b.legT[1] != null).map(b => b.legT[1]);
const dns = boats.filter(b => b.legT[1] == null).length;
const ocs = boats.filter(b => b.ocs).length;
const legSplit = (b, lg) => {
    const t0 = b.legT[lg], t1 = lg < nLegs ? b.legT[lg + 1] : b.fin;   // last leg ends at the finish
    return (t0 != null && t1 != null) ? t1 - t0 : null;
};
const botLegs = []; for (let lg = 1; lg <= nLegs; lg++) botLegs.push(med(boats.map(b => legSplit(b, lg)).filter(v => v != null)));
const per = (k) => mean(boats.map(b => b[k] || 0));
const contacts = (cat) => mean(boats.map(b => (b.col && b.col[cat]) || 0));
const strikes = mean(bench.map(r => r.strikes || 0));
// ── Human ──
const files = fs.readdirSync(TRAJ).filter(f => /^traj_volcanic_.*\.json$/.test(f)).sort();
const hum = files.map(f => {
    const t = JSON.parse(fs.readFileSync(path.join(TRAJ, f))); const ix = {}; t.format.forEach((k, i) => ix[k] = i);
    const S = t.samples.filter(s => s[ix.phase] === 1);
    const legT = {}; let prev = null;
    for (const s of S) { const lg = s[ix.leg]; if (prev !== lg && legT[lg] == null) legT[lg] = s[ix.t]; prev = lg; }
    const startT = legT[1] != null ? legT[1] : null;
    const finT = t.finishTime;
    const legs = []; for (let lg = 1; lg <= nLegs; lg++) { const a = legT[lg], b = lg < nLegs ? legT[lg + 1] : finT; legs.push(a != null && b != null ? b - a : null); }
    let boatC = 0; for (const e of (t.events || [])) if (e && e.type === 'collision_boat') boatC++;
    const ocs = S.some(s => s[ix.ocs]);
    // Place: rivals absent at the finish were ahead.
    const lastRivals = S.length ? S[S.length - 1][ix.rivalsX].length : 0;
    const place = 1 + (t.fleet.length - lastRivals);
    return { f, finT, startT, legs, ocs, place, boatC };
});
const hFin = hum.map(h => h.finT), hStart = hum.map(h => h.startT).filter(v => v != null);
const hLegs = []; for (let lg = 0; lg < nLegs; lg++) hLegs.push(med(hum.map(h => h.legs[lg]).filter(v => v != null)));
console.log(`Emberfall Isle (volcanic) — bench ${LABEL}: ${bench.length} seeds × ${bench[0].info.length} bots (${N} boat-races), venue cutoff ${cutoff}, bench cutoff 900, fingerprint ${meta.fingerprint || '?'}; human ${hum.length} traj`);
console.log('\n### Starts (time to cross after the gun, s)\n');
console.log('| Who | DNS% | OCS% | Median | Mean | Min | Max |\n|---|---|---|---|---|---|---|');
console.log(`| bots | ${f1(100 * dns / N)} | ${f1(100 * ocs / N)} | ${f1(med(starts))} | ${f1(mean(starts))} | ${f1(Math.min(...starts))} | ${f1(Math.max(...starts))} |`);
console.log(`| human (${hum.length} traj) | 0 | ${f1(100 * hum.filter(h => h.ocs).length / hum.length)} | ${f1(med(hStart))} | ${f1(mean(hStart))} | ${f1(Math.min(...hStart))} | ${f1(Math.max(...hStart))} |`);
console.log('\n### Course (finish time, s)\n');
console.log(`| Who | DNF% @${cutoff} | DNF% @900 | Median | Mean | Min | Max |\n|---|---|---|---|---|---|---|`);
console.log(`| bots | ${f1(100 * dnfCut / N)} | ${f1(100 * (N - fin.length) / N)} | ${f1(med(fin.map(b => b.fin)))} | ${f1(mean(fin.map(b => b.fin)))} | ${f1(Math.min(...fin.map(b => b.fin)))} | ${f1(Math.max(...fin.map(b => b.fin)))} |`);
console.log(`| human (${hum.length} traj) | 0 | 0 | ${f1(med(hFin))} | ${f1(mean(hFin))} | ${f1(Math.min(...hFin))} | ${f1(Math.max(...hFin))} |`);
console.log('\n### Legs (median split, s)\n');
console.log('| Who | ' + botLegs.map((_, i) => 'L' + (i + 1)).join(' | ') + ' | Sum |\n|---|' + botLegs.map(() => '---').join('|') + '|---|');
console.log(`| bots | ${botLegs.map(f1).join(' | ')} | ${f1(botLegs.reduce((a, b) => a + b, 0))} |`);
console.log(`| human | ${hLegs.map(f1).join(' | ')} | ${f1(hLegs.reduce((a, b) => a + b, 0))} |`);
console.log(`| bots − human | ${botLegs.map((v, i) => (v - hLegs[i] >= 0 ? '+' : '') + f1(v - hLegs[i])).join(' | ')} | ${(botLegs.reduce((a, b) => a + b, 0) - hLegs.reduce((a, b) => a + b, 0) >= 0 ? '+' : '') + f1(botLegs.reduce((a, b) => a + b, 0) - hLegs.reduce((a, b) => a + b, 0))} |`);
console.log('\n### Contacts and penalties (per boat-race)\n');
console.log('| Who | boat | land | mark | bounds | penalties |\n|---|---|---|---|---|---|');
console.log(`| bots | ${f1(contacts('boat'))} | ${f1(contacts('land'))} | ${f1(contacts('mark'))} | ${f1(contacts('bounds'))} | ${f1(per('pen'))} |`);
console.log(`| human | ${f1(mean(hum.map(h => h.boatC || 0)))} | — | — | — | 0 |`);
console.log('\n### Weather (per boat-race unless noted)\n');
console.log('| Who | strikes/race | fries | s fried | dodges | s in boil | s in dead air |\n|---|---|---|---|---|---|---|');
console.log(`| bots | ${f1(strikes)} | ${f1(per('fries'))} | ${f1(per('friedS'))} | ${f1(per('dodges'))} | ${f1(per('boilS'))} | ${f1(per('deadS'))} |`);
console.log(`| human | — | n/r | n/r | n/r | n/r | n/r |`);
console.log('\n### Human laps\n');
console.log('| lap | finish | place | ' + hLegs.map((_, i) => 'L' + (i + 1)).join(' | ') + ' |\n|---|---|---|' + hLegs.map(() => '---').join('|') + '|');
for (const h of hum) console.log(`| ${h.f.replace('traj_volcanic_', '').replace('.json', '')} | ${f1(h.finT)} | ${h.place}/${bench[0].info.length + 1} | ${h.legs.map(f1).join(' | ')} |`);
// Per-seed winners: the leader's time vs the human.
const winners = bench.map(r => { const fs_ = r.info.filter(i => i.fin != null).map(i => i.fin); return fs_.length ? Math.min(...fs_) : null; }).filter(v => v != null);
console.log(`\nPer-seed bot winner: med ${f1(med(winners))}, mean ${f1(mean(winners))}, best ${f1(Math.min(...winners))} (human med ${f1(med(hFin))}, best ${f1(Math.min(...hFin))}).`);
