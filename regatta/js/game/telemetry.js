// regatta/js/game/telemetry.js — instrumentation that must not touch the race:
// the trajectory recorder (localStorage-armed, wraps window.onRaceEvent) and
// the runBatchSim dev harness. Classic script; global scope. Extracted verbatim
// from script.js (refactor 2026-08-24).
let recTraj = null, recFlag = false, recFlagCk = 0;
function recordTrajectory(dt) {
    try {
        // Off by default: the ONLY per-frame cost with the flag unset is this
        // countdown — the localStorage flag is re-read about once a second.
        if (--recFlagCk <= 0) {
            recFlagCk = 60;
            recFlag = localStorage.getItem('regatta_record') === '1';
        }
        if (!recFlag) return;
        const player = state.boats && state.boats.find(b => b.isPlayer);
        if (!player) return;
        const st = state.race.status;
        if ((st === 'prestart' || st === 'racing') && !player.raceState.finished) {
            // A RESTART (racing -> prestart) VOIDS the attempt. The recorder used to
            // keep appending, and one arctic file held three prestarts and two
            // abandoned races — every phase==racing analysis on it silently blended
            // attempts (found by traj_audit.js). The aborted samples are not the
            // race the file's finishTime describes, so they must not share it.
            if (recTraj && recTraj._lastSt === 'racing' && st === 'prestart') recTraj = null;
            if (!recTraj) recTraj = {
                venue: (typeof settings !== 'undefined' && settings.venue) || '?',
                schema: 2,
                // Venue-document fingerprint (djb2 over the doc JSON). The Aug-6
                // redrock confusion — a 140.3s human reference silently invalidated
                // by a venue edit — is exactly what this catches; benches already
                // stamp theirs, recordings now match.
                venueFingerprint: (() => { try {
                    const doc = window.VENUE_DOC && settings && window.VENUE_DOC[settings.venue];
                    if (!doc) return null;
                    const str = JSON.stringify(doc);
                    let h = 5381;
                    for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
                    return h.toString(16) + ':' + str.length;
                } catch (e) { return null; } })(),
                started: new Date().toISOString(), legs: state.race.totalLegs,
                // WHO the rivals were, once — the per-sample tuples are anonymous,
                // and a human-vs-bot comparison needs the fleet and its difficulty.
                fleet: state.boats.filter(b => !b.isPlayer).map(b => b.name),
                aiStatBonus: (typeof AI_STAT_BONUS !== 'undefined') ? AI_STAT_BONUS : null,
                // Course meta so analysis needs nothing but this file: without
                // the mark position, distance-from-ring can't be derived offline.
                course: {
                    roundMark: state.course.roundMark ? {
                        x: Math.round(state.course.roundMark.x), y: Math.round(state.course.roundMark.y),
                        zone: Math.round(state.course.roundMark.zone),
                        reqSweep: +(state.course.roundMark.reqSweep || 0).toFixed(3),
                    } : null,
                    legLens: state.course.dmc && state.course.dmc.legs
                        ? state.course.dmc.legs.map(l => Math.round(l.length)) : [],
                    startLine: (() => { try {
                        return startLinePts().map(p => [Math.round(p.x), Math.round(p.y)]);
                    } catch (e) { return null; } })(),
                    // Every mark and every leg's rounding geometry, so rounding
                    // analysis (owner's request, Aug 6) is self-contained and
                    // survives venue edits.
                    marks: (() => { try {
                        return (state.course.marks || []).map(m => [Math.round(m.x), Math.round(m.y), m.bodyR || 12]);
                    } catch (e) { return null; } })(),
                    legRounds: (() => { try {
                        const out = [];
                        for (let lg = 0; lg <= (state.race.totalLegs || 0); lg++) {
                            const rm = (typeof legRoundMark === 'function') && legRoundMark(lg);
                            out.push(rm ? { x: Math.round(rm.x), y: Math.round(rm.y),
                                zone: Math.round(rm.zone || 0), side: rm.side || null,
                                reqSweep: +(rm.reqSweep || 0).toFixed(3) } : null);
                        }
                        return out;
                    } catch (e) { return null; } })(),
                },
                // Floe hull polygons, body frame, recorded ONCE — with the
                // per-sample [id,x,y,spin] this gives exact extents at every
                // instant (bounding circles misstate clearance on long floes).
                floeHulls: (() => { try {
                    const h = {};
                    (state.course.islands || []).forEach((i2, idx) => {
                        if (i2.isFloe && i2.localHull)
                            h[idx] = i2.localHull.map(p => [Math.round(p.x), Math.round(p.y)]);
                    });
                    return h;
                } catch (e) { return null; } })(),
                events: [], // [t, type] — penalties and ice contacts
                // ⚠️ BARE column names only — a consumer indexed F.rivals against the
                // old decorated name 'rivals[x,y,...]', read undefined, and published
                // "the human sailed alone" from a column that does not exist. The
                // shapes live in formatNotes; the names are the lookup keys.
                format: ['t', 'phase', 'x', 'y', 'hdg', 'spd', 'windDir', 'windSpd',
                         'leg', 'sweep', 'armed', 'ringSect16', 'rivals',
                         'legProg', 'floes', 'giveWayN', 'ocs', 'penaltyTurnsOwed',
                         'awa', 'aws', 'playerTack', 'rivalsX', 'current'],
                formatNotes: {
                    ringSect16: '0clear 3closing 5lead 8plug 10hard, scalar 0 when >3 zones from the round mark',
                    rivals: 'unfinished rivals as [x,y,hdg,spd,tack(1=stbd,-1=port)]',
                    legProg: 'DMC projection onto the current leg, units',
                    floes: 'floes <=1200u as [hullId,x,y,spin,vx,vy]',
                    giveWayN: 'rivals <=600u holding right of way over the player',
                    awa: 'signed rad from the apparent-wind model', playerTack: '1=stbd -1=port',
                    rivalsX: 'aligned with rivals: [boatIdx, leg, flags(1=penalty 2=spiraling 4=ocs)] — stable identity across frames + rule-21 state',
                    current: 'local water current at the player [vx,vy] u/s, [0,0] where the venue has none',
                },
                samples: [], acc: 0,
            };
            // Player penalty/contact events, timestamped — sampling can miss them.
            if (!window.__recEvWrapped) {
                window.__recEvWrapped = true;
                const inner = window.onRaceEvent;
                window.onRaceEvent = (ty, d) => {
                    try {
                        if (recTraj && d && d.boat && d.boat.isPlayer
                            && (ty === 'penalty' || ty === 'collision_island' || ty === 'collision_boundary'
                                || ty === 'collision_boat' || ty === 'collision_mark')
                            && recTraj.events.length < 2000) {
                            // Contact events fire per overlap frame — a sustained
                            // grind would flood the log. One entry per type per 0.5s.
                            const last = recTraj._evT && recTraj._evT[ty];
                            if (last == null || state.race.timer - last >= 0.5) {
                                (recTraj._evT = recTraj._evT || {})[ty] = state.race.timer;
                                const ev = [+state.race.timer.toFixed(1), ty];
                                if (ty === 'collision_boat' && d.other) ev.push(d.other.name);
                                if (ty === 'collision_island') ev.push(d.isFloe ? 'floe' : 'land');
                                // trailing position — where it happened (contact maps)
                                ev.push(Math.round(d.boat.x), Math.round(d.boat.y));
                                recTraj.events.push(ev);
                            }
                        }
                    } catch (e) {}
                    return inner && inner(ty, d);
                };
            }
            recTraj._lastSt = st;
            recTraj.acc += dt;
            if (recTraj.acc < 0.1 || recTraj.samples.length > 18000) return;
            recTraj.acc = 0;
            const lw = getWindAt(player.x, player.y);
            const rm = state.course.roundMark, g = state.course.botGrid;
            let sect = 0;
            if (rm && g && Math.hypot(player.x - rm.x, player.y - rm.y) < rm.zone * 3) {
                sect = [];
                for (let k = 0; k < 16; k++) {
                    const a = k / 16 * Math.PI * 2;
                    const cc = g.cell(rm.x + Math.cos(a) * rm.zone * 1.1, rm.y + Math.sin(a) * rm.zone * 1.1);
                    const id = cc[1] * g.n + cc[0];
                    sect.push(g.at(cc[0], cc[1]) ? (g._futBlk && g._futBlk[id] ? 3 : 0)
                        : (g._soft && g._soft[id] === 1 ? 5 : g._soft && g._soft[id] === 2 ? 8 : 10));
                }
            }
            recTraj.samples.push([
                +state.race.timer.toFixed(2), st === 'prestart' ? 0 : 1,
                +player.x.toFixed(1), +player.y.toFixed(1),
                +player.heading.toFixed(4), +player.speed.toFixed(3),
                +lw.direction.toFixed(4), +lw.speed.toFixed(2),
                player.raceState.leg, +(player.raceState.roundSweep || 0).toFixed(3),
                player.raceState.roundArmed ? 1 : 0, sect,
                // Tack comes from Rules.getTack — the engine's OWN rights-of-way
                // input — so close crossings reconstruct exactly as adjudicated.
                (recTraj._riv = state.boats.filter(b => !b.isPlayer && !b.raceState.finished))
                    .map(b => [Math.round(b.x), Math.round(b.y), +b.heading.toFixed(2), +b.speed.toFixed(2),
                               window.Rules ? window.Rules.getTack(b) : 0]),
                // Course progress: DMC projection onto the current leg — the join
                // key for aligning human and bot trajectories by position.
                (() => {
                    const lg = player.raceState.leg, dmc = state.course.dmc;
                    if (!dmc || !dmc.legs || !dmc.legs[lg]) return -1;
                    if (recTraj.hintLg !== lg) { recTraj.hint = null; recTraj.hintLg = lg; }
                    recTraj.hint = CoursePath.project(dmc.legs[lg], player.x, player.y, recTraj.hint);
                    return Math.round(recTraj.hint);
                })(),
                // Nearby moving-object state — NOT reconstructible offline (live
                // play is not seed-pinned), so it must be captured here.
                (state.course.islands || []).reduce((a, i2, idx) => {
                    if (i2.isFloe && Math.hypot(i2.x - player.x, i2.y - player.y) < 1200)
                        a.push([idx, Math.round(i2.x), Math.round(i2.y), +(i2.spin || 0).toFixed(3),
                                +(i2.driftVx || 0).toFixed(2), +(i2.driftVy || 0).toFixed(2)]);
                    return a;
                }, []),
                // RRS role: how many nearby rivals hold right of way over the
                // player — separates avoidance maneuvers from tactical ones.
                !window.Rules ? -1 : state.boats.reduce((n, b) => {
                    if (b.isPlayer || b.raceState.finished
                        || Math.hypot(b.x - player.x, b.y - player.y) > 600) return n;
                    const r = window.Rules.getRightOfWay(player, b);
                    return n + (r && r.boat === b ? 1 : 0);
                }, 0),
                // Obligation state: OCS and owed penalty turns mark the windows
                // where the trajectory is rules-driven, not preference-driven.
                player.raceState.ocs ? 1 : 0,
                player.raceState.penaltyTurnsOwed || 0,
                // Apparent wind FROM THE MODEL (leeway included) — not exactly
                // derivable offline from true wind + heading + scalar speed.
                player.apparentWind ? +normalizeAngle(player.apparentWind.direction - player.heading).toFixed(3) : 0,
                player.apparentWind ? +player.apparentWind.speed.toFixed(2) : -1,
                window.Rules ? window.Rules.getTack(player) : 0,
                // rivalsX: stable identity + rule-21 state, aligned with rivals.
                recTraj._riv.map(b => [state.boats.indexOf(b), b.raceState.leg,
                    (b.raceState.penalty ? 1 : 0)
                    | (b.controller && b.controller.penaltySpin ? 2 : 0)
                    | (b.raceState.ocs ? 4 : 0)]),
                // local current at the player (drift attribution on current venues)
                (() => { try {
                    const c = (typeof getCurrentAt === 'function') && getCurrentAt(player.x, player.y);
                    return c ? [+(c.x || 0).toFixed(2), +(c.y || 0).toFixed(2)] : [0, 0];
                } catch (e) { return [0, 0]; } })(),
            ]);
        } else if (recTraj && recTraj.samples.length > 50) {
            const t = recTraj; recTraj = null;
            t.finished = !!player.raceState.finished;
            t.finishTime = player.raceState.finishTime || null;
            delete t.acc; delete t._lastSt; delete t._evT; delete t.hint; delete t.hintLg; delete t._riv;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(t)], { type: 'application/json' }));
            a.download = 'traj_' + t.venue + '_' + Date.now() + '.json';
            a.click(); URL.revokeObjectURL(a.href);
        } else if (recTraj) recTraj = null; // too short to keep (e.g. instant reset)
    } catch (e) { /* the recorder must never break the game */ }
}

// Batch Simulation Harness
window.runBatchSim = function(count = 50) {
    console.log(`Starting Batch Sim of ${count} races...`);
    const results = {
        races: 0,
        avgTacksWinner: 0,
        avgTacksLosers: 0,
        wins: { player: 0, ai: 0 },
        collisions: 0
    };

    // Mocking window.onRaceEvent to capture data
    const oldEvent = window.onRaceEvent;
    window.onRaceEvent = (type, data) => {
        if (type === 'collision_boat') results.collisions++;
    };

    settings.soundEnabled = false;
    settings.musicEnabled = false;

    let totalTacksWinner = 0;
    let totalTacksLosers = 0;

    for (let i=0; i<count; i++) {
        resetGame();
        state.race.status = 'racing'; // Skip prestart
        state.race.timer = 0;

        let simTime = 0;
        const maxTime = 600; // 10 mins limit
        const dt = 1/60;

        while (state.race.status !== 'finished' && simTime < maxTime) {
            update(dt);
            simTime += dt;
        }

        results.races++;
        // Analyze results. The winner comes from FINISH TIMES, sim-side truth:
        // lbRank is render-local state written by updateLeaderboard from the
        // draw path, and this loop never draws — the old `lbRank === 0` read
        // was structurally undefined here and no winner was ever counted.
        const finishers = state.boats.filter(b => b.raceState.finished && !b.raceState.resultStatus);
        const winner = finishers.length
            ? finishers.reduce((a, b) => (a.raceState.finishTime < b.raceState.finishTime ? a : b))
            : null;
        if (winner) {
            if (winner.isPlayer) results.wins.player++; else results.wins.ai++;
            // Count tacks (sum of Upwind legs 1 & 3)
            const winnerTacks = (winner.raceState.legManeuvers[1] || 0) + (winner.raceState.legManeuvers[3] || 0);
            totalTacksWinner += winnerTacks;
        }

        // Losers Stats
        let raceLoserTacks = 0;
        let loserCount = 0;
        for (const b of state.boats) {
            if (b !== winner && !b.raceState.resultStatus) { // Only finished boats
                 const tacks = (b.raceState.legManeuvers[1] || 0) + (b.raceState.legManeuvers[3] || 0);
                 raceLoserTacks += tacks;
                 loserCount++;
            }
        }
        if (loserCount > 0) totalTacksLosers += (raceLoserTacks / loserCount);

        console.log(`Race ${i+1}/${count} finished in ${simTime.toFixed(1)}s. Winner: ${winner ? winner.name : 'None'}`);
    }

    results.avgTacksWinner = totalTacksWinner / count;
    results.avgTacksLosers = totalTacksLosers / count;

    window.onRaceEvent = oldEvent;
    console.log("Batch Sim Complete", results);
    return results;
};

