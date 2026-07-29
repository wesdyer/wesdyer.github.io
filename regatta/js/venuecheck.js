// VENUE CHECKS — the manual probes of the last few weeks, made permanent.
//
// Every check below corresponds to a defect that actually shipped. The point is
// not tidiness: it is that "is this course sailable?" was answered by hand each
// time, differently, and usually after the course had already been played and
// found broken.
//
// Findings are data, not strings, so the editor can DRAW them. A message saying
// "the rounding island is too close to the coast" is much less useful than a line
// on the map showing which gap and how wide.
(function () {

// ── Geometry ────────────────────────────────────────────────────────────────
function pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
}

// Land test that respects holes: inside the shell but inside a hole is WATER.
function pointOnLand(x, y, shape) {
    if (!pointInRing(x, y, shape.outer)) return false;
    for (const h of (shape.holes || [])) if (pointInRing(x, y, h)) return false;
    return true;
}

function pointSegDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = a[0] + t * dx, cy = a[1] + t * dy;
    return Math.hypot(px - cx, py - cy);
}

function segsIntersect(a1, a2, b1, b2) {
    const d = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = d(b1, b2, a1), d2 = d(b1, b2, a2), d3 = d(a1, a2, b1), d4 = d(a1, a2, b2);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function segSegDist(a1, a2, b1, b2) {
    if (segsIntersect(a1, a2, b1, b2)) return 0;
    return Math.min(
        pointSegDist(a1[0], a1[1], b1, b2), pointSegDist(a2[0], a2[1], b1, b2),
        pointSegDist(b1[0], b1[1], a1, a2), pointSegDist(b2[0], b2[1], a1, a2));
}

const eachEdge = function* (shape) {
    for (const ring of [shape.outer].concat(shape.holes || [])) {
        for (let i = 0; i < ring.length; i++) yield [ring[i], ring[(i + 1) % ring.length]];
    }
};

// Closest approach between two land shapes, with the witness segment so the
// editor can draw the gap it is complaining about.
function shapeGap(a, b) {
    let best = Infinity, wa = null, wb = null;
    for (const ea of eachEdge(a)) {
        for (const eb of eachEdge(b)) {
            const d = segSegDist(ea[0], ea[1], eb[0], eb[1]);
            if (d < best) { best = d; wa = ea; wb = eb; }
        }
    }
    // Witness points: midpoints of the two closest edges are good enough to draw.
    const mid = (e) => [(e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2];
    return { dist: best, from: wa ? mid(wa) : null, to: wb ? mid(wb) : null };
}

function segToShapeDist(p, q, shape) {
    let best = Infinity, at = null;
    for (const e of eachEdge(shape)) {
        const d = segSegDist(p, q, e[0], e[1]);
        if (d < best) { best = d; at = [(e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2]; }
    }
    return { dist: best, at };
}

// ── Checks ──────────────────────────────────────────────────────────────────
// HULL_R is 30 in script.js, so a boat is ~60 units across; call the practical
// clearance a boat needs to pass and manoeuvre 3 hull widths.
const HULL_DIA = 60;
const PASSABLE = HULL_DIA * 3;

function runChecks(ctx) {
    const { doc, compiled, boats, floes } = ctx;
    const out = [];
    const add = (level, id, title, detail, extra) =>
        out.push(Object.assign({ level, id, title, detail }, extra || {}));

    const land = doc.land || [];
    const bnd = compiled.boundary;
    const marks = compiled.marks || [];
    const rm = compiled.roundMark;

    // 1. Document / topology validity (delegated — it is the same rule set the
    //    loader enforces, surfaced here so the editor shows one list).
    for (const p of window.VenueDoc.validate(doc)) {
        add(p.level === 'error' ? 'error' : 'warn', 'schema', 'Document', p.msg);
    }

    // 2. Land outside the arena. The boundary is the invisible wall; land beyond it
    //    is decoration a boat can never reach, and water beyond it is worse — it
    //    looks sailable and is not.
    if (bnd && (bnd.poly || bnd.radius)) {
        for (const l of land) {
            const outs = l.outer.filter(p => !window.Arena.contains(bnd, p[0], p[1]));
            if (outs.length) {
                add(outs.length === l.outer.length ? 'error' : 'warn', 'land-outside',
                    'Land outside the boundary',
                    `"${l.id}": ${outs.length}/${l.outer.length} vertices are beyond the arena edge`,
                    { shapes: [l.id], points: outs.slice(0, 40).map(p => ({ x: p[0], y: p[1] })) });
            }
        }
    }

    // 3. ROUNDING CLEARANCE. The measured gap from the rounding island to every
    //    other landmass, against what a boat physically needs.
    //    This is the check that would have caught the granite island sitting 43
    //    units from the coast with a ~56-unit hull: literally unroundable, and it
    //    cost 4377 groundings per boat before anyone measured it.
    if (rm && rm.landId) {
        const rock = land.find(l => l.id === rm.landId);
        if (rock) {
            let worst = null;
            for (const other of land) {
                if (other.id === rock.id) continue;
                const g = shapeGap(rock, other);
                if (!worst || g.dist < worst.g.dist) worst = { other, g };
            }
            if (worst) {
                const d = worst.g.dist;
                const level = d < HULL_DIA ? 'error' : d < PASSABLE ? 'warn' : 'ok';
                add(level, 'round-clearance', 'Rounding clearance',
                    `Narrowest gap between "${rock.id}" and "${worst.other.id}" is ${Math.round(d)}u`
                    + ` (hull ${HULL_DIA}u, wants ${PASSABLE}u to manoeuvre)`,
                    { segs: worst.g.from ? [[{ x: worst.g.from[0], y: worst.g.from[1] },
                                              { x: worst.g.to[0], y: worst.g.to[1] }]] : [] });
            }
            // The rounding zone must actually contain the island, or a boat can
            // satisfy the rounding without going round anything.
            if (rm.zone < rock.r) {
                add('error', 'round-zone', 'Rounding zone too small',
                    `zone ${Math.round(rm.zone)}u is inside the island's own radius ${Math.round(rock.r)}u`);
            }
        }
    }

    // 4. START LINE. Both ends have to be usable: with ten boats on an 1100-unit
    //    line, an end tight against the beach makes that end unsailable and the
    //    whole fleet funnels to the other one.
    if (marks.length >= 2) {
        const p = [marks[0].x, marks[0].y], q = [marks[1].x, marks[1].y];
        const lineLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
        let nearest = { dist: Infinity, id: null, at: null };
        for (const l of land) {
            const d = segToShapeDist(p, q, l);
            if (d.dist < nearest.dist) nearest = { dist: d.dist, id: l.id, at: d.at };
        }
        const level = nearest.dist < HULL_DIA ? 'error' : nearest.dist < PASSABLE ? 'warn' : 'ok';
        add(level, 'start-clearance', 'Start line clearance',
            `Line is ${Math.round(lineLen)}u long; closest land is "${nearest.id}" at ${Math.round(nearest.dist)}u`,
            { segs: nearest.at ? [[{ x: nearest.at[0], y: nearest.at[1] },
                                   { x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2 }]] : [] });

        // Vertex ORDER sets the crossing normal n = (dy, -dx), and the start test
        // wants it pointing up-course. Getting this backwards put the whole fleet
        // on the wrong side of its own start line, and it is invisible until sailed.
        const startEntry = (compiled.route || [])[0];
        if (startEntry && rm) {
            const nx = q[1] - p[1], ny = -(q[0] - p[0]);
            const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
            const toRound = { x: rm.x - mx, y: rm.y - my };
            const dot = (nx * toRound.x + ny * toRound.y) * (startEntry.dir || 1);
            // For this course the fleet starts AWAY from the rounding mark, so the
            // up-course normal should point away from it.
            add(dot < 0 ? 'ok' : 'warn', 'start-normal', 'Start line orientation',
                dot < 0
                    ? 'Crossing normal points away from the rounding mark, as intended'
                    : 'Crossing normal points TOWARD the rounding mark — the fleet may start the wrong way');
        }
    }

    // 5. NAVIGABILITY by flood fill. A course whose rounding mark cannot be
    //    reached from its start line is not a hard course, it is a broken one.
    if (marks.length >= 2 && rm && bnd) {
        const res = 60;                                     // world units per cell
        const ex = window.Arena.extent(bnd);
        const n = Math.ceil(Math.max(ex.maxX - ex.minX, ex.maxY - ex.minY) / res);
        const x0 = ex.minX, y0 = ex.minY;
        const idx = (i, j) => j * n + i;
        const water = new Uint8Array(n * n);
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                const wx = x0 + (i + 0.5) * res, wy = y0 + (j + 0.5) * res;
                if (!window.Arena.contains(bnd, wx, wy)) continue;
                let onLand = false;
                for (const l of land) if (pointOnLand(wx, wy, l)) { onLand = true; break; }
                if (!onLand) water[idx(i, j)] = 1;
            }
        }
        const cellOf = (wx, wy) => [Math.floor((wx - x0) / res), Math.floor((wy - y0) / res)];
        const seed = cellOf((marks[0].x + marks[1].x) / 2, (marks[0].y + marks[1].y) / 2);
        const seen = new Uint8Array(n * n);
        if (water[idx(seed[0], seed[1])]) {
            const stack = [seed];
            seen[idx(seed[0], seed[1])] = 1;
            while (stack.length) {
                const [i, j] = stack.pop();
                for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const a = i + di, b = j + dj;
                    if (a < 0 || b < 0 || a >= n || b >= n) continue;
                    if (!water[idx(a, b)] || seen[idx(a, b)]) continue;
                    seen[idx(a, b)] = 1;
                    stack.push([a, b]);
                }
            }
            // Can we reach the rounding zone?
            let reach = false;
            for (let j = 0; j < n && !reach; j++) {
                for (let i = 0; i < n; i++) {
                    if (!seen[idx(i, j)]) continue;
                    const wx = x0 + (i + 0.5) * res, wy = y0 + (j + 0.5) * res;
                    if (Math.hypot(wx - rm.x, wy - rm.y) <= rm.zone) { reach = true; break; }
                }
            }
            add(reach ? 'ok' : 'error', 'navigable', 'Navigability',
                reach ? 'Rounding zone is reachable from the start line by water'
                      : 'Rounding zone is NOT reachable from the start line — the course cannot be completed');

            // Water the fleet can see but never reach reads as a bug every time.
            let totalWater = 0, reachable = 0;
            for (let k = 0; k < water.length; k++) { if (water[k]) { totalWater++; if (seen[k]) reachable++; } }
            const orphan = totalWater - reachable;
            const pct = totalWater ? 100 * orphan / totalWater : 0;
            // Reported even when it passes. A check that is silent on success is
            // indistinguishable from a check that was never written, and the whole
            // reason this panel exists is that nobody could tell which probes had
            // actually been run.
            add(pct > 2 ? 'warn' : 'ok', 'orphan-water', 'Unreachable water',
                `${pct.toFixed(1)}% of the water inside the boundary is cut off from the start`
                + ` (${orphan} of ${totalWater} cells)`);

            // How much of the painted map the arena throws away. The Arctic
            // boundary is the circle INSCRIBED in a square map, so its corners are
            // outside — which is why ice clusters on an arc and land runs past the
            // limit on one side.
            // Both directions matter and neither is a simple ratio once the circle
            // can exceed the square, so sample rather than do arithmetic that only
            // holds for the inscribed case (an earlier version reported "-57% out of
            // bounds", which is not a quantity).
            const size = (doc.world && doc.world.size) || Math.max(ex.maxX - ex.minX, ex.maxY - ex.minY);
            const half = size / 2;
            let inMap = 0, inArena = 0, inBoth = 0;
            const N = 160;
            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    // Sample over the union's bounding box so both fractions are valid.
                    const ae = window.Arena.extent(bnd);
                    const ext = Math.max(half, (ae.maxX - ae.minX) / 2, (ae.maxY - ae.minY) / 2) * 1.02;
                    const wx = (ae.minX + ae.maxX) / 2 - ext + (2 * ext) * (i + 0.5) / N;
                    const wy = (ae.minY + ae.maxY) / 2 - ext + (2 * ext) * (j + 0.5) / N;
                    const m = Math.abs(wx) <= half && Math.abs(wy) <= half;
                    const ar = window.Arena.contains(bnd, wx, wy);
                    if (m) inMap++;
                    if (ar) inArena++;
                    if (m && ar) inBoth++;
                }
            }
            const mapCovered = inMap ? 100 * inBoth / inMap : 0;      // of the painted map, how much is sailable
            const arenaUnpainted = inArena ? 100 * (1 - inBoth / inArena) : 0;  // of the arena, how much is off-map
            add(mapCovered < 95 || arenaUnpainted > 5 ? 'warn' : 'ok', 'arena-coverage', 'Arena vs map',
                `${bnd.poly ? `${bnd.poly.length}-gon arena` : `Arena r=${Math.round(bnd.radius)}`}`
                + ` on a ${Math.round(size)}x${Math.round(size)} map: `
                + `${mapCovered.toFixed(0)}% of the painted map is inside the arena, `
                + `${arenaUnpainted.toFixed(0)}% of the arena is off-map water`);
        } else {
            add('error', 'navigable', 'Navigability', 'The start line midpoint is not in water');
        }
    }

    // 6. FLEET PLACEMENT, read from the boats the game actually positioned rather
    //    than from a reimplementation of repositionBoats. Catches a fleet spawned
    //    on land, straddling its own line, or stacked in one column.
    if (boats && boats.length && marks.length >= 2) {
        const p = [marks[0].x, marks[0].y], q = [marks[1].x, marks[1].y];
        const nx = q[1] - p[1], ny = -(q[0] - p[0]);
        const dir = ((compiled.route || [])[0] || {}).dir || 1;
        const onLand = [], wrongSide = [];
        for (const b of boats) {
            for (const l of land) if (pointOnLand(b.x, b.y, l)) { onLand.push(b); break; }
            const side = ((b.x - p[0]) * nx + (b.y - p[1]) * ny) * dir;
            if (side > 0) wrongSide.push(b);
        }
        if (onLand.length) {
            add('error', 'spawn-land', 'Fleet spawned on land',
                `${onLand.length} of ${boats.length} boats start inside a land shape`,
                { points: onLand.map(b => ({ x: b.x, y: b.y })) });
        }
        if (wrongSide.length) {
            add('error', 'spawn-side', 'Fleet on the wrong side of the line',
                `${wrongSide.length} of ${boats.length} boats start on the course side of the start line`,
                { points: wrongSide.map(b => ({ x: b.x, y: b.y })) });
        }
        // Lane spread: boats should be spread ALONG the line, not stacked. Measure
        // the along-line extent against the line's own length.
        const ux = (q[0] - p[0]) / (Math.hypot(q[0] - p[0], q[1] - p[1]) || 1);
        const uy = (q[1] - p[1]) / (Math.hypot(q[0] - p[0], q[1] - p[1]) || 1);
        const along = boats.map(b => (b.x - p[0]) * ux + (b.y - p[1]) * uy);
        const spread = Math.max.apply(null, along) - Math.min.apply(null, along);
        const lineLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
        // Across-line extent too: a fleet stacked in a single file UP-COURSE has a
        // healthy-looking along-line spread only if you never measure the other
        // axis. Comparing the two is what distinguishes a row from a column.
        const across = boats.map(b => ((b.x - p[0]) * nx + (b.y - p[1]) * ny) / (Math.hypot(nx, ny) || 1));
        const acrossExt = Math.max.apply(null, across) - Math.min.apply(null, across);
        const gaps = along.slice().sort((a, b2) => a - b2).map((v, i, arr) => i ? v - arr[i - 1] : null).filter(v => v !== null);
        const minGap = gaps.length ? Math.min.apply(null, gaps) : 0;
        const stacked = spread < lineLen * 0.35 || acrossExt > spread;
        add(stacked ? 'warn' : minGap < HULL_DIA ? 'warn' : 'ok', 'spawn-spread', 'Fleet spread',
            `${boats.length} boats span ${Math.round(spread)}u along a ${Math.round(lineLen)}u line`
            + ` (across ${Math.round(acrossExt)}u, tightest gap ${Math.round(minGap)}u vs ${HULL_DIA}u hull)`
            + (stacked ? ' — stacked in a column rather than laid out in lanes' : '')
            + (!stacked && minGap < HULL_DIA ? ' — lane neighbours are closer than a hull width' : ''),
            { points: boats.map(b => ({ x: b.x, y: b.y })) });
    }

    // 7. SEEDED OBJECTS. Bounding-radius reasoning on a concave landmass broke floe
    //    placement, collision AND wind shadow on three separate occasions, because
    //    the coast's bounding circle covers more than half the world. Anything
    //    asking "is this in water?" must test the polygons — so this check does.
    if (floes && floes.length) {
        const bad = [], outside = [];
        for (const f of floes) {
            for (const l of land) if (pointOnLand(f.x, f.y, l)) { bad.push(f); break; }
            if (bnd && !window.Arena.contains(bnd, f.x, f.y)) outside.push(f);
        }
        add(bad.length ? 'error' : 'ok', 'floe-land', 'Drifting ice on land',
            bad.length ? `${bad.length} of ${floes.length} floes have their centre inside land`
                       : `all ${floes.length} floe centres are in water`,
            { points: bad.map(f => ({ x: f.x, y: f.y })) });
        if (outside.length) {
            add('warn', 'floe-outside', 'Ice outside the boundary',
                `${outside.length} floes sit beyond the arena edge`,
                { points: outside.map(f => ({ x: f.x, y: f.y })) });
        }
    }

    // 8. RACE LENGTH. The target is a design decision, so this is a warning and not
    //    an error, but a course nobody wants to finish is still a broken course.
    if (rm && marks.length >= 2) {
        const sx = (marks[0].x + marks[1].x) / 2, sy = (marks[0].y + marks[1].y) / 2;
        const leg = Math.hypot(rm.x - sx, rm.y - sy);
        const dist = leg * 2 * 1.45;                        // same beat factor updateRace uses
        const expected = (dist / 5) * 0.1875 * 0.71;        // game's s/m, times measured mean/cutoff
        const inBand = expected >= 180 && expected <= 300;
        add(inBand ? 'ok' : 'warn', 'race-length', 'Race length',
            `Sailed ~${Math.round(dist)}u, expected ~${Math.floor(expected / 60)}:`
            + String(Math.round(expected % 60)).padStart(2, '0')
            + (inBand ? ' (in the 3–5 min band)' : ' — outside the 3–5 min target'));
    }

    return out;
}

window.VenueCheck = {
    run: runChecks,
    pointOnLand: pointOnLand,
    shapeGap: shapeGap,
    segToShapeDist: segToShapeDist
};
})();
