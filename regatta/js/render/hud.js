// regatta/js/render/hud.js — the boat-and-instruments surface: drawBoat,
// rules overlay, nav aids (arrows, gates, ladder/lay lines, mark zones),
// minimap, leaderboard (runs from draw(); boat.lbRank/prevRank are RENDER-LOCAL
// state since the 2026-08-24 leak fixes — nothing sim-side reads them, the sim's
// standing order is fleetRank/finish times. Sayings quote triggers ride the
// leaderboard's render cadence on purpose: they are presentation, and their
// Math.random draws must stay OUT of update()'s seeded stream),
// edge indicators, and the boat/rose HUD. Classic script; global scope.
// Extracted verbatim from script.js (refactor 2026-08-24).
function drawBoat(ctx, boat) {
    if (boat.opacity !== undefined && boat.opacity <= 0) return;
    ctx.save();
    if (boat.opacity !== undefined) ctx.globalAlpha = boat.opacity;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(5, 5, 12, 28, 0, 0, Math.PI * 2); ctx.fill();

    // Hull (sprite, tinted with the paint job; vector fallback while loading)
    const hullColor = boat.colors.hull || '#f1f5f9';
    const hullSprite = getTintedBoatPart('hull', hullColor);
    if (hullSprite) {
        const u = 1024 / BOAT_SPRITE_SCALE;
        ctx.drawImage(hullSprite, -512 / BOAT_SPRITE_SCALE, -472 / BOAT_SPRITE_SCALE, u, u);
    } else {
        ctx.fillStyle = hullColor;
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.bezierCurveTo(18, -10, 18, 20, 12, 30);
        ctx.lineTo(-12, 30);
        ctx.bezierCurveTo(-18, 20, -18, -10, 0, -25);
        ctx.fill();
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Cockpit sole, wheel and mast
    const cockpitColor = boat.colors.cockpit;
    drawCockpitFittings(ctx, cockpitColor);

    // Sails
    const drawSailFunc = (isJib, scale = 1.0) => {
        ctx.save();
        if (isJib) { ctx.translate(0, -25); ctx.rotate(boat.sailAngle); }
        else { ctx.translate(0, -5); ctx.rotate(boat.sailAngle); }

        const sailColor = boat.colors.sail;
        ctx.globalAlpha = 0.9 * (boat.opacity !== undefined ? boat.opacity : 1.0);
        ctx.fillStyle = sailColor || '#ffffff';
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;

        const luff = boat.luffIntensity || 0;
        const angleRatio = Math.min(1.0, Math.abs(boat.sailAngle) / (Math.PI / 4));
        const flattenFactor = 0.6 + 0.4 * angleRatio;
        const baseDepth = (isJib ? 11 : 15) * scale * flattenFactor;
        let controlX = -boat.boomSide * baseDepth;
        if (luff > 0) {
             const currentDepth = baseDepth * (1.0 - luff * 0.8);
             const time = state.time * 30;
             const flutterAmt = Math.sin(time) * baseDepth * 1.5 * luff;
             controlX = (-boat.boomSide * currentDepth) + flutterAmt;
        }
        ctx.beginPath();
        if (isJib) { ctx.moveTo(0, 0); ctx.lineTo(0, 28 * scale); ctx.quadraticCurveTo(controlX, 14 * scale, 0, 0); }
        else { ctx.moveTo(0, 0); ctx.lineTo(0, 45); ctx.quadraticCurveTo(controlX, 20, 0, 0); }
        ctx.fill(); ctx.stroke();

        if (!isJib) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath();
            ctx.moveTo(0, 15); ctx.lineTo(controlX * 0.33, 12);
            ctx.moveTo(0, 30); ctx.lineTo(controlX * 0.6, 24);
            ctx.stroke();
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 45); ctx.stroke();
        }
        ctx.restore();
    };

    const drawSpinnaker = (scale = 1.0) => {
        ctx.save();
        ctx.translate(0, -28); ctx.rotate(boat.sailAngle);
        const spinColor = boat.colors.spinnaker;
        ctx.globalAlpha = 0.9 * (boat.opacity !== undefined ? boat.opacity : 1.0);
        ctx.fillStyle = spinColor || '#ef4444';
        ctx.strokeStyle = spinColor || '#ef4444';
        ctx.lineWidth = 1;

        const luff = boat.luffIntensity || 0;
        const baseDepth = 40 * scale;
        let controlX = -boat.boomSide * baseDepth;
        if (luff > 0) {
             const currentDepth = baseDepth * (1.0 - luff * 0.9);
             const time = state.time * 25;
             const flutterAmt = Math.sin(time) * baseDepth * 1.2 * luff;
             controlX = (-boat.boomSide * currentDepth) + flutterAmt;
        }
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 50 * scale); ctx.quadraticCurveTo(controlX, 25 * scale, 0, 0);
        ctx.fill(); ctx.stroke(); ctx.restore();
    };

    // Sprite sails: rotate at the tack like the vector sails, mirror the camber
    // to the leeward side, flatten as the sheet comes in, shear-flutter when
    // luffing, and scale about the tack for the jib<->spinnaker crossfade.
    const drawSailSprite = (part, tackY, color, scale) => {
        const sprite = part === 'spin'
            ? getSpinnakerSprite(
                boat.spinPattern || 'solid',
                color || '#ffffff',
                boat.colors.spinAccent || boat.colors.hull,
                boat.colors.spinAccent3)
            : getTintedBoatPart(part, color || '#ffffff');
        if (!sprite) return false;
        ctx.save();
        ctx.translate(0, tackY);
        ctx.rotate(boat.sailAngle);
        const luff = boat.luffIntensity || 0;
        const angleRatio = Math.min(1.0, Math.abs(boat.sailAngle) / (Math.PI / 4));
        // Floor the camber squash — a sail scaled too thin reads as a broken sliver
        const flatten = Math.max(0.5, (0.6 + 0.4 * angleRatio) * (1 - luff * 0.8));
        if (luff > 0) ctx.transform(1, 0, Math.sin(state.time * 30) * 0.3 * luff, 1, 0, 0);
        // boomSide lerps through 0 as the boom swings across in a tack/gybe —
        // use its sign for which side the camber bulges and floor the magnitude
        // so the sail keeps its body mid-swing instead of collapsing to a line
        const side = boat.boomSide < 0 ? -1 : 1;
        const body = Math.max(0.7, Math.abs(boat.boomSide));
        ctx.scale(-side * body * flatten * scale, scale);
        ctx.globalAlpha = 0.9 * (boat.opacity !== undefined ? boat.opacity : 1.0);
        const u = 1024 / BOAT_SPRITE_SCALE;
        ctx.drawImage(sprite, -512 / BOAT_SPRITE_SCALE, -112 / BOAT_SPRITE_SCALE, u, u);
        ctx.restore();
        return true;
    };
    const sailColor = boat.colors.sail;
    const spinColor = boat.colors.spinnaker;

    if (!drawSailSprite('main', -5, sailColor, 1)) drawSailFunc(false);
    const progress = boat.spinnakerDeployProgress;
    const jibScale = Math.max(0, 1 - progress * 2);
    const spinScale = Math.max(0, (progress - 0.5) * 2);
    if (jibScale > 0.01 && !drawSailSprite('jib', -25, sailColor, jibScale)) drawSailFunc(true, jibScale);
    if (spinScale > 0.01 && !drawSailSprite('spin', -28, spinColor, spinScale)) drawSpinnaker(spinScale);

    // Masthead fly (wind pennant) — streams downwind with the APPARENT wind. You can
    // watch it swing forward as the boat accelerates ("the boat makes its own wind"),
    // and it's the realistic cue for trimming and reading the lift/header in a puff.
    // Player only: it is an instrument, and nine more fluttering ribbons made the
    // one that matters harder to pick out of the fleet.
    //
    // Drawn after the sails: a real fly sits above the rig, and underneath them
    // only ~25% of the ribbon survived at any point of sail. Anchored at the mast
    // rather than the stern — at the transom it reads as a burgee (decoration) and
    // sits in the boom clutter, where at the mast it lands where the eye already is.
    // Kept short so that being on top buys visibility without adding noise.
    if (boat.apparentWind && boat.isPlayer) {
        const rel = normalizeAngle(boat.apparentWind.direction - boat.heading);
        const fx = -Math.sin(rel), fy = Math.cos(rel); // streams to where wind blows TO (local frame)
        const px2 = -fy, py2 = fx; // perpendicular, for the flutter wave

        // Breeze 0..1 over the sailable range. Light air lets the ribbon fall into
        // slow, wide swings; as it builds, the fly pulls taut and shivers instead —
        // faster but tighter.
        //
        // state.time runs at 0.24 units/sec, so cycles/sec = freq * 0.24 / 2pi.
        // 68..158 is 2.6Hz drifting to 6.0Hz (the old flat 55 was 2.1Hz). Well
        // clear of the 60fps sampling limit, which starts to bite around 15Hz.
        const breeze = Math.min(1, Math.max(0, (boat.apparentWind.speed - 4) / 16));
        const len = 9 + 4 * breeze;
        const freq = 68 + 90 * breeze;
        const amp = 3.2 - 2.1 * breeze;

        // Phase is accumulated rather than computed as time*freq. With a frequency
        // that moves with the wind, that product lurches whenever the breeze shifts
        // — and the jump scales with elapsed race time, so it gets worse the longer
        // you sail. Integrating keeps the wave continuous across gusts and gybes.
        const dt = Math.min(0.1, Math.max(0, state.time - (boat.telltaleTime ?? state.time)));
        boat.telltaleTime = state.time;
        boat.telltalePhase = ((boat.telltalePhase ?? 0) + dt * freq) % (Math.PI * 2);
        const t = boat.telltalePhase;

        ctx.save();
        ctx.strokeStyle = settings.telltaleColor || '#fbbf24';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // Travelling wave down the ribbon, amplitude growing toward the free end
        ctx.beginPath();
        ctx.moveTo(0, -5);
        for (let i = 1; i <= 6; i++) {
            const f = i / 6;
            const wave = Math.sin(t - f * 4.5) * f * f * amp;
            ctx.lineTo(fx * len * f + px2 * wave, -5 + fy * len * f + py2 * wave);
        }
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function isConflictSoon(b1, b2) {
    const distSq = (b1.x - b2.x)**2 + (b1.y - b2.y)**2;
    if (distSq < 80*80) return true; // Very close/overlapping

    // Relative velocity
    // velocity is units per frame (1/60s)
    const vx = b1.velocity.x - b2.velocity.x; // Velocity of B1 relative to B2
    const vy = b1.velocity.y - b2.velocity.y;

    // Relative position of B1 from B2
    const px = b1.x - b2.x;
    const py = b1.y - b2.y;

    // Check if moving closer
    // d/dt (P.P) = 2 P.V
    const dot = px * vx + py * vy;

    // If dot > 0, distance is increasing (moving apart)
    if (dot >= 0) return false;

    // Time to CPA
    const vSq = vx*vx + vy*vy;
    if (vSq < 0.0001) return false;

    // t_cpa = -(P.V) / (V.V)
    const t = -dot / vSq;

    // Thresholds
    // 10 seconds = 600 frames at 60fps
    if (t > 600) return false;

    // CPA Distance
    // P_cpa = P + V*t
    const cpaX = px + vx * t;
    const cpaY = py + vy * t;
    const cpaDistSq = cpaX*cpaX + cpaY*cpaY;

    // 120 units is approx 3-4 boat lengths (safety margin)
    if (cpaDistSq < 120*120) return true;

    return false;
}

function drawRulesOverlay(ctx) {
    if (!state.showNavAids || !settings.penaltiesEnabled || state.race.status === 'finished') return;

    const checkDist = 400; // Increased range for visibility

    // Helper to draw triangle
    const drawTriangle = (boat, target, color) => {
        const dx = target.x - boat.x;
        const dy = target.y - boat.y;
        const angle = Math.atan2(dy, dx);

        // Calculate distance based on hull shape (elliptical approx)
        // Hull is roughly width=15 (rx=25 w/ pad), length=30 (ry=40 w/ pad)
        const dAngle = angle - boat.heading;
        const rx = 25, ry = 40;
        const lx = Math.cos(dAngle), ly = Math.sin(dAngle);
        const dist = (rx * ry) / Math.sqrt((ry * lx) ** 2 + (rx * ly) ** 2);

        const tx = boat.x + Math.cos(angle) * dist;
        const ty = boat.y + Math.sin(angle) * dist;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(angle);

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        // Pointing right (towards target)
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, 7);
        ctx.lineTo(-6, -7);
        ctx.closePath();

        ctx.fill();
        ctx.restore();
    };

    // HYSTERESIS, per pair. The raw tests are re-asked every frame and both sit on knife
    // edges: isConflictSoon is a projection with a threshold, and getRightOfWay flips its
    // winner where a rule boundary runs (the overlap line, windward/leeward nearly abeam,
    // tack near head-to-wind). Drawn raw, a pair near either edge flickers at frame rate —
    // green and red trading places is the worst case, because it reverses the instruction.
    // So the display is a DEBOUNCED VIEW of the raw answer: a new verdict must hold for
    // SWITCH_HOLD before the triangles change, and a vanished conflict lingers OFF_DELAY
    // before they hide. The physics and penalties still read the raw answer every frame —
    // this steadies the advice, never the rules.
    const SWITCH_HOLD = 0.35, OFF_DELAY = 0.45;
    const t = state.time;
    if (!drawRulesOverlay._pairs) drawRulesOverlay._pairs = new Map();
    const pairs = drawRulesOverlay._pairs;

    for (let i = 0; i < state.boats.length; i++) {
        const b1 = state.boats[i];
        for (let j = i + 1; j < state.boats.length; j++) {
            const b2 = state.boats[j];
            const distSq = (b1.x - b2.x)**2 + (b1.y - b2.y)**2;

            let raw = null;
            if (distSq < checkDist * checkDist && isConflictSoon(b1, b2)) {
                const res = getRightOfWay(b1, b2);
                if (res.boat) raw = { wi: res.boat === b1 ? i : j, rule: res.rule };
            }

            const key = i * 1000 + j;
            let ps = pairs.get(key);
            if (ps && ps.at > t) ps = null;                 // a new race rewound the clock
            if (raw) {
                if (!ps || !ps.show) {
                    ps = { show: true, wi: raw.wi, rule: raw.rule, at: t, pend: null, offAt: null };
                } else if (raw.wi === ps.wi && raw.rule === ps.rule) {
                    ps.pend = null; ps.offAt = null;        // steady verdict — keep it
                } else if (!ps.pend || ps.pend.wi !== raw.wi || ps.pend.rule !== raw.rule) {
                    ps.pend = { wi: raw.wi, rule: raw.rule, at: t };   // new verdict: start the clock
                    ps.offAt = null;
                } else if (t - ps.pend.at >= SWITCH_HOLD) {
                    ps.wi = ps.pend.wi; ps.rule = ps.pend.rule; ps.pend = null;
                }
            } else if (ps && ps.show) {
                ps.pend = null;
                if (ps.offAt == null) ps.offAt = t;
                if (t - ps.offAt >= OFF_DELAY) ps.show = false;
            }
            if (!ps) continue;
            pairs.set(key, ps);
            if (!ps.show) continue;

            const winner = ps.wi === i ? b1 : b2;
            const loser  = ps.wi === i ? b2 : b1;
            if (ps.pend) {
                // CONTESTED: a new verdict is holding its SWITCH_HOLD clock, which means
                // the law has flipped and the display is about to follow. Matched amber
                // on BOTH boats says exactly that — the advice is damped and currently
                // unstable — instead of letting the old green/red claim a certainty the
                // law no longer has. Symmetric on purpose: Rule 21's orange/red pairing
                // stays unambiguous because it is not.
                drawTriangle(winner, loser, '#fbbf24');
                drawTriangle(loser, winner, '#fbbf24');
            } else if (ps.rule === 'Rule 21') {
                // Section D override — orange for OCS/penalty
                drawTriangle(winner, loser, '#f59e0b');
                drawTriangle(loser, winner, '#ef4444');
            } else {
                // Normal — green ROW, red give-way
                drawTriangle(winner, loser, '#4ade80');
                drawTriangle(loser, winner, '#ef4444');
            }
        }
    }
}

// Course-overlay kit (SailGP-inspired): thin mint-teal geometry, dashed
// laylines, amber only for the active in-zone state, Saira italic labels.
const NAV_RGB = '64, 245, 200';

function drawRoundingArrows(ctx) {
    if (!state.showNavAids || !state.course || !state.course.marks || state.race.status === 'finished') return;

    // Player Leg determines what to show
    const player = state.boats[0];
    // No arrows on Start (0) or Finish (totalLegs)
    if (player.raceState.leg === 0 || player.raceState.leg >= state.race.totalLegs) return;

    // ISLAND ROUNDING: the active mark is ONE mark, so the arrow belongs on it. Every other
    // nav-aid here has an islandRound branch; this one did not, and `legMarks()` returns null
    // on a leg that rounds rather than crosses — so the `|| [0, 1]` fallback below reached for
    // the first two marks in the array, which are the START LINE. Crossing the start turned
    // the line you had just left into a phantom gate with rounding arcs on both ends, while
    // the mark you were actually sailing to had none.
    if (state.course.type === 'islandRound') {
        const e = routeLeg(player.raceState.leg);
        const rm = (e && e.kind === 'round' && e.mark) ? e.mark : null;
        if (!rm) return;
        // Leaving the mark to STARBOARD means the bearing angle increases (see the sweep test
        // in updateBoatRaceState) — and with y down, increasing angle is clockwise on screen,
        // which is `counterclockwise = false`. So port rounds are the ccw ones.
        const ccw = (rm.side === 'port');
        const R = Math.max(90, (rm.zone || 0) * 0.42);
        ctx.save();
        ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${NAV_RGB}, 0.85)`; ctx.fillStyle = `rgba(${NAV_RGB}, 0.85)`;
        ctx.translate(rm.x, rm.y);
        ctx.rotate(state.time * 8.0 * (ccw ? -1 : 1));
        const start = 0, end = Math.PI;
        ctx.beginPath(); ctx.arc(0, 0, R, start, end, ccw); ctx.stroke();
        ctx.translate(R * Math.cos(end), R * Math.sin(end));
        ctx.rotate(end + (ccw ? -Math.PI / 2 : Math.PI / 2));
        ctx.beginPath();
        ctx.moveTo(-10, -10); ctx.lineTo(10, 0); ctx.lineTo(-10, 10); ctx.lineTo(-6, 0); ctx.fill();
        ctx.restore();
        return;
    }

    // Rounding direction alternates with which end of the gate you take: at the
    // windward gate the first mark is left to port, at the leeward line it is the
    // second. Keyed on the route ROLE, not leg parity — leg 0 targets the start
    // line and must read as a leeward-style pair even though it is a beat.
    const amIdx = legMarks(player.raceState.leg) || [0, 1];
    const amWindward = (routeLeg(player.raceState.leg) || {}).role === 'windward';
    const activeMarks = amIdx.map((index, k) => ({ index, ccw: amWindward ? k === 0 : k === 1 }));

    ctx.save();
    ctx.lineWidth = 7; ctx.strokeStyle = `rgba(${NAV_RGB}, 0.85)`; ctx.fillStyle = `rgba(${NAV_RGB}, 0.85)`; ctx.lineCap = 'round';
    const windDir = state.wind.baseDirection;

    for (const item of activeMarks) {
        if (item.index >= state.course.marks.length) continue;
        const m = state.course.marks[item.index];
        ctx.save(); ctx.translate(m.x, m.y);
        let start, end, ccw = item.ccw;
        if (item.index === 0 || item.index === 2) { start = 0; end = Math.PI; } // Left
        else { start = Math.PI; end = 0; } // Right
        // Invert if Upwind Gate vs Leeward Gate direction?
        // Mark 2 (Left Upwind): Round CCW. 0->PI. Correct.
        // Mark 3 (Right Upwind): Round CW. PI->0. Correct.
        // Mark 0 (Left Leeward): Round CW. 0->PI.
        if (item.index === 0) ccw = false; // Override for Leeward Left
        if (item.index === 1) ccw = true; // Override for Leeward Right

        const anim = state.time * 8.0 * (ccw ? -1 : 1);
        ctx.rotate(windDir + anim);
        ctx.beginPath(); ctx.arc(0, 0, 80, start, end, ccw); ctx.stroke();
        const tipX = 80 * Math.cos(end), tipY = 80 * Math.sin(end);
        let tangent = end + (ccw ? -Math.PI/2 : Math.PI/2);
        ctx.translate(tipX, tipY); ctx.rotate(tangent);
        ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 0); ctx.lineTo(-10, 10); ctx.lineTo(-6, 0); ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}

// ... Reused standard draw functions ...
function drawActiveGateLine(ctx) {
    const player = state.boats[0];
    const finished = state.race.status === 'finished' || player.raceState.finished;
    const leg = player.raceState.leg;
    const totalLegs = state.race.totalLegs;

    // One crossing line, with the shared treatment: bright when it is what the player is
    // being asked for, slate furniture otherwise, label facing the approaching racer.
    const drawLine = (indices, target, color, label, dir) => {
        const m1 = state.course.marks[indices[0]], m2 = state.course.marks[indices[1]];
        if (!m1 || !m2) return;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y);
        ctx.shadowColor = color; ctx.shadowBlur = target ? 15 : 0;
        ctx.strokeStyle = color; ctx.lineWidth = target ? 5 : 3;
        ctx.globalAlpha = target ? 1 : 0.4;
        ctx.lineDashOffset = -state.time * 20; ctx.stroke();
        if (label) {
            ctx.fillStyle = color; ctx.font = FONT.display(24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            // Face approaching racers: the text's top points in the direction of travel
            // through the line — the crossing normal n = (dy, -dx) times the entry's own
            // crossing sign. (This used to look up "the other gate" as marks[2]/[3] —
            // which do not exist on a course with one line and a rounding, so it read
            // undefined and crashed the whole draw.)
            const angle = Math.atan2(m2.y - m1.y, m2.x - m1.x);
            const tx = (m2.y - m1.y) * dir, ty = -(m2.x - m1.x) * dir;
            ctx.translate((m1.x + m2.x) / 2, (m1.y + m2.y) / 2);
            let rot = angle;
            if (Math.sin(rot) * tx - Math.cos(rot) * ty < 0) rot += Math.PI;
            ctx.rotate(rot); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.strokeText(label, 0, 0); ctx.fillText(label, 0, 0);
        }
        ctx.restore();
    };

    if (state.course.type === 'islandRound') {
        // A rounding course keeps its lines on the water for the whole race — they are
        // fixed furniture you will come back to. Read them off the ROUTE: on Glacier
        // Sound start and finish are the same pair; on Lighthouse Cove they are two
        // different lines, and BOTH draw — the finish permanently labelled so the two
        // can never be confused.
        const route = state.course.route || [];
        const startE = route[0] || {};
        const sIdx = startE.marks || [0, 1];
        const finE = route[totalLegs] || route[route.length - 1] || {};
        const fIdx = finE.marks || sIdx;
        const sameLine = fIdx[0] === sIdx[0] && fIdx[1] === sIdx[1];

        const finTarget = finished || leg >= totalLegs;
        if (sameLine) {
            // One line playing both roles — the original single-line logic.
            const target = finTarget || leg === 0;
            let color = '#ffffff';
            if (finished) color = '#4ade80';
            else if (leg === 0 && state.race.status === 'prestart') color = '#ef4444';
            // The same slate the greyed-out buoys use, so "not the thing you are sailing
            // to" looks the same whatever piece of furniture is saying it.
            else if (!target) color = '#94a3b8';
            const label = leg === 0 ? 'START' : (finTarget ? 'FINISH' : '');
            const dir = ((routeLeg(Math.min(leg, totalLegs)) || {}).dir) || 1;
            drawLine(sIdx, target, color, label, dir);
        } else {
            const startTarget = !finished && leg === 0;
            let sColor = '#94a3b8';
            if (startTarget) sColor = state.race.status === 'prestart' ? '#ef4444' : '#ffffff';
            drawLine(sIdx, startTarget, sColor, startTarget ? 'START' : '', startE.dir || 1);
            const fColor = finished ? '#4ade80' : (finTarget ? '#ffffff' : '#94a3b8');
            drawLine(fIdx, finTarget, fColor, 'FINISH', finE.dir || 1);
        }
        return;
    }

    // Windward-leeward: the line appears only when it is the thing to cross.
    let indices;
    if (finished) {
        indices = finishMarks() || [0, 1];
    } else {
        if (leg !== 0 && leg !== totalLegs) return;
        indices = legMarks(leg) || [0, 1];
    }
    let color = '#ffffff';
    if (finished) color = '#4ade80';
    else if (leg === 0 && state.race.status === 'prestart') color = '#ef4444';
    const label = (leg === 0 && !finished) ? 'START' : 'FINISH';
    const dir = ((routeLeg(Math.min(leg, totalLegs)) || {}).dir) || 1;
    drawLine(indices, true, color, label, dir);
}

// ⚠️ THE TRAINING AIDS BELONG TO ONE VENUE, AND IT IS A DESIGN LINE RATHER THAN A TOGGLE.
// Ladder lines and laylines are a COACHING overlay: they hand you the answer to "can I lay
// it yet" and "am I gaining on that boat", which are two of the things learning to race
// consists of working out from the water. Sea Trials is the practice course — that is what
// it is for — so it keeps them, and everywhere else you read the shifts and the angles.
//
// Venue KEY rather than a doc field on purpose. This is a property of one named course in
// the game's progression, not a knob a venue author should be reaching for; keys are
// identity here (see VENUE_ORDER's note), so the test is stable.
function trainingAidsOn() {
    return (state.race.venue || settings.venue) === 'seatrials';
}

function drawLadderLines(ctx) {
    const player = state.boats[0];
    if (!state.showNavAids || state.race.status === 'prestart' || state.race.status === 'finished' || player.raceState.finished) return;
    if (!trainingAidsOn()) return;

    const _ax = courseAxis();
    if (!_ax) return;
    const c1x = _ax.start.x, c1y = _ax.start.y, c2x = _ax.windward.x, c2y = _ax.windward.y;
    const dx = _ax.dx, dy = _ax.dy, len = _ax.len;
    const wx = _ax.ux, wy = _ax.uy, px = -wy, py = wx;
    const courseAngle = Math.atan2(wx, -wy);

    // Ladder rungs span the course AXIS — from the leeward/start line to the
    // windward gate — so they are keyed on the two ends of the route, and flipped
    // by whether this leg is sailed up or down.
    const dnPair = (routeLeg(0) && routeLeg(0).marks) || [0, 1];
    const upPair = (routeLeg(1) && routeLeg(1).marks) || [2, 3];
    const goingUp = legGoesUpwind(player.raceState.leg);
    const nextPair = goingUp ? upPair : dnPair;
    const prevPair = goingUp ? dnPair : upPair;
    let prevIndex = prevPair[0];
    let nextIndex = nextPair[0];

    const mPrev = state.course.marks[prevIndex], mNext = state.course.marks[nextIndex];
    const startProj = mPrev.x*wx + mPrev.y*wy, endProj = mNext.x*wx + mNext.y*wy;
    let minP = Math.min(startProj, endProj), maxP = Math.max(startProj, endProj);

    const interval = 500;
    const firstLine = Math.floor(minP/interval)*interval;

    // Boundary & Laylines Projection logic same as before...
    const uL = mNext.x*wx + mNext.y*wy, vL = mNext.x*px + mNext.y*py;
    const mNextR = state.course.marks[nextPair[1]];
    const uR = mNextR.x*wx + mNextR.y*wy, vR = mNextR.x*px + mNextR.y*py;
    const b = state.course.boundary;
    const uC = b.x*wx + b.y*wy, vC = b.x*px + b.y*py, R = b.radius;

    const isUpwindTarget = goingUp;
    const delta = normalizeAngle(state.wind.direction - courseAngle);
    let slopeLeft = Math.tan(delta + Math.PI/4), slopeRight = Math.tan(delta - Math.PI/4);
    if (!isUpwindTarget) { slopeLeft = Math.tan(delta - Math.PI/4); slopeRight = Math.tan(delta + Math.PI/4); }

    ctx.save(); ctx.strokeStyle = `rgba(${NAV_RGB}, 0.5)`; ctx.lineWidth = 3;
    ctx.font = FONT.display(22); ctx.fillStyle = `rgba(${NAV_RGB}, 0.9)`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Labels lie along the rung itself (SailGP style), flipped to stay upright ON SCREEN
    // (the camera rotates, so the flip test must be in screen space, not world space)
    let labelAngle = Math.atan2(py, px);
    if (Math.abs(normalizeAngle(labelAngle - state.camera.rotation)) > Math.PI / 2) labelAngle += Math.PI;
    const toGateSign = (endProj > startProj) ? 1 : -1;
    const gateAngle = Math.atan2(toGateSign * wy, toGateSign * wx);

    for (let p = firstLine; p <= maxP; p+=interval) {
        if (p < minP) continue;
        if (Math.abs(p - endProj) < 1.0) continue;
        if (player.raceState.leg === 0 && Math.abs(p - startProj) < 1.0) continue;

        const dist = p - uL, distR = p - uR;
        const vMin = vL + dist * slopeLeft, vMax = vR + distR * slopeRight;
        const du = p - uC;
        if (Math.abs(du) >= R) continue;
        const dv = Math.sqrt(R*R - du*du);
        const finalMin = Math.max(vMin, vC - dv), finalMax = Math.min(vMax, vC + dv);

        if (finalMin < finalMax) {
            const cx = p*wx, cy = p*wy;
            const x1 = cx + finalMin*px, y1 = cy + finalMin*py;
            const x2 = cx + finalMax*px, y2 = cy + finalMax*py;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

            const distToGate = Math.abs(endProj - p) * 0.2;
            if (distToGate > 50) {
                 // Labels repeat at fixed world positions along the rung (static — the water
                 // moves past them), each with a chevron pointing toward the gate
                 const label = String(Math.round(distToGate));
                 const tw = ctx.measureText(label).width;
                 for (let v = Math.ceil((finalMin + 90) / 900) * 900; v <= finalMax - 90; v += 900) {
                     const lx = cx + v * px, ly = cy + v * py;
                     ctx.save();
                     ctx.translate(lx, ly);
                     ctx.rotate(labelAngle);
                     ctx.fillText(label, 0, -14);
                     ctx.translate(tw / 2 + 16, -14);
                     ctx.rotate(gateAngle - labelAngle);
                     ctx.beginPath();
                     ctx.moveTo(-4, -7); ctx.lineTo(4, 0); ctx.lineTo(-4, 7);
                     ctx.strokeStyle = `rgba(${NAV_RGB}, 0.9)`;
                     ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                     ctx.stroke();
                     ctx.restore();
                 }
            }
        }
    }
    ctx.restore();
}

// Is the target upwind of the boat? On a fixed course the legs are not
// alternating beats and runs, so this has to be measured rather than inferred
// from the leg number.
function isUpwindTo(boat, target) {
    const wx = Math.sin(state.wind.direction), wy = -Math.cos(state.wind.direction);
    const dx = target.x - boat.x, dy = target.y - boat.y;
    const l = Math.hypot(dx, dy) || 1;
    return ((dx / l) * wx + (dy / l) * wy) > 0;   // pointing into the wind
}

// ONE LAYLINE PER END, running back from that end, down and away from the line.
//
// Each end is laid on ONE tack — the starboard end on starboard, the port end on port —
// so each gets that tack's layline and no other. Written as the ray that leans AWAY from
// the other end, which is the same statement without needing to work out which end is
// which: the two close-hauled angles are 90 degrees apart, and the one pointing away from
// your neighbour is the tack that fetches you.
//
// So the pair DIVERGES. Taking the ray that leans TOWARD the other end gives the opposite
// tack at each end — two lines that cross below the middle of the line and read as a big X
// over the fleet. Clipping that X at its crossing makes a tidy wedge and is still the wrong
// two lines.
//
// ⚠️ THE PAIR IS GEOMETRIC, NOT AN INDEX PARITY. The windward-leeward path used to decide
// which end got which tack from `idx % 2`, i.e. from the order the marks happen to sit in
// the document. On Gatorgrass mark 0 is the EAST end, so parity handed each end the other's
// tack and drew the X above. "Lean away from your neighbour" cannot be ordered wrongly.
//
// THE WIND IS SAMPLED AT EACH END, so a line lying across a gradient shows its skew. This
// used to read the global `state.wind.direction` — the blend at the ROUTE CENTROID — which
// on Gatorgrass is 39 degrees off the wind actually at the line. A layline drawn from a
// wind measured two kilometres away is a decoration, not a nav aid.
function drawEndLaylines(ctx, pts, inset) {
    ctx.save(); ctx.lineWidth = 5.5;
    ctx.strokeStyle = `rgba(${NAV_RGB}, 0.72)`;
    for (let k = 0; k < pts.length; k++) {
        const m = pts[k], other = pts[k ^ 1];
        if (!m || !other) continue;
        const wHere = getWindAt(m.x, m.y).direction;
        let tx = other.x - m.x, ty = other.y - m.y;
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let best = null;
        for (const s of [-1, 1]) {
            const a = wHere + s * Math.PI / 4 + Math.PI;   // back down the close-hauled track
            const dx = Math.sin(a), dy = -Math.cos(a);
            const lean = dx * tx + dy * ty;
            if (!best || lean < best.lean) best = { dx, dy, lean };
        }
        const sx = m.x + best.dx * (inset || 0), sy = m.y + best.dy * (inset || 0);
        const t = Arena.rayHit(state.course.boundary, sx, sy, best.dx, best.dy);
        if (t === null) continue;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + best.dx * t, sy + best.dy * t);
        ctx.stroke();
    }
    ctx.restore();
}

function drawLayLines(ctx) {
    if (!state.showNavAids || state.race.status === 'finished') return;
    if (!trainingAidsOn()) return;
    const player = state.boats[0];
    const leg = player.raceState.leg;

    // Island course: the rounding is a single mark with a zone circle, and the finish is a
    // line you simply cross — neither wants laylines. Only the start does.
    if (state.course.type === 'islandRound') {
        if (leg !== 0) return;
        const pts = startLinePts();
        if (!pts[0] || !pts[1]) return;
        return drawEndLaylines(ctx, pts, 0);
    }

    // A FINISH *LINE* IS CROSSED, NOT LAID — but a finish GATE is still a gate.
    //
    // ⚠️ THIS USED TO SUPPRESS EVERY FINISH, and that was too broad by exactly one case. The
    // rule was written for Gatorgrass, where the windward gate IS the finish, on the argument
    // that you do not lay a line you merely cross. True of a LINE. False of a gate at the end
    // of an ordinary leg: Sea Trials runs down to its leeward gate four times and gets gybe
    // laylines every lap, then crosses the same gate on the fifth and got nothing — the same
    // water, the same decision about which end to take, and the aid silently gone at the one
    // moment it decides the race. That inconsistency is what a player reads as a bug.
    //
    // So the LEG's geometry decides, not the finish flag, and `kind` is what separates them.
    // Only windward-leeward courses reach this line at all — every islandRound venue has
    // already returned above, since it draws laylines for the start and nothing else.
    // `routeLeg` is the authority on which leg finishes; `totalLegs` alone is not, because
    // the route deliberately generates entries past it.
    const rl = routeLeg(leg);
    if (rl && rl.finish && rl.kind === 'line') return;

    // Downwind gates keep their own treatment below; everything approached on a beat —
    // the start line and every windward gate — is the same two-ended problem.
    const targets = legMarks(leg);
    if (!targets) return;
    const isUpwind = legGoesUpwind(leg);
    // ⚠️ A FINISH HAS NO ZONE, SO ITS LAYLINES RUN ALL THE WAY IN. The 165 inset exists to
    // keep a layline from cutting across the rounding circle drawn around a mark you have to
    // go round. There is no circle at a finish and nothing to round — you cross — so the
    // inset only opened a gap between the line and the mark you are aiming at, in the one
    // place the aid has to be exact. Same reason the start line is already 0.
    const zoneRadius = (leg === 0 || (rl && rl.finish)) ? 0 : 165;
    const pts = targets.map(i => state.course.marks[i]);
    if (!pts[0] || !pts[1]) return;
    if (isUpwind) return drawEndLaylines(ctx, pts, zoneRadius);

    // Running down to a leeward gate: the pair runs UPWIND from each mark, still leaning
    // away from its neighbour so the two diverge rather than cross.
    ctx.save(); ctx.lineWidth = 5.5;
    ctx.strokeStyle = `rgba(${NAV_RGB}, 0.72)`;
    for (let k = 0; k < pts.length; k++) {
        const m = pts[k], other = pts[k ^ 1];
        const wHere = getWindAt(m.x, m.y).direction;
        let tx = other.x - m.x, ty = other.y - m.y;
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let best = null;
        for (const s of [-1, 1]) {
            const a = wHere + s * Math.PI / 4;
            const dx = Math.sin(a), dy = -Math.cos(a);
            const lean = dx * tx + dy * ty;
            if (!best || lean < best.lean) best = { dx, dy, lean };
        }
        const sx = m.x + best.dx * zoneRadius, sy = m.y + best.dy * zoneRadius;
        const t = Arena.rayHit(state.course.boundary, sx, sy, best.dx, best.dy);
        if (t === null) continue;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + best.dx * t, sy + best.dy * t);
        ctx.stroke();
    }
    ctx.restore();
}

function drawMarkZones(ctx) {
    if (!state.showNavAids || state.race.status === 'finished') return;
    const player = state.boats[0];
    let active = [];

    // MARKS WITH NO BUOY. A rounding laid on an island, or a transit — there is nothing
    // physically there, so the indicator IS the mark: a ring and a cross, pulsing gently
    // so it reads as course information rather than as scenery.
    for (const m of state.course.marks) {
        if (m.kind !== 'none') continue;
        const pulse = 1 + Math.sin(state.time * 2.2 + m.x * 0.01) * 0.06;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.strokeStyle = `rgba(${NAV_RGB}, 0.75)`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-30, 0); ctx.lineTo(-12, 0);
        ctx.moveTo(12, 0);  ctx.lineTo(30, 0);
        ctx.moveTo(0, -30); ctx.lineTo(0, -12);
        ctx.moveTo(0, 12);  ctx.lineTo(0, 30);
        ctx.stroke();
        ctx.restore();
    }

    // Rounding course: the zone circle belongs to whatever mark THIS leg rounds — read
    // it off the route entry, not off `roundMark`, which is only the first rounding of
    // the course. Keying on `leg !== 1` left Lighthouse Cove's legs 2-5 with no circle
    // at all, and always drawing `roundMark` put leg 1's circle on the wrong can.
    //
    // Drawn SOLID: the zone is hard course geometry, same as a gate's — the dashes read
    // as a suggestion. And amber the moment the hull is inside it, exactly like a gate.
    if (state.course.type === 'islandRound') {
        const e = routeLeg(player.raceState.leg);
        const rm = (e && e.kind === 'round' && e.mark) ? e.mark : null;
        if (!rm) return;
        const h = player.heading, sinH = Math.sin(h), cosH = Math.cos(h);
        const bowX = player.x + 25 * sinH, bowY = player.y - 25 * cosH;
        const sternX = player.x - 30 * sinH, sternY = player.y + 30 * cosH;
        const closest = getClosestPointOnSegment(rm.x, rm.y, bowX, bowY, sternX, sternY);
        const inZone = (closest.x - rm.x) ** 2 + (closest.y - rm.y) ** 2 < rm.zone * rm.zone;
        ctx.save();
        ctx.strokeStyle = inZone ? 'rgba(251, 191, 36, 0.95)' : `rgba(${NAV_RGB}, 0.55)`;
        ctx.lineWidth = inZone ? 5.5 : 5;
        ctx.beginPath(); ctx.arc(rm.x, rm.y, rm.zone, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        return;
    }

    // Exclude Start (0) and Finish (totalLegs)
    if (player.raceState.leg > 0 && player.raceState.leg < state.race.totalLegs) {
        active = legMarks(player.raceState.leg) || [];
    } else return;

    ctx.save();
    const h = player.heading, sinH = Math.sin(h), cosH = Math.cos(h);
    const bowX = player.x + 25*sinH, bowY = player.y - 25*cosH;
    const sternX = player.x - 30*sinH, sternY = player.y + 30*cosH;

    for (const idx of active) {
        const m = state.course.marks[idx];
        const closest = getClosestPointOnSegment(m.x, m.y, bowX, bowY, sternX, sternY);
        const distSq = (closest.x-m.x)**2 + (closest.y-m.y)**2;
        const inZone = distSq < 165*165;
        ctx.strokeStyle = inZone ? 'rgba(251, 191, 36, 0.95)' : `rgba(${NAV_RGB}, 0.68)`;
        ctx.lineWidth = inZone ? 5.5 : 4;
        ctx.beginPath(); ctx.arc(m.x, m.y, 165, 0, Math.PI*2); ctx.stroke();
    }

    // Flat GATE label on the water between the active gate marks
    const gA = state.course.marks[active[0]], gB = state.course.marks[active[1]];
    const gx = (gA.x + gB.x) / 2, gy = (gA.y + gB.y) / 2;
    const gAng = Math.atan2(gB.y - gA.y, gB.x - gA.x);
    ctx.save();
    ctx.translate(gx, gy);
    let rot = gAng; if (Math.abs(normalizeAngle(rot - state.camera.rotation)) > Math.PI / 2) rot += Math.PI;
    ctx.rotate(rot);
    ctx.font = FONT.display(52);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
    ctx.fillText('GATE ' + player.raceState.leg, 0, 0);
    ctx.restore();
    ctx.restore();
}

const MINIMAP_ISLAND = {
    tropical: { body: '#fde6b1', top: '#84cc16' },
    grass:    { body: '#7aaa1d', top: '#4d7c0f' },
    swampgrass: { body: '#a09453', top: '#4d7c0f' },
    ice:      { body: '#b8dcf5', top: '#f2f9ff' },
    redrock:  { body: '#cc6533', top: '#d98e57' },
    granite:  { body: '#4b5563', top: '#374151' },
    // Coral sand: the lagoon's beaches, kept sand-coloured in both slots — a mask
    // isle full of cream sand IS its own cap.
    coralsand: { body: '#efe4cf', top: '#efe4cf' },
    // Gatorgrass Bayou's banks, and the clearest case yet for why this table exists: the
    // CHART wants them darker than the water does.
    //
    // On the course, mud reads against textured olive water in daylight and its own material
    // colour is right. The minimap paints water as a flat 0.9-alpha wash of the venue's base
    // — no texture, no light — and against that the derived values arrived at only -27 luma
    // for mud and -7 for marsh. Seven is nothing: the braided banks the whole venue is built
    // around were dissolving into the channel at chart size, which is precisely the size at
    // which you need to see where the maze is.
    //
    // Taken down to about -50 and -32 against the water, and kept inside the olive-brown
    // family so they still read as the same two materials — and 18 luma apart from each
    // other, so marsh still reads as the lighter margin between sward and bank.
    mud:      { body: '#37301f', top: '#37301f' },
    marsh:    { body: '#4b4228', top: '#4b4228' },
    // ── SOCKEYE RUN'S FOREST, AND WHY THE CHART DISAGREES WITH THE GROUND ───────────
    // Same argument as mud and marsh above, arrived at from the other end. `humus` and
    // `mossfloor` both carry `trees: true`, so the chart was taking their VEG colour — the
    // forest floor's own green — and drawing #4E5A34 and #7EA02A. Two problems with that.
    //
    // Humus at #4E5A34 sat only -10 luma against the water: the venue's biggest landform,
    // the thing the whole river runs through, was dissolving into the channel at chart size.
    // And mossfloor at #7EA02A was +45, BRIGHTER than the water and nearly as bright as the
    // meadow — so the wettest, darkest forest on the map was charting as its most open
    // ground, which is backwards.
    //
    // What a player needs off this chart is where the WOOD is, and a Southeast Alaska wood
    // seen from above is the colour of Sitka spruce. So humus takes the shipped
    // river-spruce-sitka sprite's own measured mean, #26382E, and mossfloor sits a shade
    // greener and lighter as the damper variant — 15 luma apart and dE 16.9, so a designer
    // can still tell the two forests apart, which at #4E5A34 vs #7EA02A they could (dE 45)
    // but for the wrong reason.
    //
    // Against the water they now land at -42 and -19 luma, bracketing the bayou note's own
    // -50/-32 finding. Meadow takes the recoloured tile's mean so the chart and the ground
    // agree, and at +58 luma it is the brightest thing on the venue — which is the read:
    // dark forest, bright meadow, pale gravel, and the river threading between them.
    humus:     { body: '#26382E', top: '#26382E' },
    mossfloor: { body: '#33563B', top: '#33563B' },
    meadow:    { body: '#8DAD32', top: '#8DAD32' },
    // Fallback only. A bar's real chart colour is DERIVED per shape (shoalTintFor), so a
    // tan bar and a coral-white bar read differently here exactly as they do on the course.
    shoal:    { body: 'rgba(232,220,177,0.45)', top: 'rgba(232,220,177,0.45)' }
};
// An explicit row wins; otherwise the material's own colours, so the map cannot disagree
// with the water about what a thing is.
//
// `top` is the fill a DOC venue actually uses — compiled shapes are `fromMask`, which
// takes the top slot and skips the cap pass entirely — so the choice between veg and body
// is the whole picture, not a detail of the middle. A wooded island shows its CANOPY from
// above; bare ground shows the GROUND. `trees` is the flag that already knows which is
// which, so it decides here rather than a second list of exceptions.
function minimapIsland(style) {
    const row = MINIMAP_ISLAND[style];
    if (row) return row;
    const st = ISLAND_STYLES[style];
    if (!st) return MINIMAP_ISLAND.ice;      // an unknown style keeps the old default
    return { body: st.body, top: st.trees ? (st.veg || st.body) : st.body };
}

function drawMinimap() {
    if (!minimapCtx) { const c = document.getElementById('minimap'); if(c) minimapCtx = c.getContext('2d'); }
    const ctx = minimapCtx;
    if (!ctx || !state.boats.length) return;

    const width = ctx.canvas.width, height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);

    const player = state.boats[0];
    // Bounds centered on player but including marks?
    // Let's use logic from before: Bounds of marks + player
    let minX = player.x, maxX = player.x, minY = player.y, maxY = player.y;
    for (const m of state.course.marks) {
        minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x);
        minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y);
    }
    // Mask venues show the WHOLE map: the geography is authored and fixed, so a
    // minimap cropped to player+marks hides most of it and reads nothing like
    // the painted mask.
    if (state.course.doc) {
        // Follows the ARENA rather than MASK_WORLD, so it tracks a scaled map and a
        // polygon boundary instead of a constant that no longer describes either. THE
        // ARENA'S LONG AXIS JUST FITS: the chart is for racing, so the water you may
        // sail claims the whole frame, and the scenery beyond the limit shows only as
        // far as the frame's own margins let it (the whole-canvas water fill below is
        // what keeps that cropped scenery sitting on sea rather than on glass). This
        // deliberately reverts an experiment that grew the extent to take in all
        // scenery — an atoll ring 3x the arena shrank the racing to a postage stamp.
        const e = Arena.extent(state.course.boundary);
        minX = e.minX; maxX = e.maxX; minY = e.minY; maxY = e.maxY;
    }
    const pad = state.course.doc ? 0 : 200;
    minX-=pad; maxX+=pad; minY-=pad; maxY+=pad;
    const scale = (width - (state.course.doc ? 0 : 20)) / Math.max(maxX-minX, maxY-minY);
    const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
    const t = (x, y) => ({ x: (x-cx)*scale + width/2, y: (y-cy)*scale + height/2 });

    // Boundary (a designed course draws its own arena, so only a generated one needs this)
    const b = state.course.boundary;
    if (!state.course.doc) {
        const bp = t(b.x, b.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(bp.x, bp.y, b.radius*scale, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    }


    // ── THE VENUE'S OWN WATER, AND WHAT LIES IN IT ──────────────────────────
    // A doc venue's chart paints in the venue's real colours: the open water as a rect
    // over the glass, the painted zones in the signature water, everything on the
    // bottom in the same derived tints the course draws it with — so the minimap is a
    // small true picture of the venue, not a diagram in chart-sand. Generated venues
    // keep the bare glass: they have no authored geography to show.
    const mmPoly = (verts) => {
        ctx.beginPath();
        if (verts.length) {
            const p0 = t(verts[0].x, verts[0].y);
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < verts.length; i++) { const p = t(verts[i].x, verts[i].y); ctx.lineTo(p.x, p.y); }
        }
        ctx.closePath();
    };
    if (state.course.doc && window.WATER_CONFIG) {
        const rgbOf = (h, fb) => {
            const s = String(h || '').replace('#', '');
            return /^[0-9a-f]{6}$/i.test(s) ? [0, 2, 4].map(i => parseInt(s.substr(i, 2), 16)) : fb;
        };
        const base = rgbOf(window.WATER_CONFIG.baseColor, [14, 79, 134]);
        // The WHOLE canvas, not the extent rect: the frame's spare margins show cropped
        // scenery from beyond the arena, and that scenery must sit on sea, not on glass.
        ctx.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},0.9)`;
        ctx.fillRect(0, 0, width, height);
        // Painted zones, in document order: shallows in the hero water, meadows in the
        // same submerged olive the course bakes.
        const hero = rgbOf(window.WATER_CONFIG.heroColor || window.WATER_CONFIG.baseColor, base);
        for (const isl of state.course.islands || []) {
            if (!isl.paint || isl.hidden || !isl.vertices) continue;
            mmPoly(isl.vertices);
            // A vegetated zone shows in its own plant's darkest tone; a bare tint zone
            // shows in the hero water. Reads the same VEG_STYLES row the bed itself
            // bakes from, so the map and the world cannot drift apart.
            const spec = isl.veg ? VEG_STYLES[isl.veg] : null;
            ctx.fillStyle = spec
                ? `rgba(${vegTone(spec.tones[0], spec).join(',')},0.55)`
                : `rgba(${hero[0]},${hero[1]},${hero[2]},0.9)`;
            ctx.fill('evenodd');
        }
    }

    // ── PUFFS: WATER, SO THEY GO UNDER THE LAND ─────────────────────────────
    // Drawn here rather than after the islands, which is where they used to be — a puff
    // whose centre sits on a berg painted a violet blob across the ice, and a patch of
    // rough water on a glacier is not a thing. Land is painted next and covers them, the
    // same way the main view already handles it.
    //
    // Tinted from the venue's own `palette.gusts` rather than a hardcoded navy/cyan, so a
    // cat's-paw here is the same water it is out on the course (race-view.md §4, §8) — but
    // the CHART under them is dark slate, not this venue's water, so the tint keeps its HUE
    // and has its lightness floored to stay legible there. `gustDark` painted literally was
    // invisible ink: ten gusts on Open Ocean's minimap and not one of them on screen.
    //
    // And the fill is the same radial falloff the course sprite bakes, not a flat disc. A
    // hard-edged ellipse at one alpha read as a fog bank on Stillwater Lake, where a lull
    // outgrows the arm of the lake it sits in — strong at the centre and gone at the rim is
    // both how the course draws it and what keeps a big cell from swallowing the chart.
    const _gc = (typeof activeGustColors !== 'undefined' && activeGustColors) || null;
    if (_gc) {
        const _lift = (c, floor) => {
            const [h, s, l] = rgbToHsl(c[0], c[1], c[2]);
            return l >= floor ? c : hslToRgb(h, s, floor);
        };
        const gustC = _lift(_gc.gustMid, 0.42);
        const lullC = _gc.lullBright;                    // authored bright; already legible
        for (const g of state.gusts) {
            const pos = t(g.x, g.y);
            const R = g.radiusX * scale;
            if (R < 1.5) continue;                       // sub-2px cell: nothing to read
            const strength = Math.min(1.0, Math.abs(g.speedDelta) / (state.wind.baseSpeed * 0.5));
            // Stays under the boats: these are the CENTRE alphas, and the rim is zero. They
            // run higher than the old flat fill dared, because the chart is frosted glass
            // with the moving race behind it — at 0.3 a cell loses to the blur noise.
            let peak = g.type === 'gust' ? 0.30 + strength * 0.45 : 0.22 + strength * 0.33;
            // A cell's ink shrinks with the SQUARE of its on-chart radius, so the same puff
            // that reads on Stillwater Lake is a faint dot on Open Ocean's big arena. Small
            // cells get their alpha handed back — capped where a strong cell already sits.
            const small = Math.max(0, Math.min(1, (10 - R) / 10));
            peak = Math.min(0.8, peak * (1 + small * 0.6));
            const c = g.type === 'gust' ? gustC : lullC;
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(g.rotation);
            ctx.scale(1, g.radiusY / g.radiusX);
            // Same upwind shift as the main draw — the minimap is the one place you read the
            // whole fleet against the whole pressure field, so it is the last place the two
            // should disagree. (Drawn in the scaled frame, so the offset scales with it.)
            const ox = -PUFF_SKEW * g.radiusX * scale;
            const grad = ctx.createRadialGradient(ox, 0, 0, ox, 0, R);
            grad.addColorStop(0, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${peak.toFixed(3)})`);
            grad.addColorStop(0.55, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(peak * 0.45).toFixed(3)})`);
            grad.addColorStop(1, `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0)`);
            ctx.beginPath();
            ctx.arc(ox, 0, R, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            // A thin ring at the cell's true extent, weather-chart style. The soft core
            // alone loses on Open Ocean, whose chart is the same navy as its gusts — a
            // rim is the one mark that survives any backdrop without adding real ink.
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.min(0.7, (0.20 + strength * 0.25) * (1 + small)).toFixed(3)})`;
            ctx.stroke();
            ctx.restore();
        }
    }

    // Squalls: the weather worth planning around, drawn as its shadow — a dark cell
    // with a rim, heavier than a puff because it IS heavier than a puff.
    if (state.squalls) {
        for (const q of state.squalls) {
            const pos = t(q.x, q.y);
            const R = Math.max(q.rx, q.ry) * scale;
            if (R < 2) continue;
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(q.course);
            ctx.scale(q.rx / Math.max(q.rx, q.ry), q.ry / Math.max(q.rx, q.ry));
            ctx.beginPath();
            ctx.arc(0, 0, R, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(16, 26, 44, 0.45)';
            ctx.fill();
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = 'rgba(120, 150, 190, 0.6)';
            ctx.stroke();
            ctx.restore();
        }
    }

    if (state.course.islands) {
        // Body first. Shoals draw their body and are then skipped by the cap pass below:
        // the cap is vegetation or snow, and a bar under water has neither. Paint zones
        // are not islands at all — they were drawn with the water above.
        //
        // ⚠️ `hidden`, NOT `isBank` — see the note in drawIslands. isBank is "out of the
        // router", which is a different question from "do not draw", and the chart has to
        // agree with the water about what is there.
        for (const isl of state.course.islands) {
            if (isl.hidden || isl.paint) continue;
            ctx.fillStyle = isl.reef
                ? `rgba(${submergedTint(REEF_RUBBLE[1]).join(',')},0.6)`   // the band's own drowned khaki
                : isl.awash
                ? `rgba(${shoalTintFor(isl).join(',')},0.6)`
                : isl.fromMask
                ? minimapIsland(isl.style).top
                : minimapIsland(isl.style).body;
            ctx.beginPath();
            if (isl.vertices.length > 0) {
                const p0 = t(isl.vertices[0].x, isl.vertices[0].y);
                ctx.moveTo(p0.x, p0.y);
                for(let i=1; i<isl.vertices.length; i++) {
                    const pi = t(isl.vertices[i].x, isl.vertices[i].y);
                    ctx.lineTo(pi.x, pi.y);
                }
            }
            ctx.closePath();
            // even-odd: mask rings are keyholed (the sound is a hole in the land)
            ctx.fill('evenodd');
        }
        // Center cap (vegetation on land, snow on ice)
        for (const isl of state.course.islands) {
            if (isl.hidden || isl.awash) continue;
            // Mask shapes are keyholed; an inset "cap" ring is meaningless and
            // paints blobs across the water.
            if (isl.fromMask) continue;
            ctx.fillStyle = minimapIsland(isl.style).top;
            ctx.beginPath();
            if (isl.vegVertices.length > 0) {
                const p0 = t(isl.vegVertices[0].x, isl.vegVertices[0].y);
                ctx.moveTo(p0.x, p0.y);
                for(let i=1; i<isl.vegVertices.length; i++) {
                    const pi = t(isl.vegVertices[i].x, isl.vegVertices[i].y);
                    ctx.lineTo(pi.x, pi.y);
                }
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    // Trace (Player Only)
    if (player.raceState.trace.length) {
         ctx.lineWidth = 1.5;
         // Draw whole trace
         // Simplify: Draw all points
         ctx.beginPath();
         const p0 = t(player.raceState.trace[0].x, player.raceState.trace[0].y);
         ctx.moveTo(p0.x, p0.y);
         for (const p of player.raceState.trace) {
             const tp = t(p.x, p.y);
             ctx.lineTo(tp.x, tp.y);
         }
         const curr = t(player.x, player.y);
         ctx.lineTo(curr.x, curr.y);
         ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
         ctx.stroke();
    }

    // ── WHERE TO GO NEXT ────────────────────────────────────────────────────
    //
    // This is what the minimap is FOR. Everything else on it — the coastline, the fleet,
    // the rest of the course — is context for one question, so the active target gets the
    // strongest treatment on the map and everything inactive gets out of its way.
    //
    // Two things were wrong. `legMarks()` returns null for a ROUNDING (a rounding entry
    // carries `markId`, not `marks`), so on an island course — Glacier Sound's whole race —
    // nothing was highlighted at all and the mark you were sailing to drew as one more grey
    // pip. And on a document venue every mark is scaled by 0.6, so even a gate's "active"
    // dot was 2.4px: emphasis that shrank exactly when the map got busy.
    const legNow = player.raceState.leg;
    const entry = routeLeg(legNow);
    const racing = state.race.status !== 'finished';
    const active = (racing && legMarks(legNow)) || [];
    const roundMark = (racing && entry && entry.kind === 'round') ? entry.mark : null;

    // Gates come from the ROUTE, not from the hardcoded pairs (0,1) and (2,3). A
    // course with one line and a rounding has no second gate, and reading marks[2]
    // on a two-mark course crashed the whole minimap.
    const drawG = (i1, i2, a) => {
        const m1 = state.course.marks[i1], m2 = state.course.marks[i2];
        if (!m1 || !m2) return;
        const p1 = t(m1.x, m1.y), p2 = t(m2.x, m2.y);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        // Inactive geometry is nearly gone. It still says "there is a gate here" for
        // orientation, and says nothing louder than that. MID-SLATE rather than a dim
        // white: this minimap is pale ice on Glacier Sound and deep blue on Lighthouse
        // Cove, and a near-white line at 0.14 disappears completely on the first one.
        ctx.strokeStyle = a ? '#fde047' : 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = a ? 2.5 : 1;
        ctx.stroke();
    };
    const drawn = {};
    for (const e of (state.course.route || [])) {
        if (!e.marks) continue;
        const key = e.marks.join(',');
        if (drawn[key]) continue;
        drawn[key] = true;
        drawG(e.marks[0], e.marks[1], active.indexOf(e.marks[0]) !== -1);
    }

    // Every other mark: small, cool and quiet.
    const mkR = state.course.doc ? 0.6 : 1;
    for (let i = 0; i < state.course.marks.length; i++) {
        if (active.includes(i)) continue;
        const m = state.course.marks[i];
        if (roundMark && m === roundMark) continue;
        const p = t(m.x, m.y);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.6 * mkR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)'; ctx.fill();
    }

    // ── THE BEACON ──────────────────────────────────────────────────────────
    // Drawn last so nothing buries it, and deliberately NOT scaled by `mkR` — the same
    // rule the player arrow follows: the one thing you are hunting for must not shrink
    // when the map gets harder to read. The halo PULSES, which makes it the only moving
    // thing on the map besides the boats; the eye goes to it without being told to.
    const beacon = (px, py, coreR) => {
        const pulse = 0.5 + 0.5 * Math.sin(state.time * 3.0);
        ctx.beginPath(); ctx.arc(px, py, coreR + 4 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(253, 224, 71, ${(0.30 + pulse * 0.45).toFixed(3)})`;
        ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, coreR, 0, Math.PI * 2);
        ctx.fillStyle = '#f97316'; ctx.fill();
        ctx.strokeStyle = '#0b1c2b'; ctx.lineWidth = 1.4; ctx.stroke();
    };
    for (const i of active) {
        const m = state.course.marks[i];
        if (m) { const p = t(m.x, m.y); beacon(p.x, p.y, 4.2); }
    }
    if (roundMark) {
        const p = t(roundMark.x, roundMark.y);
        // A rounding's zone is the thing you have to get inside, so draw it: the ring is
        // the instruction, not decoration. Floored in pixels so it survives a whole-map
        // venue where the real zone is a few pixels across.
        const zoneR = Math.max(9, (roundMark.zone || 0) * scale);
        ctx.beginPath(); ctx.arc(p.x, p.y, zoneR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
        ctx.lineWidth = 1.2; ctx.stroke();
        beacon(p.x, p.y, 4.6);
    }

    // Boats
    // Marker size. These were tuned when the minimap framed player+marks; a
    // mask venue shows the WHOLE map, where a fixed 8px arrow is a boat the size
    // of an island and the fleet becomes one coloured smear. Shrink to match.
    const mk = state.course.doc ? 0.55 : 1;

    // COMPETITORS ARE DOTS. Ten rotating triangles a few pixels tall encode a heading
    // nobody can read at this size — they just made the fleet a field of similar shapes
    // you had to pick your own arrow out of. A dot says the one thing a rival pip is for:
    // where they are. It also leaves the ARROW shape meaning exactly one thing on this
    // map, which is what makes the player findable at a glance.
    for (const boat of state.boats) {
        if (boat.isPlayer) continue;
        const pos = t(boat.x, boat.y);
        // Ink outline: hull colors alone don't separate from water or gust blobs
        // at this size, and dark hulls disappeared entirely.
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 4.6 * mk, 0, Math.PI * 2);
        ctx.fillStyle = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;
        ctx.fill();
        ctx.strokeStyle = 'rgba(11, 28, 43, 0.85)'; ctx.lineWidth = 1.4 * mk; ctx.stroke();
    }

    // THE PLAYER IS A LARGE WHITE ARROW — drawn last, so it is never buried under a rival.
    if (player) {
        const pos = t(player.x, player.y);
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(player.heading);

        // Deliberately NOT scaled by `mk`. The fleet shrinks on a whole-map venue so it
        // does not smear; the one marker you are hunting for must stay the same size, or
        // it shrinks exactly when the map gets hard to read.
        ctx.shadowBlur = 6 + Math.sin(state.time * 8) * 2;
        ctx.shadowColor = 'rgba(15, 30, 45, 0.95)';

        ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(8.5, 10); ctx.lineTo(0, 6); ctx.lineTo(-8.5, 10);
        ctx.closePath();
        // White, against a fleet of saturated hull colours. Shape and value both separate
        // it now, so it no longer needs the gold that used to be doing that job alone.
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#0b1c2b'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
    }
}

function updateLeaderboard() {
    if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) {
        showResults();
        return;
    }
    if (!UI.leaderboard || !state.boats.length) return;

    // Store previous ranks
    state.boats.forEach(b => b.prevRank = b.lbRank);

    // Calculate L for distance estimates
    const _ax = courseAxis();
    const c1x = _ax.start.x, c1y = _ax.start.y;
    const c2x = _ax.windward.x, c2y = _ax.windward.y;
    const dx = _ax.dx, dy = _ax.dy;
    const len = _ax.len;
    // THE WHOLE COURSE, measured on the path DMC is read against — not `legs x axis length`,
    // which is the straight-line axis and understates any course with land on it. The
    // "distance to finish" delta has to be in the same units as the progress it subtracts.
    const totalRaceDist = (state.course.dmc && state.course.dmc.total) || (state.race.totalLegs * len);


    if (state.race.status === 'prestart') {
         UI.leaderboard.classList.add('hidden');
         return;
    }
    UI.leaderboard.classList.remove('hidden');

    // Sort boats
    const sorted = [...state.boats].sort((a, b) => {
        // Scoring helper: 0=Finished, 1=DNF, 2=DNS, 3=Racing
        const getScore = (boat) => {
            if (!boat.raceState.finished) return 3;
            if (boat.raceState.resultStatus === 'DNS') return 2;
            if (boat.raceState.resultStatus === 'DNF') return 1;
            return 0;
        };

        const scoreA = getScore(a);
        const scoreB = getScore(b);

        if (scoreA !== scoreB) return scoreA - scoreB;

        if (scoreA === 0) return a.raceState.finishTime - b.raceState.finishTime;

        // 2. Leg (For Racing)
        if (a.raceState.leg !== b.raceState.leg) return b.raceState.leg - a.raceState.leg;

        // 3. Progress within leg (For Racing or DNF/DNS tiebreak)
        const pA = getBoatProgress(a);
        const pB = getBoatProgress(b);
        return pB - pA;
    });

    const leader = sorted[0];
    const leaderProgress = getBoatProgress(leader);

    // Update Header
    // The pips carry the count, so the label is just a label. `2/4` beside four bars with
    // two lit was the same fact twice.
    if (UI.lbLeg) UI.lbLeg.textContent = "LEG";

    // Leg pips: one per leg, showing where YOU are — not the leader. This is the player's
    // own panel, and "which leg am I on" is the question it is being asked.
    //
    // Three states rather than two, so it says the leg rather than a count of finished ones:
    // the leg you are ON is lit, the ones behind you are dimmed, the ones ahead are dark.
    if (UI.lbPips) {
        const legs = Math.max(1, state.race.totalLegs);
        const me = state.boats.find(b => b.isPlayer) || leader;
        const cur = me.raceState.finished ? legs + 1 : Math.max(1, me.raceState.leg);
        if (UI.lbPips.childElementCount !== legs) {
            UI.lbPips.innerHTML = '';
            for (let i = 0; i < legs; i++) {
                const pip = document.createElement('span');
                pip.style.cssText = 'display:block;height:4px;border-radius:2px;transition:background .3s,width .3s;';
                UI.lbPips.appendChild(pip);
            }
        }
        [...UI.lbPips.children].forEach((pip, i) => {
            const n = i + 1;
            pip.style.width = n === cur ? '20px' : '14px';
            pip.style.background = n === cur ? '#5eead4' : n < cur ? '#5eead459' : '#475569';
        });
    }

    // Render Rows
    if (UI.lbRows) {
        const ROW_HEIGHT = 44;
        UI.lbRows.style.height = (sorted.length * ROW_HEIGHT + 12) + 'px';

        sorted.forEach((boat, index) => {
            let row = UI.boatRows[boat.id];

            // Create if missing
            if (!row) {
                row = document.createElement('div');
                row.className = "lb-row flex items-center";

                // Rank. Italic display rather than mono: the whole row is one voice, and a
                // monospaced numeral beside an italic name read as two different panels.
                const rank = document.createElement('div');
                rank.className = "lb-rank t-display w-5 text-right mr-2.5 shrink-0";
                rank.style.cssText = "font-size:15px; font-style:italic;";

                // Portrait / Icon
                const iconContainer = document.createElement('div');
                iconContainer.className = "w-9 h-9 mr-2.5 flex items-center justify-center shrink-0";

                // EVERY ROW SHOWS A FACE, yours included. The player used to get a star
                // because the player had no portrait — but the player IS a character now, and
                // showing whose boat you picked is the point of picking one. Which row is
                // yours is already said by the ring around the row and its type, so the star
                // was carrying a meaning that was no longer its own.
                //
                // No ring and no fill behind it: the portraits are cut-outs, so a disc of
                // panel-coloured background WAS the circle. The src is set in the update
                // pass, not here — see the note there.
                const img = document.createElement('img');
                img.className = "lb-face w-9 h-9 rounded-full object-cover";
                iconContainer.appendChild(img);

                const nameDiv = document.createElement('div');
                nameDiv.className = "lb-name t-display flex-1 truncate uppercase";
                nameDiv.style.cssText = "font-size:16px;";
                nameDiv.textContent = boat.name;

                // Which way this boat is going, shown only while it is still worth saying.
                const trendDiv = document.createElement('div');
                trendDiv.className = "lb-trend shrink-0 mr-1.5 text-center";
                trendDiv.style.cssText = "width:12px; font-size:10px; line-height:1;";

                const distDiv = document.createElement('div');
                distDiv.className = "lb-dist t-mono text-right shrink-0";
                distDiv.style.cssText = "font-size:11.5px; min-width:52px;";

                row.appendChild(rank);
                row.appendChild(iconContainer);
                row.appendChild(nameDiv);
                row.appendChild(trendDiv);
                row.appendChild(distDiv);

                UI.lbRows.appendChild(row);
                UI.boatRows[boat.id] = row;
                boat.lbRank = index;
            }

            // Update Content
            const rankDiv = row.querySelector('.lb-rank');
            const distDiv = row.querySelector('.lb-dist');
            const nameDiv = row.querySelector('.lb-name');
            const trendDiv = row.querySelector('.lb-trend');
            const faceImg = row.querySelector('.lb-face');

            // ⚠️ THE FACE FOLLOWS THE BOAT'S IDENTITY, WHICH CAN CHANGE UNDER A LIVE ROW.
            // Picking a new character does not rebuild the fleet — `applyPlayerCharacter`
            // renames boat 0 in place (and `swapClashingOpponent` can re-identify an AI) —
            // so a src set once at row creation left the OLD portrait on the row while the
            // name beside it updated. Cheap to re-check: a string compare per row per draw.
            if (faceImg && faceImg.dataset.face !== boat.name) {
                faceImg.dataset.face = boat.name;
                faceImg.src = "assets/images/competitors/" + boat.name.toLowerCase() + ".png";
            }

            const dnx = boat.raceState.leg === 0 && !boat.raceState.finished;
            let rowClass = "lb-row flex items-center transition-colors duration-500";
            if (boat.isPlayer) rowClass += " lb-me";
            row.className = rowClass;

            // YOU ARE YOUR OWN COLOUR, not gold — the same hue the results page rings your
            // row with and the same one your gap marker carries there. Gold had to mean two
            // things at once on a panel that also ranks a fleet.
            const me = boat.isPlayer
                ? deepBandFor(boat.colors.hull, boat.colors.spinnaker, boat.colors.spinAccent) : null;
            if (me) row.style.boxShadow = `inset 0 0 0 2px ${me}`;

            // Only MEANINGFUL rows carry a fill — you, and anyone who has finished. The
            // zebra striping was a third fill that said nothing, and on the dark panel it
            // read as banding rather than as rows.
            row.style.background = boat.isPlayer ? boatGlow(boat, 0.12)
                                 : boat.raceState.finished ? 'rgba(16,185,129,0.14)'
                                 : 'transparent';

            rankDiv.style.color = me ? me : dnx ? '#475569' : '#64748b';
            nameDiv.style.color = boat.raceState.penalty ? '#f87171'
                                : me ? me
                                : dnx ? '#64748b' : '#ffffff';
            nameDiv.textContent = boat.name;
            rankDiv.textContent = index + 1;

            // A MOVE IS NEWS FOR A FEW SECONDS. Comparing ranks frame to frame would flash
            // the arrow for one update and vanish; this holds it long enough to be seen and
            // then stops, so a settled fleet is a quiet panel.
            if (boat.prevRank !== undefined && boat.prevRank !== index) {
                boat.lbTrendDir = index < boat.prevRank ? 1 : -1;
                boat.lbTrendUntil = state.race.timer + 2.5;
            }
            const showTrend = boat.lbTrendUntil !== undefined && state.race.timer < boat.lbTrendUntil;
            trendDiv.textContent = showTrend ? (boat.lbTrendDir > 0 ? '\u25B2' : '\u25BC') : '';
            trendDiv.style.color = boat.lbTrendDir > 0 ? '#34d399' : '#f87171';

            if (index === 0 && !boat.raceState.resultStatus) {
                // The leader has no gap to report, so the column says what it IS.
                distDiv.textContent = boat.raceState.finished ? formatTime(boat.raceState.finishTime) : 'LEADER';
                distDiv.style.color = '#5eead4';
            } else {
                distDiv.style.color = dnx ? '#64748b' : '#a5b4fc';
                if (boat.raceState.resultStatus) {
                    distDiv.textContent = boat.raceState.resultStatus;
                } else if (leader.raceState.finished) {
                    if (boat.raceState.finished) {
                        distDiv.textContent = "+" + (boat.raceState.finishTime - leader.raceState.finishTime).toFixed(1) + "s";
                    } else {
                        const diff = Math.max(0, totalRaceDist - getBoatProgress(boat));
                        distDiv.textContent = "+" + Math.round(diff * 0.2) + "m";
                    }
                } else {
                    const diff = Math.max(0, leaderProgress - getBoatProgress(boat));
                    distDiv.textContent = "+" + Math.round(diff * 0.2) + "m";
                }
            }

            // Update Position
            row.style.transform = `translate3d(0, ${index * ROW_HEIGHT}px, 0)`;

            // Handle Rank Change Animation
            if (boat.lbRank !== index) {
                boat.lbRank = index;
            }
        });
    }

    // Sayings Checks
    const player = state.boats[0];
    const playerRank = player.lbRank;
    const playerPrevRank = player.prevRank;

    for (const boat of state.boats) {
        if (boat.isPlayer) continue;

        // Moved into First
        if (boat.lbRank === 0 && boat.prevRank !== 0) {
            Sayings.queueQuote(boat, "moved_into_first");
        }

        // Moved into Last
        if (boat.lbRank === state.boats.length - 1 && boat.prevRank !== state.boats.length - 1) {
            Sayings.queueQuote(boat, "moved_into_last");
        }

        // Passing Player (AI was behind, now ahead)
        // Lower rank is better. Behind means rank > playerRank. Ahead means rank < playerRank.
        if (boat.prevRank > playerPrevRank && boat.lbRank < playerRank) {
            Sayings.queueQuote(boat, "they_pass_player");
        }

        // Player Passed AI (AI was ahead, now behind)
        if (boat.prevRank < playerPrevRank && boat.lbRank > playerRank) {
            Sayings.queueQuote(boat, "player_passes_them");
        }
    }
}



function drawBoatIndicator(ctx, boat) {
    if (boat.isPlayer) return;
    if (boat.opacity !== undefined && boat.opacity <= 0) return;

    // One line: rank pip + name. The label's only job on the water is IDENTITY —
    // binding "that pink boat" to "Splat". Rank and name are already in the
    // leaderboard, so the pip reuses that panel's ring-plus-rank language and the
    // two views teach each other. Speed was removed deliberately: a rival's
    // ABSOLUTE boatspeed changes no decision (the fleet sits inside ~1.5kn), and
    // reading it meant holding a number while glancing at your own instrument.
    const rank = (boat.lbRank !== undefined) ? String(boat.lbRank + 1) : "-";
    const showRank = boat.raceState.leg !== 0;   // no standings before the gun
    const name = boat.name.toUpperCase();
    const idColor = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;

    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(state.camera.rotation);
    ctx.translate(0, 46); // below the boat, camera-upright

    // The pip is always present — it is the identity carrier, and identity matters
    // most in the prestart scrum. It just holds no digit until there are standings.
    const PIP_R = showRank ? 8 : 4.5;
    const padX = 7;
    ctx.font = FONT.label(11);
    const nameW = ctx.measureText(name).width;
    const pipSlot = PIP_R * 2 + 5;
    const boxW = padX + pipSlot + nameW + padX;
    const boxH = 22;
    const x = -boxW / 2, y = 0;

    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 6);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    let cursor = x + padX;

    // Filled pip in the boat's identity color; digit picks whichever of
    // ink/white actually reads on it.
    const pcx = cursor + PIP_R, pcy = y + boxH / 2;
    ctx.fillStyle = idColor;
    ctx.beginPath();
    ctx.arc(pcx, pcy, PIP_R, 0, Math.PI * 2);
    ctx.fill();

    if (showRank) {
        ctx.font = FONT.mono(10);
        ctx.fillStyle = isVeryDark(idColor) ? '#f8fafc' : '#0b1c2b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rank, pcx, pcy + 0.5);
        ctx.font = FONT.label(11);
    }
    cursor += PIP_R * 2 + 5;

    // Penalty is the one state that overrides identity — red means penalty here
    // exactly as it does everywhere else.
    ctx.fillStyle = boat.raceState.penalty ? '#ef4444' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, cursor, y + boxH / 2 + 0.5);

    ctx.restore();
}

// Edge-clamped indicator for an active gate mark (or, with markIndex null, the
// closest point on the start/finish line). The mini arc mirrors the in-world
// rounding arrows of drawRoundingArrows: same start/end/ccw per mark index,
// rotated into screen space so it always agrees with what you'll see at the mark.
function drawMarkEdgeIndicator(ctx, x, y, label, markIndex, screenRot) {
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fillStyle = '#22c55e'; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    if (markIndex !== null) {
        let start, end, ccw;
        // A rounding leg passes the SIDE ('port'/'starboard') instead of a gate index —
        // same chirality convention as drawRoundingArrows: port rounds are the ccw ones.
        if (markIndex === 'port' || markIndex === 'starboard') {
                                    start = 0;       end = Math.PI; ccw = markIndex === 'port'; }
        else if (markIndex === 0) { start = 0;       end = Math.PI; ccw = false; }
        else if (markIndex === 1) { start = Math.PI; end = 0;       ccw = true; }
        else if (markIndex === 2) { start = 0;       end = Math.PI; ccw = true; }
        else                      { start = Math.PI; end = 0;       ccw = false; }

        ctx.save();
        ctx.rotate(state.wind.baseDirection + screenRot);
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, 15, start, end, ccw); ctx.stroke();
        const tipX = 15 * Math.cos(end), tipY = 15 * Math.sin(end);
        const tangent = end + (ccw ? -Math.PI/2 : Math.PI/2);
        ctx.translate(tipX, tipY); ctx.rotate(tangent);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 0); ctx.lineTo(-5, 5); ctx.lineTo(-3, 0); ctx.fill();
        ctx.restore();
    }

    ctx.fillStyle = '#ffffff'; ctx.font = FONT.label(15); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    ctx.fillText(label, 0, markIndex !== null ? -21 : -12);
    ctx.restore();
}

// Edge-clamped indicator for a nearby off-screen competitor: hull-colored dot
// with the boat's current rank inside and its name above.
function drawNpcEdgeIndicator(ctx, x, y, boat) {
    const color = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = boat.raceState.penalty ? '#ef4444' : '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    if (state.race.status === 'racing' && boat.lbRank !== undefined) {
        ctx.fillStyle = isVeryDark(color) ? '#ffffff' : '#0f172a';
        ctx.font = FONT.mono(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(boat.lbRank + 1), 0, 0.5);
    }

    ctx.fillStyle = '#ffffff'; ctx.font = FONT.label(10); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    ctx.fillText(boat.name.toUpperCase(), 0, -13);
    ctx.restore();
}

// ── THE INSTRUMENTS THAT LIVE ON THE BOAT ───────────────────────────────────
//
// SOG, TWS and TWA in a small panel under the player's own hull, instead of in a dial in
// the far corner of the screen. The three numbers a sailor reads constantly were 900 px
// from the thing they describe: you cannot watch your boat and your speed at once, so you
// alternate, and every glance at the corner is a glance away from the water you are
// sailing into. Anchored to the hull they are read with the same fixation as the boat.
//
// DRAWN ON THE CANVAS RATHER THAN AS DOM, like the competitor tags and the edge indicators
// it sits beside — a DOM node chasing a moving world point lags the canvas by a frame and
// shears visibly whenever the camera rotates.
//
// SCREEN SPACE, NOT WORLD SPACE. The panel tracks the hull's position but never its
// rotation: text that rolls over with the camera is unreadable exactly when you are busiest.
// A single unlabelled number, so the box is only as big as it. 34 keeps it clear of the
// transom and its wake without drifting off into water the eye is not already on.
const BI_W = 52, BI_H = 24, BI_DROP = 34;
// Panel colours track the HUD's own (slate-900/60 body, slate-400/30 rim) so this reads as
// the same instrument family as the panels it was moved out of.
const BI_BG = 'rgba(15,23,42,0.62)';
const BI_RIM = 'rgba(148,163,184,0.30)';

// Everything the panel shows, in one place, because two of these numbers are not the raw
// quantity they look like.
function boatInstrumentData(player) {
    const w = getWindAt(player.x, player.y);
    // ⚠️ SOG, NOT BOAT SPEED, and on a tidal venue they are different numbers. `boat.speed`
    // is speed through the WATER — what a log reads — and it says nothing about whether the
    // stream is carrying you or holding you. `boat.velocity` is already the ground vector:
    // the physics adds the current and the swell drift into it and deliberately keeps them
    // out of `boat.speed` (see the note there — "the log reads the same while the sea
    // carries you sideways"). So the honest speed over ground is just its magnitude, and it
    // picks up every set and drift for free rather than re-deriving them here.
    const v = player.velocity || { x: 0, y: 0 };
    const sog = Math.hypot(v.x, v.y) * 4;
    const twa = Math.round(Math.abs(normalizeAngle(player.heading - w.direction)) * (180 / Math.PI));
    // TWS colour, carried over from the retired rose: MORE OR LESS PRESSURE THAN NORMAL FOR
    // THIS COURSE, against the course's own p10/p90 rather than a single centroid sample.
    // Dirty air outranks the field — the number is down because of the boat in front, which
    // is a thing to sail out of rather than a patch of water to look for.
    const P = state.wind.pressure;
    const refMed = P ? P.med : state.wind.speed;
    const refLo = P ? P.lo : refMed - 0.1;
    const refHi = P ? P.hi : refMed + 0.1;
    const badAir = player.badAirIntensity > 0.05;
    const eff = w.speed * (1.0 - player.badAirIntensity);
    let twsCol = '#ffffff';
    if (badAir) twsCol = '#fda4af';
    else if (eff > refHi) twsCol = '#6ee7b7';
    else if (eff < refLo) twsCol = '#fda4af';
    let sogCol = '#ffffff';
    if (player.raceState.penalty || badAir) sogCol = '#f87171';
    else if (player.raceState.isPlaning) sogCol = '#67e8f9';
    const surf = window.Swell && window.Swell.active() ? window.Swell.hud(player) : null;
    // VMG off the GROUND vector too, not through the water — otherwise the rose would show
    // an SOG that includes the tide beside a VMG that ignores it, which is the disagreement
    // this whole refactor exists to prevent. Projected on the wind axis, same convention the
    // physics uses (heading and wind both point the way they are going).
    const vmg = Math.abs(v.x * Math.sin(w.direction) - v.y * Math.cos(w.direction)) * 4;
    return {
        sog, vmg, tws: w.speed, twa, twsCol, sogCol, badAir,
        planing: !!player.raceState.isPlaning,
        surfing: !!(surf && surf.surfing)
    };
}

// ── THE ROSE, WHEN IT IS THE CHOSEN FACE ────────────────────────────────────
// The corner dial, driven from boatInstrumentData — the SAME function the boat panel reads.
// The two faces show one set of numbers computed once, so they cannot drift apart, and it is
// how the rose's speed became SOG without a second definition of SOG existing anywhere.
//
// Transforms run every frame (they track the camera and would judder at 6 Hz); the text runs
// at 6 Hz, as it always did, because a digit flickering at 60 Hz is unreadable.
function roseCue(id, cls, text, on) {
    let el = document.getElementById(id);
    if (!el && UI.speed && UI.speed.parentElement) {
        el = document.createElement('div');
        el.id = id;
        el.className = cls;
        el.textContent = text;
        UI.speed.parentElement.style.position = 'relative';
        UI.speed.parentElement.appendChild(el);
    }
    if (el) el.classList.toggle('hidden', !on);
}

function updateRoseHud(player, localWind) {
    if (UI.compassRose) UI.compassRose.style.transform = `rotate(${-state.camera.rotation}rad)`;
    if (UI.windArrow) UI.windArrow.style.transform = `rotate(${localWind.direction}rad)`;
    if (UI.waypointArrow) UI.waypointArrow.style.transform = `rotate(${player.raceState.nextWaypoint.angle}rad)`;
    if (UI.headingArrow) UI.headingArrow.style.transform = `rotate(${player.heading - state.camera.rotation}rad)`;
    if (frameCount % 10 !== 0) return;
    const d = boatInstruments(player);
    // style.color rather than swapping Tailwind classes: the colour is already decided as a
    // hex by boatInstrumentData, and a class list that has to be scrubbed before every write
    // is how the old block grew a six-name remove() call.
    if (UI.speed) { UI.speed.textContent = d.sog.toFixed(1); UI.speed.style.color = d.sogCol; }
    if (UI.vmg) UI.vmg.textContent = d.vmg.toFixed(1);
    if (UI.windSpeed) { UI.windSpeed.textContent = d.tws.toFixed(1) + (d.badAir ? ' \u2193' : ''); UI.windSpeed.style.color = d.twsCol; }
    if (UI.windAngle) UI.windAngle.textContent = `${d.twa}\u00b0`;
    roseCue('hud-planing-label', 'absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] font-black tracking-widest text-cyan-400 hidden', 'PLANING', d.planing);
    roseCue('hud-surfing-label', 'absolute -top-9 left-1/2 transform -translate-x-1/2 text-[10px] font-black tracking-widest text-amber-300 hidden', 'SURFING', d.surfing);
}

// Show the chosen face and hide the others. The chart moves rather than being toggled: it is
// the one panel you look AT rather than through, so it takes the corner whenever the rose is
// not there and drops below it when it is.
function hudShowsBoat() { const m = settings.hudMode || 'boat'; return m === 'boat' || m === 'both'; }
function hudShowsRose() { const m = settings.hudMode || 'boat'; return m === 'rose' || m === 'both'; }

function applyHudMode() {
    const m = settings.hudMode || 'boat';
    if (UI.hudRose) UI.hudRose.classList.toggle('hidden', !hudShowsRose());
    if (UI.minimapWrap) UI.minimapWrap.classList.toggle('mt-4', hudShowsRose());
}

// ⚠️ ONE SAMPLE, SHARED BY BOTH FACES, AT SIX HZ. Two things forced this. In 'both' mode
// the panel and the rose are on screen together, and they were reading the same quantity at
// different instants — 1.7 under the boat beside 1.9 in the corner, which looks exactly like
// a bug in one of them. And a speed digit recomputed at 60 Hz churns its tenths continuously;
// the rose has always written text at 6 Hz for that reason, so this is the panel adopting the
// rose's cadence rather than the rose being dragged up to the panel's.
//
// Only the NUMBERS are held. The panel's position still tracks the hull every frame — that
// has to be smooth, and it is not what the eye is trying to read.
let _biCache = null, _biBucket = -1, _biWho = null;
function boatInstruments(player) {
    const bucket = Math.floor(frameCount / 10);
    if (_biCache && _biBucket === bucket && _biWho === player) return _biCache;
    _biBucket = bucket; _biWho = player;
    _biCache = boatInstrumentData(player);
    return _biCache;
}

function drawBoatInstruments(ctx, player) {
    if (!hudShowsBoat()) return;
    if (!player || !player.raceState) return;
    if (player.raceState.finished) return;              // nothing left to sail by
    const rot = -state.camera.rotation;
    const dx = player.x - state.camera.x, dy = player.y - state.camera.y;
    const sx = canvas.width / 2 + dx * Math.cos(rot) - dy * Math.sin(rot);
    const sy = canvas.height / 2 + dx * Math.sin(rot) + dy * Math.cos(rot);
    const top = sy + BI_DROP;
    const left = sx - BI_W / 2;
    const d = boatInstruments(player);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(left, top, BI_W, BI_H, 7);
    ctx.fillStyle = BI_BG;
    ctx.fill();
    ctx.strokeStyle = BI_RIM;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ⚠️ ONE NUMBER, AND NO LABEL. This panel sits ON the boat, in the water you are looking
    // at, so every glyph is bought with attention and with pixels of the racecourse. TWA is
    // the one that steers the boat continuously — it is what you trim and what you tack on —
    // and it is the reading that has to be there in peripheral vision. SOG and TWS are
    // consulted rather than watched, and they live on the rose for players who want them.
    //
    // A label would say what a single number already says by being the only one, and it cost
    // as much height again as the number. Same for the dirty-air arrow (an annotation on TWS,
    // meaningless beside a heading angle) and for PLANING and SURFING: those are LATCHED
    // states, so as text they sat lit for seconds at a time, and a caption that is often on
    // stops being read at all.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.font = FONT.mono(15);
    ctx.fillStyle = '#bfdbfe';
    ctx.fillText(d.twa + '°', sx, top + BI_H / 2 + 0.5);
    ctx.restore();
}

// Screen-space snowfall (Arctic): soft flakes drifting down with a light wind
// slant and a per-flake flutter. Own seeded PRNG (`snowRand`) — never
// Math.random (would desync the eval RNG stream). Draw-side only: nothing in
// the sim reads or depends on it.
