// ARENA — the race boundary, as a shape rather than a radius.
//
// The boundary is the invisible wall that keeps boats in, plus the extent used for
// scattering ice, bouncing drift, clipping laylines and sizing the minimap. It was
// a circle in thirteen places.
//
// A circle is honest for a generated venue in open water: there is no natural edge,
// so a soft round one is fine. It is wrong for a painted map. Glacier Sound's arena
// was the circle INSCRIBED in a square map, so 21% of what was painted fell outside
// it — which is why ice clustered on an arc and land ran past the limit on one side.
//
// ONE representation: a polygon. Circle and rect are ways of DRAWING one. The
// analytic circle is kept alongside as a sampling fast path, for a specific
// measurable reason documented on `sample()` below.
//
// Shape of a boundary object:
//   { x, y, radius }                      circle (generated venues; unchanged)
//   { x, y, radius, poly: [[x,y], …] }    polygon (designed venues)
// `x`, `y`, `radius` stay populated even when `poly` is present, as the bounding
// circle, so anything not yet migrated degrades to a slightly loose limit rather
// than to nothing.
(function () {

function extent(b) {
    if (b.poly) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of b.poly) {
            if (p[0] < minX) minX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] > maxY) maxY = p[1];
        }
        return { minX, minY, maxX, maxY };
    }
    return { minX: b.x - b.radius, minY: b.y - b.radius, maxX: b.x + b.radius, maxY: b.y + b.radius };
}

function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
}

// Closest point on a segment, and the distance to it.
function nearestOnSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + t * dx, cy = ay + t * dy;
    return { x: cx, y: cy, d: Math.hypot(px - cx, py - cy) };
}

function nearestOnPoly(x, y, poly) {
    let best = null;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const n = nearestOnSeg(x, y, a[0], a[1], b[0], b[1]);
        if (!best || n.d < best.d) { best = n; best.i = i; }
    }
    return best;
}

// Positive inside, negative outside; magnitude is the distance to the edge. This
// one function replaces `dist > radius`, `dist > radius - 200`, `radius + 100` and
// friends, which is most of the thirteen sites.
function signedDist(b, x, y) {
    if (b.poly) {
        const n = nearestOnPoly(x, y, b.poly);
        return pointInPoly(x, y, b.poly) ? n.d : -n.d;
    }
    return b.radius - Math.hypot(x - b.x, y - b.y);
}

// With no inset only the SIGN matters, and a crossing test answers that without
// measuring the distance to every edge — `contains` is asked per raster cell by the
// grids and the checks, where the nearest-edge scan was most of their cost.
const contains = (b, x, y, inset) => {
    if (!inset && b.poly) return pointInPoly(x, y, b.poly);
    return signedDist(b, x, y) >= (inset || 0);
};

// Nearest position inside the arena. Used by the physics clamp, so it must return a
// point ON the edge when the boat is outside rather than merely near it — otherwise
// the clamp and the collision push-out fight each other, which is how the river
// banks once ground boats along a wall to DNF.
function clamp(b, x, y) {
    if (b.poly) {
        if (pointInPoly(x, y, b.poly)) return { x, y, clamped: false };
        const n = nearestOnPoly(x, y, b.poly);
        return { x: n.x, y: n.y, clamped: true };
    }
    const dx = x - b.x, dy = y - b.y;
    const d = Math.hypot(dx, dy);
    if (d <= b.radius) return { x, y, clamped: false };
    const a = Math.atan2(dy, dx);
    return { x: b.x + Math.cos(a) * b.radius, y: b.y + Math.sin(a) * b.radius, clamped: true };
}

// Unit outward normal — the direction "further out of bounds".
function outward(b, x, y) {
    if (b.poly) {
        const n = nearestOnPoly(x, y, b.poly);
        let ox = x - n.x, oy = y - n.y;
        const l = Math.hypot(ox, oy);
        if (l > 1e-6) {
            // Outside: away from the nearest edge point. Inside: the same direction
            // reversed, since the nearest point IS the way out.
            const s = pointInPoly(x, y, b.poly) ? -1 : 1;
            return { x: (ox / l) * s, y: (oy / l) * s };
        }
        const a = b.poly[n.i], c = b.poly[(n.i + 1) % b.poly.length];
        const ex = c[0] - a[0], ey = c[1] - a[1];
        const el = Math.hypot(ex, ey) || 1;
        return { x: ey / el, y: -ex / el };
    }
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
}

// Sample a point inside the arena.
//
// ⚠️ The circle path makes EXACTLY two rng() draws, angle then distance, in that
// order, using the same `Math.sqrt(rng()) * r` trick as before. That is not
// stylistic: it is fixed-cost, whereas rejection sampling consumes a variable
// number of draws. Changing how many draws a placement consumes shifts the stream
// and moves every generated venue, eval anchor included — a behaviour change
// disguised as a geometry change. So generated venues keep the analytic path
// bit-for-bit, and only polygon arenas rejection-sample.
function sample(b, rng, inset) {
    inset = inset || 0;
    if (b.poly) {
        const e = extent(b);
        for (let i = 0; i < 80; i++) {
            const x = e.minX + rng() * (e.maxX - e.minX);
            const y = e.minY + rng() * (e.maxY - e.minY);
            if (contains(b, x, y, inset)) return { x, y };
        }
        // Degenerate arena (inset larger than the shape). Fall back to the centroid
        // so callers get a valid point; they all re-test it anyway.
        let cx = 0, cy = 0;
        for (const p of b.poly) { cx += p[0]; cy += p[1]; }
        return { x: cx / b.poly.length, y: cy / b.poly.length };
    }
    const ang = rng() * Math.PI * 2;
    const dst = Math.sqrt(rng()) * (b.radius - inset);
    return { x: b.x + Math.sin(ang) * dst, y: b.y - Math.cos(ang) * dst };
}

// A point on the rim, `inset` in from the edge, in the compass direction `ang`
// (heading convention: forward = (sin, -cos)). Used to recycle drifted ice back to
// the windward edge.
function rimPoint(b, ang, inset) {
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    if (b.poly) {
        let cx = 0, cy = 0;
        for (const p of b.poly) { cx += p[0]; cy += p[1]; }
        cx /= b.poly.length; cy /= b.poly.length;
        const t = rayHit(b, cx, cy, dx, dy);
        const reach = Math.max(0, (t === null ? b.radius : t) - (inset || 0));
        return { x: cx + dx * reach, y: cy + dy * reach };
    }
    const rr = b.radius - (inset || 0);
    return { x: b.x + dx * rr, y: b.y + dy * rr };
}

// Distance along a ray to the arena edge, or null if it never leaves. Replaces
// rayCircleIntersection for layline clipping.
function rayHit(b, ox, oy, dx, dy) {
    if (b.poly) {
        let best = null;
        for (let i = 0; i < b.poly.length; i++) {
            const a = b.poly[i], c = b.poly[(i + 1) % b.poly.length];
            const ex = c[0] - a[0], ey = c[1] - a[1];
            const den = dx * ey - dy * ex;
            if (Math.abs(den) < 1e-12) continue;                 // parallel
            const t = ((a[0] - ox) * ey - (a[1] - oy) * ex) / den;   // along the ray
            const u = ((a[0] - ox) * dy - (a[1] - oy) * dx) / den;   // along the edge
            if (t > 0 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
        }
        return best;
    }
    // Analytic circle, matching the retired rayCircleIntersection.
    const fx = ox - b.x, fy = oy - b.y;
    const A = dx * dx + dy * dy;
    const B = 2 * (fx * dx + fy * dy);
    const C = fx * fx + fy * fy - b.radius * b.radius;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t1 = (-B - s) / (2 * A), t2 = (-B + s) / (2 * A);
    if (t1 > 0) return t1;
    if (t2 > 0) return t2;
    return null;
}

// Build a rectangle polygon — the drawing tool a painted square map wants.
const rectPoly = (cx, cy, halfW, halfH) => ([
    [cx - halfW, cy - halfH], [cx + halfW, cy - halfH],
    [cx + halfW, cy + halfH], [cx - halfW, cy + halfH]
]);

// Bounding circle of a polygon, for the `radius` field that stays populated so any
// unmigrated site degrades to a loose limit instead of undefined.
function boundingCircle(poly) {
    let cx = 0, cy = 0;
    for (const p of poly) { cx += p[0]; cy += p[1]; }
    cx /= poly.length; cy /= poly.length;
    let r = 0;
    for (const p of poly) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy));
    return { x: cx, y: cy, r };
}

window.Arena = {
    extent, contains, signedDist, clamp, outward, sample, rimPoint, rayHit,
    rectPoly, boundingCircle, pointInPoly, nearestOnPoly
};
})();
