// ONE-TIME migration: turn a baked mask (`*-geo.js`) into a venue DOCUMENT.
//
//   node regatta/art/export_venue_doc.js arctic
//
// Pure Node, no browser. An earlier version read the finished course out of the
// running game, which stopped working the moment initCourse started reading the
// document — it began re-exporting itself. Deriving from the geo file instead is
// reproducible and independent of game state.
//
// Everything here replicates, exactly, what the retired mask branch of initCourse
// did. That chain is reproduced rather than reinvented because it is load-bearing
// and was wrong twice: the wind is square to the painted line and flipped to point
// AWAY from the rounding island, and the line's VERTEX ORDER is then flipped so
// the crossing normal points up-course. Getting either backwards puts the fleet on
// the wrong side of its own start line.
//
// NO ROUNDING of geometry. Rounding to 6 decimals moved boat headings by ~1e-4 by
// t=180s: the simulation is chaotic, so a 1e-10 relative change in a mark position
// compounds into a measurably different race. JSON.stringify emits the shortest
// round-trippable form of a double, so full precision costs a few characters.
//
// After this runs the mask derivation is deleted. The document is authored from
// here on — edit it in editor.html. Re-importing a mask is destructive and is a
// deliberate command, never part of loading.
const fs = require('fs');
const path = require('path');

const VENUE = process.argv[2] || 'arctic';
const MASK_WORLD = 8750;          // must match script.js
const START_WIDTH = 1100;         // same line width as every venue

const GEO = path.resolve(`regatta/assets/images/venues/masks/${VENUE}-geo.js`);
const OUT = path.resolve(`regatta/assets/venues/${VENUE}.venue.js`);

global.window = {};
require(GEO);
const geo = global.window.VENUE_GEO[VENUE];
if (!geo) { console.error(`no VENUE_GEO for ${VENUE}`); process.exit(1); }

const S = MASK_WORLD;
// Mask space is 0..1 with +y DOWN, matching canvas, so the only transform is a
// scale and a shift putting the mask centre at the world origin.
const toWorld = (p) => ({ x: (p[0] - 0.5) * S, y: (p[1] - 0.5) * S });

// ── Land ────────────────────────────────────────────────────────────────────
let coastN = 0;
const land = [];
let granite = null;
for (const sh of geo.shapes) {
    const isGranite = sh.cls === 'granite';
    const outer = sh.ring.map(p => { const w = toWorld(p); return [w.x, w.y]; });
    // Centroid and radius are DERIVED from the stored vertices, not carried over
    // from the bake. bake_mask.py rounds `c`, `r` and `ring` independently to 5
    // decimals, so the baked pair disagrees with its own ring by up to 0.04 world
    // units — and the first edit in the editor then silently "corrected" it,
    // shifting an island radius that feeds placement, wind shadow and pathfinding.
    // Two fields describing one shape must agree, so only one of them is authored.
    const cx = outer.reduce((a, q) => a + q[0], 0) / outer.length;
    const cy = outer.reduce((a, q) => a + q[1], 0) / outer.length;
    const c = { x: cx, y: cy };
    const radius = Math.max.apply(null, outer.map(q => Math.hypot(q[0] - cx, q[1] - cy)));
    const id = isGranite ? 'granite-isle' : (coastN++ === 0 ? 'coast' : `isle-${coastN - 1}`);
    const entry = {
        id,
        cls: isGranite ? 'granite' : 'snow',
        style: isGranite ? 'granite' : 'ice',
        // Ice is soft (RRS 31 penalizes marks, not obstructions); granite grounds you.
        soft: !isGranite,
        // Derived from `outer` above, and re-derived by the editor on every edit,
        // so the two can never drift apart.
        c: [c.x, c.y],
        r: radius,
        outer,
        // The current Arctic mask has none: its water reaches the image edge, so
        // the land is simply connected and every ring's polygon area matches its
        // pixel area to within 9%. bake_mask.py detects enclosed water and emits it
        // here, because a mask that fully encloses a lagoon otherwise traces as
        // solid land and says nothing about it.
        holes: (sh.holes || []).map(h => h.map(p => { const w = toWorld(p); return [w.x, w.y]; }))
    };
    if (isGranite) granite = { x: c.x, y: c.y, radius };
    land.push(entry);
}
if (!granite) { console.error('no granite shape in mask — nothing to round'); process.exit(1); }
if (!geo.start) { console.error('no start line painted on mask'); process.exit(1); }

// ── Course: replicate the retired derivation exactly ────────────────────────
const [pa, pb] = geo.start.map(toWorld);
const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;

let lx = pb.x - pa.x, ly = pb.y - pa.y;
const ll = Math.hypot(lx, ly) || 1;
lx /= ll; ly /= ll;

let ux = -ly, uy = lx;                                   // square to the line
const toIsl = { x: granite.x - mx, y: granite.y - my };
// The start heads AWAY from the island: the line sits in a closed channel, so the
// fleet beats out into open water and comes at the rounding from the sound rather
// than straight up a dead end.
if (ux * toIsl.x + uy * toIsl.y > 0) { ux = -ux; uy = -uy; }
// heading convention: forward = (sin h, -cos h)
const windBase = Math.atan2(ux, -uy);

// Vertex ORDER sets the crossing normal n = (dy, -dx), and the start test wants
// n pointing up-course.
let rx = lx, ry = ly;
if ((ry * ux - rx * uy) < 0) { rx = -rx; ry = -ry; }

const marks = [
    { id: 'sf-pin',  x: mx - rx * START_WIDTH / 2, y: my - ry * START_WIDTH / 2 },
    { id: 'sf-boat', x: mx + rx * START_WIDTH / 2, y: my + ry * START_WIDTH / 2 }
];

const doc = {
    schema: 1,
    venue: VENUE,
    note: 'Imported once from ' + path.basename(GEO) + ' by art/export_venue_doc.js. '
        + 'AUTHORED from here on — edit in editor.html. Re-importing replaces land and discards edits.',
    world: {
        size: S,
        // THE EDGE OF THE MASK IS THE BOUNDARY. A painted map has a natural extent,
        // so the arena is the map rectangle.
        //
        // It used to be the circle INSCRIBED in that square, which discarded the
        // corners: 21% of what was painted fell out of bounds, ice clustered on an
        // arc, and land ran past the limit on one side. Circumscribing instead only
        // trades that for 37% off-map water inside the arena. A rect does neither —
        // 100% of the painted map sailable, 0% off-map water.
        //
        // `circle` is deliberately null: with a polygon it is not what bounds the
        // arena, and a stale twin would leave Arena.sample's fast path describing
        // the wrong shape. Generated venues (which have no document) keep their
        // circle and their exact RNG draw count.
        boundary: { poly: [[-S/2, -S/2], [S/2, -S/2], [S/2, S/2], [-S/2, S/2]], circle: null }
    },
    land,
    course: {
        legs: 2,
        marks,
        route: [
            { kind: 'line',  marks: [0, 1], dir: 1,  beat: true,  role: 'start' },
            // The rounding references a land shape by NAME. Referencing it by index
            // is how two placeholder marks were once able to masquerade as a gate.
            { kind: 'round', landId: 'granite-isle', side: 'starboard',
              // Big enough to capture the whole island, not just skim it.
              zone: granite.radius * 2.1, beat: true, role: 'rounding' },
            { kind: 'line',  marks: [0, 1], dir: -1, beat: false, role: 'finish', finish: true }
        ]
    },
    // Authored, not derived — see the header note on the two sign flips.
    wind: { mode: 'fixed', baseDirection: windBase },
    seeded: { ice: true }
};

// ── Guard: agree with whatever is already on disk ────────────────────────────
// The first import of this venue was written with 6-decimal rounding, which the
// golden traces caught. If a document already exists, confirm this run reproduces
// it to within that tolerance — that is a check on the replicated derivation
// above, which is the part most likely to be subtly wrong.
if (fs.existsSync(OUT)) {
    global.window.VENUE_DOC = {};
    require(OUT);
    const prev = global.window.VENUE_DOC[VENUE];
    if (prev) {
        const diffs = [];
        const cmp = (label, a, b) => { if (Math.abs(a - b) > 2e-6) diffs.push(`${label}: ${a} vs ${b}`); };
        // Scope: the guard exists to check the replicated WIND and VERTEX-ORDER
        // derivation, which is the part most likely to be subtly wrong. `c`, `r`
        // and the rounding `zone` are all derived from the ring and legitimately
        // differ from an older document that carried the bake's independently
        // rounded values, so they are not compared.
        cmp('wind', doc.wind.baseDirection, prev.wind.baseDirection);
        doc.course.marks.forEach((m, i) => {
            cmp(`mark${i}.x`, m.x, prev.course.marks[i].x);
            cmp(`mark${i}.y`, m.y, prev.course.marks[i].y);
        });
        // Only AUTHORED geometry is compared. `c` and `r` are derived from `outer`
        // and legitimately differ from an older document that carried the bake's
        // independently-rounded values.
        doc.land.forEach((l, i) => {
            const p = prev.land[i];
            if (!p) { diffs.push(`land[${i}] missing in previous`); return; }
            l.outer.forEach((v, k) => { cmp(`land[${l.id}].outer[${k}].x`, v[0], p.outer[k][0]); });
        });
        if (diffs.length) {
            console.error(`\nMISMATCH vs existing document (${diffs.length}):`);
            diffs.slice(0, 10).forEach(d => console.error('  ' + d));
            console.error('The replicated derivation disagrees with what is on disk. Not overwriting.');
            process.exit(1);
        }
        console.log('Reproduces the existing document within 2e-6 (now at full precision).');
    }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT,
    '// GENERATED ONCE by art/export_venue_doc.js — now the SOURCE OF TRUTH.\n'
    + '// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.\n'
    + 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
    + `window.VENUE_DOC[${JSON.stringify(VENUE)}] = ${JSON.stringify(doc, null, 2)};\n`);

const verts = land.reduce((a, l) => a + l.outer.length, 0);
console.log(`Wrote ${path.relative(process.cwd(), OUT)}`);
console.log(`  world ${S}  boundary: ${doc.world.boundary.poly.length}-gon (the map rectangle)`);
console.log(`  land ${land.length} shapes / ${verts} vertices: ${land.map(l => l.id).join(', ')}`);
console.log(`  marks ${marks.length}, legs 2, rounding granite-isle zone ${doc.course.route[1].zone}`);
console.log(`  wind ${windBase} rad (${Math.round(windBase * 180 / Math.PI)}deg)`);
