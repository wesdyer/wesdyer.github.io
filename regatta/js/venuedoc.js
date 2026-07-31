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

// ── Keyholing: the document's holes, in the form the RUNTIME speaks ─────────
// A document says interior water with `{outer, holes}`. The game says it with a KEYHOLE — a
// single ring that walks in, around the water, and back out. Both are valid; the game was
// built for the second and says so ("the water is a hole in the polygon ... this has to be
// 'evenodd'" in the renderer, "concave and keyholed" in the collision test).
//
// Nothing converted between them. `holes` was compiled onto the island and read by NOTHING —
// no runtime file mentions it — while `vertices` came from `outer` alone, so an authored
// lagoon would have drawn solid, grounded a boat sailing it, and been invisible to the
// planner. It never bit only because Glacier Sound has zero holes.
//
// Converting here, at the document->runtime boundary, is what makes render, collision AND
// pathfinding right at once: all three consume this one ring, and none of them changes.
// The bridge is zero-width, so parity-based tests (even-odd fill, the crossing-number
// pointInPoly) count its two coincident edges as cancelling and read the lagoon as water.
function keyholeRings(outer, holes) {
    if (!holes || !holes.length) return outer.map(p => [p[0], p[1]]);
    let ring = outer.map(p => [p[0], p[1]]);
    // One hole at a time, each spliced into the ring built so far — so a second hole bridges
    // to the already-keyholed outline rather than to the original.
    for (const hole of holes) {
        if (!hole || hole.length < 3) continue;
        // Closest pair between the two rings. A rightmost-vertex ray cast is the textbook
        // choice; closest-pair is simpler and equivalent for holes that sit clear inside
        // their shell, which the validator already requires.
        let bi = 0, hj = 0, best = Infinity;
        for (let i = 0; i < ring.length; i++) {
            for (let j = 0; j < hole.length; j++) {
                const d = (ring[i][0] - hole[j][0]) ** 2 + (ring[i][1] - hole[j][1]) ** 2;
                if (d < best) { best = d; bi = i; hj = j; }
            }
        }
        // outer[0..bi] -> hole[hj..end] -> hole[0..hj] -> back to outer[bi] -> outer[bi..end]
        const bridged = ring.slice(0, bi + 1);
        for (let k = 0; k < hole.length; k++) {
            const p = hole[(hj + k) % hole.length];
            bridged.push([p[0], p[1]]);
        }
        bridged.push([hole[hj][0], hole[hj][1]]);   // close the hole
        bridged.push([ring[bi][0], ring[bi][1]]);   // return along the bridge
        for (let k = bi + 1; k < ring.length; k++) bridged.push(ring[k]);
        ring = bridged;
    }
    return ring;
}

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

// ── Migration: index references become ID references ────────────────────────
//
// A route entry used to carry `marks: [i, j]` — indices into `course.marks`. That
// made two things impossible. Deleting a mark renumbered every index after it, so
// marks could not be deleted on the map at all. And a gate had no identity of its
// own: it was a pair of indices that happened to appear in an entry, so the same
// gate used twice was two unrelated entries that merely looked alike.
//
// So a LINE is now a first-class named object — a pair of marks, referenced by id —
// and a route entry is a *use* of one, carrying only what varies per use: which
// direction you cross it, and whether it is sailed through or rounded. The route is
// then purely an ORDERING, which is why removing a row leaves the marks alone.
//
// Migration is idempotent and touches reference form only. It deliberately does NOT
// fill in defaults (startTime, cutoff): adding fields to a document nobody edited
// would mark it unsaved on load, and an absent field already means "use the
// default" in compile.
function migrateVenueDoc(doc) {
    const c = doc && doc.course;
    if (!c) return doc;
    const marks = c.marks || [];
    marks.forEach((m, i) => { if (!m.id) m.id = `mark-${i}`; });
    if (!c.lines) c.lines = [];

    let n = 1;
    const nextLineId = () => { while (c.lines.some(l => l.id === `line-${n}`)) n++; return `line-${n}`; };
    const lineFor = (aId, bId) => {
        const found = c.lines.find(l => l.marks && l.marks[0] === aId && l.marks[1] === bId);
        if (found) return found;
        const ln = { id: nextLineId(), marks: [aId, bId] };
        c.lines.push(ln);
        return ln;
    };

    for (const e of (c.route || [])) {
        if (e.lineId == null && Array.isArray(e.marks) && e.marks.length === 2) {
            const a = marks[e.marks[0]], b = marks[e.marks[1]];
            if (a && b) { e.lineId = lineFor(a.id, b.id).id; delete e.marks; }
        }
        if (e.markId == null && e.markIdx != null && marks[e.markIdx]) {
            e.markId = marks[e.markIdx].id;
            delete e.markIdx;
        }
        // `beat` was removed when it turned out a single leg can be a beat, a reach AND
        // a run — see legGoesUpwind / pointOfSail in script.js.
        if ('beat' in e) delete e.beat;
    }
    // A ROUNDING NAMES A MARK, never a land shape. `landId` made the two one object:
    // the mark WAS the island's centroid, so dragging the mark dragged the island, and
    // the island could not be moved without moving the course. They are separate things
    // that happen to be in the same place, so the rounding gets its own mark and the
    // island goes back to being ordinary land.
    //
    // `radius` carries what the mark is standing at — an island is a big obstacle, a buoy
    // is not — because that is what floors the zone and what the sailability check sweeps
    // around. It stays authored after the split, so nothing about the rounding changes.
    for (const e of (c.route || [])) {
        if (e.kind !== 'round' || e.landId == null) continue;
        const land = (doc.land || []).find(l => l.id === e.landId);
        if (!land) continue;
        const cx = land.c ? land.c[0] : land.outer.reduce((a, p) => a + p[0], 0) / land.outer.length;
        const cy = land.c ? land.c[1] : land.outer.reduce((a, p) => a + p[1], 0) / land.outer.length;
        let n = 1;
        while (marks.some(m => m.id === `round-${n}`)) n++;
        const id = `round-${n}`;
        marks.push({ id, name: `Round ${e.landId}`, x: cx, y: cy, kind: 'inflatable' });
        e.markId = id;
        if (e.radius == null) e.radius = land.r != null ? land.r
            : Math.max.apply(null, land.outer.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
        delete e.landId;
    }
    // Leg count is DERIVED from the route: every entry after the start ends a leg.
    // Storing it as well meant two sources of truth that a reorder could separate.
    if (c.legs != null) delete c.legs;
    if (c.type != null) { if (!c.description) c.description = String(c.type); delete c.type; }

    // THERE IS NO BASE WIND. A venue's wind is stated by regions, and "the wind is the
    // same everywhere" is one region covering the whole map — which is exactly what an
    // authored base direction meant, so that is what it migrates into.
    //
    // `speed` is left absent on purpose: the venue's own speed range still applies, so
    // this conversion changes nothing about how the venue plays. Direction + live shift
    // reproduces the old base + shift identically.
    const w = doc.wind;
    if (w && typeof w.baseDirection === 'number') {
        if (!w.regions) w.regions = [];
        if (!w.regions.length) {
            const size = (doc.world && doc.world.size) || 8750;
            const h = size;                        // generous: the field is sampled well
            w.regions.push({                       // outside the arena, for particles
                id: 'wind-all',
                poly: [[-h, -h], [h, -h], [h, h], [-h, h]],
                falloff: 400, direction: w.baseDirection, dirVar: 0,
                speed: null, speedVar: 0, period: 30
            });
        }
        delete w.baseDirection;
        delete w.mode;                             // 'fixed' meant "there is a base"
    }
    // Offsets and multipliers were relative to that base, so they cannot survive it.
    for (const r of ((w && w.regions) || [])) {
        if (r.dirOffset != null) {
            r.direction = (r.direction != null ? r.direction : 0) + r.dirOffset;
            delete r.dirOffset;
        }
        if (r.speedMul != null) delete r.speedMul;  // a multiplier of nothing
        if (r.direction == null) r.direction = 0;
    }
    return doc;
}

// Resolve a document's references to array positions. Used by compile and by
// validation, so the two cannot disagree about what a reference means.
function resolveRefs(course) {
    const marks = course.marks || [];
    const idxById = {};
    marks.forEach((m, i) => { if (m.id != null) idxById[m.id] = i; });
    const lineById = {};
    for (const ln of (course.lines || [])) if (ln.id != null) lineById[ln.id] = ln;
    // A line's ENDS as mark indices, in the line's own vertex order — which is what
    // sets the crossing normal, so the order is authored, not incidental.
    const lineMarks = (id) => {
        const ln = lineById[id];
        if (!ln || !ln.marks || ln.marks.length !== 2) return null;
        const a = idxById[ln.marks[0]], b = idxById[ln.marks[1]];
        return (a == null || b == null) ? null : [a, b];
    };
    return { marks, idxById, lineById, lineMarks };
}

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
    const { idxById, lineMarks } = resolveRefs(course);

    const markIds = new Set();
    for (const m of marks) {
        if (m.id == null) { err('course mark with no id'); continue; }
        if (markIds.has(m.id)) err(`duplicate mark id "${m.id}"`);
        markIds.add(m.id);
    }
    const lineIds = new Set();
    for (const ln of (course.lines || [])) {
        if (ln.id == null) { err('course line with no id'); continue; }
        if (lineIds.has(ln.id)) err(`duplicate line id "${ln.id}"`);
        lineIds.add(ln.id);
        if (!Array.isArray(ln.marks) || ln.marks.length !== 2) { err(`line "${ln.id}": needs exactly 2 marks`); continue; }
        for (const mid of ln.marks) if (!markIds.has(mid)) err(`line "${ln.id}": references missing mark "${mid}"`);
        if (ln.marks[0] === ln.marks[1]) err(`line "${ln.id}": both ends are the same mark`);
    }

    for (const entry of (course.route || [])) {
        if (entry.kind === 'round') {
            if (entry.landId != null) err('route: rounding still references a land shape — a rounding names a MARK');
            if (entry.markId == null) err('route: rounding entry references no mark');
            else if (idxById[entry.markId] == null) err(`route: rounding references missing mark "${entry.markId}"`);
            if (entry.side !== 'port' && entry.side !== 'starboard') err(`route: rounding side "${entry.side}" invalid`);
        } else {
            if (entry.pass != null && entry.pass !== 'through' && entry.pass !== 'round') {
                err(`route: pass "${entry.pass}" invalid (through | round)`);
            }
            if (entry.lineId == null) { err(`route: ${entry.kind} entry references no line`); continue; }
            if (!lineMarks(entry.lineId)) err(`route: ${entry.kind} references unusable line "${entry.lineId}"`);
        }
    }
    // A mark nothing refers to is invisible in the game — it draws, but no leg asks
    // anything of it. Worth saying out loud rather than leaving to be noticed.
    const used = new Set();
    for (const ln of (course.lines || [])) {
        if (!Array.isArray(ln.marks)) continue;
        if ((course.route || []).some(e => e.lineId === ln.id)) for (const mid of ln.marks) used.add(mid);
    }
    for (const e of (course.route || [])) if (e.markId != null) used.add(e.markId);
    for (const m of marks) if (m.id != null && !used.has(m.id)) warn(`mark "${m.id}" is not used by any leg`);

    const rt = course.route || [];
    if (!rt.some(e => e.finish)) warn('route has no entry flagged finish');
    // The leg engine walks the route in order and finishes when leg > legs, so the start
    // has to be leg 0 and the finish the last entry. Anything else races wrong.
    if (rt.length && rt[0].role !== 'start') err('route: the first entry must be the start');
    if (rt.length && !rt[rt.length - 1].finish) err('route: the last entry must be flagged finish');
    for (let i = 1; i < rt.length; i++) if (rt[i].role === 'start') err(`route: entry ${i} is a second start`);
    for (let i = 0; i < rt.length - 1; i++) if (rt[i].finish) err(`route: entry ${i} is flagged finish but is not last`);
    if (course.legs != null) warn('course.legs is ignored — the leg count is derived from the route');
    if (course.startTime != null && !(course.startTime >= 5 && course.startTime <= 600)) {
        err(`course.startTime ${course.startTime}s is outside 5–600s`);
    }
    if (course.cutoff != null && !(course.cutoff > 0)) err('course.cutoff must be a positive number of seconds');
    if (doc.wind && doc.wind.baseDirection != null) {
        warn('wind.baseDirection is ignored — the wind is stated by regions');
    }
    if (!((doc.wind && doc.wind.regions) || []).length) {
        err('no wind regions: outside a region there is no wind, so nothing here can be sailed');
    }
    // Wind and current regions are the same object with different fields on top, so
    // they get the same checks — a polygon, a soft edge, a unique id.
    const checkRegions = (list, what) => {
        const seen = new Set();
        for (let i = 0; i < list.length; i++) {
            const r = list[i];
            if (!Array.isArray(r.poly) || r.poly.length < 3) { err(`${what} region ${i}: poly needs >= 3 points`); continue; }
            if (ringSelfIntersects(r.poly)) err(`${what} region ${r.id || i}: poly self-intersects`);
            if (r.id) { if (seen.has(r.id)) err(`duplicate ${what} region id "${r.id}"`); seen.add(r.id); }
            if (r.falloff != null && r.falloff <= 0) err(`${what} region ${r.id || i}: falloff must be > 0`);
            if (r.speedMul != null && r.speedMul < 0) err(`${what} region ${r.id || i}: speedMul cannot be negative`);
            if (r.speed != null && r.speed < 0) err(`${what} region ${r.id || i}: speed cannot be negative`);
            // Hard edges feel awful and are not physical, so a zero-falloff region is a
            // stencil rather than weather.
            if (r.falloff != null && r.falloff < 50) warn(`${what} region ${r.id || i}: falloff ${Math.round(r.falloff / 5)}m is very hard-edged`);
        }
    };
    const iceIds = new Set();
    for (let i = 0; i < ((doc.ice) || []).length; i++) {
        const f = doc.ice[i];
        if (!Array.isArray(f.outer) || f.outer.length < 3) { err(`ice ${f.id || i}: outer ring needs >= 3 points`); continue; }
        if (ringSelfIntersects(f.outer)) err(`ice ${f.id || i}: outline self-intersects`);
        if (f.id) { if (iceIds.has(f.id)) err(`duplicate ice id "${f.id}"`); iceIds.add(f.id); }
        if (Math.abs(ringArea(f.outer)) < 1) err(`ice ${f.id || i}: outline is degenerate`);
    }
    checkRegions((doc.wind && doc.wind.regions) || [], 'wind');
    checkRegions((doc.current && doc.current.regions) || [], 'current');
    return problems;
}

// The single direction the game still needs one answer for. Sampled at the middle of the
// course rather than averaged over the map: a region far off to one side should not tilt
// the laylines on the course itself.
function representativeWind(windRegions, route, marks, doc) {
    if (!windRegions.length) {
        // Back-compat: a document that still authors a base direction keeps it.
        return (doc.wind && typeof doc.wind.baseDirection === 'number') ? doc.wind.baseDirection : null;
    }
    let cx = 0, cy = 0, n = 0;
    for (const e of route) {
        if (e.kind === 'round' && e.mark) { cx += e.mark.x; cy += e.mark.y; n++; }
        else if (e.marks && marks[e.marks[0]] && marks[e.marks[1]]) {
            cx += (marks[e.marks[0]].x + marks[e.marks[1]].x) / 2;
            cy += (marks[e.marks[0]].y + marks[e.marks[1]].y) / 2;
            n++;
        }
    }
    if (n) { cx /= n; cy /= n; }
    // The same partition-of-unity blend getWindAt uses, with no live shift and no
    // oscillation — this is the MEAN wind, which is what laylines are drawn against.
    let wsum = 0, ux = 0, uy = 0;
    for (const r of windRegions) {
        const sd = window.Arena.signedDist(r, cx, cy);
        if (sd <= 0) continue;
        const t = Math.min(1, sd / r.falloff);
        const w = t * t * (3 - 2 * t);
        if (w <= 0) continue;
        ux += Math.sin(r.direction) * w; uy += -Math.cos(r.direction) * w;
        wsum += w;
    }
    if (wsum <= 0) {
        // The course centre is outside every region. Fall back to the largest region, so
        // the answer is still the wind SOMEWHERE rather than zero.
        let best = null, bestA = -1;
        for (const r of windRegions) {
            const a = Math.abs(ringArea(r.poly));
            if (a > bestA) { bestA = a; best = r; }
        }
        return best ? best.direction : 0;
    }
    return Math.atan2(ux, -uy);
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
        // KEYHOLED, so the runtime's single-ring render / collision / pathfinding all see the
        // interior water. With no holes this is `outer` copied, which is why every existing
        // venue is byte-identical across this change.
        const verts = keyholeRings(l.outer, l.holes).map(p => ({ x: p[0], y: p[1] }));
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
    // `kind` is the APPEARANCE: an inflatable orange floaty, a yellow can, or a
    // land shape standing in as a mark. `type` stays for the older draw code.
    const marks = (course.marks || []).map(m => ({
        x: m.x, y: m.y, id: m.id, name: m.name || null,
        kind: m.kind || 'inflatable', type: m.type || 'start'
    }));

    // The rounding mark is a reference to a LAND SHAPE by id, so it cannot drift
    // onto whatever happens to be at some index.
    // EVERY rounding entry gets its own resolved mark, so a route may contain more
    // than one. `roundMark` stays as the first, for the race-length cutoff and the
    // course axis, which want "the" rounding of a single-rounding course.
    let roundMark = null;
    const route = (course.route || []).map(e => Object.assign({}, e));
    // Resolve ID references to the array positions the leg engine already reads, so
    // the runtime shape is unchanged: `marks: [i, j]` on a line or gate, `markIdx` on
    // a rounding. The document is authored in ids; the engine races on indices.
    const refs = resolveRefs(course);
    for (const e of route) {
        if (e.lineId != null) {
            const lm = refs.lineMarks(e.lineId);
            if (lm) e.marks = lm;
        }
        if (e.markId != null && refs.idxById[e.markId] != null) e.markIdx = refs.idxById[e.markId];
    }
    for (const e of route) {
        if (e.kind !== 'round') continue;
        // A rounding is always a course MARK. What it is standing at is a separate
        // question, answered by `radius`: 12 for a buoy, the island's radius for a mark
        // planted on an island. Land is land; a mark is a mark.
        if (e.markIdx == null || !marks[e.markIdx]) continue;
        const x = marks[e.markIdx].x, y = marks[e.markIdx].y;
        const radius = e.radius != null ? e.radius : 12;
        e.mark = {
            x, y, radius,
            // Default zone: three hull lengths for a buoy (the RRS zone is three
            // boat lengths), or wide enough to capture an island rather than skim it.
            // Three hull lengths is the RRS zone (165u for a buoy); a mark standing at
            // something large needs a zone that captures it rather than skimming it.
            zone: e.zone != null ? e.zone : Math.max(165, radius * 2.1),
            side: e.side || 'starboard',
            markIdx: e.markIdx
        };
        if (!roundMark) roundMark = e.mark;
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

    // SCENERY extent vs ARENA. The arena bounds BOATS. Land and drifting ice are
    // scenery and deliberately extend past it, so a sailor who reaches the limit sees
    // coastline and bergs continuing into the distance rather than the world ending —
    // and because ice does not respect an imaginary line anyway.
    //
    // Shaped like a boundary object so every Arena function works on it unchanged.
    const ae = window.Arena.extent(boundary);
    let s0x = ae.minX, s0y = ae.minY, s1x = ae.maxX, s1y = ae.maxY;
    for (const isl of islands) {
        for (const v of isl.vertices) {
            if (v.x < s0x) s0x = v.x;
            if (v.y < s0y) s0y = v.y;
            if (v.x > s1x) s1x = v.x;
            if (v.y > s1y) s1y = v.y;
        }
    }
    // Roughly a screen's worth beyond whichever reaches further, so there is always
    // something out there to look at.
    const m = (doc.world && doc.world.sceneryMargin != null) ? doc.world.sceneryMargin : 1200;
    const scenery = { poly: [[s0x - m, s0y - m], [s1x + m, s0y - m], [s1x + m, s1y + m], [s0x - m, s1y + m]] };
    const sc = window.Arena.boundingCircle(scenery.poly);
    scenery.x = sc.x; scenery.y = sc.y; scenery.radius = sc.r;

    // ── Wind regions ────────────────────────────────────────────────────────
    // Overlapping and ADDITIVE, not a partition. Two reasons that settled it: a
    // partition cannot produce a convergence line (you would have to draw a third
    // region where you guess it lands, authoring the effect instead of the cause),
    // and partition edges are shared, so moving one region's boundary forces its
    // neighbours' — the same topological bookkeeping that made raster land painful.
    //
    // Each region carries a DIRECTION OFFSET and a SPEED MULTIPLIER rather than a
    // delta, so it survives a change to the venue's base wind range. `var` fields are
    // amplitudes and `period` is the time scale they oscillate over — variance without
    // a time scale is under-specified ("10 degrees" says nothing about whether that is
    // a wobble every two seconds or a swing over a minute).
    const windRegions = ((doc.wind && doc.wind.regions) || []).map((r, i) => {
        const poly = (r.poly || []).map(p => [p[0], p[1]]);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of poly) {
            if (p[0] < minX) minX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] > maxY) maxY = p[1];
        }
        return {
            id: r.id || `wind-${i}`,
            poly,
            // Bounding box, precomputed: getWindAt runs per boat AND per particle per
            // frame, and is sampled again by the AI's lookahead, so the common case
            // (nowhere near this region) has to be four comparisons.
            bb: { minX, minY, maxX, maxY },
            falloff: r.falloff != null ? r.falloff : 400,
            // ABSOLUTE mean direction — what the wind does here, not an offset from
            // somewhere else. `speed` absent means "whatever the venue is doing", which
            // keeps race-to-race variety on a course that only authors direction.
            direction: r.direction != null ? r.direction : 0,
            dirVar: r.dirVar != null ? r.dirVar : 0,
            speed: r.speed != null ? r.speed : null,
            speedVar: r.speedVar != null ? r.speedVar : 0,
            period: r.period != null ? r.period : 30,
            // Fixed per-region phase so regions do not pulse in unison. Derived from
            // the index, never from RNG — getWindAt must not touch the seeded stream.
            phase: (i * 2.399963) % (Math.PI * 2)
        };
    }).filter(r => r.poly.length >= 3);

    // ── Current regions ─────────────────────────────────────────────────────
    // The same object as a wind region, and additive for the same reasons — but the
    // quantity is a FLOW, not a modifier: a patch of water either has a stream running
    // through it or it does not, so the region carries an absolute direction and speed
    // rather than an offset and a multiplier. Summed as vectors on top of whatever the
    // venue's ambient current already is.
    const currentRegions = ((doc.current && doc.current.regions) || []).map((r, i) => {
        const poly = (r.poly || []).map(p => [p[0], p[1]]);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of poly) {
            if (p[0] < minX) minX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] > maxY) maxY = p[1];
        }
        return {
            id: r.id || `current-${i}`,
            poly,
            bb: { minX, minY, maxX, maxY },
            falloff: r.falloff != null ? r.falloff : 400,
            // Flow heading, in the same convention as everything else: the direction
            // the water is GOING (forward = sin, -cos).
            direction: r.direction != null ? r.direction : 0,
            speed: r.speed != null ? r.speed : 0,        // knots
            speedVar: r.speedVar != null ? r.speedVar : 0,
            dirVar: r.dirVar != null ? r.dirVar : 0,
            period: r.period != null ? r.period : 45,
            phase: (i * 2.399963) % (Math.PI * 2)
        };
    }).filter(r => r.poly.length >= 3);

    // ── Hand-placed ice ─────────────────────────────────────────────────────
    // Authored as a world-space polygon so it can be reshaped vertex by vertex, and
    // compiled to the local form makeFloe wants (a shape around its own centroid) plus
    // the centre and radius the placement and collision code reads.
    const ice = ((doc.ice) || []).map((f, i) => {
        const ring = (f.outer || []).map(p => [p[0], p[1]]);
        if (ring.length < 3) return null;
        let cx = 0, cy = 0;
        for (const p of ring) { cx += p[0]; cy += p[1]; }
        cx /= ring.length; cy /= ring.length;
        let r = 0;
        for (const p of ring) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy));
        return {
            id: f.id || `ice-${i}`,
            x: cx, y: cy, r,
            local: ring.map(p => ({ x: p[0] - cx, y: p[1] - cy }))
        };
    }).filter(Boolean);

    const rt = course.route || [];

    // ── How far this course actually is, and therefore its time limit ───────
    // Measured along the ROUTE, mark to mark, with a beat costing about 1.45x the rhumb
    // line. This replaces `legs × legLength`, which describes a windward-leeward and
    // says nothing about a designed course, and the islandRound special case in
    // updateRace, which was that same gap patched for one venue.
    const legPt = (e) => {
        if (e.kind === 'round') return e.mark ? { x: e.mark.x, y: e.mark.y } : null;
        if (!e.marks) return null;
        const a = marks[e.marks[0]], b = marks[e.marks[1]];
        return (a && b) ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
    };
    // Wind-aware, and honest about what it cannot see. The polar prices each leg by the
    // best VMG toward its bearing — so a beat is properly slower than a reach — but the
    // distance is the STRAIGHT LINE, and a straight line can run across land. On Glacier
    // Sound the sailable path is 2.1x the straight line, so this number is a floor.
    //
    // The editor computes the real thing (hull-width path + the same polar) and can write
    // it into `course.cutoff`; that is what a designed course should carry. This is the
    // fallback for a document that has not been through the editor.
    const wb = (windRegions.length && windRegions[0].direction != null)
        ? representativeWind(windRegions, route, marks, doc)
        : ((doc.wind && typeof doc.wind.baseDirection === 'number') ? doc.wind.baseDirection : 0);
    const REF_WIND = 14;                    // knots, mid-range: this is a fallback estimate
    const gts = (typeof getTargetSpeed === 'function') ? getTargetSpeed : null;
    const vmgToward = (bearing) => {
        if (!gts) return null;
        const twaCourse = Math.abs(((bearing - wb + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        let best = 0;
        for (let d = 0; d <= 180; d += 4) {
            const twa = d * Math.PI / 180;
            const v = gts(twa, d > 90, REF_WIND) * Math.cos(twa - twaCourse);
            if (v > best) best = v;
        }
        return best;
    };
    let sailed = 0, secs = 0;
    let prev = legPt(route[0]);
    for (let i = 1; i < route.length; i++) {
        const p = legPt(route[i]);
        if (!prev || !p) { prev = p || prev; continue; }
        const dx = p.x - prev.x, dy = p.y - prev.y;
        const d = Math.hypot(dx, dy);
        const bearing = Math.atan2(dx, -dy);
        // A leg that nets upwind cannot be sailed in a straight line, so it costs more
        // distance than it measures.
        const upx = Math.sin(wb), upy = -Math.cos(wb);
        const upwind = (dx * upx + dy * upy) > d * 0.25;
        sailed += d * (upwind ? 1.45 : 1.0);
        // The polar's opinion, for REPORTING only — see the note on cutoffAuto below.
        const vmg = vmgToward(bearing);
        if (vmg && vmg > 0.2) secs += d / (vmg * 15);   // units/s = knots * 15
        prev = p;
    }

    return {
        islands,
        ice,
        scenery,
        // ⚠️ The DERIVED limit stays deliberately generous, on the straight-line distance
        // with a beat factor. Pricing the straight line with the polar instead makes the
        // number look rigorous and be WORSE: on Glacier Sound the sailable path is 2.1x
        // the straight line, so a polar-priced straight line would DNF the fleet at 2:12.
        // The beat factor was accidentally covering for the detour.
        //
        // A limit that can see land needs pathfinding, which belongs in the editor. It
        // computes the honest number and writes it into `course.cutoff`; this is only what
        // an unauthored document falls back to, and the checks say so out loud.
        sailedDist: sailed,
        estSecsStraight: secs > 0 ? secs : null,
        cutoffAuto: sailed > 0 ? (sailed / 5) * 0.1875 : null,
        windRegions,
        currentRegions,
        marks,
        lines: (course.lines || []).map(l => ({ id: l.id, name: l.name || null, marks: l.marks.slice() })),
        route,
        // DERIVED, never authored: the start opens leg 1 and every entry after it ends
        // one, so a reorder cannot leave a stale count behind.
        legs: Math.max(1, rt.length - 1),
        description: course.description || '',
        // Absent means "use the game's default", so a document that says nothing about
        // timing races exactly as it did before these fields existed.
        startTime: course.startTime != null ? course.startTime : null,
        cutoff: course.cutoff != null ? course.cutoff : null,   // authored only; see cutoffAuto
        boundary,
        roundMark,
        // The one direction the rest of the game still needs a single answer for:
        // laylines, whether a leg nets upwind, the start-line orientation check. There is
        // no authored base wind any more, so it is DERIVED — the region-weighted mean
        // direction at the middle of the course, which for the usual case (one region
        // covering everything) is just that region's direction.
        windBase: representativeWind(windRegions, route, marks, doc),
        seeded: doc.seeded || {}
    };
}

// Migrate on the way out, so every consumer — the game, the editor, the checks, the
// tests — sees exactly one reference form. Idempotent, and the only writer of the
// legacy-to-current conversion.
const getVenueDoc = (key) => {
    const d = (window.VENUE_DOC || {})[key];
    return d ? migrateVenueDoc(d) : null;
};

window.VenueDoc = {
    get: getVenueDoc,
    migrate: migrateVenueDoc,
    validate: validateVenueDoc,
    compile: compileVenueDoc,
    resolveRefs: resolveRefs,
    pointInRing: pointInRing,
    keyholeRings: keyholeRings,
    ringSelfIntersects: ringSelfIntersects,
    ringArea: ringArea
};
})();
