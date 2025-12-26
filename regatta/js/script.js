// Game Configuration
const CONFIG = {
    turnSpeed: 0.01, // Radians per frame (approx) -> adjusted for dt in update
    turnPenalty: 0.9995,
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
        if (!quotes) return;

        const typeQuotes = quotes[type];
        if (!typeQuotes) return;

        const options = ['short', 'medium', 'long'];
        const length = options[Math.floor(Math.random() * options.length)];
        const text = typeQuotes[length];

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
            this.img.src = "assets/images/" + item.boat.name.toLowerCase() + ".png";
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

// Helper for Risk Prediction (CPA)
function getRiskMetrics(boat, other) {
    const dx = other.x - boat.x;
    const dy = other.y - boat.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Relative Velocity (units/sec)
    // boat.velocity is updated in updateBoat, but if it's not ready, estimate from heading/speed
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
        this.startSide = Math.random() < 0.5 ? 'left' : 'right';
        this.startLinePct = 0.1 + Math.random() * 0.8; // Target spot on line
        this.startDistance = 100 + Math.random() * 200; // Hover distance (increased from 40-80)
        this.startTimer = 0;

        this.livenessState = 'normal'; // 'normal', 'recovery', 'force'
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

        // Mark Recovery Latch
        this.markContactTimer = 0;
        this.markEscapeHeading = 0;

        // Staggered updates
        this.updateTimer = Math.random() * 0.2; 
    }

    update(dt) {
        this.updateTimer -= dt;
        if (this.updateTimer > 0) return;
        this.updateTimer = 0.1; // 10Hz updates

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
                if (timeSinceStart > 45 || this.lowSpeedTimer > 10.0) {
                    this.livenessState = 'force';
                } else if (timeSinceStart > 15 || this.lowSpeedTimer > 5.0) {
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

            // Beam Reach +/- 100 degrees (Slightly downwind to shed power if needed)
            const windDir = state.wind.direction;
            desiredHeading = normalizeAngle(windDir + this.wiggleSide * 1.75); // ~100 degrees

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

        // 4. Collision Avoidance (Reactive Layer)
        // Adjust desiredHeading to avoid immediate threats
        desiredHeading = this.applyAvoidance(desiredHeading, speedRequest);

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

        if (boat.raceState.finished) {
            // Sail to nearest boundary
            const b = state.course.boundary;
            if (b) {
                const angle = Math.atan2(boat.y - b.y, boat.x - b.x);
                return { x: b.x + Math.cos(angle)*(b.radius+500), y: b.y + Math.sin(angle)*(b.radius+500) };
            }
            return { x: boat.x, y: boat.y - 1000 };
        }

        // Determine Gate/Mark Target
        // Logic similar to original but cleaner
        let targetIndices = [0, 1];
        const leg = boat.raceState.leg;
        if (leg === 1 || leg === 3) targetIndices = [2, 3];
        else targetIndices = [0, 1]; // Start(0), Leeward(2), Finish(4) use marks 0,1

        const m1 = marks[targetIndices[0]];
        const m2 = marks[targetIndices[1]];

        let targetX, targetY;

        if (leg === 0) {
            let pct = this.startLinePct;

            // Recovery / Force Mode: Aim for center
            if (this.livenessState !== 'normal') {
                pct = 0.5;
            }

            // Start: Aim for our diversified spot on the line
            targetX = m1.x + (m2.x - m1.x) * pct;
            targetY = m1.y + (m2.y - m1.y) * pct;
            
            // Aim slightly PAST the line
            // Wind Direction (wd) is FROM direction.
            // Standard Coordinate System:
            // wd=0 (N) -> Blows South (+Y).
            // Upwind is North (-Y). Vector: (sin(wd), -cos(wd)).
            // We want to target UPWIND (Past the line).
            const wd = state.wind.direction;

            // OCS / Recovery Logic for Racing Phase
            // Check if we are on the Course Side (Upwind of line) without having started
            const lineDx = m2.x - m1.x, lineDy = m2.y - m1.y;
            const normalX = -lineDy, normalY = lineDx; // Points Downwind? No, -gateDy, gateDx?
            // gateDx = m2-m1. gateDy.
            // Check existing logic: nx = gateDy, ny = -gateDx.
            // dot > 0 is crossing dir 1 (Start).
            // Normal (nx, ny) points Upwind.
            const nx = lineDy, ny = -lineDx;
            const bDx = boat.x - m1.x, bDy = boat.y - m1.y;
            const dot = bDx * nx + bDy * ny;

            // dot > 0 means we are "Above" the line (Course Side)
            // If ocs is true, OR if we are course side (dot > 0), we must return.
            if (boat.raceState.ocs || dot > 0) {
                // Must go DOWNWIND to clear line.
                // Reset to center of start box to avoid looping around the ends which causes circular navigation traps.
                const centerX = (m1.x + m2.x) / 2;
                const centerY = (m1.y + m2.y) / 2;

                // Target Downwind (backwards from wind direction)
                // Upwind is (sin(wd), -cos(wd)). Downwind is (-sin(wd), cos(wd)).
                const distBack = (this.livenessState === 'normal') ? 150 : 250;

                targetX = centerX - Math.sin(wd) * distBack;
                targetY = centerY + Math.cos(wd) * distBack;
            } else {
                // Normal Start (Upwind)
                const distPast = (this.livenessState === 'force') ? 300 : 150;
                targetX += Math.sin(wd) * distPast;
                targetY -= Math.cos(wd) * distPast;
            }
        } else {
            // Standard Legs: Sail to gate center
            targetX = (m1.x + m2.x) / 2;
            targetY = (m1.y + m2.y) / 2;

            // Missed Gate Check: If we sailed past without crossing, turn back
            const gateDx = m2.x - m1.x;
            const gateDy = m2.y - m1.y;
            const nx = gateDy; // Normal points "Up/Left" depending on gate
            const ny = -gateDx;

            // Check where we are relative to gate plane
            const bdx = boat.x - m1.x;
            const bdy = boat.y - m1.y;
            const dot = bdx * nx + bdy * ny;

            // Crossing Direction:
            // Leg 1/3 (Upwind): Target 2,3. Cross dir 1 (Positive Dot).
            // Leg 2/4 (Downwind): Target 0,1. Cross dir -1 (Negative Dot).

            let pastGate = false;
            // Add buffer of 50 units past the line
            if (leg === 1 || leg === 3) {
                 if (dot > 50) pastGate = true;
            } else if (leg === 2 || leg === 4) {
                 if (dot < -50) pastGate = true;
            }

            if (pastGate) {
                // Recovery: Aim 150 units "Before" the gate center to reset approach
                const len = Math.sqrt(nx*nx + ny*ny);
                const unx = nx/len;
                const uny = ny/len;
                const center = { x: (m1.x+m2.x)/2, y: (m1.y+m2.y)/2 };

                // If Leg 1 (Upwind), we want to be "Below" (Negative Normal direction)
                const factor = (leg === 1 || leg === 3) ? -1 : 1;

                targetX = center.x + unx * 150 * factor;
                targetY = center.y + uny * 150 * factor;
            }
        }

        // If rounding, aim slightly outside to round cleanly
        if (boat.raceState.isRounding) {
            // We are passing through. Aim for a point past the gate.
            // But we need to round. Which mark?
            const d1 = (boat.x - m1.x)**2 + (boat.y - m1.y)**2;
            const d2 = (boat.x - m2.x)**2 + (boat.y - m2.y)**2;
            const mark = (d1 < d2) ? m1 : m2;
            
            // Calculate tangent for rounding
            // For now, simple waypoint logic in script.js handles "nextWaypoint"
            // Let's rely on geometric targets.
            // Aim 90 units outside the mark to allow turn radius (Avoidance radius is 45)
            const dx = mark.x - (m1.x+m2.x)/2;
            const dy = mark.y - (m1.y+m2.y)/2;
            const len = Math.sqrt(dx*dx+dy*dy);
            if (len > 0) {
                targetX = mark.x + (dx/len) * 90;
                targetY = mark.y + (dy/len) * 90;
            }
        }

        return { x: targetX, y: targetY };
    }

    getStrategicHeading(target) {
        const boat = this.boat;
        const windDir = state.wind.direction; // Global or Local? AI should use Local.
        const localWind = getWindAt(boat.x, boat.y);
        const wd = localWind.direction;


        const dx = target.x - boat.x;
        const dy = target.y - boat.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angleToTarget = Math.atan2(dx, -dy); // 0 is North (Up), but canvas Y is down. 

        // FORCE / RECOVERY OVERRIDE
        if (this.livenessState === 'force' || this.livenessState === 'recovery') {
             const twa = normalizeAngle(angleToTarget - wd);
             // If we can fetch it (TWA > 40 deg), go direct
             if (Math.abs(twa) > 0.7) { // ~40 degrees
                 return angleToTarget;
             }
             // Otherwise, beat to windward on best tack
             const desiredTack = twa > 0 ? 1 : -1;
             // Use local wind for best tack
             return normalizeAngle(wd + desiredTack * 0.75); // 43 degrees
        }
        // Math.atan2(x, -y) gives angle relative to North (0, -1) in CW?
        // Let's stick to standard math: atan2(dy, dx) is angle from X axis.
        // In game: Heading 0 = Up (0, -1). Heading PI/2 = Right (1, 0).
        // dx, dy = target - boat.
        // If target is (0, -100) (Up), dx=0, dy=-100. atan2(0, 100) = 0. Correct.
        
        // Determine Point of Sail
        const trueWindAngle = normalizeAngle(angleToTarget - wd);
        const absTWA = Math.abs(trueWindAngle);
        
        let mode = 'reach';
        if (absTWA < Math.PI / 3.5) mode = 'upwind'; // 45-50 deg
        else if (absTWA > Math.PI * 0.7) mode = 'downwind';

        if (mode === 'reach') return angleToTarget;

        // VMG Sailing
        let optTWA = (mode === 'upwind') ? (45 * Math.PI/180) : (150 * Math.PI/180);

        // Planing Optimization for AI
        // If downwind and conditions allow, try to heat it up to planing angles
        // Planing requires TWS > 12.0 and TWA > 100 < 170.
        // Best planing angle usually ~135-140.
        // Check if wind speed allows planing
        if (mode === 'downwind' && state.wind.speed > J111_PLANING.minTWS) {
             // Calculate potential VMG at 150 vs 140(planing)
             // Approx: 150 deg gives X speed. 140 deg gives Y speed * 1.20 (planing).
             // cos(30) = 0.866. cos(40) = 0.766.
             // If Speed increase > 13%, planing pays.
             // Multiplier is 1.20 (20%). So it pays!
             // Target Planing Angle ~140 degrees (2.44 rad)
             optTWA = 140 * Math.PI/180;
        }
        
        // Current Tack
        const currentTack = normalizeAngle(boat.heading - wd) > 0 ? 1 : -1;
        
        // Ideal headings
        const hStarboard = normalizeAngle(wd + optTWA); // Wind + 45
        const hPort = normalizeAngle(wd - optTWA);      // Wind - 45
        
        // Check Laylines
        // If we can fetch the target, sail directly (clamped to close hauled)
        if (mode === 'upwind') {
            if (absTWA > optTWA) return angleToTarget; // We can fetch it
        } else {
            // Downwind, we can always sail direct if not too deep
            // But VMG is faster than dead downwind. 
            // If TWA is e.g. 170, we should gybe.
            // If we aim at target and TWA > 150, we should head up to 150.
            if (absTWA < optTWA) return angleToTarget; // We can fetch (reaching)
        }

        // Tacking Logic
        // Choose the tack that brings us closer to the centerline (min distance to target axis)
        // Or simply: Look at angleToTarget.
        // If angleToTarget is positive (right of wind), Starboard (1) is closer.
        // If angleToTarget is negative (left of wind), Port (-1) is closer.
        
        // TWA is angleToTarget - Wind.
        // If TWA > 0, Target is Right of Wind. We want Starboard tack (Wind+45) which heads Right.
        const desiredTack = trueWindAngle > 0 ? 1 : -1;
        
        let selectedHeading = (currentTack === 1) ? hStarboard : hPort;

        // Should we tack/gybe?
        if (currentTack !== desiredTack) {
            // We are on wrong tack.
            // Only tack if we have crossed the "layline" significantly or timer expired.
            // Simple logic: If we are far enough past the center line.
            
            // Or use VMG comparison with hysteresis
            const vmgCurrent = Math.cos(normalizeAngle(boat.heading - angleToTarget)); // Approx
            // Better: Project velocity on vector to target.
            
            // Simple Layline:
            // We want to tack when angleToTarget relative to wind exceeds our tack angle?
            // No, when angleToTarget aligns with the *other* tack.
            
            // Threshold with hysteresis
            const threshold = 0.1; // Radians past ideal
            if (boat.raceState.leg === 0) {
                // Start leg: don't tack excessively
                if (this.tackCooldown <= 0) {
                     this.tackCooldown = 5.0;
                     return (desiredTack === 1) ? hStarboard : hPort;
                }
            } else {
                // If we persist on current tack, we go further away from target line.
                // Tack if we are "overstanding" or close to it.
                // Check if the OTHER tack points directly at target (Layline)
                const otherHeading = (currentTack === 1) ? hPort : hStarboard;
                const angleError = Math.abs(normalizeAngle(otherHeading - angleToTarget));
                
                if (angleError < 0.1) { // Close to layline
                    if (this.tackCooldown <= 0) {
                        this.tackCooldown = 15.0;
                        return otherHeading;
                    }
                }
            }
        }
        
        // Keep current if no reason to switch
        return selectedHeading;
    }

    getStartCommand() {
        const boat = this.boat;
        const timer = state.race.timer;
        const m0 = state.course.marks[0];
        const m1 = state.course.marks[1];
        
        // Target Point on line
        const dx = m1.x - m0.x;
        const dy = m1.y - m0.y;
        const targetX = m0.x + dx * this.startLinePct;
        const targetY = m0.y + dy * this.startLinePct;
        
        // Wind info
        const wd = state.wind.direction;
        const downwind = wd + Math.PI;
        
        // Setup Point (Downwind of line)
        const setupX = targetX + Math.sin(downwind) * this.startDistance;
        const setupY = targetY - Math.cos(downwind) * this.startDistance;
        
        let heading = 0;
        let speed = 1.0;
        
        // Start Time Estimation:
        // dist to target / speed
        // If we are 200 units away, speed=100 -> 2s.
        // But we need time to accelerate.
        // Let's trigger "Go" when timeToTarget matches timer with buffer.

        const distToTarget = Math.sqrt((targetX - boat.x)**2 + (targetY - boat.y)**2);
        // Estimate average speed during approach as slower (acceleration)
        // From speed 0.2 (12 units/s) to 1.0 (60 units/s) takes time.
        // Use a conservative average speed of ~30 units/s for planning.
        const approachSpeed = 30.0; // units/s
        const timeToRun = distToTarget / approachSpeed;
        const buffer = 10.0; // Increase buffer to account for slow acceleration and maneuvering

        // Phase 1: Wait / Hover
        if (timer > timeToRun + buffer && timer > 10) {
            // Stay near setup point
            const dToSetup = Math.sqrt((boat.x - setupX)**2 + (boat.y - setupY)**2);
            if (dToSetup > 20) {
                // Sail to setup
                heading = Math.atan2(setupX - boat.x, -(setupY - boat.y));
                // If we are ahead of setup (closer to line), slow down
                // Projected pos on line normal
                const lineNormalX = Math.sin(wd);
                const lineNormalY = -Math.cos(wd);
                const distToLine = (targetX - boat.x)*lineNormalX + (targetY - boat.y)*lineNormalY; // Approx
                
                if (distToLine < this.startDistance - 10) {
                    speed = 0.2; // Slow Sail (Don't stop completely)
                    // Park Close-Hauled (Starboard) instead of Irons
                    heading = normalizeAngle(wd + Math.PI / 4);
                }
            } else {
                // At setup, luff Close-Hauled but keep moving slightly
                heading = normalizeAngle(wd + Math.PI / 4);
                speed = 0.2;
            }
        } else {
            // Phase 2: Final Approach (Gun is coming)
            
            // Use Navigation Target instead of fixed heading to allow Tacking/VMG
            // But apply speed control logic

            const dist = Math.sqrt((targetX - boat.x)**2 + (targetY - boat.y)**2);
            // Estimate speed at 10.0 kn (~100 units/s)
            const timeToLine = dist / 100.0;
            
            if (timeToLine < timer - 2.0) {
                // Kill speed
                speed = 0.1;
                // Keep parking heading if we are waiting?
                // Or just sail slowly towards target?
                // If we sail towards target slowly, we progress.
                // Let's return target but low speed.
                return { target: {x: targetX, y: targetY}, speed };
            } else {
                speed = 1.0; // Gun it
                return { target: {x: targetX, y: targetY}, speed };
            }
        }
        
        // OCS Check
        // If we crossed line (y coordinate check relative to line), emergency return
        // Simplify: just check if "distToLine" is negative
        // But simpler: Is boat.raceState.ocs true?
        if (boat.raceState.ocs) {
            // Sail back below line
            const recoverX = targetX + Math.sin(downwind) * 100;
            const recoverY = targetY - Math.cos(downwind) * 100;
            heading = Math.atan2(recoverX - boat.x, -(recoverY - boat.y));
            speed = 1.0;
            return { heading, speed }; // Explicit return to force OCS behavior
        }

        return { heading, speed };
    }

    updateRiskAssessment(dt) {
        // Decrement timer
        if (this.avoidanceCommitTimer > 0) {
            this.avoidanceCommitTimer -= dt;
        }

        // Find threats
        let maxRisk = 'LOW';
        let role = 'NONE';

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
                try {
                     rowBoat = getRightOfWay(this.boat, other);
                } catch(e) { }

                const myRole = (rowBoat === this.boat) ? 'STAND_ON' : 'GIVE_WAY';

                // Prioritize highest risk
                const riskLevel = { 'LOW':0, 'MEDIUM':1, 'HIGH':2, 'IMMINENT':3 };
                if (riskLevel[risk] > riskLevel[maxRisk]) {
                    maxRisk = risk;
                    role = myRole;
                }
            }
        }

        // Latching Logic: Prevent oscillation by holding state
        if (this.avoidanceCommitTimer > 0) {
            // If risk drops to LOW while committed, ignore it (hold previous state)
            if (maxRisk === 'LOW') {
                return;
            }
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

    applyAvoidance(desiredHeading, speedRequest) {
        // If stuck (Wiggle Mode), ignore avoidance to force breakout
        if (this.wiggleActive) return desiredHeading;

        const boat = this.boat;
        const lookaheadFrames = 240; // Increased to 4 seconds lookahead
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

        // Dynamic Safe Distance based on Liveness
        let safeDist = 80; // 40 radius * 2 (Normal)

        // Tighter packing during start sequence
        if (state.race.status === 'prestart' || this.boat.raceState.leg === 0) {
            safeDist = 60;
        }

        if (this.livenessState === 'recovery') safeDist = 50;
        if (this.livenessState === 'force') safeDist = 20;

        // Symmetry Breaking: Differentiate Safety Bubbles (Only in Normal Liveness)
        if (this.livenessState === 'normal' && this.avoidanceRole === 'GIVE_WAY') {
            // Give-Way: Larger bubble to react early
            if (this.riskState === 'MEDIUM' || this.riskState === 'HIGH') {
                safeDist = 150; // Increased significantly for earlier give-way
            }
        }

        for (const offset of candidates) {
            const h = normalizeAngle(desiredHeading + offset);
            
            // Base Cost: Deviation from desired course
            // Non-linear cost to strongly prefer small deviations
            let cost = Math.pow(Math.abs(offset), 1.5) * 10; 

            // Stand-On: Penalize large deviations (Hold Course) unless imminent
            if (this.avoidanceRole === 'STAND_ON' && (this.riskState === 'MEDIUM' || this.riskState === 'HIGH')) {
                cost += Math.abs(offset) * 2000; // Stronger penalty to hold course
            }

            // Project position at t=lookahead
            const vx = Math.sin(h) * speed;
            const vy = -Math.cos(h) * speed;
            const futureX = boat.x + vx * (lookaheadFrames / 60);
            const futureY = boat.y + vy * (lookaheadFrames / 60);

            // Check 3 points: Current, Halfway, Future
            const points = [
                {x: boat.x + vx * 0.5, y: boat.y + vy * 0.5},
                {x: futureX, y: futureY}
            ];

            let boatCollision = false;
            let staticCollision = false; // Marks/Boundary
            let ruleViolation = false;
            let proximityCost = 0;

            // 1. Boats
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
                        else cost -= 500;
                    }
                }

                // Check along the path
                for (let i = 0; i < points.length; i++) {
                    const t = (i + 1) * 0.5 * (lookaheadFrames / 60);
                    const myP = points[i];
                    const otherP = {
                        x: other.x + ovx * t,
                        y: other.y + ovy * t
                    };

                    const distSq = (myP.x - otherP.x)**2 + (myP.y - otherP.y)**2;
                    
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
                                const row = getRightOfWay(boat, other);
                                if (row === other) ruleViolation = true; // We are Give-Way
                            } catch(e) {}
                        }
                    } else if (distSq < 250 * 250 && this.livenessState === 'normal') {
                        // Soft avoidance (Proximity)
                        proximityCost += 5000 / (distSq + 10);
                    }
                }
            }

            // 2. Marks
            if (state.course.marks) {
                for (const m of state.course.marks) {
                    // Check path
                    for (const p of points) {
                        const dSq = (p.x - m.x)**2 + (p.y - m.y)**2;
                        if (dSq < 45*45) { // Reduced from 60 to 45 for tighter rounding
                            staticCollision = true;
                        } else if (dSq < 100*100 && this.livenessState === 'normal') {
                            proximityCost += 10000 / dSq;
                        }
                    }
                }
            }

            // 3. Boundary
            if (state.course.boundary) {
                const b = state.course.boundary;
                for (const p of points) {
                    const d = Math.sqrt((p.x - b.x)**2 + (p.y - b.y)**2);
                    if (d > b.radius - 50) staticCollision = true;
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
        
        return bestHeading;
    }
}

// AI Configuration
const AI_CONFIG = [
    { name: 'Bixby', creature: 'Otter', hull: '#0046ff', spinnaker: '#FFD400', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "A relaxed veteran who reads the wind instinctively and somehow always ends up in the right place." },
    { name: 'Skim', creature: 'Flying Fish', hull: '#8FD3FF', spinnaker: '#FF2D95', sail: '#FFFFFF', cockpit: '#AEB4BF', personality: "A flashy opportunist who thrives on bursts of speed and perfectly timed lane changes." },
    { name: 'Wobble', creature: 'Platypus', hull: '#FF8C1A', spinnaker: '#00E5FF', sail: '#FFFFFF', cockpit: '#B0B0B0', personality: "Unpredictable and awkward in motion, but maddeningly effective when chaos breaks out." },
    { name: 'Pinch', creature: 'Lobster', hull: '#E10600', spinnaker: '#FFFFFF', sail: '#FFFFFF', cockpit: '#5A5A5A', personality: "Aggressive and confrontational, specializing in brutal starting-line pressure and intimidation." },
    { name: 'Bruce', creature: 'Great White', hull: '#121212', spinnaker: '#ff0606', sail: '#FFFFFF', cockpit: '#3A3A3A', personality: "Cold, dominant, and relentless, forcing others to react to his presence or suffer." },
    { name: 'Strut', creature: 'Flamingo', hull: '#FF4F9A', spinnaker: '#000000', sail: '#FFFFFF', cockpit: '#B0BEC5', personality: "Stylish and confident, sailing with flair and daring others to keep up." },
    { name: 'Gasket', creature: 'Beaver', hull: '#FFE600', spinnaker: '#000000', sail: '#000000', cockpit: '#C4BEB2', personality: "Methodical and stubborn, building slow advantages that are almost impossible to dismantle." },
    { name: 'Chomp', creature: 'Alligator', hull: '#2ECC71', spinnaker: '#F4C27A', sail: '#000000', cockpit: '#C1B58A', personality: "Patient and dangerous, striking decisively when opponents least expect it." },
    { name: 'Whiskers', creature: 'Walrus', hull: '#C49A6C', spinnaker: '#8E0038', sail: '#FFFFFF', cockpit: '#ddd3c9', personality: "Big, steady, and immovable, excelling in endurance races and heavy conditions." },
    { name: 'Vex', creature: 'Lizard', hull: '#0fe367', spinnaker: '#D9D9D9', sail: '#FFFFFF', cockpit: '#D0D0D0', personality: "Slippery and cunning, exploiting tiny mistakes and disappearing into clean air." },
    { name: 'Hug', creature: 'Starfish', hull: '#9900ff', spinnaker: '#e8a6ff', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Radiates good vibes while quietly outlasting flashier competitors." },
    { name: 'Ripple', creature: 'Dolphin', hull: '#00B3FF', spinnaker: '#FF6F00', sail: '#FFFFFF', cockpit: '#B8C6D1', personality: "A cheerful speedster who always looks for clean lanes and open water." },
    { name: 'Clutch', creature: 'Crab', hull: '#B00020', spinnaker: '#FFD166', sail: '#FFFFFF', cockpit: '#6B6B6B', personality: "Defensive and stubborn, impossible to bully off the line." },
    { name: 'Glide', creature: 'Albatross', hull: '#E8F1F8', spinnaker: '#1F4FFF', sail: '#000000', cockpit: '#C5CED6', personality: "Calm and patient, winning races by never making mistakes." },
    { name: 'Fathom', creature: 'Orca', hull: '#1C1C3C', spinnaker: '#00F0FF', sail: '#FFFFFF', cockpit: '#3C3F55', personality: "Silent, dominant, and terrifying when fully powered up." },
    { name: 'Scuttle', creature: 'Hermit Crab', hull: '#FFB703', spinnaker: '#3A86FF', sail: '#000000', cockpit: '#BFAF92', personality: "Erratic and clever, thrives in crowded chaos." },
    { name: 'Finley', creature: 'Tuna', hull: '#0077B6', spinnaker: '#ffd900', sail: '#FFFFFF', cockpit: '#A7B8C8', personality: "Built for straight-line speed and relentless pressure." },
    { name: 'Torch', creature: 'Fire Salamander', hull: '#FF3B30', spinnaker: '#FFD60A', sail: '#000000', cockpit: '#5E5E5E', personality: "Explosive starts and risky moves define every race." },
    { name: 'Nimbus', creature: 'Cloud Ray', hull: '#6A7FDB', spinnaker: '#F1F7FF', sail: '#FFFFFF', cockpit: '#C9D0E0', personality: "Floats effortlessly through shifts others don’t even see." },
    { name: 'Tangle', creature: 'Octopus', hull: '#7A1FA2', spinnaker: '#00E676', sail: '#FFFFFF', cockpit: '#B8ACC9', personality: "A master of traps, overlaps, and dirty air." },
    { name: 'Brine', creature: 'Manatee', hull: '#5E7C8A', spinnaker: '#FFB4A2', sail: '#FFFFFF', cockpit: '#C3CCD2', personality: "Slow-looking but shockingly hard to pass." },
    { name: 'Razor', creature: 'Barracuda', hull: '#2D3142', spinnaker: '#EF233C', sail: '#FFFFFF', cockpit: '#5C5F6A', personality: "Aggressive and surgical, always attacking at the worst moment." },
    { name: 'Pebble', creature: 'Penguin', hull: '#1F1F1F', spinnaker: '#00B4D8', sail: '#FFFFFF', cockpit: '#C7CCD1', personality: "Precision-focused and unflappable in traffic." },
    { name: 'Saffron', creature: 'Seahorse', hull: '#FFB000', spinnaker: '#7B2CBF', sail: '#FFFFFF', cockpit: '#CBBFA6', personality: "Graceful and unpredictable, loves wide tactical plays." },
    { name: 'Bramble', creature: 'Sea Urchin', hull: '#2B2E4A', spinnaker: '#FF9F1C', sail: '#FFFFFF', cockpit: '#7A7F9A', personality: "Defensive and spiky—never gives an easy lane." },
    { name: 'Mistral', creature: 'Swift', hull: '#A8DADC', spinnaker: '#E63946', sail: '#FFFFFF', cockpit: '#C4CFD4', personality: "Constantly hunting pressure and small gains." },
    { name: 'Drift', creature: 'Jellyfish', hull: '#FF70A6', spinnaker: '#70D6FF', sail: '#FFFFFF', cockpit: '#D6C9D9', personality: "Looks harmless but slips through impossibly tight gaps." },
    { name: 'Anchor', creature: 'Sea Turtle', hull: '#2F6F4E', spinnaker: '#FFD166', sail: '#FFFFFF', cockpit: '#B7C4B4', personality: "Conservative, resilient, and brutally consistent." },
    { name: 'Zing', creature: 'Flying Squirrel', hull: '#9B5DE5', spinnaker: '#FEE440', sail: '#FFFFFF', cockpit: '#CFC7DC', personality: "Hyperactive and opportunistic, thrives on chaos." },
    { name: 'Knot', creature: 'Nautilus', hull: '#C8553D', spinnaker: '#588157', sail: '#FFFFFF', cockpit: '#C8B5A6', personality: "Methodical and cerebral, always playing the long game." },
    { name: 'Flash', creature: 'Mackerel', hull: '#3A86FF', spinnaker: '#FFBE0B', sail: '#000000', cockpit: '#B4C2D6', personality: "All-in on speed, even when it’s a terrible idea." },
    { name: 'Pearl', creature: 'Oyster', hull: '#C7A6FF', spinnaker: '#2E2E2E', sail: '#FFFFFF', cockpit: '#CFCFD4', personality: "Quiet, patient, and underestimated, winning races by waiting out mistakes and capitalizing at exactly the right moment." },
    { name: 'Bluff', creature: 'Polar Bear', hull: '#FFFFFF', spinnaker: '#00AEEF', sail: '#FFFFFF', cockpit: '#BFC6CC', personality: "Calm, imposing, and unbothered by pressure, daring others to blink first." },
    { name: 'Regal', creature: 'Swan', hull: '#FFFFFF', spinnaker: '#E10600', sail: '#000000', cockpit: '#C9CCD6', personality: "Elegant and ruthless, smiling sweetly while stealing your lane." },
    { name: 'Sunshine', creature: 'Mahi-Mahi', hull: '#FFEB3B', spinnaker: '#00E676', sail: '#FFFFFF', cockpit: '#BDB76B', personality: "Fast, flashy, and always attacking on reaches." },
    { name: 'Pulse', creature: 'Tree Frog', hull: '#00FF6A', spinnaker: '#7A00FF', sail: '#FFFFFF', cockpit: '#C9CCD6', personality: "Hyper-alert and explosive off the line, thriving on quick reactions and sudden bursts." }
];


// Settings
const DEFAULT_SETTINGS = {
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
    spinnakerColor: '#ef4444'
};

let settings = { ...DEFAULT_SETTINGS };

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
        speed: 10,
        baseSpeed: 10
    },
    showNavAids: true,
    particles: [],
    keys: {
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false,
        Shift: false,
    },
    paused: false,
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
burgeeImg.src = 'assets/images/salty-crew-yacht-club-burgee.png';

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
            penaltyTimer: 0,
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
            legManeuvers: [0, 0, 0, 0, 0],
            legTopSpeeds: [0, 0, 0, 0, 0],
            legDistances: [0, 0, 0, 0, 0],
            legSpeedSums: [0, 0, 0, 0, 0],
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
        this.prevRank = 0;
    }
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
    // Bias 0 (Soft) to 1 (Punchy)
    // Gust: +20% to +50%
    // Lull: -10% to -40%

    // Base strength factor 0.0 to 1.0 within the range
    const strengthRandom = Math.random();
    // Mix with bias: weighted towards bias
    const bias = conditions.gustStrengthBias || 0.5;
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

    // Directional Deviation inside Puff ("Puff Shiftiness")
    // Enhanced for bigger shifts as requested.
    // Low: 5-20 deg. High: 10-30 deg.
    // conditions.puffShiftiness is 0-1
    const minDev = 5 + conditions.puffShiftiness * 15; // 5 to 20
    const maxDev = 10 + conditions.puffShiftiness * 20; // 10 to 30
    const devDeg = minDev + Math.random() * (maxDev - minDev);
    const devRad = devDeg * (Math.PI / 180);
    dirDelta = (Math.random() < 0.5 ? -1 : 1) * devRad;

    // Movement Factors (Relative to global wind)
    const moveSpeedFactor = (0.8 + Math.random() * 0.4) * 0.1; // 10% of wind speed approx
    const moveDirOffset = (Math.random() - 0.5) * 0.1; // Slight drift relative to wind

    // Initial Velocity
    const moveSpeed = baseSpeed * moveSpeedFactor;
    const moveDir = windDir + moveDirOffset;
    const vx = -Math.sin(moveDir) * moveSpeed;
    const vy = Math.cos(moveDir) * moveSpeed;

    const duration = 30 + Math.random() * 60;
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
    // "Bias behavior: A given race should lean toward... softer/punchier" handled in strength.
    // What about Gust vs Lull frequency?
    // "Puffiness controls density... Multiple puffs and lulls may exist simultaneously"
    // Let's assume 50/50 balance unless otherwise specified, or random per race?
    // Let's stick to 50/50 mix for now.
    const type = Math.random() < 0.5 ? 'gust' : 'lull';

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

    const finalSpeed = Math.sqrt(sumWx*sumWx + sumWy*sumWy);
    const finalDir = Math.atan2(sumWx, -sumWy); // x, -y to get angle from North CW?
    // Wait, atan2(x, -y) is standard for "0 is Up, CW".
    // Check: x=0, y=-1 (Up). atan2(0, 1) = 0. Correct.
    // Check: x=1, y=0 (Right). atan2(1, 0) = PI/2. Correct.

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
            const player = state.boats[0];
            const leg = player ? player.raceState.leg : 0;
            // Leg 0, 1, 3: Upwind (breezy-race.mp3)
            // Leg 2, 4: Downwind (spinnaker-run.mp3)
            if (leg === 0 || leg === 1 || leg === 3) targetTrack = 'racing-upwind';
            else targetTrack = 'racing-downwind';
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
                 const volume = 0.05 + ((clampedSpeed - 5) / 20) * 0.25;
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
    settingMusic: document.getElementById('setting-music'),
    settingPenalties: document.getElementById('setting-penalties'),
    settingNavAids: document.getElementById('setting-navaids'),
    settingTrim: document.getElementById('setting-trim'),
    settingCameraMode: document.getElementById('setting-camera-mode'),
    settingHullColor: document.getElementById('setting-color-hull'),
    settingSailColor: document.getElementById('setting-color-sail'),
    settingCockpitColor: document.getElementById('setting-color-cockpit'),
    settingSpinnakerColor: document.getElementById('setting-color-spinnaker'),
    leaderboard: document.getElementById('leaderboard'),
    lbLeg: document.getElementById('lb-leg'),
    lbRows: document.getElementById('lb-rows'),
    rulesStatus: document.getElementById('hud-rules-status'),
    resultsOverlay: document.getElementById('results-overlay'),
    resultsList: document.getElementById('results-list'),
    resultsRestartButton: document.getElementById('results-restart-button'),
    preRaceOverlay: document.getElementById('pre-race-overlay'),
    // Config Sliders
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

    prCompetitorsGrid: document.getElementById('pr-competitors-grid'),
    startRaceBtn: document.getElementById('start-race-btn'),
    boatRows: {}
};

function updateConditionDescription() {
    if (!UI.confDesc) return;

    const strength = parseFloat(UI.confWindStrength.value);
    const variability = parseFloat(UI.confWindVar.value);
    const shiftiness = parseFloat(UI.confWindShift.value);
    const puffFreq = parseFloat(UI.confPuffFreq.value);
    const puffInt = parseFloat(UI.confPuffInt.value);
    const puffShift = parseFloat(UI.confPuffShift.value);

    // Apply to state
    const baseMin = 5;
    const baseMax = 25;
    state.wind.baseSpeed = baseMin + strength * (baseMax - baseMin);

    state.race.conditions.variability = variability;
    state.race.conditions.shiftiness = shiftiness;
    state.race.conditions.puffiness = puffFreq;
    state.race.conditions.gustStrengthBias = puffInt;
    state.race.conditions.puffShiftiness = puffShift;

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

    if (puffInt > 0.6) text += " that pack a serious punch";
    else if (puffInt < 0.4) text += " that are soft and subtle";

    if (puffShift > 0.6) text += " with sharp directional twists.";
    else if (puffShift > 0.3) text += " with some directional leverage.";
    else text += ".";

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

function setupPreRaceOverlay() {
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

    // Course Defaults
    // 4000 units / 5 = 800m
    if (UI.confCourseDist) UI.confCourseDist.value = state.race.legLength / 5;
    if (UI.confCourseLegs) UI.confCourseLegs.value = state.race.totalLegs;
    if (UI.confCourseTimer) UI.confCourseTimer.value = state.race.startTimerDuration;

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

        competitors.forEach(boat => {
            const card = document.createElement('div');
            // Base styling: Wider and taller, no rounded-br-3xl to keep it more uniform if we want, but user said "Make the badges wider and taller"
            // Let's use h-auto or fixed height.
            // "putting the portrait direction on the badge without the round circle"
            card.className = "p-0 rounded-xl border border-white/5 flex flex-col relative overflow-hidden h-96 group";

            // Color Logic
            const hullColor = boat.colors.hull;
            const spinColor = boat.colors.spinnaker;
            const hullLuma = getLuma(hullColor);
            const useSpin = hullLuma < 50 || hullLuma > 200;
            const bgColor = useSpin ? spinColor : hullColor;

            // Apply gradient background
            card.style.background = `linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, ${bgColor} 100%)`;

            // Image - Full width/height approach or top section?
            // "putting the portrait direction on the badge without the round circle"
            // Let's make it a large square/rect image at the top or filling a side?
            // "Make the badges wider and taller" implies more space.
            // Let's try a vertical card layout: Image on top (square), text below.

            const imgContainer = document.createElement('div');
            imgContainer.className = "w-full h-64 relative overflow-hidden";

            const img = document.createElement('img');
            img.src = "assets/images/" + boat.name.toLowerCase() + ".png";
            img.className = "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110";

            imgContainer.appendChild(img);

            // Transparent overlay to protect image
            const overlay = document.createElement('div');
            overlay.className = "absolute inset-0 z-10";
            imgContainer.appendChild(overlay);

            const info = document.createElement('div');
            info.className = "p-3 flex flex-col gap-1 relative z-10 bg-slate-900/40 flex-1";

            const nameRow = document.createElement('div');
            nameRow.className = "flex justify-between items-center";
            nameRow.innerHTML = `<span class="text-xl font-black text-white uppercase tracking-tight drop-shadow-md">${boat.name}</span>`;

            // Personality
            const config = AI_CONFIG.find(c => c.name === boat.name);
            let pText = config ? config.personality : "Unknown";

            const desc = document.createElement('div');
            desc.className = "text-xs text-slate-300 italic leading-snug line-clamp-3"; // Allow more lines
            desc.textContent = pText;

            info.appendChild(nameRow);
            info.appendChild(desc);

            card.appendChild(imgContainer);
            card.appendChild(info);
            UI.prCompetitorsGrid.appendChild(card);
        });
    }
}

function startRace() {
    if (state.race.status !== 'waiting') return;

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
    }
    state.camera.mode = settings.cameraMode;

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

// Pre-Race Config Listeners
if (UI.confWindStrength) UI.confWindStrength.addEventListener('input', updateConditionDescription);
if (UI.confWindVar) UI.confWindVar.addEventListener('input', updateConditionDescription);
if (UI.confWindShift) UI.confWindShift.addEventListener('input', updateConditionDescription);
if (UI.confPuffFreq) UI.confPuffFreq.addEventListener('input', updateConditionDescription);
if (UI.confPuffInt) UI.confPuffInt.addEventListener('input', updateConditionDescription);
if (UI.confPuffShift) UI.confPuffShift.addEventListener('input', updateConditionDescription);

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
        }
    });

if (UI.confCourseDist) UI.confCourseDist.addEventListener('input', updateCourseConfig);
if (UI.confCourseLegs) UI.confCourseLegs.addEventListener('input', updateCourseConfig);
if (UI.confCourseTimer) UI.confCourseTimer.addEventListener('input', updateCourseConfig);

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
    if (e.key === 'Enter') {
        const modes = ['heading', 'north', 'wind', 'gate'];
        state.camera.mode = modes[(modes.indexOf(state.camera.mode) + 1) % modes.length];
        settings.cameraMode = state.camera.mode;
        state.camera.message = state.camera.mode.toUpperCase();
        state.camera.messageTimer = 1.5;
        saveSettings();
    }
    if (e.key === ' ' || e.code === 'Space') {
        if (state.boats.length > 0) state.boats[0].spinnaker = !state.boats[0].spinnaker;
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        if (state.boats.length > 0) {
            state.boats[0].manualTrim = !state.boats[0].manualTrim;
            settings.manualTrim = state.boats[0].manualTrim;
            saveSettings();
            if (state.boats[0].manualTrim) state.boats[0].manualSailAngle = Math.abs(state.boats[0].sailAngle);
        }
    }
    if (e.key === '?' || (e.shiftKey && e.key === '/')) toggleHelp();
    if (e.key === 'Escape') {
        if (UI.helpScreen && !UI.helpScreen.classList.contains('hidden')) toggleHelp(false);
        else if (UI.settingsScreen && !UI.settingsScreen.classList.contains('hidden')) toggleSettings(false);
        else togglePause();
    }
    if (e.key === 'F1') {
        e.preventDefault();
        if (window.html2canvas) {
            window.html2canvas(document.body).then(c => {
                const link = document.createElement('a');
                link.download = 'regatta-screenshot.png';
                link.href = c.toDataURL();
                link.click();
            });
        }
    }
    if (e.key === 'F2') { e.preventDefault(); toggleSettings(); }
    if (e.key === 'F3') {
        e.preventDefault();
        settings.soundEnabled = !settings.soundEnabled;
        saveSettings();
        if (settings.soundEnabled) Sound.init();
        Sound.updateWindSound(state.wind.speed);
    }
    if (e.key === 'F4') {
        e.preventDefault();
        settings.penaltiesEnabled = !settings.penaltiesEnabled;
        saveSettings();
        const msg = settings.penaltiesEnabled ? "RULES ENABLED" : "RULES DISABLED";
        const col = settings.penaltiesEnabled ? "text-green-400" : "text-red-400";
        showRaceMessage(msg, col, `border-${settings.penaltiesEnabled ? 'green' : 'red'}-400/50`);
        setTimeout(hideRaceMessage, 1500);
    }
    if (e.key === 'F5') {
        e.preventDefault();
        settings.musicEnabled = !settings.musicEnabled;
        saveSettings();
        Sound.init();
    }
    if (e.key === '`' || e.code === 'Backquote') {
        state.showNavAids = !state.showNavAids;
        settings.navAids = state.showNavAids;
        saveSettings();
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
    // A boat is Clear Astern if her hull is behind a line abeam from the aftermost point of the other boat's hull.
    const ahH = ahead.heading;
    const fwdX = Math.sin(ahH), fwdY = -Math.cos(ahH); // Points to Bow
    const sternX = ahead.x - fwdX * 30;
    const sternY = ahead.y - fwdY * 30;

    // We need to check if 'behind' boat's BOW is behind 'ahead' boat's STERN line.
    const bhH = behind.heading;
    const bhFwdX = Math.sin(bhH), bhFwdY = -Math.cos(bhH);
    const bowX = behind.x + bhFwdX * 25;
    const bowY = behind.y + bhFwdY * 25;

    // Vector from Ahead's Stern to Behind's Bow
    const dx = bowX - sternX;
    const dy = bowY - sternY;

    // Project onto Ahead's Forward Vector
    const dot = dx * fwdX + dy * fwdY;

    // If dot < 0, Behind's Bow is "behind" the abeam line at Ahead's Stern.
    return dot < 0;
}

function getRightOfWay(b1, b2) {
    // Priority: Rule 14 -> 18 -> 13 -> 10 -> 11/12 -> 17/16

    // 1. Mark Room (Rule 18)
    const leg = b1.raceState.leg; // Assume same leg context for simplicity
    const isRacing = state.race.status === 'racing';

    const t1 = b1.boomSide > 0 ? 1 : -1;
    const t2 = b2.boomSide > 0 ? 1 : -1;
    const oppositeTacks = (t1 !== t2);
    const isUpwind = (leg === 1 || leg === 3);

    let rule18Applies = false;
    if (isRacing && leg > 0 && leg < 5) {
        // Exclusion: Opposite tacks on a beat to windward
        if (!(isUpwind && oppositeTacks)) {
             if (b1.raceState.inZone || b2.raceState.inZone) {
                 rule18Applies = true;
             }
        }
    }

    if (rule18Applies) {
        // Simplification: If one is in zone and other isn't, the one in zone usually established it first.
        if (b1.raceState.inZone !== b2.raceState.inZone) {
            return b1.raceState.inZone ? b1 : b2;
        }

        // Both in zone
        const b1Astern = getClearAstern(b1, b2);
        const b2Astern = getClearAstern(b2, b1);
        const overlapped = !b1Astern && !b2Astern;

        if (overlapped) {
            // Inside boat has ROW.
            // Determine which is inside relative to the mark.
            let activeIndices = (leg % 2 === 0) ? [0, 1] : [2, 3];
            let targetMark = state.course.marks[activeIndices[0]];
            let minD = Infinity;
            for (const idx of activeIndices) {
                const m = state.course.marks[idx];
                const d = (b1.x - m.x)**2 + (b1.y - m.y)**2;
                if (d < minD) { minD = d; targetMark = m; }
            }

            const d1 = (b1.x - targetMark.x)**2 + (b1.y - targetMark.y)**2;
            const d2 = (b2.x - targetMark.x)**2 + (b2.y - targetMark.y)**2;
            return (d1 < d2) ? b1 : b2;
        } else {
            // Clear Ahead has ROW
            return b1Astern ? b2 : b1;
        }
    }

    // 2. Rule 13 (While Tacking)
    if (b1.raceState.isTacking && !b2.raceState.isTacking) return b2;
    if (!b1.raceState.isTacking && b2.raceState.isTacking) return b1;

    // 3. Rule 10 (Opposite Tacks)
    if (oppositeTacks) {
        return (t1 === 1) ? b1 : b2; // Starboard (1) wins
    }

    // 4. Same Tack (Rule 11 & 12)
    const b1Astern = getClearAstern(b1, b2);
    const b2Astern = getClearAstern(b2, b1);

    if (b1Astern && !b2Astern) return b2; // b2 Ahead wins (Rule 12)
    if (b2Astern && !b1Astern) return b1; // b1 Ahead wins (Rule 12)

    // Rule 11: Overlapped, Same Tack -> Leeward ROW
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const wDir = state.wind.direction;
    const ux = Math.sin(wDir);
    const uy = -Math.cos(wDir);
    // Right of Wind Vector
    const rx = -uy;
    const ry = ux;
    const dotRight = dx * rx + dy * ry;

    if (t1 === 1) { // Starboard Tack
        // Wind from Right. Leeward is Left.
        // dotRight > 0 => b2 is Right (Windward). b1 is Leeward.
        return (dotRight > 0) ? b1 : b2;
    } else { // Port Tack
        // Wind from Left. Leeward is Right.
        // dotRight > 0 => b2 is Right (Leeward). b1 is Windward.
        return (dotRight > 0) ? b2 : b1;
    }
}

function getBestVMGAngle(mode, windSpeed) {
    // Mode: 'upwind' or 'downwind'
    // Derived from J/111 Polars
    // Using safer angles to maintain speed and stability
    if (mode === 'upwind') {
        return 45 * (Math.PI / 180);
    } else {
        return 150 * (Math.PI / 180);
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
    let aiTurnRate = CONFIG.turnSpeed * timeScale;
    
    // Wiggle / Force Mode: Super Steering
    if (boat.controller && boat.controller.wiggleActive) {
        aiTurnRate *= 5.0; // Snap turn to break friction
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

function triggerPenalty(boat) {
    if (boat.raceState.finished) return;
    if (window.onRaceEvent && state.race.status === 'racing') window.onRaceEvent('penalty', { boat });
    if (!settings.penaltiesEnabled) return;

    // Reset timer if already penalized? Or just ignore?
    // Usually penalties stack or reset. Let's reset the timer to 10s.
    if (!boat.raceState.penalty) {
        boat.raceState.penalty = true;
        boat.raceState.totalPenalties++; // Only increment start of penalty
    }

    if (boat.isPlayer) Sound.playPenalty();

    // Always reset timer to 10s on new penalty trigger
    boat.raceState.penaltyTimer = 10.0;

    if (boat.isPlayer) {
        showRaceMessage("PENALTY! SPEED REDUCED 50% FOR 10s", "text-red-500", "border-red-500/50");
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
        const turnRate = (state.keys.Shift ? CONFIG.turnSpeed * 0.25 : CONFIG.turnSpeed) * timeScale;
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
    // Tacking is defined as "from the moment she is beyond head to wind until she is on a close-hauled course".
    // "Head to wind" means pointing directly into wind (angleToWind ~ 0).
    // Close-hauled is ~45 deg.
    // Simplified: If angleToWind is small (in irons), we are tacking.
    if (angleToWind < Math.PI / 6) { // < 30 degrees
        boat.raceState.isTacking = true;
    } else {
        // If we were tacking, check if we are on a close-hauled course (e.g. > 40 deg).
        if (boat.raceState.isTacking && angleToWind > Math.PI / 4.5) {
             boat.raceState.isTacking = false;
        }
    }

    let swingSpeed = 0.025;
    boat.boomSide += (boat.targetBoomSide - boat.boomSide) * swingSpeed;
    if (Math.abs(boat.targetBoomSide - boat.boomSide) < 0.01) boat.boomSide = boat.targetBoomSide;

    let optimalSailAngle = Math.max(0, angleToWind - (Math.PI / 4));
    if (optimalSailAngle > Math.PI/2.2) optimalSailAngle = Math.PI/2.2;

    if (boat.manualTrim && boat.isPlayer) {
        const trimRate = 0.8 * dt;
        if (state.keys.ArrowUp && boat.isPlayer) boat.manualSailAngle = Math.min(Math.PI / 1.5, boat.manualSailAngle + trimRate);
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

    const effectiveWind = localWind.speed * (1.0 - boat.badAirIntensity);
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

    let targetGameSpeed = targetKnots * 0.25;

    // Apply Penalty Speed Reduction
    if (boat.raceState.penalty) {
        targetGameSpeed *= 0.5;
    }

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

    // Smoother speed changes (Higher inertia)
    // 0.995 -> 0.9985 reduces speed decay when drive is lost (gybes/tacks)
    const speedAlpha = 1 - Math.pow(0.9985, timeScale);
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
        // Apply stronger drag deep in irons to maintain tacking difficulty
        // despite higher inertia. Reduced from 0.993 to 0.997 to be less punitive.
        boat.speed *= Math.pow(0.997, timeScale);
    }

    // Rudder drag
    if (boat.isPlayer && (state.keys.ArrowLeft || state.keys.ArrowRight)) {
         boat.speed *= Math.pow(CONFIG.turnPenalty, timeScale);
    }

    const boatDirX = Math.sin(boat.heading);
    const boatDirY = -Math.cos(boat.heading);
    boat.velocity.x = boatDirX * boat.speed;
    boat.velocity.y = boatDirY * boat.speed;

    boat.x += boat.velocity.x * timeScale;
    boat.y += boat.velocity.y * timeScale;

    // Boundary Check
    if (state.course.boundary) {
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
        if (boat.raceState.leg === 1 || boat.raceState.leg === 3) zoneMarks = [2, 3];
        else if (boat.raceState.leg === 2) zoneMarks = [0, 1];

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
                                    boat.raceState.finishTime += boat.raceState.penaltyTimer;
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
                            boat.raceState.finishTime += boat.raceState.penaltyTimer;
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

    // Penalty Timer
    if (boat.raceState.penalty) {
         boat.raceState.penaltyTimer -= dt;
         if (boat.raceState.penaltyTimer <= 0) {
             boat.raceState.penalty = false;
             boat.raceState.penaltyTimer = 0;
             if (boat.isPlayer) hideRaceMessage();
         } else if (boat.isPlayer) {
             // Update countdown message
             showRaceMessage(`PENALTY! SPEED REDUCED: ${boat.raceState.penaltyTimer.toFixed(1)}s`, "text-red-500", "border-red-500/50");
         }
    }

    // Maneuvers Stats
    const relWindAngle = normalizeAngle(state.wind.direction - boat.heading);
    const currentWindSide = Math.sign(relWindAngle);
    if (boat.lastWindSide === undefined) boat.lastWindSide = currentWindSide;
    if (currentWindSide !== 0) {
        if (boat.lastWindSide !== 0 && currentWindSide !== boat.lastWindSide) {
             if (state.race.status === 'racing' && boat.raceState.leg >= 0 && boat.raceState.leg < 5) {
                 boat.raceState.legManeuvers[boat.raceState.leg]++;
             }
        }
        boat.lastWindSide = currentWindSide;
    }

    // Stats
    if (state.race.status === 'racing' && boat.raceState.leg < 5) {
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
                    const rowBoat = getRightOfWay(b1, b2);

                    // Sayings Check
                    let playerBoat = null;
                    let aiBoat = null;
                    if (b1.isPlayer) { playerBoat = b1; aiBoat = b2; }
                    else if (b2.isPlayer) { playerBoat = b2; aiBoat = b1; }

                    if (playerBoat && aiBoat) {
                        if (rowBoat === playerBoat) {
                             if (!aiBoat.raceState.penalty) Sayings.queueQuote(aiBoat, "they_hit_player");
                        } else if (rowBoat === aiBoat) {
                             if (!playerBoat.raceState.penalty) Sayings.queueQuote(aiBoat, "they_were_hit");
                        } else {
                             if (!aiBoat.raceState.penalty) Sayings.queueQuote(aiBoat, "they_hit_player");
                        }
                    }

                    if (rowBoat === b1) triggerPenalty(b2);
                    else if (rowBoat === b2) triggerPenalty(b1);
                    else {
                        triggerPenalty(b1);
                        triggerPenalty(b2);
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

                if (state.race.status === 'racing') triggerPenalty(boat);
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
                         const rowBoat = getRightOfWay(player, ai);
                         if (rowBoat === player) {
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

    // Wind Dynamics (Global)
    // New Model: Base Wind + Shiftiness + Variability
    const cond = state.race.conditions || {};

    // 1. Shiftiness (Directional)
    // Range: 3 to 30 degrees
    const shiftDeg = 3 + (cond.shiftiness || 0) * 27;
    const shiftRad = shiftDeg * (Math.PI / 180);

    // Frequency increases with shiftiness?
    // "Base TWD should always be changing slowly"
    const shiftFreq = 0.05 + (cond.shiftiness || 0) * 0.1;
    const dirNoise = fractalNoise(state.time * shiftFreq);
    state.wind.direction = state.wind.baseDirection + dirNoise * shiftRad;

    // 2. Variability (Speed)
    // Range: 5% to 40%
    // Independent from shiftiness
    const varPct = 0.05 + (cond.variability || 0) * 0.35;
    const varFreq = 0.1 + (cond.variability || 0) * 0.2;
    const speedNoise = fractalNoise(state.time * varFreq + 100); // offset
    const speedMod = 1.0 + speedNoise * varPct;
    state.wind.speed = Math.max(2, state.wind.baseSpeed * speedMod);

    updateGusts(dt);

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
        if (state.race.timer >= 600.0) { // 10 Minute Cutoff
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
        let indices = [0, 1];
        if (state.course.marks && state.course.marks.length >= 2) {
             const m1 = state.course.marks[0], m2 = state.course.marks[1];
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

    // Add Wake for all boats
    if (state.race.status !== 'waiting') {
        for (const boat of state.boats) {
            if (boat.speed > 0.25) {
                const boatDX = Math.sin(boat.heading);
                const boatDY = -Math.cos(boat.heading);
                const sternX = boat.x - boatDX * 30;
                const sternY = boat.y - boatDY * 30;
                const planing = boat.raceState.isPlaning;

                // Base Wake
                let wakeProb = 0.2;
                if (planing) wakeProb = 0.6; // More foam

                if (Math.random() < wakeProb) createParticle(sternX + (Math.random()-0.5)*4, sternY + (Math.random()-0.5)*4, 'wake');

                // V-Wake (Waves)
                let waveProb = 0.25;
                let spread = 0.1;
                let scale = 1.0;
                if (planing) {
                    waveProb = 0.5;
                    spread = 0.2; // Wider V
                    scale = J111_PLANING.wakeLengthScale;
                }

                if (Math.random() < waveProb) {
                    const rightX = Math.cos(boat.heading), rightY = Math.sin(boat.heading);
                    createParticle(sternX - rightX*10, sternY - rightY*10, 'wake-wave', { vx: -rightX*spread, vy: -rightY*spread, scale: scale });
                    createParticle(sternX + rightX*10, sternY + rightY*10, 'wake-wave', { vx: rightX*spread, vy: rightY*spread, scale: scale });

                    // Planing Rooster Tail / Spray
                    if (planing && Math.random() < 0.2) {
                        createParticle(sternX, sternY, 'wake', { life: 1.5, scale: 1.5 });
                    }
                }
            }
        }
    }

    // Wind Particles
    if (Math.random() < 0.2) {
        let range = Math.max(canvas.width, canvas.height) * 1.5;
        createParticle(state.camera.x + (Math.random()-0.5)*range, state.camera.y + (Math.random()-0.5)*range, 'wind', { life: Math.random() + 0.5 });
    }
    updateParticles(dt);
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
            decay = 0.005;
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
        }
        p.life -= decay * timeScale;
        if (p.life <= 0) { state.particles[i] = state.particles[state.particles.length-1]; state.particles.pop(); }
    }
}

function drawParticles(ctx, layer) {
    if (layer === 'surface') {
        ctx.fillStyle = '#ffffff';
        for (const p of state.particles) {
            if (p.type === 'wake' || p.type === 'wake-wave') {
                ctx.globalAlpha = p.alpha;
                const s = p.scaleVal || p.scale || 1.0;
                ctx.beginPath(); ctx.arc(p.x, p.y, 3 * s, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;
    } else if (layer === 'air') {
        ctx.strokeStyle = '#ffffff';
        for (const p of state.particles) {
            if (p.type === 'wind') {
                const local = getWindAt(p.x, p.y);
                const windFactor = local.speed / 10;
                const tailLength = 30 + local.speed * 4;
                const dx = -Math.sin(local.direction) * tailLength;
                const dy = Math.cos(local.direction) * tailLength;

                const opacity = Math.min(p.life, 1.0) * (0.15 + windFactor * 0.2);
                ctx.globalAlpha = opacity;
                ctx.lineWidth = 1 + windFactor;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dx, p.y + dy); ctx.stroke();
            }
        }
        ctx.globalAlpha = 1.0;
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

    // Hull
    const hullColor = boat.isPlayer ? settings.hullColor : boat.colors.hull;
    ctx.fillStyle = hullColor || '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.bezierCurveTo(18, -10, 18, 20, 12, 30);
    ctx.lineTo(-12, 30);
    ctx.bezierCurveTo(-18, 20, -18, -10, 0, -25);
    ctx.fill();
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5; ctx.stroke();

    // Cockpit
    const cockpitColor = boat.isPlayer ? settings.cockpitColor : boat.colors.cockpit;
    ctx.fillStyle = cockpitColor || '#cbd5e1';
    ctx.beginPath(); ctx.roundRect(-8, 10, 16, 15, 4); ctx.fill();

    // Mast
    ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI * 2); ctx.fill();

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

    drawSailFunc(false);
    const progress = boat.spinnakerDeployProgress;
    const jibScale = Math.max(0, 1 - progress * 2);
    const spinScale = Math.max(0, (progress - 0.5) * 2);
    if (jibScale > 0.01) drawSailFunc(true, jibScale);
    if (spinScale > 0.01) drawSpinnaker(spinScale);
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
                const rowBoat = getRightOfWay(b1, b2);
                if (rowBoat) {
                    const winner = rowBoat;
                    const loser = (rowBoat === b1) ? b2 : b1;

                    // Winner (Green) - pointing at Loser
                    drawTriangle(winner, loser, '#4ade80');

                    // Loser (Red) - pointing at Winner
                    drawTriangle(loser, winner, '#ef4444');
                }
            }
        }
    }
}

function drawRoundingArrows(ctx) {
    if (!state.showNavAids || !state.course || !state.course.marks || state.race.status === 'finished') return;

    // Player Leg determines what to show
    const player = state.boats[0];
    let activeMarks = [];
    if (player.raceState.leg === 1 || player.raceState.leg === 3) activeMarks = [{ index: 2, ccw: true }, { index: 3, ccw: false }];
    else if (player.raceState.leg === 2) activeMarks = [{ index: 0, ccw: false }, { index: 1, ccw: true }];
    else return;

    ctx.save();
    ctx.lineWidth = 10; ctx.strokeStyle = '#22d3ee'; ctx.fillStyle = '#22d3ee'; ctx.lineCap = 'round';
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
    if (state.race.status === 'finished' || player.raceState.finished) indices = [0, 1];
    else {
        if (player.raceState.leg !== 0 && player.raceState.leg !== 4) return;
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
    let label = (player.raceState.leg === 0) ? "START" : ((player.raceState.leg === 4 || state.race.status === 'finished' || player.raceState.finished) ? "FINISH" : "");
    if (label) {
        const angle = Math.atan2(m2.y - m1.y, m2.x - m1.x);
        ctx.translate(midX, midY);
        let rot = angle; if (Math.abs(normalizeAngle(rot)) > Math.PI/2) rot += Math.PI;
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

    ctx.save(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 4;
    ctx.font = 'bold 24px monospace'; ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

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
                 ctx.fillText(Math.round(distToGate) + 'm', (x1+x2)/2, (y1+y2)/2);
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

    ctx.save(); ctx.lineWidth = 5;
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
                ctx.strokeStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(startX+dx*t, startY+dy*t); ctx.stroke();
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

    if (player.raceState.leg > 0 && player.raceState.leg <= state.race.totalLegs) {
        if (player.raceState.leg % 2 !== 0) active = [2, 3];
        else active = [0, 1];
    } else return;

    ctx.save(); ctx.lineWidth = 5;
    const h = player.heading, sinH = Math.sin(h), cosH = Math.cos(h);
    const bowX = player.x + 25*sinH, bowY = player.y - 25*cosH;
    const sternX = player.x - 30*sinH, sternY = player.y + 30*cosH;

    for (const idx of active) {
        const m = state.course.marks[idx];
        const closest = getClosestPointOnSegment(m.x, m.y, bowX, bowY, sternX, sternY);
        const distSq = (closest.x-m.x)**2 + (closest.y-m.y)**2;
        ctx.strokeStyle = (distSq < 165*165) ? '#facc15' : 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath(); ctx.arc(m.x, m.y, 165, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
}

// Draw Water (Waves) - Same as original
function drawWater(ctx) {
    const gridSize = 80;
    const dist = state.time * 20;
    const shiftX = -Math.sin(state.wind.direction)*dist, shiftY = Math.cos(state.wind.direction)*dist;
    const pad = gridSize*2;
    const left = state.camera.x - canvas.width/2 - pad, right = state.camera.x + canvas.width/2 + pad;
    const top = state.camera.y - canvas.height/2 - pad, bottom = state.camera.y + canvas.height/2 + pad;
    const startX = Math.floor((left-shiftX)/gridSize)*gridSize, endX = Math.ceil((right-shiftX)/gridSize)*gridSize;
    const startY = Math.floor((top-shiftY)/gridSize)*gridSize, endY = Math.ceil((bottom-shiftY)/gridSize)*gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 2.5;

    ctx.beginPath();
    for (let x = startX; x < endX; x+=gridSize) {
        for (let y = startY; y < endY; y+=gridSize) {
             const cx = x + shiftX + gridSize/2, cy = y + shiftY + gridSize/2;

             // Local Wind Check
             const local = getWindAt(cx, cy);
             const angle = local.direction + Math.PI;
             const cosA = Math.cos(angle), sinA = Math.sin(angle);
             const speedFactor = local.speed / 10;

             const noise = Math.sin(x*0.12+y*0.17);
             const bob = Math.sin(state.time*2+noise*10) * (0.3 + speedFactor);

             const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
             const randX = (seed - Math.floor(seed)) * 40 - 20;
             const randY = (Math.cos(seed) * 0.5 + 0.5) * 40 - 20;
             let scale = (0.8 + ((seed*10)%1)*0.4) * Math.max(0.5, speedFactor);

             const rcx = cx + randX, rcy = cy + randY;
             const p1x = -8*scale, p1y = bob*scale, p2x = 8*scale, p2y = bob*scale;
             const cpx = 0, cpy = (bob-6)*scale;

             const t = (px, py) => ({ x: px*cosA - py*sinA + rcx, y: px*sinA + py*cosA + rcy });
             const tp1 = t(p1x, p1y), tp2 = t(p2x, p2y), tcp = t(cpx, cpy);
             ctx.moveTo(tp1.x, tp1.y); ctx.quadraticCurveTo(tcp.x, tcp.y, tp2.x, tp2.y);
        }
    }
    ctx.stroke();
}

function drawGusts(ctx) {
    for (const g of state.gusts) {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.rotation);

        // Intensity based on strength (speedDelta)
        const strength = Math.min(1.0, Math.abs(g.speedDelta) / (state.wind.baseSpeed * 0.5));
        const alpha = strength * 0.6;

        // Life fade is now handled by radius scaling in updateGusts mostly,
        // but we can add a subtle fade at very edges of life if needed.
        // Actually the prompt says "change color based on strength".

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, g.radiusX);

        // Scale context to make circle an oval
        ctx.scale(1, g.radiusY / g.radiusX);

        // Colors
        if (g.type === 'gust') {
            // Darker/More intense blue for stronger gusts
            grad.addColorStop(0, `rgba(11, 63, 176, ${alpha})`);
            grad.addColorStop(0.5, `rgba(11, 63, 176, ${alpha * 0.5})`);
            grad.addColorStop(1, `rgba(11, 63, 176, 0)`);
        } else {
            // Lighter/More intense cyan for stronger lulls
            // Lulls reduce wind, maybe show as lighter patches
            grad.addColorStop(0, `rgba(92, 201, 255, ${alpha})`);
            grad.addColorStop(0.5, `rgba(92, 201, 255, ${alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(92, 201, 255, 0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, g.radiusX, 0, Math.PI * 2);
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
    for (let i=0; i<state.course.marks.length; i++) {
        const m = state.course.marks[i];
        ctx.save(); ctx.translate(m.x, m.y);
        const bob = 1.0 + Math.sin(state.time*5 + m.x*0.01)*0.05; ctx.scale(bob, bob);

        let active = false;
        if (state.race.status !== 'finished') {
            if (player.raceState.leg % 2 === 0) { if (i===0 || i===1) active = true; }
            else { if (i===2 || i===3) active = true; }
        }

        const c1 = active ? '#fdba74' : '#e2e8f0';
        const c2 = active ? '#f97316' : '#94a3b8';
        const c3 = active ? '#c2410c' : '#64748b';
        const grad = ctx.createRadialGradient(-3, -3, 0, 0, 0, 12);
        grad.addColorStop(0, c1); grad.addColorStop(0.5, c2); grad.addColorStop(1, c3);
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = c3; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
    }
}

function drawBoundary(ctx) {
    const b = state.course.boundary;
    if (!b) return;
    ctx.save(); ctx.translate(b.x, b.y);

    // Glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';

    // Solid thick white line
    ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 80; ctx.setLineDash([]); ctx.stroke();

    ctx.shadowBlur = 0; // Reset for text/images

    // Text & Burgee
    const text = "Salty Critter Yacht Club";
    ctx.font = 'bold 50px sans-serif';
    ctx.textBaseline = 'middle';

    // Measure char by char for curvature
    const charWidths = [];
    let textWidth = 0;
    for (const char of text) {
        const w = ctx.measureText(char).width;
        charWidths.push(w);
        textWidth += w;
    }

    // Image
    const imgH = 40;
    const imgW = imgH * (649 / 462);

    const gap = 60;
    const segmentLen = imgW + gap + textWidth + gap;

    const circumference = 2 * Math.PI * b.radius;
    const count = Math.ceil(circumference / segmentLen);
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
        const angle = i * angleStep;

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

    // Boundary
    const b = state.course.boundary;
    const bp = t(b.x, b.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(bp.x, bp.y, b.radius*scale, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);

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
        const points = totalBoats - index;
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
                img.src = "assets/images/" + boat.name.toLowerCase() + ".png";
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
        const finishTime = formatTime(boat.raceState.finishTime);
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

        updateText('res-time', finishTime);
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
                    img.src = "assets/images/" + boat.name.toLowerCase() + ".png";
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

function draw() {
    frameCount++;
    ctx.fillStyle = CONFIG.waterColor; ctx.fillRect(0, 0, canvas.width, canvas.height);

    const player = state.boats[0];
    if (!player) return;

    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.rotate(-state.camera.rotation);
    ctx.translate(-state.camera.x, -state.camera.y);

    drawGusts(ctx);
    drawWater(ctx);
    drawDisturbedAir(ctx);
    drawParticles(ctx, 'surface');
    drawActiveGateLine(ctx);
    drawLadderLines(ctx);
    drawLayLines(ctx);
    drawMarkZones(ctx);
    drawRoundingArrows(ctx);
    drawBoundary(ctx);
    drawParticles(ctx, 'air');
    drawMarkShadows(ctx);
    drawMarkBodies(ctx);
    drawRulesOverlay(ctx);

    // Draw All Boats
    for (const boat of state.boats) {
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

    ctx.restore();

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

    // Waypoint Arrow
    if (state.race.status !== 'finished' && state.showNavAids) {
        const wx = player.raceState.nextWaypoint.x, wy = player.raceState.nextWaypoint.y;
        const dx = wx - state.camera.x, dy = wy - state.camera.y;
        const rot = -state.camera.rotation;
        const rx = dx*Math.cos(rot) - dy*Math.sin(rot);
        const ry = dx*Math.sin(rot) + dy*Math.cos(rot);

        const m = 40, hw = Math.max(10, canvas.width/2-m), hh = Math.max(10, canvas.height/2-m);
        let t = 1.0;
        if (Math.abs(rx)>0.1 || Math.abs(ry)>0.1) t = Math.min(hw/Math.abs(rx), hh/Math.abs(ry));
        const f = Math.min(t, 1.0);

        ctx.save();
        ctx.translate(canvas.width/2 + rx*f, canvas.height/2 + ry*f);
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fillStyle = '#22c55e'; ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
        ctx.fillText(Math.round(player.raceState.nextWaypoint.dist) + 'm', 0, -12);
        ctx.restore();
    }

    drawMinimap();

    // UI Updates (Player Data)
    const localWind = getWindAt(player.x, player.y);

    if (UI.compassRose) UI.compassRose.style.transform = `rotate(${-state.camera.rotation}rad)`;
    if (UI.windArrow) UI.windArrow.style.transform = `rotate(${localWind.direction}rad)`;
    if (UI.waypointArrow) UI.waypointArrow.style.transform = `rotate(${player.raceState.nextWaypoint.angle}rad)`;
    if (UI.headingArrow) UI.headingArrow.style.transform = `rotate(${player.heading - state.camera.rotation}rad)`;

    if (frameCount % 10 === 0) {
        updateLeaderboard();

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
        if (UI.windAngle) UI.windAngle.textContent = Math.round(Math.abs(normalizeAngle(player.heading - localWind.direction))*(180/Math.PI)) + '°';
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
             let txt = "";
             if (state.race.status === 'prestart') txt = "PRESTART";
             else if (state.race.status === 'finished' || player.raceState.finished) txt = "FINISHED";
             else txt = (player.raceState.leg === 0) ? "START" : `LEG ${player.raceState.leg} OF ${state.race.totalLegs}: ${(player.raceState.leg%2!==0)?"UPWIND":"DOWNWIND"}`;
             UI.legInfo.textContent = txt;
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

        const step = Math.min(dt, 0.1);
        for (let i = 0; i < iterations; i++) {
            update(step);
        }
        draw();
    }
    requestAnimationFrame(loop);
}

// Init
function initCourse() {
    const d = state.wind.baseDirection, ux = Math.sin(d), uy = -Math.cos(d), rx = -uy, ry = ux;
    const w = 550;
    const dist = state.race.legLength || 4000;
    state.course = {
        marks: [
            { x: -rx*w/2, y: -ry*w/2, type: 'start' }, { x: rx*w/2, y: ry*w/2, type: 'start' },
            { x: ux*dist - rx*w/2, y: uy*dist - ry*w/2, type: 'mark' }, { x: ux*dist + rx*w/2, y: uy*dist + ry*w/2, type: 'mark' }
        ],
        boundary: { x: ux*dist/2, y: uy*dist/2, radius: Math.max(3500, dist + 500) } // Adjust boundary for long courses
    };
}

function resetGame() {
    loadSettings();
    if (UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
    state.camera.target = 'boat';
    state.wind.baseSpeed = 8 + Math.random()*10;
    state.wind.speed = state.wind.baseSpeed;
    state.wind.baseDirection = Math.random() * Math.PI * 2;
    state.wind.direction = state.wind.baseDirection;
    state.gusts = [];

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

    state.race.conditions = {
        shiftiness,
        variability,
        puffiness,
        gustStrengthBias,
        puffShiftiness,
        directionBias
    };
    state.time = 0;
    state.race.status = 'waiting'; // Wait for user to start

    // Defaults for Race Config (can be overridden by UI)
    state.race.legLength = 3200; // 3200 units = 640m. User wanted 100-2000m slider.
    // Wait, existing UI says "3200m" but code used 4000 units?
    // 4000 units * 0.2m/unit = 800m. 4 legs = 3200m. Correct.
    // So legLength default 4000.
    state.race.legLength = 4000;
    state.race.totalLegs = 4;
    state.race.startTimerDuration = 30.0;

    state.race.timer = state.race.startTimerDuration;

    initCourse();

    // Pre-populate gusts
    const density = 5 + Math.floor(puffiness * 20);
    for (let i = 0; i < density; i++) {
        spawnGlobalGust(true);
    }

    state.boats = [];
    if (UI.lbRows) UI.lbRows.innerHTML = '';
    UI.boatRows = {};
    if (UI.resultsList) UI.resultsList.innerHTML = '';
    UI.resultRows = {};

    // Calculate Start Line Positions
    // Spawn at 400 units to allow horizontal spread but close enough to reach parking
    const distBack = 400;

    // Wind Vectors
    const wd = state.wind.direction;
    const ux = Math.sin(wd);
    const uy = -Math.cos(wd);

    // Downwind Vector (Back from line)
    const backX = -ux;
    const backY = -uy;

    // Right Vector (Crosswind)
    const rx = -uy;
    const ry = ux;

    // Start Line Center
    const m0 = state.course.marks[0];
    const m1 = state.course.marks[1];
    const cx = (m0.x + m1.x) / 2;
    const cy = (m0.y + m1.y) / 2;

    // Center of Boat Line
    const lineCx = cx + backX * distBack;
    const lineCy = cy + backY * distBack;

    // Width Calculation
    // Start Width
    const startWidth = Math.sqrt((m1.x - m0.x)**2 + (m1.y - m0.y)**2);
    // Layline width at distance: StartWidth + 2 * Distance (assuming 45 deg laylines)
    const totalWidth = startWidth + 2 * distBack;

    // Generate Evenly Spaced Positions
    const totalBoats = 10; // Player + 9 AI
    const positions = [];
    const step = totalWidth / (totalBoats - 1);
    const startOffset = -totalWidth / 2;

    for (let i = 0; i < totalBoats; i++) {
        const offset = startOffset + i * step;
        positions.push({
            x: lineCx + rx * offset,
            y: lineCy + ry * offset
        });
    }

    // Shuffle Positions (Fisher-Yates)
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    let posIndex = 0;

    // Create Player
    const pPos = positions[posIndex++];
    const player = new Boat(0, true, pPos.x, pPos.y, "Player");
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

    for (let i = 0; i < opponents.length; i++) {
        const config = opponents[i];
        const pos = positions[posIndex++];

        // Add vertical scatter to prevent line-abreast collision issues
        // Move some further back, some closer
        const scatter = (Math.random() - 0.5) * 100;
        const downwind = state.wind.direction + Math.PI;
        const sx = pos.x + Math.sin(downwind) * scatter;
        const sy = pos.y - Math.cos(downwind) * scatter;

        const ai = new Boat(i + 1, false, sx, sy, config.name, config);

        // Start on Starboard Tack (Close Hauled) to be ready to move
        // Instead of Irons (Head to Wind)
        ai.heading = normalizeAngle(state.wind.direction + Math.PI / 4);
        ai.prevHeading = ai.heading;
        ai.lastWindSide = 0;
        ai.speed = 0.5; // Initial speed (moving slightly)

        // Basic Start Setup
        ai.ai.startLinePct = 0.1 + Math.random() * 0.8;
        ai.ai.setupDist = 250 + Math.random() * 100;

        state.boats.push(ai);
    }

    state.particles = [];
    hideRaceMessage();

    setupPreRaceOverlay();

    if (settings.soundEnabled || settings.musicEnabled) Sound.init();
    else Sound.updateMusic();
}

function restartRace() { resetGame(); togglePause(false); }

resetGame();
requestAnimationFrame(loop);
window.state = state; window.UI = UI; window.updateLeaderboard = updateLeaderboard;
