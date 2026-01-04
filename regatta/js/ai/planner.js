
// Geometry Helpers
export const Geom = {
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

export class RoutePlanner {
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
        // Let's use a fixed generous buffer for global planning: 100 units.
        const MARGIN = 100;

        this.inflatedIslands = islands.map(isl => {
            const center = { x: isl.x, y: isl.y };
            // Islands are star-shaped radial, so we can inflate radially
            const vertices = isl.vertices.map(v => {
                const dx = v.x - center.x;
                const dy = v.y - center.y;
                const len = Math.sqrt(dx*dx + dy*dy);
                // Push out
                const scale = (len + MARGIN) / len;
                return { x: center.x + dx * scale, y: center.y + dy * scale };
            });
            return {
                x: isl.x, y: isl.y,
                radius: isl.radius + MARGIN,
                vertices: vertices
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
    findPath(start, target, islands) {
        // If islands changed, update inflated cache
        if (this.inflatedIslands.length !== islands.length) {
            this.updateIslands(islands);
        }

        // 1. Check direct line
        if (this.isLineSafe(start, target)) {
            return [target];
        }

        // 2. Build Graph
        // Nodes: Start, Target, All Inflated Vertices
        const nodes = [{x: start.x, y: start.y, id: 'start'}, {x: target.x, y: target.y, id: 'end'}];
        let nodeId = 0;

        for (const isl of this.inflatedIslands) {
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
