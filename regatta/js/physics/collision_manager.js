
import { state } from '../state/state.js';
import { getHullPolygon, satPolygonPolygon, satPolygonCircle } from './collision.js';
import { getRightOfWay } from './rules.js';
import { Sayings } from '../ai/sayings.js';
import { showRaceMessage, hideRaceMessage } from '../ui/ui.js';
import { Sound } from '../audio/sound.js';

export function checkBoatCollisions(dt) {
    const broadRadius = 40;
    for (let i = 0; i < state.boats.length; i++) {
        const b1 = state.boats[i];
        if (b1.raceState.finished && b1.fadeTimer <= 0) continue;

        const poly1 = getHullPolygon(b1);
        for (let j = i + 1; j < state.boats.length; j++) {
            const b2 = state.boats[j];
            if (b2.raceState.finished && b2.fadeTimer <= 0) continue;

            const dx = b2.x - b1.x, dy = b2.y - b1.y;
            if (dx*dx + dy*dy > (broadRadius*2)**2) continue;

            const poly2 = getHullPolygon(b2);
            const res = satPolygonPolygon(poly1, poly2);

            if (res) {
                // ... Collision Response ...
                const tx = res.axis.x * res.overlap * 0.5;
                const ty = res.axis.y * res.overlap * 0.5;
                b1.x -= tx; b1.y -= ty;
                b2.x += tx; b2.y += ty;

                // Simple Friction
                b1.speed *= 0.9;
                b2.speed *= 0.9;

                // Penalties
                if (state.race.status === 'racing' && !b1.raceState.finished && !b2.raceState.finished) {
                    const row = getRightOfWay(b1, b2);
                    // Apply penalty to row.boat ? No, row.boat is Right of Way. Penalty to OTHER.
                    const winner = row.boat;
                    const loser = (winner === b1) ? b2 : b1;
                    triggerPenalty(loser);

                    if (b1.isPlayer || b2.isPlayer) {
                        const ai = b1.isPlayer ? b2 : b1;
                        if (ai === loser) Sayings.queueQuote(ai, "they_hit_player"); // Actually if AI hit player (AI is loser)
                        else Sayings.queueQuote(ai, "they_were_hit"); // AI was hit (Player is loser)
                    }
                }
            }
        }
    }
}

export function checkMarkCollisions(dt) {
    if (!state.course || !state.course.marks) return;
    const markRadius = 12;

    for (const boat of state.boats) {
        // ... (Broad phase check)
        const poly = getHullPolygon(boat);
        for (const mark of state.course.marks) {
            const res = satPolygonCircle(poly, mark, markRadius);
            if (res) {
                // Store AI data
                if (boat.ai) boat.ai.collisionData = { type: 'mark', normal: res.axis };

                // Response
                boat.x -= res.axis.x * res.overlap;
                boat.y -= res.axis.y * res.overlap;
                boat.speed *= 0.9;

                if (state.race.status === 'racing') triggerPenalty(boat);
            }
        }
    }
}

function triggerPenalty(boat) {
    if (boat.raceState.penalty) return; // Already penalized
    // Check settings
    // ...
    boat.raceState.penalty = true;
    boat.raceState.penaltyTimer = 10.0;
    boat.raceState.totalPenalties++;

    if (boat.isPlayer) {
        Sound.playPenalty();
        showRaceMessage("PENALTY! 10s SLOW DOWN", "text-red-500", "border-red-500/50");
    }
}
