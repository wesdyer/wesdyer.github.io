// VENUE DOCUMENTS — vector land as the source of truth.
//
// A venue document describes a DESIGNED venue: its land as polygons in world
// units, its marks, its route, its wind, its boundary. It replaces the previous
// arrangement where Glacier Sound's geography was traced from a painted mask at
// load time and its course was inferred from green pixels in that mask.
//
// The mask still exists, but only as a one-way IMPORTER: paint -> trace -> vectors,
// read once to seed a document and never again. Re-importing is destructive and
// discards edits, which is why it is a deliberate command and not part of loading.
//
// Land is stored as { outer, holes } rather than a single ring. The current Arctic
// mask needs no holes — its water reaches the image edge, so the land is simply
// connected, and every ring's polygon area matches its pixel area to within 9%.
// Holes are in the format because the moment a mask encloses water completely
// (a lagoon, a tarn), a single-ring trace fills it in as land and says nothing.
//
// Documents are loaded as JS assigning into window.VENUE_DOC, not as JSON: the
// eval harness loads the page over file://, where fetch() is blocked by CORS.
(function () {

// Point-in-polygon, even-odd ray cast. Shared by containment and hole tests.
function pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

function segmentsProperlyIntersect(a1, a2, b1, b2) {
    const d = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = d(b1, b2, a1), d2 = d(b1, b2, a2), d3 = d(a1, a2, b1), d4 = d(a1, a2, b2);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

// Ring self-intersection. O(n^2), but rings are ~20-90 vertices and this runs on
// load and in the editor, never per frame.
function ringSelfIntersects(ring) {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
        for (let j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue;      // adjacent through the wrap
            if (segmentsProperlyIntersect(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) {
                return [i, j];
            }
        }
    }
    return null;
}

const ringArea = (ring) => {
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;                                       // signed
};

// ── Validation ──────────────────────────────────────────────────────────────
// A raster is always topologically sound; a dragged vertex is not. This is the
// price of vector-as-truth, and it is checkable, which is better than the class
// of bug it replaces. Rules follow the standard simple-feature definition:
// rings simple, holes strictly inside their shell, no degenerate rings.
function validateVenueDoc(doc) {
    const problems = [];
    const err = (msg) => problems.push({ level: 'error', msg });
    const warn = (msg) => problems.push({ level: 'warn', msg });

    if (!doc || typeof doc !== 'object') { err('document is not an object'); return problems; }
    if (doc.schema !== 1) err(`unsupported schema ${doc.schema} (expected 1)`);
    if (!doc.world || !doc.world.size) err('world.size missing');
    if (!doc.world || !doc.world.boundary) err('world.boundary missing');
    const bp = doc.world && doc.world.boundary && doc.world.boundary.poly;
    if (bp) {
        if (bp.length < 3) err('world.boundary.poly needs >= 3 points');
        else if (ringSelfIntersects(bp)) err('world.boundary.poly self-intersects');
    }

    const ids = new Set();
    for (const l of (doc.land || [])) {
        if (!l.id) { err('land shape with no id'); continue; }
        if (ids.has(l.id)) err(`duplicate land id "${l.id}"`);
        ids.add(l.id);
        if (!Array.isArray(l.outer) || l.outer.length < 3) { err(`land "${l.id}": outer ring needs >= 3 points`); continue; }
        const si = ringSelfIntersects(l.outer);
        if (si) err(`land "${l.id}": outer ring self-intersects at edges ${si[0]}/${si[1]}`);
        if (Math.abs(ringArea(l.outer)) < 1) err(`land "${l.id}": outer ring is degenerate`);
        for (let h = 0; h < (l.holes || []).length; h++) {
            const hole = l.holes[h];
            if (!Array.isArray(hole) || hole.length < 3) { err(`land "${l.id}" hole ${h}: needs >= 3 points`); continue; }
            if (ringSelfIntersects(hole)) err(`land "${l.id}" hole ${h}: self-intersects`);
            // Every hole vertex must sit inside the shell, not merely its centroid —
            // a hole can escape through a concavity while its centre stays in.
            if (hole.some(p => !pointInRing(p[0], p[1], l.outer))) {
                err(`land "${l.id}" hole ${h}: not contained by its outer ring`);
            }
        }
        if (!l.c || l.r == null) warn(`land "${l.id}": missing baked centroid/radius, will be recomputed`);
    }

    const course = doc.course || {};
    const marks = course.marks || [];
    for (const entry of (course.route || [])) {
        if (entry.kind === 'round') {
            if (!entry.landId) err('route: rounding entry has no landId');
            else if (!ids.has(entry.landId)) err(`route: rounding references unknown land "${entry.landId}"`);
            if (entry.side !== 'port' && entry.side !== 'starboard') err(`route: rounding side "${entry.side}" invalid`);
        } else {
            if (!Array.isArray(entry.marks) || entry.marks.length !== 2) { err(`route: ${entry.kind} entry needs 2 marks`); continue; }
            for (const mi of entry.marks) if (!marks[mi]) err(`route: ${entry.kind} references missing mark ${mi}`);
        }
    }
    if (!(course.route || []).some(e => e.finish)) warn('route has no entry flagged finish');
    if (doc.wind && doc.wind.mode === 'fixed' && typeof doc.wind.baseDirection !== 'number') {
        err('wind.mode is fixed but baseDirection is not a number');
    }
    return problems;
}

// ── Compile ─────────────────────────────────────────────────────────────────
// Produces the runtime shapes the game already races on. Field-for-field
// equivalent to the retired buildMaskGeography: the vegetation inset ratios and
// the granite facet light direction are reproduced exactly, because they feed
// rendering that was tuned against them.
const VEG_INSET = { granite: 0.3, other: 0.82 };
const FACET_LIGHT = { x: -0.55, y: -0.83 };

function compileVenueDoc(doc) {
    const islands = [];
    const byId = {};

    for (const l of (doc.land || [])) {
        const verts = l.outer.map(p => ({ x: p[0], y: p[1] }));
        // Prefer the BAKED centroid/radius. Recomputing them from the ring is not
        // guaranteed to agree (the bake used the mean of the simplified ring), and
        // island radius feeds placement, wind and pathfinding.
        let cx, cy, radius;
        if (l.c && l.r != null) {
            cx = l.c[0]; cy = l.c[1]; radius = l.r;
        } else {
            cx = verts.reduce((a, v) => a + v.x, 0) / verts.length;
            cy = verts.reduce((a, v) => a + v.y, 0) / verts.length;
            radius = Math.max.apply(null, verts.map(v => Math.hypot(v.x - cx, v.y - cy)));
        }
        const isGranite = l.cls === 'granite';
        const inset = isGranite ? VEG_INSET.granite : VEG_INSET.other;
        const isl = {
            id: l.id,
            x: cx, y: cy, radius, vertices: verts,
            vegVertices: verts.map(v => ({ x: cx + (v.x - cx) * inset, y: cy + (v.y - cy) * inset })),
            trees: [], rocks: [],
            style: l.style || (isGranite ? 'granite' : 'ice'),
            // Ice is soft (RRS 31 penalizes marks, not obstructions); granite grounds you.
            soft: l.soft !== undefined ? !!l.soft : !isGranite,
            fromMask: true,
            isRock: isGranite,
            holes: (l.holes || []).map(h => h.map(p => ({ x: p[0], y: p[1] })))
        };
        if (isGranite) {
            isl.facets = verts.map((v1, j) => {
                const v2 = verts[(j + 1) % verts.length];
                const mx = (v1.x + v2.x) / 2 - cx, my = (v1.y + v2.y) / 2 - cy;
                const m = Math.hypot(mx, my) || 1;
                return { i: j, lit: (mx / m) * FACET_LIGHT.x + (my / m) * FACET_LIGHT.y };
            });
        }
        islands.push(isl);
        byId[l.id] = isl;
    }

    const course = doc.course || {};
    const marks = (course.marks || []).map(m => ({ x: m.x, y: m.y, id: m.id, type: 'start' }));

    // The rounding mark is a reference to a LAND SHAPE by id, so it cannot drift
    // onto whatever happens to be at some index.
    let roundMark = null;
    const roundEntry = (course.route || []).find(e => e.kind === 'round');
    if (roundEntry) {
        const target = byId[roundEntry.landId];
        if (target) {
            roundMark = {
                x: target.x, y: target.y, radius: target.radius,
                zone: roundEntry.zone != null ? roundEntry.zone : target.radius * 2.1,
                side: roundEntry.side || 'starboard',
                landId: roundEntry.landId
            };
        }
    }

    // Boundary. `poly` wins when present; `radius` is then the BOUNDING circle, kept
    // populated so any site not yet migrated to Arena degrades to a slightly loose
    // limit rather than to undefined. `circle` is retained as the uniform-sampling
    // fast path — see Arena.sample on why the draw count matters.
    const b = (doc.world && doc.world.boundary) || {};
    let boundary;
    if (b.poly && b.poly.length >= 3) {
        const bc = window.Arena.boundingCircle(b.poly);
        boundary = { x: bc.x, y: bc.y, radius: bc.r, poly: b.poly.map(p => p.slice()), circle: b.circle || null };
    } else if (b.circle) {
        boundary = { x: b.circle.x, y: b.circle.y, radius: b.circle.r, poly: null, circle: b.circle };
    } else {
        boundary = { x: 0, y: 0, radius: (doc.world.size || 8750) * 0.5, poly: null, circle: null };
    }

    return {
        islands,
        marks,
        route: (course.route || []).map(e => Object.assign({}, e)),
        legs: course.legs || 2,
        boundary,
        roundMark,
        windBase: (doc.wind && typeof doc.wind.baseDirection === 'number') ? doc.wind.baseDirection : null,
        seeded: doc.seeded || {}
    };
}

const getVenueDoc = (key) => (window.VENUE_DOC || {})[key] || null;

window.VenueDoc = {
    get: getVenueDoc,
    validate: validateVenueDoc,
    compile: compileVenueDoc,
    pointInRing: pointInRing,
    ringSelfIntersects: ringSelfIntersects,
    ringArea: ringArea
};
})();
