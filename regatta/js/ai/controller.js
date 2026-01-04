
import { state } from '../state/state.js';
import { getRiskMetrics, getRightOfWay } from '../physics/rules.js'; // Will need to extract rules
import { getWindAt } from '../physics/wind.js';
import { RoutePlanner, Geom } from './planner.js';
import { J111_PLANING } from '../core/config.js';
import { normalizeAngle } from '../utils/math.js';
import { getClosestPointOnSegment } from '../physics/collision.js';

import { getTargetSpeed } from '../physics/performance.js';


export class BotController {
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

        // Route Planning
        this.planner = new RoutePlanner();
        this.currentPath = [];
        this.pathTimer = 0;
        this.finalTarget = null;
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
                // START STRATEGY
                let pct = this.startLinePct;
                if (this.livenessState !== 'normal') pct = 0.5;

                destX = m1.x + (m2.x - m1.x) * pct;
                destY = m1.y + (m2.y - m1.y) * pct;

                const wd = state.wind.direction;

                // OCS / Recovery Logic
                const lineDx = m2.x - m1.x, lineDy = m2.y - m1.y;
                const nx = lineDy, ny = -lineDx;
                const bDx = boat.x - m1.x, bDy = boat.y - m1.y;
                const dot = bDx * nx + bDy * ny;

                if (boat.raceState.ocs || dot > 0) {
                    // Must go DOWNWIND
                    const centerX = (m1.x + m2.x) / 2;
                    const centerY = (m1.y + m2.y) / 2;
                    const distBack = (this.livenessState === 'normal') ? 150 : 250;
                    destX = centerX - Math.sin(wd) * distBack;
                    destY = centerY + Math.cos(wd) * distBack;
                } else {
                    // Normal Start (Upwind Target)
                    const distPast = (this.livenessState === 'force') ? 300 : 150;
                    destX += Math.sin(wd) * distPast;
                    destY -= Math.cos(wd) * distPast;
                }
            } else {
                // RACE LEGS
                destX = (m1.x + m2.x) / 2;
                destY = (m1.y + m2.y) / 2;

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
                const d1 = (boat.x - m1.x)**2 + (boat.y - m1.y)**2;
                const d2 = (boat.x - m2.x)**2 + (boat.y - m2.y)**2;
                const mark = (d1 < d2) ? m1 : m2;
                const dx = mark.x - (m1.x+m2.x)/2;
                const dy = mark.y - (m1.y+m2.y)/2;
                const len = Math.sqrt(dx*dx+dy*dy);
                if (len > 0) {
                    destX = mark.x + (dx/len) * 90;
                    destY = mark.y + (dy/len) * 90;
                }
            }
        }

        // 2. Global Path Planning
        // Update Path if timer expired or target moved significantly
        if (this.pathTimer > 0) this.pathTimer -= 0.1; // Called in update usually, but here fine

        let needsReplan = false;
        if (this.pathTimer <= 0) needsReplan = true;
        if (!this.finalTarget || (destX-this.finalTarget.x)**2 + (destY-this.finalTarget.y)**2 > 50*50) needsReplan = true;

        // If islands exist, use planner
        if (state.course.islands && state.course.islands.length > 0) {
            if (needsReplan) {
                this.finalTarget = { x: destX, y: destY };
                // Plan path
                this.currentPath = this.planner.findPath(
                    { x: boat.x, y: boat.y },
                    this.finalTarget,
                    state.course.islands
                );
                this.pathTimer = 2.0 + Math.random(); // Replan every 2-3s
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
        const current = state.race.conditions.current;

        const dx = target.x - boat.x;
        const dy = target.y - boat.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angleToTarget = Math.atan2(dx, -dy); // 0 is North (Up)

        // FORCE / RECOVERY OVERRIDE
        if (this.livenessState === 'force' || this.livenessState === 'recovery') {
             const twa = normalizeAngle(angleToTarget - wd);
             if (Math.abs(twa) > 0.7) return angleToTarget;
             const desiredTack = twa > 0 ? 1 : -1;
             return normalizeAngle(wd + desiredTack * 0.75);
        }

        // --- Current Compensation ---

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
            const crossCurrent = Math.sin(diff) * cSpeed;

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
        let optTWA = (45 * Math.PI/180);

        if (absTWA < Math.PI / 3.5) mode = 'upwind';
        else if (absTWA > Math.PI * 0.7) {
            mode = 'downwind';
            optTWA = (150 * Math.PI/180);

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
                posStat = boat.stats.upwind * 0.008;
            } else if (estTwaDeg >= 145) {
                posStat = boat.stats.downwind * 0.01;
            } else {
                 // Reach
                 posStat = boat.stats.reach * 0.012;
            }
            targetKnots *= (1.0 + posStat);
            const targetGameSpeed = targetKnots * 0.25;

            // 2. Simulate Speed Profile (Acceleration / Momentum)
            let simSpeed = boat.speed;
            let totalDist = 0;
            const steps = 5; // 5 steps of 1 second

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

            // 3. Calculate COG with Current
            let cog = heading;
            let speedOverGround = avgSpeed;

            if (current && current.speed > 0.1) {
                const cSpeed = current.speed / 4.0;
                const cDir = current.direction;
                // Use avgSpeed for vector addition
                const vx = Math.sin(heading)*avgSpeed + Math.sin(cDir)*cSpeed;
                const vy = -Math.cos(heading)*avgSpeed - Math.cos(cDir)*cSpeed;

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
            const windBonus = (futureEffective - state.wind.baseSpeed);
            score += windBonus * 0.2; // Increased weight

            return score;
        };

        const scoreS = scoreTack(hStarboard);
        const scoreP = scoreTack(hPort);

        // Hysteresis / Stickiness
        // Bias towards current tack to prevent rapid switching
        const currentTack = normalizeAngle(boat.heading - wd) > 0 ? 1 : -1; // 1=Stbd, -1=Port
        const tackBonus = 0.1; // Equivalent to slight VMG advantage

        let preferredHeading = (scoreS > scoreP) ? hStarboard : hPort;

        if (currentTack === 1 && scoreS + tackBonus > scoreP) preferredHeading = hStarboard;
        if (currentTack === -1 && scoreP + tackBonus > scoreS) preferredHeading = hPort;

        // Check Laylines (Overstanding)
        const otherTackHeading = (preferredHeading === hStarboard) ? hPort : hStarboard;

        // Calculate COG for other tack
        let otherCog = otherTackHeading;
        if (current && current.speed > 0.1) {
             const cSpeed = current.speed / 4.0;
             const cDir = current.direction;
             const bSpeed = Math.max(1.0, boat.speed);
             const vx = Math.sin(otherTackHeading)*bSpeed + Math.sin(cDir)*cSpeed;
             const vy = -Math.cos(otherTackHeading)*bSpeed - Math.cos(cDir)*cSpeed;
             otherCog = Math.atan2(vx, -vy);
        }

        // Angle from Other Tack COG to Target
        const otherError = normalizeAngle(otherCog - angleToTarget);

        if (Math.abs(otherError) < 0.05) { // 3 degrees tolerance
             if (this.tackCooldown <= 0) {
                 this.tackCooldown = 10.0;
                 return otherTackHeading;
             }
        }

        // Cooldown check
        if (this.tackCooldown > 0) this.tackCooldown -= 1/60; // approx dt

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

        const distToTarget = Math.sqrt((targetX - boat.x)**2 + (targetY - boat.y)**2);
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

            const dist = Math.sqrt((targetX - boat.x)**2 + (targetY - boat.y)**2);
            // Estimate speed at 10.0 kn (~100 units/s)
            const timeToLine = dist / 100.0;

            if (timeToLine < timer - 2.0) {
                // Kill speed
                speed = 0.1;
                return { target: {x: targetX, y: targetY}, speed };
            } else {
                speed = 1.0; // Gun it
                return { target: {x: targetX, y: targetY}, speed };
            }
        }

        // OCS Check
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
                     const res = getRightOfWay(this.boat, other);
                     rowBoat = res.boat;
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
                        else cost -= 500;
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
                    } else if (dSq < 130*130 && this.livenessState === 'normal') {
                        proximityCost += 25000 / (dSq + 100);
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
            if (state.course.islands) {
                // We use the segment from boat to future position
                const start = { x: boat.x, y: boat.y };
                const end = { x: futureX, y: futureY };

                for (const isl of state.course.islands) {
                    // Quick Bounding Box/Circle Check
                    const d = Geom.distToSegment({x: isl.x, y: isl.y}, start, end);
                    if (d < isl.radius + 30) { // Close to island
                        // Detailed Polygon Check
                        // Check if segment intersects or if end point is inside
                        if (Geom.segmentIntersectsPoly(start, end, isl.vertices)) {
                            staticCollision = true;
                            cost += 500000; // HUGE penalty (Hard Constraint)
                        } else {
                            if (d < isl.radius + 80) {
                                proximityCost += 10000 * (1.0 - (d - isl.radius)/80);
                            }
                        }
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

        return bestHeading;
    }
}
