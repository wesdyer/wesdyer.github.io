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
    [420, 6300],     // well inside the sea, so the ribbon's end cap is under deep water
    [420, 5300],     // the delta channel
    [420, 4500],     // the throat
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
    [-800, -6900],   // the turn north
    [100, -7350],
    [1000, -7650],   // THE FOURTH SECTION (Sep 16, "more to sail"): the channel bulges east
    [1500, -8300],   // round the delta bar
    [1150, -9000],
    [300, -9350],    // and swings back north-west to the head
    [-500, -9800],
    [-700, -10500],  // the finish approach
    [-300, -11200]   // and the water beyond the line: deep to the head
], 5);
// The channel's rim-to-rim width along the main line: a wide mouth, 5–8 hulls elsewhere.
const mainWidth = (s) => s < 0.04 ? 1300 : s < 0.075 ? 1300 - (s - 0.04) / 0.035 * 400 : s < 0.11 ? 900 - (s - 0.075) / 0.035 * 200 : s < 0.62 ? 700 : s < 0.96 ? 580 : 580 + (s - 0.96) / 0.04 * 500;   // a broad approach, a 900u throat, the channel

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
// Its two ends at the mouth are the ROOTS of the shore either side: the west spit's inner
// face and the low east shore (see THE MOUTH below).
const BASIN = spline([
    [-2800, 4380], [-3050, 3700], [-3300, 2500], [-3100, 1500], [-3300, 400],
    [-3500, -900], [-3400, -2100], [-3000, -3300], [-2400, -4300], [-2000, -5400], [-1900, -6600],
    [-1800, -7700], [-2000, -8800], [-1800, -9900], [-1400, -10900], [-500, -11600], [500, -11500], [1100, -10700],
    [1500, -9800], [2500, -9100], [2900, -8000], [3000, -7000], [3000, -5800], [2900, -4700], [2700, -3600], [2700, -2900], [3100, -1800],
    [3300, -600], [3400, 800], [3300, 2200], [3000, 3200], [2700, 3800], [2350, 4150], [2000, 4400]
], 3).map(p => [R(p[0]), R(p[1])]);   // OPEN: from the west spit's root round the head to the east shore

// ── THE MOUTH (reworked Sep 16 evening — "it doesn't look like an estuary") ──────────
// The shape every real inlet has (East Head at Chichester, Dawlish Warren on the Exe, the
// Wadden inlets): on the updrift side a long RECURVED SAND SPIT, dune-topped, whose tip
// hooks INTO the estuary; opposite it a low, marsh-backed shore with a short spit of its
// own; between them the THROAT, where the channel is narrowest and deepest; and outside,
// an EBB-TIDAL DELTA — crescent swash bars either side of the channel, awash at low water,
// the sea shelving over them. The wind here is from the south-south-west, so the drift
// runs east and the big spit grows from the west.
//
// The spit is part of the SHORE polygon (a peninsula, not an island): the shore's west
// coast runs in along the spit's outer face to the tip, back along its inner face to the
// root, then up the basin's west side. The east shore does the same in little.
const SPIT_OUTER = [[-6000, 4720], [-5300, 4660], [-4600, 4760], [-3800, 4680], [-3000, 4740], [-2300, 4790], [-1600, 4830], [-1050, 4820], [-650, 4700], [-450, 4480], [-480, 4280]];
const SPIT_INNER = [[-620, 4150], [-820, 4130], [-1150, 4240], [-1600, 4320], [-2150, 4370], [-2800, 4380]];
const coastW = spline(SPIT_INNER.slice().reverse().concat([[-520, 4200]]).concat(SPIT_OUTER.slice().reverse()), 6);   // root -> tip -> outer face -> west
const coastE = spline([[6000, 4650], [5200, 4760], [4400, 4640], [3700, 4750], [3100, 4660], [2700, 4560], [2450, 4500], [2200, 4560], [1950, 4520], [1750, 4400], [1900, 4300], [2000, 4400]], 6);   // west along the coast to a short marsh spit, and the basin's east root
const SHORE = [[-6000, -13000], [6000, -13000]].concat(coastE.slice(0, -1)).concat(BASIN.slice().reverse()).concat(coastW.slice(1)).map(p => [R(p[0]), R(p[1])]);
add('flats-marsh', SHORE, { id: 'marsh-shore', name: 'The shore' });

// The sea: deep everywhere south of the mouth, with an edge that wanders along the outer
// coast (a rectangle's edge was a ruler line through the flats) and the channel through
// the throat; the delta's flats lie between.
// The sea's edge hugs the open coast (a narrow foreshore) and bows out round the mouth
// where the ebb delta's fan lies — the bars stand in that bulge, out of deep water.
const SEA_EDGE = spline([[-6200, 5020], [-5000, 5080], [-3800, 5000], [-3000, 5100], [-2400, 5250], [-1800, 5500], [-1100, 5620], [-400, 5600], [300, 5560], [1000, 5620], [1700, 5580], [2400, 5400], [3000, 5200], [3700, 5080], [4500, 5040], [5300, 5100], [6200, 5020]], 4);
add('flats-channel', SEA_EDGE.concat([[6200, 8800], [-6200, 8800]]).map(p => [R(p[0]), R(p[1])]), { id: 'sea', name: 'The sea', elev: -4 });
add('flats-channel', ribbon(MAIN, mainWidth, 0.10), { id: 'channel-main', name: 'Main channel', elev: -3.0 });
add('flats-channel', ribbon(CREEK, 420, 0.10), { id: 'creek-flood', name: 'Flood creek', elev: -1.15 });

// The spit's BEACH: a sand apron along its outer face and round the tip, high (dry but for
// the top of springs), and the tip's RECURVE — the hook of lower sand that curls into the
// mouth and covers near high water. The east shore has a small beach of its own. Sand
// bars laid over marsh and sea alike: the bar raises the ground where the marsh is not,
// and the marsh stays marsh where it is.
// Beaches taper to nothing at their ends (a square-cut band reads as a road) and the
// recurve is a hooked ribbon curling into the mouth, not a lump.
const taper = (w, ends = 0.25) => (s) => 40 + (w - 40) * Math.min(1, Math.min(s, 1 - s) / ends);
add('flats-bar', ribbon(spline([[-3600, 4860], [-2800, 4920], [-2000, 4960], [-1300, 4980], [-800, 4900], [-500, 4720], [-380, 4480], [-420, 4230]], 5), taper(240, 0.2), 0.14), { id: 'spit-beach', name: 'Spit beach', elev: 0.7, feather: 90 });
add('flats-bar', ribbon(spline([[-430, 4230], [-330, 4060], [-380, 3900], [-560, 3840], [-720, 3930]], 5), taper(200, 0.3), 0.12), { id: 'spit-recurve', name: 'The recurve', elev: 0.25, feather: 60 });
add('flats-bar', ribbon(spline([[3400, 4780], [2800, 4740], [2300, 4710], [1950, 4650], [1720, 4520], [1650, 4380]], 4), taper(200, 0.25), 0.14), { id: 'east-beach', name: 'East beach', elev: 0.6, feather: 80 });
// THE EBB DELTA: crescent swash bars either side of the channel outside the throat, awash
// at low water and a hand under the surface at high — the fleet runs in between them.
// Steep-sided (their own short ramp), so the crest is reached even where they rise out of
// the deep sea.
// MARGINAL FLOOD CHANNELS: the troughs between the beach and the bars, where the flood
// runs in along the shore — a thin lane of water at low tide separating beach from bar.
add('flats-channel', ribbon(spline([[-2500, 5150], [-1800, 5200], [-1100, 5170], [-600, 5020], [-300, 4760]], 5), 200, 0.1), { id: 'flood-margin-w', name: 'West marginal channel', elev: -2.0 });
add('flats-channel', ribbon(spline([[2900, 5060], [2200, 5150], [1600, 5130], [1250, 4980], [1100, 4700]], 5), 200, 0.1), { id: 'flood-margin-e', name: 'East marginal channel', elev: -2.0 });
add('flats-bar', ribbon(spline([[-2100, 5300], [-1500, 5420], [-950, 5480], [-450, 5440], [-200, 5300]], 5), taper(320, 0.2), 0.15), { id: 'delta-bar-w', name: 'West swash bar', elev: -0.15, feather: 60 });
add('flats-bar', ribbon(spline([[1000, 5350], [1500, 5480], [2050, 5470], [2500, 5330], [2800, 5180]], 5), taper(320, 0.2), 0.15), { id: 'delta-bar-e', name: 'East swash bar', elev: -0.15, feather: 60 });

// High ground inside the first loop: the wantij's own island, so the interior rises to it
// and only the corridor stays low. Two more marsh islands set the height of the flats
// between the bends, and one in the upper basin makes the creek's diamond bar.
add('flats-marsh', blob(1650, 2150, 520, 640, 16, 0.22, 0.3), { id: 'isle-wantij', name: 'Wantij island' });
add('flats-marsh', blob(-1500, 1700, 720, 520, 16, 0.2, -0.2), { id: 'isle-west-flat', name: 'Heron flat' });
add('flats-marsh', blob(-2300, 3300, 420, 380, 12, 0.2), { id: 'isle-sw', name: 'Spoonbill roost' });
add('flats-marsh', blob(2500, -900, 380, 300, 12, 0.2), { id: 'isle-east', name: 'East hummock' });
add('flats-marsh', blob(-450, -2150, 460, 360, 14, 0.2, 0.5), { id: 'isle-upper', name: 'Curlew flat' });   // east of the neck's line (it sat ON it: the corridor had a wall in its middle)
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
add('flats-flat', spline([[-1500, -300], [-2000, -700], [-2250, -1250], [-2350, -1900], [-2250, -2450], [-1950, -2500], [-1750, -2100], [-1600, -1500], [-1500, -900], [-1400, -400]], 4), { id: 'point-bar', name: 'Point bar', elev: -0.95 });   // reaches the channel at its north end (it stopped 350u short on a lip of +0.5 m flats)

// The creek's sill at its head, and a mud tongue across its middle so it costs something
// near slack water.
add('flats-bar', ribbon(spline([[900, -7100], [1250, -7150], [1600, -7050]], 4), 280), { id: 'creek-sill', name: 'Creek sill', elev: -0.5 });

// Deep pockets in the flats: places to be, and to be caught between.
add('flats-pool', blob(-350, 1150, 300, 220, 12, 0.2, 0.4), { id: 'pool-mid', name: 'Middle pool', elev: -2.0 });
add('flats-pool', blob(1700, -3100, 260, 200, 12, 0.2), { id: 'pool-east', name: 'East pool', elev: -1.8 });
add('flats-pool', blob(-700, -5300, 240, 200, 12, 0.2), { id: 'pool-head', name: 'Head pool', elev: -1.8 });
add('flats-pool', blob(-1200, 3600, 280, 200, 12, 0.2), { id: 'pool-sw', name: 'Roost pool', elev: -1.8 });

// ── MORE PASSAGES (Wes, Sep 16 after five laps: "more passages would be good") ──────
// Each is a pool to reach and wait in, a shelf, and a sill — but with a different KEY.
//
// THE WEST GAMBLE: the other way across the first loop, for a boat that reaches the mouth
// later than the leaders. A creek from the mouth's west side to the roost pool, a long
// shelf north past Heron flat to the middle pool, and a high sill onto the traverse: the
// shelf floods later and drains sooner than the wantij's, so this is the crossing you take
// AT the top of the tide, and wait in the middle pool for.
const GAMBLE_IN = spline([[20, 4150], [-250, 3700], [-700, 3540], [-1150, 3580]], 6);   // north of the spit's recurve (it ran through the hook once: +0.25 m in the creek)
const GAMBLE = spline([[-1200, 3600], [-1150, 2900], [-900, 2100], [-500, 1500], [-350, 1150]], 6);
const GAMBLE_OUT = spline([[-350, 1150], [-450, 750], [-550, 350]], 6);
add('flats-channel', ribbon(GAMBLE_IN, 380, 0.1), { id: 'gamble-creek', name: 'Roost creek', elev: -2.2 });
add('flats-flat', ribbon(GAMBLE, 480, 0.08), { id: 'gamble-shelf', name: 'The west gamble', elev: -0.6 });
add('flats-flat', ribbon(GAMBLE_OUT, 440, 0.08), { id: 'gamble-out', name: 'Gamble exit', elev: -0.75 });
add('flats-bar', ribbon(spline([[-800, 420], [-550, 470], [-300, 430]], 4), 240), { id: 'gamble-sill', name: 'Gamble sill', elev: -0.25 });

// THE NECK: across the west bend's interior, from the traverse north to the upper leg,
// with a pool beside Curlew flat to wait in. Saves the bend; opens for a third of the cycle.
const NECK_S = spline([[-1150, -250], [-1250, -700], [-1300, -1150]], 6);
const NECK_N = spline([[-1300, -1150], [-1200, -1700], [-1100, -2400], [-1000, -3000], [-950, -3450]], 6);
add('flats-pool', blob(-1300, -1200, 260, 240, 12, 0.18), { id: 'pool-neck', name: 'Neck pool', elev: -2.0 });
add('flats-flat', ribbon(NECK_S, 440, 0.08), { id: 'neck-s', name: 'The neck (south)', elev: -0.9 });
add('flats-flat', ribbon(NECK_N, 460, 0.08), { id: 'neck-n', name: 'The neck (north)', elev: -0.85 });
add('flats-bar', ribbon(spline([[-1200, -3300], [-950, -3340], [-700, -3280]], 4), 250), { id: 'neck-sill', name: 'Neck sill', elev: -0.45 });

// THE HEAD CUT: Wes's own line across the head's meander, made a marked passage — west of
// the diamond island through the head pool, a sill onto the last turn. The creek up the
// east side is the other key to the same lock.
const HEADCUT = spline([[-750, -4050], [-750, -4700], [-700, -5300], [-550, -5900], [-400, -6450]], 6);
add('flats-flat', ribbon(HEADCUT, 460, 0.08), { id: 'head-cut', name: 'The head cut', elev: -0.9 });
add('flats-bar', ribbon(spline([[-650, -6700], [-400, -6740], [-150, -6680]], 4), 250), { id: 'head-sill', name: 'Head sill', elev: -0.5 });

// THE DELTA CUT (the fourth section): the channel bulges east round the delta bar; a short
// shelf goes straight up its west side from the turn to the head reach, with a pool in the
// middle and a sill at the top. The smallest saving of the six, and the last chance.
add('flats-marsh', blob(950, -8450, 300, 330, 12, 0.2, 0.4), { id: 'isle-delta', name: 'Delta bar' });
const DELTA = spline([[350, -7550], [250, -8100], [150, -8650], [200, -9150]], 6);
add('flats-pool', blob(180, -8400, 220, 200, 12, 0.2), { id: 'pool-delta', name: 'Delta pool', elev: -1.9 });
add('flats-flat', ribbon(DELTA, 420, 0.08), { id: 'delta-cut', name: 'The delta cut', elev: -0.85 });
add('flats-bar', ribbon(spline([[-50, -9150], [200, -9190], [450, -9130]], 4), 240), { id: 'delta-sill', name: 'Delta sill', elev: -0.45 });
add('flats-marsh', blob(-1100, -9300, 380, 300, 12, 0.2, 0.2), { id: 'isle-head-w', name: 'Head marsh' });
add('flats-pool', blob(1900, -9600, 230, 200, 12, 0.2), { id: 'pool-delta-e', name: 'East delta pool', elev: -1.8 });

// Stepping stones: pools a boat caught on the flats can reach and sit out the ebb in.
add('flats-pool', blob(1900, 2900, 220, 180, 12, 0.2, 0.3), { id: 'pool-loop1-e', name: 'East loop pool', elev: -1.8 });
add('flats-pool', blob(-2000, 700, 230, 200, 12, 0.2), { id: 'pool-heron', name: 'Heron pool', elev: -1.8 });
add('flats-pool', blob(1200, -2400, 240, 200, 12, 0.2, 0.5), { id: 'pool-egret', name: 'Egret pool', elev: -1.8 });
add('flats-pool', blob(-1700, -4300, 220, 200, 12, 0.2), { id: 'pool-nw', name: 'Head-island pool', elev: -1.8 });

// ── THE COURSE ───────────────────────────────────────────────────────────────
const marks = [
    { id: 'start-pin',  x: -80,  y: 5950, kind: 'inflatable' },
    { id: 'start-boat', x: 920,  y: 5950, kind: 'inflatable' },
    { id: 'mark-top',   x: 420,  y: 7150, kind: 'inflatable' },
    { id: 'fin-a',      x: -250, y: -10750, kind: 'inflatable' },
    { id: 'fin-b',      x: -950, y: -10750, kind: 'inflatable' }
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
    { id: 'wind-upper', name: 'Upper estuary',  poly: rect(-7000, -14000, 7000, -1500), falloff: 1400, direction: WIND_DIR + 0.05, dirVar: 0.18, speed: 13.5, speedVar: 1.5, period: 43 }
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

// ── WITHIES ──────────────────────────────────────────────────────────────────
// Birch boughs on stakes, the Wadden way: they mark the EDGES of the timed water — either
// end of each sill, and both sides of the wantij shelf every few hundred units — so the
// sailor sees the gate before the depth shading tells them. Drawn by js/tide.js; they
// lean with the stream. `hand` is which side the deep water is on (the topmark colour).
const withies = [];
const edgeWithies = (line, halfW, step, id) => {
    let acc = 0;
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
        acc += seg;
        if (acc < step) continue;
        acc = 0;
        let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const nx = -ty, ny = tx;
        withies.push({ x: R(b[0] + nx * halfW), y: R(b[1] + ny * halfW), hand: 'port', id: `${id}-p${i}` });
        withies.push({ x: R(b[0] - nx * halfW), y: R(b[1] - ny * halfW), hand: 'stbd', id: `${id}-s${i}` });
    }
};
edgeWithies(CROSSING, 230, 420, 'wantij');
withies.push({ x: 320, y: 720, hand: 'port', id: 'sill-w' }, { x: 800, y: 700, hand: 'stbd', id: 'sill-e' });
withies.push({ x: 900, y: -7130, hand: 'port', id: 'creek-sill-w' }, { x: 1620, y: -7060, hand: 'stbd', id: 'creek-sill-e' });
withies.push({ x: 1300, y: -4200, hand: 'port', id: 'creek-in-w' }, { x: 1600, y: -4300, hand: 'stbd', id: 'creek-in-e' });
withies.push({ x: 440, y: 4120, hand: 'port', id: 'wantij-in-w' }, { x: 820, y: 4080, hand: 'stbd', id: 'wantij-in-e' });
withies.push({ x: -820, y: 440, hand: 'port', id: 'gamble-sill-w' }, { x: -280, y: 420, hand: 'stbd', id: 'gamble-sill-e' });
withies.push({ x: -1220, y: -3320, hand: 'port', id: 'neck-sill-w' }, { x: -680, y: -3300, hand: 'stbd', id: 'neck-sill-e' });
withies.push({ x: -1380, y: -260, hand: 'port', id: 'neck-in-w' }, { x: -920, y: -240, hand: 'stbd', id: 'neck-in-e' });
withies.push({ x: -670, y: -6720, hand: 'port', id: 'head-sill-w' }, { x: -130, y: -6660, hand: 'stbd', id: 'head-sill-e' });
withies.push({ x: -990, y: -4040, hand: 'port', id: 'head-in-w' }, { x: -510, y: -4060, hand: 'stbd', id: 'head-in-e' });
withies.push({ x: -420, y: 3560, hand: 'port', id: 'gamble-in-w' }, { x: -60, y: 3900, hand: 'stbd', id: 'gamble-in-e' });
withies.push({ x: -70, y: -9170, hand: 'port', id: 'delta-sill-w' }, { x: 470, y: -9110, hand: 'stbd', id: 'delta-sill-e' });
withies.push({ x: 120, y: -7500, hand: 'port', id: 'delta-in-w' }, { x: 580, y: -7560, hand: 'stbd', id: 'delta-in-e' });
edgeWithies(GAMBLE, 220, 700, 'gamble');
edgeWithies(NECK_N, 210, 700, 'neck');
edgeWithies(HEADCUT, 210, 700, 'headcut');

// ── THE PASSAGES, AS LINES ───────────────────────────────────────────────────
// Every marked passage's centreline, entrance to exit, into the document: what a probe
// measures the fill along (eval/_flats_passages.js) and what a future HUD could name.
const passages = [
    { id: 'wantij',   name: 'The wantij',      pts: CREEK_IN.concat(CROSSING.slice(1)).concat([[520, 300], [520, 150]]) },
    { id: 'gamble',   name: 'The west gamble', pts: GAMBLE_IN.concat(GAMBLE.slice(1)).concat(GAMBLE_OUT.slice(1)).concat([[-600, 150], [-650, -50]]) },
    { id: 'pointbar', name: 'The point bar',   pts: [[-1400, -400], [-1650, -650], [-1900, -1000], [-2050, -1400], [-2100, -1900], [-2150, -2300], [-2300, -2600]] },
    { id: 'neck',     name: 'The neck',        pts: [[-1100, 100]].concat(NECK_S).concat(NECK_N.slice(1)).concat([[-940, -3700], [-930, -3950]]) },
    { id: 'headcut',  name: 'The head cut',    pts: [[-750, -3850]].concat(HEADCUT).concat([[-350, -6800], [-300, -7100]]) },
    { id: 'creek',    name: 'The flood creek', pts: CREEK.concat([[1000, -7500]]) },
    { id: 'delta',    name: 'The delta cut',   pts: [[400, -7350]].concat(DELTA).concat([[150, -9400], [0, -9600]]) }
].map(P => ({ id: P.id, name: P.name, pts: P.pts.map(q => [R(q[0]), R(q[1])]) }));

// ── THE SCALE ────────────────────────────────────────────────────────────────
// A whole-venue scale, applied to the geometry at emit (author in base units). Tried at
// 1.15 after Wes's five laps (best 2:27.6 against a 2:45–3:00 target) and set aside on his
// call — "extend it a bit so there is more to sail, not just a larger area of the same
// stuff" — for the head's fourth section. Kept as a knob.
const SCALE = 1.0;   // Wes: extend the estuary rather than inflate it — the fourth section below is the length
const sc = (p) => [R(p[0] * SCALE), R(p[1] * SCALE)];
for (const sh of shapes) { sh.outer = sh.outer.map(sc); sh.holes = (sh.holes || []).map(h => h.map(sc)); }
for (const m of marks) { m.x = R(m.x * SCALE); m.y = R(m.y * SCALE); }
for (const w of withies) { w.x = R(w.x * SCALE); w.y = R(w.y * SCALE); }
for (const P of passages) P.pts = P.pts.map(sc);

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
        size: 20000,
        boundary: { poly: [[-3700, -11600], [3700, -11600], [3700, 8000], [-3700, 8000]].map(sc), circle: null }
    },
    tide: { period: 60, amp: 1.0, mid: 0, phase0: 0.733, fillKt: 0.55, withies, passages },   // HW 8 s after the gun, then every minute: the sill is open when a well-sailed leader reaches it
    shapes,
    course: {
        description: 'Beat to the offshore mark, round to starboard, run in through the mouth and race the channel round the basin to the finish at the head — or cross the flats while the tide lets you.',
        marks, lines, route, cutoff: 480
    },
    wind: { regions: wind.regions.map(r => Object.assign({}, r, { poly: r.poly.map(sc) })) },
    current: { regions: current.regions.map(r => Object.assign({}, r, { poly: r.poly.map(sc), falloff: R(r.falloff * SCALE) })) },
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
