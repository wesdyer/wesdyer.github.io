// regatta/js/ai/navigation.js — BotController navigation & strategy:
// getNavigationTarget, getStrategicHeading, and the prestart/start layer.
// Methods are installed on BotController.prototype (class declared in ai/bot.js,
// which must load first). Object.assign-defined methods behave identically for
// callers and for probes that wrap BotController.prototype. Extracted verbatim
// from script.js (refactor 2026-08-24).
Object.assign(BotController.prototype, {
    getNavigationTarget() {
        const boat = this.boat;
        const marks = state.course.marks;
        if (!marks || marks.length < 2) return { x: boat.x + 1000, y: boat.y }; // Fallback

        // 1. Determine Ultimate Destination (Mark/Gate/Finish)
        let destX, destY;

        if (boat.raceState.finished) {
            // Sail to nearest boundary
            const b = state.course.boundary;
            if (b) {
                const angle = Math.atan2(boat.y - b.y, boat.x - b.x);
                destX = b.x + Math.cos(angle)*(b.radius+500);
                destY = b.y + Math.sin(angle)*(b.radius+500);
            } else {
                destX = boat.x; destY = boat.y - 1000;
            }
        } else if (state.course.type === 'islandRound' && boat.raceState.leg >= 1 && state.course.roundMark) {
            // ISLAND COURSE. Follow THE RULER: the DMC leg path is the course's own
            // ideal line — grid-routed around static land, tangent in, the checked
            // rounding arc at a radius proven navigable, tangent out. Chase a point a
            // few lengths ahead of our own progress along it. The old orbit math
            // aimed at zone geometry with no notion of what water the arc crossed,
            // and on Glacier Sound the fleet milled in the island's lee forever.
            const rs = boat.raceState;
            // THIS leg's rounding mark. Every orbit, entrance-hunt and exit decision
            // below is geometry about `rm` — pinned to `roundMark` (the course's FIRST
            // rounding), a five-rounding course deadlocked on leg 2: the walker watched
            // mark two while the armed orbit dutifully circled mark one, forever.
            const rm = legRoundMark(rs.leg) || state.course.roundMark;
            const dmcLeg = state.course.dmc && state.course.dmc.legs && state.course.dmc.legs[rs.leg];
            if (dmcLeg && dmcLeg.pts && dmcLeg.pts.length >= 2 && typeof CoursePath !== 'undefined') {
                // ONCE THE SWEEP IS MADE, GET OUT. The rounding leg's ideal path ends
                // at the exit tangent — INSIDE the completion radius (zone*1.25), so a
                // boat that faithfully follows it to the end hovers there, stalls, and
                // the net-sweep accounting unwinds its rounding as it drifts back. The
                // moment the sweep is essentially complete, the thing to follow is the
                // NEXT leg's path, outbound.
                let followLeg = rs.leg;
                let followPath = dmcLeg;
                const swept = (rs.roundSweep || 0);
                const needSw = (rm && rm.reqSweep != null) ? rm.reqSweep * ROUND_SWEEP_TOL : Math.PI / 4;
                const nextPath = state.course.dmc.legs[rs.leg + 1];
                // LATCHED handoff: the sweep oscillates around the threshold as the
                // boat weaves (measured 2.90 peak against a 2.55 requirement with no
                // completion — outbound/orbit flapped at the boundary). Once earned,
                // outbound holds unless the sweep genuinely collapses.
                // The pre-bank handoff to the next leg's path is GONE: it preempted
                // the armed exit-hunt (dmcFollowLeg flipped to leg+1 the moment the
                // sweep banked, so the boat detoured toward home through the pack
                // instead of punching out through the scanned exit sector). The
                // follower switches paths only when the ENGINE actually advances
                // rs.leg. (The outbound latch itself lives in update().)
                //
                // R1 EXIT-HANDOFF: on a FLOE-FREE venue the POST-bank picture is
                // different — the rounding is EARNED (the _outbound latch is the
                // bank AND the string wrap) and the measured cost of riding the
                // ring to a rotation-sector punch-out is 100-250u sailed past
                // the mark away from the next leg on every clean venue. Once
                // outbound, sail the next leg's plan from wherever the boat is:
                // the destination moves onto the next path and the strategy
                // layer sails it through the same pipeline every leg uses (this
                // is NOT the dead aimed-exit-bearing family). The engine still
                // advances at its own zone-exit test. Floe venues keep the
                // exit hunt byte-for-byte (the pack is what it exists for);
                // _outbound resets on leg change, so back-to-back roundings
                // hand off one leg at a time.
                if (state.course._hasFloes == null) {
                    state.course._hasFloes = (state.course.islands || []).some(i => i.isFloe);
                }
                if (this._outbound && !state.course._hasFloes
                    && state.course.route && state.course.route[rs.leg]
                    && state.course.route[rs.leg].kind === 'round'
                    && nextPath && nextPath.pts && nextPath.pts.length >= 2) {
                    followLeg = rs.leg + 1;
                    followPath = nextPath;
                }
                const dmcLegF = followPath;
                if (this.dmcFollowLeg !== followLeg) { this.dmcFollowLeg = followLeg; this.dmcHint = null; this.dmcCarrotS = null; }
                const s = CoursePath.project(dmcLegF, boat.x, boat.y, this.dmcHint);
                this.dmcHint = s;
                const LOOKP = 450;
                const cum = dmcLegF.cum, pts = dmcLegF.pts;

                // ROUTE FREEDOM UNTIL THE ROUNDING. Sticky ruler carrots pin the boat
                // to the ideal line at 450u hops, so the grid router can only ever
                // detour WITHIN a hop — measured: a drifting pack across the line at
                // one bend held a fast boat for 300 seconds while a 1.5km-wide open
                // corridor sat next door. Far from the mark, the destination is the
                // ruler's ZONE-APPROACH point and the whole distance belongs to the
                // floe-aware time-cost router, which is free to go wide. The ruler
                // takes over only for the approach and the arc itself.
                // Hysteresis on the mode boundary, or the two targets (zone-entry
                // point vs ruler carrot) alternate as the boat's distance wobbles
                // across the line — measured as a 150s orbit of the whole basin ring
                // at d≈1500-2300 straddling the old single threshold.
                const dRm = rm ? Math.hypot(boat.x - rm.x, boat.y - rm.y) : Infinity;
                if (this._rulerMode && dRm > rm.zone * 2.8) this._rulerMode = false;
                if (!this._rulerMode && dRm < rm.zone * 2.1) this._rulerMode = true;

                // ROUNDING MACHINERY ONLY ON THE ROUNDING LEG. After the bank,
                // roundArmed resets — and the entrance hunt was RE-ARMING on the
                // return leg, steering finished rounders back into the zone they
                // had just fought out of (measured: banked t=330, then 470s lost,
                // ending at the map corner). A non-rounding leg is pure route
                // freedom: aim at the leg's end, the router owns the water.
                const isRoundLeg = state.course.route && state.course.route[rs.leg]
                    && state.course.route[rs.leg].kind === 'round';
                if (!isRoundLeg) {
                    const lastP = pts[pts.length - 1];
                    destX = lastP.x; destY = lastP.y;
                } else {

                // HUNT THE ENTRANCE. At full density the pack rafts onto the ruler's
                // entry bearing (drift piles floes on the down-drift side), while
                // the windward sector is swept clean — a fixed entry bearing is a
                // fair-weather suggestion. Scan the zone's sectors against the LIVE
                // grid, pick the clearest radial (cheapest to reach going the
                // required way round), ride the ring to it, cut in. Arming and the
                // orbit-to-sweep machinery take over from there.
                let entryHandled = false;
                if (rm && followLeg === rs.leg && this._rulerMode && !rs.roundArmed
                    && dRm > rm.zone * 0.95 && state.course.botGrid) {
                    const gE = state.course.botGrid;
                    const sgnR = rm.side === 'port' ? -1 : 1;
                    const myBrg = Math.atan2(boat.y - rm.y, boat.x - rm.x);
                    this._entryT = (this._entryT || 0) - 0.1;
                    if (this._entryBrg == null || this._entryT <= 0) {
                        this._entryT = 2.0;
                        // CROWDING: rivals nearer the mark own their approach sector.
                        // Everyone scoring sectors the same way rafts the whole fleet
                        // onto one slot (the convergence trap) — and a slot only
                        // admits one boat when it cracks. Push later arrivals to the
                        // next-best sector; waiting is fine, queueing is not.
                        const rivals = [];
                        for (const ob of state.boats) {
                            if (ob === boat || ob.isPlayer || ob.raceState.finished) continue;
                            if (ob.raceState.leg !== rs.leg || ob.raceState.roundArmed) continue;
                            const dOb = Math.hypot(ob.x - rm.x, ob.y - rm.y);
                            if (dOb < rm.zone * 2.5 && dOb < dRm) {
                                rivals.push(Math.atan2(ob.y - rm.y, ob.x - rm.x));
                            }
                        }
                        let bestA = null, bestScore = -Infinity;
                        for (let k = 0; k < 16; k++) {
                            const a = k / 16 * Math.PI * 2;
                            let clear = 0, blocked = 0, churn = 0;
                            for (const rr of [1.5, 1.3, 1.1, 0.95, 0.8, 0.7]) {
                                const px = rm.x + Math.cos(a) * rm.zone * rr;
                                const py = rm.y + Math.sin(a) * rm.zone * rr;
                                const cc = gE.cell(px, py);
                                const idE = cc[1] * gE.n + cc[0];
                                if (gE.at(cc[0], cc[1])) clear += (gE._futBlk && gE._futBlk[idE]) ? 0.3 : 1;
                                else if (gE._soft && gE._soft[idE] === 1) clear += 0.5;
                                else blocked++;
                                // CHURN, not just clearance: a sector that is open right
                                // now but thick with drifting ice is a washing machine —
                                // measured 104 of 146 armed seconds lost in one such
                                // sector while the risk-free windward sectors swept
                                // 0.8 rad in ~10s each.
                                if (gE._floeRisk && gE._floeRisk[idE]) churn++;
                            }
                            let da = (a - myBrg) * sgnR;
                            while (da < 0) da += Math.PI * 2;
                            while (da >= Math.PI * 2) da -= Math.PI * 2;
                            let crowd = 0;
                            for (const rb of rivals) {
                                const dAng = Math.abs(normalizeAngle(a - rb));
                                if (dAng < 0.6) crowd += (1 - dAng / 0.6);
                            }
                            const score = clear * 10 - blocked * 8 - churn * 4 - da * 3 - crowd * 7;
                            if (score > bestScore) { bestScore = score; bestA = a; }
                        }
                        // (Ruler-entry on clean uncontested rings was A/B'd here —
                        // skip the hunt, let the DMC follower carry the approach —
                        // and REJECTED: paired gain fell from +8.0s to +1.6s. The
                        // sector hunt's cut-in beats the tangent follower on this
                        // engine even alone in open water.)
                        this._entryBrg = bestA;
                    }
                    if (this._entryBrg != null) {
                        // FLOE-FREE VENUES ONLY. On a packed ring the scored sector IS
                        // the water — leading off it aims at exactly the ice the scan
                        // avoided — so the arctic entrance hunt stays untouched, the
                        // same line the ruler-entry rejection drew.
                        if (state.course._hasFloes == null) {
                            state.course._hasFloes = (state.course.islands || []).some(i => i.isFloe);
                        }
                        const ENTRY_CUT_LEAD = state.course._hasFloes ? 0 : 0.6;
                        let da = (this._entryBrg - myBrg) * sgnR;
                        while (da < 0) da += Math.PI * 2;
                        while (da >= Math.PI * 2) da -= Math.PI * 2;
                        if (da > 0.4 && da < Math.PI * 2 - 0.4) {
                            // Ride the ring the required way toward the chosen sector.
                            const aNext = myBrg + sgnR * 0.55;
                            destX = rm.x + Math.cos(aNext) * rm.zone * 1.35;
                            destY = rm.y + Math.sin(aNext) * rm.zone * 1.35;
                        } else {
                            // On the sector: cut in — LEADING the required way round,
                            // not radially at the mark.
                            //
                            // A radial dive crosses the zone rim with no tangential
                            // velocity at all, and inside the zone angular rate is v/r:
                            // at 150 u/s and 65 units off the mark that is 2.3 rad per
                            // SECOND, so whichever side the boat happens to drift to is
                            // the way it banks. Five of the six ≥16s bay roundings arm
                            // with sweep already between −0.69 and −1.99 (probe
                            // bay_hairpin_hp_markesc, zone 165, first sample at d 64-184)
                            // and then run it out to −4.8 before unwinding: they entered
                            // the wrong way round and paid 7 rad to undo one second.
                            //
                            // Aiming a lead angle ahead in the ROTATION makes the entry
                            // tangential on the required side, so the first second of
                            // sweep is banked the right way by construction. This is a
                            // per-boat aim point — each boat leads off its OWN chosen
                            // sector. It deliberately does NOT touch the shared sector
                            // SCORE, which is what rafted the fleet onto one slot when
                            // that was tried (entry-sector bias, rejected 2026-08-03f).
                            const aCut = this._entryBrg + sgnR * ENTRY_CUT_LEAD;
                            const orbCut = orbitTightR(rm);
                            const rCut = orbCut != null ? orbCut : rm.zone * 0.72;
                            destX = rm.x + Math.cos(aCut) * rCut;
                            destY = rm.y + Math.sin(aCut) * rCut;
                        }
                        entryHandled = true;
                    }
                }

                // ARMED = PURE ORBIT, from ANY distance, in ANY mode. Once the zone
                // is nicked, every other navigation mode fights the sweep: the
                // widened sticky carrot froze across the ring; far-mode dragged
                // blown-out boats back to the rafted SW entry through the whole
                // pack. The orbit target adapts its radius (tight inside the ring,
                // 1.6x zone outside, straight back toward the ring from far away)
                // and the lead angle carries the boat the required way round.
                if (!entryHandled && rm && rs.roundArmed && followLeg === rs.leg) {
                    const brgA = Math.atan2(boat.y - rm.y, boat.x - rm.x);
                    const sgnA = rm.side === 'port' ? -1 : 1;
                    if (!this._outbound) {
                        // OUTWARD SPIRAL, WIDE THROUGH CHURN. Sweep credit runs to
                        // 2.5x zone, and 75s/lap was being lost wading the orbit
                        // through drifting ice the entrance hunt had rightly
                        // avoided — swing the target out past risky water.
                        // (The trough-timed lead that lived here was dead code after
                        // hold-and-charge was retired — its wind EMA no longer exists.)
                        // (#47 A/B: the RL env's grid said advance 1.1 beats 0.85
                        // solo — and the FLEET rejected it 51->41 rounders, the
                        // same solo-good/fleet-bad signature as the orbit-hold.
                        // 0.85 stays. Solo-env optima do not transfer to traffic.)
                        let aA = brgA + sgnA * 0.85;
                        // ORBIT AT THE HUMAN RING, NOT AN OUTWARD SPIRAL. Every
                        // recorded human rounding sweeps at 0.5-0.9x zone (med
                        // ~0.75) and only leaves the ring to exit; the old
                        // dRm+140 target walked the radius out to 1.6x zone —
                        // roughly double the circumference for the same sweep
                        // (bot sweep-phase med 159s vs human 35s). Far boats
                        // still close on the ring; inside, the target now sits
                        // at 0.85x zone instead of 140u further out than
                        // wherever the boat happens to be.
                        const orbA = orbitTightR(rm);
                        const RA = Math.min(rm.zone * 1.6,
                            Math.max(orbA != null ? orbA : rm.zone * 0.85, dRm - 80));
                        // RL pilot hook (sweep-policy research): inert unless the
                        // headless harness injected __rl. actFor(boat) — the
                        // fleet-gate path — outranks the single-hero act.
                        if (typeof window !== 'undefined' && window.__rl) {
                            const a = window.__rl.actFor ? window.__rl.actFor(boat)
                                : (boat === window.__hero ? window.__rl.act : null);
                            if (a) aA = brgA + sgnA * a[0];
                        }
                        // (A/B Aug 4: widening the orbit target out of _floeRisk water
                        // regressed the benchmark 92.3->91.3 — the longer arc costs
                        // more than the churn it avoids. And ORBIT-HOLD — station-
                        // keeping when the arc ahead is plugged — was solo-best-ever
                        // (93.2/4 roundings) but fleet-negative in ALL THREE rival
                        // gatings (unconditional: sweep 125->238s, gridlock; armed-
                        // rival gate: finishers 30->20; any-rival gate: 30->26, the
                        // hold hurts the HOLDER too). Engine economics: soft cells
                        // are passable and contact is cheap — GRIND, don't wait.)
                        destX = rm.x + Math.cos(aA) * RA;
                        destY = rm.y + Math.sin(aA) * RA;
                    } else {
                        // SWEEP EARNED — HUNT THE EXIT. A blind outward spiral hits
                        // the ring's outer shell wherever it happens to sit and the
                        // boat orbits UNDER it forever (measured: sweep 4.32 banked
                        // in the accumulator, radius pinned under 1063 for 380s).
                        // The engine banks on ANY outward breach — so scan the
                        // sectors like the entrance hunt and punch out through the
                        // clearest one ahead in the rotation.
                        const gX = state.course.botGrid;
                        this._exitT = (this._exitT || 0) - 0.1;
                        if (gX && (this._exitBrg == null || this._exitT <= 0)) {
                            this._exitT = 2.0;
                            let bestX = null, bestSc = -Infinity, ringDirty = false;
                            for (let k = 0; k < 16; k++) {
                                const a = k / 16 * Math.PI * 2;
                                let clear = 0, blocked = 0, churn = 0;
                                for (const rr of [1.05, 1.2, 1.35, 1.5, 1.65]) {
                                    const px = rm.x + Math.cos(a) * rm.zone * rr;
                                    const py = rm.y + Math.sin(a) * rm.zone * rr;
                                    const cc = gX.cell(px, py);
                                    const idX = cc[1] * gX.n + cc[0];
                                    if (gX.at(cc[0], cc[1])) clear += (gX._futBlk && gX._futBlk[idX]) ? 0.3 : 1;
                                    else if (gX._soft && gX._soft[idX] === 1) { clear += 0.5; ringDirty = true; }
                                    else { blocked++; ringDirty = true; }
                                    if (gX._floeRisk && gX._floeRisk[idX]) { churn++; ringDirty = true; }
                                }
                                let da = (a - brgA) * sgnA;
                                while (da < 0) da += Math.PI * 2;
                                while (da >= Math.PI * 2) da -= Math.PI * 2;
                                // Exits are not entries: ANY breach banks the leg, so
                                // a decent sector NOW beats a perfect one half a ring
                                // away (a boat chased re-shopped far exits for 1.5 laps).
                                const sc = clear * 10 - blocked * 8 - churn * 4 - da * 9;
                                if (sc > bestSc) { bestSc = sc; bestX = a; }
                            }
                            // CLEAN RING: no shell to breach. The sector machinery is
                            // pack-ice logic — ride the ring to the clearest radial,
                            // punch out to 1.7x — and on open water it exits wherever
                            // the sweep happened to bank, then turns around (measured
                            // on Lighthouse Cove: +3-7s at EVERY rounding, the largest
                            // per-leg sink on the venue). With nothing to dodge, the
                            // exit that matters is the one the NEXT leg starts with.
                            this._exitClean = false;
                            if (!ringDirty) {
                                const nxt = state.course.dmc && state.course.dmc.legs
                                    && state.course.dmc.legs[rs.leg + 1];
                                if (nxt && nxt.pts && nxt.pts.length) {
                                    // ~600u along the next path clears the arc geometry
                                    // near the mark before committing to a bearing.
                                    let tp = nxt.pts[nxt.pts.length - 1];
                                    for (let k = 0; k < nxt.pts.length; k++) {
                                        if (nxt.cum[k] > 600) { tp = nxt.pts[k]; break; }
                                    }
                                    const bOut = Math.atan2(tp.y - rm.y, tp.x - rm.x);
                                    // TRUE RUNS only (the strategy layer's own
                                    // downwind boundary). Aimed exits were A/B'd at
                                    // three thresholds: dead-upwind aim pinched, a
                                    // forced close-hauled tack lost 3-4s on the beat
                                    // leg, and even a 49° gate still aimed the
                                    // beat-feeding exit at a close reach toward the
                                    // shore corridor (-4s paired, three runs in a
                                    // row). Upwind and reach first boards belong to
                                    // the strategy layer; the old radial exit hands
                                    // over to it cleanly.
                                    const lwX = getWindAt(rm.x, rm.y).direction;
                                    const twaOut = normalizeAngle(bOut - lwX);
                                    if (Math.abs(twaOut) >= Math.PI * 0.7) {
                                        bestX = bOut;
                                        this._exitClean = true;
                                    }
                                }
                            }
                            this._exitBrg = bestX;
                        }
                        if (this._exitBrg != null && this._exitClean) {
                            // Straight out along the next leg — any outward motion
                            // banks the rounding; no ring ride, no radial ritual.
                            const RXo = Math.max(rm.zone * 1.45, dRm + 120);
                            destX = rm.x + Math.cos(this._exitBrg) * RXo;
                            destY = rm.y + Math.sin(this._exitBrg) * RXo;
                        } else if (this._exitBrg != null) {
                            let da = (this._exitBrg - brgA) * sgnA;
                            while (da < 0) da += Math.PI * 2;
                            while (da >= Math.PI * 2) da -= Math.PI * 2;
                            // COMMIT once nearly there: re-shopping the exit every 2s
                            // while the shell drifts kept one boat riding the ring for
                            // a lap and a half (5.65 rad) without ever punching. Soft
                            // ice grinds; the breach only needs seconds.
                            if (da <= 0.6 || da >= Math.PI * 2 - 0.6) this._exitT = 15.0;
                            if (da > 0.35 && da < Math.PI * 2 - 0.35) {
                                // Keep rotating toward the exit sector at the ring.
                                const aA = brgA + sgnA * 0.6;
                                destX = rm.x + Math.cos(aA) * Math.max(dRm, rm.zone * 0.95);
                                destY = rm.y + Math.sin(aA) * Math.max(dRm, rm.zone * 0.95);
                            } else {
                                // On the sector: punch out.
                                destX = rm.x + Math.cos(this._exitBrg) * rm.zone * 1.7;
                                destY = rm.y + Math.sin(this._exitBrg) * rm.zone * 1.7;
                            }
                        } else {
                            const aA = brgA + sgnA * 0.7;
                            const RAo = Math.min(rm.zone * 1.7, dRm + 320);
                            destX = rm.x + Math.cos(aA) * RAo;
                            destY = rm.y + Math.sin(aA) * RAo;
                        }
                    }
                    entryHandled = true;
                }

                if (!entryHandled && rm && followLeg === rs.leg && !this._rulerMode) {
                    if (this._sEnter == null || this._sEnterLeg !== rs.leg) {
                        this._sEnterLeg = rs.leg;
                        this._sEnter = dmcLegF.length;
                        for (let k = 0; k < pts.length; k++) {
                            // ⚠️ The far destination must sit INSIDE the ruler-mode
                            // switch radius (zone*2.1), or there is a dead band:
                            // dest reached, mode unswitched, and the boat ORBITS ITS
                            // OWN DESTINATION — measured as a 300u mill at full
                            // speed, misread twice as an ice problem.
                            if (Math.hypot(pts[k].x - rm.x, pts[k].y - rm.y) < rm.zone * 1.8) {
                                this._sEnter = cum[k];
                                this._sEnterPt = { x: pts[k].x, y: pts[k].y };
                                break;
                            }
                        }
                    }
                    const fd = this._sEnterPt || pts[pts.length - 1];
                    destX = fd.x; destY = fd.y;
                } else if (!entryHandled) {
                // ROUND WIDE WHERE THE WATER ALLOWS. The ruler's arc is the tight
                // ideal; in a blow, in drifting ice, a sailor stands off where there
                // is room to tack and comes in only where the land pinches. Widening
                // past zone*1.25 has a second payoff: the whole arc is sailed beyond
                // the completion radius, so the leg releases the moment the sweep is
                // made instead of demanding a separate departure.
                const gridW = state.course.botGrid;
                const widen = (p) => {
                    if (!rm || !gridW) return p;
                    const dx0 = p.x - rm.x, dy0 = p.y - rm.y;
                    const d0 = Math.hypot(dx0, dy0);
                    if (d0 > rm.zone * 1.1 || d0 < 1) return p;
                    const ux = dx0 / d0, uy = dy0 / d0;
                    // BEFORE arming: never wider than the ZONE — arming requires
                    // actually entering it (a 1250u "wide rounding" never armed and
                    // the pre-arming sweep was lost). AFTER arming: the opposite —
                    // sweep credit runs out to 2.5x zone and completion requires
                    // being OUTSIDE 1.25x zone, so the fast rounding at full density
                    // is: nick the zone at the clearest sector, then swing OUT past
                    // the floe ring and run the sweep in open water at speed.
                    const ladder = rs.roundArmed
                        ? [rm.zone * 1.75, rm.zone * 1.45, rm.zone * 1.2, rm.zone * 0.94]
                        : [rm.zone * 0.94, rm.zone * 0.82];
                    for (const R of ladder) {
                        if (R < d0) break;
                        const px = rm.x + ux * R, py = rm.y + uy * R;
                        const c = gridW.cell(px, py);
                        const id = c[1] * gridW.n + c[0];
                        if (gridW.at(c[0], c[1]) && (!gridW._clear || gridW._clear[id] >= 3)) {
                            return { x: px, y: py };
                        }
                    }
                    return p;
                };
                const pointAt = (target) => {
                    if (target >= dmcLegF.length) return widen(pts[pts.length - 1]);
                    let k = 1;
                    while (k < cum.length - 1 && cum[k] < target) k++;
                    const t = (target - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
                    return widen({ x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t,
                             y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t });
                };
                // UNDER-SWEPT AT THE PATH END: a boat that armed late (entered the
                // zone partway round) reaches the exit tangent with less sweep than
                // the leg requires and the path has nothing more to give. The move a
                // sailor makes is obvious — keep going round. Orbit on, the required
                // way, until the sweep is made; the next-leg handoff above then
                // releases the boat outbound.
                if (false) {
                } else {
                // STICKY CARROT. A carrot that glides s+LOOK ahead recedes as the boat
                // advances, and on the beat around the rounding arc the boat lays a
                // moving target forever — measured half-kilometre tacks AWAY from the
                // mark. Chase one fixed point; only when it is nearly fetched does the
                // carrot hop to the next. Fixed targets terminate laylines.
                if (this.dmcCarrotS == null || this.dmcCarrotS < s + 100) this.dmcCarrotS = s + LOOKP;
                let cw = pointAt(this.dmcCarrotS);
                if ((boat.x - cw.x) ** 2 + (boat.y - cw.y) ** 2 < 220 * 220) {
                    this.dmcCarrotS = Math.min(dmcLegF.length, this.dmcCarrotS + LOOKP);
                    cw = pointAt(this.dmcCarrotS);
                }
                destX = cw.x; destY = cw.y;
                }
                }
                }
            } else if (rs.leg === 1) {
                const bearing = Math.atan2(boat.y - rm.y, boat.x - rm.x);
                // Starboard rounding sweeps the bearing POSITIVE (see the
                // derivation in updateBoatRaceState), so the entry lies at a
                // bearing BEHIND the boat's current one. Once inside the zone,
                // lead the target around the mark so the boat keeps turning.
                const lead = rs.roundArmed ? 1.05 : 0.55;
                const sgn = rm.side === 'port' ? -1 : 1;
                const a = bearing + sgn * lead;
                // Orbit on the NAVIGABLE rounding circle, not a fraction of the zone.
                // The ruler already solves this (CoursePath._roundR walks a radius
                // ladder and keeps the first whole circle that is clear water) — on
                // Glacier Sound zone*0.92 runs through the fixed-ice gap the venue
                // check flags at 1.3 hulls, and bots orbited into it forever.
                const orbR = state.course.botGrid ? orbitTightR(rm) : null;
                const RR = (typeof CoursePath !== 'undefined' && state.course.botGrid)
                    ? Math.min(rm.zone * 1.15, orbR != null ? orbR
                        : CoursePath._roundR(rm, state.course.botGrid) + 45)
                    : rm.zone * 0.92;
                destX = rm.x + Math.cos(a) * RR;
                destY = rm.y + Math.sin(a) * RR;
            } else {
                const m1 = marks[0], m2 = marks[1];
                const gDx = m2.x - m1.x, gDy = m2.y - m1.y;
                const gLen2 = gDx * gDx + gDy * gDy || 1;
                let t = ((boat.x - m1.x) * gDx + (boat.y - m1.y) * gDy) / gLen2;
                t = Math.max(0.08, Math.min(0.92, t));
                destX = m1.x + gDx * t;
                destY = m1.y + gDy * t;
            }
        } else {
            // Determine Gate/Mark Target
            const leg = boat.raceState.leg;
            // BUGFIX: this was `leg === 1 || leg === 3`, enumerated rather than
            // derived. The legs slider goes to 10, so on any course longer than
            // four legs the AI targeted the LEEWARD line on legs 5, 7 and 9 while
            // actually sailing upwind. The route knows which gate each leg wants.
            const targetIndices = legMarks(leg) || [0, 1];

            const m1 = marks[targetIndices[0]];
            const m2 = marks[targetIndices[1]];

            if (leg === 0) {
                // START STRATEGY — lane discipline. Drive straight up our own lane
                // through the start segment. We deliberately keep targeting our lane
                // (not the line centre) so we cross WITHIN the segment and start;
                // retreating to the centre pulls boats into the pack and makes them
                // oscillate across the line for tens of seconds without starting.
                let pct = Math.max(0.15, Math.min(0.85, this.startLinePct));

                const laneX = m1.x + (m2.x - m1.x) * pct;
                const laneY = m1.y + (m2.y - m1.y) * pct;
                // Local wind: the dip-back and drive-up vectors must be square to the
                // wind ON THE LINE, not to the course-centroid blend (Glacier Sound's
                // differ by ~110°, which aimed every recovery into the pin-end pocket).
                const wd = getWindAt(laneX, laneY).direction;

                // Signed position relative to the line (>0 = course side / above).
                const lineDx = m2.x - m1.x, lineDy = m2.y - m1.y;
                const nx = lineDy, ny = -lineDx;
                const dot = (boat.x - m1.x) * nx + (boat.y - m1.y) * ny;

                if (boat.raceState.ocs) {
                    // Over early — dip back below the line at our lane to clear OCS.
                    const ocsBase = (typeof window !== 'undefined' && window.__START && window.__START.ocsback != null) ? window.__START.ocsback : 55;
                    const distBack = (this.livenessState === 'normal') ? ocsBase : ocsBase + 40;
                    destX = laneX - Math.sin(wd) * distBack;
                    destY = laneY + Math.cos(wd) * distBack;
                } else if (dot > 5) {
                    // Above the line but not started (crossed outside the segment) —
                    // dip back to our lane on the segment rather than retreating far.
                    destX = laneX - Math.sin(wd) * 45;
                    destY = laneY + Math.cos(wd) * 45;
                } else {
                    // Below the line — drive up through our lane on the segment.
                    const distPast = (this.livenessState === 'force') ? 200 : 80;
                    destX = laneX + Math.sin(wd) * distPast;
                    destY = laneY - Math.cos(wd) * distPast;
                }
            } else {
                // RACE LEGS — approach the gate at a chosen END, not the centre.
                // Completing legs 1..totalLegs-1 requires crossing the segment AND
                // rounding a gate mark (crossing its outward extension back), so a
                // centre approach on a wide gate costs ~half the gate width in pure
                // lateral sailing after crossing. Aim just inside the chosen mark.
                // The finish (leg === totalLegs) completes on any segment crossing,
                // so aim at the nearest point on the line.
                const gDx = m2.x - m1.x, gDy = m2.y - m1.y;
                const gLen = Math.hypot(gDx, gDy) || 1;
                const NAV = (typeof window !== 'undefined' && window.__NAV) ? window.__NAV : {};

                if (leg === state.race.totalLegs) {
                    let t = ((boat.x - m1.x) * gDx + (boat.y - m1.y) * gDy) / (gLen * gLen);
                    t = Math.max(0.08, Math.min(0.92, t));
                    destX = m1.x + gDx * t;
                    destY = m1.y + gDy * t;
                } else if (NAV.mode === 'center' || (!legTargetsWindward(leg) && NAV.insetDown == null)) {
                    // Downwind legs approach the gate at the CENTRE — measured
                    // faster and cleaner than end-targeting (boats arrive spread
                    // out and pick a mark late, rounding whichever is nearest).
                    destX = (m1.x + m2.x) / 2;
                    destY = (m1.y + m2.y) / 2;
                } else {
                    // Upwind legs: choose a gate end once per leg (nearest at leg
                    // entry) and stick with it — re-choosing mid-beat wanders.
                    if (!this.gateChoice || this.gateChoice.leg !== leg) {
                        const d1 = (boat.x - m1.x)**2 + (boat.y - m1.y)**2;
                        const d2 = (boat.x - m2.x)**2 + (boat.y - m2.y)**2;
                        let idx = d1 <= d2 ? 0 : 1;
                        // Gambler: pick a SIDE of the beat for this leg and bang
                        // it — gate end chosen by coin flip, not proximity.
                        // Not on leg 1: a far-side pick right off the start line
                        // drags them diagonally through the whole fleet (fouls).
                        if (boat.traits && boat.traits.sideCommit && leg > 1) {
                            idx = Math.random() < 0.5 ? 0 : 1;
                            if (typeof Sayings !== 'undefined') Sayings.queueQuote(boat, 'side_pick');
                        }
                        this.gateChoice = { leg, idx };
                    }
                    const chosen = this.gateChoice.idx === 0 ? m1 : m2;
                    const isBeat = legTargetsWindward(leg);
                    let insetRaw = NAV.inset != null ? NAV.inset : 240;
                    if (!isBeat && NAV.insetDown != null) insetRaw = NAV.insetDown;
                    // cornerScale: corner artists cut closer to the mark, freight
                    // trains swing wide (paired with their rounding offset below).
                    insetRaw *= (boat.traits ? boat.traits.cornerScale : 1);
                    const inset = Math.min(insetRaw, gLen * 0.45);
                    const inSign = this.gateChoice.idx === 0 ? 1 : -1;
                    destX = chosen.x + (gDx / gLen) * inset * inSign;
                    destY = chosen.y + (gDy / gLen) * inset * inSign;
                }

                // Missed Gate Check
                const gateDx = m2.x - m1.x;
                const gateDy = m2.y - m1.y;
                const nx = gateDy;
                const ny = -gateDx;
                const bdx = boat.x - m1.x;
                const bdy = boat.y - m1.y;
                const dot = bdx * nx + bdy * ny;

                // Same enumeration bug as the target above: legs 5+ matched
                // neither arm, so a boat past the gate on leg 5 never retargeted.
                // `dir` is exactly this test, and the start (leg 0) is excluded by
                // its role rather than by being the number zero.
                const gEntry = routeLeg(leg);
                const gateLeg = !!(gEntry && gEntry.role !== 'start' && gEntry.marks);
                let pastGate = false;
                if (gateLeg && gEntry.dir > 0) { if (dot > 50) pastGate = true; }
                else if (gateLeg && gEntry.dir < 0) { if (dot < -50) pastGate = true; }

                if (pastGate) {
                    const len = Math.sqrt(nx*nx + ny*ny);
                    const unx = nx/len;
                    const uny = ny/len;
                    const center = { x: (m1.x+m2.x)/2, y: (m1.y+m2.y)/2 };
                    const factor = (gateLeg && gEntry.dir > 0) ? -1 : 1;
                    destX = center.x + unx * 150 * factor;
                    destY = center.y + uny * 150 * factor;
                }
            }

            // Rounding Bias
            if (boat.raceState.isRounding) {
                const NAVR = (typeof window !== 'undefined' && window.__NAV) ? window.__NAV : {};
                const cRound = boat.traits ? (boat.traits.cornerRound != null ? boat.traits.cornerRound : 1) : 1;
                const roundOff = (NAVR.roundOff != null ? NAVR.roundOff : 65) * cRound;
                const tTurn = boat.traits ? boat.traits.roundTurn : null;
                const roundTurn = NAVR.roundTurn != null ? NAVR.roundTurn : (tTurn != null ? tTurn : 80);
                const d1 = (boat.x - m1.x)**2 + (boat.y - m1.y)**2;
                const d2 = (boat.x - m2.x)**2 + (boat.y - m2.y)**2;
                const mark = (d1 < d2) ? m1 : m2;
                const dx = mark.x - (m1.x+m2.x)/2;
                const dy = mark.y - (m1.y+m2.y)/2;
                const len = Math.sqrt(dx*dx+dy*dy);
                if (len > 0) {
                    destX = mark.x + (dx/len) * roundOff;
                    destY = mark.y + (dy/len) * roundOff;
                    if (roundTurn) {
                        // Pull the exit point onto the NEXT leg so the boat carves
                        // around the mark instead of swinging a wide lateral arc:
                        // beats exit heading downwind, runs exit heading upwind.
                        // ONLY once the boat is laterally beyond the mark — pulling
                        // earlier makes it descend across the gate segment, which
                        // ABORTS the rounding and loops it back (measured: DNFs).
                        const past = (boat.x - mark.x) * (dx/len) + (boat.y - mark.y) * (dy/len);
                        if (past > 15) {
                            const wdr = getWindAt(boat.x, boat.y).direction;
                            const sgn = legTargetsWindward(leg) ? -1 : 1;
                            destX += Math.sin(wdr) * roundTurn * sgn;
                            destY -= Math.cos(wdr) * roundTurn * sgn;
                        }
                    }
                }
            }
        }

        // 1.5 GRID ROUTE AROUND STATIC LAND. On a designed venue the coastline can be
        // one keyholed ring, which the visibility planner below cannot inflate (its
        // documented failure mode is a confident straight line THROUGH the island —
        // that parked the whole Glacier Sound fleet against the ice). The sailability
        // grid answers "is this cell water" exactly, so the long way round comes from
        // it: route to the leg target on the grid, then steer for the first waypoint
        // still ahead. Floes stay with the visibility planner — they drift, the grid
        // is static.
        // Only when there is LAND to route around. On an open course the grid can
        // only ever repeat the straight line — at best it is redundant, and any
        // wind/edge weighting it applies is pure distortion of legs the strategy
        // layer already sails optimally.
        const botGrid = (state.course._gridFixed && state.course._gridFixed.length)
            ? state.course.botGrid : null;
        if (botGrid && window.SailCheck) {
            if (this.gridTimer == null) this.gridTimer = 0;
            this.gridTimer -= 0.1;
            this.gridAge = (this.gridAge || 0) + 0.1;
            if (this._c2Window > 0) this._c2Window -= 0.1;
            const goalMoved = !this.gridGoal ||
                (destX - this.gridGoal.x) ** 2 + (destY - this.gridGoal.y) ** 2 > 300 * 300;
            // ROUTE STABILITY. Replanning every couple of seconds through a drifting
            // pack threads a DIFFERENT micro-gap each time — the boat turns toward
            // each new thread and commits to none (measured: 500u mill pockets, the
            // carrot flipping between four targets). Keep the chosen thread until it
            // is actually blocked, the goal moved, or it has grown genuinely stale.
            let needFull = goalMoved || !this.gridPath || !this.gridPath.length || (this.gridAge > 12);
            if (!needFull && this.gridTimer <= 0 && this.gridPath) {
                for (let pi = 0; pi < Math.min(12, this.gridPath.length); pi++) {
                    const pp = this.gridPath[pi];
                    const pc = botGrid.cell(pp.x, pp.y);
                    if (!botGrid.at(pc[0], pc[1])) {
                        // A soft (floe-plugged) cell on the thread is a grind the
                        // route may have chosen on purpose — not a reason to replan.
                        // A TIGHT-tier cell likewise: the router paid its tax for
                        // that thread deliberately (drift that closes a tight cell
                        // clears its _tight bit in the stamp, so this still replans
                        // when ice actually shuts the passage).
                        const idT = pc[1] * botGrid.n + pc[0];
                        if (botGrid._soft && botGrid._soft[idT]) continue;
                        if (botGrid._tight && botGrid._tight[idT]) continue;
                        needFull = true; break;
                    }
                }
                if (!needFull) this.gridTimer = 2.0;   // thread still open — keep it
            }
            if ((this.gridTimer <= 0 || goalMoved) && needFull) {
                this.gridGoal = { x: destX, y: destY };
                this.gridAge = 0;
                // Sailable = clearance-weighted: mid-channel when there is a channel.
                // Left at cell granularity — the waypoint-ahead pruning below turns the
                // stair-steps into a smooth carrot ~170u in front of the boat, and any
                // string-pulled shortcut would hug the very corners the weights avoid.
                // CONGESTION-PRICED ROUTE CHOICE. Stamp the cells around rivals
                // that are PARKED right now (<1 kt, racing legs) so the router
                // prices the queue behind them — measured on redrock: med
                // 25-35 s parked per boat-leg (p90 98-130 s), up to 3 boats
                // simultaneously in one 200u bin of the north thread, while a
                // near-equal line goes unsailed. Re-stamped at every replan
                // (2-3 s), so a jam that clears stops pricing within one
                // replan. Route CHOICE only — nobody holds station, the
                // second-arriving boat just stops buying the parked lane.
                if (botGrid._jamIds && botGrid._jamIds.length) {
                    for (const idJ of botGrid._jamIds) botGrid._jam[idJ] = 0;
                    botGrid._jamIds.length = 0;
                }
                // NOT ON STRONG-CURRENT VENUES: in a 2+ kt stream a sub-1kt
                // boat is PINNED BY THE WATER (river's chute: grinding the
                // bank against 3.8-5.2 kt), not queuing — and the chute has no
                // alternative lane, so pricing the "jam" only deformed routes
                // into rock (river fins 119→107/114→105, land +32%/+21% under
                // the unscoped stamp; byte-identical with it off). Same
                // venue-class knee as the ground-frame probe work: max blended
                // current over navigable cells >= 2.0 kt. Current-free venues
                // compute 0 here without touching getCurrentAt (no regions).
                if (state.course._avCurMax === undefined) {
                    let mCJ = 0;
                    const sCJ = [];
                    const gCJ = state.course.botGrid;
                    if (gCJ && (state.course.currentRegions || []).length) {
                        for (let yCJ = 0; yCJ < gCJ.n; yCJ += 4) for (let xCJ = 0; xCJ < gCJ.n; xCJ += 4) {
                            if (!gCJ.at(xCJ, yCJ)) continue;
                            const cwJ = getCurrentAt(gCJ.x0 + (xCJ + 0.5) * gCJ.res, gCJ.y0 + (yCJ + 0.5) * gCJ.res);
                            const sJ = cwJ ? cwJ.speed : 0;
                            if (sJ > mCJ) mCJ = sJ;
                            sCJ.push(sJ);
                        }
                    }
                    state.course._avCurMax = mCJ;
                    // ⭐⭐ A MAXIMUM IS NOT A VENUE-CLASS STATISTIC (2026-08-13, THE
                    // GLOWTIDE PUSH). Seven gates read this scalar at a 2.0 kt knee,
                    // and they ask two DIFFERENT questions:
                    //
                    //  LOCAL MANOEUVRE — will this boat's real path follow the rollout
                    //    I am grading? (the stuck-state retreat line ~508, the
                    //    gybe-around ~1244, the armed rounding arc ~3274.) A rollout is
                    //    arc + set in ANY stream, so this asks about the water she is
                    //    actually in.
                    //  VENUE CLASS — is this a stream venue, whose water moves the
                    //    router's own line out from under it? (the jam stamps below,
                    //    the probe cap ~4205, the plan-aligned short probe ~4296/4301,
                    //    and `bandTrusted` ~4432 — the HZ3B clearance-staircase waiver
                    //    landed in 08f734a.)
                    //
                    // A MAX over ~900 sampled cells answers the second one dishonestly:
                    // one hot cell speaks for a whole map. Measured (`_curmax.js`,
                    // `_curhot.js`, `_curphase.js` — the authored regions are static,
                    // `period` and `speedVar` are 0, so this is a venue property and not
                    // a tidal snapshot):
                    //
                    //   glowtide   max 2.31   p90 1.79   p99 1.90    5 of 877 cells >= 2.0
                    //   river      max 4.96   p90 2.90   p99 4.28    113 of 477  (23.7%)
                    //   bay 1.84/0.50, lagoon 1.09/0.41, the five still venues 0
                    //
                    // Glowtide is a 1-1.8 kt tide with one 2.3 kt corner and it was
                    // paying river's entire scoping bill. The p90 leaves river OFF and
                    // every other venue exactly where it was, so the other NINE VENUES
                    // ARE BYTE-IDENTICAL BY CONSTRUCTION (redrock and lake benched
                    // `cmp`-identical). Nor is it a tuned number: glowtide is under the
                    // knee at every percentile through p99 and river is over it from
                    // p76.3, so ANY percentile in [p77, p99] gives the same ten-venue
                    // partition. Only the raw maximum separates them.
                    //
                    // ⚠️ THE MAX IS KEPT FOR THE THREE LOCAL GATES, AND THAT IS
                    // MEASURED. Moving those three to the p90 as well LOSES on glowtide:
                    // 16 seeds, med 297 -> 366, mean 324.0 -> 384.6, land contacts
                    // 22.3 -> 38.5 (+72%), a finisher lost, 1 of 8 seeds faster. They
                    // are off here for a good reason; only the venue-class four were
                    // wrong.
                    sCJ.sort((a, b) => a - b);
                    state.course._avCurP90 = sCJ.length
                        ? sCJ[Math.min(sCJ.length - 1, Math.floor(0.90 * sCJ.length))] : 0;
                }
                if (this.boat.raceState.leg >= 1 && state.course._avCurP90 < 2.0) {
                    for (const oJ of state.boats) {
                        if (oJ === boat || oJ.isPlayer || oJ.raceState.finished) continue;
                        if (oJ.raceState.leg < 1 || oJ.speed * 4 >= 1.0) continue;
                        if (Math.hypot(oJ.x - boat.x, oJ.y - boat.y) > 1500) continue;
                        // A queue AT a mark is the rounding itself — every boat
                        // must pass that water and routing "around" it detours
                        // the approach into whatever surrounds the mark (lake's
                        // cove: land — v1 unscoped cost lake A +5 paired med,
                        // land +30%). Only CORRIDOR jams are priceable; skip
                        // parked boats inside any mark's 250u funnel.
                        let atMark = false;
                        for (const mkJ of (state.course.marks || [])) {
                            if (Math.hypot(oJ.x - mkJ.x, oJ.y - mkJ.y) < 250) { atMark = true; break; }
                        }
                        if (atMark) continue;
                        if (!botGrid._jam) { botGrid._jam = new Uint8Array(botGrid.n * botGrid.n); botGrid._jamIds = []; }
                        const cJ = botGrid.cell(oJ.x, oJ.y);
                        for (let dyJ = -2; dyJ <= 2; dyJ++) for (let dxJ = -2; dxJ <= 2; dxJ++) {
                            const xJ = cJ[0] + dxJ, yJ = cJ[1] + dyJ;
                            if (xJ < 0 || yJ < 0 || xJ >= botGrid.n || yJ >= botGrid.n) continue;
                            const idJ = yJ * botGrid.n + xJ;
                            if (!botGrid._jam[idJ]) botGrid._jamIds.push(idJ);
                            if (botGrid._jam[idJ] < 250) botGrid._jam[idJ]++;
                        }
                    }
                }
                const seg = window.SailCheck.pathSailable(botGrid, [boat.x, boat.y], [destX, destY]);
                if (seg && seg.length > 1) {
                    const pts = seg.map(q => ({ x: q[0], y: q[1] }));
                    pts[pts.length - 1] = { x: destX, y: destY };
                    // A rebuild that returns the SAME corridor is not new information
                    // about the pack (measured: 50.2% of beat replans — _replan_why)
                    // and does not open a manoeuvre re-decision. Only a changed answer
                    // does: lateral offset of the new path from the old polyline,
                    // sampled every 60u over the shared span, beyond 120u. Floe
                    // venues only — the gate that reads this window is _floeObjs-
                    // scoped, so elsewhere this is dead state.
                    if (state.course._floeObjs && state.course._floeObjs.length) {
                        let c2Changed = true;
                        const c2Old = this.gridPath;
                        if (c2Old && c2Old.length) {
                            let oLen = 0, ox = boat.x, oy = boat.y;
                            for (const q of c2Old) { oLen += Math.hypot(q.x - ox, q.y - oy); ox = q.x; oy = q.y; }
                            const spanC2 = Math.min(1200, oLen);
                            const dSegC2 = (sx, sy, ax, ay, bx, by) => {
                                const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
                                let tt = L2 ? ((sx - ax) * dx + (sy - ay) * dy) / L2 : 0;
                                tt = Math.max(0, Math.min(1, tt));
                                return Math.hypot(sx - (ax + tt * dx), sy - (ay + tt * dy));
                            };
                            const dPolyC2 = (sx, sy) => {
                                let bd = dSegC2(sx, sy, boat.x, boat.y, c2Old[0].x, c2Old[0].y);
                                for (let ii = 0; ii + 1 < c2Old.length; ii++)
                                    bd = Math.min(bd, dSegC2(sx, sy, c2Old[ii].x, c2Old[ii].y, c2Old[ii + 1].x, c2Old[ii + 1].y));
                                return bd;
                            };
                            let mx = 0, acc = 0, nxt = 0, px2 = boat.x, py2 = boat.y;
                            for (const q of pts) {
                                const dq = Math.hypot(q.x - px2, q.y - py2);
                                let guard = 0;
                                while (acc + dq >= nxt && nxt <= spanC2 && guard++ < 40) {
                                    const ff = dq ? (nxt - acc) / dq : 0;
                                    mx = Math.max(mx, dPolyC2(px2 + (q.x - px2) * ff, py2 + (q.y - py2) * ff));
                                    nxt += 60;
                                }
                                acc += dq; px2 = q.x; py2 = q.y;
                                if (acc > spanC2 || mx > 120) break;
                            }
                            c2Changed = mx > 120;
                        }
                        if (c2Changed) this._c2Window = 4.0;
                    }
                    this.gridPath = pts.slice(1);   // drop the boat's own cell
                    // v9 — PATH FAIRING AT SHAVE SEGMENTS (ice-craft session
                    // 2). The router threads clear CELLS but never aligns to
                    // floe EDGES: with boats held on priced water (the v8
                    // rejoin) the on-path shave class shows entry angle med
                    // 39° vs his 19° and 23% hits. Clamp every path point
                    // whose drift-predicted hull clearance (at its own ETA,
                    // within the honest ≤5s horizon — beyond that floe drift
                    // is fiction) is under 78u onto the 78u offset contour in
                    // the drifted frame: consecutive clamped points share the
                    // contour, so the faired segment runs edge-TANGENT by
                    // construction and the boat arrives aligned. A push that
                    // would land within 60u of another hull or in a blocked
                    // cell is rejected. Byte-inert without _floeObjs.
                    if ((state.course._floeObjs || []).length && this.gridPath.length) {
                        const gp9 = this.gridPath;
                        const v9 = Math.max(60, (this.boat.speed || 0) * 60);
                        let acc9 = 0, px9 = this.boat.x, py9 = this.boat.y;
                        for (let i9 = 0; i9 < gp9.length; i9++) {
                            const p9 = gp9[i9];
                            acc9 += Math.hypot(p9.x - px9, p9.y - py9); px9 = p9.x; py9 = p9.y;
                            const tE9 = acc9 / v9;
                            if (tE9 > 5) break;
                            let f9 = null, c9 = Infinity;
                            for (const fF of state.course._floeObjs) {
                                const dx9 = fF.x - p9.x, dy9 = fF.y - p9.y;
                                const rr9 = (fF.radius || 0) + 160;
                                if (dx9 * dx9 + dy9 * dy9 > rr9 * rr9) continue;
                                const cF = floeHullClear(fF,
                                    p9.x - (fF.driftVx || 0) * tE9,
                                    p9.y - (fF.driftVy || 0) * tE9, tE9);
                                if (cF < c9) { c9 = cF; f9 = fF; }
                            }
                            if (!f9 || c9 >= 60 || c9 < -20) continue;
                            // push radially in the DRIFTED frame to the 78u contour
                            const fx9 = f9.x + (f9.driftVx || 0) * tE9;
                            const fy9 = f9.y + (f9.driftVy || 0) * tE9;
                            let ux9 = p9.x - fx9, uy9 = p9.y - fy9;
                            const dU9 = Math.hypot(ux9, uy9) || 1; ux9 /= dU9; uy9 /= dU9;
                            const qx9 = p9.x + ux9 * (60 - c9), qy9 = p9.y + uy9 * (60 - c9);
                            // reject: other hulls or blocked cells at the new point
                            let ok9 = true;
                            for (const fF of state.course._floeObjs) {
                                if (fF === f9) continue;
                                const dx9 = fF.x - qx9, dy9 = fF.y - qy9;
                                const rr9 = (fF.radius || 0) + 120;
                                if (dx9 * dx9 + dy9 * dy9 > rr9 * rr9) continue;
                                if (floeHullClear(fF,
                                    qx9 - (fF.driftVx || 0) * tE9,
                                    qy9 - (fF.driftVy || 0) * tE9, tE9) < 60) { ok9 = false; break; }
                            }
                            if (ok9 && botGrid) {
                                const cc9 = botGrid.cell(qx9, qy9);
                                if (!botGrid.at(cc9[0], cc9[1])) ok9 = false;
                            }
                            // a pushed POINT clears the hull; the SEGMENTS to
                            // its (possibly unpushed) neighbours may now cut
                            // the corner the point was pushed around (measured
                            // on 9101: floeEp 2→9). Push only if both
                            // adjoining segments clear the hull in the
                            // drifted frame.
                            if (ok9) {
                                const shX9 = (f9.driftVx || 0) * tE9, shY9 = (f9.driftVy || 0) * tE9;
                                const pv9 = i9 > 0 ? gp9[i9 - 1] : { x: this.boat.x, y: this.boat.y };
                                if (floeSegNear(f9, pv9.x - shX9, pv9.y - shY9,
                                    qx9 - shX9, qy9 - shY9, tE9, 25)) ok9 = false;
                                if (ok9 && i9 < gp9.length - 1) {
                                    const nx9 = gp9[i9 + 1];
                                    if (floeSegNear(f9, qx9 - shX9, qy9 - shY9,
                                        nx9.x - shX9, nx9.y - shY9, tE9, 25)) ok9 = false;
                                }
                            }
                            if (ok9) { p9.x = qx9; p9.y = qy9; }
                        }
                    }
                } else if (!seg) {
                    // No route right now (a drifting pocket closed). A stale path
                    // beats a straight line into the ice — keep the old one and
                    // retry next replan; the pocket moves.
                    if (!this.gridPath) this.gridPath = null;
                }
                // Deterministic jitter (spread replans across the fleet WITHOUT touching
                // the seeded RNG stream — every venue is a document now, so a draw here
                // would shift every race on every venue and retire the golden traces).
                this.gridTimer = 2.0 + ((this.boat.id * 0.37) % 1);
            }
            if (this.gridPath && this.gridPath.length) {
                // PURE PURSUIT, not proximity pruning. Pruning-on-arrival goes stale
                // the moment an escape manoeuvre throws the boat sideways: the old
                // carrot sits behind the boat, the boat sails BACK to it, and the
                // fleet ping-pongs along the ice wall. Chase the point a fixed
                // distance ahead of wherever on the path the boat actually is.
                const pts = this.gridPath;
                let i0 = 0, best = Infinity;
                for (let i = 0; i < pts.length; i++) {
                    const d2 = (boat.x - pts[i].x) ** 2 + (boat.y - pts[i].y) ** 2;
                    if (d2 < best) { best = d2; i0 = i; }
                }
                if (best > 400 * 400) {
                    // Blown far off the plan (wiggle, avoidance, drift): the old line
                    // is fiction now. Replan from where we really are, next tick.
                    this.gridTimer = 0;
                }
                if (i0 > 0) pts.splice(0, i0);   // passed water is passed
                // Lookahead scales with sea room. A close carrot in open water makes
                // the beat re-decide its tack every few lengths — endless short
                // tacks, half of them into the hysteresis penalty. A far carrot in a
                // narrows cuts the corner into the ice. Clearance at the boat is the
                // honest signal for which water this is.
                let LOOK = 300;
                if (botGrid._clear) {
                    const c0 = botGrid.cell(boat.x, boat.y);
                    const cl = botGrid._clear[Math.max(0, Math.min(botGrid.n * botGrid.n - 1,
                        c0[1] * botGrid.n + c0[0]))];
                    LOOK = Math.max(250, Math.min(900, cl * botGrid.res * 1.2));
                }
                // CROSS-TRACK CONTROL: a far carrot barely bends the course when the
                // boat has drifted abeam of the corridor — leeway walks it onto the
                // next shore before anything corrects. Shrinking the lookahead as
                // cross-track error grows steepens the recovery angle (pure-pursuit
                // basics), so the boat closes the corridor first, then runs it.
                const xtk = Math.sqrt(best);
                if (xtk > 150) LOOK *= Math.max(0.4, 1 - (xtk - 150) / 400);
                // A close carrot dead to windward is unfetchable in one board — the
                // boat tacks around it forever (measured: a full-speed orbit of a
                // 250u-upwind carrot, the same disease sticky carrots cured on the
                // ruler path). Beats need reach: enforce a minimum lookahead when
                // the path ahead runs upwind.
                {
                    const lwL = getWindAt(boat.x, boat.y).direction;
                    let jj = 0, accL = 0;
                    while (jj < pts.length - 1 && accL < LOOK) {
                        accL += Math.hypot(pts[jj + 1].x - pts[jj].x, pts[jj + 1].y - pts[jj].y);
                        jj++;
                    }
                    const cw0 = pts[Math.min(jj, pts.length - 1)];
                    const brgC = Math.atan2(cw0.x - boat.x, -(cw0.y - boat.y));
                    // Dead-downwind carrots gybe-loop exactly like upwind ones tack-
                    // loop (measured: a 75s gybing mill on the return leg, tgt
                    // flipping between gybes every tick around a close carrot).
                    const offUp = Math.abs(normalizeAngle(brgC - lwL));
                    if ((offUp < 0.96 || offUp > Math.PI - 0.5) && LOOK < 420) LOOK = 420;
                }
                let j = 0, acc = 0;
                while (j < pts.length - 1 && acc < LOOK) {
                    acc += Math.hypot(pts[j + 1].x - pts[j].x, pts[j + 1].y - pts[j].y);
                    j++;
                }
                let w = (j >= pts.length - 1) ? { x: destX, y: destY } : pts[j];
                // FLOE-AWARE REJOIN (v8, ice-craft session 2, 2026-08-23).
                // The entry attribution split the sub-78u contact mass: path
                // shaves hit 0%, but boats DISPLACED off the plan (xtrack
                // ≥80u, 35% of onsets) hit 58% — their pure-pursuit rejoin
                // chord crosses drifting hulls the path never priced, and
                // cross-track control SHRINKS the lookahead, steepening the
                // chord exactly when it most needs to clear ice (trap 17:
                // displacement is fixed at the response, not the map). When
                // off-path near ice, slide the rejoin carrot FORWARD along
                // the path until the chord to it clears every drift-predicted
                // hull — rejoin shallower, behind the ice, on priced water.
                // No held state, no mode; byte-inert without _floeObjs.
                if ((state.course._floeObjs || []).length && this.boat.raceState.leg >= 1
                    && xtk > 80 && j < pts.length - 1) {
                    const vRj = Math.max(60, (boat.speed || 0) * 60);
                    const chordBlocked = (wx, wy) => {
                        const dRj = Math.hypot(wx - boat.x, wy - boat.y);
                        const tMidRj = (dRj / vRj) * 0.5;
                        for (const fRj of state.course._floeObjs) {
                            const dxR = fRj.x - boat.x, dyR = fRj.y - boat.y;
                            const rrR = (fRj.radius || 0) + dRj + 60;
                            if (dxR * dxR + dyR * dyR > rrR * rrR) continue;
                            const shX = (fRj.driftVx || 0) * tMidRj, shY = (fRj.driftVy || 0) * tMidRj;
                            if (floeSegNear(fRj, boat.x - shX, boat.y - shY,
                                wx - shX, wy - shY, tMidRj, 15)) return true;
                        }
                        return false;
                    };
                    if (chordBlocked(w.x, w.y)) {
                        // v8b: prefer a rejoin point where the PATH ITSELF is
                        // clear of predicted hulls — v8's chord-only slide
                        // halved the off-path hit class (58%→30%) but landed
                        // boats ON shaving path segments from rejoin angles
                        // (on-path shave hits 0%→23%): rejoin BEHIND the
                        // shave, not into it. Chord-clear-only is the
                        // fallback; nothing clear in 480u keeps the original
                        // carrot (the avoidance stack owns it, as today).
                        const ptClear = (px, py, tE) => {
                            for (const fRj of state.course._floeObjs) {
                                const dxR = fRj.x - px, dyR = fRj.y - py;
                                const rrR = (fRj.radius || 0) + 200;
                                if (dxR * dxR + dyR * dyR > rrR * rrR) continue;
                                if (floeHullClear(fRj,
                                    px - (fRj.driftVx || 0) * tE,
                                    py - (fRj.driftVy || 0) * tE, tE) < 78) return false;
                            }
                            return true;
                        };
                        let jR = j, accR = 0, wChord = null;
                        while (jR < pts.length - 1 && accR < 480) {
                            accR += Math.hypot(pts[jR + 1].x - pts[jR].x, pts[jR + 1].y - pts[jR].y);
                            jR++;
                            if (!chordBlocked(pts[jR].x, pts[jR].y)) {
                                if (!wChord) wChord = pts[jR];
                                const dRj2 = Math.hypot(pts[jR].x - boat.x, pts[jR].y - boat.y);
                                if (ptClear(pts[jR].x, pts[jR].y, dRj2 / vRj)) { w = pts[jR]; wChord = null; break; }
                            }
                        }
                        if (wChord) w = wChord;
                    }
                }
                // AIM THROUGH THE SLOT (T1, 2026-08-23, owner-approved). When
                // the route inside the lookahead threads TIGHT-tier cells, the
                // carrot moves to the tight run's exit EXTENDED along the
                // run's own axis: the hull approaches and transits ALIGNED
                // (±15u beam needs ~30u aligned vs ~50u at a 23° crab), and
                // the aligned candidate is the one the tight-tier trust
                // (0.3 rad) protects — the lab's mouth bails happen at
                // 18-19° off-axis, right on that boundary. The extension
                // walks open OR tight water (v1 tested open only, collapsed
                // the carrot inside the corridor, and lost 4 lab seeds).
                // Byte-inert wherever the route meets no tight cells.
                if (botGrid._tight) {
                    const tightAt = (px2, py2) => {
                        const c2 = botGrid.cell(px2, py2);
                        const id2 = c2[1] * botGrid.n + c2[0];
                        return botGrid.at(c2[0], c2[1])
                            || (id2 >= 0 && id2 < botGrid.n * botGrid.n && botGrid._tight[id2]);
                    };
                    let aT = -1, bT = -1;
                    for (let k = 0; k <= j && k < pts.length; k++) {
                        const cc = botGrid.cell(pts[k].x, pts[k].y);
                        const idT = cc[1] * botGrid.n + cc[0];
                        const isT = !botGrid.at(cc[0], cc[1])
                            && idT >= 0 && idT < botGrid.n * botGrid.n && botGrid._tight[idT];
                        if (isT && aT < 0) aT = k;
                        if (isT && aT >= 0) bT = k;
                        if (!isT && aT >= 0) break; // first tight RUN only
                    }
                    // SLOT, NOT RIBBON (v4): the override fires only when the
                    // run has walls on BOTH perpendicular sides at its
                    // midpoint — a shore-parallel tight ribbon has open water
                    // abeam, and aiming "through" it walks the boat along the
                    // bank (river 3x8 measured land +15% without this guard).
                    const slotTest = (mx3, my3, dxA, dyA) => {
                        const px3 = -dyA, py3 = dxA;
                        const off3 = botGrid.res * 1.2;
                        // a side is a WALL unless genuinely OPEN water sits
                        // abeam (tight cells abeam = the narrow region
                        // continues — still a slot, not a shoreline ribbon)
                        const open3 = (qx, qy) => {
                            const c3 = botGrid.cell(qx, qy);
                            return !!botGrid.at(c3[0], c3[1]);
                        };
                        return !open3(mx3 + px3 * off3, my3 + py3 * off3)
                            && !open3(mx3 - px3 * off3, my3 - py3 * off3);
                    };
                    if (aT >= 0 && bT >= aT) {
                        // v3: pure pursuit ON THE RUN'S AXIS LINE — v2 aimed
                        // straight at the extended exit and the approach cut
                        // the corner into the sand. Here the carrot is the
                        // axis point a fixed lead ahead of the boat's own
                        // axis-projection: the boat converges to the line,
                        // arrives aligned, and the carrot walks out the exit.
                        const ax0 = aT > 0 ? pts[aT - 1] : { x: boat.x, y: boat.y };
                        let dxT = pts[bT].x - ax0.x, dyT = pts[bT].y - ax0.y;
                        const lT = Math.hypot(dxT, dyT);
                        if (lT > 20) {
                            dxT /= lT; dyT /= lT;
                            const eX = pts[aT].x, eY = pts[aT].y;
                            const sB = (boat.x - eX) * dxT + (boat.y - eY) * dyT;
                            const runL = (pts[bT].x - eX) * dxT + (pts[bT].y - eY) * dyT;
                            let sMax = runL;
                            for (let s2 = 30; s2 <= 210; s2 += 30) {
                                if (!tightAt(eX + dxT * (runL + s2), eY + dyT * (runL + s2))) break;
                                sMax = runL + s2;
                            }
                            const midX = eX + dxT * runL * 0.5, midY = eY + dyT * runL * 0.5;
                            if (slotTest(midX, midY, dxT, dyT)) {
                                const sC = Math.min(sB + 160, sMax);
                                const wx2 = eX + dxT * sC, wy2 = eY + dyT * sC;
                                if (tightAt(wx2, wy2)) w = { x: wx2, y: wy2 };
                            }
                        }
                    }
                }
                destX = w.x; destY = w.y;
            }
        }

        // 2. Global Path Planning
        // Update Path if timer expired or target moved significantly
        if (this.pathTimer > 0) this.pathTimer -= 0.1; // Called in update usually, but here fine

        let needsReplan = false;
        if (this.pathTimer <= 0) needsReplan = true;
        if (!this.finalTarget || (destX-this.finalTarget.x)**2 + (destY-this.finalTarget.y)**2 > 50*50) needsReplan = true;

        // If pathable islands exist, use planner (banks are excluded — the
        // river corridor is handled by the clamp + reactive avoidance).
        // With a grid in play the graph gets ONLY the drifting floes: static land is
        // the grid's job, and one keyholed ring in this list poisons every answer.
        const navIslands = botGrid
            ? (state.course.navIslands || state.course.islands || []).filter(i => i.isFloe)
            : (state.course.navIslands || state.course.islands);
        if (navIslands && navIslands.length > 0) {
            if (needsReplan) {
                this.finalTarget = { x: destX, y: destY };
                // Plan path
                this.currentPath = this.planner.findPath(
                    { x: boat.x, y: boat.y },
                    this.finalTarget,
                    navIslands,
                    state.course.navVersion
                );
                // Replan every 2-3s; faster around drifting ice, whose
                // positions go stale quickly
                this.pathTimer = 2.0 + Math.random();
            }

            // Prune visited waypoints
            if (this.currentPath.length > 0) {
                const wp = this.currentPath[0];
                const d2 = (boat.x - wp.x)**2 + (boat.y - wp.y)**2;
                if (d2 < 60*60) { // Reached waypoint (60 units)
                    this.currentPath.shift();
                }
            }

            // Return next waypoint or final dest
            if (this.currentPath.length > 0) {
                return this.currentPath[0];
            }
        }

        // Fallback / No Islands
        return { x: destX, y: destY };
    }

});
Object.assign(BotController.prototype, {
    getStrategicHeading(target) {
        const boat = this.boat;
        const localWind = getWindAt(boat.x, boat.y);
        const wd = localWind.direction;
        const current = getCurrentAt(boat.x, boat.y);

        const dx = target.x - boat.x;
        const dy = target.y - boat.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angleToTarget = Math.atan2(dx, -dy); // 0 is North (Up)

        // FORCE / RECOVERY OVERRIDE
        if (this.livenessState === 'force' || this.livenessState === 'recovery') {
             const twa = normalizeAngle(angleToTarget - wd);
             if (Math.abs(twa) > 0.7) { this.forceTack = 0; return angleToTarget; }
             // Close-hauled drive toward the target. When the target is nearly dead
             // upwind (|twa| small) the raw tack choice flips every frame, parking the
             // boat head-to-wind ("in irons") so it mills near the line and starts
             // very late (or not at all). Commit to a tack and only re-pick it once
             // the target is clearly to the other side — this drives a decisive,
             // powered close-hauled approach across the line.
             if (this.forceTack === 0 || Math.abs(twa) > 0.4) {
                 this.forceTack = twa > 0 ? 1 : -1;
             }
             // Leg 0 keeps the close-hauled drive (it exists to cross the start line
             // upwind). Mid-race recovery wants POWER first: from a standstill in a
             // blow, close-hauled barely accelerates, so drive a close reach and let
             // navigation take over once there is way on.
             const driveTWA = this.boat.raceState.leg === 0 ? 0.75 : 1.05;
             return normalizeAngle(wd + this.forceTack * driveTWA);
        }
        this.forceTack = 0;

        // --- Current Compensation ---
        // Calculate the heading needed to make our COG point to target.
        // Or better: Calculate efficient course given current.

        // For Reaching/Fetching check, we must use COG.
        // Can we fetch the target?
        // We sail at heading H. Velocity V_water. Current V_current.
        // V_ground = V_water + V_current.
        // We want V_ground to align with angleToTarget.
        
        let compensatedHeading = angleToTarget;
        let crabbing = false;

        if (current && current.speed > 0.1) {
            const cSpeed = current.speed / 4.0; // Current speed in game units/frame
            const cDir = current.direction;

            // Boat water speed estimate (use current speed or minimal reference)
            const bSpeed = Math.max(0.5, boat.speed);

            // Angle between Current and Target
            const diff = normalizeAngle(cDir - angleToTarget);

            // Cross-track component of current
            // If current is flowing Right (relative to target vector), it pushes us Right.
            // We must steer Left.
            const crossCurrent = Math.sin(diff) * cSpeed;

            // Sin rule for triangle of velocities
            // sin(crabAngle) / cSpeed = sin(diff) / bSpeed? No.
            // sin(crabAngle) = -crossCurrent / bSpeed

            const ratio = -crossCurrent / bSpeed;
            if (Math.abs(ratio) < 0.9) {
                const crabAngle = Math.asin(ratio);
                compensatedHeading = normalizeAngle(angleToTarget + crabAngle);
                crabbing = true;
            }
        }

        // --- Determine Mode based on Compensated Heading ---
        // We check TWA relative to the heading we MUST sail to track straight
        const trueWindAngle = normalizeAngle(compensatedHeading - wd);
        const absTWA = Math.abs(trueWindAngle);
        
        let mode = 'reach';
        let optTWA = getCharacterOptimalVMGAngle('upwind', localWind.speed, boat.stats);

        if (absTWA < Math.PI / 3.5) mode = 'upwind';
        else if (absTWA > Math.PI * 0.7) {
            mode = 'downwind';
            optTWA = getCharacterOptimalVMGAngle('downwind', localWind.speed, boat.stats);

            // Planing Check — LOCAL wind, and only if THIS boat can actually reach
            // the planing entry gate at the hot angle. The old check read the
            // GLOBAL wind: one venue region above minTWS heated every run in the
            // bay to 140° boards (1/cos40 = +31% distance) in 10-11 kt water where
            // the polar tops out below entrySpeed and the plane never engages —
            // the human sails those legs at 150-170° and beats the fleet on pure
            // geometry. Heat only when the plane is genuinely on offer.
            // THE PLANING BET IS OFF ON TECHNICAL COURSES (2026-08-04b). Heating
            // to 140 buys hull speed and spends distance — 1/cos(35) on a course
            // that runs nearly dead downwind. Measured three ways:
            //   bay  20 seeds x2 disjoint sets: paired +3 med both, pens 0.57->0.50
            //   arctic 8-seed fleet: paired +4 med / +12.9 mean, in-time 43->44
            //   Clubhouse 100t: mean 202.83 -> 204.56, PENALTIES 0.31 -> 0.37
            // The venues that gain are the ones with authored land: confined water,
            // real rounding marks, and a fleet that cannot spread. The one that
            // loses is open-water windward-leeward, where two gybes SEPARATE the
            // fleet and the extra distance is cheap — which is also why its
            // penalties rise when the boats stop spreading. Scoped on the same
            // `_gridFixed` test every other navigation change in this stack uses,
            // so the eval anchor is byte-identical by construction.
            const technical = !!(state.course._gridFixed && state.course._gridFixed.length);
            if (!technical && localWind.speed > J111_PLANING.minTWS) {
                const t140 = (140 - 102.5) / (145 - 102.5);
                const pos140 = boat.stats.reach * 0.018 + t140 * (boat.stats.downwind * 0.015 - boat.stats.reach * 0.018);
                const s140 = getTargetSpeed(140 * Math.PI / 180, true, localWind.speed) * (1 + pos140);
                if (s140 >= J111_PLANING.entrySpeed) optTWA = 140 * Math.PI / 180;
            }
        }

        // 1. Can we FETCH the target?
        // If on a reach, sail the compensated heading directly.
        if (mode === 'reach') {
            return compensatedHeading;
        }
        
        if (mode === 'upwind') {
            // If we can point high enough to track to target (including current effect)
            // Minimum sailing angle ~45 deg
            if (absTWA > optTWA) {
                return compensatedHeading; // We can fetch it
            }
        } else {
            // Downwind fetch check
            if (absTWA < optTWA) {
                return compensatedHeading;
            }
        }

        // 2. Tacking / Gybing Logic
        // We cannot fetch. We must choose the best Tack.
        
        const hStarboard = normalizeAngle(wd + optTWA);
        const hPort = normalizeAngle(wd - optTWA);

        // Leech cover: find the nearest live rival once per decision. When one
        // is close on an upwind leg, the leech biases toward MATCHING their
        // tack — shadowing them move for move.
        const traits = boat.traits || DEFAULT_TRAITS;
        let coverTackSide = 0;
        if (traits.cover > 0 && mode === 'upwind' && legTargetsWindward(boat.raceState.leg)) {
            let best = null, bestD2 = 320 * 320;
            for (const other of state.boats) {
                if (other === boat || other.raceState.finished) continue;
                const d2 = (other.x - boat.x) ** 2 + (other.y - boat.y) ** 2;
                if (d2 < bestD2) { bestD2 = d2; best = other; }
            }
            if (best) {
                coverTackSide = normalizeAngle(best.heading - wd) > 0 ? 1 : -1;
                if (this.coverLockLeg !== boat.raceState.leg) {
                    this.coverLockLeg = boat.raceState.leg;
                    if (typeof Sayings !== 'undefined') Sayings.queueQuote(boat, 'cover_lock');
                }
            }
        }

        // Helper to score a tack
        // Score = VMG to Target (using COG) + Pressure Bonus
        const scoreTack = (heading) => {
            // 1. Estimate Target Speed based on Stats (Boost, Polars, POS)
            // Need approximate TWA at candidate heading
            const estTwa = normalizeAngle(heading - localWind.direction);
            const estTwaDeg = Math.abs(estTwa) * (180 / Math.PI);

            // Calculate effective wind for this boat (Boost Stat)
            const pressureFactor = boat.stats.pressure * 0.05;
            let effectiveWind = localWind.speed;
            if (effectiveWind > state.wind.baseSpeed) {
                effectiveWind = state.wind.baseSpeed + (effectiveWind - state.wind.baseSpeed) * (1.0 + pressureFactor);
            } else {
                effectiveWind = state.wind.baseSpeed + (effectiveWind - state.wind.baseSpeed) * (1.0 - pressureFactor);
            }

            // Determine Target Speed from Polars
            const useSpin = (estTwaDeg > 90); // Simplified assumption for planning
            let targetKnots = getTargetSpeed(Math.abs(estTwa), useSpin, effectiveWind);

            // Apply Point of Sail Stats
            let posStat = 0;
            if (estTwaDeg <= 60) {
                posStat = boat.stats.upwind * 0.012;
            } else if (estTwaDeg >= 145) {
                posStat = boat.stats.downwind * 0.015;
            } else {
                 // Reach
                 posStat = boat.stats.reach * 0.018;
            }
            targetKnots *= (1.0 + posStat);
            const targetGameSpeed = targetKnots * 0.25;

            // 2. Simulate Speed Profile (Acceleration / Momentum)
            // How fast can we get there?
            // Simple simulation over lookahead time
            let simSpeed = boat.speed;
            let totalDist = 0;
            const steps = 5; // 5 steps of 1 second

            // Approximate alpha for 1 second (60 frames)
            // Per frame alpha ~ 0.0015. Per second ~ 0.086
            let alphaBase = 0.086;

            if (targetGameSpeed > simSpeed) {
                 // Accelerating
                 const accelMod = 1.0 + boat.stats.acceleration * 0.024;
                 alphaBase *= accelMod;
            } else {
                 // Decelerating (Momentum)
                 const momMod = 1.0 - boat.stats.momentum * 0.02;
                 alphaBase *= momMod;
            }

            for(let i=0; i<steps; i++) {
                simSpeed = simSpeed * (1 - alphaBase) + targetGameSpeed * alphaBase;
                totalDist += simSpeed * 60; // units per second
            }
            const avgSpeed = totalDist / (steps * 60);

            // 3. Calculate COG with leeway + current. The boat crabs to leeward of
            // its heading upwind (mirrors updateBoat), so the AI must reckon its true
            // track to call laylines and VMG correctly — otherwise it sails into the
            // mark to leeward and has to pinch or re-tack.
            let leewayRad = 0;
            if (estTwaDeg < 90 && avgSpeed > 0.05) {
                const spdK = Math.max(1.5, avgSpeed / 0.25);
                const shape = 1.0 - Math.abs(estTwa) / (Math.PI * 0.5);
                const lwDeg = Math.min(3.0, 3.0 * shape * (effectiveWind / 12) * (12 / (spdK * spdK)));
                const lwSign = Math.sign(estTwa) || 1;
                leewayRad = (lwDeg * Math.PI / 180) * lwSign;
            }
            const cogBase = normalizeAngle(heading + leewayRad);

            let cog = cogBase;
            let speedOverGround = avgSpeed;

            if (current && current.speed > 0.1) {
                const cSpeed = current.speed / 4.0;
                const cDir = current.direction;
                // Use avgSpeed for vector addition
                const vx = Math.sin(cogBase)*avgSpeed + Math.sin(cDir)*cSpeed;
                const vy = -Math.cos(cogBase)*avgSpeed - Math.cos(cDir)*cSpeed;

                cog = Math.atan2(vx, -vy);
                speedOverGround = Math.sqrt(vx*vx + vy*vy);
            }

            // VMG to Target
            const angleErr = normalizeAngle(cog - angleToTarget);
            let score = Math.cos(angleErr) * speedOverGround;

            // 4. Pressure Scouting (Look Ahead) with Boost awareness
            // Project position using calculated distance
            const projX = boat.x + Math.sin(cog) * speedOverGround * (steps * 60);
            const projY = boat.y - Math.cos(cog) * speedOverGround * (steps * 60);

            // Sample wind there
            const futureWind = getWindAt(projX, projY);

            // Apply Boost to Future Wind
            let futureEffective = futureWind.speed;
            if (futureEffective > state.wind.baseSpeed) {
                futureEffective = state.wind.baseSpeed + (futureEffective - state.wind.baseSpeed) * (1.0 + pressureFactor);
            } else {
                futureEffective = state.wind.baseSpeed + (futureEffective - state.wind.baseSpeed) * (1.0 - pressureFactor);
            }

            // Bonus for stronger wind relative to current effective wind
            // We compare future effective wind vs base wind (or current effective?)
            // Comparing to base makes sense as absolute value
            const windBonus = (futureEffective - state.wind.baseSpeed);
            // NOTE (2026-08-03 A/B, do not re-damp): scaling this term ×0.4 for
            // mode==='downwind' was a measured NO-OP on the Lighthouse Cove run
            // bulge — paired fin delta 0, L3/L5 sailed-distance ratio unchanged
            // at 1.34 vs the human's 0.99-1.10. The +35%-track-for-+0.4kt east
            // bulge is NOT chosen here; it lives at the angle/navigation level.
            const pressureCoeff = 0.1 * (1.0 + pressureFactor) * traits.pressureSense;
            score += windBonus * pressureCoeff;

            // 4b. Current Scouting (river): score the tack by the water it
            // LEADS TO — slack near the banks against an adverse stream, full
            // midstream push when the flow helps. This is what makes river
            // lane strategy exist for the AI at all: the current under the
            // keel is the same for both tacks and cancels out of the choice.
            if ((state.course.currentRegions || []).length) {
                const futureCur = getCurrentAt(projX, projY);
                if (futureCur && futureCur.speed > 0.05) {
                    const helping = Math.cos(futureCur.direction - angleToTarget) * (futureCur.speed / 4.0);
                    score += helping * 0.5;
                }
            }

            // 4c. Land feasibility: a tack whose projected position is inside
            // an island (or beyond the river's sailable water) ends in an
            // avoidance scramble and a forced tack-back — tax it up front.
            // With a grid the test is EXACT — the old bounding-circle check was
            // satisfied everywhere inside Glacier Sound's keyholed coast (r 8685),
            // taxing both tacks equally, i.e., not at all. This is what makes a
            // bot take the offshore tack off a lee shore instead of knife-edging
            // along it on leeway until it grinds.
            // Race legs only: in the packed start the projections land in the
            // fleet/line clutter and the taxes overwhelm lane discipline (measured:
            // DNS tripled when these ran on leg 0). Land venues only: on an open
            // course the only "shore" is the arena wall, and taxing tacks near it
            // re-tuned every layline on Clubhouse (tacks halved, +12s).
            const gT = (this.boat.raceState.leg >= 1
                && state.course._gridFixed && state.course._gridFixed.length)
                ? state.course.botGrid : null;
            if (gT) {
                // DECISIVE, not advisory: on a beat the two tacks differ by well
                // under 1.0 in VMG score, so a shore tax that is smaller than that
                // never changes the choice and the boat knife-edges the lee shore
                // on leeway until it grinds. A tack that ends in trouble must LOSE.
                for (const [mult, wgt] of [[1, 1], [2.5, 0.6]]) {
                    const px = boat.x + (projX - boat.x) * mult;
                    const py = boat.y + (projY - boat.y) * mult;
                    const cc = gT.cell(px, py);
                    const idT = cc[1] * gT.n + cc[0];
                    if (!gT.at(cc[0], cc[1])) { score -= 3.0 * wgt; }
                    else if (gT._clear && gT._clear[idT] < 3) { score -= 1.5 * wgt; }
                    else if (gT._leeW && gT._leeW[idT] > 1.2) { score -= 0.7 * wgt; }
                }
            } else if (state.course.islands && state.course.islands.length) {
                for (const isl of state.course.islands) {
                    // A shoal is water. This is the no-grid fallback for "that heading
                    // ends on land", and a flat land-shaped veto over a bar would refuse
                    // the crossing at any price — the grid path above already carries the
                    // real one, in seconds.
                    if (isl.awash) continue;
                    const dIsl2 = (projX - isl.x) ** 2 + (projY - isl.y) ** 2;
                    if (dIsl2 < isl.radius * isl.radius) { score -= 0.6; break; }
                }
            }
            if (state.course.riverCorridor) {
                const rcF = state.course.riverCorridor;
                const latF = (projX - rcF.cx) * rcF.rx + (projY - rcF.cy) * rcF.ry;
                if (Math.abs(latF) > 1050) score -= 0.6;
            }

            // 5. Wind Shift Lift/Header Bonus
            // When wind shifts right (positive), starboard tack TWA decreases (header),
            // port tack TWA increases (lift). So port tack benefits from positive shift.
            if (this.windTracker.initialized && this.windTracker.meanDirection !== null && mode === 'upwind') {
                const shift = normalizeAngle(localWind.direction - this.windTracker.meanDirection);
                const shiftMag = Math.abs(shift);
                // Only react to meaningful shifts (>3 degrees = 0.052 rad)
                if (shiftMag > 0.052) {
                    const tackSide = normalizeAngle(heading - wd) > 0 ? 1 : -1;
                    // Positive shift headers starboard (tackSide=1), lifts port (tackSide=-1)
                    const liftFactor = -tackSide * shift; // positive = lift for this tack
                    // shiftSense: whisperers weigh shifts heavily, gamblers barely look
                    score += liftFactor * 2.0 * traits.shiftSense;
                }
            }

            // Leech cover: reward the tack that matches the shadowed rival's
            if (coverTackSide !== 0) {
                const tackSide2 = normalizeAngle(heading - wd) > 0 ? 1 : -1;
                if (tackSide2 === coverTackSide) score += 0.45 * traits.cover;
            }

            return score;
        };

        let scoreS = scoreTack(hStarboard);
        let scoreP = scoreTack(hPort);

        // Dirty air escape: penalize current tack if in dirty air
        if (boat.badAirIntensity > 0.15) {
            const currentTackSide = normalizeAngle(boat.heading - wd) > 0 ? 1 : -1;
            const dirtyPenalty = boat.badAirIntensity * 0.6;
            if (currentTackSide === 1) scoreS -= dirtyPenalty; // Penalize staying on starboard
            else scoreP -= dirtyPenalty; // Penalize staying on port
        }

        // Hysteresis / Stickiness
        // Bias towards current tack to prevent rapid switching
        const currentTack = normalizeAngle(boat.heading - wd) > 0 ? 1 : -1; // 1=Stbd, -1=Port
        // Stat-aware hysteresis: agile characters need less stickiness
        const tackAgility = (boat.stats.handling * 0.3 + boat.stats.acceleration * 0.3 + boat.stats.momentum * 0.2);
        const hysteresisMod = -tackAgility * 0.0625; // Range: +0.25 to -0.25
        const baseTackBonus = (boat.badAirIntensity < 0.05) ? 0.6 : 0.4;
        // Gamblers are far stickier — committed to their side of the beat.
        // Racing legs only: stickiness on leg 0 pins them in start traffic.
        const commitBonus = (traits.sideCommit && boat.raceState.leg > 0) ? 0.45 : 0;
        // overTack > 1 dissolves stickiness: a shift-whisperer cannot leave a header
        // alone, and every extra tack is paid for in the manoeuvre. Situational by
        // construction — in steady air the two tacks score alike and this changes
        // nothing, so the cost lands only when the shift advantage is being used.
        // Replaces the flat speedScale tax (guidelines/skills.md 3.3).
        const stick = (baseTackBonus + hysteresisMod + commitBonus) / (traits.overTack || 1);
        const tackBonus = Math.max(0.15, Math.min(1.5, stick));

        let preferredHeading = (scoreS > scoreP) ? hStarboard : hPort;

        if (currentTack === 1 && scoreS + tackBonus > scoreP) preferredHeading = hStarboard;
        if (currentTack === -1 && scoreP + tackBonus > scoreS) preferredHeading = hPort;

        // Check Laylines (Overstanding)
        // If on the preferred tack, check if we crossed the layline for the *other* tack.
        // i.e., does the *other* tack now point directly at the target (or past it)?

        // If we are on Starboard, and Port tack COG points at target, we should tack.
        const otherTackHeading = (preferredHeading === hStarboard) ? hPort : hStarboard;

        // Calculate COG for other tack — include leeway (mirrors scoreTack) so we
        // call the layline on our true crabbed track, not our heading. Tacking on
        // the heading line leaves us to leeward of the mark, pinching to fetch.
        let otherLeewayHeading = otherTackHeading;
        const otherTwa = normalizeAngle(otherTackHeading - wd);
        if (Math.abs(otherTwa) < Math.PI * 0.5 && boat.speed > 0.05) {
            const spdK = Math.max(1.5, boat.speed / 0.25);
            const shape = 1.0 - Math.abs(otherTwa) / (Math.PI * 0.5);
            const lwDeg = Math.min(3.0, 3.0 * shape * (localWind.speed / 12) * (12 / (spdK * spdK)));
            otherLeewayHeading = normalizeAngle(otherTackHeading + (lwDeg * Math.PI / 180) * (Math.sign(otherTwa) || 1));
        }
        let otherCog = otherLeewayHeading;
        if (current && current.speed > 0.1) {
             // ... same COG math ...
             const cSpeed = current.speed / 4.0;
             const cDir = current.direction;
             const bSpeed = Math.max(1.0, boat.speed);
             const vx = Math.sin(otherLeewayHeading)*bSpeed + Math.sin(cDir)*cSpeed;
             const vy = -Math.cos(otherLeewayHeading)*bSpeed - Math.cos(cDir)*cSpeed;
             otherCog = Math.atan2(vx, -vy);
        }
        
        // Angle from Other Tack COG to Target
        const otherError = normalizeAngle(otherCog - angleToTarget);

        // If we are on Starboard (preferred), and Port tack aligns with target...
        // Wait, layline logic:
        // We sail Starboard until Port tack fetches the mark.
        // So if we are sailing Starboard, and Port Tack VMG is perfect (angle 0), we tack.
        // Actually, if we go *past* 0 (sign change), we overstood.

        // Only trigger tack if we are currently on the 'wrong' tack relative to geometry
        // but 'score' keeps us there due to wind.
        // Actually, explicit Layline check overrides score.

        // Layline proximity check: tack when other tack can fetch the mark.
        // laylineTight < 1 calls the layline later/closer (metronome precision);
        // > 1 tacks early and overstands a touch (freight caution).
        if (Math.abs(otherError) < 0.1 * traits.laylineTight) {
             if (this.tackCooldown <= 0) {
                 this.tackCooldown = 10.0;
                 return otherTackHeading;
             }
        }

        // Cooldown check
        if (this.tackCooldown > 0) this.tackCooldown -= 0.1; // 10Hz update interval

        // If we decide to switch tacks based on score
        const targetTackSign = (preferredHeading === hStarboard) ? 1 : -1;
        if (targetTackSign !== currentTack && this.tackCooldown > 0) {
            // Keep current if cooldown active
            return (currentTack === 1) ? hStarboard : hPort;
        }

        // THE INFORMATION GATE (arctic router push). In a floe field the
        // pure-pursuit carrot alternates across the wind at stair frequency
        // (16.8 side invitations/boat-race, 62% of them BETWEEN replans with
        // the path object unchanged, converting to manoeuvres at 83% —
        // _carrot_pin_cf), so the fleet re-decides its board at the cooldown
        // floor while he holds a median 1335u board and 7 tacks a beat. A
        // proposed side switch here EXISTS only on information:
        //   (a) a replan changed the corridor answer (_c2Window, set above)
        //   (b) the current board is blocked ahead — land or floe — the board
        //       is genuinely over (his boards end at 78-179u floe clearance)
        //   (c) an avoidance role or threat is live (rules interplay untouched)
        //   (e) the plan's FAR corridor (900u, the pure-pursuit LOOK cap)
        //       agrees with the proposed side — a real corner, not a stair.
        // The layline return above and the cooldown are untouched; no time
        // price is added or changed anywhere (the TK3 kill priced re-decisions
        // in TIME; this changes WHICH re-decisions exist). Floe venues only
        // (_floeObjs — the canyon-law scope; grid._soft is NOT a floe test),
        // racing legs only (start tuning sacred): elsewhere stock arithmetic.
        if (targetTackSign !== currentTack
            && state.course._floeObjs && state.course._floeObjs.length
            && this.boat.raceState.leg >= 1) {
            let c2Reason = (this._c2Window || 0) > 0
                || (this.avoidanceRole && this.avoidanceRole !== 'NONE')
                || !!this.threatBoat;
            // v3 (v1: solo −34 s/boat but fleet med +3/mean +6.3, floe +11%;
            // v2's any-deviation clause dissolved the gate — floe deviation is
            // near-continuous here and the solo wins vanished): rivals are
            // information the plan cannot see. The gate binds only in CLEAR
            // water — the measured phantom class (38% of fleet side-changes
            // happen with no role, no threat and no rival inside 300u). Any
            // unfinished rival within 300u opens the re-decision.
            if (!c2Reason) {
                for (const oC2 of state.boats) {
                    if (oC2 === boat || oC2.isPlayer || oC2.raceState.finished) continue;
                    if ((oC2.x - boat.x) ** 2 + (oC2.y - boat.y) ** 2 < 300 * 300) { c2Reason = true; break; }
                }
            }
            if (!c2Reason) {
                const gC2 = (state.course._gridFixed && state.course._gridFixed.length)
                    ? state.course.botGrid : null;
                if (gC2) {
                    const hNow2 = (currentTack === 1) ? hStarboard : hPort;
                    const reach = Math.max(160, boat.speed * 96);
                    for (const fC of [0.34, 0.67, 1.0]) {
                        const cc2 = gC2.cell(boat.x + Math.sin(hNow2) * reach * fC,
                            boat.y - Math.cos(hNow2) * reach * fC);
                        if (!gC2.at(cc2[0], cc2[1])) { c2Reason = true; break; }
                    }
                } else c2Reason = true;   // no grid: the gate cannot see — stock behavior
            }
            if (!c2Reason && this.gridPath && this.gridPath.length) {
                let fx = null, fy = null, accF = 0, pxF = boat.x, pyF = boat.y;
                for (const qF of this.gridPath) {
                    const dF = Math.hypot(qF.x - pxF, qF.y - pyF);
                    if (accF + dF >= 900) {
                        const ffF = (900 - accF) / (dF || 1);
                        fx = pxF + (qF.x - pxF) * ffF; fy = pyF + (qF.y - pyF) * ffF;
                        break;
                    }
                    accF += dF; pxF = qF.x; pyF = qF.y;
                }
                if (fx === null) { fx = pxF; fy = pyF; }
                const sideFar = normalizeAngle(Math.atan2(fx - boat.x, -(fy - boat.y)) - wd) >= 0 ? 1 : -1;
                if (sideFar === targetTackSign) c2Reason = true;
            } else if (!c2Reason) {
                c2Reason = true;   // no plan to consult — the gate cannot see; stock behavior
            }
            if (!c2Reason) return (currentTack === 1) ? hStarboard : hPort;
        }

        // NO TACKING WITHOUT WAY ON IN A BLOW. Above ~16 kt a boat that tacks slow
        // parks head-to-wind mid-turn and takes half a minute to recover — sail on,
        // build speed close-hauled, and take the tack with steerage. (The layline
        // return above still fires: missing the mark is worse than a slow tack.)
        // ...EXCEPT INTO A WALL. The one thing worse than parking head-to-wind
        // is grinding the shore the current board points at: the channel-wall
        // pins line both shores of the eastern beat (dwell 86 s/boat vs the
        // human 9), and a slow boat here was physically FORBIDDEN to tack away.
        // The recorded human pins prove a hull rotates fine at zero speed —
        // slow is a cost, the wall is a trap. Hard blockage (land or a stamped
        // floe, not grindable soft ice) within ~180u dead ahead waives the guard.
        if (targetTackSign !== currentTack && this.boat.speed < 1.1
            && getWindAt(this.boat.x, this.boat.y).speed > 16) {
            let wallAhead = false;
            const gW = (state.course._gridFixed && state.course._gridFixed.length)
                ? state.course.botGrid : null;
            if (gW) {
                const hNow = (currentTack === 1) ? hStarboard : hPort;
                for (const dW of [90, 180]) {
                    const cc = gW.cell(this.boat.x + Math.sin(hNow) * dW, this.boat.y - Math.cos(hNow) * dW);
                    if (!gW.at(cc[0], cc[1])) {
                        const idW = cc[1] * gW.n + cc[0];
                        if (!(gW._soft && gW._soft[idW])) { wallAhead = true; break; }
                    }
                }
            }
            if (!wallAhead) return (currentTack === 1) ? hStarboard : hPort;
        }

        if (targetTackSign !== currentTack) {
             this.tackCooldown = 5.0; // Reset cooldown on switch
        }

        return preferredHeading;
    }

    // --- Prestart Helper Methods ---

});
Object.assign(BotController.prototype, {
    getLineDistance() {
        const [m0, m1] = startLinePts();
        return hullLineOffset(this.boat, m0, m1, false); // positive = above/upwind of line
    }

});
Object.assign(BotController.prototype, {
    getApproachTime(distance, currentSpeed, stats) {
        // Mini physics simulation matching updateBoat() acceleration.
        // Local wind speed: the crossing run happens where the boat is, and on a
        // region-varied venue the venue-mean can be 5+ knots adrift of the line.
        const targetGameSpeed = getTargetSpeed(0.7, false, getWindAt(this.boat.x, this.boat.y).speed) * 0.25; // close-hauled ~40° TWA
        const accelMod = 1.0 + stats.acceleration * 0.024;

        let speed = currentSpeed;
        let dist = distance;
        let time = 0;
        const step = 0.1; // 100ms steps
        const maxTime = 30; // safety cap

        while (dist > 0 && time < maxTime) {
            const timeScale = step * 60;
            let alpha = 1 - Math.pow(0.9970, timeScale); // must match updateBoat's speed response
            if (targetGameSpeed > speed) alpha *= accelMod;
            speed = speed * (1 - alpha) + targetGameSpeed * alpha;
            dist -= speed * 60 * step; // speed * 60 = game units/sec
            time += step;
        }
        return time;
    }

});
Object.assign(BotController.prototype, {
    getStartCommand() {
        const boat = this.boat;
        const timer = state.race.timer;
        const [m0, m1] = startLinePts();

        const dx = m1.x - m0.x;
        const dy = m1.y - m0.y;
        const lineLen = Math.hypot(dx, dy) || 1;

        // Hold our assigned lane (set in repositionBoats). We never drift the lateral
        // target — chasing a "better" spot makes the boat cross diagonally and end up
        // outside the start segment (so it never starts). Lane discipline keeps us
        // lined up with the segment.
        this.startLinePct = Math.max(0.1, Math.min(0.9, this.startLinePct));
        const targetX = m0.x + dx * this.startLinePct;
        const targetY = m0.y + dy * this.startLinePct;
        // The wind AT THE LANE, not the course-centroid blend. Staging, the timed
        // crossing run and OCS dips are all vectors off this direction; on Glacier
        // Sound the global blend is ~110° adrift of the line's own wind and the whole
        // prestart geometry silently rotated into the lee shore.
        const wd = getWindAt(targetX, targetY).direction;
        const downwind = wd + Math.PI;

        // Signed perpendicular distance to the line (>0 = course side / over early), measured
        // at the HULL'S LEADING EDGE — the same thing the rule is judged on. Aiming the
        // CENTRE at the line puts the bow 25 units over it, so once the crossing test became
        // hull-based (RRS: "any part of her hull") this boat was OCS every time it hit its
        // own mark. Measured cost of the mismatch: mark touches ran 2-4x while the fleet
        // milled around the committee boat recovering.
        const pDist = hullLineOffset(boat, m0, m1, true);
        const behind = Math.max(0, -pDist);

        const P = (typeof window !== 'undefined' && window.__START) ? window.__START : {};
        const STAGE = P.stage != null ? P.stage : (this.startStageDepth || 60);
        const PAST = P.past != null ? P.past : 70;   // how far past the line to aim
        const OVER = P.over != null ? P.over : 10;   // perp over which we are over-early
        // crossing-run buffer (higher = commit earlier; >1 measured to raise OCS sharply)
        // Archetype: rockets/bullies commit a touch earlier, metronomes later.
        const BUF = (P.buf != null ? P.buf : 0.5) + (boat.traits ? boat.traits.startBufAdj : 0);
        const cosT = Math.cos(0.7);

        const aimX = targetX + Math.sin(wd) * PAST;     // up through our lane
        const aimY = targetY - Math.cos(wd) * PAST;
        const stageX = targetX - Math.sin(wd) * STAGE;  // in lane, just behind the line
        const stageY = targetY + Math.cos(wd) * STAGE;

        // OCS recovery (flagged over early) — dip back below the line in our lane.
        if (boat.raceState.ocs) {
            const OCSBACK = P.ocsback != null ? P.ocsback : 55; // just past the -40 OCS-clear plane; deeper dips measured slower
            return { target: { x: targetX - Math.sin(wd) * OCSBACK, y: targetY + Math.cos(wd) * OCSBACK }, speed: 1.0 };
        }

        // Gun fired — full speed up our lane.
        if (timer <= 0) {
            this.startCommitted = true;
            return { target: { x: aimX, y: aimY }, speed: 1.0 };
        }

        // Over the line during the prestart — dip back to the pre-start side.
        if (pDist > OVER && !this.startCommitted) {
            const retreatX = targetX - Math.sin(wd) * (STAGE + pDist);
            const retreatY = targetY + Math.cos(wd) * (STAGE + pDist);
            return { target: { x: retreatX, y: retreatY }, speed: 1.0 };
        }

        // ---- Staged-lane start ----
        // Stage just behind the line in our lane, then ease across timed to cross on
        // the gun. The crossing run is SHORT, so we drift little and cross inside the
        // segment (a long run drifts out of the segment, never starts, and jams).
        const tCross = this.getApproachTime(STAGE / cosT, boat.speed, boat.stats) + BUF;
        if (this.startCommitted || timer <= tCross) {
            this.startCommitted = true;
            return { target: { x: aimX, y: aimY }, speed: 1.0 };
        }

        // ---- Pre-cross ----
        // The staged hold luffs head-to-wind, which stops the boat dead: measured
        // 0.0 kt from T-12 to T-6 on bay and seatrials (_st_branch/_st_cmd), and
        // a fleet that arrives at 2.0-4.6 kt against his 5-6 (_st_human.js reads
        // his own countdown out of the corpus — phase 0 is recorded).
        // That is affordable in a breeze on still water: the boat sits where it is
        // put, and bay/seatrials already cross the line SOONER than he does. It is
        // not affordable in a FOUL STREAM, which carries a stopped boat away and
        // does not give it back: the set across river's line runs -4.42 kt against
        // a close-hauled VMG of about 4 kt (_st_cur.js), which is why its fleet
        // ends the countdown 324 u adrift with a THIRD of it swept outside the
        // start segment entirely.
        // A FAIR stream is not the same case — it delivers the boat to the line
        // whether she is sailing or not, and the failure that produces (over early)
        // belongs to the retreat branch. Measured: arming this on glowtide's
        // +5.29 kt bought a better start (crossing -2.17 s, OCS at the gun 55->40%)
        // and cost the LAP +6 s with land contacts +28%, all of it at 60 s+.
        // ⛔ A LIGHT-AIR CLAUSE WAS TRIED AND DROPPED ON THE EVIDENCE. In 3.9 kt a
        // stopped boat cannot accelerate out of the irons brake either, and arming
        // the branch there bought swamp a large start (crossing mean -9.99 s,
        // 100 u -> 45 u behind at the gun) that DID NOT CONVERT: 3x8 gave median
        // 327->342 and finishers 237->230. The same clause armed one redrock boat
        // in ten — redrock's light corner is 4.49 kt against swamp's 4.46, the same
        // breeze, and no threshold separates them — for boat contacts +31%.
        const setAlongKt = (() => { const c = getCurrentAt(boat.x, boat.y);
            return c ? c.speed * 4 * Math.cos(c.direction - wd) : 0; })();  // + = toward the line
        // DECIDED ONCE, at the first pre-start look, and held. A per-frame test lets
        // a boat that drifts through a patch of stream flip its whole pre-start plan
        // mid-countdown — on lagoon, whose line reads -0.65 kt at the gun, that
        // reshuffled 20 of 80 boat-races for nothing. A sailor reads the breeze and
        // the stream once and picks a plan.
        if (this.startWayOn == null) this.startWayOn = setAlongKt <= -1.5;
        const cannotHold = this.startWayOn;
        if (!cannotHold) {
            // unchanged: stage in our lane and hold there
            if (behind > STAGE + 35) {
                return { target: { x: stageX, y: stageY }, speed: 0.75 };
            }
            return { heading: wd, speed: 0.9 };
        }
        // Way on: reach back and forth ALONG the line at a depth driven toward the
        // staging depth — away when too close, in when too far — as a TARGET, so
        // the strategic layer crabs it for the set and never commands irons. The
        // reach is a FRACTION of the line, clamped inside the segment: this file's
        // own lane comment records what happens otherwise — a boat that wanders
        // off its lane crosses outside the marks and never starts.
        const REACHP = P.reachPct != null ? P.reachPct : 0.18;
        if (this.startReachSide == null) this.startReachSide = this.startLinePct > 0.5 ? -1 : 1;
        const myPct = ((boat.x - m0.x) * dx + (boat.y - m0.y) * dy) / (lineLen * lineLen);
        let holdPct = this.startLinePct + this.startReachSide * REACHP;
        if (holdPct > 0.88 || holdPct < 0.12
            || (myPct - this.startLinePct) * this.startReachSide > REACHP * 0.8) {
            this.startReachSide = -this.startReachSide;
            holdPct = this.startLinePct + this.startReachSide * REACHP;
        }
        holdPct = Math.max(0.12, Math.min(0.88, holdPct));
        if (behind > STAGE + 35) {
            return { target: { x: stageX, y: stageY }, speed: 1.0 };
        }
        const depth = Math.max(40, Math.min(3 * STAGE, STAGE + 1.5 * (STAGE - behind)));
        return { target: { x: m0.x + dx * holdPct - Math.sin(wd) * depth,
                           y: m0.y + dy * holdPct + Math.cos(wd) * depth }, speed: 1.0 };
    }


});
