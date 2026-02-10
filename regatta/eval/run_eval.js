
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
    if (values.length === 0) return { n: 0, mean: 0, median: 0, mode: 0, max: 0 };
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const max = Math.max(...values);
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const mode = type === 'continuous' ? modeContinuous(values) : modeDiscrete(values);
    return { n: values.length, mean, median, mode, max };
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

        console.log(`Trial ${i+1} boats:`, result.boats.length, result.boats.map(b => b.name));

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
        start: { time: [], dns_count: 0 },
        upwind: { time: [], penalties: [], coll_boat: [], coll_mark: [], coll_bound: [], attempt_count: 0, finish_count: 0 },
        downwind: { time: [], penalties: [], coll_boat: [], coll_mark: [], coll_bound: [], attempt_count: 0, finish_count: 0 },
        race: { time: [], penalties: [], coll_boat: [], coll_mark: [], coll_bound: [], dnf: 0, count: 0 },
        placement: [],
        tackCount: []
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

            // Placement & Tack Count
            if (boat.placement != null) {
                bGlobal.placement.push(boat.placement);
                bChar.placement.push(boat.placement);
            }
            if (boat.tackCount != null) {
                bGlobal.tackCount.push(boat.tackCount);
                bChar.tackCount.push(boat.tackCount);
            }

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
            start_time: calculateStats(b.start.time),
            dns_percent: dnsPct,
            placement: calculateStats(b.placement, 'discrete'),
            tack_count: calculateStats(b.tackCount, 'discrete'),
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
    console.log(`Start Time Mean: ${fmt(o.start_time.mean)}s | Median: ${fmt(o.start_time.median)}s (DNS: ${fmt(o.dns_percent)}%)`);
    console.log(`Race Time Mean: ${fmt(o.race.time.mean)}s | Median: ${fmt(o.race.time.median)}s (DNF: ${fmt(o.race.dnf_percent)}%)`);
    console.log(`Avg Placement: ${fmt(o.placement.mean)} | Avg Tacks: ${fmt(o.tack_count.mean)}`);
    console.log(`Upwind Time Mean: ${fmt(o.upwind.time.mean)}s | Downwind Time Mean: ${fmt(o.downwind.time.mean)}s`);
    console.log(`Upwind DNF: ${fmt(o.upwind.dnf_percent)}% | Downwind DNF: ${fmt(o.downwind.dnf_percent)}%`);
    console.log(`Avg Penalties/Race: ${fmt(o.race.penalties.mean)}`);
    console.log(`Avg Boat Collisions/Race: ${fmt(o.race.coll_boat.mean)}`);
    console.log(`Avg Mark Collisions/Race: ${fmt(o.race.coll_mark.mean)}`);
    console.log(`Avg Bound Collisions/Race: ${fmt(o.race.coll_bound.mean)}`);

    console.log("\nPER CHARACTER (Summary):");
    console.log("Char".padEnd(16) + "RaceTime".padEnd(10) + "DNF%".padEnd(8) + "DNS%".padEnd(8) + "Pen/R".padEnd(8) + "ColB/R".padEnd(8));
    for (const char in aggregated.byCharacter) {
        const c = aggregated.byCharacter[char];
        console.log(char.padEnd(16) + fmt(c.race.time.mean).padEnd(10) + fmt(c.race.dnf_percent).padEnd(8) + fmt(c.dns_percent).padEnd(8) + fmt(c.race.penalties.mean).padEnd(8) + fmt(c.race.coll_boat.mean).padEnd(8));
    }

    console.log(`\nFull results saved to ${OUT_FILE}`);

})();

// Export helpers for testing
module.exports = { modeContinuous, modeDiscrete, calculateStats };
