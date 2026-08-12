// WHERE DOES THE EXTRA 11 300 UNITS GO? (2026-08-11, arctic push)
//
// `_leg1_budget`: arctic leg 1 is 2.16x = DISTANCE 1.79x x SPEED-DEFICIT 1.21x.
// Made good is IDENTICAL (1.02x) — the fleet reaches the same point having sailed
// 25 604 u against his 14 299. 97 s of the 143 s excess is that distance.
//
// On a beat, extra distance can only come from three places:
//   1. WIDTH — boards that swing further across the course than his do
//   2. ANGLE — sailing further off the wind than the polar's best VMG angle
//   3. BACKWARDS — segments that make no progress up the leg at all
// They are separable and they call for different fixes, so measure all three.
//
// The leg axis is the straight line from the leg's start point to its end point
// (mark rounding entry), per boat, so a boat that starts wide is not charged for
// the fleet's spread. Lateral = distance from that axis; along = progress on it.
//
// usage: node _beat_width.js <venue> <trials> <seed0> <tree> [fp=a,b] [leg]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeARCB');
const FParg = (process.argv[6] || '').startsWith('fp=') ? process.argv[6].slice(3).split(',') : null;
const LEG = process.argv[7] != null ? parseInt(process.argv[7]) : 1;

const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

const profile = (pts, twa) => {
    // pts: [{x,y,twa}] ; axis from first to last
    const ax = pts[pts.length - 1].x - pts[0].x, ay = pts[pts.length - 1].y - pts[0].y;
    const L = Math.hypot(ax, ay) || 1; const ux = ax / L, uy = ay / L;
    let odo = 0, back = 0, lat = [], prevAlong = 0;
    for (let i = 0; i < pts.length; i++) {
        const dx = pts[i].x - pts[0].x, dy = pts[i].y - pts[0].y;
        const along = dx * ux + dy * uy;
        lat.push(Math.abs(dx * (-uy) + dy * ux));
        if (i > 0) {
            odo += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            if (along < prevAlong) back += prevAlong - along;
        }
        prevAlong = Math.max(prevAlong, along);
    }
    return { odo, mg: L, back, latRms: Math.sqrt(mean(lat.map(v => v * v))), latP90: q(lat, .9), latMax: Math.max(...lat),
             twaMed: twa.length ? q(twa, .5) : null, twaP25: twa.length ? q(twa, .25) : null };
};

// ── HIS SIDE ────────────────────────────────────────────────────────────────
const her = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const rows = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (rows.length < 10) continue;
    const hk = F.indexOf('hdg') >= 0 ? 'hdg' : null, wk = F.indexOf('windDir') >= 0 ? 'windDir' : null;
    const pts = rows.map(s => ({ x: gi(s, 'x'), y: gi(s, 'y') }));
    const twa = [];
    if (hk && wk) for (const s of rows) {
        const d = gi(s, hk) - gi(s, wk);
        const a = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
        if (a < 1.4) twa.push(a);
    }
    her.push(profile(pts, twa));
}
if (!her.length) { console.log('no fingerprint-matching laps'); process.exit(1); }

(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const bots = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const per = {}; const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (it % 6 === 0) for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg !== LEG) continue;
                    const P = per[b.name] || (per[b.name] = { pts: [], twa: [] });
                    P.pts.push({ x: b.x, y: b.y });
                    const d = b.heading - getWindAt(b.x, b.y).direction;
                    const a = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
                    if (a < 1.4) P.twa.push(a);
                }
                if (state.race.timer > 895) break;
            }
            const fin = {}; for (const b of state.boats) if (!b.isPlayer) fin[b.name] = b.raceState.finishTime || null;
            const out = [];
            for (const k in per) if (fin[k] && per[k].pts.length > 20) out.push(per[k]);
            return out;
        }, { seed: SEED0 + t, LEG });
        for (const b of r) bots.push(profile(b.pts, b.twa));
        console.log(`seed ${SEED0 + t}: ${r.length} bot legs`);
    }
    await br.close();

    const D = (r) => r == null ? '-' : (r * 180 / Math.PI).toFixed(1) + 'deg';
    const row = (n, f, fmt) => {
        const h = mean(her.map(f)), b = mean(bots.map(f));
        console.log(`   ${n.padEnd(24)} his ${(fmt ? fmt(h) : h.toFixed(0)).padStart(10)}   bot ${(fmt ? fmt(b) : b.toFixed(0)).padStart(10)}   ratio ${(b / h).toFixed(2)}x`);
    };
    console.log(`\n=== ${VENUE.toUpperCase()} LEG ${LEG}: WIDTH, ANGLE, OR BACKWARDS? (${bots.length} bot legs, ${her.length} of his) ===`);
    row('odometer (u)', x => x.odo);
    row('made good (u)', x => x.mg);
    row('LATERAL rms (u)', x => x.latRms);
    row('LATERAL p90 (u)', x => x.latP90);
    row('LATERAL max (u)', x => x.latMax);
    row('BACKWARDS along axis (u)', x => x.back);
    row('upwind |TWA| median', x => x.twaMed, D);
    row('upwind |TWA| p25', x => x.twaP25, D);
    // what an ideal beat at the observed angle would have cost
    const hT = mean(her.map(x => x.twaMed)), bT = mean(bots.map(x => x.twaMed));
    const hMg = mean(her.map(x => x.mg)), bMg = mean(bots.map(x => x.mg));
    console.log(`\n   an IDEAL beat (no width, no backwards) at each side's own median angle would sail:`);
    console.log(`      his ${(hMg / Math.cos(hT)).toFixed(0)}u vs his actual ${mean(her.map(x => x.odo)).toFixed(0)}u  (excess ${(mean(her.map(x => x.odo)) - hMg / Math.cos(hT)).toFixed(0)}u)`);
    console.log(`      bot ${(bMg / Math.cos(bT)).toFixed(0)}u vs bot actual ${mean(bots.map(x => x.odo)).toFixed(0)}u  (excess ${(mean(bots.map(x => x.odo)) - bMg / Math.cos(bT)).toFixed(0)}u)`);
})();
