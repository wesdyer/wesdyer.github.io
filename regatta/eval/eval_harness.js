(function() { window.evalHarness = { data: { events: [], incidents: [], legs: {}, finished: {} }, config: {}, seed: 0,

    // Seeded RNG (Mulberry32)
    random: function() {
        var t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    init: function() {
        // Replace Math.random
        Math.random = () => this.random();

        // Disable Sound
        if (window.settings) {
            window.settings.soundEnabled = false;
            window.settings.bgSoundEnabled = false;
            window.settings.musicEnabled = false;
        }

        // Hook requestAnimationFrame to stop auto-loop
        window.requestAnimationFrame = (cb) => {
             this.loopCallback = cb;
        };

        // Define hook handler
        window.onRaceEvent = (type, data) => this.handleEvent(type, data);
    },

    lastIncidents: {},

    handleEvent: function(type, data) {
        // "start_cross" logic: handled via leg_complete where leg=0
        if (type === 'leg_complete') {
            this.logEvent(data.boat, 'leg_complete', { leg: data.leg, time: data.time });
            if (data.leg === 0) {
                this.logEvent(data.boat, 'start_cross', { time: data.time });
            }
        } else if (type === 'finish') {
            this.logEvent(data.boat, 'finish', { time: data.time });
        } else if (type === 'penalty') {
            this.logIncident(data.boat, 'penalty');
        } else if (type === 'collision_boat') {
            // data.boat is primary, data.other is secondary
            // Check if other is defined
            let targetId = data.other ? data.other.id : null;
            this.logIncident(data.boat, 'collision_boat', targetId);
        } else if (type === 'collision_mark') {
            this.logIncident(data.boat, 'collision_mark');
        } else if (type === 'collision_boundary') {
            this.logIncident(data.boat, 'collision_boundary');
        } else if (type === 'deadlock_escape') {
            this.logEvent(data.boat, 'deadlock_escape', { time: state.race.timer });
        }
    },

    logIncident: function(boat, type, targetId = null) {
        // Deduplication
        const now = state.race.timer;
        // Key: boatId + type + targetId
        const key = `${boat.id}_${type}_${targetId || ''}`;
        const last = this.lastIncidents[key];
        const cooldown = 2.0; // 2 seconds

        // Allow logging if first time or cooldown passed
        if (last === undefined || (now - last > cooldown)) {
            this.lastIncidents[key] = now;

            this.data.incidents.push({
                boatId: boat.id,
                boatName: boat.name,
                type: type,
                targetId: targetId,
                time: now,
                leg: boat.raceState.leg
            });
        }
    },

    logEvent: function(boat, type, payload) {
        this.data.events.push({
            boatId: boat.id,
            boatName: boat.name,
            type: type,
            ...payload
        });
    },

    runTrial: function(seed, timeLimit, simSpeed) {
        this.seed = seed;
        this.data = { events: [], incidents: [] };
        this.lastIncidents = {};

        // Ensure hook is set
        window.onRaceEvent = (type, data) => this.handleEvent(type, data);

        // Reset Game (Uses our seeded random)
        window.resetGame();

        // Force Start
        window.startRace();

        // Run Loop
        const dt = 1/60;
        const maxTime = timeLimit || 600;

        let iterations = 0;
        const maxIterations = (maxTime + 100) * 60;

        // Instrumentation Data
        const boatStats = {};
        state.boats.forEach(b => {
             boatStats[b.id] = {
                 stalledFrames: 0,
                 boundaryFrames: 0,
                 minMarkDist: Infinity
             };
        });

        // Loop
        while (iterations < maxIterations) {
            if (state.race.status === 'racing') {
                if (state.race.timer > maxTime) break;
                if (state.boats.every(b => b.raceState.finished)) break;
            }

            // --- Instrumentation ---
            if (state.course.marks && state.course.marks.length >= 2) {
                const m0 = state.course.marks[0];
                const m1 = state.course.marks[1];
                const boundary = state.course.boundary;

                state.boats.forEach(b => {
                    if (b.isPlayer) return;
                    // Track only during Start Window (Leg 0)
                    if (b.raceState.leg === 0) {
                        const stats = boatStats[b.id];

                        // Stalled: Speed < 0.2 (approx 1.0 knot)
                        if (b.speed < 0.2) stats.stalledFrames++;

                        // Boundary Proximity: < 200 units from edge
                        if (boundary) {
                             const dx = b.x - boundary.x;
                             const dy = b.y - boundary.y;
                             const dist = Math.sqrt(dx*dx + dy*dy);
                             if (dist > boundary.radius - 200) stats.boundaryFrames++;
                        }

                        // Mark Distance
                        const d0 = (b.x - m0.x)**2 + (b.y - m0.y)**2;
                        const d1 = (b.x - m1.x)**2 + (b.y - m1.y)**2;
                        const minD = Math.sqrt(Math.min(d0, d1));
                        if (minD < stats.minMarkDist) stats.minMarkDist = minD;
                    }
                });
            }
            // -----------------------

            window.update(dt);
            iterations++;
        }

        // Count escapes from events
        state.boats.forEach(b => {
            if (boatStats[b.id]) {
                boatStats[b.id].escapes = this.data.events.filter(e => e.type === 'deadlock_escape' && e.boatId === b.id).length;
            }
        });

        return {
            config: { seed, timeLimit },
            events: this.data.events,
            incidents: this.data.incidents,
            boats: state.boats.map(b => ({
                id: b.id,
                name: b.name,
                character: b.name,
                finished: b.raceState.finished,
                finishTime: b.raceState.finishTime,
                leg: b.raceState.leg,
                penalties: b.raceState.totalPenalties,
                startStats: boatStats[b.id] ? {
                    stalledTime: boatStats[b.id].stalledFrames * dt,
                    boundaryTime: boatStats[b.id].boundaryFrames * dt,
                    minMarkDist: boatStats[b.id].minMarkDist,
                    escapes: boatStats[b.id].escapes
                } : null
            }))
        };
    }
};

window.evalHarness.init();
})();
