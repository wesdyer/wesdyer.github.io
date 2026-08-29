// regatta/js/ai/avoidance.js — BotController avoidance: updateRiskAssessment,
// planFloeTrajectory, applyAvoidance. Methods installed on
// BotController.prototype (class declared in ai/bot.js, which must load first).
// Extracted verbatim from script.js (refactor 2026-08-24).
Object.assign(BotController.prototype, {
    updateRiskAssessment(dt) {
        // Decrement timer
        if (this.avoidanceCommitTimer > 0) {
            this.avoidanceCommitTimer -= dt;
        }

        // Find threats
        let maxRisk = 'LOW';
        let role = 'NONE';
        let threat = null;
        let threatRow = null;

        // Filter nearby boats
        const nearby = state.boats.filter(b => b !== this.boat && !b.raceState.finished);

        for (const other of nearby) {
            const metrics = getRiskMetrics(this.boat, other);

            // Thresholds
            let risk = 'LOW';
            // Increased detection range (was 300) to allow earlier reactions (4s head-on closing ~480 units)
            if (metrics.distCurrent < 600) {
                // Earlier detection: tCPA thresholds increased (5.0 -> 8.0, 3.0 -> 4.5)
                // Distance thresholds slightly increased for larger safety bubble
                if (metrics.distCPA < 70 && metrics.tCPA > 0 && metrics.tCPA < 8.0) {
                     risk = 'MEDIUM';
                }
                if (metrics.distCPA < 50 && metrics.tCPA > 0 && metrics.tCPA < 4.5) {
                     risk = 'HIGH';
                }
                if (metrics.distCurrent < 60 || (metrics.distCPA < 35 && metrics.tCPA > 0 && metrics.tCPA < 2.0)) {
                     risk = 'IMMINENT';
                }
                // RULE 21 HAZARD MODEL. A boat mid-penalty-spiral sweeps her
                // velocity through a full circle, so the linear CPA above is noise
                // on her — risk reads LOW while she rotates two lengths away, and
                // the bay rub probe has 17% of contact episodes against a boat
                // everyone could see spinning. Price her by where she IS: a
                // stationary hazard with a berth.
                if (other.raceState.penalty && other.controller && other.controller.penaltySpin) {
                    if (metrics.distCurrent < 260 && risk === 'LOW') risk = 'MEDIUM';
                    if (metrics.distCurrent < 170) risk = 'HIGH';
                    if (metrics.distCurrent < 85) risk = 'IMMINENT';
                }
            }

            if (risk !== 'LOW') {
                // Determine Role
                let rowBoat = null;
                let rowRes = null;
                try {
                     rowRes = getRightOfWay(this.boat, other);
                     rowBoat = rowRes.boat;
                } catch(e) { }

                const myRole = (rowBoat === this.boat) ? 'STAND_ON' : 'GIVE_WAY';
                // (Rule 15's behavioral demotion was tried here and removed: the
                // rule obliges the acquirer to GIVE ROOM, not to become give-way,
                // and the full role demotion cost redrock/swamp in thread traffic.
                // The obligation flows through the umpire instead — contact inside
                // the acquirer's window penalizes HER — and the graduated stand-on
                // hold already accepts evasion at HIGH risk.)

                // Prioritize highest risk
                const riskLevel = { 'LOW':0, 'MEDIUM':1, 'HIGH':2, 'IMMINENT':3 };
                if (riskLevel[risk] > riskLevel[maxRisk]) {
                    maxRisk = risk;
                    role = myRole;
                    threat = other;
                    threatRow = rowRes;
                }
            }
        }

        // Track the dominant threat + how long this pairing has been stable —
        // the no-contact foul detector needs it (Rule 15 gives a boat that
        // just became obligated room to respond before any foul). Keyed to the
        // threat's identity only: role and risk levels flap tick-to-tick in
        // multi-boat geometry, and keying on them killed ~94% of valid claims.
        // The pairing must also PERSIST through the latch: fresh risk dips to
        // LOW for a tick or two mid-encounter, and clearing the threat there
        // starved the detector (threat was set in only 17% of latched ticks).
        if (threat) {
            if (threat === this.threatBoat) {
                this.roleStableTime += dt;
                this.threatRowRes = threatRow || this.threatRowRes;
            } else {
                this.threatBoat = threat;
                this.threatRowRes = threatRow;
                this.roleStableTime = 0;
            }
        } else if (this.avoidanceCommitTimer > 0 && this.threatBoat) {
            // Latched mid-encounter: hold the pairing, keep accruing stability.
            this.roleStableTime += dt;
        } else {
            this.threatBoat = null;
            this.threatRowRes = null;
            this.roleStableTime = 0;
        }

        // Latching Logic: Prevent oscillation by holding state
        if (this.avoidanceCommitTimer > 0) {
            // If risk drops to LOW while committed, ignore it (hold previous state)
            if (maxRisk === 'LOW') {
                return;
            }
        }

        // Bully call-out: taunt when wading into a fresh close-quarters fight.
        if (this.bullyQuoteTimer > 0) this.bullyQuoteTimer -= dt;
        const wasCalm = this.riskState === 'LOW' || this.riskState === 'MEDIUM';
        if (wasCalm && (maxRisk === 'HIGH' || maxRisk === 'IMMINENT') &&
            this.boat.traits && this.boat.traits.aggro >= 0.8 && !(this.bullyQuoteTimer > 0) &&
            state.race.status === 'racing') {
            this.bullyQuoteTimer = 25;
            if (typeof Sayings !== 'undefined') Sayings.queueQuote(this.boat, 'bully_engage');
        }

        this.riskState = maxRisk;
        this.avoidanceRole = role;

        // Trigger Commitment for Give-Way
        if (maxRisk === 'MEDIUM' && role === 'GIVE_WAY') {
             this.avoidanceCommitTimer = 2.0; // Commit/Refresh
        } else if (maxRisk === 'HIGH' || maxRisk === 'IMMINENT') {
             this.avoidanceCommitTimer = 2.0; // Also commit for higher risks
        } else {
             // If LOW (and we reached here, meaning timer expired), reset
             this.avoidanceCommitTimer = 0;
        }
    }

    // ── SHORT-HORIZON TRAJECTORY PLANNER ─────────────────────────────────────
    // The reactive layer scores STRAIGHT probes; it cannot express "turn between
    // these two floes, then bear away", which is the whole skill of pack sailing.
    // This rolls out ~9s of simple boat kinematics (turn-toward then straight) for
    // a fan of headings, moves every nearby floe along its KNOWN drift during the
    // rollout, and scores progress toward the nav target minus predicted trouble.
    // If the strategy's own heading rolls out clean it is kept untouched — the
    // planner exists to resolve conflicts, not to re-steer clean water.
});
Object.assign(BotController.prototype, {
    planFloeTrajectory(desiredHeading, navTarget) {
        const boat = this.boat;
        const g = state.course.botGrid;
        const floesAll = state.course._floeObjs;
        if (!g || !floesAll || !floesAll.length || !navTarget) return null;
        const speedU = Math.max(70, boat.speed * 60);
        const T = 9, DT = 0.75, STEPS = 12;
        const reach = speedU * T + 150;
        const floes = [];
        for (const f of floesAll) {
            const dx = f.x - boat.x, dy = f.y - boat.y;
            if (dx * dx + dy * dy < (reach + f.radius) * (reach + f.radius)) floes.push(f);
        }
        if (!floes.length) return null;
        const TURN = 0.85 * (1 + (boat.stats ? boat.stats.handling * 0.03 : 0));
        const tux = navTarget.x - boat.x, tuy = navTarget.y - boat.y;
        const tl = Math.hypot(tux, tuy) || 1;
        const ux = tux / tl, uy = tuy / tl;
        // Bold boats accept nearer contact; deft ones weave harder. Per-boat
        // weights keep the fleet from converging on identical lines.
        const aggro = boat.traits ? (boat.traits.aggro || 0) : 0;
        const contactW = 5200 * (1 - 0.25 * aggro);

        const roll = (off) => {
            let x = boat.x, y = boat.y, hd = boat.heading;
            const h0 = normalizeAngle(desiredHeading + off);
            let score = -Math.pow(Math.abs(off), 1.3) * 40;
            let contactT = Infinity;
            for (let stp = 1; stp <= STEPS; stp++) {
                const t = stp * DT;
                const dh = normalizeAngle(h0 - hd);
                hd += Math.sign(dh) * Math.min(Math.abs(dh), TURN * DT);
                x += Math.sin(hd) * speedU * DT;
                y += -Math.cos(hd) * speedU * DT;
                const cc = g.cell(x, y);
                if (!g.at(cc[0], cc[1])) {
                    const idc = cc[1] * g.n + cc[0];
                    if (g._soft && g._soft[idc]) { score -= (g._soft[idc] === 1 ? 120 : 420); }
                    else { score -= 5000 * (1 - (t / T) * 0.8); break; }   // land
                }
                for (const f of floes) {
                    const fx = f.x + (f.driftVx || 0) * t, fy = f.y + (f.driftVy || 0) * t;
                // FL1 (2026-08-08, owner-directed: "Icebergs ARE NOT CIRCLES.
                // They are moving, rotating polygons with clear boundaries. My
                // path planning as a human depends on it.") The physics
                // collides on the rotating localHull, and rim rotation
                // DOMINATES contact motion (median 28.6 u/s rotational vs 5
                // drift — the clampSpin survey). This test priced the fatter
                // bounding circle projected by drift alone: phantom clearance
                // on every lobed floe (the human overlaps the circle on most
                // recorded exits: clearance −24..−262u to the circle, clean to
                // the hull), and blindness to the swinging rim. Keep the
                // circle as BROAD PHASE only; the verdict is the radial
                // profile of the true hull, rotated to its predicted spin at
                // sample time. The +14 pad survives verbatim — it was tuned
                // as a HULL floor (human clears 14-19u to the hull).
                const rr = f.radius + 14;
                    if ((x - fx) * (x - fx) + (y - fy) * (y - fy) < rr * rr) {
                        if (floeHullNear(f, x - fx, y - fy, t, 14) && t < contactT) contactT = t;
                    }
                }
            }
            if (contactT < Infinity) score -= contactW * Math.max(0, 1 - contactT / T);
            score += (x - boat.x) * ux + (y - boat.y) * uy;
            return { score, contactT, x, y };
        };

        const base = roll(0);
        this._trajRisk = base.contactT;   // speed discipline reads this
        // Deviate only for REAL trouble, and only for clearly better lines: micro
        // dodges around 6-9s-away floes made the track a permanent zigzag (made-good
        // ratio ~0.3 at full boat speed).
        if (base.contactT > 4.5) return null;
        // THE SAME BLINDNESS, ONE LAYER DOWN (2026-08-11, follow-up to b382aab).
        //
        // The retrograde filter that landed on `applyAvoidance` (arctic 1.66x ->
        // 1.55x) came from `_ring_motion`: inside the armed granite-isle rounding
        // 46.7% of all motion is RADIAL and 1 701 u/boat is RETROGRADE. The
        // avoidance argmin produced 975 u of that retrograde — and THIS layer
        // produced 294 u more, over 19.5% of the armed ticks, for exactly the same
        // reason: nothing here knows the boat is committed to a sweep.
        //
        // Same argument, same shape: a dodge that carries her backwards round the
        // mark unwinds sweep she has already earned. It is graded on the ROLLED
        // TRACK, not the heading, because the roll already models her turn. If no
        // prograde candidate improves on holding, the function returns null exactly
        // as today. Armed rounding leg only, and floe venues by construction.
        const rmFT = state.course.roundMark && legRoundMark(boat.raceState.leg);
        const armFT = !!(rmFT && boat.raceState.roundArmed && boat.raceState.leg >= 1
                         && !this._outbound);
        const brgFT = armFT ? Math.atan2(boat.y - rmFT.y, boat.x - rmFT.x) : 0;
        const sgnFT = (rmFT && rmFT.side === 'port') ? -1 : 1;
        const utxFT = -Math.sin(brgFT) * sgnFT, utyFT = Math.cos(brgFT) * sgnFT;
        let bestOff = 0, bestScore = base.score + 50;
        for (const off of [0.15, -0.15, 0.35, -0.35, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3, 1.7, -1.7]) {
            const r = roll(off);
            if (armFT && ((r.x - boat.x) * utxFT + (r.y - boat.y) * utyFT) < 0) continue;
            if (r.score > bestScore) { bestScore = r.score; bestOff = off; }
        }
        if (bestOff === 0) return null;
        return normalizeAngle(desiredHeading + bestOff);
    }

    /**
     * applyAvoidance() — RRS-aware collision avoidance cost function
     *
     * Evaluates candidate headings and selects the lowest-cost option.
     * Cost factors implement RRS obligations:
     *
     *  - Base deviation cost: Encourages keeping proper course (RRS general).
     *  - STAND_ON hold-course: RRS 16 — ROW boat should not alter course
     *    unnecessarily. Graduated per Rule 14: full hold at MEDIUM risk,
     *    reduced at HIGH (give-way not yielding), zero at IMMINENT.
     *  - Rule 16 toward-threat penalty: Prevents STAND_ON from steering
     *    into keep-clear boat (RRS 16: "give room to keep clear").
     *  - GIVE_WAY large bubble: RRS 16 — give keep-clear boat room to
     *    react early by expanding the safety distance.
     *  - Duck stern reward / bow crossing penalty: Proper give-way technique
     *    (pass astern of ROW boat, don't cut across their bow).
     *  - Rule violation cost: Penalty for being give-way and heading into
     *    collision (RRS 10/11/12/13 obligation to keep clear).
     *  - IMMINENT override: RRS 14 — both boats must avoid contact at all
     *    costs when collision is imminent.
     */
});
Object.assign(BotController.prototype, {
    applyAvoidance(desiredHeading, speedRequest) {
        // If stuck (Wiggle Mode), ignore avoidance to force breakout
        this.lastAvoidDeviation = 0;
        this.lastAvoidDeviationSigned = 0;
        if (this.wiggleActive) return desiredHeading;
        // ESCAPE retraces the boat's own wake (sailable by construction); the
        // 150u-entry / 120u-abort rival guards replace avoidance while it runs.
        if (this.escActive) return desiredHeading;

        const boat = this.boat;
        // PROBE HOOK (deflection push, 2026-08-19): per-candidate cost ledger
        // behind `window.__AVDBG` — same pattern as __AV/__CHAR, byte-inert
        // when unset. Consumers: eval/rl/_deflect_why.js, _role_vs_rules.js.
        const dbgOn = typeof window !== 'undefined' && window.__AVDBG
            && (!window.__AVDBG.name || window.__AVDBG.name === boat.name);
        const dbgRows = dbgOn ? [] : null;
        const lookaheadFrames = 240; // 4 seconds lookahead
        const speed = Math.max(2.0, boat.speed * 60); // Minimum speed for projection
        // DOES ANYTHING HERE DRIFT? Both of this function's 2026-08-06 changes assume the
        // thing being dodged stays where the probe found it, so both are gated on the
        // same fact. Same flag the keep-clear terms already read; `refreshBotGrid` fills
        // it on the first update of a race, before any avoidance runs (verified: 0 after
        // resetGame, 112 after one update(1/60) on Glacier Sound).
        const openWaterAv = !(state.course._floeObjs && state.course._floeObjs.length);

        // Candidates: more granular to find gaps.
        //
        // FINER BETWEEN 0.2 AND 0.8 — WHERE NOTHING DRIFTS. The escape is an argmin over
        // this list, so its spacing IS the resolution of every dodge the fleet makes: a
        // boat that needs 17 degrees to clear is offered 11 and then 23, and buys 23.
        // That quantization is why twelve candidates re-priced the avoidance COST and
        // the mean deflection never left 44-48 degrees. The human's own ledger, per
        // encounter with the deliberate tacks removed, is a median 8 degrees at CPA
        // (bay, n=272) against the fleet's 44-51.
        //
        // Benched: Stillwater Lake -29.0 paired median, Lighthouse Cove -5.0 and -2.0 on
        // two disjoint 20-seed sets, ocean inert.
        //
        // ⚠️ NOT ON GLACIER SOUND, and the honest reason is that FOUR 16-seed sets could
        // not tell it from zero there:
        //
        //     9100  paired med  +4.0  mean  +3.8 | finishers 139 -> 132 of 144
        //     9200  paired med  -9.0  mean -12.7 | finishers 123 -> 123
        //     9300  paired med -13.0  mean  -4.3 | finishers 134 -> 134
        //     9400  paired med +10.0  mean  -0.6 | finishers 135 -> 138
        //     POOLED 64 seeds, n=491 | med -4.0  mean -3.1 | 531 -> 527 of 576
        //
        // The set medians alternate sign across a +-13 s range, which is what a threshold
        // statistic on a marginal venue looks like (Glacier Sound DNFs ~8% of the fleet
        // at 900 s) — not what a mechanism looks like. A mechanism WAS drafted here
        // ("a floe neither holds still nor keeps clear, so a tighter miss is worth less")
        // and set 2 refuted it, so it is not claimed. The gate is a conservatism: do not
        // move a marginal venue for an effect indistinguishable from noise.
        //
        // ⚠️ The two lists are ordered and the order is the tie-break (`cost < minCost`
        // keeps the earlier candidate). The ice list is the stock list, unchanged.
        // ⚠️ RACING LEGS ONLY — the densified list reshapes the START otherwise.
        // This fan landed in d55eb97 without a leg guard, and bisecting seatrials across
        // four commits with one command found what that cost:
        //     b60ba9d pre-session  OCS 16.67% | d55eb97 the fan  OCS 21.11%
        //     97a5559 no-go tax    OCS 21.11% | b566370 tonight  OCS 21.11%
        // 4.4 points of Clubhouse OCS, unnoticed because the fan was judged on race time.
        // Restricting it here puts that back to 16.67% exactly, and costs nothing it was
        // landed for: lake -3.5 paired median (inert, and max 592 -> 420), bay +2.0 with
        // penalties 0.57 -> 0.46. Glacier Sound is untouched by construction — floes make
        // `openWaterAv` false, so the ice list below is selected either way.
        const racingLegF = this.boat.raceState.leg >= 1;

        // TIGHT-THREAD FOLLOWING. The router may deliberately buy a tight-tier
        // thread (sub-88u water, passable bow-first — see SailCheck.TIGHT_CLEAR
        // and its tax in pathSailable). The land probe below treats non-navigable
        // cells as walls, so without this flag the helm VETOES the router's own
        // thread and improvises a circumnavigation — the divergence trap, measured
        // in both directions. Leniency is scoped to the thread: it arms only when
        // the boat's own current plan runs through tight cells within ~600u, so a
        // venue whose routes never thread tight water behaves identically by
        // construction.
        // The leniency is CELL-SCOPED: `planTightCells` holds exactly the tight
        // cells the plan crosses (plus their 8 neighbours, one cell of execution
        // scatter). Any OTHER tight cell keeps the stock wall verdict even while
        // a thread is armed — the first redrock gate on a flag-scoped version
        // read land contacts +65-74% on two disjoint sets, every seed paying:
        // with the flag armed anywhere near a canyon thread, every shore ribbon
        // on the venue went semi-permeable (15000 tax where a 500000 veto
        // stood), and the fleet shaved shores it used to refuse.
        let planTightAv = false;
        let planTightCells = null;
        {
            const gPT = this._trajFloe
                ? (state.course._botGridStatic || state.course.botGrid)
                : state.course.botGrid;
            if (gPT && gPT._tight && this.gridPath && this.gridPath.length) {
                for (let pi = 0; pi < Math.min(12, this.gridPath.length); pi++) {
                    const pp = this.gridPath[pi];
                    const pc = gPT.cell(pp.x, pp.y);
                    if (pc[0] >= 0 && pc[1] >= 0 && pc[0] < gPT.n && pc[1] < gPT.n
                        && gPT._tight[pc[1] * gPT.n + pc[0]]) {
                        planTightAv = true;
                        if (!planTightCells) planTightCells = new Set();
                        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
                            const ni = pc[0] + di, nj = pc[1] + dj;
                            if (ni >= 0 && nj >= 0 && ni < gPT.n && nj < gPT.n
                                && gPT._tight[nj * gPT.n + ni]) planTightCells.add(nj * gPT.n + ni);
                        }
                    }
                }
            }
        }
        // FAN UNGATE (2026-08-09, the re-verdict): the `openWaterAv` half of this gate
        // was never a mechanism — the comment above says so in its own words ("the gate
        // is a conservatism"). BOTH of its premises have since expired. (1) The venue is
        // no longer marginal: Glacier Sound DNF'd ~8% of the fleet at 900 s when those
        // four sets were run and now finishes 576/576 (FL1b), so the threshold statistic
        // that alternated sign is gone. (2) The four sets were measured in the PHANTOM
        // world — 53% of the near-field circle flags were false (FL1/FL1b) — so the
        // candidate scorer those 20 offsets fed was scoring dodges around ice that was
        // not there, which is exactly the resolution the finer offsets exist to buy.
        // RE-BENCHED on the accurate model, arctic pooled 4-set (576 pairs, fl1barc*):
        //   paired med -7.0  mean -8.3 s/boat FASTER | finishers 576 -> 576
        //   every percentile improved: p10 296->286  med 376->366  p90 485->481
        //   sets agree in sign: -18 / -1 / -3 / -3 (the old spread was +4/-9/-13/+10)
        // ⚠️ THE COST IS CONTACT, and it is not noise: boat 5.06 -> 5.66 per boat
        // (+12%), mark +21%, land +5% — against floe -1% and bounds -48%, penalties
        // IDENTICAL (657 -> 657), so the extra contact is rubs, not fouls. Landed as a
        // clock change with that trade recorded; if arctic contact quality ever becomes
        // the target, this gate is the first thing to re-price.
        // ⚠️ racingLegF STAYS. It is not part of this ungate: the fan without a leg guard
        // cost 4.4 points of Clubhouse OCS (d55eb97, bisected). Start tuning is sacred.
        // Arctic is the ONLY floe venue, so every other venue is byte-identical by
        // construction — verified empirically on bay (4 seeds) and ocean (16 @ 9300,
        // the exact gate) before landing.
        const candidates = racingLegF ? [
            0,
            0.1, -0.1,
            0.2, -0.2,
            0.3, -0.3,
            0.4, -0.4,
            0.5, -0.5,
            0.6, -0.6,
            0.7, -0.7,
            0.8, -0.8,
            1.2, -1.2,
            1.6, -1.6 // Wider options for emergency bailouts
        ] : [
            0,
            0.1, -0.1,
            0.2, -0.2,
            0.4, -0.4,
            0.6, -0.6,
            0.8, -0.8,
            1.2, -1.2,
            1.6, -1.6 // Wider options for emergency bailouts
        ];
        // Near-reversals: the only exit when nosed into a berg or wall — a LAND
        // problem. In an open-water start pack they are cheap chaos (at jam speeds
        // the reversal surcharge is waived), so open venues keep the classic fan.
        if (state.course._gridFixed && state.course._gridFixed.length) {
            // ...but ONLY WHEN SHE IS ACTUALLY NOSED INTO ONE, and only while racing.
            //
            // The gate used to be "this venue has authored land", which is a property of
            // the COURSE, not of the boat's predicament — so a 126- and a 172-degree turn
            // sat in the fan for the entire race. `_margin.js` counts how often they win:
            // 17.3% of every helm movement on Stillwater Lake, 15.0% on Glacier Sound,
            // 2.3% on Lighthouse Cove. The pow(|offset|,1.5) base cost plus the 250
            // surcharge below is pocket change beside a median cost(0) of 7500-15000, and
            // that surcharge is waived under 1.0 kt — exactly the state a boat pinned in
            // narrow water is in.
            //
            // The genuinely stuck boat is NOT this code's problem: `wiggleActive` returns
            // out of applyAvoidance at the top of the function and fires after 3 s below
            // speed on any land venue. These candidates were justified by a predicament
            // another system already owns.
            //
            // Same test the unplanned-tack waiver above uses: hard grid blockage within
            // ~180u dead ahead. Benched (paired median, two disjoint 20/16-seed sets):
            //   lake   +41.0 / +55.0 faster   349 -> 307, 350 -> 303, land 19.4 -> 9.6
            //   arctic -23.0 / -38.0 faster   535 -> 511, 534 -> 498, finishers +0 / +10
            //   bay     +0.5 /  -2.5          inert, and its 2.3% share predicted that
            //
            // ⚠️ leg >= 1: ungated, this took Lighthouse Cove from 0 to 2.2% OCS — the
            // start pack turns back off the line with these. Start tuning is sacred.
            let nosedIn = false;
            const gNR = state.course.botGrid;
            if (gNR && this.boat.raceState.leg >= 1) {
                for (const dNR of [90, 180]) {
                    const cc = gNR.cell(this.boat.x + Math.sin(this.boat.heading) * dNR,
                                        this.boat.y - Math.cos(this.boat.heading) * dNR);
                    if (!gNR.at(cc[0], cc[1])) { nosedIn = true; break; }
                }
            }
            if (nosedIn || this.boat.raceState.leg < 1) candidates.push(2.2, -2.2, 3.0, -3.0);
            // (The d020966 1.0/1.4 emergency-band rungs were re-tried here
            // scoped to planTightAv/nosedIn+rival for the narrow-passage push
            // and measured INERT on every lab pin (never the argmin's answer
            // at a single Wall Tack contact) and inside redrock noise — so
            // they stay dropped. The wall-corner contact class they were
            // meant for is a BLOCKED-TACK problem, not an escape-quantization
            // one; see the wedge/obstruction brief.)
        }

        // A BOAT MID-ROUNDING SAILS AN ARC, and its straight land-probe ray
        // grades water it will never visit: in lake mark-3's dead-end cove
        // every straight 240u+ ray ends in shore, every candidate is taxed,
        // and the argmin churns the helm until the way dies (measured: 93% of
        // cove stalls follow sustained ~34° deflection mid-arm; the human
        // transits in 17-20s never below 4.3kt). While the rounding is ARMED
        // and inside zone*1.5, CURVE the probe along the orbit the boat is
        // actually sailing: radius = max(70u knee, distance to the mark),
        // curving toward whichever side of the candidate heading the mark is
        // on. The hard-zone wall test keeps full authority along the arc —
        // this moves WHERE the probe looks, not how much it cares. (The
        // shortened-probe variant was rejected: lake land +11%/+57% — caution
        // was real, aim was wrong. This fixes the aim.)
        // NOT ON STRONG-CURRENT VENUES: the arc rollout assumes the water
        // stands still; in a 2+ kt stream the boat's real path is arc + set
        // and the pure-orbit arc is as fictional as the straight ray it
        // replaces (river under the unscoped arc: fins 119→114, boat rubs
        // ×2.1). Same venue-class knee as the jam-stamp scope.
        let arcR = 0, arcMx = 0, arcMy = 0;
        if (state.course._avCurMax === undefined || state.course._avCurMax < 2.0) {
            const rsA = this.boat.raceState;
            const rmA = (typeof legRoundMark === 'function' ? legRoundMark(rsA.leg) : null) || state.course.roundMark;
            if (rsA.roundArmed && rmA && !rsA.finished) {
                const dMA = Math.hypot(boat.x - rmA.x, boat.y - rmA.y);
                if (dMA < (rmA.zone || 165) * 1.5) {
                    // THE ARC ASSUMES AN UNOBSTRUCTED ORBIT — A QUEUE IS NOT
                    // ONE. With a parked rival near, the real path is dictated
                    // by traffic, and arc-graded probes reshuffled redrock's
                    // mark-5 thread queue into wedges (DNFs 3→11 at that mark,
                    // unarmed, 1.26 kt — four disjoint sets, −17..−24
                    // finishers pooled). Same parked test as the jam stamps.
                    // A QUEUE DISABLES THE ARC ONLY WHEN IT SITS ON MY ORBIT
                    // (RD6→RD7, 2026-08-08 — the queueing anatomy). The pile at
                    // granite is SERVICE TIME (fleet arrives spread at 9.4s
                    // median gaps; each transit takes 63-76s against her 19, so
                    // occupancy accumulates at ρ≈7), and this flat 400u
                    // any-parked-rival test re-disabled the arc for every boat
                    // the moment the FIRST one parked — the old slow service
                    // resurrected itself and the queue never drained. Keep the
                    // wedge lesson this gate was earned on (redrock m5, zones
                    // 165-189) exactly: at SMALL zones the flat disable stands
                    // VERBATIM (byte-identical by construction — RD6 relaxed it
                    // everywhere and redrock answered +75 paired med); only at
                    // wide zones (≥500, water that admits parallel orbits) the
                    // disable narrows to a rival parked within a hull-diameter
                    // band of MY arc radius — one physically blocking my orbit.
                    const myR = Math.max(70, dMA);
                    const wideQ = (rmA.zone || 165) >= 500;
                    let queued = false;
                    for (const oQ of state.boats) {
                        if (oQ === boat || oQ.isPlayer || oQ.raceState.finished) continue;
                        if (oQ.speed * 4 >= 1.0) continue;
                        if (Math.hypot(oQ.x - boat.x, oQ.y - boat.y) >= 400) continue;
                        if (!wideQ) { queued = true; break; }
                        const rQ = Math.hypot(oQ.x - rmA.x, oQ.y - rmA.y);
                        if (Math.abs(rQ - myR) < 120) { queued = true; break; }
                    }
                    if (!queued) {
                        arcR = myR;
                        arcMx = rmA.x; arcMy = rmA.y;
                    }
                }
            }
        }

        let bestHeading = desiredHeading;
        let minCost = Infinity;

        // D1v2 — CLEAN-PREFERRED ESCAPES UNDER RIVAL RESOLUTION NEAR ICE
        // (C4 follow-up, owner-approved re-litigation 2026-08-23). While a
        // rival resolution is live, an escape candidate whose probe crosses
        // ice loses to ANY fully-clean candidate — but ONLY when a clean
        // one exists. D1's unconditional wall pushed boxed boats into land
        // and boats (pooled 32 +10.0 med, land +55%, KILLED); this is a
        // pure ORDERING rule: no candidate's price changes anywhere, and a
        // boxed boat keeps today's ordering exactly. Under _trajFloe the
        // ice test runs information-only (zero cost) on offset!=0
        // candidates — water the planner never probed.
        const iceHardD1 = !(state.course._floeObjs && state.course._floeObjs.length)
            ? false : (this.avoidanceRole !== 'NONE' || !!this.threatBoat);
        let minCleanCost = Infinity, bestCleanH = null, bestCleanRetro = false, bestIceD1 = false;

        // NOTE: leeway-aware candidate projection and an in-irons candidate
        // penalty were both tested here and REGRESSED (see memory: Round 10) —
        // avoidance predictions must stay heading-based and hold-friendly.

        // Dynamic Safe Distance based on Liveness
        let safeDist = 80; // 40 radius * 2 (Normal)

        // Tighter packing during start sequence. The fleet stages and crosses in
        // lanes only ~55u apart, so the normal 80-120u bubbles would make every
        // neighbour a permanent threat and freeze the start into a jammed wall.
        const isStartPhase = state.race.status === 'prestart' || this.boat.raceState.leg === 0;
        if (isStartPhase) safeDist = 55;

        if (this.livenessState === 'recovery') safeDist = 50;
        if (this.livenessState === 'force') safeDist = 20;

        // Symmetry Breaking: Differentiate Safety Bubbles (Only in Normal Liveness)
        if (this.livenessState === 'normal' && this.avoidanceRole === 'GIVE_WAY') {
            // Give-Way: Larger bubble to react early — but kept modest during the start
            // so lane-neighbours on parallel courses don't form an impassable wall.
            if (this.riskState === 'MEDIUM' || this.riskState === 'HIGH') {
                safeDist = isStartPhase ? 68 : 150;
            }
        }

        // Committed crossers run UP their lanes on near-parallel courses ~55u apart —
        // they won't actually collide, so pack tightest here and let the line flow.
        if (this.startCommitted && this.boat.raceState.leg === 0) {
            safeDist = Math.min(safeDist, 48);
        }

        // Archetype aggression: bullies shave their margins (+aggro), corner
        // artists give extra room (-aggro). RACING ONLY — the packed start is
        // tuned to the boat-length millimetre, and shifting margins there in
        // EITHER direction measurably wrecked the shifter's own start.
        const aggro = this.boat.traits ? this.boat.traits.aggro : 0;
        if (aggro && !isStartPhase) safeDist *= (1 - 0.12 * aggro);

        // RRS 19 (Room at an Obstruction): find overlapped boats that have
        // land close on their far side while WE sit outside them — we owe
        // them room to pass it. Computed once; candidates that would close
        // their escape gap get taxed at rule-violation weight below.
        const rule19Pairs = [];
        if (state.course.islands && state.course.islands.length && this.livenessState === 'normal'
            && window.Rules && window.Rules.isOverlapped) {
            const boat0 = this.boat;
            for (const other of state.boats) {
                if (other === boat0 || other.raceState.finished) continue;
                const dxo = other.x - boat0.x, dyo = other.y - boat0.y;
                if (dxo * dxo + dyo * dyo > 220 * 220) continue;
                for (const isl of state.course.islands) {
                    // Rule 19 is room at an OBSTRUCTION — something a boat must change
                    // course to avoid. A shoal is not one: she may sail straight over it,
                    // so being pinned against a bar is a tactical loss and not a foul.
                    if (isl.awash) continue;
                    const ox = other.x - isl.x, oy = other.y - isl.y;
                    const d2i = ox * ox + oy * oy;
                    const lim = isl.radius + 320;
                    if (d2i > lim * lim) continue; // squared early-out before sqrt
                    const oc = Math.sqrt(d2i);
                    const edgeGap = oc - isl.radius;
                    if (edgeGap > 320 || edgeGap < -50) continue;
                    const ax = ox / Math.max(1, oc), ay = oy / Math.max(1, oc); // escape axis
                    const myProj = (boat0.x - isl.x) * ax + (boat0.y - isl.y) * ay;
                    if (myProj < oc + 15) continue;                    // we are not outside
                    if (!window.Rules.isOverlapped(boat0, other)) continue;
                    rule19Pairs.push({ other, ax, ay });
                    break;
                }
            }
        }

        // Perf: prune static obstacles to those reachable within the lookahead
        // disc ONCE per decision — the candidate loop below runs 15 headings,
        // and with the river's ~86 bank islands the unpruned inner loops cost
        // ~600k segment-distance checks per second across the fleet.
        const reach = speed * (lookaheadFrames / 60) + 120;
        let nearIslands = null;
        if (state.course.islands && state.course.islands.length) {
            nearIslands = [];
            for (const isl of state.course.islands) {
                // Awash shapes are not obstacles at all, so they never reach the candidate
                // loop's segment tests. Pruning them HERE rather than inside those tests
                // keeps every one of them honest — they all mean "will this heading hit
                // something", and over a shoal the answer is no at every heading.
                if (isl.awash) continue;
                const dx = isl.x - this.boat.x, dy = isl.y - this.boat.y;
                const rr = isl.radius + reach;
                if (dx * dx + dy * dy < rr * rr) nearIslands.push(isl);
            }
        }

        // JAM FACTOR — the RRS SHAPING terms (hold-course, bow-cross, duck,
        // Rule 16) assume boats with way on. In a floe-narrowed channel at
        // 0.3-1.0 kt they price full detours for boats that could not reach
        // each other inside the lookahead, and five boats' detours feed each
        // other — traced as a 300s five-boat mill on the return leg (seed
        // 9104). Scale the SHAPING by fleet way-on; the hard collision terms
        // below keep full weight at every speed, so Rule 14 never softens.
        const jamF = Math.min(1, this.boat.speed / 1.4);

        // UNPLANNED-TACK TAX (beats only). A candidate that crosses head-to-wind
        // is a whole tack — momentum lost, and the strategic layer then fights to
        // tack back (traced on Lighthouse Cove L1: avoidance-initiated flips start
        // 5-in-3s saw bursts; tail boats tack 7-14x a beat vs the human's 2, and
        // corr(L1 time, tacks) = 0.72). Under the old costs a crash-tack ran
        // ~13-20 (deviation term) — nearly free next to the ±800-1500 duck/bow
        // shaping, so dodges flipped the hull when a same-board duck existed.
        // Guards: only while the strategy wants to STAY on this board (a
        // commanded tack is never taxed), racing legs (start-pack tuning is
        // sacred), way-on scaled like the other RRS shaping terms (jammed boats
        // pivot cheaply — hold-friendliness per the Round-10 lesson stands: this
        // taxes CROSSING the wind, never holding near it), and it is shaping-
        // sized: the 5e5-scale Rule-14 terms roll over it in any real emergency.
        const wdAv = getWindAt(this.boat.x, this.boat.y).direction;
        const desTwaAv = normalizeAngle(desiredHeading - wdAv);
        const hullTkAv = normalizeAngle(this.boat.heading - wdAv) > 0 ? 1 : -1;
        let taxTack = Math.abs(desTwaAv) < Math.PI / 3.5
            && (desTwaAv > 0 ? 1 : -1) === hullTkAv
            && this.boat.raceState.leg >= 1;
        // ...but never when the current board is about to hit something HARD:
        // in Glacier Sound's floe churn a crash-tack is often the only sane
        // escape, and taxing it cost 7 in-time finishes (arctic 16-seed gate).
        // Same waiver shape as the >16kt no-tack guard: hard grid blockage
        // (land or stamped floe, not grindable soft ice) within ~180u dead
        // ahead frees the flip. Open water keeps the tax.
        if (taxTack && state.course._gridFixed && state.course._gridFixed.length) {
            const gTx = state.course.botGrid;
            if (gTx) {
                for (const dTx of [90, 180]) {
                    const cc = gTx.cell(this.boat.x + Math.sin(this.boat.heading) * dTx,
                                        this.boat.y - Math.cos(this.boat.heading) * dTx);
                    if (!gTx.at(cc[0], cc[1])) {
                        const idTx = cc[1] * gTx.n + cc[0];
                        if (!(gTx._soft && gTx._soft[idTx])) { taxTack = false; break; }
                    }
                }
            }
        }

        // KEEP CLEAR (a) — "a boat keeps clear of a right-of-way boat if the right-of-way
        // boat can sail her course with NO NEED to take avoiding action." NEED is the
        // word doing the work, and the no-contact foul detector had no way to test it.
        // It read `lastAvoidDeviation`, which is this boat's TOTAL deflection from every
        // cause at once — a floe, a mark, a third boat, the arena wall — so a stand-on
        // boat dodging ice was recorded as having been FORCED by her give-way rival, and
        // the rival was penalised for it.
        //
        // Measured, `_foul_truth_probe` over 12 bay races: every single no-contact foul
        // the build fired was against an encounter that would have passed 323-861 units
        // clear had she held her course — 0 of 4 correct, under both reconstructions of
        // the deflection's sign. The detector was not too narrow. It was aimed at the
        // wrong quantity.
        //
        // So compute the quantity itself: the closest the two of them would come if she
        // sails her proper course and the other boat holds hers. Below a hull's width
        // she has to act and the give-way boat has broken her rule; above it, whatever
        // this boat chose to do, she did not need to.
        this.properCourseCPA = null;
        if (this.avoidanceRole === 'STAND_ON' && this.threatBoat && !this.threatBoat.raceState.finished) {
            const o = this.threatBoat;
            const ovxP = (o.velocity && o.velocity.x) ? o.velocity.x * 60 : Math.sin(o.heading) * o.speed * 60;
            const ovyP = (o.velocity && o.velocity.y) ? o.velocity.y * 60 : -Math.cos(o.heading) * o.speed * 60;
            const mvxP = Math.sin(desiredHeading) * speed, mvyP = -Math.cos(desiredHeading) * speed;
            let bestP = Infinity;
            const tEndP = lookaheadFrames / 60;
            for (let t = 0; t <= tEndP; t += tEndP / 12) {
                const dxP = (this.boat.x + mvxP * t) - (o.x + ovxP * t);
                const dyP = (this.boat.y + mvyP * t) - (o.y + ovyP * t);
                const dP = Math.hypot(dxP, dyP);
                if (dP < bestP) bestP = dP;
            }
            this.properCourseCPA = bestP;
        }

        // The engine's Rule 21 gives us right of way over a penalised boat — but
        // holding course at a boat that is SPINNING is standing on into a hazard,
        // not sailing predictably for a rival who can respond. She cannot keep
        // clear of anyone mid-rotation; drop the hold-course bonus against her.
        const threatSpiral = !!(this.threatBoat && this.threatBoat.raceState.penalty
            && this.threatBoat.controller && this.threatBoat.controller.penaltySpin);

        // ONSET AT VO ENTRY, not at detection range (the RRS-ORCA underlay's
        // measured piece). Per-encounter ledgers on the owner's schema-2
        // recordings (redrock n=17, arctic n=83, both roles): 81-100% of
        // encounters had an UNMODIFIED CPA >= 80u — nothing needed doing —
        // and her open-water give-way deflection is 7.5 deg; the bots fire
        // theirs at ~565u range in ~96% of encounters, at detection, against
        // threats that resolve themselves. The term that does it is the soft
        // proximity gradient below: an unthresholded 1/d^2 against EVERY
        // boat whose 4s projection comes inside 250u, role-blind and
        // risk-blind. Gate it on the truncated velocity obstacle actually
        // being ENTERED on current courses — tCPA in (0, tau], CPA inside
        // the owed gap — using the same heading-based metrics the risk
        // ladder trusts (Round-10: projections stay heading-based). Boats
        // already close (inside 130u) keep the gradient: that is spacing
        // pressure in a pack, not a swerve at range. The hard Rule-14
        // collision term is untouched — a boat genuinely converging is
        // still avoided; only the deflection against self-resolving
        // crossings goes away. Rivals only: floes never enter this set.
        // SCOPE: the crossing must LAND in wide water. Both constrained-
        // water benches said the same thing (lake A: land +29%, boat +31%;
        // arctic A: paired -15s, in-time -8): where the water closes
        // escapes, a converging rival is a real constraint and the early
        // spacing nudge is how the fleet keeps its options. And the wrong
        // place to test that is my CURRENT cell — a crossing that begins in
        // open water can land in a corridor four seconds later, which is
        // exactly lake's failure mode. So the nudge is suppressed per rival
        // only when the velocity obstacle is NOT entered AND my projected
        // position at (truncated) tCPA sits in wide water: >= 8 cells of
        // grid clearance, the measured knee that separates bay/ocean/
        // seatrials open water (76-100% of sailed cells) from lake's
        // corridors (10%). Projection stays heading-based (Round-10).
        // Floe venues are fully out of scope: ice does not reciprocate and
        // the pack constrains everything — old behavior byte-for-byte.
        const AVQ = (typeof window !== 'undefined' && window.__AV) ? window.__AV : {};
        const VOTAU = (AVQ.tau != null ? AVQ.tau : 8.0);
        const VOR = (AVQ.r != null ? AVQ.r : 80);
        const VONEED = (AVQ.wide != null ? AVQ.wide : 8);
        if (!this._voIn) this._voIn = new Set(); else this._voIn.clear();
        // VENUE-CLASS GATE (the fourth iteration's lesson, and the same
        // shape as noSubsample scoping off icy grids): three within-venue
        // scopings — none, current-cell clearance, CPA-point clearance —
        // all left lake's contact classes up ~+25% while its clock stayed
        // flat. Losing en-route spacing ANYWHERE in corridor-scale water
        // changes the configuration the fleet ARRIVES at its corridors
        // with; the damage shows up far from where the nudge was dropped.
        // So the suppression is active only in venues whose navigable
        // water is open-scale: clearance p50 over navigable cells >= 10
        // (measured: bay 10, ocean 42, seatrials 40 — vs lake 3, redrock
        // 2; arctic is already out via the floe gate). Computed once per
        // grid and cached.
        let clVO = null, gVO = null;
        if (openWaterAv) {
            gVO = state.course.botGrid;
            if (gVO && !gVO._clear && window.SailCheck && window.SailCheck.clearanceField)
                gVO._clear = window.SailCheck.clearanceField(gVO);
            clVO = gVO && gVO._clear;
            if (clVO && gVO._voWideVenue == null) {
                const navVO = [];
                for (let yv = 0; yv < gVO.n; yv++) for (let xv = 0; xv < gVO.n; xv++)
                    if (gVO.at(xv, yv)) navVO.push(clVO[yv * gVO.n + xv]);
                navVO.sort((a, b) => a - b);
                gVO._voWideVenue = navVO.length > 0 && navVO[Math.floor(navVO.length / 2)] >= 10;
            }
        }
        this._voActive = !!(openWaterAv && clVO && gVO._voWideVenue);
        if (this._voActive) {
            const spdVO = boat.speed * 60;
            const hxVO = Math.sin(boat.heading), hyVO = -Math.cos(boat.heading);
            for (const obV of state.boats) {
                if (obV === boat || obV.raceState.finished) continue;
                const mVO = getRiskMetrics(boat, obV);
                if (mVO.distCurrent < 130 ||
                    (mVO.tCPA > 0 && mVO.tCPA < VOTAU && mVO.distCPA < VOR)) { this._voIn.add(obV); continue; }
                // VO not entered — but keep the nudge anyway if the crossing
                // lands in narrow water.
                const tVO = (mVO.tCPA > 0 ? Math.min(mVO.tCPA, VOTAU) : 4.0);
                const pxVO = boat.x + hxVO * spdVO * tVO, pyVO = boat.y + hyVO * spdVO * tVO;
                const cVO = gVO.cell(pxVO, pyVO);
                if (!gVO.at(cVO[0], cVO[1]) || clVO[cVO[1] * gVO.n + cVO[0]] < VONEED) this._voIn.add(obV);
            }
        }

        // A RIGHT-OF-WAY BOAT SAILS HER PROPER COURSE — ASK THE RULES, NOT THE
        // RISK LATCH (2026-08-19, the deflection push). Measured in the Scenario
        // Lab (RRS 10, 10 seeds, `eval/rl/_deflect_why.js`): the stand-on boat's
        // deviation arms at 656-710u with role still NONE — the risk ladder does
        // not look past 600u, but rights are not a function of range and the
        // rules module answers at any distance. The onset driver is the soft
        // proximity gradient below (worth under 1 point at that range against a
        // pow3 base cost of 0.2 for the first 6-degree nudge), and after the
        // latch she keeps dodging on the hard collision term: the 4s straight-
        // line projection of a give-way boat that has not ducked YET reads as
        // certain collision and buries the 3000*|off| hold bonus. Net: 8-15m off
        // proper on every seed while the give-way boat also ducks 121-180 deg.
        //
        // RRS 14(a): the right-of-way boat "need not act to avoid contact until
        // it is clear that the other boat is not keeping clear." So against a
        // rival the RULES say must keep clear of us, both discretionary terms
        // hold — the spacing gradient and the projected-collision veto — unless:
        //   (a) we JUST acquired the rights and owe room (Rule 15 constraint),
        //   (b) she is owed mark-room in this pair,
        //   (c) she is mid-penalty-spiral (she CANNOT keep clear while she
        //       rotates — the same physical fact as threatSpiral above), or
        //   (d) the pair is at the risk ladder's own IMMINENT thresholds —
        //       from there Rule 14 applies in full, whole fan, old arithmetic.
        // Racing legs only: start-line rights games are the start regime's
        // (the fan's leg guard exists for the same reason — OCS tuning is
        // sacred). 1200u bound = the farthest a 4s projection of two 7.5kt
        // boats can close to gradient range.
        if (!this._rowHold) this._rowHold = new Set(); else this._rowHold.clear();
        const rhWhy = dbgOn ? {} : null; // __AVDBG ledger only: why a rights-holder is NOT held
        if (racingLegF) {
            for (const obR of state.boats) {
                if (obR === boat || obR.raceState.finished) continue;
                const ddR = Math.hypot(obR.x - boat.x, obR.y - boat.y);
                if (ddR > 1200) continue;
                // (A 130u no-hold floor was tried for bay's rub doubling and
                // REVERTED: Rule 11's overlapped pair sits at 100u, and leeward
                // holding her course there IS the doctrine — the floor reverted
                // Rule 11 to its full 15m baseline drift.)
                if (obR.raceState.penalty && obR.controller && obR.controller.penaltySpin) { if (rhWhy) rhWhy[obR.id] = 'spin'; continue; }
                let rowR = null;
                try { rowR = getRightOfWay(boat, obR); } catch (e) { }
                if (!rowR || rowR.boat !== boat) { if (rhWhy) rhWhy[obR.id] = 'not-row'; continue; }
                if (rowR.constraints && rowR.constraints.indexOf('Rule 15') >= 0) { if (rhWhy) rhWhy[obR.id] = 'rule15'; continue; }
                if (rowR.markRoom != null && rowR.markRoom !== boat.id) { if (rhWhy) rhWhy[obR.id] = 'markroom'; continue; }
                // A boat MID-TACK OR FRESH FROM ONE cannot be projected linearly
                // — her velocity sweeps through the turn and then rebuilds from
                // half speed, so distCPA/tCPA are noise on her (the Rule-21
                // spiral lesson, same fact). Measured three ways in the lab:
                // holding through the tack on the linear test put A through B's
                // hull at 5.1s (Rule 13 seed 3477523577); a 150u mid-tack berth
                // moved the contact to 2.5s on seed 3961374258 — the kill shot
                // was POST-tack, A still turning at h29→67 while B's linear test
                // read her as clearing. So: no hold at all on a rival inside her
                // tack or its settle window (0.75 on the 0.24x state clock ≈ 3
                // real seconds past the flip the rules module already stamps) —
                // exactly the baseline behavior that never made contact.
                if (obR.raceState.isTacking) { if (rhWhy) rhWhy[obR.id] = 'tacking'; continue; }
                const flipR = (window.Rules && window.Rules._tackFlipT)
                    ? window.Rules._tackFlipT[obR.id] : undefined;
                if (flipR !== undefined && state.time - flipR < 0.75) { if (rhWhy) rhWhy[obR.id] = 'flip<0.75'; continue; }
                const mR = getRiskMetrics(boat, obR);
                // RELEASE = "clear she is not keeping clear" — CAPABILITY-SCALED
                // (the swamp lesson, 2026-08-20). A fixed tCPA<2 bar assumes she
                // can duck in ~2s; in Gatorgrass's 0.9-4.8kt air a duck takes
                // many seconds and the fixed bar released too late: swamp meds
                // +32/+56 on two of three sets, boat contacts +60%. Ask instead
                // whether she could still open the gap if she acted NOW: the
                // lateral she owes over her achievable lateral rate (~half her
                // speed, floored so a near-stationary boat reads as unable).
                // At 12kt this reproduces the ~2s bar; at 2kt it releases
                // seconds earlier. 60u range floor is unconditional.
                const needU = Math.max(0, 70 - (mR.tCPA > 0 ? mR.distCPA : mR.distCurrent));
                const latRate = Math.max(15, (obR.speed || 0) * 60 * 0.5);
                const tNeed = needU / latRate + 0.5;
                const yieldSafe = () => {
                    // true = her EVIDENT turn (half-second advanced) already
                    // defuses the danger — she is acting, keep/restore the hold
                    if (obR.prevHeading == null) return false;
                    const omR = normalizeAngle(obR.heading - obR.prevHeading) * 60;
                    if (Math.abs(omR) <= 0.2) return false;
                    const hAdv = obR.heading + omR * 0.5;
                    const sp2 = (obR.speed || 0) * 60;
                    const rvx2 = Math.sin(hAdv) * sp2 - Math.sin(boat.heading) * boat.speed * 60;
                    const rvy2 = -Math.cos(hAdv) * sp2 + Math.cos(boat.heading) * boat.speed * 60;
                    const dx2 = obR.x - boat.x, dy2 = obR.y - boat.y;
                    const vSq2 = rvx2 * rvx2 + rvy2 * rvy2;
                    let t2 = 0, d2 = mR.distCurrent;
                    if (vSq2 > 0.001) {
                        t2 = -(dx2 * rvx2 + dy2 * rvy2) / vSq2;
                        if (t2 > 0) d2 = Math.hypot(dx2 + rvx2 * t2, dy2 + rvy2 * t2);
                    }
                    const need2 = Math.max(0, 70 - (t2 > 0 ? d2 : mR.distCurrent));
                    const relAdv = mR.distCurrent < 45 || (need2 > 0 && t2 > 0 && t2 < need2 / latRate + 0.5);
                    return !relAdv;
                };
                // ⚠️ the unconditional floor is HULL-IMMINENT scale (45u ≈
                // contact ~36u + a boat-width of buffer), not a comfort zone:
                // at 60u it out-ranked every capability/yield judgment in
                // exactly the close-quarters regime the owner's doctrine
                // targets — the whole rights-pressing endgame lives at
                // 55-70u ("they approach fairly closely as sailboats do").
                let relNow = mR.distCurrent < 45 || (needU > 0 && mR.tCPA > 0 && mR.tCPA < tNeed);
                // A RIVAL VISIBLY ACTING IS NOT RELEASE-WORTHY (owner doctrine
                // 2026-08-21: estimate the other boat's response). The metrics
                // are heading-based ON PURPOSE, and a give-way boat's hard
                // yield-swing makes her CPA flicker CONVERGING mid-turn — the
                // release fired on exactly the boats doing the right thing,
                // and the stand-on's phantom dodge displaced her rounding
                // entry (measured: 34-57° at t=3, wrong-side mark pass, lost
                // lap). Second opinion: advance HER heading by a half second
                // of her evident turn; if the danger does not survive her
                // turn, she is acting — keep the hold. A rival turning INTO
                // us fails the second opinion too and still releases.
                if (relNow && yieldSafe()) relNow = false;
                if (relNow) {
                    // ...AND THE RELEASE LATCHES. A per-tick release flaps: the
                    // first dodge opens the projected CPA, the pair re-holds,
                    // she straightens, it is imminent again — measured on Rule
                    // 13 Both seed 1035792683 as alternating 92°/0°/69°/40°
                    // swings ending in contact at 4.8s. Once Rule 14 obliges
                    // her to act, she sails ONE consistent evasion: released
                    // for ~3 real seconds (0.75 on the 0.24x state clock),
                    // refreshed while the pair stays hot.
                    if (!this._rhDropT) this._rhDropT = {};
                    this._rhDropT[obR.id] = state.time + 0.75;
                    if (rhWhy) rhWhy[obR.id] = 'release';
                    continue;
                }
                if (this._rhDropT && (this._rhDropT[obR.id] || -1e9) > state.time) {
                    // the anti-flap latch holds the release ~3 real seconds —
                    // but a rival whose EVIDENT turn has already defused the
                    // danger is not a flap risk: her yield is real and the
                    // CPA truly opens. Re-hold early (owner doctrine: the
                    // stand-on reads the other boat's response).
                    if (!yieldSafe()) { if (rhWhy) rhWhy[obR.id] = 'latch'; continue; }
                    delete this._rhDropT[obR.id];
                }
                this._rowHold.add(obR);
            }
        }

        // THE FAR FIELD BELONGS TO THE ROUTER. Post-cap dodge decomposition
        // (_rr_dodge2, redrock/river): with no hard blocker on the small
        // candidates, 62%/47% of wide dodges are bought by the far-blockage
        // term alone — a straight 4s ray outliving the plan's bend and
        // reporting the bend wall as a blockage, in water wide enough that
        // the clearance cap never bites (rival terms: 0 of 1284 episodes).
        // The route only ever crosses water, so land beyond the 140u turning
        // zone ALONG THE PLAN is not a threat — waive the far tax for the
        // plan-aligned candidate. The hard zone stays for every candidate.
        // Guards: fresh plan the boat is actually on (<200u cross-track),
        // never for a no-go heading (a beat's plan direction is dead upwind
        // — waiving its tax against the 500-point irons shaping would dive
        // the argmin into irons), and never while the armed arc probe owns
        // the geometry.
        let hPlanFF = null;
        if (openWaterAv && racingLegF && this.gridPath && this.gridPath.length > 1) {
            const p0FF = this.gridPath[0];
            const dx0FF = p0FF.x - boat.x, dy0FF = p0FF.y - boat.y;
            if (dx0FF * dx0FF + dy0FF * dy0FF < 200 * 200) {
                const ptsFF = this.gridPath;
                let jFF = 0, accFF = 0;
                while (jFF < ptsFF.length - 1 && accFF < 260) {
                    accFF += Math.hypot(ptsFF[jFF + 1].x - ptsFF[jFF].x, ptsFF[jFF + 1].y - ptsFF[jFF].y);
                    jFF++;
                }
                const pFFF = ptsFF[jFF];
                hPlanFF = Math.atan2(pFFF.x - boat.x, -(pFFF.y - boat.y));
            }
        }
        // A2 (2026-08-09, THE ROUNDING PUSH): THE TRUST TEST WAS UNREACHABLE ON
        // A BEAT. `pathSailable` is an A* over a clearance-weighted grid with no
        // wind term, so upwind the router's line runs straight up the corridor
        // and hPlanFF points dead into the no-go. The trust test then asks a
        // sailing boat to be within 0.3 rad of a heading no boat can sail: with
        // the irons guard at 0.62 rad the smallest achievable |h - hPlanFF| on
        // a beat is ~0.5 rad. Measured on redrock leg-3's thread box
        // (_thread_role.js): the 0-rung fails the test on 96.1% of deviating
        // ticks, ALL of them on the alignment clause, at a median 0.78 rad
        // (45deg) — and on 72% of ticks NO candidate in the whole fan earns the
        // trust. So the clearance band and the full 140u hard zone ran
        // unmodified on every upwind leg, which is where the mark-5 thread
        // lives; the argmin's cheapest escape from them is to luff, and 51.4%
        // of chosen headings sat inside the no-go band against 0.0% of the
        // plan rung (bot 41-52 u/s where the human sails 78-90).
        // The route's line on a beat is not "point at the mark" — it is "stay
        // close-hauled on this tack". When the plan bearing is itself inside
        // the no-go, project it onto the close-hauled heading for the tack the
        // boat is ON and measure alignment against that. Same 0.62 constant the
        // irons guard already uses; no clause is relaxed — the irons, arc,
        // open-water and current guards all still apply, and a candidate on the
        // other tack or bearing away still fails. GATED: redrock pooled 6-set
        // paired −64.0 med / −59.9 mean, ALL SIX SETS NEGATIVE (−41..−100), med
        // 520→459 (2.38x→2.10x), fins 427→430/432, DNF-at-900 5→2, land −13%,
        // mark −23%, pen −9%; lake −2/−8 med with land −12%/−24%; bay 0/0 med
        // with rubs −18%/−4%; lagoon 0/−6 med (boat +16%/+13% — the watch
        // column); ocean inert; river + seatrials BYTE-IDENTICAL (they sit
        // behind the current guard and the floe gate by construction).
        let hPlanRef = hPlanFF;
        if (hPlanFF != null && Math.abs(normalizeAngle(hPlanFF - wdAv)) < 0.62) {
            const sideRef = normalizeAngle(boat.heading - wdAv) >= 0 ? 1 : -1;
            hPlanRef = normalizeAngle(wdAv + sideRef * 0.62);
        }

        // (planTightAv — tight-thread following — is computed above, before the
        // candidate fan, because the scoped narrow-passage rungs read it too.)

        // THE FAN GRADES TRACKS, NOT HEADINGS, WHEREVER THE WATER MOVES.
        // Every candidate below is projected as heading x speed and then judged
        // on where that lands — against boats, marks, the arena and the land
        // grid. But `updateBoat` (~12296) adds the stream straight into the
        // velocity, so on a venue with a real current the projected position is
        // not where the boat goes. On river's banks the stream is 3.5 kt = 52
        // u/s, which over this function's own 4-second lookahead is ~208 units
        // of displacement the probe never sees — comparable to the whole probe
        // length. The fan is choosing between fictions.
        //
        // This is the ground-frame lesson one layer above where it was learned.
        // The contact reflex got it (~947) and that fixed RECOVERY; measured
        // here (`_riv_entry.js`, 4 seeds, 313 grounding episodes) the CAUSE is
        // this layer: 45.7% of episodes begin while she is sailing at speed
        // (>60 u/s a second earlier) and those own 66.1% of all grounded time,
        // navigation is the modal helm owner at entry (49.8%, owning 67.7%),
        // avoidance is actively deflecting her in 67.1% of the preceding
        // seconds, and her own land ray was ALREADY showing blockage in 93.6%
        // of them. She is being dodged into a bank she can see, and river is
        // where that is unrecoverable rather than merely slow: the stream at
        // the entry point is 3.53 kt against a grounded boat's 7 u/s, so 64% of
        // contacts have no escaping heading at all (`_ground_drive.js`).
        //
        // Gated on the physics' OWN test for whether current applies at all
        // (`speed > 0.01`, the same one at ~12292 and the same one the escape
        // uses), so it is byte-inert on still water and cannot touch a venue
        // whose water does not move. Computed once — it does not vary with the
        // candidate.
        const curAv = getCurrentAt(boat.x, boat.y);
        const curAvOn = !!(curAv && curAv.speed > 0.01);
        const curAvVx = curAvOn ? Math.sin(curAv.direction) * (curAv.speed / 4) * 60 : 0;
        const curAvVy = curAvOn ? -Math.cos(curAv.direction) * (curAv.speed / 4) * 60 : 0;

        // Retrograde context for the rounding filter below. Floe venues only, so
        // every other venue is byte-identical by construction, and only while the
        // boat is ARMED on the rounding leg — the one state in which "the wrong way
        // round" is even defined.
        const rmRetro = state.course.roundMark && legRoundMark(this.boat.raceState.leg);
        const retroOn = !!(rmRetro && this.boat.raceState.roundArmed && !openWaterAv
                           && this.boat.raceState.leg >= 1 && !this._outbound);
        const brgRetro = retroOn ? Math.atan2(this.boat.y - rmRetro.y, this.boat.x - rmRetro.x) : 0;
        const sgnRetro = (rmRetro && rmRetro.side === 'port') ? -1 : 1;
        let proCost = Infinity, proHeading = null, bestRetro = false, retroSet = false;

        // C1 rollout (see the currency note below): 4 s in 8 steps, heading slews
        // at the bot's own turn authority, speed relaxes toward the polar on the
        // physics' up/down constants (0.9970 / 0.9982 per frame), progress = VMC
        // toward the nav target. The polar table's own edge is honoured (below
        // 30 deg the speed ramps to zero — the table would otherwise wrap to a run).
        const c1On = racingLegF && Math.abs(desTwaAv) < Math.PI / 3.5;
        let c1Ref = 0, c1Roll = null;
        if (c1On) {
            const wAt = getWindAt(this.boat.x, this.boat.y);
            const wsC1 = wAt.speed, spinC1 = !!this.boat.spinnaker;
            const nav = this._lastNav;
            const brgC1 = nav ? Math.atan2(nav.x - this.boat.x, -(nav.y - this.boat.y)) : desiredHeading;
            const turnC1 = getTurnSpeed() * 60 * (1.0 + (this.boat.stats ? this.boat.stats.handling : 0) * 0.03);
            const polC1 = (tw) => {
                const a = Math.abs(tw);
                if (a < 0.5236) return getTargetSpeed(0.5236, spinC1, wsC1) * (a / 0.5236) * 15;
                return getTargetSpeed(a, spinC1, wsC1) * 15;
            };
            const h0 = this.boat.heading, v0 = this.boat.speed * 60;
            c1Roll = (hCand) => {
                let hh = h0, v = v0, prog = 0; const dtC = 0.5;
                for (let i = 0; i < 8; i++) {
                    const d = normalizeAngle(hCand - hh), mx = turnC1 * dtC;
                    hh = normalizeAngle(hh + Math.max(-mx, Math.min(mx, d)));
                    const vp = polC1(normalizeAngle(hh - wdAv));
                    const al = vp > v ? 1 - Math.pow(0.9970, 30) : 1 - Math.pow(0.9982, 30);
                    v += (vp - v) * al;
                    prog += v * Math.cos(normalizeAngle(hh - brgC1)) * dtC;
                }
                return prog;
            };
            c1Ref = c1Roll(desiredHeading);
        }

        for (const offset of candidates) {
            const h = normalizeAngle(desiredHeading + offset);

            // Base Cost: Deviation from desired course
            // Non-linear cost to strongly prefer small deviations
            // WHAT DOES IT COST TO LEAVE YOUR PROPER COURSE?
            //
            // It used to be pow(|offset|,1.5)*10 — a 172-degree reversal priced at 52 and
            // a 92-degree swerve at 20, against proximity terms of 3500-25000, a hard
            // constraint of 500000, and a measured median cost(0) of 7500-15000. The
            // proper-course term was not a term, it was a tiebreaker three orders of
            // magnitude below everything it was weighed against.
            //
            // ⚠️ THIS IS WHY ~12 PREVIOUS RE-PRICINGS WERE INERT. Every one of them
            // LOWERED a threat cost (the clearance cost went 10000 -> 3000 and did
            // nothing), and 25000 -> 8000 leaves a 52-point U-turn just as free. The
            // deviation side had never been raised. A term in the wrong ORDER OF
            // MAGNITUDE is a structural bug, not a knob at its knee.
            //
            // Raise the POWER, not the coefficient. Flat pow1.5*1000 is also fast (lake
            // +44.0, bay +9.0) but taxes small deviations too — and a mark rounding IS a
            // sustained small deviation, so bay mark contacts went 0.53 -> 2.07 and a boat
            // failed to round. pow3*200 prices the 172-degree turn the same (5400 vs 5196)
            // and leaves a 17-degree nudge at 5 instead of 164:
            //
            //   offset      0.3    0.8    1.6    3.0
            //   was         1.6    7.2   20.2   52.0
            //   pow1.5*1000 164    716   2024   5196    <- taxes the rounding too
            //   pow3*200      5    102    819   5400    <- same U-turn, small dodge free
            //
            // It taxes only the manoeuvres the human never makes: she turns >=80 deg in a
            // second in 0 of 6041 lake windows and 0 of 27784 bay windows (`_hdgrate.js`).
            // Racing legs only, for the same OCS reason as the gate above.
            let cost = (this.boat.raceState.leg >= 1)
                ? Math.pow(Math.abs(offset), 3) * 200
                : Math.pow(Math.abs(offset), 1.5) * 10;

            // C1 — THE PROGRESS CURRENCY (the re-entry push, 2026-08-28). Upwind, the
            // proper course has TWO headings, and the deviation term above measured
            // from only one of them: a close-hauled boat needing 30 deg of clearance
            // was charged 25 to bear away to a reach and ~1150 (549 + the flat 600
            // tack tax) to take the other close-hauled board — the IN-BAND escape
            // 5-45x dearer than the out-of-band one (`_band_owner.js`: bay 43x,
            // redrock 16x, arctic 46x at the median of real onsets, the other board
            // inside the fan 92-97% of the time). The band ledger says the fleet
            // spends 53% of an upwind leg close-hauled to his 79% and that the
            // reaching+deep frames are 65-72% of the whole excess distance; the
            // avoidance layer is the last writer of half of those seconds.
            // Two changes, both scoped to RACING LEGS with an UPWIND proper course
            // (the same |desTwa| < pi/3.5 test the tack tax used), byte-identical
            // elsewhere: (1) the deviation reference becomes the NEARER of the two
            // close-hauled boards, so the tack is a proper course, not a 1.4 rad
            // swerve (the U-turn beyond it keeps the full pow3 price); (2) the flat
            // 600 tack tax is replaced by what the tack actually costs — a 4 s
            // rollout of the boat's own turn and speed response through the polar,
            // priced as progress lost toward the current nav target (VMC, u) at
            // 0.6/u. Bearing away is now priced by what it does not buy.
            if (c1On) {
                const hOther = normalizeAngle(2 * wdAv - desiredHeading);
                const devO = Math.abs(normalizeAngle(h - hOther));
                if (devO < Math.abs(offset)) cost = Math.pow(devO, 3) * 200;
                cost += 0.6 * Math.max(0, c1Ref - c1Roll(h));
            } else if (taxTack && (normalizeAngle(h - wdAv) > 0 ? 1 : -1) !== hullTkAv) {
                cost += 600 * jamF;
            }

            // A HEADING INSIDE THE NO-GO IS NOT A COURSE, IT IS A STOP. The tax above
            // catches a candidate that CROSSES to the other tack; it says nothing about
            // one that simply lands head to wind, and the fan is full of those — from
            // close-hauled, a 0.8 rad escape to windward IS the no-go zone. Nothing else
            // in this function knows that such a candidate does not escape anywhere: the
            // projection below happily flies the boat along it at her current speed.
            //
            // Measured on Stillwater Lake (`_stall_probe` + `_irons_entry`, new): the
            // fleet spends 6.4% of the race under one knot against the human's 0.0%,
            // 31.5% of that is head to wind, and **43.7% of every entry into irons is
            // this** — the boat deflected into the no-go by avoidance. She was doing
            // 2.20 kt median two seconds earlier, so it is not light air killing her; it
            // is her own escape. (Tacks are only 19.3%, which is why gating slow tacks
            // moved the total by 5%.)
            //
            // Scaled and shaped like the tack tax next to it: shaping-sized, so the
            // Rule-14 terms still roll over it when luffing head to wind is genuinely
            // the only way out, and waived for a boat with no way on — she can pivot
            // wherever she likes because she has nothing to lose.
            {
                const twaCand = Math.abs(normalizeAngle(h - wdAv));
                // ⚠️ OPEN WATER ONLY, and this is the third change tonight to need that
                // gate for the same underlying fact. Where the obstacle is DRIFTING ICE,
                // luffing head to wind is often the correct escape — you stop, rather
                // than hit a floe that will not keep clear for you — so the option this
                // tax removes is the fleet's best emergency out on exactly the venue
                // where obstacles do not get out of the way. Benched on Glacier Sound:
                // +24.0 paired median, 139 -> 126 finishers, and every contact class up
                // (boat 7.66 -> 11.49, land 27.5 -> 32.9, floe 32.5 -> 38.1).
                if (twaCand < 0.55 && this.boat.raceState.leg >= 1 && openWaterAv) {
                    cost += 500 * jamF * (1 - twaCand / 0.55);
                }
            }

            // RRS Rule 16/14: Stand-on boat holds course...
            // but Rule 14 requires evasive action when "it becomes clear
            // the other boat is not keeping clear."
            // MEDIUM: Full hold-course — give-way boat still has time to act.
            // HIGH: Reduced hold-course — give-way boat may not be keeping
            //       clear; begin accepting evasion per Rule 14.
            // IMMINENT: No hold-course bonus — pure Rule 14 emergency avoidance.
            if (this.avoidanceRole === 'STAND_ON' && !threatSpiral) {
                if (this.riskState === 'MEDIUM') {
                    cost += Math.abs(offset) * 3000 * jamF;
                } else if (this.riskState === 'HIGH') {
                    cost += Math.abs(offset) * 1000 * jamF;
                }
            }

            // Project position at t=lookahead — over the ground (see curAv above),
            // AND OVER THE RUDDER SHE ACTUALLY HAS (v2, 2026-08-11).
            // The land probe below now rolls the boat's own achievable turn, and
            // the redrock 6-set that landed it moved land contacts 39.2 -> 30.3
            // while boat contacts went 9.3 -> 11.6 and lake did the same thing in
            // both sets (+25%, +32%). That asymmetry is the fix applied to half a
            // function: land is graded on the arc the boat will sail, rivals are
            // still graded on a straight line from a heading she is not yet on, so
            // the argmin can pick a candidate whose LAND track is honest and whose
            // RIVAL track is fiction. Same slew (~11712), same reason, same shape.
            // Averaged back into a velocity so every CPA, overlap and tie-break
            // term below keeps its own arithmetic and only the endpoint moves.
            let vx = Math.sin(h) * speed + curAvVx;
            let vy = -Math.cos(h) * speed + curAvVy;
            let futureX = boat.x + vx * (lookaheadFrames / 60);
            let futureY = boat.y + vy * (lookaheadFrames / 60);
            // The rolled substep positions are KEPT now (give-way endgame
            // push, 2026-08-20): the rival test below walks this same arc,
            // so rivals stop being graded on "a straight line from a heading
            // she is not yet on" — the half-a-function asymmetry the v2
            // comment above names is closed.
            let arcPts = null;
            const arcDt = (lookaheadFrames / 60) / 8;
            // D2 — RIVAL HONESTY ON ICE (the GWF re-land, C4 push 2026-08-22):
            // the roll runs on floe venues too — a boat's own achievable turn
            // is venue-independent — but ONLY the boat-vs-boat test consumes
            // it there. On ice, futureX/vx (which feed the land/mark/floe
            // terms) stay the straight projection byte-for-byte.
            {
                const snapP = (this.iceEscapeTimer > 0 && !this.penaltySpin);
                const omP = getTurnSpeed() * 60 * (1.0 + boat.stats.handling * 0.03)
                    * (snapP ? 5.0 : steerageFactor(boat));
                const TP = lookaheadFrames / 60;
                const NP = 8, dtP = TP / NP;
                let hp = boat.heading, xp = boat.x, yp = boat.y;
                arcPts = [[boat.x, boat.y]];
                for (let iP = 0; iP < NP; iP++) {
                    const dhP = normalizeAngle(h - hp);
                    hp = normalizeAngle(hp + Math.sign(dhP) * Math.min(Math.abs(dhP), omP * dtP));
                    xp += (Math.sin(hp) * speed + curAvVx) * dtP;
                    yp += (-Math.cos(hp) * speed + curAvVy) * dtP;
                    arcPts.push([xp, yp]);
                }
                if (openWaterAv) {
                    futureX = xp; futureY = yp;
                    vx = (futureX - boat.x) / TP; vy = (futureY - boat.y) / TP;
                }
            }

            let boatCollision = false;
            let staticCollision = false; // Marks/Boundary
            let ruleViolation = false;
            let proximityCost = 0;
            let iceCrossD1 = false;      // D1v2: this candidate's probe touches ice

            // 1. Boats - Check multiple points along the path
            const boatSamples = 5;
            const costPreRiv = cost; // __AVDBG ledger only (byte-inert unset)
            for (const other of state.boats) {
                if (other === boat || other.raceState.finished) continue;
                
                // A spiraling boat is projected as STATIONARY with a wider berth —
                // the same physical fact as the ice gate: her position over the
                // lookahead is not a line, and she cannot keep clear while she turns.
                const otherSpinC = other.raceState.penalty && other.controller && other.controller.penaltySpin;
                const ovx = otherSpinC ? 0 : ((other.velocity && other.velocity.x) ? other.velocity.x * 60 : Math.sin(other.heading)*other.speed*60);
                const ovy = otherSpinC ? 0 : ((other.velocity && other.velocity.y) ? other.velocity.y * 60 : -Math.cos(other.heading)*other.speed*60);
                const pairSafe = otherSpinC ? Math.max(safeDist, 130) : safeDist;

                // KEEP CLEAR BY ENOUGH, AND NO MORE (2026-08-04b, half 2b).
                // The old shaping paid a flat -800 for ducking a stern and +1500 for
                // crossing a bow, which is a DIRECTION preference with no notion of
                // "enough": against a base deviation cost of pow(offset,1.5)*10 —
                // about 2.5 at 23 degrees — an 800-unit reward buys any swing the fan
                // offers. Measured consequence: 86% of clear-water pairwise onsets
                // were ALREADY clearing by 80u and the boat deflected a median 11deg
                // anyway (p90 92), against a minimal need of 0.
                //
                // Instead, the give-way boat's obligation is stated the way the rule
                // states it: keep clear. Cost falls to ZERO as soon as this candidate
                // clears the safe gap, so the base deviation cost then selects the
                // SMALLEST course change that satisfies it — a minimal escape, which
                // is what lets sailors cross at small gaps. The bow/stern preference
                // survives only as a tie-break at equal clearance.
                if (this.avoidanceRole === 'GIVE_WAY' && other === this.threatBoat
                    && (this.riskState === 'MEDIUM' || this.riskState === 'HIGH')) {
                    const px = other.x - boat.x, py = other.y - boat.y;
                    const rvx = ovx - vx, rvy = ovy - vy;
                    const v2 = rvx * rvx + rvy * rvy;
                    let tc = v2 > 1e-6 ? -(px * rvx + py * rvy) / v2 : 0;
                    if (tc < 0) tc = 0;
                    if (tc > lookaheadFrames / 60) tc = lookaheadFrames / 60;
                    // KEEP CLEAR IS TWO DIFFERENT TESTS, and the definition says
                    // which is which:
                    //   (a) "if the right-of-way boat can sail her course with no
                    //       need to take avoiding action" — a CPA condition, and
                    //       it is satisfied at a SMALL gap. This is why sailors
                    //       cross at gaps that look alarming: a crossing that will
                    //       clear needs no action, so nothing is owed.
                    //   (b) "when the boats are OVERLAPPED, if the right-of-way
                    //       boat can also change course in BOTH DIRECTIONS without
                    //       immediately making contact" — not a CPA condition at
                    //       all. A leeward boat may luff; a windward boat that is
                    //       merely on a diverging track is still not keeping clear
                    //       if the luff would hit her. That is a LATERAL room
                    //       condition, off the right-of-way boat's centreline.
                    // Using a CPA gap for both (the 110u constant this replaces)
                    // is too strict for crossings and too weak alongside.
                    // ⚠️ SCOPED to floe-free water, as an interim. The (a)/(b) split
                    // is a large win on bay (rubs 1.67->1.21, pens 0.51->0.36, OCS
                    // 2.8->0.6% on the disjoint set) and costs arctic 5 in-time
                    // finishes over 32 seeds — the fourth time this session a
                    // rules-correctness improvement has split that way. The cause is
                    // named in the audit and is NOT this rule: 35% of arctic
                    // avoidance frames have no rival within 600u at all, and the
                    // rules layer has no obstruction model (no continuing-obstruction
                    // definition, no "a racing boat is an obstruction to one that
                    // must keep clear of her", no rule 20). Remove this scope once
                    // that is built — it is a stopgap, not the fix.
                    const openWaterKC = !(state.course._floeObjs && state.course._floeObjs.length);
                    // ⚠️ The scope used to do TWO things at once — gate the (a)/(b)
                    // split AND choose the non-overlapped gap (110 on ice, 80 in open
                    // water). Unscoping both together confounds them. Only the split is
                    // unscoped here; the ice gap below is left alone.
                    let overlapped = !!(window.Rules && window.Rules.isOverlapped
                                          && window.Rules.isOverlapped(boat, other));
                    // RRS 19.2(c) — THE SQUEEZE AT A CONTINUING OBSTRUCTION.
                    // "While boats are passing a continuing obstruction, if a boat that
                    // was clear astern and required to keep clear becomes overlapped
                    // between the other boat and the obstruction and, at the moment the
                    // overlap begins, there is not room for her to pass between them,
                    // (1) she is not entitled to room under rule 19.2(b), and (2) while
                    // the boats remain overlapped, she shall keep clear and rules 10 and
                    // 11 do not apply."
                    //
                    // This is the rule the ice needed. The overlapped keep-clear test is
                    // the WEAKER of the two — a 60-unit swing off her centreline against
                    // an 80-110 unit gap — so switching it on in floe-packed water let
                    // boats sail closer to each other in exactly the water where there is
                    // nowhere to go. The rule says the boat squeezed between a rival and
                    // an obstruction does not get that benefit: she keeps clear, at the
                    // full gap, and her overlap buys her nothing.
                    //
                    // "Not room to pass between them" is read off the same grid the bots
                    // route on: if the water a boat-width outboard of us, on the side
                    // away from her, is not navigable, we are the one against the shore.
                    if (overlapped) {
                        // The FLOE-STAMPED grid, not the static one: on Glacier Sound
                        // the obstruction that squeezes boats is drifting ice, and a
                        // floe qualifies as a continuing obstruction whenever a boat
                        // passes alongside it for three hull lengths (165u) — which the
                        // large ones do. (Approximation, stated: the rule also asks that
                        // the squeezed boat BECAME overlapped from clear astern, and the
                        // engine's overlap tracker only records that within two hull
                        // lengths, for rule 17. Applying the geometric squeeze to
                        // whichever boat is against the obstruction is the conservative
                        // reading — it is always the inside boat.)
                        const gx = state.course.botGrid || state.course._botGridStatic;
                        const sx = boat.x - other.x, sy = boat.y - other.y;
                        const sl = Math.hypot(sx, sy);
                        if (gx && sl > 1 && sl < 110 + HULL_R) {
                            const ux = sx / sl, uy = sy / sl;
                            const cc = gx.cell(boat.x + ux * (HULL_R * 2), boat.y + uy * (HULL_R * 2));
                            if (!gx.at(cc[0], cc[1])) overlapped = false;
                        }
                    }
                    let owed, have;
                    if (overlapped) {
                        // How far can she swing her bow "immediately"? Her own turn
                        // rate for ~1.2s, swept by her hull length — plus our beam.
                        const turn = 0.85 * (1 + (other.stats ? other.stats.handling * 0.03 : 0));
                        owed = 55 * Math.sin(Math.min(1.2, turn * 1.2)) + 22;
                        // Lateral offset of our candidate from her centreline.
                        const ohx = Math.sin(other.heading), ohy = -Math.cos(other.heading);
                        const rx = futureX - (other.x + ovx * (lookaheadFrames / 60));
                        const ry = futureY - (other.y + ovy * (lookaheadFrames / 60));
                        have = Math.abs(rx * -ohy + ry * ohx);
                    } else {
                        owed = openWaterKC ? 80 : 110;   // ice venues keep the old gap
                        have = Math.hypot(px + rvx * tc, py + rvy * tc);
                    }
                    if (have < owed) {
                        const short = (owed - have) / owed;
                        cost += 2600 * short * short * jamF;
                        // Tie-break only: at equal clearance, prefer her stern.
                        const dxT = futureX - (other.x + ovx * tc);
                        const dyT = futureY - (other.y + ovy * tc);
                        if (dxT * Math.sin(other.heading) - dyT * Math.cos(other.heading) > 0)
                            cost += 120 * jamF;
                    }
                }

                // RRS Rule 16: ROW boat changing course must give
                // keep-clear boat room to respond. Penalize STAND_ON
                // heading changes that move toward the other boat.
                if (this.avoidanceRole === 'STAND_ON' && this.riskState !== 'LOW') {
                    const toOther = Math.atan2(other.x - boat.x, -(other.y - boat.y));
                    const currentDelta = Math.abs(normalizeAngle(desiredHeading - toOther));
                    const newDelta = Math.abs(normalizeAngle(h - toOther));
                    if (newDelta < currentDelta - 0.05) {
                        // Heading toward other boat — Rule 16 penalty
                        cost += 2000 * jamF;
                    }
                }

                // THE HARD RULE-14 TEST — TRUE CPA ON THE ARC (give-way
                // endgame push, 2026-08-20). The old test walked 5 point
                // samples (t = 0.8..4.0s) along a straight CHORD at the
                // arc-averaged velocity, and its ledger names three failure
                // modes measured in the lab and on bay rubs:
                //   · sub-0.8s contacts fell between the samples — at the
                //     last ticks before contact even straight-ahead read
                //     clear, which is the venue's "dev 0-6° at IMMINENT";
                //   · a turning candidate's chord claimed lateral clearance
                //     the hull hasn't reached yet, so near-range escapes
                //     read as colliding and the argmin fell into the
                //     all-candidates-collide 500000/d² lottery — the
                //     92/0/69/40° flap, reproduced against a rival HOLDING
                //     course (so it is not rival projection);
                //   · the give-way MEDIUM/HIGH bubble (150u) exceeds the
                //     ~100u standing distance of an overlapped pair, so a
                //     converging windward boat lived in permanent-collision
                //     state and bought 34-69° where a small early luff was
                //     owed.
                // Fix: in open water the candidate's own ROLLED arc (the
                // same 8 substeps the land probe sails, computed above) is
                // tested against the rival's line with continuous per-
                // segment CPA — no sampling floor, no chord fiction — and
                // the hard term vetoes at the TRUTH CORE (80u, the normal
                // bubble), not the comfort bubble: the landed keep-clear
                // (a)/(b) term above already prices the rules gap (80u owed
                // crossing / lateral room overlapped), so grading misses by
                // achievable geometry lets the argmin pick the SMALLEST
                // candidate that truly keeps clear — early, small, decisive.
                // Spinner berth (130u) and the start/liveness cores are
                // unchanged; ice venues keep the legacy sampler byte-for-
                // byte (openWaterAv false ⇒ arcPts null), and so does the
                // START (racingLegF, same gate as the candidate fan — start
                // tuning is sacred, d55eb97's 4.4 OCS points say so).
                const arcTest = arcPts && racingLegF;
                // the 80u truth core is an OPEN-WATER call (the rules gap
                // there is priced by the (a)/(b) keep-clear term). On ice
                // the bubbles stay exactly as priced (D2 / GWF re-land).
                const hardCore = otherSpinC ? pairSafe : (openWaterAv ? Math.min(pairSafe, 80) : pairSafe);
                if (arcTest) {
                    let minApproachSq = Infinity;
                    for (let iSeg = 0; iSeg < 8; iSeg++) {
                        const tA = iSeg * arcDt, tB = (iSeg + 1) * arcDt;
                        // relative segment (own arc point minus rival's line)
                        const rax = arcPts[iSeg][0] - (other.x + ovx * tA);
                        const ray = arcPts[iSeg][1] - (other.y + ovy * tA);
                        const rbx = arcPts[iSeg + 1][0] - (other.x + ovx * tB);
                        const rby = arcPts[iSeg + 1][1] - (other.y + ovy * tB);
                        const dxs = rbx - rax, dys = rby - ray;
                        const l2 = dxs * dxs + dys * dys;
                        let tt = l2 > 1e-9 ? -(rax * dxs + ray * dys) / l2 : 0;
                        // an already-inside pair must grade candidates by how
                        // they LEAVE, not auto-veto them all on the shared
                        // t=0 range (the legacy sampler's 0.8s floor never
                        // charged t=0 either) — so the first segment starts
                        // judging a quarter-second out
                        const lo = iSeg === 0 ? 0.5 : 0;
                        if (tt < lo) tt = lo; else if (tt > 1) tt = 1;
                        const cx = rax + dxs * tt, cy = ray + dys * tt;
                        const dSq = cx * cx + cy * cy;
                        if (dSq < minApproachSq) minApproachSq = dSq;
                    }
                    if (minApproachSq < hardCore * hardCore && !this._rowHold.has(other)) {
                        boatCollision = true;
                        // ⚠️ SCALE: the legacy sampler summed 500000/d² over
                        // several violating samples with d collapsing toward
                        // contact — thousands of points. A single true-CPA
                        // evaluation never sees a tiny d for a candidate that
                        // dodges at all, so 500000/d² alone is 30-300 points
                        // here: SOFTER than the fan's own deviation cost
                        // (0.8³·200 ≈ 102), and the argmin would prefer the
                        // shave to the turn (measured: the spinner-control
                        // contact at 37u). The shortfall term keeps the
                        // ordering veto-class: candidates are ranked by how
                        // much of the core they still violate, strongly
                        // enough that no deviation is too expensive to buy
                        // a genuinely bigger miss.
                        const short = 1 - Math.sqrt(minApproachSq) / hardCore;
                        cost += 30000 * short * short + 500000 / (minApproachSq + 10);
                        if (this.riskState === 'IMMINENT') {
                            cost += 20000;
                        } else {
                            try {
                                const res = getRightOfWay(boat, other);
                                if (res.boat === other) ruleViolation = true; // We are Give-Way
                            } catch (e) {}
                        }
                    }
                }
                // Check along the path (5 points). With the arc test above
                // this loop carries only the soft proximity gradient (its
                // else-branch), byte-identical predicate; on ice venues it
                // is still the whole test, unchanged.
                for (let i = 1; i <= boatSamples; i++) {
                    const t = i * (1.0/boatSamples) * (lookaheadFrames / 60);

                    const myPx = boat.x + vx * t; // t in seconds
                    const myPy = boat.y + vy * t;

                    const otherP = {
                        x: other.x + ovx * t,
                        y: other.y + ovy * t
                    };

                    const distSq = (myPx - otherP.x)**2 + (myPy - otherP.y)**2;

                    // _rowHold: she must keep clear and nothing is imminent —
                    // her straight-line projection is not a fact about the
                    // future, and dodging it is what the 8-15m drift was.
                    if (distSq < pairSafe * pairSafe && !this._rowHold.has(other)) {
                        if (!arcTest) {
                            boatCollision = true;
                            // Weight collision by distance (avoid closer/harder collisions more)
                            cost += 500000 / (distSq + 10);

                            // Strict Rule 14 Override for IMMINENT
                            if (this.riskState === 'IMMINENT') {
                                 cost += 20000;
                            } else {
                                // Check Rules
                                try {
                                    const res = getRightOfWay(boat, other);
                                    if (res.boat === other) ruleViolation = true; // We are Give-Way
                                } catch(e) {}
                            }
                        }
                    } else if (distSq < 250 * 250 && this.livenessState === 'normal') {
                        // A RIGHT-OF-WAY BOAT SAILS HER PROPER COURSE (2026-08-04b).
                        // RRS 14: the right-of-way boat need not act to avoid contact
                        // until it is clear the other boat is not keeping clear — and
                        // being predictable is what lets the give-way boat plan a
                        // small, safe crossing. Paying a proximity gradient against a
                        // boat we have rights over makes us swerve for a crossing
                        // that was already going to happen at a comfortable gap, and
                        // measurement says that is most of what the fleet does:
                        // 86% of clear-water pairwise avoidance onsets were ALREADY
                        // clearing by 80u, and the boat deflected a median 11deg
                        // anyway. The hard Rule-14 collision term below is untouched,
                        // so a boat that is genuinely not keeping clear is still
                        // avoided; only the standing-on nudge goes away.
                        if (!(this.avoidanceRole === 'STAND_ON' && other === this.threatBoat)
                            && !this._rowHold.has(other)
                            && (!this._voActive || this._voIn.has(other)))
                            proximityCost += 5000 / (distSq + 10);
                    }
                }
            }

            const rivCostDbg = cost - costPreRiv; // __AVDBG ledger only
            const costPreMk = cost;
            // 2. Marks - Use Segment Distance Check (Prevent Tunneling)
            if (state.course.marks) {
                for (const m of state.course.marks) {
                    // Check distance from Mark to Path Segment (boat -> future)
                    const closest = getClosestPointOnSegment(m.x, m.y, boat.x, boat.y, futureX, futureY);
                    const dSq = (closest.x - m.x)**2 + (closest.y - m.y)**2;

                    // Both radii grow with the mark's own body, so a 30ft committee boat
                    // is given the berth a 24-unit buoy never needed. Written as
                    // (constant + bodyR) so a buoy's bodyR of 12 reproduces the original
                    // 50 and 115 exactly — the goldens are the check on that.
                    const hard = 38 + (m.bodyR || 12), soft = 103 + (m.bodyR || 12);
                    if (dSq < hard*hard) { // Safety radius (Mark body + Boat ~25 + Margin)
                        staticCollision = true;
                        cost += 200000 / (dSq + 1); // Intense penalty for direct hit
                    } else if (dSq < soft*soft && this.livenessState === 'normal') {
                        // Soft avoidance around marks — tighter radius for closer rounding
                        proximityCost += 18000 / (dSq + 100);
                    }
                }
            }

            // 2b. TRAFFIC — THE SOLID MOVING BODY NOBODY TOLD THE PLANNER ABOUT
            // (2026-08-12).
            //
            // `checkTrafficCollisions` says it in its own words: "NOTHING IS TOLD
            // ABOUT THIS. No collisionData, so the planner is untouched — bots
            // cannot see the vessel and will sail into it, which is accepted (a
            // moving caster is planner work, and the planner is being changed
            // elsewhere)." This is that planner work.
            //
            // Measured on the reworked bay (`_bay_traffic`, NEW): **2.04 contacts
            // per boat, median 5.70 s each, 12.9 s/boat** — the boat goes from a
            // settled 114 u/s to **1 u/s** at the bottom of one — against a venue
            // gap of 37 s. **35% of bay's entire gap is being run over by ships the
            // fleet cannot see.**
            //
            // This is not a re-pricing of a trade-off (rule 1): the fan currently
            // scores a candidate that sails through a 700-unit ship as if the water
            // were empty, so a solid object is simply MISSING FROM THE MODEL. It is
            // classified as `staticCollision` — the existing term for an obstacle
            // that pins and does not keep clear — and no new weight is invented.
            //
            // ⭐ AND THE FORECAST IS EXACT. A floe drifts unpredictably past ~5 s
            // ([[regatta-map-staleness]]); a vessel is ON RAILS at a known speed, so
            // projecting it forward over the lookahead is not a guess. Both the boat
            // and the ship are advanced to the SAME sample times and tested there,
            // which is the whole point — a ship that will have gone by is not an
            // obstacle, and one that will arrive is, and only a time-aware test can
            // tell those apart.
            //
            // The shape is the capsule the physics itself collides against (spine
            // segment + beam radius), so the planner and the collider agree.
            // Byte-inert on every venue with no authored traffic by construction.
            if (state.traffic && state.traffic.length) {
                const TLK = lookaheadFrames / 60;
                for (const v of state.traffic) {
                    if (!v.active) continue;
                    const rV = v.hullBeam * 0.5, halfV = Math.max(1, v.hullLen * 0.5 - rV);
                    const fxV = Math.sin(v.heading), fyV = -Math.cos(v.heading);
                    const svx = fxV * v.speed, svy = fyV * v.speed;
                    // broad phase: could these two possibly meet inside the lookahead?
                    const dx0 = v.x - boat.x, dy0 = v.y - boat.y;
                    const closeMax = (speed + Math.abs(v.speed)) * TLK + v.hullLen * 0.5 + 120;
                    if (dx0 * dx0 + dy0 * dy0 > closeMax * closeMax) continue;
                    const NS = 6;
                    for (let iS = 1; iS <= NS; iS++) {
                        const tS = TLK * iS / NS;
                        const bx = boat.x + (futureX - boat.x) * (iS / NS);
                        const by = boat.y + (futureY - boat.y) * (iS / NS);
                        const vx0 = v.x + svx * tS, vy0 = v.y + svy * tS;
                        const ax2 = vx0 - fxV * halfV, ay2 = vy0 - fyV * halfV;
                        const wxV = bx - ax2, wyV = by - ay2;
                        const tt = Math.max(0, Math.min(1, (wxV * fxV + wyV * fyV) / (2 * halfV)));
                        const cxV = ax2 + fxV * tt * 2 * halfV, cyV = ay2 + fyV * tt * 2 * halfV;
                        const dV = Math.hypot(bx - cxV, by - cyV);
                        // HULL_R for the boat, the beam radius for the ship, and the same
                        // ~25u margin the mark test uses.
                        const hardV = rV + 25 + 38;
                        if (dV < hardV) { staticCollision = true; cost += 200000 / (dV * dV + 1); break; }
                        if (dV < hardV + 90 && this.livenessState === 'normal') { proximityCost += 18000 / (dV * dV + 100); }
                    }
                }
            }

            // 3. Boundary - Segment Check
            if (state.course.boundary) {
                const b = state.course.boundary;
                if (b.poly && typeof Arena !== 'undefined') {
                    // POLYGON arena: the bounding circle is far outside the real wall
                    // (Glacier Sound's by kilometres), so the circle test below never
                    // fired and boats drove flat into the invisible wall and pinned.
                    // signedDist is positive inside; small or negative = at the wall.
                    const sdFut = Arena.signedDist(b, futureX, futureY);
                    if (sdFut < 80) staticCollision = true;
                    else if (sdFut < 120) {
                        // Same 80/120 margins the circle check used — a wider band
                        // shied the whole fleet off the course edges and cost
                        // Clubhouse seconds per beat.
                        const sdCur = Arena.signedDist(b, boat.x, boat.y);
                        if (sdFut < sdCur) proximityCost += 5000 * (120 - sdFut) / 120;
                    }
                } else {
                    // Check future point first (simple)
                    const dFut = Math.sqrt((futureX - b.x)**2 + (futureY - b.y)**2);
                    if (dFut > b.radius - 80) staticCollision = true;

                    // Or check a few points if boundary is complex, but circle is easy.
                    // If we are heading OUT, future dist > current dist.
                    const dCurr = Math.sqrt((boat.x - b.x)**2 + (boat.y - b.y)**2);
                    if (dFut > dCurr && dFut > b.radius - 120) {
                         proximityCost += 5000 * (dFut - (b.radius - 120)) / 120;
                    }
                }
            }

            // 4. Island - Collision Check (Local Layer)
            // ⚠️ LAND GOES THROUGH THE GRID, NOT THE POLYGON TEST. The doc coastline
            // is a KEYHOLED ring: its slit is a pair of coincident edges crossing
            // open water, and segmentIntersectsPoly fires on them — an invisible
            // wall. Solo boats with nothing around were measured being deflected
            // dev 1.6-3.0 at the slit until they piled on the real shore. The grid
            // answers "is this water" exactly, keyholes and all.
            // When the trajectory planner steered this tick, floes are ITS domain —
            // probing the floe-stamped grid here re-vetoes the exact thread it chose
            // (stamps are hull+clearance+prediction, fatter than the rollout's truth)
            // and the two deciders saw the rudder in opposite directions. Probe LAND
            // ONLY (static grid) in that case.
            const gAv = this._trajFloe
                ? (state.course._botGridStatic || state.course.botGrid)
                : state.course.botGrid;
            if (gAv) {
                // A SHORELINE DOES NOT MOVE, so the question a candidate heading has to
                // answer is WHERE IT LEADS — not where four seconds of it lead. Every
                // other probe here is time-based because the thing being dodged is also
                // moving. Scaling this one with boat speed put the fleet in a RATCHET: a
                // shore rub costs 60% of speed (`boat.speed *= 0.4`), the shortened probe
                // then sees less water, so she rubs again and it shortens again. At 1
                // knot the whole probe is 60 units — SHORTER THAN ITS OWN 140-unit hard
                // zone — so every candidate that touched land read as an unavoidable
                // collision, the argmin fell back to least-deviation, and the boat held
                // her course into the beach. Measured on Stillwater Lake: 30.6 land
                // contacts per boat-race, 78% of them taken below half a knot, against a
                // human's zero. Floored at four seconds' worth at four knots; above that
                // nothing changes, and the 140-unit hard zone is already a distance, so a
                // longer probe grades the far half rather than vetoing it.
                //
                // ⚠️ ONLY WHERE NOTHING DRIFTS — and this gate is the argument above
                // taken seriously. Where there is ice, `gAv` is the STAMPED grid, so a
                // floored probe is not looking further down a coastline, it is predicting
                // 240 units through a moving pack. Benched on Glacier Sound: +9.0 paired
                // median and 139 -> 130 finishers with floe contacts 32.5 -> 37.8.
                // ⚠️ The ice branch reuses the ORIGINAL expressions rather than
                // recomputing equal ones. `Math.hypot(futureX - boat.x, ...)` and
                // `speed * 4` are equal in arithmetic and not necessarily in floating
                // point, and `stepsAv` and the 140-unit test both round — so a one-ULP
                // difference is a behaviour difference, and the golden traces hash
                // behaviour per frame. This way Glacier Sound is byte-identical, not
                // approximately identical.
                const LAND_PROBE_MIN = 240;
                // THE PROBE REACHES ONLY AS FAR AS THE WATER IS WIDE. In a
                // 300-600u canyon a 240-400u straight ray always ends in wall,
                // so the far-blockage term taxes every corridor candidate and
                // the argmin buys 69-92deg swings nothing physical requires
                // (wide-dodge anatomy: land-only 39% + far-land-in-soft 34% of
                // 4182 redrock episodes). Where the local clearance says the
                // water is narrow (<3 cells), cap the ray at the water's own
                // width — the sailed line bends before the wall arrives. Floor
                // 180u: the 140u hard zone stays intact plus a graded band
                // (the lake ratchet lived below that). Same openWaterAv gate
                // as the floor itself — drifting-ice grids byte-identical.
                let landLenStock = Math.max(LAND_PROBE_MIN, speed * (lookaheadFrames / 60));
                // v2 scopes, both on landed physical lines:
                //  - NOT in >=2kt water (the jam-stamp/arc knee): in a strong
                //    stream a short-probe tight line is water the boat cannot
                //    hold — river gate caught v1 (fins 119->109, rubs x2.8).
                //  - NOT inside a mark's 250u funnel (the congestion scope's
                //    line: the funnel IS the rounding): v1 raised redrock mark
                //    contacts in 4/4 sets — pinch lines need the full probe.
                //  - NOT while a rounding is ARMED (arcR set): the arc probe
                //    IS the landed rounding geometry — shortening it re-blinds
                //    the cove fix (v2 mark contacts stayed +52% with only the
                //    250u funnel excluded; arcs arm out to zone*1.5).
                const capOK = openWaterAv && gAv._clear && !arcR &&
                    (state.course._avCurP90 === undefined || state.course._avCurP90 < 2.0);
                if (capOK) {
                    const ccB = gAv.cell(boat.x, boat.y);
                    const idB = ccB[1] * gAv.n + ccB[0];
                    const clB = gAv._clear[idB];
                    if (clB >= 0 && clB < 3) {
                        let inFunnel = false;
                        for (const mF of (state.course.marks || [])) {
                            const dxF = mF.x - boat.x, dyF = mF.y - boat.y;
                            if (dxF * dxF + dyF * dyF < 250 * 250) { inFunnel = true; break; }
                        }
                        if (!inFunnel) {
                            landLenStock = Math.max(180, Math.min(landLenStock, (clB + 1) * gAv.res * 2));
                        }
                    }
                }
                // The land ray keeps its LENGTH (a clearance distance) but is
                // aimed down the track, for the same reason as the projection
                // above: a ray along the heading grades water the stream will
                // not take her through. Still water leaves the unit vector
                // exactly Math.sin(h)/-Math.cos(h), so this is byte-inert there.
                // ...and the still-water branch keeps the ORIGINAL expression
                // rather than the algebraically-equal normalized one: vx/hypot
                // is sin(h) in exact arithmetic but not always to the last bit,
                // and a 1-ulp move is enough to flip a golden behaviour hash.
                // Inert here has to mean identical, not equivalent.
                const landLen = openWaterAv ? landLenStock : 0;
                const trkL = curAvOn ? (Math.hypot(vx, vy) || 1) : 1;
                const landFX = openWaterAv
                    ? boat.x + (curAvOn ? (vx / trkL) : Math.sin(h)) * landLen : futureX;
                const landFY = openWaterAv
                    ? boat.y + (curAvOn ? (vy / trkL) : -Math.cos(h)) * landLen : futureY;
                const segLen = openWaterAv
                    ? landLen : Math.hypot(futureX - boat.x, futureY - boat.y);
                const stepsAv = Math.max(2, Math.min(8, Math.ceil(segLen / (gAv.res * 0.6))));
                // Armed-rounding arc (see arcR above): constant-curvature
                // rollout from the boat at this candidate heading, curving
                // toward the mark's side of the heading. Straight ray
                // otherwise — bit-for-bit the stock expressions.
                let arcK = 0;
                // THE ARC REACHES THE ICE VENUES (2026-08-08, the granite
                // rounding). arcR is computed under its own guards (current,
                // queued rival) with no floe test — but this openWaterAv kept
                // the rollout straight in floe water, so at granite-isle the
                // boat sat ARMED for 45-166s probing an 851u-zone island with
                // straight 4s rays that all read the isle as collision. The arc
                // IS "probe the water the boat will sail" at a rounding — the
                // landed cove fix — and the ice it may cross is priced by the
                // same _soft grind costs on the arc samples. The queued-rival
                // gate (the redrock m5 wedge lesson) still disables it in a
                // parked crowd, and ≥2kt current still disables it entirely.
                if (arcR) {
                    const brgM = Math.atan2(arcMx - boat.x, -(arcMy - boat.y));
                    arcK = (normalizeAngle(brgM - h) >= 0 ? 1 : -1) / arcR;
                }
                // THE HARD ZONE IS TURNING ROOM, AND TURNING ROOM IS TIME —
                // BUT ONLY THE ROUTER'S OWN LINE EARNS THE TRUST (v2). The
                // 140u veto is ~1.4s of travel at full speed; at 0.6 kt it is
                // a minute and a half, and at the corridor's bend it vetoes
                // the plan-aligned sailing candidate exactly when the boat
                // most needs it — the parked boat then sits head-to-wind
                // (offset-0 + a 500-point irons tax beats a wall veto), which
                // is the m5 approach box in one sentence (1343 boat-s pooled,
                // 97% on-plan, wind 11.5 kt, land <140u on the plan heading
                // in 72% of parked samples). v1 scaled the veto for EVERY
                // candidate and paid on lake both sets (+8s, land +40%: slow
                // corridor boats freed toward any shore hug it and grind).
                // The route only ever crosses water, so the candidate aligned
                // with the plan (the far-field waiver's own 0.3-rad test and
                // guards) gets the veto scaled to the boat's real time-to-
                // wall — 1.4s, floored at 60u (3+ boat-lengths), capped at
                // the stock 140. Every other heading keeps the full veto.
                // Scopes on landed lines: floe water untouched (openWaterAv),
                // never under the armed arc (arcK), never a no-go heading,
                // never in a ≥2kt stream (time-to-wall is ground speed
                // there).
                // HZ2 (2026-08-09): A SLOW BOAT'S TIME-TO-WALL BOUNDS ITS RISK IN
                // EVERY DIRECTION. The plan-alignment window exists to keep a FAST
                // boat from trusting an off-plan heading — and it is exactly the
                // condition the redrock leg3 pocket fails (aligned 28%, plan ref
                // present 69% at slow-static choices, n=1933, _pocket_argmin): the
                // displaced boat trying to rejoin the plan kept the full 140u veto
                // where this scaling's own formula floors it at 60u, and the pocket
                // parked 94% static. Waive ALIGNMENT ONLY, for boats under 40 u/s;
                // the irons, current and armed-arc guards stay. Gated: redrock
                // pooled 6-set paired −34 med / −37 mean (ALL sets negative), fins
                // 376→386, boat rubs −20%, penalties −11%; lake/bay/lagoon flat-to-
                // better; ocean 16 EXACT + river + arctic + seatrials byte-identical
                // (river/arctic sit behind the current/floe guards by construction).
                const hzWaive = !arcK && boat.speed * 60 < 40
                    && Math.abs(normalizeAngle(h - wdAv)) >= 0.62
                    && (state.course._avCurP90 === undefined || state.course._avCurP90 < 2.0);
                const hardZ = (openWaterAv && !arcK
                    && (hzWaive || (hPlanFF != null
                        && Math.abs(normalizeAngle(h - hPlanRef)) <= 0.3))
                    && Math.abs(normalizeAngle(h - wdAv)) >= 0.62
                    && (state.course._avCurP90 === undefined || state.course._avCurP90 < 2.0))
                    ? Math.max(60, Math.min(140, boat.speed * 60 * 1.4))
                    // ⚠️ THE HARD ZONE IS TURNING ROOM, AND TURNING ROOM IS TIME.
                    // 140u is "a couple of boat-lengths" — at 148 u/s it is 0.95
                    // seconds, and at 0.9 rad/s of rudder that is not a dodge, it
                    // is the moment before the grounding. Measured (island 8's
                    // notch, river 9501 t171-173.5): a give-way boat held 1.6 rad
                    // straight into the face at 143-148 u/s for 12 seconds — the
                    // graded far-land term (30000·(1−frac)) is the same order as
                    // the rival-proximity terms it was traded against, and the
                    // fixed wall only vetoed inside 140u, where no candidate
                    // could turn her in time. 1.5 s of way is the wall now, so a
                    // fast approach meets the veto while the rudder still has
                    // authority to matter. Slow boats (<93 u/s) are unchanged
                    // (max(140, ...) reduces to 140 exactly), so the swamp fleet
                    // (mean 31 u/s) is byte-identical; floe venues keep the fixed
                    // wall (drifting-ice threads are the other side of rule 5's
                    // line — arctic is untouched by construction via openWaterAv);
                    // rounding arcs (arcK) keep their own geometry.
                    : ((openWaterAv && !arcK) ? Math.max(140, boat.speed * 60 * 1.5) : 140);
                // ⭐ THE PROBE ROLLS THE BOAT'S OWN TURN. A COMMANDED HEADING IS
                // NOT A TRACK, AND THE RUDDER IS NOT INSTANTANEOUS.
                // The ray above starts at the boat and runs along the CANDIDATE
                // heading, as if she were already on it. She is not:
                // `updateBoat` (~11712) slews `heading` toward the command at
                // getTurnSpeed()*60*(1+handling*0.03)*steerageFactor — 0.9 rad/s
                // at full authority, which at 100 u/s is a 111-unit turn radius,
                // wider than redrock's channels. Until the slew finishes she is
                // sailing an arc, and the wider the dodge the less the graded ray
                // has to do with where she goes.
                //
                // Measured on redrock (`_track_vs_ray.js`, 4 seeds, 3221 followed
                // decisions): the realized track strays a median 62u / p90 186u
                // from the ray it was graded on — the grid's own cell is 50u — and
                // 16.3% of decisions whose chosen ray reads CLEAR run the boat into
                // land inside that ray's own length (47.8% inside the sw-inlet
                // pocket). The failure rate is monotone in the turn asked for:
                // 4.6% / 9.8% / 16.8% / 25.3% / 42.8% across 0.15/0.35/0.70/1.20/
                // 1.20+ rad.
                //
                // ⚠️ That is a correlation with an obvious confounder — big turns
                // are asked for in dangerous water. `_arc_predict.js` settles it by
                // scoring both probes against the outcome: ray-clear AND arc-clear
                // grounds 6.4% of the time, ray-clear but ARC-BLOCKED grounds
                // 34.5% — a 5.39x lift, and 63.6% vs 28.6% inside the pocket. The
                // arc predicts what the ray misses, so the ray is the wrong shape
                // rather than danger being self-reporting. A candidate clear on
                // BOTH verdicts existed on 76.7% of those ticks, so there is
                // somewhere better to go.
                //
                // This is rule 19c's own prescription — "curvature in a probe needs
                // the boat's own achievable turn as its ceiling". What 19c killed
                // was the PLAN's curvature, which clears water the boat will not
                // reach; the boat's own slew rate is the opposite quantity.
                // Same family as `fbb1c27` (grade tracks, not headings) and
                // `2cbf847` (rank for the boat she is): a layer optimizing against
                // a model the physics does not honour.
                //
                // Gated on `openWaterAv` — the same drifting-ice line the land
                // probe's floor, its ray direction and its far-blockage waiver all
                // sit on (rule 5) — so floe water is byte-identical by construction
                // and the armed-rounding arc keeps its own geometry.
                const snapAv = (this.iceEscapeTimer > 0 && !this.penaltySpin);
                const omAv = getTurnSpeed() * 60 * (1.0 + boat.stats.handling * 0.03)
                    * (snapAv ? 5.0 : steerageFactor(boat));
                const perUA = (openWaterAv && !arcK) ? omAv / speed : 0;
                const dsA = segLen / stepsAv;
                let rhA = boat.heading, rxA = boat.x, ryA = boat.y;
                for (let sI = 1; sI <= stepsAv; sI++) {
                    const frac = sI / stepsAv;
                    let pxA, pyA;
                    if (arcK) {
                        const sA = frac * segLen;
                        pxA = boat.x + (Math.cos(h) - Math.cos(h + arcK * sA)) / arcK;
                        pyA = boat.y - (Math.sin(h + arcK * sA) - Math.sin(h)) / arcK;
                    } else if (perUA > 0) {
                        const dhA = normalizeAngle(h - rhA);
                        rhA = normalizeAngle(rhA + Math.sign(dhA) * Math.min(Math.abs(dhA), perUA * dsA));
                        if (curAvOn) {
                            const sxA = Math.sin(rhA) * speed + curAvVx;
                            const syA = -Math.cos(rhA) * speed + curAvVy;
                            const nlA = Math.hypot(sxA, syA) || 1;
                            rxA += (sxA / nlA) * dsA; ryA += (syA / nlA) * dsA;
                        } else {
                            rxA += Math.sin(rhA) * dsA; ryA += -Math.cos(rhA) * dsA;
                        }
                        pxA = rxA; pyA = ryA;
                    } else {
                        pxA = boat.x + (landFX - boat.x) * frac;
                        pyA = boat.y + (landFY - boat.y) * frac;
                    }
                    const cc = gAv.cell(pxA, pyA);
                    if (!gAv.at(cc[0], cc[1])) {
                        // Floe-plugged (SOFT) water is a grind, not a wall — the
                        // route may deliberately cross it. Land is a wall.
                        const idS = cc[1] * gAv.n + cc[0];
                        if (gAv._soft && gAv._soft[idS]) {
                            // Opening lead: light touch. Staying plugged: costly but
                            // committable — when the route decides the narrows must
                            // be ground through, the local layer has to let it
                            // (weaving in front of a plugged gateway was measured
                            // at 160s vs a ~25s grind).
                            proximityCost += (gAv._soft[idS] === 1 ? 6000 : 12000) * (1 - frac * 0.5);
                            continue;
                        }
                        // TIGHT-tier water while the plan threads it (planTightAv):
                        // sailable bow-first, priced as caution not wall. The
                        // plan-aligned candidate pays NOTHING — the router already
                        // taxed this thread and chose it; any helm-side surcharge
                        // re-litigates that choice in a currency (pow³ deviation
                        // ~10²) the surcharge dwarfs, and the argmin buys a
                        // circumnavigation instead (measured here: 3000 on the
                        // aligned rung sent the lab boat 2000u around the block —
                        // HZ3B's lesson, only the router's line earns the trust).
                        // Other headings pay a stiff caution but keep probing — the
                        // REAL land behind the tier still vetoes inside the hard
                        // zone, so the slot's walls remain walls and only near-axis
                        // headings read sailable, which is the physical truth of a
                        // slot. Off-thread boats keep the wall verdict untouched.
                        if (planTightCells && planTightCells.has(idS)) {
                            const alignedT = hPlanFF != null && !arcK
                                && Math.abs(normalizeAngle(h - hPlanRef)) <= 0.3;
                            if (dbgOn) (window.__TDBG = window.__TDBG || []).push(
                                { t: +state.time.toFixed(2), off: offset, frac: +frac.toFixed(2),
                                  al: alignedT ? 1 : 0, h: +h.toFixed(3) });
                            if (!alignedT) proximityCost += 15000 * (1 - frac * 0.5);
                            continue;
                        }
                        // NEAR-TERM blockage is a wall; FAR blockage along a straight
                        // 4-second probe is not — a probe that overshoots a gap into
                        // the ice behind it must not veto the gap the router chose.
                        // Hard zone is a fixed DISTANCE (a couple of boat-lengths of
                        // turning room), not a fraction: at speed, 40% of the probe
                        // was 190u and vetoed every thread the pack offered.
                        if (frac * segLen <= hardZ) { staticCollision = true; cost += 500000; }
                        else if (!hzWaive && (hPlanFF == null || arcK
                            || Math.abs(normalizeAngle(h - hPlanRef)) > 0.3
                            || Math.abs(normalizeAngle(h - wdAv)) < 0.62)) {
                            proximityCost += 30000 * (1 - frac);
                            if (dbgOn) (window.__TDBG2 = window.__TDBG2 || []).push(
                                { t: +state.time.toFixed(2), off: offset, site: 'far',
                                  add: Math.round(30000 * (1 - frac)) });
                        }
                        break;
                    }
                }
                if (!staticCollision && gAv._clear) {
                    const ce = arcK
                        ? gAv.cell(boat.x + (Math.cos(h) - Math.cos(h + arcK * segLen)) / arcK,
                                   boat.y - (Math.sin(h + arcK * segLen) - Math.sin(h)) / arcK)
                        : gAv.cell(landFX, landFY);
                    const idAv = ce[1] * gAv.n + ce[0];
                    const clr = gAv._clear[idAv];
                    // HZ3B (2026-08-09, THE REDROCK PUSH): ONLY THE ROUTER'S OWN
                    // LINE EARNS THE TRUST — and the clearance band was un-earning
                    // it. In redrock's narrows the 0-rung loses to PROX_STATIC in
                    // 34-62% of its defeats while PLAN-ALIGNED (leg4-sub5: 94%
                    // aligned): the band's 10000-scale tax sits in the same order
                    // as cost(0) (7500-15000) and flips the winner off the thread
                    // the router deliberately priced, tick after tick. The
                    // candidate that passes the hard zone's own trust test
                    // (aligned 0.3 rad, open water, no arc, not irons, <2kt
                    // stream) pays no clearance-band tax; every other heading
                    // keeps the full lee-shore caution. Deliberately NOT extended
                    // to the slow-boat waiver: freeing slow boats toward any
                    // low-clearance shore is the v1 lake kill. GATED: redrock
                    // pooled 6-set paired −85.0 med / −78.7 mean, ALL SIX SETS
                    // NEGATIVE (−47..−121), med 572→490, fins 386→391, land −16%,
                    // pen −6% (boat +4%); lake −5/−3 med both sets; lagoon flat,
                    // land A −27%; bay A −0.6 mean, bay B + ocean + river 2x16 +
                    // arctic 4x16 BYTE-IDENTICAL; seatrials ~197.8 equivalent.
                    const bandTrusted = openWaterAv && !arcK && hPlanFF != null
                        && Math.abs(normalizeAngle(h - hPlanRef)) <= 0.3
                        && Math.abs(normalizeAngle(h - wdAv)) >= 0.62
                        && (state.course._avCurP90 === undefined || state.course._avCurP90 < 2.0);
                    if (dbgOn && clr >= 0 && clr < 3) (window.__TDBG2 = window.__TDBG2 || []).push(
                        { t: +state.time.toFixed(2), off: offset, site: 'band',
                          clr, bt: bandTrusted ? 1 : 0 });
                    if (!bandTrusted && clr > 0 && clr < 3) {
                        // FLOE-caused narrowness is grindable; LAND-caused is not.
                        // When the static (land-only) grid says this water is clear,
                        // the low clearance here comes from stamped ice — price it
                        // at grind scale, keep full lee-shore caution near land.
                        // (Inert without floes: static and stamped clearance agree.)
                        let cScale = 10000;
                        const gStat = state.course._botGridStatic;
                        let floeCausedD3 = false;
                        if (gStat && gStat !== gAv && window.SailCheck) {
                            // static _clear is lazy (only pathSailable builds it) and
                            // routing runs on the stamped grid — build it once here.
                            if (!gStat._clear) gStat._clear = window.SailCheck.clearanceField(gStat);
                            if (gStat._clear[idAv] >= 3) { cScale = 4000; floeCausedD3 = true; }
                        }
                        if (floeCausedD3) {
                            // D3 — FL1c, THE CLEARANCE BAND'S FLOE HALF SEES THE
                            // TRUE HULL (C4 push, 2026-08-22). The band was the
                            // last consumer of fat stamps: it demanded 3 CELLS of
                            // stamped clearance (stamps = hull+clearance+
                            // prediction) where the recorded human's revealed
                            // demand is a 46u median / 32u p25 pass-by CPA to the
                            // true hull. Measured (_phantom_why): 48% of solo
                            // AVOID_NONE deviation onsets were priced by this
                            // band's floe half; 55-62% of the deviated time
                            // counterfactually cleared at his margins. Same fix
                            // class as FL1/FL1b (change what is MEASURED, keep
                            // the price scale): clearance at the probe endpoint
                            // to the predicted true hull, demand 78u (his p25
                            // clearance-at-tack; solo A/B paid mean −14.7 s/boat
                            // with floe episodes 18→12).
                            let tcD3 = Infinity;
                            const tED3 = lookaheadFrames / 60;
                            for (const fD3 of (state.course._floeObjs || [])) {
                                const dxD3 = fD3.x - landFX, dyD3 = fD3.y - landFY;
                                if (dxD3 * dxD3 + dyD3 * dyD3 > (fD3.radius + 260) * (fD3.radius + 260)) continue;
                                const cD3 = floeHullClear(fD3,
                                    landFX - (fD3.driftVx || 0) * tED3,
                                    landFY - (fD3.driftVy || 0) * tED3, tED3);
                                if (cD3 < tcD3) tcD3 = cD3;
                            }
                            const dmR1 = this.boat.raceState.roundArmed ? 78 : 60;
                            if (tcD3 < dmR1) proximityCost += 4000 * (1 - Math.max(0, tcD3) / dmR1);
                        } else {
                            proximityCost += cScale * (1 - clr / 3);
                        }
                    }
                }
            }
            if (nearIslands && nearIslands.length) {
                // We use the segment from boat to future position
                const start = { x: boat.x, y: boat.y };
                const end = { x: futureX, y: futureY };

                for (const isl of nearIslands) {
                    // Fixed land is the grid's job (above); the polygon test stays
                    // for drifting floes, whose movement the grid only sees at its
                    // refresh cadence. When the trajectory planner has already
                    // steered this tick, floes are ITS job — double-counting them
                    // here re-vetoes the thread it chose.
                    if (isl.fromMask && gAv) continue;
                    if (isl.isFloe && this._trajFloe) {
                        // D1v2: information-only ice test for escape candidates —
                        // the planner cleared only the zero offset. NO cost here.
                        if (iceHardD1 && offset !== 0 && !iceCrossD1) {
                            const tMidI = (lookaheadFrames / 60) * 0.5;
                            const shXI = (isl.driftVx || 0) * tMidI, shYI = (isl.driftVy || 0) * tMidI;
                            const sIx = boat.x - shXI, sIy = boat.y - shYI;
                            const eIx = futureX - shXI, eIy = futureY - shYI;
                            const dI = Geom.distToSegment({ x: isl.x, y: isl.y },
                                { x: sIx, y: sIy }, { x: eIx, y: eIy });
                            if (dI < isl.radius + 30 + 21
                                && floeSegNear(isl, sIx, sIy, eIx, eIy, tMidI, 12.6)) iceCrossD1 = true;
                        }
                        continue;
                    }
                    // PREDICT the floe, don't pad it. Drift velocity is known
                    // exactly, so test the candidate segment against the floe where
                    // it WILL BE mid-lookahead (equivalently: shift the segment the
                    // other way). The old blanket 170-unit pad closed every gap in
                    // the pack whether the ice was coming or going; the honest
                    // margin is prediction error, which is a fraction of that.
                    const tMid = (lookaheadFrames / 60) * 0.5;
                    const shX = isl.isFloe ? (isl.driftVx || 0) * tMid : 0;
                    const shY = isl.isFloe ? (isl.driftVy || 0) * tMid : 0;
                    // 70 -> 21: recorded human races clear floes at 14-19u every
                    // run; the pad has to stay above that floor (bots lack human
                    // reflexes) but 70 refused threads the venue is designed
                    // around. Staged A/B found the knee: 35 and 21 both paid
                    // (fleet finishers 24->33->43); 14 collapsed solo seeds.
                    const movePad = isl.isFloe ? 21 : 0;
                    const startS = { x: start.x - shX, y: start.y - shY };
                    const endS = { x: end.x - shX, y: end.y - shY };
                    // Quick Bounding Box/Circle Check
                    const d = Geom.distToSegment({x: isl.x, y: isl.y}, startS, endS);
                    if (d < isl.radius + 30 + movePad) { // Close to island
                        // NEAR/FAR grading, like the land probe: a floe the probe
                        // meets in its far half is seconds away — the next replan
                        // and the router deal with it. Hard-vetoing everything the
                        // 4s probe touches made the pack unthreadable, and this
                        // venue is DESIGNED so the fast line threads the pack.
                        const midS = { x: (startS.x + endS.x) / 2, y: (startS.y + endS.y) / 2 };
                        // FL1b: floes use the TRUE hull at its PREDICTED spin
                        // (the drift shift is already applied to the segment;
                        // rotation was not — and the circle OR-fallbacks below
                        // re-added the phantom band FL1 removed from the far
                        // field). The sampled hull test subsumes both: a point
                        // inside the hull is "near" at any pad, and the pad is
                        // the same movePad*0.6 the OR-term carried. Land keeps
                        // the exact current-pose polygon test.
                        const nearHit = isl.isFloe
                            ? floeSegNear(isl, startS.x, startS.y, midS.x, midS.y, tMid, movePad * 0.6)
                            : Geom.segmentIntersectsPoly(startS, midS, isl.vertices);
                        const farHit = !nearHit && (isl.isFloe
                            ? floeSegNear(isl, midS.x, midS.y, endS.x, endS.y, tMid, movePad * 0.6)
                            : Geom.segmentIntersectsPoly(midS, endS, isl.vertices));
                        if (nearHit) {
                            staticCollision = true;
                            cost += 500000; // HUGE penalty (Hard Constraint)
                        } else if (farHit) {
                            // GRIND-PRICED for floes. The recorded humans pass ice at
                            // 14-19u and grind through the pack when the line is short
                            // (24 contacts in a 220s finish); the margin round cut the
                            // hard pads to match (movePad 21) but left these GRADED
                            // terms at wall prices — so a candidate that merely passed
                            // a floe inside 100u cost thousands while a 25-45deg swing
                            // cost ~13-59 (pow(offset,1.5)*10), and the argmin bought
                            // the swing every time. Measured (1Hz transit attribution,
                            // 8 seeds, 2026-08-03d): 50% of the fleet's 15.3k-u excess
                            // transit distance was sailed under active avoidance
                            // deflection (mean 49deg), tacks 16 vs the human's 3, dist
                            // ratio 1.99 vs 0.94. At 6000/2500 the 16-seed gate paid
                            // +13 med paired, in-time 29->40, grind time DOWN (less
                            // deflection = less pinning). Land keeps wall prices.
                            // (notch2: 6000→3500 and band 2500→1200 paid a further
                            // +12 med / +18.8 mean paired on the 16-seed gate, return
                            // ratio 1.91→1.70, min 270 — priced by 3 fins@900 churn,
                            // in-time flat 40. The knee is somewhere below; a notch3
                            // must watch the 900-cap finisher count first.)
                            if (isl.isFloe && iceHardD1 && offset !== 0) iceCrossD1 = true; // D1v2 flag; price unchanged
                            proximityCost += isl.isFloe ? 3500 : 25000;
                        } else {
                            // Proximity penalty (Buffer zone)
                            const band = 80 + movePad;
                            if (isl.isFloe) {
                                // FL1b: buffer measured from the TRUE predicted
                                // hull, not the bounding circle — the band keeps
                                // its size, it just starts at the real edge.
                                const mx2 = (startS.x + endS.x) / 2, my2 = (startS.y + endS.y) / 2;
                                const clr = Math.min(
                                    floeHullClear(isl, startS.x, startS.y, tMid),
                                    floeHullClear(isl, mx2, my2, tMid),
                                    floeHullClear(isl, endS.x, endS.y, tMid));
                                if (clr < band) proximityCost += 1200 * (1.0 - Math.max(0, clr) / band);
                            } else if (d < isl.radius + band) {
                                proximityCost += 10000 * (1.0 - (d - isl.radius)/band);
                            }
                        }
                    }
                }
            }

            // 3b. RRS 19 obligation: this candidate squeezes an inside boat
            // toward the land — treat like any other rule violation.
            for (const r19 of rule19Pairs) {
                const o = r19.other;
                const tSec = lookaheadFrames / 60;
                const ovx19 = (o.velocity && o.velocity.x) ? o.velocity.x * 60 : Math.sin(o.heading) * o.speed * 60;
                const ovy19 = (o.velocity && o.velocity.y) ? o.velocity.y * 60 : -Math.cos(o.heading) * o.speed * 60;
                const gap = (futureX - (o.x + ovx19 * tSec)) * r19.ax + (futureY - (o.y + ovy19 * tSec)) * r19.ay;
                if (gap < 110) cost += 22000;
            }

            if (boatCollision) {
                if (this.livenessState === 'force') cost += 500; // Prefer glancing/missing
                else if (this.livenessState === 'recovery') cost += 2000;
                else cost += 10000;
            }

            if (staticCollision) {
                // Static obstacles cause pinning.
                if (this.livenessState === 'force') cost += 500; // Allow getting close/rubbing
                else if (this.livenessState === 'recovery') cost += 8000;
                else cost += 15000;
            }

            if (ruleViolation) {
                if (this.livenessState === 'force') cost += 0; // IGNORE RULES
                else if (this.livenessState === 'recovery') cost += 1000;
                else cost += 20000;
            }

            cost += proximityCost;

            // COMMITMENT. The cost landscape in cluttered water is noisy tick to
            // tick, and an argmin that re-picks freely at 10Hz saws the rudder.
            // ⚠️ The discount must only break NEAR-TIES. At -400 it exceeded every
            // deviation cost and became a lock: one wide dodge at the start and the
            // boat kept "committing" to a reversal for thirty seconds, sailing away
            // from the course at full speed against its own strategy.
            if (this._lastAvoidChoice != null && this.boat.speed > 1.0 &&
                state.course._gridFixed && state.course._gridFixed.length &&
                Math.abs(normalizeAngle(h - this._lastAvoidChoice)) < 0.12) {
                // ⭐ COMMITMENT MAY BREAK TIES. IT MAY NOT BEAT SAILING STRAIGHT.
                //
                // This discount is the ONLY term in the whole cost function that can go
                // NEGATIVE, so it is the only way a deflected candidate can beat a
                // free-and-clear offset 0 (whose base cost is pow(0,3)*200 = 0 exactly).
                // Measured on redrock with the offset-0 veto ledger (_avwhy, 48415
                // deflections over 3 races, mean deflection 54.6 deg): **11.7% of all
                // deflections happen with NOTHING vetoing the straight course** — no boat
                // in the bubble, no static block, no rule, not even a soft proximity cost.
                // Those can only be this line. The arithmetic agrees: a candidate needs
                // pow(|off|,3)*200 < 60, i.e. |off| < 38 deg, which is exactly the band
                // where cross-track error was measured DIVERGING at every scale.
                //
                // So it latches: once the boat has turned away, holding that turn scores
                // -60 against a straight course at 0, and it keeps turning away from a
                // route nothing is stopping it from sailing.
                //
                // ⚠️ THIS IS NOT THE CLOSED COMMITMENT FAMILY. That family is 0-for-7 and
                // every one of those rejections ADDED commitment (side-locks, flip
                // cooldowns, floe-identity locks); its dose-response control found holding
                // to be monotonically bad — ONE second of hold already cost +25 s of
                // transit. Nobody ever tested REMOVING the discount that ships. This moves
                // in the direction that control points, not against it.
                //
                // The clamp keeps what the discount is FOR (the argmin saws the rudder at
                // 10 Hz in cluttered water, and near-ties should stick) and removes only
                // the case it was never meant to buy: preferring a dodge to a clear lane.
                cost = Math.max(cost - 60, (this._costHold != null ? this._costHold : 0));
            }
            // A near-reversal is an emergency manoeuvre, not a preference. Its
            // pow(|offset|,1.5) base cost is pocket change next to collision terms,
            // which is correct in an emergency and wrong the rest of the time. A
            // boat with way on shouldn't throw it away; a stuck boat may need to.
            if (Math.abs(offset) > 1.8 && this.boat.speed > 1.0) cost += 250;

            if (offset === 0) this._costHold = cost;
            // THE FAN HAS NO IDEA IT IS IN A ROUNDING (2026-08-11).
            //
            // A rounding is a fixed amount of TURNING about a mark, and the engine
            // banks sweep for it. The avoidance argmin knows nothing about that: a
            // candidate that carries the boat BACKWARDS around the mark unwinds
            // sweep she has already earned and costs the fan exactly nothing.
            //
            // Measured (`_ring_motion`, NEW): inside arctic's armed granite-isle
            // rounding — 81.6 s/boat, 59% of the venue's whole 137.7 s/lap gap —
            // 46.7% of all motion is RADIAL rather than around, and 1 701 u/boat is
            // RETROGRADE against 2 832 u/boat of net progress the required way. The
            // avoidance argmin owns 53.8 of the 112.9 armed seconds and produces
            // 2 848 u of the radial motion (52%) and 975 u of the retrograde (57%).
            // He banks MORE sweep than they do (5.63 rad vs 4.88) in 31.3 s.
            //
            // So: while a SAFE prograde candidate exists — one the fan itself scores
            // as hitting nothing and breaking no rule — a retrograde one is not an
            // action she has. This adds no cost and changes no weight; it removes a
            // choice that unwinds the manoeuvre she is committed to. The emergency
            // path is untouched: if every prograde candidate collides or fouls, the
            // argmin's own answer stands exactly as today.
            if (retroOn) {
                const utx = -Math.sin(brgRetro) * sgnRetro, uty = Math.cos(brgRetro) * sgnRetro;
                const tanC = Math.sin(h) * utx - Math.cos(h) * uty;
                if (tanC > 0 && !boatCollision && !staticCollision && !ruleViolation && cost < proCost) {
                    proCost = cost; proHeading = h;
                }
                if (tanC < 0) retroSet = true;
            }
            if (dbgOn) dbgRows.push({ off: offset, cost, prox: proximityCost, riv: rivCostDbg, pre: costPreRiv, mkp: costPreMk,
                bc: boatCollision ? 1 : 0, sc: staticCollision ? 1 : 0, rv: ruleViolation ? 1 : 0 });
            if (cost < minCost) {
                minCost = cost;
                bestHeading = h;
                bestIceD1 = iceCrossD1;
                bestRetro = retroOn
                    ? ((Math.sin(h) * (-Math.sin(brgRetro) * sgnRetro) - Math.cos(h) * (Math.cos(brgRetro) * sgnRetro)) < 0)
                    : false;
            }
            // D1v2: track the best FULLY-CLEAN candidate (no collisions, no
            // rule violation, probe touches no ice) in parallel.
            if (iceHardD1 && !iceCrossD1 && !boatCollision && !staticCollision
                && !ruleViolation && cost < minCleanCost) {
                minCleanCost = cost;
                bestCleanH = h;
                bestCleanRetro = retroOn
                    ? ((Math.sin(h) * (-Math.sin(brgRetro) * sgnRetro) - Math.cos(h) * (Math.cos(brgRetro) * sgnRetro)) < 0)
                    : false;
            }
        }
        // D1v2 substitution: the winning escape crossed ice while a clean
        // escape existed — take the clean one. A boxed boat (no clean
        // candidate) keeps the stock ordering untouched.
        if (bestIceD1 && bestCleanH != null) { bestHeading = bestCleanH; bestRetro = bestCleanRetro; }
        if (retroOn && bestRetro && proHeading != null) bestHeading = proHeading;
        void retroSet;
        this._lastAvoidChoice = bestHeading;

        // Expose how far avoidance pushed us off our intended course — the
        // no-contact foul detector reads this as "avoiding action taken".
        // The SIGNED sibling is instrumentation (Scenario Lab flap metric):
        // the abs() hides which side the helm committed to, so side flips
        // are invisible to any consumer of the unsigned value.
        this.lastAvoidDeviationSigned = normalizeAngle(bestHeading - desiredHeading);
        this.lastAvoidDeviation = Math.abs(this.lastAvoidDeviationSigned);
        if (dbgOn) {
            let bestR = dbgRows[0];
            for (const r of dbgRows) if (r.cost < bestR.cost) bestR = r;
            let rng = Infinity, nearB = null;
            for (const ob of state.boats) {
                if (ob === boat || ob.raceState.finished) continue;
                const dN = Math.hypot(ob.x - boat.x, ob.y - boat.y);
                if (dN < rng) { rng = dN; nearB = ob; }
            }
            let rowDbg = null;
            if (nearB && rng < 1200) {
                try {
                    const rr = getRightOfWay(boat, nearB);
                    rowDbg = { row: rr.boat ? rr.boat.name : null, rule: rr.rule || null,
                               cons: (rr.constraints || []).join(','),
                               held: this._rowHold.has(nearB) ? 1 : 0 };
                } catch (e) { rowDbg = { err: String(e).slice(0, 60) }; }
            }
            let near250 = 0, held250 = 0;
            for (const ob of state.boats) { if (ob === boat || ob.raceState.finished) continue;
                if (Math.hypot(ob.x - boat.x, ob.y - boat.y) < 250) { near250++; if (this._rowHold.has(ob)) held250++; } }
            (window.__AVLOG = window.__AVLOG || []).push({ near250, held250, why: nearB ? (rhWhy[nearB.id] || (this._rowHold.has(nearB) ? 'held' : 'far')) : null,
                t: +state.time.toFixed(2), n: boat.name,
                role: this.avoidanceRole, risk: this.riskState,
                vo: this._voActive ? 1 : 0, voin: this._voIn ? this._voIn.size : 0,
                rng: rng === Infinity ? null : Math.round(rng), rowDbg,
                dev: +this.lastAvoidDeviation.toFixed(3),
                zero: dbgRows.find(r => r.off === 0), best: bestR,
                hp: hPlanFF == null ? null : +hPlanFF.toFixed(3),
                hpr: hPlanRef == null ? null : +hPlanRef.toFixed(3),
                pt: planTightAv ? 1 : 0,
                h0: +desiredHeading.toFixed(3),
                full: window.__AVDBG.full ? dbgRows : undefined });
        }
        return bestHeading;
    }
});
