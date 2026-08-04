// Diagnostic: locate the source of trace non-determinism.
//
//   node regatta/eval/_det.js repeat <venue> <n> <time>     same venue N times, one page
//   node regatta/eval/_det.js seq <v1,v2,...> <time>        venue sequence, then repeat last
//   node regatta/eval/_det.js fresh <venue> <n> <time>      N times, each in a FRESH page
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const MODE = process.argv[2] || 'repeat';
const HARNESS = fs.readFileSync('regatta/eval/trace_harness.js', 'utf8');

async function newPage(browser) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('  PAGE ERROR:', e.message));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.addScriptTag({ content: HARNESS });
    return page;
}
async function run(page, venue, time) {
    await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
    return page.evaluate(([t]) => window.traceHarness.runTrace(4242, { timeLimit: t }), [time]);
}

(async () => {
    const browser = await chromium.launch();

    if (MODE === 'repeat' || MODE === 'fresh') {
        const venue = process.argv[3] || 'seatrials';
        const n = parseInt(process.argv[4] || '3', 10);
        const time = parseInt(process.argv[5] || '300', 10);
        console.log(`${MODE}: ${venue} x${n} @${time}s`);
        let page = MODE === 'repeat' ? await newPage(browser) : null;
        const hashes = [];
        for (let i = 0; i < n; i++) {
            if (MODE === 'fresh') { if (page) await page.close(); page = await newPage(browser); }
            const r = await run(page, venue, time);
            hashes.push(r.behaviorHash);
            console.log(`  run${i + 1}: ${r.behaviorHash}`);
        }
        console.log(`  stable: ${hashes.every(h => h === hashes[0])}`);
    }

    if (MODE === 'seq') {
        const seq = (process.argv[3] || 'bay,seatrials').split(',');
        const time = parseInt(process.argv[4] || '300', 10);
        const target = seq[seq.length - 1];
        console.log(`seq: ${seq.join(' -> ')} @${time}s, then ${target} again`);
        const page = await newPage(browser);
        let first = null;
        for (const v of seq) {
            const r = await run(page, v, time);
            console.log(`  ${v.padEnd(12)} ${r.behaviorHash}`);
            if (v === target && first === null) first = r.behaviorHash;
        }
        const again = await run(page, target, time);
        console.log(`  ${target.padEnd(12)} ${again.behaviorHash}  (repeat)`);
        console.log(`  target stable across repeat: ${first === again.behaviorHash}`);

        const solo = await run(await newPage(browser), target, time);
        console.log(`  ${target.padEnd(12)} ${solo.behaviorHash}  (fresh page, solo)`);
        console.log(`  matches solo baseline:       ${first === solo.behaviorHash}`);
    }

    await browser.close();
})();
