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
        
        // Staggered updates
        this.updateTimer = Math.random() * 0.2; 
    }

    update(dt) {
        this.updateTimer -= dt;
        if (this.updateTimer > 0) return;
        this.updateTimer = 0.1; // 10Hz updates

        const isRacing = state.race.status === 'racing';
        const isPrestart = state.race.status === 'prestart';

        // Liveness Watchdog
        if (isRacing && this.boat.raceState.leg === 0) {
            const timeSinceStart = state.race.timer;

            // Velocity Check (Hysteresis)
            if (this.boat.speed * 4 < 1.0) {
                this.lowSpeedTimer += dt;
            } else if (this.boat.speed * 4 > 2.5) { // Only reset if truly moving fast
                this.lowSpeedTimer = 0;
            }

            const prevState = this.livenessState;
            if (timeSinceStart > 45 || this.lowSpeedTimer > 10.0) {
                this.livenessState = 'force';
            } else if (timeSinceStart > 15 || this.lowSpeedTimer > 5.0) { // Reduced timer or Stuck
                this.livenessState = 'recovery';
            } else {
                this.livenessState = 'normal';
            }

            if (prevState !== this.livenessState) {
                console.log(`[AI] ${this.boat.name} transition: ${prevState} -> ${this.livenessState} (T=${timeSinceStart.toFixed(1)}, LowSpd=${this.lowSpeedTimer.toFixed(1)})`);
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

        // Apply
        this.targetHeading = desiredHeading;
        this.speedLimit = speedRequest;
    }

    getNavigationTarget() {
        const boat = this.boat;
        const marks = state.course.marks;
        if (!marks || marks.length < 2) return { x: boat.x + 1000, y: boat.y }; // Fallback

        if (boat.raceState.finished) {
            // Sail to boundary or away
            const b = state.course.boundary;
            if (b) {
                const angle = Math.atan2(b.y - boat.y, b.x - boat.x);
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
                // Must go DOWNWIND to clear line
                // Always target the extensions to avoid crushing, even in normal mode if we are lost
                const d0 = (boat.x - m1.x)**2 + (boat.y - m1.y)**2;
                const d1 = (boat.x - m2.x)**2 + (boat.y - m2.y)**2;
                const nearest = (d0 < d1) ? m1 : m2;

                const lineLen = Math.sqrt(lineDx*lineDx + lineDy*lineDy);
                const ux = lineDx/lineLen, uy = lineDy/lineLen;
                const sign = (nearest === m1) ? -1 : 1;

                // Normal mode: milder return. Force/Recovery: aggressive wide return.
                const width = (this.livenessState === 'normal') ? 50 : 150;

                targetX = nearest.x + (sign * ux * width) - (Math.sin(wd) * 150);
                targetY = nearest.y + (sign * uy * width) + (Math.cos(wd) * 150);
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
            // Aim 80 units outside the mark to allow turn radius
            const dx = mark.x - (m1.x+m2.x)/2;
            const dy = mark.y - (m1.y+m2.y)/2;
            const len = Math.sqrt(dx*dx+dy*dy);
            if (len > 0) {
                targetX = mark.x + (dx/len) * 50;
                targetY = mark.y + (dy/len) * 50;
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
        const optTWA = (mode === 'upwind') ? (45 * Math.PI/180) : (150 * Math.PI/180);
        
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

    applyAvoidance(desiredHeading, speedRequest) {
        // If stuck (Wiggle Mode), ignore avoidance to force breakout
        if (this.wiggleActive) return desiredHeading;

        const boat = this.boat;
        const lookaheadFrames = 120; // 2 seconds lookahead
        const speed = Math.max(2.0, boat.speed * 60); // Minimum speed for projection
        
        // Candidates: more granular to find gaps
        const candidates = [
            0, 
            0.1, -0.1, 
            0.2, -0.2, 
            0.4, -0.4, 
            0.6, -0.6,
            0.8, -0.8,
            1.2, -1.2 
        ];

        let bestHeading = desiredHeading;
        let minCost = Infinity;

        // Dynamic Safe Distance based on Liveness
        let safeDist = 80; // 40 radius * 2 (Normal)
        if (this.livenessState === 'recovery') safeDist = 50;
        if (this.livenessState === 'force') safeDist = 20;

        for (const offset of candidates) {
            const h = normalizeAngle(desiredHeading + offset);
            
            // Base Cost: Deviation from desired course
            // Non-linear cost to strongly prefer small deviations
            let cost = Math.pow(Math.abs(offset), 1.5) * 10; 

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
                
                const ovx = other.velocity.x * 60;
                const ovy = other.velocity.y * 60;

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
                        const row = getRightOfWay(boat, other);
                        if (row === other) ruleViolation = true;
                    } else if (distSq < 200 * 200 && this.livenessState === 'normal') {
                        // Soft avoidance (Proximity)
                        proximityCost += 5000 / distSq; 
                    }
                }
            }

            // 2. Marks
            if (state.course.marks) {
                for (const m of state.course.marks) {
                    // Check path
                    for (const p of points) {
                        const dSq = (p.x - m.x)**2 + (p.y - m.y)**2;
                        if (dSq < 60*60) { // Mark radius 12 + boat + margin
                            staticCollision = true;
                        } else if (dSq < 150*150 && this.livenessState === 'normal') {
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
    showApparentWind: false,
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

const J111_AWS_POLARS = {"aws": [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40], "awa": [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180], "speeds": {"jib": [[0.0, 0.0, 0.0, 0.0, 0.0, 1.12, 1.18, 2.34, 2.45, 3.62, 3.74, 3.92, 4.86, 4.85, 4.83, 4.66, 4.64, 4.81, 4.34, 4.31, 4.25, 4.22, 4.18, 4.18, 4.19, 4.48, 4.51, 4.55, 4.59, 4.03, 3.67, 3.67, 3.93, 3.9, 3.87, 3.84, 3.83], [0.0, 0.0, 0.0, 0.0, 0.0, 1.03, 1.11, 2.18, 2.36, 3.58, 3.77, 3.92, 5.28, 4.86, 4.84, 4.81, 4.8, 4.76, 4.76, 4.57, 4.56, 4.22, 4.14, 4.09, 4.27, 4.36, 4.47, 4.55, 4.61, 4.65, 3.68, 3.97, 3.94, 3.9, 3.82, 3.71, 3.61], [0.0, 0.0, 0.0, 0.0, 0.0, 0.88, 1.79, 1.99, 2.3, 2.6, 3.86, 5.22, 5.25, 5.21, 5.17, 4.84, 4.82, 4.71, 4.48, 4.57, 4.66, 4.63, 4.18, 4.22, 4.17, 4.42, 4.58, 4.66, 4.7, 4.72, 4.79, 4.03, 4.01, 3.99, 3.95, 3.87, 3.81], [0.0, 0.0, 0.0, 0.0, 0.84, 1.33, 0.0, 1.62, 2.47, 4.02, 5.43, 5.26, 5.15, 5.16, 5.15, 5.29, 5.33, 4.93, 5.15, 5.24, 5.43, 5.51, 5.2, 4.7, 4.81, 5.12, 5.27, 5.32, 5.35, 5.36, 5.37, 4.72, 4.6, 4.6, 4.59, 4.58, 4.57], [0.0, 0.56, 0.99, 2.54, 3.54, 1.99, 0.0, 2.45, 4.32, 5.03, 5.56, 5.77, 5.9, 6.09, 6.37, 6.36, 6.52, 6.53, 6.11, 6.1, 6.2, 6.29, 6.29, 6.09, 5.41, 5.52, 5.76, 5.82, 5.84, 5.85, 5.85, 5.63, 5.07, 5.07, 5.07, 5.08, 5.09], [0.0, 0.65, 1.25, 4.07, 4.36, 4.55, 0.0, 3.97, 5.89, 6.14, 6.38, 6.48, 6.95, 7.05, 7.1, 7.26, 7.28, 7.41, 7.21, 7.12, 6.71, 6.81, 6.83, 6.78, 6.25, 6.18, 6.01, 6.25, 6.29, 6.33, 6.35, 5.83, 5.58, 5.57, 5.55, 5.54, 5.55], [0.0, 0.74, 1.38, 5.42, 4.51, 4.39, 0.0, 4.82, 5.88, 7.11, 7.36, 7.54, 7.48, 7.77, 7.78, 7.86, 7.81, 7.84, 7.88, 7.64, 7.5, 7.25, 7.31, 7.27, 6.74, 6.74, 6.68, 6.5, 6.51, 6.5, 6.65, 6.55, 6.21, 5.73, 5.78, 5.84, 5.89], [0.0, 0.75, 1.4, 6.3, 4.96, 4.44, 0.0, 4.69, 6.27, 7.9, 8.13, 8.34, 8.44, 8.34, 8.31, 8.28, 8.29, 8.24, 8.23, 8.18, 7.97, 7.79, 7.84, 7.74, 7.56, 7.43, 7.37, 7.42, 7.15, 7.08, 7.05, 7.14, 6.75, 6.31, 6.35, 6.42, 6.49], [0.0, 0.94, 3.03, 5.58, 5.84, 5.86, 0.0, 5.7, 7.93, 8.24, 8.47, 8.84, 8.89, 8.93, 8.79, 8.69, 8.65, 8.69, 8.99, 8.8, 8.52, 8.42, 8.48, 8.23, 8.27, 8.17, 8.07, 7.62, 7.61, 7.6, 7.42, 7.42, 7.35, 7.29, 6.94, 6.96, 6.98], [1.04, 1.36, 3.35, 7.25, 7.35, 6.89, 7.82, 8.11, 8.36, 8.57, 8.84, 9.0, 9.22, 9.27, 9.26, 9.37, 9.43, 9.27, 9.43, 9.44, 9.24, 9.17, 9.1, 8.78, 8.45, 8.34, 8.22, 8.16, 8.15, 8.19, 7.92, 7.88, 7.53, 7.48, 7.44, 7.39, 7.26], [0.0, 2.09, 4.84, 5.94, 6.03, 6.18, 0.0, 6.83, 8.66, 8.88, 9.05, 9.33, 9.44, 9.68, 9.72, 9.94, 9.85, 9.85, 9.87, 9.88, 9.62, 9.53, 9.4, 9.13, 8.98, 8.87, 8.74, 8.63, 8.6, 8.31, 8.11, 8.06, 8.0, 7.93, 7.87, 7.66, 7.67], [2.41, 2.92, 3.75, 7.82, 7.82, 7.84, 8.17, 8.59, 8.78, 8.85, 9.52, 9.71, 10.03, 10.07, 10.13, 10.21, 10.2, 10.2, 10.04, 10.11, 9.95, 9.84, 9.79, 9.44, 9.39, 9.01, 8.9, 8.81, 8.8, 8.81, 8.55, 8.51, 8.06, 8.13, 8.08, 8.04, 7.97], [0.91, 1.29, 3.43, 4.14, 5.99, 5.72, 5.32, 5.75, 6.89, 9.4, 9.85, 9.9, 10.21, 10.45, 10.48, 10.49, 10.47, 10.49, 10.5, 10.51, 10.29, 10.23, 9.92, 9.83, 9.68, 9.56, 9.41, 9.25, 8.91, 8.92, 8.65, 8.7, 8.64, 8.58, 8.2, 8.27, 8.27], [0.93, 1.32, 3.56, 4.33, 6.38, 6.35, 6.32, 7.43, 8.57, 9.49, 9.89, 10.24, 10.53, 10.64, 10.64, 10.81, 10.84, 10.83, 10.68, 10.69, 10.68, 10.57, 10.44, 10.1, 10.04, 9.66, 9.56, 9.47, 9.42, 9.41, 9.17, 8.78, 8.71, 8.77, 8.72, 8.68, 8.65], [1.26, 1.54, 2.01, 4.57, 6.68, 6.89, 7.07, 7.22, 9.03, 9.54, 10.13, 10.4, 10.53, 10.92, 11.07, 11.09, 10.94, 11.1, 11.06, 10.99, 10.94, 10.91, 10.61, 10.53, 10.27, 10.06, 9.89, 9.73, 9.5, 9.53, 9.56, 9.34, 9.28, 9.22, 8.84, 8.82, 8.8], [0.0, 0.0, 3.13, 3.76, 5.63, 4.59, 0.0, 5.67, 7.38, 8.43, 10.06, 10.61, 10.76, 10.91, 11.15, 11.17, 11.41, 11.46, 11.3, 11.32, 11.34, 11.1, 10.96, 10.86, 10.68, 10.3, 10.22, 10.12, 10.06, 10.04, 9.76, 9.42, 9.36, 9.3, 9.25, 9.24, 9.15], [1.27, 1.54, 2.02, 4.65, 5.22, 7.38, 8.01, 9.19, 9.51, 9.83, 10.23, 10.79, 10.96, 11.25, 11.57, 11.54, 11.59, 11.61, 11.64, 11.64, 11.59, 11.57, 11.29, 11.21, 10.88, 10.8, 10.37, 10.21, 10.06, 10.09, 9.95, 9.89, 9.41, 9.35, 9.31, 9.28, 9.27], [0.89, 1.24, 1.76, 4.01, 5.93, 5.58, 5.19, 5.99, 7.15, 10.31, 10.46, 10.93, 11.25, 11.41, 11.68, 11.73, 12.01, 11.97, 11.92, 11.94, 11.96, 11.73, 11.63, 11.5, 11.16, 10.98, 10.86, 10.73, 10.25, 10.21, 9.99, 9.93, 9.88, 9.38, 9.34, 9.32, 9.3], [0.91, 1.28, 1.83, 4.21, 6.37, 6.11, 6.05, 7.08, 8.46, 10.33, 10.36, 10.92, 11.33, 11.74, 11.88, 12.03, 12.16, 12.23, 12.24, 12.22, 12.1, 12.04, 11.95, 11.79, 11.46, 11.35, 11.1, 10.87, 10.81, 10.58, 10.01, 9.97, 9.92, 9.88, 9.69, 9.65, 9.32], [1.26, 1.53, 1.98, 4.6, 5.06, 7.21, 7.7, 8.05, 9.7, 9.81, 10.42, 11.13, 11.48, 11.65, 12.11, 12.32, 12.36, 12.46, 12.39, 12.35, 12.27, 12.05, 11.98, 11.93, 11.56, 11.47, 11.39, 11.33, 11.28, 10.64, 10.58, 10.53, 9.95, 9.92, 9.74, 9.71, 9.68], [0.0, 0.99, 3.18, 3.82, 5.77, 4.63, 0.0, 5.29, 7.54, 8.85, 10.88, 11.45, 11.72, 11.94, 12.11, 12.41, 12.42, 12.43, 12.5, 12.48, 12.46, 12.45, 12.19, 11.95, 11.59, 11.52, 11.46, 11.41, 11.37, 11.33, 10.63, 10.58, 10.54, 10.5, 9.77, 9.74, 9.72]], "spinnaker": [[0.1, 0.11, 0.11, 0.34, 0.35, 0.37, 0.7, 0.72, 0.73, 1.71, 4.23, 4.88, 5.66, 5.66, 5.5, 5.48, 5.55, 5.53, 5.5, 5.57, 5.59, 6.02, 6.1, 6.17, 6.23, 6.27, 6.31, 6.33, 6.14, 5.34, 5.33, 5.3, 5.27, 5.22, 5.16, 5.09, 5.05], [0.0, 0.0, 0.11, 0.12, 0.34, 0.36, 0.68, 0.7, 0.72, 0.75, 3.46, 4.88, 5.64, 5.64, 5.65, 5.51, 5.49, 5.53, 5.45, 5.41, 5.4, 5.87, 6.08, 6.21, 6.3, 6.35, 6.38, 7.16, 7.18, 5.64, 5.37, 5.35, 5.32, 5.27, 5.18, 4.98, 4.04], [0.0, 0.0, 0.0, 0.11, 0.12, 0.33, 0.61, 0.66, 0.73, 1.24, 4.01, 4.22, 4.98, 5.66, 5.61, 5.69, 5.89, 5.99, 5.57, 5.73, 5.84, 6.02, 6.33, 6.46, 7.13, 7.19, 7.22, 7.81, 7.83, 7.59, 5.42, 5.43, 5.44, 5.45, 5.48, 5.56, 6.0], [0.0, 0.0, 0.0, 0.0, 0.29, 0.26, 0.0, 0.6, 1.15, 1.79, 2.95, 4.29, 5.34, 5.73, 6.0, 6.09, 6.61, 6.99, 7.14, 7.28, 6.37, 6.59, 7.16, 7.38, 7.75, 7.82, 7.86, 7.88, 7.89, 7.79, 6.91, 6.75, 6.75, 6.74, 6.74, 6.73, 6.71], [0.0, 0.0, 0.0, 0.0, 0.13, 0.12, 0.0, 0.63, 1.08, 3.2, 3.77, 4.52, 5.96, 6.85, 6.99, 7.35, 7.71, 7.92, 8.17, 8.52, 8.15, 7.98, 7.81, 7.9, 8.06, 8.03, 8.44, 8.51, 8.55, 8.57, 7.8, 7.45, 7.44, 7.42, 7.4, 7.36, 7.36], [0.0, 0.0, 0.0, 0.0, 0.14, 0.14, 0.0, 0.73, 1.28, 3.18, 4.34, 4.1, 5.92, 7.91, 8.29, 8.49, 8.61, 8.79, 8.84, 8.85, 8.85, 8.85, 8.76, 8.53, 8.58, 8.62, 8.69, 8.71, 8.71, 8.69, 8.77, 8.3, 7.58, 7.63, 7.7, 7.81, 7.89], [0.0, 0.0, 0.0, 0.0, 0.16, 0.15, 0.0, 0.69, 1.49, 3.08, 4.25, 4.89, 6.62, 7.91, 8.7, 8.97, 9.15, 9.26, 9.3, 9.48, 9.54, 9.69, 9.78, 9.68, 9.27, 9.69, 9.61, 9.5, 9.47, 9.47, 9.6, 9.03, 8.38, 8.42, 8.47, 8.55, 8.61], [0.0, 0.0, 0.0, 0.0, 0.18, 0.17, 0.0, 0.79, 1.7, 2.43, 4.59, 5.73, 6.03, 7.76, 9.19, 9.38, 9.51, 9.58, 9.78, 9.94, 10.18, 10.31, 10.5, 10.31, 10.13, 10.11, 10.12, 10.14, 10.27, 10.29, 9.96, 9.88, 9.93, 9.26, 9.3, 9.35, 9.39], [0.0, 0.0, 0.0, 0.0, 0.39, 0.35, 0.0, 0.89, 1.91, 2.7, 4.17, 6.4, 6.58, 7.87, 8.64, 9.74, 9.91, 10.09, 10.41, 10.79, 10.85, 10.85, 10.93, 10.9, 10.85, 10.81, 10.89, 10.91, 10.95, 10.67, 10.62, 10.69, 10.04, 9.99, 9.53, 9.6, 9.65], [0.0, 0.0, 0.0, 0.0, 0.63, 0.65, 0.74, 1.55, 2.36, 3.04, 3.96, 6.73, 7.24, 7.44, 8.96, 10.39, 10.56, 10.89, 11.19, 11.3, 11.36, 11.46, 11.41, 11.38, 11.3, 11.47, 11.09, 11.1, 11.11, 10.95, 10.86, 10.77, 10.69, 10.74, 10.3, 10.33, 10.35], [0.0, 0.0, 0.2, 0.25, 0.7, 0.73, 0.0, 1.08, 1.59, 2.68, 5.32, 6.49, 7.99, 8.96, 9.33, 10.6, 11.15, 11.28, 11.38, 11.44, 11.76, 11.79, 11.9, 11.77, 11.74, 11.69, 11.67, 11.76, 11.78, 11.53, 11.48, 11.2, 10.93, 10.88, 10.83, 10.84, 10.78], [0.0, 0.0, 0.0, 0.0, 0.8, 0.85, 1.6, 1.82, 2.64, 3.31, 4.36, 6.44, 7.46, 8.57, 9.74, 10.08, 11.31, 11.43, 11.78, 11.98, 11.95, 12.21, 12.19, 12.19, 12.2, 12.12, 12.06, 11.93, 11.95, 11.96, 11.74, 11.66, 11.57, 11.46, 11.16, 11.19, 11.21], [0.0, 0.0, 0.22, 0.27, 0.52, 0.88, 0.83, 1.52, 1.91, 3.34, 5.78, 6.38, 7.01, 8.42, 9.89, 10.32, 11.64, 11.85, 12.03, 12.15, 12.22, 12.59, 12.62, 12.74, 12.6, 12.56, 12.53, 12.53, 12.53, 12.53, 12.34, 12.08, 11.82, 11.76, 11.7, 11.65, 11.47], [0.0, 0.0, 0.23, 0.29, 0.83, 0.82, 1.32, 1.49, 1.97, 3.15, 4.59, 6.8, 7.44, 8.95, 10.09, 10.68, 11.93, 12.06, 12.31, 12.63, 12.72, 12.82, 12.95, 13.01, 13.07, 13.0, 12.93, 12.77, 12.78, 12.8, 12.63, 12.53, 12.45, 12.37, 11.9, 11.92, 11.94], [0.0, 0.0, 0.0, 0.0, 0.85, 0.88, 0.99, 2.05, 3.29, 3.8, 5.13, 6.45, 7.29, 8.47, 9.56, 10.67, 11.38, 12.39, 12.53, 12.86, 12.96, 13.05, 13.43, 13.46, 13.46, 13.42, 13.39, 13.37, 13.36, 13.34, 13.02, 12.63, 12.54, 12.46, 12.41, 12.38, 12.31], [0.0, 0.0, 0.0, 0.78, 0.82, 1.02, 0.0, 1.42, 1.89, 3.36, 3.62, 6.0, 7.91, 9.48, 9.65, 10.81, 12.61, 12.7, 12.96, 13.14, 13.38, 13.48, 13.62, 13.8, 13.79, 13.6, 13.52, 13.47, 13.45, 13.43, 13.22, 13.15, 12.59, 12.52, 12.47, 12.43, 12.41], [0.0, 0.0, 0.0, 0.0, 0.95, 1.0, 1.15, 2.07, 3.05, 3.6, 4.98, 5.53, 7.83, 9.03, 10.91, 11.27, 11.82, 12.85, 13.28, 13.35, 13.7, 13.8, 13.94, 14.13, 13.99, 13.84, 13.75, 13.56, 13.51, 13.48, 13.26, 13.2, 13.14, 12.56, 12.52, 12.48, 12.46], [0.0, 0.0, 0.0, 0.31, 0.62, 1.06, 1.01, 1.87, 2.41, 4.06, 5.29, 6.76, 7.47, 9.15, 10.84, 11.24, 11.61, 13.25, 13.58, 13.75, 13.91, 13.92, 13.92, 13.94, 13.99, 13.96, 13.93, 13.88, 13.85, 13.84, 13.28, 13.23, 13.19, 13.14, 12.88, 12.83, 12.49], [0.0, 0.0, 0.27, 0.34, 0.39, 0.94, 1.5, 1.76, 2.18, 3.59, 3.96, 6.34, 8.87, 9.4, 10.68, 11.74, 13.29, 13.49, 13.63, 13.77, 13.98, 14.03, 14.0, 13.99, 14.05, 14.04, 14.02, 14.0, 13.9, 13.87, 13.64, 13.59, 13.21, 13.18, 12.93, 12.89, 12.86], [0.0, 0.0, 0.0, 0.0, 1.01, 1.05, 1.19, 2.39, 3.71, 4.39, 5.5, 6.05, 8.12, 8.66, 10.62, 11.81, 12.19, 12.96, 13.76, 13.69, 13.67, 13.96, 13.96, 13.96, 13.97, 13.97, 14.02, 14.0, 13.99, 13.98, 13.66, 13.62, 13.59, 13.56, 13.53, 12.93, 12.9], [0.0, 0.17, 0.28, 0.61, 0.64, 1.18, 0.0, 1.67, 2.28, 4.12, 4.5, 5.96, 8.82, 9.94, 10.83, 11.93, 12.13, 12.31, 13.44, 13.49, 13.52, 13.53, 13.68, 13.91, 13.95, 13.95, 14.01, 14.01, 14.0, 13.99, 13.98, 13.98, 13.62, 13.59, 13.56, 13.54, 12.93]]}};

// Physics Helper Functions
function getApparentWind(boat, trueWind) {
    // True Wind Components (From -> To)
    // TWS vector: points in direction wind is blowing.
    // If wind direction is 0 (N), it blows S (0, 1) in canvas coords.
    // True Wind Vector T: (sin(wd)*speed, -cos(wd)*speed)
    const twX = Math.sin(trueWind.direction) * trueWind.speed;
    const twY = -Math.cos(trueWind.direction) * trueWind.speed;

    // Boat Velocity Vector B: (vx, vy)
    const bX = boat.velocity.x;
    const bY = boat.velocity.y;

    // Apparent Wind Vector A = T - B
    const awX = twX - bX;
    const awY = twY - bY;

    // AWS
    const aws = Math.sqrt(awX * awX + awY * awY);

    // AWD (Global Direction)
    // atan2(x, -y) matches standard "0 is Up/North" logic if y is down
    const awd = Math.atan2(awX, -awY);

    return { speed: aws, direction: awd };
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
            legSpeedSums: [0, 0, 0, 0, 0]
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
    const baseSpeed = state.wind.speed;
    const windDir = state.wind.direction;

    // Varied size and shape
    const maxRadiusX = 300 + Math.random() * 1200;
    const maxRadiusY = 150 + Math.random() * 600;

    let speedDelta = 0;
    let dirDelta = 0;

    // Apply Biases
    const sBias = conditions.strengthBias || 1.0;
    const dBias = conditions.dirBias || 0;

    // Directional variance: Triangular distribution (-1 to 1) peaked at 0
    // Scaled to max 30 degrees (approx 0.52 rad)
    const dirNoise = (Math.random() - Math.random()) * (30 * Math.PI / 180) * conditions.shiftiness;
    dirDelta = dirNoise + dBias;

    if (type === 'gust') {
        speedDelta = baseSpeed * (0.2 + conditions.gustiness * 0.4) * sBias;
    } else {
        speedDelta = -baseSpeed * (0.2 + conditions.gustiness * 0.3) * sBias;
    }

    const moveSpeed = baseSpeed * (0.8 + Math.random() * 0.4) * 0.1;
    const moveDir = windDir + (Math.random() - 0.5) * 0.2;
    // Move with the wind (Downwind)
    // Wind Dir 0 (North) -> Blows South (+Y)
    // Particle motion: x -= sin(dir), y += cos(dir)
    const vx = -Math.sin(moveDir) * moveSpeed;
    const vy = Math.cos(moveDir) * moveSpeed;

    const duration = 30 + Math.random() * 60;
    const age = initial ? Math.random() * duration : 0;

    return {
        type, x, y, vx, vy,
        maxRadiusX, maxRadiusY,
        radiusX: 10, radiusY: 10, // Start small, will update in first frame
        rotation: windDir + Math.PI / 2,
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
    const prob = conditions.gustProb !== undefined ? conditions.gustProb : 0.5;
    const type = Math.random() < prob ? 'gust' : 'lull';

    state.gusts.push(createGust(gx, gy, type, initial));
}

function updateGusts(dt) {
    const conditions = state.race.conditions;
    const targetCount = conditions.density || 8;
    const boundary = state.course.boundary;

    // Maintain density
    if (boundary) {
        while (state.gusts.length < targetCount) {
            spawnGlobalGust();
        }
    }

    const timeScale = dt * 60;
    for (let i = state.gusts.length - 1; i >= 0; i--) {
        const g = state.gusts[i];

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
    let speed = state.wind.speed;
    const windDir = state.wind.direction;
    let dirX = Math.sin(windDir);
    let dirY = -Math.cos(windDir);

    let sumWx = dirX * speed;
    let sumWy = dirY * speed;

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
                 const gwDir = windDir + g.dirDelta;
                 sumWx += Math.sin(gwDir) * gSpeed;
                 sumWy += -Math.cos(gwDir) * gSpeed;
            }
        }
    }

    const finalSpeed = Math.sqrt(sumWx*sumWx + sumWy*sumWy);
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
    windSpeedLabel: document.getElementById('hud-wind-speed-label'),
    windAngle: document.getElementById('hud-wind-angle'),
    windAngleLabel: document.getElementById('hud-wind-angle-label'),
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
    settingApparentWind: document.getElementById('setting-apparent-wind'),
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
    prWindSpeed: document.getElementById('pr-wind-speed'),
    prWindDir: document.getElementById('pr-wind-dir'),
    prWindVar: document.getElementById('pr-wind-var'),
    prCompetitorsGrid: document.getElementById('pr-competitors-grid'),
    startRaceBtn: document.getElementById('start-race-btn'),
    boatRows: {}
};

function setupPreRaceOverlay() {
    if (!UI.preRaceOverlay) return;

    // Show Overlay
    UI.preRaceOverlay.classList.remove('hidden');
    UI.preRaceOverlay.querySelectorAll('.overflow-y-auto').forEach(el => el.scrollTop = 0);
    UI.leaderboard.classList.add('hidden');
    UI.legInfo.parentElement.classList.add('hidden'); // Hide leg info

    // Populate Conditions
    if (UI.prWindSpeed) {
        const base = state.wind.baseSpeed;
        UI.prWindSpeed.textContent = `${Math.floor(base)}-${Math.ceil(base + 5)} kn`;
    }
    if (UI.prWindDir) {
        // baseDirection is in radians. 0 = North.
        // Convert to cardinal.
        const deg = (state.wind.baseDirection * 180 / Math.PI + 360) % 360;
        const cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
        const idx = Math.round(deg / 22.5) % 16;
        UI.prWindDir.textContent = cardinals[idx];
    }
    if (UI.prWindVar) {
        const cond = state.race.conditions;
        let text = [];
        if (cond.gustiness > 0.6) text.push("Gusty");
        else if (cond.gustiness < 0.3) text.push("Steady");
        else text.push("Moderate");

        if (cond.shiftiness > 0.6) text.push("Shifty");
        else if (cond.shiftiness < 0.3) text.push("Stable");

        const type = cond.gustProb > 0.5 ? "Gusts" : "Lulls";
        const strength = cond.strengthBias > 1.1 ? "Strong" : (cond.strengthBias < 0.9 ? "Light" : "Moderate");
        text.push(`${strength} ${type}`);

        UI.prWindVar.textContent = text.join(" • ");
    }

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
    state.race.timer = 30.0;

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
    if (UI.settingApparentWind) UI.settingApparentWind.checked = settings.showApparentWind;
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
if (UI.settingApparentWind) UI.settingApparentWind.addEventListener('change', (e) => { settings.showApparentWind = e.target.checked; saveSettings(); });
if (UI.settingTrim) UI.settingTrim.addEventListener('change', (e) => { settings.manualTrim = e.target.checked; saveSettings(); });
if (UI.settingCameraMode) UI.settingCameraMode.addEventListener('change', (e) => { settings.cameraMode = e.target.value; saveSettings(); });
if (UI.settingHullColor) UI.settingHullColor.addEventListener('input', (e) => { settings.hullColor = e.target.value; saveSettings(); });
if (UI.settingSailColor) UI.settingSailColor.addEventListener('input', (e) => { settings.sailColor = e.target.value; saveSettings(); });
if (UI.settingCockpitColor) UI.settingCockpitColor.addEventListener('input', (e) => { settings.cockpitColor = e.target.value; saveSettings(); });
if (UI.settingSpinnakerColor) UI.settingSpinnakerColor.addEventListener('input', (e) => { settings.spinnakerColor = e.target.value; saveSettings(); });

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
    if (e.key === 'Control' || e.key === 'ControlLeft' || e.key === 'ControlRight') {
        if (e.repeat) return;
        settings.showApparentWind = !settings.showApparentWind;
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

function getTargetSpeed(awaRadians, useSpinnaker, awsKnots) {
    const awaDeg = Math.abs(awaRadians) * (180 / Math.PI);

    // Bounds check
    const aws = Math.max(0, Math.min(40, awsKnots));
    const awa = Math.max(0, Math.min(180, awaDeg));

    const awsSteps = J111_AWS_POLARS.aws; // 0, 2, ... 40
    const awaSteps = J111_AWS_POLARS.awa; // 0, 5, ... 180

    // Find AWS index
    let awsIdx = 0;
    for(let i=0; i<awsSteps.length-1; i++) {
        if(aws >= awsSteps[i] && aws <= awsSteps[i+1]) { awsIdx = i; break; }
    }

    // Find AWA index
    let awaIdx = 0;
    for(let i=0; i<awaSteps.length-1; i++) {
        if(awa >= awaSteps[i] && awa <= awaSteps[i+1]) { awaIdx = i; break; }
    }

    const table = useSpinnaker ? J111_AWS_POLARS.speeds.spinnaker : J111_AWS_POLARS.speeds.jib;

    // Bilinear Interpolation
    // Q11(x1, y1), Q12(x1, y2), Q21(x2, y1), Q22(x2, y2)
    // x = aws, y = awa

    const x1 = awsSteps[awsIdx], x2 = awsSteps[awsIdx+1];
    const y1 = awaSteps[awaIdx], y2 = awaSteps[awaIdx+1];

    // Values
    // Table is [aws_row][awa_col]
    const q11 = table[awsIdx][awaIdx];
    const q12 = table[awsIdx][awaIdx+1];
    const q21 = table[awsIdx+1][awaIdx];
    const q22 = table[awsIdx+1][awaIdx+1];

    // R1 = Lerp(x) at y1
    const tx = (aws - x1) / (x2 - x1);
    const r1 = q11 + tx * (q21 - q11);
    const r2 = q12 + tx * (q22 - q12);

    // P = Lerp(y) between R1 and R2
    const ty = (awa - y1) / (y2 - y1);
    return r1 + ty * (r2 - r1);
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

    // Always reset timer to 20s on new penalty trigger
    boat.raceState.penaltyTimer = 20.0;

    if (boat.isPlayer) {
        showRaceMessage("PENALTY! SPEED REDUCED 50% FOR 20s", "text-red-500", "border-red-500/50");
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

    // Physics - Wind
    const localWind = getWindAt(boat.x, boat.y);
    const angleToWind = Math.abs(normalizeAngle(boat.heading - localWind.direction)); // TWA

    // Apparent Wind
    const apparentWind = getApparentWind(boat, localWind);
    // Apply Bad Air reduction to AWS directly?
    // Bad Air reduces the *energy* available. Reducing TWS effectively reduces AWS.
    // However, we calculated AWS from TWS.
    // Let's calculate a "Physics AWS" which includes bad air.
    // Or just pass an "effective AWS" to getTargetSpeed.

    // Disturbed Air Calculation
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

    // Apply Bad Air to Apparent Wind
    // If wind is blocked, TWS is effectively lower.
    // We already calculated AWS based on full TWS.
    // Recalculating AWS with reduced TWS is complex because boat velocity is fixed.
    // Approximation: Reduce AWS by the bad air factor.
    // AWS is mostly wind driven on these boats.
    const effectiveAWS = apparentWind.speed * (1.0 - boat.badAirIntensity);
    const effectiveAWA = Math.abs(normalizeAngle(apparentWind.direction - boat.heading));

    // Update Turbulence Particles
    updateTurbulence(boat, dt);

    // Sail Logic (Using Apparent Wind Angle)
    let relAppWind = normalizeAngle(apparentWind.direction - boat.heading);
    if (Math.abs(relAppWind) > 0.1) boat.targetBoomSide = relAppWind > 0 ? 1 : -1;

    // Check Tacking (Rule 13) - Uses True Wind Angle (angleToWind) generally, but physically feels AWA.
    // Rules definition: "Head to wind" (TWA=0).
    if (angleToWind < Math.PI / 6) { // < 30 degrees
        boat.raceState.isTacking = true;
    } else {
        if (boat.raceState.isTacking && angleToWind > Math.PI / 4.5) {
             boat.raceState.isTacking = false;
        }
    }

    let swingSpeed = 0.025;
    boat.boomSide += (boat.targetBoomSide - boat.boomSide) * swingSpeed;
    if (Math.abs(boat.targetBoomSide - boat.boomSide) < 0.01) boat.boomSide = boat.targetBoomSide;

    // Optimal Sail Trim (Based on AWA)
    // AWA is 0 (Head to wind) -> 180 (Dead Run).
    // Optimal Angle of Attack ~ 20-25 degrees?
    // Sail Angle = AWA - AoA.
    // Close Hauled: AWA=28. Sail=3?
    // Reaching: AWA=90. Sail=65?
    // Downwind: AWA=150. Sail=90 (Max out)
    // Heuristic: Sail Angle = AWA / 2 is decent, but usually AWA - offset.
    // Let's use: max(0, AWA - 0.35) (approx 20 degrees).
    let optimalSailAngle = Math.max(0, effectiveAWA - 0.4);
    if (optimalSailAngle > Math.PI/2.0) optimalSailAngle = Math.PI/2.0;

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

    let targetKnotsJib = getTargetSpeed(effectiveAWA, false, effectiveAWS);
    let targetKnotsSpin = getTargetSpeed(effectiveAWA, true, effectiveAWS);
    let targetKnots = targetKnotsJib * jibFactor + targetKnotsSpin * spinFactor;

    const actualMagnitude = Math.abs(boat.sailAngle);
    const angleDiff = Math.abs(actualMagnitude - optimalSailAngle);
    // Trim efficiency penalty: if off by 10 deg (0.17 rad), penalty is 0.17*2 = 0.34? Too harsh.
    // Reduced penalty scale.
    const trimEfficiency = Math.max(0, 1.0 - angleDiff * 1.0);
    targetKnots *= trimEfficiency;

    let targetGameSpeed = targetKnots * 0.25;

    // Apply Penalty Speed Reduction
    if (boat.raceState.penalty) {
        targetGameSpeed *= 0.5;
    }

    if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
         if (checkBoundaryExiting(boat)) window.onRaceEvent('collision_boundary', { boat });
    }

    // Luffing Logic (Based on Effective AoA to Apparent Wind)
    const currentAoA = effectiveAWA - actualMagnitude;
    const luffStartThreshold = 0.3; // Stalls below 17 degrees AoA?
    if (currentAoA < luffStartThreshold) {
        boat.luffIntensity = Math.min(1.0, Math.max(0, 1.0 - (currentAoA / luffStartThreshold)));
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

    // Irons Penalty (Extra drag when head-to-wind TWA)
    // Still use TWA for Irons check as it represents the "No Go Zone" better physically
    if (angleToWind < 0.5) {
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
        if (boat.raceState.leg === 0) { gateIndices = [0, 1]; requiredDirection = 1; }
        else if (boat.raceState.leg === 1) { gateIndices = [2, 3]; requiredDirection = 1; }
        else if (boat.raceState.leg === 2) { gateIndices = [0, 1]; requiredDirection = -1; }
        else if (boat.raceState.leg === 3) { gateIndices = [2, 3]; requiredDirection = 1; }
        else if (boat.raceState.leg === 4) { gateIndices = [0, 1]; requiredDirection = -1; }

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

                            if (boat.raceState.leg > 4) {
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

                        if (boat.raceState.leg === 4) {
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
                    if (boat.raceState.leg > 4) {
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
    const conditions = state.race.conditions || { shiftiness: 0.5, gustiness: 0.5 };

    // Scale variability based on course conditions
    // Shiftiness (0-1) controls directional variance amplitude
    // Low: 0.05 rad (~3 deg), High: 0.4 rad (~23 deg)
    const dirAmp = 0.05 + conditions.shiftiness * 0.35;
    const dirDrift = Math.sin(state.time * 0.05) * dirAmp;
    const dirGust = Math.sin(state.time * 0.3 + 123.4) * (dirAmp * 0.25);
    state.wind.direction = state.wind.baseDirection + dirDrift + dirGust;

    // Gustiness (0-1) controls speed variance amplitude
    // Low: 0.5 kn, High: 4.5 kn
    const speedAmp = 0.5 + conditions.gustiness * 4.0;
    const speedSurge = Math.sin(state.time * 0.1) * speedAmp;
    const speedGust = Math.sin(state.time * 0.5 + 456.7) * (speedAmp * 0.5);
    state.wind.speed = Math.max(5, Math.min(25, state.wind.baseSpeed + speedSurge + speedGust));

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
    for (const boat of state.boats) {
        if (boat.speed > 0.25) {
             const boatDX = Math.sin(boat.heading);
             const boatDY = -Math.cos(boat.heading);
             const sternX = boat.x - boatDX * 30;
             const sternY = boat.y - boatDY * 30;
             if (Math.random() < 0.2) createParticle(sternX + (Math.random()-0.5)*4, sternY + (Math.random()-0.5)*4, 'wake');
             if (Math.random() < 0.25) {
                  const rightX = Math.cos(boat.heading), rightY = Math.sin(boat.heading);
                  const spread = 0.1;
                  createParticle(sternX - rightX*10, sternY - rightY*10, 'wake-wave', { vx: -rightX*spread, vy: -rightY*spread });
                  createParticle(sternX + rightX*10, sternY + rightY*10, 'wake-wave', { vx: rightX*spread, vy: rightY*spread });
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
        if (p.type === 'wake') { decay = 0.005; p.scale = 1 + (1-p.life)*1.5; p.alpha = p.life*0.4; }
        else if (p.type === 'wake-wave') { decay = 0.0015; p.scale = 0.5 + (1-p.life)*3; p.alpha = p.life*0.25; }
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
                ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.scale, 0, Math.PI * 2); ctx.fill();
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
    const zoneRadius = (player.raceState.leg === 0 || player.raceState.leg === 4) ? 0 : 165;

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
    if (player.raceState.leg === 1 || player.raceState.leg === 3) active = [2, 3];
    else if (player.raceState.leg === 2) active = [0, 1];
    else return;

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

    if (boat.raceState.finished) {
        // Finished boats are ranked by finish time, but for progress calculation we can assume they are at the end.
        // Or better, handle them separately in sorting.
        return 4*len + (1000000 - boat.raceState.finishTime); // Higher is better (lower time = higher score)
    }

    // Project onto course axis (Start -> Upwind)
    const p = boat.x*wx + boat.y*wy;
    const startP = c1x*wx + c1y*wy;
    const relP = p - startP;

    // Leg Progress
    // Leg 0: relP (Starts neg, target 0).
    // Leg 1: relP (0 to L).
    // Leg 2: 2L - relP (L to 0).
    // Leg 3: 2L + relP (0 to L).
    // Leg 4: 4L - relP (L to 0).

    const L = len; // Approx 4000

    let progress = 0;
    switch(boat.raceState.leg) {
        case 0: progress = relP; break;
        case 1: progress = relP; break;
        case 2: progress = 2*L - relP; break;
        case 3: progress = 2*L + relP; break;
        case 4: progress = 4*L - relP; break;
        default: progress = 0; // Should be covered by finished check
    }

    return progress;
}

function showResults() {
    if (!UI.resultsOverlay || !UI.resultsList) return;

    UI.resultsOverlay.classList.remove('hidden');
    UI.resultsOverlay.scrollTop = 0;
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
    UI.resultsList.innerHTML = '';

    // CSS Grid Layout Class
    // Columns: Pos, Img, Team, Time, Delta, Top, Avg, Dist, Pen, Points (implicit in space)
    // Optimized column widths to give more space to Sailor (1fr)
    const gridClass = "grid grid-cols-[4rem_4rem_1fr_4.5rem_4.5rem_5rem_5rem_5rem_5rem_5rem] gap-4 items-center px-4";

    // Header
    const header = document.createElement('div');
    header.className = `${gridClass} py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2`;
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

    const getLuma = (c) => {
        let r=0, g=0, b=0;
        if(c.startsWith('#')) {
            const hex = c.substring(1);
            if(hex.length===3) { r=parseInt(hex[0]+hex[0],16); g=parseInt(hex[1]+hex[1],16); b=parseInt(hex[2]+hex[2],16); }
            else { r=parseInt(hex.substring(0,2),16); g=parseInt(hex.substring(2,4),16); b=parseInt(hex.substring(4,6),16); }
        }
        return 0.299*r + 0.587*g + 0.114*b;
    };

    const totalBoats = state.boats.length;

    sorted.forEach((boat, index) => {
        const points = totalBoats - index;

        const hullColor = boat.isPlayer ? settings.hullColor : boat.colors.hull;
        const spinColor = boat.isPlayer ? settings.spinnakerColor : boat.colors.spinnaker;

        // Color Logic: Use Spinnaker if Hull is Very Light OR Very Dark
        const hullLuma = getLuma(hullColor);
        const useSpin = hullLuma < 50 || hullLuma > 200;
        const bgColor = useSpin ? spinColor : hullColor;

        // Text Color: Always White for Stats
        const textCol = "text-white";
        const subTextCol = "text-white/70";

        // Row Container
        const row = document.createElement('div');
        row.className = "relative mb-3 h-16 w-full"; // Fixed height

        // Background Bar with Fade Effect
        const bar = document.createElement('div');
        bar.className = "absolute inset-0 right-12 overflow-hidden drop-shadow-lg transition-transform hover:scale-[1.01] origin-left";
        // Fade from transparent on Left (showing dark bg) to Solid on Right
        // Fade extends across the entire width for a smoother effect
        bar.style.background = `linear-gradient(to right, transparent 0%, ${bgColor} 50%)`;

        // Gloss Overlay
        const gloss = document.createElement('div');
        gloss.className = "absolute inset-0 bg-gradient-to-b from-white/20 to-black/10 pointer-events-none";
        bar.appendChild(gloss);

        // Right Side Mask (Simulate the cut)
        const fade = document.createElement('div');
        fade.className = "absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-r from-transparent to-white/10 mix-blend-overlay";
        bar.appendChild(fade);

        row.appendChild(bar);

        // Thin white line under the row
        const line = document.createElement('div');
        line.className = "absolute bottom-0 left-0 right-[25px] h-[1px] bg-white";
        row.appendChild(line);

        // Content Layer (Grid)
        const content = document.createElement('div');
        content.className = `relative z-10 ${gridClass} w-full h-full`;

        // Rank
        const rankDiv = document.createElement('div');
        rankDiv.className = `flex justify-center items-center`;

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

        // Image (Square)
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

        // Sailor Name
        // Reduced font size from 3xl to 2xl to allow more space
        const nameDiv = document.createElement('div');
        nameDiv.className = `font-black text-2xl italic uppercase tracking-tighter truncate text-white drop-shadow-md`;
        nameDiv.textContent = boat.name;

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

        // Stats Styling: Font Sans, Bold, White
        // Reduced font size from text-lg to text-sm for better alignment with headers
        const createStat = (val, align='text-right') => {
            const d = document.createElement('div');
            d.className = `${align} font-sans font-bold text-sm text-white drop-shadow-sm`;
            d.textContent = val;
            return d;
        };

        const timeDiv = createStat(finishTime);
        const deltaDiv = document.createElement('div');
        deltaDiv.className = `text-right font-sans font-bold text-sm text-white/70`;
        deltaDiv.textContent = delta;

        const topDiv = createStat(topSpeed);
        const avgDiv = createStat(avgSpeed);
        const distDiv = createStat(totalDist);

        const penDiv = document.createElement('div');
        // Penalty: White text (was Red), no background
        penDiv.className = `text-center font-sans font-bold text-sm ${penalties > 0 ? 'text-white' : 'text-white/30'}`;
        penDiv.textContent = penalties > 0 ? penalties : "-";

        content.appendChild(rankDiv);
        content.appendChild(imgDiv);
        content.appendChild(nameDiv);
        content.appendChild(timeDiv);
        content.appendChild(deltaDiv);
        content.appendChild(topDiv);
        content.appendChild(avgDiv);
        content.appendChild(distDiv);
        content.appendChild(penDiv);

        row.appendChild(content);

        // Points (Right Aligned Skewed Box)
        // Position absolutely to the right
        // Add rounded-br-2xl for rounded bottom right corner
        const ptsBox = document.createElement('div');
        ptsBox.className = "absolute right-0 top-0 bottom-0 w-24 bg-white transform -skew-x-12 origin-bottom-right flex items-center justify-center shadow-md z-20 border-l-4 border-white/50 rounded-br-2xl";
        // Inner unskewed container for text
        const ptsText = document.createElement('div');
        ptsText.className = "transform skew-x-12 text-slate-900 font-black text-3xl";
        ptsText.textContent = points;
        ptsBox.appendChild(ptsText);

        row.appendChild(ptsBox);

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
    const totalRaceDist = 4 * len;


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
        else UI.lbLeg.textContent = `${Math.max(1, leader.raceState.leg)}/4`;
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
            UI.speed.classList.remove('text-red-400', 'text-green-400', 'text-orange-400', 'text-white');

            if (player.raceState.penalty || player.badAirIntensity > 0.05) {
                UI.speed.classList.add('text-red-400');
            } else {
                UI.speed.classList.add('text-white');
            }
        }
        if (UI.windSpeed) {
             const aw = getApparentWind(player, localWind);
             const displaySpeed = settings.showApparentWind ? aw.speed : localWind.speed;
             UI.windSpeed.textContent = displaySpeed.toFixed(1);

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
             if (UI.windSpeedLabel) UI.windSpeedLabel.textContent = settings.showApparentWind ? 'AWS' : 'TWS';
        }
        if (UI.windAngle) {
            if (settings.showApparentWind) {
                const aw = getApparentWind(player, localWind);
                UI.windAngle.textContent = Math.round(Math.abs(normalizeAngle(player.heading - aw.direction))*(180/Math.PI)) + '°';
            } else {
                UI.windAngle.textContent = Math.round(Math.abs(normalizeAngle(player.heading - localWind.direction))*(180/Math.PI)) + '°';
            }
            if (UI.windAngleLabel) UI.windAngleLabel.textContent = settings.showApparentWind ? 'AWA' : 'TWA';
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
             let txt = "";
             if (state.race.status === 'prestart') txt = "PRESTART";
             else if (state.race.status === 'finished' || player.raceState.finished) txt = "FINISHED";
             else txt = (player.raceState.leg === 0) ? "START" : `LEG ${player.raceState.leg} OF 4: ${(player.raceState.leg%2!==0)?"UPWIND":"DOWNWIND"}`;
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
                 if ((state.race.status==='racing' || state.race.status==='prestart') && player.raceState.leg < 5) {
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
    const w = 550, dist = 4000;
    state.course = {
        marks: [
            { x: -rx*w/2, y: -ry*w/2, type: 'start' }, { x: rx*w/2, y: ry*w/2, type: 'start' },
            { x: ux*dist - rx*w/2, y: uy*dist - ry*w/2, type: 'mark' }, { x: ux*dist + rx*w/2, y: uy*dist + ry*w/2, type: 'mark' }
        ],
        boundary: { x: ux*dist/2, y: uy*dist/2, radius: 3500 }
    };
}

function resetGame() {
    loadSettings();
    if (UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
    state.camera.target = 'boat';
    state.wind.baseSpeed = 8 + Math.random()*10;
    state.wind.speed = state.wind.baseSpeed;
    state.wind.baseDirection = (Math.random()-0.5)*0.5;
    state.wind.direction = state.wind.baseDirection;
    state.gusts = [];

    // Randomized Biases
    const biasRoll = Math.random();
    let gustProb = 0.5;
    if (biasRoll < 0.4) gustProb = 0.75; // Gust bias
    else if (biasRoll < 0.8) gustProb = 0.25; // Lull bias

    const strengthBias = 0.8 + Math.random() * 0.4;
    const dirBias = (Math.random() - 0.5) * 0.4;
    const density = 8 + Math.floor(Math.random() * 12); // 8-20 active

    state.race.conditions = {
        gustiness: Math.random(),
        shiftiness: Math.random(),
        gustProb,
        strengthBias,
        dirBias,
        density
    };
    state.time = 0;
    state.race.status = 'waiting'; // Wait for user to start
    state.race.timer = 30.0;

    initCourse();

    // Pre-populate gusts
    for (let i = 0; i < density; i++) {
        spawnGlobalGust(true);
    }

    state.boats = [];
    if (UI.lbRows) UI.lbRows.innerHTML = '';
    UI.boatRows = {};

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
