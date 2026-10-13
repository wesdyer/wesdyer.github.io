// PT-025: the Time Trial board's venue tiles carry your best time on EVERY venue (gold where it is a
// record), whichever venue is selected. Seeds trial bests, opens the board, picks another venue.
//   node regatta/eval/rl/_venue_tiles.js <outdir>
const { chromium } = require('playwright'); const path = require('path');
const S = (process.argv[2] || '.') + '/';
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_progress', JSON.stringify({ graduated: true })));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
    await p.evaluate(() => {
        // two records (under the time to beat), one best that is not yet, keyed with each venue's OWN leg count
        const seed = { bay: -18.6, otter: -4.2, lake: +12.9 }, legs = { bay: 6, otter: 2, lake: 3 }, B = {};
        for (const [v, d] of Object.entries(seed)) B[`${v}:${recordsVenueHash(v)}:${legs[v]}`] = { t: (provisionalRecord(v) || 240) + d };
        localStorage.setItem('regatta_bests', JSON.stringify(B));
        settings.lastRaceVenue = 'bay';
        document.getElementById('door-race').click();
    });
    await p.waitForTimeout(2500);
    const read = () => p.evaluate(() => [...document.querySelectorAll('#venue-picker .pr-venue-tile')].map(t => ({ v: t.dataset.venue, sel: t.classList.contains('sel'), badge: t.querySelector('.pr-venue-stars').style.display === 'none' ? '' : t.querySelector('.pr-venue-stars').textContent })).filter(x => x.badge || x.sel));
    console.log('bay selected :', JSON.stringify(await read()));
    await p.screenshot({ path: S + 'tiles_bay.png' });
    await p.evaluate(() => selectVenue('volcanic')); await p.waitForTimeout(2500);
    console.log('volcanic sel :', JSON.stringify(await read()));
    await p.screenshot({ path: S + 'tiles_volcanic.png' });
    await b.close();
})();
