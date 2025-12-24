
import re

filepath = 'regatta/js/script.js'

with open(filepath, 'r') as f:
    content = f.read()

# 1. Boat Class Stats Removal
# Remove the block starting from // Personality Stats ... up to this.currentStats = ...
# Original:
#         // Personality Stats
#         if (config) {
#              this.stats = {
#                  boatHandling: 3,
#                  windSense: 3,
#                  positioning: 3,
#                  aggression: 3,
#                  composure: 3,
#                  creature: config.creature || "Unknown"
#              };
#         } else {
#              // Default stats for Player or unknown
#              this.stats = { boatHandling: 5, windSense: 5, positioning: 5, aggression: 3, composure: 5 };
#         }
#         // Dynamic stats (can be reduced by penalties/stress)
#         this.currentStats = { ...this.stats };

pattern_boat_stats = r"// Personality Stats\s+if \(config\) \{[\s\S]*?this\.currentStats = \{ \.\.\.this\.stats \};"
replacement_boat_stats = "// Personality Stats Removed for Basic AI"
content = re.sub(pattern_boat_stats, replacement_boat_stats, content)

# Remove `creature: config.creature || "Unknown"` from stats, but keep `creature` property if needed for UI?
# The UI uses `boat.stats.creature`. I should probably keep `this.creature` on the boat object directly if I remove stats.
# UI code: `boat.stats.creature || "Unknown"`
# I should patch the Boat constructor to set `this.creature` and patch the UI to use `this.creature`.

# Let's add `this.creature` to the Boat constructor.
# Find `this.lbRank = 0;` and add `this.creature = config ? (config.creature || "Unknown") : "Unknown";`
content = content.replace("this.lbRank = 0;", 'this.lbRank = 0;\n        this.creature = config ? (config.creature || "Unknown") : "Unknown";')

# Patch UI to use boat.creature instead of boat.stats.creature
content = content.replace("boat.stats.creature", "boat.creature")


# 2. updateAITrim Replacement
new_updateAITrim = """function updateAITrim(boat, optimalSailAngle, dt) {
    // Basic AI Trim: Adjust towards optimal at a fixed rate
    const trimSpeed = 1.0; // Radians per second
    let target = optimalSailAngle;

    if (boat.ai.forcedLuff > 0) {
        target = optimalSailAngle + boat.ai.forcedLuff * (Math.PI / 2.0);
    }

    const current = boat.manualSailAngle;
    const diff = target - current;
    const step = trimSpeed * dt;

    if (Math.abs(diff) < step) boat.manualSailAngle = target;
    else boat.manualSailAngle += Math.sign(diff) * step;

    boat.sailAngle = boat.manualSailAngle * boat.boomSide;
}"""

# Use regex to replace the function, assuming standard formatting
pattern_updateAITrim = r"function updateAITrim\(boat, optimalSailAngle, dt\) \{[\s\S]*?\}"
# Need to be careful not to match too much. Function ends with closing brace.
# Since braces are nested, regex is hard.
# I will use a known unique string at start and end of function in the original file?
# Or just use the original content string to replace.

original_updateAITrim_start = "function updateAITrim(boat, optimalSailAngle, dt) {"
original_updateAITrim_end = "boat.sailAngle = boat.manualSailAngle * boat.boomSide;\n}"

# I'll rely on string replacement of the entire function body if I can extract it,
# or just regex with careful non-greedy match if unique.
# Actually, I can just replace the whole text block if I have it.
# But indentation might vary.

# Let's try to identify the block by start and next function definition.
# Next function is getFavoredEnd
pattern_updateAITrim_full = r"function updateAITrim\(boat, optimalSailAngle, dt\) \{[\s\S]*?^\}"
# Multiline regex matching is tricky.

# Let's use string find.
start_idx = content.find("function updateAITrim(boat, optimalSailAngle, dt) {")
end_idx = content.find("function getFavoredEnd() {")
if start_idx != -1 and end_idx != -1:
    # Find the last closing brace before getFavoredEnd
    # It should be the end of updateAITrim
    # Scan backwards from end_idx
    scan = end_idx - 1
    while content[scan].isspace():
        scan -= 1
    if content[scan] == '}':
        # Found it
        content = content[:start_idx] + new_updateAITrim + "\n\n" + content[end_idx:]
    else:
        print("Error: Could not find end of updateAITrim")
else:
    print("Error: Could not find updateAITrim start or next function")


# 3. updateStartStrategy Replacement
new_updateStartStrategy = """function updateStartStrategy(boat, dt) {
    // Basic Start: Pick a spot on the line and hover near it
    const timer = state.race.timer;
    const marks = state.course.marks;
    if (!marks || marks.length < 2) return { x: boat.x, y: boat.y, angle: 0, speedLimit: 1.0 };

    const m0 = marks[0];
    const m1 = marks[1];

    // Assign a fixed target percentage if not exists
    if (boat.ai.startLinePct === undefined) {
        // Random spot, but keep away from very edges
        boat.ai.startLinePct = 0.1 + Math.random() * 0.8;
    }

    // Line Vector
    const ldx = m1.x - m0.x;
    const ldy = m1.y - m0.y;
    const pX = m0.x + ldx * boat.ai.startLinePct;
    const pY = m0.y + ldy * boat.ai.startLinePct;

    const windDir = state.wind.direction;
    const downwindDir = windDir + Math.PI;
    const dwx = Math.sin(downwindDir);
    const dwy = -Math.cos(downwindDir);

    let targetX = pX;
    let targetY = pY;
    let speedLimit = 1.0;

    // Distance to line check
    // Projected distance
    const distToLine = (boat.x - pX) * dwx + (boat.y - pY) * dwy;

    if (timer > 10) {
        // Hover back
        targetX = pX + dwx * 100;
        targetY = pY + dwy * 100;
        if (distToLine < 80) speedLimit = 0.1;
    } else {
        // Approach
        // Calculate time to run distance
        const dist = Math.sqrt((boat.x - pX)**2 + (boat.y - pY)**2);
        const timeToRun = dist / (boat.speed * 60 + 0.1); // approx

        if (timeToRun < timer - 1) {
            speedLimit = 0.2; // Slow down, too early
        } else {
            speedLimit = 1.0;
        }
    }

    // OCS Avoidance
    if (distToLine < 10 && timer > 0.5) {
         speedLimit = 0.0;
         targetX = pX + dwx * 50; // Back up
         targetY = pY + dwy * 50;
    }

    const targetAngle = Math.atan2(targetX - boat.x, -(targetY - boat.y));
    return { x: targetX, y: targetY, angle: targetAngle, speedLimit };
}"""

start_idx = content.find("function updateStartStrategy(boat, dt) {")
end_idx = content.find("function updateAI(boat, dt) {")
if start_idx != -1 and end_idx != -1:
    scan = end_idx - 1
    while content[scan].isspace():
        scan -= 1
    if content[scan] == '}':
        content = content[:start_idx] + new_updateStartStrategy + "\n\n" + content[end_idx:]
    else:
        print("Error: Could not find end of updateStartStrategy")
else:
    print("Error: Could not find updateStartStrategy start or next function")


# 4. updateAI Replacement
new_updateAI = """function updateAI(boat, dt) {
    if (boat.isPlayer && !boat.raceState.finished) return;

    const timeScale = dt * 60;
    const localWind = getWindAt(boat.x, boat.y);
    const windDir = localWind.direction;
    let targetX, targetY;
    let speedLimit = 1.0;

    // 1. Determine Strategic Target
    if (boat.raceState.finished) {
        const b = state.course.boundary;
        if (b) {
            const dx = boat.x - b.x;
            const dy = boat.y - b.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0.1) {
                 targetX = b.x + (dx/dist) * (b.radius + 500);
                 targetY = b.y + (dy/dist) * (b.radius + 500);
            } else {
                 targetX = boat.x + 1000; targetY = boat.y;
            }
        } else {
            targetX = boat.x + 1000; targetY = boat.y;
        }
    } else if (state.race.status === 'prestart') {
        const strat = updateStartStrategy(boat, dt);
        targetX = strat.x;
        targetY = strat.y;
        speedLimit = strat.speedLimit !== undefined ? strat.speedLimit : 1.0;
    } else {
        const waypoint = boat.raceState.nextWaypoint;
        const marks = state.course.marks;

        if (marks && marks.length >= 4) {
            let indices = (boat.raceState.leg === 0 || boat.raceState.leg === 2 || boat.raceState.leg === 4) ? [0, 1] : [2, 3];

            if (boat.raceState.leg === 0) {
                 const m0 = marks[0];
                 const m1 = marks[1];
                 const linePct = boat.ai.startLinePct !== undefined ? boat.ai.startLinePct : 0.5;

                 const ldx = m1.x - m0.x;
                 const ldy = m1.y - m0.y;
                 const pX = m0.x + ldx * linePct;
                 const pY = m0.y + ldy * linePct;

                 targetX = pX;
                 targetY = pY;

                 const downwindDir = windDir + Math.PI;
                 const dwx = Math.sin(downwindDir);
                 const dwy = -Math.cos(downwindDir);
                 const distToLine = (boat.x - pX)*dwx + (boat.y - pY)*dwy;

                 if (distToLine < -5) {
                      const recoverDist = 150;
                      targetX = pX + dwx * recoverDist;
                      targetY = pY + dwy * recoverDist;
                 }

            } else if (boat.raceState.isRounding) {
                const m1 = marks[indices[0]];
                const m2 = marks[indices[1]];
                const d1 = (boat.x - m1.x) ** 2 + (boat.y - m1.y) ** 2;
                const d2 = (boat.x - m2.x) ** 2 + (boat.y - m2.y) ** 2;
                const targetMark = (d1 < d2) ? m1 : m2;

                // Basic rounding: aim slightly wide
                const cx = (m1.x + m2.x) / 2;
                const cy = (m1.y + m2.y) / 2;
                const vmx = targetMark.x - cx;
                const vmy = targetMark.y - cy;
                const distM = Math.sqrt(vmx*vmx + vmy*vmy);
                const ux = vmx / distM;
                const uy = vmy / distM;
                const offset = 100; // Fixed wide turn
                targetX = targetMark.x + ux * offset;
                targetY = targetMark.y + uy * offset;
            } else {
                const m1 = marks[indices[0]];
                const m2 = marks[indices[1]];
                const gCx = (m1.x + m2.x) / 2;
                const gCy = (m1.y + m2.y) / 2;
                targetX = gCx;
                targetY = gCy;

                // Missed gate check
                const wd = state.wind.direction;
                const flowX = -Math.sin(wd);
                const flowY = Math.cos(wd);
                const isUpwindLeg = (boat.raceState.leg % 2 !== 0);

                let fwdX, fwdY;
                if (isUpwindLeg) {
                     fwdX = -flowX; fwdY = -flowY;
                } else {
                     fwdX = flowX; fwdY = flowY;
                }

                const dx = boat.x - gCx;
                const dy = boat.y - gCy;
                const distPast = dx * fwdX + dy * fwdY;

                if (distPast > 50) {
                     targetX = gCx - fwdX * 200;
                     targetY = gCy - fwdY * 200;
                }
            }
        } else {
            targetX = waypoint.x;
            targetY = waypoint.y;
        }
    }

    const dx = targetX - boat.x;
    const dy = targetY - boat.y;
    let targetAngle = Math.atan2(dx, -dy);

    const isRacing = state.race.status === 'racing';
    const isPrestart = state.race.status === 'prestart';
    if (isRacing || isPrestart) {
        const speedThreshold = 0.25;
        const timeThreshold = isRacing ? 4.0 : 6.0;
        if (boat.speed < speedThreshold) boat.ai.stuckTimer += dt;
        else boat.ai.stuckTimer = Math.max(0, boat.ai.stuckTimer - dt);

        if (boat.ai.stuckTimer > timeThreshold && !boat.ai.recoveryMode) {
             boat.ai.recoveryMode = true;
             const currentWindAngle = normalizeAngle(boat.heading - windDir);
             let side = (currentWindAngle > 0) ? 1 : -1;
             boat.ai.recoveryTarget = normalizeAngle(windDir + side * 1.6);
        }
        if (boat.ai.recoveryMode) {
             if (boat.speed > 1.0) {
                 boat.ai.recoveryMode = false;
                 boat.ai.stuckTimer = 0;
             } else {
                 targetAngle = boat.ai.recoveryTarget;
                 speedLimit = 1.0;
             }
        }
    }

    let desiredHeading = boat.heading;
    if (boat.ai.recoveryMode) {
        desiredHeading = boat.ai.recoveryTarget;
    } else {
        const angleToTarget = targetAngle;
        let mode = 'reach';
        const noGoLimit = Math.PI / 4.2;
        const downwindLimit = Math.PI * 0.75;
        const windToTarget = normalizeAngle(angleToTarget - windDir);
        const absWindToTarget = Math.abs(windToTarget);

        if (absWindToTarget < noGoLimit) mode = 'upwind';
        else if (absWindToTarget > downwindLimit) mode = 'downwind';

        if (boat.ai.tackCooldown > 0) boat.ai.tackCooldown -= dt;

        const angleToWind = normalizeAngle(boat.heading - windDir);
        if (state.race.status === 'racing' && boat.speed < 1.0 && Math.abs(angleToWind) < 0.6) {
             const side = angleToWind > 0 ? 1 : -1;
             desiredHeading = normalizeAngle(windDir + side * 1.05);
        } else {
            let legMode = mode;
            if (state.race.status === 'racing') {
                 if (boat.raceState.leg === 1 || boat.raceState.leg === 3) legMode = 'upwind';
                 else if (boat.raceState.leg === 2 || boat.raceState.leg === 4) legMode = 'downwind';
                 else if (boat.raceState.leg === 0) legMode = 'upwind';
            }

            const currentTack = (angleToWind > 0) ? 1 : -1;
            const bestTWA = (legMode === 'upwind') ? (45 * Math.PI/180) : (150 * Math.PI/180);
            const headingOnTack = normalizeAngle(windDir + currentTack * bestTWA);
            const headingOnSwap = normalizeAngle(windDir - currentTack * bestTWA);

            const vmgCurrent = Math.cos(normalizeAngle(headingOnTack - angleToTarget));
            const vmgSwap = Math.cos(normalizeAngle(headingOnSwap - angleToTarget));

            // Fixed threshold for basic AI
            let swapThreshold = 0.15;

            let outsideLayline = false;
            const safeAbsAngle = Math.abs(windToTarget);
            const absWindToTargetDeg = safeAbsAngle * (180/Math.PI);

            if (legMode === 'upwind') {
                if (absWindToTargetDeg > 50) {
                     swapThreshold -= 0.5;
                     outsideLayline = true;
                }
            } else if (legMode === 'downwind') {
                if (absWindToTargetDeg < 140) {
                     swapThreshold -= 0.5;
                     outsideLayline = true;
                }
            }

            let shouldSwap = false;
            if (checkBoundaryExiting(boat)) shouldSwap = true;
            else if (boat.ai.tackCooldown <= 0) {
                 if (outsideLayline) {
                      if (vmgSwap > vmgCurrent + swapThreshold) {
                           if (boat.speed > 1.0 || legMode === 'downwind') shouldSwap = true;
                      }
                 } else {
                      if (vmgSwap > vmgCurrent + swapThreshold) {
                           if (boat.speed > 1.5 || legMode === 'downwind') shouldSwap = true;
                      }
                 }
            }

            if (shouldSwap) {
                desiredHeading = headingOnSwap;
                boat.ai.tackCooldown = 10.0; // Fixed cooldown
            } else if (mode === 'reach') {
                desiredHeading = angleToTarget;
            } else {
                desiredHeading = headingOnTack;
            }
        }
    }

    // Basic Collision Avoidance
    let steerBias = 0;
    const detectRadius = 300;
    let avoidanceCount = 0;

    if (state.course.boundary) {
        const b = state.course.boundary;
        const dx = boat.x - b.x;
        const dy = boat.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const margin = 500;
        if (dist > b.radius - margin) {
            const strength = Math.pow((dist - (b.radius - margin)) / margin, 3) * 4.0;
            const angleToCenter = Math.atan2(-dy, -dx);
            const diff = normalizeAngle(angleToCenter - desiredHeading);
            steerBias += diff * strength;
        }
    }

    const others = state.boats.filter(b => b !== boat && !b.raceState.finished).map(b => {
        const dSq = (b.x - boat.x)**2 + (b.y - boat.y)**2;
        return { boat: b, distSq: dSq };
    }).sort((a,b) => a.distSq - b.distSq);

    for (const item of others) {
        if (avoidanceCount >= 2) break;
        if (item.distSq > detectRadius * detectRadius) break;

        const other = item.boat;
        const dist = Math.sqrt(item.distSq);

        if (isConflictSoon(boat, other)) {
             avoidanceCount++;
             const rowBoat = getRightOfWay(boat, other);
             const iHaveROW = (rowBoat === boat);

             if (iHaveROW) {
                 if (dist < 80) {
                     const angleToOther = Math.atan2(other.x - boat.x, -(other.y - boat.y));
                     const diff = normalizeAngle(desiredHeading - angleToOther);
                     const turnDir = (diff > 0) ? 1 : -1;
                     steerBias += turnDir * 2.0;
                 }
             } else {
                 const oh = other.heading;
                 const sternX = other.x - Math.sin(oh) * 50;
                 const sternY = other.y + Math.cos(oh) * 50;
                 const safeX = sternX - Math.sin(oh) * 80;
                 const safeY = sternY + Math.cos(oh) * 80;

                 const angleToSafe = Math.atan2(safeX - boat.x, -(safeY - boat.y));
                 const diff = normalizeAngle(angleToSafe - desiredHeading);

                 const urgency = Math.min(2.0, 300 / dist);
                 steerBias += diff * urgency;

                 if (dist < 150) {
                     const angleToOther = Math.atan2(other.x - boat.x, -(other.y - boat.y));
                     if (Math.abs(normalizeAngle(boat.heading - angleToOther)) < 0.5) {
                         speedLimit = Math.min(speedLimit, 0.4);
                     }
                 }
             }
        }
    }

    if (state.course.marks) {
        for (const m of state.course.marks) {
            const dx = m.x - boat.x;
            const dy = m.y - boat.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 150) {
                 const angleToMark = Math.atan2(dx, -dy);
                 const diff = normalizeAngle(desiredHeading - angleToMark);
                 const pushDir = (diff > 0) ? 1 : -1;
                 const strength = (1.0 - dist/150) * 2.5;
                 steerBias += pushDir * strength;
            }
        }
    }

    steerBias = Math.max(-Math.PI/1.5, Math.min(Math.PI/1.5, steerBias));
    desiredHeading += steerBias;
    boat.ai.targetHeading = normalizeAngle(desiredHeading);

    if (boat.ai.recoveryMode) speedLimit = 1.0;

    if (speedLimit < 0.9) {
        boat.ai.forcedLuff = 1.0 - speedLimit;
    } else {
        boat.ai.forcedLuff = 0;
    }

    let diff = normalizeAngle(boat.ai.targetHeading - boat.heading);
    const aiTurnRate = CONFIG.turnSpeed * timeScale * 0.8; // Fixed turn rate factor 0.8
    if (Math.abs(diff) > aiTurnRate) boat.heading += Math.sign(diff) * aiTurnRate;
    else boat.heading = boat.ai.targetHeading;

    const windAngle = Math.abs(normalizeAngle(windDir - boat.heading));
    boat.spinnaker = (windAngle > Math.PI * 0.6) && (speedLimit > 0.8);
}"""

start_idx = content.find("function updateAI(boat, dt) {")
end_idx = content.find("function triggerPenalty(boat) {")
if start_idx != -1 and end_idx != -1:
    scan = end_idx - 1
    while content[scan].isspace():
        scan -= 1
    if content[scan] == '}':
        content = content[:start_idx] + new_updateAI + "\n\n" + content[end_idx:]
    else:
        print("Error: Could not find end of updateAI")
else:
    print("Error: Could not find updateAI start or next function")


# 5. triggerPenalty Replacement
new_triggerPenalty = """function triggerPenalty(boat) {
    if (boat.raceState.finished) return;
    if (!settings.penaltiesEnabled) return;

    // Reset timer if already penalized? Or just ignore?
    // Usually penalties stack or reset. Let's reset the timer to 10s.
    if (!boat.raceState.penalty) {
        boat.raceState.penalty = true;
        boat.raceState.totalPenalties++; // Only increment start of penalty
    }

    if (boat.isPlayer) Sound.playPenalty();

    // Always reset timer to 10s on new penalty trigger
    boat.raceState.penaltyTimer = 10.0;

    if (boat.isPlayer) {
        showRaceMessage("PENALTY! SPEED REDUCED 50% FOR 10s", "text-red-500", "border-red-500/50");
    }
}"""

start_idx = content.find("function triggerPenalty(boat) {")
end_idx = content.find("function updateBoat(boat, dt) {")
if start_idx != -1 and end_idx != -1:
    scan = end_idx - 1
    while content[scan].isspace():
        scan -= 1
    if content[scan] == '}':
        content = content[:start_idx] + new_triggerPenalty + "\n\n" + content[end_idx:]
    else:
        print("Error: Could not find end of triggerPenalty")
else:
    print("Error: Could not find triggerPenalty start or next function")


# 6. updateBoat Replacement (Remove composure)
# I will just replace the specific block inside updateBoat using regex or string replace.
# Original:
#     if (!boat.isPlayer || boat.raceState.finished) {
#         // Composure Recovery
#         const composure = boat.stats.composure;
#         const recoveryRate = 0.05 + (composure - 1) * 0.05; // 0.05 to 0.25 per sec
#
#         // Recover handling
#         if (boat.currentStats.boatHandling < boat.stats.boatHandling) {
#             boat.currentStats.boatHandling = Math.min(boat.stats.boatHandling, boat.currentStats.boatHandling + recoveryRate * dt);
#         }
#         // Recover wind sense
#         if (boat.currentStats.windSense < boat.stats.windSense) {
#             boat.currentStats.windSense = Math.min(boat.stats.windSense, boat.currentStats.windSense + recoveryRate * dt);
#         }
#
#         updateAI(boat, dt);
#     }

pattern_composure = r"if \(!boat\.isPlayer \|\| boat\.raceState\.finished\) \{[\s\S]*?updateAI\(boat, dt\);\s+\}"
replacement_composure = """if (!boat.isPlayer || boat.raceState.finished) {
        updateAI(boat, dt);
    }"""
content = re.sub(pattern_composure, replacement_composure, content)


# 7. resetGame Logic
# Find the block where AI boats are created.
# Original:
#         ai.speed = 0; // Initial speed
#
#         // Pick Strategy
#         ai.ai.startStrategy = "Mid-Line Safety Start";
#
#         // Determine Start Area and Position
#         // Areas: Left, Right, Mid-Front, Mid-Back
#         const areas = ['Left', 'Right', 'Mid-Front', 'Mid-Back'];
#         // Distribute randomly
#         let area = areas[Math.floor(Math.random() * areas.length)];
#
#         ai.ai.startArea = area;
#
#         // Determine Target Pct based on Area
#         let linePct = 0.5;
#         const width = 0.2; // random variance
#         const r = Math.random();
#
#         if (area === 'Left') linePct = 0.1 + r * 0.25; // 0.1 - 0.35
#         else if (area === 'Right') linePct = 0.65 + r * 0.25; // 0.65 - 0.9
#         else { // Mid
#             linePct = 0.35 + r * 0.3; // 0.35 - 0.65
#         }
#         ai.ai.startLinePct = linePct;
#
#         // Setup Distance
#         if (area === 'Mid-Back') {
#              ai.ai.setupDist = 400 + Math.random() * 150;
#         } else {
#              ai.ai.setupDist = 250 + Math.random() * 100;
#         }
#
#         state.boats.push(ai);

# I will replace this with a simpler random assignment.
start_marker = "ai.speed = 0; // Initial speed"
end_marker = "state.boats.push(ai);"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    new_setup = """ai.speed = 0; // Initial speed

        // Basic Start Setup
        ai.ai.startLinePct = 0.1 + Math.random() * 0.8;
        ai.ai.setupDist = 250 + Math.random() * 100;

        """
    content = content[:start_idx] + new_setup + content[end_idx:]
else:
    print("Error: Could not find AI setup in resetGame")

# 8. Remove turnFactor usage in updateAI if I missed it?
# My new updateAI doesn't use boat.currentStats.boatHandling.
# But I should check if turnFactor is used in updateBoat?
# Original updateBoat:
# const turnFactor = 0.6 + (boat.currentStats.boatHandling - 1) * 0.1;
# No, that was in the ORIGINAL updateAI.
# In updateBoat, it handles PLAYER input:
# const turnRate = (state.keys.Shift ? CONFIG.turnSpeed * 0.25 : CONFIG.turnSpeed) * timeScale;
# So updateBoat is fine.
# But wait, looking at my read output, updateAI was called inside updateBoat, and updateAI had the turn logic.
# My new updateAI has:
# const aiTurnRate = CONFIG.turnSpeed * timeScale * 0.8;
# So it doesn't use stats.

# Wait, `updateAITrim` is called in `updateBoat` for manual trim simulation.
# I updated `updateAITrim` to remove handling stats.

# One more thing: `boat.currentStats` is referenced in `updateBoat`?
#     if (!boat.isPlayer || boat.raceState.finished) {
#         // Composure Recovery ...
#     }
# I removed that block in step 6.

# Does `boat.currentStats` appear anywhere else?
# Let's check `drawBoat`.
# No stats used there.

# Write the file
with open(filepath, 'w') as f:
    f.write(content)

print("Successfully modified regatta/js/script.js")
