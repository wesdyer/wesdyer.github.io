// ── VOLCANO ─────────────────────────────────────────────────────────────────
// Emberfall Isle's weather: the ERUPTION CYCLE, and the three things that key off it.
// A venue with no `cone`/`boil` prop kinds placed gets none of this and pays nothing —
// state.volcano stays null and every hook returns early.
//
// THE CYCLE. Every placed prop whose kind carries `cone` erupts on its own period, dealt
// from the race seed, so a race is LEARNABLE (the second lap knows what the first one
// saw) and a restart is the same race. quiet → build → peak → wane. `intensity` is the
// 0..1 the rest of the file reads. It does NOT touch the lava painters: the flow keeps its
// own pace through an eruption (Wes's call) — the eruption is the plume.
//
// THE PLUME. Parcels of ash leave the crater on a fixed cadence and ride the MEAN wind
// field (regionWindAt — no puffs, and never the plume's own dead air, or the cloud would
// stall under itself). Each parcel widens and thins with age, so the veil dissipates with
// distance downwind. Inside it the wind dies: getWindAt multiplies its resultant by
// windMul(). A quiet cone breathes a thin pale steam wisp — the venue's wind sock — that
// costs nothing to sail under. Drawn as a CONNECTED SHEET (overlapping textured discs
// baked at 4 units/px and blurred on composite), never as particles.
//
// LIGHTNING. A charged plume — the peak of the cycle, its youngest parcels — throws a
// strike every few seconds. TELL seconds before each one, every boat within reach shows
// the omens: corona at the masthead, instrument jitter. The strike flashes the screen,
// crawls forks across the cloud base to the point it hits, lights the water there, casts
// the fleet's shadows away from it, and the thunder arrives dist / 340 m/s later. A boat
// within FRY_R has her ELECTRONICS FRIED: the player's chart, rose, instruments and goal
// chips go to static and reboot staggered; a bot holds her course blind. The penalty is
// on INFORMATION, not on control — you can always sail by the water.
//
// BOILS. Every seabed vent (`boil`) is a small turbulence zone — the rapids model, drag
// and yaw, no lift — under a churning white sheet and a steam wisp.
//
// Nothing here touches the eval RNG: the cycle and the strikes draw from their own seeded
// stream (race seed + 91), consumed in a fixed order; visuals hash time and index.

const VOLCANO = {
    period: [96, 150],        // s per cycle, dealt per cone from the seed
    build: 14, peak: 26, wane: 12,
    emitEvery: 0.55,          // s between parcels
    ashLife: 22, steamLife: 9,
    // Units per second per knot. A puff is carried at 0.18 u/frame/kn (see SQUALL_DRIFT);
    // the ash cloud rides at 85% of that — it is higher and heavier than a gust.
    drift: 0.18 * 60 * 0.85,
    r0: 90, spread: 15,       // parcel radius at birth, growth per second
    deadMax: 0.8,             // share of the wind an erupting plume kills at its core
    steamDead: 0.35,          // the islet's fixed hole
    quietDensity: 0.3,        // the wisp: pale, and readable as a wind sock
    strikeEvery: [5, 12],     // s between strikes while charged
    // AIMED AT THE FLEET. A cloud that struck wherever it pleased mostly hit empty water
    // or the isle. When a boat is under the plume, this share of strikes lands a dealt
    // distance from one of them — near enough to matter, far enough to sail out of.
    aimShare: 0.7, aimNear: 140, aimFar: 420,
    tell: 2.8, tellR: 1100,   // the omens' lead time — long enough for avoiding action — and reach
    // The outage is PROPORTIONAL TO PROXIMITY: fryMax at the strike point, nothing at fryR,
    // and a fry shorter than fryLeast is not worth having. Sailing away during the tell
    // pays directly in seconds.
    fryR: 640, fryMax: 7, fryLeast: 0.8,
    boilR: 0.42,              // boil radius as a share of the vent's box
    shadowR: 1300,            // how far a strike throws a shadow
    speedOfSound: 5 * 340,    // world units per second (5 units to the metre)
};

(function () {
    'use strict';

    const hash = (i) => {
        let x = Math.imul(i | 0, 2654435761);
        x ^= x >>> 15; x = Math.imul(x, 2246822519); x ^= x >>> 13; x = Math.imul(x, 3266489917); x ^= x >>> 16;
        return (x >>> 0) / 4294967296;
    };
    const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
    const V = () => (typeof state !== 'undefined' && state.volcano) || null;

    // The crater in world space: the kind's magma region through the prop's transform.
    function craterOf(p, kind) {
        const w = (kind.world || 100) * (p.scale || 1);
        const reg = kind.lava && kind.lava.magma;
        if (!reg) return { x: p.x, y: p.y, w };
        const lx = (reg.cx - 0.5) * w, ly = (reg.cy - 0.5) * w;
        const cs = Math.cos(p.heading || 0), sn = Math.sin(p.heading || 0);
        return { x: p.x + lx * cs - ly * sn, y: p.y + lx * sn + ly * cs, w };
    }

    function init() {
        state.volcano = null;
        const c = state.course;
        const props = c && c.props;
        const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        if (!props || !props.length) return;
        const cfg = (c.doc && c.doc.volcano) || {};
        const rng = state.race && state.race.seed ? mulberry32(state.race.seed + 91) : Math.random;
        const cones = [], vents = [];
        for (const p of props) {
            const kind = reg[p.kind];
            if (!kind) continue;
            if (kind.cone) {
                const cr = craterOf(p, kind);
                const per = cfg.period || VOLCANO.period;
                cones.push({
                    p, kind, x: cr.x, y: cr.y, scale: kind.cone, steam: !!kind.steam,
                    period: per[0] + rng() * (per[1] - per[0]),
                    phase: rng(),
                    parcels: [], emitT: 0, intensity: 0,
                    nextStrike: VOLCANO.strikeEvery[0] + rng() * (VOLCANO.strikeEvery[1] - VOLCANO.strikeEvery[0]),
                    pending: null
                });
            } else if (kind.boil) {
                const cr = craterOf(p, kind);
                vents.push({ p, kind, x: cr.x, y: cr.y, r: cr.w * VOLCANO.boilR, strength: kind.boil,
                             phase: rng() * Math.PI * 2, parcels: [], emitT: rng() * 1.4 });
            }
        }
        if (!cones.length && !vents.length) return;
        state.volcano = { t: 0, rng, cones, vents, strikes: [], flash: 0, fry: new Map(),
                          lightning: cfg.lightning !== false };
    }

    // ── The cycle ───────────────────────────────────────────────────────────
    function intensityOf(cone, t) {
        if (cone.steam) return 0;
        const u = ((t / cone.period + cone.phase) % 1) * cone.period;   // seconds into this cycle
        const q = cone.period - VOLCANO.build - VOLCANO.peak - VOLCANO.wane;  // quiet first
        if (u < q) return 0;
        if (u < q + VOLCANO.build) return smooth((u - q) / VOLCANO.build);
        if (u < q + VOLCANO.build + VOLCANO.peak) return 1;
        return 1 - smooth((u - q - VOLCANO.build - VOLCANO.peak) / VOLCANO.wane);
    }

    function emit(list, x, y, r0, spread, life, density, ash, dead, seed) {
        list.push({ x, y, r0, spread, life, density, ash, dead, age: 0, seed,
                    // A little meander so a plume is a ribbon and not a ruler.
                    mx: (hash(seed) - 0.5) * 0.5, my: (hash(seed + 7) - 0.5) * 0.5 });
    }

    function advect(list, dt) {
        for (let i = list.length - 1; i >= 0; i--) {
            const q = list[i];
            q.age += dt;
            if (q.age > q.life) { list[i] = list[list.length - 1]; list.pop(); continue; }
            const w = regionWindAt(q.x, q.y);
            const spd = (w.speed > 0.1 ? w.speed : state.wind.speed) * VOLCANO.drift;
            const ux = -Math.sin(w.direction), uy = Math.cos(w.direction);
            const wob = Math.sin(q.age * 0.7 + q.seed) * 0.25;
            q.x += (ux + uy * (q.mx + wob)) * spd * dt;
            q.y += (uy - ux * (q.my + wob)) * spd * dt;
        }
    }
    const radiusOf = (q) => q.r0 + q.spread * q.age;
    // Fades in over the first 0.6 s (a parcel is born at the crater, not on it) and thins
    // to nothing over its life — which is what "dissipates with distance" is.
    const fadeOf = (q) => Math.min(1, q.age / 0.6) * Math.pow(1 - q.age / q.life, 1.3);

    function update(dt) {
        const v = V();
        if (!v) return;
        v.t += dt;
        const t = v.t;
        for (const c of v.cones) {
            const I = c.intensity = intensityOf(c, t);
            // The lava itself is left alone (Wes: the flow must not speed up when the cone
            // erupts) — the eruption is the PLUME, and only the plume.
            c.emitT -= dt;
            if (c.emitT <= 0) {
                c.emitT += VOLCANO.emitEvery;
                const sc = c.scale;
                if (c.steam) {
                    emit(c.parcels, c.x, c.y, VOLCANO.r0 * sc, VOLCANO.spread * sc, 12, 0.45, 0, VOLCANO.steamDead,
                         Math.floor(t * 13) + c.parcels.length);
                } else {
                    const density = VOLCANO.quietDensity + (1 - VOLCANO.quietDensity) * I;
                    const life = VOLCANO.steamLife + (VOLCANO.ashLife - VOLCANO.steamLife) * I;
                    emit(c.parcels, c.x, c.y, VOLCANO.r0 * sc * (0.7 + 0.6 * I), VOLCANO.spread * sc * (0.6 + 0.6 * I),
                         life, density, I, VOLCANO.deadMax * I, Math.floor(t * 13) + c.parcels.length);
                }
            }
            advect(c.parcels, dt);
            // Lightning: a charged cloud throws strikes from its young parcels.
            if (v.lightning && !c.steam) {
                if (I > 0.5) {
                    c.nextStrike -= dt;
                    if (!c.pending && c.nextStrike <= 0) {
                        const young = c.parcels.filter(q => q.age > 1 && q.age < 10);
                        if (young.length) {
                            // Who is under the cloud?
                            const under = [];
                            for (const boat of state.boats) {
                                if (boat.raceState && boat.raceState.finished) continue;
                                for (const q of young) {
                                    const r = radiusOf(q) * 1.3;
                                    if ((boat.x - q.x) ** 2 + (boat.y - q.y) ** 2 < r * r) { under.push(boat); break; }
                                }
                            }
                            let x, y, ox, oy;
                            const aimed = under.length > 0 && v.rng() < VOLCANO.aimShare;
                            if (aimed) {
                                const b = under[Math.floor(v.rng() * under.length)];
                                const a = v.rng() * Math.PI * 2, d = VOLCANO.aimNear + v.rng() * (VOLCANO.aimFar - VOLCANO.aimNear);
                                x = b.x + Math.cos(a) * d; y = b.y + Math.sin(a) * d;
                                let best = null, bd = Infinity;
                                for (const q of young) { const dd = (q.x - x) ** 2 + (q.y - y) ** 2; if (dd < bd) { bd = dd; best = q; } }
                                ox = best.x; oy = best.y;
                            } else {
                                const q = young[Math.floor(v.rng() * young.length)];
                                const a = v.rng() * Math.PI * 2, d = Math.sqrt(v.rng()) * radiusOf(q) * 0.7;
                                x = q.x + Math.cos(a) * d; y = q.y + Math.sin(a) * d; ox = q.x; oy = q.y;
                            }
                            c.pending = { ox, oy, x, y, at: t + VOLCANO.tell, seed: Math.floor(v.rng() * 1e9), aimed, under: under.length };
                        }
                        c.nextStrike = VOLCANO.strikeEvery[0] + v.rng() * (VOLCANO.strikeEvery[1] - VOLCANO.strikeEvery[0]);
                    }
                } else {
                    c.nextStrike = Math.max(c.nextStrike, 2);
                }
                if (c.pending && t >= c.pending.at) { fire(v, c.pending); c.pending = null; }
            }
        }
        for (const b of v.vents) {
            b.emitT -= dt;
            if (b.emitT <= 0) {
                b.emitT += 1.4;
                emit(b.parcels, b.x, b.y, 36, 8, 7, 0.28, 0, 0, Math.floor(t * 17) + b.parcels.length);
            }
            advect(b.parcels, dt);
        }
        // Strikes age out; the flash decays; fried boats recover.
        for (let i = v.strikes.length - 1; i >= 0; i--) if (t - v.strikes[i].t0 > 0.55) v.strikes.splice(i, 1);
        for (const [boat, f] of v.fry) if (t - f.t0 > f.dur) { v.fry.delete(boat); boat.fried = null; }
    }

    // ── The strike ──────────────────────────────────────────────────────────
    function forks(ox, oy, x, y, seed) {
        // Midpoint displacement: the main channel from the cloud to the water, then two
        // branches leaving it part-way, each a shorter channel of its own.
        const chan = (ax, ay, bx, by, s, levels, amp) => {
            let pts = [[ax, ay], [bx, by]];
            for (let l = 0; l < levels; l++) {
                const out = [pts[0]];
                for (let i = 1; i < pts.length; i++) {
                    const [px, py] = pts[i - 1], [qx, qy] = pts[i];
                    const mx = (px + qx) / 2, my = (py + qy) / 2;
                    const nx = -(qy - py), ny = qx - px;
                    const k = (hash(s + l * 131 + i * 17) - 0.5) * amp;
                    out.push([mx + nx * k, my + ny * k], [qx, qy]);
                }
                pts = out; amp *= 0.55;
            }
            return pts;
        };
        const main = chan(ox, oy, x, y, seed, 5, 0.5);
        const br = [];
        for (let b = 0; b < 3; b++) {
            const i = Math.floor(main.length * (0.2 + 0.5 * hash(seed + 900 + b)));
            const [px, py] = main[i];
            const ang = Math.atan2(y - oy, x - ox) + (hash(seed + 950 + b) - 0.5) * 1.6;
            const len = Math.hypot(x - ox, y - oy) * (0.25 + 0.2 * hash(seed + 970 + b));
            br.push(chan(px, py, px + Math.cos(ang) * len, py + Math.sin(ang) * len, seed + 1000 + b * 77, 4, 0.5));
        }
        return { main, br };
    }

    function fire(v, s) {
        const strike = { x: s.x, y: s.y, ox: s.ox, oy: s.oy, t0: v.t, seed: s.seed, f: forks(s.ox, s.oy, s.x, s.y, s.seed) };
        v.strikes.push(strike);
        v.flashT = v.t;
        let playerD = null;
        for (const boat of state.boats) {
            const d = Math.hypot(boat.x - s.x, boat.y - s.y);
            if (boat.isPlayer) playerD = d;
            if (d < VOLCANO.fryR && !(boat.raceState && boat.raceState.finished)) {
                const dur = VOLCANO.fryMax * (1 - d / VOLCANO.fryR);
                if (dur < VOLCANO.fryLeast) continue;
                const cur = v.fry.get(boat);
                // A second strike inside the outage restarts it, never shortens it.
                if (!cur || cur.t0 + cur.dur < v.t + dur) v.fry.set(boat, { t0: v.t, dur });
                boat.fried = v.fry.get(boat);
            }
        }
        // `Sound` is a top-level const, not a window property — test it by name.
        if (playerD != null && typeof Sound !== 'undefined' && Sound.playThunder) {
            const delay = playerD / VOLCANO.speedOfSound;
            const loud = clamp01(1 - playerD / 5000);
            if (loud > 0.03) Sound.playThunder(delay, loud, playerD);
        }
    }

    // ── Queries the sim reads ───────────────────────────────────────────────
    // The wind multiplier at a point: the deepest hole any parcel puts here (one cloud, not
    // a stack of them). 1 everywhere a plume is not.
    function windMul(x, y) {
        const v = V();
        if (!v) return 1;
        let mul = 1;
        const lists = v.cones;
        for (let k = 0; k < lists.length; k++) {
            const ps = lists[k].parcels;
            for (let i = 0; i < ps.length; i++) {
                const q = ps[i];
                if (q.dead <= 0) continue;
                const r = radiusOf(q);
                const dx = x - q.x, dy = y - q.y, d2 = dx * dx + dy * dy;
                if (d2 >= r * r) continue;
                const s = smooth(1 - Math.sqrt(d2) / r);
                const m = 1 - q.dead * fadeOf(q) * s;
                if (m < mul) mul = m;
            }
        }
        return Math.max(0.12, mul);
    }

    // Broken water over a vent, 0..1, in the rapids' units.
    function boilAt(x, y) {
        const v = V();
        if (!v || !v.vents.length) return 0;
        let turb = 0;
        for (const b of v.vents) {
            const dx = x - b.x, dy = y - b.y, d2 = dx * dx + dy * dy;
            if (d2 >= b.r * b.r) continue;
            const breath = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(v.t * 0.35 + b.phase));
            const s = smooth(1 - Math.sqrt(d2) / b.r);
            turb = Math.max(turb, b.strength * breath * s);
        }
        return turb;
    }

    const fryOf = (boat) => { const v = V(); return v ? (v.fry.get(boat) || null) : null; };
    const isFried = (boat) => !!fryOf(boat);
    // Omens: how charged the air round a boat is, 0..1, rising to the strike.
    function chargeOf(boat) {
        const v = V();
        if (!v) return 0;
        let k = 0;
        for (const c of v.cones) {
            const s = c.pending;
            if (!s) continue;
            const d = Math.hypot(boat.x - s.x, boat.y - s.y);
            if (d > VOLCANO.tellR) continue;
            const lead = 1 - clamp01((s.at - v.t) / VOLCANO.tell);
            k = Math.max(k, (1 - d / VOLCANO.tellR) * (0.3 + 0.7 * lead));
        }
        return k;
    }

    // ── The player's electronics ────────────────────────────────────────────
    // Each system reboots at its own share of the outage, so the HUD comes back in pieces.
    const REBOOT = { rose: 0.55, instruments: 0.7, minimap: 0.85, nav: 0.92, leaderboard: 1 };
    function hudFried(sys) {
        const v = V();
        if (!v || !state.boats.length) return false;
        const f = v.fry.get(state.boats[0]);
        if (!f) return false;
        return (v.t - f.t0) / f.dur < (REBOOT[sys] || 1);
    }
    // Glitch amplitude for the player's instruments: the outage's burst, or the omens.
    function glitch() {
        const v = V();
        if (!v || !state.boats.length) return 0;
        const p = state.boats[0];
        const f = v.fry.get(p);
        let g = 0;
        if (f) g = Math.max(0.35, 1 - (v.t - f.t0) / f.dur);
        return Math.max(g, 0.45 * chargeOf(p));
    }
    // A reading through fried electronics: digits go wrong, then go to static.
    const GARBLE = '0123456789-#░▒';
    function garble(text, fr) {
        const f = (typeof frameCount !== 'undefined' ? frameCount : 0) >> 1;
        let out = '';
        for (let i = 0; i < text.length; i++) {
            const h = hash(f * 31 + i * 7);
            out += h < 0.8 * fr ? GARBLE[Math.floor(hash(f * 37 + i * 11) * GARBLE.length)] : text[i];
        }
        return out;
    }
    function applyHudClasses() {
        if (typeof document === 'undefined') return;
        const on = { leaderboard: hudFried('leaderboard'), 'hud-rose': hudFried('rose'), 'hud-minimap-wrap': hudFried('minimap') };
        for (const id in on) {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('fried', on[id]);
        }
    }
    function drawMinimapFry(ctx) {
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const f = (typeof frameCount !== 'undefined' ? frameCount : 0) >> 1;
        // Tearing: bands of the chart slide sideways.
        for (let i = 0; i < 6; i++) {
            const y = Math.floor(hash(f * 7 + i) * H), h = 4 + Math.floor(hash(f * 11 + i) * 18);
            const dx = Math.floor((hash(f * 13 + i) - 0.5) * 40);
            ctx.drawImage(ctx.canvas, 0, y, W, h, dx, y, W, h);
        }
        ctx.fillStyle = 'rgba(6, 12, 22, 0.6)';
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 14; i++) {
            const y = hash(f * 17 + i) * H, a = 0.12 + 0.35 * hash(f * 19 + i);
            ctx.fillStyle = `rgba(200, 215, 230, ${a.toFixed(2)})`;
            ctx.fillRect(0, y, W, 1 + hash(f * 23 + i) * 3);
        }
        if (hash(f * 29) > 0.35) {
            ctx.fillStyle = '#fb7185';
            ctx.font = 'bold 11px ui-monospace, Menlo, monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('NO SIGNAL', W / 2 + (hash(f * 41) - 0.5) * 6, H / 2);
        }
    }

    // ── Drawing ─────────────────────────────────────────────────────────────
    // PUFF SPRITES: the unit of the veil. A soft-edged, ragged blob — a radial falloff
    // multiplied by a blob-noise field — baked once per colour in four variants, so a
    // parcel is one drawImage and overlapping parcels sum into a cloud with no rims. Dealt
    // from a fixed seed: the texture is part of the art and must look the same every session.
    let _puffs = null;
    const PUFF = 160;
    function makePuff(rgb, seedI) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = PUFF;
        const g = cv.getContext('2d');
        const img = g.createImageData(PUFF, PUFF), d = img.data;
        let sd = (seedI * 7919 + 17) >>> 0;
        const rnd = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
        const blobs = [];
        for (let i = 0; i < 28; i++) {
            const ang = rnd() * Math.PI * 2, dd = Math.sqrt(rnd()) * PUFF * 0.36;
            blobs.push({ x: PUFF / 2 + Math.cos(ang) * dd, y: PUFF / 2 + Math.sin(ang) * dd, r: PUFF * (0.10 + rnd() * 0.2), w: 0.5 + rnd() * 0.5 });
        }
        for (let y = 0; y < PUFF; y++) for (let x = 0; x < PUFF; x++) {
            let n = 0;
            for (const bl of blobs) {
                const dx = x - bl.x, dy = y - bl.y, q = (dx * dx + dy * dy) / (bl.r * bl.r);
                if (q < 1) n += bl.w * (1 - q) * (1 - q);
            }
            const rx = (x - PUFF / 2) / (PUFF / 2), ry = (y - PUFF / 2) / (PUFF / 2);
            const fall = smooth(1 - Math.sqrt(rx * rx + ry * ry));
            // A solid heart, a ragged edge: the noise decides the rim, the falloff the body.
            const al = Math.max(fall * fall * 0.85, fall * clamp01((Math.min(1, n * 0.7) - 0.18) * 1.6));
            const i = (y * PUFF + x) * 4;
            d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = Math.round(al * 255);
        }
        g.putImageData(img, 0, 0);
        return cv;
    }
    function puffSprites() {
        if (_puffs) return _puffs;
        const set = (rgb, base) => [0, 1, 2, 3].map(i => makePuff(rgb, base + i));
        return (_puffs = { ash: set([122, 110, 105], 1), steam: set([228, 231, 234], 1), dark: set([14, 13, 16], 1), light: set([176, 166, 160], 5) });
    }

    let _bake = null;
    const UPP = 4;
    function drawVeil(ctx) {
        const v = V();
        if (!v) return;
        const cam = state.camera;
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const diag = Math.sqrt(cw * cw + ch * ch);
        const S = Math.ceil(diag / UPP) + 40;
        if (!_bake || _bake.width !== S) { _bake = document.createElement('canvas'); _bake.width = _bake.height = S; }
        const g = _bake.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, S, S);
        const side = S * UPP, half = side / 2;
        const reach = half + 500;
        let any = false;
        const puffs = puffSprites();
        // Embers round the crater while the cone erupts, under the ash. The lava itself is
        // not touched — no extra glow, no faster flow.
        for (const c of v.cones) {
            const I = c.intensity;
            if (I > 0.05) {
                const dx = c.x - cam.x, dy = c.y - cam.y;
                if (dx * dx + dy * dy < reach * reach) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    // Embers: brighten and die in place round the crater — no travel.
                    const n = Math.round(14 * I);
                    for (let i = 0; i < n; i++) {
                        const ph = hash(i * 13 + 5), life = (v.t * (0.8 + hash(i) * 0.6) + ph) % 1;
                        const a = Math.sin(Math.PI * life) * 0.9;
                        const ang = hash(i * 7 + 1) * Math.PI * 2, d = (20 + hash(i * 3 + 2) * 110) * c.scale;
                        ctx.fillStyle = `rgba(255, ${170 + Math.floor(hash(i * 5) * 60)}, 60, ${a.toFixed(2)})`;
                        ctx.beginPath();
                        ctx.arc(c.x + Math.cos(ang) * d, c.y + Math.sin(ang) * d, 2 + 2.5 * hash(i * 11), 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }
            }
        }
        // Three passes per list, so the cloud reads as a THING ABOVE THE WORLD and not as a
        // stain on it: its shadow thrown down-sun, its body (steam and ash sprites, blended
        // by how much ash the parcel carries), and a lit crown toward the light. Ash on
        // basalt is invisible, so the ash is the pale grey-brown of a lit plume seen from
        // above, never rock-dark.
        const paint = (ps) => {
            const seen = [];
            for (const q of ps) {
                const dx = q.x - cam.x, dy = q.y - cam.y;
                if (dx * dx + dy * dy > reach * reach) continue;
                const a = 0.8 * q.density * fadeOf(q);
                if (a < 0.004) continue;
                seen.push({ q, px: S / 2 + dx / UPP, py: S / 2 + dy / UPP, r: radiusOf(q) / UPP * 1.15, a, k: Math.pow(q.ash, 0.7),
                            i: q.seed & 3, rot: hash(q.seed + 3) * Math.PI * 2 + q.age * 0.04 });
            }
            if (!seen.length) return;
            any = true;
            const put = (sp, x, y, r, rot, al) => {
                if (al < 0.003) return;
                g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = Math.min(1, al);
                g.drawImage(sp, -r, -r, r * 2, r * 2);
                g.restore();
            };
            // The shadow, down-sun (the props' light is from the upper left).
            for (const s of seen) put(puffs.dark[s.i], s.px + 34 / UPP, s.py + 40 / UPP, s.r * 0.95, s.rot, s.a * (0.25 + 0.2 * s.k));
            // The body.
            for (const s of seen) {
                if (s.k < 0.98) put(puffs.steam[s.i], s.px, s.py, s.r, s.rot, s.a * (1 - s.k));
                if (s.k > 0.02) put(puffs.ash[s.i], s.px, s.py, s.r, s.rot, s.a * s.k);
            }
            // The billows: three lit-and-shaded knots inside each parcel (a light puff up-sun
            // of a dark one), so the cloud has a cauliflower surface and not a fog's.
            for (const s of seen) {
                for (let b = 0; b < 3; b++) {
                    const ang = hash(s.q.seed + 40 + b * 9) * Math.PI * 2, d = s.r * (0.15 + 0.35 * hash(s.q.seed + 50 + b * 9));
                    const bx = s.px + Math.cos(ang) * d, by = s.py + Math.sin(ang) * d, br = s.r * (0.3 + 0.16 * hash(s.q.seed + 60 + b));
                    put(puffs.dark[(s.i + b) & 3], bx + br * 0.25, by + br * 0.3, br, s.rot + b, s.a * (0.16 + 0.16 * s.k));
                    put(puffs.light[(s.i + b) & 3], bx - br * 0.2, by - br * 0.25, br * 0.85, s.rot + b + 2, s.a * (0.22 + 0.3 * s.k));
                }
            }
        };
        for (const c of v.cones) paint(c.parcels);
        for (const b of v.vents) paint(b.parcels);
        g.globalAlpha = 1;
        if (!any) return;
        ctx.save();
        try { ctx.filter = 'blur(3px)'; } catch (e) {}
        ctx.drawImage(_bake, cam.x - half, cam.y - half, side, side);
        try { ctx.filter = 'none'; } catch (e) {}
        ctx.restore();
    }

    function drawBoils(ctx) {
        const v = V();
        if (!v || !v.vents.length) return;
        const cam = state.camera;
        const reach = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 300;
        for (const b of v.vents) {
            const dx = b.x - cam.x, dy = b.y - cam.y;
            if (dx * dx + dy * dy > reach * reach) continue;
            const breath = 0.5 + 0.5 * Math.sin(v.t * 0.35 + b.phase);
            const r = b.r * (0.86 + 0.14 * breath);
            // The sheet: ONE CONNECTED BODY of foam — a ring of soft lobes that heave in
            // place round a bright heart, so the boil reads as a patch of broken water
            // and never as a shoal of white objects.
            const lobe = (x, y, rr, a) => {
                const gr = ctx.createRadialGradient(x, y, 0, x, y, rr);
                gr.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
                gr.addColorStop(0.5, `rgba(244,248,251,${(a * 0.55).toFixed(3)})`);
                gr.addColorStop(1, 'rgba(240,246,250,0)');
                ctx.fillStyle = gr;
                ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
            };
            for (let k = 0; k < 9; k++) {
                const ang = k / 9 * Math.PI * 2 + Math.sin(v.t * 0.5 + b.phase + k) * 0.25;
                const d = r * (0.42 + 0.12 * Math.sin(v.t * 0.8 + k * 1.7 + b.phase));
                lobe(b.x + Math.cos(ang) * d, b.y + Math.sin(ang) * d, r * 0.6, 0.2 + 0.1 * breath);
            }
            lobe(b.x, b.y, r * 0.8, 0.38 + 0.16 * breath);
            // The churn: a fine hash grid of crests that brighten and die IN PLACE — texture
            // on the sheet, each too small to be a thing.
            const cell = 14, n = Math.ceil(r / cell);
            const gx0 = Math.floor((b.x - r) / cell), gy0 = Math.floor((b.y - r) / cell);
            for (let gy = gy0; gy <= gy0 + 2 * n; gy++) for (let gx = gx0; gx <= gx0 + 2 * n; gx++) {
                const i = gx * 7919 + gy * 104729;
                const cx = (gx + hash(i)) * cell, cy = (gy + hash(i + 1)) * cell;
                const d = Math.hypot(cx - b.x, cy - b.y);
                if (d > r * 0.95) continue;
                const life = (v.t * (1.3 + hash(i + 2) * 0.9) + hash(i + 3)) % 1;
                const a = Math.sin(Math.PI * life) * (0.45 + 0.55 * hash(i + 4)) * (1 - d / r) * (0.6 + 0.4 * breath);
                if (a < 0.03) continue;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(hash(i + 5) * Math.PI);
                ctx.fillStyle = `rgba(255,255,255,${(a * 0.7).toFixed(3)})`;
                ctx.beginPath();
                ctx.ellipse(0, 0, 4 + hash(i + 6) * 5, 2 + hash(i + 7) * 3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            // Bubbles: rings that swell and burst at the heart.
            for (let k = 0; k < 6; k++) {
                const life = (v.t * (0.9 + hash(k + 50) * 0.5) + hash(k + 60)) % 1;
                const ang = hash(k + 70) * Math.PI * 2, d = hash(k + 80) * r * 0.45;
                const rr = 3 + life * 11;
                ctx.strokeStyle = `rgba(255,255,255,${(0.55 * (1 - life)).toFixed(3)})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(b.x + Math.cos(ang) * d, b.y + Math.sin(ang) * d, rr, 0, Math.PI * 2); ctx.stroke();
            }
        }
    }

    // The bolt's brightness over its life: the first stroke, then two return strokes.
    function boltEnv(age) {
        const t = age / 0.55;
        if (t >= 1) return 0;
        const bump = (c, w) => Math.max(0, 1 - Math.abs(t - c) / w);
        return Math.max(0, 1 - t * 1.8) + 0.65 * bump(0.28, 0.06) + 0.4 * bump(0.5, 0.06);
    }

    function drawStrikes(ctx) {
        const v = V();
        if (!v) return;
        const cam = state.camera;
        const reach = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
        const f = (typeof frameCount !== 'undefined' ? frameCount : 0);
        // THE MARK ON THE WATER. Where the strike will land is shown for the whole tell,
        // so avoiding action is possible: the fry radius as a slowly turning dashed ring,
        // three ripples closing on the point, a flickering heart that grows and crackles
        // as the strike nears. Electric blue-white, additive, in the water's own plane.
        for (const c of v.cones) {
            const s = c.pending;
            if (!s) continue;
            const dx = s.x - cam.x, dy = s.y - cam.y;
            if (dx * dx + dy * dy > (reach + VOLCANO.fryR) ** 2) continue;
            const lead = 1 - clamp01((s.at - v.t) / VOLCANO.tell);
            const flick = 0.7 + 0.3 * hash(f * 3 + s.seed);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';
            // The reach: the ring a boat wants to be outside of.
            ctx.setLineDash([16, 12]);
            ctx.lineDashOffset = -v.t * 50;
            ctx.lineWidth = 2;
            ctx.strokeStyle = `rgba(150, 200, 255, ${((0.22 + 0.3 * lead) * flick).toFixed(3)})`;
            ctx.beginPath(); ctx.arc(s.x, s.y, VOLCANO.fryR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            // Ripples closing on the point.
            for (let k = 0; k < 3; k++) {
                const ph = ((lead * 1.8 + k / 3) % 1);
                const rr = VOLCANO.fryR * (1 - ph);
                ctx.lineWidth = 1.5 + 2.5 * ph;
                ctx.strokeStyle = `rgba(170, 215, 255, ${(0.55 * ph * (0.5 + 0.5 * lead)).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, Math.PI * 2); ctx.stroke();
            }
            // The heart.
            const hr = 30 + 70 * lead;
            const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, hr);
            gr.addColorStop(0, `rgba(220, 238, 255, ${((0.25 + 0.55 * lead) * flick).toFixed(3)})`);
            gr.addColorStop(0.5, `rgba(150, 195, 255, ${((0.12 + 0.3 * lead) * flick).toFixed(3)})`);
            gr.addColorStop(1, 'rgba(120, 170, 255, 0)');
            ctx.fillStyle = gr;
            ctx.fillRect(s.x - hr, s.y - hr, hr * 2, hr * 2);
            // Crackle: short jagged sparks off the heart, more of them as it nears.
            const n = Math.round(2 + 9 * lead);
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = `rgba(225, 240, 255, ${(0.8 * flick).toFixed(3)})`;
            for (let i = 0; i < n; i++) {
                const a = hash(f * 7 + i * 31 + s.seed) * Math.PI * 2;
                let px = s.x + Math.cos(a) * hr * 0.3, py = s.y + Math.sin(a) * hr * 0.3;
                ctx.beginPath(); ctx.moveTo(px, py);
                for (let j = 0; j < 3; j++) {
                    const aj = a + (hash(f * 11 + i * 17 + j * 5) - 0.5) * 1.4;
                    const l = 10 + 30 * lead * hash(f * 13 + i * 7 + j);
                    px += Math.cos(aj) * l; py += Math.sin(aj) * l;
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
            ctx.restore();
        }
        // Omens: corona at the masthead of every boat inside a charged plume's reach.
        for (const boat of state.boats) {
            if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
            const k = chargeOf(boat);
            if (k <= 0.02) continue;
            const dx = boat.x - cam.x, dy = boat.y - cam.y;
            if (dx * dx + dy * dy > reach * reach) continue;
            const flick = 0.55 + 0.45 * hash(f * 3 + 1);
            const mx = boat.x + Math.sin(boat.heading) * 4, my = boat.y - Math.cos(boat.heading) * 4;
            const r = 9 + 10 * k;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const gr = ctx.createRadialGradient(mx, my, 0, mx, my, r);
            gr.addColorStop(0, `rgba(210, 235, 255, ${(0.85 * k * flick).toFixed(3)})`);
            gr.addColorStop(0.4, `rgba(140, 190, 255, ${(0.4 * k * flick).toFixed(3)})`);
            gr.addColorStop(1, 'rgba(120, 170, 255, 0)');
            ctx.fillStyle = gr;
            ctx.fillRect(mx - r, my - r, r * 2, r * 2);
            // St Elmo's brushes: three short flickering streaks off the mast.
            ctx.strokeStyle = `rgba(220, 240, 255, ${(0.7 * k * flick).toFixed(3)})`;
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                const a = hash(f * 5 + i * 17) * Math.PI * 2, l = 4 + 8 * k * hash(f * 7 + i);
                ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a) * l, my + Math.sin(a) * l); ctx.stroke();
            }
            ctx.restore();
        }
        if (!v.strikes.length) return;
        for (const s of v.strikes) {
            const age = v.t - s.t0;
            const e = boltEnv(age);
            if (e <= 0) continue;
            const dx = s.x - cam.x, dy = s.y - cam.y;
            if (dx * dx + dy * dy > (reach + 1600) ** 2) continue;
            // Shadows first, thrown away from the strike, only while the first stroke burns.
            const sh = Math.max(0, 1 - age / 0.14) * 0.45;
            if (sh > 0.01 && typeof getHullPolygon === 'function') {
                ctx.fillStyle = `rgba(4, 8, 16, ${sh.toFixed(3)})`;
                for (const boat of state.boats) {
                    const bd = Math.hypot(boat.x - s.x, boat.y - s.y);
                    if (bd > VOLCANO.shadowR || bd < 1) continue;
                    if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
                    const nx = (boat.x - s.x) / bd, ny = (boat.y - s.y) / bd;
                    const len = 30 + 120 * (1 - bd / VOLCANO.shadowR);
                    const poly = getHullPolygon(boat);
                    if (!poly || !poly.length) continue;
                    ctx.beginPath();
                    for (let i = 0; i < poly.length; i++) {
                        const p = poly[i], px = (p.x != null ? p.x : p[0]) + nx * len, py = (p.y != null ? p.y : p[1]) + ny * len;
                        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.closePath(); ctx.fill();
                }
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            // The water lit where it hits.
            const wr = 240 + 60 * e;
            const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, wr);
            gr.addColorStop(0, `rgba(200, 222, 255, ${(0.6 * e).toFixed(3)})`);
            gr.addColorStop(0.35, `rgba(150, 190, 255, ${(0.25 * e).toFixed(3)})`);
            gr.addColorStop(1, 'rgba(120, 170, 255, 0)');
            ctx.fillStyle = gr;
            ctx.fillRect(s.x - wr, s.y - wr, wr * 2, wr * 2);
            // The forks: glow, then body, then the white core.
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            const trace = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); };
            const passes = [[26, `rgba(120, 165, 255, ${(0.22 * e).toFixed(3)})`], [11, `rgba(160, 195, 255, ${(0.35 * e).toFixed(3)})`], [5, `rgba(210, 226, 255, ${(0.6 * e).toFixed(3)})`], [2.2, `rgba(255, 255, 255, ${Math.min(1, e).toFixed(3)})`]];
            for (const [w, col] of passes) {
                ctx.lineWidth = w; ctx.strokeStyle = col;
                trace(s.f.main);
                ctx.lineWidth = w * 0.6;
                for (const b of s.f.br) trace(b);
            }
            ctx.restore();
        }
    }

    // The flash: the whole screen, for the first stroke and the return strokes.
    function drawFlash(ctx) {
        const v = V();
        if (!v || !v.strikes.length) return;
        let e = 0;
        for (const s of v.strikes) e = Math.max(e, boltEnv(v.t - s.t0));
        if (e <= 0.02) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(236, 242, 255, ${(0.32 * Math.min(1, e)).toFixed(3)})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    }

    function reset() { if (typeof state !== 'undefined') state.volcano = null; _bake = null; }

    window.Volcano = {
        init, update, reset, puffSprites,
        windMul, boilAt, chargeOf, fryOf, isFried,
        hudFried, glitch, garble, applyHudClasses, drawMinimapFry,
        drawVeil, drawBoils, drawStrikes, drawFlash,
        intensityOf, active: () => !!V()
    };
})();
