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
        manualTrim: false,
        manualSailAngle: 0, // Absolute value (magnitude) of sail angle
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
    showNavAids: true,
    particles: [], // For wake and wind effects
    keys: {
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false,
        Shift: false,
    },
    paused: false,
    time: 0,
    race: {
        status: 'prestart', // 'prestart', 'racing', 'finished'
        timer: 30.0,
        leg: 0, // 0=Start, 1=Upwind, 2=Downwind, 3=Upwind, 4=Finish
        ocs: false,
        penalty: false,
        penaltyProgress: 0,
        finishTime: 0,
        startTimeDisplay: 0,
        startTimeDisplayTimer: 0,
        legStartTime: 0,
        lastLegDuration: 0,
        legSplitTimer: 0,
        lastPos: { x: 0, y: 0 },
        nextWaypoint: { x: 0, y: 0, dist: 0, angle: 0 },
        trace: []
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
    helpButton: document.getElementById('help-button'),
    closeHelp: document.getElementById('close-help'),
    resumeHelp: document.getElementById('resume-help'),
    pauseButton: document.getElementById('pause-button'),
    resumeButton: document.getElementById('resume-button'),
    restartButton: document.getElementById('restart-button')
};

function togglePause(show) {
    const isPaused = state.paused;
    const shouldPause = show !== undefined ? show : !isPaused;

    if (shouldPause) {
        state.paused = true;
        if (UI.pauseScreen) UI.pauseScreen.classList.remove('hidden');
        if (UI.helpScreen) UI.helpScreen.classList.add('hidden');
    } else {
        state.paused = false;
        if (UI.pauseScreen) UI.pauseScreen.classList.add('hidden');
        // Reset lastTime to avoid huge dt jump on resume
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
    } else {
        UI.helpScreen.classList.add('hidden');
        state.paused = false;
        lastTime = 0;
    }
}

if (UI.helpButton) {
    UI.helpButton.addEventListener('click', (e) => {
        e.preventDefault();
        toggleHelp(true);
        UI.helpButton.blur();
    });
}
if (UI.closeHelp) {
    UI.closeHelp.addEventListener('click', () => toggleHelp(false));
}
if (UI.resumeHelp) {
    UI.resumeHelp.addEventListener('click', () => toggleHelp(false));
}
if (UI.pauseButton) {
    UI.pauseButton.addEventListener('click', (e) => {
        e.preventDefault();
        togglePause(true);
        UI.pauseButton.blur();
    });
}
if (UI.resumeButton) {
    UI.resumeButton.addEventListener('click', (e) => {
        e.preventDefault();
        togglePause(false);
    });
}
if (UI.restartButton) {
    UI.restartButton.addEventListener('click', (e) => {
        e.preventDefault();
        restartRace();
    });
}

let minimapCtx = null;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input Handling
window.addEventListener('keydown', (e) => {
    let key = e.key;
    if (key === 'a' || key === 'A') key = 'ArrowLeft';
    if (key === 'd' || key === 'D') key = 'ArrowRight';
    if (key === 'w' || key === 'W') key = 'ArrowUp';
    if (key === 's' || key === 'S') key = 'ArrowDown';

    if (state.keys.hasOwnProperty(key)) {
        state.keys[key] = true;
    }
    if (e.key === 'Enter') {
        const modes = ['heading', 'north', 'wind'];
        const currentIndex = modes.indexOf(state.camera.mode);
        state.camera.mode = modes[(currentIndex + 1) % modes.length];
    }
    if (e.key === ' ' || e.code === 'Space') {
        state.boat.spinnaker = !state.boat.spinnaker;
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        state.boat.manualTrim = !state.boat.manualTrim;
        if (state.boat.manualTrim) {
            // Initialize manual angle to current actual angle magnitude to avoid jumps
            state.boat.manualSailAngle = Math.abs(state.boat.sailAngle);
        }
    }
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        toggleHelp();
    }
    if (e.key === 'Escape') {
        if (UI.helpScreen && !UI.helpScreen.classList.contains('hidden')) {
            toggleHelp(false);
        } else {
            togglePause();
        }
    }
    if (e.key === 'F1') {
        e.preventDefault();
        // Capture screenshot of the entire body (including canvas + HUD)
        if (window.html2canvas) {
            window.html2canvas(document.body).then(canvas => {
                const link = document.createElement('a');
                link.download = 'regatta-screenshot.png';
                link.href = canvas.toDataURL();
                link.click();
            });
        }
    }
    if (e.key === '`' || e.code === 'Backquote') {
        state.showNavAids = !state.showNavAids;
    }
});

window.addEventListener('keyup', (e) => {
    let key = e.key;
    if (key === 'a' || key === 'A') key = 'ArrowLeft';
    if (key === 'd' || key === 'D') key = 'ArrowRight';
    if (key === 'w' || key === 'W') key = 'ArrowUp';
    if (key === 's' || key === 'S') key = 'ArrowDown';

    if (state.keys.hasOwnProperty(key)) {
        state.keys[key] = false;
    }
});

window.addEventListener('focus', () => {
    for (const key in state.keys) {
        state.keys[key] = false;
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

function formatSplitTime(seconds) {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.floor(Math.abs(seconds) % 60);
    const ms = Math.floor((Math.abs(seconds) % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
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
function rayCircleIntersection(ox, oy, dx, dy, cx, cy, r) {
    const lx = ox - cx;
    const ly = oy - cy;
    // t^2 + 2(L.D)t + (L.L - R^2) = 0
    // a = 1 since D is normalized
    const b = 2 * (lx * dx + ly * dy);
    const c = (lx * lx + ly * ly) - (r * r);

    const disc = b * b - 4 * c;
    if (disc < 0) return null;

    const t1 = (-b - Math.sqrt(disc)) / 2;
    const t2 = (-b + Math.sqrt(disc)) / 2;

    if (t1 >= 0) return t1;
    if (t2 >= 0) return t2;
    return null;
}

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
                const nx = gateDy;
                const ny = -gateDx;

                // Dot product of Boat Movement with Normal
                const moveDx = state.boat.x - state.race.lastPos.x;
                const moveDy = state.boat.y - state.race.lastPos.y;
                const dot = moveDx * nx + moveDy * ny;

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
                                state.race.startTimeDisplay = state.race.timer;
                                state.race.startTimeDisplayTimer = 5.0;
                            state.race.legStartTime = state.race.timer;
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

                            // Calculate split
                            const split = state.race.timer - state.race.legStartTime;
                            state.race.lastLegDuration = split;
                            if (state.race.leg > 1) { // Leg 1 finished (start->mark1)
                                state.race.legTimes.push(split);
                            }
                            state.race.legSplitTimer = 5.0;
                            state.race.legStartTime = state.race.timer;

                            if (state.race.leg > 4) {
                                state.race.finished = true;
                                state.race.status = 'finished';
                                state.race.finishTime = state.race.timer;
                                showRaceMessage("FINISHED!", "text-green-400", "border-green-400/50");
                            }
                        } else {
                            // Wrong way!
                            showRaceMessage("WRONG WAY!", "text-orange-500", "border-orange-500/50");
                            setTimeout(hideRaceMessage, 2000);
                        }
                    }
                }
            }
        }

        // Check for Reverse Crossing of Previous Gate (Rounding Enforcement)
        // If we are on Leg 2, 3, or 4, we must not cross the PREVIOUS gate in the reverse direction.
        // Leg 2 (Downwind): Prev was Upwind Gate (2-3). Cleared Upwind(1). Forbidden is Downwind(-1).
        // Leg 3 (Upwind): Prev was Leeward Gate (0-1). Cleared Downwind(-1). Forbidden is Upwind(1).
        // Leg 4 (Finish): Prev was Upwind Gate (2-3). Cleared Upwind(1). Forbidden is Downwind(-1).

        let prevGateIndices = [];
        let forbiddenDirection = 0;

        if (state.race.leg === 2) {
             prevGateIndices = [2, 3];
             forbiddenDirection = -1;
        } else if (state.race.leg === 3) {
             prevGateIndices = [0, 1];
             forbiddenDirection = 1;
        } else if (state.race.leg === 4) {
             prevGateIndices = [2, 3];
             forbiddenDirection = -1;
        }

        if (prevGateIndices.length > 0) {
            const pm1 = marks[prevGateIndices[0]];
            const pm2 = marks[prevGateIndices[1]];

            const pIntersect = checkLineIntersection(
                state.race.lastPos.x, state.race.lastPos.y, state.boat.x, state.boat.y,
                pm1.x, pm1.y, pm2.x, pm2.y
            );

            if (pIntersect) {
                const gateDx = pm2.x - pm1.x;
                const gateDy = pm2.y - pm1.y;
                const nx = gateDy;
                const ny = -gateDx;
                const moveDx = state.boat.x - state.race.lastPos.x;
                const moveDy = state.boat.y - state.race.lastPos.y;
                const dot = moveDx * nx + moveDy * ny;
                const crossingDir = dot > 0 ? 1 : -1;

                if (crossingDir === forbiddenDirection) {
                    // Revert Leg!
                    state.race.leg--;
                    showRaceMessage("MUST ROUND MARK!", "text-red-500", "border-red-500/50");
                    // Reset Split time logic if needed?
                    // Maybe clear split display
                    state.race.legSplitTimer = 0;
                    // Reset start time? Ideally we go back to previous state.
                    // But timer keeps running.
                }
            }
        }
    }

    // 2.5 Start Time Display Timer
    if (state.race.startTimeDisplayTimer > 0) {
        state.race.startTimeDisplayTimer -= dt;
    }
    if (state.race.legSplitTimer > 0) {
        state.race.legSplitTimer -= dt;
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

    // 5. Trace Recording
    // Record trace if race has started (Leg >= 1) and not finished
    if (state.race.leg >= 1 && state.race.status !== 'finished') {
        const trace = state.race.trace;
        const minRecordDistSq = 50 * 50; // Record every 50 units

        if (trace.length === 0) {
            trace.push({ x: state.boat.x, y: state.boat.y });
        } else {
            const last = trace[trace.length - 1];
            const dx = state.boat.x - last.x;
            const dy = state.boat.y - last.y;
            if (dx * dx + dy * dy > minRecordDistSq) {
                trace.push({ x: state.boat.x, y: state.boat.y });
            }
        }
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

    // --- Physics & Sail Logic ---

    // Wind Direction (Vector)
    const windDirX = Math.sin(state.wind.direction);
    const windDirY = -Math.cos(state.wind.direction);

    // Boat Heading Vector
    const boatDirX = Math.sin(state.boat.heading);
    const boatDirY = -Math.cos(state.boat.heading);

    // Angle of Attack (0 to PI)
    let angleToWind = Math.abs(normalizeAngle(state.boat.heading - state.wind.direction));

    // -- Sail Trim Logic --

    // Determine wind side relative to boat
    let relWind = normalizeAngle(state.wind.direction - state.boat.heading);

    // Determine target boom side
    if (Math.abs(relWind) > 0.1) {
        state.boat.targetBoomSide = relWind > 0 ? 1 : -1;
    }

    // Smooth Boom Transition (Gybe/Tack animation)
    if (state.boat.boomSide !== state.boat.targetBoomSide) {
        let swingSpeed = 0.025; // Adjusted for physics updates?
        state.boat.boomSide += (state.boat.targetBoomSide - state.boat.boomSide) * swingSpeed;
        if (Math.abs(state.boat.targetBoomSide - state.boat.boomSide) < 0.01) {
            state.boat.boomSide = state.boat.targetBoomSide;
        }
    }

    // Optimal Angle Calculation
    let optimalSailAngle = Math.max(0, angleToWind - (Math.PI / 4));
    if (optimalSailAngle > Math.PI/2.2) optimalSailAngle = Math.PI/2.2;

    // Manual Trim Controls
    if (state.boat.manualTrim) {
        const trimRate = 0.8 * dt; // Rad/sec (approx 45 deg per second)
        if (state.keys.ArrowUp) {
            // Let OUT (increase angle)
            state.boat.manualSailAngle = Math.min(Math.PI / 1.5, state.boat.manualSailAngle + trimRate); // Limit max let out to reasonable bounds
        }
        if (state.keys.ArrowDown) {
            // Trim IN (decrease angle)
            state.boat.manualSailAngle = Math.max(0, state.boat.manualSailAngle - trimRate);
        }
        // Set actual sail angle based on manual setting
        state.boat.sailAngle = state.boat.manualSailAngle * state.boat.boomSide;
    } else {
        // Auto: sync manual angle for smoothness if user switches
        state.boat.manualSailAngle = optimalSailAngle;
        state.boat.sailAngle = optimalSailAngle * state.boat.boomSide;
    }

    // Determine target speed from polars
    const progress = state.boat.spinnakerDeployProgress;
    const jibFactor = Math.max(0, 1 - progress * 2);
    const spinFactor = Math.max(0, (progress - 0.5) * 2);

    let targetKnotsJib = getTargetSpeed(angleToWind, false, state.wind.speed);
    let targetKnotsSpin = getTargetSpeed(angleToWind, true, state.wind.speed);

    let targetKnots = targetKnotsJib * jibFactor + targetKnotsSpin * spinFactor;

    // Apply Trim Efficiency Penalty
    // Calculate difference between actual and optimal
    const actualMagnitude = Math.abs(state.boat.sailAngle);
    const angleDiff = Math.abs(actualMagnitude - optimalSailAngle);

    // Penalty curve: 1.0 - (diff * factor)
    // 0.2 rad diff (~11 deg) -> 1.0 - 0.4 = 0.6 (40% loss)
    // 0.5 rad diff (~28 deg) -> 1.0 - 1.0 = 0 (Stop)
    const penaltyFactor = 2.0;
    const trimEfficiency = Math.max(0, 1.0 - angleDiff * penaltyFactor);

    targetKnots *= trimEfficiency;

    let targetGameSpeed = targetKnots * 0.25;

    // Determine Luffing state
    // Old logic: just based on targetKnots < 1.0
    // New logic: Based on effective angle of attack (AoA)
    // Effective AoA = angleToWind - sailAngle (magnitude)
    // If Eff AoA is too small (sail aligned with wind), it luffs.
    const effectiveAoA = angleToWind - actualMagnitude;

    // Thresholds:
    // Ideally AoA is ~45 deg (0.78 rad).
    // If AoA < 20 deg (0.35 rad), start luffing intensity.
    const luffStartThreshold = 0.5; // rad

    // Also consider standard "Too close to wind" (Heading) which also produces low AoA naturally
    // If angleToWind is small, optimalSailAngle is 0. So effectiveAoA = angleToWind.
    // So this unified logic works for both "Pointing too high" and "Letting sail out too much".

    if (effectiveAoA < luffStartThreshold) {
        state.boat.luffIntensity = Math.max(0, 1.0 - (effectiveAoA / luffStartThreshold));
        state.boat.luffing = true;
    } else {
        state.boat.luffIntensity = 0;
        state.boat.luffing = false;
    }

    // Smoothly interpolate current speed to target speed (acceleration/deceleration)
    const speedAlpha = 1 - Math.pow(0.995, timeScale);
    state.boat.speed = state.boat.speed * (1 - speedAlpha) + targetGameSpeed * speedAlpha;

    if (isTurning) {
        state.boat.speed *= Math.pow(CONFIG.turnPenalty, timeScale);
    }

    // Move Boat
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
         const diff = normalizeAngle(state.boat.heading - state.boat.prevHeading);
         state.race.penaltyProgress += diff;

         if (Math.abs(state.race.penaltyProgress) >= 4 * Math.PI - 0.1) {
             state.race.penalty = false;
             state.race.penaltyProgress = 0;
             hideRaceMessage();
         }
    }

    // Store prevHeading for next frame
    state.boat.prevHeading = state.boat.heading;

    // Wake Particles
    if (state.boat.speed > 0.25) {
        const sternOffset = 30;
        const sternWidth = 10;
        const sternX = state.boat.x - boatDirX * sternOffset;
        const sternY = state.boat.y - boatDirY * sternOffset;

        if (Math.random() < 0.2) {
            const jitterX = (Math.random() - 0.5) * 4;
            const jitterY = (Math.random() - 0.5) * 4;
            createParticle(sternX + jitterX, sternY + jitterY, 'wake');
        }

        if (Math.random() < 0.25) {
            const rightX = Math.cos(state.boat.heading);
            const rightY = Math.sin(state.boat.heading);
            const leftSternX = sternX - rightX * sternWidth;
            const leftSternY = sternY - rightY * sternWidth;
            const rightSternX = sternX + rightX * sternWidth;
            const rightSternY = sternY + rightY * sternWidth;
            const spreadSpeed = 0.1;

            createParticle(leftSternX, leftSternY, 'wake-wave', {
                vx: -rightX * spreadSpeed,
                vy: -rightY * spreadSpeed
            });

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

    // Wind Particles
    if (Math.random() < 0.2) {
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

        // Flatten sail when sheeted in (Close Hauled)
        // Full depth at > 45 degrees sail angle, reduced depth at 0 degrees
        const angleRatio = Math.min(1.0, Math.abs(state.boat.sailAngle) / (Math.PI / 4));
        const flattenFactor = 0.6 + 0.4 * angleRatio;

        const baseDepth = (isJib ? 11 : 15) * scale * flattenFactor;
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

function drawRoundingArrows(ctx) {
    if (!state.showNavAids) return;
    if (!state.course || !state.course.marks) return;
    if (state.race.status === 'finished') return;

    // Determine active marks and direction
    let activeMarks = [];
    if (state.race.leg === 1 || state.race.leg === 3) {
        // Upwind Gate (Marks 2 & 3)
        activeMarks = [
            { index: 2, ccw: true },
            { index: 3, ccw: false }
        ];
    } else if (state.race.leg === 2) {
        // Leeward Gate (Marks 0 & 1)
        activeMarks = [
            { index: 0, ccw: false },
            { index: 1, ccw: true }
        ];
    } else {
        return;
    }

    ctx.save();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#bfdbfe'; // Blue-200 (High contrast light blue)
    ctx.fillStyle = '#bfdbfe';
    ctx.lineCap = 'round';

    // Use base direction to align with course
    const windDir = state.wind.baseDirection;
    const radius = 80;

    for (const item of activeMarks) {
        if (item.index >= state.course.marks.length) continue;
        const m = state.course.marks[item.index];

        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(windDir); // Rotate to align with wind (North Up in local space)

        let startAngle, endAngle, counterClockwise;

        // Upwind Leg (Sailing North relative to wind):
        // Mark 2 (Left): Round CCW. 0 -> PI.
        // Mark 3 (Right): Round CW. PI -> 0.
        // Downwind Leg (Sailing South relative to wind):
        // Mark 0 (Left/West): Round CW. 0 -> PI.
        // Mark 1 (Right/East): Round CCW. PI -> 0.

        if (state.race.leg === 1 || state.race.leg === 3) {
             if (item.index === 2) {
                 startAngle = 0; endAngle = Math.PI; counterClockwise = true;
             } else {
                 startAngle = Math.PI; endAngle = 0; counterClockwise = false;
             }
        } else {
             if (item.index === 0) {
                 startAngle = 0; endAngle = Math.PI; counterClockwise = false;
             } else {
                 startAngle = Math.PI; endAngle = 0; counterClockwise = true;
             }
        }

        ctx.beginPath();
        ctx.arc(0, 0, radius, startAngle, endAngle, counterClockwise);
        ctx.stroke();

        // Arrowhead
        const tipX = radius * Math.cos(endAngle);
        const tipY = radius * Math.sin(endAngle);

        // Tangent angle for arrowhead rotation
        // If CW (positive delta), tangent is Angle + PI/2
        // If CCW (negative delta), tangent is Angle - PI/2
        let tangent = endAngle + (counterClockwise ? -Math.PI/2 : Math.PI/2);

        ctx.translate(tipX, tipY);
        ctx.rotate(tangent);

        ctx.beginPath();
        ctx.moveTo(-10, -10); // Back Left
        ctx.lineTo(10, 0);    // Tip
        ctx.lineTo(-10, 10);  // Back Right
        ctx.lineTo(-6, 0);    // Notch
        ctx.fill();

        ctx.restore();
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
    let shadowColor = '#fef08a'; // Yellow-200
    let strokeColor = 'rgba(250, 204, 21, 0.9)'; // Yellow-400

    // Use a different color for the start line before the race starts
    if (state.race.leg === 0 && state.race.status === 'prestart') {
        shadowColor = '#cbd5e1'; // Slate-300 (Gray)
        strokeColor = 'rgba(148, 163, 184, 0.7)'; // Slate-400 (Gray)
    }

    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 5;
    ctx.setLineDash([20, 15]);
    ctx.lineDashOffset = dashOffset;

    ctx.stroke();
    ctx.restore();
}

function drawLadderLines(ctx) {
    if (!state.showNavAids) return;
    if (state.race.status === 'prestart' || state.race.status === 'finished') return;
    if (!state.course || !state.course.marks) return;

    // Use base direction for the grid to keep it stable
    const windDir = state.wind.baseDirection;
    const wx = Math.sin(windDir);
    const wy = -Math.cos(windDir);
    const px = -wy;
    const py = wx;

    // Determine range based on leg
    let prevIndex, nextIndex;
    if (state.race.leg === 0 || state.race.leg % 2 !== 0) {
        prevIndex = 0; // Start/Leeward (Marks 0,1)
        nextIndex = 2; // Upwind (Marks 2,3)
    } else {
        prevIndex = 2;
        nextIndex = 0;
    }

    const mPrev = state.course.marks[prevIndex];
    const mNext = state.course.marks[nextIndex];

    // Project onto wind axis
    const startProj = mPrev.x * wx + mPrev.y * wy;
    const endProj = mNext.x * wx + mNext.y * wy;

    // We want to calculate distance to the NEXT gate
    // Upwind Leg (Leg 1,3): endProj is Upwind (higher value? or lower depending on wind)
    // Wind is direction FROM. 0 = North blowing South.
    // wx = 0, wy = -1.
    // Upwind is -wy -> +y.
    // wait, 0 is blowing SOUTH. So vectors move south.
    // Upwind means moving AGAINST wind. So North.
    // Let's use absolute distance math.

    // Sort
    let minP = Math.min(startProj, endProj);
    let maxP = Math.max(startProj, endProj);

    const interval = 500;
    const firstLine = Math.floor(minP / interval) * interval;

    // Layline Clipping Logic
    // Project Marks to U,V space (U = Wind Axis, V = Cross Axis)
    // U axis is defined by (wx, wy). V axis is (px, py).
    // V = x * px + y * py
    const uL = mNext.x * wx + mNext.y * wy;
    const vL = mNext.x * px + mNext.y * py;
    const mNextRight = state.course.marks[nextIndex + 1];
    const uR = mNextRight.x * wx + mNextRight.y * wy;
    const vR = mNextRight.x * px + mNextRight.y * py;

    // Boundary Projection
    const b = state.course.boundary;
    const uC = b.x * wx + b.y * wy;
    const vC = b.x * px + b.y * py;
    const R = b.radius;

    const isUpwindTarget = (nextIndex === 2); // Target is Marks 2,3 (Upwind)

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Increased opacity
    ctx.lineWidth = 4; // Thicker lines
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let p = firstLine; p <= maxP; p += interval) {
        if (p < minP) continue;

        // 1. Calculate Layline Bounds at this U (p)
        // Ladder lines are only drawn between gates, so we are always on the "course side" of the target.
        // Laylines extend away from the target gate, so the valid width increases as we move away.
        const dist = Math.abs(p - uL);
        const vMin = vL - dist;
        const vMax = vR + dist;

        // 2. Clip to Boundary
        // Circle at uC, vC with radius R
        // Chord at U = p
        const du = p - uC;
        if (Math.abs(du) >= R) continue; // Outside circle

        const dv = Math.sqrt(R*R - du*du);
        const cMin = vC - dv;
        const cMax = vC + dv;

        // Intersection
        const finalMin = Math.max(vMin, cMin);
        const finalMax = Math.min(vMax, cMax);

        if (finalMin < finalMax) {
            const cx = p * wx;
            const cy = p * wy;

            // Convert start/end V back to world space relative to center (cx, cy)
            // Center is at V=0? No.
            // P = (cx, cy) + v * (px, py)
            const x1 = cx + finalMin * px;
            const y1 = cy + finalMin * py;
            const x2 = cx + finalMax * px;
            const y2 = cy + finalMax * py;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Label: Distance to NEXT gate
            const distToGate = Math.abs(endProj - p) * 0.2;
            if (distToGate > 50) {
                // Draw label at some offset, clamped to line
                // Center of line
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                // If line is too short, maybe don't draw label?
                if (finalMax - finalMin > 200) {
                     ctx.fillText(Math.round(distToGate) + 'm', midX, midY);
                }
            }
        }
    }
    ctx.restore();
}

function drawLayLines(ctx) {
    if (!state.showNavAids) return;
    if (state.race.status === 'finished') return;
    if (!state.course || !state.course.marks) return;

    let targets = [];
    if (state.race.leg % 2 === 0) {
        targets = [0, 1]; // Leeward/Start
    } else {
        targets = [2, 3]; // Upwind
    }

    const windDir = state.wind.direction;
    const isUpwindLeg = (state.race.leg % 2 !== 0) || (state.race.leg === 0);
    const boundary = state.course.boundary;

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 5; // Thicker
    const zoneRadius = 165;

    for (const idx of targets) {
        if (idx >= state.course.marks.length) continue;
        const m = state.course.marks[idx];

        // Laylines at 45 degrees relative to wind
        const ang1 = windDir + Math.PI / 4;
        const ang2 = windDir - Math.PI / 4;

        // Logic:
        // Indices 0, 2 are "Left" Marks (relative to course axis)
        // Indices 1, 3 are "Right" Marks
        const isLeftMark = (idx % 2 === 0);

        const drawRay = (angle) => {
             let drawAngle = angle;
             if (isUpwindLeg) {
                 drawAngle += Math.PI; // Extend downwind
             }

             const dx = Math.sin(drawAngle);
             const dy = -Math.cos(drawAngle);

             // Start from outside zone radius
             const startX = m.x + dx * zoneRadius;
             const startY = m.y + dy * zoneRadius;

             // Find intersection with boundary
             const t = rayCircleIntersection(startX, startY, dx, dy, boundary.x, boundary.y, boundary.radius);

             if (t !== null) {
                 ctx.strokeStyle = '#facc15'; // Solid Yellow
                 ctx.beginPath();
                 ctx.moveTo(startX, startY);
                 ctx.lineTo(startX + dx * t, startY + dy * t);
                 ctx.stroke();
             }
        };

        if (isUpwindLeg) {
            if (isLeftMark) {
                drawRay(ang1);
            } else {
                drawRay(ang2);
            }
        } else {
            // Downwind - swap angles
            if (isLeftMark) {
                drawRay(ang2);
            } else {
                drawRay(ang1);
            }
        }
    }
    ctx.restore();
}

function drawMarkZones(ctx) {
    if (!state.showNavAids) return;
    if (!state.course || !state.course.marks) return;
    if (state.race.status === 'finished') return;

    // Determine active mark indices for zones
    // Leg 1 (Upwind) -> 2, 3
    // Leg 2 (Downwind) -> 0, 1
    // Leg 3 (Upwind) -> 2, 3
    // Others (0, 4) -> None
    let activeIndices = [];
    if (state.race.leg === 1 || state.race.leg === 3) {
        activeIndices = [2, 3];
    } else if (state.race.leg === 2) {
        activeIndices = [0, 1];
    }

    if (activeIndices.length === 0) return;

    ctx.save();
    ctx.lineWidth = 5; // Thicker
    ctx.setLineDash([]);
    // Solid line, no rotation needed

    const zoneRadius = 165;

    // Calculate Boat Segment (Centerline from Bow to Stern)
    const h = state.boat.heading;
    const sinH = Math.sin(h);
    const cosH = Math.cos(h);

    // Bow (0, -25) relative
    const bowX = state.boat.x + 25 * sinH;
    const bowY = state.boat.y - 25 * cosH;

    // Stern (0, 30) relative
    const sternX = state.boat.x - 30 * sinH;
    const sternY = state.boat.y + 30 * cosH;

    for (const idx of activeIndices) {
        if (idx >= state.course.marks.length) continue;
        const m = state.course.marks[idx];

        // Check if ANY part of the boat is in the zone
        // We approximate the boat as a line segment from Bow to Stern
        const closest = getClosestPointOnSegment(m.x, m.y, bowX, bowY, sternX, sternY);
        const dx = closest.x - m.x;
        const dy = closest.y - m.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < zoneRadius * zoneRadius) {
            ctx.strokeStyle = '#facc15'; // Bright Yellow
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // More opaque
        }

        ctx.beginPath();
        ctx.arc(m.x, m.y, zoneRadius, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

function drawParticles(ctx, layer) {
    if (layer === 'surface') {
        // Batch wake particles
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
             const s_p1x = -8 * scale;
             const s_p1y = bob * scale;

             const s_cpx = 0;
             const s_cpy = (bob - 6) * scale;

             const s_p2x = 8 * scale;
             const s_p2y = bob * scale;

             // Apply rotation and translation
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
        const markIndex = state.course.marks.indexOf(m);

        let isActive = false;
        if (state.race.status !== 'finished') {
             if (state.race.leg % 2 === 0) {
                 if (markIndex === 0 || markIndex === 1) isActive = true;
             } else {
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

    // Draw Trace
    if (state.race.trace && state.race.trace.length > 0) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)'; // Yellow-400, semi-transparent
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const startPos = transform(state.race.trace[0].x, state.race.trace[0].y);
        ctx.moveTo(startPos.x, startPos.y);

        for (let i = 1; i < state.race.trace.length; i++) {
            const p = transform(state.race.trace[i].x, state.race.trace[i].y);
            ctx.lineTo(p.x, p.y);
        }
        // Draw to current boat position
        const currentPos = transform(state.boat.x, state.boat.y);
        ctx.lineTo(currentPos.x, currentPos.y);

        ctx.stroke();
    }

    // Determine Active Gate Index
    // Leg 0, 2, 4 -> Start/Finish (Indices 0,1)
    // Leg 1, 3 -> Upwind (Indices 2,3)
    let activeIndices = (state.race.leg % 2 === 0) ? [0, 1] : [2, 3];
    if (state.race.status === 'finished') activeIndices = [];

    // Draw Gate Lines
    const gate1Active = activeIndices.includes(0);
    const gate2Active = activeIndices.includes(2);

    const drawGate = (i1, i2, isActive) => {
        if (i1 >= state.course.marks.length || i2 >= state.course.marks.length) return;

        const p1 = transform(state.course.marks[i1].x, state.course.marks[i1].y);
        const p2 = transform(state.course.marks[i2].x, state.course.marks[i2].y);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        if (isActive) {
             ctx.strokeStyle = '#facc15'; // Yellow
             ctx.lineWidth = 2;
        } else {
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // Faint gray
             ctx.lineWidth = 1;
        }
        ctx.stroke();
    };

    drawGate(0, 1, gate1Active);
    drawGate(2, 3, gate2Active);

    // Draw Marks
    for (let i = 0; i < state.course.marks.length; i++) {
        const m = state.course.marks[i];
        const pos = transform(m.x, m.y);
        const isActive = activeIndices.includes(i);

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isActive ? 4 : 3, 0, Math.PI * 2);

        if (isActive) {
            ctx.fillStyle = '#f97316'; // Orange
        } else {
            ctx.fillStyle = '#94a3b8'; // Slate-400
        }
        ctx.fill();
    }

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
    drawLadderLines(ctx);
    drawLayLines(ctx);
    drawMarkZones(ctx);
    drawRoundingArrows(ctx);
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

    // Draw Waypoint Indicator
    if (state.race.status !== 'finished') {
        const wx = state.race.nextWaypoint.x;
        const wy = state.race.nextWaypoint.y;

        const dx = wx - state.camera.x;
        const dy = wy - state.camera.y;
        const rot = -state.camera.rotation;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);

        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;

        const margin = 40;
        const halfW = Math.max(10, canvas.width / 2 - margin);
        const halfH = Math.max(10, canvas.height / 2 - margin);

        let t = 1.0;
        if (Math.abs(rx) > 0.1 || Math.abs(ry) > 0.1) {
            const tx = halfW / Math.abs(rx);
            const ty = halfH / Math.abs(ry);
            t = Math.min(tx, ty);
        }

        const factor = Math.min(t, 1.0);

        let screenX = canvas.width / 2 + rx * factor;
        let screenY = canvas.height / 2 + ry * factor;

        const hudWidth = 200;
        const hudHeight = 400;

        if (screenX > canvas.width - hudWidth && screenY < hudHeight) {
            if (screenY < margin + 10) {
                 screenX = canvas.width - hudWidth - 20;
            }
            else if (screenX > canvas.width - margin - 10) {
                 screenY = hudHeight + 20;
            }
            else {
                 const distToLeft = screenX - (canvas.width - hudWidth);
                 const distToBottom = hudHeight - screenY;

                 if (distToLeft < distToBottom) {
                     screenX = canvas.width - hudWidth - 20;
                 } else {
                     screenY = hudHeight + 20;
                 }
            }
        }

        ctx.save();
        ctx.translate(screenX, screenY);

        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(Math.round(state.race.nextWaypoint.dist) + 'm', 0, -12);

        ctx.restore();
    }

    drawMinimap();

    // UI Updates
    if (UI.compassRose) {
        UI.compassRose.style.transform = `rotate(${-state.camera.rotation}rad)`;
    }

    if (UI.windArrow) {
        UI.windArrow.style.transform = `rotate(${state.wind.direction}rad)`;
    }

    if (UI.waypointArrow) {
        UI.waypointArrow.style.transform = `rotate(${state.race.nextWaypoint.angle}rad)`;
    }

    if (UI.headingArrow) {
        const rot = state.boat.heading - state.camera.rotation;
        UI.headingArrow.style.transform = `rotate(${rot}rad)`;
    }

    if (frameCount % 10 === 0) {
        if (UI.speed) {
            UI.speed.textContent = (state.boat.speed * 4).toFixed(1);
        }

        if (UI.windSpeed) {
            UI.windSpeed.textContent = state.wind.speed.toFixed(1);
        }

        if (UI.windAngle) {
            const angleToWind = Math.abs(normalizeAngle(state.boat.heading - state.wind.direction));
            const twaDeg = Math.round(angleToWind * (180 / Math.PI));
            UI.windAngle.textContent = twaDeg + '°';
        }

        if (UI.vmg) {
            const angleToWind = normalizeAngle(state.boat.heading - state.wind.direction);
            const vmg = (state.boat.speed * 4) * Math.cos(angleToWind);
            UI.vmg.textContent = Math.abs(vmg).toFixed(1);
        }

        // Update Trim Mode Indicator
        if (UI.trimMode) {
            if (state.boat.manualTrim) {
                UI.trimMode.textContent = "MANUAL";
                UI.trimMode.className = "mt-1 text-[10px] font-bold text-yellow-300 bg-slate-900/80 px-2 py-0.5 rounded-full border border-yellow-500/50 uppercase tracking-wider";
            } else {
                UI.trimMode.textContent = "AUTO";
                UI.trimMode.className = "mt-1 text-[10px] font-bold text-emerald-300 bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-500/50 uppercase tracking-wider";
            }
        }

        if (UI.timer) {
            if (state.race.status === 'finished') {
                 UI.timer.textContent = formatTime(state.race.finishTime);
                 UI.timer.classList.add('text-green-400');
            } else if (state.race.status === 'prestart') {
                 UI.timer.textContent = formatTime(-state.race.timer);
                 if (state.race.timer < 10) UI.timer.classList.add('text-orange-400');
                 else UI.timer.classList.remove('text-orange-400');
            } else {
                 UI.timer.textContent = formatTime(state.race.timer);
                 UI.timer.classList.remove('text-orange-400');
                 UI.timer.classList.remove('text-green-400');
            }
        }

        if (UI.startTime) {
            if (state.race.legSplitTimer > 0) {
                UI.startTime.textContent = formatSplitTime(state.race.lastLegDuration);
                UI.startTime.classList.remove('hidden');
            } else if (state.race.startTimeDisplayTimer > 0) {
                const t = state.race.startTimeDisplay;
                UI.startTime.textContent = '+' + t.toFixed(3) + 's';
                UI.startTime.classList.remove('hidden');
            } else {
                UI.startTime.classList.add('hidden');
            }
        }

        // Update Leg Info
        if (UI.legInfo) {
            let info = "";
            if (state.race.status === 'prestart') {
                info = "PRESTART";
            } else if (state.race.status === 'finished') {
                info = "FINISHED";
            } else {
                if (state.race.leg === 0) {
                    info = "START";
                } else {
                    const legType = (state.race.leg % 2 !== 0) ? "UPWIND" : "DOWNWIND";
                    info = `LEG ${state.race.leg} OF 4: ${legType}`;
                }
            }
            UI.legInfo.textContent = info;
        }

        // Update Leg Times List
        if (UI.legTimes) {
             let html = "";
             if (state.race.legTimes) {
                 for (let i = 0; i < state.race.legTimes.length; i++) {
                      const legNum = i + 1;
                      const timeStr = formatSplitTime(state.race.legTimes[i]);
                      html += `<div class="bg-slate-900/60 text-slate-300 font-mono text-xs font-bold px-2 py-0.5 rounded border-l-2 border-slate-500 shadow-md">Leg ${legNum}: ${timeStr}</div>`;
                 }
             }
             UI.legTimes.innerHTML = html;
        }
    }
}

let lastTime = 0;
function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    const safeDt = Math.min(dt, 0.1);

    if (!state.paused) {
        update(safeDt);
        draw();
    }
    requestAnimationFrame(loop);
}

// Course Management
function initCourse() {
    const windDir = state.wind.baseDirection;
    const ux = Math.sin(windDir);
    const uy = -Math.cos(windDir);
    const rx = -uy;
    const ry = ux;

    const boatLength = 55;
    const gateWidth = 10 * boatLength;
    const courseDist = 4000;

    state.course = {
        marks: [
            { x: -rx * gateWidth/2, y: -ry * gateWidth/2, type: 'start' },
            { x: rx * gateWidth/2, y: ry * gateWidth/2, type: 'start' },
            { x: (ux * courseDist) - (rx * gateWidth/2), y: (uy * courseDist) - (ry * gateWidth/2), type: 'mark' },
            { x: (ux * courseDist) + (rx * gateWidth/2), y: (uy * courseDist) + (ry * gateWidth/2), type: 'mark' }
        ],
        boundary: {
            x: ux * (courseDist / 2),
            y: uy * (courseDist / 2),
            radius: 3500
        }
    };
}

function resetGame() {
    state.camera.target = 'boat';
    state.wind.baseSpeed = 8 + Math.random() * 10;
    state.wind.speed = state.wind.baseSpeed;
    state.wind.baseDirection = (Math.random() - 0.5) * 0.5;
    state.wind.direction = state.wind.baseDirection;

    state.time = 0;
    state.boat.velocity = { x: 0, y: 0 };
    state.boat.speed = 0;
    state.boat.sailAngle = 0;
    state.boat.manualTrim = false;
    state.boat.manualSailAngle = 0;
    state.boat.boomSide = 1;
    state.boat.targetBoomSide = 1;
    state.boat.luffing = false;
    state.boat.luffIntensity = 0;
    state.boat.spinnaker = false;
    state.boat.spinnakerDeployProgress = 0;

    state.race.status = 'prestart';
    state.race.timer = 30.0;
    state.race.leg = 0;
    state.race.ocs = false;
    state.race.penalty = false;
    state.race.penaltyProgress = 0;
    state.race.finishTime = 0;
    state.race.startTimeDisplay = 0;
    state.race.startTimeDisplayTimer = 0;
    state.race.legStartTime = 0;
    state.race.lastLegDuration = 0;
    state.race.legSplitTimer = 0;
    state.race.legTimes = [];
    state.race.trace = [];
    state.particles = [];

    initCourse();

    const startDist = 150;
    state.boat.x = -Math.sin(state.wind.direction) * 450;
    state.boat.y = Math.cos(state.wind.direction) * 450;
    state.boat.heading = state.wind.direction;

    state.race.lastPos.x = state.boat.x;
    state.race.lastPos.y = state.boat.y;
    state.boat.prevHeading = state.boat.heading;

    hideRaceMessage();
}

function restartRace() {
    resetGame();
    togglePause(false);
}

// Init
resetGame();
requestAnimationFrame(loop);
