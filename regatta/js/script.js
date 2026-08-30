const WORLD_CLOCK = 0.24;
// Raised by update() when the race ends for the player/fleet; consumed by loop(),
// which opens the results overlay OUTSIDE the sim tick. Hub-local on purpose:
// state.race is hashed by the trace harness, and headless drivers call update()
// without loop(), so this must live where only the render loop can see it.
let _resultsPending = false;

// HOW FAR THE CAMERA LOOKS PAST THE BOW, as a fraction of the frame's height. The boat ends
// up at `0.5 + this` down the screen, so 1/6 puts it two thirds of the way down and splits
// the frame two-to-one in favour of the water ahead. Read only in heading mode — see the
// note at the camera follow.
//
// ⚠️ IT IS A TRADE, NOT A FREE WIN, and that is why it is not larger. Everything the offset
// buys ahead of the bow it takes from ASTERN, where the boat on your transom is. At 1/4 that
// was a third of the rearward view gone; 1/6 keeps more of it while still giving the forward
// half of the frame most of the picture.
//
// ⚠️ THE BOAT MUST ALSO KEEP ROOM BELOW IT. drawBoatInstruments hangs its panel BI_DROP +
// BI_H under the hull and projects it through the real transform, so it follows the boat
// down. Past about 0.3 that panel starts running off the bottom edge.
const CAM_LOOK_AHEAD = 1 / 6;

function update(dt) {
    state.time += WORLD_CLOCK * dt;
    const timeScale = dt * 60;

    if (window.Rules) window.Rules.update(dt);

    updateBaseWind(dt);
    updateGusts(dt);
    updateSqualls(dt);
    // No dt: every vessel is evaluated straight from the race clock, so it cannot drift
    // with the frame rate the way an integrated position would.
    updateTraffic();
    // The swell's own clock. Advanced from dt like everything else, so it pauses with the
    // race and is identical for a given seed — a wave field is pure trigonometry and must
    // never reach for the RNG stream. No-op off the ocean.
    if (window.Swell) window.Swell.update(dt);

    // Current Visuals (uniform current, or the river's spatial field)
    if (venueCurrent() || (state.race.conditions.current && state.race.conditions.current.speed > 0.1)) {
        // Spawn at a random point near the camera; visibility scales with the
        // LOCAL current there, so the river's midstream reads faster than the banks.
        const range = Math.max(canvas.width, canvas.height) * 1.5;
        const px = state.camera.x + (fxRand() - 0.5) * range;
        const py = state.camera.y + (fxRand() - 0.5) * range;
        const local = getCurrentAt(px, py);
        if (local && local.speed > 0.15) {
            // Density is one of the three speed channels, so it leans on local speed harder
            // than it used to and runs denser overall — a lane has to be several streaks
            // wide before it reads as a lane rather than as scattered marks.
            const spawnChance = (0.10 + (local.speed / 3.0) * 0.9) * 0.75;
            if (fxRand() < spawnChance) {
                createParticle(px, py, 'current', {
                    trail: [{ x: px, y: py }], trailT: 0, spd: local.speed,
                    // Jitter so a lane is a band of streaks at slightly different weights
                    // rather than a comb of identical ones — the same trick the comets use.
                    jit: 0.7 + fxRand() * 0.6
                });
            }
        }

        // Mark Wakes
        // ── AND CHANNEL BUOYS MAKE THEM TOO ─────────────────────────────────
        // A moored buoy standing in a two-knot stream throws exactly the same wash as a
        // race mark does — it is the same situation, a fixed object in moving water — and
        // on a tidal venue that wash is a CUE: it shows which way the stream is setting and
        // roughly how hard, at a glance, from across the channel. Only marks got one, so
        // Glowtide's eighteen buoys sat in a 2.5 kt tide with dead-flat water round them.
        const wakeSource = (ox, oy, radius) => {
            const mc = getCurrentAt(ox, oy);
            if (!(mc && mc.speed > 0.15) || fxRand() >= 0.3 * (mc.speed / 3.0)) return;
            // Wake forms DOWNSTREAM of the obstacle.
            const wx = Math.sin(mc.direction) * radius;
            const wy = -Math.cos(mc.direction) * radius;
            createParticle(ox + wx + (fxRand() - 0.5) * 10, oy + wy + (fxRand() - 0.5) * 10,
                'mark-wake', { life: 1.5, alpha: 0.5 * (mc.speed / 3.0), scale: 0.8 });
        };
        if (state.course.marks) {
            for (const m of state.course.marks) wakeSource(m.x, m.y, 12);
        }
        if (state.course.props) {
            const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
            for (const pr of state.course.props) {
                if (pr.kind !== 'buoy-channel-red' && pr.kind !== 'buoy-channel-green') continue;
                const kw = (reg[pr.kind] && reg[pr.kind].world) || 28;
                wakeSource(pr.x, pr.y, kw * (pr.scale || 1) * 0.45);
            }
        }

    }

    // Rapids whitewater is NOT a particle system any more — see drawRapidsFoam. A
    // particle is a thing that travels, and anything that travels reads as an object;
    // broken water is a FIELD. The foam is drawn from the regions directly, statelessly.

    // Drifting ice floes — authored by the venue document (`c.ice`); a no-op
    // wherever none are.
    updateIceFloes(dt);

    // Sound (the player's APPARENT wind — see Sound.playerWindSpeed). Whether the bed
    // should be heard at all is Sound.windAudible's business, not the loop's.
    Sound.updateWindSound(Sound.playerWindSpeed());

    // Global Race Timer
    if (state.race.status === 'prestart') {
        state.race.timer -= dt;
        if (state.race.timer <= 0) {
            state.race.status = 'racing';
            state.race.timer = 0;

            // ⚠️ OCS IS A FACT ABOUT POSITION AT THE STARTING SIGNAL, NOT A HISTORY OF
            // CROSSINGS. RRS 29.1: "when at her starting signal any part of a boat's hull
            // is on the course side of the starting line". The flag was only ever set by a
            // crossing EVENT during the prestart, so a boat that arrived on the course side
            // without one — sliding in laterally from beyond a mark, a crossing that fell
            // between two frames, a clear-then-re-cross — started clean.
            //
            // Measured (`_ocs_truth.js`, 3 races a venue, 270 boat-starts): SIX boats over
            // the line at the gun and not flagged, one of them 182 units over, and NONE
            // wrongly flagged. Judging by position closes every one by construction,
            // whatever the cause was.
            //
            // The line has ENDS: a hull past the pin is not on the course side of the
            // starting line, she is past it. Both tests are applied per hull point.
            {
                const [sm0, sm1] = startLinePts();
                if (sm0 && sm1) {
                    const sdx = sm1.x - sm0.x, sdy = sm1.y - sm0.y;
                    const sL = Math.hypot(sdx, sdy) || 1;
                    const ss = startCrossSign();
                    for (const b of state.boats) {
                        if (b.raceState.finished) continue;
                        let over = false;
                        for (const q of hullPolygonAt(b.x, b.y, b.heading)) {
                            const d = ss * ((q.x - sm0.x) * sdy - (q.y - sm0.y) * sdx) / sL;
                            if (d <= 0) continue;
                            const along = ((q.x - sm0.x) * sdx + (q.y - sm0.y) * sdy) / sL;
                            if (along >= 0 && along <= sL) { over = true; break; }
                        }
                        if (over !== !!b.raceState.ocs) {
                            b.raceState.ocs = over;
                            if (b.isPlayer) {
                                if (over) showRaceMessage("OVER EARLY - RETURN TO PRE-START!", "text-red-500", "border-red-500/50");
                                else hideRaceMessage();
                            }
                        }
                    }
                }
            }

            Sound.playStart();
            Sound.updateMusic();

            // Reset AI Stuck timers to prevent immediate recovery maneuvers
            for (const b of state.boats) {
                b.ai.stuckTimer = 0;
                b.ai.recoveryMode = false;
            }
        }
    } else if (state.race.status === 'racing') {
        state.race.timer += dt;

        // Calculate Cutoff Time (0.1875s per meter)
        // legLength is in units. 5 units = 1 meter.
        let totalDistMeters = (state.race.totalLegs * state.race.legLength) / 5;
        // A designed course carries its own limit — authored, or derived from the route
        // by VenueDoc.compile. `legs × legLength` only ever described a
        // windward-leeward; the island special case that used to live here was that
        // same gap patched for one venue, and it did not generalise to a course with
        // gates in it.
        const cutoffTime = (state.course.cutoff != null)
            ? state.course.cutoff : totalDistMeters * 0.1875;

        if (state.race.timer >= cutoffTime) { // Dynamic Cutoff
            state.race.status = 'finished';

            // Mark all active boats as DNF/DNS
            for (const boat of state.boats) {
                if (!boat.raceState.finished) {
                    boat.raceState.finished = true;
                    boat.raceState.finishTime = state.race.timer;

                    // If still on Leg 0 (Start), they count as DNS
                    if (boat.raceState.leg === 0) {
                        boat.raceState.resultStatus = 'DNS';
                    } else {
                        boat.raceState.resultStatus = 'DNF';
                    }
                }
            }

            if (state.camera.target === 'boat') {
                state.camera.target = 'finish';
                _resultsPending = true;
            }
        }
    }

    // Update Boats
    for (const boat of state.boats) {
        updateBoat(boat, dt);
    }

    // Collisions
    checkBoatCollisions(dt);
    checkMarkCollisions(dt);
    // BEFORE the land pass, so the coastline still gets the last word. settleFloes states
    // the rule for ice — "shore pass, last, so the coastline always wins" — and it holds
    // here for a stronger reason: a bow can shove a boat clean into a beach, and if land
    // resolved first that boat would spend a frame inside the shore.
    checkTrafficCollisions(dt);
    checkIslandCollisions(dt);
    checkNearMisses(dt);

    // Sailing School: the segment driver, the companions, the coaching.
    if (window.School && School.active) School.update(dt);

    // Sayings
    Sayings.update(dt);

    // Player Cam
    const player = state.boats[0];
    const camLerp = 1 - Math.pow(0.9, timeScale);
    if (state.camera.mode === 'heading') {
        let diff = normalizeAngle(player.heading - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    } else if (state.camera.mode === 'north') {
        let diff = normalizeAngle(0 - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    }

    if (state.camera.messageTimer > 0) state.camera.messageTimer -= dt;
    if (state.camera.target === 'boat') {
        if (player.raceState.finished && player.fadeTimer <= 0) {
             state.camera.target = 'finish';
             _resultsPending = true;
        } else {
            // ── THE BOAT SITS LOW, SO THE WATER AHEAD IS ON SCREEN ──────────────
            // Centred, half the frame is spent on where you have already been. What a
            // sailor is actually reading is in front: the next mark, the pressure coming
            // down, the crest about to lift the stern. So the camera aims at a point AHEAD
            // of the boat and the boat falls back down the frame.
            //
            // ⚠️ HEADING MODE ONLY, and that is not a scoping shortcut. The offset is what
            // puts the boat at a fixed spot on screen, and that only works because heading
            // mode guarantees the bow points up the frame. In `north` the same offset would
            // slide the boat to a different edge every time you changed course, which is
            // worse than centred rather than better.
            //
            // ⚠️ THE OFFSET IS APPLIED AFTER THE SMOOTHING, NOT CHASED BY IT. The first cut
            // lerped the view centre toward `boat + offset`, and it ROCKED through every
            // turn: as the camera rotates, that target swings through an arc of radius
            // `look` — a quarter of the screen — and a 10%-per-frame lerp cannot keep up, so
            // the boat slid up the frame during the turn and drifted back afterwards.
            //
            // So the smoothing follows the BOAT (`fx, fy`, the same lerp as before) and the
            // look-ahead is added on top as a rigid offset. The boat's place on screen is
            // then fixed by construction, and turning pivots the world about the hull —
            // which is what a camera locked to a boat should do anyway.
            //
            // ⚠️ ALONG camera.rotation, NOT player.heading. The two differ mid-turn, and
            // offsetting along the heading would walk the boat sideways across the frame
            // instead. Along the camera's own up-axis it stays put.
            if (state.camera.fx === undefined) { state.camera.fx = state.camera.x; state.camera.fy = state.camera.y; }
            state.camera.fx += (player.x - state.camera.fx) * 0.1;
            state.camera.fy += (player.y - state.camera.fy) * 0.1;
            const look = state.camera.mode === 'heading' ? canvas.height * CAM_LOOK_AHEAD : 0;
            state.camera.x = state.camera.fx + Math.sin(state.camera.rotation) * look;
            state.camera.y = state.camera.fy - Math.cos(state.camera.rotation) * look;
        }
    } else if (state.camera.target === 'finish') {
        // Focus on Finish Line center
        let indices = finishMarks() || [0, 1];
        if (state.course.marks && state.course.marks.length >= 2) {
             const m1 = state.course.marks[indices[0]], m2 = state.course.marks[indices[1]];
             const tx = (m1.x+m2.x)/2, ty = (m1.y+m2.y)/2;
             state.camera.x += (tx - state.camera.x) * 0.05;
             state.camera.y += (ty - state.camera.y) * 0.05;
             // Rotate to face upwind (North, 0) for better view of finishers
             let diff = normalizeAngle(0 - state.camera.rotation);
             state.camera.rotation += diff * 0.05;
        }
    }

    // Particles
    const windDirX = Math.sin(state.wind.direction);
    const windDirY = -Math.cos(state.wind.direction);

    // Wakes: each boat carries a short tapered RIBBON trail (sampled stern
    // positions, ~1.5s of life — about half the old visual length) plus
    // sparse foam dots. The old 'wake-wave' particle streams lived ~11s and
    // are gone entirely; drawWakes renders the ribbons.
    if (state.race.status !== 'waiting') {
        for (const boat of state.boats) {
            if (!boat.wakeTrail) { boat.wakeTrail = []; boat.wakeSampleT = 0; }

            // Age + prune (all boats, including finished — trails fade out)
            for (const s2 of boat.wakeTrail) s2.age += dt;
            while (boat.wakeTrail.length && boat.wakeTrail[boat.wakeTrail.length - 1].age > 2.25) boat.wakeTrail.pop();

            // ── THE BIOLUMINESCENT TRAIL IS ITS OWN, LONGER BUFFER ──────────────
            // The ribbon above is deliberately short (2.25 s, ~4 boat lengths) because it
            // draws FOAM, and foam collapses. Bioluminescence is a different quantity and
            // outlives it, so it gets its own trail rather than borrowing this one — the
            // alternative was lengthening `wakeTrail`, which would have stretched the
            // daylight foam on all nine other venues to fix a night effect on one.
            // Sampled at half the rate: the light is a smooth band, not beads, and 0.16 s
            // at racing speed is ~17 units, far finer than the stroke width.
            if (nightAmt() > 0) {
                if (!boat.bioTrail) { boat.bioTrail = []; boat.bioSampleT = 0; }
                for (const s2 of boat.bioTrail) s2.age += dt;
                while (boat.bioTrail.length && boat.bioTrail[boat.bioTrail.length - 1].age > BIO_TRAIL_LIFE) boat.bioTrail.pop();
            } else if (boat.bioTrail && boat.bioTrail.length) {
                boat.bioTrail.length = 0;
            }

            if (boat.speed > 0.08 && !boat.raceState.finished) {
                const boatDX = Math.sin(boat.heading);
                const boatDY = -Math.cos(boat.heading);
                // Sample UNDER the aft hull (not at the transom) — the boat
                // sprite covers the ribbon origin, so the wake emerges from
                // beneath the hull instead of spurting off the stern
                const sternX = boat.x - boatDX * 12;
                const sternY = boat.y - boatDY * 12;
                const planing = boat.raceState.isPlaning;

                boat.wakeSampleT -= dt;
                if (boat.wakeSampleT <= 0) {
                    boat.wakeSampleT = 0.08;
                    boat.wakeTrail.unshift({ x: sternX, y: sternY, age: 0, str: Math.max(0, Math.min(1, (boat.speed - 0.05) / 1.45)) * (planing ? 1.3 : 1) });
                    if (boat.wakeTrail.length > 34) boat.wakeTrail.pop();
                }
                if (boat.bioTrail) {
                    boat.bioSampleT -= dt;
                    if (boat.bioSampleT <= 0) {
                        boat.bioSampleT = 0.16;
                        // `str` is SHEAR, which is what actually triggers a cell — so it is
                        // taken from speed, and a planing hull tearing the surface lights
                        // more water than one ghosting along at two knots.
                        boat.bioTrail.unshift({ x: sternX, y: sternY, age: 0,
                            str: Math.max(0, Math.min(1, (boat.speed - 0.04) / 1.3)) * (planing ? 1.25 : 1) });
                        if (boat.bioTrail.length > 80) boat.bioTrail.pop();
                    }
                }

                // Occasional foam blobs scattered ALONG the wake band (real
                // wakes break into patches); never point-spawned at the stern
                const str0 = boat.wakeTrail.length ? boat.wakeTrail[0].str : 0;
                if (boat.wakeTrail.length > 4 && fxRand() < (planing ? 0.22 : 0.10) * str0) {
                    const idx = 1 + Math.floor(fxRand() * Math.min(9, boat.wakeTrail.length - 2));
                    const p = boat.wakeTrail[idx];
                    const q = boat.wakeTrail[idx + 1];
                    const sdx = q.x - p.x, sdy = q.y - p.y;
                    const sl = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
                    const off = (fxRand() - 0.5) * 2 * (8 + p.age * 8);
                    createParticle(p.x + (-sdy / sl) * off, p.y + (sdx / sl) * off, 'wake', { scale: 0.7 + fxRand() * 0.9, boat });   // tagged so the foam fades with its boat
                }
            }
        }
    }

    // ── WIND STREAKS: where a streak is BORN is the primary pressure cue ────────
    //
    // Real water tells you this by presence and absence. Below about six knots the
    // surface is glassy and there are no wind streaks at all; the along-wind lines
    // (Langmuir streaks) start showing in a moderate breeze and cover the water in a
    // fresh one. So a lull is drawn as BARE WATER, not as a dim streak — which is both
    // what a sailor actually sees and the only encoding that survives on a dark palette,
    // where "faint white" and "nothing" look identical anyway.
    //
    // Two independent gates, because they answer two different questions:
    //   absolute (`windiness`) — is there enough breeze here to mark the water at all?
    //   relative (`pressureAt`) — is this the windy side of THIS course?
    // Absolute alone would make a light venue uniformly bare and a fresh one uniformly
    // covered; relative alone would paint 7-knot swamp water like a squall.
    //
    // The old rule was `max(0.07, (rel - 0.85) * 1.6)` against the route-centroid wind.
    // On nine of the ten venues the wind field is spatially uniform, so `rel` was exactly
    // 1 everywhere and the floor was doing all the work: density was flat, and so was
    // every other channel. This layer varied nothing on nine venues and read the tenth
    // backwards.
    const spawnTries = 2;
    for (let s = 0; s < spawnTries; s++) {
        const range = Math.max(canvas.width, canvas.height) * 1.35;
        // A streak is a mark on the WATER. A single roll rejected on land used to be
        // the whole story — which on open water changed nothing, but in Redrock's
        // canyon maze most of the box IS land, so the layer thinned out exactly
        // where the wind does its wildest work. Resample a few times instead: the
        // WATER keeps its density whatever the land fraction around it. Extra
        // draws are safe — fxRand is the visuals-only stream.
        let sx = 0, sy = 0, onWater = false;
        for (let r = 0; r < 6 && !onWater; r++) {
            sx = state.camera.x + (fxRand() - 0.5) * range;
            sy = state.camera.y + (fxRand() - 0.5) * range;
            onWater = Arena.contains(state.course.boundary, sx, sy, 0) && inMaskWater(sx, sy);
        }
        if (!onWater) continue;
        const spd = getWindAt(sx, sy).speed;
        const windiness = Math.max(0, Math.min(1, (spd - _streakRef.floor) / _streakRef.span));
        if (windiness <= 0) continue;                       // glassy: the water is not marked
        const t = pressureAt(spd);
        // Squared, so the windy side is unmistakably denser rather than slightly denser.
        // Capped well below saturation: at the top of Glacier Sound's ramp the first
        // tuning put ~300 streaks on screen and the fleet raced through a curtain. This
        // layer is the water talking, and it stays under the boats and the labels
        // (race-view.md §8) — ~2.5x the density of the light corner is plenty to read.
        // Capped for the same reason the other two channels are: density is the strongest
        // pressure cue AND the one that most easily becomes a curtain. The gradient below
        // the ceiling is what carries the reading; the ceiling is what keeps it readable.
        const _c = cometCfg();
        // ⚠️ THE PRESSURE WEIGHT IS THE CONTRAST. The constant term is density you get for
        // being on windy water at all; the t² term is density you get for being on the WINDY
        // SIDE of this course. Measured puff:clear was 1.5-1.7 against the 2.5 this layer's
        // own note claims to deliver, so the constant came down and the weighted term went up.
        const chance = Math.min(STREAK_MAX_SPAWN, _c.dens0 + _c.dens1 * windiness * (0.18 + 0.82 * t * t));
        if (fxRand() >= chance) continue;
        createParticle(sx, sy, 'wind', {
            life: 1.0,
            jit: fxRand(),
            // Each streak rides at its own share of the true wind, in the same 0.6-0.9
            // band the puff cells use — so a streak inside a cat's-paw travels WITH it
            // instead of sliding through it. The spread is also the only source of
            // streak-to-streak LENGTH variety, and it stays inside that physical band:
            // 1.5x of scatter against the 1.9x the wind varies across Glacier Sound and
            // the 2.4x it varies between venues, so length still READS as wind speed
            // rather than becoming decoration on top of one.
            drift: 0.60 + fxRand() * 0.30,
            trail: [{ x: sx, y: sy }],
            trailT: 0,
            beach: 1,
            waterT: fxRand() * WIND_WATER_RECHECK
        });
    }
    updateParticles(dt);
    updateWindWaves(dt);
    updateSurf(dt);
    // Sim-clocked since the leak fixes: these used to run from draw() on
    // performance.now(), so a headless run (which never draws) had frozen props
    // and a rendering client had wall-clock drift that ignored pause/gameSpeed.
    // Both are RNG-free and purely visual (drifting props force contact:none).
    updateDriftingProps(dt);
    updateJellyDrifts(dt);
    // WHITECAPS, SURF SPRAY AND THE BOW UPWIND. After the boats, because two of the three
    // read `boat.swell` and it is written in updateBoat. Its own particle arrays and its
    // own PRNG, so it can neither be seen by the sim nor perturb it. No-op off the ocean.
    if (window.SeaFX) window.SeaFX.update(dt, state);

    recordTrajectory(dt);
}

// HUMAN TRAJECTORY RECORDER (instrument, off by default — enable with
// localStorage.setItem('regatta_record','1')). Samples the player at 10Hz and
// auto-downloads a JSON when they finish (or the race ends). Read-only: no sim
// state or RNG is touched, so traces and evals are unaffected with the flag off.
// Near a rounding mark it also samples the 16 ring sectors THROUGH THE SAME
// GRID LENS the RL policy observes, plus rival positions, so human samples are
// comparable to policy observations. Uses: human-vs-bot segment diagnostics,
// BC warm-starts for crew/driver policies (see arctic-ai-campaign.md).
let frameCount = 0;

// ── DISTANCE MADE ON COURSE ─────────────────────────────────────────────────
// How far round the course a boat is, in world units, measured along the shared per-leg
// path (CoursePath in planner.js). Finished legs contribute their whole length; the
// current leg contributes the boat's furthest projection onto it.
//
// This is a RANKING number and the leaderboard's distance deltas. It is deliberately
// measured on the course, not on the water the boat actually sailed: two boats on
// opposite tacks up the same beat are then directly comparable, which is the entire
// reason the metric exists and is what race telemetry reports.
//
// The straight-axis version this replaces only worked on alternating windward/leeward
// courses. See the note on CoursePath for what it did to an island rounding.
function draw() {
    frameCount++;

    // Draw Water Background (Screen Space)
    drawWater(ctx);

    const player = state.boats[0];
    if (!player) return;

    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.rotate(-state.camera.rotation);
    ctx.translate(-state.camera.x, -state.camera.y);

    // all lay over a submerged animal, which is most of what sells the depth.

    // SHOALS BEFORE THE SWELL — the only thing in the world that is genuinely BELOW the
    // surface, so it is the only thing the surface layers are allowed to run across. See
    // drawShoals. Painted shallows go first of all: a shoal inside a lagoon is still a
    // bar, so its sand draws over the zone's tint.
    // (Drifting props and jellyfish integrate in update(dt) now — sim-clocked,
    // pause-correct, identical for headless and rendering clients.)
    // Moonlight lies ON the water, under the waves, the wakes and the fleet.
    drawNightWater(ctx);
    // Shallows, shoals, bottom vegetation, reefs and the seabed props — in that stacking
    // order (grass grows ON the bar, the reef mass sits over sand and weed, a coral head
    // placed on a reef draws over it) — all come out of one cached world-anchored
    // composite: static content that was five full-screen passes a frame. See
    // drawSeabedUnderlay. Every layer of the moving surface runs across it all.
    drawSeabedUnderlay(ctx);
    // Jellyfish bodies ride with the seabed layer so the water draws over them — that is
    // what sells the depth they are rising and falling through. Their light comes later.
    drawJellyDrifts(ctx);

    // SWELL FIRST, under everything else on the water. It is the shape of the sea itself —
    // the biggest, slowest structure there is — so the wakes, the cat's-paws and the
    // wind-wave crests all ride ON it. Drawing it over them would read as a decal.
    if (window.Swell) window.Swell.draw(ctx, state);

    // Rapids whitewater: a texture ON the water, so over the swell shape and under the
    // wakes — a boat's wash is disturbed water on top of whatever the river is doing.
    drawRapidsFoam(ctx);

    drawWakes(ctx);
    // On the water with the fleet's wakes and under everything else, which is where a wake
    // belongs. Separate from drawWakes because it shares none of its machinery: no trail,
    // no per-frame sampling, and a shape the boat ribbon does not have.
    drawTrafficWakes(ctx);
    drawParticles(ctx, 'surface');
    drawGusts(ctx);
    drawWindWaves(ctx);
    // OVER the wind-wave crests, because a whitecap is one of those crests breaking, and
    // over the cat's-paw tints, because foam floats on whatever colour the water is. Still
    // UNDER the fleet: the hull silhouette stays clean (race-view.md §7).
    if (window.SeaFX) window.SeaFX.draw(ctx, state);

    // ...but a fin cutting the surface and the bubbles behind it are ON the
    // water, so they go over the crests the body sits beneath.
    // drawIslandShadows(ctx);
    drawParticles(ctx, 'current');
    // The nav aids used to draw HERE, and they now draw over the floating stratum instead —
    // see the block after drawPropWash for why.
    // ── Everything physical, in ONE pass, in document order ─────────────────
    // It used to be two passes with three layers wedged between them — all land, then
    // disturbed air, the boundary and brash, then all floes. That put every floe in front
    // of every landmass by construction, so a floe could not be tucked behind a headland
    // however the venue was authored, and it left land and ice disagreeing about whether
    // the boundary line was drawn over them.
    //
    // So: paint on the water first (the nav aids above), then the sailing limit over all of
    // it, then the wind shadow and the shapes in the order the document stacks them.
    //
    // THE LIMIT SITS ON TOP OF THE WATER AND UNDER THE WORLD. Everything painted ON the
    // surface — wakes, gusts, wind waves, the gate line, the ladder rungs, the laylines —
    // passes beneath it, because they are all marks on the same water and the limit is the
    // one that says where the water ends. Everything that stands IN the water — the wind
    // shadow, the land, the marks, the boats — passes over it, because a band of club
    // branding running across a coastline is exactly what it used to look like.
    drawBoundary(ctx);
    // Sailing School overlays: the wind ribbon, the no-go cone, lesson buoys, the
    // launch and the ducklings. World space, under the boats. No-op outside school.
    if (window.School && School.active) School.drawWorld(ctx);

    // FLOATING PROPS — on the water, behind the land. Placed here and nowhere else, and the
    // two neighbours are both load-bearing:
    //   after drawBoundary, because a pad is a thing floating IN the water rather than a mark
    //   painted ON it, and the limit's own rule is that what stands in the water passes over
    //   it (the wind shadow, the land, the marks and the fleet all do);
    //   before drawIslands, which is what actually keeps water objects off the land — the
    //   bank paints over whatever part of a cluster laps onto it, for free.
    // Everything the water does (swell, wakes, gusts, wind waves) is already finished above,
    // so nothing ripples across a pad that is floating on top of it.
    //
    // FLOATING WEED SHARES THIS SLOT, and that is the point of putting them together: a lily
    // bed and a cluster of pad SPRITES are the same substance answering to the same rule, so
    // they belong in one stratum rather than two. Everything the water does — the swell, the
    // wakes, the cat's-paws, the wind waves — is finished above, so a wake never runs across a
    // mat and say it was painted on the surface rather than floating on it. The bed draws
    // first and the props over it, because a placed cluster sits on top of the bed it is part
    // of.
    //
    // ⚠️ THE WEED USED TO DRAW AFTER THE LAND, ON PURPOSE, and this reverses it. The old
    // reasoning was that weed piles up against a bank and laps onto the mud, so a hard
    // coastline cutting a mat off is the wrong picture. That is true of the mat's EDGE and
    // false of everything behind it: what it actually produced was lily pads floating in the
    // middle of a dry mud bank, several pad-widths inland, which is a worse picture than a
    // trimmed one and reads as a bug rather than as weed. A water plant is not on land, so
    // the coastline trims it — the same rule the float props follow, by the same mechanism,
    // costing nothing. If the hard trim ever needs softening, the fix is the mat's own edge
    // ramp (bakeVegSprite already feathers on distance-to-edge), NOT drawing it over the land.
    // Surface vegetation and float props come out of one cached world tile (they are
    // static; only drifting flotsam draws live, over the beds) — see
    // drawFloatStratumCached. The stacking inside the stratum is unchanged: bed first,
    // props over it.
    drawFloatStratumCached(ctx);
    // The lap at the foot of anything standing IN the water. Here rather than beside the
    // trunk sprite for the same reason the float props are here: it is a mark on the WATER,
    // so the land has to be able to cover it — a trunk set back on a bank gets no waterline,
    // which is correct and free. The sprite it belongs to draws later, on `surface`, over it.
    drawPropWash(ctx);

    // ── THE COURSE'S OWN GEOMETRY, OVER EVERYTHING FLOATING ON THE WATER ────
    // Start/finish line, ladder rungs, laylines, mark zones, rounding arrows.
    //
    // These are not scenery. They are the only thing on screen saying where the course IS,
    // and a player who cannot see the start line cannot start. So they sit above every
    // floating thing: a lily bed, a hyacinth mat, a raft of pad sprites.
    //
    // ⚠️ THEY MOVED DOWN FROM ABOVE drawBoundary, and what moved them is the floating
    // stratum that now sits between. Weed and float props draw AFTER the limit — a pad is a
    // thing in the water rather than a mark painted on it — so nav aids left in their old
    // slot were painted over by every bed they crossed, and on Gatorgrass Bayou the start
    // line disappeared under a raft.
    //
    // STILL UNDER THE LAND, which was the original reason they sat early: drawn after
    // drawIslands they ran across the coastline, and a layline over a headland says you can
    // sail there. Land is the one thing that must occlude them, and it still does — that is
    // the whole distinction, and it is not arbitrary. Nav aids go OVER what you can sail
    // through (weed, bars, painted zones) and UNDER what you cannot (land).
    //
    // WHAT THIS REVERSES, stated plainly: the limit's own rule that "everything painted on
    // the surface — the gate line, the ladder rungs, the laylines — passes beneath it". They
    // now pass OVER it. Deliberate, and the same trade as the weed: a start line erased by a
    // band of club branding is no better than one erased by a lily pad, the limit is a
    // static edge while these are what you steer by, and the overlap is peripheral anyway —
    // the limit is at the arena rim and only a long layline ever reaches it.
    //
    // Gate line, ladder rungs and laylines are all derived from a windward GATE and mean
    // nothing on an island rounding, so they are skipped there.
    // The First Sail is one boat alone on open water: no line, no gate, no course overlay.
    // The course exists (the school moves the player to it for the Start) but is not drawn.
    const soloSail = window.School && School.courseHidden();
    if (!soloSail) {
    drawActiveGateLine(ctx);
    // Ladder rungs measure progress up a windward leg and have no meaning on a
    // single island rounding. The start/finish line and the laylines do, so they
    // stay — skipping drawActiveGateLine took the start line with it.
    if (state.course.type !== 'islandRound' && !(window.School && School.startPractice())) drawLadderLines(ctx);
    drawLayLines(ctx);
    drawMarkZones(ctx);
    drawRoundingArrows(ctx);
    }

    drawDisturbedAir(ctx);
    // Cached world tile on floe-free courses; the arctic (floes drift, spin, and may be
    // authored behind headlands) draws live in document order as before.
    drawIslandsCached(ctx);
    // Surf sits ON the shore, so it goes over the land and under the air layer.
    drawSurf(ctx);
    // Surface props: over the land they stand on, under everything that races. This is the
    // plane for a thing the GROUND holds up — a trunk, a beached log — as against `float`
    // above, which is for a thing the WATER holds up and which the land therefore covers.
    // Cached world tile; drifters draw live — see drawSurfacePropsCached.
    drawSurfacePropsCached(ctx);
    drawTraffic(ctx);
    if (!soloSail) {
        drawMarkShadows(ctx);
        drawMarkBodies(ctx);
    }
    drawRulesOverlay(ctx);

    // Draw All Boats (viewport cull: mid-race most of the fleet is off-screen)
    const boatViewR = Math.sqrt(canvas.width ** 2 + canvas.height ** 2) * 0.6 + 90;
    const boatViewR2 = boatViewR * boatViewR;
    for (const boat of state.boats) {
        const bdx = boat.x - state.camera.x, bdy = boat.y - state.camera.y;
        if (bdx * bdx + bdy * bdy > boatViewR2) continue;
        ctx.save();
        ctx.translate(boat.x, boat.y);
        ctx.rotate(boat.heading);
        // RIDING THE SWELL, as parallax. A hull on a crest is nearer the camera than one in a
        // trough. Strictly this is a couple of percent of scale from a realistic camera
        // height — and a couple of percent turned out to be invisible. Pushed to 7.5%, which
        // reads as a fleet heaving over a big sea and gives you the lift under the bow as you
        // climb one. Picture only; the physics never reads it. No-op off the ocean.
        if (window.Swell && window.Swell.active()) {
            const s = 1 + window.Swell.lift(boat.x, boat.y) * 0.075;
            ctx.scale(s, s);
        }
        drawBoat(ctx, boat);
        ctx.restore();
    }
    // Sailing School callouts that must sit ABOVE the boats (the ring round your own hull).
    if (window.School && School.active) School.drawAbove(ctx);

    // Canopy props: the crowns a hull sails beneath, so they go over the fleet — and
    // under the air layer, because a wind comet passes over a treetop too. Split by
    // what can fade: on-land crowns from a cached world tile, over-water crowns live.
    drawCanopyCached(ctx);

    // Spindrift is AIR — wind-torn snow streaming off the ice, so it passes over hulls
    // and sails like the comets do (owner's call: over the boats). Gated on
    // fx.spindrift inside the layer; a no-op everywhere else. See icefx.js.
    if (window.IceFX) window.IceFX.draw(ctx, state);

    // The cloud is ABOVE the world, so its shadow falls on everything under it — water,
    // sand, palms, hulls alike. Drawing it at the surface layer left islands and props
    // standing in sunlight inside a squall, which read as a hole in the weather. It is
    // still the physics ellipse exactly: the darkened world is the changed wind.
    drawSquallShadows(ctx);
    // Rain falls past the camera: a boat in a squall is a boat seen through it.
    drawSquallRain(ctx);

    // Wind comets are air, not water — they pass over hulls and sails, not under them.
    drawParticles(ctx, 'air');

    // ── THE LIGHT COMES DOWN, THEN WHAT MAKES ITS OWN GOES BACK UP ──────────
    // Placed here, after the last PHYSICAL layer and before the indicators: everything in
    // the world dims together, and the HUD-ish overlays that follow stay legible. No-op on
    // every venue that authors no `palette.night`.
    drawNightWash(ctx);
    drawJellyGlow(ctx);
    drawNightGlow(ctx);
    // ⚠️ AFTER THE WASH, AND NOT GATED ON NIGHT. It has to come after drawNightWash or the
    // fire would be multiplied down by the very moonlight it is supposed to be pushing back;
    // and unlike the two passes above it runs on every venue, because a fire burns at noon.
    // drawFireGlow scales itself by nightAmt() rather than returning early on it.
    drawFireGlow(ctx);

    // Draw Indicators. Not on the First Sail: the classmates are scenery there, and a name
    // tag pointing off-screen is one more thing for a beginner to wonder about.
    const firstSail = window.School && School.active && School.s && School.s.kind === 'sail';
    for (const boat of state.boats) {
        if (firstSail && !boat.isPlayer) continue;
        if (boat.opacity === undefined || boat.opacity > 0.1) {
             ctx.save();
             if (boat.opacity !== undefined) ctx.globalAlpha = boat.opacity;
             drawBoatIndicator(ctx, boat);
             ctx.restore();
        }
    }

    drawDebugWorld(ctx);

    ctx.restore();

    // Screen-space weather (Arctic snowfall) — over the world, under the UI
    drawSnowOverlay(ctx);

    // Camera Message
    if (state.camera.messageTimer > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1.0, state.camera.messageTimer*2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        ctx.font = FONT.label(28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const txt = "CAMERA: " + state.camera.message;
        ctx.fillText(txt, canvas.width/2, canvas.height/3);
        ctx.restore();
    }

    // Edge indicators: next mark(s) and nearby competitors.
    if (state.race.status !== 'finished') {
        const m = 40, hw = Math.max(10, canvas.width/2-m), hh = Math.max(10, canvas.height/2-m);
        const rot = -state.camera.rotation;
        // THE HUD SITS ON TOP OF THE CANVAS, and that is fine: indicators track
        // the edge band honestly and pass under the panels. The instruments
        // (top right) are translucent, so an indicator sliding behind them stays
        // readable; the leaderboard is near-opaque, so IT is the one that yields —
        // it sits inset from the left edge (see index.html) leaving the band
        // clear. No dodging: every scheme that slid indicators around the panels
        // flickered, because near a corner the choice of escape side is unstable.
        // Project a world point into screen space, clamped to the screen edge band.
        const toScreen = (wx, wy) => {
            const dx = wx - state.camera.x, dy = wy - state.camera.y;
            const rx = dx*Math.cos(rot) - dy*Math.sin(rot);
            const ry = dx*Math.sin(rot) + dy*Math.cos(rot);
            let t = 1.0;
            if (Math.abs(rx)>0.1 || Math.abs(ry)>0.1) t = Math.min(hw/Math.abs(rx), hh/Math.abs(ry));
            const f = Math.min(t, 1.0);
            return { x: canvas.width/2 + rx*f, y: canvas.height/2 + ry*f, onScreen: t >= 1.0 };
        };

        if (window.School && School.lesson()) School.drawEdgeIndicators(ctx, toScreen, rot);
        if (state.showNavAids && !(window.School && School.lesson())) {
            const leg = player.raceState.leg;
            const marks = state.course.marks;
            // ROUTE-DRIVEN, not shape-guessed. The old split ("gate legs if the course has
            // four marks, otherwise the single waypoint") left every ROUNDING leg with no
            // indicator at all — legMarks() is null there — and gave the start and finish
            // lines a single pip at the nearest point instead of one per end.
            const e = routeLeg(Math.min(leg, state.race.totalLegs));
            if (e && e.kind === 'round' && e.mark) {
                // Rounding leg: point straight at the mark, whatever the path to it looks
                // like — the indicator answers "where is it", not "how do I get there".
                const rm = e.mark;
                const p = toScreen(rm.x, rm.y);
                // AN EDGE INDICATOR IS FOR THINGS OFF THE EDGE. Once the mark itself is
                // in view it is the better thing to look at.
                if (!p.onScreen) {
                    const d = Math.sqrt((rm.x-player.x)**2 + (rm.y-player.y)**2) * 0.2;
                    drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(d) + 'm', rm.side || null, rot);
                }
            } else if (e && e.marks && marks) {
                // A line or a gate: BOTH ends get an indicator — a line's whole span is
                // crossable, and which end you favour is a tactical choice the display
                // should not make for you. Mid-race gate marks also carry the mini
                // rounding-direction arc; the start and finish ends do not.
                const isGate = e.kind === 'gate' && !e.finish && leg > 0 && leg < state.race.totalLegs;
                for (const idx of e.marks) {
                    const mk = marks[idx];
                    if (!mk) continue;
                    const p = toScreen(mk.x, mk.y);
                    if (p.onScreen) continue;
                    const d = Math.sqrt((mk.x-player.x)**2 + (mk.y-player.y)**2) * 0.2;
                    drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(d) + 'm', isGate ? idx : null, rot);
                }
            } else {
                // No route entry to read (defensive): the single waypoint pip, as before.
                const wp = player.raceState.nextWaypoint;
                const p = toScreen(wp.x, wp.y);
                if (!p.onScreen) drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(wp.dist) + 'm', null, rot);
            }
        }

        // Competitors: off-screen but close-ish. On-screen boats already carry
        // name tags; distant boats live on the minimap.
        const NPC_EDGE_RANGE = 1500; // world units (~300 m)
        for (const boat of state.boats) {
            if (boat.isPlayer) continue;
            if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
            const bdx = boat.x - player.x, bdy = boat.y - player.y;
            if (bdx*bdx + bdy*bdy > NPC_EDGE_RANGE*NPC_EDGE_RANGE) continue;
            const p = toScreen(boat.x, boat.y);
            if (p.onScreen) continue;
            drawNpcEdgeIndicator(ctx, p.x, p.y, boat);
        }
    }

    if (!(window.School && School.active && School.panelHidden)) drawBoatInstruments(ctx, player);
    if (!(window.School && School.hudHidden)) drawMinimap();
    drawWindDebug(ctx);

    // UI Updates (Player Data)
    const localWind = getWindAt(player.x, player.y);

    if (hudShowsRose()) updateRoseHud(player, localWind);


    // OCS banner: persistent while the flag is up (the transient race message is
    // easy to miss, and a correct OCS hold then reads as a missed crossing). The
    // arrow tracks the nearest point of the start line every frame so it stays
    // honest under camera rotation.
    if (UI.ocsBanner) {
        const ocsOn = state.race.status === 'racing' && player.raceState.ocs && !player.raceState.finished;
        UI.ocsBanner.classList.toggle('hidden', !ocsOn);
        if (ocsOn && UI.ocsArrow) {
            try {
                const [mo0, mo1] = startLinePts();
                const cl = getClosestPointOnSegment(player.x, player.y, mo0.x, mo0.y, mo1.x, mo1.y);
                const ang = Math.atan2(cl.x - player.x, -(cl.y - player.y));
                UI.ocsArrow.style.transform = `rotate(${ang - state.camera.rotation}rad)`;
            } catch (e) {}
        }
    }

    if (frameCount % 10 === 0) {
        updateLeaderboard();

        // Show when the player's boat is overpowered (>18kn effective wind costs speed,
        // scaled by heavyAir) — turns an invisible tax into a readable condition to sail
        // around. No venue gate any more: it asks the same question the physics asks, which
        // is whether THIS boat is in too much breeze right now, so it lights up wherever
        // that is true rather than only in the Arctic.
        // Asks the SAME question the physics asks, which is now heel and not wind speed. On
        // the old true-wind test the badge lit for the whole of a windy race — including
        // dead downwind, where the boat is at her fastest and nothing is wrong — so it read
        // as "it is breezy" rather than "you are pressing too hard right now". Keyed on
        // heel it goes out the moment the player bears away, which is what makes it a cue
        // rather than a label.
        if (UI.overpoweredBadge) {
            const op = (player.heel || 0) > OVERPOWERED.heelThreshold
                && state.race.status === 'racing' && !player.raceState.finished;
            UI.overpoweredBadge.classList.toggle('hidden', !op);
        }

        // The speed / VMG / TWS / TWA readouts and their PLANING and SURFING labels used to
        // be written into the wind rose here. The rose is gone and all of it now draws on the
        // canvas under the player's boat — see drawBoatInstruments. The logic went with it
        // rather than being dropped: SOG's planing and penalty colours, the TWS pressure
        // comparison against the course's own p10/p90, and the dirty-air arrow are all in
        // boatInstrumentData. VMG is the one number that did not survive the move.
        if (UI.timer) {
            let displayTime = state.race.timer;
            let timerClass = 'text-white';

            if (state.race.status === 'prestart') {
                displayTime = -state.race.timer;
                if (state.race.timer < 10) timerClass = 'text-orange-400';
            } else if (player.raceState.finished) {
                displayTime = player.raceState.finishTime;
                timerClass = 'text-green-400';
            } else if (state.race.status === 'finished') {
                timerClass = 'text-green-400';
            }

            UI.timer.textContent = formatTime(displayTime);
            UI.timer.className = `t-mono text-4xl tracking-widest drop-shadow-md ${timerClass}`;
        }

        if (UI.startTime) {
            if (player.raceState.legSplitTimer > 0) {
                UI.startTime.textContent = formatSplitTime(player.raceState.lastLegDuration);
                UI.startTime.classList.remove('hidden');
            } else if (player.raceState.startTimeDisplayTimer > 0) {
                UI.startTime.textContent = '+' + player.raceState.startTimeDisplay.toFixed(3) + 's';
                UI.startTime.classList.remove('hidden');
            } else {
                UI.startTime.classList.add('hidden');
            }
        }

        if (UI.legInfo) {
             const vn = venueDisplayName(settings.venue);
             UI.legInfo.textContent = vn ? vn.toUpperCase() : "";
        }

        if (UI.legTimes) {
            // legTimes is its own positioned container now, so it no longer inherits
            // the venue caption's hidden state — it has to gate on 'waiting' itself
            // or stale splits would show over the venue picker.
            const legTimesHidden = state.race.status === 'prestart' || state.race.status === 'waiting' || (window.School && School.active);
            UI.legTimes.classList.toggle('hidden', legTimesHidden);
            if (!legTimesHidden) {
                 let html = "";
                 const getMoves = (i) => player.raceState.legManeuvers[i] || 0;
                 const getDist = (i) => Math.round(player.raceState.legDistances[i] || 0);
                 const getTop = (i) => (player.raceState.legTopSpeeds[i] || 0).toFixed(1);

                 // Split times are for the player; Top/Dist/Moves is telemetry
                 // and reads as dev output on screen, so it rides F8 debug.
                 const tele = (i) => settings.debugMode
                     ? ` <span class="t-mono text-slate-500" style="font-size:10px;">Top:${getTop(i)}kn Dist:${getDist(i)}m Moves:${getMoves(i)}</span>`
                     : '';
                 const CHIP = 'bg-slate-900/60 px-2 py-0.5 rounded border-r-2 border-slate-500 shadow-md flex justify-between gap-4';

                 if (player.raceState.startLegDuration !== null) {
                     html += `<div class="${CHIP}"><span class="t-mono text-slate-300" style="font-size:11px;">Start ${formatSplitTime(player.raceState.startLegDuration)}</span>${tele(0)}</div>`;
                 }
                 player.raceState.legTimes.forEach((t, i) => {
                     html += `<div class="${CHIP}"><span class="t-mono text-slate-300" style="font-size:11px;">Leg ${i+1} ${formatSplitTime(t)}</span>${tele(i+1)}</div>`;
                 });
                 if ((state.race.status==='racing' || state.race.status==='prestart') && player.raceState.leg <= state.race.totalLegs) {
                     const cur = player.raceState.leg;
                     const t = (cur===0) ? state.race.timer : (state.race.timer - player.raceState.legStartTime);
                     const lbl = (cur===0) ? "Start" : `Leg ${cur}`;
                     const teleCur = settings.debugMode
                         ? ` <span class="t-mono text-white/50" style="font-size:10px;">Top:${getTop(cur)}kn Dist:${getDist(cur)}m Moves:${getMoves(cur)}</span>`
                         : '';
                     html += `<div class="bg-slate-900/80 px-2 py-0.5 rounded border-r-2 border-green-500 shadow-md flex justify-between gap-4"><span class="t-mono text-white" style="font-size:11px;">${lbl} ${formatSplitTime(t)}</span>${teleCur}</div>`;
                 }
                 UI.legTimes.innerHTML = html;
            }
        }
    }
}

let lastTime = 0;
function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (!state.paused) {
        let iterations = 1;
        // The fleet finishes at 10x once you have: the shipped results overlay, and the
        // Sailing School's own results screen (E), which keeps the sim running behind it
        // and re-reads the finish order as the classmates come in.
        if ((UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden'))
            || (window.School && School.active && School._screenId === 'E')) {
            iterations = 10;
        }

        const step = Math.min(dt, 0.1) * (state.gameSpeed || 1.0);
        // ⚠️ A SLOW FRAME IS SUB-STEPPED, NOT SWALLOWED WHOLE. This used to hand the entire
        // catch-up to one update() call, so a 100 ms hitch integrated 100 ms of physics in a
        // single step: at 15 knots that is 22 units of travel applied at once, which reads as
        // the boat TELEPORTING rather than as a dropped frame, and it is why a render stall
        // was reported as "the game jumps" rather than "the game stutters". Every rate in the
        // sim — turn authority, acceleration, the swell's forcing, collision separation — is
        // integrated once per call, so one huge call is also less accurate than several small
        // ones covering the same span.
        //
        // Capped at SUB_MAX so a hitch cannot multiply itself into a death spiral: past that
        // the world runs slightly slow for a frame instead of trying to catch up, which is
        // the better failure. update() measures ~1 ms (eval/_ocean_perf.js: p50 0.9, max 4.5),
        // so four of them is affordable where the alternative is a visible jump.
        //
        // ⚠️ NO-OP AT A HEALTHY FRAME RATE, and that is load-bearing: at dt = 1/60 the ceil
        // gives exactly one sub-step of exactly `step`, so this is bit-identical to what it
        // replaced. The eval harness drives update(1/60) directly and never reaches this
        // function at all, so no recorded race moves.
        const SUB_DT = 1 / 60, SUB_MAX = 4;
        const subs = Math.min(SUB_MAX, Math.max(1, Math.ceil(step / SUB_DT)));
        const sub = step / subs;
        for (let i = 0; i < iterations * subs; i++) {
            update(sub);
        }
        // The sim only RAISES the flag (update() must not open DOM overlays — the
        // trace/eval harnesses drive update() directly and never want a screen).
        // The overlay opens here, same frame, presentation-side.
        if (_resultsPending) {
            _resultsPending = false;
            if (window.School && School.active) School.onResults();
            else showResults();
        }
        draw();
    }
    requestAnimationFrame(loop);
}

function resetGame() {
    // The compile cache exists so ONE reset's many compile consumers (the editor's
    // checks, stats and inspectors) pay for one compile. A new reset may follow a
    // document edited in place — the editor's, or a test's — so the cache dies here,
    // at the one gate every rebuild passes through.
    if (window.VenueDoc && window.VenueDoc.invalidateCompile) window.VenueDoc.invalidateCompile();
    loadSettings();
    // The pond is the school's venue, never the clubhouse's: a stored 'pond' (a reload
    // mid-lesson) falls back to the front door. School.start() saves 'pond' precisely so
    // this reload survives it.
    if ((settings.venue === 'pond' || settings.venue === 'pond-open') && !(window.School && window.School.active)) settings.venue = 'bay';
    _resultsPending = false;
    if (UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
    state.camera.target = 'boat';
    state.wind.baseSpeed = 8 + Math.random()*10;
    state.wind.speed = state.wind.baseSpeed;
    state.wind.baseDirection = Math.random() * Math.PI * 2;
    state.wind.direction = state.wind.baseDirection; // Random phase
    state.wind.history = [];
    state.wind.debugTimer = 0;
    state.gusts = [];

    // Persistent shift for this race: a slow, one-way veer (+) or back (-) of
    // ~18-28° total over the race, at ~2-4°/min. Creates the "pick the right side"
    // gamble. Sign/rate are randomized per race so neither player nor AI can
    // foresee it; the AI infers it from the wind's low-frequency trend.            // 18-28 deg // deg/sec

    // Randomized Biases for New Wind Model



    // Direction Bias (Variability 5-10% roughly)
    // +/- 0.1 to 0.2 radians
    const directionBias = (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.1);

    // Current Generation
    // Default to no current
    let currentData = null;

    state.race.conditions = {
        directionBias,
        current: currentData
    };

    // Venue overrides (no-op for Bay — see applyVenueConditions)
    applyVenueConditions();


    // Seed for island generation
    state.race.seed = Math.floor(Math.random() * 1000000);
    state.time = 0;
    if (window.Rules) window.Rules.init();
    state.race.status = 'waiting'; // Wait for user to start

    // Defaults for Race Config (can be overridden by UI)
    // Preserve existing config if set, otherwise use defaults
    state.race.legLength = state.race.legLength || 4000;
    // The player's lap count is a SETTING; a designed course's leg count is a property
    // of the course. Keeping them in one field meant racing Glacier Sound (2 legs) left
    // every later venue on 2 laps instead of 4 — the same shape of leak as legLength.
    state.race.userLegs = state.race.userLegs || state.race.totalLegs || 4;
    state.race.totalLegs = state.race.userLegs;
    state.race.startTimerDuration = state.race.userStartTime || 30.0;

    state.race.timer = state.race.startTimerDuration;

    initCourse();

    // Init Water Renderer
    if (window.WaterRenderer) window.WaterRenderer.init();

    // Pre-populate the sources' cells, so a race opens with its puffs already on the water
    // rather than fading in over the first minute. No sources means none to populate.
    const gregs = state.course.gustRegions;
    if (gregs && gregs.length) {
        let want = 0;
        for (const r of gregs) want += r.count;
        for (let i = 0; i < want; i++) spawnRegionGust(gregs, true);
    }

    state.boats = [];
    if (UI.lbRows) UI.lbRows.innerHTML = '';
    UI.boatRows = {};
    if (UI.resultsList) UI.resultsList.innerHTML = '';
    UI.resultRows = {};
    // The hero and the splits redraw only when their signature changes (they run six times
    // a second), so a new race has to invalidate that signature — otherwise the next
    // results page opens showing the last race's finish. The venue best is likewise
    // decided once per race, on the first render.
    for (const id of ['res-hero', 'res-splits']) {
        const el = document.getElementById(id);
        if (el) delete el.dataset.sig;
    }
    state.race.bestChecked = false;
    state.race.legRecordsSet = [];
    state.race.recordResults = null;
    state.race.bestOutcome = null;

    // Create Boats (Initialized at 0,0, positioned by repositionBoats)
    // Sailing School assigns a training dinghy; the picker is withheld until Lighthouse Cove.
    const school = window.School && window.School.active;
    const pc = school ? School.playerConfig() : playerCharacter();
    const player = new Boat(0, true, 0, 0, pc.name, pc);
    // applySettings() only runs on load/save, so a boat built after that would
    // otherwise ignore a stored Auto Trim = off and start the race auto-trimming.
    player.manualTrim = !settings.autoTrim;
    player.heading = state.wind.direction; // Head to wind
    player.prevHeading = player.heading;
    player.lastWindSide = 0;
    state.boats.push(player);

    // Create AI Boats
    const opponents = [];
    // NEVER RACE YOURSELF. Two boats with one name and one face makes the leaderboard
    // unreadable and the edge indicators ambiguous. The draw count is unchanged at 9, so
    // the rng stream is the same length; only which nine come out differs.
    const available = AI_CONFIG.filter(c => c.name !== settings.character);
    if (school) {
        opponents.push(...School.classmateConfigs());   // three classmates, no rng
    } else for (let i = 0; i < fleetOpponents() && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        opponents.push(available[idx]);
        available.splice(idx, 1);
    }

    // Determine favored end for start positioning bias
    const favoredEnd = getFavoredEnd(); // 0 = mark 0 (low pct), 1 = mark 1 (high pct)
    const favorBias = favoredEnd === 1 ? 0.15 : -0.15; // Shift spread toward favored end

    for (let i = 0; i < opponents.length; i++) {
        const config = opponents[i];
        const ai = new Boat(i + 1, false, 0, 0, config.name, config);

        // Initial setup props
        ai.prevHeading = ai.heading;
        ai.lastWindSide = 0;

        // Start Setup: Evenly spaced with small jitter, biased toward favored end
        const numAI = opponents.length;
        const basePos = numAI > 1 ? 0.1 + 0.7 * (i / (numAI - 1)) : 0.5;
        const jitter = (Math.random() - 0.5) * 0.10; // ±5%
        ai.ai.startLinePct = Math.max(0.05, Math.min(0.90, basePos + jitter + favorBias));
        ai.ai.setupDist = 250 + Math.random() * 100;

        state.boats.push(ai);
    }

    if (school) School.onFleetBuilt();
    repositionBoats();
    // THE CAMERA IS PART OF SETTING THE COURSE. It follows the player by lerping 10% a
    // frame, so a race that starts with it parked over the LAST race's finish line spends
    // its first seconds flying across the water and spinning to the new wind — which is
    // what a Rematch looked like. Boats placed, course built, camera put where the boats
    // are: only then is there anything worth drawing.
    snapCameraToStart();

    state.particles = [];
    state.waveStates.clear();

    // Reset the AI quote system. Its update() consumes Math.random() for quote
    // selection; if its queue/timers carry over between races the number and
    // timing of those random draws leaks across runs, desynchronising any
    // seeded RNG (and leaving stale quotes on screen on a real restart).
    if (!window.__DNS_KEEP_SAYINGS_LEAK) {
        Sayings.queue = [];
        Sayings.current = null;
        Sayings.timer = 0;
        Sayings.silenceTimer = 0;
    }

    hideRaceMessage();

    setupPreRaceOverlay();

    if (settings.soundEnabled || settings.musicEnabled) Sound.init();
    else Sound.updateMusic();
}

// Put the view where the race is, with no travel: the same answer the follow camera would
// converge on a second or two later, taken as the starting value instead. Rotation is read
// from the mode the player chose, so North stays north.
function snapCameraToStart() {
    const p = state.boats[0];
    if (!p) return;
    state.camera.target = 'boat';
    // `fx, fy` is the smoothed FOLLOW point the look-ahead is measured from; the view centre
    // is derived from it every frame. Snapping one without the other would leave the follow
    // point wherever the last race ended and the camera would travel back to the start line
    // over the first second — the exact travel this function exists to avoid.
    state.camera.fx = p.x;
    state.camera.fy = p.y;
    state.camera.rotation = state.camera.mode === 'north' ? 0 : p.heading;
    const look = state.camera.mode === 'heading' ? canvas.height * CAM_LOOK_AHEAD : 0;
    state.camera.x = p.x + Math.sin(state.camera.rotation) * look;
    state.camera.y = p.y - Math.cos(state.camera.rotation) * look;
}

// HOW MANY BOATS RACE HERE: the document's `course.fleet` (2–10, counting the player),
// else the club's ten. A small pond lays a 100 m line for four boats; the editor's checks
// and the fleet it lays out behind the line both read this, so they judge the race that
// will actually be sailed. Sailing School casts its own three classmates regardless.
function fleetOpponents() {
    const d = window.VenueDoc && window.VenueDoc.get(settings.venue);
    const n = d && d.course && d.course.fleet;
    return (n >= 2 && n <= 10) ? Math.round(n) - 1 : 9;
}

function restartRace() { resetGame(); togglePause(false); }

// Same venue, same fleet, straight back onto the water — the results page's primary
// action, since without a series there is no "next race" to send anyone to. It goes
// through `startRace()` rather than setting the status itself, so the prestart, the audio
// and the leaderboard all come up exactly as they do from the clubhouse.
function rematchRace() { resetGame(); togglePause(false); startRace(); }

resetGame();
requestAnimationFrame(loop);

// Water Debug Logic
function toggleWaterDebug() {
    if (!UI.waterDebug) return;
    UI.waterDebug.classList.toggle('hidden');
    if (!UI.waterDebug.classList.contains('hidden')) {
        initWaterDebugUI();
    }
}

function initWaterDebugUI() {
    if (!UI.waterDebugControls || !window.WATER_CONFIG) return;
    UI.waterDebugControls.innerHTML = ''; // Clear

    const createControl = (key, label, type, min, max, step) => {
        const div = document.createElement('div');
        div.className = "flex flex-col gap-1";

        const header = document.createElement('div');
        header.className = "flex justify-between items-end";

        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.className = "text-slate-400 font-bold uppercase text-[10px] tracking-wide";

        const valDisp = document.createElement('span');
        valDisp.className = "t-mono text-cyan-400";
        valDisp.textContent = window.WATER_CONFIG[key];

        header.appendChild(lbl);
        header.appendChild(valDisp);
        div.appendChild(header);

        let input;
        if (type === 'color') {
            input = document.createElement('input');
            input.type = 'color';
            input.value = window.WATER_CONFIG[key];
            input.className = "w-full h-6 bg-slate-800 rounded cursor-pointer border border-slate-600";
        } else {
            input = document.createElement('input');
            input.type = 'range';
            input.min = min;
            input.max = max;
            input.step = step;
            input.value = window.WATER_CONFIG[key];
            input.className = "w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500";
        }

        input.addEventListener('input', (e) => {
            window.WATER_CONFIG[key] = (type === 'range') ? parseFloat(e.target.value) : e.target.value;
            valDisp.textContent = window.WATER_CONFIG[key];
        });

        div.appendChild(input);
        UI.waterDebugControls.appendChild(div);
    };

    createControl('baseColor', 'Base Color', 'color');
    createControl('depthGradientStrength', 'Vignette Strength', 'range', 0, 1, 0.05);
    createControl('contourOpacity', 'Contour Opacity', 'range', 0, 1, 0.05);
    createControl('contourScale', 'Contour Scale', 'range', 0.5, 3.0, 0.1);
    createControl('contourSpacing', 'Contour Spacing', 'range', 10, 100, 5);
    createControl('contourWarp', 'Contour Warp', 'range', 0, 2.0, 0.1);
    createControl('contourSpeed', 'Flow Speed', 'range', 0, 0.1, 0.005);
    createControl('causticOpacity', 'Caustic Opacity', 'range', 0, 1, 0.05);
    createControl('causticScale', 'Caustic Scale', 'range', 0.5, 5.0, 0.1);
    createControl('grainOpacity', 'Grain Opacity', 'range', 0, 0.2, 0.01);
    createControl('shorelineGlowSize', 'Island Glow Size', 'range', 1.0, 3.0, 0.1);
    createControl('shorelineGlowOpacity', 'Island Glow Opacity', 'range', 0, 1, 0.05);
    createControl('shorelineColor', 'Glow Color', 'color');
}

if (UI.waterReset) {
    UI.waterReset.addEventListener('click', () => {
        // Simple reload for defaults or store defaults separately?
        // Let's just reload page for now or hardcode reset if needed.
        // Or store defaults in water.js
        window.location.reload();
    });
}
if (UI.waterClose) UI.waterClose.addEventListener('click', () => {
    if (UI.waterDebug) UI.waterDebug.classList.add('hidden');
});

window.state = state; window.UI = UI; window.updateLeaderboard = updateLeaderboard; window.CONFIG = CONFIG;
// Roster sheet (competitor.html) reads the fleet straight out of the game
window.AI_CONFIG = AI_CONFIG; window.ARCHETYPES = ARCHETYPES;
window.competitorProfileHTML = competitorProfileHTML; window.renderProfileBoat = renderProfileBoat;
