// regatta/js/sim/wind.js — the wind model AND its visualization (history says
// they are edited together): base wind, gusts/puffs, island wind shadows,
// region oscillation, pressure ramp, squalls, getWindAt, turbulence, the
// wind-streak/current-streamline particle layer, and gust tone rendering.
// ⚠️ Reads window.VenueDoc.U_PER_M at TOP LEVEL — venuedoc.js must load first.
// Classic script; global scope. Extracted verbatim from script.js (2026-08-24).
function updateBaseWind(dt) {
    state.wind.direction = state.wind.baseDirection;
    state.wind.speed = state.wind.baseSpeed;

    // Debug History
    if (!state.wind.history) state.wind.history = [];
    if (!state.wind.debugTimer) state.wind.debugTimer = 0;
    state.wind.debugTimer -= dt;
    if (state.wind.debugTimer <= 0) {
        state.wind.debugTimer = 0.5;
        state.wind.history.push({ t: state.time, dir: 0, speed: state.wind.speed });
        if (state.wind.history.length > 240) state.wind.history.shift();
    }
}

function drawWindDebug(ctx) {
    if (!settings.debugMode) return;

    const h = 100;
    const w = 200;
    // Align right, accounting for the wider conflict info box (300px)
    const x = ctx.canvas.width - 320;
    const y = 430;

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, w, h);

    // Center Line
    ctx.strokeStyle = '#666';
    ctx.beginPath();
    ctx.moveTo(x, y + h/2);
    ctx.lineTo(x + w, y + h/2);
    ctx.stroke();

    // Plot
    if (state.wind.history && state.wind.history.length > 1) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const now = state.time;
        // 120s window
        for (const p of state.wind.history) {
            const timeOffset = now - p.t;
            if (timeOffset > 120) continue;

            const px = x + w - (timeOffset / 120) * w;
            // Scale: +/- 30 deg fills height
            const py = y + h/2 - (p.dir / 30) * (h/2);
            ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Plot Speed (Cyan)
        ctx.strokeStyle = '#22d3ee';
        ctx.beginPath();
        let first = true;
        for (const p of state.wind.history) {
            const timeOffset = now - p.t;
            if (timeOffset > 120) continue;

            const px = x + w - (timeOffset / 120) * w;
            // Scale: 0-30 knots fills height (bottom up)
            // base y is y+h.
            const py = (y + h) - (p.speed / 30) * h;
            if (first) { ctx.moveTo(px, py); first = false; }
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
    }

    ctx.fillStyle = '#fff';
    ctx.font = FONT.mono(10);
    ctx.fillText("Base Wind Shift (+/- 30°)", x + 5, y + 15);
    ctx.fillStyle = '#22d3ee';
    ctx.fillText("Wind Speed (0-30kn)", x + 5, y + 25);
    ctx.fillStyle = '#fff';

    // Current Delta
    const shift = (state.wind.currentShift || 0) * (180/Math.PI);
    ctx.fillText(`Cur: ${shift > 0 ? '+' : ''}${shift.toFixed(1)}°`, x + 5, y + h - 5);

    // Per-Boat Delta (Relative to 30s ago)
    // Find history point ~30s ago
    let pastShift = shift;
    const now = state.time;
    if (state.wind.history) {
        const past = state.wind.history.find(p => p.t >= now - 30);
        if (past) pastShift = past.dir;
    }
    const delta30 = shift - pastShift;
    ctx.textAlign = 'right';
    ctx.fillText(`30s Δ: ${delta30 > 0 ? '+' : ''}${delta30.toFixed(1)}°`, x + w - 5, y + h - 5);

    // Rule Debug Info
    ctx.textAlign = 'left';
    let textY = y + h + 20;
    const player = state.boats[0];
    const checkDist = 400;

    let conflictCount = 0;
    for (const other of state.boats) {
        if (other === player) continue;
        const distSq = (player.x - other.x)**2 + (player.y - other.y)**2;
        if (distSq < checkDist * checkDist && isConflictSoon(player, other)) {
            conflictCount++;
        }
    }

    if (conflictCount > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x, y + h + 5, 300, conflictCount * 20 + 10);
    }

    for (const other of state.boats) {
        if (other === player) continue;
        const distSq = (player.x - other.x)**2 + (player.y - other.y)**2;
        if (distSq < checkDist * checkDist && isConflictSoon(player, other)) {
            const res = getRightOfWay(player, other);
            const isWinner = res.boat === player;
            ctx.fillStyle = isWinner ? '#4ade80' : '#ef4444';
            let label = `${other.name} - ${res.rule}: ${res.reason}`;
            if (res.markRoom) label += ' [Mark-Room]';
            ctx.fillText(label, x + 5, textY);
            textY += 20;
        }
    }

    ctx.restore();
}

function drawDebugWorld(ctx) {
    if (!settings.debugMode) return;

    ctx.save();

    // Draw Inflated Islands (Global Planner View)
    // Only need one boat's planner since they should be same
    const planner = state.boats.find(b => !b.isPlayer)?.controller?.planner;
    if (planner && planner.inflatedIslands) {
        ctx.strokeStyle = '#f59e0b'; // Amber
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        for (const isl of planner.inflatedIslands) {
            if (!isl.vertices || isl.vertices.length === 0) continue;
            ctx.beginPath();
            ctx.moveTo(isl.vertices[0].x, isl.vertices[0].y);
            for (let i = 1; i < isl.vertices.length; i++) {
                ctx.lineTo(isl.vertices[i].x, isl.vertices[i].y);
            }
            ctx.closePath();
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    for (const boat of state.boats) {
        if (boat.raceState.finished) continue;
        const w = getWindAt(boat.x, boat.y);

        // Draw Wind Vector
        ctx.beginPath();
        ctx.moveTo(boat.x, boat.y);
        const len = 40;
        const dx = Math.sin(w.direction) * len;
        const dy = -Math.cos(w.direction) * len;
        ctx.lineTo(boat.x + dx, boat.y + dy);
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Planned Path
        if (boat.controller && boat.controller.currentPath && boat.controller.currentPath.length > 0) {
            ctx.strokeStyle = '#00ff00'; // Green
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(boat.x, boat.y);
            for (const p of boat.controller.currentPath) {
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();

            // Draw current target waypoint
            const wp = boat.controller.currentPath[0];
            ctx.fillStyle = '#00ff00';
            ctx.beginPath(); ctx.arc(wp.x, wp.y, 5, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.restore();
}

// ── THE SHAPE OF A PUFF ─────────────────────────────────────────────────────
//
// A cell is an ellipse, and that is the right primitive: you never meet the same puff twice,
// so an outline has nothing to be memorable FOR, and the sample runs per boat AND per
// particle per frame over every live cell — the hottest loop in the game. What the ellipse
// was missing is not detail, it is ASYMMETRY.
//
// A real puff mixes down from aloft, hits the water, and spreads out downwind in a half-moon:
// a front you can see coming, and a ragged tail that lets go slowly. Scaling the along-wind
// coordinate before the ellipse test compresses the gradient at the nose and stretches it
// behind — the shape the research describes, with no new geometry and no extra loop.
//
// The two average to 1, so a cell keeps its length; only the balance moves.
const PUFF_NOSE = 0.65, PUFF_TAIL = 1.35;
// How far the drawn cell shifts UPWIND of its nominal centre, so the cat's-paw on the water
// sits over the water the puff is actually felt on. The puff you see must be the puff you
// feel, or the whole point of a readable puff is lost.
const PUFF_SKEW = (PUFF_TAIL - PUFF_NOSE) / 2;
// THE FAN. Air spreads outward from where the puff lands, so one flank of it veers the wind
// and the other backs it — which is what makes a puff a DECISION rather than just pressure:
// you pick a side. Zero on the axis, this much at the cross-wind edge.
//
// A lull is the opposite: air converges INTO a hole rather than out of it, so the sign
// follows speedDelta and one constant serves both.
//
// ⚠️ APPLIED TO THE RESULTANT, not to the puff's own vector. Turning only the puff's
// contribution and letting it sum with the base wind is arithmetically tidy and physically
// wrong: it damps a 12-degree fan down to 0.7 degrees felt, because the puff is a small part
// of the total. The surface wind inside a puff IS the descended air — that is what a puff is
// — so the whole local vector turns, weighted by how far into the cell you are. Measured
// peak is about 4 degrees, near 0.55 of the way out to the flank, which is a shift a sailor
// reads rather than one buried under the venue's own oscillation.
const PUFF_FAN = 18 * Math.PI / 180;

// Gust System
//
// A gust and a lull are ONE thing: an ellipse carrying a signed speed delta, elongated
// along the wind and about half as wide across it — which is the shape the real ones have,
// because surface puffs arrive as streamwise streaks a couple of hundred metres wide and
// rather longer than that. The cell drifts downwind at a fraction of the wind speed and
// lives a couple of minutes, so it can be seen coming, sailed toward, and ridden.
//
// `reg` is the gust region it was born in, or null for the uniform case. A region never
// decides the PHYSICS — it multiplies what the venue's conditions already rolled — so a
// region left at its defaults changes only where puffs come from.
// The spread the engine puts around each authored MEAN. These reproduce the ranges the old
// multiplier form had exactly — size 300-1500 x 150-750 units, life 90-240 s, strength
// 0.275-0.425 of the base wind — so converting a document changes its units and nothing else.
const U_PER_M = window.VenueDoc.U_PER_M;            // the game's one length conversion
const PUFF_SPREAD_LO = 0.572, PUFF_SPREAD_SPAN = 0.856;   // ±21% around the stated knots
const PUFF_SIZE_LO = 0.333, PUFF_SIZE_SPAN = 1.334;       // ±67% around the stated metres
const PUFF_LIFE_LO = 0.545, PUFF_LIFE_SPAN = 0.909;       // ±45% around the stated seconds
const LULL_RATIO = 0.7;                             // a hole is worth ~70% of a puff

function createGust(x, y, type, initial, reg) {
    const conditions = state.race.conditions;
    // THE WIND WHERE THE CELL IS BORN, not the venue's average — same reason as the drift in
    // updateGusts. A source drawn in a katabatic tongue emits cells that set off along the
    // tongue and lie across it, which is the only reason placing the polygon there means
    // anything. `regionWindAt` for the same reason too: the mean field, no puffs to recurse
    // through and no lee to deflect a feature this large.
    const born = regionWindAt(x, y);
    const baseSpeed = born.speed > 0.1 ? born.speed : state.wind.speed;
    const windDir = born.speed > 0.1 ? born.direction : state.wind.direction;

    // THE SOURCE STATES A MEAN AND THE ENGINE SPREADS AROUND IT. `sizeM` is how wide a puff
    // is across its long axis, in metres; the short axis is half that. The spreads below
    // reproduce the ranges these fields had as multipliers exactly, so the only thing that
    // changed is that the number in the editor is now measured in something.
    const halfU = (reg.sizeM * U_PER_M) / 2;
    const maxRadiusX = halfU * (PUFF_SIZE_LO + Math.random() * PUFF_SIZE_SPAN);
    const maxRadiusY = halfU * 0.5 * (PUFF_SIZE_LO + Math.random() * PUFF_SIZE_SPAN);

    let speedDelta = 0;
    let dirDelta = 0;

    // Gust Strength
    // Strength is now balanced (0.5 bias), as the slider controls Type Balance instead.

    // Base strength factor 0.0 to 1.0 within the range
    const strengthRandom = Math.random();
    const bias = 0.5;
    const strengthFactor = (strengthRandom + bias) * 0.5; // 0 to 1

    // WHAT A PUFF IS WORTH ON THE ANEMOMETER, in knots, stated by the source. A hole is
    // worth LULL_RATIO of a puff — real lulls are the shallower half of the same signal.
    //
    // This used to be a percentage of `state.wind.speed`, which is the region blend at the
    // ROUTE CENTROID. On a course whose wind actually varies that is the wrong reference:
    // a bomb born in Glacier Sound's 29-knot katabatic tongue was sized by the 20-knot
    // average two kilometres away, and a source could not be given a strength without
    // knowing a number that is nowhere on its own panel.
    const spread = PUFF_SPREAD_LO + strengthFactor * PUFF_SPREAD_SPAN;
    speedDelta = reg.gustKt * spread * (type === 'gust' ? 1 : -LULL_RATIO);

    // Gust-shift coupling (Northern Hemisphere): a gust is faster, more-veered
    // upper-level air mixed down to the surface, so the wind VEERS (clockwise) in a
    // puff and BACKS (counter-clockwise) in a lull. Magnitude scales with the puff's
    // strength. This is the key realism upgrade — it turns "random gusts" into a
    // READABLE pattern (a puff lifts starboard / heads port), so both the player and
    // the AI can anticipate the shift that arrives with the pressure.
    //
    // ⚠️ A region's `strength` deliberately does NOT scale this. The veer already tracks the
    // cell's OWN strength draw above, which is the coupling that makes the read consistent —
    // a bigger puff on this venue turns the wind further. The multiplier is a property of the
    // SOURCE, and letting it through here as well would put a 50-degree swing behind one box
    // labelled "strength". How far the wind turns in a puff is a fact about the DAY, and the
    // source's own knob is its `veer`.
    const hemiSign = 1; // NH: gust veers +, lull backs -
    const veerBase = reg.veer;   // the SOURCE says how far its puffs turn the wind
    const veerMag = veerBase * (0.6 + strengthFactor * 0.8); // stronger puff -> bigger shift
    dirDelta = hemiSign * (type === 'gust' ? 1 : -1) * veerMag;

    // Movement: puffs travel downwind at roughly the gradient wind speed (~0.6-0.9x
    // the true wind here), so they sweep down the course and "connect the puffs" /
    // sailing toward pressure becomes a real tactic. (Old factor barely moved them.)
    const moveSpeedFactor = (0.8 + Math.random() * 0.4) * 0.18;
    const moveDirOffset = (Math.random() - 0.5) * 0.1; // Slight drift relative to wind

    // Initial Velocity
    const moveSpeed = baseSpeed * moveSpeedFactor;
    const moveDir = windDir + moveDirOffset;
    const vx = -Math.sin(moveDir) * moveSpeed;
    const vy = Math.cos(moveDir) * moveSpeed;

    // HOW LONG IT LIVES, in seconds, stated by the source. The number that makes this
    // authorable is the one it has to be compared against: a puff drifts at ~0.75x the
    // wind, so on a 1.75 km course it is gone in well under a minute. A source asking for
    // 165-second puffs on that course is asking for cells that spend three quarters of
    // their lives off the map — still counting against its own `count`, so the source
    // reads "full" while the water is empty. In multiplier form that was invisible.
    const duration = reg.lifeS * (PUFF_LIFE_LO + Math.random() * PUFF_LIFE_SPAN);
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

// ── WHERE A PUFF IS BORN ────────────────────────────────────────────────────
// Only in a gust region. There is no uniform scatter behind them any more and no venue-wide
// puffiness driving one: a source states its own population, exactly as a wind region states
// its own speed, and a course with no sources has a steady breeze the way a course with no
// wind regions is calm.
//
// The uniform path that used to live here was the last venue-wide weather variable — it
// scattered `5 + puffiness * 20` cells over the whole arena, which no course could say
// anything about. "Puffs everywhere" is now a whole-course gust region, which is one visible
// object you can select, move and turn off rather than an implicit one nobody could.

function spawnRegionGust(regs, initial) {
    // How many live cells each source currently owns.
    const have = new Map();
    for (const g of state.gusts) have.set(g.src, (have.get(g.src) || 0) + 1);
    let reg = null, worst = 0;
    for (const r of regs) {
        const deficit = r.count - (have.get(r.id) || 0);
        if (deficit > worst) { worst = deficit; reg = r; }
    }
    if (!reg) return;

    const bb = reg.bb, bw = bb.maxX - bb.minX, bh = bb.maxY - bb.minY;
    let gx = null, gy = null;
    for (let i = 0; i < 24; i++) {
        const x = bb.minX + Math.random() * bw;
        const y = bb.minY + Math.random() * bh;
        const sd = Arena.signedDist(reg, x, y);
        const u = VenueDoc.regionWeight(sd, reg.falloff);
        if (u > 0 && Math.random() < u) { gx = x; gy = y; break; }
    }
    if (gx === null) {
        // Give up on the weighting rather than on the puff: the middle of the box is
        // inside any sane region, and a source that never emits is worse than one whose
        // rare cell lands slightly off-centre.
        gx = bb.minX + bw / 2; gy = bb.minY + bh / 2;
    }

    // The source states its own gust/lull split outright — that is what makes one primitive
    // able to be a funnel (bias 1) or a dead patch (bias 0).
    const type = Math.random() < reg.bias ? 'gust' : 'lull';
    const cell = createGust(gx, gy, type, initial, reg);
    cell.src = reg.id;             // so its source can count its own live cells
    state.gusts.push(cell);
}

function updateGusts(dt) {
    // THE SOURCES DECIDE HOW MANY. No sources, no puffs — a steady breeze, which is a
    // legitimate course and the one every venue has until someone draws a gust region.
    const regs = state.course.gustRegions;
    let targetCount = 0;
    if (regs) for (const r of regs) targetCount += r.count;
    const boundary = state.course.boundary;

    // Maintain density.
    //
    // BOUNDED, not `while`. The uniform spawner always produces a cell, so an unbounded loop
    // was safe; the region spawner can decline — every source at density 0 leaves nothing to
    // pick — and a `while` that never reaches its target is a hung frame, which is the worst
    // failure this file could have. The compile step already filters those regions out, but
    // an invariant held one file away is not a reason to leave a spin loop in the frame path.
    if (boundary) {
        for (let tries = targetCount + 1; tries > 0 && state.gusts.length < targetCount; tries--) {
            spawnRegionGust(regs, false);
        }
    }

    const timeScale = dt * 60;
    // ── A PUFF IS STEERED BY THE BREEZE IT IS IN ────────────────────────────────
    // These two used to be `state.wind.speed` / `state.wind.direction` — the region blend at
    // the ROUTE CENTROID — applied to every cell on the map. On a course whose wind is
    // uniform that is the same number everywhere and the bug is invisible; on one whose wind
    // actually varies it is simply the wrong wind. Glacier Sound's gust source sits in a 45°
    // katabatic tongue while the centroid reads 130°, so every puff born there was carried
    // 85° off its own breeze and left the arena within ten seconds, heading away from the
    // course. Measured before the fix: 3 cells alive, 0.04 of them inside the arena on
    // average, and not one ever within 900 units of the racing corridor.
    //
    // Both the design note in getWindAt ("a gust crossing a bend bends with it") and the
    // editor's own panel text ("a puff drifts downwind and steers by the breeze where it is")
    // already described the behaviour this now has.
    //
    // regionWindAt, NOT getWindAt: the mean field, without puffs and without lees. getWindAt
    // loops every cell, so steering cells with it would be O(n^2) and self-referential — a
    // puff would ride on its own pressure. A puff is a large-scale feature carried by the
    // gradient flow anyway, not something a boat-scale wind shadow deflects.
    const fallbackSpeed = state.wind.speed;
    const fallbackDir = state.wind.direction;

    for (let i = state.gusts.length - 1; i >= 0; i--) {
        const g = state.gusts[i];

        // The mean wind HERE, re-read every frame, so a cell crossing a bend turns with it
        // and one entering a stronger region speeds up. A cell that has drifted into water
        // no region covers has nothing to steer by, so it keeps the venue's own wind rather
        // than parking where it stopped.
        const local = regionWindAt(g.x, g.y);
        const wSpeed = local.speed > 0.1 ? local.speed : fallbackSpeed;
        const wDir = local.speed > 0.1 ? local.direction : fallbackDir;

        const moveSpeed = wSpeed * g.moveSpeedFactor;
        const moveDir = wDir + g.moveDirOffset;
        g.vx = -Math.sin(moveDir) * moveSpeed;
        g.vy = Math.cos(moveDir) * moveSpeed;

        // The cell lies ACROSS the breeze it is in, plus its own shift — so a puff crossing
        // a bend re-aims rather than staying square to a wind two kilometres away.
        g.rotation = wDir + g.dirDelta + Math.PI / 2;

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

// ── SHADOWS: the lee of a solid thing ───────────────────────────────────────
//
// Downwind of an island the breeze is thin, and downstream of a rock the water is slack.
// Same geometry both times — a plume running away from the obstacle along the flow — so it
// is one function, asked twice with a different flow direction.
//
// CAST FROM THE SILHOUETTE, not from the centroid and a bounding radius. That distinction
// is the whole reason the previous version had to be switched off for coastlines: a coast's
// bounding circle is ~9400 units centred inland, so its "shadow" began nine kilometres
// upwind of the shore and blanketed the map. Projecting the ring onto the flow axis instead
// gives the two numbers that are actually wanted — where the land ENDS (the shoreline, where
// the lee begins) and how broad it is ACROSS the wind (what it really blocks). Those are
// right for a small island and for a coastline, so there is no special case left.
//
// The projection is O(vertices), and getWindAt runs per boat and per particle per frame, so
// it is cached against a quantised flow direction and rebuilt only when the wind has turned
// enough to matter. Touches no RNG — a shadow cannot move the eval stream.
const SHADOW_QUANTUM = 0.035;        // ~2 degrees
const SHADOW_MAX = 0.7;              // deepest reduction, at the shore on the centreline
const SHADOW_SPREAD = 0.35;          // how much the plume widens over its length

// `slot` names the cache field, so wind and current keep SEPARATE silhouettes. They shared
// one, keyed by a string that included the kind — which is a cache that reports a miss every
// time both are in use, and rebuilds an 85-vertex projection twice per island per sample.
function shadowSil(isl, flowX, flowY, key, slot) {
    let sil = isl[slot];
    if (sil && sil.key === key) return sil;
    const verts = isl.isFloe ? isl.localArt : isl.vertices;
    if (!verts || !verts.length) return null;
    const ox = isl.isFloe ? isl.x : 0, oy = isl.isFloe ? isl.y : 0;
    let alongMax = -Infinity, crossMin = Infinity, crossMax = -Infinity;
    for (const v of verts) {
        const px = v.x + ox, py = v.y + oy;
        const along = px * flowX + py * flowY;
        const cross = px * (-flowY) + py * flowX;
        if (along > alongMax) alongMax = along;
        if (cross < crossMin) crossMin = cross;
        if (cross > crossMax) crossMax = cross;
    }
    sil = { key, alongMax, crossMid: (crossMin + crossMax) / 2,
            halfW: Math.max(1, (crossMax - crossMin) / 2) };
    isl[slot] = sil;
    return sil;
}

// WHICH WAY THIS OBSTACLE'S LEE POINTS: the mean wind at the obstacle itself.
//
// Not the venue mean. That is the bug this replaces — on Glacier Sound the mean is 130 degrees
// while the wind over the course runs from 45 to 217, so every shape cast its lee up to 85
// degrees away from the air actually passing it, and 462 of 599 shadowed samples disagreed
// with the truth. In the worst places the game took 70% of the breeze away where the real wind
// left a shape's lee nowhere near.
//
// And deliberately NOT the wind at the SAMPLE POINT, which sounds more local but is worse:
// two points either side of a lee would each test against a differently-aimed plume from the
// SAME island, so the lee would come apart into seams and holes instead of being one coherent
// wake. Which way a wake lies is a fact about the obstacle, not about who is looking at it.
//
// The obstacle's reference point stands for the whole shape. That is exact for the small ones
// and an approximation for a long coast lying across a bend — but a single shape can only have
// one wake, so some point has to speak for it, and its own is the defensible one. (No venue
// gives its coastline a height today, so nothing large is currently affected.)
//
// CACHED: shadowAt runs inside getWindAt, and getWindAt runs per boat and per particle per
// frame. The day's live shift is added at READ time rather than baked into the cache — it is
// the same angle on every region, so it rotates the blended mean exactly, which leaves only
// the static part to recompute.
function islandWindDir(isl) {
    const shift = state.wind.direction - state.wind.baseDirection;
    // Region oscillation is measured in tens of seconds, so a quarter-second key is far finer
    // than anything it can express. Floes are keyed on having actually moved.
    const tq = Math.round(state.time * 4);
    // ...and on the REGION SET ITSELF, by reference. The editor redraws the field after every
    // keystroke in a region's direction box, and a recompile hands back a fresh array — so
    // comparing the reference is both the cheapest test available and exactly the event that
    // should invalidate this. Without it the editor's field preview would keep showing lees
    // aimed down the wind the venue had BEFORE the edit, which is the one place a stale
    // shadow would be read as the truth about a design.
    const regs = state.course.windRegions;
    if (isl._wdT !== tq || isl._wdX !== isl.x || isl._wdY !== isl.y || isl._wdR !== regs) {
        isl._wdT = tq; isl._wdX = isl.x; isl._wdY = isl.y; isl._wdR = regs;
        isl._wdBase = regionWindAt(isl.x, isl.y).direction - shift;
    }
    return isl._wdBase + shift;
}

// A WAKE ONLY REACHES WATER THE FLOW ACTUALLY CARRIED IT TO, measured as the bend between the
// wind at the obstacle and the wind where you are standing.
//
// TWO numbers, not one. A wake genuinely does bend with the flow — Glacier Sound's isle-1 has
// 40 degrees of turn across its own 500-unit lee and is still plainly shadowing the water
// behind it — so a single cutoff either keeps the cross-field nonsense or throws away real
// lees. Full strength through the first 26 degrees, then fading, gone by a right angle: past
// that the streamline through here never came near the obstacle.
const SHADOW_BEND_FREE = Math.PI / 7;    // ~26 degrees: a wake carries this much turn intact
const SHADOW_BEND = Math.PI / 2;         // 90 degrees: none of it got here

// `dir` is where the flow GOES for current, and for WIND it is the mean direction AT THE SAMPLE
// POINT. The wind lee is still aimed by each obstacle's own wind — see islandWindDir — but the
// local one decides whether the wake got here.
function shadowAt(x, y, dir, kind) {
    const list = state.course.navIslands || state.course.islands;
    // TRAFFIC CASTS HERE TOO, and this is the one place it should. A vessel's lee is the
    // cove's whole promised mechanic — "the real hazard is its air, not its hull" — and the
    // temptation is to give it what islands have by pushing it into the islands array. That
    // would also hand it to the ROUTER, the nav grid and every sailability check, none of
    // which can cope with a caster that moves. A second pass at the bottom of this function
    // gets the wind exactly right and leaves routing untouched.
    const fleet = state.traffic;
    const hasFleet = !!(fleet && fleet.length);
    if ((!list || !list.length) && !hasFleet) return 1;
    const isWind = kind === 'wind';
    // getWindAt has already blended the field and hands its answer in, so the gate below is
    // free on the hot path. A caller that passes null for wind gets it sampled lazily, and only
    // if some obstacle turns out to be a candidate — most calls touch no caster at all and must
    // not pay for a field lookup.
    let localDir = isWind ? (dir === null || dir === undefined ? null : dir) : null;
    // CURRENT keeps one direction for every obstacle, so its flow vector and silhouette key
    // are computed once. WIND does not: see islandWindDir.
    const cFlowX = isWind ? 0 : Math.sin(dir);
    const cFlowY = isWind ? 0 : -Math.cos(dir);
    const cKey = isWind ? '' : 'c' + Math.round(dir / SHADOW_QUANTUM);
    let factor = 1;
    for (const isl of (list || [])) {
        // LENGTH FIRST. It reads an authored number or a height and needs neither geometry nor
        // wind, and it is zero for almost everything — 114 of Glacier Sound's 123 shapes author
        // no height at all — so asking it before the direction lookup and the silhouette keeps
        // both off the hot path entirely.
        //
        // Authored per shape, in units; absent means derive it from the height. 0 is a real
        // answer — a reef awash blocks no breeze, and a designer may simply not want one here.
        const len = shadowLen(isl, kind);
        if (!(len > 0)) continue;
        let flowX, flowY, key;
        if (isWind) {
            const d = islandWindDir(isl);
            flowX = -Math.sin(d); flowY = Math.cos(d);
            key = 'w' + Math.round(d / SHADOW_QUANTUM);
        } else {
            flowX = cFlowX; flowY = cFlowY; key = cKey;
        }
        const sil = shadowSil(isl, flowX, flowY, key, isWind ? '_silW' : '_silC');
        if (!sil) continue;
        // Distance DOWNFLOW of the obstacle's trailing edge, so the plume starts where the
        // land stops rather than somewhere inside it.
        const along = (x * flowX + y * flowY) - sil.alongMax;
        if (along <= 0 || along >= len) continue;
        const cross = Math.abs((x * (-flowY) + y * flowX) - sil.crossMid);
        // Plumes spread as they run.
        const halfW = sil.halfW * (1 + SHADOW_SPREAD * (along / len));
        if (cross >= halfW) continue;
        // SMOOTHSTEP on both axes, not linear — the same falloff wind and current regions
        // use, so a soft edge means one thing everywhere in this file.
        //
        // Linear reached clear air with a non-zero slope, which is a crease: a visible line
        // where the lee stops instead of a fade. And it is the wrong shape. A real wake holds
        // a roughly CONSTANT deficit in the near field just behind the body, then recovers
        // through the middle, then asymptotes — an S-curve. Across the flow it is a bell
        // rather than a triangle, for the same reason: nothing steps out of a wake.
        const ss = (t) => t * t * (3 - 2 * t);
        const lat = ss(1 - cross / halfW);      // 1 on the centreline, 0 at the edge
        const lon = ss(1 - along / len);        // 1 at the obstacle, 0 at the tail

        // HAS THE WAKE GOT HERE? A plume is cast as a straight band down the wind at the
        // obstacle, which is right while the flow runs straight — and wrong the moment the
        // field bends, because the band then walks across water the wake never reached.
        //
        // Glacier Sound showed it plainly: a 4300-unit ice shelf standing in wind from 130
        // threw a 2500-unit band north-west, over water whose own wind is from 45. A boat
        // there has the breeze on its nose from the north-east and was being told it sat in
        // the lee of something to its SOUTH-EAST — downwind of it.
        //
        // So the local wind gates the lee: full where it still agrees with the obstacle's,
        // fading out as the two part, gone by SHADOW_BEND. Smooth, because the field is
        // smooth — this scales an already-coherent plume rather than aiming it, so it cannot
        // put a seam in one.
        let bend = 1;
        if (isWind) {
            if (localDir === null) localDir = regionWindAt(x, y).direction;
            const off = Math.abs(normalizeAngle(localDir - islandWindDir(isl)));
            if (off >= SHADOW_BEND) continue;
            if (off > SHADOW_BEND_FREE) {
                bend = ss(1 - (off - SHADOW_BEND_FREE) / (SHADOW_BEND - SHADOW_BEND_FREE));
            }
        }
        // Deepest shadow wins rather than shadows stacking: two islands in line should not
        // multiply into a dead calm neither of them could produce alone.
        factor = Math.min(factor, 1 - lat * lon * bend * SHADOW_MAX);
    }

    // ── THE SECOND PASS: VESSELS ────────────────────────────────────────────────────
    // WIND ONLY. shadowLen's own argument decides this: a current wake is about whether
    // the thing blocks the WATER COLUMN, and `motion` carries the answer — grounded blocks
    // it, floating does not, "which is exactly why a floe DRIFTS WITH the current instead
    // of disturbing it". A ship floats. It blocks air, not stream.
    if (hasFleet && isWind) {
        const ss2 = (t) => t * t * (3 - 2 * t);
        for (const v of fleet) {
            if (!v.active || !(v.shadowLen > 0)) continue;
            // Same three numbers shadowSil produces for an island, off the hull's own
            // oriented box: how far downwind its trailing edge reaches, where the plume is
            // centred across the flow, and how wide it starts. Recomputed rather than
            // cached because the caster MOVES — an island's silhouette is keyed on wind
            // direction alone precisely because it never does.
            const fx = Math.sin(v.heading), fy = -Math.cos(v.heading);
            const px = Math.cos(v.heading), py = Math.sin(v.heading);
            const hl = v.hullLen * 0.5, hb = v.hullBeam * 0.5;
            const flowX = -Math.sin(v.windDir), flowY = Math.cos(v.windDir);
            let alongMax = -Infinity, cMin = Infinity, cMax = -Infinity;
            for (let i = 0; i < 4; i++) {
                const sa = (i & 1) ? hl : -hl, sb = (i & 2) ? hb : -hb;
                const cx = v.x + fx * sa + px * sb, cy = v.y + fy * sa + py * sb;
                const a = cx * flowX + cy * flowY;
                if (a > alongMax) alongMax = a;
                const c = cx * (-flowY) + cy * flowX;
                if (c < cMin) cMin = c;
                if (c > cMax) cMax = c;
            }
            const along = (x * flowX + y * flowY) - alongMax;
            if (along <= 0 || along >= v.shadowLen) continue;
            const cross = Math.abs((x * (-flowY) + y * flowX) - (cMin + cMax) * 0.5);
            const halfW = (cMax - cMin) * 0.5 * (1 + SHADOW_SPREAD * (along / v.shadowLen));
            if (cross >= halfW) continue;
            if (localDir === null) localDir = regionWindAt(x, y).direction;
            const off = Math.abs(normalizeAngle(localDir - v.windDir));
            if (off >= SHADOW_BEND) continue;
            const bend2 = off > SHADOW_BEND_FREE
                ? ss2(1 - (off - SHADOW_BEND_FREE) / (SHADOW_BEND - SHADOW_BEND_FREE)) : 1;
            const lat2 = ss2(1 - cross / halfW);
            const lon2 = ss2(1 - along / v.shadowLen);
            factor = Math.min(factor, 1 - lat2 * lon2 * bend2 * SHADOW_MAX);
        }
    }
    return factor;
}

// How far the lee reaches, in units.
//
// WIND scales with HEIGHT — six times it, mid-range of the five-to-eight a solid bluff body
// gives — because that is what a wind shadow is. Not with footprint: a granite spire and a
// sandbar of the same outline shadow completely differently, and a width-derived length
// cannot tell them apart. It also needed an arbitrary cap, since Glacier Sound's coast is
// 13000 units across and would have asked for a thirty-kilometre lee. Height needs no cap —
// it is bounded by what land is, and a 55 m rock giving 330 m of bad air is simply true.
//
// CURRENT is a different question, and the answer is not a depth model. What matters is
// whether the thing blocks the WATER COLUMN — whether it reaches the bottom. A grounded
// island blocks all of it and the stream goes around; a floe draws a metre or two of a
// column twenty metres deep and the water passes underneath, which is exactly why a floe
// DRIFTS WITH the current instead of disturbing it.
//
// So there is no toggle and no depth field: `motion` already carries it. Fixed is grounded,
// drift is floating. Where a wake does exist its scale is the FOOTPRINT the stream sees —
// height above the waterline has nothing to do with it — which is why the two lees derive
// from different measurements. `shadowSuggest` below is that figure, offered rather than
// applied; a deep-draught berg or a reef awash are both a typed number away.
//
// ⚠️ BOTH ARE OFF UNTIL AUTHORED. Height is 0 on every kind, and a wake has no derived
// default at all, so a venue casts no lee until someone decides it should. Deriving one
// from footprint looked reasonable and was not: Glacier Sound's coast is 13000 units broad,
// which handed it a 2.8 km wake nobody had asked for.
// The editor needs to show what "auto" currently works out to, and there must be exactly one
// answer to that — so it asks the game rather than deriving a second one of its own.
if (typeof window !== 'undefined') {
    window.shadowLengthOf = (isl, kind) => shadowLen(isl, kind);
}
// Sailing's own rule of thumb puts a wind shadow at seven to fifteen times the height of
// the thing casting it, and rigging references quote 10-20x. Ten is the middle of the
// agreement rather than a number picked to feel right. Nothing in any venue authors a
// height yet, so this decides nothing today — it decides what the FIRST authored cliff
// does, which is exactly when a made-up constant would have been hardest to argue with.
const SHADOW_HEIGHTS = 10;           // wind shadow, in obstacle heights
const SHADOW_WAKE = 2.5;            // current wake, in half-widths of what the stream sees
const M_TO_U = 5;                   // the world's scale: 5 units to the metre
function shadowLen(isl, kind) {
    const authored = kind === 'wind' ? isl.windShadow : isl.currentShadow;
    if (authored != null) return authored;
    if (kind !== 'wind') return 0;
    return (isl.height || 0) * SHADOW_HEIGHTS * M_TO_U;
}
// What a wake WOULD be if this thing were given one — the editor offers it as the
// placeholder so typing a real figure is a lookup rather than a guess. Zero for anything
// afloat, which is the physics rather than a UI decision.
if (typeof window !== 'undefined') {
    window.shadowSuggest = (isl) => {
        // Afloat or awash, the stream is undisturbed — a floe rides on it and a shoal sits
        // under it, and neither blocks the column. Same answer, opposite reasons.
        if (isl.isFloe || isl.awash) return 0;
        const dir = (state.wind && state.wind.direction) || 0;
        const sil = shadowSil(isl, Math.sin(dir), -Math.cos(dir), 'suggest|' + dir, '_silS');
        return sil ? sil.halfW * SHADOW_WAKE : 0;
    };
}

// ── HOW A REGION BREATHES ───────────────────────────────────────────────────
// A plain sine is perfectly forecastable, and measurably so: fit a sinusoid to 90
// seconds of it and the next 30 seconds come back to floating-point zero error. On a
// one-region venue that makes the whole day readable off one cycle, which is the
// opposite of a shifty breeze.
//
// Two additions fix it, and neither breaks the amplitude bound:
//
//   A SLOWER SUB-HARMONIC. Not a faster one — a faster harmonic is jitter, and it costs
//   slew without costing predictability. A slow trend underneath is what a real
//   oscillating breeze rides on, and it defeats forecasting for the honest reason: the
//   mean the observer is fitting against keeps moving out from under them.
//
//   TANH SHAPING. A sine spends most of its time mid-transition; a breeze holds a phase
//   and then shifts through it. Pushing the wave toward a square takes the fraction of
//   time spent near an extreme from 0.58 to 0.77 — that is the difference between "a
//   left phase and a right phase" and an aimless wobble.
//
// Measured on the blended field over Gatorgrass: forecast error 14.2 degrees against a
// 13.2-degree persistence baseline, i.e. extrapolating the oscillation is WORSE than
// assuming the wind stays where it is. That is the definition of unreadable.
//
// ⚠️ `|windOsc| <= 1` EXACTLY — the harmonics are normalised by their amplitude sum and
// tanh is monotone on [-1,1]. Everything downstream relies on it: `dirVar` still means
// the half-swing it says, and the rule that keeps the unit-vector blend out of its
// atan2 singularity (|Δmean| + dirVarA + dirVarB < 180 degrees for any two regions whose
// supports touch) is stated in those same units. Widen this and that rule silently moves.
//
// Still a pure function of time with no RNG, so replays and the eval's paired seeds
// reproduce exactly. The per-race variety lives in `phase`, drawn once in initCourse.
const WIND_OSC_SUB = 2.3;        // the slow trend's period, as a multiple of the region's own
const WIND_OSC_SUB_AMP = 0.6;    // its amplitude, relative to the fundamental
const WIND_OSC_SHAPE = 1.6;      // tanh sharpening; 0 would be a plain sine
const WIND_OSC_NORM = Math.tanh(WIND_OSC_SHAPE);
function windOsc(t, period, phase) {
    if (!(period > 0)) return 0;
    const w = (t / period) * Math.PI * 2;
    // The sub-harmonic takes a DIFFERENT multiple of the same phase, so one seeded draw
    // per region decorrelates both components instead of sliding them together.
    // Dividing by the amplitude sum is what puts `s` in [-1,1]; tanh is monotone there.
    const s = (Math.sin(w + phase) + WIND_OSC_SUB_AMP * Math.sin(w / WIND_OSC_SUB + phase * 1.73))
            / (1 + WIND_OSC_SUB_AMP);
    return Math.tanh(WIND_OSC_SHAPE * s) / WIND_OSC_NORM;
}

// THE MEAN WIND AT A POINT: the regions blended, plus the day's live shift. No puffs, no lee.
//
// Split out of getWindAt so an OBSTACLE can ask which way its own lee points without asking
// for the lee — shadowAt is called from getWindAt, so anything the shadow consults has to
// stop short of the shadow or the two recurse forever. This is the field that gusts and
// shadows are applied on top of, and it is the honest answer to "which way is the wind
// blowing here" for anything that is not a boat.
//
// WIND_MEAN_FIELD: while set, the field answers with the DAY'S MEAN — oscillator at zero,
// no live shift. The grid bake stamps a venue-cached grid from this field, and a one-time
// static stamp must not capture whatever instant of the day the bake happened to run in:
// the oscillator made the instantaneous field a function of `r.phase` and `state.time`,
// neither of which is in the bake's cache key, so the first bake (page load, phases still
// unseeded) was winning forever and every process baked a different router.
let WIND_MEAN_FIELD = false;
function regionWindAt(x, y) {
    const baseSpeed = state.wind.speed;
    const baseDir = state.wind.direction;

    // ── Wind regions ────────────────────────────────────────────────────────
    // A region states the wind THERE — an absolute mean direction and (optionally) an
    // absolute speed — and overlapping regions are AVERAGED, not summed.
    //
    // Averaging is the whole point. Summing deltas meant that building a curving breeze
    // out of two regions also doubled its strength through the overlap, so every curve
    // came with a squall attached and the only way to avoid it was to author
    // compensating lulls. Averaged, two 12-knot regions 40 degrees apart give 12 knots
    // at 20 degrees, which is what a curving wind actually is.
    //
    // The blend is a partition of unity: each region contributes its falloff intensity
    // as a WEIGHT, and whatever weight is left over (1 - the sum, floored at zero) goes
    // to the venue's own wind. So a region's edge still fades smoothly into its
    // surroundings, full coverage means the regions decide entirely, and nothing
    // anywhere can exceed the strongest thing blowing.
    //
    // Direction averages as unit vectors and speed as a scalar, deliberately: averaging
    // full velocity vectors makes two opposed regions cancel to a calm, which is a
    // convergence nobody asked for when all they wanted was a bend.
    let dir = baseDir, spd = baseSpeed;
    const wregions = state.course.windRegions;
    if (wregions && wregions.length) {
        // The venue's live shift — oscillation, persistent shift — is a property of the
        // DAY, not of the patch of water, so it rides on top of every region's mean.
        // Without this a region would freeze the wind it covers, and a course fully
        // covered by regions would never see a shift at all.
        const liveShift = WIND_MEAN_FIELD ? 0 : (baseDir - state.wind.baseDirection);
        let wsum = 0, ux = 0, uy = 0, sacc = 0;
        for (const r of wregions) {
            // The edge ramp is centered on the outline (VenueDoc.regionWeight), so a
            // region reaches falloff/2 OUTSIDE its polygon — the cull box pads by that.
            const bb = r.bb, pad = (r.falloff || 0) / 2 + 1;
            if (x < bb.minX - pad || x > bb.maxX + pad || y < bb.minY - pad || y > bb.maxY + pad) continue;
            const sd = Arena.signedDist(r, x, y);
            const w = VenueDoc.regionWeight(sd, r.falloff);
            if (w <= 0) continue;
            // Mean plus an oscillation with an explicit time scale — see windOsc for what
            // shape that oscillation has and why it is not a plain sine. state.time is
            // deterministic and no RNG is touched here, so regions cannot shift the seeded
            // stream; the per-race variety is baked into `phase` by initCourse.
            const osc = WIND_MEAN_FIELD ? 0 : windOsc(state.time, r.period, r.phase);
            const rd = r.direction + r.dirVar * osc + liveShift;
            // A REGION STATES ITS OWN SPEED. There is no venue fallback: an absent speed is
            // zero, the same way an unstated patch of water is calm. Falling back to the
            // venue meant a region could look authored while silently borrowing a number
            // from somewhere else, and two regions with the same fields could blow at
            // different strengths depending on which venue they sat on.
            const rs = Math.max(0, (r.speed || 0) + r.speedVar * osc);
            ux += Math.sin(rd) * w; uy += -Math.cos(rd) * w;
            sacc += rs * w;
            wsum += w;
        }
        // NO WIND WHERE NO REGION SAYS THERE IS. The leftover weight goes to CALM, not to
        // a venue-wide breeze: once regions state the wind, an unstated patch is a hole in
        // the design, and filling it in silently is how a course comes to depend on a
        // fallback nobody authored. A hole is sailable-looking and unsailable, so the
        // checks hunt for it — see `no-wind` in venuecheck.
        const wBase = Math.max(0, 1 - wsum);
        const total = wsum + wBase;
        dir = wsum > 0 ? Math.atan2(ux, -uy) : baseDir;
        spd = total > 0 ? sacc / total : 0;
    }
    // Sailing School fades the wind in from nothing ("Here comes the wind"): one scale on the
    // region blend, so every reader — polar, HUD, comets, sound — sees the same breeze.
    if (window.School && School.active && School.windScale != null) spd *= School.windScale;
    return { direction: dir, speed: spd };
}

// ── THE COURSE'S PRESSURE RANGE ─────────────────────────────────────────────
// What "a lot of wind" means HERE. Pressure is only ever readable against a reference:
// 18 knots is a hole on Glacier Sound and a squall on Gatorgrass, so a streak layer that
// paints pressure needs to know which course it is painting.
//
// The reference used to be `state.wind.speed`, which is the region blend at the ROUTE
// CENTROID — a single point. On Glacier Sound that point reads 20 while the start line
// sits in 16, so every streak at the start reported a lull and the layer said "no
// pressure anywhere" on the one venue whose wind actually varies across the water.
//
// So: sample the MEAN field (no puffs, no lee — those are the deviations we want to
// read AGAINST it) over sailable water and take its p10/p90. Sampled across a full
// oscillation period, because a region that breathes ±7 knots has a range no single
// instant shows. Then widened to at least ±18% of the median, because nine of the ten
// venues state one uniform wind region: without the widening lo === hi, the ramp has no
// denominator, and an island's lee — real pressure variation on a "steady" course —
// would have nothing to resolve against.
const PRESSURE_MIN_SPAN = 0.18;   // half-width of the narrowest ramp, as a fraction of the median
// The streak layer's floor and tail window are derived from this same scale, so they are
// refreshed together rather than at the call sites — `computeWindPressureScaleRaw` has
// several early returns and a fallback path, and any of them could otherwise leave the
// layer reading a previous venue's reference.
function computeWindPressureScale() {
    computeWindPressureScaleRaw();
    computeStreakRef();
}
function computeWindPressureScaleRaw() {
    const med0 = Math.max(1, state.wind.baseSpeed || 10);
    const fallback = () => { state.wind.pressure = { lo: med0 * (1 - PRESSURE_MIN_SPAN), hi: med0 * (1 + PRESSURE_MIN_SPAN), med: med0 }; };
    const bnd = state.course && state.course.boundary;
    if (!bnd || typeof Arena === 'undefined') return fallback();

    // OVER THE RACECOURSE, not over the arena. Glacier Sound's arena is 8.75 km across and
    // the breeze at the far edge of it is never sailed; letting that water set the ramp put
    // the entire start box below `lo`, so every streak the player could see sat pinned at
    // the cold end with no gradient in it. The pressure that matters is the pressure on the
    // legs, so the marks decide the window — padded, because boats work the edges.
    let ext = Arena.extent(bnd);
    const mk = state.course.marks;
    const mlist = mk ? (Array.isArray(mk) ? mk : Object.values(mk)) : [];
    const pts = mlist.filter(m => m && typeof m.x === 'number');
    if (pts.length >= 2) {
        let a = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        for (const m of pts) { a.minX = Math.min(a.minX, m.x); a.maxX = Math.max(a.maxX, m.x); a.minY = Math.min(a.minY, m.y); a.maxY = Math.max(a.maxY, m.y); }
        const pad = Math.max(500, 0.35 * Math.max(a.maxX - a.minX, a.maxY - a.minY));
        ext = {
            minX: Math.max(ext.minX, a.minX - pad), maxX: Math.min(ext.maxX, a.maxX + pad),
            minY: Math.max(ext.minY, a.minY - pad), maxY: Math.min(ext.maxY, a.maxY + pad)
        };
    }

    // The longest FULL CYCLE any region breathes on; 0 phases means one sample is the truth.
    // ⚠️ `r.period` is the fundamental, not the cycle: windOsc lays a sub-harmonic
    // WIND_OSC_SUB times slower underneath it, so the wave does not come back around until
    // period * WIND_OSC_SUB. Sampling the fundamental alone walked six phases of the fast
    // component while the slow one barely moved, and the p10/p90 it returned was a slice of
    // the range rather than the range.
    let period = 0;
    for (const r of (state.course.windRegions || [])) if (r.period > period) period = r.period;
    period *= WIND_OSC_SUB;
    const phases = period > 0 ? 6 : 1;

    // Each phase's own SPATIAL spread, then averaged — deliberately not one pooled
    // percentile over every phase at once. Pooling folds the breathing into the ramp, and
    // on a venue whose regions swing ±7 knots that leaves the spatial gradient — the
    // thing a player steers on — squeezed into half the ramp. Averaged, the gradient uses
    // most of the ramp at any instant, and a course-wide build still pushes the whole
    // field warm, which is the cue it should be.
    const t0 = state.time;
    const N = 26;
    let loAcc = 0, hiAcc = 0, medAcc = 0, phasesUsed = 0;
    for (let k = 0; k < phases; k++) {
        state.time = t0 + (period * k) / phases;
        const speeds = [];
        for (let i = 0; i <= N; i++) {
            const x = ext.minX + (ext.maxX - ext.minX) * (i / N);
            for (let j = 0; j <= N; j++) {
                const y = ext.minY + (ext.maxY - ext.minY) * (j / N);
                if (!Arena.contains(bnd, x, y, 0)) continue;
                if (!inMaskWater(x, y)) continue;
                speeds.push(regionWindAt(x, y).speed);
            }
        }
        if (speeds.length < 16) continue;
        speeds.sort((a, b) => a - b);
        const q = (f) => speeds[Math.round(f * (speeds.length - 1))];
        loAcc += q(0.10); hiAcc += q(0.90); medAcc += q(0.50); phasesUsed++;
    }
    state.time = t0;
    if (!phasesUsed) return fallback();

    const med = Math.max(1, medAcc / phasesUsed);
    // THE HONEST SPREAD, before the ramp widens it. `lo`/`hi` below are a drawing ramp and
    // are deliberately never narrower than ±18% — but a briefing that quoted those would
    // invent a range on the nine venues whose wind is one uniform region. The forecast
    // reads these instead. See windRangeText().
    state.wind.spread = { lo: loAcc / phasesUsed, hi: hiAcc / phasesUsed, med };

    let lo = Math.min(loAcc / phasesUsed, med * (1 - PRESSURE_MIN_SPAN));
    let hi = Math.max(hiAcc / phasesUsed, med * (1 + PRESSURE_MIN_SPAN));

    // HEADROOM FOR PUFFS. This ramp is built from the MEAN field on purpose — a puff is a
    // deviation and we want to read it AGAINST the mean, not fold it in. But a puff still
    // has to have somewhere to go: now that a gust's only wind cue is what it does to this
    // field, a cell landing on the windiest water was pinning colour, width and density to
    // the clamp with nothing left to say. Measured on Glacier Sound: a 7-knot puff on top
    // of its 28-knot katabatic corner moved every channel except length by exactly zero.
    //
    // HALF the stated gust, not all of it. Every knot of headroom costs the spatial
    // gradient — "which side has more pressure" — resolution, and that is the primary read.
    let biggest = 0;
    for (const r of (state.course.gustRegions || [])) if (r.count > 0 && r.gustKt > biggest) biggest = r.gustKt;
    if (biggest > 0) { hi += biggest * 0.5; lo -= biggest * 0.5 * LULL_RATIO; }

    state.wind.pressure = { lo: Math.max(0, lo), hi, med };
}

// The LIGHT build's stand-in for computeWindPressureScale: a spread read straight off
// the authored wind regions — min/max of their stated speeds, oscillation included —
// instead of sampling the blended field over the course at eight phases. Rougher (it
// ignores where the regions ARE), but the board's "10–15 kt" line is a forecast, not a
// measurement, and this costs microseconds where the scan costs most of a second. The
// pressure ramp gets the same clamp-and-headroom shape the scan builds, so the streak
// layer behind the overlay keeps reading sensible colours; the full build at Start
// replaces both with the measured versions.
function lightWindSpread(c) {
    const base = (c && c.windBaseSpeed) || state.wind.baseSpeed || 12;
    // AREA-WEIGHTED p10/p90 across the regions, not min/max: the scan's percentiles are
    // dominated by the big regions the course actually sits in, and a min/max let one
    // small authored calm pocket drag the forecast to "0–7 kt" on a 4-knot bayou.
    // Oscillation is left out for the same reason the scan mostly cancels it: it
    // measures the MEAN field.
    const entries = [];
    for (const r of ((c && c.windRegions) || [])) {
        const s = r.speed != null ? r.speed : base;
        const a = Math.abs(window.VenueDoc.ringArea ? window.VenueDoc.ringArea(r.poly) : 1) || 1;
        entries.push([s, a]);
    }
    let lo = base, hi = base;
    if (entries.length) {
        entries.sort((x, y) => x[0] - y[0]);
        const total = entries.reduce((a, e) => a + e[1], 0);
        const at = (f) => {
            let acc = 0;
            for (const [s, a] of entries) { acc += a; if (acc >= total * f) return s; }
            return entries[entries.length - 1][0];
        };
        lo = at(0.10); hi = at(0.90);
    }
    state.wind.spread = { lo: Math.max(0, lo), hi, med: base };
    let pLo = Math.min(lo, base * (1 - PRESSURE_MIN_SPAN));
    let pHi = Math.max(hi, base * (1 + PRESSURE_MIN_SPAN));
    let biggest = 0;
    for (const r of ((c && c.gustRegions) || [])) if (r.count > 0 && r.gustKt > biggest) biggest = r.gustKt;
    if (biggest > 0) { pHi += biggest * 0.5; pLo -= biggest * 0.5 * LULL_RATIO; }
    state.wind.pressure = { lo: Math.max(0, pLo), hi: pHi, med: base };
}

// 0 at the course's light end, 1 at its heavy end. Every channel the streak layer varies
// — hue, width, alpha, how many streaks are born — reads off this one number, so they can
// never disagree about where the pressure is.
function pressureAt(speed) {
    const p = state.wind.pressure;
    if (!p) return 0.5;
    const t = (speed - p.lo) / Math.max(0.001, p.hi - p.lo);
    return t < 0 ? 0 : t > 1 ? 1 : t;
}

// ── SQUALLS ─────────────────────────────────────────────────────────────────
//
// The lagoon card's promised mechanic: "squalls marching down the trades. Duck the
// rain or ride it." Design decisions, in order (owner-approved 2026-08-08):
//
//   MOVEMENT   Straight lines. Each cell fixes its course at spawn — the trades plus a
//              small jitter — and marches at SQUALL_DEFAULTS.speedFactor times the speed
//              the breeze carries a puff (SQUALL_DRIFT): squalls OVERTAKE the breeze, which
//              is what makes riding the front a maneuver and ducking a timing problem.
//              How FAR above 1.0 that factor sits is the whole feel of the mechanic — see
//              its note for why 1.45 was correct and still wrong. Spawned beyond the upwind edge,
//              recycled past the downwind one. FIXED POPULATION, race-rng seeded — the
//              floe doctrine: the count is the designer's, the day's layout is the
//              seed's. No spawner, no unbounded anything, replays exactly.
//   SHAPE      An ellipse broader than deep (squall lines are wide and shallow), worn
//              as a blob-stack of overlapping discs. NO CLOUD BODY over the racing —
//              the SHADOW is drawn exactly on the physics ellipse and the rain falls
//              inside it, so the edge you see darken is the edge where the wind
//              changes. What you feel is what you see.
//   WIND       Three zones, every edge smoothstepped: the leading third is the gust
//              front (+SQUALL_FRONT of the local mean), the core holds +SQUALL_CORE,
//              and a WAKE ellipse trailing behind is dead air at SQUALL_WAKE — the
//              trap that completes the mechanic: chase the squall too eagerly and you
//              park in the hole it leaves. Inside, the wind veers toward the cell's
//              own course (capped at SQUALL_VEER) and fans outward across the flanks,
//              so one edge lifts you and the other heads you.
//
// All of it enters the world through getWindAt below, so the boats, the AI and the
// whitecap field all feel the same squall without being told about it separately.
// speedFactor 1.10, DOWN FROM 1.45 (owner's call, 2026-08-09): once the drift bug below
// was fixed the cells were correct and too quick — 237 u/s against a boat's 150 meant a
// front swept over you and was gone, so the front was an event you were hit by rather than
// one you could set up for and ride. 1.10 puts the drift at 178 u/s: still faster than the
// puffs it marches through (156), so it still runs its own breeze down and the wake still
// arrives from behind, but the overtake is a lean the boat can work with. Paired A/B, same
// 10 seeds, 1.45 -> 1.10: drift 236 -> 179 u/s, and what it buys is DWELL, not more weather
// — exposure is unchanged at 29% and the wake at 13%, while encounters drop 12 -> 10 per
// boat and lengthen, median 6.5s -> 7.4s and p90 9.0s -> 11.6s. Race times are flat
// (280s -> 276s), so this is a feel change, not a balance one.
const SQUALL_DEFAULTS = { count: 0, rx: 850, ry: 550, sizeVar: 0.35,
                          speedFactor: 1.10, courseJitter: 0.17 };
// UNITS PER FRAME PER KNOT — how fast the breeze carries a thing. This is the same number
// spawnRegionGust bakes into a puff's moveSpeedFactor (`* 0.18`), stated out loud so a
// squall and a puff are measured against one clock, and so SQUALL_SPEED_FACTOR means what
// its comment says: a multiple of the speed the breeze carries a puff, i.e. above 1.0 the
// cell visibly runs its own puffs down.
//
// ⚠️ THIS EXISTS BECAUSE THE FIRST VERSION ADVANCED PER SECOND (`* dt`) WHERE EVERY OTHER
// CELL IN THE FRAME PATH ADVANCES PER FRAME (`* dt * 60`), and read `local.speed` — knots —
// as though it were already units. Measured on Pearl Lagoon before the fix: cells drifted
// 24 u/s against an ordinary puff's 150 and a 5.4-knot boat's 81. A squall that a boat laps
// cannot march down the trades, cannot leave its dead-air wake ACROSS anyone's path, and
// cannot be ducked or ridden — over 12 seeds the fleet spent 6.5% of its racing time in
// contact with one and SEVEN SEEDS SAW NONE AT ALL. Anything that moves on this map moves
// in units per frame; a speed in knots has to be converted before it can be one.
const SQUALL_DRIFT = 0.18;
const SQUALL_FRONT = 0.75;    // leading-edge gain, fraction of the local mean
const SQUALL_CORE = 0.4;      // under the rain
const SQUALL_WAKE = 0.45;     // multiplier in the trailing hole: 55% off
const SQUALL_VEER = 0.35;     // rad, max turn toward the cell's own course
const SQUALL_FAN = 0.2;       // rad, outflow divergence across the flanks

// WHERE THE CELLS LIVE: the RACECOURSE, not the arena. Cached on the course because the
// marks do not move within a race, and both the spawner and the recycler need it.
//
// The arena is the water; the course is the part of it anyone sails. Pearl Lagoon's marks
// span ~2000 units about their centroid inside an arena whose half-diagonal is 4245, so
// laterals dealt across ±0.8 of the ARENA put most cells beside a course they never reach —
// measured, 5 of 12 seeds had a cell within a boat's reach at any point in the race. A cell
// is weather the fleet is supposed to MEET; deal it where the fleet is, and let its size
// (rx/ry) decide how much of the course one covers.
function squallField() {
    const c = state.course;
    if (c._squallField) return c._squallField;
    const e = Arena.extent(c.boundary);
    let f = { cx: (e.minX + e.maxX) / 2, cy: (e.minY + e.maxY) / 2,
              R: Math.hypot(e.maxX - e.minX, e.maxY - e.minY) / 2 };
    const mk = c.marks || [];
    if (mk.length) {
        let sx = 0, sy = 0;
        for (const m of mk) { sx += m.x; sy += m.y; }
        const cx = sx / mk.length, cy = sy / mk.length;
        let R = 0;
        for (const m of mk) R = Math.max(R, Math.hypot(m.x - cx, m.y - cy));
        // A floor, so a tiny course does not collapse the field to a point, and never
        // wider than the arena it sits in — the cells still march across real water.
        f = { cx, cy, R: Math.min(f.R, Math.max(900, R)) };
    }
    c._squallField = f;
    return f;
}

function spawnSquall(rng, cfg, initial) {
    const fld = squallField();
    const cx = fld.cx, cy = fld.cy;
    const halfDiag = fld.R;
    const course = state.wind.baseDirection + (rng() * 2 - 1) * (cfg.courseJitter != null ? cfg.courseJitter : SQUALL_DEFAULTS.courseJitter);
    const ux = -Math.sin(course), uy = Math.cos(course);      // downwind: the march
    const k = 1 + (cfg.sizeVar != null ? cfg.sizeVar : SQUALL_DEFAULTS.sizeVar) * (rng() * 2 - 1);
    const rx = (cfg.rx || SQUALL_DEFAULTS.rx) * k;
    const ry = (cfg.ry || SQUALL_DEFAULTS.ry) * k;
    const lateral = (rng() * 2 - 1) * halfDiag * 0.8;
    // Mid-map when the race opens (a course that starts squall-less for two minutes is
    // a card promise broken); beyond the upwind rim on every respawn after.
    const along = initial ? (rng() * 2 - 1) * halfDiag : -(halfDiag + ry + 250);
    const q = {
        x: cx + ux * along + uy * lateral,
        y: cy + uy * along - ux * lateral,
        course, rx, ry,
        speedFactor: cfg.speedFactor || SQUALL_DEFAULTS.speedFactor,
        blobs: []
    };
    // The blob-stack silhouette and the rain field, dealt once per cell.
    for (let i = 0; i < 7; i++) {
        q.blobs.push({ ax: (rng() * 2 - 1) * rx * 0.72, ay: (rng() * 2 - 1) * ry * 0.62,
                       r: (0.38 + rng() * 0.28) * Math.min(rx, ry) });
    }
    return q;
}

function initSqualls() {
    state.squalls = [];
    const cfg = state.course && state.course.doc && state.course.doc.squalls;
    if (!cfg || !cfg.count || !state.course.boundary) return;
    state.squallRng = state.race.seed ? mulberry32(state.race.seed + 77) : Math.random;
    for (let i = 0; i < Math.min(6, cfg.count); i++) {
        state.squalls.push(spawnSquall(state.squallRng, cfg, true));
    }
}

function updateSqualls(dt) {
    if (!state.squalls || !state.squalls.length) return;
    const cfg = (state.course.doc && state.course.doc.squalls) || {};
    const fld = squallField();
    const cx = fld.cx, cy = fld.cy;
    const halfDiag = fld.R;
    const timeScale = dt * 60;
    for (let i = 0; i < state.squalls.length; i++) {
        const q = state.squalls[i];
        // Carried by the breeze where it is, like a puff — but on ITS OWN fixed course:
        // a squall is a synoptic feature, and its predictability is the mechanic.
        // SQUALL_DRIFT converts the local mean from knots into the units-per-frame every
        // other moving thing on this map is measured in; see its note.
        const local = regionWindAt(q.x, q.y);
        const spd = (local.speed > 0.1 ? local.speed : state.wind.speed) * SQUALL_DRIFT * q.speedFactor;
        q.x += -Math.sin(q.course) * spd * timeScale;
        q.y += Math.cos(q.course) * spd * timeScale;
        // Past the downwind rim (wake and all): recycle upwind at a fresh lateral.
        const along = (q.x - cx) * -Math.sin(q.course) + (q.y - cy) * Math.cos(q.course);
        if (along > halfDiag + q.ry * 2.8 + 250) {
            state.squalls[i] = spawnSquall(state.squallRng || Math.random, cfg, false);
        }
    }
}

// The shadow: the physics ellipse wearing its blob-stack — BAKED once per cell with a
// wide blur, because a cloud shadow has no edge: light wraps a cloud, and the hard
// disc rims of the unbaked version read as a paper cutout on the water. The bake is
// cheap (a shadow is ALL soft edges, so 3 units/px loses nothing) and the cell's
// shape never changes, only its position.
function squallShadowSprite(q) {
    if (q._shadow) return q._shadow;
    const UPP = 3;
    // TWO PASSES, tuned so a squall cannot be mistaken for a big gust: a fairly tight
    // rim blur (edge distinct, never paper-hard) and a second, smaller, softer fill
    // stacked inside it, so the heart runs roughly twice as dark as the rim. A gust is
    // an even wash; a squall has a body.
    const rimBlur = Math.min(q.rx, q.ry) * 0.07;
    const coreBlur = Math.min(q.rx, q.ry) * 0.16;
    let mx = 0, my = 0;
    for (const b of q.blobs) {
        mx = Math.max(mx, Math.abs(b.ax) + b.r);
        my = Math.max(my, Math.abs(b.ay) + b.r);
    }
    const W = (mx + coreBlur * 2.5) * 2, H = (my + coreBlur * 2.5) * 2;
    const cv = document.createElement('canvas');
    cv.width = Math.max(8, Math.ceil(W / UPP));
    cv.height = Math.max(8, Math.ceil(H / UPP));
    const g = cv.getContext('2d');
    const k = cv.width / W;
    g.fillStyle = 'rgb(13, 22, 38)';
    const blobs = (scale, blur) => {
        g.filter = `blur(${Math.max(1, blur * k)}px)`;
        g.beginPath();
        for (const b of q.blobs) {
            const ax = b.ax * scale * k + cv.width / 2, ay = b.ay * scale * k + cv.height / 2;
            const r = b.r * (scale * 0.9 + 0.1) * k;
            g.moveTo(ax + r, ay);
            g.arc(ax, ay, r, 0, Math.PI * 2);
        }
        g.fill();
    };
    blobs(1, rimBlur);        // the outline: distinct
    blobs(0.75, coreBlur);    // the heart: stacked darkness, softly placed
    g.filter = 'none';
    q._shadow = { canvas: cv, w: W, h: H };
    return q._shadow;
}
function drawSquallShadows(ctx) {
    if (!state.squalls || !state.squalls.length) return;
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    for (const q of state.squalls) {
        const limit = viewRadius + Math.max(q.rx, q.ry) * 1.8;
        if ((q.x - state.camera.x) ** 2 + (q.y - state.camera.y) ** 2 > limit ** 2) continue;
        const sh = squallShadowSprite(q);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.course);
        // The bake stacks two fills, so this is the RIM's opacity — the heart lands
        // near twice it, which is the darkness that says squall rather than gust.
        ctx.globalAlpha = 0.26;
        ctx.drawImage(sh.canvas, -sh.w / 2, -sh.h / 2, sh.w, sh.h);
        ctx.restore();
    }
}

// The rain: a SCREEN-SPACE downpour whose strength is where YOU are — the smoothstepped
// squall field sampled at the camera, so sailing toward a cell's heart winds the rain up
// from a few streaks to a hard grey sheet, and clearing the rim shuts it off. Hard rain
// is long fast diagonal strokes plus a faint washing veil; every streak is deterministic
// from its own index (render must not touch the eval RNG stream). Drawn over the whole
// frame in screen space: rain falls past the CAMERA, not past any one patch of water.
function squallRainAt(x, y) {
    let best = 0;
    if (!state.squalls) return 0;
    for (const q of state.squalls) {
        const dx = x - q.x, dy = y - q.y;
        const ux = -Math.sin(q.course), uy = Math.cos(q.course);
        const along = dx * ux + dy * uy;
        const across = dx * uy - dy * ux;
        // Slightly wider than the physics ellipse: the first drops land before the wind.
        const d2 = (along * along) / (q.ry * q.ry * 1.32) + (across * across) / (q.rx * q.rx * 1.32);
        if (d2 < 1) {
            const t = 1 - Math.sqrt(d2);
            const sF = t * t * (3 - 2 * t);
            if (sF > best) best = sF;
        }
    }
    return best;
}
function drawSquallRain(ctx) {
    if (!state.squalls || !state.squalls.length) return;
    const inten = squallRainAt(state.camera.x, state.camera.y);
    if (inten <= 0.02) return;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // The veil: a downpour greys the world before any single drop reads.
    ctx.fillStyle = `rgba(178, 198, 214, ${(0.10 * inten).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    // Streaks fall down-wind IN THE SCREEN FRAME, so they lean the way the water says.
    const a = state.wind.direction - state.camera.rotation;
    const dx = -Math.sin(a), dy = Math.cos(a);
    const n = Math.round(40 + 180 * inten);
    const len = 30 + 40 * inten;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const wrapW = W + len * 2, wrapH = H + len * 2;
    for (let i = 0; i < n; i++) {
        const h1 = ((i * 73856093) % 100003) / 100003;
        const h2 = ((i * 19349663) % 100019) / 100019;
        const h3 = ((i * 83492791) % 100043) / 100043;
        // Fast fall: each streak cycles the frame in well under a second at full rate.
        const t = (state.time * (1.6 + h3 * 1.2) + h1 * 7.3) % 1;
        const px = (((h1 * wrapW + dx * t * wrapH * 1.4) % wrapW) + wrapW) % wrapW - len;
        const py = (((h2 * wrapH + dy * t * wrapH * 1.4) % wrapH) + wrapH) % wrapH - len;
        const al = (0.10 + 0.26 * inten) * (0.6 + 0.4 * h3);
        ctx.strokeStyle = `rgba(214, 232, 246, ${al.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + dx * len, py + dy * len);
        ctx.stroke();
    }
    ctx.restore();
}

function getWindAt(x, y) {
    const mean = regionWindAt(x, y);
    const dir = mean.direction, spd = mean.speed;

    // Convert to vector
    let sumWx = Math.sin(dir) * spd;
    let sumWy = -Math.cos(dir) * spd;

    // Puff contributions accumulate SEPARATELY from the mean, so the total they add
    // can be clamped to one cell's worth below — same principle as the fan clamp.
    let puffWx = 0, puffWy = 0, puffMax = 0;
    // Net turn from every puff overlapping this point — see PUFF_FAN.
    let fanAcc = 0;
    for (const g of state.gusts) {
        const dx = x - g.x;
        const dy = y - g.y;
        const cos = Math.cos(-g.rotation);
        const sin = Math.sin(-g.rotation);
        // Local frame: +rx is DOWNWIND of the cell centre — the edge that reaches a boat
        // ahead of the puff first, so it is the leading edge. Compressed at the nose and
        // stretched behind, which is the half-moon a puff makes when it lands.
        const rx0 = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        const rx = rx0 >= 0 ? rx0 / PUFF_NOSE : rx0 / PUFF_TAIL;

        const distSq = (rx*rx)/(g.radiusX*g.radiusX) + (ry*ry)/(g.radiusY*g.radiusY);
        if (distSq <= 1) {
            // SMOOTHSTEP, like every other soft edge in this game — the wind regions, the
            // current regions, the shadows. The linear ramp here was the last one that was
            // not, and it met clear air with a crease: constant gradient right up to the rim
            // and then nothing. Smoothstep is flat at both ends and steepest in the middle,
            // which is how a puff actually arrives — you see it, then it comes on.
            const t = 1 - Math.sqrt(distSq);
            const falloff = t * t * (3 - 2 * t);
            const lifeFade = Math.min(g.age / 5, 1) * Math.min((g.duration - g.age) / 5, 1);
            const intensity = Math.max(0, falloff * lifeFade);

            if (intensity > 0) {
                 const gSpeed = g.speedDelta * intensity;
                 // The FAN: outward from the cell's axis, so the wind veers on one flank and
                 // backs on the other. `ry / radiusY` is -1..1 across the cell (the ellipse
                 // test already bounds it), zero on the axis. Weighted by `intensity`, so it
                 // fades with the cell's edge AND with its life — a dying puff leaves no
                 // shear behind it. Accumulated and applied to the RESULTANT below.
                 fanAcc += PUFF_FAN * (ry / g.radiusY) * (g.speedDelta >= 0 ? 1 : -1) * intensity;
                 // Local direction inside the puff, relative to the wind HERE — which is
                 // the region-blended direction, so a gust crossing a bend bends with it.
                 const gwDir = dir + g.dirDelta;

                 // Add puff vector
                 // Note: gSpeed can be negative (lull)
                 puffWx += Math.sin(gwDir) * gSpeed;
                 puffWy += -Math.cos(gwDir) * gSpeed;
                 if (Math.abs(gSpeed) > puffMax) puffMax = Math.abs(gSpeed);
            }
        }
    }

    // CLAMPED to one puff's worth, exactly like the fan below: overlapping cells must
    // not be able to add more wind than the strongest single one of them could — a gust
    // is descended upper air, and two patches of the same descended air overlapping is
    // still that air, not twice it. Unclamped, ocean's 25 kilometre-long cells stacked
    // three deep on a 27-knot mean and the anemometer read past 60; the same sum let
    // two stacked lulls drive the resultant NEGATIVE and flip the local wind. Mixed
    // gust-over-lull still cancels naturally — the clamp only bites when same-sign
    // cells pile up.
    const puffMag = Math.hypot(puffWx, puffWy);
    if (puffMag > puffMax && puffMag > 0) {
        const k = puffMax / puffMag;
        puffWx *= k; puffWy *= k;
    }
    sumWx += puffWx;
    sumWy += puffWy;

    // ── SQUALLS ── applied to the RESULTANT: front boost, core boost, trailing wake,
    // and the veer-plus-fan turn — see the squall block above for the design.
    if (state.squalls && state.squalls.length) {
        for (const q of state.squalls) {
            const qdx = x - q.x, qdy = y - q.y;
            const ux = -Math.sin(q.course), uy = Math.cos(q.course);
            const along = qdx * ux + qdy * uy;           // + is ahead: the leading side
            const across = qdx * uy - qdy * ux;
            let mul = 1, veerT = 0;
            const d2 = (along * along) / (q.ry * q.ry) + (across * across) / (q.rx * q.rx);
            if (d2 < 1) {
                const t = 1 - Math.sqrt(d2), sMain = t * t * (3 - 2 * t);
                const lead = along > 0 ? Math.min(1, along / q.ry) : 0;
                mul += (SQUALL_CORE + (SQUALL_FRONT - SQUALL_CORE) * lead) * sMain;
                veerT = sMain;
            }
            // The wake: dead air in an ellipse trailing the cell.
            const wAlong = along + q.ry * 1.6;
            const wd2 = (wAlong * wAlong) / (q.ry * q.ry * 1.69) + (across * across) / (q.rx * q.rx * 0.81);
            if (wd2 < 1) {
                const t = 1 - Math.sqrt(wd2), sWake = t * t * (3 - 2 * t);
                mul *= 1 - (1 - SQUALL_WAKE) * sWake;
            }
            if (mul !== 1 || veerT > 0) {
                let mag = Math.hypot(sumWx, sumWy);
                let dirNow = Math.atan2(sumWx, -sumWy);
                if (veerT > 0) {
                    let dAng = q.course + (across / q.rx) * SQUALL_FAN - dirNow;
                    dAng = ((dAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                    dirNow += Math.max(-SQUALL_VEER, Math.min(SQUALL_VEER, dAng)) * veerT;
                }
                mag *= mul;
                sumWx = Math.sin(dirNow) * mag;
                sumWy = -Math.cos(dirNow) * mag;
            }
        }
    }

    // The local mean, which gates whether a wake reached here — the lee's AIM still comes
    // from each obstacle's own wind.
    const shadowFactor = shadowAt(x, y, dir, 'wind');

    const finalSpeed = Math.sqrt(sumWx*sumWx + sumWy*sumWy) * shadowFactor;
    // CLAMPED to one puff's worth. Cells overlap, and three flanks agreeing must not be able
    // to spin the wind further than the strongest single one of them could — a shift that
    // grows with how many cells happen to be stacked is a number nobody can read.
    const fan = Math.max(-PUFF_FAN, Math.min(PUFF_FAN, fanAcc));
    const finalDir = Math.atan2(sumWx, -sumWy) + fan;

    return { speed: finalSpeed, direction: finalDir };
}

function updateTurbulence(boat, dt) {
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

// ⚠️ THE PLUME REACHES 450 UNITS DOWNWIND OF ITS BOAT, which is the whole cull radius —
// there is no per-particle test below, because the particles of one plume are never more
// than that from the hull they left.
const DIRTYAIR_REACH = 450;

function drawDisturbedAir(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

    // ⚠️ CULLED, which it was not. This is the most expensive call in the frame — measured at
    // ~1,550 canvas operations, an arc and a fill per particle, ~44% of everything a frame
    // issues (eval/_frame_attrib.js) — and it was paying that for all ten boats however far
    // off screen they were. On a 13 km course most of the fleet is not in view most of the
    // time. Nothing about the output changes: a plume that cannot reach the viewport cannot
    // put a pixel in it.
    const camX = state.camera.x, camY = state.camera.y;
    const cullR2 = (Math.hypot(ctx.canvas.width, ctx.canvas.height) * 0.5 + DIRTYAIR_REACH + 40) ** 2;

    for (const boat of state.boats) {
        if (!boat.turbulence) continue;
        // A fading boat's plume fades with it rather than switching off at the line.
        const fade = boat.opacity === undefined ? 1 : boat.opacity;
        if (fade <= 0.01) continue;
        const bdx = boat.x - camX, bdy = boat.y - camY;
        if (bdx * bdx + bdy * bdy > cullR2) continue;

        // THE WIND THIS BOAT IS IN, not the venue mean. The bad-air cone that actually slows
        // the boat behind you is already built from `localWind.direction` in updateBoatPhysics
        // — this drew the matching plume from `state.wind.direction`, so on a venue whose
        // regions bend the breeze the two pointed different ways and the visible dirty air
        // streamed off sideways while the real one went downwind. Same wind, same picture.
        //
        // Sampled once per boat, not per particle: getWindAt walks every region and gust, and
        // ten boats is ten calls a frame where per-particle would be several hundred. The
        // plume is therefore straight — it does not bend along a gradient over its own 450
        // units — but it leaves the boat down the wind that is actually blowing there.
        const localW = getWindAt(boat.x, boat.y);
        const windDir = localW.direction;
        // No wind, no wind shadow: the plume fades out below ~3 kn and is gone in a calm.
        const calm = Math.min(1, localW.speed / 3) * fade;
        if (calm <= 0.02) continue;
        const wx = -Math.sin(windDir);
        const wy = Math.cos(windDir);
        // Right Vector
        const rx = -wy;
        const ry = wx;

        for (const p of boat.turbulence) {
             const coneWidth = 20 + (p.d / 450) * 80;
             // Zigzag effect: Increased frequency (0.05 -> 0.08) and amplitude (5 -> 12)
             const zig = Math.sin(p.d * 0.08 + state.time * 8 + p.phase) * 12;
             const crossOffset = p.crossRatio * coneWidth + zig;

             const px = boat.x + wx * p.d + rx * crossOffset;
             const py = boat.y + wy * p.d + ry * crossOffset;

             // Slightly larger size
             const size = 2.0 + (p.d/450)*2.0;
             // More opaque: 0.4 -> 0.6 max alpha
             const alpha = Math.max(0, Math.min(1, (1.0 - p.d/450) * 0.6)) * calm;

             ctx.globalAlpha = alpha;
             ctx.beginPath();
             ctx.arc(px, py, size, 0, Math.PI * 2);
             ctx.fill();
        }
    }
    ctx.restore();
}


// ── MUSIC ───────────────────────────────────────────────────────────────────
// Music STREAMS from <audio> elements; it is never decoded into an AudioBuffer.
// `spinnaker-run` is 4:31 of 48 kHz stereo, which decodes to ~104 MB of float32,
// and the old buffer cache never evicted — ten per-venue race tracks would have
// cost roughly a gigabyte of RAM. A media element costs a socket.
//
// `loopEnd` is where the music actually STOPS, and it is the reason a loop no
// longer has a hole in it. Every track ends with a fade (yacht-club runs 6.9 s
// down to digital silence, spinnaker-run 7.1 s); the old player set
// `source.loop = true` over the whole file, so every lap through played the fade
// and then hard-cut back to a cold intro. We turn the loop around before the
// fade starts instead.
//   ⚠️ These values are measured from the RMS envelope — the last half-second
//   above -12 dB of peak — NOT from bar lines, so a seam can land mid-bar. The
//   0.6 s crossfade blurs it rather than clicking. Replace them with bar-accurate
//   values when the tracks are recut, which is the real fix.
//
// `trim` normalises playback level. Measured mean loudness across the set ran
// -16.2 dB (harbor-results) to -20.2 dB (yacht-club); these bring everything to
// about -17 dB so a cue change is not also a volume change.
//
// `harbor-glow.mp3` and `breezy-race.mp3` ship but are deliberately unassigned —
// there is no cue for either. Both are kept: unassigning is how a track is retired.
// Every row here is produced by `python3 regatta/art/music_loop.py <file>` — run it on
// a new track and paste what it prints. Do not hand-edit loopEnd or trim.
// `loopStart` matters as much as loopEnd and is NOT its mirror. A track can begin at
// full LEVEL and still be far too sparse to loop back into — Suno likes to open a bed
// with a bare pulse and fill the texture in, which measures fine and sounds like
// nothing. `loopStart..loopEnd` IS the track: playback ENTERS at loopStart and returns
// there, so anything before it is unused material. music_loop.py measures it by DENSITY
// (the local floor), not by level, because level cannot see sparseness at all.
// ── THE WIND-STREAK LAYER ───────────────────────────────────────────────────
// Below this the water is glassy and carries no along-wind streaks at all — real
// water starts showing them somewhere in a moderate breeze, and drawing a streak in
// four knots claims pressure that is not there. It is also what makes a lull legible:
// a lull is BARE WATER, which survives on a dark palette in a way that "dimmer white"
// never did.
const STREAK_MIN_WIND = 5.5;      // knots
const WIND_LIFE = 4.5;            // seconds a streak persists
const WIND_FADE_IN = 0.55;        // seconds — exactly the tail window, so a streak reaches
                                  // full strength at the same moment it reaches full length
const WIND_FADE_OUT = 1.3;        // seconds
const WIND_TAIL_PTS = 5;          // history samples behind the live head
const WIND_TAIL_STEP = 0.11;      // seconds between samples -> a 0.44-0.55s window of track
const WIND_WATER_RECHECK = 0.12;  // seconds between "am I still over water" tests

// ── THE LAYER'S REFERENCE IS THE COURSE, NOT A CONSTANT ─────────────────────
// STREAK_MIN_WIND above is a fact about WATER. Held as an ABSOLUTE gate it is also a
// decision that a venue whose whole range sits under it gets no wind layer at all — and
// that is what it did. Measured over Gatorgrass (2.7-6.0 kt across the course, 3.7 mean):
// 5.3% of the water cleared the gate and the live streak count on screen was ZERO, on the
// one venue whose entire identity is reading a fickle breeze.
//
// THREE THINGS COMPOUNDED, which is why it was invisible rather than merely faint:
//   density  the gate rejected ~95% of spawn attempts outright
//   length   the tail is a fixed 0.55 s window, so at 3.7 kt it drew 4 world units of track
//   width    `abs` pinned at zero held every survivor at the wLight floor, ~1.8 units across
// A four-unit speck at half width that almost never spawns is not a faint layer, it is no
// layer — and each of the three was individually defensible, which is how it got here.
//
// So the FLOOR the layer measures from drops to the course's own light end when the course
// is lighter than the glassy threshold, and the tail WINDOW stretches so a slow parcel
// still draws a readable mark. Both are per-course, computed once beside the pressure
// scale — the same question that already lives there ("18 knots is a hole on Glacier Sound
// and a squall on Gatorgrass"). STREAK_MIN_WIND was the last global that never got the
// treatment; on every venue already above it, `Math.min` leaves all of this untouched.
//
// WHAT DOES NOT CHANGE is the encoding. Within a race the lightest water is still the bare
// end of the ramp, the windiest still marks up, and length still reports the LOCAL wind —
// a fast parcel still draws a longer streak than a slow one beside it. And `span` stays
// absolute, so a 4-knot Gatorgrass streak is still finer and shorter than a 16-knot
// Bluewater one. The layer stops being uniform-bare; it does not start lying about knots.
// ⚠️ 9 -> 12. This is the wind the fixed tail window was tuned around, and a course whose
// median sits below it gets the window stretched so a slow parcel still draws a readable
// mark. At 9 it barely engaged on Stillwater (median 7.5 -> a 1.2x stretch, leaving 6-knot
// streaks 31 units long — shorter than a boat). At 12 that course gets 1.6x. A course
// already at or above 12 knots gets `max(1, ...)` = exactly 1, so every fresh-breeze venue
// keeps the window it has.
const STREAK_REF_WIND = 12;       // knots the fixed tail window was tuned around
const STREAK_TAIL_MAX = 2.5;      // most the window may stretch, so a lull cannot draw a comb
// ⚠️ 0.6 -> 0.42. The floor is what `windiness` measures up from, and on a light course it
// was sitting so close to the median that the whole light HALF of the water came out near
// zero: Stillwater's 6-knot water scored 0.31 and drew 5 comets on screen. Six knots of
// breeze puts real cat's-paws on real water — that is a patch a sailor reads, not a hole.
//
// ⚠️ IT CANNOT AFFECT A WINDY VENUE. The floor is `min(STREAK_MIN_WIND, med * this)`, so on
// any course whose median is above ~13 knots the absolute 5.5 cap decides it and this value
// is never consulted. Bluewater, Glacier Sound and Redrock are untouched.
const STREAK_FLOOR_FRAC = 0.42;   // floor, as a fraction of the course's own median
let _streakRef = { floor: STREAK_MIN_WIND, span: 9, tailStep: WIND_TAIL_STEP, fadeIn: WIND_FADE_IN };
function computeStreakRef() {
    const P = state.wind.pressure;
    const med = (P && P.med > 0) ? P.med : (state.wind.baseSpeed || STREAK_REF_WIND);
    // FROM THE MEDIAN, NOT THE p10. Reading the floor off the course's light end collapses
    // on any venue that authors genuinely glassy water: Stillwater's 2-knot shore patches
    // put its p10 at 0.09, which drove the floor to 0.08 and marked up the very glass the
    // layer exists to leave bare. The median asks the right question — "is this COURSE
    // lighter than the threshold" — and leaves within-course lulls to the ramp.
    // Never ABOVE the glassy threshold, so every venue already windier keeps the physical
    // rule untouched.
    const floor = Math.min(STREAK_MIN_WIND, med * STREAK_FLOOR_FRAC);
    const stretch = Math.min(STREAK_TAIL_MAX, Math.max(1, STREAK_REF_WIND / Math.max(1, med)));
    // DENSITY SPANS THE COURSE, WIDTH SPANS KNOTS. Population is what makes a gradient
    // readable at all — you cannot see where the pressure is from nineteen marks — so the
    // course's own windy end has to reach the same density as any other course's windy end.
    // Measured against a fixed 9-knot span, Gatorgrass sat at 19 streaks against 30-85
    // elsewhere: not a light-air LOOK, just a thin sample of one. Spanning the course fixes
    // that without weakening the bare-lull encoding, because the ramp still starts at zero
    // at the course's own light end.
    // Width deliberately does NOT get this treatment (see `abs` in streakChannels): it
    // keeps measuring real knots, which is what keeps a 4-knot mark fine and a 20-knot one
    // broad instead of making every venue look like a fresh breeze.
    // CAPPED AT THE ABSOLUTE SPAN, never widened past it. Spanning the course outright
    // fixed Gatorgrass (19 -> 33 streaks) but compressed Glacier Sound, whose 27-knot range
    // then had to reach further for the same density: it fell 38 -> 20. `min` takes the
    // narrower of the two, so a course narrower than the absolute ramp gets to use all of
    // its own range and a wider one is left exactly as it was.
    const span = Math.max(2, Math.min(9, ((P && P.hi > floor) ? P.hi : med * 1.3) - floor));
    _streakRef = {
        floor, span,
        tailStep: WIND_TAIL_STEP * stretch,
        // The fade-in is documented as "exactly the tail window" so a newborn stub is never
        // seen at full strength; it has to stretch with it or that stops being true.
        fadeIn: WIND_FADE_IN * stretch
    };
}

// ── THE STREAM ──────────────────────────────────────────────────────────────
// A current streak is the SAME IDEA as a wind comet and is built from the same parts: the
// mark is the parcel's own track, so it bends where the stream bends and its length is the
// distance the water covered in a fixed window — which is to say, its speed, for free.
//
// What it was before: a straight 4 px line from the particle to `p + direction x 80`,
// sampled once, uniform width, hard butt ends, flat 0.4 alpha. On a river that reads badly
// for a specific reason — a straight segment cannot show a bend, so the one place the
// current is most worth reading (the outside of a turn, where the stream runs hardest) drew
// as a fan of chords across the corner rather than water going round it.
//
// The window is LONGER and the taper GENTLER than the wind's. Air is gusty and a comet
// should read as a dart; water is not, and a stream reads as a slick — so the streak holds
// its width down most of its length and thins at both ends rather than running to a point
// behind a fat head. Nothing here has a bright head at all: a highlight would make each one
// an object on the water instead of a lane in it.
const CUR_LIFE = 7.0;             // seconds a streamline persists
const CUR_FADE_IN = 0.9;          // seconds
const CUR_FADE_OUT = 1.8;         // seconds — long, so lanes dissolve rather than blink
const CUR_TAIL_PTS = 18;          // history samples behind the live head
const CUR_TAIL_STEP = 0.20;       // seconds between samples -> a ~3.6s window of track
const CUR_MAX_ALPHA = 0.19;       // never opaque: this is under the boats and the nav aids
// WIDTH IS SET BY THE STREAK'S OWN LENGTH, not by the speed. Both of the obvious choices
// fail at one end of the range: a fixed width gave a 30:1 splinter in the fast lane (a
// scratch on the lens, not water), and scaling width WITH speed made slow water a fat 4:1
// leaf, because length and width then shrink together and the shape stops being a line at
// all. Deriving it from the measured arc length holds the silhouette constant everywhere,
// so a lane always reads as a lane and speed is left to the three channels that carry it
// honestly: LENGTH (ground covered in a fixed window), DENSITY (spawn rate) and ALPHA.
const CUR_ASPECT = 13.0;          // length : full width
const CUR_HALFWIDTH_MIN = 1.1;    // world units — below this the halo has nothing to soften
const CUR_HALFWIDTH_MAX = 4.2;    // and above it, a lane starts competing with the boats
const CUR_REF_KT = 3.0;           // the speed at which a lane draws at full alpha
// Flattens the lens. sin() alone puts the whole mark on a taper and only its middle has any
// body; raising it to a fraction holds the width across the belly and pinches only near the
// two ends, which is the difference between a lane of water and a dart.
const CUR_PROFILE = 0.5;
// A soft edge, in two fills rather than a blur: a wide faint halo under a narrower core.
// shadowBlur on ~130 polygons a frame is not affordable, and a hard-edged translucent
// polygon is exactly what made these read as slivers of glass.
// A RIM, not a second streak. At 2.4x the halo more than doubled the apparent width and
// took the silhouette from 7:1 to about 2.5:1 — every lane came out a leaf. It only has to
// take the hard edge off.
const CUR_HALO_W = 1.35;          // halo width, x the core
const CUR_HALO_A = 0.55;          // halo alpha, x the core

// ── THE GUARDRAILS ──────────────────────────────────────────────────────────
// The streak layer reports the wind field; it is never the subject of the frame. These are
// the ceilings no pressure reading, jitter roll, gust or venue document can push past —
// see the note in streakChannels for why they are clamps rather than coefficients.
const STREAK_MAX_ALPHA = 0.55;      // never opaque: boats, marks and labels stay on top
const STREAK_MAX_HALFWIDTH = 2.3;   // world units, so ~4.6 px across the head at 1:1
// ⚠️ THE CEILING WAS THE BINDING CONSTRAINT, not the ramp. At 0.20 per attempt with two
// attempts a frame the layer tops out at ~24 spawns a second, which over a 4.5 s life is
// ~108 alive and — since the spawn box is 1.35x the screen on each axis and only about a
// third of it lands in view — barely 38 comets on screen AT MAXIMUM PRESSURE. Measured, the
// actual population was 5 on Stillwater and 16 on Redrock (eval/_puff_read.js): far under
// even that ceiling, on the two venues whose whole point is reading a patchy breeze.
//
// A player cannot read a gradient off five marks. Raised so the windy end can reach a
// readable population; the floor and the ramp below decide where it actually sits, and the
// lull still goes bare because `windiness` gates it, not this.
const STREAK_MAX_SPAWN = 0.50;      // per attempt, 2 attempts a frame — the density ceiling
const WIND_BEACH_FADE = 0.35;     // seconds to fade out on reaching land — and the
                                  // look-ahead, so the fade finishes AT the shore

// Pressure ramp, cool -> warm, after the LiveLine pressure overlay in
// guidelines/references/sailgp-halifax-pressure.jpg (teal -> yellow -> orange). Anchored
// to the COURSE's own p10/p90 (see computeWindPressureScale), not to absolute knots:
// what a player needs off this layer is "the pressure is over there", and 18 knots is a
// hole on one venue and a squall on another. Absolute wind is carried by the other two
// channels — how many streaks there are, and how long each one is.
//
// Deliberately NOT drawn from `palette.gusts`. Those tints are the venue's own WATER
// showing through a cat's-paw (race-view.md §8); this is the course talking to the
// player, and it stays one language across all ten venues so warm always means pressure.
// ── COLOUR IS ABSOLUTE: KNOTS, NOT THE COURSE'S OWN RAMP ────────────────────
// This reverses the anchoring rule in race-view.md 8.1, deliberately.
//
// The old ramp read off `pressureAt()`, i.e. p10-p90 of THIS course. That makes the hot
// end always reachable and always used, which is good for showing where the pressure is —
// but it means the same colour is 5 knots on Gatorgrass and 30 on Glacier Sound. A player
// cannot learn "that shade means it is windy over there" if the shade is re-scaled every
// time they change venue; they can only learn it within one race, and then it is wrong on
// the next. Reading the wind is the primary skill this game asks for, so the reading has
// to be transferable.
//
// The original argument for anchoring to the course was that nine of the ten venues state
// ONE uniform wind region, so an absolute ramp would paint them a single flat colour with
// no gradient to read. That is much less true now — Gatorgrass alone carries 27 regions —
// and even where it holds, gusts, lulls and island lees all move the LOCAL speed, so an
// absolute ramp still marks them. It marks them better, in fact, because it is not already
// pinned at the top of a narrow course ramp.
//
// DENSITY AND WIDTH STAY ON THE COURSE RAMP. That is the division of labour: colour says
// how much wind there is, density and width say which side of THIS course is the windy
// one. They cannot contradict each other — within a race both rise together — and it keeps
// the "windy side" reading alive on a venue whose absolute range is too narrow to shift
// hue much. race-view.md 8.1 says all four channels read off `pressureAt` so they cannot
// disagree; that invariant is now "three do, and colour answers a different question".
// WHITE -> GREEN -> YELLOW -> AMBER -> CRIMSON, in knots. Two things shaped the stops
// beyond the basic progression:
//
//   ORANGE IS THE FLEET. A saturated orange streak and a boat's topsides were once the
//   same swatch, and every inflatable mark is that colour too. The hot end of an absolute
//   scale lands only on the windiest venues — which is exactly where the fleet is packed
//   and where a boat most needs to be findable — so the ramp passes THROUGH amber to a
//   dark crimson rather than sitting on orange. Crimson still reads as the danger end and
//   separates from the hulls by being darker and pinker.
//
//   GREEN IS THE WATER on two of the venues that need this layer most: Gatorgrass paints
//   #606c38 olive and the river banks are grass. So the band Gatorgrass actually occupies
//   (it tops out around 7 kt) is white through pale MINT, not grass green, and the green
//   proper does not arrive until 12-16 kt where the water underneath is blue.
//
// STOPS ARE CLOSE TOGETHER ON PURPOSE. These are interpolated in RGB, which cuts the
// chord between two colours rather than following hue — so a wide jump between distant
// hues passes through grey. A first pass went teal at 14 straight to gold at 20 and drew
// a dead olive at 17. Neighbouring stops here are always adjacent in hue, so the chord
// stays on the ramp.
const STREAK_KT_MAX = 35;         // top of the scale; above this the colour holds
const STREAK_PALETTES = {
    wind: [
        [0,  [255, 255, 255]],    // glass: a cat's-paw is white water
        [5,  [214, 244, 232]],    // pale mint — clears Gatorgrass olive
        [10, [150, 226, 176]],    // mint green
        [15, [186, 226, 110]],    // yellow-green
        [20, [246, 224, 104]],    // gold
        [26, [246, 182,  92]],    // amber, stopping short of the marks' orange
        [32, [226,  96,  86]],    // warm red
        [35, [198,  52,  78]]     // crimson
    ],
    // Kept for A/B only: the literal white->green->yellow->orange->red proposal, which
    // sits on the fleet's orange at 26 and on olive water at 7-14. `window.__streakPalette`
    // switches at runtime so the two can be compared inside one race.
    heat: [
        [0,  [255, 255, 255]],
        [7,  [176, 232, 150]],
        [14, [122, 214,  92]],
        [20, [246, 232, 110]],
        [26, [250, 176,  72]],
        [35, [232,  72,  58]]
    ]
};
const STREAK_PALETTE = 'wind';
function buildStreakLut(name) {
    const stops = STREAK_PALETTES[name] || STREAK_PALETTES.heat;
    const N = 96, lut = [];
    for (let i = 0; i < N; i++) {
        const kt = ((i + 0.5) / N) * STREAK_KT_MAX;
        let a = stops[0], b = stops[stops.length - 1];
        for (let s = 0; s < stops.length - 1; s++) if (kt >= stops[s][0] && kt <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
        const f = b[0] === a[0] ? 0 : (kt - a[0]) / (b[0] - a[0]);
        lut.push([0, 1, 2].map(k => Math.round(a[1][k] + (b[1][k] - a[1][k]) * f)));
    }
    return lut;
}
let STREAK_LUT = buildStreakLut(STREAK_PALETTE);
// Switchable from the console for side-by-side comparison, like __COMET and __NAV.
if (typeof window !== 'undefined') window.__streakPalette = (n) => { STREAK_LUT = buildStreakLut(n); };
function streakColorFor(spd) {
    const u = Math.max(0, Math.min(0.999, (spd || 0) / STREAK_KT_MAX));
    return STREAK_LUT[(u * STREAK_LUT.length) | 0];
}

// The three per-streak channels, in ONE place. The diagnostics read pressure off the same
// function the renderer draws with, so a probe can never quietly measure a formula the
// screen stopped using — which is exactly how the first pass reported half-width 1.4 on a
// layer that was drawing 2.0. Writes into a scratch object: this runs per streak per frame.
// Tunables, overridable from the console / a diagnostic as `window.__COMET`, the same way
// __START and __NAV work. Comparing two ramps by editing the file and reloading compares
// two different races as well as two different ramps.
const COMET = {
    // Thin and solid rather than broad and soft: a broad streak has to be faint to stay
    // under the fleet, and a faint broad streak is the shimmery, distracting thing.
    a0: 0.36, a1: 0.40, aPow: 1.2,   // alpha at the cold end, added at the hot end, its curve
    // ⚠️ HALVED Aug 2 2026 (was 1.8 / 2.1). The layer reads as pressure either way; at the
    // old width the streaks were competing with the boats for the eye rather than sitting
    // under them. STREAK_MAX_HALFWIDTH came down with them so the ceiling still bites.
    w0: 0.9,  w1: 1.05,              // half-width, same
    // ⚠️ 0.40 -> 0.62, and the reason the 0.40 was wrong is that the premise behind it was
    // not true yet. It was set on the argument that density and length no longer collapse
    // with width — but measured per wind band (eval/_comet_lowend.js), on Stillwater, where
    // 72% of the water sits under 8 knots, all THREE still did: 31-43 units long, 0.39-0.56
    // half-width, 5-14 comets on screen, against 100u / 1.2 / 36 in the 15-20 band. Three
    // collapsing channels is the compounding failure computeStreakRef was written to stop,
    // one rung further down the ramp than it was tuned for.
    //
    // ⚠️ THE TOP IS UNTOUCHED BY CONSTRUCTION, which is why this is the safe lever: the
    // multiplier is `wLight + (1 - wLight) * abs`, and `abs` reaches 1 in a fresh breeze, so
    // the value here cancels out entirely there. It moves the light end and nothing else.
    wLight: 0.62,                    // width multiplier in the lightest air the layer draws
    taper: 0.45,                     // body profile: 1 = straight cone, lower = holds width
    // ⚠️ DENSITY IS THE PRESSURE CUE, and it was too thin to be one. `dens1` carries the
    // spread and it was set when the ceiling above clipped everything anyway. The floor
    // stays low on purpose: it is what keeps a lull sparse rather than merely dimmer, which
    // is both what a sailor sees and the only encoding that survives on a dark palette.
    dens0: 0.05, dens1: 0.55         // spawn chance floor and pressure-weighted span
};
const cometCfg = () => (typeof window !== 'undefined' && window.__COMET) ? Object.assign({}, COMET, window.__COMET) : COMET;

const _streakCh = { alpha: 0, halfWidth: 0, color: null };
function streakChannels(t, jit, spd) {
    // The cold end has to be a MARK on the water, not a hairline. Light air is already
    // carried by there being fewer streaks and each one being shorter; if the survivors are
    // invisible too then a lull and a broken renderer look identical, which is the failure
    // the old layer had.
    const c = cometCfg();
    // ±20% of per-streak scatter on top. Nine of the ten venues state ONE uniform wind
    // region, so on those courses every streak carries an identical reading and the layer
    // tiles into wallpaper without it (race-view.md §8: vary spacing and length). Width and
    // alpha share `jit` deliberately — a heavier streak being both wider and brighter is
    // coherent, where independent rolls just look noisy.
    // WIDTH ANSWERS TO ABSOLUTE WIND AS WELL AS TO PRESSURE. `t` is relative to the
    // course, so on its own it made a 6.5-knot Gatorgrass streak exactly as fat as a
    // 16-knot Bluewater one — but length is absolute, so the light-air streak came out
    // half as long at the same width and read stubby. Scaling width with the breeze too
    // keeps a comet's SHAPE constant and lets its SIZE report the wind: fine, delicate
    // marks in light air, broad ones in a fresh breeze, which is how the water looks.
    const abs = Math.max(0, Math.min(1, (spd - _streakRef.floor) / 9));
    // ── THE CEILING IS A CLAMP, NOT A TUNING VALUE ──────────────────────────────
    // This layer is INFORMATION. It has to stay under the boats, the marks and the labels
    // (race-view.md §2, §8) no matter what a venue authors, and the arithmetic could reach
    // alpha 1.008 — a fully opaque streak — at the top of the ramp with a high jitter roll.
    // That top is not a rare corner either: `pressureAt` clamps at the course's p90, and a
    // gust pushes local wind straight past it, so every channel pins to maximum exactly
    // where the fleet is looking and exactly where the player most needs to see the boats.
    //
    // Clamped here rather than by choosing gentler coefficients, because a coefficient is a
    // number someone will later raise for a venue that "needs more" — and the failure it
    // produces is a wall of ink over a mark rounding. A clamp cannot be tuned past by
    // accident, and STREAK_MAX_* are the numbers to argue about if it ever must move.
    const rawAlpha = (c.a0 + c.a1 * Math.pow(t, c.aPow)) * (0.80 + jit * 0.40);
    const rawWidth = (c.w0 + c.w1 * t) * (c.wLight + (1 - c.wLight) * abs) * (0.80 + jit * 0.40);
    _streakCh.alpha = Math.min(STREAK_MAX_ALPHA, rawAlpha);
    _streakCh.halfWidth = Math.min(STREAK_MAX_HALFWIDTH, rawWidth);
    _streakCh.color = streakColorFor(spd);
    return _streakCh;
}

// ── THE DRAWN SPINE: a tail that ends at a fixed AGE, not at a stored sample ─────────
//
// The track is sampled on a clock, so the oldest sample used to be dropped whole every
// WIND_TAIL_STEP and the tail tip jumped back a full segment each time — a visible twitch
// on every streak on screen, ten times a second. Keeping one spare sample past the window
// and interpolating the end point between the last two makes the tip SLIDE: the streak
// ends at exactly `WIND_TAIL_PTS * WIND_TAIL_STEP` seconds of age, always, and nothing on
// screen moves when a sample is retired.
//
// `u` is age/window rather than index/count, so the taper slides with it instead of
// re-spacing itself whenever the sample count changes. While the history is still filling,
// the window is whatever track exists — so a newborn streak grows smoothly out of its head.
// Scratch array, reused per streak: this runs for every streak, every frame.
// PARAMETERISED over the window, because the current draws its streamlines the same way and
// the sliding-window interpolation below is the fiddly part — a second copy of it is a
// second thing to get subtly wrong. The wind passes its constants, the stream passes its
// own; nothing else differs.
const _spine = [];
for (let i = 0; i < Math.max(WIND_TAIL_PTS, CUR_TAIL_PTS) + 2; i++) _spine.push({ x: 0, y: 0, u: 0 });
function streakSpine(p, step, pts) {
    if (step === undefined) { step = _streakRef.tailStep; pts = WIND_TAIL_PTS; }
    const trail = p.trail, len = trail.length, frac = p.trailT;
    if (len < 2) return 0;
    const full = len > pts;
    const span = full ? pts * step : frac + (len - 1) * step;
    if (span <= 1e-6) return 0;
    let n = 0;
    let s = _spine[n++]; s.x = p.x; s.y = p.y; s.u = 0;
    const last = full ? pts - 1 : len - 1;
    for (let j = 0; j <= last; j++) {
        s = _spine[n++];
        s.x = trail[j].x; s.y = trail[j].y; s.u = (frac + j * step) / span;
    }
    if (full) {
        // f runs 1 -> 0 across each step, and at f = 1 it lands exactly on the sample that
        // was just retired — so the handover from "stored point" to "interpolated point"
        // is continuous in both position and width.
        const f = (step - frac) / step;
        const a = trail[pts - 1], b = trail[pts];
        s = _spine[n++];
        s.x = a.x + (b.x - a.x) * f; s.y = a.y + (b.y - a.y) * f; s.u = 1;
    }
    return n;
}

function drawParticles(ctx, layer) {
    // Viewport cull: with 10 boats laying wakes across the whole course,
    // hundreds of particles are off-screen at any moment — skip them before
    // touching the canvas. (Also skips the per-particle getWindAt/getCurrentAt
    // lookups for the culled ones.)
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 120;
    const viewR2 = viewR * viewR;
    const onScreen = (p) => {
        const dx = p.x - camX, dy = p.y - camY;
        return dx * dx + dy * dy < viewR2;
    };

    if (layer === 'current') {
        // The darkest version of this venue's own water — see currentTintFrom. One fill per
        // streak, no stroke: the outline IS the shape, so width can vary along it.
        const col = activeCurrentColor;
        for (const p of state.particles) {
            if (p.type !== 'current') continue;
            if (!onScreen(p)) continue;

            // Fade in over the window the tail takes to form, so a newborn stub is never
            // seen at full strength, and out slowly, so a lane dissolves rather than blinks.
            const age = (1 - p.life) * CUR_LIFE, left = p.life * CUR_LIFE;
            const env = Math.min(1, age / CUR_FADE_IN, left / CUR_FADE_OUT);
            if (env <= 0.02) continue;

            // Speed drives weight as well as length: a 4 kt lane should look like one next
            // to half a knot of drift, not merely be a longer mark of the same value.
            const f = Math.min(1, (p.spd || 0) / CUR_REF_KT);
            if (f <= 0.02) continue;
            const alpha = env * CUR_MAX_ALPHA * (0.35 + 0.65 * f) * (p.jit || 1);

            const n = streakSpine(p, CUR_TAIL_STEP, CUR_TAIL_PTS);
            if (n < 2) continue;

            // The track's own arc length, which is what the silhouette is scaled against.
            let arc = 0;
            for (let k = 1; k < n; k++) {
                arc += Math.hypot(_spine[k].x - _spine[k - 1].x, _spine[k].y - _spine[k - 1].y);
            }
            if (arc < 6) continue;      // barely moving: no lane to draw
            const wH = Math.max(CUR_HALFWIDTH_MIN,
                       Math.min(CUR_HALFWIDTH_MAX, arc / (2 * CUR_ASPECT))) * (p.jit || 1);

            // Down one flank of the track and back up the other, as the comets do — but on
            // a LENS profile rather than a taper from the head. Width peaks a third of the
            // way back and thins to nothing at both ends, which is what a slick looks like
            // and, unlike a pointed head, gives the mark no front — a current has no
            // leading edge to find, it is the whole lane that is moving.
            //
            // Twice: a wide faint halo, then the core over it. Two translucent fills of the
            // same shape are a soft edge for the price of one extra path, and the softness
            // is the whole difference between water and glass.
            for (let pass = 0; pass < 2; pass++) {
                const pw = pass === 0 ? wH * CUR_HALO_W : wH;
                const pa = pass === 0 ? alpha * CUR_HALO_A : alpha;
                ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${pa.toFixed(3)})`;
                ctx.beginPath();
                for (let side = 0; side < 2; side++) {
                    for (let k = 0; k < n; k++) {
                        const i = side === 0 ? k : n - 1 - k;
                        const a = _spine[i];
                        const b = _spine[Math.max(0, i - 1)], c2 = _spine[Math.min(n - 1, i + 1)];
                        let tx = c2.x - b.x, ty = c2.y - b.y;
                        const tl = Math.hypot(tx, ty) || 1;
                        tx /= tl; ty /= tl;
                        // u is age across the window: 0 at the head, 1 at the tail. sin gives
                        // the lens in one term, biasing u pushes the belly back off the head,
                        // and the exponent flattens it into a band.
                        const u = a.u;
                        const bias = u < 0.33 ? (u / 0.33) * 0.5 : 0.5 + ((u - 0.33) / 0.67) * 0.5;
                        const w = pw * Math.pow(Math.sin(Math.PI * bias), CUR_PROFILE) * (side === 0 ? 1 : -1);
                        const px2 = a.x - ty * w, py2 = a.y + tx * w;
                        if (side === 0 && k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
                    }
                }
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;
    } else if (layer === 'surface') {
        // WHITE FOAM BY DAY, BIOLUMINESCENCE BY NIGHT. The wash off a mark or a buoy is
        // disturbed water like any other, so on a venue that authors `palette.night` it
        // fires cells rather than showing white — the same electric blue as the hulls'
        // trails, since it is the same phenomenon at a smaller scale.
        const nite = nightAmt();
        ctx.fillStyle = nite > 0 ? BIO_COLOR : '#ffffff';
        for (const p of state.particles) {
            if (p.type === 'wake' || p.type === 'wake-wave' || p.type === 'mark-wake') {
                if (!onScreen(p)) continue;
                const bf = p.boat && p.boat.opacity !== undefined ? p.boat.opacity : 1;   // foam follows its boat's fade
                if (bf <= 0.01) continue;
                ctx.globalAlpha = p.alpha * bf;
                const s = p.scaleVal || p.scale || 1.0;
                ctx.beginPath(); ctx.arc(p.x, p.y, 3 * s, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;
    } else if (layer === 'air') {
        // ── WIND COMETS ────────────────────────────────────────────────────────
        //
        // A bright head with a tapering tail laid along the parcel's OWN TRACK. The
        // asymmetry gives direction; four channels give pressure, and every one of them
        // reads off `pressureAt`, so they cannot disagree with each other or with the
        // field the boats are sailing in:
        //
        //   DENSITY  how many streaks exist here — decided at spawn, the strongest cue
        //   LENGTH   distance covered in a fixed window of time, i.e. wind speed exactly
        //   WIDTH    the course's pressure ramp
        //   COLOUR   the same ramp, cool -> warm, after LiveLine's pressure overlay
        //
        // Direction and length are now facts rather than formulas: the comet is where the
        // air has been. The previous version drew a straight streak from a single sample
        // and a `34 + speed * 4.5` length — a 34-unit stub in dead calm, and a fixed
        // pedestal that squeezed 6-28 knots into a 1.6x length range.
        const windR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 320;
        const windR2 = windR * windR;
        for (const p of state.particles) {
            if (p.type !== 'wind') continue;
            const dxv = p.x - camX, dyv = p.y - camY;
            if (dxv * dxv + dyv * dyv > windR2) continue;
            const trail = p.trail;
            if (!trail || trail.length < 2) continue;

            const t = pressureAt(p.spd || 0);
            // Streaks arrive and leave. The fade-in also covers the half second the tail
            // takes to form, so a newborn stub is never seen. (The old envelope was
            // min(life, 1) on a life that STARTED above 1 — every streak snapped on at
            // full strength and only the death was animated.)
            const age = (1 - p.life) * WIND_LIFE, left = p.life * WIND_LIFE;
            const env = Math.min(1, age / _streakRef.fadeIn, left / WIND_FADE_OUT, p.beach);
            if (env <= 0.02) continue;

            const ch = streakChannels(t, p.jit || 0.5, p.spd || 0);
            const alpha = env * ch.alpha, wH = ch.halfWidth, col = ch.color;

            const n = streakSpine(p);
            if (n < 2) continue;

            // One filled outline: down the left flank of the track, back up the right.
            // Half-width tapers to nothing at the end of the age window.
            // (A dark keel under each streak was tried for bright-water contrast and
            // reverted — it read as a different, heavier layer. Legibility in the
            // canyons is carried by spawn density instead: see the resampling note
            // at the spawn site.)
            const taper = cometCfg().taper;
            ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(3)})`;
            ctx.beginPath();
            for (let side = 0; side < 2; side++) {
                for (let k = 0; k < n; k++) {
                    const i = side === 0 ? k : n - 1 - k;
                    const a = _spine[i];
                    // Tangent from the neighbours, so the outline follows the bend
                    const b = _spine[Math.max(0, i - 1)], c = _spine[Math.min(n - 1, i + 1)];
                    let tx = c.x - b.x, ty = c.y - b.y;
                    const tl = Math.hypot(tx, ty) || 1;
                    tx /= tl; ty /= tl;
                    // Holds its width through the front half and then runs out to a point.
                    // A steeper taper (0.75 was the first try) gives a ball on a needle —
                    // all the mass in the head cap and a hairline behind it.
                    const w = wH * Math.pow(1 - a.u, taper) * (side === 0 ? 1 : -1);
                    const px2 = a.x - ty * w, py2 = a.y + tx * w;
                    if (side === 0 && k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
                }
            }
            ctx.closePath();
            ctx.fill();

            // Rounded head, brighter but still TINTED — the eye goes to the brightest
            // point of a comet, and forcing that point to pure white (as it was) threw
            // away the colour exactly where the pressure read is being taken.
            ctx.fillStyle = `rgba(${Math.min(255, col[0] + 24)},${Math.min(255, col[1] + 20)},${Math.min(255, col[2] + 16)},${(alpha * 1.1).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, wH * 0.82, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

const PUFF_TONE_CORE = 0.022;   // core delta as a fraction of full scale — "just perceptible"
const PUFF_TONE_BANDS = [       // [intensity contour, share of the core delta]
    [0.12, 0.45],
    [0.55, 0.55]
];
const PUFF_TONE_TEAR = 0.07;    // ragged edge, as a fraction of the cell radius
const PUFF_TONE_NODES = 18;     // polygon nodes per contour
const PUFF_TONE_MAX_A = 0.30;   // alpha ceiling, for a venue whose tint sits near its water
const PUFF_TONE_SEP = 0.22;     // lightness the tint is pushed from the water, in HSL

// t such that smoothstep(t) = v. Closed form, exact at both ends — the contour radius for a
// given intensity is 1 - this, because intensity = smoothstep(1 - sqrt(distSq)).
const puffInvSmooth = (v) => 0.5 - Math.sin(Math.asin(1 - 2 * Math.max(0, Math.min(1, v))) / 3);

// ⚠️ CALIBRATED, NOT AUTHORED. The alpha that produces a given luma step depends on how far
// the tint is from the water it is drawn over, and that is a different distance on every
// venue. Solving for it here is what makes "just perceptible" a property of the code rather
// than of ten hand-tuned palettes — and it is why Redrock stopped being invisible and
// Stillwater stopped being a wash.
let _puffCal = null;
function puffToneCal() {
    const gc = activeGustColors;
    const wc = window.WATER_CONFIG || {};
    const key = JSON.stringify([gc.gustDark, gc.lullBright, wc.baseColor]);
    if (_puffCal && _puffCal.key === key) return _puffCal;
    const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const hex = String(wc.baseColor || '#0ea5e9').replace('#', '');
    const wRGB = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    const water = luma(wRGB);
    const [, , lW] = rgbToHsl(wRGB[0], wRGB[1], wRGB[2]);

    // ⚠️ THE DIRECTION IS FORCED, NOT INHERITED. Calibrating only the MAGNITUDE against the
    // authored tint left two venues broken, and both failures were silent:
    //   Glacier Sound  gust tint sat within a luma step of its own water, so no alpha could
    //                  move it — the layer measured 0.0% and the puffs were invisible.
    //   Pearl Lagoon   its authored `lullBright` is DARKER than its water, so holes came out
    //                  darker than clear air — the same direction as a gust, which is worse
    //                  than showing nothing because it says the opposite of the truth.
    // A cat's-paw is dark rough water and a hole is pale glassy water; that is physics, not a
    // palette choice. So the venue keeps its HUE and SATURATION — its colour identity — and
    // the LIGHTNESS is taken away from the water in the guaranteed direction.
    //
    // Floored and ceilinged rather than assumed: on water authored near black (Glowtide,
    // lightness 0.24) there is not a full step of darkness available, so the gust takes what
    // there is and `solve` raises the alpha to still land on the target luma step.
    const push = (rgb, dir) => {
        const [h, sat] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        const l = Math.max(0.04, Math.min(0.94, lW + dir * PUFF_TONE_SEP));
        return hslToRgb(h, sat, l);
    };
    const gustC = push(gc.gustDark, -1);
    const lullC = push(gc.lullBright, +1);
    // |Lt - Lw| is how much one unit of alpha moves the water. A tint left close to the water
    // needs a lot of alpha to shift it, and the ceiling stops that running away.
    const solve = (tint) => Math.min(PUFF_TONE_MAX_A, (PUFF_TONE_CORE * 255) / Math.max(6, Math.abs(luma(tint) - water)));
    _puffCal = { key, gust: solve(gustC), lull: solve(lullC), gustC, lullC, water };
    return _puffCal;
}

function drawGusts(ctx) {
    const cal = puffToneCal();
    const gc = activeGustColors;
    // Viewport cull: gusts live across the whole arena; most are off-screen.
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    const T = state.time;

    for (const g of state.gusts) {
        const rmax = Math.max(g.radiusX, g.radiusY) * 1.4;
        const dx = g.x - camX, dy = g.y - camY;
        if (dx * dx + dy * dy > (viewR + rmax) ** 2) continue;

        // Intensity based on strength (speedDelta)
        const strength = Math.min(1.0, Math.abs(g.speedDelta) / (state.wind.baseSpeed * 0.5));
        // Light-air emphasis: the same 2kt puff is a huge % change in light air but
        // barely visible in a fresh breeze, so cat's-paws read strongest when it's
        // light and wash out as it builds (real water cue; matches eSail/AC sailing).
        const airCue = 1.0 + Math.max(0, (14 - state.wind.baseSpeed) / 14) * 0.9; // ~1.0 heavy -> ~1.9 light
        const isGust = g.type === 'gust';
        const base = (isGust ? cal.gust : cal.lull) * strength * airCue;
        if (base <= 0.002) continue;
        const tint = isGust ? cal.gustC : cal.lullC;
        // The cell's own ragged-edge seed, taken from fields it already carries. ⚠️ NOT a
        // fresh Math.random(): the spawner draws from the SIMULATION stream, so one more
        // call there would move every seeded race.
        const seed = Math.abs(g.dirDelta * 941 + g.moveSpeedFactor * 7717);

        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.rotation);
        ctx.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
        for (const [level, share] of PUFF_TONE_BANDS) {
            ctx.globalAlpha = Math.min(1, base * share);
            // The contour of constant intensity, mapped back through the nose/tail skew so
            // the drawn edge is exactly where the FELT edge is — a puff you can see but not
            // feel where you see it is worse than no puff at all.
            const R = 1 - puffInvSmooth(level);
            ctx.beginPath();
            for (let i = 0; i <= PUFF_TONE_NODES; i++) {
                const a = (i / PUFF_TONE_NODES) * Math.PI * 2;
                // Torn, and slowly churning: capillary ripple has a ragged boundary that
                // works, and a perfectly smooth ellipse is the shape nothing on water has.
                const tear = 1 + PUFF_TONE_TEAR * (Math.sin(a * 3 + seed + T * 1.7)
                                                 + 0.6 * Math.sin(a * 7 - seed * 1.7 + T * 2.3));
                const rr = R * tear;
                const rx = Math.cos(a) * rr * g.radiusX;
                const ry = Math.sin(a) * rr * g.radiusY;
                const px = rx >= 0 ? rx * PUFF_NOSE : rx * PUFF_TAIL;
                if (i === 0) ctx.moveTo(px, ry); else ctx.lineTo(px, ry);
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

// ── SURF: the sea breaking on the shore it is running at ────────────────────
//
// Only the coast facing INTO the waves. race-view.md §9 is explicit that a shoreline must
// never be outlined with an identical white ribbon — a halo all the way round says nothing
// about the sea, and the whole point of surf is that it tells you which way the weather is
// coming from before you look at anything else. The lee shore stays glassy.
//
// It cannot live in the island bake (§5: islands blit from a sprite, no per-frame
// procedural detail) because WHICH shore is exposed depends on the wave direction, and on
// Glacier Sound that varies across the map and oscillates. So it is its own pass, drawn
// over the land the way the wakes and comets are.
//
// Strength reads the same field the comets do, so the two cannot disagree about the wind:
// a shore under the 28-knot katabatic corner breaks hard while the sheltered side is bare.
