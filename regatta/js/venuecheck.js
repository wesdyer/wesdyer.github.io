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
// The two marks that ARE the start line. The route's first entry names them; falling
// back to the first two marks is what the checks used to do unconditionally, and it is
// only correct for a generated windward-leeward where the line happens to be listed
// first. Kept as the fallback for a document with no route at all.
function startLineMarks(marks, route) {
    const startEntry = (route || [])[0];
    const lm = (startEntry && startEntry.marks) || [0, 1];
    return [marks[lm[0]] || marks[0], marks[lm[1]] || marks[1]];
}

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
// Findings are read by a person, and nobody thinks in world units. 5u = 1 metre, and a
// boat is 55u = 11 m long, so gaps are also quoted in BOAT WIDTHS where that is the
// actual question ("can two boats pass here?").
const M = (u) => (Math.abs(u) >= 5000 ? `${(u / 5000).toFixed(2)} km` : `${Math.round(u / 5)} m`);
const HULLS = (u) => `${(u / HULL_DIA).toFixed(1)} hulls`;
const PASSABLE = HULL_DIA * 3;

function runChecks(ctx) {
    const { doc, compiled, boats, floes } = ctx;
    ctx.scenery = ctx.scenery || (compiled && compiled.scenery) || null;
    const out = [];
    const add = (level, id, title, detail, extra) =>
        out.push(Object.assign({ level, id, title, detail }, extra || {}));

    // The FIXED, SOLID shapes. The checks below are about geography a course is laid on —
    // how far land sits from a mark, whether a boat physically fits between two coastlines,
    // whether scenery reaches past the arena. A drifting floe is somewhere else by the time
    // the gun goes, so it is not that; and an awash shape is not that either, for a
    // different reason — every one of these checks asks whether a hull FITS, and a hull
    // fits over a shoal at any width. Counting a bar as a wall would report a sailable
    // course as unroundable and send a designer moving geometry that was already fine.
    const land = window.VenueDoc.shapes(doc)
        .filter(s => {
            const t = window.VenueDoc.traits(s);
            return t.motion === 'fixed' && !t.awash;
        });
    const bnd = compiled.boundary;
    const marks = compiled.marks || [];
    const rm = compiled.roundMark;

    // 1. Document / topology validity (delegated — it is the same rule set the
    //    loader enforces, surfaced here so the editor shows one list).
    for (const p of window.VenueDoc.validate(doc)) {
        add(p.level === 'error' ? 'error' : 'warn', 'schema', 'Document', p.msg);
    }

    // 2. Land beyond the arena is WANTED, not a defect. This check used to warn about
    //    it, which was backwards: the arena bounds boats, and land continuing past it
    //    is what stops a sailor at the limit from seeing the world end. So report it
    //    as depth, and warn only in the opposite case — an arena edge with nothing
    //    beyond it to look at.
    if (bnd && (bnd.poly || bnd.radius)) {
        const beyond = [];
        let deepest = 0;
        for (const l of land) {
            const outs = l.outer.filter(p => !window.Arena.contains(bnd, p[0], p[1]));
            if (!outs.length) continue;
            beyond.push(l.id);
            for (const p of outs) deepest = Math.max(deepest, -window.Arena.signedDist(bnd, p[0], p[1]));
        }
        add(beyond.length ? 'ok' : 'warn', 'scenery-depth', 'Scenery beyond the arena',
            beyond.length
                ? `${beyond.length} shape(s) continue past the sailing limit, up to ${M(deepest)} `
                  + `beyond it (${beyond.join(', ')})`
                : 'No land extends past the arena — a boat at the limit sees the world end');
    }

    // 3. ROUNDING CLEARANCE. The measured gap from the rounding island to every
    //    other landmass, against what a boat physically needs.
    //    This is the check that would have caught the granite island sitting 43
    //    units from the coast with a ~56-unit hull: literally unroundable, and it
    //    cost 4377 groundings per boat before anyone measured it.
    // Which land is being rounded is now DISCOVERED, not declared: whatever shape the
    // rounding mark stands on, or the nearest one inside its zone. A mark and an island
    // are separate objects that happen to be in the same place, so the check has to look
    // rather than read a field — and this way it also catches a buoy laid next to a shoal.
    const landAtMark = (mk) => {
        if (!mk) return null;
        for (const l of land) {
            if (window.VenueDoc.pointInRing(mk.x, mk.y, l.outer)
                && !(l.holes || []).some(h => window.VenueDoc.pointInRing(mk.x, mk.y, h))) return l;
        }
        let best = null, bestD = Infinity;
        for (const l of land) {
            for (const p of l.outer) {
                const d = Math.hypot(p[0] - mk.x, p[1] - mk.y);
                if (d < bestD) { bestD = d; best = l; }
            }
        }
        return (best && bestD <= Math.max(mk.zone || 0, 200)) ? best : null;
    };
    // ── Does this route start and finish? ───────────────────────────────────
    // A race needs a start to cross and a finish to cross, and the leg engine walks the
    // route in ORDER — so they have to be the first and last entries. This used to be a
    // hard error in the validator that only ever reached the console; it belongs here,
    // where it is visible while you are building the route that broke it.
    // Start and finish are POSITIONS: the race is sailed in route order, so the first
    // entry is the start crossing and the last is the finish crossing — and each has to
    // be a GATE, because a rounding is not a thing a fleet can start or finish across.
    const rt = (doc.course && doc.course.route) || [];
    const isGateEntry = (e) => e && e.lineId != null;
    const problems = [];
    if (rt.length && !isGateEntry(rt[0])) problems.push('the first leg is not a gate, so there is no start line');
    if (rt.length < 2) problems.push('the route needs at least a start and a finish');
    else if (!isGateEntry(rt[rt.length - 1])) problems.push('the last leg is not a gate, so there is no finish line');
    if (!rt.length) {
        add('error', 'route-ends', 'Route', 'The route is empty — there is nothing to sail');
    } else if (problems.length) {
        add('error', 'route-ends', 'Route start and finish',
            `${problems.join(', ')} — the race is sailed in this order, so it has to begin`
            + ' and end with a gate');
    } else {
        add('ok', 'route-ends', 'Route start and finish',
            `Starts at ${rt[0].name || 'the start gate'} and finishes at `
            + `${rt[rt.length - 1].name || 'the finish gate'}, over ${rt.length - 1} leg`
            + `${rt.length === 2 ? '' : 's'}`);
    }

    if (rm) {
        const rock = landAtMark(rm);
        if (!rock) {
            add('ok', 'round-clearance', 'Rounding clearance',
                'The rounding mark is in open water — nothing within its zone to foul');
        }
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
                    `Narrowest gap between "${rock.id}" and "${worst.other.id}" is ${M(d)} (${HULLS(d)})`
                    + ` — a hull is ${M(HULL_DIA)} wide and wants ${M(PASSABLE)} to manoeuvre`,
                    { segs: worst.g.from ? [[{ x: worst.g.from[0], y: worst.g.from[1] },
                                              { x: worst.g.to[0], y: worst.g.to[1] }]] : [] });
            }
            // The rounding zone must actually contain the island, or a boat can
            // satisfy the rounding without going round anything.
            if (rm.zone < rock.r) {
                add('error', 'round-zone', 'Rounding zone too small',
                    `zone ${M(rm.zone)} is inside the radius of the "${rock.id}" it stands on (${M(rock.r)})`
                    + ' — the rounding could be satisfied without going round anything');
            }
            // ...and there must be water to sail through on the FAR side. The arena
            // edge is as solid as a cliff: with only 175u past the island, boats
            // stalled on the rounding leg and ground along the wall for the whole
            // race. The land-to-land gap above says nothing about this.
            if (bnd) {
                let tight = Infinity, at = null;
                for (const p of rock.outer) {
                    const d = window.Arena.signedDist(bnd, p[0], p[1]);
                    if (d < tight) { tight = d; at = p; }
                }
                const lvl = tight < HULL_DIA ? 'error' : tight < PASSABLE ? 'warn' : 'ok';
                add(lvl, 'round-arena', 'Rounding room inside the arena',
                    `Closest the rounding shape comes to the arena edge is ${M(tight)} (${HULLS(tight)})`
                    + ` — wants ${M(PASSABLE)} to sail round`,
                    { points: at ? [{ x: at[0], y: at[1] }] : [] });
            }
        }
    }

    // 4. START LINE. Both ends have to be usable: with ten boats on an 1100-unit
    //    line, an end tight against the beach makes that end unsailable and the
    //    whole fleet funnels to the other one.
    //
    // ⚠️ THE START LINE IS THE ROUTE'S START GATE, NOT THE FIRST TWO MARKS. These checks
    // used `marks[0]`/`marks[1]` directly, which is the same line only by luck: a course
    // GENERATED as a windward-leeward lists the start pin and committee boat first, so
    // every venue that came out of the generator passed and the assumption was never
    // tested. Author a course in the editor and the marks array is in creation order —
    // Glowtide Strait lists its windward can first, so all three start checks were
    // measuring a 1.4 km diagonal from the windward mark to a gate mark, and reporting
    // it as a start line touching land with its midpoint ashore and the whole fleet on
    // the wrong side. Three false errors on a start that is fine.
    //
    // The route already says which marks the line is, and the orientation check below
    // was already reading it correctly — this is that same lookup, hoisted so every
    // check shares one answer.
    if (marks.length >= 2) {
        const [sp, sq] = startLineMarks(marks, compiled.route);
        const p = [sp.x, sp.y], q = [sq.x, sq.y];
        const lineLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
        let nearest = { dist: Infinity, id: null, at: null };
        for (const l of land) {
            const d = segToShapeDist(p, q, l);
            if (d.dist < nearest.dist) nearest = { dist: d.dist, id: l.id, at: d.at };
        }
        const level = nearest.dist < HULL_DIA ? 'error' : nearest.dist < PASSABLE ? 'warn' : 'ok';
        add(level, 'start-clearance', 'Start line clearance',
            `Line is ${M(lineLen)} long; closest land is "${nearest.id}" at ${M(nearest.dist)}`,
            { segs: nearest.at ? [[{ x: nearest.at[0], y: nearest.at[1] },
                                   { x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2 }]] : [] });

        // Vertex ORDER sets the crossing normal n = dir * (dy, -dx) — the same
        // expression startCrossNormal() places and judges the fleet with. The gun
        // sends the fleet across +n, and the first thing it must then reach is the
        // NEXT route waypoint, so that is what the normal is tested against.
        // It used to be tested against "the" rounding island (roundMark) instead —
        // an assumption from the island-tour archetype, where the fleet genuinely
        // starts away from the island it will later round. On any windward-first
        // course with a mark rounding that test warned about a correct line, and
        // on gate-only courses (no roundMark) it silently never ran at all.
        // EXCEPT the island-loop archetype: when waypoint 1 is a rounding of
        // something island-sized (arctic's granite isle, radius 405), the fleet
        // legitimately starts upwind AWAY from it and bears away around — there
        // is no expected orientation to judge, so the test does not run.
        const startEntry = (compiled.route || [])[0];
        const nextEntry = (compiled.route || [])[1];
        const islandLoop = nextEntry && nextEntry.mark && nextEntry.mark.radius >= 100;
        if (startEntry && nextEntry && !islandLoop) {
            const [P, Q] = startLineMarks(marks, compiled.route);
            let target = null;
            if (nextEntry.mark) target = { x: nextEntry.mark.x, y: nextEntry.mark.y };
            else if (nextEntry.marks && marks[nextEntry.marks[0]] && marks[nextEntry.marks[1]]) {
                target = { x: (marks[nextEntry.marks[0]].x + marks[nextEntry.marks[1]].x) / 2,
                           y: (marks[nextEntry.marks[0]].y + marks[nextEntry.marks[1]].y) / 2 };
            }
            if (P && Q && target) {
                const s = (startEntry.dir || 1) < 0 ? -1 : 1;
                const nx = s * (Q.y - P.y), ny = -s * (Q.x - P.x);
                const mx = (P.x + Q.x) / 2, my = (P.y + Q.y) / 2;
                const dot = nx * (target.x - mx) + ny * (target.y - my);
                add(dot > 0 ? 'ok' : 'warn', 'start-normal', 'Start line orientation',
                    dot > 0
                        ? 'Crossing normal points toward the first waypoint, as intended'
                        : 'Crossing normal points AWAY from the first waypoint — the fleet would start by sailing away from its own course');
            }
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
        // Shape bounding boxes once, not per cell: the raster asks every cell about
        // every shape, and on a hundred-shape venue the ring tests were the whole cost.
        const lbb = land.map(l => {
            let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
            for (const p of l.outer) {
                if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1];
                if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1];
            }
            return { l, a, b, c, d };
        });
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                const wx = x0 + (i + 0.5) * res, wy = y0 + (j + 0.5) * res;
                if (!window.Arena.contains(bnd, wx, wy)) continue;
                let onLand = false;
                for (const s of lbb) {
                    if (wx < s.a || wx > s.c || wy < s.b || wy > s.d) continue;
                    if (pointOnLand(wx, wy, s.l)) { onLand = true; break; }
                }
                if (!onLand) water[idx(i, j)] = 1;
            }
        }
        const cellOf = (wx, wy) => [Math.floor((wx - x0) / res), Math.floor((wy - y0) / res)];
        // Seeded on the START LINE's own midpoint — see the note at check 4. Seeded from
        // marks[0]/marks[1] this reported an authored course's midpoint as 'not in water',
        // because the point it tested was nowhere near the line.
        const [np_, nq_] = startLineMarks(marks, compiled.route);
        const seed = cellOf((np_.x + nq_.x) / 2, (np_.y + nq_.y) / 2);
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
            // ⚠️ MEASURED AGAINST THE AUTHORED GEOMETRY, NOT `world.size`. This used to
            // sample a square of `doc.world.size` centred on the origin and call anything
            // outside it "unpainted water the mask never described". That sentence is only
            // true of a MASK venue, and arctic is the only one left — and even it bakes its
            // mask to polygons at import, so what actually gets drawn anywhere is the shape
            // list. On a venue authored in the editor `world.size` is inherited metadata
            // describing a square nothing renders: Glowtide Strait carries 3656 from its
            // freeze while its arena spans 8300 x 10200, so the check called 78% of a
            // perfectly good arena unpainted and asked the designer to fix the one thing
            // that was right — land drawn well past the limit, on purpose, so that a boat
            // at the edge has a horizon.
            //
            // The real question is whether the authored world runs out before the arena
            // does, and the extent of the land shapes answers it. This is deliberately the
            // weaker half of a pair: check 2 above ("Scenery beyond the arena") owns the
            // same concern and states it better, so this one reports and warns only when
            // the geometry genuinely falls well short.
            let lx0 = Infinity, ly0 = Infinity, lx1 = -Infinity, ly1 = -Infinity;
            for (const l of land) for (const pt of l.outer) {
                if (pt[0] < lx0) lx0 = pt[0];
                if (pt[1] < ly0) ly0 = pt[1];
                if (pt[0] > lx1) lx1 = pt[0];
                if (pt[1] > ly1) ly1 = pt[1];
            }
            const ae2 = window.Arena.extent(bnd);
            const havePainted = isFinite(lx0);
            let inArena = 0, inBoth = 0;
            const N = 160;
            if (havePainted) {
                for (let j = 0; j < N; j++) {
                    for (let i = 0; i < N; i++) {
                        const wx = ae2.minX + (ae2.maxX - ae2.minX) * (i + 0.5) / N;
                        const wy = ae2.minY + (ae2.maxY - ae2.minY) * (j + 0.5) / N;
                        if (!window.Arena.contains(bnd, wx, wy)) continue;
                        inArena++;
                        if (wx >= lx0 && wx <= lx1 && wy >= ly0 && wy <= ly1) inBoth++;
                    }
                }
            }
            const arenaUnpainted = inArena ? 100 * (1 - inBoth / inArena) : 0;
            add(arenaUnpainted > 25 ? 'warn' : 'ok', 'arena-coverage', 'Arena vs map',
                havePainted
                    ? `${bnd.poly ? `${bnd.poly.length}-gon arena` : `Arena r=${M(bnd.radius)}`}`
                      + ` against authored geometry spanning ${M(lx1 - lx0)} x ${M(ly1 - ly0)}: `
                      + (arenaUnpainted > 25
                          ? `${arenaUnpainted.toFixed(0)}% of the arena lies beyond any authored shape`
                          : 'the authored world reaches the whole sailing limit')
                    : 'No land shapes authored — nothing to compare the arena against');
        } else {
            add('error', 'navigable', 'Navigability', 'The start line midpoint is not in water');
        }
    }

    // 6. FLEET PLACEMENT, read from the boats the game actually positioned rather
    //    than from a reimplementation of repositionBoats. Catches a fleet spawned
    //    on land, straddling its own line, or stacked in one column.
    if (boats && boats.length && marks.length >= 2) {
        // The real line again — with the wrong one, 'wrong side' is measured against a
        // normal belonging to a line the fleet was never on, and reports all ten boats.
        const [fp, fq] = startLineMarks(marks, compiled.route);
        const p = [fp.x, fp.y], q = [fq.x, fq.y];
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
            `${boats.length} boats span ${M(spread)} along a ${M(lineLen)} line`
            + ` (across ${M(acrossExt)}, tightest gap ${M(minGap)} vs a ${M(HULL_DIA)} hull)`
            + (stacked ? ' — stacked in a column rather than laid out in lanes' : '')
            + (!stacked && minGap < HULL_DIA ? ' — lane neighbours are closer than a hull width' : ''),
            { points: boats.map(b => ({ x: b.x, y: b.y })) });
    }

    // 7. SEEDED OBJECTS. Bounding-radius reasoning on a concave landmass broke floe
    //    placement, collision AND wind shadow on three separate occasions, because
    //    the coast's bounding circle covers more than half the world. Anything
    //    asking "is this in water?" must test the polygons — so this check does.
    if (!floes || !floes.length) {
        add('ok', 'floe-land', 'Ice', 'No ice on this venue — nothing to place badly');
    }
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
        // Ice beyond the arena is WANTED — it is the scenery a sailor at the limit
        // looks at, and ice does not respect an imaginary line. What would be a
        // defect is ice outside the SCENERY extent, where nothing can ever see it.
        const scn = ctx.scenery;
        if (scn) {
            const lost = floes.filter(f => !window.Arena.contains(scn, f.x, f.y));
            add(lost.length ? 'warn' : 'ok', 'floe-scenery', 'Ice placement',
                lost.length
                    ? `${lost.length} floes are outside the scenery extent, where nothing can see them`
                    : `${outside.length} of ${floes.length} floes sit beyond the sailing limit, as scenery`,
                { points: lost.map(f => ({ x: f.x, y: f.y })) });
        }
    }

    // 7b. GUST SOURCES ON THE WATER. A source is where pressure cells are BORN, and a
    //     cell born outside the arena lives and dies where nobody sails — the field
    //     looks authored, the venue plays becalmed, and nothing on the map says why.
    //     Open Ocean shipped exactly this: its one belt sat almost entirely west of
    //     the sailing limit, so the course never saw a puff and the minimap agreed.
    //     Measured by area (a deterministic grid over the region), because a source is
    //     allowed to overhang the edge a little the way wind regions do — the defect
    //     is a source that is MOSTLY elsewhere.
    const gregs = (doc.gusts && doc.gusts.regions) || [];
    if (bnd) for (const r of gregs) {
        if (!r.poly || r.poly.length < 3) continue;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of r.poly) {
            if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1];
            if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1];
        }
        const N = 32;
        let inRegion = 0, inArena = 0;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            const x = x0 + (i + 0.5) * (x1 - x0) / N, y = y0 + (j + 0.5) * (y1 - y0) / N;
            if (!pointInRing(x, y, r.poly)) continue;
            inRegion++;
            if (window.Arena.contains(bnd, x, y)) inArena++;
        }
        if (!inRegion) continue;
        const pct = Math.round((inArena / inRegion) * 100);
        if (pct < 50) {
            add('warn', 'gust-arena', 'Gust source off the arena',
                `Only ${pct}% of "${r.id || 'gust source'}" lies inside the sailing limit — `
                + `cells born beyond it are pressure nobody can sail to. Move it over the course, `
                + `or shrink it to the water it means to cover.`);
        }
    }

    // 7b. FLOATING PROPS ON LAND. The `float` plane draws BEFORE the land, which is how a
    //     water object stops being painted on a bank — the land simply covers it. The cost
    //     of that is a silent failure mode the other planes do not have: a pad cluster
    //     dropped entirely inside a shape is not wrong-looking, it is INVISIBLE, and the
    //     only symptom is scenery the author placed and cannot find. So it gets said here.
    //
    //     A warning, not an error: overlap is normal and wanted — a bed laps against a bank
    //     and the coastline trims it, which is the whole point. Only a prop whose CENTRE is
    //     on land is called out, matching the floe check's rule above rather than inventing
    //     a coverage fraction that would fire on every well-placed bed at the shore.
    const fprops = (doc.props || []).filter(p => {
        const t = window.VenueDoc.propTraits ? window.VenueDoc.propTraits(p) : null;
        const kind = (window.VenueDoc.PROP_KINDS || {})[p.kind] || {};
        return (t ? t.plane : (p.plane || kind.plane)) === 'float';
    });
    if (fprops.length) {
        const sunk = [];
        for (const p of fprops) {
            for (const l of land) if (pointOnLand(p.x, p.y, l)) { sunk.push(p); break; }
        }
        add(sunk.length ? 'warn' : 'ok', 'float-prop-land', 'Floating scenery on land',
            sunk.length ? `${sunk.length} of ${fprops.length} floating props have their centre inside land`
                        + ' — they draw under the land, so these are invisible. Move them to water.'
                        : `all ${fprops.length} floating props sit on water`,
            { points: sunk.map(p => ({ x: p.x, y: p.y })) });
    }

    // 8. RACE LENGTH. The target is a design decision, so this is a warning and not
    //    an error, but a course nobody wants to finish is still a broken course.
    // NO WIND IS UNSAILABLE. Outside every wind region the water is calm, so a course whose
    // route crosses an uncovered patch cannot be sailed there — and it looks perfectly fine
    // on the map, which is exactly why this has to be said out loud.
    const est0 = compiled.estimate;
    if (est0) {
        const calm = est0.calm || 0;
        if (calm > 0) {
            add('error', 'no-wind', 'No wind over part of the course',
                `${M(calm)} of the sailable path crosses water with no wind region over it`
                + ' — a boat cannot sail there. Cover it in Wind mode.');
        } else {
            add('ok', 'no-wind', 'Wind covers the course',
                'Every part of the sailable path has wind over it');
        }
    }

    const est = compiled.estimate;
    if (est && est.secs > 0) {
        // The honest measure: the hull-width path around the land, priced by the game's
        // own polar. The fleet mean runs about 1.35x the leader (measured in the eval), and
        // that is what the 3–5 minute target was ever about.
        const best = est.secs, mean = est.secs * 1.35;
        const inBand = mean >= 180 && mean <= 300;
        const detour = compiled.sailedDist > 0 ? est.dist / compiled.sailedDist : 1;
        add(inBand ? 'ok' : 'warn', 'race-length', 'Race length',
            `${M(est.dist)} of sailable path (${detour.toFixed(2)}x the straight line) — `
            + `best ~${Math.floor(best / 60)}:${String(Math.round(best % 60)).padStart(2, '0')}, `
            + `fleet ~${Math.floor(mean / 60)}:${String(Math.round(mean % 60)).padStart(2, '0')}`
            + (inBand ? ' (in the 3–5 min band)' : ' — outside the 3–5 min target'));
        // A limit is a promise that the slow boats get to finish. 1.6x the leader is where
        // the eval's spread puts the last of them.
        const limit = (compiled.cutoff != null) ? compiled.cutoff : compiled.cutoffAuto;
        // The SAME recommendation the editor's button offers and the game falls back to:
        // twice the best time round the course, to the nearest minute. It used to suggest
        // 1.6x here while the button offered 1.6x a different estimate and the game used a
        // per-metre rule — three answers to one question.
        const want = compiled.cutoffAuto || Math.max(60, Math.ceil(best * 2 / 60) * 60);
        if (compiled.cutoff == null) {
            add('warn', 'cutoff-derived', 'Time limit is derived',
                `No authored limit, so the game uses twice the best time along the course path,`
                + ` rounded up to the minute: ${Math.floor(compiled.cutoffAuto / 60)}:`
                + String(Math.round(compiled.cutoffAuto % 60)).padStart(2, '0')
                + `. The slowest of the fleet want about `
                + `${Math.floor(want / 60)}:${String(Math.round(want % 60)).padStart(2, '0')}`
                + ` — author it in the Overview if that is tight.`);
        } else {
            const ok = limit >= want * 0.9;
            add(ok ? 'ok' : 'warn', 'cutoff-enough', 'Time limit',
                `${Math.floor(limit / 60)}:${String(Math.round(limit % 60)).padStart(2, '0')} authored`
                + ` against a ${Math.floor(want / 60)}:${String(Math.round(want % 60)).padStart(2, '0')}`
                + ` need for the tail of the fleet`
                + (ok ? '' : ' — the slower boats would be scored DNF while still racing'));
        }
    } else if (compiled.sailedDist > 0) {
        // ⚠️ THIS BRANCH WAS DEAD AND BROKEN: it named `inBand`, `dist` and `expected`, none
        // of which exist here any more — three ReferenceErrors that could not fire while
        // every course had a sailable path to price. Allowing a region to be calm made one
        // that has not, and the checks threw instead of reporting.
        // It also should not dress the straight line up as an estimate. If no path could be
        // priced the course is blocked or becalmed, and THAT is the finding.
        add('warn', 'race-length', 'Race length',
            `${M(compiled.sailedDist)} of straight-line course, but no sailable path could be`
            + ' priced — check that wind covers the water and the route is not blocked.');
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
