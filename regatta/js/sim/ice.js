// regatta/js/sim/ice.js — drifting ice floes: outline/hull generation, floe
// motion and settling, the bot occupancy grid refresh, and floe hull geometry
// queries. The fxRand/snowRand streams it uses live in game/core.js.
// Classic script; global scope. Extracted verbatim from script.js (2026-08-24).
const FLOE_DENSITY = 3;

// Floe outlines, worked from aerial berg photography. Real ice is not a jittered
// circle: it lobes, it cuts deep bays, it snaps off into long shards and angular
// slabs. Building the radius as a harmonic sum gives those organic lobes and
// concave bays, and squashing along a random axis gives the elongation. Five
// archetypes, weighted so lobed bergs and shards show up most.
// 'shard' was weighted twice and reaches aspect 3.0, which read as a field of
// long splinters. One entry, and a shorter maximum.
const FLOE_KINDS = ['pan', 'slab', 'shard', 'lobed', 'cluster', 'lobed', 'pan'];
function makeFloeOutline(r, rng) {
    const kind = FLOE_KINDS[Math.floor(rng() * FLOE_KINDS.length)];
    // Spread the amplitude over several NON-multiple frequencies with random
    // phases. One dominant harmonic gives f-fold symmetry, and a floe that is
    // cleanly 3- or 4-fold symmetric reads as a flower, not as ice. The f=1
    // term shoves the mass off-centre, which is what kills the symmetry.
    let points, harm, aspect, bayCount;
    if (kind === 'pan') {                 // rounded drift pan
        points = 11 + Math.floor(rng() * 4);
        harm = [[1, 0.05], [2, 0.05], [3, 0.04], [5, 0.03]];
        aspect = 1.0 + rng() * 0.2; bayCount = 0;
    } else if (kind === 'slab') {         // angular tabular plate, few long edges
        points = 5 + Math.floor(rng() * 3);
        harm = [[1, 0.12], [2, 0.09], [3, 0.05]];
        aspect = 1.25 + rng() * 0.5; bayCount = rng() < 0.3 ? 1 : 0;
    } else if (kind === 'shard') {        // long splinter calved off something
        points = 8 + Math.floor(rng() * 4);
        harm = [[1, 0.16], [2, 0.10], [3, 0.08], [5, 0.05]];
        aspect = 1.6 + rng() * 0.6; bayCount = rng() < 0.5 ? 1 : 0;
    } else if (kind === 'lobed') {        // the classic deep-bayed berg
        points = 15 + Math.floor(rng() * 7);
        harm = [[1, 0.14], [2, 0.13], [3, 0.11], [5, 0.07]];
        aspect = 1.1 + rng() * 0.45; bayCount = 1 + (rng() < 0.4 ? 1 : 0);
    } else {                              // knuckly cluster of fused chunks
        points = 18 + Math.floor(rng() * 9);
        harm = [[1, 0.10], [2, 0.10], [3, 0.08], [5, 0.07], [8, 0.05], [13, 0.04]];
        aspect = 1.0 + rng() * 0.3; bayCount = rng() < 0.5 ? 1 : 0;
    }
    const H = harm.map(([f, a]) => ({ f, a, p: rng() * Math.PI * 2 }));
    const bays = [];
    for (let i = 0; i < bayCount; i++) {
        bays.push({ at: rng() * Math.PI * 2, w: 0.35 + rng() * 0.5, d: 0.25 + rng() * 0.3 });
    }

    const pts = [];
    for (let i = 0; i < points; i++) {
        const th = (i / points) * Math.PI * 2;
        let k = 1;
        for (const h of H) k += h.a * Math.cos(h.f * th + h.p);
        for (const b of bays) {
            // angular distance to the bay centre, wrapped to [0, PI]
            const d = Math.abs(((th - b.at + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (d < b.w) k -= b.d * (1 + Math.cos(Math.PI * d / b.w)) * 0.5;
        }
        k = Math.max(0.32, k);
        pts.push({ x: Math.cos(th) * r * k, y: Math.sin(th) * r * k });
    }

    // Squash along one axis, then swing that axis to a random bearing
    const rot = rng() * Math.PI * 2, cr = Math.cos(rot), sr = Math.sin(rot);
    let maxD = 0;
    for (const p of pts) {
        const ex = p.x * aspect, ey = p.y / aspect;
        p.x = ex * cr - ey * sr; p.y = ex * sr + ey * cr;
        maxD = Math.max(maxD, Math.hypot(p.x, p.y));
    }
    // Renormalise: isl.radius is the broad-phase bound for collision and for the
    // AI's avoidance, so the outline must not poke outside it.
    if (maxD > 0) { const k = r / maxD; for (const p of pts) { p.x *= k; p.y *= k; } }
    return pts;
}

// Distance from the shape's origin out to its outline along `ang`. Ray-casts
// against every edge and takes the nearest hit, so it is correct for the
// concave bays too, where a bounding radius would be wildly optimistic.
function outlineRadiusAt(pts, ang) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        const ex = q.x - p.x, ey = q.y - p.y;
        const den = ex * dy - dx * ey;
        if (Math.abs(den) < 1e-9) continue;          // edge parallel to the ray
        const t = (ex * p.y - ey * p.x) / den;       // distance along the ray
        const u = (dx * p.y - dy * p.x) / den;       // position along the edge
        if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
    }
    return Number.isFinite(best) ? best : 0;
}

// Andrew's monotone chain. Wound the same way as the old generated outlines
// (increasing theta) so satPolygonPolygon sees the winding it always has.
function convexHullOf(pts) {
    if (pts.length < 3) return pts.slice();
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const q of p) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
        lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
        const q = p[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
        upper.push(q);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
}

// `artOverride` is an AUTHORED outline in local coordinates — hand-placed ice from a
// venue document, where the shape is designed rather than generated. Everything else
// still comes from the race RNG, so an authored floe has a designed position and shape
// but a fresh drift, spin and wander every race.
function makeFloe(cx, cy, r, rng, artOverride) {
    // The drawn outline may be deeply concave; the COLLIDER is its convex hull,
    // because satPolygonPolygon assumes convexity — feed it a bayed polygon and
    // boats "hit" open water inside the bay. Hulling outward is the safe error:
    // a boat may stop a little short of a cleft, but never sails through ice.
    const localArt = artOverride || makeFloeOutline(r, rng);
    const localHull = convexHullOf(localArt);
    const localVeg = localArt.map(p => ({ x: p.x * 0.7, y: p.y * 0.7 }));
    // World-space mirrors; syncFloe rebuilds these from the local shape each frame
    const vertices = localHull.map(p => ({ x: cx + p.x, y: cy + p.y }));
    const vegVertices = localVeg.map(p => ({ x: cx + p.x, y: cy + p.y }));

    // Pressure cracks: 2-4 jagged strokes across the surface (relative coords,
    // baked into the sprite so they ride along as the floe drifts).
    //
    // Placed against the outline's LOCAL radius, not the floe's bounding r. Only
    // the widest point of a lobed or elongated floe reaches r, so a fraction of
    // r fired down a narrow axis lands well outside the ice — which is exactly
    // how cracks ended up hanging in open water. (The bake also clips them to
    // the silhouette, which catches the curve's bulge between the endpoints.)
    const cracks = [];
    const crackCount = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < crackCount; k++) {
        const a1 = rng() * Math.PI * 2;
        const a2 = a1 + Math.PI * (0.6 + rng() * 0.5);
        const e1 = outlineRadiusAt(localArt, a1), e2 = outlineRadiusAt(localArt, a2);
        const r1 = e1 * (0.25 + rng() * 0.5), r2 = e2 * (0.3 + rng() * 0.55);
        const midJitter = (rng() - 0.5) * Math.min(e1, e2) * 0.3;
        cracks.push({
            ax: Math.cos(a1) * r1, ay: Math.sin(a1) * r1,
            mx: Math.cos((a1 + a2) / 2) * midJitter, my: Math.sin((a1 + a2) / 2) * midJitter,
            bx: Math.cos(a2) * r2, by: Math.sin(a2) * r2
        });
    }

    // Angular facet planes — the low-poly ice look the style guide calls for.
    // Indexed against the ART outline, which is what gets drawn.
    const facets = [];
    if (r > 110) {
        const facetCount = 2 + Math.floor(rng() * 4);
        for (let k = 0; k < facetCount; k++) {
            facets.push({ i: Math.floor(rng() * localArt.length), depth: 0.1 + rng() * 0.3, shade: rng() });
        }
    }

    // Each floe wanders on its OWN heading and rate — the pack has no common
    // direction. Bergs are ponderous; drift ice skates.
    const speed = (8 + rng() * 14) * (r > 220 ? 0.45 : 1); // units/sec
    const dir = rng() * Math.PI * 2;

    return {
        // soft: true — RRS 31 penalizes touching MARKS, not obstructions.
        // Hitting ice costs you 60% of your speed (hull damage), not a 360;
        // rules penalties in the Arctic come from fouling BOATS (incl. Rule 19
        // squeezes into the ice, which stay very much illegal).
        x: cx, y: cy, radius: r, vertices, vegVertices, trees: [], rocks: [], cracks, facets, soft: true,
        style: 'ice', isFloe: true,
        localArt, localHull, localVeg,
        driftVx: Math.sin(dir) * speed,
        driftVy: -Math.cos(dir) * speed,
        // Ice spins as it drifts. Small pans twirl, bergs barely turn.
        spin: rng() * Math.PI * 2,
        spinRate: clampSpin((rng() < 0.5 ? -1 : 1) * (0.08 + rng() * 0.27) * (r > 220 ? 0.4 : 1), r),
        // Slow heading curl so paths curve instead of running straight
        wanderPhase: rng() * Math.PI * 2,
        wanderRate: 0.1 + rng() * 0.25
    };
}

// ---- Floe colonies ------------------------------------------------------
//
// Penguins ride the ice. Every bird lives in its floe's LOCAL space, which is
// what makes this nearly free: the floe already drifts, curls its heading and
// spins, and drawIslands already draws it inside a translate/rotate. Put the
// birds in that same transform and the whole colony inherits the motion with
// no animation code at all — the waddle below is only what the bird adds on
// top of a ride it gets for nothing.
//
// One species per floe. Real rookeries are single-species, and mixing them
// would throw away the only channel species actually reads on: a colony that
// all moves the same way is recognisably one kind of animal.

// Fraction of the outline radius birds stay inside. They draw from their
// centre, so this has to clear half a bird plus the snow rim, or they stand
// with one foot in the water.
const COLONY_INSET = 0.72;

// Waddle gait. The rock and the forward step are ONE motion — see updateFloeColony.
// WADDLE_SURGE is the floor of forward speed at mid-lean; the rest is delivered in
// two surges per rock cycle, as the bird pivots over each foot. Lower = more
// lurching, 1.0 = a constant glide with an unrelated wobble on top.
const WADDLE_SURGE = 0.35;
// Rock amplitude retained while standing still, so an idle bird settles rather
// than freezing solid.
const WADDLE_IDLE = 0.12;
// Max turn rate, rad/s, when steering back off a boundary. Birds STEER toward a
// legal heading rather than being assigned one — an instant assignment flipped a
// bird up to 176 degrees in one frame and re-fired every frame while it sat on
// the boundary. Halved from 2.6: a bird that spins on the spot reads as a
// weathervane, and a penguin turns its whole body slowly.
const WADDLE_TURN = 1.3;
// Peak rate of the wandering heading curl, rad/s. Halved from 0.9 for the same
// reason — this is the meander you see while a bird is walking freely.
const WADDLE_CURL = 0.45;




// Translate only — the world-space geometry is rebuilt by syncFloe once all
// motion and collisions for the frame have settled.
function moveFloe(isl, dx, dy) {
    isl.x += dx; isl.y += dy;
}

// Rebuild the world-space collider and snow cap from the floe's local shape,
// its position and its current spin.
function syncFloe(isl) {
    const c = Math.cos(isl.spin), s = Math.sin(isl.spin);
    for (let i = 0; i < isl.localHull.length; i++) {
        const p = isl.localHull[i], w = isl.vertices[i];
        w.x = isl.x + p.x * c - p.y * s;
        w.y = isl.y + p.x * s + p.y * c;
    }
    for (let i = 0; i < isl.localVeg.length; i++) {
        const p = isl.localVeg[i], w = isl.vegVertices[i];
        w.x = isl.x + p.x * c - p.y * s;
        w.y = isl.y + p.x * s + p.y * c;
    }
}




// Calving: the face drops new ice into the water DURING the race. This is the
// one hazard that makes lap three a different course from lap one — the gap you
// used on the way up may not be there on the way back.
//
// Deliberately conservative: a hard cap on total spawns, a clear-water check
// against every boat and every existing floe, and nothing spawned before the
// start. A berg materializing on top of a boat would be unfair in a way no
// amount of drama pays for.


// The bots' grid, refreshed with the floes where they ARE. The static build knows
// only authored land, so the router threaded floe fields blind and the fleet ground
// through the pack at 60% speed loss per contact-frame. Rebuilding nav+clearance
// often keeps route, carrot and escape all seeing the same true water.
// The wind fields ride along from the static build — regions don't move.
//
// ⚠️ `state.time` IS NOT SECONDS. It is the world clock, which advances at
// WORLD_CLOCK of real time — it exists to phase animations, not to measure them.
// Gating this rebuild on `state.time - t < 4` therefore bought a 16.67-SECOND
// cadence, not the 4 it reads as, while the floe positions carried a lead sized for
// a 4s one. Measured on arctic before the fix: rebuilds landed 16.68s apart, NO
// floe-blocked cell changed state within 8s (the map was simply frozen for five to
// eight consecutive replans), then 24% flipped by 30s and the whole far plan snapped
// at once. Boats were routing, probing and dodging against ice that had already
// drifted away — which is why every attempt to re-price the avoidance cost failed
// against it, including the mean deflection pinned at 46-48° through twelve
// candidates. It moved to 42° the moment the map became true.
const BOT_GRID_EVERY = 2;                       // SECONDS between floe-map rebuilds
// How far ahead of the rebuild the stamped floe positions sit. Held at the literal 2s
// the 16-seed gate actually ran on. A derived half-cadence lead — genuinely mid-life
// for the map rather than always running late — is a separate candidate under its own
// probe, and tidier arithmetic is not a reason to ship an ungated number.
const BOT_GRID_LEAD = 2;
function refreshBotGrid() {
    const c = state.course;
    if (!c || !c._gridFixed || !c._botGridStatic || !window.SailCheck) return;
    if (c._botGridT != null && state.time - c._botGridT < BOT_GRID_EVERY * WORLD_CLOCK) return;
    c._botGridT = state.time;
    // Floes go in as their HULL POLYGONS, not bounding circles. A lobed floe's
    // circle is fatter than its collider almost everywhere — with 112 of them the
    // circle-stamped grid closed 200-unit gaps that physically exist, and the
    // "impossible" rounding maze was partly an artifact of the AI's own map.
    // Positions at the MID-CADENCE prediction, which is now genuinely mid-cadence.
    const floePolys = [];
    const floeCircles = [];
    for (const f of (c.islands || [])) {
        if (!f.isFloe) continue;
        const sx = (f.driftVx || 0) * BOT_GRID_LEAD, sy = (f.driftVy || 0) * BOT_GRID_LEAD;
        if (f.vertices && f.vertices.length >= 3) {
            floePolys.push({ outer: f.vertices.map(v => [v.x + sx, v.y + sy]), holes: [] });
        } else {
            floeCircles.push({ x: f.x + sx, y: f.y + sy, radius: (f.radius || 0) + 15 });
        }
    }
    // Stamped onto the static land nav, not rebuilt from scratch: the land half of
    // this answer never changes, and at a 2s cadence re-deriving it costs 48.8ms a
    // rebuild against 1.4ms. Cell-for-cell identical to buildGrid — asserted by
    // eval/rl/_grid_stamp_check.js, not assumed.
    const g = window.SailCheck.stampFloes(c._botGridStatic, floePolys, floeCircles);
    g._leeW = c._botGridStatic._leeW;
    g._wfx = c._botGridStatic._wfx;
    g._wfy = c._botGridStatic._wfy;
    g._wbin = c._botGridStatic._wbin;
    // Shoals do not drift and are not stamped, so the field carries straight over. Left
    // off, every floe rebuild would silently hand the router a course with no bars in it
    // and the fleet's route would flip back and forth on a two-second cadence.
    g._shoal = c._botGridStatic._shoal;
    // FLOE RISK: water near drifting ice is worth avoiding when open water is
    // affordable — the router should go AROUND a pack unless threading it is
    // clearly cheaper on the polar (this is what lets a route be "wider than the
    // narrowest channel"). Bounded like every hint, so it can never invert the
    // topology; a pack across the only channel still gets threaded.
    const risk = new Uint8Array(g.n * g.n);
    for (const f0 of (c.islands || [])) {
        if (!f0.isFloe) continue;
        const f = { x: f0.x + (f0.driftVx || 0) * BOT_GRID_LEAD, y: f0.y + (f0.driftVy || 0) * BOT_GRID_LEAD, radius: f0.radius || 0 };
        const rr = f.radius + 36;
        const c0 = g.cell(f.x - rr, f.y - rr), c1 = g.cell(f.x + rr, f.y + rr);
        for (let j = Math.max(0, c0[1]); j <= Math.min(g.n - 1, c1[1]); j++) {
            for (let i = Math.max(0, c0[0]); i <= Math.min(g.n - 1, c1[0]); i++) {
                const [wx, wy] = g.world(i, j);
                if ((wx - f.x) ** 2 + (wy - f.y) ** 2 < rr * rr) risk[j * g.n + i] = 1;
            }
        }
    }
    g._floeRisk = risk;
    // Live floe objects, cached for the bots' trajectory planner (allocating a
    // filtered list per controller tick is pure garbage pressure).
    c._floeObjs = (c.islands || []).filter(i => i.isFloe);
    // SOFT CELLS + LEADS. Water blocked by FLOES ONLY (navigable on the land-only
    // static grid) is soft — ice contact costs speed, not a penalty. And because
    // every floe's drift is KNOWN, each soft cell can be priced by its FUTURE:
    // a lead that is OPENING (floe gone in ~8s) is water you arrive at as it
    // clears; one that stays plugged is nearly a wall. Sea-ice pilots route on
    // exactly this: take the opening lead, never the closing one.
    const HORIZON = 8;
    const futureBlk = new Uint8Array(g.n * g.n);
    for (const f0 of (c.islands || [])) {
        if (!f0.isFloe) continue;
        const fx = f0.x + (f0.driftVx || 0) * HORIZON, fy = f0.y + (f0.driftVy || 0) * HORIZON;
        const rr = (f0.radius || 0) + 15 + 13;
        const c0 = g.cell(fx - rr, fy - rr), c1 = g.cell(fx + rr, fy + rr);
        for (let j = Math.max(0, c0[1]); j <= Math.min(g.n - 1, c1[1]); j++) {
            for (let i = Math.max(0, c0[0]); i <= Math.min(g.n - 1, c1[0]); i++) {
                const [wx, wy] = g.world(i, j);
                if ((wx - fx) ** 2 + (wy - fy) ** 2 < rr * rr) futureBlk[j * g.n + i] = 1;
            }
        }
    }
    // _soft: 0 = not soft; 1 = OPENING lead; 2 = staying plugged.
    const soft = new Uint8Array(g.n * g.n);
    const statNav = c._botGridStatic.nav;
    for (let ii = 0; ii < soft.length; ii++) {
        if (statNav[ii] === 1 && g.nav[ii] === 0) soft[ii] = futureBlk[ii] ? 2 : 1;
    }
    g._soft = soft;
    // Persist the +8s occupancy for the ring scans: a sector that is clear NOW
    // but CLOSING is the worst place to wait (measured 104/146 armed seconds
    // lost in one) — the scans discount it and prefer opening leads.
    g._futBlk = futureBlk;
    c.botGrid = g;   // _clear is rebuilt lazily on first pathSailable
}

function updateIceFloes(dt) {
    if (!state.course.islands) return;
    const boundary = state.course.boundary;
    if (!boundary) return;

    // Ice drifts at ~2-3% of the wind, skewed slightly off the wind axis.
    // (0.55 -> 0.45: slower ice erodes the AI's avoidance margins less)
    const d = state.wind.direction;
    const base = state.wind.speed * 0.45; // units/sec at driftFactor 1

    // Floes moved: invalidate the planner's inflated-island cache
    if (state.course.navVersion !== undefined) state.course.navVersion++;
    refreshBotGrid();

    const floes = [];
    for (const isl of state.course.islands) {
        if (!isl.isFloe) continue;
        floes.push(isl);

        // Slow deterministic heading curl: each floe's own velocity rotates
        // gently, so paths curve and meander without any per-frame RNG.
        const curl = Math.sin(state.time * isl.wanderRate + isl.wanderPhase) * 0.12 * dt;
        const cosC = Math.cos(curl), sinC = Math.sin(curl);
        const nvx = isl.driftVx * cosC - isl.driftVy * sinC;
        isl.driftVy = isl.driftVx * sinC + isl.driftVy * cosC;
        isl.driftVx = nvx;

        moveFloe(isl, isl.driftVx * dt, isl.driftVy * dt);
        isl.spin += isl.spinRate * dt;

        // Arena rim: bounce back inward (reflect velocity about the inward
        // normal) instead of teleport-respawning.
        // Keep half a floe-radius of clearance from the edge, whatever shape it is.
        const _inset = isl.radius * 0.5;
        const _scn2 = state.course.scenery || boundary;
        const _sd = Arena.signedDist(_scn2, isl.x, isl.y);
        if (_sd < _inset) {
            const n = Arena.outward(_scn2, isl.x, isl.y);
            const dot = isl.driftVx * n.x + isl.driftVy * n.y;
            if (dot > 0) {
                isl.driftVx -= 2 * dot * n.x;
                isl.driftVy -= 2 * dot * n.y;
            }
            // ABSOLUTE, deliberately: the scenery extent is the one edge nothing may be seen
            // outside, so it is restored in full every frame rather than eased like the land
            // and ice-on-ice corrections. Capping it to their rate let those two push a floe
            // out faster than this could pull it back, and ice escaped by up to 1015 units.
            //
            // It cannot jump visibly any more, because the case that made it jump is gone:
            // a floe authored far outside used to be hauled 300-941 units on the first frame,
            // and settleFloes() now resolves that before anything is drawn. What is left here
            // is drift, which is a fraction of a unit per frame.
            moveFloe(isl, (_sd - _inset) * n.x, (_sd - _inset) * n.y);
        }

    }

    // Floe-on-floe BOUNCE: mass-weighted positional separation plus an
    // elastic velocity reflection — converging ice visibly rebounds, bergs
    // barely notice, small floes ricochet.
    for (let i = 0; i < floes.length; i++) {
        for (let j = i + 1; j < floes.length; j++) {
            const a = floes[i], b = floes[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const minD = (a.radius + b.radius) * 0.92; // vertices are jagged; slight visual overlap is fine
            const d2 = dx * dx + dy * dy;
            if (d2 >= minD * minD || d2 < 1) continue;
            const dist = Math.sqrt(d2);
            const nx = dx / dist, ny = dy / dist;
            const overlap = minD - dist;
            const mA = a.radius * a.radius, mB = b.radius * b.radius;
            const shareA = mB / (mA + mB), shareB = mA / (mA + mB);
            // CAPPED to the same rate as every other correction here, so no floe is ever moved
            // faster than it can be seen to move. settleFloes() clears the authored overlaps
            // before the first frame, but a pinch — ice held against ice by a shore that will
            // not yield — has no solution to converge to, and resolving one of those in a
            // single uncapped step is exactly the jump this whole pass exists to prevent.
            const corr = Math.min(overlap, Math.max(2, FLOE_PUSH_RATE * dt));
            moveFloe(a, -nx * corr * shareA, -ny * corr * shareA);
            moveFloe(b, nx * corr * shareB, ny * corr * shareB);

            // 1D elastic collision along the normal (restitution 0.85)
            const vaN = a.driftVx * nx + a.driftVy * ny;
            const vbN = b.driftVx * nx + b.driftVy * ny;
            if (vaN - vbN > 0) { // closing
                const e = 0.85;
                const vaN2 = (mA * vaN + mB * vbN - mB * e * (vaN - vbN)) / (mA + mB);
                const vbN2 = (mA * vaN + mB * vbN + mA * e * (vaN - vbN)) / (mA + mB);
                a.driftVx += (vaN2 - vaN) * nx; a.driftVy += (vaN2 - vaN) * ny;
                b.driftVx += (vbN2 - vbN) * nx; b.driftVy += (vbN2 - vbN) * ny;

                // Glancing blows spin the ice up. Tangential closing speed
                // becomes angular impulse, scaled down by size so a berg shrugs
                // it off while a small pan gets kicked into a twirl.
                const vRelT = (a.driftVx - b.driftVx) * -ny + (a.driftVy - b.driftVy) * nx;
                a.spinRate = clampSpin(a.spinRate - vRelT * 0.9 / a.radius, a.radius);
                b.spinRate = clampSpin(b.spinRate + vRelT * 0.9 / b.radius, b.radius);
            }
        }
    }

    // One rebuild per floe, after every push and bounce has settled
    for (const isl of floes) syncFloe(isl);

    // Shore pass, last, so the coastline always wins: the floe-on-floe separation above can
    // shove ice back into land, and whatever land says here is what stands this frame.
    //
    // ICE IS PUSHED OFF A SHORE, NEVER TELEPORTED OFF IT. This used to sample a random point
    // in the scenery and jump the floe there — a berg vanishing from one headland and
    // reappearing half a course away, 58 times in a three-minute race on Glacier Sound with
    // 112 authored floes. Nothing about a drifting object may be discontinuous; a player
    // watching a berg has every right to expect it to still be there.
    //
    // So: find the shortest way out of the polygon and take a step along it, and reflect the
    // drift that was carrying the floe in. A floe deep inside a shape needs several frames to
    // walk out, which is correct — it slides off the shore the way it slid on.
    // A RATE, not a per-frame constant: the push is a velocity like any other motion, so it
    // looks the same at 30fps as at 144 and a big berg leaves a shore no faster than a small
    // one. 150 units/sec against a drift of about 9 — firm, and still plainly movement.
    for (const f of floes) pushFloeOffLand(f, Math.max(2, FLOE_PUSH_RATE * dt));
}

// How fast ice is pushed out of land it has drifted into, in units/sec.
const FLOE_PUSH_RATE = 150;

// The shortest way out of any land this floe overlaps, taken as a step of at most `maxStep`.
// Shared by the per-frame shore pass and the settle pass that runs once at course build, so
// the two cannot disagree about which way "out" is.
function pushFloeOffLand(f, maxStep) {
    const land = state.course.landShapes;
    if (!land) return false;
    let moved = false;
    for (const isl of land) {
        const R = f.radius * 0.9;
        if (!circlePolyCollide(f.x, f.y, R, isl.vertices)) continue;
        // Nearest point on the outline, and which side of it the centre is on.
        const verts = isl.vertices;
        let bestD2 = Infinity, bx = 0, by = 0;
        for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
            const q = getClosestPointOnSegment(f.x, f.y, verts[j].x, verts[j].y, verts[i].x, verts[i].y);
            const dx = f.x - q.x, dy = f.y - q.y, d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; bx = q.x; by = q.y; }
        }
        const inside = pointInPoly(f.x, f.y, verts);
        const d = Math.sqrt(bestD2) || 1e-6;
        // Outward: away from the outline when the centre is already outside it, toward the
        // outline when the centre has ended up within.
        let ox = (f.x - bx) / d, oy = (f.y - by) / d;
        if (inside) { ox = -ox; oy = -oy; }
        const need = inside ? (d + R) : (R - d);
        if (!(need > 0)) continue;
        const step = Math.min(need, maxStep);
        moveFloe(f, ox * step, oy * step);
        // Kill the drift still carrying it in, with a little bounce.
        const into = f.driftVx * ox + f.driftVy * oy;
        if (into < 0) {
            f.driftVx -= 1.6 * into * ox;
            f.driftVy -= 1.6 * into * oy;
        }
        moved = true;
    }
    if (moved) syncFloe(f);
    return moved;
}

// Resolve authored overlaps ONCE, before the first frame is ever drawn.
//
// A document may place ice over land or outside the scenery — nothing stops it, and Glacier
// Sound's 112 hand-placed floes do both. Left to the per-frame push those would spend the
// opening seconds visibly sliding out, which is the same complaint as the teleport in a
// politer voice. Doing it here means the race opens with the ice where it will actually be.
function settleFloes() {
    const floes = (state.course.islands || []).filter(i => i.isFloe);
    if (!floes.length) return;
    const scn = state.course.scenery || state.course.boundary;

    // Rim, land and ice-on-ice are ONE relaxation, not three phases in sequence: pushing a
    // floe off a headland can bury it in its neighbour, and separating that pair can put one
    // of them back on the headland. Run in sequence, whichever ran last won and the loser was
    // still overlapping when the first frame arrived — which the uncapped per-frame bounce
    // then resolved in a single visible jump. Interleaved, they converge.
    for (let round = 0; round < 16; round++) {
        let worst = 0;
        const before = floes.map(f => ({ x: f.x, y: f.y }));

        for (const f of floes) {
            if (scn) {
                const inset = f.radius * 0.5;
                const sd = Arena.signedDist(scn, f.x, f.y);
                if (sd < inset) {
                    const n = Arena.outward(scn, f.x, f.y);
                    moveFloe(f, -(inset - sd) * n.x, -(inset - sd) * n.y);
                }
            }
            // Uncapped here: nothing is on screen yet, so there is no motion to be smooth.
            for (let k = 0; k < 8; k++) if (!pushFloeOffLand(f, f.radius)) break;
        }

        // Positions only — no velocity change. Nothing has collided; they were simply drawn
        // overlapping, and a document's ice should not start the race already rebounding.
        for (let i = 0; i < floes.length; i++) {
            for (let j = i + 1; j < floes.length; j++) {
                const a = floes[i], b = floes[j];
                const dx = b.x - a.x, dy = b.y - a.y;
                const minD = (a.radius + b.radius) * 0.92;
                const d2 = dx * dx + dy * dy;
                if (d2 >= minD * minD || d2 < 1) continue;
                const dist = Math.sqrt(d2);
                const nx = dx / dist, ny = dy / dist, overlap = minD - dist;
                const mA = a.radius * a.radius, mB = b.radius * b.radius;
                moveFloe(a, -nx * overlap * (mB / (mA + mB)), -ny * overlap * (mB / (mA + mB)));
                moveFloe(b, nx * overlap * (mA / (mA + mB)), ny * overlap * (mA / (mA + mB)));
            }
        }

        for (let i = 0; i < floes.length; i++) {
            const d = Math.hypot(floes[i].x - before[i].x, floes[i].y - before[i].y);
            if (d > worst) worst = d;
        }
        if (worst < 0.5) break;
    }

    // THE RIM HAS THE LAST WORD, so "inside the scenery extent" is this function's guarantee
    // and not merely its usual outcome. The relaxation above does not always reach it: five of
    // Glacier Sound's floes are big enough (radius 519 to 1095) to be pushed back out by land
    // as fast as the rim pulls them in, and they were still up to 941 units outside when the
    // loop gave up — which the per-frame clamp then took back in one visible jump.
    //
    // A floe left touching land here is fine: the per-frame shore push eases it off over the
    // next second at a rate nobody reads as a jump. A floe left outside the world is not.
    if (scn) {
        for (const f of floes) {
            // Iterated: one correction is exact against the nearest EDGE, and a floe pushed
            // in past a corner can come to rest outside a different one.
            for (let k = 0; k < 8; k++) {
                const inset = f.radius * 0.5;
                const sd = Arena.signedDist(scn, f.x, f.y);
                if (sd >= inset) break;
                const n = Arena.outward(scn, f.x, f.y);
                moveFloe(f, -(inset - sd) * n.x, -(inset - sd) * n.y);
            }
        }
    }
    for (const f of floes) syncFloe(f);
}

// (clearOfCourse lived here. It vetoed a relocation that landed on the start line or a mark,
// which was the right guard on the wrong mechanism — ice is pushed off a shore now and never
// relocated at all, so there is no random destination left to veto.)

// Ice that spins faster than this reads as a cartoon top, not a floe
// Radius-aware: big ice may not spin fast. A flat cap let a collision-kicked
// berg sweep its rim at hundreds of u/s — invisible to every predictor that
// extrapolates floes by drift alone, and measured as the dominant motion in
// floe contacts (median 28.6 u/s rotational vs 5 drift). min(0.75, 30/r)
// leaves small pans twirling (r<100 median |w| 0.28) and holds every rim to
// ~30 u/s, the same order as drift.
function clampSpin(w, r) {
    const cap = Math.min(0.75, 30 / Math.max(1, r));
    return Math.max(-cap, Math.min(cap, w));
}

// FL1 — the floe as the planner sees it: a MOVING, ROTATING POLYGON with a
// clear boundary (owner-directed). Per-floe radial profile of the convex
// localHull, cached once (shape never changes): r(θ) in 32 bins from the
// floe origin. A point test at lookahead t rotates the query into the local
// frame at the PREDICTED spin (spin + spinRate·t) and compares |P| against
// the interpolated profile + pad. O(1) per test — the same order as the
// circle test it grades, so rollouts can afford the true shape.
const FL1_BINS = 32;
function floeRadialProfile(f) {
    if (f._radProf) return f._radProf;
    const H = f.localHull;
    if (!H || H.length < 3) return null;
    const prof = new Float32Array(FL1_BINS);
    for (let b = 0; b < FL1_BINS; b++) {
        const th = (b / FL1_BINS) * 2 * Math.PI;
        const rx = Math.cos(th), ry = Math.sin(th);
        let best = 0;
        for (let i = 0; i < H.length; i++) {
            const a = H[i], c = H[(i + 1) % H.length];
            const ex = c.x - a.x, ey = c.y - a.y;
            const den = rx * ey - ry * ex;
            if (Math.abs(den) < 1e-9) continue;
            const s = (a.x * ey - a.y * ex) / den;          // ray parameter
            const u = (a.x * ry - a.y * rx) / den;           // edge parameter
            if (s > 0 && u >= -1e-6 && u <= 1 + 1e-6 && s > best) best = s;
        }
        prof[b] = best || (f.radius || 0);
    }
    f._radProf = prof;
    return prof;
}
// FL1b — segment and clearance forms of the same true-hull test, for the
// near-field wall check (which was mixing current-spin polygons with circle
// OR-fallbacks — the phantom re-entry FL1 removed from the far field).
function floeSegNear(f, ax, ay, bx, by, t, pad) {
    for (let i = 0; i <= 8; i++) {
        const px = ax + (bx - ax) * i / 8, py = ay + (by - ay) * i / 8;
        if (floeHullNear(f, px - f.x, py - f.y, t, pad)) return true;
    }
    return false;
}
// Radial clearance (u) from a world point to the floe's predicted hull.
function floeHullClear(f, px, py, t) {
    const prof = floeRadialProfile(f);
    const dx = px - f.x, dy = py - f.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (!prof) return d - (f.radius || 0);
    const sp = (f.spin || 0) + (f.spinRate || 0) * t;
    const th = Math.atan2(dy, dx) - sp;
    let bf = (th / (2 * Math.PI)) * FL1_BINS;
    bf = ((bf % FL1_BINS) + FL1_BINS) % FL1_BINS;
    const b0 = Math.floor(bf), b1 = (b0 + 1) % FL1_BINS, w = bf - b0;
    return d - (prof[b0] * (1 - w) + prof[b1] * w);
}
// dx,dy: query point relative to the floe's (predicted) centre, world frame.
function floeHullNear(f, dx, dy, t, pad) {
    const prof = floeRadialProfile(f);
    if (!prof) return true;                                  // no hull — keep the circle verdict
    const sp = (f.spin || 0) + (f.spinRate || 0) * t;
    const th = Math.atan2(dy, dx) - sp;                      // local-frame bearing
    const d = Math.sqrt(dx * dx + dy * dy);
    let bf = (th / (2 * Math.PI)) * FL1_BINS;
    bf = ((bf % FL1_BINS) + FL1_BINS) % FL1_BINS;
    const b0 = Math.floor(bf), b1 = (b0 + 1) % FL1_BINS, w = bf - b0;
    const r = prof[b0] * (1 - w) + prof[b1] * w;
    return d < r + pad;
}

// ---------------------------------------------------------------------------




// J/111 Polar Data
