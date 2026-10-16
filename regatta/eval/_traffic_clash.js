// Traffic clash finder: every vessel pair over the race window, on the editor's capsule hull
// model (js/editor.js trafficClashes), plus each hull against hard-prop collider rings and
// land outlines. Usage: node eval/_traffic_clash.js [venue] [toSeconds] [venueFile]
global.window = global;
const vm = require('vm'), fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '..');
for (const f of ['js/scale.js', 'js/prop_outlines.js', 'js/venuedoc.js', 'js/traffic.js'])
    vm.runInThisContext(fs.readFileSync(path.join(R, f), 'utf8'));
const venue = process.argv[2] || 'bay';
require(process.argv[4] ? path.resolve(process.argv[4]) : path.join(R, 'assets/venues', venue + '.venue.js'));
const d = VENUE_DOC[venue], K = VenueDoc.PROP_KINDS;
const c = d.course || {};
let cutoff = c.cutoff; if (cutoff == null) { try { cutoff = VenueDoc.compile(d).cutoffAuto; } catch (e) { cutoff = 0; } }
const from = -(c.startTime != null ? c.startTime : 30) - 60;   // a minute of loitering in the prestart too
const to = +(process.argv[3] || Math.max(900, cutoff || 0));
const hullOf = (v) => {
    const kd = K[v.kind] || {}, hull = v.hull || kd.hull || [0.9, 0.3], w = (kd.world || 40) * (v.scale || 1);
    const len = hull[0] * w, beam = hull[1] * w;
    return { r: beam * 0.5, half: Math.max(1, len * 0.5 - beam * 0.5), len, beam };
};
function segSeg(a1, a2, b1, b2) {
    const ux = a2.x - a1.x, uy = a2.y - a1.y, vx = b2.x - b1.x, vy = b2.y - b1.y, wx = a1.x - b1.x, wy = a1.y - b1.y;
    const a = ux * ux + uy * uy, b = ux * vx + uy * vy, cc = vx * vx + vy * vy, dd = ux * wx + uy * wy, e = vx * wx + vy * wy;
    const D = a * cc - b * b; let sc, tc;
    if (D < 1e-9) { sc = 0; tc = cc > 1e-9 ? e / cc : 0; } else { sc = (b * e - cc * dd) / D; tc = (a * e - b * dd) / D; }
    sc = Math.max(0, Math.min(1, sc)); tc = Math.max(0, Math.min(1, tc));
    return Math.hypot(a1.x + ux * sc - (b1.x + vx * tc), a1.y + uy * sc - (b1.y + vy * tc));
}
function segPt(a, b, p) {
    const ux = b.x - a.x, uy = b.y - a.y, L = ux * ux + uy * uy;
    const t = L > 0 ? Math.max(0, Math.min(1, ((p[0] - a.x) * ux + (p[1] - a.y) * uy) / L)) : 0;
    return Math.hypot(a.x + ux * t - p[0], a.y + uy * t - p[1]);
}
const ships = d.traffic.map(v => ({ v, c: Traffic.compilePath(v), h: hullOf(v) })).filter(s => s.c);
const pose = (s, t) => {
    const l = Traffic.localTime(s.v, s.c, t); if (!l) return null;
    const q = s.c.at(l.t), hd = l.reverse ? q.heading + Math.PI : q.heading;
    const fx = Math.sin(hd) * s.h.half, fy = -Math.cos(hd) * s.h.half;
    return { a: { x: q.x - fx, y: q.y - fy }, b: { x: q.x + fx, y: q.y + fy }, x: q.x, y: q.y, kn: q.knots, lt: l.t };
};
const STEP = 0.1;
const enc = new Map();
for (let t = from; t <= to; t += STEP) {
    const P = ships.map(s => pose(s, t));
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const A = P[i], B = P[j]; if (!A || !B) continue;
        if (Math.abs(A.x - B.x) > 2000 || Math.abs(A.y - B.y) > 2000) continue;
        const gap = segSeg(A.a, A.b, B.a, B.b) - ships[i].h.r - ships[j].h.r;
        const key = i + ',' + j; let L = enc.get(key); if (!L) enc.set(key, L = []);
        const last = L[L.length - 1];
        if (gap < 150) {
            if (last && t - last.t1 < 5) { last.t1 = t; if (gap < last.gap) Object.assign(last, { gap, tm: t, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, la: A.lt, lb: B.lt }); }
            else L.push({ t0: t, t1: t, gap, tm: t, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, la: A.lt, lb: B.lt });
        }
    }
}
const name = (s) => (s.v.name || s.v.id);
console.log(`window ${from}..${to}s  cutoff ${cutoff}`);
console.log('— vessel pairs (gap = clearance between hulls, u; <0 overlap) —');
let any = false;
for (const [k, L] of enc) { const [i, j] = k.split(',').map(Number);
    for (const e of L) { if (e.gap > 40) continue; any = true;
        console.log(`${e.gap < 0 ? 'CLASH' : 'close'} ${name(ships[i])} × ${name(ships[j])}  gap ${e.gap.toFixed(0)}u  t ${e.t0.toFixed(0)}..${e.t1.toFixed(0)} (min @${e.tm.toFixed(1)}; local ${e.la.toFixed(0)}/${e.lb.toFixed(0)})  at ${e.x | 0},${e.y | 0}`); } }
if (!any) console.log('none under 40u');
// Static: hull vs hard prop rings and land, along each path (not time-dependent).
function dens(rg, step) { const o = []; for (let j = 0; j < rg.length; j++) { const a = rg[j], b = rg[(j + 1) % rg.length]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let i = 0; i < n; i++) o.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); } return o; }
const obs = [];
for (const p of d.props) { if (!K[p.kind] || K[p.kind].contact !== 'hard') continue; const h = VenueDoc.propHitRings(p); for (const rg of h.rings || []) for (const q of dens(rg, 5)) obs.push([q[0], q[1], p.id + ':' + p.kind.replace(/^bay-(bay-)?cove-/, '')]); }
for (const s of d.shapes) if (s.outer && !/water|shoal|shallow|zone|kelp|weed|reef/.test(s.kind)) for (const q of dens(s.outer, 6)) obs.push([q[0], q[1], (s.id || '') + ':' + s.kind]);
console.log('— hull vs hard props / land (along the path; first/last 3% ignored as off-screen ends) —');
for (const s of ships) {
    const len = s.c.length, hits = new Map();
    for (let a = len * 0.03; a <= len * 0.97; a += 8) {
        const q = s.c.atArc(a), fx = Math.sin(q.heading) * s.h.half, fy = -Math.cos(q.heading) * s.h.half;
        const A = { x: q.x - fx, y: q.y - fy }, B = { x: q.x + fx, y: q.y + fy };
        for (const o of obs) { if (Math.abs(o[0] - q.x) > s.h.len || Math.abs(o[1] - q.y) > s.h.len) continue;
            const g = segPt(A, B, o) - s.h.r; if (g < 0) { const h = hits.get(o[2]); if (!h || g < h.g) hits.set(o[2], { g, x: o[0] | 0, y: o[1] | 0, a: a | 0 }); } } }
    for (const [k, h] of hits) console.log(`${name(s).padEnd(18)} hits ${k}  by ${(-h.g).toFixed(0)}u  at ${h.x},${h.y} (arc ${h.a}/${len | 0})`);
}
