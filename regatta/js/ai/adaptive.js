// regatta/js/ai/adaptive.js — ADAPTIVE AI (PT-003): the fleet pushes when you run away and
// eases when you trail, so a race stays a race. Classic script, global scope; loads after the
// rest of the AI. Read by updateBoat (js/sim/physics.js) as `boat._adaptMul` on target speed.
//
// THE POLICY (Wes, Oct 3 2026 — after a survey of racing-game rubber banding; Game AI Pro
// ch. 42 is the reference shape):
//   * a SETTING (Adaptive AI, on by default); single races and series races only — never a
//     Time Trial or the School. It touches the BOTS ONLY: the player's boat is never changed.
//   * the lever is a flat % of target speed, not stats, so every character keeps its
//     character — a downwind specialist is still one, a touch faster or slower overall.
//   * each bot's gap to the player is measured in SECONDS on the leaderboard's own continuous
//     progress (courseRemaining), smoothed over ~5 s so the band cannot twitch.
//   * DEAD ZONE ±3 s: no effect at all where the racing is close. Then a TWO-STEP ramp: up to
//     +5% at 12 s — subtle, for the gaps where the chaser is often still on screen — and on up
//     to +10% at 20 s, for a race that has come apart. Bots AHEAD are held back at most HALF the
//     same curve (−2.5% at 12 s, −5% at 20 s), by the pack's average gap so their order and
//     spacing hold (anti-bunching).
//   * the multiplier moves at most 1% a second — no visible bursts.
//   (v1 was ±5 s, one ramp to +5% at 20 s, 0.5%/s and a two-zone mark fade: on Wes's three
//   Pearl Lagoon test races his lead sat at 5–8 s and the chaser averaged +1.3–1.5%, barely
//   felt; the margins at the line, 10–15 s, matched his earlier 11–17 s. v2 had full strength
//   at 30 s: the chaser averaged +2.8–4.6% and pulled 9 s leads back to 2 s mid-race, no surge
//   seen — but his leads came from the start and a better leg-4 route, so full moved to 20 s.
//   Oct 3 2026.)
//   * OFF until both the bot and the player have rounded the first mark (the start and the
//     first mark are where the pack is already tangled), FADED out inside the zone of the bot's
//     mark or gate (no boosted boats in mark traffic — but no wider, or on a short-leg venue the
//     fade resets the band before it builds), and off for a bot doing penalty turns or in stuck
//     recovery.
//   * Stars, feats and series points count normally; records are the player's own times.
//
// Inert for the evals by construction: the rating harness and the golden traces never drive
// the player, who never rounds the first mark, so the band never engages. `window.__ADAPTIVE
// = false` forces it off for a probe.
'use strict';
const ADAPTIVE = {
    deadS: 3,          // seconds either side of the player with no effect
    midS: 12,          // the first step: `boost1` reached here
    fullS: 20,         // the second step: `boost2` reached here, and held beyond
    boost1: 0.05,      // +5% at 12 s
    boost2: 0.10,      // +10% at 20 s
    holdBack: 0.5,     // bots ahead: this fraction of the same curve (−2.5% at 12 s, −5% at 20 s)
    rate: 0.01,        // max change of the multiplier per second
    gapTau: 5,         // seconds, the smoothing on each gap
    paceTau: 10,       // seconds, the smoothing on the fleet's pace
    fadeIn: 0.5,       // the effect is zero inside this fraction of a mark's zone, full at the zone's edge
};

const Adaptive = {
    _pace: null, _prev: null, _gap: new Map(), _raceId: null,

    // Is the band allowed in this race at all?
    active() {
        if (typeof window !== 'undefined' && window.__ADAPTIVE === false) return false;
        if (!settings || settings.adaptiveAI === false) return false;
        if (window.TimeTrial && TimeTrial.solo && TimeTrial.solo()) return false;
        if (window.School && School.lesson && School.lesson()) return false;
        return state.race && state.race.status === 'racing';
    },

    reset() { this._pace = null; this._prev = null; this._gap = new Map(); },

    // How far into the mark's neighbourhood a boat is: 1 = clear, 0 = at the mark.
    _markFade(boat) {
        const route = state.course && state.course.route, marks = state.course && state.course.marks;
        const e = route && route[boat.raceState.leg];
        if (!e) return 1;
        let d = Infinity, zone = 165;
        if (e.kind === 'round' && e.mark) { d = Math.hypot(boat.x - e.mark.x, boat.y - e.mark.y); zone = e.mark.zone || zone; }
        else if (e.marks && marks) {
            const a = marks[e.marks[0]], c = marks[e.marks[1]];
            if (a && c) {
                const dx = c.x - a.x, dy = c.y - a.y, l2 = dx * dx + dy * dy || 1;
                const t = Math.max(0, Math.min(1, ((boat.x - a.x) * dx + (boat.y - a.y) * dy) / l2));
                d = Math.hypot(boat.x - a.x - dx * t, boat.y - a.y - dy * t);
            }
        }
        const r0 = zone * ADAPTIVE.fadeIn, r1 = zone;
        return d >= r1 ? 1 : d <= r0 ? 0 : (d - r0) / (r1 - r0);
    },

    // Every sim step, before the boats move.
    update(dt) {
        const boats = state.boats || [];
        const me = boats.find(b => b.isPlayer);
        // Nothing is measured until the player has rounded the first mark — the band cannot engage
        // before then, and reading the fleet's progress every frame would cost time and stamp the
        // ranking's caches onto every raceState (which the golden traces hash).
        const on = this.active() && me && !me.raceState.finished && me.raceState.leg >= 2;
        if (!on) {
            for (const b of boats) if (!b.isPlayer && b._adaptMul != null) this._ease(b, 1, dt);
            if (!state.race || state.race.status !== 'racing') this.reset();
            if (state.race && state.race.status === 'prestart') state.race.adaptiveUsed = false;
            return;
        }
        state.race.adaptiveUsed = true;   // sailed with Adaptive AI on: the results screen tags the race
        // the fleet's pace along the course (u/s), smoothed — gaps are read in seconds
        const live = boats.filter(b => !b.raceState.finished);
        const prog = new Map(live.map(b => [b, getBoatProgress(b)]));
        if (this._prev) {
            const rates = [];
            for (const b of live) { const p0 = this._prev.get(b); if (p0 != null) rates.push((prog.get(b) - p0) / Math.max(1e-3, dt)); }
            if (rates.length) {
                rates.sort((a, c) => a - c);
                const med = rates[rates.length >> 1];
                const k = Math.min(1, dt / ADAPTIVE.paceTau);
                this._pace = this._pace == null ? med : this._pace + (med - this._pace) * k;
            }
        }
        this._prev = prog;
        const pace = Math.max(20, this._pace || 0);
        const pMe = prog.get(me);
        if (pMe == null) return;
        // each bot's smoothed gap in seconds: + behind the player, − ahead
        const kG = Math.min(1, dt / ADAPTIVE.gapTau);
        const ahead = [];
        for (const b of live) {
            if (b.isPlayer) continue;
            const g = (pMe - prog.get(b)) / pace;
            const s = this._gap.has(b) ? this._gap.get(b) + (g - this._gap.get(b)) * kG : g;
            this._gap.set(b, s);
            if (s < 0) ahead.push(s);
        }
        const aheadAvg = ahead.length ? ahead.reduce((a, c) => a + c, 0) / ahead.length : 0;
        // the boost a gap of x seconds earns: 0 in the dead zone, +5% by 12 s, +10% by 20 s
        const A = ADAPTIVE;
        const curve = (x) => x <= A.deadS ? 0
            : x <= A.midS ? A.boost1 * (x - A.deadS) / (A.midS - A.deadS)
            : A.boost1 + (A.boost2 - A.boost1) * Math.min(1, (x - A.midS) / (A.fullS - A.midS));
        const meRounded = me.raceState.leg >= 2;
        for (const b of boats) {
            if (b.isPlayer) continue;
            const rs = b.raceState;
            let target = 1;
            if (!rs.finished && meRounded && rs.leg >= 2 && !rs.penalty
                && !(b.controller && (b.controller.penaltySpin || b.controller.wiggleActive || b.controller.escActive))) {
                const g = this._gap.get(b) || 0;
                const eff = g > 0 ? curve(g) : -A.holdBack * curve(-aheadAvg);
                target = 1 + eff * this._markFade(b);
            }
            this._ease(b, target, dt);
        }
    },

    // Move the multiplier toward its target at the capped rate; drop it once back at 1.
    _ease(b, target, dt) {
        const cur = b._adaptMul != null ? b._adaptMul : 1;
        const step = ADAPTIVE.rate * dt;
        const next = cur + Math.max(-step, Math.min(step, target - cur));
        b._adaptMul = Math.abs(next - 1) < 1e-6 && target === 1 ? null : next;
    },
};
if (typeof window !== 'undefined') window.Adaptive = Adaptive;
