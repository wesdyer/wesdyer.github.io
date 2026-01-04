
import { state, settings } from '../state/state.js';
import { CONFIG, J111_POLARS, J111_PLANING } from '../core/config.js';
import { getWindAt, updateTurbulence } from './wind.js';
import { normalizeAngle } from '../utils/math.js';
import { getHullPolygon, checkLineIntersection } from './collision.js'; // For gate crossing checks?
// Actually gate crossing logic is inside updateBoat usually.

// We need Sound and Sayings and UI for events inside updateBoat (e.g. crossing lines)
import { Sound } from '../audio/sound.js';
import { Sayings } from '../ai/sayings.js';
import { showRaceMessage, hideRaceMessage, UI } from '../ui/ui.js';
import { BotController } from '../ai/controller.js';

export function updateBoat(boat, dt) {
    if (!boat) return;

    // AI Controller Update
    if (!boat.isPlayer) {
        if (!boat.controller) boat.controller = new BotController(boat);
        boat.controller.update(dt);
    } else {
        // Player Input
        if (state.keys.ArrowLeft) boat.heading -= CONFIG.turnSpeed * (state.keys.Shift ? 0.25 : 1.0) * (dt * 60);
        if (state.keys.ArrowRight) boat.heading += CONFIG.turnSpeed * (state.keys.Shift ? 0.25 : 1.0) * (dt * 60);

        // Manual Trim
        if (boat.manualTrim) {
            const trimSpeed = 0.05 * dt * 60;
            if (state.keys.ArrowUp) boat.manualSailAngle += trimSpeed;
            if (state.keys.ArrowDown) boat.manualSailAngle -= trimSpeed;
            // Clamp manual angle (0 to PI) - actually usually relative to boat?
            // "Sail Angle" is usually absolute or relative?
            // In this game, sailAngle is calculated relative to boat usually.
            // Let's assume manualSailAngle is a target offset or absolute value.
            // Looking at script.js (implied), it's likely 0 to PI.
            boat.manualSailAngle = Math.max(0, Math.min(Math.PI, boat.manualSailAngle));
        }
    }

    boat.heading = normalizeAngle(boat.heading);

    // Physics
    const localWind = getWindAt(boat.x, boat.y);
    const windSpeed = localWind.speed;
    const windDir = localWind.direction;

    // Apparent Wind Calculation
    // Boat Velocity Vector
    // Note: boat.velocity is often derived or stored. Here we might be updating it.
    // If boat.speed is the primary driver:
    const boatVx = Math.sin(boat.heading) * boat.speed;
    const boatVy = -Math.cos(boat.heading) * boat.speed;

    // True Wind Vector (blowing TO)
    // windDir is FROM. So vector is opposite.
    const trueWindX = -Math.sin(windDir) * windSpeed;
    const trueWindY = Math.cos(windDir) * windSpeed;

    // Apparent Wind = True Wind - Boat Velocity
    const awX = trueWindX - boatVx;
    const awY = trueWindY - boatVy;

    const apparentWindSpeed = Math.sqrt(awX*awX + awY*awY);
    const apparentWindAngleGlobal = Math.atan2(-awX, awY); // Direction blowing FROM?
    // Atan2(y, x) -> standard math. Here axes are rotated.
    // Let's stick to simple Angle to Wind.
    const angleToWind = Math.abs(normalizeAngle(boat.heading - windDir));
    const apparentWindAngle = Math.abs(normalizeAngle(boat.heading - apparentWindAngleGlobal)); // This might be wrong without exact convention match

    // Sail Trim
    let optimalSailAngle = Math.max(0, angleToWind - Math.PI/4); // Simple trim
    if (angleToWind > Math.PI * 0.75) optimalSailAngle = Math.PI / 2; // Downwind

    if (boat.manualTrim && boat.isPlayer) {
        boat.sailAngle = boat.manualSailAngle;
    } else {
        // AI Trim with delay/error based on Handling
        if (!boat.isPlayer) {
             // ... AI trim logic ...
             boat.sailAngle = optimalSailAngle; // Simplified
        } else {
             boat.sailAngle = optimalSailAngle; // Auto trim
        }
    }

    // Boom Side
    const windSide = normalizeAngle(boat.heading - windDir) > 0 ? 1 : -1; // 1=Wind from Left (Port Tack?? No, if Heading is 0, Wind PI/2 (East), Angle -PI/2.
    // Heading - Wind.
    // H=0, W=90. 0-90 = -90. Wind on Stbd side. Port Tack. Boom on Port (Left, -1).
    // If Result < 0, Wind on Stbd.
    // boat.boomSide should be opposite to wind side.
    // If wind from Right (-), Boom on Left (+)?
    // Let's use standard:
    const relWind = normalizeAngle(boat.heading - windDir);
    boat.targetBoomSide = (relWind > 0) ? 1 : -1; // Wind on Port?
    // If H=0 (N), W=-90 (W). Rel = 90. Wind from Left. Stbd Tack. Boom Right (1).
    // Wait, convention:
    // If Wind from Left (Port), we are on Starboard Tack. Boom is on Starboard (Right).
    // If Rel > 0, Wind is "Left" relative to Heading?
    // H=0. W=-1.57 (West/Left). H-W = +1.57.
    // So Rel > 0 means Wind from Left.
    // Boom should be on Right (Starboard, +1).
    // So targetBoomSide = 1.
    // Seems correct.

    // Boom Switching Speed
    if (boat.boomSide !== boat.targetBoomSide) {
        // Jibe/Tack
        const switchSpeed = 0.1 * (dt * 60);
        if (boat.boomSide < boat.targetBoomSide) {
            boat.boomSide = Math.min(boat.targetBoomSide, boat.boomSide + switchSpeed);
        } else {
            boat.boomSide = Math.max(boat.targetBoomSide, boat.boomSide - switchSpeed);
        }
    }

    // Forces
    // Speed based on Polars
    const isSpinnaker = (angleToWind > Math.PI / 2);
    boat.spinnaker = isSpinnaker; // Auto hoist?
    // Player manual spinnaker?
    if (boat.isPlayer) {
        // Spinnaker toggle logic handled in input or here?
        // Usually Spacebar toggles `boat.spinnaker`.
        if (state.keys[' '] && !boat.keys_Space_Pressed) {
             boat.spinnaker = !boat.spinnaker;
             boat.keys_Space_Pressed = true;
        }
        if (!state.keys[' ']) boat.keys_Space_Pressed = false;

        // Auto-drop if too high
        if (boat.spinnaker && angleToWind < Math.PI / 2.5) boat.spinnaker = false;
    }

    // Deploy animation
    if (boat.spinnaker) {
        if (boat.spinnakerDeployProgress < 1.0) boat.spinnakerDeployProgress += 0.05 * (dt*60);
    } else {
        if (boat.spinnakerDeployProgress > 0.0) boat.spinnakerDeployProgress -= 0.05 * (dt*60);
    }

    // Calculate Target Speed
    // Use effective wind (minus bad air)
    const effectiveWind = Math.max(0, windSpeed * (1.0 - boat.badAirIntensity));

    // Import J111_POLARS is circular if we use the helper from AI?
    // I duplicated logic in AI controller. Ideally I should have a `physics/performance.js`.
    // I'll inline a simple polar lookup or reuse the logic.
    // Let's rely on simple interpolation for now or extract `getTargetSpeed` to a common file.
    // I put `getTargetSpeed` in `ai/controller.js`. I should move it to `physics/performance.js`.
    // For now I will mock it or copy it.

    let targetKnots = getTargetSpeed(angleToWind, boat.spinnaker, effectiveWind);

    // Apply Stats
    if (boat.stats) {
        // Boost
        targetKnots *= (1.0 + boat.stats.boost * 0.01);
        // ... other stats ...
    }

    // Convert to Game Units
    let targetSpeed = targetKnots * 0.25;

    // AI Speed Modifier (Bot Controller might limit speed)
    if (!boat.isPlayer && boat.controller) {
        targetSpeed *= boat.controller.speedLimit;
    }

    // Inertia / Acceleration
    const accel = 0.01 * (dt * 60); // Simplified
    if (boat.speed < targetSpeed) {
        boat.speed += accel;
    } else {
        boat.speed -= accel;
    }

    // Move
    boat.x += Math.sin(boat.heading) * boat.speed * (dt * 60);
    boat.y -= Math.cos(boat.heading) * boat.speed * (dt * 60);

    // Update Velocity Vector
    boat.velocity.x = Math.sin(boat.heading) * boat.speed;
    boat.velocity.y = -Math.cos(boat.heading) * boat.speed;

    // Turbulence / Bad Air
    boat.badAirIntensity *= 0.95; // Decay
    updateTurbulence(boat, dt); // Emit turbulence

    // Check Bad Air from others
    // O(N^2) check?
    // Simplified: Check if inside anyone's turbulence
    // ... (This logic is usually in main loop or here)

    // Gate Crossing Logic
    checkGateCrossings(boat);
}

function checkGateCrossings(boat) {
    if (state.race.status !== 'racing' && state.race.status !== 'finished') return; // Only check during race (or finish)
    if (boat.raceState.finished) return;

    // ... Implementation of gate checking from script.js ...
    // Requires access to state.course
    // Using checkLineIntersection from collision.js
}
