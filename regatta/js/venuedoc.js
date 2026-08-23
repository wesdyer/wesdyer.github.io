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
    if (!doc) return doc;
    // Card copy: a top-level `name` predates the card block (the editor's authored-name
    // field wrote it). One home now — `doc.card.name` — so the game, the editor and the
    // saved file all read the same string.
    if (doc.name) {
        doc.card = doc.card || {};
        if (!doc.card.name) doc.card.name = doc.name;
        delete doc.name;
    }
    const c = doc.course;
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
        // START AND FINISH ARE POSITIONS, not flags. The race is sailed in route order,
        // so the first entry is the start and the last is the finish; the flags only
        // ever restated that (route-ends enforced the order), and two sources of truth
        // is one too many. The compiler stamps them back on for the runtime.
        if ('role' in e) delete e.role;
        if ('finish' in e) delete e.finish;
    }

    // ── GUST SOURCES: multipliers -> knots, metres, seconds ─────────────────────
    // The old `strength` was a multiplier on a fraction of the venue's own wind, so its
    // knots depend on the document's breeze. Converted here against the mean of the wind
    // regions, which is the closest thing to "the venue's wind" that exists at migration
    // time — the whole point of the new units is that the number stops moving when the
    // breeze does, so this conversion happens exactly once.
    const gregs = (doc.gusts && doc.gusts.regions) || [];
    if (gregs.some(r => r.strength != null || r.size != null || r.life != null)) {
        const wr = (doc.wind && doc.wind.regions) || [];
        const meanKt = wr.length ? wr.reduce((a, r) => a + (r.speed || 0), 0) / wr.length : 14;
        for (const r of gregs) {
            // The old means: 0.35 x the venue wind, radiusX 900u (= 360 m across), 165 s.
            if (r.gustKt == null && r.strength != null) r.gustKt = Math.round(r.strength * 0.35 * meanKt * 10) / 10;
            if (r.sizeM == null && r.size != null) r.sizeM = Math.round(r.size * 360);
            if (r.lifeS == null && r.life != null) r.lifeS = Math.round(r.life * 165);
            delete r.strength; delete r.size; delete r.life;
        }
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
        const land = migrateShapes(doc).find(l => l.id === e.landId);
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
    for (const l of migrateShapes(doc)) {
        if (!l.id) { err('shape with no id'); continue; }
        if (ids.has(l.id)) err(`duplicate shape id "${l.id}"`);
        ids.add(l.id);
        if (!SHAPE_KINDS[l.kind]) err(`shape "${l.id}": unknown kind "${l.kind}"`);
        if (!Array.isArray(l.outer) || l.outer.length < 3) { err(`shape "${l.id}": outer ring needs >= 3 points`); continue; }
        const si = ringSelfIntersects(l.outer);
        if (si) err(`shape "${l.id}": outer ring self-intersects at edges ${si[0]}/${si[1]}`);
        if (Math.abs(ringArea(l.outer)) < 1) err(`shape "${l.id}": outer ring is degenerate`);
        for (let h = 0; h < (l.holes || []).length; h++) {
            const hole = l.holes[h];
            if (!Array.isArray(hole) || hole.length < 3) { err(`shape "${l.id}" hole ${h}: needs >= 3 points`); continue; }
            if (ringSelfIntersects(hole)) err(`shape "${l.id}" hole ${h}: self-intersects`);
            // Every hole vertex must sit inside the shell, not merely its centroid —
            // a hole can escape through a concavity while its centre stays in.
            if (hole.some(p => !pointInRing(p[0], p[1], l.outer))) {
                err(`shape "${l.id}" hole ${h}: not contained by its outer ring`);
            }
        }
        // Only for shapes that SIT STILL. A baked centroid matters because island radius
        // feeds placement, wind shadow and pathfinding, and a stale one disagrees with its
        // own ring. A floe is compiled into local space around its own centroid every load,
        // so it has never carried one and never needed to.
        if (shapeTraits(l).motion === 'fixed' && (!l.c || l.r == null)) {
            warn(`shape "${l.id}": missing baked centroid/radius, will be recomputed`);
        }
    }

    const course = doc.course || {};
    const marks = course.marks || [];
    const { idxById, lineMarks } = resolveRefs(course);

    const markIds = new Set();
    for (const m of marks) {
        if (m.id == null) { err('course mark with no id'); continue; }
        if (markIds.has(m.id)) err(`duplicate mark id "${m.id}"`);
        markIds.add(m.id);
        if (m.kind != null && !MARK_KINDS[m.kind]) err(`mark "${m.id}": unknown kind "${m.kind}"`);
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

    const propIds = new Set();
    for (const p of (doc.props || [])) {
        if (!p.id) { err('prop with no id'); continue; }
        if (propIds.has(p.id)) err(`duplicate prop id "${p.id}"`);
        propIds.add(p.id);
        if (!PROP_KINDS[p.kind]) err(`prop "${p.id}": unknown kind "${p.kind}"`);
        if (!isFinite(p.x) || !isFinite(p.y)) err(`prop "${p.id}": needs finite x/y`);
        if (p.plane != null && !PROP_PLANES.includes(p.plane))
            err(`prop "${p.id}": unknown plane "${p.plane}" (seabed | float | surface | canopy)`);
        if (p.contact != null && !PROP_CONTACTS.includes(p.contact))
            err(`prop "${p.id}": unknown contact "${p.contact}" (none | soft | hard)`);
        if (p.motion != null && p.motion !== 'fixed' && p.motion !== 'drift')
            err(`prop "${p.id}": unknown motion "${p.motion}" (fixed | drift)`);
        if (p.motion === 'drift' && p.contact != null && p.contact !== 'none')
            warn(`prop "${p.id}": a drifting prop cannot carry contact — it will be scenery`);
    }

    // ── TRAFFIC ──────────────────────────────────────────────────────────────
    // Vessels on rails: an authored path, an authored schedule, no RNG. The rules that
    // matter are the ones a bad document could turn into a NaN position or a vessel that
    // never arrives — see guidelines/cove-traffic-plan.md.
    const trafficIds = new Set();
    for (const v of (doc.traffic || [])) {
        const who = `traffic "${v.id || '(no id)'}"`;
        if (!v.id) { err('traffic entry with no id'); continue; }
        if (trafficIds.has(v.id)) err(`duplicate traffic id "${v.id}"`);
        trafficIds.add(v.id);
        if (!PROP_KINDS[v.kind]) err(`${who}: unknown kind "${v.kind}"`);
        const pts = Array.isArray(v.path) ? v.path : [];
        if (pts.length < 2) { err(`${who}: path needs >= 2 points`); continue; }
        const sp = [];
        let carried = isFinite(v.speed) ? v.speed : null;
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            const x = Array.isArray(p) ? p[0] : p && p.x, y = Array.isArray(p) ? p[1] : p && p.y;
            if (!isFinite(x) || !isFinite(y)) { err(`${who}: path point ${i} needs finite x/y`); sp.push(carried); continue; }
            let s = Array.isArray(p) ? p[2] : p && p.speed;
            // NEGATIVE IS LEGAL and means astern — the hull covers the next stretch stern
            // first. See the sign-change rule below for what it may not do.
            if (s != null && !isFinite(s)) err(`${who}: path point ${i} speed "${s}" must be a number`);
            if (isFinite(s)) carried = s;
            sp.push(carried);
            if (!Array.isArray(p) && p) {
                if (p.heading != null && !isFinite(p.heading))
                    err(`${who}: path point ${i} heading must be a number in degrees`);
                if (p.dwell != null) {
                    if (!isFinite(p.dwell) || p.dwell < 0)
                        err(`${who}: path point ${i} dwell must be a number >= 0`);
                    // A DWELL MEANS THE VESSEL IS STOPPED THERE, so the point has to say so.
                    // Held at any other speed it would be an instantaneous halt and restart —
                    // the hull would stop dead, sit, and jump back to speed, which is the one
                    // thing the whole constant-acceleration ramp exists to avoid.
                    else if (p.dwell > 0 && carried !== 0)
                        err(`${who}: path point ${i} has a dwell but its speed is ${carried}kt — a vessel can only wait where it has stopped, so set its speed to 0`);
                }
            }
        }
        // THE FIRST POINT IS WHERE A SPEED BELONGS. Every later point inherits the last one
        // named before it, so one number carries a whole lane; `entry.speed` still works and
        // is still read, but the editor no longer offers it — two fields competing to say
        // the same thing is how a lane ends up with a speed nobody can find.
        if (carried == null) err(`${who}: no speed anywhere — give the first path point one`);
        // ZERO IS LEGAL ONLY AS A DESTINATION. At the last point it means "comes to a stop
        // here" and is well defined, because no leg leaves it. Anywhere else it is a vessel
        // that never reaches its next point — the segment time is 2L/(v0+v1), which for two
        // consecutive zeros is a division by zero and for one zero is still finite only
        // because the OTHER end is moving.
        for (let i = 0; i < sp.length - 1; i++) {
            if (sp[i] === 0 && sp[i + 1] === 0)
                err(`${who}: points ${i}-${i + 1} are both 0 knots — the vessel would never leave point ${i}`);
            // ⚠️ A SHIP CANNOT SWAP ENDS AT SPEED. Going from ahead to astern means stopping
            // first, so a sign change is only legal across a point that names 0 — which is
            // also the point where a `dwell` can hold it while it does.
            // A reversal turns the hull between the two legs' bearings. With a `dwell` at
            // the stop that turn is spread across the wait; without one there is no time for
            // it and it happens in a single frame.
            if (i > 0 && sp[i] === 0 && Math.sign(sp[i - 1]) !== Math.sign(sp[i + 1])
                && sp[i - 1] !== 0 && sp[i + 1] !== 0) {
                const q = pts[i];
                if (Array.isArray(q) || !(q.dwell > 0))
                    warn(`${who}: point ${i} reverses ahead/astern with no dwell — the hull swings between the two legs' bearings in one frame; give it a few seconds to turn in`);
            }
            if (sp[i] > 0 && sp[i + 1] < 0 || sp[i] < 0 && sp[i + 1] > 0)
                err(`${who}: points ${i}-${i + 1} go from ${sp[i]}kt to ${sp[i + 1]}kt — a vessel must come to 0 before it reverses, so put a 0-knot point between them`);
        }
        // Nothing precedes the first point, so there is no stop for it to have reversed at.
        if (sp.length && sp[0] < 0)
            err(`${who}: the first point is ${sp[0]}kt — a vessel can only go astern after it has stopped, and nothing comes before the start`);
        if (sp.length && sp[0] === 0 && sp.length > 1 && sp[1] === 0)
            err(`${who}: starts stopped and stays stopped`);
        // THE WAKE MOVED TO THE KIND. A traffic entry that still carries one is not wrong so
        // much as ignored, and a field that quietly does nothing is worse than one that
        // errors — so say so rather than letting a designer keep setting it.
        if (v.wake != null)
            warn(`${who}: "wake" is no longer set per lane — it belongs to the vessel and comes from its kind, so this is ignored`);
        const END = ['despawn', 'stay', 'wrap', 'pingpong'];
        if (v.end != null && !END.includes(v.end)) err(`${who}: unknown end "${v.end}" (${END.join(' | ')})`);
        // A LOOP IS COMPILED AS A CLOSED CURVE, so the ends no longer have to meet — the
        // segment from the last point back to the first is an ordinary segment and the join
        // is continuous in position, heading and speed. What it does need is enough vertices
        // to BE a loop: two points closed is a line sailed up and back, which is `pingpong`.
        if (v.end === 'wrap' && pts.length < 3)
            err(`${who}: a loop needs at least 3 points — with 2 it is a line, which is what "pingpong" is for`);
        // On a closed path the last point's speed ramps into the first's, so those two are
        // adjacent and a pair of zeros there strands the vessel exactly as it would mid-path.
        if (v.end === 'wrap' && sp.length >= 3 && sp[sp.length - 1] === 0 && sp[0] === 0)
            err(`${who}: the loop closes from 0 knots to 0 knots — it would never come round`);
        if (v.respawn && v.end && v.end !== 'despawn')
            warn(`${who}: respawn is ignored unless end is "despawn" — it never despawns`);
        for (const [k, lo] of [['firstSpawn', -Infinity], ['respawnDelay', 0], ['scale', 0.01],
                               ['height', 0], ['windShadow', 0]]) {
            if (v[k] != null && (!isFinite(v[k]) || v[k] < lo)) err(`${who}: ${k} must be a number >= ${lo}`);
        }
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

    // A committee boat belongs on the STARBOARD end of its line — the right-hand end
    // looking up the course. Nothing breaks if it is on the other end; the line simply
    // reads wrong to anyone who races, which is exactly the class of mistake a document
    // should catch before it is sailed. Warning, not error: it is a convention.
    const cbRoute = course.route || [];
    const midOf = (e) => {
        if (!e) return null;
        const lm = e.lineId != null ? lineMarks(e.lineId) : null;
        if (lm) return { x: (marks[lm[0]].x + marks[lm[1]].x) / 2, y: (marks[lm[0]].y + marks[lm[1]].y) / 2 };
        const mi = e.markId != null ? idxById[e.markId] : null;
        return mi != null && marks[mi] ? { x: marks[mi].x, y: marks[mi].y } : null;
    };
    for (const m of marks) {
        if (!m.kind || !(MARK_KINDS[m.kind] || {}).vessel) continue;
        const mi = idxById[m.id];
        let k = -1;
        for (let e = 0; e < cbRoute.length && k < 0; e++) {
            const lm = cbRoute[e].lineId != null ? lineMarks(cbRoute[e].lineId) : null;
            if (lm && (lm[0] === mi || lm[1] === mi)) k = e;
        }
        if (k < 0) continue;
        const here = midOf(cbRoute[k]), ahead = midOf(cbRoute[k + 1]) || null, back = midOf(cbRoute[k - 1]);
        let tx, ty;
        if (here && ahead) { tx = ahead.x - here.x; ty = ahead.y - here.y; }
        else if (here && back) { tx = here.x - back.x; ty = here.y - back.y; }
        else continue;
        // Right hand of travel, in screen axes (y down): rotate the heading +90 degrees.
        const dot = (m.x - here.x) * (-ty) + (m.y - here.y) * tx;
        if (dot < 0) warn(`mark "${m.id}": a committee boat belongs on the starboard end of its line (this is the port end)`);
    }

    const rt = course.route || [];
    // The route's SHAPE — starts first, finishes last, one of each — is checked rather than
    // enforced here. The leg engine still needs it (it walks in order and finishes when
    // leg > legs), but a half-built route is a normal state to be in while editing, and
    // these errors only ever reached the console. `route-ends` in venuecheck reports them
    // where they can be seen and acted on, and the CI gate counts them.
    if (rt.length && !Array.isArray(rt)) err('course.route must be an array');
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
            if (r.falloff != null && r.falloff < 0) err(`${what} region ${r.id || i}: falloff cannot be negative`);
            if (r.speedMul != null && r.speedMul < 0) err(`${what} region ${r.id || i}: speedMul cannot be negative`);
            if (r.speed != null && r.speed < 0) err(`${what} region ${r.id || i}: speed cannot be negative`);
            // A zero falloff is a deliberate hard edge; a tiny positive one is usually a
            // typo for either 0 or something soft.
            if (r.falloff != null && r.falloff > 0 && r.falloff < 50) warn(`${what} region ${r.id || i}: falloff ${Math.round(r.falloff / 5)}m is very hard-edged`);
        }
    };
    checkRegions((doc.wind && doc.wind.regions) || [], 'wind');
    checkRegions((doc.current && doc.current.regions) || [], 'current');
    const rapidsRegions = (doc.rapids && doc.rapids.regions) || [];
    checkRegions(rapidsRegions, 'rapids');
    for (let i = 0; i < rapidsRegions.length; i++) {
        const r = rapidsRegions[i], at = `rapids region ${r.id || i}`;
        if (r.turbulence != null && !(r.turbulence >= 0 && r.turbulence <= 1)) err(`${at}: turbulence must be 0–1`);
        // A rapid IS its turbulence — an explicit zero is flat water wearing the wrong
        // name. (Absent defaults to 0.5 at compile, so only a typed 0 is dead.)
        if (r.turbulence === 0) warn(`${at}: turbulence 0 — this region does nothing`);
        // Flow is the Current layer's, in whole. A rapid that authors knots is the same
        // water stated two ways, which is exactly what the split exists to prevent.
        if (r.speed != null || r.direction != null)
            warn(`${at}: speed/direction are ignored — a rapid is turbulence only; author the flow as a current region`);
    }
    // A gust region is the same polygon with a different question asked of it — not "what
    // is the wind here" but "what is BORN here" — so it takes the same shape checks and
    // then its own numbers on top. Those numbers are now in the units the thing is measured
    // in — knots, metres, seconds — so the rails below are real quantities: a 40-knot puff
    // is not weather, it is a typo, and a 2 km puff is bigger than the arena it is in.
    const gustRegions = (doc.gusts && doc.gusts.regions) || [];
    checkRegions(gustRegions, 'gust');
    const worldM = ((doc.world && doc.world.size) || 8750) / U_PER_M;
    for (let i = 0; i < gustRegions.length; i++) {
        const r = gustRegions[i], at = `gust region ${r.id || i}`;
        if (r.count != null && !(r.count >= 0 && r.count <= 200)) err(`${at}: count must be 0–200`);
        if (r.gustKt != null && !(r.gustKt >= 0 && r.gustKt <= 30)) err(`${at}: gust must be 0–30 kt`);
        if (r.sizeM != null && !(r.sizeM > 0 && r.sizeM <= 2000)) err(`${at}: size must be 1–2000 m`);
        if (r.lifeS != null && !(r.lifeS > 0 && r.lifeS <= 900)) err(`${at}: life must be 1–900 s`);
        if (r.bias != null && !(r.bias >= 0 && r.bias <= 1)) err(`${at}: bias must be 0–1`);
        if (r.veer != null && !(r.veer >= 0 && r.veer <= 90)) err(`${at}: veer must be 0–90 degrees`);
        // A puff wider than the map is a fill, not a puff — and the old x-form made this
        // easy to type without noticing.
        if (r.sizeM != null && r.sizeM > worldM * 0.6)
            warn(`${at}: a ${Math.round(r.sizeM)} m puff on a ${Math.round(worldM)} m map covers most of the course at once`);
    }
    // Gust regions OWN the births. There is no venue-wide puffiness behind them and no
    // implicit open water still making puffs beside them — no source means no puffs, the
    // same way no wind region means calm. So a set of regions that all sit at count 0 is a
    // venue whose wind has quietly gone dead flat.
    if (gustRegions.length && !gustRegions.some(r => (r.count != null ? r.count : 8) > 0)) {
        warn('every gust region has a count of 0, so no puffs are born anywhere: the wind will be dead steady');
    }
    return problems;
}

// The single direction the game still needs one answer for. Sampled at the middle of the
// THE ONE ANSWER the rest of the game needs when it wants "the wind" as a single value —
// laylines, whether a leg nets upwind, the HUD, the AI's pressure reference. DERIVED from
// the regions, never authored: there is no venue wind variable any more, so this is the
// only place a single number for the day comes from.
//
// Weighted toward the course rather than averaged over the map: a region far off to one side should not tilt
// the laylines on the course itself.

// ── The one region edge weight ──────────────────────────────────────────────
// A region's influence at a point, from the signed distance to its outline (positive
// inside) and its falloff. The ramp is CENTERED on the drawn edge: 0 at falloff/2
// outside, 0.5 on the line, 1 at falloff/2 inside. Centered, two abutting regions with
// matching falloff sum to exactly 1 across their shared edge (smoothstep(t) +
// smoothstep(1-t) = 1), so a seam blends breeze into breeze instead of dipping toward
// calm — the blend's leftover weight is calm by design, and an inward-only ramp made
// every abutment leak it. A lone edge still fades smoothly to nothing, and falloff 0 is
// a legal hard edge rather than a division by zero.
//
// Every consumer of falloff goes through here — the wind blend, the current sum, the
// gust spawner, the editor's overlays — so "how wide is an edge" means one thing.
function regionWeight(sd, falloff) {
    if (!(falloff > 0)) return sd > 0 ? 1 : 0;
    const t = Math.min(1, Math.max(0, 0.5 + sd / falloff));
    return t * t * (3 - 2 * t);
}

// A STABLE 0..1 FROM A NAME. FNV-1a, the same hash the seagrass scatter uses, so a
// value derived from an id is identical across sessions, machines and reorderings of
// whatever list the thing happens to live in. Not for anything that must be
// unpredictable — it is a spreader, not a generator.
function hashUnit(s) {
    let h = 2166136261;
    for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h / 4294967296;
}

function representativeWind(windRegions, route, marks, doc) {
    if (!windRegions.length) {
        // Back-compat: a document that still authors a base direction keeps it.
        const d0 = (doc.wind && typeof doc.wind.baseDirection === 'number') ? doc.wind.baseDirection : null;
        return { direction: d0, speed: 0 };
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
    let wsum = 0, ux = 0, uy = 0, sacc = 0;
    for (const r of windRegions) {
        const sd = window.Arena.signedDist(r, cx, cy);
        const w = regionWeight(sd, r.falloff);
        if (w <= 0) continue;
        ux += Math.sin(r.direction) * w; uy += -Math.cos(r.direction) * w;
        sacc += (r.speed || 0) * w;
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
        return best ? { direction: best.direction, speed: best.speed || 0 } : { direction: 0, speed: 0 };
    }
    return { direction: Math.atan2(ux, -uy), speed: sacc / wsum };
}

// ── Compile ─────────────────────────────────────────────────────────────────
// Produces the runtime shapes the game already races on. Field-for-field
// equivalent to the retired buildMaskGeography: the vegetation inset ratios and
// the granite facet light direction are reproduced exactly, because they feed
// rendering that was tuned against them.
const VEG_INSET = { granite: 0.3, other: 0.82 };
const FACET_LIGHT = { x: -0.55, y: -0.83 };

// ── SHAPES: one list, tagged by KIND ────────────────────────────────────────
//
// Land and ice used to be two arrays with two schemas, edited in two layers. They are the
// same thing: a closed polygon on the water that boats hit, that casts a wind shadow, that
// the planner routes around, that the editor puts handles on. Every polygon verb — the two
// selection tools, roughen, simplify, the booleans, resample, duplicate, the three-vertex
// floor — had to be taught twice, and a long run of "make floes behave like land" fixes is
// what a split model feels like from the outside.
//
// What actually differed was five behaviour bits, so those are what a shape carries:
//
//   motion   fixed | drift    does it sit still, or does it wander with the pack
//   hard     true  | false    does it stop you, or shove you and cost you speed
//   look                      which entry in ISLAND_STYLES paints it
//   hidden                    do not draw — a collider behind something that draws the coast
//   nav                       keep out of the A* graph — scenery a boat can never reach
//   height   metres           how tall it stands out of the water
//   awash    true  | false    it is UNDER the surface: sailed over, not collided with
//   drag     0..1             how much speed its shallowest water takes (awash only)
//
// HEIGHT is what decides how much breeze a thing blocks. A wind shadow runs roughly ten
// times the obstacle's height downwind — sailing's own thumb-rule spans seven to fifteen,
// and rigging references say 10-20 — and nothing about its footprint changes that: a
// granite spire and a sandbar of identical outline cast completely different lees. Deriving
// the lee from WIDTH instead cannot tell those apart, and forces an arbitrary cap to stop a
// long coastline asking for a thirty-kilometre shadow. Height needs no cap — it is bounded
// by what land is.
//
// ⚠️ EVERY KIND IS 0 BY DEFAULT, so nothing casts a lee until a designer says how tall it
// stands. A shadow that appears by itself is a shadow nobody decided on: it would change
// how all ten venues sail as a side effect of the feature existing, and leave a designer
// deleting weather they never asked for. The suggested figures are in the comments, so
// typing a real one is a lookup rather than a guess.
//
// AWASH is the third answer to the water-column question the lee derivation already asks.
// Land blocks the whole column and the stream goes around it. A floe blocks the TOP metre
// and the water passes underneath, which is why it drifts. A shoal is the other half of
// that: it blocks the BOTTOM, the hull sails clean over it and the keel does not. So it is
// not a collider — pushing a boat out of a sandbar it is floating above is a lie — and it
// is not scenery either, because shallow water is genuinely slower. `drag` is what it
// costs, and it is graded, not a step: a bar shoals up gradually and so does the tax.
// Awash also settles the lee by itself — a reef awash blocks no breeze and blocks no
// stream, so both shadows read 0 whatever height someone types.
//
// A KIND is a named preset over those seven. That is what makes "iceberg" a different thing
// from "ice" rather than a different colour: the preset says it drifts slowly and stops you.
// Any single axis can still be overridden on one shape without inventing a kind for it.
//
// The first six reproduce EXACTLY what the ten venues did as land[] + ice[]; `shoal` is the
// one deliberate addition, and it is additive — no existing shape can become awash without
// a designer changing its kind. `iceberg` (drift + hard) and `growler` are still absent and
// are a gameplay change to make on purpose, not a side effect of a refactor.
// What a mark LOOKS LIKE. One list, shared by the validator, the editor's dropdown and
// script.js's sprite registry — a second copy is how a kind comes to mean two things.
// `vessel` is the one that is not course furniture: it carries a heading and a hull, so
// it is oriented and collided differently (see orientCourseMarks in script.js).
// ⚠️ THE LATERAL BUOYS ARE DELIBERATELY NOT IN HERE, and the reasoning is worth keeping
// because the obvious move is wrong. They were briefly added as `channel-red`/`channel-green`
// mark kinds and backed out: a MARK is a station on a race course, and a channel buoy is a
// thing that EXISTS IN THE HARBOUR whether or not the course visits it. Making it a mark kind
// forces those two facts together, so you could not have a buoy that is only scenery.
//
// The composition that keeps them separate is better and needs no new kind: place the buoy as
// a PROP wherever the harbour wants one, and when the course should round it, drop a `none`
// mark — 'No buoy (position only)', already in this table — on top of it. Art and race
// function stack independently, one buoy can be furniture and its neighbour a gate mark, and
// nothing about the course document has to know what a buoy looks like.
const MARK_KINDS = {
    inflatable: { label: 'Orange inflatable buoy' },
    can:        { label: 'Yellow can buoy' },
    committee:  { label: 'Committee boat', vessel: true },
    none:       { label: 'No buoy (position only)' }
};

// What a PROP can be. Same single-list rule as MARK_KINDS: the validator, the editor's
// palette and script.js's sprite registry (PROP_SPRITES) all read this one table. A prop
// is a PICTURE WITH A POSITION and nothing else — no collision, no lee, no router entry,
// no effect on play — which is what separates it from every shape kind above. A key is
// '<venue>-<name>', which IS the bake path — assets/images/props/<venue>/<name>.png, the
// convention the game, the editor palette and the schematic all derive their src from.
// That is usually the art manifest's key verbatim, but not always: the manifest keys the
// swamp's assets `bayou-*` while its bakes live under props/swamp/, so the kinds below
// are `swamp-*`. Follow the BAKE, not the manifest — a `bayou-` kind loads nothing.
// `world` is the drawn size in world units (the camera is 1:1), the same number the
// manifest declares.
// A prop is a picture with a position — and, optionally, three more answers, each its
// own axis exactly as a shape kind is a preset over the shape axes:
//
//   plane    seabed | float |            WHERE IT DRAWS. The world has four strata: the
//            surface | canopy            bottom (under everything on the water surface — a
//                                        coral head), the FLOAT plane (on the water and
//                                        BEHIND the land — a lily pad, a raft of hyacinth),
//                                        the surface (over land and water, under the boats
//                                        — a trunk, a beached log), and the canopy (over the
//                                        boats — a tree top an overhung hull passes beneath).
//
//                                        FLOAT IS THE ONE THAT ANSWERS "WATER OBJECT". It
//                                        draws after every mark the water makes — swell,
//                                        wakes, cat's-paws, wind waves — so nothing ripples
//                                        across a pad that is floating on top of it, and
//                                        BEFORE the land, so a bank simply covers whatever
//                                        part of the prop lies on it. That is occlusion by
//                                        draw order and costs nothing: no clip path, no
//                                        per-prop land test, no new per-frame work.
//                                        A water plant on `surface` is a bug — surface means
//                                        "over the land it STANDS ON", which is a beached log
//                                        and never a lily pad.
//   contact  none | soft | hard          WHAT TOUCHING IT DOES. none is scenery; soft
//                                        slows (drag, same 0..0.9 currency as a shoal);
//                                        hard stops. contactR is the collider radius in
//                                        world units.
//   motion   fixed | drift               Fixed, or adrift on the day's water. DRIFT
//                                        FORCES contact:none — a drifting collider would
//                                        need the router re-priced every frame, so a
//                                        drifting prop is scenery BY DEFINITION.
//
// CONTACT COSTS NO NEW PHYSICS: compile emits a small HIDDEN circular shape per
// fixed contact prop — hard becomes a hidden hard isle (the bank precedent: hidden
// colliders are long established), soft becomes a hidden shoal carrying the drag — so
// collision, the drag field, router pricing and the chart all work unchanged. The kind
// states the preset; any axis can be overridden on one placement without inventing a
// kind for it (shapeTraits' rule, applied to props).
const PROP_KINDS = {
    // ── WAKE: A FACT ABOUT THE HULL, NOT ABOUT A SCHEDULE ───────────────────
    // It used to live on the traffic entry, which meant the same cargo ship could be given a
    // planing craft's trail on one lane and the right one on the next, and every venue that
    // ever used her had to know. It belongs here with `hull`, `srcBox` and `contactR`:
    // measured once off the art, true wherever she sails.
    //
    //   kind       'kelvin' | 'ribbon' | 'none'
    //              KELVIN is what a DISPLACEMENT hull throws — the wedge at arcsin(1/3),
    //              regardless of speed. RIBBON is the fleet's own tapered trail, right for a
    //              craft that planes rather than pushing water aside.
    //   hulls      centreline offsets, as fractions of the frame like `hull`. One entry per
    //              wake. Omitted means [0]: a single hull down the middle.
    //   beam       each hull's OWN width when there is more than one, since a catamaran's
    //              demihull is nothing like its overall beam. Omitted means the kind's.
    //   symmetric  true for a hull with two bows. Everything else suppresses its wake when
    //              running astern, because a ship backing down churns rather than throwing a
    //              bow wave; a double-ender astern is not backing down at all, it is simply
    //              going the other way, and it makes its wake from the other end.
    // ── HULL: THE OBLONG THE KIND REALLY IS ─────────────────────────────────
    // [along, across] as fractions of the frame, measured off the bake — the same contract
    // srcBox, contactR and wash carry, and for the same reason: the runtime cannot read the
    // pixels back (getImageData taints the canvas under file://), so a number measured once
    // at bake time is the only honest source. Multiply by `world` for units.
    //
    // This is what the note below asks for when it says a circle cannot fit these. Traffic
    // uses it for the wind-shadow silhouette and for the capsule that stops a boat; a
    // placed, motionless prop still uses none of it and is still scenery.
    // ── LIGHTHOUSE COVE'S WORKING HARBOUR ───────────────────────────────────
    // The ids read awkwardly and are nonetheless the right ones. propSprite derives the sprite
    // path from the kind as `<venue>-<name>` -> props/<venue>/<name>.png, and paths.py leaves
    // the bay's keys unstripped because its assets share no common prefix (`bay-sand` beside
    // `cove-*`), so the files sit at props/bay/cove-cargo-ship.png and the kind has to be
    // `bay-cove-cargo-ship` to find them. Renaming the manifest keys to `bay-cargo-ship*` would
    // buy a tidier id, and manifest keys are the one thing the pipeline promises never change.
    //
    // CONTACT none, ON THE MANIFEST'S OWN ARGUMENT — role is `traffic`, not `hazard`, because
    // "the hazard is its air, not its hull". It is also the only defensible option today: the
    // hidden collider compile emits is a CIRCLE, and these hulls are 4.3:1. Sized to the beam
    // it leaves two thirds of the ship sailable-through; sized to the length it is an invisible
    // wall standing 100+ units off both sides in open water, which is the exact unfairness the
    // shoal note argues against ("you cannot decide to cross something you did not see"). A
    // wrong collider is worse than none, so this ships as scenery until one of two things
    // happens: a hull-shaped collider authored per placement (hidden hard shapes, available
    // today and entirely a drawing job), or propTraits learning an oblong collider.
    //
    // MOTION fixed, and that is a statement of what exists rather than of what these are. The
    // design calls for slow predictable traffic dragging a moving wind shadow; the engine has
    // no 'underway' motion and no prop-borne wind shadow, so a placed ship stands still.
    'bay-cove-cargo-ship':   { label: 'Cargo ship',       world: 720, plane: 'surface', contact: 'none', motion: 'fixed', hull: [0.919, 0.24], wake: { kind: 'kelvin' } },
    'bay-cove-cargo-ship-b': { label: 'Cargo ship (rust)', world: 608, plane: 'surface', contact: 'none', motion: 'fixed', hull: [0.919, 0.24], wake: { kind: 'kelvin' } },
    'bay-cove-cargo-ship-c': { label: 'Cargo ship (green)', world: 496, plane: 'surface', contact: 'none', motion: 'fixed', hull: [0.919, 0.262], wake: { kind: 'kelvin' } },
    // The tug is the family's short-and-beamy one — 2.4:1 against the ships' 3.5:1, a proportion
    // the manifest reserves for it exclusively because 'reads as a toy tug' was the cargo ships'
    // worst round-1 failure. Its collider geometry is better than theirs and still not good:
    // measured off the sprite, hull r90 is 30u against a half-beam of 15.6u, so a circle sized to
    // the mass would stand a full beam-width off each side. contact none for now, matching the
    // family's contract.
    //
    // IF IT SHOULD STOP A HULL, USE contactR 16, NOT 30. Under-covering is the safer error: a
    // pass-through is a missed collision, while an oversized circle is an invisible wall in open
    // water, and that is the unfairness the shoal note argues against — you cannot decide to
    // avoid something you cannot see. 16 fits the beam exactly and covers the middle ~40% of the
    // length.
    'bay-cove-tugboat':      { label: 'Tugboat',           world:  76, plane: 'surface', contact: 'none', motion: 'fixed', hull: [0.921, 0.375], wake: { kind: 'kelvin' } },
    // The biggest hull in the game at 820u — over the 720u lead cargo ship, under the 870/920u
    // bridges it is meant to pass beneath. contact none for the family's reason and for the
    // geometric one: at 4.69:1 a circle fits it no better than it fits the ships.
    'bay-cove-cruise-ship':  { label: 'Cruise ship',       world: 820, plane: 'surface', contact: 'none', motion: 'fixed', hull: [0.92, 0.192], wake: { kind: 'kelvin' } },
    // The cove's small craft, and the traffic contract's hardest case: at 48u against a 32u
    // racing dinghy it is the only vessel here anywhere near a competitor's size, so it cannot
    // win 'never confusable' on size and wins it on silhouette — no rig, an open cockpit full
    // of seats, an outboard on the transom. contact none like the rest of the harbour; at 2.78:1
    // and only 48u a circle would fit it better than any of them, so this is the one to revisit
    // first if the family ever gets colliders (contactR 8, half the beam).
    'bay-cove-motorboat':    { label: 'Motorboat',         world:  48, plane: 'surface', contact: 'none', motion: 'fixed', hull: [0.927, 0.333], wake: { kind: 'ribbon' } },
    // The working boat between the tug and the freighters. NOTE THE TUG'S RESERVED SILHOUETTE
    // SURVIVES ON SIZE AND CLUTTER, NOT ON PROPORTION: the delivered trawler measures 2.26:1
    // against the tug's 2.45:1, so it is fractionally the stubbier of the two and the slot's own
    // "ships are long, the tug is short" distinction does not hold here. It does not need to —
    // 140u against 76u, teal against ochre, and a deck full of drum, gantry, booms and floats
    // against a bare one. Told apart at a glance on three axes, just not that one.
    'bay-cove-trawler':      { label: 'Fishing trawler',   world: 140, plane: 'surface', contact: 'none', motion: 'fixed', hull: [0.921, 0.359], wake: { kind: 'kelvin' } },
    // ── THE TWO FERRIES: THE FIRST KINDS DRAWN FOR THE TRAFFIC ENGINE ───────
    // Every vessel above predates it and was adapted; these two were specified against it,
    // and the two entries below are all it takes to make them authorable — the editor gates
    // its vessel list on `Array.isArray(hull)` rather than on a hand-kept list of names, so
    // a measured hull IS the registration.
    //
    // CONTACT none, and here that word is narrower than it looks. It governs the hidden
    // collider compile emits for a PLACED prop, which is a circle and fits a 3.3:1 ferry no
    // better than it fits the freighters — sized to the beam it leaves two thirds sailable
    // through, sized to the length it is an invisible wall. As TRAFFIC neither of them is
    // scenery: cove-traffic-plan 5 builds a capsule from `hull` and it stops a boat and
    // pushes it, whatever `contact` says. So these are solid when they are underway and
    // sailable-through when they are parked furniture, which is backwards from how it
    // reads and is exactly what the two systems mean.
    //
    // MOTION fixed is likewise a statement about a PLACED prop. The trait only has
    // fixed | drift and neither means 'underway'; the cargo family's note that the engine
    // has no such motion is now out of date — the motion lives in `doc.traffic`, not here.
    'bay-cove-ferry':        { label: 'Ferry',              world: 300, plane: 'surface', contact: 'none', motion: 'fixed', hull: [0.920, 0.279], wake: { kind: 'kelvin', symmetric: true } },
    // THE CAPSULE SPANS THE TUNNEL, DELIBERATELY. This is the only hull in the game that is
    // not one oblong, and its tunnel measures 39u at the widest — wider than the 32u racing
    // dinghy, so "too narrow to enter" is NOT the argument (the manifest slot claimed it was
    // and the delivered art disproved it). It is open on 18% of the length, at the bow notch
    // and the stern gap only, because the bridging deck closes it amidships: there is no
    // through-passage to sail, so one capsule over the whole footprint is honest.
    'bay-cove-fast-ferry':   { label: 'Fast ferry',         world: 200, plane: 'surface', contact: 'none', motion: 'fixed', hull: [0.921, 0.310], wake: { kind: 'ribbon', hulls: [-0.102, 0.102], beam: 0.0925 } },
    // ── THE COVE'S SHORE TREES ──────────────────────────────────────────────
    // Black oak, pitch pine and eastern red cedar — the real coastal-plain association of
    // Nantucket, the Vineyard and the outer Cape, and the cheapest way to make "green
    // headlands" read as a PLACE rather than as green. They are pure scenery and every trait
    // here says so.
    //
    // THE SET IS TOLD APART ON SILHOUETTE AND SIZE, NOT ON COLOUR, and that is measured rather
    // than hoped for. 96 / 72 / 42 world units is a 1.33x and 1.71x ladder; the shapes are a
    // broad closed dome, a bristled tuft-cluster with a notched rim, and a small tight rosette.
    // Colour does LESS work than the manifest subjects claim: in CIELAB the oak sits at b* 41
    // and the two conifers at b* 18.5 and 20.1, so the honest split is broadleaf-vs-conifer,
    // not the three-step warm-to-cool ladder the cedar's subject asks for. Its "plainly bluer
    // than the pitch pine" is 1.7 b* in the wrong direction — below a just-noticeable
    // difference, and irrelevant because the cedar is separated by being half the size, a
    // closed rosette, 4 L* lighter, and the only one carrying pale blue berries.
    //
    // `surface`, NOT `canopy`, AND THAT IS THE ONE CHOICE WORTH ARGUING. The lagoon palms
    // directly below are `canopy` because a palm leans off a sand spit and a hull genuinely
    // passes under its crown. Nothing sails under a headland. On `canopy` these would draw
    // OVER the fleet, so an inland oak would paint itself across a boat racing past the
    // shore — occlusion with no object doing the occluding, which is the exact bug the
    // plane comment calls out for a lily pad on `surface`. Read the plane as a question
    // about what is physically above what, never as a question about what kind of thing it is.
    //
    // `contact: none` — decided, not deferred. These stand on land the fleet cannot reach, so
    // the collider would never be tested; art-pipeline's `ambient` role also forbids them from
    // reading as something to avoid. Nothing to revisit here, unlike the harbour vessels above,
    // whose `none` is a stand-in for a hull-shaped collider the engine cannot yet express.
    //
    // NO SPLIT PAIR, so no trunk half and no canopy half. The bayou's nine tree kinds exist
    // because a swamp tree is sailed BETWEEN — trunk on `surface` to stop a hull, crown on
    // `canopy` to pass beneath — and the visible limb hub is what makes that split legible.
    // With nothing to sail under, one sprite says everything, and the art is drawn as closed
    // foliage with no trunk at all. Anyone who ever re-planes these to `canopy` has to restore
    // the manifest's punchHoles/minHoles first: see-through is worthless on `surface` and
    // mandatory over the fleet, where a painted gap hides a boat as well as a leaf does.
    // ── THE COVE'S TOWN ─────────────────────────────────────────────────────
    // Buildings, all `surface` / `contact: none` like the shore trees: they stand on land the
    // fleet cannot reach, so a collider here would never be tested. The church is a LANDMARK
    // in art-pipeline 2's sense — venue identity — and the rest are ambient.
    //
    // ⚠️ EVERY ONE OF THESE IS DIRECTIONAL, WHICH NOTHING ELSE IN THIS VENUE IS. A tree or a
    // shrub has no front and can be placed at any heading; a building has a ridge, and a town
    // whose ridges point every which way reads as wreckage. Place these with the editor's
    // `prop-spin` checkbox OFF and set `heading °` per placement from the prop inspector.
    // cove-boatshed, when it lands, is the one whose heading is not merely tidy but MEANS
    // something: its door canopy faces the water.
    'bay-cove-church':       { label: 'Church',              world: 184, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-house-captains': { label: "Captain's house",   world: 129, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-cottage-ell':  { label: 'Cottage with ell',    world: 118, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-cottage':      { label: 'Cape cottage',        world:  80, plane: 'surface', contact: 'none', motion: 'fixed' },
    // The waterfront's smallest building and the only one with no ridge — a single shed slope.
    // Its stove pipe is a CIRCLE where every other chimney in the town is a rectangle, which is
    // correct rather than decorative: a metal flue is round and a brick stack is not.
    'bay-cove-shanty':       { label: 'Fish shanty',         world:  55, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-cottage-dormer': { label: 'Dormered cottage',  world: 100, plane: 'surface', contact: 'none', motion: 'fixed' },
    // ⚠️ THE ONE BUILDING WHOSE HEADING MEANS SOMETHING RATHER THAN MERELY LOOKING TIDY: the
    // boat shed's door canopy projects from one gable end, and that end faces the WATER. Point
    // it inland and the building is backwards. Everything else in this town only needs its
    // ridges to agree with its neighbours.
    'bay-cove-boatshed':     { label: 'Boat shed',           world: 150, plane: 'surface', contact: 'none', motion: 'fixed' },
    // ── THE COVE'S CROSSINGS ────────────────────────────────────────────────
    // ⚠️ `canopy`, AND IT IS THE ONLY THING IN THIS VENUE THAT BELONGS THERE. Everything else
    // the cove owns stands on land or floats; a bridge deck is 30m up and the fleet sails
    // UNDERNEATH it — which is the literal definition the plane comment gives ("over the
    // boats — a tree top an overhung hull passes beneath"). On `surface` a bridge would draw
    // under the boats, so a cargo ship would slide over the top of a span it is supposed to
    // pass below. canopyAlpha also fades it as the camera goes under, which is right here for
    // the same reason it is right for a crown: you must still see your own boat.
    //
    // contact none: you sail under it, not into it. If a pier ever needs to stop a hull, that
    // is a hidden hard shape at the pier's footprint, not a collider on the span.
    //
    // ⚠️ THE DOUBLED `bay-bay-` IN THE ID IS CORRECT AND IS NOT A TYPO. propSprite derives the
    // sprite path by splitting the kind at its FIRST hyphen — `<venue>-<name>` ->
    // props/<venue>/<name>.png — and paths.py leaves the bay's keys unstripped because its
    // assets share no common prefix. So the manifest key `bay-cove-bridge-truss` ships to
    // props/bay/bay-cove-bridge-truss.png, and only the id `bay-bay-cove-bridge-truss` finds
    // it. This is the exact case the harbour block's note predicted for any bay key that
    // already begins with `bay-`; every other cove asset is keyed `cove-*` to avoid it.
    'bay-bay-cove-bridge-truss': { label: 'Truss bridge',   world: 870, plane: 'canopy', contact: 'none', motion: 'fixed' },
    // THE FLEET'S HOME, and the only object in the game that carries the SaltyCritter Yacht
    // Club's own burgee — painted flat on the seaward roof slope, which is why it survives a
    // camera that deletes anything vertical. LANDMARK: venue identity, on land, never an
    // obstacle in the water. Place it facing the water with cove-marina in front of it.
    'bay-cove-yacht-club':   { label: 'Yacht club',          world: 168, plane: 'surface', contact: 'none', motion: 'fixed' },
    // The cove's waterfront begins here. A single sawn pile top — place these with the
    // editor's `prop-spin` ON and a `count`, because addProps' "ONE DRAG LAYS A STAND" is
    // what a row of pilings actually is; a baked cluster would stamp one arrangement and
    // could never make a line along a wharf face.
    'bay-cove-piling':       { label: 'Piling',              world:  14, plane: 'surface', contact: 'hard', contactR: 5, motion: 'fixed' },
    // ⚠️ A TILING PROP: sections butt end to end to make a wall of any length, and turn a
    // corner simply by butting at an angle. TWO THINGS MAKE THAT WORK AND BOTH ARE EASY TO
    // UNDO. Its sprite has NO outline on the two ends (the stone run is cut mid-stone), and
    // its manifest fillTo is 1.0 rather than the usual 0.86 — fillTo insets content inside
    // the frame, but drawProps draws the sprite at `world` px, so at 0.86 a section would
    // span only 129 of its 150 units and every join would gap by 14%.
    //
    // ⚠️ SPACING: place sections exactly `world` apart (150). The same arithmetic applies to
    // bay-cove-quay, which ships at fillTo 0.86 — its deck spans 172 of its 200 units, so
    // quay sections butt at 172, not 200.
    'bay-cove-wall-stone':   { label: 'Stone wall',          world: 150, plane: 'surface', contact: 'none', motion: 'fixed' },
    // The two repeatable edges. Both are `hazard` on bayou-dock's argument — a landmark never
    // reads as an obstacle in the water, and a structure reaching into the channel is the whole
    // reason to place one — and both carry a contactR that is honest about its own limits.
    //
    // ⚠️ A CIRCLE CANNOT FIT EITHER OF THESE. The pier is 2.6:1 and the quay 2.1:1, so the
    // collider compile emits covers the middle and leaves the ends sailable-through. That is
    // the safer error (a pass-through is a missed collision; an oversized circle is an
    // invisible wall in open water). For a run of several sections, do what the river does:
    // lay ONE HIDDEN HARD SHAPE along the whole face and override these to contact none.
    'bay-cove-pier':         { label: 'Pier',                world: 150, plane: 'surface', contact: 'hard', contactR: 12, motion: 'fixed' },
    // The quay TILES: sections butt end to end, so its two short ends are plain by design.
    'bay-cove-quay':         { label: 'Quay section',        world: 200, plane: 'surface', contact: 'hard', contactR: 16, motion: 'fixed' },
    // A block of sixteen 20ft boxes standing on the quay. `ambient` and contact none — it is
    // cargo on land, not an obstacle in the water — and the one asset here whose colour is
    // the point: the freight shore is otherwise concrete and rusted steel.
    'bay-cove-containers':   { label: 'Containers',          world: 225, plane: 'surface', contact: 'none', motion: 'fixed' },
    // The ferry berth, and the biggest structure on the waterfront. Its transfer ramp
    // projects from ONE end and that end faces the water — like the boat shed's canopy, this
    // is a heading that MEANS something rather than merely looking tidy.
    'bay-cove-pier-ferry':   { label: 'Ferry terminal',      world: 320, plane: 'surface', contact: 'hard', contactR: 24, motion: 'fixed' },
    // A floating dinghy landing, chained rather than piled — so `float`, the plane that draws
    // AFTER every mark the water makes (no wake ripples across something floating on top of
    // them) and BEHIND the land. `soft`: a float gives when you nudge it.
    'bay-cove-float':        { label: 'Dinghy float',        world:  70, plane: 'float',   contact: 'soft', contactR: 9, motion: 'fixed' },
    // The venue's smallest hull, below the 48-unit motorboat that was previously its floor.
    // ROLE ambient rather than traffic: art-pipeline 2's `traffic` contract is about never
    // being confusable with a competitor, which matters for a vessel UNDERWAY. This one is
    // furniture at a mooring or hauled up a beach.
    'bay-cove-dinghy':       { label: 'Dinghy',              world:  30, plane: 'float',   contact: 'soft', contactR: 5, motion: 'fixed' },
    // ── THE COVE'S SHOPS AND ITS MARINA ─────────────────────────────────────
    // The two shops are ordinary town buildings and take the town's traits. The MARINA is the
    // odd one and needs its two departures stated.
    //
    // `float`, not `surface`: it is a floating dock system, so it draws AFTER every mark the
    // water makes — no wake or cat's-paw ripples across something floating on top of them —
    // and BEHIND the land, so a bank covers whatever part of it laps ashore.
    //
    // ⚠️ `contact: none` UNLIKE THE REST OF THE WATERFRONT, and it is the cargo ship's
    // argument in a worse form. compile emits a CIRCLE per contact prop, and a circle fits a
    // six-slot comb worse than it fits anything else in the game: sized to the outline it
    // seals six slips of open water a boat can legitimately enter, sized smaller it stops
    // nothing. A wrong collider is worse than none. If a placement ever needs teeth, lay
    // hidden hard shapes down the fingers — the river's 82-bank precedent.
    'bay-cove-marina':       { label: 'Marina',              world: 240, plane: 'float',   contact: 'none', motion: 'fixed' },
    'bay-cove-shop-row':     { label: 'Shop row',            world: 200, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-store-general': { label: 'General store',      world: 124, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-cafe':         { label: 'Cafe',                world:  88, plane: 'surface', contact: 'none', motion: 'fixed' },
    // The town's one CIRCLE. Place it with prop-spin ON — a parasol has no front, and rotating
    // the green/cream wedges is free variety that stops a terrace of four reading as one stamp.
    // It is the only cove building-set prop that wants spin on.
    'bay-cove-parasol':      { label: 'Parasol',             world:  24, plane: 'surface', contact: 'none', motion: 'fixed' },
    // ── THE VENUE'S NAMESAKE ────────────────────────────────────────────────
    // `surface` and `contact: none`, like the shore trees and for the same reason: it stands
    // on a headland, the fleet cannot reach it, and a collider that is never tested is a
    // collider that should not exist. It is a LANDMARK in the art manifest's sense — venue
    // identity, never an obstacle — and venues.md also lists the light as a MARK, but that is
    // the separate MARK_KINDS system and nothing here.
    //
    // ⚠️ IT IS NARROWER THAN THE OAK, AND THAT IS CORRECT. 84 against the black oak's 96: a
    // mature oak crown really is wider in plan than a light tower's base, and an aerial photo
    // of a headland shows exactly that. If the namesake needs more presence, place it alone on
    // a point — do not inflate it, or it stops agreeing with every other measured thing here.
    'bay-cove-lighthouse':   { label: 'Lighthouse',          world:  84, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-oak-black':    { label: 'Black oak',           world:  96, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-pine-pitch':   { label: 'Pitch pine',          world:  72, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-cedar-red':    { label: 'Red cedar',           world:  42, plane: 'surface', contact: 'none', motion: 'fixed' },
    // THE SHRUB LAYER UNDER THOSE THREE — same plane and the same reasoning, one band lower.
    // The whole set sits BELOW the cedar's 42 on purpose: a shrub the size of a tree makes the
    // headland one undifferentiated size. Size cannot separate them from each other, though —
    // honest spreads for these species all fall between 1.8m and 4.0m — so they are told apart
    // on rim texture and colour instead, which is why the labels name the plant and not a size.
    // The two hydrangeas are one species in two soils and are meant to be planted ALTERNATELY;
    // they are also the only cultivated plants here, so they belong by the houses and the
    // harbour, in ones and short rows, never scattered over a wild bluff.
    'bay-cove-oak-scrub':    { label: 'Scrub oak',           world:  36, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-bayberry-northern': { label: 'Northern bayberry', world: 28, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-plum-beach':   { label: 'Beach plum',          world:  22, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-hydrangea-blue': { label: 'Blue hydrangea',    world:  18, plane: 'surface', contact: 'none', motion: 'fixed' },
    'bay-cove-hydrangea-pink': { label: 'Pink hydrangea',    world:  18, plane: 'surface', contact: 'none', motion: 'fixed' },

    // THE LATERAL BUOYS — scenery, and a channel that reads as a channel. These are the only
    // props here that name their own `src`, because their art carries no venue: a channel buoy
    // is shared harbour furniture, so paths.py stores the bakes FLAT at props/buoy-channel-*.png
    // and propSprite's '<venue>/<name>' derivation cannot reach them. See the note on
    // propSprite in script.js; `src` is the documented opt-out, not a special case for these.
    //
    // NOT MARK KINDS, deliberately, and this is the design decision to keep: a mark is a station
    // on a RACE COURSE, and a buoy is a thing that exists in the harbour whether the course
    // visits it or not. Keeping them apart means you can line the channel with buoys as pure
    // scenery, and then — where the course really should round one — drop a `none` mark ('No
    // buoy (position only)') on top of that buoy. Art and race function stack independently,
    // one buoy is furniture and its neighbour is a gate mark, and the course document never has
    // to know what a buoy looks like. That composition is why MARK_KINDS carries `none` at all.
    //
    // CONTACT hard, AND THIS IS THE ONE PLACE IN THE HARBOUR WHERE THE COLLIDER ACTUALLY FITS.
    // Every vessel above ships `contact: 'none'` for a geometric reason and not a design one —
    // the hidden collider compile emits is a CIRCLE, and a 4.3:1 cargo hull sized to its beam
    // leaves two thirds of the ship sailable-through while sized to its length it becomes an
    // invisible wall in open water. A buoy is a DISC. The circle is not an approximation of it,
    // it is the shape, so none of that argument transfers and there is no unfairness to trade
    // against: what you see is exactly what stops you.
    //
    //   contactR 13  r90 measured off the bake — 12.6u red, 12.7u green — the same reading the
    //                trunks and the daybeacons use, and it errs inside the drum's true 13.6u
    //                edge. Under-covering stays the safer error: a hull that clips the rim
    //                sails on, where an oversized circle stops it in clear water.
    //   wash 0.48    r99 / world (13.3u / 28), by the rule the cypress knee's note states — "a
    //                prop earns a waterline by standing in water, not by being a tree". A moored
    //                steel drum is the most literal object in the game for that test.
    //
    // ⚠️ IT MAKES THE HARBOUR GATE A REAL NARROW, which is the intended consequence and worth
    // stating: venues.md 1 calls threading it three-abreast the venue's signature moment, and
    // with both buoys solid that moment can now be lost rather than merely tightened. Watch the
    // gate width when the course is laid — two 13u colliders eat 26u of it before any hull does.
    'buoy-channel-red':    { label: 'Red channel buoy',   world: 28, plane: 'surface', contact: 'hard', contactR: 13, wash: 0.48, motion: 'fixed', src: 'assets/images/props/buoy-channel-red.png' },
    'buoy-channel-green':  { label: 'Green channel buoy', world: 28, plane: 'surface', contact: 'hard', contactR: 13, wash: 0.48, motion: 'fixed', src: 'assets/images/props/buoy-channel-green.png' },

    // ── GLOWTIDE'S JELLYFISH ────────────────────────────────────────────────
    // `scatter` is a trait no other prop carries: it tells the renderer that ONE placement
    // is a DRIFT of several animals, not a single sprite, and that drawProps must therefore
    // not draw the bell at the placement point — drawJellyDrifts does the whole group.
    //
    // Scattered at RUNTIME rather than composed into one baked image, which is the same call
    // the arctic's `ships: true` elements record: "a baked group is one image and can never
    // animate a member". Every jelly here rises and falls on its own phase, so a baked bloom
    // would heave as one slab.
    //
    // MOTION drift: they ride the real current, which is free tidal movement and, on the one
    // venue built around reading the stream, turns a bloom into a current telltale. The trait
    // forces contact to none, which is right — a jellyfish is scenery, and the roles table
    // bars ambient art from being confusable with a hazard.
    //
    // PLANE seabed so the water draws OVER them: per the coral note, "the water above is what
    // sells the depth", and depth is the whole animation here. Their LIGHT is emissive and
    // added after the ambient wash, in drawNightGlow — the same split as the nav lights.
    'glowtide-jelly':       { label: 'Jellyfish drift',  world: 32, plane: 'seabed', contact: 'none', motion: 'drift', scatter: 'jelly' },
    'glowtide-jelly-bloom': { label: 'Jellyfish (small)', world: 20, plane: 'seabed', contact: 'none', motion: 'drift', scatter: 'jelly' },
    'lagoon-palm':         { label: 'Palm',         world: 70, plane: 'canopy', contact: 'none', motion: 'fixed' },
    'lagoon-palm-leaning': { label: 'Leaning palm', world: 84, plane: 'canopy', contact: 'none', motion: 'fixed' },
    'lagoon-palm-young':   { label: 'Young palm',   world: 38, plane: 'canopy', contact: 'none', motion: 'fixed' },
    'lagoon-palm-dense':   { label: 'Dense palm',   world: 74, plane: 'canopy', contact: 'none', motion: 'fixed' },
    // ── BLUEWATER BONANZA'S THREE TREES ─────────────────────────────────────
    // Delivered and registered 2026-08-14. What plants the ocean's new sand cays, and the
    // set is told apart on SILHOUETTE FIRST per art-pipeline 2's colour-removed test: ONE
    // ROSETTE OF FEATHERED BLADES, SEVERAL SPIKY STRAP-ROSETTES CLUSTERED, and a BROAD
    // TIERED DOME. Size ladder 110 / 70 / 52, 1.57x and 1.35x apart, so they separate by
    // size before any shape arrives. All three `ambient`, all three `contact: none`: they
    // stand on tropicsand and tropicscrub, both of which are already `hard`, so the land
    // grounds a hull well before the tree would and a collider here would never be tested.
    //
    // ⚠️ ALL THREE ARE `surface`, AND PALM AND PANDANUS WERE BRIEFLY `canopy` — the change
    // is worth recording because the argument for canopy was reasonable and the planted
    // venue disproved it. The case was that a palm leans off a beach crest and a hull passes
    // under its crown, which is true of a lone palm on a 225x398u sand spit. What the
    // planting actually produced is 5,500 plants standing on island interiors, and on the
    // canopy plane every one of them drew OVER the fleet and fed canopyAlpha — so sailing
    // past a shore dimmed a wedge of forest around the boat, several hundred units across,
    // for a hull that was never underneath any of it. A fade with no object doing the
    // occluding, which is the exact bug the plane comment calls out for a lily pad on
    // `surface`, in the other direction.
    //
    // The rule the plane comment states still decides it: read the plane as a question
    // about what is physically above what. Nothing on this venue sails under a tree,
    // because the trees are inland and the fleet is on the water.
    //
    // ONE THING FALLS OUT OF THIS AND IS WORTH KEEPING: see-through no longer matters here.
    // The openings floor exists because a canopy sprite hides a boat with a painted gap as
    // well as with a painted leaf; on `surface` nothing draws over a boat at all. The
    // pandanus's measured 3.9% interior alpha holes — the best of any tree in the game —
    // is now a free bonus rather than a requirement. Anyone re-planing any of these to
    // `canopy` has to restore the openings requirement first.
    'ocean-palm-coconut':    { label: 'Coconut palm',   world:  70, plane: 'surface', contact: 'none', motion: 'fixed' },
    'ocean-pandanus':        { label: 'Pandanus',       world:  52, plane: 'surface', contact: 'none', motion: 'fixed' },
    'ocean-almond-tropical': { label: 'Tropical almond', world: 110, plane: 'surface', contact: 'none', motion: 'fixed' },
    // ── AND ITS THREE UNDERBRUSH PLANTS ─────────────────────────────────────
    // Delivered and registered 2026-08-14. What goes UNDER the trees: the default coastal
    // bush, the groundcover that softens bare sand, and the filler that breaks up an open
    // interior. Ladder 40 / 30 / 20, continuing the trees' 110 / 70 / 52 down, and separated
    // on silhouette first: a DENSE CLOSED MOUND, an OPEN SPRAWL OF RUNNERS, a SOFT FEATHERED
    // TUFT.
    //
    // ALL THREE `surface`, WHICH IS THE EASY HALF OF THE PLANE QUESTION AND WORTH STATING
    // ANYWAY: nothing sails under a knee-high bush. The trees above split because a palm
    // leaning off a beach crest genuinely overhangs water a hull reaches; no part of any of
    // these is ever above a boat. contact none for the family's reason — they stand on
    // tropicsand and tropicscrub, both `hard`, so the land grounds a hull first.
    //
    // ⚠️ THE GRASS IS THE ONLY PLANTING IN THE VENUE THAT DOES NOT READ DARK. Every other
    // plant here is a dark mass on a lighter ground; a sun-cured grass genuinely is not, so
    // it separates on HUE instead — straw gold against yellow-green. Measured at its own 20px
    // display size composited over the scrub it stands on, it reads dE 27.1 from the ground,
    // against the naupaka's 27.3. It works, and it works for a different reason than
    // everything else on this list, so do not "correct" it toward green.
    // ── STILLWATER LAKE'S NORTH WOODS ───────────────────────────────────────
    // Delivered and registered 2026-08-15. Five of the venue's eight plants; red pine, bracken
    // fern and lowbush blueberry are still slots. All `surface` / `contact: none` — nothing on
    // a lake sails under a tree, so there is no canopy case to make and no see-through
    // requirement to buy. The ocean's palm and pandanus were briefly `canopy` and had to be
    // moved back; this venue starts where that ended up.
    //
    // ⚠️ THE LADDER IS FIVE DEEP AND COMPRESSED — 110 / 88 / 80 / 68 / 55 once the red pine
    // lands, ratios 1.25 / 1.10 / 1.18 / 1.24, well under the 1.33x the cove family holds.
    // It only works because every ADJACENT pair is separated on another axis, and two pairs
    // carry the whole design:
    //
    //   pine vs fir     dE 8.7 apart in colour — near-identical teal conifers, which is
    //                   honest, and separated 2x on size and on construction (an open crown
    //                   of tufted rafts against a small closed rosette).
    //   birch vs aspen  the venue's real risk: adjacent in size, both round pale-barked
    //                   broadleaves, both in the same wood. Separated on DENSITY, inverted
    //                   on purpose — the birch ships 44% circle fill with its white limbs
    //                   showing through the gaps, the aspen 83% with a closed canopy and no
    //                   bark visible anywhere. That is the one axis that survives with colour
    //                   removed, which is what art-pipeline 2 actually asks for; colour adds
    //                   dE 16.1 on top.
    //
    // Anyone adding a sixth tree checks BOTH axes against its neighbours, because size alone
    // can no longer carry one.
    'lake-pine-white':       { label: 'Eastern white pine', world: 110, plane: 'canopy', contact: 'none', motion: 'fixed' },
    'lake-pine-red':         { label: 'Red pine',           world:  88, plane: 'canopy', contact: 'none', motion: 'fixed' },
    'lake-birch-paper':      { label: 'Paper birch',        world:  80, plane: 'canopy', contact: 'none', motion: 'fixed' },
    'lake-aspen-quaking':    { label: 'Quaking aspen',      world:  68, plane: 'canopy', contact: 'none', motion: 'fixed' },
    'lake-fir-balsam':       { label: 'Balsam fir',         world:  55, plane: 'canopy', contact: 'none', motion: 'fixed' },
    'lake-alder-speckled':   { label: 'Speckled alder',     world:  48, plane: 'canopy', contact: 'none', motion: 'fixed' },
    // The ground layer. Bracken is what the open floor of a northern pine wood is actually
    // made of and will be placed most; the blueberry is for thin ground between the pines and
    // for the cracks in a [[lake-gneiss]] shelf, which is where lowbush blueberry really grows.
    'lake-fern-bracken':     { label: 'Bracken fern',       world:  34, plane: 'canopy', contact: 'none', motion: 'fixed' },
    'lake-blueberry-lowbush':{ label: 'Lowbush blueberry',  world:  22, plane: 'canopy', contact: 'none', motion: 'fixed' },

    // ── STILLWATER'S BUILT AND NATURAL PROPS ────────────────────────────────
    // The eighteen non-vegetation kinds, registered together now the art has landed. Until
    // this block existed the sprites were on disk and in the manifest and PLACEABLE NOWHERE:
    // the editor lists kinds from here, so a finished asset that is not in this table simply
    // does not exist to the venue. art-pipeline 6 defers registration on purpose — slots and
    // boxes first, art second — but deferred is not skipped, and this is the step that was
    // still owed.
    //
    // PLANES. `surface` for everything on land, which is most of it: the fleet cannot reach a
    // fire ring. `float` for the five that sit ON the water — canoe, skiff, swim raft, mooring
    // buoy and the swim line — because that plane draws AFTER the water's own marks, so no
    // wake or cat's-paw ripples across a hull lying on top of one, and BEFORE the land, so a
    // beach simply covers the part of a drawn-up boat that lies on it. Nothing here is
    // `canopy`; the trees own that plane and nothing in this batch is sailed under.
    //
    // COLLIDERS, AND WHY MOST OF THEM ARE `none`. A contact prop compiles to a hidden circle
    // that also enters the router's grid, and script.js records the river's 82 hidden banks
    // causing multi-hundred-millisecond replan spikes — so a collider is spent only where a
    // boat can actually meet the thing. Six earn one. The radii are measured off the BAKE, not
    // guessed from `world`: fillTo 0.86 means a prop draws at 86% of its declared size, so a
    // 44u boulder is a 38px stone and its radius is 19, not 22.
    //
    // ⚠️ THE BOULDERS ARE THE ONE CASE WHERE A CIRCLE IS EXACTLY RIGHT rather than a
    // compromise — a boulder IS a circle in plan — which is why they take a full-coverage
    // radius where every long prop deliberately under-covers. `lake-dock` takes its BEAM (10)
    // and not its length, following swamp-dock's 9: an object 2:1 or longer cannot be covered
    // by one circle, and a pass-through is a missed collision where an oversized circle is an
    // invisible wall standing off in open water. `lake-swim-line` gets NO collider at all: a
    // rope does not stop a racing hull, and pretending it does is the unfairness the shoal
    // note argues against.
    //
    // `srcBox` IS MEASURED, NOT ESTIMATED — [x, y, w, h] of the frame the art actually
    // occupies, off each shipped bake with a 1% margin for the antialiased rim, and carried
    // only where the ink is thin enough to be worth skipping. Its extreme here is the swim
    // line at 5% ink: a 296px quad to composite a 26px-wide rope. Round props that fill their
    // frame (both boulders, the raft, the fire ring) get none, exactly as a canopy does not.
    // RE-MEASURE ON ANY RE-INGEST — a box too small clips the sprite, which is a visible bug.
    'lake-camp-lodge':        { label: 'Camp lodge',        world: 166, plane: 'surface', contact: 'none', srcBox: [0.276, 0.059, 0.448, 0.881], motion: 'fixed' },
    'lake-cabin':             { label: 'Log cabin',         world:  88, plane: 'surface', contact: 'none', srcBox: [0.234, 0.058, 0.531, 0.884], motion: 'fixed' },
    'lake-log-fallen':        { label: 'Fallen log',        world:  74, plane: 'surface', contact: 'none', srcBox: [0.355, 0.058, 0.29, 0.885], motion: 'fixed' },
    // ⚠️ THE SWIM LINE COLLIDES, AND A CIRCLE CANNOT HONESTLY COVER IT. The segment is 74u
    // long and 6.5u wide — 11:1 — so this is the cargo-ship case at its most extreme, and
    // propTraits has no oblong collider (see the note above at the oblong-hazard entry). Both
    // ends of the usual rule fail here: the BEAM rule gives radius 3, under the floor of 4, and
    // segments laid end to end would leave 70u gaps a boat sails clean through; the LENGTH rule
    // gives 37 and stands an invisible 74u-wide wall in open water.
    // SO IT IS `soft`, AT 12. Soft is what makes the compromise affordable — the failure mode
    // of an oversized SOFT collider is arriving in the drag slightly early, not being stopped
    // by nothing, which is the unfairness the shoal note actually argues against. 12 is about
    // twice the beam and a sixth of the length, so segments butted end to end put drag over
    // roughly a third of the rope: fouling the swim line slows you, as it should, without
    // walling off the water beside it.
    // ⚠️ TO MAKE IT A REAL BARRIER, OVERLAP THE PLACEMENTS — spacing them ~24u instead of 74u
    // chains the circles into a continuous line. That costs three times the sprites, so it is a
    // per-course decision and not a default. The proper fix is an oblong collider in
    // propTraits, and this entry is the second asset asking for one.
    'lake-swim-line':         { label: 'Swim line',         world:  74, plane: 'float',   contact: 'soft', contactR: 12, srcBox: [0.456, 0, 0.088, 1], motion: 'fixed' },
    'lake-cabin-b':           { label: 'Tin-roof cabin',    world:  72, plane: 'surface', contact: 'none', motion: 'fixed' },
    'lake-camp-cabin':        { label: 'Camp bunkhouse',    world:  51, plane: 'surface', contact: 'none', srcBox: [0.314, 0.059, 0.373, 0.883], motion: 'fixed' },
    'lake-canoe-rack':        { label: 'Canoe rack',        world:  51, plane: 'surface', contact: 'none', srcBox: [0.181, 0.059, 0.633, 0.883], motion: 'fixed' },
    'lake-canoe':             { label: 'Canoe',             world:  46, plane: 'float',   contact: 'soft', contactR:  6, srcBox: [0.376, 0.055, 0.248, 0.884], motion: 'fixed' },
    'lake-boulder-large':     { label: 'Glacial boulder',   world:  44, plane: 'surface', contact: 'hard', contactR: 19, motion: 'fixed' },
    'lake-dock':              { label: 'Crib dock',         world:  42, plane: 'surface', contact: 'hard', contactR: 10, srcBox: [0.252, 0.055, 0.496, 0.889], motion: 'fixed' },
    'lake-boat-aluminum':     { label: 'Aluminium skiff',   world:  40, plane: 'float',   contact: 'soft', contactR:  6, srcBox: [0.302, 0.059, 0.395, 0.883], motion: 'fixed' },
    'lake-raft-swim':         { label: 'Swim raft',         world:  33, plane: 'float',   contact: 'hard', contactR: 14, motion: 'fixed' },
    'lake-bulrush':           { label: 'Bulrush',           world:  32, plane: 'surface', contact: 'none', motion: 'fixed' },
    'lake-mooring-buoy':      { label: 'Mooring buoy',      world:  20, plane: 'float',   contact: 'soft', contactR:  8, motion: 'fixed' },
    'lake-boulder-small':     { label: 'Granite cobble',    world:  18, plane: 'surface', contact: 'hard', contactR:  8, motion: 'fixed' },
    'lake-picnic-table':      { label: 'Picnic table',      world:  17, plane: 'surface', contact: 'none', srcBox: [0.049, 0.196, 0.902, 0.608], motion: 'fixed' },
    'lake-firering':          { label: 'Fire ring',         world:  14, plane: 'surface', contact: 'none', motion: 'fixed' },
    'lake-adirondack-chair':  { label: 'Adirondack chair',  world:   8, plane: 'surface', contact: 'none', motion: 'fixed' },

    // ── SOCKEYE RUN'S PLANTS ────────────────────────────────────────────────
    // All seven, registered together now the art has landed. Three trees, two shrubs, one accent
    // and one overlay mat — the whole vegetated character of a Southeast Alaska river.
    //
    // PLANE `canopy` for everything that grows UP, following Stillwater's eight plants exactly.
    // ⚠️ NOTE THE COMMENT ABOVE THAT BLOCK IS STALE AND SAYS `surface`; the entries there are
    // canopy and always have been. The consequence is worth stating once rather than rediscovering:
    // canopy props draw OVER the fleet, and the bayou's split-canopy note couples that to an
    // openings requirement, because a painted gap hides a boat as well as a leaf does. No asset in
    // the manifest carries `minHoles` any more, so the whole canopy family currently occludes like
    // a solid disc. For THIS venue that is a deliberate decision rather than an oversight — the
    // owner asked for full canopies with no punched holes, and all three river tree subjects were
    // rewritten to say so. Anyone reinstating see-through starts by reading those.
    //
    // `river-moss-mat` is the exception at `surface`: it lies ON the ground and nothing passes
    // under a moss mat, so putting it on canopy would draw it over hulls for no reason.
    //
    // CONTACT none on all seven, and that is not laziness. Every contact prop compiles to a hidden
    // circle that also enters the router's grid, and script.js records the river's own 82 hidden
    // banks causing multi-hundred-millisecond replan spikes — in THIS venue. Vegetation is land
    // scenery the fleet cannot reach, so a collider here would never be tested and would cost the
    // one venue that has already paid that bill.
    //
    // PROP-SPIN ON for all seven. None of them has a front: a shrub, a moss mat and a crown seen
    // from above are all rotationally free, and spinning them is what stops a planted stand reading
    // as stamped copies. The trees are the same case as Stillwater's, not the dock's.
    //
    // srcBox ONLY ON THE MAT. The six plants all fill 74-87% of their frames after fillTo, so
    // there is nothing worth skipping; the mat is 0.63 tall because it is honestly oblong, and its
    // box is measured off the shipped bake with a 1% margin. Re-measure it on any re-ingest.
    'river-cottonwood-black': { label: 'Black cottonwood',  world: 128, plane: 'canopy',  contact: 'none', motion: 'fixed' },
    'river-spruce-sitka':     { label: 'Sitka spruce',      world: 104, plane: 'canopy',  contact: 'none', motion: 'fixed' },
    'river-hemlock-western':  { label: 'Western hemlock',   world:  84, plane: 'canopy',  contact: 'none', motion: 'fixed' },
    'river-alder-red':        { label: 'Red alder',         world:  56, plane: 'canopy',  contact: 'none', motion: 'fixed' },
    'river-willow':           { label: 'River willow',      world:  30, plane: 'canopy',  contact: 'none', motion: 'fixed' },
    'river-moss-mat':         { label: 'Moss mat',          world:  26, plane: 'surface', contact: 'none', srcBox: [0.057, 0.173, 0.885, 0.655], motion: 'fixed' },
    'river-fireweed':         { label: 'Fireweed',          world:  18, plane: 'canopy',  contact: 'none', motion: 'fixed' },
    // THE MEADOW FLOWERS. Same four decisions as the seven above — canopy, contact none, prop-spin
    // on, fixed — because they are the same kind of thing: land scenery with no front that the fleet
    // cannot reach. Two of the commission's four are here; `river-arnica` and
    // `river-paintbrush-scarlet` are accepted but not yet ingested, and get their rows then.
    //
    // ⚠️ BOTH ARE PROVISIONAL ART AND BOTH DRAW SHORT. Their masters came back 1.9:1 rather than
    // square, so fillTo fits the LONG axis and the plant occupies 17x9px (lupine) and 14x7px
    // (yarrow) inside its declared world box, not the full 20 and 16. Placement is unaffected —
    // position is authored, not size — but a square re-roll will make both look markedly bigger at
    // the same `world`, so judge density after that, not now. See their manifest notes.
    //
    // NO srcBox on either, deliberately, even though both are more oblong than `river-moss-mat`
    // which carries one. srcBox is a draw-time sampling shortcut, not a sizing control
    // (drawSpriteBoxed maps the sub-rect to the same normalized destination), so it buys nothing
    // visible — and it is measured off the shipped bake, which means a stale box the moment either
    // of these is re-rolled. Add it when the art is final, if at all.
    'river-lupine-nootka':    { label: 'Nootka lupine',     world:  20, plane: 'canopy',  contact: 'none', motion: 'fixed' },
    'river-yarrow':           { label: 'Common yarrow',     world:  16, plane: 'canopy',  contact: 'none', motion: 'fixed' },
    // ── THE FOOTBRIDGE ──────────────────────────────────────────────────────────────
    // The venue's landmark, and the first thing here the fleet passes UNDER rather than
    // around. `canopy` for exactly that reason — it is the plane that draws over the boats —
    // following the cove's two bridges, whose own note sizes the cruise ship to clear them.
    //
    // CONTACT none. It crosses high enough for a rig, so nothing about it should stop a hull,
    // and this is the venue that cannot afford spare colliders: script.js records its 82
    // hidden banks causing multi-hundred-millisecond replan spikes.
    //
    // ⚠️ PLACE IT WITH prop-spin OFF and set `heading °` per placement. It is the only river
    // prop with an axis: every plant, boulder and log here is rotationally free and wants spin
    // ON, and a bridge laid at a random angle crosses nothing.
    //
    // ⚠️ fadeMin 0.3, AND IT IS THE FIRST KIND IN THE GAME TO CARRY ONE. Canopy props fade as
    // the player closes, and CANOPY_FADE_MIN is 0.0 because a tree's stem keeps drawing at full
    // opacity on `surface` — so a crown at zero opens rather than vanishes. A bridge has no
    // stem. At 0.0 it would disappear entirely at the moment the boat is under it, which is the
    // one moment a landmark you are sailing beneath should still be visible. 0.3 leaves it a
    // clear ghost overhead with the hull showing through. See canopyAlpha().
    //
    // srcBox measured off the shipped 600px bake with a 1% margin: the bridge is a 1:7.9 ribbon
    // in a square frame, so 82% of that frame is empty and this skips sampling it. Re-measure
    // on any re-ingest — the number is only true for this bake.
    'river-footbridge':       { label: 'Foot bridge',       world: 300, plane: 'canopy',  contact: 'none', motion: 'fixed', fadeMin: 0.3, srcBox: [0.407, 0.030, 0.187, 0.940] },
    // ── THE GRANITE BOULDERS ────────────────────────────────────────────────────────
    // The venue's first rock you can actually hit. `outcrop` is a SHAPE and means a scoured
    // bedrock ledge; these are props and mean individual stones. The largest is 52u,
    // deliberately just under the smallest authored outcrop polygon (54u), so the two
    // families never compete on size.
    //
    // ⚠️ A BOULDER IS THE ONE CASE WHERE A CIRCLE IS EXACTLY RIGHT rather than a compromise —
    // a boulder IS a circle in plan — so unlike every long prop in the library these take a
    // FULL-coverage radius. Measured off the bake, not guessed from `world`: fillTo 0.86
    // means a 52u stone draws at 45px, so its radius is 22, not 26. Same arithmetic as
    // lake-boulder-large's note.
    //
    // ⚠️ AND THE COLLIDER IS THE THING TO RATION, NOT THE KIND. Every contact prop compiles
    // to a hidden circle that also enters the router's grid, and script.js records THIS
    // venue's 82 hidden banks causing multi-hundred-millisecond replan spikes. Budget ~40
    // hard boulders across the whole course, in the rapids, at bar heads and on the inside
    // of tight bends — and place the rest with `contact: none` from the prop inspector.
    // river-boulder-small especially: at 17px on screen it is scenery, and a router collider
    // for something a hull would barely notice is exactly the trade this venue cannot afford.
    // Prop-spin ON for all three — a stone has no front, and spinning them is what stops a
    // scatter reading as stamped copies.
    'river-boulder-large':    { label: 'Granite boulder',   world:  52, plane: 'surface', contact: 'hard', contactR: 22, motion: 'fixed' },
    'river-boulder-medium':   { label: 'Granite boulder, medium', world: 34, plane: 'surface', contact: 'hard', contactR: 15, motion: 'fixed' },
    'river-boulder-small':    { label: 'Granite cobble',    world:  20, plane: 'surface', contact: 'none', contactR:  9, motion: 'fixed' },
    // ── WOOD, AND THE ONE TENT ──────────────────────────────────────────────────────
    // `river-log` is SCENERY, which is where it parts company with the bayou's driftwood:
    // swamp-deadhead and bayou-driftlog are floating obstructions in still black water, and
    // the owner's West Susitna reference shows river logs lying high and dry on the gravel,
    // bleached silver, well above the waterline. So `surface`, contact none, no collider
    // spent — and the logjam is this batch's wood hazard instead.
    //
    // `river-logjam` is `float`: it rides ON the water at a bar head, so it must draw after
    // the water's own marks (no wake rippling across it) and before the land. contactR 28
    // deliberately UNDER-covers: the delivered jam is 1.52:1, drawing 112 x 74u, so 28 covers
    // about three quarters of the beam. venuedoc's rule everywhere else applies — 'a
    // pass-through is a missed collision where an oversized circle is an invisible wall
    // standing off in open water'.
    //
    // ⚠️ THE TENT IS 44u, NOT THE 22u ITS SLOT ORIGINALLY DECLARED, and the reason is the
    // reduction test: at 18px the crossed poles that are its whole identity vanish and it is
    // an anonymous orange smudge. It first reads as a tent at 44u/37px. That puts it between
    // the willow (30) and the alder (56), so NEVER place one inside a thicket — at that size
    // it would be taken for a shrub. Ones and twos, on open gravel bars and terraces near the
    // water. It is the only manufactured colour in the venue and the only sign of a person.
    //
    // Prop-spin ON for all three. None has a front, and the tent's vestibule flap makes its
    // outline asymmetric precisely so a spun pair does not read as two stamps of one shape.
    'river-logjam':           { label: 'Log jam',           world: 130, plane: 'float',   contact: 'hard', contactR: 28, motion: 'fixed' },
    'river-log':              { label: 'Drift log',         world:  76, plane: 'surface', contact: 'none', motion: 'fixed' },
    'river-tent':             { label: 'Camp tent',         world:  44, plane: 'surface', contact: 'none', motion: 'fixed' },
    // ── THE SUNKEN BOULDERS — NO NEW ART, AND THAT IS THE POINT ─────────────────────
    // These are the SAME THREE STONES, pointed at the same PNGs through `src` (the trick
    // buoy-channel-red already uses) and moved to the `seabed` plane. The engine does the
    // submerging: submergedSprite() blurs by 3px in the 4x bake, washes the colours toward
    // the venue's own water at SEABED_WASH 0.52 with source-atop, and PROP_PLANE_ALPHA draws
    // the result at 0.72 — so the muting, softening and translucency the sunken subject asks
    // for all arrive for free, and rebake themselves if the palette ever changes.
    //
    // ⚠️ AND THE PAIR IS THEREFORE LITERALLY THE SAME STONE, which is what the manifest slot
    // wanted and a separate generation could never guarantee: the only difference between
    // 'Granite boulder' and 'Granite boulder, sunken' is the water over it, so a player reads
    // the WATER rather than learning two rocks.
    //
    // `wash` gives them the boil — drawPropWash's pool and its two or three breathing laps —
    // and `washFrom: 'current'` is new: the default biases the lap into the WIND, which is
    // right for a piling in still water and wrong for a rock in a 2.4 kn river, where the
    // foam belongs downstream. See the note in drawPropWash.
    //
    // ⚠️ CONTACT RADII UNDER-COVER BY MORE THAN THE DRY TWINS DO (18/12/7 against 22/15/9),
    // deliberately. venuedoc's rule is that under-covering is the safer error, and it matters
    // most here: this is a hazard the player can only half-see, so the visible boil must be
    // WIDER than the thing that stops the boat. The small one keeps contact none.
    'river-boulder-large-sunken':  { label: 'Granite boulder, sunken',    world: 52, plane: 'seabed', contact: 'hard', contactR: 18, wash: 0.60, washFrom: 'current', motion: 'fixed', src: 'assets/images/props/river/boulder-large.png' },
    'river-boulder-medium-sunken': { label: 'Granite boulder, sunken, medium', world: 34, plane: 'seabed', contact: 'hard', contactR: 12, wash: 0.62, washFrom: 'current', motion: 'fixed', src: 'assets/images/props/river/boulder-medium.png' },
    'river-boulder-small-sunken':  { label: 'Granite cobble, sunken',     world: 20, plane: 'seabed', contact: 'none', contactR:  7, wash: 0.65, washFrom: 'current', motion: 'fixed', src: 'assets/images/props/river/boulder-small.png' },
    'ocean-naupaka':         { label: 'Beach naupaka',     world: 40, plane: 'surface', contact: 'none', motion: 'fixed' },
    'ocean-morning-glory':   { label: 'Beach morning glory', world: 30, plane: 'surface', contact: 'none', motion: 'fixed' },
    'ocean-grass-coastal':   { label: 'Coastal grass',     world: 20, plane: 'surface', contact: 'none', motion: 'fixed' },
    // The coral heads — the lagoon's teeth, and the venue card's promised hazard. All six
    // preset seabed + hard: they draw under every surface layer (the water above is what
    // sells the depth) and they STOP a boat, via the hidden collider compile emits. The
    // collider is ~35% of the sprite frame — you hit the head, not its outermost frond.
    // One placement can still soften any of them (contact soft + drag) or disarm one
    // entirely (contact none) without a new kind.
    'lagoon-coral-brain':    { label: 'Brain coral',    world: 44, plane: 'seabed', contact: 'hard', contactR: 15, motion: 'fixed' },
    'lagoon-coral-staghorn': { label: 'Staghorn coral', world: 52, plane: 'seabed', contact: 'hard', contactR: 18, motion: 'fixed' },
    'lagoon-coral-table':    { label: 'Table coral',    world: 48, plane: 'seabed', contact: 'hard', contactR: 17, motion: 'fixed' },
    'lagoon-coral-bommie':   { label: 'Coral bommie',   world: 56, plane: 'seabed', contact: 'hard', contactR: 20, motion: 'fixed' },
    'lagoon-coral-pillar':   { label: 'Pillar coral',   world: 40, plane: 'seabed', contact: 'hard', contactR: 14, motion: 'fixed' },
    'lagoon-coral-elkhorn':  { label: 'Elkhorn coral',  world: 50, plane: 'seabed', contact: 'hard', contactR: 17, motion: 'fixed' },
    // Gatorgrass Bayou. A scatter of pads as SCENERY, and every trait here is chosen to
    // keep it that way — the mechanic lives in the `lilybed` SHAPE kind, which carries the
    // drag and the zone the router prices. Two objects, one plant, and the split is
    // deliberate: a bed you must sail around is a shape, a few pads drifted off its edge
    // are a picture, and giving the picture teeth would double-charge the same weed.
    //
    //   float    pads float ON the water: after everything the water does, and BEHIND the
    //            land, so a bank covers any part of a cluster that laps onto it. Not
    //            `seabed` — that plane washes the sprite toward the water colour to sell
    //            "under there", which is the one thing a floating leaf is not. And NOT
    //            `surface`, which it shipped as for one day: surface means "over the land
    //            it stands on" and drew pads on dry mud.
    //   none     no contact. The pads tilt and slide aside as a hull goes over and spring
    //            back, which is exactly the behaviour PROP_KINDS spells `contact: none`.
    //   fixed    a lily is anchored to the mud by a rhizome. This is the rooted half of
    //            the rooted/free split the four weed kinds are built on — hyacinth rides
    //            the wind, a lily bed does not — and it is what lets a pad cluster be a
    //            landmark you can navigate by lap after lap.
    'swamp-lilypads': { label: 'Lily pads', world: 56, plane: 'float', contact: 'none', motion: 'fixed' },

    // THE BAYOU'S TREES — three species, and now NINE kinds from THREE pieces of art. Each
    // species is drawn once, as a whole tree; treesplit.py cuts that master into a trunk and a
    // canopy, and all three kinds ship from the one delivery.
    //
    // The pair still exists for the same reason it always did: a prop draws in exactly ONE
    // plane, so a single sprite either covers the boats — making the collider an invisible wall
    // inside a tree top — or draws beneath them, and a hull sails over a canopy. Two props in
    // two planes is the only way this renderer can say "you pass UNDER the crown and INTO the
    // wood". What changed is where the two sprites come from. Drawing them as separate
    // generations gave two different trees, and no prompt makes a canopy match a trunk it never
    // grew on; cutting one accepted tree makes them the same tree by construction, and drops the
    // art bill for a species from three masters to one. split.py already argues this for the
    // orca's body and flukes — same reasoning, applied radially.
    //
    // USE THE WHOLE TREE ON LAND (`swamp-oak` and friends) and the PAIR IN THE WATER. On dry
    // ground nothing passes underneath, so one sprite is the honest object and it keeps a single
    // anchor; in the channel a hull needs to pass under the crown, which needs the two planes.
    //
    //   surface  the trunks. Over the land and the shore, under the fleet — the plane's
    //            own worked example. It is what holds the object up that decides this: the
    //            bottom holds a cypress, so `surface`, even standing in open water. (The
    //            water-held plane is `float`, and it is the lily pads above.)
    //   canopy   the crowns. Over the boats, no contact — the tree is dangerous at the
    //            waterline and harmless overhead, and the hazard/ambient split IS the
    //            trunk/canopy split. A crown reaching out over the channel is then free
    //            scenery: the shade falls on the water, the wood stays on the bank.
    //
    // BOTH HALVES OF A PAIR NOW SHARE ONE `world`, and that is the change to understand here.
    // The two sprites are no longer drawn separately: treesplit.py cuts them out of the ONE
    // accepted whole-tree master, and each part keeps the full master frame. So the pair has a
    // single frame, a single size and a single origin — drop them at one position and they
    // reassemble into exactly the delivered tree (measured: mean alpha error 0.2–0.5 of 255
    // against the master). The old pairs were world 30 against world 110 and registered only
    // because a designer lined them up by hand. The trunk sprite being mostly empty frame is
    // the price of that guarantee and it is worth paying.
    //
    // CONTACT RADII AND WASH WERE BOTH RESCALED, because both are read against `world` and
    // `world` changed. This is the trap in the conversion: propTraits multiplies contactR by a
    // placement's scale but takes it as absolute units, while drawPropWash multiplies `wash` by
    // `world` — so leaving cypress at wash 0.26 when its frame went from 26 to 90 would have
    // drawn a 23u ring of surf around a 9u stem. Every number below is re-measured off the
    // DERIVED sprite: contactR is its r90, wash its r99, the same two readings as before.
    //
    // The radii came out SMALLER than the hand-drawn pair's (oak 12 -> 9) because the derived
    // stem is the tree's own limb hub at 0.20 of the crown radius, not the separately drawn
    // buttressed base the old art showed. That is the honest collider for this picture: the
    // wood you can see is what stops you.
    //
    // ONLY THE TWO THAT STAND IN OPEN WATER GET A WASH: cypress and tupelo grow out of the
    // channel and displace it, the live oak roots on high ground and would be wearing a puddle
    // it has no business in. A prop earns a waterline by standing in water, not by being a tree.
    // `srcBox` — WHICH PART OF THE FRAME THE ART ACTUALLY OCCUPIES, as [x, y, w, h] fractions,
    // so the renderer can skip compositing the empty rest of the quad. Measured off the bake
    // with a 1% margin for the antialiased rim, and it belongs here for the same reason
    // contactR and wash do: it is a fact about the delivered sprite, and the runtime cannot
    // recover it because reading pixels taints the canvas under file://.
    //
    // It matters most for the DERIVED TREE PARTS. A trunk keeps its parent's full frame so the
    // pair stays in register, which means a 440x440 quad is composited to show a 93px stem —
    // 4.5% ink, 95.5% wasted fill. On the planted bayou that was a large share of the 36 Mpx a
    // frame props were filling against a 1.3 Mpx canvas. Anything whose art is a small or thin
    // shape inside a square frame wants one; a canopy at 81% ink does not.
    //
    // RE-MEASURE IT WHEN THE ART CHANGES. A box that is too small clips the sprite, which is a
    // visible bug rather than a slow frame, so the margin is deliberate.
    'swamp-cypress-trunk':  { label: 'Cypress trunk',   world:  90, plane: 'surface', contact: 'hard', contactR:  7, wash: 0.092, srcBox: [0.384, 0.384, 0.231, 0.231], motion: 'fixed' },
    'swamp-cypress-canopy': { label: 'Cypress canopy',  world:  90, plane: 'canopy',  contact: 'none', motion: 'fixed' },
    'swamp-tupelo-trunk':   { label: 'Tupelo trunk',    world:  70, plane: 'surface', contact: 'hard', contactR:  6, wash: 0.091, srcBox: [0.383, 0.383, 0.231, 0.234], motion: 'fixed' },
    'swamp-tupelo-canopy':  { label: 'Tupelo canopy',   world:  70, plane: 'canopy',  contact: 'none', motion: 'fixed' },
    'swamp-oak-trunk':      { label: 'Live oak trunk',  world: 110, plane: 'surface', contact: 'hard', contactR:  9, srcBox: [0.383, 0.383, 0.231, 0.234], motion: 'fixed' },
    'swamp-oak-canopy':     { label: 'Live oak canopy', world: 110, plane: 'canopy',  contact: 'none', motion: 'fixed' },

    // A DEADHEAD: the waterlogged log riding mostly under the surface. It is the counterpart
    // to the three trunks and not another one of them — a trunk is a hazard you read from a
    // hundred units off and route around, this is one you find. That is the whole reason it
    // is worth its own kind, and it is why it is allowed to be small.
    //
    //   float    and this is the one line here that argues with the plane doc above, which
    //            offers "a beached log" as its worked example of `surface`. The EXAMPLE is
    //            about a beached log; the TEST is "what holds the object up", and what holds
    //            this one up is water. So it takes the pad's plane, not the trunk's: it draws
    //            after everything the water does — no wake ripples across a log floating on
    //            top of them — and behind the land, so a bank covers one that laps onto it.
    //            venuecheck's floating-prop check comes along for free and will flag a
    //            deadhead someone has parked inside an island.
    //   fixed    a real deadhead does drift, and `motion: 'drift'` is still the wrong answer:
    //            the traits force a drifting prop's contact to none, so drift would cost this
    //            one the only thing it is for. A placement can still override to drift where
    //            harmless flotsam is what is wanted.
    //   no wash  the two trunks earn a waterline by GROWING OUT of the channel and displacing
    //            it. A deadhead rides with the water instead of standing in it, so there is
    //            nothing for a standing pool to form against — and `wash` draws a radial
    //            pool, which on a 1.5:1 log would ring it with surf it never made.
    //
    // contactR 10 IS FITTED TO THE BEAM, which is where the first OBLONG hazard parts company
    // with the r90 rule the round ones share. The sprite is 18x28u, so r90 (12.5) is really
    // reading the log's LENGTH: a circle that big stands 3u proud of the sides, and an
    // invisible wall wider than the visible log is the failure a player notices. 10 covers the
    // 9u half-beam with a touch to spare and gives up the tapered last third of each end,
    // which is the failure nobody notices. A circle is always a compromise on an oblong
    // object; this picks the side that lies less.
    'swamp-deadhead':       { label: 'Deadhead',        world:  32, plane: 'float',   contact: 'hard', contactR: 10, motion: 'fixed' },

    // THE STILT CAMP — the bayou's landmark: a hut on pilings with two short dock arms and a
    // skiff moored alongside. Sized on that skiff, the one thing in the picture the game
    // already knows a length for — 6.1 m against the player's 6.1 m hull at world 130, which
    // puts the whole structure at 12.2 x 7.8 m.
    //
    // THIS ENTRY WAS contact:'none' UNTIL THE ART WAS REGENERATED, and the reversal is worth
    // keeping because the reasoning was sound and the INPUT changed under it. Contact compiles
    // to one circle centred on the prop's own x/y. The first delivery was a hut trailing a long
    // boardwalk, and measured off that bake the hut's centre sat 63u from the anchor: every
    // available circle was wrong, so solidity had to be authored as hidden `isle` shapes and
    // the prop stayed a picture. The new art is compact and centred — the hut's centre is 8.5u
    // from the anchor — so the circle that was unavailable then is available now.
    //
    // contactR 36 IS THE BEAM RULE APPLIED TO A BUILDING. The structure is 112 x 72u, so 36 is
    // its short half-extent: the largest circle that never stands proud of the visible
    // building, and it comes out 94% filled with solid structure. Bigger keeps paying less —
    // r48 (the r90 the round props use) reaches 12u past the top and bottom edges into open
    // channel for 10 points of fill. Same trade as the two logs, same answer: never lie
    // outward. What it gives up is the far end of each dock arm and the moored skiff, which
    // are thin planking and a boat, not the thing a hull is going to hit.
    //
    // surface, because the piles hold it up and it must draw over the bank it stands on. No
    // `wash`: a building on open piles lets the water through rather than banking it up, and
    // this is the one structure here whose footprint is square-ish rather than a stem.
    //
    // ROLE STAYS `landmark` IN THE MANIFEST even though the thing sits in the racing water,
    // which art-pipeline §2 says landmarks do not. The role is a contract about what the ART
    // must do — a landmark must never be MISTAKEN for an obstacle, and a red-roofed building
    // never is — while whether a boat can pass through it is this table's business, settled
    // above. Worth revisiting if a second venue wants a solid landmark.
    //
    // If a placement ever wants the dock arms solid too, the authored route still exists and is
    // the compile's own idiom: `isle` shapes with `hidden: true` along them. NOT `bank`, which
    // reads like the right kind and is not — it is `hard: false, nav: false`, so a boat would
    // sail through the hut slowly and the router would never see it.
    'swamp-shack':          { label: 'Fishing shack',   world: 189, plane: 'surface', contact: 'hard', contactR: 44, motion: 'fixed' },
    // The second camp. Both radii are r50 of their own sprite, not a share of `world`, because
    // these two are shaped differently — the big shack is a hut beside a long walkway, this is
    // an L of building and deck — so one fraction cannot serve both. Both grew when the art was
    // recalibrated on its boat; see the manifest notes for why the world sizes moved.
    'swamp-shack-b':        { label: 'Crawfish camp',   world: 133, plane: 'surface', contact: 'hard', contactR: 28, motion: 'fixed' },

    // THE DRIFT LOG — a whole fallen trunk, and the far end of the size ladder the deadhead
    // starts: 0.91 m of wood over 7.6 m against the deadhead's 2 m over 3 m. Same plane and
    // the same reason (`float`: water holds a log up, see the deadhead's note), and the same
    // fixed-not-drift trade, which is the only way it keeps its teeth.
    //
    // contactR 5 IS THE BEAM AGAIN and this is where that rule visibly runs out of road. The
    // trunk is 8.3:1 — 70u long, a median 8.4u wide — so a circle on the beam blocks about a
    // seventh of it, and a boat crossing near either end sails straight through painted wood.
    // The alternative is worse in the way that gets noticed: a circle that covers the LENGTH
    // is r 35, an invisible wall seven times the log's width, stopping boats in open channel
    // a full hull clear of anything visible. Between a hazard that under-collides and one that
    // grabs at water you can see is empty, this venue has already chosen twice.
    //
    // SO THE LONG ONE IS THE SHACK'S PROBLEM, and it takes the shack's answer: for a driftlog
    // that must block along its whole length, author `isle` shapes with `hidden: true` down
    // the trunk — the compile's own idiom, and the only thing here that describes a line
    // rather than a point. A placement can also just set its own `contactR` and accept the
    // wide circle; that is a per-course judgement and not a default worth shipping.
    'swamp-driftlog':       { label: 'Drift log',       world:  81, plane: 'float',   contact: 'hard', contactR:  5, srcBox: [0.354, 0.052, 0.292, 0.897], motion: 'fixed' },

    // CATTAILS — five composed tufts of sedge, and the venue's one piece of pure decoration
    // in the water. It is `ambient`, which here is a promise rather than a shrug: the role
    // contract says an ambient must never be MISTAKEN for a hazard, and this one is safe on
    // the strength of its silhouette, not its colour — a spiky radiating burst against three
    // solid trunk discs and two blunt logs. That distinction is the thing that survives
    // greyscale, which is the test the contract actually names.
    //
    //   surface  NOT `float`, and this is the one place the two logs above part company with
    //            it. Water carries a deadhead; a cattail is ROOTED IN THE MUD and stands up
    //            out of it, so the bottom holds it — the trunks' answer, for the trunks'
    //            reason. It also has to draw OVER the bank it grows on, which `float` (behind
    //            the land) would forbid, and cattails on a margin is most of where they go.
    //   none     no contact. The mechanic for weed a hull has to push through is the `weedbed`
    //            SHAPE kind, which carries the drag and the zone the router prices; this is
    //            the picture at the edge of it. Same split as the lily pads, same reason —
    //            giving the picture teeth would charge for the same reeds twice.
    //   no wash  it stands in water and, unlike the trunks, displaces nothing worth drawing:
    //            reeds part around a stem rather than banking up against it, and the pool is
    //            radial where this footprint is five scattered points.
    'swamp-cattails':       { label: 'Cattails',        world:  48, plane: 'surface', contact: 'none', motion: 'fixed' },

    // CYPRESS KNEES — three composed root spikes, and the smallest hazard in the game: 26u
    // for the cluster, about 9u per knee. Its whole design job is to be the one you DON'T see
    // coming in a venue whose other hazards announce themselves from a hundred units off, and
    // that is also why it is allowed to sit under the contrast floor (below).
    //
    //   surface  the same answer as the trunks and for the identical reason — a knee is the
    //            cypress's own root, held up by the mud, not floating on the water. This is
    //            the pair that makes the plane rule legible: the deadhead and the driftlog
    //            are wood the water CARRIES (`float`); the knee is wood the bottom PUSHES UP.
    //   hard     contactR 8 = the group's r90, the round-object rule the corals and trunks
    //            share. It applies cleanly here where it did not for the two logs, because
    //            three knees in a tight triangle really are a roughly circular mass — the
    //            beam-fitting exception exists for oblong sprites and this is not one.
    //   wash     0.35, AND IT IS THE RULE ABOVE THAT REQUIRES IT: "a prop earns a waterline by
    //            standing in water, not by being a tree." A knee is the most literal object in
    //            the venue for that test — a spike whose entire identity is breaking the
    //            surface. Set from r99 (9.1u / 26 = 0.35) exactly as the trunks' were, and it
    //            lands between cypress 0.26 and tupelo 0.39. Unlike the cattails and the shack
    //            the radial pool genuinely fits, because the cluster is compact and round.
    //
    // IT MEASURES 2.9:1 AGAINST THE VENUE'S OWN WATER at composed scale, just under the 3:1 the
    // hazard role asks for, and it ships anyway — recorded here rather than quietly passed
    // over. Two reasons. The floor is written for a hazard the player is expected to READ AND
    // AVOID at distance, and this is deliberately the opposite kind; the drag ladder and the
    // trunks carry the venue's readable danger. And what carries the read at 9px is the dark
    // rim against olive, so the number is a hair off on a sprite that is unmistakable in the
    // contact sheet at every size. Revisit if it ever gets reused on a venue that is not olive.
    'swamp-cypress-knee':   { label: 'Cypress knees',   world:  26, plane: 'surface', contact: 'hard', contactR:  8, wash: 0.35, motion: 'fixed' },

    // DAY BEACONS — the bayou's lateral marks, and the FIXED half of the game's nav vocabulary.
    // buoy-channel-red/green are floating drums with a white band and a lantern; these are
    // boards bolted to a pile that does not move. Two objects doing one job, told apart by
    // silhouette alone, which is the distinction a channel mark most needs to carry.
    //
    //   surface  a pile driven into the bottom. Same answer as the trunks and the knees, and
    //            the same reason: the ground holds it up.
    //   hard     contactR 10 IS THE PILE, NOT THE BOARD. Measured off the bake the pile is
    //            2.25 m across (r90 = 10u) and the dayboard is 3.0 m, overhanging it at both
    //            ends — but the board is up in the air and the pile is what is in the water,
    //            so the collider is the thing a hull can actually reach. Exactly the rule the
    //            trunk/canopy pair is built on, at one twentieth the size.
    //   wash     0.31, from the PILE's r99 for the same reason the radius is. It stands in
    //            open water, so the rule above ("a prop earns a waterline by standing in
    //            water") applies, and the art's own subject asks for a ring ripple.
    //
    // THE PAIR DIFFERS ONLY IN BOARD COLOUR, which is a knowing divergence from real buoyage —
    // IALA-B pairs a GREEN SQUARE with a RED TRIANGLE, and these are two rectangles. Left as
    // is, because the game's own shipped lateral pair already made this choice (see
    // buoy-channel-green's spec: "the IDENTICAL buoy to the red one in every respect except
    // colour"), and one venue is the wrong place to break a convention the rest of the game
    // keeps. Where it does better than the shipped pair is the axis that actually matters for
    // a red-green pair: measured off the art, the two boards separate by 26 luma in greyscale
    // against the floating buoys' 10, so a colour-blind player has a real brightness cue
    // rather than a nominal one. If the triangle ever gets drawn, do BOTH pairs at once.
    'swamp-daybeacon-green':{ label: 'Green daybeacon', world:  34, plane: 'surface', contact: 'hard', contactR: 10, wash: 0.31, motion: 'fixed' },
    'swamp-daybeacon-red':  { label: 'Red daybeacon',   world:  34, plane: 'surface', contact: 'hard', contactR: 10, wash: 0.31, motion: 'fixed' },

    // WHOLE TREES — the ONE ENTRY A DESIGNER SHOULD REACH FOR. Place it anywhere, on the bank
    // or in the channel, and it behaves: the stem draws under the fleet and collides, the crown
    // draws over the fleet and fades for the player's own hull. `parts` is what makes that work
    // — the kind names its two halves and drawProps takes the right one for each pass, so a
    // single placement paints in two planes. The halves are cut from one master by treesplit.py
    // and keep a shared frame, so they register with no help from the designer.
    //
    // THIS ROW SHIPPED WRONG ONCE AND THE FAILURE IS WORTH KEEPING. It was `plane: 'surface',
    // contact: 'none'`, which was right while these were land-only decoration and became a trap
    // the moment the derived halves existed: drop one in the water and you got a crown painted
    // UNDER the boats and a stem you sailed straight through. Nothing announced it, because both
    // settings were individually defensible. The lesson is that the palette is the spec — an
    // entry called "Live oak tree" has to be the whole tree, since that is what the name
    // promises and the name is all a designer sees.
    //
    // contactR is the derived stem's own r90, the same measurement the standalone `-trunk`
    // kinds carry, so the two routes collide identically. wash likewise: cypress and tupelo
    // grow out of the channel and get one, the live oak roots on high ground and does not.
    //
    // THE STANDALONE HALVES STAY placeable for what the pair cannot express — a bare snag with
    // no crown, or a crown reaching in from a tree rooted off the map — but they are the
    // exception now, not the normal way to plant a tree.
    //
    // CHECKED AGAINST THE MANDALA ATTRACTOR before shipping, because a tree drawn from straight
    // above with limbs radiating from a hub sits right next to it. Rotational self-similarity
    // of the LIMB MASS at 4/5/6/8/10-fold is negative for all three (cypress -0.08, oak -0.28,
    // tupelo -0.09) — the limbs never self-align. Do not run that test on the whole sprite: a
    // dense round crown self-correlates just by being a disc, and on that measure the tupelo,
    // visibly the least spoked, scores the WORST of the three.
    // ── WHY THE TREES ARE SOFT AND NOT HARD ─────────────────────────────────
    // A bayou tree has to STOP being sailed through — 1733 of the venue's placements carried an
    // authored contact:"none" overriding these rows, so the compiler emitted 318 colliders where
    // it should have emitted 2042, and a hull passed through every trunk in the swamp.
    //
    // Fixing that as `hard` worked and cost too much. Measured over 6 trials x 9 AI boats:
    // finishers inside the authored 5:00 cutoff fell 41% -> 20%, and the sim step went 1.43ms ->
    // 3.55ms (2.5x) with the frame up 22%. The venue is a FLOODED FOREST — 1948 of its 2042 trees
    // stand in open water, only 94 sit on land where a shape already blocks — so there is no
    // pruning available: every one of them is a real obstacle in sailable water, and turning them
    // all into walls turns the course into a slalom.
    //
    // SOFT WAS TRIED AND REJECTED ON THE SCREEN, which is the evidence that outranks the rest of
    // this note. As a drag shoal it measured beautifully — 81% finishers, penalties down two
    // thirds, and a sim step (1.18ms) LIGHTER than the 318-collider baseline, because a soft
    // contact compiles to a drag-field lookup while a hard one joins the collision set and the
    // router's obstacle graph. It also did not read: a boat that mushes through a cypress and
    // comes out the far side is not a boat that hit a tree, whatever the telemetry says.
    //
    // So HARD it is, and the cost is known and accepted rather than discovered later: the sim
    // step is 2.5x the baseline and the frame is ~22% longer. The cutoff moved 300s -> 360s in
    // the same change, which is what buys the finish rate back.
    //
    // ⚠️ IF THIS IS EVER REVISITED, the lever to reach for is contactR, not contact. These radii
    // are stated at scale 1 and multiplied by each placement's scale, and they sit at about
    // two thirds of the visible trunk: a cypress draws its trunk 0.231 of a 90u frame (r 10.4)
    // against a contactR of 7. Raising it toward the drawn trunk makes contact look right and
    // costs finish rate; lowering it does the reverse. That is the dial — soft/hard is not.
    'swamp-cypress':        { label: 'Cypress tree',   world:  90, plane: 'surface', contact: 'hard', contactR: 7, wash: 0.092, motion: 'fixed',
                              parts: { surface: 'swamp-cypress-trunk', canopy: 'swamp-cypress-canopy' } },
    'swamp-oak':            { label: 'Live oak tree',  world: 110, plane: 'surface', contact: 'hard', contactR: 9, motion: 'fixed',
                              parts: { surface: 'swamp-oak-trunk',     canopy: 'swamp-oak-canopy' } },
    'swamp-tupelo':         { label: 'Tupelo tree',    world:  70, plane: 'surface', contact: 'hard', contactR: 6, wash: 0.091, motion: 'fixed',
                              parts: { surface: 'swamp-tupelo-trunk',  canopy: 'swamp-tupelo-canopy' } },

    // THE DOCK — a plank walkway on pilings, 10.1 m long: the piece a designer repeats along a
    // bank, as against the shack, which is a whole homestead and reads as a copy of itself the
    // second time it is placed. No boat is drawn on it on purpose, so bayou-pirogue can moor
    // alongside one.
    //
    //   surface  pilings driven into the bottom, and it has to draw over the bank it lands on.
    //            The daybeacon's answer, for the daybeacon's reason.
    //   hard     contactR 9 IS THE WALKWAY'S HALF-BEAM, not the platform's. The deck runs a
    //            median 17.5u wide with the shore platform swelling to 25.5u, and a circle
    //            sized to the platform (13) would stand 4u proud of the walkway down its whole
    //            length — an invisible wall half again as wide as the boards you can see. The
    //            venue has chosen this way every time it has come up.
    //   no wash  it stands in water, which by the rule above earns a waterline — but the pool
    //            is radial and this footprint is 5.3:1, so it would draw a circle of surf
    //            around the middle of a long thin object and nothing at either end. Open
    //            pilings also let the stream through rather than banking it up.
    //
    // AND THE CIRCLE IS BADLY OUTMATCHED HERE, worse than on the driftlog: r9 against a 93u
    // deck blocks about a tenth of it, so a boat crossing anywhere but the middle sails through
    // planking. A dock meant to close a lane wants `isle` shapes with `hidden: true` laid along
    // it — the compile's own idiom, and the third asset in this venue to need it (see the shack
    // and the driftlog). That is now a pattern rather than a one-off: ANY prop past roughly 3:1
    // is asking for a shape the single-circle contact model cannot describe, and the honest
    // default is a circle that never lies outward plus a note pointing at the authored route.
    'swamp-dock':           { label: 'Dock',           world: 108, plane: 'surface', contact: 'hard', contactR:  9, srcBox: [0.365, 0.052, 0.270, 0.893], motion: 'fixed' },

    // THE GATOR — the animal the venue is named for, and pure decoration: role ambient, no
    // contact, no drag, nothing to hit. It is here to make the water feel inhabited.
    //
    //   float    water carries a swimming animal, so it takes the logs' plane rather than the
    //            trunks': it draws after everything the water does, and behind the land, which
    //            is right for something cruising a channel and wrong only if someone hauls one
    //            out onto a bank. `seabed` was the other candidate and is too far under — that
    //            plane washes a sprite toward the water colour to sell depth, and the subject
    //            asks for a snout BREAKING the surface.
    //   none     ambient. The venue's danger is wood and weed; adding a biting collider to the
    //            mascot would make every player treat it as a trap and sail wide of scenery.
    //   fixed    'cruising' argues for drift, and drift is still wrong: it rides the current
    //            with windage, which is flotsam's motion, not an animal's — a gator under power
    //            would slide sideways down the stream. Until something animates it the honest
    //            reading is a gator lying up and waiting, which is what a fixed sprite shows.
    //            A placement can still set drift where a drifting log-that-is-not-a-log is the
    //            joke intended.
    //
    // IT IS THE SAME SIZE AND ASPECT AS THE DRIFTLOG — 60u long at 3.5:1 against the log's 70u
    // at 3.2:1 — and THAT RESEMBLANCE IS WANTED (designer, 2026-08-09). Do not "fix" it. An
    // alligator lying awash is doing exactly this in nature, and a player who takes one for a
    // log has been fooled the way the animal fools things for a living.
    //
    // It still has to satisfy §2, and it does, because the rule is not really about resemblance
    // — it is about players learning to distrust the world. Two things carry it. First the
    // silhouettes DO separate on inspection: in greyscale the gator is a smooth tapered body
    // with a head, four leg bumps and a regular scute grid, the log a ragged asymmetric trunk
    // with one stub branch. Crypsis that works at a glance and fails on a look is the honest
    // version of this and is what shipped. Second the error is ASYMMETRIC: mistaking the gator
    // for a log costs a dodge nobody needed, which is cheap and is the joke landing, while the
    // expensive direction — reading a real hazard as harmless scenery — is the one the
    // silhouette split guards. Keep that asymmetry if either sprite is ever redrawn.
    'swamp-gator':          { label: 'Alligator',      world:  70, plane: 'float',   contact: 'none', motion: 'fixed' },

    // THE PIROGUE — a working boat, and the venue's only `traffic` prop. Its binding contract is
    // not about danger at all: a non-racing boat must never be mistaken for a competitor, which
    // extends race-view 10.2 off the starting grid. Colour cannot carry that here — ten of the
    // roster's ninety-six hull colours are golden or tan, so bare wood shares its hue with a
    // tenth of the fleet — and it does not have to, because the silhouettes are not in the same
    // family: 3.9:1 double-ender, pointed at both ends, OPEN and showing its thwarts, against a
    // 1.8:1 teardrop with a blunt stern, a filled deck and a sail over it.
    //
    //   float    a boat floats. The logs' plane and the gator's, for the same reason.
    //   soft     AND THIS IS THE FIRST SOFT CONTACT IN THE VENUE, chosen because it is what the
    //            object actually does: 5.8 m of unballasted wood does not stop a racing hull, it
    //            gets shoved aside and costs you the speed. `hard` would be a lie about mass.
    //            It also degrades far better under the problem every long prop here has hit —
    //            a soft prop compiles to a hidden SHOAL rather than a hidden isle, so a circle
    //            that reaches past the object is a patch of slow water rather than an invisible
    //            wall. That is a real difference in failure mode, not a preference.
    //            drag is left at the trait default (0.5), which sits between the lilybed's 0.35
    //            and the weedmat's 0.75 — about right for shouldering a small boat out of the
    //            way. contactR 5 is the beam again (10.5u hull, half 5.2u).
    //   fixed    these get placed moored, against a dock or a shack; nothing about a tied boat
    //            drifts. A placement can set drift for one that has got loose.
    'swamp-pirogue':        { label: 'Pirogue',        world:  62, plane: 'float',   contact: 'soft', contactR:  5, motion: 'fixed' },

    // THE AIRBOAT — the venue's second traffic vessel, and the SILHOUETTE SPACE IS SPLIT with
    // the pirogue deliberately, the way cove-tugboat splits it with the cargo ships: the pirogue
    // owns narrow, double-ended and open (3.9:1, thwarts showing), this owns broad, blunt and
    // machined (2.2:1) with a hard dark ring at the stern. Nothing else in the venue is a ring
    // on a rectangle, so it reads at a glance against the pirogue, against the racing fleet, and
    // against the round hazards — knees and deadhead are lumps, not rings.
    //
    //   float    a boat floats. The pirogue's plane and the gator's.
    //   hard     AND HERE IT PARTS FROM THE PIROGUE, which is soft, because the difference is
    //            mass and the two should not feel alike. A pirogue is 5.8 m of unballasted wood
    //            and gets shouldered aside; an airboat is a welded aluminium hull carrying an
    //            aero engine and a cage, comparable in weight to the racing boat hitting it, and
    //            it does not move. Same venue, two working boats, two different answers, each
    //            derived from what the thing is rather than from a house default.
    //            contactR 11 is the beam again (22u hull, half 11u) — and at 2.2:1 the beam
    //            circle finally covers a decent share of the object, 46% of its length, instead
    //            of the tenth it managed on the dock. Short props are where this model works.
    //   fixed    placed moored, like the pirogue. Drift is available per placement.
    //
    // NO WIND EFFECT, and it is worth writing down why, because the idea is the obvious one and
    // it is not cheap: a fan boat in the DEAD-AIR venue ought to drag a wake of pressure behind
    // it, the inverse of the cove cargo ship's moving wind shadow. The engine cannot do it
    // today. Wind shadows are derived from SHAPES (isl.windShadow) and they are subtractive
    // only; there is no wind SOURCE anywhere in the model, and props emit nothing. So this ships
    // as scenery, and a blowing airboat is a feature to build on purpose or not at all.
    'swamp-airboat':        { label: 'Airboat',        world:  56, plane: 'float',   contact: 'hard', contactR: 11, motion: 'fixed' },

    // THE HERON — the last asset of the set, and the hardest one to have drawn, for a reason that
    // is geometric rather than artistic: everything that says HERON to a person is vertical. The
    // long neck, the long legs, the dagger beak all foreshorten to nothing from straight above,
    // and what is left is a grey oval. The sprite carries its identity on the one feature that
    // survives the camera — the folded S of the neck lying pale across the slate back.
    //
    //   surface  it is WADING. The bottom holds a standing bird up, so it takes the trunks' plane
    //            and not the logs': this is the third answer to the same question and the venue is
    //            now consistent on it — water carries (deadhead, driftlog, gator, boats), ground
    //            pushes up (trunks, knees, daybeacon, dock, and this). It also has to draw over a
    //            bank it is standing beside, which `float` would put it behind.
    //   none     ambient, and the most obviously so of anything here: a bird leaves.
    //   no wash  it stands in water, which by the rule above can earn a waterline — but the rule
    //            is really about DISPLACEMENT, and two wet sticks displace nothing. The cattails
    //            argument, one step further.
    //
    // AMBIENT/HAZARD SEPARATION is against the small end of the hazard set here, not the big one:
    // at 38u visible it sits between the cypress knees at 26u and the deadhead at 32u, which are
    // the venue's two dark lumps. Checked in greyscale — those two are squat, dark and blunt; the
    // heron is tall, pale, tapered and topped by a bright spike. No overlap.
    'swamp-heron':          { label: 'Heron',          world:  44, plane: 'surface', contact: 'none', motion: 'fixed' },

    // ── GLACIER SOUND'S ICE AND ROCK ────────────────────────────────────────
    // The first six of a twelve-asset commission, and the first thing this venue has ever
    // been able to put ON its land. Arctic ships 8 `ice` shapes, 3 `granite` shapes and 112
    // floes, and until now the only props standing on any of that were the station and its
    // huts — so the ice cap read as a flat white sheet with a coastline. These are its relief.
    // Six more are undrawn (three seracs, three icy peaks); see art/manifest.json, which
    // carries the measured rejection history for every row.
    //
    // EVERY ONE IS surface / none / fixed, AND THE CONTACT ANSWER IS THE INTERESTING ONE.
    // All six stand on a landmass that ALREADY stops a boat, so a collider here would be a
    // second hidden circle inside the first — and compile emits one hidden shape per fixed
    // contact prop, which also enters the router's grid. That is the budget river-boulder-large
    // is written around ("script.js records the river's 82 hidden banks causing multi-hundred-
    // millisecond replan spikes"). Here the KIND is free and so is the placement, because none
    // of it is in the water. If a nunatak is ever wanted as an island the fleet can hit, draw
    // the land shape and put the prop on top of it; do not give the prop a radius.
    //
    // ⚠️ PROP-SPIN SPLITS THIS SET IN TWO AND IT IS NOT A PREFERENCE.
    //   CREVASSES: spin ON. Their interior is lit by SKY, not sun — no direct light reaches the
    //     bottom of a deep narrow slot — so the art has no lit face to rotate out of alignment,
    //     and the only directional cue left is a whisper on the snow lip, below threshold at the
    //     46u these are drawn across. Spinning them is the whole point: a field of eight to
    //     fourteen, a splay fanned across 60 degrees, or one rift alone, all from three sprites.
    //   MOUNTAINS: spin OFF, and set `heading °` per placement. All three bake an upper-left sun
    //     into large lit and shaded flanks — that radial light split THROUGH the summit is the
    //     thing that makes them read as plan-view peaks at all — so spinning one spins its sun.
    //     Two nunataks lit from opposite corners on the same ice sheet is the error nobody can
    //     name and everybody can see. Same call river-footbridge made for having an axis.
    //
    // `srcBox` IS MEASURED OFF EACH SHIPPED BAKE, [x, y, w, h] as fractions with a 1% margin,
    // and carried only where the ink is thin enough to be worth skipping — the lake block's
    // rule. ⚠️ THE CREVASSE IS NOW THE MOST EXTREME CASE IN THE GAME, past the swim line's 5%:
    // its ink is 3.9% of a 2340px frame, a 2340px quad to composite a 271px-wide crack. The two
    // mountains that fill their frames (crag 82%x87%, horn 89%x92%) get none, as a canopy does
    // not. RE-MEASURE ON ANY RE-INGEST — a box too small clips the sprite, which is visible.
    //
    // ⚠️ THE RIFT AND THE BRIDGED CREVASSE ARE PLACEHOLDER ART and carry `rework` P1 blocks in
    // the manifest: both ship the round-2 delivery, which came back at 3.8:1 and 1.7:1 against
    // 8:1 and 14:1 asked, and the bridged one is THREE SEPARATE OBJECTS rather than one crack
    // crossed by two bridges. They are placeable so the venue can be laid out now; expect the
    // art under them to change. `arctic-crevasse` itself is finished art and measured clean.
    //
    // AT 900u THE MASSIF IS THE LARGEST PROP IN THE GAME BY AREA — past the 870u truss bridge
    // and the 820u cruise ship — and the rift is the longest at 1200u. Place the massif and the
    // horn WELL BACK ON THE ICE and away from round-1: the course rounds `granite-isle`, a 629u
    // granite shape, and a bigger rock of the same colour standing behind the one piece of land
    // the player must read is this batch's worst legibility risk.
    'arctic-crevasse':         { label: 'Crevasse',           world:  780, plane: 'surface', contact: 'none', srcBox: [0.442, 0.059, 0.116, 0.882], motion: 'fixed' },
    'arctic-crevasse-wide':    { label: 'Crevasse, rift',     world: 1200, plane: 'surface', contact: 'none', srcBox: [0.373, 0.058, 0.253, 0.883], motion: 'fixed' },
    'arctic-crevasse-bridged': { label: 'Crevasse, bridged',  world:  900, plane: 'surface', contact: 'none', srcBox: [0.390, 0.058, 0.220, 0.883], motion: 'fixed' },
    'arctic-nunatak-crag':     { label: 'Granite crag',       world:  400, plane: 'surface', contact: 'none', motion: 'fixed' },
    'arctic-nunatak-horn':     { label: 'Granite horn',       world:  680, plane: 'surface', contact: 'none', motion: 'fixed' },
    'arctic-nunatak-massif':   { label: 'Granite massif',     world:  900, plane: 'surface', contact: 'none', srcBox: [0.028, 0.233, 0.943, 0.533], motion: 'fixed' },

    // ── AND THE VENUE'S HUMAN PRESENCE ──────────────────────────────────────
    // Glacier Sound's only sign that anyone has ever been here, and now offered BOTH ways: the
    // station as one drag, or the hut on its own so a designer can lay out their own camp.
    //
    // ⚠️ THE HUT IS AN `element` THAT ALSO SHIPS, which is the interesting half. art-pipeline 3b
    // says an element "NEVER ships on its own" — written when the only elements were penguins,
    // where a lone bird is 4-7px. A building is not, so the manifest flags it `ships: true` (the
    // penguin-emperor route) and ingest writes a world-prop bake beside the element. ONE piece of
    // art now serves compose.py AND the placement pass, so a hand-placed hut and a composed one
    // are the same building by construction and can never drift.
    //
    // ⚠️ ITS `world` IS 94 AND THAT IS NOT THE HUT'S SIZE. elementFill is 0.64, so the ink is 64%
    // of the frame along its long axis and the hut itself draws 49u x 62u — measured, not derived.
    // That was chosen to match the art it came from: the three huts composed into `arctic-station`
    // measure 74u, 64u and 56u on their long axis, so a lone hut at 62u sits in the middle of its
    // own family. Reading `world` here as the building's size and "correcting" it to ~60 would
    // shrink the hut to 38u. srcBox skips the 64% of the frame elementFill leaves empty.
    //
    // BOTH ARE surface / none / fixed for the block's reason above — they stand on land that
    // already stops a boat. The station is a LANDMARK by role and never sits in the water; place
    // it back from the shore with the hut and the zodiac around it.
    'arctic-hut':              { label: 'Research hut',       world:   94, plane: 'surface', contact: 'none', srcBox: [0.229, 0.163, 0.541, 0.674], motion: 'fixed' },
    'arctic-station':          { label: 'Research station',   world:  170, plane: 'surface', contact: 'none', motion: 'fixed' },

    // THE STATION TENDER, AND THE ONLY VENUE-NEUTRAL PROP IN THIS FILE. Its manifest slot is
    // deliberately venue-less "like mark/buoy-channel-*: a support RIB is race furniture at every
    // venue — committee boat, safety boat, and Glacier Sound's station tender", and safety orange
    // is canonical everywhere, so no palette clause may tint it. It is listed here because Glacier
    // Sound is what asked for it; it belongs anywhere.
    //
    // ⚠️ IT NEEDS AN EXPLICIT `src` AND EVERY OTHER VENUE-NEUTRAL PROP WILL TOO. propSprite derives
    // the path by splitting the kind at its FIRST hyphen, `<venue>-<name>` -> props/<venue>/<name>.png
    // — and `zodiac` has no hyphen, so the derivation would ask for props/zodia/zodiac.png. `src`
    // short-circuits it, the same field the sunken boulders use to point three kinds at three
    // existing PNGs. This is the mirror of the doubled `bay-bay-` id above: both are the one path
    // rule biting a key that does not fit `<venue>-<name>`.
    //
    // CONTACT none, ON THE HARBOUR FAMILY'S ARGUMENT — role is `traffic`, not `hazard`. If it ever
    // should stop a hull, use contactR 8: measured off the art the hull is 24u x 51u, so 8 fits the
    // beam and covers the middle of the length, and under-covering is the safer error. That is the
    // same number cove-motorboat's note reserves for itself at a near-identical size.
    //
    // wake RIBBON, not kelvin: a RIB planes rather than pushing water aside, which is what that
    // field distinguishes. It is a fact about the hull, true wherever she sails, so it belongs on
    // the kind whether or not any given placement is moving.
    'zodiac':                  { label: 'Zodiac',             world:   54, plane: 'surface', contact: 'none', srcBox: [0.268, 0.019, 0.464, 0.962], motion: 'fixed', src: 'assets/images/props/zodiac.png', wake: { kind: 'ribbon' } }
};

// What a prop IS, after its kind's preset and its own overrides — one place, like
// shapeTraits, so the compiler, the game and the editor's inspector can never disagree.
const PROP_PLANES = ['seabed', 'float', 'surface', 'canopy'];
const PROP_CONTACTS = ['none', 'soft', 'hard'];
function propTraits(p) {
    const k = PROP_KINDS[p.kind] || {};
    const motion = (p.motion === 'drift' || p.motion === 'fixed') ? p.motion : (k.motion || 'fixed');
    return {
        plane:  PROP_PLANES.includes(p.plane) ? p.plane : (k.plane || 'surface'),
        motion,
        contact: motion === 'drift' ? 'none'
               : PROP_CONTACTS.includes(p.contact) ? p.contact : (k.contact || 'none'),
        // Same clamp as a shape's drag, for the same reason: nothing traps a boat dead
        // in water it floats on.
        drag: Math.max(0, Math.min(0.9, p.drag != null ? +p.drag : (k.drag != null ? +k.drag : 0.5))),
        // The collider is smaller than the picture: you hit the trunk, not the crown.
        // The KIND's radius is stated at scale 1, so a placement's `scale` resizes the
        // collider with the picture; an AUTHORED per-placement radius is absolute (and
        // the editor's whole-course scale multiplies it like any other length).
        contactR: Math.max(4, p.contactR != null ? +p.contactR
                             : (k.contactR != null ? +k.contactR : Math.round((k.world || 40) * 0.35))
                               * (p.scale != null ? +p.scale : 1))
    };
}

const SHAPE_KINDS = {
    // Sandy island — bay, lake, lagoon. HARD: generateIslands only ever marked grass and
    // redrock soft, so a tropical isle has always grounded you. Low, but it carries palms,
    // and it is the trees a boat is really sheltering behind.
    isle:    { motion: 'fixed', hard: true,  look: 'tropical', hidden: false, nav: true, height: 0 },   // ~14 m with its palms
    // Grass island — the bayou's hummocks, the strait's islets. Barely stands out of the
    // water, and shadows accordingly: you do not get a lee from a marsh.
    reed:    { motion: 'fixed', hard: false, look: 'grass',    hidden: false, nav: true, height: 0 },   // ~4 m — you get no lee from a marsh
    // The reed's twin in everything but colour: `grass` brightened to meadow green
    // (2026-08-08), and the tan-olive it used to be lives here. The swamp's docs were
    // re-kinded to this, so the bayou looks exactly as it always did.
    swampgrass: { motion: 'fixed', hard: false, look: 'swampgrass', hidden: false, nav: true, height: 0 },
    // ── LIGHTHOUSE COVE'S TWO GROUNDS ───────────────────────────────────────
    // Coastal scrub upland: the cove's ordinary land, and the material most of the venue is
    // made of — lawns, headlands, bluff tops, light scrub. It is what the shore trees stand
    // on, so `look` carries trees: true.
    //
    // HARD, unlike `reed`, and the split is worth stating because both are "grass". A reed
    // isle is a marsh hummock barely clear of the water, which is why it is soft and casts
    // no lee. This is a BLUFF TOP: real land, several metres of it, with houses on it. You
    // ground on a headland. Suggested height ~10 m when a designer wants the lee; the lee is
    // the thing this venue's sea breeze is most sensitive to, so it is worth typing.
    coastalscrub: { motion: 'fixed', hard: true,  look: 'coastalscrub', hidden: false, nav: true, height: 0 },  // ~10 m of bluff
    // Weathered coastal rock: the cove's hard shoreline — points, islets, harbour edges,
    // rocky coves, bridge abutments. HARD, with granite and karst, and for karst's reason
    // rather than granite's: the venue's identity is threading a working harbour, and a
    // shore that only slows you does not price that mistake.
    //
    // NOT `granite`, which it would be easy to reach for. Granite is dark cold blue-grey
    // FRACTURED rock at 55 m of Glacier Sound mountainside; this is rounded, salt-worn,
    // grey-tan glacial stone a few metres proud of the water. Different material, different
    // value, different silhouette language — see the ISLAND_STYLES pair and the manifest
    // note on why the angular prior is this asset's main risk.
    coastalrock:  { motion: 'fixed', hard: true,  look: 'coastalrock',  hidden: false, nav: true, height: 0 },  // ~8 m of rounded outcrop
    // A VILLAGE LANE — crushed shell and packed sand, and the cove's only ground that is not
    // a coastline. It is a SHAPE rather than a prop because a lane is a SURFACE: a prop is a
    // fixed-size sprite, so a village lane would be a dozen placements with a seam at every
    // join, where a polygon takes any length, width or curve for free. drawIslands walks the
    // islands in DOCUMENT ORDER (compileVenueDoc's shapeOrder is the designer's stacking), so
    // a thin lane listed AFTER a scrub island simply paints over it.
    //
    // hard FALSE and nav FALSE. It is inland scenery the fleet can never reach, so a collider
    // would never be tested, and feeding an unreachable polygon to the visibility graph is
    // exactly what cost the river multi-hundred-ms replan spikes — see `bank`. It still DRAWS
    // (hidden stays false); it is only kept out of the router.
    lane:    { motion: 'fixed', hard: false, look: 'lane',     hidden: false, nav: false, height: 0 },
    // ── STILLWATER LAKE'S THREE GROUNDS ─────────────────────────────────────
    // The venue authored all eight of its islands as `isle`, the shared beach sand, which is
    // the right default and says nothing about WHERE it is. These three say Minnesota: a
    // woodland floor under the pines, a coarse glacial beach, and the rounded grey rock that
    // makes a northern lake look northern.
    //
    // Forest floor: dry soil, decomposed leaf, needle litter and moss. The default land
    // material for most of the course — under the forest, between the cabins, around the
    // trails. HARD, like every other real land kind: you ground on a shore.
    // Suggested height ~18 m with its pines when a designer wants the lee; the lake's whole
    // card is "the breeze only whispers", so a lee here is worth typing.
    forestfloor: { motion: 'fixed', hard: true,  look: 'forestfloor', hidden: false, nav: true, height: 0 },  // ~18 m with its pines
    // Lake sand and fine gravel — swimming beaches, canoe launches, camp waterfronts. NOT
    // `isle`, and the distinction is the point: `isle` is a warm tan ocean beach shared by
    // three venues, and a Minnesota lake shore is coarser, greyer and glacial, with rounded
    // pebbles through it. Behaves exactly as `isle` does.
    lakesand:    { motion: 'fixed', hard: true,  look: 'lakesand',    hidden: false, nav: true, height: 0 },
    // Glacial granite / gneiss — rocky points, tiny islands, shoreline shelves, boulders in
    // the forest.
    //
    // ⚠️ NOT `granite`, WHICH IS THE ONE MISTAKE THIS KIND EXISTS TO PREVENT. That is
    // Glacier Sound's rock: dark cold blue-grey, FRACTURED, drawn with the angular tracer
    // and a low-poly facet fan, at 55 m of mountainside. This is the opposite geology — ice
    // did not break it, ice SMOOTHED it, so it is rounded shelves and worn slabs a couple of
    // metres proud of the water, in a cooler medium grey with pink and rust mineral planes.
    // It therefore stays on the ROUNDED tracer with the sandbanks, deliberately, where
    // granite and karst are angular. Anyone adding it to that list has made it scree.
    //
    // HARD, with granite and karst: the card's hazards line already promises islands and
    // shoals, and a rocky point that only slowed you would not price a mistake.
    gneiss:      { motion: 'fixed', hard: true,  look: 'gneiss',      hidden: false, nav: true, height: 0 },   // ~6 m of worn slab

    // ── SOCKEYE RUN'S FOUR GROUNDS ──────────────────────────────────────────
    // A mountain salmon river needs its own ground vocabulary; until now the venue drew its
    // land with the shared `isle` sand, which is what made it read as generic. All four are
    // `hard` and `nav` like every other land shape — they are banks and bars, and a boat goes
    // around them — and all four sit at height 0, which is the convention for ground the
    // camera looks straight down at.
    //
    // ⚠️ `outcrop` IS THE HAZARD OF THE FOUR. It is the rock standing out of the rapids, so it
    // is the one that will be drawn INSIDE the racing water rather than beside it; the other
    // three are bank and terrace. That is a placement fact rather than a trait difference —
    // the shape system has no softer land — but it is why its art is specced as chunky faceted
    // planes that read at a glance, where `cobble` is allowed to be quiet.
    cobble:      { motion: 'fixed', hard: true,  look: 'cobble',      hidden: false, nav: true, height: 0 },   // dry bar, ankle-high
    meadow:      { motion: 'fixed', hard: true,  look: 'meadow',      hidden: false, nav: true, height: 0 },   // river terrace
    outcrop:     { motion: 'fixed', hard: true,  look: 'outcrop',     hidden: false, nav: true, height: 0 },   // ~4 m of scoured shelf
    humus:       { motion: 'fixed', hard: true,  look: 'humus',       hidden: false, nav: true, height: 0 },   // ~30 m with its spruce
    // The wet moss carpet of the deeper rainforest — a SECOND forest floor, not a replacement for
    // `humus`. Humus is the dry needle litter under close spruce; this is the unbroken living moss
    // that covers everything in a Southeast Alaska rain forest, and at dE 52 apart a designer can
    // use both in one wood. It is a ground rather than a scatter of mats because the owner's own
    // reference photographs measure 73-74% moss coverage of the floor: a surface, not scenery.
    mossfloor:   { motion: 'fixed', hard: true,  look: 'mossfloor',   hidden: false, nav: true, height: 0 },   // ~30 m with its spruce
    // The bar version of [[cobble]], and the shape a mountain river actually needs: a riffle
    // is a cobble bar the water is still running over. Identical behaviour to `shoal` and
    // `tropicshoal` — awash, the same 0.8 drag floor, priced by the router rather than walled
    // — differing only in material, which is the whole reason those two are separate kinds.
    // A bar with a dry heart is still two shapes: draw a `cobble` inside this one.
    cobbleshoal: { motion: 'fixed', hard: false, look: 'cobbleshoal', hidden: false, nav: true, height: 0,
               awash: true, drag: 0.8 },
    // Canyon spires and walls. The tallest thing here, and the reason Redrock's card
    // promises wind shadows.
    redrock: { motion: 'fixed', hard: false, look: 'redrock',  hidden: false, nav: true, height: 0 },   // ~70 m of canyon wall
    // Bare rock. The only thing on Glacier Sound that grounds you, and the course rounds it.
    granite: { motion: 'fixed', hard: true,  look: 'granite',  hidden: false, nav: true, height: 0 },   // ~55 m of bare rock
    // Dark karst limestone — Glowtide Strait's rock, and the basic material of its shores.
    //
    // HARD, like granite and unlike every soft kind above it. The strait's whole tension is
    // threading a gap with two knots setting you sideways, and a shore that only slows you
    // does not price that mistake; the card promises rocky shores and this is them.
    //
    // "DARK" IS RELATIVE TO LIMESTONE, NOT TO THE WATER, and the distinction is load-bearing
    // on a night venue. Limestone is normally near-white; this is the weathered, algae-stained
    // rock of a tide line. But Glowtide's water is near-black indigo (#1a2560, luma 39), and a
    // hazard darker than that is a hazard nobody sees until they are on it — so the drawn body
    // sits ABOVE the water in value and earns its "dark" from hue and saturation instead.
    // See ISLAND_STYLES.karst in script.js for the measured numbers.
    karst:   { motion: 'fixed', hard: true,  look: 'karst',    hidden: false, nav: true, height: 0 },   // ~35 m of fissured limestone
    // Submerged rock — the karst that never made it to the surface. A drowned head standing
    // in the fairway: you cannot see a coastline, there is no foam to warn you, and it stops
    // you dead. The strait's nastiest hazard, and the one a local knows and a visitor does not.
    //
    // `reef: true` IS THE SUBMERGED-BUT-SOLID FLAG, despite the coral name. It is the one
    // combination `awash` cannot express: awash means "no collision, no lee, priced as a
    // cost" — a bar you sail over — while reef means "drawn on the bottom, under the water,
    // and still a wall". drawIslands skips it, drawReefs paints it with the seabed layers,
    // and because it is NOT awash it stays in the router's grid and closes the gap it is
    // meant to close. See the compiled island's `awash` note for the four readers involved.
    //
    // `hard: true` upgrades the coral's soft grind to stop-dead, which is the difference
    // between a reef you scrape over and a rock you hit. It is the kind's own value rather
    // than a per-shape override precisely because that is what this object IS.
    //
    // NO SURF, and it comes for free rather than as a flag: every surf pass — the daytime
    // foam in updateSurf, its dry-edge probe, and the night bioluminescent shore — already
    // excludes `reef`, on the reasoning that a submerged shape has no coastline for water to
    // break on. height 0 for the same reason it is 0 on a reef: nothing above the water
    // shelters anything.
    sunkenrock: { motion: 'fixed', hard: true, look: 'sunkenrock', hidden: false, nav: true, height: 0,
               reef: true },
    // Ice that does NOT move: shelf, shore, the sound's coastline. Soft, because RRS 31
    // penalizes touching MARKS, not obstructions — hitting ice costs speed, not a 360.
    ice:     { motion: 'fixed', hard: false, look: 'ice',      hidden: false, nav: true, height: 0 },   // ~20 m of shelf and shore
    // Invisible collider. The river's 82 banks sit behind one continuous drawn shore, and
    // feeding them to the visibility graph once caused multi-hundred-ms replan spikes.
    bank:    { motion: 'fixed', hard: false, look: 'grass',    hidden: true,  nav: false, height: 0 },  // ~5 m of bank
    // Drifting ice. Velocity, spin and wander are drawn from the RACE rng, never authored:
    // the layout is the designer's, the drift is the day's. A floe is a raft — a metre or two
    // of freeboard — so it shelters almost nothing, which is the honest answer. A berg is a
    // different kind, and a taller one, whenever someone wants it.
    floe:    { motion: 'drift', hard: false, look: 'ice',      hidden: false, nav: true, height: 0 },   // ~2 m of freeboard: a raft shelters nothing
    // Sandy shoal. The bar you sail OVER — sand bright through the water, no coastline, no
    // collision. It costs half your speed at its shallowest and feathers to nothing at the
    // rim, which is both what a bar does and what makes it a decision: cutting the corner
    // across one is priced in seconds against sailing round it. It is `nav: true` on
    // purpose — the router must know it is there in order to price it — but it is stamped
    // as a COST rather than a wall (see grid._shoal).
    //
    // A shoal with a dry heart is two shapes, not a new kind: draw an `isle` inside it. That
    // composes, and it keeps "does this thing ground me" a single yes-or-no per shape.
    shoal:   { motion: 'fixed', hard: false, look: 'shoal',    hidden: false, nav: true, height: 0,    // awash: no lee, and none derivable
               // 0.8, raised from 0.5 via 0.65 (see SHOAL_FEATHER's note for the day's
               // whole tuning story): a fifth of your speed over the shallowest sand.
               // The long 120u feather keeps the onset gradual; the deep floor is what
               // makes the crossing a decision. The router prices it identically, the
               // 0.9 clamp still guarantees a way off, and per-shape `drag` tunes any
               // one bar.
               awash: true, drag: 0.8 },
    // Painted shallows. A VISUAL depth statement and nothing else — the bright water
    // inside a lagoon's reef, drawn as a tinted zone under everything on the surface.
    // `drag: 0` is load-bearing: a boat sails it exactly as it sails open water, and
    // zero drag is what keeps this kind out of every physics question `awash` already
    // answers (no collision, no lee, no cost). `nav: false` keeps it out of the A*
    // graph the way a bank stays out — there is nothing here for a router to know.
    // `paint` is what the renderer keys on: a 0-drag SHOAL is deliberately invisible
    // ("no drag, nothing to warn about"), so the honest picture needed a kind that
    // says the tint IS the content. The colour comes from the venue palette's
    // `shallowColor` — one field per venue, not per shape, because "what shallow
    // water looks like here" is a property of the venue's light, exactly like
    // shoalTint's derivation. See drawShallows in script.js.
    shallows: { motion: 'fixed', hard: false, look: 'shoal',    hidden: false, nav: false, height: 0,
               awash: true, drag: 0, paint: true },
    // Seagrass meadow. The second painted zone, and the same physics silence as
    // `shallows` — awash, dragless, unrouted. What differs is entirely how the renderer
    // fills it: not a flat tint but a procedural clump mottle, because from this
    // altitude a meadow is dark patchy MASS against bright sand, and arrangement is
    // code's job, not a generator's (the compose.py argument, applied at runtime).
    // If seagrass should ever cost speed, that decision is `drag` — the drag field,
    // the router pricing and the warning render all already exist for awash shapes.
    // `veg` names its render spec (VEG_STYLES, script.js). It used to be the renderer
    // that knew the string 'seagrass'; now the KIND says what it is growing, which is
    // what let the bayou's four weeds arrive without four more special cases.
    seagrass: { motion: 'fixed', hard: false, look: 'shoal',    hidden: false, nav: false, height: 0,
               awash: true, drag: 0, paint: true, veg: 'seagrass' },
    // Tropic Sand — Caribbean coral-white sand, the lagoon's own beach. Behaves exactly
    // as `isle` does (it grounds you, it carries palms); only the LOOK differs: the
    // 'coralsand' style is markedly whiter and cooler than the tan `tropical` sand every
    // other sandy venue shares. A separate kind rather than a look override because the
    // editor authors kinds — one row in its list is the whole UI.
    tropicsand: { motion: 'fixed', hard: true,  look: 'coralsand', hidden: false, nav: true, height: 0 },  // ~14 m with its palms
    // Tropic Sand's own bar — identical behaviour to `shoal` (awash, same drag floor,
    // priced by the router), differing only in material: the coral-white sand of a
    // `tropicsand` beach continuing under the water. shoalTintFor (script.js) reads the
    // look's body per shape, which is what lets two sands share one drag model.
    tropicshoal: { motion: 'fixed', hard: false, look: 'coralshoal', hidden: false, nav: true, height: 0,
               awash: true, drag: 0.8 },
    // Coral reef. An AREA of living reef too shallow to sail — the third painted bottom
    // (after shallows and seagrass) and the first that is also a WALL. `reef: true` is
    // what the renderer keys on: drawIslands skips it and drawReefs paints it with the
    // bottom layers, even more drowned than a coral head. It collides as a SOFT wall —
    // impassable, but it shoves and costs speed rather than stopping dead — because a
    // boundary you grind along is one you get off. A PROBABILISTIC boundary was
    // considered and rejected: the router cannot price luck, the eval fleet must replay
    // deterministically, and a boat that gambles and loses is stuck INSIDE the wall.
    // Per-shape `hard: true` upgrades any one reef to stop-dead. height 0: a submerged
    // reef shelters nothing, which the kind table's every-kind-is-0 rule gives for free.
    coralreef: { motion: 'fixed', hard: false, look: 'coralshoal', hidden: false, nav: true, height: 0,
               reef: true },
    // ── BLUEWATER BONANZA'S TWO NEW GROUNDS ─────────────────────────────────
    // The ocean grew an archipelago, and `tropicsand` alone cannot build one: a cay made of
    // nothing but beach is a beach, not an island. These are the hard rim and the green
    // middle that turn it into one. Both are TROPICAL MATERIALS rather than ocean-only ones,
    // which is why neither is keyed to the venue — `tropicsand` is shared with the lagoon
    // already, and a reef island is a reef island wherever it is.
    //
    // Coral limestone — uplifted reef rock, the makatea of Niue, Nauru and the Tuamotus:
    // old reef lifted clear of the sea and weathered into pinnacles and solution pits. It
    // is the venue's answer to basalt, and it says REEF ISLAND where basalt would say
    // volcano. Shoreline shelves, rocky island rims, reef outcrops, little points.
    //
    // HARD, with granite and karst, and for karst's reason rather than granite's: this is a
    // rim you thread, and a shore that only slows you does not price that mistake. It is
    // also the honest physical answer — makatea is notoriously sharp, and a hull that
    // touches it is not carrying on.
    //
    // ⚠️ NOT `coralreef`, though the names sit one word apart in this very table. That one
    // is an AREA OF LIVING REEF under the water, drawn on the bottom by drawReefs and
    // sailed into; this is DEAD reef standing in the air, drawn as land, walked on by
    // crabs. Same rock, opposite side of the waterline, and the two must never be
    // reached for interchangeably. The labels a designer sees keep them apart: "Coral
    // Limestone" against "Coral Reef".
    //
    // NOT `karst` either, which it would be easy to reach for — both are limestone and both
    // are fissured. Karst is Glowtide's DARK algae-stained rock at 35 m of cliff on a
    // near-black night venue, drawn dark on purpose so it stays visible against the water.
    // This is sun-bleached pale grey a few metres proud of a turquoise lagoon. Different
    // value, different light, different island.
    coralrock: { motion: 'fixed', hard: true,  look: 'coralrock',  hidden: false, nav: true, height: 0 },  // ~6 m of reef shelf
    // Tropic Scrub — the sun-dried grass and low scrub of a small island's interior, and
    // the venue's plain landmass fill. Small offshore islands, headlands, and the ground
    // behind a beach. It exists so a cay can have a middle that is neither bare sand nor
    // solid forest, which is the gap `tropicsand` + trees leaves.
    //
    // HARD, on `coastalscrub`'s argument rather than `reed`'s: this is real land several
    // metres proud of the water with trees standing on it, not a marsh hummock awash. You
    // ground on it. Suggested height ~8 m when a designer wants the lee — worth typing on
    // this venue in particular, whose whole question is where the pressure is.
    //
    // `look` carries trees: true, and that is load-bearing rather than decorative: this is
    // what ocean-palm-coconut, ocean-pandanus and ocean-almond-tropical stand on, and the
    // style's body was chosen LIGHTER than every one of their crown tones so the trees read
    // dark against the ground. See ISLAND_STYLES.tropicscrub for the measured numbers.
    tropicscrub: { motion: 'fixed', hard: true,  look: 'tropicscrub', hidden: false, nav: true, height: 0 },  // ~8 m of island interior

    // ── GATORGRASS BAYOU: THE GROUND ────────────────────────────────────────
    //
    // Mud is NOT sand at a different colour, and the difference is a shape of edge
    // rather than a hue. A sandbar SHELVES: you feel it come up over a couple of boat
    // lengths, which is exactly what `shoal`'s long 120u feather is describing. A
    // mudbank does not shelve — silt stands at a much steeper angle of repose, so a
    // bayou bank is a defined lip with deep water right up against it. That is why
    // `mudflat` carries its own SHORTER feather instead of borrowing the sand's, and
    // it is the whole reason mud earns kinds rather than a palette swap: the material
    // is a thing you feel through the tiller, not a thing you look at.
    //
    // The art already specced this family before the kinds existed — bayou-mud and
    // bayou-marsh are declared textures, and their notes lay out the ladder the three
    // kinds below reproduce: swampgrass sward -> marsh -> bare mud -> water.
    mud:     { motion: 'fixed', hard: true,  look: 'mud',     hidden: false, nav: true, height: 0 },   // ~2 m of bank
    // The transition, and it is soft where mud is hard: you can drive a hull into a
    // sedge margin and back off it, which is not true of a bank. Half sward, half mud
    // — the wide ragged edges where a bayou island gives out into the channel.
    marsh:   { motion: 'fixed', hard: false, look: 'marsh',   hidden: false, nav: true, height: 0 },   // ~3 m of sedge
    // The mud bar. The drag floor is the highest in the game — 0.9, the clamp itself —
    // because that is the honest reading of the material: sand slows you and mud HOLDS
    // you. It stays inside the clamp on purpose (the 0.9 note applies unchanged: a boat
    // must always keep a knot to crawl off on), so this is the deepest a bar is allowed
    // to bite rather than a new category of trap.
    mudflat: { motion: 'fixed', hard: false, look: 'mudflat', hidden: false, nav: true, height: 0,
               awash: true, drag: 0.9, feather: 60 },

    // ── GATORGRASS BAYOU: THE WEED, IN FOUR LAYERS ──────────────────────────
    //
    // "Weed" is four different plants doing four different jobs, and collapsing them
    // into one kind is how a venue built on weed ends up with one texture. What
    // separates them is WHERE THE PLANT SITS IN THE WATER COLUMN — which is also what
    // decides where it draws, what it does to a hull, and whether it stays put:
    //
    //   weedbed   rooted, grows UP from the bottom   hydrilla, coontail   fouls the keel
    //   lilybed   rooted, leaf floats ON TOP         water lily, spatterdock  pads part, bed stays
    //   weedmat   rooted to NOTHING, floats free     water hyacinth, salvinia  a raft you plough
    //   duckweed  rooted to nothing, a green film    Lemna                free, and pure information
    //
    // THE ROOTED/FREE SPLIT IS THE LOAD-BEARING ONE and it is why lily pads are not the
    // floating weed. A lily is anchored to the mud by a rhizome: the pads tilt and slide
    // aside as a hull goes over and then spring back, but the BED does not move, which
    // makes it a landmark you can navigate by lap after lap. Hyacinth is attached to
    // nothing — it rides wherever the wind and the stream put it. Two plants, two
    // behaviours, and one kind could only ever have told half of that.
    //
    // All four are awash: none of them is a wall, every one of them is a tax, and the
    // ladder of taxes is the venue's whole argument about keeping her moving. They are
    // `paint` because each draws its own picture — see the flag's note, which this batch
    // is what generalised.
    //
    // NOT YET, and both are deliberate rather than forgotten. (1) `weedmat` is FIXED,
    // though a real raft drifts: motion 'drift' compiles down the floe path, which is
    // ice-specific end to end (makeFloe's cracks and facets, isFloe in the bot planner,
    // the penguin colonies) and generalising it is its own change. (2) The drag here is
    // speed-INDEPENDENT like every other awash shape, so hitting a mat with way on costs
    // the same as drifting into it — which is the one place the venue card's promise of
    // momentum-scaled weed is still ahead of the code.
    weedbed:  { motion: 'fixed', hard: false, look: 'shoal', hidden: false, nav: true, height: 0,
               awash: true, drag: 0.6,  paint: true, veg: 'weedbed' },
    lilybed:  { motion: 'fixed', hard: false, look: 'shoal', hidden: false, nav: true, height: 0,
               awash: true, drag: 0.35, paint: true, veg: 'lilybed' },
    weedmat:  { motion: 'fixed', hard: false, look: 'shoal', hidden: false, nav: true, height: 0,
               awash: true, drag: 0.75, paint: true, veg: 'weedmat' },
    // Zero drag, and that is the entire point: a film of Lemna does not slow a boat, it
    // RECORDS her. The hull opens a lane of black water through the green and the lane
    // stays open behind her, so this is the one shape in the game whose job is to show
    // you where the fleet has been. Priced at nothing by the router, correctly.
    duckweed: { motion: 'fixed', hard: false, look: 'shoal', hidden: false, nav: false, height: 0,
               awash: true, drag: 0,    paint: true, veg: 'duckweed' }
};

// How far in from a shoal's rim the water is still deep enough not to matter, in units.
// 120u is 24 m — about two boat lengths, crossed in six seconds at hull speed, so the tax
// arrives as a long build rather than a wall you hit. Clamped to half the shape's own
// radius so a small bar still reaches its full drag somewhere in the middle instead of
// being all rim.
//
// TUNED TWICE ON THE SAME DAY (2026-08-08), and the second pass is the lesson: when
// shoals barely registered, halving the feather to 60 made them bite — but it bought the
// bite by SHARPENING the rim, and the owner's verdict was that the gradient should be
// long and soft. Bite and softness are different levers: the FEATHER is how gradually
// the bottom comes up (back to 120, the two-boat-length build), and the DRAG FLOOR is
// how much the shallowest water takes (0.8 on the kinds below — deep enough that even a
// band whose interior never finishes the long ramp still taxes hard mid-crossing: 100u
// in from the rim the multiplier is already ~0.25).
const SHOAL_FEATHER = 120;

// WHAT THE WATER OVER THIS SHOAL DOES TO YOUR SPEED, as a multiplier: 1 outside it, the
// kind's floor over the shallowest part, smoothstepped between. ONE definition, because
// three consumers ask — the boat's speed model, the router's per-cell time, and the
// editor's readout — and a router that prices a crossing the sailor does not pay is a
// router that sends the fleet the long way round for nothing.
//
// Smoothstep, like every other soft edge in this game. A linear ramp has a corner at each
// end, and a boat holding station on that corner is a boat whose speed oscillates with its
// own leeway; the eased one has zero gradient where it meets deep water.
function shoalMulAt(isl, x, y) {
    if (!isl.awash || !isl.shoalRings) return 1;
    const dx = x - isl.x, dy = y - isl.y;
    if (dx * dx + dy * dy > isl.radius * isl.radius) return 1;   // outside the bounding disc
    // Inside the outer ring and outside every hole — the same evenodd rule the renderer
    // fills with, so what you see slow is what slows you.
    if (!pointInRing(x, y, isl.shoalRings[0])) return 1;
    for (let h = 1; h < isl.shoalRings.length; h++) {
        if (pointInRing(x, y, isl.shoalRings[h])) return 1;
    }
    let d = Infinity;
    for (const ring of isl.shoalRings) {
        for (let i = 0; i < ring.length; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length];
            const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
            let t = l2 ? ((x - a[0]) * ex + (y - a[1]) * ey) / l2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const px = x - (a[0] + t * ex), py = y - (a[1] + t * ey);
            const dd = px * px + py * py;
            if (dd < d) d = dd;
        }
    }
    const f = isl.shoalFeather || SHOAL_FEATHER;
    const t = Math.min(1, Math.sqrt(d) / f);
    return 1 - (1 - isl.shoalMul) * (t * t * (3 - 2 * t));
}

// The whole field at a point: the SHALLOWEST shoal wins rather than the multipliers
// stacking. Two overlapping bars are one bar with a common bottom — multiplying them
// would invent water shallower than either, which is exactly the "deepest shadow wins"
// rule the wind lees already follow, for the same reason.
function shoalFieldAt(islands, x, y) {
    let mul = 1;
    for (const isl of (islands || [])) {
        if (!isl.awash) continue;
        // A painted shallows zone (or any 0-drag shape) contributes nothing — skip the
        // ring walk rather than computing a multiplier of 1.
        if (isl.shoalMul >= 1) continue;
        const m = shoalMulAt(isl, x, y);
        if (m < mul) mul = m;
    }
    return mul;
}

// What a shape IS, after its kind's preset and its own overrides. One place, so nothing has
// to remember that `soft` is the negation of `hard` or that `isBank` means two things.
function shapeTraits(s) {
    const k = SHAPE_KINDS[s.kind] || SHAPE_KINDS.isle;
    return {
        kind: SHAPE_KINDS[s.kind] ? s.kind : 'isle',
        motion: s.motion || k.motion,
        hard:   s.hard   !== undefined ? !!s.hard   : k.hard,
        look:   s.look   || k.look,
        hidden: s.hidden !== undefined ? !!s.hidden : k.hidden,
        nav:    s.nav    !== undefined ? !!s.nav    : k.nav,
        height: s.height !== undefined ? +s.height  : k.height,
        awash:  s.awash  !== undefined ? !!s.awash  : !!k.awash,
        // Not overridable per shape: paint IS the kind. What it means is "this kind
        // draws its OWN picture — do not hand it the default sand bar", which is the
        // one thing the tinted zone, the meadow and the bayou's four weeds share.
        //
        // It used to imply dragless as well, because the only two paint kinds were both
        // visual-only and the distinction had never had to be made. The weeds are paint
        // AND expensive, so the two questions are now genuinely separate: `paint` says
        // who renders it, `drag` says what it costs, and neither reads the other.
        paint:  !!k.paint,
        reef:   !!k.reef,
        // What this shape is GROWING — the name of its render spec (VEG_STYLES in
        // script.js), or null for bare ground. Kind-level like `paint`, and for the same
        // reason: a bed of hydrilla is a different plant from a bed of lilies, not the
        // same plant with a knob turned.
        veg:    k.veg || null,
        // HOW GRADUALLY THE BOTTOM COMES UP, in units. Per KIND, because it is a
        // property of the MATERIAL and not of the venue: sand shelves over a couple of
        // boat lengths, silt stands up steep. Per-shape override for the one bar that
        // wants to differ. See SHOAL_FEATHER for the day this number was tuned twice.
        feather: Math.max(1, s.feather != null ? +s.feather
                            : (k.feather != null ? +k.feather : SHOAL_FEATHER)),
        // Clamped rather than trusted: `drag: 1` is a shape that stops a boat dead in water
        // it is floating over, with no collision to explain why, and every escape from it
        // is upwind of nothing. 0.9 leaves a knot to crawl out on.
        drag:   Math.max(0, Math.min(0.9, s.drag !== undefined ? +s.drag : (k.drag || 0)))
    };
}

// ── Reading a document written before shapes existed ────────────────────────
// `land[]` + `ice[]` become one ordered `shapes[]`, land first — which is exactly the
// order the game drew them in, since drawIslands ran a 'land' pass and then a 'floe' pass.
// Preserving it is what keeps a migrated venue identical rather than merely similar.
function migrateShapes(doc) {
    if (doc.shapes) return doc.shapes;
    const out = [];
    for (const l of (doc.land || [])) {
        // The old fields say the same things in older words: `cls: 'granite'` was the rock,
        // `style` was the look, `soft` was the negation of hard, `nav: false` was the bank.
        const style = l.style || (l.cls === 'granite' ? 'granite' : 'ice');
        const soft = l.soft !== undefined ? !!l.soft : l.cls !== 'granite';
        let kind = l.nav === false ? 'bank'
                 : style === 'granite' ? 'granite'
                 : style === 'redrock' ? 'redrock'
                 : style === 'tropical' ? 'isle'
                 : style === 'grass' ? 'reed'
                 : 'ice';
        const s = { id: l.id, kind, outer: l.outer, holes: l.holes || [], c: l.c, r: l.r };
        if (l.name) s.name = l.name;
        // Only carry an override where the old document disagreed with the kind's preset,
        // so a migrated file reads as a set of kinds rather than a pile of exceptions.
        const t = SHAPE_KINDS[kind];
        if (soft === t.hard) s.hard = !soft;
        if (!!l.hidden !== t.hidden) s.hidden = !!l.hidden;
        out.push(s);
    }
    for (const f of (doc.ice || [])) {
        out.push({ id: f.id, kind: 'floe', outer: f.outer, holes: [] });
    }
    return out;
}

function regionBB(poly) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
    }
    return { minX, minY, maxX, maxY };
}

// `light` skips the estimate's planner run and its nav-grid raster — the one genuinely
// expensive block — for callers that need the course's SHAPE but not its priced stats:
// the clubhouse board while you are still browsing. A light course still carries every
// resolved mark, route entry, region and island; its distance/limit numbers come from
// the straight-line fallback below, and `pathMeasured: false` says so.
function compileVenueDoc(doc, light) {
    const islands = [];
    const byId = {};
    // Where each shape lands, IN DOCUMENT ORDER. `islands` and `ice` stay separate because
    // the runtime builds them differently — a floe's drift comes from the race rng — but
    // the order between them is the designer's, so it is written down rather than implied
    // by which array a thing ended up in. Index 0 is painted FIRST, i.e. furthest back.
    const shapeOrder = [];

    // CONTACT PROPS BECOME HIDDEN CIRCLE SHAPES, appended after the authored list so
    // they compile through the exact same path as everything else — collision, the drag
    // field, the router and the chart all meet them as ordinary shapes and need never
    // know a prop exists. hard -> a hidden hard isle (the bank precedent); soft -> a
    // hidden shoal carrying the prop's drag. Drift props emit nothing, by the traits'
    // own rule.
    const allShapes = migrateShapes(doc).slice();
    for (const p of (doc.props || [])) {
        if (!PROP_KINDS[p.kind]) continue;
        const T = propTraits(p);
        if (T.contact === 'none' || T.motion !== 'fixed') continue;
        const r = T.contactR, ring = [];
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            ring.push([p.x + r * Math.sin(a), p.y - r * Math.cos(a)]);
        }
        allShapes.push(T.contact === 'hard'
            ? { id: p.id + '.hit', kind: 'isle',  outer: ring, holes: [], hidden: true }
            : { id: p.id + '.hit', kind: 'shoal', outer: ring, holes: [], hidden: true, drag: T.drag });
    }

    for (const l of allShapes) {
        const T = shapeTraits(l);
        if (T.motion === 'drift') { shapeOrder.push({ drift: true, i: -1 }); continue; }
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
        // BARE ROCK, not one kind of it. Three things keyed off `granite` by name — the
        // vegetation inset, the `isRock` tag and the lit-facet build — and all three are
        // really asking "is this bare broken rock?". Karst is the second answer to that,
        // so the test became the class rather than gaining a second copy of each branch.
        // ⚠️ `sunkenrock` is deliberately NOT here, though it is bare rock by any plain
        // reading of the name. All three things this flag switches on — the vegetation
        // inset, the isRock tag and the lit-facet build — are for a mass standing in the
        // air. A drowned head grows nothing, and its bake is a flat body in the granite
        // tile with no plane fan, so facets here would be data nothing reads.
        const isBareRock = T.kind === 'granite' || T.kind === 'karst';
        const inset = isBareRock ? VEG_INSET.granite : VEG_INSET.other;
        const isl = {
            id: l.id,
            kind: T.kind,
            x: cx, y: cy, radius, vertices: verts,
            vegVertices: verts.map(v => ({ x: cx + (v.x - cx) * inset, y: cy + (v.y - cy) * inset })),
            trees: [], rocks: [],
            style: T.look,
            // `soft` is the runtime's word for "does not ground you" — the negation of the
            // kind's `hard`. RRS 31 penalizes touching MARKS, not obstructions, so soft
            // scenery costs speed rather than a 360.
            soft: !T.hard,
            fromMask: true,
            isRock: isBareRock,
            hidden: T.hidden,
            // ROUTER ONLY — "keep this shape out of the visibility graph", nothing more.
            // The name predates every unrouted kind that is not a river bank, and reading
            // it as "invisible" is what hid the cove's lanes for a release: unrouted and
            // undrawn are separate facts, and `hidden` above is the one the renderer asks.
            isBank: !T.nav,
            // SUBMERGED. Read by the collision pass (skips it), the renderer (paints it
            // under the water instead of over it), the nav-island filter (it is no
            // obstacle) and the router (it is a cost). `shoalMul` is the speed multiplier
            // at its heart — the drag inverted once, here, so nothing downstream has to
            // remember which way round the number reads.
            awash: T.awash,
            paint: T.paint,
            reef: T.reef,
            // What is growing here, for the renderer. Null on bare ground, which is
            // every shape that existed before the bayou.
            veg: T.veg,
            shoalMul: T.awash ? 1 - T.drag : 1,
            // The kind's own feather now, not the global — mud shelves nothing like
            // sand does. Still clamped to half the radius for the same reason as
            // before: a small bar must reach its full drag somewhere in the middle
            // instead of being all rim.
            shoalFeather: Math.min(T.feather, radius * 0.5),
            // The rings UNKEYHOLED, for the graded depth read. `vertices` is the keyholed
            // trace, and the slit it cuts to reach a hole is a zero-width edge — measuring
            // distance-to-boundary against it would lay a false strip of deep water across
            // the bar. Only awash shapes carry this; nothing else measures depth.
            shoalRings: T.awash
                ? [l.outer].concat(l.holes || []).map(r => r.map(p => [p[0], p[1]]))
                : null,
            // How far this thing's lee reaches, in units — authored per shape, absent means
            // "derive it from my size". 0 is a real answer: a reef awash blocks no breeze.
            // AWASH PINS BOTH TO 0 rather than trusting the authored figure, because the
            // comment above is literally true of a shoal: there is nothing standing in the
            // air to shelter you, and nothing reaching the surface to turn the stream. An
            // inherited height from a kind swap is the way a sandbar quietly acquires a
            // 300 m lee, so the swap answers it here instead.
            height: T.awash ? 0 : T.height,
            windShadow: T.awash ? 0 : (l.windShadow != null ? l.windShadow : null),
            currentShadow: T.awash ? 0 : (l.currentShadow != null ? l.currentShadow : null),
            holes: (l.holes || []).map(h => h.map(p => ({ x: p[0], y: p[1] })))
        };
        if (isBareRock) {
            isl.facets = verts.map((v1, j) => {
                const v2 = verts[(j + 1) % verts.length];
                const mx = (v1.x + v2.x) / 2 - cx, my = (v1.y + v2.y) / 2 - cy;
                const m = Math.hypot(mx, my) || 1;
                return { i: j, lit: (mx / m) * FACET_LIGHT.x + (my / m) * FACET_LIGHT.y };
            });
        }
        shapeOrder.push({ drift: false, i: islands.length });
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
    // The runtime asks flag-shaped questions — `role === 'start'` for OCS, `finish` to
    // end the race — so the compiler stamps both from POSITION, which is the document's
    // single source of truth (migrate deletes the flags from documents). Stamped on the
    // COMPILED route only; the document never sees them.
    if (route.length) {
        route[0].role = 'start';
        if (route.length > 1) route[route.length - 1].finish = true;
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
            //
            // An AUTHORED zone may only ever be WIDER than that floor. The zone is
            // where a rounding ARMS — below three hull lengths, an ordinary rounding
            // sails past outside it and the leg silently never completes (Lighthouse
            // Cove shipped a stray 128 on its first mark, exactly this trap).
            zone: Math.max(e.zone != null ? e.zone : 0, 165, radius * 2.1),
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
    // Every region kind carries one, and it is the same four numbers each time: the axis-
    // aligned box the polygon lives in, so "is this point anywhere near that region" is
    // four comparisons instead of a point-in-polygon walk.
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
        return {
            id: r.id || `wind-${i}`,
            poly,
            // Bounding box, precomputed: getWindAt runs per boat AND per particle per
            // frame, and is sampled again by the AI's lookahead, so the common case
            // (nowhere near this region) has to be four comparisons.
            bb: regionBB(poly),
            falloff: r.falloff != null ? r.falloff : 400,
            // ABSOLUTE mean direction — what the wind does here, not an offset from
            // somewhere else. `speed` absent means "whatever the venue is doing", which
            // keeps race-to-race variety on a course that only authors direction.
            direction: r.direction != null ? r.direction : 0,
            dirVar: r.dirVar != null ? r.dirVar : 0,
            speed: r.speed != null ? r.speed : null,
            speedVar: r.speedVar != null ? r.speedVar : 0,
            period: r.period != null ? r.period : 30,
            // Fixed per-region phase so regions do not pulse in unison, and never from
            // RNG — getWindAt must not touch the seeded stream. initCourse adds a
            // per-race offset on top of this, from its own private stream.
            //
            // FROM THE ID, NOT THE INDEX. The index form meant dragging a region up the
            // list in the editor silently re-rolled the phase of every region below it —
            // a wind you had tuned by eye came back different because you reordered a
            // list. The id is the thing the designer actually named, so the phase now
            // travels with the region instead of with its position.
            phase: hashUnit(r.id || `wind-${i}`) * Math.PI * 2
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
        return {
            id: r.id || `current-${i}`,
            poly,
            bb: regionBB(poly),
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

    // ── Rapids regions ──────────────────────────────────────────────────────
    // The fourth use of the polygon, and the only one that says nothing about MOTION. A
    // rapid carries exactly one number: `turbulence`, 0..1, the broken-water fraction —
    // it robs drive, shoves the bow around, and boils white. Deliberately NO direction
    // and NO speed: flow belongs to the Current layer, in whole, so the two layers can
    // never author the same knots twice. A fast tongue is a current region; the broken
    // shoulders either side of it are rapids.
    const rapidsRegions = ((doc.rapids && doc.rapids.regions) || []).map((r, i) => {
        const poly = (r.poly || []).map(p => [p[0], p[1]]);
        return {
            id: r.id || `rapids-${i}`,
            poly,
            bb: regionBB(poly),
            falloff: r.falloff != null ? r.falloff : 200,
            turbulence: r.turbulence != null ? r.turbulence : 0.5
        };
    }).filter(r => r.poly.length >= 3);

    // ── Gust regions ────────────────────────────────────────────────────────
    // The third use of the same polygon, and the only one that does not describe a state
    // of the water. A wind region says what the wind IS at a place; a gust region says
    // what is BORN there, and the thing born then leaves. So the fields are not a
    // direction and a speed — a source has no direction, the wind it is handed decides
    // that — but a share of the births and the character of what comes out.
    //
    // WHY SOURCE AND NOT EXTENT. A puff already drifts downwind at roughly the gradient
    // wind and steers by the LOCAL breeze, so authoring where puffs are born gives where
    // they land for free, and it tracks a bent wind field without being told. Redrock's
    // "gust-bombs off the rim, sweeping across the course" is one polygon on the rim plus
    // the wind region already drawn. Authoring both ends would be two controls that can
    // contradict each other, and the contradiction would be invisible.
    //
    // A standing feature — Stillwater's glass patches — is NOT a lull parked here; it is a
    // fact about the mean wind over that water, which is a low-speed wind region. Keeping
    // those two apart is what stops one thing from being sayable two ways.
    //
    // A region states its own population and character IN REAL UNITS. These were the last
    // three bare multipliers in the editor — "strength 1×, size 1×, life 1×" told a designer
    // nothing about what would appear on the water, and the ×-on-a-hidden-base form hid two
    // things that mattered: that `life 1` meant a puff outlived its own arena by four times
    // over, and that a puff's strength was keyed to the ROUTE-CENTROID wind rather than to
    // the breeze where it was born. A number in knots, metres and seconds can be checked
    // against the course; a multiplier can only be guessed at.
    //
    // Each is the MEAN of what the source emits — the engine keeps its natural spread around
    // it (see PUFF_SPREAD / PUFF_SIZE_SPREAD / PUFF_LIFE_SPREAD in script.js).
    const gustRegions = ((doc.gusts && doc.gusts.regions) || []).map((r, i) => {
        const poly = (r.poly || []).map(p => [p[0], p[1]]);
        return {
            id: r.id || `gust-${i}`,
            poly,
            bb: regionBB(poly),
            // Doubles as the SPAWN PROBABILITY, which is why it needs no separate field:
            // the same smoothstep that fades a wind region's authority at its edge makes
            // puffs cluster toward the middle of a source and thin out at its rim.
            falloff: r.falloff != null ? r.falloff : 400,
            // HOW MANY CELLS THIS SOURCE KEEPS ALIVE — an absolute count, not a share.
            // It was a weight against the other sources while the venue's `puffiness` owned
            // the total; that variable is gone, so there is nothing left to take a share OF.
            // A region states its own population the way a wind region states its own speed.
            count: r.count != null ? Math.max(0, Math.round(r.count)) : 8,
            // KNOTS a puff is worth on the anemometer — the mean; a hole is worth LULL_RATIO
            // of it. Absolute, not a fraction of the venue's wind: the old form read
            // `state.wind.speed`, the blend at the route centroid, so a bomb born in a 29-knot
            // katabatic tongue was sized by the 20-knot average two kilometres away.
            gustKt: r.gustKt != null ? r.gustKt : 5,
            // METRES across the puff's long axis, mean. A cell is an ellipse and the short
            // axis is half this.
            sizeM: r.sizeM != null ? r.sizeM : 300,
            // SECONDS it lives, mean. Check it against how long a puff takes to cross this
            // course — `estimate.puffDriftMps` is here for exactly that comparison.
            lifeS: r.lifeS != null ? r.lifeS : 90,
            // Share of births that are GUSTS rather than holes. Absolute now: there is no
            // venue split to defer to, so 0.5 is an even mix and 0 is a pure lull factory.
            bias: r.bias != null ? r.bias : 0.5,
            // How far the wind turns inside a puff, in RADIANS. Was the venue's
            // `puffShiftiness` mapped onto 8-22 degrees; 15 is the middle of that band and
            // the default a source starts from.
            veer: r.veer != null ? r.veer * Math.PI / 180 : 15 * Math.PI / 180
        };
    }).filter(r => r.poly.length >= 3 && r.count > 0);

    // ── Hand-placed ice ─────────────────────────────────────────────────────
    // Authored as a world-space polygon so it can be reshaped vertex by vertex, and
    // compiled to the local form makeFloe wants (a shape around its own centroid) plus
    // the centre and radius the placement and collision code reads.
    const ice = [];
    {
        // Walk the SAME ordered list again, filling in the drift slots left open above.
        // Two passes rather than one because a floe's compiled form is different in kind —
        // local space around its own centroid, so makeFloe can spin it — and interleaving
        // the two constructions in one loop obscured which array an index referred to.
        let k = -1;
        for (const f of migrateShapes(doc)) {
            const T = shapeTraits(f);
            k++;
            if (T.motion !== 'drift') continue;
            const ring = (f.outer || []).map(p => [p[0], p[1]]);
            if (ring.length < 3) { shapeOrder[k].i = -1; continue; }
            let cx = 0, cy = 0;
            for (const p of ring) { cx += p[0]; cy += p[1]; }
            cx /= ring.length; cy /= ring.length;
            let r = 0;
            for (const p of ring) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy));
            shapeOrder[k].i = ice.length;
            ice.push({
                id: f.id || `ice-${ice.length}`,
                kind: T.kind,
                height: T.height,
                windShadow: f.windShadow != null ? f.windShadow : null,
                currentShadow: f.currentShadow != null ? f.currentShadow : null,
                x: cx, y: cy, r,
                local: ring.map(p => ({ x: p[0] - cx, y: p[1] - cy }))
            });
        }
    }

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
    const repWind = representativeWind(windRegions, route, marks, doc);
    const wb = repWind.direction != null ? repWind.direction : 0;

    // GATE ROLES ARE DERIVED, like start and finish: windward/leeward is a fact
    // about the course standing in its own wind, not an authoring choice, so the
    // compiler stamps it from geometry (migrate deletes the flags from documents).
    // The AI asks `role === 'windward'` to pick the whole beat playbook — gate-END
    // approach with inset vs centre, laylines, leech cover, RRS 16.2, mark-room
    // gate selection — and losing the labels sent beating fleets to the gate
    // CENTRE like a run: seatrials leg 1 measured 191s vs 63s, the whole broken
    // 330s/360-capped anchor. A leg whose net travel has any upwind component
    // targets the windward gate; otherwise leeward (a square reach gets leeward,
    // i.e. the centre approach — the safer default of the two).
    {
        const upxR = Math.sin(wb), upyR = -Math.cos(wb);
        const anchorOf = (e) => {
            if (e.kind === 'round' && e.mark) return { x: e.mark.x, y: e.mark.y };
            if (e.marks && marks[e.marks[0]] && marks[e.marks[1]]) {
                return { x: (marks[e.marks[0]].x + marks[e.marks[1]].x) / 2,
                         y: (marks[e.marks[0]].y + marks[e.marks[1]].y) / 2 };
            }
            return null;
        };
        for (let i = 1; i < route.length; i++) {
            const e = route[i];
            if (e.kind !== 'gate' || e.role) continue;
            const a = anchorOf(route[i - 1]), b2 = anchorOf(e);
            if (!a || !b2) continue;
            const up = (b2.x - a.x) * upxR + (b2.y - a.y) * upyR;
            e.role = up > 0 ? 'windward' : 'leeward';
        }
    }
    const REF_WIND = 14;                    // knots, mid-range: this is a fallback estimate
    let sailed = 0, secs = 0, geom = 0;
    const addPriced = (r) => { geom += r.geom; sailed += r.sailed; secs += r.secs; };
    // ⚠️ venuedoc.js is also loaded in a bare NODE context by test_venuedoc, where planner.js
    // (CoursePath) and the polar (getTargetSpeed) do not exist. The path branch below cannot
    // run there anyway — it needs both — but the straight-line fallback must, so it prices
    // geometry only rather than assuming the shared function is present.
    const upx = Math.sin(wb), upy = -Math.cos(wb);
    const priceSeg = (a, b) => {
        if (typeof CoursePath !== 'undefined') return CoursePath.priceLeg([a, b], wb, REF_WIND);
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        const up = (dx * upx + dy * upy) > d * 0.25;
        return { geom: d, sailed: d * (up ? 1.45 : 1.0), secs: 0, upwind: up ? d : 0 };
    };

    let paths = null;
    if (!light && typeof CoursePath !== 'undefined' && typeof RoutePlanner !== 'undefined') {
        try {
            if (!compileVenueDoc._planner) compileVenueDoc._planner = new RoutePlanner();
            // The same grid the ruler uses. Without it the estimate is measured on a path
            // that runs through Glacier Sound's island — the visibility planner cannot
            // handle a keyholed coastline and silently returns the straight line.
            let grid = null;
            if (window.SailCheck && boundary) {
                // ⚠️ AWASH SHAPES ARE NOT WALLS, and buildGrid cannot know that: it blocks
                // every shape it is handed, because it takes DOCUMENT shapes (outer/holes) and
                // a document does not carry the trait. So the filter has to answer it here.
                //
                // Left in, a bar or a weed bed closes the water it lies on and the ruler routes
                // the long way round something a boat sails straight over. Gatorgrass Bayou is
                // where this stopped being academic: 95 of its 140 shapes are awash, and the
                // race-length check read 4.53 km / 14:03 for a course that measures 2.31 km and
                // 3:54 once the beds are correctly treated as water.
                //
                // `!awash` and not `!reef`: a coral reef is a soft WALL and is deliberately NOT
                // awash, so it stays in the grid and still closes the pass it is meant to close.
                const fixed = migrateShapes(doc).filter(sh => {
                    const t = shapeTraits(sh);
                    return t.motion === 'fixed' && !t.awash;
                });
                // Same sampling rule as the game's grid (see buildCoursePaths):
                // icy venues keep centre-sampled land.
                const hasDrift = migrateShapes(doc).some(sh => shapeTraits(sh).motion !== 'fixed');
                grid = window.SailCheck.buildGrid(fixed, boundary, null,
                    hasDrift ? { noSubsample: true } : null);
            }
            paths = CoursePath.build(marks, route, islands, compileVenueDoc._planner,
                                     'est-' + islands.length + '-' + (doc.venue || ''), grid);
        } catch (e) { paths = null; }
    }

    if (paths) {
        // Priced by the SHARED function, per leg, so the editor's per-leg readout and this
        // total cannot drift apart. Stamped back onto the leg for that readout to use.
        for (const L of paths.legs) {
            const r = CoursePath.priceLeg(L.pts, wb, REF_WIND);
            L.secs = r.secs; L.sailed = r.sailed; L.upwind = r.upwind;
            addPriced(r);
        }
        // THE ROUNDING THE RULER DELIBERATELY OMITS. DMC holds steady while a boat circles an
        // out-and-back mark, because position alone cannot order a closed loop — but the boat
        // still sails it, and a time limit that ignores it cuts the race off early. Counted
        // here, at zone radius, for distance and time only; the ranking ruler is untouched.
        for (const L of paths.legs) {
            // The path records the sweep it used. Near zero means an out-and-back, where the
            // real manoeuvre is a full circuit — so price one, at the same zone radius the
            // rest of the arc would have used.
            if (L.roundSweep == null || L.roundSweep >= 0.2) continue;
            const arc = Math.PI * 2 * L.roundZone;
            geom += arc; sailed += arc;
            // A circle averages to a beam reach; priced by the shared function on a
            // synthetic beam-reach segment so it uses the same polar.
            const bx = Math.sin(wb + Math.PI / 2) * arc, by = -Math.cos(wb + Math.PI / 2) * arc;
            secs += CoursePath.priceLeg([{ x: 0, y: 0 }, { x: bx, y: by }], wb, REF_WIND).secs;
        }
    } else {
        // Fallback for a context with no planner loaded: straight mark to mark, which can
        // run across land. Glacier Sound's sailable path is 2.1x its straight line.
        let prev = legPt(route[0]);
        for (let i = 1; i < route.length; i++) {
            const p = legPt(route[i]);
            if (!prev || !p) { prev = p || prev; continue; }
            addPriced(priceSeg(prev, p));
            prev = p;
        }
    }

    return {
        islands,
        ice,
        // Pictures with positions. Props affect NOTHING but pixels — no collision, no
        // lee, no router entry — so compile normalizes and passes them through, and no
        // physics consumer ever reads them.
        props: (doc.props || []).filter(p => PROP_KINDS[p.kind]).map(p => Object.assign({
            id: p.id, kind: p.kind, x: +p.x, y: +p.y,
            heading: p.heading != null ? +p.heading : 0,
            scale: p.scale != null ? +p.scale : 1
        }, propTraits(p))),   // plane / motion / contact resolved once, here
        // Document order across BOTH, so the runtime can build one list that paints back to
        // front the way the designer stacked it. Without this, order came from which array
        // a shape happened to live in — all land, then all ice — and no floe could ever sit
        // behind a headland.
        shapeOrder,
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
        courseDist: geom,                       // the path itself, before any tacking allowance
        pathMeasured: !!paths,                  // false = straight-line fallback
        estSecs: secs > 0 ? secs : null,          // priced along the PATH, per segment
        estSecsStraight: secs > 0 ? secs : null,  // legacy name, same number
        // TWICE THE BEST TIME, rounded UP to the minute — a limit should never be shorter
        // than the rule it states, and rounding to nearest can shave up to 29 seconds off it.
        // The old form was 0.1875 s per metre of
        // STRAIGHT-LINE distance — a rule of thumb that could not see the land the course
        // goes around, and that had no relationship to how fast the boats actually sail it.
        // `secs` is now the polar's time along the real path, with the beat priced by VMG,
        // so doubling it is a limit expressed in the only currency that matters: a fleet
        // gets twice as long as a perfectly sailed lap.
        cutoffAuto: secs > 0 ? Math.max(60, Math.ceil(secs * 2 / 60) * 60) : null,
        windRegions,
        currentRegions,
        rapidsRegions,
        gustRegions,
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
        windBase: repWind.direction,
        windBaseSpeed: repWind.speed,
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

// ── Compile cache ───────────────────────────────────────────────────────────
// Compiling is EXPENSIVE — it rasterises a nav grid and runs the planner for the stats
// band — and one editor commit asks for the same compile seven times over (the game
// preview, the checks, the stats band, the inspectors). The result is pure in the
// document, so it is computed once and every caller gets its own structuredClone — the
// same isolation as seven real compiles, without six of them.
//
// Documents are mutated IN PLACE (the editor's, and any test's), so neither reference
// identity nor an explicit invalidation call can be trusted to notice every change —
// a version bump missed one direct `compile()` after a mutation and served a course
// with a shape missing from it. The key is a CONTENT fingerprint instead: a weighted
// walk of every number and string in the document, a few milliseconds where a compile
// is hundreds, and any in-place edit is simply a cache miss. `invalidateCompile()`
// stays as a belt-and-braces version bump in the key (resetGame calls it).
// TWO SLOTS, light and full, so the clubhouse's light compiles cannot evict the full
// course the editor and the race are working from (or the reverse). A light result and a
// full result of the same document are different objects, so they must never share a key.
let _cc = { light: { key: null, out: null }, full: { key: null, out: null } };
let _compileVersion = 0;
function invalidateCompile() { _compileVersion++; }
function docFingerprint(v) {
    let h = 0, n = 0;
    const walk = (x) => {
        if (x == null) { h += 0.1234567; return; }
        const t = typeof x;
        if (t === 'number') { n++; h += x * ((n % 97) + 1); }
        else if (t === 'string') {
            n++; let s = 0;
            for (let i = 0; i < x.length; i++) s = (s * 31 + x.charCodeAt(i)) % 1e9;
            h += s * ((n % 89) + 1);
        } else if (t === 'boolean') { n++; h += x ? 7.7 : 3.3; }
        else if (Array.isArray(x)) { h += 1.618; for (const y of x) walk(y); }
        else if (t === 'object') { for (const k of Object.keys(x)) { walk(k); walk(x[k]); } }
    };
    walk(v);
    return `${n}|${h}`;
}
function compileCached(doc, light) {
    const slot = _cc[light ? 'light' : 'full'];
    const key = `${_compileVersion}|${docFingerprint(doc)}`;
    if (slot.out && slot.key === key) return structuredClone(slot.out);
    const out = compileVenueDoc(doc, light);
    slot.key = key;
    slot.out = structuredClone(out);
    return out;
}

const U_PER_M = 5;

window.VenueDoc = {
    // THE GAME'S ONE LENGTH CONVERSION, in the file both the game and the editor already
    // load. It was about to exist in three places at once — the editor's uToM/mToU, the
    // validator's rails, and the gust sizes in script.js — and three copies of "how long is
    // a metre" is exactly the kind of thing that comes to mean two things.
    U_PER_M,
    get: getVenueDoc,
    migrate: migrateVenueDoc,
    validate: validateVenueDoc,
    // `opts.light` skips the estimate's planner/nav-grid block — see compileVenueDoc.
    compile: (doc, opts) => compileCached(doc, !!(opts && opts.light)),
    invalidateCompile: invalidateCompile,
    // One definition of what a kind means, shared by the compiler, the editor's inspector
    // and the converter. A second copy anywhere is how "iceberg" comes to mean two things.
    KINDS: SHAPE_KINDS,
    MARK_KINDS: MARK_KINDS,
    PROP_KINDS: PROP_KINDS,
    propTraits: propTraits,
    // The depth read, on compiled islands. Shared so the boat, the router and the editor
    // price a shoal crossing identically — see shoalMulAt.
    shoalMul: shoalMulAt,
    shoalField: shoalFieldAt,
    regionWeight: regionWeight,
    traits: shapeTraits,
    shapes: migrateShapes,
    resolveRefs: resolveRefs,
    pointInRing: pointInRing,
    keyholeRings: keyholeRings,
    ringSelfIntersects: ringSelfIntersects,
    ringArea: ringArea
};
})();
