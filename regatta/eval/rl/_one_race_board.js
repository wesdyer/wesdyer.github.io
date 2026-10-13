// The board for a Race of one at several window sizes (side by side when wide, stacked when not).
//   node regatta/eval/rl/_one_race_board.js <outdir> [n=1]
const { chromium } = require('playwright'); const path = require('path');
const S = (process.argv[2] || '.') + '/'; const N = +(process.argv[3] || 1);
(async () => {
    const b = await chromium.launch();
    for (const [w, h] of [[1600, 1000], [1280, 800], [1920, 1080], [1000, 1100], [1440, 760]]) {
        const p = await b.newPage({ viewport: { width: w, height: h } });
        p.on('pageerror', e => console.log('PAGE ERROR', e.message));
        await p.addInitScript(() => { localStorage.setItem('regatta_progress', JSON.stringify({ graduated: true })); });
        await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1200);
        // a past: a trial time and a 2nd place with two stars at the cove (the race board shows the place, never the clock)
        await p.evaluate(() => { const b = {}; b['bay:' + recordsVenueHash('bay') + ':6'] = { t: 236.683, bestPos: 2, stars: 2 }; localStorage.setItem('regatta_bests', JSON.stringify(b)); });
        await p.evaluate(N => { Series.startSeries(['bay', 'lake', 'otter', 'swamp'].slice(0, N)); TimeTrial.active = false; enterSeriesRace(); }, N);
        await p.waitForTimeout(2200);
        console.log(w + 'x' + h, await p.evaluate(() => { const r = id => { const q = document.getElementById(id).getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round).join(','); }; return document.getElementById('venue-stage').dataset.mode + ' map ' + r('venue-course-box') + ' hero ' + r('venue-hero'); }));
        await p.screenshot({ path: S + `board_${N}_${w}x${h}.png` });
        await p.close();
    }
    await b.close();
})();
