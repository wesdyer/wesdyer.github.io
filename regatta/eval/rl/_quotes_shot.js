// PT-080: each character's one line, where it shows — the character picker and a rival's scouting card.
//   node regatta/eval/rl/_quotes_shot.js <outdir>
const { chromium } = require('playwright'); const path = require('path');
const S = (process.argv[2] || '.') + '/';
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_progress', JSON.stringify({ graduated: true })));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html') + '?unlocks=off'); await p.waitForTimeout(1500);
    await p.evaluate(() => openCharacterPicker()); await p.waitForTimeout(1200);
    await p.screenshot({ path: S + 'quotes_picker.png' });
    await p.evaluate(() => { closeCharacterPicker(); Series.startSeries(['bay']); TimeTrial.active = false; enterSeriesRace(); showFleetPage({ from: 'board' }); });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const r = [...document.querySelectorAll('#fleet-overlay .pr-fleet-item:not(.me) > button')][0]; if (r) r.click(); });
    await p.waitForTimeout(500);
    await p.screenshot({ path: S + 'quotes_fleet.png' });
    await b.close();
})();
