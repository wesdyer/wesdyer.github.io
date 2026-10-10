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

        const luff = Math.max(boat.luffIntensity || 0, boat.kiteLuff || 0);
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
        const luff = part === 'spin' ? Math.max(boat.luffIntensity || 0, boat.kiteLuff || 0) : (boat.luffIntensity || 0);
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
    // A fly hangs limp in no air: nothing to draw below half a knot apparent.
    if (boat.apparentWind && boat.isPlayer && boat.apparentWind.speed > 0.5) {
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
        // The arrows belong to the pair: when either boat is fading out, so are they.
        const fade = Math.min(boat.opacity === undefined ? 1 : boat.opacity, target.opacity === undefined ? 1 : target.opacity);
        if (fade <= 0.01) return;
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
        ctx.globalAlpha *= fade;
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

// THE EXIT HEAD: an arrowhead just OUTSIDE a rounding circle, pointing the way the path
// heads next, in the active ring's amber. ⚠️ IT HAS NO ACTIVATION TEST OF ITS OWN — it is
// called by whoever just drew an ACTIVE (amber) ring, with that ring's own radius, so head
// and ring share ONE inZone computation and can never disagree. A mark with a `side` gets
// the tangent-based exit (the rounding's true departure line); a gate mark, radial toward
// the next goal.
function drawRoundingExitHead(ctx, rm, zoneR, nextA) {
    if (!nextA) return;
    let dir, qx, qy;
    if (rm.side && typeof CoursePath !== 'undefined') {
        const sgn = rm.side === 'port' ? -1 : 1;
        const tp = CoursePath._tangent(rm, nextA, sgn, false, null);
        dir = Math.atan2(nextA.y - tp.y, nextA.x - tp.x);
        const ex = Math.cos(dir), ey = Math.sin(dir);
        const ox = tp.x - rm.x, oy = tp.y - rm.y;
        const ou = ox * ex + oy * ey;
        const t = -ou + Math.sqrt(Math.max(0, ou * ou + zoneR * zoneR - (ox * ox + oy * oy)));
        qx = tp.x + ex * t; qy = tp.y + ey * t;
    } else {
        dir = Math.atan2(nextA.y - rm.y, nextA.x - rm.x);
        qx = rm.x + Math.cos(dir) * zoneR; qy = rm.y + Math.sin(dir) * zoneR;
    }
    const ux = Math.cos(dir), uy = Math.sin(dir);
    ctx.save();
    ctx.translate(qx + ux * 16, qy + uy * 16);
    ctx.rotate(dir);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';   // the active ring's amber, solid — no pulse, no glow
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-10, -15); ctx.lineTo(-3, 0); ctx.lineTo(-10, 15); ctx.closePath(); ctx.fill();
    ctx.restore();
}

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
    const v = state.race.venue || settings.venue;
    return v === 'seatrials' || (typeof v === 'string' && v.startsWith('pond'));
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
        // The exit head rides THIS ring's own activation — one test for both.
        if (inZone && typeof CoursePath !== 'undefined' && state.course.route) {
            drawRoundingExitHead(ctx, rm, rm.zone, CoursePath.anchor(state.course.route[player.raceState.leg + 1], state.course.marks));
        }
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
        // A rounding GATE's exit, same instrument: on whichever mark's ring is amber,
        // radial toward the next leg — one inZone test for ring and head alike.
        if (inZone && typeof CoursePath !== 'undefined' && state.course.route) {
            drawRoundingExitHead(ctx, m, 165, CoursePath.anchor(state.course.route[player.raceState.leg + 1], state.course.marks));
        }
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
    // Light rock on the chart (Wes, Oct 4 2026): the old slate (#374151) vanished into Glacier
    // Sound's navy water, the only venue whose rocks are granite.
    granite:  { body: '#9aa3ad', top: '#9aa3ad' },
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
    // ── GLOWTIDE'S JUNGLE, AND THE SAME ARGUMENT RUN THE OTHER WAY ─────────────────
    // `jungle` carries trees: true, so with no row here the chart would take its VEG green.
    // The three notes above all had to pull a ground DOWN to keep it off the water; this one
    // has to hold a ground UP, because the chart water is Glowtide's near-black indigo
    // (#1a2560, luma 40) rather than a daylight blue. A forest painted at bayou or river
    // values would be the darkest thing on the darkest chart in the game.
    //
    // #405A33 lands +37 luma over that water at dE 68.7 — the forest reads as a lit shape on
    // a black chart, which is the honest picture of a moonlit island. Against `karst`, which
    // has no row and therefore charts at its own body (#5d6068, luma 96, +56), it sits dE
    // 31.2 and 18 luma lower: bare limestone shore bright, forested interior a step down and
    // plainly green. That contrast IS the read a player wants off this chart — where the rock
    // is, and where the rock is wooded.
    jungle:    { body: '#405A33', top: '#405A33' },
    meadow:    { body: '#8DAD32', top: '#8DAD32' },
    // ── EMBERFALL ISLE, AND THE ARGUMENT RUN ON A BLACK SEA ─────────────────
    // All four of the venue's grounds take rows, and all four are held UP, the jungle
    // argument: the chart water is a flat 0.9 wash of #123338 (luma 42), the grounds are
    // asked to be nearly black on the course (bodies at luma 29-48, within 13 of the
    // water either way), and the tiles' texture — most of what separates them there — is
    // not on the chart. Basalt lands +40 luma over the water, cinder +35 and warm, black
    // sand +17 as the darkest of the three, keeping the course's own three-way split
    // (cool / warm / neutral) at dE 11-13 from each other. Lava charts as its EMBER, not
    // its crust: it is the hazard, and the one thing on this chart that must not be
    // missable.
    basalt:    { body: '#4C525C', top: '#4C525C' },
    cinder:    { body: '#5C4649', top: '#5C4649' },
    blacksand: { body: '#393B3F', top: '#393B3F' },
    lava:      { body: '#E0561F', top: '#E0561F' },
    // Active lava charts a step yellower and brighter than the hardening tongue: of the
    // two it is the hazard, and the chart should say which is which.
    magma:     { body: '#F5901E', top: '#F5901E' },
    // ── OTTER POINT, AND THE CHART AGREEING WITH THE GROUND ─────────────────
    // Three take rows at their DELIVERED tile means, the river-meadow pattern: the chart
    // water is a 0.9 wash of #268f97 (luma 113) and the grounds already sit where a chart
    // wants them — granite and sand +61, meadow +47. Two rows are needed rather than
    // inherited: `coastalmeadow` and `cypressfloor` carry trees: true, so without a row the
    // chart would take their VEG tones (an olive and a moss) and the gold hills would chart
    // as scrub. Granite and sand chart the same luma and separate on hue alone (dE 20, grey
    // against gold); if that reads as one pale mass, the beach is the one to warm.
    //
    // THE CYPRESS FLOOR CHARTS AS THE CYPRESS, not the floor — the humus rule (Wes,
    // 2026-09-14: 'the color of the cypress leaves instead of the floor'). A wood seen from
    // above is its canopy, and the floor tile (#5F5237, a dark brown) charted as bare dirt.
    // #2F4633 is the shipped otter-cypress-grove sprite's measured mean — the coverage
    // crown, 150 of them on the venue — and lands -52 luma against the chart water, at the
    // dark end of the bayou band, which is where a dark wood belongs.
    coastalgranite: { body: '#BBAC95', top: '#BBAC95' },
    coastalmeadow:  { body: '#BAA24C', top: '#BAA24C' },
    cypressfloor:   { body: '#2F4633', top: '#2F4633' },
    buffsand:       { body: '#CCAB6C', top: '#CCAB6C' },
    // The tidepool shelf charts a step DARKER than its tile (#716350, luma 100 — only -13 against
    // the chart water's 113, the bayou note's 'seven is nothing' case): #5A5045 lands -33, inside
    // the -27..-50 band, so the wet rock round a point reads as rock, not as a shade of sea.
    tidepool:       { body: '#5A5045', top: '#5A5045' },
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
// ── THE CHART PALETTE (PT-019, Oct 2026) ─────────────────────────────────────
// The maps — the race minimap, the venue page, the results map — paint each ground in the colour
// of WHAT IT IS, not of its ground texture: a forest is its canopy, not the duff under it; a
// meadow is grass; a beach is sand; rock is a light stone that never sinks into the water. Bright
// and storybook like the rest of the game, but each venue keeps its own water and mood (the night
// venues stay night). Wes, Oct 4 2026: "it should read like the kinds they aim to represent …
// bright and cheery … while reminding players of what it represents."
//
// Keyed by KIND (not look), because two kinds can share a ground texture and still be different
// things on a chart. `edge` defaults to the fill darkened; `tex` picks the overlay — 'canopy' (soft
// tree dots), 'grain' (faint speckle) or none. Awash/painted zones carry their own alpha.
const CHART_WATER = {
    bay: '#2f9bd6', lake: '#2c8fb3', lagoon: '#1ea2dd', swamp: '#2f8288', river: '#3d998c', ocean: '#1f82c8',
    redrock: '#28b2c9', glowtide: '#283a86', arctic: '#2f6396', otter: '#2a9aab', flats: '#4c87bd',
    volcanic: '#25496d', seatrials: '#2f9bd6', pond: '#3aa0b8'
};
const CHART_KINDS = {
    // forests and scrub: the canopy
    forestfloor: { fill: '#4b9147', tex: 'canopy' }, humus: { fill: '#3f8a52', tex: 'canopy' },
    cypressfloor: { fill: '#3f7f55', tex: 'canopy' }, jungle: { fill: '#2f7d45', tex: 'canopy' },   // a night jungle
    coastalscrub: { fill: '#98b94b', tex: 'canopy' },
    // an ISLE is a beach (Wes, Oct 7 2026): its race look (`tropical`) paints the body sand, and the
    // green on Bay's islands is their own scrub shapes and tree props — so on the chart it is sand too
    isle: { fill: '#ecd7a5', tex: 'grain' },
    tropicscrub: { fill: '#8cc23f', tex: 'canopy' },
    // grass and marsh
    meadow: { fill: '#9fcd55', tex: 'grain' }, coastalmeadow: { fill: '#c5c265', tex: 'grain' },
    reed: { fill: '#7fbe50', tex: 'grain' }, swampgrass: { fill: '#73b043', tex: 'grain' },
    marsh: { fill: '#93b154', tex: 'grain' }, 'flats-marsh': { fill: '#a9b05c', tex: 'grain' },
    lawn: { fill: '#9fd25a', tex: 'grain' }, mossfloor: { fill: '#6fa856', tex: 'canopy' },
    // sand and earth
    lakesand: { fill: '#e8d5a6', tex: 'grain' }, buffsand: { fill: '#e9cd92', tex: 'grain' },
    tropicsand: { fill: '#f5e8cb', tex: 'grain' }, desertsand: { fill: '#ebb27c', tex: 'grain' },
    mud: { fill: '#8d6c47', tex: 'grain' }, lane: { fill: '#e3d9c0' },
    // rock: light stone, warm or cool to suit the venue
    granite: { fill: '#b6bec8', tex: 'grain' }, gneiss: { fill: '#b3b0b3', tex: 'grain' },
    outcrop: { fill: '#b9bcbf', tex: 'grain' }, coastalrock: { fill: '#c4baa8', tex: 'grain' },
    coastalgranite: { fill: '#d6c8ae', tex: 'grain' }, karst: { fill: '#a9aeb6', tex: 'grain' },
    coralrock: { fill: '#d2c9b6', tex: 'grain' }, tidepool: { fill: '#9e8f7b', tex: 'grain' },
    sunkenrock: { fill: '#8893a2' }, cobble: { fill: '#b4aea2', tex: 'grain' },
    redrock: { fill: '#de7b46', tex: 'grain' }, slickrock: { fill: '#f3d7a7', tex: 'grain' },
    coralreef: { fill: '#f59a86', edge: '#c8665a', tex: 'grain' },   // living reef: coral pink, not beach
    // volcanic: still dark, but light enough to read on night water
    // darker (Wes, Oct 7 2026): pale grey read as limestone, not a volcano — toward the race's own basalt
    basalt: { fill: '#565c67', tex: 'grain' }, blacksand: { fill: '#3e4148', tex: 'grain' },
    cinder: { fill: '#79504a', tex: 'grain' }, lava: { fill: '#ff6a2b' }, magma: { fill: '#ff8a3d' },
    // ice
    ice: { fill: '#f4f9ff', edge: '#9fc6e6' }, floe: { fill: '#f4f9ff', edge: '#9fc6e6' },
    // AWASH and painted zones: tints over the water, so they stay water
    shallows: { fill: 'rgba(255,255,255,0.20)', zone: true }, shoal: { fill: 'rgba(250,236,196,0.45)', zone: true },
    // tropicshoal = coral flats: a pink wash over the turquoise
    tropicshoal: { fill: 'rgba(255,170,150,0.38)', zone: true }, cobbleshoal: { fill: 'rgba(200,192,178,0.55)', zone: true },
    mudflat: { fill: 'rgba(170,136,92,0.55)', zone: true }, seagrass: { fill: 'rgba(92,178,112,0.30)', zone: true, tex: 'weed' },
    kelp: { fill: 'rgba(176,138,62,0.40)', zone: true, tex: 'weed' }, lilybed: { fill: 'rgba(116,186,92,0.28)', zone: true, tex: 'weed' },
    // Weed is WATER you can sail, slowly: a faint tint and a scatter of weed strokes, never a fill
    // that reads as land (Gatorgrass's maze vanished under flat yellow-green mats).
    duckweed: { fill: 'rgba(156,206,74,0.26)', zone: true, tex: 'weed' }, weedmat: { fill: 'rgba(126,166,64,0.30)', zone: true, tex: 'weed' },
    weedbed: { fill: 'rgba(96,150,74,0.26)', zone: true, tex: 'weed' },
    // The flats' BARS and SHELVES are not filled (Wes, Oct 7 2026: hard cream crescents and grey slabs
    // over a ground the tide layer already models): Tide.drawMinimap paints them from the field — sand or
    // mud by material, wet or dry by the level — with soft edges, so they read as the ground they are.
    'flats-channel': { fill: 'rgba(40,96,160,0.55)', zone: true }, 'flats-bar': { skip: true, zone: true },
    'flats-pool': { fill: 'rgba(120,170,214,0.6)', zone: true }, 'flats-flat': { skip: true, zone: true },
    'flats-eelgrass': { fill: 'rgba(110,170,104,0.35)', zone: true, tex: 'weed' },
};
function chartKindOf(isl) { return isl && isl.kind ? CHART_KINDS[isl.kind] || null : null; }
function chartShade(hex, f) {
    const s = String(hex).replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(s)) return 'rgba(0,0,0,0.25)';
    const c = [0, 2, 4].map(i => Math.round(parseInt(s.substr(i, 2), 16) * f));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
}
// The two overlays, baked once: a soft canopy of tree dots, and a faint grain.
let _chartTex = null;
function chartTextures(ctx) {
    if (_chartTex) return _chartTex;
    const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); return c; };
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const canopy = mk(g => {
        for (let i = 0; i < 26; i++) {
            const x = r() * 64, y = r() * 64, rad = 2.2 + r() * 2.6;
            g.fillStyle = 'rgba(10,40,20,0.30)'; g.beginPath(); g.arc(x + 0.8, y + 1, rad, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(255,255,220,0.22)'; g.beginPath(); g.arc(x - 0.6, y - 0.7, rad * 0.55, 0, Math.PI * 2); g.fill();
        }
    });
    const grain = mk(g => {
        for (let i = 0; i < 140; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'; g.fillRect(r() * 64, r() * 64, 1.2, 1.2); }
    });
    const weed = mk(g => {
        g.lineCap = 'round';
        for (let i = 0; i < 22; i++) {
            const x = r() * 64, y = r() * 64, a = (r() - 0.5) * 1.2, L = 3 + r() * 3;
            g.strokeStyle = r() < 0.5 ? 'rgba(150,210,80,0.85)' : 'rgba(90,150,60,0.85)'; g.lineWidth = 1.3;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * L, y - Math.cos(a) * L); g.stroke();
        }
    });
    _chartTex = { canopy: ctx.createPattern(canopy, 'repeat'), grain: ctx.createPattern(grain, 'repeat'), weed: ctx.createPattern(weed, 'repeat') };
    return _chartTex;
}

// ── THE CHART FINISH (PT-019, round 2, Oct 2026) ────────────────────────────
// Wes found the tiled textures "a little too regular", and the research agreed: a repeated tile is
// what the eye catches. So nothing here tiles. Everything is placed per shape and baked once into
// the chart's cached layers:
//   · DEPTH TINT — pale shallows along every coast fading to the venue's water, from a coarse
//     distance-to-land field (Felzenszwalb–Huttenlocher EDT on a ~360 px mask).
//   · WATERLINES — two or three thin ripples following the coast, the old chart-maker's figure-
//     ground trick (Huffman, "On Waterlines"); traced as exact offsets of the land union.
//   · LAND — a soft drop shadow, a light rim just inside the coast, and a gentle large-scale
//     lightness variation, so no fill is a flat bucket of paint.
//   · GLYPHS — trees, specks and weed strokes on a jittered world-space lattice per shape (stable
//     under zoom and pan), density swayed by low-frequency noise into groves and clearings, a few
//     tree shapes at varied size. Hashed per cell, so a venue always draws the same.
// The small race minimap keeps depth, waterline, shadow and rim; glyphs would only be noise there.
function chartRng(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
function chartSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
function chartNoise(seed) {
    const hash = (i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + seed) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
    return (x, y) => vn(x, y) * 0.65 + vn(x * 2.13 + 5.2, y * 2.13 - 1.7) * 0.35;   // 0..1
}
// CHART CORNERS, ROUNDED (Wes, Oct 5 2026: Sockeye's slabs met the forest in knife points). Each
// vertex is replaced by a short quadratic between points `r` back along its two edges (capped at a
// third of each edge), in world units, cached on the island. Chart only — colliders keep their
// corners. A keyholed shape keeps its ring, since rounding would pry its zero-width slits open.
const CHART_CORNER_R = 180;
function chartVerts(isl) {
    if (!isl || !isl.vertices) return [];
    if (isl._chartVerts && isl._chartVertsOf === isl.vertices) return isl._chartVerts;
    const V = isl.vertices, n = V.length;
    let out = V;
    if (n >= 4 && !(isl.holes && isl.holes.length) && !isl.isFloe) {
        out = [];
        for (let i = 0; i < n; i++) {
            const a = V[(i - 1 + n) % n], b = V[i], c = V[(i + 1) % n];
            const la = Math.hypot(b.x - a.x, b.y - a.y), lc = Math.hypot(c.x - b.x, c.y - b.y);
            const ra = Math.min(CHART_CORNER_R, la / 3), rc = Math.min(CHART_CORNER_R, lc / 3);
            if (la < 1e-6 || lc < 1e-6) { out.push(b); continue; }
            // Only a real CORNER is rounded (a turn past ~35°). A gentle vertex — a curve's sampling,
            // or an edge two shapes share — stays exact, so neighbours never part along it.
            const turn = Math.abs(Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)));
            if (turn < 0.6) { out.push(b); continue; }
            const p0 = { x: b.x + (a.x - b.x) * ra / la, y: b.y + (a.y - b.y) * ra / la };
            const p2 = { x: b.x + (c.x - b.x) * rc / lc, y: b.y + (c.y - b.y) * rc / lc };
            for (let k = 0; k <= 4; k++) {
                const u = k / 4, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u;
                out.push({ x: w0 * p0.x + w1 * b.x + w2 * p2.x, y: w0 * p0.y + w1 * b.y + w2 * p2.y });
            }
        }
    }
    isl._chartVerts = out; isl._chartVertsOf = isl.vertices;
    return out;
}
// A shape's rings for drawing: its outer and holes as SEPARATE subpaths (filled even-odd) when it has
// holes — the keyholed single ring joins them with a zero-width slit, which anti-aliases into a hairline
// across the land — and the corner-rounded single ring otherwise.
function chartRings(isl) {
    if (isl.holes && isl.holes.length && isl.outerRing) return [isl.outerRing].concat(isl.holes);
    return [chartVerts(isl)];
}
function chartRingsPath(target, isl, t) {
    for (const r of chartRings(isl)) { r.forEach((v, i) => { const p = t(v.x, v.y); i ? target.lineTo(p.x, p.y) : target.moveTo(p.x, p.y); }); target.closePath(); }
}
// Standing land the finish works from: backdrop (unclipped) and authored (clipped to the ring).
function chartStanding(list) { return (list || []).filter(i => i && i.vertices && i.vertices.length > 2 && !i.hidden && !i.awash && !i.paint && !i.isFloe && !i.reef); }
// 1-D squared distance transform (Felzenszwalb & Huttenlocher).
function chartEdt1(f, n, d, v, z) {
    let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < n; q++) {
        let s2 = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s2 <= z[k]) { k--; s2 = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s2; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
function chartEdt(seedMask, w, h) {          // distance (px) from every pixel to the nearest seed
    const INF = 1e20, g = new Float64Array(w * h), n = Math.max(w, h);
    const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let i = 0; i < w * h; i++) g[i] = seedMask[i] ? 0 : INF;
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; chartEdt1(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; chartEdt1(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]); }
    return g;
}
// The land union drawn into `g` (already transformed to chart px), backdrop free, authored inside the ring.
function chartFillLand(g, t, bd, au, ring, stroke) {
    const path = (vs) => { g.beginPath(); vs.forEach((v, i) => { const p = t(v.x, v.y); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath(); };
    const shape = (isl) => { g.beginPath(); chartRingsPath(g, isl, t); };
    for (const isl of bd) { shape(isl); g.fill('evenodd'); if (stroke) g.stroke(); }
    if (ring) { g.save(); path(ring); g.clip(); }
    for (const isl of au) { shape(isl); g.fill('evenodd'); if (stroke) g.stroke(); }
    if (ring) g.restore();
}
// The fields one chart needs, built once per static-layer key.
let _chartFx = { key: null };
// ROCKS IN THE WATER are props (Otter's stacks, pinnacles, reef rocks), compiled as hidden colliders that
// take surf: the chart's coast — the shallows and the waterlines — is measured round them too (Wes,
// Oct 7 2026). Only natural rock: no building, bridge, pier, quay, wall, piling, weir, beacon, wreck,
// or tree (a trunk's collider is not a coast).
const CHART_NOT_ROCK = /bridge|pier|dock|quay|wall|piling|float|trestle|weir|beacon|kaap|wreck|containers|marina|terminal|mill|shed|shack|house|light|boat|mark|buoy|oak|tree|palm|pine|spruce|trunk/;
function chartPropRocks() {
    const c = state.course, doc = c.doc, VD = window.VenueDoc;
    if (!doc || !VD) return [];
    const kindOf = new Map((doc.props || []).map(p => [p.id, p.kind]));
    return (c.islands || []).filter(i => {
        if (!i.propSurf || !i.vertices || i.vertices.length < 3 || i.awash) return false;
        const kind = kindOf.get(String(i.id).split('.hit')[0]), K = kind && VD.PROP_KINDS[kind];
        return !!K && !K.chartBuilding && !K.chartSpan && !CHART_NOT_ROCK.test(kind);
    });
}
function chartFields(key, width, height, t, venueKey) {
    if (_chartFx.key === key) return _chartFx;
    const bd = chartStanding(state.course.backdrop), au = chartStanding(state.course.islands).concat(chartPropRocks());
    const ring = (state.course.backdrop && state.course.backdrop.length) ? state.course.backdropRing : null;
    const ds = Math.max(1, Math.ceil(Math.max(width, height) / 360));
    const mw = Math.ceil(width / ds), mh = Math.ceil(height / ds);
    const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
    const g = mc.getContext('2d'); g.scale(1 / ds, 1 / ds); g.fillStyle = '#fff';
    // stroked too, a mask pixel wide: where two shapes meet edge to edge the coarse mask otherwise
    // leaves a slit of "water", and the rim light glows along every internal seam (Wes, Oct 5 2026)
    g.strokeStyle = '#fff'; g.lineWidth = ds * 1.5; g.lineJoin = 'round';
    chartFillLand(g, t, bd, au, ring, true);
    const px = g.getImageData(0, 0, mw, mh).data;
    const land = new Uint8Array(mw * mh); for (let i = 0; i < mw * mh; i++) land[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    const water = new Uint8Array(mw * mh); for (let i = 0; i < mw * mh; i++) water[i] = land[i] ? 0 : 1;
    // Waterlines ring HARD shores only — a sedge island or a marsh you can push through is not a
    // coast, and ringing them turned the bayou's maze into contour lines.
    const hard = (l) => l.filter(i => !i.soft);
    _chartFx = { key, ds, mw, mh, land, toLand: chartEdt(land, mw, mh), toWater: chartEdt(water, mw, mh), bd, au, ring,
                 bdHard: hard(bd), auHard: hard(au),
                 noise: chartNoise(chartSeed(String(venueKey || 'chart'))) };
    return _chartFx;
}
// Water: depth tint (and nothing on land, which is painted over it).
// SHALLOWS TOWARD A COLOUR, not white, where the water is dark (Wes, Oct 7 2026: Emberfall's navy lifted
// toward white made a grey haze the colour of its basalt, and the coast smeared into it). Unlisted
// venues keep the lift toward white.
const CHART_SHALLOW = { volcanic: '#5a9cc0' };
function chartDepthCanvas(F, waterHex, width, shallowHex) {
    const c = document.createElement('canvas'); c.width = F.mw; c.height = F.mh;
    const g = c.getContext('2d'), img = g.createImageData(F.mw, F.mh), D = img.data;
    const s = String(waterHex).replace('#', ''), W = [0, 2, 4].map(i => parseInt(s.substr(i, 2), 16));
    const T = shallowHex ? [1, 3, 5].map(i => parseInt(shallowHex.substr(i, 2), 16)) : [255, 255, 255];
    const LIFT = shallowHex ? 0.75 : 0.40;   // toward a colour the lift can go further without washing out
    const band = Math.max(3, width * 0.03) / F.ds, deep = band * 5;
    for (let i = 0; i < F.mw * F.mh; i++) {
        const dd = F.toLand[i];
        const sh = Math.max(0, 1 - dd / band); const shallow = sh * sh * (3 - 2 * sh);     // smooth
        const dp = Math.min(1, Math.max(0, (dd - band) / deep));
        const lift = LIFT * shallow, sink = 0.10 * dp;
        D[i * 4] = W[0] + (T[0] - W[0]) * lift - W[0] * sink;
        D[i * 4 + 1] = W[1] + (T[1] - W[1]) * lift - W[1] * sink;
        D[i * 4 + 2] = W[2] + (T[2] - W[2]) * lift - W[2] * sink;
        D[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}
// Waterlines: rings at given offsets (chart px) around the land union, faded outward.
function chartWaterlines(mc, F, t, width, height, offsets, lw) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round';
    offsets.forEach((d, k) => {
        g.clearRect(0, 0, width, height);
        g.globalCompositeOperation = 'source-over'; g.fillStyle = g.strokeStyle = '#fff'; g.lineWidth = 2 * (d + lw / 2);
        chartFillLand(g, t, F.bdHard, F.auHard, F.ring, true);
        g.globalCompositeOperation = 'destination-out'; g.lineWidth = Math.max(0.01, 2 * (d - lw / 2));
        chartFillLand(g, t, F.bdHard, F.auHard, F.ring, d - lw / 2 > 0.2);
        mc.save(); mc.globalAlpha = [0.42, 0.24, 0.13, 0.08][k] || 0.08; mc.drawImage(c, 0, 0); mc.restore();
    });
}
// Land overlay: a light rim inside the coast and the large-scale lightness variation.
function chartLandOverlay(F, worldOf) {
    const c = document.createElement('canvas'); c.width = F.mw; c.height = F.mh;
    const g = c.getContext('2d'), img = g.createImageData(F.mw, F.mh), D = img.data;
    const rimW = 4;
    for (let y = 0; y < F.mh; y++) for (let x = 0; x < F.mw; x++) {
        const i = y * F.mw + x;
        if (!F.land[i]) continue;
        const rim = Math.max(0, 1 - F.toWater[i] / rimW);
        const [wx, wy] = worldOf((x + 0.5) * F.ds, (y + 0.5) * F.ds);
        const n = F.noise(wx / 2200, wy / 2200) * 2 - 1;
        const L = rim * 0.20 + n * 0.09;
        const v = L > 0 ? 255 : 0;
        D[i * 4] = D[i * 4 + 1] = D[i * 4 + 2] = v; D[i * 4 + 3] = Math.min(255, Math.abs(L) * 255);
    }
    g.putImageData(img, 0, 0);
    return c;
}
// THE GLYPH LAYER, BY KIND (Wes, Oct 5 2026: seams showed as lines of cut trees). Trees, specks and weed
// are scattered over each KIND's whole visible area — every shape of it, authored or surround, merged —
// from one world lattice seeded by the kind, so no shape boundary inside a forest can show. The
// visible area comes from a kind map: every standing shape painted in draw order, each kind its own
// colour, so a meadow laid over a forest takes its ground away from the trees as it does on screen.
function chartGlyphLayer(mc, order, ring, t, unit, worldOf, noise, budget, ringOut) {
    const W = mc.canvas.width, H = mc.canvas.height;
    const ms = Math.max(1, unit * 0.5), mw = Math.ceil(W / ms), mh = Math.ceil(H / ms);
    const kinds = [];
    for (const o of order) { const ck = chartKindOf(o.isl); if (ck && ck.tex && !ck.zone && !kinds.includes(o.isl.kind)) kinds.push(o.isl.kind); }
    if (!kinds.length) return;
    const km = document.createElement('canvas'); km.width = mw; km.height = mh;
    const g = km.getContext('2d'); g.setTransform(1 / ms, 0, 0, 1 / ms, 0, 0); g.imageSmoothingEnabled = false;
    const path = (isl) => { const P = new Path2D(); chartRingsPath(P, isl, t); return P; };
    const ringP = ring ? (() => { const P = new Path2D(); ring.forEach((v, i) => { const p = t(v.x, v.y); i ? P.lineTo(p.x, p.y) : P.moveTo(p.x, p.y); }); P.closePath(); return P; })() : null;
    // colour = kind index + 1 in the red channel (0 = water / untextured land)
    for (const o of order) {
        const k = kinds.indexOf(o.isl.kind) + 1;
        g.save();
        if (o.clip && ringP) { const P = new Path2D(); P.rect(-10, -10, W + 20, H + 20); P.addPath(ringP); g.clip(P, 'evenodd'); }   // the surround: outside the ring
        else if (!o.clip && ringOut) { const P = new Path2D(); ringOut.forEach((v, i) => { const p = t(v.x, v.y); i ? P.lineTo(p.x, p.y) : P.moveTo(p.x, p.y); }); P.closePath(); g.clip(P); }   // authored: inside the pushed ring
        g.fillStyle = `rgb(${k},0,0)`;
        g.fill(path(o.isl), 'evenodd');
        g.restore();
    }
    const px = g.getImageData(0, 0, mw, mh).data;
    kinds.forEach((kindName, ki) => {
        const ck = CHART_KINDS[kindName];
        const out = new Uint8Array(mw * mh); let any = false;
        for (let i = 0; i < mw * mh; i++) { const inK = px[i * 4] === ki + 1 && px[i * 4 + 3] > 127; out[i] = inK ? 0 : 1; if (inK) any = true; }
        if (!any) return;
        const dIn = chartEdt(out, mw, mh);
        const at = (x, y) => { const i = Math.floor(x / ms), j = Math.floor(y / ms); return (i < 0 || j < 0 || i >= mw || j >= mh) ? 0 : dIn[j * mw + i] * ms; };
        chartGlyphsAt(mc, kindName, ck, at, { x0: 0, y0: 0, x1: W, y1: H }, unit, worldOf, noise, budget);
    });
}

// The glyphs for one shape: 'canopy' trees, 'grain' specks, 'weed' strokes. Inside/outside comes
// from a small mask of the shape (one fill, then array reads) rather than isPointInPath per test,
// which was most of the bake on the river's long banks.
function chartGlyphs(mc, isl, ck, t, unit, worldOf, noise, budget) {
    const P = new Path2D(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    chartVerts(isl).forEach((v, i) => { const p = t(v.x, v.y); i ? P.lineTo(p.x, p.y) : P.moveTo(p.x, p.y); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    P.closePath();
    x0 = Math.max(x0, 0); y0 = Math.max(y0, 0); x1 = Math.min(x1, mc.canvas.width); y1 = Math.min(y1, mc.canvas.height);
    if (x1 - x0 < unit * 2 || y1 - y0 < unit * 2) return 0;
    const kind = ck.tex;
    const r = kind === 'canopy' ? unit * 2.6 : kind === 'weed' ? unit * 2.2 : unit * 2.4;
    const edge = kind === 'canopy' ? r * 0.7 : r * 0.4;
    // the shape's mask, at ~1 glyph-unit resolution, eroded by `edge` via its own distance field
    const ms = Math.max(1, unit * 0.5), mw = Math.ceil((x1 - x0) / ms) + 1, mh = Math.ceil((y1 - y0) / ms) + 1;
    const mcv = document.createElement('canvas'); mcv.width = mw; mcv.height = mh;
    const mg = mcv.getContext('2d'); mg.setTransform(1 / ms, 0, 0, 1 / ms, -x0 / ms, -y0 / ms); mg.fillStyle = '#fff'; mg.fill(P, 'evenodd');
    const px = mg.getImageData(0, 0, mw, mh).data, out = new Uint8Array(mw * mh);
    for (let i = 0; i < mw * mh; i++) out[i] = px[i * 4 + 3] > 127 ? 0 : 1;
    const dIn = chartEdt(out, mw, mh);           // distance to outside, in mask px
    const at = (x, y) => { const i = Math.floor((x - x0) / ms), j = Math.floor((y - y0) / ms); return (i < 0 || j < 0 || i >= mw || j >= mh) ? 0 : dIn[j * mw + i] * ms; };
    return chartGlyphsAt(mc, isl.kind, ck, at, { x0, y0, x1, y1 }, unit, worldOf, noise, budget);
}
// Scatter and draw one kind's glyphs where `at(x, y)` (distance inside its area, panel px) allows.
function chartGlyphsAt(mc, kindName, ck, at, box, unit, worldOf, noise, budget) {
    const { x0, y0, x1, y1 } = box;
    const kind = ck.tex, base = String(ck.fill);
    const r = kind === 'canopy' ? unit * 2.6 : kind === 'weed' ? unit * 2.2 : unit * 2.4;
    const edge = kind === 'canopy' ? r * 0.7 : r * 0.4;
    // STABLE IN THE WORLD (Wes, Oct 5 2026: zooming reshuffled every tree). Points sit on a jittered
    // lattice in WORLD units, its spacing the glyph spacing rounded to a power of two — so within a
    // zoom band every tree keeps its place, and the band changes only when the zoom doubles (the map's
    // crossfade covers that). Each point's jitter, keep-roll and shape come from a hash of its cell,
    // not from a sequence, so the same tree is the same tree from any view.
    const [wa, wb] = worldOf(0, 0), [wc, wd] = worldOf(1, 0);
    const pxPerU = 1 / Math.hypot(wc - wa, wd - wb);
    const L = Math.round(Math.log2(r / pxPerU)), sw = Math.pow(2, L);
    const seedK = chartSeed(String(kindName) + L);   // by KIND: one lattice across every shape of it
    const hash = (i, j, k) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1442695041) + seedK) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const corners = [worldOf(x0, y0), worldOf(x1, y0), worldOf(x0, y1), worldOf(x1, y1)];
    let gx0 = Infinity, gx1 = -Infinity, gy0 = Infinity, gy1 = -Infinity;
    for (const [cx2, cy2] of corners) { gx0 = Math.min(gx0, cx2); gx1 = Math.max(gx1, cx2); gy0 = Math.min(gy0, cy2); gy1 = Math.max(gy1, cy2); }
    const i0 = Math.floor(gx0 / sw) - 1, i1 = Math.ceil(gx1 / sw) + 1, j0 = Math.floor(gy0 / sw) - 1, j1 = Math.ceil(gy1 / sw) + 1;
    if ((i1 - i0) * (j1 - j0) > 4e5) return 0;
    // world -> panel: the inverse of worldOf, from three samples (it is affine)
    const [ox, oy] = worldOf(0, 0), [ux, uy] = worldOf(1, 0), [vx, vy] = worldOf(0, 1);
    const ax = ux - ox, ay = uy - oy, bx2 = vx - ox, by2 = vy - oy, det = ax * by2 - bx2 * ay;
    const toPanel = (wx, wy) => { const dx = wx - ox, dy = wy - oy; return [(dx * by2 - dy * bx2) / det, (ax * dy - ay * dx) / det]; };
    const pts = [];
    for (let j = j0; j <= j1 && pts.length < budget; j++) for (let i = i0; i <= i1; i++) {
        const wx = (i + 0.15 + 0.7 * hash(i, j, 1)) * sw, wy = (j + 0.15 + 0.7 * hash(i, j, 2)) * sw;
        const [px, py] = toPanel(wx, wy);
        if (px < x0 || py < y0 || px > x1 || py > y1) continue;
        if (at(px, py) < edge) continue;
        const n = noise(wx / 1600 + 31.7, wy / 1600 - 12.3);
        const keep = kind === 'canopy' ? 0.15 + 0.95 * n : 0.25 + 0.75 * n;
        if (hash(i, j, 3) > keep) continue;
        pts.push([px, py, hash(i, j, 4), hash(i, j, 5), hash(i, j, 6)]);
    }
    const dark = base.startsWith('#') ? chartShade(base, 0.68) : 'rgba(40,70,30,0.6)';
    const lite = base.startsWith('#') ? chartShade(base, 1.18) : 'rgba(200,230,140,0.6)';
    for (const [x, y, h1, h2, h3] of pts) {
        let hk = 0; const rnd2 = () => [h1, h2, h3][hk++ % 3];
        const sc = 0.85 + rnd2() * 0.3;
        if (kind === 'canopy') {
            const rr = unit * 1.15 * sc, v = rnd2();
            mc.fillStyle = 'rgba(10,35,25,0.28)'; mc.beginPath(); mc.arc(x + rr * 0.35, y + rr * 0.45, rr, 0, Math.PI * 2); mc.fill();
            mc.fillStyle = dark; mc.beginPath();
            if (v < 0.25) { mc.arc(x - rr * 0.45, y, rr * 0.75, 0, Math.PI * 2); mc.arc(x + rr * 0.45, y + rr * 0.1, rr * 0.75, 0, Math.PI * 2); }
            else mc.arc(x, y, rr * (v < 0.5 ? 0.8 : 1), 0, Math.PI * 2);
            mc.fill();
            mc.fillStyle = lite; mc.globalAlpha = 0.55; mc.beginPath(); mc.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.38, 0, Math.PI * 2); mc.fill(); mc.globalAlpha = 1;
        } else if (kind === 'weed') {
            const a = (rnd2() - 0.5) * 1.4, L = unit * (1.2 + rnd2() * 0.9);
            mc.strokeStyle = rnd2() < 0.5 ? 'rgba(150,210,80,0.75)' : 'rgba(80,140,60,0.75)'; mc.lineWidth = Math.max(0.8, unit * 0.45); mc.lineCap = 'round';
            mc.beginPath(); mc.moveTo(x, y); mc.quadraticCurveTo(x + Math.sin(a) * L * 0.6 + L * 0.2, y - Math.cos(a) * L * 0.5, x + Math.sin(a) * L, y - Math.cos(a) * L); mc.stroke();
        } else {
            mc.fillStyle = rnd2() < 0.55 ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.16)';
            mc.beginPath(); mc.arc(x, y, Math.max(0.6, unit * 0.35 * sc), 0, Math.PI * 2); mc.fill();
        }
    }
    return pts.length;
}

function minimapIsland(style) {
    const row = MINIMAP_ISLAND[style];
    if (row) return row;
    const st = ISLAND_STYLES[style];
    if (!st) return MINIMAP_ISLAND.ice;      // an unknown style keeps the old default
    return { body: st.body, top: st.trees ? (st.veg || st.body) : st.body };
}

// ── THE PROPS THE CHART HAS TO SHOW ─────────────────────────────────────────
// A hard prop is compiled into a HIDDEN isle, so the land pass above skips it, and a sea stack
// standing in open water (Otter Point's stacks, arches and pinnacles) was missing from the one
// map you plan a route on. Wes, Sep 26 2026: the chart shows the bridges, abstracted, and the
// large hard props in the water. Two rules:
//   · a kind with `chartSpan` (a bridge) draws as its deck — a line down the sprite-up axis in
//     that colour — with its towers (the collider rings) as solid blocks on it;
//   · any other fixed hard prop at least MM_PROP_MIN across whose outline is mostly OFF the
//     visible land draws as its collider outline in stone. One already standing on a charted
//     shape (a whaleback on the meadow) is on the map already and stays off.
// The list is built once per course; the shapes go into the cached land layer.
const MM_PROP_MIN = 120;          // world units; ~1 px on Otter's chart, 2 on the Cove's
const MM_PROP_STONE = '#B9AE9C';  // Otter's charted granite, a step cooler — rock or pier alike
function minimapProps() {
    const c = state.course;
    if (c._mmProps) return c._mmProps;
    const out = c._mmProps = [];
    // (landforms first — the ground everything else on them stands on; see the sort at the end)
    const doc = c.doc, VD = window.VenueDoc;
    if (!doc || !VD || !VD.propHitRings) return out;
    const vis = (c.islands || []).filter(i => !i.hidden && !i.awash && !i.paint && i.vertices && i.vertices.length > 2);
    const onVis = (x, y) => vis.some(i => {
        const dx = x - i.x, dy = y - i.y;
        return dx * dx + dy * dy <= i.radius * i.radius && pointInVerts(x, y, i.vertices);
    });
    for (const p of doc.props || []) {
        const K = VD.PROP_KINDS[p.kind];
        if (!K) continue;
        const T = VD.propTraits(p);
        if (T.motion !== 'fixed') continue;
        const w = K.world * (p.scale || 1);
        // BUILDINGS (Wes, Oct 7 2026): every house, shed, lodge and light, hard or not, as its painted
        // footprint (prop_outlines' `paint`, turned and scaled like the sprite) in its roof colour.
        // ...and the big LANDFORMS the same way (volcanoes, peaks, nunataks, mesas), at their true size.
        if (K.chartBuilding || K.chartLandform) {
            const O = (window.PROP_OUTLINES || {})[p.kind];
            if (O && O.paint && O.paint.length) {
                const f = w / O.world, h = p.heading || 0, c0 = Math.cos(h), s0 = Math.sin(h);
                const rings = O.paint.map(r => r.map(q => [p.x + q[0] * f * c0 - q[1] * f * s0, p.y + q[0] * f * s0 + q[1] * f * c0]));
                if (K.chartLandform) out.push({ landform: true, flat: !!K.chartFlat, crack: /crevasse/.test(p.kind), volcano: /volcano/.test(p.kind), p, w, rings, color: K.chartLandform });
                else out.push({ building: true, p, w, rings, color: K.chartBuilding });
            }
            continue;
        }
        // A SPAN the chart always draws, hard or not: a bridge is a landmark whether or not a hull can
        // touch it (Sockeye's footbridge stops nothing — Wes, Oct 6 2026). Its hard parts, if any, as towers.
        if (K.chartSpan) { out.push({ span: true, p, w, rings: T.contact === 'hard' ? (VD.propHitRings(p).rings || []) : [], color: K.chartSpan, axis: K.chartSpanAxis || 'y', len: K.chartSpanLen || 0.46, width: K.chartSpanWidth || 0.08 }); continue; }
        if (T.contact !== 'hard') continue;
        const rings = VD.propHitRings(p).rings || [];
        if (w < MM_PROP_MIN || !rings.length) continue;
        let n = 0, on = 0;
        for (const r of rings) for (const v of r) { n++; if (onVis(v[0], v[1])) on++; }
        if (on > n * 0.5) continue;
        out.push({ span: false, p, w, rings });
    }
    out.sort((a, b) => (b.landform ? 1 : 0) - (a.landform ? 1 : 0));
    return out;
}
// LANDMARKS THE CHART MUST SHOW (Wes, Oct 5 2026): the volcanoes — the thing Emberfall is about —
// as cones with a glowing crater, at every size; and on the larger maps every coral head, which is a
// hard collision however small (the size floor above drops them). Drawn over the land layer.
function drawChartLandmarks(mc, t, scale, width) {
    const doc = state.course.doc, VD = window.VenueDoc;
    if (!doc || !VD) return;
    const big = width >= 420, u = width / 180;
    for (const p of doc.props || []) {
        const K = VD.PROP_KINDS[p.kind]; if (!K) continue;
        const q = t(p.x, p.y), wr = K.world * (p.scale || 1) * 0.5 * scale;
        // (volcanoes are LANDFORMS now — drawMinimapProps, at their true size; the capped cone is gone)
        if (big && /coral/.test(p.kind)) {
            const r = Math.max(1.6 * u / 2.2, Math.min(wr, 6));
            mc.fillStyle = '#ff8e7c'; mc.strokeStyle = 'rgba(120,40,40,0.6)'; mc.lineWidth = 1;
            mc.beginPath(); mc.arc(q.x, q.y, r, 0, Math.PI * 2); mc.fill(); mc.stroke();
        }
    }
}
function drawMinimapProps(mc, t, scale) {
    const ringPath = (r) => {
        mc.beginPath();
        r.forEach((v, i) => { const q = t(v[0], v[1]); i ? mc.lineTo(q.x, q.y) : mc.moveTo(q.x, q.y); });
        mc.closePath();
    };
    const hexRGB = (h) => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
    const mix = (c, to, k) => `rgb(${c.map((v, i) => Math.round(v + (to[i] - v) * k)).join(',')})`;
    for (const m of minimapProps()) {
        if (m.landform && m.crack) {
            // A CREVASSE is a crack, not a slab: its traced outline takes in the snow rim, so the chart
            // draws the crack itself — a tapered line along the outline's long axis, dark blue inside a
            // pale lip, as wide as a third of the outline across.
            const P = [].concat(...m.rings); let mx = 0, my = 0; for (const v of P) { mx += v[0]; my += v[1]; } mx /= P.length; my /= P.length;
            let sxx = 0, syy = 0, sxy = 0; for (const v of P) { const dx = v[0] - mx, dy = v[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
            const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(ang), uy = Math.sin(ang);
            let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
            for (const v of P) { const a = (v[0] - mx) * ux + (v[1] - my) * uy, bb = -(v[0] - mx) * uy + (v[1] - my) * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, bb); b1 = Math.max(b1, bb); }
            const half = Math.max(0.6 / scale, (b1 - b0) * 0.17), N = 12, side = [], other = [];
            for (let i = 0; i <= N; i++) { const f = i / N, a = a0 + (a1 - a0) * f, wv = half * Math.pow(Math.sin(Math.PI * f), 0.6);
                side.push(t(mx + ux * a - uy * wv, my + uy * a + ux * wv)); other.push(t(mx + ux * a + uy * wv, my + uy * a - ux * wv)); }
            mc.beginPath(); side.forEach((q, i) => i ? mc.lineTo(q.x, q.y) : mc.moveTo(q.x, q.y)); for (let i = other.length - 1; i >= 0; i--) mc.lineTo(other[i].x, other[i].y); mc.closePath();
            mc.lineJoin = 'round'; mc.strokeStyle = 'rgba(214,232,245,0.95)'; mc.lineWidth = 2; mc.stroke();
            mc.fillStyle = '#3f74a0'; mc.fill();
            continue;
        }
        if (m.landform) {
            // THE LANDFORM at its true size: its footprint lit from the north-west and shaded to the
            // south-east (the chart's relief), a shade-darker edge; a volcano adds its crater, glowing.
            const c = hexRGB(m.color);
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (const r of m.rings) for (const v of r) { const q = t(v[0], v[1]); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
            const size = Math.max(x1 - x0, y1 - y0), q0 = t(m.p.x, m.p.y);
            if (size < 4) { mc.fillStyle = mix(c, [255, 255, 255], 0.1); mc.beginPath(); mc.arc(q0.x, q0.y, 2, 0, Math.PI * 2); mc.fill(); }
            else {
                let g;
                if (m.flat) g = mix(c, [255, 255, 255], 0);
                else {
                    g = mc.createLinearGradient(x0, y0, x1, y1);
                    g.addColorStop(0, mix(c, [255, 255, 255], 0.28)); g.addColorStop(0.55, mix(c, [255, 255, 255], 0.05)); g.addColorStop(1, mix(c, [0, 0, 0], 0.28));
                }
                mc.fillStyle = g; mc.strokeStyle = mix(c, [0, 0, 0], m.flat ? 0.12 : 0.4); mc.lineWidth = 1; mc.lineJoin = 'round';
                for (const r of m.rings) { ringPath(r); mc.fill(); mc.stroke(); }
            }
            if (m.volcano) {
                const r = Math.max(1.8, size * 0.14);
                const cg = mc.createRadialGradient(q0.x, q0.y, 0, q0.x, q0.y, r);
                cg.addColorStop(0, '#ffe08a'); cg.addColorStop(0.5, '#ff7a2b'); cg.addColorStop(1, 'rgba(200,40,20,0.9)');
                mc.fillStyle = cg; mc.beginPath(); mc.arc(q0.x, q0.y, r, 0, Math.PI * 2); mc.fill();
            }
            continue;
        }
        if (m.building) {
            // the roof, lifted a fifth toward white and cased, so a dark roof still reads on dark
            // ground; never smaller than a few px, so a cottage on the race's minimap is still a dot
            const [r0, g0, b0] = [1, 3, 5].map(i => parseInt(m.color.substr(i, 2), 16)), L = (v) => Math.round(v + (255 - v) * 0.2);
            mc.fillStyle = `rgb(${L(r0)},${L(g0)},${L(b0)})`; mc.strokeStyle = 'rgba(10,20,30,0.55)'; mc.lineWidth = 1; mc.lineJoin = 'round';
            if (m.w * scale < 3.5) { const q = t(m.p.x, m.p.y); mc.fillRect(q.x - 1.6, q.y - 1.6, 3.2, 3.2); mc.strokeRect(q.x - 1.6, q.y - 1.6, 3.2, 3.2); continue; }
            for (const r of m.rings) { ringPath(r); mc.fill(); mc.stroke(); }
            continue;
        }
        if (!m.span) {
            mc.fillStyle = MM_PROP_STONE;
            for (const r of m.rings) { ringPath(r); mc.fill(); }
            continue;
        }
        // THE DECK: end to end along sprite-up (0.46 of the drawn size each way — the bakes'
        // 92% fill), on a dark casing so a pale bridge still reads over pale water.
        const h = m.p.heading || 0, L = m.len * m.w;
        const ux = m.axis === 'x' ? Math.cos(h) : Math.sin(h), uy = m.axis === 'x' ? Math.sin(h) : -Math.cos(h);
        const a = t(m.p.x - ux * L, m.p.y - uy * L), b = t(m.p.x + ux * L, m.p.y + uy * L);
        // never thinner than a trail: a span is the way across, and under ~4 px it read as a crack
        const lw = Math.max(4.5, m.width * m.w * scale);
        mc.lineCap = 'butt';
        mc.beginPath(); mc.moveTo(a.x, a.y); mc.lineTo(b.x, b.y);
        mc.strokeStyle = 'rgba(10,20,30,0.45)'; mc.lineWidth = lw + 1.5; mc.stroke();
        mc.strokeStyle = m.color; mc.lineWidth = lw; mc.stroke();
        // THE TOWERS, solid on the deck — the only parts that stop a hull or the wind.
        mc.fillStyle = m.color; mc.strokeStyle = 'rgba(10,20,30,0.45)'; mc.lineWidth = 1;
        for (const r of m.rings) { ringPath(r); mc.fill(); mc.stroke(); }
    }
}

// ── THE BIG MAP ─────────────────────────────────────────────────────────────
// M, or a click on the chart, grows it 3x and back (Wes, Sep 26 2026). It grows from its own
// top-right corner, left and down over the water, lifted out of the HUD column so nothing
// else moves: a same-size placeholder holds its place in the flow. The canvas is REDRAWN at
// the new size rather than stretched, so the chart stays sharp — drawMinimap reads the
// canvas's own width, and its cached layers key on it. The glyphs (boats, marks) keep their
// pixel size, so the bigger chart shows more of the water, not bigger arrows.
const MINIMAP_SMALL = 160, MINIMAP_BIG_SCALE = 3;
let minimapBig = false;
function toggleMinimapSize(big) {
    const wrap = document.getElementById('hud-minimap-wrap');
    const cv = document.getElementById('minimap');
    if (!wrap || !cv) return;
    minimapBig = typeof big === 'boolean' ? big : !minimapBig;
    let hold = document.getElementById('hud-minimap-hold');
    if (minimapBig) {
        if (!hold) {
            hold = document.createElement('div'); hold.id = 'hud-minimap-hold';
            wrap.parentElement.insertBefore(hold, wrap);
        }
        // measured before the lift: where the small chart's top-right corner sits in the column
        const col = wrap.parentElement, top = wrap.offsetTop, right = col.clientWidth - (wrap.offsetLeft + wrap.offsetWidth);
        hold.className = wrap.className.replace(/\bmt-\d+\b/g, '') + ' invisible';
        hold.style.cssText = `width:${wrap.offsetWidth}px; height:${wrap.offsetHeight}px; margin-top:${getComputedStyle(wrap).marginTop};`;
        const px = MINIMAP_SMALL * MINIMAP_BIG_SCALE;
        Object.assign(wrap.style, { position: 'absolute', top: top + 'px', right: right + 'px', width: px + 'px', height: px + 'px', zIndex: 30, cursor: 'zoom-out', marginTop: '0' });
        cv.width = px; cv.height = px;
        wrap.title = 'Shrink map (M)';
    } else {
        if (hold) hold.remove();
        Object.assign(wrap.style, { position: '', top: '', right: '', width: '', height: '', zIndex: '', cursor: 'zoom-in', marginTop: '' });
        cv.width = MINIMAP_SMALL; cv.height = MINIMAP_SMALL;
        wrap.title = 'Enlarge map (M)';
    }
    window._occCache = null;          // the mark chips re-read what the chart now covers
    if (typeof drawMinimap === 'function') { try { drawMinimap(); } catch (e) {} }
}
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
    const wrap = document.getElementById('hud-minimap-wrap');
    if (wrap) wrap.addEventListener('click', (e) => { e.stopPropagation(); toggleMinimapSize(); });
});
// The anchor is measured when it grows; a resize moves the column, so measure again.
if (typeof window !== 'undefined') window.addEventListener('resize', () => { if (minimapBig) { toggleMinimapSize(false); toggleMinimapSize(true); } });

// A still layer of the chart: repainted only when `key` changes (see drawMinimap).
const _mmLayers = {};
function mmStaticLayer(name, key, w, h) {
    let L = _mmLayers[name];
    if (!L) { L = _mmLayers[name] = { key: null, cv: document.createElement('canvas'), g: null, course: null }; L.g = L.cv.getContext('2d'); }
    const fresh = L.key !== key || L.course !== state.course || L.cv.width !== w || L.cv.height !== h;
    if (fresh) { L.cv.width = w; L.cv.height = h; L.g.clearRect(0, 0, w, h); L.key = key; L.course = state.course; }
    L.fresh = fresh;
    return L;
}

// drawMinimap.target = { ctx } draws the chart onto another canvas instead — the Time Trials results map —
// with no boats, leaving the projection in drawMinimap.last ({ cx, cy, scale, width, height }) for whatever
// the caller draws on top (the run's track).
function drawMinimap() {
    if (!minimapCtx) { const c = document.getElementById('minimap'); if(c) minimapCtx = c.getContext('2d'); }
    const ctx = (drawMinimap.target && drawMinimap.target.ctx) || minimapCtx;
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
    // Sailing School lifts the arena to the horizon (School.start), so its chart frames
    // the player and the marks the way a mask-less venue does.
    // (A school SCREEN's preview asks for the whole pond, like the clubhouse would.)
    const wholeMap = state.course.doc && (!(window.School && School.active) || School._previewWhole);
    const schoolBounds = !wholeMap && window.School && School.active && School.minimapBounds && School.minimapBounds();
    if (schoolBounds) {
        // Sailing School on the pond: the chart frames the WATER, whole, and no more.
        minX = schoolBounds.minX; maxX = schoolBounds.maxX; minY = schoolBounds.minY; maxY = schoolBounds.maxY;
    } else if (wholeMap) {
        // Follows the ARENA rather than MASK_WORLD, so it tracks a scaled map and a
        // polygon boundary instead of a constant that no longer describes either. THE
        // ARENA'S LONG AXIS JUST FITS: the chart is for racing, so the water you may
        // sail claims the whole frame, and the scenery beyond the limit shows only as
        // far as the frame's own margins let it (the whole-canvas water fill below is
        // what keeps that cropped scenery sitting on sea rather than on glass). This
        // deliberately reverts an experiment that grew the extent to take in all
        // scenery — an atoll ring 3x the arena shrank the racing to a postage stamp.
        // A school preview frames the DOCUMENT's arena: the race lifts the live one to the
        // horizon, which would put the whole pond in one pixel.
        const e = Arena.extent((window.School && School._previewBounds) || state.course.boundary);
        minX = e.minX; maxX = e.maxX; minY = e.minY; maxY = e.maxY;
    }
    // A borrowed target may name the exact world box to paint (the venue page's map renders the
    // panel's own window — rotated, cropped to the course — at the panel's resolution).
    const tgtExtent = drawMinimap.target && drawMinimap.target.extent;
    if (tgtExtent) { minX = tgtExtent.minX; maxX = tgtExtent.maxX; minY = tgtExtent.minY; maxY = tgtExtent.maxY; }
    const pad = (wholeMap || tgtExtent) ? 0 : (schoolBounds ? 60 : 200);
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
    // ── THE CHART'S STILL LAYERS ARE CACHED ──────────────────────────────────
    // A doc venue's chart shows the whole map, so its water, its painted zones and its
    // land never move: they were being re-painted every frame — Otter's 115 polygons,
    // ~75 fills — for a 160-px picture that changes only when the venue or the palette
    // does. Two layers, because the gusts and squalls draw BETWEEN them (water below,
    // land above): each is a canvas keyed on the course, the frame, the palette and the
    // projection, repainted only when the key changes and blitted otherwise. Generated
    // venues and the school's follow-the-boat chart keep the live path.
    const mmKey = wholeMap ? [width, height, cx.toFixed(2), cy.toFixed(2), scale.toFixed(6),
                              (window.WATER_CONFIG || {}).baseColor, (window.WATER_CONFIG || {}).heroColor].join('|') : null;
    const L1 = mmKey ? mmStaticLayer('zones', mmKey, width, height) : null;
    if (!L1 || L1.fresh) {
    let mc = L1 ? L1.g : ctx;
    const mmPoly = (verts) => {
            mc.beginPath();
            if (verts.length) {
                const p0 = t(verts[0].x, verts[0].y);
                mc.moveTo(p0.x, p0.y);
                for (let i = 1; i < verts.length; i++) { const p = t(verts[i].x, verts[i].y); mc.lineTo(p.x, p.y); }
            }
            mc.closePath();
        };
        if (state.course.doc && window.WATER_CONFIG) {
            const rgbOf = (h, fb) => {
                const s = String(h || '').replace('#', '');
                return /^[0-9a-f]{6}$/i.test(s) ? [0, 2, 4].map(i => parseInt(s.substr(i, 2), 16)) : fb;
            };
            const chartWater = CHART_WATER[state.course.venueKey] || null;
            const base = rgbOf(chartWater || window.WATER_CONFIG.baseColor, [14, 79, 134]);
            // The WHOLE canvas, not the extent rect: the frame's spare margins show cropped
            // scenery from beyond the arena, and that scenery must sit on sea, not on glass.
            // The chart's water (CHART_WATER) is opaque and brighter than the course's own.
            mc.fillStyle = chartWater || `rgba(${base[0]},${base[1]},${base[2]},0.9)`;
            mc.fillRect(0, 0, width, height);
            // THE CHART FINISH (see chartFields): depth tint, then waterlines, both baked here.
            if (chartWater && mmKey) {
                const F = chartFields(mmKey + '|' + ((state.course.backdrop || []).length), width, height, t, state.course.venueKey);
                mc.save(); mc.imageSmoothingEnabled = true; mc.imageSmoothingQuality = 'high';
                mc.drawImage(chartDepthCanvas(F, chartWater, width, CHART_SHALLOW[state.course.venueKey]), 0, 0, F.mw * F.ds, F.mh * F.ds);
                mc.restore();
                const u = width / 180;
                if (width >= 420) chartWaterlines(mc, F, t, width, height, [1.5 * u, 3.4 * u, 5.8 * u], Math.max(1, u * 0.2));
                else chartWaterlines(mc, F, t, width, height, [Math.max(2, 1.8 * u)], 1);
            }
            // Painted zones, in document order: shallows in the hero water, meadows in the
            // same submerged olive the course bakes.
            const hero = rgbOf(window.WATER_CONFIG.heroColor || window.WATER_CONFIG.baseColor, base);
            // Zones stop at the backdrop's ring too (see the land pass): past it the backdrop
            // owns the chart.
            const zRing = state.course.backdrop && state.course.backdrop.length ? state.course.backdropRing : null;
            // Zones fade out across the ring like the land does (a hard clip left Spoonbill's
            // tidal flats as a rectangle): they draw into their own layer, masked softly below.
            // Zones are NOT clipped at the ring: they are tints on the water, the backdrop has none to
            // continue them, and a clip cut every shoal crossing the ring into a straight-edged wedge.
            const zClip = true;   // paint zones (shallows tints) stop at the ring; awash bars and reefs do not (land pass)
            if (zRing && zClip) { mc.save(); mmPoly(zRing); mc.clip(); }
            for (const isl of state.course.islands || []) {
                if (!isl.paint || isl.hidden || !isl.vertices) continue;
                mmPoly(isl.vertices);
                const ckz = chartKindOf(isl);
                if (ckz && ckz.zone) {
                    mc.fillStyle = ckz.fill; mc.fill('evenodd');
                    if (ckz.tex && width >= 420) chartGlyphs(mc, isl, ckz, t, width / 180,
                        (x, y) => [(x - width / 2) / scale + cx, (y - height / 2) / scale + cy], chartNoise(chartSeed(String(state.course.venueKey))), 4000);
                    continue;
                }
                // A vegetated zone shows in its own plant's darkest tone; a bare tint zone
                // shows in the hero water. Reads the same VEG_STYLES row the bed itself
                // bakes from, so the map and the world cannot drift apart.
                const spec = isl.veg ? VEG_STYLES[isl.veg] : null;
                mc.fillStyle = spec
                    ? `rgba(${vegTone(spec.tones[0], spec).join(',')},0.55)`
                    : `rgba(${hero[0]},${hero[1]},${hero[2]},0.9)`;
                mc.fill('evenodd');
            }
            if (zRing && zClip) mc.restore();
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
    }
    if (L1) ctx.drawImage(L1.cv, 0, 0);
    // THE TIDE ON THE CHART (Spoonbill Flats): the flats as they are NOW — dry ground in
    // sand, the shallows pale — over the still water and under the land, so the little map
    // shows the estuary emptying and filling. Its own small cache; see Tide.drawMinimap.
    if (window.Tide && state.tide && wholeMap) Tide.drawMinimap(ctx, cx, cy, scale, width, height);

    // The venue page's map shows the MEDIAN day (Wes, Oct 4 2026): no puffs, lulls or squalls —
    // they are instants, and a preview that froze one would plan the race round weather that
    // will not be there.
    const medianOnly = !!(drawMinimap.target && drawMinimap.target.terrainOnly);
    const _gc = (typeof activeGustColors !== 'undefined' && activeGustColors) || null;
    drawMinimap._key = null;
    if (_gc && !medianOnly) {
        // PT-038 (Wes: "how do I tell which one's which on this mini-map?" ... "more like a sharper-edge
        // thing"): the chart speaks the WIND COMETS' language, the same on every venue — a gust is warm
        // (gold, where the comet scale goes when the wind builds) and a lull is cool (ice), so the hue
        // alone says more or less wind; and each cell is a flat core with a crisp rim, the lull's rim
        // dashed, so the shape says it too for anyone the colours fail. The venue's own water tints
        // (palette.gusts) stay on the course itself, where they are the water showing through.
        const gustC = [255, 196, 72], lullC = [196, 160, 255];   // gold (more wind), lavender (less)
        let anyGust = false, anyLull = false;
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
            // A plateau, then a short shoulder to the rim: an edge you can see, without the hard
            // disc that read as a fog bank where a big lull outgrows an arm of the lake.
            const a0 = Math.min(0.55, peak * 0.85);
            grad.addColorStop(0, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a0.toFixed(3)})`);
            grad.addColorStop(0.72, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(a0 * 0.8).toFixed(3)})`);
            grad.addColorStop(1, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(a0 * 0.35).toFixed(3)})`);
            ctx.beginPath();
            ctx.arc(ox, 0, R, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            // A ring at the cell's true extent, weather-chart style: crisp, and dashed for a lull.
            // (Drawn in the cell's scaled frame, so the dash and width are divided back out.)
            const sy = g.radiusY / g.radiusX;
            ctx.lineWidth = 1.6 / Math.max(0.3, Math.min(1, sy));
            ctx.setLineDash(g.type === 'gust' ? [] : [4, 3]);
            ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.min(0.95, 0.55 + strength * 0.4).toFixed(3)})`;
            ctx.stroke();
            ctx.restore();
            if (g.type === 'gust') anyGust = true; else anyLull = true;
        }
        drawMinimap._key = (anyGust || anyLull) ? { anyGust, anyLull, gustC, lullC } : null;
    }

    // Squalls: the weather worth planning around, drawn as its shadow — a dark cell
    // with a rim, heavier than a puff because it IS heavier than a puff.
    if (state.squalls && !medianOnly) {
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

    const L2 = mmKey ? mmStaticLayer('land', mmKey, width, height) : null;
    if (!L2 || L2.fresh) {
    let mc = L2 ? L2.g : ctx;
    let glyphJob = null;   // the per-kind glyph layer, drawn once the ring clip is lifted (chartGlyphLayer)
    if (state.course.islands) {
            // Body first. Shoals draw their body and are then skipped by the cap pass below:
            // the cap is vegetation or snow, and a bar under water has neither. Paint zones
            // are not islands at all — they were drawn with the water above.
            //
            // ⚠️ `hidden`, NOT `isBank` — see the note in drawIslands. isBank is "out of the
            // router", which is a different question from "do not draw", and the chart has to
            // agree with the water about what is there.
            // THE BACKDROP first (venuedoc.js): beyond its ring — a camera's reach past the
            // boundary — the backdrop owns the chart, so the authored land, shoals, caps and
            // props are clipped to the ring and no slab an author left out there shows its
            // ruler-straight edge. Inside the ring nothing changes.
            const bdRing = state.course.backdrop && state.course.backdrop.length ? state.course.backdropRing : null;
            // The chart finish on land: a soft drop shadow under the whole land union first.
            const chartOn = !!(mmKey && CHART_WATER[state.course.venueKey]);
            const cu = width / 180;
            const chartF = chartOn ? chartFields(mmKey + '|' + ((state.course.backdrop || []).length), width, height, t, state.course.venueKey) : null;
            const worldOf = (x, y) => [(x - width / 2) / scale + cx, (y - height / 2) / scale + cy];
            if (chartF) {
                mc.save(); mc.fillStyle = 'rgb(22,44,52)';   // opaque: a shadow takes its strength from the fill, and the land covers it
                mc.shadowColor = 'rgba(0,28,48,0.38)'; mc.shadowBlur = Math.max(2, cu * 1.4); mc.shadowOffsetY = Math.max(1, cu * 0.6);
                chartFillLand(mc, t, chartF.bd, chartF.au, chartF.ring, false);
                mc.restore();
            }
            // Awash shapes (bars, reefs) are water, and the backdrop has none to continue them: they
            // draw BEFORE the clip, uncut, so a bar crossing the ring keeps its shape.
            const auWet = state.course.islands.filter(i => i.awash || i.reef), auDry = state.course.islands.filter(i => !(i.awash || i.reef));
            // THE SURROUND GOES ON TOP, clipped to OUTSIDE the ring (Wes, Oct 5 2026). The authored land
            // draws whole first; the surround then covers everything past the ring. A clip's edge is
            // anti-aliased, and with this order its half-covered pixels blend surround over the same
            // authored ground carrying on past the ring — no seam — where the old order (authored cut
            // to the inside, over the surround) let the ground beneath show through as a faint line.
            // The authored land is cut at the ring pushed ~2 px OUTWARD (the ring is star-shaped about
            // the arena's middle, so a radial push is an exact offset): the surround's soft edge then
            // lies over solid authored ground — no seam — while authored slabs past the ring still go.
            const bdOut = bdRing ? (() => {
                let mx = 0, my = 0; for (const v of bdRing) { mx += v.x; my += v.y; } mx /= bdRing.length; my /= bdRing.length;
                const push = 2.5 / scale;
                return bdRing.map(v => { const dx = v.x - mx, dy = v.y - my, d = Math.hypot(dx, dy) || 1; return { x: v.x + dx / d * push, y: v.y + dy / d * push }; });
            })() : null;
            if (bdOut) { mc.save(); mc.beginPath(); bdOut.forEach((v, i) => { const p = t(v.x, v.y); i ? mc.lineTo(p.x, p.y) : mc.moveTo(p.x, p.y); }); mc.closePath(); mc.clip(); }
            // No ring (the venue's own shapes run past the map line, the far ones map-only): the map-only
            // land draws LAST, over the race land. It stops exactly at the line and the race land runs on
            // under it, so its edge lies over solid ground — drawn underneath, every race layer ending at
            // the line let the ones below show through as a hairline (Otter's meadow under its forest).
            const bdList = state.course.backdrop || [];
            // ...in DOCUMENT ORDER (Oct 7 2026). The generated continuations (`sur-*`) sit at the end of the
            // document, so they still draw last; but a shape the designer placed early that happens to lie
            // wholly past the line (Otter's buff-sand beach, under its cypress floor) keeps its place, instead
            // of being lifted over everything authored after it.
            let mmLand;
            if (bdRing) mmLand = auWet.concat(auDry, ['clip'], state.course.backdrop);
            else {
                const ord = new Map(); (state.course.doc && state.course.doc.shapes || []).forEach((sh, i) => ord.set(sh.id, i));
                const all = state.course.islands.concat(bdList), key = (isl, k) => ord.has(isl.id) ? ord.get(isl.id) : 1e6 + k;
                mmLand = all.map((isl, k) => [key(isl, k), k, isl]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(e => e[2]);
            }
            let clipped = false; glyphJob = { order: [], cu, worldOf, noise: chartF ? chartF.noise : null, ringOut: bdOut, lanes: [] };
            for (const isl of mmLand) {
                if (isl === 'clip') {
                    clipped = true;
                    mc.restore();                      // lift the authored clip
                    mc.save(); mc.beginPath();
                    mc.rect(-10, -10, width + 20, height + 20);
                    bdRing.forEach((v, i) => { const p = t(v.x, v.y); i ? mc.lineTo(p.x, p.y) : mc.moveTo(p.x, p.y); });
                    mc.closePath(); mc.clip('evenodd');
                    continue;
                }
                if (isl.hidden || isl.paint) continue;
                const ck = chartKindOf(isl);
                if (ck && ck.skip) continue;   // drawn by another layer (the tide's field)
                // TRAILS GO ON TOP (Wes, Oct 6 2026: Sockeye's south trail vanished under a copse that
                // came after it in the document). A trail is a line across the ground, never ground other
                // ground lies on — so it is painted after every fill and the trees' glyphs (below).
                if (ck && isl.kind === 'lane') { glyphJob.lanes.push(isl); continue; }
                mc.fillStyle = ck ? ck.fill
                    : isl.reef
                    ? `rgba(${submergedTint(REEF_RUBBLE[1]).join(',')},0.6)`   // the band's own drowned khaki
                    : isl.awash
                    ? `rgba(${shoalTintFor(isl).join(',')},0.6)`
                    : isl.fromMask
                    ? minimapIsland(isl.style).top
                    : minimapIsland(isl.style).body;
                mc.beginPath();
                if (ck) chartRingsPath(mc, isl, t);   // the chart's rounded corners; holes as their own rings
                else {
                    const cvs = isl.vertices;
                    if (cvs.length > 0) { const p0 = t(cvs[0].x, cvs[0].y); mc.moveTo(p0.x, p0.y); for (let i = 1; i < cvs.length; i++) { const pi = t(cvs[i].x, cvs[i].y); mc.lineTo(pi.x, pi.y); } }
                    mc.closePath();
                }
                // even-odd: mask rings are keyholed (the sound is a hole in the land)
                mc.fill('evenodd');
                // A hairline of the fill's own colour closes the anti-aliasing seam where two shapes meet
                // edge to edge — otherwise the ground beneath bleeds through as a faint line (Wes, Oct 5
                // 2026). Not on keyholed rings, whose slits would draw as lines across the water.
                if (ck && !ck.zone && !isl.awash && (!(isl.holes && isl.holes.length) || isl.outerRing)) {
                    mc.strokeStyle = mc.fillStyle; mc.lineWidth = 1.25; mc.lineJoin = 'round'; mc.stroke();
                }
                // The chart finish (PT-019): a canopy or a grain over the ground, and a coast a
                // shade darker than the land so a shore reads as a line. Standing land only — an
                // awash zone is water and stays a clean tint.
                // Glyphs come later, over each kind's whole area (chartGlyphLayer), and there are no
                // per-shape outlines: both drew every internal shape boundary as a seam (Wes, Oct 5
                // 2026). The coast is drawn by the rim light and the depth tint, which see only land
                // and water.
                if (ck && !ck.zone && !isl.awash && chartF && width >= 420) glyphJob.order.push({ isl, clip: clipped });
            }
            // Center cap (vegetation on land, snow on ice)
            for (const isl of state.course.islands) {
                if (isl.hidden || isl.awash) continue;
                // Mask shapes are keyholed; an inset "cap" ring is meaningless and
                // paints blobs across the water.
                if (isl.fromMask) continue;
                mc.fillStyle = minimapIsland(isl.style).top;
                mc.beginPath();
                if (isl.vegVertices.length > 0) {
                    const p0 = t(isl.vegVertices[0].x, isl.vegVertices[0].y);
                    mc.moveTo(p0.x, p0.y);
                    for(let i=1; i<isl.vegVertices.length; i++) {
                        const pi = t(isl.vegVertices[i].x, isl.vegVertices[i].y);
                        mc.lineTo(pi.x, pi.y);
                    }
                }
                mc.closePath();
                mc.fill();
            }
        }
        if (state.course.islands && state.course.backdrop && state.course.backdrop.length && state.course.backdropRing) mc.restore();   // the ring clip
        if (glyphJob && glyphJob.order.length) chartGlyphLayer(mc, glyphJob.order, state.course.backdrop && state.course.backdrop.length ? state.course.backdropRing : null, t, glyphJob.cu, glyphJob.worldOf, glyphJob.noise, 9000, glyphJob.ringOut);
        // the trails, over the ground and its glyphs (see TRAILS GO ON TOP)
        if (glyphJob && glyphJob.lanes.length) for (const isl of glyphJob.lanes) {
            const ck = chartKindOf(isl);
            mc.fillStyle = ck.fill; mc.beginPath(); chartRingsPath(mc, isl, t); mc.fill('evenodd');
            mc.strokeStyle = ck.fill; mc.lineWidth = 1.25; mc.lineJoin = 'round'; mc.stroke();
        }
        // the props — landforms, buildings, bridges, hard rocks — over the ground, its glyphs and its
        // trails (Oct 7 2026: a forest's tree glyphs used to draw over a cabin among them)
        if (state.course.doc) drawMinimapProps(mc, t, scale);
        if (state.course.doc && CHART_WATER[state.course.venueKey]) drawChartLandmarks(mc, t, scale, width);
        // The rim light inside every coast and the large-scale variation across the fills.
        if (state.course.islands && mmKey && CHART_WATER[state.course.venueKey]) {
            const F = chartFields(mmKey + '|' + ((state.course.backdrop || []).length), width, height, t, state.course.venueKey);
            mc.save(); mc.imageSmoothingEnabled = true; mc.imageSmoothingQuality = 'high';
            mc.drawImage(chartLandOverlay(F, (x, y) => [(x - width / 2) / scale + cx, (y - height / 2) / scale + cy]), 0, 0, F.mw * F.ds, F.mh * F.ds);
            mc.restore();
        }
    }
    if (L2) ctx.drawImage(L2.cv, 0, 0);
    // The cuts' names only on a chart big enough to read them (Wes, Sep 26 2026): the small HUD
    // chart leaves them off, the enlarged one (M) and the bigger previews keep them.
    if (window.Tide && state.tide && wholeMap && Tide.drawMinimapLabels && width > MINIMAP_SMALL) Tide.drawMinimapLabels(ctx, cx, cy, scale, width, height);

    // The venue page wants the water and land only: it draws its own course on top.
    if (drawMinimap.target && drawMinimap.target.terrainOnly) return;

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
        if (window.School && (School.hideMark(m1) || School.hideMark(m2))) return;
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
    const courseOff = window.School && School.courseHidden();
    const drawn = {};
    for (const e of (courseOff ? [] : (state.course.route || []))) {
        if (!e.marks) continue;
        const key = e.marks.join(',');
        if (drawn[key]) continue;
        drawn[key] = true;
        drawG(e.marks[0], e.marks[1], active.indexOf(e.marks[0]) !== -1);
    }

    // Every other mark: small, cool and quiet.
    const mkR = (state.course.doc && !(window.School && School.active)) ? 0.6 : 1;
    for (let i = 0; i < (courseOff ? 0 : state.course.marks.length); i++) {
        if (active.includes(i)) continue;
        const m = state.course.marks[i];
        if (roundMark && m === roundMark) continue;
        if (window.School && School.hideMark(m)) continue;
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
    for (const i of (courseOff ? [] : active)) {
        const m = state.course.marks[i];
        if (m) { const p = t(m.x, m.y); beacon(p.x, p.y, 4.2); }
    }
    if (window.School && School.active) School.drawMinimapExtras(ctx, t, beacon);
    if (roundMark && !courseOff) {
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

    if (drawMinimap.target) { drawMinimap.last = { cx, cy, scale, width, height }; return; }
    // Boats
    // Marker size. These were tuned when the minimap framed player+marks; a
    // mask venue shows the WHOLE map, where a fixed 8px arrow is a boat the size
    // of an island and the fleet becomes one coloured smear. Shrink to match.
    const mk = (state.course.doc && !(window.School && School.active)) ? 0.55 : 1;

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

    // TIME TRIALS: your ghost, as a hollow arrow the size of yours — the same shape says "you",
    // the missing fill says "not really". Under your own arrow.
    const gp = window.TimeTrial && TimeTrial.solo() && TimeTrial._ghost && state.race.status !== 'waiting'
        ? TimeTrial.poseAt(state.race.status === 'prestart' ? -state.race.timer : state.race.timer) : null;
    if (gp) {
        const pos = t(gp.x, gp.y);
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(gp.heading);
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8.5); ctx.lineTo(0, 5); ctx.lineTo(-7, 8.5); ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
        ctx.setLineDash([3, 2]); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
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
    // THE GUST / LULL KEY (PT-038), drawn last so land and the fleet never cover it: the two swatches as the
    // chart draws them, so "which one's which" is answered on the chart itself.
    const K = !medianOnly && drawMinimap._key;
    if (K) {
    const { anyGust, anyLull, gustC, lullC } = K;
        const fs = Math.max(9, Math.round(Math.min(width, height) * 0.055));
        ctx.save();
        ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`; ctx.textBaseline = 'middle';
        const items = [anyGust && ['gust', gustC, false], anyLull && ['lull', lullC, true]].filter(Boolean);
        let x = fs * 0.7; const y = height - fs * 0.9, r = fs * 0.42;
        const w = items.reduce((acc, [lbl]) => acc + r * 2 + fs * 0.35 + ctx.measureText(lbl).width + fs * 0.8, fs * 0.2);
        ctx.fillStyle = 'rgba(6, 14, 26, 0.6)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - fs * 0.35, y - fs * 0.75, w, fs * 1.5, fs * 0.4) : ctx.rect(x - fs * 0.35, y - fs * 0.75, w, fs * 1.5); ctx.fill();
        for (const [lbl, c, dashed] of items) {
            ctx.beginPath(); ctx.arc(x + r, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.45)`; ctx.fill();
            ctx.setLineDash(dashed ? [3, 2] : []); ctx.lineWidth = 1.4; ctx.strokeStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`; ctx.stroke();
            ctx.setLineDash([]); ctx.fillStyle = '#e6eef8'; ctx.fillText(lbl, x + r * 2 + fs * 0.35, y);
            x += r * 2 + fs * 0.35 + ctx.measureText(lbl).width + fs * 0.8;
        }
        ctx.restore();
    }
    // Fried electronics: the chart tears and goes to static until it reboots (volcano.js).
    if (window.Volcano && state.volcano && Volcano.hudFried('minimap')) Volcano.drawMinimapFry(ctx);
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
    const totalRaceDist = (state.course.goalFields && state.course.goalFields.rankable && state.course.goalFields.total)
        || (state.course.dmc && state.course.dmc.total) || (state.race.totalLegs * len);


    // ...and not in a SOLO TIME TRIAL: a board of you and your ghost said nothing the splits panel does
    // not say better (PT-008, Wes: "almost completely useless"); hud-tt-splits stands in its place
    if (state.race.status === 'prestart' || (window.School && School.lesson()) || (window.TimeTrial && TimeTrial.solo())) {
         UI.leaderboard.classList.add('hidden');
         return;
    }
    UI.leaderboard.classList.remove('hidden');

    // TIME TRIALS: your ghost races on the board as a boat would (TimeTrial.leaderEntry). Its progress
    // comes from the recorded run, not from getBoatProgress.
    const ghost = window.TimeTrial ? TimeTrial.leaderEntry() : null;
    const prog = (b) => (b.isGhost && !b.raceState.finished) ? b.ghostProgress : getBoatProgress(b);
    // Sort boats
    const sorted = [...state.boats, ...(ghost ? [ghost] : [])].sort((a, b) => {
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

        // 2. Progress — the whole course remaining, continuous through every rounding and gate
        //    (courseRemaining). NOT leg first: a boat round the mark but not yet credited is
        //    where she is, and sorting by leg let a late credit drop her down the board (PT-006).
        const pA = prog(a);
        const pB = prog(b);
        return pB - pA;
    });
    if (ghost) ghost.prevRank = ghost.lbRank;

    const leader = sorted[0];
    const leaderProgress = prog(leader);

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
            const faceName = boat.face || boat.name;
            if (faceImg && faceImg.dataset.face !== faceName) {
                faceImg.dataset.face = faceName;
                faceImg.src = "assets/images/competitors/" + faceName.toLowerCase() + ".png";
            }
            if (faceImg) faceImg.style.opacity = boat.isGhost ? '0.45' : '';

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
            nameDiv.style.color = boat.isGhost ? '#94a3b8'
                                : boat.raceState.penalty ? '#f87171'
                                : me ? me
                                : dnx ? '#64748b' : '#ffffff';
            if (boat.isGhost) row.style.background = 'rgba(148,163,184,0.10)';
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
                        const diff = Math.max(0, totalRaceDist - prog(boat));
                        distDiv.textContent = "+" + Math.round(diff * 0.2) + "m";
                    }
                } else {
                    const diff = Math.max(0, leaderProgress - prog(boat));
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
// THE GOAL CHIP — promoted above every other edge marker. It rides the overlay canvas
// (above the leaderboard, minimap and rose: the next mark is the most important thing on
// screen), sits on a dark plate so it reads on any water, keeps the rounding-direction arc,
// and carries the distance in a pill of its own. Pulses once when the leg changes so the
// eye reacquires the new goal.
// THE CHIP'S DOT SAYS WHAT TO DO (Wes, Oct 5 2026): green — round it to starboard (keep it on your
// right); red — round it to port; yellow — sail through the gate. A start or finish is not a dot at
// all but the line glyph (lineChipSpec). Absent, the side decides it, and green is the old default.
const CHIP_COLORS = { starboard: '#22c55e', port: '#ef4444', through: '#facc15' };
function chipColorFor(side, kindHint) {
    if (kindHint && CHIP_COLORS[kindHint]) return CHIP_COLORS[kindHint];
    return side === 'port' ? CHIP_COLORS.port : CHIP_COLORS.starboard;
}
// The line glyph: { color, chequer, countdown, rim }. A bar — the line itself; a finish
// is chequered; before the gun the countdown sits on the plate over a short bar.
function drawChipLineGlyph(ctx, o) {
    const col = o.color || '#ffffff';
    if (o.rim) { ctx.beginPath(); ctx.arc(0, 0, 25.5, 0, Math.PI * 2); ctx.strokeStyle = o.rim; ctx.lineWidth = 3; ctx.stroke(); }
    if (o.countdown != null) {
        ctx.fillStyle = '#ffffff'; ctx.font = FONT.mono(o.countdown.length > 3 ? 12 : 15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(o.countdown, 0, -3);
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-12, 8, 24, 3.5, 1.75); ctx.fill();
        return;
    }
    const L = 13, h = 5;
    if (o.chequer) {
        for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
            ctx.fillStyle = (i + j) % 2 ? '#0f172a' : '#ffffff';
            ctx.fillRect(-L + i * (2 * L / 6), -h + j * h, 2 * L / 6, h);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(-L, -h, 2 * L, 2 * h);
    } else {
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-L, -2.2, 2 * L, 4.4, 2.2); ctx.fill();
    }
    // No posts at the ends (Wes, Oct 5 2026): at chip size the dots were clutter; the bar is the line.
    if (o.go) {   // after the gun: a forward chevron above — cross it now
        ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-5, -9); ctx.lineTo(0, -14); ctx.lineTo(5, -9); ctx.stroke();
    }
}
// THE LINE CHIP (Wes, Oct 5 2026): a line in the line's own colours — before the gun red, with the
// clock to the gun on the plate (m:ss, whole seconds under ten); after it white with a "go" chevron;
// the finish chequered. The bar shape, not the colour, keeps a red start from reading as a port mark.
function lineChipSpec(kind, secsToGun) {
    if (kind === 'finish') return { chequer: true };
    if (kind === 'prestart') {
        const s2 = Math.max(0, Math.ceil(secsToGun || 0));
        const cd = s2 >= 10 ? `${Math.floor(s2 / 60)}:${String(s2 % 60).padStart(2, '0')}` : String(s2);
        return { color: '#ef4444', rim: 'rgba(239,68,68,0.9)', countdown: cd };
    }
    return { color: '#ffffff', go: true };
}
function drawMarkEdgeIndicator(ctx, x, y, label, markIndex, screenRot, dotColor) {
    // Fried electronics (volcano.js): a chip on the rim wanders round it, and every chip
    // jitters, flickers, turns hot and reads static, like every other instrument — the goal
    // is still out there, but the box that points at it is not to be trusted.
    const friedNav = !!(window.Volcano && state.volcano && Volcano.hudFried('nav'));
    if (friedNav) { const w = Volcano.friedEdgePos(ctx, x, y, markIndex != null ? markIndex * 17 + 3 : Volcano.strSeed(label)); x = w.x; y = w.y; }
    ctx.save();
    ctx.translate(x, y);
    if (friedNav) {
        const f = frameCount >> 1;
        ctx.translate((((f * 7919) % 97) / 97 - 0.5) * 8, (((f * 104729) % 89) / 89 - 0.5) * 6);
        ctx.globalAlpha *= 0.55 + 0.45 * (((f * 31) % 13) / 13);
        try { ctx.filter = 'hue-rotate(-110deg) saturate(1.6) contrast(1.4)'; } catch (e) {}
        label = Volcano.garble(String(label), 1);
    }
    // A stamp from the FUTURE is stale — the clock was reset under it (restartRace; the
    // School after a race) — and a negative age scaled the chip ~10× (PT-102).
    let pulseAge = state._goalPulseT != null ? state.time - state._goalPulseT : 99;
    if (!(pulseAge >= 0)) pulseAge = 99;
    const k = 1 + 0.25 * Math.max(0, 1 - pulseAge / 0.8);
    ctx.scale(k, k);

    // The plate: one dark disc behind dot and arc, rimmed in the nav teal.
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,23,42,0.66)'; ctx.fill();
    ctx.strokeStyle = 'rgba(64,245,200,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();

    if (dotColor && typeof dotColor === 'object') {
        // A LINE, not a mark (start / finish): a bar, so a red start can never read
        // as a port rounding. `countdown` (pre-gun) replaces the bar with the clock.
        drawChipLineGlyph(ctx, dotColor);
    } else {
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fillStyle = dotColor || chipColorFor(markIndex); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
    }

    if (markIndex !== null) {
        let start, end, ccw, fixed = false;
        // A rounding leg passes the SIDE ('port'/'starboard') instead of a gate index. The
        // side arc is the BOAT'S PATH, drawn from the APPROACHING rounder's perspective
        // (you sail toward the chip, entering from its bottom): a PORT rounding keeps the
        // mark to port, so the path passes up the chip's RIGHT and curls left over the
        // top; starboard mirrors it up the LEFT curling right. Not the mark's named side —
        // that framing put the arc where the boat never goes.
        if (markIndex === 'starboard') { start = Math.PI - 1.2; end = Math.PI + 1.2; ccw = false; fixed = true; }
        else if (markIndex === 'port') { start = 1.2;           end = -1.2;          ccw = true;  fixed = true; }
        else if (markIndex === 0) { start = 0;       end = Math.PI; ccw = false; }
        else if (markIndex === 1) { start = Math.PI; end = 0;       ccw = true; }
        else if (markIndex === 2) { start = 0;       end = Math.PI; ccw = true; }
        else                      { start = Math.PI; end = 0;       ccw = false; }

        ctx.save();
        if (!fixed) ctx.rotate(state.wind.baseDirection + screenRot);
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, 20, start, end, ccw); ctx.stroke();
        const tipX = 20 * Math.cos(end), tipY = 20 * Math.sin(end);
        const tangent = end + (ccw ? -Math.PI/2 : Math.PI/2);
        ctx.translate(tipX, tipY); ctx.rotate(tangent);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(7, 0); ctx.lineTo(-6, 6); ctx.lineTo(-4, 0); ctx.fill();
        ctx.restore();
    }

    // The distance, bold, in its own pill — under the plate, or ABOVE it when the chip
    // rides the bottom edge, so the number never slips below the screen.
    ctx.font = FONT.mono(14);
    const tw = ctx.measureText(label).width;
    const below = y < ctx.canvas.height - 110;
    const py = below ? 32 : -53;
    ctx.beginPath(); ctx.roundRect(-tw / 2 - 8, py, tw + 16, 21, 9);
    ctx.fillStyle = 'rgba(15,23,42,0.75)'; ctx.fill();
    ctx.strokeStyle = 'rgba(64,245,200,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, py + 11);
    ctx.restore();
}

// Edge-clamped indicator for a nearby off-screen competitor: hull-colored dot
// with the boat's current rank inside and its name above.
function drawNpcEdgeIndicator(ctx, x, y, boat) {
    const color = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;
    // Fried electronics (volcano.js): see drawMarkEdgeIndicator — the marker wanders the rim.
    const fried = !!(window.Volcano && state.volcano && Volcano.hudFried('nav'));
    if (fried) { const w = Volcano.friedEdgePos(ctx, x, y, Volcano.strSeed(boat.name)); x = w.x; y = w.y; }
    ctx.save();
    ctx.translate(x, y);
    if (fried) {
        const f = frameCount >> 1;
        ctx.translate((((f * 7919 + 17) % 97) / 97 - 0.5) * 8, (((f * 104729 + 5) % 89) / 89 - 0.5) * 6);
        ctx.globalAlpha *= 0.55 + 0.45 * (((f * 37) % 11) / 11);
        try { ctx.filter = 'hue-rotate(-110deg) saturate(1.6) contrast(1.4)'; } catch (e) {}
    }

    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = boat.raceState.penalty ? '#ef4444' : '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    if (state.race.status === 'racing' && boat.lbRank !== undefined) {
        ctx.fillStyle = isVeryDark(color) ? '#ffffff' : '#0f172a';
        ctx.font = FONT.mono(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(fried ? Volcano.garble(String(boat.lbRank + 1), 1) : String(boat.lbRank + 1), 0, 0.5);
    }

    ctx.fillStyle = '#ffffff'; ctx.font = FONT.label(10); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    ctx.fillText(fried ? Volcano.garble(boat.name.toUpperCase(), 1) : boat.name.toUpperCase(), 0, -13);
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
// `prev` is the last reading when the progress rate is NOT to be re-sampled this frame — see
// boatInstruments. Everything else is read fresh every call.
function boatInstrumentData(player, prev) {
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
    const _dmc = prev ? (prev.dmcNA ? null : prev.dmc) : dmcRate(player);
    return {
        sog, vmg, dmc: (_dmc == null ? 0 : _dmc), dmcNA: _dmc == null, tws: w.speed, twa, twsCol, sogCol, badAir,
        // In the no-sail zone: inside ~38° of the wind, where the polar runs out. Both faces
        // paint the angle red so the number itself says why the boat is stopping.
        noGo: twa < 38,
        planing: !!player.raceState.isPlaning,
        surfing: !!(surf && surf.surfing)
    };
}

// ── THE ROSE, WHEN IT IS THE CHOSEN FACE ────────────────────────────────────
// The corner dial, driven from boatInstrumentData — the SAME function the boat panel reads.
// The two faces show one set of numbers computed once, so they cannot drift apart, and it is
// how the rose's speed became SOG without a second definition of SOG existing anywhere.
//
// Transforms and text both run every frame now (Sep 13 2026) — the text used to run at 6 Hz on
// the argument that a digit flickering at 60 Hz is unreadable, but the signals are smooth
// (measured wind-direction noise under 0.1°/frame) and the 6 Hz TWA stepped 5° at a time.
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
    // Fried electronics (volcano.js): every needle spins and every number is static.
    if (window.Volcano && state.volcano && Volcano.hudFried('rose')) {
        const spin = (k) => `rotate(${(frameCount * 0.31 * k + Math.sin(frameCount * 0.9 * k) * 2.5).toFixed(3)}rad)`;
        if (UI.windArrow) UI.windArrow.style.transform = spin(1);
        if (UI.waypointArrow) { UI.waypointArrow.style.visibility = ''; UI.waypointArrow.style.transform = spin(-1.3); }
        if (UI.headingArrow) UI.headingArrow.style.transform = spin(0.7);
        if (frameCount % 3 === 0) {
            if (UI.speed) { UI.speed.textContent = Volcano.garble('0.0', 1); UI.speed.style.color = '#fb7185'; }
            if (UI.vmg) UI.vmg.textContent = Volcano.garble('0.0', 1);
            if (UI.windSpeed) { UI.windSpeed.textContent = Volcano.garble('00.0', 1); UI.windSpeed.style.color = '#fb7185'; }
            if (UI.windAngle) { UI.windAngle.textContent = Volcano.garble('000\u00b0', 1); UI.windAngle.style.color = '#fb7185'; }
        }
        return;
    }
    if (UI.windArrow) UI.windArrow.style.transform = `rotate(${localWind.direction}rad)`;
    if (UI.waypointArrow) {
        // No goal exists before the gun, so no arrow; racing, it points where the goal
        // chip points (the published path-aware aim), falling back to the raw waypoint
        // bearing when the chip machinery has not run (nav aids off, lessons).
        const show = state.race.status === 'racing';
        UI.waypointArrow.style.visibility = show ? '' : 'hidden';
        if (show) {
            const g = window._goalAim;
            const ang = (g && frameCount - g.t < 30) ? g.a : player.raceState.nextWaypoint.angle;
            UI.waypointArrow.style.transform = `rotate(${ang}rad)`;
        }
    }
    if (UI.headingArrow) UI.headingArrow.style.transform = `rotate(${player.heading - state.camera.rotation}rad)`;
    // Text every frame too, same reading as the boat panel (see boatInstruments): the 6 Hz
    // gate that lived here made the rose's TWA step through a tack.
    const d = boatInstruments(player);
    // style.color rather than swapping Tailwind classes: the colour is already decided as a
    // hex by boatInstrumentData, and a class list that has to be scrubbed before every write
    // is how the old block grew a six-name remove() call.
    if (UI.speed) { UI.speed.textContent = d.sog.toFixed(1); UI.speed.style.color = d.sogCol; }
    if (UI.vmg) UI.vmg.textContent = d.dmcNA ? '\u2014' : d.dmc.toFixed(1);
    if (UI.windSpeed) {
        UI.windSpeed.textContent = d.tws.toFixed(1) + (d.badAir ? ' \u2193' : ''); UI.windSpeed.style.color = d.twsCol;
        // The wind icon beside the number takes the comet ramp's colour for this many knots
        // (streakColorFor, js/sim/wind.js), so the chip doubles as the legend for the streaks
        // on the water: the player sees "14.2" next to the same cream the comets are drawn
        // in, and learns the scale without a key. The NUMBER keeps its own colour — that one
        // is course-relative (more or less pressure than normal here) and says something else.
        const ico = UI.windSpeed.previousElementSibling;
        if (ico && typeof streakColorFor === 'function') { const c = streakColorFor(d.tws); ico.style.color = `rgb(${c[0]},${c[1]},${c[2]})`; }
    }
    if (UI.windAngle) { UI.windAngle.textContent = `${d.twa}\u00b0`; UI.windAngle.style.color = d.noGo ? '#f87171' : ''; }
    roseCue('hud-planing-label', 'absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] font-black tracking-widest text-cyan-400 hidden', 'PLANING', d.planing);
    roseCue('hud-surfing-label', 'absolute -top-9 left-1/2 transform -translate-x-1/2 text-[10px] font-black tracking-widest text-amber-300 hidden', 'SURFING', d.surfing);
}

// ── THE TIDE READOUT (Spoonbill Flats) ──────────────────────────────────────
// The bottom-right panel (Wes, Sep 16 2026: "show the sinusoidal curve and the current
// point of tidal height, and a numeric current tidal height" — in place of the rose's
// gauge row and the pill under the boat). A minute of the curve scrolls under a fixed
// NOW line — the last fifteen seconds dim on the left, the next forty-five on the right —
// with the water filled under it, HW and LW named at the crests with the seconds to each,
// the point riding the curve, and the height above chart datum (0 at low water) as the
// number. Under it, small, the echo sounder — blue with clearance, amber while the mud is
// taking speed, red just afloat, AGROUND with the refloat countdown when she sits.
// Hidden on every other venue.
function drawTideReadout(player) {
    if (!UI.tideRow || !UI.tideCanvas) return;
    const info = (window.Tide && state.tide) ? Tide.hudInfo(player) : null;
    if (!info) { if (!UI.tideRow.classList.contains('hidden')) UI.tideRow.classList.add('hidden'); return; }
    UI.tideRow.classList.remove('hidden');
    const cv = UI.tideCanvas, T = state.tide;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = 250, H = 84;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // the window of time: t0 in the past, t1 ahead; the level is a function of the race clock
    const now = Tide.clock(), past = T.period * 0.25, ahead = T.period * 0.75;
    const t0 = now - past, t1 = now + ahead;
    const L = 10, R = 132, top = 12, bot = 52;                  // the plot; the number lives to the right of R
    const px = (t) => L + (t - t0) / (t1 - t0) * (R - L);
    const lo = T.mid - T.amp, hi = T.mid + T.amp;
    const py = (lv) => bot - (lv - lo) / (hi - lo) * (bot - top);
    const xNow = px(now);
    // the water under the curve, dim in the past
    const path = (from, to) => { g.beginPath(); g.moveTo(px(from), bot); for (let t = from; t <= to + 1e-6; t += (t1 - t0) / 60) g.lineTo(px(t), py(Tide.levelAt(t))); g.lineTo(px(to), bot); g.closePath(); };
    path(t0, now); g.fillStyle = 'rgba(56,132,196,0.22)'; g.fill();
    path(now, t1); g.fillStyle = 'rgba(56,132,196,0.40)'; g.fill();
    // datum and mean
    g.strokeStyle = 'rgba(148,163,184,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(L, bot + 0.5); g.lineTo(R, bot + 0.5); g.stroke();
    g.setLineDash([2, 3]); g.beginPath(); g.moveTo(L, py(T.mid) + 0.5); g.lineTo(R, py(T.mid) + 0.5); g.stroke(); g.setLineDash([]);
    // the curve itself: past dim, future bright
    const curve = (from, to, col, w) => { g.beginPath(); let first = true; for (let t = from; t <= to + 1e-6; t += (t1 - t0) / 90) { const x = px(t), y = py(Tide.levelAt(t)); if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); } g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
    curve(t0, now, 'rgba(186,230,253,0.45)', 1.5);
    curve(now, t1, '#bae6fd', 2);
    // the crests ahead, named, with the seconds to each
    g.font = FONT.mono(9); g.textAlign = 'center'; g.textBaseline = 'middle';
    const toHigh = Tide.nextHigh(now), toLow = Tide.nextLow(now);
    const crest = (dt, label, lv, col) => {
        if (dt > ahead) return;
        const x = px(now + dt), y = py(lv);
        g.fillStyle = col; g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill();
        g.fillStyle = col; g.fillText(`${label} ${Math.max(0, Math.round(dt))}s`, Math.max(L + 16, Math.min(R - 16, x)), lv > T.mid ? y - 7 : y + 8);
    };
    crest(toHigh, 'HW', hi, '#bae6fd');
    crest(toLow, 'LW', lo, '#fde68a');
    // NOW: the line and the point
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(xNow + 0.5, top - 4); g.lineTo(xNow + 0.5, bot + 4); g.stroke();
    const yNow = py(info.level);
    g.fillStyle = info.rising ? '#7dd3fc' : '#fbbf24';
    g.beginPath(); g.arc(xNow, yNow, 3.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#0f172a'; g.lineWidth = 1; g.stroke();
    // THE NUMBER: height above chart datum (low water is 0), with the flood/ebb arrow
    const height = info.level - lo;
    g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.font = FONT.mono(22); g.fillStyle = '#e2e8f0';
    g.fillText(`${height.toFixed(2)}`, W - 30, 40);
    g.font = FONT.mono(11); g.fillStyle = '#94a3b8';
    g.fillText('m', W - 12, 40);
    g.font = FONT.label(9); g.fillStyle = info.rising ? '#7dd3fc' : '#fbbf24';
    g.fillText(`${info.rising ? '▲ FLOOD' : '▼ EBB'}`, W - 12, 16);
    g.font = FONT.label(8); g.fillStyle = 'rgba(148,163,184,0.8)';
    g.fillText('TIDE', W - 12, 54);
    // the echo sounder, small, along the bottom
    g.font = FONT.mono(10); g.textAlign = 'left';
    let txt, col;
    if (info.aground) { const r = info.refloatIn; txt = r == null ? 'AGROUND' : `AGROUND · refloats in ${Math.max(1, Math.ceil(r))}s`; col = '#f87171'; }
    else {
        const dd = Math.max(0, info.depth == null ? 0 : info.depth), clr = dd - info.draft;
        txt = `${dd.toFixed(1)} m under the keel`;
        col = clr >= info.free ? 'rgba(191,219,254,0.85)' : clr > info.free * 0.4 ? '#fbbf24' : '#f87171';
    }
    g.fillStyle = col; g.fillText(txt, L, H - 11);
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
// DMC — SPEED MADE GOOD ALONG THE COURSE, in knots: the smoothed rate of the boat's
// progress down the same dmc ruler the leaderboard ranks by. This replaces VMG on the
// dial: VMG is wind-relative and half the time the answer is "who cares", while DMC is
// the number a racer is actually trying to maximise, bends and all. Negative when
// sailing away from the course. Zero before the gun (progress has no meaning yet).
// WHEN THE NUMBER WOULD BE NOISE, IT IS A DASH: inside the zone of the active rounding
// mark (projection onto a tight arc stalls and jumps — the reading is boat-handling
// noise, not speed made good) and through the prestart (no progress exists yet). The
// smoother is dropped for the whole pause, so waking up re-seeds from current progress
// instead of discharging the arc as a spike.
function dmcNA(player) {
    if (state.race.status === 'prestart') return true;
    const lesson = window.School && School.active && School.lesson && School.lesson();
    if (lesson) {
        const s = School.s;
        if (s && s.kind === 'pond' && s.phase === 'tasks' && s.task && s.task.kind === 'mark' && s.W) {
            return Math.hypot(player.x - s.W.x, player.y - s.W.y) < (s.W.zone || 165);
        }
        return false;
    }
    if (state.race.status === 'racing' && typeof routeLeg === 'function') {
        const e = routeLeg(player.raceState.leg);
        if (e && e.kind === 'round' && e.mark) {
            return Math.hypot(player.x - e.mark.x, player.y - e.mark.y) < (e.mark.zone || 165);
        }
    }
    return false;
}

function dmcRate(player) {
    // ── PROGRESS SPEED: closing speed on the goal, in knots (Sep 14-15 2026) ──
    // The component of the GROUND velocity along the way to the goal: the goal field's gradient
    // where there is one (the mark's bearing in open water, the way round a headland behind it),
    // else the straight bearing. It used to be the smoothed derivative of the boat's nearest point
    // on the saved leg path, which fails exactly when you leave that path — on the outside of a
    // bend the projection sticks at the corner and the number stalls, on the inside it jumps a
    // segment, and on a genuine shortcut it credits progress along a line you are not sailing.
    // Instantaneous and smooth (velocity already is), so it reads every frame like SOG. Negative
    // when sailing away.
    if (dmcNA(player)) return null;
    const v = player.velocity || { x: 0, y: 0 };
    let tgt = null;
    const lesson = window.School && School.active && School.lesson && School.lesson();
    if (lesson) tgt = School.dmcTarget ? School.dmcTarget() : null;
    else if (state.race.status === 'racing') {
        if (window.GoalField) {
            const dir = GoalField.progressDir(player);
            if (dir) return (v.x * dir.x + v.y * dir.y) * 4;
            if (typeof routeLeg === 'function') {
                const leg = player.raceState.leg;
                const a = GoalField.playerAim(player, routeLeg(Math.min(leg, state.race.totalLegs)), leg);
                if (a) tgt = a.aim;
            }
        }
        if (!tgt) tgt = player.raceState.nextWaypoint;
    }
    if (!tgt) return 0;
    const dx = tgt.x - player.x, dy = tgt.y - player.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) return 0;
    return (v.x * dx + v.y * dy) / d * 4;      // ground velocity → knots, the factor SOG uses
}

// ⚠️ INSTANTANEOUS, EVERY FRAME (owner's call, Sep 13 2026). TWA, TWS, SOG and VMG are read
// fresh each frame: this used to hand back one reading per 10 frames, and through a tack the
// TWA digit stepped up to 5° at a time and lagged the boat by as much — which reads as a
// WRONG number, not a slow one. Only the progress rate (DMC, "progress speed") keeps the
// 10-frame sample its filter was tuned on: a rate off a one-frame progress delta is noise,
// and it is allowed to be the slow one, like the goal chip.
function boatInstruments(player) {
    const bucket = Math.floor(frameCount / 10);
    const keepDmc = !!(_biCache && _biBucket === bucket && _biWho === player);
    _biBucket = bucket; _biWho = player;
    // Progress speed is a projection of the velocity now (dmcRate), not a differentiated
    // reading, so it no longer needs its 10-frame sample: everything is instantaneous.
    void keepDmc;
    _biCache = boatInstrumentData(player, null);
    return _biCache;
}

function drawBoatInstruments(ctx, player) {
    if (!hudShowsBoat()) return;
    if (!player || !player.raceState) return;
    // A fading boat takes its reading with it (the finish, and the school's section ends);
    // once fully gone there is nothing left to sail by.
    const fade = player.opacity === undefined ? 1 : player.opacity;
    if (fade <= 0.01) return;
    const rot = -state.camera.rotation;
    const dx = player.x - state.camera.x, dy = player.y - state.camera.y;
    const sx = canvas.width / 2 + dx * Math.cos(rot) - dy * Math.sin(rot);
    const sy = canvas.height / 2 + dx * Math.sin(rot) + dy * Math.cos(rot);
    const top = sy + BI_DROP;
    const left = sx - BI_W / 2;
    const d = boatInstruments(player);
    // Fried electronics (volcano.js): the pill jitters and its reading goes to static; the
    // omens before a strike put a smaller jitter on it first.
    const vg = (window.Volcano && state.volcano) ? Volcano.glitch() : 0;
    const vfried = vg > 0 && Volcano.hudFried('instruments');
    const jx = vg ? (((frameCount * 7919) % 97) / 97 - 0.5) * 7 * vg : 0;
    const jy = vg ? (((frameCount * 104729) % 89) / 89 - 0.5) * 5 * vg : 0;

    ctx.save();
    ctx.globalAlpha *= fade;
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
    ctx.fillStyle = vfried ? '#fb7185' : (d.noGo ? '#f87171' : '#bfdbfe');
    const twaTxt = vfried ? Volcano.garble(d.twa + '°', 1) : (vg > 0 ? Volcano.garble(d.twa + '°', vg * 0.5) : d.twa + '°');
    ctx.fillText(twaTxt, sx + jx, top + BI_H / 2 + 0.5 + jy);
    // ── THE HALYARD GAUGE ───────────────────────────────────────────────────
    // A hoist or douse takes seconds, and a player who presses Space and sees nothing
    // presses it again. While the kite is travelling — and ONLY while it is travelling:
    // the bar vanishes the frame it reaches full or empty — a thin bar under the TWA pill
    // shows how much sail is actually UP, filling on the hoist and draining on the douse,
    // in the boat's own spinnaker colour. An instrument, not a task meter: it reports the
    // sail, so it needs no raising/lowering inference and reads the same everywhere.
    const dp = player.spinnakerDeployProgress || 0;
    if (dp > 0.001 && dp < 0.999) {
        const by = top + BI_H + 4, bh = 5, r = bh / 2;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.roundRect(left, by, BI_W, bh, r);
        ctx.fillStyle = BI_BG; ctx.fill();
        ctx.strokeStyle = BI_RIM; ctx.lineWidth = 1; ctx.stroke();
        if (dp > 0.02) {
            ctx.beginPath(); ctx.roundRect(left, by, Math.max(bh, BI_W * dp), bh, r);
            ctx.fillStyle = (player.colors && player.colors.spinnaker) || '#f2c14e';
            ctx.fill();
        }
    }
    ctx.restore();
}

// Screen-space snowfall (Arctic): soft flakes drifting down with a light wind
// slant and a per-flake flutter. Own seeded PRNG (`snowRand`) — never
// Math.random (would desync the eval RNG stream). Draw-side only: nothing in
// the sim reads or depends on it.
