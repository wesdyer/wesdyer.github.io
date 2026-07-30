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
function buildGrid(land, arena, obstacles) {
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
function roundingArc(grid, mark) {
    const rIn = Math.min(mark.zone * 0.92, Math.max(mark.radius + CLEARANCE + 8, mark.radius * 1.12));
    const N = 72;                                        // 5 degree steps
    const ok = [];
    for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2;
        const [i, j] = grid.cell(mark.x + Math.cos(a) * rIn, mark.y + Math.sin(a) * rIn);
        ok.push(grid.at(i, j) ? 1 : 0);
    }
    let best = 0, run = 0;
    for (let k = 0; k < N * 2; k++) { run = ok[k % N] ? run + 1 : 0; if (run > best) best = run; }
    return { arcDeg: Math.round(Math.min(best, N) / N * 360), radius: Math.round(rIn),
             openFrac: ok.reduce((a, b) => a + b, 0) / N };
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
            // Enter on a bearing whose whole sweep is open, then go round the correct
            // way in small steps. 200 degrees, so the engine's 160 is comfortably met
            // even if entry and exit are a little wide.
            let bestStart = 0, bestRun = -1;
            const N = 72;
            for (let s0 = 0; s0 < N; s0++) {
                let run = 0;
                while (run < N) {
                    const a = ((s0 + run * sgn + N * 4) % N) / N * Math.PI * 2;
                    const [i, j] = grid.cell(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r);
                    if (!grid.at(i, j)) break;
                    run++;
                }
                if (run > bestRun) { bestRun = run; bestStart = s0; }
            }
            // Approach from OUTSIDE the zone, radially, on the bearing the arc starts
            // at. Sweep accumulates from the moment the zone is entered, so a path that
            // curls the wrong way round the mark on the way in banks negative credit
            // the rounding then has to undo. That is a real requirement of the
            // mechanic, not a quirk — so the ideal path has to respect it.
            const a0 = ((bestStart + N * 4) % N) / N * Math.PI * 2;
            const rOut = m.zone * 1.35;
            push(m.x + Math.cos(a0) * rOut, m.y + Math.sin(a0) * rOut, `approach${li}`);

            const steps = Math.min(bestRun, 44);           // 44 * 5deg = 220 degrees
            for (let k = 0; k <= steps; k++) {
                const a = ((bestStart + k * sgn + N * 4) % N) / N * Math.PI * 2;
                push(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, `round${li}`);
            }
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

window.SailCheck = {
    HULL_R, CLEARANCE, RES,
    buildGrid, pathBetween, nearestNav, roundingArc, routeWaypoints,
    legVMG, routeEstimate
};
})();
