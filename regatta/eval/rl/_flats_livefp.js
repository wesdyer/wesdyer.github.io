// WHAT STAMP DOES THE GAME PUT ON A FLATS LAP? (2026-09-16, the flats intake)
// The recorder hashes the LIVE `window.VENUE_DOC[venue]` (telemetry.js), and
// migrateVenueDoc mutates the doc in place on the way out — so a lap's stamp can
// differ from the FILE's stamp (what _traj_fp.js computes offline) without the
// course having moved. This loads the shipping page on a venue and prints the
// stamp before and after resetGame, so an "unknown" lap stamp can be adjudicated.
//   node _flats_livefp.js [venue] [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'flats';
const ROOT = path.join(__dirname, process.argv[3] || '../../..');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate((v) => {
        const djb = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(16) + ':' + str.length; };
        const before = djb(JSON.stringify(window.VENUE_DOC[v]));
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
        window.evalHarness.seed = 1;
        window.resetGame();
        const after = djb(JSON.stringify(window.VENUE_DOC[v]));
        window.startRace();
        const afterStart = djb(JSON.stringify(window.VENUE_DOC[v]));
        return { before, after, afterStart, venue: settings.venue, keys: Object.keys(window.VENUE_DOC[v]).join(',') };
    }, VENUE);
    console.log(JSON.stringify(r, null, 1));
    await browser.close();
})();
