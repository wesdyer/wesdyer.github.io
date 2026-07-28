// Arctic soak: measures how well the AI handles the pack. Reports median race
// time, groundings per boat, penalties per boat and DNF rate. Run it against
// different floe-speed constants to A/B the drift change.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPO = '/Users/wesdyer/Documents/GitHub/wesdyer.github.io';
const LABEL = process.argv[2] || 'run';
const TRIALS = parseInt(process.argv[3]) || 12;
const SEED0 = 4242;
const LIMIT = 600;

const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y);
    const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(REPO, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(REPO, 'regatta/eval/eval_harness.js'), 'utf8') });

    await page.evaluate(() => {
        const inner = window.evalHarness.handleEvent.bind(window.evalHarness);
        window.__ice = 0;
        window.evalHarness.handleEvent = (type, data) => {
            if (type === 'collision_island') window.__ice++;
            return inner(type, data);
        };
    });

    const times = [], ices = [], dnfs = [], pens = [];
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async ({ seed, limit }) => {
            window.__ice = 0;
            const out = await window.evalHarness.runTrial(seed, limit);
            return { out, ice: window.__ice, venue: settings.venue };
        }, { seed: SEED0 + i, limit: LIMIT });

        if (i === 0) console.log(`  (venue confirmed: ${r.venue})`);
        const boats = r.out.boats || [];
        const fin = boats.filter(b => b.finishTime != null);
        if (fin.length) times.push(med(fin.map(b => b.finishTime)));
        dnfs.push(boats.length ? (boats.length - fin.length) / boats.length : 0);
        pens.push(boats.reduce((s, b) => s + (b.penalties || 0), 0) / Math.max(1, boats.length));
        ices.push(r.ice / Math.max(1, boats.length));
    }

    console.log(`${LABEL.padEnd(18)} raceMed ${med(times).toFixed(1).padStart(7)}s   ` +
                `groundings/boat ${med(ices).toFixed(2).padStart(5)}   ` +
                `pen/boat ${med(pens).toFixed(2)}   DNF ${(med(dnfs) * 100).toFixed(0)}%`);
    await browser.close();
})();
