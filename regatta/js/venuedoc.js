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
// A KIND is a named preset over those five. That is what makes "iceberg" a different thing
// from "ice" rather than a different colour: the preset says it drifts slowly and stops you.
// Any single axis can still be overridden on one shape without inventing a kind for it.
//
// These six reproduce EXACTLY what the ten venues did as land[] + ice[]. Nothing here is a
// new behaviour; `iceberg` (drift + hard) and `growler` are deliberately absent and are a
// gameplay change to make on purpose, not a side effect of a refactor.
// What a mark LOOKS LIKE. One list, shared by the validator, the editor's dropdown and
// script.js's sprite registry — a second copy is how a kind comes to mean two things.
// `vessel` is the one that is not course furniture: it carries a heading and a hull, so
// it is oriented and collided differently (see orientCourseMarks in script.js).
const MARK_KINDS = {
    inflatable: { label: 'Orange inflatable buoy' },
    can:        { label: 'Yellow can buoy' },
    committee:  { label: 'Committee boat', vessel: true },
    none:       { label: 'No buoy (position only)' }
};

const SHAPE_KINDS = {
    // Sandy island — bay, lake, lagoon. HARD: generateIslands only ever marked grass and
    // redrock soft, so a tropical isle has always grounded you. Low, but it carries palms,
    // and it is the trees a boat is really sheltering behind.
    isle:    { motion: 'fixed', hard: true,  look: 'tropical', hidden: false, nav: true, height: 0 },   // ~14 m with its palms
    // Grass island — the bayou's hummocks, the strait's islets. Barely stands out of the
    // water, and shadows accordingly: you do not get a lee from a marsh.
    reed:    { motion: 'fixed', hard: false, look: 'grass',    hidden: false, nav: true, height: 0 },   // ~4 m — you get no lee from a marsh
    // Canyon spires and walls. The tallest thing here, and the reason Redrock's card
    // promises wind shadows.
    redrock: { motion: 'fixed', hard: false, look: 'redrock',  hidden: false, nav: true, height: 0 },   // ~70 m of canyon wall
    // Bare rock. The only thing on Glacier Sound that grounds you, and the course rounds it.
    granite: { motion: 'fixed', hard: true,  look: 'granite',  hidden: false, nav: true, height: 0 },   // ~55 m of bare rock
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
    floe:    { motion: 'drift', hard: false, look: 'ice',      hidden: false, nav: true, height: 0 }    // ~2 m of freeboard: a raft shelters nothing
};

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
        height: s.height !== undefined ? +s.height  : k.height
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

function compileVenueDoc(doc) {
    const islands = [];
    const byId = {};
    // Where each shape lands, IN DOCUMENT ORDER. `islands` and `ice` stay separate because
    // the runtime builds them differently — a floe's drift comes from the race rng — but
    // the order between them is the designer's, so it is written down rather than implied
    // by which array a thing ended up in. Index 0 is painted FIRST, i.e. furthest back.
    const shapeOrder = [];

    for (const l of migrateShapes(doc)) {
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
        const isGranite = T.kind === 'granite';
        const inset = isGranite ? VEG_INSET.granite : VEG_INSET.other;
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
            isRock: isGranite,
            hidden: T.hidden,
            isBank: !T.nav,
            // How far this thing's lee reaches, in units — authored per shape, absent means
            // "derive it from my size". 0 is a real answer: a reef awash blocks no breeze.
            height: T.height,
            windShadow: l.windShadow != null ? l.windShadow : null,
            currentShadow: l.currentShadow != null ? l.currentShadow : null,
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
    if (typeof CoursePath !== 'undefined' && typeof RoutePlanner !== 'undefined') {
        try {
            if (!compileVenueDoc._planner) compileVenueDoc._planner = new RoutePlanner();
            // The same grid the ruler uses. Without it the estimate is measured on a path
            // that runs through Glacier Sound's island — the visibility planner cannot
            // handle a keyholed coastline and silently returns the straight line.
            let grid = null;
            if (window.SailCheck && boundary) {
                const fixed = migrateShapes(doc).filter(sh => shapeTraits(sh).motion === 'fixed');
                grid = window.SailCheck.buildGrid(fixed, boundary, null);
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
let _ccKey = null, _ccOut = null;
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
function compileCached(doc) {
    const key = `${_compileVersion}|${docFingerprint(doc)}`;
    if (_ccOut && _ccKey === key) return structuredClone(_ccOut);
    const out = compileVenueDoc(doc);
    _ccKey = key;
    _ccOut = structuredClone(out);
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
    compile: compileCached,
    invalidateCompile: invalidateCompile,
    // One definition of what a kind means, shared by the compiler, the editor's inspector
    // and the converter. A second copy anywhere is how "iceberg" comes to mean two things.
    KINDS: SHAPE_KINDS,
    MARK_KINDS: MARK_KINDS,
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
