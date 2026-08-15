// RATE HARNESS — the character re-rating campaign, August 2026.
//
// A SEPARATE FILE from eval_harness.js on purpose. That harness is loaded by 33 test
// suites via run_all.js; this campaign needs four changes to how a trial is observed,
// and making them in the shared file would put every suite on an untested harness for
// the sake of a one-off measurement. Duplication is the cheaper risk.
//
// ⚠️ THE AI IS NOT TOUCHED, HERE OR ANYWHERE IN THIS CAMPAIGN. Owner constraint: the
// venue documents and the sailing code are frozen in another repository. Everything
// below either changes WHEN WE STOP WATCHING or reads state that was already there.
// The one thing that does reach into the race — the cutoff multiplier — is discussed
// under (2), and it cannot affect any boat that finishes.
//
// The four changes, and why each one exists:
//
// (1) THE LOOP EXITS ON THE AI FLEET, NOT ON EVERY BOAT.
//     eval_harness breaks when `state.boats.every(b => finished)`. The player boat in
//     an eval is undriven — it sits head-to-wind on the start line for the whole race
//     — so it never finishes, so that condition is never true, so EVERY race sims to
//     the full course cutoff even after the last AI is home. Measured headroom:
//     seatrials 32%, ocean 34%, lake 40%, lagoon 32%. Under (2) it would have been
//     worse than wasteful: with the cutoff doubled, every race would run to 2x cutoff
//     and the campaign would cost twice what it needs to.
//     The boat is left exactly where it is — still on the water, still an obstacle,
//     physics untouched. Only the stopping rule changed.
//
// (2) THE COURSE CUTOFF IS MULTIPLIED (default x2).
//     At the shipped cutoff `script.js:14290` marks every unfinished boat
//     finished = true with finishTime = the cutoff, and tags resultStatus DNF/DNS.
//     tier_eval.js tests only `b.finished`, so a boat that never finished is scored
//     as a finisher whose time is exactly the cutoff. Measured: 33% of boats at
//     redrock, 31% at river, 8% at arctic. Identical times for a third of the fleet
//     flatten the bottom of the table and drag the fleet mean every delta is measured
//     against — and `dnfPct` reads 0.0 the whole time, so it is invisible.
//     Doubling the limit lets the laggards finish and makes the metric continuous.
//     ⚠️ This cannot bias a finisher: a boat that crossed at 250s crossed at 250s
//     whatever the limit was. It only adds data past the old horizon. The shipped
//     result is fully recoverable afterwards — `finishTime > shippedCutoff` is
//     exactly the set that would have DNF'd in the real game, so the campaign
//     reports the true shipped DNF rate as well as an uncensored strength number.
//
// (3) resultStatus IS REPORTED AND BELIEVED.
//     'DNS' / 'DNF' / null. The scoring rule (owner's, and the same one the series
//     uses): points 10 down to 1 by finish order, DNF and DNS score 0.
//
// (4) THE FLEET DRAW EXCLUDES A ROTATING CHARACTER, NOT ALWAYS THE SAME ONE.
//     script.js builds the fleet as `AI_CONFIG.filter(c => c.name !== settings.character)`
//     — you never race yourself. The eval has always sailed as the default character,
//     Finley, so FINLEY HAS NEVER APPEARED IN ANY MEASUREMENT IN THIS PROJECT'S
//     HISTORY. He is not missing from the old report because he is new; he is missing
//     because the harness has been deleting him from every race for the roster's whole
//     life. Rotating the excluded name spreads that hole evenly over all 100.
//     This changes which characters race, never how any of them sails.

(function() { window.rateHarness = {
    seed: 0,

    // Mulberry32, same as eval_harness — keep the streams identical so a seed means
    // the same conditions in both harnesses and old numbers stay comparable.
    random: function() {
        var t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    init: function() {
        if (!localStorage.getItem('regatta_settings')) {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
        }
        Math.random = () => this.random();
        if (window.settings) {
            window.settings.soundEnabled = false;
            window.settings.bgSoundEnabled = false;
            window.settings.musicEnabled = false;
        }
        // Stop the render loop; update() is driven by hand below.
        window.requestAnimationFrame = (cb) => { this.loopCallback = cb; };
        // No event hooks: this campaign scores results, and the per-event bookkeeping
        // in eval_harness costs time in a run measured in days.
        window.onRaceEvent = null;
    },

    // opts: { cutoffMul, character, windSamples }
    runTrial: function(seed, timeLimit, opts) {
        opts = opts || {};
        this.seed = seed;

        // (4) Rotate who is held out of the draw.
        //
        // This MUST go through localStorage, not through the live `settings` object.
        // resetGame() calls loadSettings() as its seventh line, and loadSettings does
        // `settings = { ...DEFAULT_SETTINGS, ...parsed }` — it REPLACES the object, so
        // an assignment made just beforehand is discarded before the fleet is drawn.
        // Caught by asserting on the returned heldOut, which came back 'Finley' (the
        // default) for every trial in the first smoke run of eight.
        if (opts.character) {
            let s = {};
            try { s = JSON.parse(localStorage.getItem('regatta_settings')) || {}; } catch (e) {}
            s.character = opts.character;
            localStorage.setItem('regatta_settings', JSON.stringify(s));
        }

        window.resetGame();
        window.startRace();

        // (2) Raise the limit. `state.course.cutoff` is re-read every frame inside
        // update(), so mutating it after the start is enough. A null cutoff means
        // script.js derives one from the course length — derive the same number here
        // so the multiplier applies to venues that authored no explicit limit.
        const mul = opts.cutoffMul || 2;
        const derived = (state.race.totalLegs * state.race.legLength / 5) * 0.1875;
        const shippedCutoff = (state.course.cutoff != null) ? state.course.cutoff : derived;
        state.course.cutoff = shippedCutoff * mul;

        const participants = [...state.boats];
        const ai = participants.filter(b => !b.isPlayer);

        const dt = 1 / 60;
        const maxTime = timeLimit || 1200;
        const maxIterations = (maxTime + 100) * 60;

        // Wind actually experienced, for pricing lightAir/heavyAir against the band the
        // race was really sailed in rather than the venue's nominal setting.
        // `state.wind.baseSpeed` and not `state.wind.speed`, because baseSpeed is the
        // exact argument the groove is computed from — script.js:12895 calls
        // windGrooveFactor(boat.stats, state.wind.baseSpeed). The regional pressure a
        // boat sits in never reaches those two stats, so sampling it would be pricing
        // the stat against a number it does not read.
        let windSum = 0, windN = 0, windMin = Infinity, windMax = -Infinity;

        let iterations = 0;
        while (iterations < maxIterations) {
            if (state.race.status === 'racing') {
                if (state.race.timer > maxTime) break;
                // (1) The AI fleet decides when the race is over. The undriven player
                // is on the water but never finishes, and waiting for them is what
                // made every race run to the cutoff.
                if (ai.every(b => b.raceState.finished)) break;
                if ((iterations & 63) === 0) {
                    const w = state.wind.baseSpeed;
                    if (w > 0) { windSum += w; windN++;
                                 if (w < windMin) windMin = w;
                                 if (w > windMax) windMax = w; }
                }
            }
            window.update(dt);
            iterations++;
        }

        // Finish order among boats that genuinely completed the course. resultStatus is
        // null for a real finisher and 'DNF'/'DNS' for a boat the cutoff swept up (3).
        const real = ai.filter(b => b.raceState.finished && !b.raceState.resultStatus
                                    && b.raceState.finishTime > 0);
        real.sort((a, b) => a.raceState.finishTime - b.raceState.finishTime);
        const placeOf = {};
        real.forEach((b, i) => { placeOf[b.id] = i + 1; });

        const fleetSize = ai.length;   // 9

        return {
            seed,
            cutoff: shippedCutoff,          // the SHIPPED limit, for recovering the real DNF set
            cutoffUsed: state.course.cutoff,
            raceTime: state.race.timer,
            totalLegs: state.race.totalLegs,
            windDir: state.wind.direction,
            // Mark positions, so legs can be classified beat/reach/run offline against
            // windDir instead of guessing from the venue name. Cheap and constant.
            marks: (state.course.marks || []).map(m => [Math.round(m.x), Math.round(m.y)]),
            windMean: windN ? windSum / windN : null,
            windMin: windN ? windMin : null,
            windMax: windN ? windMax : null,
            heldOut: settings.character,
            boats: ai.map(b => {
                const rs = b.raceState;
                const finished = !!(rs.finished && !rs.resultStatus && rs.finishTime > 0);
                const place = placeOf[b.id] || null;
                return {
                    name: b.name,
                    t: finished ? rs.finishTime : null,
                    place,
                    // Owner's scoring rule: 10 down to 1 by finish order, DNF/DNS = 0.
                    pts: finished ? Math.max(0, fleetSize + 1 - place) : 0,
                    status: rs.resultStatus || null,
                    leg: rs.leg,
                    pen: rs.totalPenalties || 0,
                    // PER-LEG SPLITS. The game keeps these itself (script.js:13340) —
                    // no event hook, no extra work in the loop, just read them at the
                    // end. Without them the campaign cannot honestly price `upwind`,
                    // `reach` or `downwind` (a single finish time cannot say which leg
                    // the boat lost) and cannot audit a `beat` line, half of which name
                    // a specific point of sail: "beat him to the top mark", "he parks
                    // downwind". Both were commissioned deliverables.
                    // NOTE legTimes starts at leg 1 — the push is guarded by
                    // `rs.leg > 1` AFTER the increment, so the run from the gun to the
                    // start line is absent. It is recoverable exactly, as
                    // finishTime - sum(legTimes), which is the start-performance number.
                    legs: (rs.legTimes || []).map(t => Math.round(t * 100) / 100),
                    // Tacks and gybes per leg — the cost side of `handling`.
                    man: (rs.legManeuvers || []).slice(0, (state.race.totalLegs || 8) + 1),
                    // Would this boat have DNF'd under the SHIPPED cutoff? Free, and it
                    // is the number that describes the game people actually play.
                    lateForShipped: finished ? (rs.finishTime > shippedCutoff) : true
                };
            })
        };
    }
};

window.rateHarness.init();
})();
