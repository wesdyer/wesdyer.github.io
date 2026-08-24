// regatta/js/sim/collision.js — collision detection and resolution: hull
// polygons, SAT tests, boat/mark/near-miss checks, rounding & foul constants,
// circle/hull-poly tests, traffic and island collisions, and the rule-19
// ledger. Resolution order (boats, marks, traffic, land last) is set by
// update() in script.js. Classic script; global scope. Extracted verbatim from
// script.js (refactor 2026-08-24).
const HULL_LOCALS = [
    {x: 0, y: -25}, {x: 15, y: -5}, {x: 15, y: 20},
    {x: 12, y: 30}, {x: -12, y: 30}, {x: -15, y: 20}, {x: -15, y: -5}
];
// Taking a POSE rather than a boat, so the previous frame's hull can be reconstructed from
// `lastPos` + `prevHeading` instead of cached alongside them. A cached copy is a second
// source of truth for where the boat was, and it went stale the moment anything drove
// updateBoatRaceState without going through updateBoat — which the gate tests do.
function hullPolygonAt(x, y, heading) {
    const cos = Math.cos(heading), sin = Math.sin(heading);
    return HULL_LOCALS.map(p => ({
        x: x + (p.x * cos - p.y * sin),
        y: y + (p.x * sin + p.y * cos)
    }));
}
function getHullPolygon(boat) { return hullPolygonAt(boat.x, boat.y, boat.heading); }

// How far the boat's LEADING EDGE is over a line — the quantity RRS judges a start by, and
// therefore the one the start AI has to steer. `normalize` scales to real units; unnormalized
// keeps the raw cross-product the approach timer was written against.
// ⚠️ SIGNED THE WAY THE ROUTE SAYS THE LINE IS CROSSED, not the way its two marks happen
// to be ordered in the array. `startCrossNormal()` already makes that point for the
// placement and the OCS test; this function is the AI's own view of the same line and it
// was the one place still reading the raw mark order.
//
// Two of the ten venues author their start entry with `dir: -1` (Bluewater and Redrock,
// both gate starts). On those, every caller here got the sign INVERTED — so the prestart
// read a boat correctly sitting behind the line as OVER EARLY, and `getStartCommand`'s
// retreat branch backs off by `STAGE + pDist`, which grows as she retreats. A runaway.
// Measured before the fix: the fleet's median distance from the line went -386 -> -1731
// on ocean and -383 -> -1078 on redrock through the prestart, against -419 -> -128 on bay.
// They sailed away from the line for the whole prestart and only turned for it at the gun.
function hullLineOffset(boat, m0, m1, normalize, sgn) {
    const dx = m1.x - m0.x, dy = m1.y - m0.y;
    const len = normalize ? (Math.hypot(dx, dy) || 1) : 1;
    const s = sgn != null ? sgn : startCrossSign();
    let best = -Infinity;
    for (const p of hullPolygonAt(boat.x, boat.y, boat.heading)) {
        const d = s * ((p.x - m0.x) * dy - (p.y - m0.y) * dx) / len;
        if (d > best) best = d;
    }
    return best;
}

function projectPolygon(axis, poly) {
    let min = Infinity, max = -Infinity;
    for (const p of poly) {
        const dot = p.x * axis.x + p.y * axis.y;
        if (dot < min) min = dot;
        if (dot > max) max = dot;
    }
    return { min, max };
}

function projectCircle(axis, center, radius) {
    const dot = center.x * axis.x + center.y * axis.y;
    return { min: dot - radius, max: dot + radius };
}

function getAxes(poly) {
    const axes = [];
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
        const len = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
        axes.push({ x: -edge.y / len, y: edge.x / len });
    }
    return axes;
}

function satPolygonPolygon(polyA, polyB) {
    let overlap = Infinity;
    let smallestAxis = null;
    const axes = [...getAxes(polyA), ...getAxes(polyB)];

    for (const axis of axes) {
        const p1 = projectPolygon(axis, polyA);
        const p2 = projectPolygon(axis, polyB);
        if (p1.max < p2.min || p2.max < p1.min) return null;
        const o = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (o < overlap) {
            overlap = o;
            smallestAxis = axis;
        }
    }

    const centerA = polyA.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const centerB = polyB.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const dirX = (centerB.x/polyB.length) - (centerA.x/polyA.length);
    const dirY = (centerB.y/polyB.length) - (centerA.y/polyA.length);

    if (dirX * smallestAxis.x + dirY * smallestAxis.y < 0) {
        smallestAxis.x = -smallestAxis.x;
        smallestAxis.y = -smallestAxis.y;
    }
    return { overlap, axis: smallestAxis };
}

function satPolygonCircle(poly, circleCenter, radius) {
    let overlap = Infinity;
    let smallestAxis = null;
    let axes = getAxes(poly);

    let minDistSq = Infinity;
    let closestVertex = null;
    for(const p of poly) {
        const dSq = (p.x - circleCenter.x)**2 + (p.y - circleCenter.y)**2;
        if(dSq < minDistSq) { minDistSq = dSq; closestVertex = p; }
    }
    const axisToCenter = { x: circleCenter.x - closestVertex.x, y: circleCenter.y - closestVertex.y };
    const len = Math.sqrt(axisToCenter.x**2 + axisToCenter.y**2);
    if (len > 1e-5) axes.push({ x: axisToCenter.x / len, y: axisToCenter.y / len });

    for (const axis of axes) {
        const p1 = projectPolygon(axis, poly);
        const p2 = projectCircle(axis, circleCenter, radius);
        if (p1.max < p2.min || p2.max < p1.min) return null;
        const o = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (o < overlap) { overlap = o; smallestAxis = axis; }
    }

    const centerA = poly.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const dirX = circleCenter.x - (centerA.x/poly.length);
    const dirY = circleCenter.y - (centerA.y/poly.length);

    if (dirX * smallestAxis.x + dirY * smallestAxis.y < 0) {
        smallestAxis.x = -smallestAxis.x;
        smallestAxis.y = -smallestAxis.y;
    }
    return { overlap, axis: smallestAxis };
}

function checkBoatCollisions(dt) {
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
                if (window.onRaceEvent && state.race.status === 'racing') {
                    window.onRaceEvent('collision_boat', { boat: b1, other: b2 });
                    window.onRaceEvent('collision_boat', { boat: b2, other: b1 });
                }

                const tx = res.axis.x * res.overlap * 0.5;
                const ty = res.axis.y * res.overlap * 0.5;
                b1.x -= tx; b1.y -= ty;
                b2.x += tx; b2.y += ty;

                // Physics Response: Angle dependent friction
                const nx = res.axis.x, ny = res.axis.y;

                // B1: Normal points AWAY from B1? No, B1->B2. So points AWAY from B1.
                // If B1 moves TOWARDS B2, dot(h1, n) > 0.
                const h1x = Math.sin(b1.heading), h1y = -Math.cos(b1.heading);
                const impact1 = Math.max(0, h1x * nx + h1y * ny);

                // B2: Normal points INTO B2. We want normal pointing AWAY from B2 for impact calc. So -n.
                const h2x = Math.sin(b2.heading), h2y = -Math.cos(b2.heading);
                const impact2 = Math.max(0, h2x * (-nx) + h2y * (-ny));

                const friction = 0.99;
                const impactFactor = 0.5; // Multiplier at max impact (0.5 means lose 50%)

                b1.speed *= (friction - (friction - impactFactor) * impact1);
                b2.speed *= (friction - (friction - impactFactor) * impact2);

                // No penalties if either boat is finished
                if (state.race.status === 'racing' && !b1.raceState.finished && !b2.raceState.finished) {
                    const res = getRightOfWay(b1, b2);
                    const rowBoat = res.boat;

                    // If mark-room is active, entitled boat effectively has immunity
                    // (outside boat must give room regardless of Section A ROW)
                    const effectiveRow = res.markRoom
                        ? (res.markRoom === b1.id ? b1 : b2)
                        : rowBoat;

                    // Sayings Check
                    let playerBoat = null;
                    let aiBoat = null;
                    if (b1.isPlayer) { playerBoat = b1; aiBoat = b2; }
                    else if (b2.isPlayer) { playerBoat = b2; aiBoat = b1; }

                    if (playerBoat && aiBoat) {
                        if (effectiveRow === playerBoat) {
                             if (!aiBoat.raceState.penalty) Sayings.queueQuote(aiBoat, "they_hit_player");
                        } else if (effectiveRow === aiBoat) {
                             if (!playerBoat.raceState.penalty) Sayings.queueQuote(aiBoat, "they_were_hit");
                        } else {
                             if (!aiBoat.raceState.penalty) Sayings.queueQuote(aiBoat, "they_hit_player");
                        }
                    }

                    const pInfo = { rule: res.rule, reason: res.reason, kind: 'contact' };
                    // RRS 15: a boat that has JUST acquired right of way owes the
                    // other boat room to keep clear, initially. Contact inside that
                    // window (2 s, and only when the acquisition was NOT caused by
                    // the other boat's own actions — the oracle encodes the
                    // exception) is the acquirer failing to give that room, so the
                    // penalty goes to HER, not to the boat that had no room to
                    // respond. Mark-room entitlement is untouched: room owed at a
                    // mark does not lapse because its ower is newly ROW.
                    const r15 = !res.markRoom && res.constraints
                        && res.constraints.indexOf("Rule 15") !== -1;
                    // RRS 43.1(a) + 19.2(b): if the boat this contact would
                    // penalize was, at the moment of contact, being denied room
                    // at an obstruction BY the right-of-way boat — the rule-19
                    // obligation ledger has held against that boat for the
                    // stand-on detector's own HOLD, and there is land hard on
                    // her far side right now — her breach was compelled. The
                    // foul is the denier's (19.2(b)); the pinned boat is
                    // exonerated. Same conservatism guards as the grounding
                    // path: a persistent obligation and real land, never bare
                    // geometry at the instant of contact.
                    let r19Flip = false;
                    const loser19 = (effectiveRow === b1) ? b2 : (effectiveRow === b2) ? b1 : null;
                    if (loser19 && !res.markRoom) {
                        const sin19 = loser19._r19Since && loser19._r19Since[effectiveRow.id];
                        const HOLD19 = (window.__RULES && window.__RULES.hold != null) ? window.__RULES.hold : 0.8;
                        if (sin19 != null && state.race.timer - sin19 >= HOLD19) {
                            const g19 = state.course.botGrid;
                            if (g19) {
                                const dxF = loser19.x - effectiveRow.x, dyF = loser19.y - effectiveRow.y;
                                const lF = Math.hypot(dxF, dyF) || 1;
                                const uxF = dxF / lF, uyF = dyF / lF;
                                for (let dF = 25; dF <= 75; dF += 25) {
                                    const cF = g19.cell(loser19.x + uxF * dF, loser19.y + uyF * dF);
                                    if (!g19.at(cF[0], cF[1])) { r19Flip = true; break; }
                                }
                            }
                        }
                    }
                    if (r19Flip) {
                        triggerPenalty(effectiveRow, { rule: 'Rule 19', reason: 'Denied Room at Obstruction', kind: 'contact' });
                    } else if (r15 && effectiveRow) {
                        triggerPenalty(effectiveRow, { rule: 'Rule 15', reason: 'No Room to Respond', kind: 'contact' });
                    } else if (effectiveRow === b1) triggerPenalty(b2, pInfo);
                    else if (effectiveRow === b2) triggerPenalty(b1, pInfo);
                    else {
                        triggerPenalty(b1, pInfo);
                        triggerPenalty(b2, pInfo);
                    }
                }
            }
        }
    }
}

function checkMarkCollisions(dt) {
    if (!state.course || !state.course.marks) return;

    // Reset collision flags for next frame's AI
    for (const boat of state.boats) {
        if (boat.ai) boat.ai.collisionData = null;
    }

    // A buoy is one 12-unit circle on its own point. A committee boat is a capsule of
    // three, offset outboard — so both the broad phase and the narrow phase read the
    // mark's own body instead of a constant. `bodyR` is 12 for a buoy, which makes the
    // broad-phase radius 50 exactly as it was.
    for (const boat of state.boats) {
        let close = false;
        for (const mark of state.course.marks) {
             const rr = 38 + (mark.bodyR || 12);
             if ((boat.x-mark.x)**2 + (boat.y-mark.y)**2 < rr*rr) { close = true; break; }
        }
        if (!close) continue;

        const poly = getHullPolygon(boat);
        for (const mark of state.course.marks) {
          for (const circ of (mark.body || [{ x: mark.x, y: mark.y, r: 12 }])) {
            const res = satPolygonCircle(poly, circ, circ.r);
            if (res) {
                if (window.onRaceEvent && state.race.status === 'racing') window.onRaceEvent('collision_mark', { boat });

                // Store Collision Data for AI
                if (boat.ai) {
                    boat.ai.collisionData = { type: 'mark', normal: res.axis };
                }

                // Direction: axis points from Poly to Circle
                // We want to move Poly away from Circle, so move opposite to axis
                boat.x -= res.axis.x * res.overlap;
                boat.y -= res.axis.y * res.overlap;

                // Physics
                const nx = res.axis.x, ny = res.axis.y;
                const hx = Math.sin(boat.heading), hy = -Math.cos(boat.heading);
                // Impact: Heading vs Normal (Boat -> Mark)
                const impact = Math.max(0, hx * nx + hy * ny);

                const friction = 0.99;
                let impactFactor = 0.5;
                if (boat.controller && boat.controller.livenessState === 'force') impactFactor = 0.9; // Slide off marks

                boat.speed *= (friction - (friction - impactFactor) * impact);

                // RRS 43.1(b): a boat sailing within MARK-ROOM she is entitled
                // to is exonerated for breaking rule 31 in an incident with the
                // boat required to give that room. The entitlement is the rules
                // engine's own zone snapshot for THIS mark; the incident is that
                // ower close aboard (2 hull lengths) on her outside at the
                // moment of the touch. A lone boat hitting the buoy is still
                // her own foul — exoneration needs the squeeze.
                let exon31 = false;
                if (state.race.status === 'racing' && window.Rules && window.Rules.interactions) {
                    const mIdx31 = state.course.marks.indexOf(mark);
                    const dSelf31 = Math.hypot(boat.x - mark.x, boat.y - mark.y);
                    for (const o31 of state.boats) {
                        if (o31 === boat || o31.raceState.finished) continue;
                        const dxM = o31.x - boat.x, dyM = o31.y - boat.y;
                        if (dxM * dxM + dyM * dyM > 110 * 110) continue;
                        const k31 = [boat.id, o31.id].sort((a, b) => a - b).join('-');
                        const dat31 = window.Rules.interactions[k31];
                        const snap31 = dat31 && dat31.zoneSnapshot;
                        if (!snap31 || snap31.markIndex !== mIdx31 || snap31.entitled !== boat.id) continue;
                        if (Math.hypot(o31.x - mark.x, o31.y - mark.y) <= dSelf31) continue;
                        exon31 = true; break;
                    }
                }
                if (state.race.status === 'racing' && !exon31) triggerPenalty(boat, { rule: 'Rule 31', reason: 'Touched a Mark', kind: 'contact' });
                // One response per MARK, not per circle: hitting a committee boat is
                // one Rule 31 touch, however many circles of its capsule you are in.
                break;
            }
          }
        }
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
            if (dist < ai.playerProximity.minD) {
                ai.playerProximity.minD = dist;
            }
            ai.playerProximity.close = true;
        } else {
            if (ai.playerProximity.close) {
                if (ai.playerProximity.minD < 60 && ai.playerProximity.minD > 20) {
                     if (!player.raceState.penalty && !ai.raceState.penalty) {
                         const res = getRightOfWay(player, ai);
                         if (res.boat === player) {
                             Sayings.queueQuote(ai, "narrowly_avoided_collision");
                         } else {
                             Sayings.queueQuote(ai, "player_narrowly_avoided_collision");
                         }
                     }
                }
            }
            ai.playerProximity.close = false;
            ai.playerProximity.minD = Infinity;
        }
    }
}

// The world clock runs slow on purpose: `state.time` phases animation (floe heading
// curl, wave sets, flag flutter, telltales) and 0.24 is what those were tuned
// against. Anything that wants SECONDS must scale by this, never read it raw —
// see refreshBotGrid for what reading it raw cost.
const FOUL_NEED_GAP = 60;

// Boat hull half-width for coarse collision against concave mask coastlines.
// How far out a rounding still counts, as a multiple of the mark's zone. The zone is
// the pass-within distance; this is the go-round-it distance. Generous enough that a
// wide, seamanlike rounding registers, bounded so circling far away does not.
const ROUND_ACTIVE = 2.5;
// HOW MUCH BANKED SWEEP SHE MAY GIVE BACK AND STILL BE ROUND. The latch exists to
// survive the unwind of fighting out through the ring, which measures 0.19-0.40 rad; it
// is NOT a licence to sail back round the other way. At half a turn's grace,
// `_string_truth_probe` caught arctic boats completing after giving back 0.52-1.10 rad,
// with the winding of their own track saying flatly that the string never wrapped the
// mark (actual -0.03 against a required 6.25). Half a radian covers the measured unwind
// with margin and nothing else. Scan, 6 arctic seeds, roundings whose string never
// touched the mark: half a turn 9%, 0.75 rad 6%, 0.5 rad 4%.
const ROUND_GIVEBACK = 0.5;

// THERE IS NO TOLERANCE IN THE RULE. RRS Sail the Course: the taut string "touches
// each mark designated in the sailing instructions to be a rounding mark". A track
// that sweeps less than the geometric requirement does not bend around the mark, so
// the string does not touch it, so it is not a rounding — at any distance. This was
// 0.75, which completed a rounding at three-quarters of the requirement (bay's
// hairpin: 137 degrees banked against 183 needed) and, because the AI's own exit
// logic reads the same constant, AIMED the fleet at three-quarters of a rounding.
// Note the rule has no PROXIMITY requirement either: a full rounding at a distance
// is legal, merely slow, which is why the test above the completion check pins a
// wide full rounding as valid. Keep this at 1.
const ROUND_SWEEP_TOL = 1.0;
// How close is "arrived at the mark", as a multiple of its own zone. Two: outside the
// rules zone, well inside the approach, and it scales with the mark rather than being a
// second tuned distance.
const ROUND_NEAR = 2.0;
// Slack on the exit bearing, on top of the tangent angle the geometry already allows.
// A sixth of a radian — a helm's width, not a discount.
const ROUND_EXIT_SLACK = 0.17;

// CLEARANCE radius, not the collider. The boat is 30 wide and 55 long, so 30 is roughly its
// half-LENGTH — the room it needs to turn in, which is the right question for "does this gap
// admit a boat" and the wrong one for "did I touch that berg". Collision uses the hull
// itself (getHullPolygon, HULL_DISCS); sailcheck.js keeps its own copy of this number for
// the same planning purpose and should stay conservative.
const HULL_R = 30;

// Circle vs (possibly concave, possibly keyholed) polygon. Returns the same
// {axis, overlap} shape satPolygonPolygon does, so the caller is unchanged.
// Handles the boat being INSIDE the shape too, which happens if it is pushed
// through by another boat — it escapes via the nearest edge rather than sticking.
function circlePolyCollide(cx, cy, r, verts) {
    let bestD2 = Infinity, bx = 0, by = 0;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const ax = verts[j].x, ay = verts[j].y, bx2 = verts[i].x, by2 = verts[i].y;
        const ex = bx2 - ax, ey = by2 - ay;
        const len2 = ex * ex + ey * ey || 1;
        let t = ((cx - ax) * ex + (cy - ay) * ey) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + ex * t, py = ay + ey * t;
        const d2 = (cx - px) ** 2 + (cy - py) ** 2;
        if (d2 < bestD2) { bestD2 = d2; bx = px; by = py; }
    }
    const inside = pointInPoly(cx, cy, verts);
    const d = Math.sqrt(bestD2);
    if (!inside && d >= r) return null;
    // axis points from the surface toward the boat; caller subtracts it.
    let nx = (cx - bx) / (d || 1), ny = (cy - by) / (d || 1);
    if (inside) { nx = -nx; ny = -ny; }
    return { axis: { x: -nx, y: -ny }, overlap: inside ? d + r : r - d };
}

// ── THE HULL AGAINST CONCAVE LAND ───────────────────────────────────────────
// Land traced from a mask is concave and keyholed, and SAT is a convex test, so this path
// used ONE circle of radius HULL_R = 30 about the boat's centre instead. The hull is 30 wide
// and 55 long — half-beam 15 — so that circle was TWICE the boat's actual beam. You could be
// most of a boat-width clear of a berg abeam and still ground on it, which is what "I
// collided with an island when I hadn't actually hit it" is.
//
// A chain of discs down the centreline instead, each sized to the hull's real half-width
// there, so the collider tapers into the bow the way the boat does. Still exact against
// concave outlines (each disc is a circle-vs-polygon test, the primitive that was already
// right), still cheap, and it no longer claims beam the boat does not have.
//
// Offsets are read off getHullPolygon: x = ±15 between y = -5 and y = +20, tapering to a
// point at the bow (y = -25) and to ±12 at the transom (y = +30).
const HULL_DISCS = [
    { y: -20, r: 4.5 }, { y: -12, r: 10 }, { y: -3, r: 15 },
    { y:   8, r: 15 }, { y:  19, r: 15 }, { y: 27, r: 12 }
];
function hullPolyCollide(boat, verts) {
    const cos = Math.cos(boat.heading), sin = Math.sin(boat.heading);
    let worst = null;
    for (const d of HULL_DISCS) {
        // Local (0, d.y) rotated into the world — the discs sit on the centreline.
        const wx = boat.x - d.y * sin, wy = boat.y + d.y * cos;
        const hit = circlePolyCollide(wx, wy, d.r, verts);
        // Deepest wins, so the push-out clears the worst-embedded part of the hull rather
        // than whichever disc happened to be tested last.
        if (hit && (!worst || hit.overlap > worst.overlap)) worst = hit;
    }
    return worst;
}

// ── A HULL THAT PUSHES ───────────────────────────────────────────────────────────────
// The ship stops a boat, and a boat caught ahead of the bow is carried along.
//
// THIS IS PHYSICS, NOT ROUTING, and that distinction is what makes it buildable. The vessel
// never enters state.course.islands, never becomes a hidden collider, never touches the nav
// grid. Contact is resolved right here against the fleet, the same frame the hull moved.
//
// THE SHAPE IS A CAPSULE, because the manifest already worked out why a circle cannot do
// this job: "the hidden collider compile emits is a CIRCLE, and these hulls are 4.3:1.
// Sized to the beam it leaves two thirds of the ship sailable-through; sized to the length
// it is an invisible wall standing 100+ units off both sides in open water." A spine
// segment with a radius is the shape that fits, rotates with the heading for free, and
// hands back the push normal as the perpendicular from the spine.
const TRAFFIC_PUSH_RATE = 260;      // units/sec of positional correction — see the cap below
const TRAFFIC_GRIND = 0.55;         // speed kept after being struck

function checkTrafficCollisions(dt) {
    const fleet = state.traffic;
    if (!fleet || !fleet.length) return;
    for (const v of fleet) {
        if (!v.active) continue;
        // Spine: the hull's centreline minus a beam's worth at each end, so the capsule's
        // round caps land at the stem and the transom instead of standing off them.
        const r = v.hullBeam * 0.5;
        const half = Math.max(1, v.hullLen * 0.5 - r);
        const fx = Math.sin(v.heading), fy = -Math.cos(v.heading);
        const ax = v.x - fx * half, ay = v.y - fy * half;
        const reach = v.hullLen * 0.5 + 60;
        // The ship's own velocity, in units per FRAME, matching everything else here.
        const svx = fx * v.speed / 60, svy = fy * v.speed / 60;

        for (const boat of state.boats) {
            if (boat.raceState.finished && boat.fadeTimer <= 0) continue;
            const bdx = boat.x - v.x, bdy = boat.y - v.y;
            if (bdx * bdx + bdy * bdy > (reach + 60) ** 2) continue;

            // ⚠️ THE NORMAL COMES FROM THE BOAT'S CENTRE, NOT FROM ITS NEAREST CORNER.
            // Cornerwise looks more precise and oscillates: a hull straddling the
            // centreline has corners on BOTH sides, the nearest one flips the moment the
            // boat is nudged, and the push reverses every frame. Measured before the fix —
            // a boat amidships bounced +4.33u, -4.33u, +4.33u forever and never came out.
            // The centre moves monotonically outward, so the direction it picks is stable.
            const poly = getHullPolygon(boat);
            const wx = boat.x - ax, wy = boat.y - ay;
            const t = Math.max(0, Math.min(1, (wx * fx + wy * fy) / (2 * half))) * 2 * half;
            const cx = ax + fx * t, cy = ay + fy * t;
            let bnx = boat.x - cx, bny = boat.y - cy;
            let dc = Math.hypot(bnx, bny);
            if (dc < 1e-3) {
                // Dead on the spine, where "outward" is undefined. Any consistent side
                // resolves; prefer whichever way the boat is already sliding.
                const lat = boat.velocity.x * -fy + boat.velocity.y * fx;
                const sgn = lat >= 0 ? 1 : -1;
                bnx = -fy * sgn; bny = fx * sgn; dc = 0;
            } else { bnx /= dc; bny /= dc; }

            // How far the hull itself reaches along that normal — the convex support
            // function, exact and cheap. Without it the boat's CENTRE would have to clear
            // the capsule, so half a hull would be buried in the ship's side.
            let reachB = 0;
            for (const p of poly) {
                const e = (p.x - boat.x) * bnx + (p.y - boat.y) * bny;
                if (e > reachB) reachB = e;
            }
            const overlap = (r + reachB) - dc;
            if (overlap <= 0) continue;
            // CAPPED, exactly as the floe pass caps its own: "no floe is ever moved faster
            // than it can be seen to move". A boat overtaken by a bow at four knots can be
            // deeply inside the capsule in one frame, and teleporting it clear would read
            // worse than the overlap does. A rate rather than a per-frame constant, so it
            // looks the same at 30fps as at 144.
            const corr = Math.min(overlap, Math.max(2, TRAFFIC_PUSH_RATE * dt));
            // The ship is effectively infinite mass, so the boat takes the whole correction.
            boat.x += bnx * corr;
            boat.y += bny * corr;

            // Kill the component sailing INTO the hull, then add the ship's own motion along
            // the normal. "Pushed if in front" needs no special case: a boat under the bow is
            // simply carried at ship speed for as long as it stays in contact.
            const vn = boat.velocity.x * bnx + boat.velocity.y * bny;
            if (vn < 0) { boat.velocity.x -= vn * bnx; boat.velocity.y -= vn * bny; }
            const sn = svx * bnx + svy * bny;
            if (sn > 0) { boat.x += bnx * sn * dt * 60; boat.y += bny * sn * dt * 60; }

            boat.speed *= TRAFFIC_GRIND;

            // NOTHING IS TOLD ABOUT THIS. No collisionData, so the planner is untouched —
            // bots cannot see the vessel and will sail into it, which is accepted (a moving
            // caster is planner work, and the planner is being changed elsewhere). It is
            // survivable precisely BECAUSE it pushes: a static wall would trap a fleet that
            // does not know to avoid it, while a body that shoves and moves on cannot.
            if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
                window.onRaceEvent('collision_traffic', { boat, id: v.id });
            }
        }
    }
}

// ⭐ THE RULE 19 OBLIGATION LEDGER (2026-08-13, the penalty-conservatism ruling).
//
// The Rule 19 foul below fires the instant a boat touches land, against any
// overlapped boat sitting outboard of her. It is purely geometric and purely
// INSTANTANEOUS: nothing requires the obligation to have existed long enough for
// the accused to act on it. The stand-on forced-avoidance detector (~890) already
// requires exactly that — a leaky accumulator that must reach HOLD before it will
// claim — because a boat that has just become obligated is owed room to respond
// (RRS 15). This gives the Rule 19 path the same requirement, using the same
// constant, and nothing else.
//
// The ledger is the pre-contact record the trigger cannot build for itself: the
// trigger only runs while a hull is already inside a rock, so by then the history
// is gone. Stamped every frame, for close pairs only (the island scan runs only
// for a boat that has another boat within 130u, so a 2218-island venue costs
// nothing on the frames where no pair is close).
function updateRule19Ledger() {
    if (!state.course || !state.course.islands || state.race.status !== 'racing') return;
    const now = state.race.timer;
    const B = state.boats;
    for (const b of B) {
        if (b.raceState.finished) continue;
        let anyClose = false;
        for (const o of B) {
            if (o === b || o.raceState.finished) continue;
            const dx = o.x - b.x, dy = o.y - b.y;
            if (dx * dx + dy * dy < 130 * 130) { anyClose = true; break; }
        }
        if (!anyClose) { if (b._r19Since) b._r19Since = null; continue; }
        // nearest island by EDGE gap — the one she would ground on
        let isl = null, best = 1e18;
        for (const I of state.course.islands) {
            if (I.awash) continue;
            const dx = b.x - I.x, dy = b.y - I.y;
            const d2 = dx * dx + dy * dy;
            const lim = I.radius + 120;
            if (d2 > lim * lim) continue;
            if (d2 < best) { best = d2; isl = I; }
        }
        if (!isl) { if (b._r19Since) b._r19Since = null; continue; }
        const bx = b.x - isl.x, by = b.y - isl.y;
        const bl = Math.max(1, Math.sqrt(bx * bx + by * by));
        const ax = bx / bl, ay = by / bl;
        const led = b._r19Since || (b._r19Since = {});
        for (const o of B) {
            if (o === b || o.raceState.finished) continue;
            const dx = o.x - b.x, dy = o.y - b.y;
            if (dx * dx + dy * dy > 130 * 130) { delete led[o.id]; continue; }
            // Hysteresis on the outside test (RRS 43 wiring): an entry is
            // CREATED only when the other boat sits clearly outside (45u along
            // the escape axis), but once held it survives the gap COLLAPSING —
            // the collapse is the squeeze itself, and the contact umpire reads
            // this ledger at the moment the hulls meet, when the along-axis
            // distance is hull-to-hull. Without this the obligation record
            // deletes itself one frame before the only event that needs it.
            if (dx * ax + dy * ay < (led[o.id] != null ? 10 : 45)) { delete led[o.id]; continue; }
            if (!(window.Rules && window.Rules.isOverlapped && window.Rules.isOverlapped(b, o))) { delete led[o.id]; continue; }
            if (led[o.id] == null) led[o.id] = now;
        }
    }
}

function checkIslandCollisions(dt) {
    if (!state.course || !state.course.islands) return;
    updateRule19Ledger();

    for (const boat of state.boats) {
        if (boat.raceState.finished && boat.fadeTimer <= 0) continue;

        // Optimization: Broad phase
        let potential = false;
        for (const isl of state.course.islands) {
            if (isl.awash) continue;
            const dx = boat.x - isl.x;
            const dy = boat.y - isl.y;
            if (dx*dx + dy*dy < (isl.radius + 50)**2) { potential = true; break; }
        }
        if (!potential) continue;

        const boatPoly = getHullPolygon(boat);

        for (const isl of state.course.islands) {
            // AWASH SHAPES ARE NOT COLLIDERS. A shoal is under the boat, not in front of
            // it — shoving a hull sideways out of water it is floating over would be a
            // shove with nothing to push against, and it would fire `collision_island` at
            // the eval harness for a contact that never happened. The bar's whole cost is
            // the drag in the speed model (shoalFieldAt); there is nothing to bounce off.
            if (isl.awash) continue;
            const dx = boat.x - isl.x;
            const dy = boat.y - isl.y;
            if (dx*dx + dy*dy > (isl.radius + 50)**2) continue;

            // Mask landmasses are concave and keyholed, and SAT is a CONVEX test —
            // run against them it collides with their convex hull, which spans
            // most of the map and reads as invisible walls all over open water.
            // Circle-vs-polygon instead: exact for concave shapes, and cheap.
            const res = isl.fromMask
                ? hullPolyCollide(boat, isl.vertices)
                : satPolygonPolygon(boatPoly, isl.vertices);
            if (res) {
                 // Push boat OUT
                 boat.x -= res.axis.x * res.overlap;
                 boat.y -= res.axis.y * res.overlap;

                 // Grounding Penalty: Lose 60% speed instantly + massive drag
                 boat.speed *= 0.4;

                 // Tell the AI it is ON the ice, exactly as mark contact does. Without
                 // this the avoidance cost function sees every candidate blocked (the
                 // hull is inside the collider), falls back to least-deviation, and
                 // holds course INTO the floe — measured 16-second grinds at 120
                 // contacts/second on Glacier Sound.
                 if (boat.ai) boat.ai.collisionData = { type: 'island', normal: res.axis, isFloe: !!isl.isFloe };

                 // Groundings are the Arctic's real cost driver — surface them
                 // so the eval harness can measure ice avoidance directly
                 // instead of inferring it from race time.
                 if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
                     window.onRaceEvent('collision_island', { boat, isFloe: !!isl.isFloe });
                 }

                 // RRS 19 (Room at an Obstruction): if an overlapped boat sat
                 // OUTSIDE us (between us and open water) while we hit the
                 // land, she denied us room — the foul is hers, not ours.
                 let squeezer = null;
                 if (state.race.status === 'racing' && window.Rules && window.Rules.isOverlapped) {
                     const bx = boat.x - isl.x, by = boat.y - isl.y;
                     const bl = Math.max(1, Math.sqrt(bx * bx + by * by));
                     const ax = bx / bl, ay = by / bl; // escape direction: island -> boat
                     // ── THE TWO GUARDS (2026-08-13, landed 2026-08-14) ──────
                     // OWNER: "penalties are sometimes erroneously assigned when
                     // collisions don't happen... we should be conservative here."
                     // 90% of no-contact fouls come from this line, on an
                     // obligation held a median of 0.00 s. Neither test below
                     // invents a number: HOLD is the stand-on detector's own
                     // constant, and room can only be given by a boat that has
                     // some. (A third guard — "the claim direction must have
                     // water in it" — was drafted but never wired in; every
                     // bench measured these two, so only these two land.)
                     const R19HOLD = (typeof window !== 'undefined' && window.__RULES && window.__RULES.hold != null)
                         ? window.__RULES.hold : 0.8;
                     const gR19 = state.course.botGrid;
                     const freeRun19 = (x, y, dxu, dyu, cap) => {
                         if (!gR19) return cap;
                         for (let d = 25; d <= cap; d += 25) {
                             const c = gR19.cell(x + dxu * d, y + dyu * d);
                             if (!gR19.at(c[0], c[1])) return d;
                         }
                         return cap;
                     };
                     for (const o of state.boats) {
                         if (o === boat || o.raceState.finished) continue;
                         const dx2 = o.x - boat.x, dy2 = o.y - boat.y;
                         // Tight attribution: blame only a boat close aboard
                         // (~2.5 lengths) sitting clearly on our open-water
                         // side — generous ranges over-penalized polar packs
                         // that were all legitimately dodging the same floe.
                         if (dx2 * dx2 + dy2 * dy2 > 130 * 130) continue;
                         if (dx2 * ax + dy2 * ay < 45) continue;        // not clearly outside us
                         if (!window.Rules.isOverlapped(boat, o)) continue;
                         // GUARD 1 (persistence, RRS 15): the obligation must have
                         // existed long enough for her to act on it. One frame of
                         // overlap at the instant of a grounding is not a foul.
                         const since = boat._r19Since && boat._r19Since[o.id];
                         if (since == null || state.race.timer - since < R19HOLD) continue;
                         // GUARD 2 (she had room to give): a boat pinned against
                         // land herself, or with a third boat outboard of her,
                         // cannot make room and is not the cause.
                         if (freeRun19(o.x, o.y, ax, ay, 100) < 100) continue;
                         let pinned = false;
                         for (const p of state.boats) {
                             if (p === o || p === boat || p.raceState.finished) continue;
                             const px = p.x - o.x, py = p.y - o.y;
                             if (px * px + py * py > 130 * 130) continue;
                             if (px * ax + py * ay >= 45) { pinned = true; break; }
                         }
                         if (pinned) continue;
                         squeezer = o;
                         break;
                     }
                 }
                 if (squeezer) {
                     triggerPenalty(squeezer, { rule: 'Rule 19', reason: 'Denied Room at Obstruction', kind: 'no-contact' });
                 }

                 // ── NO PENALTY FOR RUNNING AGROUND ──────────────────────────
                 // Land is not a mark. RRS 31 is "touching a mark", and the rest of Part 2
                 // is boat-on-boat — there is no rule against hitting an island, because
                 // the rocks already administer the punishment. Grounding cost a 360° turn
                 // here, which was both wrong as a rule and wrong as a game: the boat has
                 // already lost 60% of its speed, and the spin was a second, larger, purely
                 // invented penalty on top.
                 //
                 // What SURVIVES is Rule 19 above: if another boat denied you room at the
                 // obstruction, that is a real foul and it is HERS. That is the only
                 // penalty land can produce, and it is still assessed against the squeezer.
                 // (The measurement event already fired above, once, with its isFloe tag —
                 // this used to fire a second copy and every grounding counted double.)
            }
        }
    }
}

// Per-style palettes: tropical (default), grass (swamp/river banks), ice (polar floes)
