
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const NUM_TRIALS = parseInt(ARGS[0]) || 10;
const SEED_BASE = parseInt(ARGS[1]) || 12345;
const TIME_LIMIT = 600; // 10 mins
const OUT_FILE = 'regatta/eval/eval_results.json';

// Helper: Mode (Continuous - Binned)
function modeContinuous(values, binWidth = 5) {
    if (values.length === 0) return null;
    const bins = {};
    let maxFreq = 0;
    let bestBin = null;

    values.forEach(v => {
        const bin = Math.floor(v / binWidth) * binWidth;
        bins[bin] = (bins[bin] || 0) + 1;
        if (bins[bin] > maxFreq) {
            maxFreq = bins[bin];
            bestBin = bin;
        }
    });

    if (bestBin === null) return null;
    return { value: bestBin + binWidth/2, range: [bestBin, bestBin + binWidth], count: maxFreq };
}

// Helper: Mode (Discrete)
function modeDiscrete(values) {
    if (values.length === 0) return null;
    const counts = {};
    let maxFreq = 0;

    values.forEach(v => {
        counts[v] = (counts[v] || 0) + 1;
        if (counts[v] > maxFreq) maxFreq = counts[v];
    });

    // Tie breaking: smallest value
    let bestVal = Infinity;
    for (const k in counts) {
        if (counts[k] === maxFreq) {
            const val = parseFloat(k);
            if (val < bestVal) bestVal = val;
        }
    }
    if (bestVal === Infinity) return null;
    return { value: bestVal, count: maxFreq };
}

function calculateStats(values, type = 'continuous') {
    if (values.length === 0) return { n: 0, mean: 0, mode: 0, max: 0 };
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const max = Math.max(...values);
    const mode = type === 'continuous' ? modeContinuous(values) : modeDiscrete(values);
    return { n: values.length, mean, mode, max };
}

(async () => {
    if (ARGS.includes('--test-only')) {
        return; // Skip execution if imported for testing
    }

    console.log(`Starting Eval: ${NUM_TRIALS} trials, Seed Base: ${SEED_BASE}`);
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Load Game
    const gamePath = 'file://' + path.resolve('regatta/index.html');
    await page.goto(gamePath);

    // Inject Harness
    const harnessCode = fs.readFileSync('regatta/eval/eval_harness.js', 'utf8');
    await page.addScriptTag({ content: harnessCode });

    const allResults = [];

    // Run Trials
    for (let i = 0; i < NUM_TRIALS; i++) {
        const seed = SEED_BASE + i;
        if (i % 10 === 0) console.log(`Running Trial ${i+1}/${NUM_TRIALS}...`);

        const result = await page.evaluate(({ seed, limit }) => {
            return window.evalHarness.runTrial(seed, limit);
        }, { seed, limit: TIME_LIMIT });

        allResults.push(result);
    }

    await browser.close();

    console.log("Processing Results...");

    // --- Aggregation ---

    const aggregated = {
        overall: {},
        byCharacter: {}
    };

    // Structures to hold raw data for aggregation
    const buckets = {
        start: {
            time: [],
            dns_count: 0,
            stalled: [],
            boundary_time: [],
            min_mark_dist: [],
            escapes: []
        },
        upwind: { time: [], penalties: [], coll_boat: [], coll_mark: [], coll_bound: [], attempt_count: 0, finish_count: 0 },
        downwind: { time: [], penalties: [], coll_boat: [], coll_mark: [], coll_bound: [], attempt_count: 0, finish_count: 0 },
        race: { time: [], penalties: [], coll_boat: [], coll_mark: [], coll_bound: [], dnf: 0, count: 0 }
    };

    const charBuckets = {};

    const getBucket = (charName) => {
        if (!charBuckets[charName]) {
            charBuckets[charName] = JSON.parse(JSON.stringify(buckets));
        }
        return charBuckets[charName];
    };

    allResults.forEach(trial => {
        trial.boats.forEach(boat => {
            const charName = boat.character || boat.name;
            if (charName === 'Player') return;

            const bGlobal = buckets;
            const bChar = getBucket(charName);

            // Events for this boat
            const events = trial.events.filter(e => e.boatId === boat.id);
            const incidents = trial.incidents.filter(e => e.boatId === boat.id);

            // 1. Start Metrics
            const startEvt = events.find(e => e.type === 'start_cross');
            if (startEvt) {
                bGlobal.start.time.push(startEvt.time);
                bChar.start.time.push(startEvt.time);
            } else {
                bGlobal.start.dns_count++;
                bChar.start.dns_count++;
            }

            // New Start Stats
            if (boat.startStats) {
                bGlobal.start.stalled.push(boat.startStats.stalledTime);
                bChar.start.stalled.push(boat.startStats.stalledTime);

                bGlobal.start.boundary_time.push(boat.startStats.boundaryTime);
                bChar.start.boundary_time.push(boat.startStats.boundaryTime);

                if (boat.startStats.minMarkDist !== Infinity) {
                    bGlobal.start.min_mark_dist.push(boat.startStats.minMarkDist);
                    bChar.start.min_mark_dist.push(boat.startStats.minMarkDist);
                }

                bGlobal.start.escapes.push(boat.startStats.escapes || 0);
                bChar.start.escapes.push(boat.startStats.escapes || 0);
            }

            // 2. Leg Analysis
            const legTimes = {};
            if (startEvt) legTimes[0] = startEvt.time;

            events.filter(e => e.type === 'leg_complete').forEach(e => {
                // e.leg is the leg just completed
                legTimes[e.leg] = e.time;
            });

            const finishEvt = events.find(e => e.type === 'finish');
            if (finishEvt) legTimes[4] = finishEvt.time;

            // Legs 1 & 3 (Upwind), 2 & 4 (Downwind)
            // To be an attempt, previous leg must be finished (or Start for Leg 1).
            // Leg 1 attempt: startEvt exists.
            // Leg 2 attempt: Leg 1 finished.
            // Leg 3 attempt: Leg 2 finished.
            // Leg 4 attempt: Leg 3 finished.

            const processLeg = (legIdx, type) => {
                const prevIdx = legIdx - 1;
                // Check if attempted (prev leg finished)
                if (legTimes[prevIdx] !== undefined) {
                    if (type === 'upwind') { bGlobal.upwind.attempt_count++; bChar.upwind.attempt_count++; }
                    else { bGlobal.downwind.attempt_count++; bChar.downwind.attempt_count++; }

                    // Check if finished
                    if (legTimes[legIdx] !== undefined) {
                        if (type === 'upwind') { bGlobal.upwind.finish_count++; bChar.upwind.finish_count++; }
                        else { bGlobal.downwind.finish_count++; bChar.downwind.finish_count++; }

                        const duration = legTimes[legIdx] - legTimes[prevIdx];
                        if (type === 'upwind') {
                            bGlobal.upwind.time.push(duration);
                            bChar.upwind.time.push(duration);
                        } else {
                            bGlobal.downwind.time.push(duration);
                            bChar.downwind.time.push(duration);
                        }

                        const legIncs = incidents.filter(inc => inc.leg === legIdx);
                        const pushStats = (target) => {
                            target.penalties.push(legIncs.filter(i => i.type === 'penalty').length);
                            target.coll_boat.push(legIncs.filter(i => i.type === 'collision_boat').length);
                            target.coll_mark.push(legIncs.filter(i => i.type === 'collision_mark').length);
                            target.coll_bound.push(legIncs.filter(i => i.type === 'collision_boundary').length);
                        };

                        if (type === 'upwind') { pushStats(bGlobal.upwind); pushStats(bChar.upwind); }
                        else { pushStats(bGlobal.downwind); pushStats(bChar.downwind); }
                    }
                }
            };

            processLeg(1, 'upwind');
            processLeg(2, 'downwind');
            processLeg(3, 'upwind');
            processLeg(4, 'downwind');

            // Race Overall
            bGlobal.race.count++;
            bChar.race.count++;

            if (boat.finished) {
                bGlobal.race.time.push(boat.finishTime);
                bChar.race.time.push(boat.finishTime);
            } else {
                bGlobal.race.dnf++;
                bChar.race.dnf++;
            }

            // Total Incidents (Leg > 0)
            const totalIncs = incidents.filter(i => i.leg > 0);
            const countType = (t) => totalIncs.filter(i => i.type === t).length;

            const pushRace = (target) => {
                target.penalties.push(countType('penalty'));
                target.coll_boat.push(countType('collision_boat'));
                target.coll_mark.push(countType('collision_mark'));
                target.coll_bound.push(countType('collision_boundary'));
            };

            pushRace(bGlobal.race);
            pushRace(bChar.race);
        });
    });

    // Compile Report
    const compile = (b) => {
        const totalStarts = b.start.time.length + b.start.dns_count;
        const dnsPct = totalStarts > 0 ? (b.start.dns_count / totalStarts) * 100 : 0;

        const upwindDnf = b.upwind.attempt_count > 0 ? (1 - (b.upwind.finish_count / b.upwind.attempt_count)) * 100 : 0;
        const downwindDnf = b.downwind.attempt_count > 0 ? (1 - (b.downwind.finish_count / b.downwind.attempt_count)) * 100 : 0;

        return {
            start_stats: {
                time: calculateStats(b.start.time),
                stalled_time: calculateStats(b.start.stalled),
                boundary_time: calculateStats(b.start.boundary_time),
                min_mark_dist: calculateStats(b.start.min_mark_dist),
                escapes: calculateStats(b.start.escapes, 'discrete'),
                dns_percent: dnsPct
            },
            upwind: {
                time: calculateStats(b.upwind.time),
                penalties: calculateStats(b.upwind.penalties, 'discrete'),
                coll_boat: calculateStats(b.upwind.coll_boat, 'discrete'),
                coll_mark: calculateStats(b.upwind.coll_mark, 'discrete'),
                coll_bound: calculateStats(b.upwind.coll_bound, 'discrete'),
                dnf_percent: upwindDnf
            },
            downwind: {
                time: calculateStats(b.downwind.time),
                penalties: calculateStats(b.downwind.penalties, 'discrete'),
                coll_boat: calculateStats(b.downwind.coll_boat, 'discrete'),
                coll_mark: calculateStats(b.downwind.coll_mark, 'discrete'),
                coll_bound: calculateStats(b.downwind.coll_bound, 'discrete'),
                dnf_percent: downwindDnf
            },
            race: {
                time: calculateStats(b.race.time),
                penalties: calculateStats(b.race.penalties, 'discrete'),
                coll_boat: calculateStats(b.race.coll_boat, 'discrete'),
                coll_mark: calculateStats(b.race.coll_mark, 'discrete'),
                coll_bound: calculateStats(b.race.coll_bound, 'discrete'),
                dnf_percent: (b.race.dnf / b.race.count) * 100
            }
        };
    };

    aggregated.overall = compile(buckets);
    for (const char in charBuckets) {
        aggregated.byCharacter[char] = compile(charBuckets[char]);
    }

    // Ensure Output Dir
    const outDir = path.dirname(OUT_FILE);
    if (!fs.existsSync(outDir)){
        fs.mkdirSync(outDir, { recursive: true });
    }

    // Output JSON
    fs.writeFileSync(OUT_FILE, JSON.stringify({ config: { trials: NUM_TRIALS, seed: SEED_BASE }, results: aggregated }, null, 2));

    // Console Report
    console.log("\n=== AI RACE EVAL REPORT ===");
    console.log(`Trials: ${NUM_TRIALS}, Seed: ${SEED_BASE}`);

    const fmt = (n) => typeof n === 'number' ? n.toFixed(2) : n;

    console.log("\nOVERALL METRICS:");
    const o = aggregated.overall;
    console.log(`Start Time Mean: ${fmt(o.start_stats.time.mean)}s (DNS: ${fmt(o.start_stats.dns_percent)}%)`);
    console.log(`  Stalled Time Mean: ${fmt(o.start_stats.stalled_time.mean)}s`);
    console.log(`  Boundary Time Mean: ${fmt(o.start_stats.boundary_time.mean)}s`);
    console.log(`  Min Mark Dist Mean: ${fmt(o.start_stats.min_mark_dist.mean)} units`);
    console.log(`  Escapes/Start: ${fmt(o.start_stats.escapes.mean)}`);
    console.log(`Race Time Mean: ${fmt(o.race.time.mean)}s (DNF: ${fmt(o.race.dnf_percent)}%)`);
    console.log(`Avg Penalties/Race: ${fmt(o.race.penalties.mean)}`);

    console.log("\nPER CHARACTER (Summary):");
    console.log("Char".padEnd(16) + "Start(s)".padEnd(10) + "Stall(s)".padEnd(10) + "Bound(s)".padEnd(10) + "MarkD".padEnd(8) + "DNS%".padEnd(8));
    for (const char in aggregated.byCharacter) {
        const c = aggregated.byCharacter[char];
        console.log(char.padEnd(16) + fmt(c.start_stats.time.mean).padEnd(10) + fmt(c.start_stats.stalled_time.mean).padEnd(10) + fmt(c.start_stats.boundary_time.mean).padEnd(10) + fmt(c.start_stats.min_mark_dist.mean).padEnd(8) + fmt(c.start_stats.dns_percent).padEnd(8));
    }

    console.log(`\nFull results saved to ${OUT_FILE}`);

})();

// Export helpers for testing
module.exports = { modeContinuous, modeDiscrete, calculateStats };
