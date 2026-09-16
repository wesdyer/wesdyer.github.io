// BUILD SPOONBILL FLATS — the tidal estuary, laid from a handful of authored lines.
//
//   node regatta/art/build_flats.js                 writes assets/venues/flats.venue.js
//   node regatta/art/build_flats.js --dry           prints the summary, writes nothing
//
// Then bake the chart paths and price it:
//   VENUE=flats NODE_PATH=node_modules node regatta/eval/_venue_bake.js
//
// THE DESIGN (guidelines/flats-design.md §5, "The Wantij"). One-way: a short beat offshore
// to a rounding mark, bear away through a wide mouth between two sand spits, then a braided
// basin whose deep channel runs round the outside in an S with the finish inland. Three
// choices on one clock: the WANTIJ (a divide crossing across the first loop's interior,
// with a pool to wait in and a sill at its exit), the POINT BAR (a shelving inside at the
// big west bend that lets the higher water cut tighter), and the FLOOD CREEK (a shallower
// branch round a diamond bar in the upper estuary that carries a stronger flood stream and
// ends in a sill). The field between the channels and the marsh is the tide's (js/tide.js):
// this script only lays the anchors — channel polygons from centrelines, marsh islands where
// the ground must stay high, bars where a crest is wanted, pools and shelves where the
// distance rule would not give the height the design needs.
//
// Deterministic; re-run after changing anything below. It writes NO course.paths — bake them.
// ⚠️ It OVERWRITES the venue document: hand edits made in editor.html are lost on a re-run,
// so either edit this script or stop re-running it.
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.includes('--dry');
const OUT = path.resolve(__dirname, '..', 'assets', 'venues', 'flats.venue.js');

// ── geometry helpers ─────────────────────────────────────────────────────────
const R = (v, d = 1) => Math.round(v * (10 ** d)) / (10 ** d);
let seed = 0x5eed1234;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

// Catmull-Rom through the control points, `per` samples a span.
function spline(pts, per = 8) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        for (let k = 0; k < per; k++) {
            const t = k / per, t2 = t * t, t3 = t2 * t;
            out.push([
                0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            ]);
        }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
}
// A ribbon polygon round a polyline: width may be a number or a function of 0..1 along it.
function ribbon(line, width, wobble = 0) {
    const n = line.length, L = [], Rr = [];
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const total = cum[n - 1] || 1;
    for (let i = 0; i < n; i++) {
        const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const nx = -ty, ny = tx;
        const s = cum[i] / total;
        const w = (typeof width === 'function' ? width(s) : width) / 2;
        const wl = w * (1 + wobble * (rnd() - 0.5)), wr = w * (1 + wobble * (rnd() - 0.5));
        L.push([line[i][0] + nx * wl, line[i][1] + ny * wl]);
        Rr.push([line[i][0] - nx * wr, line[i][1] - ny * wr]);
    }
    return L.concat(Rr.reverse()).map(p => [R(p[0]), R(p[1])]);
}
// A blob: a noisy ellipse.
function blob(cx, cy, rx, ry, n = 14, rough = 0.18, rot = 0) {
    const out = [];
    const ph = rnd() * 6.283;
    for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const r = 1 + rough * (Math.sin(a * 3 + ph) * 0.5 + Math.sin(a * 5 + ph * 1.7) * 0.3 + (rnd() - 0.5) * 0.4);
        const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
        out.push([R(cx + x * Math.cos(rot) - y * Math.sin(rot)), R(cy + x * Math.sin(rot) + y * Math.cos(rot))]);
    }
    return out;
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// Andrew's monotone chain.
function hull(pts) {
    const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    lo.pop(); up.pop();
    return lo.concat(up);
}
const len = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };
// Region quads along a polyline, one per stretch of ~`step` units, each with its own
// flood direction: the tidal stream that follows the channel round its bends.
function streamRegions(line, width, speed, step, idPrefix, falloff) {
    const regs = [];
    let acc = [line[0]], accLen = 0;
    const flush = (force) => {
        if (acc.length < 2) return;
        const a = acc[0], b = acc[acc.length - 1];
        const dir = Math.atan2(b[0] - a[0], -(b[1] - a[1]));   // forward = (sin, -cos): the engine's bearing
        // The hull of the ribbon: a stream region is a soft-edged blend, so a convex patch
        // is right, and a ribbon folded at a tight bend is not a polygon the compiler takes.
        regs.push({ id: `${idPrefix}-${regs.length + 1}`, poly: hull(ribbon(acc, width)), falloff, direction: R(dir, 4), speed, tidal: true });
        acc = [b]; accLen = 0;
    };
    for (let i = 1; i < line.length; i++) {
        accLen += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
        acc.push(line[i]);
        if (accLen >= step) flush();
    }
    flush(true);
    return regs;
}

// ── THE LINES ────────────────────────────────────────────────────────────────
// y is DOWN. The sea is south (+y), the head of the estuary north (−y). Wind from 195°.
const MAIN = spline([
    [420, 5200],     // in the sea, off the mouth
    [420, 4500],     // the mouth
    [780, 3850],
    [1750, 3250],    // north-east up the east side
    [2450, 2450],
    [2600, 1500],
    [2250, 650],     // the turn west
    [1100, 250],
    [-500, 0],       // the long traverse
    [-1850, -420],
    [-2600, -1250],  // the west bend — the POINT BAR sits inside it
    [-2600, -2250],
    [-2100, -3150],  // the turn east
    [-950, -3750],
    [500, -3950],    // east across the upper basin
    [1500, -4500],
    [1300, -5350],   // and back west round the head's meander
    [300, -5750],
    [-700, -6150],
    [-800, -6900],   // the last turn north
    [100, -7350],
    [1100, -7600],   // the finish approach
    [1500, -8200]    // and the water beyond the line: deep to the head
], 7);
// The channel's rim-to-rim width along the main line: a wide mouth, 5–8 hulls elsewhere.
const mainWidth = (s) => s < 0.05 ? 1500 : s < 0.09 ? 1500 - (s - 0.05) / 0.04 * 800 : s < 0.7 ? 700 : s < 0.95 ? 600 : 600 + (s - 0.95) / 0.05 * 500;

// The flood creek: leaves the main channel just past the west bend and rejoins before the
// finish approach, inside the big turn — shorter, shallower, its own stream, and a sill.
const CREEK = spline([
    [1350, -4350],
    [1750, -5000],
    [1900, -5800],
    [1700, -6600],
    [1300, -7150],
    [1100, -7500]
], 7);

// The WANTIJ crossing: a tidal creek leads in from the mouth to a pool (always afloat, so a
// boat can get there and wait), and from the pool a SHORT shelf crosses the divide to a sill
// at the traverse. The timed part is the last 1300u — a 12 s dash — so one window of the
// tide is enough to cross it, and a boat that arrives late waits in the pool or goes back.
const CREEK_IN = spline([
    [620, 4050],
    [560, 3300],
    [680, 2600],
    [740, 2150]
], 6);
const CROSSING = spline([
    [740, 2150],
    [790, 1600],
    [700, 950],
    [520, 420]
], 6);

// ── THE SHAPES ───────────────────────────────────────────────────────────────
const shapes = [];
let n = 0;
const add = (kind, outer, extra = {}) => { shapes.push(Object.assign({ id: `${kind.replace('flats-', '')}-${++n}`, kind, outer, holes: [] }, extra)); };

// The basin: the high-water shoreline. The marsh is the whole world with this as a hole.
const BASIN = spline([
    [-1000, 4700], [-1800, 4200], [-2900, 3500], [-3300, 2500], [-3100, 1500], [-3300, 400],
    [-3500, -900], [-3400, -2100], [-3000, -3300], [-2400, -4300], [-2000, -5400], [-1900, -6600],
    [-1300, -7600], [-200, -8300], [1200, -8500], [2400, -8100], [2900, -7000], [3000, -5800], [2900, -4700], [2700, -3600], [2700, -2900], [3100, -1800],
    [3300, -600], [3400, 800], [3300, 2200], [3000, 3200], [2600, 3900], [1700, 4700]
], 5).map(p => [R(p[0]), R(p[1])]);   // OPEN: from the west side of the mouth round the head to the east side
// The shore is the land NORTH of the coast (y ≤ 4700) with the basin as a hole; the sea to
// the south is open water, with the spits and the two points laid in front of the coast.
// One simple ring rather than a rect with a hole: the coast runs in from the world's edge,
// up round the basin, and back out — no keyhole for the compiler to cut.
// The open coast either side of the mouth is a wavering line, not a ruler's edge.
const coastE = spline([[6000, 4650], [5200, 4780], [4400, 4620], [3600, 4760], [2900, 4640], [2300, 4720], [1700, 4700]], 4);
const coastW = spline([[-1000, 4700], [-1600, 4760], [-2300, 4620], [-3000, 4780], [-3800, 4640], [-4600, 4760], [-5300, 4660], [-6000, 4720]], 4);
const SHORE = [[-6000, -10000], [6000, -10000]].concat(coastE.slice(0, -1)).concat(BASIN.slice().reverse()).concat(coastW.slice(1)).map(p => [R(p[0]), R(p[1])]);
add('flats-marsh', SHORE, { id: 'marsh-shore', name: 'The shore' });

// The sea: deep everywhere south of the mouth, and the main channel through the basin.
add('flats-channel', rect(-6200, 4300, 6200, 8800), { id: 'sea', name: 'The sea', elev: -4 });
add('flats-channel', ribbon(MAIN, mainWidth, 0.10), { id: 'channel-main', name: 'Main channel', elev: -3.0 });
add('flats-channel', ribbon(CREEK, 420, 0.10), { id: 'creek-flood', name: 'Flood creek', elev: -1.15 });

// The spits at the mouth: sand, high, with marsh behind. The bar polygons overlap the sea so
// the spit rises out of deep water.
// The spits: sand hooks growing from the coast's corners into the sea, curving toward the
// mouth as an ebb delta's do, with a marsh headland at each root. They flank the run in
// from the mark and give the mouth its gate.
add('flats-marsh', spline([[-3200, 4650], [-2500, 4700], [-1900, 4900], [-1700, 5250], [-2200, 5500], [-2900, 5400], [-3300, 5100]], 4), { id: 'marsh-sw', name: 'West point' });
add('flats-marsh', spline([[2400, 4650], [3000, 4700], [3300, 5100], [3000, 5450], [2500, 5450], [2200, 5150], [2200, 4850]], 4), { id: 'marsh-se', name: 'East point' });
add('flats-bar', spline([[-2000, 5100], [-1400, 5250], [-800, 5400], [-350, 5550], [-250, 5750], [-600, 5850], [-1200, 5700], [-1800, 5550], [-2100, 5350]], 4), { id: 'spit-west', name: 'West spit', elev: 0.9 });
add('flats-bar', spline([[2450, 5300], [2000, 5550], [1600, 5750], [1350, 5900], [1500, 6100], [1900, 6000], [2300, 5850], [2600, 5600]], 4), { id: 'spit-east', name: 'East spit', elev: 0.9 });

// High ground inside the first loop: the wantij's own island, so the interior rises to it
// and only the corridor stays low. Two more marsh islands set the height of the flats
// between the bends, and one in the upper basin makes the creek's diamond bar.
add('flats-marsh', blob(1650, 2150, 520, 640, 16, 0.22, 0.3), { id: 'isle-wantij', name: 'Wantij island' });
add('flats-marsh', blob(-1500, 1700, 720, 520, 16, 0.2, -0.2), { id: 'isle-west-flat', name: 'Heron flat' });
add('flats-marsh', blob(-2300, 3300, 420, 380, 12, 0.2), { id: 'isle-sw', name: 'Spoonbill roost' });
add('flats-marsh', blob(2500, -900, 380, 300, 12, 0.2), { id: 'isle-east', name: 'East hummock' });
add('flats-marsh', blob(-800, -2100, 560, 380, 14, 0.2, 0.5), { id: 'isle-upper', name: 'Curlew flat' });
add('flats-marsh', blob(1000, -1500, 460, 360, 12, 0.2, 0.2), { id: 'isle-mid', name: 'Egret flat' });
add('flats-marsh', blob(300, -5050, 520, 400, 14, 0.2, 0.3), { id: 'isle-diamond', name: 'Diamond bar top' });
add('flats-marsh', blob(-1300, -4900, 360, 300, 12, 0.2, 0.6), { id: 'isle-nw', name: 'Head island' });
add('flats-marsh', blob(2300, -6500, 300, 380, 12, 0.2, 0.1), { id: 'isle-ne', name: 'Creek bank' });

// The WANTIJ: a shelf corridor, a pool to wait in, a sill at the exit.
add('flats-channel', ribbon(CREEK_IN, 400, 0.1), { id: 'wantij-creek', name: 'Wantij creek', elev: -2.4 });
add('flats-pool', blob(760, 2050, 300, 300, 12, 0.15), { id: 'wantij-pool', name: 'Waiting pool', elev: -2.2 });
add('flats-flat', ribbon(CROSSING, 520, 0.08), { id: 'wantij-corridor', name: 'The wantij', elev: -0.8 });
add('flats-bar', ribbon(spline([[300, 700], [560, 740], [820, 680]], 4), 260), { id: 'wantij-sill', name: 'The sill', elev: -0.45 });

// The POINT BAR: a shelving inside at the west bend, so the higher water cuts tighter.
add('flats-flat', spline([[-1500, -300], [-2000, -700], [-2250, -1250], [-2250, -1900], [-1900, -2050], [-1600, -1500], [-1500, -900], [-1400, -400]], 4), { id: 'point-bar', name: 'Point bar', elev: -0.95 });

// The creek's sill at its head, and a mud tongue across its middle so it costs something
// near slack water.
add('flats-bar', ribbon(spline([[900, -7100], [1250, -7150], [1600, -7050]], 4), 280), { id: 'creek-sill', name: 'Creek sill', elev: -0.5 });

// Deep pockets in the flats: places to be, and to be caught between.
add('flats-pool', blob(-350, 1150, 300, 220, 12, 0.2, 0.4), { id: 'pool-mid', name: 'Middle pool', elev: -2.0 });
add('flats-pool', blob(1700, -3100, 260, 200, 12, 0.2), { id: 'pool-east', name: 'East pool', elev: -1.8 });
add('flats-pool', blob(-700, -5300, 240, 200, 12, 0.2), { id: 'pool-head', name: 'Head pool', elev: -1.8 });
add('flats-pool', blob(-1200, 3600, 280, 200, 12, 0.2), { id: 'pool-sw', name: 'Roost pool', elev: -1.8 });

// ── THE COURSE ───────────────────────────────────────────────────────────────
const marks = [
    { id: 'start-pin',  x: -80,  y: 5950, kind: 'inflatable' },
    { id: 'start-boat', x: 920,  y: 5950, kind: 'inflatable' },
    { id: 'mark-top',   x: 420,  y: 7150, kind: 'inflatable' },
    { id: 'fin-a',      x: 1750, y: -7850, kind: 'inflatable' },
    { id: 'fin-b',      x: 1050, y: -7850, kind: 'inflatable' }
];
const lines = [{ id: 'start', marks: ['start-pin', 'start-boat'] }, { id: 'finish', marks: ['fin-a', 'fin-b'] }];
const route = [
    { kind: 'gate', lineId: 'start', dir: -1, pass: 'through' },
    { kind: 'round', markId: 'mark-top', side: 'starboard', dir: 1, pass: 'through' },
    { kind: 'gate', lineId: 'finish', dir: -1, pass: 'through' }
];

// ── WIND ─────────────────────────────────────────────────────────────────────
// From 195° (an onshore breeze up the estuary), easing a little inland. Three bands with
// long falloffs, so there is no seam to sail across.
const WIND_DIR = 195 * Math.PI / 180;
const wind = { regions: [
    { id: 'wind-sea',   name: 'Offshore',       poly: rect(-7000, 4000, 7000, 9000),  falloff: 1400, direction: WIND_DIR, dirVar: 0.14, speed: 16.5, speedVar: 1.5, period: 43 },
    { id: 'wind-lower', name: 'Lower estuary',  poly: rect(-7000, -1500, 7000, 4000), falloff: 1400, direction: WIND_DIR, dirVar: 0.16, speed: 15, speedVar: 1.5, period: 43 },
    { id: 'wind-upper', name: 'Upper estuary',  poly: rect(-7000, -11000, 7000, -1500), falloff: 1400, direction: WIND_DIR + 0.05, dirVar: 0.18, speed: 13.5, speedVar: 1.5, period: 43 }
] };

// ── CURRENT ──────────────────────────────────────────────────────────────────
// Tidal streams: `speed` is the knots at the peak rate, flooding along `direction`, ebbing
// back; the tide's clock scales them (js/tide.js). The main channel carries 0.8 kt, the creek
// 1.2 (a flood channel), the sea a gentle set through the mouth.
const current = { regions: [
    { id: 'sea-stream', poly: rect(-4500, 4300, 4500, 8000), falloff: 900, direction: Math.atan2(0, -(-1)) , speed: 0.35, tidal: true }
].concat(streamRegions(MAIN, (s) => mainWidth(s) + 160, 0.8, 1100, 'main-stream', 220))
 .concat(streamRegions(CREEK, 560, 1.2, 900, 'creek-stream', 180)) };
current.regions[0].direction = 0;    // north: in through the mouth on the flood

// ── THE DOCUMENT ─────────────────────────────────────────────────────────────
const doc = {
    schema: 1,
    venue: 'flats',
    note: 'BUILT by art/build_flats.js (Sep 16 2026) — the Wantij design, guidelines/flats-design.md. A one-way race: short beat to a rounding mark at sea, bear away through the mouth, then the deep channel round the outside of a braided basin in an S to a finish inland. The flats between the channels and the marsh are a tidal elevation field (js/tide.js) the tide floods and drains on a 60 s clock, HW 8 s after the gun and every minute after. Three choices on that clock: the WANTIJ (a corridor across the first loop with a pool to wait in and a sill at its exit), the POINT BAR (the inside of the west bend shelves, so higher water cuts tighter), and the FLOOD CREEK (a shallow branch round the diamond bar with a stronger flood stream and a sill at its head). Re-running the script overwrites hand edits.',
    card: {
        name: 'Spoonbill Flats',
        tag: 'Tidal Flats',
        blurb: 'A wide estuary that fills and empties while you race it. The deep channel always goes round; the flats are the short way — for a while. Read the tide, cross the wantij while there is water on the sill, and never let the mud take your keel.',
        conditions: 'Moderate onshore breeze, a full tide every minute',
        hazards: 'Drying flats, the sill, the stream'
    },
    world: {
        size: 16000,
        boundary: { poly: [[-3700, -8600], [3700, -8600], [3700, 8000], [-3700, 8000]], circle: null }
    },
    tide: { period: 60, amp: 1.0, mid: 0, phase0: 0.733, fillKt: 0.55 },   // HW 8 s after the gun, then every minute: the sill is open when a well-sailed leader reaches it
    shapes,
    course: {
        description: 'Beat to the offshore mark, round to starboard, run in through the mouth and race the channel round the basin to the finish at the head — or cross the flats while the tide lets you.',
        marks, lines, route, cutoff: 480
    },
    wind, current,
    palette: { baseColor: '#3a6394', deepColor: '#274a72', shallowColor: '#7aa6d4', shorelineColor: '#e0b866' },
    props: []
};

// ── summary ──────────────────────────────────────────────────────────────────
const verts = shapes.reduce((a, s) => a + s.outer.length + s.holes.reduce((b, h) => b + h.length, 0), 0);
console.log(`shapes ${shapes.length}, vertices ${verts}, current regions ${current.regions.length}`);
console.log(`main channel ${Math.round(len(MAIN))}u, creek ${Math.round(len(CREEK))}u, crossing ${Math.round(len(CROSSING))}u`);
const beat = Math.hypot(420 - 420, 7150 - 5950);
console.log(`beat ${Math.round(beat)}u, mark→mouth ${Math.round(7150 - 4500)}u, channel route ≈ ${Math.round(beat + 2650 + len(MAIN) - 700)}u`);
if (!DRY) {
    const text = '// BUILT by art/build_flats.js — re-run the script rather than hand-editing, or stop re-running it.\n'
        + '// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.\n'
        + '// Edited in editor.html.\n'
        + 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
        + `window.VENUE_DOC["flats"] = ${JSON.stringify(doc, null, 2)};\n`;
    fs.writeFileSync(OUT, text);
    console.log('wrote', OUT);
}
