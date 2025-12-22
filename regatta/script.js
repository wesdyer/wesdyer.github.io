// Game Configuration
const CONFIG = {
    turnSpeed: 0.02,
    cameraPanSpeed: 2.5,
    cameraRotateSpeed: 0.02,
    windSpeed: 5,
    waterColor: '#3b82f6',
    boatColor: '#f8fafc',
    sailColor: '#f1f5f9',
};

// J/111 Polar Data (10 Knots Wind)
// Source: ORC Certificate data & Estimations for Non-Spinnaker
const J111_POLARS = {
    windSpeed: 10,
    angles: [0, 30, 38, 45, 52, 60, 75, 90, 110, 120, 135, 150, 180],
    // Speeds in Knots
    spinnaker: [
        0.00, // 0
        0.00, // 30 (Pinch/Luff)
        6.66, // 38 (Beat)
        7.00, // 45
        7.38, // 52
        7.56, // 60
        7.70, // 75
        7.89, // 90 (Reach)
        8.01, // 110
        8.01, // 120
        7.72, // 135
        6.99, // 150
        6.00  // 180 (Run)
    ],
    nonSpinnaker: [
        0.00, // 0
        0.00, // 30
        6.66, // 38
        7.00, // 45
        7.38, // 52
        7.56, // 60
        7.70, // 75
        7.89, // 90
        7.20, // 110 (Est)
        6.80, // 120 (Est)
        6.00, // 135 (Est)
        5.20, // 150 (Est)
        4.50  // 180 (Est)
    ]
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
        spinnaker: false, // Default to Performance Mode
    },
    camera: {
        x: 0,
        y: 0,
        rotation: 0,
        target: null // 'boat' or null (free)
    },
    wind: {
        direction: Math.PI / 2 // Blowing TO the Right (East)
    },
    particles: [], // For wake and wind effects
    keys: {
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false,
        w: false,
        a: false,
        s: false,
        d: false,
        q: false,
        e: false,
    },
    time: 0
};

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
        state.camera.target = 'boat';
        state.camera.x = state.boat.x;
        state.camera.y = state.boat.y;
        state.camera.rotation = 0;
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

function getTargetSpeed(twaRadians, useSpinnaker) {
    const twaDeg = Math.abs(twaRadians) * (180 / Math.PI);
    const angles = J111_POLARS.angles;
    const speeds = useSpinnaker ? J111_POLARS.spinnaker : J111_POLARS.nonSpinnaker;

    // Find interpolation interval
    for (let i = 0; i < angles.length - 1; i++) {
        if (twaDeg >= angles[i] && twaDeg <= angles[i+1]) {
            const t = (twaDeg - angles[i]) / (angles[i+1] - angles[i]);
            return speeds[i] + t * (speeds[i+1] - speeds[i]);
        }
    }
    return speeds[speeds.length - 1]; // Clamp to last value
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
        p.life -= 0.005;

        if (p.type === 'wake') {
            p.scale = 1 + (1 - p.life) * 2;
            p.alpha = p.life * 0.5;
        } else if (p.type === 'wind') {
             // Move with wind
             const speed = 2;
             p.x += Math.sin(state.wind.direction) * speed;
             p.y -= Math.cos(state.wind.direction) * speed;
             p.life -= 0.005;
        }

        if (p.life <= 0) {
            state.particles.splice(i, 1);
        }
    }
}

// Update Loop
function update() {
    state.time += 0.008;

    // Camera Controls
    if (state.keys.w) { state.camera.y -= CONFIG.cameraPanSpeed * Math.cos(state.camera.rotation); state.camera.x += CONFIG.cameraPanSpeed * Math.sin(state.camera.rotation); state.camera.target = null; }
    if (state.keys.s) { state.camera.y += CONFIG.cameraPanSpeed * Math.cos(state.camera.rotation); state.camera.x -= CONFIG.cameraPanSpeed * Math.sin(state.camera.rotation); state.camera.target = null; }
    if (state.keys.a) { state.camera.x -= CONFIG.cameraPanSpeed * Math.cos(state.camera.rotation); state.camera.y -= CONFIG.cameraPanSpeed * Math.sin(state.camera.rotation); state.camera.target = null; }
    if (state.keys.d) { state.camera.x += CONFIG.cameraPanSpeed * Math.cos(state.camera.rotation); state.camera.y += CONFIG.cameraPanSpeed * Math.sin(state.camera.rotation); state.camera.target = null; }
    if (state.keys.q) { state.camera.rotation -= CONFIG.cameraRotateSpeed; }
    if (state.keys.e) { state.camera.rotation += CONFIG.cameraRotateSpeed; }

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
    let targetKnots = getTargetSpeed(angleToWind, state.boat.spinnaker);
    let targetGameSpeed = targetKnots * 0.5;

    // Determine Luffing state (for visual/logic flags, not speed as speed comes from polar now)
    // Polar says 0 speed at < 30 deg, so checks match
    if (targetKnots < 1.0) {
        state.boat.luffing = true;
    } else {
        state.boat.luffing = false;
    }

    // Smoothly interpolate current speed to target speed (acceleration/deceleration)
    // Momentum factor: 0.98 (retains 98% of old speed), 0.02 (adds 2% of new)
    state.boat.speed = state.boat.speed * 0.98 + targetGameSpeed * 0.02;

    // Move Boat
    state.boat.x += boatDirX * state.boat.speed;
    state.boat.y += boatDirY * state.boat.speed;

    // Wake Particles
    if (state.boat.speed > 0.5 && Math.random() < 0.15) {
        createParticle(state.boat.x - boatDirX * 20, state.boat.y - boatDirY * 20, 'wake');
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
        let swingSpeed = 0.05;
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
    if (Math.random() < 0.4) {
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
    const drawSail = (isJib) => {
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

        ctx.beginPath();
        if (isJib) {
             ctx.moveTo(0, 0);
             ctx.lineTo(0, 28);
             ctx.quadraticCurveTo(-state.boat.boomSide * 11, 14, 0, 0);
        } else {
             ctx.moveTo(0, 0);
             ctx.lineTo(0, 45);
             ctx.quadraticCurveTo(-state.boat.boomSide * 15, 20, 0, 0);
        }
        ctx.fill();
        ctx.stroke();

        // Batten lines for detail
        if (!isJib) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.beginPath();
            ctx.moveTo(0, 15); ctx.lineTo(-state.boat.boomSide * 5, 12);
            ctx.moveTo(0, 30); ctx.lineTo(-state.boat.boomSide * 9, 24);
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

    drawSail(false); // Main
    drawSail(true);  // Jib

    ctx.restore();
}

function drawParticles(ctx) {
    for (const p of state.particles) {
        if (p.type === 'wake') {
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 * p.scale, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'wind') {
            const opacity = Math.min(p.life, 1.0) * 0.35;
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + Math.sin(state.wind.direction) * 60, p.y - Math.cos(state.wind.direction) * 60);
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
    const shiftX = Math.sin(state.wind.direction) * dist;
    const shiftY = -Math.cos(state.wind.direction) * dist;

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
             const bob = Math.sin(state.time * 2 + noise * 10) * 3;

             // Add some randomness
             const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
             const randX = (seed - Math.floor(seed)) * 40 - 20;
             const randY = (Math.cos(seed) * 0.5 + 0.5) * 40 - 20;
             const scale = 0.8 + ((seed * 10) % 1) * 0.4; // 0.8 to 1.2

             ctx.save();
             ctx.translate(wx + gridSize/2 + randX, wy + gridSize/2 + randY);
             // Rotate to align perpendicular to wind
             ctx.rotate(state.wind.direction);
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
    drawParticles(ctx);

    // Draw Boat
    ctx.save();
    ctx.translate(state.boat.x, state.boat.y);
    ctx.rotate(state.boat.heading);
    drawBoat(ctx);
    ctx.restore();

    ctx.restore();

    // UI Updates
    const windArrow = document.getElementById('wind-indicator');
    if (windArrow) {
        // Arrow icon points Down by default. We want it to point Up at 0 rotation.
        // So we add PI (180 deg) to the rotation.
        let visualDir = state.wind.direction - state.camera.rotation + Math.PI;
        windArrow.style.transform = `rotate(${visualDir}rad)`;
    }
    const speedDisplay = document.getElementById('speed-display');
    if (speedDisplay) {
        // Convert to "knots" (just a scalar of internal speed)
        // Since we are now deriving speed from knots, and internal is knots * 0.5
        // Display should be speed * 2
        speedDisplay.textContent = (state.boat.speed * 2).toFixed(1);
    }

    // Update Spinnaker Status
    const spinStatus = document.getElementById('spinnaker-status');
    if (spinStatus) {
        spinStatus.textContent = state.boat.spinnaker ? "SPINNAKER: ON" : "SPINNAKER: OFF";
        spinStatus.className = state.boat.spinnaker ? "font-bold text-green-600 text-xs" : "font-bold text-slate-400 text-xs";
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Init
state.camera.target = 'boat';
loop();
