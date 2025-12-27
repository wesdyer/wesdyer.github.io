
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const NUM_TRIALS = parseInt(ARGS[0]) || 50;
const SEED_BASE = parseInt(ARGS[1]) || 1000;
const TIME_LIMIT = 600; // 10 mins
const OUT_FILE = 'regatta/eval/character_stats.json';

(async () => {
    console.log(`Starting Character Eval: ${NUM_TRIALS} trials, Seed Base: ${SEED_BASE}`);
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Load Game
    const gamePath = 'file://' + path.resolve('regatta/index.html');
    await page.goto(gamePath);

    // Inject Harness
    const harnessCode = fs.readFileSync('regatta/eval/eval_harness.js', 'utf8');
    await page.addScriptTag({ content: harnessCode });

    const charStats = {};

    // Run Trials
    for (let i = 0; i < NUM_TRIALS; i++) {
        const seed = SEED_BASE + i;
        if (i % 5 === 0) process.stdout.write(`Trial ${i+1}/${NUM_TRIALS}... `);

        const result = await page.evaluate(({ seed, limit }) => {
            return window.evalHarness.runTrial(seed, limit);
        }, { seed, limit: TIME_LIMIT });

        // Process Result
        // Sort boats by finish time / status
        // Boats array in result might not be sorted by rank?
        // Harness returns `participants` array which is just the array.
        // We need to sort it to determine rank/points.

        const boats = result.boats;

        // Sorting Logic (same as script.js)
        boats.sort((a, b) => {
            const getScore = (boat) => {
                if (boat.finished) return 0;
                // harness doesn't strictly return 'DNS'/'DNF' string in boat object,
                // but we can infer or add it.
                // Harness `runTrial` returns: finished boolean, finishTime.
                // If not finished, check if leg === 0 (DNS)
                if (boat.leg === 0) return 2; // DNS
                return 1; // DNF
            };

            const sA = getScore(a);
            const sB = getScore(b);
            if (sA !== sB) return sA - sB;
            if (sA === 0) return a.finishTime - b.finishTime;
            // DNF/DNS tiebreak (by leg/progress) - simplified here, just use leg
            return b.leg - a.leg;
        });

        const totalBoats = boats.length; // Should be 10

        boats.forEach((boat, index) => {
            if (boat.name === 'Player') return;

            if (!charStats[boat.name]) {
                charStats[boat.name] = {
                    starts: 0,
                    points: 0,
                    wins: 0,
                    top3: 0,
                    finishTimes: [],
                    dnf: 0
                };
            }

            const stats = charStats[boat.name];
            stats.starts++;

            // Points: Total - Rank (0-based)
            // 1st (index 0) gets 10 pts.
            let pts = totalBoats - index;

            // Adjust for DNF/DNS? script.js says: "if DNS/DNF, points = 0".
            const isDNF = !boat.finished; // Simplified check
            if (isDNF) pts = 0;

            stats.points += pts;

            if (index === 0) stats.wins++; // Won overall (beating player too)
            if (index < 3) stats.top3++;

            if (boat.finished) {
                stats.finishTimes.push(boat.finishTime);
            } else {
                stats.dnf++;
            }
        });

        if (i % 5 === 0) console.log("Done.");
    }

    await browser.close();

    console.log("\n=== CHARACTER STRENGTH REPORT ===");

    const report = Object.entries(charStats).map(([name, s]) => {
        const avgPts = s.starts > 0 ? s.points / s.starts : 0;
        const finishCount = s.finishTimes.length;
        const avgTime = finishCount > 0 ? s.finishTimes.reduce((a,b)=>a+b,0)/finishCount : 0;
        return { name, avgPts, avgTime, ...s };
    });

    // Sort by Avg Points Descending
    report.sort((a, b) => b.avgPts - a.avgPts);

    console.log("Name".padEnd(16) + "AvgPts".padEnd(8) + "AvgTime".padEnd(10) + "Starts".padEnd(8) + "Wins".padEnd(6) + "Top3".padEnd(6) + "DNF%".padEnd(6));
    console.log("-".repeat(70));

    report.forEach(r => {
        const dnfPct = r.starts > 0 ? Math.round((r.dnf / r.starts)*100) : 0;
        console.log(
            r.name.padEnd(16) +
            r.avgPts.toFixed(2).padEnd(8) +
            r.avgTime.toFixed(1).padEnd(10) +
            r.starts.toString().padEnd(8) +
            r.wins.toString().padEnd(6) +
            r.top3.toString().padEnd(6) +
            (dnfPct+"%").padEnd(6)
        );
    });

    // Save to file
    fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));
    console.log(`\nSaved to ${OUT_FILE}`);

})();
