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
                this.lowSpeedTimer += dt;
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

        // Wiggle / Unstick Logic (Overrides Strategy)
        if (this.lowSpeedTimer > 3.0 && !this.wiggleActive) {
            this.wiggleActive = true;
            this.wiggleDuration = 5.0; // Lock in for 5 seconds

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
            this.wiggleDuration -= dt;

            const windDir = state.wind.direction;
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
                // But switch side next time.
                if (this.lowSpeedTimer > 5.0) {
                     this.wiggleSide *= -1; // Flip for next attempt
                } else {
                     this.lowSpeedTimer = 0; // Success
                     // Enter Clearance Mode
                     this.clearanceTimer = 3.0;
                     this.clearanceHeading = desiredHeading; // Keep sailing this way
                }
            }
        } else if (this.clearanceTimer > 0) {
            this.clearanceTimer -= dt;
            desiredHeading = this.clearanceHeading;
            speedRequest = 1.0;
        } else {
            this.wiggleTimer = 0;
            // 1. Navigation (Where do we want to go?)
            const nav = this.getNavigationTarget();

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
                if (!markNear && (clear || deadline) && this.riskState !== 'IMMINENT' && this.riskState !== 'HIGH') {
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
                 this.markContactTimer = 2.0; // Commit to this direction for 2s
             }
        }

        if (this.markContactTimer > 0) {
             this.markContactTimer -= dt;
             desiredHeading = this.markEscapeHeading;
             speedRequest = 1.0;
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
        } else {
            // Determine Gate/Mark Target
            let targetIndices = [0, 1];
            const leg = boat.raceState.leg;
            if (leg === 1 || leg === 3) targetIndices = [2, 3];
            else targetIndices = [0, 1];

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
                const wd = state.wind.direction;

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
                } else if (NAV.mode === 'center' || (leg % 2 === 0 && NAV.insetDown == null)) {
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
                    const isBeat = leg % 2 !== 0;
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

                let pastGate = false;
                if (leg === 1 || leg === 3) { if (dot > 50) pastGate = true; }
                else if (leg === 2 || leg === 4) { if (dot < -50) pastGate = true; }

                if (pastGate) {
                    const len = Math.sqrt(nx*nx + ny*ny);
                    const unx = nx/len;
                    const uny = ny/len;
                    const center = { x: (m1.x+m2.x)/2, y: (m1.y+m2.y)/2 };
                    const factor = (leg === 1 || leg === 3) ? -1 : 1;
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
                            const wdr = state.wind.direction;
                            const sgn = (leg % 2 !== 0) ? -1 : 1;
                            destX += Math.sin(wdr) * roundTurn * sgn;
                            destY -= Math.cos(wdr) * roundTurn * sgn;
                        }
                    }
                }
            }
        }

        // 2. Global Path Planning
        // Update Path if timer expired or target moved significantly
        if (this.pathTimer > 0) this.pathTimer -= 0.1; // Called in update usually, but here fine

        let needsReplan = false;
        if (this.pathTimer <= 0) needsReplan = true;
        if (!this.finalTarget || (destX-this.finalTarget.x)**2 + (destY-this.finalTarget.y)**2 > 50*50) needsReplan = true;

        // If pathable islands exist, use planner (banks are excluded — the
        // river corridor is handled by the clamp + reactive avoidance)
        const navIslands = state.course.navIslands || state.course.islands;
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
                this.pathTimer = (state.race.venueFx && state.race.venueFx.ice) ? 1.2 + Math.random() * 0.6 : 2.0 + Math.random();
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
             return normalizeAngle(wd + this.forceTack * 0.75);
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

            // Planing Check
            if (state.wind.speed > J111_PLANING.minTWS) {
                 optTWA = 140 * Math.PI/180;
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
        if (traits.cover > 0 && mode === 'upwind' && boat.raceState.leg % 2 === 1) {
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
            const boostFactor = boat.stats.boost * 0.05;
            let effectiveWind = localWind.speed;
            if (effectiveWind > state.wind.baseSpeed) {
                effectiveWind = state.wind.baseSpeed + (effectiveWind - state.wind.baseSpeed) * (1.0 + boostFactor);
            } else {
                effectiveWind = state.wind.baseSpeed + (effectiveWind - state.wind.baseSpeed) * (1.0 - boostFactor);
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
                futureEffective = state.wind.baseSpeed + (futureEffective - state.wind.baseSpeed) * (1.0 + boostFactor);
            } else {
                futureEffective = state.wind.baseSpeed + (futureEffective - state.wind.baseSpeed) * (1.0 - boostFactor);
            }

            // Bonus for stronger wind relative to current effective wind
            // We compare future effective wind vs base wind (or current effective?)
            // Comparing to base makes sense as absolute value
            const windBonus = (futureEffective - state.wind.baseSpeed);
            const pressureCoeff = 0.1 * (1.0 + boostFactor) * traits.pressureSense;
            score += windBonus * pressureCoeff;

            // 4b. Current Scouting (river): score the tack by the water it
            // LEADS TO — slack near the banks against an adverse stream, full
            // midstream push when the flow helps. This is what makes river
            // lane strategy exist for the AI at all: the current under the
            // keel is the same for both tacks and cancels out of the choice.
            if (state.race.riverCurrent) {
                const futureCur = getCurrentAt(projX, projY);
                if (futureCur && futureCur.speed > 0.05) {
                    const helping = Math.cos(futureCur.direction - angleToTarget) * (futureCur.speed / 4.0);
                    score += helping * 0.5;
                }
            }

            // 4c. Land feasibility: a tack whose projected position is inside
            // an island (or beyond the river's sailable water) ends in an
            // avoidance scramble and a forced tack-back — tax it up front.
            if (state.course.islands && state.course.islands.length) {
                for (const isl of state.course.islands) {
                    const dIsl2 = (projX - isl.x) ** 2 + (projY - isl.y) ** 2;
                    if (dIsl2 < isl.radius * isl.radius) { score -= 0.6; break; }
                }
            }
            if (state.race.riverCurrent) {
                const rcF = state.race.riverCurrent;
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
        const tackBonus = Math.max(0.15, Math.min(1.5, baseTackBonus + hysteresisMod + commitBonus));

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

        if (targetTackSign !== currentTack) {
             this.tackCooldown = 5.0; // Reset cooldown on switch
        }

        return preferredHeading;
    }

    // --- Prestart Helper Methods ---

    getLineDistance() {
        const m0 = state.course.marks[0];
        const m1 = state.course.marks[1];
        const lineDx = m1.x - m0.x;
        const lineDy = m1.y - m0.y;
        const nx = lineDy, ny = -lineDx; // Normal perpendicular to line (points upwind)
        const bDx = this.boat.x - m0.x, bDy = this.boat.y - m0.y;
        return bDx * nx + bDy * ny; // positive = above/upwind of line
    }

    getApproachTime(distance, currentSpeed, stats) {
        // Mini physics simulation matching updateBoat() acceleration
        const targetGameSpeed = getTargetSpeed(0.7, false, state.wind.baseSpeed) * 0.25; // close-hauled ~40° TWA
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
        const m0 = state.course.marks[0];
        const m1 = state.course.marks[1];

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
        const wd = state.wind.direction;
        const downwind = wd + Math.PI;

        // Signed perpendicular distance to the line (>0 = course side / over early).
        const pDist = ((boat.x - m0.x) * dy - (boat.y - m0.y) * dx) / lineLen;
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
        let nearWeeds = null;
        if (state.course.weeds) {
            nearWeeds = [];
            for (const w of state.course.weeds) {
                const dx = w.x - this.boat.x, dy = w.y - this.boat.y;
                const rr = w.radius + reach;
                if (dx * dx + dy * dy < rr * rr) nearWeeds.push(w);
            }
        }

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
                    cost += Math.abs(offset) * 3000;
                } else if (this.riskState === 'HIGH') {
                    cost += Math.abs(offset) * 1000;
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
                        if (dotForward > 0) cost += 1500;
                        else cost -= 800;
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
                        cost += 2000;
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

                    if (dSq < 50*50) { // Safety radius (Mark radius ~12 + Boat ~25 + Margin)
                        staticCollision = true;
                        cost += 200000 / (dSq + 1); // Intense penalty for direct hit
                    } else if (dSq < 115*115 && this.livenessState === 'normal') {
                        // Soft avoidance around marks — tighter radius for closer rounding
                        proximityCost += 18000 / (dSq + 100);
                    }
                }
            }

            // 3. Boundary - Segment Check
            if (state.course.boundary) {
                const b = state.course.boundary;
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

            // 4. Island - Collision Check (Local Layer)
            if (nearIslands && nearIslands.length) {
                // We use the segment from boat to future position
                const start = { x: boat.x, y: boat.y };
                const end = { x: futureX, y: futureY };

                for (const isl of nearIslands) {
                    // Drifting floes move ~50-150u within the lookahead window;
                    // static geometry checks aim boats at where the gap WAS.
                    // Padding the floe's effective radius by its possible
                    // travel restores the margin (74% of arctic penalties were
                    // floe groundings before this). Scaled with the drift speed
                    // when the ice was sped up — the pad has to track it.
                    const movePad = isl.isFloe ? 170 : 0;
                    // Quick Bounding Box/Circle Check
                    const d = Geom.distToSegment({x: isl.x, y: isl.y}, start, end);
                    if (d < isl.radius + 30 + movePad) { // Close to island
                        // Detailed Polygon Check
                        // Check if segment intersects or if end point is inside
                        if (Geom.segmentIntersectsPoly(start, end, isl.vertices) || (isl.isFloe && d < isl.radius + movePad * 0.6)) {
                            staticCollision = true;
                            cost += 500000; // HUGE penalty (Hard Constraint)
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

            // 4b. Weed patches (Swamp) — passable but slow, so a soft cost:
            // steer around them when there's a clean lane, plough through
            // when the detour would cost more.
            if (nearWeeds && nearWeeds.length) {
                const start = { x: boat.x, y: boat.y };
                const end = { x: futureX, y: futureY };
                for (const w of nearWeeds) {
                    const d = Geom.distToSegment({ x: w.x, y: w.y }, start, end);
                    if (d < w.radius) {
                        proximityCost += 2500 * (1.0 - d / w.radius);
                    }
                }
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

            if (cost < minCost) {
                minCost = cost;
                bestHeading = h;
            }
        }
        
        // Expose how far avoidance pushed us off our intended course — the
        // no-contact foul detector reads this as "avoiding action taken".
        this.lastAvoidDeviation = Math.abs(normalizeAngle(bestHeading - desiredHeading));
        return bestHeading;
    }
}

// Wind Configuration
const WIND_CONFIG = {
    // Oscillating-shift presets. Real beats oscillate ±5-18° on periods of
    // ~180-360s (heavy->light air), slow enough that playing the shifts (tack on
    // the header, sail the lifted tack) is a real tactical lever rather than noise.
    // (Old periods 45-90s read as twitchy.) A second, shorter harmonic is layered
    // on in updateBaseWind so the roll never looks obviously periodic.
    presets: {
        STEADY: { amp: 5,  period: 360, slew: 0.3 },
        NORMAL: { amp: 11, period: 270, slew: 0.5 },
        SHIFTY: { amp: 18, period: 180, slew: 0.8 }
    }
};

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
//   speedScale   x      multiplier on boatspeed (identity tax — keep within 0.97..1.0)
//   roundTurn    u|null  override of the rounding carve pull (fleet default 80)
const DEFAULT_TRAITS = { aggro: 0, startBufAdj: 0, shiftSense: 1.0, windFast: 1.0, pressureSense: 1.0, cornerScale: 1.0, cornerRound: 1.0, sideCommit: 0, cover: 0, laylineTight: 1.0, speedScale: 1.0, roundTurn: null };

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
        traits: { shiftSense: 1.5, windFast: 1.4, pressureSense: 1.15, speedScale: 0.97 },
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

// Difficulty: flat bonus added to every stat of every AI boat at construction.
// The player's boat has all-zero stats, so this makes the whole fleet faster
// and sharper without changing character-to-character balance or archetype
// identities. 0 = original difficulty; each point is worth roughly 1.2-1.8%
// boatspeed depending on point of sail, plus accel/handling/gust response.
const AI_STAT_BONUS = 4;

const AI_CONFIG = [
    { name: 'Cheer', creature: 'Pom Pom Crab', hull: '#FF9ECF', spinnaker: '#00E5FF', spinnaker2: '#FF9ECF', sail: '#FFFFFF', cockpit: '#FFFFFF', personality: "Cheerful and fun loving, always positive and enthuiastic.", beat: 'Out-spike her steady beat — she has no pace off the wind.', archetype: 'metronome', stats: { acceleration: 2, momentum: -2, handling: 4, upwind: 1, reach: -2, downwind: -1, boost: 5 } },
    { name: 'Bixby', creature: 'Otter', hull: '#0046ff', spinnaker: '#FFD400', spinnaker2: '#0046ff', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Relaxed veteran who instinctively finds perfect wind." , beat: 'Beat him to the top mark — upwind he is merely mortal.', archetype: 'shift', stats: { acceleration: -2, momentum: -3, handling: -1, upwind: 0, reach: 1, downwind: 5, boost: -1 } },
    { name: 'Skim', creature: 'Flying Fish', hull: '#8FD3FF', spinnaker: '#FF2D95', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#AEB4BF', personality: "Flashy opportunist thriving on speed bursts." , beat: 'Survive her start, then turn hard and often — she hates corners.', archetype: 'rocket', stats: { acceleration: 5, momentum: 0, handling: -4, upwind: 3, reach: -4, downwind: 3, boost: 2 } },
    { name: 'Wobble', creature: 'Platypus', hull: '#FF8C1A', spinnaker: '#00E5FF', spinnaker2: '#FF8C1A', sail: '#FFFFFF', cockpit: '#B0B0B0', personality: "Awkward, unpredictable, deadly effective in chaos." , beat: 'Ignores the wind to get there — sail the middle and collect.', archetype: 'gambler', stats: { acceleration: 5, momentum: -1, handling: -2, upwind: -3, reach: 3, downwind: 0, boost: 4 } },
    { name: 'Pinch', creature: 'Lobster', hull: '#E10600', spinnaker: '#FFFFFF', spinnaker2: '#E10600', sail: '#FFFFFF', cockpit: '#5A5A5A', personality: "Aggressive bully dominating the starting line." , beat: 'Stay clean upwind, then walk away downwind — he parks there.', archetype: 'bully', stats: { acceleration: 1, momentum: -2, handling: 0, upwind: 2, reach: -1, downwind: -5, boost: 2 } },
    { name: 'Bruce', creature: 'Great White', hull: '#121212', spinnaker: '#ff0606', spinnaker2: '#000000', sail: '#FFFFFF', cockpit: '#3A3A3A', personality: "Cold, relentless presence forcing others to react." , beat: 'Force restarts and tacking duels — he cannot get moving again.', archetype: 'bully', stats: { acceleration: -5, momentum: -2, handling: -5, upwind: -3, reach: -3, downwind: 4, boost: 1 } },
    { name: 'Strut', creature: 'Flamingo', hull: '#FF4F9A', spinnaker: '#000000', spinnaker2: '#FF4F9A', sail: '#FFFFFF', cockpit: '#B0BEC5', personality: "Stylish confidence with daring, showy sailing." , beat: 'Push her into maneuvers — every turn costs her the strut.', archetype: 'metronome', stats: { acceleration: -3, momentum: -3, handling: -5, upwind: 5, reach: -2, downwind: 1, boost: 2 } },
    { name: 'Gasket', creature: 'Beaver', hull: '#FFE600', spinnaker: '#000000', spinnaker2: '#FFE600', sail: '#000000', cockpit: '#C4BEB2', personality: "Methodical and stubborn, grinding out advantages." , beat: 'Match him upwind, pull away when the spinnakers go up.', archetype: 'metronome', stats: { acceleration: 3, momentum: -3, handling: 3, upwind: 0, reach: 0, downwind: -4, boost: -3 } },
    { name: 'Chomp', creature: 'Saltwater Crocodile', hull: '#2ECC71', spinnaker: '#FF7A00', spinnaker2: '#2ECC71', sail: '#000000', cockpit: '#C1B58A', personality: "Patient hunter striking without warning." , beat: 'Tack early, tack often — the ambusher cannot follow through turns.', archetype: 'leech', stats: { acceleration: 4, momentum: 1, handling: -5, upwind: 5, reach: -3, downwind: 0, boost: 3 } },
    { name: 'Whiskers', creature: 'Walrus', hull: '#C49A6C', spinnaker: '#8E0038', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#ddd3c9', personality: "Massive, steady, unbeatable in heavy conditions." , beat: 'Attack every rounding and reach — the train needs straight track.', archetype: 'freight', stats: { acceleration: -2, momentum: 4, handling: 2, upwind: 0, reach: -5, downwind: 4, boost: -3 } },
    { name: 'Vex', creature: 'Water Dragon', hull: '#0fe367', spinnaker: '#D9D9D9', spinnaker2: '#0fe367', sail: '#FFFFFF', cockpit: '#D0D0D0', personality: "Slippery tactician exploiting tiny mistakes." , beat: 'Lean on him mid-leg — away from corners he is out of tricks.', archetype: 'corner', stats: { acceleration: -3, momentum: -5, handling: 4, upwind: -4, reach: -5, downwind: 1, boost: 4 } },
    { name: 'Hug', creature: 'Starfish', hull: '#9900ff', spinnaker: '#e8a6ff', spinnaker2: '#FF9E2C', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Chill vibes, relentless endurance." , beat: 'Get ahead early — Hug finishes everything she starts, slowly.', archetype: 'metronome', stats: { acceleration: -3, momentum: 1, handling: 0, upwind: 5, reach: 2, downwind: 2, boost: 5 } },
    { name: 'Ripple', creature: 'Dolphin', hull: '#00B3FF', spinnaker: '#FF6F00', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#B8C6D1', personality: "Cheerful speedster seeking clean lanes." , beat: 'Drag her into traffic — clean lanes are where she lives.', archetype: 'shift', stats: { acceleration: -2, momentum: -1, handling: -3, upwind: 4, reach: -4, downwind: 5, boost: 5 } },
    { name: 'Clutch', creature: 'Crab', hull: '#B00020', spinnaker: '#FFD166', spinnaker2: '#B00020', sail: '#FFFFFF', cockpit: '#6B6B6B', personality: "Defensive and stubborn off the line." , beat: 'Do not engage — sail past while he is busy starting fights.', archetype: 'bully', stats: { acceleration: -5, momentum: 2, handling: -4, upwind: 4, reach: -5, downwind: -2, boost: 0 } },
    { name: 'Glide', creature: 'Albatross', hull: '#E8F1F8', spinnaker: '#1F4FFF', spinnaker2: '#FFFFFF', sail: '#000000', cockpit: '#C5CED6', personality: "Patient perfectionist who never blunders." , beat: 'Perfect upwind, lost downwind — make the runs count.', archetype: 'metronome', stats: { acceleration: -4, momentum: 3, handling: 2, upwind: 4, reach: 3, downwind: -5, boost: 2 } },
    { name: 'Fathom', creature: 'Orca', hull: '#1C1C3C', spinnaker: '#00F0FF', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#3C3F55', personality: "Silent dominance unleashed at full power." , beat: 'Turn the race into corners — momentum cannot help him there.', archetype: 'freight', stats: { acceleration: 0, momentum: 5, handling: -5, upwind: 3, reach: 2, downwind: -2, boost: -3 } },
    { name: 'Scuttle', creature: 'Hermit Crab', hull: '#FFB703', spinnaker: '#3A86FF', spinnaker2: '#FFB703', sail: '#000000', cockpit: '#BFAF92', personality: "Erratic survivor thriving in congestion." , beat: 'Deny the chaos — in a clean race he is just slow.', archetype: 'gambler', stats: { acceleration: -4, momentum: -3, handling: -3, upwind: -3, reach: 1, downwind: -2, boost: 5 } },
    { name: 'Finley', creature: 'Tuna', hull: '#0077B6', spinnaker: '#ffd900', spinnaker2: '#0077B6', sail: '#FFFFFF', cockpit: '#A7B8C8', personality: "Pure speed and relentless pressure." , beat: 'Break cover downwind — his speed lives on the beat.', archetype: 'leech', stats: { acceleration: -2, momentum: -3, handling: -3, upwind: 5, reach: -5, downwind: 1, boost: -1 } },
    { name: 'Torch', creature: 'Fire Salamander', hull: '#FF3B30', spinnaker: '#FFD60A', spinnaker2: '#FF3B30', sail: '#000000', cockpit: '#5E5E5E', personality: "Explosive starts, reckless aggression." , beat: 'Let the fire burn out — he keeps nothing through lulls or turns.', archetype: 'rocket', stats: { acceleration: 1, momentum: -5, handling: -3, upwind: -1, reach: 4, downwind: -1, boost: 4 } },
    { name: 'Nimbus', creature: 'Cloud Ray', hull: '#6A7FDB', spinnaker: '#F1F7FF', spinnaker2: '#6A7FDB', sail: '#FFFFFF', cockpit: '#C9D0E0', personality: "Effortlessly surfing invisible shifts." , beat: 'Chase him downwind — clouds stall when the wind goes aft.', archetype: 'shift', stats: { acceleration: 5, momentum: -5, handling: -4, upwind: 1, reach: 4, downwind: -5, boost: 0 } },
    { name: 'Tangle', creature: 'Octopus', hull: '#7A1FA2', spinnaker: '#00E676', spinnaker2: '#7A1FA2', sail: '#FFFFFF', cockpit: '#B8ACC9', personality: "Trap-setting master of dirty air." , beat: 'Dive downwind — the trap-setter unravels on the runs.', archetype: 'leech', stats: { acceleration: -1, momentum: 1, handling: -3, upwind: -2, reach: -1, downwind: -5, boost: 5 } },
    { name: 'Brine', creature: 'Manatee', hull: '#5E7C8A', spinnaker: '#FFB4A2', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C3CCD2', personality: "Looks slow, impossible to pass." , beat: 'Break his rhythm at the marks — restarts are agony for a manatee.', archetype: 'freight', stats: { acceleration: -5, momentum: 3, handling: 3, upwind: 3, reach: -2, downwind: 4, boost: -4 } },
    { name: 'Razor', creature: 'Barracuda', hull: '#2D3142', spinnaker: '#EF233C', spinnaker2: '#2D3142', sail: '#FFFFFF', cockpit: '#5C5F6A', personality: "Surgical aggression at the worst moments." , beat: 'No weak stat — refuse the fight and race your own boat.', archetype: 'bully', stats: { acceleration: 0, momentum: 4, handling: 5, upwind: -1, reach: 0, downwind: -1, boost: -1 } },
    { name: 'Pebble', creature: 'Penguin', hull: '#1F1F1F', spinnaker: '#00B4D8', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C7CCD1', personality: "Precise and unshakable in traffic." , beat: 'Reach across her line — precision cannot fix a slow reach.', archetype: 'metronome', stats: { acceleration: -2, momentum: 5, handling: 3, upwind: 5, reach: -4, downwind: 4, boost: -2 } },
    { name: 'Saffron', creature: 'Seahorse', hull: '#FFB000', spinnaker: '#7B2CBF', spinnaker2: '#FFB000', sail: '#FFFFFF', cockpit: '#CBBFA6', personality: "Graceful wildcard favoring wide tactics." , beat: 'She bets it all on the reaches — win the beats and it is over.', archetype: 'gambler', stats: { acceleration: -4, momentum: -2, handling: 3, upwind: -5, reach: 5, downwind: 0, boost: 5 } },
    { name: 'Bramble', creature: 'Sea Urchin', hull: '#2B2E4A', spinnaker: '#FF9F1C', spinnaker2: '#2B2E4A', sail: '#FFFFFF', cockpit: '#7A7F9A', personality: "Spiky defender denying easy lanes." , beat: 'Stay out of reach — alone, the urchin barely moves.', archetype: 'bully', stats: { acceleration: -5, momentum: 3, handling: -4, upwind: 3, reach: -1, downwind: 1, boost: -4 } },
    { name: 'Mistral', creature: 'Swift', hull: '#A8DADC', spinnaker: '#E63946', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C4CFD4', personality: "Constantly sniffing out pressure." , beat: 'Fast everywhere — beat the swift on shifts, not speed.', archetype: 'shift', stats: { acceleration: 5, momentum: 5, handling: 2, upwind: 0, reach: -1, downwind: 0, boost: -1 } },
    { name: 'Drift', creature: 'Jellyfish', hull: '#FF70A6', spinnaker: '#70D6FF', spinnaker2: '#FF70A6', sail: '#FFFFFF', cockpit: '#D6C9D9', personality: "Harmless-looking, slips through gaps." , beat: 'Every maneuver hurts him — force gybes and watch him wilt.', archetype: 'gambler', stats: { acceleration: -4, momentum: -5, handling: -5, upwind: -2, reach: -1, downwind: 4, boost: 4 } },
    { name: 'Anchor', creature: 'Sea Turtle', hull: '#96C47A', spinnaker: '#ffd016', spinnaker2: '#3E8E41', sail: '#FFFFFF', cockpit: '#B7C4B4', personality: "Conservative, resilient, brutally consistent." , beat: 'Own the beats — the turtle only wins races run downhill.', archetype: 'metronome', stats: { acceleration: 3, momentum: 5, handling: -2, upwind: -5, reach: 0, downwind: -2, boost: -1 } },
    { name: 'Zing', creature: 'Flying Squirrel', hull: '#9B5DE5', spinnaker: '#FEE440', spinnaker2: '#9B5DE5', sail: '#FFFFFF', cockpit: '#CFC7DC', personality: "Hyperactive chaos opportunist." , beat: 'Survive the launch — the beats bring him back to you.', archetype: 'rocket', stats: { acceleration: 4, momentum: 5, handling: 4, upwind: -3, reach: -4, downwind: -2, boost: 1 } },
    { name: 'Knot', creature: 'Nautilus', hull: '#C8553D', spinnaker: '#FF8C42', spinnaker2: '#FFF6E5', sail: '#FFFFFF', cockpit: '#C8B5A6', personality: "Cerebral planner playing long games." , beat: 'Sail into pressure — the nautilus cannot cash a gust.', archetype: 'leech', stats: { acceleration: -2, momentum: -3, handling: 0, upwind: -3, reach: 0, downwind: 1, boost: -4 } },
    { name: 'Flash', creature: 'Mackerel', hull: '#3A86FF', spinnaker: '#FFBE0B', spinnaker2: '#FFFFFF', sail: '#000000', cockpit: '#B4C2D6', personality: "Speed-first, consequences later." , beat: 'Send him upwind — the sprinter\'s compass only points down.', archetype: 'rocket', stats: { acceleration: 2, momentum: -1, handling: 5, upwind: -5, reach: -1, downwind: 2, boost: -4 } },
    { name: 'Pearl', creature: 'Oyster', hull: '#C7A6FF', spinnaker: '#2E2E2E', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#CFCFD4', personality: "Quiet patience, strikes at perfect moments." , beat: 'Make her tack — every stop costs a fortune in pearls.', archetype: 'leech', stats: { acceleration: 4, momentum: -5, handling: -1, upwind: -5, reach: 4, downwind: 5, boost: 4 } },
    { name: 'Bluff', creature: 'Polar Bear', hull: '#FFFFFF', spinnaker: '#00AEEF', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#BFC6CC', personality: "Imposing calm daring mistakes." , beat: 'Just point higher — Bluff bluffs; the upwind legs call it.', archetype: 'freight', stats: { acceleration: 2, momentum: 4, handling: -3, upwind: -5, reach: -5, downwind: -2, boost: -1 } },
    { name: 'Regal', creature: 'Swan', hull: '#FFFFFF', spinnaker: '#E10600', spinnaker2: '#FFFFFF', sail: '#000000', cockpit: '#C9CCD6', personality: "Elegant lane thief with ruthless timing." , beat: 'Race the runs — royalty will not hoist and hustle.', archetype: 'corner', stats: { acceleration: -1, momentum: 3, handling: 5, upwind: 0, reach: 4, downwind: -4, boost: -2 } },
    { name: 'Sunshine', creature: 'Mahi-Mahi', hull: '#FFEB3B', spinnaker: '#00E676', spinnaker2: '#FFEB3B', sail: '#FFFFFF', cockpit: '#BDB76B', personality: "Flashy speed attacking on reaches." , beat: 'Keep her in lulls and dirty air — no gusts, no shine.', archetype: 'rocket', stats: { acceleration: 1, momentum: -4, handling: 1, upwind: 4, reach: 0, downwind: -4, boost: -4 } },
    { name: 'Pulse', creature: 'Tree Frog', hull: '#00FF6A', spinnaker: '#7A00FF', spinnaker2: '#00FF6A', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Sticky feet, sticky cover — impossible to shake loose." , beat: 'Break away off the wind — sticky feet, short hops.', archetype: 'leech', stats: { acceleration: -3, momentum: 2, handling: -1, upwind: -3, reach: -5, downwind: -5, boost: 2 } },
    { name: 'Splat', creature: 'Blobfish', hull: '#E7A6B4', spinnaker: '#6a1051', spinnaker2: '#E7A6B4', sail: '#FFFFFF', cockpit: '#CFC6CC', personality: "Looks doomed, but somehow always survives." , beat: 'Just race — his corner needs a miracle and a tailwind.', archetype: 'gambler', stats: { acceleration: -5, momentum: 0, handling: -3, upwind: 0, reach: -2, downwind: 0, boost: 1 } },
    { name: 'Dart', creature: 'Kingfisher', hull: '#00C2FF', spinnaker: '#FF9433', spinnaker2: '#00C2FF', sail: '#FFFFFF', cockpit: '#AEBFCC', personality: "pure speed, energetic, very competitive" , beat: 'Point high and turn often — darts only fly straight.', archetype: 'rocket', stats: { acceleration: 1, momentum: 4, handling: -3, upwind: -4, reach: 4, downwind: -2, boost: 5 } },
    { name: 'Roll', creature: 'Harbor Seal', hull: '#7D8597', spinnaker: '#FFD166', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C3CAD3', personality: "Playful feints hiding brutal positioning skills." , beat: 'Slow him leaving marks — perfect turns, painful exits.', archetype: 'corner', stats: { acceleration: -5, momentum: 4, handling: 5, upwind: -3, reach: 2, downwind: -1, boost: 4 } },
    { name: 'Spike', creature: 'Narwhal', hull: '#6B7FD7', spinnaker: '#FFFFFF', spinnaker2: '#6B7FD7', sail: '#000000', cockpit: '#C5CED6', personality: "Leads with the horn — makes his own right of way." , beat: 'Point high and stay clear of the horn — he cannot climb after you.', archetype: 'bully', stats: { acceleration: 1, momentum: -2, handling: 1, upwind: -5, reach: 2, downwind: 1, boost: 3 } },
    { name: 'Flicker', creature: 'Tern', hull: '#EE6C4D', spinnaker: '#E0FBFC', spinnaker2: '#EE6C4D', sail: '#000000', cockpit: '#C7CCD1', personality: "Constant repositioning, never predictable." , beat: 'Follow the fleet, not the tern — his corner rarely pays.', archetype: 'gambler', stats: { acceleration: 4, momentum: 3, handling: -2, upwind: -2, reach: 3, downwind: 0, boost: -1 } },
    { name: 'Croak', creature: 'Bullfrog', hull: '#386641', spinnaker: '#A7C957', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#BFC9B8', personality: "Patient swamp tactician lethal in shifts." , beat: 'Strong wherever the wind blows — outsail him in the transitions.', archetype: 'shift', stats: { acceleration: 3, momentum: -2, handling: -1, upwind: 4, reach: 1, downwind: 5, boost: 2 } },
    { name: 'Snap', creature: 'Snapping Turtle', hull: '#4B5D23', spinnaker: '#ef3629', spinnaker2: '#000000', sail: '#000000', cockpit: '#B8B8A8', personality: "Grouchy, old salty sailor who likes to beat the young whippersnappers." , beat: 'Keep him turning — snappers lose their grip in maneuvers.', archetype: 'metronome', stats: { acceleration: -2, momentum: -4, handling: -4, upwind: 2, reach: 5, downwind: 2, boost: 5 } },
    { name: 'Rift', creature: 'Moray Eel', hull: '#d4ff07', spinnaker: '#ff61df', spinnaker2: '#d4ff07', sail: '#FFFFFF', cockpit: '#B7C4B4', personality: "Lurks quietly, strikes savagely at marks." , beat: 'Pull away on the runs — eels do not surf.', archetype: 'corner', stats: { acceleration: -1, momentum: -3, handling: 2, upwind: 2, reach: 3, downwind: -4, boost: 2 } },
    { name: 'Skerry', creature: 'Puffin', hull: '#FF5400', spinnaker: '#1D3557', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C7CCD1', personality: "Fearless gap-threader thriving in traffic." , beat: 'Give him no gaps to thread — then climb away upwind.', archetype: 'bully', stats: { acceleration: -2, momentum: 1, handling: -1, upwind: -3, reach: 3, downwind: 2, boost: -2 } },
    { name: 'Crush', creature: 'Mantis Shrimp', hull: '#00F5D4', spinnaker: '#F15BB5', spinnaker2: '#00F5D4', sail: '#000000', cockpit: '#CFC7DC', personality: "Explosive reactions with devastating timing." , beat: 'Everything between corners is yours — especially the runs.', archetype: 'corner', stats: { acceleration: -4, momentum: -5, handling: 1, upwind: 1, reach: -3, downwind: -5, boost: 0 } },
    { name: 'Torrent', creature: 'Swordfish', hull: '#083fa6', spinnaker: '#D62828', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#8D99AE', personality: "Straight-line dominance with brutal acceleration." , beat: 'Absorb the opening surge — the swordfish dulls by leg two.', archetype: 'rocket', stats: { acceleration: 5, momentum: -2, handling: 1, upwind: 1, reach: -1, downwind: -2, boost: 2 } },
    { name: 'Jester', creature: 'Clownfish', hull: '#ffa000', spinnaker: '#FFFFFF', spinnaker2: '#ffa000', sail: '#000000', cockpit: '#f4f4f4', personality: "Cheerful chaos masking shrewd cunning." , beat: 'Escape upwind — the joke is on him above the layline.', archetype: 'leech', stats: { acceleration: 1, momentum: 3, handling: 2, upwind: -3, reach: 0, downwind: 5, boost: -1 } },
    { name: 'Breeze', creature: 'Nudibranch', hull: '#000080', spinnaker: '#ff3fa7', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#D6D6DC', personality: "Chill, stylish, always finds unexpected pressure." , beat: 'Crowd her at starts and marks — slow to build speed, easy to pin.', archetype: 'shift', stats: { acceleration: -4, momentum: 4, handling: -2, upwind: -3, reach: 4, downwind: 1, boost: 5 } },
    { name: 'Petal', creature: 'Roseate Spoonbill', hull: '#FF6FAE', spinnaker: '#FFFFFF', spinnaker2: '#FF6FAE', sail: '#FFFFFF', cockpit: '#e6e6e6', personality: "Elegant lane snatcher with impeccable timing." , beat: 'Win the beats — the spoonbill blooms only at the marks.', archetype: 'corner', stats: { acceleration: -3, momentum: 3, handling: 1, upwind: -5, reach: -1, downwind: 3, boost: 4 } },
    { name: 'Stomp', creature: 'Blue-Footed Booby', hull: '#00B4D8', spinnaker: '#E10600', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Clumsy confidence hiding fearless lane attacks." , beat: 'Refuse the brawl and outlast him — stomping bleeds speed.', archetype: 'bully', stats: { acceleration: 5, momentum: -3, handling: 4, upwind: 3, reach: 2, downwind: 0, boost: 1 } },
    { name: 'Crimson', creature: 'Red Snapper', hull: '#ed1515', spinnaker: '#2643E9', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#CFCFD4', personality: "Calm, surgical tactician striking at perfect moments." , beat: 'Break away in a straight line — he only shines in puffs.', archetype: 'leech', stats: { acceleration: -1, momentum: -3, handling: 4, upwind: 1, reach: -2, downwind: -2, boost: 5 } },
    { name: 'Viper', creature: 'Green Tree Snake', hull: '#49c100', spinnaker: '#FF1E1E', spinnaker2: '#000000', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Coils around your wind and waits for the twitch." , beat: 'Slip the cover in open water — he fades on the long legs.', archetype: 'leech', stats: { acceleration: -3, momentum: -2, handling: -2, upwind: -5, reach: -1, downwind: -5, boost: 3 } },
    { name: 'Skitter', creature: 'Mudskipper', hull: '#e33d28', spinnaker: '#15f121', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Erratic bursts, impossible angles, constant pressure." , beat: 'Cut off the downwind escape, then watch the gamble fail.', archetype: 'gambler', stats: { acceleration: 1, momentum: -4, handling: -2, upwind: 1, reach: -1, downwind: 5, boost: -2 } },
    { name: 'Veil', creature: 'Vampire Squid', hull: '#7A1FA2', spinnaker: '#E10600', spinnaker2: '#000000', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Calm, shadowy predator striking without warning." , beat: 'Force maneuvers — the cloak tears in every tack.', archetype: 'leech', stats: { acceleration: -1, momentum: -4, handling: -5, upwind: -1, reach: 3, downwind: -1, boost: -4 } },
    { name: 'Puff', creature: 'Mandarin Dragonet', hull: '#0032ff', spinnaker: '#E17638', spinnaker2: '#0032ff', sail: '#62e517', cockpit: '#17b3f2', personality: "Super chill vibes, effortless flow, always smiling." , beat: 'Attack downwind — the dragonet will not run with you.', archetype: 'freight', stats: { acceleration: 2, momentum: 4, handling: 0, upwind: 1, reach: 0, downwind: -3, boost: 4 } },
    { name: 'Lure', creature: 'Anglerfish', hull: '#0B0F1A', spinnaker: '#6AFF3D', spinnaker2: '#0B0F1A', sail: '#F5F7FA', cockpit: '#2E3440', personality: "Patient darkness, sudden lethal strikes." , beat: 'Refuse the bait upwind — the runs are a free pass.', archetype: 'freight', stats: { acceleration: -4, momentum: 5, handling: 0, upwind: -2, reach: 4, downwind: -5, boost: 2 } },
    { name: 'Wiggle', creature: 'Axolotl', hull: '#FFFFFF', spinnaker: '#FF4FA3', spinnaker2: '#BDEFFF', sail: '#BDEFFF', cockpit: '#D1D7DB', personality: "Cute chaos, surprisingly competitive." , beat: 'Make him steer — wiggling is not turning.', archetype: 'gambler', stats: { acceleration: 2, momentum: 1, handling: -5, upwind: -3, reach: 3, downwind: 3, boost: -3 } },
    { name: 'Zeffir', creature: 'Seagull', hull: '#FFFFFF', spinnaker: '#FF7A00', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#D1D7DB', personality: "Always lifted, always smiling." , beat: 'Hold him off downwind — gulls glide everywhere but there.', archetype: 'shift', stats: { acceleration: 4, momentum: 1, handling: -1, upwind: 1, reach: 2, downwind: -4, boost: 2 } },
    { name: 'Scoop', creature: 'Pelican', hull: '#D8C6A3', spinnaker: '#5499dc', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#e6e6e6', personality: "Big moves, surprisingly precise." , beat: 'Rush the starts and reaches — the pelican needs a runway.', archetype: 'metronome', stats: { acceleration: -4, momentum: -1, handling: 1, upwind: 4, reach: -4, downwind: -1, boost: 2 } },
    { name: 'Popper', creature: 'Pufferfish', hull: '#FFD84D', spinnaker: '#E10600', spinnaker2: '#FFD84D', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Defensive chaos, punishes reckless pressure." , beat: 'Point higher and let him puff himself out.', archetype: 'bully', stats: { acceleration: -3, momentum: 2, handling: -2, upwind: -4, reach: -3, downwind: 0, boost: 0 } },
    { name: 'Frond', creature: 'Leafy Seadragon', hull: '#5FAF6E', spinnaker: '#FF8C42', spinnaker2: '#5FAF6E', sail: '#F3FFF9', cockpit: '#BFCFC4', personality: "Graceful drifter, impossible to read." , beat: 'Pin him at the start — the seadragon blooms late, downwind.', archetype: 'shift', stats: { acceleration: -4, momentum: -2, handling: -3, upwind: 2, reach: 2, downwind: 5, boost: 5 } },
    { name: 'Bulkhead', creature: 'Elephant Seal', hull: '#6B7280', spinnaker: '#FF7A00', spinnaker2: '#000000', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "A wall of calm — unbothered, unhurried, unmoved." , beat: 'Hoist and go — the bulkhead sinks on every run.', archetype: 'metronome', stats: { acceleration: -3, momentum: -2, handling: 2, upwind: 3, reach: -1, downwind: -5, boost: 5 } },
    { name: 'Slipstream', creature: 'Salmon', hull: '#B6BCC6', spinnaker: '#E94B4B', spinnaker2: '#FFFFFF', sail: '#FFFFFF', cockpit: '#41c617', personality: "Relentless endurance, explosive late surges." , beat: 'Deny the tow upwind, then leave — salmon cannot run downstream.', archetype: 'freight', stats: { acceleration: 5, momentum: 3, handling: 1, upwind: 1, reach: -3, downwind: -5, boost: -1 } },
    { name: 'Blaze', creature: 'Mako Shark', hull: '#1F3C5B', spinnaker: '#FFFFFF', spinnaker2: '#1F3C5B', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Blisteringly fast attacker forcing races into constant reaction mode." , beat: 'Skip the fight, win the runs — makos idle downwind.', archetype: 'bully', stats: { acceleration: -3, momentum: -2, handling: 2, upwind: 0, reach: 3, downwind: -4, boost: -1 } },
];


// Settings
const DEFAULT_SETTINGS = {
    playerName: "Player",
    navAids: true,
    manualTrim: false,
    soundEnabled: true,
    bgSoundEnabled: true,
    musicEnabled: false,
    penaltiesEnabled: true,
    cameraMode: 'heading',
    hullColor: '#f1f5f9',
    sailColor: '#ffffff',
    cockpitColor: '#cbd5e1',
    spinnakerColor: '#ef4444',
    spinnakerColor2: '#ffffff',
    spinnakerPattern: 'solid',
    venue: 'bay',
    customizeConditions: false
};

let settings = { ...DEFAULT_SETTINGS };

// --- Venues -----------------------------------------------------------------
// A venue is a parameter bundle over the existing condition systems plus at
// most one bespoke mechanic (fx flags). Ranges are [min, max]; a value is
// drawn per race. 'bay' is the default and deliberately has NO overrides —
// resetGame's own randomization IS the Bay, so eval baselines and RNG
// sequences stay untouched when no other venue is selected.
// Current exists only in the river (spatial field via getCurrentAt).
const VENUES = {
    bay: {
        name: 'Lighthouse Cove',
        tagline: 'Buoys & Breeze', water: 'Light chop', obstacles: 'Buoys, shore & traffic', tags: [['HONEST BREEZE','ok'],['ALL-ROUND TEST','ok']],
        label: 'Bay', emoji: '⛵',
        blurb: 'Buoys to port, lighthouse to starboard, no excuses anywhere. Fair water and honest breeze — every part of your game gets tested here.',
        fx: {}
    },
    lake: {
        name: 'Stillwater Lake',
        tagline: 'Glass & Puffs', water: 'Flat glass', obstacles: 'Islands, skiffs & shoals', tags: [['DEAD SPOTS','warn'],['SHIFT READING','ok']],
        label: 'Lake', emoji: '🏞️',
        blurb: 'Mirror water and fickle mountain air. The breeze only whispers — racers who listen sail away from everyone parked in the glass.',
        wind: [6, 12],
        cond: { shiftiness: [0.7, 1.0], variability: [0.6, 0.9], puffiness: [0.6, 0.9], gustStrengthBias: [0.35, 0.6], puffShiftiness: [0.6, 0.9] },
        islands: { count: [2, 4], maxSize: [0.1, 0.35], clustering: [0.1, 0.5] },
        palette: { baseColor: '#0e7490', deepColor: '#155e75', shallowColor: '#22d3ee', shorelineColor: '#4ade80',
                   gusts: { gustDark: [6, 55, 75], gustMid: [10, 78, 102], lullBright: [168, 232, 240], lullMid: [140, 216, 228] } },
        fx: {}
    },
    lagoon: {
        name: 'Pearl Lagoon',
        tagline: 'Squalls & Coral', water: 'Clear & flat', obstacles: 'Coral heads & reef passes', tags: [['RAIN SQUALLS','warn'],['CORAL HEADS','warn'],['SQUALL RIDING','ok']],
        label: 'Lagoon', emoji: '🐚',
        blurb: 'Turquoise flats, coral gates, and squalls marching down the trades. Duck the rain or ride it — the brave get wet and get ahead.',
        wind: [10, 16],
        cond: { shiftiness: [0.15, 0.35], variability: [0.3, 0.5], puffiness: [0.4, 0.6], gustStrengthBias: [0.55, 0.75], puffShiftiness: [0.3, 0.5] },
        islands: { count: [1, 2], maxSize: [0.05, 0.2], clustering: [0.2, 0.6] },
        palette: { baseColor: '#1fb6c9', deepColor: '#0e7490', shallowColor: '#7ee8e0', shorelineColor: '#fde68a',
                   gusts: { gustDark: [10, 88, 104], gustMid: [16, 110, 128], lullBright: [214, 250, 248], lullMid: [192, 240, 238] } },
        // Squalls + reef passes arrive in the Pearl Lagoon identity pass
        fx: {}
    },
    swamp: {
        name: 'Gatorgrass Bayou',
        tagline: 'Dead Air & Weed', water: 'Still & weedy', obstacles: 'Grass islands & weed beds', tags: [['WEED BEDS','warn'],['KEEP HER MOVING','ok']],
        label: 'Swamp', emoji: '🐊',
        blurb: 'Thick air, thicker water. The wind sulks in the trees and the weed grabs at your keel — patience beats pace in here.',
        wind: [5, 8],
        cond: { shiftiness: [0.8, 1.0], variability: [0.8, 1.0], puffiness: [0.8, 1.0], gustStrengthBias: [0.15, 0.35], puffShiftiness: [0.8, 1.0] },
        islands: { count: [5, 7], maxSize: [0.0, 0.15], clustering: [0.4, 0.8], style: 'grass' },
        palette: { baseColor: '#606c38', deepColor: '#3a4423', shallowColor: '#7d8a4e', shorelineColor: '#8a9a5b',
                   gusts: { gustDark: [36, 44, 18], gustMid: [50, 60, 26], lullBright: [184, 192, 142], lullMid: [168, 178, 126] } },
        fx: { weeds: true }
    },
    river: {
        name: 'Otter Run',
        tagline: 'Current & Rocks', water: 'Fast midstream', obstacles: 'Rocky banks', tags: [['SHALLOW BANKS','warn'],['LANE CHOICE','ok']],
        label: 'River', emoji: '🛶',
        blurb: 'The stream runs hard down the middle and dawdles along the banks. Pick the lane that pays and let the river carry you past the fleet.',
        wind: [10, 14],
        cond: { shiftiness: [0.25, 0.45], variability: [0.4, 0.7], puffiness: [0.4, 0.7], gustStrengthBias: [0.4, 0.6], puffShiftiness: [0.2, 0.4] },
        islands: { count: [0, 0] },
        palette: { baseColor: '#3f6f5f', deepColor: '#2c5248', shallowColor: '#5c8f7a', shorelineColor: '#a3b18a',
                   gusts: { gustDark: [18, 52, 42], gustMid: [27, 68, 56], lullBright: [156, 204, 184], lullMid: [134, 190, 168] } },
        fx: { river: true }
    },
    ocean: {
        name: 'Bluewater Bonanza',
        tagline: 'Swell & Speed', water: 'Long rolling swell', obstacles: 'None — open water', tags: [['UPWIND SLOG','warn'],['SURF THE SETS','ok']],
        label: 'Ocean', emoji: '🌊',
        blurb: 'Nothing out here but you, a steady breeze, and a mile of rolling swell. Surf hard downwind, grind out the beat — pure speed wins.',
        wind: [12, 20],
        cond: { shiftiness: [0.05, 0.2], variability: [0.1, 0.3], puffiness: [0.2, 0.4], gustStrengthBias: [0.5, 0.7], puffShiftiness: [0.1, 0.3] },
        islands: { count: [0, 0] },
        palette: { baseColor: '#0369a1', deepColor: '#1e3a8a', shallowColor: '#0ea5e9', shorelineColor: '#93c5fd',
                   gusts: { gustDark: [8, 32, 105], gustMid: [13, 47, 138], lullBright: [138, 198, 244], lullMid: [118, 188, 238] } },
        fx: { swell: true }
    },
    redrock: {
        name: 'Redrock Reservoir',
        tagline: 'Cliffs & Gusts', water: 'Flat, wind-shadowed', obstacles: 'Rock spires & canyon walls', tags: [['WIND SHADOWS','warn'],['ROCK SPIRES','warn'],['LOCAL KNOWLEDGE','ok']],
        label: 'Reservoir', emoji: '🏜️',
        blurb: 'Sandstone walls carve the breeze into shadows, funnels and sudden gust-bombs. Learn the canyon and it fights for you.',
        wind: [9, 15],
        cond: { shiftiness: [0.4, 0.6], variability: [0.5, 0.75], puffiness: [0.5, 0.7], gustStrengthBias: [0.6, 0.8], puffShiftiness: [0.5, 0.7] },
        islands: { count: [2, 4], maxSize: [0.05, 0.25], clustering: [0.2, 0.6], style: 'redrock' },
        palette: { baseColor: '#189db5', deepColor: '#0c6478', shallowColor: '#5cd6d6', shorelineColor: '#e8a06a',
                   gusts: { gustDark: [8, 70, 86], gustMid: [12, 90, 108], lullBright: [200, 240, 242], lullMid: [180, 230, 235] } },
        // Terrain-shaped wind (wall shadows, venturi, williwaws) arrives in the identity pass
        fx: {}
    },
    glowtide: {
        name: 'Glowtide Strait',
        tagline: 'Moonlight & Glow', water: 'Dark & glowing', obstacles: 'Rocky shores & lit marks', tags: [['NIGHT RACING','warn'],['GLOW READING','ok']],
        label: 'Strait', emoji: '🌙',
        blurb: 'Race by moonlight on water that burns blue where it moves. The dark hides the breeze — the glow gives it away, if you know how to look.',
        wind: [8, 14],
        cond: { shiftiness: [0.4, 0.65], variability: [0.4, 0.6], puffiness: [0.5, 0.7], gustStrengthBias: [0.45, 0.65], puffShiftiness: [0.4, 0.6] },
        islands: { count: [1, 2], maxSize: [0.05, 0.2], clustering: [0.3, 0.7], style: 'grass' },
        palette: { baseColor: '#1a2560', deepColor: '#0a0f30', shallowColor: '#27407e', shorelineColor: '#67e8f9',
                   gusts: { gustDark: [10, 30, 80], gustMid: [14, 44, 104], lullBright: [124, 152, 204], lullMid: [104, 134, 188] } },
        // Night rendering (dimmed world, glowing wakes/gust-threads) arrives in the identity pass
        fx: {}
    },
    arctic: {
        name: 'Glacier Sound',
        tagline: 'Glacier Wind & Ice', water: 'Steep cold chop', obstacles: 'Drifting bergs & floes', tags: [['DRIFTING ICE','warn'],['OVERPOWERED','warn'],['GUST TIMING','ok']],
        label: 'Arctic', emoji: '🧊',
        blurb: 'Freezing squalls pour off the ice cap and the pack drifts where it pleases. Mind the bergs, tame the gusts, survive to the finish.',
        wind: [16, 22],
        cond: { shiftiness: [0.3, 0.5], variability: [0.6, 0.85], puffiness: [0.5, 0.8], gustStrengthBias: [0.75, 0.95], puffShiftiness: [0.4, 0.6] },
        islands: { count: [0, 0] },
        palette: { baseColor: '#1d4066', deepColor: '#0e2444', shallowColor: '#2e5c8f', shorelineColor: '#dbeafe',
                   gusts: { gustDark: [8, 24, 52], gustMid: [14, 38, 76], lullBright: [200, 226, 246], lullMid: [176, 208, 236], snow: true } },
        fx: { ice: true, overpowered: true, snowfall: true }
    },
    seatrials: {
        name: 'Sea Trial Bay',
        tagline: 'Clipboard & Stopwatch', water: 'Calm, standard', obstacles: 'None', tags: [['NO SURPRISES','ok'],['TRUE BASELINE','ok']],
        label: 'Sea Trials', emoji: '⏱️',
        blurb: 'Open water, honest numbers. The committee\'s calibrated course — standard conditions, no tricks, and nowhere to hide from your own boatspeed.',
        fx: {}
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
    const venuePal = VENUES[venueKey] && VENUES[venueKey].palette;
    const pal = venuePal || DEFAULT_WATER_PALETTE;
    const { gusts, ...waterPal } = pal;
    Object.assign(window.WATER_CONFIG, waterPal);
    activeGustColors = (venuePal && venuePal.gusts) || DEFAULT_GUST_COLORS;
    GUST_SPRITES = null; // rebake puff/lull sprites in the new tint
}

// Apply a venue's condition ranges on top of resetGame's randomized defaults.
// Bay is a no-op (beyond clearing fx + restoring the palette) by design.
function applyVenueConditions() {
    const key = (settings.venue && VENUES[settings.venue]) ? settings.venue : 'bay';
    const v = VENUES[key];
    const cond = state.race.conditions;

    state.race.venue = key;
    state.race.venueFx = { ...(v.fx || {}) };
    applyVenuePalette(key);

    const draw = (range) => range[0] + Math.random() * (range[1] - range[0]);

    if (v.wind) {
        state.wind.baseSpeed = draw(v.wind);
        state.wind.speed = state.wind.baseSpeed;
    }
    if (v.cond) {
        for (const k of Object.keys(v.cond)) cond[k] = draw(v.cond[k]);
    }
    if (v.islands) {
        cond.islandCount = Math.round(draw(v.islands.count));
        if (v.islands.maxSize) cond.islandMaxSize = draw(v.islands.maxSize);
        if (v.islands.clustering) cond.islandClustering = draw(v.islands.clustering);
        cond.islandStyle = v.islands.style || 'tropical';
    } else {
        cond.islandStyle = 'tropical';
    }
    // Venues own the current: only the river has one, and it's spatial.
    if (key !== 'bay') cond.current = null;
}

// --- Venue mechanics -------------------------------------------------------

// Ocean swell: long waves travelling downwind. Sailing WITH them surfs
// (net bonus + surge cycles); punching INTO them costs. Zero effect abeam.
// (celerity is in units per state.time tick; state.time runs at 0.24x real
// seconds, so 250 here ≈ 60 units/sec of real crest travel)
const SWELL = { wavelength: 1200, celerity: 250, polarBias: 0.03, surge: 0.05 };

// Polar: above this effective wind, boats become overpowered; the handling
// stat decides how much pace they bleed. More wind stops being strictly faster.
const OVERPOWERED = { threshold: 18, costPerKnot: 0.03, handlingRelief: 0.08, maxCost: 0.25 };

// Swamp weeds: soft drag zones — up to this much boatspeed lost at patch center.
const WEED_DRAG = 0.45;

// Combined venue multiplier on a boat's target speed. Applied identically to
// player and AI so venues change the racing, not the fairness.
function getVenueSpeedFactor(boat, effectiveWind) {
    const fx = state.race.venueFx;
    if (!fx) return 1.0;
    let f = 1.0;

    if (fx.swell) {
        const sd = state.wind.baseDirection;
        const ux = -Math.sin(sd), uy = Math.cos(sd); // downwind travel unit
        const along = boat.x * ux + boat.y * uy;
        const phase = ((along - state.time * SWELL.celerity) / SWELL.wavelength) * Math.PI * 2;
        const align = Math.cos(normalizeAngle(boat.heading - sd - Math.PI)); // +1 running, -1 beating
        f *= 1 + align * (SWELL.polarBias + SWELL.surge * Math.sin(phase));
    }

    if (fx.overpowered && effectiveWind > OVERPOWERED.threshold) {
        const excess = effectiveWind - OVERPOWERED.threshold;
        const cope = Math.max(0.3, 1 - (boat.stats.handling || 0) * OVERPOWERED.handlingRelief);
        f *= 1 - Math.min(OVERPOWERED.maxCost, excess * OVERPOWERED.costPerKnot * cope);
    }

    boat.inWeeds = false;
    if (fx.weeds && state.course.weeds) {
        for (const w of state.course.weeds) {
            const dx = boat.x - w.x, dy = boat.y - w.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < w.radius * w.radius) {
                const depth = 1 - Math.sqrt(d2) / w.radius;
                // Momentum carries a hull through sticky water: ±4%/point on
                // the drag (a +5 boat feels ~20% less mud, a −5 boat ~20% more).
                // Same rule will apply to future drag zones (shoals, reef flats).
                const stick = 1 - (boat.stats.momentum || 0) * 0.04;
                f *= 1 - Math.min(0.85, WEED_DRAG * stick) * Math.min(1, depth * 1.5);
                boat.inWeeds = true;
                break;
            }
        }
    }

    return f;
}

// Local water current. Uniform everywhere except the river, where it runs
// along the course axis — strongest midstream, dying (and slightly reversing
// as a counter-eddy) at the banks. Classic river tactics: ride the middle
// when it helps, hug the bank when it hurts.
function getCurrentAt(x, y) {
    const rc = state.race.riverCurrent;
    if (rc) {
        const lat = (x - rc.cx) * rc.rx + (y - rc.cy) * rc.ry; // cross-track distance
        const t = Math.min(1, Math.abs(lat) / rc.halfWidth);

        // Along-course envelope: the flow slackens to ~25% near the start line
        // and the windward gate (rivers pool at constrictions). Without this the
        // AI's start timing — which doesn't model current — gets boats swept
        // downstream at the gun and a quarter of the fleet DNFs beating back.
        const along = (x - rc.cx) * rc.ux + (y - rc.cy) * rc.uy + rc.dist / 2;
        const t1 = Math.max(0, Math.min(1, (along - 200) / 1000));
        const t2 = Math.max(0, Math.min(1, (rc.dist - 200 - along) / 1000));
        const env = 0.25 + 0.75 * Math.min(t1, t2);

        const signed = rc.max * env * (1.15 * (1 - t * t) - 0.15);
        return {
            speed: Math.abs(signed),
            direction: signed >= 0 ? rc.flowDir : normalizeAngle(rc.flowDir + Math.PI)
        };
    }
    return state.race.conditions.current;
}

// River banks: chains of grassy islands lining both sides of the course.
// Being islands, they inherit collision, AI avoidance, pathfinding and wind
// shadow (less breeze near the bank — which pairs with the weaker current).
function generateRiverBanks(rng) {
    const d = state.wind.baseDirection;
    const ux = Math.sin(d), uy = -Math.cos(d);   // course axis (start -> windward)
    const rx = -uy, ry = ux;                      // lateral
    const dist = state.race.legLength || 4000;
    const lateral = 1550;                         // bank centreline offset
    // Step/radius/jag chosen so adjacent bank islands ALWAYS overlap even at
    // minimum vertex radius (0.85 * 260 * 2 = 442 > 300 + jitter) — a gap in
    // the chain lets boats squeeze out of the river and DNF wandering behind it.
    const step = 300;

    // The river is a CLOSED stadium: two side chains plus end caps well inside
    // the circular arena. Open ends stranded boats in the wedge pocket where
    // bank met boundary circle (29-33% DNF in evals); flat caps are escapable
    // and the wedge is unreachable.
    const capLo = -1800;
    const capHi = dist + 1800;

    const banks = [];
    const makeBank = (cx, cy) => {
        const r = 260 + rng() * 80;
        const vertices = [];
        const points = 8 + Math.floor(rng() * 4);
        for (let j = 0; j < points; j++) {
            const theta = (j / points) * Math.PI * 2;
            const vr = r * (0.85 + rng() * 0.3);
            vertices.push({ x: cx + Math.cos(theta) * vr, y: cy + Math.sin(theta) * vr });
        }
        const vegVertices = vertices.map(v => ({ x: cx + (v.x - cx) * 0.75, y: cy + (v.y - cy) * 0.75 }));
        const trees = [];
        const treeCount = 2 + Math.floor(rng() * 3);
        for (let k = 0; k < treeCount; k++) {
            const ang = rng() * Math.PI * 2, dst = rng() * r * 0.4;
            trees.push({ x: cx + Math.cos(ang) * dst, y: cy + Math.sin(ang) * dst, size: 14 + rng() * 10, rotation: rng() * Math.PI * 2 });
        }
        banks.push({ x: cx, y: cy, radius: r, vertices, vegVertices, trees, rocks: [], style: 'grass', isBank: true, soft: true });
    };

    // Side chains (overlap the caps at the corners)
    for (let side = -1; side <= 1; side += 2) {
        for (let along = capLo - 300; along <= capHi + 300; along += step) {
            const jitterL = (rng() - 0.5) * 80;
            makeBank(ux * along + rx * (lateral + jitterL) * side, uy * along + ry * (lateral + jitterL) * side);
        }
    }
    // End caps (span past the side chains so the corners are solid)
    for (const capAlong of [capLo, capHi]) {
        for (let lat2 = -(lateral + 250); lat2 <= lateral + 250; lat2 += step) {
            const jitterA = (rng() - 0.5) * 80;
            makeBank(ux * (capAlong + jitterA) + rx * lat2, uy * (capAlong + jitterA) + ry * lat2);
        }
    }

    state.race.riverCurrent = {
        cx: ux * dist / 2, cy: uy * dist / 2,
        ux, uy, rx, ry, dist,
        halfWidth: lateral - 150,
        max: 0.9 + rng() * 0.4,
        flowDir: rng() < 0.5 ? d : normalizeAngle(d + Math.PI)
    };

    // ── Continuous shore (visual only) ──────────────────────────────────
    // The bank islands above become INVISIBLE colliders/AI markers; what the
    // player sees is one continuous land mass with a wavy water's edge,
    // rendered as a single ring path (see drawRiverShore). Generated LAST so
    // the extra rng() draws cannot perturb the eval-verified course/current.
    // Edge stays outside the ±1120 physics clamp: 1240 − 55 − 35 = 1150 min.
    const worldPt = (a, l) => ({ x: ux * a + rx * l, y: uy * a + ry * l });
    const ph = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];
    const edgeLat = (a, side) => 1240
        + Math.sin(a / 640 + (side > 0 ? ph[0] : ph[2])) * 55
        + Math.sin(a / 233 + (side > 0 ? ph[1] : ph[3])) * 35;

    const ring = [];
    const stepS = 130;
    const capLoV = capLo + 150, capHiV = capHi - 150; // visual water end, inside the cap colliders
    for (let a = capLoV; a <= capHiV; a += stepS) ring.push(worldPt(a, -edgeLat(a, -1)));
    for (let l = -edgeLat(capHiV, -1); l <= edgeLat(capHiV, 1); l += stepS) ring.push(worldPt(capHiV + Math.sin(l / 300 + ph[1]) * 45, l));
    for (let a = capHiV; a >= capLoV; a -= stepS) ring.push(worldPt(a, edgeLat(a, 1)));
    for (let l = edgeLat(capLoV, 1); l >= -edgeLat(capLoV, -1); l -= stepS) ring.push(worldPt(capLoV + Math.sin(l / 300 + ph[3]) * 45, l));

    // Shore decorations, culled per-frame in drawRiverShore
    const decorations = [];
    for (let side = -1; side <= 1; side += 2) {
        for (let a = capLoV + 100; a <= capHiV - 100; a += 160 + rng() * 140) {
            const l = (edgeLat(a, side) + 70 + rng() * 260) * side;
            const p = worldPt(a, l);
            decorations.push({
                x: p.x, y: p.y,
                size: 15 + rng() * 12,
                rotation: rng() * Math.PI * 2,
                type: rng() < 0.75 ? 'tree' : 'rock'
            });
        }
    }

    state.course.riverShore = { ring, decorations };

    return banks;
}

// Polar ice floes: drifting islands. Slow enough for the AI's reactive
// avoidance; fast enough that the course never looks the same twice.
function generateIceFloes(rng) {
    const boundary = state.course.boundary;
    const marks = state.course.marks;
    const floes = [];
    const count = 15 + Math.floor(rng() * 4);

    for (let i = 0; i < count && floes.length < count; i++) {
        let placed = false;
        for (let attempt = 0; attempt < 12 && !placed; attempt++) {
            // Size tiers: 2 proper BERGS, a few mid-size floes, and a scatter
            // of small drift ice — varied like the reference art.
            const r = i < 2 ? 260 + rng() * 130
                    : i < 6 ? 140 + rng() * 100
                    : 55 + rng() * 85;
            const ang = rng() * Math.PI * 2;
            const dst = Math.sqrt(rng()) * (boundary.radius - 300);
            const cx = boundary.x + Math.sin(ang) * dst;
            const cy = boundary.y - Math.cos(ang) * dst;

            let ok = true;
            for (const m of marks) {
                if ((cx - m.x) ** 2 + (cy - m.y) ** 2 < (450 + r) ** 2) { ok = false; break; }
            }
            for (const f of floes) {
                if ((cx - f.x) ** 2 + (cy - f.y) ** 2 < (f.radius + r + 60) ** 2) { ok = false; break; }
            }
            if (!ok) continue;

            floes.push(makeFloe(cx, cy, r, rng));
            placed = true;
        }
    }
    return floes;
}

// Floe outlines, worked from aerial berg photography. Real ice is not a jittered
// circle: it lobes, it cuts deep bays, it snaps off into long shards and angular
// slabs. Building the radius as a harmonic sum gives those organic lobes and
// concave bays, and squashing along a random axis gives the elongation. Five
// archetypes, weighted so lobed bergs and shards show up most.
const FLOE_KINDS = ['pan', 'slab', 'shard', 'lobed', 'cluster', 'lobed', 'shard'];
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
        aspect = 1.9 + rng() * 1.1; bayCount = rng() < 0.5 ? 1 : 0;
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

function makeFloe(cx, cy, r, rng) {
    // The drawn outline may be deeply concave; the COLLIDER is its convex hull,
    // because satPolygonPolygon assumes convexity — feed it a bayed polygon and
    // boats "hit" open water inside the bay. Hulling outward is the safe error:
    // a boat may stop a little short of a cleft, but never sails through ice.
    const localArt = makeFloeOutline(r, rng);
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

// Brash ice: sparse fist-to-fridge-sized white chunks drifting between the
// floes. Pure texture — no collision, no AI, just "this water is cold".
function generateBrash(rng) {
    const boundary = state.course.boundary;
    const brash = [];
    const count = 70 + Math.floor(rng() * 30);
    for (let i = 0; i < count; i++) {
        const ang = rng() * Math.PI * 2;
        const dst = Math.sqrt(rng()) * boundary.radius;
        brash.push({
            x: boundary.x + Math.sin(ang) * dst,
            y: boundary.y - Math.cos(ang) * dst,
            r: 2.5 + rng() * 6,
            driftFactor: 0.8 + rng() * 0.7,
            skew: (rng() - 0.5) * 0.7
        });
    }
    return brash;
}

// Screen-space snowfall (Arctic): wind-slanted streaky flakes falling across
// the view, like the reference art. Own seeded PRNG — never Math.random
// (would desync the eval RNG stream).
let SNOW = null;
const snowRand = mulberry32(40713);
function drawSnowOverlay(ctx) {
    if (!state.race.venueFx || !state.race.venueFx.snowfall) { SNOW = null; return; }
    const w = ctx.canvas.width, h = ctx.canvas.height;

    // draw() has no dt; derive one (clamped so tab-switches don't teleport flakes)
    const now = performance.now();
    const dt = SNOW ? Math.min(0.05, Math.max(0, (now - SNOW.t) / 1000)) : 1 / 60;

    if (!SNOW || SNOW.w !== w || SNOW.h !== h) {
        SNOW = { w, h, t: now, flakes: [] };
        for (let i = 0; i < 130; i++) {
            SNOW.flakes.push({
                x: snowRand() * w, y: snowRand() * h,
                spd: 55 + snowRand() * 90,           // px/sec fall
                size: 1 + snowRand() * 2.2,
                sway: snowRand() * Math.PI * 2,
                depth: 0.45 + snowRand() * 0.55      // parallax-ish alpha/speed tier
            });
        }
    }

    SNOW.t = now;
    const slant = 0.35; // wind-driven diagonal, like the reference streaks
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    for (const f of SNOW.flakes) {
        f.y += f.spd * f.depth * dt;
        f.x += (f.spd * slant * f.depth + Math.sin(state.time * 2 + f.sway) * 14) * dt;
        if (f.y > h + 4) { f.y = -4; f.x = snowRand() * w; }
        if (f.x > w + 4) f.x = -4;
        else if (f.x < -4) f.x = w + 4;

        const len = 3 + f.spd * f.depth * 0.045;
        ctx.globalAlpha = 0.35 + f.depth * 0.4;
        ctx.lineWidth = f.size;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x - len * slant, f.y - len);
        ctx.stroke();
    }
    ctx.restore();
}

function drawBrashIce(ctx) {
    if (!state.course.brash) return;
    const camX = state.camera.x, camY = state.camera.y;
    const viewR2 = (Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 20) ** 2;
    ctx.save();
    ctx.fillStyle = 'rgba(235, 244, 250, 0.6)';
    for (const b of state.course.brash) {
        const dx = b.x - camX, dy = b.y - camY;
        if (dx * dx + dy * dy > viewR2) continue;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function updateIceFloes(dt) {
    if (!state.race.venueFx || !state.race.venueFx.ice || !state.course.islands) return;
    const boundary = state.course.boundary;
    if (!boundary) return;

    // Ice drifts at ~2-3% of the wind, skewed slightly off the wind axis.
    // (0.55 -> 0.45: slower ice erodes the AI's avoidance margins less)
    const d = state.wind.direction;
    const base = state.wind.speed * 0.45; // units/sec at driftFactor 1

    // Floes moved: invalidate the planner's inflated-island cache
    if (state.course.navVersion !== undefined) state.course.navVersion++;

    // Brash drifts with the ice (respawns on the upwind rim like floes)
    if (state.course.brash) {
        for (const bi of state.course.brash) {
            const dir = d + bi.skew;
            bi.x += -Math.sin(dir) * base * bi.driftFactor * dt;
            bi.y += Math.cos(dir) * base * bi.driftFactor * dt;
            const rx2 = bi.x - boundary.x, ry2 = bi.y - boundary.y;
            if (rx2 * rx2 + ry2 * ry2 > (boundary.radius + 100) ** 2) {
                const ang = d + (Math.random() - 0.5) * 2.0;
                const rr = boundary.radius - 150;
                bi.x = boundary.x + Math.sin(ang) * rr;
                bi.y = boundary.y - Math.cos(ang) * rr;
            }
        }
    }

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
        const relX = isl.x - boundary.x, relY = isl.y - boundary.y;
        const rd = Math.sqrt(relX * relX + relY * relY);
        const rim = boundary.radius - isl.radius * 0.5;
        if (rd > rim && rd > 1) {
            const nx = relX / rd, ny = relY / rd; // outward normal
            const dot = isl.driftVx * nx + isl.driftVy * ny;
            if (dot > 0) {
                isl.driftVx -= 2 * dot * nx;
                isl.driftVy -= 2 * dot * ny;
            }
            moveFloe(isl, (rim - rd) * nx, (rim - rd) * ny);
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
            moveFloe(a, -nx * overlap * shareA, -ny * overlap * shareA);
            moveFloe(b, nx * overlap * shareB, ny * overlap * shareB);

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
}

// Ice that spins faster than this reads as a cartoon top, not a floe
function clampSpin(w) { return Math.max(-0.75, Math.min(0.75, w)); }

// Swamp weed patches: soft circular drag zones (no collision — just slow).
function generateWeeds(rng) {
    const boundary = state.course.boundary;
    const marks = state.course.marks;
    const mStart = { x: (marks[0].x + marks[1].x) / 2, y: (marks[0].y + marks[1].y) / 2 };
    const mUpwind = { x: (marks[2].x + marks[3].x) / 2, y: (marks[2].y + marks[3].y) / 2 };
    const weeds = [];
    const count = 9 + Math.floor(rng() * 4);

    for (let i = 0; i < count; i++) {
        for (let attempt = 0; attempt < 12; attempt++) {
            const r = 130 + rng() * 150;
            const ang = rng() * Math.PI * 2;
            const dst = Math.sqrt(rng()) * (boundary.radius - 400);
            const cx = boundary.x + Math.sin(ang) * dst;
            const cy = boundary.y - Math.cos(ang) * dst;

            let ok = true;
            for (const m of marks) {
                if ((cx - m.x) ** 2 + (cy - m.y) ** 2 < (300 + r) ** 2) { ok = false; break; }
            }
            if ((cx - mStart.x) ** 2 + (cy - mStart.y) ** 2 < (550 + r) ** 2) ok = false;
            if ((cx - mUpwind.x) ** 2 + (cy - mUpwind.y) ** 2 < (550 + r) ** 2) ok = false;
            for (const w of weeds) {
                if ((cx - w.x) ** 2 + (cy - w.y) ** 2 < (w.radius + r) ** 2) { ok = false; break; }
            }
            if (!ok) continue;

            // Speckle layout is baked so patches don't shimmer frame to frame
            const clumps = [];
            const clumpCount = Math.floor(r / 12);
            for (let k = 0; k < clumpCount; k++) {
                const a = rng() * Math.PI * 2, dd = Math.sqrt(rng()) * r * 0.9;
                clumps.push({ x: cx + Math.cos(a) * dd, y: cy + Math.sin(a) * dd, size: 6 + rng() * 12 });
            }
            weeds.push({ x: cx, y: cy, radius: r, clumps });
            break;
        }
    }
    return weeds;
}

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

function fractalNoise(t, octaves=3) {
    let val = 0;
    let amp = 1;
    let freq = 1;
    let totalAmp = 0;
    for(let i=0; i<octaves; i++) {
        val += Math.sin(t * freq + (i*13.2)) * amp;
        totalAmp += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return val / totalAmp;
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
    Cheer: 'triangle',
    Bixby: 'halves',
    Skim: 'gores',
    Wobble: 'triangle',
    Pinch: 'crosshalves',
    Bruce: 'solid',
    Strut: 'gores',
    Gasket: 'stripes',
    Chomp: 'crosshalves',
    Whiskers: 'stripes',
    Vex: 'crosshalves',
    Hug: 'triangle',
    Ripple: 'gores',
    Clutch: 'solid',
    Glide: 'halves',
    Fathom: 'triangle',
    Scuttle: 'stripes',
    Finley: 'gores',
    Torch: 'gores',
    Nimbus: 'solid',
    Tangle: 'stripes',
    Brine: 'solid',
    Razor: 'gores',
    Pebble: 'halves',
    Saffron: 'triangle',
    Bramble: 'gores',
    Mistral: 'gores',
    Drift: 'triangle',
    Anchor: 'stripes',
    Zing: 'crosshalves',
    Knot: 'stripes',
    Flash: 'rays',
    Pearl: 'triangle',
    Bluff: 'solid',
    Regal: 'halves',
    Sunshine: 'rays',
    Pulse: 'triangle',
    Splat: 'triangle',
    Dart: 'crosshalves',
    Roll: 'stripes',
    Spike: 'gores',
    Flicker: 'stripes',
    Croak: 'solid',
    Snap: 'triangle',
    Rift: 'crosshalves',
    Skerry: 'crosshalves',
    Crush: 'triangle',
    Torrent: 'stripes',
    Jester: 'stripes',
    Breeze: 'gores',
    Petal: 'halves',
    Stomp: 'triangle',
    Crimson: 'solid',
    Viper: 'stripes',
    Skitter: 'gores',
    Veil: 'crosshalves',
    Puff: 'stripes',
    Lure: 'triangle',
    Wiggle: 'triangle',
    Zeffir: 'solid',
    Scoop: 'solid',
    Popper: 'rays',
    Frond: 'gores',
    Bulkhead: 'stripes',
    Slipstream: 'halves',
    Blaze: 'gores',
};
function getSpinnakerSprite(pattern, colorA, colorB) {
    const regions = SPIN_PATTERNS[pattern];
    if (!regions || !regions.length || !colorB) return getTintedBoatPart('spin', colorA);
    const key = 'spinp|' + pattern + '|' + colorA + '|' + colorB;
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
        g.save();
        region(g, s);
        g.clip();
        tintPass(colorB);
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

// Inflatable tetrahedron racing mark; gray bake for inactive marks
const markImg = new Image();
markImg.src = 'assets/images/misc/mark.png';
let markImgGray = null;
function getMarkImgGray() {
    if (markImgGray || !markImg.complete || !markImg.naturalWidth) return markImgGray;
    const c = document.createElement('canvas');
    c.width = markImg.naturalWidth; c.height = markImg.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(markImg, 0, 0);
    // Slate tint via source-atop (keeps the sprite's alpha + some shading;
    // avoids getImageData, which taints the canvas under file://)
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(148, 163, 184, 0.8)';
    g.fillRect(0, 0, c.width, c.height);
    markImgGray = c;
    return markImgGray;
}

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
        this.luffing = false;
        this.luffIntensity = 0;
        this.spinnaker = false;
        this.spinnakerDeployProgress = 0;

        this.opacity = 1.0;
        this.fadeTimer = 10.0;

        // Colors
        if (config) {
             this.colors = {
                 hull: config.hull,
                 sail: config.sail,
                 cockpit: config.cockpit,
                 spinnaker: config.spinnaker
             };
        } else if (!isPlayer) {
             this.colors = { hull: '#fff', sail: '#fff', cockpit: '#ccc', spinnaker: '#f00' };
        }
        // Panel pattern (SPIN_LOOKS, config.spinPattern override, name-hash
        // fallback); accent color comes from config.spinnaker2
        this.spinPattern = isPlayer ? null : ((config && config.spinPattern) || SPIN_LOOKS[name] || spinPatternForName(name));
        if (!isPlayer && this.colors && config && config.spinnaker2) this.colors.spinAccent = config.spinnaker2;

        // Stats (copied so the difficulty bonus never mutates AI_CONFIG)
        this.stats = { ...((config && config.stats) ? config.stats : { acceleration:0, momentum:0, handling:0, upwind:0, reach:0, downwind:0, boost:0 }) };
        if (!isPlayer) {
            for (const k in this.stats) this.stats[k] += AI_STAT_BONUS;
        }

        // Race State
        this.raceState = {
            leg: 0,
            isRounding: false,
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
        this.traits = Object.assign({}, DEFAULT_TRAITS, archDef ? archDef.traits : {});
        this.prevRank = 0;
    }
}

function updateBaseWind(dt) {
    const cond = state.race.conditions;

    // Interpolate Config based on Shiftiness (0-1)
    const s = cond.shiftiness !== undefined ? cond.shiftiness : 0.5;

    // Lerp Helper
    const lerp = (a, b, t) => a + (b - a) * t;

    let pAmp, pPeriod, pSlew;

    if (s < 0.5) {
        const t = s * 2;
        pAmp = lerp(WIND_CONFIG.presets.STEADY.amp, WIND_CONFIG.presets.NORMAL.amp, t);
        pPeriod = lerp(WIND_CONFIG.presets.STEADY.period, WIND_CONFIG.presets.NORMAL.period, t);
        pSlew = lerp(WIND_CONFIG.presets.STEADY.slew, WIND_CONFIG.presets.NORMAL.slew, t);
    } else {
        const t = (s - 0.5) * 2;
        pAmp = lerp(WIND_CONFIG.presets.NORMAL.amp, WIND_CONFIG.presets.SHIFTY.amp, t);
        pPeriod = lerp(WIND_CONFIG.presets.NORMAL.period, WIND_CONFIG.presets.SHIFTY.period, t);
        pSlew = lerp(WIND_CONFIG.presets.NORMAL.slew, WIND_CONFIG.presets.SHIFTY.slew, t);
    }

    // Update Oscillator Phase
    if (state.wind.oscillator === undefined) state.wind.oscillator = 0;
    state.wind.oscillator += dt * (2 * Math.PI / pPeriod);

    // Target Shift: primary roll + a shorter incommensurate harmonic + low-freq
    // noise, so the wind breathes naturally and never looks obviously periodic.
    const noise = fractalNoise(state.time * 0.05) * 1.0;
    const primary = pAmp * Math.sin(state.wind.oscillator + noise);
    // Secondary harmonic: ~1/3 amplitude, ~0.42x period (incommensurate).
    const secondary = (pAmp * 0.33) * Math.sin(state.wind.oscillator * 2.37 + 1.1);
    const targetDeg = primary + secondary;

    // Persistent shift: a slow one-way veer/back over the whole race (seeded in
    // resetGame). Tiny in reality over one beat, but exaggerated here to ~the
    // amplitude of one oscillation so picking the favored SIDE is a real gamble.
    // This is the opposite tactic from oscillations: commit to the shifting side,
    // don't tack on every header. (AI reads the low-freq trend to tell them apart.)
    if (state.wind.persistentShift === undefined) state.wind.persistentShift = 0;
    const pr = state.wind.persistentRate || 0; // deg/sec, signed (set at reset)
    const pMax = state.wind.persistentMax || 0;
    state.wind.persistentShift = Math.max(-pMax, Math.min(pMax, state.wind.persistentShift + pr * dt));

    // Slew Limiting on Current Shift (No wrapping issues here as shifts are small)
    if (state.wind.currentShift === undefined) state.wind.currentShift = 0;
    const currentShiftDeg = state.wind.currentShift * (180 / Math.PI);

    const diff = targetDeg - currentShiftDeg;
    const maxStep = pSlew * dt;

    let newShiftDeg = currentShiftDeg;
    if (Math.abs(diff) < maxStep) {
        newShiftDeg = targetDeg;
    } else {
        newShiftDeg += Math.sign(diff) * maxStep;
    }

    state.wind.currentShift = newShiftDeg * (Math.PI / 180);
    // Total wind direction = base + oscillation + persistent drift.
    const persistRad = state.wind.persistentShift * (Math.PI / 180);
    state.wind.direction = normalizeAngle(state.wind.baseDirection + state.wind.currentShift + persistRad);

    // Variability (Speed)
    const v = cond.variability !== undefined ? cond.variability : 0.5;
    const varPct = 0.05 + v * 0.25;
    const speedNoise = fractalNoise(state.time * 0.2 + 50);
    state.wind.speed = Math.max(2, state.wind.baseSpeed * (1.0 + speedNoise * varPct));

    // Debug History
    if (!state.wind.history) state.wind.history = [];
    if (!state.wind.debugTimer) state.wind.debugTimer = 0;
    state.wind.debugTimer -= dt;
    if (state.wind.debugTimer <= 0) {
        state.wind.debugTimer = 0.5;
        state.wind.history.push({ t: state.time, dir: newShiftDeg, speed: state.wind.speed });
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
    ctx.font = '10px monospace';
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

// Gust System
function createGust(x, y, type, initial = false) {
    const conditions = state.race.conditions;
    const baseSpeed = state.wind.speed; // Current global speed
    const windDir = state.wind.direction; // Current global direction

    // Varied size and shape (Puffiness affects size?)
    // "Average size" bias
    // Default 300-1500 X, 150-750 Y
    const puffSizeBias = conditions.puffiness !== undefined ? (0.5 + conditions.puffiness) : 1.0; // 0.5 to 1.5 multiplier
    const maxRadiusX = (300 + Math.random() * 1200) * puffSizeBias;
    const maxRadiusY = (150 + Math.random() * 600) * puffSizeBias;

    let speedDelta = 0;
    let dirDelta = 0;

    // Gust Strength
    // Strength is now balanced (0.5 bias), as the slider controls Type Balance instead.

    // Base strength factor 0.0 to 1.0 within the range
    const strengthRandom = Math.random();
    const bias = 0.5;
    const strengthFactor = (strengthRandom + bias) * 0.5; // 0 to 1

    if (type === 'gust') {
        // Range 0.20 to 0.50
        const pct = 0.20 + strengthFactor * 0.30;
        speedDelta = baseSpeed * pct;
    } else {
        // Range 0.10 to 0.40 reduction
        const pct = 0.10 + strengthFactor * 0.30;
        speedDelta = -baseSpeed * pct;
    }

    // Gust-shift coupling (Northern Hemisphere): a gust is faster, more-veered
    // upper-level air mixed down to the surface, so the wind VEERS (clockwise) in a
    // puff and BACKS (counter-clockwise) in a lull. Magnitude scales with the puff's
    // strength. This is the key realism upgrade — it turns "random gusts" into a
    // READABLE pattern (a puff lifts starboard / heads port), so both the player and
    // the AI can anticipate the shift that arrives with the pressure.
    const hemiSign = 1; // NH: gust veers +, lull backs -
    const veerBase = (8 + conditions.puffShiftiness * 14) * (Math.PI / 180); // 8-22 deg
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

    // Longer-lived puffs (90-240s) persist long enough to read, chase, and ride,
    // instead of flickering in and out.
    const duration = 90 + Math.random() * 150;
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

function spawnGlobalGust(initial = false) {
    if (!state.course.boundary) return;
    const boundary = state.course.boundary;
    const conditions = state.race.conditions;

    const r = boundary.radius + 500;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * r;
    const gx = boundary.x + Math.sin(angle) * dist;
    const gy = boundary.y - Math.cos(angle) * dist;

    // Type Bias
    // Controls Lull vs Gust prevalence. 0 = Mostly Lull. 1 = Mostly Gust.
    const bias = conditions.gustStrengthBias !== undefined ? conditions.gustStrengthBias : 0.5;
    const type = Math.random() < bias ? 'gust' : 'lull';

    state.gusts.push(createGust(gx, gy, type, initial));
}

function updateGusts(dt) {
    const conditions = state.race.conditions;
    // Puffiness controls density
    // Low: few features. High: many.
    // Density 5 to 25.
    // puffiness is 0-1.
    const targetCount = 5 + Math.floor(conditions.puffiness * 20);
    const boundary = state.course.boundary;

    // Maintain density
    if (boundary) {
        while (state.gusts.length < targetCount) {
            spawnGlobalGust();
        }
    }

    const timeScale = dt * 60;
    const globalWindSpeed = state.wind.speed;
    const globalWindDir = state.wind.direction;

    for (let i = state.gusts.length - 1; i >= 0; i--) {
        const g = state.gusts[i];

        // Update Velocity to follow global wind
        const moveSpeed = globalWindSpeed * g.moveSpeedFactor;
        const moveDir = globalWindDir + g.moveDirOffset;
        g.vx = -Math.sin(moveDir) * moveSpeed;
        g.vy = Math.cos(moveDir) * moveSpeed;

        // Update Rotation to align with local wind direction (Global + Delta)
        g.rotation = globalWindDir + g.dirDelta + Math.PI / 2;

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

function getWindAt(x, y) {
    // Current Global Wind
    const baseSpeed = state.wind.speed;
    const baseDir = state.wind.direction;

    // Convert to vector
    let sumWx = Math.sin(baseDir) * baseSpeed;
    let sumWy = -Math.cos(baseDir) * baseSpeed;

    for (const g of state.gusts) {
        const dx = x - g.x;
        const dy = y - g.y;
        const cos = Math.cos(-g.rotation);
        const sin = Math.sin(-g.rotation);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;

        const distSq = (rx*rx)/(g.radiusX*g.radiusX) + (ry*ry)/(g.radiusY*g.radiusY);
        if (distSq <= 1) {
            const falloff = 1 - Math.sqrt(distSq);
            const lifeFade = Math.min(g.age / 5, 1) * Math.min((g.duration - g.age) / 5, 1);
            const intensity = Math.max(0, falloff * lifeFade);

            if (intensity > 0) {
                 const gSpeed = g.speedDelta * intensity;
                 // Local direction inside puff
                 const gwDir = baseDir + g.dirDelta;

                 // Add puff vector
                 // Note: gSpeed can be negative (lull)
                 sumWx += Math.sin(gwDir) * gSpeed;
                 sumWy += -Math.cos(gwDir) * gSpeed;
            }
        }
    }

    // Island Wind Shadow
    // Check if point x,y is downwind of any island
    // "Wind shadows behave like stationary lulls"
    // They reduce speed but don't change direction significantly (unless we want wrapping, but requirements say "meaninfully dampen wind strength")
    let shadowFactor = 1.0;
    
    // navIslands excludes river banks (their shadows, parallel to the funneled
    // wind, would blanket the corridor edges in permanent lull-traps — and
    // getWindAt is called per particle per frame, so the list must be short).
    const shadowIslands = state.course.navIslands || state.course.islands;
    if (shadowIslands) {
        for (const isl of shadowIslands) {
            // Distance from island center
            const dx = x - isl.x;
            const dy = y - isl.y;
            
            // Wind Vector (blowing FROM baseDir)
            // Wind Direction (baseDir) is FROM direction.
            // Coordinate system: Y is down.
            // North (0) -> Blows South (+Y). Vector (0, 1).
            // East (PI/2) -> Blows West (-X). Vector (-1, 0).
            const flowX = -Math.sin(baseDir);
            const flowY = Math.cos(baseDir);
            
            // Project relative position onto flow vector
            // dot > 0 means downwind
            const dot = dx * flowX + dy * flowY;
            
            if (dot > 0) {
                // Downwind. Check cross-track distance.
                // Cross vector (-flowY, flowX) or similar
                const cross = dx * (-flowY) - dy * flowX; // 2D cross product scalar
                
                // Shadow width depends on island radius.
                // Simple cone: Width expands slightly? Or stays cylindrical?
                // Realism: Wakes spread.
                const wakeWidth = isl.radius * (1.0 + dot / 500); // Slight spread
                
                if (Math.abs(cross) < wakeWidth) {
                    // Inside shadow cone.
                    // Intensity fades with distance downwind.
                    // Max length: 8 * radius?
                    const shadowLen = isl.radius * 5;
                    if (dot < shadowLen) {
                        // Calculate intensity
                        // Center is strongest. Edges weaker.
                        // Close is strongest. Far weaker.
                        
                        const latFactor = 1.0 - Math.abs(cross) / wakeWidth; // 1 at center, 0 at edge
                        const longFactor = 1.0 - dot / shadowLen; // 1 at island, 0 at end
                        
                        // Combined strength (0 to 1)
                        // Max reduction: 70%?
                        const localShadow = latFactor * longFactor * 0.7;
                        
                        // Accumulate shadows? Or take max? Max is safer.
                        shadowFactor = Math.min(shadowFactor, 1.0 - localShadow);
                    }
                }
            }
        }
    }

    const finalSpeed = Math.sqrt(sumWx*sumWx + sumWy*sumWy) * shadowFactor;
    const finalDir = Math.atan2(sumWx, -sumWy); 

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
    const windDir = state.wind.direction;
    const wx = -Math.sin(windDir);
    const wy = Math.cos(windDir);
    // Right Vector
    const rx = -wy;
    const ry = wx;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

    for (const boat of state.boats) {
        if (boat.raceState.finished || !boat.turbulence) continue;

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


// Sound System
const Sound = {
    ctx: null,
    musicBuffers: {},
    currentTrackNode: null, // { source, gain }
    activeTrack: null,

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

    getMusicFile: function(track) {
         if (track === 'prestart') return 'assets/audio/prestart-countdown.mp3';
         if (track === 'racing-upwind') return 'assets/audio/breezy-race.mp3';
         if (track === 'racing-downwind') return 'assets/audio/spinnaker-run.mp3';
         if (track === 'results') return 'assets/audio/harbor-results.mp3';
         return null;
    },

    loadMusic: function(track) {
        if (this.musicBuffers[track]) return Promise.resolve(this.musicBuffers[track]);
        const file = this.getMusicFile(track);
        if (!file) return Promise.resolve(null);

        return fetch(file)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                this.musicBuffers[track] = audioBuffer;
                return audioBuffer;
            })
            .catch(e => {
                console.error("Error loading music:", e);
            });
    },

    fadeOutAndStop: function(node, duration = 2.0) {
        if (!node || !node.gain) return;
        try {
            const now = this.ctx.currentTime;
            node.gain.gain.cancelScheduledValues(now);
            node.gain.gain.setValueAtTime(node.gain.gain.value, now);
            node.gain.gain.linearRampToValueAtTime(0, now + duration);
            node.source.stop(now + duration + 0.1);
        } catch (e) {}
    },

    stopMusic: function() {
        // Immediate stop (for reset)
        if (this.currentTrackNode) {
            try { this.currentTrackNode.source.stop(); } catch(e) {}
            this.currentTrackNode = null;
        }
        this.activeTrack = null;
    },

    updateMusic: function() {
        if (!this.ctx) return;

        if (!settings.musicEnabled) {
            if (this.currentTrackNode) this.fadeOutAndStop(this.currentTrackNode, 0.5);
            this.currentTrackNode = null;
            this.activeTrack = null;
            return;
        }

        let targetTrack = null;
        if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) {
            targetTrack = 'results';
        } else if (state.race.status === 'prestart') {
            targetTrack = 'prestart';
        } else if (state.race.status === 'racing') {
            targetTrack = 'racing-downwind';
        }

        if (targetTrack && this.activeTrack !== targetTrack) {
            const previousNode = this.currentTrackNode;
            this.activeTrack = targetTrack;
            this.currentTrackNode = null; // Will be replaced when loaded

            if (previousNode) {
                this.fadeOutAndStop(previousNode, 2.0);
            }

            this.loadMusic(targetTrack).then(buffer => {
                if (!settings.musicEnabled) return;
                if (this.activeTrack !== targetTrack) return; // Changed while loading
                if (!buffer) return;

                const source = this.ctx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;

                const gain = this.ctx.createGain();
                gain.gain.value = 0; // Start silent for fade in

                source.connect(gain);
                gain.connect(this.ctx.destination);
                source.start(0);

                // Fade In
                const now = this.ctx.currentTime;
                gain.gain.cancelScheduledValues(now);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.3, now + 2.0);

                this.currentTrackNode = { source, gain };
            });
        }
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
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
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

    initWindSound: function() {
        if (!this.ctx || this.windSource) return;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = buffer;
        this.windSource.loop = true;
        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;
        this.windSource.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.ctx.destination);
        this.windSource.start(0);
    },

    updateWindSound: function(speed, mute = false) {
        if (!settings.soundEnabled || !settings.bgSoundEnabled || mute) {
            if (this.windGain) this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            return;
        }
        if (this.ctx) {
            if (!this.windSource) this.initWindSound();
            if (this.windGain && this.windFilter) {
                 const clampedSpeed = Math.max(5, Math.min(25, speed));
                 const volume = (0.05 + ((clampedSpeed - 5) / 20) * 0.25) * 0.5;
                 const freq = 300 + ((clampedSpeed - 5) / 20) * 900;
                 const now = this.ctx.currentTime;
                 this.windGain.gain.setTargetAtTime(volume, now, 0.1);
                 this.windFilter.frequency.setTargetAtTime(freq, now, 0.1);
            }
        }
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
    trimMode: document.getElementById('hud-trim-mode'),
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
    pauseButton: document.getElementById('pause-button'),
    resumeButton: document.getElementById('resume-button'),
    restartButton: document.getElementById('restart-button'),
    settingsButton: document.getElementById('settings-button'),
    closeSettings: document.getElementById('close-settings'),
    saveSettings: document.getElementById('save-settings'),
    settingSound: document.getElementById('setting-sound'),
    settingBgSound: document.getElementById('setting-bg-sound'),
    settingPlayerName: document.getElementById('setting-player-name'),
    settingMusic: document.getElementById('setting-music'),
    settingPenalties: document.getElementById('setting-penalties'),
    settingNavAids: document.getElementById('setting-navaids'),
    settingTrim: document.getElementById('setting-trim'),
    settingCameraMode: document.getElementById('setting-camera-mode'),
    settingHullColor: document.getElementById('setting-color-hull'),
    settingSailColor: document.getElementById('setting-color-sail'),
    settingCockpitColor: document.getElementById('setting-color-cockpit'),
    settingSpinnakerColor: document.getElementById('setting-color-spinnaker'),
    settingSpinnakerPattern: document.getElementById('setting-spinnaker-pattern'),
    settingSpinnakerColor2: document.getElementById('setting-color-spinnaker2'),
    settingSpinnakerColor2Row: document.getElementById('setting-color-spinnaker2-row'),
    leaderboard: document.getElementById('leaderboard'),
    lbLeg: document.getElementById('lb-leg'),
    lbRows: document.getElementById('lb-rows'),
    rulesStatus: document.getElementById('hud-rules-status'),
    overpoweredBadge: document.getElementById('hud-overpowered'),
    resultsOverlay: document.getElementById('results-overlay'),
    resultsList: document.getElementById('results-list'),
    resultsRestartButton: document.getElementById('results-restart-button'),
    preRaceOverlay: document.getElementById('pre-race-overlay'),
    // Config Sliders
    venuePicker: document.getElementById('venue-picker'),
    venueDetail: document.getElementById('venue-detail'),
    competitorDetail: document.getElementById('competitor-detail'),
    confCustomize: document.getElementById('conf-customize'),
    customizePanels: document.getElementById('customize-panels'),
    confWindStrength: document.getElementById('conf-wind-strength'),
    confWindVar: document.getElementById('conf-wind-variability'),
    confWindShift: document.getElementById('conf-wind-shiftiness'),
    confPuffFreq: document.getElementById('conf-puff-frequency'),
    confPuffInt: document.getElementById('conf-puff-intensity'),
    confPuffShift: document.getElementById('conf-puff-shift'),
    confWindDir: document.getElementById('conf-wind-direction'),
    valWindDir: document.getElementById('val-wind-direction'),
    confDesc: document.getElementById('conf-description'),
    confCourseDist: document.getElementById('conf-course-dist'),
    confCourseLegs: document.getElementById('conf-course-legs'),
    confCourseTimer: document.getElementById('conf-course-timer'),
    valCourseDist: document.getElementById('val-course-dist'),
    valCourseLegs: document.getElementById('val-course-legs'),
    valCourseTimer: document.getElementById('val-course-timer'),

    // Obstacles UI
    confIslandCount: document.getElementById('conf-island-count'),
    valIslandCount: document.getElementById('val-island-count'),
    confIslandMaxSize: document.getElementById('conf-island-max-size'),
    confIslandClustering: document.getElementById('conf-island-clustering'),

    // Current UI
    valCurrentDir: document.getElementById('val-current-direction'),
    valCurrentSpeed: document.getElementById('val-current-speed'),
    uiCurrentArrow: document.getElementById('ui-current-arrow'),
    uiCurrentDirText: document.getElementById('ui-current-dir-text'),
    confCurrentEnable: document.getElementById('conf-current-enable'),
    confCurrentDir: document.getElementById('conf-current-direction'),
    confCurrentSpeed: document.getElementById('conf-current-speed'),
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

function updateConditionDescription() {
    if (!UI.confDesc) return;

    const strength = parseFloat(UI.confWindStrength.value);
    const variability = parseFloat(UI.confWindVar.value);
    const shiftiness = parseFloat(UI.confWindShift.value);
    const puffFreq = parseFloat(UI.confPuffFreq.value);
    const puffInt = parseFloat(UI.confPuffInt.value);
    const puffShift = parseFloat(UI.confPuffShift.value);

    // Obstacles
    const islandCount = parseInt(UI.confIslandCount.value);
    const islandMaxSize = parseFloat(UI.confIslandMaxSize.value);
    const islandClustering = parseFloat(UI.confIslandClustering.value);

    // Apply to state
    const baseMin = 5;
    const baseMax = 25;
    state.wind.baseSpeed = baseMin + strength * (baseMax - baseMin);

    state.race.conditions.variability = variability;
    state.race.conditions.shiftiness = shiftiness;
    state.race.conditions.puffiness = puffFreq;
    state.race.conditions.gustStrengthBias = puffInt;
    state.race.conditions.puffShiftiness = puffShift;

    // Sync Obstacle state
    state.race.conditions.islandCount = islandCount;
    state.race.conditions.islandMaxSize = islandMaxSize;
    state.race.conditions.islandClustering = islandClustering;

    // Update labels
    if (UI.valIslandCount) UI.valIslandCount.textContent = islandCount;

    let text = "";

    // Wind
    if (strength < 0.3) text += "Light breeze";
    else if (strength < 0.7) text += "Moderate breeze";
    else text += "Heavy air";

    if (variability > 0.7) text += " with unstable pressure";
    else if (variability > 0.3) text += " with variable pressure";
    else text += " with steady pressure";

    if (shiftiness > 0.7) text += " and very shifty direction. ";
    else if (shiftiness > 0.3) text += " and oscillating shifts. ";
    else text += ". ";

    // Puffs
    if (puffFreq < 0.3) text += "The course has few isolated puffs";
    else if (puffFreq < 0.7) text += "Expect regular puffs across the course";
    else text += "The water is covered in heavy gusts";

    if (puffInt > 0.6) text += " consisting mostly of pressure increases";
    else if (puffInt < 0.4) text += " consisting mostly of lulls";

    if (puffShift > 0.6) text += " with sharp directional twists.";
    else if (puffShift > 0.3) text += " with some directional leverage.";
    else text += ".";

    // Obstacles
    if (islandCount > 0) {
        text += ` ${islandCount} island${islandCount > 1 ? 's' : ''} on course.`;
        if (islandClustering > 0.6) text += " Likely grouped.";
        else if (islandClustering < 0.4) text += " Scattered layout.";
    }

    UI.confDesc.textContent = text;
}

function updateCourseConfig() {
    if (UI.confCourseDist) {
        state.race.legLength = parseInt(UI.confCourseDist.value) * 5; // 1m = 5 units
        if (UI.valCourseDist) UI.valCourseDist.textContent = UI.confCourseDist.value + "m";
        initCourse();
    }
    if (UI.confCourseLegs) {
        state.race.totalLegs = parseInt(UI.confCourseLegs.value);
        if (UI.valCourseLegs) UI.valCourseLegs.textContent = state.race.totalLegs;
    }
    if (UI.confCourseTimer) {
        state.race.startTimerDuration = parseInt(UI.confCourseTimer.value);
        if (UI.valCourseTimer) UI.valCourseTimer.textContent = state.race.startTimerDuration + "s";
    }
}

// Update Current Display
function updateCurrentUI() {
    // River venue: the current is the venue's spatial field, not a knob.
    if (state.race.riverCurrent) {
        if (UI.confCurrentEnable) UI.confCurrentEnable.checked = true;
        if (UI.currentControls) UI.currentControls.classList.add('opacity-50', 'pointer-events-none');
        if (UI.valCurrentSpeed) UI.valCurrentSpeed.textContent = state.race.riverCurrent.max.toFixed(1) + " kn midstream";
        if (UI.valCurrentDir) UI.valCurrentDir.textContent = "—";
        if (UI.uiCurrentDirText) UI.uiCurrentDirText.textContent = "RIVER FLOW — STRONG MIDSTREAM, SLACK AT BANKS";
        return;
    }

    const c = state.race.conditions.current;
    const hasCurrent = !!c;

    if (UI.confCurrentEnable) UI.confCurrentEnable.checked = hasCurrent;
    if (UI.currentControls) {
            if (hasCurrent) {
                UI.currentControls.classList.remove('opacity-50', 'pointer-events-none');
            } else {
                UI.currentControls.classList.add('opacity-50', 'pointer-events-none');
            }
    }

    if (hasCurrent) {
        const deg = Math.round(c.direction * (180/Math.PI));
        if (UI.confCurrentDir) UI.confCurrentDir.value = deg;
        if (UI.confCurrentSpeed) UI.confCurrentSpeed.value = c.speed.toFixed(1);

        if (UI.valCurrentSpeed) UI.valCurrentSpeed.textContent = c.speed.toFixed(1) + " kn";
        if (UI.valCurrentDir) UI.valCurrentDir.textContent = deg + "°";

        if (UI.uiCurrentArrow && UI.uiCurrentDirText) {
                const svg = UI.uiCurrentArrow.querySelector('svg');
                if (c.speed < 0.1) {
                    if (UI.uiCurrentDirText) UI.uiCurrentDirText.textContent = "NONE";
                    if(svg) svg.style.opacity = 0.2;
                } else {
                    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
                    const idx = Math.round(deg / 45) % 8;
                    if (UI.uiCurrentDirText) UI.uiCurrentDirText.textContent = dirs[idx];
                    if(svg) {
                        svg.style.opacity = 1.0;
                        svg.style.transform = `rotate(${deg}deg)`;
                    }
                }
        }
    } else {
            // Disabled State
            if (UI.valCurrentSpeed) UI.valCurrentSpeed.textContent = "OFF";
            if (UI.valCurrentDir) UI.valCurrentDir.textContent = "-";
            if (UI.uiCurrentArrow) {
                const svg = UI.uiCurrentArrow.querySelector('svg');
                if(svg) svg.style.opacity = 0.2;
            }
            if (UI.uiCurrentDirText) UI.uiCurrentDirText.textContent = "DISABLED";
    }
};

// --- Venue picker ----------------------------------------------------------
function renderVenuePicker() {
    if (!UI.venuePicker) return;
    const selected = (settings.venue && VENUES[settings.venue]) ? settings.venue : 'bay';

    // All eight venues visible, Sea Trials leading top-left
    const visibleKeys = Object.keys(VENUES);

    if (UI.venuePicker._keys !== visibleKeys.join()) {
        UI.venuePicker._keys = visibleKeys.join();
        UI.venuePicker.innerHTML = '';
        for (const key of visibleKeys) {
            const v = VENUES[key];
            const btn = document.createElement('button');
            btn.dataset.venue = key;
            // Venue art card: thumbnail fill + name/tagline scrim (full-size
            // art lives in assets/images/venues/<key>.png for other uses)
            btn.innerHTML = `
                <img src="assets/images/venues/thumbs/${key}.png" alt="${v.label}" class="absolute inset-0 w-full h-full object-cover" draggable="false">
                <span class="absolute inset-x-0 bottom-0 pt-8 pb-2 px-3 bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-transparent text-left">
                    <span class="t-display block uppercase text-white leading-tight" style="font-size:20px;">${v.name || v.label}</span>
                    <span class="t-label t-label-sm block" style="color:#a7b4cc;">${v.tagline}</span>
                </span>`;
            btn.addEventListener('click', (e) => { e.preventDefault(); selectVenue(key); });
            UI.venuePicker.appendChild(btn);
        }
    }

    for (const btn of UI.venuePicker.children) {
        const active = btn.dataset.venue === selected;
        btn.className = 'relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition-all ' +
            (active
                ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-lg'
                : 'border-white/10 opacity-85 hover:opacity-100 hover:border-white/40');
    }
    renderVenueDetail(selected);

    // Customize toggle: venue-only by default; the condition/course panels
    // only appear for tinkerers.
    if (UI.confCustomize) UI.confCustomize.checked = !!settings.customizeConditions;
    if (UI.customizePanels) UI.customizePanels.classList.toggle('hidden', !settings.customizeConditions);
}

// Selected-venue detail: blurb + live condition tiles + hazard/skill chips.
// Wind reflects the ACTUAL rolled conditions for this race.
function renderVenueDetail(key) {
    if (!UI.venueDetail) return;
    const v = VENUES[key];

    const windVal = Math.round(state.wind.baseSpeed);
    const gustVal = Math.round(state.wind.baseSpeed * (1.2 + 0.3 * (state.race.conditions.gustStrengthBias || 0.5)));

    // Water = what the water itself is doing: current, swell, glass, chop.
    // Live values win over the static description when a flow exists.
    let waterVal = v.water;
    if (state.race.riverCurrent) waterVal = state.race.riverCurrent.max.toFixed(1) + ' kt stream';
    else if (state.race.conditions.current) waterVal = state.race.conditions.current.speed.toFixed(1) + ' kt set';

    // Sidebar briefing: banner crop, display name, lead/remainder blurb
    // hierarchy, stat rows (labels in Archivo caps, numeric readouts in mono).
    const row = (label, value, mono) => `
        <div class="flex items-center justify-between bg-slate-950/60 rounded-lg px-4 py-3 border border-white/5">
            <span class="t-label t-label-sm">${label}</span>
            <span class="${mono ? 't-mono' : 'font-bold'} text-right ml-4" style="font-size:13.5px; color:#eef4ff;">${value}</span>
        </div>`;

    UI.venueDetail.innerHTML = `
        <img src="assets/images/venues/${key}.png" alt="${v.name || v.label}" class="w-full h-64 object-cover rounded-xl border border-white/10" draggable="false">
        <div class="flex items-baseline justify-between mt-4">
            <span class="t-display uppercase text-white" style="font-size:31px;">${v.name || v.label}</span>
            ${v.name && v.name !== v.label ? `<span class="t-label t-label-sm">${v.label}</span>` : ''}
        </div>
        <div class="mt-2" style="font-size:15px; font-weight:450; color:#c2cde0; line-height:1.6;">${v.blurb || ''}</div>
        <div class="flex flex-col gap-2 mt-4">
            ${row('Wind', `${windVal}–${gustVal} kt`, true)}
            ${row('Water', waterVal, false)}
            ${row('Obstacles', v.obstacles, false)}
        </div>`;
}

// --- Competitor scouting (sidebar, below the venue briefing) ---------------
let selectedCompetitor = null;

function selectCompetitor(name) {
    selectedCompetitor = selectedCompetitor === name ? null : name; // toggle
    if (UI.prCompetitorsGrid) {
        for (const card of UI.prCompetitorsGrid.children) {
            card.classList.toggle('ring-2', card.dataset.name === selectedCompetitor);
            card.classList.toggle('ring-amber-400', card.dataset.name === selectedCompetitor);
        }
    }
    renderCompetitorDetail();
}

function renderCompetitorDetail() {
    if (!UI.competitorDetail) return;
    const config = selectedCompetitor ? AI_CONFIG.find(c => c.name === selectedCompetitor) : null;
    if (!config) {
        UI.competitorDetail.classList.add('hidden');
        UI.competitorDetail.innerHTML = '';
        return;
    }
    UI.competitorDetail.innerHTML = `<div class="t-label mb-3">Competitor Profile</div>` + competitorProfileHTML(config);
    UI.competitorDetail.classList.remove('hidden');
    renderProfileBoat(UI.competitorDetail.querySelector('.profile-boat-canvas'), config);
}

// Portrait band + blurb + stat bars + counter-tactic, as markup. Shared by the
// pre-race sidebar and the competitor.html roster sheet, so the roster always
// shows exactly what a player sees.
function competitorProfileHTML(config) {
    const archDef = (typeof ARCHETYPES !== 'undefined' && config.archetype) ? ARCHETYPES[config.archetype] : null;

    // Highlight the character's three most extreme stats (base ±5 design
    // values, not the AI difficulty bonus) — the bars always say something.
    const STAT_NAMES = {
        acceleration: 'Acceleration', momentum: 'Momentum', handling: 'Handling',
        upwind: 'Upwind', reach: 'Reach', downwind: 'Downwind', boost: 'Boost'
    };
    const sorted = Object.entries(config.stats).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
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
        <div class="flex items-center gap-3">
            <span class="t-label t-label-sm w-28">${STAT_NAMES[key]}</span>
            <div class="flex-1 h-2.5 rounded-full relative overflow-hidden" style="background:#293346;">
                <div class="absolute inset-y-0 left-1/2 w-px bg-white/20"></div>
                <div class="absolute inset-y-0 ${pos ? 'left-1/2 bg-emerald-400' : 'right-1/2 bg-rose-400'} rounded-full" style="width:${Math.abs(v) * 10}%"></div>
            </div>
            <span class="t-mono w-8 text-right ${pos ? 'text-emerald-300' : 'text-rose-300'}" style="font-size:14.5px;">${v > 0 ? '+' : ''}${v}</span>
        </div>`;
    }).join('');

    // Header band in the competitor's racing colors (same hull-vs-spinnaker
    // luma pick as the fleet cards, so the panel matches their card)
    const luma = (c) => {
        const hex = (c || '#888888').replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
        return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    const hullLuma = luma(config.hull);
    const bandColor = (hullLuma < 50 || hullLuma > 200) ? config.spinnaker : config.hull;

    return `
        <div class="rounded-xl overflow-hidden border border-white/10 relative"
             style="background: linear-gradient(105deg, ${bandColor} 0%, ${bandColor}66 45%, rgba(15,23,42,0.92) 100%)">
            <canvas class="profile-boat-canvas absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" width="176" height="130" data-boat="${config.name}"></canvas>
            <div class="flex items-center gap-5 relative">
                <img src="assets/images/competitors/${config.name.toLowerCase()}.png" alt="${config.name}" class="w-32 h-32 object-cover shrink-0" draggable="false">
                <div class="py-4">
                    <div class="t-display text-white uppercase leading-tight" style="font-size:36px; text-shadow: 0 2px 8px rgba(0,0,0,0.6)">${config.name}</div>
                    <div class="t-label mt-1" style="font-size:13px; letter-spacing:2.5px; color:#fcd34d; text-shadow: 0 1px 4px rgba(0,0,0,0.7)">${archDef ? archDef.label : ''}</div>
                </div>
            </div>
        </div>
        <div class="italic mt-4 pl-3" style="font-size:16px; color:#e6ecf8; border-left:3px solid #fcd34d;">${config.personality || ''}</div>
        <div class="flex flex-col gap-3 mt-5">${bars}</div>
        <div class="t-label t-label-sm mt-5">How to Beat Them</div>
        <div class="mt-1 leading-snug" style="font-size:15px; font-weight:500; color:#9fe6c4;">${config.beat || (archDef ? archDef.weakness : '')}</div>`;
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
    sail(getSpinnakerSprite(SPIN_LOOKS[cfg.name] || 'solid', cfg.spinnaker, cfg.spinnaker2 || cfg.hull), -28, -1.25, 1);
    g.restore();
}

// Painted bounds of that composition, relative to the origin. The silhouette is
// identical for every competitor (only the tints differ) and the pose is fixed,
// so this is a constant rather than a measurement — sniffing it from pixels
// would mean getImageData, which throws on a file:// page's tainted canvas.
// Re-derive it (alpha > 8 over a scratch render) if the pose or art changes.
const PROFILE_BOAT_BOUNDS = { x: -26, y: -26, w: 77, h: 59 };

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
    const ready = ['hull', 'main', 'spin'].every(k => boatSprites[k].complete && boatSprites[k].naturalWidth);
    if (!ready) {
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
        c.shiftiness = Math.random();
        c.variability = Math.random();
        c.puffiness = Math.random();
        c.gustStrengthBias = Math.random();
        c.puffShiftiness = Math.random();
        c.islandCount = 0;
    }

    applyVenueConditions();
    initCourse();
    if (window.WaterRenderer) window.WaterRenderer.init();
    // Clear stale gusts and reseed at the new venue's density/strength
    state.gusts = [];
    const density = 5 + Math.floor(state.race.conditions.puffiness * 20);
    for (let i = 0; i < density; i++) spawnGlobalGust(true);
    state.particles = [];

    setupPreRaceOverlay();
}

function setupPreRaceOverlay() {
    renderVenuePicker();
    if (!UI.preRaceOverlay) return;

    // Show Overlay
    UI.preRaceOverlay.classList.remove('hidden');
    UI.preRaceOverlay.querySelectorAll('.overflow-y-auto').forEach(el => el.scrollTop = 0);
    UI.leaderboard.classList.add('hidden');
    UI.legInfo.parentElement.classList.add('hidden'); // Hide leg info

    // Initialize Sliders from Current State (Randomized or Default)
    const cond = state.race.conditions;

    // Wind Direction
    if (UI.confWindDir) {
        // Calculate nominal direction by removing bias
        const bias = state.race.conditions.directionBias || 0;
        const nominalRad = normalizeAngle(state.wind.baseDirection - bias);

        let deg = nominalRad * (180 / Math.PI);
        if (deg < 0) deg += 360;
        const octant = Math.round(deg / 45) % 8;
        UI.confWindDir.value = octant;

        if (UI.valWindDir) {
            const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
            UI.valWindDir.textContent = dirs[octant];
        }
    }

    // Reverse Map Wind Strength
    const baseMin = 5, baseMax = 25;
    const strVal = Math.max(0, Math.min(1, (state.wind.baseSpeed - baseMin) / (baseMax - baseMin)));

    if (UI.confWindStrength) UI.confWindStrength.value = strVal;
    if (UI.confWindVar) UI.confWindVar.value = cond.variability;
    if (UI.confWindShift) UI.confWindShift.value = cond.shiftiness;
    if (UI.confPuffFreq) UI.confPuffFreq.value = cond.puffiness;
    if (UI.confPuffInt) UI.confPuffInt.value = cond.gustStrengthBias;
    if (UI.confPuffShift) UI.confPuffShift.value = cond.puffShiftiness;

    if (UI.confIslandCount) UI.confIslandCount.value = cond.islandCount;
    if (UI.confIslandMaxSize) UI.confIslandMaxSize.value = cond.islandMaxSize;
    if (UI.confIslandClustering) UI.confIslandClustering.value = cond.islandClustering;

    // Course Defaults
    // 4000 units / 5 = 800m
    if (UI.confCourseDist) UI.confCourseDist.value = state.race.legLength / 5;
    if (UI.confCourseLegs) UI.confCourseLegs.value = state.race.totalLegs;
    if (UI.confCourseTimer) UI.confCourseTimer.value = state.race.startTimerDuration;

    updateCurrentUI();

    // Bind Listeners (if not already bound - simple check or rebind is fine since overlay is destroyed? No, persistent.)
    // Better to remove old listeners? Or just use oninput which overwrites?
    // addEventListener adds multiple if called multiple times.
    // Let's rely on checking a flag or just do it once globally?
    // setupPreRaceOverlay is called on resetGame. resetGame is called multiple times.
    // We should bind listeners globally at the bottom of the script, not here.
    // BUT we need to set values here.

    updateConditionDescription();
    updateCourseConfig();

    // Populate Competitors
    if (UI.prCompetitorsGrid) {
        UI.prCompetitorsGrid.innerHTML = '';
        // New race, new fleet: clear any scouting selection
        selectedCompetitor = null;
        renderCompetitorDetail();
        // Skip Player (boats[0])
        const competitors = state.boats.slice(1);

        const getLuma = (c) => {
            let r=0, g=0, b=0;
            if(c.startsWith('#')) {
                const hex = c.substring(1);
                if(hex.length===3) { r=parseInt(hex[0]+hex[0],16); g=parseInt(hex[1]+hex[1],16); b=parseInt(hex[2]+hex[2],16); }
                else { r=parseInt(hex.substring(0,2),16); g=parseInt(hex.substring(2,4),16); b=parseInt(hex.substring(4,6),16); }
            }
            return 0.299*r + 0.587*g + 0.114*b;
        };

        // Simplified fleet cards (design ref): portrait + name + archetype.
        // The scouting detail (personality, threat, weakness) lives elsewhere.
        competitors.forEach(boat => {
            const config = AI_CONFIG.find(c => c.name === boat.name);
            const archDef = config && config.archetype && typeof ARCHETYPES !== 'undefined' ? ARCHETYPES[config.archetype] : null;

            const hullColor = boat.colors.hull;
            const spinColor = boat.colors.spinnaker;
            const hullLuma = getLuma(hullColor);
            const bgColor = (hullLuma < 50 || hullLuma > 200) ? spinColor : hullColor;

            const card = document.createElement('div');
            card.className = "rounded-xl border border-white/5 flex flex-col relative overflow-hidden group cursor-pointer transition-shadow hover:border-white/25";
            card.dataset.name = boat.name;
            card.addEventListener('click', () => selectCompetitor(boat.name));
            card.style.background = `linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, ${bgColor} 100%)`;
            card.innerHTML = `
                <div class="w-full aspect-square relative overflow-hidden">
                    <img src="assets/images/competitors/${boat.name.toLowerCase()}.png" alt="${boat.name}"
                         class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" draggable="false">
                </div>
                <div class="p-3 bg-slate-900/60 flex-1">
                    <div class="t-display t-display-8 text-white uppercase leading-tight" style="font-size:17.5px;">${boat.name}</div>
                    <div class="t-label t-label-sm mt-0.5" style="color:#fcd34d;">${archDef ? archDef.label : ''}</div>
                </div>`;
            UI.prCompetitorsGrid.appendChild(card);
        });
    }
}

function startRace() {
    if (state.race.status !== 'waiting') return;

    // Fix for Current Toggle State Sync
    // Ensure the game state matches the UI checkbox state exactly before starting
    // (skipped in the river venue — its spatial current isn't UI-configurable)
    if (UI.confCurrentEnable && !state.race.riverCurrent) {
        if (UI.confCurrentEnable.checked) {
            // User wants current
            if (!state.race.conditions.current) {
                // Restore from UI values or defaults
                const speed = UI.confCurrentSpeed ? parseFloat(UI.confCurrentSpeed.value) : 1.0;
                const dirDeg = UI.confCurrentDir ? parseFloat(UI.confCurrentDir.value) : 0;
                state.race.conditions.current = {
                    speed: isNaN(speed) ? 1.0 : speed,
                    direction: (isNaN(dirDeg) ? 0 : dirDeg) * (Math.PI / 180)
                };
            }
        } else {
            // User does not want current
            state.race.conditions.current = null;
        }
    }

    if (UI.preRaceOverlay) UI.preRaceOverlay.classList.add('hidden');
    UI.leaderboard.classList.remove('hidden'); // Or hidden if prestart logic handles it
    // Prestart logic usually hides leaderboard until start? No, updateLeaderboard logic: if 'prestart' UI.leaderboard.classList.add('hidden');

    // Show Leg Info
    if (UI.legInfo) UI.legInfo.parentElement.classList.remove('hidden');

    state.race.status = 'prestart';
    state.race.timer = state.race.startTimerDuration;

    // Init Audio Context if needed (user interaction trusted here)
    if ((settings.soundEnabled || settings.musicEnabled) && (!Sound.ctx || Sound.ctx.state !== 'running')) Sound.init();
    Sound.updateMusic();
}

// Settings Functions
function loadSettings() {
    const stored = localStorage.getItem('regatta_settings');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            settings = { ...DEFAULT_SETTINGS, ...parsed };
        } catch (e) { console.error("Failed to parse settings", e); }
    }
    // Migration: the Polar venue was renamed to Arctic (July 2026)
    if (settings.venue === 'polar') settings.venue = 'arctic';
    // Migration: the Semicircle kite panel became Triangle (July 2026) — without
    // this a saved 'bullseye' falls through to a plain solid sail
    if (settings.spinnakerPattern === 'bullseye') settings.spinnakerPattern = 'triangle';
    applySettings();
}

function saveSettings() {
    localStorage.setItem('regatta_settings', JSON.stringify(settings));
    applySettings();
}

function applySettings() {
    state.showNavAids = settings.navAids;
    if (state.boats.length > 0) {
        state.boats[0].manualTrim = settings.manualTrim;
        state.boats[0].name = settings.playerName;
    }
    state.camera.mode = settings.cameraMode;

    if (UI.settingPlayerName) UI.settingPlayerName.value = settings.playerName;
    if (UI.settingSound) UI.settingSound.checked = settings.soundEnabled;
    if (UI.settingBgSound) UI.settingBgSound.checked = settings.bgSoundEnabled;
    if (UI.settingMusic) UI.settingMusic.checked = settings.musicEnabled;
    if (UI.settingPenalties) UI.settingPenalties.checked = settings.penaltiesEnabled;
    if (UI.settingNavAids) UI.settingNavAids.checked = settings.navAids;
    if (UI.settingTrim) UI.settingTrim.checked = settings.manualTrim;
    if (UI.settingCameraMode) UI.settingCameraMode.value = settings.cameraMode;
    if (UI.settingHullColor) UI.settingHullColor.value = settings.hullColor;
    if (UI.settingSailColor) UI.settingSailColor.value = settings.sailColor;
    if (UI.settingCockpitColor) UI.settingCockpitColor.value = settings.cockpitColor;
    if (UI.settingSpinnakerColor) UI.settingSpinnakerColor.value = settings.spinnakerColor;
    if (UI.settingSpinnakerPattern) UI.settingSpinnakerPattern.value = SPIN_PATTERNS[settings.spinnakerPattern] ? settings.spinnakerPattern : 'solid';
    if (UI.settingSpinnakerColor2) UI.settingSpinnakerColor2.value = settings.spinnakerColor2 || '#ffffff';
    updateSpinColor2Row();

    if (UI.rulesStatus) {
        if (settings.penaltiesEnabled) {
            UI.rulesStatus.textContent = "RULES: ON";
            UI.rulesStatus.className = `mt-1 text-[10px] font-bold text-emerald-300 bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-500/50 uppercase tracking-wider`;
        } else {
            UI.rulesStatus.textContent = "RULES: OFF";
            UI.rulesStatus.className = `mt-1 text-[10px] font-bold text-red-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-red-500/50 uppercase tracking-wider`;
        }
    }
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
if (UI.pauseButton) UI.pauseButton.addEventListener('click', (e) => { e.preventDefault(); togglePause(true); UI.pauseButton.blur(); });
if (UI.resumeButton) UI.resumeButton.addEventListener('click', (e) => { e.preventDefault(); togglePause(false); });
if (UI.restartButton) UI.restartButton.addEventListener('click', (e) => { e.preventDefault(); restartRace(); });
if (UI.settingsButton) UI.settingsButton.addEventListener('click', (e) => { e.preventDefault(); toggleSettings(true); UI.settingsButton.blur(); });
if (UI.closeSettings) UI.closeSettings.addEventListener('click', () => toggleSettings(false));
if (UI.saveSettings) UI.saveSettings.addEventListener('click', () => toggleSettings(false));
if (UI.resultsRestartButton) UI.resultsRestartButton.addEventListener('click', (e) => { e.preventDefault(); restartRace(); });
if (UI.startRaceBtn) UI.startRaceBtn.addEventListener('click', (e) => { e.preventDefault(); startRace(); });

if (UI.settingPlayerName) UI.settingPlayerName.addEventListener('input', (e) => { settings.playerName = e.target.value || "Player"; saveSettings(); });
if (UI.settingSound) UI.settingSound.addEventListener('change', (e) => { settings.soundEnabled = e.target.checked; saveSettings(); if (settings.soundEnabled) Sound.init(); Sound.updateWindSound(state.wind.speed); });
if (UI.settingBgSound) UI.settingBgSound.addEventListener('change', (e) => { settings.bgSoundEnabled = e.target.checked; saveSettings(); Sound.updateWindSound(state.wind.speed); });
if (UI.settingMusic) UI.settingMusic.addEventListener('change', (e) => { settings.musicEnabled = e.target.checked; saveSettings(); Sound.init(); });
if (UI.settingPenalties) UI.settingPenalties.addEventListener('change', (e) => { settings.penaltiesEnabled = e.target.checked; saveSettings(); });
if (UI.settingNavAids) UI.settingNavAids.addEventListener('change', (e) => { settings.navAids = e.target.checked; saveSettings(); });
if (UI.settingTrim) UI.settingTrim.addEventListener('change', (e) => { settings.manualTrim = e.target.checked; saveSettings(); });
if (UI.settingCameraMode) UI.settingCameraMode.addEventListener('change', (e) => { settings.cameraMode = e.target.value; saveSettings(); });
if (UI.settingHullColor) UI.settingHullColor.addEventListener('input', (e) => { settings.hullColor = e.target.value; saveSettings(); });
if (UI.settingSailColor) UI.settingSailColor.addEventListener('input', (e) => { settings.sailColor = e.target.value; saveSettings(); });
if (UI.settingCockpitColor) UI.settingCockpitColor.addEventListener('input', (e) => { settings.cockpitColor = e.target.value; saveSettings(); });
if (UI.settingSpinnakerColor) UI.settingSpinnakerColor.addEventListener('input', (e) => { settings.spinnakerColor = e.target.value; saveSettings(); });
// Second spinnaker color only applies when the pattern has accent panels
function updateSpinColor2Row() {
    if (!UI.settingSpinnakerColor2Row) return;
    const off = (settings.spinnakerPattern || 'solid') === 'solid';
    UI.settingSpinnakerColor2Row.style.opacity = off ? '0.35' : '1';
    if (UI.settingSpinnakerColor2) UI.settingSpinnakerColor2.disabled = off;
}
if (UI.settingSpinnakerPattern) UI.settingSpinnakerPattern.addEventListener('change', (e) => { settings.spinnakerPattern = e.target.value; updateSpinColor2Row(); saveSettings(); });
if (UI.settingSpinnakerColor2) UI.settingSpinnakerColor2.addEventListener('input', (e) => { settings.spinnakerColor2 = e.target.value; saveSettings(); });

// Customize toggle: ON reveals the condition/course panels; OFF hides them
// AND re-applies the selected venue preset, so "customize off" always means
// stock venue conditions rather than invisible leftover tweaks.
if (UI.confCustomize) {
    UI.confCustomize.addEventListener('change', (e) => {
        settings.customizeConditions = e.target.checked;
        saveSettings();
        if (UI.customizePanels) UI.customizePanels.classList.toggle('hidden', !settings.customizeConditions);
        if (!settings.customizeConditions) selectVenue(settings.venue); // back to stock preset
    });
}

// Pre-Race Config Listeners
if (UI.confWindStrength) UI.confWindStrength.addEventListener('input', updateConditionDescription);
if (UI.confWindVar) UI.confWindVar.addEventListener('input', updateConditionDescription);
if (UI.confWindShift) UI.confWindShift.addEventListener('input', updateConditionDescription);
if (UI.confPuffFreq) UI.confPuffFreq.addEventListener('input', updateConditionDescription);
if (UI.confPuffInt) UI.confPuffInt.addEventListener('input', updateConditionDescription);
if (UI.confPuffShift) UI.confPuffShift.addEventListener('input', updateConditionDescription);

if (UI.confIslandCount) {
    UI.confIslandCount.addEventListener('input', updateConditionDescription);
    UI.confIslandCount.addEventListener('change', initCourse);
}
if (UI.confIslandMaxSize) {
    UI.confIslandMaxSize.addEventListener('input', updateConditionDescription);
    UI.confIslandMaxSize.addEventListener('change', initCourse);
}
if (UI.confIslandClustering) {
    UI.confIslandClustering.addEventListener('input', updateConditionDescription);
    UI.confIslandClustering.addEventListener('change', initCourse);
}

    if (UI.confWindDir) UI.confWindDir.addEventListener('input', () => {
        if (UI.valWindDir) {
            const val = parseInt(UI.confWindDir.value);
            const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
            UI.valWindDir.textContent = dirs[val];

            // Set base direction
            const targetRad = val * (Math.PI / 4); // 45 degrees step
            // Apply current offset
            const offset = state.race.conditions.directionBias || 0;
            state.wind.baseDirection = normalizeAngle(targetRad + offset);
            state.wind.direction = state.wind.baseDirection;

            // Re-init course to align with new wind
            initCourse();
            repositionBoats();
        }
    });

if (UI.confCourseDist) UI.confCourseDist.addEventListener('input', updateCourseConfig);
if (UI.confCourseLegs) UI.confCourseLegs.addEventListener('input', updateCourseConfig);
if (UI.confCourseTimer) UI.confCourseTimer.addEventListener('input', updateCourseConfig);

if (UI.confCurrentEnable) {
    UI.confCurrentEnable.addEventListener('change', (e) => {
        if (state.race.riverCurrent) { updateCurrentUI(); return; } // river current is not a knob
        if (e.target.checked) {
            // Enable default current
            state.race.conditions.current = {
                speed: 1.0,
                direction: Math.random() * Math.PI * 2
            };
        } else {
            state.race.conditions.current = null;
            // Clear current particles immediately
            state.particles = state.particles.filter(p => p.type !== 'current' && p.type !== 'mark-wake');
        }
        updateCurrentUI(); // Refresh UI
    });
}
if (UI.confCurrentDir) {
    UI.confCurrentDir.addEventListener('input', (e) => {
        if (state.race.conditions.current) {
            const deg = parseFloat(e.target.value);
            state.race.conditions.current.direction = deg * (Math.PI / 180);
            updateCurrentUI(); // Update text/arrow
        }
    });
}
if (UI.confCurrentSpeed) {
    UI.confCurrentSpeed.addEventListener('input', (e) => {
        if (state.race.conditions.current) {
            state.race.conditions.current.speed = parseFloat(e.target.value);
            updateCurrentUI(); // Update text
        }
    });
}


let minimapCtx = null;
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
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
        if (UI.rulesStatus) {
            if (settings.penaltiesEnabled) {
                UI.rulesStatus.textContent = "RULES: ON";
                UI.rulesStatus.className = `mt-1 text-[10px] font-bold text-emerald-300 bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-500/50 uppercase tracking-wider`;
            } else {
                UI.rulesStatus.textContent = "RULES: OFF";
                UI.rulesStatus.className = `mt-1 text-[10px] font-bold text-red-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-red-500/50 uppercase tracking-wider`;
            }
        }
        showToast(`Penalties: ${settings.penaltiesEnabled ? "ON" : "OFF"}`);
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
            Sound.updateWindSound(state.wind.speed);
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
            state.boats[0].manualTrim = !state.boats[0].manualTrim;
            settings.manualTrim = state.boats[0].manualTrim;
            saveSettings();
            if (UI.settingTrim) UI.settingTrim.checked = settings.manualTrim;
            if (state.boats[0].manualTrim) state.boats[0].manualSailAngle = Math.abs(state.boats[0].sailAngle);
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

function formatSplitTime(s) {
    const m = Math.floor(Math.abs(s) / 60);
    const sec = Math.floor(Math.abs(s) % 60);
    const ms = Math.floor((Math.abs(s) % 1) * 1000);
    return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

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
    const speeds = [6, 8, 10, 12, 14, 16, 20];

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

    let lower = 6, upper = 20;
    if (windSpeed >= 20) { lower = 20; upper = 20; }
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
    const dx = boat.x - b.x, dy = boat.y - b.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > b.radius - 200) {
        // Check if heading away
        const hx = Math.sin(boat.heading), hy = -Math.cos(boat.heading);
        // Normal vector at boundary is (dx, dy) relative to center.
        // We want dot product of heading and normal.
        if (hx * dx + hy * dy > 0) return true;
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
    const speeds = [6, 8, 10, 12, 14, 16, 20];

    // Apply boost stat to effective wind (same formula as physics line 3582)
    const boostFactor = stats.boost * 0.05;
    let ws = windSpeed;
    const baseWind = state.wind.baseSpeed;
    if (ws > baseWind) {
        ws = baseWind + (ws - baseWind) * (1.0 + boostFactor);
    } else {
        ws = baseWind + (ws - baseWind) * (1.0 - boostFactor);
    }
    ws = Math.max(6, Math.min(20, ws));

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
    const m0 = marks[0];
    const m1 = marks[1];

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

    // Spinnaker Logic
    const windDir = state.wind.direction; // Approximate
    const windAngle = Math.abs(normalizeAngle(windDir - boat.heading));
    boat.spinnaker = (windAngle > Math.PI * 0.65) && (speedLimit > 0.8);
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

    if (boat.raceState.finished) {
        // Fade out logic
        boat.fadeTimer -= dt;
        if (boat.fadeTimer < 2.0) {
            boat.opacity = Math.max(0, boat.fadeTimer / 2.0);
        }
        if (boat.fadeTimer <= 0) {
            boat.opacity = 0;
            // Stop updating completely if gone?
            // For now, continue to update position to allow camera to detach naturally
        }
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

    // Sail Angle Logic: Map TWA 45-180 to Sail Angle 0-90.
    // Range is 135 deg (3PI/4). Target is 90 deg (PI/2). Ratio = 2/3.
    let optimalSailAngle = Math.max(0, (angleToWind - (Math.PI / 4)) * (2.0 / 3.0));
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
    const jibFactor = Math.max(0, 1 - progress * 2);
    const spinFactor = Math.max(0, (progress - 0.5) * 2);

    // Boost Stat: Affects wind handling
    // Boost (+/-25%): Benefit from gusts, lose less from lulls/bad air.
    // 5% per point.
    const boostFactor = boat.stats.boost * 0.05;
    const baseWind = state.wind.baseSpeed;
    let physWindSpeed = localWind.speed;

    if (physWindSpeed > baseWind) {
        // Gust: Enhance benefit
        // Increase the delta above base
        physWindSpeed = baseWind + (physWindSpeed - baseWind) * (1.0 + boostFactor);
    } else {
        // Lull: Reduce loss (if boost positive)
        // physWindSpeed < base. (phys - base) is negative.
        // We want result closer to base if boost > 0.
        // Example: Base 10, Speed 8. Diff -2. Boost +0.5.
        // New Diff = -2 * (1 - 0.5) = -1. Speed = 9. Correct.
        physWindSpeed = baseWind + (physWindSpeed - baseWind) * (1.0 - boostFactor);
    }

    // Disturbed Air: Reduce intensity if boost > 0
    // Intensity is 0 to 1.
    const effectiveBadAir = boat.badAirIntensity * (1.0 - boostFactor);
    // Note: if boost is negative (e.g. -0.5), BadAir becomes 1.5x worse.

    const effectiveWind = Math.max(0, physWindSpeed * (1.0 - effectiveBadAir));
    boat.effectiveWindNow = effectiveWind; // read by the HUD overpowered badge

    let targetKnotsJib = getTargetSpeed(angleToWind, false, effectiveWind);
    let targetKnotsSpin = getTargetSpeed(angleToWind, true, effectiveWind);
    let targetKnots = targetKnotsJib * jibFactor + targetKnotsSpin * spinFactor;

    const actualMagnitude = Math.abs(boat.sailAngle);
    const angleDiff = Math.abs(actualMagnitude - optimalSailAngle);
    const trimEfficiency = Math.max(0, 1.0 - angleDiff * 2.0);
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

    // Archetype identity tax (e.g. shift-whisperers are slow in a straight line)
    if (boat.traits && boat.traits.speedScale !== 1.0) targetKnots *= boat.traits.speedScale;

    // Venue effects: ocean swell surfing, polar overpowering, swamp weed drag
    targetKnots *= getVenueSpeedFactor(boat, effectiveWind);

    let targetGameSpeed = targetKnots * 0.25;

    // Penalties no longer slow the boat directly — the cost is the owed 360°
    // turn (see triggerPenalty). Rule 21 keep-clear still applies while flagged.

    if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
         if (checkBoundaryExiting(boat)) window.onRaceEvent('collision_boundary', { boat });
    }

    const effectiveAoA = angleToWind - actualMagnitude;
    const luffStartThreshold = 0.5;
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

    // Apparent wind = true wind (air motion) minus the boat's own motion. As the boat
    // accelerates, the apparent wind creeps forward and strengthens — "the boat makes
    // its own wind." Used for the flag/telltales and HUD so fast points of sail feel
    // alive. (Speed/VMG model stays on TRUE wind angle, which is correct for polars.)
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
    if (state.race.riverCurrent) {
        // River arena is the bank corridor, not the circle. Hard-clamp to the
        // bank CENTERLINES: SAT vs the bank polygons handles the fine contact,
        // but a boat that tunnels through overlapping bank islands (SAT push-out
        // can eject deep intruders out the far side) is snapped back to the
        // correct side instead of stranding behind the wall.
        const rc = state.race.riverCurrent;
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
        const b = state.course.boundary;
        const dx = boat.x - b.x, dy = boat.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > b.radius) {
            const angle = Math.atan2(dy, dx);
            boat.x = b.x + Math.cos(angle) * b.radius;
            boat.y = b.y + Math.sin(angle) * b.radius;

            if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
                window.onRaceEvent('collision_boundary', { boat });
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

function updateBoatRaceState(boat, dt) {
    // Timers
    if (boat.raceState.startTimeDisplayTimer > 0) boat.raceState.startTimeDisplayTimer -= dt;
    if (boat.raceState.legSplitTimer > 0) boat.raceState.legSplitTimer -= dt;

    // Waypoint
    const marks = state.course.marks;
    if (marks && marks.length >= 4) {
        let indices = (boat.raceState.leg === 0 || boat.raceState.leg === 2 || boat.raceState.leg === 4) ? [0, 1] : [2, 3];
        const m1 = marks[indices[0]], m2 = marks[indices[1]];
        const closest = getClosestPointOnSegment(boat.x, boat.y, m1.x, m1.y, m2.x, m2.y);
        const dx = closest.x - boat.x, dy = closest.y - boat.y;
        boat.raceState.nextWaypoint = {
            x: closest.x, y: closest.y,
            dist: Math.sqrt(dx*dx + dy*dy) * 0.2,
            angle: Math.atan2(dx, -dy)
        };

        // Zone Check
        let inZone = false;
        let zoneMarks = [];
        // No zones on Start (0) or Finish (totalLegs)
        if (boat.raceState.leg > 0 && boat.raceState.leg < state.race.totalLegs) {
            if (boat.raceState.leg % 2 !== 0) zoneMarks = [2, 3];
            else zoneMarks = [0, 1];
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
        const m0 = marks[0], m1 = marks[1];
        const lineDx = m1.x - m0.x, lineDy = m1.y - m0.y;
        const lineLen = Math.hypot(lineDx, lineDy) || 1;
        // Signed perpendicular distance to the line: positive = course side (OCS).
        const perpDist = ((boat.x - m0.x) * lineDy - (boat.y - m0.y) * lineDx) / lineLen;
        if (perpDist < -40) {
            boat.raceState.ocs = false;
            if (boat.isPlayer) hideRaceMessage();
        }
    }

    // Crossing Logic
    // Same logic as before, applied to boat.raceState
    if (marks && marks.length >= 4) {
        let gateIndices = [];
        let requiredDirection = 1;

        if (boat.raceState.leg === 0) {
            gateIndices = [0, 1]; requiredDirection = 1;
        } else if (boat.raceState.leg <= state.race.totalLegs) {
            // Odd legs (1, 3...): Upwind to 2,3. Direction 1 (Crossing Upwind)
            // Even legs (2, 4...): Downwind to 0,1. Direction -1 (Crossing Downwind)
            if (boat.raceState.leg % 2 !== 0) {
                 gateIndices = [2, 3]; requiredDirection = 1;
            } else {
                 gateIndices = [0, 1]; requiredDirection = -1;
            }
        }

        if (gateIndices.length > 0) {
            const m1 = marks[gateIndices[0]], m2 = marks[gateIndices[1]];
            const intersect = checkLineIntersection(boat.raceState.lastPos.x, boat.raceState.lastPos.y, boat.x, boat.y, m1.x, m1.y, m2.x, m2.y);

            if (intersect) {
                const gateDx = m2.x - m1.x, gateDy = m2.y - m1.y;
                const nx = gateDy, ny = -gateDx;
                const moveDx = boat.x - boat.raceState.lastPos.x, moveDy = boat.y - boat.raceState.lastPos.y;
                const dot = moveDx * nx + moveDy * ny;
                const crossingDir = dot > 0 ? 1 : -1;

                if (state.race.status === 'prestart') {
                    if (gateIndices[0] === 0) {
                        if (crossingDir === 1) {
                            boat.raceState.ocs = true;
                            if (boat.isPlayer) showRaceMessage("OCS - RETURN TO PRE-START!", "text-red-500", "border-red-500/50");
                        } else {
                            boat.raceState.ocs = false;
                            if (boat.isPlayer) hideRaceMessage();
                        }
                    }
                } else if (state.race.status === 'racing' && !boat.raceState.finished) {
                    if (boat.raceState.leg === 0) {
                        if (crossingDir === 1) {
                            if (!boat.raceState.ocs) {
                                boat.raceState.leg++;
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
                         const completeLeg = () => {
                            boat.raceState.leg++;
                            if (window.onRaceEvent) window.onRaceEvent('leg_complete', { boat, leg: boat.raceState.leg - 1, time: state.race.timer });
                            boat.raceState.isRounding = false;
                            const split = state.race.timer - boat.raceState.legStartTime;
                            boat.raceState.lastLegDuration = split;
                            if (boat.raceState.leg > 1) boat.raceState.legTimes.push(split);
                            boat.raceState.legSplitTimer = 5.0;
                            boat.raceState.legStartTime = state.race.timer;

                            if (boat.raceState.leg > state.race.totalLegs) {
                                boat.raceState.finished = true;
                                boat.raceState.finishTime = state.race.timer;
                                if (boat.raceState.penalty) {
                                    // Un-taken penalty turns convert to time at the finish.
                                    boat.raceState.finishTime += 15 * Math.max(1, boat.raceState.penaltyTurnsOwed);
                                }
                                if (window.onRaceEvent) window.onRaceEvent('finish', { boat, time: boat.raceState.finishTime });
                                boat.raceState.trace.push({ x: boat.x, y: boat.y, leg: 4 });
                                if (boat.isPlayer) {
                                    showRaceMessage("FINISHED!", "text-green-400", "border-green-400/50");
                                    Sound.playFinish();
                                    if (window.confetti) window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                                } else {
                                    Sayings.queueQuote(boat, "finished_race");
                                }
                            } else {
                                if (boat.isPlayer) {
                                    Sound.playGateClear();
                                    Sound.updateMusic();
                                } else {
                                    Sayings.queueQuote(boat, "rounded_mark");
                                }
                            }
                        };

                        if (boat.raceState.leg === state.race.totalLegs) {
                            if (crossingDir === requiredDirection) completeLeg();
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
                 const completeLeg = () => {
                    boat.raceState.leg++;
                    if (window.onRaceEvent) window.onRaceEvent('leg_complete', { boat, leg: boat.raceState.leg - 1, time: state.race.timer });
                    boat.raceState.isRounding = false;
                    const split = state.race.timer - boat.raceState.legStartTime;
                    boat.raceState.lastLegDuration = split;
                    if (boat.raceState.leg > 1) boat.raceState.legTimes.push(split);
                    boat.raceState.legSplitTimer = 5.0;
                    boat.raceState.legStartTime = state.race.timer;
                    if (boat.raceState.leg > state.race.totalLegs) {
                        boat.raceState.finished = true;
                        boat.raceState.finishTime = state.race.timer;
                        if (boat.raceState.penalty) {
                            // Un-taken penalty turns convert to time at the finish.
                            boat.raceState.finishTime += 15 * Math.max(1, boat.raceState.penaltyTurnsOwed);
                        }
                        if (boat.isPlayer) {
                            showRaceMessage("FINISHED!", "text-green-400", "border-green-400/50");
                            Sound.playFinish();
                            if (window.confetti) window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                        } else {
                            Sayings.queueQuote(boat, "finished_race");
                        }
                    } else {
                        if (boat.isPlayer) {
                            Sound.playGateClear();
                            Sound.updateMusic();
                        } else {
                            Sayings.queueQuote(boat, "rounded_mark");
                        }
                    }
                };

                const gDx = m2.x - m1.x, gDy = m2.y - m1.y;
                const len = Math.sqrt(gDx*gDx + gDy*gDy);
                const ux = gDx / len, uy = gDy / len;
                const nx = gDy, ny = -gDx; // Upwind normal
                const extLen = 10000;

                const checkExt = (ax, ay, bx, by) => {
                    if (checkLineIntersection(boat.raceState.lastPos.x, boat.raceState.lastPos.y, boat.x, boat.y, ax, ay, bx, by)) {
                        const moveDx = boat.x - boat.raceState.lastPos.x, moveDy = boat.y - boat.raceState.lastPos.y;
                        return (moveDx * nx + moveDy * ny > 0) ? 1 : -1;
                    }
                    return 0;
                };

                const dirL = checkExt(m1.x, m1.y, m1.x - ux * extLen, m1.y - uy * extLen);
                const dirR = checkExt(m2.x, m2.y, m2.x + ux * extLen, m2.y + uy * extLen);
                if (dirL === -requiredDirection || dirR === -requiredDirection) completeLeg();
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
function getHullPolygon(boat) {
    const locals = [
        {x: 0, y: -25}, {x: 15, y: -5}, {x: 15, y: 20},
        {x: 12, y: 30}, {x: -12, y: 30}, {x: -15, y: 20}, {x: -15, y: -5}
    ];
    const cos = Math.cos(boat.heading), sin = Math.sin(boat.heading);
    return locals.map(p => ({
        x: boat.x + (p.x * cos - p.y * sin),
        y: boat.y + (p.x * sin + p.y * cos)
    }));
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
    const markRadius = 12;

    // Reset collision flags for next frame's AI
    for (const boat of state.boats) {
        if (boat.ai) boat.ai.collisionData = null;
    }

    for (const boat of state.boats) {
        let close = false;
        for (const mark of state.course.marks) {
             if ((boat.x-mark.x)**2 + (boat.y-mark.y)**2 < (50)**2) { close = true; break; }
        }
        if (!close) continue;

        const poly = getHullPolygon(boat);
        for (const mark of state.course.marks) {
            const res = satPolygonCircle(poly, mark, markRadius);
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
    if (state.race.riverCurrent || (state.race.conditions.current && state.race.conditions.current.speed > 0.1)) {
        // Spawn at a random point near the camera; visibility scales with the
        // LOCAL current there, so the river's midstream reads faster than the banks.
        const range = Math.max(canvas.width, canvas.height) * 1.5;
        const px = state.camera.x + (Math.random() - 0.5) * range;
        const py = state.camera.y + (Math.random() - 0.5) * range;
        const local = getCurrentAt(px, py);
        if (local && local.speed > 0.15) {
            const spawnChance = (0.2 + (local.speed / 3.0) * 0.5) * 0.25;
            if (Math.random() < spawnChance) {
                createParticle(px, py, 'current', { life: 1.0 + Math.random(), alpha: Math.min(1, local.speed / 1.5) });
            }
        }

        // Mark Wakes
        if (state.course.marks) {
            for (const m of state.course.marks) {
                const mc = getCurrentAt(m.x, m.y);
                if (mc && mc.speed > 0.15 && Math.random() < 0.3 * (mc.speed / 3.0)) {
                     // Mark is obstacle. Wake forms downstream.
                     const flowDir = mc.direction;
                     const offset = 12; // Radius
                     const wx = Math.sin(flowDir) * offset;
                     const wy = -Math.cos(flowDir) * offset;
                     createParticle(m.x + wx + (Math.random()-0.5)*10, m.y + wy + (Math.random()-0.5)*10, 'mark-wake', { life: 1.5, alpha: 0.5 * (mc.speed/3.0), scale: 0.8 });
                }
            }
        }
    }

    // Venue: drifting ice floes (Polar)
    updateIceFloes(dt);

    // Sound (Use Player's local wind)
    const resultsVisible = UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden');
    if (state.boats.length > 0) {
        const p = state.boats[0];
        const w = getWindAt(p.x, p.y);
        Sound.updateWindSound(w.speed, resultsVisible);
    } else {
        Sound.updateWindSound(state.wind.speed, resultsVisible);
    }

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
        const totalDistMeters = (state.race.totalLegs * state.race.legLength) / 5;
        const cutoffTime = totalDistMeters * 0.1875;

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
        let indices = (state.race.totalLegs % 2 === 0) ? [0, 1] : [2, 3];
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
                if (boat.wakeTrail.length > 4 && Math.random() < (planing ? 0.22 : 0.10) * str0) {
                    const idx = 1 + Math.floor(Math.random() * Math.min(9, boat.wakeTrail.length - 2));
                    const p = boat.wakeTrail[idx];
                    const q = boat.wakeTrail[idx + 1];
                    const sdx = q.x - p.x, sdy = q.y - p.y;
                    const sl = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
                    const off = (Math.random() - 0.5) * 2 * (8 + p.age * 8);
                    createParticle(p.x + (-sdy / sl) * off, p.y + (sdx / sl) * off, 'wake', { scale: 0.7 + Math.random() * 0.9 });
                }
            }
        }
    }

    // Wind streaks: pressure-weighted spawns — gusts breed streaks, lulls go
    // near-silent, so streak density itself reports the wind field
    if (Math.random() < 0.5) {
        const range = Math.max(canvas.width, canvas.height) * 1.5;
        const sx = state.camera.x + (Math.random()-0.5)*range;
        const sy = state.camera.y + (Math.random()-0.5)*range;
        const rel = getWindAt(sx, sy).speed / Math.max(1, state.wind.speed);
        const chance = Math.max(0.07, (rel - 0.85) * 1.6);
        if (Math.random() < chance) {
            createParticle(sx, sy, 'wind', { life: Math.random() + 0.7, jit: Math.random() });
        }
    }
    updateParticles(dt);
    updateWindWaves(dt);
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
             const local = getWindAt(p.x, p.y);
             p.x -= Math.sin(local.direction)*timeScale * (local.speed / 10);
             p.y += Math.cos(local.direction)*timeScale * (local.speed / 10);
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
        ctx.strokeStyle = state.race.riverCurrent ? '#14352c' : '#0640bf';
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
        // SailGP-style comet streaks: a thick bright head leading downwind with a
        // thin tapering tail — the asymmetry alone shows wind direction. Length
        // and width scale with local wind; color warms white -> amber inside
        // gusts so pressure reads at a glance.
        const base = Math.max(1, state.wind.speed);
        for (const p of state.particles) {
            if (p.type !== 'wind') continue;
            if (!onScreen(p)) continue;
            const local = getWindAt(p.x, p.y);
            const rel = local.speed / base;
            const L = 34 + local.speed * 4.5;
            const mx = -Math.sin(local.direction), my = Math.cos(local.direction);
            const nx = -my, ny = mx;
            const hx = p.x + mx * L * 0.3, hy = p.y + my * L * 0.3;
            const tx = p.x - mx * L * 0.7, ty = p.y - my * L * 0.7;
            const gust = Math.max(0, Math.min(1, (rel - 1.03) / 0.3));
            const lull = Math.max(0, Math.min(1, (0.97 - rel) / 0.25));
            const alpha = Math.min(p.life, 1) * (0.15 + rel * 0.13 + gust * 0.22) * (1 - lull * 0.65);
            if (alpha <= 0.015) continue;
            const cg = Math.round(255 - 69 * gust), cb = Math.round(255 - 191 * gust);
            const wH = (2.3 + (p.jit || 0.5) * 0.8) * (1 + gust * 1.1);
            ctx.fillStyle = `rgba(255,${cg},${cb},${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(hx + nx * wH, hy + ny * wH);
            ctx.lineTo(hx - nx * wH, hy - ny * wH);
            ctx.lineTo(tx, ty);
            ctx.closePath();
            ctx.fill();
            // rounded bright head cap
            ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.9).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(hx, hy, wH * 0.7, 0, Math.PI * 2);
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
    const hullColor = (boat.isPlayer ? settings.hullColor : boat.colors.hull) || '#f1f5f9';
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
    const cockpitColor = boat.isPlayer ? settings.cockpitColor : boat.colors.cockpit;
    drawCockpitFittings(ctx, cockpitColor);

    // Masthead fly (wind pennant) — streams downwind with the APPARENT wind. You can
    // watch it swing forward as the boat accelerates ("the boat makes its own wind"),
    // and it's the realistic cue for trimming and reading the lift/header in a puff.
    if (boat.apparentWind) {
        const rel = normalizeAngle(boat.apparentWind.direction - boat.heading);
        const fx = -Math.sin(rel), fy = Math.cos(rel); // streams to where wind blows TO (local frame)
        const px2 = -fy, py2 = fx; // perpendicular, for the flutter wave
        const len = 13 + Math.min(8, boat.apparentWind.speed * 0.4);
        ctx.save();
        ctx.strokeStyle = boat.isPlayer ? '#fbbf24' : 'rgba(241,245,249,0.6)';
        ctx.lineWidth = boat.isPlayer ? 2.2 : 1.4;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // Telltale flutter: a traveling wave runs down the ribbon, amplitude
        // growing toward the free end; phased per boat so flies don't sync
        const t = state.time * 55 + (typeof boat.id === 'number' ? boat.id : 0) * 1.7;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        for (let i = 1; i <= 6; i++) {
            const f = i / 6;
            const wave = Math.sin(t - f * 4.5) * f * f * 2.4;
            ctx.lineTo(fx * len * f + px2 * wave, -5 + fy * len * f + py2 * wave);
        }
        ctx.stroke();
        ctx.restore();
    }

    // Sails
    const drawSailFunc = (isJib, scale = 1.0) => {
        ctx.save();
        if (isJib) { ctx.translate(0, -25); ctx.rotate(boat.sailAngle); }
        else { ctx.translate(0, -5); ctx.rotate(boat.sailAngle); }

        const sailColor = boat.isPlayer ? settings.sailColor : boat.colors.sail;
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
        const spinColor = boat.isPlayer ? settings.spinnakerColor : boat.colors.spinnaker;
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
                boat.isPlayer ? (settings.spinnakerPattern || 'solid') : (boat.spinPattern || 'solid'),
                color || '#ffffff',
                boat.isPlayer ? (settings.spinnakerColor2 || settings.hullColor) : (boat.colors.spinAccent || boat.colors.hull))
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
    const sailColor = boat.isPlayer ? settings.sailColor : boat.colors.sail;
    const spinColor = boat.isPlayer ? settings.spinnakerColor : boat.colors.spinnaker;

    if (!drawSailSprite('main', -5, sailColor, 1)) drawSailFunc(false);
    const progress = boat.spinnakerDeployProgress;
    const jibScale = Math.max(0, 1 - progress * 2);
    const spinScale = Math.max(0, (progress - 0.5) * 2);
    if (jibScale > 0.01 && !drawSailSprite('jib', -25, sailColor, jibScale)) drawSailFunc(true, jibScale);
    if (spinScale > 0.01 && !drawSailSprite('spin', -28, spinColor, spinScale)) drawSpinnaker(spinScale);
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

    let activeMarks = [];
    if (player.raceState.leg % 2 !== 0) activeMarks = [{ index: 2, ccw: true }, { index: 3, ccw: false }]; // Upwind
    else activeMarks = [{ index: 0, ccw: false }, { index: 1, ccw: true }]; // Downwind

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
    let indices;
    if (state.race.status === 'finished' || player.raceState.finished) {
        indices = (state.race.totalLegs % 2 === 0) ? [0, 1] : [2, 3];
    } else {
        if (player.raceState.leg !== 0 && player.raceState.leg !== state.race.totalLegs) return;
        indices = (player.raceState.leg % 2 === 0) ? [0, 1] : [2, 3];
    }
    const m1 = state.course.marks[indices[0]], m2 = state.course.marks[indices[1]];
    ctx.save();
    const dashOffset = -state.time * 20;
    ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y);

    let color = '#ffffff';
    if (state.race.status === 'finished' || player.raceState.finished) color = '#4ade80';
    else if (player.raceState.leg === 0 && state.race.status === 'prestart') color = '#ef4444';

    ctx.shadowColor = color; ctx.shadowBlur = 15; ctx.strokeStyle = color; ctx.lineWidth = 5;
    ctx.lineDashOffset = dashOffset; ctx.stroke();

    ctx.save(); ctx.fillStyle = color; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const midX = (m1.x+m2.x)/2, midY = (m1.y+m2.y)/2;
    let label = (player.raceState.leg === 0) ? "START" : ((player.raceState.leg === state.race.totalLegs || state.race.status === 'finished' || player.raceState.finished) ? "FINISH" : "");
    if (label) {
        const angle = Math.atan2(m2.y - m1.y, m2.x - m1.x);
        // Face approaching racers: the text's top points in the direction of travel
        // through the line (START: toward the first gate; FINISH: away from the last gate)
        const oIdx = (indices[0] === 0) ? [2, 3] : [0, 1];
        const o1 = state.course.marks[oIdx[0]], o2 = state.course.marks[oIdx[1]];
        let tx = (o1.x + o2.x) / 2 - midX, ty = (o1.y + o2.y) / 2 - midY;
        if (label === 'FINISH') { tx = -tx; ty = -ty; }
        ctx.translate(midX, midY);
        let rot = angle;
        if (Math.sin(rot) * tx - Math.cos(rot) * ty < 0) rot += Math.PI;
        ctx.rotate(rot); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeText(label, 0, 0); ctx.fillText(label, 0, 0);
    }
    ctx.restore(); ctx.restore();
}

function drawLadderLines(ctx) {
    const player = state.boats[0];
    if (!state.showNavAids || state.race.status === 'prestart' || state.race.status === 'finished' || player.raceState.finished) return;

    const m0 = state.course.marks[0], m1 = state.course.marks[1], m2 = state.course.marks[2], m3 = state.course.marks[3];
    const c1x = (m0.x+m1.x)/2, c1y = (m0.y+m1.y)/2, c2x = (m2.x+m3.x)/2, c2y = (m2.y+m3.y)/2;
    const dx = c2x-c1x, dy = c2y-c1y, len = Math.sqrt(dx*dx+dy*dy);
    const wx = dx/len, wy = dy/len, px = -wy, py = wx;
    const courseAngle = Math.atan2(wx, -wy);

    let prevIndex = (player.raceState.leg === 0 || player.raceState.leg % 2 !== 0) ? 0 : 2;
    let nextIndex = (prevIndex === 0) ? 2 : 0;

    const mPrev = state.course.marks[prevIndex], mNext = state.course.marks[nextIndex];
    const startProj = mPrev.x*wx + mPrev.y*wy, endProj = mNext.x*wx + mNext.y*wy;
    let minP = Math.min(startProj, endProj), maxP = Math.max(startProj, endProj);

    const interval = 500;
    const firstLine = Math.floor(minP/interval)*interval;

    // Boundary & Laylines Projection logic same as before...
    const uL = mNext.x*wx + mNext.y*wy, vL = mNext.x*px + mNext.y*py;
    const mNextR = state.course.marks[nextIndex+1];
    const uR = mNextR.x*wx + mNextR.y*wy, vR = mNextR.x*px + mNextR.y*py;
    const b = state.course.boundary;
    const uC = b.x*wx + b.y*wy, vC = b.x*px + b.y*py, R = b.radius;

    const isUpwindTarget = (nextIndex === 2);
    const delta = normalizeAngle(state.wind.direction - courseAngle);
    let slopeLeft = Math.tan(delta + Math.PI/4), slopeRight = Math.tan(delta - Math.PI/4);
    if (!isUpwindTarget) { slopeLeft = Math.tan(delta - Math.PI/4); slopeRight = Math.tan(delta + Math.PI/4); }

    ctx.save(); ctx.strokeStyle = `rgba(${NAV_RGB}, 0.5)`; ctx.lineWidth = 3;
    ctx.font = 'italic 900 22px Saira, Archivo, sans-serif'; ctx.fillStyle = `rgba(${NAV_RGB}, 0.9)`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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

function drawLayLines(ctx) {
    if (!state.showNavAids || state.race.status === 'finished') return;
    const player = state.boats[0];
    let targets = (player.raceState.leg % 2 === 0) ? [0, 1] : [2, 3];
    const isUpwind = (player.raceState.leg % 2 !== 0) || (player.raceState.leg === 0);
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
            const t = rayCircleIntersection(startX, startY, dx, dy, state.course.boundary.x, state.course.boundary.y, state.course.boundary.radius);
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

    // Exclude Start (0) and Finish (totalLegs)
    if (player.raceState.leg > 0 && player.raceState.leg < state.race.totalLegs) {
        if (player.raceState.leg % 2 !== 0) active = [2, 3];
        else active = [0, 1];
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
    ctx.font = 'italic 900 52px Saira, Archivo, sans-serif';
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
function bakeGustSprites() {
    const gc = activeGustColors;
    const make = (stops, withSnow) => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g2 = c.getContext('2d');
        const grad = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
        for (const [pos, color] of stops) grad.addColorStop(pos, color);
        g2.fillStyle = grad;
        g2.fillRect(0, 0, 256, 256);

        // Arctic squalls: white flurry streaks along the wind axis, clipped
        // to the puff's own alpha via source-atop. Seeded PRNG — this bakes
        // lazily mid-race and must never touch Math.random (eval RNG).
        if (withSnow) {
            const prand = mulberry32(9377);
            g2.globalCompositeOperation = 'source-atop';
            g2.lineCap = 'round';
            for (let i = 0; i < 70; i++) {
                const y = 128 + (prand() + prand() - 1) * 100;
                const x = prand() * 236;
                const len = 8 + prand() * 26;
                g2.strokeStyle = `rgba(255, 255, 255, ${0.18 + prand() * 0.3})`;
                g2.lineWidth = 1.5 + prand() * 1.5;
                g2.beginPath();
                g2.moveTo(x, y);
                g2.lineTo(x + len, y + (prand() - 0.5) * 4);
                g2.stroke();
            }
            g2.globalCompositeOperation = 'source-over';
        }
        return c;
    };
    GUST_SPRITES = {
        // Relative alpha profile is baked in; per-gust intensity is applied
        // via globalAlpha at draw time — output matches the old gradients.
        gust: make([
            [0, `rgba(${gc.gustDark[0]}, ${gc.gustDark[1]}, ${gc.gustDark[2]}, 1)`],
            [0.55, `rgba(${gc.gustMid[0]}, ${gc.gustMid[1]}, ${gc.gustMid[2]}, 0.45)`],
            [1, `rgba(${gc.gustMid[0]}, ${gc.gustMid[1]}, ${gc.gustMid[2]}, 0)`]
        ], !!gc.snow),
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
        ctx.drawImage(GUST_SPRITES[g.type === 'gust' ? 'gust' : 'lull'], -g.radiusX, -g.radiusY, g.radiusX * 2, g.radiusY * 2);
        ctx.restore();
    }
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
        ctx.save(); ctx.translate(m.x, m.y);
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(3, 3, 12, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

function drawMarkBodies(ctx) {
    const player = state.boats[0];
    const W = 30, H = W * (markImg.naturalHeight / (markImg.naturalWidth || 1)) || 26;
    for (let i=0; i<state.course.marks.length; i++) {
        const m = state.course.marks[i];
        ctx.save(); ctx.translate(m.x, m.y);
        // Very subtle bob: slow breathing scale + faint rotation wobble, phased
        // per mark by position (deterministic — no RNG in the render path)
        const phase = m.x * 0.013 + m.y * 0.007;
        const bob = 1 + Math.sin(state.time * 7 + phase) * 0.02;
        // gentle circular sway at anchor + a slow rotation wobble
        ctx.translate(Math.sin(state.time * 4.1 + phase) * 2.2, Math.cos(state.time * 3.4 + phase * 1.7) * 2.2);
        ctx.rotate((m.x * 7.3 + m.y * 3.1) % 6.283 + Math.sin(state.time * 5.3 + phase) * 0.06);
        ctx.scale(bob, bob);

        let active = false;
        if (state.race.status !== 'finished') {
            if (player.raceState.leg % 2 === 0) { if (i===0 || i===1) active = true; }
            else { if (i===2 || i===3) active = true; }
        }

        if (markImg.complete && markImg.naturalWidth) {
            const img = active ? markImg : (getMarkImgGray() || markImg);
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

function drawBoundary(ctx) {
    const b = state.course.boundary;
    if (!b) return;
    // River: the shore IS the boundary — the club-branded circle would paint
    // across the land.
    if (state.course.riverShore) return;

    // Viewport cull: the ring is only visible when the camera is near the
    // radius band. Mid-course (most of a race) this skips EVERYTHING —
    // previously the full circle, glow, and per-character curved text were
    // painted every frame regardless.
    const camDx = state.camera.x - b.x, camDy = state.camera.y - b.y;
    const camDist = Math.sqrt(camDx * camDx + camDy * camDy);
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    if (Math.abs(camDist - b.radius) > viewR + 80) return;
    const camAng = Math.atan2(camDy, camDx);
    const halfSpan = Math.min(Math.PI, (viewR + 250) / b.radius);

    ctx.save(); ctx.translate(b.x, b.y);

    // Glow — stroke only the visible arc
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath(); ctx.arc(0, 0, b.radius, camAng - halfSpan, camAng + halfSpan);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 80; ctx.setLineDash([]); ctx.stroke();

    ctx.shadowBlur = 0; // Reset for text/images

    // Text & Burgee
    const text = "Salty Critter Yacht Club";
    ctx.font = 'bold 50px sans-serif';
    ctx.textBaseline = 'middle';

    // Static text metrics: measure once, ever (was per-char per-frame)
    if (!drawBoundary._metrics) {
        const charWidths = [];
        let textWidth = 0;
        for (const char of text) {
            const w = ctx.measureText(char).width;
            charWidths.push(w);
            textWidth += w;
        }
        drawBoundary._metrics = { charWidths, textWidth };
    }
    const charWidths = drawBoundary._metrics.charWidths;
    const textWidth = drawBoundary._metrics.textWidth;

    // Image
    const imgH = 40;
    const imgW = imgH * (649 / 462);

    const gap = 60;
    const segmentLen = imgW + gap + textWidth + gap;

    const circumference = 2 * Math.PI * b.radius;
    const count = Math.ceil(circumference / segmentLen);
    const angleStep = (Math.PI * 2) / count;
    const segHalf = (segmentLen / b.radius) / 2;

    for (let i = 0; i < count; i++) {
        const angle = i * angleStep;

        // Angular cull: draw only the 1-2 segments inside the view window
        if (Math.abs(normalizeAngle(angle - camAng)) > halfSpan + segHalf) continue;

        const contentWidth = imgW + gap + textWidth;
        const startX = -contentWidth / 2;

        // Draw Image (Curved)
        const imgCenterLinear = startX + imgW / 2;
        const imgAngleOffset = imgCenterLinear / b.radius;

        ctx.save();
        ctx.rotate(angle + imgAngleOffset);
        ctx.translate(b.radius, 0);
        ctx.rotate(Math.PI / 2);
        if (burgeeImg.complete && burgeeImg.naturalWidth > 0) {
            ctx.drawImage(burgeeImg, -imgW / 2, -imgH / 2, imgW, imgH);
        }
        ctx.restore();

        // Draw Text (Curved)
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';

        let currentLinear = startX + imgW + gap;
        for (let j = 0; j < text.length; j++) {
            const char = text[j];
            const w = charWidths[j];
            const charCenterLinear = currentLinear + w / 2;
            const charAngleOffset = charCenterLinear / b.radius;

            ctx.save();
            ctx.rotate(angle + charAngleOffset);
            ctx.translate(b.radius, 0);
            ctx.rotate(Math.PI / 2);
            ctx.fillText(char, 0, 0);
            ctx.restore();

            currentLinear += w;
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
    const pad = 200;
    minX-=pad; maxX+=pad; minY-=pad; maxY+=pad;
    const scale = (width-20)/Math.max(maxX-minX, maxY-minY);
    const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
    const t = (x, y) => ({ x: (x-cx)*scale + width/2, y: (y-cy)*scale + height/2 });

    // Boundary (hidden in the river — the shore is the boundary there)
    const b = state.course.boundary;
    if (!state.course.riverShore) {
        const bp = t(b.x, b.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(bp.x, bp.y, b.radius*scale, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    }

    // River land: minimap rect + ring hole, even-odd
    if (state.course.riverShore) {
        const ring = state.course.riverShore.ring;
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        const r0 = t(ring[0].x, ring[0].y);
        ctx.moveTo(r0.x, r0.y);
        for (let i = 1; i < ring.length; i++) {
            const p = t(ring[i].x, ring[i].y);
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(104, 118, 62, 0.9)';
        ctx.fill('evenodd');
    }

    // Islands (style-aware: ice reads as pale glacial blue, not land)
    const MINIMAP_ISLAND = {
        tropical: { body: '#fde6b1', top: '#84cc16' },
        grass:    { body: '#8a9a5b', top: '#4d7c0f' },
        ice:      { body: '#b8dcf5', top: '#f2f9ff' },
        redrock:  { body: '#c2703e', top: '#d98e57' }
    };
    if (state.course.islands) {
        // Body first
        for (const isl of state.course.islands) {
            if (isl.isBank) continue;
            ctx.fillStyle = (MINIMAP_ISLAND[isl.style] || MINIMAP_ISLAND.tropical).body;
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
            ctx.fill();
        }
        // Center cap (vegetation on land, snow on ice)
        for (const isl of state.course.islands) {
            if (isl.isBank) continue;
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

    // Gusts
    for (const g of state.gusts) {
        const pos = t(g.x, g.y);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(g.rotation);
        ctx.scale(1, g.radiusY / g.radiusX);

        ctx.beginPath();
        ctx.arc(0, 0, g.radiusX * scale, 0, Math.PI * 2);

        const strength = Math.min(1.0, Math.abs(g.speedDelta) / (state.wind.baseSpeed * 0.5));
        const alpha = 0.2 + strength * 0.3;

        if (g.type === 'gust') {
             ctx.fillStyle = `rgba(0, 0, 80, ${alpha})`;
        } else {
             ctx.fillStyle = `rgba(150, 245, 255, ${alpha})`;
        }
        ctx.fill();
        ctx.restore();
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

    // Marks
    let active = (player.raceState.leg % 2 === 0) ? [0, 1] : [2, 3];
    if (state.race.status === 'finished') active = [];

    // Gates
    const drawG = (i1, i2, a) => {
        const p1 = t(state.course.marks[i1].x, state.course.marks[i1].y);
        const p2 = t(state.course.marks[i2].x, state.course.marks[i2].y);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = a ? '#facc15' : 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = a ? 2 : 1; ctx.stroke();
    };
    drawG(0, 1, active.includes(0));
    drawG(2, 3, active.includes(2));

    // Marks Points
    for (let i=0; i<state.course.marks.length; i++) {
        const p = t(state.course.marks[i].x, state.course.marks[i].y);
        ctx.beginPath(); ctx.arc(p.x, p.y, active.includes(i) ? 4 : 3, 0, Math.PI*2);
        ctx.fillStyle = active.includes(i) ? '#f97316' : '#94a3b8'; ctx.fill();
    }

    // Boats
    // Draw AI boats first
    for (const boat of state.boats) {
        if (boat.isPlayer) continue;
        const pos = t(boat.x, boat.y);
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(boat.heading);
        ctx.fillStyle = boat.colors.hull;
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.fill();
        ctx.restore();
    }

    // Draw Player last (larger and with stroke)
    if (player) {
        const pos = t(player.x, player.y);
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(player.heading);

        // Pulse Glow
        const glow = 10 + Math.sin(state.time * 8) * 5;
        ctx.shadowBlur = glow;
        ctx.shadowColor = settings.hullColor || '#facc15';

        ctx.fillStyle = settings.hullColor || '#facc15';
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(-8, 9); ctx.fill();
        ctx.restore();
    }
}

let frameCount = 0;

function getBoatProgress(boat) {
    const m0 = state.course.marks[0], m1 = state.course.marks[1], m2 = state.course.marks[2], m3 = state.course.marks[3];
    const c1x = (m0.x+m1.x)/2, c1y = (m0.y+m1.y)/2;
    const c2x = (m2.x+m3.x)/2, c2y = (m2.y+m3.y)/2;
    const dx = c2x-c1x, dy = c2y-c1y;
    const len = Math.sqrt(dx*dx+dy*dy);
    const wx = dx/len, wy = dy/len;

    const totalLegs = state.race.totalLegs;
    if (boat.raceState.finished) {
        // Finished boats are ranked by finish time, but for progress calculation we can assume they are at the end.
        // Or better, handle them separately in sorting.
        return totalLegs*len + (1000000 - boat.raceState.finishTime); // Higher is better (lower time = higher score)
    }

    // Project onto course axis (Start -> Upwind)
    const p = boat.x*wx + boat.y*wy;
    const startP = c1x*wx + c1y*wy;
    const relP = p - startP;

    // Leg Progress
    // Leg 0: relP (Starts neg, target 0).
    // Leg 1 (Up): relP (0 to L). Base: 0
    // Leg 2 (Down): 2L - relP (L to 0). Base: L + (L - relP) = 2L - relP
    // Leg 3 (Up): 2L + relP (0 to L). Base: 2L + relP
    // Leg 4 (Down): 4L - relP (L to 0). Base: 3L + (L - relP) = 4L - relP

    // Formula:
    // If Leg is Odd (Upwind): (Leg-1)*L + relP
    // If Leg is Even (Downwind): Leg*L - relP

    const L = len;

    let progress = 0;
    const leg = boat.raceState.leg;

    if (leg === 0) {
        progress = relP;
    } else {
        if (leg % 2 !== 0) { // Odd (Upwind)
            progress = (leg - 1) * L + relP;
        } else { // Even (Downwind)
            progress = leg * L - relP;
        }
    }

    return progress;
}

function showResults() {
    if (!UI.resultsOverlay || !UI.resultsList) return;

    const wasHidden = UI.resultsOverlay.classList.contains('hidden');
    UI.resultsOverlay.classList.remove('hidden');
    if (wasHidden) UI.resultsOverlay.scrollTop = 0;
    UI.leaderboard.classList.add('hidden');
    Sound.updateMusic();

    // Sort by finish order (or progress)
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

        // Tie-breaking within same category
        if (scoreA === 0) return a.raceState.finishTime - b.raceState.finishTime; // Time asc
        // For DNF/DNS, sort by progress (descending)
        return getBoatProgress(b) - getBoatProgress(a);
    });

    const leader = sorted[0];

    // CSS Grid Layout Class
    const gridClass = "grid grid-cols-[4rem_4rem_1fr_4.5rem_4.5rem_5rem_5rem_5rem_5rem_5rem] gap-4 items-center px-4";

    // Header
    let header = UI.resultsList.querySelector('.res-header');
    if (!header) {
        // Only clear if we are initializing clean
        if (UI.resultsList.children.length === 0 || !UI.resultsList.querySelector('.res-header')) {
             UI.resultsList.innerHTML = '';
        }
        header = document.createElement('div');
        header.className = `${gridClass} py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 res-header`;
        header.innerHTML = `
            <div class="text-center">Position</div>
            <div></div>
            <div>Sailor</div>
            <div class="text-right">Time</div>
            <div class="text-right">Delta</div>
            <div class="text-right">Top Spd</div>
            <div class="text-right">Average</div>
            <div class="text-right">Distance</div>
            <div class="text-center">Penalties</div>
            <div class="text-center text-white">Points</div>
        `;
        UI.resultsList.appendChild(header);
    }

    const getLuma = (c) => {
        let r=0, g=0, b=0;
        if(c.startsWith('#')) {
            const hex = c.substring(1);
            if(hex.length===3) { r=parseInt(hex[0]+hex[0],16); g=parseInt(hex[1]+hex[1],16); b=parseInt(hex[2]+hex[2],16); }
            else { r=parseInt(hex.substring(0,2),16); g=parseInt(hex.substring(2,4),16); b=parseInt(hex.substring(4,6),16); }
        }
        return 0.299*r + 0.587*g + 0.114*b;
    };

    if (!UI.resultRows) UI.resultRows = {};
    const totalBoats = state.boats.length;

    sorted.forEach((boat, index) => {
        let points = totalBoats - index;
        if (boat.raceState.resultStatus === 'DNS' || boat.raceState.resultStatus === 'DNF') {
            points = 0;
        }

        let row = UI.resultRows[boat.id];
        let isNew = false;

        const hullColor = boat.isPlayer ? settings.hullColor : boat.colors.hull;
        const spinColor = boat.isPlayer ? settings.spinnakerColor : boat.colors.spinnaker;
        const hullLuma = getLuma(hullColor);
        const useSpin = hullLuma < 50 || hullLuma > 200;
        const bgColor = useSpin ? spinColor : hullColor;

        if (!row) {
            isNew = true;
            row = document.createElement('div');
            row.className = "relative mb-3 h-16 w-full res-row"; // Added res-row class

            // Background Bar
            const bar = document.createElement('div');
            bar.className = "res-bar absolute inset-0 right-12 overflow-hidden drop-shadow-lg transition-transform hover:scale-[1.01] origin-left";
            // Set initial background
            bar.style.background = `linear-gradient(to right, transparent 0%, ${bgColor} 50%)`;

            // Gloss & Fade
            const gloss = document.createElement('div');
            gloss.className = "absolute inset-0 bg-gradient-to-b from-white/20 to-black/10 pointer-events-none";
            bar.appendChild(gloss);
            const fade = document.createElement('div');
            fade.className = "absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-r from-transparent to-white/10 mix-blend-overlay";
            bar.appendChild(fade);

            row.appendChild(bar);

            // Line
            const line = document.createElement('div');
            line.className = "absolute bottom-0 left-0 right-[25px] h-[1px] bg-white";
            row.appendChild(line);

            // Content
            const content = document.createElement('div');
            content.className = `relative z-10 ${gridClass} w-full h-full`;

            // Rank Container
            const rankDiv = document.createElement('div');
            rankDiv.className = `res-rank flex justify-center items-center`;
            content.appendChild(rankDiv);

            // Image Container
            const imgDiv = document.createElement('div');
            imgDiv.className = `flex items-center justify-center`;
            const imgBox = document.createElement('div');
            imgBox.className = "w-12 h-12";
            if (boat.isPlayer) {
                const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                star.setAttribute("viewBox", "0 0 24 24");
                star.setAttribute("class", "w-full h-full drop-shadow-md");
                star.setAttribute("fill", "#ffffff");
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z");
                star.appendChild(path);
                imgBox.appendChild(star);
            } else {
                const img = document.createElement('img');
                img.src = "assets/images/competitors/" + boat.name.toLowerCase() + ".png";
                img.className = "w-full h-full rounded-md object-cover";
                imgDiv.appendChild(img);
            }
            imgDiv.appendChild(imgBox);
            content.appendChild(imgDiv);

            // Name
            const nameDiv = document.createElement('div');
            nameDiv.className = `res-name font-black text-2xl italic uppercase tracking-tighter truncate text-white drop-shadow-md`;
            nameDiv.textContent = boat.name;
            content.appendChild(nameDiv);

            // Helper for stats
            const createStat = (cls) => {
                const d = document.createElement('div');
                d.className = `${cls} font-sans font-bold text-sm text-white drop-shadow-sm text-right`;
                return d;
            };

            content.appendChild(createStat('res-time'));
            content.appendChild(createStat('res-delta')); // Has text-white/70 logic
            content.appendChild(createStat('res-top'));
            content.appendChild(createStat('res-avg'));
            content.appendChild(createStat('res-dist'));

            const penDiv = document.createElement('div');
            penDiv.className = `res-pen text-center font-sans font-bold text-sm text-white/30`;
            content.appendChild(penDiv);

            row.appendChild(content);

            // Points Box
            const ptsBox = document.createElement('div');
            ptsBox.className = "absolute right-0 top-0 bottom-0 w-24 bg-white transform -skew-x-12 origin-bottom-right flex items-center justify-center shadow-md z-20 border-l-4 border-white/50 rounded-br-2xl";
            const ptsText = document.createElement('div');
            ptsText.className = "res-points transform skew-x-12 text-slate-900 font-black text-3xl";
            ptsBox.appendChild(ptsText);
            row.appendChild(ptsBox);

            UI.resultRows[boat.id] = row;
        }

        // Update Content
        const bar = row.querySelector('.res-bar');
        if (bar) bar.style.background = `linear-gradient(to right, transparent 0%, ${bgColor} 50%)`;

        // Update Rank
        const rankDiv = row.querySelector('.res-rank');
        if (rankDiv) {
            // Check if we need to update rank style
            // Simple check: clear and rebuild if type changes (medal vs text)
            // Or just clear and rebuild always (lightweight)
            rankDiv.innerHTML = '';
            if (index <= 2) {
                 const colors = [
                     "text-yellow-900 bg-yellow-400 border-yellow-200", // Gold
                     "text-slate-900 bg-slate-300 border-slate-200",   // Silver
                     "text-amber-900 bg-amber-600 border-amber-400"    // Bronze
                 ];
                 const medal = document.createElement('div');
                 medal.className = `w-10 h-10 rounded-full flex items-center justify-center text-lg font-black border-2 shadow-md ${colors[index]}`;
                 medal.textContent = index + 1;
                 rankDiv.appendChild(medal);
            } else {
                 const txt = document.createElement('div');
                 txt.className = `text-2xl font-black italic text-white/80`;
                 txt.textContent = index + 1;
                 rankDiv.appendChild(txt);
            }
        }

        // Stats
        let finishTime = formatTime(boat.raceState.finishTime);
        if (boat.raceState.resultStatus) {
            finishTime = boat.raceState.resultStatus;
        }

        const delta = (index > 0 && leader.raceState.finished && boat.raceState.finished)
            ? "+" + (boat.raceState.finishTime - leader.raceState.finishTime).toFixed(2)
            : "-";
        const topSpeed = Math.max(...boat.raceState.legTopSpeeds).toFixed(1);

        const duration = boat.raceState.finished ? boat.raceState.finishTime : state.race.timer;
        const totalSpeedSum = boat.raceState.legSpeedSums ? boat.raceState.legSpeedSums.reduce((a, b) => a + b, 0) : 0;
        const avgSpeed = (duration > 0.1 ? (totalSpeedSum / duration) : 0).toFixed(1);

        const totalDist = Math.round(boat.raceState.legDistances.reduce((a, b) => a + b, 0));
        const penalties = boat.raceState.totalPenalties;

        const updateText = (cls, val) => { const el = row.querySelector('.'+cls); if(el) el.textContent = val; return el; };

        const tEl = updateText('res-time', finishTime);
        if (tEl) {
             // Ensure it is always white (resetting any potential previous red state)
             tEl.classList.remove('text-red-400');
             tEl.classList.add('text-white');
        }

        const dEl = updateText('res-delta', delta);
        if (dEl) dEl.className = `res-delta font-sans font-bold text-sm text-right ${delta==='-' ? 'text-white/30' : 'text-white/70'}`;

        updateText('res-top', topSpeed);
        updateText('res-avg', avgSpeed);
        updateText('res-dist', totalDist);

        const pEl = updateText('res-pen', penalties > 0 ? penalties : "-");
        if (pEl) pEl.className = `res-pen text-center font-sans font-bold text-sm ${penalties > 0 ? 'text-white' : 'text-white/30'}`;

        updateText('res-points', points);

        // Ensure order by appending (moves element to end)
        UI.resultsList.appendChild(row);
    });
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
    const m0 = state.course.marks[0], m1 = state.course.marks[1], m2 = state.course.marks[2], m3 = state.course.marks[3];
    const c1x = (m0.x+m1.x)/2, c1y = (m0.y+m1.y)/2;
    const c2x = (m2.x+m3.x)/2, c2y = (m2.y+m3.y)/2;
    const dx = c2x-c1x, dy = c2y-c1y;
    const len = Math.sqrt(dx*dx+dy*dy);
    const totalRaceDist = state.race.totalLegs * len;


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
    if (UI.lbLeg) {
        if (leader.raceState.finished) UI.lbLeg.textContent = "FINISH";
        else UI.lbLeg.textContent = `${Math.max(1, leader.raceState.leg)}/${state.race.totalLegs}`;
    }

    // Render Rows
    if (UI.lbRows) {
        const ROW_HEIGHT = 36;
        UI.lbRows.style.height = (sorted.length * ROW_HEIGHT) + 'px';

        sorted.forEach((boat, index) => {
            let row = UI.boatRows[boat.id];

            // Create if missing
            if (!row) {
                row = document.createElement('div');
                row.className = "lb-row flex items-center px-3 border-b border-slate-700/50 bg-slate-800/40";

                // Construct inner HTML once
                // Rank
                const rank = document.createElement('div');
                rank.className = "lb-rank w-4 text-xs font-black italic text-slate-400 mr-2";

                // Portrait / Icon
                const iconContainer = document.createElement('div');
                iconContainer.className = "w-9 h-9 mr-2 flex items-center justify-center shrink-0";

                if (boat.isPlayer) {
                    // Star Icon
                    const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    star.setAttribute("viewBox", "0 0 24 24");
                    star.setAttribute("class", "w-7 h-7 drop-shadow-md");
                    const color = isVeryDark(settings.hullColor) ? settings.spinnakerColor : settings.hullColor;
                    star.setAttribute("fill", color);
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z");
                    star.appendChild(path);
                    iconContainer.appendChild(star);
                } else {
                    // Portrait
                    const img = document.createElement('img');
                    img.src = "assets/images/competitors/" + boat.name.toLowerCase() + ".png";
                    img.className = "w-8 h-8 rounded-full border-2 object-cover bg-slate-900";
                    const color = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;
                    img.style.borderColor = color;
                    iconContainer.appendChild(img);
                }

                // Name
                const nameDiv = document.createElement('div');
                nameDiv.className = "lb-name text-xs font-bold text-white tracking-wide flex-1 truncate";
                nameDiv.textContent = boat.name;
                if (boat.isPlayer) nameDiv.className += " text-yellow-300";

                // Meters Back
                const distDiv = document.createElement('div');
                distDiv.className = "lb-dist text-[10px] font-mono text-slate-400 text-right min-w-[32px]";

                row.appendChild(rank);
                row.appendChild(iconContainer);
                row.appendChild(nameDiv);
                row.appendChild(distDiv);

                UI.lbRows.appendChild(row);
                UI.boatRows[boat.id] = row;

                // Init rank
                boat.lbRank = index;
            }

            // Update Content
            const rankDiv = row.querySelector('.lb-rank');
            const distDiv = row.querySelector('.lb-dist');
            const nameDiv = row.querySelector('.lb-name');

            // Apply finished/penalty styling
            let rowClass = "lb-row flex items-center px-3 border-b border-slate-700/50 transition-colors duration-500 ";
            if (boat.raceState.finished) {
                rowClass += "bg-emerald-900/60";
                rankDiv.className = "lb-rank w-4 text-xs font-black italic text-white mr-2";
                distDiv.className = "lb-dist text-[10px] font-mono text-white text-right min-w-[32px]";
            } else if (boat.raceState.leg === 0) {
                rowClass += "bg-gray-900/40 grayscale";
                rankDiv.className = "lb-rank w-4 text-xs font-black italic text-gray-500 mr-2";
                distDiv.className = "lb-dist text-[10px] font-mono text-gray-500 text-right min-w-[32px]";
            } else {
                rowClass += "bg-slate-800/40";
                rankDiv.className = "lb-rank w-4 text-xs font-black italic text-slate-400 mr-2";
                distDiv.className = "lb-dist text-[10px] font-mono text-slate-400 text-right min-w-[32px]";
            }
            row.className = rowClass;

            // Name update for penalty
            let nameText = boat.name;
            if (boat.raceState.penalty) {
                 nameDiv.classList.add("text-red-400");
                 if (boat.isPlayer) nameDiv.classList.remove("text-yellow-300");
            } else {
                 nameDiv.classList.remove("text-red-400");
                 if (boat.isPlayer) nameDiv.classList.add("text-yellow-300");
            }
            nameDiv.textContent = nameText;

            rankDiv.textContent = index + 1;
            if (index === 0) {
                 if (boat.raceState.finished) {
                     if (boat.raceState.resultStatus) distDiv.textContent = boat.raceState.resultStatus;
                     else distDiv.textContent = formatTime(boat.raceState.finishTime);
                 } else {
                     distDiv.textContent = "";
                 }
            } else {
                 if (boat.raceState.resultStatus) {
                     distDiv.textContent = boat.raceState.resultStatus;
                 } else if (leader.raceState.finished) {
                     if (boat.raceState.finished) {
                         const tDiff = boat.raceState.finishTime - leader.raceState.finishTime;
                         distDiv.textContent = "+" + tDiff.toFixed(1) + "s";
                     } else {
                         // Distance to finish?
                         // Leader is at 16000.
                         const myP = getBoatProgress(boat);
                         const diff = Math.max(0, totalRaceDist - myP);
                         distDiv.textContent = "+" + Math.round(diff * 0.2) + "m";
                     }
                 } else {
                     const myP = getBoatProgress(boat);
                     const diff = Math.max(0, leaderProgress - myP);
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

    const rank = (boat.lbRank !== undefined) ? (boat.lbRank + 1) : "-";
    const speed = (boat.speed * 4).toFixed(1);
    const name = boat.name.toUpperCase();

    let line1 = `${rank} ${name}`;
    if (boat.raceState.leg === 0) {
        line1 = name;
    }
    let line2 = `${speed}kn`;

    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(state.camera.rotation);
    ctx.translate(0, 50); // Below boat

    ctx.font = "bold 11px monospace";
    const paddingX = 8;
    const m1 = ctx.measureText(line1);
    const m2 = ctx.measureText(line2);
    const boxWidth = Math.max(m1.width, m2.width) + paddingX * 2 + 6;
    const boxHeight = 32;

    const x = -boxWidth / 2;
    const y = 0;

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    // Main Box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, 4);
    ctx.fill();

    // Colored Bar
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, 4, boxHeight - 4, 2);
    ctx.fill();

    // Text
    ctx.fillStyle = boat.raceState.penalty ? '#ef4444' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(line1, x + 10, y + 5);

    // Speed Color Logic
    // Red: Penalty OR Bad Air
    // Green: Net Boost (Local Wind > Base Wind)
    // Orange: Net Loss (Local Wind < Base Wind)
    let speedColor = '#ffffff';
    const localWind = getWindAt(boat.x, boat.y);
    const isBoost = localWind.speed > state.wind.speed + 0.1;
    const isLoss = localWind.speed < state.wind.speed - 0.1;

    if (boat.raceState.penalty || boat.badAirIntensity > 0.05) {
        speedColor = '#ef4444';
    }

    ctx.fillStyle = speedColor;
    ctx.fillText(line2, x + 10, y + 17);

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
        if (markIndex === 0)      { start = 0;       end = Math.PI; ccw = false; }
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

    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
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
        ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(boat.lbRank + 1), 0, 0.5);
    }

    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
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

    drawWakes(ctx);
    drawParticles(ctx, 'surface');
    drawGusts(ctx);
    drawWindWaves(ctx);
    drawSwell(ctx);
    // drawIslandShadows(ctx);
    drawParticles(ctx, 'current');
    drawRiverShore(ctx);
    drawWeeds(ctx);
    drawIslands(ctx, 'land');
    drawDisturbedAir(ctx);
    drawActiveGateLine(ctx);
    drawLadderLines(ctx);
    drawLayLines(ctx);
    drawMarkZones(ctx);
    drawRoundingArrows(ctx);
    drawBoundary(ctx);
    // Ice last of the water layer: the nav aids are paint on the surface, and
    // floes drift OVER paint. Marks and boats still draw on top of the ice.
    drawBrashIce(ctx);
    drawIslands(ctx, 'floe');
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
    drawSnowOverlay(ctx);

    // Camera Message
    if (state.camera.messageTimer > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1.0, state.camera.messageTimer*2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
            if (leg > 0 && leg < state.race.totalLegs && marks && marks.length >= 4) {
                // Gate leg: one indicator per gate mark, each showing its rounding direction.
                const indices = (leg % 2 !== 0) ? [2, 3] : [0, 1];
                for (const idx of indices) {
                    const mk = marks[idx];
                    const d = Math.sqrt((mk.x-player.x)**2 + (mk.y-player.y)**2) * 0.2;
                    const p = toScreen(mk.x, mk.y);
                    drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(d) + 'm', idx, rot);
                }
            } else {
                // Start/finish: a line you cross, not a mark you round — single indicator.
                const wp = player.raceState.nextWaypoint;
                const p = toScreen(wp.x, wp.y);
                drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(wp.dist) + 'm', null, rot);
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

    if (frameCount % 10 === 0) {
        updateLeaderboard();

        // Arctic: show when the player's boat is overpowered (>18kn effective
        // wind costs speed, scaled by handling) — turns an invisible tax into
        // a readable condition to sail around.
        if (UI.overpoweredBadge) {
            const op = state.race.venueFx && state.race.venueFx.overpowered
                && player.effectiveWindNow !== undefined
                && player.effectiveWindNow > OVERPOWERED.threshold
                && state.race.status === 'racing' && !player.raceState.finished;
            UI.overpoweredBadge.classList.toggle('hidden', !op);
        }

        const isBoost = localWind.speed > state.wind.speed + 0.1;
        const isLoss = localWind.speed < state.wind.speed - 0.1;

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
             UI.windSpeed.classList.remove('text-red-400', 'text-green-400', 'text-orange-400', 'text-white');

             const effectiveSpeed = localWind.speed * (1.0 - player.badAirIntensity);
             const isEffectiveBoost = effectiveSpeed > state.wind.speed + 0.1;
             const isEffectiveLoss = effectiveSpeed < state.wind.speed - 0.1;

             if (isEffectiveBoost) {
                 UI.windSpeed.classList.add('text-green-400');
             } else if (isEffectiveLoss) {
                 UI.windSpeed.classList.add('text-red-400');
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

        if (UI.trimMode) {
             UI.trimMode.textContent = player.manualTrim ? "MANUAL TRIM" : "AUTO TRIM";
             UI.trimMode.className = `mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider bg-slate-900/80 ${player.manualTrim ? "text-yellow-300 border-yellow-500/50" : "text-emerald-300 border-emerald-500/50"}`;
        }

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
            UI.timer.className = `font-mono text-4xl font-black tabular-nums tracking-widest drop-shadow-md ${timerClass}`;
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
             const v = VENUES[settings.venue];
             UI.legInfo.textContent = (v && v.name) ? v.name.toUpperCase() : "";
        }

        if (UI.legTimes) {
            UI.legTimes.classList.toggle('hidden', state.race.status === 'prestart');
            if (state.race.status !== 'prestart') {
                 let html = "";
                 const getMoves = (i) => player.raceState.legManeuvers[i] || 0;
                 const getDist = (i) => Math.round(player.raceState.legDistances[i] || 0);
                 const getTop = (i) => (player.raceState.legTopSpeeds[i] || 0).toFixed(1);

                 if (player.raceState.startLegDuration !== null) {
                     html += `<div class="bg-slate-900/60 text-slate-300 font-mono text-xs font-bold px-2 py-0.5 rounded border-l-2 border-slate-500 shadow-md flex justify-between gap-4"><span>Start: ${formatSplitTime(player.raceState.startLegDuration)}</span> <span class="text-slate-500">Top:${getTop(0)}kn Dist:${getDist(0)}m Moves:${getMoves(0)}</span></div>`;
                 }
                 player.raceState.legTimes.forEach((t, i) => {
                     html += `<div class="bg-slate-900/60 text-slate-300 font-mono text-xs font-bold px-2 py-0.5 rounded border-l-2 border-slate-500 shadow-md flex justify-between gap-4"><span>Leg ${i+1}: ${formatSplitTime(t)}</span> <span class="text-slate-500">Top:${getTop(i+1)}kn Dist:${getDist(i+1)}m Moves:${getMoves(i+1)}</span></div>`;
                 });
                 if ((state.race.status==='racing' || state.race.status==='prestart') && player.raceState.leg <= state.race.totalLegs) {
                     const cur = player.raceState.leg;
                     const t = (cur===0) ? state.race.timer : (state.race.timer - player.raceState.legStartTime);
                     const lbl = (cur===0) ? "Start" : `Leg ${cur}`;
                     html += `<div class="bg-slate-900/80 text-white font-mono text-xs font-bold px-2 py-0.5 rounded border-l-2 border-green-500 shadow-md flex justify-between gap-4"><span>${lbl}: ${formatSplitTime(t)}</span> <span class="text-white/50">Top:${getTop(cur)}kn Dist:${getDist(cur)}m Moves:${getMoves(cur)}</span></div>`;
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

    // Wind Vectors
    const wd = state.wind.direction;
    const ux = Math.sin(wd);
    const uy = -Math.cos(wd);

    // Downwind Vector (Back from line)
    const backX = -ux;
    const backY = -uy;

    // Start Line Center and Geometry
    if (!state.course.marks || state.course.marks.length < 2) return;
    const m0 = state.course.marks[0];
    const m1 = state.course.marks[1];
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

        if (boat.isPlayer) {
            boat.heading = wd; // Head to wind
            boat.velocity = { x: 0, y: 0 };
            boat.speed = 0;
        } else {
            if (boat.ai) boat.ai.startLinePct = pct;
            if (boat.controller) {
                boat.controller.startLinePct = pct;
                boat.controller.startStageDepth = 60;
            }
            // Start on Starboard Tack (Close Hauled)
            boat.heading = normalizeAngle(wd + Math.PI / 4);
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

    const mStart = { x: (marks[0].x+marks[1].x)/2, y: (marks[0].y+marks[1].y)/2 };
    const mUpwind = { x: (marks[2].x+marks[3].x)/2, y: (marks[2].y+marks[3].y)/2 };
    
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
    const sx = (marks[0].x+marks[1].x)/2;
    const sy = (marks[0].y+marks[1].y)/2;
    const startC = Math.floor((sx - minX) / resolution);
    const startR = Math.floor((sy - minY) / resolution);
    
    // Target Point (Upwind Gate Center)
    const tx = (marks[2].x+marks[3].x)/2;
    const ty = (marks[2].y+marks[3].y)/2;
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

            const res = satPolygonPolygon(boatPoly, isl.vertices);
            if (res) {
                 // Push boat OUT
                 boat.x -= res.axis.x * res.overlap;
                 boat.y -= res.axis.y * res.overlap;

                 // Grounding Penalty: Lose 60% speed instantly + massive drag
                 boat.speed *= 0.4;

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

                 // Soft shores (river banks, swamp marsh) cost speed but not a
                 // rules penalty — otherwise every graze becomes a 360°-spiral.
                 // A squeezed boat is excused entirely: she was denied room.
                 if (state.race.status === 'racing' && !isl.soft && !squeezer) triggerPenalty(boat, { reason: 'Ran Aground', kind: 'contact' });
                 if (window.onRaceEvent && state.race.status === 'racing') window.onRaceEvent('collision_island', { boat });
            }
        }
    }
}

// Per-style palettes: tropical (default), grass (swamp/river banks), ice (polar floes)
const ISLAND_STYLES = {
    tropical: { body: '#fde6b1', stroke: '#d4b483', veg: '#84cc16', rock: '#9ca3af', trees: true },
    grass:    { body: '#a89b6a', stroke: '#7d7048', veg: '#4d7c0f', rock: '#8a8a7a', trees: true },
    ice:      { body: '#e6f2fb', stroke: '#7fb2d9', veg: '#ffffff', rock: '#8fc2e8', trees: false },
    redrock:  { body: '#c2703e', stroke: '#8a4a26', veg: '#d98e57', rock: '#7c4a2d', trees: false }
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
    const trace = isl.style === 'ice' ? traceAngularPoly : traceRoundedPoly;

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
function drawIslands(ctx, which) {
    if (!state.course || !state.course.islands) return;

    // Viewport Culling
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    const camX = state.camera.x;
    const camY = state.camera.y;

    for (const isl of state.course.islands) {
        if (isl.isBank) continue; // river banks: invisible colliders, see drawRiverShore
        if (which === 'land' && isl.isFloe) continue;
        if (which === 'floe' && !isl.isFloe) continue;
        const distSq = (isl.x - camX) ** 2 + (isl.y - camY) ** 2;
        const limit = viewRadius + isl.radius;
        if (distSq > limit ** 2) continue;

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


// River shore: one continuous land mass around the water. Rendered as a
// SINGLE even-odd path (big rect + river ring hole) with no shadows — cost is
// independent of shoreline length and far cheaper than the ~120 bank-island
// blobs it replaces (each of which paid for shadowBlur glow, three curve
// fills and tree sprites). Decorations are culled to the viewport.
function drawRiverShore(ctx) {
    const shore = state.course.riverShore;
    if (!shore) return;

    const b = state.course.boundary;
    const R = (b ? b.radius : 5000) + 2000;
    const cx0 = b ? b.x : 0, cy0 = b ? b.y : 0;
    const ring = shore.ring;

    const tracePath = () => {
        ctx.beginPath();
        ctx.rect(cx0 - R, cy0 - R, R * 2, R * 2);
        ctx.moveTo(ring[0].x, ring[0].y);
        for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i].x, ring[i].y);
        ctx.closePath();
    };

    ctx.save();

    // Land fill (rect + ring hole, even-odd)
    tracePath();
    ctx.fillStyle = '#68763e';
    ctx.fill('evenodd');

    // Water's edge: a mud band straddling the ring (reads as shallows), then
    // a soft waterline highlight.
    ctx.beginPath();
    ctx.moveTo(ring[0].x, ring[0].y);
    for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i].x, ring[i].y);
    ctx.closePath();
    ctx.strokeStyle = '#9d8b5e';
    ctx.lineWidth = 26;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220, 235, 210, 0.35)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Decorations: viewport-culled, cheap shadows (no ctx.filter)
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    const cullSq = (viewR + 80) ** 2;
    for (const dcor of shore.decorations) {
        if ((dcor.x - camX) ** 2 + (dcor.y - camY) ** 2 > cullSq) continue;
        if (dcor.type === 'tree' && palmImg.complete && palmImg.naturalWidth > 0) {
            const size = dcor.size * 4.0;
            ctx.save();
            ctx.translate(dcor.x + 5, dcor.y + 5);
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = '#000000';
            ctx.beginPath(); ctx.ellipse(0, 0, size * 0.32, size * 0.24, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.translate(dcor.x, dcor.y);
            ctx.rotate(dcor.rotation);
            ctx.drawImage(palmImg, -size / 2, -size / 2, size, size);
            ctx.restore();
        } else if (dcor.type === 'rock') {
            ctx.fillStyle = '#8a8a7a';
            ctx.beginPath(); ctx.arc(dcor.x, dcor.y, dcor.size * 0.8, 0, Math.PI * 2); ctx.fill();
        }
    }

    ctx.restore();
}

// Swamp weed patches: translucent mottled mats with baked speckle clumps.
function drawWeeds(ctx) {
    if (!state.course.weeds) return;
    const camX = state.camera.x, camY = state.camera.y;
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;

    for (const w of state.course.weeds) {
        const distSq = (w.x - camX) ** 2 + (w.y - camY) ** 2;
        if (distSq > (viewRadius + w.radius) ** 2) continue;

        ctx.save();
        ctx.fillStyle = 'rgba(45, 66, 23, 0.35)';
        ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(77, 106, 35, 0.55)';
        for (const c of w.clumps) {
            ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

// Ocean swell: slow crest bands sweeping downwind across the course.
function drawSwell(ctx) {
    if (!state.race.venueFx || !state.race.venueFx.swell) return;
    const sd = state.wind.baseDirection;
    const ux = -Math.sin(sd), uy = Math.cos(sd);   // travel direction (downwind)
    const cx2 = -uy, cy2 = ux;                      // crest axis

    const camX = state.camera.x, camY = state.camera.y;
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.75;

    const camAlong = camX * ux + camY * uy;
    const travel = state.time * SWELL.celerity;
    const first = Math.floor((camAlong - viewRadius - travel) / SWELL.wavelength);
    const last = Math.ceil((camAlong + viewRadius - travel) / SWELL.wavelength);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    for (let k = first; k <= last; k++) {
        const along = k * SWELL.wavelength + travel;
        // Point on this crest nearest the camera
        const px = camX + (along - camAlong) * ux;
        const py = camY + (along - camAlong) * uy;
        ctx.beginPath();
        // Gently bowed crest line: three segments with sinusoidal offset
        const seg = 14, span = viewRadius;
        for (let s = -seg; s <= seg; s++) {
            const t = (s / seg) * span;
            const bow = Math.sin(t / 700 + k * 1.7) * 40;
            const x = px + cx2 * t + ux * bow;
            const y = py + cy2 * t + uy * bow;
            if (s === -seg) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}

// Init
function initCourse() {
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

    // Venue world features (banks/floes are islands: they inherit collision,
    // avoidance, pathfinding and wind shadow for free)
    state.course.weeds = null;
    state.course.riverShore = null;
    state.course.brash = null;
    state.race.riverCurrent = null;
    const fx = state.race.venueFx;
    if (fx && (fx.river || fx.ice || fx.weeds)) {
        const rng = state.race.seed ? mulberry32(state.race.seed + 7) : Math.random;
        if (fx.river) state.course.islands = islands.concat(generateRiverBanks(rng));
        if (fx.ice) {
            state.course.islands = islands.concat(generateIceFloes(rng));
            state.course.brash = generateBrash(rng);
        }
        if (fx.weeds) state.course.weeds = generateWeeds(rng);
    }

    // Perf: river banks are unreachable behind the physics clamp, so they are
    // excluded from pathfinding and wind shadows entirely (they stay in
    // course.islands for reactive avoidance, Rule 19 and collision). With ~86
    // bank islands, feeding them to the A* visibility graph caused
    // multi-hundred-ms replan spikes.
    state.course.navIslands = state.course.islands.filter(i => !i.isBank);
    state.course.navVersion = 0; // bumped when floes drift, so the planner's inflated cache refreshes
}

function resetGame() {
    loadSettings();
    if (UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
    state.camera.target = 'boat';
    state.wind.baseSpeed = 8 + Math.random()*10;
    state.wind.speed = state.wind.baseSpeed;
    state.wind.baseDirection = Math.random() * Math.PI * 2;
    state.wind.direction = state.wind.baseDirection;
    state.wind.currentShift = 0;
    state.wind.oscillator = Math.random() * Math.PI * 2; // Random phase
    state.wind.history = [];
    state.wind.debugTimer = 0;
    state.gusts = [];

    // Persistent shift for this race: a slow, one-way veer (+) or back (-) of
    // ~18-28° total over the race, at ~2-4°/min. Creates the "pick the right side"
    // gamble. Sign/rate are randomized per race so neither player nor AI can
    // foresee it; the AI infers it from the wind's low-frequency trend.
    state.wind.persistentShift = 0;
    state.wind.persistentMax = 18 + Math.random() * 10;            // 18-28 deg
    state.wind.persistentRate = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2) / 60; // deg/sec

    // Randomized Biases for New Wind Model

    // Shiftiness (Directional Oscillation)
    // 0-1. 0=Steady, 1=Very Shifty.
    const shiftiness = Math.random();

    // Variability (Speed Oscillation)
    // 0-1. 0=Stable, 1=Variable.
    const variability = Math.random();

    // Puffiness (Density of Gusts)
    // 0-1. 0=Low, 1=High.
    const puffiness = Math.random();

    // Gust Strength Bias (Soft vs Punchy)
    // 0-1. 0=Soft, 1=Punchy.
    const gustStrengthBias = Math.random();

    // Puff Shiftiness (Directional Deviation inside Gusts)
    // 0-1. 0=Low, 1=High.
    const puffShiftiness = Math.random();

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
        shiftiness,
        variability,
        puffiness,
        gustStrengthBias,
        puffShiftiness,
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
    state.race.totalLegs = state.race.totalLegs || 4;
    state.race.startTimerDuration = state.race.startTimerDuration || 30.0;

    state.race.timer = state.race.startTimerDuration;

    initCourse();

    // Init Water Renderer
    if (window.WaterRenderer) window.WaterRenderer.init();

    // Pre-populate gusts (conditions.puffiness may have been venue-overridden)
    const density = 5 + Math.floor(state.race.conditions.puffiness * 20);
    for (let i = 0; i < density; i++) {
        spawnGlobalGust(true);
    }

    state.boats = [];
    if (UI.lbRows) UI.lbRows.innerHTML = '';
    UI.boatRows = {};
    if (UI.resultsList) UI.resultsList.innerHTML = '';
    UI.resultRows = {};

    // Create Boats (Initialized at 0,0, positioned by repositionBoats)
    const player = new Boat(0, true, 0, 0, settings.playerName || "Player");
    player.heading = state.wind.direction; // Head to wind
    player.prevHeading = player.heading;
    player.lastWindSide = 0;
    state.boats.push(player);

    // Create AI Boats
    const opponents = [];
    const available = [...AI_CONFIG];
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

function restartRace() { resetGame(); togglePause(false); }

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
        valDisp.className = "text-cyan-400 font-mono";
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
