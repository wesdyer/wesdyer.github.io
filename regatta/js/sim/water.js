// regatta/js/sim/water.js — moving water: venue current field (getCurrentAt),
// rapids (sim + foam render), wind-wave state, and shore surf. Note
// _rapidsPhaseN is dealt in boat-update order by updateBoat (sim/physics side).
// Classic script; global scope. Extracted verbatim from script.js (2026-08-24).
function venueCurrent() {
    const regs = state.course && state.course.currentRegions;
    if (!regs || !regs.length) return null;
    // The strongest stream on the map, at its peak of the cycle. ⚠️ THE MAP, not the
    // course: right for "does this venue have moving water at all" (the particle
    // spawner's question), wrong for a briefing — see courseCurrentMax.
    let max = 0;
    for (const r of regs) max = Math.max(max, r.speed + Math.abs(r.speedVar || 0));
    return { max };
}

// WHAT THE WATER DOES ON THE COURSE. venueCurrent()'s map-wide max is what the Water
// readout used to quote, and it lied the moment a venue authored strong flow off the
// racing area: Lighthouse Cove keeps a 2 kt stream entirely west of its westernmost
// mark, and the board promised a stream the fleet never touches — the real racing
// water there is a 0.2–0.5 kt drift. So sample the BLENDED field (getCurrentAt, the
// same answer the boats get) along the route actually sailed, at several phases of
// the slowest oscillation so a tidal peak is not missed, and report the strongest
// set found. Null when the venue authors no current of its own.
function courseCurrentMax() {
    if (!venueCurrent() || !state.course.route) return null;
    const wpts = [];
    for (let leg = 0; leg <= state.race.totalLegs; leg++) {
        const p = legTargetPoint(leg);
        if (p) wpts.push(p);
    }
    if (wpts.length < 2) return null;
    let period = 0;
    for (const r of state.course.currentRegions) period = Math.max(period, r.period || 0);
    const phases = period > 0 ? [0, 1, 2, 3, 4, 5, 6, 7].map(i => i / 8 * period) : [0];
    const t0 = state.time;
    let max = 0;
    for (const ph of phases) {
        state.time = t0 + ph;
        for (let i = 1; i < wpts.length; i++) {
            const a = wpts[i - 1], b = wpts[i];
            const n = Math.max(2, Math.min(24, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 200)));
            for (let s = 0; s <= n; s++) {
                const c = getCurrentAt(a.x + (b.x - a.x) * s / n, a.y + (b.y - a.y) * s / n);
                if (c && c.speed > max) max = c.speed;
            }
        }
    }
    state.time = t0;
    return max;
}

// The ambient stream — a uniform set over the whole course, when a race has one. The
// river's generated profile used to live here (a lateral cosine with a back-eddy at the
// banks and an along-course envelope that slackened at the line). It is gone with the rest
// of the river's current: moving water is a thing a document states, not a thing a venue
// key implies.
function ambientCurrentAt(x, y) {
    return state.race.conditions.current;
}

// ── Rapids ──────────────────────────────────────────────────────────────────
// The turbulence field: how BROKEN the water is at a point, 0..1, weighted by the same
// centered edge ramp every region uses. Deliberately a texture and not a motion — a
// rapid carries no flow of its own, because the stream (tongue included) is the Current
// layer's to author, and two layers stating the same knots was the thing to prevent.
// Taken as the MAX of the weighted regions: two overlapping shoulders are broken water
// once, not twice.
//
// Touches no RNG (pure in position), so rapids cannot move the eval anchor.
const RAPIDS_DRAG = 0.6;   // share of drive that 100%-broken water takes
const RAPIDS_YAW = 0.45;   // rad/s of bow-shove at 100%-broken, before the wobble shape
let _rapidsPhaseN = 0;     // per-boat wobble phase, dealt in boat-update order — no RNG
function rapidsTurbAt(x, y) {
    const regs = state.course.rapidsRegions;
    if (!regs || !regs.length) return 0;
    let turb = 0;
    for (const r of regs) {
        const bb = r.bb, pad = (r.falloff || 0) / 2 + 1;
        if (x < bb.minX - pad || x > bb.maxX + pad || y < bb.minY - pad || y > bb.maxY + pad) continue;
        const sd = Arena.signedDist(r, x, y);
        const w = VenueDoc.regionWeight(sd, r.falloff);
        if (w <= 0) continue;
        turb = Math.max(turb, w * (r.turbulence != null ? r.turbulence : 0.5));
    }
    return turb;
}

// ── Rapids whitewater ───────────────────────────────────────────────────────
// Drawn as a FIELD, not as particles. The first cut spawned foam blobs that rode the
// current, and however they were shaped they read as white creatures swimming — because
// anything that TRAVELS as a discrete body reads as an object, and the eye finds objects
// before it finds water. An aerial rapid is the opposite: a connected white sheet whose
// texture churns while the sheet itself stays put on the river.
//
// So: two seamless foam TILES (built once, fixed seed — the texture is part of the art
// and must look the same every session), pattern-filled inside each region's own clip,
// scrolled along whatever the Current layer says runs through it and STRETCHED along
// that axis for the streaky grain every reference photo shows. Over that, a stateless
// hash-grid of small crests that brighten and die IN PLACE — churn with no translation.
// Nothing here is an entity: no state, no spawning, no RNG stream, just position and
// state.time in, pixels out.
const RAPIDS_TILE = 256;
const _rapidsTiles = {};            // per colour (day white / night bioluminescence)
function rapidsTiles(color) {
    let t = _rapidsTiles[color];
    if (t) return t;
    // Local PRNG, fixed seed: not fxRand, whose sequence position depends on what else
    // has drawn — these tiles must be identical every build.
    let s = 0x9E3779B9;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const T = RAPIDS_TILE;
    const make = (blobs, rMin, rMax) => {
        const c = document.createElement('canvas');
        c.width = c.height = T;
        const g = c.getContext('2d');
        g.fillStyle = color;
        for (let i = 0; i < blobs; i++) {
            // An irregular CLUMP of discs, not one circle — torn foam, frozen into
            // texture. Geometry is rolled once, then stamped 3x3 so the tile wraps.
            const bx = rnd() * T, by = rnd() * T;
            const r = rMin + rnd() * (rMax - rMin);
            const parts = [];
            for (let k = 0; k < 3; k++)
                parts.push([(rnd() - 0.5) * r * 1.7, (rnd() - 0.5) * r * 1.7, r * (0.45 + rnd() * 0.55)]);
            g.globalAlpha = 0.40 + rnd() * 0.55;
            for (let ox = -T; ox <= T; ox += T) for (let oy = -T; oy <= T; oy += T) {
                g.beginPath();
                for (const [dx, dy, rr] of parts) {
                    g.moveTo(bx + ox + dx + rr, by + oy + dy);
                    g.arc(bx + ox + dx, by + oy + dy, rr, 0, Math.PI * 2);
                }
                g.fill();
            }
        }
        return c;
    };
    // Wash: broad, sparse — pale aerated patches, never a veil. Foam in three DENSITY
    // TIERS, because how much of the water is white is the strongest turbulence cue
    // there is, and alpha alone cannot say it: a riffle is scattered scraps, a stopper
    // is a sheet with dark lanes worn through it.
    // Wash blobs stay SMALL: at the wash pass's large draw scale a big clump magnifies
    // into a readable angular plate, and the wash must be mottling, never geometry.
    // ⚠️ FOUR TIERS, AND THEY ARE MUCH DENSER THAN THE FIRST CUT'S THREE. Modelled by
    // replicating this generator's own arithmetic offline and measuring the mean alpha it
    // produces: 60/130/320 blobs at per-blob alpha 0.28-0.88 gave the top tier a mean of
    // 0.234, which composited to 24% of the water going white at turbulence 1.0 and 17% at
    // 0.5. An aerial photograph of real whitewater is 50-80% white and a riffle 20-30%, so
    // the whole scale was living inside "riffle" — the owner's report was that 100% did not
    // read as whitewater and 50% was barely discernible, and the numbers say exactly that:
    // the entire 0.3-to-1.0 range spanned 14% to 24%.
    //
    // 200/420/700/1000 at 0.40-0.95 measures 0.182/0.331/0.491/0.621 mean alpha, which
    // composites to 13% / 26% / 45% / 65%. That is a scale with a top and a bottom.
    //
    // ⚠️ BUILD COST GOES UP AND IT IS PAID ONCE. The four tiles are ~2,320 clumps against
    // the old three's 640, and each clump stamps 3x3 for the wrap at 3 discs a stamp — call
    // it 63,000 arcs on first sight of a rapid, per colour. It is lazy and cached in
    // _rapidsTiles, so the cost is one frame the first time whitewater comes into view and
    // never again; if that hitch is ever felt, cut the top tier's count and buy the mean
    // alpha back with larger rMax rather than by raising the pass alpha, which is what
    // flattens the ramp.
    t = _rapidsTiles[color] = {
        wash: make(130, 4, 11),
        foam: [make(200, 2, 7), make(420, 2, 7.5), make(700, 2, 7.5), make(1000, 2, 7.5)]
    };
    return t;
}

// Composited through an OFFSCREEN canvas for one reason: the rim. The turbulence field
// fades over the region's falloff, and the honest way to draw that without blur is to
// paint the full texture and then EAT the rim with 'destination-out' strokes — which on
// the main canvas would erase the river underneath. The offscreen layer holds only foam,
// so the erase feathers the foam and nothing else.
let _rapidsFoamCv = null;
let _rapidsScratchCv = null;   // per-region compositing rect — see the mask note below
function drawRapidsFoam(ctx) {
    const regs = state.course.rapidsRegions;
    if (!regs || !regs.length) return;
    const cam = state.camera;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 150;
    const vis = regs.filter(r => {
        const turb = r.turbulence != null ? r.turbulence : 0.5;
        return turb > 0.02
            && !(r.bb.minX > cam.x + viewR || r.bb.maxX < cam.x - viewR
              || r.bb.minY > cam.y + viewR || r.bb.maxY < cam.y - viewR);
    });
    if (!vis.length) return;

    const nite = nightAmt();
    const color = nite > 0 ? BIO_COLOR : '#ffffff';
    const tiles = rapidsTiles(color);
    const t = state.time;

    if (!_rapidsFoamCv) _rapidsFoamCv = document.createElement('canvas');
    const cv = _rapidsFoamCv;
    // HALF RESOLUTION, same argument as the water's offscreen (water.js): everything in
    // this layer is soft noise — pattern washes, foam speckle, a feathered rim — with no
    // hard edge to alias, and the layer was 21.3 ms of Sockeye Run's 51 ms frame at full
    // res. Quarter the pixels, one upscaled blit. Nearest-neighbour on the way up, also
    // the water's answer: bilinear is what cost the water pass 4 ms.
    const FOAM_RS = 0.35;
    const fw = Math.max(1, Math.ceil(ctx.canvas.width * FOAM_RS));
    const fh = Math.max(1, Math.ceil(ctx.canvas.height * FOAM_RS));
    if (cv.width !== fw || cv.height !== fh) { cv.width = fw; cv.height = fh; }
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, fw, fh);
    // Same camera as the scene, scaled down: world coords below, quarter the raster.
    const foamM = new DOMMatrix().scaleSelf(FOAM_RS, FOAM_RS).multiplySelf(ctx.getTransform());
    g.setTransform(foamM);
    // Each region composes in its own rect of this scratch, gets its rim mask applied
    // with destination-in there, and is copied to the foam canvas axis-aligned — so one
    // region's mask can never erase another's foam.
    if (!_rapidsScratchCv) _rapidsScratchCv = document.createElement('canvas');
    const scv = _rapidsScratchCv;
    if (scv.width !== fw || scv.height !== fh) { scv.width = fw; scv.height = fh; }
    const sg = scv.getContext('2d');

    for (const r of vis) {
        const turb = r.turbulence != null ? r.turbulence : 0.5;
        const bb = r.bb;

        // The flow through this rapid is the CURRENT layer's — sampled once at the
        // region's middle to set the grain axis and the streaming rate. A rapid with no
        // stream through it boils in place, grainless.
        const flow = getCurrentAt((bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2);
        const kt = flow ? flow.speed : 0;
        const hasFlow = kt > 0.05;
        const dir = hasFlow ? flow.direction : 0;
        const ux = Math.sin(dir), uy = -Math.cos(dir);
        const angDeg = Math.atan2(uy, ux) * 180 / Math.PI;
        // state.time runs at WORLD_CLOCK (0.24/s); 62.5 * kt makes the sheet stream at
        // the same knots-to-units rate the streak particles ride, so the two agree.
        const adv = t * 62.5 * kt;

        // The outline as a cached Path2D: the poly never changes, and rebuilding a
        // many-vertex path every frame (plus 16 more walks for the rim below) was CPU
        // spent re-describing static geometry.
        if (!r._polyP2D) {
            const pp = new Path2D(), poly = r.poly;
            pp.moveTo(poly[0][0], poly[0][1]);
            for (let i = 1; i < poly.length; i++) pp.lineTo(poly[i][0], poly[i][1]);
            pp.closePath();
            r._polyP2D = pp;
        }
        // The region's rect in foam-canvas pixels: where the scratch is cleared, clipped,
        // composed and copied back from. The pad covers the rim wobble's outward reach.
        const RPAD = 12;
        let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
        for (const [wx, wy] of [[bb.minX - RPAD, bb.minY - RPAD], [bb.maxX + RPAD, bb.minY - RPAD],
                                [bb.minX - RPAD, bb.maxY + RPAD], [bb.maxX + RPAD, bb.maxY + RPAD]]) {
            const sx = foamM.a * wx + foamM.c * wy + foamM.e;
            const sy = foamM.b * wx + foamM.d * wy + foamM.f;
            if (sx < rx0) rx0 = sx; if (sx > rx1) rx1 = sx;
            if (sy < ry0) ry0 = sy; if (sy > ry1) ry1 = sy;
        }
        rx0 = Math.max(0, Math.floor(rx0)); ry0 = Math.max(0, Math.floor(ry0));
        rx1 = Math.min(fw, Math.ceil(rx1)); ry1 = Math.min(fh, Math.ceil(ry1));
        if (rx1 <= rx0 || ry1 <= ry0) continue;

        sg.save();
        sg.setTransform(1, 0, 0, 1, 0, 0);
        sg.clearRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
        sg.beginPath();
        sg.rect(rx0, ry0, rx1 - rx0, ry1 - ry0);
        sg.clip();
        sg.setTransform(foamM);

        // Texture: a faint broad wash under a foam pass whose TILE DENSITY follows
        // turbulence — coverage is the cue, alpha only polishes it. Both stretched
        // hard along the flow for the streaky grain; the wash slides a little across
        // the flow so the two layers never lock together.
        const foamTile = tiles.foam[turb < 0.35 ? 0 : turb < 0.6 ? 1 : turb < 0.85 ? 2 : 3];
        const churn = Math.sin(t * 3.1) * 7;
        const passes = [
            { tile: tiles.wash, a: 0.06 + 0.20 * turb, scale: 2.1, speed: 0.45, across: churn },
            { tile: foamTile, a: 0.34 + 0.66 * turb, scale: 0.7, speed: 1.0, across: -churn * 0.5 }
        ];
        for (const p of passes) {
            // The pattern is a pure function of the tile canvas, so it lives on it —
            // createPattern per pass per region per frame was pointless CPU. setTransform
            // below re-aims the shared object every use; fine, the fill is immediate.
            const pat = p.tile._pat || (p.tile._pat = sg.createPattern(p.tile, 'repeat'));
            const m = new DOMMatrix()
                .translate(ux * adv * p.speed - uy * p.across, uy * adv * p.speed + ux * p.across)
                .rotate(angDeg)
                .scale((hasFlow ? 2.8 : 1) * p.scale, p.scale);
            pat.setTransform(m);
            sg.fillStyle = pat;
            sg.globalAlpha = p.a * (nite > 0 ? 0.55 : 1);
            sg.fillRect(bb.minX, bb.minY, bb.maxX - bb.minX, bb.maxY - bb.minY);
        }

        // Bright crests: a world-anchored hash grid of small glints that brighten and
        // die WITHOUT MOVING — the twinkle is the churn. Density and weight follow
        // turbulence; the grid never shows because every mark is jittered by its hash.
        const step = 30;
        const x0 = Math.max(bb.minX, cam.x - viewR), x1 = Math.min(bb.maxX, cam.x + viewR);
        const y0 = Math.max(bb.minY, cam.y - viewR), y1 = Math.min(bb.maxY, cam.y + viewR);
        sg.fillStyle = color;
        for (let gy = Math.floor(y0 / step) * step; gy <= y1; gy += step) {
            for (let gx = Math.floor(x0 / step) * step; gx <= x1; gx += step) {
                let h = (gx * 374761393 + gy * 668265263) | 0;
                h = Math.imul(h ^ (h >>> 13), 1274126177);
                h = (h ^ (h >>> 16)) >>> 0;
                const h1 = h / 4294967296;
                const h2 = ((Math.imul(h, 48271) >>> 0)) / 4294967296;
                if (h1 > turb * 0.9) continue;
                const tw = Math.sin(t * (9 + h1 * 11) + h2 * Math.PI * 2);
                if (tw <= 0.2) continue;
                const px = gx + (h2 - 0.5) * step * 0.9;
                const py = gy + (h1 - 0.5) * step * 0.9;
                const rr = 2.2 + h2 * 2.8;
                sg.globalAlpha = (0.25 + 0.5 * turb) * tw * (nite > 0 ? 0.7 : 1);
                sg.beginPath();
                sg.moveTo(px + rr, py);
                sg.arc(px, py, rr, 0, Math.PI * 2);
                // A second disc offset just under a radius along the flow, so the two
                // FUSE into one lozenge — separated they read as paired dots.
                sg.moveTo(px + ux * rr * 0.8 + rr * 0.8, py + uy * rr * 0.8);
                sg.arc(px + ux * rr * 0.8, py + uy * rr * 0.8, rr * 0.8, 0, Math.PI * 2);
                sg.fill();
            }
        }

        // THE RIM: eat the foam back over the falloff band, in steps — the poor man's
        // smoothstep, no blur. The stroke is centred on the outline, so the outer half
        // erases nothing (the clip painted nothing there) and the inner half fades the
        // texture out toward the edge instead of cutting blobs on a ruled line.
        // ⚠️ CLAMPED TO THE REGION'S OWN SIZE, AND THIS WAS THE BIGGER OF THE TWO REASONS
        // THE RAPIDS DID NOT READ. The widest erase stroke is `fall * 1.5` centred on the
        // outline, so it reaches `fall * 0.75` INWARD. Measured against Sockeye Run's nine
        // authored regions, FIVE were entirely inside their own erase band — including
        // rapids-3, the only turbulence-1.00 region on the map, whose inradius is 157u
        // against a 225u reach. The strongest whitewater in the venue was being rubbed out
        // completely, and rapids-6 kept 4% of its core.
        //
        // A falloff is a statement about how the turbulence FIELD fades — it belongs to the
        // physics, and rapidsTurbAt still reads r.falloff untouched. What it cannot also be
        // is a licence to erase more foam than the region contains. So the rim gets its own
        // number, capped at 0.8 of the region's inradius (area/perimeter x 2, cheap and
        // computed once), which leaves every region a core at full density however generous
        // its authored falloff. See the jitter note below for why the factor is 0.62.
        if (r._rimInr === undefined) {
            let A2 = 0, L2 = 0;
            const q = r.poly;
            for (let i = 0; i < q.length; i++) {
                const u = q[i], v = q[(i + 1) % q.length];
                A2 += u[0] * v[1] - v[0] * u[1];
                L2 += Math.hypot(v[0] - u[0], v[1] - u[1]);
            }
            r._rimInr = L2 > 0 ? Math.abs(A2) / L2 : 0;
        }
        // ⚠️ 0.62, NOT 0.8, AND THE JITTER IS WHY. The widest stroke reaches fall*0.75 inward
        // and the rim wobble adds up to fall*0.34 more at its deepest excursion (the three
        // harmonics sum to 1.0 at worst), so the true worst-case bite is 1.09*fall. At the
        // old 0.8 cap that ate 87% of the inradius where the wobble ran deepest, leaving a
        // thread. 0.62 keeps the guarantee the clamp exists for: ~32% of the core survives
        // even at the deepest point of the wobble, and ~46% typically.
        const fall = Math.max(40, Math.min(r.falloff || 0, r._rimInr * 0.62));

        // ⚠️ AND THE RIM IS RAGGED, NOT PARALLEL. Three fixed-width strokes on the region's
        // OWN outline gave a fade that was regular in both ways a fade can be: BANDED,
        // because three steps is three visible steps, and GEOMETRIC, because every contour
        // was an exact parallel of the polygon — so the authored shape's straight edges and
        // corners read straight through the foam and the water ended on a drawn line.
        //
        // Fixed with a jittered rim path, cached per region. The outline is resampled at a
        // fixed spacing and each sample slid along the edge normal by a wobble that is the
        // sum of three harmonics at 3, 7 and 13 cycles per perimeter. Integer cycle counts
        // are the whole trick: the noise is periodic over the closed loop, so it wraps with
        // no seam, and it is smooth rather than spiky because neighbouring samples share the
        // same low harmonics. The sign of the offset does not matter — the wobble is
        // zero-mean, so it fingers in and out of the true outline, which is what a rapid's
        // edge actually does. Phases come from a hash of the region's own first vertex, so
        // every region wobbles differently and none of them moves between sessions.
        //
        // Steps go 3 -> 16 on a solved alpha ramp, which is the banding half of the fix.
        if (!r._rimPath) {
            const q = r.poly, pts = [];
            let L3 = 0;
            for (let i = 0; i < q.length; i++) L3 += Math.hypot(q[(i + 1) % q.length][0] - q[i][0],
                                                                q[(i + 1) % q.length][1] - q[i][1]);
            let hh = ((q[0][0] * 374761393 + q[0][1] * 668265263) | 0);
            hh = Math.imul(hh ^ (hh >>> 13), 1274126177); hh = (hh ^ (hh >>> 16)) >>> 0;
            const ph = [hh / 4294967296, (Math.imul(hh, 48271) >>> 0) / 4294967296,
                        (Math.imul(hh, 69621) >>> 0) / 4294967296].map(v => v * Math.PI * 2);
            const amp = fall * 0.34;
            const step = Math.max(10, L3 / 220);
            let s = 0;
            for (let i = 0; i < q.length; i++) {
                const a0 = q[i], b0 = q[(i + 1) % q.length];
                const ex = b0[0] - a0[0], ey = b0[1] - a0[1];
                const el = Math.hypot(ex, ey) || 1;
                const nx = ey / el, ny = -ex / el;          // edge normal; sign is irrelevant
                for (let d = 0; d < el; d += step) {
                    const u = s + d, k = u / L3 * Math.PI * 2;
                    const n = 0.52 * Math.sin(3 * k + ph[0])
                            + 0.30 * Math.sin(7 * k + ph[1])
                            + 0.18 * Math.sin(13 * k + ph[2]);
                    pts.push([a0[0] + ex * (d / el) + nx * n * amp,
                              a0[1] + ey * (d / el) + ny * n * amp]);
                }
                s += el;
            }
            r._rimPath = pts;
            // ...and as a Path2D, built once: the 16 rim strokes below used to re-walk
            // these ~220 points each, every frame.
            const rp = new Path2D();
            rp.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) rp.lineTo(pts[i][0], pts[i][1]);
            rp.closePath();
            r._rimP2D = rp;
        }
        // THE MASK: interior fill minus the sixteen erase strokes, BAKED ONCE per region.
        // The rim is static geometry — the outline, the wobble, the solved alpha ramp all
        // never change — yet the sixteen wide strokes were being re-rasterized every frame
        // and were most of the foam layer's remaining cost. Baked, the whole rim (and the
        // clip: alpha is zero outside the outline) is one destination-in drawImage.
        //
        // Sixteen steps on a (1-f)^2.6 ramp, solved rather than guessed: the numbers are
        // the pair that minimises the LARGEST single jump in the cumulative erase while
        // still reaching ~92% at the outline. It profiles 92/88/78/71/58/45/39/28/22/12/0
        // with no step over 6.7%, against the old three strokes' 89/75/55/0 whose smallest
        // jump was 20 points — and a 20-point jump in a fade IS a band.
        if (!r._maskCv) {
            const MPAD = 12;                       // covers the wobble's outward reach
            const mw = bb.maxX - bb.minX + MPAD * 2, mh = bb.maxY - bb.minY + MPAD * 2;
            const msc = Math.min(0.5, 2000 / Math.max(mw, mh));   // mask px per world unit
            const mc = document.createElement('canvas');
            mc.width = Math.max(4, Math.ceil(mw * msc));
            mc.height = Math.max(4, Math.ceil(mh * msc));
            const mg = mc.getContext('2d');
            mg.setTransform(msc, 0, 0, msc, (MPAD - bb.minX) * msc, (MPAD - bb.minY) * msc);
            mg.fillStyle = '#fff';
            mg.fill(r._polyP2D);
            mg.globalCompositeOperation = 'destination-out';
            mg.strokeStyle = '#000';
            const RIM_STEPS = 16;
            for (let i = 0; i < RIM_STEPS; i++) {
                const f = (i + 1) / RIM_STEPS;             // 1 = widest, reaches furthest in
                mg.globalAlpha = 0.06 + 0.34 * Math.pow(1 - f, 2.6);
                mg.lineWidth = fall * 1.5 * f;
                mg.stroke(r._rimP2D);
            }
            r._maskCv = mc; r._maskPad = MPAD; r._maskW = mw; r._maskH = mh;
        }
        // Shape and rim in one composite, confined to this region's clip rect...
        sg.globalCompositeOperation = 'destination-in';
        sg.globalAlpha = 1;
        sg.drawImage(r._maskCv, bb.minX - r._maskPad, bb.minY - r._maskPad, r._maskW, r._maskH);
        sg.restore();
        // ...then the finished region lands on the foam canvas axis-aligned.
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(scv, rx0, ry0, rx1 - rx0, ry1 - ry0, rx0, ry0, rx1 - rx0, ry1 - ry0);
        g.restore();
    }

    // Composite the finished foam layer over the scene in one upscaled draw.
    // ⚠️ smoothing off inside save/restore — it is canvas state (see water.js).
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
}

function getCurrentAt(x, y) {
    const base = ambientCurrentAt(x, y);
    // AUTHORED CURRENT REGIONS. The same construction as wind regions — polygon,
    // centered soft edge, and overlapping regions AVERAGED as a partition of unity,
    // with the leftover weight going to the ambient stream.
    //
    // Averaging is deliberate, and it replaced summing. A region states the flow THERE —
    // an absolute set and rate — and summing meant two statements about the same water
    // reinforced each other: the river mouth read 2.2 kt where the strongest authored
    // stream was 2.0, and the bay read 1.35 kt where nothing authored more than 0.3,
    // because three faint drift regions and the river's soft edge all piled up.
    // Averaged, overlap means BLEND: the river's jet dies smoothly into the bay drift it
    // overlaps, and nothing anywhere can run faster than the strongest thing authored.
    //
    // Direction averages as unit vectors and speed as a scalar, exactly as the wind
    // blend does and for the same reason: two opposed streams should hand over from one
    // to the other, not cancel into invented slack halfway.
    //
    // Touches no RNG (state.time only), so a current region cannot move the eval anchor.
    const creg = state.course.currentRegions;
    if (!creg || !creg.length) {
        if (!base || !(base.speed > 0.001)) return base;
        const f = shadowAt(x, y, base.direction, 'current');
        return f === 1 ? base : { speed: base.speed * f, direction: base.direction };
    }

    let wsum = 0, ux = 0, uy = 0, sacc = 0;
    for (const r of creg) {
        // Edge ramp centered on the outline, exactly as wind regions do — see
        // VenueDoc.regionWeight. The cull box pads by falloff/2 for the outside half.
        const bb = r.bb, pad = (r.falloff || 0) / 2 + 1;
        if (x < bb.minX - pad || x > bb.maxX + pad || y < bb.minY - pad || y > bb.maxY + pad) continue;
        const sd = Arena.signedDist(r, x, y);
        const w = VenueDoc.regionWeight(sd, r.falloff);
        if (w <= 0) continue;
        const osc = r.period > 0 ? Math.sin((state.time / r.period) * Math.PI * 2 + r.phase) : 0;
        const dir = r.direction + r.dirVar * osc;
        ux += Math.sin(dir) * w;
        uy += -Math.cos(dir) * w;
        sacc += Math.max(0, r.speed + r.speedVar * osc) * w;
        wsum += w;
    }
    if (wsum <= 0) {
        // Outside every region the water is the ambient stream, shaded like any flow.
        if (!base || !(base.speed > 0.001)) return base;
        const f = shadowAt(x, y, base.direction, 'current');
        return f === 1 ? base : { speed: base.speed * f, direction: base.direction };
    }
    // The leftover weight is the ambient stream's share — a region's soft edge fades
    // into whatever the water was already doing, which is slack on most venues.
    const wBase = Math.max(0, 1 - wsum);
    if (base && base.speed > 0 && wBase > 0) {
        ux += Math.sin(base.direction) * wBase;
        uy += -Math.cos(base.direction) * wBase;
        sacc += base.speed * wBase;
    }
    const total = wsum + wBase;
    const out = { speed: total > 0 ? sacc / total : 0, direction: Math.atan2(ux, -uy) };
    // Slack water behind a solid thing. Applied to the RESULTANT, because what a rock
    // shelters you from is whatever is actually flowing there — ambient stream and authored
    // regions together — not one contribution to it.
    if (out.speed > 0.001) out.speed *= shadowAt(x, y, out.direction, 'current');
    return out;
}






// ── Mask-baked geography ────────────────────────────────────────────────────
// The venue's land comes from a painted mask (assets/images/venues/masks/), baked
// to polygons by art/bake_mask.py. The mask is the single source of truth: navy
// water, white snow, grey granite, and a green start/finish line. Both the
// colliders and the drawn coast come from the same file, so what you paint is
// exactly what you sail.
//
// Replaces the procedural coast entirely for this venue. That version could not
// match a drawn map — it only ever produced a lobed front plus one wavy flank.
// World units the 0..1 mask spans. This is the venue's scale knob: doubling it
// doubles every distance, so the start->island leg and the race length scale
// with it. 25000 puts the leg around 14.7k units.
function updateWindWaves(dt) {
    const camX = state.camera.x;
    const camY = state.camera.y;
    const radius = Math.max(canvas.width, canvas.height) * 0.8;

    const gridSize = 150;

    const iStart = Math.floor((camX - radius) / gridSize);
    const iEnd = Math.floor((camX + radius) / gridSize);
    const jStart = Math.floor((camY - radius) / gridSize);
    const jEnd = Math.floor((camY + radius) / gridSize);

    const activeKeys = new Set();

    for (let j = jStart; j <= jEnd; j++) {
        for (let i = iStart; i <= iEnd; i++) {
             const key = `${i},${j}`;
             activeKeys.add(key);

             let wave = state.waveStates.get(key);
             if (!wave) {
                 const seed = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
                 const rand = seed - Math.floor(seed);

                 const bx = i * gridSize;
                 const by = j * gridSize;

                 const ox = (rand - 0.5) * gridSize * 0.6;
                 const oy = ((rand * 10 % 1) - 0.5) * gridSize * 0.6;

                 wave = {
                     x: bx + ox,
                     y: by + oy,
                     dist: rand * gridSize,
                     angle: 0,
                     speed: 0
                 };
                 // Stitched-crest geometry (reference look): seeded zigzag
                 // polyline with dash gaps, optional echo line, family tilt.
                 let s2 = ((Math.abs(Math.floor(seed * 1000)) % 2147483647) >>> 0) || 1;
                 const pr = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
                 const n = 5 + Math.floor(pr() * 5);
                 wave.pts = [];
                 for (let p = 0; p <= n; p++) wave.pts.push({ t: p / n, y: (pr() - 0.5) * 6 });
                 wave.gaps = [];
                 for (let p = 0; p < n; p++) wave.gaps.push(pr() < 0.78);
                 wave.echo = pr() < 0.35;
                 wave.echoOff = 4 + pr() * 4;
                 wave.tilt = (pr() - 0.5) * 0.5; // two loose crest families crossing
                 wave.lwj = 0.9 + pr() * 0.8;
                 state.waveStates.set(key, wave);
             }

             const wind = getWindAt(wave.x, wave.y);

             // Travel Speed: Proportional to wind speed
             const travelFactor = 3.0;
             const moveDist = wind.speed * travelFactor * dt;

             wave.dist = (wave.dist + moveDist) % gridSize;
             wave.angle = wind.direction + Math.PI;
             wave.windSpeed = wind.speed;
        }
    }

    // Prune
    for (const key of state.waveStates.keys()) {
        if (!activeKeys.has(key)) {
            state.waveStates.delete(key);
        }
    }
}

// ── NIGHT: AMBIENT WASH, MOONLIGHT AND BIOLUMINESCENCE ──────────────────────
// Glowtide Strait is sailed by moonlight, and until now "night" was only a dark PALETTE:
// the water was navy and everything floating on it was still lit for a summer afternoon.
// This is the light model that was missing. Three passes, and the order between them is
// the whole idea:
//
//   drawNightWater  the moonlight, drawn WITH the surface — under the waves, the wakes and
//                   the fleet, and before the wash, so the ambient dims it like real water.
//   drawNightWash   MULTIPLY, over every physical layer — the ambient comes down on land,
//                   props, hulls, sails and marks alike, so nothing looks pasted on.
//   drawNightGlow   ADDITIVE, after the wash — only what makes its own light, which is
//                   exactly what the wash must not touch: bioluminescence and nav lights.
//
// THE STRENGTH IS THE VENUE'S, not a global. `palette.night` (0..1) rides in the document
// with the water colours and reaches WATER_CONFIG through applyVenuePalette like any other
// key, so a venue that authors none is untouched and the other nine keep their daylight.
function drawWindWaves(ctx) {
    if (state.waveStates.size === 0) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineCap = 'round';

    for (const wave of state.waveStates.values()) {
        if (wave.windSpeed < 2) continue;

        const gridSize = 150;
        const cycle = wave.dist / gridSize;
        const alphaWave = Math.sin(cycle * Math.PI);

        // Size proportional to speed
        // 5 knots -> small, 25 knots -> large
        const size = wave.windSpeed * 4.5;

        // Opacity based on speed
        const intensity = Math.min(1.0, (wave.windSpeed - 2) / 20);

        ctx.globalAlpha = alphaWave * intensity * 0.75;
        ctx.lineWidth = (1.0 + intensity * 1.2) * (wave.lwj || 1);

        const dx = Math.sin(wave.angle) * wave.dist;
        const dy = -Math.cos(wave.angle) * wave.dist;

        ctx.save();
        ctx.translate(wave.x + dx, wave.y + dy);
        ctx.rotate(wave.angle + (wave.tilt || 0));

        const w = Math.max(26, Math.min(84, size));
        const pts = wave.pts, gaps = wave.gaps;
        if (pts) {
            // ⚠️ ONE STROKE PER CREST, NOT ONE PER SEGMENT. Every segment used to be its own
            // beginPath/stroke pair, and this layer is the single most expensive thing in the
            // frame because of it: measured at 1,900 stroke calls per frame on every venue,
            // ~38% of the ~5,000 canvas operations a frame issues (eval/_frame_attrib.js).
            // The segments of one crest all share a style, so they are subpaths of ONE path
            // and cost one submission — same geometry, same width, same alpha, same round
            // caps, because a moveTo starts a fresh subpath and each subpath keeps its caps.
            //
            // ⚠️ IT IS NOT PIXEL-FOR-PIXEL, and the difference is worth knowing. Where two
            // adjacent segments both survive the gap test they share an endpoint, and the
            // round caps there overlap: stroked separately that overlap composites TWICE and
            // leaves a brighter bead at every joint, stroked as one path it composites once.
            // So the crests lose a faint dotted quality along their length.
            //
            // MEASURED rather than asserted (eval/_windwave_pixels.js renders the layer alone
            // on a black field, both trees, and diffs): 2.98% of the pixels the layer touches
            // change at all, 1.37% by more than 8/255, and the layer's MEAN INK is unchanged
            // to one decimal (49.8 both). Every changed pixel is a joint. The direction is
            // toward what a stroke of this width and alpha is supposed to look like rather
            // than away from it, which is why this was taken rather than kept bit-exact.
            ctx.beginPath();
            let drew = false;
            for (let p = 0; p < gaps.length; p++) {
                if (!gaps[p]) continue;
                ctx.moveTo((pts[p].t - 0.5) * w, pts[p].y);
                ctx.lineTo((pts[p + 1].t - 0.5) * w, pts[p + 1].y);
                drew = true;
            }
            if (drew) ctx.stroke();
            if (wave.echo) {
                ctx.globalAlpha *= 0.45;
                ctx.lineWidth *= 0.8;
                ctx.beginPath();
                ctx.moveTo((pts[1].t - 0.5) * w, pts[1].y + wave.echoOff);
                ctx.lineTo((pts[pts.length - 2].t - 0.5) * w, pts[pts.length - 2].y + wave.echoOff);
                ctx.stroke();
            }
        }

        ctx.restore();
    }
    ctx.restore();
}

// Draw Water (Waves) - Same as original
const SURF_MAX_ALPHA = 0.55;      // the same restraint the comet layer keeps: under the fleet
const SURF_MIN_WIND = 4;          // knots — below this the sea does not break
const SURF_REACH = 40;            // how far the crest runs in, world units — far
                                  // enough that the travel is legible, not a twitch
const SURF_STEP = 110;            // foam breaks at its own scale, not the coastline's —
                                  // long enough that a crest is a WAVE and not a tick mark
const SURF_BREAK = 0.88;          // where in the run-in the crest breaks: peak, then gone
const SURF_FOAM_BUDGET = 14;      // foam blobs per frame — a long coast must not flood

// ── WHERE A SWELL VENUE'S SURF COMES FROM INSTEAD ───────────────────────────
//
// On a venue with a `swell` block the breakers are the SWELL arriving, not the local breeze
// kicking up a chop, and every one of the four things surf needs changes hands:
//
//   WHICH WAY  the primary train's travel direction, not the wind's. They usually agree on
//              the ocean (the swell is laid out downwind of the mean breeze) but they are
//              not the same thing and only one of them is what breaks on a beach.
//   WHEN       the train's OWN PHASE at that stretch of coast. This is the whole effect:
//              every shore on the venue breaks in step with the wave that is under your
//              boat, and because phase varies along a coast the break RUNS ALONG IT like a
//              zipper wherever the crests meet the shore at an angle. A per-stretch random
//              offset — which is what the wind path uses, correctly, for chop — destroys it.
//   HOW HARD   the swell's height, and then two coastal terms the wind path never had:
//              refraction round headlands and the focus/shelter of the shoreline's own
//              shape. See SURF_REFRACT_FLOOR and surfFocus.
//   HOW FAR    the stand-off scales with height. A big swell trips further out and its
//              white water is wider, which is the most legible statement of size there is
//              from above.
//
// One crest per period, not the wind path's two: the run-in is a wavelength of a real train
// now, and putting two crests in it would break the beach at twice the swell frequency.
const SURF_SWELL_REF_M = 2.6;     // metres of swell at which the coast breaks at full power
const SURF_SWELL_REACH = 2.4;     // most the stand-off may stretch, at a big sea
// REFRACTION. Waves bend into shallow water, so a shore at right angles to the swell still
// gets some of it — the classic aerial of a swell wrapping round a headland into the bay
// behind. Held low: the exposed side has to stay unmistakable, and race-view.md §9's rule
// against an identical white ribbon round every shoreline is about a ribbon that says
// NOTHING. A graded one that still points at the weather is the picture, not the failure.
const SURF_REFRACT_FLOOR = 0.16;
// FOCUS. Refraction concentrates energy on headlands and spreads it in bays — the reason a
// point breaks when the cove beside it is glassy. Measured off the shoreline's own turning
// over SURF_FOCUS_ARC of coast, so it needs no authoring and no per-shape flag.
const SURF_FOCUS_GAIN = 0.55;     // headland x1.55, bay x0.45
const SURF_FOCUS_ARC = 320;       // world units of coast the turn is measured over
const SURF_FOCUS_R = 420;         // radius of curvature at which a point is a full headland
const SURF_PHASE_JITTER = 0.16;   // cycles of scatter left between neighbouring stretches

// WHAT SEA IS ARRIVING AT THIS PIECE OF COAST. Both surf passes come through here, so they
// cannot disagree about which way the water is running or when it breaks — the bug that
// would show up as foam thrown onto a beach a beat before or after the crest that threw it.
//
// Returns null when nothing is breaking here, which is the single early-out both callers use.
function surfSeaAt(x, y) {
    const sw = window.Swell && window.Swell.active() ? window.Swell.primary() : null;
    if (sw) {
        // Travel direction and phase straight off the train the physics is using. No second
        // copy of the wave field to drift out of step with the one the boats are sailing.
        const ph = window.Swell.phaseAt(sw, x, y);
        // 0 at the crest and rising with time: phase runs DOWN as the wave comes on
        // (φ = k·s - ωt), so the cycle position is its negative, wrapped.
        let u = (-ph / (Math.PI * 2)) % 1;
        if (u < 0) u += 1;
        const hM = sw.heightM || 0;
        // ⚠️ THE CREST GROWS WITH THE STAND-OFF, and leaving it behind is what made the
        // first cut look like scribble. `bow` and the per-node jitter are fractions of the
        // reach, so scaling the reach alone gave a 40-unit crest 30 units of arc and 16 of
        // wobble — a hairpin, not a wave. The shape terms are pinned to the base constant on
        // every venue (see drawSurf) and what stretches here instead is how much COAST one
        // crest covers: a big swell breaks in long lines, a small one in short ones.
        const stretch = Math.min(SURF_SWELL_REACH, 0.75 + hM / SURF_SWELL_REF_M);
        return {
            tx: sw.sx, ty: sw.sy,
            power: Math.max(0, Math.min(1.35, hM / SURF_SWELL_REF_M)),
            reach: SURF_REACH * stretch,
            step: SURF_STEP * stretch,
            // ── AND ITS OWN CREST WEIGHT ────────────────────────────────────
            // The drawing was tuned for wind CHOP, which is thin, sparse and broken, and it
            // is right for that. A 3.9 m ocean swell landing on a beach is not thin, sparse
            // or broken — it is a band of white water along the whole exposed shore — and
            // parameterising one set of numbers to cover both would have meant retuning nine
            // venues to fix one. So the style travels with the sea, exactly as the timing
            // and the exposure already do, and the wind branch below still hands back what
            // the layer has always used.
            gap: 0.12,          // bare stretches between breaks: a swell leaves few
            skip: 0.08,         // segments dropped from a crest: a swell breaks continuous
            weight: 1.35,       // line width against the wind crest's
            maxAlpha: 0.78,     // ...and it is allowed to read as WHITE at the break
            // How fast a crest brightens on its way in. The wind value (0.75) keeps chop
            // faint until it lands; a swell is visible the whole way, which is the half of
            // "you see it coming" that a build curve controls.
            build: 0.5,
            foam: 3,            // blobs left at each break — the band along the waterline
            foamScale: 1.8,
            standoffPow: 0.55,
            cycle: u, rate: sw.w / (Math.PI * 2), crests: 1, floor: SURF_REFRACT_FLOOR
        };
    }
    // ── EVERY OTHER VENUE, UNCHANGED ───────────────────────────────────────
    // The wind path is the original one and stays exact: same field, same ramp, same hard
    // cutoff at the lee shore, same two crests, same `state.time` clock. Nine venues have
    // to come out of this edit byte-identical, and this is the branch that guarantees it.
    const w = regionWindAt(x, y);
    if (w.speed < SURF_MIN_WIND) return null;
    return {
        tx: -Math.sin(w.direction), ty: Math.cos(w.direction),
        power: Math.max(0, Math.min(1, (w.speed - SURF_MIN_WIND) / 12)),
        reach: SURF_REACH, step: SURF_STEP, gap: 0.28, skip: 0.22, weight: 1,
        maxAlpha: SURF_MAX_ALPHA, build: 0.75, foam: 1, foamScale: 1, standoffPow: 0,
        cycle: null, rate: 0, crests: 2, floor: 0
    };
}

// HEADLAND OR BAY, measured rather than authored: the shoreline's own signed turning over
// SURF_FOCUS_ARC of coast either side of each edge. A point turns the coast outward through
// a large angle in a short distance; the inside of a bay turns it the other way.
//
// Cached per island beside `_surfDry` and `_outSign` — the geometry is fixed, surf already
// skips anything that drifts, and this is a windowed walk of the whole ring.
function surfFocus(isl) {
    if (isl._surfFocus) return isl._surfFocus;
    const v = isl.vertices, n = v.length, sgn = surfOutwardSign(isl);
    // Edge headings and lengths first, so the windowed sum below is a walk and not a
    // repeated re-derivation.
    const ang = new Array(n), len = new Array(n);
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const ex = v[i].x - v[j].x, ey = v[i].y - v[j].y;
        ang[i] = Math.atan2(ey, ex);
        len[i] = Math.hypot(ex, ey);
    }
    const norm1 = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
    // ⚠️ SIGNED CURVATURE AGAINST A FIXED FEATURE SIZE, and both of the obvious alternatives
    // are wrong in a way that took a measurement to see:
    //
    //   "turns more than half a right angle over the window" — every shape on the ocean
    //   floored at the BAY end, because a small island's whole ring turns 360°, so any
    //   window worth measuring saturates and a rock reads as one continuous cove. A rock in
    //   a swell is the opposite: it is all headland.
    //
    //   "turns faster than this shape does on average" — scale-free, and it makes a circle
    //   correctly neutral, but it also makes a STRAIGHT coast read as sheltered, because
    //   straight is below any closed shape's average. Straight coast has to be neutral.
    //
    // So: neutral at zero curvature, saturating at a radius of curvature of SURF_FOCUS_R.
    // That is the size of feature the camera can actually see, and it is a fact about the
    // VIEW rather than about any one shape — which is why a 200-unit rock comes out fully
    // focused all round (it is smaller than a headland) and a 3 km coast's gentle bend comes
    // out nearly flat (you cannot see that it is bending at all).
    //
    // The window widens on a coarse polygon: turning lives at the vertices, so on a coast
    // with 500-unit edges a fixed 320-unit window straddles one vertex or none and the
    // result alternates between saturated and zero.
    const perim = len.reduce((a, b) => a + b, 0);
    const win = Math.max(SURF_FOCUS_ARC, 2.5 * perim / n);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        // Walk out both ways to win/2 and accumulate the signed turn between consecutive
        // edges. `sgn` puts "outward" on the right side of zero whichever way this
        // particular ring is wound.
        let turn = 0, arc = 0;
        for (let s = 1; s < n && arc < win * 0.5; s++) {
            const k = (i - s + n) % n, k1 = (k + 1) % n;
            turn += norm1(ang[k1] - ang[k]);
            arc += len[k];
        }
        for (let s = 0; s < n && arc < win; s++) {
            const k = (i + s) % n, k1 = (k + 1) % n;
            turn += norm1(ang[k1] - ang[k]);
            arc += len[k];
        }
        if (arc < 1) { out[i] = 1; continue; }
        // ⚠️ `turn * sgn`, NOT `-sgn`. Worked through on a unit square both ways round: a
        // ring whose outward normal is the edge turned -90° (sgn +1) accumulates a POSITIVE
        // total turn, and flipping the winding flips both together — so the two cancel and
        // convex is positive in either. Getting it backwards is not subtle in the numbers
        // but is easy to miss in a screenshot: it made every small island, which should be
        // headland all the way round, come out as one continuous cove.
        const f = Math.max(-1, Math.min(1, (turn * sgn / arc) * SURF_FOCUS_R));
        out[i] = 1 + SURF_FOCUS_GAIN * f;
    }
    isl._surfFocus = out;
    return out;
}

// Which way is OUT of this polygon? Winding is consistent around a ring, so this is one
// test per shape, cached — not one per edge per frame.
function surfOutwardSign(isl) {
    if (isl._outSign) return isl._outSign;
    // ⚠️ MEASURED, NOT DERIVED. The shoelace sign depends on winding AND on the y-axis
    // direction, and I got it wrong twice reasoning about it — once drawing no surf at all,
    // once drawing it on the lee shore. So: take a real edge, step off it by a hair along
    // the candidate normal, and ASK the polygon whether that point is inside. No sign
    // convention to get backwards.
    const v = isl.vertices;
    let sign = 1;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
        const a = v[j], b = v[i];
        const ex = b.x - a.x, ey = b.y - a.y;
        const len = Math.hypot(ex, ey);
        if (len < 8) continue;                       // too short to trust the normal
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const nx = ey / len, ny = -ex / len;
        const probe = Math.min(6, len * 0.25);
        const outIn = pointInPoly(mx + nx * probe, my + ny * probe, v);
        const inIn = pointInPoly(mx - nx * probe, my - ny * probe, v);
        if (outIn === inIn) continue;                // ambiguous here — try another edge
        sign = outIn ? -1 : 1;
        break;
    }
    isl._outSign = sign;
    return sign;
}

// How far outboard to ask "is there water here?". Small, because the question is only
// whether the NEXT shape starts immediately outside this edge — a longer reach would step
// across a narrow channel and call a real shore dry.
const SURF_DRY_PROBE = 14;

// Which of this shape's edges are NOT against water — cached per island, like _outSign.
//
// ⚠️ A SHAPE IS NOT A COASTLINE. drawSurf used to ring every island's whole perimeter,
// which is right only when a shape's outline IS its waterline. Lighthouse Cove is built the
// other way: a big sand isle with a `coastalscrub` cap drawn ON TOP of it and rock outcrops
// on top of that, so most of those shapes' edges are inland boundaries between two kinds of
// ground. Every one of them got a full ring of breakers, painted over the land, because
// drawSurf runs after drawIslands — surf breaking on a rock in the middle of a meadow.
//
// The test is the one surfOutwardSign already uses: step off the edge along the outward
// normal and ASK. If that point is inside another solid shape, this edge faces ground, not
// sea. A rock outcrop half on the shore keeps surf on its seaward edges and loses it on the
// inland ones, which is what a photograph shows and what a per-shape flag could not express.
//
// Cached because the geometry is fixed — surf already skips drifting floes, so nothing that
// moves reaches this. One pass per island per race, not per edge per frame.
function surfDryEdges(isl) {
    if (isl._surfDry) return isl._surfDry;
    const v = isl.vertices, sgn = surfOutwardSign(isl);
    const dry = new Array(v.length).fill(false);
    // ⚠️ DRAWN GROUND ONLY — `hidden` shapes are excluded, and that is a correctness point
    // rather than an optimisation. compile emits a hidden circle for every `contact: hard`
    // prop, and the channel buoys' colliders sit in open WATER; counting them as ground
    // would silence the surf on any real shore a buoy happens to be moored off. The river's
    // 82 hidden banks are the mirror case — they lie behind one continuous drawn shore, so
    // excluding them changes nothing there. The question this asks is what the PLAYER sees
    // outside the edge, so only shapes that draw get a vote.
    // `reef` is excluded for a second reason: a coral reef is SUBMERGED. It draws, so it
    // passes the hidden test, but a beach facing one across a lagoon still meets water and
    // still breaks. No shipped venue exercises this today (measured: lagoon's inland edges
    // all probe into coralsand, not reef) — it is here so the first venue that puts a beach
    // inside a reef ring does not silently lose its surf.
    const others = (state.course.islands || []).filter(o =>
        o !== isl && !o.hidden && !o.isFloe && !o.awash && !o.reef &&
        o.vertices && o.vertices.length >= 3);
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
        const a = v[j], b = v[i];
        const ex = b.x - a.x, ey = b.y - a.y;
        const len = Math.hypot(ex, ey);
        if (len < 4) continue;
        const px = (a.x + b.x) / 2 + (ey / len) * sgn * SURF_DRY_PROBE;
        const py = (a.y + b.y) / 2 + (-ex / len) * sgn * SURF_DRY_PROBE;
        for (const o of others) {
            const dx = px - o.x, dy = py - o.y;
            if (dx * dx + dy * dy > o.radius * o.radius) continue;   // bounding reject first
            if (pointInPoly(px, py, o.vertices)) { dry[i] = true; break; }
        }
    }
    isl._surfDry = dry;
    return dry;
}

// ── FOAM LEFT BEHIND WHERE A CREST BREAKS ───────────────────────────────────
//
// ⚠️ THIS LIVES IN UPDATE, NOT IN drawSurf, and that is not a style preference. Spawning
// particles from the render path is the bug this codebase has already been bitten by: the
// spawn point is chosen near the camera, so the number of RNG draws depended on where you
// were looking, and race 2 in a session diverged from race 1. Particles get their own
// stream (fxRand) and are created from the simulation side. Breaking that rule here would
// reintroduce exactly that failure.
//
// A crest's phase is stateless — derived from `state.time` — so "did this one break since
// the last frame" is just: is p inside the slice the phase advanced through. No per-stretch
// bookkeeping, and it cannot double-fire or miss.
function updateSurf(dt) {
    if (!state.course.islands || settings.surf === false || dt <= 0) return;
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.max(canvas.width, canvas.height) * 0.7;
    const viewR2 = viewR * viewR;
    const t = state.time;
    let budget = SURF_FOAM_BUDGET;          // per frame, so a long coastline cannot flood

    for (const isl of state.course.islands) {
        if (budget <= 0) break;
        // NOT ON DRIFTING BERGS. A floe is a small object adrift on the water, not a coast:
        // surf round every one of Glacier Sound's 112 floes is fussy detail that fights the
        // fleet for attention, and they move, so it never settles. Fixed ice IS a shoreline
        // and keeps its breakers.
        //
        // NOR ON SHOALS, though a real bar is exactly where a sea trips and breaks. What
        // this spawns is SHORE surf — foam that runs up a beach and dies at a waterline —
        // and a submerged bar has no waterline for it to die at, so the ring of breakers
        // would draw in the coastline the whole feature exists not to have. Breaking water
        // over a shoal is a different effect and wants building as one. (drawSurf skips
        // them on the same test, for the same reason.)
        if (isl.hidden || isl.isFloe || isl.awash || isl.reef || !isl.vertices || isl.vertices.length < 3) continue;
        const dxi = isl.x - camX, dyi = isl.y - camY;
        if (dxi * dxi + dyi * dyi > (viewR + isl.radius) ** 2) continue;
        const sgn = surfOutwardSign(isl), V = isl.vertices;
        const dry = surfDryEdges(isl);
        const focus = surfFocus(isl);

        for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
            if (budget <= 0) break;
            if (dry[i]) continue;                        // no foam thrown onto inland ground
            const a = V[j], b = V[i];
            const ex = b.x - a.x, ey = b.y - a.y;
            const len = Math.hypot(ex, ey);
            if (len < 12) continue;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            if ((mx - camX) ** 2 + (my - camY) ** 2 > viewR2) continue;

            const nx = (ey / len) * sgn, ny = (-ex / len) * sgn;
            // The same one call drawSurf makes, at the same point — see surfSeaAt. Foam
            // thrown a beat off the crest that threw it is the whole failure this avoids.
            const sea = surfSeaAt(mx, my);
            if (!sea) continue;
            const face = -(nx * sea.tx + ny * sea.ty);
            if (face <= 0.02 && sea.floor <= 0) continue;
            const expo = sea.floor + (1 - sea.floor) * Math.max(0, face) * Math.max(0, face);
            const power = Math.min(1, expo * sea.power * (sea.floor > 0 ? focus[i] : 1));
            if (power < 0.25) continue;                 // a gentle shore does not throw foam

            const hash = (u, w2) => { const h = Math.sin(u * 12.9898 + w2 * 78.233) * 43758.5453; return h - Math.floor(h); };
            const n = Math.max(1, Math.round(len / sea.step));
            for (let k = 0; k < n && budget > 0; k++) {
                const u0 = k / n;
                const cx0 = a.x + ex * u0, cy0 = a.y + ey * u0;
                const r1 = hash(cx0, cy0), r2 = hash(cy0, cx0);
                if (r2 < sea.gap) continue;
                const speed = 0.85 + power * 0.75;
                for (let c = 0; c < sea.crests && budget > 0; c++) {
                    // ⚠️ THE CYCLE RATE HAS TO MATCH THE ONE drawSurf ANIMATES, or the
                    // window below tests the wrong slice and the foam fires at the wrong
                    // moment — or, if the rate is far off, never at all. The wind path
                    // advances `p` on the WORLD_CLOCK-scaled `t`, so its step is
                    // `speed * dt`; the swell path advances on the train's own frequency
                    // against Swell's clock, which runs in real seconds, so its step is
                    // `(ω/2π) * dt`. Two clocks, and each window has to use its own.
                    let p, step;
                    if (sea.cycle === null) {
                        p = (t * speed + r1 + c * 0.5) % 1;
                        step = speed * dt;
                    } else {
                        p = (sea.cycle + SURF_BREAK + (r1 - 0.5) * SURF_PHASE_JITTER + c * 0.5) % 1;
                        if (p < 0) p += 1;
                        step = sea.rate * dt;
                    }
                    // Did this crest cross the break within the last frame?
                    if (p < SURF_BREAK || p >= SURF_BREAK + step) continue;
                    // Foam lands ON the beach, scattered along the crest it came off.
                    const along = 0.2 + fxRand() * 0.6;
                    const bx = a.x + ex * (u0 + along / n) + nx * sea.reach * 0.12;
                    const by = a.y + ey * (u0 + along / n) + ny * sea.reach * 0.12;
                    // ⚠️ THE FOAM IS WHAT MAKES THE WATERLINE A BAND. A crest is only bright
                    // at the instant it breaks, and with the breaks phase-locked to a real
                    // train only a stretch or two along a shore is at that instant at any
                    // one time — which is correct, and on its own it left the beach nearly
                    // bare between waves. What fills it in at a real shore is the white
                    // water the last wave left, so a swell leaves several times what chop
                    // does, and leaves it bigger.
                    const blobs = sea.foam + (power > 0.6 ? 1 : 0);
                    for (let q = 0; q < blobs; q++) {
                        const sp = (fxRand() - 0.5) * sea.step * 0.5;
                        createParticle(bx + (ex / len) * sp, by + (ey / len) * sp, 'wake',
                                       { scale: (0.8 + fxRand() * 1.5 * power) * sea.foamScale });
                        budget--;
                    }
                }
            }
        }
    }
}

function drawSurf(ctx) {
    // Default ON: a saved settings blob from before this existed has no `surf` key, and
    // testing it truthily made the layer silently absent for every existing player.
    if (!state.course.islands || settings.surf === false) return;
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 120;
    const viewR2 = viewR * viewR;
    const t = state.time;

    ctx.save();
    ctx.lineCap = 'round';
    for (const isl of state.course.islands) {
        // NOT ON DRIFTING BERGS. A floe is a small object adrift on the water, not a coast:
        // surf round every one of Glacier Sound's 112 floes is fussy detail that fights the
        // fleet for attention, and they move, so it never settles. Fixed ice IS a shoreline
        // and keeps its breakers.
        //
        // ⚠️ REEFS DO BREAK, and they are the one awash-adjacent thing that should. The
        // exclusion below is `awash`, not `reef`: a sandbar is skipped because drawing surf
        // round it draws in the coastline the whole feature exists NOT to have (see the note
        // in updateSurfFoam). A coral reef is the opposite case on both counts — it is a
        // WALL, so a line that says "you cannot cross here" is the honest picture rather
        // than a lie, and it is physically where an ocean swell trips and breaks. The white
        // line on the weather side of the reef is the defining image of an atoll in the
        // trades, and `face` below already restricts it to the arc that meets the seas, so
        // the lagoon side stays glassy — which is the contrast the venue is about.
        //
        // The FOAM stays off them (updateSurfFoam still excludes reefs): foam is spawned to
        // run up a beach and die at a waterline, and a reef has none. Crests, not litter.
        if (isl.hidden || isl.isFloe || isl.awash || !isl.vertices || isl.vertices.length < 3) continue;
        const dxi = isl.x - camX, dyi = isl.y - camY;
        if (dxi * dxi + dyi * dyi > (viewR + isl.radius) ** 2) continue;
        const sgn = surfOutwardSign(isl);
        const v = isl.vertices;
        const dry = surfDryEdges(isl);
        const focus = surfFocus(isl);

        for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
            if (dry[i]) continue;                        // this edge faces ground, not sea
            const a = v[j], b = v[i];
            const ex = b.x - a.x, ey = b.y - a.y;
            const len = Math.hypot(ex, ey);
            if (len < 4) continue;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            if ((mx - camX) ** 2 + (my - camY) ** 2 > viewR2) continue;

            // Outward normal of this edge.
            const nx = (ey / len) * sgn, ny = (-ex / len) * sgn;
            // The mean field on a wind venue, the swell train on a swell one — one call, so
            // this pass and updateSurf cannot disagree. (Deliberately not getWindAt: surf is
            // a large-scale feature and this runs per edge, so the puff loop and the lee
            // recursion are not worth it here.)
            const sea = surfSeaAt(mx, my);
            if (!sea) continue;
            // Facing the seas means the outward normal opposes their travel.
            const face = -(nx * sea.tx + ny * sea.ty);
            if (face <= 0.02 && sea.floor <= 0) continue;

            // Squared, so the exposed shore is unmistakable and the shoulders fade out
            // instead of stopping dead at a corner — then lifted onto the refraction floor,
            // which is 0 on a wind venue and leaves that shape exactly as it was.
            const expo = sea.floor + (1 - sea.floor) * Math.max(0, face) * Math.max(0, face);
            const power = Math.min(1, expo * sea.power * (sea.floor > 0 ? focus[i] : 1));
            // ⚠️ SUBDIVIDED, not one dash per authored edge. Glacier Sound's coast is 88
            // vertices over 13 km — edges average 500 units, so a dash per edge put ONE
            // stroke on screen. Foam breaks at its own scale, not the coastline's.
            //
            // ⚠️ AND THE CRESTS HAVE TO TRAVEL. Foam that only pulses in place reads as a
            // dashed BORDER however irregular you make it — the eye takes regular repetition
            // for a line style. What says "wave" is the motion: a crest forms well offshore
            // and RUNS IN, shoaling as it goes (shorter, wider, brighter) until it breaks on
            // the beach and is gone. That is the standard top-down treatment — distance from
            // shore drives the shape, and a direction vector animates it.
            //
            // Each stretch runs its own train of crests, offset by a position hash so
            // neighbours never break in step. The hash is stable, so foam does not crawl,
            // and it never touches an RNG stream.
            const hash = (u, w2) => {
                const h = Math.sin(u * 12.9898 + w2 * 78.233) * 43758.5453;
                return h - Math.floor(h);
            };
            const n = Math.max(1, Math.round(len / sea.step));
            for (let k = 0; k < n; k++) {
                const u0 = k / n;
                const cx0 = a.x + ex * u0, cy0 = a.y + ey * u0;
                const r1 = hash(cx0, cy0), r2 = hash(cy0, cx0);
                // Bare stretches between the breaks. Without them the coast is a continuous
                // train of crests, which is the dashed-border read again at a larger size.
                // A real swell leaves far fewer of them than chop does — see `gap`.
                if (r2 < sea.gap) continue;

                // TWO crests in the water at once on a wind venue, half a cycle apart, so a
                // set is arriving while the last one is still washing up. ONE on a swell
                // venue: the cycle is a real wavelength there, and a second crest inside it
                // would break the beach at twice the swell's frequency.
                for (let c = 0; c < sea.crests; c++) {
                    // p: 0 just formed, well offshore — 1 broken on the beach.
                    //
                    // ⚠️ FAST. A crest crossing its run-in in three or four seconds does not
                    // read as a wave — it reads as a slowly brightening mark. Real surf
                    // arrives; the whole point of the motion is that you see it coming AND
                    // it gets there. At ~1 cycle a second a crest covers its stand-off in
                    // about the time it takes to say so, which is what sells it.
                    const speed = 0.85 + power * 0.75;
                    // ⚠️ ON A SWELL VENUE THE CLOCK IS THE WAVE, and the position hash is
                    // nearly gone with it. `r1` exists to stop a wind coast reading as one
                    // marching border, and for chop that is right — but a real swell IS in
                    // step, everywhere at once, and scattering the phase throws away the
                    // whole effect: the set arriving together, and the break running along
                    // a beach it meets at an angle because the crest gets there sooner at
                    // one end. Only enough jitter survives (SURF_PHASE_JITTER) to keep
                    // neighbours from looking machined.
                    let p = sea.cycle === null
                        ? (t * speed + r1 + c * 0.5) % 1
                        : (sea.cycle + SURF_BREAK + (r1 - 0.5) * SURF_PHASE_JITTER + c * 0.5) % 1;
                    if (p < 0) p += 1;
                    // ⚠️ POSITION AND SHAPE ARE SEPARATE THINGS, and conflating them made a
                    // crest FADE IN WHERE IT SITS. Stand-off was `1 - p²`, which barely moves
                    // for the first third of the run — so the wave brightened from nothing
                    // while parked offshore and only then set off. A wave is moving before
                    // you can see it; it should already be running in as it appears.
                    //
                    // So travel is very nearly linear (a touch of ease near the beach, where a
                    // real crest does slow as it shoals), and `shoal` — which drives how
                    // gathered and steep it LOOKS — keeps its own curve.
                    const travel = Math.pow(1 - p, 1.15);
                    const shoal = p * p;
                    // ⚠️ A WEAK WAVE BREAKS CLOSER IN. Holding the stand-off at full reach
                    // regardless of power put a lone pale crest 90 units off the LEE shore,
                    // where nothing else was happening — a mark floating in open water with
                    // no shore behaviour around it to explain it. Smaller waves genuinely
                    // trip in shallower water, so the sheltered side's surf hugs the beach.
                    // `standoffPow` is 0 on a wind venue, where this is exactly reach.
                    const stand = 1 - sea.standoffPow + sea.standoffPow * power;
                    const off = sea.reach * stand * travel * (0.9 + 0.5 * r2);
                    // ⚠️ THE ARC OF A WAVE: appear, BUILD, crash, gone. A symmetric hump
                    // peaks halfway through the run-in and is already fading by the time it
                    // reaches the beach — which is backwards, and reads as a mark brightening
                    // and dimming rather than as water arriving. A crest is faintest when it
                    // forms offshore, strongest at the instant it breaks, and then simply is
                    // not there any more.
                    const life = p < SURF_BREAK
                        ? Math.pow(p / SURF_BREAK, sea.build)            // building as it comes in
                        : Math.pow(1 - (p - SURF_BREAK) / (1 - SURF_BREAK), 1.6);   // crashed, gone
                    const alpha = Math.min(sea.maxAlpha, power * life * 0.95);
                    if (alpha <= 0.02) continue;

                    // Long, with a clear gap to its neighbour: 55-85% of its stretch, so the
                    // eye reads a wave with water either side rather than a dotted line. It
                    // still gathers as it shoals — shorter and wider, the way a crest steepens.
                    const span = (0.55 + 0.30 * r1 - 0.10 * shoal) / n;
                    const s0 = u0, s1 = Math.min(1, u0 + span);
                    const p0x = a.x + ex * s0 + nx * off, p0y = a.y + ey * s0 + ny * off;
                    const p1x = a.x + ex * s1 + nx * off, p1y = a.y + ey * s1 + ny * off;
                    // ── SHAPED LIKE THE WIND CRESTS ─────────────────────────────
                    // Same vocabulary as drawWindWaves: a STITCHED polyline — jittered points
                    // drawn as separate segments with some skipped — rather than one smooth
                    // curve. A single clean arc is what kept reading as a drawn LINE; a
                    // broken, slightly ragged crest reads as water. Plus the faint echo
                    // trailing behind that the wind waves use to give a crest thickness
                    // without widening the stroke.
                    //
                    // Bowed seaward across the crest, jittered from a position hash so the
                    // raggedness is stable rather than boiling frame to frame.
                    const bow = SURF_REACH * 0.35 * (0.4 + 0.6 * r1) * (1 - shoal * 0.5);
                    // Nodes scale with the crest so a long one is not drawn from the same
                    // five points as a short one. Pinned at 5 below the length any wind
                    // crest reaches, which is what keeps the other nine venues identical.
                    const SEG = Math.max(5, Math.round(Math.hypot(p1x - p0x, p1y - p0y) / 26));
                    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                    const lw = (1.4 + power * 3.2 * (0.4 + shoal)) * sea.weight;
                    ctx.lineWidth = lw;
                    let px = 0, py = 0;
                    for (let q = 0; q <= SEG; q++) {
                        const f = q / SEG;
                        const jit = (hash(cx0 + q * 7.7, cy0 - q * 3.1) - 0.5) * SURF_REACH * 0.18;
                        const arch = Math.sin(f * Math.PI) * bow;
                        const qx = p0x + (p1x - p0x) * f + nx * (arch + jit);
                        const qy = p0y + (p1y - p0y) * f + ny * (arch + jit);
                        if (q > 0 && hash(cx0 + q * 2.3, cy0 + q * 5.9) > sea.skip) {
                            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
                        }
                        px = qx; py = qy;
                    }
                    if (r1 > 0.45 && alpha > 0.12) {
                        const eo = SURF_REACH * 0.16 * (0.5 + shoal);
                        ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.45).toFixed(3)})`;
                        ctx.lineWidth = lw * 0.8;
                        ctx.beginPath();
                        ctx.moveTo(p0x + (p1x - p0x) * 0.2 + nx * eo, p0y + (p1y - p0y) * 0.2 + ny * eo);
                        ctx.lineTo(p0x + (p1x - p0x) * 0.8 + nx * eo, p0y + (p1y - p0y) * 0.8 + ny * eo);
                        ctx.stroke();
                    }
                }
            }
        }
    }
    ctx.restore();
}

