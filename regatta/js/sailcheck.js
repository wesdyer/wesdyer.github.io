// SAILABILITY — does the course MECHANICALLY work for a player who sails it right?
//
// Not a question about the AI, and not a question about wind: by tacking, any bearing
// is reachable, so "can a boat get there" is almost always yes and tells you nothing.
//
// The questions that DO bite:
//   - does a gate REGISTER when you cross it, in the direction the route asks for?
//   - does a rounding register when you go round the mark the correct way?
//   - is there room to get all the way round, at hull width?
//   - does the hull get trapped — grounding, or pinned against the arena edge?
//
// So this drives a boat along a CORRECT path (best-case decisions, by construction)
// and checks the course recognises it. A failure here is the course or the leg engine,
// never navigation.
(function () {

const HULL_R = 30;                     // matches script.js
const CLEARANCE = HULL_R + 14;         // half a hull plus a margin to pass at all
const RES = 50;                        // grid cell, world units

function pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
}
function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

// ── Navigable grid, at hull width ───────────────────────────────────────────
// A gap narrower than a hull simply is not there. That is the difference between this
// and the plain flood fill in venuecheck, which happily reported Glacier Sound
// navigable through channels a boat cannot fit down.
// ── Grid cache ──────────────────────────────────────────────────────────────
// Rasterising the grid walks every cell against every shape edge — hundreds of
// milliseconds on a big venue — and one editor commit asks for the same grid several
// times (the compile's stats path, the course path build, the estimate). The inputs
// are pure geometry, so a cheap content FINGERPRINT (counts + coordinate sums, which
// any real edit perturbs) keys a small cache. Entries are shared, not cloned: every
// consumer treats `nav` as read-only, and the fields some attach (_leeW, _wbin,
// _timeCost) are keyed caches in their own right.
const _gridCache = [];   // [{ key, grid }], most recent last, max 3
function _gridKey(land, arena, obstacles) {
    let h = 0, n = 0;
    const add = (v) => { h += v * (++n * 0.6180339887 % 1 + 1); };
    for (const l of (land || [])) {
        for (const ring of [l.outer].concat(l.holes || [])) {
            add(ring.length);
            for (const p of ring) { add(p[0]); add(p[1]); }
        }
    }
    if (arena) {
        if (arena.poly) for (const p of arena.poly) { add(p[0]); add(p[1]); }
        else { add(arena.x || 0); add(arena.y || 0); add(arena.radius || 0); }
    }
    for (const o of (obstacles || [])) { add(o.x); add(o.y); add(o.radius || 0); }
    return `${(land || []).length}|${n}|${h}`;
}
function buildGrid(land, arena, obstacles) {
    const key = _gridKey(land, arena, obstacles);
    for (let i = _gridCache.length - 1; i >= 0; i--) {
        if (_gridCache[i].key === key) return _gridCache[i].grid;
    }
    const grid = buildGridRaw(land, arena, obstacles);
    _gridCache.push({ key, grid });
    if (_gridCache.length > 3) _gridCache.shift();
    return grid;
}

function buildGridRaw(land, arena, obstacles) {
    const ex = window.Arena.extent(arena);
    const n = Math.ceil(Math.max(ex.maxX - ex.minX, ex.maxY - ex.minY) / RES) + 1;
    const x0 = ex.minX, y0 = ex.minY;
    const nav = new Uint8Array(n * n);

    const shapes = [];
    for (const l of (land || [])) {
        const rings = [l.outer].concat(l.holes || []);
        let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
        for (const p of l.outer) {
            if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1];
            if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1];
        }
        shapes.push({ rings, outer: l.outer, holes: l.holes || [], bb: { a, b, c, d } });
    }
    // Drifting ice counts: a berg in a channel closes it just as land does.
    const circles = (obstacles || []).map(o => ({ x: o.x, y: o.y, r: o.radius || 0 }));

    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const wx = x0 + (i + 0.5) * RES, wy = y0 + (j + 0.5) * RES;
            if (!window.Arena.contains(arena, wx, wy)) continue;
            let ok = true;
            for (let k = 0; k < shapes.length && ok; k++) {
                const sh = shapes[k], bb = sh.bb;
                if (wx < bb.a - CLEARANCE || wx > bb.c + CLEARANCE
                    || wy < bb.b - CLEARANCE || wy > bb.d + CLEARANCE) continue;
                if (pointInRing(wx, wy, sh.outer) && !sh.holes.some(h => pointInRing(wx, wy, h))) { ok = false; break; }
                for (const ring of sh.rings) {
                    for (let e = 0; e < ring.length; e++) {
                        if (segDist(wx, wy, ring[e], ring[(e + 1) % ring.length]) < CLEARANCE) { ok = false; break; }
                    }
                    if (!ok) break;
                }
            }
            if (ok) for (const c of circles) {
                if ((wx - c.x) ** 2 + (wy - c.y) ** 2 < (c.r + CLEARANCE) ** 2) { ok = false; break; }
            }
            if (ok) nav[j * n + i] = 1;
        }
    }
    return { n, x0, y0, res: RES, nav,
             cell: (wx, wy) => [Math.floor((wx - x0) / RES), Math.floor((wy - y0) / RES)],
             world: (i, j) => [x0 + (i + 0.5) * RES, y0 + (j + 0.5) * RES],
             at: (i, j) => (i < 0 || j < 0 || i >= n || j >= n) ? 0 : nav[j * n + i] };
}

// ── STAMPING THE ICE ONTO A GRID THAT ALREADY KNOWS THE LAND ────────────────
// The bots' floe map is `static land AND NOT under ice`, and the land half of that
// never changes. Rebuilding the whole grid to find out where the ice is re-tests all
// 36100 cells against every land shape to re-derive an answer that was already on
// disk — 55 ms, which was affordable at one rebuild every 16.7 s and is a visible
// three-frame hitch at one every 2. Ice covers a few thousand cells, so stamp those.
//
// ⚠️ THIS AGREES WITH buildGrid EXACTLY, and it has to: the same point-in-ring test,
// the same CLEARANCE edge distance, the same bounding-box slack. A cell already set
// in `base.nav` has passed the arena test and every land test, so
// `stamped = base AND NOT ice` is not an approximation of what buildGrid would say,
// it IS what buildGrid says. (_grid_stamp_check.js asserts that cell for cell across
// a race; a fast answer that is a DIFFERENT answer would be a silent behaviour
// change wearing a performance commit's clothes.)
//
// The bbox bounds round outward on purpose. A cell centre outside `bb ± CLEARANCE`
// is further than CLEARANCE from every ring point in that axis, so testing a few
// extra cells costs a little arithmetic and can never change a verdict.
function stampFloes(base, polys, circles) {
    if (!(polys && polys.length) && !(circles && circles.length)) return base;
    const n = base.n, x0 = base.x0, y0 = base.y0, res = base.res;
    const nav = base.nav.slice();
    const lo = (v) => Math.max(0, Math.floor((v - x0) / res));
    const loY = (v) => Math.max(0, Math.floor((v - y0) / res));
    const hi = (v) => Math.min(n - 1, Math.ceil((v - x0) / res));
    const hiY = (v) => Math.min(n - 1, Math.ceil((v - y0) / res));
    for (const p of (polys || [])) {
        const ring = p.outer;
        if (!ring || ring.length < 3) continue;
        let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
        for (const q of ring) {
            if (q[0] < a) a = q[0]; if (q[1] < b) b = q[1];
            if (q[0] > c) c = q[0]; if (q[1] > d) d = q[1];
        }
        const i0 = lo(a - CLEARANCE), i1 = hi(c + CLEARANCE);
        const j0 = loY(b - CLEARANCE), j1 = hiY(d + CLEARANCE);
        for (let j = j0; j <= j1; j++) {
            const wy = y0 + (j + 0.5) * res;
            for (let i = i0; i <= i1; i++) {
                const id = j * n + i;
                if (!nav[id]) continue;
                const wx = x0 + (i + 0.5) * res;
                if (pointInRing(wx, wy, ring)) { nav[id] = 0; continue; }
                for (let e = 0; e < ring.length; e++) {
                    if (segDist(wx, wy, ring[e], ring[(e + 1) % ring.length]) < CLEARANCE) { nav[id] = 0; break; }
                }
            }
        }
    }
    for (const o of (circles || [])) {
        const R = (o.radius || 0) + CLEARANCE, R2 = R * R;
        const i0 = lo(o.x - R), i1 = hi(o.x + R);
        const j0 = loY(o.y - R), j1 = hiY(o.y + R);
        for (let j = j0; j <= j1; j++) {
            const wy = y0 + (j + 0.5) * res;
            for (let i = i0; i <= i1; i++) {
                const id = j * n + i;
                if (!nav[id]) continue;
                const wx = x0 + (i + 0.5) * res;
                if ((wx - o.x) ** 2 + (wy - o.y) ** 2 < R2) nav[id] = 0;
            }
        }
    }
    return { n, x0, y0, res, nav,
             cell: (wx, wy) => [Math.floor((wx - x0) / res), Math.floor((wy - y0) / res)],
             world: (i, j) => [x0 + (i + 0.5) * res, y0 + (j + 0.5) * res],
             at: (i, j) => (i < 0 || j < 0 || i >= n || j >= n) ? 0 : nav[j * n + i] };
}

const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

// Nearest navigable cell to a point, so a waypoint that lands just inside land or just
// outside the arena still yields a usable path endpoint.
function nearestNav(grid, wx, wy, maxR) {
    const [ci, cj] = grid.cell(wx, wy);
    if (grid.at(ci, cj)) return [ci, cj];
    const span = Math.ceil((maxR || 900) / grid.res);
    for (let r = 1; r <= span; r++) {
        for (let dj = -r; dj <= r; dj++) {
            for (let di = -r; di <= r; di++) {
                if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                if (grid.at(ci + di, cj + dj)) return [ci + di, cj + dj];
            }
        }
    }
    return null;
}

// Shortest hull-width path between two world points, as world waypoints.
function pathBetween(grid, from, to) {
    const s = nearestNav(grid, from[0], from[1]);
    const g = nearestNav(grid, to[0], to[1]);
    if (!s || !g) return null;
    const N = grid.n, prev = new Int32Array(N * N).fill(-1);
    const si = s[1] * N + s[0], gi = g[1] * N + g[0];
    prev[si] = si;
    const q = [si];
    let head = 0;
    while (head < q.length) {
        const cur = q[head++];
        if (cur === gi) break;
        const ci = cur % N, cj = (cur - ci) / N;
        for (const [di, dj] of NB) {
            const a = ci + di, b = cj + dj;
            if (!grid.at(a, b)) continue;
            // A diagonal must not cut a corner a hull could not pass.
            if (di && dj && (!grid.at(ci + di, cj) || !grid.at(ci, cj + dj))) continue;
            const nid = b * N + a;
            if (prev[nid] !== -1) continue;
            prev[nid] = cur;
            q.push(nid);
        }
    }
    if (prev[gi] === -1) return null;
    const out = [];
    let cur = gi;
    while (cur !== si) { const ci = cur % N; out.push(grid.world(ci, (cur - ci) / N)); cur = prev[cur]; }
    out.push(grid.world(s[0], s[1]));
    out.reverse();
    return out;
}

// ── Room to get all the way round a mark ────────────────────────────────────
// A reachable mark is not a roundable mark. This samples the whole way round at hull
// width — the check that would have caught the granite island sitting 43u from the
// coast: perfectly reachable, and impossible to get round.
// ⚠️ THE RADIUS IS SEARCHED, NOT ASSUMED. `mark.radius` is the mark's NOMINAL size — the
// buoy — and says nothing about what it is planted on. Glacier Sound's mark is an island
// of radius 405; Bluewater's is a seamount. A single circle at `radius + clearance` then
// sits INSIDE the land and reports zero degrees of water, which reads as "this mark cannot
// be rounded" when the truth is "you asked at the wrong radius". Same defect, same fix, as
// `CoursePath._roundR` in the planner: step outward and take the tightest circle that is
// all water, and if none is, report the widest opening found and the radius it was at.
function roundingArc(grid, mark) {
    const N = 72;                                        // 5 degree steps
    const rMin = Math.max(mark.radius + CLEARANCE + 8, mark.radius * 1.12);
    const rMax = Math.max(rMin, mark.zone * 0.92);
    const scan = (R) => {
        const ok = [];
        for (let k = 0; k < N; k++) {
            const a = (k / N) * Math.PI * 2;
            const [i, j] = grid.cell(mark.x + Math.cos(a) * R, mark.y + Math.sin(a) * R);
            ok.push(grid.at(i, j) ? 1 : 0);
        }
        let best = 0, run = 0;
        for (let k = 0; k < N * 2; k++) { run = ok[k % N] ? run + 1 : 0; if (run > best) best = run; }
        return { arcDeg: Math.round(Math.min(best, N) / N * 360), radius: Math.round(R),
                 openFrac: ok.reduce((a, b) => a + b, 0) / N };
    };
    let bestSoFar = null;
    // 24 rungs is one every ~35 units on a 851-unit zone: fine enough that a channel is
    // not stepped over, cheap enough to run per mark at authoring time.
    const rungs = 24;
    for (let s = 0; s <= rungs; s++) {
        const R = rMin + (rMax - rMin) * (s / rungs);
        const r = scan(R);
        if (r.openFrac === 1) return r;                  // all water: done, and tightest
        if (!bestSoFar || r.arcDeg > bestSoFar.arcDeg) bestSoFar = r;
    }
    return bestSoFar;
}

// ── The ideal path through a route ──────────────────────────────────────────
// Waypoints a correct sailor would hit, in order. This encodes what each leg REQUIRES,
// which is the same information the leg engine tests for — so if the two disagree, one
// of them is wrong, and that is exactly what we want to find out.
function routeWaypoints(marks, route, grid) {
    const wps = [];
    const push = (x, y, tag) => wps.push({ x, y, tag });

    for (let li = 0; li < route.length; li++) {
        const e = route[li];
        if (e.kind === 'round' && e.mark) {
            const m = e.mark;
            const arc = roundingArc(grid, m);
            const r = arc.radius;
            const sgn = (m.side === 'port') ? -1 : 1;
            // ⚠️ TANGENT IN, REQUIRED ARC, TANGENT OUT — the shape the engine's own
            // requirement is derived from (`CoursePath.requiredSweep` measures exactly
            // this arc), so checker and engine agree by construction instead of by two
            // similar-looking formulas.
            //
            // What was here before did two things wrong and they compounded:
            //
            //   1. it swept a FLAT 220 degrees (`min(bestRun, 44)` at 5 a step), which
            //      is less than four of the eleven authored rounding legs require;
            //   2. it entered RADIALLY on whichever bearing had the most open water,
            //      ignoring where the boat was coming from. Sweep accumulates for the
            //      whole leg, so an approach that curls the wrong way round the mark
            //      banks NEGATIVE winding the rounding then has to undo. Measured on
            //      Lighthouse Cove leg 3: -84 degrees banked on the way in against a
            //      183-degree requirement, so 220 degrees of arc delivered 136 and the
            //      leg never registered. On Bluewater the net ranged -113..+8.
            //
            // The tangent entry cannot do that: approaching along the tangent line winds
            // the SAME way as the rounding, by construction, so the whole leg's winding
            // is the arc plus two positive contributions.
            const prev = wps.length ? wps[wps.length - 1] : null;
            const P = prev || CoursePath.anchor(route[li - 1], marks) || { x: m.x - 1000, y: m.y };
            const Q = CoursePath.anchor(route[li + 1], marks) || P;
            const tang = (p, entering) => {
                const dx = p.x - m.x, dy = p.y - m.y;
                const d = Math.hypot(dx, dy), base = Math.atan2(dy, dx);
                if (!(d > r + 1)) return base;
                const beta = Math.acos(Math.max(-1, Math.min(1, r / d)));
                return base + (entering ? sgn * beta : -sgn * beta);
            };
            const a0 = tang(P, true), a1 = tang(Q, false);
            let sweep = (a1 - a0) * sgn;
            while (sweep < 0) sweep += Math.PI * 2;
            while (sweep > Math.PI * 2) sweep -= Math.PI * 2;
            // A tangent arc of nothing is a pass-by so close to collinear that the two
            // legs lie on one line. The engine treats that as a full circuit (the
            // `sweep < 0.2` guard in `requiredSweep`), so the ideal path does too — the
            // point of this function is to sail what the engine asks for.
            if (sweep < 0.2) sweep = Math.PI * 2;

            // Run in far enough outside the zone that the leg before this one has
            // registered its departure before this one starts.
            const lead = Math.max(m.zone * 1.35, r * 1.6);
            const T = (a) => [m.x + Math.cos(a) * r, m.y + Math.sin(a) * r];
            // Travel direction along the circle at bearing `a`: d/da of (cos a, sin a),
            // taken in the rounding's own sense.
            const dir = (a) => [-Math.sin(a) * sgn, Math.cos(a) * sgn];
            const [t0x, t0y] = T(a0), [d0x, d0y] = dir(a0);
            push(t0x - d0x * lead, t0y - d0y * lead, `approach${li}`);

            const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 36)));   // <= 5 deg
            for (let k = 0; k <= steps; k++) {
                const a = a0 + sgn * sweep * (k / steps);
                push(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, `round${li}`);
            }
            const [t1x, t1y] = T(a1), [d1x, d1y] = dir(a1);
            push(t1x + d1x * lead, t1y + d1y * lead, `exit${li}`);
            continue;
        }
        if (!e.marks) continue;
        const a = marks[e.marks[0]], b = marks[e.marks[1]];
        if (!a || !b) continue;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const ds = e.dir || 1;
        let nx = (b.y - a.y) * ds, ny = -(b.x - a.x) * ds;
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        // Approach from the near side, cross, and come out the far side.
        push(mx - nx * 300, my - ny * 300, `pre${li}`);
        push(mx + nx * 300, my + ny * 300, `cross${li}`);

        const isGate = e.role !== 'start' && !e.finish;
        if (isGate) {
            // A gate leg completes by leaving round an END, so the path must go past
            // one and come back across its extension. Which end is a free choice — take
            // whichever side has water.
            const ux = (b.x - a.x) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
            const uy = (b.y - a.y) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
            for (const [end, sgn2] of [[a, -1], [b, 1]]) {
                const ox = end.x + ux * sgn2 * 260, oy = end.y + uy * sgn2 * 260;
                const p1 = grid.cell(ox + nx * 260, oy + ny * 260);
                const p2 = grid.cell(ox - nx * 260, oy - ny * 260);
                if (grid.at(p1[0], p1[1]) && grid.at(p2[0], p2[1])) {
                    push(ox + nx * 260, oy + ny * 260, `end${li}`);
                    push(ox - nx * 260, oy - ny * 260, `exit${li}`);
                    break;
                }
            }
        }
    }
    return wps;
}

// ── How long the course actually takes ──────────────────────────────────────
//
// The old answer was `legs × legLength × 0.1875 s/m`, later `mark-to-mark × 1.45 if the
// leg nets upwind`. Both are wrong in the same two ways: they measure the straight line
// through whatever land is in the way, and they treat every leg as equally fast.
//
// So this measures the DISTANCE a boat can actually sail — the hull-width path, the same
// grid the sailability check uses — and prices each leg with the game's own J111 polar:
// the best VMG toward the leg's bearing, maximised over true wind angle, which is what
// tacking upwind or gybing downwind actually is.
//
// Knots become world units per second from two facts in script.js, not from a fudge:
// `boat.speed` is units per FRAME at 60 fps, and `boatKnots = boat.speed * 4`. So
// units/s = (knots / 4) * 60 = knots * 15. (The game's world is therefore about 5.8x
// faster than reality relative to its distances, which is a game-feel decision — but it
// is the decision the boats actually sail under, so it is the one to estimate with.)
//
// What it deliberately does NOT model: manoeuvre losses (a tack costs a boat length or
// two), traffic, or a fleet's spread. It is a floor — the time a well-sailed boat needs
// with nothing in its way — which is exactly what a time limit should be derived from.
function legVMG(legDir, windDir, windSpeed) {
    if (typeof getTargetSpeed !== 'function') return null;
    // TWA the leg asks for: the angle between where you want to go and where the wind
    // comes from. windDir points dead upwind, per the game's convention.
    let twaCourse = Math.abs(((legDir - windDir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    let best = 0;
    // 2-degree steps: fine enough that the peak is not missed, cheap enough to run per leg.
    for (let d = 0; d <= 180; d += 2) {
        const twa = d * Math.PI / 180;
        const spin = d > 90;
        const s = getTargetSpeed(twa, spin, windSpeed);
        const vmg = s * Math.cos(twa - twaCourse);
        if (vmg > best) best = vmg;
    }
    return { vmg: best, twaCourse };
}

function routeEstimate(grid, marks, route, windDir, windSpeed, windAt) {
    // The waypoints a correct sailor hits, then the distance between them: this is the
    // same ideal path the sailability check drives a boat along, so what gets priced is a
    // distance that has been proven sailable.
    const wps = routeWaypoints(marks, route, grid);
    const legOf = (tag) => { const m = /(\d+)$/.exec(tag || ''); return m ? +m[1] : 0; };

    // Knots to world units per second, from two facts in script.js rather than a fudge:
    // `boat.speed` is units per FRAME at 60 fps and `boatKnots = boat.speed * 4`, so
    // units/s = (knots / 4) * 60 = knots * 15.
    const U_PER_S_PER_KNOT = 15;
    const REF = (typeof getTargetSpeed === 'function')
        ? getTargetSpeed(Math.PI / 2, false, windSpeed) : 0;   // beam reach, jib, for scale

    // Pathfinding exists to route AROUND land, not to measure short steps. A grid path
    // snaps to cell centres, so asking it for a 70-unit hop along a rounding arc reports
    // up to 40% more than the hop is — and an arc is 44 of those hops. Anything shorter
    // than a few cells is measured straight, which is what it is: open water the arc
    // search already confirmed.
    const DIRECT = grid.res * 5;

    // Each HOP is priced by its own bearing. That matters: a leg does not have one point
    // of sail. Beating out to a mark and then sweeping round it are different work, and a
    // single bearing taken end-to-end priced the arctic beat as a broad reach because the
    // rounding arc left the boat on the far side of the island.
    const per = {};
    let calm = 0;               // path length through water with no wind over it
    let prev = null;
    for (const wp of wps) {
        if (prev) {
            const straight = Math.hypot(wp.x - prev.x, wp.y - prev.y);
            let d = straight;
            if (straight > DIRECT) {
                const seg = pathBetween(grid, [prev.x, prev.y], [wp.x, wp.y]);
                if (seg) {
                    let L = 0;
                    for (let i = 1; i < seg.length; i++) L += Math.hypot(seg[i][0] - seg[i-1][0], seg[i][1] - seg[i-1][1]);
                    // A grid path is never shorter than the straight line, and its
                    // stair-stepping overstates a clear run — so take the straight line
                    // when the detour it found is negligible.
                    d = (L > straight * 1.08) ? L : straight;
                }
            }
            const bearing = Math.atan2(wp.x - prev.x, -(wp.y - prev.y));
            // The wind WHERE THE BOAT IS, sampled at the middle of the hop. A course whose
            // wind varies across it cannot be priced with one number, and a hop through a
            // patch nobody put a region over cannot be sailed at all.
            const local = windAt
                ? windAt((prev.x + wp.x) / 2, (prev.y + wp.y) / 2)
                : { direction: windDir, speed: windSpeed };
            if (!local || local.speed < 0.5) { calm += d; prev = wp; continue; }
            const v = legVMG(bearing, local.direction, local.speed);
            const secs = (v && v.vmg > 0.2)
                ? d / (v.vmg * U_PER_S_PER_KNOT)
                : d / (REF > 0 ? REF * U_PER_S_PER_KNOT : 30);
            // Sailing TOWARD a waypoint is the work of the leg that waypoint belongs to.
            const li = legOf(wp.tag);
            const e = per[li] || (per[li] = { dist: 0, secs: 0, twaSum: 0 });
            e.dist += d; e.secs += secs;
            if (v) e.twaSum += v.twaCourse * d;          // distance-weighted, for reporting
        }
        prev = wp;
    }

    let total = 0, slowest = null;
    const out = [];
    for (const k of Object.keys(per).map(Number).sort((a, b) => a - b)) {
        const L = per[k];
        total += L.secs;
        const rec = { leg: k, dist: L.dist, secs: L.secs,
                      twaDeg: L.dist > 0 ? Math.round((L.twaSum / L.dist) * 180 / Math.PI) : null,
                      vmg: L.secs > 0 ? (L.dist / L.secs) / U_PER_S_PER_KNOT : null };
        out.push(rec);
        if (!slowest || rec.secs > slowest.secs) slowest = rec;
    }
    return { legs: out, dist: out.reduce((a, l) => a + l.dist, 0) + calm, secs: total, slowest,
             // Distance the boat cannot cover at all, because there is no wind there. A
             // course with any of this is unsailable, however good the rest of it is.
             calm, refKnots: REF, windDir, windSpeed };
}

// ── Clearance-weighted routing, for a boat that actually has to SAIL the path ──
// `pathBetween` answers "does a hull fit" — its shortest path legitimately shaves
// every corner at hull width and runs the length of walls. A boat under sail in a
// breeze cannot hold a 44-unit offset line: it tacks, it heels, it gets set down.
// So the AI routes on the same grid with a soft cost for water near the edges —
// mid-channel when there is a channel, hull-width only when there is nothing else.

// Chebyshev distance (in cells) from every navigable cell to the nearest blocked
// one, by multi-source BFS. Blocked includes outside-the-arena, so the boundary
// wall repels exactly like land does.
function clearanceField(grid) {
    const N = grid.n, size = N * N;
    const dist = new Int16Array(size).fill(-1);
    let q = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const id = j * N + i;
        if (!grid.nav[id]) { dist[id] = 0; q.push(id); }
    }
    let d = 0;
    while (q.length) {
        const next = [];
        d++;
        for (const cur of q) {
            const ci = cur % N, cj = (cur - ci) / N;
            for (const [di, dj] of NB) {
                const a = ci + di, b = cj + dj;
                if (a < 0 || b < 0 || a >= N || b >= N) continue;
                const nid = b * N + a;
                if (dist[nid] !== -1) continue;
                dist[nid] = d;
                next.push(nid);
            }
        }
        q = next;
    }
    return dist;
}

// ── TIME-COST TABLE ─────────────────────────────────────────────────────────
// What the sailing-routing literature actually optimizes is TIME, not distance:
// each step is priced by the best speed the polar can make TOWARD that bearing in
// that cell's wind (which is VMG when the bearing is upwind — tacking prices
// itself). 16 wind-direction bins x 6 speed bins x 8 step directions, built once
// from getTargetSpeed the first time a route is asked for.
let _tfTab = null, _tfMin = 1, _lossTab = null;
// Seconds a tack costs against polar speed, MEASURED (_vmgeff_probe: short-tacking
// VMG in a corridor of width W is VMG_free · W/(W+K), K = TACK_SEC·v·sinδ·15 ≈ 70u
// at 13 kt; the same probe puts the free-water run on the polar to within 1.5%).
const TACK_SEC = 1.0;
function buildTimeCost() {
    const gts = (typeof window !== 'undefined') && window.getTargetSpeed;
    if (!gts) return null;
    const SPDS = [8, 12, 16, 20, 25, 30];
    const tab = new Float32Array(16 * 6 * 8);
    const loss = new Float32Array(16 * 6 * 8);
    let lo = Infinity;
    for (let d = 0; d < 16; d++) {
        const wd = d * Math.PI * 2 / 16;
        for (let s = 0; s < SPDS.length; s++) {
            const ws = SPDS[s];
            for (let k = 0; k < 8; k++) {
                const bearing = Math.atan2(NB[k][0], -NB[k][1]);
                let best = 0.5, bestV = 0, bestDelta = 0;
                for (let twa = 25; twa <= 180; twa += 5) {
                    const tr = twa * Math.PI / 180;
                    const v = gts(tr, twa > 95, ws);
                    for (const sgn of [1, -1]) {
                        const toward = Math.cos((wd + sgn * tr) - bearing) * v;
                        if (toward > best) { best = toward; bestV = v; bestDelta = (wd + sgn * tr) - bearing; }
                    }
                }
                const tf = Math.min(4, Math.max(0.6, 10 / best));   // "time per unit", 10kt reference
                tab[(d * 6 + s) * 8 + k] = tf;
                // Corridor loss, in units: making good along a bearing whose best
                // heading is δ off it means a tack every board, and each tack throws
                // away TACK_SEC of polar speed's cross-corridor component. Zero when
                // the bearing is directly sailable — the term scopes itself to the
                // no-go cone (and prices corridor gybing mildly).
                loss[(d * 6 + s) * 8 + k] = TACK_SEC * bestV * 15 * Math.abs(Math.sin(bestDelta));
                if (tf < lo) lo = tf;
            }
        }
    }
    _tfMin = lo;
    _lossTab = loss;
    return tab;
}

// A* over the grid where a step near the edge costs extra. PAD is how many cells of
// clearance stop mattering; the penalty at the wall multiplies a step, decaying
// linearly to 1 at PAD. When the course build supplied per-cell wind (_wbin), the
// BASE cost of a step is sailing time from the polar rather than distance.
function pathSailable(grid, from, to) {
    if (!grid._clear) grid._clear = clearanceField(grid);
    const clear = grid._clear;
    // Strong preference for wide water. A boat beats and makes leeway: a 300-unit
    // channel costs it constant contact, so narrow water has to price like the
    // detour it really is. At PAD 8 a wall-adjacent step costs 7x — a 300u-wide
    // channel (all cells ≤3 clear) runs ~4-5x, so a parallel channel twice as far
    // but wide still wins.
    const PAD = 8, EDGE_W = 6.0;
    // Endpoint snapping accepts SOFT (floe-plugged) cells: a goal inside drifting
    // ice is a real goal — snapping it to the nearest hard-open water relocated
    // every zone-interior target OUTSIDE the pack ring, and no rounding could
    // ever be aimed at, let alone armed.
    const okCell = (i, j) => {
        if (grid.at(i, j)) return true;
        if (!grid._soft || i < 0 || j < 0 || i >= grid.n || j >= grid.n) return false;
        return grid._soft[j * grid.n + i] > 0;
    };
    const snap = (wx, wy) => {
        const [ci, cj] = grid.cell(wx, wy);
        if (okCell(ci, cj)) return [ci, cj];
        for (let r = 1; r <= 18; r++) {
            for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
                if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                if (okCell(ci + di, cj + dj)) return [ci + di, cj + dj];
            }
        }
        return null;
    };
    const s = snap(from[0], from[1]);
    const g = snap(to[0], to[1]);
    if (!s || !g) return null;
    const N = grid.n, size = N * N;
    // Float64, and improvements must clear an epsilon: storing float64 candidates
    // into a float32 table let two cells "improve" each other by rounding noise
    // forever — an unbounded heap and a 4GB OOM in about a minute.
    const gScore = new Float64Array(size).fill(Infinity);
    const prev = new Int32Array(size).fill(-1);
    const si = s[1] * N + s[0], gi = g[1] * N + g[0];
    // Binary heap of [f, id]
    const heap = [];
    const push = (f, id) => {
        heap.push([f, id]);
        let k = heap.length - 1;
        while (k > 0) {
            const p = (k - 1) >> 1;
            if (heap[p][0] <= heap[k][0]) break;
            const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p;
        }
    };
    const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            let k = 0;
            for (;;) {
                const l = 2 * k + 1, r = l + 1;
                let m = k;
                if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                if (m === k) break;
                const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m;
            }
        }
        return top;
    };
    if (_tfTab === null && grid._wbin) _tfTab = buildTimeCost();
    const TF = grid._wbin ? _tfTab : null;
    const wbin = grid._wbin;
    const gx = gi % N, gy = (gi - gx) / N;
    // Admissible with time-costs: no step is cheaper than the fastest point of
    // sail in the strongest wind on the table.
    const hMul = TF ? _tfMin : 1;
    const h = (id) => {
        const ci = id % N, cj = (id - ci) / N;
        return Math.hypot(ci - gx, cj - gy) * hMul;
    };
    gScore[si] = 0;
    push(h(si), si);
    while (heap.length) {
        const [f, cur] = pop();
        if (cur === gi) break;
        const ci = cur % N, cj = (cur - ci) / N;
        if (f - h(cur) > gScore[cur] + 1e-6) continue;   // stale heap entry
        for (let k = 0; k < 8; k++) {
            const di = NB[k][0], dj = NB[k][1];
            const a = ci + di, b = cj + dj;
            // SOFT cells (floe-plugged water, land-free) are passable at a stiff
            // multiplier — grinding through a drifted plug beats waiting minutes
            // for it to open, and this venue is designed around that trade.
            const soft = grid._soft ? (id2) => grid._soft[id2] === 1 : null;
            const passable = (ai, bi) => grid.at(ai, bi) ||
                (soft && ai >= 0 && bi >= 0 && ai < N && bi < N && soft(bi * N + ai));
            if (!passable(a, b)) continue;
            if (di && dj && (!passable(ci + di, cj) || !passable(ci, cj + dj))) continue;
            const nid = b * N + a;
            const isSoft = !grid.at(a, b);
            const c = clear[nid];
            // BASE COST IS SAILING TIME when the wind table exists: the polar's best
            // speed toward this step's bearing, in this cell's wind. Beating prices
            // itself (VMG), reaches are cheap, and time is a true objective — unlike
            // hint weights it cannot invert the topology.
            let base = TF ? TF[wbin[nid] * 8 + k] : 1;
            // CORRIDOR-AWARE UPWIND COST: in water narrower than PAD cells the best
            // achievable speed toward an unsailable bearing degrades by W/(W+L) —
            // measured, not derived (see buildTimeCost). Gated to c < PAD so open
            // water prices EXACTLY as stock and route choice there cannot churn.
            // Benched 2026-08-05: arctic paired -7/-12 med on two disjoint 16-seed
            // sets (in-race floe corridors are the water this decides); bay 0.0 med;
            // ocean 0.0 med / +3.4 mean, the price of shore-adjacent repricing.
            if (TF && _lossTab && c < PAD) {
                const W = Math.max(60, 2 * c * grid.res);
                base = Math.min(20, base * (1 + _lossTab[wbin[nid] * 8 + k] / W));
            }
            // ⚠️ REMAINING WEIGHTS ARE ROUTE HINTS, NOT WALLS — bounded, so the
            // worst hint-driven detour stays small (the 7x-wall-cost cove loop
            // lives in memory as the cautionary tale).
            const narrow = c >= PAD ? 0 : (PAD - c) / PAD;
            // Softened once the local layers (trajectory planner, graded probes,
            // hull stamps) proved they can execute tighter water — the wide-loop
            // conservatism was costing ~2km per transit against a 420s clock.
            let extra = 1.0 * narrow;                       // stand off walls
            if (grid._leeW) extra += Math.min(0.7, grid._leeW[nid] * 0.28);  // lee shore
            if (grid._floeRisk && grid._floeRisk[nid]) extra += 0.55;        // drifting-ice water
            if (grid._wfx && !TF) {
                const sl = Math.hypot(di, dj);
                const up = (di * grid._wfx[nid] + dj * grid._wfy[nid]) / sl;
                if (up > 0.7) extra += ((up - 0.7) / 0.3) * (0.9 * narrow);
            }
            let w = base * (1 + Math.min(1.2, extra));
            // 1 = opening lead (arrive as it clears), 2 = staying plugged (a grind
            // that is nearly a wall — only worth it against a huge detour).
            if (isSoft) w *= (grid._soft[nid] === 1 ? 2.5 : 6);
            const step = (di && dj ? Math.SQRT2 : 1) * w;
            const cand = gScore[cur] + step;
            if (cand < gScore[nid] - 1e-4) {
                gScore[nid] = cand;
                prev[nid] = cur;
                push(cand + h(nid), nid);
            }
        }
    }
    if (prev[gi] === -1 && gi !== si) return null;
    const out = [];
    let cur = gi;
    while (cur !== si) { const ci = cur % N; out.push(grid.world(ci, (cur - ci) / N)); cur = prev[cur]; }
    out.push(grid.world(s[0], s[1]));
    out.reverse();
    return out;
}

window.SailCheck = {
    HULL_R, CLEARANCE, RES,
    buildGrid, stampFloes, pathBetween, nearestNav, roundingArc, routeWaypoints,
    legVMG, routeEstimate, pathSailable, clearanceField
};
})();
