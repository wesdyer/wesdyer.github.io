// THE GLOBAL GAP LEDGER — bot-vs-human decomposed from the SAME races.
// Schema-2 recordings carry all 9 rivals live (x,y,hdg,spd,tack @10Hz) plus
// per-rival leg counters — the human and the fleet sailed the same wind, the
// same gusts, the same traffic. So the gap decomposes with zero seed noise:
//   Δleg    — per-leg time, human vs fleet median (legs the fleet completed
//             before the recording ended)
//   Δodo    — excess distance sailed per completed leg
//   Δslow   — time under 1 kt and under 4 kt (racing phase)
//   Δspeed  — average speed while moving (>4 kt)
//   behind@finish — fleet legProg deficit when the human finishes
//   node _gap_ledger.js [venueFilter]
const fs = require('fs'); const path = require('path');
const DIR = path.join(__dirname, 'traj');
const FILTER = process.argv[2] || null;
const files = fs.readdirSync(DIR).filter(f => f.startsWith('traj_') && f.endsWith('.json'))
    .filter(f => !FILTER || f.includes(FILTER));
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const byVenue = {};
for (const f of files) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(DIR, f))); } catch (e) { continue; }
    if (j.schema !== 2 || !j.samples || !j.samples.length) continue;
    const F = j.format;
    const gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples;
    const human = { odo: 0, sub1: 0, sub4: 0, movT: 0, movD: 0, legT: {}, fin: j.finishTime ?? j.finish ?? null };
    const NR = (gi(S[0], 'rivals') || []).length;
    const riv = Array.from({ length: NR }, () => ({ odo: 0, sub1: 0, sub4: 0, movT: 0, movD: 0, legT: {}, leg: 0, fin: null, lastProg: 0 }));
    let prev = null, prevLegH = 0;
    for (const s of S) {
        const phase = gi(s, 'phase');
        const t = gi(s, 't');
        if (phase !== 1) { prev = s; continue; }
        if (prev && gi(prev, 'phase') === 1) {
            const dt = t - gi(prev, 't');
            if (dt <= 0 || dt > 2) { prev = s; continue; }
            // human
            const dx = gi(s, 'x') - gi(prev, 'x'), dy = gi(s, 'y') - gi(prev, 'y');
            const d = Math.hypot(dx, dy);
            const kt = gi(s, 'spd') * 4;
            human.odo += d;
            if (kt < 1) human.sub1 += dt;
            if (kt < 4) human.sub4 += dt; else { human.movT += dt; human.movD += d; }
            const legH = gi(s, 'leg');
            if (legH !== prevLegH) { human.legT[prevLegH] = t; prevLegH = legH; }
            // rivals
            const rv = gi(s, 'rivals') || [], rvp = gi(prev, 'rivals') || [];
            const rx = gi(s, 'rivalsX') || [];
            for (let k = 0; k < NR; k++) {
                if (!rv[k] || !rvp[k]) continue;
                const rdx = rv[k][0] - rvp[k][0], rdy = rv[k][1] - rvp[k][1];
                const rd = Math.hypot(rdx, rdy);
                if (rd > 200) continue;   // teleport/respawn artifact
                const rkt = rv[k][3] * 4;
                const R = riv[k];
                R.odo += rd;
                if (rkt < 1) R.sub1 += dt;
                if (rkt < 4) R.sub4 += dt; else { R.movT += dt; R.movD += rd; }
                if (rx[k]) {
                    const rleg = rx[k][1];
                    if (rleg !== R.leg) { R.legT[R.leg] = t; R.leg = rleg; }
                    R.lastProg = rleg + (rx[k][2] || 0);
                }
            }
        }
        prev = s;
    }
    const v = j.venue;
    const B = byVenue[v] = byVenue[v] || { files: 0, h: [], r: [], behind: [] };
    B.files++;
    B.h.push(human);
    // fleet medians for this race
    const rr = riv.filter(R => R.odo > 500);
    B.r.push({
        odo: med(rr.map(R => R.odo)), sub1: med(rr.map(R => R.sub1)), sub4: med(rr.map(R => R.sub4)),
        movSpd: med(rr.map(R => R.movT > 0 ? R.movD / R.movT : 0)),
        legT: {}, n: rr.length,
        legMeds: (() => {
            const out = {};
            const legs = new Set(); rr.forEach(R => Object.keys(R.legT).forEach(l => legs.add(l)));
            for (const l of legs) {
                const ts = rr.filter(R => R.legT[l] != null).map(R => R.legT[l]);
                if (ts.length >= Math.ceil(rr.length / 2)) out[l] = +med(ts).toFixed(0);
            }
            return out;
        })(),
        behindProg: med(riv.map(R => R.lastProg))
    });
}
for (const v of Object.keys(byVenue)) {
    const B = byVenue[v];
    console.log(`\n== ${v} (${B.files} recordings) ==`);
    const hOdo = med(B.h.map(h => h.odo)), rOdo = med(B.r.map(r => r.odo));
    const hM = med(B.h.map(h => h.movT > 0 ? h.movD / h.movT : 0)), rM = med(B.r.map(r => r.movSpd));
    const hS1 = med(B.h.map(h => h.sub1)), rS1 = med(B.r.map(r => r.sub1));
    const hS4 = med(B.h.map(h => h.sub4)), rS4 = med(B.r.map(r => r.sub4));
    console.log(`  odometer  H ${hOdo.toFixed(0)}  F ${rOdo.toFixed(0)}  (excess ${(rOdo / hOdo).toFixed(2)}x, ${((rOdo - hOdo)).toFixed(0)}u ≈ ${((rOdo - hOdo) / (rM || 1)).toFixed(0)}s at fleet pace)`);
    console.log(`  moving speed (>4kt legs)  H ${(hM * 4 / 4).toFixed(1)} u/s  F ${(rM).toFixed(1)} u/s  (deficit → ${(hOdo / (rM || 1) - hOdo / (hM || 1)).toFixed(0)}s over human's distance)`);
    console.log(`  time <1kt  H ${hS1.toFixed(0)}s  F ${rS1.toFixed(0)}s   |  time <4kt  H ${hS4.toFixed(0)}s  F ${rS4.toFixed(0)}s`);
    const hLegs = {}; B.h.forEach(h => Object.entries(h.legT).forEach(([l, t]) => (hLegs[l] = hLegs[l] || []).push(t)));
    const hlegStr = Object.keys(hLegs).sort().map(l => `${l}:${med(hLegs[l]).toFixed(0)}`).join(' ');
    const rlegStr = Object.keys(B.r[0].legMeds || {}).sort().map(l => {
        const ts = B.r.map(r => r.legMeds[l]).filter(x => x != null);
        return ts.length ? `${l}:${med(ts)}` : null;
    }).filter(Boolean).join(' ');
    console.log(`  cum leg-completion t  H { ${hlegStr} }  F { ${rlegStr} }`);
    console.log(`  human finish med ${med(B.h.map(h => h.fin)).toFixed(1)}  |  fleet median progress at end: leg+frac ${med(B.r.map(r => r.behindProg)).toFixed(2)}`);
}
