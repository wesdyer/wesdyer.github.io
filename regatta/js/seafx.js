// SEA EFFECTS — the three things a big sea does that you can SEE but that the swell
// field alone does not draw: whitecaps, surfing spray, and the bow throwing water upwind.
//
// ⚠️ ONE VENUE, by construction rather than by a name test. Every effect here is gated on
// something only a sea state produces — a wind-sea crest line, `boat.swell.surf01`, a bow
// falling into a trough — and `boat.swell` is null and `Swell.active()` is false on the
// nine venues with no `swell` block. There is no `if (venue === 'ocean')` anywhere in this
// file and there must never be one: the effects belong to the MECHANIC, so a second ocean
// venue gets them for free and Clubhouse Point cannot inherit them by accident.
//
// ⚠️ AND IT NEVER TOUCHES THE SIMULATION. Its own PRNG (see `rnd`), its own particle
// arrays, and per-boat bookkeeping in a WeakMap rather than on the boat objects — so
// nothing here can perturb a seeded race, and the eval history stays comparable. It reads
// `boat.swell`, `boat.heading`, `boat.speed` and the wind field; it writes nothing back.
//
// ── WHAT THE RESEARCH SAYS, AND WHERE EACH FINDING LANDS ────────────────────
//
// 1. WHITECAPS — `updateCaps` / `drawCaps`
//    A swell does not break; it heaves. What breaks in a fresh breeze is the short WIND SEA
//    riding on it, which is why swell.js's GLINTS note is right to refuse whitecaps on a
//    swell crest and why this layer asks `Swell.windSea()` for the SHORT train instead.
//    The observations that set the numbers:
//      · The first scattered whitecaps appear at Beaufort 3 (7-10 kt); they are "numerous"
//        by Force 4 (11-16) and "many" by Force 5 (17-21). Bluewater Bonanza blows 18 ± 4,
//        so its baseline is squarely "many, with some spray" — CAP_WIND_MIN/FULL.
//      · Aerial surveys (Ross & Cardone 1974; the 1999 North Carolina flights) found total
//        breaking crest length scaling with the CUBE of wind speed. That exponent is
//        CAP_EXP, and it is the reason this layer doubles as a pressure cue: a 22-knot puff
//        carries roughly six times the whitecaps of a 14-knot lull, which is a real number
//        and not a gameplay flourish.
//      · A whitecap has two stages. Stage A is active breaking — bright, hard-edged, and
//        it RUNS WITH THE CREST at the wave's own celerity, over in about a second. Stage B
//        is the maturing foam left behind: dull, "streaky", elongated downwind, and good
//        for several seconds more. Measured decay times run 0.2-10.4 s with an area-weighted
//        mean of 1.4-4.8 s. CAP_BREAK_S and CAP_FOAM_S sit inside that.
//      · The crest sails out from under the foam, because the wave form travels and the
//        water does not. That is the whole reason stage B detaches (CAP_DETACH_S) and it is
//        what makes the layer read as a sea rather than as a texture stuck to the crests.
//
// 2. SURFING SPRAY — `spawnSurfSheet` / `drawWings`
//    Planing-hull literature splits the bow flow into MAIN SPRAY and, at speed, a thin
//    outward sheet called WHISKER SPRAY that fans off the spray root — measured at 10-15%
//    of total resistance, so it is a lot of water.
//    Drawn as a WEDGE off each bow, opening aft, plus the droplets it tears into. A
//    photograph shows both and neither alone reads as speed: the sheet gives the shape, the
//    droplets give the tearing. From above the pair is the "bone in her teeth", the oldest
//    description in the language of a hull being driven hard.
//
// 3. THE BOW UPWIND — `detectImpacts`
//    Two moments, half a wave apart, and both are things sailors describe rather than
//    things invented here:
//      · THE SLAM. The bow crosses the crest, is left unsupported over the back of the
//        wave, falls, and meets rising water in the trough. Racing yachts measure over 3g
//        doing this. It fires at the trough crossing and throws a compact burst.
//      · THE PUSH-THROUGH. Immediately after, the stem drives into the face of the next
//        wave and throws a sheet that the apparent wind lays flat to LEEWARD and aft. A
//        bow with a full entry "will slam into waves, often throwing a lot of spray and
//        green water ahead of it".
//    ⚠️ NEITHER IS GATED ON "AM I SAILING UPWIND". Severity comes from `fall`, the bow's
//    vertical speed, which is the swell amplitude times the ENCOUNTER rate — and the
//    encounter rate already knows the answer. Punching into a 15.5-kt train at 8 kt gives
//    ~15 units/s of fall; running with it at 12 kt gives 2.3 and the effect switches itself
//    off. Beam-on lands in between and slams gently, which is correct and which a
//    hand-written upwind test would have got wrong. Same argument swell.js makes for its
//    four physical terms: let the geometry decide, do not enumerate the points of sail.
//    It also means the spray SHOWS THE PINCH MECHANIC — foot off and the encounter rate
//    rises and the boat visibly gets wetter, which is the cost `poundFoot` charges.
(function () {

// 5 units = 1 metre, and units/second = knots x 15. Every size in this file is quoted in
// metres in its comment so the numbers can be checked against a photograph.
const KT_TO_U = 15;                       // units/second per knot
const TAU = Math.PI * 2;
const BOW = 25;                           // units from centre to stem — HULL_LOCALS' y = -25

// ── THE EFFECTS PRNG ───────────────────────────────────────────────────────
// Its own stream, for exactly the reason script.js grew `fxRand`: particle spawning runs
// inside update(), so drawing from the simulation's RNG would make the sim depend on how
// many droplets happened to be emitted — which depends on the camera, on the frame rate,
// and on nothing that ought to touch a race. Not reseeded per race; visual variety across
// races is fine and it can no longer reach anything that is scored.
let _s = 0x5EAF0A11 >>> 0;
function rnd() {
    _s = (_s + 0x6D2B79F5) >>> 0;
    let t = _s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const clamp01 = (v) => v < 0 ? 0 : (v > 1 ? 1 : v);
// ⚠️ MODULO, NOT A while LOOP. The angle this normalises is a raw wave phase, which grows
// without bound: w*TIME alone passes 300 radians in a five-minute race, and a position term
// of k*(x·ŝ) adds another hundred out at the arena rim. The usual `while (a > PI) a -= TAU`
// would then spin seventy times per boat per frame, and worse each minute the race ran.
const norm = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

// ── WHITECAPS ──────────────────────────────────────────────────────────────
const CAP_WIND_MIN = 7;      // knots — Beaufort 3, where crests first break
const CAP_WIND_FULL = 20;    // knots — Beaufort 5, "many whitecaps"
const CAP_EXP = 3;           // coverage ~ U^3, measured from the air
// ⚠️ A DENSITY, NOT A COUNT. Spawning happens over the view disc, so a flat rate would
// thin the sea out on a big monitor and crowd it on a small one — the layer has to look the
// same on both. Attempts per second per million square units; the disc's area does the rest.
const CAP_ATTEMPTS = 26;
const CAP_BREAK_S = 1.00;    // stage A — active breaking, bright, runs with the crest
const CAP_DETACH_S = 0.50;   // how long the breaker takes to let go of the wave
const CAP_FOAM_S = 2.30;     // stage B — the maturing foam patch, dull and streaky
const CAP_BAND = 0.42;       // how far off the crest line a break may sit, in wavelengths
const CAP_LEN_MIN = 44;      // units — 9 m
const CAP_LEN_MAX = 96;      // units — 19 m
// HALF-width across the crest, as a fraction of length. A real whitecap is a long thin
// thing — 5:1 or finer — and the first cut drew it at 3:1, which is a floe, not foam.
const CAP_ASPECT = 0.115;
const CAP_SEGS = 3;          // torn patches the break is drawn from — see drawCaps
const CAP_SWELL_BIAS = 0.45; // how much more readily the wind sea breaks on a swell crest
const CAP_WIND_DRIFT = 0.03; // foam is dragged downwind at ~3% of the wind
// Spawn radius, in frame-corner distances. Caps have to exist a little outside the view so
// the leading edge is never bare as the camera pans, but only a little: the disc's AREA is
// what gets spawned into, so every 10% of radius is a 21% bill for water nobody looks at.
const CAP_SPAWN_PAD = 1.10;
const CAP_MAX = 320;         // hard ceiling on live caps, so a squall cannot flood the layer

// ── SPRAY ──────────────────────────────────────────────────────────────────
// One integrator for every droplet in the file: it loses its own velocity and takes up the
// air's. That single exponential is what lays the upwind sheet flat to leeward and what
// leaves the surfing sheet standing while the boat runs out from under it.
const SPRAY_DRAG = 2.6;      // per second
const SPRAY_WIND = 0.30;     // fraction of the true wind a droplet ends up carried at
const SPRAY_MAX = 460;

const SURF_ON = 0.30;        // surf01 where the sheet starts — the HUD calls it surfing at 0.34
const SURF_SPAN = 0.45;      // ...and full sheet this much above it
const SURF_RATE = 56;        // droplets per second at a full ride
const PUNCH_RATE = 95;       // droplets per second at a full push-through
const SLAM_FALL_MIN = 6;     // units/s of bow fall below which nothing is thrown
const SLAM_FALL_FULL = 20;   // ...and at which the burst is at full size

let caps = [];
let spray = [];
let capAcc = 0;
let viewR = 900;             // corner distance, cached from draw(); update() has no canvas to ask
const track = new WeakMap(); // per-boat bookkeeping, off the boat objects entirely

function reset() { caps.length = 0; spray.length = 0; capAcc = 0; shoalSites = null; shoalSrc = null; }

// White by day. A swell venue that also authored `palette.night` would want the wash to be
// bioluminescent for the same reason the wakes are — it is the same disturbed water — and
// BIO_COLOR is only reached when nightAmt() says there is a night to be in.
function foamColor() {
    return (window.nightAmt && window.nightAmt() > 0) ? BIO_COLOR : '#ffffff';
}

// The wind where a mark sits, as a velocity in units/second pointing the way it BLOWS.
// `state.wind.direction` is the direction wind comes FROM, the game's convention.
function windVec(x, y) {
    const w = window.getWindAt ? window.getWindAt(x, y) : null;
    if (!w) return { x: 0, y: 0, kt: 0 };
    const u = w.speed * KT_TO_U;
    return { x: -Math.sin(w.direction) * u, y: Math.cos(w.direction) * u, kt: w.speed };
}

// ── WHITECAPS: WHERE ONE IS BORN ───────────────────────────────────────────
// Rejection sampling with the expensive axis removed. A uniform point in the view is
// SNAPPED onto the nearest wind-sea crest — the phase field is analytic, so this is one
// subtraction rather than a search — and then jittered along the travel direction so the
// result is a BAND of broken water rather than a ruled line. Only the two probabilistic
// gates are left to reject on: how much wind there is here (cubed), and whether this bit of
// crest is riding high on the swell.
//
// Biased slightly FORWARD of the crest, because that is where a wave breaks: the face it is
// travelling into is the steep side. Phase is positive ahead of the crest, so the jitter
// window is asymmetric about zero rather than centred on it.
function spawnCap(state) {
    const sea = window.Swell.windSea();
    if (!sea) return;
    const cam = state.camera;

    const a = rnd() * TAU, r = Math.sqrt(rnd()) * viewR * CAP_SPAWN_PAD;
    let x = cam.x + Math.cos(a) * r;
    let y = cam.y + Math.sin(a) * r;

    // Snap onto the nearest crest of the short train, then band it.
    const d = window.Swell.phaseAt(sea, x, y) / TAU;
    const off = (d - Math.round(d)) * sea.L;
    const j = (rnd() * 0.85 - 0.30) * CAP_BAND * sea.L;
    x += sea.sx * (j - off);
    y += sea.sy * (j - off);

    // A whitecap is a mark on WATER, the same rule the wind streaks are held to. Ocean
    // shoals are submerged and break MORE readily, not less, so only real land is excluded.
    if (window.inMaskWater && !window.inMaskWater(x, y)) return;

    const wind = windVec(x, y);
    const cov = clamp01((wind.kt - CAP_WIND_MIN) / (CAP_WIND_FULL - CAP_WIND_MIN));
    if (cov <= 0) return;
    // Riding high on the swell is not a hard gate — a fresh breeze breaks in the troughs
    // too — it is a lean, and CAP_SWELL_BIAS is how much of one.
    const lift = window.Swell.lift(x, y);
    const p = Math.pow(cov, CAP_EXP) * (1 - CAP_SWELL_BIAS + CAP_SWELL_BIAS * (lift * 0.5 + 0.5));
    if (rnd() > p) return;

    // Along the crest, which is across the way the train travels, with enough angular
    // scatter that no two caps sit parallel. Real breaking crests are never a comb.
    const ja = (rnd() - 0.5) * 0.70;                 // ±20°
    const ca = Math.cos(ja), sa = Math.sin(ja);
    const cx0 = -sea.sy, cy0 = sea.sx;
    const len = CAP_LEN_MIN + rnd() * (CAP_LEN_MAX - CAP_LEN_MIN);

    caps.push({
        x, y,
        cx: cx0 * ca - cy0 * sa, cy: cx0 * sa + cy0 * ca,   // along the crest
        sx: sea.sx, sy: sea.sy,                             // the way the wave runs
        c: sea.c,                                           // ...and how fast, units/s
        len, wid: len * CAP_ASPECT * (0.75 + rnd() * 0.5),
        // Foam drift, fixed at birth: a cap lives four seconds and travels a few boat
        // lengths, over which the breeze does not meaningfully change. Sampling the field
        // per cap per frame would be a hundred getWindAt calls to move a mark 30 units.
        dx: wind.x * CAP_WIND_DRIFT, dy: wind.y * CAP_WIND_DRIFT,
        t: 0, seed: rnd() * 1000, bright: 0.74 + rnd() * 0.26
    });
}

function updateCaps(dt, state) {
    const sea = window.Swell.windSea();
    if (sea) {
        const areaMu = (Math.PI * (viewR * CAP_SPAWN_PAD) ** 2) / 1e6;
        capAcc += CAP_ATTEMPTS * areaMu * dt;
        // The accumulator is drained whole and the BURST is what gets bounded, so a long
        // hitch cannot fire fifty spawns in one frame and cannot bank them up either.
        let n = Math.floor(capAcc);
        capAcc -= n;
        n = Math.min(n, 14);
        while (n-- > 0 && caps.length < CAP_MAX) spawnCap(state);
    }

    const cam = state.camera, cullR2 = (viewR * (CAP_SPAWN_PAD + 0.25)) ** 2;
    const total = CAP_BREAK_S + CAP_FOAM_S;
    for (let i = caps.length - 1; i >= 0; i--) {
        const c = caps[i];
        c.t += dt;
        if (c.t > total) { caps.splice(i, 1); continue; }
        // A BREAKER RUNS WITH ITS WAVE, THEN IS LEFT BEHIND. Stage A travels at the train's
        // own celerity, which is the surge you see when a crest tumbles; then the ride
        // decays away over CAP_DETACH_S and the patch is left sitting in the water with only
        // the wind on it, while the crest sails on. That release IS the effect — a foam mark
        // welded to a crest reads as a decal on the wave instead of as something the wave did.
        const ride = c.t <= CAP_BREAK_S ? 1 : Math.exp(-(c.t - CAP_BREAK_S) / CAP_DETACH_S);
        const v = c.c * ride;
        c.x += (c.sx * v + c.dx) * dt;
        c.y += (c.sy * v + c.dy) * dt;
        const ddx = c.x - cam.x, ddy = c.y - cam.y;
        if (ddx * ddx + ddy * ddy > cullR2) caps.splice(i, 1);
    }
}

// ── SPRAY: ONE INTEGRATOR ──────────────────────────────────────────────────
function addSpray(x, y, vx, vy, life, w, kind, wind) {
    if (spray.length >= SPRAY_MAX) return;
    spray.push({
        x, y, vx, vy, t: 0, life, w, kind,
        wx: wind.x * SPRAY_WIND, wy: wind.y * SPRAY_WIND,
        seed: rnd()
    });
}

function updateSpray(dt) {
    // Exponential relaxation onto the air's velocity, integrated exactly rather than by
    // Euler steps, so the look does not change with the frame rate.
    const g = 1 - Math.exp(-SPRAY_DRAG * dt);
    for (let i = spray.length - 1; i >= 0; i--) {
        const p = spray[i];
        p.t += dt;
        if (p.t >= p.life) { spray.splice(i, 1); continue; }
        p.vx += (p.wx - p.vx) * g;
        p.vy += (p.wy - p.vy) * g;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
    }
}

// ── WHAT ONE BOAT THROWS ───────────────────────────────────────────────────
// Local coordinates match HULL_LOCALS and the nav-light helper: +x to starboard, +y AFT,
// stem at y = -25, transom at y = +30.
function toWorld(boat, lx, ly, s, c) {
    return { x: boat.x + (lx * c - ly * s), y: boat.y + (lx * s + ly * c) };
}

// THE DROPLETS THE WHISKER SHEET TEARS INTO. Born anywhere along the sheet's own outer edge
// — the same profile drawWings uses, taper included — and thrown OUT and slightly FORWARD.
// It is the boat running out from under them that makes them sweep aft on screen; nothing
// here aims them backwards, and that is why they read as speed rather than as exhaust.
function spawnSurfSheet(boat, drive, ups, s, c, wind) {
    const side = rnd() < 0.5 ? -1 : 1;
    // ON the sheet's outer edge, not on the topsides — these droplets are the sheet tearing
    // up, so they have to start where it already is or they read as a second, closer effect.
    const u = rnd();
    const e = clamp01((u - 0.72) / 0.28);
    const taper = 1 - 0.45 * (e * e * (3 - 2 * e));
    const lx = side * ((6 + (16 + 44 * drive) * Math.pow(u, 0.42)) * taper + rnd() * 6);
    const ly = -24 + u * (30 + 18 * drive);
    const q = toWorld(boat, lx, ly, s, c);
    const out = ups * (0.55 + rnd() * 0.50) * side;
    const fwd = ups * (0.08 + rnd() * 0.26);
    addSpray(
        q.x, q.y,
        c * out + s * fwd,                    // right = (cos h, sin h), forward = (sin h, -cos h)
        s * out - c * fwd,
        0.30 + rnd() * 0.28,
        (2.4 + rnd() * 3.4) * (0.6 + 0.4 * drive),
        0, wind
    );
}

// THE PUSH-THROUGH SHEET. Off the stem, and weighted to LEEWARD: the apparent wind is well
// forward when you are beating, so the water the bow throws goes over the lee rail and aft.
// The 70/30 split is the visible asymmetry; SPRAY_WIND then carries it away downwind.
function spawnPunchSheet(boat, hard, ups, s, c, wind, leeSide) {
    const side = rnd() < 0.70 ? leeSide : -leeSide;
    const lx = side * (3 + rnd() * 10);
    const ly = -27 + rnd() * 9;
    const q = toWorld(boat, lx, ly, s, c);
    const out = (ups * (0.45 + rnd() * 0.45) + 40) * side;
    const fwd = ups * (0.30 + rnd() * 0.45) + 25;
    addSpray(
        q.x, q.y,
        c * out + s * fwd,
        s * out - c * fwd,
        0.46 + rnd() * 0.36,
        (3.0 + rnd() * 4.0) * (0.55 + 0.45 * hard),
        0, wind
    );
}

// THE SLAM. One burst, thrown as a fan about dead ahead — a falling bow meeting rising
// water puts the sheet out sideways and forward, not backwards. A few slow, fat droplets go
// in with the fast ones: those are the crown that stands at the stem for a moment, and
// without them the burst reads as a starburst of dashes instead of as a column of water.
function spawnSlam(boat, sev, ups, s, c, wind) {
    const n = 10 + Math.round(30 * sev);
    for (let i = 0; i < n; i++) {
        const side = rnd() < 0.5 ? -1 : 1;
        const lx = side * rnd() * 11;
        const ly = -27 + rnd() * 7;
        const q = toWorld(boat, lx, ly, s, c);
        const crown = rnd() < 0.28;
        const mag = crown ? (30 + rnd() * 40) : (ups * (0.45 + rnd() * 0.85) + 55) * (0.5 + sev * 0.5);
        const ang = (rnd() - 0.5) * 2.4;                  // ±70° about dead ahead
        const out = Math.sin(ang) * mag;
        const fwd = Math.cos(ang) * mag;
        addSpray(
            q.x, q.y,
            c * out + s * fwd,
            s * out - c * fwd,
            (crown ? 0.70 : 0.54) + rnd() * 0.42,
            (crown ? 6.2 : 4.1) + rnd() * 4.6,
            1, wind
        );
    }
}

// ── THE DETECTOR ───────────────────────────────────────────────────────────
// Everything upwind keys off ONE number: where the BOW sits in the primary train's cycle,
// and how fast that is changing.
//
// ⚠️ THE PHASE RATE IS ANALYTIC, NOT A DIFFERENCE OF SAMPLES. dφ/dt = k·(v·ŝ) - ω falls
// straight out of the field, so it is exact, free of frame-rate noise, and — the part that
// matters — it is the ENCOUNTER RATE, which is the physical quantity that decides how hard
// a bow lands. A numerical derivative of cos(φ) would have been zero at exactly the moment
// the slam fires, which is the one moment it is needed.
//
// ⚠️ AND IT USES THE PRIMARY TRAIN ALONE. Bow elevation summed over both trains has the
// wind sea rippling through it at roughly 40% of the total rate — enough to cross the
// trough twice per swell and fire two slams a wave. "Going over a swell" means the big one.
function detectImpacts(boat, tr, dt, ups, s, c, wind, leeSide) {
    const p = window.Swell.primary();
    if (!p) return;

    const bx = boat.x + s * BOW, by = boat.y - c * BOW;
    const ph = window.Swell.phaseAt(p, bx, by);
    // v·ŝ — how fast the boat is closing on, or running from, the wave train.
    const vs = (boat.velocity ? (boat.velocity.x * p.sx + boat.velocity.y * p.sy) * 60 : 0);
    const dphdt = p.k * vs - p.w;

    // Bow vertical speed at the steepest part of the cycle: amplitude times encounter rate.
    // This is the severity of everything below, and it is why no point-of-sail test appears
    // anywhere in this function — see the header.
    const kn = boat.speed * 4;
    const fall = p.A * Math.abs(dphdt) * clamp01((kn - 2.5) / 3);
    const sev = clamp01((fall - SLAM_FALL_MIN) / (SLAM_FALL_FULL - SLAM_FALL_MIN));

    // q is the signed distance from the TROUGH, in radians: 0 at the bottom, ±π on the crest.
    const q = norm(ph - Math.PI);
    if (tr.q !== null && sev > 0.02) {
        const crossed = (tr.q > 0) !== (q > 0);
        // Guard the wrap at ±π: a crest crossing also flips the sign of q, and it is not a
        // slam. A genuine trough crossing moves q by a small step; the wrap moves it by ~2π.
        if (crossed && Math.abs(q - tr.q) < 1.5) spawnSlam(boat, sev, ups, s, c, wind);
    }
    tr.q = q;

    // THE PUSH-THROUGH WINDOW: bow below mean level and rising, which is the stem driving up
    // into the face it has just landed in front of. d(cos φ)/dt = -sin(φ)·dφ/dt.
    const e = Math.cos(ph);
    const rising = (-Math.sin(ph) * dphdt) > 0;
    if (e < -0.10 && rising && sev > 0.05) {
        const hard = sev * clamp01((-e - 0.10) / 0.55 + 0.35);
        tr.punchAcc += PUNCH_RATE * hard * dt;
        let n = Math.floor(tr.punchAcc);
        tr.punchAcc -= n;
        n = Math.min(n, 5);
        while (n-- > 0) spawnPunchSheet(boat, hard, ups, s, c, wind, leeSide);
    } else {
        tr.punchAcc = 0;
    }
}

function updateBoats(dt, state) {
    // ⚠️ ONLY BOATS THE CAMERA CAN SEE. Not an optimisation — a correctness fix. The spray
    // array has a ceiling, and a fleet of ten all pounding upwind off-screen would fill it
    // and STARVE the one boat being watched. Spray from a hull nobody can see is not spray.
    const cam = state.camera, spawnR2 = (viewR * 1.15) ** 2;
    for (const boat of state.boats) {
        const sw = boat.swell;
        if (!sw) continue;
        if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
        const cdx = boat.x - cam.x, cdy = boat.y - cam.y;
        if (cdx * cdx + cdy * cdy > spawnR2) { track.delete(boat); continue; }

        let tr = track.get(boat);
        if (!tr) { tr = { surf: 0, surfAcc: 0, punchAcc: 0, q: null }; track.set(boat, tr); }

        const h = boat.heading;
        const s = Math.sin(h), c = Math.cos(h);
        const ups = boat.speed * 60;                  // units/second
        const kn = boat.speed * 4;
        const wind = windVec(boat.x, boat.y);

        // Which side is leeward: the side the wind is blowing towards. Boat right is
        // (cos h, sin h), so the sign of its dot with the wind vector is the answer.
        const leeSide = (c * wind.x + s * wind.y) >= 0 ? 1 : -1;

        // ── 1. SURFING ──────────────────────────────────────────────────────
        // Smoothed, because surf01 swings at the wave frequency and a sheet that strobes
        // with it is noise. Same reason Swell.hud latches its SURFING label.
        const raw = (sw.cosPsi > 0.25 ? clamp01((sw.surf01 - SURF_ON) / SURF_SPAN) : 0)
                  * clamp01((kn - 6) / 5);
        tr.surf += (raw - tr.surf) * Math.min(1, dt * 5);
        if (tr.surf > 0.04 && !boat.raceState.finished) {
            // Squared: the droplets are the tearing at the top of a ride, not a constant
            // dribble whenever the boat is nose-down. The SHEET (drawWings) carries the
            // low end on its own.
            tr.surfAcc += SURF_RATE * tr.surf * tr.surf * dt;
            let n = Math.floor(tr.surfAcc);
            tr.surfAcc -= n;
            n = Math.min(n, 6);
            while (n-- > 0) spawnSurfSheet(boat, tr.surf, ups, s, c, wind);
        } else {
            tr.surfAcc = 0;
        }

        // ── 2 & 3. THE BOW ──────────────────────────────────────────────────
        if (!boat.raceState.finished) detectImpacts(boat, tr, dt, ups, s, c, wind, leeSide);
    }
}

// ── BREAKING OVER A BAR ────────────────────────────────────────────────────
// The effect race-view.md §5 records as missing: "Breaking water over a shoal is a separate
// effect, unbuilt." It is separate for a good reason. The shore surf in script.js spawns
// foam that runs UP a beach and dies at a waterline, and a submerged bar has no waterline —
// ringing one with breakers draws in the coastline the whole kind exists not to have.
//
// What a bar does instead is trip the wave. The swell arrives in deep water, feels the sand,
// stands up and breaks along the bar's seaward contour, and the white water then carries
// forward across the bar and dies in the deeper water behind it. No run-in, no run-up: an
// offshore line that appears, sweeps inboard and is gone.
//
// ── WHERE THE CONTOUR IS, AND WHY IT MOVES WITH THE SWELL ──────────────────
// A wave breaks when the water shoals to about 1.3x its own height. This game has no
// bathymetry — but it has `shoalMulAt`, whose whole job is to say how shallow a bar is at a
// point, and its profile is exactly a smoothstep of the distance in from the ring:
//
//     shallowness(d) = smoothstep(d / feather)
//
// so the contour at any given shallowness is a FIXED OFFSET inside the ring, and it can be
// solved for once rather than searched for per frame (`invSmoothstep`). That gives the one
// thing worth having here for free: a bigger swell trips in less shallow water, so it breaks
// FURTHER OUT on the bar, and a small one washes over the outer sand and breaks near the
// middle. Same bar, different day, and you can see which from the boat.
//
// ⚠️ SHALLOWNESS IS A DRAG FIELD BEING READ AS A DEPTH, and that is a proxy, not a
// measurement. It is defensible because it is the SAME number the speed model and the router
// use — what breaks is what slows you — but SHOAL_BREAK_REF is a tuned constant with metres
// on one side and a drag fraction on the other, and it should not be dressed up as γ = 0.78.
const SHOAL_BREAK_REF = 1.35;   // metres of swell that trips at mid-bar shallowness
const SHOAL_SITE_STEP = 72;     // units of contour between break sites
const SHOAL_WASH = 95;          // how far the white water carries across the bar, units
const SHOAL_LIFE = 0.42;        // fraction of the wave period the break is visible for
const SHOAL_MAX_ALPHA = 0.62;
// Refraction wraps some of the sea round onto the lee of a bar, the same as it does round a
// headland — matched to script.js's SURF_REFRACT_FLOOR so the two layers agree about how
// much of a swell gets round the back of something.
const SHOAL_REFRACT_FLOOR = 0.16;

// t such that smoothstep(t) = s. Closed form; no iteration, and exact at both ends.
const invSmoothstep = (s) => 0.5 - Math.sin(Math.asin(1 - 2 * clamp01(s)) / 3);

let shoalSites = null;          // built once per race, keyed off the island list identity
let shoalSrc = null;

// One pass over the bars, at the first frame that has both a swell and a course.
//
// ⚠️ THE OUTWARD NORMAL IS MEASURED, NOT DERIVED, for the reason surfOutwardSign records
// getting wrong twice: the shoelace sign depends on the winding AND on the y-axis
// direction. Here there is a better oracle than geometry anyway — step off the edge and ask
// the DEPTH FIELD which side is deep. The answer cannot be backwards, and it is the same
// field the break contour is solved against.
function buildShoalSites(state) {
    shoalSites = [];
    shoalSrc = state.course.islands;
    const VD = window.VenueDoc;
    if (!VD || typeof VD.shoalMul !== 'function') return;
    const sw = window.Swell.primary();
    if (!sw) return;

    // How shallow the water has to be for THIS swell to trip in it, and the offset in from
    // the ring that puts a site on that contour.
    const need = clamp01(SHOAL_BREAK_REF / Math.max(0.3, sw.heightM || 1));

    for (const isl of (state.course.islands || [])) {
        // Bars only. `paint` kinds (shallows, seagrass) are a depth STATEMENT with no drag
        // behind them — shoalMul is 1, so there is no contour to solve for and nothing that
        // would trip a wave. Reefs and dry land belong to the shore-surf pass in script.js.
        if (!isl.awash || isl.paint || isl.reef || !isl.shoalRings || !(isl.shoalMul < 1)) continue;
        const feather = isl.shoalFeather || 120;
        const inset = feather * invSmoothstep(need);
        if (!(inset > 0)) continue;

        for (const ring of isl.shoalRings) {
            if (!ring || ring.length < 3) continue;
            // Which way is out of this ring? Probe well inside the feather, where the field
            // has actually dropped, not a hair off the edge where both sides read 1.
            let sgn = 1;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const ax = ring[j][0], ay = ring[j][1], bx = ring[i][0], by = ring[i][1];
                const ex = bx - ax, ey = by - ay, L = Math.hypot(ex, ey);
                if (L < 8) continue;
                const mx = (ax + bx) / 2, my = (ay + by) / 2;
                const nx = ey / L, ny = -ex / L, pr = feather * 0.6;
                const a1 = VD.shoalMul(isl, mx + nx * pr, my + ny * pr);
                const a2 = VD.shoalMul(isl, mx - nx * pr, my - ny * pr);
                if (Math.abs(a1 - a2) < 0.02) continue;      // ambiguous here, try another edge
                sgn = a1 > a2 ? 1 : -1;                      // deeper side is outward
                break;
            }

            let carry = 0;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const ax = ring[j][0], ay = ring[j][1], bx = ring[i][0], by = ring[i][1];
                const ex = bx - ax, ey = by - ay, L = Math.hypot(ex, ey);
                if (L < 1) continue;
                const tx = ex / L, ty = ey / L;
                const nx = (ey / L) * sgn, ny = (-ex / L) * sgn;
                for (; carry < L; carry += SHOAL_SITE_STEP) {
                    const px = ax + tx * carry - nx * inset;
                    const py = ay + ty * carry - ny * inset;
                    // ⚠️ AND THEN ASK THE FIELD AGAIN. Offsetting a polygon inward is only
                    // valid where the shape is wider than the offset; on a thin neck or a
                    // tight concavity the offset point lands outside the bar, or inside a
                    // hole, and would hang a breaker over open water. One lookup rejects
                    // every one of those cases without a single geometric special case.
                    const m = VD.shoalMul(isl, px, py);
                    const shallow = (1 - m) / (1 - isl.shoalMul);
                    if (shallow < need * 0.75) continue;
                    shoalSites.push({ x: px, y: py, tx, ty, nx, ny, seed: rnd() });
                }
                carry -= L;
            }
        }
    }
}

function update(dt, state) {
    if (!window.Swell || !window.Swell.active() || !state) return;
    if (!(dt > 0)) return;
    // Geometry is fixed for the race, so the bars are solved once. Keyed on the island
    // ARRAY, not on a flag, so a new course rebuilds them without needing to be told.
    if (state.course && shoalSrc !== state.course.islands) buildShoalSites(state);
    updateCaps(dt, state);
    if (state.race && state.race.status !== 'waiting') updateBoats(dt, state);
    updateSpray(dt);
}

// ── DRAWING ────────────────────────────────────────────────────────────────
// Faceted and crisp throughout, per the style guide's third pillar: every mark in this file
// is a filled polygon or a stitched polyline, all with straight edges. Nothing here uses a
// gradient or a blur, and nothing is drawn above the fleet — the hull silhouette has to
// stay clean.

// ⚠️ THE HELPERS BELOW ARE HOISTED, and it is not style. drawCaps runs over ~150 caps every
// frame; three closures each would allocate 27,000 short-lived functions a second on the
// render path, which is a garbage-collection pause the sea does not need. `_k` and `_ctx`
// are the cap and canvas the helpers are currently pointing at.
let _k = null, _ctx = null, _jh = 0;
// Deterministic per-cap jitter — the same shape every frame, so a cap holds its outline as
// it travels instead of boiling.
const jr = () => { _jh = (Math.imul(_jh, 1664525) + 1013904223) >>> 0; return _jh / 4294967296; };
// The cap's own frame: `u` runs ALONG the crest, `v` across it the way the wave travels.
const put = (u, v) => _ctx.lineTo(_k.x + _k.cx * u + _k.sx * v, _k.y + _k.cy * u + _k.sy * v);
const start = (u, v) => _ctx.moveTo(_k.x + _k.cx * u + _k.sx * v, _k.y + _k.cy * u + _k.sy * v);

// A whitecap in its two stages.
function drawCaps(ctx, cam, cullR2) {
    _ctx = ctx;
    for (const k of caps) {
        const dx = k.x - cam.x, dy = k.y - cam.y;
        if (dx * dx + dy * dy > cullR2) continue;

        const inBreak = k.t <= CAP_BREAK_S;
        _k = k;
        _jh = ((k.seed * 65535) | 0) >>> 0;

        if (inBreak) {
            // STAGE A — the crest tumbling, drawn as a BROKEN RUN OF TORN PATCHES.
            //
            // Two failed shapes are worth recording, because both were defensible and both
            // were wrong in the same way — they had an axis of symmetry, and water does not:
            //   · one quad between a leading and a trailing edge → a torn scrap of PAPER,
            //     and at 3:1 it read as an ice floe on an ocean that has none;
            //   · a chain of pinched shards → a SPINDLE, and with the stage-B tail behind it
            //     the whole field turned into little darts all pointing the same way.
            // So: unequal patches, each occupying a random part of its slot with real gaps
            // between them, each an irregular quadrilateral with four independent corner
            // widths, and each at its own weight. No pinched ends, no symmetry, no run of
            // equal marks. Same argument swell.js makes for its ridge — angular shards
            // "rather than one ruled line", broken because "the breaks are what stop a long
            // crest reading as a graphics artifact".
            const s = k.t / CAP_BREAK_S;
            const len = k.len * (0.30 + 0.70 * Math.min(1, s * 1.7));   // the break RUNS along the crest
            const wid = k.wid * (0.55 + 0.45 * s);
            const a = k.bright * 0.95 * Math.min(1, s * 6) * (1 - 0.32 * s);
            for (let i = 0; i < CAP_SEGS; i++) {
                if (jr() > 0.84) continue;                               // a gap in the break
                const c0 = (i + 0.06 + jr() * 0.26) / CAP_SEGS;
                const c1 = c0 + (0.42 + jr() * 0.50) / CAP_SEGS;
                const u0 = (c0 - 0.5) * len, u1 = (c1 - 0.5) * len;
                const off = (jr() - 0.5) * wid * 0.9;                    // patches do not line up
                const w = wid * (0.40 + jr() * 0.60);
                // ⚠️ EVERY CORNER MOVES, along the crest as well as across it. Varying only
                // the widths leaves both ends square to the crest, and a run of four
                // trapezoids with parallel ends is a row of tiles — which is exactly what
                // the previous cut looked like. Nothing about broken water has a right angle.
                const jl = (u1 - u0) * 0.42;
                ctx.globalAlpha = a * (0.55 + jr() * 0.45);              // ...and vary in weight
                ctx.beginPath();
                start(u0 + (jr() - 0.5) * jl, off + w * (0.55 + jr() * 0.45));
                put(u1 + (jr() - 0.5) * jl, off + w * (0.55 + jr() * 0.45));
                put(u1 + (jr() - 0.5) * jl, off - w * (0.55 + jr() * 0.45));
                put(u0 + (jr() - 0.5) * jl, off - w * (0.55 + jr() * 0.45));
                ctx.closePath();
                ctx.fill();
            }
        } else {
            // STAGE B — the patch left behind, which the field observations describe as
            // taking on a "streaky" appearance elongated along the wind. The wind sea runs
            // downwind, so the streaks turn a quarter-circle off the crest they were born on
            // and lie along the travel direction instead.
            //
            // ⚠️ BLUNT, AND SHORT. Drawn as long tapers they were arrowheads, and a sea
            // covered in arrowheads all aimed downwind reads as a diagram of the wind rather
            // than as foam. Foam has torn ends and does not point.
            const u = (k.t - CAP_BREAK_S) / CAP_FOAM_S;
            const a = k.bright * 0.42 * Math.pow(1 - u, 1.5);
            if (a < 0.012) continue;
            for (let i = 0; i < 3; i++) {
                const along = (jr() - 0.5) * k.len * 0.92;
                const tail = k.wid * (0.9 + jr() * 0.8) + u * k.len * 0.30;
                const w = k.wid * (0.32 + jr() * 0.34) * (1 - 0.4 * u);
                const v0 = -k.wid * 0.3;
                ctx.globalAlpha = a * (0.6 + jr() * 0.4);
                ctx.beginPath();
                start(along + w, v0);
                put(along - w, v0);
                put(along - w * 0.62, v0 + tail);
                put(along + w * 0.62, v0 + tail);
                ctx.closePath();
                ctx.fill();
            }
        }
    }
    ctx.globalAlpha = 1;
}

// THE WHISKER SHEET, drawn rather than particled: a WEDGE springing from the stem, running
// out and aft past the quarter, with a torn outer edge.
//
// ⚠️ IT IS A WEDGE, NOT A LEAF. The first cut bulged out abeam and closed again at the
// after quarter, which is a fair description of the spray root and read on screen as a fur
// collar — a pale halo hugging the hull, adding no direction and no speed. What makes the
// shape say "fast" is that it LEAVES: it starts narrow at the stem, opens as it goes aft,
// and is still opening when it runs off the end of the hull. That is also what a photograph
// of a boat with a bone in her teeth actually shows from above.
//
// Two passes — a wide faint one and a narrow brighter core — the same trick drawWakes uses
// to get a soft edge out of flat fills without touching a gradient.
//
// The outer edge churns on a sum of two sines rather than on re-rolled noise: it has to move
// smoothly, and a hash re-rolled per frame boils.
function drawWings(ctx, state, cam, cullR2) {
    const T = (window.Swell.now ? window.Swell.now() : 0);
    for (const boat of state.boats) {
        const tr = track.get(boat);
        if (!tr || tr.surf < 0.10) continue;
        if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
        const dx = boat.x - cam.x, dy = boat.y - cam.y;
        if (dx * dx + dy * dy > cullR2) continue;

        const d = tr.surf;
        const seed = (boat.x * 0.013 + boat.y * 0.007);
        const aft = 6 + 18 * d;                   // how far aft along the hull the sheet runs
        ctx.save();
        ctx.translate(boat.x, boat.y);
        ctx.rotate(boat.heading);
        for (let pass = 0; pass < 2; pass++) {
            const reach = pass === 0 ? 1 : 0.55;
            ctx.globalAlpha = (pass === 0 ? 0.14 : 0.21) + 0.27 * d;
            for (let side = -1; side <= 1; side += 2) {
                const flare = (16 + 44 * d) * reach;      // beam gained between stem and tip
                const N = 6;
                ctx.beginPath();
                ctx.moveTo(side * 5, -24);
                for (let i = 0; i <= N; i++) {
                    const u = i / N;
                    // ⚠️ CHURNS IN BOTH AXES. Jittering only the beam leaves the edge a
                    // smooth curve sampled at six points — a paper wing. Water tears in
                    // every direction it is moving, so the fore-and-aft position of each
                    // node moves too, on its own phase.
                    const churn = Math.sin(u * 7.3 + T * 5.5 + seed) * 0.6
                                + Math.sin(u * 13.9 - T * 3.9 + seed * 2.1) * 0.4;
                    const churn2 = Math.sin(u * 9.1 - T * 6.2 + seed * 3.7) * 0.55
                                 + Math.sin(u * 17.3 + T * 4.6 + seed) * 0.45;
                    // Opens fast off the stem (the spray root is right forward), holds wide
                    // most of the way aft so the edge reads as a line leaving the boat, then
                    // eases back in over the last quarter.
                    //
                    // ⚠️ THE EASE-BACK IS NOT DECORATION. Without it the outer edge ended at
                    // full beam and the polygon closed straight across to the topsides — a
                    // long, perfectly straight, unjittered aft boundary that read as a knife
                    // edge, which is the one thing in the shape that could not be water. It
                    // is deliberately a PARTIAL taper: pulled all the way in it becomes the
                    // symmetric leaf this shape was rewritten to stop being.
                    const e = clamp01((u - 0.72) / 0.28);
                    const taper = 1 - 0.45 * (e * e * (3 - 2 * e));
                    const w = (5 + flare * Math.pow(u, 0.42)) * taper
                            + churn * (2.5 + 7.0 * d) * reach;
                    ctx.lineTo(side * w, -24 + u * (24 + aft) + churn2 * (1.5 + 5.0 * d) * reach);
                }
                // ...and back up the hull side, which is what the sheet is peeling off.
                ctx.lineTo(side * 13, 20);
                ctx.lineTo(side * 15, -2);
                ctx.lineTo(side * 5, -24);
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

// A droplet is a sliver laid along its OWN velocity, and its length is how fast it is
// going. That is the whole speed cue: nothing is told to look fast, the marks are simply
// longer when there is more water moving. Tapered to a point at the tail so each one has a
// direction you can read at a glance.
function drawSpray(ctx, cam, cullR2) {
    for (const p of spray) {
        const dx = p.x - cam.x, dy = p.y - cam.y;
        if (dx * dx + dy * dy > cullR2) continue;
        const u = p.t / p.life;
        // In fast (a droplet is torn off, it does not fade in) and out slowly.
        const a = Math.min(1, u * 9) * Math.pow(1 - u, p.kind === 1 ? 1.1 : 1.4)
                * (p.kind === 1 ? 0.84 : 0.70);
        if (a < 0.015) continue;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp < 1) continue;
        const ux = p.vx / sp, uy = p.vy / sp;
        const len = 5 + Math.min(42, sp * 0.10);
        const w = p.w * (1 - 0.35 * u);
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.moveTo(p.x + ux * len * 0.35, p.y + uy * len * 0.35);
        ctx.lineTo(p.x - uy * w, p.y + ux * w);
        ctx.lineTo(p.x - ux * len * 0.65, p.y - uy * len * 0.65);
        ctx.lineTo(p.x + uy * w, p.y - ux * w);
        ctx.closePath();
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// THE BREAK ITSELF. Stroked, not filled — the rest of this file is filled polygons, but
// this mark is read side by side with script.js's shore surf and has to belong to it: the
// same stitched, jittered, seaward-bowed polyline drawSurf and drawWindWaves use, because a
// single clean arc is what keeps reading as a drawn LINE rather than as water.
//
// The arc is the one drawSurf established — faintest as it trips, brightest at the break,
// then simply not there — run across the bar instead of up a beach, and spreading as it
// goes, because white water on a bar fans out where a beach gathers it.
function drawShoalBreaks(ctx, cam, cullR2) {
    if (!shoalSites || !shoalSites.length) return;
    // The same switch the shore surf answers to. A player who has turned surf off has turned
    // off surf, not "surf except over sandbars".
    if (typeof settings !== 'undefined' && settings && settings.surf === false) return;
    const sw = window.Swell.primary();
    if (!sw) return;
    const power = clamp01((sw.heightM || 0) / 2.2);
    if (power <= 0.02) return;

    ctx.save();
    ctx.lineCap = 'round';
    for (const st of shoalSites) {
        const dx = st.x - cam.x, dy = st.y - cam.y;
        if (dx * dx + dy * dy > cullR2) continue;
        // Which part of the bar meets the sea, on the refraction floor so the back of a bar
        // still gets what wraps round it.
        const face = -(st.nx * sw.sx + st.ny * sw.sy);
        const f2 = Math.max(0, face);
        const amp = (SHOAL_REFRACT_FLOOR + (1 - SHOAL_REFRACT_FLOOR) * f2 * f2) * power;
        if (amp < 0.07) continue;

        // The train's own phase here, so a bar breaks on the same beat as the coast beyond
        // it and as the wave that just went under the boat.
        let u = (-window.Swell.phaseAt(sw, st.x, st.y) / TAU) % 1;
        if (u < 0) u += 1;
        if (u > SHOAL_LIFE) continue;             // between waves: the bar is bare water
        const f = u / SHOAL_LIFE;                 // 0 tripping, 1 spent
        const life = f < 0.18 ? f / 0.18 : Math.pow(1 - (f - 0.18) / 0.82, 1.4);
        const alpha = Math.min(SHOAL_MAX_ALPHA, amp * life);
        if (alpha < 0.02) continue;

        // Carried forward across the bar in the wave's own direction — not along the
        // contour normal. A bar's shape decides WHERE it trips; the wave decides which way
        // the water then goes, and on an oblique swell those are visibly different.
        const wash = SHOAL_WASH * f * (0.7 + 0.6 * st.seed);
        const bx = st.x + sw.sx * wash, by = st.y + sw.sy * wash;

        const half = SHOAL_SITE_STEP * (0.42 + 0.22 * st.seed);
        // Arc and wobble are fractions of the CREST, not of the wash — the same mistake
        // the shore surf made when its stand-off grew: scaled off the travel distance they
        // turn a 70-unit crest into a hairpin.
        const bow = half * 0.30 * (1 - f * 0.6);
        const SEG = 5;
        ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.6 + amp * 3.4 * (0.5 + f);      // spreading as it spends itself
        let px = 0, py = 0;
        for (let q = 0; q <= SEG; q++) {
            const g = q / SEG;
            const h = Math.sin((st.seed * 90 + q * 3.7) * 12.9898) * 43758.5453;
            const jit = ((h - Math.floor(h)) - 0.5) * half * 0.22;
            const arch = Math.sin(g * Math.PI) * bow;
            const qx = bx + st.tx * (g - 0.5) * 2 * half + sw.sx * (arch + jit);
            const qy = by + st.ty * (g - 0.5) * 2 * half + sw.sy * (arch + jit);
            const h2 = Math.sin((st.seed * 61 + q * 8.3) * 78.233) * 43758.5453;
            if (q > 0 && (h2 - Math.floor(h2)) > 0.20) {
                ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
            }
            px = qx; py = qy;
        }
    }
    ctx.restore();
}

function draw(ctx, state) {
    if (!window.Swell || !window.Swell.active() || !state) return;
    // ⚠️ viewR IS THE CORNER, WITH NO PADDING BAKED IN. It was the corner + 200, and every
    // radius downstream then multiplied that padding again: the layer was spawning caps out
    // to 1.08x and DRAWING out to 1.25x of a radius that already overshot the frame, so it
    // paid for very nearly twice the whitecaps the screen could show. Padding belongs at each
    // use, where it can be the right size for what that use is protecting against.
    viewR = Math.hypot(ctx.canvas.width, ctx.canvas.height) * 0.5;
    const cam = state.camera;
    const cullR2 = (viewR + CAP_LEN_MAX) ** 2;   // only the mark's own reach past the corner

    ctx.save();
    ctx.fillStyle = foamColor();
    // Caps first — they are the water. The fleet's own water goes over them.
    drawCaps(ctx, cam, cullR2);
    // Then the bars tripping the swell. Over the whitecaps because a break is the bigger
    // event, still under the fleet's own spray.
    drawShoalBreaks(ctx, cam, cullR2);
    drawWings(ctx, state, cam, cullR2);
    drawSpray(ctx, cam, cullR2);
    ctx.restore();
}

window.SeaFX = {
    update, draw, reset,
    // Read by the tuning harness in eval/ so a report counts what the game is actually
    // drawing rather than re-deriving it.
    debug: () => ({ caps: caps.length, spray: spray.length,
                    shoalSites: shoalSites ? shoalSites.length : 0, viewR }),
    // The solved break contour, for the probe to aim a camera at and to check against the
    // bar it is supposed to be sitting on.
    debugSites: () => shoalSites
};
})();
