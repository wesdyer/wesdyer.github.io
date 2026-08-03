// Game Configuration
const CONFIG = {
    turnSpeed: 0.015, // Radians per frame (~51°/s at full authority). Deliberately
                      // ~50% above realistic keelboat rates: on a 3-4 min compressed
                      // course, responsiveness (crash tacks, duck-or-die calls) beats
                      // realism — and it measured faster AND cleaner for the AI fleet
                      // (race -7s, mark hits -55%). Fine trim stays on Shift (0.25x).
    turnPenalty: 0.9999,
    cameraPanSpeed: 1.25,
    cameraRotateSpeed: 0.01,
    windSpeed: 5,
    waterColor: '#3b82f6',
    boatColor: '#f8fafc',
    sailColor: '#ffffff',
    cockpitColor: '#cbd5e1',
};

// ── Canvas type ────────────────────────────────────────────────────────────
// Mirrors the .t-* system in index.html so text painted on the water belongs to
// the same product as the DOM chrome. Canvas has no CSS fallback chain worth
// trusting: if the webfont hasn't loaded when ctx.font is set, it silently
// resolves to the OS default and stays there for that paint. FONTS_READY flips
// once document.fonts settles; until then these strings still name the family,
// so the only cost of an early frame is a fallback glyph set.
const FONT = {
    // Label voice — Archivo 800 caps. Names, chips, anything titling a thing.
    label:   (px) => `800 ${px}px Archivo, sans-serif`,
    // Data voice — IBM Plex Mono 600, tabular. Every number.
    mono:    (px) => `600 ${px}px "IBM Plex Mono", ui-monospace, monospace`,
    // Display voice — Saira 900 italic. Course geometry callouts.
    display: (px) => `italic 900 ${px}px Saira, Archivo, sans-serif`,
    // Brand voice — the club name curved on the course boundary.
    brand:   (px) => `900 ${px}px Archivo, sans-serif`,
};
let FONTS_READY = false;
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { FONTS_READY = true; });
}

// AI Sayings System
const Sayings = {
    queue: [],
    current: null,
    timer: 0,
    silenceTimer: 0,
    overlay: null,
    img: null,
    name: null,
    text: null,

    init: function() {
        this.overlay = document.getElementById('ai-saying-overlay');
        this.img = document.getElementById('ai-saying-img');
        this.name = document.getElementById('ai-saying-name');
        this.text = document.getElementById('ai-saying-text');
    },

    queueQuote: function(boat, type) {
        if (!boat || boat.isPlayer) return;
        if (this.queue.length >= 3) return;
        if (!this.overlay) this.init();

        const quotes = typeof AI_QUOTES !== 'undefined' ? AI_QUOTES[boat.name] : null;
        let rawQuote = quotes ? quotes[type] : null;
        // Archetype behavior triggers fall back to generic archetype lines so
        // every character voices its style even without bespoke quotes.
        if (!rawQuote && typeof ARCHETYPE_CALLS !== 'undefined' && ARCHETYPE_CALLS[type]) {
            const lines = ARCHETYPE_CALLS[type];
            rawQuote = lines[Math.floor(Math.random() * lines.length)];
        }
        if (!rawQuote) return;

        let text = rawQuote;
        if (typeof rawQuote === 'object') {
            const options = ['short', 'medium', 'long'];
            const length = options[Math.floor(Math.random() * options.length)];
            text = rawQuote[length];
        }

        this.queue.push({ boat, text });
    },

    update: function(dt) {
        this.silenceTimer += dt;

        if (this.current) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.hide();
            }
        } else if (this.queue.length > 0) {
            const item = this.queue.shift();
            this.show(item);
        } else if (this.silenceTimer > 10.0 && state.race.status !== 'finished') {
            const candidates = state.boats.filter(b => !b.isPlayer && !b.raceState.finished);
            if (candidates.length > 0) {
                const boat = candidates[Math.floor(Math.random() * candidates.length)];
                let type = 'random';
                if (state.race.status === 'prestart') type = 'prestart';
                this.queueQuote(boat, type);
            }
            this.silenceTimer = 0;
        }
    },

    show: function(item) {
        this.current = item;
        this.timer = 2.0;
        this.silenceTimer = 0;

        if (this.overlay && this.img && this.name && this.text) {
            this.img.src = "assets/images/competitors/" + item.boat.name.toLowerCase() + ".png";
            const color = isVeryDark(item.boat.colors.hull) ? item.boat.colors.spinnaker : item.boat.colors.hull;
            this.img.style.borderColor = color;
            this.name.textContent = item.boat.name;
            this.name.style.color = color;
            this.text.textContent = `"${item.text}"`;

            this.overlay.classList.remove('hidden');
            requestAnimationFrame(() => {
                 this.overlay.classList.remove('translate-y-4', 'opacity-0');
            });
        }
    },

    hide: function() {
        if (this.overlay) {
             this.overlay.classList.add('translate-y-4', 'opacity-0');
             setTimeout(() => {
                 if (this.current === null) this.overlay.classList.add('hidden');
             }, 500);
             this.current = null;
        } else {
            this.current = null;
        }
    }
};

// Seeded RNG Helper
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

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
            if (this.boat.speed * 4 < 1.0) {
                this.lowSpeedTimer += TICK;
            } else if (this.boat.speed * 4 > 2.5) { // Only reset if truly moving fast
                this.lowSpeedTimer = 0;
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
                // Bank a BUFFER before turning for the exit: the fight out through
                // the ring in a 25-knot katabatic costs ~0.2-0.4 rad of unwind, and
                // leaving at exactly the requirement meant arriving outside it.
                if ((rsL.roundSweep || 0) >= needL + 0.25) this._outbound = true;
                else if ((rsL.roundSweep || 0) < needL * 0.8) this._outbound = false;
                if (this._outbound) { this.wiggleActive = false; this.wiggleDuration = 0; }
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
        if (this.lowSpeedTimer > wiggleAfter && !this.wiggleActive) {
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

        if (this.wiggleActive) {
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
                let nearest = Infinity;
                for (const other of state.boats) {
                    if (other === this.boat || other.raceState.finished) continue;
                    const d2 = (other.x - this.boat.x) ** 2 + (other.y - this.boat.y) ** 2;
                    if (d2 < nearest) nearest = d2;
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
                const deadline = rsP.penaltyFlagTime > 12;
                // Never spiral against the ICE either. A 360 needs a boat-length
                // circle of clear water; taken while pinned in a floe pocket it
                // grinds the whole turn against the pack (fresh contacts, fresh
                // fouls, and a spinning boat blocking everyone else's escape).
                // Even past the deadline, wait for sea room.
                let iceNear = false;
                const gclr = state.course.botGrid;
                if (gclr && gclr._clear) {
                    const c = gclr.cell(this.boat.x, this.boat.y);
                    if (gclr.at(c[0], c[1]) && gclr._clear[c[1] * gclr.n + c[0]] < 3) iceNear = true;
                }
                if (!markNear && !iceNear && (clear || deadline) && this.riskState !== 'IMMINENT' && this.riskState !== 'HIGH') {
                    // Spin away from the nearest boat's side; default starboard-round.
                    this.penaltySpin = true;
                    this.penaltySpinDir = (rsP.penaltyRot !== 0) ? Math.sign(rsP.penaltyRot) : 1;
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
            if (eligible && this.lastAvoidDeviation > DEV) {
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
        if (isRacing && !isPrestart && !this.wiggleActive && !(this.clearanceTimer > 0)
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
        if (this.boat.ai.collisionData && this.boat.ai.collisionData.type === 'island') {
             const col = this.boat.ai.collisionData;
             if (this.boat.speed < 1.0 || !this.iceEscapeTimer || this.iceEscapeTimer <= 0) {
                 let escH = Math.atan2(-col.normal.x, col.normal.y);
                 // MID-ROUNDING, ESCAPE THE WAY ROUND. An escape that reverses the
                 // rotation refunds sweep the boat bled for (measured +0.6 -> -0.85).
                 // Near the zone, pick the sailable heading that is both outward and
                 // toward the required rotation tangent.
                 const rsE = this.boat.raceState;
                 const rmE = legRoundMark(rsE.leg) || state.course.roundMark;
                 if (rmE && rsE.roundArmed && !rsE.finished
                     && Math.hypot(this.boat.x - rmE.x, this.boat.y - rmE.y) < rmE.zone * 1.5) {
                     const outX = -col.normal.x, outY = -col.normal.y;
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
        if (this.iceEscapeTimer > 0) {
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
                 this.markEscapeHeading = Math.atan2(awayX, -awayY);
                 // "2s" shipped on the 6x-slow clock — the tuned reality was a 12s
                 // commit, and the fleet's mark behavior is calibrated to it.
                 this.markContactTimer = 12.0;
             }
        }

        if (this.markContactTimer > 0) {
             this.markContactTimer -= TICK;
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
    }

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
                void nextPath;
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
                        let da = (this._entryBrg - myBrg) * sgnR;
                        while (da < 0) da += Math.PI * 2;
                        while (da >= Math.PI * 2) da -= Math.PI * 2;
                        if (da > 0.4 && da < Math.PI * 2 - 0.4) {
                            // Ride the ring the required way toward the chosen sector.
                            const aNext = myBrg + sgnR * 0.55;
                            destX = rm.x + Math.cos(aNext) * rm.zone * 1.35;
                            destY = rm.y + Math.sin(aNext) * rm.zone * 1.35;
                        } else {
                            // On the sector: cut in.
                            destX = rm.x + Math.cos(this._entryBrg) * rm.zone * 0.72;
                            destY = rm.y + Math.sin(this._entryBrg) * rm.zone * 0.72;
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
                if (!entryHandled && rm && rs.roundArmed) {
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
                        const RA = Math.min(rm.zone * 1.6, Math.max(rm.zone * 0.85, dRm - 80));
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
                const RR = (typeof CoursePath !== 'undefined' && state.course.botGrid)
                    ? Math.min(rm.zone * 1.15, CoursePath._roundR(rm, state.course.botGrid) + 45)
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
                        const idT = pc[1] * botGrid.n + pc[0];
                        if (botGrid._soft && botGrid._soft[idT]) continue;
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
                const seg = window.SailCheck.pathSailable(botGrid, [boat.x, boat.y], [destX, destY]);
                if (seg && seg.length > 1) {
                    const pts = seg.map(q => ({ x: q[0], y: q[1] }));
                    pts[pts.length - 1] = { x: destX, y: destY };
                    this.gridPath = pts.slice(1);   // drop the boat's own cell
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
                const w = (j >= pts.length - 1) ? { x: destX, y: destY } : pts[j];
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
            if (localWind.speed > J111_PLANING.minTWS) {
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

    getLineDistance() {
        const [m0, m1] = startLinePts();
        return hullLineOffset(this.boat, m0, m1, false); // positive = above/upwind of line
    }

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

        // Pre-cross: get to the staging point in our lane and hold there.
        if (behind > STAGE + 35) {
            return { target: { x: stageX, y: stageY }, speed: 0.75 };
        }
        return { heading: wd, speed: 0.9 };
    }


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
                // +45 -> +14 (human clearance floor is 14-19u to the HULL; this
                // radius is on the fatter bounding circle, so 14 keeps real
                // slack. +10 tested worse: rollouts stopped flagging contacts
                // the boat could not actually dodge).
                const rr = f.radius + 14;
                    if ((x - fx) * (x - fx) + (y - fy) * (y - fy) < rr * rr) {
                        if (t < contactT) contactT = t;
                    }
                }
            }
            if (contactT < Infinity) score -= contactW * Math.max(0, 1 - contactT / T);
            score += (x - boat.x) * ux + (y - boat.y) * uy;
            return { score, contactT };
        };

        const base = roll(0);
        this._trajRisk = base.contactT;   // speed discipline reads this
        // Deviate only for REAL trouble, and only for clearly better lines: micro
        // dodges around 6-9s-away floes made the track a permanent zigzag (made-good
        // ratio ~0.3 at full boat speed).
        if (base.contactT > 4.5) return null;
        let bestOff = 0, bestScore = base.score + 50;
        for (const off of [0.15, -0.15, 0.35, -0.35, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3, 1.7, -1.7]) {
            const r = roll(off);
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
    applyAvoidance(desiredHeading, speedRequest) {
        // If stuck (Wiggle Mode), ignore avoidance to force breakout
        this.lastAvoidDeviation = 0;
        if (this.wiggleActive) return desiredHeading;

        const boat = this.boat;
        const lookaheadFrames = 240; // 4 seconds lookahead
        const speed = Math.max(2.0, boat.speed * 60); // Minimum speed for projection

        // Candidates: more granular to find gaps
        const candidates = [
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
            candidates.push(2.2, -2.2, 3.0, -3.0);
        }

        let bestHeading = desiredHeading;
        let minCost = Infinity;

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

        for (const offset of candidates) {
            const h = normalizeAngle(desiredHeading + offset);
            
            // Base Cost: Deviation from desired course
            // Non-linear cost to strongly prefer small deviations
            let cost = Math.pow(Math.abs(offset), 1.5) * 10;

            // RRS Rule 16/14: Stand-on boat holds course...
            // but Rule 14 requires evasive action when "it becomes clear
            // the other boat is not keeping clear."
            // MEDIUM: Full hold-course — give-way boat still has time to act.
            // HIGH: Reduced hold-course — give-way boat may not be keeping
            //       clear; begin accepting evasion per Rule 14.
            // IMMINENT: No hold-course bonus — pure Rule 14 emergency avoidance.
            if (this.avoidanceRole === 'STAND_ON') {
                if (this.riskState === 'MEDIUM') {
                    cost += Math.abs(offset) * 3000 * jamF;
                } else if (this.riskState === 'HIGH') {
                    cost += Math.abs(offset) * 1000 * jamF;
                }
            }

            // Project position at t=lookahead
            const vx = Math.sin(h) * speed;
            const vy = -Math.cos(h) * speed;
            const futureX = boat.x + vx * (lookaheadFrames / 60);
            const futureY = boat.y + vy * (lookaheadFrames / 60);

            let boatCollision = false;
            let staticCollision = false; // Marks/Boundary
            let ruleViolation = false;
            let proximityCost = 0;

            // 1. Boats - Check multiple points along the path
            const boatSamples = 5;
            for (const other of state.boats) {
                if (other === boat || other.raceState.finished) continue;
                
                const ovx = (other.velocity && other.velocity.x) ? other.velocity.x * 60 : Math.sin(other.heading)*other.speed*60;
                const ovy = (other.velocity && other.velocity.y) ? other.velocity.y * 60 : -Math.cos(other.heading)*other.speed*60;

                // Strategic Positioning (Duck Stern / Go Above)
                if (this.avoidanceRole === 'GIVE_WAY' && (this.riskState === 'MEDIUM' || this.riskState === 'HIGH')) {
                    const t = lookaheadFrames / 60;
                    const myFut = { x: futureX, y: futureY };
                    const otherFut = { x: other.x + ovx * t, y: other.y + ovy * t };
                    const dx = myFut.x - otherFut.x;
                    const dy = myFut.y - otherFut.y;

                    if (dx*dx + dy*dy < 250*250) {
                        const oh = other.heading;
                        const ofx = Math.sin(oh), ofy = -Math.cos(oh);
                        const dotForward = dx * ofx + dy * ofy;

                        // Penalize crossing bow (dotForward > 0), Reward ducking (dotForward < 0)
                        if (dotForward > 0) cost += 1500 * jamF;
                        else cost -= 800 * jamF;
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

                // Check along the path (5 points)
                for (let i = 1; i <= boatSamples; i++) {
                    const t = i * (1.0/boatSamples) * (lookaheadFrames / 60);

                    const myPx = boat.x + vx * t; // t in seconds
                    const myPy = boat.y + vy * t;

                    const otherP = {
                        x: other.x + ovx * t,
                        y: other.y + ovy * t
                    };

                    const distSq = (myPx - otherP.x)**2 + (myPy - otherP.y)**2;
                    
                    if (distSq < safeDist * safeDist) {
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
                    } else if (distSq < 250 * 250 && this.livenessState === 'normal') {
                        // Soft avoidance (Proximity)
                        proximityCost += 5000 / (distSq + 10);
                    }
                }
            }

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
                const segLen = Math.hypot(futureX - boat.x, futureY - boat.y);
                const stepsAv = Math.max(2, Math.min(8, Math.ceil(segLen / (gAv.res * 0.6))));
                for (let sI = 1; sI <= stepsAv; sI++) {
                    const frac = sI / stepsAv;
                    const cc = gAv.cell(boat.x + (futureX - boat.x) * frac,
                                        boat.y + (futureY - boat.y) * frac);
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
                        // NEAR-TERM blockage is a wall; FAR blockage along a straight
                        // 4-second probe is not — a probe that overshoots a gap into
                        // the ice behind it must not veto the gap the router chose.
                        // Hard zone is a fixed DISTANCE (a couple of boat-lengths of
                        // turning room), not a fraction: at speed, 40% of the probe
                        // was 190u and vetoed every thread the pack offered.
                        if (frac * segLen <= 140) { staticCollision = true; cost += 500000; }
                        else { proximityCost += 30000 * (1 - frac); }
                        break;
                    }
                }
                if (!staticCollision && gAv._clear) {
                    const ce = gAv.cell(futureX, futureY);
                    const idAv = ce[1] * gAv.n + ce[0];
                    const clr = gAv._clear[idAv];
                    if (clr > 0 && clr < 3) proximityCost += 10000 * (1 - clr / 3);
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
                    if (isl.isFloe && this._trajFloe) continue;
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
                        const nearHit = Geom.segmentIntersectsPoly(startS, midS, isl.vertices)
                            || (isl.isFloe && Geom.distToSegment({x: isl.x, y: isl.y}, startS, midS) < isl.radius + movePad * 0.6);
                        const farHit = !nearHit && (Geom.segmentIntersectsPoly(midS, endS, isl.vertices)
                            || (isl.isFloe && d < isl.radius + movePad * 0.6));
                        if (nearHit) {
                            staticCollision = true;
                            cost += 500000; // HUGE penalty (Hard Constraint)
                        } else if (farHit) {
                            proximityCost += 25000;
                        } else {
                            // Proximity penalty (Buffer zone)
                            // Use Circle approx for proximity cost
                            const band = 80 + movePad;
                            if (d < isl.radius + band) {
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
                cost -= 60;
            }
            // A near-reversal is an emergency manoeuvre, not a preference. Its
            // pow(|offset|,1.5) base cost is pocket change next to collision terms,
            // which is correct in an emergency and wrong the rest of the time. A
            // boat with way on shouldn't throw it away; a stuck boat may need to.
            if (Math.abs(offset) > 1.8 && this.boat.speed > 1.0) cost += 250;

            if (cost < minCost) {
                minCost = cost;
                bestHeading = h;
            }
        }
        this._lastAvoidChoice = bestHeading;
        
        // Expose how far avoidance pushed us off our intended course — the
        // no-contact foul detector reads this as "avoiding action taken".
        this.lastAvoidDeviation = Math.abs(normalizeAngle(bestHeading - desiredHeading));
        return bestHeading;
    }
}


// AI Configuration
// --- Racing Archetypes ---------------------------------------------------
// Each AI character has ONE archetype: a persona layer of behavioral traits
// consumed by BotController, plus a threat/weakness line surfaced to the
// player. Design rule: every archetype changes HOW the boat races, paired
// with an exploitable weakness — never a flat power boost. All trait values
// default to current fleet behavior (DEFAULT_TRAITS) so an archetype only
// diverges where it means to.
//   aggro        -1..1  avoidance margin scale (+ = shaves give-way bubbles)
//   startBufAdj  secs   added to the start crossing-run buffer (+ = commits earlier)
//   shiftSense   x      multiplier on the lift/header tack bonus
//   windFast     x      multiplier on the wind-tracker EMA rate (faster read)
//   pressureSense x     multiplier on the pressure-seeking bonus
//   cornerScale  x      multiplier on gate approach inset (<1 = aims closer to the mark)
//   cornerRound  x      multiplier on the rounding offset — KEEP >= 1.0 unless you
//                       want mark contact; tight offsets clip the mark, and with
//                       turn-penalties each clip costs a ~15-25s spiral episode
//   sideCommit   0/1    gambler: pick a side of the beat per leg and bang it
//   cover        0..1   leech: bonus for matching the nearest rival's tack
//   laylineTight x      multiplier on the layline trigger window (<1 = calls it later/closer)
//   overTack     x      divisor on tack stickiness (>1 = tacks more, pays the manoeuvre)
//   roundTurn    u|null  override of the rounding carve pull (fleet default 80)
//
// speedScale (a flat boatspeed multiplier, used only by shift at 0.97) was REMOVED.
// Measured over 1200 paired seeds it cost the archetype 4.68s +/-0.94 while every
// other archetype sat within +/-1.0s of zero: a ~6.45s tax against 1.77s of benefit
// from the reading traits. A flat multiplier is the bluntest possible nerf — it
// taxes every second of the race whether or not the advantage is expressing — so
// shift's weakness is now situational instead (see overTack). guidelines/skills.md 3.3.
const DEFAULT_TRAITS = { aggro: 0, startBufAdj: 0, shiftSense: 1.0, windFast: 1.0, pressureSense: 1.0, cornerScale: 1.0, cornerRound: 1.0, sideCommit: 0, cover: 0, laylineTight: 1.0, overTack: 1.0, roundTurn: null };

const ARCHETYPES = {
    bully: {
        label: 'Line Bully',
        threat: 'Crowds rivals into flinching first — gives you no room at the start or in traffic.',
        weakness: 'Runs hot: the fights cost penalties and pace. Stay clean and sail past the wreckage.',
        traits: { aggro: 0.7 },
    },
    rocket: {
        label: 'Rocket Start',
        threat: 'First off the line almost every race and gone with clear air.',
        weakness: 'Fades once the fleet reaches full speed — reel them in mid-leg and hold your lane.',
        traits: { startBufAdj: -0.1 },
    },
    shift: {
        label: 'Shift Whisperer',
        threat: 'Reads the wind before anyone. In shifty air, going the other way is usually wrong.',
        weakness: 'Slow in a straight line — beat them on pure pace when the breeze goes steady.',
        traits: { shiftSense: 1.5, windFast: 1.4, pressureSense: 1.15, overTack: 1.35 },
    },
    freight: {
        label: 'Freight Train',
        threat: 'Carries speed nothing can stop — never cross them late.',
        weakness: 'Wide, lumbering roundings — attack at every mark.',
        traits: { cornerScale: 1.25, cornerRound: 1.25, laylineTight: 1.1 },
    },
    corner: {
        label: 'Corner Artist',
        threat: 'Surgical mark roundings — gains boat lengths at every gate.',
        weakness: 'Backs off in a crowd — lean on them and they yield the lane.',
        traits: { cornerScale: 0.85, aggro: -0.15, roundTurn: 130 },
    },
    gambler: {
        label: 'Corner Gambler',
        threat: 'Bangs a corner of the course. When the shift favors them, they come back untouchable.',
        weakness: 'Ignores the wind to get there — most days the corner buries them.',
        traits: { sideCommit: 1, shiftSense: 0.4 },
    },
    leech: {
        label: 'The Leech',
        threat: 'Locks onto the nearest rival and matches every tack, sitting on their wind.',
        weakness: 'Loses time shadowing — split hard and stretch them past their patience.',
        traits: { cover: 0.8 },
    },
    metronome: {
        label: 'Metronome',
        threat: 'Never blinks, never blunders — always in the hunt at the finish.',
        weakness: 'No spikes: one well-timed risk is worth more than their whole race.',
        traits: { laylineTight: 0.85, startBufAdj: -0.05 },
    },
};

// Generic archetype call-outs used when a character has no bespoke quote for
// a behavior trigger (bully engaging, gambler picking a side, leech locking on).
const ARCHETYPE_CALLS = {
    bully_engage: ["My water. Find another lane!", "You do NOT want this fight.", "Coming through — flinch or foul."],
    side_pick: ["I like the look of that corner.", "See you at the shift, suckers.", "All in. One side, one story."],
    cover_lock: ["Nice wind you've got there. Mine now.", "Wherever you go, I go.", "You tack, I tack. Simple."],
};

// The full stat set. The first seven are performance; the last three are the
// conditions/craft axes added in the roster rework (guidelines/skills.md 4).
const STAT_DEFAULTS = {
    acceleration: 0, momentum: 0, handling: 0, upwind: 0, reach: 0, downwind: 0, pressure: 0,
    lightAir: 0, heavyAir: 0, memory: 0
};
// Only the performance stats take the difficulty bonus. A flat +4 on lightAir AND
// heavyAir would make every AI boat good at both extremes at once — a fleet-wide
// power boost, not a difficulty setting. And "+4 memory" is not a difficulty at all:
// a longer retention window is a trade-off (slow to notice real change), not an
// improvement, so scaling it with difficulty would be meaningless.
const BONUS_STATS = ['acceleration', 'momentum', 'handling', 'upwind', 'reach', 'downwind', 'pressure'];

// Wind-groove bands for lightAir / heavyAir. Quadratic in normalised depth into the
// band because marginal difficulty escalates: 9 knots versus 10 is nothing, 6 versus
// 7 is everything; 17 knots is manageable, 20 is a handful. Moderate air (10-16) is
// untouched by both, so the other stats decide a mid-range race.
const WIND_GROOVE = { lightFull: 6, lightNone: 10, heavyNone: 16, heavyFull: 20, perPoint: 0.012 };
function windGrooveFactor(stats, wind) {
    const g = WIND_GROOVE;
    let f = 1.0;
    if (stats.lightAir && wind < g.lightNone) {
        const t = Math.min(1, (g.lightNone - wind) / (g.lightNone - g.lightFull));
        f += stats.lightAir * g.perPoint * t * t;
    }
    if (stats.heavyAir && wind > g.heavyNone) {
        const t = Math.min(1, (wind - g.heavyNone) / (g.heavyFull - g.heavyNone));
        f += stats.heavyAir * g.perPoint * t * t;
    }
    return Math.max(0.5, f);
}

// Difficulty: flat bonus added to every performance stat of every AI boat at construction.
// The player's boat has all-zero stats, so this makes the whole fleet faster
// and sharper without changing character-to-character balance or archetype
// identities. 0 = original difficulty; each point is worth roughly 1.2-1.8%
// boatspeed depending on point of sail, plus accel/handling/gust response.
const AI_STAT_BONUS = 4;

const AI_CONFIG = [
    { name: 'Cheer', creature: 'Pom Pom Crab', hull: '#FF9ECF', spinnaker: '#00E5FF', spinnaker2: '#FF9ECF', spinnaker3: '#FFE066', sail: '#FFFFFF', cockpit: '#FFFFFF', personality: "Cheerful and fun loving, always positive and enthuiastic.", beat: 'Out-spike her steady beat — she has no pace off the wind.', archetype: 'metronome', stats: { acceleration: 2, momentum: -2, handling: 4, upwind: 1, reach: -2, downwind: -1, pressure: 5, lightAir: 2, heavyAir: -1, memory: -1 } },
    { name: 'Bixby', creature: 'Sea Otter', hull: '#0046ff', spinnaker: '#FFD400', spinnaker2: '#0046ff', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Relaxed veteran who instinctively finds perfect wind." , beat: 'Beat him to the top mark — upwind he is merely mortal.', archetype: 'shift', stats: { acceleration: -2, momentum: -3, handling: -1, upwind: 0, reach: 3, downwind: 5, pressure: 1, lightAir: 1, heavyAir: 2, memory: 5 } },
    { name: 'Skim', creature: 'Flying Fish', hull: '#8FD3FF', spinnaker: '#FF2D95', spinnaker2: '#FFFFFF', spinnaker3: '#8FD3FF', sail: '#FFFFFF', cockpit: '#AEB4BF', personality: "Flashy opportunist thriving on speed bursts." , beat: 'Survive her start, then turn hard and often — she hates corners.', archetype: 'rocket', stats: { acceleration: 5, momentum: 0, handling: -4, upwind: 0, reach: -4, downwind: -1, pressure: 0, lightAir: 4, heavyAir: -4, memory: -2 } },
    { name: 'Wobble', creature: 'Platypus', hull: '#FF8C1A', spinnaker: '#7B4FD4', spinnaker2: '#FF8C1A', sail: '#FFFFFF', cockpit: '#B0B0B0', personality: "Awkward, unpredictable, deadly effective in chaos." , beat: 'Ignores the wind to get there — sail the middle and collect.', archetype: 'gambler', stats: { acceleration: 5, momentum: -1, handling: -2, upwind: -3, reach: 3, downwind: 0, pressure: 4, lightAir: 2, heavyAir: -2, memory: 1 } },
    { name: 'Pinch', creature: 'American Lobster', hull: '#E10600', spinnaker: '#FFFFFF', spinnaker2: '#E10600', sail: '#FFFFFF', cockpit: '#5A5A5A', personality: "Aggressive bully dominating the starting line." , beat: 'Stay clean upwind, then walk away downwind — he parks there.', archetype: 'bully', stats: { acceleration: 1, momentum: -2, handling: 0, upwind: 2, reach: -1, downwind: -5, pressure: 2, lightAir: -2, heavyAir: 2, memory: 3 } },
    { name: 'Bruce', creature: 'Great White Shark', hull: '#121212', spinnaker: '#ff0606', spinnaker2: '#000000', sail: '#FFFFFF', cockpit: '#3A3A3A', personality: "Cold, relentless presence forcing others to react." , beat: 'Force restarts and tacking duels — he cannot get moving again.', archetype: 'bully', stats: { acceleration: -5, momentum: -4, handling: -5, upwind: 1, reach: 3, downwind: 4, pressure: 2, lightAir: -4, heavyAir: 5, memory: 3 } },
    { name: 'Strut', creature: 'Flamingo', hull: '#FF4F9A', spinnaker: '#1A1A1A', spinnaker2: '#FF4F9A', spinnaker3: '#FFFFFF', sail: '#FFFFFF', cockpit: '#B0BEC5', personality: "Stylish confidence with daring, showy sailing." , beat: 'Push her into maneuvers — every turn costs her the strut.', archetype: 'metronome', stats: { acceleration: -3, momentum: -3, handling: -5, upwind: 5, reach: -2, downwind: 1, pressure: 2, lightAir: 2, heavyAir: -1, memory: 0 } },
    { name: 'Gasket', creature: 'American Beaver', hull: '#FFE600', spinnaker: '#1F6FB2', spinnaker2: '#FFE600', sail: '#000000', cockpit: '#C4BEB2', personality: "Methodical and stubborn, grinding out advantages." , beat: 'Match him upwind, pull away when the spinnakers go up.', archetype: 'metronome', stats: { acceleration: 3, momentum: -3, handling: 3, upwind: 0, reach: 0, downwind: -4, pressure: -3, lightAir: 4, heavyAir: -3, memory: 4 } },
    { name: 'Chomp', creature: 'Saltwater Crocodile', hull: '#2ECC71', spinnaker: '#9CBF28', spinnaker2: '#1A1A1A', sail: '#000000', cockpit: '#C1B58A', personality: "Patient hunter striking without warning." , beat: 'Tack early, tack often — the ambusher cannot follow through turns.', archetype: 'leech', stats: { acceleration: 2, momentum: 3, handling: -5, upwind: 1, reach: -3, downwind: -2, pressure: 0, lightAir: 4, heavyAir: 1, memory: 3 } },
    { name: 'Whiskers', creature: 'Walrus', hull: '#C49A6C', spinnaker: '#8E0038', spinnaker2: '#FFFFFF', spinnaker3: '#C49A6C', sail: '#FFFFFF', cockpit: '#ddd3c9', personality: "Massive, steady, unbeatable in heavy conditions." , beat: 'Attack every rounding and reach — the train needs straight track.', archetype: 'freight', stats: { acceleration: -2, momentum: 4, handling: 2, upwind: 0, reach: -5, downwind: 4, pressure: -3, lightAir: -4, heavyAir: 5, memory: 2 } },
    { name: 'Vex', creature: 'Water Dragon', hull: '#0fe367', spinnaker: '#D9D9D9', spinnaker2: '#0fe367', sail: '#FFFFFF', cockpit: '#D0D0D0', personality: "Slippery tactician exploiting tiny mistakes." , beat: 'Lean on him mid-leg — away from corners he is out of tricks.', archetype: 'corner', stats: { acceleration: -3, momentum: -5, handling: 4, upwind: -4, reach: -5, downwind: 1, pressure: 4, lightAir: 2, heavyAir: -1, memory: 2 } },
    { name: 'Hug', creature: 'Ochre Sea Star', hull: '#9900ff', spinnaker: '#E8A6FF', spinnaker2: '#FF9E2C', spinnaker3: '#9900FF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Chill vibes, relentless endurance." , beat: 'Get ahead early — Hug finishes everything she starts, slowly.', archetype: 'metronome', stats: { acceleration: -3, momentum: 1, handling: 0, upwind: 5, reach: 2, downwind: 2, pressure: 5, lightAir: 1, heavyAir: -2, memory: -5 } },
    { name: 'Ripple', creature: 'Bottlenose Dolphin', hull: '#00B3FF', spinnaker: '#FFD400', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#B8C6D1', personality: "Cheerful speedster seeking clean lanes." , beat: 'Drag her into traffic — clean lanes are where she lives.', archetype: 'shift', stats: { acceleration: -2, momentum: -1, handling: -3, upwind: 4, reach: -4, downwind: 5, pressure: 0, lightAir: 0, heavyAir: 2, memory: 5 } },
    { name: 'Clutch', creature: 'Red Rock Crab', hull: '#B00020', spinnaker: '#FFD166', spinnaker2: '#B00020', sail: '#FFFFFF', cockpit: '#6B6B6B', personality: "Defensive and stubborn off the line." , beat: 'Do not engage — sail past while he is busy starting fights.', archetype: 'bully', stats: { acceleration: -5, momentum: 2, handling: -4, upwind: 4, reach: -5, downwind: -2, pressure: 0, lightAir: -1, heavyAir: 1, memory: 0 } },
    { name: 'Glide', creature: 'Wandering Albatross', hull: '#E8F1F8', spinnaker: '#1F4FFF', spinnaker2: '#FFFFFF', spinnaker3: '#B8CEE0', sail: '#000000', cockpit: '#C5CED6', personality: "Patient perfectionist who never blunders." , beat: 'Perfect upwind, lost downwind — make the runs count.', archetype: 'metronome', stats: { acceleration: -4, momentum: 3, handling: 2, upwind: 4, reach: 1, downwind: -5, pressure: 1, lightAir: 3, heavyAir: 4, memory: 3 } },
    { name: 'Fathom', creature: 'Orca', hull: '#1C1C3C', spinnaker: '#3D8BFF', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#3C3F55', personality: "Silent dominance unleashed at full power." , beat: 'Turn the race into corners — momentum cannot help him there.', archetype: 'freight', stats: { acceleration: 0, momentum: 5, handling: -5, upwind: 3, reach: 4, downwind: 4, pressure: 2, lightAir: 0, heavyAir: 5, memory: 5 } },
    { name: 'Scuttle', creature: 'Hermit Crab', hull: '#FFB703', spinnaker: '#3A86FF', spinnaker2: '#FFB703', sail: '#000000', cockpit: '#BFAF92', personality: "Erratic survivor thriving in congestion." , beat: 'Deny the chaos — in a clean race he is just slow.', archetype: 'gambler', stats: { acceleration: -4, momentum: -3, handling: -3, upwind: -3, reach: 1, downwind: -2, pressure: 5, lightAir: 2, heavyAir: -1, memory: -1 } },
    { name: 'Finley', creature: 'Yellowfin Tuna', hull: '#0077B6', spinnaker: '#ffd900', spinnaker2: '#0077B6', sail: '#FFFFFF', cockpit: '#A7B8C8', personality: "Pure speed and relentless pressure." , beat: 'Break cover downwind — his speed lives on the beat.', archetype: 'leech', stats: { acceleration: -2, momentum: -3, handling: -3, upwind: 5, reach: -2, downwind: 1, pressure: -1, lightAir: -1, heavyAir: 4, memory: 2 } },
    { name: 'Torch', creature: 'Fire Salamander', hull: '#FF3B30', spinnaker: '#FFD60A', spinnaker2: '#FF3B30', spinnaker3: '#FFFFFF', sail: '#000000', cockpit: '#5E5E5E', personality: "Explosive starts, reckless aggression." , beat: 'Let the fire burn out — he keeps nothing through lulls or turns.', archetype: 'rocket', stats: { acceleration: 1, momentum: -5, handling: -3, upwind: -1, reach: 4, downwind: -1, pressure: 4, lightAir: 2, heavyAir: -1, memory: 1 } },
    { name: 'Nimbus', creature: 'Spotted Eagle Ray', hull: '#6A7FDB', spinnaker: '#F1F7FF', spinnaker2: '#6A7FDB', sail: '#FFFFFF', cockpit: '#C9D0E0', personality: "Effortlessly surfing invisible shifts." , beat: 'Chase him downwind — clouds stall when the wind goes aft.', archetype: 'shift', stats: { acceleration: 4, momentum: -5, handling: -4, upwind: 1, reach: 1, downwind: -5, pressure: 0, lightAir: 4, heavyAir: -3, memory: -1 } },
    { name: 'Tangle', creature: 'Common Octopus', hull: '#7A1FA2', spinnaker: '#00E676', spinnaker2: '#7A1FA2', sail: '#FFFFFF', cockpit: '#B8ACC9', personality: "Trap-setting master of dirty air." , beat: 'Dive downwind — the trap-setter unravels on the runs.', archetype: 'leech', stats: { acceleration: -1, momentum: 1, handling: -3, upwind: -2, reach: -1, downwind: -5, pressure: 5, lightAir: 1, heavyAir: -2, memory: 5 } },
    { name: 'Brine', creature: 'Florida Manatee', hull: '#A65A45', spinnaker: '#FFB4A2', spinnaker2: '#FFFFFF', spinnaker3: '#8FB8D8', sail: '#FFFFFF', cockpit: '#C3CCD2', personality: "Looks slow, impossible to pass." , beat: 'Break his rhythm at the marks — restarts are agony for a manatee.', archetype: 'freight', stats: { acceleration: -5, momentum: 3, handling: 3, upwind: 3, reach: -2, downwind: 4, pressure: -4, lightAir: -2, heavyAir: -4, memory: 1 } },
    { name: 'Razor', creature: 'Barracuda', hull: '#2D3142', spinnaker: '#EF233C', spinnaker2: '#2D3142', sail: '#FFFFFF', cockpit: '#5C5F6A', personality: "Surgical aggression at the worst moments." , beat: 'No weak stat — refuse the fight and race your own boat.', archetype: 'bully', stats: { acceleration: 0, momentum: 4, handling: 5, upwind: -1, reach: 0, downwind: -1, pressure: -1, lightAir: -2, heavyAir: 2, memory: 1 } },
    { name: 'Pebble', creature: 'Adelie Penguin', hull: '#1F1F1F', spinnaker: '#00B4D8', spinnaker2: '#FFFFFF', spinnaker3: '#1F1F1F', sail: '#FFFFFF', cockpit: '#C7CCD1', personality: "Precise and unshakable in traffic." , beat: 'Reach across her line — precision cannot fix a slow reach.', archetype: 'metronome', stats: { acceleration: -2, momentum: 5, handling: 3, upwind: 5, reach: -4, downwind: 4, pressure: -2, lightAir: -1, heavyAir: 4, memory: 5 } },
    { name: 'Saffron', creature: 'Lined Seahorse', hull: '#FFB000', spinnaker: '#7B2CBF', spinnaker2: '#FFB000', sail: '#FFFFFF', cockpit: '#CBBFA6', personality: "Graceful wildcard favoring wide tactics." , beat: 'She bets it all on the reaches — win the beats and it is over.', archetype: 'gambler', stats: { acceleration: -4, momentum: -2, handling: 3, upwind: -5, reach: 5, downwind: 0, pressure: 5, lightAir: 5, heavyAir: -5, memory: 0 } },
    { name: 'Bramble', creature: 'Sea Urchin', hull: '#2B2E4A', spinnaker: '#A78BFA', spinnaker2: '#FF9F1C', spinnaker3: '#FFFFFF', sail: '#FFFFFF', cockpit: '#7A7F9A', personality: "Spiky defender denying easy lanes." , beat: 'Stay out of reach — alone, the urchin barely moves.', archetype: 'bully', stats: { acceleration: -5, momentum: 3, handling: -4, upwind: 3, reach: -1, downwind: 1, pressure: -4, lightAir: 1, heavyAir: -1, memory: -5 } },
    { name: 'Mistral', creature: 'Common Swift', hull: '#A8DADC', spinnaker: '#E63946', spinnaker2: '#FFFFFF', spinnaker3: '#A8DADC', sail: '#FFFFFF', cockpit: '#C4CFD4', personality: "Constantly sniffing out pressure." , beat: 'Fast everywhere — beat the swift on shifts, not speed.', archetype: 'shift', stats: { acceleration: 5, momentum: 5, handling: 2, upwind: 0, reach: -1, downwind: 0, pressure: -1, lightAir: 3, heavyAir: 3, memory: 2 } },
    { name: 'Drift', creature: 'Sea Nettle', hull: '#FF70A6', spinnaker: '#9B6FE0', spinnaker2: '#FF70A6', sail: '#FFFFFF', cockpit: '#D6C9D9', personality: "Harmless-looking, slips through gaps." , beat: 'Every maneuver hurts him — force gybes and watch him wilt.', archetype: 'gambler', stats: { acceleration: -4, momentum: -5, handling: -5, upwind: -2, reach: -1, downwind: 4, pressure: 4, lightAir: 5, heavyAir: -5, memory: -5 } },
    { name: 'Anchor', creature: 'Sea Turtle', hull: '#96C47A', spinnaker: '#FFD016', spinnaker2: '#1F5C33', spinnaker3: '#FFFFFF', sail: '#FFFFFF', cockpit: '#B7C4B4', personality: "Conservative, resilient, brutally consistent." , beat: 'Own the beats — the turtle only wins races run downhill.', archetype: 'metronome', stats: { acceleration: 3, momentum: 5, handling: -2, upwind: -5, reach: 0, downwind: -2, pressure: -1, lightAir: -1, heavyAir: 2, memory: 5 } },
    { name: 'Zing', creature: 'Flying Squirrel', hull: '#9B5DE5', spinnaker: '#FEE440', spinnaker2: '#9B5DE5', sail: '#FFFFFF', cockpit: '#CFC7DC', personality: "Hyperactive chaos opportunist." , beat: 'Survive the launch — the beats bring him back to you.', archetype: 'rocket', stats: { acceleration: 4, momentum: 5, handling: 4, upwind: -3, reach: -4, downwind: -2, pressure: 1, lightAir: 4, heavyAir: -4, memory: 1 } },
    { name: 'Knot', creature: 'Chambered Nautilus', hull: '#C8553D', spinnaker: '#6FAF58', spinnaker2: '#F0E4C8', spinnaker3: '#C8553D', sail: '#FFFFFF', cockpit: '#C8B5A6', personality: "Cerebral planner playing long games." , beat: 'Sail into pressure — the nautilus cannot cash a gust.', archetype: 'leech', stats: { acceleration: -2, momentum: -3, handling: 0, upwind: -3, reach: 0, downwind: 1, pressure: -4, lightAir: -1, heavyAir: -2, memory: 3 } },
    { name: 'Flash', creature: 'Mackerel', hull: '#3A86FF', spinnaker: '#F5E050', spinnaker2: '#FFFFFF', sail: '#000000', cockpit: '#B4C2D6', personality: "Speed-first, consequences later." , beat: 'Send him upwind — the sprinter\'s compass only points down.', archetype: 'rocket', stats: { acceleration: 2, momentum: -1, handling: 5, upwind: -5, reach: -1, downwind: 2, pressure: -4, lightAir: 1, heavyAir: -1, memory: -2 } },
    { name: 'Pearl', creature: 'Pacific Oyster', hull: '#C7A6FF', spinnaker: '#2E2E2E', spinnaker2: '#FFFFFF', spinnaker3: '#C7A6FF', sail: '#FFFFFF', cockpit: '#CFCFD4', personality: "Quiet patience, strikes at perfect moments." , beat: 'Make her tack — every stop costs a fortune in pearls.', archetype: 'leech', stats: { acceleration: 4, momentum: -5, handling: -1, upwind: -5, reach: 4, downwind: 5, pressure: 4, lightAir: 1, heavyAir: -3, memory: -2 } },
    { name: 'Bluff', creature: 'Polar Bear', hull: '#FFFFFF', spinnaker: '#2E5FD0', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#BFC6CC', personality: "Imposing calm daring mistakes." , beat: 'Just point higher — Bluff bluffs; the upwind legs call it.', archetype: 'freight', stats: { acceleration: 2, momentum: 4, handling: -3, upwind: -5, reach: 0, downwind: 1, pressure: -1, lightAir: -4, heavyAir: 5, memory: 3 } },
    { name: 'Regal', creature: 'Mute Swan', hull: '#FFFFFF', spinnaker: '#E10600', spinnaker2: '#FFFFFF', spinnaker3: '#1A1A1A', sail: '#000000', cockpit: '#C9CCD6', personality: "Elegant lane thief with ruthless timing." , beat: 'Race the runs — royalty will not hoist and hustle.', archetype: 'corner', stats: { acceleration: -1, momentum: 3, handling: 5, upwind: 0, reach: 4, downwind: -4, pressure: -2, lightAir: 2, heavyAir: -1, memory: 2 } },
    { name: 'Sunshine', creature: 'Mahi-Mahi', hull: '#FFEB3B', spinnaker: '#00E676', spinnaker2: '#FFEB3B', spinnaker3: '#FFFFFF', sail: '#FFFFFF', cockpit: '#BDB76B', personality: "Flashy speed attacking on reaches." , beat: 'Keep her in lulls and dirty air — no gusts, no shine.', archetype: 'rocket', stats: { acceleration: 1, momentum: -4, handling: 1, upwind: 4, reach: 0, downwind: -1, pressure: -4, lightAir: 1, heavyAir: 0, memory: -1 } },
    { name: 'Pulse', creature: 'Tree Frog', hull: '#00FF6A', spinnaker: '#7A00FF', spinnaker2: '#00FF6A', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Sticky feet, sticky cover — impossible to shake loose." , beat: 'Break away off the wind — sticky feet, short hops.', archetype: 'leech', stats: { acceleration: -3, momentum: 2, handling: -1, upwind: -3, reach: -5, downwind: -5, pressure: 2, lightAir: 4, heavyAir: -4, memory: 0 } },
    { name: 'Splat', creature: 'Blobfish', hull: '#E7A6B4', spinnaker: '#6a1051', spinnaker2: '#E7A6B4', sail: '#FFFFFF', cockpit: '#CFC6CC', personality: "Looks doomed, but somehow always survives." , beat: 'Just race — his corner needs a miracle and a tailwind.', archetype: 'gambler', stats: { acceleration: -5, momentum: 0, handling: -3, upwind: 0, reach: -2, downwind: 0, pressure: 1, lightAir: -2, heavyAir: -5, memory: -3 } },
    { name: 'Dart', creature: 'Kingfisher', hull: '#00C2FF', spinnaker: '#FF9433', spinnaker2: '#FFFFFF', spinnaker3: '#F5A03C', sail: '#FFFFFF', cockpit: '#AEBFCC', personality: "pure speed, energetic, very competitive" , beat: 'Point high and turn often — darts only fly straight.', archetype: 'rocket', stats: { acceleration: 1, momentum: 4, handling: -3, upwind: -4, reach: 4, downwind: -2, pressure: 5, lightAir: 2, heavyAir: -1, memory: 3 } },
    { name: 'Roll', creature: 'Harbor Seal', hull: '#7D8597', spinnaker: '#FFD166', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C3CAD3', personality: "Playful feints hiding brutal positioning skills." , beat: 'Slow him leaving marks — perfect turns, painful exits.', archetype: 'corner', stats: { acceleration: -5, momentum: 4, handling: 5, upwind: -3, reach: 0, downwind: -3, pressure: 0, lightAir: 0, heavyAir: 2, memory: 3 } },
    { name: 'Spike', creature: 'Narwhal', hull: '#6B7FD7', spinnaker: '#FFFFFF', spinnaker2: '#6B7FD7', sail: '#000000', cockpit: '#C5CED6', personality: "Leads with the horn — makes his own right of way." , beat: 'Point high and stay clear of the horn — he cannot climb after you.', archetype: 'bully', stats: { acceleration: 1, momentum: -2, handling: 1, upwind: -5, reach: 2, downwind: 1, pressure: 3, lightAir: -2, heavyAir: 4, memory: 3 } },
    { name: 'Flicker', creature: 'Arctic Tern', hull: '#EE6C4D', spinnaker: '#E0FBFC', spinnaker2: '#EE6C4D', sail: '#000000', cockpit: '#C7CCD1', personality: "Constant repositioning, never predictable." , beat: 'Follow the fleet, not the tern — his corner rarely pays.', archetype: 'gambler', stats: { acceleration: 2, momentum: 3, handling: -2, upwind: -2, reach: 1, downwind: 0, pressure: -1, lightAir: 2, heavyAir: -1, memory: 4 } },
    { name: 'Croak', creature: 'American Bullfrog', hull: '#386641', spinnaker: '#A7C957', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#BFC9B8', personality: "Patient swamp tactician who waits for the wind to die." , beat: 'Race him when it honks — the bullfrog only sings in a whisper.', archetype: 'shift', stats: { acceleration: 1, momentum: -3, handling: -2, upwind: 0, reach: -2, downwind: 0, pressure: -1, lightAir: 5, heavyAir: -5, memory: 2 } },
    { name: 'Snap', creature: 'Snapping Turtle', hull: '#4B5D23', spinnaker: '#ef3629', spinnaker2: '#000000', sail: '#000000', cockpit: '#B8B8A8', personality: "Grouchy, old salty sailor who likes to beat the young whippersnappers." , beat: 'Keep him turning — snappers lose their grip in maneuvers.', archetype: 'metronome', stats: { acceleration: -2, momentum: -4, handling: -4, upwind: 2, reach: 0, downwind: 1, pressure: 1, lightAir: -1, heavyAir: 3, memory: 3 } },
    { name: 'Rift', creature: 'Moray Eel', hull: '#d4ff07', spinnaker: '#FF61DF', spinnaker2: '#1A1A1A', sail: '#FFFFFF', cockpit: '#B7C4B4', personality: "Lurks quietly, strikes savagely at marks." , beat: 'Pull away on the runs — eels do not surf.', archetype: 'corner', stats: { acceleration: -1, momentum: -3, handling: 2, upwind: 2, reach: 3, downwind: -4, pressure: 2, lightAir: 1, heavyAir: -1, memory: 4 } },
    { name: 'Skerry', creature: 'Atlantic Puffin', hull: '#FF5400', spinnaker: '#1D3557', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C7CCD1', personality: "Fearless gap-threader thriving in traffic." , beat: 'Give him no gaps to thread — then climb away upwind.', archetype: 'bully', stats: { acceleration: -2, momentum: 1, handling: -1, upwind: -3, reach: 3, downwind: 2, pressure: -2, lightAir: 2, heavyAir: 2, memory: 4 } },
    { name: 'Crush', creature: 'Mantis Shrimp', hull: '#00F5D4', spinnaker: '#F15BB5', spinnaker2: '#00F5D4', sail: '#000000', cockpit: '#CFC7DC', personality: "Explosive reactions with devastating timing." , beat: 'Everything between corners is yours — especially the runs.', archetype: 'corner', stats: { acceleration: 4, momentum: -5, handling: 2, upwind: 3, reach: 2, downwind: -5, pressure: 2, lightAir: 2, heavyAir: -1, memory: 4 } },
    { name: 'Torrent', creature: 'Swordfish', hull: '#083fa6', spinnaker: '#FFFFFF', spinnaker2: '#2E6FD0', spinnaker3: '#D62828', sail: '#FFFFFF', cockpit: '#8D99AE', personality: "Straight-line dominance with brutal acceleration." , beat: 'Absorb the opening surge — the swordfish dulls by leg two.', archetype: 'rocket', stats: { acceleration: 5, momentum: -2, handling: 1, upwind: 1, reach: -1, downwind: -2, pressure: 2, lightAir: -3, heavyAir: 4, memory: 0 } },
    { name: 'Jester', creature: 'Clownfish', hull: '#ffa000', spinnaker: '#FFFFFF', spinnaker2: '#ffa000', sail: '#000000', cockpit: '#f4f4f4', personality: "Cheerful chaos masking shrewd cunning." , beat: 'Escape upwind — the joke is on him above the layline.', archetype: 'leech', stats: { acceleration: 1, momentum: 0, handling: 2, upwind: -3, reach: 0, downwind: 2, pressure: -1, lightAir: 4, heavyAir: -4, memory: 3 } },
    { name: 'Breeze', creature: 'Nudibranch', hull: '#000080', spinnaker: '#ff3fa7', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#D6D6DC', personality: "Chill, stylish, always finds unexpected pressure." , beat: 'Crowd her at starts and marks — slow to build speed, easy to pin.', archetype: 'shift', stats: { acceleration: -4, momentum: 4, handling: -2, upwind: -3, reach: 4, downwind: 1, pressure: 5, lightAir: 4, heavyAir: -5, memory: -3 } },
    { name: 'Petal', creature: 'Roseate Spoonbill', hull: '#FF6FAE', spinnaker: '#FFFFFF', spinnaker2: '#FF6FAE', sail: '#FFFFFF', cockpit: '#e6e6e6', personality: "Elegant lane snatcher with impeccable timing." , beat: 'Win the beats — the spoonbill blooms only at the marks.', archetype: 'corner', stats: { acceleration: -3, momentum: 3, handling: 1, upwind: -5, reach: -1, downwind: 3, pressure: 4, lightAir: 3, heavyAir: -3, memory: 3 } },
    { name: 'Stomp', creature: 'Blue-Footed Booby', hull: '#00B4D8', spinnaker: '#F5F7FA', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Clumsy confidence hiding fearless lane attacks." , beat: 'Refuse the brawl and outlast him — stomping bleeds speed.', archetype: 'bully', stats: { acceleration: 5, momentum: -3, handling: 4, upwind: 3, reach: 2, downwind: 0, pressure: 1, lightAir: 0, heavyAir: 1, memory: 0 } },
    { name: 'Crimson', creature: 'Red Snapper', hull: '#ed1515', spinnaker: '#2643E9', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#CFCFD4', personality: "Calm, surgical tactician striking at perfect moments." , beat: 'Break away in a straight line — he only shines in puffs.', archetype: 'leech', stats: { acceleration: -1, momentum: -3, handling: 1, upwind: 0, reach: -3, downwind: -2, pressure: 2, lightAir: 0, heavyAir: 0, memory: 1 } },
    { name: 'Viper', creature: 'Green Tree Snake', hull: '#49c100', spinnaker: '#C4E63C', spinnaker2: '#1A1A1A', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Coils around your wind and waits for the twitch." , beat: 'Slip the cover in open water — he fades on the long legs.', archetype: 'leech', stats: { acceleration: -3, momentum: -2, handling: -2, upwind: -5, reach: -1, downwind: -5, pressure: 3, lightAir: 2, heavyAir: -1, memory: 1 } },
    { name: 'Skitter', creature: 'Atlantic Mudskipper', hull: '#e33d28', spinnaker: '#15f121', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Erratic scrambler who thrives where the water runs out." , beat: 'Wait for the breeze to fill — the mudskipper needs a drifter to matter.', archetype: 'gambler', stats: { acceleration: 1, momentum: -4, handling: -2, upwind: -1, reach: -3, downwind: -2, pressure: -3, lightAir: 4, heavyAir: -4, memory: 2 } },
    { name: 'Veil', creature: 'Vampire Squid', hull: '#7A1FA2', spinnaker: '#E10600', spinnaker2: '#1A1A1A', spinnaker3: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Calm, shadowy predator striking without warning." , beat: 'Force maneuvers — the cloak tears in every tack.', archetype: 'leech', stats: { acceleration: -1, momentum: -4, handling: -5, upwind: -1, reach: 3, downwind: -1, pressure: -4, lightAir: 2, heavyAir: -4, memory: -1 } },
    { name: 'Puff', creature: 'Mandarin Dragonet', hull: '#0032FF', spinnaker: '#F0A040', spinnaker2: '#1890FC', spinnaker3: '#62E517', sail: '#FFFFFF', cockpit: '#BFC8D6', personality: "Super chill vibes, effortless flow, always smiling." , beat: 'Attack downwind — the dragonet will not run with you.', archetype: 'freight', stats: { acceleration: 2, momentum: 4, handling: 1, upwind: 1, reach: 2, downwind: -3, pressure: 4, lightAir: 5, heavyAir: -3, memory: 2 } },
    { name: 'Lure', creature: 'Black Seadevil', hull: '#0B0F1A', spinnaker: '#6AFF3D', spinnaker2: '#0B0F1A', sail: '#F5F7FA', cockpit: '#2E3440', personality: "Patient darkness, sudden lethal strikes." , beat: 'Refuse the bait upwind — the runs are a free pass.', archetype: 'freight', stats: { acceleration: -4, momentum: 5, handling: 0, upwind: 3, reach: 5, downwind: -5, pressure: 5, lightAir: 3, heavyAir: -5, memory: 1 } },
    { name: 'Wiggle', creature: 'Axolotl', hull: '#FFFFFF', spinnaker: '#FF4FA3', spinnaker2: '#BDEFFF', sail: '#BDEFFF', cockpit: '#D1D7DB', personality: "Cute chaos, surprisingly competitive." , beat: 'Make him steer — wiggling is not turning.', archetype: 'gambler', stats: { acceleration: 2, momentum: 1, handling: -5, upwind: -3, reach: 3, downwind: 3, pressure: -3, lightAir: 4, heavyAir: -4, memory: -1 } },
    { name: 'Zeffir', creature: 'Herring Gull', hull: '#FFFFFF', spinnaker: '#FF7A00', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#D1D7DB', personality: "Always lifted, always smiling." , beat: 'Hold him off downwind — gulls glide everywhere but there.', archetype: 'shift', stats: { acceleration: 4, momentum: 1, handling: -1, upwind: 1, reach: 2, downwind: -4, pressure: 2, lightAir: 1, heavyAir: 3, memory: 2 } },
    { name: 'Scoop', creature: 'Brown Pelican', hull: '#D8C6A3', spinnaker: '#5499DC', spinnaker2: '#FFFFFF', spinnaker3: '#D8C6A3', sail: '#FFFFFF', cockpit: '#e6e6e6', personality: "Big moves, surprisingly precise." , beat: 'Rush the starts and reaches — the pelican needs a runway.', archetype: 'metronome', stats: { acceleration: -4, momentum: -1, handling: 1, upwind: 4, reach: -4, downwind: -1, pressure: 2, lightAir: 0, heavyAir: 2, memory: 2 } },
    { name: 'Popper', creature: 'Pufferfish', hull: '#FFD84D', spinnaker: '#E10600', spinnaker2: '#FFD84D', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Defensive chaos, punishes reckless pressure." , beat: 'Point higher and let him puff himself out.', archetype: 'bully', stats: { acceleration: -3, momentum: 0, handling: -2, upwind: -4, reach: 3, downwind: 1, pressure: 4, lightAir: 1, heavyAir: -2, memory: 0 } },
    { name: 'Frond', creature: 'Leafy Seadragon', hull: '#5FAF6E', spinnaker: '#C8E8B8', spinnaker2: '#5FAF6E', sail: '#F3FFF9', cockpit: '#BFCFC4', personality: "Graceful drifter, impossible to read." , beat: 'Pin him at the start — the seadragon blooms late, downwind.', archetype: 'shift', stats: { acceleration: -4, momentum: -2, handling: -3, upwind: -1, reach: 1, downwind: 5, pressure: 0, lightAir: 5, heavyAir: -5, memory: 0 } },
    { name: 'Bulkhead', creature: 'Elephant Seal', hull: '#6B7280', spinnaker: '#FF7A00', spinnaker2: '#1A1A1A', spinnaker3: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "A wall of calm — unbothered, unhurried, unmoved." , beat: 'Hoist and go — the bulkhead sinks on every run.', archetype: 'metronome', stats: { acceleration: -3, momentum: -2, handling: 2, upwind: 3, reach: -1, downwind: -5, pressure: 5, lightAir: -5, heavyAir: 5, memory: 2 } },
    { name: 'Slipstream', creature: 'Sockeye Salmon', hull: '#B6BCC6', spinnaker: '#4FBF3C', spinnaker2: '#FFFFFF', spinnaker3: '#E94B4B', sail: '#FFFFFF', cockpit: '#41c617', personality: "Relentless endurance, explosive late surges." , beat: 'Deny the tow upwind, then leave — salmon cannot run downstream.', archetype: 'freight', stats: { acceleration: 5, momentum: 3, handling: 1, upwind: 1, reach: -3, downwind: -5, pressure: -1, lightAir: 0, heavyAir: 2, memory: 5 } },
    { name: 'Blaze', creature: 'Mako Shark', hull: '#1F3C5B', spinnaker: '#FFFFFF', spinnaker2: '#1F3C5B', spinnaker3: '#00A8E8', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Blisteringly fast attacker forcing races into constant reaction mode." , beat: 'Skip the fight, win the runs — makos idle downwind.', archetype: 'bully', stats: { acceleration: -3, momentum: -2, handling: 2, upwind: 2, reach: 3, downwind: -4, pressure: 2, lightAir: -3, heavyAir: 3, memory: 1 } },
    { name: 'Cruz', creature: 'California Newt', hull: '#F08A1E', spinnaker: '#2E3440', spinnaker2: '#F0E0B0', spinnaker3: '#E06A00', sail: '#FFFFFF', cockpit: '#CFC3A8', personality: "Unhurried, unbothered, and never once out of position.", beat: 'Nothing to exploit — get ahead early, because he has no burst to take it back.', archetype: 'metronome', stats: { acceleration: 2, momentum: 2, handling: 2, upwind: 2, reach: 2, downwind: 2, pressure: 2, lightAir: 1, heavyAir: 1, memory: 3 } },
    { name: 'Prism', creature: 'Maxima Clam', hull: '#2A1070', spinnaker: '#00D9CB', spinnaker2: '#A93FE8', spinnaker3: '#F0F4FF', sail: '#FFFFFF', cockpit: '#BFC6DB', personality: "A slow strange jewel that arrives faster than it has any right to.", beat: 'Bury him at the start — a clam that has to accelerate is a clam you have beaten.', archetype: 'freight', stats: { acceleration: -4, momentum: 5, handling: -3, upwind: 0, reach: 3, downwind: 2, pressure: 3, lightAir: -1, heavyAir: 2, memory: -2 } },
    { name: 'Ember', creature: 'Firefish', hull: '#A855E8', spinnaker: '#F5A03C', spinnaker2: '#FFFFFF', spinnaker3: '#7A3FD4', sail: '#FFFFFF', cockpit: '#C9BFD6', personality: "Burns hot off the line and dares the fleet to keep up.", beat: 'Make the race long — the firefish spends everything in the first minute.', archetype: 'rocket', stats: { acceleration: 5, momentum: -4, handling: 2, upwind: -2, reach: 2, downwind: 0, pressure: 1, lightAir: 2, heavyAir: -3, memory: 0 } },
    { name: 'Torpedo', creature: 'Northern Pike', hull: '#7A8C3C', spinnaker: '#D8402F', spinnaker2: '#F0E0A0', spinnaker3: '#4A5A28', sail: '#FFFFFF', cockpit: '#C4C4A0', personality: "Learns the water once, then hunts it from memory.", beat: 'Take him somewhere new — the pike is only lethal on water he already knows.', archetype: 'freight', stats: { acceleration: 3, momentum: 4, handling: -4, upwind: -1, reach: 4, downwind: 1, pressure: 0, lightAir: -1, heavyAir: 2, memory: 4 } },
    { name: 'Flaunt', creature: 'Anemone Shrimp', hull: '#F58BA0', spinnaker: '#00C2E0', spinnaker2: '#FF3B5C', spinnaker3: '#FFFFFF', sail: '#FFFFFF', cockpit: '#E8D4DA', personality: "Dazzling, theatrical, and quietly stealing your lane the whole time.", beat: 'Sail your own race — every trick she has costs her when the breeze gets up.', archetype: 'gambler', stats: { acceleration: 5, momentum: -4, handling: 5, upwind: -3, reach: 2, downwind: 0, pressure: 2, lightAir: 3, heavyAir: -4, memory: 1 } },
    { name: 'Piper', creature: 'Sanderling', hull: '#E8DCC0', spinnaker: '#2E9BF0', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Threads gaps at the mark that nobody else even sees.", beat: 'Take her downwind and stretch — precision is worth nothing on an empty run.', archetype: 'corner', stats: { acceleration: 3, momentum: -4, handling: 5, upwind: 1, reach: 0, downwind: -3, pressure: 2, lightAir: 2, heavyAir: -2, memory: 3 } },
    { name: 'Stripes', creature: 'Tiger Shark', hull: '#8A6A3A', spinnaker: '#F0C82E', spinnaker2: '#2B2B2B', sail: '#000000', cockpit: '#B8AE96', personality: "Eats mistakes. Sail clean and he has nothing to work with.", beat: 'Give him no errors — the tiger has no plan of his own.', archetype: 'leech', stats: { acceleration: 1, momentum: 4, handling: 0, upwind: 1, reach: 0, downwind: 1, pressure: -2, lightAir: -2, heavyAir: 3, memory: 3 } },
    { name: 'Anvil', creature: 'Hammerhead Shark', hull: '#6E7A85', spinnaker: '#F5851F', spinnaker2: '#1C709A', sail: '#FFFFFF', cockpit: '#C2C8CE', personality: "Wide, heavy and utterly immovable once he owns the lane.", beat: 'Beat him off the line — the hammer needs a lane before it is worth anything.', archetype: 'bully', stats: { acceleration: -4, momentum: 3, handling: -3, upwind: 4, reach: 2, downwind: 1, pressure: -3, lightAir: -3, heavyAir: 4, memory: 1 } },
    { name: 'Paddle', creature: 'Mallard Duck', hull: '#2FAE5C', spinnaker: '#F58A00', spinnaker2: '#6B4A2A', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Cheerful, forgiving and happiest when the breeze goes soft.", beat: 'Wait for it to blow — the duck is a puddle sailor at heart.', archetype: 'metronome', stats: { acceleration: 1, momentum: 1, handling: 1, upwind: 0, reach: -1, downwind: -1, pressure: -2, lightAir: 3, heavyAir: -2, memory: 2 } },
    { name: 'Etienne', creature: 'Red Swamp Crayfish', hull: '#DE4F3C', spinnaker: '#50B090', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C6B49A', personality: "Scrappy bayou grinder who would rather hold a lane than win one.", beat: 'Race him in open water — the crawdad only understands a narrow channel.', archetype: 'corner', stats: { acceleration: -1, momentum: 3, handling: 1, upwind: 1, reach: -2, downwind: -2, pressure: -1, lightAir: 4, heavyAir: -3, memory: 2 } },
    { name: 'Frenzy', creature: 'Red-Bellied Piranha', hull: '#CE3B3B', spinnaker: '#1E7A4A', spinnaker2: '#FFFFFF', sail: '#000000', cockpit: '#A8B4B8', personality: "Feeds on a messy start and gets bored in clean air.", beat: 'Keep it tidy — with nothing to bite, the piranha simply drifts.', archetype: 'gambler', stats: { acceleration: 3, momentum: -3, handling: -1, upwind: -4, reach: 0, downwind: 0, pressure: 0, lightAir: 1, heavyAir: -1, memory: -1 } },
    { name: 'Tiny', creature: 'Antarctic Krill', hull: '#F26E6E', spinnaker: '#3D6FC4', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#DCC6C6', personality: "All twitch and no mass — turns like nothing else afloat.", beat: 'Just point at the mark — anything above a breeze blows the krill away.', archetype: 'rocket', stats: { acceleration: 5, momentum: -5, handling: 4, upwind: -3, reach: -1, downwind: -2, pressure: -1, lightAir: 5, heavyAir: -5, memory: -3 } },
    { name: 'Grip', creature: 'Acorn Barnacle', hull: '#8A8D93', spinnaker: '#2E7D32', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Immovable. Wins the one metre he is standing on and nothing else.", beat: 'Sail around him — he cannot follow, and he was never going to.', archetype: 'bully', stats: { acceleration: -5, momentum: 5, handling: -5, upwind: -5, reach: -3, downwind: -4, pressure: 5, lightAir: -5, heavyAir: 5, memory: 0 } },
    { name: 'Splash', creature: 'Hippopotamus', hull: '#6F7782', spinnaker: '#EE3B2B', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Enormous, delighted, and genuinely dangerous with the kite up.", beat: 'Never let him start a run in front — everywhere else he is a barge.', archetype: 'freight', stats: { acceleration: -4, momentum: 5, handling: -5, upwind: -4, reach: -2, downwind: 4, pressure: -3, lightAir: -4, heavyAir: 4, memory: 1 } },
    { name: 'Dozer', creature: 'Nurse Shark', hull: '#B0824F', spinnaker: '#7DE2C3', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C6BBA6', personality: "Sleeps through the start and wakes up somewhere near your transom.", beat: 'Put a lap on him early — the nurse shark needs the whole race to get going.', archetype: 'freight', stats: { acceleration: -5, momentum: 5, handling: -4, upwind: 0, reach: -1, downwind: 1, pressure: -4, lightAir: -2, heavyAir: 3, memory: 2 } },
    { name: 'Muninn', creature: 'Common Raven', hull: '#1B2038', spinnaker: '#12A0FF', spinnaker2: '#FFFFFF', spinnaker3: '#6B4FD6', sail: '#101014', cockpit: '#C3C7D2', personality: "Remembers every shift he has ever seen, and sails you with it.", beat: 'Run him downwind — memory is worth nothing on water he has not learned.', archetype: 'shift', traits: { windFast: 1.75 }, stats: { acceleration: 2, momentum: -3, handling: 4, upwind: 3, reach: 3, downwind: -2, pressure: 5, lightAir: 2, heavyAir: -1, memory: 5 } },

    // ── The hundred. Eighteen added Aug 1 2026; colours are measured from each
    // shipped portrait so the boat matches the face. See art/new-character-prompt.md.
    { name: 'Talon', creature: 'Bald Eagle', hull: '#0A39A1', spinnaker: '#8A4A1D', spinnaker2: '#F2F2F0', sail: '#FFFFFF', cockpit: '#C3C7D2', personality: "Commits the instant he sees an opening, and never looks twice.", beat: 'Take him downwind — all that height is worth nothing with the wind behind.', archetype: 'rocket', stats: { acceleration: 5, momentum: -4, handling: 3, upwind: 5, reach: 4, downwind: -3, pressure: 3, lightAir: 1, heavyAir: 1, memory: 0 } },
    { name: 'Latch', creature: 'Remora', hull: '#C40A60', spinnaker: '#029E99', spinnaker2: '#F0EDE4', sail: '#FFFFFF', cockpit: '#BFC4CC', personality: "Finds the fastest boat in the fleet and simply stays there.", beat: 'Break the tow — nobody has ever seen him accelerate on his own.', archetype: 'leech', stats: { acceleration: -3, momentum: 5, handling: 1, upwind: 1, reach: 2, downwind: -1, pressure: 5, lightAir: 0, heavyAir: -2, memory: 2 } },
    { name: 'Skip', creature: 'Green Basilisk', hull: '#0C3FC0', spinnaker: '#3F8B0A', spinnaker2: '#F5E14A', spinnaker3: '#0C3FC0', sail: '#FFFFFF', cockpit: '#C7CBD4', personality: "Leaves before the gun and asks questions afterwards.", beat: 'Make it a long leg — he spends everything in ten seconds and has nothing left to carry.', archetype: 'rocket', stats: { acceleration: 5, momentum: -5, handling: 0, upwind: -4, reach: 3, downwind: -2, pressure: 0, lightAir: 2, heavyAir: 0, memory: -2 } },
    { name: 'Sable', creature: 'Great Cormorant', hull: '#17CCC1', spinnaker: '#AF25CF', spinnaker2: '#1E2430', sail: '#101014', cockpit: '#C9CCD6', personality: "Rounds every mark as though it had been measured beforehand.", beat: 'Crowd her — she sails a clean lane or none at all, and dirty air undoes her.', archetype: 'corner', stats: { acceleration: 1, momentum: 0, handling: 5, upwind: 0, reach: 1, downwind: -1, pressure: -3, lightAir: -1, heavyAir: 2, memory: 3 } },
    { name: 'Seam', creature: 'Rainbow Trout', hull: '#009078', spinnaker: '#F00030', spinnaker2: '#F2EAD2', sail: '#FFFFFF', cockpit: '#C5C9D1', personality: "Sees the shift a beat before it arrives, and takes it every time.", beat: 'Wait for it to blow — she reads the light stuff beautifully and drowns above sixteen knots.', archetype: 'shift', stats: { acceleration: 1, momentum: -4, handling: 3, upwind: 4, reach: 1, downwind: -3, pressure: 3, lightAir: 4, heavyAir: -4, memory: 1 } },
    { name: 'Snag', creature: 'Hellbender', hull: '#78CE33', spinnaker: '#C8912A', spinnaker2: '#2B2118', sail: '#101014', cockpit: '#BCC0C7', personality: "Has been in this river longer than the river has.", beat: 'Force him to turn — a tacking duel is the one thing he cannot answer.', archetype: 'metronome', stats: { acceleration: -4, momentum: 5, handling: -4, upwind: -3, reach: 3, downwind: -2, pressure: 2, lightAir: -1, heavyAir: 3, memory: 5 } },
    { name: 'Lunker', creature: 'Largemouth Bass', hull: '#4520A6', spinnaker: '#A0E203', spinnaker2: '#12121A', sail: '#FFFFFF', cockpit: '#C2C6CF', personality: "Picks a side of the course and dares you to disagree.", beat: 'Wait for a light day — he needs pressure to move, and he cannot turn when it arrives.', archetype: 'gambler', stats: { acceleration: -4, momentum: 2, handling: -3, upwind: -1, reach: -5, downwind: 0, pressure: 4, lightAir: -3, heavyAir: 3, memory: -4 } },
    { name: 'Flare', creature: 'Siamese Fighting Fish', hull: '#9444C0', spinnaker: '#1B8D84', spinnaker2: '#F0143C', sail: '#FFFFFF', cockpit: '#CBCFD8', personality: "Would rather win the argument than the race.", beat: 'Let him pick the fight, then leave downwind — that is exactly where he is slowest.', archetype: 'bully', stats: { acceleration: 4, momentum: -3, handling: 4, upwind: -3, reach: -4, downwind: -3, pressure: 1, lightAir: 2, heavyAir: 1, memory: -3 } },
    { name: 'Spar', creature: 'Blue Marlin', hull: '#326EC6', spinnaker: '#FCC20E', spinnaker2: '#EDF2F5', spinnaker3: '#12306B', sail: '#FFFFFF', cockpit: '#C6CAD3', personality: "Arrives at speed and expects the water to be clear.", beat: 'Attack at every mark — he rounds wide and cannot turn back inside you.', archetype: 'freight', stats: { acceleration: -3, momentum: 5, handling: -4, upwind: 2, reach: 5, downwind: 1, pressure: -1, lightAir: -2, heavyAir: 3, memory: 0 } },
    { name: 'Bloom', creature: 'Portuguese Man-of-War', hull: '#9FDC4A', spinnaker: '#EA7EFA', spinnaker2: '#3A2E5C', sail: '#FFFFFF', cockpit: '#CDD1D9', personality: "Has no rudder, no plan, and an uncanny amount of luck.", beat: 'Put a beat in front of her — she goes where the wind goes and cannot fight upwind.', archetype: 'gambler', stats: { acceleration: 2, momentum: 4, handling: -5, upwind: -3, reach: -4, downwind: -3, pressure: -1, lightAir: -3, heavyAir: 5, memory: -4 } },
    { name: 'Needle', creature: 'Gharial', hull: '#4C269C', spinnaker: '#DEEA49', spinnaker2: '#1A1A22', sail: '#FFFFFF', cockpit: '#C4C8D1', personality: "Threads gaps that were not there a moment earlier.", beat: 'Take him downwind — the precision that wins him marks is worth nothing on a run.', archetype: 'corner', stats: { acceleration: -1, momentum: -2, handling: 5, upwind: 3, reach: 1, downwind: -3, pressure: -1, lightAir: 2, heavyAir: 0, memory: 4 } },
    { name: 'Sovereign', creature: 'Napoleon Wrasse', hull: '#80D81B', spinnaker: '#E82393', spinnaker2: '#0E5C55', spinnaker3: '#F2F0E6', sail: '#FFFFFF', cockpit: '#C8CCD5', personality: "Treats the racecourse as a formality he has already won.", beat: 'Sail on his wind — grandeur does not survive being covered.', archetype: 'corner', stats: { acceleration: -3, momentum: 3, handling: 3, upwind: 4, reach: 4, downwind: -1, pressure: -4, lightAir: -1, heavyAir: 3, memory: 2 } },
    { name: 'Lateen', creature: 'By-the-wind Sailor', hull: '#D1DE09', spinnaker: '#16389A', spinnaker2: '#E8EEF5', sail: '#FFFFFF', cockpit: '#C0C4CD', personality: "Sets one sail, forever, and lets the day decide the rest.", beat: 'Send her upwind — a sail she cannot trim is no use against the breeze.', archetype: 'shift', stats: { acceleration: -4, momentum: -3, handling: -5, upwind: -4, reach: 4, downwind: 0, pressure: 5, lightAir: 2, heavyAir: -3, memory: -4 } },
    { name: 'Ribbon', creature: 'Yellow-lipped Sea Krait', hull: '#ADDA16', spinnaker: '#0B5EC0', spinnaker2: '#F5E23A', spinnaker3: '#14202E', sail: '#101014', cockpit: '#C1C5CE', personality: "Slides through the fleet without appearing to hurry.", beat: 'Take her air — she needs a clean lane and will not fight you for one.', archetype: 'corner', stats: { acceleration: 4, momentum: 1, handling: 4, upwind: 1, reach: 1, downwind: -2, pressure: -3, lightAir: 4, heavyAir: -3, memory: 1 } },
    { name: 'Plunge', creature: 'Northern Gannet', hull: '#1643AB', spinnaker: '#F9C915', spinnaker2: '#20242E', spinnaker3: '#F7F4E8', sail: '#FFFFFF', cockpit: '#C9CDD6', personality: "Picks a lane, folds, and commits — there is no second thought.", beat: 'Race him in a drifter — he needs wind to throw himself at, and dies without it.', archetype: 'rocket', stats: { acceleration: 5, momentum: -1, handling: -5, upwind: -3, reach: 0, downwind: -1, pressure: 2, lightAir: -4, heavyAir: 4, memory: 0 } },
    { name: 'Riffle', creature: 'American Dipper', hull: '#2A71B5', spinnaker: '#CFD213', spinnaker2: '#5E646B', sail: '#FFFFFF', cockpit: '#BEC2CB', personality: "Never stops moving, and never stops being right about the wind.", beat: 'Wait for a windy day — she is quick and clever until it blows, then she is just small.', archetype: 'shift', stats: { acceleration: 3, momentum: -3, handling: 4, upwind: -2, reach: -2, downwind: -2, pressure: 3, lightAir: 4, heavyAir: -3, memory: -3 } },
    { name: 'Chisel', creature: 'Humpback Chub', hull: '#32AD78', spinnaker: '#571A05', spinnaker2: '#E0CE93', sail: '#FFFFFF', cockpit: '#BDC1C9', personality: "Has one speed, and has never needed a second.", beat: 'Make him manoeuvre — he has no way of finding that speed again.', archetype: 'freight', stats: { acceleration: -4, momentum: 5, handling: -4, upwind: 0, reach: 3, downwind: 0, pressure: 3, lightAir: -3, heavyAir: 4, memory: 1 } },
    { name: 'Chroma', creature: 'Cuttlefish', hull: '#0AA79C', spinnaker: '#952FAC', spinnaker2: '#E8C77A', sail: '#FFFFFF', cockpit: '#C7CBD3', personality: "Reads the whole course, changes her mind, and is usually right.", beat: 'Push her into heavy air — the thinking stops working above sixteen knots.', archetype: 'shift', stats: { acceleration: 0, momentum: 0, handling: 3, upwind: -1, reach: 1, downwind: 1, pressure: 4, lightAir: 5, heavyAir: -4, memory: -5 } },
];


// Settings
const DEFAULT_SETTINGS = {
    navAids: true,
    // Stored in the polarity the Settings toggle shows. The boat carries the
    // inverse (boat.manualTrim) because the physics reads more naturally that way.
    autoTrim: true,
    soundEnabled: true,
    bgSoundEnabled: true,
    musicEnabled: false,
    penaltiesEnabled: true,
    surf: true,               // breaking seas on the windward shore — see drawSurf
    cameraMode: 'heading',
    // WHO YOU SAIL AS. The custom hull/sail/cockpit/spinnaker/pattern settings are gone:
    // you pick a character from the fleet and get their boat, their name and their face.
    // One way to say it instead of two — a recoloured Finley was not Finley, and the
    // player's appearance living in `settings` while everyone else's lived on the boat is
    // what put six `isPlayer ? settings.x : boat.colors.x` branches inside drawBoat.
    character: 'Finley',
    // Not part of the character: the telltales are an INSTRUMENT, not a livery, and no
    // character defines one.
    telltaleColor: '#fbbf24',
    venue: 'bay',
};

let settings = { ...DEFAULT_SETTINGS };

// --- Venues -------------------------------------------------------------------
// A venue is now a NAME and a DOCUMENT. What used to be here — wind range, condition
// ranges, island config, fx flags, water palette — is all gone: the wind is stated by wind
// regions, the puffs by gust sources, the stream by current regions, the geometry by shapes
// and marks, and the colours by the document's palette. What is left is the card copy the
// picker and the briefing show.
const VENUES = {
    bay: {
        name: 'Lighthouse Cove',
        tagline: 'Buoys & Breeze', water: 'Light chop', obstacles: 'Buoys, shore & traffic', tags: [['HONEST BREEZE','ok'],['ALL-ROUND TEST','ok']],
        label: 'Bay', emoji: '⛵',
        blurb: 'Buoys to port, lighthouse to starboard, no excuses anywhere. Fair water and honest breeze — every part of your game gets tested here.'
    },
    lake: {
        name: 'Stillwater Lake',
        tagline: 'Glass & Puffs', water: 'Flat glass', obstacles: 'Islands, skiffs & shoals', tags: [['DEAD SPOTS','warn'],['SHIFT READING','ok']],
        label: 'Lake', emoji: '🏞️',
        blurb: 'Mirror water and fickle mountain air. The breeze only whispers — racers who listen sail away from everyone parked in the glass.'
    },
    lagoon: {
        name: 'Pearl Lagoon',
        tagline: 'Squalls & Coral', water: 'Clear & flat', obstacles: 'Coral heads & reef passes', tags: [['RAIN SQUALLS','warn'],['CORAL HEADS','warn'],['SQUALL RIDING','ok']],
        label: 'Lagoon', emoji: '🐚',
        blurb: 'Turquoise flats, coral gates, and squalls marching down the trades. Duck the rain or ride it — the brave get wet and get ahead.',
        // Squalls + reef passes arrive in the Pearl Lagoon identity pass
    },
    swamp: {
        name: 'Gatorgrass Bayou',
        tagline: 'Dead Air & Weed', water: 'Still & weedy', obstacles: 'Grass islands & weed beds', tags: [['WEED BEDS','warn'],['KEEP HER MOVING','ok']],
        label: 'Swamp', emoji: '🐊',
        blurb: 'Thick air, thicker water. The wind sulks in the trees and the weed grabs at your keel — patience beats pace in here.'
    },
    river: {
        // Renamed from Sockeye Run (Aug 1 2026). Named for its witness, per the venues
        // doc convention — and the witness is Slipstream, who is already a SOCKEYE
        // salmon on the roster, whose beat line is "salmon cannot run downstream".
        // Bixby is a SEA otter and belongs on the coast; two otters confused them.
        // ⚠️ The key stays `river`: the document, the card art, the audio file and the
        // golden traces are all filed under it.
        name: 'Sockeye Run',
        tagline: 'Current & Rocks', water: 'Fast midstream', obstacles: 'Rocky banks', tags: [['SHALLOW BANKS','warn'],['LANE CHOICE','ok']],
        label: 'River', emoji: '🐟',
        blurb: 'The stream runs hard down the middle and dawdles along the banks. Pick the lane that pays and let the river carry you past the fleet.'
    },
    ocean: {
        name: 'Bluewater Bonanza',
        tagline: 'Swell & Speed', water: 'Long rolling swell', obstacles: 'None — open water', tags: [['UPWIND SLOG','warn'],['SURF THE SETS','ok']],
        label: 'Ocean', emoji: '🌊',
        blurb: 'Nothing out here but you, a steady breeze, and a mile of rolling swell. Surf hard downwind, grind out the beat — pure speed wins.'
    },
    redrock: {
        name: 'Redrock Reservoir',
        tagline: 'Cliffs & Gusts', water: 'Flat, wind-shadowed', obstacles: 'Rock spires & canyon walls', tags: [['WIND SHADOWS','warn'],['ROCK SPIRES','warn'],['LOCAL KNOWLEDGE','ok']],
        label: 'Reservoir', emoji: '🏜️',
        blurb: 'Sandstone walls carve the breeze into shadows, funnels and sudden gust-bombs. Learn the canyon and it fights for you.',
        // Terrain-shaped wind (wall shadows, venturi, williwaws) arrives in the identity pass
    },
    glowtide: {
        name: 'Glowtide Strait',
        tagline: 'Moonlight & Glow', water: 'Dark & glowing', obstacles: 'Rocky shores & lit marks', tags: [['NIGHT RACING','warn'],['GLOW READING','ok']],
        label: 'Strait', emoji: '🌙',
        blurb: 'Race by moonlight on water that burns blue where it moves. The dark hides the breeze — the glow gives it away, if you know how to look.',
        // Night rendering (dimmed world, glowing wakes/gust-threads) arrives in the identity pass
    },
    arctic: {
        name: 'Glacier Sound',
        tagline: 'Glacier Wind & Ice', water: 'Steep cold chop', obstacles: 'Drifting bergs & floes', tags: [['DRIFTING ICE','warn'],['OVERPOWERED','warn'],['GUST TIMING','ok']],
        label: 'Arctic', emoji: '🧊',
        blurb: 'Freezing katabatic winds pour off the ice cap and the pack drifts where it pleases. Mind the bergs, tame the gusts, survive to the finish.',
        // `overpowered` left here because too much breeze costs any boat anywhere — it is
        // physics keyed on the wind a boat measures, not a trait of this venue. `mask` and
        // `islandCourse` left because nothing read them: land comes from the document and
        // the course type is derived from the route.
    },
    // ⚠️ The KEY is `seatrials` and must stay that way whatever the venue is called.
    // It is the eval anchor: the harness pins it through localStorage
    // (`eval/eval_harness.js`), the document is `assets/venues/seatrials.venue.js`, the
    // card art is `assets/images/venues/seatrials.png`, and the golden traces are filed
    // under it. The display name below is the only part anyone is free to change.
    seatrials: {
        name: 'Clubhouse Point',
        tagline: 'Cans & Consistency', water: 'Calm, standard', obstacles: 'None', tags: [['NO SURPRISES','ok'],['TRUE BASELINE','ok']],
        label: 'Clubhouse', emoji: '⚓',
        blurb: 'Round the cans off the clubhouse — same course, same evening breeze, every week all season. Nothing out here is trying to beat you, which leaves only your own boatspeed to blame.'
    },
};

// Bay palette = whatever water.js shipped with; captured at load so venue
// switches can restore it.
let DEFAULT_WATER_PALETTE = null;

// Puff/lull tints follow the venue's water so cat's-paws read as pressure on
// THIS water, not blue patches pasted on top. Bay keeps the original blues.
const DEFAULT_GUST_COLORS = { gustDark: [9, 46, 130], gustMid: [11, 63, 176], lullBright: [150, 222, 255], lullMid: [120, 210, 255] };
let activeGustColors = DEFAULT_GUST_COLORS;

function applyVenuePalette(venueKey) {
    if (!window.WATER_CONFIG) return;
    if (!DEFAULT_WATER_PALETTE) {
        DEFAULT_WATER_PALETTE = {
            baseColor: window.WATER_CONFIG.baseColor,
            deepColor: window.WATER_CONFIG.deepColor,
            shallowColor: window.WATER_CONFIG.shallowColor,
            shorelineColor: window.WATER_CONFIG.shorelineColor
        };
    }
    // A venue DOCUMENT may override the water colours. Water is not an editable object —
    // it is wherever land and the arena are not — so what there is to author about it is
    // how it looks, and that belongs with the rest of the venue's design.
    // The DOCUMENT owns the water's look. It used to be a venue table with the document
    // allowed to override; the table is gone, so there is one place to change a colour.
    const docPal = (window.VenueDoc && window.VenueDoc.get(venueKey) || {}).palette;
    const pal = Object.assign({}, DEFAULT_WATER_PALETTE, docPal || {});
    const { gusts, ...waterPal } = pal;
    Object.assign(window.WATER_CONFIG, waterPal);
    // From the MERGED palette, so a document can author its puff colours. It used to read
    // `venuePal.gusts` alone, which meant `doc.palette.gusts` was silently ignored — the
    // one part of the water's look the editor could write and the game would not read.
    activeGustColors = gusts || DEFAULT_GUST_COLORS;
    GUST_SPRITES = null; // rebake puff/lull sprites in the new tint
}

// Apply a venue's condition ranges on top of resetGame's randomized defaults.
// Bay is a no-op (beyond clearing fx + restoring the palette) by design.


// A venue is now its NAME and its document. There is no weather table left to apply — wind,
// gusts and current are all stated by regions in the document, and the palette moved there
// too — so this only records which venue is being sailed.
//
// A key counts if it has a DOCUMENT, not only if it sits in the built-in VENUES table:
// the editor opens venue files under their own keys, and falling back to 'bay' here read
// the wrong document's palette for any of them.
function applyVenueConditions() {
    const known = settings.venue
        && (VENUES[settings.venue] || (window.VenueDoc && window.VenueDoc.get(settings.venue)));
    const key = known ? settings.venue : 'bay';
    state.race.venue = key;
    applyVenuePalette(key);
}

// What a venue is CALLED, wherever a person reads it. The document's own name wins —
// it is the file's, and a file may not be in the VENUES table at all — then the table's
// menu chrome, then the key.
function venueDisplayName(key) {
    const d = window.VenueDoc && window.VenueDoc.get(key);
    if (d && d.name) return d.name;
    const v = VENUES[key];
    return (v && (v.name || v.label)) || key || null;
}

// --- Venue mechanics -------------------------------------------------------


// Polar: above this effective wind, boats become overpowered and more wind stops being
// strictly faster. The heavyAir stat decides how much pace they bleed — it owns the whole
// wind-strength axis, and handling is pure turn rate. Coping used to be split with handling
// as well, which made a high-handling, high-heavyAir boat untouchable above the threshold.
// guidelines/skills.md 3.2.
// ── OVERPOWERED ─────────────────────────────────────────────────────────────
// Too much breeze costs you speed. This is NOT a property of a place — it is a boat's
// reaction to the wind it is actually in, so it is derived where that wind is measured and
// applies on every venue. It used to be `fx.overpowered`, set on Glacier Sound alone, which
// said that only in the Arctic does a squall cost you anything.
//
// THE THRESHOLD IS THE GATE, and it gates better than a hand-kept list of venues ever did:
// Gatorgrass tops out at 8 knots and will never pay this, Stillwater at 12 essentially never,
// while anywhere that genuinely reaches 18 pays it — which is the right answer arrived at by
// wind speed instead of by geography.
//
// `handlingRelief` is gone; it had been 0 since the relief moved to the heavyAir stat, and a
// dead constant in a tuning struct is a trap for whoever tunes it next.
// Apparent wind angle close-hauled: where the sheet comes fully in. True wind angle
// upwind is ~45 degrees, but the boat's own speed drags the apparent forward to ~25.
const AWA_CLOSE_HAULED = 25 * Math.PI / 180;
// Where a kite pays, in APPARENT. A boat carries a spinnaker by what the rig feels, which
// is why a fast boat holds one deeper than a slow one.
//
// TWO thresholds, not one, because the hoist takes FIVE SECONDS (`switchSpeed = dt / 5.0`)
// and halfway through it `jibFactor` and `spinFactor` are BOTH zero — a boat mid-hoist is
// carrying no sail at all. With a single threshold the decision chatters across it and the
// boat parks in that hole: measured 49% of beam-reach and 45% of running frames mid-hoist,
// costing a full 1.7 knots on the run. (The single-threshold TWA rule this replaces was
// already doing it at 38%/29% — the hysteresis is a fix for a defect that predates the
// apparent-wind move, which merely made it louder.)
//
// It is also just what a crew does. You hoist when it will clearly draw and you carry it
// through a brief luff rather than dousing and re-hoisting every few seconds.
// What a sail change costs at its worst, halfway through: both sails up, neither trimmed.
const SAIL_CHANGE_COST = 0.08;
const AWA_KITE_SET = 100 * Math.PI / 180;    // hoist once the apparent is this far aft
const AWA_KITE_DOUSE = 82 * Math.PI / 180;   // ...and do not douse until it comes this far forward

const OVERPOWERED = {
    threshold: 18,          // kt of TRUE wind the calibration is anchored at (see refMoment)
    // AWS^2 * sin(AWA) for a beam reach in `threshold` knots: a boat making 8 kt at TWA 90
    // sees AWS 19.7 at AWA 66, so 19.7^2 * sin(66) = 355. Pressure is reported relative to
    // this, so heel == 1.0 means "as pressed as a beam reach in 18 knots".
    refMoment: 355,
    heelThreshold: 1.0,     // nothing is charged below this
    // ...and this much speed per unit of pressure above it. Calibrated so a BEAM REACH —
    // where heel peaks — pays about the 21% the old flat rule charged at 25 kt true. That
    // keeps phase 1 a change of SHAPE and not of size: what moves is that the beat pays
    // less than the reach and the run pays nothing at all, which the old rule could not
    // express because it never looked at the angle.
    costPerHeel: 0.45,
    heavyAirRelief: 0.08,
    maxCost: 0.25,
    lagSeconds: 1.5         // heel is STATE. The lag is what makes it a situation you sail
                            // out of rather than a multiplier you look up.
};

// Keyed on the wind the BOAT measures — local, so a puff overpowers you and the lull after it
// does not, and reduced by dirty air because sitting in someone's bad air is less wind, not
// more. A boat with a high `pressure` stat feels gusts harder and so is exposed to this
// sooner: that is the trade for extracting more from them, and `heavyAir` is what buys it
// back.
// ── HEELING PRESSURE ────────────────────────────────────────────────────────────
// How hard the rig is being pressed, as a multiple of "as much as this boat wants".
//
//     heeling moment  ~  AWS^2 * sin(AWA)
//
// Sail force goes as the SQUARE of apparent wind speed; the athwartships component of it
// goes as the SINE of apparent wind angle. Those two terms produce the entire behaviour
// with no special cases anywhere:
//
//   close-hauled   AWS high (boat speed adds), AWA ~30    ->  pressed
//   beam reach     AWS highest, AWA ~75-90               ->  MOST pressed
//   broad / run    AWS low (boat speed SUBTRACTS), AWA ~150 -> barely pressed at all
//
// which is why bearing away in a blow is a real escape and not just a smaller penalty: it
// cuts both terms at once. It is also why the polar above is allowed to keep climbing
// downwind in 30 knots — a boat that deep is not overpowered, she is planing.
//
// Returns 1.0 at exactly the pressure a beam reach generates in OVERPOWERED.threshold
// knots of true wind, which is where the old flat rule started charging.
function heelPressure(aws, awa) {
    return (aws * aws * Math.sin(Math.abs(awa))) / OVERPOWERED.refMoment;
}

// The speed cost of being pressed. Replaces a flat tax on TRUE WIND SPEED that took no
// angle at all — under it a boat running dead downwind in 25 kt paid exactly what a boat
// beating in 25 kt paid, so the point of sail that should be FASTEST was penalised as hard
// as the one that should be slowest. Combined with the polar flatlining at 20 kt, 25 knots
// downwind came out strictly slower than 20.
//
// Magnitude is deliberately unchanged: a beam reach in 25 kt still pays about the 21% the
// old rule charged. The SHAPE moves, the SIZE does not — the beat pays less, the run pays
// nothing, and the total is calibrated at the same point it always was.
function overpoweredFactor(stats, heel) {
    // heavyAir, not handling — one stat owns wind strength. A heavy-air specialist carries
    // more pressure before it costs anything, which is the same trade the old rule made.
    const cope = Math.max(0.3, 1 - (stats.heavyAir || 0) * OVERPOWERED.heavyAirRelief);
    const over = heel - OVERPOWERED.heelThreshold;
    if (over <= 0) return 1.0;
    return 1 - Math.min(OVERPOWERED.maxCost, over * OVERPOWERED.costPerHeel * cope);
}



// Local water current. Uniform everywhere except the river, where it runs
// along the course axis — strongest midstream, dying (and slightly reversing
// as a counter-eddy) at the banks. Classic river tactics: ride the middle
// when it helps, hug the bank when it hurts.
// The AMBIENT current: a river venue's spatial field, or the uniform drift the player
// set. Split out so authored regions can add to whichever it is instead of replacing it.
// Does this venue have a current of its OWN — one that varies from place to place and is
// not the uniform drift the player dialled in? Two things can supply it: the river
// generator's analytic field, and AUTHORED current regions.
//
// Every readout used to ask the river's own current directly, which was the same
// question only while the river was the only venue with a stream. The moment a venue
// authors one, that test says no: the water tile shows the static blurb, the streamline
// particles never spawn, and the current knob offers to override a field it cannot see —
// all while the flow is pushing the fleet around.
function venueCurrent() {
    const regs = state.course && state.course.currentRegions;
    if (!regs || !regs.length) return null;
    // The strongest stream on the map, at its peak of the cycle: what a sailor would be
    // told to expect, not an average over water they may never sail.
    let max = 0;
    for (const r of regs) max = Math.max(max, r.speed + Math.abs(r.speedVar || 0));
    return { max,
             text: regs.length === 1 ? 'ONE STREAM ACROSS PART OF THE COURSE'
                                     : `${regs.length} STREAMS ACROSS PARTS OF THE COURSE` };
}

// The ambient stream — a uniform set over the whole course, when a race has one. The
// river's generated profile used to live here (a lateral cosine with a back-eddy at the
// banks and an along-course envelope that slackened at the line). It is gone with the rest
// of the river's current: moving water is a thing a document states, not a thing a venue
// key implies.
function ambientCurrentAt(x, y) {
    return state.race.conditions.current;
}

function getCurrentAt(x, y) {
    const base = ambientCurrentAt(x, y);
    // AUTHORED CURRENT REGIONS. The same construction as wind regions — polygon,
    // centered soft edge, and overlapping regions AVERAGED as a partition of unity,
    // with the leftover weight going to the ambient stream.
    //
    // Averaging is deliberate, and it replaced summing. A region states the flow THERE —
    // an absolute set and rate — and summing meant two statements about the same water
    // reinforced each other: the river mouth read 2.2 kt where the strongest authored
    // stream was 2.0, and the bay read 1.35 kt where nothing authored more than 0.3,
    // because three faint drift regions and the river's soft edge all piled up.
    // Averaged, overlap means BLEND: the river's jet dies smoothly into the bay drift it
    // overlaps, and nothing anywhere can run faster than the strongest thing authored.
    //
    // Direction averages as unit vectors and speed as a scalar, exactly as the wind
    // blend does and for the same reason: two opposed streams should hand over from one
    // to the other, not cancel into invented slack halfway.
    //
    // Touches no RNG (state.time only), so a current region cannot move the eval anchor.
    const creg = state.course.currentRegions;
    if (!creg || !creg.length) {
        if (!base || !(base.speed > 0.001)) return base;
        const f = shadowAt(x, y, base.direction, 'current');
        return f === 1 ? base : { speed: base.speed * f, direction: base.direction };
    }

    let wsum = 0, ux = 0, uy = 0, sacc = 0;
    for (const r of creg) {
        // Edge ramp centered on the outline, exactly as wind regions do — see
        // VenueDoc.regionWeight. The cull box pads by falloff/2 for the outside half.
        const bb = r.bb, pad = (r.falloff || 0) / 2 + 1;
        if (x < bb.minX - pad || x > bb.maxX + pad || y < bb.minY - pad || y > bb.maxY + pad) continue;
        const sd = Arena.signedDist(r, x, y);
        const w = VenueDoc.regionWeight(sd, r.falloff);
        if (w <= 0) continue;
        const osc = r.period > 0 ? Math.sin((state.time / r.period) * Math.PI * 2 + r.phase) : 0;
        const dir = r.direction + r.dirVar * osc;
        ux += Math.sin(dir) * w;
        uy += -Math.cos(dir) * w;
        sacc += Math.max(0, r.speed + r.speedVar * osc) * w;
        wsum += w;
    }
    if (wsum <= 0) {
        // Outside every region the water is the ambient stream, shaded like any flow.
        if (!base || !(base.speed > 0.001)) return base;
        const f = shadowAt(x, y, base.direction, 'current');
        return f === 1 ? base : { speed: base.speed * f, direction: base.direction };
    }
    // The leftover weight is the ambient stream's share — a region's soft edge fades
    // into whatever the water was already doing, which is slack on most venues.
    const wBase = Math.max(0, 1 - wsum);
    if (base && base.speed > 0 && wBase > 0) {
        ux += Math.sin(base.direction) * wBase;
        uy += -Math.cos(base.direction) * wBase;
        sacc += base.speed * wBase;
    }
    const total = wsum + wBase;
    const out = { speed: total > 0 ? sacc / total : 0, direction: Math.atan2(ux, -uy) };
    // Slack water behind a solid thing. Applied to the RESULTANT, because what a rock
    // shelters you from is whatever is actually flowing there — ambient stream and authored
    // regions together — not one contribution to it.
    if (out.speed > 0.001) out.speed *= shadowAt(x, y, out.direction, 'current');
    return out;
}






// ── Mask-baked geography ────────────────────────────────────────────────────
// The venue's land comes from a painted mask (assets/images/venues/masks/), baked
// to polygons by art/bake_mask.py. The mask is the single source of truth: navy
// water, white snow, grey granite, and a green start/finish line. Both the
// colliders and the drawn coast come from the same file, so what you paint is
// exactly what you sail.
//
// Replaces the procedural coast entirely for this venue. That version could not
// match a drawn map — it only ever produced a lobed front plus one wavy flank.
// World units the 0..1 mask spans. This is the venue's scale knob: doubling it
// doubles every distance, so the start->island leg and the race length scale
// with it. 25000 puts the leg around 14.7k units.
const MASK_WORLD = 8750;

// Ray-cast point-in-polygon. Mask landmasses are large and CONCAVE — the main
// one has a bounding radius of ~9400 units, more than half the world — so the
// bounding-circle test used for floes is meaningless against them and rejects
// every candidate position on the map. Anything asking "is this on land?" for a
// mask shape has to test the actual polygon.
function pointInPoly(x, y, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x, yi = verts[i].y, xj = verts[j].x, yj = verts[j].y;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
    }
    return inside;
}

// Is this position open water on a mask venue? Margin pushes it clear of the shore.
function inMaskWater(x, y, margin = 0) {
    const land = state.course.landShapes;
    if (!land) return true;
    for (const isl of land) {
        if (pointInPoly(x, y, isl.vertices)) return false;
        if (margin > 0) {
            // near-shore rejection: distance to the polygon edge
            for (let i = 0, j = isl.vertices.length - 1; i < isl.vertices.length; j = i++) {
                if (Geom.distToSegment({ x, y }, isl.vertices[j], isl.vertices[i]) < margin) return false;
            }
        }
    }
    return true;
}

// buildMaskGeography() lived here. It traced the painted mask into collider
// polygons at load time. Venue documents ARE those polygons now, so the
// conversion step is gone; art/bake_mask.py imports a mask into a document
// once, and nothing re-derives geometry at runtime.



// Ice-density gradient. 0 at the start end of the course, 1 at the glacier end;
// returns the probability that a candidate ice position survives sampling. The

// Polar ice floes: drifting islands. Slow enough for the AI's reactive
// avoidance; fast enough that the course never looks the same twice.
const FLOE_DENSITY = 3;

// Floe outlines, worked from aerial berg photography. Real ice is not a jittered
// circle: it lobes, it cuts deep bays, it snaps off into long shards and angular
// slabs. Building the radius as a harmonic sum gives those organic lobes and
// concave bays, and squashing along a random axis gives the elongation. Five
// archetypes, weighted so lobed bergs and shards show up most.
// 'shard' was weighted twice and reaches aspect 3.0, which read as a field of
// long splinters. One entry, and a shorter maximum.
const FLOE_KINDS = ['pan', 'slab', 'shard', 'lobed', 'cluster', 'lobed', 'pan'];
function makeFloeOutline(r, rng) {
    const kind = FLOE_KINDS[Math.floor(rng() * FLOE_KINDS.length)];
    // Spread the amplitude over several NON-multiple frequencies with random
    // phases. One dominant harmonic gives f-fold symmetry, and a floe that is
    // cleanly 3- or 4-fold symmetric reads as a flower, not as ice. The f=1
    // term shoves the mass off-centre, which is what kills the symmetry.
    let points, harm, aspect, bayCount;
    if (kind === 'pan') {                 // rounded drift pan
        points = 11 + Math.floor(rng() * 4);
        harm = [[1, 0.05], [2, 0.05], [3, 0.04], [5, 0.03]];
        aspect = 1.0 + rng() * 0.2; bayCount = 0;
    } else if (kind === 'slab') {         // angular tabular plate, few long edges
        points = 5 + Math.floor(rng() * 3);
        harm = [[1, 0.12], [2, 0.09], [3, 0.05]];
        aspect = 1.25 + rng() * 0.5; bayCount = rng() < 0.3 ? 1 : 0;
    } else if (kind === 'shard') {        // long splinter calved off something
        points = 8 + Math.floor(rng() * 4);
        harm = [[1, 0.16], [2, 0.10], [3, 0.08], [5, 0.05]];
        aspect = 1.6 + rng() * 0.6; bayCount = rng() < 0.5 ? 1 : 0;
    } else if (kind === 'lobed') {        // the classic deep-bayed berg
        points = 15 + Math.floor(rng() * 7);
        harm = [[1, 0.14], [2, 0.13], [3, 0.11], [5, 0.07]];
        aspect = 1.1 + rng() * 0.45; bayCount = 1 + (rng() < 0.4 ? 1 : 0);
    } else {                              // knuckly cluster of fused chunks
        points = 18 + Math.floor(rng() * 9);
        harm = [[1, 0.10], [2, 0.10], [3, 0.08], [5, 0.07], [8, 0.05], [13, 0.04]];
        aspect = 1.0 + rng() * 0.3; bayCount = rng() < 0.5 ? 1 : 0;
    }
    const H = harm.map(([f, a]) => ({ f, a, p: rng() * Math.PI * 2 }));
    const bays = [];
    for (let i = 0; i < bayCount; i++) {
        bays.push({ at: rng() * Math.PI * 2, w: 0.35 + rng() * 0.5, d: 0.25 + rng() * 0.3 });
    }

    const pts = [];
    for (let i = 0; i < points; i++) {
        const th = (i / points) * Math.PI * 2;
        let k = 1;
        for (const h of H) k += h.a * Math.cos(h.f * th + h.p);
        for (const b of bays) {
            // angular distance to the bay centre, wrapped to [0, PI]
            const d = Math.abs(((th - b.at + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (d < b.w) k -= b.d * (1 + Math.cos(Math.PI * d / b.w)) * 0.5;
        }
        k = Math.max(0.32, k);
        pts.push({ x: Math.cos(th) * r * k, y: Math.sin(th) * r * k });
    }

    // Squash along one axis, then swing that axis to a random bearing
    const rot = rng() * Math.PI * 2, cr = Math.cos(rot), sr = Math.sin(rot);
    let maxD = 0;
    for (const p of pts) {
        const ex = p.x * aspect, ey = p.y / aspect;
        p.x = ex * cr - ey * sr; p.y = ex * sr + ey * cr;
        maxD = Math.max(maxD, Math.hypot(p.x, p.y));
    }
    // Renormalise: isl.radius is the broad-phase bound for collision and for the
    // AI's avoidance, so the outline must not poke outside it.
    if (maxD > 0) { const k = r / maxD; for (const p of pts) { p.x *= k; p.y *= k; } }
    return pts;
}

// Distance from the shape's origin out to its outline along `ang`. Ray-casts
// against every edge and takes the nearest hit, so it is correct for the
// concave bays too, where a bounding radius would be wildly optimistic.
function outlineRadiusAt(pts, ang) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        const ex = q.x - p.x, ey = q.y - p.y;
        const den = ex * dy - dx * ey;
        if (Math.abs(den) < 1e-9) continue;          // edge parallel to the ray
        const t = (ex * p.y - ey * p.x) / den;       // distance along the ray
        const u = (dx * p.y - dy * p.x) / den;       // position along the edge
        if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
    }
    return Number.isFinite(best) ? best : 0;
}

// Andrew's monotone chain. Wound the same way as the old generated outlines
// (increasing theta) so satPolygonPolygon sees the winding it always has.
function convexHullOf(pts) {
    if (pts.length < 3) return pts.slice();
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const q of p) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
        lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
        const q = p[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
        upper.push(q);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
}

// `artOverride` is an AUTHORED outline in local coordinates — hand-placed ice from a
// venue document, where the shape is designed rather than generated. Everything else
// still comes from the race RNG, so an authored floe has a designed position and shape
// but a fresh drift, spin and wander every race.
function makeFloe(cx, cy, r, rng, artOverride) {
    // The drawn outline may be deeply concave; the COLLIDER is its convex hull,
    // because satPolygonPolygon assumes convexity — feed it a bayed polygon and
    // boats "hit" open water inside the bay. Hulling outward is the safe error:
    // a boat may stop a little short of a cleft, but never sails through ice.
    const localArt = artOverride || makeFloeOutline(r, rng);
    const localHull = convexHullOf(localArt);
    const localVeg = localArt.map(p => ({ x: p.x * 0.7, y: p.y * 0.7 }));
    // World-space mirrors; syncFloe rebuilds these from the local shape each frame
    const vertices = localHull.map(p => ({ x: cx + p.x, y: cy + p.y }));
    const vegVertices = localVeg.map(p => ({ x: cx + p.x, y: cy + p.y }));

    // Pressure cracks: 2-4 jagged strokes across the surface (relative coords,
    // baked into the sprite so they ride along as the floe drifts).
    //
    // Placed against the outline's LOCAL radius, not the floe's bounding r. Only
    // the widest point of a lobed or elongated floe reaches r, so a fraction of
    // r fired down a narrow axis lands well outside the ice — which is exactly
    // how cracks ended up hanging in open water. (The bake also clips them to
    // the silhouette, which catches the curve's bulge between the endpoints.)
    const cracks = [];
    const crackCount = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < crackCount; k++) {
        const a1 = rng() * Math.PI * 2;
        const a2 = a1 + Math.PI * (0.6 + rng() * 0.5);
        const e1 = outlineRadiusAt(localArt, a1), e2 = outlineRadiusAt(localArt, a2);
        const r1 = e1 * (0.25 + rng() * 0.5), r2 = e2 * (0.3 + rng() * 0.55);
        const midJitter = (rng() - 0.5) * Math.min(e1, e2) * 0.3;
        cracks.push({
            ax: Math.cos(a1) * r1, ay: Math.sin(a1) * r1,
            mx: Math.cos((a1 + a2) / 2) * midJitter, my: Math.sin((a1 + a2) / 2) * midJitter,
            bx: Math.cos(a2) * r2, by: Math.sin(a2) * r2
        });
    }

    // Angular facet planes — the low-poly ice look the style guide calls for.
    // Indexed against the ART outline, which is what gets drawn.
    const facets = [];
    if (r > 110) {
        const facetCount = 2 + Math.floor(rng() * 4);
        for (let k = 0; k < facetCount; k++) {
            facets.push({ i: Math.floor(rng() * localArt.length), depth: 0.1 + rng() * 0.3, shade: rng() });
        }
    }

    // Each floe wanders on its OWN heading and rate — the pack has no common
    // direction. Bergs are ponderous; drift ice skates.
    const speed = (8 + rng() * 14) * (r > 220 ? 0.45 : 1); // units/sec
    const dir = rng() * Math.PI * 2;

    return {
        // soft: true — RRS 31 penalizes touching MARKS, not obstructions.
        // Hitting ice costs you 60% of your speed (hull damage), not a 360;
        // rules penalties in the Arctic come from fouling BOATS (incl. Rule 19
        // squeezes into the ice, which stay very much illegal).
        x: cx, y: cy, radius: r, vertices, vegVertices, trees: [], rocks: [], cracks, facets, soft: true,
        style: 'ice', isFloe: true,
        localArt, localHull, localVeg,
        driftVx: Math.sin(dir) * speed,
        driftVy: -Math.cos(dir) * speed,
        // Ice spins as it drifts. Small pans twirl, bergs barely turn.
        spin: rng() * Math.PI * 2,
        spinRate: (rng() < 0.5 ? -1 : 1) * (0.08 + rng() * 0.27) * (r > 220 ? 0.4 : 1),
        // Slow heading curl so paths curve instead of running straight
        wanderPhase: rng() * Math.PI * 2,
        wanderRate: 0.1 + rng() * 0.25
    };
}

// ---- Floe colonies ------------------------------------------------------
//
// Penguins ride the ice. Every bird lives in its floe's LOCAL space, which is
// what makes this nearly free: the floe already drifts, curls its heading and
// spins, and drawIslands already draws it inside a translate/rotate. Put the
// birds in that same transform and the whole colony inherits the motion with
// no animation code at all — the waddle below is only what the bird adds on
// top of a ride it gets for nothing.
//
// One species per floe. Real rookeries are single-species, and mixing them
// would throw away the only channel species actually reads on: a colony that
// all moves the same way is recognisably one kind of animal.

// Fraction of the outline radius birds stay inside. They draw from their
// centre, so this has to clear half a bird plus the snow rim, or they stand
// with one foot in the water.
const COLONY_INSET = 0.72;

// Waddle gait. The rock and the forward step are ONE motion — see updateFloeColony.
// WADDLE_SURGE is the floor of forward speed at mid-lean; the rest is delivered in
// two surges per rock cycle, as the bird pivots over each foot. Lower = more
// lurching, 1.0 = a constant glide with an unrelated wobble on top.
const WADDLE_SURGE = 0.35;
// Rock amplitude retained while standing still, so an idle bird settles rather
// than freezing solid.
const WADDLE_IDLE = 0.12;
// Max turn rate, rad/s, when steering back off a boundary. Birds STEER toward a
// legal heading rather than being assigned one — an instant assignment flipped a
// bird up to 176 degrees in one frame and re-fired every frame while it sat on
// the boundary. Halved from 2.6: a bird that spins on the spot reads as a
// weathervane, and a penguin turns its whole body slowly.
const WADDLE_TURN = 1.3;
// Peak rate of the wandering heading curl, rad/s. Halved from 0.9 for the same
// reason — this is the meander you see while a bird is walking freely.
const WADDLE_CURL = 0.45;




// Translate only — the world-space geometry is rebuilt by syncFloe once all
// motion and collisions for the frame have settled.
function moveFloe(isl, dx, dy) {
    isl.x += dx; isl.y += dy;
}

// Rebuild the world-space collider and snow cap from the floe's local shape,
// its position and its current spin.
function syncFloe(isl) {
    const c = Math.cos(isl.spin), s = Math.sin(isl.spin);
    for (let i = 0; i < isl.localHull.length; i++) {
        const p = isl.localHull[i], w = isl.vertices[i];
        w.x = isl.x + p.x * c - p.y * s;
        w.y = isl.y + p.x * s + p.y * c;
    }
    for (let i = 0; i < isl.localVeg.length; i++) {
        const p = isl.localVeg[i], w = isl.vegVertices[i];
        w.x = isl.x + p.x * c - p.y * s;
        w.y = isl.y + p.x * s + p.y * c;
    }
}


const snowRand = mulberry32(40713);

// Visual-effect PRNG. Particle spawning (spray, wake foam, wind streaks, current
// swirls) lives inside update() rather than draw(), so it was drawing from
// Math.random — the SIMULATION stream.
//
// That made the sim depend on the camera: the spawn point is sampled near
// state.camera, and the follow-up draws are CONDITIONAL on what is at that point
// (`if (local.speed > 0.15)`, `if (rel > 0.85)`). Look somewhere else and a
// different NUMBER of draws is consumed, so every subsequent boat, gust and
// shift changes. The camera is never reset between races, so race 2 in a session
// raced differently from race 1 — and the AI eval, which runs 100 trials in one
// page, carried each trial's final camera position into the next.
//
// Particles are strictly visual (state.particles is read only by updateParticles
// and the draw loops), so they get their own stream and the sim stops noticing
// them. Deliberately NOT reseeded per race: visual variety across races is fine,
// and it can no longer reach the simulation.
const fxRand = mulberry32(0x5EED17);


// Calving: the face drops new ice into the water DURING the race. This is the
// one hazard that makes lap three a different course from lap one — the gap you
// used on the way up may not be there on the way back.
//
// Deliberately conservative: a hard cap on total spawns, a clear-water check
// against every boat and every existing floe, and nothing spawned before the
// start. A berg materializing on top of a boat would be unfair in a way no
// amount of drama pays for.


// The bots' grid, refreshed with the floes where they ARE. The static build knows
// only authored land, so the router threaded floe fields blind and the fleet ground
// through the pack at 60% speed loss per contact-frame. Rebuilding nav+clearance a
// few times a minute keeps route, carrot and escape all seeing the same true water.
// The wind fields ride along from the static build — regions don't move.
function refreshBotGrid() {
    const c = state.course;
    if (!c || !c._gridFixed || !c._botGridStatic || !window.SailCheck) return;
    if (c._botGridT != null && state.time - c._botGridT < 4) return;
    c._botGridT = state.time;
    // Floes go in as their HULL POLYGONS, not bounding circles. A lobed floe's
    // circle is fatter than its collider almost everywhere — with 112 of them the
    // circle-stamped grid closed 200-unit gaps that physically exist, and the
    // "impossible" rounding maze was partly an artifact of the AI's own map.
    // Positions at the MID-CADENCE prediction (+2s), like before.
    const floePolys = [];
    const floeCircles = [];
    for (const f of (c.islands || [])) {
        if (!f.isFloe) continue;
        const sx = (f.driftVx || 0) * 2, sy = (f.driftVy || 0) * 2;
        if (f.vertices && f.vertices.length >= 3) {
            floePolys.push({ outer: f.vertices.map(v => [v.x + sx, v.y + sy]), holes: [] });
        } else {
            floeCircles.push({ x: f.x + sx, y: f.y + sy, radius: (f.radius || 0) + 15 });
        }
    }
    const g = window.SailCheck.buildGrid(c._gridFixed.concat(floePolys), c.boundary, floeCircles);
    g._leeW = c._botGridStatic._leeW;
    g._wfx = c._botGridStatic._wfx;
    g._wfy = c._botGridStatic._wfy;
    g._wbin = c._botGridStatic._wbin;
    // FLOE RISK: water near drifting ice is worth avoiding when open water is
    // affordable — the router should go AROUND a pack unless threading it is
    // clearly cheaper on the polar (this is what lets a route be "wider than the
    // narrowest channel"). Bounded like every hint, so it can never invert the
    // topology; a pack across the only channel still gets threaded.
    const risk = new Uint8Array(g.n * g.n);
    for (const f0 of (c.islands || [])) {
        if (!f0.isFloe) continue;
        const f = { x: f0.x + (f0.driftVx || 0) * 2, y: f0.y + (f0.driftVy || 0) * 2, radius: f0.radius || 0 };
        const rr = f.radius + 36;
        const c0 = g.cell(f.x - rr, f.y - rr), c1 = g.cell(f.x + rr, f.y + rr);
        for (let j = Math.max(0, c0[1]); j <= Math.min(g.n - 1, c1[1]); j++) {
            for (let i = Math.max(0, c0[0]); i <= Math.min(g.n - 1, c1[0]); i++) {
                const [wx, wy] = g.world(i, j);
                if ((wx - f.x) ** 2 + (wy - f.y) ** 2 < rr * rr) risk[j * g.n + i] = 1;
            }
        }
    }
    g._floeRisk = risk;
    // Live floe objects, cached for the bots' trajectory planner (allocating a
    // filtered list per controller tick is pure garbage pressure).
    c._floeObjs = (c.islands || []).filter(i => i.isFloe);
    // SOFT CELLS + LEADS. Water blocked by FLOES ONLY (navigable on the land-only
    // static grid) is soft — ice contact costs speed, not a penalty. And because
    // every floe's drift is KNOWN, each soft cell can be priced by its FUTURE:
    // a lead that is OPENING (floe gone in ~8s) is water you arrive at as it
    // clears; one that stays plugged is nearly a wall. Sea-ice pilots route on
    // exactly this: take the opening lead, never the closing one.
    const HORIZON = 8;
    const futureBlk = new Uint8Array(g.n * g.n);
    for (const f0 of (c.islands || [])) {
        if (!f0.isFloe) continue;
        const fx = f0.x + (f0.driftVx || 0) * HORIZON, fy = f0.y + (f0.driftVy || 0) * HORIZON;
        const rr = (f0.radius || 0) + 15 + 13;
        const c0 = g.cell(fx - rr, fy - rr), c1 = g.cell(fx + rr, fy + rr);
        for (let j = Math.max(0, c0[1]); j <= Math.min(g.n - 1, c1[1]); j++) {
            for (let i = Math.max(0, c0[0]); i <= Math.min(g.n - 1, c1[0]); i++) {
                const [wx, wy] = g.world(i, j);
                if ((wx - fx) ** 2 + (wy - fy) ** 2 < rr * rr) futureBlk[j * g.n + i] = 1;
            }
        }
    }
    // _soft: 0 = not soft; 1 = OPENING lead; 2 = staying plugged.
    const soft = new Uint8Array(g.n * g.n);
    const statNav = c._botGridStatic.nav;
    for (let ii = 0; ii < soft.length; ii++) {
        if (statNav[ii] === 1 && g.nav[ii] === 0) soft[ii] = futureBlk[ii] ? 2 : 1;
    }
    g._soft = soft;
    // Persist the +8s occupancy for the ring scans: a sector that is clear NOW
    // but CLOSING is the worst place to wait (measured 104/146 armed seconds
    // lost in one) — the scans discount it and prefer opening leads.
    g._futBlk = futureBlk;
    c.botGrid = g;   // _clear is rebuilt lazily on first pathSailable
}

function updateIceFloes(dt) {
    if (!state.course.islands) return;
    const boundary = state.course.boundary;
    if (!boundary) return;

    // Ice drifts at ~2-3% of the wind, skewed slightly off the wind axis.
    // (0.55 -> 0.45: slower ice erodes the AI's avoidance margins less)
    const d = state.wind.direction;
    const base = state.wind.speed * 0.45; // units/sec at driftFactor 1

    // Floes moved: invalidate the planner's inflated-island cache
    if (state.course.navVersion !== undefined) state.course.navVersion++;
    refreshBotGrid();

    const floes = [];
    for (const isl of state.course.islands) {
        if (!isl.isFloe) continue;
        floes.push(isl);

        // Slow deterministic heading curl: each floe's own velocity rotates
        // gently, so paths curve and meander without any per-frame RNG.
        const curl = Math.sin(state.time * isl.wanderRate + isl.wanderPhase) * 0.12 * dt;
        const cosC = Math.cos(curl), sinC = Math.sin(curl);
        const nvx = isl.driftVx * cosC - isl.driftVy * sinC;
        isl.driftVy = isl.driftVx * sinC + isl.driftVy * cosC;
        isl.driftVx = nvx;

        moveFloe(isl, isl.driftVx * dt, isl.driftVy * dt);
        isl.spin += isl.spinRate * dt;

        // Arena rim: bounce back inward (reflect velocity about the inward
        // normal) instead of teleport-respawning.
        // Keep half a floe-radius of clearance from the edge, whatever shape it is.
        const _inset = isl.radius * 0.5;
        const _scn2 = state.course.scenery || boundary;
        const _sd = Arena.signedDist(_scn2, isl.x, isl.y);
        if (_sd < _inset) {
            const n = Arena.outward(_scn2, isl.x, isl.y);
            const dot = isl.driftVx * n.x + isl.driftVy * n.y;
            if (dot > 0) {
                isl.driftVx -= 2 * dot * n.x;
                isl.driftVy -= 2 * dot * n.y;
            }
            // ABSOLUTE, deliberately: the scenery extent is the one edge nothing may be seen
            // outside, so it is restored in full every frame rather than eased like the land
            // and ice-on-ice corrections. Capping it to their rate let those two push a floe
            // out faster than this could pull it back, and ice escaped by up to 1015 units.
            //
            // It cannot jump visibly any more, because the case that made it jump is gone:
            // a floe authored far outside used to be hauled 300-941 units on the first frame,
            // and settleFloes() now resolves that before anything is drawn. What is left here
            // is drift, which is a fraction of a unit per frame.
            moveFloe(isl, (_sd - _inset) * n.x, (_sd - _inset) * n.y);
        }

    }

    // Floe-on-floe BOUNCE: mass-weighted positional separation plus an
    // elastic velocity reflection — converging ice visibly rebounds, bergs
    // barely notice, small floes ricochet.
    for (let i = 0; i < floes.length; i++) {
        for (let j = i + 1; j < floes.length; j++) {
            const a = floes[i], b = floes[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const minD = (a.radius + b.radius) * 0.92; // vertices are jagged; slight visual overlap is fine
            const d2 = dx * dx + dy * dy;
            if (d2 >= minD * minD || d2 < 1) continue;
            const dist = Math.sqrt(d2);
            const nx = dx / dist, ny = dy / dist;
            const overlap = minD - dist;
            const mA = a.radius * a.radius, mB = b.radius * b.radius;
            const shareA = mB / (mA + mB), shareB = mA / (mA + mB);
            // CAPPED to the same rate as every other correction here, so no floe is ever moved
            // faster than it can be seen to move. settleFloes() clears the authored overlaps
            // before the first frame, but a pinch — ice held against ice by a shore that will
            // not yield — has no solution to converge to, and resolving one of those in a
            // single uncapped step is exactly the jump this whole pass exists to prevent.
            const corr = Math.min(overlap, Math.max(2, FLOE_PUSH_RATE * dt));
            moveFloe(a, -nx * corr * shareA, -ny * corr * shareA);
            moveFloe(b, nx * corr * shareB, ny * corr * shareB);

            // 1D elastic collision along the normal (restitution 0.85)
            const vaN = a.driftVx * nx + a.driftVy * ny;
            const vbN = b.driftVx * nx + b.driftVy * ny;
            if (vaN - vbN > 0) { // closing
                const e = 0.85;
                const vaN2 = (mA * vaN + mB * vbN - mB * e * (vaN - vbN)) / (mA + mB);
                const vbN2 = (mA * vaN + mB * vbN + mA * e * (vaN - vbN)) / (mA + mB);
                a.driftVx += (vaN2 - vaN) * nx; a.driftVy += (vaN2 - vaN) * ny;
                b.driftVx += (vbN2 - vbN) * nx; b.driftVy += (vbN2 - vbN) * ny;

                // Glancing blows spin the ice up. Tangential closing speed
                // becomes angular impulse, scaled down by size so a berg shrugs
                // it off while a small pan gets kicked into a twirl.
                const vRelT = (a.driftVx - b.driftVx) * -ny + (a.driftVy - b.driftVy) * nx;
                a.spinRate = clampSpin(a.spinRate - vRelT * 0.9 / a.radius);
                b.spinRate = clampSpin(b.spinRate + vRelT * 0.9 / b.radius);
            }
        }
    }

    // One rebuild per floe, after every push and bounce has settled
    for (const isl of floes) syncFloe(isl);

    // Shore pass, last, so the coastline always wins: the floe-on-floe separation above can
    // shove ice back into land, and whatever land says here is what stands this frame.
    //
    // ICE IS PUSHED OFF A SHORE, NEVER TELEPORTED OFF IT. This used to sample a random point
    // in the scenery and jump the floe there — a berg vanishing from one headland and
    // reappearing half a course away, 58 times in a three-minute race on Glacier Sound with
    // 112 authored floes. Nothing about a drifting object may be discontinuous; a player
    // watching a berg has every right to expect it to still be there.
    //
    // So: find the shortest way out of the polygon and take a step along it, and reflect the
    // drift that was carrying the floe in. A floe deep inside a shape needs several frames to
    // walk out, which is correct — it slides off the shore the way it slid on.
    // A RATE, not a per-frame constant: the push is a velocity like any other motion, so it
    // looks the same at 30fps as at 144 and a big berg leaves a shore no faster than a small
    // one. 150 units/sec against a drift of about 9 — firm, and still plainly movement.
    for (const f of floes) pushFloeOffLand(f, Math.max(2, FLOE_PUSH_RATE * dt));
}

// How fast ice is pushed out of land it has drifted into, in units/sec.
const FLOE_PUSH_RATE = 150;

// The shortest way out of any land this floe overlaps, taken as a step of at most `maxStep`.
// Shared by the per-frame shore pass and the settle pass that runs once at course build, so
// the two cannot disagree about which way "out" is.
function pushFloeOffLand(f, maxStep) {
    const land = state.course.landShapes;
    if (!land) return false;
    let moved = false;
    for (const isl of land) {
        const R = f.radius * 0.9;
        if (!circlePolyCollide(f.x, f.y, R, isl.vertices)) continue;
        // Nearest point on the outline, and which side of it the centre is on.
        const verts = isl.vertices;
        let bestD2 = Infinity, bx = 0, by = 0;
        for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
            const q = getClosestPointOnSegment(f.x, f.y, verts[j].x, verts[j].y, verts[i].x, verts[i].y);
            const dx = f.x - q.x, dy = f.y - q.y, d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; bx = q.x; by = q.y; }
        }
        const inside = pointInPoly(f.x, f.y, verts);
        const d = Math.sqrt(bestD2) || 1e-6;
        // Outward: away from the outline when the centre is already outside it, toward the
        // outline when the centre has ended up within.
        let ox = (f.x - bx) / d, oy = (f.y - by) / d;
        if (inside) { ox = -ox; oy = -oy; }
        const need = inside ? (d + R) : (R - d);
        if (!(need > 0)) continue;
        const step = Math.min(need, maxStep);
        moveFloe(f, ox * step, oy * step);
        // Kill the drift still carrying it in, with a little bounce.
        const into = f.driftVx * ox + f.driftVy * oy;
        if (into < 0) {
            f.driftVx -= 1.6 * into * ox;
            f.driftVy -= 1.6 * into * oy;
        }
        moved = true;
    }
    if (moved) syncFloe(f);
    return moved;
}

// Resolve authored overlaps ONCE, before the first frame is ever drawn.
//
// A document may place ice over land or outside the scenery — nothing stops it, and Glacier
// Sound's 112 hand-placed floes do both. Left to the per-frame push those would spend the
// opening seconds visibly sliding out, which is the same complaint as the teleport in a
// politer voice. Doing it here means the race opens with the ice where it will actually be.
function settleFloes() {
    const floes = (state.course.islands || []).filter(i => i.isFloe);
    if (!floes.length) return;
    const scn = state.course.scenery || state.course.boundary;

    // Rim, land and ice-on-ice are ONE relaxation, not three phases in sequence: pushing a
    // floe off a headland can bury it in its neighbour, and separating that pair can put one
    // of them back on the headland. Run in sequence, whichever ran last won and the loser was
    // still overlapping when the first frame arrived — which the uncapped per-frame bounce
    // then resolved in a single visible jump. Interleaved, they converge.
    for (let round = 0; round < 16; round++) {
        let worst = 0;
        const before = floes.map(f => ({ x: f.x, y: f.y }));

        for (const f of floes) {
            if (scn) {
                const inset = f.radius * 0.5;
                const sd = Arena.signedDist(scn, f.x, f.y);
                if (sd < inset) {
                    const n = Arena.outward(scn, f.x, f.y);
                    moveFloe(f, -(inset - sd) * n.x, -(inset - sd) * n.y);
                }
            }
            // Uncapped here: nothing is on screen yet, so there is no motion to be smooth.
            for (let k = 0; k < 8; k++) if (!pushFloeOffLand(f, f.radius)) break;
        }

        // Positions only — no velocity change. Nothing has collided; they were simply drawn
        // overlapping, and a document's ice should not start the race already rebounding.
        for (let i = 0; i < floes.length; i++) {
            for (let j = i + 1; j < floes.length; j++) {
                const a = floes[i], b = floes[j];
                const dx = b.x - a.x, dy = b.y - a.y;
                const minD = (a.radius + b.radius) * 0.92;
                const d2 = dx * dx + dy * dy;
                if (d2 >= minD * minD || d2 < 1) continue;
                const dist = Math.sqrt(d2);
                const nx = dx / dist, ny = dy / dist, overlap = minD - dist;
                const mA = a.radius * a.radius, mB = b.radius * b.radius;
                moveFloe(a, -nx * overlap * (mB / (mA + mB)), -ny * overlap * (mB / (mA + mB)));
                moveFloe(b, nx * overlap * (mA / (mA + mB)), ny * overlap * (mA / (mA + mB)));
            }
        }

        for (let i = 0; i < floes.length; i++) {
            const d = Math.hypot(floes[i].x - before[i].x, floes[i].y - before[i].y);
            if (d > worst) worst = d;
        }
        if (worst < 0.5) break;
    }

    // THE RIM HAS THE LAST WORD, so "inside the scenery extent" is this function's guarantee
    // and not merely its usual outcome. The relaxation above does not always reach it: five of
    // Glacier Sound's floes are big enough (radius 519 to 1095) to be pushed back out by land
    // as fast as the rim pulls them in, and they were still up to 941 units outside when the
    // loop gave up — which the per-frame clamp then took back in one visible jump.
    //
    // A floe left touching land here is fine: the per-frame shore push eases it off over the
    // next second at a rate nobody reads as a jump. A floe left outside the world is not.
    if (scn) {
        for (const f of floes) {
            // Iterated: one correction is exact against the nearest EDGE, and a floe pushed
            // in past a corner can come to rest outside a different one.
            for (let k = 0; k < 8; k++) {
                const inset = f.radius * 0.5;
                const sd = Arena.signedDist(scn, f.x, f.y);
                if (sd >= inset) break;
                const n = Arena.outward(scn, f.x, f.y);
                moveFloe(f, -(inset - sd) * n.x, -(inset - sd) * n.y);
            }
        }
    }
    for (const f of floes) syncFloe(f);
}

// (clearOfCourse lived here. It vetoed a relocation that landed on the start line or a mark,
// which was the right guard on the wrong mechanism — ice is pushed off a shore now and never
// relocated at all, so there is no random destination left to veto.)

// Ice that spins faster than this reads as a cartoon top, not a floe
function clampSpin(w) { return Math.max(-0.75, Math.min(0.75, w)); }

// ---------------------------------------------------------------------------




// J/111 Polar Data
const J111_POLARS = {
    angles: [0, 30, 38, 45, 52, 60, 75, 90, 110, 120, 135, 150, 180],
    speeds: {
        6: {
            spinnaker: [0.0, 0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.46, 5.5, 5.48, 5.25, 4.72, 4.01],
            nonSpinnaker: [0.0, 0.0, 4.7, 4.93, 5.18, 5.29, 5.36, 5.46, 4.94, 4.65, 4.08, 3.51, 3.01]
        },
        8: {
            spinnaker: [0.0, 0.0, 0.6, 1.2, 1.8, 2.4, 3.5, 6.79, 6.87, 6.85, 6.58, 5.94, 5.06],
            nonSpinnaker: [0.0, 0.0, 5.8, 6.09, 6.41, 6.55, 6.65, 6.79, 6.17, 5.82, 5.12, 4.42, 3.8]
        },
        10: {
            spinnaker: [0.0, 0.0, 0.7, 1.4, 2.1, 2.8, 4.0, 7.89, 8.01, 8.01, 7.72, 6.99, 6.0],
            nonSpinnaker: [0.0, 0.0, 6.66, 7.0, 7.38, 7.56, 7.7, 7.89, 7.2, 6.8, 6.0, 5.2, 4.5]
        },
        12: {
            spinnaker: [0.0, 0.0, 0.8, 1.6, 2.4, 3.2, 4.5, 8.6, 8.74, 8.75, 8.44, 7.65, 6.58],
            nonSpinnaker: [0.0, 0.0, 7.23, 7.6, 8.02, 8.22, 8.38, 8.6, 7.85, 7.42, 6.56, 5.69, 4.93]
        },
        14: {
            spinnaker: [0.0, 0.0, 0.9, 1.8, 2.7, 3.6, 5.0, 9.01, 9.18, 9.2, 8.89, 8.08, 6.98],
            nonSpinnaker: [0.0, 0.0, 7.52, 7.91, 8.36, 8.57, 8.76, 9.01, 8.25, 7.81, 6.91, 6.01, 5.23]
        },
        16: {
            spinnaker: [0.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.5, 9.42, 9.66, 9.7, 9.42, 8.59, 7.47],
            nonSpinnaker: [0.0, 0.0, 7.76, 8.18, 8.66, 8.9, 9.13, 9.42, 8.68, 8.24, 7.32, 6.39, 5.61]
        },
        20: {
            spinnaker: [0.0, 0.0, 1.2, 2.4, 3.6, 4.8, 6.5, 10.43, 10.87, 11.01, 10.81, 9.98, 8.88],
            nonSpinnaker: [0.0, 0.0, 8.2, 8.7, 9.26, 9.6, 9.98, 10.43, 9.77, 9.35, 8.4, 7.42, 6.66]
        },
        // ── ABOVE 20 KNOTS: EXTRAPOLATED, and it has to be ──────────────────────────
        // Rows 6-20 are ORC VPP data, and 6/8/10/12/14/16/20 is not a coincidence — it is
        // exactly the wind set the ORC VPP solves for. ORC publishes NOTHING above 20 kt:
        // its own rule says that when the scoring wind exceeds 20 knots the 20-knot time
        // allowances are used, and implied wind is "not extrapolated beyond the range of
        // calculations of the ORC VPP".
        //
        // That rule is a RATING-FAIRNESS convention, not a claim about boats — and the game
        // had inherited it as physics (`if (windSpeed >= 20) { lower = 20; upper = 20 }`),
        // which made 25 knots downwind no faster than 20 and, once overpowered took its cut,
        // strictly slower. So these two rows are built rather than cited.
        //
        // The shape comes from the measured rows: from 16 to 20 kt the boat gains 5.7% at
        // 38 degrees, 10.7% at 90 and 18.7% at 180 — upwind is ALREADY SATURATING while
        // downwind is still accelerating hard. Both trends simply continue:
        //   20 -> 25 kt   +2% upwind, +10% at 90, +18-20% deep
        //   25 -> 30 kt    0% upwind,  +8% at 90, +17-18% deep
        // Upwind flattening IS being overpowered: the rig is depowered and the bow is in
        // the waves, so more wind buys nothing. Downwind DOES NOT TAPER, and that is the
        // point — past 17-18 kt the boat is planing, and a planing hull keeps taking what
        // the breeze offers instead of settling at a wave-making limit.
        //
        // ⚠️ Do not "correct" these toward the ORC curve's flattening. ORC's VPP is a
        // RATING predictor and is conservative about planing: it puts a J/111 at 8.75 kt in
        // 12 kt of breeze at 120 degrees, while a J/111 on the water planes at 12-13 kt in
        // that same 12 knots. The game's planing multiplier already carries part of that
        // gap; these rows carry the rest. Sanity check at the top end: 25 kt at 120 degrees
        // is 12.99 kt of polar, about 15.6 with the planing bonus — and real J/111s are
        // documented in the high teens with peaks past 20 (one clocked at 20.2).
        //
        // Sources: ORC VPP documentation (the 6-20 kt solve set and the 20 kt scoring cap);
        // North Sails J/111 Worlds speed guide (planes at 17-18 kt TWS, crossover ~17 kt,
        // jib carried above 25 kt, A2 to 24-28 kt); blur.se J/111 Piranha test (12-13 kt
        // planing in 12 kt of breeze; other boats "close to, or top, 20 knots").
        25: {
            spinnaker: [0.0, 0.0, 1.22, 2.46, 3.71, 4.97, 6.89, 11.47, 12.61, 12.99, 12.86, 11.98, 10.57],
            nonSpinnaker: [0.0, 0.0, 8.36, 8.92, 9.54, 9.94, 10.58, 11.47, 11.33, 11.03, 10.0, 8.9, 7.93]
        },
        30: {
            spinnaker: [0.0, 0.0, 1.22, 2.47, 3.75, 5.04, 7.17, 12.39, 14.38, 15.07, 15.05, 14.14, 12.37],
            nonSpinnaker: [0.0, 0.0, 8.36, 8.96, 9.64, 10.09, 11.0, 12.39, 12.92, 12.79, 11.7, 10.5, 9.28]
        }
    }
};

// Planing Configuration
const J111_PLANING = {
    // Conditions
    minTWA: 100 * Math.PI / 180,
    maxTWA: 170 * Math.PI / 180, // Drop off if dead downwind (unstable)
    minTWS: 12.0, // Needs decent breeze
    entrySpeed: 8.5, // Knots
    exitSpeed: 7.5, // Hysteresis
    entryTime: 1.5, // Seconds to trigger (prevent blips)
    exitTime: 1.0,  // Seconds to lose it

    // Physics Modifiers
    speedMultiplier: 1.20, // 20% boost when planing (so 11kn -> 13.2kn)
    accelBoost: 1.5, // Surging acceleration
    turnDrag: 0.990, // Higher drag in turns while planing (loss of plane)
    turnRateScale: 0.7, // Stiffer steering at high speed

    // Visuals
    wakeLengthScale: 2.0,
    wakeWidthScale: 1.5
};

// Physics Helper Functions
function getTurnSpeed() {
    const PH = (typeof window !== 'undefined' && window.__PHYS) ? window.__PHYS : {};
    return PH.turnSpeed != null ? PH.turnSpeed : CONFIG.turnSpeed;
}

function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}


function isVeryDark(color) {
    if (!color) return false;
    let r = 0, g = 0, b = 0;
    if (color.startsWith('#')) {
        const hex = color.substring(1);
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        }
    } else if (color.startsWith('rgb')) {
        const parts = color.match(/\d+/g);
        if (parts && parts.length >= 3) {
            r = parseInt(parts[0]);
            g = parseInt(parts[1]);
            b = parseInt(parts[2]);
        }
    }
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    return luma < 60;
}

// Game State
const state = {
    boats: [], // Array of Boat instances. boats[0] is Player.
    camera: {
        x: 0,
        y: 0,
        rotation: 0,
        target: 'boat',
        mode: 'heading',
        message: '',
        messageTimer: 0
    },
    wind: {
        direction: 0,
        baseDirection: 0,
        currentShift: 0,
        speed: 10,
        baseSpeed: 10
    },
    showNavAids: true,
    particles: [],
    waveStates: new Map(),
    keys: {
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false,
        Shift: false,
    },
    paused: false,
    gameSpeed: 1.0,
    time: 0,
    race: { // Global Race State
        status: 'prestart',
        timer: 30.0,
        legLength: 4000,
        totalLegs: 4,
        startTimerDuration: 30.0
    },
    course: {}
};

const burgeeImg = new Image();
burgeeImg.src = 'assets/images/misc/salty-crew-yacht-club-burgee.png';

const palmImg = new Image();
palmImg.src = 'assets/images/misc/palm.png';

// ── Land textures ───────────────────────────────────────────────────────────
// An ISLAND_STYLE with an entry here is filled with a tiling surface instead of
// one flat colour. Only FIXED land: floes and bergs keep their baked faceted
// sprite, because a floe spins and a world-anchored pattern would slide across
// it as it turned.
//
// `tile` is the world units one square covers, from the asset's `tileWorld` in
// art/manifest.json. The camera is translate-only at 1:1, so a tile is downscaled
// ONCE into its pattern source rather than resampled per fill — and because the
// fill happens in world space, the texture stays nailed to the land underneath it
// while the camera moves over.
//
// `alpha` is baked into the pattern source, not applied at fill time. Compositing
// the tile over the flat colour once, here, costs one drawImage per style; doing it
// with globalAlpha would cost a second full-screen fill on every frame. The result
// is identical because land is opaque — the flat body colour is what would be under
// it. 0 is the old flat fill, 1 is the raw tile.
const LAND_TEXTURES = {
    ice:     { src: 'assets/images/terrain/arctic/snow.png',    tile: 512, alpha: 0.3 },
    granite: { src: 'assets/images/terrain/arctic/granite.png', tile: 256, alpha: 0.3 }
};
for (const k in LAND_TEXTURES) {
    const t = LAND_TEXTURES[k];
    t.img = new Image();
    t.img.src = t.src;
    t.patterns = {};   // keyed by the base colour it is blended over
}

function getLandPattern(ctx, style, base) {
    const t = LAND_TEXTURES[style];
    if (!t) return null;
    if (t.patterns[base]) return t.patterns[base];
    if (!t.img.complete || !t.img.naturalWidth) return null;   // flat fill until it lands
    const c = document.createElement('canvas');
    c.width = c.height = t.tile;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, t.tile, t.tile);
    g.globalAlpha = t.alpha;
    g.imageSmoothingQuality = 'high';
    g.drawImage(t.img, 0, 0, t.tile, t.tile);
    t.patterns[base] = ctx.createPattern(c, 'repeat');
    return t.patterns[base];
}

// Boat part sprites (uniform 16 px/world-unit on 1024^2 transparent canvases;
// exported from the vector shapes — drop-in replaceable with painted art).
// Anchors: hull sprite has the boat origin at px (512,472); each sail sprite
// has its tack/pivot at px (512,112) with the camber bulging toward +x.
const BOAT_SPRITE_SCALE = 16;
// Tint bakes downsample to 4 px/world-unit (256^2): boats are ~55 px on screen,
// so this stays ~4x oversampled for zoom while cutting texture memory and the
// per-frame GPU downsample ~16x vs baking at the 1024^2 authoring size.
const BOAT_SPRITE_BAKE = 4;
const boatSprites = { hull: new Image(), main: new Image(), jib: new Image(), spin: new Image() };
for (const k in boatSprites) boatSprites[k].src = 'assets/images/boat-parts/' + k + '.png';
// Hull shading. Boats rotate, so anything baked into the sprite has to be
// rotation-invariant — a directional "sun" would spin with the boat and read as
// wrong. Darkening toward the gunwale is direction-free and says the same thing:
// the topsides curve away from you. Elliptical, tracking the hull's own bbox
// (template x 252..772, y 62..964) as a fraction of the 1024 box.
// 0 = flat, 1 = the full effect below. Turn it down or to 0 to taste.
const HULL_SHADE = 0.55;
const HULL_SHADE_GEOM = { cx: 0.500, cy: 0.501, rx: 0.254, ry: 0.440 };
function shadeHullBake(g, size) {
    if (HULL_SHADE <= 0) return;
    const { cx, cy, rx, ry } = HULL_SHADE_GEOM;
    const px = cx * size, py = cy * size, r = rx * size;
    // Mix each stop back toward white by (1 - HULL_SHADE) so one knob scales it
    const stop = (v) => {
        const b = Math.round(255 - (255 - v) * HULL_SHADE);
        return `rgb(${b},${b},${b})`;
    };
    g.save();
    g.globalCompositeOperation = 'multiply';
    // Squash the circle into the hull's proportions so the falloff hugs the
    // sheerline instead of pooling at the bow and stern
    g.translate(px, py); g.scale(1, ry / rx); g.translate(-px, -py);
    const grad = g.createRadialGradient(px, py, r * 0.30, px, py, r);
    grad.addColorStop(0.00, stop(255));   // deck stays the pure paint colour
    grad.addColorStop(0.62, stop(246));
    grad.addColorStop(0.88, stop(226));
    grad.addColorStop(1.00, stop(203));   // gunwale
    g.fillStyle = grad;
    g.fillRect(-size, -size, size * 3, size * 3);
    g.restore();
}

// Spinnaker shading, worked out from aerial photographs of running boats by
// sampling single-colour panels across each sail, so panel colour can't be
// mistaken for shading.
//
// What the photographs actually show:
//   • a broad lit region over the OUTER belly — the face of the balloon — which
//     stays essentially full-strength colour; the sail is bright, not muddy;
//   • the deepest shadow pooled at the FOOT, where the sail hangs under its own
//     belly, and along the LUFF where it turns back toward the mast;
//   • the head bright, being nearest the sky;
//   • and the light wrapping in smooth CURVES that follow the sail's form.
//
// That last point is what an earlier attempt here got wrong. Crossed linear
// ramps put bands of constant brightness across the sail and read as a machined
// tube, not cloth. One elliptical falloff centred on the lit belly gives curved
// contours and reads as an inflated kite. (The two aerials disagree on how hard
// the head-to-foot falloff is — that is sun angle, not sail shape — so this
// takes the middle of them rather than fitting either exactly.)
//
// Both passes run in sprite space. The kite swings with the sail, mirrors on
// each tack and spins with the boat, so a fixed world light would be wrong three
// ways at once; the sail's own form is true from every angle.
// Sail occupies template x 504..840 (luff..max bulge), y 105..927 (head..foot).
// 0 = flat, 1 = the full effect below.
const SPIN_SHADE = 0.8;
function shadeSpinBake(g, size) {
    if (SPIN_SHADE <= 0) return;
    const s = size / 1024;
    const stop = (v) => {
        const b = Math.round(255 - (255 - v) * SPIN_SHADE);
        return `rgb(${b},${b},${b})`;
    };
    // The form: one elliptical falloff centred on the lit outer belly, set high
    // so the head keeps its light and the shadow gathers toward the foot
    g.save();
    g.globalCompositeOperation = 'multiply';
    const cx = 730 * s, cy = 370 * s, rx = 310 * s, ry = 500 * s;
    g.translate(cx, cy); g.scale(1, ry / rx); g.translate(-cx, -cy);
    const belly = g.createRadialGradient(cx, cy, rx * 0.18, cx, cy, rx);
    belly.addColorStop(0.00, stop(255));   // lit face — full-strength colour
    belly.addColorStop(0.48, stop(253));
    belly.addColorStop(0.74, stop(233));
    belly.addColorStop(0.90, stop(206));
    belly.addColorStop(1.00, stop(178));   // foot and the far edges
    g.fillStyle = belly;
    g.fillRect(-size, -size, size * 3, size * 3);
    g.restore();
    // The luff turning back on itself, a soft band rather than a hard edge
    g.save();
    g.globalCompositeOperation = 'multiply';
    const luff = g.createLinearGradient(504 * s, 0, 712 * s, 0);
    luff.addColorStop(0.00, stop(200));
    luff.addColorStop(0.33, stop(233));
    luff.addColorStop(1.00, stop(255));
    g.fillStyle = luff;
    g.fillRect(0, 0, size, size);
    g.restore();
}

// Paint jobs: multiply-tint a part once per color, then re-cut the silhouette.
// Composite ops only (no getImageData — file:// safe). Cache shared across boats.
const boatTintCache = new Map();
function getTintedBoatPart(part, color) {
    const key = part + '|' + color;
    let c = boatTintCache.get(key);
    if (c) return c;
    const img = boatSprites[part];
    if (!img.complete || !img.naturalWidth) return null;
    c = document.createElement('canvas');
    const size = Math.round(img.naturalWidth * BOAT_SPRITE_BAKE / BOAT_SPRITE_SCALE);
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, size, size);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = color;
    g.fillRect(0, 0, size, size);
    // Shading rides along in the same cached bake, so it costs nothing per frame.
    // Before the silhouette cut, since 'multiply' paints into transparent pixels.
    if (part === 'hull') shadeHullBake(g, size);
    if (part === 'spin') shadeSpinBake(g, size); // solid kites come through here
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0, size, size);
    boatTintCache.set(key, c);
    return c;
}

// Spinnaker panel patterns: accent regions in the sprite's template space
// (1024 box, tack at (512,112), bulge +x). Regions are clipped by the art's
// alpha at bake time, so any future painted spinnaker inherits every pattern.
function spinWedge(g, s, cx, cy, a0, a1) {
    const tx = cx * s, ty = cy * s, R = 1400 * s;
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + Math.cos(a0) * R, ty + Math.sin(a0) * R);
    g.lineTo(tx + Math.cos(a1) * R, ty + Math.sin(a1) * R);
    g.closePath();
}
// Display names for the patterns below. Kept adjacent so a new pattern that
// forgets a label is obvious; the pre-race player panel builds its dropdown
// from these, while the Settings modal hard-codes the same list in markup.
const SPIN_PATTERN_LABELS = {
    solid: 'Solid', halves: 'Halves', crosshalves: 'Cross Halves', gores: 'Gores',
    stripes: 'Stripes', rays: 'Rays', triangle: 'Triangle',
    thirds: 'Thirds', chevron: 'Chevron', sunburst: 'Sunburst', tricolour: 'Tricolour'
};
// DERIVED from the pattern data, never hand-maintained: no regions = one colour,
// any [3, fn] region = three, otherwise two. A new pattern is counted correctly
// the moment it is written, which a hand-kept list would not manage.
function spinColorCount(key) {
    const regions = SPIN_PATTERNS[key];
    if (!regions || !regions.length) return 1;
    return regions.some(r => Array.isArray(r)) ? 3 : 2;
}
// Fewest colours first, alphabetical within each count.
function spinPatternsByColorCount() {
    return Object.keys(SPIN_PATTERNS).sort((a, b) =>
        spinColorCount(a) - spinColorCount(b) ||
        (SPIN_PATTERN_LABELS[a] || a).localeCompare(SPIN_PATTERN_LABELS[b] || b));
}

const SPIN_PATTERNS = {
    solid: [],
    // Straight seam across the middle of the sail: head half / foot half
    halves: [(g, s) => { g.beginPath(); g.rect(0, 512 * s, 1024 * s, 1024 * s); }],
    // Diagonal split radiating from the head (the original "halves")
    crosshalves: [(g, s) => spinWedge(g, s, 512, 112, 0, 1.23)],
    gores: [1, 3].map(i => (g, s) => spinWedge(g, s, 512, 112, 0.89 + i * 0.136, 0.89 + (i + 1) * 0.136)),
    // Five even stripes head-to-foot (sail spans y 112-912): base/accent alternating
    stripes: [(g, s) => { g.beginPath(); g.rect(0, 272 * s, 1024 * s, 160 * s); },
              (g, s) => { g.beginPath(); g.rect(0, 592 * s, 1024 * s, 160 * s); }],
    // Rising-sun rays from the front-edge center (pairs with the triangle)
    rays: [1, 3, 5, 7].map(i => (g, s) =>
        spinWedge(g, s, 512, 512, -Math.PI / 2 + i * (Math.PI / 9), -Math.PI / 2 + (i + 1) * (Math.PI / 9))),
    // Triangle: tip on the straight (luff) edge at the BACK of the kite, opening
    // forward. The two rays run well past the leech, so the silhouette clips the
    // wide end into a curve that follows the sail's front edge — a wedge with a
    // rounded mouth rather than a flat-based triangle.
    triangle: [(g, s) => spinWedge(g, s, 512, 512, -0.70, 0.70)],

    // --- three-colour patterns -------------------------------------------------
    // The kite is roughly 40-60px at race scale, so these stay LARGE-FEATURED.
    // `stripes` at five bands of one accent is already near the limit; three
    // colours in finer divisions grey out into mush. Thirds, chevrons and
    // alternating rays survive because each field is big. See skills.md 8.2.
    //
    // Sail spans y 112-912. Thirds: head band base, middle accent, foot third.
    thirds: [(g, s) => { g.beginPath(); g.rect(0, 379 * s, 1024 * s, 267 * s); },
             [3, (g, s) => { g.beginPath(); g.rect(0, 646 * s, 1024 * s, 266 * s); }]],
    // Nested wedges radiating from the head — an arrow aimed at the masthead.
    //
    // GEOMETRY NOTE, learned the hard way twice. spinWedge takes CANVAS angles
    // (0 = +x, PI/2 = straight down) and the sail is NOT the full 1024 square: it
    // occupies x 504..840, y 105..927, luff straight down the left, bulging right.
    // From the head that subtends roughly 0.5..1.58 rad. Centring the wedges on 0
    // put them entirely off the sail and the pattern rendered as a plain solid;
    // sweeping the full 0.28..1.72 swallowed the base colour instead. These keep
    // base visible top-right and along the luff.
    chevron: [(g, s) => spinWedge(g, s, 512, 112, 0.68, 1.42),
              [3, (g, s) => spinWedge(g, s, 512, 112, 0.92, 1.18)]],
    // Rising-sun rays alternating accent/third, from the front-edge centre.
    sunburst: [1, 3, 5, 7].map(i => (g, s) =>
                  spinWedge(g, s, 512, 512, -Math.PI / 2 + i * (Math.PI / 9), -Math.PI / 2 + (i + 1) * (Math.PI / 9)))
              .concat([2, 4, 6].map(i => [3, (g, s) =>
                  spinWedge(g, s, 512, 512, -Math.PI / 2 + i * (Math.PI / 9), -Math.PI / 2 + (i + 1) * (Math.PI / 9))])),
    // Flag-like vertical bands: base | accent | third. Bands are fitted to the
    // sail's real x-range (504..840), not the 1024 sprite, and the outer band is
    // widest because the crescent tapers away from the luff — equal widths gave
    // the third colour a sliver and the base almost nothing.
    tricolour: [(g, s) => { g.beginPath(); g.rect(600 * s, 0, 100 * s, 1024 * s); },
                [3, (g, s) => { g.beginPath(); g.rect(700 * s, 0, 160 * s, 1024 * s); }]],
};
const SPIN_PATTERN_NAMES = Object.keys(SPIN_PATTERNS);
function spinPatternForName(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return SPIN_PATTERN_NAMES[h % SPIN_PATTERN_NAMES.length];
}

// Hand-curated kite pattern per character (colors live in AI_CONFIG:
// spinnaker = base, spinnaker2 = panel accent; solid ignores the accent).
const SPIN_LOOKS = {
    Cheer: 'sunburst',
    Bixby: 'halves',
    Skim: 'chevron',
    Wobble: 'triangle',
    Pinch: 'crosshalves',
    Bruce: 'solid',
    Strut: 'tricolour',
    Gasket: 'stripes',
    Chomp: 'crosshalves',
    Whiskers: 'thirds',
    Vex: 'crosshalves',
    Hug: 'thirds',
    Ripple: 'gores',
    Clutch: 'solid',
    Glide: 'thirds',
    Fathom: 'triangle',
    Scuttle: 'stripes',
    Finley: 'gores',
    Torch: 'sunburst',
    Nimbus: 'solid',
    Tangle: 'stripes',
    Brine: 'thirds',
    Razor: 'gores',
    Pebble: 'tricolour',
    Saffron: 'triangle',
    Bramble: 'sunburst',
    Mistral: 'chevron',
    Drift: 'triangle',
    Anchor: 'thirds',
    Zing: 'rays',
    Knot: 'sunburst',
    Flash: 'rays',
    Pearl: 'tricolour',
    Bluff: 'solid',
    Regal: 'tricolour',
    Sunshine: 'sunburst',
    Pulse: 'triangle',
    Splat: 'triangle',
    Dart: 'chevron',
    Roll: 'stripes',
    Spike: 'gores',
    Flicker: 'stripes',
    Croak: 'solid',
    Snap: 'triangle',
    Rift: 'rays',
    Skerry: 'crosshalves',
    Crush: 'rays',
    Torrent: 'tricolour',
    Jester: 'stripes',
    Breeze: 'gores',
    Petal: 'halves',
    Stomp: 'halves',
    Crimson: 'solid',
    Viper: 'crosshalves',
    Skitter: 'gores',
    Veil: 'chevron',
    Puff: 'sunburst',
    Lure: 'triangle',
    Wiggle: 'triangle',
    Zeffir: 'solid',
    Scoop: 'thirds',
    Popper: 'rays',
    Frond: 'gores',
    Bulkhead: 'thirds',
    Slipstream: 'chevron',
    Blaze: 'chevron',
    Cruz: 'thirds',
    Prism: 'sunburst',
    Ember: 'chevron',
    Torpedo: 'tricolour',
    Flaunt: 'tricolour',
    Piper: 'crosshalves',
    Stripes: 'stripes',
    Anvil: 'halves',
    Paddle: 'triangle',
    Etienne: 'stripes',
    Frenzy: 'crosshalves',
    Tiny: 'rays',
    Grip: 'halves',
    Splash: 'solid',
    Dozer: 'halves',
    Muninn: 'solid',
    Talon: 'rays',
    Latch: 'stripes',
    Skip: 'sunburst',
    Sable: 'solid',
    Seam: 'gores',
    Snag: 'solid',
    Lunker: 'triangle',
    Flare: 'crosshalves',
    Spar: 'tricolour',
    Bloom: 'rays',
    Needle: 'triangle',
    Sovereign: 'thirds',
    Lateen: 'halves',
    Ribbon: 'chevron',
    Plunge: 'chevron',
    Riffle: 'stripes',
    Chisel: 'gores',
    Chroma: 'halves',
};
// colorC is OPTIONAL and falls back to colorB, so every pattern authored before the
// third colour existed renders byte-identically. A region is either a bare function
// (fills with colorB, the original behaviour) or [3, fn] to fill with colorC.
function getSpinnakerSprite(pattern, colorA, colorB, colorC) {
    const regions = SPIN_PATTERNS[pattern];
    if (!regions || !regions.length || !colorB) return getTintedBoatPart('spin', colorA);
    const c3 = colorC || colorB;
    const key = 'spinp|' + pattern + '|' + colorA + '|' + colorB + '|' + c3;
    let c = boatTintCache.get(key);
    if (c) return c;
    const img = boatSprites.spin;
    if (!img.complete || !img.naturalWidth) return null;
    const size = Math.round(img.naturalWidth * BOAT_SPRITE_BAKE / BOAT_SPRITE_SCALE);
    c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d');
    const tintPass = (color) => {
        g.drawImage(img, 0, 0, size, size);
        g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, size, size);
        g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0, size, size);
        g.globalCompositeOperation = 'source-over';
    };
    tintPass(colorA);
    const s = size / 1024;
    for (const region of regions) {
        const third = Array.isArray(region);
        const draw = third ? region[1] : region;
        g.save();
        draw(g, s);
        g.clip();
        tintPass(third ? c3 : colorB);
        g.restore();
    }
    // Shade last, so the base and every accent panel curve together
    shadeSpinBake(g, size);
    // Final unclipped silhouette cut: antialiased clip edges leave partial-alpha
    // accent pixels outside the sail that the clipped passes can't clear
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0, size, size);
    g.globalCompositeOperation = 'source-over';
    boatTintCache.set(key, c);
    return c;
}

// Penguin species that ride the floes. These are the art pipeline's ELEMENT
// masters, shipped individually rather than baked into a group sprite: a bird
// only gets to waddle (and later dive) if the engine owns it as its own object.
//
// The per-species numbers are the point, not decoration. At 15-19px on screen
// the plumage that separates an emperor from an adelie is two or three pixels
// and reads as noise, so species is carried by MOVEMENT — a stately emperor
// rocking slowly against an adelie skittering flat out is legible where the
// markings are not.

// MARK SPRITES, BY KIND. This used to be one global `markImg`, which meant a mark's
// `kind` chose nothing: a document could say `can` or `committee` and still get the
// orange tetrahedron. That is why mark-can-yellow shipped and then sat unused for a
// week — the art was ready and no mark could ask for it.
//
// `world` is the manifest's world size for that sprite, and it sizes the FRAME, not
// the object: each master is fill-normalized at ingest, so mark.png fills 96% of its
// square (30 -> ~29px across) and committee-boat.png fills 40%x92% (92 -> 37x85px).
// Drawing the frame at `world` is what makes those two numbers mean the same thing.
const MARK_SPRITES = {
    inflatable: { src: 'assets/images/props/mark.png',            world: 30 },
    can:        { src: 'assets/images/props/mark-can-yellow.png', world: 30 },
    committee:  { src: 'assets/images/props/committee-boat.png',  world: 92 }
};
for (const k in MARK_SPRITES) {
    const s = MARK_SPRITES[k];
    s.img = new Image();
    s.img.src = s.src;
    s.gray = null;
}
// An unknown kind falls back to the inflatable rather than drawing nothing: a typo in
// a document should look wrong, not make a course mark invisible.
const markSprite = (kind) => MARK_SPRITES[kind] || MARK_SPRITES.inflatable;
function getMarkImgGray(kind) {
    const s = markSprite(kind);
    if (s.gray || !s.img.complete || !s.img.naturalWidth) return s.gray;
    const c = document.createElement('canvas');
    c.width = s.img.naturalWidth; c.height = s.img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(s.img, 0, 0);
    // Slate tint via source-atop (keeps the sprite's alpha + some shading;
    // avoids getImageData, which taints the canvas under file://)
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(148, 163, 184, 0.8)';
    g.fillRect(0, 0, c.width, c.height);
    s.gray = c;
    return s.gray;
}

// How long a boat takes to disappear after it finishes. Long enough to read as a hull
// sailing on past the line rather than being deleted, short enough that it is gone before
// the next boat needs the water.
//
// ⚠️ It also paces the RESULTS: the camera hands over and `showResults()` fires when the
// player's boat has faded, so shortening this shortens the wait after your own finish.
const FINISH_FADE_SECS = 2.5;

class Boat {
    constructor(id, isPlayer, startX, startY, name="USA", config=null) {
        this.id = id;
        this.isPlayer = isPlayer;
        this.name = name;
        this.x = startX;
        this.y = startY;
        this.heading = 0; // Will be set during reset
        this.velocity = { x: 0, y: 0 };
        this.speed = 0;
        this.prevHeading = 0;
        this.lastWindSide = undefined;

        this.sailAngle = 0;
        this.manualTrim = false;
        this.manualSailAngle = 0;
        this.boomSide = 1;
        this.targetBoomSide = 1;
        this.heel = 0;          // lagged heeling pressure, 1.0 == a beam reach in OVERPOWERED.threshold kt
        this.luffing = false;
        this.luffIntensity = 0;
        this.spinnaker = false;
        this.spinnakerDeployProgress = 0;

        this.opacity = 1.0;
        this.fadeTimer = FINISH_FADE_SECS;

        // APPEARANCE IS THE SAME PATH FOR EVERYONE. It used to branch on `isPlayer` here and
        // in six places inside drawBoat, because the player's colours lived in `settings`
        // and everyone else's lived on the boat. The player is a character now, so there is
        // one source and no branch.
        applyBoatIdentity(this, config, isPlayer);

        // Race State
        this.raceState = {
            leg: 0,
            isRounding: false,
            // Swept-angle rounding progress. Declared here rather than created on
            // first use so it always EXISTS — the golden traces hash the fields a
            // boat has at race start, so a field created mid-race is never observed.
            roundSweep: 0,
            roundWrong: 0,
            roundArmed: false,
            isTacking: false, // Rule 13
            inZone: false,
            zoneEnterTime: 0,
            ocs: false,
            penalty: false,
            penaltyProgress: 0, // Deprecated but kept for compatibility if needed
            penaltyTimer: 0,        // kept for save/eval compat; no longer drives a slowdown
            penaltyTurnsOwed: 0,    // 360° turns queued by fouls
            penaltyRot: 0,          // net signed rotation (rad) accumulated while flagged
            penaltyLastHeading: null,
            penaltyFlagTime: 0,     // seconds since first un-cleared foul (drives AI deadline)
            totalPenalties: 0,
            finished: false,
            finishTime: 0,
            startTimeDisplay: 0,
            startTimeDisplayTimer: 0,
            legStartTime: 0,
            lastLegDuration: 0,
            startLegDuration: null,
            legSplitTimer: 0,
            lastPos: { x: startX, y: startY },
            nextWaypoint: { x: 0, y: 0, dist: 0, angle: 0 },
            trace: [],
            legTimes: [],
            // Where the player stood at the start and at each mark. UI only — the results
            // screen's splits are the one place a race says WHERE it was won, and a place
            // cannot be reconstructed after the fact. Recorded for the player alone (see
            // advanceLeg), so the cost is one O(n) scan per rounding.
            startRank: 0,
            legRanks: [],
            // THE WIND THAT ACTUALLY BLEW, off the player's own masthead — see updateBoat.
            // The pre-race board quotes a forecast over the whole course; a result should be
            // able to say what the race itself felt, which no field average can reconstruct
            // afterwards because it depends on where you sailed.
            windObsMin: Infinity,
            windObsMax: 0,
            windObsSum: 0,
            windObsN: 0,
            legManeuvers: new Array(32).fill(0),
            legTopSpeeds: new Array(32).fill(0),
            legDistances: new Array(32).fill(0),
            legSpeedSums: new Array(32).fill(0),
            isPlaning: false,
            planingTimer: 0,
            planingFactor: 0
        };

        // AI State
        this.ai = {
            targetHeading: 0,
            state: 'start',
            tackCooldown: 0,
            stuckTimer: 0,
            recoveryMode: false,
            recoveryTarget: 0,
            prestartSide: (Math.random() > 0.5) ? 1 : -1,
            trimTimer: 0,
            currentTrimTarget: 0,
            congestionTimer: Math.random() * 2.0
        };

        // Personality Stats Removed for Basic AI

        this.badAirIntensity = 0;
        this.turbulence = [];
        this.turbulenceTimer = 0;

        this.playerProximity = { minD: Infinity, close: false };
        this.lbRank = 0;
        this.creature = config ? (config.creature || "Unknown") : "Unknown";
        // Racing archetype persona (see ARCHETYPES). Player and unknown configs
        // get pure defaults = the baseline fleet behavior.
        this.archetype = (config && config.archetype) || null;
        const traitsOff = typeof window !== 'undefined' && window.__CHAR && window.__CHAR.traitsOff;
        const archDef = !traitsOff && this.archetype && typeof ARCHETYPES !== 'undefined' ? ARCHETYPES[this.archetype] : null;
        // Per-character trait overrides layer on top of the archetype, so a character
        // can be a better reader than another of the same archetype — impossible
        // before, since all eight shift boats shared one shiftSense. Optional and
        // additive: absent means the archetype value. Discipline is one or two fields
        // within ~30% of the archetype's, or archetypes stop meaning anything
        // (guidelines/skills.md 6).
        this.traits = Object.assign({}, DEFAULT_TRAITS,
                                    archDef ? archDef.traits : {},
                                    (!traitsOff && config && config.traits) || {});
        this.prevRank = 0;
    }
}

// THE WIND OVER TIME. There is nothing global left to wander.
//
// This used to roll a whole day's weather from venue variables: `shiftiness` picked an
// oscillation amplitude, period and slew from a table of presets, `variability` added
// speed noise, and a per-race persistent shift veered the breeze one way over the race. All
// of it rode on top of whatever the wind regions said, which meant a course could state its
// wind and still be overruled by a number in a table it could not see.
//
// A REGION STATES ITS OWN WANDER. `dirVar`, `speedVar` and `period` are region fields and
// always were; getWindAt oscillates each region against them. So a steady course is one
// whose regions state no variation, and a shifty one is authored — the same rule as the
// gusts, and as the wind's own direction and speed before them.
//
// ⚠️ No venue authors `dirVar` yet, so every venue currently races in a steady breeze. The
// oscillating shift and the pick-a-side persistent veer are both real tactics and both want
// to come back as authored region variation rather than as a global.
function updateBaseWind(dt) {
    state.wind.direction = state.wind.baseDirection;
    state.wind.speed = state.wind.baseSpeed;

    // Debug History
    if (!state.wind.history) state.wind.history = [];
    if (!state.wind.debugTimer) state.wind.debugTimer = 0;
    state.wind.debugTimer -= dt;
    if (state.wind.debugTimer <= 0) {
        state.wind.debugTimer = 0.5;
        state.wind.history.push({ t: state.time, dir: 0, speed: state.wind.speed });
        if (state.wind.history.length > 240) state.wind.history.shift();
    }
}

function drawWindDebug(ctx) {
    if (!settings.debugMode) return;

    const h = 100;
    const w = 200;
    // Align right, accounting for the wider conflict info box (300px)
    const x = ctx.canvas.width - 320;
    const y = 430;

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, w, h);

    // Center Line
    ctx.strokeStyle = '#666';
    ctx.beginPath();
    ctx.moveTo(x, y + h/2);
    ctx.lineTo(x + w, y + h/2);
    ctx.stroke();

    // Plot
    if (state.wind.history && state.wind.history.length > 1) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const now = state.time;
        // 120s window
        for (const p of state.wind.history) {
            const timeOffset = now - p.t;
            if (timeOffset > 120) continue;

            const px = x + w - (timeOffset / 120) * w;
            // Scale: +/- 30 deg fills height
            const py = y + h/2 - (p.dir / 30) * (h/2);
            ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Plot Speed (Cyan)
        ctx.strokeStyle = '#22d3ee';
        ctx.beginPath();
        let first = true;
        for (const p of state.wind.history) {
            const timeOffset = now - p.t;
            if (timeOffset > 120) continue;

            const px = x + w - (timeOffset / 120) * w;
            // Scale: 0-30 knots fills height (bottom up)
            // base y is y+h.
            const py = (y + h) - (p.speed / 30) * h;
            if (first) { ctx.moveTo(px, py); first = false; }
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
    }

    ctx.fillStyle = '#fff';
    ctx.font = FONT.mono(10);
    ctx.fillText("Base Wind Shift (+/- 30°)", x + 5, y + 15);
    ctx.fillStyle = '#22d3ee';
    ctx.fillText("Wind Speed (0-30kn)", x + 5, y + 25);
    ctx.fillStyle = '#fff';

    // Current Delta
    const shift = (state.wind.currentShift || 0) * (180/Math.PI);
    ctx.fillText(`Cur: ${shift > 0 ? '+' : ''}${shift.toFixed(1)}°`, x + 5, y + h - 5);

    // Per-Boat Delta (Relative to 30s ago)
    // Find history point ~30s ago
    let pastShift = shift;
    const now = state.time;
    if (state.wind.history) {
        const past = state.wind.history.find(p => p.t >= now - 30);
        if (past) pastShift = past.dir;
    }
    const delta30 = shift - pastShift;
    ctx.textAlign = 'right';
    ctx.fillText(`30s Δ: ${delta30 > 0 ? '+' : ''}${delta30.toFixed(1)}°`, x + w - 5, y + h - 5);

    // Rule Debug Info
    ctx.textAlign = 'left';
    let textY = y + h + 20;
    const player = state.boats[0];
    const checkDist = 400;

    let conflictCount = 0;
    for (const other of state.boats) {
        if (other === player) continue;
        const distSq = (player.x - other.x)**2 + (player.y - other.y)**2;
        if (distSq < checkDist * checkDist && isConflictSoon(player, other)) {
            conflictCount++;
        }
    }

    if (conflictCount > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x, y + h + 5, 300, conflictCount * 20 + 10);
    }

    for (const other of state.boats) {
        if (other === player) continue;
        const distSq = (player.x - other.x)**2 + (player.y - other.y)**2;
        if (distSq < checkDist * checkDist && isConflictSoon(player, other)) {
            const res = getRightOfWay(player, other);
            const isWinner = res.boat === player;
            ctx.fillStyle = isWinner ? '#4ade80' : '#ef4444';
            let label = `${other.name} - ${res.rule}: ${res.reason}`;
            if (res.markRoom) label += ' [Mark-Room]';
            ctx.fillText(label, x + 5, textY);
            textY += 20;
        }
    }

    ctx.restore();
}

function drawDebugWorld(ctx) {
    if (!settings.debugMode) return;

    ctx.save();

    // Draw Inflated Islands (Global Planner View)
    // Only need one boat's planner since they should be same
    const planner = state.boats.find(b => !b.isPlayer)?.controller?.planner;
    if (planner && planner.inflatedIslands) {
        ctx.strokeStyle = '#f59e0b'; // Amber
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        for (const isl of planner.inflatedIslands) {
            if (!isl.vertices || isl.vertices.length === 0) continue;
            ctx.beginPath();
            ctx.moveTo(isl.vertices[0].x, isl.vertices[0].y);
            for (let i = 1; i < isl.vertices.length; i++) {
                ctx.lineTo(isl.vertices[i].x, isl.vertices[i].y);
            }
            ctx.closePath();
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    for (const boat of state.boats) {
        if (boat.raceState.finished) continue;
        const w = getWindAt(boat.x, boat.y);

        // Draw Wind Vector
        ctx.beginPath();
        ctx.moveTo(boat.x, boat.y);
        const len = 40;
        const dx = Math.sin(w.direction) * len;
        const dy = -Math.cos(w.direction) * len;
        ctx.lineTo(boat.x + dx, boat.y + dy);
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Planned Path
        if (boat.controller && boat.controller.currentPath && boat.controller.currentPath.length > 0) {
            ctx.strokeStyle = '#00ff00'; // Green
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(boat.x, boat.y);
            for (const p of boat.controller.currentPath) {
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();

            // Draw current target waypoint
            const wp = boat.controller.currentPath[0];
            ctx.fillStyle = '#00ff00';
            ctx.beginPath(); ctx.arc(wp.x, wp.y, 5, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.restore();
}

// ── THE SHAPE OF A PUFF ─────────────────────────────────────────────────────
//
// A cell is an ellipse, and that is the right primitive: you never meet the same puff twice,
// so an outline has nothing to be memorable FOR, and the sample runs per boat AND per
// particle per frame over every live cell — the hottest loop in the game. What the ellipse
// was missing is not detail, it is ASYMMETRY.
//
// A real puff mixes down from aloft, hits the water, and spreads out downwind in a half-moon:
// a front you can see coming, and a ragged tail that lets go slowly. Scaling the along-wind
// coordinate before the ellipse test compresses the gradient at the nose and stretches it
// behind — the shape the research describes, with no new geometry and no extra loop.
//
// The two average to 1, so a cell keeps its length; only the balance moves.
const PUFF_NOSE = 0.65, PUFF_TAIL = 1.35;
// How far the drawn cell shifts UPWIND of its nominal centre, so the cat's-paw on the water
// sits over the water the puff is actually felt on. The puff you see must be the puff you
// feel, or the whole point of a readable puff is lost.
const PUFF_SKEW = (PUFF_TAIL - PUFF_NOSE) / 2;
// THE FAN. Air spreads outward from where the puff lands, so one flank of it veers the wind
// and the other backs it — which is what makes a puff a DECISION rather than just pressure:
// you pick a side. Zero on the axis, this much at the cross-wind edge.
//
// A lull is the opposite: air converges INTO a hole rather than out of it, so the sign
// follows speedDelta and one constant serves both.
//
// ⚠️ APPLIED TO THE RESULTANT, not to the puff's own vector. Turning only the puff's
// contribution and letting it sum with the base wind is arithmetically tidy and physically
// wrong: it damps a 12-degree fan down to 0.7 degrees felt, because the puff is a small part
// of the total. The surface wind inside a puff IS the descended air — that is what a puff is
// — so the whole local vector turns, weighted by how far into the cell you are. Measured
// peak is about 4 degrees, near 0.55 of the way out to the flank, which is a shift a sailor
// reads rather than one buried under the venue's own oscillation.
const PUFF_FAN = 18 * Math.PI / 180;

// Gust System
//
// A gust and a lull are ONE thing: an ellipse carrying a signed speed delta, elongated
// along the wind and about half as wide across it — which is the shape the real ones have,
// because surface puffs arrive as streamwise streaks a couple of hundred metres wide and
// rather longer than that. The cell drifts downwind at a fraction of the wind speed and
// lives a couple of minutes, so it can be seen coming, sailed toward, and ridden.
//
// `reg` is the gust region it was born in, or null for the uniform case. A region never
// decides the PHYSICS — it multiplies what the venue's conditions already rolled — so a
// region left at its defaults changes only where puffs come from.
// The spread the engine puts around each authored MEAN. These reproduce the ranges the old
// multiplier form had exactly — size 300-1500 x 150-750 units, life 90-240 s, strength
// 0.275-0.425 of the base wind — so converting a document changes its units and nothing else.
const U_PER_M = window.VenueDoc.U_PER_M;            // the game's one length conversion
const PUFF_SPREAD_LO = 0.572, PUFF_SPREAD_SPAN = 0.856;   // ±21% around the stated knots
const PUFF_SIZE_LO = 0.333, PUFF_SIZE_SPAN = 1.334;       // ±67% around the stated metres
const PUFF_LIFE_LO = 0.545, PUFF_LIFE_SPAN = 0.909;       // ±45% around the stated seconds
const LULL_RATIO = 0.7;                             // a hole is worth ~70% of a puff

function createGust(x, y, type, initial, reg) {
    const conditions = state.race.conditions;
    // THE WIND WHERE THE CELL IS BORN, not the venue's average — same reason as the drift in
    // updateGusts. A source drawn in a katabatic tongue emits cells that set off along the
    // tongue and lie across it, which is the only reason placing the polygon there means
    // anything. `regionWindAt` for the same reason too: the mean field, no puffs to recurse
    // through and no lee to deflect a feature this large.
    const born = regionWindAt(x, y);
    const baseSpeed = born.speed > 0.1 ? born.speed : state.wind.speed;
    const windDir = born.speed > 0.1 ? born.direction : state.wind.direction;

    // THE SOURCE STATES A MEAN AND THE ENGINE SPREADS AROUND IT. `sizeM` is how wide a puff
    // is across its long axis, in metres; the short axis is half that. The spreads below
    // reproduce the ranges these fields had as multipliers exactly, so the only thing that
    // changed is that the number in the editor is now measured in something.
    const halfU = (reg.sizeM * U_PER_M) / 2;
    const maxRadiusX = halfU * (PUFF_SIZE_LO + Math.random() * PUFF_SIZE_SPAN);
    const maxRadiusY = halfU * 0.5 * (PUFF_SIZE_LO + Math.random() * PUFF_SIZE_SPAN);

    let speedDelta = 0;
    let dirDelta = 0;

    // Gust Strength
    // Strength is now balanced (0.5 bias), as the slider controls Type Balance instead.

    // Base strength factor 0.0 to 1.0 within the range
    const strengthRandom = Math.random();
    const bias = 0.5;
    const strengthFactor = (strengthRandom + bias) * 0.5; // 0 to 1

    // WHAT A PUFF IS WORTH ON THE ANEMOMETER, in knots, stated by the source. A hole is
    // worth LULL_RATIO of a puff — real lulls are the shallower half of the same signal.
    //
    // This used to be a percentage of `state.wind.speed`, which is the region blend at the
    // ROUTE CENTROID. On a course whose wind actually varies that is the wrong reference:
    // a bomb born in Glacier Sound's 29-knot katabatic tongue was sized by the 20-knot
    // average two kilometres away, and a source could not be given a strength without
    // knowing a number that is nowhere on its own panel.
    const spread = PUFF_SPREAD_LO + strengthFactor * PUFF_SPREAD_SPAN;
    speedDelta = reg.gustKt * spread * (type === 'gust' ? 1 : -LULL_RATIO);

    // Gust-shift coupling (Northern Hemisphere): a gust is faster, more-veered
    // upper-level air mixed down to the surface, so the wind VEERS (clockwise) in a
    // puff and BACKS (counter-clockwise) in a lull. Magnitude scales with the puff's
    // strength. This is the key realism upgrade — it turns "random gusts" into a
    // READABLE pattern (a puff lifts starboard / heads port), so both the player and
    // the AI can anticipate the shift that arrives with the pressure.
    //
    // ⚠️ A region's `strength` deliberately does NOT scale this. The veer already tracks the
    // cell's OWN strength draw above, which is the coupling that makes the read consistent —
    // a bigger puff on this venue turns the wind further. The multiplier is a property of the
    // SOURCE, and letting it through here as well would put a 50-degree swing behind one box
    // labelled "strength". How far the wind turns in a puff is a fact about the DAY, and the
    // source's own knob is its `veer`.
    const hemiSign = 1; // NH: gust veers +, lull backs -
    const veerBase = reg.veer;   // the SOURCE says how far its puffs turn the wind
    const veerMag = veerBase * (0.6 + strengthFactor * 0.8); // stronger puff -> bigger shift
    dirDelta = hemiSign * (type === 'gust' ? 1 : -1) * veerMag;

    // Movement: puffs travel downwind at roughly the gradient wind speed (~0.6-0.9x
    // the true wind here), so they sweep down the course and "connect the puffs" /
    // sailing toward pressure becomes a real tactic. (Old factor barely moved them.)
    const moveSpeedFactor = (0.8 + Math.random() * 0.4) * 0.18;
    const moveDirOffset = (Math.random() - 0.5) * 0.1; // Slight drift relative to wind

    // Initial Velocity
    const moveSpeed = baseSpeed * moveSpeedFactor;
    const moveDir = windDir + moveDirOffset;
    const vx = -Math.sin(moveDir) * moveSpeed;
    const vy = Math.cos(moveDir) * moveSpeed;

    // HOW LONG IT LIVES, in seconds, stated by the source. The number that makes this
    // authorable is the one it has to be compared against: a puff drifts at ~0.75x the
    // wind, so on a 1.75 km course it is gone in well under a minute. A source asking for
    // 165-second puffs on that course is asking for cells that spend three quarters of
    // their lives off the map — still counting against its own `count`, so the source
    // reads "full" while the water is empty. In multiplier form that was invisible.
    const duration = reg.lifeS * (PUFF_LIFE_LO + Math.random() * PUFF_LIFE_SPAN);
    const age = initial ? Math.random() * duration : 0;

    return {
        type, x, y, vx, vy,
        moveSpeedFactor, moveDirOffset,
        maxRadiusX, maxRadiusY,
        radiusX: 10, radiusY: 10,
        rotation: windDir + dirDelta + Math.PI / 2,
        speedDelta, dirDelta,
        duration,
        age
    };
}

// ── WHERE A PUFF IS BORN ────────────────────────────────────────────────────
// Only in a gust region. There is no uniform scatter behind them any more and no venue-wide
// puffiness driving one: a source states its own population, exactly as a wind region states
// its own speed, and a course with no sources has a steady breeze the way a course with no
// wind regions is calm.
//
// The uniform path that used to live here was the last venue-wide weather variable — it
// scattered `5 + puffiness * 20` cells over the whole arena, which no course could say
// anything about. "Puffs everywhere" is now a whole-course gust region, which is one visible
// object you can select, move and turn off rather than an implicit one nobody could.

function spawnRegionGust(regs, initial) {
    // How many live cells each source currently owns.
    const have = new Map();
    for (const g of state.gusts) have.set(g.src, (have.get(g.src) || 0) + 1);
    let reg = null, worst = 0;
    for (const r of regs) {
        const deficit = r.count - (have.get(r.id) || 0);
        if (deficit > worst) { worst = deficit; reg = r; }
    }
    if (!reg) return;

    const bb = reg.bb, bw = bb.maxX - bb.minX, bh = bb.maxY - bb.minY;
    let gx = null, gy = null;
    for (let i = 0; i < 24; i++) {
        const x = bb.minX + Math.random() * bw;
        const y = bb.minY + Math.random() * bh;
        const sd = Arena.signedDist(reg, x, y);
        const u = VenueDoc.regionWeight(sd, reg.falloff);
        if (u > 0 && Math.random() < u) { gx = x; gy = y; break; }
    }
    if (gx === null) {
        // Give up on the weighting rather than on the puff: the middle of the box is
        // inside any sane region, and a source that never emits is worse than one whose
        // rare cell lands slightly off-centre.
        gx = bb.minX + bw / 2; gy = bb.minY + bh / 2;
    }

    // The source states its own gust/lull split outright — that is what makes one primitive
    // able to be a funnel (bias 1) or a dead patch (bias 0).
    const type = Math.random() < reg.bias ? 'gust' : 'lull';
    const cell = createGust(gx, gy, type, initial, reg);
    cell.src = reg.id;             // so its source can count its own live cells
    state.gusts.push(cell);
}

function updateGusts(dt) {
    // THE SOURCES DECIDE HOW MANY. No sources, no puffs — a steady breeze, which is a
    // legitimate course and the one every venue has until someone draws a gust region.
    const regs = state.course.gustRegions;
    let targetCount = 0;
    if (regs) for (const r of regs) targetCount += r.count;
    const boundary = state.course.boundary;

    // Maintain density.
    //
    // BOUNDED, not `while`. The uniform spawner always produces a cell, so an unbounded loop
    // was safe; the region spawner can decline — every source at density 0 leaves nothing to
    // pick — and a `while` that never reaches its target is a hung frame, which is the worst
    // failure this file could have. The compile step already filters those regions out, but
    // an invariant held one file away is not a reason to leave a spin loop in the frame path.
    if (boundary) {
        for (let tries = targetCount + 1; tries > 0 && state.gusts.length < targetCount; tries--) {
            spawnRegionGust(regs, false);
        }
    }

    const timeScale = dt * 60;
    // ── A PUFF IS STEERED BY THE BREEZE IT IS IN ────────────────────────────────
    // These two used to be `state.wind.speed` / `state.wind.direction` — the region blend at
    // the ROUTE CENTROID — applied to every cell on the map. On a course whose wind is
    // uniform that is the same number everywhere and the bug is invisible; on one whose wind
    // actually varies it is simply the wrong wind. Glacier Sound's gust source sits in a 45°
    // katabatic tongue while the centroid reads 130°, so every puff born there was carried
    // 85° off its own breeze and left the arena within ten seconds, heading away from the
    // course. Measured before the fix: 3 cells alive, 0.04 of them inside the arena on
    // average, and not one ever within 900 units of the racing corridor.
    //
    // Both the design note in getWindAt ("a gust crossing a bend bends with it") and the
    // editor's own panel text ("a puff drifts downwind and steers by the breeze where it is")
    // already described the behaviour this now has.
    //
    // regionWindAt, NOT getWindAt: the mean field, without puffs and without lees. getWindAt
    // loops every cell, so steering cells with it would be O(n^2) and self-referential — a
    // puff would ride on its own pressure. A puff is a large-scale feature carried by the
    // gradient flow anyway, not something a boat-scale wind shadow deflects.
    const fallbackSpeed = state.wind.speed;
    const fallbackDir = state.wind.direction;

    for (let i = state.gusts.length - 1; i >= 0; i--) {
        const g = state.gusts[i];

        // The mean wind HERE, re-read every frame, so a cell crossing a bend turns with it
        // and one entering a stronger region speeds up. A cell that has drifted into water
        // no region covers has nothing to steer by, so it keeps the venue's own wind rather
        // than parking where it stopped.
        const local = regionWindAt(g.x, g.y);
        const wSpeed = local.speed > 0.1 ? local.speed : fallbackSpeed;
        const wDir = local.speed > 0.1 ? local.direction : fallbackDir;

        const moveSpeed = wSpeed * g.moveSpeedFactor;
        const moveDir = wDir + g.moveDirOffset;
        g.vx = -Math.sin(moveDir) * moveSpeed;
        g.vy = Math.cos(moveDir) * moveSpeed;

        // The cell lies ACROSS the breeze it is in, plus its own shift — so a puff crossing
        // a bend re-aims rather than staying square to a wind two kilometres away.
        g.rotation = wDir + g.dirDelta + Math.PI / 2;

        g.x += g.vx * timeScale;
        g.y += g.vy * timeScale;

        g.age += dt;

        // Grow and Shrink Lifecycle
        const lifeProgress = g.age / g.duration;
        const lifeFactor = Math.sin(lifeProgress * Math.PI); // 0 -> 1 -> 0
        g.radiusX = Math.max(10, g.maxRadiusX * lifeFactor);
        g.radiusY = Math.max(10, g.maxRadiusY * lifeFactor);

        if (g.age > g.duration) {
            state.gusts.splice(i, 1);
        }
    }
}

// ── SHADOWS: the lee of a solid thing ───────────────────────────────────────
//
// Downwind of an island the breeze is thin, and downstream of a rock the water is slack.
// Same geometry both times — a plume running away from the obstacle along the flow — so it
// is one function, asked twice with a different flow direction.
//
// CAST FROM THE SILHOUETTE, not from the centroid and a bounding radius. That distinction
// is the whole reason the previous version had to be switched off for coastlines: a coast's
// bounding circle is ~9400 units centred inland, so its "shadow" began nine kilometres
// upwind of the shore and blanketed the map. Projecting the ring onto the flow axis instead
// gives the two numbers that are actually wanted — where the land ENDS (the shoreline, where
// the lee begins) and how broad it is ACROSS the wind (what it really blocks). Those are
// right for a small island and for a coastline, so there is no special case left.
//
// The projection is O(vertices), and getWindAt runs per boat and per particle per frame, so
// it is cached against a quantised flow direction and rebuilt only when the wind has turned
// enough to matter. Touches no RNG — a shadow cannot move the eval stream.
const SHADOW_QUANTUM = 0.035;        // ~2 degrees
const SHADOW_MAX = 0.7;              // deepest reduction, at the shore on the centreline
const SHADOW_SPREAD = 0.35;          // how much the plume widens over its length

// `slot` names the cache field, so wind and current keep SEPARATE silhouettes. They shared
// one, keyed by a string that included the kind — which is a cache that reports a miss every
// time both are in use, and rebuilds an 85-vertex projection twice per island per sample.
function shadowSil(isl, flowX, flowY, key, slot) {
    let sil = isl[slot];
    if (sil && sil.key === key) return sil;
    const verts = isl.isFloe ? isl.localArt : isl.vertices;
    if (!verts || !verts.length) return null;
    const ox = isl.isFloe ? isl.x : 0, oy = isl.isFloe ? isl.y : 0;
    let alongMax = -Infinity, crossMin = Infinity, crossMax = -Infinity;
    for (const v of verts) {
        const px = v.x + ox, py = v.y + oy;
        const along = px * flowX + py * flowY;
        const cross = px * (-flowY) + py * flowX;
        if (along > alongMax) alongMax = along;
        if (cross < crossMin) crossMin = cross;
        if (cross > crossMax) crossMax = cross;
    }
    sil = { key, alongMax, crossMid: (crossMin + crossMax) / 2,
            halfW: Math.max(1, (crossMax - crossMin) / 2) };
    isl[slot] = sil;
    return sil;
}

// WHICH WAY THIS OBSTACLE'S LEE POINTS: the mean wind at the obstacle itself.
//
// Not the venue mean. That is the bug this replaces — on Glacier Sound the mean is 130 degrees
// while the wind over the course runs from 45 to 217, so every shape cast its lee up to 85
// degrees away from the air actually passing it, and 462 of 599 shadowed samples disagreed
// with the truth. In the worst places the game took 70% of the breeze away where the real wind
// left a shape's lee nowhere near.
//
// And deliberately NOT the wind at the SAMPLE POINT, which sounds more local but is worse:
// two points either side of a lee would each test against a differently-aimed plume from the
// SAME island, so the lee would come apart into seams and holes instead of being one coherent
// wake. Which way a wake lies is a fact about the obstacle, not about who is looking at it.
//
// The obstacle's reference point stands for the whole shape. That is exact for the small ones
// and an approximation for a long coast lying across a bend — but a single shape can only have
// one wake, so some point has to speak for it, and its own is the defensible one. (No venue
// gives its coastline a height today, so nothing large is currently affected.)
//
// CACHED: shadowAt runs inside getWindAt, and getWindAt runs per boat and per particle per
// frame. The day's live shift is added at READ time rather than baked into the cache — it is
// the same angle on every region, so it rotates the blended mean exactly, which leaves only
// the static part to recompute.
function islandWindDir(isl) {
    const shift = state.wind.direction - state.wind.baseDirection;
    // Region oscillation is measured in tens of seconds, so a quarter-second key is far finer
    // than anything it can express. Floes are keyed on having actually moved.
    const tq = Math.round(state.time * 4);
    // ...and on the REGION SET ITSELF, by reference. The editor redraws the field after every
    // keystroke in a region's direction box, and a recompile hands back a fresh array — so
    // comparing the reference is both the cheapest test available and exactly the event that
    // should invalidate this. Without it the editor's field preview would keep showing lees
    // aimed down the wind the venue had BEFORE the edit, which is the one place a stale
    // shadow would be read as the truth about a design.
    const regs = state.course.windRegions;
    if (isl._wdT !== tq || isl._wdX !== isl.x || isl._wdY !== isl.y || isl._wdR !== regs) {
        isl._wdT = tq; isl._wdX = isl.x; isl._wdY = isl.y; isl._wdR = regs;
        isl._wdBase = regionWindAt(isl.x, isl.y).direction - shift;
    }
    return isl._wdBase + shift;
}

// A WAKE ONLY REACHES WATER THE FLOW ACTUALLY CARRIED IT TO, measured as the bend between the
// wind at the obstacle and the wind where you are standing.
//
// TWO numbers, not one. A wake genuinely does bend with the flow — Glacier Sound's isle-1 has
// 40 degrees of turn across its own 500-unit lee and is still plainly shadowing the water
// behind it — so a single cutoff either keeps the cross-field nonsense or throws away real
// lees. Full strength through the first 26 degrees, then fading, gone by a right angle: past
// that the streamline through here never came near the obstacle.
const SHADOW_BEND_FREE = Math.PI / 7;    // ~26 degrees: a wake carries this much turn intact
const SHADOW_BEND = Math.PI / 2;         // 90 degrees: none of it got here

// `dir` is where the flow GOES for current, and for WIND it is the mean direction AT THE SAMPLE
// POINT. The wind lee is still aimed by each obstacle's own wind — see islandWindDir — but the
// local one decides whether the wake got here.
function shadowAt(x, y, dir, kind) {
    const list = state.course.navIslands || state.course.islands;
    if (!list || !list.length) return 1;
    const isWind = kind === 'wind';
    // getWindAt has already blended the field and hands its answer in, so the gate below is
    // free on the hot path. A caller that passes null for wind gets it sampled lazily, and only
    // if some obstacle turns out to be a candidate — most calls touch no caster at all and must
    // not pay for a field lookup.
    let localDir = isWind ? (dir === null || dir === undefined ? null : dir) : null;
    // CURRENT keeps one direction for every obstacle, so its flow vector and silhouette key
    // are computed once. WIND does not: see islandWindDir.
    const cFlowX = isWind ? 0 : Math.sin(dir);
    const cFlowY = isWind ? 0 : -Math.cos(dir);
    const cKey = isWind ? '' : 'c' + Math.round(dir / SHADOW_QUANTUM);
    let factor = 1;
    for (const isl of list) {
        // LENGTH FIRST. It reads an authored number or a height and needs neither geometry nor
        // wind, and it is zero for almost everything — 114 of Glacier Sound's 123 shapes author
        // no height at all — so asking it before the direction lookup and the silhouette keeps
        // both off the hot path entirely.
        //
        // Authored per shape, in units; absent means derive it from the height. 0 is a real
        // answer — a reef awash blocks no breeze, and a designer may simply not want one here.
        const len = shadowLen(isl, kind);
        if (!(len > 0)) continue;
        let flowX, flowY, key;
        if (isWind) {
            const d = islandWindDir(isl);
            flowX = -Math.sin(d); flowY = Math.cos(d);
            key = 'w' + Math.round(d / SHADOW_QUANTUM);
        } else {
            flowX = cFlowX; flowY = cFlowY; key = cKey;
        }
        const sil = shadowSil(isl, flowX, flowY, key, isWind ? '_silW' : '_silC');
        if (!sil) continue;
        // Distance DOWNFLOW of the obstacle's trailing edge, so the plume starts where the
        // land stops rather than somewhere inside it.
        const along = (x * flowX + y * flowY) - sil.alongMax;
        if (along <= 0 || along >= len) continue;
        const cross = Math.abs((x * (-flowY) + y * flowX) - sil.crossMid);
        // Plumes spread as they run.
        const halfW = sil.halfW * (1 + SHADOW_SPREAD * (along / len));
        if (cross >= halfW) continue;
        // SMOOTHSTEP on both axes, not linear — the same falloff wind and current regions
        // use, so a soft edge means one thing everywhere in this file.
        //
        // Linear reached clear air with a non-zero slope, which is a crease: a visible line
        // where the lee stops instead of a fade. And it is the wrong shape. A real wake holds
        // a roughly CONSTANT deficit in the near field just behind the body, then recovers
        // through the middle, then asymptotes — an S-curve. Across the flow it is a bell
        // rather than a triangle, for the same reason: nothing steps out of a wake.
        const ss = (t) => t * t * (3 - 2 * t);
        const lat = ss(1 - cross / halfW);      // 1 on the centreline, 0 at the edge
        const lon = ss(1 - along / len);        // 1 at the obstacle, 0 at the tail

        // HAS THE WAKE GOT HERE? A plume is cast as a straight band down the wind at the
        // obstacle, which is right while the flow runs straight — and wrong the moment the
        // field bends, because the band then walks across water the wake never reached.
        //
        // Glacier Sound showed it plainly: a 4300-unit ice shelf standing in wind from 130
        // threw a 2500-unit band north-west, over water whose own wind is from 45. A boat
        // there has the breeze on its nose from the north-east and was being told it sat in
        // the lee of something to its SOUTH-EAST — downwind of it.
        //
        // So the local wind gates the lee: full where it still agrees with the obstacle's,
        // fading out as the two part, gone by SHADOW_BEND. Smooth, because the field is
        // smooth — this scales an already-coherent plume rather than aiming it, so it cannot
        // put a seam in one.
        let bend = 1;
        if (isWind) {
            if (localDir === null) localDir = regionWindAt(x, y).direction;
            const off = Math.abs(normalizeAngle(localDir - islandWindDir(isl)));
            if (off >= SHADOW_BEND) continue;
            if (off > SHADOW_BEND_FREE) {
                bend = ss(1 - (off - SHADOW_BEND_FREE) / (SHADOW_BEND - SHADOW_BEND_FREE));
            }
        }
        // Deepest shadow wins rather than shadows stacking: two islands in line should not
        // multiply into a dead calm neither of them could produce alone.
        factor = Math.min(factor, 1 - lat * lon * bend * SHADOW_MAX);
    }
    return factor;
}

// How far the lee reaches, in units.
//
// WIND scales with HEIGHT — six times it, mid-range of the five-to-eight a solid bluff body
// gives — because that is what a wind shadow is. Not with footprint: a granite spire and a
// sandbar of the same outline shadow completely differently, and a width-derived length
// cannot tell them apart. It also needed an arbitrary cap, since Glacier Sound's coast is
// 13000 units across and would have asked for a thirty-kilometre lee. Height needs no cap —
// it is bounded by what land is, and a 55 m rock giving 330 m of bad air is simply true.
//
// CURRENT is a different question, and the answer is not a depth model. What matters is
// whether the thing blocks the WATER COLUMN — whether it reaches the bottom. A grounded
// island blocks all of it and the stream goes around; a floe draws a metre or two of a
// column twenty metres deep and the water passes underneath, which is exactly why a floe
// DRIFTS WITH the current instead of disturbing it.
//
// So there is no toggle and no depth field: `motion` already carries it. Fixed is grounded,
// drift is floating. Where a wake does exist its scale is the FOOTPRINT the stream sees —
// height above the waterline has nothing to do with it — which is why the two lees derive
// from different measurements. `shadowSuggest` below is that figure, offered rather than
// applied; a deep-draught berg or a reef awash are both a typed number away.
//
// ⚠️ BOTH ARE OFF UNTIL AUTHORED. Height is 0 on every kind, and a wake has no derived
// default at all, so a venue casts no lee until someone decides it should. Deriving one
// from footprint looked reasonable and was not: Glacier Sound's coast is 13000 units broad,
// which handed it a 2.8 km wake nobody had asked for.
// The editor needs to show what "auto" currently works out to, and there must be exactly one
// answer to that — so it asks the game rather than deriving a second one of its own.
if (typeof window !== 'undefined') {
    window.shadowLengthOf = (isl, kind) => shadowLen(isl, kind);
}
// Sailing's own rule of thumb puts a wind shadow at seven to fifteen times the height of
// the thing casting it, and rigging references quote 10-20x. Ten is the middle of the
// agreement rather than a number picked to feel right. Nothing in any venue authors a
// height yet, so this decides nothing today — it decides what the FIRST authored cliff
// does, which is exactly when a made-up constant would have been hardest to argue with.
const SHADOW_HEIGHTS = 10;           // wind shadow, in obstacle heights
const SHADOW_WAKE = 2.5;            // current wake, in half-widths of what the stream sees
const M_TO_U = 5;                   // the world's scale: 5 units to the metre
function shadowLen(isl, kind) {
    const authored = kind === 'wind' ? isl.windShadow : isl.currentShadow;
    if (authored != null) return authored;
    if (kind !== 'wind') return 0;
    return (isl.height || 0) * SHADOW_HEIGHTS * M_TO_U;
}
// What a wake WOULD be if this thing were given one — the editor offers it as the
// placeholder so typing a real figure is a lookup rather than a guess. Zero for anything
// afloat, which is the physics rather than a UI decision.
if (typeof window !== 'undefined') {
    window.shadowSuggest = (isl) => {
        if (isl.isFloe) return 0;
        const dir = (state.wind && state.wind.direction) || 0;
        const sil = shadowSil(isl, Math.sin(dir), -Math.cos(dir), 'suggest|' + dir, '_silS');
        return sil ? sil.halfW * SHADOW_WAKE : 0;
    };
}

// THE MEAN WIND AT A POINT: the regions blended, plus the day's live shift. No puffs, no lee.
//
// Split out of getWindAt so an OBSTACLE can ask which way its own lee points without asking
// for the lee — shadowAt is called from getWindAt, so anything the shadow consults has to
// stop short of the shadow or the two recurse forever. This is the field that gusts and
// shadows are applied on top of, and it is the honest answer to "which way is the wind
// blowing here" for anything that is not a boat.
function regionWindAt(x, y) {
    const baseSpeed = state.wind.speed;
    const baseDir = state.wind.direction;

    // ── Wind regions ────────────────────────────────────────────────────────
    // A region states the wind THERE — an absolute mean direction and (optionally) an
    // absolute speed — and overlapping regions are AVERAGED, not summed.
    //
    // Averaging is the whole point. Summing deltas meant that building a curving breeze
    // out of two regions also doubled its strength through the overlap, so every curve
    // came with a squall attached and the only way to avoid it was to author
    // compensating lulls. Averaged, two 12-knot regions 40 degrees apart give 12 knots
    // at 20 degrees, which is what a curving wind actually is.
    //
    // The blend is a partition of unity: each region contributes its falloff intensity
    // as a WEIGHT, and whatever weight is left over (1 - the sum, floored at zero) goes
    // to the venue's own wind. So a region's edge still fades smoothly into its
    // surroundings, full coverage means the regions decide entirely, and nothing
    // anywhere can exceed the strongest thing blowing.
    //
    // Direction averages as unit vectors and speed as a scalar, deliberately: averaging
    // full velocity vectors makes two opposed regions cancel to a calm, which is a
    // convergence nobody asked for when all they wanted was a bend.
    let dir = baseDir, spd = baseSpeed;
    const wregions = state.course.windRegions;
    if (wregions && wregions.length) {
        // The venue's live shift — oscillation, persistent shift — is a property of the
        // DAY, not of the patch of water, so it rides on top of every region's mean.
        // Without this a region would freeze the wind it covers, and a course fully
        // covered by regions would never see a shift at all.
        const liveShift = baseDir - state.wind.baseDirection;
        let wsum = 0, ux = 0, uy = 0, sacc = 0;
        for (const r of wregions) {
            // The edge ramp is centered on the outline (VenueDoc.regionWeight), so a
            // region reaches falloff/2 OUTSIDE its polygon — the cull box pads by that.
            const bb = r.bb, pad = (r.falloff || 0) / 2 + 1;
            if (x < bb.minX - pad || x > bb.maxX + pad || y < bb.minY - pad || y > bb.maxY + pad) continue;
            const sd = Arena.signedDist(r, x, y);
            const w = VenueDoc.regionWeight(sd, r.falloff);
            if (w <= 0) continue;
            // Mean plus an oscillation with an explicit time scale. state.time is
            // deterministic and no RNG is touched, so regions cannot shift the seeded
            // stream.
            const osc = r.period > 0 ? Math.sin((state.time / r.period) * Math.PI * 2 + r.phase) : 0;
            const rd = r.direction + r.dirVar * osc + liveShift;
            // A REGION STATES ITS OWN SPEED. There is no venue fallback: an absent speed is
            // zero, the same way an unstated patch of water is calm. Falling back to the
            // venue meant a region could look authored while silently borrowing a number
            // from somewhere else, and two regions with the same fields could blow at
            // different strengths depending on which venue they sat on.
            const rs = Math.max(0, (r.speed || 0) + r.speedVar * osc);
            ux += Math.sin(rd) * w; uy += -Math.cos(rd) * w;
            sacc += rs * w;
            wsum += w;
        }
        // NO WIND WHERE NO REGION SAYS THERE IS. The leftover weight goes to CALM, not to
        // a venue-wide breeze: once regions state the wind, an unstated patch is a hole in
        // the design, and filling it in silently is how a course comes to depend on a
        // fallback nobody authored. A hole is sailable-looking and unsailable, so the
        // checks hunt for it — see `no-wind` in venuecheck.
        const wBase = Math.max(0, 1 - wsum);
        const total = wsum + wBase;
        dir = wsum > 0 ? Math.atan2(ux, -uy) : baseDir;
        spd = total > 0 ? sacc / total : 0;
    }
    return { direction: dir, speed: spd };
}

// ── THE COURSE'S PRESSURE RANGE ─────────────────────────────────────────────
// What "a lot of wind" means HERE. Pressure is only ever readable against a reference:
// 18 knots is a hole on Glacier Sound and a squall on Gatorgrass, so a streak layer that
// paints pressure needs to know which course it is painting.
//
// The reference used to be `state.wind.speed`, which is the region blend at the ROUTE
// CENTROID — a single point. On Glacier Sound that point reads 20 while the start line
// sits in 16, so every streak at the start reported a lull and the layer said "no
// pressure anywhere" on the one venue whose wind actually varies across the water.
//
// So: sample the MEAN field (no puffs, no lee — those are the deviations we want to
// read AGAINST it) over sailable water and take its p10/p90. Sampled across a full
// oscillation period, because a region that breathes ±7 knots has a range no single
// instant shows. Then widened to at least ±18% of the median, because nine of the ten
// venues state one uniform wind region: without the widening lo === hi, the ramp has no
// denominator, and an island's lee — real pressure variation on a "steady" course —
// would have nothing to resolve against.
const PRESSURE_MIN_SPAN = 0.18;   // half-width of the narrowest ramp, as a fraction of the median
function computeWindPressureScale() {
    const med0 = Math.max(1, state.wind.baseSpeed || 10);
    const fallback = () => { state.wind.pressure = { lo: med0 * (1 - PRESSURE_MIN_SPAN), hi: med0 * (1 + PRESSURE_MIN_SPAN), med: med0 }; };
    const bnd = state.course && state.course.boundary;
    if (!bnd || typeof Arena === 'undefined') return fallback();

    // OVER THE RACECOURSE, not over the arena. Glacier Sound's arena is 8.75 km across and
    // the breeze at the far edge of it is never sailed; letting that water set the ramp put
    // the entire start box below `lo`, so every streak the player could see sat pinned at
    // the cold end with no gradient in it. The pressure that matters is the pressure on the
    // legs, so the marks decide the window — padded, because boats work the edges.
    let ext = Arena.extent(bnd);
    const mk = state.course.marks;
    const mlist = mk ? (Array.isArray(mk) ? mk : Object.values(mk)) : [];
    const pts = mlist.filter(m => m && typeof m.x === 'number');
    if (pts.length >= 2) {
        let a = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        for (const m of pts) { a.minX = Math.min(a.minX, m.x); a.maxX = Math.max(a.maxX, m.x); a.minY = Math.min(a.minY, m.y); a.maxY = Math.max(a.maxY, m.y); }
        const pad = Math.max(500, 0.35 * Math.max(a.maxX - a.minX, a.maxY - a.minY));
        ext = {
            minX: Math.max(ext.minX, a.minX - pad), maxX: Math.min(ext.maxX, a.maxX + pad),
            minY: Math.max(ext.minY, a.minY - pad), maxY: Math.min(ext.maxY, a.maxY + pad)
        };
    }

    // The longest period any region breathes on; 0 phases means one sample is the truth.
    let period = 0;
    for (const r of (state.course.windRegions || [])) if (r.period > period) period = r.period;
    const phases = period > 0 ? 6 : 1;

    // Each phase's own SPATIAL spread, then averaged — deliberately not one pooled
    // percentile over every phase at once. Pooling folds the breathing into the ramp, and
    // on a venue whose regions swing ±7 knots that leaves the spatial gradient — the
    // thing a player steers on — squeezed into half the ramp. Averaged, the gradient uses
    // most of the ramp at any instant, and a course-wide build still pushes the whole
    // field warm, which is the cue it should be.
    const t0 = state.time;
    const N = 26;
    let loAcc = 0, hiAcc = 0, medAcc = 0, phasesUsed = 0;
    for (let k = 0; k < phases; k++) {
        state.time = t0 + (period * k) / phases;
        const speeds = [];
        for (let i = 0; i <= N; i++) {
            const x = ext.minX + (ext.maxX - ext.minX) * (i / N);
            for (let j = 0; j <= N; j++) {
                const y = ext.minY + (ext.maxY - ext.minY) * (j / N);
                if (!Arena.contains(bnd, x, y, 0)) continue;
                if (!inMaskWater(x, y)) continue;
                speeds.push(regionWindAt(x, y).speed);
            }
        }
        if (speeds.length < 16) continue;
        speeds.sort((a, b) => a - b);
        const q = (f) => speeds[Math.round(f * (speeds.length - 1))];
        loAcc += q(0.10); hiAcc += q(0.90); medAcc += q(0.50); phasesUsed++;
    }
    state.time = t0;
    if (!phasesUsed) return fallback();

    const med = Math.max(1, medAcc / phasesUsed);
    // THE HONEST SPREAD, before the ramp widens it. `lo`/`hi` below are a drawing ramp and
    // are deliberately never narrower than ±18% — but a briefing that quoted those would
    // invent a range on the nine venues whose wind is one uniform region. The forecast
    // reads these instead. See windRangeText().
    state.wind.spread = { lo: loAcc / phasesUsed, hi: hiAcc / phasesUsed, med };
    let lo = Math.min(loAcc / phasesUsed, med * (1 - PRESSURE_MIN_SPAN));
    let hi = Math.max(hiAcc / phasesUsed, med * (1 + PRESSURE_MIN_SPAN));

    // HEADROOM FOR PUFFS. This ramp is built from the MEAN field on purpose — a puff is a
    // deviation and we want to read it AGAINST the mean, not fold it in. But a puff still
    // has to have somewhere to go: now that a gust's only wind cue is what it does to this
    // field, a cell landing on the windiest water was pinning colour, width and density to
    // the clamp with nothing left to say. Measured on Glacier Sound: a 7-knot puff on top
    // of its 28-knot katabatic corner moved every channel except length by exactly zero.
    //
    // HALF the stated gust, not all of it. Every knot of headroom costs the spatial
    // gradient — "which side has more pressure" — resolution, and that is the primary read.
    let biggest = 0;
    for (const r of (state.course.gustRegions || [])) if (r.count > 0 && r.gustKt > biggest) biggest = r.gustKt;
    if (biggest > 0) { hi += biggest * 0.5; lo -= biggest * 0.5 * LULL_RATIO; }

    state.wind.pressure = { lo: Math.max(0, lo), hi, med };
}

// 0 at the course's light end, 1 at its heavy end. Every channel the streak layer varies
// — hue, width, alpha, how many streaks are born — reads off this one number, so they can
// never disagree about where the pressure is.
function pressureAt(speed) {
    const p = state.wind.pressure;
    if (!p) return 0.5;
    const t = (speed - p.lo) / Math.max(0.001, p.hi - p.lo);
    return t < 0 ? 0 : t > 1 ? 1 : t;
}

function getWindAt(x, y) {
    const mean = regionWindAt(x, y);
    const dir = mean.direction, spd = mean.speed;

    // Convert to vector
    let sumWx = Math.sin(dir) * spd;
    let sumWy = -Math.cos(dir) * spd;

    // Net turn from every puff overlapping this point — see PUFF_FAN.
    let fanAcc = 0;
    for (const g of state.gusts) {
        const dx = x - g.x;
        const dy = y - g.y;
        const cos = Math.cos(-g.rotation);
        const sin = Math.sin(-g.rotation);
        // Local frame: +rx is DOWNWIND of the cell centre — the edge that reaches a boat
        // ahead of the puff first, so it is the leading edge. Compressed at the nose and
        // stretched behind, which is the half-moon a puff makes when it lands.
        const rx0 = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        const rx = rx0 >= 0 ? rx0 / PUFF_NOSE : rx0 / PUFF_TAIL;

        const distSq = (rx*rx)/(g.radiusX*g.radiusX) + (ry*ry)/(g.radiusY*g.radiusY);
        if (distSq <= 1) {
            // SMOOTHSTEP, like every other soft edge in this game — the wind regions, the
            // current regions, the shadows. The linear ramp here was the last one that was
            // not, and it met clear air with a crease: constant gradient right up to the rim
            // and then nothing. Smoothstep is flat at both ends and steepest in the middle,
            // which is how a puff actually arrives — you see it, then it comes on.
            const t = 1 - Math.sqrt(distSq);
            const falloff = t * t * (3 - 2 * t);
            const lifeFade = Math.min(g.age / 5, 1) * Math.min((g.duration - g.age) / 5, 1);
            const intensity = Math.max(0, falloff * lifeFade);

            if (intensity > 0) {
                 const gSpeed = g.speedDelta * intensity;
                 // The FAN: outward from the cell's axis, so the wind veers on one flank and
                 // backs on the other. `ry / radiusY` is -1..1 across the cell (the ellipse
                 // test already bounds it), zero on the axis. Weighted by `intensity`, so it
                 // fades with the cell's edge AND with its life — a dying puff leaves no
                 // shear behind it. Accumulated and applied to the RESULTANT below.
                 fanAcc += PUFF_FAN * (ry / g.radiusY) * (g.speedDelta >= 0 ? 1 : -1) * intensity;
                 // Local direction inside the puff, relative to the wind HERE — which is
                 // the region-blended direction, so a gust crossing a bend bends with it.
                 const gwDir = dir + g.dirDelta;

                 // Add puff vector
                 // Note: gSpeed can be negative (lull)
                 sumWx += Math.sin(gwDir) * gSpeed;
                 sumWy += -Math.cos(gwDir) * gSpeed;
            }
        }
    }

    // The local mean, which gates whether a wake reached here — the lee's AIM still comes
    // from each obstacle's own wind.
    const shadowFactor = shadowAt(x, y, dir, 'wind');

    const finalSpeed = Math.sqrt(sumWx*sumWx + sumWy*sumWy) * shadowFactor;
    // CLAMPED to one puff's worth. Cells overlap, and three flanks agreeing must not be able
    // to spin the wind further than the strongest single one of them could — a shift that
    // grows with how many cells happen to be stacked is a number nobody can read.
    const fan = Math.max(-PUFF_FAN, Math.min(PUFF_FAN, fanAcc));
    const finalDir = Math.atan2(sumWx, -sumWy) + fan;

    return { speed: finalSpeed, direction: finalDir };
}

function updateTurbulence(boat, dt) {
    if (boat.raceState.finished) return;

    // Spawn
    boat.turbulenceTimer -= dt;
    if (boat.turbulenceTimer <= 0) {
        // Increase spawn rate: 0.02 - 0.05s
        boat.turbulenceTimer = 0.02 + Math.random() * 0.03;
        // Init properties relative to cone (d=0)
        // Cross offset ratio: -0.5 to 0.5
        boat.turbulence.push({
            d: 0,
            crossRatio: (Math.random() - 0.5),
            speed: state.wind.speed * 4 + (Math.random()-0.5)*10, // px per sec
            phase: Math.random() * Math.PI * 2,
            life: 1.0
        });
    }

    // Update
    const maxDist = 450;
    for (let i = boat.turbulence.length - 1; i >= 0; i--) {
        const p = boat.turbulence[i];
        p.d += p.speed * dt;
        p.life -= dt * 0.3; // fade out

        if (p.d > maxDist || p.life <= 0) {
            boat.turbulence[i] = boat.turbulence[boat.turbulence.length - 1];
            boat.turbulence.pop();
        }
    }
}

function drawDisturbedAir(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

    for (const boat of state.boats) {
        if (boat.raceState.finished || !boat.turbulence) continue;

        // THE WIND THIS BOAT IS IN, not the venue mean. The bad-air cone that actually slows
        // the boat behind you is already built from `localWind.direction` in updateBoatPhysics
        // — this drew the matching plume from `state.wind.direction`, so on a venue whose
        // regions bend the breeze the two pointed different ways and the visible dirty air
        // streamed off sideways while the real one went downwind. Same wind, same picture.
        //
        // Sampled once per boat, not per particle: getWindAt walks every region and gust, and
        // ten boats is ten calls a frame where per-particle would be several hundred. The
        // plume is therefore straight — it does not bend along a gradient over its own 450
        // units — but it leaves the boat down the wind that is actually blowing there.
        const windDir = getWindAt(boat.x, boat.y).direction;
        const wx = -Math.sin(windDir);
        const wy = Math.cos(windDir);
        // Right Vector
        const rx = -wy;
        const ry = wx;

        for (const p of boat.turbulence) {
             const coneWidth = 20 + (p.d / 450) * 80;
             // Zigzag effect: Increased frequency (0.05 -> 0.08) and amplitude (5 -> 12)
             const zig = Math.sin(p.d * 0.08 + state.time * 8 + p.phase) * 12;
             const crossOffset = p.crossRatio * coneWidth + zig;

             const px = boat.x + wx * p.d + rx * crossOffset;
             const py = boat.y + wy * p.d + ry * crossOffset;

             // Slightly larger size
             const size = 2.0 + (p.d/450)*2.0;
             // More opaque: 0.4 -> 0.6 max alpha
             const alpha = Math.max(0, Math.min(1, (1.0 - p.d/450) * 0.6));

             ctx.globalAlpha = alpha;
             ctx.beginPath();
             ctx.arc(px, py, size, 0, Math.PI * 2);
             ctx.fill();
        }
    }
    ctx.restore();
}


// ── MUSIC ───────────────────────────────────────────────────────────────────
// Music STREAMS from <audio> elements; it is never decoded into an AudioBuffer.
// `spinnaker-run` is 4:31 of 48 kHz stereo, which decodes to ~104 MB of float32,
// and the old buffer cache never evicted — ten per-venue race tracks would have
// cost roughly a gigabyte of RAM. A media element costs a socket.
//
// `loopEnd` is where the music actually STOPS, and it is the reason a loop no
// longer has a hole in it. Every track ends with a fade (yacht-club runs 6.9 s
// down to digital silence, spinnaker-run 7.1 s); the old player set
// `source.loop = true` over the whole file, so every lap through played the fade
// and then hard-cut back to a cold intro. We turn the loop around before the
// fade starts instead.
//   ⚠️ These values are measured from the RMS envelope — the last half-second
//   above -12 dB of peak — NOT from bar lines, so a seam can land mid-bar. The
//   0.6 s crossfade blurs it rather than clicking. Replace them with bar-accurate
//   values when the tracks are recut, which is the real fix.
//
// `trim` normalises playback level. Measured mean loudness across the set ran
// -16.2 dB (harbor-results) to -20.2 dB (yacht-club); these bring everything to
// about -17 dB so a cue change is not also a volume change.
//
// `harbor-glow.mp3` and `breezy-race.mp3` ship but are deliberately unassigned —
// there is no cue for either. Both are kept: unassigning is how a track is retired.
// Every row here is produced by `python3 regatta/art/music_loop.py <file>` — run it on
// a new track and paste what it prints. Do not hand-edit loopEnd or trim.
// `loopStart` matters as much as loopEnd and is NOT its mirror. A track can begin at
// full LEVEL and still be far too sparse to loop back into — Suno likes to open a bed
// with a bare pulse and fill the texture in, which measures fine and sounds like
// nothing. `loopStart..loopEnd` IS the track: playback ENTERS at loopStart and returns
// there, so anything before it is unused material. music_loop.py measures it by DENSITY
// (the local floor), not by level, because level cannot see sparseness at all.
const MUSIC_TRACKS = {
    // The Game's Song, and the fourth attempt at it. This is the track the player hears
    // first and the one guidelines/music.md §13 wants every venue bred from, so it is the only cue briefed
    // for a HOOK — the ten venue tracks are texture and this is the tune they belong to.
    //   chroma flux 0.200 is what "catchy" measures, and it is the best of the menu
    //   line (0.109 -> 0.152 -> 0.200), just under lighthouse-cove's 0.205. It got
    //   there by asking for a MECHANISM, not an adjective: "a short phrase that repeats
    //   and answers itself" and "call and response", where "memorable piano melody"
    //   had produced the least melodic track in the project.
    //   ⚠️ Its 127.5 s body is short for the one cue that loops inside a sitting, and
    //   that is fine: the seam measures 0.2 dB. A seam nobody can hear heard often
    //   beats an audible one heard rarely — take 2 had 361 s of body and a 2.1 dB seam.
    //   ⚠️ A minor against a brief that asked for major twice. `minor key` in the
    //   excludes does not work (three data points); the TONIC holds when named, the
    //   third drifts. Accepted — a minor theme can be plenty warm.
    //   The Dec 2025 original is retired to yacht-club-2025.mp3, unassigned.
    menu:         { file: 'assets/audio/yacht-club.mp3',         loopEnd: 127.5, trim: 0.85 },
    racing:       { file: 'assets/audio/spinnaker-run.mp3',      loopEnd: 264.5, trim: 0.96 },
    // Results, and the most-repeated cue in the game: it fires after EVERY race, so
    // familiarity fatigue beats loop fatigue as the risk. harbor-glow wins the slot on
    // three numbers that are exactly this brief — 11.2 dB dynamics (harbor-results has
    // 6.3, and this cue needs to feel alive), F major r=0.88 (harbor-results is A
    // MINOR, which reads "you lost" whatever you actually finished), and an unhurried
    // 89 BPM. 120.0 s of body from a 120.3 s file, so nothing is discarded.
    //   ⚠️ It is generous rather than triumphant on purpose: `targetCue()` returns
    //   'results' whatever happened, so this same track plays for a win and for eighth.
    //   A fanfare after eighth is worse than a warm track after a win.
    //   harbor-results.mp3 is retired to unassigned, not deleted.
    results:      { file: 'assets/audio/harbor-glow.mp3',        loopEnd: 120.0, trim: 1.02 },
    'racing-seatrials': { file: 'assets/audio/seatrials.mp3',    loopStart: 20.5, loopEnd: 119.5, trim: 0.84 },
    'racing-arctic':    { file: 'assets/audio/arctic.mp3',       loopStart: 15.0, loopEnd: 137.5, trim: 0.78 },
    // Pearl Lagoon is the best-behaved file in the set: no intro and no outro, so
    // 118.5 s of its 119.0 s is loop body and nothing is discarded, and C major reads
    // at r=0.91 against a brief that asked for a sunlit major — the cleanest key in
    // the project.
    //   Its 39.4% in the wind band is second-worst here, and music.md §4 says put a WINDY
    //   venue's identity low. Measured rather than assumed: this venue races at 13 kn,
    //   the same as Lighthouse Cove, so the bed sits 12.1 dB under the music's RMS
    //   (bay 13.4, arctic 6.4 — arctic is the tight one). The conflict §4 warns about
    //   is not present today because THE SQUALLS ARE NOT BUILT YET. When the identity
    //   pass lands them, re-measure this venue before trusting the steel pan: a squall
    //   is exactly the event that takes the band this track lives in.

    'racing-lagoon':    { file: 'assets/audio/pearl-lagoon.mp3', loopEnd: 118.5, trim: 0.87 },
    // Per-venue race tracks override `racing` by key. Lighthouse Cove was held by
    // breezy-race, which is now unassigned: breezy-race puts 47.7% of its energy in
    // the 900 Hz-6.5 kHz band the wind bed was highpassed into, the worst in the set,
    // so the property that once justified it (brightest track here, 2795 Hz centroid)
    // is exactly what music.md §4's inversion turned into a liability. The purpose-written
    // track lands 29.3% and 112 BPM against a brief that asked for 112.
    //   ⚠️ Its 94.0 s loop body is the shortest in the project, so the seam comes
    //   round ~2.5 times in a race where breezy-race's came round once. The seam
    //   itself measures 0.0 dB (breezy-race: 2.0), which is the trade that makes it
    //   acceptable — a clean seam heard three times beats an audible one heard once.
    'racing-bay': { file: 'assets/audio/lighthouse-cove.mp3',    loopStart: 3.0,  loopEnd: 97.0,  trim: 0.79 },
    // Bluewater Bonanza, take 4 — ACCEPTED, and the take that proved the method.
    // Three earlier takes are unassigned beside it (`ocean-take1..3.mp3`).
    //   The venue's brief is contrast, and three takes failed to deliver it because
    //   the prompt kept ASKING FOR LEVEL, which Suno does not control: dynamics went
    //   11.4 -> 5.5 -> 3.8 dB as the demand got more explicit. Take 4 asked for
    //   ARRANGEMENT instead ("alternating sections: solo cello and guitar alone, then
    //   full orchestra") and dropped the words epic/huge/vast/heroic, which mean
    //   "loud and continuous" to the model. Result: 8.6 dB, and real swell SETS —
    //   a 30 s period at r=0.20 where take 3 had no periodicity at all.
    //   It is also the only take with spectral WIDTH rather than one extreme:
    //   22.6% above 2 kHz and a 1240 Hz centroid sit between take 1's murk (4.2%,
    //   445 Hz) and take 3's glare (42.9%, 2394 Hz). The wind band came back down to
    //   29.6% with it, level with lighthouse-cove.
    //   ⚠️ Its 3.8 dB seam is the one defect, and 222.5 s of body against ~243 s of
    //   prestart+race means it IS heard, once, about 20 s before the finish. Accepted
    //   because the alternative takes trade a rarer seam for no dynamics at all.
    'racing-ocean': { file: 'assets/audio/ocean.mp3',            loopStart: 2.0, loopEnd: 224.5, trim: 0.77 },
    // Gatorgrass Bayou, and the one venue where music.md §4 imposes nothing: it races at
    // 6.5 kn, the lightest in the game, so the wind bed is all but absent and the
    // whole spectrum is free. Its 18.8% wind band is therefore not a number to
    // defend — the bed sits at -44.6 dB here, the quietest anywhere, and headroom
    // measures 18.4 dB, the widest in the project (glowtide 17.0, arctic 10.2).
    //   Two dynamics numbers that disagree, both wanted: music_spec reports 9.4 dB
    //   (half-second frames — washboard and accordion transients, i.e. NOT squashed)
    //   while the long-term bucket swing is 4.0 dB (it breathes without ramping).
    //   Bluewater take 2 is the contrast: flat on both, 5.5 and 2.7.
    //   ⚠️ Briefed dorian, came back aeolian — B flat outweighs B natural 2:1, and
    //   dorian's whole identity is that raised sixth. Accepted: the venue is carried
    //   by the accordion and the drag, and a strong A7 dominant (C# at 7.6%) is more
    //   Cajun than a modal sixth would have been. See guidelines/music.md §10.
    'racing-swamp': { file: 'assets/audio/swamp.mp3',            loopEnd: 172.5, trim: 0.79 },
    // Glowtide Strait. Widest dynamics in the project (13.5 dB) and it is real shape,
    // not a ramp — peak at 141 s, a genuine trough at 200-226 s.
    //   ⚠️ It opens 6.4 dB down and takes ~25 s to arrive, and `music_loop.py` did NOT
    //   set a loopStart for it, because loopStart tests DENSITY and this opening is
    //   dense but QUIET — a full arpeggio at low level. That is why the seam measures
    //   3.8 dB, the worst here. It costs nothing at this venue and only here: 238.5 s
    //   of body against ~245 s of prestart+race means the seam is reached once, at the
    //   very end. On a shorter track the same gap would thump every loop.
    //   The happy accident worth protecting: the ~25 s build lands almost exactly on
    //   the gun, because the prestart is ~30 s. Adding a loopStart would DELETE that.
    'racing-glowtide': { file: 'assets/audio/glowtide.mp3',      loopEnd: 238.5, trim: 0.76 },
    // Sockeye Run. ⚠️ Its 3.4 dB dynamics would be a failure at Bluewater and are a PASS
    // here — this venue's brief is "perpetual motion with no rest in the rhythm", and
    // the ostinato that never rests IS the current. Same number, opposite verdict:
    // a dynamics figure only means something against the brief.
    //   Cleanest seam in the project at 0.6 dB. Tempo reads 136 against a briefed 120
    //   and that gap is real, not measurement noise (bins here are 123/129/136) — it
    //   collides with no other venue and makes the fastest venue faster still, which
    //   serves the difficulty ladder rather than fighting it.
    //   ⚠️ The weak third (F# 4.9% under F 6.3%, third/fifth 0.30) is the fiddle
    //   droning on open strings, not a missed key: tonic D is unambiguous and D-G-A
    //   carry 44% of the chroma. Same category as lighthouse-cove, not Glowtide.
    //   ⚠️ 479 s of body against a ~245 s race means half of it never plays, in a
    //   12.4 MB file. Same overshoot as Bluewater take 3; ~4 min is the target.
    'racing-river': { file: 'assets/audio/river.mp3',            loopEnd: 479.0, trim: 0.80 },
    // Redrock Reservoir. ⚠️ Its loop points are the FIRST to come from music_loop's
    // length-aware pair search, added because this track exposed the gap: the old
    // seam-only objective picked an 87.5 s body — shortest in the project, seam heard
    // ~2.8x a race — to win 0.03 dB over a 148.5 s alternative. See art/music_loop.py.
    //   ⚠️ Briefed mixolydian, came back plain F major: E outweighs Eb 8.5% to 3.6%
    //   and the flat seventh IS mixolydian. Third exotic-mode miss out of three
    //   (dorian, aeolian, mixolydian all flattened). Accepted — the venue is carried
    //   by the baritone guitar and the slapback, not by a mode nobody names aloud.
    //   ⚠️ It shares F major with Glowtide, the closest key collision in the set;
    //   glass marimba against baritone tremolo guitar is what still separates them.
    //   Pulse 96 is exactly the brief. Bluewater also reads 96 against a briefed 92,
    //   but that is one autocorrelation bin, so the two are probably not colliding.
    'racing-redrock': { file: 'assets/audio/redrock.mp3',        loopStart: 13.0, loopEnd: 161.5, trim: 0.85 },
    // Stillwater Lake, take 2 — the last venue, and the one where the BRIEF was the
    // bug. Take 1 (`lake-take1.mp3`, unassigned) asked for "sparse", "long rests
    // between phrases" and "silence is the mechanic", got exactly that, and was too
    // sleepy to use. The venue's mechanic is the patient read; the old brief had
    // translated patience into emptiness. A lake can be still and still be alive.
    //   Take 2 fixed it by asking for BRIGHTNESS and MOTION: 3.7% -> 16.2% above
    //   2 kHz, centroid 415 -> 1313 Hz, and the hollow third filled in (third/fifth
    //   0.29 -> 0.68) — which is what turns vague into lovely. Body 77 -> 240.5 s, so
    //   a ~243 s race essentially never reaches the seam.
    //   ⚠️ Its level is steady (3.8 dB over 2 s frames) and that is correct here: the
    //   movement is HARMONIC, not dynamic — chroma flux 0.166, the highest of any
    //   accepted track bar Clubhouse Point and Sockeye Run. Light on water shifts
    //   without getting louder. Do not read the flat level as the Bluewater failure.
    //   ⚠️ Briefed LYDIAN, came back plain G major: C natural still beats C# 12.8% to
    //   5.2%, and the sharp fourth IS lydian. This take carried the mitigation that
    //   had been proposed and never tested — mode first, named as a scale degree —
    //   and it made no difference. Five exotic modes briefed, five flattened.
    'racing-lake': { file: 'assets/audio/lake.mp3',              loopEnd: 240.5, trim: 0.98 },
    // Duckling Pond — ingested ahead of the venue itself, so this cue is INERT until a
    // venue registers under the `duckling` key; targetCue only builds keys from venues
    // that exist. Numbers from music_loop/music_spec, per the header rule:
    //   The 0.0 dB seam is the headline. Its 89.5 s body is the new shortest in the
    //   project (lighthouse-cove held it at 94.0), which is the same trade that entry
    //   documents — a seam nobody can hear, heard often, beats an audible one heard
    //   rarely. 24 s of finale plus a 4.2 s fade are discarded past loopEnd: the ending
    //   is denser than anything it could return to, which is what an ending is.
    //   8.0% in the 900 Hz–6.5 kHz wind band is the LOWEST of any accepted track
    //   (swamp held it at 18.8) — music.md §4 wants a venue's identity out of the
    //   bed's band, and a pond for beginners should leave the most room of anywhere.
    //   C major r=0.86, ~66 BPM pulse, centroid 797 Hz, 12.2 dB dynamics: warm, slow,
    //   and alive without being loud — ducklings at sunset, as briefed.
    'racing-duckling': { file: 'assets/audio/duckling-pond.mp3', loopStart: 1.5, loopEnd: 91.0, trim: 0.87 },
};

const MUSIC_VOLUME = 0.3;       // master, before per-track trim
const MUSIC_XFADE_CUE = 1.6;    // seconds, between cues (menu → prestart → racing)
const MUSIC_XFADE_SEAM = 0.6;   // seconds, across a loop point

// ── WIND BED ────────────────────────────────────────────────────────────────
// Steady state is ~8 dB below the old bed; a gust transient can open 7 dB on top
// of that, so the range is carried by EVENTS rather than by a constant hiss. Peak
// on a hard gust still lands slightly under where the old bed sat all the time.
//   ⚠️ This only breathes once venues author gust regions. Until then the wind
//   field is steady, apparent wind moves only with the boat, and the bed is
//   near-constant by construction — quiet, but not yet doing its job.
const WIND_SOUND = {
    // ── LEVEL. One knob, deliberately separated from the shape below. ───────────
    // Turn the bed up or down HERE and the balance between calm, breeze and gust is
    // untouched. Sitting at -6: the first pass shipped at 0 and still drew attention
    // to itself, which is what a continuous broadband sound does — and it does it
    // most of all because `musicEnabled` defaults to false, so for most players this
    // is the ONLY sustained sound in the game and has nothing to sit underneath.
    masterDb: -6,

    // ── SHAPE. How the bed moves; not how loud it is. ──────────────────────────
    minKn: 4, maxKn: 30,            // apparent wind, knots
    quietDb: -40, loudDb: -25,      // steady-state bed across that range
    gustDb: 7,                      // headroom a gust transient may open
    rushLoHz: 900,                  // rush starts above the music's low-mid
    rushHiMin: 1600, rushHiMax: 6500,
    rumbleHz: 180, rumbleMix: 0.35,
    // Rate of rise that fully opens the transient. Tuned to separate WEATHER from
    // STEERING: heading up or bearing away moves apparent wind about 1–2 kn/s and
    // should only nudge it, while a gust front crossing the boat moves it several
    // knots in a second and should open it all the way.
    gustRise: 4.0,                  // kn/s
    gustDecay: 1.5                  // seconds
};

// Sound System
const Sound = {
    // ⚠️ AUDIO MUST NEVER DRAW FROM Math.random().
    //
    // The two noise buffers below are `sampleRate * 2` samples each — about 96,000 draws
    // apiece, which was 57% of every number the simulation pulled in a whole race. Worse,
    // `initWindSound` fills its buffer ONCE PER PAGE, so the first race consumed ~96,000
    // more draws than every race after it and diverged from them completely. Golden traces
    // caught it as "arctic is non-deterministic"; it was never arctic, and never the ice.
    //
    // White noise from a fixed seed is indistinguishable by ear from white noise off the
    // global RNG, so the audio keeps its own stream and the simulation keeps its own.
    // This is the same rule the visual particles already follow.
    _noiseSeed: 0x2f6e2b1,
    fillNoise: function (data) {
        let x = this._noiseSeed;
        for (let i = 0; i < data.length; i++) {
            // xorshift32 — cheap, no allocation, and stable across engines.
            x ^= x << 13; x >>>= 0;
            x ^= x >>> 17;
            x ^= x << 5;  x >>>= 0;
            data[i] = (x / 0x80000000) - 1;
        }
    },

    ctx: null,
    musicBus: null,
    musicVoices: {},    // track -> up to two voices, so a loop seam can crossfade
    activeVoice: null,
    activeTrack: null,
    musicTick: null,

    init: function() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.updateMusic();
    },

    // Which cue the game is currently in. Results wins over race status because the
    // overlay is up while the status is still 'finished'.
    targetCue: function() {
        if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) return 'results';
        // The venue's track starts at the PRESTART and runs straight through the gun. It
        // resolves to the same cue either side, so nothing re-triggers at the start: the
        // music is already going when the race begins, rather than announcing it. That
        // also means the whole time you are on the water is scored by one continuous
        // piece — the countdown is part of the race, not a lobby for it.
        if (state.race.status === 'prestart' || state.race.status === 'racing') return 'racing';
        // Everything before the gun — venue picker, briefing, competitor list — is menu.
        if (UI.preRaceOverlay && !UI.preRaceOverlay.classList.contains('hidden')) return 'menu';
        return null;
    },

    // A venue may own its race track; absent an entry it races to the house track.
    resolveTrack: function(cue) {
        if (cue === 'racing') {
            const key = 'racing-' + (state.race.venue || settings.venue);
            if (MUSIC_TRACKS[key]) return key;
        }
        return cue;
    },

    musicOut: function() {
        if (!this.musicBus && this.ctx) {
            this.musicBus = this.ctx.createGain();
            this.musicBus.gain.value = MUSIC_VOLUME;
            this.musicBus.connect(this.ctx.destination);
        }
        return this.musicBus;
    },

    makeVoice: function(track) {
        const def = MUSIC_TRACKS[track];
        if (!def) return null;
        const el = new Audio(def.file);
        el.preload = 'auto';
        el.loop = false;    // the seam is driven by tickMusic, not by the element
        const voice = { el, track, gain: null, jsRamp: null, stopTimer: null, seamed: false };
        // ⚠️ NEVER route through Web Audio on file://. A media element loaded from the
        // filesystem is treated as cross-origin, so createMediaElementSource yields a node
        // that outputs SILENCE — while the element still plays, currentTime still advances
        // and the gain still reads whatever you set. Nothing throws and nothing logs. The
        // eval harness runs on file:// as well, so every assertion passed while the game
        // was silent on a developer's machine; only tapping the bus with an analyser found
        // it. Same-origin http(s) — which is how this ships — routes normally.
        if (this.ctx && location.protocol !== 'file:') {
            try {
                const src = this.ctx.createMediaElementSource(el);
                voice.gain = this.ctx.createGain();
                voice.gain.gain.value = 0;
                src.connect(voice.gain);
                voice.gain.connect(this.musicOut());
            } catch (e) {
                voice.gain = null;  // fall back to the element's own volume
            }
        }
        if (!voice.gain) el.volume = 0;
        return voice;
    },

    // Equal power: two voices crossfading on cos/sin quarter-turns sum to constant
    // power. The old player ramped both ends LINEARLY, which sums to a ~3 dB dip in
    // the middle of every transition — audible as a sag on each cue change.
    powerCurve: function(from, to, n) {
        const a = new Float32Array(n);
        const rising = to >= from;
        for (let i = 0; i < n; i++) {
            const w = (rising ? Math.sin : Math.cos)((i / (n - 1)) * Math.PI / 2);
            a[i] = rising ? from + (to - from) * w : to + (from - to) * w;
        }
        return a;
    },

    // Master volume lives on the bus — and the fallback path has no bus, so there it has
    // to be folded into the element's own volume or file:// would play at full level.
    // (0.3 x the largest trim is 0.39, comfortably inside the element's 0..1 range.)
    voiceTarget: function(voice) {
        const def = MUSIC_TRACKS[voice.track] || {};
        const trim = def.trim == null ? 1 : def.trim;
        return voice.gain ? trim : trim * MUSIC_VOLUME;
    },

    rampVoice: function(voice, target, duration) {
        if (!voice) return;
        if (voice.gain && this.ctx) {
            const g = voice.gain.gain;
            const now = this.ctx.currentTime;
            try {
                const from = g.value;
                if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
                else g.cancelScheduledValues(now);
                g.setValueAtTime(from, now);
                if (duration > 0) g.setValueCurveAtTime(this.powerCurve(from, target, 48), now, duration);
                else g.setValueAtTime(target, now);
            } catch (e) {
                g.setTargetAtTime(target, now, Math.max(0.01, duration / 3));
            }
            return;
        }
        // No Web Audio routing available — ramp the element's volume from tickMusic.
        voice.jsRamp = duration > 0
            ? { from: voice.el.volume, to: target, start: performance.now(), ms: duration * 1000 }
            : null;
        if (!voice.jsRamp) voice.el.volume = Math.max(0, Math.min(1, target));
    },

    stopVoice: function(voice, duration) {
        if (!voice) return;
        this.rampVoice(voice, 0, duration);
        clearTimeout(voice.stopTimer);
        voice.stopTimer = setTimeout(() => {
            try { voice.el.pause(); } catch (e) {}
        }, Math.max(0, duration * 1000) + 80);
    },

    // Start `track` at `from` seconds, crossfading whatever is playing out over the
    // same window. Each track keeps at most two voices so a loop seam can overlap
    // itself; the second one is only built when a seam actually needs it.
    playTrack: function(track, from, xfade) {
        const def = MUSIC_TRACKS[track];
        if (!def) return null;
        const pool = this.musicVoices[track] || (this.musicVoices[track] = []);
        let voice = pool.find(v => v !== this.activeVoice);
        if (!voice && pool.length < 2) {
            voice = this.makeVoice(track);
            if (voice) pool.push(voice);
        }
        if (!voice) voice = pool[0];
        if (!voice) return null;

        clearTimeout(voice.stopTimer);
        voice.seamed = false;
        // Seeking at readyState 0 is fine — the browser queues it until metadata arrives.
        // (Verified: a fresh element seeks to 15 s and lands there. What a seek DOES need
        // is an origin serving HTTP Range; without it `seekable` is empty and loopStart is
        // silently ignored. Real hosts do, and so must eval/test_audio.js's server.)
        try { voice.el.currentTime = from || 0; } catch (e) {}
        this.rampVoice(voice, 0, 0);
        const played = voice.el.play();
        // Autoplay policy can reject before the first gesture. updateMusic retries
        // on the next call, which init() makes from every gesture path.
        if (played && played.catch) played.catch(() => {});
        this.rampVoice(voice, this.voiceTarget(voice), xfade);

        const previous = this.activeVoice;
        this.activeVoice = voice;
        this.activeTrack = track;
        if (previous && previous !== voice) this.stopVoice(previous, xfade);
        this.startTick();
        return voice;
    },

    startTick: function() {
        if (this.musicTick) return;
        this.musicTick = setInterval(() => this.tickMusic(), 120);
    },

    tickMusic: function() {
        // Drive any fallback volume ramps (only live when Web Audio routing failed).
        Object.keys(this.musicVoices).forEach(track => {
            this.musicVoices[track].forEach(v => {
                if (!v.jsRamp) return;
                const t = Math.min(1, (performance.now() - v.jsRamp.start) / v.jsRamp.ms);
                const rising = v.jsRamp.to >= v.jsRamp.from;
                const w = (rising ? Math.sin : Math.cos)(t * Math.PI / 2);
                const val = rising
                    ? v.jsRamp.from + (v.jsRamp.to - v.jsRamp.from) * w
                    : v.jsRamp.to + (v.jsRamp.from - v.jsRamp.to) * w;
                v.el.volume = Math.max(0, Math.min(1, val));
                if (t >= 1) v.jsRamp = null;
            });
        });

        const voice = this.activeVoice;
        if (!voice || voice.el.paused || voice.seamed) return;
        const def = MUSIC_TRACKS[voice.track];
        const duration = isFinite(voice.el.duration) ? voice.el.duration : 0;
        const end = Math.min(def.loopEnd != null ? def.loopEnd : Infinity, duration || Infinity);
        if (!isFinite(end) || end <= MUSIC_XFADE_SEAM) return;
        if (voice.el.currentTime >= end - MUSIC_XFADE_SEAM) {
            voice.seamed = true;
            this.playTrack(voice.track, def.loopStart || 0, MUSIC_XFADE_SEAM);
        }
    },

    stopMusic: function(fade) {
        const duration = fade == null ? 0 : fade;
        Object.keys(this.musicVoices).forEach(track => {
            this.musicVoices[track].forEach(v => this.stopVoice(v, duration));
        });
        this.activeVoice = null;
        this.activeTrack = null;
        clearInterval(this.musicTick);
        this.musicTick = null;
    },

    updateMusic: function() {
        if (!settings.musicEnabled) {
            if (this.activeTrack || this.activeVoice) this.stopMusic(0.5);
            return;
        }
        const cue = this.targetCue();
        if (!cue) {
            if (this.activeTrack) this.stopMusic(MUSIC_XFADE_CUE);
            return;
        }
        const track = this.resolveTrack(cue);
        // The paused check covers a play() the autoplay policy rejected earlier.
        if (this.activeTrack === track && this.activeVoice && !this.activeVoice.el.paused) return;
        // Start at loopSTART, not at zero. `loopStart..loopEnd` IS the track as far as the
        // game is concerned. This used to start at 0 so a sparse opening "played once, when
        // the cue started" — which was exactly backwards: a cue starts at the moment the
        // music most needs to be present, and Clubhouse Point opens on twenty seconds of
        // bare woodblock that a player reasonably reported as the music not playing at all.
        const def = MUSIC_TRACKS[track];
        this.playTrack(track, (def && def.loopStart) || 0, MUSIC_XFADE_CUE);
    },

    playTone: function(freq, duration, type='sine', startTime=0) {
        if (!settings.soundEnabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        const now = this.ctx.currentTime + startTime;
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.start(now);
        osc.stop(now + duration);
    },

    playStart: function() {
        if (!settings.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Noise
        const bufferSize = this.ctx.sampleRate * 2.0;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        this.fillNoise(data);
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1000, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(50, now + 1.0);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 2.0);
        // Thump
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
        oscGain.gain.setValueAtTime(1.0, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.0);
    },

    playFinish: function() {
        if (!settings.soundEnabled) return;
        this.init();
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => this.playTone(freq, 0.4, 'square', i * 0.15));
    },

    playPenalty: function() {
        if (!settings.soundEnabled) return;
        this.init();
        this.playTone(150, 0.15, 'sawtooth', 0);
        this.playTone(150, 0.15, 'sawtooth', 0.2);
    },

    playGateClear: function() {
        if (!settings.soundEnabled) return;
        this.init();
        this.playTone(659.25, 0.1, 'sine', 0);
        this.playTone(880.00, 0.4, 'sine', 0.1);
    },

    // The bed follows APPARENT wind — what the boat actually feels. Bearing away and
    // accelerating makes its own wind, and that is information the HUD does not show;
    // running deep goes quiet, which is both true and useful.
    playerWindSpeed: function() {
        const p = state.boats && state.boats[0];
        if (p && p.apparentWind && isFinite(p.apparentWind.speed)) return p.apparentWind.speed;
        return state.wind.speed;
    },

    // The bed belongs to being ON THE WATER. The venue picker and the scoreboard are not
    // sailing, and a breeze that keeps blowing behind them reads as a stuck sound rather
    // than as weather — the water there is a backdrop, not a place you are. Prestart
    // counts: you are out there manoeuvring, the gun just hasn't gone.
    windAudible: function() {
        if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) return false;
        if (UI.preRaceOverlay && !UI.preRaceOverlay.classList.contains('hidden')) return false;
        return state.race.status === 'prestart' || state.race.status === 'racing';
    },

    initWindSound: function() {
        if (!this.ctx || this.windSource) return;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        this.fillNoise(data);
        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = buffer;
        this.windSource.loop = true;

        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;

        // RUSH — highpassed clear of the music, then a lowpass that opens with speed.
        // The old bed was a single lowpass sweeping 300→1200 Hz, i.e. parked exactly on
        // guitar body, bass and kick: it masked the score and told you nothing the wind
        // readout didn't already say.
        this.windHP = this.ctx.createBiquadFilter();
        this.windHP.type = 'highpass';
        this.windHP.frequency.value = WIND_SOUND.rushLoHz;
        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windFilter.frequency.value = WIND_SOUND.rushHiMin;

        // RUMBLE — a quiet low layer so the bed reads as weather rather than tape hiss.
        this.windRumble = this.ctx.createBiquadFilter();
        this.windRumble.type = 'lowpass';
        this.windRumble.frequency.value = WIND_SOUND.rumbleHz;
        this.windRumbleGain = this.ctx.createGain();
        this.windRumbleGain.gain.value = WIND_SOUND.rumbleMix;

        this.windSource.connect(this.windHP);
        this.windHP.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windSource.connect(this.windRumble);
        this.windRumble.connect(this.windRumbleGain);
        this.windRumbleGain.connect(this.windGain);
        this.windGain.connect(this.ctx.destination);
        this.windSource.start(0);

        this.windPrev = null;
        this.windGust = 0;
        this.windTime = this.ctx.currentTime;
    },

    updateWindSound: function(speed, mute = false) {
        if (!this.ctx) return;
        if (!settings.soundEnabled || !settings.bgSoundEnabled || mute || !this.windAudible()) {
            if (this.windGain) this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
            // Forget the history too, so arriving on the water does not read the jump from
            // silence as a gust and open the transient on the first frame of the prestart.
            this.windPrev = null;
            this.windGust = 0;
            return;
        }
        if (!this.windSource) this.initWindSound();
        if (!this.windGain || !this.windFilter) return;

        const C = WIND_SOUND;
        const now = this.ctx.currentTime;
        const dt = Math.max(0, Math.min(0.5, now - (this.windTime == null ? now : this.windTime)));
        this.windTime = now;

        const kn = Math.max(C.minKn, Math.min(C.maxKn, speed || 0));

        // What opens the transient is the RISE, not the level — a gust arriving is the
        // one thing this sound can report that nothing else in the game does.
        if (this.windPrev != null && dt > 0) {
            const rise = (kn - this.windPrev) / dt;   // knots per second
            if (rise > 0) this.windGust = Math.min(1, Math.max(this.windGust, rise / C.gustRise));
        }
        this.windPrev = kn;
        this.windGust *= Math.exp(-dt / C.gustDecay);

        // Mapped in dB, not linear amplitude: the old curve bunched nearly all of its
        // perceptual movement into the top of the wind range.
        const t = (kn - C.minKn) / (C.maxKn - C.minKn);
        const db = C.masterDb + C.quietDb + (C.loudDb - C.quietDb) * t + C.gustDb * this.windGust;
        const volume = Math.pow(10, db / 20);
        // A gust is brighter as well as louder — pressure arrives in the top of the sound.
        const bright = Math.min(1, t + 0.35 * this.windGust);

        this.windGain.gain.setTargetAtTime(volume, now, 0.08);
        this.windFilter.frequency.setTargetAtTime(
            C.rushHiMin + (C.rushHiMax - C.rushHiMin) * bright, now, 0.08);
    }
};

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements Cache
const UI = {
    compassRose: document.getElementById('hud-compass-rose'),
    windArrow: document.getElementById('hud-wind-arrow'),
    headingArrow: document.getElementById('hud-heading-arrow'),
    speed: document.getElementById('hud-speed'),
    windSpeed: document.getElementById('hud-wind-speed'),
    windAngle: document.getElementById('hud-wind-angle'),
    vmg: document.getElementById('hud-vmg'),
    timer: document.getElementById('hud-timer'),
    startTime: document.getElementById('hud-start-time'),
    message: document.getElementById('hud-message'),
    legInfo: document.getElementById('hud-leg-info'),
    legTimes: document.getElementById('hud-leg-times'),
    waypointArrow: document.getElementById('hud-waypoint-arrow'),
    pauseScreen: document.getElementById('pause-screen'),
    helpScreen: document.getElementById('help-screen'),
    settingsScreen: document.getElementById('settings-screen'),
    helpButton: document.getElementById('help-button'),
    closeHelp: document.getElementById('close-help'),
    resumeHelp: document.getElementById('resume-help'),
    resumeButton: document.getElementById('resume-button'),
    restartButton: document.getElementById('restart-button'),
    settingsButton: document.getElementById('settings-button'),
    closeSettings: document.getElementById('close-settings'),
    saveSettings: document.getElementById('save-settings'),
    settingSound: document.getElementById('setting-sound'),
    settingBgSound: document.getElementById('setting-bg-sound'),
    settingMusic: document.getElementById('setting-music'),
    settingPenalties: document.getElementById('setting-penalties'),
    settingNavAids: document.getElementById('setting-navaids'),
    settingTrim: document.getElementById('setting-trim'),
    settingCameraMode: document.getElementById('setting-camera-mode'),
    settingTelltaleColor: document.getElementById('setting-color-telltale'),
    leaderboard: document.getElementById('leaderboard'),
    lbLeg: document.getElementById('lb-leg'),
    lbRows: document.getElementById('lb-rows'),
    lbPips: document.getElementById('lb-pips'),
    characterPicker: document.getElementById('character-picker'),
    overpoweredBadge: document.getElementById('hud-overpowered'),
    ocsBanner: document.getElementById('hud-ocs'),
    ocsArrow: document.getElementById('hud-ocs-arrow'),
    resultsOverlay: document.getElementById('results-overlay'),
    resultsList: document.getElementById('results-list'),
    resultsRestartButton: document.getElementById('results-restart-button'),
    resultsRematchButton: document.getElementById('results-rematch-button'),
    preRaceOverlay: document.getElementById('pre-race-overlay'),
    // Config Sliders
    venuePicker: document.getElementById('venue-picker'),
    venueDetail: document.getElementById('venue-detail'),

    // Obstacles UI
    valIslandCount: document.getElementById('val-island-count'),

    // Current UI
    valCurrentDir: document.getElementById('val-current-direction'),
    valCurrentSpeed: document.getElementById('val-current-speed'),
    uiCurrentArrow: document.getElementById('ui-current-arrow'),
    uiCurrentDirText: document.getElementById('ui-current-dir-text'),
    currentControls: document.getElementById('current-controls'),

    prCompetitorsGrid: document.getElementById('pr-competitors-grid'),
    // Toast
    toast: document.getElementById('toast-notification'),
    toastMsg: document.getElementById('toast-message'),

    startRaceBtn: document.getElementById('start-race-btn'),
    boatRows: {},

    // Water Debug
    waterDebug: document.getElementById('water-debug'),
    waterDebugControls: document.getElementById('water-debug-controls'),
    waterReset: document.getElementById('water-reset'),
    waterClose: document.getElementById('water-close')
};


;

// --- Venue picker ----------------------------------------------------------
// The strip under the hero: every venue as its own square art tile. Square because the
// art IS square (1254x1254) — the same master the hero shows at full size, downscaled,
// so there is no second crop to keep in sync with the first.
function renderVenuePicker() {
    if (!UI.venuePicker) return;
    const selected = (settings.venue && VENUES[settings.venue]) ? settings.venue : 'bay';
    const visibleKeys = Object.keys(VENUES);

    if (UI.venuePicker._keys !== visibleKeys.join()) {
        UI.venuePicker._keys = visibleKeys.join();
        UI.venuePicker.innerHTML = '';
        for (const key of visibleKeys) {
            const v = VENUES[key];
            const btn = document.createElement('button');
            btn.dataset.venue = key;
            btn.className = 'pr-venue-tile';
            // THE NAME SITS ON THE PICTURE. A caption outside the tile costs a line of
            // height per row — two rows, two lines — and that height is the picture's. On
            // the art, over a scrim, it costs nothing and labels the thing it names.
            btn.innerHTML = `
                <div class="pr-venue-shot">
                    <img src="assets/images/venues/thumbs/${key}.png" alt="${v.label}" draggable="false">
                    <span class="pr-venue-name t-display-8 uppercase">${v.name || v.label}</span>
                </div>`;
            btn.addEventListener('click', (e) => { e.preventDefault(); selectVenue(key); });
            UI.venuePicker.appendChild(btn);
        }
    }

    for (const btn of UI.venuePicker.children) {
        btn.classList.toggle('sel', btn.dataset.venue === selected);
    }
    sizeRaceDayHero();
    renderVenueDetail(selected);
    renderPreRaceBrief(selected);
}

// ⚠️ THE HERO'S HEIGHT IS SET BY ITS OWN WIDTH, and only JS can say so. The art panel is
// square and takes the hero's full height, so the hero must never be taller than the share
// of the column the art is allowed to have — otherwise the panel hits its max-width, stops
// being square, and the art letterboxes onto the gradient. CSS cannot express "my height
// depends on my width", so this runs on every render and on resize.
const HERO_ART_SHARE = 0.58;   // of the column's WIDTH — the art is square
const VENUE_TILE_MAX = 210;    // a tile is a picture of a place you can actually read
const VENUE_STRIP_SHARE = 0.48; // of the column's HEIGHT — the hero keeps the rest
function sizeRaceDayHero() {
    const hero = document.getElementById('venue-hero');
    const art = document.getElementById('venue-art');
    const picker = document.getElementById('venue-picker');
    const col = hero && hero.parentElement;
    if (!hero || !art || !col) return;
    const w = col.clientWidth, h = col.clientHeight;
    if (w <= 0) return;

    const side = Math.round(w * HERO_ART_SHARE);
    // ⚠️ ONE NUMBER GOVERNS BOTH ENDS. The height cap and the art's width ceiling have to be
    // the same share of the column: cap the height higher than the width and the square
    // panel hits its width limit, stops being square, and the art letterboxes.
    hero.style.maxHeight = side + 'px';
    art.style.maxWidth = side + 'px';

    // ⚠️ TWO ROWS OF VENUE TILES WILL EAT THE HERO IF LET. Five tiles stretched across a
    // 1450px column are 280px each, so the strip alone is 600px and the hero is left with
    // a 240px square. So the tile is capped twice — by taste (150px) and by the strip's
    // share of the column's height — and the row spreads whatever is left over as gaps
    // rather than growing the tiles.
    if (picker && h > 0) {
        const LABEL = 0, GAP = 10, ROWS = 2;   // the name is ON the picture now
        const budget = h * VENUE_STRIP_SHARE;
        const tile = Math.max(64, Math.min(VENUE_TILE_MAX, Math.floor((budget - ROWS * LABEL - GAP) / ROWS)));
        picker.style.gridTemplateColumns = `repeat(5, minmax(0, ${tile}px))`;
    }
}

// THE BREEZE A BRIEFING SHOULD QUOTE. Not `state.wind.baseSpeed`, which is the region
// blend at ONE POINT (the route centroid) — on Glacier Sound that point reads 20 while the
// katabatic corner blows 29 and the far side sits in 14, so the board called a course that
// varies by half its own strength "20 kt steady".
//
// `state.wind.spread` is the p10/p90 of the MEAN field over the racecourse, measured across
// a full oscillation period (computeWindPressureScale). Gust sources add their knots on top
// of that, because a puff is a deviation from the mean rather than part of it.
//
// "Steady" is then a claim the numbers have to earn: under a knot and a half of spread, and
// only then.
function windRangeText() {
    const sp = state.wind.spread;
    let lo = sp ? sp.lo : state.wind.baseSpeed;
    let hi = sp ? sp.hi : state.wind.baseSpeed;
    let gust = 0;
    for (const r of ((state.course && state.course.gustRegions) || [])) {
        if (r.count > 0 && r.gustKt > gust) gust = r.gustKt;
    }
    // HALF the stated gust, the same headroom the pressure ramp allows itself: a puff can
    // reach ~1.4x its source's knots at full spread, but a forecast that quotes the one
    // biggest puff of the race describes weather nobody sails in most of the time.
    if (gust > 0) { hi += gust * 0.5; lo -= gust * 0.5 * LULL_RATIO; }
    lo = Math.max(0, Math.round(lo));
    hi = Math.round(hi);
    return hi - lo >= 2 ? `${lo}–${hi} kt` : `${Math.round((lo + hi) / 2)} kt steady`;
}

// Two colours mixed in hex space. Only ever used on the venue's own water palette, to
// take the deep end darker still so white type has something to sit on.
function mixHex(a, b, t) {
    const [ar, ag, ab] = _rgbOf(a), [br, bg, bb] = _rgbOf(b);
    const m = (x, y) => Math.round(x + (y - x) * t);
    return `rgb(${m(ar, br)},${m(ag, bg)},${m(ab, bb)})`;
}

// THE HERO. The selected venue at full size: its square art on the short side, the
// briefing on the wide one, over a gradient built from the venue's OWN water colours —
// the same palette you are about to sail on, so the board is already telling you what
// the water looks like.
function renderVenueDetail(key) {
    if (!UI.venueDetail) return;
    const v = VENUES[key];
    const hero = document.getElementById('venue-hero');
    const art = document.getElementById('venue-art');

    const pal = ((window.VenueDoc && window.VenueDoc.get(key)) || {}).palette || {};
    const deep = pal.deepColor || '#0e7490';
    const base = pal.baseColor || '#0e6f84';
    if (hero) {
        // Dark at the text end, the venue's own water at the art end. The mix toward the
        // page colour is what keeps 14px body type legible on a bright lagoon.
        hero.style.background = `linear-gradient(115deg, ${mixHex(deep, '#0c1322', 0.55)} 0%, ${deep} 58%, ${base} 100%)`;
    }
    if (art) {
        art.innerHTML = `
            <img src="assets/images/venues/${key}.png" alt="${v.name || v.label}" draggable="false"
                 style="width:100%; height:100%; object-fit:contain; display:block;">
            <div style="position:absolute; inset:0; pointer-events:none;
                        background:linear-gradient(90deg, ${mixHex(deep, '#0c1322', 0.55)} 0%, rgba(12,19,34,0) 26%);"></div>`;
    }


    // Water = what the water itself is doing: current, swell, glass, chop.
    // Live values win over the static description when a flow exists.
    let waterVal = v.water;
    const vcTile = venueCurrent();
    if (vcTile) waterVal = vcTile.max.toFixed(1) + ' kt stream';
    else if (state.race.conditions.current) waterVal = state.race.conditions.current.speed.toFixed(1) + ' kt set';

    const row = (label, value, gold) => `
        <div class="pr-row flex items-center justify-between gap-5"
             style="background:${gold ? 'rgba(242,193,78,0.14)' : 'rgba(6,14,26,0.45)'};
                    border:1px solid ${gold ? 'rgba(242,193,78,0.4)' : 'transparent'};">
            <span class="t-label t-label-sm" style="color:${gold ? '#f2c14e' : '#9fd3dd'};">${label}</span>
            <span class="t-mono" style="font-size:12.5px; color:${gold ? '#f2c14e' : '#ffffff'};">${value}</span>
        </div>`;

    const idx = Object.keys(VENUES).indexOf(key) + 1;
    const best = bestForVenue(key);
    // The names run from "Redrock" to "Bluewater Bonanza", so the long ones step down a
    // size. Everything else about this block's type is in CSS, where a short window can
    // restyle it — see the max-height rules. Measuring the hero here would read a height
    // flex has not settled on the first paint.
    const longName = (v.name || v.label).length > 14 ? ' long' : '';

    // YOUR BEST sits at the TOP RIGHT of the gradient, opposite the venue chips: it is a
    // fact about you, not about the venue, so it does not belong in the stack of venue
    // readouts at the bottom — and up here it is the first thing you see on a course you
    // have raced before.
    // TWO RECORDS IN ONE PILL, divided. The clock is what you came back to beat, to the
    // thousandth because that is the precision it gets beaten by; the finish beside it is a
    // different race on a different day and was never the same fact — a light-air win is
    // slower than a windy eighth. They share a pill because the header row already carries
    // two chips and a third would run into them; the divider keeps them two claims.
    const bestValue = (label, value, color) =>
        `<span class="t-label t-label-sm" style="color:${color}; margin-right:6px;">${label}</span>`
      + `<span style="color:${color};">${value}</span>`;
    const bestChip = best
        ? `<span class="t-mono shrink-0" style="background:rgba(242,193,78,0.14); border:1px solid rgba(242,193,78,0.4);
                   border-radius:999px; padding:5px 13px; font-size:12.5px; white-space:nowrap;">
               ${bestValue('Your best', formatBestTime(best.t), '#f2c14e')}
               ${best.bestPos ? `<span style="color:rgba(242,193,78,0.35); margin:0 8px;">|</span>`
                              + bestValue('Finish', ordinalOf(best.bestPos), '#dbeafe') : ''}
           </span>`
        : '';

    UI.venueDetail.innerHTML = `
        <!-- WRAPS. Four nowrap chips do not fit a 386px venue column at 1280, and without
             this the left pair and the best pill simply drew on top of each other — which
             they were already doing, narrowly, before the finish record joined them. The
             second line comes out of the slack above the readouts (pinned by margin-top:auto),
             not out of the title. -->
        <div class="flex flex-wrap gap-2 shrink-0 items-start justify-between">
            <div class="flex gap-2" style="min-width:0;">
                <span class="t-label t-label-sm" style="background:rgba(6,14,26,0.45); border-radius:999px; padding:5px 13px; color:#dbeafe; white-space:nowrap;">Venue ${idx} of ${Object.keys(VENUES).length}</span>
                <span class="t-label t-label-sm" style="background:rgba(6,14,26,0.45); border-radius:999px; padding:5px 13px; color:#7ff0d4; white-space:nowrap;">${v.label}</span>
            </div>
            <div class="flex gap-2 shrink-0">${bestChip}</div>
        </div>
        <div class="t-display uppercase pr-venue-title${longName}">${v.name || v.label}</div>
        <div class="pr-blurb">${v.blurb || ''}</div>
        <div class="flex flex-col gap-1.5 shrink-0" style="margin-top:auto; padding-top:16px; max-width:360px;">
            ${row('Wind', windRangeText())}
            ${row('Water', waterVal)}
            ${row('Hazards', v.obstacles)}
        </div>`;
}

// The start bar's readouts: what you are about to sail, in one line, so the decision is
// re-checkable without looking back up at the hero.
function renderPreRaceBrief(key) {
    const el = document.getElementById('pr-brief');
    if (!el) return;
    const v = VENUES[key] || {};
    const cell = (label, value) => `
        <div>
            <div class="t-label" style="font-size:10px; letter-spacing:0.16em; color:#66748c;">${label}</div>
            <div style="font-size:14px; font-weight:800; margin-top:2px;">${value}</div>
        </div>`;
    const rule = `<div style="width:1px; height:30px; background:rgba(255,255,255,0.1);"></div>`;
    el.innerHTML = [
        cell('Venue', venueDisplayName(key) || '—'),
        rule,
        cell('Forecast', `${windRangeText()} · ${v.tagline || ''}`),
        rule,
        cell('Fleet', `${state.boats.length} boats · One Design`),
        rule,
        cell('Course', `${state.race.totalLegs} legs`)
    ].join('');
}

// --- Competitor scouting (sidebar, below the venue briefing) ---------------
let selectedCompetitor = null;
// Sentinel for the player's own fleet card. Deliberately not a legal AI_CONFIG
// name, so it can't collide with a competitor — or with a player who names
// themselves after one.
const PLAYER_CARD_KEY = '__player__';

// Clicking a badge opens that boat's scouting notes underneath it, in the list. Clicking
// it again closes them. There is no separate detail panel any more: with the fleet listed
// as badges, the notes belong to the badge you clicked, and a second panel would have been
// a second place to look for one boat.
function selectCompetitor(name) {
    selectedCompetitor = selectedCompetitor === name ? null : name; // toggle
    renderCompetitorGrid();
    // The list scrolls, so an expansion below the fold is an expansion nobody sees.
    if (selectedCompetitor && UI.prCompetitorsGrid) {
        const item = UI.prCompetitorsGrid.querySelector(`[data-name="${selectedCompetitor}"]`);
        if (item && item.scrollIntoView) item.scrollIntoView({ block: 'nearest' });
    }
}

// Kept as the name the pre-race setup and the venue switch call: selection state lives in
// the list now, so re-rendering the list IS re-rendering the detail.
function renderCompetitorDetail() { renderCompetitorGrid(); }

// Perceived brightness of a hex color. Three callers now (fleet cards, the
// competitor profile band, the player card), all asking the same question:
// is this color too dark or too washed out to carry a panel background?
function colorLuma(c) {
    const hex = (c || '#888888').replace('#', '');
    const dbl = hex.length === 3;
    const part = (i) => parseInt(dbl ? hex[i] + hex[i] : hex.substring(i * 2, i * 2 + 2), 16) || 0;
    return 0.299 * part(0) + 0.587 * part(1) + 0.114 * part(2);
}

// A color reads as a panel background unless it is near-black or near-white;
// in those cases fall back to the boat's other signature color.
function bandColorFor(primary, fallback) {
    const l = colorLuma(primary);
    return (l < 50 || l > 200) ? fallback : primary;
}

const _rgbOf = (c) => {
    const h = (c || '#64748b').replace('#', '');
    const dbl = h.length === 3;
    const part = (i) => parseInt(dbl ? h[i] + h[i] : h.substring(i * 2, i * 2 + 2), 16) || 0;
    return [part(0), part(1), part(2)];
};

// THE BOAT'S COLOUR, for a 42px leaderboard row — which is a different problem from the
// 128px profile card, twice over.
//
// `bandColorFor` picks by LUMINANCE: hull unless it is near-black or near-white, else the
// spinnaker. On a big card that is right. Here it failed twice. Most spinnakers are white,
// so two thirds of the fleet came out as a pale wash that swallowed the rank numeral. And
// deepening that wash does not rescue it: scaling white down gives GREY, because white has
// no hue to keep.
//
// So pick by CHROMA instead — whichever of the boat's colours is most saturated is the one
// a player would name it by — then pin the luminance so white text wins over all of them.
function deepBandFor(primary, fallback, accent) {
    const chromaOf = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
    const lumaOf = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

    // THE HULL FIRST, when it can carry the job. It is the biggest piece of a boat and the
    // thing a player would name it by — picking purely by chroma made Finley olive, because
    // her yellow kite out-saturates a perfectly good blue hull. The hull only loses when it
    // cannot serve: too dark, too pale, or too grey to read as a colour at all.
    let best = null, bestChroma = -1;
    const hull = primary ? _rgbOf(primary) : null;
    if (hull && chromaOf(hull) >= 40 && lumaOf(hull) > 45 && lumaOf(hull) < 205) {
        best = hull; bestChroma = chromaOf(hull);
    } else {
        for (const c of [fallback, accent, primary]) {
            if (!c) continue;
            const rgb = _rgbOf(c);
            if (chromaOf(rgb) > bestChroma) { bestChroma = chromaOf(rgb); best = rgb; }
        }
    }
    // A genuinely colourless boat gets the panel's own slate rather than a grey smear.
    if (!best || bestChroma < 30) return 'rgb(44,58,80)';
    let [r, g, b] = best;
    // Saturate toward the dominant channel a little, so a muted colour still reads as one
    // at this size, then scale to a fixed luminance.
    const mean = (r + g + b) / 3;
    const PUNCH = 1.35;
    r = mean + (r - mean) * PUNCH; g = mean + (g - mean) * PUNCH; b = mean + (b - mean) * PUNCH;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    const TARGET = 104;                 // colour reads, and white on it still clears 4.5:1
    const k = l > 1 ? TARGET / l : 1;
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

// Portrait band + blurb + stat bars + counter-tactic, as markup. Shared by the
// pre-race sidebar and the competitor.html roster sheet, so the roster always
// shows exactly what a player sees.
// The SPECIES, under the name. A competitor's name is invented ("Bruce") and its
// creature is the fact ("Great White Shark") — the profile said the first and never the
// second, so the roster read as 81 names rather than 81 animals.
//
// Set in mono rather than in the display or label face on purpose. The band already
// carries a 36px Saira name and an uppercase letterspaced archetype, and a third
// weight of the same voice would fight both. Mono reads as a specimen line — a
// stated fact rather than a third piece of branding — and it is the face the design
// system already uses for data everywhere else.
//
// Rendered by a helper because the same line goes on the fleet cards, where it has to
// be smaller: one definition, two sizes, so the two can't drift.
function speciesLine(creature, size) {
    if (!creature) return '';
    const s = size || 13;
    return `<div class="t-mono" style="font-size:${s}px; letter-spacing:0.4px; margin-top:${s > 11 ? 3 : 2}px;`
         + ` color:rgba(255,255,255,0.72); text-shadow:0 1px 4px rgba(0,0,0,0.75);">${creature}</div>`;
}

// THE IDENTITY BAND: portrait, name, species, archetype, boat. This is the fleet display —
// the block a player already reads when scouting a rival and when looking at themselves — so
// it is a function rather than markup inlined in one panel. The character picker is its third
// caller and shows exactly the same block, minus the archetype (see openCharacterPicker).
//
// `opts.archetype` false drops the gold archetype line but keeps its box, so a band with one
// and a band without still stack to the same height in a grid.
//
// `opts.compact` is the band at the size the race-day board's fleet list uses: a smaller
// portrait and name so ten of them stack in a 470px column.
//
// `opts.boat` keeps or drops the rig preview at the right-hand end; it defaults to ON for a
// full-size band and OFF for a compact one. ⚠️ IT IS NOT A TASTE CALL: `renderProfileBoat`
// claims 36% of the band's width, so the name and the species run underneath it once the
// band is narrower than about 420px. Pass `boat: true` on a compact band only when the
// column is wide enough to carry both — the fleet list at 470px is, a 380px panel is not.
// `opts.label` replaces the gold archetype line with a line of your own. The fleet list
// uses it to put YOU on your own badge — an archetype names the AI behaviour driving a
// character's stats, and on the boat you are steering there is no such behaviour to name.
function profileBandHTML(config, opts) {
    const o = opts || {};
    const showArch = o.archetype !== false;
    const compact = !!o.compact;
    const withBoat = o.boat !== undefined ? !!o.boat : !compact;
    const archDef = (typeof ARCHETYPES !== 'undefined' && config.archetype) ? ARCHETYPES[config.archetype] : null;
    // Header band in the competitor's racing colors (same hull-vs-spinnaker
    // luma pick as the fleet cards, so the panel matches their card)
    const bandColor = bandColorFor(config.hull, config.spinnaker);
    return `
        <div class="rounded-xl overflow-hidden border border-white/10 relative"
             style="background: linear-gradient(105deg, ${bandColor} 0%, ${bandColor}66 45%, rgba(15,23,42,0.92) 100%)">
            ${withBoat ? `<canvas class="profile-boat-canvas absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" width="176" height="130" data-boat="${config.name}"></canvas>` : ''}
            <div class="flex items-center relative" style="gap:${compact ? 14 : 20}px;">
                <img src="assets/images/competitors/${config.name.toLowerCase()}.png" alt="${config.name}" class="object-cover shrink-0" draggable="false"
                     style="width:${compact ? 92 : 128}px; height:${compact ? 92 : 128}px;">
                <div style="padding:${compact ? '10px 12px 10px 0' : '16px 0'}; min-width:0;">
                    <div class="t-display text-white uppercase leading-tight truncate" style="font-size:${compact ? 26 : 36}px; text-shadow: 0 2px 8px rgba(0,0,0,0.6)">${config.name}</div>
                    ${speciesLine(config.creature, compact ? 11 : 13)}
                    <div class="t-label mt-1" style="font-size:${compact ? 11 : 13}px; letter-spacing:${compact ? 1.8 : 2.5}px; color:#fcd34d; text-shadow: 0 1px 4px rgba(0,0,0,0.7)">${o.label !== undefined ? o.label : (showArch && archDef ? archDef.label : '')}</div>
                </div>
            </div>
        </div>`;
}

// THE SCOUTING NOTES: what this rival does, the three stats that say it, and how to beat
// them. Split out from the profile because the race-day board shows them on their own,
// under the badge you clicked — the badge is already there, so repeating it would be the
// same face twice in 90px.
function scoutingNotesHTML(config, compact) {
    const archDef = (typeof ARCHETYPES !== 'undefined' && config.archetype) ? ARCHETYPES[config.archetype] : null;

    // Highlight the character's three most extreme stats (base ±5 design
    // values, not the AI difficulty bonus) — the bars always say something.
    const STAT_NAMES = {
        acceleration: 'Acceleration', momentum: 'Momentum', handling: 'Handling',
        upwind: 'Upwind', reach: 'Reach', downwind: 'Downwind', pressure: 'Pressure',
        lightAir: 'Light Air', heavyAir: 'Heavy Air', memory: 'Memory'
    };
    const stats = config.stats || {};
    const sorted = Object.entries(stats).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const top3 = sorted.slice(0, 3);
    // A profile should show both sides: if the three most extreme stats are
    // all weaknesses (or all strengths), swap the last for the best of the
    // other sign — Pulse's panel shouldn't be a wall of red.
    const rest = sorted.slice(3);
    if (!top3.some(([, v]) => v > 0)) {
        const bestPos = rest.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
        if (bestPos) top3[2] = bestPos;
    } else if (!top3.some(([, v]) => v < 0)) {
        const worstNeg = rest.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1])[0];
        if (worstNeg) top3[2] = worstNeg;
    }
    // Strengths first, then weaknesses
    top3.sort((a, b) => (b[1] >= 0 ? 1 : 0) - (a[1] >= 0 ? 1 : 0) || Math.abs(b[1]) - Math.abs(a[1]));
    const bars = top3.map(([key, v]) => {
        const pos = v >= 0;
        return `
        <div class="flex items-center" style="gap:${compact ? 8 : 12}px;">
            <span class="t-label t-label-sm" style="width:${compact ? 84 : 112}px;">${STAT_NAMES[key]}</span>
            <div class="flex-1 rounded-full relative overflow-hidden" style="height:${compact ? 6 : 10}px; background:#293346;">
                <div class="absolute inset-y-0 left-1/2 w-px bg-white/20"></div>
                <div class="absolute inset-y-0 ${pos ? 'left-1/2 bg-emerald-400' : 'right-1/2 bg-rose-400'} rounded-full" style="width:${Math.abs(v) * 10}%"></div>
            </div>
            <span class="t-mono w-8 text-right ${pos ? 'text-emerald-300' : 'text-rose-300'}" style="font-size:${compact ? 12.5 : 14.5}px;">${v > 0 ? '+' : ''}${v}</span>
        </div>`;
    }).join('');

    const S = compact
        ? { quote: 13.5, quoteTop: 0, barsTop: 10, barGap: 7, headTop: 10, beat: 13 }
        : { quote: 16, quoteTop: 16, barsTop: 20, barGap: 12, headTop: 20, beat: 15 };

    return `
        <div class="italic pl-3" style="margin-top:${S.quoteTop}px; font-size:${S.quote}px; color:#e6ecf8; border-left:3px solid #fcd34d;">${config.personality || ''}</div>
        <div class="flex flex-col" style="gap:${S.barGap}px; margin-top:${S.barsTop}px;">${bars}</div>
        <div class="t-label t-label-sm" style="margin-top:${S.headTop}px;">How to Beat Them</div>
        <div class="mt-1 leading-snug" style="font-size:${S.beat}px; font-weight:500; color:#9fe6c4;">${config.beat || (archDef ? archDef.weakness : '')}</div>`;
}

// `asSelf` is the PLAYER looking at the character they have chosen. It keeps only what you
// actually take on — the face, the name, the species and the boat — and drops everything
// that describes a RIVAL: the stat bars (you take none of their stats), the archetype label
// (that is the AI behaviour driving those stats), the personality quote (they are not
// speaking, you are steering) and the counter-tactic, which would tell you how to beat
// yourself.
function competitorProfileHTML(config, asSelf, compact) {
    return profileBandHTML(config, { archetype: !asSelf, compact: !!compact })
        + (asSelf ? `` : `<div style="margin-top:${compact ? 12 : 16}px;">${scoutingNotesHTML(config, compact)}</div>`);
}

// Cockpit sole, wheel and mast, in the hull sprite's own coordinates. The sprite
// bakes the coaming, deck hatch and trunk; the sole is painted here so every boat
// keeps its own cockpit colour, and the wheel goes back on top of that paint —
// the sprite's own wheel sits underneath it. Shared by the race and the profile
// card so the two can't drift apart.
function drawCockpitFittings(g, cockpitColor) {
    const c = cockpitColor || '#cbd5e1';
    g.save(); // lineWidth/lineCap here must not leak into the sails or the fly
    // Matches the sole the artwork outlines: template px x 376..648, y 580..861
    const sole = () => { g.beginPath(); g.roundRect(-8.5, 6.75, 17, 17.5, 5); };
    g.fillStyle = c;
    sole(); g.fill();

    // The cockpit is a WELL sunk into the deck, so the coaming shades the sole
    // all the way around its inside edge. Clip to the sole and stroke the same
    // path: the outer half of each stroke is clipped away, leaving a band that
    // hugs the inside. Two bands, not a smooth ramp — the style guide asks for
    // hard 1-2 tone shading and no soft gradients, and the crisp step reads as
    // a well rather than a dished bowl. The middle of the sole stays flat,
    // because most of a cockpit floor is flat.
    //
    // Even all the way round rather than cast to one side — the boat rotates,
    // so a directional pool of shadow would swing with her and read as wrong.
    g.save();
    sole(); g.clip();
    for (const [inset, alpha] of [[2.4, 0.11], [1.1, 0.14]]) {
        g.strokeStyle = `rgba(15,23,42,${alpha})`;
        g.lineWidth = inset * 2; // half falls outside the clip
        sole(); g.stroke();
    }
    g.restore();

    // Wheel: dark on a pale sole, pale on a dark one, so it reads on any paint job
    const hex = c.replace('#', '');
    const luma = 0.299 * parseInt(hex.substring(0, 2), 16)
               + 0.587 * parseInt(hex.substring(2, 4), 16)
               + 0.114 * parseInt(hex.substring(4, 6), 16);
    const ink = (luma > 140 || !Number.isFinite(luma)) ? '#475569' : '#e2e8f0';
    const cy = 19.5, r = 3.05;
    g.strokeStyle = ink; g.fillStyle = ink;
    g.lineWidth = 0.6; g.lineCap = 'round';
    g.beginPath(); g.arc(0, cy, r, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    for (const a of [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6]) {
        g.moveTo(0, cy); g.lineTo(Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.stroke();
    g.beginPath(); g.arc(0, cy, 0.85, 0, Math.PI * 2); g.fill();

    // Mast
    g.fillStyle = '#475569'; g.beginPath(); g.arc(0, -5, 3, 0, Math.PI * 2); g.fill();
    g.restore();
}

// Their boat, kite flying, drawn from the same sprite pipeline as the race.
// Drawn around the origin at unit scale — the caller fits and places it.
function drawProfileBoatArt(g, cfg) {
    const u = 1024 / BOAT_SPRITE_SCALE;
    g.save();
    g.rotate(Math.PI / 6); // bow angled ~30° to the right
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath(); g.ellipse(3, 3, 12, 28, 0, 0, Math.PI * 2); g.fill();
    const hull = getTintedBoatPart('hull', cfg.hull);
    if (hull) g.drawImage(hull, -512 / BOAT_SPRITE_SCALE, -472 / BOAT_SPRITE_SCALE, u, u);
    drawCockpitFittings(g, cfg.cockpit);
    const sail = (sprite, tackY, rot, mirror) => {
        if (!sprite) return;
        g.save();
        g.translate(0, tackY);
        g.rotate(rot);
        g.scale(mirror, 1);
        g.globalAlpha = 0.95;
        g.drawImage(sprite, -512 / BOAT_SPRITE_SCALE, -112 / BOAT_SPRITE_SCALE, u, u);
        g.restore();
        g.globalAlpha = 1;
    };
    // broad reach: main and kite both to starboard, set at the same angle
    sail(getTintedBoatPart('main', cfg.sail), -5, -1.25, 1);
    // spinPattern first: the player picks theirs explicitly, and SPIN_LOOKS is
    // keyed by competitor name so it would miss them (or worse, match if they
    // happened to name themselves after one).
    sail(getSpinnakerSprite(cfg.spinPattern || SPIN_LOOKS[cfg.name] || 'solid', cfg.spinnaker, cfg.spinnaker2 || cfg.hull, cfg.spinnaker3), -28, -1.25, 1);
    g.restore();
}

// Painted bounds of that composition, relative to the origin. The silhouette is
// identical for every competitor (only the tints differ) and the pose is fixed,
// so this is a constant rather than a measurement — sniffing it from pixels
// would mean getImageData, which throws on a file:// page's tainted canvas.
// Re-derive it (alpha > 8 over a scratch render) if the pose or art changes.
const PROFILE_BOAT_BOUNDS = { x: -26, y: -26, w: 77, h: 59 };

// Can a profile boat be drawn at all yet? Both callers below need the answer: one to
// re-schedule itself, the other to decide whether the result is worth caching.
function boatSpritesReady() {
    return ['hull', 'main', 'spin'].every(k => boatSprites[k].complete && boatSprites[k].naturalWidth);
}

function renderProfileBoat(canvas, cfg) {
    if (!canvas) return;
    // Claim the right end of the header band, but give ground on narrow panels
    // so the boat never crowds the competitor's name
    const band = canvas.parentElement;
    const CW = Math.round(Math.max(104, Math.min(176, (band ? band.clientWidth : 480) * 0.36)));
    const CH = Math.max(96, Math.min(130, band ? band.clientHeight : 130));
    // Render at device resolution — a CSS-sized backing store blurs on HiDPI
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(CW * dpr)) {
        canvas.width = Math.round(CW * dpr); canvas.height = Math.round(CH * dpr);
        canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
    }
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (!boatSpritesReady()) {
        // sprites still loading (first open) — retry once they're in, unless
        // the panel has been swapped out from under us in the meantime
        setTimeout(() => { if (canvas.isConnected) renderProfileBoat(canvas, cfg); }, 300);
        return;
    }
    const box = PROFILE_BOAT_BOUNDS;
    // Fit the whole rig inside the canvas so nothing clips against the band
    // edge, but keep it a garnish rather than letting it fill the panel
    const pad = 7;
    const scale = Math.min(1.65, (CW - pad * 2) / box.w, (CH - pad * 2) / box.h);
    g.save();
    g.scale(dpr, dpr);
    g.translate(CW / 2, CH / 2);
    g.scale(scale, scale);
    g.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
    drawProfileBoatArt(g, cfg);
    g.restore();
}

// Name, colours, kite pattern and stats — everything that says WHICH BOAT this is, with
// nothing about where it is or how its race is going. Split out so a character can be
// swapped onto a boat that is already on the water (see swapClashingOpponent).
function applyBoatIdentity(boat, config, isPlayer) {
    boat.name = config ? config.name : boat.name;
    boat.colors = config
        ? { hull: config.hull, sail: config.sail, cockpit: config.cockpit, spinnaker: config.spinnaker }
        : { hull: '#fff', sail: '#fff', cockpit: '#ccc', spinnaker: '#f00' };
    // Panel pattern (SPIN_LOOKS, config.spinPattern override, name-hash fallback);
    // accent colours come from config.spinnaker2/3.
    boat.spinPattern = (config && config.spinPattern) || SPIN_LOOKS[boat.name] || spinPatternForName(boat.name);
    if (config && config.spinnaker2) boat.colors.spinAccent = config.spinnaker2;
    // Optional third kite colour. Absent means the two-colour look, unchanged.
    if (config && config.spinnaker3) boat.colors.spinAccent3 = config.spinnaker3;

    // Stats (copied so the difficulty bonus never mutates AI_CONFIG). Missing keys fall
    // back to 0, so a character authored before a stat existed races exactly as it did.
    //
    // ⚠️ THE PLAYER TAKES NONE OF THEM. You get the boat, not the sailor.
    boat.stats = Object.assign({}, STAT_DEFAULTS, (!isPlayer && config && config.stats) || {});
    if (!isPlayer) {
        for (const k of BONUS_STATS) boat.stats[k] += AI_STAT_BONUS;
    }
}

// ── THE CHARACTER PICKER ────────────────────────────────────────────────────
// Every cell IS THE FLEET DISPLAY — the same portrait + name + species + boat band the
// pre-race panel puts on a rival and on you (`profileBandHTML`). One block in three places,
// so the character you are choosing looks exactly like the character you become. A band is
// wide, so the grid fits two or three per row where the old tiles fit five; the boat, the
// face and the species are all legible at a glance, which the tiles never quite managed.
//
// THE ARCHETYPE LINE IS DROPPED HERE. It labels the AI behaviour driving that character's
// stats, and the player takes NO stats (see applyBoatIdentity) — "line bully" on a card you
// are about to pick promises a way of sailing that picking it cannot deliver.
//
// SORTED ALPHABETICALLY. With 100 characters this is where you come to find a NAME you have
// already met — on the leaderboard, in a profile, in someone's beat line — and A to Z is the
// only order that answers "where is Clutch". (It was sorted by hull hue when the cells were
// colour swatches and the fleet was smaller; a hue wheel is a fine way to browse and a
// useless way to look something up.)
let characterOrder = null;
function charactersAlphabetical() {
    if (!characterOrder) characterOrder = AI_CONFIG.slice().sort((a, b) => a.name.localeCompare(b.name));
    return characterOrder;
}

// Baked once per character and reused. 100 boats is 100 canvases of tinted sprite
// compositing; doing that every time the picker opens is waste, and `renderProfileBoat`
// re-schedules itself every 300ms until the boat sprites load — 100 of those racing each
// other on first open is worse than waste.
const _charBoatCache = new Map();
function characterBoatCanvas(cfg) {
    // ⚠️ NOTHING IS CACHED UNTIL THE SPRITES ARE IN. `renderProfileBoat` draws nothing while
    // they load and retries only for as long as its canvas `isConnected` — which a detached
    // bake canvas never is. Caching that blank would leave the boat blank for the session.
    if (!boatSpritesReady()) return null;
    const hit = _charBoatCache.get(cfg.name);
    if (hit) return hit;
    // Detached on purpose. `renderProfileBoat` sizes itself from its parent, so baking inside
    // the grid would re-bake at a different size after every window resize; with no parent it
    // falls back to the 480px band it was designed for, which is the picker's column minimum.
    const c = document.createElement('canvas');
    renderProfileBoat(c, cfg);
    _charBoatCache.set(cfg.name, c);
    return c;
}

function openCharacterPicker() {
    if (!UI.characterPicker) return;
    const grid = UI.characterPicker.querySelector('#character-grid');
    // Unhide BEFORE filling it: `renderProfileBoat` measures its parent, and a display:none
    // grid measures zero — which would shrink every boat to the 104px floor.
    UI.characterPicker.classList.remove('hidden');
    grid.innerHTML = '';
    for (const cfg of charactersAlphabetical()) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.dataset.char = cfg.name;
        const me = cfg.name === settings.character;
        // The band brings its own border, rounding and gradient, so the cell adds only the
        // ring: amber for the character you are already sailing, white on hover to say the
        // rest are live. A ring rather than a border — a border would resize the band and
        // shift the row.
        cell.className = 'block w-full text-left rounded-xl transition '
            + (me ? 'ring-2 ring-amber-400' : 'hover:ring-2 hover:ring-white/30');
        cell.innerHTML = profileBandHTML(cfg, { archetype: false });
        cell.addEventListener('click', () => pickCharacter(cfg.name));
        grid.appendChild(cell);

        // Painted after the cell is in the document: the baked-canvas path needs no layout,
        // but the fallback below does — both its size and its retry come from being connected.
        const canvas = cell.querySelector('.profile-boat-canvas');
        const baked = characterBoatCanvas(cfg);
        if (baked) {
            canvas.width = baked.width; canvas.height = baked.height;
            canvas.style.width = baked.style.width; canvas.style.height = baked.style.height;
            canvas.getContext('2d').drawImage(baked, 0, 0);
        } else {
            renderProfileBoat(canvas, cfg);   // sprites still loading; it will retry itself
        }
    }
}
function closeCharacterPicker() {
    if (UI.characterPicker) UI.characterPicker.classList.add('hidden');
}
(() => {
    const btn = document.getElementById('character-picker-close');
    if (btn) btn.addEventListener('click', closeCharacterPicker);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && UI.characterPicker && !UI.characterPicker.classList.contains('hidden')) {
            closeCharacterPicker();
        }
    });
})();

function pickCharacter(name) {
    settings.character = name;
    saveSettings();
    applyPlayerCharacter();
    closeCharacterPicker();
    renderCompetitorGrid();
}

// --- Who the player is ------------------------------------------------------
// The player IS one of the fleet's characters. `playerBoatConfig` used to assemble a
// competitor-shaped object out of the appearance settings so the player could go through
// the competitors' renderer; now it just IS a competitor's config, which is the same shape
// arrived at honestly.
//
// ⚠️ STATS ARE NOT PART OF IT — see the Boat constructor. A character's stats are what makes
// the AI sail like them; handing those to the player would turn the picker into a difficulty
// setting and make every eval number depend on which face was chosen.
function playerCharacter() {
    return AI_CONFIG.find(c => c.name === settings.character) || AI_CONFIG[0];
}
function playerBoatConfig() { return playerCharacter(); }

// The character can change from the picker, so everything that says who you are re-reads
// it: the header chip, your face in the fleet, and the panel if it happens to be open.
// Visuals only.
function refreshPlayerAppearance() {
    if (UI.prCompetitorsGrid && UI.prCompetitorsGrid.children.length) renderCompetitorGrid();
}

// Player names are free text and land in innerHTML in two places here.
function escapeHTMLText(s) {
    return String(s).replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function selectVenue(key) {
    if (!VENUES[key] || state.race.status !== 'waiting') return;
    settings.venue = key;
    saveSettings();

    // Bay has no ranges of its own (resetGame's randomization IS the Bay), so
    // returning to it from another venue re-rolls the default conditions here.
    if (key === 'bay' || key === 'seatrials') {
        state.wind.baseSpeed = 8 + Math.random() * 10;
        state.wind.speed = state.wind.baseSpeed;
        const c = state.race.conditions;
        c.islandCount = 0;
    }

    applyVenueConditions();
    initCourse();
    if (window.WaterRenderer) window.WaterRenderer.init();
    // Clear stale gusts and reseed at the new venue's density/strength
    state.gusts = [];
    // Pre-populate the sources' cells, so a race opens with its puffs already on the water
    // rather than fading in over the first minute. No sources means none to populate.
    const gregs = state.course.gustRegions;
    if (gregs && gregs.length) {
        let want = 0;
        for (const r of gregs) want += r.count;
        for (let i = 0; i < want; i++) spawnRegionGust(gregs, true);
    }
    state.particles = [];

    // The fleet was laid out behind the PREVIOUS venue's start line. initCourse() has
    // just moved the marks and the wind out from under it, and startRace() only flips
    // the status — it never re-places anyone — so without this the race begins with
    // every boat stranded wherever the old course put them. Only ever visible when the
    // two venues disagree about the course axis, which is why it read as intermittent.
    // Consumes no RNG, so the golden traces are untouched.
    repositionBoats();

    setupPreRaceOverlay();
}

function setupPreRaceOverlay() {
    renderVenuePicker();
    if (!UI.preRaceOverlay) return;

    // Show Overlay
    UI.preRaceOverlay.classList.remove('hidden');
    UI.preRaceOverlay.querySelectorAll('.overflow-y-auto').forEach(el => el.scrollTop = 0);
    UI.leaderboard.classList.add('hidden');
    UI.legInfo.parentElement.classList.add('hidden'); // Hide venue caption
    if (UI.legTimes) UI.legTimes.classList.add('hidden'); // now a sibling, hide it too

    // Initialize Sliders from Current State (Randomized or Default)
    const cond = state.race.conditions;


    // Reverse Map Wind Strength
    const baseMin = 5, baseMax = 25;
    const strVal = Math.max(0, Math.min(1, (state.wind.baseSpeed - baseMin) / (baseMax - baseMin)));



    // Course Defaults
    // 4000 units / 5 = 800m
    // The player's preference, NOT state.race.totalLegs. Writing the current course's
    // leg count into the slider laundered Glacier Sound's 2 legs through the UI, and the
    // next resetGame read it straight back — so every later venue raced 2 laps.


    // Bind Listeners (if not already bound - simple check or rebind is fine since overlay is destroyed? No, persistent.)
    // Better to remove old listeners? Or just use oninput which overwrites?
    // addEventListener adds multiple if called multiple times.
    // Let's rely on checking a flag or just do it once globally?
    // setupPreRaceOverlay is called on resetGame. resetGame is called multiple times.
    // We should bind listeners globally at the bottom of the script, not here.
    // BUT we need to set values here.


    // Populate Competitors. New race, new fleet: clear any scouting selection.
    selectedCompetitor = null;
    renderCompetitorDetail();
    renderCompetitorGrid();
}

// Builds the fleet grid from state.boats — the LIVE fleet, not the roster. Extracted
// from setupPreRaceOverlay so that changing character can refresh it without re-running
// the whole overlay (which would also rebuild the venue picker and reset the scroll).
//
// ⚠️ `pickCharacter` has always called this by name behind a `typeof ... === 'function'`
// guard, and the function did not exist — so the guard silently did nothing and the grid
// kept showing the character you had just taken over, still racing against you. The swap
// underneath was working the whole time. A typeof guard around a name you own is not a
// safety net, it is a silent failure.
function renderCompetitorGrid() {
    if (!UI.prCompetitorsGrid) return;
    const scrollTop = UI.prCompetitorsGrid.scrollTop;   // survive a re-render on selection
    UI.prCompetitorsGrid.innerHTML = '';
    const count = document.getElementById('pr-fleet-count');
    if (count) count.textContent = `${state.boats.length} boats`;

    // ONE BADGE PER BOAT, listed — the same identity band the picker and the results screen
    // use, boat preview and all, so a rival looks the same everywhere you meet them. Ten do
    // not fit the column and are not meant to: this panel scrolls.
    for (const boat of state.boats) {
        const config = AI_CONFIG.find(c => c.name === boat.name) || boat;
        const key = boat.isPlayer ? PLAYER_CARD_KEY : boat.name;
        const selected = selectedCompetitor === key;

        const item = document.createElement('div');
        // ⚠️ The player's item keeps the PLAYER_CARD_KEY name and a `.t-display` label —
        // test_character_swap reads both to prove a character swap reached the screen.
        item.dataset.name = key;
        item.className = 'pr-fleet-item' + (boat.isPlayer ? ' me' : '') + (selected ? ' sel' : '');

        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'block w-full text-left';
        badge.innerHTML = profileBandHTML(config, {
            compact: true, boat: true,
            // Your badge says YOU where a rival's says what kind of sailor they are, and it
            // carries the control that swaps you for someone else.
            label: boat.isPlayer ? 'You <span class="pr-change-pill">Change</span>' : undefined
        });
        // YOUR badge is the way to change character — there is no header chip any more, and
        // your own badge has no scouting notes to open, so its click is free to mean the
        // one thing you would want from it.
        badge.addEventListener('click', () => boat.isPlayer ? openCharacterPicker() : selectCompetitor(key));
        item.appendChild(badge);

        // YOUR badge does not open scouting notes. There is nothing to scout — you take no
        // stats from the character, and "how to beat them" would be about you.
        if (selected && !boat.isPlayer) {
            const notes = document.createElement('div');
            notes.className = 'pr-fleet-notes';
            notes.innerHTML = scoutingNotesHTML(config);
            item.appendChild(notes);
        }
        UI.prCompetitorsGrid.appendChild(item);

        // The rig preview, painted once the canvas is in the document (it sizes itself from
        // the band it sits in).
        renderProfileBoat(item.querySelector('.profile-boat-canvas'), config);
    }
    UI.prCompetitorsGrid.scrollTop = scrollTop;
}

function startRace() {
    if (state.race.status !== 'waiting') return;


    if (UI.preRaceOverlay) UI.preRaceOverlay.classList.add('hidden');
    UI.leaderboard.classList.remove('hidden'); // Or hidden if prestart logic handles it
    // Prestart logic usually hides leaderboard until start? No, updateLeaderboard logic: if 'prestart' UI.leaderboard.classList.add('hidden');

    // Show venue caption (leg splits stay hidden until the prestart ends — the
    // render loop unhides them once status leaves 'prestart')
    if (UI.legInfo) UI.legInfo.parentElement.classList.remove('hidden');

    state.race.status = 'prestart';
    state.race.timer = state.race.startTimerDuration;

    // Init Audio Context if needed (user interaction trusted here)
    if ((settings.soundEnabled || settings.musicEnabled) && (!Sound.ctx || Sound.ctx.state !== 'running')) Sound.init();
    Sound.updateMusic();
}

// Settings Functions
function loadSettings() {
    // getItem can throw for the same reasons setItem can; a player with site data disabled
    // should get defaults, not a dead page.
    let stored = null;
    try { stored = localStorage.getItem('regatta_settings'); } catch (e) { stored = null; }
    let parsed = null;
    if (stored) {
        try {
            parsed = JSON.parse(stored);
            settings = { ...DEFAULT_SETTINGS, ...parsed };
        } catch (e) { console.error("Failed to parse settings", e); }
    }
    // Migration: the Polar venue was renamed to Arctic (July 2026)
    if (settings.venue === 'polar') settings.venue = 'arctic';
    // Migration: the Semicircle kite panel became Triangle (July 2026) — without
    // this a saved 'bullseye' falls through to a plain solid sail
    // Migration: the Manual Trim toggle became Auto Trim (July 2026), flipping the
    // stored polarity. Test the raw save, not the merged settings — the merge always
    // supplies an autoTrim default, so only `parsed` can tell us which era it is from.
    if (parsed && parsed.autoTrim === undefined && parsed.manualTrim !== undefined) {
        settings.autoTrim = !parsed.manualTrim;
    }
    delete settings.manualTrim;
    applySettings();
}

// ⚠️ APPLYING AND STORING ARE SEPARATE JOBS, AND THE WRITE MUST NOT BE ABLE TO KILL THE
// APPLY. localStorage.setItem throws for real reasons a player can hit — Safari private
// browsing, a full quota, a file:// origin with site data disabled — and this used to let
// that exception escape into every caller. `pickCharacter` would then leave the picker
// open with the character half-applied, and `applySettings()` (which is what actually puts
// the choice on the boat) would never run at all. Losing persistence is a nuisance; losing
// the apply is a broken screen.
function saveSettings() {
    try {
        localStorage.setItem('regatta_settings', JSON.stringify(settings));
    } catch (e) {
        // Warn once — this fires on every toggle, and a storage-disabled browser would
        // otherwise flood the console.
        if (!saveSettings._warned) {
            saveSettings._warned = true;
            console.warn('Settings could not be saved; they will not survive a reload.', e);
        }
    }
    applySettings();
}

// You changed character while a fleet already existed, and one of them is now you. Swap
// that opponent for someone not on the water — identity only, so it inherits the lane,
// the position and the start setup the outgoing boat had.
//
// ⚠️ THE REPLACEMENT IS CHOSEN DETERMINISTICALLY (first unused, in roster order) rather than
// at random. A `Math.random()` here would add a draw to the seeded stream and move every
// venue's races, for a UI action that has nothing to do with the simulation.
function swapClashingOpponent() {
    if (!state.boats || !state.boats.length) return false;
    const mine = settings.character;
    const clash = state.boats.find(b => !b.isPlayer && b.name === mine);
    if (!clash) return false;
    const taken = new Set(state.boats.map(b => b.name));
    const repl = AI_CONFIG.find(c => !taken.has(c.name));
    if (!repl) return false;
    applyBoatIdentity(clash, repl, false);
    return true;
}

// Point the player's boat at whoever they are now, without rebuilding the race.
function applyPlayerCharacter() {
    const pc = playerCharacter();
    if (state.boats && state.boats.length) {
        applyBoatIdentity(state.boats[0], pc, true);
        swapClashingOpponent();
    }
    refreshPlayerAppearance();
}

function applySettings() {
    state.showNavAids = settings.navAids;
    if (state.boats.length > 0) {
        state.boats[0].manualTrim = !settings.autoTrim;
        applyBoatIdentity(state.boats[0], playerCharacter(), true);
        swapClashingOpponent();
    }
    state.camera.mode = settings.cameraMode;

    if (UI.settingSound) UI.settingSound.checked = settings.soundEnabled;
    if (UI.settingBgSound) UI.settingBgSound.checked = settings.bgSoundEnabled;
    if (UI.settingMusic) UI.settingMusic.checked = settings.musicEnabled;
    if (UI.settingPenalties) UI.settingPenalties.checked = settings.penaltiesEnabled;
    if (UI.settingNavAids) UI.settingNavAids.checked = settings.navAids;
    if (UI.settingTrim) UI.settingTrim.checked = settings.autoTrim;
    if (UI.settingCameraMode) UI.settingCameraMode.value = settings.cameraMode;
    if (UI.settingTelltaleColor) UI.settingTelltaleColor.value = settings.telltaleColor || '#fbbf24';
    // Boat colors have two editors now (this modal and the pre-race player
    // panel); both write here, so this is where they re-sync.
    refreshPlayerAppearance();
}

function togglePause(show) {
    const isPaused = state.paused;
    const shouldPause = show !== undefined ? show : !isPaused;
    if (shouldPause) {
        state.paused = true;
        if (UI.pauseScreen) UI.pauseScreen.classList.remove('hidden');
        if (UI.helpScreen) UI.helpScreen.classList.add('hidden');
        if (UI.settingsScreen) UI.settingsScreen.classList.add('hidden');
    } else {
        state.paused = false;
        if (UI.pauseScreen) UI.pauseScreen.classList.add('hidden');
        lastTime = 0;
    }
}

function toggleHelp(show) {
    if (!UI.helpScreen) return;
    const isVisible = !UI.helpScreen.classList.contains('hidden');
    const shouldShow = show !== undefined ? show : !isVisible;
    if (shouldShow) {
        state.paused = true;
        UI.helpScreen.classList.remove('hidden');
        if (UI.pauseScreen) UI.pauseScreen.classList.add('hidden');
        if (UI.settingsScreen) UI.settingsScreen.classList.add('hidden');
    } else {
        UI.helpScreen.classList.add('hidden');
        state.paused = false;
        lastTime = 0;
    }
}

function toggleSettings(show) {
    if (!UI.settingsScreen) return;
    const isVisible = !UI.settingsScreen.classList.contains('hidden');
    const shouldShow = show !== undefined ? show : !isVisible;
    if (shouldShow) {
        state.paused = true;
        UI.settingsScreen.classList.remove('hidden');
        if (UI.pauseScreen) UI.pauseScreen.classList.add('hidden');
        if (UI.helpScreen) UI.helpScreen.classList.add('hidden');
    } else {
        UI.settingsScreen.classList.add('hidden');
        state.paused = false;
        lastTime = 0;
    }
}

// Event Listeners
if (UI.helpButton) UI.helpButton.addEventListener('click', (e) => { e.preventDefault(); toggleHelp(true); UI.helpButton.blur(); });
if (UI.closeHelp) UI.closeHelp.addEventListener('click', () => toggleHelp(false));
if (UI.resumeHelp) UI.resumeHelp.addEventListener('click', () => toggleHelp(false));
if (UI.resumeButton) UI.resumeButton.addEventListener('click', (e) => { e.preventDefault(); togglePause(false); });
if (UI.restartButton) UI.restartButton.addEventListener('click', (e) => { e.preventDefault(); restartRace(); });
if (UI.settingsButton) UI.settingsButton.addEventListener('click', (e) => { e.preventDefault(); toggleSettings(true); UI.settingsButton.blur(); });
if (UI.closeSettings) UI.closeSettings.addEventListener('click', () => toggleSettings(false));
if (UI.saveSettings) UI.saveSettings.addEventListener('click', () => toggleSettings(false));
// Two ways off the results page, where a series would have offered "next race": back to
// the clubhouse to change venue or character, or straight into another race here.
if (UI.resultsRestartButton) UI.resultsRestartButton.addEventListener('click', (e) => { e.preventDefault(); restartRace(); });
if (UI.resultsRematchButton) UI.resultsRematchButton.addEventListener('click', (e) => { e.preventDefault(); rematchRace(); });
if (UI.startRaceBtn) UI.startRaceBtn.addEventListener('click', (e) => { e.preventDefault(); startRace(); });

if (UI.settingSound) UI.settingSound.addEventListener('change', (e) => { settings.soundEnabled = e.target.checked; saveSettings(); if (settings.soundEnabled) Sound.init(); Sound.updateWindSound(Sound.playerWindSpeed()); });
if (UI.settingBgSound) UI.settingBgSound.addEventListener('change', (e) => { settings.bgSoundEnabled = e.target.checked; saveSettings(); Sound.updateWindSound(Sound.playerWindSpeed()); });
if (UI.settingMusic) UI.settingMusic.addEventListener('change', (e) => { settings.musicEnabled = e.target.checked; saveSettings(); Sound.init(); });
if (UI.settingPenalties) UI.settingPenalties.addEventListener('change', (e) => { settings.penaltiesEnabled = e.target.checked; saveSettings(); });
if (UI.settingNavAids) UI.settingNavAids.addEventListener('change', (e) => { settings.navAids = e.target.checked; saveSettings(); });
if (UI.settingTrim) UI.settingTrim.addEventListener('change', (e) => { settings.autoTrim = e.target.checked; saveSettings(); });
if (UI.settingCameraMode) UI.settingCameraMode.addEventListener('change', (e) => { settings.cameraMode = e.target.value; saveSettings(); });
if (UI.settingTelltaleColor) UI.settingTelltaleColor.addEventListener('input', (e) => { settings.telltaleColor = e.target.value; saveSettings(); });

// Pre-race config listeners: the venue customization panel is gone. A course's wind,
// current, obstacles and leg count are stated by its DOCUMENT, so there is nothing on this
// screen left to tune them with.




let minimapCtx = null;
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
// The race-day hero is sized from its column's width, so it has to be re-sized with it.
window.addEventListener('resize', sizeRaceDayHero);
resize();

window.addEventListener('click', () => {
    if ((settings.soundEnabled || settings.musicEnabled) && (!Sound.ctx || Sound.ctx.state !== 'running')) Sound.init();
});

window.addEventListener('keydown', (e) => {
    if (state.race.status === 'waiting') return;

    if ((settings.soundEnabled || settings.musicEnabled) && (!Sound.ctx || Sound.ctx.state !== 'running')) Sound.init();

    let key = e.key;
    if (key === 'a' || key === 'A') key = 'ArrowLeft';
    if (key === 'd' || key === 'D') key = 'ArrowRight';
    if (key === 'w' || key === 'W') key = 'ArrowUp';
    if (key === 's' || key === 'S') key = 'ArrowDown';

    if (state.keys.hasOwnProperty(key)) state.keys[key] = true;

    // View & System
    if (e.key.toLowerCase() === 'c') {
        const modes = ['heading', 'north', 'wind', 'gate'];
        state.camera.mode = modes[(modes.indexOf(state.camera.mode) + 1) % modes.length];
        settings.cameraMode = state.camera.mode;
        state.camera.message = state.camera.mode.toUpperCase();
        state.camera.messageTimer = 1.5;
        saveSettings();
        showToast(`Camera: ${state.camera.mode.toUpperCase()}`);
    }
    if (e.key.toLowerCase() === 'n') {
        state.showNavAids = !state.showNavAids;
        settings.navAids = state.showNavAids;
        saveSettings();
        if (UI.settingNavAids) UI.settingNavAids.checked = state.showNavAids;
        showToast(`Nav Aids: ${state.showNavAids ? "ON" : "OFF"}`);
    }
    if (e.key.toLowerCase() === 'p') {
        settings.penaltiesEnabled = !settings.penaltiesEnabled;
        saveSettings();
        if (UI.settingPenalties) UI.settingPenalties.checked = settings.penaltiesEnabled;
        showToast(`Sailing Rules: ${settings.penaltiesEnabled ? "ON" : "OFF"}`);
    }

    if (e.key === 'F12') {
        e.preventDefault();
        if (window.html2canvas) {
            showToast("Capturing Screenshot...");
            setTimeout(() => {
                window.html2canvas(document.body).then(c => {
                    const link = document.createElement('a');
                    link.download = 'regatta-screenshot.png';
                    link.href = c.toDataURL();
                    link.click();
                    showToast("Screenshot Saved");
                });
            }, 100);
        }
    }

    if (e.key === 'F2') { e.preventDefault(); toggleSettings(); }
    if (e.key === '?' || (e.shiftKey && e.key === '/')) toggleHelp();
    if (e.key === 'Escape') {
        if (UI.helpScreen && !UI.helpScreen.classList.contains('hidden')) toggleHelp(false);
        else if (UI.settingsScreen && !UI.settingsScreen.classList.contains('hidden')) toggleSettings(false);
        else togglePause();
    }

    // Audio
    if (e.key.toLowerCase() === 'm') {
        if (e.shiftKey) {
            settings.musicEnabled = !settings.musicEnabled;
            saveSettings();
            if (UI.settingMusic) UI.settingMusic.checked = settings.musicEnabled;
            if (settings.musicEnabled) Sound.init();
            else Sound.stopMusic();
            Sound.updateMusic();
            showToast(`Music: ${settings.musicEnabled ? "ON" : "OFF"}`);
        } else {
            settings.soundEnabled = !settings.soundEnabled;
            saveSettings();
            if (UI.settingSound) UI.settingSound.checked = settings.soundEnabled;
            if (settings.soundEnabled) Sound.init();
            Sound.updateWindSound(Sound.playerWindSpeed());
            showToast(`Sound: ${settings.soundEnabled ? "ON" : "OFF"}`);
        }
    }
    if (e.key === 'F7') { e.preventDefault(); toggleWaterDebug(); }
    // Sailing
    if (e.key === ' ' || e.code === 'Space') {
        if (state.boats.length > 0) state.boats[0].spinnaker = !state.boats[0].spinnaker;
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        if (state.boats.length > 0) {
            settings.autoTrim = !settings.autoTrim;
            saveSettings(); // re-derives boat.manualTrim from settings.autoTrim
            if (UI.settingTrim) UI.settingTrim.checked = settings.autoTrim;
            if (state.boats[0].manualTrim) state.boats[0].manualSailAngle = Math.abs(state.boats[0].sailAngle);
            // The chips are gone from the HUD, so this toast is the only signal that
            // ↑/↓ just changed meaning — keep it.
            showToast(`Trim: ${state.boats[0].manualTrim ? "MANUAL" : "AUTO"}`);
        }
    }

    // Dev
    if (e.key === 'F8') {
        e.preventDefault();
        settings.debugMode = !settings.debugMode;
        showToast(`Debug: ${settings.debugMode ? "ON" : "OFF"}`);
    }
    if (e.key === '[') {
        const steps = [0.1, 0.25, 0.5, 1.0, 2.0, 4.0, 10.0];
        let current = state.gameSpeed || 1.0;
        let next = 0.1;
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i] < current - 0.01) { next = steps[i]; break; }
        }
        state.gameSpeed = next;
        showToast(`Speed: ${state.gameSpeed}x`);
    }
    if (e.key === ']') {
        const steps = [0.1, 0.25, 0.5, 1.0, 2.0, 4.0, 10.0];
        let current = state.gameSpeed || 1.0;
        let next = 10.0;
        for (let i = 0; i < steps.length; i++) {
            if (steps[i] > current + 0.01) { next = steps[i]; break; }
        }
        state.gameSpeed = next;
        showToast(`Speed: ${state.gameSpeed}x`);
    }
});

window.addEventListener('keyup', (e) => {
    let key = e.key;
    if (key === 'a' || key === 'A') key = 'ArrowLeft';
    if (key === 'd' || key === 'D') key = 'ArrowRight';
    if (key === 'w' || key === 'W') key = 'ArrowUp';
    if (key === 's' || key === 'S') key = 'ArrowDown';
    if (state.keys.hasOwnProperty(key)) state.keys[key] = false;
});

window.addEventListener('focus', () => { for (const k in state.keys) state.keys[k] = false; });

// Race Logic & Update Functions

function formatTime(s) {
    const m = Math.floor(Math.abs(s) / 60);
    const sec = Math.floor(Math.abs(s) % 60);
    return `${s < 0 ? "-" : ""}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// ⚠️ ROUNDED TO THE MILLISECOND, AND DERIVED FROM IT. Truncating `(s % 1) * 1000` printed a
// 271.743s record as 4:31.742, because 271.743 is really 271.74299999… in binary — the
// display was showing float noise as a lost thousandth. Taking whole milliseconds first and
// splitting minutes and seconds back out of them also makes the carry at .9996 free.
function formatSplitTime(s) {
    const total = Math.round(Math.abs(s) * 1000);
    const m = Math.floor(total / 60000);
    const sec = Math.floor((total % 60000) / 1000);
    return `${m}:${sec.toString().padStart(2, '0')}.${(total % 1000).toString().padStart(3, '0')}`;
}

// A RECORD IS A STOPWATCH READING, not a clock time. `formatTime` rounds to the second,
// which is fine for a finish order and useless for the one number you are trying to beat:
// two runs a third of a second apart both printed 04:03. Thousandths, minutes unpadded —
// 4:31.743 — the same face the mid-race split banner already uses.
const formatBestTime = formatSplitTime;

function getClosestPointOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return { x: ax + dx * t, y: ay + dy * t };
}

function checkLineIntersection(Ax, Ay, Bx, By, Cx, Cy, Dx, Dy) {
    const rX = Bx - Ax, rY = By - Ay, sX = Dx - Cx, sY = Dy - Cy;
    const rxs = rX * sY - rY * sX, qpx = Cx - Ax, qpy = Cy - Ay;
    if (Math.abs(rxs) < 1e-5) return null;
    const t = (qpx * sY - qpy * sX) / rxs, u = (qpx * rY - qpy * rX) / rxs;
    return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? { t, u } : null;
}

function rayCircleIntersection(ox, oy, dx, dy, cx, cy, r) {
    const lx = ox - cx, ly = oy - cy;
    const b = 2 * (lx * dx + ly * dy), c = (lx * lx + ly * ly) - (r * r);
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const t1 = (-b - Math.sqrt(disc)) / 2, t2 = (-b + Math.sqrt(disc)) / 2;
    return (t1 >= 0) ? t1 : (t2 >= 0 ? t2 : null);
}

function showRaceMessage(text, textColorClass, borderColorClass) {
    if (UI.message) {
        UI.message.textContent = text;
        UI.message.className = `mt-2 text-lg font-bold bg-slate-900/80 px-4 py-1 rounded-full border shadow-lg ${textColorClass} ${borderColorClass}`;
        UI.message.classList.remove('hidden');
    }
}

function hideRaceMessage() { if (UI.message) UI.message.classList.add('hidden'); }

function showToast(text) {
    if (UI.toast && UI.toastMsg) {
        UI.toastMsg.textContent = text;
        UI.toast.classList.remove('opacity-0', 'translate-y-4');

        if (UI.toast.hideTimeout) clearTimeout(UI.toast.hideTimeout);
        UI.toast.hideTimeout = setTimeout(() => {
            UI.toast.classList.add('opacity-0', 'translate-y-4');
        }, 1500);
    }
}

function getTargetSpeed(twaRadians, useSpinnaker, windSpeed) {
    const twaDeg = Math.abs(twaRadians) * (180 / Math.PI);
    const angles = J111_POLARS.angles;
    const speeds = [6, 8, 10, 12, 14, 16, 20, 25, 30];

    const getPolarSpeed = (ws) => {
        const data = J111_POLARS.speeds[ws];
        const sData = useSpinnaker ? data.spinnaker : data.nonSpinnaker;
        for (let i = 0; i < angles.length - 1; i++) {
            if (twaDeg >= angles[i] && twaDeg <= angles[i+1]) {
                const t = (twaDeg - angles[i]) / (angles[i+1] - angles[i]);
                return sData[i] + t * (sData[i+1] - sData[i]);
            }
        }
        return sData[sData.length - 1];
    };

    if (windSpeed <= 0) return 0;
    if (windSpeed < 6) {
         // Linearly interpolate from 0 to Speed@6
         return getPolarSpeed(6) * (windSpeed / 6.0);
    }

    let lower = 6, upper = 30;
    // Flatlines at 30 now, not 20. Above 30 there is genuinely nothing left to say — no
    // venue authors a mean above 29 kt, and a boat that far past its limit is being handled
    // by the heel/overpowered model, not by the polar.
    if (windSpeed >= 30) { lower = 30; upper = 30; }
    else {
        for (let i = 0; i < speeds.length - 1; i++) {
            if (windSpeed >= speeds[i] && windSpeed <= speeds[i+1]) { lower = speeds[i]; upper = speeds[i+1]; break; }
        }
    }

    const s1 = getPolarSpeed(lower), s2 = getPolarSpeed(upper);
    return lower === upper ? s1 : s1 + (windSpeed - lower) / (upper - lower) * (s2 - s1);
}

function checkBoundaryExiting(boat) {
    if (!state.course.boundary) return false;
    const b = state.course.boundary;
    // Within 200u of the edge and heading further out — whatever shape the edge is.
    if (Arena.signedDist(b, boat.x, boat.y) < 200) {
        const hx = Math.sin(boat.heading), hy = -Math.cos(boat.heading);
        const n = Arena.outward(b, boat.x, boat.y);
        if (hx * n.x + hy * n.y > 0) return true;
    }
    return false;
}

function getClearAstern(behind, ahead) {
    if (window.Rules) return window.Rules.isClearAstern(behind, ahead);
    return false;
}

function getRightOfWay(b1, b2) {
    if (window.Rules) return window.Rules.getRightOfWay(b1, b2);
    return { boat: null, rule: "Error", reason: "No Rules Engine" };
}

function getOptimalVMGAngle(mode, windSpeed) {
    const angles = J111_POLARS.angles;
    const speeds = [6, 8, 10, 12, 14, 16, 20];

    // Find bracketing wind speeds for interpolation
    let ws = Math.max(6, Math.min(20, windSpeed));
    let lower = 6, upper = 6;
    for (let i = 0; i < speeds.length - 1; i++) {
        if (ws >= speeds[i] && ws <= speeds[i + 1]) {
            lower = speeds[i]; upper = speeds[i + 1]; break;
        }
    }
    if (ws >= 20) { lower = 20; upper = 20; }

    const getSpeed = (wsKey, angleIdx) => {
        const data = J111_POLARS.speeds[wsKey];
        return mode === 'downwind' ? data.spinnaker[angleIdx] : data.nonSpinnaker[angleIdx];
    };

    let bestVMG = -Infinity;
    let bestAngle = mode === 'upwind' ? 45 : 150;

    for (let i = 0; i < angles.length; i++) {
        const a = angles[i];
        if (mode === 'upwind' && (a < 30 || a > 70)) continue;
        if (mode === 'downwind' && (a < 110 || a > 180)) continue;

        // Interpolate boat speed at this angle for current wind
        const s1 = getSpeed(lower, i);
        const s2 = getSpeed(upper, i);
        const boatSpeed = lower === upper ? s1 : s1 + (ws - lower) / (upper - lower) * (s2 - s1);

        const aRad = a * Math.PI / 180;
        const vmg = mode === 'upwind'
            ? boatSpeed * Math.cos(aRad)
            : boatSpeed * Math.cos(Math.PI - aRad);

        if (vmg > bestVMG) {
            bestVMG = vmg;
            bestAngle = a;
        }
    }

    return bestAngle * (Math.PI / 180);
}

function getBestVMGAngle(mode, windSpeed) {
    return getOptimalVMGAngle(mode, windSpeed);
}

function getCharacterOptimalVMGAngle(mode, windSpeed, stats) {
    const angles = J111_POLARS.angles;
    const speeds = [6, 8, 10, 12, 14, 16, 20, 25, 30];

    // Apply pressure stat to effective wind (same formula as physics line 3582)
    const pressureFactor = stats.pressure * 0.05;
    let ws = windSpeed;
    const baseWind = state.wind.baseSpeed;
    if (ws > baseWind) {
        ws = baseWind + (ws - baseWind) * (1.0 + pressureFactor);
    } else {
        ws = baseWind + (ws - baseWind) * (1.0 - pressureFactor);
    }
    // The physics polar was extended to 25 and 30 kt (overpowered phases 0-2);
    // clamping the OPTIMIZER at 20 left the AI choosing angles for a wind it was
    // not in, and blind to the heel tax it was about to pay.
    ws = Math.max(6, Math.min(30, ws));

    let lower = 6, upper = 6;
    for (let i = 0; i < speeds.length - 1; i++) {
        if (ws >= speeds[i] && ws <= speeds[i + 1]) {
            lower = speeds[i]; upper = speeds[i + 1]; break;
        }
    }
    if (ws >= 30) { lower = 30; upper = 30; }

    const getSpeed = (wsKey, angleIdx) => {
        const data = J111_POLARS.speeds[wsKey];
        return mode === 'downwind' ? data.spinnaker[angleIdx] : data.nonSpinnaker[angleIdx];
    };

    let bestVMG = -Infinity;
    let bestAngle = mode === 'upwind' ? 45 : 150;

    for (let i = 0; i < angles.length; i++) {
        const a = angles[i];
        if (mode === 'upwind' && (a < 30 || a > 70)) continue;
        if (mode === 'downwind' && (a < 110 || a > 180)) continue;

        const s1 = getSpeed(lower, i);
        const s2 = getSpeed(upper, i);
        let boatSpeed = lower === upper ? s1 : s1 + (ws - lower) / (upper - lower) * (s2 - s1);

        // Apply point-of-sail stat modifiers (same as physics lines 3687-3709)
        let posStat = 0;
        if (a <= 60) {
            posStat = stats.upwind * 0.012;
        } else if (a >= 145) {
            posStat = stats.downwind * 0.015;
        } else if (a < 102.5) {
            const t = (a - 60) / (102.5 - 60);
            posStat = stats.upwind * 0.012 + t * (stats.reach * 0.018 - stats.upwind * 0.012);
        } else {
            const t = (a - 102.5) / (145 - 102.5);
            posStat = stats.reach * 0.018 + t * (stats.downwind * 0.015 - stats.reach * 0.018);
        }
        boatSpeed *= (1.0 + posStat);

        const aRad = a * Math.PI / 180;
        // Price the heel tax INTO the angle choice. The physics charges
        // overpoweredFactor on the wind the boat is in; an optimizer that ignores
        // it recommends polar-pretty angles that sail pressed and slow. Steady-
        // state apparent wind from the candidate speed is enough of an estimate.
        if (ws > OVERPOWERED.threshold - 2) {
            const ax = ws * Math.cos(aRad) + boatSpeed;
            const ay = ws * Math.sin(aRad);
            const aws = Math.hypot(ax, ay);
            const awa = Math.atan2(ay, ax);
            boatSpeed *= overpoweredFactor(stats, heelPressure(aws, awa));
        }
        const vmg = mode === 'upwind'
            ? boatSpeed * Math.cos(aRad)
            : boatSpeed * Math.cos(Math.PI - aRad);

        if (vmg > bestVMG) {
            bestVMG = vmg;
            bestAngle = a;
        }
    }

    return bestAngle * (Math.PI / 180);
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

// Rudder authority grows with boat speed: a keelboat steers crisply at speed but
// mushily when slow, and barely at all "in irons" (head-to-wind with no way). This
// makes in-irons and the cost of a slow/bad tack emerge naturally instead of being
// special-cased. Kept forgiving with a generous floor so boats never fully lock up.
function steerageFactor(boat) {
    const spdKnots = boat.speed / 0.25; // game speed -> knots
    // 0kt -> 0.6x, ramps to full authority by ~3.5kt, capped at 1.0 (no super-turning).
    // Floor kept fairly high (0.6) so a boat that slows in close quarters can still
    // turn away — a lower floor traps slow boats in the pack and spikes collisions.
    return Math.min(1.0, Math.max(0.6, 0.6 + 0.4 * (spdKnots / 3.5)));
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
    if (boat.controller && boat.controller.wiggleActive) {
        aiTurnRate = getTurnSpeed() * timeScale * (1.0 + boat.stats.handling * 0.03) * 5.0; // Snap turn
    }

    // If very far off, turn faster?
    const turnAmt = Math.sign(diff) * Math.min(Math.abs(diff), aiTurnRate);
    boat.heading += turnAmt;
    boat.heading = normalizeAngle(boat.heading);

    // Speed / Luff
    if (speedLimit < 0.9) {
        boat.ai.forcedLuff = 1.0 - speedLimit;
    } else {
        boat.ai.forcedLuff = 0;
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

function triggerPenalty(boat, info) {
    if (boat.raceState.finished) return;
    if (window.onRaceEvent && state.race.status === 'racing') window.onRaceEvent('penalty', { boat, kind: info && info.kind, rule: info && info.rule });
    if (!settings.penaltiesEnabled) return;

    // One-Turn Penalty (RRS 44 style): the foul flags the boat and owes a
    // 360° turn. No speed is taken away — the cost is the turn itself, taken
    // when the sailor chooses (Rule 21 keep-clear applies while flagged, and
    // an un-taken turn costs +15s at the finish). Sustained/grinding contact
    // re-triggers every frame, so counting is per flagged EPISODE (same
    // debounce semantics as the old 10s-timer design): while flagged, further
    // fouls neither add turns nor inflate totalPenalties.
    const rs = boat.raceState;
    if (!rs.penalty) {
        rs.penalty = true;
        rs.totalPenalties++;
        rs.penaltyTurnsOwed = 1;
        rs.penaltyFlagTime = 0;
        rs.penaltyRot = 0;
        rs.penaltyLastHeading = boat.heading;
        if (boat.isPlayer) {
            Sound.playPenalty();
            const why = info && info.rule ? ` (${info.rule}${info.reason ? ' — ' + info.reason : ''})` : '';
            showRaceMessage(`PENALTY${why}! DO A 360° TURN TO CLEAR`, "text-red-500", "border-red-500/50");
        }
    }
}

// Update Boat Physics & Race Status
function updateBoat(boat, dt) {
    if (state.race.status === 'waiting') return;

    const timeScale = dt * 60;

    // A FINISHED BOAT LEAVES, starting the moment it crosses. It has nothing left to do on
    // the course, and a fleet of parked hulls sitting on the line hides the boats still
    // racing through it — which is exactly where the last of the fleet needs watching.
    //
    // It always faded; it just sat there at full opacity for eight seconds first
    // (`fadeTimer` began at 10 and the fade only started below 2). Now the timer IS the
    // fade. Everything downstream already keys off `opacity` or `fadeTimer <= 0` — the
    // hull, its indicator, its edge marker, the minimap pip and collision — so they all
    // follow without being told.
    if (boat.raceState.finished) {
        boat.fadeTimer -= dt;
        boat.opacity = Math.max(0, boat.fadeTimer / FINISH_FADE_SECS);
    }

    // AI Logic or Player Input
    if (!boat.isPlayer || boat.raceState.finished) {
        updateAI(boat, dt);
    }

    if (boat.isPlayer && !boat.raceState.finished) {
        // Player Input
        // Apply Handling Stat (Player)
        const handlingMod = (1.0 + boat.stats.handling * 0.03);
        const turnRate = (state.keys.Shift ? getTurnSpeed() * 0.25 : getTurnSpeed()) * timeScale * handlingMod * steerageFactor(boat);
        if (state.keys.ArrowLeft) boat.heading -= turnRate;
        if (state.keys.ArrowRight) boat.heading += turnRate;
    }

    boat.heading = normalizeAngle(boat.heading);

    // Physics
    const localWind = getWindAt(boat.x, boat.y);
    const angleToWind = Math.abs(normalizeAngle(boat.heading - localWind.direction));

    // Log the breeze the PLAYER sailed through, for the results header. Player only and
    // three comparisons a frame — the same reasoning as the split ranks: it is a reading
    // taken while the race runs because it cannot be taken afterwards.
    if (boat.isPlayer && state.race.status === 'racing' && !boat.raceState.finished) {
        const rs = boat.raceState;
        if (localWind.speed < rs.windObsMin) rs.windObsMin = localWind.speed;
        if (localWind.speed > rs.windObsMax) rs.windObsMax = localWind.speed;
        rs.windObsSum += localWind.speed;
        rs.windObsN++;
    }

    // ── APPARENT WIND, computed before anything that trims to it ────────────
    // Apparent = the air's motion minus the boat's own. It was worked out further down and
    // used only for the flag, the telltales and the HUD, which left the RIG being trimmed to
    // the true wind — so the boat never sheeted in as it accelerated and the "a boat makes
    // its own wind" loop never closed.
    //
    // Uses LAST frame's speed, deliberately. Apparent depends on boat speed and boat speed
    // depends on trim, so resolving them in the same frame is a circular reference; a
    // one-frame lag is the standard answer and is invisible at 60 Hz.
    //
    // ⚠️ Speed still comes from the POLAR, indexed on TRUE wind — see overpowered-plan.md §3.
    // A polar table is defined against TWS/TWA and already has the apparent physics inside
    // it; indexing it by apparent would double-count and close a runaway loop.
    {
        const Wkn = localWind.speed;                 // true wind, knots
        const Bkn = boat.speed / 0.25;               // boat speed, knots
        const awx = -Math.sin(localWind.direction) * Wkn - Math.sin(boat.heading) * Bkn;
        const awy =  Math.cos(localWind.direction) * Wkn + Math.cos(boat.heading) * Bkn;
        boat.apparentWind = {
            direction: normalizeAngle(Math.atan2(-awx, awy)), // heading the wind comes FROM
            speed: Math.hypot(awx, awy)
        };
    }
    // The angle the RIG feels. Always forward of the true wind angle, and further forward
    // the faster the boat goes — which is exactly why a quick boat sheets in and carries a
    // kite deeper than a slow one.
    const awa = Math.abs(normalizeAngle(boat.heading - boat.apparentWind.direction));

    // Update Turbulence Particles
    updateTurbulence(boat, dt);

    // Disturbed Air
    boat.badAirIntensity = 0;
    const windDir = localWind.direction;
    const wx = -Math.sin(windDir); // Flow X
    const wy = Math.cos(windDir);  // Flow Y
    const crx = -wy; // Right X
    const cry = wx;  // Right Y
    const shadowLength = 450;
    const startW = 20;
    const endW = 100;

    for (const other of state.boats) {
        if (other === boat) continue;
        const dx = boat.x - other.x;
        const dy = boat.y - other.y;

        // Project onto flow (Downwind distance)
        const dDown = dx * wx + dy * wy;
        if (dDown <= 10 || dDown > shadowLength) continue;

        const widthAtDist = startW + (dDown / shadowLength) * (endW - startW);
        const dCross = Math.abs(dx * crx + dy * cry);

        if (dCross < widthAtDist * 0.7) {
             const centerFactor = 1.0 - (dCross / (widthAtDist * 0.7));
             const distFactor = 1.0 - (dDown / shadowLength);
             const intensity = 0.95 * centerFactor * distFactor;
             if (intensity > boat.badAirIntensity) boat.badAirIntensity = intensity;
        }
    }

    // Sail Logic
    let relWind = normalizeAngle(localWind.direction - boat.heading);
    if (Math.abs(relWind) > 0.1) boat.targetBoomSide = relWind > 0 ? 1 : -1;

    // Check Tacking (Rule 13)
    // Rule 13: "After a boat passes head to wind, she shall keep clear of other boats until she is on a close-hauled course."
    // We detect "passing head to wind" by checking if the wind side relative to the boat flips while upwind.
    const currentSide = Math.sign(relWind);

    // Initialize if missing (default to current if non-zero, else 1)
    if (boat.lastLocalWindSide === undefined) boat.lastLocalWindSide = (currentSide !== 0) ? currentSide : 1;

    // Only update and check if we are not exactly head-to-wind (0)
    // This allows us to bridge across the 0 value (e.g. -1 -> 0 -> 1)
    if (currentSide !== 0) {
        if (currentSide !== boat.lastLocalWindSide) {
             // Crossed the wind
             // Only if we are generally pointing upwind (avoid gybes triggering this)
             if (angleToWind < Math.PI / 2) {
                 boat.raceState.isTacking = true;
             }
        }
        boat.lastLocalWindSide = currentSide;
    }

    // Clear Tacking state when close-hauled
    if (boat.raceState.isTacking) {
        // Close-hauled is ~45 deg (PI/4).
        if (angleToWind >= Math.PI / 4.0) {
             boat.raceState.isTacking = false;
        }
    }

    let swingSpeed = 0.025;
    boat.boomSide += (boat.targetBoomSide - boat.boomSide) * swingSpeed;
    if (Math.abs(boat.targetBoomSide - boat.boomSide) < 0.01) boat.boomSide = boat.targetBoomSide;

    // Sail angle: map APPARENT wind angle 25-160 onto sheeting angle 0-90.
    //
    // A sailor trims to the telltales, and the telltales are in the apparent wind. Mapping
    // from TWA meant the sheeting angle never moved as the boat accelerated — the rig was
    // being trimmed for a wind nobody on board could feel.
    //
    // Same 135-degree span and the same 2/3 ratio as the true-wind version it replaces; only
    // the origin moves, from 45 degrees of true to AWA_CLOSE_HAULED of apparent. Close-hauled
    // apparent sits near 25 degrees, which is where the sheet comes right in.
    // Clamped at square to the centreline: the old TWA form reached exactly 90 degrees at
    // TWA 180 and so never needed saying, but AWA 160-180 runs past it, and a boom eased
    // beyond square is not a thing. Without the clamp the AI chases an unreachable target
    // downwind and `trimEfficiency` — which prices |actual - optimal| — charges it for the
    // gap it can never close.
    let optimalSailAngle = Math.min(Math.PI / 2, Math.max(0, (awa - AWA_CLOSE_HAULED) * (2.0 / 3.0)));
    if (optimalSailAngle > Math.PI / 2.0) optimalSailAngle = Math.PI / 2.0;

    if (boat.manualTrim && boat.isPlayer) {
        const trimRate = 0.8 * dt;
        if (state.keys.ArrowUp && boat.isPlayer) boat.manualSailAngle = Math.min(Math.PI / 2.0, boat.manualSailAngle + trimRate);
        if (state.keys.ArrowDown && boat.isPlayer) boat.manualSailAngle = Math.max(0, boat.manualSailAngle - trimRate);
        boat.sailAngle = boat.manualSailAngle * boat.boomSide;
    } else if (boat.isPlayer) {
        // Player Auto-Trim (Instant)
        boat.manualSailAngle = optimalSailAngle;
        boat.sailAngle = optimalSailAngle * boat.boomSide;
    } else {
        // AI Simulated Manual Trim
        updateAITrim(boat, optimalSailAngle, dt);
    }

    const switchSpeed = dt / 5.0;
    if (boat.spinnaker) boat.spinnakerDeployProgress = Math.min(1, boat.spinnakerDeployProgress + switchSpeed);
    else boat.spinnakerDeployProgress = Math.max(0, boat.spinnakerDeployProgress - switchSpeed);

    const progress = boat.spinnakerDeployProgress;
    // ── THE HOIST CROSSFADE — weights that SUM TO ONE ───────────────────────
    // These were `max(0, 1 - p*2)` and `max(0, (p-0.5)*2)`. Both are zero at p = 0.5, and
    // they are the weights of a WEIGHTED SUM (`targetKnots` below), so a boat halfway
    // through a sail change had a target speed of exactly ZERO — as though the rig had been
    // taken down. The hoist runs at `dt / 5.0`, five full seconds, so that hole is wide:
    // measured 38-49% of beam-reach frames and 29-45% of running frames sitting in it.
    //
    // A boat changing sails always has SOMETHING up. Crossfade linearly, and charge the
    // change an explicit, bounded price instead of everything.
    const jibFactor = 1 - progress;
    const spinFactor = progress;
    // 4p(1-p) peaks at exactly 1.0 at half-hoist and is zero at both ends, so the cost is a
    // smooth dip through the change and nothing at all once it is done.
    const changeCost = 1 - SAIL_CHANGE_COST * 4 * progress * (1 - progress);

    // Pressure Stat: Affects wind handling
    // Pressure (+/-25%): Benefit from gusts, lose less from lulls/bad air.
    // 5% per point.
    const pressureFactor = boat.stats.pressure * 0.05;
    const baseWind = state.wind.baseSpeed;
    let physWindSpeed = localWind.speed;

    if (physWindSpeed > baseWind) {
        // Gust: Enhance benefit
        // Increase the delta above base
        physWindSpeed = baseWind + (physWindSpeed - baseWind) * (1.0 + pressureFactor);
    } else {
        // Lull: Reduce loss (if pressure positive)
        // physWindSpeed < base. (phys - base) is negative.
        // We want result closer to base if pressure > 0.
        // Example: Base 10, Speed 8. Diff -2. Boost +0.5.
        // New Diff = -2 * (1 - 0.5) = -1. Speed = 9. Correct.
        physWindSpeed = baseWind + (physWindSpeed - baseWind) * (1.0 - pressureFactor);
    }

    // Disturbed Air: Reduce intensity if pressure > 0
    // Intensity is 0 to 1.
    const effectiveBadAir = boat.badAirIntensity * (1.0 - pressureFactor);
    // Note: if pressure is negative (e.g. -0.5), BadAir becomes 1.5x worse.

    const effectiveWind = Math.max(0, physWindSpeed * (1.0 - effectiveBadAir));
    boat.effectiveWindNow = effectiveWind; // read by the HUD overpowered badge

    let targetKnotsJib = getTargetSpeed(angleToWind, false, effectiveWind);
    let targetKnotsSpin = getTargetSpeed(angleToWind, true, effectiveWind);
    let targetKnots = (targetKnotsJib * jibFactor + targetKnotsSpin * spinFactor) * changeCost;

    // THE SHEET, not the boom. `sailAngle` is `manualSailAngle * boomSide`, and `boomSide`
    // is not a side flag — it is a continuous gybe ANIMATION that sweeps through zero (0.79,
    // 0.50, 0.25, -0.81 ... all observed in one race). So |sailAngle| collapses toward zero
    // mid-gybe and this term scored a correctly trimmed boat as completely mistrimmed every
    // time she gybed: 30% of running frames read a 44-80 degree trim error, trim quality
    // 0.64 on the run against 0.96 broad, which dropped the fleet out of planing (38% vs
    // 65%) and cost 1.5 knots. Trim quality is a question about where the SHEET is.
    const actualMagnitude = Math.abs(boat.manualSailAngle);
    const angleDiff = Math.abs(actualMagnitude - optimalSailAngle);
    const trimEfficiency = Math.max(0, 1.0 - angleDiff * 2.0);
    boat.trimEfficiency = trimEfficiency;   // read by the heavy-air rig, and by the HUD later
    boat.optimalSailAngle = optimalSailAngle;
    targetKnots *= trimEfficiency;

    // PLANING LOGIC
    const twaDeg = Math.abs(angleToWind * 180 / Math.PI);
    const tws = effectiveWind;
    const boatKnots = boat.speed * 4;

    let canPlane = (
        twaDeg > (J111_PLANING.minTWA * 180 / Math.PI) &&
        twaDeg < (J111_PLANING.maxTWA * 180 / Math.PI) &&
        tws > J111_PLANING.minTWS
    );

    // Hysteresis State Machine
    if (canPlane) {
        if (!boat.raceState.isPlaning) {
            // Trying to enter
            if (boatKnots > J111_PLANING.entrySpeed) {
                boat.raceState.planingTimer += dt;
                if (boat.raceState.planingTimer > J111_PLANING.entryTime) {
                    boat.raceState.isPlaning = true;
                    boat.raceState.planingTimer = 0;
                    if (!boat.isPlayer) Sayings.queueQuote(boat, "start_planing");
                    if (boat.isPlayer && settings.soundEnabled) {
                         // Optional: Play a surge sound or change wind pitch (handled in audio update)
                    }
                }
            } else {
                boat.raceState.planingTimer = 0;
            }
        } else {
             // Maintaining
             // Exit if speed drops below lower threshold
             if (boatKnots < J111_PLANING.exitSpeed) {
                 boat.raceState.planingTimer += dt;
                 if (boat.raceState.planingTimer > J111_PLANING.exitTime) {
                     boat.raceState.isPlaning = false;
                     boat.raceState.planingTimer = 0;
                 }
             } else {
                 boat.raceState.planingTimer = 0;
             }
        }
    } else {
        // Conditions lost
        if (boat.raceState.isPlaning) {
             boat.raceState.planingTimer += dt;
             if (boat.raceState.planingTimer > J111_PLANING.exitTime) {
                 boat.raceState.isPlaning = false;
                 boat.raceState.planingTimer = 0;
             }
        } else {
             boat.raceState.planingTimer = 0;
        }
    }

    if (boat.raceState.isPlaning) {
        // Boost target speed
        targetKnots *= J111_PLANING.speedMultiplier;

        // Handling: Turning bleeds speed faster
        const turnActive = Math.abs(boat.heading - boat.prevHeading) > 0.0001;
        if (turnActive) {
            targetKnots *= J111_PLANING.turnDrag;
        }
    }

    // Smooth factor for planing transition
    const targetFactor = boat.raceState.isPlaning ? 1.0 : 0.0;
    boat.raceState.planingFactor += (targetFactor - boat.raceState.planingFactor) * dt * 2.0;

    // Apply Upwind/Reach/Downwind Speed Stats
    // Interpolate between Upwind (<=60), Reach (60-145), Downwind (>=145)
    // TWA is in degrees (twaDeg)
    let speedStat = 0;
    if (twaDeg <= 60) {
        speedStat = boat.stats.upwind * 0.012; // 6% max at +/-5
    } else if (twaDeg >= 145) {
        speedStat = boat.stats.downwind * 0.015; // 7.5% max at +/-5
    } else {
        // Linear Interpolation
        // Reach peak assumed at (60+145)/2 = 102.5?
        // Let's just interpolate the Stat Value.
        // Or simpler: Calculate blend weights.
        if (twaDeg < 102.5) {
            const t = (twaDeg - 60) / (102.5 - 60);
            const s1 = boat.stats.upwind * 0.012;
            const s2 = boat.stats.reach * 0.018; // 9% max at +/-5
            speedStat = s1 + t * (s2 - s1);
        } else {
            const t = (twaDeg - 102.5) / (145 - 102.5);
            const s1 = boat.stats.reach * 0.018;
            const s2 = boat.stats.downwind * 0.015;
            speedStat = s1 + t * (s2 - s1);
        }
    }
    // Apply multiplier
    targetKnots *= (1.0 + speedStat);

    // Wind groove: light-air and heavy-air specialists. Keyed to the DAY's base wind,
    // not the boat's local effective wind, and that distinction is the whole point of
    // keeping these separate from pressure. Local wind already carries gusts, lulls,
    // shadows and dirty air — all of which pressure exists to modulate. Feeding it here
    // too would double-count, and worse, a low-pressure boat feels deeper lulls and would
    // silently earn more lightAir credit for its own weakness. So: lightAir/heavyAir
    // answer "what kind of day suits you", pressure answers "how you handle the
    // deviations from it".
    targetKnots *= windGrooveFactor(boat.stats, state.wind.baseSpeed);

    // OVERPOWERED, beside the groove and deliberately not inside it. They ask different
    // questions of the same stat: the groove asks what kind of DAY suits this boat, keyed to
    // the day's mean; this asks what the boat is doing about the wind it is in RIGHT NOW,
    // keyed to the wind it measures. Folding them together would force one answer on both,
    // and a boat in a 25-knot puff on a 14-knot day would sail as though it were not.
    // Heel is LAGGED state, not an instantaneous read — a rig takes a moment to load up and
    // a moment to come back, and that delay is the whole mechanic: it makes being
    // overpowered something a sailor sails INTO and back OUT of. Phase 4 hangs the amber/red
    // warning and the broach off this same number.
    const heelNow = heelPressure(boat.apparentWind.speed * (1.0 - effectiveBadAir), awa);
    const lag = Math.min(1, dt / OVERPOWERED.lagSeconds);
    boat.heel = (boat.heel || 0) + (heelNow - (boat.heel || 0)) * lag;
    targetKnots *= overpoweredFactor(boat.stats, boat.heel);


    let targetGameSpeed = targetKnots * 0.25;

    // Penalties no longer slow the boat directly — the cost is the owed 360°
    // turn (see triggerPenalty). Rule 21 keep-clear still applies while flagged.

    if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
         if (checkBoundaryExiting(boat)) window.onRaceEvent('collision_boundary', { boat });
    }

    // Angle of attack is a fact about the AIR OVER THE SAIL, so it is measured against the
    // apparent wind. On true wind a boat could be sheeted correctly and still be reported as
    // luffing (or vice versa) the moment it had any speed of its own.
    const effectiveAoA = awa - actualMagnitude;
    // 0.5 rad (28.6 deg) was calibrated against the TRUE-wind angle of attack, where a
    // close-hauled boat read 39 deg and sat clear of it. In apparent it reads about 27 deg —
    // a perfectly good angle of attack — so the old threshold had every correctly trimmed
    // boat shaking its sails upwind. At optimal trim AoA bottoms out near 17 deg close-
    // hauled, so the threshold has to sit below that; what is left triggers on genuine
    // pinching and on a sail eased too far, which is what luffing is.
    const luffStartThreshold = 14 * Math.PI / 180;
    if (effectiveAoA < luffStartThreshold) {
        boat.luffIntensity = Math.min(1.0, Math.max(0, 1.0 - (effectiveAoA / luffStartThreshold)));
        boat.luffing = true;
    } else {
        boat.luffIntensity = 0;
        boat.luffing = false;
    }

    // Speed response toward target (acceleration / drag). The per-second retention
    // is base^60: 0.9985 gave a ~11.6s time-constant, far too sluggish for a 35ft
    // planing sport boat (J/111) — boats reached the line at half speed and took
    // 30s+ to rebuild speed after losing it in traffic. 0.9970 ⇒ ~5.5s constant,
    // which matches a sport keelboat getting up to speed and sharply improves
    // starts and post-tack recovery without making the boats feel like powerboats.
    // Asymmetric response: a displacement keelboat accelerates on a ~5.5s constant
    // (0.9970) but DECELERATES slower (~9s, 0.9982) — it "carries its way" when
    // depowered or head-to-wind, the heavy-boat momentum that makes timing a
    // shoot-to-the-line or a coast into a mark feel real. (Stat mods on top.)
    const accelerating = targetGameSpeed > boat.speed;
    // accel ~5.5s (0.9970), decel ~9s (0.9982): asymmetric so the boat carries its way
    // when depowered/head-to-wind — the heavy-keelboat momentum that makes timing a
    // shoot-to-the-line or a coast into a mark feel real. (Stat mods on top.)
    let speedAlpha = 1 - Math.pow(accelerating ? 0.9970 : 0.9982, timeScale);

    // Apply Acceleration / Momentum Stats
    if (accelerating) {
        // +12% max -> 2.4% per point
        const accelMod = 1.0 + boat.stats.acceleration * 0.024;
        speedAlpha *= accelMod;
    } else {
        // Decelerating (Momentum). Higher momentum stat = slower loss.
        const momMod = 1.0 - boat.stats.momentum * 0.02;
        speedAlpha *= momMod;
    }

    boat.speed = boat.speed * (1 - speedAlpha) + targetGameSpeed * speedAlpha;

    // AI Boost: If wiggle is active, ensure minimum speed to slide off obstacles
    if (!boat.isPlayer && boat.controller && boat.controller.wiggleActive) {
        // Progressive Power: The longer we are stuck, the harder we push
        let minSpeed = 0.15; // 3.5kn
        const stuckTime = boat.controller.lowSpeedTimer;

        if (stuckTime > 10.0) minSpeed = 0.30; // 7.0kn
        if (stuckTime > 20.0) minSpeed = 0.50; // 11.5kn
        if (stuckTime > 30.0) minSpeed = 0.75; // 17.5kn (Increased power)

        if (boat.speed < minSpeed) boat.speed = minSpeed;
    }

    // Irons Penalty (Extra drag when head-to-wind)
    // angleToWind is in radians. 0.5 rad is approx 28 degrees.
    if (angleToWind < 0.5) {
        // Momentum-aware: a slow boat parked head-to-wind gets the full "real
        // brake" (0.994/frame, ~-30%/s — deliberate, for prestart holds and
        // shoots), but a boat CARRYING WAY through a tack coasts on momentum
        // (real keelboats exit a tack at ~70-80% speed, not ~40%). Blend from
        // the full brake at <=3kn up to a light one at >=6kn. Flat 0.994 for
        // everyone measured 59% median tack loss vs ~25% real.
        const PH = (typeof window !== 'undefined' && window.__PHYS) ? window.__PHYS : {};
        const ironsHi = PH.ironsHi != null ? PH.ironsHi : 0.998;
        const bandLo = PH.bandLo != null ? PH.bandLo : 1.5;
        const bandHi = PH.bandHi != null ? PH.bandHi : 4.0;
        const kn = boat.speed * 4;
        const carry = Math.min(1, Math.max(0, (kn - bandLo) / (bandHi - bandLo)));
        const ironsBase = 0.994 + (ironsHi - 0.994) * carry;
        boat.speed *= Math.pow(ironsBase, timeScale);
    }

    // Rudder drag
    if (boat.isPlayer && (state.keys.ArrowLeft || state.keys.ArrowRight)) {
         boat.speed *= Math.pow(CONFIG.turnPenalty, timeScale);
    }

    // Leeway: sailing upwind the keel can't fully resist the side-force, so the boat
    // crabs a few degrees to LEEWARD of where it points. Greatest close-hauled, fades
    // to ~0 by a beam reach and downwind, and less the faster you go. Applied as a
    // course-over-ground offset (heading/sail unchanged) — cheap, believable, and the
    // reason laylines must be sailed a touch high. boat.leeway is exposed so the AI
    // can compensate (aim up-tack) in its layline/VMG planning.
    let cogHeading = boat.heading;
    boat.leeway = 0;
    if (angleToWind < Math.PI * 0.5 && boat.speed > 0.05) {
        const spdK = Math.max(1.5, boat.speed / 0.25);
        const shape = 1.0 - angleToWind / (Math.PI * 0.5);        // 1 head-to-wind -> 0 at beam
        const lwDeg = Math.min(3.0, 3.0 * shape * (localWind.speed / 12) * (12 / (spdK * spdK)));
        const lwSign = Math.sign(normalizeAngle(boat.heading - localWind.direction)) || 1;
        boat.leeway = (lwDeg * Math.PI / 180) * lwSign;
        cogHeading = normalizeAngle(boat.heading + boat.leeway);
    }

    const boatDirX = Math.sin(cogHeading);
    const boatDirY = -Math.cos(cogHeading);
    boat.velocity.x = boatDirX * boat.speed;
    boat.velocity.y = boatDirY * boat.speed;

    // Apply Current (spatial in the river venue, uniform otherwise)
    const boatCurrent = getCurrentAt(boat.x, boat.y);
    if (boatCurrent && boatCurrent.speed > 0.01) {
        // current.speed is Knots. Speed * 4 = Knots. So Speed = Knots / 4.
        const cSpeed = boatCurrent.speed / 4.0;
        const cVx = Math.sin(boatCurrent.direction) * cSpeed;
        const cVy = -Math.cos(boatCurrent.direction) * cSpeed;

        boat.velocity.x += cVx;
        boat.velocity.y += cVy;
    }

    boat.x += boat.velocity.x * timeScale;
    boat.y += boat.velocity.y * timeScale;

    // Boundary Check
    if (state.course.riverCorridor) {
        // River arena is the bank corridor, not the circle. Hard-clamp to the
        // bank CENTERLINES: SAT vs the bank polygons handles the fine contact,
        // but a boat that tunnels through overlapping bank islands (SAT push-out
        // can eject deep intruders out the far side) is snapped back to the
        // correct side instead of stranding behind the wall.
        const rc = state.course.riverCorridor;
        const relX = boat.x - rc.cx, relY = boat.y - rc.cy;
        let alongC = relX * rc.ux + relY * rc.uy;
        let latC = relX * rc.rx + relY * rc.ry;
        // Clamp INSIDE the banks' innermost polygon edge (centreline 1550 minus
        // max vertex reach ~390, minus a hull margin). Clamping at the centreline
        // parked boats inside the polygons, where collision push-out and the
        // clamp fought each other and the fleet ground along the wall to DNF.
        const latLim = 1120, alongLim = rc.dist / 2 + 1370;
        let clamped = false;
        if (Math.abs(latC) > latLim) { latC = Math.sign(latC) * latLim; clamped = true; }
        if (Math.abs(alongC) > alongLim) { alongC = Math.sign(alongC) * alongLim; clamped = true; }
        if (clamped) {
            boat.x = rc.cx + rc.ux * alongC + rc.rx * latC;
            boat.y = rc.cy + rc.uy * alongC + rc.ry * latC;
            if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
                window.onRaceEvent('collision_boundary', { boat });
            }
        }
    } else if (state.course.boundary) {
        // Nearest point INSIDE the arena. Must land on the edge rather than merely
        // near it, or the clamp and the collision push-out fight each other — which
        // is how the river banks once ground boats along a wall to DNF.
        const c = Arena.clamp(state.course.boundary, boat.x, boat.y);
        if (c.clamped) {
            const preX = boat.x, preY = boat.y;
            boat.x = c.x; boat.y = c.y;
            if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
                window.onRaceEvent('collision_boundary', { boat });
            }
            // The wall is a contact like any other. Without this the AI had no
            // reflex at the arena edge at all — the clamp silently killed speed and
            // boats parked on the lee wall for minutes (the wiggle only knows boats
            // and marks). Normal points from boat INTO the wall, like the island's.
            if (boat.ai && !boat.isPlayer) {
                const dxw = preX - c.x, dyw = preY - c.y;
                const dw = Math.hypot(dxw, dyw) || 1;
                boat.ai.collisionData = { type: 'island', normal: { x: dxw / dw, y: dyw / dw }, isWall: true };
            }
        }
    }

    // Race Logic per Boat
    updateBoatRaceState(boat, dt);

    // Store history
    boat.raceState.lastPos.x = boat.x;
    boat.raceState.lastPos.y = boat.y;
    boat.prevHeading = boat.heading;
}

// ── DID ANY PART OF THE BOAT CROSS THIS LINE? ───────────────────────────────
// RRS 28 and the definitions of Start and Finish are all written about the HULL, not about a
// point: "a boat starts when ... any part of her hull crosses the starting line", and she
// finishes when any part of her hull crosses the finishing line. This used to sweep the
// boat's CENTRE, so a bow over the line was not over the line — you finished roughly half a
// boat-length late, and could sit with the bow past the start without being OCS.
//
// The event is the LEADING EDGE changing sides, not "some vertex touched the line". A
// 55-unit boat straddles a line for many frames and during all of them some vertex is
// sweeping across it, so a touch test fires every frame of the passage — on a gate sailed
// through twice that advanced two legs in one pass (test_gates caught it: "sailing back DOWN
// through the same gate completes leg 2" reported leg 4).
//
// So: track the hull's extreme signed offset either way. `max` turning positive is the first
// moment any part of the boat reaches the far side; `min` turning negative is the same going
// back. Each happens exactly once per passage, whatever the hull does in between — and
// unlike a straddle-lockout it still works for the gate EXTENSIONS, which are collinear with
// the gate itself and would otherwise be suppressed for the whole rounding.
//
// The segment test then confirms the crossing happened BETWEEN the marks rather than around
// an end, which is the distinction the extensions exist to make.
function hullCrossedLine(boat, ax, ay, bx, by) {
    // The previous hull is the current one TRANSLATED back to `lastPos`, not rebuilt from a
    // stored previous heading. A hull is rigid and a boat turns a degree or two per frame, so
    // the swept shape is the same either way — and this depends on one piece of history
    // (`lastPos`) instead of two. `prevHeading` is only maintained by updateBoat, so anything
    // driving updateBoatRaceState directly carried a stale one; that silently mis-rotated the
    // previous hull and lost the second crossing of a reused gate.
    const rs = boat.raceState;
    const prev = hullPolygonAt(rs.lastPos.x, rs.lastPos.y, boat.heading);
    const cur = hullPolygonAt(boat.x, boat.y, boat.heading);
    const ex = bx - ax, ey = by - ay;
    let minP = Infinity, maxP = -Infinity, minC = Infinity, maxC = -Infinity;
    for (let i = 0; i < prev.length; i++) {
        const sp = (prev[i].x - ax) * ey - (prev[i].y - ay) * ex;
        if (sp < minP) minP = sp;
        if (sp > maxP) maxP = sp;
        const sc = (cur[i].x - ax) * ey - (cur[i].y - ay) * ex;
        if (sc < minC) minC = sc;
        if (sc > maxC) maxC = sc;
    }
    if (!((maxP <= 0 && maxC > 0) || (minP >= 0 && minC < 0))) return false;
    for (let i = 0; i < cur.length; i++) {
        if (checkLineIntersection(prev[i].x, prev[i].y, cur[i].x, cur[i].y, ax, ay, bx, by)) return true;
    }
    return false;
}

function updateBoatRaceState(boat, dt) {
    // Timers
    if (boat.raceState.startTimeDisplayTimer > 0) boat.raceState.startTimeDisplayTimer -= dt;
    if (boat.raceState.legSplitTimer > 0) boat.raceState.legSplitTimer -= dt;

    // Waypoint
    const marks = state.course.marks;
    // Guarded on >= 2, not >= 4. Requiring four marks meant a course with only a
    // line and a rounding skipped this block entirely — which silently stopped
    // resetting raceState.inZone each frame, leaving a stale value feeding the
    // mark-room rules.
    if (marks && marks.length >= 2) {
        // Third enumerated selector found in this file (`leg === 0 || leg === 2
        // || leg === 4`), with the same off-by-a-course-length bug as the other
        // two: legs 6, 8 and 10 fell through to the windward gate while sailing
        // downwind.
        const indices = legMarks(boat.raceState.leg);
        if (indices) {
            const m1 = marks[indices[0]], m2 = marks[indices[1]];
            const closest = getClosestPointOnSegment(boat.x, boat.y, m1.x, m1.y, m2.x, m2.y);
            const dx = closest.x - boat.x, dy = closest.y - boat.y;
            boat.raceState.nextWaypoint = {
                x: closest.x, y: closest.y,
                dist: Math.sqrt(dx*dx + dy*dy) * 0.2,
                angle: Math.atan2(dx, -dy)
            };
        }

        // Zone Check
        let inZone = false;
        let zoneMarks = [];
        // No zones on Start (0) or Finish (totalLegs)
        if (boat.raceState.leg > 0 && boat.raceState.leg < state.race.totalLegs) {
            zoneMarks = legMarks(boat.raceState.leg) || [];
        }

        for (const idx of zoneMarks) {
             const m = marks[idx];
             const d2 = (boat.x - m.x)**2 + (boat.y - m.y)**2;
             if (d2 < 165*165) {
                 inZone = true;
                 break;
             }
        }

        if (inZone && !boat.raceState.inZone) {
            boat.raceState.inZone = true;
            boat.raceState.zoneEnterTime = state.time;
        } else if (!inZone) {
            boat.raceState.inZone = false;
        }
    }

    // Position-based OCS clearing (anti-deadlock).
    // OCS normally clears only by crossing the start *segment* downward. A boat
    // that is over early and returns to the pre-start side by passing around the
    // end of the line (outside the marks) would otherwise keep OCS set forever,
    // get trapped by the AI's OCS-recovery navigation (which keeps it behind the
    // line), and never start — a DNS. The Racing Rules treat a boat as no longer
    // on the course side once it is fully behind the line, so clear OCS whenever
    // a still-to-start boat is clearly on the pre-start side, however it got there.
    if (state.race.status === 'racing' && boat.raceState.leg === 0 && boat.raceState.ocs &&
        marks && marks.length >= 2) {
        const [m0, m1] = startLinePts();
        const lineDx = m1.x - m0.x, lineDy = m1.y - m0.y;
        const lineLen = Math.hypot(lineDx, lineDy) || 1;
        // Signed perpendicular distance to the line: positive = course side (OCS).
        const perpDist = ((boat.x - m0.x) * lineDy - (boat.y - m0.y) * lineDx) / lineLen;
        if (perpDist < -40) {
            boat.raceState.ocs = false;
            if (boat.isPlayer) hideRaceMessage();
        }
    }

    // Island course waypoint: the HUD arrow and distance should point at the
    // mountain while outbound and at the finish line coming home. The gate-based
    // block above targets the unused windward gate, so override it here.
    if (state.course.type === 'islandRound' && state.course.roundMark && marks && marks.length >= 2) {
        const rs0 = boat.raceState;
        const e0 = routeLeg(Math.min(rs0.leg, state.race.totalLegs));
        let tx, ty;
        if (rs0.leg <= 1) {
            // Outbound: the first rounding, even before the gun — Glacier Sound's
            // mountain, the first can at Lighthouse Cove.
            const rm0 = (e0 && e0.kind === 'round' && e0.mark) ? e0.mark : state.course.roundMark;
            tx = rm0.x; ty = rm0.y;
        } else if (e0 && e0.kind === 'round' && e0.mark) {
            // Any later rounding: THIS leg's mark. `roundMark` is only the first one,
            // and the old start-line fallback pointed a five-rounding course home
            // from leg 2 onward.
            tx = e0.mark.x; ty = e0.mark.y;
        } else {
            // A line or gate leg: the leg's own line — which on Lighthouse Cove is a
            // finish line that is NOT the start line.
            const lm = (e0 && e0.marks) ? e0.marks : startLineMarks();
            const l0 = marks[lm[0]], l1 = marks[lm[1]];
            const c = getClosestPointOnSegment(boat.x, boat.y, l0.x, l0.y, l1.x, l1.y);
            tx = c.x; ty = c.y;
        }
        const wdx = tx - boat.x, wdy = ty - boat.y;
        rs0.nextWaypoint = {
            x: tx, y: ty,
            dist: Math.sqrt(wdx * wdx + wdy * wdy) * 0.2,
            angle: Math.atan2(wdx, -wdy)
        };
    }


    // ─── LEG PROGRESSION ────────────────────────────────────────────────────
    // ONE walker over the route. Each entry says how its leg ends:
    //
    //   kind 'line',  role 'start'  — cross once in `dir` (and OCS before the gun)
    //   kind 'line',  finish        — cross once in `dir`
    //   kind 'gate'                 — cross in, then back out past an end
    //   kind 'round'                — sweep ~180 degrees about a mark, correct side
    //
    // Gates and island roundings used to be two hardcoded course types. A gate leg
    // is ALREADY a rounding (cross in, leave round an end), so the only genuinely
    // new primitive here is the swept-angle test — which is why one walker can now
    // race a route mixing lines, gates and roundings in any order.
    const _entry = routeLeg(boat.raceState.leg);

    // Shared, so a rounding and a gate cannot drift apart in what they record. The
    // two old branches each had their own copy and already disagreed: the island
    // course pushed a leg split unconditionally and emitted no `leg_complete` at the
    // finish; the W/L path did the opposite.
    const advanceLeg = () => {
        const rs = boat.raceState;
        // The place you were in as you got here, for the results splits. Read BEFORE the
        // leg advances: a boat one leg further along outranks the whole fleet by
        // definition, and the boat rounding this mark is about to become that boat.
        const rankHere = boat.isPlayer ? fleetRank(boat) : 0;
        rs.leg++;
        if (window.onRaceEvent) window.onRaceEvent('leg_complete', { boat, leg: rs.leg - 1, time: state.race.timer });
        rs.isRounding = false;
        rs.roundSweep = 0;
        rs.roundWrong = 0;
        rs.roundArmed = false;
        rs._wrongRound = false;
        const split = state.race.timer - rs.legStartTime;
        rs.lastLegDuration = split;
        if (rs.leg > 1) {
            rs.legTimes.push(split);
            if (boat.isPlayer) rs.legRanks.push(rankHere);
        }
        rs.legSplitTimer = 5.0;
        rs.legStartTime = state.race.timer;

        if (rs.leg > state.race.totalLegs) {
            rs.finished = true;
            rs.finishTime = state.race.timer;
            // Un-taken penalty turns convert to time at the finish.
            if (rs.penalty) rs.finishTime += 15 * Math.max(1, rs.penaltyTurnsOwed);
            if (window.onRaceEvent) window.onRaceEvent('finish', { boat, time: rs.finishTime });
            // Was hardcoded `leg: 4`, which is wrong on any course that is not four
            // legs. The trace's leg field is cosmetic, so this is unobserved by the
            // golden traces — noted rather than relied upon.
            rs.trace.push({ x: boat.x, y: boat.y, leg: rs.leg });
            if (boat.isPlayer) {
                showRaceMessage("FINISHED!", "text-green-400", "border-green-400/50");
                Sound.playFinish();
                if (window.confetti) window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            } else {
                Sayings.queueQuote(boat, "finished_race");
            }
        } else if (boat.isPlayer) {
            Sound.playGateClear();
            Sound.updateMusic();
        } else {
            Sayings.queueQuote(boat, "rounded_mark");
        }
    };

    // ROUNDING leg: swept bearing angle about a mark, not a line crossing.
    //
    // Sign convention, derived rather than guessed. Heading h gives forward
    // (sin h, -cos h) on this y-down canvas, so starboard is (cos h, sin h). Mark to
    // starboard means r.(cos h, sin h) < 0 for r = P-C, and the bearing rate is
    // (r x v)/|r|^2 with r x v = -(rx cos h + ry sin h) > 0. So LEAVING THE MARK TO
    // STARBOARD MEANS THE BEARING ANGLE INCREASES — accumulate positive, and flip
    // the sign for a port rounding.
    if (_entry && _entry.kind === 'round' && _entry.mark
        && state.race.status === 'racing' && !boat.raceState.finished) {
        const rs = boat.raceState;
        const rm = _entry.mark;
        const sgn = (rm.side === 'port') ? -1 : 1;
        const rx1 = boat.x - rm.x, ry1 = boat.y - rm.y;
        const d2 = rx1 * rx1 + ry1 * ry1;

        // THE ZONE DOES NOT GATE COMPLETION. The circle is a RULES construct — where
        // mark-room applies, where the AI switches to its orbit machinery — and a
        // rounding is complete the way the racing rules say it is: pass the mark on
        // the required side, in sequence. The string rule cares which side you left
        // it on, not how close you came, so a wide rounding outside the circle is a
        // legitimate (if slow) rounding. Zone entry used to ARM the sweep, and a
        // player who gave the first can a sensible berth sailed a perfect rounding
        // that silently never counted.
        //
        // So the signed sweep accumulates for the WHOLE leg, at any distance. The
        // sign carries the side: a pass on the wrong side sweeps negative and can
        // never reach the requirement, however close or far it was.
        //
        // Note the sweep is only ever read for its SIGN — see the completion test
        // below for why a magnitude threshold cannot work.
        //
        // ARMED BY THE HULL, not the centre — armed now feeds only the AI's rounding
        // machinery and the wrong-way warning, but it should still flip exactly when
        // the drawn ring lights amber, and both test the hull per RRS 18.1.
        if (!rs.roundArmed) {
            const sinH = Math.sin(boat.heading), cosH = Math.cos(boat.heading);
            const hp = getClosestPointOnSegment(rm.x, rm.y,
                boat.x + 25 * sinH, boat.y - 25 * cosH,
                boat.x - 30 * sinH, boat.y + 30 * cosH);
            if ((hp.x - rm.x) ** 2 + (hp.y - rm.y) ** 2 < rm.zone * rm.zone) rs.roundArmed = true;
        }
        const activeR = rm.zone * ROUND_ACTIVE;
        const d2prev = (rs.lastPos.x - rm.x) ** 2 + (rs.lastPos.y - rm.y) ** 2;
        {
            const rx0 = rs.lastPos.x - rm.x, ry0 = rs.lastPos.y - rm.y;
            let dA = Math.atan2(ry1, rx1) - Math.atan2(ry0, rx0);
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            // Wrong-way travel gets its OWN accumulator, so the warning and the side
            // judgement cannot eat each other.
            const prog = dA * sgn;
            // NET signed sweep, not a magnitude race. What matters is which SIDE the
            // mark was left on, and the sign carries that. It is not clamped at zero:
            // a wrong-way excursion must be able to cancel, or you could bank credit
            // one way and then pass on the wrong side.
            rs.roundSweep = (rs.roundSweep || 0) + prog;
            // The WARNING stays gated to the mark's neighbourhood. Far from the mark
            // the bearing wobbles with every tack of an ordinary beat, and those
            // wobbles accumulate one-directionally here — ungated, a long approach
            // could scold a boat that never put a foot wrong.
            if (prog < 0 && d2 < activeR * activeR) {
                rs.roundWrong = (rs.roundWrong || 0) - prog;
                if (rs.roundWrong > Math.PI * 0.55 && boat.isPlayer && !rs._wrongRound) {
                    rs._wrongRound = true;
                    showRaceMessage(`WRONG WAY ROUND — LEAVE IT TO ${String(rm.side).toUpperCase()}`,
                                    "text-orange-500", "border-orange-500/50");
                    setTimeout(hideRaceMessage, 2500);
                }
            }
        }

        // COMPLETION ON DEPARTURE, not on a sweep threshold.
        //
        // A fixed threshold (this was 160 degrees) is wrong in general. Sailing in a
        // straight line PAST a mark sweeps ~180 degrees by itself, so the threshold was
        // not measuring "went round" — it was accidentally measuring "passed close".
        // And the sweep a real rounding needs depends on where the NEXT mark is: an
        // out-and-back needs ~180, a triangle corner might need 60. No single number
        // can serve both.
        //
        // The actual racing rule is "leave the mark on the required side", so that is
        // what this tests. Proximity is the zone; the SIDE is the sign of the net
        // sweep; and the leg completes when the boat has passed the mark and is
        // leaving. The small minimum only rejects degenerate cases — a boat nudging
        // the zone edge and retreating has not passed anything.
        // HOW FAR ROUND THIS COURSE REQUIRES, not a constant. `Math.PI / 4` was applied to
        // every mark on every course: a 60-degree nibble at Glacier Sound's isle completed a
        // leg whose geometry needs the whole circle, because the boat leaves for the line it
        // arrived from. `reqSweep` comes from where the previous and next marks are.
        //
        // ROUND_SWEEP_TOL leaves room for a rounding that sweeps a little less than the
        // ideal tangent-to-tangent arc.
        //
        // No zone requirement here — the departure radius only stops the leg completing
        // in the middle of a tight turn; a wide rounding is already outside it.
        const need = (rm.reqSweep != null ? rm.reqSweep * ROUND_SWEEP_TOL : Math.PI / 4);
        if (d2 > (rm.zone * 1.25) ** 2 && d2 > d2prev
            && (rs.roundSweep || 0) >= need) {
            advanceLeg();
        }
    }

    // CROSSING legs: lines and gates. Guarded on >= 2 marks, not >= 4 — a course
    // with one line and a rounding has exactly two.
    if (marks && marks.length >= 2) {
        // Which gate this leg is sailed TO, and which way it must be crossed.
        // From the route table rather than leg parity, so a course that is not a
        // windward-leeward can express itself.
        let gateIndices = [];
        let requiredDirection = 1;
        const legEntry = _entry;

        if (boat.raceState.leg <= state.race.totalLegs && legEntry && legEntry.marks) {
            gateIndices = legEntry.marks;
            requiredDirection = legEntry.dir;
        }

        if (gateIndices.length > 0) {
            const m1 = marks[gateIndices[0]], m2 = marks[gateIndices[1]];
            // ANY PART OF THE HULL, not the centre — see hullCrossedLine.
            const intersect = hullCrossedLine(boat, m1.x, m1.y, m2.x, m2.y);

            if (intersect) {
                const gateDx = m2.x - m1.x, gateDy = m2.y - m1.y;
                const nx = gateDy, ny = -gateDx;
                const moveDx = boat.x - boat.raceState.lastPos.x, moveDy = boat.y - boat.raceState.lastPos.y;
                const dot = moveDx * nx + moveDy * ny;
                const crossingDir = dot > 0 ? 1 : -1;

                if (state.race.status === 'prestart') {
                    // The start line, identified by its route role rather than by
                    // being "the pair that happens to begin at index 0".
                    if (legEntry && legEntry.role === 'start') {
                        if (crossingDir === 1) {
                            boat.raceState.ocs = true;
                            if (boat.isPlayer) showRaceMessage("OCS - RETURN TO PRE-START!", "text-red-500", "border-red-500/50");
                        } else {
                            boat.raceState.ocs = false;
                            if (boat.isPlayer) hideRaceMessage();
                        }
                    }
                } else if (state.race.status === 'racing' && !boat.raceState.finished) {
                    if (legEntry.role === 'start') {
                        if (crossingDir === requiredDirection) {
                            if (!boat.raceState.ocs) {
                                // Where the start put you, for the results splits — read
                                // BEFORE the leg advances, or you outrank the whole fleet
                                // by virtue of being the one boat already on leg 1.
                                if (boat.isPlayer) boat.raceState.startRank = fleetRank(boat);
                                boat.raceState.leg++;
                                boat.raceState.roundSweep = 0;
                                boat.raceState.roundWrong = 0;
                                boat.raceState.roundArmed = false;
                                if (window.onRaceEvent) window.onRaceEvent('leg_complete', { boat, leg: 0, time: state.race.timer });
                                if (boat.isPlayer) {
                                    Sound.playGateClear();
                                    Sound.updateMusic();
                                } else {
                                    const othersStarted = state.boats.some(b => b !== boat && b.raceState.leg > 0);
                                    if (!othersStarted) Sayings.queueQuote(boat, "first_across_start");
                                }
                                boat.raceState.startTimeDisplay = state.race.timer;
                                boat.raceState.startTimeDisplayTimer = 5.0;
                                boat.raceState.startLegDuration = state.race.timer;
                                boat.raceState.legStartTime = state.race.timer;
                            }
                        } else {
                            boat.raceState.ocs = false;
                            if (boat.isPlayer) hideRaceMessage();
                        }
                    } else {
                        // Normal Legs

                        // A gate is either sailed THROUGH (crossing it completes the
                        // leg, like a finish line) or ROUNDED (cross in, then leave
                        // round an end). Absent `pass` means round, which is what a
                        // windward-leeward gate has always done.
                        if (legEntry.finish || legEntry.pass === 'through') {
                            if (crossingDir === requiredDirection) advanceLeg();
                            else if (boat.isPlayer) { showRaceMessage("WRONG WAY!", "text-orange-500", "border-orange-500/50"); setTimeout(hideRaceMessage, 2000); }
                        } else {
                            if (!boat.raceState.isRounding) {
                                if (crossingDir === requiredDirection) boat.raceState.isRounding = true;
                                else if (boat.isPlayer) { showRaceMessage("WRONG WAY!", "text-orange-500", "border-orange-500/50"); setTimeout(hideRaceMessage, 2000); }
                            } else {
                                if (crossingDir === -requiredDirection) {
                                    boat.raceState.isRounding = false;
                                    if (boat.isPlayer) { showRaceMessage("ROUNDING ABORTED", "text-orange-500", "border-orange-500/50"); setTimeout(hideRaceMessage, 2000); }
                                }
                            }
                        }
                    }
                }
            }

            // Extensions Logic
            if (boat.raceState.isRounding && state.race.status === 'racing') {

                const gDx = m2.x - m1.x, gDy = m2.y - m1.y;
                const len = Math.sqrt(gDx*gDx + gDy*gDy);
                const ux = gDx / len, uy = gDy / len;
                const nx = gDy, ny = -gDx; // Upwind normal
                const extLen = 10000;

                // ⚠️ THE CENTRE, deliberately, unlike the gate line itself.
                //
                // An extension is not a line you cross in the rules sense — it is a
                // geometric side-test asking "did she leave round the OUTSIDE of this mark",
                // and the boat's answer to that is one point, not a shape. Rounding a gate
                // mark close aboard swings 55 units of hull across the extension while the
                // boat is still very much on the mark, so the hull test completed the leg
                // early; the AI then turned onto the next leg from alongside the buoy and
                // hit it. Rule 31 touches went 3 -> 22 on Bluewater and 6 -> 37 on
                // Stillwater before this was put back.
                const checkExt = (ax, ay, bx, by) => {
                    if (checkLineIntersection(boat.raceState.lastPos.x, boat.raceState.lastPos.y,
                                              boat.x, boat.y, ax, ay, bx, by)) {
                        const moveDx = boat.x - boat.raceState.lastPos.x, moveDy = boat.y - boat.raceState.lastPos.y;
                        return (moveDx * nx + moveDy * ny > 0) ? 1 : -1;
                    }
                    return 0;
                };

                const dirL = checkExt(m1.x, m1.y, m1.x - ux * extLen, m1.y - uy * extLen);
                const dirR = checkExt(m2.x, m2.y, m2.x + ux * extLen, m2.y + uy * extLen);
                if (dirL === -requiredDirection || dirR === -requiredDirection) advanceLeg();
            }
        }
    }

    // Trace
    if (boat.raceState.leg >= 1 && !boat.raceState.finished) {
        const trace = boat.raceState.trace;
        if (trace.length === 0) trace.push({ x: boat.x, y: boat.y, leg: boat.raceState.leg });
        else {
            const last = trace[trace.length - 1];
            if ((boat.x - last.x)**2 + (boat.y - last.y)**2 > 2500) trace.push({ x: boat.x, y: boat.y, leg: boat.raceState.leg });
        }
    }

    // One-Turn Penalty: accumulate net signed rotation while flagged; a full
    // 360° (net, so a wobble unwinds) clears one owed turn. Direction is the
    // sailor's choice — RRS asks for a tack and a gybe, and any net full
    // rotation includes both.
    if (boat.raceState.penalty && state.race.status === 'racing') {
        const rs = boat.raceState;
        rs.penaltyFlagTime += dt;
        if (rs.penaltyLastHeading == null) rs.penaltyLastHeading = boat.heading;
        // Decay credit toward zero (~7°/s) so ordinary sailing — alternating
        // tacks, one-off mark roundings (~180° bursts that fade before the
        // next) — can't passively clear the turn. A committed spiral
        // (~30-50°/s) out-rotates the decay easily; extending a mark rounding
        // into a full circle (the classic "penalty at the offset") works too.
        const decay = 0.12 * dt;
        if (Math.abs(rs.penaltyRot) > decay) rs.penaltyRot -= Math.sign(rs.penaltyRot) * decay;
        else rs.penaltyRot = 0;
        rs.penaltyRot += normalizeAngle(boat.heading - rs.penaltyLastHeading);
        rs.penaltyLastHeading = boat.heading;

        if (Math.abs(rs.penaltyRot) >= Math.PI * 2) {
            rs.penaltyTurnsOwed--;
            rs.penaltyRot = 0;
            if (rs.penaltyTurnsOwed <= 0) {
                rs.penalty = false;
                rs.penaltyTurnsOwed = 0;
                rs.penaltyLastHeading = null;
                if (boat.isPlayer) {
                    showRaceMessage("PENALTY CLEARED!", "text-green-400", "border-green-400/50");
                    setTimeout(hideRaceMessage, 2000);
                }
            }
        } else if (boat.isPlayer) {
            const remaining = Math.ceil((Math.PI * 2 - Math.abs(rs.penaltyRot)) * 180 / Math.PI);
            showRaceMessage(`PENALTY! TURN ${remaining}° MORE TO CLEAR (or +15s at finish)`, "text-red-500", "border-red-500/50");
        }
    }

    // Maneuvers Stats
    const relWindAngle = normalizeAngle(state.wind.direction - boat.heading);
    const currentWindSide = Math.sign(relWindAngle);
    if (boat.lastWindSide === undefined) boat.lastWindSide = currentWindSide;
    if (currentWindSide !== 0) {
        if (boat.lastWindSide !== 0 && currentWindSide !== boat.lastWindSide) {
             if (state.race.status === 'racing' && boat.raceState.leg >= 0 && boat.raceState.leg <= state.race.totalLegs) {
                 boat.raceState.legManeuvers[boat.raceState.leg]++;
             }
        }
        boat.lastWindSide = currentWindSide;
    }

    // Stats
    if (state.race.status === 'racing' && boat.raceState.leg <= state.race.totalLegs) {
        // Distance Calculation:
        // Use visual scale: 1 unit = 0.2 meters.
        // Distance = Speed (units/s) * dt * 0.2
        // boat.speed is units per frame (at 60fps). Speed/s = boat.speed * 60.
        // Distance = boat.speed * 60 * dt * 0.2 = boat.speed * 12.0 * dt.
        const distMoved = boat.speed * 12.0 * dt;
        const kn = boat.speed * 4;
        boat.raceState.legDistances[boat.raceState.leg] += distMoved;
        boat.raceState.legSpeedSums[boat.raceState.leg] += kn * dt;
        if (kn > boat.raceState.legTopSpeeds[boat.raceState.leg]) boat.raceState.legTopSpeeds[boat.raceState.leg] = kn;
    }
}

// Collision Helpers
const HULL_LOCALS = [
    {x: 0, y: -25}, {x: 15, y: -5}, {x: 15, y: 20},
    {x: 12, y: 30}, {x: -12, y: 30}, {x: -15, y: 20}, {x: -15, y: -5}
];
// Taking a POSE rather than a boat, so the previous frame's hull can be reconstructed from
// `lastPos` + `prevHeading` instead of cached alongside them. A cached copy is a second
// source of truth for where the boat was, and it went stale the moment anything drove
// updateBoatRaceState without going through updateBoat — which the gate tests do.
function hullPolygonAt(x, y, heading) {
    const cos = Math.cos(heading), sin = Math.sin(heading);
    return HULL_LOCALS.map(p => ({
        x: x + (p.x * cos - p.y * sin),
        y: y + (p.x * sin + p.y * cos)
    }));
}
function getHullPolygon(boat) { return hullPolygonAt(boat.x, boat.y, boat.heading); }

// How far the boat's LEADING EDGE is over a line — the quantity RRS judges a start by, and
// therefore the one the start AI has to steer. `normalize` scales to real units; unnormalized
// keeps the raw cross-product the approach timer was written against.
function hullLineOffset(boat, m0, m1, normalize) {
    const dx = m1.x - m0.x, dy = m1.y - m0.y;
    const len = normalize ? (Math.hypot(dx, dy) || 1) : 1;
    let best = -Infinity;
    for (const p of hullPolygonAt(boat.x, boat.y, boat.heading)) {
        const d = ((p.x - m0.x) * dy - (p.y - m0.y) * dx) / len;
        if (d > best) best = d;
    }
    return best;
}

function projectPolygon(axis, poly) {
    let min = Infinity, max = -Infinity;
    for (const p of poly) {
        const dot = p.x * axis.x + p.y * axis.y;
        if (dot < min) min = dot;
        if (dot > max) max = dot;
    }
    return { min, max };
}

function projectCircle(axis, center, radius) {
    const dot = center.x * axis.x + center.y * axis.y;
    return { min: dot - radius, max: dot + radius };
}

function getAxes(poly) {
    const axes = [];
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
        const len = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
        axes.push({ x: -edge.y / len, y: edge.x / len });
    }
    return axes;
}

function satPolygonPolygon(polyA, polyB) {
    let overlap = Infinity;
    let smallestAxis = null;
    const axes = [...getAxes(polyA), ...getAxes(polyB)];

    for (const axis of axes) {
        const p1 = projectPolygon(axis, polyA);
        const p2 = projectPolygon(axis, polyB);
        if (p1.max < p2.min || p2.max < p1.min) return null;
        const o = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (o < overlap) {
            overlap = o;
            smallestAxis = axis;
        }
    }

    const centerA = polyA.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const centerB = polyB.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const dirX = (centerB.x/polyB.length) - (centerA.x/polyA.length);
    const dirY = (centerB.y/polyB.length) - (centerA.y/polyA.length);

    if (dirX * smallestAxis.x + dirY * smallestAxis.y < 0) {
        smallestAxis.x = -smallestAxis.x;
        smallestAxis.y = -smallestAxis.y;
    }
    return { overlap, axis: smallestAxis };
}

function satPolygonCircle(poly, circleCenter, radius) {
    let overlap = Infinity;
    let smallestAxis = null;
    let axes = getAxes(poly);

    let minDistSq = Infinity;
    let closestVertex = null;
    for(const p of poly) {
        const dSq = (p.x - circleCenter.x)**2 + (p.y - circleCenter.y)**2;
        if(dSq < minDistSq) { minDistSq = dSq; closestVertex = p; }
    }
    const axisToCenter = { x: circleCenter.x - closestVertex.x, y: circleCenter.y - closestVertex.y };
    const len = Math.sqrt(axisToCenter.x**2 + axisToCenter.y**2);
    if (len > 1e-5) axes.push({ x: axisToCenter.x / len, y: axisToCenter.y / len });

    for (const axis of axes) {
        const p1 = projectPolygon(axis, poly);
        const p2 = projectCircle(axis, circleCenter, radius);
        if (p1.max < p2.min || p2.max < p1.min) return null;
        const o = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (o < overlap) { overlap = o; smallestAxis = axis; }
    }

    const centerA = poly.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const dirX = circleCenter.x - (centerA.x/poly.length);
    const dirY = circleCenter.y - (centerA.y/poly.length);

    if (dirX * smallestAxis.x + dirY * smallestAxis.y < 0) {
        smallestAxis.x = -smallestAxis.x;
        smallestAxis.y = -smallestAxis.y;
    }
    return { overlap, axis: smallestAxis };
}

function checkBoatCollisions(dt) {
    const broadRadius = 40;
    for (let i = 0; i < state.boats.length; i++) {
        const b1 = state.boats[i];
        if (b1.raceState.finished && b1.fadeTimer <= 0) continue;

        const poly1 = getHullPolygon(b1);
        for (let j = i + 1; j < state.boats.length; j++) {
            const b2 = state.boats[j];
            if (b2.raceState.finished && b2.fadeTimer <= 0) continue;

            const dx = b2.x - b1.x, dy = b2.y - b1.y;
            if (dx*dx + dy*dy > (broadRadius*2)**2) continue;

            const poly2 = getHullPolygon(b2);
            const res = satPolygonPolygon(poly1, poly2);

            if (res) {
                if (window.onRaceEvent && state.race.status === 'racing') {
                    window.onRaceEvent('collision_boat', { boat: b1, other: b2 });
                    window.onRaceEvent('collision_boat', { boat: b2, other: b1 });
                }

                const tx = res.axis.x * res.overlap * 0.5;
                const ty = res.axis.y * res.overlap * 0.5;
                b1.x -= tx; b1.y -= ty;
                b2.x += tx; b2.y += ty;

                // Physics Response: Angle dependent friction
                const nx = res.axis.x, ny = res.axis.y;

                // B1: Normal points AWAY from B1? No, B1->B2. So points AWAY from B1.
                // If B1 moves TOWARDS B2, dot(h1, n) > 0.
                const h1x = Math.sin(b1.heading), h1y = -Math.cos(b1.heading);
                const impact1 = Math.max(0, h1x * nx + h1y * ny);

                // B2: Normal points INTO B2. We want normal pointing AWAY from B2 for impact calc. So -n.
                const h2x = Math.sin(b2.heading), h2y = -Math.cos(b2.heading);
                const impact2 = Math.max(0, h2x * (-nx) + h2y * (-ny));

                const friction = 0.99;
                const impactFactor = 0.5; // Multiplier at max impact (0.5 means lose 50%)

                b1.speed *= (friction - (friction - impactFactor) * impact1);
                b2.speed *= (friction - (friction - impactFactor) * impact2);

                // No penalties if either boat is finished
                if (state.race.status === 'racing' && !b1.raceState.finished && !b2.raceState.finished) {
                    const res = getRightOfWay(b1, b2);
                    const rowBoat = res.boat;

                    // If mark-room is active, entitled boat effectively has immunity
                    // (outside boat must give room regardless of Section A ROW)
                    const effectiveRow = res.markRoom
                        ? (res.markRoom === b1.id ? b1 : b2)
                        : rowBoat;

                    // Sayings Check
                    let playerBoat = null;
                    let aiBoat = null;
                    if (b1.isPlayer) { playerBoat = b1; aiBoat = b2; }
                    else if (b2.isPlayer) { playerBoat = b2; aiBoat = b1; }

                    if (playerBoat && aiBoat) {
                        if (effectiveRow === playerBoat) {
                             if (!aiBoat.raceState.penalty) Sayings.queueQuote(aiBoat, "they_hit_player");
                        } else if (effectiveRow === aiBoat) {
                             if (!playerBoat.raceState.penalty) Sayings.queueQuote(aiBoat, "they_were_hit");
                        } else {
                             if (!aiBoat.raceState.penalty) Sayings.queueQuote(aiBoat, "they_hit_player");
                        }
                    }

                    const pInfo = { rule: res.rule, reason: res.reason, kind: 'contact' };
                    if (effectiveRow === b1) triggerPenalty(b2, pInfo);
                    else if (effectiveRow === b2) triggerPenalty(b1, pInfo);
                    else {
                        triggerPenalty(b1, pInfo);
                        triggerPenalty(b2, pInfo);
                    }
                }
            }
        }
    }
}

function checkMarkCollisions(dt) {
    if (!state.course || !state.course.marks) return;

    // Reset collision flags for next frame's AI
    for (const boat of state.boats) {
        if (boat.ai) boat.ai.collisionData = null;
    }

    // A buoy is one 12-unit circle on its own point. A committee boat is a capsule of
    // three, offset outboard — so both the broad phase and the narrow phase read the
    // mark's own body instead of a constant. `bodyR` is 12 for a buoy, which makes the
    // broad-phase radius 50 exactly as it was.
    for (const boat of state.boats) {
        let close = false;
        for (const mark of state.course.marks) {
             const rr = 38 + (mark.bodyR || 12);
             if ((boat.x-mark.x)**2 + (boat.y-mark.y)**2 < rr*rr) { close = true; break; }
        }
        if (!close) continue;

        const poly = getHullPolygon(boat);
        for (const mark of state.course.marks) {
          for (const circ of (mark.body || [{ x: mark.x, y: mark.y, r: 12 }])) {
            const res = satPolygonCircle(poly, circ, circ.r);
            if (res) {
                if (window.onRaceEvent && state.race.status === 'racing') window.onRaceEvent('collision_mark', { boat });

                // Store Collision Data for AI
                if (boat.ai) {
                    boat.ai.collisionData = { type: 'mark', normal: res.axis };
                }

                // Direction: axis points from Poly to Circle
                // We want to move Poly away from Circle, so move opposite to axis
                boat.x -= res.axis.x * res.overlap;
                boat.y -= res.axis.y * res.overlap;

                // Physics
                const nx = res.axis.x, ny = res.axis.y;
                const hx = Math.sin(boat.heading), hy = -Math.cos(boat.heading);
                // Impact: Heading vs Normal (Boat -> Mark)
                const impact = Math.max(0, hx * nx + hy * ny);

                const friction = 0.99;
                let impactFactor = 0.5;
                if (boat.controller && boat.controller.livenessState === 'force') impactFactor = 0.9; // Slide off marks

                boat.speed *= (friction - (friction - impactFactor) * impact);

                if (state.race.status === 'racing') triggerPenalty(boat, { rule: 'Rule 31', reason: 'Touched a Mark', kind: 'contact' });
                // One response per MARK, not per circle: hitting a committee boat is
                // one Rule 31 touch, however many circles of its capsule you are in.
                break;
            }
          }
        }
    }
}

function checkNearMisses(dt) {
    const player = state.boats[0];
    if (state.race.status === 'finished' || player.raceState.finished) return;

    for (let i = 1; i < state.boats.length; i++) {
        const ai = state.boats[i];
        if (ai.raceState.finished) continue;

        const distSq = (player.x - ai.x)**2 + (player.y - ai.y)**2;
        const dist = Math.sqrt(distSq);

        if (dist < 100) {
            if (dist < ai.playerProximity.minD) {
                ai.playerProximity.minD = dist;
            }
            ai.playerProximity.close = true;
        } else {
            if (ai.playerProximity.close) {
                if (ai.playerProximity.minD < 60 && ai.playerProximity.minD > 20) {
                     if (!player.raceState.penalty && !ai.raceState.penalty) {
                         const res = getRightOfWay(player, ai);
                         if (res.boat === player) {
                             Sayings.queueQuote(ai, "narrowly_avoided_collision");
                         } else {
                             Sayings.queueQuote(ai, "player_narrowly_avoided_collision");
                         }
                     }
                }
            }
            ai.playerProximity.close = false;
            ai.playerProximity.minD = Infinity;
        }
    }
}

function update(dt) {
    state.time += 0.24 * dt;
    const timeScale = dt * 60;

    if (window.Rules) window.Rules.update(dt);

    updateBaseWind(dt);
    updateGusts(dt);

    // Current Visuals (uniform current, or the river's spatial field)
    if (venueCurrent() || (state.race.conditions.current && state.race.conditions.current.speed > 0.1)) {
        // Spawn at a random point near the camera; visibility scales with the
        // LOCAL current there, so the river's midstream reads faster than the banks.
        const range = Math.max(canvas.width, canvas.height) * 1.5;
        const px = state.camera.x + (fxRand() - 0.5) * range;
        const py = state.camera.y + (fxRand() - 0.5) * range;
        const local = getCurrentAt(px, py);
        if (local && local.speed > 0.15) {
            const spawnChance = (0.2 + (local.speed / 3.0) * 0.5) * 0.25;
            if (fxRand() < spawnChance) {
                createParticle(px, py, 'current', { life: 1.0 + fxRand(), alpha: Math.min(1, local.speed / 1.5) });
            }
        }

        // Mark Wakes
        if (state.course.marks) {
            for (const m of state.course.marks) {
                const mc = getCurrentAt(m.x, m.y);
                if (mc && mc.speed > 0.15 && fxRand() < 0.3 * (mc.speed / 3.0)) {
                     // Mark is obstacle. Wake forms downstream.
                     const flowDir = mc.direction;
                     const offset = 12; // Radius
                     const wx = Math.sin(flowDir) * offset;
                     const wy = -Math.cos(flowDir) * offset;
                     createParticle(m.x + wx + (fxRand()-0.5)*10, m.y + wy + (fxRand()-0.5)*10, 'mark-wake', { life: 1.5, alpha: 0.5 * (mc.speed/3.0), scale: 0.8 });
                }
            }
        }
    }

    // Venue: drifting ice floes (Polar)
    updateIceFloes(dt);

    // Sound (the player's APPARENT wind — see Sound.playerWindSpeed). Whether the bed
    // should be heard at all is Sound.windAudible's business, not the loop's.
    Sound.updateWindSound(Sound.playerWindSpeed());

    // Global Race Timer
    if (state.race.status === 'prestart') {
        state.race.timer -= dt;
        if (state.race.timer <= 0) {
            state.race.status = 'racing';
            state.race.timer = 0;
            Sound.playStart();
            Sound.updateMusic();

            // Reset AI Stuck timers to prevent immediate recovery maneuvers
            for (const b of state.boats) {
                b.ai.stuckTimer = 0;
                b.ai.recoveryMode = false;
            }
        }
    } else if (state.race.status === 'racing') {
        state.race.timer += dt;

        // Calculate Cutoff Time (0.1875s per meter)
        // legLength is in units. 5 units = 1 meter.
        let totalDistMeters = (state.race.totalLegs * state.race.legLength) / 5;
        // A designed course carries its own limit — authored, or derived from the route
        // by VenueDoc.compile. `legs × legLength` only ever described a
        // windward-leeward; the island special case that used to live here was that
        // same gap patched for one venue, and it did not generalise to a course with
        // gates in it.
        const cutoffTime = (state.course.cutoff != null)
            ? state.course.cutoff : totalDistMeters * 0.1875;

        if (state.race.timer >= cutoffTime) { // Dynamic Cutoff
            state.race.status = 'finished';

            // Mark all active boats as DNF/DNS
            for (const boat of state.boats) {
                if (!boat.raceState.finished) {
                    boat.raceState.finished = true;
                    boat.raceState.finishTime = state.race.timer;

                    // If still on Leg 0 (Start), they count as DNS
                    if (boat.raceState.leg === 0) {
                        boat.raceState.resultStatus = 'DNS';
                    } else {
                        boat.raceState.resultStatus = 'DNF';
                    }
                }
            }

            if (state.camera.target === 'boat') {
                state.camera.target = 'finish';
                showResults();
            }
        }
    }

    // Update Boats
    for (const boat of state.boats) {
        updateBoat(boat, dt);
    }

    // Collisions
    checkBoatCollisions(dt);
    checkMarkCollisions(dt);
    checkIslandCollisions(dt);
    checkNearMisses(dt);

    // Sayings
    Sayings.update(dt);

    // Player Cam
    const player = state.boats[0];
    const camLerp = 1 - Math.pow(0.9, timeScale);
    if (state.camera.mode === 'heading') {
        let diff = normalizeAngle(player.heading - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    } else if (state.camera.mode === 'north') {
        let diff = normalizeAngle(0 - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    } else if (state.camera.mode === 'wind') {
        let diff = normalizeAngle(state.wind.direction - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    } else if (state.camera.mode === 'gate') {
        if (!player.raceState.finished) {
            let diff = normalizeAngle(player.raceState.nextWaypoint.angle - state.camera.rotation);
            state.camera.rotation += diff * camLerp;
        } else {
             let diff = normalizeAngle(player.heading - state.camera.rotation);
            state.camera.rotation += diff * camLerp;
        }
    }

    if (state.camera.messageTimer > 0) state.camera.messageTimer -= dt;
    if (state.camera.target === 'boat') {
        if (player.raceState.finished && player.fadeTimer <= 0) {
             state.camera.target = 'finish';
             showResults();
        } else {
            state.camera.x += (player.x - state.camera.x) * 0.1;
            state.camera.y += (player.y - state.camera.y) * 0.1;
        }
    } else if (state.camera.target === 'finish') {
        // Focus on Finish Line center
        let indices = finishMarks() || [0, 1];
        if (state.course.marks && state.course.marks.length >= 2) {
             const m1 = state.course.marks[indices[0]], m2 = state.course.marks[indices[1]];
             const tx = (m1.x+m2.x)/2, ty = (m1.y+m2.y)/2;
             state.camera.x += (tx - state.camera.x) * 0.05;
             state.camera.y += (ty - state.camera.y) * 0.05;
             // Rotate to face upwind (North, 0) for better view of finishers
             let diff = normalizeAngle(0 - state.camera.rotation);
             state.camera.rotation += diff * 0.05;
        }
    }

    // Particles
    const windDirX = Math.sin(state.wind.direction);
    const windDirY = -Math.cos(state.wind.direction);

    // Wakes: each boat carries a short tapered RIBBON trail (sampled stern
    // positions, ~1.5s of life — about half the old visual length) plus
    // sparse foam dots. The old 'wake-wave' particle streams lived ~11s and
    // are gone entirely; drawWakes renders the ribbons.
    if (state.race.status !== 'waiting') {
        for (const boat of state.boats) {
            if (!boat.wakeTrail) { boat.wakeTrail = []; boat.wakeSampleT = 0; }

            // Age + prune (all boats, including finished — trails fade out)
            for (const s2 of boat.wakeTrail) s2.age += dt;
            while (boat.wakeTrail.length && boat.wakeTrail[boat.wakeTrail.length - 1].age > 2.25) boat.wakeTrail.pop();

            if (boat.speed > 0.08 && !boat.raceState.finished) {
                const boatDX = Math.sin(boat.heading);
                const boatDY = -Math.cos(boat.heading);
                // Sample UNDER the aft hull (not at the transom) — the boat
                // sprite covers the ribbon origin, so the wake emerges from
                // beneath the hull instead of spurting off the stern
                const sternX = boat.x - boatDX * 12;
                const sternY = boat.y - boatDY * 12;
                const planing = boat.raceState.isPlaning;

                boat.wakeSampleT -= dt;
                if (boat.wakeSampleT <= 0) {
                    boat.wakeSampleT = 0.08;
                    boat.wakeTrail.unshift({ x: sternX, y: sternY, age: 0, str: Math.max(0, Math.min(1, (boat.speed - 0.05) / 1.45)) * (planing ? 1.3 : 1) });
                    if (boat.wakeTrail.length > 34) boat.wakeTrail.pop();
                }

                // Occasional foam blobs scattered ALONG the wake band (real
                // wakes break into patches); never point-spawned at the stern
                const str0 = boat.wakeTrail.length ? boat.wakeTrail[0].str : 0;
                if (boat.wakeTrail.length > 4 && fxRand() < (planing ? 0.22 : 0.10) * str0) {
                    const idx = 1 + Math.floor(fxRand() * Math.min(9, boat.wakeTrail.length - 2));
                    const p = boat.wakeTrail[idx];
                    const q = boat.wakeTrail[idx + 1];
                    const sdx = q.x - p.x, sdy = q.y - p.y;
                    const sl = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
                    const off = (fxRand() - 0.5) * 2 * (8 + p.age * 8);
                    createParticle(p.x + (-sdy / sl) * off, p.y + (sdx / sl) * off, 'wake', { scale: 0.7 + fxRand() * 0.9 });
                }
            }
        }
    }

    // ── WIND STREAKS: where a streak is BORN is the primary pressure cue ────────
    //
    // Real water tells you this by presence and absence. Below about six knots the
    // surface is glassy and there are no wind streaks at all; the along-wind lines
    // (Langmuir streaks) start showing in a moderate breeze and cover the water in a
    // fresh one. So a lull is drawn as BARE WATER, not as a dim streak — which is both
    // what a sailor actually sees and the only encoding that survives on a dark palette,
    // where "faint white" and "nothing" look identical anyway.
    //
    // Two independent gates, because they answer two different questions:
    //   absolute (`windiness`) — is there enough breeze here to mark the water at all?
    //   relative (`pressureAt`) — is this the windy side of THIS course?
    // Absolute alone would make a light venue uniformly bare and a fresh one uniformly
    // covered; relative alone would paint 7-knot swamp water like a squall.
    //
    // The old rule was `max(0.07, (rel - 0.85) * 1.6)` against the route-centroid wind.
    // On nine of the ten venues the wind field is spatially uniform, so `rel` was exactly
    // 1 everywhere and the floor was doing all the work: density was flat, and so was
    // every other channel. This layer varied nothing on nine venues and read the tenth
    // backwards.
    const spawnTries = 2;
    for (let s = 0; s < spawnTries; s++) {
        const range = Math.max(canvas.width, canvas.height) * 1.35;
        const sx = state.camera.x + (fxRand() - 0.5) * range;
        const sy = state.camera.y + (fxRand() - 0.5) * range;
        // A streak is a mark on the WATER, and this is the cheapest rejection — the plain
        // box around the camera laid them over headlands, bergs and the ice shelf, where
        // there is no water to mark.
        if (!Arena.contains(state.course.boundary, sx, sy, 0)) continue;
        if (!inMaskWater(sx, sy)) continue;
        const spd = getWindAt(sx, sy).speed;
        const windiness = Math.max(0, Math.min(1, (spd - STREAK_MIN_WIND) / 9));
        if (windiness <= 0) continue;                       // glassy: the water is not marked
        const t = pressureAt(spd);
        // Squared, so the windy side is unmistakably denser rather than slightly denser.
        // Capped well below saturation: at the top of Glacier Sound's ramp the first
        // tuning put ~300 streaks on screen and the fleet raced through a curtain. This
        // layer is the water talking, and it stays under the boats and the labels
        // (race-view.md §8) — ~2.5x the density of the light corner is plenty to read.
        // Capped for the same reason the other two channels are: density is the strongest
        // pressure cue AND the one that most easily becomes a curtain. The gradient below
        // the ceiling is what carries the reading; the ceiling is what keeps it readable.
        const _c = cometCfg();
        const chance = Math.min(STREAK_MAX_SPAWN, _c.dens0 + _c.dens1 * windiness * (0.3 + 0.7 * t * t));
        if (fxRand() >= chance) continue;
        createParticle(sx, sy, 'wind', {
            life: 1.0,
            jit: fxRand(),
            // Each streak rides at its own share of the true wind, in the same 0.6-0.9
            // band the puff cells use — so a streak inside a cat's-paw travels WITH it
            // instead of sliding through it. The spread is also the only source of
            // streak-to-streak LENGTH variety, and it stays inside that physical band:
            // 1.5x of scatter against the 1.9x the wind varies across Glacier Sound and
            // the 2.4x it varies between venues, so length still READS as wind speed
            // rather than becoming decoration on top of one.
            drift: 0.60 + fxRand() * 0.30,
            trail: [{ x: sx, y: sy }],
            trailT: 0,
            beach: 1,
            waterT: fxRand() * WIND_WATER_RECHECK
        });
    }
    updateParticles(dt);
    updateWindWaves(dt);
    updateSurf(dt);

    recordTrajectory(dt);
}

// HUMAN TRAJECTORY RECORDER (instrument, off by default — enable with
// localStorage.setItem('regatta_record','1')). Samples the player at 10Hz and
// auto-downloads a JSON when they finish (or the race ends). Read-only: no sim
// state or RNG is touched, so traces and evals are unaffected with the flag off.
// Near a rounding mark it also samples the 16 ring sectors THROUGH THE SAME
// GRID LENS the RL policy observes, plus rival positions, so human samples are
// comparable to policy observations. Uses: human-vs-bot segment diagnostics,
// BC warm-starts for crew/driver policies (see arctic-ai-campaign.md).
let recTraj = null, recFlag = false, recFlagCk = 0;
function recordTrajectory(dt) {
    try {
        // Off by default: the ONLY per-frame cost with the flag unset is this
        // countdown — the localStorage flag is re-read about once a second.
        if (--recFlagCk <= 0) {
            recFlagCk = 60;
            recFlag = localStorage.getItem('regatta_record') === '1';
        }
        if (!recFlag) return;
        const player = state.boats && state.boats.find(b => b.isPlayer);
        if (!player) return;
        const st = state.race.status;
        if ((st === 'prestart' || st === 'racing') && !player.raceState.finished) {
            if (!recTraj) recTraj = {
                venue: (typeof settings !== 'undefined' && settings.venue) || '?',
                started: new Date().toISOString(), legs: state.race.totalLegs,
                // Course meta so analysis needs nothing but this file: without
                // the mark position, distance-from-ring can't be derived offline.
                course: {
                    roundMark: state.course.roundMark ? {
                        x: Math.round(state.course.roundMark.x), y: Math.round(state.course.roundMark.y),
                        zone: Math.round(state.course.roundMark.zone),
                        reqSweep: +(state.course.roundMark.reqSweep || 0).toFixed(3),
                    } : null,
                    legLens: state.course.dmc && state.course.dmc.legs
                        ? state.course.dmc.legs.map(l => Math.round(l.length)) : [],
                    startLine: (() => { try {
                        return startLinePts().map(p => [Math.round(p.x), Math.round(p.y)]);
                    } catch (e) { return null; } })(),
                },
                // Floe hull polygons, body frame, recorded ONCE — with the
                // per-sample [id,x,y,spin] this gives exact extents at every
                // instant (bounding circles misstate clearance on long floes).
                floeHulls: (() => { try {
                    const h = {};
                    (state.course.islands || []).forEach((i2, idx) => {
                        if (i2.isFloe && i2.localHull)
                            h[idx] = i2.localHull.map(p => [Math.round(p.x), Math.round(p.y)]);
                    });
                    return h;
                } catch (e) { return null; } })(),
                events: [], // [t, type] — penalties and ice contacts
                format: ['t', 'phase', 'x', 'y', 'hdg', 'spd', 'windDir', 'windSpd',
                         'leg', 'sweep', 'armed', 'ringSect16(0clear3closing5lead8plug10hard)|0', 'rivals[x,y,hdg,spd,tack(1=stbd,-1=port)]',
                         'legProg(dmc-projection u)', 'floes<=1200u[hullId,x,y,spin,vx,vy]',
                         'giveWayN(<=600u rivals with ROW over player)', 'ocs', 'penaltyTurnsOwed',
                         'awa(signed rad)', 'aws', 'playerTack(1=stbd,-1=port)'],
                samples: [], acc: 0,
            };
            // Player penalty/contact events, timestamped — sampling can miss them.
            if (!window.__recEvWrapped) {
                window.__recEvWrapped = true;
                const inner = window.onRaceEvent;
                window.onRaceEvent = (ty, d) => {
                    try {
                        if (recTraj && d && d.boat && d.boat.isPlayer
                            && (ty === 'penalty' || ty === 'collision_island' || ty === 'collision_boundary'
                                || ty === 'collision_boat' || ty === 'collision_mark')
                            && recTraj.events.length < 2000) {
                            // Contact events fire per overlap frame — a sustained
                            // grind would flood the log. One entry per type per 0.5s.
                            const last = recTraj._evT && recTraj._evT[ty];
                            if (last == null || state.race.timer - last >= 0.5) {
                                (recTraj._evT = recTraj._evT || {})[ty] = state.race.timer;
                                const ev = [+state.race.timer.toFixed(1), ty];
                                if (ty === 'collision_boat' && d.other) ev.push(d.other.name);
                                if (ty === 'collision_island') ev.push(d.isFloe ? 'floe' : 'land');
                                recTraj.events.push(ev);
                            }
                        }
                    } catch (e) {}
                    return inner && inner(ty, d);
                };
            }
            recTraj.acc += dt;
            if (recTraj.acc < 0.1 || recTraj.samples.length > 18000) return;
            recTraj.acc = 0;
            const lw = getWindAt(player.x, player.y);
            const rm = state.course.roundMark, g = state.course.botGrid;
            let sect = 0;
            if (rm && g && Math.hypot(player.x - rm.x, player.y - rm.y) < rm.zone * 3) {
                sect = [];
                for (let k = 0; k < 16; k++) {
                    const a = k / 16 * Math.PI * 2;
                    const cc = g.cell(rm.x + Math.cos(a) * rm.zone * 1.1, rm.y + Math.sin(a) * rm.zone * 1.1);
                    const id = cc[1] * g.n + cc[0];
                    sect.push(g.at(cc[0], cc[1]) ? (g._futBlk && g._futBlk[id] ? 3 : 0)
                        : (g._soft && g._soft[id] === 1 ? 5 : g._soft && g._soft[id] === 2 ? 8 : 10));
                }
            }
            recTraj.samples.push([
                +state.race.timer.toFixed(2), st === 'prestart' ? 0 : 1,
                +player.x.toFixed(1), +player.y.toFixed(1),
                +player.heading.toFixed(4), +player.speed.toFixed(3),
                +lw.direction.toFixed(4), +lw.speed.toFixed(2),
                player.raceState.leg, +(player.raceState.roundSweep || 0).toFixed(3),
                player.raceState.roundArmed ? 1 : 0, sect,
                // Tack comes from Rules.getTack — the engine's OWN rights-of-way
                // input — so close crossings reconstruct exactly as adjudicated.
                state.boats.filter(b => !b.isPlayer && !b.raceState.finished)
                    .map(b => [Math.round(b.x), Math.round(b.y), +b.heading.toFixed(2), +b.speed.toFixed(2),
                               window.Rules ? window.Rules.getTack(b) : 0]),
                // Course progress: DMC projection onto the current leg — the join
                // key for aligning human and bot trajectories by position.
                (() => {
                    const lg = player.raceState.leg, dmc = state.course.dmc;
                    if (!dmc || !dmc.legs || !dmc.legs[lg]) return -1;
                    if (recTraj.hintLg !== lg) { recTraj.hint = null; recTraj.hintLg = lg; }
                    recTraj.hint = CoursePath.project(dmc.legs[lg], player.x, player.y, recTraj.hint);
                    return Math.round(recTraj.hint);
                })(),
                // Nearby moving-object state — NOT reconstructible offline (live
                // play is not seed-pinned), so it must be captured here.
                (state.course.islands || []).reduce((a, i2, idx) => {
                    if (i2.isFloe && Math.hypot(i2.x - player.x, i2.y - player.y) < 1200)
                        a.push([idx, Math.round(i2.x), Math.round(i2.y), +(i2.spin || 0).toFixed(3),
                                +(i2.driftVx || 0).toFixed(2), +(i2.driftVy || 0).toFixed(2)]);
                    return a;
                }, []),
                // RRS role: how many nearby rivals hold right of way over the
                // player — separates avoidance maneuvers from tactical ones.
                !window.Rules ? -1 : state.boats.reduce((n, b) => {
                    if (b.isPlayer || b.raceState.finished
                        || Math.hypot(b.x - player.x, b.y - player.y) > 600) return n;
                    const r = window.Rules.getRightOfWay(player, b);
                    return n + (r && r.boat === b ? 1 : 0);
                }, 0),
                // Obligation state: OCS and owed penalty turns mark the windows
                // where the trajectory is rules-driven, not preference-driven.
                player.raceState.ocs ? 1 : 0,
                player.raceState.penaltyTurnsOwed || 0,
                // Apparent wind FROM THE MODEL (leeway included) — not exactly
                // derivable offline from true wind + heading + scalar speed.
                player.apparentWind ? +normalizeAngle(player.apparentWind.direction - player.heading).toFixed(3) : 0,
                player.apparentWind ? +player.apparentWind.speed.toFixed(2) : -1,
                window.Rules ? window.Rules.getTack(player) : 0,
            ]);
        } else if (recTraj && recTraj.samples.length > 50) {
            const t = recTraj; recTraj = null;
            t.finished = !!player.raceState.finished;
            t.finishTime = player.raceState.finishTime || null;
            delete t.acc;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(t)], { type: 'application/json' }));
            a.download = 'traj_' + t.venue + '_' + Date.now() + '.json';
            a.click(); URL.revokeObjectURL(a.href);
        } else if (recTraj) recTraj = null; // too short to keep (e.g. instant reset)
    } catch (e) { /* the recorder must never break the game */ }
}

function createParticle(x, y, type, props = {}) { state.particles.push({ x, y, type, life: 1.0, ...props }); }

function updateParticles(dt) {
    const timeScale = dt * 60;
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        if (p.vx) p.x += p.vx * timeScale;
        if (p.vy) p.y += p.vy * timeScale;
        let decay = 0.0025;
        if (p.type === 'wake') {
            decay = 0.009;
            const s = p.scale || 1.0;
            p.scaleVal = s + (1-p.life)*1.5;
            p.alpha = p.life*0.4;
        }
        else if (p.type === 'wake-wave') {
            decay = 0.0015;
            const s = p.scale || 1.0;
            p.scaleVal = (0.5 + (1-p.life)*3) * s;
            p.alpha = p.life*0.25;
        }
        else if (p.type === 'wind') {
             decay = 1 / (WIND_LIFE * 60);   // life 1 -> 0 over WIND_LIFE seconds
             const local = getWindAt(p.x, p.y);
             // THE GAME'S ONE CONVERSION: units/second = knots * 15 (a knot is 0.25
             // units/frame at 60fps, which is what boat.speed and the current both use).
             // This used to be `speed / 10` per frame — units/s = knots * 6, i.e. 0.40x
             // the true wind. The puff cells travel at 0.58-0.86x, so streaks visibly
             // lagged the cat's-paws they are supposed to be the texture of.
             const v = local.speed * 15 * p.drift * dt;
             p.x -= Math.sin(local.direction) * v;
             p.y += Math.cos(local.direction) * v;
             p.spd = local.speed;

             // THE COMET'S TAIL IS THE PARCEL'S OWN TRACK. Nothing is inferred: the streak
             // curves where the breeze bends, stretches where it blows harder and shortens
             // where it dies, because that is literally where this air has been. It cannot
             // point the wrong way, and its LENGTH reports wind speed for free — a fixed
             // window of time times the distance covered in it.
             p.trailT += dt;
             if (p.trailT >= WIND_TAIL_STEP) {
                 // Carry the overshoot rather than zeroing it, so the window really is
                 // WIND_TAIL_STEP and not "the next frame after it" — otherwise every tail
                 // is a frame-time longer than the speed it claims to report.
                 p.trailT -= WIND_TAIL_STEP;
                 p.trail.unshift({ x: p.x, y: p.y });
                 // ONE SPARE sample beyond the drawn window. The tail end is interpolated
                 // between the last two (see streakSpine), so dropping the oldest never
                 // moves anything that is on screen.
                 if (p.trail.length > WIND_TAIL_PTS + 1) p.trail.pop();
             }

             // ── REACHING THE BEACH ──────────────────────────────────────────────
             // A streak that drifts onto a berg or out of the arena stops being a mark on
             // water. Killing it outright made it BLINK OUT at full strength against the
             // shoreline — the eye is drawn straight to a disappearance, so a cull meant to
             // be invisible was the most conspicuous thing the layer did.
             //
             // So it fades, and it starts fading BEFORE it lands: the test point is thrown
             // ahead by exactly the distance this streak covers while it fades. Streaks
             // therefore die out approaching the shore and reach the sand already gone —
             // which is also what real streaks do in the lee of land.
             //
             // Rechecked on a stagger rather than every frame: this is a point-in-polygon
             // against every land shape, and it does not need 60Hz.
             p.waterT -= dt;
             if (p.waterT <= 0) {
                 p.waterT = WIND_WATER_RECHECK;
                 const look = local.speed * 15 * p.drift * WIND_BEACH_FADE;
                 const lx = p.x - Math.sin(local.direction) * look;
                 const ly = p.y + Math.cos(local.direction) * look;
                 if (!Arena.contains(state.course.boundary, lx, ly, 0) || !inMaskWater(lx, ly)) p.beached = true;
             }
             if (p.beached) {
                 p.beach -= dt / WIND_BEACH_FADE;
                 if (p.beach <= 0) p.life = 0;
             }
        } else if (p.type === 'current' || p.type === 'mark-wake') {
             const c = getCurrentAt(p.x, p.y);
             const speed = c ? c.speed : 0;
             const dir = c ? c.direction : 0;
             // Move with current (Game Units = Knots / 4)
             const moveSpeed = (speed / 4.0) * timeScale;
             p.x += Math.sin(dir) * moveSpeed;
             p.y -= Math.cos(dir) * moveSpeed;
        }

        p.life -= decay * timeScale;
        if (p.life <= 0) { state.particles[i] = state.particles[state.particles.length-1]; state.particles.pop(); }
    }
}

// Boat wakes: tapered two-tone ribbons along each boat's recent stern track —
// a soft outer band that widens and fades as it ages (wake spreading) with a
// brighter narrow core, plus two short V quarter-wave strokes at the stern.
// Clean filled shapes, no blur: fits the art style and replaces the old
// long-lived particle streams.
function drawWakes(ctx) {
    const camX = state.camera.x, camY = state.camera.y;
    const viewR2 = (Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 200) ** 2;
    const MAX_AGE = 2.25;

    ctx.save();
    for (const boat of state.boats) {
        const trail = boat.wakeTrail;
        if (!trail || trail.length < 2) continue;
        const dxv = boat.x - camX, dyv = boat.y - camY;
        if (dxv * dxv + dyv * dyv > viewR2) continue;

        // Per-segment quads so alpha/width can vary along the ribbon
        for (let pass = 0; pass < 2; pass++) {
            const wScale = pass === 0 ? 1 : 0.42;      // outer band, then bright core
            const aScale = pass === 0 ? 0.35 : 0.50;
            for (let i = 0; i < trail.length - 1; i++) {
                const a = trail[i], b = trail[i + 1];
                const segDX = b.x - a.x, segDY = b.y - a.y;
                const len = Math.sqrt(segDX * segDX + segDY * segDY);
                if (len < 0.5) continue;
                const nx = -segDY / len, ny = segDX / len;
                const wA = (9 + a.age * 6) * wScale * a.str;
                const wB = (9 + b.age * 6) * wScale * b.str;
                const alpha = Math.pow(1 - a.age / MAX_AGE, 1.25) * aScale * a.str;
                if (alpha <= 0.01) continue;
                ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(a.x + nx * wA, a.y + ny * wA);
                ctx.lineTo(b.x + nx * wB, b.y + ny * wB);
                ctx.lineTo(b.x - nx * wB, b.y - ny * wB);
                ctx.lineTo(a.x - nx * wA, a.y - ny * wA);
                ctx.closePath();
                ctx.fill();
            }
        }

    }
    ctx.restore();
}

// ── THE WIND-STREAK LAYER ───────────────────────────────────────────────────
// Below this the water is glassy and carries no along-wind streaks at all — real
// water starts showing them somewhere in a moderate breeze, and drawing a streak in
// four knots claims pressure that is not there. It is also what makes a lull legible:
// a lull is BARE WATER, which survives on a dark palette in a way that "dimmer white"
// never did.
const STREAK_MIN_WIND = 5.5;      // knots
const WIND_LIFE = 4.5;            // seconds a streak persists
const WIND_FADE_IN = 0.55;        // seconds — exactly the tail window, so a streak reaches
                                  // full strength at the same moment it reaches full length
const WIND_FADE_OUT = 1.3;        // seconds
const WIND_TAIL_PTS = 5;          // history samples behind the live head
const WIND_TAIL_STEP = 0.11;      // seconds between samples -> a 0.44-0.55s window of track
const WIND_WATER_RECHECK = 0.12;  // seconds between "am I still over water" tests

// ── THE GUARDRAILS ──────────────────────────────────────────────────────────
// The streak layer reports the wind field; it is never the subject of the frame. These are
// the ceilings no pressure reading, jitter roll, gust or venue document can push past —
// see the note in streakChannels for why they are clamps rather than coefficients.
const STREAK_MAX_ALPHA = 0.55;      // never opaque: boats, marks and labels stay on top
const STREAK_MAX_HALFWIDTH = 2.3;   // world units, so ~4.6 px across the head at 1:1
const STREAK_MAX_SPAWN = 0.20;      // per attempt, 2 attempts a frame — the density ceiling
const WIND_BEACH_FADE = 0.35;     // seconds to fade out on reaching land — and the
                                  // look-ahead, so the fade finishes AT the shore

// Pressure ramp, cool -> warm, after the LiveLine pressure overlay in
// guidelines/references/sailgp-halifax-pressure.jpg (teal -> yellow -> orange). Anchored
// to the COURSE's own p10/p90 (see computeWindPressureScale), not to absolute knots:
// what a player needs off this layer is "the pressure is over there", and 18 knots is a
// hole on one venue and a squall on another. Absolute wind is carried by the other two
// channels — how many streaks there are, and how long each one is.
//
// Deliberately NOT drawn from `palette.gusts`. Those tints are the venue's own WATER
// showing through a cat's-paw (race-view.md §8); this is the course talking to the
// player, and it stays one language across all ten venues so warm always means pressure.
const STREAK_LUT = (() => {
    // WARM, NOT ORANGE. The reference's hot end is a saturated orange, and at this
    // palette that is exactly the hull colour of four boats and the fill of every
    // inflatable mark — side by side, a streak and Cruz's topsides were the same swatch.
    // Backing the top stop off to gold keeps the cool->warm polarity (which is what
    // carries "more pressure") and separates from the fleet by SATURATION instead, which
    // is the right hierarchy anyway: the foreground is chromatic, the field is not.
    const stops = [
        [0.00, [136, 190, 228]],
        [0.45, [226, 240, 252]],
        [0.78, [255, 228, 158]],
        [1.00, [255, 198,  96]]
    ];
    const N = 48, lut = [];
    for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N;
        let a = stops[0], b = stops[stops.length - 1];
        for (let s = 0; s < stops.length - 1; s++) if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
        const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
        lut.push([0, 1, 2].map(k => Math.round(a[1][k] + (b[1][k] - a[1][k]) * f)));
    }
    return lut;
})();

// The three per-streak channels, in ONE place. The diagnostics read pressure off the same
// function the renderer draws with, so a probe can never quietly measure a formula the
// screen stopped using — which is exactly how the first pass reported half-width 1.4 on a
// layer that was drawing 2.0. Writes into a scratch object: this runs per streak per frame.
// Tunables, overridable from the console / a diagnostic as `window.__COMET`, the same way
// __START and __NAV work. Comparing two ramps by editing the file and reloading compares
// two different races as well as two different ramps.
const COMET = {
    // Thin and solid rather than broad and soft: a broad streak has to be faint to stay
    // under the fleet, and a faint broad streak is the shimmery, distracting thing.
    a0: 0.36, a1: 0.40, aPow: 1.2,   // alpha at the cold end, added at the hot end, its curve
    // ⚠️ HALVED Aug 2 2026 (was 1.8 / 2.1). The layer reads as pressure either way; at the
    // old width the streaks were competing with the boats for the eye rather than sitting
    // under them. STREAK_MAX_HALFWIDTH came down with them so the ceiling still bites.
    w0: 0.9,  w1: 1.05,              // half-width, same
    wLight: 0.50,                    // width multiplier in the lightest air the layer draws
    taper: 0.45,                     // body profile: 1 = straight cone, lower = holds width
    dens0: 0.035, dens1: 0.21        // spawn chance floor and pressure-weighted span
};
const cometCfg = () => (typeof window !== 'undefined' && window.__COMET) ? Object.assign({}, COMET, window.__COMET) : COMET;

const _streakCh = { alpha: 0, halfWidth: 0, color: null };
function streakChannels(t, jit, spd) {
    // The cold end has to be a MARK on the water, not a hairline. Light air is already
    // carried by there being fewer streaks and each one being shorter; if the survivors are
    // invisible too then a lull and a broken renderer look identical, which is the failure
    // the old layer had.
    const c = cometCfg();
    // ±20% of per-streak scatter on top. Nine of the ten venues state ONE uniform wind
    // region, so on those courses every streak carries an identical reading and the layer
    // tiles into wallpaper without it (race-view.md §8: vary spacing and length). Width and
    // alpha share `jit` deliberately — a heavier streak being both wider and brighter is
    // coherent, where independent rolls just look noisy.
    // WIDTH ANSWERS TO ABSOLUTE WIND AS WELL AS TO PRESSURE. `t` is relative to the
    // course, so on its own it made a 6.5-knot Gatorgrass streak exactly as fat as a
    // 16-knot Bluewater one — but length is absolute, so the light-air streak came out
    // half as long at the same width and read stubby. Scaling width with the breeze too
    // keeps a comet's SHAPE constant and lets its SIZE report the wind: fine, delicate
    // marks in light air, broad ones in a fresh breeze, which is how the water looks.
    const abs = Math.max(0, Math.min(1, (spd - STREAK_MIN_WIND) / 9));
    // ── THE CEILING IS A CLAMP, NOT A TUNING VALUE ──────────────────────────────
    // This layer is INFORMATION. It has to stay under the boats, the marks and the labels
    // (race-view.md §2, §8) no matter what a venue authors, and the arithmetic could reach
    // alpha 1.008 — a fully opaque streak — at the top of the ramp with a high jitter roll.
    // That top is not a rare corner either: `pressureAt` clamps at the course's p90, and a
    // gust pushes local wind straight past it, so every channel pins to maximum exactly
    // where the fleet is looking and exactly where the player most needs to see the boats.
    //
    // Clamped here rather than by choosing gentler coefficients, because a coefficient is a
    // number someone will later raise for a venue that "needs more" — and the failure it
    // produces is a wall of ink over a mark rounding. A clamp cannot be tuned past by
    // accident, and STREAK_MAX_* are the numbers to argue about if it ever must move.
    const rawAlpha = (c.a0 + c.a1 * Math.pow(t, c.aPow)) * (0.80 + jit * 0.40);
    const rawWidth = (c.w0 + c.w1 * t) * (c.wLight + (1 - c.wLight) * abs) * (0.80 + jit * 0.40);
    _streakCh.alpha = Math.min(STREAK_MAX_ALPHA, rawAlpha);
    _streakCh.halfWidth = Math.min(STREAK_MAX_HALFWIDTH, rawWidth);
    _streakCh.color = STREAK_LUT[Math.min(STREAK_LUT.length - 1, (t * STREAK_LUT.length) | 0)];
    return _streakCh;
}

// ── THE DRAWN SPINE: a tail that ends at a fixed AGE, not at a stored sample ─────────
//
// The track is sampled on a clock, so the oldest sample used to be dropped whole every
// WIND_TAIL_STEP and the tail tip jumped back a full segment each time — a visible twitch
// on every streak on screen, ten times a second. Keeping one spare sample past the window
// and interpolating the end point between the last two makes the tip SLIDE: the streak
// ends at exactly `WIND_TAIL_PTS * WIND_TAIL_STEP` seconds of age, always, and nothing on
// screen moves when a sample is retired.
//
// `u` is age/window rather than index/count, so the taper slides with it instead of
// re-spacing itself whenever the sample count changes. While the history is still filling,
// the window is whatever track exists — so a newborn streak grows smoothly out of its head.
// Scratch array, reused per streak: this runs for every streak, every frame.
const _spine = [];
for (let i = 0; i < WIND_TAIL_PTS + 2; i++) _spine.push({ x: 0, y: 0, u: 0 });
function streakSpine(p) {
    const trail = p.trail, len = trail.length, step = WIND_TAIL_STEP, frac = p.trailT;
    if (len < 2) return 0;
    const full = len > WIND_TAIL_PTS;
    const span = full ? WIND_TAIL_PTS * step : frac + (len - 1) * step;
    if (span <= 1e-6) return 0;
    let n = 0;
    let s = _spine[n++]; s.x = p.x; s.y = p.y; s.u = 0;
    const last = full ? WIND_TAIL_PTS - 1 : len - 1;
    for (let j = 0; j <= last; j++) {
        s = _spine[n++];
        s.x = trail[j].x; s.y = trail[j].y; s.u = (frac + j * step) / span;
    }
    if (full) {
        // f runs 1 -> 0 across each step, and at f = 1 it lands exactly on the sample that
        // was just retired — so the handover from "stored point" to "interpolated point"
        // is continuous in both position and width.
        const f = (step - frac) / step;
        const a = trail[WIND_TAIL_PTS - 1], b = trail[WIND_TAIL_PTS];
        s = _spine[n++];
        s.x = a.x + (b.x - a.x) * f; s.y = a.y + (b.y - a.y) * f; s.u = 1;
    }
    return n;
}

function drawParticles(ctx, layer) {
    // Viewport cull: with 10 boats laying wakes across the whole course,
    // hundreds of particles are off-screen at any moment — skip them before
    // touching the canvas. (Also skips the per-particle getWindAt/getCurrentAt
    // lookups for the culled ones.)
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 120;
    const viewR2 = viewR * viewR;
    const onScreen = (p) => {
        const dx = p.x - camX, dy = p.y - camY;
        return dx * dx + dy * dy < viewR2;
    };

    if (layer === 'current') {
        // Dark streamlines, tinted to the venue's water (river = deep green)
        ctx.strokeStyle = '#0640bf';
        ctx.lineWidth = 4;

        for (const p of state.particles) {
            if (p.type === 'current') {
                if (!onScreen(p)) continue;
                const c = getCurrentAt(p.x, p.y);
                const dir = c ? c.direction : 0;
                const len = 80 * (c ? Math.min(1, c.speed / 1.5) : 1);
                ctx.globalAlpha = p.alpha * 0.4; // Semi-transparent
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + Math.sin(dir) * len, p.y - Math.cos(dir) * len);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1.0;
    } else if (layer === 'surface') {
        ctx.fillStyle = '#ffffff';
        for (const p of state.particles) {
            if (p.type === 'wake' || p.type === 'wake-wave' || p.type === 'mark-wake') {
                if (!onScreen(p)) continue;
                ctx.globalAlpha = p.alpha;
                const s = p.scaleVal || p.scale || 1.0;
                ctx.beginPath(); ctx.arc(p.x, p.y, 3 * s, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;
    } else if (layer === 'air') {
        // ── WIND COMETS ────────────────────────────────────────────────────────
        //
        // A bright head with a tapering tail laid along the parcel's OWN TRACK. The
        // asymmetry gives direction; four channels give pressure, and every one of them
        // reads off `pressureAt`, so they cannot disagree with each other or with the
        // field the boats are sailing in:
        //
        //   DENSITY  how many streaks exist here — decided at spawn, the strongest cue
        //   LENGTH   distance covered in a fixed window of time, i.e. wind speed exactly
        //   WIDTH    the course's pressure ramp
        //   COLOUR   the same ramp, cool -> warm, after LiveLine's pressure overlay
        //
        // Direction and length are now facts rather than formulas: the comet is where the
        // air has been. The previous version drew a straight streak from a single sample
        // and a `34 + speed * 4.5` length — a 34-unit stub in dead calm, and a fixed
        // pedestal that squeezed 6-28 knots into a 1.6x length range.
        const windR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 320;
        const windR2 = windR * windR;
        for (const p of state.particles) {
            if (p.type !== 'wind') continue;
            const dxv = p.x - camX, dyv = p.y - camY;
            if (dxv * dxv + dyv * dyv > windR2) continue;
            const trail = p.trail;
            if (!trail || trail.length < 2) continue;

            const t = pressureAt(p.spd || 0);
            // Streaks arrive and leave. The fade-in also covers the half second the tail
            // takes to form, so a newborn stub is never seen. (The old envelope was
            // min(life, 1) on a life that STARTED above 1 — every streak snapped on at
            // full strength and only the death was animated.)
            const age = (1 - p.life) * WIND_LIFE, left = p.life * WIND_LIFE;
            const env = Math.min(1, age / WIND_FADE_IN, left / WIND_FADE_OUT, p.beach);
            if (env <= 0.02) continue;

            const ch = streakChannels(t, p.jit || 0.5, p.spd || 0);
            const alpha = env * ch.alpha, wH = ch.halfWidth, col = ch.color;

            const n = streakSpine(p);
            if (n < 2) continue;

            // One filled outline: down the left flank of the track, back up the right.
            // Half-width tapers to nothing at the end of the age window.
            const taper = cometCfg().taper;
            ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(3)})`;
            ctx.beginPath();
            for (let side = 0; side < 2; side++) {
                for (let k = 0; k < n; k++) {
                    const i = side === 0 ? k : n - 1 - k;
                    const a = _spine[i];
                    // Tangent from the neighbours, so the outline follows the bend
                    const b = _spine[Math.max(0, i - 1)], c = _spine[Math.min(n - 1, i + 1)];
                    let tx = c.x - b.x, ty = c.y - b.y;
                    const tl = Math.hypot(tx, ty) || 1;
                    tx /= tl; ty /= tl;
                    // Holds its width through the front half and then runs out to a point.
                    // A steeper taper (0.75 was the first try) gives a ball on a needle —
                    // all the mass in the head cap and a hairline behind it.
                    const w = wH * Math.pow(1 - a.u, taper) * (side === 0 ? 1 : -1);
                    const px2 = a.x - ty * w, py2 = a.y + tx * w;
                    if (side === 0 && k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
                }
            }
            ctx.closePath();
            ctx.fill();

            // Rounded head, brighter but still TINTED — the eye goes to the brightest
            // point of a comet, and forcing that point to pure white (as it was) threw
            // away the colour exactly where the pressure read is being taken.
            ctx.fillStyle = `rgba(${Math.min(255, col[0] + 24)},${Math.min(255, col[1] + 20)},${Math.min(255, col[2] + 16)},${(alpha * 1.1).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, wH * 0.82, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Drawing (Refactored for Boat object)
function drawBoat(ctx, boat) {
    if (boat.opacity !== undefined && boat.opacity <= 0) return;
    ctx.save();
    if (boat.opacity !== undefined) ctx.globalAlpha = boat.opacity;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(5, 5, 12, 28, 0, 0, Math.PI * 2); ctx.fill();

    // Hull (sprite, tinted with the paint job; vector fallback while loading)
    const hullColor = boat.colors.hull || '#f1f5f9';
    const hullSprite = getTintedBoatPart('hull', hullColor);
    if (hullSprite) {
        const u = 1024 / BOAT_SPRITE_SCALE;
        ctx.drawImage(hullSprite, -512 / BOAT_SPRITE_SCALE, -472 / BOAT_SPRITE_SCALE, u, u);
    } else {
        ctx.fillStyle = hullColor;
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.bezierCurveTo(18, -10, 18, 20, 12, 30);
        ctx.lineTo(-12, 30);
        ctx.bezierCurveTo(-18, 20, -18, -10, 0, -25);
        ctx.fill();
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Cockpit sole, wheel and mast
    const cockpitColor = boat.colors.cockpit;
    drawCockpitFittings(ctx, cockpitColor);

    // Sails
    const drawSailFunc = (isJib, scale = 1.0) => {
        ctx.save();
        if (isJib) { ctx.translate(0, -25); ctx.rotate(boat.sailAngle); }
        else { ctx.translate(0, -5); ctx.rotate(boat.sailAngle); }

        const sailColor = boat.colors.sail;
        ctx.globalAlpha = 0.9 * (boat.opacity !== undefined ? boat.opacity : 1.0);
        ctx.fillStyle = sailColor || '#ffffff';
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;

        const luff = boat.luffIntensity || 0;
        const angleRatio = Math.min(1.0, Math.abs(boat.sailAngle) / (Math.PI / 4));
        const flattenFactor = 0.6 + 0.4 * angleRatio;
        const baseDepth = (isJib ? 11 : 15) * scale * flattenFactor;
        let controlX = -boat.boomSide * baseDepth;
        if (luff > 0) {
             const currentDepth = baseDepth * (1.0 - luff * 0.8);
             const time = state.time * 30;
             const flutterAmt = Math.sin(time) * baseDepth * 1.5 * luff;
             controlX = (-boat.boomSide * currentDepth) + flutterAmt;
        }
        ctx.beginPath();
        if (isJib) { ctx.moveTo(0, 0); ctx.lineTo(0, 28 * scale); ctx.quadraticCurveTo(controlX, 14 * scale, 0, 0); }
        else { ctx.moveTo(0, 0); ctx.lineTo(0, 45); ctx.quadraticCurveTo(controlX, 20, 0, 0); }
        ctx.fill(); ctx.stroke();

        if (!isJib) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath();
            ctx.moveTo(0, 15); ctx.lineTo(controlX * 0.33, 12);
            ctx.moveTo(0, 30); ctx.lineTo(controlX * 0.6, 24);
            ctx.stroke();
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 45); ctx.stroke();
        }
        ctx.restore();
    };

    const drawSpinnaker = (scale = 1.0) => {
        ctx.save();
        ctx.translate(0, -28); ctx.rotate(boat.sailAngle);
        const spinColor = boat.colors.spinnaker;
        ctx.globalAlpha = 0.9 * (boat.opacity !== undefined ? boat.opacity : 1.0);
        ctx.fillStyle = spinColor || '#ef4444';
        ctx.strokeStyle = spinColor || '#ef4444';
        ctx.lineWidth = 1;

        const luff = boat.luffIntensity || 0;
        const baseDepth = 40 * scale;
        let controlX = -boat.boomSide * baseDepth;
        if (luff > 0) {
             const currentDepth = baseDepth * (1.0 - luff * 0.9);
             const time = state.time * 25;
             const flutterAmt = Math.sin(time) * baseDepth * 1.2 * luff;
             controlX = (-boat.boomSide * currentDepth) + flutterAmt;
        }
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 50 * scale); ctx.quadraticCurveTo(controlX, 25 * scale, 0, 0);
        ctx.fill(); ctx.stroke(); ctx.restore();
    };

    // Sprite sails: rotate at the tack like the vector sails, mirror the camber
    // to the leeward side, flatten as the sheet comes in, shear-flutter when
    // luffing, and scale about the tack for the jib<->spinnaker crossfade.
    const drawSailSprite = (part, tackY, color, scale) => {
        const sprite = part === 'spin'
            ? getSpinnakerSprite(
                boat.spinPattern || 'solid',
                color || '#ffffff',
                boat.colors.spinAccent || boat.colors.hull,
                boat.colors.spinAccent3)
            : getTintedBoatPart(part, color || '#ffffff');
        if (!sprite) return false;
        ctx.save();
        ctx.translate(0, tackY);
        ctx.rotate(boat.sailAngle);
        const luff = boat.luffIntensity || 0;
        const angleRatio = Math.min(1.0, Math.abs(boat.sailAngle) / (Math.PI / 4));
        // Floor the camber squash — a sail scaled too thin reads as a broken sliver
        const flatten = Math.max(0.5, (0.6 + 0.4 * angleRatio) * (1 - luff * 0.8));
        if (luff > 0) ctx.transform(1, 0, Math.sin(state.time * 30) * 0.3 * luff, 1, 0, 0);
        // boomSide lerps through 0 as the boom swings across in a tack/gybe —
        // use its sign for which side the camber bulges and floor the magnitude
        // so the sail keeps its body mid-swing instead of collapsing to a line
        const side = boat.boomSide < 0 ? -1 : 1;
        const body = Math.max(0.7, Math.abs(boat.boomSide));
        ctx.scale(-side * body * flatten * scale, scale);
        ctx.globalAlpha = 0.9 * (boat.opacity !== undefined ? boat.opacity : 1.0);
        const u = 1024 / BOAT_SPRITE_SCALE;
        ctx.drawImage(sprite, -512 / BOAT_SPRITE_SCALE, -112 / BOAT_SPRITE_SCALE, u, u);
        ctx.restore();
        return true;
    };
    const sailColor = boat.colors.sail;
    const spinColor = boat.colors.spinnaker;

    if (!drawSailSprite('main', -5, sailColor, 1)) drawSailFunc(false);
    const progress = boat.spinnakerDeployProgress;
    const jibScale = Math.max(0, 1 - progress * 2);
    const spinScale = Math.max(0, (progress - 0.5) * 2);
    if (jibScale > 0.01 && !drawSailSprite('jib', -25, sailColor, jibScale)) drawSailFunc(true, jibScale);
    if (spinScale > 0.01 && !drawSailSprite('spin', -28, spinColor, spinScale)) drawSpinnaker(spinScale);

    // Masthead fly (wind pennant) — streams downwind with the APPARENT wind. You can
    // watch it swing forward as the boat accelerates ("the boat makes its own wind"),
    // and it's the realistic cue for trimming and reading the lift/header in a puff.
    // Player only: it is an instrument, and nine more fluttering ribbons made the
    // one that matters harder to pick out of the fleet.
    //
    // Drawn after the sails: a real fly sits above the rig, and underneath them
    // only ~25% of the ribbon survived at any point of sail. Anchored at the mast
    // rather than the stern — at the transom it reads as a burgee (decoration) and
    // sits in the boom clutter, where at the mast it lands where the eye already is.
    // Kept short so that being on top buys visibility without adding noise.
    if (boat.apparentWind && boat.isPlayer) {
        const rel = normalizeAngle(boat.apparentWind.direction - boat.heading);
        const fx = -Math.sin(rel), fy = Math.cos(rel); // streams to where wind blows TO (local frame)
        const px2 = -fy, py2 = fx; // perpendicular, for the flutter wave

        // Breeze 0..1 over the sailable range. Light air lets the ribbon fall into
        // slow, wide swings; as it builds, the fly pulls taut and shivers instead —
        // faster but tighter.
        //
        // state.time runs at 0.24 units/sec, so cycles/sec = freq * 0.24 / 2pi.
        // 68..158 is 2.6Hz drifting to 6.0Hz (the old flat 55 was 2.1Hz). Well
        // clear of the 60fps sampling limit, which starts to bite around 15Hz.
        const breeze = Math.min(1, Math.max(0, (boat.apparentWind.speed - 4) / 16));
        const len = 9 + 4 * breeze;
        const freq = 68 + 90 * breeze;
        const amp = 3.2 - 2.1 * breeze;

        // Phase is accumulated rather than computed as time*freq. With a frequency
        // that moves with the wind, that product lurches whenever the breeze shifts
        // — and the jump scales with elapsed race time, so it gets worse the longer
        // you sail. Integrating keeps the wave continuous across gusts and gybes.
        const dt = Math.min(0.1, Math.max(0, state.time - (boat.telltaleTime ?? state.time)));
        boat.telltaleTime = state.time;
        boat.telltalePhase = ((boat.telltalePhase ?? 0) + dt * freq) % (Math.PI * 2);
        const t = boat.telltalePhase;

        ctx.save();
        ctx.strokeStyle = settings.telltaleColor || '#fbbf24';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // Travelling wave down the ribbon, amplitude growing toward the free end
        ctx.beginPath();
        ctx.moveTo(0, -5);
        for (let i = 1; i <= 6; i++) {
            const f = i / 6;
            const wave = Math.sin(t - f * 4.5) * f * f * amp;
            ctx.lineTo(fx * len * f + px2 * wave, -5 + fy * len * f + py2 * wave);
        }
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function isConflictSoon(b1, b2) {
    const distSq = (b1.x - b2.x)**2 + (b1.y - b2.y)**2;
    if (distSq < 80*80) return true; // Very close/overlapping

    // Relative velocity
    // velocity is units per frame (1/60s)
    const vx = b1.velocity.x - b2.velocity.x; // Velocity of B1 relative to B2
    const vy = b1.velocity.y - b2.velocity.y;

    // Relative position of B1 from B2
    const px = b1.x - b2.x;
    const py = b1.y - b2.y;

    // Check if moving closer
    // d/dt (P.P) = 2 P.V
    const dot = px * vx + py * vy;

    // If dot > 0, distance is increasing (moving apart)
    if (dot >= 0) return false;

    // Time to CPA
    const vSq = vx*vx + vy*vy;
    if (vSq < 0.0001) return false;

    // t_cpa = -(P.V) / (V.V)
    const t = -dot / vSq;

    // Thresholds
    // 10 seconds = 600 frames at 60fps
    if (t > 600) return false;

    // CPA Distance
    // P_cpa = P + V*t
    const cpaX = px + vx * t;
    const cpaY = py + vy * t;
    const cpaDistSq = cpaX*cpaX + cpaY*cpaY;

    // 120 units is approx 3-4 boat lengths (safety margin)
    if (cpaDistSq < 120*120) return true;

    return false;
}

function drawRulesOverlay(ctx) {
    if (!state.showNavAids || !settings.penaltiesEnabled || state.race.status === 'finished') return;

    const checkDist = 400; // Increased range for visibility

    // Helper to draw triangle
    const drawTriangle = (boat, target, color) => {
        const dx = target.x - boat.x;
        const dy = target.y - boat.y;
        const angle = Math.atan2(dy, dx);

        // Calculate distance based on hull shape (elliptical approx)
        // Hull is roughly width=15 (rx=25 w/ pad), length=30 (ry=40 w/ pad)
        const dAngle = angle - boat.heading;
        const rx = 25, ry = 40;
        const lx = Math.cos(dAngle), ly = Math.sin(dAngle);
        const dist = (rx * ry) / Math.sqrt((ry * lx) ** 2 + (rx * ly) ** 2);

        const tx = boat.x + Math.cos(angle) * dist;
        const ty = boat.y + Math.sin(angle) * dist;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(angle);

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        // Pointing right (towards target)
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, 7);
        ctx.lineTo(-6, -7);
        ctx.closePath();

        ctx.fill();
        ctx.restore();
    };

    for (let i = 0; i < state.boats.length; i++) {
        const b1 = state.boats[i];
        for (let j = i + 1; j < state.boats.length; j++) {
            const b2 = state.boats[j];
            const distSq = (b1.x - b2.x)**2 + (b1.y - b2.y)**2;

            if (distSq < checkDist * checkDist && isConflictSoon(b1, b2)) {
                const res = getRightOfWay(b1, b2);
                if (res.boat) {
                    const winner = res.boat;
                    const loser = (winner === b1) ? b2 : b1;

                    if (res.rule === 'Rule 21') {
                        // Section D override — orange for OCS/penalty
                        drawTriangle(winner, loser, '#f59e0b');
                        drawTriangle(loser, winner, '#ef4444');
                    } else {
                        // Normal — green ROW, red give-way
                        drawTriangle(winner, loser, '#4ade80');
                        drawTriangle(loser, winner, '#ef4444');
                    }
                }
            }
        }
    }
}

// Course-overlay kit (SailGP-inspired): thin mint-teal geometry, dashed
// laylines, amber only for the active in-zone state, Saira italic labels.
const NAV_RGB = '64, 245, 200';

function drawRoundingArrows(ctx) {
    if (!state.showNavAids || !state.course || !state.course.marks || state.race.status === 'finished') return;

    // Player Leg determines what to show
    const player = state.boats[0];
    // No arrows on Start (0) or Finish (totalLegs)
    if (player.raceState.leg === 0 || player.raceState.leg >= state.race.totalLegs) return;

    // ISLAND ROUNDING: the active mark is ONE mark, so the arrow belongs on it. Every other
    // nav-aid here has an islandRound branch; this one did not, and `legMarks()` returns null
    // on a leg that rounds rather than crosses — so the `|| [0, 1]` fallback below reached for
    // the first two marks in the array, which are the START LINE. Crossing the start turned
    // the line you had just left into a phantom gate with rounding arcs on both ends, while
    // the mark you were actually sailing to had none.
    if (state.course.type === 'islandRound') {
        const e = routeLeg(player.raceState.leg);
        const rm = (e && e.kind === 'round' && e.mark) ? e.mark : null;
        if (!rm) return;
        // Leaving the mark to STARBOARD means the bearing angle increases (see the sweep test
        // in updateBoatRaceState) — and with y down, increasing angle is clockwise on screen,
        // which is `counterclockwise = false`. So port rounds are the ccw ones.
        const ccw = (rm.side === 'port');
        const R = Math.max(90, (rm.zone || 0) * 0.42);
        ctx.save();
        ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${NAV_RGB}, 0.85)`; ctx.fillStyle = `rgba(${NAV_RGB}, 0.85)`;
        ctx.translate(rm.x, rm.y);
        ctx.rotate(state.time * 8.0 * (ccw ? -1 : 1));
        const start = 0, end = Math.PI;
        ctx.beginPath(); ctx.arc(0, 0, R, start, end, ccw); ctx.stroke();
        ctx.translate(R * Math.cos(end), R * Math.sin(end));
        ctx.rotate(end + (ccw ? -Math.PI / 2 : Math.PI / 2));
        ctx.beginPath();
        ctx.moveTo(-10, -10); ctx.lineTo(10, 0); ctx.lineTo(-10, 10); ctx.lineTo(-6, 0); ctx.fill();
        ctx.restore();
        return;
    }

    // Rounding direction alternates with which end of the gate you take: at the
    // windward gate the first mark is left to port, at the leeward line it is the
    // second. Keyed on the route ROLE, not leg parity — leg 0 targets the start
    // line and must read as a leeward-style pair even though it is a beat.
    const amIdx = legMarks(player.raceState.leg) || [0, 1];
    const amWindward = (routeLeg(player.raceState.leg) || {}).role === 'windward';
    const activeMarks = amIdx.map((index, k) => ({ index, ccw: amWindward ? k === 0 : k === 1 }));

    ctx.save();
    ctx.lineWidth = 7; ctx.strokeStyle = `rgba(${NAV_RGB}, 0.85)`; ctx.fillStyle = `rgba(${NAV_RGB}, 0.85)`; ctx.lineCap = 'round';
    const windDir = state.wind.baseDirection;

    for (const item of activeMarks) {
        if (item.index >= state.course.marks.length) continue;
        const m = state.course.marks[item.index];
        ctx.save(); ctx.translate(m.x, m.y);
        let start, end, ccw = item.ccw;
        if (item.index === 0 || item.index === 2) { start = 0; end = Math.PI; } // Left
        else { start = Math.PI; end = 0; } // Right
        // Invert if Upwind Gate vs Leeward Gate direction?
        // Mark 2 (Left Upwind): Round CCW. 0->PI. Correct.
        // Mark 3 (Right Upwind): Round CW. PI->0. Correct.
        // Mark 0 (Left Leeward): Round CW. 0->PI.
        if (item.index === 0) ccw = false; // Override for Leeward Left
        if (item.index === 1) ccw = true; // Override for Leeward Right

        const anim = state.time * 8.0 * (ccw ? -1 : 1);
        ctx.rotate(windDir + anim);
        ctx.beginPath(); ctx.arc(0, 0, 80, start, end, ccw); ctx.stroke();
        const tipX = 80 * Math.cos(end), tipY = 80 * Math.sin(end);
        let tangent = end + (ccw ? -Math.PI/2 : Math.PI/2);
        ctx.translate(tipX, tipY); ctx.rotate(tangent);
        ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 0); ctx.lineTo(-10, 10); ctx.lineTo(-6, 0); ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}

// ... Reused standard draw functions ...
function drawActiveGateLine(ctx) {
    const player = state.boats[0];
    const finished = state.race.status === 'finished' || player.raceState.finished;
    const leg = player.raceState.leg;
    const totalLegs = state.race.totalLegs;

    // One crossing line, with the shared treatment: bright when it is what the player is
    // being asked for, slate furniture otherwise, label facing the approaching racer.
    const drawLine = (indices, target, color, label, dir) => {
        const m1 = state.course.marks[indices[0]], m2 = state.course.marks[indices[1]];
        if (!m1 || !m2) return;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y);
        ctx.shadowColor = color; ctx.shadowBlur = target ? 15 : 0;
        ctx.strokeStyle = color; ctx.lineWidth = target ? 5 : 3;
        ctx.globalAlpha = target ? 1 : 0.4;
        ctx.lineDashOffset = -state.time * 20; ctx.stroke();
        if (label) {
            ctx.fillStyle = color; ctx.font = FONT.display(24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            // Face approaching racers: the text's top points in the direction of travel
            // through the line — the crossing normal n = (dy, -dx) times the entry's own
            // crossing sign. (This used to look up "the other gate" as marks[2]/[3] —
            // which do not exist on a course with one line and a rounding, so it read
            // undefined and crashed the whole draw.)
            const angle = Math.atan2(m2.y - m1.y, m2.x - m1.x);
            const tx = (m2.y - m1.y) * dir, ty = -(m2.x - m1.x) * dir;
            ctx.translate((m1.x + m2.x) / 2, (m1.y + m2.y) / 2);
            let rot = angle;
            if (Math.sin(rot) * tx - Math.cos(rot) * ty < 0) rot += Math.PI;
            ctx.rotate(rot); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.strokeText(label, 0, 0); ctx.fillText(label, 0, 0);
        }
        ctx.restore();
    };

    if (state.course.type === 'islandRound') {
        // A rounding course keeps its lines on the water for the whole race — they are
        // fixed furniture you will come back to. Read them off the ROUTE: on Glacier
        // Sound start and finish are the same pair; on Lighthouse Cove they are two
        // different lines, and BOTH draw — the finish permanently labelled so the two
        // can never be confused.
        const route = state.course.route || [];
        const startE = route[0] || {};
        const sIdx = startE.marks || [0, 1];
        const finE = route[totalLegs] || route[route.length - 1] || {};
        const fIdx = finE.marks || sIdx;
        const sameLine = fIdx[0] === sIdx[0] && fIdx[1] === sIdx[1];

        const finTarget = finished || leg >= totalLegs;
        if (sameLine) {
            // One line playing both roles — the original single-line logic.
            const target = finTarget || leg === 0;
            let color = '#ffffff';
            if (finished) color = '#4ade80';
            else if (leg === 0 && state.race.status === 'prestart') color = '#ef4444';
            // The same slate the greyed-out buoys use, so "not the thing you are sailing
            // to" looks the same whatever piece of furniture is saying it.
            else if (!target) color = '#94a3b8';
            const label = leg === 0 ? 'START' : (finTarget ? 'FINISH' : '');
            const dir = ((routeLeg(Math.min(leg, totalLegs)) || {}).dir) || 1;
            drawLine(sIdx, target, color, label, dir);
        } else {
            const startTarget = !finished && leg === 0;
            let sColor = '#94a3b8';
            if (startTarget) sColor = state.race.status === 'prestart' ? '#ef4444' : '#ffffff';
            drawLine(sIdx, startTarget, sColor, startTarget ? 'START' : '', startE.dir || 1);
            const fColor = finished ? '#4ade80' : (finTarget ? '#ffffff' : '#94a3b8');
            drawLine(fIdx, finTarget, fColor, 'FINISH', finE.dir || 1);
        }
        return;
    }

    // Windward-leeward: the line appears only when it is the thing to cross.
    let indices;
    if (finished) {
        indices = finishMarks() || [0, 1];
    } else {
        if (leg !== 0 && leg !== totalLegs) return;
        indices = legMarks(leg) || [0, 1];
    }
    let color = '#ffffff';
    if (finished) color = '#4ade80';
    else if (leg === 0 && state.race.status === 'prestart') color = '#ef4444';
    const label = (leg === 0 && !finished) ? 'START' : 'FINISH';
    const dir = ((routeLeg(Math.min(leg, totalLegs)) || {}).dir) || 1;
    drawLine(indices, true, color, label, dir);
}

function drawLadderLines(ctx) {
    const player = state.boats[0];
    if (!state.showNavAids || state.race.status === 'prestart' || state.race.status === 'finished' || player.raceState.finished) return;

    const _ax = courseAxis();
    if (!_ax) return;
    const c1x = _ax.start.x, c1y = _ax.start.y, c2x = _ax.windward.x, c2y = _ax.windward.y;
    const dx = _ax.dx, dy = _ax.dy, len = _ax.len;
    const wx = _ax.ux, wy = _ax.uy, px = -wy, py = wx;
    const courseAngle = Math.atan2(wx, -wy);

    // Ladder rungs span the course AXIS — from the leeward/start line to the
    // windward gate — so they are keyed on the two ends of the route, and flipped
    // by whether this leg is sailed up or down.
    const dnPair = (routeLeg(0) && routeLeg(0).marks) || [0, 1];
    const upPair = (routeLeg(1) && routeLeg(1).marks) || [2, 3];
    const goingUp = legGoesUpwind(player.raceState.leg);
    const nextPair = goingUp ? upPair : dnPair;
    const prevPair = goingUp ? dnPair : upPair;
    let prevIndex = prevPair[0];
    let nextIndex = nextPair[0];

    const mPrev = state.course.marks[prevIndex], mNext = state.course.marks[nextIndex];
    const startProj = mPrev.x*wx + mPrev.y*wy, endProj = mNext.x*wx + mNext.y*wy;
    let minP = Math.min(startProj, endProj), maxP = Math.max(startProj, endProj);

    const interval = 500;
    const firstLine = Math.floor(minP/interval)*interval;

    // Boundary & Laylines Projection logic same as before...
    const uL = mNext.x*wx + mNext.y*wy, vL = mNext.x*px + mNext.y*py;
    const mNextR = state.course.marks[nextPair[1]];
    const uR = mNextR.x*wx + mNextR.y*wy, vR = mNextR.x*px + mNextR.y*py;
    const b = state.course.boundary;
    const uC = b.x*wx + b.y*wy, vC = b.x*px + b.y*py, R = b.radius;

    const isUpwindTarget = goingUp;
    const delta = normalizeAngle(state.wind.direction - courseAngle);
    let slopeLeft = Math.tan(delta + Math.PI/4), slopeRight = Math.tan(delta - Math.PI/4);
    if (!isUpwindTarget) { slopeLeft = Math.tan(delta - Math.PI/4); slopeRight = Math.tan(delta + Math.PI/4); }

    ctx.save(); ctx.strokeStyle = `rgba(${NAV_RGB}, 0.5)`; ctx.lineWidth = 3;
    ctx.font = FONT.display(22); ctx.fillStyle = `rgba(${NAV_RGB}, 0.9)`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Labels lie along the rung itself (SailGP style), flipped to stay upright ON SCREEN
    // (the camera rotates, so the flip test must be in screen space, not world space)
    let labelAngle = Math.atan2(py, px);
    if (Math.abs(normalizeAngle(labelAngle - state.camera.rotation)) > Math.PI / 2) labelAngle += Math.PI;
    const toGateSign = (endProj > startProj) ? 1 : -1;
    const gateAngle = Math.atan2(toGateSign * wy, toGateSign * wx);

    for (let p = firstLine; p <= maxP; p+=interval) {
        if (p < minP) continue;
        if (Math.abs(p - endProj) < 1.0) continue;
        if (player.raceState.leg === 0 && Math.abs(p - startProj) < 1.0) continue;

        const dist = p - uL, distR = p - uR;
        const vMin = vL + dist * slopeLeft, vMax = vR + distR * slopeRight;
        const du = p - uC;
        if (Math.abs(du) >= R) continue;
        const dv = Math.sqrt(R*R - du*du);
        const finalMin = Math.max(vMin, vC - dv), finalMax = Math.min(vMax, vC + dv);

        if (finalMin < finalMax) {
            const cx = p*wx, cy = p*wy;
            const x1 = cx + finalMin*px, y1 = cy + finalMin*py;
            const x2 = cx + finalMax*px, y2 = cy + finalMax*py;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

            const distToGate = Math.abs(endProj - p) * 0.2;
            if (distToGate > 50) {
                 // Labels repeat at fixed world positions along the rung (static — the water
                 // moves past them), each with a chevron pointing toward the gate
                 const label = String(Math.round(distToGate));
                 const tw = ctx.measureText(label).width;
                 for (let v = Math.ceil((finalMin + 90) / 900) * 900; v <= finalMax - 90; v += 900) {
                     const lx = cx + v * px, ly = cy + v * py;
                     ctx.save();
                     ctx.translate(lx, ly);
                     ctx.rotate(labelAngle);
                     ctx.fillText(label, 0, -14);
                     ctx.translate(tw / 2 + 16, -14);
                     ctx.rotate(gateAngle - labelAngle);
                     ctx.beginPath();
                     ctx.moveTo(-4, -7); ctx.lineTo(4, 0); ctx.lineTo(-4, 7);
                     ctx.strokeStyle = `rgba(${NAV_RGB}, 0.9)`;
                     ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                     ctx.stroke();
                     ctx.restore();
                 }
            }
        }
    }
    ctx.restore();
}

// Is the target upwind of the boat? On a fixed course the legs are not
// alternating beats and runs, so this has to be measured rather than inferred
// from the leg number.
function isUpwindTo(boat, target) {
    const wx = Math.sin(state.wind.direction), wy = -Math.cos(state.wind.direction);
    const dx = target.x - boat.x, dy = target.y - boat.y;
    const l = Math.hypot(dx, dy) || 1;
    return ((dx / l) * wx + (dy / l) * wy) > 0;   // pointing into the wind
}

function drawLayLines(ctx) {
    if (!state.showNavAids || state.race.status === 'finished') return;
    const player = state.boats[0];

    // Island course: lay lines onto the ROUNDING MARK while outbound, and onto
    // the finish line coming home. There is no windward gate to index.
    if (state.course.type === 'islandRound') {
        // Laylines belong to the START only: they are the approach to the line
        // before the gun. The rounding is a single mark with a zone circle, and
        // the finish is a line you simply cross — neither wants laylines.
        if (player.raceState.leg !== 0) return;
        const pts = startLinePts();
        if (!pts[0] || !pts[1]) return;

        // ONE LAYLINE PER END, running back from that end, down and away from the line.
        //
        // Each end is laid on ONE tack — the starboard end on starboard, the port end on port
        // — so each gets that tack's layline and no other. Written as the ray that leans AWAY
        // from the other end, which is the same statement without needing to work out which
        // end is which: the two close-hauled angles are 90 degrees apart, and the one pointing
        // away from your neighbour is the tack that fetches you.
        //
        // So the pair DIVERGES. It used to take the ray leaning toward the other end, which is
        // the opposite tack at each end — two lines that cross below the middle of the line and
        // read as a big X over the fleet. Clipping that X at its crossing made a tidy wedge and
        // was still the wrong two lines.
        //
        // The wind is sampled AT EACH END, so a line lying across a gradient shows its skew.
        ctx.save(); ctx.lineWidth = 5.5;
        ctx.strokeStyle = `rgba(${NAV_RGB}, 0.72)`;
        for (let k = 0; k < pts.length; k++) {
            const m = pts[k], other = pts[k ^ 1];
            const wHere = getWindAt(m.x, m.y).direction;
            let tx = other.x - m.x, ty = other.y - m.y;
            const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
            let best = null;
            for (const s of [-1, 1]) {
                const a = wHere + s * Math.PI / 4 + Math.PI;   // back down the close-hauled track
                const dx = Math.sin(a), dy = -Math.cos(a);
                const lean = dx * tx + dy * ty;
                if (!best || lean < best.lean) best = { dx, dy, lean };
            }
            const t = Arena.rayHit(state.course.boundary, m.x, m.y, best.dx, best.dy);
            if (t === null) continue;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(m.x + best.dx * t, m.y + best.dy * t);
            ctx.stroke();
        }
        ctx.restore();
        return;
    }

    let targets = legMarks(player.raceState.leg) || [0, 1];
    const isUpwind = legGoesUpwind(player.raceState.leg);
    const zoneRadius = (player.raceState.leg === 0 || player.raceState.leg === state.race.totalLegs) ? 0 : 165;

    ctx.save(); ctx.lineWidth = 5.5;
    for (const idx of targets) {
        const m = state.course.marks[idx];
        const ang1 = state.wind.direction + Math.PI/4, ang2 = state.wind.direction - Math.PI/4;
        const isLeft = (idx % 2 === 0);
        const drawRay = (angle) => {
            let da = angle + (isUpwind ? Math.PI : 0);
            const dx = Math.sin(da), dy = -Math.cos(da);
            const startX = m.x + dx*zoneRadius, startY = m.y + dy*zoneRadius;
            const t = Arena.rayHit(state.course.boundary, startX, startY, dx, dy);
            if (t !== null) {
                ctx.strokeStyle = `rgba(${NAV_RGB}, 0.72)`; ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(startX+dx*t, startY+dy*t); ctx.stroke();
            }
        };
        if (isUpwind) isLeft ? drawRay(ang1) : drawRay(ang2);
        else isLeft ? drawRay(ang2) : drawRay(ang1);
    }
    ctx.restore();
}

function drawMarkZones(ctx) {
    if (!state.showNavAids || state.race.status === 'finished') return;
    const player = state.boats[0];
    let active = [];

    // MARKS WITH NO BUOY. A rounding laid on an island, or a transit — there is nothing
    // physically there, so the indicator IS the mark: a ring and a cross, pulsing gently
    // so it reads as course information rather than as scenery.
    for (const m of state.course.marks) {
        if (m.kind !== 'none') continue;
        const pulse = 1 + Math.sin(state.time * 2.2 + m.x * 0.01) * 0.06;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.strokeStyle = `rgba(${NAV_RGB}, 0.75)`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-30, 0); ctx.lineTo(-12, 0);
        ctx.moveTo(12, 0);  ctx.lineTo(30, 0);
        ctx.moveTo(0, -30); ctx.lineTo(0, -12);
        ctx.moveTo(0, 12);  ctx.lineTo(0, 30);
        ctx.stroke();
        ctx.restore();
    }

    // Rounding course: the zone circle belongs to whatever mark THIS leg rounds — read
    // it off the route entry, not off `roundMark`, which is only the first rounding of
    // the course. Keying on `leg !== 1` left Lighthouse Cove's legs 2-5 with no circle
    // at all, and always drawing `roundMark` put leg 1's circle on the wrong can.
    //
    // Drawn SOLID: the zone is hard course geometry, same as a gate's — the dashes read
    // as a suggestion. And amber the moment the hull is inside it, exactly like a gate.
    if (state.course.type === 'islandRound') {
        const e = routeLeg(player.raceState.leg);
        const rm = (e && e.kind === 'round' && e.mark) ? e.mark : null;
        if (!rm) return;
        const h = player.heading, sinH = Math.sin(h), cosH = Math.cos(h);
        const bowX = player.x + 25 * sinH, bowY = player.y - 25 * cosH;
        const sternX = player.x - 30 * sinH, sternY = player.y + 30 * cosH;
        const closest = getClosestPointOnSegment(rm.x, rm.y, bowX, bowY, sternX, sternY);
        const inZone = (closest.x - rm.x) ** 2 + (closest.y - rm.y) ** 2 < rm.zone * rm.zone;
        ctx.save();
        ctx.strokeStyle = inZone ? 'rgba(251, 191, 36, 0.95)' : `rgba(${NAV_RGB}, 0.55)`;
        ctx.lineWidth = inZone ? 5.5 : 5;
        ctx.beginPath(); ctx.arc(rm.x, rm.y, rm.zone, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        return;
    }

    // Exclude Start (0) and Finish (totalLegs)
    if (player.raceState.leg > 0 && player.raceState.leg < state.race.totalLegs) {
        active = legMarks(player.raceState.leg) || [];
    } else return;

    ctx.save();
    const h = player.heading, sinH = Math.sin(h), cosH = Math.cos(h);
    const bowX = player.x + 25*sinH, bowY = player.y - 25*cosH;
    const sternX = player.x - 30*sinH, sternY = player.y + 30*cosH;

    for (const idx of active) {
        const m = state.course.marks[idx];
        const closest = getClosestPointOnSegment(m.x, m.y, bowX, bowY, sternX, sternY);
        const distSq = (closest.x-m.x)**2 + (closest.y-m.y)**2;
        const inZone = distSq < 165*165;
        ctx.strokeStyle = inZone ? 'rgba(251, 191, 36, 0.95)' : `rgba(${NAV_RGB}, 0.68)`;
        ctx.lineWidth = inZone ? 5.5 : 4;
        ctx.beginPath(); ctx.arc(m.x, m.y, 165, 0, Math.PI*2); ctx.stroke();
    }

    // Flat GATE label on the water between the active gate marks
    const gA = state.course.marks[active[0]], gB = state.course.marks[active[1]];
    const gx = (gA.x + gB.x) / 2, gy = (gA.y + gB.y) / 2;
    const gAng = Math.atan2(gB.y - gA.y, gB.x - gA.x);
    ctx.save();
    ctx.translate(gx, gy);
    let rot = gAng; if (Math.abs(normalizeAngle(rot - state.camera.rotation)) > Math.PI / 2) rot += Math.PI;
    ctx.rotate(rot);
    ctx.font = FONT.display(52);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
    ctx.fillText('GATE ' + player.raceState.leg, 0, 0);
    ctx.restore();
    ctx.restore();
}

function updateWindWaves(dt) {
    const camX = state.camera.x;
    const camY = state.camera.y;
    const radius = Math.max(canvas.width, canvas.height) * 0.8;

    const gridSize = 150;

    const iStart = Math.floor((camX - radius) / gridSize);
    const iEnd = Math.floor((camX + radius) / gridSize);
    const jStart = Math.floor((camY - radius) / gridSize);
    const jEnd = Math.floor((camY + radius) / gridSize);

    const activeKeys = new Set();

    for (let j = jStart; j <= jEnd; j++) {
        for (let i = iStart; i <= iEnd; i++) {
             const key = `${i},${j}`;
             activeKeys.add(key);

             let wave = state.waveStates.get(key);
             if (!wave) {
                 const seed = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
                 const rand = seed - Math.floor(seed);

                 const bx = i * gridSize;
                 const by = j * gridSize;

                 const ox = (rand - 0.5) * gridSize * 0.6;
                 const oy = ((rand * 10 % 1) - 0.5) * gridSize * 0.6;

                 wave = {
                     x: bx + ox,
                     y: by + oy,
                     dist: rand * gridSize,
                     angle: 0,
                     speed: 0
                 };
                 // Stitched-crest geometry (reference look): seeded zigzag
                 // polyline with dash gaps, optional echo line, family tilt.
                 let s2 = ((Math.abs(Math.floor(seed * 1000)) % 2147483647) >>> 0) || 1;
                 const pr = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
                 const n = 5 + Math.floor(pr() * 5);
                 wave.pts = [];
                 for (let p = 0; p <= n; p++) wave.pts.push({ t: p / n, y: (pr() - 0.5) * 6 });
                 wave.gaps = [];
                 for (let p = 0; p < n; p++) wave.gaps.push(pr() < 0.78);
                 wave.echo = pr() < 0.35;
                 wave.echoOff = 4 + pr() * 4;
                 wave.tilt = (pr() - 0.5) * 0.5; // two loose crest families crossing
                 wave.lwj = 0.9 + pr() * 0.8;
                 state.waveStates.set(key, wave);
             }

             const wind = getWindAt(wave.x, wave.y);

             // Travel Speed: Proportional to wind speed
             const travelFactor = 3.0;
             const moveDist = wind.speed * travelFactor * dt;

             wave.dist = (wave.dist + moveDist) % gridSize;
             wave.angle = wind.direction + Math.PI;
             wave.windSpeed = wind.speed;
        }
    }

    // Prune
    for (const key of state.waveStates.keys()) {
        if (!activeKeys.has(key)) {
            state.waveStates.delete(key);
        }
    }
}

function drawWindWaves(ctx) {
    if (state.waveStates.size === 0) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineCap = 'round';

    for (const wave of state.waveStates.values()) {
        if (wave.windSpeed < 2) continue;

        const gridSize = 150;
        const cycle = wave.dist / gridSize;
        const alphaWave = Math.sin(cycle * Math.PI);

        // Size proportional to speed
        // 5 knots -> small, 25 knots -> large
        const size = wave.windSpeed * 4.5;

        // Opacity based on speed
        const intensity = Math.min(1.0, (wave.windSpeed - 2) / 20);

        ctx.globalAlpha = alphaWave * intensity * 0.75;
        ctx.lineWidth = (1.0 + intensity * 1.2) * (wave.lwj || 1);

        const dx = Math.sin(wave.angle) * wave.dist;
        const dy = -Math.cos(wave.angle) * wave.dist;

        ctx.save();
        ctx.translate(wave.x + dx, wave.y + dy);
        ctx.rotate(wave.angle + (wave.tilt || 0));

        const w = Math.max(26, Math.min(84, size));
        const pts = wave.pts, gaps = wave.gaps;
        if (pts) {
            for (let p = 0; p < gaps.length; p++) {
                if (!gaps[p]) continue;
                ctx.beginPath();
                ctx.moveTo((pts[p].t - 0.5) * w, pts[p].y);
                ctx.lineTo((pts[p + 1].t - 0.5) * w, pts[p + 1].y);
                ctx.stroke();
            }
            if (wave.echo) {
                ctx.globalAlpha *= 0.45;
                ctx.lineWidth *= 0.8;
                ctx.beginPath();
                ctx.moveTo((pts[1].t - 0.5) * w, pts[1].y + wave.echoOff);
                ctx.lineTo((pts[pts.length - 2].t - 0.5) * w, pts[pts.length - 2].y + wave.echoOff);
                ctx.stroke();
            }
        }

        ctx.restore();
    }
    ctx.restore();
}

// Draw Water (Waves) - Same as original
function drawWater(ctx) {
    if (window.WaterRenderer) {
        window.WaterRenderer.draw(ctx, state);
    }
}

// Puff/lull sprites: the radial gradient is baked ONCE per venue palette to an
// offscreen canvas, then each gust is a single drawImage. Building 25 fresh
// gradients + huge ellipse fills per frame was one of the biggest paint costs.
let GUST_SPRITES = null;
// ── A PUFF IS A PATCH OF DIFFERENT-COLOURED WATER, AND NOTHING ELSE ─────────
//
// A cat's-paw is the water going dark and rough; a hole is the water going glassy and
// pale. That is the whole visual. It does NOT get its own wind graphic — the wind it
// carries is already in the field, so the comet layer draws it: inside a puff the streaks
// run longer, wider, denser and warmer, because `getWindAt` says the wind there is
// stronger. Two layers drawing "wind" is two layers to reconcile, and they never agreed.
//
// Glacier Sound's puffs used to bake white flurry streaks along their own axis
// (`palette.gusts.snow`). They read as a second wind direction laid over the first, at a
// different angle from the comets, and they are gone. The field is the single source.
function bakeGustSprites() {
    const gc = activeGustColors;
    const make = (stops) => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g2 = c.getContext('2d');
        const grad = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
        for (const [pos, color] of stops) grad.addColorStop(pos, color);
        g2.fillStyle = grad;
        g2.fillRect(0, 0, 256, 256);
        return c;
    };
    GUST_SPRITES = {
        // Relative alpha profile is baked in; per-gust intensity is applied
        // via globalAlpha at draw time.
        gust: make([
            [0, `rgba(${gc.gustDark[0]}, ${gc.gustDark[1]}, ${gc.gustDark[2]}, 1)`],
            [0.55, `rgba(${gc.gustMid[0]}, ${gc.gustMid[1]}, ${gc.gustMid[2]}, 0.45)`],
            [1, `rgba(${gc.gustMid[0]}, ${gc.gustMid[1]}, ${gc.gustMid[2]}, 0)`]
        ]),
        lull: make([
            [0, `rgba(${gc.lullBright[0]}, ${gc.lullBright[1]}, ${gc.lullBright[2]}, 0.9)`],
            [0.55, `rgba(${gc.lullMid[0]}, ${gc.lullMid[1]}, ${gc.lullMid[2]}, 0.4)`],
            [1, `rgba(${gc.lullMid[0]}, ${gc.lullMid[1]}, ${gc.lullMid[2]}, 0)`]
        ])
    };
}

function drawGusts(ctx) {
    if (!GUST_SPRITES) bakeGustSprites();

    // Viewport cull: gusts live across the whole arena; most are off-screen.
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;

    for (const g of state.gusts) {
        const rmax = Math.max(g.radiusX, g.radiusY);
        const dx = g.x - camX, dy = g.y - camY;
        if (dx * dx + dy * dy > (viewR + rmax) ** 2) continue;

        // Intensity based on strength (speedDelta)
        const strength = Math.min(1.0, Math.abs(g.speedDelta) / (state.wind.baseSpeed * 0.5));
        // Light-air emphasis: the same 2kt puff is a huge % change in light air but
        // barely visible in a fresh breeze, so cat's-paws read strongest when it's
        // light and wash out as it builds (real water cue; matches eSail/AC sailing).
        const airCue = 1.0 + Math.max(0, (14 - state.wind.baseSpeed) / 14) * 0.9; // ~1.0 heavy -> ~1.9 light
        const alpha = Math.min(0.85, strength * 0.6 * airCue);
        if (alpha <= 0.01) continue;

        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.rotation);
        ctx.globalAlpha = alpha;
        // Shifted UPWIND by the same amount the field is skewed. After the rotate, local +x
        // is the along-wind axis the sampler calls rx, and the skewed cell's extent is
        // centred at -PUFF_SKEW * radiusX on it. Drawing the sprite on the nominal centre
        // instead would put the cat's-paw off the water the puff is felt on — and a puff you
        // can see but not feel where you see it is worse than no puff at all.
        ctx.drawImage(GUST_SPRITES[g.type === 'gust' ? 'gust' : 'lull'],
                      -g.radiusX - PUFF_SKEW * g.radiusX, -g.radiusY, g.radiusX * 2, g.radiusY * 2);
        ctx.restore();
    }
}

// ── SURF: the sea breaking on the shore it is running at ────────────────────
//
// Only the coast facing INTO the waves. race-view.md §9 is explicit that a shoreline must
// never be outlined with an identical white ribbon — a halo all the way round says nothing
// about the sea, and the whole point of surf is that it tells you which way the weather is
// coming from before you look at anything else. The lee shore stays glassy.
//
// It cannot live in the island bake (§5: islands blit from a sprite, no per-frame
// procedural detail) because WHICH shore is exposed depends on the wave direction, and on
// Glacier Sound that varies across the map and oscillates. So it is its own pass, drawn
// over the land the way the wakes and comets are.
//
// Strength reads the same field the comets do, so the two cannot disagree about the wind:
// a shore under the 28-knot katabatic corner breaks hard while the sheltered side is bare.
const SURF_MAX_ALPHA = 0.55;      // the same restraint the comet layer keeps: under the fleet
const SURF_MIN_WIND = 4;          // knots — below this the sea does not break
const SURF_REACH = 40;            // how far the crest runs in, world units — far
                                  // enough that the travel is legible, not a twitch
const SURF_STEP = 110;            // foam breaks at its own scale, not the coastline's —
                                  // long enough that a crest is a WAVE and not a tick mark
const SURF_BREAK = 0.88;          // where in the run-in the crest breaks: peak, then gone
const SURF_FOAM_BUDGET = 14;      // foam blobs per frame — a long coast must not flood

// Which way is OUT of this polygon? Winding is consistent around a ring, so this is one
// test per shape, cached — not one per edge per frame.
function surfOutwardSign(isl) {
    if (isl._outSign) return isl._outSign;
    // ⚠️ MEASURED, NOT DERIVED. The shoelace sign depends on winding AND on the y-axis
    // direction, and I got it wrong twice reasoning about it — once drawing no surf at all,
    // once drawing it on the lee shore. So: take a real edge, step off it by a hair along
    // the candidate normal, and ASK the polygon whether that point is inside. No sign
    // convention to get backwards.
    const v = isl.vertices;
    let sign = 1;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
        const a = v[j], b = v[i];
        const ex = b.x - a.x, ey = b.y - a.y;
        const len = Math.hypot(ex, ey);
        if (len < 8) continue;                       // too short to trust the normal
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const nx = ey / len, ny = -ex / len;
        const probe = Math.min(6, len * 0.25);
        const outIn = pointInPoly(mx + nx * probe, my + ny * probe, v);
        const inIn = pointInPoly(mx - nx * probe, my - ny * probe, v);
        if (outIn === inIn) continue;                // ambiguous here — try another edge
        sign = outIn ? -1 : 1;
        break;
    }
    isl._outSign = sign;
    return sign;
}

// ── FOAM LEFT BEHIND WHERE A CREST BREAKS ───────────────────────────────────
//
// ⚠️ THIS LIVES IN UPDATE, NOT IN drawSurf, and that is not a style preference. Spawning
// particles from the render path is the bug this codebase has already been bitten by: the
// spawn point is chosen near the camera, so the number of RNG draws depended on where you
// were looking, and race 2 in a session diverged from race 1. Particles get their own
// stream (fxRand) and are created from the simulation side. Breaking that rule here would
// reintroduce exactly that failure.
//
// A crest's phase is stateless — derived from `state.time` — so "did this one break since
// the last frame" is just: is p inside the slice the phase advanced through. No per-stretch
// bookkeeping, and it cannot double-fire or miss.
function updateSurf(dt) {
    if (!state.course.islands || settings.surf === false || dt <= 0) return;
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.max(canvas.width, canvas.height) * 0.7;
    const viewR2 = viewR * viewR;
    const t = state.time;
    let budget = SURF_FOAM_BUDGET;          // per frame, so a long coastline cannot flood

    for (const isl of state.course.islands) {
        if (budget <= 0) break;
        // NOT ON DRIFTING BERGS. A floe is a small object adrift on the water, not a coast:
        // surf round every one of Glacier Sound's 112 floes is fussy detail that fights the
        // fleet for attention, and they move, so it never settles. Fixed ice IS a shoreline
        // and keeps its breakers.
        if (isl.hidden || isl.isFloe || !isl.vertices || isl.vertices.length < 3) continue;
        const dxi = isl.x - camX, dyi = isl.y - camY;
        if (dxi * dxi + dyi * dyi > (viewR + isl.radius) ** 2) continue;
        const sgn = surfOutwardSign(isl), V = isl.vertices;

        for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
            if (budget <= 0) break;
            const a = V[j], b = V[i];
            const ex = b.x - a.x, ey = b.y - a.y;
            const len = Math.hypot(ex, ey);
            if (len < 12) continue;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            if ((mx - camX) ** 2 + (my - camY) ** 2 > viewR2) continue;

            const nx = (ey / len) * sgn, ny = (-ex / len) * sgn;
            const w = regionWindAt(mx, my);
            if (w.speed < SURF_MIN_WIND) continue;
            const face = -(nx * -Math.sin(w.direction) + ny * Math.cos(w.direction));
            if (face <= 0.02) continue;
            const power = face * face * Math.max(0, Math.min(1, (w.speed - SURF_MIN_WIND) / 12));
            if (power < 0.25) continue;                 // a gentle shore does not throw foam

            const hash = (u, w2) => { const h = Math.sin(u * 12.9898 + w2 * 78.233) * 43758.5453; return h - Math.floor(h); };
            const n = Math.max(1, Math.round(len / SURF_STEP));
            for (let k = 0; k < n && budget > 0; k++) {
                const u0 = k / n;
                const cx0 = a.x + ex * u0, cy0 = a.y + ey * u0;
                const r1 = hash(cx0, cy0), r2 = hash(cy0, cx0);
                if (r2 < 0.28) continue;
                const speed = 0.85 + power * 0.75;
                for (let c = 0; c < 2 && budget > 0; c++) {
                    const p = (t * speed + r1 + c * 0.5) % 1;
                    const step = speed * dt;
                    // Did this crest cross the break within the last frame?
                    if (p < SURF_BREAK || p >= SURF_BREAK + step) continue;
                    // Foam lands ON the beach, scattered along the crest it came off.
                    const along = 0.2 + fxRand() * 0.6;
                    const bx = a.x + ex * (u0 + along / n) + nx * SURF_REACH * 0.12;
                    const by = a.y + ey * (u0 + along / n) + ny * SURF_REACH * 0.12;
                    const blobs = 1 + (power > 0.6 ? 1 : 0);
                    for (let q = 0; q < blobs; q++) {
                        const sp = (fxRand() - 0.5) * SURF_STEP * 0.5;
                        createParticle(bx + (ex / len) * sp, by + (ey / len) * sp, 'wake',
                                       { scale: 0.8 + fxRand() * 1.5 * power });
                        budget--;
                    }
                }
            }
        }
    }
}

function drawSurf(ctx) {
    // Default ON: a saved settings blob from before this existed has no `surf` key, and
    // testing it truthily made the layer silently absent for every existing player.
    if (!state.course.islands || settings.surf === false) return;
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 120;
    const viewR2 = viewR * viewR;
    const t = state.time;

    ctx.save();
    ctx.lineCap = 'round';
    for (const isl of state.course.islands) {
        // NOT ON DRIFTING BERGS. A floe is a small object adrift on the water, not a coast:
        // surf round every one of Glacier Sound's 112 floes is fussy detail that fights the
        // fleet for attention, and they move, so it never settles. Fixed ice IS a shoreline
        // and keeps its breakers.
        if (isl.hidden || isl.isFloe || !isl.vertices || isl.vertices.length < 3) continue;
        const dxi = isl.x - camX, dyi = isl.y - camY;
        if (dxi * dxi + dyi * dyi > (viewR + isl.radius) ** 2) continue;
        const sgn = surfOutwardSign(isl);
        const v = isl.vertices;

        for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
            const a = v[j], b = v[i];
            const ex = b.x - a.x, ey = b.y - a.y;
            const len = Math.hypot(ex, ey);
            if (len < 4) continue;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            if ((mx - camX) ** 2 + (my - camY) ** 2 > viewR2) continue;

            // Outward normal of this edge.
            const nx = (ey / len) * sgn, ny = (-ex / len) * sgn;
            // The mean field, not getWindAt: surf is a large-scale feature and this runs per
            // edge — the puff loop and the lee recursion are not worth it here.
            const w = regionWindAt(mx, my);
            if (w.speed < SURF_MIN_WIND) continue;
            // Waves run with the wind: toward (-sin, +cos).
            const tx = -Math.sin(w.direction), ty = Math.cos(w.direction);
            // Facing the seas means the outward normal opposes their travel.
            const face = -(nx * tx + ny * ty);
            if (face <= 0.02) continue;

            // Squared, so the exposed shore is unmistakable and the shoulders fade out
            // instead of stopping dead at a corner.
            const power = face * face * Math.max(0, Math.min(1, (w.speed - SURF_MIN_WIND) / 12));
            // ⚠️ SUBDIVIDED, not one dash per authored edge. Glacier Sound's coast is 88
            // vertices over 13 km — edges average 500 units, so a dash per edge put ONE
            // stroke on screen. Foam breaks at its own scale, not the coastline's.
            //
            // ⚠️ AND THE CRESTS HAVE TO TRAVEL. Foam that only pulses in place reads as a
            // dashed BORDER however irregular you make it — the eye takes regular repetition
            // for a line style. What says "wave" is the motion: a crest forms well offshore
            // and RUNS IN, shoaling as it goes (shorter, wider, brighter) until it breaks on
            // the beach and is gone. That is the standard top-down treatment — distance from
            // shore drives the shape, and a direction vector animates it.
            //
            // Each stretch runs its own train of crests, offset by a position hash so
            // neighbours never break in step. The hash is stable, so foam does not crawl,
            // and it never touches an RNG stream.
            const hash = (u, w2) => {
                const h = Math.sin(u * 12.9898 + w2 * 78.233) * 43758.5453;
                return h - Math.floor(h);
            };
            const n = Math.max(1, Math.round(len / SURF_STEP));
            for (let k = 0; k < n; k++) {
                const u0 = k / n;
                const cx0 = a.x + ex * u0, cy0 = a.y + ey * u0;
                const r1 = hash(cx0, cy0), r2 = hash(cy0, cx0);
                // Bare stretches between the breaks. Without them the coast is a continuous
                // train of crests, which is the dashed-border read again at a larger size.
                if (r2 < 0.28) continue;

                // TWO crests in the water at once, half a cycle apart, so a set is arriving
                // while the last one is still washing up.
                for (let c = 0; c < 2; c++) {
                    // p: 0 just formed, well offshore — 1 broken on the beach.
                    //
                    // ⚠️ FAST. A crest crossing its run-in in three or four seconds does not
                    // read as a wave — it reads as a slowly brightening mark. Real surf
                    // arrives; the whole point of the motion is that you see it coming AND
                    // it gets there. At ~1 cycle a second a crest covers its stand-off in
                    // about the time it takes to say so, which is what sells it.
                    const speed = 0.85 + power * 0.75;
                    let p = (t * speed + r1 + c * 0.5) % 1;
                    // ⚠️ POSITION AND SHAPE ARE SEPARATE THINGS, and conflating them made a
                    // crest FADE IN WHERE IT SITS. Stand-off was `1 - p²`, which barely moves
                    // for the first third of the run — so the wave brightened from nothing
                    // while parked offshore and only then set off. A wave is moving before
                    // you can see it; it should already be running in as it appears.
                    //
                    // So travel is very nearly linear (a touch of ease near the beach, where a
                    // real crest does slow as it shoals), and `shoal` — which drives how
                    // gathered and steep it LOOKS — keeps its own curve.
                    const travel = Math.pow(1 - p, 1.15);
                    const shoal = p * p;
                    const off = SURF_REACH * travel * (0.9 + 0.5 * r2);
                    // ⚠️ THE ARC OF A WAVE: appear, BUILD, crash, gone. A symmetric hump
                    // peaks halfway through the run-in and is already fading by the time it
                    // reaches the beach — which is backwards, and reads as a mark brightening
                    // and dimming rather than as water arriving. A crest is faintest when it
                    // forms offshore, strongest at the instant it breaks, and then simply is
                    // not there any more.
                    const life = p < SURF_BREAK
                        ? Math.pow(p / SURF_BREAK, 0.75)                 // building as it comes in
                        : Math.pow(1 - (p - SURF_BREAK) / (1 - SURF_BREAK), 1.6);   // crashed, gone
                    const alpha = Math.min(SURF_MAX_ALPHA, power * life * 0.95);
                    if (alpha <= 0.02) continue;

                    // Long, with a clear gap to its neighbour: 55-85% of its stretch, so the
                    // eye reads a wave with water either side rather than a dotted line. It
                    // still gathers as it shoals — shorter and wider, the way a crest steepens.
                    const span = (0.55 + 0.30 * r1 - 0.10 * shoal) / n;
                    const s0 = u0, s1 = Math.min(1, u0 + span);
                    const p0x = a.x + ex * s0 + nx * off, p0y = a.y + ey * s0 + ny * off;
                    const p1x = a.x + ex * s1 + nx * off, p1y = a.y + ey * s1 + ny * off;
                    // ── SHAPED LIKE THE WIND CRESTS ─────────────────────────────
                    // Same vocabulary as drawWindWaves: a STITCHED polyline — jittered points
                    // drawn as separate segments with some skipped — rather than one smooth
                    // curve. A single clean arc is what kept reading as a drawn LINE; a
                    // broken, slightly ragged crest reads as water. Plus the faint echo
                    // trailing behind that the wind waves use to give a crest thickness
                    // without widening the stroke.
                    //
                    // Bowed seaward across the crest, jittered from a position hash so the
                    // raggedness is stable rather than boiling frame to frame.
                    const bow = SURF_REACH * 0.35 * (0.4 + 0.6 * r1) * (1 - shoal * 0.5);
                    const SEG = 5;
                    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                    const lw = 1.4 + power * 3.2 * (0.4 + shoal);
                    ctx.lineWidth = lw;
                    let px = 0, py = 0;
                    for (let q = 0; q <= SEG; q++) {
                        const f = q / SEG;
                        const jit = (hash(cx0 + q * 7.7, cy0 - q * 3.1) - 0.5) * SURF_REACH * 0.18;
                        const arch = Math.sin(f * Math.PI) * bow;
                        const qx = p0x + (p1x - p0x) * f + nx * (arch + jit);
                        const qy = p0y + (p1y - p0y) * f + ny * (arch + jit);
                        if (q > 0 && hash(cx0 + q * 2.3, cy0 + q * 5.9) > 0.22) {
                            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
                        }
                        px = qx; py = qy;
                    }
                    if (r1 > 0.45 && alpha > 0.12) {
                        const eo = SURF_REACH * 0.16 * (0.5 + shoal);
                        ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.45).toFixed(3)})`;
                        ctx.lineWidth = lw * 0.8;
                        ctx.beginPath();
                        ctx.moveTo(p0x + (p1x - p0x) * 0.2 + nx * eo, p0y + (p1y - p0y) * 0.2 + ny * eo);
                        ctx.lineTo(p0x + (p1x - p0x) * 0.8 + nx * eo, p0y + (p1y - p0y) * 0.8 + ny * eo);
                        ctx.stroke();
                    }
                }
            }
        }
    }
    ctx.restore();
}

function drawIslandShadows(ctx) {
    if (!state.course.islands) return;
    const windDir = state.wind.direction;
    const shadowAngle = Math.atan2(Math.cos(windDir), -Math.sin(windDir));

    // Viewport Culling
    const camX = state.camera.x;
    const camY = state.camera.y;
    // Approx viewport radius
    const viewRadius = Math.max(ctx.canvas.width, ctx.canvas.height);

    for (const isl of state.course.islands) {
        // Culling (Simple distance check including shadow length)
        const distSq = (isl.x - camX)**2 + (isl.y - camY)**2;
        if (distSq > (viewRadius + isl.radius * 9)**2) continue;

        ctx.save();
        ctx.translate(isl.x, isl.y);
        ctx.rotate(shadowAngle);

        const shadowLen = isl.radius * 5;
        const startWidth = isl.radius;
        const endWidth = isl.radius * (1.0 + shadowLen / 500);

        const grad = ctx.createLinearGradient(0, 0, shadowLen, 0);
        // Lull color: rgba(92, 201, 255, alpha)
        grad.addColorStop(0, 'rgba(92, 201, 255, 0.25)');
        grad.addColorStop(1, 'rgba(92, 201, 255, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -startWidth);
        ctx.lineTo(shadowLen, -endWidth);
        ctx.quadraticCurveTo(shadowLen + endWidth * 0.5, 0, shadowLen, endWidth);
        ctx.lineTo(0, startWidth);
        ctx.quadraticCurveTo(-startWidth * 0.5, 0, 0, -startWidth);
        ctx.fill();
        ctx.restore();
    }
}

function drawMarkShadows(ctx) {
    for (const m of state.course.marks) {
        if (m.kind === 'none') continue;          // nothing there to cast one
        ctx.save(); ctx.translate(m.drawX != null ? m.drawX : m.x, m.drawY != null ? m.drawY : m.y);
        // Sized to the mark's VISIBLE width (~29px at W=30), so it reads as a contact
        // shadow rather than a disc sticking out from under it. Cosmetic only.
        const body = m.body;
        if (body) {
            // A hull is not a disc: shadow the capsule, or the boat floats on a coin.
            ctx.rotate(m.heading || 0);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            for (const d of [-22, 0, 22]) { ctx.beginPath(); ctx.arc(3, -d + 3, 19, 0, Math.PI * 2); ctx.fill(); }
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(3, 3, 13, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}

function drawMarkBodies(ctx) {
    const player = state.boats[0];
    // EVERY mark in the array is part of the course. This used to skip all but the
    // first two on an island course, because `islandRound` parked two placeholder
    // marks that were not real — they are long gone, and the skip was hiding the
    // rounding mark itself once roundings became ordinary marks.
    for (let i = 0; i < state.course.marks.length; i++) {
        const m = state.course.marks[i];
        // A mark with no buoy is a POSITION — an island you round, a transit — so it
        // gets an indicator rather than a sprite. Drawn in drawMarkZones, which already
        // owns the "here is what the course asks of you" layer.
        if (m.kind === 'none') continue;
        const sp = markSprite(m.kind);
        // The sprite is fill-normalized at ingest, so the frame size IS the declared
        // world size and the art's own fill decides what you see: 30 -> ~29px for the
        // tetrahedron, 92 -> 37x85px for the committee boat.
        const W = sp.world, H = W * (sp.img.naturalHeight / (sp.img.naturalWidth || 1)) || W;
        // A committee boat is drawn at its outboard nudge, clear of the line; a buoy
        // sits on its point.
        ctx.save(); ctx.translate(m.drawX != null ? m.drawX : m.x, m.drawY != null ? m.drawY : m.y);
        // Very subtle bob: slow breathing scale + faint rotation wobble, phased
        // per mark by position (deterministic — no RNG in the render path)
        const phase = m.x * 0.013 + m.y * 0.007;
        const bob = 1 + Math.sin(state.time * 7 + phase) * 0.02;
        // gentle circular sway at anchor + a slow rotation wobble
        ctx.translate(Math.sin(state.time * 4.1 + phase) * 2.2, Math.cos(state.time * 3.4 + phase * 1.7) * 2.2);
        // A buoy has no "up", so its angle is an arbitrary per-position scramble. A
        // VESSEL has one, frozen by orientCourseMarks() from the line it defines — the
        // scramble would point a 30ft boat wherever its coordinates happened to land.
        // The wobble stays either way: on a hull it reads as lying to an anchor.
        const base = (m.heading != null) ? m.heading : (m.x * 7.3 + m.y * 3.1) % 6.283;
        ctx.rotate(base + Math.sin(state.time * 5.3 + phase) * 0.06);
        ctx.scale(bob, bob);

        let active = false;
        if (state.race.status !== 'finished') {
            const act = legMarks(player.raceState.leg) || [];
            if (act.indexOf(i) !== -1) active = true;
            // A ROUNDING leg has no `marks` pair — legMarks() is null — so the very mark
            // being rounded was failing this test and drawing grey while active.
            const e = routeLeg(player.raceState.leg);
            if (e && e.kind === 'round' && e.mark && e.mark.markIdx === i) active = true;
        }
        // The slate tint says "not the mark you are sailing to". That is a statement
        // about a piece of course furniture, and a crewed vessel is not one — a greyed
        // committee boat reads as a rendering fault, and its orange flag marks where the
        // line is for the whole race, not just while you are on the line. Vessels stay
        // in colour; buoys still grey out.
        if (m.body) active = true;

        if (sp.img.complete && sp.img.naturalWidth) {
            const img = active ? sp.img : (getMarkImgGray(m.kind) || sp.img);
            if (!active) ctx.globalAlpha = 0.92;
            ctx.drawImage(img, -W / 2, -H / 2, W, H);
        } else {
            // fallback while the sprite loads
            ctx.fillStyle = active ? '#f97316' : '#94a3b8';
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

// ── THE SAILING LIMIT ───────────────────────────────────────────────────────
// The club-branded band: a wide white stroke with the burgee and "Salty Critter Yacht Club"
// repeating along it. It used to be drawn as a CIRCLE of `b.radius` — which is the arena's
// BOUNDING circle, so on a designed course with a polygon arena it painted a huge ellipse
// well outside the water anyone could sail to, while the real limit was invisible.
//
// So it walks the RING instead. One polyline covers both shapes: a polygon uses its own
// points, a circle is sampled into some, and everything below — the band, the cull, the
// lettering — is arc-length work along that line. A circle therefore looks exactly as it did.
// Cached in a WeakMap rather than on the boundary itself: the compiled boundary is compared
// and serialised elsewhere, and a renderer has no business leaving fields on it.
const _ringCache = new WeakMap();
function boundaryRing(b) {
    const hit = _ringCache.get(b);
    if (hit) return hit;
    let pts;
    if (b.poly && b.poly.length >= 3) {
        pts = b.poly.map(p => ({ x: p[0], y: p[1] }));
        // Wound so the walk always goes the same way round. Text laid along a ring reads
        // upside down if the author happened to draw it the other way, and which way a
        // designer clicked out their arena is not something the lettering should depend on.
        let a2 = 0;
        for (let i = 0; i < pts.length; i++) {
            const q = pts[(i + 1) % pts.length];
            a2 += pts[i].x * q.y - q.x * pts[i].y;
        }
        if (a2 < 0) pts.reverse();
    } else {
        pts = [];
        const n = 96;                       // fine enough that the band reads as smooth
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            pts.push({ x: b.x + Math.cos(a) * b.radius, y: b.y + Math.sin(a) * b.radius });
        }
    }
    // Cumulative arc length, so a position along the perimeter is one lookup.
    const seg = [];
    let total = 0;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        const len = Math.hypot(q.x - p.x, q.y - p.y);
        seg.push({ p, q, len, at: total, ang: Math.atan2(q.y - p.y, q.x - p.x) });
        total += len;
    }
    const ring = { pts, seg, total };
    _ringCache.set(b, ring);
    return ring;
}

function drawBoundary(ctx) {
    const b = state.course.boundary;
    if (!b) return;
    const ring = boundaryRing(b);
    if (!ring || ring.total <= 0) return;

    // Viewport cull, per SEGMENT rather than per arc: mid-course most of the limit is off
    // screen, and the band plus its glow plus per-character lettering is not cheap.
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 260;
    const viewR2 = viewR * viewR;
    const nearCam = (p, q) => {
        const dx = q.x - p.x, dy = q.y - p.y;
        const l2 = dx * dx + dy * dy;
        let t = l2 ? ((camX - p.x) * dx + (camY - p.y) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = p.x + t * dx - camX, ey = p.y + t * dy - camY;
        return ex * ex + ey * ey < viewR2;
    };

    ctx.save();

    // The band. Only the visible runs are stroked, each as its own subpath so a gap in the
    // middle of the ring does not get closed across the course.
    //
    // ⚠️ THE HALO IS LAYERED STROKES, NOT `shadowBlur`. A blurred 80px stroke measured 1.72 ms
    // of a 1.89 ms visible boundary — 91% of it — and up to 7 ms on a venue with more of its
    // limit in view, which was half the frame. Canvas shadow is a full Gaussian pass over the
    // stroke's bounding box; three plain strokes of decreasing width and rising alpha give
    // the same soft white edge for the cost of three ordinary fills.
    //
    // Cheap because the path is built ONCE and stroked three times: the segment walk and the
    // cull below it do not repeat.
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    let open = false;
    for (const sg of ring.seg) {
        if (nearCam(sg.p, sg.q)) {
            if (!open) { ctx.moveTo(sg.p.x, sg.p.y); open = true; }
            ctx.lineTo(sg.q.x, sg.q.y);
        } else open = false;
    }
    for (const [w, a] of [[124, 0.13], [102, 0.30], [80, 1]]) {
        ctx.lineWidth = w;
        ctx.strokeStyle = a === 1 ? '#ffffff' : `rgba(255,255,255,${a})`;
        ctx.stroke();
    }

    // Where along the perimeter, and which way is the path pointing there.
    const atDist = (d) => {
        d = ((d % ring.total) + ring.total) % ring.total;
        let lo = 0, hi = ring.seg.length - 1;
        while (lo < hi) {                       // the segment containing d
            const mid = (lo + hi + 1) >> 1;
            if (ring.seg[mid].at <= d) lo = mid; else hi = mid - 1;
        }
        const sg = ring.seg[lo];
        const t = sg.len ? (d - sg.at) / sg.len : 0;
        return { x: sg.p.x + (sg.q.x - sg.p.x) * t, y: sg.p.y + (sg.q.y - sg.p.y) * t, ang: sg.ang };
    };

    const text = "Salty Critter Yacht Club";
    ctx.font = FONT.brand(50);
    ctx.textBaseline = 'middle';

    // Static text metrics: measure once, ever (was per-char per-frame)
    if (!drawBoundary._metrics || drawBoundary._metricsReady !== FONTS_READY) {
        const charWidths = [];
        let textWidth = 0;
        for (const char of text) {
            const w = ctx.measureText(char).width;
            charWidths.push(w);
            textWidth += w;
        }
        drawBoundary._metrics = { charWidths, textWidth };
        drawBoundary._metricsReady = FONTS_READY;
    }
    const charWidths = drawBoundary._metrics.charWidths;
    const textWidth = drawBoundary._metrics.textWidth;

    const imgH = 40;
    const imgW = imgH * (649 / 462);
    const gap = 60;
    const segmentLen = imgW + gap + textWidth + gap;

    // Whole repeats only, stretched to close exactly — otherwise the last one runs into the
    // first at whatever angle the ring happens to end on.
    const count = Math.max(1, Math.round(ring.total / segmentLen));
    const step = ring.total / count;

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';

    for (let i = 0; i < count; i++) {
        const base = i * step;
        // Cheap reject: if the middle of this repeat is far off screen, neither its burgee
        // nor its lettering can be on it.
        const mid = atDist(base + (imgW + gap + textWidth) / 2);
        const mdx = mid.x - camX, mdy = mid.y - camY;
        if (mdx * mdx + mdy * mdy > (viewR + segmentLen) ** 2) continue;

        const burgeeAt = atDist(base + imgW / 2);
        ctx.save();
        ctx.translate(burgeeAt.x, burgeeAt.y);
        ctx.rotate(burgeeAt.ang);
        if (burgeeImg.complete && burgeeImg.naturalWidth > 0) {
            ctx.drawImage(burgeeImg, -imgW / 2, -imgH / 2, imgW, imgH);
        }
        ctx.restore();

        let run = base + imgW + gap;
        for (let j = 0; j < text.length; j++) {
            const w = charWidths[j];
            const at = atDist(run + w / 2);
            ctx.save();
            ctx.translate(at.x, at.y);
            ctx.rotate(at.ang);
            ctx.fillText(text[j], 0, 0);
            ctx.restore();
            run += w;
        }
    }

    ctx.restore();
}

function drawMinimap() {
    if (!minimapCtx) { const c = document.getElementById('minimap'); if(c) minimapCtx = c.getContext('2d'); }
    const ctx = minimapCtx;
    if (!ctx || !state.boats.length) return;

    const width = ctx.canvas.width, height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);

    const player = state.boats[0];
    // Bounds centered on player but including marks?
    // Let's use logic from before: Bounds of marks + player
    let minX = player.x, maxX = player.x, minY = player.y, maxY = player.y;
    for (const m of state.course.marks) {
        minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x);
        minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y);
    }
    // Mask venues show the WHOLE map: the geography is authored and fixed, so a
    // minimap cropped to player+marks hides most of it and reads nothing like
    // the painted mask.
    if (state.course.doc) {
        // Follows the ARENA rather than MASK_WORLD, so it tracks a scaled map and a
        // polygon boundary instead of a constant that no longer describes either.
        const e = Arena.extent(state.course.boundary);
        minX = e.minX; maxX = e.maxX; minY = e.minY; maxY = e.maxY;
    }
    const pad = state.course.doc ? 0 : 200;
    minX-=pad; maxX+=pad; minY-=pad; maxY+=pad;
    const scale = (width - (state.course.doc ? 0 : 20)) / Math.max(maxX-minX, maxY-minY);
    const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
    const t = (x, y) => ({ x: (x-cx)*scale + width/2, y: (y-cy)*scale + height/2 });

    // Boundary (a designed course draws its own arena, so only a generated one needs this)
    const b = state.course.boundary;
    if (!state.course.doc) {
        const bp = t(b.x, b.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(bp.x, bp.y, b.radius*scale, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    }


    // ── PUFFS: WATER, SO THEY GO UNDER THE LAND ─────────────────────────────
    // Drawn here rather than after the islands, which is where they used to be — a puff
    // whose centre sits on a berg painted a violet blob across the ice, and a patch of
    // rough water on a glacier is not a thing. Land is painted next and covers them, the
    // same way the main view already handles it.
    //
    // Tinted from the venue's own `palette.gusts` rather than a hardcoded navy/cyan, so a
    // cat's-paw here is the same water it is out on the course (race-view.md §4, §8).
    const _gc = (typeof activeGustColors !== 'undefined' && activeGustColors) || null;
    if (_gc) for (const g of state.gusts) {
        const pos = t(g.x, g.y);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(g.rotation);
        ctx.scale(1, g.radiusY / g.radiusX);
        ctx.beginPath();
        // Same upwind shift as the main draw — the minimap is the one place you read the
        // whole fleet against the whole pressure field, so it is the last place the two
        // should disagree. (Drawn in the scaled frame, so the offset scales with it.)
        ctx.arc(-PUFF_SKEW * g.radiusX * scale, 0, g.radiusX * scale, 0, Math.PI * 2);
        const strength = Math.min(1.0, Math.abs(g.speedDelta) / (state.wind.baseSpeed * 0.5));
        const alpha = 0.12 + strength * 0.18;  // stays under the boats
        const c = g.type === 'gust' ? _gc.gustDark : _gc.lullBright;
        ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha.toFixed(3)})`;
        ctx.fill();
        ctx.restore();
    }

    // Islands (style-aware: ice reads as pale glacial blue, not land)
    const MINIMAP_ISLAND = {
        tropical: { body: '#fde6b1', top: '#84cc16' },
        grass:    { body: '#8a9a5b', top: '#4d7c0f' },
        ice:      { body: '#b8dcf5', top: '#f2f9ff' },
        redrock:  { body: '#c2703e', top: '#d98e57' },
        granite:  { body: '#4b5563', top: '#374151' }
    };
    if (state.course.islands) {
        // Body first
        for (const isl of state.course.islands) {
            if (isl.isBank || isl.hidden) continue;
            ctx.fillStyle = isl.fromMask
                ? (MINIMAP_ISLAND[isl.style] || MINIMAP_ISLAND.ice).top
                : (MINIMAP_ISLAND[isl.style] || MINIMAP_ISLAND.tropical).body;
            ctx.beginPath();
            if (isl.vertices.length > 0) {
                const p0 = t(isl.vertices[0].x, isl.vertices[0].y);
                ctx.moveTo(p0.x, p0.y);
                for(let i=1; i<isl.vertices.length; i++) {
                    const pi = t(isl.vertices[i].x, isl.vertices[i].y);
                    ctx.lineTo(pi.x, pi.y);
                }
            }
            ctx.closePath();
            // even-odd: mask rings are keyholed (the sound is a hole in the land)
            ctx.fill('evenodd');
        }
        // Center cap (vegetation on land, snow on ice)
        for (const isl of state.course.islands) {
            if (isl.isBank || isl.hidden) continue;
            // Mask shapes are keyholed; an inset "cap" ring is meaningless and
            // paints blobs across the water.
            if (isl.fromMask) continue;
            ctx.fillStyle = (MINIMAP_ISLAND[isl.style] || MINIMAP_ISLAND.tropical).top;
            ctx.beginPath();
            if (isl.vegVertices.length > 0) {
                const p0 = t(isl.vegVertices[0].x, isl.vegVertices[0].y);
                ctx.moveTo(p0.x, p0.y);
                for(let i=1; i<isl.vegVertices.length; i++) {
                    const pi = t(isl.vegVertices[i].x, isl.vegVertices[i].y);
                    ctx.lineTo(pi.x, pi.y);
                }
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    // Trace (Player Only)
    if (player.raceState.trace.length) {
         ctx.lineWidth = 1.5;
         // Draw whole trace
         // Simplify: Draw all points
         ctx.beginPath();
         const p0 = t(player.raceState.trace[0].x, player.raceState.trace[0].y);
         ctx.moveTo(p0.x, p0.y);
         for (const p of player.raceState.trace) {
             const tp = t(p.x, p.y);
             ctx.lineTo(tp.x, tp.y);
         }
         const curr = t(player.x, player.y);
         ctx.lineTo(curr.x, curr.y);
         ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
         ctx.stroke();
    }

    // ── WHERE TO GO NEXT ────────────────────────────────────────────────────
    //
    // This is what the minimap is FOR. Everything else on it — the coastline, the fleet,
    // the rest of the course — is context for one question, so the active target gets the
    // strongest treatment on the map and everything inactive gets out of its way.
    //
    // Two things were wrong. `legMarks()` returns null for a ROUNDING (a rounding entry
    // carries `markId`, not `marks`), so on an island course — Glacier Sound's whole race —
    // nothing was highlighted at all and the mark you were sailing to drew as one more grey
    // pip. And on a document venue every mark is scaled by 0.6, so even a gate's "active"
    // dot was 2.4px: emphasis that shrank exactly when the map got busy.
    const legNow = player.raceState.leg;
    const entry = routeLeg(legNow);
    const racing = state.race.status !== 'finished';
    const active = (racing && legMarks(legNow)) || [];
    const roundMark = (racing && entry && entry.kind === 'round') ? entry.mark : null;

    // Gates come from the ROUTE, not from the hardcoded pairs (0,1) and (2,3). A
    // course with one line and a rounding has no second gate, and reading marks[2]
    // on a two-mark course crashed the whole minimap.
    const drawG = (i1, i2, a) => {
        const m1 = state.course.marks[i1], m2 = state.course.marks[i2];
        if (!m1 || !m2) return;
        const p1 = t(m1.x, m1.y), p2 = t(m2.x, m2.y);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        // Inactive geometry is nearly gone. It still says "there is a gate here" for
        // orientation, and says nothing louder than that. MID-SLATE rather than a dim
        // white: this minimap is pale ice on Glacier Sound and deep blue on Lighthouse
        // Cove, and a near-white line at 0.14 disappears completely on the first one.
        ctx.strokeStyle = a ? '#fde047' : 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = a ? 2.5 : 1;
        ctx.stroke();
    };
    const drawn = {};
    for (const e of (state.course.route || [])) {
        if (!e.marks) continue;
        const key = e.marks.join(',');
        if (drawn[key]) continue;
        drawn[key] = true;
        drawG(e.marks[0], e.marks[1], active.indexOf(e.marks[0]) !== -1);
    }

    // Every other mark: small, cool and quiet.
    const mkR = state.course.doc ? 0.6 : 1;
    for (let i = 0; i < state.course.marks.length; i++) {
        if (active.includes(i)) continue;
        const m = state.course.marks[i];
        if (roundMark && m === roundMark) continue;
        const p = t(m.x, m.y);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.6 * mkR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)'; ctx.fill();
    }

    // ── THE BEACON ──────────────────────────────────────────────────────────
    // Drawn last so nothing buries it, and deliberately NOT scaled by `mkR` — the same
    // rule the player arrow follows: the one thing you are hunting for must not shrink
    // when the map gets harder to read. The halo PULSES, which makes it the only moving
    // thing on the map besides the boats; the eye goes to it without being told to.
    const beacon = (px, py, coreR) => {
        const pulse = 0.5 + 0.5 * Math.sin(state.time * 3.0);
        ctx.beginPath(); ctx.arc(px, py, coreR + 4 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(253, 224, 71, ${(0.30 + pulse * 0.45).toFixed(3)})`;
        ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, coreR, 0, Math.PI * 2);
        ctx.fillStyle = '#f97316'; ctx.fill();
        ctx.strokeStyle = '#0b1c2b'; ctx.lineWidth = 1.4; ctx.stroke();
    };
    for (const i of active) {
        const m = state.course.marks[i];
        if (m) { const p = t(m.x, m.y); beacon(p.x, p.y, 4.2); }
    }
    if (roundMark) {
        const p = t(roundMark.x, roundMark.y);
        // A rounding's zone is the thing you have to get inside, so draw it: the ring is
        // the instruction, not decoration. Floored in pixels so it survives a whole-map
        // venue where the real zone is a few pixels across.
        const zoneR = Math.max(9, (roundMark.zone || 0) * scale);
        ctx.beginPath(); ctx.arc(p.x, p.y, zoneR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
        ctx.lineWidth = 1.2; ctx.stroke();
        beacon(p.x, p.y, 4.6);
    }

    // Boats
    // Marker size. These were tuned when the minimap framed player+marks; a
    // mask venue shows the WHOLE map, where a fixed 8px arrow is a boat the size
    // of an island and the fleet becomes one coloured smear. Shrink to match.
    const mk = state.course.doc ? 0.55 : 1;

    // COMPETITORS ARE DOTS. Ten rotating triangles a few pixels tall encode a heading
    // nobody can read at this size — they just made the fleet a field of similar shapes
    // you had to pick your own arrow out of. A dot says the one thing a rival pip is for:
    // where they are. It also leaves the ARROW shape meaning exactly one thing on this
    // map, which is what makes the player findable at a glance.
    for (const boat of state.boats) {
        if (boat.isPlayer) continue;
        const pos = t(boat.x, boat.y);
        // Ink outline: hull colors alone don't separate from water or gust blobs
        // at this size, and dark hulls disappeared entirely.
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 4.6 * mk, 0, Math.PI * 2);
        ctx.fillStyle = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;
        ctx.fill();
        ctx.strokeStyle = 'rgba(11, 28, 43, 0.85)'; ctx.lineWidth = 1.4 * mk; ctx.stroke();
    }

    // THE PLAYER IS A LARGE WHITE ARROW — drawn last, so it is never buried under a rival.
    if (player) {
        const pos = t(player.x, player.y);
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(player.heading);

        // Deliberately NOT scaled by `mk`. The fleet shrinks on a whole-map venue so it
        // does not smear; the one marker you are hunting for must stay the same size, or
        // it shrinks exactly when the map gets hard to read.
        ctx.shadowBlur = 6 + Math.sin(state.time * 8) * 2;
        ctx.shadowColor = 'rgba(15, 30, 45, 0.95)';

        ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(8.5, 10); ctx.lineTo(0, 6); ctx.lineTo(-8.5, 10);
        ctx.closePath();
        // White, against a fleet of saturated hull colours. Shape and value both separate
        // it now, so it no longer needs the gold that used to be doing that job alone.
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#0b1c2b'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
    }
}

let frameCount = 0;

// ── DISTANCE MADE ON COURSE ─────────────────────────────────────────────────
// How far round the course a boat is, in world units, measured along the shared per-leg
// path (CoursePath in planner.js). Finished legs contribute their whole length; the
// current leg contributes the boat's furthest projection onto it.
//
// This is a RANKING number and the leaderboard's distance deltas. It is deliberately
// measured on the course, not on the water the boat actually sailed: two boats on
// opposite tacks up the same beat are then directly comparable, which is the entire
// reason the metric exists and is what race telemetry reports.
//
// The straight-axis version this replaces only worked on alternating windward/leeward
// courses. See the note on CoursePath for what it did to an island rounding.
function getBoatProgress(boat) {
    const rs = boat.raceState;
    const dmc = state.course && state.course.dmc;

    if (rs.finished) {
        // Finished boats rank by TIME, above everyone still racing. Kept as one comparable
        // scalar so the sort has a single key.
        const total = dmc ? dmc.total : (courseAxis() ? courseAxis().len * state.race.totalLegs : 1);
        return total + (1000000 - rs.finishTime);
    }

    if (!dmc || !dmc.legs.length) return legacyBoatProgress(boat);

    const leg = Math.max(0, Math.min(rs.leg, dmc.legs.length - 1));

    // Before the start there is no path yet — the fleet is milling about behind the line and
    // the leg-0 entry is the line itself, not a course to sail. Rank by closeness to it, so
    // the number is continuous through the gun (it reaches ~0 as the line is crossed, which
    // is where leg 1's path begins).
    if (rs.leg === 0) {
        const m = legMid(0);
        return m ? -Math.hypot(boat.x - m.x, boat.y - m.y) : 0;
    }

    const path = dmc.legs[leg];
    if (!path || !path.pts.length) return legacyBoatProgress(boat);
    // The reading continues from this boat's last one — see CoursePath.project. Reset when
    // the leg changes, because the new leg's arc lengths mean something else entirely.
    if (rs._dmcLeg !== leg) { rs._dmcLeg = leg; rs._dmcS = null; }
    const s = CoursePath.project(path, boat.x, boat.y, rs._dmcS);
    rs._dmcS = s;
    return path.base + s;
}

// The pre-DMC metric, kept as the fallback for a course whose paths could not be built
// (no route, or a planner failure). It is wrong on anything but a windward/leeward course,
// which is why it is a fallback and not the answer.
function legacyBoatProgress(boat) {
    const _ax = courseAxis();
    if (!_ax) return 0;
    const wx = _ax.ux, wy = _ax.uy;
    const L = _ax.len;
    const relP = (boat.x * wx + boat.y * wy) - (_ax.start.x * wx + _ax.start.y * wy);
    const leg = boat.raceState.leg;
    if (leg === 0) return relP;
    return legTargetsWindward(leg) ? (leg - 1) * L + relP : leg * L - relP;
}

// ── THE RESULTS SCREEN: "FINISH LINE" ───────────────────────────────────────
// YOUR finish is the headline; the fleet is one restrained table underneath it. The
// old screen gave all ten boats the same shouting treatment — ten skewed colour bars,
// ten 24px italic names, a white points wedge on each — so the one row a player
// actually looks for was the hardest thing on the page to find.
//
// COLOUR ONLY WHERE IT CARRIES A FACT: gold is you, the medal dot is the podium, red is
// a penalty, green is the fleet's fastest turn of speed. Everything else is grey, which
// is what lets a number be compared down a column.
//
// ⚠️ NO POINTS, NO STANDINGS, NO "NEXT RACE". All three are SERIES furniture and there is
// no series yet — points in a one-off race are the position column doing arithmetic, and
// a "next race" button has nowhere to go. They come back when a season does.
//
// ⚠️ THIS RUNS ~6 TIMES A SECOND while the overlay is open (updateLeaderboard hands over
// to it), because boats are often still finishing behind you. So the rows are built once
// per boat and patched; the hero and splits are rebuilt only when their signature changes.

// 1ST, 2ND, 3RD, 4TH… with the teens all TH.
function ordinalOf(n) {
    const t = n % 100;
    return n + ((t >= 11 && t <= 13) ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH'));
}

// Where a boat stands RIGHT NOW, in the leaderboard's own order. `lbRank` would be the
// free answer, but it is written by the render loop — a headless race never runs one, and
// the splits would then record "1ST" for everybody. Only ever called for the player, at a
// mark rounding, so the O(n) scan costs nothing.
//
// ⚠️ IT DELIBERATELY DOES NOT CALL `getBoatProgress`. That function is not a pure read: it
// stores a per-boat path-projection hint (`_dmcS`, and the leg it belongs to) so each
// reading continues from the last. Calling it for the whole fleet from inside the update
// pass — which is where a mark rounding happens — would advance those hints at a moment
// nothing else does, and the AI reads progress. A UI nicety must not be able to move the
// simulation. Distance to the next mark is already on every boat and reads the same order
// within a leg.
function fleetRank(boat) {
    const A = boat.raceState;
    let ahead = 1;
    for (const o of state.boats) {
        if (o === boat) continue;
        const B = o.raceState;
        if (B.finished !== A.finished) { if (B.finished) ahead++; continue; }
        if (A.finished) { if (B.finishTime < A.finishTime) ahead++; continue; }
        if (B.leg !== A.leg) { if (B.leg > A.leg) ahead++; continue; }
        if ((B.nextWaypoint.dist || 0) < (A.nextWaypoint.dist || 0)) ahead++;
    }
    return ahead;
}

// --- The player's own record book -------------------------------------------
// A single race has no standings to compare against, so the one honest superlative left
// is your own history at this venue.
//
// ⚠️ KEYED BY VENUE **AND LEG COUNT**. A two-leg race and a four-leg race around the same
// marks are not the same event, and a "best" that mixes them is a lie the first time
// someone shortens the course.
const RESULT_BESTS_KEY = 'regatta_bests';
function loadVenueBests() {
    try { return JSON.parse(localStorage.getItem(RESULT_BESTS_KEY)) || {}; } catch (e) { return {}; }
}
function venueBestKey(venue) { return `${venue || settings.venue}:${state.race.totalLegs}`; }

// TWO RECORDS, KEPT APART. A time and a finish are not the same achievement and do not
// move together: a light-air race you win can be a minute slower than a windy one you come
// eighth in, so hanging the place off the fastest time ("2nd · 4:12") reported a placing
// that had nothing to do with why the row was there. The clock is the record; the best
// finish is its own line, with the time it was set in so it stays a memory of a race.
//
// A stored best, normalised. ⚠️ Two older shapes still read: a bare number (the first
// version) and { t, pos } (the second, where `pos` was the place in the fastest race).
// That `pos` seeds `bestPos` — it is a real finish that really happened here.
function bestForVenue(venue) {
    const rec = loadVenueBests()[venueBestKey(venue)];
    if (typeof rec === 'number') return { t: rec, bestPos: 0, bestPosT: 0 };
    if (!rec || typeof rec.t !== 'number') return null;
    return {
        t: rec.t,
        bestPos: rec.bestPos || rec.pos || 0,
        bestPosT: rec.bestPosT || (rec.bestPos ? 0 : rec.t) || 0
    };
}

// Called once per race, from the first showResults() of that race — see `bestChecked`.
// Returns what there was to beat on each record, and whether this race beat it.
function recordVenueBest(seconds, pos) {
    const bests = loadVenueBests();
    const key = venueBestKey();
    const prev = bestForVenue();
    const previous = prev ? prev.t : null;
    const previousPos = (prev && prev.bestPos) ? prev.bestPos : null;

    const isBest = previous === null || seconds < previous;
    const isBestPos = !!pos && (previousPos === null || pos < previousPos);
    if (isBest || isBestPos) {
        bests[key] = {
            t: isBest ? seconds : previous,
            bestPos: isBestPos ? pos : (previousPos || 0),
            bestPosT: isBestPos ? seconds : (prev ? prev.bestPosT : 0)
        };
        // Same reasoning as saveSettings: a storage failure must not take the screen with
        // it. Losing a personal best is a nuisance; throwing here would blank the results.
        try { localStorage.setItem(RESULT_BESTS_KEY, JSON.stringify(bests)); } catch (e) { /* no store */ }
    }
    return { previous, isBest, previousPos, isBestPos };
}

// Distances are recorded in world units. 5 units = 1 metre (VenueDoc.U_PER_M), and a race
// is a couple of kilometres, so kilometres is the unit that reads without counting zeros.
function unitsToKm(u) { return u / 5 / 1000; }

const RES_MEDALS = ['#f2c14e', '#c8d3e3', '#c98a4b'];   // gold, silver, bronze

// OFF THE PODIUM THERE IS NO METAL. Fourth gets the page's own white — full weight, still
// the loudest thing on the screen, but not a fourth medal colour, because inventing one
// would say the game awards something for fourth. Not finishing is the table's own red,
// the colour DNF already wears in the results rows.
const RES_PLACE_PLAIN = '#eef3fb';
const RES_PLACE_DNF = '#f87171';
const placeColor = (pos, dnf) => dnf ? RES_PLACE_DNF : (RES_MEDALS[pos - 1] || RES_PLACE_PLAIN);

// 10 for a win, down to 1 for tenth. Position, not fleet size: a win is worth ten whoever
// turns up, and nobody who sailed the race scores nothing.
const POINTS_FOR_PLACE = (pos) => Math.max(1, 11 - pos);

// THE RULER IS THE RACE ITSELF: winner at the datum, last boat home at the far end, and
// everyone spaced between them. A fixed scale had to pick a number that suits every race
// and suits none — `eval/_gapspread.js` measured last place finishing anywhere from 35s to
// 107s back, so a 30s ruler stacked a third of the fleet against the end and a 60s one
// squeezed the close races into the first third. Fitting it to the fleet spends the whole
// column on the boats that are actually in it, and nothing ever pins.
//
// The price is that the scale changes race to race, so the header states it (see
// renderResultsHeader) — otherwise the picture would be unreadable between races.
function fleetGapScale() {
    const home = state.boats
        .filter(b => b.raceState.finished && !b.raceState.resultStatus)
        .map(b => b.raceState.finishTime);
    return home.length < 2 ? 0 : Math.max(...home) - Math.min(...home);
}

// The boat's own colour as a glow. `deepBandFor` already answers "which of these three
// colours IS this boat" and pins it to a luminance that reads on a dark page — a dark hull
// would otherwise glow black. All that is missing is the alpha.
function boatGlow(boat, alpha) {
    const c = deepBandFor(boat.colors.hull, boat.colors.spinnaker, boat.colors.spinAccent);
    const m = c.match(/\d+/g) || [148, 163, 184];
    return `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
}

// What the wind DID, measured off the player's masthead through the race (see updateBoat),
// rather than `state.wind.baseSpeed` — which is the field at ONE point and describes a
// course nobody sailed. Falls back to the forecast range if there is nothing observed,
// which is the DNS case: you cannot report a breeze you never went out in.
function observedWindText() {
    const p = state.boats.find(b => b.isPlayer) || state.boats[0];
    const rs = p && p.raceState;
    if (!rs || !rs.windObsN) return windRangeText();
    const lo = Math.round(rs.windObsMin), hi = Math.round(rs.windObsMax);
    return (hi - lo >= 2) ? `${lo}–${hi} kt observed`
                          : `${Math.round(rs.windObsSum / rs.windObsN)} kt observed`;
}

function showResults() {
    if (!UI.resultsOverlay || !UI.resultsList) return;

    const wasHidden = UI.resultsOverlay.classList.contains('hidden');
    UI.resultsOverlay.classList.remove('hidden');
    if (wasHidden) UI.resultsOverlay.scrollTop = 0;
    UI.leaderboard.classList.add('hidden');
    Sound.updateMusic();

    // Finish order: finishers by time, then DNF, then DNS, then anyone still racing.
    const sorted = [...state.boats].sort((a, b) => {
        const getScore = (boat) => {
            if (!boat.raceState.finished) return 3;
            if (boat.raceState.resultStatus === 'DNS') return 2;
            if (boat.raceState.resultStatus === 'DNF') return 1;
            return 0;
        };
        const scoreA = getScore(a), scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreA - scoreB;
        if (scoreA === 0) return a.raceState.finishTime - b.raceState.finishTime;
        return getBoatProgress(b) - getBoatProgress(a);
    });

    const leader = sorted[0];
    const player = state.boats.find(b => b.isPlayer) || state.boats[0];

    const gapScale = fleetGapScale();

    renderResultsHeader(sorted, gapScale);
    renderResultsHero(sorted, player, leader);
    // Called from HERE, not from inside the hero. The hero redraws only when the hero's own
    // signature changes, and a split tile can go stale without it: "fleet fastest" is taken
    // away by a boat still out on the water sailing a quicker leg than you did.
    renderResultsSplits(player);
    renderResultsRows(sorted, leader, fleetExtremes(), gapScale);
    renderResultsFootnote(leader);
}

// Venue, breeze, fleet size — and whether the race is actually over, which it often is
// not: the overlay opens when YOU finish, with boats still on the water behind you.
function renderResultsHeader(sorted, gapScale) {
    const sub = document.getElementById('res-subtitle');
    const status = document.getElementById('res-status');
    const v = VENUES[settings.venue];

    // The ruler states the span it is drawn to, and re-states it as boats finish — the
    // scale is the fleet's own, so without the caption the markers would be a picture with
    // no units. Written from the same number the markers are placed with.
    const gapHead = document.getElementById('res-gap-head');
    const scaleText = gapScale > 0 ? `— 0 to +${gapScale.toFixed(1)}s` : '';
    if (gapHead && gapHead.dataset.scale !== scaleText) {
        gapHead.dataset.scale = scaleText;
        gapHead.innerHTML = `Gap to winner <span style="color:#4a5a72;letter-spacing:0.05em;">${scaleText}</span>`;
    }
    if (sub) {
        sub.textContent = [
            venueDisplayName(settings.venue) || 'Open Water',
            observedWindText(),
            `${state.boats.length} boats`
        ].join(' · ').toUpperCase();
    }
    if (status) {
        const racing = state.boats.filter(b => !b.raceState.finished).length;
        const out = state.boats.filter(b => b.raceState.resultStatus).length;
        const text = racing ? `${racing} still racing`
            : out ? `${state.boats.length - out} home · ${out} did not finish`
            : 'All boats home';
        // The DOT carries the state and the text stays quiet: green once everyone is in,
        // amber while the race is still running. Rewritten only when it changes — this runs
        // six times a second, and replacing the markup every tick is exactly the churn that
        // made the rest of the page flicker.
        const dot = racing ? '#f2c14e' : '#34d399';
        if (status.dataset.sig !== text) {
            status.dataset.sig = text;
            status.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;flex:none;`
                + `background:${dot};"></span><span>${text}</span>`;
        }
        status.style.color = '#9fb2cc';
    }
}

// THE RECORD, AS A CARD. It was a chip, and a chip can hold a time or a delta but not the
// three things that make a lap time mean anything: what the mark was, what you did, and the
// difference. Two states — one for beating it, a quiet one for missing it — and nothing at
// all when there is no mark yet, because a first race here beat nobody.
function recordCard(best, rs) {
    if (!best || best.previous === null) return '';
    const won = best.isBest;
    const delta = Math.abs(rs.finishTime - best.previous).toFixed(2);
    const frame = won
        ? 'background:linear-gradient(150deg,rgba(242,193,78,0.16),rgba(242,193,78,0.05));border:1px solid rgba(242,193,78,0.5);'
        : 'background:#141d31;border:1px solid rgba(255,255,255,0.09);';
    return `
        <div style="flex:none;${frame}border-radius:14px;padding:16px 20px;text-align:center;">
            <div class="t-label" style="font-size:11px;letter-spacing:0.22em;color:${won ? '#f2c14e' : '#9fb2cc'};">
                ${won ? '✦ New Course Record ✦' : 'Course Record'}
            </div>
            <!-- The time you just set, and what it was worth. The old time struck through
                 with an arrow to the new one was three numbers to say one thing, and the
                 delta underneath already carries the one you cannot work out yourself. -->
            <div class="flex items-baseline justify-center gap-2" style="margin-top:6px;">
                <span class="t-mono" style="font-size:30px;font-weight:900;color:${won ? '#f2c14e' : '#eef3fb'};">${formatBestTime(won ? rs.finishTime : best.previous)}</span>
            </div>
            <div class="t-mono" style="font-size:11px;font-weight:800;color:${won ? '#34d399' : '#7787a0'};margin-top:2px;">
                ${won ? '−' + delta + 's off the record' : '+' + delta + 's off the record'}
            </div>
        </div>`;
}

// You: portrait, the place you took, the gap that decided it, and your splits. Rebuilt
// only when something in it changes — this function runs six times a second, and
// re-writing the <img> every tick would flicker the portrait.
function renderResultsHero(sorted, player, leader) {
    const host = document.getElementById('res-hero');
    if (!host) return;
    const rs = player.raceState;
    const pos = sorted.indexOf(player) + 1;
    const ahead = pos > 1 ? sorted[pos - 2] : null;

    // The venue best is decided ONCE per race, on the first render, and only by a boat
    // that actually finished the course.
    if (!state.race.bestChecked) {
        state.race.bestChecked = true;
        state.race.bestOutcome = (rs.finished && !rs.resultStatus)
            ? recordVenueBest(rs.finishTime, pos) : null;
    }
    const best = state.race.bestOutcome;

    const sig = [pos, rs.finished, rs.resultStatus, rs.finishTime.toFixed(2),
                 rs.totalPenalties, rs.legTimes.length,
                 best && best.isBest, best && best.isBestPos].join('|');
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;

    const dnf = !!rs.resultStatus;
    const headline = dnf ? rs.resultStatus : ordinalOf(pos);
    // The gap that decided your race — to the boat AHEAD, because that is the one you were
    // sailing against. The winner gets the gap they won by instead.
    let gap = '';
    if (dnf) {
        gap = rs.resultStatus === 'DNS' ? 'Never started' : 'Did not finish';
    } else if (ahead && ahead.raceState.finished && !ahead.raceState.resultStatus) {
        gap = `+${(rs.finishTime - ahead.raceState.finishTime).toFixed(2)}s behind ${ahead.name}`;
    } else if (pos === 1) {
        const next = sorted[1];
        gap = (next && next.raceState.finished && !next.raceState.resultStatus)
            ? `Won by ${(next.raceState.finishTime - rs.finishTime).toFixed(2)}s`
            : 'First home';
    } else {
        gap = 'Racing continues behind you';
    }

    const chip = (text, color, border, bg) =>
        `<span style="background:${bg};border:1px solid ${border};border-radius:999px;padding:4px 12px;`
      + `font-size:11px;font-weight:800;letter-spacing:0.02em;color:${color};white-space:nowrap;">${text}</span>`;
    const chips = [];
    // The clock record has its own card beside the hero now (see `recordCard`) — a chip
    // could not carry "old → new, and by how much" without becoming a sentence.
    //
    // The OTHER record stays a chip. Only when it is news, and only when there was
    // something to beat: ⚠️ A FIRST RACE AT A VENUE IS NOT A PERSONAL BEST, or the screen
    // congratulates every player on every new venue and the praise stops meaning anything.
    if (best && best.isBestPos && best.previousPos !== null) {
        chips.push(chip('BEST FINISH HERE ✦ ' + ordinalOf(best.previousPos).toUpperCase()
                        + ' → ' + ordinalOf(pos).toUpperCase(),
                        '#f2c14e', 'rgba(242,193,78,0.4)', 'rgba(242,193,78,0.1)'));
    }
    chips.push(rs.totalPenalties > 0
        ? chip(`${rs.totalPenalties} PENALT${rs.totalPenalties > 1 ? 'IES' : 'Y'}`, '#fca5a5', 'rgba(239,68,68,0.4)', 'rgba(239,68,68,0.12)')
        : chip('CLEAN RACE — NO PENALTIES', '#34d399', 'rgba(255,255,255,0.09)', '#141d31'));

    // THE PLACE IS SAID IN METAL, and the label says it with the number — one statement in
    // one colour. Gold, silver, bronze for the podium and the page's white for everyone
    // else; the screen used to shout every result in gold, which made a seventh look like a
    // win until you read the number.
    const pc = placeColor(pos, dnf);
    // The band's wash is the PLAYER'S colour, not a gold that belongs to first place. It is
    // the same colour as the glow behind the portrait sitting in it, at a third the alpha.
    if (host.parentElement) {
        host.parentElement.style.background =
            `radial-gradient(700px 200px at 30% 0%, ${boatGlow(player, 0.14)}, transparent)`;
    }
    host.innerHTML = `
        <div class="flex items-center" style="flex:none; gap:18px;">
            <div style="width:110px;height:130px;flex:none;filter:drop-shadow(0 6px 22px ${boatGlow(player, 0.5)});">
                <img src="assets/images/competitors/${player.name.toLowerCase()}.png" alt="${escapeHTMLText(player.name)}"
                     style="width:100%;height:100%;object-fit:contain;" draggable="false">
            </div>
            <div>
                <div class="t-label" style="font-size:12px;letter-spacing:0.24em;color:${pc};">${dnf ? 'You Did Not Finish' : 'You Finished'}</div>
                <div class="flex items-baseline gap-3.5" style="margin-top:4px;">
                    <span class="t-display italic" style="font-size:${dnf ? 46 : 72}px;line-height:1;color:${pc};">${headline}</span>
                    <div>
                        <div class="t-display-8 t-display uppercase" style="font-size:19px;letter-spacing:0.02em;">${escapeHTMLText(player.name)}${dnf ? '' : ' · ' + formatTime(rs.finishTime)}</div>
                        <div style="font-size:13px;color:#9fb2cc;margin-top:2px;">${gap}</div>
                    </div>
                </div>
                <div class="flex gap-2" style="margin-top:10px;">${chips.join('')}</div>
            </div>
        </div>
        ${recordCard(best, rs)}`;
}

// START + one tile per leg: the time, where you stood when you got there, and which way
// that had moved. A single race cannot tell you much, but it can tell you where you won
// or lost it — which the old screen, showing only the total, never did.
function renderResultsSplits(player) {
    const host = document.getElementById('res-splits');
    const label = document.getElementById('res-splits-label');
    if (!host) return;
    const rs = player.raceState;
    const legs = rs.legTimes.length;
    const started = rs.startTimeDisplay > 0;

    // Fastest round each leg, over everyone who has sailed it — `legTimes` is recorded for
    // every boat, so this is the whole fleet's answer and not just the finishers'. It is in
    // the signature because a boat still out there can take "fleet fastest" off your tile.
    const fleetLegBest = [];
    for (let i = 0; i < legs; i++) {
        let bestT = Infinity;
        for (const b of state.boats) {
            const t = b.raceState.legTimes[i];
            if (typeof t === 'number' && t < bestT) bestT = t;
        }
        fleetLegBest.push(bestT);
    }

    const sig = `${started}|${legs}|${rs.legTimes.map(t => t.toFixed(2)).join(',')}`
              + `|${fleetLegBest.map(t => t.toFixed(2)).join(',')}`;
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;

    if (label) {
        label.innerHTML = `Your Splits <span style="color:#4a5a72;letter-spacing:0.05em;">— `
            + (started ? `start + ${legs} leg${legs === 1 ? '' : 's'}` : 'no clean start') + `</span>`;
    }

    const tiles = [];
    // A TAG ON THE LEG THAT DID SOMETHING, and the tile's border carries it to the eye from
    // across the panel. Places won and lost outrank the speed note, because they are the
    // only thing on the tile that changed the race — a leg you sailed quicker than anyone
    // and still went backwards on is a fact about the boat ahead. When both are true the
    // ✦ rides along on the end of the place tag.
    const GREEN = { color: '#34d399', border: '1px solid rgba(52,211,153,0.5)' };
    const RED = { color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)' };
    const TEAL = { color: '#7ff0d4', border: '1px solid rgba(127,240,212,0.5)' };
    const tile = (name, time, rank, prevRank, fastest, startTag) => {
        let trend = '', trendColor = '#66748c', tag = null, moved = 0;
        if (rank && prevRank) {
            const d = prevRank - rank;
            if (d > 0) { trend = `▲${d}`; trendColor = '#34d399'; moved = d; }
            else if (d < 0) { trend = `▼${-d}`; trendColor = '#f87171'; moved = d; }
            else { trend = '–'; }
        }
        const places = (n) => Math.abs(n) === 1 ? 'a place' : `${Math.abs(n)} places`;
        if (moved) {
            tag = { ...(moved > 0 ? GREEN : RED),
                    text: `${moved > 0 ? 'Gained' : 'Lost'} ${places(moved)}${fastest ? ' ✦' : ''}` };
        } else if (fastest) {
            tag = { ...TEAL, text: 'Fleet fastest ✦' };
        } else if (startTag) {
            tag = startTag;
        }
        tiles.push(`
        <div class="res-split" ${tag ? `style="border:${tag.border};"` : ''}>
            <div class="t-label" style="font-size:9px;letter-spacing:0.1em;color:#66748c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
            <div class="res-split-time t-mono">${time}</div>
            <div class="flex items-baseline gap-1.5" style="margin-top:3px;">
                <span style="font-size:12px;font-weight:800;color:#9fb2cc;">${rank ? ordinalOf(rank) : '—'}</span>
                <span style="font-size:11px;font-weight:800;color:${trendColor};">${trend}</span>
            </div>
            <!-- The slot is always there, tag or no tag: five tiles with four heights is a
                 ragged row, and the tags are the thing you are meant to scan for.
                 ⚠️ NOT nowrap. "Fleet fastest ✦" set on one line is 90px, which made it —
                 not the split time — the thing deciding how narrow a tile can be, and at
                 1280 that pushed the fifth leg onto a row of its own. Let it break; the
                 grid stretches the other tiles to match. -->
            <div class="t-label" style="font-size:8.5px;letter-spacing:0.08em;color:${tag ? tag.color : 'transparent'};margin-top:3px;min-height:10px;">${tag ? tag.text : '—'}</div>
        </div>`);
    };

    // Tenths, not thousandths. `formatSplitTime` reports 0:58.999 because a mid-race split
    // banner is a stopwatch; a tile you read at a glance next to four others is a
    // comparison, and three decimals of noise is what stops five of them lining up.
    const splitTime = (t) => {
        const m = Math.floor(t / 60);
        const s = (t % 60).toFixed(1);
        return `${m}:${s.padStart(4, '0')}`;
    };

    // The start has no previous place to move from, so it is judged on where it PUT you:
    // top three off the line is the start that wins races, back three is the one you spend
    // the first leg paying for. Read against the fleet, so it still means the same thing if
    // the fleet size ever changes.
    const fleetN = state.boats.length;
    const sr = rs.startRank || 0;
    const startTag = !sr ? null
        : sr <= 3 ? { ...GREEN, text: 'Top 3 off the line' }
        : sr > fleetN - 3 ? { ...RED, text: 'Back 3 off the line' }
        : null;

    if (started) tile('Start', '+' + rs.startTimeDisplay.toFixed(1) + 's', sr, 0, false, startTag);
    let prev = sr;
    for (let i = 0; i < legs; i++) {
        const rank = rs.legRanks[i] || 0;
        tile('Leg ' + (i + 1), splitTime(rs.legTimes[i]), rank, prev,
             rs.legTimes[i] <= fleetLegBest[i] + 1e-9, null);
        if (rank) prev = rank;
    }
    if (!tiles.length) {
        tiles.push(`<div style="font-size:13px;color:#66748c;">No splits — you never crossed the line.</div>`);
    }
    host.innerHTML = tiles.join('');
}

// The measured columns, read for the whole boat. One definition each, because the row and
// the fleet-wide comparison have to be computing the same number.
//
// ⚠️ ROUNDED TO WHAT THE COLUMN PRINTS. Comparing full precision marked one boat's 0.91 as
// the shortest way round while the boat beside it printed 0.91 in plain white — the two
// differed in the third decimal, which the column does not show. A highlight has to be
// checkable against the number next to it.
function boatAvgSpeed(b) {
    const rs = b.raceState;
    const duration = rs.finished ? rs.finishTime : state.race.timer;
    const sum = rs.legSpeedSums ? rs.legSpeedSums.reduce((a, c) => a + c, 0) : 0;
    return Math.round((duration > 0.1 ? sum / duration : 0) * 10) / 10;
}
function boatTopSpeed(b) { return Math.round(Math.max(...b.raceState.legTopSpeeds) * 10) / 10; }
// Seconds after the gun that this boat crossed the line. Recorded for the whole fleet, not
// just the player — 0 means it never got away (a DNS), which is not a slow start but the
// absence of one, so it stays out of both the column and the comparison.
function boatStartTime(b) {
    const t = b.raceState.startTimeDisplay;
    return t > 0 ? Math.round(t * 10) / 10 : null;
}
function boatDistKm(b) {
    return Math.round(unitsToKm(b.raceState.legDistances.reduce((a, c) => a + c, 0)) * 100) / 100;
}

// BEST AND WORST OF EACH MEASURED COLUMN — quickest and slowest burst, quickest and slowest
// average, shortest and longest way round.
//
// ⚠️ OVER BOATS THAT FINISHED THE COURSE, and only those. A boat still on the water has
// sailed a shorter distance than everyone home for the obvious reason, and it would take
// "shortest way round" every time until it crossed the line. Nothing is marked until two
// boats are home, because the only boat in is not the best or the worst of anything.
// The START is the exception, and reads against a different set: it is complete the moment
// a boat crosses the line, so every boat that got away is comparable — including one that
// went on to retire. Nothing else in the row is settled until the boat is home.
function fleetExtremes() {
    const span = (list, f) => {
        const v = list.map(f).filter(x => x !== null);
        return v.length < 2 ? null : { hi: Math.max(...v), lo: Math.min(...v) };
    };
    const done = state.boats.filter(b => b.raceState.finished && !b.raceState.resultStatus);
    return {
        top: done.length < 2 ? null : span(done, boatTopSpeed),
        avg: done.length < 2 ? null : span(done, boatAvgSpeed),
        dist: done.length < 2 ? null : span(done, boatDistKm),
        start: span(state.boats, boatStartTime),
    };
}

// The fleet. One row per boat, built once and patched — boats are still finishing behind
// you while this is on screen.
function renderResultsRows(sorted, leader, ext, gapScale) {
    if (!UI.resultRows) UI.resultRows = {};

    sorted.forEach((boat, index) => {
        const rs = boat.raceState;
        let row = UI.resultRows[boat.id];
        if (!row) {
            row = document.createElement('div');
            // `res-me` gives the player the same gold ring + gold type the leaderboard
            // uses, so "which one is me" is answered the same way on every screen.
            row.className = 'res-row' + (boat.isPlayer ? ' res-me' : '');
            row.style.marginBottom = '2px';
            row.innerHTML = `
                <div class="res-bar res-grid">
                    <!-- The place, in metal. The little medal dot that used to sit beside it
                         said the same thing twice for the podium and drew an empty ring for
                         everyone else — the colour of the numeral is the whole signal. -->
                    <div class="res-pos t-display italic" style="font-size:16px;"></div>
                    <div style="width:32px;height:32px;">
                        <img class="res-face" src="assets/images/competitors/${boat.name.toLowerCase()}.png"
                             alt="${escapeHTMLText(boat.name)}" draggable="false"
                             style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
                    </div>
                    <!-- items-center, not items-baseline: the "You" tag is a badge with its
                         own box, and sitting a padded box on the name's baseline hangs it
                         low. Centre the two and the tag reads as a marker on the name. -->
                    <div class="flex items-center gap-2" style="min-width:0;">
                        <span class="res-name t-display-8 t-display uppercase truncate" style="font-size:14px;letter-spacing:0.03em;"></span>
                        <span class="res-you t-label" style="font-size:9px;letter-spacing:0.12em;color:#0c1322;background:#f2c14e;border-radius:4px;padding:2px 5px;line-height:1.15;display:none;">You</span>
                    </div>
                    <!-- The finish, drawn. The number beside it is exact; this is the one
                         place on the page you can see the shape of the race — who sailed
                         away, who was in a pack, who is still out there. -->
                    <div class="res-gap">
                        <div class="res-gap-axis"></div>
                        <div class="res-gap-mark" style="display:none;">
                            <div class="res-gap-tri"></div>
                        </div>
                    </div>
                    <div class="res-time res-r t-mono" style="font-size:13px;"></div>
                    <div class="res-delta res-r t-mono" style="font-size:12px;color:#7787a0;"></div>
                    <div class="res-start res-r t-mono" style="font-size:12px;"></div>
                    <div class="res-top res-r t-mono" style="font-size:12px;"></div>
                    <div class="res-avg res-r t-mono" style="font-size:12px;color:#9fb2cc;"></div>
                    <div class="res-dist res-r t-mono" style="font-size:12px;color:#9fb2cc;"></div>
                    <div class="res-pen res-r t-mono" style="font-size:12px;"></div>
                    <div class="res-pts res-r t-display" style="font-size:16px;"></div>
                </div>`;
            // NO RING. The coloured ring was here to answer "which hull is that out on the
            // water" — the gap marker answers it now, in the same colour, and ten ringed
            // portraits beside ten coloured arrows was the same fact drawn twice.
            row.querySelector('.res-name').textContent = boat.name;
            // YOUR ROW GLOWS IN YOUR OWN COLOUR — the same hue as the portrait glow on the
            // hero and the badge on your name. The NAME stays white like every other boat's:
            // the row is already marked three ways, and a coloured name on top of a coloured
            // row read as a different kind of row rather than as the same fleet.
            if (boat.isPlayer) {
                const c = deepBandFor(boat.colors.hull, boat.colors.spinnaker, boat.colors.spinAccent);
                const bar = row.querySelector('.res-bar');
                bar.style.borderColor = boatGlow(boat, 0.55);
                bar.style.background = boatGlow(boat, 0.10);
                bar.style.boxShadow = `0 0 18px ${boatGlow(boat, 0.30)}`;
                const you = row.querySelector('.res-you');
                you.style.background = c;
                you.style.display = '';
            }
            UI.resultRows[boat.id] = row;
        }

        const q = (c) => row.querySelector('.' + c);
        const posEl = q('res-pos');
        posEl.textContent = index + 1;
        posEl.style.color = index < 3 ? RES_MEDALS[index] : '#66748c';

        const timeEl = q('res-time');
        if (rs.resultStatus) {
            timeEl.textContent = rs.resultStatus;
            timeEl.style.color = '#f87171';
        } else if (!rs.finished) {
            timeEl.textContent = 'racing';
            timeEl.style.color = '#66748c';
        } else {
            timeEl.textContent = formatTime(rs.finishTime);
            timeEl.style.color = '#eef3fb';
        }

        const clean = rs.finished && !rs.resultStatus;
        const leaderClean = leader.raceState.finished && !leader.raceState.resultStatus;
        const behind = (clean && leaderClean) ? rs.finishTime - leader.raceState.finishTime : null;
        q('res-delta').textContent = (index > 0 && behind !== null) ? '+' + behind.toFixed(2) : '—';

        // The gap, as a marker on a fixed ruler. Only boats with a settled gap get one: a
        // boat still on the water has no gap to the winner yet, and neither has a DNF.
        const mark = q('res-gap-mark');
        if (behind === null) {
            mark.style.display = 'none';
        } else {
            // Winner at 0, last boat home at 1. A one-boat fleet has no spread to draw, so
            // everyone sits on the datum rather than dividing by nothing.
            const f = gapScale > 0 ? behind / gapScale : 0;
            mark.style.display = '';
            // The 24px keeps the marker inside the column at full scale; `calc` does the
            // work so the ruler stays fluid with the layout.
            mark.style.left = `calc(${f.toFixed(4)} * (100% - 24px))`;
            // Every marker is its own boat's colour, yours included — the ruler is a picture
            // of the fleet, and a gold arrow in it would have read as the winner's.
            q('res-gap-tri').style.color =
                deepBandFor(boat.colors.hull, boat.colors.spinnaker, boat.colors.spinAccent);
        }

        // THE ENDS OF EACH COLUMN, GREEN AND RED. Best in the fleet reads green, worst
        // reads red, everyone in between stays quiet — the column is a ranking you can
        // read without reading it. Only a boat that finished can hold either end (see
        // `fleetExtremes`), and "best" is not the same direction in every column: high for
        // speed, LOW for the distance you sailed to get here.
        const edge = (v, s, lowIsGood, gate) => {
            if (!s || !(gate === undefined ? clean : gate)) return '#9fb2cc';
            const good = lowIsGood ? s.lo : s.hi, bad = lowIsGood ? s.hi : s.lo;
            if (Math.abs(v - good) < 1e-9) return '#34d399';
            if (Math.abs(v - bad) < 1e-9) return '#ef4444';
            return '#9fb2cc';
        };
        // Time to cross the line — the first thing you can win or lose, and the one number
        // here that is settled while the rest of the race is still being sailed.
        const start = boatStartTime(boat);
        const startEl = q('res-start');
        startEl.textContent = start === null ? '—' : '+' + start.toFixed(1) + 's';
        startEl.style.color = start === null ? '#4a5a72'
            : edge(start, ext && ext.start, true, true);

        const top = boatTopSpeed(boat), avg = boatAvgSpeed(boat), dist = boatDistKm(boat);
        const topEl = q('res-top');
        topEl.textContent = top.toFixed(1);
        topEl.style.color = edge(top, ext && ext.top, false);

        const avgEl = q('res-avg');
        avgEl.textContent = avg.toFixed(1);
        avgEl.style.color = edge(avg, ext && ext.avg, false);

        const distEl = q('res-dist');
        distEl.textContent = dist.toFixed(2);
        distEl.style.color = edge(dist, ext && ext.dist, true);

        const penEl = q('res-pen');
        penEl.textContent = rs.totalPenalties > 0 ? rs.totalPenalties : '—';
        penEl.style.color = rs.totalPenalties > 0 ? '#ef4444' : '#4a5a72';

        // POINTS, and only for a boat that finished the course. A place you were holding
        // when the screen opened is not a result, and neither is a DNF — scoring either
        // would put a number in the column that the race has not decided yet.
        const ptsEl = q('res-pts');
        ptsEl.textContent = clean ? POINTS_FOR_PLACE(index + 1) : '—';
        // No metal here. The medal colour is already on the place three columns left, and
        // saying it twice made the row look like it was scoring the colour, not the boat.
        ptsEl.style.color = clean ? '#eef3fb' : '#4a5a72';

        // Appending an element that is already in the list MOVES it, which is how the order
        // stays right as boats finish behind you — but a move is a REMOVE + INSERT, and doing
        // ten of them six times a second is what made the finished table flicker. Only touch
        // the DOM when this row is not already where it belongs.
        if (UI.resultsList.children[index] !== row) {
            UI.resultsList.insertBefore(row, UI.resultsList.children[index] || null);
        }
    });
}

// The race's own one-line story, where a series would have put "next stop".
function renderResultsFootnote(leader) {
    const el = document.getElementById('res-footnote');
    if (!el) return;
    const rs = leader.raceState;
    const vn = venueDisplayName(settings.venue);
    el.innerHTML = (rs.finished && !rs.resultStatus)
        ? `<span style="color:#eef3fb;font-weight:800;">${escapeHTMLText(leader.name)}</span> takes `
          + `${vn || 'the race'} in <span class="t-mono" style="color:#eef3fb;">${formatTime(rs.finishTime)}</span>`
        : `${vn || 'The race'} — still on the water`;
}

function updateLeaderboard() {
    if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) {
        showResults();
        return;
    }
    if (!UI.leaderboard || !state.boats.length) return;

    // Store previous ranks
    state.boats.forEach(b => b.prevRank = b.lbRank);

    // Calculate L for distance estimates
    const _ax = courseAxis();
    const c1x = _ax.start.x, c1y = _ax.start.y;
    const c2x = _ax.windward.x, c2y = _ax.windward.y;
    const dx = _ax.dx, dy = _ax.dy;
    const len = _ax.len;
    // THE WHOLE COURSE, measured on the path DMC is read against — not `legs x axis length`,
    // which is the straight-line axis and understates any course with land on it. The
    // "distance to finish" delta has to be in the same units as the progress it subtracts.
    const totalRaceDist = (state.course.dmc && state.course.dmc.total) || (state.race.totalLegs * len);


    if (state.race.status === 'prestart') {
         UI.leaderboard.classList.add('hidden');
         return;
    }
    UI.leaderboard.classList.remove('hidden');

    // Sort boats
    const sorted = [...state.boats].sort((a, b) => {
        // Scoring helper: 0=Finished, 1=DNF, 2=DNS, 3=Racing
        const getScore = (boat) => {
            if (!boat.raceState.finished) return 3;
            if (boat.raceState.resultStatus === 'DNS') return 2;
            if (boat.raceState.resultStatus === 'DNF') return 1;
            return 0;
        };

        const scoreA = getScore(a);
        const scoreB = getScore(b);

        if (scoreA !== scoreB) return scoreA - scoreB;

        if (scoreA === 0) return a.raceState.finishTime - b.raceState.finishTime;

        // 2. Leg (For Racing)
        if (a.raceState.leg !== b.raceState.leg) return b.raceState.leg - a.raceState.leg;

        // 3. Progress within leg (For Racing or DNF/DNS tiebreak)
        const pA = getBoatProgress(a);
        const pB = getBoatProgress(b);
        return pB - pA;
    });

    const leader = sorted[0];
    const leaderProgress = getBoatProgress(leader);

    // Update Header
    // The pips carry the count, so the label is just a label. `2/4` beside four bars with
    // two lit was the same fact twice.
    if (UI.lbLeg) UI.lbLeg.textContent = "LEG";

    // Leg pips: one per leg, showing where YOU are — not the leader. This is the player's
    // own panel, and "which leg am I on" is the question it is being asked.
    //
    // Three states rather than two, so it says the leg rather than a count of finished ones:
    // the leg you are ON is lit, the ones behind you are dimmed, the ones ahead are dark.
    if (UI.lbPips) {
        const legs = Math.max(1, state.race.totalLegs);
        const me = state.boats.find(b => b.isPlayer) || leader;
        const cur = me.raceState.finished ? legs + 1 : Math.max(1, me.raceState.leg);
        if (UI.lbPips.childElementCount !== legs) {
            UI.lbPips.innerHTML = '';
            for (let i = 0; i < legs; i++) {
                const pip = document.createElement('span');
                pip.style.cssText = 'display:block;height:4px;border-radius:2px;transition:background .3s,width .3s;';
                UI.lbPips.appendChild(pip);
            }
        }
        [...UI.lbPips.children].forEach((pip, i) => {
            const n = i + 1;
            pip.style.width = n === cur ? '20px' : '14px';
            pip.style.background = n === cur ? '#5eead4' : n < cur ? '#5eead459' : '#475569';
        });
    }

    // Render Rows
    if (UI.lbRows) {
        const ROW_HEIGHT = 44;
        UI.lbRows.style.height = (sorted.length * ROW_HEIGHT + 12) + 'px';

        sorted.forEach((boat, index) => {
            let row = UI.boatRows[boat.id];

            // Create if missing
            if (!row) {
                row = document.createElement('div');
                row.className = "lb-row flex items-center";

                // Rank. Italic display rather than mono: the whole row is one voice, and a
                // monospaced numeral beside an italic name read as two different panels.
                const rank = document.createElement('div');
                rank.className = "lb-rank t-display w-5 text-right mr-2.5 shrink-0";
                rank.style.cssText = "font-size:15px; font-style:italic;";

                // Portrait / Icon
                const iconContainer = document.createElement('div');
                iconContainer.className = "w-9 h-9 mr-2.5 flex items-center justify-center shrink-0";

                // EVERY ROW SHOWS A FACE, yours included. The player used to get a star
                // because the player had no portrait — but the player IS a character now, and
                // showing whose boat you picked is the point of picking one. Which row is
                // yours is already said by the ring around the row and its type, so the star
                // was carrying a meaning that was no longer its own.
                //
                // No ring and no fill behind it: the portraits are cut-outs, so a disc of
                // panel-coloured background WAS the circle. The src is set in the update
                // pass, not here — see the note there.
                const img = document.createElement('img');
                img.className = "lb-face w-9 h-9 rounded-full object-cover";
                iconContainer.appendChild(img);

                const nameDiv = document.createElement('div');
                nameDiv.className = "lb-name t-display flex-1 truncate uppercase";
                nameDiv.style.cssText = "font-size:16px;";
                nameDiv.textContent = boat.name;

                // Which way this boat is going, shown only while it is still worth saying.
                const trendDiv = document.createElement('div');
                trendDiv.className = "lb-trend shrink-0 mr-1.5 text-center";
                trendDiv.style.cssText = "width:12px; font-size:10px; line-height:1;";

                const distDiv = document.createElement('div');
                distDiv.className = "lb-dist t-mono text-right shrink-0";
                distDiv.style.cssText = "font-size:11.5px; min-width:52px;";

                row.appendChild(rank);
                row.appendChild(iconContainer);
                row.appendChild(nameDiv);
                row.appendChild(trendDiv);
                row.appendChild(distDiv);

                UI.lbRows.appendChild(row);
                UI.boatRows[boat.id] = row;
                boat.lbRank = index;
            }

            // Update Content
            const rankDiv = row.querySelector('.lb-rank');
            const distDiv = row.querySelector('.lb-dist');
            const nameDiv = row.querySelector('.lb-name');
            const trendDiv = row.querySelector('.lb-trend');
            const faceImg = row.querySelector('.lb-face');

            // ⚠️ THE FACE FOLLOWS THE BOAT'S IDENTITY, WHICH CAN CHANGE UNDER A LIVE ROW.
            // Picking a new character does not rebuild the fleet — `applyPlayerCharacter`
            // renames boat 0 in place (and `swapClashingOpponent` can re-identify an AI) —
            // so a src set once at row creation left the OLD portrait on the row while the
            // name beside it updated. Cheap to re-check: a string compare per row per draw.
            if (faceImg && faceImg.dataset.face !== boat.name) {
                faceImg.dataset.face = boat.name;
                faceImg.src = "assets/images/competitors/" + boat.name.toLowerCase() + ".png";
            }

            const dnx = boat.raceState.leg === 0 && !boat.raceState.finished;
            let rowClass = "lb-row flex items-center transition-colors duration-500";
            if (boat.isPlayer) rowClass += " lb-me";
            row.className = rowClass;

            // YOU ARE YOUR OWN COLOUR, not gold — the same hue the results page rings your
            // row with and the same one your gap marker carries there. Gold had to mean two
            // things at once on a panel that also ranks a fleet.
            const me = boat.isPlayer
                ? deepBandFor(boat.colors.hull, boat.colors.spinnaker, boat.colors.spinAccent) : null;
            if (me) row.style.boxShadow = `inset 0 0 0 2px ${me}`;

            // Only MEANINGFUL rows carry a fill — you, and anyone who has finished. The
            // zebra striping was a third fill that said nothing, and on the dark panel it
            // read as banding rather than as rows.
            row.style.background = boat.isPlayer ? boatGlow(boat, 0.12)
                                 : boat.raceState.finished ? 'rgba(16,185,129,0.14)'
                                 : 'transparent';

            rankDiv.style.color = me ? me : dnx ? '#475569' : '#64748b';
            nameDiv.style.color = boat.raceState.penalty ? '#f87171'
                                : me ? me
                                : dnx ? '#64748b' : '#ffffff';
            nameDiv.textContent = boat.name;
            rankDiv.textContent = index + 1;

            // A MOVE IS NEWS FOR A FEW SECONDS. Comparing ranks frame to frame would flash
            // the arrow for one update and vanish; this holds it long enough to be seen and
            // then stops, so a settled fleet is a quiet panel.
            if (boat.prevRank !== undefined && boat.prevRank !== index) {
                boat.lbTrendDir = index < boat.prevRank ? 1 : -1;
                boat.lbTrendUntil = state.race.timer + 2.5;
            }
            const showTrend = boat.lbTrendUntil !== undefined && state.race.timer < boat.lbTrendUntil;
            trendDiv.textContent = showTrend ? (boat.lbTrendDir > 0 ? '\u25B2' : '\u25BC') : '';
            trendDiv.style.color = boat.lbTrendDir > 0 ? '#34d399' : '#f87171';

            if (index === 0 && !boat.raceState.resultStatus) {
                // The leader has no gap to report, so the column says what it IS.
                distDiv.textContent = boat.raceState.finished ? formatTime(boat.raceState.finishTime) : 'LEADER';
                distDiv.style.color = '#5eead4';
            } else {
                distDiv.style.color = dnx ? '#64748b' : '#a5b4fc';
                if (boat.raceState.resultStatus) {
                    distDiv.textContent = boat.raceState.resultStatus;
                } else if (leader.raceState.finished) {
                    if (boat.raceState.finished) {
                        distDiv.textContent = "+" + (boat.raceState.finishTime - leader.raceState.finishTime).toFixed(1) + "s";
                    } else {
                        const diff = Math.max(0, totalRaceDist - getBoatProgress(boat));
                        distDiv.textContent = "+" + Math.round(diff * 0.2) + "m";
                    }
                } else {
                    const diff = Math.max(0, leaderProgress - getBoatProgress(boat));
                    distDiv.textContent = "+" + Math.round(diff * 0.2) + "m";
                }
            }

            // Update Position
            row.style.transform = `translate3d(0, ${index * ROW_HEIGHT}px, 0)`;

            // Handle Rank Change Animation
            if (boat.lbRank !== index) {
                boat.lbRank = index;
            }
        });
    }

    // Sayings Checks
    const player = state.boats[0];
    const playerRank = player.lbRank;
    const playerPrevRank = player.prevRank;

    for (const boat of state.boats) {
        if (boat.isPlayer) continue;

        // Moved into First
        if (boat.lbRank === 0 && boat.prevRank !== 0) {
            Sayings.queueQuote(boat, "moved_into_first");
        }

        // Moved into Last
        if (boat.lbRank === state.boats.length - 1 && boat.prevRank !== state.boats.length - 1) {
            Sayings.queueQuote(boat, "moved_into_last");
        }

        // Passing Player (AI was behind, now ahead)
        // Lower rank is better. Behind means rank > playerRank. Ahead means rank < playerRank.
        if (boat.prevRank > playerPrevRank && boat.lbRank < playerRank) {
            Sayings.queueQuote(boat, "they_pass_player");
        }

        // Player Passed AI (AI was ahead, now behind)
        if (boat.prevRank < playerPrevRank && boat.lbRank > playerRank) {
            Sayings.queueQuote(boat, "player_passes_them");
        }
    }
}



function drawBoatIndicator(ctx, boat) {
    if (boat.isPlayer) return;
    if (boat.opacity !== undefined && boat.opacity <= 0) return;

    // One line: rank pip + name. The label's only job on the water is IDENTITY —
    // binding "that pink boat" to "Splat". Rank and name are already in the
    // leaderboard, so the pip reuses that panel's ring-plus-rank language and the
    // two views teach each other. Speed was removed deliberately: a rival's
    // ABSOLUTE boatspeed changes no decision (the fleet sits inside ~1.5kn), and
    // reading it meant holding a number while glancing at your own instrument.
    const rank = (boat.lbRank !== undefined) ? String(boat.lbRank + 1) : "-";
    const showRank = boat.raceState.leg !== 0;   // no standings before the gun
    const name = boat.name.toUpperCase();
    const idColor = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;

    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(state.camera.rotation);
    ctx.translate(0, 46); // below the boat, camera-upright

    // The pip is always present — it is the identity carrier, and identity matters
    // most in the prestart scrum. It just holds no digit until there are standings.
    const PIP_R = showRank ? 8 : 4.5;
    const padX = 7;
    ctx.font = FONT.label(11);
    const nameW = ctx.measureText(name).width;
    const pipSlot = PIP_R * 2 + 5;
    const boxW = padX + pipSlot + nameW + padX;
    const boxH = 22;
    const x = -boxW / 2, y = 0;

    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 6);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    let cursor = x + padX;

    // Filled pip in the boat's identity color; digit picks whichever of
    // ink/white actually reads on it.
    const pcx = cursor + PIP_R, pcy = y + boxH / 2;
    ctx.fillStyle = idColor;
    ctx.beginPath();
    ctx.arc(pcx, pcy, PIP_R, 0, Math.PI * 2);
    ctx.fill();

    if (showRank) {
        ctx.font = FONT.mono(10);
        ctx.fillStyle = isVeryDark(idColor) ? '#f8fafc' : '#0b1c2b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rank, pcx, pcy + 0.5);
        ctx.font = FONT.label(11);
    }
    cursor += PIP_R * 2 + 5;

    // Penalty is the one state that overrides identity — red means penalty here
    // exactly as it does everywhere else.
    ctx.fillStyle = boat.raceState.penalty ? '#ef4444' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, cursor, y + boxH / 2 + 0.5);

    ctx.restore();
}

// Edge-clamped indicator for an active gate mark (or, with markIndex null, the
// closest point on the start/finish line). The mini arc mirrors the in-world
// rounding arrows of drawRoundingArrows: same start/end/ccw per mark index,
// rotated into screen space so it always agrees with what you'll see at the mark.
function drawMarkEdgeIndicator(ctx, x, y, label, markIndex, screenRot) {
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fillStyle = '#22c55e'; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    if (markIndex !== null) {
        let start, end, ccw;
        // A rounding leg passes the SIDE ('port'/'starboard') instead of a gate index —
        // same chirality convention as drawRoundingArrows: port rounds are the ccw ones.
        if (markIndex === 'port' || markIndex === 'starboard') {
                                    start = 0;       end = Math.PI; ccw = markIndex === 'port'; }
        else if (markIndex === 0) { start = 0;       end = Math.PI; ccw = false; }
        else if (markIndex === 1) { start = Math.PI; end = 0;       ccw = true; }
        else if (markIndex === 2) { start = 0;       end = Math.PI; ccw = true; }
        else                      { start = Math.PI; end = 0;       ccw = false; }

        ctx.save();
        ctx.rotate(state.wind.baseDirection + screenRot);
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, 15, start, end, ccw); ctx.stroke();
        const tipX = 15 * Math.cos(end), tipY = 15 * Math.sin(end);
        const tangent = end + (ccw ? -Math.PI/2 : Math.PI/2);
        ctx.translate(tipX, tipY); ctx.rotate(tangent);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 0); ctx.lineTo(-5, 5); ctx.lineTo(-3, 0); ctx.fill();
        ctx.restore();
    }

    ctx.fillStyle = '#ffffff'; ctx.font = FONT.label(15); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    ctx.fillText(label, 0, markIndex !== null ? -21 : -12);
    ctx.restore();
}

// Edge-clamped indicator for a nearby off-screen competitor: hull-colored dot
// with the boat's current rank inside and its name above.
function drawNpcEdgeIndicator(ctx, x, y, boat) {
    const color = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = boat.raceState.penalty ? '#ef4444' : '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    if (state.race.status === 'racing' && boat.lbRank !== undefined) {
        ctx.fillStyle = isVeryDark(color) ? '#ffffff' : '#0f172a';
        ctx.font = FONT.mono(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(boat.lbRank + 1), 0, 0.5);
    }

    ctx.fillStyle = '#ffffff'; ctx.font = FONT.label(10); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    ctx.fillText(boat.name.toUpperCase(), 0, -13);
    ctx.restore();
}

function draw() {
    frameCount++;

    // Draw Water Background (Screen Space)
    drawWater(ctx);

    const player = state.boats[0];
    if (!player) return;

    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.rotate(-state.camera.rotation);
    ctx.translate(-state.camera.x, -state.camera.y);

    // all lay over a submerged animal, which is most of what sells the depth.

    drawWakes(ctx);
    drawParticles(ctx, 'surface');
    drawGusts(ctx);
    drawWindWaves(ctx);

    // ...but a fin cutting the surface and the bubbles behind it are ON the
    // water, so they go over the crests the body sits beneath.
    // drawIslandShadows(ctx);
    drawParticles(ctx, 'current');
    // Nav aids are paint ON THE WATER, so they must go UNDER the land — drawn
    // after drawIslands they ran across the coastline and the rocky island.
    // Gate line, ladder rungs and laylines are all derived from a windward GATE
    // and mean nothing on an island rounding, so they are skipped there.
    drawActiveGateLine(ctx);
    // Ladder rungs measure progress up a windward leg and have no meaning on a
    // single island rounding. The start/finish line and the laylines do, so they
    // stay — skipping drawActiveGateLine took the start line with it.
    if (state.course.type !== 'islandRound') drawLadderLines(ctx);
    drawLayLines(ctx);
    drawMarkZones(ctx);
    drawRoundingArrows(ctx);
    // ── Everything physical, in ONE pass, in document order ─────────────────
    // It used to be two passes with three layers wedged between them — all land, then
    // disturbed air, the boundary and brash, then all floes. That put every floe in front
    // of every landmass by construction, so a floe could not be tucked behind a headland
    // however the venue was authored, and it left land and ice disagreeing about whether
    // the boundary line was drawn over them.
    //
    // So: paint on the water first (the nav aids above), then the sailing limit over all of
    // it, then the wind shadow and the shapes in the order the document stacks them.
    //
    // THE LIMIT SITS ON TOP OF THE WATER AND UNDER THE WORLD. Everything painted ON the
    // surface — wakes, gusts, wind waves, the gate line, the ladder rungs, the laylines —
    // passes beneath it, because they are all marks on the same water and the limit is the
    // one that says where the water ends. Everything that stands IN the water — the wind
    // shadow, the land, the marks, the boats — passes over it, because a band of club
    // branding running across a coastline is exactly what it used to look like.
    drawBoundary(ctx);

    drawDisturbedAir(ctx);
    drawIslands(ctx);
    // Surf sits ON the shore, so it goes over the land and under the air layer.
    drawSurf(ctx);
    drawParticles(ctx, 'air');
    drawMarkShadows(ctx);
    drawMarkBodies(ctx);
    drawRulesOverlay(ctx);

    // Draw All Boats (viewport cull: mid-race most of the fleet is off-screen)
    const boatViewR = Math.sqrt(canvas.width ** 2 + canvas.height ** 2) * 0.6 + 90;
    const boatViewR2 = boatViewR * boatViewR;
    for (const boat of state.boats) {
        const bdx = boat.x - state.camera.x, bdy = boat.y - state.camera.y;
        if (bdx * bdx + bdy * bdy > boatViewR2) continue;
        ctx.save();
        ctx.translate(boat.x, boat.y);
        ctx.rotate(boat.heading);
        drawBoat(ctx, boat);
        ctx.restore();
    }

    // A blow is vapour hanging in the air, so it passes over hulls and sails too.

    // Draw Indicators
    for (const boat of state.boats) {
        if (boat.opacity === undefined || boat.opacity > 0.1) {
             ctx.save();
             if (boat.opacity !== undefined) ctx.globalAlpha = boat.opacity;
             drawBoatIndicator(ctx, boat);
             ctx.restore();
        }
    }

    drawDebugWorld(ctx);

    ctx.restore();

    // Screen-space weather (Arctic snowfall) — over the world, under the UI

    // Camera Message
    if (state.camera.messageTimer > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1.0, state.camera.messageTimer*2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        ctx.font = FONT.label(28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const txt = "CAMERA: " + state.camera.message;
        ctx.fillText(txt, canvas.width/2, canvas.height/3);
        ctx.restore();
    }

    // Edge indicators: next mark(s) and nearby competitors.
    if (state.race.status !== 'finished') {
        const m = 40, hw = Math.max(10, canvas.width/2-m), hh = Math.max(10, canvas.height/2-m);
        const rot = -state.camera.rotation;
        // Project a world point into screen space, clamped to the screen edge band.
        const toScreen = (wx, wy) => {
            const dx = wx - state.camera.x, dy = wy - state.camera.y;
            const rx = dx*Math.cos(rot) - dy*Math.sin(rot);
            const ry = dx*Math.sin(rot) + dy*Math.cos(rot);
            let t = 1.0;
            if (Math.abs(rx)>0.1 || Math.abs(ry)>0.1) t = Math.min(hw/Math.abs(rx), hh/Math.abs(ry));
            const f = Math.min(t, 1.0);
            return { x: canvas.width/2 + rx*f, y: canvas.height/2 + ry*f, onScreen: t >= 1.0 };
        };

        if (state.showNavAids) {
            const leg = player.raceState.leg;
            const marks = state.course.marks;
            // ROUTE-DRIVEN, not shape-guessed. The old split ("gate legs if the course has
            // four marks, otherwise the single waypoint") left every ROUNDING leg with no
            // indicator at all — legMarks() is null there — and gave the start and finish
            // lines a single pip at the nearest point instead of one per end.
            const e = routeLeg(Math.min(leg, state.race.totalLegs));
            if (e && e.kind === 'round' && e.mark) {
                // Rounding leg: point straight at the mark, whatever the path to it looks
                // like — the indicator answers "where is it", not "how do I get there".
                const rm = e.mark;
                const p = toScreen(rm.x, rm.y);
                // AN EDGE INDICATOR IS FOR THINGS OFF THE EDGE. Once the mark itself is
                // in view it is the better thing to look at.
                if (!p.onScreen) {
                    const d = Math.sqrt((rm.x-player.x)**2 + (rm.y-player.y)**2) * 0.2;
                    drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(d) + 'm', rm.side || null, rot);
                }
            } else if (e && e.marks && marks) {
                // A line or a gate: BOTH ends get an indicator — a line's whole span is
                // crossable, and which end you favour is a tactical choice the display
                // should not make for you. Mid-race gate marks also carry the mini
                // rounding-direction arc; the start and finish ends do not.
                const isGate = e.kind === 'gate' && !e.finish && leg > 0 && leg < state.race.totalLegs;
                for (const idx of e.marks) {
                    const mk = marks[idx];
                    if (!mk) continue;
                    const p = toScreen(mk.x, mk.y);
                    if (p.onScreen) continue;
                    const d = Math.sqrt((mk.x-player.x)**2 + (mk.y-player.y)**2) * 0.2;
                    drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(d) + 'm', isGate ? idx : null, rot);
                }
            } else {
                // No route entry to read (defensive): the single waypoint pip, as before.
                const wp = player.raceState.nextWaypoint;
                const p = toScreen(wp.x, wp.y);
                if (!p.onScreen) drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(wp.dist) + 'm', null, rot);
            }
        }

        // Competitors: off-screen but close-ish. On-screen boats already carry
        // name tags; distant boats live on the minimap.
        const NPC_EDGE_RANGE = 1500; // world units (~300 m)
        for (const boat of state.boats) {
            if (boat.isPlayer) continue;
            if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
            const bdx = boat.x - player.x, bdy = boat.y - player.y;
            if (bdx*bdx + bdy*bdy > NPC_EDGE_RANGE*NPC_EDGE_RANGE) continue;
            const p = toScreen(boat.x, boat.y);
            if (p.onScreen) continue;
            drawNpcEdgeIndicator(ctx, p.x, p.y, boat);
        }
    }

    drawMinimap();
    drawWindDebug(ctx);

    // UI Updates (Player Data)
    const localWind = getWindAt(player.x, player.y);

    if (UI.compassRose) UI.compassRose.style.transform = `rotate(${-state.camera.rotation}rad)`;
    if (UI.windArrow) UI.windArrow.style.transform = `rotate(${localWind.direction}rad)`;
    if (UI.waypointArrow) UI.waypointArrow.style.transform = `rotate(${player.raceState.nextWaypoint.angle}rad)`;
    if (UI.headingArrow) UI.headingArrow.style.transform = `rotate(${player.heading - state.camera.rotation}rad)`;

    // OCS banner: persistent while the flag is up (the transient race message is
    // easy to miss, and a correct OCS hold then reads as a missed crossing). The
    // arrow tracks the nearest point of the start line every frame so it stays
    // honest under camera rotation.
    if (UI.ocsBanner) {
        const ocsOn = state.race.status === 'racing' && player.raceState.ocs && !player.raceState.finished;
        UI.ocsBanner.classList.toggle('hidden', !ocsOn);
        if (ocsOn && UI.ocsArrow) {
            try {
                const [mo0, mo1] = startLinePts();
                const cl = getClosestPointOnSegment(player.x, player.y, mo0.x, mo0.y, mo1.x, mo1.y);
                const ang = Math.atan2(cl.x - player.x, -(cl.y - player.y));
                UI.ocsArrow.style.transform = `rotate(${ang - state.camera.rotation}rad)`;
            } catch (e) {}
        }
    }

    if (frameCount % 10 === 0) {
        updateLeaderboard();

        // Show when the player's boat is overpowered (>18kn effective wind costs speed,
        // scaled by heavyAir) — turns an invisible tax into a readable condition to sail
        // around. No venue gate any more: it asks the same question the physics asks, which
        // is whether THIS boat is in too much breeze right now, so it lights up wherever
        // that is true rather than only in the Arctic.
        // Asks the SAME question the physics asks, which is now heel and not wind speed. On
        // the old true-wind test the badge lit for the whole of a windy race — including
        // dead downwind, where the boat is at her fastest and nothing is wrong — so it read
        // as "it is breezy" rather than "you are pressing too hard right now". Keyed on
        // heel it goes out the moment the player bears away, which is what makes it a cue
        // rather than a label.
        if (UI.overpoweredBadge) {
            const op = (player.heel || 0) > OVERPOWERED.heelThreshold
                && state.race.status === 'racing' && !player.raceState.finished;
            UI.overpoweredBadge.classList.toggle('hidden', !op);
        }

        if (UI.speed) {
            UI.speed.textContent = (player.speed*4).toFixed(1);

            // Remove all potential color classes first
            UI.speed.classList.remove('text-red-400', 'text-green-400', 'text-cyan-400', 'text-white');

            if (player.raceState.penalty || player.badAirIntensity > 0.05) {
                UI.speed.classList.add('text-red-400');
            } else if (player.raceState.isPlaning) {
                // Planing Indicator
                UI.speed.classList.add('text-cyan-400');
                if (!UI.speed.textContent.includes('PLANE')) {
                     // Hacky way to add indicator near speed if layout allows?
                     // Or just rely on color.
                     // The requirement said: "Add a “PLANING” indicator in the sailing HUD"
                }
            } else {
                UI.speed.classList.add('text-white');
            }

            // Explicit PLANING label injection if not present
            let planingLabel = document.getElementById('hud-planing-label');
            if (!planingLabel && UI.speed.parentElement) {
                 planingLabel = document.createElement('div');
                 planingLabel.id = 'hud-planing-label';
                 planingLabel.className = 'absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] font-black tracking-widest text-cyan-400 hidden';
                 planingLabel.textContent = 'PLANING';
                 UI.speed.parentElement.style.position = 'relative';
                 UI.speed.parentElement.appendChild(planingLabel);
            }

            if (planingLabel) {
                if (player.raceState.isPlaning) planingLabel.classList.remove('hidden');
                else planingLabel.classList.add('hidden');
            }
        }
        if (UI.windSpeed) {
             UI.windSpeed.textContent = localWind.speed.toFixed(1);

             // Remove all potential color classes
             UI.windSpeed.classList.remove('text-rose-300', 'text-emerald-300', 'text-red-400', 'text-green-400', 'text-orange-400', 'text-white');

             // ── MORE OR LESS PRESSURE THAN NORMAL *FOR THIS COURSE* ─────────────
             // This used to compare against `state.wind.speed` — the region blend at ONE
             // POINT, the route centroid — with a 0.1 kt deadband. That is fine on the nine
             // venues that state a single uniform wind region and meaningless on the one
             // that does not: on Glacier Sound the centroid sits in the katabatic tongue at
             // 20 kt while the racing corridor runs 12-18, so "below average" was true on
             // 100% of frames and the readout was permanently red. It was reporting where
             // the centroid is, not what the sailor is in.
             //
             // The course's own p10/p90 (`computeWindPressureScale`, over sailable water
             // inside the mark box, averaged across the oscillation and widened to at least
             // +/-18% of the median) is the honest reference, and it is already computed —
             // it is what the wind comets are drawn from. Sharing it means the number turns
             // gold exactly when the comets around the boat do, instead of the HUD and the
             // water disagreeing about the same breeze.
             //
             // `hi` also carries headroom for half the largest authored gust, so on a venue
             // with puffs green means A PUFF rather than "slightly windier over here".
             const P = state.wind.pressure;
             const refMed = P ? P.med : state.wind.speed;
             const refLo = P ? P.lo : refMed - 0.1;
             const refHi = P ? P.hi : refMed + 0.1;
             const effectiveSpeed = localWind.speed * (1.0 - player.badAirIntensity);

             if (player.badAirIntensity > 0.05) {
                 // Dirty air is its own answer and outranks the field: the number is down
                 // because of the boat in front, which is a thing to sail out of rather
                 // than a patch of water to look for.
                 UI.windSpeed.classList.add('text-rose-300');
             } else if (effectiveSpeed > refHi) {
                 UI.windSpeed.classList.add('text-emerald-300');
             } else if (effectiveSpeed < refLo) {
                 UI.windSpeed.classList.add('text-rose-300');
             } else {
                 UI.windSpeed.classList.add('text-white');
             }

             if (player.badAirIntensity > 0.05) {
                 if (!UI.windSpeed.textContent.includes('↓')) UI.windSpeed.textContent += ' ↓';
             }
        }
        if (UI.windAngle) {
            const twa = Math.round(Math.abs(normalizeAngle(player.heading - localWind.direction))*(180/Math.PI));
            UI.windAngle.textContent = `${twa}°`;
        }
        if (UI.vmg) UI.vmg.textContent = Math.abs((player.speed*4)*Math.cos(normalizeAngle(player.heading - localWind.direction))).toFixed(1);

        if (UI.timer) {
            let displayTime = state.race.timer;
            let timerClass = 'text-white';

            if (state.race.status === 'prestart') {
                displayTime = -state.race.timer;
                if (state.race.timer < 10) timerClass = 'text-orange-400';
            } else if (player.raceState.finished) {
                displayTime = player.raceState.finishTime;
                timerClass = 'text-green-400';
            } else if (state.race.status === 'finished') {
                timerClass = 'text-green-400';
            }

            UI.timer.textContent = formatTime(displayTime);
            UI.timer.className = `t-mono text-4xl tracking-widest drop-shadow-md ${timerClass}`;
        }

        if (UI.startTime) {
            if (player.raceState.legSplitTimer > 0) {
                UI.startTime.textContent = formatSplitTime(player.raceState.lastLegDuration);
                UI.startTime.classList.remove('hidden');
            } else if (player.raceState.startTimeDisplayTimer > 0) {
                UI.startTime.textContent = '+' + player.raceState.startTimeDisplay.toFixed(3) + 's';
                UI.startTime.classList.remove('hidden');
            } else {
                UI.startTime.classList.add('hidden');
            }
        }

        if (UI.legInfo) {
             const vn = venueDisplayName(settings.venue);
             UI.legInfo.textContent = vn ? vn.toUpperCase() : "";
        }

        if (UI.legTimes) {
            // legTimes is its own positioned container now, so it no longer inherits
            // the venue caption's hidden state — it has to gate on 'waiting' itself
            // or stale splits would show over the venue picker.
            const legTimesHidden = state.race.status === 'prestart' || state.race.status === 'waiting';
            UI.legTimes.classList.toggle('hidden', legTimesHidden);
            if (!legTimesHidden) {
                 let html = "";
                 const getMoves = (i) => player.raceState.legManeuvers[i] || 0;
                 const getDist = (i) => Math.round(player.raceState.legDistances[i] || 0);
                 const getTop = (i) => (player.raceState.legTopSpeeds[i] || 0).toFixed(1);

                 // Split times are for the player; Top/Dist/Moves is telemetry
                 // and reads as dev output on screen, so it rides F8 debug.
                 const tele = (i) => settings.debugMode
                     ? ` <span class="t-mono text-slate-500" style="font-size:10px;">Top:${getTop(i)}kn Dist:${getDist(i)}m Moves:${getMoves(i)}</span>`
                     : '';
                 const CHIP = 'bg-slate-900/60 px-2 py-0.5 rounded border-r-2 border-slate-500 shadow-md flex justify-between gap-4';

                 if (player.raceState.startLegDuration !== null) {
                     html += `<div class="${CHIP}"><span class="t-mono text-slate-300" style="font-size:11px;">Start ${formatSplitTime(player.raceState.startLegDuration)}</span>${tele(0)}</div>`;
                 }
                 player.raceState.legTimes.forEach((t, i) => {
                     html += `<div class="${CHIP}"><span class="t-mono text-slate-300" style="font-size:11px;">Leg ${i+1} ${formatSplitTime(t)}</span>${tele(i+1)}</div>`;
                 });
                 if ((state.race.status==='racing' || state.race.status==='prestart') && player.raceState.leg <= state.race.totalLegs) {
                     const cur = player.raceState.leg;
                     const t = (cur===0) ? state.race.timer : (state.race.timer - player.raceState.legStartTime);
                     const lbl = (cur===0) ? "Start" : `Leg ${cur}`;
                     const teleCur = settings.debugMode
                         ? ` <span class="t-mono text-white/50" style="font-size:10px;">Top:${getTop(cur)}kn Dist:${getDist(cur)}m Moves:${getMoves(cur)}</span>`
                         : '';
                     html += `<div class="bg-slate-900/80 px-2 py-0.5 rounded border-r-2 border-green-500 shadow-md flex justify-between gap-4"><span class="t-mono text-white" style="font-size:11px;">${lbl} ${formatSplitTime(t)}</span>${teleCur}</div>`;
                 }
                 UI.legTimes.innerHTML = html;
            }
        }
    }
}

let lastTime = 0;
function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (!state.paused) {
        let iterations = 1;
        if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) {
            iterations = 10;
        }

        const step = Math.min(dt, 0.1) * (state.gameSpeed || 1.0);
        for (let i = 0; i < iterations; i++) {
            update(step);
        }
        draw();
    }
    requestAnimationFrame(loop);
}

function repositionBoats() {
    if (!state.boats || state.boats.length === 0) return;

    // BACK FROM THE LINE is a fact about the LINE, not about the wind: the pre-start side is
    // whichever side the route says the fleet crosses FROM. This used to be the reciprocal of
    // the wind vector, which is the same thing only while the line happens to lie square to
    // the breeze. On Glacier Sound the two are 80 degrees apart, so "400 units back" slid the
    // fleet 400 units ALONG the line instead — boats ended up 60 units off it, smeared past
    // the committee end, and over it before the gun.
    const cross = startCrossNormal();
    const backX = -cross.x;
    const backY = -cross.y;

    // Start Line Center and Geometry
    if (!state.course.marks || state.course.marks.length < 2) return;
    const [m0, m1] = startLinePts();
    const cx = (m0.x + m1.x) / 2;
    const cy = (m0.y + m1.y) / 2;

    const lDx = m1.x - m0.x;
    const lDy = m1.y - m0.y;
    const lLen = Math.sqrt(lDx*lDx + lDy*lDy);
    const rx = lDx / lLen;
    const ry = lDy / lLen;

    // Spawn at 400 units back
    const distBack = 400;

    // Lane-based grid. Each boat owns an evenly-spaced lane WITHIN the start
    // segment and spawns directly behind it, so it lines up with the line and can
    // run straight up without converging laterally (the old layout spread boats
    // ~2.5x the line width and shuffled them independent of their target lane, so
    // most crossed outside the segment and never started cleanly). Each AI boat's
    // start target (startLinePct) is set to its lane so spawn == target.
    const N = state.boats.length;
    const loPct = 0.15, hiPct = 0.85;
    let favBias = 0;
    try { favBias = (getFavoredEnd() === 1 ? 1 : -1) * 0.06; } catch (e) {}

    // Shuffle which boat gets which lane.
    const laneIdx = [];
    for (let i = 0; i < N; i++) laneIdx.push(i);
    for (let i = laneIdx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [laneIdx[i], laneIdx[j]] = [laneIdx[j], laneIdx[i]];
    }

    // Lane-aligned spawn. Each boat owns a lane within the start segment and spawns
    // directly behind it, so it lines up with the line and runs straight up without
    // converging laterally. (The old layout spread boats ~2.5x the line width and
    // shuffled them independent of their target lane, so most crossed outside the
    // segment and never started cleanly.) The start controller stages each boat just
    // behind the line in its lane and times a short crossing on the gun.
    let bi = 0;
    for (const boat of state.boats) {
        const k = laneIdx[bi++];
        let pct = N > 1 ? loPct + (hiPct - loPct) * (k / (N - 1)) : 0.5;
        pct = Math.max(0.1, Math.min(0.9, pct + favBias));

        const laneX = cx + (m1.x - m0.x) * (pct - 0.5);
        const laneY = cy + (m1.y - m0.y) * (pct - 0.5);
        const scatter = (Math.random() - 0.5) * 120;   // depth (along-wind) scatter
        const jitterLat = (Math.random() - 0.5) * 20;  // small lateral jitter
        const sx = laneX + backX * (distBack + scatter) + rx * jitterLat;
        const sy = laneY + backY * (distBack + scatter) + ry * jitterLat;

        boat.x = sx;
        boat.y = sy;

        // THE WIND EACH BOAT IS ACTUALLY LYING IN, sampled where it floats. A venue whose
        // regions bend the breeze has no single start-line wind: on Glacier Sound the mean is
        // 130 degrees and the line reads 217, so heading the whole fleet at the mean left
        // every boat ~87 degrees off the air it was sitting in. Per boat, because the gradient
        // runs ACROSS the line as well as along the course.
        const lw = getWindAt(sx, sy).direction;

        if (boat.isPlayer) {
            boat.heading = lw; // Head to wind — the wind HERE
            boat.velocity = { x: 0, y: 0 };
            boat.speed = 0;
        } else {
            if (boat.ai) boat.ai.startLinePct = pct;
            if (boat.controller) {
                boat.controller.startLinePct = pct;
                boat.controller.startStageDepth = 60;
            }
            // Start on Starboard Tack (Close Hauled)
            boat.heading = normalizeAngle(lw + Math.PI / 4);
            boat.speed = 0.5;
            boat.velocity = {
                x: Math.sin(boat.heading) * boat.speed,
                y: -Math.cos(boat.heading) * boat.speed
            };
        }
        boat.prevHeading = boat.heading;
        if (boat.raceState) boat.raceState.lastPos = { x: boat.x, y: boat.y };
    }
}

// Island Logic
function generateIslands(boundary) {
    const islands = [];
    // User Settings
    const islandCount = state.race.conditions.islandCount || 0;
    if (islandCount <= 0) return [];

    const maxSizeSetting = state.race.conditions.islandMaxSize !== undefined ? state.race.conditions.islandMaxSize : 0.5;
    const clustering = state.race.conditions.islandClustering !== undefined ? state.race.conditions.islandClustering : 0.5;

    // Use seeded RNG if available, else standard random (fallback)
    const rng = state.race.seed ? mulberry32(state.race.seed) : Math.random;

    // Radius Range logic
    // Smallest possible island: 100 units
    // Max size setting 1.0 -> 1200 units
    // Min size setting 0.0 -> 200 units (max for that setting)

    // "Max size of Islands" determines the upper bound for the first island and the random range for others.
    const absoluteMinR = 80;
    const absoluteMaxR = 200 + maxSizeSetting * 1000; // 200 to 1200

    // Boundary Constraints
    const maxWorldR = boundary.radius - 200;

    // Avoidance Geometry
    const marks = state.course.marks;
    if (!marks || marks.length < 4) return [];

    const _ax = courseAxis();
    const mStart = _ax.start, mUpwind = _ax.windward;
    
    // Helper: Generate a jagged polygon for a body
    const createIslandBody = (bx, by, br) => {
        const vertices = [];
        const points = 7 + Math.floor(rng() * 6);
        for(let j=0; j<points; j++) {
            const theta = (j / points) * Math.PI * 2;
            const r = br * (0.7 + rng() * 0.6);
            vertices.push({
                x: bx + Math.cos(theta) * r,
                y: by + Math.sin(theta) * r
            });
        }
        // Veg Poly (Inner)
        const vegVertices = vertices.map(v => ({
            x: bx + (v.x - bx) * 0.75,
            y: by + (v.y - by) * 0.75
        }));
        // Trees
        const trees = [];
        const treeCount = Math.floor(2 + (br/60) * 2 + rng() * 3);
        for(let k=0; k<treeCount; k++) {
             const ang = rng() * Math.PI * 2;
             const dst = rng() * br * 0.4;
             trees.push({
                 x: bx + Math.cos(ang)*dst,
                 y: by + Math.sin(ang)*dst,
                 size: 14 + rng()*10,
                 rotation: rng() * Math.PI * 2
             });
        }
        // Rocks
        const rocks = [];
        const rockCount = Math.floor(1 + (br/50) * 3 + rng() * 2);
        for(let k=0; k<rockCount; k++) {
             const ang = rng() * Math.PI * 2;
             const dst = br * (0.65 + rng() * 0.15);
             rocks.push({
                 x: bx + Math.cos(ang)*dst,
                 y: by + Math.sin(ang)*dst,
                 size: 8 + rng() * 12,
                 rotation: rng() * Math.PI * 2
             });
        }
        // Venue styling: swamp grass islands are marsh — soft groundings
        // (speed loss but no rules penalty), and rendered as grass.
        const style = state.race.conditions.islandStyle || 'tropical';
        return { x: bx, y: by, radius: br, vertices, vegVertices, trees, rocks, style, soft: style === 'grass' || style === 'redrock' };
    };

    // Helper: Validate a circle
    const isValidCircle = (cx, cy, cr) => {
         // Boundary
         if ((cx-boundary.x)**2 + (cy-boundary.y)**2 > (maxWorldR - cr)**2) return false;

         // Marks (Strict)
         const markClearance = 350 + cr;
         for (const m of marks) {
            if ((cx-m.x)**2 + (cy-m.y)**2 < markClearance**2) return false;
         }

         // Start/Finish Boxes
         const boxClearance = 500 + cr;
         if ((cx-mStart.x)**2 + (cy-mStart.y)**2 < boxClearance**2) return false;
         if ((cx-mUpwind.x)**2 + (cy-mUpwind.y)**2 < boxClearance**2) return false;

         // Overlap with existing islands
         for (const isl of islands) {
             const dSq = (cx-isl.x)**2 + (cy-isl.y)**2;
             const minDist = cr + isl.radius + 30;
             if (dSq < minDist**2) return false;
         }
         return true;
    };

    // Main Generation Loop
    let clusterCenter = null;
    let fails = 0;

    for (let i = 0; i < islandCount; i++) {
        if (fails > 50) break;

        // Size Determination
        let r = 0;
        if (i === 0) {
            // First island is "Biggest" (according to size setting)
            // But if user selected "Small", biggest is small.
            // If user selected "Large", biggest is large.
            // Let's use the absoluteMaxR derived from setting.
            r = absoluteMaxR;
        } else {
            // Others are random sizes up to that size
            r = absoluteMinR + rng() * (absoluteMaxR - absoluteMinR);
        }
        
        // Position
        let x, y, valid = false, attempts = 0;

        // Dispersion Logic
        // Clustering 0: Scattered (use full map)
        // Clustering 1: Grouped (tight cluster around first island)
        let center = { x: boundary.x, y: boundary.y };
        let radiusLimit = maxWorldR;

        if (i > 0 && clusterCenter) {
            // If we have a cluster center (first island), we bias towards it.
            // 0 clustering -> infinite range (bounded by world)
            // 1 clustering -> tight range (e.g. 1.5 * maxR)
            center = clusterCenter;

            // Map clustering 0-1 to range
            // 1.0 -> tight (r * 1.5)
            // 0.0 -> loose (world size)

            // Actually, "clustered based on clustering setting" suggests probabilistic or bounded.
            // Let's use a bounded circle around the first island.
            const tightDist = absoluteMaxR * 1.5;
            const looseDist = boundary.radius * 2; // Full map
            const searchDist = tightDist + (1.0 - clustering) * (looseDist - tightDist);

            radiusLimit = searchDist;
        }

        while (!valid && attempts < 50) {
            attempts++;

            let dist, angle;
            if (i === 0 || clustering < 0.1) {
                // First island or totally scattered: Random in world
                angle = rng() * Math.PI * 2;
                dist = Math.sqrt(rng()) * maxWorldR;
                x = boundary.x + Math.cos(angle) * dist;
                y = boundary.y + Math.sin(angle) * dist;
            } else {
                // Biased towards cluster center
                angle = rng() * Math.PI * 2;
                dist = Math.sqrt(rng()) * radiusLimit; // Bias towards center? sqrt(rng) is uniform in circle.
                // To make it more clustered, maybe power of rng?
                // But limiting radius is enough.

                x = center.x + Math.cos(angle) * dist;
                y = center.y + Math.sin(angle) * dist;
            }

            if (isValidCircle(x, y, r)) {
                valid = true;
            } else {
                // Retry with smaller radius?
                if (i > 0 && attempts > 20) {
                    r *= 0.9;
                    if (r < absoluteMinR) r = absoluteMinR;
                }
            }
        }

        if (valid) {
            const body = createIslandBody(x, y, r);
            islands.push(body);
            if (i === 0) {
                clusterCenter = { x: x, y: y };
            }
        } else {
            fails++;
            // Don't increment i (retry this island count? No, loop continues)
            // To retry the count, we should decrement i, but prevent infinite loop.
            // Here we just skip it if we fail too much.
        }
    }
    
    return islands;
}

function checkCourseNavigability(islands, marks) {
    if (!islands || islands.length === 0) return true;
    
    // Grid Flood Fill
    // Define bounds based on course boundary radius
    const radius = state.course.boundary ? state.course.boundary.radius : 4000;
    const pad = 200;
    const minX = state.course.boundary.x - radius - pad;
    const maxX = state.course.boundary.x + radius + pad;
    const minY = state.course.boundary.y - radius - pad;
    const maxY = state.course.boundary.y + radius + pad;

    const resolution = 100; // 100 unit grid
    const cols = Math.ceil((maxX - minX) / resolution);
    const rows = Math.ceil((maxY - minY) / resolution);
    
    const grid = new Uint8Array(cols * rows); // 0=water, 1=island
    
    // Rasterize islands roughly
    // optimization: only check cells near islands
    for(const isl of islands) {
        // Bounding box in grid coords
        const c1 = Math.floor((isl.x - isl.radius - minX) / resolution);
        const c2 = Math.ceil((isl.x + isl.radius - minX) / resolution);
        const r1 = Math.floor((isl.y - isl.radius - minY) / resolution);
        const r2 = Math.ceil((isl.y + isl.radius - minY) / resolution);
        
        for(let c=c1; c<c2; c++) {
            for(let r=r1; r<r2; r++) {
                if(c>=0 && c<cols && r>=0 && r<rows) {
                    const wx = minX + c * resolution + resolution/2;
                    const wy = minY + r * resolution + resolution/2;
                    if ((wx-isl.x)**2 + (wy-isl.y)**2 < isl.radius**2) {
                        grid[r*cols + c] = 1;
                    }
                }
            }
        }
    }
    
    // Start Point (Start Line Center)
    const _ax0 = courseAxis();
    const sx = _ax0.start.x;
    const sy = _ax0.start.y;
    const startC = Math.floor((sx - minX) / resolution);
    const startR = Math.floor((sy - minY) / resolution);
    
    // Target Point (Upwind Gate Center)
    const tx = _ax0.windward.x;
    const ty = _ax0.windward.y;
    const targetC = Math.floor((tx - minX) / resolution);
    const targetR = Math.floor((ty - minY) / resolution);
    
    if (grid[startR*cols + startC] === 1) return false; // Start blocked (unlikely due to generation checks)
    if (grid[targetR*cols + targetC] === 1) return false; // Target blocked
    
    // BFS
    const queue = [startR*cols + startC];
    const visited = new Uint8Array(cols * rows);
    visited[startR*cols + startC] = 1;
    
    let found = false;
    while(queue.length > 0) {
        const idx = queue.shift();
        if (idx === targetR*cols + targetC) {
            found = true;
            break;
        }
        
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        
        // Neighbors (4-way)
        const neighbors = [
            {r: r+1, c: c}, {r: r-1, c: c},
            {r: r, c: c+1}, {r: r, c: c-1}
        ];
        
        for(const n of neighbors) {
            if (n.r >= 0 && n.r < rows && n.c >= 0 && n.c < cols) {
                const nIdx = n.r*cols + n.c;
                if (!visited[nIdx] && grid[nIdx] === 0) {
                    visited[nIdx] = 1;
                    queue.push(nIdx);
                }
            }
        }
    }
    
    return found;
}

// Boat hull half-width for coarse collision against concave mask coastlines.
// How far out a rounding still counts, as a multiple of the mark's zone. The zone is
// the pass-within distance; this is the go-round-it distance. Generous enough that a
// wide, seamanlike rounding registers, bounded so circling far away does not.
const ROUND_ACTIVE = 2.5;
// A wide rounding sweeps a little less than the ideal, so the requirement is not the
// full geometric angle. Low enough to accept honest wide roundings, high enough that
// passing near the mark cannot pretend to be one.
const ROUND_SWEEP_TOL = 0.75;

// CLEARANCE radius, not the collider. The boat is 30 wide and 55 long, so 30 is roughly its
// half-LENGTH — the room it needs to turn in, which is the right question for "does this gap
// admit a boat" and the wrong one for "did I touch that berg". Collision uses the hull
// itself (getHullPolygon, HULL_DISCS); sailcheck.js keeps its own copy of this number for
// the same planning purpose and should stay conservative.
const HULL_R = 30;

// Circle vs (possibly concave, possibly keyholed) polygon. Returns the same
// {axis, overlap} shape satPolygonPolygon does, so the caller is unchanged.
// Handles the boat being INSIDE the shape too, which happens if it is pushed
// through by another boat — it escapes via the nearest edge rather than sticking.
function circlePolyCollide(cx, cy, r, verts) {
    let bestD2 = Infinity, bx = 0, by = 0;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const ax = verts[j].x, ay = verts[j].y, bx2 = verts[i].x, by2 = verts[i].y;
        const ex = bx2 - ax, ey = by2 - ay;
        const len2 = ex * ex + ey * ey || 1;
        let t = ((cx - ax) * ex + (cy - ay) * ey) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + ex * t, py = ay + ey * t;
        const d2 = (cx - px) ** 2 + (cy - py) ** 2;
        if (d2 < bestD2) { bestD2 = d2; bx = px; by = py; }
    }
    const inside = pointInPoly(cx, cy, verts);
    const d = Math.sqrt(bestD2);
    if (!inside && d >= r) return null;
    // axis points from the surface toward the boat; caller subtracts it.
    let nx = (cx - bx) / (d || 1), ny = (cy - by) / (d || 1);
    if (inside) { nx = -nx; ny = -ny; }
    return { axis: { x: -nx, y: -ny }, overlap: inside ? d + r : r - d };
}

// ── THE HULL AGAINST CONCAVE LAND ───────────────────────────────────────────
// Land traced from a mask is concave and keyholed, and SAT is a convex test, so this path
// used ONE circle of radius HULL_R = 30 about the boat's centre instead. The hull is 30 wide
// and 55 long — half-beam 15 — so that circle was TWICE the boat's actual beam. You could be
// most of a boat-width clear of a berg abeam and still ground on it, which is what "I
// collided with an island when I hadn't actually hit it" is.
//
// A chain of discs down the centreline instead, each sized to the hull's real half-width
// there, so the collider tapers into the bow the way the boat does. Still exact against
// concave outlines (each disc is a circle-vs-polygon test, the primitive that was already
// right), still cheap, and it no longer claims beam the boat does not have.
//
// Offsets are read off getHullPolygon: x = ±15 between y = -5 and y = +20, tapering to a
// point at the bow (y = -25) and to ±12 at the transom (y = +30).
const HULL_DISCS = [
    { y: -20, r: 4.5 }, { y: -12, r: 10 }, { y: -3, r: 15 },
    { y:   8, r: 15 }, { y:  19, r: 15 }, { y: 27, r: 12 }
];
function hullPolyCollide(boat, verts) {
    const cos = Math.cos(boat.heading), sin = Math.sin(boat.heading);
    let worst = null;
    for (const d of HULL_DISCS) {
        // Local (0, d.y) rotated into the world — the discs sit on the centreline.
        const wx = boat.x - d.y * sin, wy = boat.y + d.y * cos;
        const hit = circlePolyCollide(wx, wy, d.r, verts);
        // Deepest wins, so the push-out clears the worst-embedded part of the hull rather
        // than whichever disc happened to be tested last.
        if (hit && (!worst || hit.overlap > worst.overlap)) worst = hit;
    }
    return worst;
}

function checkIslandCollisions(dt) {
    if (!state.course || !state.course.islands) return;

    for (const boat of state.boats) {
        if (boat.raceState.finished && boat.fadeTimer <= 0) continue;

        // Optimization: Broad phase
        let potential = false;
        for (const isl of state.course.islands) {
            const dx = boat.x - isl.x;
            const dy = boat.y - isl.y;
            if (dx*dx + dy*dy < (isl.radius + 50)**2) { potential = true; break; }
        }
        if (!potential) continue;

        const boatPoly = getHullPolygon(boat);

        for (const isl of state.course.islands) {
            const dx = boat.x - isl.x;
            const dy = boat.y - isl.y;
            if (dx*dx + dy*dy > (isl.radius + 50)**2) continue;

            // Mask landmasses are concave and keyholed, and SAT is a CONVEX test —
            // run against them it collides with their convex hull, which spans
            // most of the map and reads as invisible walls all over open water.
            // Circle-vs-polygon instead: exact for concave shapes, and cheap.
            const res = isl.fromMask
                ? hullPolyCollide(boat, isl.vertices)
                : satPolygonPolygon(boatPoly, isl.vertices);
            if (res) {
                 // Push boat OUT
                 boat.x -= res.axis.x * res.overlap;
                 boat.y -= res.axis.y * res.overlap;

                 // Grounding Penalty: Lose 60% speed instantly + massive drag
                 boat.speed *= 0.4;

                 // Tell the AI it is ON the ice, exactly as mark contact does. Without
                 // this the avoidance cost function sees every candidate blocked (the
                 // hull is inside the collider), falls back to least-deviation, and
                 // holds course INTO the floe — measured 16-second grinds at 120
                 // contacts/second on Glacier Sound.
                 if (boat.ai) boat.ai.collisionData = { type: 'island', normal: res.axis, isFloe: !!isl.isFloe };

                 // Groundings are the Arctic's real cost driver — surface them
                 // so the eval harness can measure ice avoidance directly
                 // instead of inferring it from race time.
                 if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
                     window.onRaceEvent('collision_island', { boat, isFloe: !!isl.isFloe });
                 }

                 // RRS 19 (Room at an Obstruction): if an overlapped boat sat
                 // OUTSIDE us (between us and open water) while we hit the
                 // land, she denied us room — the foul is hers, not ours.
                 let squeezer = null;
                 if (state.race.status === 'racing' && window.Rules && window.Rules.isOverlapped) {
                     const bx = boat.x - isl.x, by = boat.y - isl.y;
                     const bl = Math.max(1, Math.sqrt(bx * bx + by * by));
                     const ax = bx / bl, ay = by / bl; // escape direction: island -> boat
                     for (const o of state.boats) {
                         if (o === boat || o.raceState.finished) continue;
                         const dx2 = o.x - boat.x, dy2 = o.y - boat.y;
                         // Tight attribution: blame only a boat close aboard
                         // (~2.5 lengths) sitting clearly on our open-water
                         // side — generous ranges over-penalized polar packs
                         // that were all legitimately dodging the same floe.
                         if (dx2 * dx2 + dy2 * dy2 > 130 * 130) continue;
                         if (dx2 * ax + dy2 * ay < 45) continue;        // not clearly outside us
                         if (!window.Rules.isOverlapped(boat, o)) continue;
                         squeezer = o;
                         break;
                     }
                 }
                 if (squeezer) {
                     triggerPenalty(squeezer, { rule: 'Rule 19', reason: 'Denied Room at Obstruction', kind: 'no-contact' });
                 }

                 // ── NO PENALTY FOR RUNNING AGROUND ──────────────────────────
                 // Land is not a mark. RRS 31 is "touching a mark", and the rest of Part 2
                 // is boat-on-boat — there is no rule against hitting an island, because
                 // the rocks already administer the punishment. Grounding cost a 360° turn
                 // here, which was both wrong as a rule and wrong as a game: the boat has
                 // already lost 60% of its speed, and the spin was a second, larger, purely
                 // invented penalty on top.
                 //
                 // What SURVIVES is Rule 19 above: if another boat denied you room at the
                 // obstruction, that is a real foul and it is HERS. That is the only
                 // penalty land can produce, and it is still assessed against the squeezer.
                 // (The measurement event already fired above, once, with its isFloe tag —
                 // this used to fire a second copy and every grounding counted double.)
            }
        }
    }
}

// Per-style palettes: tropical (default), grass (swamp/river banks), ice (polar floes)
const ISLAND_STYLES = {
    tropical: { body: '#fde6b1', stroke: '#d4b483', veg: '#84cc16', rock: '#9ca3af', trees: true },
    grass:    { body: '#a89b6a', stroke: '#7d7048', veg: '#4d7c0f', rock: '#8a8a7a', trees: true },
    ice:      { body: '#e6f2fb', stroke: '#7fb2d9', veg: '#ffffff', rock: '#8fc2e8', trees: false },
    redrock:  { body: '#c2703e', stroke: '#8a4a26', veg: '#d98e57', rock: '#7c4a2d', trees: false },
    // Bare granite: dark, cold and jagged. Traced angular like ice (see the
    // tracer pick below) because it is broken rock, not a rounded sandbank.
    granite:  { body: '#4b5563', stroke: '#1f2937', veg: '#5b6673', rock: '#374151', trees: false }
};

// Ice is faceted, not rounded — the style guide asks for literal low-poly
// facets and crisp edges, and the aerial references are all hard planes and
// snapped corners. Straight segments where land gets smoothed curves.
function traceAngularPoly(g, vertices) {
    if (vertices.length < 3) return;
    g.beginPath();
    g.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) g.lineTo(vertices[i].x, vertices[i].y);
    g.closePath();
}

function traceRoundedPoly(g, vertices) {
    if (vertices.length < 3) return;
    g.beginPath();
    const last = vertices[vertices.length - 1];
    const first = vertices[0];
    let midX = (last.x + first.x) / 2;
    let midY = (last.y + first.y) / 2;
    g.moveTo(midX, midY);
    for (let i = 0; i < vertices.length; i++) {
        const p = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        midX = (p.x + next.x) / 2;
        midY = (p.y + next.y) / 2;
        g.quadraticCurveTo(p.x, p.y, midX, midY);
    }
    g.closePath();
}

// Bake one island (glow, body, veg, rocks, trees) into an offscreen sprite.
// Islands are static, so this runs ONCE per island per race. The live path
// previously paid a 30px shadowBlur glow, three curve fills, and double
// ctx.filter tree draws PER FRAME — ablation showed drawIslands alone took the
// swamp from 58 to 12 FPS.
//
// Floes now SPIN, which they could not before. Their sprite is therefore baked
// in the floe's own local frame (origin at its centre, spin zero) and rotated at
// draw time; baking world-space geometry would freeze whatever heading the floe
// happened to hold at bake time and then rotate it a second time on screen.
// The drawn outline is the art shape, not the convex collider.
function bakeIslandSprite(isl) {
    const st = ISLAND_STYLES[isl.style] || ISLAND_STYLES.tropical;
    const isFloe = !!isl.isFloe;
    const VERTS = isFloe ? isl.localArt : isl.vertices;
    const VEG = isFloe ? isl.localVeg : isl.vegVertices;
    const ox = isFloe ? 0 : isl.x, oy = isFloe ? 0 : isl.y;
    const trace = (isl.style === 'ice' || isl.style === 'granite') ? traceAngularPoly : traceRoundedPoly;

    let maxR = isl.radius;
    for (const v of VERTS) {
        const d = Math.sqrt((v.x - ox) ** 2 + (v.y - oy) ** 2);
        if (d > maxR) maxR = d;
    }
    // Glow blur + tree canopy overhang margin; ice needs room for the
    // underwater shelf ring (vertices scaled ~1.3)
    const spriteR = isl.style === 'ice' ? maxR * 1.35 + 60 : maxR + 100;
    // Cap texture size; big islands render slightly downscaled (soft look anyway)
    const scale = Math.min(1, 900 / spriteR);
    const size = Math.max(8, Math.ceil(spriteR * 2 * scale));

    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.scale(scale, scale);
    g.translate(spriteR - ox, spriteR - oy); // shape coords -> sprite space

    if (isl.style === 'ice') {
        // Underwater ice shelf: the drowned shoulder that glows pale turquoise
        // around a real berg — the signature of every aerial reference. Two
        // translucent rings scaled out from the outline.
        const ring = (k) => VERTS.map(v => ({ x: ox + (v.x - ox) * k, y: oy + (v.y - oy) * k }));
        g.save();
        g.fillStyle = 'rgba(74, 144, 200, 0.45)';
        trace(g, ring(1.28));
        g.fill();
        g.fillStyle = 'rgba(120, 180, 226, 0.42)';
        trace(g, ring(1.12));
        g.fill();
        g.restore();
    } else if (window.WATER_CONFIG && window.WATER_CONFIG.shorelineGlowSize > 0) {
        // Shoreline Glow
        g.save();
        g.shadowColor = window.WATER_CONFIG.shorelineColor || '#4ade80';
        g.shadowBlur = window.WATER_CONFIG.shorelineGlowSize * 20;
        g.fillStyle = window.WATER_CONFIG.shorelineColor || '#4ade80';
        g.globalAlpha = window.WATER_CONFIG.shorelineGlowOpacity || 0.5;
        trace(g, VERTS);
        g.fill();
        g.restore();
    }

    // Body
    g.strokeStyle = st.stroke;
    g.lineWidth = 2;
    g.fillStyle = st.body;
    trace(g, VERTS);
    g.stroke();
    g.fill();

    // Vegetation (snow cap on ice)
    g.fillStyle = st.veg;
    trace(g, VEG);
    g.fill();

    // Ice facets: angular translucent blue planes radiating from the centre —
    // the low-poly faceting the style guide asks for, and what reads as relief
    // on the aerial references.
    // Granite: a full fan of flat-shaded faces from the summit to every edge,
    // so the mountain reads as low-poly relief rather than a grey blob. Four
    // flat tones, hard edges, no gradients — the reference art's language.
    if (isl.style === 'granite' && isl.facets && isl.facets.length) {
        const GREY = ['#2a323d', '#39424f', '#4b5563', '#5d6775'];
        for (const f of isl.facets) {
            const v1 = VERTS[f.i % VERTS.length];
            const v2 = VERTS[(f.i + 1) % VERTS.length];
            const step = Math.min(3, Math.max(0, Math.floor((f.lit + 1) * 2)));
            g.fillStyle = GREY[step];
            g.beginPath();
            g.moveTo(ox, oy);              // summit
            g.lineTo(v1.x, v1.y);
            g.lineTo(v2.x, v2.y);
            g.closePath();
            g.fill();
        }
        // Snow catching on the highest faces
        g.fillStyle = 'rgba(226, 240, 252, 0.9)';
        trace(g, VEG);
        g.fill();
    }

    if (isl.style === 'ice' && isl.facets && isl.facets.length) {
        for (const f of isl.facets) {
            const v1 = VERTS[f.i % VERTS.length];
            const v2 = VERTS[(f.i + 1) % VERTS.length];
            g.fillStyle = f.shade < 0.5 ? 'rgba(122, 176, 222, 0.4)' : 'rgba(78, 138, 194, 0.35)';
            g.beginPath();
            g.moveTo(ox + (v1.x - ox) * f.depth, oy + (v1.y - oy) * f.depth);
            g.lineTo(v1.x, v1.y);
            g.lineTo(v2.x, v2.y);
            g.closePath();
            g.fill();
        }
    }

    // Pressure cracks (ice only): thin glacial-blue fractures. Clipped to the
    // outline — a crack is a fracture IN the ice, so none of it may hang in open
    // water. Only this block is clipped, not the whole sprite: land islands let
    // their tree canopies overhang on purpose, and the sprite reserves margin
    // for exactly that.
    if (isl.cracks && isl.cracks.length) {
        g.save();
        trace(g, VERTS); g.clip();
        g.strokeStyle = 'rgba(64, 125, 180, 0.7)';
        g.lineWidth = 3;
        g.lineCap = 'round';
        for (const cr of isl.cracks) {
            g.beginPath();
            g.moveTo(ox + cr.ax, oy + cr.ay);
            g.quadraticCurveTo(ox + cr.mx, oy + cr.my, ox + cr.bx, oy + cr.by);
            g.stroke();
        }
        g.restore();
    }

    // Rocks
    if (isl.rocks) {
        g.fillStyle = st.rock;
        for (const rock of isl.rocks) {
            g.beginPath();
            g.arc(rock.x, rock.y, rock.size, 0, Math.PI * 2);
            g.fill();
            g.save();
            g.clip();
            g.fillStyle = 'rgba(0,0,0,0.1)';
            g.beginPath();
            g.arc(rock.x - rock.size * 0.2, rock.y + rock.size * 0.2, rock.size * 0.8, 0, Math.PI * 2);
            g.fill();
            g.restore();
            g.fillStyle = st.rock;
        }
    }

    // Trees
    if (st.trees && palmImg.complete && palmImg.naturalWidth > 0) {
        for (const t of isl.trees) {
            const tSize = t.size * 4.0;
            g.save();
            g.translate(t.x + 5, t.y + 5);
            g.rotate(t.rotation || 0);
            g.globalAlpha = 0.2;
            g.filter = "brightness(0)";
            g.drawImage(palmImg, -tSize / 2, -tSize / 2, tSize, tSize);
            g.restore();
            g.save();
            g.translate(t.x, t.y);
            g.rotate(t.rotation || 0);
            g.drawImage(palmImg, -tSize / 2, -tSize / 2, tSize, tSize);
            g.restore();
        }
    }

    isl._sprite = { canvas: c, r: spriteR, baked: palmImg.complete && palmImg.naturalWidth > 0 };
}

// `which`: 'land' for static geometry, 'floe' for drifting ice, omitted for all.
// The two are drawn in separate passes so the nav aids can sit BETWEEN them —
// ladder lines and laylines are paint on the water, and ice floats over paint.
function drawIslands(ctx) {
    if (!state.course || !state.course.islands) return;

    // Viewport Culling
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    const camX = state.camera.x;
    const camY = state.camera.y;

    for (const isl of state.course.islands) {
        // Invisible colliders: the river banks draw as one continuous mass in
        // drawRiverShore instead.
        if (isl.isBank || isl.hidden) continue;
        const distSq = (isl.x - camX) ** 2 + (isl.y - camY) ** 2;
        const limit = viewRadius + isl.radius;
        if (distSq > limit ** 2) continue;

        // Mask landmasses draw as direct paths, never baked sprites, for two
        // reasons. They are huge — the main one has a 9388-unit radius, far past
        // bakeIslandSprite's 900px cap, so it would come back a blurred postage
        // stamp. And their rings are KEYHOLED: the trace walks into the sound and
        // back out, so the water is a hole in the polygon. Canvas fills nonzero by
        // default, which fills that hole solid and paints the sea white — this
        // has to be 'evenodd'.
        if (isl.fromMask) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(isl.vertices[0].x, isl.vertices[0].y);
            for (let i = 1; i < isl.vertices.length; i++) ctx.lineTo(isl.vertices[i].x, isl.vertices[i].y);
            ctx.closePath();
            const st = ISLAND_STYLES[isl.style] || ISLAND_STYLES.ice;
            // A style with a LAND_TEXTURES entry gets the tiling surface; everything
            // else stays a flat fill. This is the FIXED-land path, so a floe never
            // reaches it — bergs keep their faceted sprite and underwater shelf.
            ctx.fillStyle = getLandPattern(ctx, isl.style, st.body) || st.body;
            ctx.fill('evenodd');
            ctx.strokeStyle = st.stroke;
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.restore();
            continue;
        }

        // Bake lazily; rebake once the palm image finishes loading. Floes carry
        // no trees and their sprite is spin-canonical, so they never rebake —
        // a rebake would capture their current heading and double it on screen.
        if (!isl._sprite || (!isl.isFloe && !isl._sprite.baked && palmImg.complete && palmImg.naturalWidth > 0)) bakeIslandSprite(isl);
        const s = isl._sprite;
        if (isl.isFloe) {
            ctx.save();
            ctx.translate(isl.x, isl.y);
            ctx.rotate(isl.spin);
            ctx.drawImage(s.canvas, -s.r, -s.r, s.r * 2, s.r * 2);
            ctx.restore();
        } else {
            ctx.drawImage(s.canvas, isl.x - s.r, isl.y - s.r, s.r * 2, s.r * 2);
        }
    }
}






// Init
// ─── COURSE ROUTE ────────────────────────────────────────────────────────────
//
// A course is MARKS (physical objects) plus a ROUTE (ordered passage
// instructions). `route[n]` describes leg n: which marks bound it, which way a
// boat must cross, and whether that crossing finishes the race.
//
// This exists to replace `leg % 2 !== 0 ? [2,3] : [0,1]`, which was repeated at
// about a dozen sites. That arithmetic IS a windward-leeward course encoded as a
// formula: marks [0,1] are the start/leeward line and [2,3] the windward gate,
// forever. No other course shape can satisfy it — which is why `islandRound` has
// to park two unused marks at [2] and [3] purely so the formula does not throw,
// and why it once drew a phantom gate at them.
//
// Route entry:
//   { kind: 'line'|'gate', marks: [i, j], dir: +1|-1, beat: bool, finish?: bool }
//   { kind: 'round', side: 'starboard'|'port' }              (mark is course.roundMark)
//
// `dir` is the sign of the crossing against the gate normal n = (dy, -dx), which
// is why mark ORDER within a pair is load-bearing and not cosmetic.
function buildRoute(type, totalLegs) {
    const route = [];
    if (type === 'islandRound') {
        route.push({ kind: 'line',  marks: [0, 1], dir: +1, role: 'start' });
        route.push({ kind: 'round', side: 'starboard',      role: 'rounding' });
        route.push({ kind: 'line',  marks: [0, 1], dir: -1, role: 'finish', finish: true });
        return route;
    }
    // Windward-leeward. Leg 0 is the start (up through the line); odd legs beat
    // to the windward gate; even legs run back down to the start/leeward line.
    //
    // Two entries are generated PAST the finish. Several draw paths query the
    // player's leg after they have finished (leg becomes totalLegs+1), and the
    // old formula happily answered for any leg. Generating the tail keeps those
    // answers identical instead of relying on a fallback.
    for (let leg = 0; leg <= totalLegs + 1; leg++) {
        route.push({
            kind: leg === 0 ? 'line' : 'gate',
            marks: (leg % 2 !== 0) ? [2, 3] : [0, 1],
            dir: (leg === 0 || leg % 2 !== 0) ? +1 : -1,
            role: leg === 0 ? 'start' : (leg % 2 !== 0 ? 'windward' : 'leeward'),
            finish: leg === totalLegs
        });
    }
    return route;
}

const routeLeg  = (leg) => (state.course && state.course.route) ? (state.course.route[leg] || null) : null;
// Marks bounding the leg's target gate/line, or null for a rounding (no gate).
const legMarks  = (leg) => { const r = routeLeg(leg); return (r && r.marks) ? r.marks : null; };
// THE mark this leg rounds, or null if it is not a rounding leg. `course.roundMark`
// is only the FIRST rounding of the course — any consumer that wants "the mark I am
// rounding NOW" must ask the route, or a multi-rounding course pins it to mark one.
const legRoundMark = (leg) => { const r = routeLeg(leg); return (r && r.kind === 'round' && r.mark) ? r.mark : null; };
const legDir    = (leg) => { const r = routeLeg(leg); return r ? r.dir : 1; };
// Is this leg sailed upwind? Leg 0 counts: the start is a beat to the line.
// Where a leg is sailed TO: a gate/line midpoint, or a rounding mark.
function legTargetPoint(leg) {
    const r = routeLeg(leg);
    if (!r) return null;
    if (r.kind === 'round') return r.mark ? { x: r.mark.x, y: r.mark.y } : null;
    return legMid(leg);
}

// Does this leg's NET DIRECTION go upwind? A geometric fact about the course, derived
// from the mean wind — used for drawing laylines and mark zones, which need to know
// which way along the course axis a leg runs.
//
// This is NOT "the boat is beating". A boat beats, reaches and runs WITHIN a single leg
// depending on its actual heading; point of sail belongs to the boat, not the leg. See
// pointOfSail() below, which is what the rules and the character stats want.
//
// It used to be an authored `beat` flag, which is a fact that can disagree with the
// course — and silently did: Glacier Sound's rounding leg was marked `beat: true` while
// its wind points AWAY from the island, making that leg a run.
const legGoesUpwind = (leg) => {
    const to = legTargetPoint(leg);
    if (!to) return false;
    let dx, dy;
    const r = routeLeg(leg);
    if (leg === 0 || !legTargetPoint(leg - 1)) {
        // No previous leg to come from, so travel is the crossing direction itself:
        // the gate normal n = (dy, -dx) times the required crossing sign.
        const idx = legMarks(leg);
        if (!idx || !state.course.marks) return false;
        const a = state.course.marks[idx[0]], b = state.course.marks[idx[1]];
        if (!a || !b) return false;
        const sgn = (r && r.dir) || 1;
        dx = (b.y - a.y) * sgn; dy = -(b.x - a.x) * sgn;
    } else {
        const from = legTargetPoint(leg - 1);
        dx = to.x - from.x; dy = to.y - from.y;
    }
    if (!dx && !dy) return false;
    // heading convention: forward = (sin h, -cos h); the wind direction is the heading
    // that points dead upwind, so TWA = windDir - heading.
    //
    // BASE direction, not the live one. Whether a leg is a beat is a property of the
    // course and the mean wind, not of the momentary shift — using the oscillating
    // `wind.direction` made the answer flicker frame to frame on any leg lying near 90
    // degrees to the breeze, which showed up immediately in the 6-leg traces.
    const heading = Math.atan2(dx, -dy);
    return Math.abs(normalizeAngle(state.wind.baseDirection - heading)) < Math.PI / 2;
};
// The finish is simply the last route entry's gate.
const finishMarks = () => legMarks(state.race.totalLegs);

// The start/finish line — by route role, not by "the pair at index 0".
const startLineMarks = () => {
    const r = state.course && state.course.route && state.course.route[0];
    return (r && r.marks) ? r.marks : [0, 1];
};
// The two start-line marks as points. Every consumer wants the objects, and each one
// that reached for `marks[0]`/`marks[1]` itself was quietly asserting that the pin and
// the boat end are the first two marks in the array. That holds for the ten venues
// shipped today, but nothing enforces it: the editor is free to author a route whose
// opening line names any pair, and the moment it does, the fleet spawns behind the
// wrong marks, the laylines draw on the wrong marks and OCS is judged against them.
const startLinePts = () => {
    const [a, b] = startLineMarks();
    const m = state.course.marks;
    return [m[a], m[b]];
};

// THE WAY THE FLEET CROSSES THE START, as a unit vector. `dir * (gateDy, -gateDx)` over the
// route entry's own mark pair — the same expression updateBoatRaceState judges a crossing
// with, so "which side is pre-start" has ONE definition and the placement, the committee
// boat's heading and the OCS test cannot disagree about it.
//
// Deliberately NOT derived from the wind. A line is crossed the way its route says, and on a
// venue whose breeze bends across the course there is no single wind to ask — asking the
// global mean is what put the fleet alongside the line instead of behind it.
const startCrossNormal = () => {
    const r = state.course && state.course.route && state.course.route[0];
    const [a, b] = startLineMarks();
    const m = state.course.marks;
    if (!m || !m[a] || !m[b]) return { x: 0, y: -1 };
    const dx = m[b].x - m[a].x, dy = m[b].y - m[a].y;
    const l = Math.hypot(dx, dy) || 1;
    const s = (r && r.dir < 0) ? -1 : 1;
    return { x: s * dy / l, y: -s * dx / l };
};

// The course AXIS: leeward/start line midpoint -> windward gate midpoint, plus
// the unit vector along it. Six separate sites recomputed this from marks[0..3];
// it is one concept and belongs in one place.
//
// A course with no windward gate (islandRound) uses its rounding mark as the far
// end, which is the natural analogue. Note this is byte-identical to the old
// marks[2]/[3] computation there: those two placeholder marks are laid out
// symmetrically either side of the granite island, so their midpoint already WAS
// the island centre.
function courseAxis() {
    const a = legMid(0);
    let b = legMid(1);
    if (!b && state.course && state.course.roundMark) {
        b = { x: state.course.roundMark.x, y: state.course.roundMark.y };
    }
    if (!a || !b) return null;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { start: a, windward: b, dx, dy, len, ux: dx / len, uy: dy / len };
}

// A BOAT's point of sail, right now. Close-hauled up to 60 degrees off the true wind,
// reaching to 120, running beyond — the conventional split, and the one the character
// stats (upwind / reach / downwind) are written against.
//
// This is the question RRS 18.1(a) actually asks ("boats on opposite tacks on a beat to
// windward"), and the question a character's beat/run strength applies to. It uses the
// LIVE wind, because a boat's point of sail genuinely changes with every shift.
function pointOfSail(boat) {
    const twa = Math.abs(normalizeAngle(state.wind.direction - boat.heading));
    return twa < Math.PI / 3 ? 'beat' : twa < Math.PI * 2 / 3 ? 'reach' : 'run';
}

// Does this leg's target gate sit at the windward end? Distinct from legGoesUpwind:
// leg 0 runs upwind but targets the START line, so its net direction is upwind while it
// is not heading for the windward gate.
const legTargetsWindward = (leg) => (routeLeg(leg) || {}).role === 'windward';

// rules.js is loaded BEFORE script.js but runs after it, so these reach it via a
// namespace rather than relying on cross-script lexical bindings.
window.Course = {
    routeLeg: (l) => routeLeg(l),
    legMarks: (l) => legMarks(l),
    legGoesUpwind: (l) => legGoesUpwind(l),
    pointOfSail: (b) => pointOfSail(b),
    isBeating: (b) => pointOfSail(b) === 'beat',
    legTargetsWindward: (l) => legTargetsWindward(l),
    windwardMarks: () => {
        const r = state.course && state.course.route && state.course.route[1];
        return (r && r.marks) || null;
    }
};

function legMid(leg) {
    const idx = legMarks(leg);
    if (!idx || !state.course.marks) return null;
    const a = state.course.marks[idx[0]], b = state.course.marks[idx[1]];
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ── What a mark IS, physically ────────────────────────────────────────────────
// A buoy is a 24-unit circle you can round from any side. A committee boat is a 30ft
// vessel lying to an anchor, and treating it as the same circle means sailing through
// eight metres of hull. `bodyR` is the bounding radius about the mark POINT, and
// `body` is the set of circles that actually collide.
//
// bodyR 12 for a buoy is the old `markRadius`, and every consumer is written as
// (constant + bodyR) so a course of plain buoys computes exactly the numbers it
// always did — the golden traces are the proof.
const MARK_BODIES = {
    // Half the 85x37px hull, as a 3-circle capsule down the centreline. r=19 covers the
    // beam; the two end circles sit far enough out to cover the bow and transom, which a
    // single circle leaves free for a boat to clip.
    committee: { r: 19, along: [-22, 0, 22], offset: 19 }
};
const markBody = (kind) => MARK_BODIES[kind] || null;

// ── Which way a committee boat lies ───────────────────────────────────────────
// It is a vessel at anchor at one end of a line, not a buoy: it has a heading, and the
// heading is a FACT ABOUT THE LINE, frozen once here.
//
// Three things this deliberately is not:
//
// (1) NOT the live wind. `state.wind.direction` oscillates every frame, so a boat that
//     lay head-to-wind would swing with every puff — visual noise, and the sprite's
//     baked orange flag would spend the race fighting the real breeze.
// (2) NOT the leg direction. The perpendicular of the line's own vector puts the hull
//     exactly square to the line it defines, which is what reads as "the line ends
//     here" even on a skewed course where leg 1 is not perpendicular to the start.
// (3) NOT recomputed per leg. A line used twice — start, then finish — is travelled in
//     opposite directions, and a boat that re-derived its heading would spin 180 degrees
//     mid-race. FIRST USE wins, which is also what the real thing does: the committee
//     anchors for the start and does not turn around when the fleet comes back down.
//
// The sprite is also nudged outboard along the line, away from the far end, by half a
// beam. The mark POINT is untouched — every line-crossing, OCS and gate test still uses
// it — but the hull now sits clear of the line's sailable span, with the flagstaff on
// the point. That is where a real line is sighted from, and without it a boat starting
// at the committee-boat end has to sail through the hull to cross.
function orientCourseMarks() {
    const marks = (state.course && state.course.marks) || [];
    const route = (state.course && state.course.route) || [];
    for (const m of marks) {
        m.heading = null; m.drawX = m.x; m.drawY = m.y; m.body = null; m.bodyR = 12;
    }
    for (let i = 0; i < marks.length; i++) {
        const m = marks[i];
        const spec = markBody(m.kind);
        if (!spec) continue;

        // FIRST route entry that uses this mark. Route order is the order the course is
        // sailed, so entry 0 is the start and "first use" is the start line's setup.
        let k = -1, other = -1;
        for (let e = 0; e < route.length && k < 0; e++) {
            const idx = route[e].marks;
            if (!idx || idx.length !== 2) continue;
            if (idx[0] === i) { k = e; other = idx[1]; }
            else if (idx[1] === i) { k = e; other = idx[0]; }
        }
        if (k < 0 || !marks[other]) continue;

        // Direction of travel through the line: the ROUTE'S OWN crossing normal, which is
        // `dir * (gateDy, -gateDx)` over the entry's mark pair in the entry's order — the
        // exact vector updateBoatRaceState judges a crossing with. So the hull faces the way
        // a boat legally crosses, by construction.
        //
        // This used to point at the NEXT WAYPOINT instead and take whichever normal agreed
        // with it. That is only the same vector when the next mark happens to lie square off
        // the line; on Glacier Sound, whose rounding sits 60 degrees off the line's normal,
        // it chose the opposite one and moored the committee boat facing back down the course.
        // The authored `dir` cannot disagree with the rules engine, and a bearing to a mark
        // can.
        const gi = route[k].marks;
        const ga = marks[gi[0]], gb = marks[gi[1]];
        const gdx = gb.x - ga.x, gdy = gb.y - ga.y;
        const gl = Math.hypot(gdx, gdy) || 1;
        const sgnDir = (route[k].dir >= 0) ? 1 : -1;
        const nx = sgnDir * gdy / gl, ny = -sgnDir * gdx / gl;

        // Along the line, away from the other end — the outboard nudge below.
        const o = marks[other];
        let lx = o.x - m.x, ly = o.y - m.y;
        const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;

        // Sprite-up is zero heading (art-pipeline.md 3), so heading is the bow's bearing.
        m.heading = Math.atan2(nx, -ny);
        // Outboard: along the line, away from the other end.
        m.drawX = m.x - lx * spec.offset;
        m.drawY = m.y - ly * spec.offset;
        m.body = spec.along.map(d => ({ x: m.drawX + nx * d, y: m.drawY + ny * d, r: spec.r }));
        m.bodyR = Math.max(...m.body.map(c =>
            Math.hypot(c.x - m.x, c.y - m.y) + c.r));
    }
}

function initCourse() {
    // DESIGNED VENUE, from a venue document. Land is vector polygons in world
    // units and the course is AUTHORED — marks, route and wind direction are read,
    // not inferred.
    //
    // This replaces a chain of inference from a painted mask: wind computed square
    // to a green line, flipped to point away from the island, the line re-laid at
    // fleet width, then its vertex order flipped again so the crossing normal
    // pointed up-course. Both flips were wrong at some point, each in a way that
    // was only visible by sailing it. Values that are drawn should be read.
    //
    // EVERY venue with a document takes this path. It used to be gated on the `mask` fx,
    // which only Glacier Sound had, so the other nine could not be authored at all — the
    // editor could open a document they would never race. A venue is designed when a
    // document exists for it, and that is the whole test.
    const doc = window.VenueDoc.get(settings.venue);
    if (doc) {
        const problems = window.VenueDoc.validate(doc);
        const errors = problems.filter(p => p.level === 'error');
        for (const p of problems) console[p.level === 'error' ? 'error' : 'warn'](`[venue ${settings.venue}] ${p.msg}`);
        if (errors.length) console.error(`[venue ${settings.venue}] ${errors.length} error(s); course may be unsailable`);

        const c = window.VenueDoc.compile(doc);
        // THE DAY IS THE REGIONS. Both the mean direction and the mean speed are derived
        // from what the wind regions state over the course — there is no venue wind range
        // and no venue oscillation left to blend with.
        if (c.windBase !== null) {
            state.wind.baseDirection = c.windBase;
            state.wind.direction = c.windBase;
        }
        if (c.windBaseSpeed > 0) {
            state.wind.baseSpeed = c.windBaseSpeed;
            state.wind.speed = c.windBaseSpeed;
        }
        state.course = { marks: c.marks, boundary: c.boundary };
        // NOTE: legLength is deliberately NOT set here. It is the player's Course
        // Distance setting (the config slider writes it, resetGame preserves it),
        // and writing to it made an Arctic race silently resize the next Bay
        // course. The island cutoff is measured from the real start->mark distance
        // in updateRace, not from legLength.
        // COURSE TYPE IS A FACT ABOUT THE ROUTE, not about which venue you are on. A route
        // containing a rounding is an island course; one made of lines and gates is a
        // windward-leeward. Hardcoding 'islandRound' here was safe only while Glacier Sound
        // was the sole document — the moment a second venue authored a beat, every
        // islandRound branch (laylines, zone circles, the HUD waypoint) read the wrong course.
        state.course.type = c.roundMark ? 'islandRound' : 'wl';
        state.race.totalLegs = c.legs;
        state.course.route = c.route;
        state.course.islands = c.islands;      // replaced below, once the floes exist
        state.course.navIslands = c.islands;
        state.course.navVersion = 0;
        state.course.doc = doc;
        // The vector land, kept separate from course.islands (which also carries
        // drifting floes). Anything asking "is this point on land?" must test these
        // POLYGONS — the landmass bounding radius is 9388, more than half the
        // world, and reasoning from it silently broke floe placement, collision and
        // wind shadow on three separate occasions.
        state.course.landShapes = c.islands;
        // Where SCENERY lives, as opposed to where boats may sail. Drifting ice is
        // placed and kept inside this, not inside the arena.
        state.course.scenery = c.scenery;
        state.course.windRegions = c.windRegions;
        state.course.currentRegions = c.currentRegions;
        state.course.gustRegions = c.gustRegions;
        // Timing is authored per venue when the document says so. Absent means the
        // game's own default, so a document that says nothing races as it always did.
        state.course.startTime = c.startTime;
        state.race.startTimerDuration = (c.startTime != null)
            ? c.startTime : (state.race.userStartTime || 30.0);
        // An authored limit wins; otherwise the one derived from the route. Either way a
        // designed course gets a limit measured from the course, not from legLength.
        state.course.cutoff = (c.cutoff != null) ? c.cutoff : c.cutoffAuto;
        state.course.description = c.description;
        state.course.roundMark = c.roundMark;
        // HAND-PLACED ICE. Position and shape are authored; drift velocity, spin and
        // wander are drawn from the race RNG, so the layout is yours and every race
        // still plays out differently. Added BEFORE the generator so generated floes
        // reject candidates that would land on top of authored ones.
        // Diagnostic ablation knobs (same spirit as window.__START / window.__NAV):
        // __NOFLOES strips the drifting ice entirely; __FLOEFRAC (0..1) keeps a
        // deterministic fraction of it — a difficulty dial for isolating where the
        // AI's pack-handling breaks.
        const floeFrac = (typeof window !== 'undefined' && window.__NOFLOES) ? 0
            : (typeof window !== 'undefined' && window.__FLOEFRAC != null) ? window.__FLOEFRAC : 1;
        if (c.ice && c.ice.length && floeFrac > 0) {
            const rngI = state.race.seed ? mulberry32(state.race.seed + 11) : Math.random;
            const authored = c.ice.map(f => {
                const floe = makeFloe(f.x, f.y, f.r, rngI, f.local.map(p => ({ x: p.x, y: p.y })));
                floe.authored = true;
                floe.id = f.id;
                floe.kind = f.kind;
                floe.windShadow = f.windShadow;
                floe.currentShadow = f.currentShadow;
                return floe;
            });
            // Density dial: null out the decimated entries AFTER the map, so the
            // shapeOrder indices below still line up (they index the authored array
            // by document position). RNG draws above are untouched either way.
            if (floeFrac < 1) {
                for (let fi = 0; fi < authored.length; fi++) {
                    if (Math.floor((fi + 1) * floeFrac) === Math.floor(fi * floeFrac)) authored[fi] = null;
                }
            }
            // IN DOCUMENT ORDER, not land-then-ice. `islands` is painted back to front and
            // is also the order collision and the nav graph walk, so it is the designer's
            // stacking rather than an artifact of which array a shape was stored in. A
            // document that lists its land first — every one of the ten does — rebuilds
            // exactly the array the old concat produced.
            const ordered = [];
            for (const o of (c.shapeOrder || [])) {
                const src = o.drift ? authored : state.course.islands;
                if (o.i >= 0 && src[o.i]) ordered.push(src[o.i]);
            }
            state.course.islands = ordered;
        }
        // ── The venue's own effects, which a document does NOT replace ──────────
        // A document authors GEOMETRY: land, arena, marks, route, wind, current, ice.
        // Weed beds, brash, the river's shore and the glacier's calving are venue
        // CHARACTER — generated per race from the seed, and they stay that way, because
        // freezing them would fix the one part of a venue that is supposed to feel alive.
        //
        // Same rng stream and same order as the generated path (river, ice, weeds), so a
        // venue that gains a document keeps the effects it always had.
        //
        // NO RANDOM ICE FLOES, though: where the ice is, is a design decision, and
        // scattering it per race made the one thing a designer most wants to place the
        // one thing they could not. `doc.ice` is the answer.
        // Pathfinding skips scenery a boat can never reach. Ice beyond the arena exists to
        // be looked at, and a shape marked `nav: false` is out by the designer's own say-so;
        // feeding either to the A* visibility graph is pure cost, and every extra node
        // multiplies expansion (the river's 82 banks once caused multi-hundred-ms replan
        // spikes). Run UNCONDITIONALLY: it used to be skipped when no ice was added, which
        // was fine while land was one coastline and wrong the moment land could opt out.
        const b0 = state.course.boundary;
        state.course.navIslands = state.course.islands.filter(i =>
            !i.isBank && Arena.signedDist(b0, i.x, i.y) > -(i.radius + 120));
        orientCourseMarks();
        // Ice sits where it will actually be BEFORE anything is drawn. This has to be on the
        // DOCUMENT path, not merely at the end of initCourse: every venue is a document now,
        // so the tail below is the generated-course path and returns here without ever
        // reaching it.
        settleFloes();
        // Same reason, and the same trap: this is the path every venue takes. It samples
        // the mean wind over sailable WATER, so it needs the boundary and every land shape
        // — floes included — already settled.
        computeWindPressureScale();
        buildCoursePaths();
        return;
    }

    const d = state.wind.baseDirection, ux = Math.sin(d), uy = -Math.cos(d), rx = -uy, ry = ux;
    // Start-line width. With a 10-boat fleet, 550u packs lane-neighbours ~43u apart —
    // tighter than the boats' ~50u collision diameter — so the start jams structurally.
    // Tunable for sweeps.
    const _SPw = (typeof window !== 'undefined' && window.__START) ? window.__START : {};
    const w = _SPw.width != null ? _SPw.width : 1100;
    const dist = state.race.legLength || 4000;
    state.course = {
        marks: [
            { x: -rx*w/2, y: -ry*w/2, type: 'start' }, { x: rx*w/2, y: ry*w/2, type: 'start' },
            { x: ux*dist - rx*w/2, y: uy*dist - ry*w/2, type: 'mark' }, { x: ux*dist + rx*w/2, y: uy*dist + ry*w/2, type: 'mark' }
        ],
        boundary: { x: ux*dist/2, y: uy*dist/2, radius: Math.max(3500, dist + 500) } // Adjust boundary for long courses
    };

    // A generated course is always a windward-leeward. 'islandRound' is a fact about a
    // ROUTE — a rounding in it — so a designed course derives its own type above and this
    // branch, which has no route to read, cannot produce one.
    state.course.type = 'wl';
    state.course.roundMark = null;
    state.race.totalLegs = state.race.userLegs || 4;
    if (state.course.type === 'islandRound') state.race.totalLegs = 2;
    state.course.route = buildRoute(state.course.type, state.race.totalLegs);

    // Generate Islands
    let islands = [];
    let attempts = 0;
    let valid = false;
    
    // Only attempt if islands are requested
    if (state.race.conditions.islandCount > 0) {
        while(!valid && attempts < 5) {
            attempts++;
            islands = generateIslands(state.course.boundary);
            if (checkCourseNavigability(islands, state.course.marks)) {
                valid = true;
            }
        }
        if (!valid) {
            console.warn("Failed to generate navigable course with islands.");
            islands = []; 
        }
    }
    state.course.islands = islands;

    // A GENERATED course has no venue features left to add. Weed beds, brash, the river's
    // banks and shore, the drifting floes and the wildlife on them were all per-race
    // scatter, and every one of them landed on top of whatever a designer had authored —
    // which is exactly what made a venue hard to edit. Geometry comes from the document
    // now, and nothing arrives uninvited.

    // Perf: a shape marked `nav: false` is out of the visibility graph by the designer's
    // own say-so. Feeding every one to A* is pure cost — the river's 82 banks once caused
    // multi-hundred-ms replan spikes.
    state.course.navIslands = state.course.islands.filter(i => !i.isBank);
    state.course.navVersion = 0; // bumped when floes drift, so the planner's inflated cache refreshes
    orientCourseMarks();
    // Ice sits where it will actually be BEFORE anything is drawn, so no berg is ever seen
    // walking out of a headland it was authored inside. After navIslands, because the push
    // reads landShapes and rebuilds each floe's collider.
    settleFloes();
    // Last, because it samples the mean wind over sailable WATER — it needs the boundary
    // and every land shape already in place, floes included.
    computeWindPressureScale();
    buildCoursePaths();
}

// THE RULER, built once per course. See CoursePath in planner.js for why it is one shared
// path per leg rather than one per boat, and why it avoids only static land.
function buildCoursePaths() {
    state.course.dmc = null;
    // WHAT THIS COURSE REQUIRES OF EACH ROUNDING. Stamped here so the leg engine tests
    // against the geometry rather than a constant — see CoursePath.requiredSweep.
    if (typeof CoursePath !== 'undefined' && state.course.route) {
        for (let i = 0; i < state.course.route.length; i++) {
            const e = state.course.route[i];
            if (e && e.kind === 'round' && e.mark) e.mark.reqSweep = CoursePath.requiredSweep(state.course.marks, state.course.route, i);
        }
    }
    if (typeof CoursePath === 'undefined' || !state.course.marks || !state.course.route) return;
    try {
        // THE GRID FIRST. A visibility graph cannot path a keyholed coastline — Glacier
        // Sound's land is one such ring, and the planner emitted a straight line through
        // the island. The grid only supplies LAND AVOIDANCE here; the waypoints are the
        // course's own (start line, gate midpoints, zone rim, rounding arc), with no wind
        // and no tactical approach offsets in them.
        let grid = null;
        const doc = window.VenueDoc && window.VenueDoc.get(settings.venue);
        if (window.SailCheck && doc) {
            const fixed = window.VenueDoc.shapes(doc).filter(sh => window.VenueDoc.traits(sh).motion === 'fixed');
            grid = window.SailCheck.buildGrid(fixed, state.course.boundary, null);
            // Kept for the periodic floe-aware rebuild (refreshBotGrid): same land,
            // fresh floe circles, every few seconds.
            state.course._gridFixed = fixed;
        }
        // The bots route on this same grid. Their visibility planner cannot inflate a
        // keyholed coastline (see RoutePlanner.updateIslands), so on a designed venue
        // static land belongs to the grid and only drifting floes stay in the graph.
        state.course.botGrid = grid;
        state.course._botGridStatic = grid;
        state.course._botGridT = null;
        // LEE-SHORE MASK for the bots' sailable router. A cell with blocked water a
        // few cells DOWNWIND is a place the breeze sets a boat onto the rocks; tax
        // it so routes run along windward shores and channel spines instead. Uses
        // the mean regional field (no gusts, race start phase) — a one-time build.
        if (grid) {
            // The mask samples the wind in EVERY cell — N² region blends — so it is keyed
            // on what it depends on and skipped when nothing changed. The grid object
            // itself is cached by SailCheck now, so the mask rides along on it: dragging a
            // mark rebuilds neither the grid nor this.
            let leeKey = `${state.wind.baseDirection}|${state.wind.baseSpeed}`;
            for (const r of (state.course.windRegions || [])) {
                leeKey += `|${r.direction},${r.speed},${r.dirVar},${r.speedVar},${r.period},${r.falloff},${r.bb ? r.bb.minX + r.bb.maxY : 0},${r.poly ? r.poly.length : 0}`;
            }
            if (grid._leeKey !== leeKey) {
            grid._leeKey = leeKey;
            const N = grid.n, lee = new Float32Array(N * N);
            const wfx = new Float32Array(N * N), wfy = new Float32Array(N * N);
            // Per-cell wind, quantized for the TIME-COST table (16 direction bins x
            // 6 speed bins — see SailCheck.buildTimeCost). Routing on TIME from the
            // real polar is what the sailing-routing literature (isochrone methods)
            // does: beating, reaching and running then price themselves and the
            // router stops needing hand-tuned upwind fudges.
            const wbin = new Uint8Array(N * N);
            const SPDS = [8, 12, 16, 20, 25, 30];
            const MARCH = 5, LEE_W = 2.5;
            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    const id = j * N + i;
                    if (!grid.nav[id]) continue;
                    const [wx, wy] = grid.world(i, j);
                    const w = getWindAt(wx, wy);
                    const wd = w.direction;
                    // Unit vector TOWARD the wind (the unsailable direction), per cell —
                    // the router prices beating with it, see pathSailable.
                    wfx[id] = Math.sin(wd); wfy[id] = -Math.cos(wd);
                    const dBin = ((Math.round(wd / (Math.PI * 2 / 16)) % 16) + 16) % 16;
                    let sBin = 0, sBest = Infinity;
                    for (let s = 0; s < SPDS.length; s++) {
                        const dd = Math.abs((w.speed || 0) - SPDS[s]);
                        if (dd < sBest) { sBest = dd; sBin = s; }
                    }
                    wbin[id] = dBin * 6 + sBin;
                    // Flow direction (where the wind pushes you): downwind of here.
                    const fx = -Math.sin(wd), fy = Math.cos(wd);
                    for (let k = 1; k <= MARCH; k++) {
                        const ci = Math.round(i + fx * k), cj = Math.round(j + fy * k);
                        if (!grid.at(ci, cj)) {
                            lee[id] = LEE_W * (MARCH - k + 1) / MARCH;
                            break;
                        }
                    }
                }
            }
            grid._leeW = lee;
            grid._wfx = wfx; grid._wfy = wfy;
            grid._wbin = wbin;
            }
        }
        if (!state._dmcPlanner) state._dmcPlanner = new RoutePlanner();
        state.course.dmc = CoursePath.build(state.course.marks, state.course.route,
                                            state.course.islands || [], state._dmcPlanner,
                                            'dmc-' + (state.course.navVersion || 0), grid);
    } catch (e) {
        console.warn('[dmc] course path build failed', e);
        state.course.dmc = null;
    }
}

function resetGame() {
    // The compile cache exists so ONE reset's many compile consumers (the editor's
    // checks, stats and inspectors) pay for one compile. A new reset may follow a
    // document edited in place — the editor's, or a test's — so the cache dies here,
    // at the one gate every rebuild passes through.
    if (window.VenueDoc && window.VenueDoc.invalidateCompile) window.VenueDoc.invalidateCompile();
    loadSettings();
    if (UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
    state.camera.target = 'boat';
    state.wind.baseSpeed = 8 + Math.random()*10;
    state.wind.speed = state.wind.baseSpeed;
    state.wind.baseDirection = Math.random() * Math.PI * 2;
    state.wind.direction = state.wind.baseDirection; // Random phase
    state.wind.history = [];
    state.wind.debugTimer = 0;
    state.gusts = [];

    // Persistent shift for this race: a slow, one-way veer (+) or back (-) of
    // ~18-28° total over the race, at ~2-4°/min. Creates the "pick the right side"
    // gamble. Sign/rate are randomized per race so neither player nor AI can
    // foresee it; the AI infers it from the wind's low-frequency trend.            // 18-28 deg // deg/sec

    // Randomized Biases for New Wind Model



    // Direction Bias (Variability 5-10% roughly)
    // +/- 0.1 to 0.2 radians
    const directionBias = (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.1);

    // Obstacle Defaults
    // Default to no islands
    const islandCount = 0;
    const islandMaxSize = Math.random();
    const islandClustering = Math.random();

    // Current Generation
    // Default to no current
    let currentData = null;

    state.race.conditions = {
        directionBias,
        current: currentData,
        islandCount,
        islandMaxSize,
        islandClustering
    };

    // Venue overrides (no-op for Bay — see applyVenueConditions)
    applyVenueConditions();


    // Seed for island generation
    state.race.seed = Math.floor(Math.random() * 1000000);
    state.time = 0;
    if (window.Rules) window.Rules.init();
    state.race.status = 'waiting'; // Wait for user to start

    // Defaults for Race Config (can be overridden by UI)
    // Preserve existing config if set, otherwise use defaults
    state.race.legLength = state.race.legLength || 4000;
    // The player's lap count is a SETTING; a designed course's leg count is a property
    // of the course. Keeping them in one field meant racing Glacier Sound (2 legs) left
    // every later venue on 2 laps instead of 4 — the same shape of leak as legLength.
    state.race.userLegs = state.race.userLegs || state.race.totalLegs || 4;
    state.race.totalLegs = state.race.userLegs;
    state.race.startTimerDuration = state.race.userStartTime || 30.0;

    state.race.timer = state.race.startTimerDuration;

    initCourse();

    // Init Water Renderer
    if (window.WaterRenderer) window.WaterRenderer.init();

    // Pre-populate the sources' cells, so a race opens with its puffs already on the water
    // rather than fading in over the first minute. No sources means none to populate.
    const gregs = state.course.gustRegions;
    if (gregs && gregs.length) {
        let want = 0;
        for (const r of gregs) want += r.count;
        for (let i = 0; i < want; i++) spawnRegionGust(gregs, true);
    }

    state.boats = [];
    if (UI.lbRows) UI.lbRows.innerHTML = '';
    UI.boatRows = {};
    if (UI.resultsList) UI.resultsList.innerHTML = '';
    UI.resultRows = {};
    // The hero and the splits redraw only when their signature changes (they run six times
    // a second), so a new race has to invalidate that signature — otherwise the next
    // results page opens showing the last race's finish. The venue best is likewise
    // decided once per race, on the first render.
    for (const id of ['res-hero', 'res-splits']) {
        const el = document.getElementById(id);
        if (el) delete el.dataset.sig;
    }
    state.race.bestChecked = false;
    state.race.bestOutcome = null;

    // Create Boats (Initialized at 0,0, positioned by repositionBoats)
    const pc = playerCharacter();
    const player = new Boat(0, true, 0, 0, pc.name, pc);
    // applySettings() only runs on load/save, so a boat built after that would
    // otherwise ignore a stored Auto Trim = off and start the race auto-trimming.
    player.manualTrim = !settings.autoTrim;
    player.heading = state.wind.direction; // Head to wind
    player.prevHeading = player.heading;
    player.lastWindSide = 0;
    state.boats.push(player);

    // Create AI Boats
    const opponents = [];
    // NEVER RACE YOURSELF. Two boats with one name and one face makes the leaderboard
    // unreadable and the edge indicators ambiguous. The draw count is unchanged at 9, so
    // the rng stream is the same length; only which nine come out differs.
    const available = AI_CONFIG.filter(c => c.name !== settings.character);
    for (let i = 0; i < 9 && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        opponents.push(available[idx]);
        available.splice(idx, 1);
    }

    // Determine favored end for start positioning bias
    const favoredEnd = getFavoredEnd(); // 0 = mark 0 (low pct), 1 = mark 1 (high pct)
    const favorBias = favoredEnd === 1 ? 0.15 : -0.15; // Shift spread toward favored end

    for (let i = 0; i < opponents.length; i++) {
        const config = opponents[i];
        const ai = new Boat(i + 1, false, 0, 0, config.name, config);

        // Initial setup props
        ai.prevHeading = ai.heading;
        ai.lastWindSide = 0;

        // Start Setup: Evenly spaced with small jitter, biased toward favored end
        const numAI = opponents.length;
        const basePos = numAI > 1 ? 0.1 + 0.7 * (i / (numAI - 1)) : 0.5;
        const jitter = (Math.random() - 0.5) * 0.10; // ±5%
        ai.ai.startLinePct = Math.max(0.05, Math.min(0.90, basePos + jitter + favorBias));
        ai.ai.setupDist = 250 + Math.random() * 100;

        state.boats.push(ai);
    }

    repositionBoats();
    // THE CAMERA IS PART OF SETTING THE COURSE. It follows the player by lerping 10% a
    // frame, so a race that starts with it parked over the LAST race's finish line spends
    // its first seconds flying across the water and spinning to the new wind — which is
    // what a Rematch looked like. Boats placed, course built, camera put where the boats
    // are: only then is there anything worth drawing.
    snapCameraToStart();

    state.particles = [];
    state.waveStates.clear();

    // Reset the AI quote system. Its update() consumes Math.random() for quote
    // selection; if its queue/timers carry over between races the number and
    // timing of those random draws leaks across runs, desynchronising any
    // seeded RNG (and leaving stale quotes on screen on a real restart).
    if (!window.__DNS_KEEP_SAYINGS_LEAK) {
        Sayings.queue = [];
        Sayings.current = null;
        Sayings.timer = 0;
        Sayings.silenceTimer = 0;
    }

    hideRaceMessage();

    setupPreRaceOverlay();

    if (settings.soundEnabled || settings.musicEnabled) Sound.init();
    else Sound.updateMusic();
}

// Put the view where the race is, with no travel: the same answer the follow camera would
// converge on a second or two later, taken as the starting value instead. Rotation is read
// from the mode the player chose, so North stays north and Wind stays on the new breeze.
function snapCameraToStart() {
    const p = state.boats[0];
    if (!p) return;
    state.camera.target = 'boat';
    state.camera.x = p.x;
    state.camera.y = p.y;
    state.camera.rotation = state.camera.mode === 'north' ? 0
                          : state.camera.mode === 'wind' ? state.wind.direction
                          : p.heading;
}

function restartRace() { resetGame(); togglePause(false); }

// Same venue, same fleet, straight back onto the water — the results page's primary
// action, since without a series there is no "next race" to send anyone to. It goes
// through `startRace()` rather than setting the status itself, so the prestart, the audio
// and the leaderboard all come up exactly as they do from the clubhouse.
function rematchRace() { resetGame(); togglePause(false); startRace(); }

// Batch Simulation Harness
window.runBatchSim = function(count = 50) {
    console.log(`Starting Batch Sim of ${count} races...`);
    const results = {
        races: 0,
        avgTacksWinner: 0,
        avgTacksLosers: 0,
        wins: { player: 0, ai: 0 },
        collisions: 0
    };

    // Mocking window.onRaceEvent to capture data
    const oldEvent = window.onRaceEvent;
    window.onRaceEvent = (type, data) => {
        if (type === 'collision_boat') results.collisions++;
    };

    settings.soundEnabled = false;
    settings.musicEnabled = false;

    let totalTacksWinner = 0;
    let totalTacksLosers = 0;

    for (let i=0; i<count; i++) {
        resetGame();
        state.race.status = 'racing'; // Skip prestart
        state.race.timer = 0;

        let simTime = 0;
        const maxTime = 600; // 10 mins limit
        const dt = 1/60;

        while (state.race.status !== 'finished' && simTime < maxTime) {
            update(dt);
            simTime += dt;
        }

        results.races++;
        // Analyze results
        const winner = state.boats.find(b => b.lbRank === 0);
        if (winner) {
            if (winner.isPlayer) results.wins.player++; else results.wins.ai++;
            // Count tacks (sum of Upwind legs 1 & 3)
            const winnerTacks = (winner.raceState.legManeuvers[1] || 0) + (winner.raceState.legManeuvers[3] || 0);
            totalTacksWinner += winnerTacks;
        }

        // Losers Stats
        let raceLoserTacks = 0;
        let loserCount = 0;
        for (const b of state.boats) {
            if (b !== winner && !b.raceState.resultStatus) { // Only finished boats
                 const tacks = (b.raceState.legManeuvers[1] || 0) + (b.raceState.legManeuvers[3] || 0);
                 raceLoserTacks += tacks;
                 loserCount++;
            }
        }
        if (loserCount > 0) totalTacksLosers += (raceLoserTacks / loserCount);

        console.log(`Race ${i+1}/${count} finished in ${simTime.toFixed(1)}s. Winner: ${winner ? winner.name : 'None'}`);
    }

    results.avgTacksWinner = totalTacksWinner / count;
    results.avgTacksLosers = totalTacksLosers / count;

    window.onRaceEvent = oldEvent;
    console.log("Batch Sim Complete", results);
    return results;
};

resetGame();
requestAnimationFrame(loop);

// Water Debug Logic
function toggleWaterDebug() {
    if (!UI.waterDebug) return;
    UI.waterDebug.classList.toggle('hidden');
    if (!UI.waterDebug.classList.contains('hidden')) {
        initWaterDebugUI();
    }
}

function initWaterDebugUI() {
    if (!UI.waterDebugControls || !window.WATER_CONFIG) return;
    UI.waterDebugControls.innerHTML = ''; // Clear

    const createControl = (key, label, type, min, max, step) => {
        const div = document.createElement('div');
        div.className = "flex flex-col gap-1";

        const header = document.createElement('div');
        header.className = "flex justify-between items-end";

        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.className = "text-slate-400 font-bold uppercase text-[10px] tracking-wide";

        const valDisp = document.createElement('span');
        valDisp.className = "t-mono text-cyan-400";
        valDisp.textContent = window.WATER_CONFIG[key];

        header.appendChild(lbl);
        header.appendChild(valDisp);
        div.appendChild(header);

        let input;
        if (type === 'color') {
            input = document.createElement('input');
            input.type = 'color';
            input.value = window.WATER_CONFIG[key];
            input.className = "w-full h-6 bg-slate-800 rounded cursor-pointer border border-slate-600";
        } else {
            input = document.createElement('input');
            input.type = 'range';
            input.min = min;
            input.max = max;
            input.step = step;
            input.value = window.WATER_CONFIG[key];
            input.className = "w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500";
        }

        input.addEventListener('input', (e) => {
            window.WATER_CONFIG[key] = (type === 'range') ? parseFloat(e.target.value) : e.target.value;
            valDisp.textContent = window.WATER_CONFIG[key];
        });

        div.appendChild(input);
        UI.waterDebugControls.appendChild(div);
    };

    createControl('baseColor', 'Base Color', 'color');
    createControl('depthGradientStrength', 'Vignette Strength', 'range', 0, 1, 0.05);
    createControl('contourOpacity', 'Contour Opacity', 'range', 0, 1, 0.05);
    createControl('contourScale', 'Contour Scale', 'range', 0.5, 3.0, 0.1);
    createControl('contourSpacing', 'Contour Spacing', 'range', 10, 100, 5);
    createControl('contourWarp', 'Contour Warp', 'range', 0, 2.0, 0.1);
    createControl('contourSpeed', 'Flow Speed', 'range', 0, 0.1, 0.005);
    createControl('causticOpacity', 'Caustic Opacity', 'range', 0, 1, 0.05);
    createControl('causticScale', 'Caustic Scale', 'range', 0.5, 5.0, 0.1);
    createControl('grainOpacity', 'Grain Opacity', 'range', 0, 0.2, 0.01);
    createControl('shorelineGlowSize', 'Island Glow Size', 'range', 1.0, 3.0, 0.1);
    createControl('shorelineGlowOpacity', 'Island Glow Opacity', 'range', 0, 1, 0.05);
    createControl('shorelineColor', 'Glow Color', 'color');
}

if (UI.waterReset) {
    UI.waterReset.addEventListener('click', () => {
        // Simple reload for defaults or store defaults separately?
        // Let's just reload page for now or hardcode reset if needed.
        // Or store defaults in water.js
        window.location.reload();
    });
}
if (UI.waterClose) UI.waterClose.addEventListener('click', () => {
    if (UI.waterDebug) UI.waterDebug.classList.add('hidden');
});

window.state = state; window.UI = UI; window.updateLeaderboard = updateLeaderboard; window.CONFIG = CONFIG;
// Roster sheet (competitor.html) reads the fleet straight out of the game
window.AI_CONFIG = AI_CONFIG; window.ARCHETYPES = ARCHETYPES;
window.competitorProfileHTML = competitorProfileHTML; window.renderProfileBoat = renderProfileBoat;
