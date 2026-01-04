
import { state, settings } from './state/state.js';
import { UI, showRaceMessage, hideRaceMessage, updateLeaderboard, showResults } from './ui/ui.js';
import { formatTime, formatSplitTime } from './utils/helpers.js';
import { Sound } from './audio/sound.js';
import { setupInputs } from './input/input.js';
import { Boat } from './entities/boat.js';
import { AI_CONFIG } from './core/config.js';
import { normalizeAngle, mulberry32 } from './utils/math.js';
import { updateBaseWind, spawnGlobalGust, updateGusts, getWindAt, updateTurbulence, createGust } from './physics/wind.js';
import { BotController } from './ai/controller.js';
import { Sayings } from './ai/sayings.js';
import { draw, ctx, canvas } from './graphics/renderer.js';
import { updateBoat } from './physics/boat_physics.js';
import { checkBoatCollisions, checkMarkCollisions } from './physics/collision_manager.js';
import { initCourse } from './entities/course.js';

// Game Loop
let lastTime = 0;
let frameCount = 0;

function update(dt) {
    state.time += 0.24 * dt;
    const timeScale = dt * 60;

    updateBaseWind(dt);
    updateGusts(dt);

    // Current Visuals (Spawn Particles)
    if (state.race.conditions.current && state.race.conditions.current.speed > 0.1) {
        const c = state.race.conditions.current;
        const spawnChance = (0.2 + (c.speed / 3.0) * 0.5) * 0.25;
        if (Math.random() < spawnChance) {
             let range = Math.max(canvas.width, canvas.height) * 1.5;
             createParticle(state.camera.x + (Math.random()-0.5)*range, state.camera.y + (Math.random()-0.5)*range, 'current', { life: 1.0 + Math.random(), alpha: Math.min(1, c.speed/1.5) });
        }

        // Mark Wakes
        if (state.course.marks) {
            for (const m of state.course.marks) {
                if (Math.random() < 0.3 * (c.speed/3.0)) {
                     const flowDir = c.direction;
                     const offset = 12;
                     const wx = Math.sin(flowDir) * offset;
                     const wy = -Math.cos(flowDir) * offset;
                     createParticle(m.x + wx + (Math.random()-0.5)*10, m.y + wy + (Math.random()-0.5)*10, 'mark-wake', { life: 1.5, alpha: 0.5 * (c.speed/3.0), scale: 0.8 });
                }
            }
        }
    }

    // Sound
    const resultsVisible = UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden');
    if (state.boats.length > 0) {
        const p = state.boats[0];
        const w = getWindAt(p.x, p.y);
        Sound.updateWindSound(w.speed, resultsVisible);
    } else {
        Sound.updateWindSound(state.wind.speed, resultsVisible);
    }

    // Race Timer
    if (state.race.status === 'prestart') {
        state.race.timer -= dt;
        if (state.race.timer <= 0) {
            state.race.status = 'racing';
            state.race.timer = 0;
            Sound.playStart();
            Sound.updateMusic();
            for (const b of state.boats) {
                if (b.ai) {
                    b.ai.stuckTimer = 0;
                    b.ai.recoveryMode = false;
                }
            }
        }
    } else if (state.race.status === 'racing') {
        state.race.timer += dt;
        const totalDistMeters = (state.race.totalLegs * state.race.legLength) / 5;
        const cutoffTime = totalDistMeters * 0.1875;

        if (state.race.timer >= cutoffTime) {
            state.race.status = 'finished';
            for (const boat of state.boats) {
                if (!boat.raceState.finished) {
                    boat.raceState.finished = true;
                    boat.raceState.finishTime = state.race.timer;
                    if (boat.raceState.leg === 0) boat.raceState.resultStatus = 'DNS';
                    else boat.raceState.resultStatus = 'DNF';
                }
            }
            if (state.camera.target === 'boat') {
                state.camera.target = 'finish';
                showResults();
            }
        }
    }

    // Physics
    for (const boat of state.boats) {
        updateBoat(boat, dt);
    }

    checkBoatCollisions(dt);
    checkMarkCollisions(dt);
    // checkIslandCollisions(dt); // Need to implement/export
    checkNearMisses(dt);

    Sayings.update(dt);

    // Camera
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
        let indices = (state.race.totalLegs % 2 === 0) ? [0, 1] : [2, 3];
        if (state.course.marks && state.course.marks.length >= 2) {
             const m1 = state.course.marks[indices[0]], m2 = state.course.marks[indices[1]];
             const tx = (m1.x+m2.x)/2, ty = (m1.y+m2.y)/2;
             state.camera.x += (tx - state.camera.x) * 0.05;
             state.camera.y += (ty - state.camera.y) * 0.05;
             let diff = normalizeAngle(0 - state.camera.rotation);
             state.camera.rotation += diff * 0.05;
        }
    }

    // Particles
    if (state.race.status !== 'waiting') {
        for (const boat of state.boats) {
            if (boat.speed > 0.25) {
                const boatDX = Math.sin(boat.heading);
                const boatDY = -Math.cos(boat.heading);
                const sternX = boat.x - boatDX * 30;
                const sternY = boat.y - boatDY * 30;
                const planing = boat.raceState.isPlaning;

                let wakeProb = planing ? 0.6 : 0.2;
                if (Math.random() < wakeProb) createParticle(sternX + (Math.random()-0.5)*4, sternY + (Math.random()-0.5)*4, 'wake');

                let waveProb = planing ? 0.5 : 0.25;
                let spread = planing ? 0.2 : 0.1;
                let scale = planing ? 2.0 : 1.0;

                if (Math.random() < waveProb) {
                    const rightX = Math.cos(boat.heading), rightY = Math.sin(boat.heading);
                    createParticle(sternX - rightX*10, sternY - rightY*10, 'wake-wave', { vx: -rightX*spread, vy: -rightY*spread, scale: scale });
                    createParticle(sternX + rightX*10, sternY + rightY*10, 'wake-wave', { vx: rightX*spread, vy: rightY*spread, scale: scale });
                }
            }
        }
    }

    if (Math.random() < 0.2) {
        let range = Math.max(canvas.width, canvas.height) * 1.5;
        createParticle(state.camera.x + (Math.random()-0.5)*range, state.camera.y + (Math.random()-0.5)*range, 'wind', { life: Math.random() + 0.5 });
    }
    updateParticles(dt);
    updateWindWaves(dt);
}

function updateWindWaves(dt) {
    const camX = state.camera.x;
    const camY = state.camera.y;
    const radius = Math.max(canvas.width, canvas.height) * 0.8;
    const gridSize = 180;

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

                 wave = { x: bx + ox, y: by + oy, dist: rand * gridSize, angle: 0, speed: 0 };
                 state.waveStates.set(key, wave);
             }

             const wind = getWindAt(wave.x, wave.y);
             const travelFactor = 3.0;
             const moveDist = wind.speed * travelFactor * dt;

             wave.dist = (wave.dist + moveDist) % gridSize;
             wave.angle = wind.direction + Math.PI;
             wave.windSpeed = wind.speed;
        }
    }

    for (const key of state.waveStates.keys()) {
        if (!activeKeys.has(key)) state.waveStates.delete(key);
    }
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
        } else if (p.type === 'current' || p.type === 'mark-wake') {
             const c = state.race.conditions.current;
             const speed = c ? c.speed : 0;
             const dir = c ? c.direction : 0;
             const moveSpeed = (speed / 4.0) * timeScale;
             p.x += Math.sin(dir) * moveSpeed;
             p.y -= Math.cos(dir) * moveSpeed;
        }

        p.life -= decay * timeScale;
        if (p.life <= 0) { state.particles[i] = state.particles[state.particles.length-1]; state.particles.pop(); }
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
            if (dist < ai.playerProximity.minD) ai.playerProximity.minD = dist;
            ai.playerProximity.close = true;
        } else {
            if (ai.playerProximity.close) {
                if (ai.playerProximity.minD < 60 && ai.playerProximity.minD > 20) {
                     if (!player.raceState.penalty && !ai.raceState.penalty) {
                         // Check rules? Assume handled in physics?
                         Sayings.queueQuote(ai, "narrowly_avoided_collision");
                     }
                }
            }
            ai.playerProximity.close = false;
            ai.playerProximity.minD = Infinity;
        }
    }
}

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

        // UI Updates throttled
        frameCount++;
        if (frameCount % 10 === 0) {
            updateLeaderboard();
            // Update other HUD elements (logic copied from script.js would go here)
            updateHUD();
        }
    }
    requestAnimationFrame(loop);
}

function updateHUD() {
    const player = state.boats[0];
    if (!player) return;
    const localWind = getWindAt(player.x, player.y);

    if (UI.speed) UI.speed.textContent = (player.speed*4).toFixed(1);
    if (UI.windSpeed) UI.windSpeed.textContent = localWind.speed.toFixed(1);
    if (UI.windAngle) UI.windAngle.textContent = Math.round(Math.abs(normalizeAngle(player.heading - localWind.direction))*(180/Math.PI)) + '°';
    if (UI.vmg) UI.vmg.textContent = Math.abs((player.speed*4)*Math.cos(normalizeAngle(player.heading - localWind.direction))).toFixed(1);

    // Timer
    if (UI.timer) {
        let displayTime = state.race.timer;
        if (state.race.status === 'prestart') displayTime = -state.race.timer;
        else if (player.raceState.finished) displayTime = player.raceState.finishTime;
        UI.timer.textContent = formatTime(displayTime);
    }
}

function resetGame() {
    // loadSettings(); // Settings are live imported
    if (UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
    state.camera.target = 'boat';

    // Randomize Conditions
    state.wind.baseSpeed = 8 + Math.random()*10;
    state.wind.speed = state.wind.baseSpeed;
    state.wind.baseDirection = Math.random() * Math.PI * 2;
    state.wind.direction = state.wind.baseDirection;
    state.wind.currentShift = 0;
    state.wind.oscillator = Math.random() * Math.PI * 2;
    state.gusts = [];

    state.race.conditions = {
        shiftiness: Math.random(),
        variability: Math.random(),
        puffiness: Math.random(),
        gustStrengthBias: Math.random(),
        puffShiftiness: Math.random(),
        directionBias: (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.1),
        current: null,
        islandCount: 0,
        islandMaxSize: Math.random(),
        islandClustering: Math.random()
    };

    state.race.seed = Math.floor(Math.random() * 1000000);
    state.time = 0;
    state.race.status = 'waiting';
    state.race.timer = state.race.startTimerDuration;

    initCourse();

    if (window.WaterRenderer) window.WaterRenderer.init();

    const density = 5 + Math.floor(state.race.conditions.puffiness * 20);
    for (let i = 0; i < density; i++) {
        spawnGlobalGust(true);
    }

    state.boats = [];
    if (UI.lbRows) UI.lbRows.innerHTML = '';
    UI.boatRows = {};
    if (UI.resultsList) UI.resultsList.innerHTML = '';
    UI.resultRows = {};

    const player = new Boat(0, true, 0, 0, settings.playerName || "Player");
    player.heading = state.wind.direction;
    state.boats.push(player);

    const opponents = [];
    const available = [...AI_CONFIG];
    for (let i = 0; i < 9 && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        opponents.push(available[idx]);
        available.splice(idx, 1);
    }

    for (let i = 0; i < opponents.length; i++) {
        const config = opponents[i];
        const ai = new Boat(i + 1, false, 0, 0, config.name, config);
        ai.ai.startLinePct = 0.1 + Math.random() * 0.8;
        state.boats.push(ai);
    }

    repositionBoats();

    state.particles = [];
    state.waveStates.clear();
    hideRaceMessage();

    // setupPreRaceOverlay(); // UI logic needs this
    if (UI.preRaceOverlay) UI.preRaceOverlay.classList.remove('hidden');

    if (settings.soundEnabled || settings.musicEnabled) Sound.init();
    else Sound.updateMusic();
}

function repositionBoats() {
    if (!state.boats || state.boats.length === 0) return;
    const wd = state.wind.direction;
    const ux = Math.sin(wd), uy = -Math.cos(wd);
    const backX = -ux, backY = -uy;

    if (!state.course.marks || state.course.marks.length < 2) return;
    const m0 = state.course.marks[0], m1 = state.course.marks[1];
    const cx = (m0.x + m1.x) / 2, cy = (m0.y + m1.y) / 2;
    const lDx = m1.x - m0.x, lDy = m1.y - m0.y;
    const lLen = Math.sqrt(lDx*lDx + lDy*lDy);
    const rx = lDx / lLen, ry = lDy / lLen;

    const distBack = 400;
    const lineCx = cx + backX * distBack;
    const lineCy = cy + backY * distBack;
    const totalWidth = lLen + 2 * distBack;

    const positions = [];
    const step = (state.boats.length > 1) ? totalWidth / (state.boats.length - 1) : 0;
    const startOffset = -totalWidth / 2;

    for (let i = 0; i < state.boats.length; i++) {
        const offset = startOffset + i * step;
        positions.push({ x: lineCx + rx * offset, y: lineCy + ry * offset });
    }

    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    let posIndex = 0;
    for (const boat of state.boats) {
        const pos = positions[posIndex++];
        if (boat.isPlayer) {
            boat.x = pos.x; boat.y = pos.y; boat.heading = wd; boat.speed = 0;
        } else {
            const scatter = (Math.random() - 0.5) * 100;
            const downwind = wd + Math.PI;
            boat.x = pos.x + Math.sin(downwind) * scatter;
            boat.y = pos.y - Math.cos(downwind) * scatter;
            boat.heading = normalizeAngle(wd + Math.PI / 4);
            boat.speed = 0.5;
        }
        boat.prevHeading = boat.heading;
        if (boat.raceState) boat.raceState.lastPos = { x: boat.x, y: boat.y };
    }
}

// Global Exports for UI interaction (e.g., buttons calling startRace)
window.state = state;
window.resetGame = resetGame;
window.startRace = () => {
    if (state.race.status !== 'waiting') return;
    state.race.status = 'prestart';
    state.race.timer = state.race.startTimerDuration;
    if (UI.preRaceOverlay) UI.preRaceOverlay.classList.add('hidden');
    UI.leaderboard.classList.remove('hidden');
    if ((settings.soundEnabled || settings.musicEnabled) && (!Sound.ctx || Sound.ctx.state !== 'running')) Sound.init();
    Sound.updateMusic();
};
window.togglePause = (val) => { state.paused = (val !== undefined) ? val : !state.paused; };
window.restartRace = () => { resetGame(); state.paused = false; };

// Bind Event Listeners
if (UI.startRaceBtn) UI.startRaceBtn.addEventListener('click', window.startRace);
if (UI.resumeButton) UI.resumeButton.addEventListener('click', () => window.togglePause(false));
if (UI.restartButton) UI.restartButton.addEventListener('click', window.restartRace);
if (UI.resultsRestartButton) UI.resultsRestartButton.addEventListener('click', window.restartRace);
if (UI.pauseButton) UI.pauseButton.addEventListener('click', () => window.togglePause(true));

// Initial Setup
setupInputs();
resetGame();
requestAnimationFrame(loop);
