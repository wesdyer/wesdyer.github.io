// ── TIDE ────────────────────────────────────────────────────────────────────
// Spoonbill Flats' water: ONE CLOCK that floods and drains an estuary, and everything
// that keys off it. A venue with no tidal anchors (the `flats-*` shape kinds, venuedoc.js)
// gets none of this and pays nothing — state.tide stays null and every hook returns early.
//
// THE FIELD. The intertidal ground is a continuous ELEVATION FIELD in metres above mean
// water, rasterised once at the full course build from the document's polygons, Wes's
// way: the deep channels are the low anchor, the saltmarsh the high anchor, and every
// point between them sits at a height set by its normalised distance between the two
// (t = dChannel / (dChannel + dMarsh)), so the flats FILL FROM THE CHANNEL OUTWARD and
// DRY FROM THE MARSH INWARD. A bar polygon lifts its crest, a pool sinks its bed, a
// shelf sets its ground, and a little noise makes the water leave in tongues and pans
// rather than in bands. Nothing else in the game reads polygons for depth: the physics,
// the router, the picture and the instruments all read this one raster.
//
// THE CLOCK. level(t) = mid + amp · sin(2π t / period + phase0), t the race clock, so the
// phase at the gun is phase0 for every boat and every restart — a race is LEARNABLE and a
// replay is the same race. depth = level − ground. Draft-safe water sails free; under a
// clearance margin the mud takes speed (a multiplier on the target, like a bar); below the
// draft the boat is AGROUND: her way is gone, the crew shove her downhill at a walking
// pace, and she refloats when the sine brings the water back. The refloat time is a
// closed-form read off the sine, so the HUD can promise it.
//
// THE CURRENT. Everything flows because the level is changing: channel streams (current
// regions flagged `tidal`) run in proportion to dLevel/dt — slack at high and low water,
// strongest mid-tide, flooding inland and ebbing seaward along the authored regions — and
// on the flats the water pours sideways out of the channel while they fill and drains back
// while they empty, along the gradient of the distance-to-channel field. One clock, one
// answer for the boats, the bots and the streaks.
//
// Nothing here touches the eval RNG: the field is a pure function of the document and the
// level a pure function of the race clock.
'use strict';

const TIDE = {
    period: 60,          // s per full cycle (rise + fall). The knob Wes asked for.
    amp: 1.0,            // m — high water +amp, low water −amp about `mid`
    mid: 0,              // m — mean water
    phase0: 0.0,         // rad — the phase at the gun (0 = mean water, rising)
    draft: 0.5,          // m — under this depth the hull sits on the mud
    free: 0.5,           // m — clearance above the draft at which the water stops costing speed
    minMul: 0.18,        // speed multiplier at zero clearance (just afloat)
    refloat: 0.1,        // m — hysteresis above the draft before a grounded hull is free again
    agroundMin: 1.5,     // s — a touch costs at least this: the crew get her off, they do not bounce
    pushKt: 0.8,         // kt — the crew shoving a grounded hull toward the channel
    // The field.
    res: 16,             // world units per raster cell
    rasterPad: 1100,     // u — the raster reaches this far past the arena: the view's diagonal plus the camera's look-ahead from a boat on the limit
    rimZ: -1.6,          // m — the ground at a channel's edge (0.6 m of water at LW: afloat, slow)
    marshZ: 1.4,         // m — the ground at the marsh edge (never wet: 0.4 m above HW)
    bedFeather: 110,     // u — a channel drops from its rim to its bed over this
    barFeather: 140,     // u — a bar rises from the surrounding flat to its crest over this
    shelfFeather: 50,    // u — a shelf (a marked corridor) is at its depth nearly wall to wall: with the bar's 140 a 420u corridor filled along a 140u stripe
    poolFeather: 90,     // u — a pool's bowl
    gamma: 0.8,          // the shape of the flat between channel and marsh (<1 = rises fast off the channel, so the interior is mud most of the cycle)
    noiseAmp: 0.16,      // m — pans and tongues
    noiseScale: 620,     // u — their size
    noiseFade: 260,      // u — noise is faded to nothing this close to a channel
    // Flow.
    flowRef: 1.0,        // a tidal region's `speed` is its knots at the peak rate
    fillKt: 0.55,        // kt — the cross-stream over the flats at the peak rate
    fillDepth: 1.2,      // m — the fill stream fades out below this depth of water
    fillReach: 1800,     // u — and this far from a channel
    // Bots.
    botMargin: 0.12,     // m — the router's safety margin on top of the draft (0.3 closed the wantij to every bot; the drying edges are priced by edgeTax instead)
    riskHalfW: 300,      // u — a marked passage's cells lie within this of its line (the ladder's rungs, riskStamp)
    escapeR: 260,        // u — how far a boat may plan over ground above its nerve to get off it (500 let a channel sailor carry on over the head sill and dry out on it)
    escapeTax: 3,        // × — and what those steps cost, so the way off is the shortest one
    edgeTax: 2.5,        // × — a router step beside a cell that is dry on arrival (routeCost)
    lead: 3,             // s — the local map is stamped for this far ahead
    leadMargin: 0.16,    // m — and with this much water over the draft
    stampEvery: 1.5,     // s — between local map stamps
    maxWait: 0,          // s — the longest the router will hold in a pool for a sill to open (0: never — measured worse, see flats-design.md)
    // A prediction 40 s out is a guess: the boat sails slower than the polar (manoeuvres,
    // the pack, the mud), so the margin GROWS with the horizon — at 0.012 m/s, half a
    // metre of extra water is demanded of a cell 40 s ahead, a hand's breadth of one 5 s
    // ahead. Measured before this (phase 0.5, 18 bots): 8 boats caught on flats they were
    // priced across, 197 s aground for the worst; after: see flats-design.md.
    horizonMargin: 0.02,
    earlyPrice: 8,       // s — a cell is priced at the shallower of its arrival water and the water this long before
    horizonCap: 0.42,    // m — and no more than this, or a far goal in a deep channel reads as closed (it did: no path to the finish from the creek)
    // The picture.
    seeThrough: 1.9,     // m — the bottom stops showing through the water at this depth
    pxU: 5,              // world units per pixel of the ground image
    wetBand: 0.22,       // m — freshly exposed ground stays dark this far above the water
    draftLine: true,     // draw the "afloat" contour as a warning line
    // THE TILES (art/manifest.json: flats-mudflat, flats-sand). Null until delivered — a
    // missing image is a 404 on every load — then the path, e.g.
    // 'assets/images/terrain/flats/mudflat.png'. The tile's luma modulates the dry ground
    // (and, fainter, the bottom seen through shallow water); COL.* stays the mean colour.
    tiles: { mud: 'assets/images/terrain/flats/mudflat.png', sand: 'assets/images/terrain/flats/sand.png' },   // delivered 2026-09-16
    tileWorld: { mud: 256, sand: 128 },   // world units a tile covers: the mud's runnel net at 256 so it repeats half as often; the sand's ripples are right at the manifest's 128
    tileMix: 0.85        // how much of the tile's luma variation shows (0 flat, 1 all of it)
};

(function () {
    const cfg = () => Object.assign({}, TIDE, (typeof window !== 'undefined' && window.__TIDE) || {});

    // ── the clock ───────────────────────────────────────────────────────────
    // The RACE clock: negative in the prestart, so the phase at the gun is phase0 exactly.
    function clock() {
        const r = state.race;
        return r.status === 'prestart' ? -r.timer : r.timer;
    }
    function levelAt(t) {
        const T = state.tide;
        return T.mid + T.amp * Math.sin(2 * Math.PI * t / T.period + T.phase0);
    }
    function rateAt(t) {          // m/s
        const T = state.tide;
        return T.amp * (2 * Math.PI / T.period) * Math.cos(2 * Math.PI * t / T.period + T.phase0);
    }
    // The editor pins the level to look at a state of the tide (LW, mean, HW) while editing.
    let _override = null;
    function setOverride(v) { _override = (v == null) ? null : +v; }
    function level() { return _override != null ? _override : state.tide ? levelAt(clock()) : 0; }
    // −1..1: the rate as a share of its peak. Positive = flooding.
    function flow() {
        const T = state.tide;
        if (!T) return 0;
        return Math.cos(2 * Math.PI * clock() / T.period + T.phase0);
    }
    // Seconds until the level next reaches `h` (rising or falling, whichever comes first),
    // or null if it never does. Closed form on the sine.
    function nextReach(h, from) {
        const T = state.tide;
        const r = (h - T.mid) / T.amp;
        if (r > 1 || r < -1) return null;
        const w = 2 * Math.PI / T.period;
        const p = ((w * from + T.phase0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const a = Math.asin(r);                       // rising solution
        const sols = [a, Math.PI - a];                // and the falling one
        let best = Infinity;
        for (const s of sols) {
            let d = s - p; while (d < 1e-6) d += 2 * Math.PI;
            if (d < best) best = d;
        }
        return best / w;
    }
    function nextHigh(from) { const T = state.tide, w = 2 * Math.PI / T.period; let d = (Math.PI / 2 - (w * from + T.phase0)) % (2 * Math.PI); while (d < 0) d += 2 * Math.PI; return d / w; }
    function nextLow(from)  { const T = state.tide, w = 2 * Math.PI / T.period; let d = (-Math.PI / 2 - (w * from + T.phase0)) % (2 * Math.PI); while (d < 0) d += 2 * Math.PI; return d / w; }

    // ── the field ───────────────────────────────────────────────────────────
    // Value noise, fixed seed: part of the venue, identical every session.
    function hash2(i, j) {
        let h = (i * 374761393 + j * 668265263) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function vnoise(x, y) {
        const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
        return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
    function fbm(x, y) {
        return (vnoise(x, y) - 0.5) * 1.0 + (vnoise(x * 2.1 + 17.3, y * 2.1 + 9.1) - 0.5) * 0.5
             + (vnoise(x * 4.3 + 3.7, y * 4.3 + 21.9) - 0.5) * 0.25;
    }

    function pointInRing(x, y, ring) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
        }
        return inside;
    }
    function inShape(x, y, sh) {
        if (!pointInRing(x, y, sh.outer)) return false;
        for (const h of (sh.holes || [])) if (pointInRing(x, y, h)) return false;
        return true;
    }
    function bboxOf(ring, bb) {
        for (const p of ring) { if (p[0] < bb[0]) bb[0] = p[0]; if (p[1] < bb[1]) bb[1] = p[1]; if (p[0] > bb[2]) bb[2] = p[0]; if (p[1] > bb[3]) bb[3] = p[1]; }
        return bb;
    }
    // Scanline rasterise a set of shapes into a mask (1 inside), restricted to their bboxes.
    function rasterMask(shapes, F, into, value) {
        const { W, H, x0, y0, res } = F;
        for (const sh of shapes) {
            const bb = bboxOf(sh.outer, [Infinity, Infinity, -Infinity, -Infinity]);
            const i0 = Math.max(0, Math.floor((bb[0] - x0) / res)), i1 = Math.min(W - 1, Math.ceil((bb[2] - x0) / res));
            const j0 = Math.max(0, Math.floor((bb[1] - y0) / res)), j1 = Math.min(H - 1, Math.ceil((bb[3] - y0) / res));
            for (let j = j0; j <= j1; j++) {
                const wy = y0 + (j + 0.5) * res;
                // one scanline: crossings of the outer ring and every hole, even-odd
                const xs = [];
                const rings = [sh.outer].concat(sh.holes || []);
                for (const ring of rings) {
                    for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
                        const ya = ring[a][1], yb = ring[b][1];
                        if ((ya > wy) === (yb > wy)) continue;
                        xs.push(ring[b][0] + (wy - yb) * (ring[a][0] - ring[b][0]) / (ya - yb));
                    }
                }
                xs.sort((p, q) => p - q);
                for (let k = 0; k + 1 < xs.length; k += 2) {
                    const ia = Math.max(i0, Math.ceil((xs[k] - x0) / res - 0.5)), ib = Math.min(i1, Math.floor((xs[k + 1] - x0) / res - 0.5));
                    for (let i = ia; i <= ib; i++) into[j * W + i] = value;
                }
            }
        }
    }
    // Two-pass chamfer distance (in cells) to the nearest cell where mask != 0.
    function chamfer(mask, W, H) {
        const d = new Float32Array(W * H);
        for (let k = 0; k < W * H; k++) d[k] = mask[k] ? 0 : 1e9;
        const S2 = Math.SQRT2;
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const id = j * W + i; let v = d[id];
            if (i > 0) v = Math.min(v, d[id - 1] + 1);
            if (j > 0) { v = Math.min(v, d[id - W] + 1);
                if (i > 0) v = Math.min(v, d[id - W - 1] + S2);
                if (i < W - 1) v = Math.min(v, d[id - W + 1] + S2); }
            d[id] = v;
        }
        for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
            const id = j * W + i; let v = d[id];
            if (i < W - 1) v = Math.min(v, d[id + 1] + 1);
            if (j < H - 1) { v = Math.min(v, d[id + W] + 1);
                if (i < W - 1) v = Math.min(v, d[id + W + 1] + S2);
                if (i > 0) v = Math.min(v, d[id + W - 1] + S2); }
            d[id] = v;
        }
        return d;
    }
    const sstep = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

    // Build the field from a document. Returns null when the document has no tidal anchors.
    function build(doc) {
        const VD = window.VenueDoc;
        if (!doc || !VD) return null;
        const C = cfg();
        const shapes = VD.shapes(doc);
        const anchors = { channel: [], pool: [], bar: [], flat: [] }, marsh = [];
        for (const sh of shapes) {
            const T = VD.traits(sh);
            if (T.tide && anchors[T.tide]) anchors[T.tide].push({ outer: sh.outer, holes: sh.holes || [], elev: T.elev, feather: (sh.feather != null && isFinite(+sh.feather)) ? +sh.feather : null, over: !!sh.overChannel });
            else if (T.kind === 'flats-marsh') marsh.push({ outer: sh.outer, holes: sh.holes || [], elev: T.elev });
        }
        if (!anchors.channel.length) return null;
        // The raster covers the arena, padded: a boat can be anywhere inside it.
        const bnd = (doc.world && doc.world.boundary) || {};
        let bb = [Infinity, Infinity, -Infinity, -Infinity];
        if (bnd.poly) bboxOf(bnd.poly, bb);
        else if (bnd.circle) bb = [bnd.circle.x - bnd.circle.r, bnd.circle.y - bnd.circle.r, bnd.circle.x + bnd.circle.r, bnd.circle.y + bnd.circle.r];
        else { const s = (doc.world && doc.world.size) || 13000; bb = [-s / 2, -s / 2, s / 2, s / 2]; }
        // Padded well past the arena: the player at the finish looks straight up the river,
        // and the tide's ground has to be real there too (the marsh polygon covers the rest).
        // And the raster takes in every anchor that is scenery beyond the arena — the river
        // past the head, a pool up the valley — but not the sea, which is bigger than the
        // arena and would quadruple the field for water nobody sees.
        const arenaArea = (bb[2] - bb[0]) * (bb[3] - bb[1]);
        for (const list of [anchors.channel, anchors.pool, anchors.bar, anchors.flat]) for (const a of list) {
            const b2 = bboxOf(a.outer, [Infinity, Infinity, -Infinity, -Infinity]);
            if ((b2[2] - b2[0]) * (b2[3] - b2[1]) >= arenaArea) continue;
            bb = [Math.min(bb[0], b2[0]), Math.min(bb[1], b2[1]), Math.max(bb[2], b2[2]), Math.max(bb[3], b2[3])];
        }
        const PAD = C.rasterPad, res = C.res;
        const x0 = bb[0] - PAD, y0 = bb[1] - PAD;
        const W = Math.ceil((bb[2] + PAD - x0) / res), H = Math.ceil((bb[3] + PAD - y0) / res);
        const F = { W, H, x0, y0, res, n: W * H };
        const t0 = performance.now();
        const chMask = new Uint8Array(W * H), mMask = new Uint8Array(W * H);
        rasterMask(anchors.channel, F, chMask, 1);
        rasterMask(marsh, F, mMask, 1);
        // Outside the arena bbox proper (the pad) counts as marsh: the field must rise to
        // land at the edge of the world, or a boat at the boundary sits in phantom deep water.
        const dCh = chamfer(chMask, W, H);
        const notCh = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) notCh[k] = chMask[k] ? 0 : 1;
        const dChIn = chamfer(notCh, W, H);                 // distance INSIDE a channel from its rim
        const dM = chamfer(mMask, W, H);
        const z = new Float32Array(W * H), mat = new Float32Array(W * H);
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const k = j * W + i;
            const wx = x0 + (i + 0.5) * res, wy = y0 + (j + 0.5) * res;
            let v;
            if (chMask[k]) {
                v = C.rimZ + (anchors.channel[0].elev != null ? anchors.channel[0].elev - C.rimZ : -1.4) * sstep(dChIn[k] * res / C.bedFeather);
            } else if (mMask[k]) {
                v = C.marshZ;
            } else {
                const dc = dCh[k] * res, dm = dM[k] * res;
                const t = dc / Math.max(1e-3, dc + dm);
                v = C.rimZ + (C.marshZ - C.rimZ) * Math.pow(t, C.gamma);
                // noise: pans and tongues, faded out beside the channels so the deep water
                // keeps a clean edge and never at the marsh
                const nf = sstep(dc / C.noiseFade) * (1 - sstep((t - 0.7) / 0.3));
                if (nf > 0) v += C.noiseAmp * nf * fbm(wx / C.noiseScale, wy / C.noiseScale) * 2;
            }
            z[k] = v;
        }
        // Per-shape channel beds: each channel is a trough dropped into the union, and where
        // two overlap (a creek leaving the main channel) the DEEPER wins — a junction never
        // shoals the channel it joins. The union's own pass above used the first shape's bed;
        // this pass sets every channel's exact bed, deepest first so min() composes.
        {
            const beds = anchors.channel.map((ch, i) => ({ ch, i, bed: ch.elev != null ? ch.elev : -3.0 }));
            for (let k = 0; k < W * H; k++) if (chMask[k]) z[k] = 1e9;
            for (const { ch, bed } of beds) {
                const m = new Uint8Array(W * H); rasterMask([ch], F, m, 1);
                const inv = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) inv[k] = m[k] ? 0 : 1;
                const din = chamfer(inv, W, H);
                for (let k = 0; k < W * H; k++) if (m[k]) { const v = C.rimZ + (bed - C.rimZ) * sstep(din[k] * res / C.bedFeather); if (v < z[k]) z[k] = v; }
            }
            for (let k = 0; k < W * H; k++) if (chMask[k] && z[k] > 1e8) z[k] = C.rimZ;
        }
        // Pools: a bowl sunk into whatever the flat was.
        for (const p of anchors.pool) {
            const m = new Uint8Array(W * H); rasterMask([p], F, m, 1);
            const inv = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) inv[k] = m[k] ? 0 : 1;
            const din = chamfer(inv, W, H);
            const bed = p.elev != null ? p.elev : -2.0;
            for (let k = 0; k < W * H; k++) if (m[k]) { const s = sstep(din[k] * res / C.poolFeather); z[k] = Math.min(z[k], z[k] + (bed - z[k]) * s); }
        }
        // Shelves: the intertidal ground set outright, feathered in from the edge. Never a
        // channel cell — a corridor drawn from bank to bank must not fill the channel it leaves.
        for (const p of anchors.flat) {
            const m = new Uint8Array(W * H); rasterMask([p], F, m, 1);
            const inv = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) inv[k] = m[k] ? 0 : 1;
            const din = chamfer(inv, W, H);
            const g = p.elev != null ? p.elev : -0.5;
            for (let k = 0; k < W * H; k++) if (m[k] && !chMask[k] && !mMask[k]) { const s = sstep(din[k] * res / C.shelfFeather); z[k] = z[k] + (g - z[k]) * s; }
        }
        // Bars: a crest raised out of the flat, and the ground turns to sand. Never a channel
        // cell unless the shape says so (`overChannel`: the creek's sill, laid across the
        // creek itself) — a sill whose end reached into the channel's margin raised it to
        // −0.8 m, a shoal inside the channel's own width that dried a channel sailor out
        // on the ebb at the head's bend.
        for (const b of anchors.bar) {
            const m = new Uint8Array(W * H); rasterMask([b], F, m, 1);
            const inv = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) inv[k] = m[k] ? 0 : 1;
            const din = chamfer(inv, W, H);
            const crest = b.elev != null ? b.elev : 0;
            const bf = b.feather || C.barFeather;                // a bar may author its own ramp (a swash bar is narrow and steep)
            for (let k = 0; k < W * H; k++) if (m[k] && (b.over || !chMask[k])) { const s = sstep(din[k] * res / bf); z[k] = Math.max(z[k], z[k] + (crest - z[k]) * s); mat[k] = 1; }
        }
        // The material softened: a bar's sand meets the mud over a few cells, not at a cell
        // edge (a binary mask read as a staircase at race scale). Two passes of a 5-wide box.
        for (let pass = 0; pass < 2; pass++) {
            // separable: rows then columns (the box is the same; the work is a fifth)
            const tmp = new Float32Array(W * H);
            for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
                let acc = 0, cnt = 0;
                for (let di = -2; di <= 2; di++) { const ii = i + di; if (ii < 0 || ii >= W) continue; acc += mat[j * W + ii]; cnt++; }
                tmp[j * W + i] = acc / cnt;
            }
            for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
                let acc = 0, cnt = 0;
                for (let dj = -2; dj <= 2; dj++) { const jj = j + dj; if (jj < 0 || jj >= H) continue; acc += tmp[jj * W + i]; cnt++; }
                mat[j * W + i] = acc / cnt;
            }
        }
        // The fill direction: away from the nearest channel (the gradient of dCh), unit.
        const gx = new Float32Array(W * H), gy = new Float32Array(W * H);
        for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
            const k = j * W + i;
            let ax = dCh[k + 1] - dCh[k - 1], ay = dCh[k + W] - dCh[k - W];
            const l = Math.hypot(ax, ay);
            if (l > 1e-6) { gx[k] = ax / l; gy[k] = ay / l; }
        }
        const ms = performance.now() - t0;
        return { W, H, x0, y0, res, z, mat, dCh, gx, gy, chMask, mMask, ms, cells: W * H };
    }

    // Bilinear ground height at a world point. Outside the raster: marsh (the world's edge).
    function groundAt(x, y) {
        const F = state.tide && state.tide.field;
        if (!F) return -99;
        const fx = (x - F.x0) / F.res - 0.5, fy = (y - F.y0) / F.res - 0.5;
        const i = Math.floor(fx), j = Math.floor(fy);
        if (i < 0 || j < 0 || i >= F.W - 1 || j >= F.H - 1) return state.tide.marshZ;
        const tx = fx - i, ty = fy - j, k = j * F.W + i, z = F.z;
        return (z[k] * (1 - tx) + z[k + 1] * tx) * (1 - ty) + (z[k + F.W] * (1 - tx) + z[k + F.W + 1] * tx) * ty;
    }
    function fieldAt(arr, x, y, dflt) {
        const F = state.tide && state.tide.field;
        if (!F) return dflt;
        const i = Math.floor((x - F.x0) / F.res), j = Math.floor((y - F.y0) / F.res);
        if (i < 0 || j < 0 || i >= F.W || j >= F.H) return dflt;
        return arr[j * F.W + i];
    }
    function depthAt(x, y, t) { return (t == null ? level() : levelAt(t)) - groundAt(x, y); }
    // Speed multiplier for a depth: 1 with `free` clearance, minMul just afloat, 0 aground.
    function mulForDepth(d) {
        const T = state.tide;
        const c = d - T.draft;
        if (c <= 0) return 0;
        if (c >= T.free) return 1;
        const s = c / T.free;
        return T.minMul + (1 - T.minMul) * s * s * (3 - 2 * s);
    }
    function mulAt(x, y, t) { return state.tide ? mulForDepth(depthAt(x, y, t)) : 1; }

    // ── the boat ────────────────────────────────────────────────────────────
    // Called by updateBoat at the shoal slot: the target-speed multiplier, and the depth
    // for the instruments. Aground handling is afterMove's.
    function speedMul(boat) {
        const T = state.tide;
        if (!T) return 1;
        boat.depth = depthAt(boat.x, boat.y);
        boat.tideMul = boat.aground ? 0 : mulForDepth(boat.depth);
        return boat.tideMul;
    }
    // After the position integrates: a hull in less than her draft is aground — put her
    // back, take her way, and let the crew shove her downhill until the water returns.
    function afterMove(boat, preX, preY, dt) {
        const T = state.tide;
        if (!T) return;
        const d = depthAt(boat.x, boat.y);
        if (!boat.aground) {
            if (d < T.draft) {
                boat.aground = true;
                boat.agroundAt = clock();
                boat.x = preX; boat.y = preY;
                boat.speed = 0;
                // The contact normal the bots' reflex escapes along is the way OFF the mud:
                // away from the channel is the field's own gradient, so the normal points
                // that way and the reflex (minus normal) heads for deep water. A zero normal
                // was atan2(0, -0) = south, whatever the mud lay: a full loop at the finish
                // bar, ten seconds, for a channel sailor that brushed its edge at low water.
                const F = T.field, gx = fieldAt(F.gx, preX, preY, 0), gy = fieldAt(F.gy, preX, preY, 0), gl = Math.hypot(gx, gy) || 1;
                if (boat.ai) boat.ai.collisionData = { type: 'island', normal: { x: gx / gl, y: gy / gl }, aground: true };
                if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) window.onRaceEvent('aground', { boat });
                if (boat.isPlayer && window.GameEvents) GameEvents.emit('player-aground', { boat });
            }
            return;
        }
        // Aground. Hold station (no sailing, no stream), and the crew shove her toward the
        // nearest CHANNEL — downhill by the field's own gradient where it is steep, but
        // always with a pull toward the deep water, because a pan in the noise is a local
        // minimum a purely downhill shove sits in until the next spring tide.
        boat.speed = 0;
        boat.velocity.x = 0; boat.velocity.y = 0;
        const F = T.field;
        const eps = F.res;
        const zx = groundAt(preX + eps, preY) - groundAt(preX - eps, preY);
        const zy = groundAt(preX, preY + eps) - groundAt(preX, preY - eps);
        const gl = Math.hypot(zx, zy);
        const cgx = fieldAt(F.gx, preX, preY, 0), cgy = fieldAt(F.gy, preX, preY, 0);   // away from the channel
        let dx = -cgx, dy = -cgy;
        if (gl > 1e-6) { dx += -zx / gl; dy += -zy / gl; }
        const dl = Math.hypot(dx, dy);
        let nx = preX, ny = preY;
        if (dl > 1e-6) {
            const step = T.pushKt * 15 * dt;                 // kt → u/s is ×15 (0.25 u/frame per kt × 60)
            nx = preX + dx / dl * step; ny = preY + dy / dl * step;
        }
        boat.x = nx; boat.y = ny;
        const dNow = depthAt(nx, ny);
        boat.depth = dNow;
        if (dNow >= T.draft + T.refloat && clock() - boat.agroundAt >= T.agroundMin) {
            boat.aground = false;
            if (boat.ai) boat.ai.collisionData = null;
        }
    }
    // Seconds until this boat floats again, for the HUD (null if the water is already there).
    function refloatIn(boat) {
        const T = state.tide;
        if (!T || !boat.aground) return null;
        const need = groundAt(boat.x, boat.y) + T.draft + T.refloat;
        return nextReach(need, clock());
    }

    // ── the current ─────────────────────────────────────────────────────────
    // The fill stream over the flats, added to whatever the regions said. Outside every
    // channel, in water shallower than fillDepth: flood pours away from the channel, ebb
    // drains back, at fillKt × |rate| fading with depth and with distance from the channel.
    function addFill(x, y, out) {
        const T = state.tide;
        if (!T) return out;
        const F = T.field;
        const i = Math.floor((x - F.x0) / F.res), j = Math.floor((y - F.y0) / F.res);
        if (i < 1 || j < 1 || i >= F.W - 1 || j >= F.H - 1) return out;
        const k = j * F.W + i;
        if (F.chMask[k] || F.mMask[k]) return out;
        const f = flow();
        if (Math.abs(f) < 0.02) return out;
        const d = level() - F.z[k];
        if (d <= 0) return out;
        const wD = 1 - sstep(d / T.fillDepth);
        const wR = 1 - sstep((F.dCh[k] * F.res) / T.fillReach);
        const kt = T.fillKt * Math.abs(f) * wD * wR;
        if (kt < 0.01) return out;
        const sgn = f > 0 ? 1 : -1;
        const vx = F.gx[k] * sgn * kt, vy = F.gy[k] * sgn * kt;
        if (!out || !(out.speed > 0.001)) return { speed: kt, direction: Math.atan2(vx, -vy) };
        const ox = Math.sin(out.direction) * out.speed, oy = -Math.cos(out.direction) * out.speed;
        const sx = ox + vx, sy = oy + vy;
        return { speed: Math.hypot(sx, sy), direction: Math.atan2(sx, -sy) };
    }

    // ── the bots ────────────────────────────────────────────────────────────
    // Ground per nav cell, so the router can price a cell by the water it will find on
    // ARRIVAL (pathSailable reads `_elev` with the arrival time).
    function stampGrid(grid) {
        if (!state.tide || !grid || grid._elev) return grid;
        const N = grid.n, el = new Float32Array(N * N);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            const [wx, wy] = grid.world(i, j);
            el[j * N + i] = groundAt(wx, wy);
        }
        grid._elev = el;
        grid._risk = riskStamp(grid, el);
        return grid;
    }
    // THE LADDER'S RUNGS ON THE GRID. Every cell that ever dries carries the rung of the
    // marked passage it lies in (`risk` 1..3 from the document, within `riskHalfW` of the
    // passage's line), or 2 — the unmarked flats, the inside line along a bend — where it
    // lies in none. Always-wet water is 0. A bot's `nerve` is the highest rung its router
    // will step on (routeCost), which is how a fleet gets its steady channel sailors, its
    // corner cutters and its gamblers (Wes's ladder, art/build_flats.js).
    function riskStamp(grid, el) {
        const T = state.tide, N = grid.n, risk = new Uint8Array(N * N);
        const wetLim = T.mid - T.amp - T.draft - T.botMargin;
        for (let k = 0; k < N * N; k++) risk[k] = el[k] > wetLim ? 2 : 0;
        const P = T.passages || [], hw = TIDE.riskHalfW;
        for (const p of P) {
            const r = Math.max(1, Math.min(3, (p.risk | 0) || 2));
            for (let i = 1; i < p.pts.length; i++) {
                const ax = p.pts[i - 1][0], ay = p.pts[i - 1][1], bx = p.pts[i][0], by = p.pts[i][1];
                const [i0, j0] = grid.cell(Math.min(ax, bx) - hw, Math.min(ay, by) - hw), [i1, j1] = grid.cell(Math.max(ax, bx) + hw, Math.max(ay, by) + hw);
                const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
                for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) for (let ii = Math.max(0, i0); ii <= Math.min(N - 1, i1); ii++) {
                    const k = j * N + ii;
                    if (!risk[k]) continue;
                    const [wx, wy] = grid.world(ii, j);
                    let u = ((wx - ax) * vx + (wy - ay) * vy) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u;
                    const dx = wx - ax - u * vx, dy = wy - ay - u * vy;
                    if (dx * dx + dy * dy <= hw * hw) risk[k] = r;   // a marked passage names its cells, whichever rung
                }
            }
        }
        return risk;
    }
    // The router's nerve: set by the helm before each plan from the boat's trait, read by
    // routeCost. 3 takes everything, 1 the point bars alone, 0 the channel only.
    // A boat already standing on ground above its nerve (the pursuit chord put it there at
    // high water) may step on that ground to get OFF it — within `escapeR` of where it is —
    // and no further: letting it plan at the ground's rung took a freight sailor that had
    // brushed the head cut's entrance through the whole cut (four touches).
    let _nerve = 3, _escX = 0, _escY = 0, _escRisk = 0, _escR = 0;
    function setNerve(n, x, y, standingRisk, escapeR) {
        _nerve = n == null ? 3 : Math.max(0, Math.min(3, n | 0));
        _escX = x || 0; _escY = y || 0; _escRisk = standingRisk | 0;
        _escR = escapeR > 0 ? escapeR : TIDE.escapeR;
    }
    // How far the nearest cell at or under `nerve` is from (x, y): the escape radius a boat
    // needs to get off the ground it stands on (a boat in the middle of a 460u shelf needs
    // more than a fixed 260u, or it has no path at all and holds where it is).
    function escapeReach(grid, x, y, nerve) {
        if (!grid || !grid._risk) return TIDE.escapeR;
        const c = grid.cell(x, y), N = grid.n, rk = grid._risk;
        for (let r = 1; r <= 18; r++) {
            for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
                if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                const i = c[0] + di, j = c[1] + dj;
                if (i < 0 || j < 0 || i >= N || j >= N) continue;
                const k = j * N + i;
                if (grid.nav[k] && rk[k] <= nerve) return Math.max(TIDE.escapeR, r * grid.res * 1.5 + 120);
            }
        }
        return TIDE.escapeR;
    }
    function riskAt(grid, x, y) {
        if (!grid || !grid._risk) return 0;
        const c = grid.cell(x, y);
        if (c[0] < 0 || c[1] < 0 || c[0] >= grid.n || c[1] >= grid.n) return 0;
        return grid._risk[c[1] * grid.n + c[0]];
    }
    // A copy of the grid with every cell that is EVER too shallow closed: the chart path,
    // the ruler and the ranking fields run on the water that is always there.
    function safeGrid(grid) {
        if (!state.tide || !grid) return grid;
        stampGrid(grid);
        const T = state.tide, N = grid.n;
        const nav = grid.nav.slice();
        const lim = T.mid - T.amp - T.draft - T.botMargin;
        let closed = 0;
        for (let k = 0; k < N * N; k++) if (nav[k] && grid._elev[k] > lim) { nav[k] = 0; closed++; }
        const g = Object.assign({}, grid, { nav, _clear: null, _tight: null, _safe: true, _closed: closed });
        g.at = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? 0 : nav[j * N + i];
        return g;
    }
    // The local map: cells that are dry (under the draft + margin) `lead` seconds from now
    // are closed and remembered as `_tideDry`, so the probes and the clearance field see
    // the mud, while the router may still cross one that will be wet on arrival.
    function refreshBotGrid() {
        const c = state.course, T = state.tide;
        if (!T || !c || !c._botGridStatic) return;
        const now = clock();
        if (c._tideStampT != null && now - c._tideStampT < T.stampEvery) return;
        c._tideStampT = now;
        const base = c._botGridStatic;
        stampGrid(base);
        const N = base.n, nav = base.nav.slice(), dry = new Uint8Array(N * N);
        // The lower of now and `lead` seconds on: a falling edge is closed before it dries,
        // a rising one opens only when it is really there.
        const L = Math.min(levelAt(now), levelAt(now + T.lead)), lim = T.draft + T.leadMargin;
        for (let k = 0; k < N * N; k++) if (nav[k] && L - base._elev[k] < lim) { nav[k] = 0; dry[k] = 1; }
        // CLEARANCE FROM THE LAND, NOT FROM THE MUD. Rebuilt from the stamped nav, the
        // clearance field read every dry cell as a wall and priced a corridor across the
        // flats as a 60-unit canyon — the router's slot tax for a run that needs gybes came
        // to ~6×, and no bot ever took the wantij however open the sill was. The mud is
        // priced by time (routeCost); only the land narrows the water.
        if (!base._clear && window.SailCheck) base._clear = window.SailCheck.clearanceField(base);
        const g = Object.assign({}, base, { nav, _clear: base._clear, _tideDry: dry });
        g.at = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? 0 : nav[j * N + i];
        g._tight = base._tight;
        c.botGrid = g;
    }
    // The router's per-step verdict: is this cell sailable at `tArr`, and at what price?
    // Returns 0 for "not at that time", else the time multiplier (≥ 1).
    function routeMargin(tArr, now) {
        const T = state.tide;
        return T.botMargin + Math.min(T.horizonCap, T.horizonMargin * Math.max(0, tArr - (now == null ? clock() : now)));
    }
    // The level from a table, for the router: an A* asks a hundred thousand times a
    // replan, and sin() was more than the search itself (22 ms a replan against 10).
    // 4096 samples over one period — under a millimetre of error at a metre of range.
    let _lvlTab = null, _lvlPeriod = 0, _lvlPhase = 0, _lvlAmp = 0, _lvlMid = 0;
    function levelFast(t) {
        const T = state.tide;
        if (!_lvlTab || _lvlPeriod !== T.period || _lvlPhase !== T.phase0 || _lvlAmp !== T.amp || _lvlMid !== T.mid) {
            _lvlTab = new Float32Array(4096); _lvlPeriod = T.period; _lvlPhase = T.phase0; _lvlAmp = T.amp; _lvlMid = T.mid;
            for (let i = 0; i < 4096; i++) _lvlTab[i] = T.mid + T.amp * Math.sin(2 * Math.PI * i / 4096 + T.phase0);
        }
        let u = (t / T.period) % 1; if (u < 0) u += 1;
        return _lvlTab[(u * 4096) | 0];
    }
    function routeCost(grid, nid, tArr, now) {
        const T = state.tide;
        if (!T || !grid._elev) return 1;
        let tax = 1;
        const rk = grid._risk;
        if (rk && rk[nid] > _nerve) {                             // above this boat's rung on the ladder...
            if (rk[nid] > _escRisk) return 0;
            const N = grid.n, ci = nid % N, cj = (nid - ci) / N, [wx, wy] = grid.world(ci, cj);
            if ((wx - _escX) * (wx - _escX) + (wy - _escY) * (wy - _escY) > _escR * _escR) return 0;   // ...unless it is the way off the ground the boat stands on
            tax = TIDE.escapeTax;                                 // ...and then the shortest way off it
        }
        const z = grid._elev[nid];
        const L = levelFast(tArr), mg = routeMargin(tArr, now);
        const d = L - z - mg;
        if (d < T.draft) return 0;
        // THE EDGE TAX. A cell beside one that is dry on arrival — or beside ground above
        // the boat's nerve — is priced at `edgeTax`: a plan that skims a drying bar is a
        // plan the pursuit will clip (the hull is wider than the line, the carrot pulls in
        // behind her, she tacks into irons — measured at the finish bar at low water, a
        // full loop and ten seconds), and a channel sailor whose plan runs along a cut's
        // shoulder is carried onto it at a bend. A cell further off costs a few units more.
        // Never the whole flats (that was the canyon, see refreshBotGrid) — only the edge.
        if (T.edgeTax > tax) {
            const N = grid.n, ci = nid % N, cj = (nid - ci) / N, el = grid._elev, lim = L - mg - T.draft;
            const bad = (k) => el[k] > lim || (rk && rk[k] > _nerve);
            if ((ci > 0 && bad(nid - 1)) || (ci < N - 1 && bad(nid + 1)) || (cj > 0 && bad(nid - N)) || (cj < N - 1 && bad(nid + N))) tax = T.edgeTax;
            else if (ci > 1 && cj > 1 && ci < N - 2 && cj < N - 2) {
                // the next ring out, at a lower price: the pursuit's lateral error at a bend is
                // two cells, and a channel sailor hugging the inside of the head's turn at low
                // water sat on the rim band for ten seconds
                const N2 = 2 * N;
                if (bad(nid - 2) || bad(nid + 2) || bad(nid - N2) || bad(nid + N2) || bad(nid - N - 1) || bad(nid - N + 1) || bad(nid + N - 1) || bad(nid + N + 1)) tax = 1 + (T.edgeTax - 1) * 0.5;
            }
        }
        // The price is the SLOWER of the water on arrival and the water `earlyPrice` seconds
        // before it: the boat spends its last seconds before a cell in that water, and a
        // route that reaches a shelf the moment it floods is priced as the crawl it will be
        // (the clock is 5–10 s optimistic on a shelf; a metre of tide at this period).
        const dEarly = levelFast(Math.max(now == null ? clock() : now, tArr - T.earlyPrice)) - z - mg;
        const dd = Math.min(d, Math.max(T.draft, dEarly));
        const c = dd - T.draft;
        if (c >= T.free) return tax;
        const s = c / T.free;
        const m = T.minMul + (1 - T.minMul) * s * s * (3 - 2 * s);
        return tax / m;
    }
    // Seconds from `tArr` until this cell has draft (plus margins) over it, or null if never.
    function routeWait(grid, nid, tArr) {
        const T = state.tide;
        const need = grid._elev[nid] + T.draft + routeMargin(tArr) + 0.05;
        return nextReach(need, tArr);
    }

    // ── the picture ─────────────────────────────────────────────────────────
    // The flats are one image: every pixel reads the field and the level. Rendered in a
    // WORLD-ALIGNED window that covers the view (padded, so a rotating or panning camera
    // reuses it), at pxU world units a pixel, and refreshed when the level has moved or the
    // view has left the window. Two passes from one computation: the wet flats (under the
    // wind waves, so the water still moves over them) and the dry ground (over them — mud
    // has no waves on it), with the water's edge painted on the dry pass.
    const pic = { cvWet: null, cvDry: null, x0: 0, y0: 0, w: 0, h: 0, level: NaN, key: '' };
    // A mottle for the mud — ±7% of value in soft blotches a few boat-lengths across — so the
    // dry flat is not flat paint while its tile is owed. One 64² tile of fbm, indexed by the
    // picture's world-aligned pixel, so it neither swims nor tiles visibly (the window's
    // origin is a multiple of pxU).
    // The delivered tiles as luma rasters, loaded once when a path is set (TIDE.tiles).
    const _tile = { mud: null, sand: null, loading: {} };
    function tileLuma(which) {
        const C = TIDE;
        if (_tile[which]) return _tile[which];
        const src = C.tiles && C.tiles[which];
        if (!src || _tile.loading[which] || typeof Image === 'undefined') return null;
        _tile.loading[which] = true;
        const img = new Image();
        img.onload = () => {
            // The tile as a GREY about its own mean (128 = the mean), so an 'overlay'
            // composite at the tile's screen size leaves the flat's colour where the tile is
            // average and pushes it lighter or darker where the tile is — the runnels and
            // the tufts at full resolution, the colour still the tide layer's own.
            const n = 512, cv = document.createElement('canvas'); cv.width = cv.height = n;
            const g = cv.getContext('2d'); g.drawImage(img, 0, 0, n, n);
            let im;
            try { im = g.getImageData(0, 0, n, n); }
            catch (e) {
                // Over file:// every image is cross-origin and the canvas is tainted: the flat
                // keeps its mottle and no texture, and the page keeps its frame loop.
                _tile.loading[which] = 'tainted';
                if (!_tile.warned) { _tile.warned = true; console.warn('tide: the flats tiles cannot be read over file:// (serve the game over http for the textures)'); }
                return;
            }
            const d = im.data;
            let mean = 0;
            for (let k = 0; k < n * n; k++) mean += d[k * 4] * 0.299 + d[k * 4 + 1] * 0.587 + d[k * 4 + 2] * 0.114;
            mean /= n * n;
            for (let k = 0; k < n * n; k++) {
                const l = (d[k * 4] * 0.299 + d[k * 4 + 1] * 0.587 + d[k * 4 + 2] * 0.114) / Math.max(1, mean);
                const v = Math.max(0, Math.min(255, Math.round(128 * l)));
                d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255;
            }
            g.putImageData(im, 0, 0);
            _tile[which] = { cv, n };
            pic.level = NaN;                      // repaint with the texture
        };
        img.src = src;
        return null;
    }
    const MOT = 256; let _mot = null;
    function mottle() {
        if (_mot) return _mot;
        _mot = new Float32Array(MOT * MOT);
        // two octaves of value noise on a lattice that wraps at the tile's edge (the lattice
        // index is masked), so the tile is seamless and the blotches are blobs, not a weave
        const lat = (x, y, cells, salt) => {
            const fx = x / MOT * cells, fy = y / MOT * cells;
            const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
            const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
            const m = cells - 1;
            const a = hash2((i & m) + salt, (j & m) + salt * 3), b = hash2(((i + 1) & m) + salt, (j & m) + salt * 3);
            const c = hash2((i & m) + salt, ((j + 1) & m) + salt * 3), d = hash2(((i + 1) & m) + salt, ((j + 1) & m) + salt * 3);
            return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy - 0.5;
        };
        for (let j = 0; j < MOT; j++) for (let i = 0; i < MOT; i++) _mot[j * MOT + i] = lat(i, j, 8, 11) * 0.7 + lat(i, j, 32, 29) * 0.3;
        return _mot;
    }
    function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
    // The dry colours are the DELIVERED tiles' means (2026-09-16: flats-mudflat #a9834d,
    // flats-sand #d9b879), so the tile's luma modulates about the colour the flat already is.
    const COL = {
        mud:      [169, 131, 77],    // golden mudflat, dry
        mudWet:   [108,  82, 48],    // just exposed, gleaming dark
        sand:     [217, 184, 121],   // rippled sand, dry
        sandWet:  [163, 135, 82],
        shallow:  [158, 182, 160],   // the bottom seen through a hand of water
        edge:     [232, 226, 206]    // the water's edge
    };
    function ensureCanvas(o, key, w, h) {
        if (!o[key]) o[key] = document.createElement('canvas');
        if (o[key].width !== w || o[key].height !== h) { o[key].width = w; o[key].height = h; }
        return o[key];
    }
    function viewWindow(ctx) {
        const Tm = ctx.getTransform();
        const inv = Tm.inverse();
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
        for (const [sx, sy] of [[0, 0], [cw, 0], [0, ch], [cw, ch]]) {
            const p = inv.transformPoint(new DOMPoint(sx, sy));
            if (p.x < a) a = p.x; if (p.y < b) b = p.y; if (p.x > c) c = p.x; if (p.y > d) d = p.y;
        }
        return [a, b, c, d];
    }
    function refreshPicture(ctx) {
        const T = state.tide, F = T.field;
        const C = cfg();
        const [va, vb, vc, vd] = viewWindow(ctx);
        const L = level();
        const inside = pic.cvWet && va >= pic.x0 && vb >= pic.y0 && vc <= pic.x0 + pic.w && vd <= pic.y0 + pic.h;
        const water = window.WATER_CONFIG || {};
        const key = (water.baseColor || '') + '|' + (water.shallowColor || '');
        if (inside && Math.abs(L - pic.level) < 0.008 && key === pic.key) return;
        const PAD = 400;
        const x0 = inside ? pic.x0 : Math.floor((va - PAD) / C.pxU) * C.pxU;
        const y0 = inside ? pic.y0 : Math.floor((vb - PAD) / C.pxU) * C.pxU;
        const w  = inside ? pic.w  : Math.ceil((vc + PAD - x0) / C.pxU) * C.pxU;
        const h  = inside ? pic.h  : Math.ceil((vd + PAD - y0) / C.pxU) * C.pxU;
        const pw = Math.max(1, Math.round(w / C.pxU)), ph = Math.max(1, Math.round(h / C.pxU));
        const cvW = ensureCanvas(pic, 'cvWet', pw, ph), cvD = ensureCanvas(pic, 'cvDry', pw, ph);
        const gW = cvW.getContext('2d'), gD = cvD.getContext('2d');
        const imW = gW.createImageData(pw, ph), imD = gD.createImageData(pw, ph);
        const AW = imW.data, AD = imD.data;
        const base = hexRgb(water.baseColor || '#3a6394');
        const shal = hexRgb(water.shallowColor || '#7aa6d4');
        const z = F.z, mat = F.mat, W = F.W, H = F.H, res = F.res;
        const see = C.seeThrough, wet = C.wetBand, DRAFT = T.draft, FREE = T.free;
        const mot = mottle(), mx0 = Math.round(x0 / C.pxU), my0 = Math.round(y0 / C.pxU);
        tileLuma('mud'); tileLuma('sand');                       // kick the loads
        const cvS = ensureCanvas(pic, 'cvSand', pw, ph), gS = cvS.getContext('2d');
        const imS = gS.createImageData(pw, ph), AS = imS.data;
        for (let py = 0; py < ph; py++) {
            const wy = y0 + (py + 0.5) * C.pxU;
            const fy = (wy - F.y0) / res - 0.5, j = Math.floor(fy), ty = fy - j;
            for (let px = 0; px < pw; px++) {
                const wx = x0 + (px + 0.5) * C.pxU;
                const fx = (wx - F.x0) / res - 0.5, i = Math.floor(fx), tx = fx - i;
                const o = (py * pw + px) * 4;
                if (i < 0 || j < 0 || i >= W - 1 || j >= H - 1) { AW[o + 3] = 0; AD[o + 3] = 0; continue; }
                const k = j * W + i;
                const g = (z[k] * (1 - tx) + z[k + 1] * tx) * (1 - ty) + (z[k + W] * (1 - tx) + z[k + W + 1] * tx) * ty;
                const d = L - g;
                if (F.mMask[k] && F.mMask[k + 1] && F.mMask[k + W] && F.mMask[k + W + 1]) { AW[o + 3] = 0; AD[o + 3] = 0; continue; }
                // the material, blended like the height so sand and mud meet in a soft seam
                const sf = (mat[k] * (1 - tx) + mat[k + 1] * tx) * (1 - ty) + (mat[k + W] * (1 - tx) + mat[k + W + 1] * tx) * ty;
                const dry = [COL.mud[0] + (COL.sand[0] - COL.mud[0]) * sf, COL.mud[1] + (COL.sand[1] - COL.mud[1]) * sf, COL.mud[2] + (COL.sand[2] - COL.mud[2]) * sf];
                const wetc = [COL.mudWet[0] + (COL.sandWet[0] - COL.mudWet[0]) * sf, COL.mudWet[1] + (COL.sandWet[1] - COL.mudWet[1]) * sf, COL.mudWet[2] + (COL.sandWet[2] - COL.mudWet[2]) * sf];
                if (d <= 0) {
                    // exposed ground: dark and gleaming at the water's edge, paler with height
                    const hgt = -d;
                    const wf = 1 - sstep(hgt / wet);
                    const mo = mot[((my0 + py) & (MOT - 1)) * MOT + ((mx0 + px) & (MOT - 1))];
                    const pale = Math.min(0.14, hgt * 0.10) + mo * 0.10 * (1 - 0.5 * wf);
                    // the sand mask for the tile overlay: how much of this pixel is sand
                    AS[o + 3] = Math.round(255 * sf);
                    const r = (dry[0] + (wetc[0] - dry[0]) * wf) * (1 + pale), gg = (dry[1] + (wetc[1] - dry[1]) * wf) * (1 + pale), b = (dry[2] + (wetc[2] - dry[2]) * wf) * (1 + pale);
                    AD[o] = Math.min(255, r); AD[o + 1] = Math.min(255, gg); AD[o + 2] = Math.min(255, b); AD[o + 3] = 255;
                    AW[o] = AD[o]; AW[o + 1] = AD[o + 1]; AW[o + 2] = AD[o + 2]; AW[o + 3] = 255;
                } else if (d < see) {
                    // THE BOTTOM THROUGH THE WATER, in the bands a sailor needs to tell apart:
                    // under the draft the mud all but shows (you would sit on it), in the drag
                    // band the bottom is plainly there under a skin of pale water, and above
                    // it the tint thins to the open water — so "will it take my speed" is a
                    // colour, not a guess. The dashed line marks the draft exactly.
                    const bottom = [ dry[0] * 0.6 + COL.shallow[0] * 0.4, dry[1] * 0.6 + COL.shallow[1] * 0.4, dry[2] * 0.6 + COL.shallow[2] * 0.4 ];
                    const pale = [ (shal[0] + bottom[0]) / 2, (shal[1] + bottom[1]) / 2, (shal[2] + bottom[2]) / 2 ];
                    let c, a;
                    if (d < DRAFT) { const u = d / DRAFT; c = [ wetc[0] + (bottom[0] - wetc[0]) * u, wetc[1] + (bottom[1] - wetc[1]) * u, wetc[2] + (bottom[2] - wetc[2]) * u ]; a = 0.96 - 0.16 * u; }
                    else if (d < DRAFT + FREE) { const u = (d - DRAFT) / FREE; c = [ bottom[0] + (pale[0] - bottom[0]) * u, bottom[1] + (pale[1] - bottom[1]) * u, bottom[2] + (pale[2] - bottom[2]) * u ]; a = 0.8 - 0.25 * u; }
                    else { const u = Math.min(1, (d - DRAFT - FREE) / (see - DRAFT - FREE)); const s = (1 - u) * (1 - u); c = [ base[0] + (pale[0] - base[0]) * s, base[1] + (pale[1] - base[1]) * s, base[2] + (pale[2] - base[2]) * s ]; a = 0.55 * s; }
                    AW[o] = c[0]; AW[o + 1] = c[1]; AW[o + 2] = c[2]; AW[o + 3] = Math.round(255 * a);
                    AD[o + 3] = 0;
                } else { AW[o + 3] = 0; AD[o + 3] = 0; }
            }
        }
        gW.putImageData(imW, 0, 0); gD.putImageData(imD, 0, 0); gS.putImageData(imS, 0, 0);
        pic.x0 = x0; pic.y0 = y0; pic.w = w; pic.h = h; pic.level = L; pic.key = key;
    }
    function drawWet(ctx) {
        if (!state.tide) return;
        refreshPicture(ctx);
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(pic.cvWet, pic.x0, pic.y0, pic.w, pic.h);
        ctx.restore();
    }
    function drawDry(ctx) {
        if (!state.tide) return;
        refreshPicture(ctx);
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(pic.cvDry, pic.x0, pic.y0, pic.w, pic.h);
        ctx.restore();
        drawTileOverlay(ctx);
        // The water's edge: a thin pale line where the level meets the ground — the wet lip of
        // the flat — and, a draft inside it, the dashed line you must stay on the deep side of.
        drawIso(ctx, level(), 'rgba(236, 230, 210, 0.85)', 1.6, null);
        if (cfg().draftLine) drawDraftLine(ctx);
        drawBirds(ctx);
        drawWithies(ctx);
    }
    // THE WITNESS. Spoon-billed sandpipers land on the flat the moment the water leaves it
    // and work the wet sand for as long as the ebb lasts — so a scatter of small birds IS the
    // depth gauge: where they stand, the tide has just gone, and where they lift, it is
    // coming back. Flocks sit on cells a hand's breadth above the water on a falling tide
    // (a sparse hash of the cell picks which), each bird a dark speck with a pale breast,
    // stepping and pecking on its own clock; on the flood they are simply not there. No RNG:
    // cell hashes and state.time only.
    function drawBirds(ctx) {
        const T = state.tide, F = T.field;
        if (Tide.flow() >= 0) return;                        // the flood: they have lifted
        const [va, vb, vc, vd] = viewWindow(ctx);
        const i0 = Math.max(1, Math.floor((va - F.x0) / F.res)), i1 = Math.min(F.W - 2, Math.ceil((vc - F.x0) / F.res));
        const j0 = Math.max(1, Math.floor((vb - F.y0) / F.res)), j1 = Math.min(F.H - 2, Math.ceil((vd - F.y0) / F.res));
        const L = level(), t = state.time || 0, z = F.z, W = F.W, res = F.res;
        ctx.save();
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const k = j * W + i;
            if (F.mMask[k] || F.chMask[k]) continue;
            const hgt = z[k] - L;
            if (hgt < 0.04 || hgt > 0.34) continue;         // the wet band the water just left
            const h = hash2(i * 7 + 3, j * 13 + 5);
            if (h > 0.028) continue;                          // one flock in ~36 cells of fresh sand
            // the flock fades in as the sand appears and out as it dries (they follow the edge)
            const a = Math.min(1, (hgt - 0.04) / 0.05) * Math.min(1, (0.34 - hgt) / 0.08);
            if (a <= 0) continue;
            const cx = F.x0 + (i + 0.5) * res, cy = F.y0 + (j + 0.5) * res;
            const n = 2 + Math.floor(h * 1000) % 4;
            ctx.globalAlpha = a;
            for (let b = 0; b < n; b++) {
                const hb = hash2(i * 31 + b * 17, j * 29 + b * 11);
                const hb2 = hash2(j * 23 + b * 5, i * 19 + b * 7);
                const bx = cx + (hb - 0.5) * 46 + Math.sin(t * 1.3 + hb * 20) * 2.2;
                const by = cy + (hb2 - 0.5) * 46 + Math.cos(t * 1.1 + hb2 * 20) * 2.2;
                const face = hb * Math.PI * 2 + Math.sin(t * 0.7 + hb2 * 9) * 0.6;
                const peck = Math.max(0, Math.sin(t * 4.5 + hb * 30)) * 1.6;   // the bill dips
                // body: a small dark oval along the facing, pale breast toward the belly
                ctx.fillStyle = '#4a3f33';
                ctx.beginPath(); ctx.ellipse(bx, by, 3.2, 2.0, face, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#e9e2d3';
                ctx.beginPath(); ctx.ellipse(bx - Math.sin(face) * 0.8, by + Math.cos(face) * 0.8, 1.9, 1.0, face, 0, Math.PI * 2); ctx.fill();
                // the spoon bill: a short dark stroke ahead, dipping to peck
                ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 1.1;
                ctx.beginPath(); ctx.moveTo(bx + Math.cos(face) * 3, by + Math.sin(face) * 3);
                ctx.lineTo(bx + Math.cos(face) * (5.5 + peck), by + Math.sin(face) * (5.5 + peck)); ctx.stroke();
            }
        }
        ctx.restore();
    }
    // WITHIES: birch boughs lashed to stakes in the mud, the Wadden Sea's channel marks —
    // here at either end of each sill and down both sides of the wantij shelf (the
    // document's `tide.withies`). From above a withy is a dark stake with a tuft of twigs,
    // and the tuft LEANS with whatever the stream is doing, so a row of them reads the
    // tide's direction before the gauge does. A pale ripple trails downstream of each when
    // the water runs. The topmark says which hand the deep water is on: red to port, green
    // to starboard, the IALA convention this game's marks already use.
    function drawWithies(ctx) {
        const T = state.tide, list = T.withies;
        if (!list || !list.length) return;
        const [va, vb, vc, vd] = viewWindow(ctx);
        const t = state.time || 0;
        ctx.save();
        ctx.lineCap = 'round';
        for (const w of list) {
            if (w.x < va - 60 || w.x > vc + 60 || w.y < vb - 60 || w.y > vd + 60) continue;
            const cur = (typeof getCurrentAt === 'function') ? getCurrentAt(w.x, w.y) : null;
            const sp = cur ? cur.speed : 0, lean = Math.min(1, sp / 1.2);
            const dx = cur && sp > 0.02 ? Math.sin(cur.direction) : 0, dy = cur && sp > 0.02 ? -Math.cos(cur.direction) : 0;
            const depth = depthAt(w.x, w.y);
            // the ripple: two short pale strokes opening downstream, only in water that moves
            if (depth > 0.05 && sp > 0.25) {
                ctx.strokeStyle = 'rgba(235, 240, 245, 0.55)';
                ctx.lineWidth = 1.2;
                const px = -dy, py = dx, L = 10 + 16 * lean;
                ctx.beginPath();
                ctx.moveTo(w.x + dx * 3, w.y + dy * 3); ctx.lineTo(w.x + dx * L + px * (4 + 3 * lean), w.y + dy * L + py * (4 + 3 * lean));
                ctx.moveTo(w.x + dx * 3, w.y + dy * 3); ctx.lineTo(w.x + dx * L - px * (4 + 3 * lean), w.y + dy * L - py * (4 + 3 * lean));
                ctx.stroke();
            }
            // the stake's shadow on the mud, then the stake
            const tx = w.x + dx * 9 * lean, ty = w.y + dy * 9 * lean;   // where the tuft has leaned to
            ctx.strokeStyle = 'rgba(40, 30, 16, 0.35)';
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(w.x + 3, w.y + 4); ctx.lineTo(tx + 4, ty + 5); ctx.stroke();
            ctx.strokeStyle = '#3a2a16';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(tx, ty); ctx.stroke();
            // the tuft: five twigs round the tip, streamed a little downstream
            ctx.strokeStyle = '#4b3a22';
            ctx.lineWidth = 1.7;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const a = k * 1.0472 + t * 0.6 + (w.x * 0.01);
                const len = 8 + 3 * Math.sin(t * 1.7 + k);
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx + Math.cos(a) * len + dx * 3 * lean, ty + Math.sin(a) * len + dy * 3 * lean);
            }
            ctx.stroke();
            // the topmark
            ctx.fillStyle = w.hand === 'port' ? '#e0483a' : '#3fb36a';
            ctx.beginPath(); ctx.arc(tx, ty, 3.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
    // THE TILES OVER THE DRY GROUND, at screen resolution: the mud tile everywhere the flat is
    // exposed, the sand tile where the material raster says sand, each a world-anchored
    // pattern of the tile's grey-about-its-mean, masked by the dry pass and composited with
    // 'overlay' so the colour stays the flat's own. Three composites a frame on one
    // viewport-sized scratch canvas; nothing until a tile has loaded.
    const ov = { cv: null, cv2: null, pat: {} };
    function drawTileOverlay(ctx) {
        const C = cfg();
        const twFor = (which) => (typeof C.tileWorld === 'object' ? C.tileWorld[which] : C.tileWorld) || 128;
        const mud = _tile.mud, sand = _tile.sand;
        if (!mud && !sand) return;
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        if (!ov.cv) { ov.cv = document.createElement('canvas'); ov.cv2 = document.createElement('canvas'); }
        if (ov.cv.width !== cw || ov.cv.height !== ch) { ov.cv.width = ov.cv2.width = cw; ov.cv.height = ov.cv2.height = ch; ov.pat = {}; }
        const g = ov.cv.getContext('2d'), g2 = ov.cv2.getContext('2d');
        const Tm = ctx.getTransform();
        const [va, vb, vc, vd] = viewWindow(ctx);
        const patFor = (which, t, gg) => {
            if (!ov.pat[which]) ov.pat[which] = gg.createPattern(t.cv, 'repeat');
            return ov.pat[which];
        };
        // the mud everywhere dry (the sand mask later replaces where it is sand)
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        g.clearRect(0, 0, cw, ch);
        g.setTransform(Tm);
        const drawPat = (gg, t, which) => {
            const tw = twFor(which);
            gg.save();
            gg.scale(tw / t.n, tw / t.n);                       // the tile spans tileWorld units
            gg.fillStyle = patFor(which, t, gg);
            gg.fillRect(va * t.n / tw, vb * t.n / tw, (vc - va) * t.n / tw, (vd - vb) * t.n / tw);
            gg.restore();
        };
        if (mud) drawPat(g, mud, 'mud');
        if (sand && pic.cvSand) {
            // the sand pattern, masked by the sand share, over the mud
            g2.setTransform(1, 0, 0, 1, 0, 0); g2.globalCompositeOperation = 'source-over'; g2.globalAlpha = 1;
            g2.clearRect(0, 0, cw, ch);
            g2.setTransform(Tm);
            drawPat(g2, sand, 'sand');
            g2.globalCompositeOperation = 'destination-in';
            g2.drawImage(pic.cvSand, pic.x0, pic.y0, pic.w, pic.h);
            g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over';
            g.drawImage(ov.cv2, 0, 0);
        }
        // keep only the dry ground
        g.setTransform(Tm); g.globalCompositeOperation = 'destination-in';
        g.drawImage(pic.cvDry, pic.x0, pic.y0, pic.w, pic.h);
        // and lay it on the world
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = C.tileMix;
        ctx.drawImage(ov.cv, 0, 0);
        ctx.restore();
    }
    // The AFLOAT contour — marching squares on the raster over the view, dashed: where the
    // water is exactly one draft deep now. Inside it you sail; outside it you sit.
    function drawDraftLine(ctx) {
        drawIso(ctx, level() - state.tide.draft, 'rgba(255, 196, 92, 0.85)', 2.2, [14, 10]);
    }
    // A contour of the ground at height `iso`, marching squares over the visible raster.
    function drawIso(ctx, iso, stroke, width, dash) {
        const T = state.tide, F = T.field;
        const [va, vb, vc, vd] = viewWindow(ctx);
        const i0 = Math.max(0, Math.floor((va - F.x0) / F.res) - 1), i1 = Math.min(F.W - 2, Math.ceil((vc - F.x0) / F.res) + 1);
        const j0 = Math.max(0, Math.floor((vb - F.y0) / F.res) - 1), j1 = Math.min(F.H - 2, Math.ceil((vd - F.y0) / F.res) + 1);
        const z = F.z, W = F.W, res = F.res, mM = F.mMask;
        ctx.save();
        ctx.lineWidth = width;
        ctx.setLineDash(dash || []);
        ctx.strokeStyle = stroke;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const px = (i) => F.x0 + (i + 0.5) * res, py = (j) => F.y0 + (j + 0.5) * res;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const k = j * W + i;
            if (mM[k] || mM[k + 1] || mM[k + W] || mM[k + W + 1]) continue;   // the marsh has its own edge
            const a = z[k], b = z[k + 1], c = z[k + W + 1], d = z[k + W];
            const ca = a > iso ? 8 : 0, cb = b > iso ? 4 : 0, cc = c > iso ? 2 : 0, cd = d > iso ? 1 : 0;
            const code = ca | cb | cc | cd;
            if (code === 0 || code === 15) continue;
            // edge midpoints with linear interpolation
            const lerp = (p, q, vp, vq) => p + (q - p) * ((iso - vp) / ((vq - vp) || 1e-9));
            const top = [lerp(px(i), px(i + 1), a, b), py(j)];
            const right = [px(i + 1), lerp(py(j), py(j + 1), b, c)];
            const bottom = [lerp(px(i), px(i + 1), d, c), py(j + 1)];
            const left = [px(i), lerp(py(j), py(j + 1), a, d)];
            const segs = MS[code];
            for (const [e0, e1] of segs) {
                const p = [top, right, bottom, left][e0], q = [top, right, bottom, left][e1];
                ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
            }
        }
        ctx.stroke();
        ctx.restore();
    }
    // marching-squares lookup: edges 0 top, 1 right, 2 bottom, 3 left; bits a(8) b(4) c(2) d(1)
    const MS = {
        1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[0, 3], [1, 2]], 6: [[0, 2]], 7: [[0, 3]],
        8: [[0, 3]], 9: [[0, 2]], 10: [[0, 1], [3, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]]
    };

    // ── the chart ───────────────────────────────────────────────────────────
    // The minimap's tide: one pixel per chart pixel sampled off the field, refreshed when
    // the level has moved a couple of centimetres or the projection changed. Dry ground in
    // the flats' sand, the sits/slows bands as a pale wash, deep water left to the chart.
    const mm = { cv: null, key: '', level: NaN };
    function drawMinimap(ctx, cx, cy, scale, width, height) {
        const T = state.tide, F = T.field;
        const L = level();
        const key = [width, height, cx.toFixed(1), cy.toFixed(1), scale.toFixed(6)].join('|');
        if (!mm.cv || mm.key !== key || Math.abs(L - mm.level) > 0.02) {
            if (!mm.cv) mm.cv = document.createElement('canvas');
            if (mm.cv.width !== width || mm.cv.height !== height) { mm.cv.width = width; mm.cv.height = height; }
            const g = mm.cv.getContext('2d');
            const im = g.createImageData(width, height), A = im.data;
            for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
                const wx = (px + 0.5 - width / 2) / scale + cx, wy = (py + 0.5 - height / 2) / scale + cy;
                const o = (py * width + px) * 4;
                const i = Math.floor((wx - F.x0) / F.res), j = Math.floor((wy - F.y0) / F.res);
                if (i < 0 || j < 0 || i >= F.W || j >= F.H) { A[o + 3] = 0; continue; }
                const k = j * F.W + i;
                if (F.mMask[k]) { A[o + 3] = 0; continue; }
                const d = L - F.z[k];
                if (d <= 0) { const s = F.mat[k]; A[o] = 176 + 46 * s; A[o + 1] = 138 + 58 * s; A[o + 2] = 84 + 48 * s; A[o + 3] = 235; }
                else if (d < T.draft + T.free) { const u = d / (T.draft + T.free); A[o] = 150; A[o + 1] = 170; A[o + 2] = 165; A[o + 3] = Math.round(190 * (1 - u)); }
                else A[o + 3] = 0;
            }
            g.putImageData(im, 0, 0);
            mm.key = key; mm.level = L;
        }
        ctx.drawImage(mm.cv, 0, 0);
    }

    // ── the HUD ─────────────────────────────────────────────────────────────
    // What the instruments say: depth under the keel, the tide's state and the next turn.
    function hudInfo(boat) {
        const T = state.tide;
        if (!T) return null;
        const t = clock();
        const L = levelAt(t), f = flow();
        const toHigh = nextHigh(t), toLow = nextLow(t);
        const rising = f >= 0;
        return {
            level: L, amp: T.amp, mid: T.mid, rising, flow: f,
            frac: (L - (T.mid - T.amp)) / (2 * T.amp),           // 0 at LW, 1 at HW
            next: rising ? 'HW' : 'LW', nextIn: rising ? toHigh : toLow,
            depth: boat ? (boat.depth != null ? boat.depth : depthAt(boat.x, boat.y)) : null,
            aground: !!(boat && boat.aground),
            refloatIn: boat ? refloatIn(boat) : null,
            draft: T.draft, free: T.free
        };
    }

    // ── lifecycle ───────────────────────────────────────────────────────────
    // The field is a pure function of the anchors and the arena, and the editor recompiles
    // the course on EVERY committed edit (a dragged mark, a wind knob): a 0.3–0.6 s raster
    // each time would make the venue unpleasant to edit. Keyed on the anchors' geometry
    // and heights, so only a change to the ground itself rebuilds.
    let _built = null;
    function fieldSig(doc) {
        const VD = window.VenueDoc;
        let sig = JSON.stringify((doc.world && doc.world.boundary) || null) + '|' + JSON.stringify(cfg());
        for (const sh of VD.shapes(doc)) {
            const T = VD.traits(sh);
            if (!T.tide && T.kind !== 'flats-marsh') continue;
            sig += `|${sh.id}:${T.kind}:${T.elev}:${sh.feather || ''}:${sh.overChannel ? 'o' : ''}:${sh.outer.length}:${sh.outer[0]}:${sh.outer[sh.outer.length >> 1]}:${(sh.holes || []).length}`;
            let acc = 0; for (const p of sh.outer) acc += p[0] * 3 + p[1] * 7;
            sig += ':' + Math.round(acc);
        }
        return sig;
    }
    function init() {
        state.tide = null;
        const doc = state.course && state.course.doc;
        if (!doc) return;
        const C = cfg();
        const sig = fieldSig(doc);
        const field = (_built && _built.sig === sig) ? _built.field : build(doc);
        if (!field) return;
        _built = { sig, field };
        const tideDoc = doc.tide || {};
        state.tide = {
            period: tideDoc.period != null ? +tideDoc.period : C.period,
            amp: tideDoc.amp != null ? +tideDoc.amp : C.amp,
            mid: tideDoc.mid != null ? +tideDoc.mid : C.mid,
            phase0: tideDoc.phase0 != null ? +tideDoc.phase0 : C.phase0,
            draft: C.draft, free: C.free, minMul: C.minMul, refloat: C.refloat, agroundMin: C.agroundMin, pushKt: C.pushKt,
            fillKt: tideDoc.fillKt != null ? +tideDoc.fillKt : C.fillKt, fillDepth: C.fillDepth, fillReach: C.fillReach,
            botMargin: C.botMargin, edgeTax: C.edgeTax, lead: C.lead, leadMargin: C.leadMargin, stampEvery: C.stampEvery, maxWait: C.maxWait, horizonMargin: C.horizonMargin, horizonCap: C.horizonCap, earlyPrice: C.earlyPrice,
            marshZ: C.marshZ,
            withies: Array.isArray(tideDoc.withies) ? tideDoc.withies.filter(w => w && isFinite(+w.x) && isFinite(+w.y)) : [],
            // The marked passages with their rung on the ladder (`risk` 1..3, see
            // art/build_flats.js): the bots' nerve is read against it.
            passages: Array.isArray(tideDoc.passages) ? tideDoc.passages.filter(p => p && Array.isArray(p.pts) && p.pts.length > 1) : [],
            field
        };
        pic.level = NaN; pic.cvWet = null; pic.cvDry = null;
        if (state.course) state.course._tideStampT = null;
        for (const b of (state.boats || [])) { b.aground = false; b.depth = null; b.tideMul = 1; }
    }
    function update(dt) {
        if (!state.tide) return;
        refreshBotGrid();
    }

    window.Tide = {
        CONST: TIDE, init, update, build,
        clock, level, levelAt, rateAt, flow, nextReach, nextHigh, nextLow, setOverride,
        groundAt, depthAt, mulAt, mulForDepth,
        speedMul, afterMove, refloatIn,
        addFill,
        stampGrid, safeGrid, refreshBotGrid, routeCost, routeWait, setNerve, riskAt, escapeReach,
        drawWet, drawDry, drawMinimap, hudInfo,
        _pic: pic
    };
})();
