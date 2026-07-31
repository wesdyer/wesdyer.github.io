
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
            const MARGIN = isl.isFloe ? 190 : 100;
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
