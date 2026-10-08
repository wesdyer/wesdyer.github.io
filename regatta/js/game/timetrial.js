// regatta/js/game/timetrial.js — TIME TRIALS: a solo race against the clock and your own ghost.
//
// Wes, Sep 27 2026: the clubhouse's Time Trials door is solo — no fleet, just you, the course and
// the ghost of your best run there — and racing the fleet moved to the Race door (one race or a
// series of up to twelve, js/game/series.js). Records and target times are set here and only
// here; a solo race counts for the venue rungs about the course and nothing about a fleet
// (Unlocks.soloCounts).
//
// THE GHOST is the player's own best finished run at the venue, sampled every SAMPLE_DT seconds
// of the race clock (prestart included, as negative time) and kept per venue AND records hash:
// a physics edit that retires the records book retires the ghost with it. It is drawn as your
// own boat at a third opacity, and never touches the simulation.
//
// ⚠️ NOTHING HERE READS Math.random() — it is the simulation's seeded stream.
//
// Classic script; global scope. Loads after series.js; screens.js flips `active` from the doors.

const GHOSTS_KEY = 'regatta_ghosts';
const GHOST_SAMPLE_DT = 0.25;

const TimeTrial = {
    active: false,           // set by the Time Trials door, cleared by every other door
    _rec: null,              // this run: { t0, next, s: [[x, y, heading*1000, boom, kite], ...] }
    _gh: null, _ghKey: null, // the run to beat ({ t, t0, s, ... }) and the venue:hash:legs it was loaded for — see `_ghost`
    _saved: false,

    // A solo race: the Time Trials door, and not a cup, a race series, the school or the eval harness.
    solo() {
        return this.active && !(window.Series && Series.active) && !(window.School && School.active) && !window.evalHarness;
    },
    _clock() { const r = state.race; return r.status === 'prestart' ? -r.timer : r.timer; },
    _key(venue) {
        const v = venue || settings.venue;
        const h = typeof recordsVenueHash === 'function' ? recordsVenueHash(v) : 'r1-none';
        return `${v}:${h}:${state.race.totalLegs || 0}`;
    },
    _all() { try { return JSON.parse(localStorage.getItem(GHOSTS_KEY)) || {}; } catch (e) { return {}; } },
    ghostFor(venue) { return this._all()[this._key(venue)] || null; },

    // A new race was built (resetGame): start recording, load the ghost.
    onReset() {
        this._rec = null; this._saved = false; this._lb = null;
        this._gh = null; this._ghKey = null;   // re-read on first use, for whatever venue is up then
    },
    // Every sim step: sample the player, and at the line keep the run if it beat the ghost.
    update() {
        if (!this.solo()) return;
        const me = state.boats && state.boats[0];
        if (!me || !me.isPlayer) return;
        const st = state.race.status;
        if (st !== 'prestart' && st !== 'racing') return;
        const t = this._clock();
        if (!this._rec) this._rec = { t0: t, next: t, s: [], hits: {}, lastHit: -1e9 };
        const R = this._rec;
        if (!me.raceState.finished) {
            while (t >= R.next) {
                // [x, y, heading×1000, boom side, kite, course progress (getBoatProgress), leg] — the last two put
                // the ghost on the leaderboard with a distance, like a boat in a race
                const prog = typeof getBoatProgress === 'function' ? Math.round(getBoatProgress(me)) : 0;
                // ...then the instruments at that moment, for the results chart's hover (tenths of a knot, degrees):
                // [7] speed over the ground, [8] speed through the water, [9] wind speed, [10] wind angle SIGNED
                // (negative = starboard tack, as Rules.getTack), [11] speed made good toward/away from the wind, [12] planing
                const w = typeof getWindAt === 'function' ? getWindAt(me.x, me.y) : state.wind, v = me.velocity || { x: 0, y: 0 };
                const twa = normalizeAngle(me.heading - w.direction);
                R.s.push([Math.round(me.x), Math.round(me.y), Math.round(me.heading * 1000), me.boomSide > 0 ? 1 : -1, me.spinnaker ? 1 : 0, prog, me.raceState.leg,
                    Math.round(Math.hypot(v.x, v.y) * 40), Math.round(me.speed * 40), Math.round(w.speed * 10), Math.round(twa * 180 / Math.PI),
                    Math.round(Math.abs(v.x * Math.sin(w.direction) - v.y * Math.cos(w.direction)) * 40), me.raceState.isPlaning ? 1 : 0,
                    // ...and the TRIM, so the ghost's sails are set the way yours were: [13] main sheeting angle ×1000,
                    // [14] boom side ×100 (the swing, not just the side), [15] kite deployed ×100, [16] luff ×100
                    Math.round((me.sailAngle || 0) * 1000), Math.round((me.boomSide || 0) * 100),
                    Math.round((me.spinnakerDeployProgress || 0) * 100), Math.round((me.luffIntensity || 0) * 100)]);
                R.next += GHOST_SAMPLE_DT;
            }
        } else if (!this._saved) {
            this._saved = true;
            const rs = me.raceState;
            if (rs.resultStatus || !(rs.finishTime > 0)) return;
            const prev = this.ghostFor();
            if (prev && prev.t <= rs.finishTime) return;
            // Beating a ghost you already had (not founding the first one) — Phantom's 'Ghost Story' counts the venues.
            if (prev && typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: 'ghost:beaten' });
            const all = this._all();
            // The ghost is the boat you sailed it in: that character's name and livery (Wes, Sep 27 2026).
            all[this._key()] = { t: rs.finishTime, t0: R.t0, s: R.s, char: me.name, at: Date.now(),
                                 colors: Object.assign({}, me.colors), spinPattern: me.spinPattern,
                                 start: rs.startLegDuration != null ? rs.startLegDuration : null, legs: (rs.legTimes || []).slice() };
            try { localStorage.setItem(GHOSTS_KEY, JSON.stringify(all)); } catch (e) { /* no store: this session only */ }
        }
    },
    // Where the ghost is at race-clock t (interpolated), or null before its start / after its finish.
    poseAt(t) {
        const g = this._ghost;
        if (!g || !g.s || !g.s.length) return null;
        const f = (t - g.t0) / GHOST_SAMPLE_DT;
        if (f < 0 || f > g.s.length - 1) return null;
        const i = Math.floor(f), k = f - i, a = g.s[i], b = g.s[Math.min(i + 1, g.s.length - 1)];
        const ha = a[2] / 1000, hb = b[2] / 1000, dh = Math.atan2(Math.sin(hb - ha), Math.cos(hb - ha));
        const lerp = (j, d) => a[j] == null ? null : (a[j] + ((b[j] == null ? a[j] : b[j]) - a[j]) * k) / d;
        return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, heading: ha + dh * k, boom: a[3], kite: !!a[4],
                 sail: lerp(13, 1000), boomSide: lerp(14, 100), kiteP: lerp(15, 100), luff: lerp(16, 100),
                 prog: a[5] != null ? a[5] + ((b[6] === a[6] ? b[5] : a[5]) - a[5]) * k : null, leg: a[6] != null ? a[6] : null };
    },
    // Your own boat, where your best run was at this moment, at a third opacity. Under the fleet layer.
    drawGhost(ctx) {
        if (!this.solo() || !this._ghost || typeof drawBoat !== 'function') return;
        const st = state.race.status;
        if (st !== 'prestart' && st !== 'racing' && st !== 'finished') return;
        const me = state.boats && state.boats[0];
        const p = this.poseAt(this._clock());
        if (!me || !p) return;
        // Your boat as it was: the character's livery, the sails trimmed as you trimmed them (older ghosts, without
        // the trim, fall back to the side and a full kite).
        const G = this._ghost;
        const g = Object.assign(Object.create(Object.getPrototypeOf(me)), me,
            { x: p.x, y: p.y, heading: p.heading, boomSide: p.boomSide != null ? p.boomSide : p.boom, targetBoomSide: p.boom, spinnaker: p.kite,
              spinnakerDeployProgress: p.kiteP != null ? p.kiteP : (p.kite ? 1 : 0), opacity: 0.35, turbulence: [],
              colors: G.colors || me.colors, spinPattern: G.spinPattern != null ? G.spinPattern : me.spinPattern, isPlayer: false });
        if (p.sail != null) g.sailAngle = p.sail;
        if (p.luff != null) g.luffIntensity = p.luff;
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.heading);
        drawBoat(ctx, g);
        ctx.restore();
    },
    // The ghost's time, and its splits (start, then each leg) — for the leg-time chips and the results.
    ghostTime() { return this._ghost ? this._ghost.t : null; },
    ghostSplits() { const g = this._ghost; return g && g.legs ? { start: g.start, legs: g.legs } : null; },
    // THE GHOST ON THE LEADERBOARD: a stand-in boat with just what updateLeaderboard reads — a raceState with
    // leg / finished / finishTime, and its course progress (`ghostProgress`, read instead of getBoatProgress).
    // One object for the whole race, so the row's rank and trend arrow carry over like a real boat's.
    leaderEntry() {
        if (!this.solo() || !this._ghost || !this._ghost.s || !this._ghost.s.length || this._ghost.s[0][5] == null) return null;
        const st = state.race.status; if (st !== 'racing' && st !== 'finished') return null;
        const me = state.boats && state.boats[0]; if (!me) return null;
        const g = this._ghost, t = this._clock();
        const e = this._lb && this._lb.src === g ? this._lb
            : (this._lb = { src: g, id: 'ghost', name: 'Ghost', face: g.char || me.name, isGhost: true, colors: g.colors || me.colors,
                            raceState: { finished: false, finishTime: 0, leg: 0, resultStatus: null } });
        if (t >= g.t) { e.raceState.finished = true; e.raceState.finishTime = g.t; e.raceState.leg = state.race.totalLegs + 1; e.ghostProgress = null; }
        else {
            const p = this.poseAt(t) || { prog: 0, leg: 0 }; e.raceState.finished = false;
            // RE-RANKED LIVE from where the ghost is (PT-006), on the same continuous ranking as your
            // boat — a saved run's recorded progress was measured on whatever ranking shipped when it
            // was sailed, and a changed ranking would set it against yours on two scales.
            const GR = state.course && (state.course.goalFieldsRank || state.course.goalFields);
            if (p.x != null && p.leg != null && GR && GR.rankable && typeof courseRemaining === 'function') {
                trackRankState(e.raceState, p.x, p.y, p.heading || 0, p.leg);
                const rem = courseRemaining(GR, { x: p.x, y: p.y, raceState: e.raceState });
                e.ghostProgress = rem != null ? GR.total - rem : (p.prog || 0);
            } else { e.raceState.leg = p.leg || 0; e.ghostProgress = p.prog || 0; }
        }
        return e;
    },
};

// COLLISIONS, per leg, for the results: a contact EPISODE — land, ice, a whale (player-contact) or a mark
// (close:touch) — counted once, and again only after a second clear of anything. Both events fire every
// frame of a grind, so the debounce is what makes it a count of hits rather than of frames.
TimeTrial.hitsByLeg = function () { return (this._rec && this._rec.hits) || {}; };
TimeTrial._hit = function () {
    if (!this.solo() || !this._rec || state.race.status !== 'racing') return;
    const me = state.boats && state.boats[0]; if (!me || me.raceState.finished) return;
    const t = this._clock(), R = this._rec;
    if (t - R.lastHit > 1.0) { const leg = me.raceState.leg; R.hits[leg] = (R.hits[leg] || 0) + 1; (R.hitT = R.hitT || []).push({ t, leg }); }   // ...and when, for the replay's ticks
    R.lastHit = t;
};
if (typeof GameEvents !== 'undefined') {
    GameEvents.on('player-contact', () => TimeTrial._hit());
    GameEvents.on('player-feat', (e) => { if (e && e.id === 'close:touch') TimeTrial._hit(); });
}

// ⚠️ THE GHOST IS READ FOR THE VENUE THAT IS UP *NOW*, not the one that was up at the last resetGame. Picking a
// venue on the board is a light build with no reset, so a ghost loaded once and held showed the LAST venue's run
// wandering over the new one (Wes, Sep 27 2026: Lighthouse Cove's track drawn across Emberfall). The key is
// checked on every read — recordsVenueHash is cached — and a new key reloads. Within one race the key holds, so
// a run that just beat its ghost still compares against the old one on its results page. Setting it (New Game
// clears it with null) drops the cache.
Object.defineProperty(TimeTrial, '_ghost', {
    get() {
        if (!this.solo()) return null;
        const k = this._key();
        if (k !== this._ghKey) { this._ghKey = k; this._gh = this.ghostFor(); this._lb = null; }
        return this._gh;
    },
    set(v) { this._gh = v; this._ghKey = v ? this._key() : null; },
});

if (typeof window !== 'undefined') window.TimeTrial = TimeTrial;
