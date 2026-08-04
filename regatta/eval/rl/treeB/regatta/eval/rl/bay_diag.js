// Per-leg diagnosis from a bay_trace JSON vs human trajectories.
// node bay_diag.js <seed> — prints per-bot per-leg: duration, dist ratio, tacks, avg spd.
const fs = require('fs'); const path = require('path');
const SEED = process.argv[2] || '9100';
const T = JSON.parse(fs.readFileSync(path.join(__dirname, `bay_trace_${SEED}.json`)));
const legLens = [0, 2943, 3088, 4295, 4456, 4125, 2597];
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

// Human aggregate for comparison
const dir = path.join(__dirname, 'traj');
const hAgg = {};   // leg -> {dur:[], dist:[], tacks:[]}
for (const f of fs.readdirSync(dir).filter(f => f.startsWith('traj_bay'))) {
    const t = JSON.parse(fs.readFileSync(path.join(dir, f)));
    const S = t.samples;
    const per = {};
    for (let i = 1; i < S.length; i++) {
        const s = S[i], p = S[i - 1];
        if (s[1] !== 1) continue;
        const lg = s[8];
        if (p[8] !== lg) continue;
        const e = per[lg] = per[lg] || { t0: p[0], t1: s[0], dist: 0, tacks: 0, lastSgn: 0, spd: [] };
        e.t1 = s[0];
        e.dist += Math.hypot(s[2] - p[2], s[3] - p[3]);
        e.spd.push(s[5]);
        const twa = ((s[4] - s[6] + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const sgn = Math.sign(twa);
        // count a tack only when |twa| small-ish at the flip (upwind manoeuvre) or any flip through head-to-wind
        if (e.lastSgn && sgn && sgn !== e.lastSgn && Math.abs(twa) < 1.6) e.tacks++;
        if (sgn) e.lastSgn = sgn;
    }
    for (const [lg, e] of Object.entries(per)) {
        if (lg < 1) continue;
        const a = hAgg[lg] = hAgg[lg] || { dur: [], dist: [], tacks: [], spd: [] };
        a.dur.push(e.t1 - e.t0); a.dist.push(e.dist); a.tacks.push(e.tacks);
        a.spd.push(e.spd.reduce((x, y) => x + y, 0) / e.spd.length);
    }
}
console.log('HUMAN med per leg: dur / dist-ratio / tacks / avg-spd');
for (let lg = 1; lg <= 6; lg++) {
    const a = hAgg[lg];
    console.log(`L${lg}: ${Math.round(med(a.dur))}s  ${(med(a.dist) / legLens[lg]).toFixed(2)}  ${med(a.tacks)}  ${med(a.spd).toFixed(1)}`);
}

console.log('\nBOTS (seed ' + SEED + '): per-leg dur / dist-ratio / tacks / avg-spd / slow-secs(<2.5)');
const legStats = {};
for (let k = 0; k < T.names.length; k++) {
    const R = T.rows[k];
    const per = {};
    for (let i = 1; i < R.length; i++) {
        const s = R[i], p = R[i - 1];
        const lg = s[3];
        if (p[3] !== lg) continue;
        const e = per[lg] = per[lg] || { t0: p[0], t1: s[0], dist: 0, tacks: 0, lastSgn: 0, spd: [], slow: 0 };
        e.t1 = s[0];
        e.dist += Math.hypot(s[1] - p[1], s[2] - p[2]);
        e.spd.push(s[4]);
        if (s[4] < 2.5) e.slow++;
        const sgn = Math.sign(s[5]);
        if (e.lastSgn && sgn && sgn !== e.lastSgn && Math.abs(s[5]) < 1.6) e.tacks++;
        if (sgn) e.lastSgn = sgn;
    }
    const parts = [];
    for (let lg = 1; lg <= 6; lg++) {
        const e = per[lg];
        if (!e) { parts.push(`L${lg}:-`); continue; }
        const a = legStats[lg] = legStats[lg] || { dur: [], ratio: [], tacks: [], spd: [], slow: [] };
        a.dur.push(e.t1 - e.t0); a.ratio.push(e.dist / legLens[lg]); a.tacks.push(e.tacks);
        a.spd.push(e.spd.reduce((x, y) => x + y, 0) / e.spd.length); a.slow.push(e.slow);
        parts.push(`L${lg}:${Math.round(e.t1 - e.t0)}s/${(e.dist / legLens[lg]).toFixed(2)}/${e.tacks}t/${e.slow}sl`);
    }
    console.log(T.names[k].padEnd(12), parts.join(' '));
}
console.log('\nBOT MEDIANS: dur / dist-ratio / tacks / avg-spd / slow-secs   (human in parens)');
for (let lg = 1; lg <= 6; lg++) {
    const a = legStats[lg]; if (!a) continue;
    const h = hAgg[lg];
    console.log(`L${lg}: ${Math.round(med(a.dur))}s(${Math.round(med(h.dur))})  ${med(a.ratio).toFixed(2)}(${(med(h.dist) / legLens[lg]).toFixed(2)})  ${med(a.tacks)}(${med(h.tacks)})  ${med(a.spd).toFixed(1)}(${med(h.spd).toFixed(1)})  slow ${med(a.slow)}`);
}
