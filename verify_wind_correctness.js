
const { performance } = require('perf_hooks');

// Mock State (Replicating the structure in regatta/js/script.js)
const state = {
    wind: {
        speed: 10,
        direction: 1.5,
        baseSpeed: 10,
        baseDirection: 1.5,
        sinDir: Math.sin(1.5),
        cosDir: Math.cos(1.5),
        currentShift: 0
    },
    gusts: [],
    course: {
        islands: []
    },
    race: {
        conditions: {
            puffiness: 0.5,
            gustStrengthBias: 0.5,
            puffShiftiness: 0.5
        }
    }
};

// --- Mock Functions from script.js (Simplified for test context) ---

function createGust(x, y, type, initial = false) {
    const conditions = state.race.conditions;
    const baseSpeed = state.wind.speed;
    const windDir = state.wind.direction;

    const puffSizeBias = conditions.puffiness !== undefined ? (0.5 + conditions.puffiness) : 1.0;
    const maxRadiusX = (300 + Math.random() * 1200) * puffSizeBias;
    const maxRadiusY = (150 + Math.random() * 600) * puffSizeBias;

    let speedDelta = 0;
    let dirDelta = 0;

    const strengthRandom = Math.random();
    const bias = 0.5;
    const strengthFactor = (strengthRandom + bias) * 0.5;

    if (type === 'gust') {
        const pct = 0.20 + strengthFactor * 0.30;
        speedDelta = baseSpeed * pct;
    } else {
        const pct = 0.10 + strengthFactor * 0.30;
        speedDelta = -baseSpeed * pct;
    }

    const minDev = 5 + conditions.puffShiftiness * 15;
    const maxDev = 10 + conditions.puffShiftiness * 20;
    const devDeg = minDev + Math.random() * (maxDev - minDev);
    const devRad = devDeg * (Math.PI / 180);
    dirDelta = (Math.random() < 0.5 ? -1 : 1) * devRad;

    const moveSpeedFactor = (0.8 + Math.random() * 0.4) * 0.1;
    const moveDirOffset = (Math.random() - 0.5) * 0.1;

    const moveSpeed = baseSpeed * moveSpeedFactor;
    const moveDir = windDir + moveDirOffset;
    const vx = -Math.sin(moveDir) * moveSpeed;
    const vy = Math.cos(moveDir) * moveSpeed;

    const duration = 30 + Math.random() * 60;
    const age = initial ? Math.random() * duration : 0;

    const rotation = windDir + dirDelta + Math.PI / 2;

    return {
        type, x, y, vx, vy,
        moveSpeedFactor, moveDirOffset,
        maxRadiusX, maxRadiusY,
        radiusX: 10, radiusY: 10,
        rotation,
        sinRot: Math.sin(-rotation),
        cosRot: Math.cos(-rotation),
        invRadiusXSq: 0.01,
        invRadiusYSq: 0.01,
        speedDelta, dirDelta,
        sinDirDelta: Math.sin(dirDelta),
        cosDirDelta: Math.cos(dirDelta),
        duration,
        age
    };
}

// Populate Gusts
for (let i = 0; i < 20; i++) {
    const g = createGust(Math.random() * 4000, Math.random() * 4000, 'gust', true);
    // Simulate update to set radii
    g.radiusX = g.maxRadiusX * 0.5;
    g.radiusY = g.maxRadiusY * 0.5;
    g.invRadiusXSq = 1.0 / (g.radiusX * g.radiusX);
    g.invRadiusYSq = 1.0 / (g.radiusY * g.radiusY);
    state.gusts.push(g);
}

// Populate Islands
for (let i = 0; i < 5; i++) {
    state.course.islands.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        radius: 100 + Math.random() * 200
    });
}

// --- Implementations ---

// Original (Simulated based on prior knowledge of the unoptimized code)
function getWindAt_Original(x, y) {
    const baseSpeed = state.wind.speed;
    const baseDir = state.wind.direction;

    let sumWx = Math.sin(baseDir) * baseSpeed;
    let sumWy = -Math.cos(baseDir) * baseSpeed;

    for (const g of state.gusts) {
        const dx = x - g.x;
        const dy = y - g.y;
        // ORIGINAL LOGIC (Unoptimized) used on-the-fly trig
        const cos = Math.cos(-g.rotation);
        const sin = Math.sin(-g.rotation);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;

        // ORIGINAL LOGIC used division
        const distSq = (rx*rx)/(g.radiusX*g.radiusX) + (ry*ry)/(g.radiusY*g.radiusY);

        if (distSq <= 1) {
            const falloff = 1 - Math.sqrt(distSq);
            const lifeFade = Math.min(g.age / 5, 1) * Math.min((g.duration - g.age) / 5, 1);
            const intensity = Math.max(0, falloff * lifeFade);

            if (intensity > 0) {
                 const gSpeed = g.speedDelta * intensity;
                 // ORIGINAL LOGIC calculated direction on the fly
                 const gwDir = baseDir + g.dirDelta;
                 sumWx += Math.sin(gwDir) * gSpeed;
                 sumWy += -Math.cos(gwDir) * gSpeed;
            }
        }
    }

    let shadowFactor = 1.0;
    if (state.course.islands) {
        for (const isl of state.course.islands) {
            const dx = x - isl.x;
            const dy = y - isl.y;
            // ORIGINAL LOGIC calculated flow vector inside loop
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

// Optimized (Copy of the logic currently applied to script.js)
function getWindAt_Optimized(x, y) {
    // Current Global Wind
    const baseSpeed = state.wind.speed;
    // const baseDir = state.wind.direction;

    // Convert to vector
    let sumWx = state.wind.sinDir * baseSpeed;
    let sumWy = -state.wind.cosDir * baseSpeed;

    for (const g of state.gusts) {
        const dx = x - g.x;
        const dy = y - g.y;

        // Use cached trig and inverse radius
        const rx = dx * g.cosRot - dy * g.sinRot;
        const ry = dx * g.sinRot + dy * g.cosRot;

        const distSq = (rx*rx) * g.invRadiusXSq + (ry*ry) * g.invRadiusYSq;
        if (distSq <= 1) {
            const falloff = 1 - Math.sqrt(distSq);
            const lifeFade = Math.min(g.age / 5, 1) * Math.min((g.duration - g.age) / 5, 1);
            const intensity = Math.max(0, falloff * lifeFade);

            if (intensity > 0) {
                 const gSpeed = g.speedDelta * intensity;
                 // Local direction inside puff
                 // Angle sum identity to avoid trig calls
                 // gwDir = windDir + dirDelta
                 const sinGwDir = state.wind.sinDir * g.cosDirDelta + state.wind.cosDir * g.sinDirDelta;
                 const cosGwDir = state.wind.cosDir * g.cosDirDelta - state.wind.sinDir * g.sinDirDelta;

                 // Add puff vector
                 sumWx += sinGwDir * gSpeed;
                 sumWy += -cosGwDir * gSpeed;
            }
        }
    }

    // Island Wind Shadow
    // Check if point x,y is downwind of any island
    // "Wind shadows behave like stationary lulls"
    // They reduce speed but don't change direction significantly (unless we want wrapping, but requirements say "meaninfully dampen wind strength")
    let shadowFactor = 1.0;

    if (state.course.islands) {
        // Hoist flow vector calculation
        const flowX = -state.wind.sinDir;
        const flowY = state.wind.cosDir;

        for (const isl of state.course.islands) {
            // Distance from island center
            const dx = x - isl.x;
            const dy = y - isl.y;

            // Project relative position onto flow vector
            // dot > 0 means downwind
            const dot = dx * flowX + dy * flowY;

            if (dot > 0) {
                // Downwind. Check cross-track distance.
                // Cross vector (-flowY, flowX) or similar
                const cross = dx * (-flowY) - dy * flowX; // 2D cross product scalar

                // Shadow width depends on island radius.
                // Simple cone: Width expands slightly? Or stays cylindrical?
                // Realism: Wakes spread.
                const wakeWidth = isl.radius * (1.0 + dot / 500); // Slight spread

                if (Math.abs(cross) < wakeWidth) {
                    // Inside shadow cone.
                    // Intensity fades with distance downwind.
                    // Max length: 8 * radius?
                    const shadowLen = isl.radius * 5;
                    if (dot < shadowLen) {
                        // Calculate intensity
                        // Center is strongest. Edges weaker.
                        // Close is strongest. Far weaker.

                        const latFactor = 1.0 - Math.abs(cross) / wakeWidth; // 1 at center, 0 at edge
                        const longFactor = 1.0 - dot / shadowLen; // 1 at island, 0 at end

                        // Combined strength (0 to 1)
                        // Max reduction: 70%?
                        const localShadow = latFactor * longFactor * 0.7;

                        // Accumulate shadows? Or take max? Max is safer.
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

// --- Verification ---

console.log("Verifying correctness...");
let maxError = 0;
let errors = 0;

for(let i=0; i<1000; i++) {
    const px = Math.random() * 4000;
    const py = Math.random() * 4000;
    const resOrig = getWindAt_Original(px, py);
    const resOpt = getWindAt_Optimized(px, py);

    const errSpeed = Math.abs(resOrig.speed - resOpt.speed);

    // Direction error handling (wrap around PI)
    let errDir = Math.abs(resOrig.direction - resOpt.direction);
    if (errDir > Math.PI) errDir = 2 * Math.PI - errDir;

    if (errSpeed > maxError) maxError = errSpeed;
    if (errDir > maxError) maxError = errDir;

    if (errSpeed > 0.001 || errDir > 0.001) {
        errors++;
        if (errors < 5) {
             console.error(`Mismatch at ${px.toFixed(1)},${py.toFixed(1)}:`);
             console.error(`  Speed: Orig=${resOrig.speed.toFixed(4)} Opt=${resOpt.speed.toFixed(4)}`);
             console.error(`  Dir:   Orig=${resOrig.direction.toFixed(4)} Opt=${resOpt.direction.toFixed(4)}`);
        }
    }
}

console.log(`Max Error: ${maxError}`);
if (errors === 0) {
    console.log("✅ Verification PASSED: Results match.");
} else {
    console.log(`❌ Verification FAILED: ${errors} mismatches found.`);
}
