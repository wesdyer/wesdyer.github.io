
import { state } from '../state/state.js';

export function getRiskMetrics(boat, other) {
    const dx = other.x - boat.x;
    const dy = other.y - boat.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Relative Velocity (units/sec)
    // boat.velocity is updated in updateBoat, but if it's not ready, estimate from heading/speed
    const vx1 = (Math.sin(boat.heading) * boat.speed) * 60;
    const vy1 = (-Math.cos(boat.heading) * boat.speed) * 60;

    const vx2 = (Math.sin(other.heading) * other.speed) * 60;
    const vy2 = (-Math.cos(other.heading) * other.speed) * 60;

    const relPx = dx;
    const relPy = dy;
    const relVx = vx2 - vx1;
    const relVy = vy2 - vy1;

    const vSq = relVx*relVx + relVy*relVy;

    let tCPA = 0;
    let distCPA = dist;

    if (vSq > 0.001) {
        const dot = relPx*relVx + relPy*relVy;
        tCPA = -dot / vSq;
        if (tCPA > 0) {
            const cpaX = relPx + relVx * tCPA;
            const cpaY = relPy + relVy * tCPA;
            distCPA = Math.sqrt(cpaX*cpaX + cpaY*cpaY);
        }
    }

    return { tCPA, distCPA, distCurrent: dist };
}

function getClearAstern(behind, ahead) {
    // A boat is Clear Astern if her hull is behind a line abeam from the aftermost point of the other boat's hull.
    const ahH = ahead.heading;
    const fwdX = Math.sin(ahH), fwdY = -Math.cos(ahH); // Points to Bow
    const sternX = ahead.x - fwdX * 30;
    const sternY = ahead.y - fwdY * 30;

    // We need to check if 'behind' boat's BOW is behind 'ahead' boat's STERN line.
    const bhH = behind.heading;
    const bhFwdX = Math.sin(bhH), bhFwdY = -Math.cos(bhH);
    const bowX = behind.x + bhFwdX * 25;
    const bowY = behind.y + bhFwdY * 25;

    // Vector from Ahead's Stern to Behind's Bow
    const dx = bowX - sternX;
    const dy = bowY - sternY;

    // Project onto Ahead's Forward Vector
    const dot = dx * fwdX + dy * fwdY;

    // If dot < 0, Behind's Bow is "behind" the abeam line at Ahead's Stern.
    return dot < 0;
}

export function getRightOfWay(b1, b2) {
    // Priority: Rule 14 -> 18 -> 13 -> 10 -> 11/12 -> 17/16

    // 1. Mark Room (Rule 18)
    const leg = b1.raceState.leg; // Assume same leg context for simplicity
    const isRacing = state.race.status === 'racing';

    const t1 = b1.boomSide > 0 ? 1 : -1;
    const t2 = b2.boomSide > 0 ? 1 : -1;
    const oppositeTacks = (t1 !== t2);
    const isUpwind = (leg % 2 !== 0); // Odd legs are upwind

    let rule18Applies = false;
    if (isRacing && leg > 0 && leg <= state.race.totalLegs) {
        // Exclusion: Opposite tacks on a beat to windward
        if (!(isUpwind && oppositeTacks)) {
             if (b1.raceState.inZone || b2.raceState.inZone) {
                 rule18Applies = true;
             }
        }
    }

    if (rule18Applies) {
        // Simplification: If one is in zone and other isn't, the one in zone usually established it first.
        if (b1.raceState.inZone !== b2.raceState.inZone) {
            return {
                boat: b1.raceState.inZone ? b1 : b2,
                rule: "Rule 18",
                reason: "Mark-Room (Zone Entry)"
            };
        }

        // Both in zone
        const b1Astern = getClearAstern(b1, b2);
        const b2Astern = getClearAstern(b2, b1);
        const overlapped = !b1Astern && !b2Astern;

        if (overlapped) {
            // Inside boat has ROW.
            // Determine which is inside relative to the mark.
            let activeIndices = (leg % 2 === 0) ? [0, 1] : [2, 3];
            let targetMark = state.course.marks[activeIndices[0]];
            let minD = Infinity;
            for (const idx of activeIndices) {
                const m = state.course.marks[idx];
                const d = (b1.x - m.x)**2 + (b1.y - m.y)**2;
                if (d < minD) { minD = d; targetMark = m; }
            }

            const d1 = (b1.x - targetMark.x)**2 + (b1.y - targetMark.y)**2;
            const d2 = (b2.x - targetMark.x)**2 + (b2.y - targetMark.y)**2;
            const winner = (d1 < d2) ? b1 : b2;
            return { boat: winner, rule: "Rule 18", reason: "Mark-Room (Inside)" };
        } else {
            // Clear Ahead has ROW
            const winner = b1Astern ? b2 : b1;
            return { boat: winner, rule: "Rule 18", reason: "Mark-Room (Clear Ahead)" };
        }
    }

    // 2. Rule 13 (While Tacking)
    if (b1.raceState.isTacking && !b2.raceState.isTacking) return { boat: b2, rule: "Rule 13", reason: "Tacking" };
    if (!b1.raceState.isTacking && b2.raceState.isTacking) return { boat: b1, rule: "Rule 13", reason: "Tacking" };

    // 3. Rule 10 (Opposite Tacks)
    if (oppositeTacks) {
        const winner = (t1 === 1) ? b1 : b2; // Starboard (1) wins
        return { boat: winner, rule: "Rule 10", reason: "Port vs Starboard" };
    }

    // 4. Same Tack (Rule 11 & 12)
    const b1Astern12 = getClearAstern(b1, b2);
    const b2Astern12 = getClearAstern(b2, b1);

    if (b1Astern12 && !b2Astern12) return { boat: b2, rule: "Rule 12", reason: "Clear Ahead" }; // b2 Ahead wins (Rule 12)
    if (b2Astern12 && !b1Astern12) return { boat: b1, rule: "Rule 12", reason: "Clear Ahead" }; // b1 Ahead wins (Rule 12)

    // Rule 11: Overlapped, Same Tack -> Leeward ROW
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const wDir = state.wind.direction;
    const ux = Math.sin(wDir);
    const uy = -Math.cos(wDir);
    // Right of Wind Vector
    const rx = -uy;
    const ry = ux;
    const dotRight = dx * rx + dy * ry;

    if (t1 === 1) { // Starboard Tack
        // Wind from Right. Leeward is Left.
        // dotRight > 0 => b2 is Right (Windward). b1 is Leeward.
        const winner = (dotRight > 0) ? b1 : b2;
        return { boat: winner, rule: "Rule 11", reason: "Windward/Leeward" };
    } else { // Port Tack
        // Wind from Left. Leeward is Right.
        // dotRight > 0 => b2 is Right (Leeward). b1 is Windward.
        const winner = (dotRight > 0) ? b2 : b1;
        return { boat: winner, rule: "Rule 11", reason: "Windward/Leeward" };
    }
}
