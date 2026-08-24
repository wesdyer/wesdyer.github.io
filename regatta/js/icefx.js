// ICE FX — SPINDRIFT: wind-torn snow streaming off the ice and dying a few boat
// lengths downwind. The katabatic story ("freezing winds pour off the ice cap") made
// visible at every shoreline.
//
// ⚠️ GATED ON THE DOCUMENT, drawn from the GEOMETRY. A venue opts in with
// `fx.spindrift` beside `fx.snowfall`, but nothing here is authored per emitter: the
// sources are computed from the compiled islands — any outline segment whose outward
// normal points roughly downwind of the LOCAL wind is a shedding edge. That buys three
// things for free: the coast sheds from whichever edge the regional wind says, and a
// katabatic puff crossing a lee shore locally raises the stream — the gust is
// visible at the shoreline before it reaches the boat.
//
// THE KIND LADDER — snow > granite, per the owner's brief. Kind scales BOTH density
// and longevity: snow coast sheds full plumes that carry farthest; granite gives
// short sparse wisps — its spindrift is the drawn snow RIM shedding, not the rock,
// so it gets no haze layer and the shortest life. ⚠️ FLOES SHED NOTHING (owner's
// call, Aug 2026): a drifting berg lives in the wind on every side and is scoured
// bare — there is no settled snow on it to lift. kindOf returns null for isFloe
// BEFORE the style test, because a floe's style IS 'ice' and would otherwise put
// the whole pack on the snow rung.
//
// "WON'T EXTEND FOREVER" is the particle life, not a distance clamp: reach is
// life x ride speed, so plumes stretch in a gust and the tail thins out rather than
// hitting a wall. White over white ice is invisible; the streaks materialise as they
// cross onto dark water — which is exactly where real spindrift becomes visible, so
// the contrast gradient comes free and no land mask is needed.
//
// ⚠️ STREAMERS, NOT DASHES — the rapids-foam lesson again, settled by the owner's
// reference photos (Aug 2026: two peaks shedding plumes, one arctic Norway ground
// blow). Real spindrift is SMOKE: connected sinuous veils, dense where they tear off
// the edge and dispersing downwind. The first build drew each particle as a short
// line along its velocity and the owner read it as RAIN. Now every spawn records a
// trail of where its head has been, capped so an old plume DETACHES from its edge
// and drifts off whole before it dies, which is what the photographs show a gust's
// worth of snow doing.
//
// ⚠️ AND THE TRAIL IS DRAWN AS CLOUD, NOT AS A STROKE (owner, round two: "wispy
// clouds coming off the objects"). A stroked ribbon — even tapering — still reads as
// a solid strand. Each trail point is a soft radial puff instead, small and brightest
// at the lift-off end, swelling and fading toward the downwind tip; the puffs overlap
// ~2:1 so the chain fuses into one billowing veil with no visible beads. Dispersion
// is drawn literally: radius grows ~4x along the plume while alpha falls away.
//
// ⚠️ AND IT NEVER TOUCHES THE SIMULATION — the seafx contract, verbatim. Own seeded
// PRNG (never Math.random: the sim stream), own arrays, and ALL work happens in
// draw() with a wall-clock dt like the snowfall overlay, so a headless eval never
// pays a millisecond for it. It reads islands, the camera and getWindAt; it writes
// nothing back. The AI cannot see it because there is nothing of it to see.
(function () {
'use strict';

const KT_TO_U = 15;             // units/second per knot — same figure as seafx.js

// ── THE KNOBS ────────────────────────────────────────────────────────────────
// DENSITY is the one the owner is undecided on: streamers per second per weighted
// unit of shedding shoreline. 0.035 targets ~100 live plumes with a full lee coast
// on screen in an 18 kn breeze — each is ~4x the visual mass of the dashes the first
// build spawned, so the count came down as the element grew.
const DENSITY = 0.030;
const WIND_MIN = 8;             // kn — below this a snow edge holds its snow
const WIND_FULL = 18;           // kn — full stream; the ramp between is linear
const FACE_MIN = 0.35;          // dot(outward normal, blow) — lee edges only
const PART_MAX = 240;           // hard cap, streamers and haze together
const REFRESH_S = 0.5;          // emitter cache rebuild period, sim seconds
const RIDE = 0.7;               // fraction of the wind the snow rides at (surface air)
const DRAG = 2.5;               // 1/s — relaxation onto the air, integrated exactly
const LIFE_BASE = 3.2;          // s — scaled by kind, then randomized 0.7-1.3x
const HAZE_EVERY = 5;           // 1 in N spawns on snow edges is haze, not streamer
// ⚠️ Spacing vs radius is what separates a VEIL from a BEAD CHAIN: at ride speed the
// head moves ~16u between recordings, against a smallest puff radius of 13 — every
// puff overlaps its neighbour. The first cloud pass recorded at 0.09 s with radius 6
// and the plumes came out dotted. ⚠️ And CALL COUNT is the layer's whole frame cost
// (sprite blends are ~4 µs each under software raster, the fill is nearly free), so
// the chain is as COARSE as fusion allows: fewer, bigger puffs, not more small ones.
const SEG_DT = 0.12;            // s of head travel between recorded trail points
const TRAIL_MAX = 8;            // trail points — caps plume span at ~1 s of travel
// GROUND BLOW — the owner's third reference: spindrift snakes ACROSS the snowfield
// too, not just off the edges — over the ridges, the research station, the props.
// Attempted interior spawns per second; rejection-sampled against the land polygons,
// so the realised rate scales with how much snow-holding land is actually in view.
const LAND_RATE = 14;

// The ladder. `rate` multiplies spawn weight, `life` multiplies longevity — so a
// weaker source is sparser AND dies sooner, wispier rather than merely thinner.
// No floe rung — see the scoured-bare rule in the header.
const KINDS = {
    ice:     { rate: 1.0,  life: 1.0  },
    granite: { rate: 0.25, life: 0.5  }
};

// Own stream, seeded — the snowfall/seafx rule. Consuming the sim's RNG from a
// camera-dependent spawn loop is the exact bug documented above snowRand.
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const rnd = mulberry32(90211);

let parts = [];
let srcs = null;                // shedding segments, refreshed at 2 Hz
let srcSum = 0;
let landIsles = [];             // snow-holding islands near the camera, for ground blow
let srcAt = -1e9;
let acc = 0;
let accLand = 0;
let lastT = 0;
let HAZE_SPRITE = null;
let LAYER = null;               // half-res compositing canvas — see draw()

function reset() {
    parts.length = 0; srcs = null; srcSum = 0; landIsles = [];
    srcAt = -1e9; acc = 0; accLand = 0; lastT = 0;
}

// One soft blob, baked once — the snowfall sprite trick. The haze is the body of the
// plume the filaments tear out of; it hugs the edge and barely travels.
function hazeSprite() {
    if (HAZE_SPRITE) return HAZE_SPRITE;
    const s = 48, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    HAZE_SPRITE = c;
    return c;
}

// Which rung of the ladder an island sheds from, or null for kinds that hold no
// snow (sand, reed, karst...) — spindrift is a property of the SNOW, so the test is
// the compiled style, never the venue's name.
function kindOf(isl) {
    if (isl.isFloe) return null;             // scoured bare — see header; MUST precede
    if (isl.style === 'granite') return 'granite';   // the style test: floes are 'ice'
    if (isl.style === 'ice') return 'ice';
    return null;
}

// Rebuild the shedding-segment list: every outline edge, of every snow-holding
// island near the camera, whose outward normal faces downwind of the wind AT THAT
// EDGE. 2 Hz is plenty — regions bend slowly and a spawn point jitters anyway.
function refreshSrcs(state, ring) {
    const cam = state.camera;
    srcs = [];
    srcSum = 0;
    landIsles = [];
    const ring2 = ring * ring;
    for (const isl of state.course.islands || []) {
        if (isl.hidden || isl.awash) continue;
        const kind = kindOf(isl);
        if (!kind) continue;
        const v = isl.vertices;
        if (!v || v.length < 3) continue;
        const bdx = isl.x - cam.x, bdy = isl.y - cam.y;
        const reach = ring + isl.radius;
        if (bdx * bdx + bdy * bdy > reach * reach) continue;
        // In range: this island's surface is ground-blow country too.
        landIsles.push({ x: isl.x, y: isl.y, r2: isl.radius * isl.radius, verts: v, kind });
        // Orientation by shoelace, so the outward normal is right on the deep
        // concave bays too — a centroid test lies on a coast that snakes.
        let A = 0;
        for (let i = 0; i < v.length; i++) {
            const p = v[i], q = v[(i + 1) % v.length];
            A += p.x * q.y - q.x * p.y;
        }
        const s = A > 0 ? 1 : -1;
        const K = KINDS[kind];
        for (let i = 0; i < v.length; i++) {
            const p = v[i], q = v[(i + 1) % v.length];
            const ex = q.x - p.x, ey = q.y - p.y;
            const len = Math.hypot(ex, ey);
            if (len < 6) continue;                       // keyhole slit stubs
            const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
            const ddx = mx - cam.x, ddy = my - cam.y;
            if (ddx * ddx + ddy * ddy > ring2) continue;
            const w = window.getWindAt(mx, my);
            if (w.speed < WIND_MIN) continue;
            // Blow direction: wind.direction is where it comes FROM.
            const bx = -Math.sin(w.direction), by = Math.cos(w.direction);
            const nx = s * ey / len, ny = -s * ex / len;  // outward
            const face = nx * bx + ny * by;
            if (face < FACE_MIN) continue;
            const ramp = Math.min(1, (w.speed - WIND_MIN) / (WIND_FULL - WIND_MIN));
            const wgt = len * face * K.rate * ramp;
            const u = w.speed * KT_TO_U;
            srcs.push({ ax: p.x, ay: p.y, bx: q.x, by: q.y,
                        wx: bx * u, wy: by * u, kind, w: wgt });
            srcSum += wgt;
        }
    }
}

// One plume, whatever tore it loose — `wx, wy` is the blow already in units/s.
function pushPlume(x, y, wx, wy, kind) {
    const K = KINDS[kind];
    const haze = kind !== 'granite' && rnd() * HAZE_EVERY < 1;
    // Rides vary widely so the plumes never move in lockstep — lockstep is half of
    // what made the first build read as rain.
    const ride = RIDE * (0.6 + rnd() * 0.7) * (haze ? 0.35 : 1);
    const life = LIFE_BASE * (haze ? 1.3 : 1) * K.life * (0.7 + rnd() * 0.6);
    parts.push({
        x, y,
        // Born at part speed and relaxing up onto the air — snow leaves the edge
        // slower than the gust that tore it loose.
        vx: wx * ride * 0.4, vy: wy * ride * 0.4,
        wx: wx * ride, wy: wy * ride,
        t: 0, life, haze,
        // Slow, wide serpentine — the reference plumes SNAKE; a fast small flutter
        // reads as static instead.
        amp: haze ? 0 : 18 + rnd() * 30,     // cross-wind wiggle, units/s
        frq: 0.6 + rnd() * 1.2, ph: rnd() * Math.PI * 2,
        r: haze ? 18 + rnd() * 26 : 0,
        a: haze ? 0.05 + rnd() * 0.05
                : (0.10 + rnd() * 0.09) * (kind === 'granite' ? 0.75 : 1),
        sz: kind === 'granite' ? 0.7 : 1,               // granite wisps run thinner
        // The plume: where the head has been. `v` is each puff's own size/alpha
        // variation, rolled once at record time so the cloud's lumps hold still;
        // `i` is a stable serial for the wide-end thinning in draw().
        pts: [{ x, y, v: 0.75 + rnd() * 0.5, i: 0 }], segAcc: 0, seq: 1
    });
}

function spawnOne() {
    let t = rnd() * srcSum;
    let seg = srcs[srcs.length - 1];
    for (const g of srcs) { t -= g.w; if (t <= 0) { seg = g; break; } }
    const u = rnd();
    const x = seg.ax + (seg.bx - seg.ax) * u + (rnd() - 0.5) * 4;
    const y = seg.ay + (seg.by - seg.ay) * u + (rnd() - 0.5) * 4;
    pushPlume(x, y, seg.wx, seg.wy, seg.kind);
}

// Even-odd ray cast — the interior test for ground blow. The coast ring is a few
// hundred vertices and this runs a handful of times a second, not per frame.
function inPoly(v, x, y) {
    let inside = false;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
        const a = v[i], b = v[j];
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

// GROUND BLOW: a plume born on the snow surface itself, not at an edge. Rejection
// sampling does the area weighting for free — a view that is half ice cap accepts
// half the attempts, open water accepts none. Over white snow the plume is nearly
// invisible and becomes visible exactly where the owner asked to see it: crossing
// the ridges, the rock, the research station's props — everything dark that the
// layer, drawn late, passes over.
function spawnLand(state, sampleR) {
    const cam = state.camera;
    for (let k = 0; k < 3; k++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * sampleR;
        const x = cam.x + Math.sin(a) * d, y = cam.y - Math.cos(a) * d;
        for (const L of landIsles) {
            const dx = x - L.x, dy = y - L.y;
            if (dx * dx + dy * dy > L.r2) continue;
            if (!inPoly(L.verts, x, y)) continue;
            const w = window.getWindAt(x, y);
            if (w.speed < WIND_MIN) return;
            const u = w.speed * KT_TO_U;
            pushPlume(x, y, -Math.sin(w.direction) * u, Math.cos(w.direction) * u, L.kind);
            return;
        }
    }
}

// Draw-side everything, like the snowfall overlay: wall-clock dt, clamped so a tab
// switch does not teleport the plumes. Called inside the world transform, AFTER the
// fleet — spindrift is air, and the owner wants it passing over hulls and sails.
function draw(ctx, state) {
    const fx = state && state.race && state.race.venueFx;
    if (!fx || !fx.spindrift || !state.course || !window.getWindAt) {
        if (parts.length) reset();
        return;
    }
    const now = performance.now();
    const dt = lastT ? Math.min(0.05, Math.max(0, (now - lastT) / 1000)) : 1 / 60;
    lastT = now;

    const viewR = Math.hypot(ctx.canvas.width, ctx.canvas.height) * 0.5;
    // The ring reaches past the frame so a shore just off-screen still streams into
    // view — and the CULL sits outside the RING, so a plume born at the ring's edge
    // lives to drift in. The first pass had it inverted (ring 620 out, cull 80 out)
    // and quietly killed every off-screen spawn a frame after paying for it.
    const ring = viewR + 280;
    if (!srcs || state.time - srcAt > REFRESH_S || state.time < srcAt) {
        refreshSrcs(state, ring);
        srcAt = state.time;
    }

    if (srcSum > 0) {
        acc += srcSum * DENSITY * dt;
        let n = Math.floor(acc);
        acc -= n;
        n = Math.min(n, 12);                 // burst bound — the whitecap rule
        while (n-- > 0 && parts.length < PART_MAX) spawnOne();
    }
    // Ground blow across the visible snowfield — see spawnLand.
    if (landIsles.length) {
        accLand += LAND_RATE * dt;
        let n = Math.floor(accLand);
        accLand -= n;
        n = Math.min(n, 6);
        while (n-- > 0 && parts.length < PART_MAX) spawnLand(state, viewR + 60);
    }

    const cam = state.camera;
    const cull2 = (viewR + 340) ** 2;
    const g = 1 - Math.exp(-DRAG * dt);      // exact relaxation — frame-rate proof
    const spr = hazeSprite();

    // HALF-RESOLUTION LAYER, blitted up once — the rapids-foam offscreen pattern at
    // half scale. The layer is all big soft alpha blends, so it is FILL-bound: half
    // resolution quarters the fill, and the upscale's softening is a gift here — a
    // blurrier veil is a wispier veil. Measured 6 ms/frame drawn direct.
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const IFX_RS = 0.25;   // quarter res: the layer is all soft veils and the upscale's
                           // blur is part of the look — half-res was still fill-bound.
    const lw = Math.ceil(w * IFX_RS), lh = Math.ceil(h * IFX_RS);
    if (!LAYER) LAYER = document.createElement('canvas');
    if (LAYER.width !== lw || LAYER.height !== lh) { LAYER.width = lw; LAYER.height = lh; }
    const lg = LAYER.getContext('2d');
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.clearRect(0, 0, lw, lh);
    // Nearest sampling: a drawImage at a FRACTIONAL position under bilinear falls off
    // the rasterizer's fast path (~9x; eval/_blit_matrix.js), and every puff here is a
    // soft radial gradient whose nearest-sampled edge is invisible — doubly so through
    // the half-res upscale below.
    lg.imageSmoothingEnabled = false;
    // ⚠️ NO camera transform on the layer. Every sprite here is a ROUND radial gradient —
    // rotation-invariant — so drawing through the rotated camera bought nothing and paid
    // the rasterizer's generic path on every puff (a rotated drawImage is ~15x an
    // axis-aligned one; eval/_blit_matrix.js). Centres are projected by hand instead and
    // every drawImage below lands axis-aligned.
    const m = ctx.getTransform();
    // Screen-space bounds of everything drawn, so the composite below copies only
    // the rectangle the plumes touched — a full-frame blit costs real milliseconds
    // under software raster and usually carries mostly transparent pixels.
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    const bound = (wx2, wy2, r) => {
        const sx = m.a * wx2 + m.c * wy2 + m.e, sy = m.b * wx2 + m.d * wy2 + m.f;
        if (sx - r < bx0) bx0 = sx - r;
        if (sx + r > bx1) bx1 = sx + r;
        if (sy - r < by0) by0 = sy - r;
        if (sy + r > by1) by1 = sy + r;
    };
    for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t >= p.life) { parts.splice(i, 1); continue; }
        p.vx += (p.wx - p.vx) * g;
        p.vy += (p.wy - p.vy) * g;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.amp) {
            // Serpentine: a wiggle ACROSS the stream, so plumes snake instead of
            // railing straight downwind — the trail records the curve.
            const sp = Math.hypot(p.vx, p.vy) || 1;
            const k = Math.cos(state.time * p.frq + p.ph) * p.amp * dt / sp;
            p.x += -p.vy * k;
            p.y += p.vx * k;
        }
        const dx = p.x - cam.x, dy = p.y - cam.y;
        if (dx * dx + dy * dy > cull2) { parts.splice(i, 1); continue; }

        const q = p.t / p.life;
        const env = Math.min(1, p.t / 0.25) * (q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45);
        if (p.haze) {
            lg.globalAlpha = p.a * env;
            const sx = (m.a * p.x + m.c * p.y + m.e) * IFX_RS;
            const sy = (m.b * p.x + m.d * p.y + m.f) * IFX_RS;
            const hr = p.r * IFX_RS;
            lg.drawImage(spr, sx - hr, sy - hr, hr * 2, hr * 2);
            bound(p.x, p.y, p.r);
            continue;
        }
        // THE PLUME. Record where the head has been, cap the memory, and lay a soft
        // puff on every point: small and brightest at the upwind (oldest) end where
        // the snow tears off, swelling and fading toward the head — dispersion,
        // drawn literally. The puffs overlap about 2:1 at ride speed, so the chain
        // fuses into one veil. When the cap drops old points the plume DETACHES
        // from its edge and drifts off whole, which is what a gust's worth of snow
        // does.
        p.segAcc += dt;
        if (p.segAcc >= SEG_DT) {
            p.segAcc = 0;
            p.pts.push({ x: p.x, y: p.y, v: 0.75 + rnd() * 0.5, i: p.seq++ });
            if (p.pts.length > TRAIL_MAX) p.pts.shift();
        }
        const pts = p.pts;
        const nMax = Math.max(1, pts.length - 1);
        for (let j = 0; j < pts.length; j++) {
            const f = j / nMax;                       // 0 = upwind end, 1 = head
            const pt = pts[j];
            // The wide half is thinned to every second puff — radius there is ~2x
            // the point spacing, so it stays fused. Parity is the point's own serial
            // (`i`), not its array index, so the thinning holds still as old points
            // shift off; index parity made the lumps strobe.
            if (f > 0.5 && (pt.i & 1)) continue;
            const r = (13 + 22 * f) * pt.v * p.sz;
            lg.globalAlpha = p.a * env * (1 - 0.75 * f) * pt.v;
            const sx = (m.a * pt.x + m.c * pt.y + m.e) * IFX_RS;
            const sy = (m.b * pt.x + m.d * pt.y + m.f) * IFX_RS;
            const hr = r * IFX_RS;
            lg.drawImage(spr, sx - hr, sy - hr, hr * 2, hr * 2);
            bound(pt.x, pt.y, r);
        }
    }
    // One blit, in screen space, clipped to what was actually drawn.
    if (bx1 > bx0) {
        const cx0 = Math.max(0, Math.floor(bx0)), cy0 = Math.max(0, Math.floor(by0));
        const cx1 = Math.min(w, Math.ceil(bx1)), cy1 = Math.min(h, Math.ceil(by1));
        if (cx1 > cx0 && cy1 > cy0) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(LAYER, cx0 * IFX_RS, cy0 * IFX_RS,
                          (cx1 - cx0) * IFX_RS, (cy1 - cy0) * IFX_RS,
                          cx0, cy0, cx1 - cx0, cy1 - cy0);
            ctx.restore();
        }
    }
}

window.IceFX = {
    draw, reset,
    // For the tuning pass: count what is actually alive rather than re-deriving it.
    debug: () => {
        const byKind = {};
        for (const g of srcs || []) byKind[g.kind] = (byKind[g.kind] || 0) + g.w;
        return { parts: parts.length, srcs: srcs ? srcs.length : 0, srcSum, byKind };
    }
};
})();
