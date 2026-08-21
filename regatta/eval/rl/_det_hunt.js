// WALL TACK NONDET HUNT (2026-08-21, the swell-clock method): two pages,
// identical except for a WAIT between load and run (edit-time frames tick
// during the wait). __DETDBG snapshots every own-enumerable scalar on each
// lab boat + controller + raceState + ai at EVERY burst start; the fields
// that differ between the two pages' first-burst snapshots name the
// edit-time survivor the canon overlay misses.
//   node _det_hunt.js [waitMsA] [waitMsB]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { newLabPage } = require('../_drive');
const WA = parseInt(process.argv[2] || '0');
const WB = parseInt(process.argv[3] || '1500');

// the parked Wall Tack doc (strip the comment header + trailing comma)
const parked = fs.readFileSync(path.join(__dirname, '_walltack_parked.json.txt'), 'utf8');
const body = parked.slice(parked.indexOf('{')).trim().replace(/,\s*$/, '');
const doc = Function('return (' + body.slice(body.indexOf('{')) + ')')();

(async () => {
    const browser = await chromium.launch();
    const runPage = async (waitMs) => {
        const page = await newLabPage(browser);
        await page.evaluate((d) => {
            localStorage.setItem('regatta_scenarios', JSON.stringify({ 'Wall Tack': d }));
        }, doc);
        await page.reload();
        await page.waitForFunction(() => window.__LAB && window.__LAB.ready && window.__LAB.testAPI, null, { timeout: 60000 });
        await page.evaluate(() => { window.__DETDBG = 1; window.__LAB.testAPI.load('Wall Tack'); });
        if (waitMs) await page.waitForTimeout(waitMs);
        const out = await page.evaluate(() => {
            window.__LAB.recs = {};
            window.__LAB.testAPI.run();
            const LAB = window.__LAB;
            const r = LAB.recs[LAB.seeds[0] >>> 0];
            return { fin: r.frames[r.nF].boats.map(b => [Math.round(b.x), Math.round(b.y)]),
                     snaps: window.__DETSNAPS };
        });
        await page.close();
        return out;
    };
    const A = await runPage(WA);
    const B = await runPage(WB);
    console.log(`outcome A(wait ${WA}ms):`, JSON.stringify(A.fin));
    console.log(`outcome B(wait ${WB}ms):`, JSON.stringify(B.fin));
    console.log('outcomes differ:', JSON.stringify(A.fin) !== JSON.stringify(B.fin));
    // diff FIRST burst snapshots
    const sa = A.snaps[0], sb = B.snaps[0];
    let nDiff = 0;
    for (let i = 0; i < sa.length; i++) {
        for (const sec of ['boat', 'rs', 'ctl', 'ai']) {
            const a = sa[i][sec] || {}, b = sb[i][sec] || {};
            const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
            for (const k of keys) {
                const va = a[k], vb = b[k];
                const same = (typeof va === 'number' && typeof vb === 'number')
                    ? (Math.abs(va - vb) < 1e-12 || (Number.isNaN(va) && Number.isNaN(vb)))
                    : va === vb;
                if (!same) { nDiff++; console.log(`DIFF ${sa[i].n}.${sec}.${k}: A=${va} B=${vb}`); }
            }
        }
    }
    console.log(nDiff ? `${nDiff} differing field(s)` : 'FIRST-BURST SNAPSHOTS IDENTICAL — the survivor is NOT a boat/controller scalar');
    await browser.close();
})();
