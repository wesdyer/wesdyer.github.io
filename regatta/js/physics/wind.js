
import { state } from '../state/state.js';
import { WIND_CONFIG } from '../core/config.js';
import { fractalNoise, lerp, normalizeAngle } from '../utils/math.js';

// Wind System
export function updateBaseWind(dt) {
    const cond = state.race.conditions;

    // Interpolate Config based on Shiftiness (0-1)
    const s = cond.shiftiness !== undefined ? cond.shiftiness : 0.5;

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

    // Target Shift (Sine + Low Freq Noise)
    const noise = fractalNoise(state.time * 0.05) * 1.5;
    const targetDeg = pAmp * Math.sin(state.wind.oscillator + noise);

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
    state.wind.direction = normalizeAngle(state.wind.baseDirection + state.wind.currentShift);

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

export function createGust(x, y, type, initial = false) {
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

export function spawnGlobalGust(initial = false) {
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

export function updateGusts(dt) {
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

export function getWindAt(x, y) {
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
    let shadowFactor = 1.0;

    if (state.course.islands) {
        for (const isl of state.course.islands) {
            // Distance from island center
            const dx = x - isl.x;
            const dy = y - isl.y;

            const flowX = -Math.sin(baseDir);
            const flowY = Math.cos(baseDir);

            const dot = dx * flowX + dy * flowY;

            if (dot > 0) {
                const cross = dx * (-flowY) - dy * flowX;
                const wakeWidth = isl.radius * (1.0 + dot / 500);

                if (Math.abs(cross) < wakeWidth) {
                    const shadowLen = isl.radius * 5;
                    if (dot < shadowLen) {
                        const latFactor = 1.0 - Math.abs(cross) / wakeWidth;
                        const longFactor = 1.0 - dot / shadowLen;
                        const localShadow = latFactor * longFactor * 0.7;
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

export function updateTurbulence(boat, dt) {
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
