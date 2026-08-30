// regatta/js/render/effects.js — ambient effects: the particle store
// (createParticle/updateParticles — sim-side, called from update()), boat
// wakes, night water/bioluminescence/jellyfish (⚠ updateJellyDrifts is a
// wall-clock integrator called from draw()), drawWater delegation, and the
// snow overlay. Classic script; global scope. Extracted verbatim from
// script.js (refactor 2026-08-24).
function createParticle(x, y, type, props = {}) { state.particles.push({ x, y, type, life: 1.0, ...props }); }

function updateParticles(dt) {
    const timeScale = dt * 60;
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        if (p.vx) p.x += p.vx * timeScale;
        if (p.vy) p.y += p.vy * timeScale;
        let decay = 0.0025;
        if (p.type === 'wake') {
            decay = 0.009;
            const s = p.scale || 1.0;
            p.scaleVal = s + (1-p.life)*1.5;
            p.alpha = p.life*0.4;
        }
        else if (p.type === 'wake-wave') {
            decay = 0.0015;
            const s = p.scale || 1.0;
            p.scaleVal = (0.5 + (1-p.life)*3) * s;
            p.alpha = p.life*0.25;
        }
        else if (p.type === 'wind') {
             decay = 1 / (WIND_LIFE * 60);   // life 1 -> 0 over WIND_LIFE seconds
             const local = getWindAt(p.x, p.y);
             // THE GAME'S ONE CONVERSION: units/second = knots * 15 (a knot is 0.25
             // units/frame at 60fps, which is what boat.speed and the current both use).
             // This used to be `speed / 10` per frame — units/s = knots * 6, i.e. 0.40x
             // the true wind. The puff cells travel at 0.58-0.86x, so streaks visibly
             // lagged the cat's-paws they are supposed to be the texture of.
             const v = local.speed * 15 * p.drift * dt;
             p.x -= Math.sin(local.direction) * v;
             p.y += Math.cos(local.direction) * v;
             p.spd = local.speed;

             // THE COMET'S TAIL IS THE PARCEL'S OWN TRACK. Nothing is inferred: the streak
             // curves where the breeze bends, stretches where it blows harder and shortens
             // where it dies, because that is literally where this air has been. It cannot
             // point the wrong way, and its LENGTH reports wind speed for free — a fixed
             // window of time times the distance covered in it.
             p.trailT += dt;
             if (p.trailT >= _streakRef.tailStep) {
                 // Carry the overshoot rather than zeroing it, so the window really is
                 // the tail step and not "the next frame after it" — otherwise every tail
                 // is a frame-time longer than the speed it claims to report.
                 p.trailT -= _streakRef.tailStep;
                 p.trail.unshift({ x: p.x, y: p.y });
                 // ONE SPARE sample beyond the drawn window. The tail end is interpolated
                 // between the last two (see streakSpine), so dropping the oldest never
                 // moves anything that is on screen.
                 if (p.trail.length > WIND_TAIL_PTS + 1) p.trail.pop();
             }

             // ── REACHING THE BEACH ──────────────────────────────────────────────
             // A streak that drifts onto a berg or out of the arena stops being a mark on
             // water. Killing it outright made it BLINK OUT at full strength against the
             // shoreline — the eye is drawn straight to a disappearance, so a cull meant to
             // be invisible was the most conspicuous thing the layer did.
             //
             // So it fades, and it starts fading BEFORE it lands: the test point is thrown
             // ahead by exactly the distance this streak covers while it fades. Streaks
             // therefore die out approaching the shore and reach the sand already gone —
             // which is also what real streaks do in the lee of land.
             //
             // Rechecked on a stagger rather than every frame: this is a point-in-polygon
             // against every land shape, and it does not need 60Hz.
             p.waterT -= dt;
             if (p.waterT <= 0) {
                 p.waterT = WIND_WATER_RECHECK;
                 const look = local.speed * 15 * p.drift * WIND_BEACH_FADE;
                 const lx = p.x - Math.sin(local.direction) * look;
                 const ly = p.y + Math.cos(local.direction) * look;
                 if (!Arena.contains(state.course.boundary, lx, ly, 0) || !inMaskWater(lx, ly)) p.beached = true;
             }
             if (p.beached) {
                 p.beach -= dt / WIND_BEACH_FADE;
                 if (p.beach <= 0) p.life = 0;
             }
        } else if (p.type === 'current' || p.type === 'mark-wake') {
             const c = getCurrentAt(p.x, p.y);
             const speed = c ? c.speed : 0;
             const dir = c ? c.direction : 0;
             // Move with current (Game Units = Knots / 4)
             const moveSpeed = (speed / 4.0) * timeScale;
             p.x += Math.sin(dir) * moveSpeed;
             p.y -= Math.cos(dir) * moveSpeed;
             if (p.type === 'current') {
                 decay = 1 / (CUR_LIFE * 60);   // life 1 -> 0 over CUR_LIFE seconds
                 p.spd = speed;
                 // THE STREAMLINE IS THE PARCEL'S OWN TRACK, exactly as a comet's tail is.
                 // Nothing is inferred from a single sample, so the mark curves through a
                 // bend because the water did, and it is longer in the fast lane because
                 // that water covered more ground in the same seconds.
                 p.trailT += dt;
                 if (p.trailT >= CUR_TAIL_STEP) {
                     // Overshoot carried, not zeroed — otherwise every streak is a frame
                     // longer than the speed it is claiming to report.
                     p.trailT -= CUR_TAIL_STEP;
                     p.trail.unshift({ x: p.x, y: p.y });
                     // One spare beyond the drawn window: the tail end is interpolated
                     // between the last two, so retiring the oldest moves nothing on screen.
                     if (p.trail.length > CUR_TAIL_PTS + 1) p.trail.pop();
                 }
             }
        }

        p.life -= decay * timeScale;
        if (p.life <= 0) { state.particles[i] = state.particles[state.particles.length-1]; state.particles.pop(); }
    }
}

// Boat wakes: tapered two-tone ribbons along each boat's recent stern track —
// a soft outer band that widens and fades as it ages (wake spreading) with a
// brighter narrow core, plus two short V quarter-wave strokes at the stern.
// Clean filled shapes, no blur: fits the art style and replaces the old
// long-lived particle streams.
function drawWakes(ctx) {
    const camX = state.camera.x, camY = state.camera.y;
    const viewR2 = (Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 200) ** 2;
    const MAX_AGE = 2.25;

    ctx.save();
    for (const boat of state.boats) {
        const trail = boat.wakeTrail;
        if (!trail || trail.length < 2) continue;
        // A fading boat's wake fades with it (finish, and the school's section ends).
        const fade = boat.opacity === undefined ? 1 : boat.opacity;
        if (fade <= 0.01) continue;
        const dxv = boat.x - camX, dyv = boat.y - camY;
        if (dxv * dxv + dyv * dyv > viewR2) continue;

        // Per-segment quads so alpha/width can vary along the ribbon
        for (let pass = 0; pass < 2; pass++) {
            const wScale = pass === 0 ? 1 : 0.42;      // outer band, then bright core
            const aScale = pass === 0 ? 0.35 : 0.50;
            for (let i = 0; i < trail.length - 1; i++) {
                const a = trail[i], b = trail[i + 1];
                const segDX = b.x - a.x, segDY = b.y - a.y;
                const len = Math.sqrt(segDX * segDX + segDY * segDY);
                if (len < 0.5) continue;
                const nx = -segDY / len, ny = segDX / len;
                const wA = (9 + a.age * 6) * wScale * a.str;
                const wB = (9 + b.age * 6) * wScale * b.str;
                const alpha = Math.pow(1 - a.age / MAX_AGE, 1.25) * aScale * a.str * fade;
                if (alpha <= 0.01) continue;
                ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(a.x + nx * wA, a.y + ny * wA);
                ctx.lineTo(b.x + nx * wB, b.y + ny * wB);
                ctx.lineTo(b.x - nx * wB, b.y - ny * wB);
                ctx.lineTo(a.x - nx * wA, a.y - ny * wA);
                ctx.closePath();
                ctx.fill();
            }
        }

    }
    ctx.restore();
}

// Drawing (Refactored for Boat object)
const NIGHT_TINT = '#4a5aa0';        // what the ambient multiplies TOWARD: cool moonlight,
                                     // not grey — a neutral wash reads as underexposure
const BIO_COLOR = '#2b9dff';         // ELECTRIC BLUE, off the reference photographs and the
                                     // venue card. An early cut was a pale cyan (#8ffbff)
                                     // and it read as mint: real dinoflagellate bloom is a
                                     // saturated blue with only its hottest cores going pale.
const BIO_CORE = '#cfe9ff';          // the pale blue-white centre, never pure white

// ── HOW LONG A BIOLUMINESCENT TRAIL LIVES ───────────────────────────────────
// Researched rather than picked, and the research changed the shape of the effect.
//
// A dinoflagellate flash is SHORT: rise 10-50 ms, decay ~200 ms, the whole thing about a
// tenth of a second, and a spent cell does not immediately re-fire. So the light in a wake
// is NOT one glow persisting — it is a moving front of fresh cells being triggered as the
// boat reaches them. What you see behind a hull is therefore a map of where the water is
// STILL shearing hard enough to fire cells, and the trail ends where that shear drops below
// threshold (~0.04-0.32 N/m^2 by species), not where the light "fades out".
//
// That gives the effect its two-part shape, which is what is drawn: a short BRIGHT stretch
// of churn right behind the transom where shear is well over threshold, and a long dimmer
// band behind it where the disturbed water is still just tripping cells.
//
// 9 s is a GAME number on top of that physics. At racing speed (~7 kt = 105 u/s) it draws
// about 950 units, ~17 boat lengths — long enough to read the fleet's recent history across
// a screen, which is the tactical gift of a night venue, and short enough not to smear the
// whole strait. The foam ribbon stays 2.25 s; these are different quantities, and only the
// light outlives the foam.
const BIO_TRAIL_LIFE = 9;
const BIO_CHURN_LIFE = 1.6;          // the bright, over-threshold stretch at the stern

// ⚠️ COOL WHITE, NOT CREAM. This was warm (#f6edd2), taken off the venue card, on the
// theory that a blue-white path disappears into blue water. The art references say
// otherwise: every one of them puts a near-white, faintly blue column on blue water and it
// reads perfectly, because what separates it is BRIGHTNESS, not hue. Warm cream on this
// palette read as lamplight rather than moonlight.
const MOON_COLOR = '#e6f0ff';

// ⚠️ RADIAL GRADIENTS ARE NOT FREE. The surf is painted as a field of soft blobs stepped
// along the coast, and building a fresh createRadialGradient for each one cost 4.7 ms a
// frame near shore — 28% of a 60 fps budget for one decorative layer. A gradient cannot be
// repositioned, but a SPRITE can: the blob is rendered once into an offscreen canvas and
// then stamped with drawImage, which is a blit rather than a shader setup. Same picture,
// a fraction of the cost, and it scales to whatever radius the surge wants.
const _glowSprites = {};
function glowSprite(rgb) {
    let s = _glowSprites[rgb];
    if (s) return s;
    const R = 64;
    s = document.createElement('canvas');
    s.width = s.height = R * 2;
    const g2 = s.getContext('2d');
    const grad = g2.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.45, `rgba(${rgb},0.45)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g2.fillStyle = grad;
    g2.fillRect(0, 0, R * 2, R * 2);
    _glowSprites[rgb] = s;
    return s;
}

function nightAmt() {
    const n = window.WATER_CONFIG && window.WATER_CONFIG.night;
    return (typeof n === 'number' && n > 0) ? Math.min(1, n) : 0;
}
// Where the moon stands, as a compass bearing the glitter path runs along. Authored beside
// `night`; the default puts it off the starboard bow of a boat beating north.
function moonBearing() {
    const m = window.WATER_CONFIG && window.WATER_CONFIG.moonDir;
    return ((typeof m === 'number') ? m : 25) * Math.PI / 180;
}

// MOONLIGHT BELONGS TO THE WATER, so it is drawn with the surface — before the wakes, the
// wind waves and the fleet, and BEFORE the ambient wash, which then knocks it back like
// everything else. It lived in the emissive pass at first and that was wrong twice over: it
// floated on top of the boats, and it kept full brightness while the world around it dimmed,
// which is exactly what made it feel pasted on rather than lying on the sea.
//
// No water test is needed here: the land is drawn later and simply covers it.
function drawNightWater(ctx) {
    const n = nightAmt();
    if (n <= 0) return;
    const cam = state.camera, t = state.time;
    const halfW = ctx.canvas.width * 0.5 + 120, halfH = ctx.canvas.height * 0.5 + 120;
    const inView = (x, y) => Math.abs(x - cam.x) < halfW && Math.abs(y - cam.y) < halfH;
    const mb = moonBearing();
    const mx = Math.sin(mb), my = -Math.cos(mb);
    const px = -my, py = mx;
    const reach = Math.max(halfW, halfH) * 1.5;
    const band = 165;
    const mAng = Math.atan2(my, mx);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cam.x, cam.y);
    ctx.rotate(mAng);
    // ⚠️ THE WATER IN THE PATH IS LIT, and that is what a chain of dashes alone could not
    // say. An early attempt at a soft band read as FOG and was cut — but that one lived in
    // the EMISSIVE pass at full brightness, floating above the scene. Down here it is part
    // of the surface and the ambient wash knocks it back with the rest of the water, so it
    // reads as sea catching the moon rather than haze lying on it. Kept faint: the glints
    // are still the effect, this only gives them water to sit on.
    // BAKED: a gradient fillRect under rotation + 'lighter' over ~0.9M px was ~2 ms a
    // frame for a strip that only changes with the night level or a resize. Rasterized
    // once at quarter scale, blitted — the gradient is smooth, so the upscale is free.
    if (!window._moonBand || window._moonBand.n !== n || window._moonBand.reach !== reach) {
        const bs = 0.25;
        const c = document.createElement('canvas');
        c.width = Math.max(2, Math.ceil(reach * 2 * bs));
        c.height = Math.max(2, Math.ceil(band * 2 * bs));
        const bg = c.getContext('2d');
        const g2 = bg.createLinearGradient(0, 0, 0, c.height);
        g2.addColorStop(0, 'rgba(214,230,255,0)');
        g2.addColorStop(0.5, `rgba(214,230,255,${(0.15 * n).toFixed(3)})`);
        g2.addColorStop(1, 'rgba(214,230,255,0)');
        bg.fillStyle = g2;
        bg.fillRect(0, 0, c.width, c.height);
        window._moonBand = { cv: c, n, reach };
    }
    ctx.drawImage(window._moonBand.cv, -reach, -band, reach * 2, band * 2);

    // The flash, as a BAKED SPRITE. Each flash was a beginPath/ellipse/fill — path setup
    // and rasterization for ~300 tiny shapes a frame, ~3 ms of Glowtide's budget. One
    // baked lozenge drawn at (wide, len) is the same picture (the sprite's antialiased
    // edge downscales into the same soft rim) for a fraction of the cost.
    if (!window._moonLozenge) {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 48;
        const lg = c.getContext('2d');
        lg.fillStyle = MOON_COLOR;
        lg.beginPath();
        lg.ellipse(8, 24, 8, 24, 0, 0, Math.PI * 2);
        lg.fill();
        window._moonLozenge = c;
    }
    const loz = window._moonLozenge;
    // One matrix per flash instead of save/translate/rotate/restore — four state-stack
    // ops on ~300 draws was a measurable slice of the loop itself.
    const M0 = ctx.getTransform();
    // ⚠️ DASHES ACROSS THE PATH, IN A NARROW COLUMN — taken off the venue card rather than
    // invented. Two earlier cuts got this wrong in instructive ways. A soft gradient band
    // read as FOG, because a moon path has no haze in it. Then streaks elongated TOWARD the
    // moon read as RAIN, because Glowtide already draws pale diagonal wind streaks and a
    // second diagonal field just joined them.
    for (let i = 0; i < 700; i++) {
        const u = ((i * 97.13) % 1000) / 1000;
        const vr = ((i * 43.71) % 1000) / 1000 - 0.5;
        // ⚠️ NORMALISE THE CURVE, or the crowding silently narrows the path: with vr in
        // [-0.5, 0.5], `vr*|vr|*2*band` peaks at a QUARTER of band, so an earlier cut spread
        // its flashes over a 210u thread nobody could see.
        const across = (vr < 0 ? -1 : 1) * (vr * vr * 4) * band;
        const drift = (t * (9 + (i % 11) * 2.4)) % (reach * 2);
        const along = -reach + ((u * reach * 2) + drift) % (reach * 2);
        const x = cam.x + mx * along + px * across;
        const y = cam.y + my * along + py * across;
        if (!inView(x, y)) continue;
        const s0 = Math.sin(t * (3.1 + (i % 7) * 0.9) + i * 2.399) * 0.5 + 0.5;
        const tw = 0.4 + 0.6 * s0 * s0;
        // Cubed falloff: the column has a defined, dense spine and thins out fast, which
        // is what makes it a reflection rather than a scatter. PLAYABILITY LIVES HERE —
        // peak alpha stays moderate on purpose and the read comes from density, so the
        // path never competes with a hull, a mark or a nav light for attention.
        // Squared, not cubed: cubing collapsed the column to a hair-thin spine that barely
        // read at all. Squared keeps a defined dense centre with the edges thinning out —
        // a reflection rather than a scatter — while still leaving the path present.
        const fade = 1 - Math.min(1, Math.abs(across) / band);
        const a = 0.92 * n * tw * fade * fade;
        if (a < 0.03) continue;
        // ⚠️ VARY EVERYTHING, OR IT IS A LADDER. Bars of one width and near-one length,
        // evenly spaced down a straight column, read as rungs — a drawn object rather than
        // light on water. Two independent hashes per flash spread the length over an order
        // of magnitude, thicken some and thin others, and tilt each one off square; the
        // column survives because the POSITIONS still crowd the axis, but nothing in it
        // repeats.
        const h1 = ((i * 0.618034) % 1);
        const h2 = ((i * 0.381966) % 1);
        // RIPPLE LOZENGES, DENSELY STACKED — the shape the references actually show. Hard
        // rectangles read as debris; an ellipse lying across the path reads as a wave face
        // catching light. Length varies over an order of magnitude so nothing repeats.
        const len = 5 + tw * (6 + h1 * h1 * 52);
        const wide = 1.6 + h2 * 2.4;
        const tilt = (h1 - 0.5) * 0.42;
        ctx.globalAlpha = Math.min(1, a);
        const cT = Math.cos(tilt), sT = Math.sin(tilt);
        ctx.setTransform(
            M0.a * cT + M0.c * sT, M0.b * cT + M0.d * sT,
            -M0.a * sT + M0.c * cT, -M0.b * sT + M0.d * cT,
            M0.a * along + M0.c * across + M0.e, M0.b * along + M0.d * across + M0.f);
        ctx.drawImage(loz, -wide * 0.5, -len * 0.5, wide, len);
    }
    ctx.setTransform(M0);
    ctx.restore();
}

// ── JELLYFISH DRIFTS ────────────────────────────────────────────────────────
// One placement is a DRIFT of several animals. The members are DERIVED from the placement
// rather than stored: a hash of the prop's own position seeds count, offsets, sizes, tints
// and phases, so the same bloom comes back identical every session and the document stays
// one line per drift instead of one line per jellyfish.
//
// Two passes, for the same reason everything else here has two. The BELLS are physical —
// drawn on the seabed plane with the water over them, and dimmed by the ambient wash like
// any other object. The LIGHT is emissive and goes on after the wash, along with the
// trailing arms, which are drawn rather than baked so they can stream with the current.
const JELLY_TINTS = ['#5aa9ff', '#a879ff', '#ff9247', '#ff62a8'];   // blue, purple, orange, pink
const JELLY_PERIOD = 10.5;        // seconds for a full rise and fall
const JELLY_SPREAD = 190;         // how far members scatter from the placement

function jellyHash(a, b) {
    const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return h - Math.floor(h);
}
function jellyMembers(p) {
    if (p._jelly) return p._jelly;
    const n = 3 + Math.floor(jellyHash(p.x, p.y) * 5);        // 3..7 animals
    const out = [];
    for (let i = 0; i < n; i++) {
        const h1 = jellyHash(p.x + i * 13.7, p.y - i * 7.3);
        const h2 = jellyHash(p.y + i * 29.1, p.x + i * 5.9);
        const h3 = jellyHash(p.x * 0.7 + i * 3.1, p.y * 1.3 - i * 11.7);
        const ang = h1 * Math.PI * 2, rad = (0.2 + 0.8 * h2) * JELLY_SPREAD;
        out.push({
            ox: Math.cos(ang) * rad, oy: Math.sin(ang) * rad,
            // Mostly the big moon jelly, a few small blooms filling in — a real
            // aggregation is mixed, and it buys silhouette variety for nothing.
            small: h3 > 0.62,
            scale: 0.72 + h1 * 0.55,
            tint: JELLY_TINTS[Math.floor(h2 * 997) % JELLY_TINTS.length],
            phase: h3 * Math.PI * 2,
            spin: (h1 - 0.5) * 1.2,
            // A moon jelly pulses roughly every couple of seconds; spread it so a drift
            // never beats in unison, which is the tell of a repeated sprite.
            pulse: 1.7 + h2 * 1.3,
            beat: h1,
            head: h1 * Math.PI * 2,     // which way it is swimming
            v: 0, sx: 0, sy: 0, _sq: 0, // speed and accumulated swim offset
            // ⚠️ CALIBRATED, NOT GUESSED. The first figure swam 12 u/s — 26x a real Aurelia's
            // few cm/s, faster than a drifting boat, and it emptied the bloom across the map
            // in a minute. This lands near 1.5 u/s average: visible movement over a race
            // (a few boat lengths) with the drift still a drift at the finish.
            push: 4.5 + h2 * 3,         // thrust per unit of squeeze
        });
    }
    p._jelly = out;
    return out;
}
// 0 = deep and dim, 1 = just under the surface. Drives scale, alpha AND glow together,
// because depth in water changes all three at once — a jelly does not merely get smaller.
function jellyDepth(m, t) {
    return 0.5 + 0.5 * Math.sin((t / JELLY_PERIOD) * Math.PI * 2 + m.phase);
}

// ── HOW A JELLYFISH ACTUALLY MOVES ──────────────────────────────────────────
// Researched, and the research threw away the first two attempts.
//
// It is BURST AND COAST, in three phases, not a bell that breathes:
//   CONTRACT  the power stroke. The bell closes fast, ejects a vortex ring, and the animal
//             ACCELERATES. This is the short phase.
//   RELAX     the recovery stroke, and it is PASSIVE — elastic energy stored in the bell
//             during the squeeze reopens it. Peak drag lives here, so the animal is
//             DECELERATING even though the bell is still moving.
//   COAST     the interpulse. Nothing moves and it still travels: 32% of the distance
//             covered per pulse happens here, after all kinematic motion has ceased.
//
// That third phase is what the earlier versions were missing entirely. A waveform that
// relaxes straight into the next contraction has no rest in it, and a creature with no rest
// in it reads as a pumping machine. The pause is the animal.
//
// The bell also moves less than you would guess: exumbrellar area grows about 1.3x from full
// contraction, which is only ~14% on the DIAMETER — the earlier 20% was a squeeze-box.
const JELLY_CONTRACT = 0.22;      // fraction of the cycle in the power stroke
const JELLY_RELAX = 0.38;         // then the passive reopening
                                  // and the rest is coast: bell still, animal still gliding
const JELLY_SQUEEZE = 0.14;       // diameter change, from the 1.3x area figure
const JELLY_ARM_LAG = 0.16;       // seconds the arms answer the bell late

// Where in its own cycle a member is, 0..1.
function jellyCycle(m, t) {
    let u = ((t / m.pulse) + m.beat) % 1;
    return u < 0 ? u + 1 : u;
}
// Squeeze 0..1 (1 = fully contracted), with a real flat COAST at the end of the cycle.
function jellySqueezeAt(m, t) {
    const u = jellyCycle(m, t);
    if (u < JELLY_CONTRACT) return Math.sin((u / JELLY_CONTRACT) * Math.PI / 2);
    if (u < JELLY_CONTRACT + JELLY_RELAX)
        return Math.cos(((u - JELLY_CONTRACT) / JELLY_RELAX) * Math.PI / 2);
    return 0;                                             // coasting, bell fully open
}
function jellySqueeze(m, t) {
    return { sq: jellySqueezeAt(m, t), lag: jellySqueezeAt(m, t - JELLY_ARM_LAG) };
}

// 0 = deep and dim, 1 = just under the surface. Drives scale, alpha AND glow together,
// because depth in water changes all three at once — a jelly does not merely get smaller.
function jellyDepth(m, t) {
    return 0.5 + 0.5 * Math.sin((t / JELLY_PERIOD) * Math.PI * 2 + m.phase);
}

// ── SWIMMING, INTEGRATED ONCE A FRAME ───────────────────────────────────────
// ⚠️ NOT in a draw function. Both passes draw every member, so integrating there would
// advance each animal twice per frame and tie its speed to the frame rate.
//
// A previous version dodged that by making the position two slow sines — bounded, cheap, and
// wrong: it slides continuously, which is the one thing burst-and-coast is not. Real thrust
// integrates fine here because the animals are SLOW. An Aurelia does a few cm/s; over a
// three-minute race that is metres, tens of units, so a drift stays a drift instead of
// swimming off the map. The worry that sent me to sines was unfounded.
// Clocked like updateDriftingProps, its neighbour in the same call: sim dt from
// update() (leak fixes 2026-08-24 — this ran from draw() on performance.now(),
// which ignored pause/gameSpeed and never ran headless). RNG-free by design.
function updateJellyDrifts(dt) {
    if (!(dt > 0)) return;
    const props = state.course && state.course.props;
    if (!props || !props.length) return;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const t = state.time;
    for (const p of props) {
        const k = reg[p.kind];
        if (!k || k.scatter !== 'jelly') continue;
        for (const m of jellyMembers(p)) {
            // They turn slowly and never hold a straight line for long.
            m.head += (Math.sin(t * 0.19 + m.beat * 6.28) * 0.5 + Math.sin(t * 0.07 + m.phase) * 0.3) * dt;
            const sq = jellySqueezeAt(m, t);
            // THRUST ONLY WHILE CLOSING. The reopening is passive and draggy, so nothing is
            // added there — the glide that follows is the coast, and it is most of the trip.
            const closing = sq > (m._sq || 0);
            if (closing) m.v += (sq - (m._sq || 0)) * m.push;
            m._sq = sq;
            // Drag: gentle, or the coast would not exist. This is the phase that carries a
            // third of the distance.
            m.v *= Math.pow(0.62, dt);
            m.sx += Math.sin(m.head) * m.v * dt;
            m.sy += -Math.cos(m.head) * m.v * dt;
        }
    }
}

// The bells are authored WHITE precisely so they can be coloured here. Same multiply-then-
// destination-in bake `getTintedBoatPart` uses for hulls, cached per sprite and colour, so
// four hues cost four bakes once rather than a composite every frame.
const _jellyTintCache = new Map();
function jellyTinted(img, color) {
    const key = img.src + '|' + color;
    let c = _jellyTintCache.get(key);
    if (c) return c;
    const size = img.naturalWidth;
    if (!size) return null;
    c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = color;
    g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'destination-in';   // multiply paints transparent pixels too
    g.drawImage(img, 0, 0);
    _jellyTintCache.set(key, c);
    return c;
}

function eachJelly(fn) {
    const props = state.course && state.course.props;
    if (!props || !props.length) return;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const t = state.time, cam = state.camera;
    const halfW = canvas.width * 0.5 + 260, halfH = canvas.height * 0.5 + 260;
    for (const p of props) {
        const k = reg[p.kind];
        if (!k || k.scatter !== 'jelly') continue;
        const px = p.x + (p._dx || 0), py = p.y + (p._dy || 0);      // drifted position
        if (Math.abs(px - cam.x) > halfW + JELLY_SPREAD || Math.abs(py - cam.y) > halfH + JELLY_SPREAD) continue;
        for (const m of jellyMembers(p)) {
            const x = px + m.ox + m.sx, y = py + m.oy + m.sy;
            if (Math.abs(x - cam.x) > halfW || Math.abs(y - cam.y) > halfH) continue;
            fn(m, x, y, jellyDepth(m, t), t, jellySqueeze(m, t));
        }
    }
}

// PASS 1 — the bodies, with the water. Called from the seabed plane.
function drawJellyDrifts(ctx) {
    eachJelly((m, x, y, d, t, pz) => {
        const kind = m.small ? 'glowtide-jelly-bloom' : 'glowtide-jelly';
        const s = propSprite(kind);
        if (!s || !s.img.complete || !s.img.naturalWidth) return;
        const img = jellyTinted(s.img, m.tint) || s.img;
        // Nearer the surface is bigger, brighter and sharper; deeper is smaller and fainter,
        // and the bell squeezes about a fifth of its width on every contraction.
        const w = s.world * m.scale * (0.82 + 0.3 * d) * (1 - JELLY_SQUEEZE * pz.sq);
        ctx.save();
        ctx.globalAlpha = 0.30 + 0.45 * d;
        ctx.translate(x, y);
        ctx.rotate(m.spin);
        ctx.drawImage(img, -w / 2, -w / 2, w, w);
        ctx.restore();
    });
}

// PASS 2 — the light and the arms, after the ambient wash so neither is dimmed.
// Everything floating ON the surface, as holes to punch out of what is drawn UNDER it.
//
// ⚠️ WOUND FOR 'nonzero', NOT 'evenodd'. The bio-wake mask gets away with even-odd because
// hulls rarely overlap, but a boat needs TWO shapes here — the waterline hull and a disc for
// the rig, which sweeps well outside it — and under even-odd their overlap would cancel and
// punch a hole in the hole. With every occluder wound opposite to the frame and 'nonzero',
// shapes may overlap as much as they like and still subtract.
function surfaceOccluders(cam, halfW, halfH) {
    const mask = new Path2D();
    mask.rect(cam.x - halfW - 300, cam.y - halfH - 300, (halfW + 300) * 2, (halfH + 300) * 2);
    const near = (x, y, pad) => Math.abs(x - cam.x) < halfW + pad && Math.abs(y - cam.y) < halfH + pad;
    const hole = (x, y, r) => { mask.moveTo(x + r, y); mask.arc(x, y, r, 0, Math.PI * 2, true); };
    for (const b of state.boats) {
        if (b.opacity !== undefined && b.opacity <= 0.1) continue;
        if (!near(b.x, b.y, 90)) continue;
        // The hull, exactly — reversed, so it winds against the frame.
        const poly = getHullPolygon(b);
        mask.moveTo(poly[poly.length - 1].x, poly[poly.length - 1].y);
        for (let k = poly.length - 2; k >= 0; k--) mask.lineTo(poly[k].x, poly[k].y);
        mask.closePath();
        // The RIG. A sail is canvas over the water and hides what is beneath it just as the
        // hull does, but it swings out past the gunwale and is not the hull's shape, so it
        // gets its own disc rather than a bigger hull.
        hole(b.x, b.y, 34);
    }
    const props = state.course && state.course.props;
    if (props) {
        const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        for (const pr of props) {
            const k = reg[pr.kind];
            if (!k || k.plane !== 'surface' || k.scatter) continue;
            const x = pr.x + (pr._dx || 0), y = pr.y + (pr._dy || 0);
            if (!near(x, y, 80)) continue;
            hole(x, y, (k.world || 40) * (pr.scale || 1) * 0.42);
        }
    }
    for (const mk of (state.course.marks || [])) {
        if (!near(mk.x, mk.y, 60)) continue;
        hole(mk.x, mk.y, Math.max(14, (mk.radius || 12) * 1.1));
    }
    return mask;
}

function drawJellyGlow(ctx) {
    const n = nightAmt();
    if (n <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // ⚠️ A JELLY IS UNDER THE WATER, so nothing of it shows through a boat, a sail, a buoy or
    // a mark floating over it. This pass runs after the fleet is drawn, so without the mask
    // an additive bell painted straight over a hull and the animal appeared to be INSIDE the
    // boat. The bodies are fine — they draw on the seabed plane and the fleet covers them —
    // it is only the light that had to be told.
    const _cam = state.camera;
    ctx.clip(surfaceOccluders(_cam, ctx.canvas.width * 0.5 + 120, ctx.canvas.height * 0.5 + 120), 'nonzero');
    eachJelly((m, x, y, d, t, pz) => {
        const kind = m.small ? 'glowtide-jelly-bloom' : 'glowtide-jelly';
        const s = propSprite(kind);
        const world = (s ? s.world : 24) * m.scale;
        const rgb = m.tint;
        // THE HALO. Sized off the bell and the depth together, so a jelly rising toward the
        // surface swells and brightens at once.
        // THE LIGHT ANSWERS THE MUSCLE. A bioluminescent jelly brightens as it contracts,
        // so the halo tightens and flares on the squeeze instead of pulsing independently
        // of the body — which is what ties the glow to the animal rather than laying it on.
        const R = world * (0.55 + 0.42 * d) * (1 - JELLY_SQUEEZE * 0.8 * pz.sq);
        const flare = 1 + 0.5 * pz.sq;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, rgb);
        g.addColorStop(0.4, rgb);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = Math.min(1, (0.07 + 0.24 * d) * flare * n);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fill();
        // ── THE ARMS ────────────────────────────────────────────────────────
        // ⚠️ DRAWN BEFORE THE BELL, so the bell covers their roots and they read as hanging
        // UNDER the animal. On top they looked stuck to its back.
        //
        // ⚠️ AND THEY UNDULATE ALONG THEIR LENGTH. A quadratic curve swinging about its root
        // is a rigid whisker being waved; a real oral arm carries a wave DOWN it, so each
        // arm is walked in segments with a travelling sine whose amplitude grows toward the
        // tip — the root barely moves, the end whips. That, and the lag behind the bell's
        // squeeze, is the whole difference between seaweed and an animal.
        //
        // Trailing downstream is why these are drawn and not baked: a sprite locks one
        // direction (props rotate by a static authored heading) and these have to stream
        // with whatever the tide is doing, which on this venue reverses in the eddies.
        // ⚠️ THEY TRAIL BEHIND THE ANIMAL, NOT DOWN THE TIDE. Earlier they streamed with
        // getCurrentAt, which is wrong for something that DRIFTS: a jelly carried by the
        // stream has no water moving past it, so there is nothing to stream in. What the
        // arms lag behind is the creature's own swimming — so they trail opposite its
        // heading, and stretch with how hard it is going.
        const flow = m.head + Math.PI;
        const pull = Math.min(1, m.v / 6);
        const len = world * (0.62 + 0.5 * d) * (0.8 + 0.45 * pull) * (1 + 0.28 * pz.lag);
        const arms = m.small ? 5 : 4;
        const fx = Math.sin(flow), fy = -Math.cos(flow);          // downstream
        const px = Math.cos(flow), py = Math.sin(flow);           // across the flow
        const SEG = 7;
        ctx.globalAlpha = Math.min(1, (0.07 + 0.20 * d) * n);
        ctx.strokeStyle = rgb;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = m.small ? 1.2 : 1.8;
        for (let a = 0; a < arms; a++) {
            const u = arms > 1 ? (a / (arms - 1) - 0.5) : 0;      // -0.5..0.5 across the bell
            // Roots sit UNDER the bell, well inside its rim.
            const rx = x + px * u * world * 0.2;
            const ry = y + py * u * world * 0.2;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            for (let k = 1; k <= SEG; k++) {
                const f = k / SEG;                                 // 0 at the root, 1 at the tip
                // The wave travels outward; amplitude grows with the cube of the distance
                // along, so the root is nearly still and only the last third really moves.
                const wave = Math.sin(f * 4.2 - t * 3.1 + m.beat * 6.28 + a * 1.5);
                const amp = world * 0.16 * f * f * (0.6 + 0.6 * pz.lag);
                // Arms gather together as the bell fires and spread as it opens.
                const spread = u * (0.5 - 0.28 * pz.lag) * world * 0.5 * f;
                const dx = fx * len * f + px * (spread + wave * amp);
                const dy = fy * len * f + py * (spread + wave * amp);
                ctx.lineTo(rx + dx, ry + dy);
            }
            ctx.stroke();
        }
        // ⚠️ THE BELL IS ALSO A LIGHT, and leaving it out of this pass was the whole reason
        // a drift read as coloured BLOBS. The body alone is dimmed twice — once for being
        // under water on the seabed plane, again by the ambient wash — so all that survived
        // was the halo, and a halo without structure is a firework. Drawing the tinted bell
        // additively here puts the clover and the corona back into the light, which is what
        // makes it a glowing jellyfish rather than a glowing dot.
        const sp = propSprite(kind);
        if (sp && sp.img.complete && sp.img.naturalWidth) {
            const img = jellyTinted(sp.img, rgb) || sp.img;
            const w = world * (0.82 + 0.3 * d) * (1 - JELLY_SQUEEZE * pz.sq);
            ctx.save();
            ctx.globalAlpha = Math.min(1, (0.16 + 0.5 * d) * flare * n);
            ctx.translate(x, y);
            ctx.rotate(m.spin);
            ctx.drawImage(img, -w / 2, -w / 2, w, w);
            ctx.restore();
        }
    });
    ctx.restore();
}

function drawNightWash(ctx) {
    const n = nightAmt();
    if (n <= 0) return;
    const cam = state.camera;
    const r = Math.hypot(ctx.canvas.width, ctx.canvas.height) * 0.5 + 240;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = n;
    ctx.fillStyle = NIGHT_TINT;
    ctx.fillRect(cam.x - r, cam.y - r, r * 2, r * 2);
    ctx.restore();
}

// ⚠️ A BIOLUMINESCENT CREST MUST NOT PAINT ON THE BEACH, and nothing about the draw order
// stops it. The DAYTIME wind waves are safe for free — drawWindWaves runs before
// drawIslandsCached, so the land simply covers whatever crosses it — but this pass lives in
// drawNightGlow, which runs after the islands and after the fleet. Every crest whose centre
// wandered over a shore was being painted straight onto it, so at night the sea appeared to
// break over the middle of the jungle.
//
// ⚠️ IT IS A PER-CREST TEST AND NOT A CLIP, WHICH WAS THE FIRST INSTINCT. This file already
// masks the jelly glow by punching holes in a Path2D and clipping to it, and doing the same
// with the island polygons looks obviously right — until Glowtide, whose `jungle` caps are
// drawn INSIDE their `karst` islands. Overlapping holes defeat both fill rules: `evenodd`
// XORs the cap back into view, and `nonzero` counts the two opposite windings to -1 and does
// the same. Unioning the land first would fix it and costs more than the test it replaces.
//
// THREE KINDS OF SHAPE ARE NOT LAND HERE, and this is why it does not just call pointOnLand:
//   awash   a bar or a painted zone is something you SAIL OVER — it is water, and a crest
//           breaking across a shoal is exactly right
//   reef    a sunken rock is UNDER the surface; the wave passes over the top of it
//   hidden  a collider standing behind something else. compileVenueDoc emits one per hard
//           prop, so counting them would silently kill the crests around all eighteen
//           channel buoys
// pointOnLand excludes only the first, because its own job — deciding whether a tree crown
// can hide a hull — has different answers for the other two.
function crestOnLand(x, y) {
    const islands = (state.course && state.course.islands) || [];
    for (const isl of islands) {
        if (isl.awash || isl.reef || isl.hidden) continue;
        if (!isl.vertices || isl.vertices.length < 3) continue;
        const dx = x - isl.x, dy = y - isl.y;
        if (dx * dx + dy * dy > isl.radius * isl.radius) continue;   // bounding circle first
        if (!pointInVerts(x, y, isl.vertices)) continue;
        let inHole = false;
        for (const h of (isl.holes || [])) {
            if (h && h.length >= 3 && pointInVerts(x, y, h)) { inHole = true; break; }
        }
        if (!inHole) return true;
    }
    return false;
}

function drawNightGlow(ctx) {
    const n = nightAmt();
    if (n <= 0) return;
    const cam = state.camera, t = state.time;
    const halfW = ctx.canvas.width * 0.5 + 120, halfH = ctx.canvas.height * 0.5 + 120;
    const inView = (x, y) => Math.abs(x - cam.x) < halfW && Math.abs(y - cam.y) < halfH;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // ── BIOLUMINESCENT WAKES ────────────────────────────────────────────────
    // Two parts, for the reason in BIO_TRAIL_LIFE: a bright churn where the shear is well
    // over threshold, and a long dim band where it is only just tripping cells.
    //
    // ⚠️ AND IT MUST NOT SHINE THROUGH THE HULL. This pass runs after the fleet is drawn, so
    // an additive blob centred a few units aft of the transom bleeds straight over the boat
    // above it — the glow appeared to be INSIDE the hull. Skipping samples whose centre is
    // on the boat does not fix it either, because the blobs are wider than that and the
    // bleed comes from their edges. So the hulls are punched OUT of the clip region: one
    // path of the view rect plus every visible hull, filled even-odd, which makes each hull
    // a hole. Exact, and one clip for the whole fleet.
    ctx.save();
    const hullMask = new Path2D();
    hullMask.rect(cam.x - halfW - 300, cam.y - halfH - 300, (halfW + 300) * 2, (halfH + 300) * 2);
    for (const boat of state.boats) {
        if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
        if (!inView(boat.x, boat.y)) continue;
        const poly = getHullPolygon(boat);
        hullMask.moveTo(poly[0].x, poly[0].y);
        for (let k = 1; k < poly.length; k++) hullMask.lineTo(poly[k].x, poly[k].y);
        hullMask.closePath();
    }
    // BUOYS ARE HOLES IN IT TOO. They are solid objects floating ON the water and they draw
    // before this pass, so without a hole a passing boat's trail glows straight through the
    // buoy and it stops reading as an object at all.
    const _props = state.course && state.course.props;
    if (_props) {
        const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        for (const pr of _props) {
            if (pr.kind !== 'buoy-channel-red' && pr.kind !== 'buoy-channel-green') continue;
            if (!inView(pr.x, pr.y)) continue;
            const rr = ((reg[pr.kind] && reg[pr.kind].world) || 28) * (pr.scale || 1) * 0.42;
            hullMask.moveTo(pr.x + rr, pr.y);
            hullMask.arc(pr.x, pr.y, rr, 0, Math.PI * 2);
        }
    }
    ctx.clip(hullMask, 'evenodd');
    for (const boat of state.boats) {
        if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
        const bio = boat.bioTrail;
        if (!bio || bio.length < 2) continue;

        // THE LONG BAND, as one tapering stroke rather than a bead per sample. Eighty
        // radial gradients a boat was both slower and worse-looking — a chain of blobs
        // instead of a band of light.
        for (let i = 1; i < bio.length; i++) {
            const a0 = bio[i - 1], a1 = bio[i];
            if (!inView(a0.x, a0.y) && !inView(a1.x, a1.y)) continue;
            const life = 1 - Math.min(1, a1.age / BIO_TRAIL_LIFE);
            // Squared, so the band thins away rather than ending on a visible stub.
            const a = 0.40 * n * life * life * Math.min(1, a1.str || 0);
            if (a < 0.012) continue;
            ctx.globalAlpha = Math.min(1, a);
            ctx.strokeStyle = BIO_COLOR;
            ctx.lineCap = 'round';
            ctx.lineWidth = 5 + (1 - life) * 26;      // spreads as it ages, like a real wake
            ctx.beginPath();
            ctx.moveTo(a0.x, a0.y);
            ctx.lineTo(a1.x, a1.y);
            ctx.stroke();
        }
        // THE CHURN: the first second and a half, where the shear is well over threshold.
        // This is the part that is genuinely bright, and it carries the pale core.
        for (let i = 0; i < bio.length; i++) {
            const s = bio[i];
            if (s.age > BIO_CHURN_LIFE) break;
            if (!inView(s.x, s.y)) continue;
            const life = 1 - s.age / BIO_CHURN_LIFE;
            const a = 0.85 * n * life * Math.min(1, s.str || 0);
            if (a < 0.02) continue;
            const r = 9 + (1 - life) * 14;
            ctx.globalAlpha = Math.min(1, a);
            ctx.drawImage(glowSprite('43,157,255'), s.x - r, s.y - r, r * 2, r * 2);
            ctx.globalAlpha = Math.min(1, a * 0.7);
            const cr = r * 0.45;
            ctx.drawImage(glowSprite('207,233,255'), s.x - cr, s.y - cr, cr * 2, cr * 2);
        }
    }
    ctx.globalAlpha = 1;
    ctx.restore();                      // hulls stop masking here

    // ── THE WIND WAVES ONLY LIGHT UP WHERE THEY BREAK ───────────────────────
    // ⚠️ THE FIRST VERSION LIT EVERY CAT'S PAW, and that is physically backwards. The
    // shear threshold for a dinoflagellate is 0.02-0.3 N/m^2 by species, and the review
    // literature is blunt about what that means: with the exception of BREAKING waves,
    // those thresholds are "several orders of magnitude larger than typical oceanic ambient
    // flows". The orbital motion under an unbroken ripple does not come close. A uniform
    // glow on every wind wave was inventing light the sea does not make.
    //
    // What rescues the venue's own promise — "the dark hides the breeze, the glow gives it
    // away" — is WHITECAPS. Whitecapping sets in around 3-3.5 m/s (6-7 kt) and is what
    // actually breaks a crest offshore, so above that threshold the tops genuinely do fire
    // cells. That makes the glow a PRESSURE cue rather than a wind cue: it marks the strong
    // patches specifically, which is better information than lighting everything.
    //
    // And it is SPARSE. Turbulence is intermittent, and the modelling result is that those
    // intermittent bursts of extreme strain give flashes that are brighter but rarer than
    // steady straining would. So a few crests wink hard rather than all of them glowing
    // faintly — which is both the physics and the better picture.
    const WHITECAP_KT = 7;
    for (const wave of state.waveStates.values()) {
        if (wave.windSpeed < WHITECAP_KT) continue;
        const dx = Math.sin(wave.angle) * wave.dist, dy = -Math.cos(wave.angle) * wave.dist;
        const x = wave.x + dx, y = wave.y + dy;
        if (!inView(x, y)) continue;
        // Steep ramp above onset: at 7 kt the odd crest tips over, by 14 it is general.
        const cap = Math.min(1, (wave.windSpeed - WHITECAP_KT) / 7);
        // A stable per-wave phase off its origin, so a given crest keeps its own rhythm.
        const h = Math.abs(Math.sin(wave.x * 12.9898 + wave.y * 78.233)) * 43758.5453 % 1;
        const wink = Math.sin(t * (2.6 + h * 2.2) + h * 31.4) * 0.5 + 0.5;
        // Cubed: mostly dark, occasionally bright — the intermittency, not a dimmer switch.
        const burst = wink * wink * wink;
        const cyc = Math.max(0, Math.sin((wave.dist / 150) * Math.PI));
        const a = 0.95 * n * cap * burst * cyc;
        if (a < 0.02) continue;
        const w = Math.max(20, Math.min(70, wave.windSpeed * 3.6)) * (0.5 + 0.5 * burst);
        // ⚠️ BOTH ENDS, NOT JUST THE CENTRE. A crest is a line up to 70u long, so a centre-only
        // test still lets one straddling the waterline poke half its length onto the sand. A
        // crest with either end ashore is dropped whole — which leaves no glow in the last few
        // metres before a beach, and that is the right way to be wrong: the shore already
        // carries its own bioluminescent surf band, so nothing there looks empty.
        const _ca = wave.angle + (wave.tilt || 0);
        const _hx = Math.cos(_ca) * w * 0.5, _hy = Math.sin(_ca) * w * 0.5;
        if (crestOnLand(x, y) || crestOnLand(x - _hx, y - _hy)
            || crestOnLand(x + _hx, y + _hy)) continue;
        ctx.globalAlpha = Math.min(1, a);
        ctx.strokeStyle = BIO_COLOR;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(wave.angle + (wave.tilt || 0));
        ctx.beginPath();
        ctx.moveTo(-w * 0.5, 0);
        ctx.lineTo(w * 0.5, 0);
        ctx.stroke();
        // The hottest winks show a pale core, like a breaking crest does.
        if (burst > 0.55) {
            ctx.globalAlpha = Math.min(1, a * 0.8);
            ctx.strokeStyle = BIO_CORE;
            ctx.lineWidth = 1.1;
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ── SURF ALONG THE SHORE ────────────────────────────────────────────────
    // Breaking water is where bioluminescence is most spectacular in life, so the coast
    // gets a pulsing rim rather than a static outline. The pulse runs along the shore
    // rather than blinking the whole island at once, which is what a set of waves does.
    // ── SURF ALONG THE SHORE ────────────────────────────────────────────────
    // ⚠️ NOT A STROKE ON THE COASTLINE. Stroking the island polygon drew a hard neon
    // OUTLINE — straight runs, sharp corners, even brightness — and it read as a CAD
    // wireframe or a selection highlight, not as water breaking. Three things were wrong
    // with it: surf is a BAND with width, it sits just OFFSHORE rather than on the land
    // edge, and it has no hard edges anywhere.
    //
    // So it is painted as a field instead: soft radial blobs stepped along the coast and
    // pushed seaward, overlapping into a continuous wash with no corners in it. A narrow
    // core rides the same path for the breaking line the photographs show, but its alpha
    // swings hard with the passing sets, so it breaks into surges instead of closing up
    // into an outline again.
    const isls = state.course.islands || [];
    for (const isl of isls) {
        // ⚠️ NOTHING SUBMERGED BREAKS WATER. Same three exclusions the DAYTIME surf makes
        // (updateSurf, and surfDryEdges' probe) — a bar, a coral reef and a sunken rock all
        // lie under the surface, so there is no coastline for a wave to break on. Glowtide's
        // `sunkenrock` is the kind that made this bite: it is the hazard you are NOT warned
        // about, and a ring of bioluminescent surf would have advertised it perfectly.
        if (isl.isFloe || isl.awash || isl.reef) continue;
        // ⚠️ A HIDDEN ISLAND IS NOT A COAST. `compileVenueDoc` turns every hard fixed prop
        // into a hidden 12-gon collider so physics, the router and the chart all meet it as
        // an ordinary shape — the doc calls them "a collider behind something that draws the
        // coast". They have vertices like any island, so this loop happily broke surf on all
        // eighteen channel buoys: a 12-gon at contactR 13 is twelve edges of 6.7 u, each one
        // chunk, so each buoy got a ring of twelve 34-60 u blue blobs. Additively that came to
        // roughly twice the alpha of the buoy's own lamp, which is how a RED light ended up
        // reading as a blue ball. Anything hidden draws no coastline, so it breaks no water.
        if (isl.hidden) continue;
        const v = isl.vertices;
        if (!v || v.length < 3) continue;
        if (Math.abs(isl.x - cam.x) > halfW + isl.radius || Math.abs(isl.y - cam.y) > halfH + isl.radius) continue;
        // Walked by ARC LENGTH in short chunks, so the pulse runs ALONG the coast at a
        // steady speed and each chunk is small enough that its midpoint is an honest cull.
        // Culling whole EDGES by their midpoint went dark exactly when you sailed up to a
        // shore: this landmass is 33 vertices across the whole map, so one edge can be
        // thousands of units long and its midpoint far off-screen.
        // ⚠️ AND AN INLAND EDGE IS NOT A COAST EITHER — the same test the DAYTIME surf has
        // had since Lighthouse Cove, which this pass had simply never needed. drawSurf runs
        // surfDryEdges: step off each edge along the outward normal and ask whether that
        // point is inside another solid shape; if it is, the edge faces ground and breaks
        // nothing. Glowtide is the only venue that runs a night, and its 25 karst shapes are
        // 25 separate islands — probed, ZERO of their 230 edges face another shape — so the
        // gap was latent and this change is a measured no-op on everything shipped.
        //
        // It stops being latent with `jungle`, which is meant to be drawn as a cap INSIDE a
        // karst island: two dry shapes, so two coastlines by the exclusions above, and the
        // cap would have got a full ring of blue surf breaking in the middle of an island —
        // the exact picture the cove note describes, on the one venue where the glow is the
        // whole point.
        //
        // ⚠️ THE INDEX IS OFF BY ONE BETWEEN THE TWO PASSES AND IT IS NOT COSMETIC. This
        // loop walks edge i as v[i] -> v[i+1]; surfDryEdges walks j = i-1 -> i and stores
        // under i. So this edge is that pass's (i + 1), and reading dry[i] here would
        // silence the wrong shore.
        const dry = surfDryEdges(isl);
        // ⚠️ SPACING MUST BE UNDER THE CORE DIAMETER OR THE BRIGHT LINE BEADS. At 46u with
        // 9-16u cores the surges came out as a string of evenly spaced pearls — the wash
        // overlapped fine (it is 68-120u wide) but the cores never touched. 24u is inside
        // the core diameter, so a surge reads as a continuous run of light.
        const CHUNK = 24;
        let run = 0;
        for (let i = 0; i < v.length; i++) {
            const a0 = v[i], a1 = v[(i + 1) % v.length];
            const ex = a1.x - a0.x, ey = a1.y - a0.y;
            const elen = Math.hypot(ex, ey);
            if (elen < 1) continue;
            if (dry[(i + 1) % v.length]) { run += elen; continue; }
            const steps = Math.max(1, Math.round(elen / CHUNK));
            for (let k = 0; k < steps; k++) {
                const f = (k + 0.5) / steps;
                let x = a0.x + ex * f, y = a0.y + ey * f;
                const s = run + elen * f;
                if (!inView(x, y)) continue;
                // Seaward, along the outward normal from the island's own centre — surf
                // breaks OFF the beach, and an on-the-boundary glow reads as a rim on the
                // land instead of water in front of it.
                const ox = x - isl.x, oy = y - isl.y;
                const ol = Math.hypot(ox, oy) || 1;
                // Jittered per chunk, so the band is not a perfect offset curve of the
                // polygon — a shoreline's break line wanders.
                const jit = 10 + 14 * (Math.abs(Math.sin(s * 0.021)) );
                x += (ox / ol) * jit; y += (oy / ol) * jit;
                // Sets, not a uniform blink: a slow pulse travelling down the shore, with a
                // second slower beat over it so successive surges differ in size.
                const ph = Math.sin(t * 1.35 - s / 190) * 0.5 + 0.5;
                const set = 0.65 + 0.35 * (Math.sin(t * 0.5 - s / 640) * 0.5 + 0.5);
                const str = ph * ph * set;
                // THE WASH — wide, soft, always present. Breaking waves are the one natural
                // flow that clears the dinoflagellate shear threshold by a wide margin, so
                // this is the brightest thing in the venue, over the churn behind a hull.
                const R = 34 + 26 * str;
                const a = (0.18 + 0.62 * str) * n;
                ctx.globalAlpha = Math.min(1, a);
                ctx.drawImage(glowSprite('43,157,255'), x - R, y - R, R * 2, R * 2);
                // THE BREAKING LINE — only where a set is actually up, so it appears as
                // surges along the beach rather than a continuous edge.
                if (str > 0.42) {
                    const cR = 14 + 9 * str;      // >= CHUNK, so surges join up
                    ctx.globalAlpha = Math.min(1, (str - 0.42) * 1.5 * n);
                    ctx.drawImage(glowSprite('207,233,255'), x - cR, y - cR, cR * 2, cR * 2);
                }
            }
            run += elen;
        }
    }
    ctx.globalAlpha = 1;

    // ── LIT CHANNEL BUOYS ───────────────────────────────────────────────────
    // A lateral mark carries a light of its own colour — red on a red buoy, green on a
    // green one — and the venue card promises "rocky shores & LIT MARKS". Glowtide already
    // lines its channel with 18 of them, so this is the piece of the night that does the
    // most navigational work: in the dark the buoys are the channel.
    //
    // THEY FLASH, and that is not decoration. A real lateral mark shows a rhythmic flash
    // rather than a steady light, and here the rhythm also solves a playability problem:
    // eighteen steady lamps would be eighteen competing highlights on a dark map. A flash
    // draws the eye once and then gets out of the way.
    //
    // But a flash that goes fully dark takes the buoy with it, and a channel you can only
    // see for a fifth of each cycle is worse than useless when you are threading it at
    // speed. So each carries a dim EMBER that never goes out — locatable at all times —
    // with the flash on top. Phase comes from the buoy's own position, so a line of them
    // twinkles down the channel instead of blinking in unison like a string of fairy
    // lights, which is also what a real channel looks like.
    const props = state.course && state.course.props;
    if (props && props.length) {
        for (const pr of props) {
            const red = pr.kind === 'buoy-channel-red';
            if (!red && pr.kind !== 'buoy-channel-green') continue;
            if (!inView(pr.x, pr.y)) continue;
            // QUICK-FLASHING. A 4 s rhythm was too languid to read as a working light — at
            // racing speed you pass a buoy before it has flashed twice. 1.6 s is close to
            // the "Q" (quick) character real marks use, so the channel visibly ticks.
            const ph = (Math.abs(Math.sin(pr.x * 0.0173 + pr.y * 0.0291)) * 1.6);
            const cyc = (t + ph) % 1.6;
            const flash = cyc < 0.5 ? Math.sin((cyc / 0.5) * Math.PI) : 0;
            const amp = 0.22 + 0.85 * flash;                  // ember, plus the flash over it
            const glow = red ? '255,30,30' : '0,255,110';
            const core = red ? '255,205,205' : '205,255,220';
            // ⚠️ THE HALO HAS TO REACH PAST THE BUOY. At radius 9-18 it sat INSIDE the 28u
            // body and the thing read as a glowing buoy rather than a buoy with a light on
            // it. A lamp throws light onto the water around it, so the halo now clears the
            // hull and the tight core stays the lamp itself.
            const gr = 21 + 17 * flash;
            ctx.globalAlpha = Math.min(1, amp * n);
            ctx.drawImage(glowSprite(glow), pr.x - gr, pr.y - gr, gr * 2, gr * 2);
            const cR = 2.4 + 1.8 * flash;
            ctx.globalAlpha = Math.min(1, (0.35 + 0.6 * flash) * n);
            ctx.drawImage(glowSprite(core), pr.x - cR, pr.y - cR, cR * 2, cR * 2);
        }
        ctx.globalAlpha = 1;
    }

    // ── NAV LIGHTS ──────────────────────────────────────────────────────────
    // RRS aside, this is COLREGs: sidelights are red to port and green to starboard, each
    // showing from dead ahead round to abaft the beam. From directly overhead both are
    // visible on every boat, which is exactly what makes them useful here — at a glance you
    // can tell which way a rival is pointing in the dark, and that is information the day
    // venues give you from the sail. A dim white sternlight closes the picture.
    for (const boat of state.boats) {
        if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
        if (!inView(boat.x, boat.y)) continue;
        const s = Math.sin(boat.heading), c = Math.cos(boat.heading);
        // A POINT LIGHT, NOT A DISC OF COLOUR. Two draws, and the split is the whole
        // difference: a LAMP is a tiny over-exposed core with a coloured halo bleeding out
        // of it, so the core is drawn near-white and the glow carries the colour. Earlier
        // cuts held the saturated colour flat out to a third of the radius, which on a 55u
        // hull is a painted dot — bright, but obviously paint rather than a light. Drawn
        // additively, the core blows out through the halo on its own.
        // ⚠️ THE SAME TRANSFORM hullPolygonAt USES, and it has to be, or the lights are not
        // on the boat. A first cut wrote `+ ly*(sin, -cos)`, which negates the aft axis: the
        // sidelights came out amidships and the stern light landed on the STEM. HULL_LOCALS
        // puts the bow at y = -25 and the transom at y = +30, so local +y is aft and this is
        // the plain rotation that goes with it.
        const lamp = (lx, ly, core, glow, gr, amp) => {
            const x = boat.x + (lx * c - ly * s);    // local +x starboard, +y aft
            const y = boat.y + (lx * s + ly * c);
            const g = ctx.createRadialGradient(x, y, 0, x, y, gr);
            g.addColorStop(0, glow);
            g.addColorStop(0.28, glow);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            // ⚠️ THE GLOW CARRIES THE COLOUR, THE CORE ONLY BRIGHTENS IT. First attempt had
            // a near-white core at high additive alpha over a thin halo, and the hue washed
            // straight out — ten boats with white dots on the bow, which loses the one thing
            // sidelights are for. So the halo is the strong, saturated element and the core
            // is small and only lightly tinted toward white.
            ctx.globalAlpha = Math.min(1, amp * n);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, gr, 0, Math.PI * 2);
            ctx.fill();
            // The filament: small and hard, just enough to read as a lamp rather than a dot.
            const k = ctx.createRadialGradient(x, y, 0, x, y, 2.1);
            k.addColorStop(0, core);
            k.addColorStop(0.5, core);
            k.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = Math.min(1, amp * 0.8 * n);
            ctx.fillStyle = k;
            ctx.beginPath();
            ctx.arc(x, y, 2.1, 0, Math.PI * 2);
            ctx.fill();
        };
        // SIDELIGHTS ONLY — red to port, green to starboard, both on the bow. No stern
        // light, no steaming light, no anchor light: a boat racing under sail carries the
        // pair and nothing else here, and three lamps on a 55u hull was clutter that made
        // the one thing they are for — which way is he pointing — harder to read, not easier.
        // Bow is local y = -25 (HULL_LOCALS), so these sit just abaft the stem.
        lamp(-5, -20, 'rgba(255,190,190,1)', 'rgba(255,26,26,1)', 11, 0.95);    // port, red
        lamp(5, -20, 'rgba(198,255,214,1)', 'rgba(0,255,106,1)', 11, 0.95);     // starboard
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

// ── FIRE ─────────────────────────────────────────────────────────────────────
// The light a bonfire throws. The ART BAKES NONE OF THIS — glowtide-bonfire is painted as a
// cold woodpile in flat daylight, deliberately, and everything warm about it is added here.
// Same division as the venue's jellyfish (painted white, tinted and lit by the engine) and
// its channel buoys (painted without their lamps).
//
// ⚠️ THIS IS ITS OWN PASS RATHER THAN A BLOCK INSIDE drawNightGlow, AND THAT IS THE WHOLE
// POINT OF IT. That function opens `if (nightAmt() <= 0) return`, which is right for
// bioluminescence and for navigation lamps — both are things you only see after dark. A fire
// is not. It burns at noon, and a bonfire that existed only on Glowtide would be an unlit
// woodpile the moment anyone reused it on a day venue. So the night level scales this pass
// instead of gating it.
//
// ⚠️ AND IT SCALES THE TWO HALVES DIFFERENTLY, which is the only interesting decision here.
// A fire is two things at once: the FLAME, which is emissive and just as visible at midday,
// and the LIGHT IT THROWS, which you can only see when its surroundings are dark. So the
// core barely moves with the hour and the halo mostly does. At night the fire pools light
// across the sand; by day it shrinks back to a bright flame with almost no reach, which is
// what a fire on a sunlit beach actually looks like.
//
// ⚠️ THE HALO MUST CLEAR THE BODY. The buoy lamps learned this the hard way — at radius 9-18
// inside a 28u hull they read as glowing buoys rather than buoys with lights on them — and a
// bonfire is worse, because a 42u woodpile lit from within just looks like it is made of
// embers. FIRE_HALO is 1.9x the prop's own drawn size, so the light lands on the ground
// outside the ring and the thing reads as a fire.
//
// ⚠️ PEAK IS 0.62, NOT 1.0, AND THAT IS MEASURED. Composited against the delivered sprite at
// full strength the stone ring blows out and loses its form: the object stops being a bonfire
// and becomes a blob of light. Around 55-60% the fire is unmistakable and the stones are
// still stones. The flicker envelope below peaks there.
const FIRE_KINDS = { 'glowtide-bonfire': 1 };

// ⚠️ THE LIGHT IS TIGHT, NOT A POOL, AND THAT CAME FROM REFERENCE. The first cut used the
// buoy lamp's proportions — one wide soft halo at 1.9x the body over a small core — and it
// was wrong in a way the buoys are not: a nav lamp IS a point source hung in the dark, so a
// broad even glow is what it does, while a bonfire is a MASS OF BURNING WOOD. Photographed
// from above, the ground a body-width outside the ring is already dark; what is bright is
// the fuel itself, glowing along the length of every log. The 1.9x pool read as a lantern
// standing on the sand with the woodpile left cold underneath it.
//
// So this is built inside-out in four layers instead of two, and the widest of them barely
// clears the stones:
//   HEART   a small white-hot centre, the base of the flame
//   FLAME   the visible fire, drawn as three WANDERING LOBES rather than one disc so the
//           silhouette licks and is never a circle
//   EMBERS  a warm layer sized to the PILE, which is what makes the wood read as
//           incandescent rather than as grey wood with a light above it
//   THROWN  the only part that reaches past the ring, and it is the faintest
const FIRE_HEART  = 0.15;   // radius as a multiple of the prop's drawn size
const FIRE_FLAME  = 0.27;
const FIRE_EMBER  = 0.52;   // sized to the woodpile itself
const FIRE_THROWN = 1.25;   // just past the stone ring — see above
// ⚠️ 0.62 WAS MEASURED ON A BUILD THAT NO LONGER EXISTS, AND CARRYING IT OVER WAS AN ERROR.
// The cap came from an offline composite of the FIRST construction — one wide soft halo at
// 1.9x the body — where driving it to full washed the stone ring out and the object stopped
// being a bonfire. That halo is gone: the light is now four tight layers, the widest of them
// barely past the stones, and the thrown component is separately scaled down to 0.42. With
// nothing left to blow the stones out, the old cap was only making the fire dim, and at 0.62
// it read as a warm patch buried in the woodpile rather than as something burning.
const FIRE_PEAK   = 1.0;
// The tongues, outside in. `len`/`wid` are fractions of the prop's drawn size; `rate` is how
// fast that ring licks — the outer tips whip and the hot core barely moves, which is what a
// fire does. `k` offsets each ring's angular spacing so the three never line up into spokes.
const FIRE_RINGS = [
    // `arc` is how far this ring may stray from the leaning axis — the outer flame swings
    // widest, the hot core barely moves. `root` spreads each ring's origins over the fuel.
    // ⚠️ THE AMPS LOOK HIGH AND ARE NOT. A tongue is a CHAIN of four blobs that taper and
    // fade along its length, so the number here is the brightness of its ROOT and everything
    // past that is already dimmer; the first pass at 0.30/0.38/0.46 measured sensible and
    // rendered as a glimmer buried in the woodpile.
    { n: 7, len: 0.44, wid: 0.150, root: 0.15, arc: 1.35, rate: 2.7, amp: 0.70, rgb: '255,112,24' },
    { n: 5, len: 0.32, wid: 0.125, root: 0.11, arc: 0.85, rate: 2.1, amp: 0.85, rgb: '255,172,58' },
    { n: 3, len: 0.21, wid: 0.100, root: 0.06, arc: 0.45, rate: 1.5, amp: 1.00, rgb: '255,235,182' },
];

const FIRE_RGB = {
    heart:  '255,248,228',   // white-hot, but never pure white
    flame:  '255,176,52',
    ember:  '255,96,18',     // deep orange — this is glowing wood, not a flame
    thrown: '255,138,44',
};

// ⚠️ A FLAME IS A SHAPE, NOT A GRADIENT — BUT IT IS NOT A SPIKE EITHER, and getting that
// wrong twice is what this comment is for. Four additive discs gave light coming off a fire
// without giving fire. Replacing them with filled tapered tongues gave fire made of DARTS: a
// dozen hard-edged points radiating evenly from one centre, which reads as a starburst, a
// sea urchin, an explosion — anything but burning. Two things were wrong and both matter:
// a real flame has NO HARD EDGE anywhere, and it is never radially even.
//
// So a tongue is built as a TAPERED CHAIN OF SOFT BLOBS along its axis, each smaller and
// fainter than the last. Soft by construction, because glowSprite is already a radial
// falloff, and it costs no blur filter. Overlapping, the chain reads as one licking body of
// flame rather than as beads.
//
// ⚠️ AND FROM DIRECTLY ABOVE A FLAME DOES NOT POINT UP. It climbs, so a plan view looks
// along its length and every tongue foreshortens: what you see is an irregular bright heart
// with the fire reaching OUTWARD and wandering, never a row of vertical spikes. Same mistake
// the bayou's spanish moss note records — draw the side view of a thing that rises and the
// camera is wrong however good the flame looks.
function flameTongue(g, rgb, x, y, ang, len, wid, amp) {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const N = 4;
    for (let i = 0; i < N; i++) {
        const u = i / (N - 1);                       // 0 at the root, 1 at the tip
        const r = wid * (1.0 - 0.62 * u);            // tapers
        const a = amp * (1.0 - 0.55 * u);            // and fades
        if (a <= 0.004) continue;
        g.globalAlpha = Math.min(1, a);
        const px = x + cs * len * u, py = y + sn * len * u;
        g.drawImage(glowSprite(rgb), px - r, py - r, r * 2, r * 2);
    }
}

function drawFireGlow(ctx) {
    const props = state.course && state.course.props;
    if (!props || !props.length) return;
    const n = nightAmt();
    const cam = state.camera, t = state.time;
    const halfW = ctx.canvas.width * 0.5 + 160, halfH = ctx.canvas.height * 0.5 + 160;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    let opened = false;
    const blob = (rgb, x, y, r, a) => {
        if (a <= 0.004 || r <= 0.2) return;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
    };
    for (const pr of props) {
        if (!FIRE_KINDS[pr.kind]) continue;
        const x = pr.x + (pr._dx || 0), y = pr.y + (pr._dy || 0);
        if (Math.abs(x - cam.x) > halfW || Math.abs(y - cam.y) > halfH) continue;
        const world = ((reg[pr.kind] || {}).world || 42) * (pr.scale || 1);

        // ⚠️ A FIRE DOES NOT BLINK ON A RHYTHM, so this is not the buoys' clean sine. Three
        // incommensurable rates sum into something that never obviously repeats, and the
        // phase is seeded from the prop's own position so two fires on one beach never
        // flicker in step — the trick the buoy lamps use to stop a channel reading as fairy
        // lights, borrowed for the opposite reason.
        const ph = x * 0.0131 + y * 0.0217;
        const f = Math.max(0.20, Math.min(1, 0.62
            + 0.22 * Math.sin(t * 3.10 + ph)
            + 0.11 * Math.sin(t * 7.70 + ph * 1.7)
            + 0.07 * Math.sin(t * 1.30 + ph * 0.4)));

        // ⚠️ THE TWO HALVES ANSWER THE HOUR DIFFERENTLY, and that is what lets one fire serve
        // a night venue and a day one. A fire is emissive AND it throws light: the flame is
        // just as visible at noon, but the light it casts on the ground only shows when the
        // ground is dark. So the fuel barely moves with `n` and the thrown light mostly does.
        // By day it collapses to a bright flame with almost no reach, which is exactly what a
        // fire on a sunlit beach looks like.
        const fuelAmp   = (0.66 + 0.34 * n) * FIRE_PEAK * f * 1.35;
        const thrownAmp = (0.10 + 0.90 * n) * FIRE_PEAK * f * 0.42;
        if (fuelAmp <= 0.004 && thrownAmp <= 0.004) continue;

        if (!opened) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            opened = true;
        }
        blob(FIRE_RGB.thrown, x, y, world * FIRE_THROWN * (0.90 + 0.10 * f), thrownAmp);
        blob(FIRE_RGB.ember,  x, y, world * FIRE_EMBER  * (0.92 + 0.08 * f), fuelAmp * 0.75);

        // ── THE FLAME ITSELF ────────────────────────────────────────────────
        // Three rings of tongues, longest and deepest-coloured outside, shortest and
        // hottest inside, so the fire has a temperature gradient the way a real one does.
        // Every tongue carries its OWN phase, so they lick independently instead of the
        // whole flame breathing in and out as one shape.
        // ⚠️ THE FIRE LEANS, AND THAT IS WHAT STOPS IT LOOKING LIKE A STARBURST. Tongues
        // spread evenly around the centre give a symmetric spiky rosette however well each
        // one is drawn. A real fire is lopsided from moment to moment — the body of it
        // wanders to one side, flares, and falls back. `bias` is that wander, a slow drift
        // of the whole flame's axis; tongues cluster around it instead of ringing the pile.
        const bias = t * 0.37 + ph + 1.9 * Math.sin(t * 0.53 + ph);
        for (const ring of FIRE_RINGS) {
            for (let k = 0; k < ring.n; k++) {
                const seed = ph + k * 2.399 + ring.k;
                // Clustered about the leaning axis, not spread over the full circle.
                const ang = bias + ring.arc * Math.sin(seed * 1.7 + t * ring.rate * 0.31)
                          + 0.55 * Math.sin(t * ring.rate + seed * 2.3);
                const lick = 0.55 + 0.45 * Math.abs(Math.sin(t * (ring.rate * 1.31) + seed));
                // ⚠️ ORIGINS ARE SPREAD OVER THE FUEL BED, not all at one point. Every tongue
                // starting from the exact centre is the other half of what made the darts.
                const ox = world * ring.root * Math.cos(seed * 3.1);
                const oy = world * ring.root * Math.sin(seed * 3.1);
                const len = world * ring.len * (0.55 + 0.60 * lick) * (0.75 + 0.35 * f);
                const wid = world * ring.wid * (0.85 + 0.30 * lick);
                flameTongue(ctx, ring.rgb, x + ox, y + oy, ang, len, wid,
                            fuelAmp * ring.amp);
            }
        }
        blob(FIRE_RGB.heart, x, y, world * FIRE_HEART * (0.70 + 0.45 * f), fuelAmp * 1.15);
    }
    if (opened) {
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}


function drawWater(ctx) {
    if (window.WaterRenderer) {
        window.WaterRenderer.draw(ctx, state);
    }
}

// ── A PUFF IS A PATCH OF DIFFERENT-COLOURED WATER, AND NOTHING ELSE ─────────
//
// A cat's-paw is the water going dark and rough; a hole is the water going glassy and pale.
// That is the whole visual. It does NOT get its own wind graphic — the wind it carries is
// already in the field, so the comet layer draws it: inside a puff the streaks run longer,
// wider, denser and warmer, because `getWindAt` says the wind there is stronger. Two layers
// drawing "wind" is two layers to reconcile, and they never agreed.
//
// ── WHY IT IS A FACETED PATCH AND NOT A SOFT GRADIENT ──────────────────────
//
// It was a baked radial-gradient sprite, and three things were wrong with it, all measured
// (eval/_puff_tone.js, eval/_puff_read.js):
//
//   TOO STRONG      the core ran to 13-18% of full scale on Stillwater. The guide for a
//                   "just perceptible" step on a flat field is 1-2%; 5% already reads as an
//                   overlay laid on the picture rather than as the water being different.
//   INCONSISTENT    the same code gave 4.4% on Bluewater, 0.0% on Redrock and 17.7% on
//                   Stillwater, because the delta was an authored COLOUR at a fixed alpha
//                   over ten different waters. Whether you could see a puff at all depended
//                   on the venue's palette.
//   WRONG IDIOM     a smooth radial falloff has no edge, and the edge is the thing. What a
//                   sailor actually looks for is the boundary — "you can see the breeze on
//                   the water AND its edges" — because that is what tells you when it
//                   arrives. It is also the one gradient left in a style guide whose third
//                   pillar is that this game never blurs.
//
// So: two flat tonal bands on the cell's own intensity contours, with torn edges, at an
// alpha CALIBRATED per venue to land on a fixed perceptual step. The tone is now a
// supporting cue — the comet density is the primary one, which is the honest ordering,
// because density is what survives a cell bigger than the screen.
//
// ⚠️ THE MINIMAP IS A SEPARATE DRAW and keeps its gradient. Two different jobs: the chart is
// read as a weather map, where a soft blob is the right idiom and there is no water for it
// to be a property of. Nothing here touches it.
//
// ⚠️ OVERLAPPING CELLS COMPOUND HERE AND ARE CLAMPED IN THE PHYSICS, and that is a known,
// bounded divergence rather than an oversight. getWindAt limits stacked same-sign puffs to
// the strongest single cell's worth ("two patches of the same descended air overlapping is
// still that air, not twice it"); these are independent polygon fills, so where cells
// overlap their alphas composite. Measured on flat water with all fourteen of Stillwater's
// cells in frame: p1 -3.1% of full scale, p99 +1.6%, worst pixel 5.1% against the 2.2%
// target, and 5.4% of pixels past 2.5%. Matching the clamp exactly needs the layer rendered
// through an offscreen max-composited mask — a full-screen clear and composite every frame
// to correct a 5% worst case on a small fraction of pixels. Not worth the frame for that;
// revisit if cell counts per venue go up.
let SNOW = null;
let SNOW_SPRITE = null;
// One soft radial blob, baked once and drawImage'd per flake — fuzzy edges
// without paying for per-flake gradients or shadowBlur.
function snowFlakeSprite() {
    if (SNOW_SPRITE) return SNOW_SPRITE;
    const s = 32, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    SNOW_SPRITE = c;
    return c;
}
function drawSnowOverlay(ctx) {
    if (!state.race.venueFx || !state.race.venueFx.snowfall) { SNOW = null; return; }
    const w = ctx.canvas.width, h = ctx.canvas.height;

    // draw() has no dt; derive one (clamped so tab-switches don't teleport flakes)
    const now = performance.now();
    const dt = SNOW ? Math.min(0.05, Math.max(0, (now - SNOW.t) / 1000)) : 1 / 60;

    if (!SNOW || SNOW.w !== w || SNOW.h !== h) {
        SNOW = { w, h, t: now, flakes: [] };
        for (let i = 0; i < 160; i++) {
            SNOW.flakes.push({
                x: snowRand() * w, y: snowRand() * h,
                spd: 35 + snowRand() * 55,           // px/sec fall — snow floats, rain doesn't
                size: 3 + snowRand() * 6,            // sprite draw size, px
                sway: snowRand() * Math.PI * 2,      // flutter phase
                flut: 0.8 + snowRand() * 1.6,        // flutter frequency
                amp: 8 + snowRand() * 18,            // flutter amplitude, px/sec
                depth: 0.4 + snowRand() * 0.6        // parallax-ish alpha/speed/size tier
            });
        }
    }

    SNOW.t = now;
    const spr = snowFlakeSprite();
    const slant = 0.18; // gentle wind drift — a steeper diagonal reads as sleet
    ctx.save();
    for (const f of SNOW.flakes) {
        f.y += f.spd * f.depth * dt;
        f.x += (f.spd * slant * f.depth + Math.cos(state.time * f.flut + f.sway) * f.amp) * dt;
        if (f.y > h + 8) { f.y = -8; f.x = snowRand() * w; }
        if (f.x > w + 8) f.x = -8;
        else if (f.x < -8) f.x = w + 8;

        const d = f.size * (0.6 + f.depth);
        ctx.globalAlpha = 0.45 + f.depth * 0.45;
        ctx.drawImage(spr, f.x - d / 2, f.y - d / 2, d, d);
    }
    ctx.restore();
}

