// Game Configuration
const CONFIG = {
    turnSpeed: 0.01,
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
    },
    time: 0
};

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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

function updateParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];

        // Apply velocity if present
        if (p.vx) p.x += p.vx;
        if (p.vy) p.y += p.vy;

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
             p.x -= Math.sin(state.wind.direction) * speed;
             p.y += Math.cos(state.wind.direction) * speed;
        }

        p.life -= decay;

        if (p.life <= 0) {
            state.particles.splice(i, 1);
        }
    }
}

// Update Loop
function update() {
    state.time += 0.004;
    const dt = 1/60; // Assume 60fps for switch timing

    // Sail Switching Logic
    const switchSpeed = dt / 5.0; // 5.0 seconds switch time
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
    if (state.camera.mode === 'heading') {
        // Smoothly rotate towards boat heading
        let diff = normalizeAngle(state.boat.heading - state.camera.rotation);
        state.camera.rotation += diff * 0.1;
    } else if (state.camera.mode === 'north') {
        // Rotate towards 0
        let diff = normalizeAngle(0 - state.camera.rotation);
        state.camera.rotation += diff * 0.1;
    } else if (state.camera.mode === 'wind') {
        // Rotate towards wind direction (so wind comes from top)
        let diff = normalizeAngle(state.wind.direction - state.camera.rotation);
        state.camera.rotation += diff * 0.1;
    }

    // Boat Steering
    if (state.keys.ArrowLeft) {
        state.boat.heading -= CONFIG.turnSpeed;
    }
    if (state.keys.ArrowRight) {
        state.boat.heading += CONFIG.turnSpeed;
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
    // Momentum factor: 0.98 (retains 98% of old speed), 0.02 (adds 2% of new)
    state.boat.speed = state.boat.speed * 0.99 + targetGameSpeed * 0.01;

    // Move Boat
    state.boat.x += boatDirX * state.boat.speed;
    state.boat.y += boatDirY * state.boat.speed;

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

    updateParticles();
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

function drawParticles(ctx) {
    for (const p of state.particles) {
        if (p.type === 'wake' || p.type === 'wake-wave') {
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 * p.scale, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'wind') {
            const windFactor = state.wind.speed / 10;
            const opacity = Math.min(p.life, 1.0) * (0.15 + windFactor * 0.2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = 1 + windFactor;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            const tailLength = 30 + state.wind.speed * 4;
            ctx.lineTo(p.x - Math.sin(state.wind.direction) * tailLength, p.y + Math.cos(state.wind.direction) * tailLength);
            ctx.stroke();
        }
    }
}

function drawWater(ctx) {
    // Background already filled

    const gridSize = 80;
    const range = Math.max(canvas.width, canvas.height) * 1.5;

    // Wave movement
    const waveSpeed = 20;
    const dist = state.time * waveSpeed;
    const shiftX = -Math.sin(state.wind.direction) * dist;
    const shiftY = Math.cos(state.wind.direction) * dist;

    // Calculate grid start based on camera position minus shift, snapped to grid
    // This ensures we iterate a "stable" grid that moves with the shift
    const startX = Math.floor((state.camera.x - range - shiftX) / gridSize) * gridSize;
    const startY = Math.floor((state.camera.y - range - shiftY) / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2.5;

    // Iterate enough grid points to cover the view range
    // We add extra buffer to handle the shift wrapping
    for (let x = startX; x < startX + range * 2.5; x += gridSize) {
        for (let y = startY; y < startY + range * 2.5; y += gridSize) {
             let wx = x + shiftX;
             let wy = y + shiftY;

             // Optimization: Skip if far outside camera view
             if (wx < state.camera.x - range || wx > state.camera.x + range ||
                 wy < state.camera.y - range || wy > state.camera.y + range) {
                 continue;
             }

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

             ctx.save();
             ctx.translate(wx + gridSize/2 + randX, wy + gridSize/2 + randY);
             // Rotate to align perpendicular to wind
             ctx.rotate(state.wind.direction + Math.PI);
             ctx.scale(scale, scale);

             ctx.beginPath();
             // Draw relative to rotated center
             ctx.moveTo(-8, bob);
             ctx.quadraticCurveTo(0, bob - 6, 8, bob);
             ctx.stroke();
             ctx.restore();
        }
    }
}

function drawMarks(ctx) {
    if (!state.course || !state.course.marks) return;

    for (const m of state.course.marks) {
        ctx.save();
        ctx.translate(m.x, m.y);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(3, 3, 12, 0, Math.PI * 2);
        ctx.fill();

        // Buoy body (Top down)
        const grad = ctx.createRadialGradient(-3, -3, 0, 0, 0, 12);
        grad.addColorStop(0, '#fdba74'); // Light Orange highlight
        grad.addColorStop(0.5, '#f97316'); // Orange
        grad.addColorStop(1, '#c2410c'); // Dark Orange

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#c2410c';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
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

function draw() {
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
    drawMarks(ctx); // Added back in
    drawParticles(ctx);

    // Draw Boat
    ctx.save();
    ctx.translate(state.boat.x, state.boat.y);
    ctx.rotate(state.boat.heading);
    drawBoat(ctx);
    ctx.restore();

    ctx.restore();

    // Minimap
    drawMinimap(); // Added back in

    // UI Updates
    const hudCompassRose = document.getElementById('hud-compass-rose');
    if (hudCompassRose) {
        // Rotate compass rose opposite to camera rotation so "North" points to actual North
        hudCompassRose.style.transform = `rotate(${-state.camera.rotation}rad)`;
    }

    const hudWindArrow = document.getElementById('hud-wind-arrow');
    if (hudWindArrow) {
        // Wind arrow is inside the compass rose, so we just rotate it to the absolute wind direction
        // The compass rose rotation handles the camera relative adjustment
        hudWindArrow.style.transform = `rotate(${state.wind.direction}rad)`;
    }

    const hudHeadingArrow = document.getElementById('hud-heading-arrow');
    if (hudHeadingArrow) {
        // Heading arrow (Red) rotates to show boat heading relative to camera
        const rot = state.boat.heading - state.camera.rotation;
        hudHeadingArrow.style.transform = `rotate(${rot}rad)`;
    }

    const hudSpeed = document.getElementById('hud-speed');
    if (hudSpeed) {
        // Convert to "knots" (internal speed * 2)
        hudSpeed.textContent = (state.boat.speed * 4).toFixed(1);
    }

    const hudWindSpeed = document.getElementById('hud-wind-speed');
    if (hudWindSpeed) {
        hudWindSpeed.textContent = state.wind.speed.toFixed(1);
    }
}

function loop() {
    update();
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
    const gateWidth = 5 * boatLength;
    const courseDist = 1000; // Approx 200m scale

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
        ]
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
state.boat.x = -Math.sin(state.wind.direction) * 150;
state.boat.y = Math.cos(state.wind.direction) * 150;

// Face Upwind
state.boat.heading = state.wind.direction;

loop();
