// regatta/js/sim/physics.js — boat physics and race scoring: rig/heel/
// overpowered model, J/111 polars, target speed and VMG, steerage, penalties,
// updateBoat (the integrator), hullCrossedLine, updateBoatRaceState (leg
// walker/rounding/gates — the 'Rule 31' comment inside is asserted on by
// eval/test_contact.js), and fleet progress/rank. Classic script; global scope.
// Extracted verbatim from script.js (refactor 2026-08-24).
// upwind is ~45 degrees, but the boat's own speed drags the apparent forward to ~25.
const AWA_CLOSE_HAULED = 25 * Math.PI / 180;
// Where a kite pays, in APPARENT. A boat carries a spinnaker by what the rig feels, which
// is why a fast boat holds one deeper than a slow one.
//
// TWO thresholds, not one, because the hoist takes FIVE SECONDS (`switchSpeed = dt / 5.0`)
// and halfway through it `jibFactor` and `spinFactor` are BOTH zero — a boat mid-hoist is
// carrying no sail at all. With a single threshold the decision chatters across it and the
// boat parks in that hole: measured 49% of beam-reach and 45% of running frames mid-hoist,
// costing a full 1.7 knots on the run. (The single-threshold TWA rule this replaces was
// already doing it at 38%/29% — the hysteresis is a fix for a defect that predates the
// apparent-wind move, which merely made it louder.)
//
// It is also just what a crew does. You hoist when it will clearly draw and you carry it
// through a brief luff rather than dousing and re-hoisting every few seconds.
// What a sail change costs at its worst, halfway through: both sails up, neither trimmed.
const SAIL_CHANGE_COST = 0.08;
const AWA_KITE_SET = 100 * Math.PI / 180;    // hoist once the apparent is this far aft
const AWA_KITE_DOUSE = 82 * Math.PI / 180;   // ...and do not douse until it comes this far forward

const OVERPOWERED = {
    threshold: 18,          // kt of TRUE wind the calibration is anchored at (see refMoment)
    // AWS^2 * sin(AWA) for a beam reach in `threshold` knots: a boat making 8 kt at TWA 90
    // sees AWS 19.7 at AWA 66, so 19.7^2 * sin(66) = 355. Pressure is reported relative to
    // this, so heel == 1.0 means "as pressed as a beam reach in 18 knots".
    refMoment: 355,
    heelThreshold: 1.0,     // nothing is charged below this
    // ...and this much speed per unit of pressure above it. Calibrated so a BEAM REACH —
    // where heel peaks — pays about the 21% the old flat rule charged at 25 kt true. That
    // keeps phase 1 a change of SHAPE and not of size: what moves is that the beat pays
    // less than the reach and the run pays nothing at all, which the old rule could not
    // express because it never looked at the angle.
    costPerHeel: 0.45,
    heavyAirRelief: 0.08,
    maxCost: 0.25,
    lagSeconds: 1.5         // heel is STATE. The lag is what makes it a situation you sail
                            // out of rather than a multiplier you look up.
};

// Keyed on the wind the BOAT measures — local, so a puff overpowers you and the lull after it
// does not, and reduced by dirty air because sitting in someone's bad air is less wind, not
// more. A boat with a high `pressure` stat feels gusts harder and so is exposed to this
// sooner: that is the trade for extracting more from them, and `heavyAir` is what buys it
// back.
// ── HEELING PRESSURE ────────────────────────────────────────────────────────────
// How hard the rig is being pressed, as a multiple of "as much as this boat wants".
//
//     heeling moment  ~  AWS^2 * sin(AWA)
//
// Sail force goes as the SQUARE of apparent wind speed; the athwartships component of it
// goes as the SINE of apparent wind angle. Those two terms produce the entire behaviour
// with no special cases anywhere:
//
//   close-hauled   AWS high (boat speed adds), AWA ~30    ->  pressed
//   beam reach     AWS highest, AWA ~75-90               ->  MOST pressed
//   broad / run    AWS low (boat speed SUBTRACTS), AWA ~150 -> barely pressed at all
//
// which is why bearing away in a blow is a real escape and not just a smaller penalty: it
// cuts both terms at once. It is also why the polar above is allowed to keep climbing
// downwind in 30 knots — a boat that deep is not overpowered, she is planing.
//
// Returns 1.0 at exactly the pressure a beam reach generates in OVERPOWERED.threshold
// knots of true wind, which is where the old flat rule started charging.
function heelPressure(aws, awa) {
    return (aws * aws * Math.sin(Math.abs(awa))) / OVERPOWERED.refMoment;
}

// The speed cost of being pressed. Replaces a flat tax on TRUE WIND SPEED that took no
// angle at all — under it a boat running dead downwind in 25 kt paid exactly what a boat
// beating in 25 kt paid, so the point of sail that should be FASTEST was penalised as hard
// as the one that should be slowest. Combined with the polar flatlining at 20 kt, 25 knots
// downwind came out strictly slower than 20.
//
// Magnitude is deliberately unchanged: a beam reach in 25 kt still pays about the 21% the
// old rule charged. The SHAPE moves, the SIZE does not — the beat pays less, the run pays
// nothing, and the total is calibrated at the same point it always was.
function overpoweredFactor(stats, heel) {
    // heavyAir, not handling — one stat owns wind strength. A heavy-air specialist carries
    // more pressure before it costs anything, which is the same trade the old rule made.
    const cope = Math.max(0.3, 1 - (stats.heavyAir || 0) * OVERPOWERED.heavyAirRelief);
    const over = heel - OVERPOWERED.heelThreshold;
    if (over <= 0) return 1.0;
    return 1 - Math.min(OVERPOWERED.maxCost, over * OVERPOWERED.costPerHeel * cope);
}



// Local water current. Uniform everywhere except the river, where it runs
// along the course axis — strongest midstream, dying (and slightly reversing
// as a counter-eddy) at the banks. Classic river tactics: ride the middle
// when it helps, hug the bank when it hurts.
// The AMBIENT current: a river venue's spatial field, or the uniform drift the player
// set. Split out so authored regions can add to whichever it is instead of replacing it.
// Does this venue have a current of its OWN — one that varies from place to place and is
// not the uniform drift the player dialled in? Two things can supply it: the river
// generator's analytic field, and AUTHORED current regions.
//
// Every readout used to ask the river's own current directly, which was the same
// question only while the river was the only venue with a stream. The moment a venue
// authors one, that test says no: the water tile shows the static blurb, the streamline
// particles never spawn, and the current knob offers to override a field it cannot see —
// all while the flow is pushing the fleet around.
const J111_POLARS = {
    angles: [0, 30, 38, 45, 52, 60, 75, 90, 110, 120, 135, 150, 180],
    speeds: {
        6: {
            spinnaker: [0.0, 0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.46, 5.5, 5.48, 5.25, 4.72, 4.01],
            nonSpinnaker: [0.0, 0.0, 4.7, 4.93, 5.18, 5.29, 5.36, 5.46, 4.94, 4.65, 4.08, 3.51, 3.01]
        },
        8: {
            spinnaker: [0.0, 0.0, 0.6, 1.2, 1.8, 2.4, 3.5, 6.79, 6.87, 6.85, 6.58, 5.94, 5.06],
            nonSpinnaker: [0.0, 0.0, 5.8, 6.09, 6.41, 6.55, 6.65, 6.79, 6.17, 5.82, 5.12, 4.42, 3.8]
        },
        10: {
            spinnaker: [0.0, 0.0, 0.7, 1.4, 2.1, 2.8, 4.0, 7.89, 8.01, 8.01, 7.72, 6.99, 6.0],
            nonSpinnaker: [0.0, 0.0, 6.66, 7.0, 7.38, 7.56, 7.7, 7.89, 7.2, 6.8, 6.0, 5.2, 4.5]
        },
        12: {
            spinnaker: [0.0, 0.0, 0.8, 1.6, 2.4, 3.2, 4.5, 8.6, 8.74, 8.75, 8.44, 7.65, 6.58],
            nonSpinnaker: [0.0, 0.0, 7.23, 7.6, 8.02, 8.22, 8.38, 8.6, 7.85, 7.42, 6.56, 5.69, 4.93]
        },
        14: {
            spinnaker: [0.0, 0.0, 0.9, 1.8, 2.7, 3.6, 5.0, 9.01, 9.18, 9.2, 8.89, 8.08, 6.98],
            nonSpinnaker: [0.0, 0.0, 7.52, 7.91, 8.36, 8.57, 8.76, 9.01, 8.25, 7.81, 6.91, 6.01, 5.23]
        },
        16: {
            spinnaker: [0.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.5, 9.42, 9.66, 9.7, 9.42, 8.59, 7.47],
            nonSpinnaker: [0.0, 0.0, 7.76, 8.18, 8.66, 8.9, 9.13, 9.42, 8.68, 8.24, 7.32, 6.39, 5.61]
        },
        20: {
            spinnaker: [0.0, 0.0, 1.2, 2.4, 3.6, 4.8, 6.5, 10.43, 10.87, 11.01, 10.81, 9.98, 8.88],
            nonSpinnaker: [0.0, 0.0, 8.2, 8.7, 9.26, 9.6, 9.98, 10.43, 9.77, 9.35, 8.4, 7.42, 6.66]
        },
        // ── ABOVE 20 KNOTS: EXTRAPOLATED, and it has to be ──────────────────────────
        // Rows 6-20 are ORC VPP data, and 6/8/10/12/14/16/20 is not a coincidence — it is
        // exactly the wind set the ORC VPP solves for. ORC publishes NOTHING above 20 kt:
        // its own rule says that when the scoring wind exceeds 20 knots the 20-knot time
        // allowances are used, and implied wind is "not extrapolated beyond the range of
        // calculations of the ORC VPP".
        //
        // That rule is a RATING-FAIRNESS convention, not a claim about boats — and the game
        // had inherited it as physics (`if (windSpeed >= 20) { lower = 20; upper = 20 }`),
        // which made 25 knots downwind no faster than 20 and, once overpowered took its cut,
        // strictly slower. So these two rows are built rather than cited.
        //
        // The shape comes from the measured rows: from 16 to 20 kt the boat gains 5.7% at
        // 38 degrees, 10.7% at 90 and 18.7% at 180 — upwind is ALREADY SATURATING while
        // downwind is still accelerating hard. Both trends simply continue:
        //   20 -> 25 kt   +2% upwind, +10% at 90, +18-20% deep
        //   25 -> 30 kt    0% upwind,  +8% at 90, +17-18% deep
        // Upwind flattening IS being overpowered: the rig is depowered and the bow is in
        // the waves, so more wind buys nothing. Downwind DOES NOT TAPER, and that is the
        // point — past 17-18 kt the boat is planing, and a planing hull keeps taking what
        // the breeze offers instead of settling at a wave-making limit.
        //
        // ⚠️ Do not "correct" these toward the ORC curve's flattening. ORC's VPP is a
        // RATING predictor and is conservative about planing: it puts a J/111 at 8.75 kt in
        // 12 kt of breeze at 120 degrees, while a J/111 on the water planes at 12-13 kt in
        // that same 12 knots. The game's planing multiplier already carries part of that
        // gap; these rows carry the rest. Sanity check at the top end: 25 kt at 120 degrees
        // is 12.99 kt of polar, about 15.6 with the planing bonus — and real J/111s are
        // documented in the high teens with peaks past 20 (one clocked at 20.2).
        //
        // Sources: ORC VPP documentation (the 6-20 kt solve set and the 20 kt scoring cap);
        // North Sails J/111 Worlds speed guide (planes at 17-18 kt TWS, crossover ~17 kt,
        // jib carried above 25 kt, A2 to 24-28 kt); blur.se J/111 Piranha test (12-13 kt
        // planing in 12 kt of breeze; other boats "close to, or top, 20 knots").
        25: {
            spinnaker: [0.0, 0.0, 1.22, 2.46, 3.71, 4.97, 6.89, 11.47, 12.61, 12.99, 12.86, 11.98, 10.57],
            nonSpinnaker: [0.0, 0.0, 8.36, 8.92, 9.54, 9.94, 10.58, 11.47, 11.33, 11.03, 10.0, 8.9, 7.93]
        },
        30: {
            spinnaker: [0.0, 0.0, 1.22, 2.47, 3.75, 5.04, 7.17, 12.39, 14.38, 15.07, 15.05, 14.14, 12.37],
            nonSpinnaker: [0.0, 0.0, 8.36, 8.96, 9.64, 10.09, 11.0, 12.39, 12.92, 12.79, 11.7, 10.5, 9.28]
        }
    }
};

// Planing Configuration
const J111_PLANING = {
    // Conditions
    minTWA: 100 * Math.PI / 180,
    maxTWA: 170 * Math.PI / 180, // Drop off if dead downwind (unstable)
    minTWS: 12.0, // Needs decent breeze
    entrySpeed: 8.5, // Knots
    exitSpeed: 7.5, // Hysteresis
    entryTime: 1.5, // Seconds to trigger (prevent blips)
    exitTime: 1.0,  // Seconds to lose it

    // Physics Modifiers
    speedMultiplier: 1.20, // 20% boost when planing (so 11kn -> 13.2kn)
    accelBoost: 1.5, // Surging acceleration
    turnDrag: 0.990, // Higher drag in turns while planing (loss of plane)
    turnRateScale: 0.7, // Stiffer steering at high speed

    // Visuals
    wakeLengthScale: 2.0,
    wakeWidthScale: 1.5
};

// DRAG BREAKS THE PLANE (Wes, Sep 28 2026). A planing hull that runs onto a bar, into kelp or
// weed, over mud with a hand of water under it, or into broken water loses the plane RAPIDLY —
// not instantly, and faster the more drag there is — and sheds its speed fast, rather than
// coasting through on the keelboat's nine-second carry. Before this, the plane only knew the
// boat's own speed, which drag lowers slowly: a boat planed straight across every Otter kelp bed.
//   · `waterDrag` is what the water does to a planing hull here: the bottom's share of drive,
//     1 − (shoal × tide), or broken water at its OWN level (a rapid's turbulence, a vent's boil)
//     — the strongest wins, like overlapping bars. Broken water counts at its level, not at its
//     share of drive (× RAPIDS_DRAG / BOIL_DRAG): aerated water will not hold a hull up whatever
//     it does to the sails' drive, and at the drive share only the one turbulence-1 rapid, and
//     no boil below peak breath, could ever reach the red. A boil is the harsher water (it takes
//     BOIL_DRAG of the drive to a rapid's RAPIDS_DRAG), so it counts at the rapid-equivalent
//     level, boil × 0.85/0.6. So: rapids of 0.65 and up break the plane at their heart, 0.3-0.5
//     rapids do not; a rift (0.8) or fissure (0.7) at any breath, a mound (0.55) boiling hard.
//   · THE RED LINE. Only water "in the red" drains the plane: the flats sounder's red band
//     (under 0.4 × `free` clearance, hud.js) is a tide multiplier of ~0.47, so drag over 0.53.
//     A bar's feathered rim, amber water, lilies and eelgrass cost speed but keep the plane.
//   · In the red a hold on the plane drains at waterDrag / breakS per second and the plane
//     breaks at zero: 0.8 (a bar's heart) in ~0.4 s, kelp 0.65 in ~0.45 s. Out of it the hold
//     refills over `refillS`, so a brush with the red is forgiven. No entry while in the red.
//   · THE BITE. Carrying way into drag (speed over `margin` × target) above displacement speed
//     (`hullKt`, full by `biteKt`), the slow-down rate grows by `bite` × drag (a bar's heart at
//     planing speed: ~9 s → ~1.6 s). A light-air wade, or a wobble inside a weedbed, is untouched. Bottom and rapids only — a boil already scrubs speed on contact
//     (BOIL_SCRUB) and would be charged twice. Keyed to drag, not the momentum stat: weed on
//     the keel does not care how heavy the boat is.
// `planeHold` lives on the boat and only once a boat has met red water — never raceState
// (the trace hash), and no field grows where there is none.
const PLANE_DRAG = {
    red: 0.53,
    breakS: 0.3,
    refillS: 0.5,
    bite: 6,
    hullKt: 7,
    biteKt: 11,
    margin: 1.15
};

function getTargetSpeed(twaRadians, useSpinnaker, windSpeed) {
    const twaDeg = Math.abs(twaRadians) * (180 / Math.PI);
    const angles = J111_POLARS.angles;
    const speeds = [6, 8, 10, 12, 14, 16, 20, 25, 30];

    const getPolarSpeed = (ws) => {
        const data = J111_POLARS.speeds[ws];
        const sData = useSpinnaker ? data.spinnaker : data.nonSpinnaker;
        for (let i = 0; i < angles.length - 1; i++) {
            if (twaDeg >= angles[i] && twaDeg <= angles[i+1]) {
                const t = (twaDeg - angles[i]) / (angles[i+1] - angles[i]);
                return sData[i] + t * (sData[i+1] - sData[i]);
            }
        }
        return sData[sData.length - 1];
    };

    if (windSpeed <= 0) return 0;
    if (windSpeed < 6) {
         // Linearly interpolate from 0 to Speed@6
         return getPolarSpeed(6) * (windSpeed / 6.0);
    }

    let lower = 6, upper = 30;
    // Flatlines at 30 now, not 20. Above 30 there is genuinely nothing left to say — no
    // venue authors a mean above 29 kt, and a boat that far past its limit is being handled
    // by the heel/overpowered model, not by the polar.
    if (windSpeed >= 30) { lower = 30; upper = 30; }
    else {
        for (let i = 0; i < speeds.length - 1; i++) {
            if (windSpeed >= speeds[i] && windSpeed <= speeds[i+1]) { lower = speeds[i]; upper = speeds[i+1]; break; }
        }
    }

    const s1 = getPolarSpeed(lower), s2 = getPolarSpeed(upper);
    return lower === upper ? s1 : s1 + (windSpeed - lower) / (upper - lower) * (s2 - s1);
}

function checkBoundaryExiting(boat) {
    if (!state.course.boundary) return false;
    const b = state.course.boundary;
    // Within 200u of the edge and heading further out — whatever shape the edge is.
    if (Arena.signedDist(b, boat.x, boat.y) < 200) {
        const hx = Math.sin(boat.heading), hy = -Math.cos(boat.heading);
        const n = Arena.outward(b, boat.x, boat.y);
        if (hx * n.x + hy * n.y > 0) return true;
    }
    return false;
}

function getClearAstern(behind, ahead) {
    if (window.Rules) return window.Rules.isClearAstern(behind, ahead);
    return false;
}

function getRightOfWay(b1, b2) {
    if (window.Rules) return window.Rules.getRightOfWay(b1, b2);
    return { boat: null, rule: "Error", reason: "No Rules Engine" };
}

function getOptimalVMGAngle(mode, windSpeed) {
    const angles = J111_POLARS.angles;
    const speeds = [6, 8, 10, 12, 14, 16, 20];

    // Find bracketing wind speeds for interpolation
    let ws = Math.max(6, Math.min(20, windSpeed));
    let lower = 6, upper = 6;
    for (let i = 0; i < speeds.length - 1; i++) {
        if (ws >= speeds[i] && ws <= speeds[i + 1]) {
            lower = speeds[i]; upper = speeds[i + 1]; break;
        }
    }
    if (ws >= 20) { lower = 20; upper = 20; }

    const getSpeed = (wsKey, angleIdx) => {
        const data = J111_POLARS.speeds[wsKey];
        return mode === 'downwind' ? data.spinnaker[angleIdx] : data.nonSpinnaker[angleIdx];
    };

    let bestVMG = -Infinity;
    let bestAngle = mode === 'upwind' ? 45 : 150;

    for (let i = 0; i < angles.length; i++) {
        const a = angles[i];
        if (mode === 'upwind' && (a < 30 || a > 70)) continue;
        if (mode === 'downwind' && (a < 110 || a > 180)) continue;

        // Interpolate boat speed at this angle for current wind
        const s1 = getSpeed(lower, i);
        const s2 = getSpeed(upper, i);
        const boatSpeed = lower === upper ? s1 : s1 + (ws - lower) / (upper - lower) * (s2 - s1);

        const aRad = a * Math.PI / 180;
        const vmg = mode === 'upwind'
            ? boatSpeed * Math.cos(aRad)
            : boatSpeed * Math.cos(Math.PI - aRad);

        if (vmg > bestVMG) {
            bestVMG = vmg;
            bestAngle = a;
        }
    }

    return bestAngle * (Math.PI / 180);
}

function getBestVMGAngle(mode, windSpeed) {
    return getOptimalVMGAngle(mode, windSpeed);
}

function getCharacterOptimalVMGAngle(mode, windSpeed, stats) {
    const angles = J111_POLARS.angles;
    const speeds = [6, 8, 10, 12, 14, 16, 20, 25, 30];

    // Apply pressure stat to effective wind (same formula as physics line 3582)
    const pressureFactor = stats.pressure * 0.05;
    let ws = windSpeed;
    const baseWind = state.wind.baseSpeed;
    if (ws > baseWind) {
        ws = baseWind + (ws - baseWind) * (1.0 + pressureFactor);
    } else {
        ws = baseWind + (ws - baseWind) * (1.0 - pressureFactor);
    }
    // The physics polar was extended to 25 and 30 kt (overpowered phases 0-2);
    // clamping the OPTIMIZER at 20 left the AI choosing angles for a wind it was
    // not in, and blind to the heel tax it was about to pay.
    ws = Math.max(6, Math.min(30, ws));

    let lower = 6, upper = 6;
    for (let i = 0; i < speeds.length - 1; i++) {
        if (ws >= speeds[i] && ws <= speeds[i + 1]) {
            lower = speeds[i]; upper = speeds[i + 1]; break;
        }
    }
    if (ws >= 30) { lower = 30; upper = 30; }

    const getSpeed = (wsKey, angleIdx) => {
        const data = J111_POLARS.speeds[wsKey];
        return mode === 'downwind' ? data.spinnaker[angleIdx] : data.nonSpinnaker[angleIdx];
    };

    let bestVMG = -Infinity;
    let bestAngle = mode === 'upwind' ? 45 : 150;

    for (let i = 0; i < angles.length; i++) {
        const a = angles[i];
        if (mode === 'upwind' && (a < 30 || a > 70)) continue;
        if (mode === 'downwind' && (a < 110 || a > 180)) continue;

        const s1 = getSpeed(lower, i);
        const s2 = getSpeed(upper, i);
        let boatSpeed = lower === upper ? s1 : s1 + (ws - lower) / (upper - lower) * (s2 - s1);

        // Apply point-of-sail stat modifiers (same as physics lines 3687-3709)
        let posStat = 0;
        if (a <= 60) {
            posStat = stats.upwind * 0.012;
        } else if (a >= 145) {
            posStat = stats.downwind * 0.015;
        } else if (a < 102.5) {
            const t = (a - 60) / (102.5 - 60);
            posStat = stats.upwind * 0.012 + t * (stats.reach * 0.018 - stats.upwind * 0.012);
        } else {
            const t = (a - 102.5) / (145 - 102.5);
            posStat = stats.reach * 0.018 + t * (stats.downwind * 0.015 - stats.reach * 0.018);
        }
        boatSpeed *= (1.0 + posStat);

        const aRad = a * Math.PI / 180;
        // Price the heel tax INTO the angle choice. The physics charges
        // overpoweredFactor on the wind the boat is in; an optimizer that ignores
        // it recommends polar-pretty angles that sail pressed and slow. Steady-
        // state apparent wind from the candidate speed is enough of an estimate.
        if (ws > OVERPOWERED.threshold - 2) {
            const ax = ws * Math.cos(aRad) + boatSpeed;
            const ay = ws * Math.sin(aRad);
            const aws = Math.hypot(ax, ay);
            const awa = Math.atan2(ay, ax);
            boatSpeed *= overpoweredFactor(stats, heelPressure(aws, awa));
        }
        const vmg = mode === 'upwind'
            ? boatSpeed * Math.cos(aRad)
            : boatSpeed * Math.cos(Math.PI - aRad);

        if (vmg > bestVMG) {
            bestVMG = vmg;
            bestAngle = a;
        }
    }

    return bestAngle * (Math.PI / 180);
}


// Rudder authority grows with boat speed: a keelboat steers crisply at speed but
// mushily when slow, and barely at all "in irons" (head-to-wind with no way). This
// makes in-irons and the cost of a slow/bad tack emerge naturally instead of being
// special-cased. Kept forgiving with a generous floor so boats never fully lock up.
function steerageFactor(boat) {
    const spdKnots = boat.speed / 0.25; // game speed -> knots
    // 0kt -> 0.6x, ramps to full authority by ~3.5kt, capped at 1.0 (no super-turning).
    // Floor kept fairly high (0.6) so a boat that slows in close quarters can still
    // turn away — a lower floor traps slow boats in the pack and spikes collisions.
    return Math.min(1.0, Math.max(0.6, 0.6 + 0.4 * (spdKnots / 3.5)));
}

function triggerPenalty(boat, info) {
    if (boat.raceState.finished) return;
    if (window.onRaceEvent && state.race.status === 'racing') window.onRaceEvent('penalty', { boat, kind: info && info.kind, rule: info && info.rule, reason: info && info.reason, other: info && info.other });
    if (!settings.penaltiesEnabled) return;

    // One-Turn Penalty (RRS 44 style): the foul flags the boat and owes a
    // 360° turn. No speed is taken away — the cost is the turn itself, taken
    // when the sailor chooses (Rule 21 keep-clear applies while flagged, and
    // an un-taken turn costs +15s at the finish). Sustained/grinding contact
    // re-triggers every frame, so counting is per flagged EPISODE (same
    // debounce semantics as the old 10s-timer design): while flagged, further
    // fouls neither add turns nor inflate totalPenalties.
    const rs = boat.raceState;
    if (!rs.penalty) {
        rs.penalty = true;
        rs.totalPenalties++;
        rs.penaltyTurnsOwed = 1;
        rs.penaltyFlagTime = 0;
        rs.penaltyRot = 0;
        rs.penaltyLastHeading = boat.heading;
        // Announce, don't call upward: audio and the banner subscribe to this in
        // game/audio.js and ui/screens.js. Same frame, same order as the old
        // direct calls (sound first, banner second — registration order).
        // WHY, kept for the turn-countdown banner (a string on the boat, not raceState: the
        // trace hash reads raceState's numbers). PT-067: the reason used to show for one frame
        // before the countdown replaced it, so "why did I get a penalty?" had no answer.
        boat._penaltyWhy = info && info.rule ? `${info.rule}${info.reason ? ' — ' + info.reason : ''}` : null;
        if (boat.isPlayer) GameEvents.emit('player-penalty', info);
    }
}

// Update Boat Physics & Race Status
function updateBoat(boat, dt) {
    if (state.race.status === 'waiting') return;

    const timeScale = dt * 60;

    // A FINISHED BOAT LEAVES, starting the moment it crosses. It has nothing left to do on
    // the course, and a fleet of parked hulls sitting on the line hides the boats still
    // racing through it — which is exactly where the last of the fleet needs watching.
    //
    // It always faded; it just sat there at full opacity for eight seconds first
    // (`fadeTimer` began at 10 and the fade only started below 2). Now the timer IS the
    // fade. Everything downstream already keys off `opacity` or `fadeTimer <= 0` — the
    // hull, its indicator, its edge marker, the minimap pip and collision — so they all
    // follow without being told.
    if (boat.raceState.finished) {
        boat.fadeTimer -= dt;
        boat.opacity = Math.max(0, boat.fadeTimer / FINISH_FADE_SECS);
    }

    // AI Logic or Player Input
    if (!boat.isPlayer || boat.raceState.finished) {
        updateAI(boat, dt);
    }

    // The physics reads a CONTROLS STRUCT, not the keyboard — sampleKeyControls()
    // (game/state.js) is the one seam between input devices and the hull.
    // Sailing School can hold the helm for a moment ("feel the wind") — the boat sails itself.
    const ctl = (boat.isPlayer && !(window.School && School.controlsLocked)) ? sampleKeyControls() : NO_CONTROLS;

    if (boat.isPlayer && !boat.raceState.finished) {
        // Player Input
        // Apply Handling Stat (Player)
        const handlingMod = (1.0 + boat.stats.handling * 0.03);
        const turnRate = (ctl.slow ? getTurnSpeed() * 0.25 : getTurnSpeed()) * timeScale * handlingMod * steerageFactor(boat);
        if (ctl.left) boat.heading -= turnRate;
        if (ctl.right) boat.heading += turnRate;
    }

    boat.heading = normalizeAngle(boat.heading);

    // Physics
    const localWind = getWindAt(boat.x, boat.y);

    // ── SEA STATE (ocean only — see swell.js) ───────────────────────────────
    // `trim` is null on every venue whose document authors no swell, and each of the four
    // uses below is behind that, so nothing outside Bluewater Bonanza changes by a unit.
    //
    // The yaw lands FIRST, on top of the heading the helm or the controller just chose: a
    // wave does not ask what you were steering, and having to hold a course against it is
    // the whole of what steering in a seaway is.
    const swell = window.Swell && window.Swell.active() ? window.Swell.trim(boat, localWind.direction) : null;
    if (swell) boat.heading = normalizeAngle(boat.heading + swell.yawRate * dt);

    const angleToWind = Math.abs(normalizeAngle(boat.heading - localWind.direction));

    // Log the breeze the PLAYER sailed through, for the results header. Player only and
    // three comparisons a frame — the same reasoning as the split ranks: it is a reading
    // taken while the race runs because it cannot be taken afterwards.
    if (boat.isPlayer && state.race.status === 'racing' && !boat.raceState.finished) {
        const rs = boat.raceState;
        if (localWind.speed < rs.windObsMin) rs.windObsMin = localWind.speed;
        if (localWind.speed > rs.windObsMax) rs.windObsMax = localWind.speed;
        rs.windObsSum += localWind.speed;
        rs.windObsN++;
    }

    // ── APPARENT WIND, computed before anything that trims to it ────────────
    // Apparent = the air's motion minus the boat's own. It was worked out further down and
    // used only for the flag, the telltales and the HUD, which left the RIG being trimmed to
    // the true wind — so the boat never sheeted in as it accelerated and the "a boat makes
    // its own wind" loop never closed.
    //
    // Uses LAST frame's speed, deliberately. Apparent depends on boat speed and boat speed
    // depends on trim, so resolving them in the same frame is a circular reference; a
    // one-frame lag is the standard answer and is invisible at 60 Hz.
    //
    // ⚠️ Speed still comes from the POLAR, indexed on TRUE wind — see overpowered-plan.md §3.
    // A polar table is defined against TWS/TWA and already has the apparent physics inside
    // it; indexing it by apparent would double-count and close a runaway loop.
    {
        const Wkn = localWind.speed;                 // true wind, knots
        const Bkn = boat.speed / 0.25;               // boat speed, knots
        const awx = -Math.sin(localWind.direction) * Wkn - Math.sin(boat.heading) * Bkn;
        const awy =  Math.cos(localWind.direction) * Wkn + Math.cos(boat.heading) * Bkn;
        boat.apparentWind = {
            direction: normalizeAngle(Math.atan2(-awx, awy)), // heading the wind comes FROM
            speed: Math.hypot(awx, awy)
        };
    }
    // The angle the RIG feels. Always forward of the true wind angle, and further forward
    // the faster the boat goes — which is exactly why a quick boat sheets in and carries a
    // kite deeper than a slow one.
    const awa = Math.abs(normalizeAngle(boat.heading - boat.apparentWind.direction));

    // Update Turbulence Particles
    updateTurbulence(boat, dt);

    // Disturbed Air
    boat.badAirIntensity = 0;
    const windDir = localWind.direction;
    const wx = -Math.sin(windDir); // Flow X
    const wy = Math.cos(windDir);  // Flow Y
    const crx = -wy; // Right X
    const cry = wx;  // Right Y
    const shadowLength = 450;
    const startW = 20;
    const endW = 100;

    for (const other of state.boats) {
        if (other === boat) continue;
        const dx = boat.x - other.x;
        const dy = boat.y - other.y;

        // Project onto flow (Downwind distance)
        const dDown = dx * wx + dy * wy;
        if (dDown <= 10 || dDown > shadowLength) continue;

        const widthAtDist = startW + (dDown / shadowLength) * (endW - startW);
        const dCross = Math.abs(dx * crx + dy * cry);

        if (dCross < widthAtDist * 0.7) {
             const centerFactor = 1.0 - (dCross / (widthAtDist * 0.7));
             const distFactor = 1.0 - (dDown / shadowLength);
             const intensity = 0.95 * centerFactor * distFactor;
             if (intensity > boat.badAirIntensity) boat.badAirIntensity = intensity;
        }
    }

    // Sail Logic
    let relWind = normalizeAngle(localWind.direction - boat.heading);
    if (Math.abs(relWind) > 0.1) boat.targetBoomSide = relWind > 0 ? 1 : -1;

    // Check Tacking (Rule 13)
    // Rule 13: "After a boat passes head to wind, she shall keep clear of other boats until she is on a close-hauled course."
    // We detect "passing head to wind" by checking if the wind side relative to the boat flips while upwind.
    const currentSide = Math.sign(relWind);

    // Initialize if missing (default to current if non-zero, else 1)
    if (boat.lastLocalWindSide === undefined) boat.lastLocalWindSide = (currentSide !== 0) ? currentSide : 1;

    // Only update and check if we are not exactly head-to-wind (0)
    // This allows us to bridge across the 0 value (e.g. -1 -> 0 -> 1)
    if (currentSide !== 0) {
        if (currentSide !== boat.lastLocalWindSide) {
             // Crossed the wind
             // Only if we are generally pointing upwind (avoid gybes triggering this)
             if (angleToWind < Math.PI / 2) {
                 boat.raceState.isTacking = true;
             }
        }
        boat.lastLocalWindSide = currentSide;
    }

    // Clear Tacking state when close-hauled.
    //
    // ⚠️ "CLOSE-HAULED" IS WHAT THE FLEET ACTUALLY SAILS, NOT 45°. RRS 13 ends
    // "when she is on a close-hauled course" — and this game's close-hauled is
    // TWA ~38° (polar beat angle 42°, sailed TWA 38-39, no-go boundary 31.5°).
    // With the exit at 45°, a boat that completes her tack directly onto her
    // real close-hauled angle NEVER satisfies the test: the flag only cleared
    // during the acceleration bear-away past 45°, which a well-sailed boat
    // holding a tight lane never does. Measured (bay, full race): 4.2% of all
    // racing time flagged, median TWA while flagged 37.96° — boats sailing
    // their normal beat, not boats mid-tack; episodes to 16.4 s. The owner's
    // report is the player-facing symptom: on starboard at 38-39° TWA, rule 13
    // said HE keeps clear, so an approaching port-tacker was given rights over
    // him.
    //
    // ⚠️ AND THE THRESHOLD MUST SIT BELOW WHAT A WIND SHIFT CAN REACH (owner,
    // on reviewing a 35° draft): this test reads INSTANTANEOUS TWA in an
    // oscillating breeze, so a header can hold the flag on a boat whose COURSE
    // is already close-hauled — with regions swinging ±5-8°, a 35° exit leaves
    // a 38°-course boat flagged through every header. 0.40 rad ≈ 23° (owner's
    // 20-25° range): past head to wind by that much the swing is unambiguous
    // under any shift, and the flag describes the tack, not the weather.
    if (boat.raceState.isTacking) {
        if (angleToWind >= 0.40) {
             boat.raceState.isTacking = false;
        }
    }

    let swingSpeed = 0.025;
    boat.boomSide += (boat.targetBoomSide - boat.boomSide) * swingSpeed;
    if (Math.abs(boat.targetBoomSide - boat.boomSide) < 0.01) boat.boomSide = boat.targetBoomSide;

    // Sail angle: map APPARENT wind angle 25-160 onto sheeting angle 0-90.
    //
    // A sailor trims to the telltales, and the telltales are in the apparent wind. Mapping
    // from TWA meant the sheeting angle never moved as the boat accelerated — the rig was
    // being trimmed for a wind nobody on board could feel.
    //
    // Same 135-degree span and the same 2/3 ratio as the true-wind version it replaces; only
    // the origin moves, from 45 degrees of true to AWA_CLOSE_HAULED of apparent. Close-hauled
    // apparent sits near 25 degrees, which is where the sheet comes right in.
    // Clamped at square to the centreline: the old TWA form reached exactly 90 degrees at
    // TWA 180 and so never needed saying, but AWA 160-180 runs past it, and a boom eased
    // beyond square is not a thing. Without the clamp the AI chases an unreachable target
    // downwind and `trimEfficiency` — which prices |actual - optimal| — charges it for the
    // gap it can never close.
    let optimalSailAngle = Math.min(Math.PI / 2, Math.max(0, (awa - AWA_CLOSE_HAULED) * (2.0 / 3.0)));
    if (optimalSailAngle > Math.PI / 2.0) optimalSailAngle = Math.PI / 2.0;

    if (boat.manualTrim && boat.isPlayer) {
        const trimRate = 0.8 * dt;
        if (ctl.trimUp) boat.manualSailAngle = Math.min(Math.PI / 2.0, boat.manualSailAngle + trimRate);
        if (ctl.trimDown) boat.manualSailAngle = Math.max(0, boat.manualSailAngle - trimRate);
        boat.sailAngle = boat.manualSailAngle * boat.boomSide;
    } else if (boat.isPlayer) {
        // Player Auto-Trim (Instant)
        boat.manualSailAngle = optimalSailAngle;
        boat.sailAngle = optimalSailAngle * boat.boomSide;
    } else {
        // AI Simulated Manual Trim
        updateAITrim(boat, optimalSailAngle, dt);
    }

    const switchSpeed = dt / 5.0;
    if (boat.spinnaker) boat.spinnakerDeployProgress = Math.min(1, boat.spinnakerDeployProgress + switchSpeed);
    else boat.spinnakerDeployProgress = Math.max(0, boat.spinnakerDeployProgress - switchSpeed);

    const progress = boat.spinnakerDeployProgress;
    // ── THE HOIST CROSSFADE — weights that SUM TO ONE ───────────────────────
    // These were `max(0, 1 - p*2)` and `max(0, (p-0.5)*2)`. Both are zero at p = 0.5, and
    // they are the weights of a WEIGHTED SUM (`targetKnots` below), so a boat halfway
    // through a sail change had a target speed of exactly ZERO — as though the rig had been
    // taken down. The hoist runs at `dt / 5.0`, five full seconds, so that hole is wide:
    // measured 38-49% of beam-reach frames and 29-45% of running frames sitting in it.
    //
    // A boat changing sails always has SOMETHING up. Crossfade linearly, and charge the
    // change an explicit, bounded price instead of everything.
    const jibFactor = 1 - progress;
    const spinFactor = progress;
    // 4p(1-p) peaks at exactly 1.0 at half-hoist and is zero at both ends, so the cost is a
    // smooth dip through the change and nothing at all once it is done.
    const changeCost = 1 - SAIL_CHANGE_COST * 4 * progress * (1 - progress);

    // Pressure Stat: Affects wind handling
    // Pressure (+/-25%): Benefit from gusts, lose less from lulls/bad air.
    // 5% per point.
    const pressureFactor = boat.stats.pressure * 0.05;
    const baseWind = state.wind.baseSpeed;
    let physWindSpeed = localWind.speed;

    if (physWindSpeed > baseWind) {
        // Gust: Enhance benefit
        // Increase the delta above base
        physWindSpeed = baseWind + (physWindSpeed - baseWind) * (1.0 + pressureFactor);
    } else {
        // Lull: Reduce loss (if pressure positive)
        // physWindSpeed < base. (phys - base) is negative.
        // We want result closer to base if pressure > 0.
        // Example: Base 10, Speed 8. Diff -2. Boost +0.5.
        // New Diff = -2 * (1 - 0.5) = -1. Speed = 9. Correct.
        physWindSpeed = baseWind + (physWindSpeed - baseWind) * (1.0 - pressureFactor);
    }

    // Disturbed Air: Reduce intensity if pressure > 0
    // Intensity is 0 to 1.
    const effectiveBadAir = boat.badAirIntensity * (1.0 - pressureFactor);
    // Note: if pressure is negative (e.g. -0.5), BadAir becomes 1.5x worse.

    const effectiveWind = Math.max(0, physWindSpeed * (1.0 - effectiveBadAir));
    boat.effectiveWindNow = effectiveWind; // read by the HUD overpowered badge

    let targetKnotsJib = getTargetSpeed(angleToWind, false, effectiveWind);
    let targetKnotsSpin = getTargetSpeed(angleToWind, true, effectiveWind);
    let targetKnots = (targetKnotsJib * jibFactor + targetKnotsSpin * spinFactor) * changeCost;

    // THE SHEET, not the boom. `sailAngle` is `manualSailAngle * boomSide`, and `boomSide`
    // is not a side flag — it is a continuous gybe ANIMATION that sweeps through zero (0.79,
    // 0.50, 0.25, -0.81 ... all observed in one race). So |sailAngle| collapses toward zero
    // mid-gybe and this term scored a correctly trimmed boat as completely mistrimmed every
    // time she gybed: 30% of running frames read a 44-80 degree trim error, trim quality
    // 0.64 on the run against 0.96 broad, which dropped the fleet out of planing (38% vs
    // 65%) and cost 1.5 knots. Trim quality is a question about where the SHEET is.
    const actualMagnitude = Math.abs(boat.manualSailAngle);
    const angleDiff = Math.abs(actualMagnitude - optimalSailAngle);
    const trimEfficiency = Math.max(0, 1.0 - angleDiff * 2.0);
    boat.trimEfficiency = trimEfficiency;   // read by the heavy-air rig, and by the HUD later
    boat.optimalSailAngle = optimalSailAngle;
    targetKnots *= trimEfficiency;

    // THE WATER, read before the plane — PLANE_DRAG. Applied to the target at the shoal and
    // rapids slots below, as before; read here because the plane has to know about it.
    const shoalNow = state.course._hasShoals ? window.VenueDoc.shoalField(state.course.islands, boat.x, boat.y) : 1;
    const tideNow = (state.tide && window.Tide) ? Tide.speedMul(boat) : 1;
    const rapidsNow = rapidsTurbAt(boat.x, boat.y);
    const boilNow = (state.volcano && window.Volcano) ? Volcano.boilAt(boat.x, boat.y) : 0;
    const bottomDrag = 1 - shoalNow * tideNow;
    const waterDrag = Math.max(bottomDrag, rapidsNow, boilNow * BOIL_DRAG / RAPIDS_DRAG);
    const inRed = waterDrag > PLANE_DRAG.red;
    if (inRed) boat.planeHold = (boat.planeHold == null ? 1 : boat.planeHold) - dt * waterDrag / PLANE_DRAG.breakS;
    else if (boat.planeHold != null && boat.planeHold < 1) boat.planeHold = Math.min(1, boat.planeHold + dt / PLANE_DRAG.refillS);

    // PLANING LOGIC
    const twaDeg = Math.abs(angleToWind * 180 / Math.PI);
    const tws = effectiveWind;
    const boatKnots = boat.speed * 4;

    let canPlane = (
        twaDeg > (J111_PLANING.minTWA * 180 / Math.PI) &&
        twaDeg < (J111_PLANING.maxTWA * 180 / Math.PI) &&
        tws > J111_PLANING.minTWS
    );
    // No getting onto the plane in red water.
    if (inRed && !boat.raceState.isPlaning) canPlane = false;

    // Hysteresis State Machine
    if (canPlane) {
        if (!boat.raceState.isPlaning) {
            // Trying to enter
            if (boatKnots > J111_PLANING.entrySpeed) {
                boat.raceState.planingTimer += dt;
                if (boat.raceState.planingTimer > J111_PLANING.entryTime) {
                    boat.raceState.isPlaning = true;
                    boat.raceState.planingTimer = 0;
                    if (!boat.isPlayer) Sayings.queueQuote(boat, "start_planing");
                    if (boat.isPlayer && settings.soundEnabled) {
                         // Optional: Play a surge sound or change wind pitch (handled in audio update)
                    }
                }
            } else {
                boat.raceState.planingTimer = 0;
            }
        } else {
             // Maintaining
             // Exit if speed drops below lower threshold
             if (boatKnots < J111_PLANING.exitSpeed) {
                 boat.raceState.planingTimer += dt;
                 if (boat.raceState.planingTimer > J111_PLANING.exitTime) {
                     boat.raceState.isPlaning = false;
                     boat.raceState.planingTimer = 0;
                 }
             } else {
                 boat.raceState.planingTimer = 0;
             }
        }
    } else {
        // Conditions lost
        if (boat.raceState.isPlaning) {
             boat.raceState.planingTimer += dt;
             if (boat.raceState.planingTimer > J111_PLANING.exitTime) {
                 boat.raceState.isPlaning = false;
                 boat.raceState.planingTimer = 0;
             }
        } else {
             boat.raceState.planingTimer = 0;
        }
    }

    // Red water has drained the hold: the plane breaks now, whatever the speed says.
    if (boat.raceState.isPlaning && inRed && boat.planeHold <= 0) {
        boat.raceState.isPlaning = false;
        boat.raceState.planingTimer = 0;
    }

    if (boat.raceState.isPlaning) {
        // Boost target speed
        targetKnots *= J111_PLANING.speedMultiplier;

        // Handling: Turning bleeds speed faster
        const turnActive = Math.abs(boat.heading - boat.prevHeading) > 0.0001;
        if (turnActive) {
            targetKnots *= J111_PLANING.turnDrag;
        }
    }

    // Smooth factor for planing transition
    const targetFactor = boat.raceState.isPlaning ? 1.0 : 0.0;
    boat.raceState.planingFactor += (targetFactor - boat.raceState.planingFactor) * dt * 2.0;

    // Apply Upwind/Reach/Downwind Speed Stats
    // Interpolate between Upwind (<=60), Reach (60-145), Downwind (>=145)
    // TWA is in degrees (twaDeg)
    let speedStat = 0;
    if (twaDeg <= 60) {
        speedStat = boat.stats.upwind * 0.012; // 6% max at +/-5
    } else if (twaDeg >= 145) {
        speedStat = boat.stats.downwind * 0.015; // 7.5% max at +/-5
    } else {
        // Linear Interpolation
        // Reach peak assumed at (60+145)/2 = 102.5?
        // Let's just interpolate the Stat Value.
        // Or simpler: Calculate blend weights.
        if (twaDeg < 102.5) {
            const t = (twaDeg - 60) / (102.5 - 60);
            const s1 = boat.stats.upwind * 0.012;
            const s2 = boat.stats.reach * 0.018; // 9% max at +/-5
            speedStat = s1 + t * (s2 - s1);
        } else {
            const t = (twaDeg - 102.5) / (145 - 102.5);
            const s1 = boat.stats.reach * 0.018;
            const s2 = boat.stats.downwind * 0.015;
            speedStat = s1 + t * (s2 - s1);
        }
    }
    // Apply multiplier
    targetKnots *= (1.0 + speedStat);

    // Wind groove: light-air and heavy-air specialists. Keyed to the DAY's base wind,
    // not the boat's local effective wind, and that distinction is the whole point of
    // keeping these separate from pressure. Local wind already carries gusts, lulls,
    // shadows and dirty air — all of which pressure exists to modulate. Feeding it here
    // too would double-count, and worse, a low-pressure boat feels deeper lulls and would
    // silently earn more lightAir credit for its own weakness. So: lightAir/heavyAir
    // answer "what kind of day suits you", pressure answers "how you handle the
    // deviations from it".
    targetKnots *= windGrooveFactor(boat.stats, state.wind.baseSpeed);
    // ADAPTIVE AI (js/ai/adaptive.js): a flat % on a BOT's target speed when the race has come
    // apart — every character keeps its own stat profile. Never set on the player.
    if (boat._adaptMul != null && !boat.isPlayer) targetKnots *= boat._adaptMul;

    // OVERPOWERED, beside the groove and deliberately not inside it. They ask different
    // questions of the same stat: the groove asks what kind of DAY suits this boat, keyed to
    // the day's mean; this asks what the boat is doing about the wind it is in RIGHT NOW,
    // keyed to the wind it measures. Folding them together would force one answer on both,
    // and a boat in a 25-knot puff on a 14-knot day would sail as though it were not.
    // Heel is LAGGED state, not an instantaneous read — a rig takes a moment to load up and
    // a moment to come back, and that delay is the whole mechanic: it makes being
    // overpowered something a sailor sails INTO and back OUT of. Phase 4 hangs the amber/red
    // warning and the broach off this same number.
    const heelNow = heelPressure(boat.apparentWind.speed * (1.0 - effectiveBadAir), awa);
    const lag = Math.min(1, dt / OVERPOWERED.lagSeconds);
    boat.heel = (boat.heel || 0) + (heelNow - (boat.heel || 0)) * lag;
    targetKnots *= overpoweredFactor(boat.stats, boat.heel);

    // THE SEA'S TAX ON DRIVING HARD UPWIND. Multiplies the target rather than the speed
    // because it is a sustained state of the boat, not an impulse — and it is the one term
    // that makes footing worse than pointing, which is why a seaway is sailed higher than
    // flat water. Ocean only; 1.0 everywhere else. See swell.js §4.
    if (swell) targetKnots *= swell.poundMul;

    // SHALLOW WATER. A multiplier on the TARGET, for the same reason the pound tax is:
    // being over a bar is a sustained state, not a bump, so the boat's own acceleration
    // constants decide how fast it bleeds off and how fast it comes back. Sailing onto a
    // shoal therefore feels like the drag building it is, and sailing off one gives the
    // speed back over about five seconds rather than in a frame.
    //
    // Graded by depth, not a step at the outline — see VenueDoc.shoalMul. Half speed over
    // the shallowest part of the bar, feathering to nothing at its rim, so grazing an edge
    // is nearly free and crossing the middle is a real price you chose to pay.
    if (state.course._hasShoals) {
        boat.shoalMul = shoalNow;
        targetKnots *= boat.shoalMul;
    } else if (boat.shoalMul !== 1) {
        boat.shoalMul = 1;
    }
    // THE TIDE (Spoonbill Flats). The same kind of multiplier, read off depth rather than
    // off a polygon: full speed with a hand of clearance, the mud taking more as the water
    // goes, nothing at all aground — see js/tide.js. Only ever set on a tidal venue, so no
    // other venue's boats grow the fields (the golden traces hash every primitive).
    if (state.tide && window.Tide) targetKnots *= tideNow;

    // RAPIDS. Turbulence only — a rapid authors no flow; whatever stream runs through
    // it is the Current layer's and arrives through getCurrentAt below. Broken water
    // robs drive the way a bar does: a multiplier on the TARGET, so the boat's own
    // constants decide how the speed bleeds off and comes back. And it shoves the bow:
    // a band-limited wobble on the HEADING itself — the one water effect allowed to
    // touch it, because turbulence really does turn the boat, where a stream only
    // carries it. Phase is dealt per boat from a counter and the shape is pure in
    // state.time, so a fleet in the same stopper tosses independently and no RNG is
    // drawn.
    boat.rapidsTurb = rapidsNow;
    // A seabed vent's BOIL is broken water with a difference: aerated, it will not hold a
    // hull up or let it grip. It takes the rapids' drag and yaw below, AND it SCRUBS speed
    // on contact — a share per second, not a target the boat drifts toward — so crossing
    // a rift costs boat lengths you then spend re-accelerating, against a detour of a
    // couple of hundred units round its end. That is the choice (Wes: "it doesn't present
    // a real choice"). The router prices the same field (Volcano.boilMul) and the bots
    // read it locally, so the fleet knows what the foam means.
    boat.boil = boilNow;
    if (boat.boil > 0.01) {
        boat.rapidsTurb = Math.max(boat.rapidsTurb, boat.boil);
        targetKnots *= (1 - (BOIL_DRAG - RAPIDS_DRAG) * boat.boil);   // on top of the rapids' share below
        boat.speed *= Math.max(0, 1 - BOIL_SCRUB * boat.boil * dt);
    }
    if (boat.rapidsTurb > 0.01) {
        targetKnots *= (1 - RAPIDS_DRAG * boat.rapidsTurb);
        if (boat._rapidsPhase == null) boat._rapidsPhase = (_rapidsPhaseN++ % 32) * 2.399963;
        const p = boat._rapidsPhase;
        const shove = Math.sin(state.time * 2.3 + p) * 0.62 + Math.sin(state.time * 6.1 + p * 1.7) * 0.38;
        boat.heading = normalizeAngle(boat.heading + RAPIDS_YAW * boat.rapidsTurb * shove * dt);
    }

    // A flat pace scale on the hull (default 1). Sailing School's classmates carry 0.9 —
    // ten percent slower at every angle and in every breeze, which no stat can express.
    let targetGameSpeed = targetKnots * 0.25 * (boat.speedScale || 1);

    // Penalties no longer slow the boat directly — the cost is the owed 360°
    // turn (see triggerPenalty). Rule 21 keep-clear still applies while flagged.

    if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
         if (checkBoundaryExiting(boat)) window.onRaceEvent('collision_boundary', { boat });
    }

    // Angle of attack is a fact about the AIR OVER THE SAIL, so it is measured against the
    // apparent wind. On true wind a boat could be sheeted correctly and still be reported as
    // luffing (or vice versa) the moment it had any speed of its own.
    const effectiveAoA = awa - actualMagnitude;
    // 0.5 rad (28.6 deg) was calibrated against the TRUE-wind angle of attack, where a
    // close-hauled boat read 39 deg and sat clear of it. In apparent it reads about 27 deg —
    // a perfectly good angle of attack — so the old threshold had every correctly trimmed
    // boat shaking its sails upwind. At optimal trim AoA bottoms out near 17 deg close-
    // hauled, so the threshold has to sit below that; what is left triggers on genuine
    // pinching and on a sail eased too far, which is what luffing is.
    const luffStartThreshold = 14 * Math.PI / 180;
    if (effectiveAoA < luffStartThreshold) {
        boat.luffIntensity = Math.min(1.0, Math.max(0, 1.0 - (effectiveAoA / luffStartThreshold)));
        boat.luffing = true;
    } else {
        boat.luffIntensity = 0;
        boat.luffing = false;
    }
    // THE KITE TELLS YOU WHEN IT HAS STOPPED PAYING. Auto-trim keeps the spinnaker sheeted
    // so the angle-of-attack test above never fires on it — a kite carried upwind sat full
    // and round while costing three quarters of the boat's speed. J111_POLARS puts the
    // kite/jib crossover at exactly 90° TWA at every wind speed — the kite is the RIGHT sail
    // all the way down to 90° — so the sail must not shake while it is still paying (Wes:
    // a luff at 115° contradicts the speedo). Onset at 90°, where it genuinely stops paying,
    // full flog by 65°, where it is costing half the boat's speed. Render-only — the polar
    // already charges the speed. guidelines/tutorial.md §3.
    if (boat.spinnaker && boat.spinnakerDeployProgress > 0.5) {
        const twaDeg = Math.abs(normalizeAngle(boat.heading - localWind.direction)) * 180 / Math.PI;
        boat.kiteLuff = Math.min(1, Math.max(0, (90 - twaDeg) / 25));
    } else {
        boat.kiteLuff = 0;
    }

    // Speed response toward target (acceleration / drag). The per-second retention
    // is base^60: 0.9985 gave a ~11.6s time-constant, far too sluggish for a 35ft
    // planing sport boat (J/111) — boats reached the line at half speed and took
    // 30s+ to rebuild speed after losing it in traffic. 0.9970 ⇒ ~5.5s constant,
    // which matches a sport keelboat getting up to speed and sharply improves
    // starts and post-tack recovery without making the boats feel like powerboats.
    // Asymmetric response: a displacement keelboat accelerates on a ~5.5s constant
    // (0.9970) but DECELERATES slower (~9s, 0.9982) — it "carries its way" when
    // depowered or head-to-wind, the heavy-boat momentum that makes timing a
    // shoot-to-the-line or a coast into a mark feel real. (Stat mods on top.)
    const accelerating = targetGameSpeed > boat.speed;
    // accel ~5.5s (0.9970), decel ~9s (0.9982): asymmetric so the boat carries its way
    // when depowered/head-to-wind — the heavy-keelboat momentum that makes timing a
    // shoot-to-the-line or a coast into a mark feel real. (Stat mods on top.)
    let speedAlpha = 1 - Math.pow(accelerating ? SPEED_DECAY_UP : SPEED_DECAY_DOWN, timeScale);

    // Apply Acceleration / Momentum Stats
    if (accelerating) {
        // +12% max -> 2.4% per point
        const accelMod = 1.0 + boat.stats.acceleration * 0.024;
        speedAlpha *= accelMod;
    } else {
        // Decelerating (Momentum). Higher momentum stat = slower loss.
        const momMod = 1.0 - boat.stats.momentum * 0.02;
        speedAlpha *= momMod;
        // Drag takes the way off fast — PLANE_DRAG.bite. Bottom and rapids, not the boil.
        // Only on way CARRIED INTO the drag — speed more than `margin` over the target — and
        // only above displacement speed: nothing below `hullKt`, full from `biteKt` (smoothstep).
        // A light-air fleet wading the swamp's weed at 3-5 kt must not feel it: bitten there,
        // it lost every steering wobble at once and rebuilt it on the 5.5 s constant, a ratchet
        // to a crawl (swamp, 8 seeds: 59 finishers → 0-38 under the earlier forms).
        if (boat.speed > targetGameSpeed * PLANE_DRAG.margin) {
            const u = Math.max(0, Math.min(1, (boat.speed * 4 - PLANE_DRAG.hullKt) / (PLANE_DRAG.biteKt - PLANE_DRAG.hullKt)));
            const bite = Math.max(bottomDrag, RAPIDS_DRAG * rapidsNow) * u * u * (3 - 2 * u);
            if (bite > 0) speedAlpha = 1 - (1 - speedAlpha) * Math.pow(SPEED_DECAY_DOWN, timeScale * PLANE_DRAG.bite * bite);
        }
    }

    boat.speed = boat.speed * (1 - speedAlpha) + targetGameSpeed * speedAlpha;

    // ── SURFING ─────────────────────────────────────────────────────────────
    // Gravity along the wave face, added to SPEED and not to the target. That is the whole
    // difference between surfing and simply going fast: the wave puts the boat somewhere its
    // own polar cannot, the log shows it, and because the planing state machine above keys
    // off actual boat speed, a good ride is what trips the boat into a plane. The same term
    // with the sign reversed is the drag of climbing the back of the next one.
    // knots/second -> game speed: knots = speed x 4.
    if (swell) boat.speed = Math.max(0, boat.speed + (swell.surfKt * 0.25) * dt);

    // AI Boost: If wiggle is active, ensure minimum speed to slide off obstacles
    // (ESCAPE too — same escalation off lowSpeedTimer, which is still high
    // when the maneuver starts from a long park.)
    if (!boat.isPlayer && boat.controller && (boat.controller.wiggleActive || boat.controller.escActive)) {
        // Progressive Power: The longer we are stuck, the harder we push
        let minSpeed = 0.15; // 3.5kn
        const stuckTime = boat.controller.lowSpeedTimer;

        if (stuckTime > 10.0) minSpeed = 0.30; // 7.0kn
        if (stuckTime > 20.0) minSpeed = 0.50; // 11.5kn
        if (stuckTime > 30.0) minSpeed = 0.75; // 17.5kn (Increased power)

        if (boat.speed < minSpeed) boat.speed = minSpeed;
    }

    // Irons Penalty (Extra drag when head-to-wind)
    // angleToWind is in radians. 0.5 rad is approx 28 degrees.
    if (angleToWind < 0.5) {
        // Momentum-aware: a slow boat parked head-to-wind gets the full "real
        // brake" (0.994/frame, ~-30%/s — deliberate, for prestart holds and
        // shoots), but a boat CARRYING WAY through a tack coasts on momentum
        // (real keelboats exit a tack at ~70-80% speed, not ~40%). Blend from
        // the full brake at <=3kn up to a light one at >=6kn. Flat 0.994 for
        // everyone measured 59% median tack loss vs ~25% real.
        const PH = (typeof window !== 'undefined' && window.__PHYS) ? window.__PHYS : {};
        const ironsHi = PH.ironsHi != null ? PH.ironsHi : 0.998;
        const bandLo = PH.bandLo != null ? PH.bandLo : 1.5;
        const bandHi = PH.bandHi != null ? PH.bandHi : 4.0;
        const kn = boat.speed * 4;
        const carry = Math.min(1, Math.max(0, (kn - bandLo) / (bandHi - bandLo)));
        const ironsBase = 0.994 + (ironsHi - 0.994) * carry;
        boat.speed *= Math.pow(ironsBase, timeScale);
    }

    // Rudder drag
    if (ctl.left || ctl.right) {
         boat.speed *= Math.pow(CONFIG.turnPenalty, timeScale);
    }

    // Leeway: sailing upwind the keel can't fully resist the side-force, so the boat
    // crabs a few degrees to LEEWARD of where it points. Greatest close-hauled, fades
    // to ~0 by a beam reach and downwind, and less the faster you go. Applied as a
    // course-over-ground offset (heading/sail unchanged) — cheap, believable, and the
    // reason laylines must be sailed a touch high. boat.leeway is exposed so the AI
    // can compensate (aim up-tack) in its layline/VMG planning.
    let cogHeading = boat.heading;
    boat.leeway = 0;
    if (angleToWind < Math.PI * 0.5 && boat.speed > 0.05) {
        const spdK = Math.max(1.5, boat.speed / 0.25);
        const shape = 1.0 - angleToWind / (Math.PI * 0.5);        // 1 head-to-wind -> 0 at beam
        const lwDeg = Math.min(3.0, 3.0 * shape * (localWind.speed / 12) * (12 / (spdK * spdK)));
        const lwSign = Math.sign(normalizeAngle(boat.heading - localWind.direction)) || 1;
        boat.leeway = (lwDeg * Math.PI / 180) * lwSign;
        cogHeading = normalizeAngle(boat.heading + boat.leeway);
    }

    const boatDirX = Math.sin(cogHeading);
    const boatDirY = -Math.cos(cogHeading);
    boat.velocity.x = boatDirX * boat.speed;
    boat.velocity.y = boatDirY * boat.speed;

    // Apply Current (spatial in the river venue, uniform otherwise)
    const boatCurrent = getCurrentAt(boat.x, boat.y);
    if (boatCurrent && boatCurrent.speed > 0.01) {
        // current.speed is Knots. Speed * 4 = Knots. So Speed = Knots / 4.
        const cSpeed = boatCurrent.speed / 4.0;
        const cVx = Math.sin(boatCurrent.direction) * cSpeed;
        const cVy = -Math.cos(boatCurrent.direction) * cSpeed;

        boat.velocity.x += cVx;
        boat.velocity.y += cVy;
    }

    // ORBITAL DRIFT AND THE SET TO LEEWARD. Beside the current and for the same reason: the
    // water itself is moving, so it belongs on the velocity over the ground and must never
    // touch boat.speed — the log reads the same while the sea carries you sideways, which is
    // exactly why being set to leeward upwind is so hard to notice and so expensive.
    // units/second -> units/frame.
    if (swell) {
        boat.velocity.x += swell.driftX / 60;
        boat.velocity.y += swell.driftY / 60;
    }

    const preTideX = boat.x, preTideY = boat.y;
    boat.x += boat.velocity.x * timeScale;
    boat.y += boat.velocity.y * timeScale;
    // AGROUND on the flats: a hull in less than her draft goes back where she was, loses
    // her way, and is shoved downhill until the tide returns. See js/tide.js.
    if (state.tide && window.Tide) Tide.afterMove(boat, preTideX, preTideY, dt);

    // Boundary Check
    if (state.course.riverCorridor) {
        // River arena is the bank corridor, not the circle. Hard-clamp to the
        // bank CENTERLINES: SAT vs the bank polygons handles the fine contact,
        // but a boat that tunnels through overlapping bank islands (SAT push-out
        // can eject deep intruders out the far side) is snapped back to the
        // correct side instead of stranding behind the wall.
        const rc = state.course.riverCorridor;
        const relX = boat.x - rc.cx, relY = boat.y - rc.cy;
        let alongC = relX * rc.ux + relY * rc.uy;
        let latC = relX * rc.rx + relY * rc.ry;
        // Clamp INSIDE the banks' innermost polygon edge (centreline 1550 minus
        // max vertex reach ~390, minus a hull margin). Clamping at the centreline
        // parked boats inside the polygons, where collision push-out and the
        // clamp fought each other and the fleet ground along the wall to DNF.
        const latLim = 1120, alongLim = rc.dist / 2 + 1370;
        let clamped = false;
        if (Math.abs(latC) > latLim) { latC = Math.sign(latC) * latLim; clamped = true; }
        if (Math.abs(alongC) > alongLim) { alongC = Math.sign(alongC) * alongLim; clamped = true; }
        if (clamped) {
            boat.x = rc.cx + rc.ux * alongC + rc.rx * latC;
            boat.y = rc.cy + rc.uy * alongC + rc.ry * latC;
            if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
                window.onRaceEvent('collision_boundary', { boat });
            }
        }
    } else if (state.course.boundary) {
        // Nearest point INSIDE the arena. Must land on the edge rather than merely
        // near it, or the clamp and the collision push-out fight each other — which
        // is how the river banks once ground boats along a wall to DNF.
        const c = Arena.clamp(state.course.boundary, boat.x, boat.y);
        if (c.clamped) {
            const preX = boat.x, preY = boat.y;
            boat.x = c.x; boat.y = c.y;
            if (window.onRaceEvent && state.race.status === 'racing' && !boat.raceState.finished) {
                window.onRaceEvent('collision_boundary', { boat });
            }
            // The wall is a contact like any other. Without this the AI had no
            // reflex at the arena edge at all — the clamp silently killed speed and
            // boats parked on the lee wall for minutes (the wiggle only knows boats
            // and marks). Normal points from boat INTO the wall, like the island's.
            if (boat.ai && !boat.isPlayer) {
                const dxw = preX - c.x, dyw = preY - c.y;
                const dw = Math.hypot(dxw, dyw) || 1;
                boat.ai.collisionData = { type: 'island', normal: { x: dxw / dw, y: dyw / dw }, isWall: true };
            }
        }
    }

    // Race Logic per Boat
    updateBoatRaceState(boat, dt);

    // Store history
    boat.raceState.lastPos.x = boat.x;
    boat.raceState.lastPos.y = boat.y;
    boat.prevHeading = boat.heading;
}

// ── DID ANY PART OF THE BOAT CROSS THIS LINE? ───────────────────────────────
// RRS 28 and the definitions of Start and Finish are all written about the HULL, not about a
// point: "a boat starts when ... any part of her hull crosses the starting line", and she
// finishes when any part of her hull crosses the finishing line. This used to sweep the
// boat's CENTRE, so a bow over the line was not over the line — you finished roughly half a
// boat-length late, and could sit with the bow past the start without being OCS.
//
// The event is the LEADING EDGE changing sides, not "some vertex touched the line". A
// 55-unit boat straddles a line for many frames and during all of them some vertex is
// sweeping across it, so a touch test fires every frame of the passage — on a gate sailed
// through twice that advanced two legs in one pass (test_gates caught it: "sailing back DOWN
// through the same gate completes leg 2" reported leg 4).
//
// So: track the hull's extreme signed offset either way. `max` turning positive is the first
// moment any part of the boat reaches the far side; `min` turning negative is the same going
// back. Each happens exactly once per passage, whatever the hull does in between — and
// unlike a straddle-lockout it still works for the gate EXTENSIONS, which are collinear with
// the gate itself and would otherwise be suppressed for the whole rounding.
//
// The segment test then confirms the crossing happened BETWEEN the marks rather than around
// an end, which is the distinction the extensions exist to make.
function hullCrossedLine(boat, ax, ay, bx, by) {
    // The previous hull is the current one TRANSLATED back to `lastPos`, not rebuilt from a
    // stored previous heading. A hull is rigid and a boat turns a degree or two per frame, so
    // the swept shape is the same either way — and this depends on one piece of history
    // (`lastPos`) instead of two. `prevHeading` is only maintained by updateBoat, so anything
    // driving updateBoatRaceState directly carried a stale one; that silently mis-rotated the
    // previous hull and lost the second crossing of a reused gate.
    const rs = boat.raceState;
    const cur = hullPolygonAt(boat.x, boat.y, boat.heading);
    const ex = bx - ax, ey = by - ay;
    let minC = Infinity, maxC = -Infinity, iMin = 0, iMax = 0;
    for (let i = 0; i < cur.length; i++) {
        const sc = (cur[i].x - ax) * ey - (cur[i].y - ay) * ex;
        if (sc < minC) { minC = sc; iMin = i; }
        if (sc > maxC) { maxC = sc; iMax = i; }
    }
    // ⚠️ EXACT HANDOFF: the previous frame's extremes are CACHED, not reconstructed.
    // The old form rebuilt the previous hull as "current hull translated to lastPos"
    // — same heading — and the comment above argued a boat turns too little per frame
    // for that to matter. Measured on river seed 9402 ('Petal', the zero-contact DNF):
    // it matters exactly once per race, at the only moment that counts. Crossing the
    // start line at a shallow angle WHILE TURNING, the hull gains ~1.2u of signed
    // offset per frame while the rotation shifts the reconstructed boundary by
    // ~0.2-0.3u per frame — so at the first frame the true minimum went negative, the
    // reconstructed previous minimum read -0.2 instead of +0.04, both sides of the
    // leading-edge test were already negative, and the crossing fell into the crack.
    // After that the hull straddles the line and the test can never fire for the rest
    // of the passage: she sailed the whole race on leg 0, orbiting her aim point.
    // Caching last frame's extremes per line makes yesterday's `cur` literally
    // today's `prev` — a sign transition cannot be missed by construction.
    // The cache lives on raceState (rebuilt every reset) keyed by the line's
    // endpoints, so a moved mark starts a fresh entry rather than inheriting one.
    // ⚠️ Stamped with the world clock and honoured only when CONTINUOUS: a leg
    // change stops this line being tested, and an entry left over from the last
    // visit would compare today's position against a week-old hull and fire a
    // phantom crossing the moment a reused gate comes back into play. An entry
    // older than ~2 frames means the watch lapsed — reconstruct, as on first sight.
    const key = (ax | 0) + ':' + (ay | 0) + ':' + (bx | 0) + ':' + (by | 0);
    if (!rs._lineExtremes) rs._lineExtremes = {};
    const prevE = rs._lineExtremes[key];
    const contiguous = prevE && (state.time - prevE.t) < (WORLD_CLOCK / 60) * 2.5;
    rs._lineExtremes[key] = { min: minC, max: maxC, t: state.time };
    let minP, maxP;
    let prevHull = null;
    if (contiguous) {
        minP = prevE.min; maxP = prevE.max;
    } else {
        // First sight of this line: reconstruct, as before.
        prevHull = hullPolygonAt(rs.lastPos.x, rs.lastPos.y, boat.heading);
        minP = Infinity; maxP = -Infinity;
        for (let i = 0; i < prevHull.length; i++) {
            const sp = (prevHull[i].x - ax) * ey - (prevHull[i].y - ay) * ex;
            if (sp < minP) minP = sp;
            if (sp > maxP) maxP = sp;
        }
    }
    const upFire = maxP <= 0 && maxC > 0;
    const downFire = minP >= 0 && minC < 0;
    if (!(upFire || downFire)) return false;
    // BETWEEN THE MARKS, not around an end — same distinction as before, but read
    // off the LEADING VERTEX itself rather than by sweeping the reconstructed
    // previous hull. At the transition frame the reconstruction can already sit
    // on the far side (that is the crack fixed above), so its vertex sweeps do
    // not intersect the line and the old confirmation vetoed the very crossing
    // the leading-edge test had just found. The leading vertex is ON the line to
    // within a frame of travel at the moment this fires, so its along-line
    // parameter IS where the hull is crossing; a small margin covers the frame
    // of travel past an end.
    // Any vertex ON THE NEW SIDE this frame confirms if it projects into the
    // segment — at the transition frame the far-side vertices sit within one
    // frame of travel of the line, so where they project is where the hull is
    // crossing. Testing all of them (not only the extreme) keeps the crossing
    // right at a pin end, where the leading corner can hang just outside the
    // mark while the rest of the bow crosses inside it.
    const len2 = ex * ex + ey * ey;
    if (len2 < 1e-9) return false;
    for (let i = 0; i < cur.length; i++) {
        const sc = (cur[i].x - ax) * ey - (cur[i].y - ay) * ex;
        if (downFire ? sc < 0 : sc > 0) {
            const u = ((cur[i].x - ax) * ex + (cur[i].y - ay) * ey) / len2;
            if (u >= -0.02 && u <= 1.02) return true;
        }
    }
    return false;
}

function updateBoatRaceState(boat, dt) {
    // Timers
    if (boat.raceState.startTimeDisplayTimer > 0) boat.raceState.startTimeDisplayTimer -= dt;
    // One touch of auto trim makes this an auto-board run — sampled here because the
    // Tab toggle can flip mid-race and only a per-frame check catches every regime.
    if (boat.isPlayer && !boat.manualTrim) boat.raceState.usedAutoTrim = true;
    if (boat.raceState.legSplitTimer > 0) boat.raceState.legSplitTimer -= dt;

    // Waypoint
    const marks = state.course.marks;
    // Guarded on >= 2, not >= 4. Requiring four marks meant a course with only a
    // line and a rounding skipped this block entirely — which silently stopped
    // resetting raceState.inZone each frame, leaving a stale value feeding the
    // mark-room rules.
    if (marks && marks.length >= 2) {
        // Third enumerated selector found in this file (`leg === 0 || leg === 2
        // || leg === 4`), with the same off-by-a-course-length bug as the other
        // two: legs 6, 8 and 10 fell through to the windward gate while sailing
        // downwind.
        const indices = legMarks(boat.raceState.leg);
        if (indices) {
            const m1 = marks[indices[0]], m2 = marks[indices[1]];
            const closest = getClosestPointOnSegment(boat.x, boat.y, m1.x, m1.y, m2.x, m2.y);
            const dx = closest.x - boat.x, dy = closest.y - boat.y;
            boat.raceState.nextWaypoint = {
                x: closest.x, y: closest.y,
                dist: Math.sqrt(dx*dx + dy*dy) * 0.2,
                angle: Math.atan2(dx, -dy)
            };
        }

        // Zone Check
        let inZone = false;
        let zoneMarks = [];
        // No zones on Start (0) or Finish (totalLegs)
        if (boat.raceState.leg > 0 && boat.raceState.leg < state.race.totalLegs) {
            zoneMarks = legMarks(boat.raceState.leg) || [];
        }

        for (const idx of zoneMarks) {
             const m = marks[idx];
             const d2 = (boat.x - m.x)**2 + (boat.y - m.y)**2;
             if (d2 < 165*165) {
                 inZone = true;
                 break;
             }
        }

        if (inZone && !boat.raceState.inZone) {
            boat.raceState.inZone = true;
            boat.raceState.zoneEnterTime = state.time;
        } else if (!inZone) {
            boat.raceState.inZone = false;
        }
    }

    // Position-based OCS clearing (anti-deadlock).
    // OCS normally clears only by crossing the start *segment* downward. A boat
    // that is over early and returns to the pre-start side by passing around the
    // end of the line (outside the marks) would otherwise keep OCS set forever,
    // get trapped by the AI's OCS-recovery navigation (which keeps it behind the
    // line), and never start — a DNS. The Racing Rules treat a boat as no longer
    // on the course side once it is fully behind the line, so clear OCS whenever
    // a still-to-start boat is clearly on the pre-start side, however it got there.
    if (state.race.status === 'racing' && boat.raceState.leg === 0 && boat.raceState.ocs &&
        marks && marks.length >= 2) {
        const [m0, m1] = startLinePts();
        const lineDx = m1.x - m0.x, lineDy = m1.y - m0.y;
        const lineLen = Math.hypot(lineDx, lineDy) || 1;
        // Signed perpendicular distance to the line: positive = course side (OCS) — on the ROUTE'S
        // OWN direction (startCrossSign, as hullLineOffset reads it). Unsigned, a line authored
        // `dir: -1` (swamp, river, ocean, flats) was read inside out: a boat that dipped 140u back
        // below it stayed OCS for good and looped in recovery, never starting, while one sailing
        // on 40u over the line was quietly cleared (start bench, Oct 4 2026).
        const perpDist = startCrossSign() * ((boat.x - m0.x) * lineDy - (boat.y - m0.y) * lineDx) / lineLen;
        if (perpDist < -40) {
            boat.raceState.ocs = false;
            if (boat.isPlayer) hideRaceMessage();
        }
    }

    // Island course waypoint: the HUD arrow and distance should point at the
    // mountain while outbound and at the finish line coming home. The gate-based
    // block above targets the unused windward gate, so override it here.
    if (state.course.type === 'islandRound' && state.course.roundMark && marks && marks.length >= 2) {
        const rs0 = boat.raceState;
        const e0 = routeLeg(Math.min(rs0.leg, state.race.totalLegs));
        let tx, ty;
        if (rs0.leg <= 1) {
            // Outbound: the first rounding, even before the gun — Glacier Sound's
            // mountain, the first can at Lighthouse Cove.
            const rm0 = (e0 && e0.kind === 'round' && e0.mark) ? e0.mark : state.course.roundMark;
            tx = rm0.x; ty = rm0.y;
        } else if (e0 && e0.kind === 'round' && e0.mark) {
            // Any later rounding: THIS leg's mark. `roundMark` is only the first one,
            // and the old start-line fallback pointed a five-rounding course home
            // from leg 2 onward.
            tx = e0.mark.x; ty = e0.mark.y;
        } else {
            // A line or gate leg: the leg's own line — which on Lighthouse Cove is a
            // finish line that is NOT the start line.
            const lm = (e0 && e0.marks) ? e0.marks : startLineMarks();
            const l0 = marks[lm[0]], l1 = marks[lm[1]];
            const c = getClosestPointOnSegment(boat.x, boat.y, l0.x, l0.y, l1.x, l1.y);
            tx = c.x; ty = c.y;
        }
        const wdx = tx - boat.x, wdy = ty - boat.y;
        rs0.nextWaypoint = {
            x: tx, y: ty,
            dist: Math.sqrt(wdx * wdx + wdy * wdy) * 0.2,
            angle: Math.atan2(wdx, -wdy)
        };
    }


    // ─── LEG PROGRESSION ────────────────────────────────────────────────────
    // ONE walker over the route. Each entry says how its leg ends:
    //
    //   kind 'line',  role 'start'  — cross once in `dir` (and OCS before the gun)
    //   kind 'line',  finish        — cross once in `dir`
    //   kind 'gate'                 — cross in, then back out past an end
    //   kind 'round'                — sweep ~180 degrees about a mark, correct side
    //
    // Gates and island roundings used to be two hardcoded course types. A gate leg
    // is ALREADY a rounding (cross in, leave round an end), so the only genuinely
    // new primitive here is the swept-angle test — which is why one walker can now
    // race a route mixing lines, gates and roundings in any order.
    const _entry = routeLeg(boat.raceState.leg);

    // Shared, so a rounding and a gate cannot drift apart in what they record. The
    // two old branches each had their own copy and already disagreed: the island
    // course pushed a leg split unconditionally and emitted no `leg_complete` at the
    // finish; the W/L path did the opposite.
    const advanceLeg = () => {
        const rs = boat.raceState;
        // The place you were in as you got here, for the results splits. Read BEFORE the
        // leg advances: a boat one leg further along outranks the whole fleet by
        // definition, and the boat rounding this mark is about to become that boat.
        const rankHere = boat.isPlayer ? fleetRank(boat) : 0;
        // CLOSE RACING (Popper's 'The Circle'): a mark rounded — or a gate gone through — more than a boat length off
        // the nearest mark. Not the finish. An event only, no state.
        if (boat.isPlayer && state.race.status === 'racing' && rs.leg < state.race.totalLegs && _entry && typeof GameEvents !== 'undefined') {
            const idx = _entry.marks || (_entry.mark && _entry.mark.markIdx != null ? [_entry.mark.markIdx] : []);
            let d = 1e9; for (const i of idx) { const m = marks[i]; if (m) d = Math.min(d, Math.hypot(boat.x - m.x, boat.y - m.y) - (m.bodyR || 12)); }
            if (idx.length) GameEvents.emit('player-feat', { id: d > 55 ? 'close:wide' : 'close:tight', value: Math.round(d) });
        }
        rs.leg++;
        if (window.onRaceEvent) window.onRaceEvent('leg_complete', { boat, leg: rs.leg - 1, time: state.race.timer });
        rs.isRounding = false;
        rs.roundSweep = 0;
        rs.roundWrong = 0;
        rs.roundArmed = false;
        rs.roundBanked = false;
        rs.roundRebased = false; rs._rlMark = null;
        rs.roundEntryB = null;
        rs.roundFrom = { x: boat.x, y: boat.y };
        rs._wrongRound = false;
        const split = state.race.timer - rs.legStartTime;
        rs.lastLegDuration = split;
        if (rs.leg > 1) {
            rs.legTimes.push(split);
            if (boat.isPlayer) {
                rs.legRanks.push(rankHere);
                // Leg records commit as they happen — and say so, mid-race.
                const li = rs.legTimes.length - 1;
                const beaten = commitLegRecord(runTrimBoard(rs), li, split);
                if (beaten !== false) (state.race.legRecordsSet = state.race.legRecordsSet || []).push(li);
                // the split card (PT-008): every leg, a record in gold — UI only, no state
                if (typeof announceLegSplit === 'function') announceLegSplit(rs, li, split, beaten);
            }
        }
        rs.legSplitTimer = 5.0;
        rs.legStartTime = state.race.timer;

        if (rs.leg > state.race.totalLegs) {
            rs.finished = true;
            rs.finishTime = state.race.timer;
            // Un-taken penalty turns convert to time at the finish.
            if (rs.penalty) rs.finishTime += 15 * Math.max(1, rs.penaltyTurnsOwed);
            if (window.onRaceEvent) window.onRaceEvent('finish', { boat, time: rs.finishTime });
            // Was hardcoded `leg: 4`, which is wrong on any course that is not four
            // legs. The trace's leg field is cosmetic, so this is unobserved by the
            // golden traces — noted rather than relied upon.
            rs.trace.push({ x: boat.x, y: boat.y, leg: rs.leg });
            // PHOTO FINISH (Pulse): the nearest boat still racing is within a boat length (55 u) of the line as you cross
            if (boat.isPlayer && typeof GameEvents !== 'undefined' && _entry && _entry.marks && _entry.marks.length === 2) {
                const a = marks[_entry.marks[0]], b2 = marks[_entry.marks[1]], L = Math.hypot(b2.x - a.x, b2.y - a.y) || 1;
                let gap = 1e9; for (const o of state.boats) { if (o === boat || o.raceState.finished || o.raceState.leg !== state.race.totalLegs) continue;
                    gap = Math.min(gap, Math.abs((o.x - a.x) * (b2.y - a.y) - (o.y - a.y) * (b2.x - a.x)) / L); }
                if (gap <= 55) GameEvents.emit('player-feat', { id: 'close:photo', value: Math.round(gap) });
            }
            if (boat.isPlayer) {
                // The record book closes at the line: track record, top speed,
                // shortest track and quickest start all commit here, and the course
                // record announces itself over the finish banner.
                const rr = finalizeRaceRecords(boat);
                state.race.recordResults = rr;
                if (rr.track) showToast(`✦ COURSE RECORD — ${formatBestTime(rs.finishTime)}`);
                showRaceMessage("FINISHED!", "text-green-400", "border-green-400/50");
                Sound.playFinish();
                // In a time trial the confetti is for beating your ghost, not for finishing alone.
                const trialMiss = window.TimeTrial && TimeTrial.solo() && TimeTrial.ghostTime() != null && rs.finishTime >= TimeTrial.ghostTime();
                if (window.confetti && !trialMiss) window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            } else {
                Sayings.queueQuote(boat, "finished_race");
            }
        } else if (boat.isPlayer) {
            Sound.playGateClear();
            Sound.updateMusic();
        } else {
            Sayings.queueQuote(boat, "rounded_mark");
        }
    };

    // ROUNDING leg: swept bearing angle about a mark, not a line crossing.
    //
    // Sign convention, derived rather than guessed. Heading h gives forward
    // (sin h, -cos h) on this y-down canvas, so starboard is (cos h, sin h). Mark to
    // starboard means r.(cos h, sin h) < 0 for r = P-C, and the bearing rate is
    // (r x v)/|r|^2 with r x v = -(rx cos h + ry sin h) > 0. So LEAVING THE MARK TO
    // STARBOARD MEANS THE BEARING ANGLE INCREASES — accumulate positive, and flip
    // the sign for a port rounding.
    if (_entry && _entry.kind === 'round' && _entry.mark
        && state.race.status === 'racing' && !boat.raceState.finished) {
        const rs = boat.raceState;
        const rm = _entry.mark;
        const nextA = (typeof CoursePath !== 'undefined' && state.course.route)
            ? CoursePath.anchor(state.course.route[rs.leg + 1], state.course.marks) : null;
        const res = roundingStep(boat, rs, rm, nextA);
        if (res.wrong && boat.isPlayer) {
            showRaceMessage(`WRONG WAY ROUND — LEAVE IT TO ${String(rm.side).toUpperCase()}`,
                            "text-orange-500", "border-orange-500/50");
            setTimeout(hideRaceMessage, 2500);
        }
        if (res.done) advanceLeg();
    }

    // CROSSING legs: lines and gates. Guarded on >= 2 marks, not >= 4 — a course
    // with one line and a rounding has exactly two.
    if (marks && marks.length >= 2) {
        // Which gate this leg is sailed TO, and which way it must be crossed.
        // From the route table rather than leg parity, so a course that is not a
        // windward-leeward can express itself.
        let gateIndices = [];
        let requiredDirection = 1;
        const legEntry = _entry;

        if (boat.raceState.leg <= state.race.totalLegs && legEntry && legEntry.marks) {
            gateIndices = legEntry.marks;
            requiredDirection = legEntry.dir;
        }

        if (gateIndices.length > 0) {
            const m1 = marks[gateIndices[0]], m2 = marks[gateIndices[1]];
            // ANY PART OF THE HULL, not the centre — see hullCrossedLine.
            const intersect = hullCrossedLine(boat, m1.x, m1.y, m2.x, m2.y);

            if (intersect) {
                const gateDx = m2.x - m1.x, gateDy = m2.y - m1.y;
                const nx = gateDy, ny = -gateDx;
                const moveDx = boat.x - boat.raceState.lastPos.x, moveDy = boat.y - boat.raceState.lastPos.y;
                const dot = moveDx * nx + moveDy * ny;
                const crossingDir = dot > 0 ? 1 : -1;

                if (state.race.status === 'prestart') {
                    // The start line, identified by its route role rather than by
                    // being "the pair that happens to begin at index 0".
                    if (legEntry && legEntry.role === 'start') {
                        // ⚠️ AGAINST THE ROUTE'S OWN DIRECTION, not against +1. The racing
                        // branch below already compares `crossingDir === requiredDirection`;
                        // this one hardcoded the sign, so on a line authored `dir: -1` the
                        // test was INVERTED — a boat crossing to the course side was
                        // cleared, and a boat correctly returning was flagged OCS.
                        if (crossingDir === requiredDirection) {
                            boat.raceState.ocs = true;
                            if (boat.isPlayer) showRaceMessage("OVER EARLY - RETURN TO PRE-START!", "text-red-500", "border-red-500/50");
                        } else {
                            boat.raceState.ocs = false;
                            if (boat.isPlayer) hideRaceMessage();
                        }
                    }
                } else if (state.race.status === 'racing' && !boat.raceState.finished) {
                    if (legEntry.role === 'start') {
                        if (crossingDir === requiredDirection) {
                            if (!boat.raceState.ocs) {
                                // Where the start put you, for the results splits — read
                                // BEFORE the leg advances, or you outrank the whole fleet
                                // by virtue of being the one boat already on leg 1.
                                if (boat.isPlayer) boat.raceState.startRank = fleetRank(boat);
                                // first of the whole fleet across (Clutch's 'Line Boss') — an event only, no state
                                if (boat.isPlayer && !state.boats.some(b => b !== boat && b.raceState.leg > 0) && typeof GameEvents !== 'undefined') GameEvents.emit('player-feat', { id: 'start:first' });
                                boat.raceState.leg++;
                                boat.raceState.roundSweep = 0;
                                boat.raceState.roundWrong = 0;
                                boat.raceState.roundArmed = false;
                                boat.raceState.roundBanked = false;
                                boat.raceState.roundRebased = false; boat.raceState._rlMark = null;
                                boat.raceState.roundEntryB = null;
                                boat.raceState.roundFrom = { x: boat.x, y: boat.y };
                                if (window.onRaceEvent) window.onRaceEvent('leg_complete', { boat, leg: 0, time: state.race.timer });
                                if (boat.isPlayer) {
                                    Sound.playGateClear();
                                    Sound.updateMusic();
                                } else {
                                    const othersStarted = state.boats.some(b => b !== boat && b.raceState.leg > 0);
                                    if (!othersStarted) Sayings.queueQuote(boat, "first_across_start");
                                }
                                boat.raceState.startTimeDisplay = state.race.timer;
                                boat.raceState.startTimeDisplayTimer = 5.0;
                                boat.raceState.startLegDuration = state.race.timer;
                                boat.raceState.legStartTime = state.race.timer;
                            }
                        } else {
                            boat.raceState.ocs = false;
                            if (boat.isPlayer) hideRaceMessage();
                        }
                    } else {
                        // Normal Legs

                        // A gate is either sailed THROUGH (crossing it completes the
                        // leg, like a finish line) or ROUNDED (cross in, then leave
                        // round an end). Absent `pass` means round, which is what a
                        // windward-leeward gate has always done.
                        if (legEntry.finish || legEntry.pass === 'through') {
                            if (crossingDir === requiredDirection) advanceLeg();
                            else if (boat.isPlayer) { showRaceMessage("WRONG WAY!", "text-orange-500", "border-orange-500/50"); setTimeout(hideRaceMessage, 2000); }
                        } else {
                            if (!boat.raceState.isRounding) {
                                if (crossingDir === requiredDirection) boat.raceState.isRounding = true;
                                else if (boat.isPlayer) { showRaceMessage("WRONG WAY!", "text-orange-500", "border-orange-500/50"); setTimeout(hideRaceMessage, 2000); }
                            } else {
                                if (crossingDir === -requiredDirection) {
                                    boat.raceState.isRounding = false;
                                    if (boat.isPlayer) { showRaceMessage("ROUNDING ABORTED", "text-orange-500", "border-orange-500/50"); setTimeout(hideRaceMessage, 2000); }
                                }
                            }
                        }
                    }
                }
            }

            // Extensions Logic
            if (boat.raceState.isRounding && state.race.status === 'racing') {

                const gDx = m2.x - m1.x, gDy = m2.y - m1.y;
                const len = Math.sqrt(gDx*gDx + gDy*gDy);
                const ux = gDx / len, uy = gDy / len;
                const nx = gDy, ny = -gDx; // Upwind normal
                const extLen = 10000;

                // ⚠️ THE CENTRE, deliberately, unlike the gate line itself.
                //
                // An extension is not a line you cross in the rules sense — it is a
                // geometric side-test asking "did she leave round the OUTSIDE of this mark",
                // and the boat's answer to that is one point, not a shape. Rounding a gate
                // mark close aboard swings 55 units of hull across the extension while the
                // boat is still very much on the mark, so the hull test completed the leg
                // early; the AI then turned onto the next leg from alongside the buoy and
                // hit it. Rule 31 touches went 3 -> 22 on Bluewater and 6 -> 37 on
                // Stillwater before this was put back.
                const checkExt = (ax, ay, bx, by) => {
                    if (checkLineIntersection(boat.raceState.lastPos.x, boat.raceState.lastPos.y,
                                              boat.x, boat.y, ax, ay, bx, by)) {
                        const moveDx = boat.x - boat.raceState.lastPos.x, moveDy = boat.y - boat.raceState.lastPos.y;
                        return (moveDx * nx + moveDy * ny > 0) ? 1 : -1;
                    }
                    return 0;
                };

                const dirL = checkExt(m1.x, m1.y, m1.x - ux * extLen, m1.y - uy * extLen);
                const dirR = checkExt(m2.x, m2.y, m2.x + ux * extLen, m2.y + uy * extLen);
                if (dirL === -requiredDirection || dirR === -requiredDirection) advanceLeg();
            }
        }
    }

    // Trace
    if (boat.raceState.leg >= 1 && !boat.raceState.finished) {
        const trace = boat.raceState.trace;
        if (trace.length === 0) trace.push({ x: boat.x, y: boat.y, leg: boat.raceState.leg });
        else {
            const last = trace[trace.length - 1];
            if ((boat.x - last.x)**2 + (boat.y - last.y)**2 > 2500) trace.push({ x: boat.x, y: boat.y, leg: boat.raceState.leg });
        }
    }

    // One-Turn Penalty: accumulate net signed rotation while flagged; a full
    // 360° (net, so a wobble unwinds) clears one owed turn. Direction is the
    // sailor's choice — RRS asks for a tack and a gybe, and any net full
    // rotation includes both.
    if (boat.raceState.penalty && state.race.status === 'racing') {
        const rs = boat.raceState;
        rs.penaltyFlagTime += dt;
        if (rs.penaltyLastHeading == null) rs.penaltyLastHeading = boat.heading;
        // Decay credit toward zero (~7°/s) so ordinary sailing — alternating
        // tacks, one-off mark roundings (~180° bursts that fade before the
        // next) — can't passively clear the turn. A committed spiral
        // (~30-50°/s) out-rotates the decay easily; extending a mark rounding
        // into a full circle (the classic "penalty at the offset") works too.
        const decay = 0.12 * dt;
        if (Math.abs(rs.penaltyRot) > decay) rs.penaltyRot -= Math.sign(rs.penaltyRot) * decay;
        else rs.penaltyRot = 0;
        rs.penaltyRot += normalizeAngle(boat.heading - rs.penaltyLastHeading);
        rs.penaltyLastHeading = boat.heading;

        if (Math.abs(rs.penaltyRot) >= Math.PI * 2) {
            rs.penaltyTurnsOwed--;
            // A turn actually sailed — achievements count it (Wiggle). An event, not a
            // raceState field: every raceState primitive is in the golden traces' hash.
            if (boat.isPlayer) GameEvents.emit('player-penalty-served');
            rs.penaltyRot = 0;
            if (rs.penaltyTurnsOwed <= 0) {
                rs.penalty = false;
                rs.penaltyTurnsOwed = 0;
                rs.penaltyLastHeading = null;
                if (boat.isPlayer) {
                    showRaceMessage("PENALTY CLEARED!", "text-green-400", "border-green-400/50");
                    setTimeout(hideRaceMessage, 2000);
                }
            }
        } else if (boat.isPlayer) {
            const remaining = Math.ceil((Math.PI * 2 - Math.abs(rs.penaltyRot)) * 180 / Math.PI);
            const why = boat._penaltyWhy ? ` (${boat._penaltyWhy})` : '';
            showRaceMessage(`PENALTY${why}! TURN ${remaining}° MORE TO CLEAR (or +15s at finish)`, "text-red-500", "border-red-500/50");
        }
    }

    // Maneuvers Stats
    const relWindAngle = normalizeAngle(state.wind.direction - boat.heading);
    const currentWindSide = Math.sign(relWindAngle);
    if (boat.lastWindSide === undefined) boat.lastWindSide = currentWindSide;
    if (currentWindSide !== 0) {
        if (boat.lastWindSide !== 0 && currentWindSide !== boat.lastWindSide) {
             if (state.race.status === 'racing' && boat.raceState.leg >= 0 && boat.raceState.leg <= state.race.totalLegs) {
                 boat.raceState.legManeuvers[boat.raceState.leg]++;
             }
        }
        boat.lastWindSide = currentWindSide;
    }

    // Stats
    if (state.race.status === 'racing' && boat.raceState.leg <= state.race.totalLegs) {
        // Distance Calculation:
        // Use visual scale: 1 unit = 0.2 meters.
        // Distance = Speed (units/s) * dt * 0.2
        // boat.speed is units per frame (at 60fps). Speed/s = boat.speed * 60.
        // Distance = boat.speed * 60 * dt * 0.2 = boat.speed * 12.0 * dt.
        const distMoved = boat.speed * 12.0 * dt;
        const kn = boat.speed * 4;
        boat.raceState.legDistances[boat.raceState.leg] += distMoved;
        boat.raceState.legSpeedSums[boat.raceState.leg] += kn * dt;
        if (kn > boat.raceState.legTopSpeeds[boat.raceState.leg]) boat.raceState.legTopSpeeds[boat.raceState.leg] = kn;
    }
}

// ── REMAINING COURSE, CONTINUOUS THROUGH EVERY LEG CHANGE (PT-006) ──────────
// The leaderboard read `this goal's field + the later legs' lengths` and sorted by leg first. A
// boat that had passed a mark or gone through a gate kept measuring to it until the engine
// credited the leg — outside the zone, moving away — so her progress slid BACKWARDS as she
// sailed on, then leapt forward at the credit (measured headless, 3 races: 11-140 leaps of
// 200u+ per venue at leg changes, hundreds of backward slides; Clubhouse Point's gates 102
// place swaps a minute, 74 of them reversed within 10 s). Two changes make it one number:
//   * the next leg is priced from where THIS boat will meet the goal — the mark, or her nearest
//     point on the line — not from the goal's centre, so "this leg + the rest" and "the next
//     leg + the rest" agree at the goal;
//   * across a rounding the two readings blend by how far round she is (the engine's own sweep
//     against the requirement), and through a gate they hand over when she is in it
//     (isRounding), so the reading never waits on the credit (PT-081's late credit included).
// Leg 0 is the same: distance to her point on the start line plus leg 1 from there, so there
// is no jump at the gun. A pure read — nothing in the sim or the AI consumes it.
function courseRemaining(GR, boat) {
    const rs = boat.raceState, route = state.course.route, marks = state.course.marks;
    const n = GR.legs.length;
    if (!GR.rankable || !route) return window.GoalField.remaining(GR, rs.leg, boat.x, boat.y, rs);
    const field = (L, x, y) => {
        const F = GR.legs[L]; if (!F) return null;
        const r = window.GoalField.lookup(F, x, y);
        return r ? r.dist : (F.goal ? Math.hypot(F.goal.x - x, F.goal.y - y) : null);
    };
    const restFrom = (L) => { let s = 0; for (let k = L; k < n; k++) s += GR.legLen[k] || 0; return s; };
    // where a boat at (x, y) meets goal L: the mark, or her nearest point on the line
    const meet = (L, x, y) => {
        const e = route[L]; if (!e) return null;
        if (e.kind === 'round' && e.mark) return { x: e.mark.x, y: e.mark.y };
        if (e.marks && marks) {
            const a = marks[e.marks[0]], b = marks[e.marks[1]]; if (!a || !b) return null;
            const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
            const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
            return { x: a.x + dx * t, y: a.y + dy * t };
        }
        return null;
    };
    // this leg, then the next from where she meets this goal
    const via = (L, x, y, dHere) => {
        if (dHere == null) return null;
        if (L + 1 >= n) return dHere;
        const m = meet(L, x, y); const dNext = m && GR.legs[L + 1] ? window.GoalField.lookupNear(GR.legs[L + 1], m.x, m.y) : null;
        return dNext == null ? dHere + restFrom(L + 1) : dHere + dNext + restFrom(L + 2);
    };
    const L = rs.leg;
    if (L === 0) {
        if (n < 2) return null;
        const m = meet(0, boat.x, boat.y); if (!m) return null;
        const d1 = GR.legs[1] ? window.GoalField.lookupNear(GR.legs[1], m.x, m.y) : null; if (d1 == null) return null;
        return Math.hypot(boat.x - m.x, boat.y - m.y) + d1 + restFrom(2);
    }
    if (L >= n) return 0;
    const A = via(L, boat.x, boat.y, field(L, boat.x, boat.y));
    if (A == null) return window.GoalField.remaining(GR, L, boat.x, boat.y, rs);
    if (L + 1 >= n) return A;
    const e = route[L];
    let w = 0;
    if (e.kind === 'round' && e.mark && rs.roundRebased && e.mark.reqSweep > 0) {
        w = Math.max(0, Math.min(1, (rs.roundSweep || 0) / e.mark.reqSweep));
    } else if (e.marks && !e.finish && e.pass !== 'through' && rs.isRounding) {
        w = 1;
    }
    if (w <= 0) return A;
    const dB = field(L + 1, boat.x, boat.y);
    if (dB == null) return A;
    const B = dB + restFrom(L + 2);
    return (1 - w) * A + w * B;
}

// The rounding/gate state a ranking needs, for something that is NOT a raced boat — the Time
// Trial ghost, a replayed trajectory — so courseRemaining can blend it exactly as it blends a boat
// in the race. Feed it positions in order; it keeps `rs` the way the engine keeps raceState.
function trackRankState(rs, x, y, heading, leg) {
    const route = state.course && state.course.route, marks = state.course && state.course.marks;
    if (rs.leg !== leg || !rs.lastPos) {
        rs.roundSweep = 0; rs.roundWrong = 0; rs.roundArmed = false; rs.roundBanked = false; rs.roundRebased = false; rs._rlMark = null;
        rs.roundEntryB = null; rs.roundFrom = { x, y }; rs.isRounding = false; rs._wrongRound = false;
        rs.leg = leg; rs.lastPos = { x, y };
    }
    const e = route && route[leg];
    if (leg >= 1 && e && e.kind === 'round' && e.mark && typeof CoursePath !== 'undefined') {
        roundingStep({ x, y, heading }, rs, e.mark, CoursePath.anchor(route[leg + 1], marks));
    } else if (leg >= 1 && e && e.marks && marks && !rs.isRounding) {
        const a = marks[e.marks[0]], c = marks[e.marks[1]];
        if (a && c) {
            const side = (px, py) => (px - a.x) * (c.y - a.y) - (py - a.y) * (c.x - a.x);
            if (side(rs.lastPos.x, rs.lastPos.y) * side(x, y) < 0) {
                const t = ((x - a.x) * (c.x - a.x) + (y - a.y) * (c.y - a.y)) / ((c.x - a.x) ** 2 + (c.y - a.y) ** 2 || 1);
                if (t >= 0 && t <= 1) rs.isRounding = true;
            }
        }
    }
    rs.lastPos = { x, y };
}

// Collision Helpers
function getBoatProgress(boat) {
    const rs = boat.raceState;
    const dmc = state.course && state.course.dmc;

    const GF = state.course && state.course.goalFields;
    if (rs.finished) {
        // Finished boats rank by TIME, above everyone still racing. Kept as one comparable
        // scalar so the sort has a single key.
        const total = (GF && GF.rankable) ? GF.total : dmc ? dmc.total : (courseAxis() ? courseAxis().len * state.race.totalLegs : 1);
        return total + (1000000 - rs.finishTime);
    }

    if (!dmc || !dmc.legs.length) return legacyBoatProgress(boat);

    const leg = Math.max(0, Math.min(rs.leg, dmc.legs.length - 1));

    // Before the start there is no path yet — the fleet is milling about behind the line and
    // the leg-0 entry is the line itself, not a course to sail. Rank by closeness to it, so
    // the number is continuous through the gun (it reaches ~0 as the line is crossed, which
    // is where leg 1's path begins).
    if (rs.leg === 0) {
        // ...in the goal fields' units where there are some (courseRemaining's leg 0), so the
        // reading runs straight on through the gun instead of jumping from one scale to another.
        const GR0 = (state.course && state.course.goalFieldsRank) || GF;
        if (GR0 && GR0.rankable && window.GoalField) {
            const rem0 = courseRemaining(GR0, boat);
            if (rem0 != null) return GR0.total - rem0;
        }
        const m = legMid(0);
        return m ? -Math.hypot(boat.x - m.x, boat.y - m.y) : 0;
    }

    // THE GOAL FIELDS (Sep 14 2026): remaining = the current goal's field read at the boat plus the
    // later legs' lengths; progress = the course total minus that. Geodesic round the land and, under
    // the cone metric, priced as sailing distance, so equal upwind progress reads equal on a beat —
    // see js/sim/goalfield.js. The ruler projection below stays as the fallback for a boat off the
    // field, and for a course without one (a light build, a scenario).
    // On a tidal venue the RANKING field is the one over all the water (a boat halfway across
    // the wantij is ahead, not "behind" as it would read on the channel-only field the path
    // line uses) — see buildCoursePaths.
    const GR = (state.course && state.course.goalFieldsRank) || GF;
    if (GR && window.GoalField) {
        const rem = courseRemaining(GR, boat);
        if (rem != null) return GR.total - rem;
    }

    const path = dmc.legs[leg];
    if (!path || !path.pts.length) return legacyBoatProgress(boat);
    // The reading continues from this boat's last one — see CoursePath.project. Reset when
    // the leg changes, because the new leg's arc lengths mean something else entirely.
    if (rs._dmcLeg !== leg) { rs._dmcLeg = leg; rs._dmcS = null; }
    const s = CoursePath.project(path, boat.x, boat.y, rs._dmcS);
    rs._dmcS = s;
    return path.base + s;
}

// The pre-DMC metric, kept as the fallback for a course whose paths could not be built
// (no route, or a planner failure). It is wrong on anything but a windward/leeward course,
// which is why it is a fallback and not the answer.
function legacyBoatProgress(boat) {
    const _ax = courseAxis();
    if (!_ax) return 0;
    const wx = _ax.ux, wy = _ax.uy;
    const L = _ax.len;
    const relP = (boat.x * wx + boat.y * wy) - (_ax.start.x * wx + _ax.start.y * wy);
    const leg = boat.raceState.leg;
    if (leg === 0) return relP;
    return legTargetsWindward(leg) ? (leg - 1) * L + relP : leg * L - relP;
}

// ── THE RESULTS SCREEN: "FINISH LINE" ───────────────────────────────────────
// YOUR finish is the headline; the fleet is one restrained table underneath it. The
// old screen gave all ten boats the same shouting treatment — ten skewed colour bars,
// ten 24px italic names, a white points wedge on each — so the one row a player
// actually looks for was the hardest thing on the page to find.
//
// COLOUR ONLY WHERE IT CARRIES A FACT: gold is you, the medal dot is the podium, red is
// a penalty, green is the fleet's fastest turn of speed. Everything else is grey, which
// is what lets a number be compared down a column.
//
// ⚠️ NO POINTS, NO STANDINGS, NO "NEXT RACE". All three are SERIES furniture and there is
// no series yet — points in a one-off race are the position column doing arithmetic, and
// a "next race" button has nowhere to go. They come back when a season does.
//
// ⚠️ THIS RUNS ~6 TIMES A SECOND while the overlay is open (updateLeaderboard hands over
// to it), because boats are often still finishing behind you. So the rows are built once
// per boat and patched; the hero and splits are rebuilt only when their signature changes.

// 1ST, 2ND, 3RD, 4TH… with the teens all TH.
function ordinalOf(n) {
    const t = n % 100;
    return n + ((t >= 11 && t <= 13) ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH'));
}

// Where a boat stands RIGHT NOW, in the leaderboard's own order. `lbRank` would be the
// free answer, but it is written by the render loop — a headless race never runs one, and
// the splits would then record "1ST" for everybody. Only ever called for the player, at a
// mark rounding, so the O(n) scan costs nothing.
//
// ⚠️ IT DELIBERATELY DOES NOT CALL `getBoatProgress`. That function is not a pure read: it
// stores a per-boat path-projection hint (`_dmcS`, and the leg it belongs to) so each
// reading continues from the last. Calling it for the whole fleet from inside the update
// pass — which is where a mark rounding happens — would advance those hints at a moment
// nothing else does, and the AI reads progress. A UI nicety must not be able to move the
// simulation. Distance to the next mark is already on every boat and reads the same order
// within a leg.
function fleetRank(boat) {
    const A = boat.raceState;
    let ahead = 1, pA = null;
    for (const o of state.boats) {
        if (o === boat) continue;
        const B = o.raceState;
        if (B.finished !== A.finished) { if (B.finished) ahead++; continue; }
        if (A.finished) { if (B.finishTime < A.finishTime) ahead++; continue; }
        // ON THE LEADERBOARD'S OWN NUMBER (PT-041): it read straight-line distance to the next
        // waypoint and leg first, a second ranking that disagreed with the board — "3rd at mark 1"
        // for a boat that led it by 3 s. getBoatProgress is a pure read on the goal fields
        // (courseRemaining); the ruler fallback's projection hint is read by nothing in the sim.
        if (pA == null) pA = getBoatProgress(boat);
        if (getBoatProgress(o) > pA) ahead++;
    }
    return ahead;
}

// --- The player's own record book -------------------------------------------
// A single race has no standings to compare against, so the one honest superlative left
// is your own history at this venue.
//
// ⚠️ KEYED BY VENUE **AND LEG COUNT**. A two-leg race and a four-leg race around the same
// marks are not the same event, and a "best" that mixes them is a lie the first time
// someone shortens the course.

// ── ROUNDING, THE ONE RULE ─────────────────────────────────────────────────────
// Everything a mark rounding is — arming in the zone, the rebase at ROUND_NEAR, the signed
// sweep, the wrong-way accumulator, the exit requirement measured to the NEXT anchor, the
// taut-string `wrapped` test and the leave-the-zone-outbound trigger — in one function, so
// the race and Sailing School judge a rounding by exactly the same code. `rs` is the track
// (the race passes boat.raceState; the school its own object with the same round* fields and
// a `lastPos`), `rm` the mark ({x, y, zone, radius, side, reqSweep}), `nextA` the anchor of
// whatever comes next (the following route entry, or the school's next goal).
function roundingStep(boat, rs, rm, nextA) {
    const sgn = (rm.side === 'port') ? -1 : 1;
    let wrong = false;
    const rx1 = boat.x - rm.x, ry1 = boat.y - rm.y;
    const d2 = rx1 * rx1 + ry1 * ry1;

    // THE ZONE DOES NOT GATE COMPLETION. The circle is a RULES construct — where
    // mark-room applies, where the AI switches to its orbit machinery — and a
    // rounding is complete the way the racing rules say it is: pass the mark on
    // the required side, in sequence. The string rule cares which side you left
    // it on, not how close you came, so a wide rounding outside the circle is a
    // legitimate (if slow) rounding. Zone entry used to ARM the sweep, and a
    // player who gave the first can a sensible berth sailed a perfect rounding
    // that silently never counted.
    //
    // So the signed sweep accumulates for the WHOLE leg, at any distance. The
    // sign carries the side: a pass on the wrong side sweeps negative and can
    // never reach the requirement, however close or far it was.
    //
    // Note the sweep is only ever read for its SIGN — see the completion test
    // below for why a magnitude threshold cannot work.
    //
    // ARMED BY THE HULL, not the centre — armed now feeds only the AI's rounding
    // machinery and the wrong-way warning, but it should still flip exactly when
    // the drawn ring lights amber, and both test the hull per RRS 18.1.
    if (!rs.roundArmed) {
        const sinH = Math.sin(boat.heading), cosH = Math.cos(boat.heading);
        const hp = getClosestPointOnSegment(rm.x, rm.y,
            boat.x + 25 * sinH, boat.y - 25 * cosH,
            boat.x - 30 * sinH, boat.y + 30 * cosH);
        if ((hp.x - rm.x) ** 2 + (hp.y - rm.y) ** 2 < rm.zone * rm.zone) rs.roundArmed = true;
    }
    // ⚠️ THE APPROACH BANKS WINDING SHE NEVER SPENT ROUNDING — re-base on arrival.
    //
    // `roundSweep` accumulates from LEG START at any distance. That is right for the
    // SIDE judgement — the sign carries it — and wrong for the MAGNITUDE, because an
    // approach even slightly off the mark's beam banks bearing change the boat never
    // spent rounding. Owner, sailing Redrock by hand: "I hit the first rounding circle
    // and tacked outside to get high enough to round and it counted as rounding."
    //
    // So the requirement is asked of the winding made from the moment she ARRIVES in
    // the mark's neighbourhood. Once per leg — leaving and re-entering does not re-arm
    // it, or a boat could shed a wrong-way excursion by stepping outside and back.
    if (!rs.roundRebased && d2 < (rm.zone * ROUND_NEAR) ** 2) {
        rs.roundRebased = true;
        rs.roundSweep = 0;
        rs.roundBanked = false;
        rs.roundFrom = { x: boat.x, y: boat.y };
        rs.roundEntryB = Math.atan2(ry1, rx1);
    }
    const activeR = rm.zone * ROUND_ACTIVE;
    const d2prev = (rs.lastPos.x - rm.x) ** 2 + (rs.lastPos.y - rm.y) ** 2;
    {
        const rx0 = rs.lastPos.x - rm.x, ry0 = rs.lastPos.y - rm.y;
        let dA = Math.atan2(ry1, rx1) - Math.atan2(ry0, rx0);
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        // Wrong-way travel gets its OWN accumulator, so the warning and the side
        // judgement cannot eat each other.
        const prog = dA * sgn;
        // NET signed sweep, not a magnitude race. What matters is which SIDE the
        // mark was left on, and the sign carries that. It is not clamped at zero:
        // a wrong-way excursion must be able to cancel, or you could bank credit
        // one way and then pass on the wrong side.
        rs.roundSweep = (rs.roundSweep || 0) + prog;
        // The WARNING stays gated to the mark's neighbourhood. Far from the mark
        // the bearing wobbles with every tack of an ordinary beat, and those
        // wobbles accumulate one-directionally here — ungated, a long approach
        // could scold a boat that never put a foot wrong.
        if (prog < 0 && d2 < activeR * activeR) {
            rs.roundWrong = (rs.roundWrong || 0) - prog;
            if (rs.roundWrong > Math.PI * 0.55 && !rs._wrongRound) {
                rs._wrongRound = true;
                wrong = true;
            }
        }
    }

    // COMPLETION ON DEPARTURE, not on a sweep threshold.
    //
    // A fixed threshold (this was 160 degrees) is wrong in general. Sailing in a
    // straight line PAST a mark sweeps ~180 degrees by itself, so the threshold was
    // not measuring "went round" — it was accidentally measuring "passed close".
    // And the sweep a real rounding needs depends on where the NEXT mark is: an
    // out-and-back needs ~180, a triangle corner might need 60. No single number
    // can serve both.
    //
    // The actual racing rule is "leave the mark on the required side", so that is
    // what this tests. Proximity is the zone; the SIDE is the sign of the net
    // sweep; and the leg completes when the boat has passed the mark and is
    // leaving. The small minimum only rejects degenerate cases — a boat nudging
    // the zone edge and retreating has not passed anything.
    // HOW FAR ROUND THIS COURSE REQUIRES, not a constant. `Math.PI / 4` was applied to
    // every mark on every course: a 60-degree nibble at Glacier Sound's isle completed a
    // leg whose geometry needs the whole circle, because the boat leaves for the line it
    // arrived from. `reqSweep` comes from where the previous and next marks are.
    //
    // ROUND_SWEEP_TOL is 1: the rule states no tolerance, and the AI's exit logic
    // reads the same constant, so any discount here is also an instruction to the
    // fleet to stop short. See the constant for the rule text.
    //
    // No zone requirement here — the departure radius only stops the leg completing
    // in the middle of a tight turn; a wide rounding is already outside it.
    const need = (rm.reqSweep != null ? rm.reqSweep * ROUND_SWEEP_TOL : Math.PI / 4);
    // A ROUNDING, ONCE MADE, STAYS MADE. The string is drawn over her track "until
    // she finishes", so the wrap is a fact about the track and not about where she
    // happens to be standing when the departure test fires. Without this, the
    // requirement is unreachable at the margin: the sweep PEAKS inside the
    // completion radius — the ideal path's exit tangent lies inside zone*1.25 — and
    // unwinds a couple of tenths of a radian as she fights out through the ring,
    // measured 3.44 rad banked against a 3.40 requirement and only 2.97 left by the
    // time she was far enough out to be asked. That unwind is the same one the AI's
    // exit buffer exists to cover; with no tolerance left in `need` it has to be
    // handled here instead of paid for with a discount.
    //
    // She can still GIVE IT BACK — by sailing back round the other way, which is
    // what the net signed accumulator measures. See ROUND_GIVEBACK for how much.
    // ⚠️ THE REQUIREMENT IS TO REACH THE EXIT BEARING, NOT TO BANK A NUMBER.
    //
    // A swept-angle threshold cannot tell a rounding from a near miss, because coming
    // close to a mark and turning away genuinely DOES swing your bearing about it a
    // long way. Measured (`test_rounding_nibble.js`): a boat that touches the zone and
    // tacks off banks 82 degrees on Redrock against a 46-degree requirement, 126
    // against 92 on bay, 126 against 89 on ocean — completing all three legs without
    // going round the mark at all. Raising the number does not fix it; it only makes
    // real roundings register late, which is the other half of the same complaint.
    //
    // What actually separates the two is WHERE SHE IS GOING. A rounding ends with the
    // boat leaving for the next mark; a near miss ends with her leaving the way she
    // came. So the requirement is the winding from her ARRIVAL bearing round to the
    // bearing of the next anchor, taken the required way — a per-boat, per-leg fact
    // about the geometry she actually sailed, not a course constant.
    //
    // The tolerance is DERIVED, not tuned: she leaves on a TANGENT, so at distance d
    // from a mark she rounds at radius R her bearing falls short of the exit bearing
    // by exactly acos(R/d). Allowing that and no more means the leg completes the
    // moment she is genuinely on her way out, and not a moment before.
    let needExit = need;
    if (rs.roundEntryB != null && typeof CoursePath !== 'undefined') {
        if (nextA) {
            const bQ = Math.atan2(nextA.y - rm.y, nextA.x - rm.x);
            let w = (bQ - rs.roundEntryB) * sgn;
            while (w <= 0) w += Math.PI * 2;
            while (w > Math.PI * 2) w -= Math.PI * 2;
            const R = (typeof CoursePath._roundR === 'function')
                ? CoursePath._roundR(rm, null) : Math.max(90, (rm.radius || 12) + 70);
            const dNow = Math.sqrt(d2);
            const beta = Math.acos(Math.max(0, Math.min(1, R / Math.max(R, dNow))));
            needExit = Math.max(need, w - beta - ROUND_EXIT_SLACK);
        }
    }
    if ((rs.roundSweep || 0) >= needExit) rs.roundBanked = true;
    else if (rs.roundBanked && (rs.roundSweep || 0) < needExit - ROUND_GIVEBACK) rs.roundBanked = false;
    // SHE HAS LEFT THE ZONE — the rules' own boundary for being finished with a
    // mark (18.2(b) ends mark-room when the boat entitled to it "leaves the zone").
    // This was zone*1.25, a margin whose stated job was to stop the leg completing
    // in the middle of a tight turn. `roundBanked` does that job properly: it does
    // not latch until the whole geometric requirement is swept, so a boat mid-turn
    // cannot complete however far out she wanders. The extra 25% is not free —
    // Glacier Sound's rounding mark has a zone of 851, so it held boats on the
    // rounding leg's path for another 213 units of outbound transit, orbiting an
    // island instead of steering the next leg.
    // AND THE STRING MUST ACTUALLY HAVE WRAPPED THE MARK.
    //
    // The swept-angle threshold is a PROXY for the rule, and `reqSweep` lands within
    // about fifteen degrees of the real boundary on Glacier Sound — so the half
    // radian of give-back the latch allows can carry a boat back across it. Measured
    // (`_string_truth_probe`, 12 arctic seeds): the rounding work alone left 2% of
    // completed roundings with a track that never wrapped the mark, and the fleet
    // changes on top of it drifted that back to 12%, all of them sitting within a
    // few hundredths of a radian of the boundary.
    //
    // So test the rule itself as well. Over a leg the net winding about the mark
    // takes one of exactly two values 2*pi apart — the larger is the one where the
    // taut string wraps the mark — so this is a two-class decision with a full pi of
    // margin, and it needs no tolerance of its own:
    //
    //   required = the signed angle from (mark -> where she began the leg) to
    //              (mark -> the next mark), taken the required way round, in (0,2pi]
    //   actual   = roundSweep + the short-way sweep still to come on a run to that
    //              next mark from where she is now
    //   WRAPPED iff actual >= required - pi
    //
    // It is an AND, never an OR: it can only ever hold a boat in, and a boat held in
    // is a boat still rounding, which is what she is supposed to be doing. When the
    // geometry cannot be read — no next anchor, no recorded start — it stands aside.
    let wrapped = true;
    if (rs.roundFrom && typeof CoursePath !== 'undefined') {
        if (nextA) {
            const bTo = Math.atan2(nextA.y - rm.y, nextA.x - rm.x);
            const bFrom = Math.atan2(rs.roundFrom.y - rm.y, rs.roundFrom.x - rm.x);
            let needW = (bTo - bFrom) * sgn;
            while (needW <= 0) needW += Math.PI * 2;
            while (needW > Math.PI * 2) needW -= Math.PI * 2;
            let rem = bTo - Math.atan2(ry1, rx1);
            while (rem > Math.PI) rem -= Math.PI * 2;
            while (rem < -Math.PI) rem += Math.PI * 2;
            wrapped = ((rs.roundSweep || 0) + rem * sgn) >= needW - Math.PI;
        }
    }
    // The AI has to see this too, or she banks the sweep, turns for the exit on
    // `roundBanked` alone, and sails away from a mark she has not been round —
    // measured at 12 boats in 144 failing to finish. Same coupling as the
    // tolerance and the exit latch: half of this change strands boats.
    rs.roundWrapped = wrapped;

    // ── COMPLETION: THE ROUNDING LINE + THE STRING (PT-081, PT-062; Oct 4 2026) ──────────
    // Every live system that gets this right decides the MOMENT with a line and the SIDE with
    // a separate test (Sailaway's detection line from the mark away from the previous and next
    // marks; ECDIS's end-of-turn line; the FMS fly-by sequence), and every one that decides it
    // with a magnitude fails both ways. Ours did: the sweep had to reach `reqSweep` counted
    // from a re-base that fired at 2 zones — Wes passing Otter's mark 300u off re-based ABEAM,
    // 2.02 of 2.25 rad thrown away, and the rest took 4.9 km (credited up to 9 km late); at
    // Bluewater he never came within 2 zones, so the winding banked since the start line
    // credited him 2.5 km short of the island. Now:
    //   * the ROUNDING LINE: a ray from the mark along the bisector of the turn the rounding
    //     makes — inbound to outbound, the required way round — out to the nearer of the
    //     previous and next marks (≥ 3 zones). A hairpin's points straight back; a passing
    //     mark's is square to the course on the side the boat passes.
    //   * the STRING over the WHOLE leg (no re-base): the taut string from where she began the
    //     leg, along her track, to the next mark, passes this mark on the required side — the
    //     rule itself, a two-class decision with half a turn of margin, so a nibble cannot pass.
    // Credit = she crosses the line the required way with the string wrapped. The rebased
    // sweep and `roundBanked` above stay as they were: the AI's exit and the leaderboard's
    // blend read them.
    if (rs._rlMark !== rm) { rs._rlMark = rm; rs.roundSweepLeg = 0; rs.roundLineCrossed = false; rs.roundFromLeg = rs.lastPos ? { x: rs.lastPos.x, y: rs.lastPos.y } : { x: boat.x, y: boat.y }; }
    {
        const rx0 = rs.lastPos.x - rm.x, ry0 = rs.lastPos.y - rm.y;
        let dL = Math.atan2(ry1, rx1) - Math.atan2(ry0, rx0);
        while (dL > Math.PI) dL -= Math.PI * 2;
        while (dL < -Math.PI) dL += Math.PI * 2;
        rs.roundSweepLeg += dL * sgn;
    }
    let wrappedLeg = true;
    if (nextA && rs.roundFromLeg) {
        const bTo = Math.atan2(nextA.y - rm.y, nextA.x - rm.x);
        const bFrom = Math.atan2(rs.roundFromLeg.y - rm.y, rs.roundFromLeg.x - rm.x);
        let needW = (bTo - bFrom) * sgn;
        while (needW <= 0) needW += Math.PI * 2;
        while (needW > Math.PI * 2) needW -= Math.PI * 2;
        let rem = bTo - Math.atan2(ry1, rx1);
        while (rem > Math.PI) rem -= Math.PI * 2;
        while (rem < -Math.PI) rem += Math.PI * 2;
        wrappedLeg = (rs.roundSweepLeg + rem * sgn) >= needW - Math.PI;
    }
    // The crossing is LATCHED for the leg (and undone by crossing back the wrong way), and the
    // credit lands at the first moment both hold: a long turn (Otter's mark is a 307° loop round
    // the headland) crosses the bisector halfway round, before the string has wrapped.
    const line = roundingLine(rm, nextA, rs.roundFromLeg);
    if (line) {
        // the step from lastPos to here crosses the ray [mark, mark + u·len], going the required way
        const ax = rs.lastPos.x, ay = rs.lastPos.y, bx = boat.x, by = boat.y;
        const ex = line.ux * line.len, ey = line.uy * line.len;
        const den = (bx - ax) * ey - (by - ay) * ex;
        if (Math.abs(den) > 1e-9) {
            const t = ((rm.x - ax) * ey - (rm.y - ay) * ex) / den;          // along the step
            const u = ((rm.x - ax) * (by - ay) - (rm.y - ay) * (bx - ax)) / den;   // along the ray
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                const bA = Math.atan2(ay - rm.y, ax - rm.x), bB = Math.atan2(by - rm.y, bx - rm.x);
                let dB = bB - bA; while (dB > Math.PI) dB -= Math.PI * 2; while (dB < -Math.PI) dB += Math.PI * 2;
                rs.roundLineCrossed = dB * sgn > 0;
            }
        }
    }
    // ...or THE OLD TEST, unchanged — banked against the requirement from the re-base, string
    // wrapped, outside the zone and drawing away — for the boat that came round from PAST the
    // line's angle (Redrock's M4: in from the far side, round 276°, never crossing the bisector
    // the right way near the mark). It keeps the old nibble protection (test_rounding_nibble:
    // without the sweep requirement a touch-and-tack-away counted). Now it also needs the
    // re-base to have happened — she came within ROUND_NEAR zones — so a boat that never came
    // near (Bluewater's island, 2.2 km off, credited 22.7 s before her closest approach) is
    // the line's alone. Where both can fire, the line fires first (Otter: at her closest
    // approach instead of up to 9 km later).
    if (wrappedLeg && rs.roundLineCrossed) return { done: true, wrong };
    if (rs.roundRebased && d2 > rm.zone ** 2 && d2 > d2prev && rs.roundBanked && wrapped) return { done: true, wrong };
    return { done: false, wrong };
}

// THE ROUNDING LINE of a mark for one rounding: { ux, uy, len } — see roundingStep. The turn is
// read off the course's own ideal paths (inbound path ~3 zones out, outbound likewise) so the
// line is the course's, the same for every boat, and drawable; a mark the race route does not
// carry (the School's) falls back to where this boat began the leg. Cached on the mark per pair.
function roundingLine(rm, nextA, fromPt) {
    if (!nextA) return null;
    const route = state.course && state.course.route, dmc = state.course && state.course.dmc;
    let L = -1;
    if (route) for (let i = 1; i < route.length; i++) { const e = route[i]; if (e && e.kind === 'round' && e.mark === rm) { L = i; break; } }
    const key = L >= 0 ? 'L' + L : null;
    if (key && rm._rline && rm._rline[key]) return rm._rline[key];
    const zone = rm.zone || 165;
    const along = (leg, fromEnd, dist) => {
        const P = dmc && dmc.legs && dmc.legs[leg];
        if (!P || !P.pts || P.pts.length < 2) return null;
        const pts = P.pts, cum = P.cum, total = cum[cum.length - 1];
        const target = fromEnd ? Math.max(0, total - dist) : Math.min(total, dist);
        let k = 1; while (k < cum.length - 1 && cum[k] < target) k++;
        const f = (target - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
        return { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * f, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * f };
    };
    const D = zone * 3;
    const prevA = L >= 1 && typeof CoursePath !== 'undefined' ? CoursePath.anchor(route[L - 1], state.course.marks) : null;
    const inPt = (L >= 0 && along(L, true, D)) || prevA || fromPt;
    const outPt = (L >= 0 && along(L + 1, false, D)) || nextA;
    if (!inPt || !outPt) return null;
    const sgn = (rm.side === 'port') ? -1 : 1;
    const aIn = Math.atan2(inPt.y - rm.y, inPt.x - rm.x), aOut = Math.atan2(outPt.y - rm.y, outPt.x - rm.x);
    let arc = (aOut - aIn) * sgn;                       // the turn, the required way round, in (0, 2π]
    while (arc <= 0) arc += Math.PI * 2;
    while (arc > Math.PI * 2) arc -= Math.PI * 2;
    const mid = aIn + sgn * arc / 2;
    const far = Math.min(prevA ? Math.hypot(prevA.x - rm.x, prevA.y - rm.y) : Infinity, Math.hypot(nextA.x - rm.x, nextA.y - rm.y));
    const len = Math.max(zone * 3, Math.min(20000, isFinite(far) ? far : zone * 20));
    const out = { ux: Math.cos(mid), uy: Math.sin(mid), len };
    if (key) { rm._rline = rm._rline || {}; rm._rline[key] = out; }
    return out;
}
