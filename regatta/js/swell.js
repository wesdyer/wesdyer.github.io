// OCEAN SWELL — the mechanic Bluewater Bonanza is about.
//
// ⚠️ ONE VENUE. Everything here is dead unless the venue document carries a `swell` block,
// and only ocean.venue.js does. `Swell.active()` is false everywhere else, every call site
// in script.js is behind it, and no other venue changes by a single unit. That matters
// beyond tidiness: Clubhouse Point is the eval anchor, and a sea state that leaked into it
// would invalidate the whole regression history.
//
// ── ONE FIELD, EVERY EFFECT ────────────────────────────────────────────────
// There is no list of special cases for upwind, reaching and downwind. There is a travelling
// wave field, and the four things a wave does to a boat:
//
//   1. it SLOPES        → gravity along the boat's track: slow up the face, surf down it
//   2. it MOVES WATER   → orbital velocity carries the boat, forward at the crest and back
//                         in the trough (this is the push, and the set to leeward)
//   3. it LIFTS UNEVENLY→ bow and stern sit in different water, which is a couple: yaw
//   4. it must be PUNCHED THROUGH upwind, and that cost grows the harder you drive into it
//
// Upwind, reaching and downwind then fall out of the geometry rather than being written
// down separately, and they come out matching what ocean sailors actually report — see the
// derivations at each term.
//
// ── UNITS ──────────────────────────────────────────────────────────────────
// The game is a uniformly time-compressed world: 5 units = 1 metre, and speeds are quoted in
// knots where units/second = knots × 15. Those two together mean the game runs about 5.8×
// real time. That is fine and it is why the REAL deep-water formulas can be used unchanged:
// compression is uniform, so every RATIO — wave speed against boat speed, orbital velocity
// against boat speed, crests met per boat length — comes out physically correct. Only the
// wall-clock rate differs, and it differs for the boats in exactly the same proportion.
//
//   deep-water wavelength   L = 1.56 T²  metres      → L_u = 7.8 T²    units
//   deep-water celerity     c = 1.56 T   m/s         → c_u = 45.5 T    units/s
//
// ⚠️ ...AND ONE PLACE WHERE UNIFORM COMPRESSION IS THE WRONG ANSWER: how fast the train
// travels. Compressed faithfully, a 10-second swell arrives every 3 seconds of wall clock
// and overtakes a running boat at 16 knots of closing speed — spatially exact, and it plays
// like chop you can do nothing about. A wave is only RIDEABLE when its speed is close to the
// boat's, because that is what makes holding it depend on how fast you are going.
//
// So a train may author `speedKt` and the ocean does. This is not a fudge dressed up: the
// wave a keelboat actually surfs downwind is the WIND SEA riding on the swell, which is
// slower and shorter than the primary swell and runs at something like 1.3-1.6x boat speed.
// Authoring the celerity picks that wave. The wavelength stays deep-water-honest so the
// picture is right, and the whole catch-and-hold mechanic falls out of the ratio:
//
//   at 11 kt a crest overtakes every ~9 s   — here it comes
//   at 14 kt                      every ~16 s — caught it, and the ride is stretching
//   at  9 kt                      every ~7 s  — pushed too deep, it has gone under you
//   surface orbital speed   u = A ω      m/s         → A_u ω_game      units/s   (identity:
//     the two conversions cancel, so this needs no bridging constant — a 2.4 m swell at 9.5 s
//     works out to 1.5 kt of orbital velocity here exactly as it does at sea.)
(function () {

const U_PER_M = 5;
const KT_TO_U = 15;                       // units/second per knot
const HULL_LEN = 55;                      // units, bow to stern — the lever arm for the couple

// ── TUNING ─────────────────────────────────────────────────────────────────
// Every gain below is a fraction of a physically-derived quantity, not a free number, and
// the comment says what the physical ceiling is. A venue's `strength` scales the lot.
const K = {
    // Gravity down the wave face, as knots/second per unit of along-track slope. Free-fall
    // down a 3° face works out near 5.8 kt/s in this world's units; a hull is dragging and
    // mostly supported, so only a small share of it reaches the boat.
    //
    // ⚠️ TUNED DOWN FROM 40, which was not merely strong but tactically WRONG: it made dead
    // downwind the fastest angle on the course (VMG 14.5 kt at 180° against 14.8 at 160°,
    // where flat water gives 8.2 and 9.5). A run you sail by pointing the boat at the leeward
    // mark and doing nothing is the opposite of the mechanic — the polar has to stay in
    // charge of WHICH angle pays, and the sea's job is to reward sailing that angle well.
    surfKtPerSlope: 11,
    // THE SHAPE OF A RIDE, as two multipliers on the slope term that apply only in
    // proportion to how well you are lined up with the wave.
    //
    //   faceGain    extra shove going DOWN the face — the ride
    //   troughWall  extra brake going UP — running out of wave at the bottom and meeting the
    //               back of the one in front, which is the thing that ends a ride
    //
    // ⚠️ The brake used to be RELIEF (0.45, i.e. climbs cost less when aligned) which made a
    // well-sailed run net positive but flattened the whole cycle: you never felt the wave get
    // away from you, so there was nothing to steer about. Racing guidance is explicit that the
    // bottom of the face is where a run is won or lost — "head the boat up gently, find an
    // escape from the trough, rather than ploughing to the bottom and slamming into the back
    // of the wave in front". So the brake is now a real wall.
    //
    // Net gain over a full wave is proportional to (faceGain - troughWall) and is deliberately
    // held near where it was, ~1.05: the same reward for sailing a run well, with more than
    // twice the swing between best and worst moment of it.
    faceGain: 1.35,
    troughWall: 0.30,
    // The couple, as a fraction of the raw bow-to-stern differential. A long swell lifts most
    // of the hull at once, so the raw differential is small and this has to be generous to
    // read at all: tuned to about 3° of wander upwind — enough that you are always working
    // the helm and never fighting it.
    yaw: 0.50,
    // ...and it is bigger when the stern is being lifted by a wave you are running with,
    // which is the classic broach. Multiplier at full surf: ~14° of slew downwind if nobody
    // corrects, which is a wave trying to throw the boat off its line rather than a nudge.
    yawSurfBoost: 1.0,
    // Sustained cost of punching upwind, at reference swell power. Split into what you pay
    // however well you sail it, and what you pay for footing — that gap IS the pinch mechanic.
    poundBase: 0.035,
    poundFoot: 0.105,
    // Steady set in the wave's direction of travel while it is forward of the beam, in knots
    // at reference power. Measured at sea as "lifted from the side and set down half a
    // boatlength to leeward" — this is that, and because it scales with how beam-on you lie
    // to the wave, pointing higher is what reduces it.
    setKt: 0.85,
    // Orbital velocity is used at full strength: it is a real water motion, and it is what
    // makes the crest push and the trough hold you back.
    orbital: 1.0
};

// Close-hauled, and how far past it counts as fully footing. The polar's best upwind VMG
// sits near 42°; by 68° you have given up on pointing and are driving the boat into the
// backs of waves, which is precisely what the sea punishes.
const BEAT_DEG = 42, FOOT_SPAN_DEG = 26;

// Reference swell power, so `power` is ~1 on the ocean's authored sea and the gains above
// read as "at Bluewater Bonanza". Max surface slope of the primary train, dimensionless.
const REF_POWER = 0.055;

let TRAINS = [];
let CFG = null;
let POWER = 0;                 // Σ A·k over the trains, normalised by REF_POWER
let AMP_TOTAL = 0;             // Σ A, units — the crest-to-mean height of the whole sea
let TIME = 0;

const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ── CONFIGURE ──────────────────────────────────────────────────────────────
// `windFrom` is the venue's mean wind direction — the heading the wind blows FROM, the
// game's convention everywhere. Swell runs DOWNWIND, so a train's travel direction is
// windFrom + π, turned by its own authored offset.
//
// WHY THE WIND AND NOT AN AUTHORED COMPASS BEARING: the ask was for the swell to be aligned
// with the wind region, and it is the right call for a venue whose wind is re-derived from
// its regions every race. The sea state then always agrees with the breeze that built it,
// and a venue edit that turns the wind turns the swell with it rather than silently leaving
// a cross sea nobody asked for.
//
// It is sampled ONCE per race and then held. A wave train is a long-crested thing with
// kilometres of memory; it does not swing about with the live oscillation, and — the reason
// that matters here — a direction that moved would make the phase field discontinuous and
// tear the crests apart on screen.
function configure(doc, windFrom) {
    // TIME is module state and this was the one field configure() did not
    // reset (2026-08-08, the ocean-bench nondeterminism hunt). It accrued
    // across menu frames — a WALL-CLOCK-dependent number of them before the
    // eval harness hooks the loop — and across every race in a page, so the
    // swell phase at the gun differed run to run: same tree, same seed, every
    // boat's line diverging from frame 0 with the RNG stream untouched. That
    // was the entire ocean-bench nondeterminism (bay/arctic, with no trains,
    // never moved TIME and stayed byte-reproducible). A race's sea starts at
    // its own phase zero.
    TIME = 0;
    TRAINS = []; CFG = null; POWER = 0; AMP_TOTAL = 0;
    const S = doc && doc.swell;
    if (!S || !Array.isArray(S.trains) || !S.trains.length) return;

    CFG = { strength: S.strength != null ? S.strength : 1 };
    const base = (typeof windFrom === 'number' && isFinite(windFrom)) ? windFrom : 0;

    let acc = 0;
    S.trains.forEach((t, i) => {
        const T = Math.max(2, +t.periodS || 9);
        const H = Math.max(0, +t.heightM || 0);
        if (H <= 0) return;
        const theta = base + Math.PI + (+t.fromWind || 0) * Math.PI / 180;
        const L = 7.8 * T * T;                       // units, crest to crest
        // Deep-water celerity unless the train names its own — see the note at the top of
        // the file for why an ocean venue wants to.
        const c = t.speedKt != null ? (+t.speedKt * KT_TO_U) : (45.5 * T);
        const k = (Math.PI * 2) / L;                 // rad per unit
        const A = (H * U_PER_M) / 2;                 // units, crest above mean
        const w = k * c;                             // rad/s, game clock
        // HOW MUCH OF THIS TRAIN THE BOAT FEELS, 0..1, against how much of it you SEE.
        // Not a physics term and not pretending to be one: it is the dial that decides
        // whether the sea heaves or buzzes. A short wind sea is most of what gives the water
        // its grain on screen, and at full weight its forcing arrives every second or two,
        // which reads as chatter rather than as a sea. The picture keeps it; the hull mostly
        // does not. The swell you ride is the one that moves you.
        const force = t.force != null ? Math.max(0, +t.force) : 1;
        TRAINS.push({
            id: t.id || ('train-' + i),
            theta, L, c, k, A, w, force,
            sx: Math.sin(theta), sy: -Math.cos(theta),   // unit vector the wave travels along
            // Fixed per-train phase so two trains never start stacked crest-on-crest.
            // Derived from the index by the same golden-angle walk the wind regions use —
            // never from RNG, which the render and physics must not touch.
            phase0: (i * 2.399963) % (Math.PI * 2),
            heightM: H, periodS: T
        });
        acc += A * k * force;
        AMP_TOTAL += A;
    });
    POWER = (acc / REF_POWER) * CFG.strength;
}

const active = () => TRAINS.length > 0;

function update(dt) { if (TRAINS.length) TIME += dt; }

// ── THE FIELD ──────────────────────────────────────────────────────────────
// Elevation, its gradient, and the surface orbital velocity, summed over the trains.
//
// Orbital velocity is IN PHASE with elevation — water runs forward under the crest and
// backward in the trough. That single fact is what makes the crest push a running boat along
// and the trough hold it back, and it is why a boat beating into a sea gets set to leeward:
// the water it is sitting in is going the way the wave is, which is downwind.
function sampleAt(x, y) {
    let elev = 0, gx = 0, gy = 0, ox = 0, oy = 0;
    for (let i = 0; i < TRAINS.length; i++) {
        const t = TRAINS[i];
        const A = t.A * t.force;                     // what the HULL feels — see `force`
        const ph = t.k * (x * t.sx + y * t.sy) - t.w * TIME + t.phase0;
        const cs = Math.cos(ph), sn = Math.sin(ph);
        elev += A * cs;
        const g = -A * t.k * sn;                     // d(elev)/ds along the travel direction
        gx += g * t.sx; gy += g * t.sy;
        const u = A * t.w * cs;                      // units/s along the travel direction
        ox += u * t.sx; oy += u * t.sy;
    }
    return { elev, gx, gy, ox, oy };
}

// The train a sailor reads and steers to: the biggest one. The cross swell is real in the
// field above and in the picture, but "which way are the waves running" has to have one
// answer or there is nothing to learn.
function primary() { return TRAINS.length ? TRAINS[0] : null; }

// ── WHAT THE SEA DOES TO ONE BOAT ──────────────────────────────────────────
// Called once per boat per frame. Writes `boat.swell`; script.js reads four numbers off it
// and applies them beside the terms it already has (leeway, current, target speed). Nothing
// here reads or writes anything the AI owns.
function trim(boat, windFrom) {
    if (!TRAINS.length) { boat.swell = null; return null; }

    const f = sampleAt(boat.x, boat.y);
    const p = primary();

    // Boat axes. Forward is the game's heading convention; right is forward turned +90°.
    const hx = Math.sin(boat.heading), hy = -Math.cos(boat.heading);
    const rx = Math.cos(boat.heading), ry = Math.sin(boat.heading);

    // ψ — where the boat lies relative to the way the waves are running. 0 = running dead
    // with them, ±π = punching straight into them. Every term below is a function of it,
    // which is why upwind/reaching/downwind need no separate code.
    const dot = hx * p.sx + hy * p.sy;                       // cos ψ
    const cross = hx * p.sy - hy * p.sx;                     // -sin ψ
    const cosPsi = Math.max(-1, Math.min(1, dot));
    const sinPsi = Math.max(-1, Math.min(1, -cross));

    // 1. GRAVITY ALONG THE TRACK. Positive slope = the surface rises ahead of you, so you
    //    are climbing and it costs; negative = you are on the face and it pays.
    //
    //    NOT symmetric, and the asymmetry is the whole reward for getting on a wave. A hull
    //    running down a face has its bow lifted and its wetted area falling away — it is
    //    half-planing before the polar says it should be — while the same hull that has run to
    //    the bottom is deep, level, and pushing at the back of the next wave. Both are
    //    amplified by ALIGNMENT: full value when you are running with the waves, nothing at
    //    all when you are punching into them, where the term stays honestly symmetric.
    //
    //    THIS IS THE RIDE, and it is a cycle rather than a bonus. The crest lifts your stern,
    //    you bear away and the face throws you down it; you run out of wave at the bottom and
    //    the back of the one ahead stops you dead; you head up to climb out of the trough and
    //    to stop out-running the next crest, and it picks you up again.
    //
    //    ⚠️ Without the alignment gate this hands out free speed upwind, where a boat meets
    //    crests fastest and would collect the bonus several times a second.
    const alongSlope = f.gx * hx + f.gy * hy;
    const align = Math.max(0, cosPsi);
    const asym = alongSlope < 0 ? (1 + K.faceGain * align) : (1 + K.troughWall * align);
    const surfKt = -alongSlope * K.surfKtPerSlope * asym * (CFG.strength || 1);

    // 2. ORBITAL DRIFT. Applied to velocity, not to speed — the water is carrying the hull,
    //    which moves it over the ground without the log ever knowing.
    const driftX = f.ox * K.orbital;
    const driftY = f.oy * K.orbital;

    // 3. THE COUPLE. Sample the orbital push at bow and stern and take the difference in the
    //    ACROSS-hull direction: bow shoved one way while the stern goes the other is a
    //    rotation, and that is the whole of why a boat slews on a wave.
    //
    //    It vanishes when the wave runs straight up or down the hull's axis (nothing to
    //    differ across), and peaks beam-on — which is exactly the reported behaviour: dead
    //    downwind on the wave you are steady, and the further off its axis you get, the
    //    harder the stern is thrown. Downwind it is amplified: a lifted, surfing stern has
    //    far more leverage than a hull sitting level in a trough.
    const half = HULL_LEN * 0.5;
    const bow = sampleAt(boat.x + hx * half, boat.y + hy * half);
    const stern = sampleAt(boat.x - hx * half, boat.y - hy * half);
    const latBow = bow.ox * rx + bow.oy * ry;
    const latStern = stern.ox * rx + stern.oy * ry;
    const surf01 = Math.max(0, Math.min(1, -alongSlope / REF_POWER));
    const yawRate = ((latBow - latStern) / HULL_LEN)
        * K.yaw * (1 + K.yawSurfBoost * surf01) * (CFG.strength || 1);

    // 4. PUNCHING THROUGH. Upwind only, and it is the one term that is not symmetric —
    //    because driving a hull INTO a wave face is not the same event as being lifted over
    //    it from behind.
    //
    //    ⚠️ THIS IS THE PINCH MECHANIC, and it is deliberately the only place a stat-free
    //    steering choice changes the boat's speed. Sailors punching upwind in a seaway report
    //    that bearing off to fill the jib does not work — "no matter how far we bore off the
    //    jib would never fill; the result was a loss of height with no forward gain". So
    //    footing pays a cost that pointing does not, and the polar's usual reward for cracking
    //    off is cancelled by it.
    const twaDeg = Math.abs(norm(boat.heading - windFrom)) * 180 / Math.PI;
    const upwind = twaDeg < 80 ? Math.min(1, (80 - twaDeg) / 25) : 0;
    const foot01 = Math.max(0, Math.min(1, (twaDeg - BEAT_DEG) / FOOT_SPAN_DEG));
    const poundMul = 1 - POWER * upwind * (K.poundBase + K.poundFoot * foot01);

    // 5. THE SET TO LEEWARD. A steady push the way the waves are going — the sea lifting you
    //    from the side and putting you down half a boatlength to leeward, which is the thing
    //    ocean sailors notice and cannot see on the log.
    //
    //    It scales with |sin ψ| ALONE: how much of your side you are showing the wave. That
    //    is the second half of the pinch mechanic — point high and the sea has less of you to
    //    push, crack off and it has more — and it costs you ground rather than speed, so it
    //    is invisible until you look at where you actually got to.
    //
    //    ⚠️ Whether the waves are forward of the beam is a GATE, not a multiplier. It was a
    //    multiplier first, and cos·sin is flat between 34° and 60° — the two factors cancelled
    //    almost exactly across the entire upwind range, so footing cost the same as pointing
    //    and the mechanic did not exist. Measured: 0.52 kt of set at 34° against 0.59 at 60°.
    const gate = Math.max(0, Math.min(1, (-cosPsi - 0.05) / 0.30));
    const setU = K.setKt * KT_TO_U * POWER * (gate * gate * (3 - 2 * gate)) * Math.abs(sinPsi);

    const out = {
        surfKt,                                   // knots/second along the track
        driftX: driftX + p.sx * setU,             // units/second, over the ground
        driftY: driftY + p.sy * setU,
        yawRate,                                  // radians/second
        poundMul,                                 // multiplies target speed
        surf01,                                   // 0..1, for the HUD and the render
        elev: f.elev,
        // Are we running with them or punching into them? Read by the HUD cue only.
        withWave: cosPsi > 0.3
    };
    boat.swell = out;
    return out;
}

// ── RENDER ─────────────────────────────────────────────────────────────────
// Called inside the world transform, under everything else on the water. The swell is the
// big slow structure; the wind-wave crests are the fine texture that lives ON it, so this
// draws under them and never competes with their line quality.
//
// FACETED, NOT SMOOTH. The style guide's third pillar is "clean cel-shaded / faceted
// rendering — crisp or softly controlled edges; this style never blurs", and a smooth
// gradient across the wave was the one thing on screen breaking it. Each wavelength is a
// short stack of flat tonal bands whose boundaries are jagged polylines, which is how a
// painted sea reads from above: planes of water catching the light at slightly different
// angles, with a bright ridge where the crest turns over.
//
// Only the crests actually in view are touched — about six per train — so this costs far
// less than the full-screen pattern passes the water renderer already pays for.

// Profile of one wavelength, trough to trough with the crest at 0.5. Flat steps, not a ramp.
const BANDS = [
    [0.00, 0.22, 0, 0.20],   // trough behind: the deep tone
    [0.22, 0.38, 0, 0.09],
    [0.38, 0.47, 1, 0.13],   // the face coming up to the crest
    [0.47, 0.53, 1, 0.30],   // the lit ridge itself
    [0.53, 0.66, 1, 0.09],   // back of the crest, falling away
    [0.66, 1.00, 0, 0.17]    // trough ahead
];

function draw(ctx, state) {
    if (!TRAINS.length || !state) return;
    const cam = state.camera;
    const R = Math.hypot(ctx.canvas.width, ctx.canvas.height) * 0.5 + 220;

    const pal = (window.WATER_CONFIG || {});
    const rgb = (hex) => {
        const h = String(hex).replace('#', '');
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    const TONE = [rgb(pal.deepColor || '#1e3a8a'), rgb(pal.shallowColor || '#0ea5e9')];
    for (let i = 0; i < TRAINS.length; i++) {
        const t = TRAINS[i];
        // Secondary trains are scenery: present, readable as a cross sea, never loud enough
        // to confuse which way "the waves" are running.
        const w8 = i === 0 ? 1 : 0.42;

        ctx.save();
        ctx.translate(cam.x, cam.y);
        ctx.rotate(t.theta);
        // After this rotate, local -Y is the direction the wave travels, so crests are
        // horizontal lines of constant local y and the profile varies along y alone.
        const sCam = cam.x * t.sx + cam.y * t.sy;
        const phaseOff = (t.w * TIME - t.phase0) / (Math.PI * 2);
        const nLo = Math.ceil((sCam - R - t.L) * t.k / (Math.PI * 2) - phaseOff);
        const nHi = nLo + Math.ceil((2 * R + 2 * t.L) / t.L);

        // Facet nodes about a boat-length and a half apart: fine enough to read as broken
        // water, coarse enough that every edge is a straight plane rather than a curve.
        const STEP = Math.max(90, t.L * 0.10);
        const NODES = Math.ceil((R * 2) / STEP) + 2;
        const amp = t.L * 0.055;

        for (let n = nLo; n <= nHi; n++) {
            const yc = sCam - ((Math.PI * 2 * n) / t.k) - (phaseOff * Math.PI * 2) / t.k;
            if (yc < -R - t.L || yc > R + t.L) continue;

            // One jagged boundary per profile fraction, built once and SHARED by the bands on
            // either side of it — that is what keeps the facets watertight instead of leaving
            // hairline gaps between them.
            const edges = {};
            const edgeAt = (u) => {
                const key = (u * 1000) | 0;
                if (edges[key]) return edges[key];
                const pts = new Array(NODES);
                for (let q = 0; q < NODES; q++) {
                    // Deterministic value noise: never RNG — the render must not touch the
                    // seeded stream, and a crest has to keep its shape as it travels.
                    let h = (((n * 374761393) ^ (q * 668265263) ^ (key * 2246822519)) >>> 0);
                    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
                    const j = ((h >>> 8) / 8388608) - 1;                 // -1..1
                    pts[q] = [-R + q * STEP, yc + (u - 0.5) * t.L + j * amp];
                }
                edges[key] = pts;
                return pts;
            };

            for (const [u0, u1, tone, a0] of BANDS) {
                const top = edgeAt(u0), bot = edgeAt(u1);
                const C = TONE[tone];
                ctx.fillStyle = `rgba(${C[0]},${C[1]},${C[2]},${(a0 * w8).toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(top[0][0], top[0][1]);
                for (let q = 1; q < NODES; q++) ctx.lineTo(top[q][0], top[q][1]);
                for (let q = NODES - 1; q >= 0; q--) ctx.lineTo(bot[q][0], bot[q][1]);
                ctx.closePath();
                ctx.fill();
            }

            // THE RIDGE, in angular shards rather than one ruled line. A swell crest from
            // above is a broken chain of lit planes, not a drawn edge, and the breaks are
            // what stop a long crest reading as a graphics artifact.
            const ridge = edgeAt(0.50);
            let s2 = ((n * 2654435761) >>> 0) || 1;
            const pr = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
            const C1 = TONE[1];
            for (let q = 0; q < NODES - 2; q++) {
                if (pr() > 0.72) continue;                     // broken, not continuous
                const run = 1 + (pr() < 0.45 ? 1 : 0);
                const q2 = Math.min(NODES - 1, q + run);
                const th = (2 + pr() * 5) * w8;
                ctx.fillStyle = `rgba(${C1[0]},${C1[1]},${C1[2]},${(0.34 * w8 * (0.55 + pr() * 0.45)).toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(ridge[q][0], ridge[q][1] - th);
                ctx.lineTo(ridge[q2][0], ridge[q2][1] - th);
                ctx.lineTo(ridge[q2][0], ridge[q2][1] + th);
                ctx.lineTo(ridge[q][0], ridge[q][1] + th);
                ctx.closePath();
                ctx.fill();
                q = q2 - 1;
            }

            // GLINTS. Not whitecaps — a swell does not break, it heaves, and the moment
            // this layer draws breaking water it stops reading as a swell and starts reading
            // as surf. What you actually see from above is sun catching the odd facet where
            // the crest turns over: tiny, bright, and gone.
            if (i === 0) {
                ctx.strokeStyle = 'rgba(255,255,255,0.42)';
                ctx.lineWidth = 2.2;
                ctx.lineCap = 'round';
                for (let q = 1; q < NODES - 1; q++) {
                    if (pr() > 0.09) continue;
                    const p0 = ridge[q];
                    ctx.beginPath();
                    ctx.moveTo(p0[0], p0[1] - 2);
                    ctx.lineTo(p0[0] + STEP * (0.16 + pr() * 0.22), p0[1] - 2 + (pr() - 0.5) * 4);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
    }
}

// HOW HIGH THIS POINT IS ON THE SEA, as -1 in the trough to +1 on the crest. Read by the
// boat renderer: a hull on a crest is that much nearer the camera than one in a trough, and
// scaling it very slightly is the cheapest possible way to show a fleet breathing with the
// swell. It is parallax, so it belongs to the picture and touches no physics.
function lift(x, y) {
    if (!TRAINS.length || !AMP_TOTAL) return 0;
    // The elevation you SEE, so it ignores `force` — a boat sitting on a crest is up there
    // whether or not that crest is one the physics leans on.
    let e = 0;
    for (let i = 0; i < TRAINS.length; i++) {
        const t = TRAINS[i];
        e += t.A * Math.cos(t.k * (x * t.sx + y * t.sy) - t.w * TIME + t.phase0);
    }
    return Math.max(-1, Math.min(1, e / AMP_TOTAL));
}

// What the HUD needs to say. Surfing is a STATE a boat is in for a second or two, not an
// instantaneous sample, so it latches on and off the way PLANING does — a label that
// flickers at the wave frequency is unreadable and would just be noise beside the speedo.
function hud(boat) {
    if (!TRAINS.length || !boat || !boat.swell) return null;
    const s = boat.swell;
    const on = s.withWave && s.surf01 > 0.34;
    boat._surfHold = Math.max(0, (boat._surfHold || 0) + (on ? 0.06 : -0.03));
    if (boat._surfHold > 0.3) boat._surfHold = 0.3;
    return { surfing: boat._surfHold > 0.12, strength: s.surf01 };
}

window.Swell = {
    configure, active, update, trim, draw, hud, sampleAt, lift,
    // Read by the tuning harness in eval/, so the numbers in a report are the numbers the
    // game uses rather than a second copy of the formulas.
    debug: () => ({ trains: TRAINS.map(t => ({
        id: t.id, periodS: t.periodS, heightM: t.heightM,
        lengthU: Math.round(t.L), lengthM: Math.round(t.L / U_PER_M),
        celerityKt: +(t.c / KT_TO_U).toFixed(1), dirDeg: Math.round(((t.theta * 180 / Math.PI) % 360 + 360) % 360),
        maxSlope: +(t.A * t.k).toFixed(4), orbitalKt: +(t.A * t.w / KT_TO_U).toFixed(2)
    })), power: +POWER.toFixed(3), heightM: +(2 * AMP_TOTAL / U_PER_M).toFixed(2),
       heightFt: +(2 * AMP_TOTAL / U_PER_M * 3.281).toFixed(1), K })
};
})();
