// DNS Hunter: runs many trials across seeds, surfaces every boat that fails to
// start (never completes leg 0), and dumps diagnostic trajectory so we can see
// WHY it failed (stuck / OCS-loop / wandered off the line / pinned on boundary).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const NUM_TRIALS = parseInt(ARGS[0]) || 200;
const SEED_BASE = parseInt(ARGS[1]) || 1000;
const TIME_LIMIT = parseInt(ARGS[2]) || 600;
const OUT_FILE = 'regatta/eval/dns_hunt.json';

(async () => {
    console.log(`DNS Hunt: ${NUM_TRIALS} trials, seed base ${SEED_BASE}, limit ${TIME_LIMIT}s`);
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const gamePath = 'file://' + path.resolve('regatta/index.html');
    await page.goto(gamePath);
    const harnessCode = fs.readFileSync('regatta/eval/eval_harness.js', 'utf8');
    await page.addScriptTag({ content: harnessCode });

    let totalBoats = 0;
    let dnsBoats = 0;
    const dnsCases = [];

    for (let i = 0; i < NUM_TRIALS; i++) {
        const seed = SEED_BASE + i;
        const result = await page.evaluate(({ seed, limit }) => {
            return window.evalHarness.runTrial(seed, limit);
        }, { seed, limit: TIME_LIMIT });

        result.boats.forEach(boat => {
            if (boat.name === 'Player') return;
            totalBoats++;
            const startEvt = result.events.find(e => e.boatId === boat.id && e.type === 'start_cross');
            if (!startEvt) {
                dnsBoats++;
                dnsCases.push({
                    seed,
                    id: boat.id,
                    name: boat.name,
                    finalLeg: boat.leg,
                    finalPos: { x: boat.x, y: boat.y },
                    finalSpeed: boat.speed,
                    ocs: boat.ocs,
                    resultStatus: boat.resultStatus,
                    prestartPhase: boat.prestartPhase,
                    track: boat.diagTrack
                });
            }
        });

        if ((i + 1) % 25 === 0) {
            console.log(`  ${i + 1}/${NUM_TRIALS} trials | DNS so far: ${dnsBoats}/${totalBoats}`);
        }
    }

    await browser.close();

    const dnsPct = totalBoats > 0 ? (dnsBoats / totalBoats * 100) : 0;
    console.log("\n=== DNS HUNT RESULTS ===");
    console.log(`Total boats: ${totalBoats}`);
    console.log(`DNS boats:   ${dnsBoats} (${dnsPct.toFixed(3)}%)`);
    console.log(`DNS seeds:   ${[...new Set(dnsCases.map(c => c.seed))].join(', ') || '(none)'}`);

    // Print compact summary of each DNS case
    dnsCases.forEach(c => {
        const tr = c.track || [];
        const last = tr[tr.length - 1];
        // Movement range over the tracked window
        let stuck = 'n/a';
        if (tr.length > 2) {
            const xs = tr.map(p => p.x), ys = tr.map(p => p.y);
            const span = Math.round(Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
            const ocsFrac = (tr.filter(p => p.ocs).length / tr.length).toFixed(2);
            stuck = `span=${span} ocsFrac=${ocsFrac} samples=${tr.length}`;
        }
        console.log(`\nseed ${c.seed} | ${c.name} (id ${c.id}) | leg=${c.finalLeg} ocs=${c.ocs} status=${c.resultStatus} phase=${c.prestartPhase}`);
        console.log(`  finalPos=(${c.finalPos.x},${c.finalPos.y}) spd=${c.finalSpeed} | ${stuck}`);
    });

    fs.writeFileSync(OUT_FILE, JSON.stringify({
        config: { trials: NUM_TRIALS, seedBase: SEED_BASE, timeLimit: TIME_LIMIT },
        summary: { totalBoats, dnsBoats, dnsPct },
        dnsCases
    }, null, 2));
    console.log(`\nWrote ${OUT_FILE}`);
})();
