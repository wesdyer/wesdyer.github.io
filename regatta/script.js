// Game Configuration
const CONFIG = {
    turnSpeed: 0.01,
    turnPenalty: 0.995,
    cameraPanSpeed: 1.25,
    cameraRotateSpeed: 0.01,
    windSpeed: 5,
    waterColor: '#3b82f6',
    boatColor: '#f8fafc',
    sailColor: '#f1f5f9',
};

// J/111 Polar Data (Various Wind Speeds)
// Source: ORC Certificate data & Scaled Estimations based on VMG ratios
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

// Game State
const state = {
    boat: {
        x: 0,
        y: 0,
        heading: 0, // Radians, 0 = North (Up)
        velocity: { x: 0, y: 0 },
        speed: 0, // Internal units (approx Knots / 2)
        sailAngle: 0, // Radians relative to boat
        boomSide: 1, // 1 for right, -1 for left
        targetBoomSide: 1,
        luffing: false,
        luffIntensity: 0,
        spinnaker: false, // Default to Performance Mode
        spinnakerDeployProgress: 0, // 0 = Jib, 1 = Spinnaker
    },
    camera: {
        x: 0,
        y: 0,
        rotation: 0,
        target: 'boat', // Always follow boat now
        mode: 'heading' // 'heading', 'north', 'wind'
    },
    wind: {
        direction: 0, // Blowing Down (South)
        baseDirection: 0,
        speed: 10, // Knots
        baseSpeed: 10
    },
    particles: [], // For wake and wind effects
    keys: {
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false,
        Shift: false,
    },
    time: 0,
    race: {
        status: 'prestart', // 'prestart', 'racing', 'finished'
        timer: 30.0,
        leg: 0, // 0=Start, 1=Upwind, 2=Downwind, 3=Upwind, 4=Finish
        ocs: false,
        penalty: false,
        penaltyProgress: 0,
        finishTime: 0,
        lastPos: { x: 0, y: 0 },
        nextWaypoint: { x: 0, y: 0, dist: 0, angle: 0 }
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
    timer: document.getElementById('hud-timer'),
    message: document.getElementById('hud-message'),
    waypointArrow: document.getElementById('hud-waypoint-arrow')
};

let minimapCtx = null;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input Handling
window.addEventListener('keydown', (e) => {
    if (state.keys.hasOwnProperty(e.key)) {
        state.keys[e.key] = true;
    }
    if (e.key === 'Enter') {
        const modes = ['heading', 'north', 'wind'];
        const currentIndex = modes.indexOf(state.camera.mode);
        state.camera.mode = modes[(currentIndex + 1) % modes.length];
    }
    if (e.key === ' ' || e.code === 'Space') {
        state.boat.spinnaker = !state.boat.spinnaker;
    }
});

window.addEventListener('keyup', (e) => {
    if (state.keys.hasOwnProperty(e.key)) {
        state.keys[e.key] = false;
    }
});

// Physics Helper Functions
function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

// Race Helper Functions
function formatTime(seconds) {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.floor(Math.abs(seconds) % 60);
    const ms = Math.floor((Math.abs(seconds) % 1) * 10);

    // During countdown, we don't show ms usually, but let's keep it clean
    // If negative (pre-start), show countdown
    const sign = seconds < 0 ? "-" : "";
    return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getClosestPointOnSegment(px, py, ax, ay, bx, by) {
    const atobX = bx - ax;
    const atobY = by - ay;
    const atopX = px - ax;
    const atopY = py - ay;
    const lenSq = atobX * atobX + atobY * atobY;
    let dot = atopX * atobX + atopY * atobY;
    let t = Math.min(1, Math.max(0, dot / lenSq));
    return {
        x: ax + atobX * t,
        y: ay + atobY * t
    };
}

// Check intersection of Line Segment AB and Line Segment CD
function checkLineIntersection(Ax, Ay, Bx, By, Cx, Cy, Dx, Dy) {
    const rX = Bx - Ax;
    const rY = By - Ay;
    const sX = Dx - Cx;
    const sY = Dy - Cy;

    const rxs = rX * sY - rY * sX;
    const qpx = Cx - Ax;
    const qpy = Cy - Ay;

    // Collinear or parallel handling omitted for simplicity (rare in game physics frame)
    if (Math.abs(rxs) < 1e-5) return null;

    const t = (qpx * sY - qpy * sX) / rxs;
    const u = (qpx * rY - qpy * rX) / rxs;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return { t, u };
    }
    return null;
}

function triggerPenalty() {
    if (state.race.finished) return;
    if (!state.race.penalty) {
        state.race.penalty = true;
        state.race.penaltyProgress = 0;
        showRaceMessage("PENALTY! DO 720° TURN", "text-red-500", "border-red-500/50");
    }
}

function showRaceMessage(text, textColorClass, borderColorClass) {
    if (UI.message) {
        UI.message.textContent = text;
        UI.message.className = `mt-2 text-lg font-bold bg-slate-900/80 px-4 py-1 rounded-full border shadow-lg ${textColorClass} ${borderColorClass}`;
        UI.message.classList.remove('hidden');
    }
}

function hideRaceMessage() {
    if (UI.message) {
        UI.message.classList.add('hidden');
    }
}

function updateRace(dt) {
    // 1. Timer Logic
    if (state.race.status === 'prestart') {
        state.race.timer -= dt;
        if (state.race.timer <= 0) {
            state.race.status = 'racing';
            state.race.timer = 0;
            // Check OCS at start moment
            // OCS if boat is Upwind of Start Line
            // Start Line Normal (Upwind)
            // Start Line is M0->M1. Normal is (-dy, dx).
            // We need to check which side we are on.
            // But simpler: Just check crossing logic below.
            // If we are on course side, we are OCS.
            // Logic handled continuously below.
        }
    } else if (state.race.status === 'racing') {
        state.race.timer += dt;
    }

    // 2. Gate Crossing Logic
    const marks = state.course.marks;
    if (marks && marks.length >= 4) {
        // Define Gates
        // Gate 1: Start/Finish (M0-M1). Correct crossing: Upwind (Start), Downwind (Finish/Gate)
        // Gate 2: Upwind Gate (M2-M3). Correct crossing: Upwind.

        // Define Active Gate based on Leg
        let gateIndices = [];
        let requiredDirection = 1; // 1 = Upwind, -1 = Downwind

        if (state.race.leg === 0) { // Start
            gateIndices = [0, 1];
            requiredDirection = 1; // Must cross Upwind
        } else if (state.race.leg === 1) { // To Upwind Gate
            gateIndices = [2, 3];
            requiredDirection = 1;
        } else if (state.race.leg === 2) { // To Leeward Gate
            gateIndices = [0, 1];
            requiredDirection = -1;
        } else if (state.race.leg === 3) { // To Upwind Gate
            gateIndices = [2, 3];
            requiredDirection = 1;
        } else if (state.race.leg === 4) { // Finish
            gateIndices = [0, 1];
            requiredDirection = -1;
        }

        if (gateIndices.length > 0) {
            const m1 = marks[gateIndices[0]];
            const m2 = marks[gateIndices[1]];

            // Check crossing
            // Boat Segment: lastPos -> currPos
            const intersect = checkLineIntersection(
                state.race.lastPos.x, state.race.lastPos.y, state.boat.x, state.boat.y,
                m1.x, m1.y, m2.x, m2.y
            );

            if (intersect) {
                // Determine direction of crossing
                // Gate Vector
                const gateDx = m2.x - m1.x;
                const gateDy = m2.y - m1.y;

                // Normal pointing "Upwind" relative to gate
                // If Gate is Left->Right (Crosswind), Normal is Upwind.
                // In initCourse: M0->M1 is Left->Right. Upwind is -Y (ish).
                // Normal vector N = (dy, -dx) (Rotated 90 deg CCW in screen coords?)
                // M0(Left) -> M1(Right). Vector is Right.
                // Upwind is North (-Y).
                // Right -> North is 90 deg CCW.
                // (x, y) -> (y, -x).
                const nx = gateDy;
                const ny = -gateDx;

                // Dot product of Boat Movement with Normal
                const moveDx = state.boat.x - state.race.lastPos.x;
                const moveDy = state.boat.y - state.race.lastPos.y;
                const dot = moveDx * nx + moveDy * ny;

                // Check consistency
                // If dot > 0, we moved in direction of Normal (Upwind)
                // If dot < 0, we moved opposite (Downwind)

                const crossingDir = dot > 0 ? 1 : -1;

                if (state.race.status === 'prestart') {
                    // Start Line Logic during pre-start
                    // If we cross Start Line (Gate 0-1)
                    if (gateIndices[0] === 0) {
                         // If we cross Upwind (1), we are OCS
                         if (crossingDir === 1) {
                             state.race.ocs = true;
                             showRaceMessage("OCS - RETURN TO PRE-START!", "text-red-500", "border-red-500/50");
                         }
                         // If we cross Downwind (-1), we cleared OCS
                         else if (crossingDir === -1) {
                             state.race.ocs = false;
                             hideRaceMessage();
                         }
                    }
                } else if (state.race.status === 'racing' && !state.race.finished) {
                    // Racing Logic

                    // Special Case: Start (Leg 0)
                    // We transition from Leg 0 to Leg 1 ONLY if we cross Start Line Upwind AFTER T=0
                    if (state.race.leg === 0) {
                        // We assume we are checking Start Line
                        if (crossingDir === 1) {
                            if (state.race.ocs) {
                                // Crossed upwind but was OCS? Still OCS unless we dipped back first.
                                // Logic above handles OCS set/clear.
                                // If OCS is true, we cannot start.
                            } else {
                                // Clean start!
                                state.race.leg++;
                                // Check if we were OCS just now?
                                // If we were OCS, we must have cleared it.
                                // If we are here, we just crossed Upwind.
                                // To start correctly, we must have been on Downwind side.
                                // So this crossing is valid.
                            }
                        } else if (crossingDir === -1) {
                             // Dipping back
                             state.race.ocs = false;
                             hideRaceMessage();
                        }
                    } else {
                        // Normal Legs
                        // Must match required direction
                        if (crossingDir === requiredDirection) {
                            state.race.leg++;
                            if (state.race.leg > 4) {
                                state.race.finished = true;
                                state.race.status = 'finished';
                                state.race.finishTime = state.race.timer;
                                showRaceMessage("FINISHED!", "text-green-400", "border-green-400/50");
                            }
                        } else {
                            // Wrong way!
                            showRaceMessage("WRONG WAY!", "text-orange-500", "border-orange-500/50");
                            // Set timeout to hide? Or keep until corrected?
                            // Let's keep it brief or until corrected (crossing back)
                            // If they cross back, they are "correcting" so hide it?
                            // Simplification: Just show it.
                            setTimeout(hideRaceMessage, 2000);
                        }
                    }
                }
            }
        }
    }

    // 3. Penalty Logic
    if (state.race.penalty) {
        // Track rotation
        // We need previous heading vs current heading
        // Calculated in main update() loop or passed here?
        // Let's rely on update() to call us AFTER position update but BEFORE storing lastPos/lastHeading
        // Actually update() doesn't store lastHeading explicitly yet.
        // We can access state.boat.prevHeading if we add it.
        // Or we calculate it here if we call updateRace at end of update.
    }

    // 4. Update Next Waypoint
    // This logic runs every frame to keep the indicator accurate
    const courseMarks = state.course.marks; // Renamed to avoid shadowing 'marks' if defined above
    if (courseMarks && courseMarks.length >= 4) {
        let waypointGateIndices = [];
        if (state.race.leg === 0 || state.race.leg === 2 || state.race.leg === 4) {
            waypointGateIndices = [0, 1];
        } else {
            waypointGateIndices = [2, 3];
        }

        const m1 = courseMarks[waypointGateIndices[0]];
        const m2 = courseMarks[waypointGateIndices[1]];

        const closest = getClosestPointOnSegment(
            state.boat.x, state.boat.y,
            m1.x, m1.y, m2.x, m2.y
        );

        const dx = closest.x - state.boat.x;
        const dy = closest.y - state.boat.y;
        const distUnits = Math.sqrt(dx * dx + dy * dy);

        // 55 pixels approx 11m => 1 pixel approx 0.2m
        state.race.nextWaypoint.dist = distUnits * 0.2;
        state.race.nextWaypoint.x = closest.x;
        state.race.nextWaypoint.y = closest.y;
        state.race.nextWaypoint.angle = Math.atan2(dx, -dy); // 0 is North (Up, -y)
    }
}

function getTargetSpeed(twaRadians, useSpinnaker, windSpeed) {
    const twaDeg = Math.abs(twaRadians) * (180 / Math.PI);
    const angles = J111_POLARS.angles;

    // Available wind speeds in data
    const availableSpeeds = [6, 8, 10, 12, 14, 16, 20];

    // Find lower and upper bound for windSpeed
    let lower = 6;
    let upper = 20;

    if (windSpeed <= 6) {
        lower = 6; upper = 6;
    } else if (windSpeed >= 20) {
        lower = 20; upper = 20;
    } else {
        for (let i = 0; i < availableSpeeds.length - 1; i++) {
            if (windSpeed >= availableSpeeds[i] && windSpeed <= availableSpeeds[i+1]) {
                lower = availableSpeeds[i];
                upper = availableSpeeds[i+1];
                break;
            }
        }
    }

    // Helper to get interpolated speed for a specific polar wind speed
    const getPolarSpeed = (ws) => {
        const data = J111_POLARS.speeds[ws];
        const speeds = useSpinnaker ? data.spinnaker : data.nonSpinnaker;

        // Interpolate angle
        for (let i = 0; i < angles.length - 1; i++) {
            if (twaDeg >= angles[i] && twaDeg <= angles[i+1]) {
                const t = (twaDeg - angles[i]) / (angles[i+1] - angles[i]);
                return speeds[i] + t * (speeds[i+1] - speeds[i]);
            }
        }
        return speeds[speeds.length - 1];
    };

    const speedLower = getPolarSpeed(lower);
    const speedUpper = getPolarSpeed(upper);

    if (lower === upper) return speedLower;

    const t = (windSpeed - lower) / (upper - lower);
    return speedLower + t * (speedUpper - speedLower);
}

// Particle System
function createParticle(x, y, type, properties = {}) {
    state.particles.push({
        x, y,
        type,
        life: 1.0,
        ...properties
    });
}

function updateParticles(dt) {
    const timeScale = dt * 60;
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];

        // Apply velocity if present
        if (p.vx) p.x += p.vx * timeScale;
        if (p.vy) p.y += p.vy * timeScale;

        // Default decay
        let decay = 0.0025;

        if (p.type === 'wake') {
            // Central turbulent wake
            decay = 0.005;
            p.scale = 1 + (1 - p.life) * 1.5;
            p.alpha = p.life * 0.4;
        } else if (p.type === 'wake-wave') {
            // V-Wake waves
            decay = 0.0015;
            p.scale = 0.5 + (1 - p.life) * 3.0;
            p.alpha = p.life * 0.25;
        } else if (p.type === 'wind') {
             // Move with wind
             const speed = 1;
             p.x -= Math.sin(state.wind.direction) * speed * timeScale;
             p.y += Math.cos(state.wind.direction) * speed * timeScale;
        }

        p.life -= decay * timeScale;

        if (p.life <= 0) {
            // Swap with last element and pop (O(1) removal)
            state.particles[i] = state.particles[state.particles.length - 1];
            state.particles.pop();
            // Since we iterate backwards, the swapped element (from end) has already been processed this frame.
            // So we can safely continue.
        }
    }
}

// Update Loop
function update(dt) {
    // Standardize time step logic
    // Original: state.time += 0.004 per frame (at 60fps) -> 0.24 per second
    state.time += 0.24 * dt;
    const timeScale = dt * 60; // Scaling factor for logic designed for 60 FPS

    // Sail Switching Logic
    const switchSpeed = dt / 5.0; // 5.0 seconds switch time (dt is in seconds)
    if (state.boat.spinnaker) {
        state.boat.spinnakerDeployProgress = Math.min(1, state.boat.spinnakerDeployProgress + switchSpeed);
    } else {
        state.boat.spinnakerDeployProgress = Math.max(0, state.boat.spinnakerDeployProgress - switchSpeed);
    }

    // Update Wind (Vary over time)
    // Direction: Slow drift + subtle gusts
    const dirDrift = Math.sin(state.time * 0.05) * 0.2; // ~12 deg swing
    const dirGust = Math.sin(state.time * 0.3 + 123.4) * 0.05; // ~3 deg jitter
    state.wind.direction = state.wind.baseDirection + dirDrift + dirGust;

    // Speed: Surge + gusts
    const speedSurge = Math.sin(state.time * 0.1) * 2.0;
    const speedGust = Math.sin(state.time * 0.5 + 456.7) * 1.5;
    state.wind.speed = Math.max(5, Math.min(25, state.wind.baseSpeed + speedSurge + speedGust));

    // Camera Rotation Logic
    // Damping factor adapted for time delta
    const camLerp = 1 - Math.pow(0.9, timeScale); // approx 0.1 at 60fps

    if (state.camera.mode === 'heading') {
        // Smoothly rotate towards boat heading
        let diff = normalizeAngle(state.boat.heading - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    } else if (state.camera.mode === 'north') {
        // Rotate towards 0
        let diff = normalizeAngle(0 - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    } else if (state.camera.mode === 'wind') {
        // Rotate towards wind direction (so wind comes from top)
        let diff = normalizeAngle(state.wind.direction - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    }

    // Boat Steering
    let isTurning = false;
    const turnRate = (state.keys.Shift ? CONFIG.turnSpeed * 0.25 : CONFIG.turnSpeed) * timeScale;

    if (state.keys.ArrowLeft) {
        state.boat.heading -= turnRate;
        isTurning = true;
    }
    if (state.keys.ArrowRight) {
        state.boat.heading += turnRate;
        isTurning = true;
    }

    // Normalize Heading
    state.boat.heading = normalizeAngle(state.boat.heading);

    // --- Physics ---

    // Wind Direction (Vector)
    const windDirX = Math.sin(state.wind.direction);
    const windDirY = -Math.cos(state.wind.direction);

    // Boat Heading Vector
    const boatDirX = Math.sin(state.boat.heading);
    const boatDirY = -Math.cos(state.boat.heading);

    // Angle of Attack (0 to PI)
    let angleToWind = Math.abs(normalizeAngle(state.boat.heading - state.wind.direction));

    // Determine target speed from polars
    // Note: Polars are in Knots. We scale down to game units (approx 0.5 ratio)
    // Interpolate power based on sail state
    // 0.0-0.5: Jib fading out (100% to 0% power)
    // 0.5-1.0: Spinnaker fading in (0% to 100% power)
    const progress = state.boat.spinnakerDeployProgress;
    const jibFactor = Math.max(0, 1 - progress * 2);
    const spinFactor = Math.max(0, (progress - 0.5) * 2);

    let targetKnotsJib = getTargetSpeed(angleToWind, false, state.wind.speed);
    let targetKnotsSpin = getTargetSpeed(angleToWind, true, state.wind.speed);

    let targetKnots = targetKnotsJib * jibFactor + targetKnotsSpin * spinFactor;
    let targetGameSpeed = targetKnots * 0.25;

    // Determine Luffing state (for visual/logic flags, not speed as speed comes from polar now)
    // Polar says 0 speed at < 30 deg, so checks match
    if (targetKnots < 1.0) {
        state.boat.luffing = true;
    } else {
        state.boat.luffing = false;
    }

    // Determine Visual Luffing Intensity
    // Luff more when pointed closer to the wind (0 intensity at > 45 deg, 1.0 at 0 deg)
    const luffThreshold = 0.8; // Approx 45 degrees
    if (angleToWind < luffThreshold) {
        state.boat.luffIntensity = Math.max(0, 1.0 - (angleToWind / luffThreshold));
    } else {
        state.boat.luffIntensity = 0;
    }

    // Smoothly interpolate current speed to target speed (acceleration/deceleration)
    // Momentum factor: 0.995 (retains 99.5% of old speed)
    // alpha = 1 - pow(0.995, timeScale)
    const speedAlpha = 1 - Math.pow(0.995, timeScale);
    state.boat.speed = state.boat.speed * (1 - speedAlpha) + targetGameSpeed * speedAlpha;

    if (isTurning) {
        // Apply turn penalty scaled by time
        // speed *= pow(penalty, timeScale)
        state.boat.speed *= Math.pow(CONFIG.turnPenalty, timeScale);
    }

    // Move Boat
    // Speed is in "pixels per frame @ 60fps", so scale by timeScale
    state.boat.x += boatDirX * state.boat.speed * timeScale;
    state.boat.y += boatDirY * state.boat.speed * timeScale;

    // Collision Check with Marks
    if (state.course && state.course.marks) {
        const boatRadius = 20; // Approx half width of hull + buffer
        const markRadius = 12; // Visual radius of mark
        const collisionDist = boatRadius + markRadius;

        for (const mark of state.course.marks) {
            const dx = state.boat.x - mark.x;
            const dy = state.boat.y - mark.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < collisionDist) {
                // Collision detected
                triggerPenalty();

                // Calculate push-out vector (normal)
                // If centers are exactly same, pick random direction
                let nx = dx;
                let ny = dy;
                if (dist === 0) {
                    nx = 1;
                    ny = 0;
                } else {
                    nx /= dist;
                    ny /= dist;
                }

                // Resolve overlap
                const overlap = collisionDist - dist;
                // Add a small extra "bounce" buffer (20% of overlap)
                const pushAmt = overlap + 2.0;

                state.boat.x += nx * pushAmt;
                state.boat.y += ny * pushAmt;

                // Subtly bounce: Reduce speed
                state.boat.speed *= 0.5;
            }
        }
    }

    // Boundary Check
    if (state.course && state.course.boundary) {
        const dx = state.boat.x - state.course.boundary.x;
        const dy = state.boat.y - state.course.boundary.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > state.course.boundary.radius) {
             // Clamp position
             const angle = Math.atan2(dy, dx);
             state.boat.x = state.course.boundary.x + Math.cos(angle) * state.course.boundary.radius;
             state.boat.y = state.course.boundary.y + Math.sin(angle) * state.course.boundary.radius;
        }
    }

    // Update Race Logic
    updateRace(dt);

    // Store history
    state.race.lastPos.x = state.boat.x;
    state.race.lastPos.y = state.boat.y;

    // Penalty Tracking
    if (state.race.penalty) {
         // Use signed difference to ensure 720 in ONE direction
         const diff = normalizeAngle(state.boat.heading - state.boat.prevHeading);
         state.race.penaltyProgress += diff;

         if (Math.abs(state.race.penaltyProgress) >= 4 * Math.PI - 0.1) { // 720 deg (minus small tolerance)
             state.race.penalty = false;
             state.race.penaltyProgress = 0;
             hideRaceMessage();
         }
    }

    // Store prevHeading for next frame
    state.boat.prevHeading = state.boat.heading;

    // Wake Particles
    if (state.boat.speed > 0.25) {
        // Constants for wake geometry
        const sternOffset = 30;
        const sternWidth = 10;

        // Stern center position
        const sternX = state.boat.x - boatDirX * sternOffset;
        const sternY = state.boat.y - boatDirY * sternOffset;

        // Central Turbulence (Prop wash / drag)
        if (Math.random() < 0.2) {
            // Add some randomness to position
            const jitterX = (Math.random() - 0.5) * 4;
            const jitterY = (Math.random() - 0.5) * 4;
            createParticle(sternX + jitterX, sternY + jitterY, 'wake');
        }

        // V-Wake (Kelvin Wake)
        // Emit from corners of the stern, moving outwards
        if (Math.random() < 0.25) {
            // Right Vector (Perpendicular to Heading)
            const rightX = Math.cos(state.boat.heading);
            const rightY = Math.sin(state.boat.heading);

            // Stern Corners
            const leftSternX = sternX - rightX * sternWidth;
            const leftSternY = sternY - rightY * sternWidth;

            const rightSternX = sternX + rightX * sternWidth;
            const rightSternY = sternY + rightY * sternWidth;

            // Wave Velocity (Spreading out)
            const spreadSpeed = 0.1;

            // Left Wave
            createParticle(leftSternX, leftSternY, 'wake-wave', {
                vx: -rightX * spreadSpeed,
                vy: -rightY * spreadSpeed
            });

            // Right Wave
            createParticle(rightSternX, rightSternY, 'wake-wave', {
                vx: rightX * spreadSpeed,
                vy: rightY * spreadSpeed
            });
        }
    }

    // Camera follow boat if locked
    if (state.camera.target === 'boat') {
        state.camera.x += (state.boat.x - state.camera.x) * 0.1;
        state.camera.y += (state.boat.y - state.camera.y) * 0.1;
    }

    // Sail Logic
    // Determine wind side relative to boat
    let relWind = normalizeAngle(state.wind.direction - state.boat.heading);

    // Determine target boom side
    if (Math.abs(relWind) > 0.1) {
        state.boat.targetBoomSide = relWind > 0 ? 1 : -1;
    }

    // Smooth Boom Transition (Gybe/Tack animation)
    // Move boomSide towards targetBoomSide
    if (state.boat.boomSide !== state.boat.targetBoomSide) {
        // Swing speed
        let swingSpeed = 0.025;
        state.boat.boomSide += (state.boat.targetBoomSide - state.boat.boomSide) * swingSpeed;
        if (Math.abs(state.boat.targetBoomSide - state.boat.boomSide) < 0.01) {
            state.boat.boomSide = state.boat.targetBoomSide;
        }
    }

    // Sail Angle visual
    let optimalSailAngle = (angleToWind / 2);
    // Clamp to max 80 degrees
    if (optimalSailAngle > Math.PI/2.2) optimalSailAngle = Math.PI/2.2;

    state.boat.sailAngle = optimalSailAngle * state.boat.boomSide;

    // Wind Particles
    if (Math.random() < 0.2) {
        // Spawn around camera
        let range = Math.max(canvas.width, canvas.height) * 1.5;
        let px = state.camera.x + (Math.random() - 0.5) * range;
        let py = state.camera.y + (Math.random() - 0.5) * range;
        createParticle(px, py, 'wind', { life: Math.random() * 1.0 + 0.5 });
    }

    updateParticles(dt);
}

// Drawing Functions
function drawBoat(ctx) {
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(5, 5, 12, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hull
    const hullGradient = ctx.createLinearGradient(-15, 0, 15, 0);
    hullGradient.addColorStop(0, '#f1f5f9');
    hullGradient.addColorStop(1, '#e2e8f0');

    ctx.fillStyle = hullGradient;
    ctx.beginPath();
    ctx.moveTo(0, -25); // Bow
    ctx.bezierCurveTo(18, -10, 18, 20, 12, 30); // Starboard
    ctx.lineTo(-12, 30); // Stern
    ctx.bezierCurveTo(-18, 20, -18, -10, 0, -25); // Port
    ctx.fill();

    // Outline
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Deck detail (Cockpit)
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.roundRect(-8, 10, 16, 15, 4);
    ctx.fill();

    // Mast base
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(0, -5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Sails
    const drawSail = (isJib, scale = 1.0) => {
        ctx.save();
        if (isJib) {
             ctx.translate(0, -25);
             ctx.rotate(state.boat.sailAngle);
        } else {
             ctx.translate(0, -5);
             ctx.rotate(state.boat.sailAngle);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;

        // Calculate dynamic shape for luffing
        const luff = state.boat.luffIntensity || 0;
        const baseDepth = (isJib ? 11 : 15) * scale;
        let controlX = -state.boat.boomSide * baseDepth;

        if (luff > 0) {
             // Reduce static depth as luff increases (sail loses shape)
             const currentDepth = baseDepth * (1.0 - luff * 0.8);

             // Add flutter
             const time = state.time * 30; // Fast flutter frequency
             const flutterAmt = Math.sin(time) * baseDepth * 1.5 * luff;

             controlX = (-state.boat.boomSide * currentDepth) + flutterAmt;
        }

        ctx.beginPath();
        if (isJib) {
             ctx.moveTo(0, 0);
             ctx.lineTo(0, 28 * scale);
             ctx.quadraticCurveTo(controlX, 14 * scale, 0, 0);
        } else {
             ctx.moveTo(0, 0);
             ctx.lineTo(0, 45);
             ctx.quadraticCurveTo(controlX, 20, 0, 0);
        }
        ctx.fill();
        ctx.stroke();

        // Batten lines for detail
        if (!isJib) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.beginPath();

            // Calculate batten endpoints based on current controlX (approximately 1/3 and 2/3 down the curve)
            // Original ratios: 5/15 = 0.33, 9/15 = 0.6
            const batten1X = controlX * 0.33;
            const batten2X = controlX * 0.6;

            ctx.moveTo(0, 15); ctx.lineTo(batten1X, 12);
            ctx.moveTo(0, 30); ctx.lineTo(batten2X, 24);
            ctx.stroke();
        }

        // Boom
        if (!isJib) {
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, 45);
            ctx.stroke();
        }

        ctx.restore();
    };

    const drawSpinnaker = (scale = 1.0) => {
        ctx.save();
        // Start from bow/sprit
        ctx.translate(0, -28);
        ctx.rotate(state.boat.sailAngle);

        // Bright Red
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'; // Tailwind red-500
        ctx.strokeStyle = '#b91c1c'; // Tailwind red-700
        ctx.lineWidth = 1;

        // Calculate dynamic shape for luffing
        const luff = state.boat.luffIntensity || 0;
        const baseDepth = 40 * scale;
        let controlX = -state.boat.boomSide * baseDepth;

        if (luff > 0) {
             const currentDepth = baseDepth * (1.0 - luff * 0.9); // Spinnaker collapses more easily
             const time = state.time * 25; // Slightly slower, bigger heavy flutter
             const flutterAmt = Math.sin(time) * baseDepth * 1.2 * luff;
             controlX = (-state.boat.boomSide * currentDepth) + flutterAmt;
        }

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 50 * scale);
        // Larger curve for spinnaker
        ctx.quadraticCurveTo(controlX, 25 * scale, 0, 0);

        ctx.fill();
        ctx.stroke();
        ctx.restore();
    };

    drawSail(false); // Main

    // Animation Logic
    const progress = state.boat.spinnakerDeployProgress;
    const jibScale = Math.max(0, 1 - progress * 2);
    const spinScale = Math.max(0, (progress - 0.5) * 2);

    if (jibScale > 0.01) {
        drawSail(true, jibScale);
    }
    if (spinScale > 0.01) {
        drawSpinnaker(spinScale);
    }

    ctx.restore();
}

function drawActiveGateLine(ctx) {
    if (state.race.status === 'finished') return;
    if (!state.course || !state.course.marks) return;

    // Determine marks based on leg
    const indices = (state.race.leg % 2 === 0) ? [0, 1] : [2, 3];
    if (indices[1] >= state.course.marks.length) return;

    const m1 = state.course.marks[indices[0]];
    const m2 = state.course.marks[indices[1]];

    ctx.save();

    // Animate dashed line
    const dashSpeed = 20;
    const dashOffset = -state.time * dashSpeed;

    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.lineTo(m2.x, m2.y);

    // Styling: Glowing dashed orange line
    let shadowColor = '#fdba74'; // Orange-300
    let strokeColor = 'rgba(249, 115, 22, 0.7)'; // Orange-500

    // Use a different color for the start line before the race starts
    if (state.race.leg === 0 && state.race.status === 'prestart') {
        shadowColor = '#fde047'; // Yellow-300
        strokeColor = 'rgba(234, 179, 8, 0.7)'; // Yellow-600
    }

    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 15]);
    ctx.lineDashOffset = dashOffset;

    ctx.stroke();
    ctx.restore();
}

function drawParticles(ctx, layer) {
    if (layer === 'surface') {
        // Batch wake particles
        // Avoid changing fillStyle repeatedly if possible, but particles have different alphas.
        // However, we can use globalAlpha.
        ctx.fillStyle = '#ffffff';
        for (const p of state.particles) {
            if (p.type === 'wake' || p.type === 'wake-wave') {
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3 * p.scale, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;
    } else if (layer === 'air') {
        // Batch wind particles
        const windFactor = state.wind.speed / 10;
        const tailLength = 30 + state.wind.speed * 4;
        const dx = -Math.sin(state.wind.direction) * tailLength;
        const dy = Math.cos(state.wind.direction) * tailLength;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 + windFactor;

        for (const p of state.particles) {
            if (p.type === 'wind') {
                const opacity = Math.min(p.life, 1.0) * (0.15 + windFactor * 0.2);
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + dx, p.y + dy);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1.0;
    }
}

function drawWater(ctx) {
    // Background already filled

    const gridSize = 80;

    // Wave movement
    const waveSpeed = 20;
    const dist = state.time * waveSpeed;
    const shiftX = -Math.sin(state.wind.direction) * dist;
    const shiftY = Math.cos(state.wind.direction) * dist;

    // Viewport bounds for culling
    const pad = gridSize * 2;
    const left = state.camera.x - canvas.width / 2 - pad;
    const right = state.camera.x + canvas.width / 2 + pad;
    const top = state.camera.y - canvas.height / 2 - pad;
    const bottom = state.camera.y + canvas.height / 2 + pad;

    // Calculate grid start based on camera position minus shift, snapped to grid
    const startX = Math.floor((left - shiftX) / gridSize) * gridSize;
    const endX = Math.ceil((right - shiftX) / gridSize) * gridSize;
    const startY = Math.floor((top - shiftY) / gridSize) * gridSize;
    const endY = Math.ceil((bottom - shiftY) / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2.5;

    // Pre-calculate rotation math
    const angle = state.wind.direction + Math.PI;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Batch all waves into one path
    ctx.beginPath();

    // Iterate only over visible grid points
    for (let x = startX; x < endX; x += gridSize) {
        for (let y = startY; y < endY; y += gridSize) {
             let wx = x + shiftX;
             let wy = y + shiftY;

             // Draw little wave glyphs
             // Use unshifted 'x' and 'y' for noise so the shape travels with the wave
             const noise = Math.sin(x * 0.12 + y * 0.17);
             const windScale = Math.max(0.5, state.wind.speed / 10);
             const bob = Math.sin(state.time * 2 + noise * 10) * (3 * windScale);

             // Add some randomness
             const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
             const randX = (seed - Math.floor(seed)) * 40 - 20;
             const randY = (Math.cos(seed) * 0.5 + 0.5) * 40 - 20;
             let scale = (0.8 + ((seed * 10) % 1) * 0.4); // 0.8 to 1.2
             scale *= windScale;

             // Center of the wave glyph in world space
             const cx = wx + gridSize/2 + randX;
             const cy = wy + gridSize/2 + randY;

             // Manual Transform of 3 points: Start(-8, bob), Control(0, bob-6), End(8, bob)
             // Apply scale
             const s_p1x = -8 * scale;
             const s_p1y = bob * scale;

             const s_cpx = 0;
             const s_cpy = (bob - 6) * scale;

             const s_p2x = 8 * scale;
             const s_p2y = bob * scale;

             // Apply rotation and translation
             // x' = x*cos - y*sin + cx
             // y' = x*sin + y*cos + cy

             const p1x = s_p1x * cosA - s_p1y * sinA + cx;
             const p1y = s_p1x * sinA + s_p1y * cosA + cy;

             const cpx = s_cpx * cosA - s_cpy * sinA + cx;
             const cpy = s_cpx * sinA + s_cpy * cosA + cy;

             const p2x = s_p2x * cosA - s_p2y * sinA + cx;
             const p2y = s_p2x * sinA + s_p2y * cosA + cy;

             ctx.moveTo(p1x, p1y);
             ctx.quadraticCurveTo(cpx, cpy, p2x, p2y);
        }
    }
    // Single stroke for all waves
    ctx.stroke();
}

function drawMarkShadows(ctx) {
    if (!state.course || !state.course.marks) return;

    for (const m of state.course.marks) {
        ctx.save();
        ctx.translate(m.x, m.y);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(3, 3, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

function drawMarkBodies(ctx) {
    if (!state.course || !state.course.marks) return;

    for (const m of state.course.marks) {
        ctx.save();
        ctx.translate(m.x, m.y);

        // Bobbing animation
        const bobPhase = state.time * 5 + (m.x * 0.01 + m.y * 0.01);
        const bobScale = 1.0 + Math.sin(bobPhase) * 0.05;
        ctx.scale(bobScale, bobScale);

        // Determine if Active
        // Find mark index
        const markIndex = state.course.marks.indexOf(m);

        let isActive = false;
        // Determine active marks based on Leg
        // Leg 0: Marks 0,1 (Start)
        // Leg 1: Marks 2,3 (Upwind)
        // Leg 2: Marks 0,1 (Downwind)
        // Leg 3: Marks 2,3 (Upwind)
        // Leg 4: Marks 0,1 (Finish)

        // Also check Race Status. Only highlight if Prestart or Racing.
        if (state.race.status !== 'finished') {
             if (state.race.leg % 2 === 0) {
                 // Even legs (0, 2, 4) -> Marks 0,1
                 if (markIndex === 0 || markIndex === 1) isActive = true;
             } else {
                 // Odd legs (1, 3) -> Marks 2,3
                 if (markIndex === 2 || markIndex === 3) isActive = true;
             }
        }

        // Colors
        let cHighlight, cMid, cDark, cStroke;

        if (isActive) {
            cHighlight = '#fdba74'; // Light Orange
            cMid = '#f97316'; // Orange
            cDark = '#c2410c'; // Dark Orange
            cStroke = '#c2410c';
        } else {
            cHighlight = '#e2e8f0'; // Light Gray
            cMid = '#94a3b8'; // Gray
            cDark = '#64748b'; // Dark Gray
            cStroke = '#475569';
        }

        // Buoy body (Top down)
        const grad = ctx.createRadialGradient(-3, -3, 0, 0, 0, 12);
        grad.addColorStop(0, cHighlight);
        grad.addColorStop(0.5, cMid);
        grad.addColorStop(1, cDark);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.strokeStyle = cStroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
}

function drawBoundary(ctx) {
    if (!state.course || !state.course.boundary) return;

    const b = state.course.boundary;

    ctx.save();
    ctx.translate(b.x, b.y);

    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);

    // Dashed line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 15;
    ctx.setLineDash([40, 40]);
    ctx.stroke();

    // Inner glow/edge
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();

    ctx.restore();
}

function drawMinimap() {
    // Lazy init context
    if (!minimapCtx) {
        const mCanvas = document.getElementById('minimap');
        if (mCanvas) minimapCtx = mCanvas.getContext('2d');
    }
    const ctx = minimapCtx;

    if (!ctx || !state.course || !state.course.marks) return;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Determine bounds
    let minX = state.boat.x;
    let maxX = state.boat.x;
    let minY = state.boat.y;
    let maxY = state.boat.y;

    for (const m of state.course.marks) {
        if (m.x < minX) minX = m.x;
        if (m.x > maxX) maxX = m.x;
        if (m.y < minY) minY = m.y;
        if (m.y > maxY) maxY = m.y;
    }


    // Add padding
    const padding = 200;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    // Determine scale to fit
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const maxSpan = Math.max(spanX, spanY);
    const scale = (width - 20) / maxSpan; // Keep 20px margin in canvas

    // Center of the bounding box
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const transform = (x, y) => {
        return {
            x: (x - cx) * scale + width / 2,
            y: (y - cy) * scale + height / 2
        };
    };

    // Draw Boundary
    if (state.course.boundary) {
        const b = state.course.boundary;
        const pos = transform(b.x, b.y);
        const r = b.radius * scale;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw Marks
    ctx.fillStyle = '#22c55e'; // Green for high visibility
    for (const m of state.course.marks) {
        const pos = transform(m.x, m.y);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw Course Lines (Start/Finish and Gate)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Start Line (first two marks)
    if (state.course.marks.length >= 2) {
        const p1 = transform(state.course.marks[0].x, state.course.marks[0].y);
        const p2 = transform(state.course.marks[1].x, state.course.marks[1].y);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }
    // Upwind Gate (next two)
    if (state.course.marks.length >= 4) {
        const p3 = transform(state.course.marks[2].x, state.course.marks[2].y);
        const p4 = transform(state.course.marks[3].x, state.course.marks[3].y);
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
    }
    ctx.stroke();

    // Draw Boat
    const boatPos = transform(state.boat.x, state.boat.y);
    ctx.save();
    ctx.translate(boatPos.x, boatPos.y);
    ctx.rotate(state.boat.heading);

    // Simple Boat Shape
    ctx.fillStyle = '#facc15'; // Yellow
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.fill();

    ctx.restore();
}

let frameCount = 0;
function draw() {
    frameCount++;
    // Clear
    ctx.fillStyle = CONFIG.waterColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Camera Transform
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-state.camera.rotation);
    ctx.translate(-state.camera.x, -state.camera.y);

    // Draw World
    drawWater(ctx);
    drawBoundary(ctx);
    drawParticles(ctx, 'surface'); // Wake
    drawActiveGateLine(ctx);
    drawParticles(ctx, 'air'); // Wind
    drawMarkShadows(ctx);
    drawMarkBodies(ctx);

    // Draw Boat
    ctx.save();
    ctx.translate(state.boat.x, state.boat.y);
    ctx.rotate(state.boat.heading);
    drawBoat(ctx);
    ctx.restore();

    ctx.restore();

    // Draw Waypoint Indicator (Screen Space with Clamping)
    if (state.race.status !== 'finished') {
        const wx = state.race.nextWaypoint.x;
        const wy = state.race.nextWaypoint.y;

        // 1. World to Screen Transformation
        // Translate relative to camera
        const dx = wx - state.camera.x;
        const dy = wy - state.camera.y;

        // Rotate (inverse of camera rotation)
        const rot = -state.camera.rotation;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);

        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;

        // 2. Clamping Logic
        const margin = 40;
        const halfW = Math.max(10, canvas.width / 2 - margin);
        const halfH = Math.max(10, canvas.height / 2 - margin);

        // Calculate initial clamp factor to screen edges
        let t = 1.0;
        if (Math.abs(rx) > 0.1 || Math.abs(ry) > 0.1) {
            const tx = halfW / Math.abs(rx);
            const ty = halfH / Math.abs(ry);
            t = Math.min(tx, ty);
        }

        const factor = Math.min(t, 1.0);

        let screenX = canvas.width / 2 + rx * factor;
        let screenY = canvas.height / 2 + ry * factor;

        // 3. HUD Avoidance (Top Right Corner)
        // HUD is roughly 180px wide (160px + padding) and 350px tall (Compass + Minimap)
        const hudWidth = 200;
        const hudHeight = 400;

        // Check if we are in the Top-Right danger zone
        // Danger Zone: x > width - hudWidth AND y < hudHeight
        if (screenX > canvas.width - hudWidth && screenY < hudHeight) {
            // We need to push it out of this box.
            // Find the closest point on the boundary of the HUD box that is "towards" the target?
            // Or just snap to the edges of the exclusion zone.

            // If the target is primarily "Right", keep it on the Right edge but push Y down.
            // If the target is primarily "Top", keep it on Top edge but push X left.

            // Current clamped pos is on the screen edge (Top or Right).
            // If on Top Edge (y approx margin):
            if (screenY < margin + 10) {
                 // Push X to the left of HUD
                 screenX = canvas.width - hudWidth - 20;
            }
            // If on Right Edge (x approx width - margin):
            else if (screenX > canvas.width - margin - 10) {
                 // Push Y below HUD
                 screenY = hudHeight + 20;
            }
            // If it's somewhere inside (shouldn't happen with edge clamping unless corner), push to closest safe edge.
            else {
                 // It's inside the corner zone.
                 // Simple heuristic:
                 const distToLeft = screenX - (canvas.width - hudWidth);
                 const distToBottom = hudHeight - screenY;

                 if (distToLeft < distToBottom) {
                     screenX = canvas.width - hudWidth - 20;
                 } else {
                     screenY = hudHeight + 20;
                 }
            }
        }

        // Draw
        ctx.save();
        ctx.translate(screenX, screenY);

        // Draw green target circle
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Distance Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // Add text shadow for visibility
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(Math.round(state.race.nextWaypoint.dist) + 'm', 0, -12);

        ctx.restore();
    }

    // Minimap
    drawMinimap(); // Added back in

    // UI Updates - Using cached elements
    if (UI.compassRose) {
        // Rotate compass rose opposite to camera rotation so "North" points to actual North
        UI.compassRose.style.transform = `rotate(${-state.camera.rotation}rad)`;
    }

    if (UI.windArrow) {
        // Wind arrow is inside the compass rose, so we just rotate it to the absolute wind direction
        UI.windArrow.style.transform = `rotate(${state.wind.direction}rad)`;
    }

    if (UI.waypointArrow) {
        // Waypoint arrow logic:
        UI.waypointArrow.style.transform = `rotate(${state.race.nextWaypoint.angle}rad)`;
    }

    if (UI.headingArrow) {
        // Heading arrow (Red) rotates to show boat heading relative to camera
        const rot = state.boat.heading - state.camera.rotation;
        UI.headingArrow.style.transform = `rotate(${rot}rad)`;
    }

    // Throttle text updates to every 10 frames (~6Hz)
    if (frameCount % 10 === 0) {
        if (UI.speed) {
            // Convert to "knots" (internal speed * 2)
            UI.speed.textContent = (state.boat.speed * 4).toFixed(1);
        }

        if (UI.windSpeed) {
            UI.windSpeed.textContent = state.wind.speed.toFixed(1);
        }

        if (UI.windAngle) {
            // Calculate TWA in degrees
            const angleToWind = Math.abs(normalizeAngle(state.boat.heading - state.wind.direction));
            const twaDeg = Math.round(angleToWind * (180 / Math.PI));
            UI.windAngle.textContent = twaDeg + '°';
        }

        if (UI.timer) {
            if (state.race.status === 'finished') {
                 UI.timer.textContent = formatTime(state.race.finishTime);
                 UI.timer.classList.add('text-green-400');
            } else if (state.race.status === 'prestart') {
                 UI.timer.textContent = formatTime(-state.race.timer);
                 // Warn if < 10s
                 if (state.race.timer < 10) UI.timer.classList.add('text-orange-400');
                 else UI.timer.classList.remove('text-orange-400');
            } else {
                 // Racing
                 UI.timer.textContent = formatTime(state.race.timer);
                 UI.timer.classList.remove('text-orange-400');
                 UI.timer.classList.remove('text-green-400');
            }
        }
    }
}

let lastTime = 0;
function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Clamp dt to avoid huge jumps (e.g. max 0.1s)
    const safeDt = Math.min(dt, 0.1);

    update(safeDt);
    draw();
    requestAnimationFrame(loop);
}

// Course Management
function initCourse() {
    const windDir = state.wind.baseDirection;
    // Wind comes FROM windDir.
    // Upwind vector (into the wind) is opposite to wind flow.
    // Flow is South if windDir=0. So Upwind is North (0, -1).
    // sin(0)=0, -cos(0)=-1. So (sin(dir), -cos(dir)) is UPWIND vector.
    const ux = Math.sin(windDir);
    const uy = -Math.cos(windDir);

    // Perpendicular vector (Right side looking upwind)
    // dir=0, u=(0,-1). Right is East (1,0).
    // (-uy, ux) => (-(-1), 0) = (1, 0). Correct.
    const rx = -uy;
    const ry = ux;

    const boatLength = 55; // Approx length in pixels
    const gateWidth = 10 * boatLength;
    const courseDist = 4000; // Approx 200m scale

    // Start/Finish Line (Downwind) centered at 0,0
    // Marks are perpendicular to wind
    state.course = {
        marks: [
            // Start Line (Left/Right)
            { x: -rx * gateWidth/2, y: -ry * gateWidth/2, type: 'start' },
            { x: rx * gateWidth/2, y: ry * gateWidth/2, type: 'start' },
            // Upwind Gate (Left/Right)
            { x: (ux * courseDist) - (rx * gateWidth/2), y: (uy * courseDist) - (ry * gateWidth/2), type: 'mark' },
            { x: (ux * courseDist) + (rx * gateWidth/2), y: (uy * courseDist) + (ry * gateWidth/2), type: 'mark' }
        ],
        boundary: {
            x: ux * (courseDist / 2),
            y: uy * (courseDist / 2),
            radius: 3500 // Generous radius around course center
        }
    };
}

// Init
state.camera.target = 'boat';
// Randomize wind
state.wind.baseSpeed = 8 + Math.random() * 10; // Base between 8 and 18
state.wind.speed = state.wind.baseSpeed;
state.wind.baseDirection = (Math.random() - 0.5) * 0.5; // Slight variation from North (0)
state.wind.direction = state.wind.baseDirection;

initCourse();

// Start Boat near the start line (Downwind of it, facing upwind)
// Start line is at (0,0) relative to course logic if initCourse sets it there.
// Marks are perpendicular to wind.
// We want to be 'below' the line (downwind).
// Wind comes from 'direction'.
// Downwind is direction. Upwind is direction + PI.
// Move boat in direction of wind (downwind) from 0,0.
const startDist = 150;
state.boat.x = Math.sin(state.wind.direction) * startDist;
state.boat.y = -Math.cos(state.wind.direction) * startDist;
// Actually wind direction 0 means FROM North (blowing South).
// Vector (sin(0), -cos(0)) is (0, -1) which is North.
// Wait, standard math:
// Wind Dir 0 = North Wind (Blows South).
// Force vector: x += sin(0), y += cos(0) ??
// In update(): x -= sin(dir), y += cos(dir) for wind particles?
// Let's rely on initCourse vectors.
// ux, uy was UPWIND (into the wind).
// If we want to start DOWNWIND, we go -UPWIND.
// ux = sin(dir), uy = -cos(dir).
// So start pos = (-ux * 150, -uy * 150).
state.boat.x = -Math.sin(state.wind.direction) * 450;
state.boat.y = Math.cos(state.wind.direction) * 450;

// Face Upwind
state.boat.heading = state.wind.direction;

// Init Race History
state.race.lastPos.x = state.boat.x;
state.race.lastPos.y = state.boat.y;
state.boat.prevHeading = state.boat.heading;

requestAnimationFrame(loop);
