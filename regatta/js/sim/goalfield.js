// ── GOAL FIELDS ─────────────────────────────────────────────────────────────
// For every goal on the route — each mark to round, each line to cross — TWO FIELDS over the
// bots' nav grid, built once at the full course build (Otter's 386² grid: ~0.3 s a goal):
//
//   T      a FAST-MARCHING (eikonal) arrival-time surface: the geodesic distance to the goal in
//          every water cell, continuous, no compass-step bias. Its downhill gradient is the way to
//          the goal from anywhere — straight at the mark in open water, round the headland behind
//          it — and it draws the PATH LINE on the water and steers the PROGRESS dial.
//   dist   a Dijkstra field priced in SAILING distance (the cone metric, below), read by the
//          LEADERBOARD: remaining = this field at the boat + the later legs' lengths.
//
// THE GOAL CHIP IS NOT ROUTED. It shows where the goal IS — straight bearing, straight distance —
// the way every shipped game's marker does (Halo, Skyrim, Sea of Thieves; Dead Space and GTA draw
// the route separately, on the floor and on the map). A bearing is a fact: continuous, one value,
// never wrong. A route is a plan: it turns at corners, flips where two ways round are equal, and
// depends on what counts as an obstacle. Folding the plan into the arrow made the arrow inherit
// every property of the plan, and the player read it as broken (Sep 13–15 2026, three rounds of
// stabilisers). So the WAY there is its own, softer element: the path line. (Owner's call, Sep 15.)
//
// FLOES ARE IGNORED FOR THE PLAYER, by design: both fields are built on the STATIC grid (land and
// hard props). The player needs to know there is a way through here; finding it past the ice is
// their job. The bots' own router (pathSailable) keeps its floe-aware tiers untouched.
//
// WHY FAST MARCHING FOR THE PATH. A grid Dijkstra points along eight compass steps and overstates
// distance by up to 8%; its any-angle variant (a farthest-visible-ancestor per cell) gives true
// bearings but chatters near rocks, because a raster line of sight is stricter than the hull's
// clearance by half a cell, and its corners flip between neighbouring cells. The eikonal solution
// has no corners to flip between: it is one smooth surface whose gradient IS the geodesic
// direction, first-order accurate, and the path is its gradient descent. Sources are initialised
// with exact Euclidean distances out to three cells, which removes the method's near-source error.
//
// THE CONE METRIC (ranking). A Euclidean field ranks a boat on the layline behind a boat with the
// same upwind progress on the rhumb line, where the ruler projection it replaced ranked them equal.
// So the ranking field prices a step as SAILING DISTANCE: inside the close-hauled cone an upwind
// step costs its upwind component / cos(beat angle), inside the gybing cone likewise, else its
// length. The wind per cell is the mean field the full build stamps on the grid for the bots'
// router (`_wfx`/`_wfy`). `window.__GOALFIELD = { metric: 'euclid' }` + GoalField.rebuild() to
// compare. Inside a cone the cost is linear, so every path ties with the straight line: ties go
// to the FARTHER ancestor and a 0.2% Euclidean term breaks them toward the geometric path.
//
// ⚠️ dist and T are Float32 and the heap keys are Float64: push the STORED value, or past a few
// thousand units the stored value rounds below the key, the stale test drops the entry, and half
// the cells never expand (the river's flood died a third of the way in).
'use strict';
(function () {
    const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const SQRT2 = Math.SQRT2;
    const COS_BEAT = Math.cos(40 * Math.PI / 180);   // the polar's best VMG upwind sits at 38-40° (13-20 kt)
    const COS_RUN = Math.cos(25 * Math.PI / 180);    // and 150-160° downwind
    const TIE = 0.002;                               // the Euclidean tie-break inside a cone, see segCost
    const PATH_AHEAD = 2600;                         // units of path drawn ahead of the boat (~520 m)
    const PATH_STEP = 25;                            // descent step, half a cell
    const PATH_EVERY = 6;                            // frames between path recomputes
    const DEFAULTS = { metric: 'cone' };
    const cfg = () => Object.assign({}, DEFAULTS, (typeof window !== 'undefined' && window.__GOALFIELD) || {});
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

    // ── the heap ────────────────────────────────────────────────────────────
    function makeHeap() {
        const hf = [], hi = [];
        return {
            size: () => hf.length,
            push: (f, id) => {
                hf.push(f); hi.push(id); let k = hf.length - 1;
                while (k) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break;
                    const tf = hf[p], ti = hi[p]; hf[p] = hf[k]; hi[p] = hi[k]; hf[k] = tf; hi[k] = ti; k = p; }
            },
            pop: () => {
                const f0 = hf[0], i0 = hi[0]; const lf = hf.pop(), li = hi.pop();
                if (hf.length) { hf[0] = lf; hi[0] = li; let k = 0;
                    for (;;) { const l = 2 * k + 1, r = l + 1; let m = k;
                        if (l < hf.length && hf[l] < hf[m]) m = l; if (r < hf.length && hf[r] < hf[m]) m = r;
                        if (m === k) break; const tf = hf[m], ti = hi[m]; hf[m] = hf[k]; hi[m] = hi[k]; hf[k] = tf; hi[k] = ti; k = m; } }
                return [f0, i0];
            }
        };
    }

    // The price of sailing the straight segment (dx, dy) of length d, from water whose wind-toward
    // unit vector is (wx, wy). Continuous at both cone edges.
    function segCost(dx, dy, d, wx, wy, cone) {
        if (!cone || d < 1e-9) return d;
        const c = (dx * wx + dy * wy) / d;
        if (c > COS_BEAT) return d * c / COS_BEAT + d * TIE;
        if (c < -COS_RUN) return d * -c / COS_RUN + d * TIE;
        return d;
    }

    // Raster line of sight between two cells over the passable mask (a supercover walk).
    function makeLos(pass, N) {
        return (a, b) => {
            const i0 = a % N, j0 = (a - i0) / N, i1 = b % N, j1 = (b - i1) / N;
            const di = Math.abs(i1 - i0), dj = Math.abs(j1 - j0), si = i0 < i1 ? 1 : -1, sj = j0 < j1 ? 1 : -1;
            let err = di - dj, i = i0, j = j0, guard = di + dj + 2;
            while (guard-- > 0) {
                if (!pass[j * N + i]) return false;
                if (i === i1 && j === j1) return true;
                const e2 = 2 * err;
                if (e2 > -dj) { err -= dj; i += si; }
                if (e2 < di) { err += di; j += sj; }
            }
            return false;
        };
    }

    // ── the RANKING field: multi-source Dijkstra, any-angle, label-setting, cone-priced ───
    function distFor(G, srcCells, srcOff) {
        const { N, RES, pass, cone, wfx, wfy, x0, y0, los } = G;
        const n2 = N * N;
        const dist = new Float32Array(n2).fill(Infinity), anc = new Int32Array(n2).fill(-1), closed = new Uint8Array(n2);
        const H = makeHeap();
        const wx = (id) => x0 + ((id % N) + 0.5) * RES, wy = (id) => y0 + (Math.floor(id / N) + 0.5) * RES;
        // A source cell starts at its own offset from the goal point it stands for (a mark laid
        // inside a clearance band can sit 250u from the nearest water cell), so every chained
        // reading measures to the MARK and not to a cell centre beside it.
        for (const s of srcCells) { dist[s] = srcOff.get(s) || 0; anc[s] = s; H.push(dist[s], s); }
        while (H.size()) {
            const [f, cur] = H.pop();
            if (closed[cur] || f > dist[cur] + 1e-3) continue;
            closed[cur] = 1;
            const ci = cur % N, cj = (cur - ci) / N;
            const A = anc[cur], ax = wx(A), ay = wy(A);
            for (let q = 0; q < 8; q++) {
                const di = NB[q][0], dj = NB[q][1];
                const a = ci + di, b = cj + dj;
                if (a < 0 || b < 0 || a >= N || b >= N) continue;
                const nid = b * N + a;
                if (!pass[nid] || closed[nid]) continue;
                if (di && dj && (!pass[cj * N + a] || !pass[b * N + ci])) continue;   // no cutting a land corner
                const vx = cone ? wfx[nid] : 0, vy = cone ? wfy[nid] : 0;
                // the boat at nid sails TOWARD cur: the step's world vector is (-di, -dj) * RES
                let nd = dist[cur] + segCost(-di * RES, -dj * RES, (di && dj ? SQRT2 : 1) * RES, vx, vy, cone), na = cur;
                if (A !== cur && los(nid, A)) {
                    const px = wx(nid), py = wy(nid);
                    const dx = ax - px, dy = ay - py, d = Math.hypot(dx, dy);
                    const via = dist[A] + segCost(dx, dy, d, vx, vy, cone);
                    if (via <= nd + 1e-6) { nd = via; na = A; }   // a tie goes to the FARTHER corner
                }
                if (nd < dist[nid] - 1e-3) { dist[nid] = nd; anc[nid] = na; H.push(dist[nid], nid); }
            }
        }
        return { dist, anc };
    }

    // ── the PATH field: fast marching (first-order eikonal, |∇T| = 1 on water) ───────────
    function fmmFor(G, srcCells, srcPt) {
        const { N, RES, pass, x0, y0 } = G;
        const n2 = N * N;
        const T = new Float32Array(n2).fill(Infinity), frozen = new Uint8Array(n2);
        const H = makeHeap();
        // Exact initialisation: every water cell within three cells of a source's goal point takes
        // its true Euclidean distance to that point — the first-order scheme's error is largest at
        // the source, and seeding a disc of exact values removes it.
        for (const s of srcCells) {
            const p = srcPt.get(s); const si = s % N, sj = (s - si) / N;
            for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
                const i = si + di, j = sj + dj;
                if (i < 0 || j < 0 || i >= N || j >= N) continue;
                const id = j * N + i; if (!pass[id]) continue;
                const d = Math.hypot(x0 + (i + 0.5) * RES - p.x, y0 + (j + 0.5) * RES - p.y);
                if (d < T[id]) T[id] = d;
            }
        }
        for (let id = 0; id < n2; id++) if (isFinite(T[id])) H.push(T[id], id);
        const h = RES;
        while (H.size()) {
            const [f, cur] = H.pop();
            if (frozen[cur] || f > T[cur] + 1e-3) continue;
            frozen[cur] = 1;
            const ci = cur % N, cj = (cur - ci) / N;
            for (let q = 0; q < 4; q++) {
                const a = ci + NB[q][0], b = cj + NB[q][1];
                if (a < 0 || b < 0 || a >= N || b >= N) continue;
                const nid = b * N + a;
                if (!pass[nid] || frozen[nid]) continue;
                // upwind update from ACCEPTED neighbours only
                let tx = Infinity, ty = Infinity;
                if (a > 0 && frozen[nid - 1]) tx = T[nid - 1];
                if (a < N - 1 && frozen[nid + 1] && T[nid + 1] < tx) tx = T[nid + 1];
                if (b > 0 && frozen[nid - N]) ty = T[nid - N];
                if (b < N - 1 && frozen[nid + N] && T[nid + N] < ty) ty = T[nid + N];
                let t;
                if (isFinite(tx) && isFinite(ty) && Math.abs(tx - ty) < h) t = (tx + ty + Math.sqrt(2 * h * h - (tx - ty) * (tx - ty))) / 2;
                else t = Math.min(tx, ty) + h;
                if (t < T[nid] - 1e-3) { T[nid] = t; H.push(T[nid], nid); }
            }
        }
        return T;
    }

    // The passable cells that stand for a goal point: the nearest one, plus any within a cell.
    function cellsNear(G, x, y) {
        const { N, RES, pass, x0, y0 } = G;
        const i0 = Math.floor((x - x0) / RES), j0 = Math.floor((y - y0) / RES);
        const out = []; let best = -1, bd = Infinity;
        for (let dj = -7; dj <= 7; dj++) for (let di = -7; di <= 7; di++) {
            const i = i0 + di, j = j0 + dj;
            if (i < 0 || j < 0 || i >= N || j >= N) continue;
            const id = j * N + i; if (!pass[id]) continue;
            const d = Math.hypot(x0 + (i + 0.5) * RES - x, y0 + (j + 0.5) * RES - y);
            if (d < bd) { bd = d; best = id; }
            if (d <= RES) out.push(id);
        }
        if (best >= 0 && !out.includes(best)) out.push(best);
        return out;
    }

    // Build every goal's fields for a course. `route` and `marks` as state.course carries them:
    // route[0] is the start line, route[L] the goal of leg L. Returns null when there is nothing
    // to build on (a light build, no grid, a generated course).
    function build(grid, route, marks) {
        if (!grid || !grid.nav || !route || route.length < 2) return null;
        const t0 = now();
        const N = grid.n, RES = grid.res, T_ = grid._tight, nav = grid.nav;
        const pass = new Uint8Array(N * N);
        for (let k = 0; k < N * N; k++) pass[k] = (nav[k] || (T_ && T_[k])) ? 1 : 0;
        const metric = cfg().metric;
        const cone = metric === 'cone' && !!(grid._wfx && grid._wfy);
        const G = { N, RES, pass, cone, wfx: grid._wfx, wfy: grid._wfy, x0: grid.x0, y0: grid.y0, los: makeLos(pass, N) };
        // route[0] is the start line: it gets a field too, so the path leads to the line before the
        // gun; it carries no leg length and plays no part in the ranking.
        const legs = [];
        const goalPt = (e) => {
            if (e.kind === 'round' && e.mark) return { x: e.mark.x, y: e.mark.y };
            if (e.marks) { const m1 = marks[e.marks[0]], m2 = marks[e.marks[1]]; if (m1 && m2) return { x: (m1.x + m2.x) / 2, y: (m1.y + m2.y) / 2 }; }
            return null;
        };
        let fmmMs = 0;
        for (let L = 0; L < route.length; L++) {
            const e = route[L];
            let srcPts = null, kind = null, line = null;
            if (e.kind === 'round' && e.mark) { kind = 'mark'; srcPts = [{ x: e.mark.x, y: e.mark.y }]; }
            else if (e.marks) {
                const m1 = marks[e.marks[0]], m2 = marks[e.marks[1]];
                if (m1 && m2) {
                    kind = 'line'; line = { a: { x: m1.x, y: m1.y }, b: { x: m2.x, y: m2.y } };
                    const n = Math.max(2, Math.ceil(Math.hypot(m2.x - m1.x, m2.y - m1.y) / (RES * 0.7)));
                    srcPts = []; for (let k = 0; k <= n; k++) srcPts.push({ x: m1.x + (m2.x - m1.x) * k / n, y: m1.y + (m2.y - m1.y) * k / n });
                }
            }
            if (!srcPts) { legs.push(null); continue; }
            // every source cell remembers the exact goal point it stands for, so a reading whose next
            // corner IS the goal can point at the mark (or the line) and not at a cell centre
            const srcPt = new Map(), srcOff = new Map(); const srcCells = [];
            for (const p of srcPts) for (const c of cellsNear(G, p.x, p.y)) {
                const off = Math.hypot(grid.x0 + ((c % N) + 0.5) * RES - p.x, grid.y0 + (Math.floor(c / N) + 0.5) * RES - p.y);
                if (!srcPt.has(c) || off < srcOff.get(c)) { srcPt.set(c, p); srcOff.set(c, off); if (!srcCells.includes(c)) srcCells.push(c); }
            }
            if (!srcCells.length) { legs.push(null); continue; }
            const F = distFor(G, srcCells, srcOff);
            const t1 = now(); F.T = fmmFor(G, srcCells, srcPt); fmmMs += now() - t1;
            F.Tmin = Math.min(...srcCells.map(c => F.T[c]));
            F.kind = kind; F.line = line; F.goal = goalPt(e); F.srcPt = srcPt; F.leg = L; F.N = N; F.RES = RES; F.x0 = grid.x0; F.y0 = grid.y0; F.pass = pass;
            legs.push(F);
        }
        // Leg lengths: leg L's field read at the previous goal (the start line's middle for leg 1),
        // so remaining = this field + the later legs is continuous across a rounding.
        const legLen = new Array(legs.length).fill(0);
        let prev = goalPt(route[0]);
        for (let L = 1; L < legs.length; L++) {
            const F = legs[L];
            if (F && prev) { const r = lookup(F, prev.x, prev.y); legLen[L] = r ? r.dist : 0; }
            const g = goalPt(route[L]); if (g) prev = g;
        }
        const total = legLen.reduce((a, b) => a + b, 0);
        // RANKABLE only when every leg has a field and a length: mixing field readings on one leg
        // with the ruler's on the next steps the progress by thousands at the change.
        const rankable = legs.length > 1 && legs.slice(1).every(F => !!F) && legLen.slice(1).every(l => l > 0);
        const ms = now() - t0;
        legLen[0] = 0;
        if (typeof console !== 'undefined') console.log(`[goalfield] ${legs.length - 1} goal field(s) + the start line on a ${N}² grid, ${metric}${cone ? '' : ' (no wind stamp: euclid)'}, ${ms.toFixed(0)} ms (fast marching ${fmmMs.toFixed(0)} ms)${rankable ? '' : ' — NOT rankable (a goal has no reachable cell), the ruler ranks'}`);
        return { legs, legLen, total, rankable, metric: cone ? 'cone' : 'euclid', grid, ms, fmmMs };
    }

    // ── reading the RANKING field ───────────────────────────────────────────
    // The field read at a world point: the remaining sailing distance and the next corner. A boat's
    // own cell can be unreached (hugging a shore inside the tight band), so the best reached cell
    // within four is used instead. Null when nothing nearby was reached.
    function lookup(F, x, y) {
        const { N, RES, x0, y0, dist, anc } = F;
        const i0 = Math.max(0, Math.min(N - 1, Math.floor((x - x0) / RES)));
        const j0 = Math.max(0, Math.min(N - 1, Math.floor((y - y0) / RES)));
        let best = -1, bd = Infinity;
        for (let r = 0; r <= 4 && best < 0; r++) {
            for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
                if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                const i = i0 + di, j = j0 + dj;
                if (i < 0 || j < 0 || i >= N || j >= N) continue;
                const id = j * N + i; const d = dist[id];
                if (!isFinite(d)) continue;
                const a = anc[id];
                const sp = F.srcPt.get(a);
                const ax = sp ? sp.x : x0 + ((a % N) + 0.5) * RES, ay = sp ? sp.y : y0 + (Math.floor(a / N) + 0.5) * RES;
                const total = (sp ? 0 : dist[a]) + Math.hypot(ax - x, ay - y);
                if (total < bd) { bd = total; best = id; }
            }
        }
        if (best < 0) return null;
        const a = anc[best];
        const src = F.srcPt.get(a);
        const next = src ? { x: src.x, y: src.y } : { x: x0 + ((a % N) + 0.5) * RES, y: y0 + (Math.floor(a / N) + 0.5) * RES };
        return { dist: bd, next, nextCell: a, cell: best, atGoal: !!src };
    }

    // Remaining course distance for a boat on leg `leg`, or null when the course is not rankable.
    // A boat whose cell the field never reached keeps its last reading, or takes the straight line
    // to the goal — never the ruler's number, which is on a different scale.
    function remaining(GF, leg, x, y, rs) {
        const F = GF && GF.rankable && GF.legs[leg];
        if (!F) return null;
        let rem = null;
        const r = lookup(F, x, y);
        if (r) rem = r.dist;
        else if (rs && rs._gfRemLeg === leg && rs._gfRem != null) return rs._gfRem;
        else if (F.goal) rem = Math.hypot(F.goal.x - x, F.goal.y - y);
        else return null;
        for (let L = leg + 1; L < GF.legLen.length; L++) rem += GF.legLen[L];
        if (rs) { rs._gfRem = rem; rs._gfRemLeg = leg; }
        return rem;
    }

    // ── reading the PATH field ──────────────────────────────────────────────
    // T at a world point: bilinear over the four surrounding cell centres, skipping land.
    function Tat(F, x, y) {
        const { N, RES, x0, y0, T } = F;
        const u = (x - x0) / RES - 0.5, v = (y - y0) / RES - 0.5;
        const i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0;
        let sum = 0, wsum = 0;
        for (let dj = 0; dj <= 1; dj++) for (let di = 0; di <= 1; di++) {
            const i = i0 + di, j = j0 + dj;
            if (i < 0 || j < 0 || i >= N || j >= N) continue;
            const t = T[j * N + i]; if (!isFinite(t)) continue;
            const w = (di ? fu : 1 - fu) * (dj ? fv : 1 - fv);
            sum += w * t; wsum += w;
        }
        return wsum > 1e-6 ? sum / wsum : Infinity;
    }
    // The gradient of T in one cell, central where both neighbours are water, one-sided otherwise.
    function cellGrad(F, id, out) {
        const { N, RES, T } = F;
        const tc = T[id]; if (!isFinite(tc)) return false;
        const i = id % N, j = (id - i) / N;
        const l = i > 0 ? T[id - 1] : Infinity, r = i < N - 1 ? T[id + 1] : Infinity;
        const u = j > 0 ? T[id - N] : Infinity, d = j < N - 1 ? T[id + N] : Infinity;
        let gx = 0, gy = 0;
        if (isFinite(l) && isFinite(r)) gx = (r - l) / (2 * RES); else if (isFinite(l)) gx = (tc - l) / RES; else if (isFinite(r)) gx = (r - tc) / RES;
        if (isFinite(u) && isFinite(d)) gy = (d - u) / (2 * RES); else if (isFinite(u)) gy = (tc - u) / RES; else if (isFinite(d)) gy = (d - tc) / RES;
        out.x = gx; out.y = gy; return true;
    }
    // The way to the goal at a world point: −∇T, blended over the four surrounding cells. Null on
    // land or where nothing nearby was reached.
    const _g = { x: 0, y: 0 };
    function gradAt(F, x, y) {
        const { N, RES, x0, y0 } = F;
        const u = (x - x0) / RES - 0.5, v = (y - y0) / RES - 0.5;
        const i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0;
        let gx = 0, gy = 0, wsum = 0;
        for (let dj = 0; dj <= 1; dj++) for (let di = 0; di <= 1; di++) {
            const i = i0 + di, j = j0 + dj;
            if (i < 0 || j < 0 || i >= N || j >= N) continue;
            if (!cellGrad(F, j * N + i, _g)) continue;
            const w = (di ? fu : 1 - fu) * (dj ? fv : 1 - fv);
            gx += w * _g.x; gy += w * _g.y; wsum += w;
        }
        if (wsum < 1e-6) return null;
        const m = Math.hypot(gx, gy); if (m < 1e-9) return null;
        return { x: -gx / m, y: -gy / m };
    }
    // Gradient descent from a point: the path the eikonal surface says to sail, as a polyline, up
    // to maxLen units or until the goal. Every point stays on a PASSABLE cell (the hull's own
    // clearance): where the gradient step would leave one, or the gradient is unavailable, the walk
    // hops to the lowest passable neighbour instead. It ends at the surface's own minimum — a mark
    // laid inside a clearance band bottoms out at its offset, not at zero — and then on the mark.
    function descend(F, x, y, maxLen) {
        const { N, RES, x0, y0, T, pass } = F;
        const cellOf = (px, py) => { const i = Math.floor((px - x0) / RES), j = Math.floor((py - y0) / RES); return (i < 0 || j < 0 || i >= N || j >= N) ? -1 : j * N + i; };
        const centre = (id) => [x0 + ((id % N) + 0.5) * RES, y0 + (Math.floor(id / N) + 0.5) * RES];
        const pts = [[x, y]];
        let cx = x, cy = y, len = 0;
        let cell = cellOf(cx, cy);
        // start inside the band: snap to the nearest reached passable cell (within four)
        if (cell < 0 || !pass[cell] || !isFinite(T[cell])) {
            const i0 = Math.max(0, Math.min(N - 1, Math.floor((cx - x0) / RES))), j0 = Math.max(0, Math.min(N - 1, Math.floor((cy - y0) / RES)));
            let best = -1, bd = Infinity;
            for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
                const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
                const id = j * N + i; if (!pass[id] || !isFinite(T[id])) continue;
                const c = centre(id); const d = Math.hypot(c[0] - cx, c[1] - cy) + T[id] * 0.25;
                if (d < bd) { bd = d; best = id; }
            }
            if (best < 0) return pts;
            const c = centre(best); len += Math.hypot(c[0] - cx, c[1] - cy); cx = c[0]; cy = c[1]; cell = best; pts.push([cx, cy]);
        }
        const done = F.Tmin + RES * 1.5;
        for (let it = 0; it < 6000 && len < maxLen; it++) {
            const tcur = Tat(F, cx, cy);
            if (tcur <= done) { if (F.goal && F.kind === 'mark') pts.push([F.goal.x, F.goal.y]); break; }
            const g = gradAt(F, cx, cy);
            let nx = 0, ny = 0, ok = false;
            if (g) {
                nx = cx + g.x * PATH_STEP; ny = cy + g.y * PATH_STEP;
                const nc = cellOf(nx, ny);
                ok = nc >= 0 && pass[nc] && Tat(F, nx, ny) < tcur - 1e-3;
                if (ok) cell = nc;
            }
            if (!ok) {
                // hop to the lowest passable neighbour of the current cell
                const ci = cell % N, cj = (cell - ci) / N;
                let bid = -1, bt = T[cell];
                for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
                    const i = ci + di, j = cj + dj; if ((!di && !dj) || i < 0 || j < 0 || i >= N || j >= N) continue;
                    const id = j * N + i; if (!pass[id] || !(T[id] < bt)) continue; bt = T[id]; bid = id;
                }
                if (bid < 0) break;                       // a true dead end: nothing lower around
                const c = centre(bid); nx = c[0]; ny = c[1]; cell = bid;
            }
            len += Math.hypot(nx - cx, ny - cy); cx = nx; cy = ny;
            pts.push([cx, cy]);
        }
        return pts;
    }
    // The direction of progress for the dial: the path's direction at the boat, or null.
    function progressDir(player) {
        const GF = state.course.goalFields; const leg = player.raceState.leg;
        const F = GF && GF.legs[leg]; if (!F || !F.T) return null;
        return gradAt(F, player.x, player.y);
    }
    // The player's path ahead, recomputed every few frames.
    function playerPath(player) {
        const fc = typeof frameCount === 'number' ? frameCount : 0;
        const leg = player.raceState.leg;
        const c = player._goalPath;
        if (c && c.leg === leg && fc - c.f < PATH_EVERY) return c.pts;
        const GF = state.course.goalFields; const F = GF && GF.legs[leg];
        const pts = (F && F.T) ? descend(F, player.x, player.y, PATH_AHEAD) : null;
        player._goalPath = { f: fc, leg, pts };
        return pts;
    }

    // ── THE PATH LINE ON THE WATER ──────────────────────────────────────────
    // Drawn in world space BEFORE the land, so a headland hides the part of the way behind it.
    // Faint, dashed, fading toward its far end, drifting slowly toward the goal: a suggestion on
    // the water, not a claim. Gated with the nav aids like the chips.
    function drawPath(ctx, player) {
        if (!state.showNavAids || state.race.status !== 'racing' || !player || !player.raceState || player.raceState.finished) return;
        if (window.School && School.lesson && School.lesson()) return;
        const pts = playerPath(player);
        if (!pts || pts.length < 3) return;
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.setLineDash([34, 26]);
        ctx.lineDashOffset = -((state.time || 0) * 40) % 60;
        // four chunks, fading
        const chunks = 4, per = Math.ceil((pts.length - 1) / chunks);
        for (let k = 0; k < chunks; k++) {
            const a = k * per, b = Math.min(pts.length - 1, a + per);
            if (a >= b) break;
            ctx.beginPath();
            ctx.moveTo(pts[a][0], pts[a][1]);
            for (let i = a + 1; i <= b; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            const alpha = 0.42 * (1 - k / chunks) + 0.08;
            ctx.strokeStyle = `rgba(34, 211, 238, ${alpha.toFixed(3)})`;   // cyan-400, the chip's colour
            ctx.lineWidth = 3.5;
            ctx.stroke();
        }
        ctx.restore();
    }

    // ── THE CHIP'S AIM: where the goal IS ───────────────────────────────────
    //   kind    'mark' | 'gate' | 'line' | 'wp'
    //   goal    the mark, or the waypoint; `ends` for a line
    //   aim     the goal itself — a gate's centre from afar, its nearest point when close
    //   dist    the straight distance to the aim
    //   side    a mark's rounding side
    function playerAim(player, e, leg) {
        const fc = typeof frameCount === 'number' ? frameCount : -1;
        const c = player._gfAim;
        if (c && c.f === fc && c.leg === leg && fc >= 0) return c.res;
        const dTo = (p) => Math.hypot(p.x - player.x, p.y - player.y);
        let res = null;
        if (e && e.kind === 'round' && e.mark) {
            const rm = e.mark;
            res = { kind: 'mark', goal: rm, direct: true, aim: { x: rm.x, y: rm.y }, dist: dTo(rm), side: rm.side || null, ends: null };
        } else if (e && e.marks && state.course.marks) {
            const marks = state.course.marks;
            const ends = e.marks.map(i => marks[i]).filter(Boolean);
            const isGate = e.kind === 'gate' && !e.finish && leg > 0 && leg < state.race.totalLegs;
            let gateSideOf = null;
            if (isGate && ends.length === 2) {
                const m1 = ends[0], m2 = ends[1];
                const gdx = m2.x - m1.x, gdy = m2.y - m1.y, gl = Math.hypot(gdx, gdy) || 1;
                const gs = (e.dir >= 0 ? 1 : -1);
                const nx = gs * gdy / gl, ny = -gs * gdx / gl;      // direction of travel through
                const grx = -ny, gry = nx;                          // right of travel
                const gmx = (m1.x + m2.x) / 2, gmy = (m1.y + m2.y) / 2;
                gateSideOf = (mk) => ((mk.x - gmx) * grx + (mk.y - gmy) * gry > 0) ? 'starboard' : 'port';
            }
            // THE CENTRE OF THE GATE FROM AFAR. The nearest point on the segment is the right
            // target once you are between the ends, but from outside that band it is one END,
            // and which end flips as you cross the gate's centreline — every tack of a beat
            // swung the arrow eighty degrees. Blend from the centre (far) to the nearest point
            // (within a gate-and-a-half).
            const wp = player.raceState.nextWaypoint;
            let aim;
            if (ends.length === 2) {
                const mx = (ends[0].x + ends[1].x) / 2, my = (ends[0].y + ends[1].y) / 2;
                const hwid = Math.hypot(ends[1].x - ends[0].x, ends[1].y - ends[0].y) / 2 || 1;
                const dist = Math.hypot(mx - player.x, my - player.y);
                const w = Math.max(0, Math.min(1, (3 * hwid - dist) / (1.5 * hwid)));
                aim = { x: mx + (wp.x - mx) * w, y: my + (wp.y - my) * w };
            } else aim = { x: wp.x, y: wp.y };
            res = { kind: isGate ? 'gate' : 'line', goal: null, ends, gateSideOf, direct: true, aim, dist: dTo(aim), side: null };
        } else {
            const wp = player.raceState.nextWaypoint;
            res = { kind: 'wp', goal: wp, direct: true, aim: { x: wp.x, y: wp.y }, dist: dTo(wp), side: null, ends: null };
        }
        player._gfAim = { f: fc, leg, res };
        return res;
    }

    // Rebuild the current course's fields (after flipping the metric live).
    function rebuild() {
        const c = state.course;
        if (!c || !c.route) return null;
        c.goalFields = build(c._botGridStatic || c.botGrid, c.route, c.marks);
        return c.goalFields;
    }

    window.GoalField = { build, lookup, remaining, Tat, gradAt, descend, progressDir, playerPath, drawPath, playerAim, rebuild, segCost, COS_BEAT, COS_RUN };
})();
