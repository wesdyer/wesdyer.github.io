// regatta/js/ai/bot.js — BotController core: risk metrics, constructor,
// wind tracker, per-frame update, plus the AI<->boat plumbing (updateAI,
// updateAITrim, getFavoredEnd). getNavigationTarget/getStrategicHeading live
// in ai/navigation.js; updateRiskAssessment/planFloeTrajectory/applyAvoidance
// in ai/avoidance.js (added to the prototype via Object.assign — same methods,
// different file). Classic script; global scope. Extracted verbatim from
// script.js (refactor 2026-08-24).
// Helper for Risk Prediction (CPA)
function getRiskMetrics(boat, other) {
    const dx = other.x - boat.x;
    const dy = other.y - boat.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Relative Velocity (units/sec)
    // boat.velocity is updated in updateBoat, but if it's not ready, estimate from heading/speed
    // NOTE: heading-based on purpose — using actual velocity vectors (leeway/current)
    // was tested and REGRESSED (risk flaps during turning transients; race +3.5s, collisions +64%).
    const vx1 = (Math.sin(boat.heading) * boat.speed) * 60;
    const vy1 = (-Math.cos(boat.heading) * boat.speed) * 60;

    const vx2 = (Math.sin(other.heading) * other.speed) * 60;
    const vy2 = (-Math.cos(other.heading) * other.speed) * 60;

    const relPx = dx;
    const relPy = dy;
    const relVx = vx2 - vx1;
    const relVy = vy2 - vy1;

    const vSq = relVx*relVx + relVy*relVy;

    let tCPA = 0;
    let distCPA = dist;

    if (vSq > 0.001) {
        const dot = relPx*relVx + relPy*relVy;
        tCPA = -dot / vSq;
        if (tCPA > 0) {
            const cpaX = relPx + relVx * tCPA;
            const cpaY = relPy + relVy * tCPA;
            distCPA = Math.sqrt(cpaX*cpaX + cpaY*cpaY);
        }
    }

    return { tCPA, distCPA, distCurrent: dist };
}

// The sailable fan the contact escape is chosen from when there is a stream
// running. Every entry is a true wind angle outside the no-go band (the no-go
// tax fires below 0.55 rad), both tacks, close-hauled through dead downwind.
const ESC_TWAS = [0.65, -0.65, 0.85, -0.85, 1.05, -1.05, 1.3, -1.3, 1.55, -1.55,
                  1.8, -1.8, 2.1, -2.1, 2.4, -2.4, 2.75, -2.75, 3.1, -3.1];

// THE RADIUS IS THE GAP (rounding comparison, Aug 6): the fleet rounds at 117u
// where the human rounds at 47u, with identical speed-carry, zone time, tack
// count and turn rate — the whole 2.5x is the ring the carrot rides. The human
// ring sits just outside avoidance's hard mark zone (38 + bodyR); aim there.
// Grid-validated per mark with the same whole-circle test as CoursePath._roundR's
// ladder, because a tight ring is only sailable if it is all water — a mark
// planted on an island or rock keeps the old target by returning null. Floe
// grids return null too: the ring machinery's radii were priced against
// drifting ice (orbit-hold, churn, widening A/Bs all live at those constants),
// and drifting ice is the one physical line the open-water gates sit on.
function orbitTightR(rm) {
    if (rm._orbTight !== undefined) return rm._orbTight;
    const grid = state.course.botGrid;
    if (!grid) return null;
    if (state.course._hasFloes == null) {
        state.course._hasFloes = (state.course.islands || []).some(i => i.isFloe);
    }
    if (state.course._hasFloes) return (rm._orbTight = null);
    // OPEN-WATER MARKS ONLY. The first cut validated just the tight circle and
    // paid for it where marks stand in confined water: redrock finishers 11->6
    // with mark contacts 2.3x, lake +1.0 med with every contact class up — a
    // tighter ring in a rock funnel packs the queue into the pinch. A mark
    // qualifies only if the WHOLE ring out to the approach radius is water:
    // sampled circles from the tight ring to zone*1.15 (the widest radius the
    // approach carrot uses). Bay/ocean marks pass; a mark with rock inside its
    // zone keeps the stock target.
    const tight = 38 + (rm.bodyR || 12) + 20;
    const ringClear = (R) => {
        for (let k = 0; k < 32; k++) {
            const a = k / 32 * Math.PI * 2;
            const c = grid.cell(rm.x + Math.cos(a) * R, rm.y + Math.sin(a) * R);
            if (!grid.at(c[0], c[1])) return false;
        }
        return true;
    };
    // Out to TWO zones: the ring test at zone*1.15 still passed redrock's m4
    // (fins 11->9, mark contacts 2.1x) — a clear ring with rock-walled
    // APPROACHES is still a funnel, and a tighter turn inside a funnel packs
    // the queue. Two zones of open water is what bay/ocean marks have and
    // maze marks never do.
    for (const R of [rm.zone * 2, rm.zone * 1.6, rm.zone * 1.15, rm.zone, (tight + rm.zone) / 2]) {
        if (!ringClear(R)) return (rm._orbTight = null);
    }
    for (const R of [tight, tight * 1.25, tight * 1.5]) {
        if (ringClear(R)) return (rm._orbTight = R);
    }
    return (rm._orbTight = null);
}

// AI Controller
class BotController {
    constructor(boat) {
        this.boat = boat;
        this.targetHeading = 0;
        this.speedLimit = 1.0;
        
        // Start Strategy
        // Use pre-assigned position from resetGame if available, otherwise random
        this.startLinePct = (boat.ai && boat.ai.startLinePct != null) ? boat.ai.startLinePct : (0.1 + Math.random() * 0.8);

        // Prestart State Machine
        this.prestartPhase = 'HOLD';       // HOLD, POSITION, APPROACH, ACCELERATE

        this.livenessState = 'normal'; // 'normal', 'recovery', 'force'
        this.forceTack = 0; // committed tack during force/recovery start (0=none, ±1)
        this.startCommitted = false; // latched once we begin the final run to the line
        this.startStageDepth = 200;  // echelon staging depth behind the line (set on reset)
        this.tCrossTarget = 0;       // target crossing time relative to the gun (echelon slot)
        this.lowSpeedTimer = 0;
        this.wiggleTimer = 0;
        this.wiggleSide = 1;
        this.wiggleActive = false;
        this.wiggleDuration = 0;
        this.clearanceTimer = 0;
        this.clearanceHeading = 0;
        // Stuck-state maneuver (ESCAPE): back out along own breadcrumb track.
        this.escActive = false;
        this.escCrumbs = [];   // ring buffer of {x,y}, one per >=20u of travel
        this.escSustain = 0;   // seconds the wedge signature has held
        this.escTimer = 0;     // seconds in the active maneuver (20s hard cap)

        // Navigation
        this.tackCooldown = 0;
        this.preferredTack = 0; // 0=none, 1=starboard, -1=port
        
        // Collision Avoidance State
        this.riskState = 'LOW'; // LOW, MEDIUM, HIGH, IMMINENT
        this.avoidanceRole = 'NONE'; // NONE, STAND_ON, GIVE_WAY
        this.avoidanceCommitTimer = 0;

        // Wind Shift Tracking
        this.windTracker = { emaSin: 0, emaCos: 0, meanDirection: null, initialized: false };

        // Mark Recovery Latch
        this.markContactTimer = 0;
        this.markEscapeHeading = 0;

        // Staggered updates
        this.updateTimer = Math.random() * 0.2; 

        // Route Planning
        this.planner = new RoutePlanner();
        this.currentPath = [];
        this.pathTimer = 0;
        this.finalTarget = null;
    }

    updateWindTracker() {
        const localWind = getWindAt(this.boat.x, this.boat.y);
        const wd = localWind.direction;
        // ~60s window at 10Hz; shift-whisperers read the wind faster (windFast > 1)
        const alpha = 0.00167 * (this.boat.traits ? this.boat.traits.windFast : 1);

        if (!this.windTracker.initialized) {
            this.windTracker.emaSin = Math.sin(wd);
            this.windTracker.emaCos = Math.cos(wd);
            this.windTracker.meanDirection = wd;
            this.windTracker.initialized = true;
        } else {
            this.windTracker.emaSin += alpha * (Math.sin(wd) - this.windTracker.emaSin);
            this.windTracker.emaCos += alpha * (Math.cos(wd) - this.windTracker.emaCos);
            this.windTracker.meanDirection = Math.atan2(this.windTracker.emaSin, this.windTracker.emaCos);
        }
    }

    update(dt) {
        this.updateTimer -= dt;
        if (this.updateTimer > 0) return;
        this.updateTimer = 0.1; // 10Hz updates
        // ⚠️ THE BODY RUNS AT 10Hz BUT dt IS THE FRAME STEP (1/60), so a `± dt`
        // timer in here runs six times slower than its comment claims: a "5 second"
        // wiggle held for 30 and the stall detector needed 18s to notice. TICK is
        // the body's true clock. The risk-assessment timers keep the old scale on
        // purpose — they were tuned as-built, and retiming them retunes every
        // avoidance number at once.
        const TICK = 0.1;

        // Update Wind Tracker
        this.updateWindTracker();

        // Update Risk Assessment
        this.updateRiskAssessment(dt);

        const isRacing = state.race.status === 'racing';
        const isPrestart = state.race.status === 'prestart';

        // Liveness Watchdog (Enabled for all race phases to prevent stuck bots)
        if (isRacing) {
            const timeSinceStart = state.race.timer;

            // Velocity Check (Hysteresis)
            //
            // ⭐ THE RESET BAR IS SCALED BY THE DAY, NOT BY THE FRAME. 2.5 kt is right
            // where the fleet cruises at 5.7-8.5 kt. Gatorgrass Bayou blows 0.9-4.8 kt
            // and its fleet MEANS 2.07 kt — below the reset — so a boat that once dipped
            // into weed can never clear the timer by sailing normally. It ratchets to 3 s
            // and wiggles, and wiggle beam-reaches 100 deg off the wind with avoidance
            // switched off. Measured: 25% of racing time, odometer 1.95x vs her 1.06x.
            //
            // ⚠️ IT MUST NOT BE THE BOAT'S OWN INSTANTANEOUS TARGET. That was tried
            // (treeSTK2/STK3) and river lost 16 of 108 finishers, because the test goes
            // CIRCULAR: a boat pinned against a bank sits in that bank's wind shadow, so
            // its local target collapses, and "you are making 60% of what is available"
            // declares a trapped boat healthy. Being somewhere hopeless must not excuse
            // you from being stuck.
            //
            // The day's MEDIAN wind over the racecourse (state.wind.spread.med, the mean
            // field p50 — no gusts, no oscillator) is a RACE CONSTANT and cannot be
            // lowered by the boat sailing somewhere bad. Where the day supports the old
            // bar this is byte-identical by construction, so every 11-16 kt venue is
            // untouched; only a genuinely light-air DAY moves. Venue-class scoping on a
            // measured physical property, which is the shape standing rule 11 asks for.
            const wMed = (state.wind && state.wind.spread && state.wind.spread.med > 0)
                ? state.wind.spread.med : null;
            if (wMed !== null && state.course._stuckBarKey !== wMed) {
                state.course._stuckBarKey = wMed;
                const nom = (typeof getTargetSpeed === 'function')
                    ? getTargetSpeed(0.7, false, wMed) * 0.25 : 0;
                state.course._stuckResetBar = nom > 0 ? Math.min(0.625, nom * 0.60) : 0.625;
                // ⭐ BOTH bars ride the DAY, for the same reason and with the same min().
                // Lowering the accumulate bar per-FRAME is what broke river (a boat in a
                // bank's shadow excused itself); lowering it per-RACE cannot, because the
                // day median is not something a trapped boat can move. On any 8+ kt day
                // this is exactly 0.25 and the venue is byte-identical.
                state.course._stuckAccelBar = nom > 0 ? Math.min(0.25, nom * 0.25) : 0.25;
            }
            const resetBar = (wMed !== null && state.course._stuckResetBar != null)
                ? state.course._stuckResetBar : 0.625;
            const accelBar = (wMed !== null && state.course._stuckAccelBar != null)
                ? state.course._stuckAccelBar : 0.25;
            if (this.boat.speed < accelBar) {
                this.lowSpeedTimer += TICK;
            } else if (this.boat.speed > resetBar) { // Only reset if truly moving fast
                this.lowSpeedTimer = 0;
            } else if (resetBar < 0.625) {
                // ⭐ THE DEAD BAND BLEEDS — ON A LIGHT-AIR DAY ONLY. Between the two bars
                // this hysteresis FREEZES whatever stuck-time was banked, because it was
                // written for a bimodal world: a boat is either stopped or cruising. On an
                // 11-16 kt venue that middle is a sliver nobody occupies (redrock wiggles
                // 3.2% of the time). On Gatorgrass boats LIVE there — 34.8% of racing time
                // sits between the bars, and 320 of 454 wiggle entries (70%) begin from
                // inside it, off a timer banked during some earlier dip. A boat making
                // 1.5 kt of an available 2.2 kt is SAILING and should be shedding
                // stuck-time, not keeping it.
                //
                // ⚠️ SCOPED, BECAUSE UNSCOPED IT IS NOT HARMLESS. Bleeding on every venue
                // moved river, redrock and lake: river paid +55% boat contacts and +36 s of
                // mean for a flat paired median, and redrock paid +7.0 paired median with
                // penalties 2.03 -> 2.27. The test resetBar < 0.625 is true only where the
                // day-scaled bar actually bit — a genuinely light-air DAY — so every 8+ kt
                // venue keeps today frozen dead band and is byte-identical by construction.
                //
                // Half rate, so a genuinely pinned boat still accumulates NET: she sits
                // BELOW accelBar, where the timer climbs at full rate.
                this.lowSpeedTimer = Math.max(0, this.lowSpeedTimer - TICK * 0.5);
            }

            const prevState = this.livenessState;
            // Only apply Force/Recovery logic on Start Leg (Leg 0) or if seriously stuck
            // On other legs, we rely on Wiggle logic primarily
            if (this.boat.raceState.leg === 0) {
                // Faster recovery on leg 0 — 15s is an eternity at the start
                if (timeSinceStart > 30 || this.lowSpeedTimer > 10.0) {
                    this.livenessState = 'force';
                } else if (timeSinceStart > 10 || this.lowSpeedTimer > 5.0) {
                    this.livenessState = 'recovery';
                } else {
                    this.livenessState = 'normal';
                }
            } else if (state.course._gridFixed && state.course._gridFixed.length) {
                // RACING LEGS TOO — on LAND venues. A boat pinned against ice mid-leg
                // used to have only the wiggle, which beam-reaches it straight back
                // into the same pocket; whole Glacier Sound fleets sat at 0.1 speed
                // for six minutes in 'normal'. Slower thresholds than leg 0 — a boat
                // luffing through a rounding or a penalty turn is slow on purpose.
                // Open venues keep the classic behavior (no mid-race liveness): there
                // is nothing to be pinned ON, and recovery mode hijacking a slow
                // rounding measurably costs time.
                if (this.lowSpeedTimer > 18.0) {
                    this.livenessState = 'force';
                } else if (this.lowSpeedTimer > 8.0) {
                    this.livenessState = 'recovery';
                } else {
                    this.livenessState = 'normal';
                }
            } else {
                this.livenessState = 'normal';
            }

            if (prevState !== this.livenessState) {
                // console.log(`[AI] ${this.boat.name} transition: ${prevState} -> ${this.livenessState}`);
            }
        } else {
            this.livenessState = 'normal';
            this.lowSpeedTimer = 0;
        }

        let desiredHeading = this.boat.heading;
        let speedRequest = 1.0;

        // THE OUTBOUND LATCH LIVES HERE, where it always runs. It used to live in
        // getNavigationTarget — which the wiggle/escape branches skip — so during
        // the exact seconds the sweep peaked (boat grinding in the ring, recovery
        // mechanisms in charge) nobody was watching the sweep, and 2.89-rad
        // roundings evaporated unbanked. While outbound, the wiggle stands down:
        // the boat has a rounding to bank and navigation must steer the exit.
        {
            const rsL = this.boat.raceState;
            const rmL = legRoundMark(rsL.leg) || state.course.roundMark;
            if (isRacing && rmL && rmL.reqSweep != null && rsL.leg >= 1 && !rsL.finished
                && typeof ROUND_SWEEP_TOL !== 'undefined') {
                if (this._outboundLeg !== rsL.leg) { this._outboundLeg = rsL.leg; this._outbound = false; }
                const needL = rmL.reqSweep * ROUND_SWEEP_TOL;
                // ASK THE ENGINE, don't keep a second copy of the threshold. The engine
                // latches `roundBanked` the moment the swept angle reaches the
                // requirement, and from that moment the only thing left to do is leave.
                // The old +0.25 buffer existed because the sweep could UNWIND before
                // the departure test saw it — the latch removes that reason, and with
                // the requirement no longer discounted the buffer is a quarter-radian
                // of extra orbit, sailed in an island's lee, for nothing.
                if (rsL.roundBanked && rsL.roundWrapped !== false) this._outbound = true;
                else if ((rsL.roundSweep || 0) < needL * 0.8) this._outbound = false;
                if (this._outbound) { this.wiggleActive = false; this.wiggleDuration = 0; }
            }
        }

        // THE STUCK-STATE MANEUVER (ESCAPE). The wedged class (redrock mark-6
        // islet-wall slot): a parked, nosed-in boat whose whole 24-heading rose
        // is hard-blocked within 220u. Seven shapes failed on it because no
        // existing layer can express a multi-point retreat — the fan demands
        // forward water, the carrot has no LOS, and the wiggle beam-reaches
        // blind. The one guaranteed-sailable line is the boat's OWN WAKE, so
        // the maneuver retraces breadcrumbs with wiggle-grade authority.
        // Constraints honored: no rival within 150u to enter, abort at 120u
        // (station-keeping/Freezing-Robot); 20s hard cap (never latch past the
        // 30s reversal-commitment disease); fixed-land venues only, floe
        // venues excluded verbatim (drifting ice is the other physical line).
        // Crumbs record only while MAKING WAY: a boat that wanders a pocket at
        // wiggle speeds for minutes would flush its own entry trail out of the
        // ring; recording at >=40 u/s keeps the trail the last ~1200u of real
        // sailing, which by construction ends where the boat entered the trap.
        if (isRacing && !this.escActive && this.boat.raceState.leg >= 1
            && !this.boat.raceState.finished && this.boat.speed * 60 >= 40) {
            const cr = this.escCrumbs;
            const lc = cr.length ? cr[cr.length - 1] : null;
            if (!lc || Math.hypot(this.boat.x - lc.x, this.boat.y - lc.y) >= 20) {
                cr.push({ x: this.boat.x, y: this.boat.y });
                if (cr.length > 60) cr.shift();
            }
        }
        const escVenueOK = state.course._gridFixed && state.course._gridFixed.length
            && !(state.course._floeObjs && state.course._floeObjs.length)
            // Not in strong current: the retreat line assumes the water stands
            // still (same physical line as the arc rollout and the gybe-around).
            && (state.course._avCurMax === undefined || state.course._avCurMax < 2.0);
        if (isRacing && !this.escActive && !this.penaltySpin && escVenueOK
            && this.boat.raceState.leg >= 1 && !this.boat.raceState.finished) {
            // THE TRIGGER IS FUTILITY, NOT GEOMETRY. The measured loop class
            // (redrock mark-6 slot, 750-820s transits): nosedIn 88% of the
            // transit, slow throughout, SOLO (rivMed 1286-1660u) — but a rose
            // test never goes fully blocked (100% of blocked wiggle samples
            // still see some 220u-clear heading), and the wiggle's own minSpeed
            // bursts (18+ u/s) break any sustained-parked test. So: a leaky
            // accumulator of nosed+slow+solo seconds — the wiggle gets ~5
            // failed bursts before ESCAPE takes over.
            let stuck = false;
            const g = state.course.botGrid;
            if (g && this.boat.speed * 60 < 40) {
                let nosed = false;
                for (const dN of [90, 180]) {
                    const cc = g.cell(this.boat.x + Math.sin(this.boat.heading) * dN,
                                      this.boat.y - Math.cos(this.boat.heading) * dN);
                    if (!g.at(cc[0], cc[1])) { nosed = true; break; }
                }
                if (nosed) {
                    let rivNear = false;
                    for (const oB of state.boats) {
                        if (oB === this.boat || oB.raceState.finished) continue;
                        if (Math.hypot(oB.x - this.boat.x, oB.y - this.boat.y) < 150) { rivNear = true; break; }
                    }
                    if (!rivNear) stuck = true;
                }
            }
            if (stuck) this.escSustain += TICK;
            else this.escSustain = Math.max(0, this.escSustain - 0.5 * TICK);
            if (this.escSustain >= 25.0) {
                this.escActive = true;
                this.escTimer = 0;
                this.escSustain = 0;
                this.escCell = null;
                this.wiggleActive = false;
                this.wiggleDuration = 0;
            }
        }
        // THE PIN TRIGGER (2026-08-14 night, the tail push). `escVenueOK`'s
        // current gate (< 2.0 kt) disables the whole escape system venue-wide on
        // the river (`_avCurMax` blends to 4.96 kt against 0.5-1.2 authored) —
        // and river is exactly where boats pin: 7/144 boats spend 740-780 s in
        // CONTINUOUS bank contact, SOLO (nearest rival 3200u+), nosed-into-land
        // 99%, escSustain a literal 0 all race (`_pin_gate.js`). The wiggle's 5 s
        // beam-reach bursts own their helm and never free them. The gate was
        // written for a retreat line that dead-reckons still water; the
        // clearance-gradient WALK below has no such assumption — it re-reads the
        // boat's actual cell every step, so displacement by the stream is
        // self-correcting. So: a boat in SUSTAINED land contact that has not
        // displaced 150u in 20 s hands the helm to the walk regardless of the
        // venue's current. The displacement floor is the scope: redrock's
        // wall-crawls drift ~27 u/s and reset it, so only true pins qualify.
        if (isRacing && !this.escActive && !this.penaltySpin
            && state.course._gridFixed && state.course._gridFixed.length
            && !(state.course._floeObjs && state.course._floeObjs.length)
            && this.boat.raceState.leg >= 1 && !this.boat.raceState.finished) {
            if (this.iceEscapeTimer > 0 && this.boat.speed * 60 < 40) {
                if (this._pinX == null) { this._pinT = 0; this._pinX = this.boat.x; this._pinY = this.boat.y; }
                this._pinT += TICK;
                if (Math.hypot(this.boat.x - this._pinX, this.boat.y - this._pinY) > 150) {
                    this._pinT = 0; this._pinX = this.boat.x; this._pinY = this.boat.y;
                } else if (this._pinT > 20.0) {
                    this.escActive = true;
                    this.escTimer = 0;
                    this.escSustain = 0;
                    this.escCell = null;
                    this.wiggleActive = false;
                    this.wiggleDuration = 0;
                    this._pinT = 0; this._pinX = null;
                }
            } else {
                this._pinT = 0; this._pinX = null;
            }
        }
        if (this.escActive) {
            this.escTimer += TICK;
            let done = this.escTimer > 20.0;
            if (!done) {
                for (const oB of state.boats) {
                    if (oB === this.boat || oB.raceState.finished) continue;
                    if (Math.hypot(oB.x - this.boat.x, oB.y - this.boat.y) < 120) {
                        // ⚠️ A PINNED NEIGHBOUR DOES NOT VETO THE WALK. This abort
                        // exists because gradient-walking blind past a boat under way
                        // is the Freezing-Robot hazard — but river 9502 showed two
                        // boats grinding the same bank AND each other (749 boat
                        // contacts each), where this line locked BOTH walks forever:
                        // each boat was the other's <120u rival, so each pin trigger
                        // fired and instantly self-cancelled, 770 s at 6-18 u/s. A
                        // rival that is itself quasi-stationary in sustained contact
                        // (latched, under 40 u/s) is part of the pin, not traffic;
                        // walking clear of it is the only move either boat has.
                        const oC = oB.controller;
                        const oPinned = oC && (oC.iceEscapeTimer || 0) > 0 && oB.speed * 60 < 40;
                        if (!oPinned) { done = true; break; }
                    }
                }
            }
            if (!done && this.boat.speed * 60 > 40) {
                const gA = state.course.botGrid;
                let nosedA = false;
                if (gA) for (const dN of [90, 180]) {
                    const cc = gA.cell(this.boat.x + Math.sin(this.boat.heading) * dN,
                                       this.boat.y - Math.cos(this.boat.heading) * dN);
                    if (!gA.at(cc[0], cc[1])) { nosedA = true; break; }
                }
                if (!nosedA) done = true; // escaped: un-nosed and making way
            }
            if (done) {
                this.escActive = false;
            } else {
                // THE CLEARANCE-GRADIENT WALK. Ray roses failed at hull scale:
                // sampling at 60u+ calls headings clear whose first 30u holds
                // land (v3: spd spikes 0→40→4, boat pinned in a ±30u slot).
                // The honest sensor at this scale is the grid itself: step to
                // the SAILABLE neighbor cell with the highest clearance value
                // (BFS distance-to-land, monotone uphill to open water by
                // construction), aim at its CENTER (clearance-checked at build
                // time — hull-safe), recompute as cells are crossed. Diagonal
                // steps require both orthogonal neighbors open (no corner
                // threading); radius-2 fallback if the boat's ring is sealed.
                const gE = state.course.botGrid;
                if (gE) {
                    if (!gE._clear && window.SailCheck && window.SailCheck.clearanceField)
                        gE._clear = window.SailCheck.clearanceField(gE);
                    const cB = gE.cell(this.boat.x, this.boat.y);
                    let bi = -1, bj = -1, bScore = -1e9;
                    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
                        if (!di && !dj) continue;
                        const a = cB[0] + di, b = cB[1] + dj;
                        if (!gE.at(a, b)) continue;
                        if (di && dj && (!gE.at(cB[0] + di, cB[1]) || !gE.at(cB[0], cB[1] + dj))) continue;
                        const clr = gE._clear ? gE._clear[b * gE.n + a] : 1;
                        const cont = (this.escCell && a === this.escCell[0] && b === this.escCell[1]) ? 0.6 : 0;
                        if (clr + cont > bScore) { bScore = clr + cont; bi = a; bj = b; }
                    }
                    if (bi < 0) {
                        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
                            if (Math.max(Math.abs(di), Math.abs(dj)) !== 2) continue;
                            const a = cB[0] + di, b = cB[1] + dj;
                            if (!gE.at(a, b)) continue;
                            const clr = gE._clear ? gE._clear[b * gE.n + a] : 1;
                            if (clr > bScore) { bScore = clr; bi = a; bj = b; }
                        }
                    }
                    if (bi >= 0) {
                        this.escCell = [bi, bj];
                        const wE = gE.world(bi, bj);
                        desiredHeading = Math.atan2(wE[0] - this.boat.x, -(wE[1] - this.boat.y));
                        speedRequest = 1.0;
                    }
                }
                if (window.__escLog) window.__escLog.push({
                    t: +state.race.timer.toFixed(1), id: this.boat.id,
                    x: Math.round(this.boat.x), y: Math.round(this.boat.y),
                    spd: +((this.boat.speed || 0) * 60).toFixed(0),
                    nCr: this.escCrumbs.length
                });
            }
        }

        // Wiggle / Unstick Logic (Overrides Strategy)
        // Eagerness is a fact about the VENUE. On land venues (Glacier Sound)
        // eager wiggles are what break up shore rafts — a 5s trigger was A/B'd
        // and cost 8 points of DNS. On open venues a slow boat is jammed in the
        // FLEET, not on rocks, and the old lazy trigger (an accidental 18s real,
        // via the 6x-slow clock this replaced) is what the start pack is tuned
        // around — eager wiggles there cost Clubhouse +2s at the line.
        const wiggleAfter = (state.course._gridFixed && state.course._gridFixed.length) ? 3.0 : 18.0;
        if (this.lowSpeedTimer > wiggleAfter && !this.wiggleActive && !this.escActive) {
            this.wiggleActive = true;
            // Land venues: quick 5s bursts (shore rafts need cadence). Open venues:
            // the tuned effective duration the 6x-slow clock actually shipped.
            this.wiggleDuration = (state.course._gridFixed && state.course._gridFixed.length) ? 5.0 : 30.0;

            // Determine best wiggle direction (Away from nearest obstacle)
            let closestObs = null;
            let minD = Infinity;
            // Check boats
            for (const b of state.boats) {
                if (b === this.boat) continue;
                const dSq = (b.x - this.boat.x)**2 + (b.y - this.boat.y)**2;
                if (dSq < minD) { minD = dSq; closestObs = b; }
            }
            // Check marks
            if (state.course.marks) {
                for (const m of state.course.marks) {
                    const dSq = (m.x - this.boat.x)**2 + (m.y - this.boat.y)**2;
                    if (dSq < minD) { minD = dSq; closestObs = m; }
                }
            }

            // MID-ROUNDING: wiggle the way ROUND (see the escape's tie-break — a
            // wrong-way wiggle refunds hard-won sweep).
            const rsW = this.boat.raceState;
            const rmW = legRoundMark(rsW.leg) || state.course.roundMark;
            if (rmW && rsW.roundArmed && !rsW.finished
                && Math.hypot(this.boat.x - rmW.x, this.boat.y - rmW.y) < rmW.zone * 1.5) {
                const sgnW = rmW.side === 'port' ? -1 : 1;
                const brgW = Math.atan2(this.boat.y - rmW.y, this.boat.x - rmW.x);
                const txW = -Math.sin(brgW) * sgnW, tyW = Math.cos(brgW) * sgnW;
                const lwW = getWindAt(this.boat.x, this.boat.y).direction;
                const w1 = Math.sin(lwW + 1.75) * txW - Math.cos(lwW + 1.75) * tyW;
                const w2 = Math.sin(lwW - 1.75) * txW - Math.cos(lwW - 1.75) * tyW;
                this.wiggleSide = w1 >= w2 ? 1 : -1;
            } else
            // If we've been stuck a long time, the smart logic failed. Try Random.
            if (this.lowSpeedTimer > 8.0) {
                 this.wiggleSide = (Math.random() > 0.5) ? 1 : -1;
            } else if (closestObs && minD < 100*100) {
                const angleToObs = Math.atan2(closestObs.x - this.boat.x, -(closestObs.y - this.boat.y)); // 0=Up
                const relAngle = normalizeAngle(angleToObs - this.boat.heading);
                this.wiggleSide = relAngle > 0 ? -1 : 1; // If Right, go Left
            } else {
                this.wiggleSide = (Math.random() > 0.5) ? 1 : -1;
            }
        }

        if (this.escActive) {
            // desiredHeading/speedRequest already set by the ESCAPE branch above;
            // navigation and wiggle stand down while the maneuver runs.
        } else if (this.wiggleActive) {
            this.wiggleDuration -= TICK;

            // LOCAL wind, not the course-centroid blend. On a venue whose regions
            // differ across the water (Glacier Sound: 60-140°), the global direction
            // aimed the "beam reach" escape ~17° off the true wind — in irons, pinned
            // for the whole wiggle. Everywhere else the two are identical.
            const windDir = getWindAt(this.boat.x, this.boat.y).direction;
            if (this.boat.raceState.leg === 0) {
                // Start unstick: a stuck boat in the pack must NOT beam-reach hundreds
                // of units off the line (that turns a brief jam into a 40-90s recovery
                // and dominates the mean start time). Instead nudge close-hauled TOWARD
                // the line — up if we're behind it, down if we're over it — offset to
                // one side to slip out of the traffic, so we clear the pack while
                // staying on the line.
                const above = this.getLineDistance() > 0;
                const toward = above ? (windDir + Math.PI) : windDir;
                desiredHeading = normalizeAngle(toward + this.wiggleSide * (above ? 0.6 : 0.85));
            } else {
                // Beam Reach +/- 100 degrees (Slightly downwind to shed power if needed)
                desiredHeading = normalizeAngle(windDir + this.wiggleSide * 1.75); // ~100 degrees
            }

            // FORCE SPEED BOOST to overcome friction/pinning
            speedRequest = 1.0;

            if (this.wiggleDuration <= 0) {
                this.wiggleActive = false;
                // If STILL stuck, this wiggle failed. Don't reset timer fully so we trigger again immediately.
                // Flip sides only every SECOND failure: alternating every time just
                // reverses a half-built escape and dumps the momentum it earned.
                if (this.lowSpeedTimer > 5.0) {
                     this.wiggleFails = (this.wiggleFails || 0) + 1;
                     if (this.wiggleFails % 2 === 0) this.wiggleSide *= -1;
                } else {
                     this.lowSpeedTimer = 0; // Success
                     this.wiggleFails = 0;
                     // Land venues: short, or the escape carries the boat hundreds of
                     // units off its route. Open venues: the tuned effective value.
                     this.clearanceTimer = (state.course._gridFixed && state.course._gridFixed.length) ? 1.5 : 18.0;
                     this.clearanceHeading = desiredHeading; // Keep sailing this way
                }
            }
        } else if (this.clearanceTimer > 0) {
            this.clearanceTimer -= TICK;
            desiredHeading = this.clearanceHeading;
            speedRequest = 1.0;
        } else {
            this.wiggleTimer = 0;
            // 1. Navigation (Where do we want to go?)
            const nav = this.getNavigationTarget();
            this._lastNav = nav;

            // 2. Strategy (Tack/Gybe/Laylines)
            desiredHeading = this.getStrategicHeading(nav);
        }

        // 3. Prestart Override
        if (isPrestart) {
            const startCmd = this.getStartCommand();
            if (startCmd.target) {
                // Use strategic navigation to reach the start target (handles tacking/VMG)
                desiredHeading = this.getStrategicHeading(startCmd.target);
            } else {
                desiredHeading = startCmd.heading;
            }
            speedRequest = startCmd.speed;
        }

        // 3.5 One-Turn Penalty execution: when flagged, find a moment with sea
        // room and spiral through a full 360°. Start conditions: racing leg,
        // no boat within 160u (or the deadline has passed — take it anyway),
        // and no imminent threat. Once spinning, commit; pause only for an
        // IMMINENT collision (accumulator keeps net progress across pauses).
        const rsP = this.boat.raceState;
        if (rsP.penalty && isRacing && rsP.leg >= 1 && !rsP.finished) {
            if (!this.penaltySpin) {
                let nearest = Infinity; let nbBoat = null;
                for (const other of state.boats) {
                    if (other === this.boat || other.raceState.finished) continue;
                    const d2 = (other.x - this.boat.x) ** 2 + (other.y - this.boat.y) ** 2;
                    if (d2 < nearest) { nearest = d2; nbBoat = other; }
                }
                // Never start a spiral near a mark: fouls cluster at roundings,
                // and a 360 swept there hits the mark (fresh foul, loop risk).
                let markNear = false;
                if (state.course.marks) {
                    for (const m of state.course.marks) {
                        if ((m.x - this.boat.x) ** 2 + (m.y - this.boat.y) ** 2 < 220 * 220) { markNear = true; break; }
                    }
                }
                const clear = nearest > 120 * 120;
                // A 360 needs water that can hold it. In OPEN water (no drifting
                // pack) the turn is cheap and the wait is what costs — bay rub
                // attribution: 57% of boat contacts involve a penalty carried a
                // median 7.9s, because a flagged boat is give-way to everyone
                // under Rule 21 and respected by none. In a FLOE FIELD the
                // premise inverts: sea room is scarce, spinning among ice is
                // expensive, and waiting is the right call. Measured both ways —
                // the same shortened deadline that wins on bay cost arctic 5 of
                // 43 in-time finishes, and the stricter sea-room ask cost a
                // paired median of 44 seconds there.
                const openWater = !(state.course._floeObjs && state.course._floeObjs.length);
                const deadline = rsP.penaltyFlagTime > (openWater ? 6 : 12);
                // Never spiral against the ICE either. A 360 needs a boat-length
                // circle of clear water; taken while pinned in a floe pocket it
                // grinds the whole turn against the pack (fresh contacts, fresh
                // fouls, and a spinning boat blocking everyone else's escape).
                // Even past the deadline, wait for sea room.
                let iceNear = false;
                const gclr = state.course.botGrid;
                if (gclr) {
                    // `_clear` is lazily built by pathSailable, so on a venue that
                    // never routes through tight water this guard was silently
                    // dead. Build it — but only in open water, so ice venues stay
                    // byte-identical.
                    if (openWater && !gclr._clear && window.SailCheck && window.SailCheck.clearanceField)
                        gclr._clear = window.SailCheck.clearanceField(gclr);
                    if (gclr._clear) {
                        const c = gclr.cell(this.boat.x, this.boat.y);
                        const need = openWater ? 5 : 3;
                        if (gclr.at(c[0], c[1]) && gclr._clear[c[1] * gclr.n + c[0]] < need) iceNear = true;
                    }
                }
                // CLEAR OUT FIRST (open water only). The deadline used to mean
                // "spin in traffic anyway" — and the rub attribution says that is
                // where the contacts are: 78% of bay rub episodes involve a boat
                // mid-penalty, 77% under a knot, in the lane. The missing action is
                // to LEAVE the lane: past the deadline with a boat inside 120u,
                // steer away from the nearest boat (kept out of the no-go so she
                // does not stall in front of the pack), and take the spin the
                // moment she is clear — or at a hard deadline regardless, so the
                // +15s un-taken penalty can never become the cheaper strategy.
                // ⚠️ Ice venues keep the OLD condition byte-for-byte: sea room is
                // scarce there, waiting is right, and the 12s deadline was priced
                // on arctic finishes (5 in-time over 32 seeds against a shorter one).
                const hardDeadline = rsP.penaltyFlagTime > 14;
                const spinNow = openWater ? (clear || hardDeadline) : (clear || deadline);
                if (!markNear && !iceNear && spinNow && this.riskState !== 'IMMINENT' && this.riskState !== 'HIGH') {
                    // Spin away from the nearest boat's side; default starboard-round.
                    this.penaltySpin = true;
                    this.penaltySpinDir = (rsP.penaltyRot !== 0) ? Math.sign(rsP.penaltyRot) : 1;
                } else if (openWater && deadline && !clear && nbBoat) {
                    let awayH = Math.atan2(this.boat.x - nbBoat.x, -(this.boat.y - nbBoat.y));
                    const wDcl = getWindAt(this.boat.x, this.boat.y).direction;
                    const twaCl = normalizeAngle(awayH - wDcl);
                    if (Math.abs(twaCl) < 0.7) awayH = normalizeAngle(wDcl + (twaCl >= 0 ? 0.7 : -0.7));
                    desiredHeading = awayH;
                    speedRequest = 1.0;
                    // no return: avoidance still runs — she is give-way to everyone.
                }
            }
            if (this.penaltySpin && this.riskState !== 'IMMINENT') {
                desiredHeading = normalizeAngle(this.boat.heading + this.penaltySpinDir * 1.2);
                speedRequest = 1.0;
                this.targetHeading = desiredHeading;
                this.speedLimit = speedRequest;
                return; // committed: skip avoidance while spiraling in clear water
            }
        } else if (this.penaltySpin) {
            this.penaltySpin = false; // cleared (or race state changed) — resume racing
        }

        // Rule 16 grace: when OUR intended course changes MATERIALLY (a tack,
        // gybe, or big bear-away — not lift/header trim jitter, which happens
        // near-constantly and starved the foul detector), a keep-clear boat
        // must get time to respond before we can claim it forced us to act.
        if (this.prevDesired == null) this.prevDesired = desiredHeading;
        if (Math.abs(normalizeAngle(desiredHeading - this.prevDesired)) > 0.5) this.rule16Grace = 1.0;
        else if (this.rule16Grace > 0) this.rule16Grace -= dt;
        this.prevDesired = desiredHeading;

        // 4. Collision Avoidance (Reactive Layer)
        // Adjust desiredHeading to avoid immediate threats
        desiredHeading = this.applyAvoidance(desiredHeading, speedRequest);

        // No-contact foul (RRS "keep clear" definition): a boat keeps clear
        // only if the right-of-way boat can sail her course with NO NEED to
        // take avoiding action. When we are the stand-on boat and avoidance
        // has us sustainedly >20° off our intended course at HIGH+ risk, the
        // give-way boat has broken her rule — contact or not. Guards:
        //  - Rule 15: role/pairing must be stable >1.5s (a newly obligated
        //    boat gets room to respond).
        //  - Rule 16: no claim within 1.5s of our own sharp course change.
        //  - Rule 18: no claim against a boat entitled to mark-room from us.
        //  - per-pair 20s cooldown; racing only (prestart is too dense).
        const RU = (typeof window !== 'undefined' && window.__RULES) ? window.__RULES : {};
        const DEV = RU.dev != null ? RU.dev : 0.35;
        const HOLD = RU.hold != null ? RU.hold : 0.8;
        // GRACE is only a flicker guard: forcing is front-loaded in an
        // encounter, and the HOLD accumulation itself is the Rule 15 proof —
        // a give-way boat that kept forcing for HOLD seconds had room and
        // time to respond and didn't take it.
        const GRACE = RU.grace != null ? RU.grace : 0.3;
        if (isRacing && this.avoidanceRole === 'STAND_ON' &&
            (this.riskState === 'HIGH' || this.riskState === 'IMMINENT') &&
            this.threatBoat && !this.threatBoat.raceState.finished &&
            !this.threatBoat.raceState.penalty &&
            !(this.threatRowRes && this.threatRowRes.markRoom === this.threatBoat.id)) {
            const cd = (this.foulCooldowns && this.foulCooldowns[this.threatBoat.id]) || 0;
            const eligible = this.roleStableTime > GRACE && !(this.rule16Grace > 0) && state.time > cd;
            // Leaky accumulator: deviation oscillates tick-to-tick as the cost
            // function re-picks candidates, so charge while forced and bleed
            // (rather than reset) between — a hard reset never reached HOLD.
            // ...and she must actually have NEEDED to act. See applyAvoidance for the
            // measurement that says why this guard exists.
            const needed = this.properCourseCPA != null && this.properCourseCPA < FOUL_NEED_GAP;
            if (eligible && needed && this.lastAvoidDeviation > DEV) {
                this.forcedAvoidTimer = Math.min((this.forcedAvoidTimer || 0) + 0.1, 1.5);
                if (this.forcedAvoidTimer >= HOLD) {
                    const info = this.threatRowRes ? { rule: this.threatRowRes.rule, reason: this.threatRowRes.reason, kind: 'no_contact' } : { kind: 'no_contact' };
                    triggerPenalty(this.threatBoat, info);
                    this.foulCooldowns = this.foulCooldowns || {};
                    this.foulCooldowns[this.threatBoat.id] = state.time + 20;
                    this.forcedAvoidTimer = 0;
                }
            } else {
                this.forcedAvoidTimer = Math.max(0, (this.forcedAvoidTimer || 0) - 0.05);
            }
        } else {
            this.forcedAvoidTimer = Math.max(0, (this.forcedAvoidTimer || 0) - 0.1);
        }

        // 3.7 Local trajectory refinement through drifting ice — see
        // planFloeTrajectory. Strategy picked WHERE to sail; this picks the line
        // through the next nine seconds of moving pack. Escapes and wiggles keep
        // priority (they own genuinely stuck boats).
        this._trajFloe = false;
        if (isRacing && !isPrestart && !this.wiggleActive && !this.escActive
            && !(this.clearanceTimer > 0)
            && !(this.iceEscapeTimer > 0) && this._lastNav
            && state.course._gridFixed && state.course._gridFixed.length) {
            const tj = this.planFloeTrajectory(desiredHeading, this._lastNav);
            if (tj != null) { desiredHeading = tj; this._trajFloe = true; }
        }

        // Island / floe contact override — same reflex as mark contact below. The
        // rocks have already taken 60% of our speed per frame of overlap; commit a
        // short turn straight away from the contact normal. Runs AFTER avoidance on
        // purpose: in a raft-up the neighbours' collision costs veto every escape
        // heading and the whole raft freezes (measured: DNS tripled when this fed
        // through the cost function).
        // While the stuck-state maneuver is active it OWNS the helm: the
        // contact reflex is the very ping-pong (bounce off each wall toward
        // the other) that keeps the wedged boat looping — measured: with the
        // reflex in charge, three different ESCAPE aims produced byte-equal
        // 785/768/693s loops because this override discarded them every tick.
        if (!this.escActive
            && this.boat.ai.collisionData && this.boat.ai.collisionData.type === 'island') {
             const col = this.boat.ai.collisionData;
             if (this.boat.speed < 1.0 || !this.iceEscapeTimer || this.iceEscapeTimer <= 0) {
                 // A RE-HIT MEANS THE FACET ANSWER ALREADY FAILED (2026-08-14, the
                 // tail push). Mask walls are rough: a hull sliding along one hits
                 // the SIDE faces of its bumps, and each bump's minimal push axis is
                 // PARALLEL to the macroscopic wall (measured: |axis . wall-tangent|
                 // median 1.00 over 240 chain intervals). Latching the escape to it
                 // commands the boat ALONG the face at ~3u standoff; she re-grounds
                 // every ~63u at a 2.3 s period against a ~5.5 s knockdown-recovery
                 // constant — the slow tail's cascade (re-hit share 10% fast
                 // quartile vs 64% slow; ALL 843 slow-tail episodes on one wall).
                 // The unconditional macro-outward (treeCHAIN) halved land contact
                 // and cut p95 by 35 s but taxed the MEDIAN +7: isolated brushes
                 // paid a perpendicular detour they never needed. So the gate is
                 // the cascade's own definition: only a SECOND hit within the
                 // measured chain window gets the macro "out" — the clearance-field
                 // gradient, the same BFS distance-to-land the stuck-escape's
                 // gradient walk already trusts. First touches keep today's facet
                 // reflex. Floes keep it always (drifting-ice line, and floe venues
                 // never build _clear); moving water keeps it always (the landed
                 // ground-frame ranking owns that regime).
                 // Episode granularity (the measurement's own 1 s merge): the
                 // reflex re-arms every frame of a sustained overlap, so a raw
                 // "<6 s since last arm" would grade frame 2 of a FIRST brush as
                 // a re-hit. A new EPISODE begins after >1 s clear; it is a
                 // re-hit iff the previous episode ended less than 6 s ago, and
                 // the choice is latched for the whole episode.
                 const nowH = state.race.timer;
                 const gapH = this._lastReflexT == null ? Infinity : nowH - this._lastReflexT;
                 this._lastReflexT = nowH;
                 if (gapH > 1.0) this._reflexReHit = (gapH < 6.0);
                 const reHit = !!this._reflexReHit;
                 let outVX = -col.normal.x, outVY = -col.normal.y;
                 const gW = state.course.botGrid;
                 if (reHit && !col.isFloe
                     && gW && window.SailCheck && window.SailCheck.clearanceField) {
                     if (!gW._clear) gW._clear = window.SailCheck.clearanceField(gW);
                     const cB = gW.cell(this.boat.x, this.boat.y);
                     let bi = -1, bj = -1, bScore = -1e9;
                     for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
                         if (!di && !dj) continue;
                         const a = cB[0] + di, b2 = cB[1] + dj;
                         if (!gW.at(a, b2)) continue;
                         if (di && dj && (!gW.at(cB[0] + di, cB[1]) || !gW.at(cB[0], cB[1] + dj))) continue;
                         const clr = gW._clear[b2 * gW.n + a];
                         if (clr > bScore) { bScore = clr; bi = a; bj = b2; }
                     }
                     if (bi < 0) {
                         for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
                             if (Math.max(Math.abs(di), Math.abs(dj)) !== 2) continue;
                             const a = cB[0] + di, b2 = cB[1] + dj;
                             if (!gW.at(a, b2)) continue;
                             const clr = gW._clear[b2 * gW.n + a];
                             if (clr > bScore) { bScore = clr; bi = a; bj = b2; }
                         }
                     }
                     if (bi >= 0) {
                         const wpt = gW.world(bi, bj);
                         const dxO = wpt[0] - this.boat.x, dyO = wpt[1] - this.boat.y;
                         const LO = Math.hypot(dxO, dyO);
                         if (LO > 1) { outVX = dxO / LO; outVY = dyO / LO; }
                     }
                 }
                 let escH = Math.atan2(outVX, -outVY);
                 // ESCAPE IN THE GROUND FRAME, NOT THE BOAT FRAME. Straight out
                 // along the normal is a HEADING, and a heading is not where the
                 // boat goes: updateBoat adds the stream directly into the
                 // velocity (~11859). Measured on the river (`_esc_current.js`,
                 // 3 seeds, 487k contacts, median set 3.98 kt): the stream has a
                 // component pushing her ONTO the bank on 56% of contacts, and
                 // today's commanded heading produces a TRACK that goes into the
                 // bank on 44% of them — in every one of which a sailable heading
                 // with an outward track existed (the best averaged ~100 u/s, and
                 // "no heading escapes" was 0.0%). She was steering out and being
                 // set in. On redrock, where nothing flows, the same measurement
                 // reads 1.5%, which is why this is gated on there being a stream
                 // at all — and gated on the SAME `speed > 0.01` the physics uses
                 // to decide whether to apply current, so it fires exactly where
                 // the water actually moves her and nowhere else.
                 const curE = getCurrentAt(this.boat.x, this.boat.y);
                 if (curE && curE.speed > 0.01) {
                     const outXc = outVX, outYc = outVY; // facet unless a re-hit gradient replaced it
                     const cU = (curE.speed / 4) * 60;
                     const cvx = Math.sin(curE.direction) * cU;
                     const cvy = -Math.cos(curE.direction) * cU;
                     const lwC = getWindAt(this.boat.x, this.boat.y);
                     let bestT = -Infinity;
                     for (const off of ESC_TWAS) {
                         const h = normalizeAngle(lwC.direction + off);
                         // PLAN ON THE BOAT SHE HAS, NOT THE ONE THE POLAR DESCRIBES.
                         // This ranks candidate TRACKS, and a track is speed times
                         // heading plus the stream — so the speed term decides how
                         // much the heading matters at all. The polar value here is
                         // ~99 u/s; measured at the instant of contact on river
                         // (`_ground_drive.js`, 344k contacts) the boat has 7.2 u/s
                         // against a 52 u/s stream, and 0.3 u/s when this reflex is
                         // driving alone. At the assumed speed every candidate looks
                         // like it escapes (the model's own no-escape rate is 0.0%);
                         // at the real one, 63.7% of contacts have NO escaping
                         // heading and the argmax is ranking fiction. Cap the polar
                         // at what the boat is actually doing so the ranking reflects
                         // the true track, and where nothing escapes it picks the
                         // least-bad instead of a confident wrong answer.
                         const pol = getTargetSpeed(Math.abs(off), false, lwC.speed) * 0.25 * 60;
                         const v = Math.min(pol, (this.boat.speed || 0) * 60);
                         const tOut = (Math.sin(h) * v + cvx) * outXc
                                    + (-Math.cos(h) * v + cvy) * outYc;
                         if (tOut > bestT) { bestT = tOut; escH = h; }
                     }
                 }
                 // MID-ROUNDING, ESCAPE THE WAY ROUND. An escape that reverses the
                 // rotation refunds sweep the boat bled for (measured +0.6 -> -0.85).
                 // Near the zone, pick the sailable heading that is both outward and
                 // toward the required rotation tangent.
                 const rsE = this.boat.raceState;
                 const rmE = legRoundMark(rsE.leg) || state.course.roundMark;
                 if (rmE && rsE.roundArmed && !rsE.finished
                     && Math.hypot(this.boat.x - rmE.x, this.boat.y - rmE.y) < rmE.zone * 1.5) {
                     const outX = outVX, outY = outVY; // facet unless a re-hit gradient replaced it
                     const sgnE = rmE.side === 'port' ? -1 : 1;
                     const brgE = Math.atan2(this.boat.y - rmE.y, this.boat.x - rmE.x);
                     // Sweeping: bias along the rotation tangent. OUTBOUND (sweep
                     // banked): bias RADIALLY OUT — the tangent bias that saved the
                     // sweep was trapping banked boats in eternal orbit under the
                     // shell, escape after escape curving them around instead of out.
                     const tx = this._outbound ? Math.cos(brgE) : -Math.sin(brgE) * sgnE;
                     const ty = this._outbound ? Math.sin(brgE) : Math.cos(brgE) * sgnE;
                     const lwE = getWindAt(this.boat.x, this.boat.y).direction;
                     let bestS = -Infinity;
                     for (const off of [1.05, -1.05, 1.75, -1.75]) {
                         const h = normalizeAngle(lwE + off);
                         const sc = (Math.sin(h) * outX - Math.cos(h) * outY)
                                  + 0.7 * (Math.sin(h) * tx - Math.cos(h) * ty);
                         if (sc > bestS) { bestS = sc; escH = h; }
                     }
                 }
                 this.iceEscapeHeading = escH;
                 this.iceEscapeTimer = 2.0;
             }
        }
        if (this.iceEscapeTimer > 0 && !this.escActive) {
             this.iceEscapeTimer -= TICK;
             desiredHeading = this.iceEscapeHeading;
             speedRequest = 1.0;
        }

        // Mark Collision Override (Immediate Turn Away + Latch)
        if (this.boat.ai.collisionData && this.boat.ai.collisionData.type === 'mark') {
             const col = this.boat.ai.collisionData;
             // Normal points from Boat to Mark.
             // We want to head away from mark.
             const awayX = -col.normal.x;
             const awayY = -col.normal.y;

             // If we are stuck (slow) or just hit it, calculate escape
             if (this.boat.speed < 0.5) {
                 // SAILABLE ESCAPE, NEVER RADIAL. The old escape was the raw
                 // away-from-mark bearing; on the upwind side of a hairpin
                 // rounding that is dead into the wind, and the 12s latch below
                 // parked the boat at ~0.15 speed for its whole duration (bay
                 // L3/L5 traces: every 15-17s "park" starts at d 28-53 = mark
                 // contact). Same move as the island escape: pick the off-wind
                 // candidate that best points away from the mark — and, while
                 // armed, the way round (a wrong-way escape refunds sweep).
                 let escM = Math.atan2(awayX, -awayY);
                 const lwM = getWindAt(this.boat.x, this.boat.y).direction;
                 const rsM = this.boat.raceState;
                 const rmM = legRoundMark(rsM.leg) || state.course.roundMark;
                 const armedM = rmM && rsM.roundArmed && !rsM.finished;
                 let txM = 0, tyM = 0;
                 if (armedM) {
                     const sgnM = rmM.side === 'port' ? -1 : 1;
                     const brgM = Math.atan2(this.boat.y - rmM.y, this.boat.x - rmM.x);
                     txM = this._outbound ? Math.cos(brgM) : -Math.sin(brgM) * sgnM;
                     tyM = this._outbound ? Math.sin(brgM) : Math.cos(brgM) * sgnM;
                 }
                 let bestM = -Infinity;
                 for (const off of [1.05, -1.05, 1.75, -1.75]) {
                     const h = normalizeAngle(lwM + off);
                     const sc = (Math.sin(h) * awayX - Math.cos(h) * awayY)
                              + (armedM ? 0.7 * (Math.sin(h) * txM - Math.cos(h) * tyM) : 0);
                     if (sc > bestM) { bestM = sc; escM = h; }
                 }
                 this.markEscapeHeading = escM;
                 this._markEscFrom = { x: col.normal.x, y: col.normal.y };
                 // "2s" shipped on the 6x-slow clock — the tuned reality was a 12s
                 // commit, and the fleet's mark behavior is calibrated to it.
                 this.markContactTimer = 12.0;
             }
        }

        if (this.markContactTimer > 0) {
             this.markContactTimer -= TICK;
             // ⭐ RE-AIM THE COMMITMENT, DO NOT RELEASE IT.
             // markEscapeHeading is computed ONCE, at the instant of contact
             // (~1051), and then sailed for twelve seconds. At that instant the
             // boat is beside the mark and the rock she ends up grinding is still
             // 100-300u away, which is why giving the four-candidate argmax a land
             // term at latch time benched INERT (treeMRK2: 427 of 432 boats
             // byte-identical). She meets the land LATER, inside the commitment,
             // and nothing re-checks — the island reflex that would is written
             // above this block and overwritten by it.
             //
             // ⛔ Handing the helm to that reflex instead was tried and LOST
             // (treeMRK: pooled mean +4.9, land contacts 27.0 -> 31.2): the
             // commitment to leave the mark is doing real work. So keep the
             // commitment and re-check only its AIM, and only when the held
             // heading is provably into rock inside 140u — a boat sailing a clear
             // escape is byte-unaffected, and among blocked options the geometry
             // still orders them (least-bad, the 2cbf847 shape).
             const gR = state.course.botGrid;
             if (gR && this._markEscFrom) {
                 let blkR = 0;
                 for (let iR = 1; iR <= 4; iR++) {
                     const dR = iR * 35;
                     const ccR = gR.cell(this.boat.x + Math.sin(this.markEscapeHeading) * dR,
                                         this.boat.y - Math.cos(this.markEscapeHeading) * dR);
                     if (!gR.at(ccR[0], ccR[1])) { blkR = iR; break; }
                 }
                 if (blkR) {
                     const awX = -this._markEscFrom.x, awY = -this._markEscFrom.y;
                     const lwR = getWindAt(this.boat.x, this.boat.y).direction;
                     let bestR = -Infinity, escR = this.markEscapeHeading;
                     for (const off of [1.05, -1.05, 1.75, -1.75]) {
                         const h = normalizeAngle(lwR + off);
                         let sc = Math.sin(h) * awX - Math.cos(h) * awY;
                         for (let iR = 1; iR <= 4; iR++) {
                             const dR = iR * 35;
                             const ccR = gR.cell(this.boat.x + Math.sin(h) * dR,
                                                 this.boat.y - Math.cos(h) * dR);
                             if (!gR.at(ccR[0], ccR[1])) { sc -= 4.0 / iR; break; }
                         }
                         if (sc > bestR) { bestR = sc; escR = h; }
                     }
                     this.markEscapeHeading = escR;
                 }
             }
             desiredHeading = this.markEscapeHeading;
             speedRequest = 1.0;
        }

        // PACK SPEED DISCIPLINE. In floe-risk water an ice pilot comes down to
        // manoeuvring speed: the turn radius tightens, there is time to react to
        // drift, and a graze at half speed is a nudge instead of a stop. Depower
        // only when there is way on (never throttle an acceleration out of a
        // stall), and scale with handling so the fleet stays diverse — a deft
        // boat carries more speed through the same ice.
        // Only when trouble is actually PREDICTED (trajectory rollout saw contact
        // within ~5s) — a blanket slow-down in all risk water traded pace for
        // nothing once the planner learned to dodge.
        if (speedRequest >= 1.0 && this.boat.speed > 1.2 && !this.wiggleActive
            && !this._outbound
            && !(this.iceEscapeTimer > 0) && this._trajRisk != null && this._trajRisk < 3) {
            const deft = this.boat.stats ? Math.max(0, Math.min(1, this.boat.stats.handling / 10)) : 0.5;
            speedRequest = 0.7 + 0.15 * deft;
        }
        this._trajRisk = null;

        // FUNNEL METERING. Lake's per-leg attribution: the fleet sails legs 1-2
        // with 44s + 19s per boat UNDER ONE KNOT, and the rub ledger puts 72% of
        // its boat contacts within 400u of a mark at <1 kt, 80% involving a
        // penalty — boats sail at full speed into an occupied one-boat funnel,
        // park in the scrum, foul, and re-accelerate in light air. The action
        // that did not exist: arrive when the funnel is clear. When two or more
        // rivals on this leg are already inside 250u of the rounding we are
        // approaching (and we are 250-700u out), come down to manoeuvring speed
        // — deceleration is cheap, the parked scrum is not. Same guards as the
        // pack-speed discipline above: never throttle a boat without way on,
        // racing legs only, and deft boats keep more pace.
        // ⚠️ OPEN WATER ONLY — in a floe pack, a boat holding manoeuvring speed
        // beside a jammed rounding sits in drifting ice and takes hits for it
        // (arctic guard: boat contacts 12.1 -> 13.5, mean +4.4 unscoped). The
        // same line every other gate in this campaign sits on.
        if (speedRequest >= 1.0 && this.boat.speed > 1.2 && !this.wiggleActive
            && !this._outbound && this.boat.raceState.leg >= 1
            && !(state.course._floeObjs && state.course._floeObjs.length)) {
            const rsQ = this.boat.raceState;
            // The funnel is the LEG ENDPOINT — every leg has one (gate legs
            // included; lake's worst queues are at line marks, not the rounding).
            let rmQ = null;
            try {
                const lgsQ = state.course.dmc && state.course.dmc.legs;
                if (lgsQ && lgsQ[rsQ.leg] && lgsQ[rsQ.leg].pts.length)
                    rmQ = lgsQ[rsQ.leg].pts[lgsQ[rsQ.leg].pts.length - 1];
            } catch (e) {}
            if (!rmQ) rmQ = legRoundMark(rsQ.leg);
            if (rmQ && !rsQ.finished) {
                const dQ = Math.hypot(this.boat.x - rmQ.x, this.boat.y - rmQ.y);
                if (dQ > 250 && dQ < 700) {
                    // A JAM, not a rounding train: count only rivals who are
                    // already PARKED at the funnel (<1 kt). The raw count fired on
                    // every healthy 9-boat rounding and cost bay +5.0 paired for
                    // a 0.1 contact dent.
                    let q = 0;
                    for (const ob of state.boats) {
                        if (ob === this.boat || ob.raceState.finished) continue;
                        if (ob.raceState.leg !== rsQ.leg) continue;
                        if (ob.speed >= 1.0) continue;
                        if (Math.hypot(ob.x - rmQ.x, ob.y - rmQ.y) < 250) q++;
                    }
                    if (q >= 2) {
                        const deftQ = this.boat.stats ? Math.max(0, Math.min(1, this.boat.stats.handling / 10)) : 0.5;
                        speedRequest = 0.55 + 0.15 * deftQ;
                    }
                }
            }
            // A DEFILE MID-LEG IS THE SAME FUNNEL. Redrock's north thread is a
            // one-boat channel whose mouth sits 700-900u before the mark — the
            // endpoint count above never sees the queue parked there (outside
            // its 250u radius), and the stall probe puts 5 of 8 unfinished
            // boats at exactly that mouth at 0.1-1.9 kt. Meter on a jam at the
            // narrowest point of MY OWN planned path ahead: the first gridPath
            // point 250-700u out whose corridor is under two cells of
            // clearance, with two or more rivals already parked within 250u of
            // it. Same jam qualification, same guards, same physical line as
            // the endpoint form.
            if (speedRequest >= 1.0 && this.gridPath && this.gridPath.length) {
                const gD = state.course.botGrid;
                const clearD = gD && gD._clear;
                if (clearD) {
                    let acc = 0, px = this.boat.x, py = this.boat.y, defile = null;
                    for (const ptD of this.gridPath) {
                        acc += Math.hypot(ptD.x - px, ptD.y - py);
                        px = ptD.x; py = ptD.y;
                        if (acc > 700) break;
                        if (acc < 250) continue;
                        const cD = gD.cell(ptD.x, ptD.y);
                        if (clearD[cD[1] * gD.n + cD[0]] < 2) { defile = ptD; break; }
                    }
                    if (defile) {
                        let qD = 0;
                        for (const ob of state.boats) {
                            if (ob === this.boat || ob.isPlayer || ob.raceState.finished) continue;
                            if (ob.speed >= 1.0) continue;
                            if (Math.hypot(ob.x - defile.x, ob.y - defile.y) < 250) qD++;
                        }
                        if (qD >= 2) {
                            const deftD = this.boat.stats ? Math.max(0, Math.min(1, this.boat.stats.handling / 10)) : 0.5;
                            speedRequest = 0.55 + 0.15 * deftD;
                        }
                    }
                }
            }
        }

        // RL pilot hook (see the armed orbit) — speed half of the action.
        // __rl.actFor(boat) (fleet gate: policy drives every armed bot) takes
        // precedence over the single-hero __rl.act used by the training env.
        if (typeof window !== 'undefined' && window.__rl && this.boat.raceState.roundArmed) {
            const a = window.__rl.actFor ? window.__rl.actFor(this.boat)
                : (this.boat === window.__hero ? window.__rl.act : null);
            if (a) speedRequest = Math.min(speedRequest, Math.max(0.4, a[1]));
        }

        // Apply
        this.targetHeading = desiredHeading;
        this.speedLimit = speedRequest;

        // NEVER SWEEP THE BOW ACROSS A MARK YOU ARE ABOUT TO HIT — take the
        // turn the other way round. The m3 replay traces: the cut-in demands
        // a heading on the far side of the wind; the rudder takes the SHORT
        // way, the bow sweeps across the mark's bearing mid-arc with less
        // room than the rotation needs, and the boat pins on the face in
        // irons (51% of m3 passes). The long way (a gybe-around) keeps way
        // on and never points at the disk. Trigger, recomputed every tick
        // (no latch): on a rounding leg, close to the mark, when the
        // short-way arc crosses the mark's bearing AND the travel spent
        // rotating to that bearing exceeds the room to the berth. Floe
        // venues excluded (the pack-speed/ice machinery owns that water).
        this.turnBias = 0;
        if (this.boat.raceState.leg >= 1 && !this.boat.raceState.finished
            && !this.wiggleActive && !this.penaltySpin
            && !(state.course._floeObjs && state.course._floeObjs.length)
            // v4 scope: never in strong current — a spin in a ≥2kt set is
            // the river one-way door squared (v2: river boat contacts ×2.6,
            // fins −7/−4). The cap and the arc probe sit on the same line.
            && (state.course._avCurMax === undefined || state.course._avCurMax < 2.0)) {
            const rsG = this.boat.raceState;
            const isRoundG = state.course.route && state.course.route[rsG.leg]
                && state.course.route[rsG.leg].kind === 'round';
            const rmG = isRoundG && typeof legRoundMark === 'function' ? legRoundMark(rsG.leg) : null;
            if (rmG) {
                // v4 scope: THE LOOP NEEDS THE RING TO BE WATER — the
                // orbitTightR family's own line ("a mark qualifies only if
                // the ring is water"). Lake's cove mark is 81% water at the
                // zone radius (walls from 110u) and v2 tripled its land
                // contacts; every redrock/bay/ocean rounding mark is ~100%.
                // Cached per mark, same shape as _orbTight.
                if (rmG._gyOK === undefined) {
                    rmG._gyOK = false;
                    const gR = state.course.botGrid;
                    if (gR) {
                        const zR = rmG.zone || 165;
                        let okR = true;
                        for (let kR = 0; kR < 32; kR++) {
                            const aR = kR / 32 * Math.PI * 2;
                            const cR = gR.cell(rmG.x + Math.cos(aR) * zR, rmG.y + Math.sin(aR) * zR);
                            if (!gR.at(cR[0], cR[1])) { okR = false; break; }
                        }
                        rmG._gyOK = okR;
                    }
                }
                if (!rmG._gyOK) return;
                const dxG = rmG.x - this.boat.x, dyG = rmG.y - this.boat.y;
                const dG = Math.hypot(dxG, dyG);
                const zG = rmG.zone || 165;
                // OP5 — THE ORBIT-PHASE EASE, AT THE SCOPE THE SURVEY NAMED.
                // The m3 kill is real (v1: stalls 14→4%, the residual class
                // dies) and v1 died twice on scope: ocean's leg-1 mark-3 has
                // ZONE 1000 (boats arm a kilometre out and v1 crawled the whole
                // approach, +18s) with wall-room 15 (the mark sits ON its rock —
                // the eased circle cannot fit anyway), and lake's grinder sits
                // in 5.7 kt air (no power to sail out of the ease). The survey's
                // separators, verbatim (_op_scope_survey): WALL-ROOM ≥ 100 (the
                // eased ~100u circle must fit — static land clearance at the
                // MARK's own cell, ≥2 cells at res 50), WIND ≥ 8 kt at the boat
                // (power to accelerate out), dG < 250 (the ease is the scale of
                // the TURN, not of the zone — this alone unhooks ocean's km-out
                // arming). Mechanism unchanged from v1: mid-sweep, on the
                // pursuit circle, easing shrinks the circle the boat rides;
                // orbitTightR-null marks only (open-water rings untouched);
                // per-tick, no latch (v2's toggle and v3's overhold are closed).
                // ⚠️ ENTRY-side governors remain a separately closed family —
                // this fires only after the rotation has begun (sweep > 0.05).
                if (this.boat.raceState.roundArmed
                    && (this.boat.raceState.roundSweep || 0) > 0.05
                    && this.boat.speed > 1.2
                    && dG < 250
                    && orbitTightR(rmG) === null) {
                    if (rmG._op5Room === undefined) {
                        rmG._op5Room = false;
                        const gO5 = state.course._botGridStatic;
                        if (gO5 && window.SailCheck && window.SailCheck.clearanceField) {
                            if (!gO5._clear) gO5._clear = window.SailCheck.clearanceField(gO5);
                            const ccO5 = gO5.cell(rmG.x, rmG.y);
                            const idO5 = ccO5[1] * gO5.n + ccO5[0];
                            if (ccO5[0] >= 0 && ccO5[1] >= 0 && ccO5[0] < gO5.n && ccO5[1] < gO5.n
                                && gO5._clear[idO5] >= 2) rmG._op5Room = true;
                        }
                    }
                    if (rmG._op5Room && getWindAt(this.boat.x, this.boat.y).speed >= 8) {
                        const deftO = this.boat.stats ? Math.max(0, Math.min(1, this.boat.stats.handling / 10)) : 0.5;
                        this.speedLimit = Math.min(this.speedLimit, 0.55 + 0.15 * deftO);
                    }
                }
                // (A clearance scope was tried here — cl ≥ 4 to keep the loop
                // out of the thread — and REMOVED: the m3 pocket and the m5
                // zone are both cl 3 on a res-50 grid; the field cannot
                // separate them, and the leg-3 cost is mostly the pre-existing
                // m5 approach class fed by m3's freed traffic, the cap
                // landing's own trade shape. Judged on pooled finishers.)
                if (dG < zG * 0.95 && dG > 40) {
                    const diffG = normalizeAngle(this.targetHeading - this.boat.heading);
                    if (Math.abs(diffG) > 0.5) {
                        const hMkG = Math.atan2(dxG, -dyG);
                        const offG = normalizeAngle(hMkG - this.boat.heading);
                        const crosses = Math.sign(offG) === Math.sign(diffG)
                            && Math.abs(offG) < Math.abs(diffG);
                        if (crosses) {
                            // travel while rotating to the mark's bearing, at
                            // measured full authority (0.61 rad/s), vs the room
                            // left outside the 75u berth (50 hard + hull).
                            const vG = this.boat.speed * 60;
                            if (vG * Math.abs(offG) / 0.61 > dG - 75) {
                                this.turnBias = -Math.sign(diffG) || 0;
                                // Ease through the gybe-around: the loop's
                                // radius is v/ω — at 8 kt it is ~400u across
                                // and does not fit the pocket (v1: leg-3 med
                                // +61s, the thread cannot host fast loops);
                                // at manoeuvring speed it is ~90u and does.
                                // The turn and the throttle are one decision.
                                const deftG = this.boat.stats ? Math.max(0, Math.min(1, this.boat.stats.handling / 10)) : 0.5;
                                this.speedLimit = Math.min(this.speedLimit, 0.55 + 0.15 * deftG);
                            }
                        }
                    }
                }
            }
        }
    }

}
function updateAITrim(boat, optimalSailAngle, dt) {
    // Basic AI Trim: Adjust towards optimal at a fixed rate
    const trimSpeed = 1.0; // Radians per second
    let target = optimalSailAngle;

    if (boat.ai.forcedLuff > 0) {
        target = optimalSailAngle + boat.ai.forcedLuff * (Math.PI / 2.0);
    }

    const current = boat.manualSailAngle;
    const diff = target - current;
    const step = trimSpeed * dt;

    if (Math.abs(diff) < step) boat.manualSailAngle = target;
    else boat.manualSailAngle += Math.sign(diff) * step;

    boat.sailAngle = boat.manualSailAngle * boat.boomSide;
}

function getFavoredEnd() {
    const marks = state.course.marks;
    if(!marks || marks.length < 2) return 0;
    const [m0, m1] = startLinePts();

    // Wind Direction (From)
    const wd = state.wind.direction;
    // Upwind Vector (Towards Wind) -> Opposite of From
    // From 0 (N) -> Blows S. Upwind is N (0, -1).
    const ux = Math.sin(wd);
    const uy = -Math.cos(wd);

    // Project mark positions onto upwind vector
    const d0 = m0.x * ux + m0.y * uy;
    const d1 = m1.x * ux + m1.y * uy;

    return (d1 > d0) ? 1 : 0;
}
function updateAI(boat, dt) {
    if (boat.isPlayer) return;

    if (!boat.controller) {
        boat.controller = new BotController(boat);
    }

    boat.controller.update(dt);

    // Apply Output
    const timeScale = dt * 60;
    const target = boat.controller.targetHeading;
    const speedLimit = boat.controller.speedLimit;

    // Smooth turn
    const diff = normalizeAngle(target - boat.heading);
    let aiTurnRate = getTurnSpeed() * timeScale;

    // Apply Handling Stat (AI)
    // +/- 15% -> 3% per point
    aiTurnRate *= (1.0 + boat.stats.handling * 0.03);

    // Speed-dependent rudder authority (mushy when slow, crisp at speed).
    aiTurnRate *= steerageFactor(boat);

    // Wiggle / Force Mode: Super Steering (overrides steerage to break free)
    // ESCAPE gets the same snap-turn authority: a wedged boat has no steerage
    // and the multi-point retreat is impossible without it.
    // THE CONTACT REFLEX IS THE SAME CASE and was the one escape left out. A
    // boat aground is a wedged boat by the definition this comment already uses:
    // `collision_island` takes 60% of her speed EVERY FRAME of overlap, so she
    // sits at a few u/s on the steerage floor of 0.6 — 0.015 * 0.6 * 60 ~= 31
    // deg/s. Measured (`_spin_ground.js`): the commanded escape heading is stable
    // (median 0.0 deg of change per frame, so the reflex is NOT chasing a
    // jittering normal), the helm stands ~51 deg away from it, and the median
    // grinding episode is 2.8s — the escape turn took as long as the grind it was
    // meant to end. Same 5x the other two get; no new number.
    // SCOPED OFF THE PENALTY SPIRAL, and that scoping is not cosmetic:
    // `iceEscapeTimer` is decremented in exactly one place (below, inside
    // applyAvoidance) and a penalised boat returns before it, so the latch
    // FREEZES for the whole spin. Unscoped, this would hand 5x turn rate to the
    // spiral — ~2s per 360 deg against a base spiral of ~10s — on the arbitrary
    // subset of boats that happened to touch land in the previous 2s.
    // ...AND THE MARK LATCH GETS THE SAME AUTHORITY (2026-08-21, the owner's
    // rounding scenario): a boat pinned ON A MARK at ~0.1kt has a correct,
    // sailable markEscapeHeading and no steerage to turn to it — the contact
    // speed-kill keeps her at jam speed, jam speed keeps her from turning,
    // and she parked on the buoy for 4+ seconds (Rule 31 grinding the whole
    // way) while land-pinned boats snap out at 5x one latch over. Scoped off
    // the penalty spiral for the same rule-29 reason as iceEscapeTimer: the
    // mark block sits below penaltySpin's early return, so the latch FREEZES
    // during a spin and would otherwise hand the spiral 5x authority.
    if (boat.controller && (boat.controller.wiggleActive || boat.controller.escActive
        || ((boat.controller.iceEscapeTimer > 0 || boat.controller.markContactTimer > 0)
            && !boat.controller.penaltySpin))) {
        aiTurnRate = getTurnSpeed() * timeScale * (1.0 + boat.stats.handling * 0.03) * 5.0; // Snap turn
    }

    // CREW-LEVEL RL HOOK (inert in play/eval: only a headless harness installs
    // window.__rlCrew). The policy owns EXECUTION of the tactician's command —
    // signed turn rate toward targetHeading and sail power — never the command
    // itself. Authority is bounded by the same physics as the classical crew:
    // the steerage/handling-capped turn rate, and a power ceiling at the
    // commanded speedLimit (the throttle is a tactician decision; the crew may
    // spill extra to execute a maneuver but never power past the command).
    // Wiggle keeps the classical snap-turn (escape ownership stays untouched).
    let crewAct = null;
    if (typeof window !== 'undefined' && window.__rlCrew && !boat.controller.wiggleActive) {
        crewAct = window.__rlCrew.actFor ? window.__rlCrew.actFor(boat) : null;
    }
    if (crewAct) {
        const turnCmd = Math.max(-1, Math.min(1, crewAct[0]));
        boat.heading += turnCmd * aiTurnRate;
        boat.heading = normalizeAngle(boat.heading);
        const power = Math.max(0, Math.min(crewAct[1], speedLimit < 0.9 ? speedLimit : 1));
        boat.ai.forcedLuff = 1.0 - power;
    } else {
    // If very far off, turn faster?
    // TURN DIRECTION IS A DECISION, NOT ALWAYS THE SHORT WAY. The controller
    // sets turnBias (±1) when the short-way arc would sweep the bow across a
    // mark it cannot clear (the m3 in-irons face pin); while set, rotate that
    // way at full authority. The bias is recomputed every tick and vanishes
    // once the short way agrees with the rotation (diff sign flips past π),
    // so there is no latch to go stale.
    const biasT = boat.controller && boat.controller.turnBias;
    const turnAmt = biasT
        ? biasT * aiTurnRate
        : Math.sign(diff) * Math.min(Math.abs(diff), aiTurnRate);
    boat.heading += turnAmt;
    boat.heading = normalizeAngle(boat.heading);

    // Speed / Luff
    if (speedLimit < 0.9) {
        boat.ai.forcedLuff = 1.0 - speedLimit;
    } else {
        boat.ai.forcedLuff = 0;
    }
    }

    // Spinnaker logic — decided in APPARENT, and on the wind HERE.
    //
    // Two things were wrong. It used `state.wind.direction`, the route-centroid blend (its own
    // comment said "Approximate"), so a boat in a bend of the breeze set its kite by a wind
    // 2 km away. And it used the TRUE angle, which is not what the decision is about: a kite
    // fills when the apparent has gone aft enough, so the faster the boat the DEEPER she has
    // to sail before it will draw. That is why a quick boat carries one lower than a slow one.
    //
    // AWA_SPINNAKER is calibrated to be roughly where the old TWA 117-degree rule already
    // fired in mid conditions (16 kt, 7.5 kt of boat speed) — phase 0 changes the SHAPE of
    // the decision, not its typical position.
    const aWind = boat.apparentWind || getWindAt(boat.x, boat.y);
    const windAngle = Math.abs(normalizeAngle(aWind.direction - boat.heading));
    const drawing = windAngle > (boat.spinnaker ? AWA_KITE_DOUSE : AWA_KITE_SET);
    // No hysteresis on `speedLimit`, deliberately. It is not a wind condition — it is the
    // AI's throttle, and below 0.9 the bot answers it by FORCE-LUFFING (`forcedLuff` in
    // updateAITrim eases the sheet up to 90 degrees past optimal). Holding the kite through
    // that window put boats on a run flying a spinnaker while deliberately spilling it:
    // trim quality 0.64 on the run against 0.93-0.99 everywhere else, and 1.5 knots gone.
    boat.spinnaker = drawing && speedLimit > 0.8;
}

