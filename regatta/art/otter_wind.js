// OTTER POINT — THE WIND FIELD. Rewrites ONLY `wind.regions` in assets/venues/otter.venue.js.
//
//   node regatta/art/otter_wind.js            # writes the venue document (wind block only)
//   node regatta/art/otter_wind.js --out F    # writes the whole document to F instead (for probes)
//
// Everything else in the document (Wes's 445 placed props, the flipped rocks, the paths)
// passes through untouched: the file is parsed, `wind.regions` replaced, and re-serialised
// in the editor's own layout, so a diff shows the wind block and nothing else.
//
// THE DESIGN (2026-09-14, from the owner's wind brief). Base true wind 325° FROM (0 = north /
// up, 90 = east / right, the game's heading convention; `direction` is where the wind comes
// FROM). Three sections of the course get three different fields:
//   BEAT   start tucked in the spur's lee (11.5 kt) → inshore 12.5 with a 6° shore veer, mid
//          14.5, SW offshore 16, far offshore 17.5 → approach 18.5 @ 320 → headland 20 @ 313.
//          Inshore is lifted on starboard and short-tacks in the kelp; offshore is faster and
//          gets the back off the point on port. Both must be competitive (tuned by eval).
//   REACH  coastal band 16 with lees in the coves: AB small (13), DE moderate (11), the big
//          bight before the gate (9); tip acceleration at the northernmost point (18); inner
//          offshore 16.5; a PRESSURE LANE 19 kt 2600–4200u out; far offshore 17.5.
//   BAY    the biggest hole: mouth 12.5, a 12 kt finger down the islet's west side to the
//          finish's east end, inner 9, west hole 7.5; shifty (dirVar up to 15°).
//
// HOW THE REGIONS ARE BUILT. The game blends regions as a PARTITION OF UNITY (overlap =
// average, leftover weight = calm), so a hole cannot be laid over a base: the zones below are
// authored generously in PRIORITY order and cut into an exact partition with polygon-clipping
// (each zone minus every higher-priority zone). Then every piece is BUFFERED: with mismatched
// falloffs an exact seam leaks calm (weights sum < 1 on the WIDE-falloff side), and buffering
// that side by ≥ (F_wide − F_narrow)/4 keeps the sum ≥ 1 everywhere so the blend is a clean
// weighted average. Only the wide side is buffered (bufFor), so small zones keep their size. Coastal zones extend deep INLAND so a piece never carries a hole (over land the
// wind is moot) and so the shore reads the zone's full value.
'use strict';
const fs = require('fs'), path = require('path');
const pc = require('../js/polygon-clipping.js');

const ROOT = path.resolve(__dirname, '..');
const VENUE = path.join(ROOT, 'assets', 'venues', 'otter.venue.js');
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const OUT = outArg >= 0 ? argv[outArg + 1] : VENUE;

const deg = (d) => +((d - (d > 180 ? 360 : 0)) * Math.PI / 180).toFixed(4);  // FROM bearing → radians, negative past 180 like the file
const F_MIN = 280;       // the narrowest falloff any region uses
const bufFor = (f) => Math.max(0, (f - F_MIN) / 4);   // only the WIDE side of a seam needs the buffer (see header)
const TOL = 12;          // ring simplification, units

// ── geometry helpers ────────────────────────────────────────────────────────
function ringArea(r) { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function offsetRing(ring, d) {
    // Outward offset by d with mitred corners (capped), regardless of ring orientation.
    const n = ring.length; const out = [];
    const sign = ringArea(ring) > 0 ? 1 : -1;   // screen coords: positive area = clockwise on screen
    for (let i = 0; i < n; i++) {
        const p0 = ring[(i - 1 + n) % n], p1 = ring[i], p2 = ring[(i + 1) % n];
        const e1 = [p1[0] - p0[0], p1[1] - p0[1]], e2 = [p2[0] - p1[0], p2[1] - p1[1]];
        const l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
        // outward normal: for a ring with positive shoelace area the interior is on the LEFT of each
        // edge (counter-clockwise in a y-up frame), so outward is the right-hand normal (ey, -ex)
        const n1 = [sign * e1[1] / l1, sign * -e1[0] / l1], n2 = [sign * e2[1] / l2, sign * -e2[0] / l2];
        let bx = n1[0] + n2[0], by = n1[1] + n2[1]; const bl = Math.hypot(bx, by);
        if (bl < 1e-6) { out.push([p1[0] + n1[0] * d, p1[1] + n1[1] * d]); continue; }
        bx /= bl; by /= bl;
        const cosHalf = bx * n1[0] + by * n1[1];
        let m = d / Math.max(cosHalf, 0.35);          // miter, capped ~2.9d
        if (cosHalf < 0.35) {                          // sharp corner: bevel with two points
            out.push([p1[0] + n1[0] * d, p1[1] + n1[1] * d]);
            out.push([p1[0] + n2[0] * d, p1[1] + n2[1] * d]);
        } else out.push([p1[0] + bx * m, p1[1] + by * m]);
    }
    return out;
}
function openRing(r) { const n = r.length; return (n > 1 && r[0][0] === r[n - 1][0] && r[0][1] === r[n - 1][1]) ? r.slice(0, n - 1) : r.slice(); }
function rdpRing(ring, tol) {           // a ring has no ends: simplify it as two open halves
    const r = openRing(ring); if (r.length <= 4) return r;
    const mid = Math.floor(r.length / 2);
    const a = rdpOpen(r.slice(0, mid + 1), tol), b = rdpOpen(r.slice(mid), tol);
    return a.slice(0, -1).concat(b);          // a ends where b starts; b ends at the ring's last vertex, which closes to a[0]
}
function rdpOpen(ring, tol) {
    if (ring.length <= 2) return ring;
    const keep = new Array(ring.length).fill(false); keep[0] = keep[ring.length - 1] = true;
    const stack = [[0, ring.length - 1]];
    while (stack.length) {
        const [a, b] = stack.pop(); let far = -1, fd = tol;
        for (let i = a + 1; i < b; i++) {
            const ax = ring[a][0], ay = ring[a][1], bx = ring[b][0], by = ring[b][1];
            const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
            const dist = Math.abs((ring[i][0] - ax) * dy - (ring[i][1] - ay) * dx) / L;
            if (dist > fd) { fd = dist; far = i; }
        }
        if (far >= 0) { keep[far] = true; stack.push([a, far], [far, b]); }
    }
    return ring.filter((_, i) => keep[i]);
}
function largestPoly(mp) { let best = null, ba = -1; for (const poly of mp) { const a = Math.abs(ringArea(poly[0])); if (a > ba) { ba = a; best = poly; } } return best; }
function cleanRing(ring) {           // resolve self-intersections from the offset, keep the largest outer
    const u = pc.union([[ring]]); const p = largestPoly(u); return p ? openRing(p[0]) : ring;
}
const rnd = (p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];

// ── the zones, in PRIORITY order (later wins where they overlap) ───────────
// Vertices are world units; y grows DOWN the screen (south). "L" comments mark inland vertices.
function offsetLine(pts, D) {          // offset a polyline to its LEFT (seaward for a W→E line with land to the south, y down)
    return pts.map((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        return [p[0] + (dy / l) * D, p[1] - (dx / l) * D];
    });
}
function zones(doc) {
    const bnd = doc.world.boundary.poly;
    const env = offsetRing(bnd, 2600);
    const Z = [];
    const add = (id, name, poly, w) => Z.push({ id, name, poly, ...w });
    const W = (speed, dirDeg, falloff, dirVar, speedVar, period) => ({ speed, direction: deg(dirDeg), falloff, dirVar, speedVar, period });
    const disc = (cx, cy, r, n = 28) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * Math.PI * 2), cy + r * Math.sin(i / n * Math.PI * 2)]);
    const rev = (a) => a.slice().reverse();

    // THE TIPS LINE: ~120u off the north coast's points, west → east, then on past the bay to the boundary.
    // Every north-coast band is an offset of it, so the bands nest and their seams follow the coast.
    const tips = [[-1900, -5000], [-800, -4900], [400, -4800], [1600, -4900], [2500, -4950], [3500, -5250], [4500, -5000], [5100, -5150],
                  [5600, -5050], [6300, -4600], [7100, -4300], [7500, -4050], [8200, -3850], [9000, -3900], [9800, -4100], [10800, -3700], [12500, -3100], [15500, -2300]];
    const COAST_D = 450, LANE_D = 1400;

    // 1. the ocean: everything, then carved by all that follows
    add('wind-offshore', 'offshore — the steady Pacific breeze', env, W(17.5, 325, 1000, 0.05, 1.2, 45));

    // 2. SW offshore band: 1500–2800u off the start beach and the west coast (the outer lane of the beat)
    add('wind-sw-offshore', 'offshore southwest — the long tack out', [
        [4200, 10800], [-1200, 10800], [-2200, 5300], [-3600, 3000], [-4800, 700], [-6200, -1500], [-3600, -1500], [-2900, 100],
        [-2400, 1200], [-1200, 2000], [-300, 3000], [700, 4300], [1900, 5700], [3000, 8000]],
        W(16.5, 325, 900, 0.06, 1.3, 40));

    // 3. THE PRESSURE LANE: a band 600–1600u off the north coast's points, from the islet cluster to the NE boundary.
    //    Closer than the brief's first sketch on purpose: the coast bulges north between the mark and the gate, so a
    //    line D further out costs ~2.1 × D of extra distance, and a lane 3000u out could never pay for itself.
    add('wind-lane', 'the pressure lane — dark water running along the coast, just outside the points', [
        ...offsetLine(tips, COAST_D), ...rev(offsetLine(tips, LANE_D))],
        W(20, 323, 700, 0.06, 1.3, 42));

    // 4. approach to the point: the outer western water builds
    add('wind-approach', 'the approach — pressure builds toward the point', disc(-3100, -3600, 3700), W(18.5, 320, 800, 0.06, 1.4, 36));

    // 5. THE HEADLAND: strongest wind on the map, bent round the rock
    add('wind-point', 'Otter Point — accelerated and bent round the headland', disc(-3000, -3600, 2150), W(20, 313, 700, 0.07, 1.5, 34));

    // 6/7. the beat bands along the west coast, from the spur north to the point's west face
    //      (the coast bights east between the spur tip (-44,1829) and the point (-2500,-2400); the bands follow the
    //       macro line, 700u and 1500u off it). The inshore lane is BACKED, not veered: the along-shore board is
    //       port, and a back lifts it — a veer would lift the board that sails away from the shore.
    add('wind-beat-mid', 'the beat, middle lane — outside the kelp', [
        [-2000, -1700] /*L*/, [-2200, -1600], [-3200, -1300], [-4400, -600], [-3300, 700], [-2200, 1900], [-1200, 3000],
        [-500, 2900], [-200, 2200], [-500, 1700], [-900, 900], [-1200, 100], [-1400, -600], [-1600, -1100]],
        W(15, 322, 450, 0.10, 1.6, 32));
    add('wind-beat-inshore', 'the beat, inshore — short tacks in the kelp, lifted along the shore', [
        [-1300, -2500] /*L*/, [-1900, -1900] /*L*/, [-2100, -1650], [-2550, -1100], [-2000, -300], [-1500, 500], [-1000, 1300], [-600, 1750],
        [-250, 1900], [0, 1500], [300, 800], [500, 200], [500, -300], [200, -900], [-100, -1300], [-400, -1800]],
        W(14, 318, 400, 0.12, 1.8, 30));

    // 8/9. the start: a gradient across the line, sheltered at the shore end
    add('wind-start-outer', 'start lane — the pin end, clear of the spur', [
        [4200, 5300] /*L*/, [3300, 3300] /*L*/, [2600, 2300] /*L*/, [1500, 1500] /*L*/, [500, 1200] /*L*/, [-250, 1900], [-800, 2500], [-1500, 3600],
        [-1400, 4600], [0, 5800], [1200, 7000], [2800, 7200]],
        W(14, 325, 450, 0.10, 1.6, 30));
    add('wind-start-inshore', 'start lane — the boat end, in the lee of the spur', [
        [4200, 5300] /*L*/, [3300, 3300] /*L*/, [2600, 2300] /*L*/, [1500, 1500] /*L*/, [500, 1200] /*L*/, [-250, 1900],
        [-350, 2500], [400, 2400], [1100, 2400], [1800, 2650], [2400, 3200], [3000, 4100], [3400, 4900], [3800, 5600]],
        W(11.5, 322, 400, 0.14, 1.8, 28));

    // 10. the north coast band: from the shore out to COAST_D off the points, from the islet cluster to past the bay
    add('wind-coast-north', 'the north coast — pressure off the points, soft in the coves', [
        ...offsetLine(tips.slice(1), COAST_D), [15500, -1300] /*L*/, [12500, -2400] /*L*/, [10800, -2900] /*L*/, [10000, -3100] /*L*/, [9200, -3400] /*L*/, [8100, -3500] /*L*/,
        [7600, -3450] /*L*/, [6900, -3400] /*L*/, [5800, -3800] /*L*/, [4400, -3900] /*L*/, [3000, -4000] /*L*/, [1500, -3700] /*L*/, [300, -3300] /*L*/, [-900, -3000] /*L*/, [-1000, -4200]],
        W(16, 321, 450, 0.10, 1.6, 32));

    // 11. tip acceleration at the northernmost point
    add('wind-tip', 'the north point — a squeeze of breeze off the tip', [
        [3100, -3500] /*L*/, [3900, -3500] /*L*/, [4000, -4800], [3900, -5500], [3500, -5800], [3000, -5600], [2800, -5000]],
        W(18, 318, 380, 0.09, 1.6, 30));

    // 12. the coves: three lees of three sizes, filling each cove to its mouth line and a little beyond (a lee runs
    //     downwind of the point that casts it, and downwind here is INTO the cove), deep into the land so only the
    //     seaward edge counts
    add('wind-lee-ab', 'first cove — a small shadow east of the point', [
        [-1400, -2600] /*L*/, [-1450, -3900], [-1200, -4450], [-600, -4650], [0, -4700], [250, -4550], [300, -4100], [200, -2600] /*L*/],
        W(12.5, 315, 350, 0.16, 1.9, 26));
    add('wind-lee-de', 'the deceptive cove — pressure at the point, a hole behind it', [
        [3400, -3500] /*L*/, [3650, -4700], [3900, -5150], [4300, -5200], [4800, -5150], [5050, -5000], [5100, -4600], [5100, -3500] /*L*/],
        W(10.5, 310, 350, 0.18, 2.0, 25));
    add('wind-lee-bight', 'the big bight — the deepest shadow on the coast', [
        [5500, -3000] /*L*/, [5600, -4500], [5800, -5000], [6300, -4950], [6800, -4750], [7100, -4450], [7150, -4000], [6900, -3000] /*L*/],
        W(8.5, 305, 350, 0.20, 2.0, 24));

    // 13. the finishing bay: the biggest hole on the course, with pressure getting in down the islet's west side
    add('wind-bay-east', 'east of the islet — open water off the kelp', [
        [9000, -3800], [9600, -3950], [10800, -3600], [11200, -2600], [10600, -1500] /*L*/, [9600, -1400] /*L*/, [9050, -1500] /*L*/, [9050, -3000]],
        W(13.5, 322, 400, 0.12, 1.6, 28));
    add('wind-bay-mouth', 'the bay mouth — the breeze thins between the point and the islet', [
        [7500, -3800] /*L*/, [7800, -3950], [8500, -4000], [9100, -3800], [9100, -3450], [8500, -3350], [7950, -3350], [7500, -3350] /*L*/],
        W(13, 318, 350, 0.14, 1.8, 26));
    add('wind-bay-finger', 'the finger — pressure that gets into the bay down the islet\'s west side', [
        [8450, -3620], [9150, -3450], [9200, -3000], [9150, -2400], [9100, -1500] /*L*/, [8450, -1500] /*L*/, [8450, -2600]],
        W(14, 322, 280, 0.16, 1.8, 24));
    add('wind-bay-west', 'the west half — the hole behind the shore, light and shifty', [
        [7300, -3400] /*L*/, [7400, -2000] /*L*/, [7700, -1500] /*L*/, [8450, -1500] /*L*/, [8450, -2900], [8450, -3350], [7900, -3350]],
        W(6, 302, 280, 0.26, 2.2, 20));
    return Z;
}

// ── partition + buffer + emit ──────────────────────────────────────────────
function landRing(doc) {
    const coast = (doc.shapes || []).find(sh => sh.id === 'coast');
    return coast ? [[openRing(coast.outer)]] : null;
}
function waterArea(poly, land) {          // area of a piece that is not under the coast ring
    const a = Math.abs(ringArea(poly));
    if (!land) return a;
    let onLand = 0;
    for (const p of pc.intersection([[poly]], land)) onLand += Math.abs(ringArea(p[0]));
    return a - onLand;
}
function build(doc) {
    const Z = zones(doc);
    const land = landRing(doc);
    const regions = [];
    for (let i = 0; i < Z.length; i++) {
        const z = Z[i];
        let geom = [[z.poly]];
        const higher = Z.slice(i + 1).map(h => [[h.poly]]);
        if (higher.length) geom = pc.difference(geom, ...higher);
        let k = 0;
        for (const poly of geom) {
            const outer = poly[0];
            const area = Math.abs(ringArea(outer));
            if (area < 250 * 250) continue;                 // sliver
            if (waterArea(openRing(outer), land) < 300 * 300) continue;   // a piece entirely under the land
            // A HOLE MEANS A ZONE IS ENCLOSED BY THIS ONE, and a region cannot carry a hole: dropping it
            // would lay this region's wind over the enclosed zone and average the two (the bay read
            // (6.5 + 17.5) / 2 for exactly this reason). Zones that split the ocean must reach past the
            // envelope; zones inside a band must cross the band's inland edge.
            if (poly.length > 1) throw new Error(`${z.id}: piece ${k} has ${poly.length - 1} hole(s) — extend the enclosed zone(s) past this one's edge`);
            const ring = rdpRing(cleanRing(offsetRing(openRing(outer), bufFor(z.falloff))), TOL).map(rnd);
            if (process.env.DEBUG) { const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]); console.log(`    ${z.id} piece ${k}: area ${Math.round(area / 1e6)}M bbox ${Math.round(Math.min(...xs))},${Math.round(Math.min(...ys))} .. ${Math.round(Math.max(...xs))},${Math.round(Math.max(...ys))}`); }
            regions.push({
                id: k === 0 ? z.id : `${z.id}-${k + 1}`, name: z.name, poly: ring,
                falloff: z.falloff, direction: z.direction, dirVar: z.dirVar, speed: z.speed, speedVar: z.speedVar, period: z.period
            });
            k++;
        }
    }
    return regions;
}

function main() {
    const src = fs.readFileSync(VENUE, 'utf8');
    const headKey = 'window.VENUE_DOC["otter"] = ';
    const at = src.indexOf(headKey);
    const head = src.slice(0, at + headKey.length);
    let body = src.slice(at + headKey.length).trimEnd();
    if (!body.endsWith(';')) throw new Error('unexpected document tail');
    body = body.slice(0, -1);
    const doc = JSON.parse(body);
    // round-trip guard: the serialiser must reproduce the file byte for byte before we touch it
    const rt = head + JSON.stringify(doc, null, 2) + ';\n';
    if (rt !== src) throw new Error('serialiser does not round-trip the document — refusing to write');
    const regions = build(doc);
    doc.wind = { regions };
    const stamp = ' WIND REWORKED 2026-09-14 by art/otter_wind.js (the script overwrites wind.regions and nothing else): base 325° FROM, sheltered start, inshore/mid/offshore beat lanes, headland acceleration, a pressure lane just outside the north-coast points, three cove lees, and the finishing bay as the biggest hole.';
    if (typeof doc.note === 'string' && !doc.note.includes('WIND REWORKED')) doc.note += stamp;
    const verts = regions.reduce((s, r) => s + r.poly.length, 0);
    console.log(`${regions.length} wind regions, ${verts} vertices`);
    for (const r of regions) console.log(`  ${r.id.padEnd(22)} ${String(r.speed).padStart(5)} kt @ ${(Math.round(r.direction * 180 / Math.PI) + 360) % 360}°  f${r.falloff}  ${r.poly.length} v`);
    fs.writeFileSync(OUT, head + JSON.stringify(doc, null, 2) + ';\n');
    console.log('wrote', OUT);
}
main();
