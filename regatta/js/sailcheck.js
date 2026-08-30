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
// TIGHT-THREAD TIER. The CLEARANCE bar treats worst-case rotation — a hull
// spinning in place — so any slot under 2×CLEARANCE = 88u reads as a wall to
// the grid. A hull threading bow-first can take genuinely narrower water.
// Cells that fail the full bar but pass this one are PASSABLE-TIGHT: a second
// capability tier, marked in `_tight`, that the router may take at a stiff tax
// (pathSailable) and the helm may follow when its plan deliberately threads it.
// They are NOT navigable to anything that doesn't ask — `nav` is unchanged.
//
// ⚠️ THE BAR IS THE MEASURED EXECUTION FRONTIER, NOT HULL GEOMETRY. The lab
// width ladder (Narrow Passage 70u…110u): an 80.6u slot transits 11/11 seeds,
// a 68.6u slot 5/11 — a coin flip is not a capability. And the first bar
// tried here (21u = half a beam + scatter) admitted a ~69u canyon thread on
// redrock that the whole fleet then bought in company: legs 4-5 +18-23 s/boat,
// land contacts +58% pooled — the router promising water the helm can't
// reliably sail is the model-accuracy defect in the other direction. 35u
// admits slots from ~70u up: everything the ladder shows the boat actually
// completes, nothing it measurably can't.
const TIGHT_CLEAR = 35;                // slot >= ~70u — the ladder's frontier
const TIGHT_TAX = 2.5;                 // per-step router tax on tight cells
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
// Exact distance between segment AB and segment PQ (0 when they cross).
function segSegDist(ax, ay, bx, by, p, q) {
    const d1x = bx - ax, d1y = by - ay, d2x = q[0] - p[0], d2y = q[1] - p[1];
    const denom = d1x * d2y - d1y * d2x;
    if (denom !== 0) {
        const t = ((p[0] - ax) * d2y - (p[1] - ay) * d2x) / denom;
        const u = ((p[0] - ax) * d1y - (p[1] - ay) * d1x) / denom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
    }
    return Math.min(
        segDist(ax, ay, p, q), segDist(bx, by, p, q),
        segDist(p[0], p[1], [ax, ay], [bx, by]), segDist(q[0], q[1], [ax, ay], [bx, by]));
}

// ── GEOMETRIC LINE-OF-SIGHT, the admit machinery's own test on a segment ────
// The cell-level LOS walks (`losClear`, planner's `_lineClear`) ask the GRID,
// and the grid's navigable verdict is subsampled: a cell any quarter-offset of
// which clears the bar reads open, so a segment can pass within a few units of
// a corner while every cell under it reads clear — the measured
// chord-clips-corner defect (a genuinely-kinked routed path thrown away for a
// chord that shaves the headland). This asks the SHAPES the grid was built
// from, with the same CLEARANCE bar and exact segment-segment distance, so a
// chord is only "clear" when the admit test itself would admit every point of
// it. Drifting shapes (centerOnly) are excluded — they are not walls to a
// ruler and their motion is priced elsewhere.
function segClearGeom(grid, ax, ay, bx, by, clr) {
    const shapes = grid && grid._shapes;
    if (!shapes) return true;
    const m = (clr == null) ? CLEARANCE : clr;
    const xlo = Math.min(ax, bx), xhi = Math.max(ax, bx);
    const ylo = Math.min(ay, by), yhi = Math.max(ay, by);
    for (const sh of shapes) {
        if (sh.centerOnly) continue;
        const bb = sh.bb;
        if (xhi < bb.a - m || xlo > bb.c + m || yhi < bb.b - m || ylo > bb.d + m) continue;
        if (pointInRing(ax, ay, sh.outer) && !sh.holes.some(h => pointInRing(ax, ay, h))) return false;
        if (pointInRing(bx, by, sh.outer) && !sh.holes.some(h => pointInRing(bx, by, h))) return false;
        for (const ring of sh.rings) {
            for (let e = 0; e < ring.length; e++) {
                if (segSegDist(ax, ay, bx, by, ring[e], ring[(e + 1) % ring.length]) < m) return false;
            }
        }
    }
    return true;
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
function buildGrid(land, arena, obstacles, opts) {
    const key = _gridKey(land, arena, obstacles) + (opts && opts.noSubsample ? '|ns' : '');
    for (let i = _gridCache.length - 1; i >= 0; i--) {
        if (_gridCache[i].key === key) return _gridCache[i].grid;
    }
    const grid = buildGridRaw(land, arena, obstacles, opts);
    _gridCache.push({ key, grid });
    if (_gridCache.length > 3) _gridCache.shift();
    return grid;
}

function buildGridRaw(land, arena, obstacles, opts) {
    const ex = window.Arena.extent(arena);
    const n = Math.ceil(Math.max(ex.maxX - ex.minX, ex.maxY - ex.minY) / RES) + 1;
    const x0 = ex.minX, y0 = ex.minY;
    const nav = new Uint8Array(n * n);
    const tight = new Uint8Array(n * n);   // passable-tight tier, see TIGHT_CLEAR

    const shapes = [];
    for (const l of (land || [])) {
        const rings = [l.outer].concat(l.holes || []);
        let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
        for (const p of l.outer) {
            if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1];
            if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1];
        }
        // `centerOnly` marks a DRIFTING shape (a floe hull passed by a caller
        // that mixes ice into the land list — the stamp-equivalence checker
        // does): those must be judged at the cell CENTRE exactly as stampFloes
        // judges them, or the fast stamp and the full rebuild disagree.
        shapes.push({ rings, outer: l.outer, holes: l.holes || [], bb: { a, b, c, d },
                      centerOnly: !!l.centerOnly });
    }
    // Drifting ice counts: a berg in a channel closes it just as land does.
    const circles = (obstacles || []).map(o => ({ x: o.x, y: o.y, r: o.radius || 0 }));

    const admitShape = (sh, wx, wy, clr) => {
        const bb = sh.bb;
        if (wx < bb.a - clr || wx > bb.c + clr
            || wy < bb.b - clr || wy > bb.d + clr) return true;
        if (pointInRing(wx, wy, sh.outer) && !sh.holes.some(h => pointInRing(wx, wy, h))) return false;
        for (const ring of sh.rings) {
            for (let e = 0; e < ring.length; e++) {
                if (segDist(wx, wy, ring[e], ring[(e + 1) % ring.length]) < clr) return false;
            }
        }
        return true;
    };
    const admit = (wx, wy, clr) => {
        if (!window.Arena.contains(arena, wx, wy)) return false;
        for (let k = 0; k < shapes.length; k++) {
            if (shapes[k].centerOnly) continue;
            if (!admitShape(shapes[k], wx, wy, clr)) return false;
        }
        return true;
    };
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const wx = x0 + (i + 0.5) * RES, wy = y0 + (j + 0.5) * RES;
            // RASTERISATION, NOT SAFETY. A corridor that satisfies the full
            // CLEARANCE bar in continuous space can still miss every cell
            // CENTRE on the 50u lattice — redrock's north channel exit is 46u
            // clear the whole way through and read as a wall, which is why the
            // fleet's route ran the dead-upwind slot the human never sails. A
            // cell is navigable if ANY quarter-offset sub-point passes the
            // SAME land test — the bar does not move, only the sampling.
            // ⚠️ Obstacle CIRCLES (drifting floes at build time) stay a centre
            // test: stampFloes removes cells by centre and must agree with this
            // build cell for cell (_grid_stamp_check.js asserts it).
            // ⚠️ FLOE-FREE GRIDS ONLY (opts.noSubsample set by the caller on icy
            // venues): in drifting ice a sub-cell thread along shore is a trap —
            // floe drift eats exactly the margin the thread lacks — and every
            // arctic horizon/margin constant was priced on centre-sampled land
            // (measured here: arctic land contacts +42%, floe +19% unscoped).
            let ok = admit(wx, wy, CLEARANCE);
            if (!ok && !(opts && opts.noSubsample)) {
                const Q = RES / 4;
                for (const [ox, oy] of [[-Q, -Q], [Q, -Q], [-Q, Q], [Q, Q]]) {
                    if (admit(wx + ox, wy + oy, CLEARANCE)) { ok = true; break; }
                }
            }
            if (ok) for (let k = 0; k < shapes.length; k++) {
                if (shapes[k].centerOnly && !admitShape(shapes[k], wx, wy, CLEARANCE)) { ok = false; break; }
            }
            if (ok) for (const c of circles) {
                if ((wx - c.x) ** 2 + (wy - c.y) ** 2 < (c.r + CLEARANCE) ** 2) { ok = false; break; }
            }
            if (ok) nav[j * n + i] = 1;
            else {
                // TIGHT TIER: the identical admit machinery at the reduced bar,
                // under the same sampling policy (icy venues stay centre-only —
                // sub-cell shore threads under floe drift are the trap the
                // noSubsample gate exists for, and a tight thread is that trap
                // squared, so it inherits the gate rather than relitigating it).
                let tk = admit(wx, wy, TIGHT_CLEAR);
                if (!tk && !(opts && opts.noSubsample)) {
                    // T1 (2026-08-23, owner-approved): the tier admission is a
                    // SUP-over-the-cell question — an exactly-70u slot carries
                    // bar clearance only ON its centerline, so the old 5-point
                    // stencil admitted ~80u+ and the 70-80u frontier failed by
                    // sampling geometry, not by the hull (the ladder's 80.6
                    // pass / 68.6 half-fail brackets it). 5x5 at RES/5 puts a
                    // sample within ~7u of every point of the cell. Bar
                    // untouched; icy venues keep centre-only (noSubsample).
                    const Q5 = RES / 5;
                    outer5:
                    for (let oy5 = -2; oy5 <= 2; oy5++) {
                        for (let ox5 = -2; ox5 <= 2; ox5++) {
                            if (!ox5 && !oy5) continue;
                            if (admit(wx + ox5 * Q5, wy + oy5 * Q5, TIGHT_CLEAR)) { tk = true; break outer5; }
                        }
                    }
                }
                // Drifting shapes (centerOnly) and obstacle circles below block the
                // tight tier at the FULL bar: ice never narrows a passage into the
                // tier, it removes it — and this keeps stampFloes and the rebuild
                // in cell-for-cell agreement (_grid_stamp_check.js).
                if (tk) for (let k = 0; k < shapes.length; k++) {
                    if (shapes[k].centerOnly && !admitShape(shapes[k], wx, wy, CLEARANCE)) { tk = false; break; }
                }
                if (tk) for (const c of circles) {
                    if ((wx - c.x) ** 2 + (wy - c.y) ** 2 < (c.r + CLEARANCE) ** 2) { tk = false; break; }
                }
                if (tk) tight[j * n + i] = 1;
            }
        }
    }
    // ⚠️ THE TIER ONLY EXISTS WHERE IT IS EXCEPTIONAL. A tight thread is a
    // deliberate, occasional shortcut; where reduced-clearance water is a
    // sizable fraction of the venue it is not slots, it is the FABRIC — an
    // archipelago — and admitting it rewrites the whole map with water the
    // helm cannot reliably execute. Measured (Gatorgrass, in-game grid with
    // prop colliders): 1565 tight cells against 14813 navigable (10.6%),
    // plans threading 43% of samples, 58% of blocked-cell frames while
    // threading — med +42 s, land contacts +500%. Every other venue sits at
    // 0.0-5.1%, so ANY threshold in (5.1, 10.6) gives the same partition —
    // this is a venue-class knee on a measured grid property (the curP90 /
    // noSubsample scoping shape), not a tuned knob. Pure geometry, so the
    // grid stays a pure function of its cache key.
    {
        let nT = 0, nN = 0;
        for (let k = 0; k < n * n; k++) { nT += tight[k]; nN += nav[k]; }
        if (nT > nN * 0.08) tight.fill(0);
    }
    return { n, x0, y0, res: RES, nav, _tight: tight, _shapes: shapes,
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
    // The tight tier is FIXED-LAND capability only: a tight cell under (or
    // within full CLEARANCE of) drifting ice is stamped closed exactly like a
    // navigable cell — drifting walls do not keep clear and a thread they
    // pinch is a trap, so ice never narrows a passage into the tight tier,
    // it removes it.
    const tight = base._tight ? base._tight.slice() : null;
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
                if (!nav[id] && !(tight && tight[id])) continue;
                const wx = x0 + (i + 0.5) * res;
                let blk = pointInRing(wx, wy, ring);
                if (!blk) for (let e = 0; e < ring.length; e++) {
                    if (segDist(wx, wy, ring[e], ring[(e + 1) % ring.length]) < CLEARANCE) { blk = true; break; }
                }
                if (blk) { nav[id] = 0; if (tight) tight[id] = 0; }
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
                if (!nav[id] && !(tight && tight[id])) continue;
                const wx = x0 + (i + 0.5) * res;
                if ((wx - o.x) ** 2 + (wy - o.y) ** 2 < R2) { nav[id] = 0; if (tight) tight[id] = 0; }
            }
        }
    }
    return { n, x0, y0, res, nav, _tight: tight, _shapes: base._shapes,
             cell: (wx, wy) => [Math.floor((wx - x0) / res), Math.floor((wy - y0) / res)],
             world: (i, j) => [x0 + (i + 0.5) * res, y0 + (j + 0.5) * res],
             at: (i, j) => (i < 0 || j < 0 || i >= n || j >= n) ? 0 : nav[j * n + i] };
}

const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

// Nearest navigable cell to a point, so a waypoint that lands just inside land or just
// outside the arena still yields a usable path endpoint.
function nearestNav(grid, wx, wy, maxR) { return nearestCell(grid, wx, wy, (i, j) => grid.at(i, j), maxR); }
function nearestCell(grid, wx, wy, at, maxR) {
    const [ci, cj] = grid.cell(wx, wy);
    if (at(ci, cj)) return [ci, cj];
    const span = Math.ceil((maxR || 900) / grid.res);
    for (let r = 1; r <= span; r++) {
        for (let dj = -r; dj <= r; dj++) {
            for (let di = -r; di <= r; di++) {
                if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                if (at(ci + di, cj + dj)) return [ci + di, cj + dj];
            }
        }
    }
    return null;
}

// ── STAIR-STEPPING IS NOT A DETOUR ──────────────────────────────────────────
// An 8-connected BFS can only turn in 45-degree steps, so a clear run comes back up to
// ~8% longer than the straight line it ought to be. That overstatement is real and has to
// be corrected, but the correction used to be a THRESHOLD — take the straight line
// whenever the routed path is within 8% of it — and a threshold cannot tell grid noise
// from a genuine short way round.
//
// Measured on Glowtide Strait: the `pre4` hop found an honest 1823u path around a
// headland, and because that is 1.065x the straight line the estimate discarded it and
// priced 1711u of line that is 40% LAND. Lake had the same failure at 10%. A SHORT detour
// is exactly the case the threshold gets wrong, and because a dragged mark moves a hop
// across 1.08 in either direction, the reported distance also jumps as the route is
// edited instead of tracking it.
//
// String-pulling answers it exactly and needs no magic number. Walk the path, skipping to
// the furthest later point still in clear line of sight; what is left is the taut path a
// boat would actually sail. Stair-stepping disappears because the two ends of a zigzag can
// see each other — on open water the whole path collapses to a single segment and the
// length becomes the straight line EXACTLY, which is what the threshold was reaching for.
// A detour survives untouched, because the headland is what blocks the shortcut.
function losClear(grid, ax, ay, bx, by) {
    // Half a cell, so the walk cannot step over a one-cell neck of land.
    const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / (grid.res * 0.5)));
    for (let k = 0; k <= steps; k++) {
        const c = grid.cell(ax + (bx - ax) * k / steps, ay + (by - ay) * k / steps);
        if (!grid.at(c[0], c[1])) return false;
    }
    return true;
}

// Forward-greedy, so each point is visited once and the cost stays linear in the path —
// this runs per hop on every editor commit, and the from-the-far-end variant is cubic.
function smoothPath(grid, pts) {
    if (!pts || pts.length < 3) return pts || [];
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
        let j = i + 1;
        while (j + 1 < pts.length
               && losClear(grid, pts[i][0], pts[i][1], pts[j + 1][0], pts[j + 1][1])) j++;
        out.push(pts[j]);
        i = j;
    }
    return out;
}

// Shortest hull-width path between two world points, as world waypoints.
// ⚠️ TWO PASSES, FULL CLEARANCE FIRST. `nav` is the hull-plus-margin water, and on a
// narrow venue it can come apart into pieces: River's channel below the start reads as
// land at full CLEARANCE for ~450u, so a BFS from the start gate never reaches the finish
// gate. Its caller (CoursePath._route) took a null here as "no detour needed" and drew
// the chord — leg 3 of River as a 9.8k-unit straight line through the woods, which is
// also what the leaderboard's distance-made-good was measuring against. The tight tier
// is exactly the reduced-clearance water the bot router threads through such a slot
// (taxed, in planRoute), so when the stock water does not connect, the ruler follows the
// same thread the boats do. Stock water still wins wherever it connects, so no venue
// that routed before routes differently now.
function pathBetween(grid, from, to) {
    return pathPass(grid, from, to, false) || (grid._tight ? pathPass(grid, from, to, true) : null);
}
function pathPass(grid, from, to, tight) {
    const N = grid.n, T = tight ? grid._tight : null;
    const at = (i, j) => grid.at(i, j) || !!(T && i >= 0 && j >= 0 && i < N && j < N && T[j * N + i]);
    const s = nearestCell(grid, from[0], from[1], at);
    const g = nearestCell(grid, to[0], to[1], at);
    if (!s || !g) return null;
    const prev = new Int32Array(N * N).fill(-1);
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
            if (!at(a, b)) continue;
            // A diagonal must not cut a corner a hull could not pass. Same rule as the
            // router: a tight corner is legal only when the step itself ends in a tight
            // cell — a deliberate thread — otherwise the stock hull-width rule holds.
            if (di && dj) {
                if (T && !grid.at(a, b)) { if (!at(ci + di, cj) || !at(ci, cj + dj)) continue; }
                else if (!grid.at(ci + di, cj) || !grid.at(ci, cj + dj)) continue;
            }
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
            // THE PATH A BOAT SAILS, as a point list. A clear hop is the straight line;
            // anything longer is routed at hull width and pulled taut.
            let pts = [[prev.x, prev.y], [wp.x, wp.y]];
            if (straight > DIRECT) {
                const seg = pathBetween(grid, [prev.x, prev.y], [wp.x, wp.y]);
                if (seg && seg.length) {
                    // THE TRUE ENDPOINTS, not the snapped cell centres BFS started and
                    // finished on. Without this the taut length carries up to a cell of
                    // snapping error at each end, which on a clear hop shows up as the
                    // measured path being fractionally SHORTER than the straight line.
                    seg[0] = [prev.x, prev.y];
                    seg[seg.length - 1] = [wp.x, wp.y];
                    pts = smoothPath(grid, seg);
                }
            }
            // ⚠️ PRICED ALONG THAT PATH, SEGMENT BY SEGMENT — not at the rhumb midpoint.
            // The length was already taut; the WIND was still being read once, halfway
            // along the straight line between waypoints, and that point is not on the
            // course whenever the hop routes around anything. On Glowtide Strait the
            // midpoint of the hop past the eastern headland lands ON the headland, where
            // no wind region reaches, so a whole hop was booked as becalmed and the venue
            // reported "525 m of the sailable path has no wind" for water no boat sails.
            // Measured along the taut path instead: zero.
            //
            // Per-segment bearings matter for the same reason the per-hop comment below
            // gives. A detour around a headland is two different points of sail, and
            // pricing both at the rhumb bearing charges a beat for a reach.
            const li = legOf(wp.tag);
            const e = per[li] || (per[li] = { dist: 0, secs: 0, twaSum: 0 });
            for (let i = 1; i < pts.length; i++) {
                const ax = pts[i-1][0], ay = pts[i-1][1], bx = pts[i][0], by = pts[i][1];
                const segLen = Math.hypot(bx - ax, by - ay);
                if (!(segLen > 0)) continue;
                const bearing = Math.atan2(bx - ax, -(by - ay));
                const local = windAt
                    ? windAt((ax + bx) / 2, (ay + by) / 2)
                    : { direction: windDir, speed: windSpeed };
                // Calm is accumulated by the length that is ACTUALLY becalmed, not by the
                // whole hop on the strength of one sample.
                if (!local || local.speed < 0.5) { calm += segLen; continue; }
                const v = legVMG(bearing, local.direction, local.speed);
                const secs = (v && v.vmg > 0.2)
                    ? segLen / (v.vmg * U_PER_S_PER_KNOT)
                    : segLen / (REF > 0 ? REF * U_PER_S_PER_KNOT : 30);
                // Sailing TOWARD a waypoint is the work of the leg that waypoint belongs to.
                e.dist += segLen; e.secs += secs;
                if (v) e.twaSum += v.twaCourse * segLen;   // distance-weighted, for reporting
            }
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
        if (i < 0 || j < 0 || i >= grid.n || j >= grid.n) return false;
        return !!(grid._soft && grid._soft[j * grid.n + i] > 0);
    };
    // Tight cells are TRAVERSABLE but not snap targets of equal rank: a goal
    // near a shore must snap to open water when any exists — snapping into the
    // ribbon parks carrots against shorelines venue-wide. Tight is the snap of
    // last resort (a goal genuinely inside a slot still resolves).
    const tightCell = (i, j) => !!(grid._tight && i >= 0 && j >= 0
        && i < grid.n && j < grid.n && grid._tight[j * grid.n + i]);
    const snap = (wx, wy) => {
        const [ci, cj] = grid.cell(wx, wy);
        if (okCell(ci, cj)) return [ci, cj];
        let tightHit = tightCell(ci, cj) ? { c: [ci, cj], r: 0 } : null;
        for (let r = 1; r <= 18; r++) {
            // A tight hit stands once open water hasn't appeared within two
            // further rings: a goal deep in a slot stays in the slot, a goal a
            // hull off a shoreline still snaps to the open water beside it.
            if (tightHit && r > tightHit.r + 2) return tightHit.c;
            for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
                if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                if (okCell(ci + di, cj + dj)) return [ci + di, cj + dj];
                if (!tightHit && tightCell(ci + di, cj + dj)) tightHit = { c: [ci + di, cj + dj], r };
            }
        }
        return tightHit ? tightHit.c : null;
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
            const passStock = (ai, bi) => grid.at(ai, bi) ||
                (soft && ai >= 0 && bi >= 0 && ai < N && bi < N && soft(bi * N + ai));
            const passable = (ai, bi) => passStock(ai, bi) ||
                (ai >= 0 && bi >= 0 && ai < N && bi < N &&
                    grid._tight && grid._tight[bi * N + ai]);
            if (!passable(a, b)) continue;
            const nid = b * N + a;
            const nonNav = !grid.at(a, b);
            const isSoft = nonNav && !!(grid._soft && grid._soft[nid] > 0);
            const isTight = nonNav && !isSoft;
            // ⚠️ THE CORNER RULE MUST NOT RELAX FOR FREE. Counting tight cells
            // as "passable" in the diagonal corner test let every route cut
            // diagonals past corners whose orthogonal neighbour is a 21-44u
            // shore ribbon — an UNTAXED shave (both step endpoints navigable)
            // on every corner of every venue. Measured on redrock 6-set: land
            // contacts +58% with only 3.6% of plans actually threading.
            // A tight-corner diagonal is legal ONLY when the step itself ends
            // in a tight cell — a deliberate thread, priced by TIGHT_TAX;
            // every other diagonal keeps the stock hull-width rule.
            if (di && dj) {
                if (isTight) { if (!passable(ci + di, cj) || !passable(ci, cj + dj)) continue; }
                else if (!passStock(ci + di, cj) || !passStock(ci, cj + dj)) continue;
            }
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
                let fUp = 1 + _lossTab[wbin[nid] * 8 + k] / W;
                // BELOW TACK WIDTH the law changes shape (owner, 2026-08-06: the
                // human "goes downwind through narrow canyons instead of tacking
                // through narrow canyons" — buys distance to put beats in wide
                // water). Min tack width is a measured 123u; under ~140u an upwind
                // bearing is not slow, it is close to unworkable, and the old flat
                // cap of 20 let a short sub-tack-width canyon outbid a long sailable
                // one. Quadratic in the width deficit, cap raised to 90 — an order,
                // not a knob. Downwind bearings have loss≈0 and are UNTOUCHED.
                // ⚠️ DRIFTING-ICE WATER ONLY — the same physical line every gate in
                // this campaign sits on. In a floe pack the narrow corridor is
                // transient and a real alternative usually exists (arctic: 144/144
                // finishers, in-time 24->40, paired -8/-14.6). Where the narrowness
                // is AUTHORED shore, the reroute only trades corridor for
                // shore-grind: lake land contacts 8.1 -> 15.4 per boat-race and
                // redrock finishers 10 -> 6 under the unscoped law. Non-icy venues
                // price exactly as stock, by construction.
                const icyG = !!(typeof state !== 'undefined' && state.course
                    && state.course._floeObjs && state.course._floeObjs.length);
                if (icyG && W < 140 && fUp > 1.05) fUp *= (140 / W) * (140 / W);
                base = Math.min(icyG && fUp > 1.05 && W < 140 ? 90 : 20, base * fUp);
            }
            // SHOAL WATER, and NOT a hint — the one weight here that belongs on the base
            // cost rather than in `extra`. It is already the reciprocal of the speed
            // multiplier the boat will feel (see grid._shoal), so multiplying it into a
            // time cost yields time: a cell that sails at 0.5x takes twice as long to
            // cross, and the A* adds up seconds that are literally true. That is why it
            // sits OUTSIDE the corridor cap above, which bounds a modelled loss — this is
            // not modelled, it is the tax the speed model will actually levy, and capping
            // it would let the router promise a shortcut the sailor cannot sail.
            // Admissible: the field is >= 1 everywhere, so no step gets cheaper than
            // _tfMin and the heuristic still never overestimates.
            if (grid._shoal) base *= grid._shoal[nid];
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
            // TIGHT TIER: sailable bow-first, but with real execution risk — the
            // tax (on top of the clearance-band extras this cell already pays,
            // its _clear is 0) makes A* buy a thread only against a substantial
            // detour, never to shave a corner.
            if (isTight) w *= TIGHT_TAX;
            // TRAFFIC JAM: water under a parked raft prices like plugged water —
            // the queue delay behind a parked rival is real sailing time (see the
            // stamp site in script.js). Bounded like _soft's multipliers so the
            // worst jam detour stays comparable to a floe-plug detour.
            if (grid._jam && grid._jam[nid]) w *= Math.min(6, 1.5 + 1.5 * grid._jam[nid]);
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
    HULL_R, CLEARANCE, TIGHT_CLEAR, RES,
    buildGrid, stampFloes, pathBetween, smoothPath, losClear, nearestNav, roundingArc, routeWaypoints,
    legVMG, routeEstimate, pathSailable, clearanceField, segClearGeom
};
})();
