// Summarise one or more _vo_census JSONs (see _vo_census.js). Episodes pooled over races.
//   node _vo_census_sum.js <file.json> [file2.json ...]
const fs = require('fs'); const path = require('path');
const files = process.argv.slice(2);
const races = [].concat(...files.map(f => JSON.parse(fs.readFileSync(path.resolve(__dirname, f), 'utf8'))));
const rows = [].concat(...races.map(r => r.rows));
const N = rows.length;
const q = (a, p) => { const s = a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? +s[Math.floor(p * (s.length - 1))].toFixed(2) : NaN; };
const mean = a => { const s = a.filter(x => x != null && !Number.isNaN(x)); return s.length ? +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2) : NaN; };
const sum = a => +a.filter(x => x != null && !Number.isNaN(x)).reduce((x, y) => x + y, 0).toFixed(1);
const pct = (k, n) => n ? (100 * k / n).toFixed(1) + '%' : '—';
console.log(`VOLCANIC CENSUS  ${files.join(' ')}  races ${races.length}  boat-races ${N}`);
const fins = rows.map(r => r.fin).filter(x => x != null);
console.log(`fins ${fins.length}/${N}  med ${q(fins, .5)}  mean ${mean(fins)}`);
const kinds = [['fries', 'FRY'], ['dodges', 'DODGE'], ['boils', 'BOIL'], ['deads', 'DEAD AIR']];
for (const [key, label] of kinds) {
    const eps = [].concat(...rows.map(r => r[key]));
    if (!eps.length) { console.log(`\n── ${label}: none`); continue; }
    const lost = eps.map(e => e.lost_s), dur = eps.map(e => e.dur);
    console.log(`\n── ${label}: ${eps.length} episodes = ${(eps.length / N).toFixed(2)}/boat-race;  dur med ${q(dur, .5)} mean ${mean(dur)} p90 ${q(dur, .9)} → ${(sum(dur) / N).toFixed(1)} s/boat-race`);
    console.log(`   clock lost per episode: med ${q(lost, .5)} s  mean ${mean(lost)}  p90 ${q(lost, .9)}  (priced ${lost.filter(x => x != null).length}/${eps.length});  ⭐ SUM ${(sum(lost) / N).toFixed(1)} s/boat-race`);
    const rateRatio = sum(eps.map(e => e.dP)) / sum(eps.map(e => (e.rate0 != null ? e.rate0 * e.dur : null)));
    console.log(`   progress rate during / before: ${rateRatio.toFixed(2)}   ratePost/rate0 med ${q(eps.map(e => e.ratePost != null && e.rate0 ? e.ratePost / e.rate0 : null), .5)}`);
    const fn = eps.reduce((a, e) => a + e.n, 0);
    console.log(`   |TWA| onset med ${q(eps.map(e => e.twa0), .5)} → end med ${q(eps.map(e => e.twa1), .5)};  min|TWA| med ${q(eps.map(e => e.minTwa), .5)};  irons frames ${pct(eps.reduce((a, e) => a + e.ironsN, 0), fn)}  luff(<0.75) ${pct(eps.reduce((a, e) => a + e.luffN, 0), fn)}`);
    console.log(`   speed kt onset med ${q(eps.map(e => e.spd0), .5)}  min med ${q(eps.map(e => e.minSpd), .5)}  end med ${q(eps.map(e => e.spd1), .5)};  heading drift med ${q(eps.map(e => e.hdgDrift), .5)} rad  wind drift med ${q(eps.map(e => e.wdDrift), .5)} rad`);
    console.log(`   tacks/gybes DURING ${pct(eps.filter(e => e.tacksDuring > 0).length, eps.length)} (${sum(eps.map(e => e.tacksDuring))} total);  DEFERRED manoeuvre within 3 s after ${pct(eps.filter(e => e.deferred).length, eps.length)};  armed at onset ${pct(eps.filter(e => e.armed0).length, eps.length)};  wiggle during ${pct(eps.filter(e => e.wiggleN > 0).length, eps.length)}`);
    console.log(`   contacts during: boat ${sum(eps.map(e => e.col.boat))} land ${sum(eps.map(e => e.col.land))} mark ${sum(eps.map(e => e.col.mark))}`);
    const byLeg = {};
    for (const e of eps) { const L = byLeg[e.lg0] = byLeg[e.lg0] || { n: 0, lost: [], dur: [] }; L.n++; L.lost.push(e.lost_s); L.dur.push(e.dur); }
    console.log('   by leg: ' + Object.entries(byLeg).map(([lg, L]) => `L${lg} n=${L.n} dur ${sum(L.dur) / N | 0}s/br lost med ${q(L.lost, .5)} sum ${(sum(L.lost) / N).toFixed(1)}s/br`).join(' | '));
    if (key === 'fries') {
        const dd = eps.filter(e => e.dodged), nd = eps.filter(e => !e.dodged);
        console.log(`   dodged-before: ${dd.length} (dur med ${q(dd.map(e => e.dur), .5)}, lost med ${q(dd.map(e => e.lost_s), .5)})  vs not: ${nd.length} (dur med ${q(nd.map(e => e.dur), .5)}, lost med ${q(nd.map(e => e.lost_s), .5)});  restarts ${sum(eps.map(e => e.restarts))}; nominal dur med ${q(eps.map(e => e.durNominal), .5)}`);
        // lost vs TWA-drift class: did the held compass heading walk into irons?
        const irons = eps.filter(e => e.ironsN > 0), noI = eps.filter(e => e.ironsN === 0);
        console.log(`   episodes touching irons: ${irons.length} (lost med ${q(irons.map(e => e.lost_s), .5)} sum ${(sum(irons.map(e => e.lost_s)) / N).toFixed(1)}s/br)  vs none: ${noI.length} (lost med ${q(noI.map(e => e.lost_s), .5)} sum ${(sum(noI.map(e => e.lost_s)) / N).toFixed(1)}s/br)`);
        const bins = [[0, 0.6, 'upwind(<0.6 onset? no: by onset TWA)']];
        const up = eps.filter(e => e.twa0 < 1.0), rc = eps.filter(e => e.twa0 >= 1.0 && e.twa0 < 2.2), dn = eps.filter(e => e.twa0 >= 2.2);
        console.log(`   by onset TWA: upwind(<1.0) n=${up.length} lost med ${q(up.map(e => e.lost_s), .5)} sum ${(sum(up.map(e => e.lost_s)) / N).toFixed(1)}s/br | reach n=${rc.length} lost med ${q(rc.map(e => e.lost_s), .5)} sum ${(sum(rc.map(e => e.lost_s)) / N).toFixed(1)} | run(>=2.2) n=${dn.length} lost med ${q(dn.map(e => e.lost_s), .5)} sum ${(sum(dn.map(e => e.lost_s)) / N).toFixed(1)}`);
        const df = eps.filter(e => e.deferred), ndf = eps.filter(e => !e.deferred);
        console.log(`   deferred manoeuvre: yes n=${df.length} lost med ${q(df.map(e => e.lost_s), .5)} sum ${(sum(df.map(e => e.lost_s)) / N).toFixed(1)}s/br | no n=${ndf.length} lost med ${q(ndf.map(e => e.lost_s), .5)} sum ${(sum(ndf.map(e => e.lost_s)) / N).toFixed(1)}s/br`);
        const long = eps.filter(e => e.dur >= 8), short = eps.filter(e => e.dur < 8);
        console.log(`   dur>=8 s: n=${long.length} lost med ${q(long.map(e => e.lost_s), .5)} sum ${(sum(long.map(e => e.lost_s)) / N).toFixed(1)}s/br | dur<8: n=${short.length} lost med ${q(short.map(e => e.lost_s), .5)} sum ${(sum(short.map(e => e.lost_s)) / N).toFixed(1)}s/br`);
    }
    if (key === 'dodges') {
        const me = eps.filter(e => e.isMe), fa = eps.filter(e => e.fryAfter != null);
        console.log(`   aimed-at-me ${pct(me.length, eps.length)} (aimed ${pct(eps.filter(e => e.aimed).length, eps.length)});  d0 med ${q(eps.map(e => e.d0), .5)} u  lead med ${q(eps.map(e => e.lead), .5)} s`);
        console.log(`   fried after the dodge anyway: ${pct(fa.filter(e => e.fryAfter > 0).length, fa.length)} of ${fa.length}; fry dur after med ${q(fa.filter(e => e.fryAfter > 0).map(e => e.fryAfter), .5)} s`);
    }
}
// ── START ──
const st = rows.map(r => r.start);
const cross = rows.map(r => r.cross);
console.log(`\n── START (n=${N}): crossing med ${q(cross, .5)} mean ${mean(cross)} p90 ${q(cross, .9)} max ${q(cross, 1)};  OCS at the gun ${pct(st.filter(s => s.gunOcs).length, N)}  ever-OCS(pre) ${pct(st.filter(s => s.everOcs).length, N)}  OCS while racing ${pct(st.filter(s => s.ocsRacing).length, N)}  ocs clear t med ${q(st.map(s => s.ocsClearT), .5)}`);
console.log(`   commit med ${q(st.map(s => s.commit), .5)} s before the gun;  at commit: speed ${q(st.map(s => s.spC), .5)} kt  behind ${q(st.map(s => s.behindC), .5)} u  est ${q(st.map(s => s.est), .5)}+buf ${q(st.map(s => s.buf), .5)}`);
const realized = rows.map(r => (r.start.commit != null && r.cross != null) ? r.start.commit + r.cross : null);
const estErr = rows.map((r, i) => realized[i] != null && r.start.est != null ? realized[i] - (r.start.est + r.start.buf) : null);
console.log(`   realized run med ${q(realized, .5)}  estErr med ${q(estErr, .5)} p25 ${q(estErr, .25)} p75 ${q(estErr, .75)}`);
console.log(`   at the gun: behind med ${q(st.map(s => s.gunBehind), .5)} u (p25 ${q(st.map(s => s.gunBehind), .25)} p75 ${q(st.map(s => s.gunBehind), .75)})  speed ${q(st.map(s => s.gunSp), .5)} kt  |TWA| ${q(st.map(s => Math.abs(s.gunTwa)), .5)}`);
console.log(`   wind offset from the line normal at commit: |off| med ${q(st.map(s => Math.abs(s.wdOffC)), .5)} rad  p90 ${q(st.map(s => Math.abs(s.wdOffC)), .9)};  at the gun med ${q(st.map(s => Math.abs(s.wdOffGun)), .5)}`);
const ocsY = rows.filter(r => r.start.gunOcs), ocsN = rows.filter(r => !r.start.gunOcs);
const f = (rs, k) => q(rs.map(r => r.start[k]), .5);
console.log(`   OCS at gun (n=${ocsY.length}): |off|C ${q(ocsY.map(r => Math.abs(r.start.wdOffC)), .5)}  estErr ${q(ocsY.map((r) => (r.start.commit != null && r.cross != null && r.start.est != null) ? r.start.commit + r.cross - r.start.est - r.start.buf : null), .5)}  gunBehind ${f(ocsY, 'gunBehind')}  gunSp ${f(ocsY, 'gunSp')}  hdgOff1 ${f(ocsY, 'hdgOff1')}  cross ${q(ocsY.map(r => r.cross), .5)}`);
console.log(`   not OCS   (n=${ocsN.length}): |off|C ${q(ocsN.map(r => Math.abs(r.start.wdOffC)), .5)}  estErr ${q(ocsN.map((r) => (r.start.commit != null && r.cross != null && r.start.est != null) ? r.start.commit + r.cross - r.start.est - r.start.buf : null), .5)}  gunBehind ${f(ocsN, 'gunBehind')}  gunSp ${f(ocsN, 'gunSp')}  hdgOff1 ${f(ocsN, 'hdgOff1')}  cross ${q(ocsN.map(r => r.cross), .5)}`);
// the tack at gun+1 s vs the wind offset: lifted = the tack whose heading is nearer the line normal
const lifted = rows.filter(r => r.start.hdgOff1 != null && r.start.hdgOff1 < 0.6), headed = rows.filter(r => r.start.hdgOff1 != null && r.start.hdgOff1 >= 0.6);
console.log(`   heading off the normal at gun+1: <0.6 rad n=${lifted.length} cross med ${q(lifted.map(r => r.cross), .5)} OCS ${pct(lifted.filter(r => r.start.gunOcs).length, lifted.length)} | >=0.6 n=${headed.length} cross med ${q(headed.map(r => r.cross), .5)} OCS ${pct(headed.filter(r => r.start.gunOcs).length, headed.length)}`);
// |off| bins vs OCS
for (const [lo, hi] of [[0, 0.15], [0.15, 0.3], [0.3, 0.45], [0.45, 9]]) {
    const b = rows.filter(r => r.start.wdOffC != null && Math.abs(r.start.wdOffC) >= lo && Math.abs(r.start.wdOffC) < hi);
    if (b.length) console.log(`   |off| at commit in [${lo},${hi}): n=${b.length} OCS ${pct(b.filter(r => r.start.gunOcs).length, b.length)} cross med ${q(b.map(r => r.cross), .5)} estErr med ${q(b.map(r => (r.start.commit != null && r.cross != null && r.start.est != null) ? r.start.commit + r.cross - r.start.est - r.start.buf : null), .5)} gunBehind ${q(b.map(r => r.start.gunBehind), .5)}`);
}
const dW = rows.map(r => (r.start.wsG != null && r.start.wsC != null) ? r.start.wsG - r.start.wsC : null);
console.log(`   wind speed commit→gun: all med ${q(dW, .5)} kt | OCS ${q(ocsY.map(r => r.start.wsG - r.start.wsC), .5)} (p25 ${q(ocsY.map(r => r.start.wsG - r.start.wsC), .25)} p75 ${q(ocsY.map(r => r.start.wsG - r.start.wsC), .75)}) | not ${q(ocsN.map(r => r.start.wsG - r.start.wsC), .5)} (p25 ${q(ocsN.map(r => r.start.wsG - r.start.wsC), .25)} p75 ${q(ocsN.map(r => r.start.wsG - r.start.wsC), .75)});  wsC med ${q(st.map(s => s.wsC), .5)}  wsG med ${q(st.map(s => s.wsG), .5)}`);
for (const [lo, hi] of [[-99, -1], [-1, 0], [0, 1], [1, 99]]) { const b = rows.filter(r => dW[rows.indexOf(r)] != null && dW[rows.indexOf(r)] >= lo && dW[rows.indexOf(r)] < hi); if (b.length) console.log(`   ΔW in [${lo},${hi}): n=${b.length} OCS ${pct(b.filter(r => r.start.gunOcs).length, b.length)} gunBehind med ${q(b.map(r => r.start.gunBehind), .5)} cross med ${q(b.map(r => r.cross), .5)}`); }
console.log(`   OCS RETURN (n=${ocsY.length}): clear at ${q(ocsY.map(r => r.start.ocsClearT), .5)} s (p25 ${q(ocsY.map(r => r.start.ocsClearT), .25)} p75 ${q(ocsY.map(r => r.start.ocsClearT), .75)}), speed at clear ${q(ocsY.map(r => r.start.clearSp), .5)} kt |TWA| ${q(ocsY.map(r => r.start.clearTwa), .5)} behind ${q(ocsY.map(r => r.start.clearBehind), .5)} u; clear→cross ${q(ocsY.map(r => (r.cross != null && r.start.ocsClearT != null) ? r.cross - r.start.ocsClearT : null), .5)} s (p25 ${q(ocsY.map(r => (r.cross != null && r.start.ocsClearT != null) ? r.cross - r.start.ocsClearT : null), .25)} p75 ${q(ocsY.map(r => (r.cross != null && r.start.ocsClearT != null) ? r.cross - r.start.ocsClearT : null), .75)}); crossSp ${q(ocsY.map(r => r.start.crossSp), .5)} kt`);
{ const R = rows.filter(r => r.start.run && r.start.run.length > 5 && r.start.tgs != null);
  if (R.length) {
    const at = (r, tt, k) => { let best = null; for (const p of r.start.run) if (p[0] <= tt) best = p; return best ? best[k] : null; };
    const turn = R.map(r => { for (const p of r.start.run) if (p[1] >= 0.6) return p[0]; return null; });
    const model = (r, tt) => { let sp = 0, d = 0, t = 0; const a0 = 1 - Math.pow(0.997, 6); while (t < tt - 1e-9) { let a = a0; if (r.start.tgs > sp) a *= r.start.accelMod; sp = sp * (1 - a) + r.start.tgs * a; d += sp * 60 * 0.1; t += 0.1; } return { kt: sp * 4, d }; };
    console.log(`   RUN TRACE (n=${R.length}): time from commit to |TWA|>=0.6: med ${q(turn, .5)} s (p75 ${q(turn, .75)});  speed kt actual/model at +1 s ${q(R.map(r => at(r, 1, 2)), .5)}/${q(R.map(r => model(r, 1).kt), .5)}  +2 s ${q(R.map(r => at(r, 2, 2)), .5)}/${q(R.map(r => model(r, 2).kt), .5)}  +3 s ${q(R.map(r => at(r, 3, 2)), .5)}/${q(R.map(r => model(r, 3).kt), .5)}  +4 s ${q(R.map(r => at(r, 4, 2)), .5)}/${q(R.map(r => model(r, 4).kt), .5)}  +5 s ${q(R.map(r => at(r, 5, 2)), .5)}/${q(R.map(r => model(r, 5).kt), .5)}`);
    console.log(`     distance closed on the line (u) actual at +2/+4/+5.6 s: ${q(R.map(r => r.start.behindC - at(r, 2, 3)), .5)} / ${q(R.map(r => r.start.behindC - at(r, 4, 3)), .5)} / ${q(R.map(r => r.start.behindC - at(r, 5.6, 3)), .5)}   model run distance at +2/+4/+5.6: ${q(R.map(r => model(r, 2).d), .5)} / ${q(R.map(r => model(r, 4).d), .5)} / ${q(R.map(r => model(r, 5.6).d), .5)};  |TWA| at +2/+4 s: ${q(R.map(r => at(r, 2, 1)), .5)} / ${q(R.map(r => at(r, 4, 1)), .5)};  tgs kt med ${q(R.map(r => r.start.tgs * 4), .5)}  behindC med ${q(R.map(r => r.start.behindC), .5)}`);
  } }
{ const O = rows.filter(r => r.start.gunOcs && r.start.ocsClearT != null && r.cross != null && r.start.run && r.start.run.length);
  if (O.length) {
    const seg = (r) => r.start.run.filter(p => p[0] >= r.start.commit + r.start.ocsClearT && p[0] <= r.start.commit + r.cross);
    const ir = O.map(r => { const S = seg(r); return S.length ? 100 * S.filter(p => p[1] < 0.55).length / S.length : null; });
    const sl = O.map(r => { const S = seg(r); return S.length ? 100 * S.filter(p => p[2] < 1.0).length / S.length : null; });
    const minSp = O.map(r => { const S = seg(r); return S.length ? Math.min(...S.map(p => p[2])) : null; });
    const dn = O.map(r => { const S = seg(r); return S.length ? 100 * S.filter(p => p[1] > 1.9).length / S.length : null; });
    const maxBehind = O.map(r => { const S = seg(r); return S.length ? Math.max(...S.map(p => p[3])) : null; });
    console.log(`   OCS RETURN PROFILE clear→cross (n=${O.length}, traced ${O.filter(r => seg(r).length > 3).length}): irons(<0.55) ${q(ir, .5)}% med (p75 ${q(ir, .75)}), under 1 kt ${q(sl, .5)}% (p75 ${q(sl, .75)}), min speed ${q(minSp, .5)} kt, running(>1.9) ${q(dn, .5)}%, deepest behind ${q(maxBehind, .5)} u (p75 ${q(maxBehind, .75)})`);
  } }
console.log(`   prestart fries per boat ${mean(rows.map(r => r.preFries))}`);
if (rows[0].mans) {
    const L = rows[0].mans.length; const m = [];
    for (let i = 0; i < L; i++) m.push(mean(rows.map(r => r.mans && r.mans[i])));
    console.log(`   manoeuvres per leg (mean/boat): ${m.join(' ')}`);
}
