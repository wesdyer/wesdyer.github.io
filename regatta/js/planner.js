
// Geometry Helpers
const Geom = {
    // Check if segment AB intersects segment CD
    segmentIntersect: function(a, b, c, d) {
        const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
        return (ccw(a, c, d) !== ccw(b, c, d)) && (ccw(a, b, c) !== ccw(a, b, d));
    },

    // Point in Polygon (Ray casting)
    pointInPolygon: function(p, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > p.y) !== (yj > p.y)) &&
                (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    },

    // Distance from point P to segment AB
    distToSegment: function(p, a, b) {
        const l2 = (a.x - b.x)**2 + (a.y - b.y)**2;
        if (l2 === 0) return Math.sqrt((p.x - a.x)**2 + (p.y - a.y)**2);
        let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const px = a.x + t * (b.x - a.x);
        const py = a.y + t * (b.y - a.y);
        return Math.sqrt((p.x - px)**2 + (p.y - py)**2);
    },

    // A TRUE OUTWARD OFFSET. Every vertex moves along the bisector of its two edge normals,
    // so the new outline sits `margin` clear of the old one the whole way round.
    //
    // What this replaces was a RADIAL push from the centroid, on the stated assumption that
    // "islands are star-shaped radial". A coastline is not one: 50 of Glacier Sound's 84
    // vertices cannot see their own centroid. Where the shore runs roughly parallel to a
    // centroid ray — inlets, the backs of headlands — a radial push is nearly TANGENTIAL and
    // buys almost no perpendicular room. Measured against an intended 100 units: median 83,
    // p10 29, MINIMUM 2, against a 30-unit hull. The inflated ring never self-intersected, so
    // nothing complained; the boats simply believed in clearance they did not have.
    offsetRing: function(verts, margin) {
        const n = verts.length;
        if (n < 3) return verts.map(v => ({ x: v.x, y: v.y }));
        // Winding decides which way is OUT. Shoelace positive = counter-clockwise, whose
        // outward normal for edge a->b is (dy, -dx); negative flips it.
        let area2 = 0;
        for (let i = 0; i < n; i++) {
            const a = verts[i], b = verts[(i + 1) % n];
            area2 += a.x * b.y - b.x * a.y;
        }
        const s = area2 >= 0 ? 1 : -1;
        const edgeNormal = (i) => {
            const a = verts[i], b = verts[(i + 1) % n];
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            return { x: s * dy / len, y: -s * dx / len };
        };
        // A mitre grows without bound as a corner sharpens. Capped, so a near-spike is cut
        // back instead of shooting a spar of "blocked water" out into open sea.
        const MITRE_CAP = 3;
        const out = [];
        for (let i = 0; i < n; i++) {
            const n1 = edgeNormal((i - 1 + n) % n), n2 = edgeNormal(i);
            let bx = n1.x + n2.x, by = n1.y + n2.y;
            const bl = Math.hypot(bx, by);
            if (bl < 1e-9) {
                // A 180 degree reversal has no bisector. Use the edge normal and move on.
                out.push({ x: verts[i].x + n2.x * margin, y: verts[i].y + n2.y * margin });
                continue;
            }
            bx /= bl; by /= bl;
            const cos = bx * n1.x + by * n1.y;             // cosine of half the turn
            const scale = Math.min(margin / Math.max(cos, 1e-6), margin * MITRE_CAP);
            out.push({ x: verts[i].x + bx * scale, y: verts[i].y + by * scale });
        }
        return out;
    },

    // Check if segment AB intersects Polygon (any edge) OR is fully inside
    // Returns true if blocked
    segmentIntersectsPoly: function(a, b, poly) {
        // 1. Check intersection with edges
        for (let i = 0; i < poly.length; i++) {
            const p1 = poly[i];
            const p2 = poly[(i + 1) % poly.length];
            if (Geom.segmentIntersect(a, b, p1, p2)) return true;
        }
        // 2. Check if completely inside (midpoint check)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (Geom.pointInPolygon(mid, poly)) return true;

        return false;
    }
};

class RoutePlanner {
    constructor() {
        this.path = [];
        this.inflatedIslands = [];
        this.lastStart = null;
        this.lastTarget = null;
        this.islandsDirty = true;
    }

    updateIslands(islands) {
        // Inflate islands for safety margin
        // Safety = Boat Radius (approx 30) + Buffer (50) + SpeedFactor?
        // Fixed generous buffer for static land: 100 units. Drifting floes get
        // more — they move 20-60u between replans, eating the margin.
        this.inflatedIslands = islands.map(isl => {
            // Floe margin stepped 190 -> 120 -> 36: first when avoidance learned
            // to PREDICT drift instead of padding for it, then when the recorded
            // human races (14-19u clearance floor, every run) proved the tighter
            // water genuinely sailable. An over-inflated pack reads as closed
            // water and the planner refuses gaps boats can take. 24 overshot:
            // solo seeds collapsed against walls the planner no longer feared.
            const MARGIN = isl.isFloe ? 36 : 100;
            return {
                x: isl.x, y: isl.y,
                // Still the BOUNDING circle, and still only a broad-phase reject. A mitred
                // corner can sit slightly further out than this, which costs a missed reject,
                // never a missed collision — the polygon test behind it is the real answer.
                radius: isl.radius + MARGIN,
                vertices: Geom.offsetRing(isl.vertices, MARGIN)
            };
        });
        this.islandsDirty = false;
    }

    // Check if a straight line is safe
    isLineSafe(start, end) {
        for (const isl of this.inflatedIslands) {
            // Optimization: Bounding Circle Check
            // Dist from segment to circle center
            const dist = Geom.distToSegment({x: isl.x, y: isl.y}, start, end);
            if (dist > isl.radius) continue;

            // Detailed Polygon Check
            if (Geom.segmentIntersectsPoly(start, end, isl.vertices)) return false;
        }
        return true;
    }

    // A* Pathfinding on Visibility Graph
    findPath(start, target, islands, version) {
        // Rebuild the inflated cache when the island list changes — including
        // when drifting ice floes MOVE (version bump). Comparing only length
        // left the planner routing around floe positions minutes stale.
        if (this.inflatedIslands.length !== islands.length || this._islandsVersion !== version) {
            this.updateIslands(islands);
            this._islandsVersion = version;
        }

        // A target INSIDE an inflated obstacle is unreachable by construction: A*
        // finds no incoming edge, falls through to the straight-line fallback, and
        // the boat drives into the very thing being avoided. A carrot waypoint that
        // lands within a drifting floe's margin does this constantly. Project such
        // a target out through the obstacle's centre to just past its ring first.
        for (const isl of this.inflatedIslands) {
            const dx = target.x - isl.x, dy = target.y - isl.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > isl.radius * isl.radius) continue;
            if (!Geom.pointInPolygon(target, isl.vertices)) continue;
            const d = Math.sqrt(d2) || 1;
            const out = isl.radius + 20;
            target = { x: isl.x + (dx / d) * out, y: isl.y + (dy / d) * out };
            break;
        }

        // 1. Check direct line
        if (this.isLineSafe(start, target)) {
            return [target];
        }

        // 2. Build Graph
        // Nodes: Start, Target, and vertices of islands NEAR the start→target
        // corridor only. Far islands can't be part of a sane detour, and each
        // extra node multiplies A* expansion cost (every neighbor check is an
        // isLineSafe over all islands).
        const nodes = [{x: start.x, y: start.y, id: 'start'}, {x: target.x, y: target.y, id: 'end'}];
        let nodeId = 0;

        for (const isl of this.inflatedIslands) {
            const corridor = isl.radius + 900;
            if (Geom.distToSegment({ x: isl.x, y: isl.y }, start, target) > corridor) continue;
            for (const v of isl.vertices) {
                nodes.push({ x: v.x, y: v.y, id: nodeId++, islandId: isl });
            }
        }

        // A* Algorithm
        const startNode = nodes[0];
        const endNode = nodes[1];

        // Adjacency is dynamic (check visibility on expansion)
        // Heuristic: Euclidean distance to target
        const h = (n) => Math.sqrt((n.x - target.x)**2 + (n.y - target.y)**2);

        const openSet = [{ node: startNode, f: h(startNode), g: 0, parent: null }];
        const closedSet = new Set();

        // Safety break
        let ops = 0;

        while (openSet.length > 0 && ops++ < 2000) {
            // Pop lowest f
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();

            if (current.node === endNode) {
                // Reconstruct path
                const path = [];
                let curr = current;
                while (curr.parent) {
                    path.unshift({ x: curr.node.x, y: curr.node.y });
                    curr = curr.parent;
                }
                // Don't include start position in path list (we are there)
                return path;
            }

            closedSet.add(current.node);

            // Neighbors: All other nodes visible from current
            for (const neighbor of nodes) {
                if (neighbor === current.node) continue;
                if (closedSet.has(neighbor)) continue;

                // Distance
                const dist = Math.sqrt((current.node.x - neighbor.x)**2 + (current.node.y - neighbor.y)**2);

                if (!this.isLineSafe(current.node, neighbor)) continue;

                const tentativeG = current.g + dist;

                const existing = openSet.find(i => i.node === neighbor);
                if (existing) {
                    if (tentativeG < existing.g) {
                        existing.g = tentativeG;
                        existing.f = existing.g + h(neighbor);
                        existing.parent = current;
                    }
                } else {
                    openSet.push({
                        node: neighbor,
                        g: tentativeG,
                        f: tentativeG + h(neighbor),
                        parent: current
                    });
                }
            }
        }

        // Fallback: Direct line if pathfinding fails (shouldn't happen unless enclosed)
        return [target];
    }
}

// ── THE COURSE PATH: the ruler DMC is measured on ────────────────────────────
//
// Distance Made on Course is a RANKING metric, so every boat has to be measured on the
// same ruler. That means ONE canonical path per leg, computed at course build and shared
// by the whole fleet — not a path per boat. Two boats measured on two paths cannot be
// compared, which is the whole point of the number.
//
// What it replaces projected every boat onto a single straight `courseAxis()` — start to
// windward gate — and chose its per-leg formula from `role === 'windward'`. That is only
// true on an alternating windward/leeward course. On Glacier Sound, whose roles are
// start/rounding/finish, every leg took the "running back" branch and PROGRESS RAN
// BACKWARDS as a boat sailed out to the isle: 36% of sampled seconds went down, and the
// leaderboard ranked the outbound leg inverted.
//
// Three rules the path obeys:
//
//   LAND ONLY, AND ONLY STATIC LAND. Ice floes drift and bump `navVersion`; a path that
//   re-planned around them would move the ruler under the fleet mid-race and every rank
//   would jitter. The path is planned around authored, non-drifting shapes and nothing else.
//
//   A ROUNDING IS AN ARC, NOT A POINT. The path approaches the zone, goes AROUND the mark
//   on the required side, and leaves aimed at the next anchor. Routing straight to the mark
//   would stall DMC through the rounding — exactly where boats are closest together — and on
//   a mark planted on an island it would route through the island.
//
//   A GATE IS A SEGMENT; the path uses its MIDPOINT. Measuring each boat to its own nearest
//   gate point reintroduces the per-boat ruler.
//
// Upwind legs are measured on the RHUMB LINE, not the tacking distance: that is what makes
// two boats on opposite tacks comparable, and it is what real race telemetry reports.
// How far a boat may plausibly have moved along the course since its last reading.
// Generous forwards (a quick boat, a dropped frame), tighter backwards.
const PROJECT_AHEAD = 900, PROJECT_BACK = 400;
// A boat rounds close aboard: the mark's own body plus room to turn.
const ROUND_CLEARANCE = 70, ROUND_MIN_R = 90;
const CoursePath = {
    // Where a leg is sailed TO, before any rounding detour.
    anchor(entry, marks) {
        if (!entry) return null;
        if (entry.kind === 'round') return entry.mark ? { x: entry.mark.x, y: entry.mark.y } : null;
        const i = entry.marks;
        if (i && marks && marks[i[0]] && marks[i[1]]) {
            return { x: (marks[i[0]].x + marks[i[1]].x) / 2, y: (marks[i[0]].y + marks[i[1]].y) / 2 };
        }
        return null;
    },

    // Only shapes that are where the designer put them. A drifting floe is not part of the
    // ruler — see the note above.
    //
    // Banks ARE included, unlike `navIslands`. That exclusion exists because feeding the
    // river's 82 banks to the AI's per-frame replanner caused multi-hundred-millisecond
    // spikes; this runs a handful of times per course build (measured 0.4 ms with all 82),
    // and a bank is land a boat cannot sail through, so leaving it out would measure a leg
    // straight through the shore.
    staticLand(islands) {
        return (islands || []).filter(i => i && i.vertices && !i.isFloe && i.nav !== false);
    },

    // HOW FAR ROUND THIS MARK THE COURSE ACTUALLY REQUIRES, in radians. The angle from the
    // bearing you arrive on to the bearing you leave on, taken the required way round — a
    // fact about where the previous and next marks are, not a constant.
    //
    // A flat threshold cannot serve: a triangle corner needs a fraction of a turn while an
    // out-and-back needs the whole circle. The engine used 45 degrees for everything, so a
    // 60-degree nibble at Glacier Sound's isle completed a leg that requires 360.
    requiredSweep(marks, route, leg) {
        const e = route && route[leg];
        if (!e || e.kind !== 'round' || !e.mark) return null;
        const from = CoursePath.anchor(route[leg - 1], marks);
        const to = CoursePath.anchor(route[leg + 1], marks) || from;
        if (!from || !to) return null;
        // The IDEAL path's own arc, tangent to tangent — so the engine and the drawn route
        // agree by construction instead of by two similar-looking formulas.
        const sgn = e.mark.side === 'port' ? -1 : 1;
        const a0 = CoursePath._tangent(e.mark, from, sgn, true).a;
        const a1 = CoursePath._tangent(e.mark, to, sgn, false).a;
        let sweep = (a1 - a0) * sgn;
        while (sweep < 0) sweep += Math.PI * 2;
        while (sweep > Math.PI * 2) sweep -= Math.PI * 2;
        if (sweep < 0.2) sweep = Math.PI * 2;
        return sweep;
    },

    // HOW TIGHT YOU ACTUALLY ROUND. The ZONE is where mark-room applies (three hull lengths
    // by the rules, or wide enough to capture an island); it is not the radius you sail. A
    // boat rounds close aboard — the mark's own body plus enough water to turn in — so a
    // path that arcs all the way round at zone radius is a lap of the zone, not a rounding.
    // ⚠️ AND IT HAS TO BE ON WATER. `mark.radius` is the mark's NOMINAL size; on a mark
    // planted on an island the real coastline is irregular, so a circle at radius+clearance
    // can still clip the shore. When it does, the router cannot reach the tangent point at
    // all, gives up, and returns the straight line — which put 90 of 299 samples of Glacier
    // Sound's leg straight through the island while looking like a tidy tangent.
    //
    // So the radius is chosen against the GRID: the tightest one in the ladder whose whole
    // circle is navigable. Cached per mark, because it is asked for on every waypoint.
    _roundR(mark, grid) {
        if (mark._roundR != null) return mark._roundR;
        const want = Math.max(ROUND_MIN_R, (mark.radius || 12) + ROUND_CLEARANCE);
        let pick = Math.min(want, mark.zone * 0.9);
        if (grid && typeof window !== 'undefined' && window.SailCheck) {
            const clear = (R) => {
                for (let k = 0; k < 32; k++) {
                    const a = k / 32 * Math.PI * 2;
                    const c = grid.cell(mark.x + Math.cos(a) * R, mark.y + Math.sin(a) * R);
                    if (!grid.at(c[0], c[1])) return false;
                }
                return true;
            };
            pick = null;
            for (const R of [want, want * 1.25, want * 1.5, mark.zone * 0.75, mark.zone, mark.zone * 1.2]) {
                if (clear(R)) { pick = R; break; }
            }
            if (pick == null) pick = mark.zone;     // nothing clear: the venue check will say so
            mark._roundR = pick;
        }
        return pick;
    },

    // Where the straight leg MEETS the rounding circle: the tangent point, not the radial
    // rim point. Straight in on a tangent, round, straight out on a tangent is the shape of
    // an ideal rounding — a hairpin whose two legs run either side of the mark — where
    // radial in-and-out draws a line to the rim and a full circle back to the same place.
    //
    // `sgn` is +1 for starboard (bearing increases round the mark), so the ENTRY tangent
    // sits ahead of the approach bearing and the EXIT tangent behind the departure bearing.
    _tangent(mark, p, sgn, entering, grid) {
        const R = CoursePath._roundR(mark, grid);
        const dx = p.x - mark.x, dy = p.y - mark.y;
        const d = Math.hypot(dx, dy);
        const base = Math.atan2(dy, dx);
        if (!(d > R + 1)) return { a: base, x: mark.x + Math.cos(base) * R, y: mark.y + Math.sin(base) * R };
        const beta = Math.acos(Math.max(-1, Math.min(1, R / d)));
        const a = base + (entering ? sgn * beta : -sgn * beta);
        return { a, x: mark.x + Math.cos(a) * R, y: mark.y + Math.sin(a) * R };
    },

    // A point on the zone circle, in the direction of `from`.
    _rim(mark, from) {
        const dx = from.x - mark.x, dy = from.y - mark.y;
        const d = Math.hypot(dx, dy) || 1;
        return { x: mark.x + (dx / d) * mark.zone, y: mark.y + (dy / d) * mark.zone };
    },

    // The arc a boat sweeps going round `mark` from bearing `a0` to bearing `a1`, leaving it
    // on the required side.
    //
    // SIGN DERIVED, NOT GUESSED — the same derivation the leg engine uses: heading h gives
    // forward (sin h, -cos h) on this y-down canvas, so leaving the mark to STARBOARD means
    // the bearing angle INCREASES. Port decreases.
    _arc(mark, a0, a1, side) {
        const sgn = side === 'port' ? -1 : 1;
        let sweep = (a1 - a0) * sgn;
        while (sweep < 0) sweep += Math.PI * 2;
        while (sweep > Math.PI * 2) sweep -= Math.PI * 2;
        // AN OUT-AND-BACK IS A FULL CIRCUIT. When a leg leaves for the place it came from
        // the approach and exit bearings are identical and the arithmetic says "no arc",
        // but the boat has to get round the mark — and on a mark planted on an island it
        // cannot pass through. So the route goes the whole way round, on the required side,
        // and the leg ends where the rounding is complete; the next leg starts there.
        //
        // This was left OUT for a while because a closed arc starts and ends at the same
        // point, and the old furthest-of-all projection read "circuit complete" the moment a
        // boat arrived. `project` now continues from the boat's last reading, so a loop is
        // orderable: two points 5347 units apart on the arc are never both inside the
        // window, however close together they are on the water.
        if (sweep < 0.2) sweep = Math.PI * 2;
        const steps = Math.max(2, Math.ceil(sweep / 0.35));
        const pts = [];
        for (let i = 1; i <= steps; i++) {
            const a = a0 + sgn * sweep * (i / steps);
            const R = CoursePath._roundR(mark, null);
            pts.push({ x: mark.x + Math.cos(a) * R, y: mark.y + Math.sin(a) * R });
        }
        pts.sweep = sweep;
        return pts;
    },

    // The path for ONE leg: from where the previous leg left off, to where this one ends.
    // `planner` may be null, in which case legs are straight (the editor uses this before a
    // planner exists; the game always passes one).
    legPath(leg, marks, route, land, planner, version, grid) {
        const entry = route[leg];
        if (!entry) return null;
        const here = CoursePath.anchor(entry, marks);
        if (!here) return null;

        // Where this leg BEGINS: the previous leg's end. On a rounding that is the departure
        // point on the zone, not the mark itself.
        // A LEG BEGINS WHERE THE LAST ONE ENDED. After a rounding that is the EXIT TANGENT —
        // the identical call the previous leg finished on — not a radial point on the zone.
        // Those are two different places (different radius AND different bearing), so using
        // the rim here left a gap between the legs: the ruler jumped, and the drawn route
        // restarted somewhere the boat had never been.
        const prev = route[leg - 1];
        let from = prev ? CoursePath.anchor(prev, marks) : null;
        if (prev && prev.kind === 'round' && prev.mark) {
            const psgn = prev.mark.side === 'port' ? -1 : 1;
            const t = CoursePath._tangent(prev.mark, here, psgn, false, grid);
            from = { x: t.x, y: t.y };
        }
        if (!from) from = here;   // leg 0 has nothing before it; handled by the caller

        const pts = [{ x: from.x, y: from.y }];
        const push = (p) => {
            const last = pts[pts.length - 1];
            if (Math.hypot(p.x - last.x, p.y - last.y) > 0.5) pts.push({ x: p.x, y: p.y });
        };

        // Sail to the TANGENT POINT on the rounding circle — not to the mark (a rounding mark
        // can be planted on an island) and not to a radial point on the zone rim.
        const rm = (entry.kind === 'round') ? entry.mark : null;
        const sgn = rm && rm.side === 'port' ? -1 : 1;
        const tIn = rm ? CoursePath._tangent(rm, from, sgn, true, grid) : null;
        const aim = tIn ? { x: tIn.x, y: tIn.y } : here;
        for (const w of CoursePath._route(from, aim, land, planner, version, grid)) push(w);

        // Round it close aboard, and leave on the tangent toward whatever comes next.
        if (rm) {
            const nextA = CoursePath.anchor(route[leg + 1], marks) || from;
            const tOut = CoursePath._tangent(rm, nextA, sgn, false, grid);
            const arc = CoursePath._arc(rm, tIn.a, tOut.a, rm.side);
            for (const p of arc) push(p);
            // What the ruler ACTUALLY swept round this mark. A distance or time estimate has
            // to know when that was ~0 — an out-and-back, where the boat really does circle
            // the mark but position alone cannot order the loop, so the path leaves it out.
            const m = CoursePath._measure(pts);
            m.roundSweep = arc.sweep;
            m.roundZone = CoursePath._roundR(rm, grid);
            return m;
        }

        return CoursePath._measure(pts);
    },

    // Is the straight line between two points entirely on navigable water?
    // ⚠️ Sampled at a QUARTER of a cell, not a half. A segment that clips the corner of a
    // blocked cell can be inside it for a very short distance, and a coarser walk steps
    // straight over that — which would let the smoother pull a line across a headland it
    // never tested. The grid's navigable cells already carry SailCheck's CLEARANCE (a hull
    // plus margin), so a clear line here is clear with room, not merely clear.
    _lineClear(grid, a, b) {
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(4, Math.ceil(d / (grid.res * 0.25)));
        for (let k = 0; k <= steps; k++) {
            const c = grid.cell(a.x + (b.x - a.x) * k / steps, a.y + (b.y - a.y) * k / steps);
            if (!grid.at(c[0], c[1])) return false;
        }
        return true;
    },

    // ── STRING-PULLING ──────────────────────────────────────────────────────
    // A grid search returns a path made of cell centres and eight-way steps, so it
    // stair-steps along diagonals and takes little dog-legs through water that is wide
    // open. That is an artefact of the search, not a feature of the course — a boat would
    // sail the straight line, and a designer looking at the drawn route rightly asks why it
    // does not.
    //
    // So pull the string taut: walk forward from each kept point to the FURTHEST later point
    // still in clear line of sight, and drop everything between. What survives is the
    // shortest polyline through the same gaps — and far fewer points, which makes the ruler
    // cheaper to project onto as well.
    _smoothPass(pts, grid) {
        const out = [pts[0]];
        let i = 0;
        while (i < pts.length - 1) {
            let j = pts.length - 1;
            while (j > i + 1 && !CoursePath._lineClear(grid, pts[i], pts[j])) j--;
            out.push(pts[j]);
            i = j;
        }
        return out;
    },
    _smooth(pts, grid) {
        if (!grid || pts.length < 3) return pts;
        // ⚠️ ONE GREEDY PASS IS NOT ENOUGH, and it is not enough in a way that looks like a
        // bug: taking the FURTHEST visible point from here can leave a kink that a slightly
        // nearer choice would have avoided, because the reachable set from a later point
        // depends on which point you landed on. Sweeping forwards and backwards to a fixed
        // point removes those — a corner survives only if BOTH directions agree it must.
        let cur = pts;
        for (let k = 0; k < 8; k++) {
            const fwd = CoursePath._smoothPass(cur, grid);
            const back = CoursePath._smoothPass(fwd.slice().reverse(), grid).reverse();
            if (back.length === cur.length) { cur = back; break; }
            cur = back;
        }
        // Drop any point that its two neighbours can see past — the last few corners a
        // greedy sweep keeps are usually these.
        for (let k = 0; k < 4; k++) {
            let removed = false;
            const out = [cur[0]];
            for (let i = 1; i < cur.length - 1; i++) {
                if (CoursePath._lineClear(grid, out[out.length - 1], cur[i + 1])) { removed = true; continue; }
                out.push(cur[i]);
            }
            out.push(cur[cur.length - 1]);
            cur = out;
            if (!removed) break;
        }
        return cur;
    },

    // GETTING FROM A TO B AROUND LAND, and nothing else. No wind, no tactics, no approach
    // offsets: this is the shortest sailable route between two points on the course, and the
    // tacking a beat needs is priced separately (the rhumb line is the agreed measure).
    //
    // Grid first — a visibility graph cannot path a keyholed coastline, see fromWaypoints.
    _route(from, to, land, planner, version, grid) {
        const straight = Math.hypot(to.x - from.x, to.y - from.y);
        if (grid && typeof window !== 'undefined' && window.SailCheck) {
            if (straight > grid.res * 5) {
                const seg = window.SailCheck.pathBetween(grid, [from.x, from.y], [to.x, to.y]);
                if (seg && seg.length > 1) {
                    let L = 0;
                    for (let k = 1; k < seg.length; k++) L += Math.hypot(seg[k][0] - seg[k-1][0], seg[k][1] - seg[k-1][1]);
                    // A grid path stair-steps, so it overstates a clear run. Take the detour
                    // only when it is real, and end on the true target rather than a cell
                    // centre.
                    // ⚠️ SHORT IS NOT CLEAR (2026-08-21, the owner's Narrow
                    // Passage): a path kinked through a slot can be under 8%
                    // longer than the chord — the old gate threw it away and
                    // returned a straight line that CLIPS the corner, and the
                    // helm then (rightly) refused the unsailable plan and
                    // improvised a full circumnavigation. The straight
                    // fallback must pass the grid's own line-of-sight; a leg
                    // whose chord is clear is byte-identical to before.
                    const chordClear = window.SailCheck.losClear
                        && window.SailCheck.losClear(grid, from.x, from.y, to.x, to.y);
                    if (L > straight * 1.08 || !chordClear) {
                        const out = seg.map(q => ({ x: q[0], y: q[1] }));
                        out[0] = { x: from.x, y: from.y };
                        out[out.length - 1] = { x: to.x, y: to.y };
                        // Taut, not stair-stepped — see _smooth. Drop the leading point:
                        // the caller already has `from`.
                        return CoursePath._smooth(out, grid).slice(1);
                    }
                }
            }
            return [{ x: to.x, y: to.y }];
        }
        if (planner && land.length) return planner.findPath(from, to, land, version);
        return [{ x: to.x, y: to.y }];
    },

    _measure(pts) {
        const cum = [0];
        for (let i = 1; i < pts.length; i++) {
            cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        }
        return { pts, cum, length: cum[cum.length - 1] || 0 };
    },

    // Every leg, plus the cumulative distance each one starts at.
    build(marks, route, islands, planner, version, grid) {
        const land = CoursePath.staticLand(islands);
        const legs = [];
        let total = 0;
        for (let i = 0; i < (route || []).length; i++) {
            const p = (i === 0) ? null : CoursePath.legPath(i, marks, route, land, planner, version, grid);
            legs.push(p ? Object.assign({ base: total }, p) : { pts: [], cum: [0], length: 0, base: total });
            total += legs[i].length;
        }
        return { legs, total };
    },

    // ── THE PATH A BOAT WOULD ACTUALLY SAIL ─────────────────────────────────
    // Built from SailCheck's grid rather than the visibility planner, whenever one is
    // available. This is not a preference, it is a correctness requirement:
    //
    // Glacier Sound's land is ONE 88-vertex ring, KEYHOLED so the sound is a hole inside
    // it. `RoutePlanner` inflates each obstacle by offsetting every vertex along its edge
    // bisector, which is meaningless on a keyholed ring — the bridge vertices blow up. It
    // correctly reported the direct line unsafe, found no safe edge at all, and fell
    // through to its documented `return [target]` fallback. The result LOOKED like a clean
    // straight line and ran 40% of its length THROUGH the island.
    //
    // A grid asks "is this cell water" with a point-in-ring test that handles holes
    // exactly, so it has no opinion about how the polygon is wound. SailCheck also already
    // knows how to enter a rounding on a bearing whose whole sweep is open and carry it
    // round 220 degrees, which is the real sailing route rather than a chord.
    fromWaypoints(route, wps, grid) {
        const legOf = (tag) => { const m = /(\d+)$/.exec(tag || ''); return m ? +m[1] : 0; };
        const DIRECT = grid.res * 5;      // shorter than a few cells: measure it straight
        const per = [];
        for (let i = 0; i < route.length; i++) per.push([]);
        let prev = null;
        for (const wp of wps) {
            const li = Math.min(route.length - 1, legOf(wp.tag));
            if (prev) {
                const straight = Math.hypot(wp.x - prev.x, wp.y - prev.y);
                let hop = null;
                if (straight > DIRECT) {
                    const seg = window.SailCheck.pathBetween(grid, [prev.x, prev.y], [wp.x, wp.y]);
                    if (seg && seg.length > 1) {
                        let L = 0;
                        for (let k = 1; k < seg.length; k++) L += Math.hypot(seg[k][0] - seg[k-1][0], seg[k][1] - seg[k-1][1]);
                        // A grid path stair-steps, so it overstates a clear run. Take it only
                        // when the detour it found is real.
                        if (L > straight * 1.08) hop = seg.map(q => ({ x: q[0], y: q[1] }));
                    }
                }
                const list = per[li];
                if (!list.length) list.push({ x: prev.x, y: prev.y });
                for (const q of (hop || [{ x: wp.x, y: wp.y }])) list.push(q);
            }
            prev = wp;
        }
        const legs = [];
        let total = 0;
        for (let i = 0; i < route.length; i++) {
            const m = per[i].length >= 2 ? CoursePath._measure(per[i]) : { pts: [], cum: [0], length: 0 };
            legs.push(Object.assign({ base: total }, m));
            total += m.length;
        }
        return { legs, total };
    },

    // ── PRICING A PATH WITH THE POLAR ───────────────────────────────────────
    // ONE implementation, used by the course estimate, the auto time limit and the editor's
    // per-leg readout — so a designer reading "best 0:46" on a leg is reading the number
    // that leg contributes to the course total, not a lookalike.
    //
    // Each SEGMENT is priced on its own bearing: a leg that detours round a headland is
    // upwind for part of it and reaching for the rest.
    //
    // DISTANCE and TIME take different allowances, deliberately. `sailed` carries the 1.45x
    // tacking multiplier — the water a boat actually covers. `secs` does NOT: it divides the
    // geometric length by the best VMG toward that bearing, and that optimisation has
    // already picked the close-hauled angle and taken the cosine loss. Applying both would
    // charge for the beat twice.
    priceLeg(pts, windFrom, refWind) {
        const out = { geom: 0, sailed: 0, secs: 0, upwind: 0 };
        const gts = (typeof getTargetSpeed === 'function') ? getTargetSpeed : null;
        const REF = refWind || 14;
        const upx = Math.sin(windFrom), upy = -Math.cos(windFrom);
        const vmgToward = (bearing) => {
            if (!gts) return null;
            const twaCourse = Math.abs(((bearing - windFrom + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            let best = 0;
            for (let d = 0; d <= 180; d += 4) {
                const twa = d * Math.PI / 180;
                const v = gts(twa, d > 90, REF) * Math.cos(twa - twaCourse);
                if (v > best) best = v;
            }
            return best;
        };
        for (let i = 1; i < (pts || []).length; i++) {
            const a = pts[i - 1], b = pts[i];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            if (d < 1e-6) continue;
            out.geom += d;
            const up = (dx * upx + dy * upy) > d * 0.25;
            if (up) out.upwind += d;
            out.sailed += d * (up ? 1.45 : 1.0);
            const vmg = vmgToward(Math.atan2(dx, -dy));
            if (vmg && vmg > 0.2) out.secs += d / (vmg * 15);   // units/s = knots * 15
        }
        return out;
    },

    // How far along a path this point is.
    //
    // FURTHEST projection, not nearest segment. A bent path can put a boat near two of its
    // segments at once — every corner does this — and picking the nearer one makes the
    // reading flip back and forth as the boat crosses the bisector, which shows up as ranks
    // flickering at exactly the busiest moment. Furthest-along is stable there, and it is
    // still honest about a boat sailing the wrong way: the projection genuinely moves back.
    // How far along a path this point is.
    //
    // ⚠️ A PATH THAT COMES NEAR ITSELF CANNOT BE ORDERED BY POSITION ALONE. That is the same
    // fact that stopped the closed rounding loop working, and it bites again the moment the
    // paths stop being straight lines: a 220-degree rounding arc and a gate's approach-and-
    // exit pair both bring the route back beside an earlier part of itself, so a boat there
    // projects onto two places at once. Furthest-of-all reads the later one and the number
    // lurches then falls back (28 units on every windward/leeward venue, 47 on Glacier
    // Sound); nearest-of-all flickers at every bend instead; and a nearest-then-furthest
    // compromise fixed the arc but made the straight legs worse.
    //
    // So the reading CONTINUES from the last one. `hint` is where this boat was on this path
    // a moment ago, and only segments within a window of it are considered. A boat cannot
    // teleport along the course between frames, so the window is the honest constraint — and
    // inside it, position is unambiguous again.
    //
    // Without a hint (a boat arriving on a leg, or a one-off query) it falls back to nearest
    // over the whole path, which is the right first fix and seeds the next hint.
    project(path, x, y, hint) {
        if (!path || path.pts.length < 2) return 0;
        const lo = (hint == null) ? -Infinity : hint - PROJECT_BACK;
        const hi = (hint == null) ? Infinity : hint + PROJECT_AHEAD;
        let best = 0, bestD = Infinity, any = false;
        for (let i = 0; i < path.pts.length - 1; i++) {
            if (path.cum[i + 1] < lo || path.cum[i] > hi) continue;   // unreachable since last time
            const a = path.pts[i], b = path.pts[i + 1];
            const ex = b.x - a.x, ey = b.y - a.y;
            const l2 = ex * ex + ey * ey;
            if (l2 < 1e-6) continue;
            let t = ((x - a.x) * ex + (y - a.y) * ey) / l2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const px = a.x + ex * t, py = a.y + ey * t;
            const dd = (x - px) * (x - px) + (y - py) * (y - py);
            const s = path.cum[i] + Math.sqrt(l2) * t;
            // Nearest wins; a tie resolves FORWARD so a boat exactly on a corner advances
            // rather than stalling.
            if (dd < bestD - 1e-9 || (dd < bestD + 1e-9 && s > best)) { bestD = dd; best = s; any = true; }
        }
        if (!any && hint != null) return CoursePath.project(path, x, y, null);
        return best;
    }
};
if (typeof window !== 'undefined') window.CoursePath = CoursePath;
