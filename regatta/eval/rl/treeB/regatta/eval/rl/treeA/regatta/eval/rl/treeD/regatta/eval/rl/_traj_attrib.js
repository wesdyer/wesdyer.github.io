// Human-side counterpart of _transit_probe/_bay_bulge_probe attribution:
// same weave/lateral decomposition + tack/gybe counts from the banked 10Hz
// trajectories, so bot bins compare like-for-like.
//   node _traj_attrib.js arctic   -> transit (leg1 pre-arm) + ret (leg2)
//   node _traj_attrib.js bay      -> legs 3/5 TWA histogram + east offset
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const dir = path.join(__dirname, 'traj');
const files = fs.readdirSync(dir).filter(f => f.startsWith('traj_' + VENUE));
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

let dmc = null;
if (VENUE === 'bay') dmc = JSON.parse(fs.readFileSync(path.join(__dirname, 'bay_dmc.json'), 'utf8'));
const projPt = (L, s) => {
    const pts = L.pts; let cum = 0;
    for (let k = 0; k < pts.length - 1; k++) {
        const seg = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
        if (cum + seg >= s || k === pts.length - 2) {
            const t = Math.max(0, Math.min(1, (s - cum) / Math.max(1e-6, seg)));
            return { x: pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, y: pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t };
        }
        cum += seg;
    }
    return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
};

const rows = [];
for (const f of files) {
    const tr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const S = tr.samples;
    // segment state, keyed by phase name
    const segs = {};
    const mk = () => ({ t0: null, t1: null, odo: 0, ds: 0, weave: 0, lateral: 0,
        tacks: 0, gybes: 0, px: null, py: null, sPrev: null, board: 0,
        wx: null, wy: null, wOdo: 0, wT: null, twaH: [0, 0, 0, 0], eSum: 0, eN: 0, twsSum: 0 });
    for (const q of S) {
        const [t, phase, x, y, hdg, spd, wd, ws, leg, sweep, armed] = q;
        const legProg = q[13];
        if (phase !== 1 && phase !== 'racing' && phase !== 0) { /* keep going; phase enum unknown */ }
        let ph = null;
        if (VENUE === 'arctic') {
            if (leg === 1 && !armed) ph = 'transit';
            else if (leg === 2) ph = 'ret';
        } else {
            if (leg === 3) ph = 'L3'; else if (leg === 5) ph = 'L5';
        }
        if (ph == null) continue;
        const g = segs[ph] = segs[ph] || mk();
        if (g.t0 == null) { g.t0 = t; g.px = x; g.py = y; g.sPrev = legProg; g.wx = x; g.wy = y; g.wT = t; }
        g.t1 = t;
        const step = Math.hypot(x - g.px, y - g.py);
        g.odo += step; g.wOdo += step;
        if (legProg != null && g.sPrev != null) { const d = legProg - g.sPrev; if (d > 0 && d < 500) g.ds += d; }
        g.sPrev = legProg;
        g.px = x; g.py = y;
        const twa = norm(hdg - wd);
        if (Math.abs(twa) > 0.2 && Math.abs(twa) < Math.PI - 0.2) {
            const nb = twa > 0 ? 1 : -1;
            if (g.board !== 0 && nb !== g.board) {
                if (Math.abs(twa) < Math.PI / 2) g.tacks++; else g.gybes++;
            }
            g.board = nb;
        }
        const at = Math.abs(twa) * 180 / Math.PI;
        g.twaH[at < 125 ? 0 : at < 145 ? 1 : at < 160 ? 2 : 3]++;
        g.twsSum += ws;
        if (dmc && legProg != null) {
            const L = dmc.legs[leg];
            if (L && L.pts.length > 1) { const xp = projPt(L, legProg); g.eSum += x - xp.x; g.eN++; }
        }
        if (t - g.wT >= 1.0) {   // 1s window close
            const disp = Math.hypot(x - g.wx, y - g.wy);
            g.weave += Math.max(0, g.wOdo - disp);
            g.lateral += Math.max(0, disp);   // lateral computed at end vs ds
            g.wx = x; g.wy = y; g.wOdo = 0; g.wT = t;
        }
    }
    for (const ph in segs) {
        const g = segs[ph];
        if (g.t1 - g.t0 < 5) continue;
        rows.push({ file: f, ph, t: g.t1 - g.t0, odo: g.odo, ds: g.ds, weave: g.weave,
            lateral: Math.max(0, g.lateral - g.ds), tacks: g.tacks, gybes: g.gybes,
            twaH: g.twaH, east: g.eN ? g.eSum / g.eN : null, tws: g.twsSum / Math.max(1, g.twaH.reduce((a, b) => a + b, 0)) });
    }
}
const phases = VENUE === 'arctic' ? ['transit', 'ret'] : ['L3', 'L5'];
for (const ph of phases) {
    const g = rows.filter(r => r.ph === ph);
    if (!g.length) { console.log(`${ph}: no data`); continue; }
    console.log(`\nHUMAN ${ph} (n=${g.length}):`);
    console.log(`  time med ${med(g.map(r => r.t)).toFixed(0)}  odo med ${med(g.map(r => r.odo)).toFixed(0)}  ds med ${med(g.map(r => r.ds)).toFixed(0)}  ratio(odo/ds) med ${med(g.map(r => r.odo / Math.max(1, r.ds))).toFixed(2)}`);
    console.log(`  weave mean ${mean(g.map(r => r.weave)).toFixed(0)}u  lateral(disp-ds) mean ${mean(g.map(r => r.lateral)).toFixed(0)}u`);
    console.log(`  tacks med ${med(g.map(r => r.tacks))} mean ${mean(g.map(r => r.tacks)).toFixed(1)}  gybes med ${med(g.map(r => r.gybes))} mean ${mean(g.map(r => r.gybes)).toFixed(1)}`);
    const h = [0, 1, 2, 3].map(i => mean(g.map(r => r.twaH[i])));
    const hn = h.reduce((a, b) => a + b, 0);
    console.log(`  TWA sailed: <125 ${(100 * h[0] / hn).toFixed(0)}% | 125-145 ${(100 * h[1] / hn).toFixed(0)}% | 145-160 ${(100 * h[2] / hn).toFixed(0)}% | 160-180 ${(100 * h[3] / hn).toFixed(0)}%  TWS mean ${mean(g.map(r => r.tws)).toFixed(1)}`);
    if (VENUE === 'bay') console.log(`  east offset mean ${mean(g.filter(r => r.east != null).map(r => r.east)).toFixed(0)}u`);
}
