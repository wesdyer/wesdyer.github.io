// ANALYZER for _chain_traj.js — answers Q1-Q5 about what sustains a re-hit chain.
//
// Chains = consecutive hit-episodes by one boat, gap < 5 s, < 150u apart. For each
// inter-hit interval the wall TANGENT is the chord between the two hit positions;
// the OUTWARD normal is the side the boat's own samples occupy. Directions use the
// game convention (ocean_bench): a heading/wind angle a maps to the unit vector
// (sin a, -cos a); TWA 0 = head-to-wind (standing rule 19).
//
//   node _chain_traj_report.js <label>
const fs = require('fs'), path = require('path');
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const med = a => q(a, 0.5), mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const f1 = x => x == null ? '-' : x.toFixed(2);

const LABEL = process.argv[2] || 'rr';
const sets = JSON.parse(fs.readFileSync(path.join(__dirname, `_chaintraj_${LABEL}.json`), 'utf8'));

const OWN = { 1: 'spin', 2: 'escape', 3: 'reflex', 4: 'wiggle', 5: 'nav' };
const agg = {
    intervals: 0, chains: 0, ownT: {}, cmdIntoByOwn: {}, cmdNByOwn: {},
    leeComp: [], twaAbs: [], closehauled: 0, twaN: 0, tacks: 0, chainHits: 0,
    maxOff: [], vAt: { 0.5: [], 1: [], 2: [], 3: [] }, spdLim: [],
};
for (const s of sets) {
    // group hits per boat
    const byBoat = {};
    for (const h of s.hits) (byBoat[h.n] = byBoat[h.n] || []).push(h);
    const samp = {};
    for (const r of s.samples) (samp[r[0]] = samp[r[0]] || []).push(r);
    for (const [name, hits] of Object.entries(byBoat)) {
        const S = samp[name] || [];
        // build chains
        let chain = [hits[0]];
        const chains = [];
        for (let i = 1; i < hits.length; i++) {
            const a = hits[i - 1], b = hits[i];
            if (b.t - a.t < 6 && Math.hypot(b.x - a.x, b.y - a.y) < 150) chain.push(b);
            else { if (chain.length >= 3) chains.push(chain); chain = [b]; }
        }
        if (chain.length >= 3) chains.push(chain);
        for (const ch of chains) {
            agg.chains++; agg.chainHits += ch.length;
            let prevTwaSign = null;
            for (let i = 0; i + 1 < ch.length; i++) {
                const a = ch[i], b = ch[i + 1];
                const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
                if (L < 5) continue;
                const ux = dx / L, uy = dy / L;         // wall tangent
                let nx = -uy, ny = ux;                   // normal candidate
                const iv = S.filter(r => r[1] > a.t && r[1] < b.t);
                if (iv.length < 2) continue;
                // outward = side the boat occupies
                const lat = iv.map(r => (r[2] - a.x) * nx + (r[3] - a.y) * ny);
                if (mean(lat) < 0) { nx = -nx; ny = -ny; }
                agg.intervals++;
                agg.maxOff.push(Math.max(...iv.map(r => Math.abs((r[2] - a.x) * nx + (r[3] - a.y) * ny))));
                for (const r of iv) {
                    const [, t, x, y, hd, cmd, wd, v, own, lim] = r;
                    const dth = t - a.t;
                    agg.ownT[own] = (agg.ownT[own] || 0) + 1;
                    // commanded direction vs outward normal
                    const cx = Math.sin(cmd), cy = -Math.cos(cmd);
                    const into = cx * nx + cy * ny; // negative = commanding into the wall side...
                    // (outward is +n, so into-wall = negative component)
                    agg.cmdNByOwn[own] = (agg.cmdNByOwn[own] || 0) + 1;
                    if (into < -0.2) agg.cmdIntoByOwn[own] = (agg.cmdIntoByOwn[own] || 0) + 1;
                    // lee shore: downwind vector = -(sin wd, -cos wd)
                    const dwx = -Math.sin(wd), dwy = Math.cos(wd);
                    agg.leeComp.push(dwx * nx + dwy * ny);
                    // TWA
                    const twa = norm(hd - wd);
                    agg.twaAbs.push(Math.abs(twa)); agg.twaN++;
                    if (Math.abs(twa) > 0.55 && Math.abs(twa) < 1.05) agg.closehauled++;
                    const sgn = twa > 0 ? 1 : -1;
                    if (prevTwaSign != null && sgn !== prevTwaSign && Math.abs(twa) < 1.4) agg.tacks++;
                    prevTwaSign = sgn;
                    agg.spdLim.push(lim);
                    for (const k of [0.5, 1, 2, 3]) if (Math.abs(dth - k) < 0.06) agg.vAt[k].push(v);
                }
            }
        }
    }
}
console.log(`\n=== ${LABEL}: ${agg.chains} chains (>=3 hits), ${agg.chainHits} hits, ${agg.intervals} inter-hit intervals ===`);
const totOwn = Object.values(agg.ownT).reduce((a, b) => a + b, 0) || 1;
console.log('Q1 helm owner over inter-hit samples: ' + Object.entries(agg.ownT).sort((a, b) => b[1] - a[1]).map(([o, n]) => `${OWN[o]} ${(100 * n / totOwn).toFixed(0)}%`).join('  '));
console.log(`Q5 commanded INTO the wall (cmp < -0.2), by owner: ` + Object.keys(agg.cmdNByOwn).sort().map(o => `${OWN[o]} ${(100 * (agg.cmdIntoByOwn[o] || 0) / agg.cmdNByOwn[o]).toFixed(0)}% (n=${agg.cmdNByOwn[o]})`).join('  '));
console.log(`Q2 lee-shore component (downwind . outward): med ${f1(med(agg.leeComp))}  (negative = wind pushes ONTO the wall; share<-0.2: ${(100 * agg.leeComp.filter(x => x < -0.2).length / agg.leeComp.length).toFixed(0)}%)`);
console.log(`Q3 |TWA| during chains: med ${f1(med(agg.twaAbs))} rad  close-hauled (0.55-1.05) ${(100 * agg.closehauled / agg.twaN).toFixed(0)}%  in-irons (<0.55) ${(100 * agg.twaAbs.filter(x => x < 0.55).length / agg.twaN).toFixed(0)}%`);
console.log(`Q4 tacks during chains: ${agg.tacks} over ${agg.chains} chains = ${(agg.tacks / Math.max(1, agg.chains)).toFixed(2)} per chain`);
console.log(`max standoff from wall chord per interval: med ${f1(med(agg.maxOff))}u  p90 ${f1(q(agg.maxOff, .9))}u`);
console.log(`speed by time-since-hit: ` + [0.5, 1, 2, 3].map(k => `${k}s ${med(agg.vAt[k]) == null ? '-' : med(agg.vAt[k]).toFixed(0)}`).join('  ') + ' u/s');
console.log(`speedLimit during chains: med ${f1(med(agg.spdLim))}  share<0.95: ${(100 * agg.spdLim.filter(x => x < 0.95).length / agg.spdLim.length).toFixed(0)}%`);
