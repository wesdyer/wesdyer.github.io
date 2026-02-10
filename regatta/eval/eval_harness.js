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

        // Capture all participants
        const participants = [...state.boats];

        // Run Loop
        const dt = 1/60;
        const maxTime = timeLimit || 600;

        let iterations = 0;
        const maxIterations = (maxTime + 100) * 60;

        // Loop
        while (iterations < maxIterations) {
            if (state.race.status === 'racing') {
                if (state.race.timer > maxTime) break;
                if (state.boats.every(b => b.raceState.finished)) break;
            }

            window.update(dt);
            iterations++;
        }

        // Rank boats by finish time for placement
        const sorted = [...participants].sort((a, b) => {
            if (a.raceState.finished && b.raceState.finished) return a.raceState.finishTime - b.raceState.finishTime;
            if (a.raceState.finished) return -1;
            if (b.raceState.finished) return 1;
            return 0;
        });
        const placementMap = {};
        sorted.forEach((b, i) => { placementMap[b.id] = i + 1; });

        return {
            config: { seed, timeLimit },
            events: this.data.events,
            incidents: this.data.incidents,
            boats: participants.map(b => {
                const maneuvers = b.raceState.legManeuvers || [];
                const tackCount = (maneuvers[1] || 0) + (maneuvers[3] || 0);
                return {
                    id: b.id,
                    name: b.name,
                    character: b.name,
                    finished: b.raceState.finished,
                    finishTime: b.raceState.finishTime,
                    leg: b.raceState.leg,
                    penalties: b.raceState.totalPenalties,
                    placement: placementMap[b.id],
                    tackCount: tackCount
                };
            })
        };
    }
};

window.evalHarness.init();
})();
