// The Race picker's venue tiles carry the stars earned there (gold) out of four (dim), in PICK and RANDOM.
//   node regatta/eval/rl/_race_picker_stars.js <outdir>
const { chromium } = require('playwright'); const path = require('path');
const S = (process.argv[2] || '.') + '/';
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_progress', JSON.stringify({ graduated: true })));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
    await p.evaluate(() => {
        const seed = { bay: [1, 4], lake: [2, 0], otter: [1, 2], swamp: [1, 1], glowtide: [1, 3] }, B = {};
        for (const [v, [pos, st]] of Object.entries(seed)) B[`${v}:${recordsVenueHash(v)}:4`] = { bestPos: pos, stars: st };
        localStorage.setItem('regatta_bests', JSON.stringify(B));
        document.getElementById('door-series').click();
    });
    await p.waitForTimeout(600);
    await p.evaluate(() => { document.querySelector('.ch-pick[data-k="otter"]').click(); document.querySelector('.ch-pick[data-k="bay"]').click(); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: S + 'race_pick_stars.png' });
    await p.evaluate(() => document.querySelector('#series-mode .ch-mode[data-mode="draw"]').click()); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('#series-lengths .ch-len[data-n="6"]').click()); await p.waitForTimeout(500);
    await p.screenshot({ path: S + 'race_draw_stars.png' });
    await b.close();
})();
