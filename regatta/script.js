// Game Configuration
const CONFIG = {
    turnSpeed: 0.04,
    cameraPanSpeed: 5,
    cameraRotateSpeed: 0.04,
    windSpeed: 5,
    waterColor: '#3b82f6',
    boatColor: '#f8fafc',
    sailColor: '#f1f5f9',
};

// Game State
const state = {
    boat: {
        x: 0,
        y: 0,
        heading: 0, // Radians, 0 = North (Up)
        velocity: { x: 0, y: 0 },
        speed: 0,
        sailAngle: 0, // Radians relative to boat
        boomSide: 1, // 1 for right, -1 for left
        targetBoomSide: 1,
        luffing: false,
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
        p.life -= 0.01;

        if (p.type === 'wake') {
            p.scale = 1 + (1 - p.life) * 2;
            p.alpha = p.life * 0.5;
        } else if (p.type === 'wind') {
             // Move with wind
             const speed = 4;
             p.x += Math.sin(state.wind.direction) * speed;
             p.y -= Math.cos(state.wind.direction) * speed;
             p.life -= 0.01;
        }

        if (p.life <= 0) {
            state.particles.splice(i, 1);
        }
    }
}

// Update Loop
function update() {
    state.time += 0.016;

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

    // Thrust Calculation
    let thrust = 0;
    // Irons: +/- 40 degrees
    const ironsLimit = 40 * (Math.PI / 180);

    if (angleToWind < ironsLimit) {
        // In irons - slow down fast
        thrust = 0;
        state.boat.luffing = true;
    } else {
        state.boat.luffing = false;
        // Simple thrust curve: Max at 90 (Beam Reach), Decent at 180 (Run), Poor at 45 (Close Haul)
        if (angleToWind > Math.PI / 2) {
             // 90 to 180
             let t = (angleToWind - Math.PI/2) / (Math.PI/2);
             thrust = 1.0 - (t * 0.4);
        } else {
            // 40 to 90
             let t = (angleToWind - ironsLimit) / (Math.PI/2 - ironsLimit);
             thrust = 0.3 + (t * 0.7);
        }
    }

    // Apply simplified drag
    state.boat.speed *= 0.99; // Water friction
    state.boat.speed += thrust * 0.03; // Acceleration

    // Cap speed
    if (state.boat.speed > 6) state.boat.speed = 6;

    // Move Boat
    state.boat.x += boatDirX * state.boat.speed;
    state.boat.y += boatDirY * state.boat.speed;

    // Wake Particles
    if (state.boat.speed > 1 && Math.random() < 0.3) {
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
        let swingSpeed = 0.1;
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
             ctx.rotate(state.boat.sailAngle * 0.7);
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
            const opacity = Math.min(p.life, 1.0) * 0.15;
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + Math.sin(state.wind.direction) * 40, p.y - Math.cos(state.wind.direction) * 40);
            ctx.stroke();
        }
    }
}

function drawWater(ctx) {
    // Background already filled

    const gridSize = 80;
    const range = Math.max(canvas.width, canvas.height) * 1.5;
    const startX = Math.floor((state.camera.x - range) / gridSize) * gridSize;
    const startY = Math.floor((state.camera.y - range) / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;

    for (let x = startX; x < state.camera.x + range; x += gridSize) {
        for (let y = startY; y < state.camera.y + range; y += gridSize) {
             // Draw little wave glyphs
             const noise = Math.sin(x * 0.12 + y * 0.17);
             const bob = Math.sin(state.time * 2 + noise * 10) * 3;

             let wx = x + gridSize/2;
             let wy = y + gridSize/2;

             ctx.beginPath();
             ctx.moveTo(wx - 4, wy + bob);
             ctx.quadraticCurveTo(wx, wy + bob - 3, wx + 4, wy + bob);
             ctx.stroke();
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
        speedDisplay.textContent = (state.boat.speed * 2).toFixed(1);
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
