// GOLDEN TRACE HARNESS — deterministic whole-system characterization.
//
// Purpose: prove a refactor did not change behaviour. Runs a seeded race and
// hashes every observable quantity on every frame. Identical hash before and
// after a change ⇒ the change was behaviour-preserving, for that venue and seed.
//
// This is the safety net for the marks[0..3] -> marks[]+route[] refactor, which
// touches ~60 sites including the rules engine. It is deliberately stricter than
// the AI eval (which compares summary statistics and would not notice a boat
// taking a different path to the same finish time).
//
// TWO HASHES, and the distinction matters:
//
//   behaviorHash    boats + wind + race events, every frame. MUST be identical
//                   across a pure refactor. This is the gate.
//   courseGeomHash  course GEOMETRY (mark endpoints, boundary, island vertices)
//                   — not field names, so a schema change alone does not move it.
//                   Expected to change only where a course legitimately gains or
//                   loses marks (e.g. islandRound dropping its two fake marks).
//
// Determinism notes:
//   - Math.random is replaced before resetGame(), as in eval_harness.js.
//   - requestAnimationFrame is stubbed so the game does not self-drive.
//   - Values are quantized to 1e-6 before hashing: far below anything meaningful
//     (the hull is 30 world units) but it normalizes -0 and keeps the hash from
//     depending on the last bit of a denormal.
(function () {

// ---------------------------------------------------------------------------
// Hashing. Two independent 32-bit streams combined into one 64-bit hex digest;
// collision probability across a few hundred traces is negligible. Numbers are
// hashed by their bit pattern via a typed-array view rather than by string
// conversion, which is both exact and much faster.
// ---------------------------------------------------------------------------
const _f64 = new Float64Array(1);
const _u32 = new Uint32Array(_f64.buffer);

function Hasher() { this.a = 0x811c9dc5 | 0; this.b = 0x01000193 | 0; }

Hasher.prototype.mix = function (w) {
    // Two different avalanche constants so the streams stay independent.
    let a = (this.a ^ w) | 0;
    a = Math.imul(a ^ (a >>> 16), 0x85ebca6b);
    a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
    this.a = (a ^ (a >>> 16)) | 0;

    let b = (this.b + w) | 0;
    b = Math.imul(b ^ (b >>> 15), 0x2545f491);
    b = Math.imul(b ^ (b >>> 12), 0x9e3779b1);
    this.b = (b ^ (b >>> 14)) | 0;
};

Hasher.prototype.num = function (v) {
    if (v === null || v === undefined) { this.mix(0x4e554c4c); return; }
    if (typeof v === 'boolean') { this.mix(v ? 0x54525545 : 0x46414c53); return; }
    if (typeof v === 'string') { this.str(v); return; }
    if (typeof v !== 'number' || !isFinite(v)) { this.mix(0x4e614e00); return; }
    // Quantize, then normalize -0 to 0 (they compare equal but have distinct bits).
    let q = Math.round(v * 1e6) / 1e6;
    if (q === 0) q = 0;
    _f64[0] = q;
    this.mix(_u32[0]);
    this.mix(_u32[1]);
};

Hasher.prototype.str = function (s) {
    s = String(s);
    for (let i = 0; i < s.length; i++) this.mix(s.charCodeAt(i));
    this.mix(s.length);
};

Hasher.prototype.digest = function () {
    const hi = (this.a >>> 0).toString(16).padStart(8, '0');
    const lo = (this.b >>> 0).toString(16).padStart(8, '0');
    return hi + lo;
};

// ---------------------------------------------------------------------------

window.traceHarness = {

    // Bump whenever hashFrame/hashCourseGeom changes WHAT is observed. Goldens
    // record it, so a stale golden reports "observation changed" instead of
    // masquerading as a behaviour regression.
    //   1 -> 2: raceState gained roundSweep/roundArmed. They existed before but were
    //           created mid-race, and the key list is built at race start, so
    //           rounding progress was never actually hashed.
    //   2 -> 3: raceState gained roundWrong — wrong-way detection split out of
    //           roundSweep so progress could be clamped at zero.
    //   3 -> 4: rounding split into pass-within (the zone arms it) and go-round-it
    //           (sweep counts out to 2.5x the zone), so a wide rounding registers.
    //   4 -> 5: rounding completes on DEPARTURE judged by the sweep's SIGN, not by a
    //           magnitude threshold. A straight line past a mark sweeps ~180 degrees on
    //           its own, and a triangle corner needs far less, so no fixed number works.
    //   5 -> 6: the authored `beat` flag is gone. Leg direction is derived from the mean
    //           wind (legGoesUpwind, for laylines and zones) and point of sail is asked
    //           of the BOAT (pointOfSail, for RRS 18.1(a) and character stats).
    OBS_VERSION: 6,

    seed: 0,

    // Same Mulberry32 the AI eval uses, so a trace and an eval on the same seed
    // see the same stream.
    random: function () {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    init: function () {
        Math.random = () => this.random();
        if (window.settings) {
            window.settings.soundEnabled = false;
            window.settings.bgSoundEnabled = false;
            window.settings.musicEnabled = false;
        }
        window.requestAnimationFrame = (cb) => { this.loopCallback = cb; };
    },

    // -----------------------------------------------------------------------
    // What we observe. Every field here is something a refactor could plausibly
    // break; the rules-engine fields are included specifically because the marks
    // refactor touches rules.js, and a penalty regression would otherwise pass
    // silently behind unchanged boat positions.
    // -----------------------------------------------------------------------
    // Key lists are computed once per run and reused: every boat has the same
    // shape, and sorting 60 keys per boat per frame would dominate the cost.
    _keys: null,

    primitiveKeys: function (o) {
        const out = [];
        for (const k in o) {
            if (k.charAt(0) === '_') continue;            // caches / sprites
            const t = typeof o[k];
            if (t === 'number' || t === 'boolean' || t === 'string') out.push(k);
        }
        return out.sort();
    },

    buildKeys: function () {
        const b = window.state.boats[0];
        this._keys = {
            boat: this.primitiveKeys(b),
            race: this.primitiveKeys(b.raceState),
            ctrl: b.controller ? this.primitiveKeys(b.controller) : [],
            wind: this.primitiveKeys(window.state.wind)
        };
    },

    // Hash EVERY primitive on the boat, its raceState and its controller. Chasing
    // a divergence through a narrow field set is hopeless: the origin is usually
    // an unobserved intermediate (rudder, leeway, a controller timer) that only
    // reaches position several seconds later. Observing everything makes the
    // first divergent frame the actual cause.
    hashFrame: function (h) {
        const st = window.state;
        if (!this._keys) this.buildKeys();
        const K = this._keys;

        h.num(st.race.timer);
        h.str(st.race.status);
        for (const k of K.wind) h.num(st.wind[k]);
        h.num(st.time);

        const boats = st.boats;
        h.num(boats.length);
        for (let i = 0; i < boats.length; i++) {
            const b = boats[i];
            for (const k of K.boat) h.num(b[k]);
            const rs = b.raceState;
            for (const k of K.race) h.num(rs[k]);
            if (b.controller) for (const k of K.ctrl) h.num(b.controller[k]);
            // Nested structs the key sweep cannot see.
            if (b.apparentWind) { h.num(b.apparentWind.speed); h.num(b.apparentWind.angle); }
            if (rs.nextWaypoint) { h.num(rs.nextWaypoint.x); h.num(rs.nextWaypoint.y); }
            if (b.controller && b.controller.path) h.num(b.controller.path.length);
        }
    },

    // Course GEOMETRY, independent of how the schema names things.
    hashCourseGeom: function () {
        const h = new Hasher();
        const c = window.state.course;
        if (!c) { h.str('nocourse'); return h.digest(); }

        const marks = c.marks || [];
        h.num(marks.length);
        for (const m of marks) {
            // Handle both today's flat {x,y} marks and the coming
            // {kind,a,b} / {kind,x,y,radius} forms, geometrically.
            if (m.a && m.b) { h.num(m.a.x); h.num(m.a.y); h.num(m.b.x); h.num(m.b.y); }
            else { h.num(m.x); h.num(m.y); }
            if (m.radius != null) h.num(m.radius);
            if (m.zone != null) h.num(m.zone);
        }

        const rm = c.roundMark;
        if (rm) { h.str('round'); h.num(rm.x); h.num(rm.y); h.num(rm.radius); h.num(rm.zone); h.str(rm.side); }

        const b = c.boundary;
        if (b) { h.num(b.x); h.num(b.y); h.num(b.radius); }

        // Islands: count plus a checksum over every vertex. Catches a geography
        // change without storing thousands of coordinates.
        const isl = c.islands || [];
        h.num(isl.length);
        for (const i of isl) {
            h.num(i.x); h.num(i.y); h.num(i.radius);
            h.str(i.style || '');
            h.num(!!i.soft);
            const vs = i.vertices || [];
            h.num(vs.length);
            for (const v of vs) { h.num(v.x); h.num(v.y); }
        }
        return h.digest();
    },

    // Compact, human-readable snapshot for localizing a hash mismatch.
    checkpoint: function () {
        const st = window.state;
        return {
            t: Math.round(st.race.timer * 100) / 100,
            status: st.race.status,
            wind: Math.round(st.wind.direction * 1e4) / 1e4,
            boats: st.boats.map(b => ({
                id: b.id,
                x: Math.round(b.x * 100) / 100,
                y: Math.round(b.y * 100) / 100,
                h: Math.round(b.heading * 1e4) / 1e4,
                s: Math.round(b.speed * 1e3) / 1e3,
                leg: b.raceState.leg,
                pen: b.raceState.totalPenalties,
                fin: !!b.raceState.finished
            }))
        };
    },

    // -----------------------------------------------------------------------
    runTrace: function (seed, opts) {
        opts = opts || {};
        const timeLimit = opts.timeLimit || 420;
        const cpEvery = opts.checkpointEvery || 30;   // seconds of race time

        this.seed = seed;
        const events = [];
        window.onRaceEvent = (type, data) => {
            // Ordered event log: a reordering is a behaviour change even when
            // the final tallies match.
            events.push({
                type,
                boat: data && data.boat ? data.boat.id : null,
                other: data && data.other ? data.other.id : null,
                leg: data && data.leg != null ? data.leg : null,
                t: Math.round((window.state.race.timer || 0) * 1000) / 1000
            });
        };

        // Leg count is NOT persisted in settings (it lives on state.race, and
        // resetGame preserves a non-zero value), so without this every trace runs
        // the default 4 legs — which never exercises legs 5+ even though the UI
        // offers up to 10.
        if (opts.legs) window.state.race.totalLegs = opts.legs;

        window.resetGame();
        window.startRace();
        this._keys = null;   // boats are rebuilt each race; re-derive the shape

        const courseGeomHash = this.hashCourseGeom();
        // State immediately after setup, before a single update(). If this differs
        // between two runs of the same seed, the leak is in reset/course setup; if
        // it matches and behaviorHash diverges, the leak is in the update path.
        const ih = new Hasher();
        this.hashFrame(ih);
        const initHash = ih.digest();

        const h = new Hasher();
        const checkpoints = [];
        let nextCp = 0;

        const dt = 1 / 60;
        const maxIter = (timeLimit + 100) * 60;
        let iter = 0, frames = 0;
        // Per-frame digests, for bisecting exactly where two runs diverge.
        const frameHashes = opts.frameHashes ? [] : null;

        while (iter < maxIter) {
            if (window.state.race.status === 'racing') {
                if (window.state.race.timer > timeLimit) break;
                if (window.state.boats.every(b => b.raceState.finished)) break;
            }
            // Once the race is over there is nothing left to characterize, and
            // spinning to maxIter cost ~4000 wasted frames per trace.
            if (window.state.race.status === 'finished') break;
            if (opts.stopAtFrame != null && frames >= opts.stopAtFrame) break;
            window.update(dt);
            iter++;

            this.hashFrame(h);
            if (frameHashes) {
                const fh = new Hasher();
                this.hashFrame(fh);
                frameHashes.push(fh.digest());
            }
            frames++;

            if (window.state.race.status === 'racing' && window.state.race.timer >= nextCp) {
                checkpoints.push(this.checkpoint());
                nextCp += cpEvery;
            }
        }

        // Fold the event log in last so ordering is part of the digest.
        h.num(events.length);
        for (const e of events) { h.str(e.type); h.num(e.boat); h.num(e.other); h.num(e.leg); h.num(e.t); }

        return {
            seed,
            frames,
            obsVersion: this.OBS_VERSION,
            behaviorHash: h.digest(),
            courseGeomHash,
            initHash,
            eventCount: events.length,
            frameHashes,
            checkpoints,
            // Full boat state at the stopping frame — for diffing two runs once
            // frameHashes has told us which frame to look at.
            finalState: opts.stopAtFrame != null ? window.state.boats.map(b => {
                const o = { id: b.id };
                for (const k of this._keys.boat) o['b.' + k] = b[k];
                for (const k of this._keys.race) o['r.' + k] = b.raceState[k];
                if (b.controller) for (const k of this._keys.ctrl) o['c.' + k] = b.controller[k];
                if (b.apparentWind) { o['aw.speed'] = b.apparentWind.speed; o['aw.angle'] = b.apparentWind.angle; }
                if (b.controller && b.controller.path) o['c.path.n'] = b.controller.path.length;
                return o;
            }) : null,
            windState: opts.stopAtFrame != null ? Object.assign({}, window.state.wind) : null,
            summary: {
                raceTime: Math.round((window.state.race.timer || 0) * 100) / 100,
                finished: window.state.boats.filter(b => b.raceState.finished).length,
                dnf: window.state.boats.filter(b => b.raceState.resultStatus === 'DNF').length,
                dns: window.state.boats.filter(b => b.raceState.resultStatus === 'DNS').length,
                penalties: window.state.boats.reduce((a, b) => a + (b.raceState.totalPenalties || 0), 0),
                courseType: (window.state.course && window.state.course.type) || null,
                islands: (window.state.course && window.state.course.islands || []).length,
                // What the race actually sailed, which is not always what was asked for:
                // a DESIGNED course's leg count is authored, and the request is a player
                // preference the design overrides. Recorded so run_traces can say so
                // instead of writing a file named for a leg count nobody sailed.
                legs: window.state.race.totalLegs
            }
        };
    }
};

window.traceHarness.init();
})();
