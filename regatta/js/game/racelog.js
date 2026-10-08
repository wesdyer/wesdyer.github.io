// regatta/js/game/racelog.js — THE RACE'S OWN LOG, for the results page (PT-007, Oct 2026).
//
// Wes: the race results wanted what the Time Trial page has — the course on the chart with your track —
// plus a REPLAY of the fleet, where you won and lost places, and your own race leg by leg: tacks, gybes,
// overtakes. The Time Trial records only you (TimeTrial._rec); this records every boat, at RACELOG_DT
// of race clock, from the prestart to each boat's finish, and counts the player's race as it goes.
//
// ⚠️ IT ONLY READS. Nothing here writes to a boat, to raceState (whose shape is in the trace hash) or to
// the course, and nothing reads Math.random() — the simulation's seeded stream. A race sails the same with
// or without it. The eval harness skips it outright: the benches run thousands of races nobody looks at.
//
// Classic script; global scope. Loads after timetrial.js; script.js calls onReset()/update().

const RACELOG_DT = 0.5;            // seconds of race clock between samples
const RACELOG_HOLD = 3;            // a place swap has to hold this long (s) to be an overtake, not a rounding's flicker

const RaceLog = {
    t0: null,                      // race clock of the first sample (negative: prestart)
    next: 0,
    boats: [],                     // per boat, in state.boats order: { boat, s: [[x, y, heading×1000, leg, progress, kite, sog in tenths of a knot]], done }
    me: null,                      // the player's counts: { tacks: {leg: n}, gybes, passed, passedBy, hits, pens }
    events: [],                    // the player's race on the clock: { t, kind: 'leg'|'pen'|'pass'|'passedBy'|'hit', leg, who }
    legStart: {},                  // race clock each of the player's legs began (0 = the gun)
    _side: null, _pairs: null, _pen: 0, _leg: 0, _lastHit: -1e9, _on: false,

    // A fleet race the player is in: not a Time Trial (one boat), not the eval harness.
    enabled() { return !window.evalHarness && state.boats && state.boats.length > 1; },
    _clock() { const r = state.race; return r.status === 'prestart' ? -r.timer : r.timer; },

    onReset() {
        this.t0 = null; this.next = 0; this.boats = []; this.events = []; this.legStart = {}; this._fin = false;
        this._ahead = null; this._aheadLeg = -1;
        this.me = { tacks: {}, gybes: {}, passed: {}, passedBy: {}, hits: {}, pens: {}, place: {} };
        this._side = null; this._pairs = null; this._pen = 0; this._leg = 0; this._lastHit = -1e9;
        this._on = false;
    },

    update() {
        if (!this.enabled()) return;
        if (this.t0 != null) this._legWatch();   // first: the finish that ends the race must still be counted
        const st = state.race.status;
        if (st !== 'prestart' && st !== 'racing') return;
        const t = this._clock();
        if (this.t0 == null) {
            this.t0 = t; this.next = t; this._on = true;
            this.boats = state.boats.map(b => ({ boat: b, s: [], done: false }));
        }
        while (t >= this.next) { this._sample(this.next); this.next += RACELOG_DT; }
    },

    // WHO IS AHEAD OF YOU, at the very frame each of your legs begins and ends — the engine's own rule
    // (fleetRank: course progress, finished boats by their time), so a leg's "passed" and "lost to" are the
    // boats that changed sides over it, and passed − lost to is exactly the place it won or lost.
    _aheadNow(me) {
        const A = me.raceState, pA = getBoatProgress(me), out = new Set();
        for (const o of state.boats) { if (o === me) continue; const B = o.raceState;
            if (B.finished !== A.finished) { if (B.finished) out.add(o); continue; }
            if (A.finished) { if (B.finishTime < A.finishTime) out.add(o); continue; }
            if (getBoatProgress(o) > pA) out.add(o); }
        return out;
    },
    _legWatch() {
        if (state.race.status !== 'racing' && state.race.status !== 'finished') return;
        const me = state.boats.find(b => b.isPlayer); if (!me || this._aheadLeg > (me.raceState.finished ? 1e9 : me.raceState.leg)) return;
        const leg = me.raceState.finished ? 1e9 : me.raceState.leg;
        if (leg === this._aheadLeg) return;
        const now = this._aheadNow(me), M = this.me;
        if (this._ahead) {
            const done = this._aheadLeg;   // the leg that just ended (0 = gun to the line)
            for (const o of this._ahead) if (!now.has(o)) M.passed[done] = (M.passed[done] || 0) + 1;
            for (const o of now) if (!this._ahead.has(o)) M.passedBy[done] = (M.passedBy[done] || 0) + 1;
            M.place[done] = now.size + 1;   // your place as the leg ended, on the same count
        }
        this._ahead = now; this._aheadLeg = leg;
    },

    _sample(t) {
        const me = state.boats.find(b => b.isPlayer);
        for (const B of this.boats) {
            const b = B.boat;
            if (B.done) continue;
            const v = b.velocity || { x: 0, y: 0 };
            const prog = typeof getBoatProgress === 'function' ? Math.round(getBoatProgress(b)) : 0;
            B.s.push([Math.round(b.x), Math.round(b.y), Math.round(b.heading * 1000), b.raceState.leg, prog,
                      b.spinnaker ? 1 : 0, Math.round(Math.hypot(v.x, v.y) * 40)]);   // speed over the ground, tenths of a knot (as TimeTrial's [7])
            if (b.raceState.finished) B.done = true;
        }
        if (me && !me.raceState.finished) this._count(me, t);
        else if (me && !this._fin) { this._fin = true; this.events.push({ t: me.raceState.finishTime, kind: 'leg', leg: this._leg }); }
    },

    // THE PLAYER'S RACE, counted as it is sailed.
    _count(me, t) {
        const rs = me.raceState, leg = rs.leg, M = this.me, inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
        // Legs and penalties land on the clock, for the replay's ticks.
        if (this.legStart[0] == null && state.race.status === 'racing') this.legStart[0] = 0;
        if (leg !== this._leg) { if (leg > this._leg && this._leg >= 1) this.events.push({ t, kind: 'leg', leg: this._leg }); if (leg > this._leg) this.legStart[leg] = t; this._leg = leg; }
        const pens = rs.totalPenalties || 0;
        if (pens > this._pen) { for (let k = this._pen; k < pens; k++) { inc(M.pens, leg); this.events.push({ t, kind: 'pen', leg }); } }
        this._pen = pens;
        // TACKS AND GYBES: the wind changes sides. Through the eye of the wind it is a tack, through the
        // run a gybe. A dead band either side of head-to-wind and dead-downwind keeps a boat sitting there
        // from counting both ways.
        const w = typeof getWindAt === 'function' ? getWindAt(me.x, me.y) : state.wind;
        const twa = normalizeAngle(me.heading - w.direction), a = Math.abs(twa);
        if (a > 0.09 && a < Math.PI - 0.09) {
            const side = twa > 0 ? 1 : -1;
            if (this._side != null && side !== this._side) inc(a < Math.PI / 2 ? M.tacks : M.gybes, leg);
            this._side = side;
        }
        // OVERTAKES, from the gun: who is ahead on the course (finished boats by their finish time, the rest by
        // course progress). A swap counts once it has held RACELOG_HOLD seconds — a rounding blends progress for
        // a moment and two boats abreast trade places every sample, and neither is an overtake.
        if (state.race.status !== 'racing') return;
        const key = (b) => b.raceState.finished ? 1e9 - (b.raceState.finishTime || 0) : getBoatProgress(b);
        const mine = key(me);
        if (!this._pairs) this._pairs = new Map();
        for (const B of this.boats) {
            const b = B.boat; if (b === me) continue;
            const ahead = key(b) > mine;
            let P = this._pairs.get(b);
            if (!P) { this._pairs.set(b, { ahead, cand: ahead, since: t }); continue; }
            if (ahead !== P.cand) { P.cand = ahead; P.since = t; }
            if (P.cand !== P.ahead && t - P.since >= RACELOG_HOLD) {
                P.ahead = P.cand;
                // the MOMENT, for the replay's ticks; the leg table counts from _legWatch
                if (P.ahead) this.events.push({ t: P.since, kind: 'passedBy', leg, who: b.name });
                else this.events.push({ t: P.since, kind: 'pass', leg, who: b.name });
            }
        }
    },

    _hit() {
        if (!this._on || state.race.status !== 'racing') return;
        const me = state.boats && state.boats.find(b => b.isPlayer); if (!me || me.raceState.finished) return;
        const t = this._clock(), leg = me.raceState.leg;
        if (t - this._lastHit > 1.0) { this.me.hits[leg] = (this.me.hits[leg] || 0) + 1; this.events.push({ t, kind: 'hit', leg }); }
        this._lastHit = t;
    },

    // Boat i at race clock t (interpolated), or null before its first sample; a finished boat stays on its line.
    poseAt(i, t) {
        const B = this.boats[i]; if (!B || !B.s.length || this.t0 == null) return null;
        const f = (t - this.t0) / RACELOG_DT;
        if (f < 0) return null;
        const n = B.s.length, j = Math.min(Math.floor(f), n - 1), k = j >= n - 1 ? 0 : f - j, a = B.s[j], b = B.s[Math.min(j + 1, n - 1)];
        const ha = a[2] / 1000, hb = b[2] / 1000, dh = Math.atan2(Math.sin(hb - ha), Math.cos(hb - ha));
        return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, heading: ha + dh * k, leg: a[3], kite: !!a[5], ended: f > n - 1 && B.done };
    },
    tMax() { let n = 0; for (const B of this.boats) n = Math.max(n, B.s.length); return this.t0 == null ? 0 : this.t0 + (n - 1) * RACELOG_DT; },
};
if (typeof GameEvents !== 'undefined') {
    GameEvents.on('player-contact', () => RaceLog._hit());
    GameEvents.on('player-feat', (e) => { if (e && e.id === 'close:touch') RaceLog._hit(); });
}

window.RaceLog = RaceLog;
