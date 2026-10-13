// A Race of ONE, end to end: the board, the pause menu, the abandon confirm, the results page.
//   node regatta/eval/rl/_one_race.js <outdir> [n=1]
const { chromium } = require('playwright'); const path = require('path');
const S = (process.argv[2] || '.') + '/'; const N = +(process.argv[3] || 1);
(async () => {
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.addInitScript(() => { localStorage.setItem('regatta_progress', JSON.stringify({ graduated: true })); });
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
    await p.evaluate(() => document.getElementById('door-series').click()); await p.waitForTimeout(500);
    await p.screenshot({ path: S + 'picker.png' });
    await p.evaluate(N => { Series.startSeries(['bay', 'lake', 'otter', 'swamp'].slice(0, N)); TimeTrial.active = false; enterSeriesRace(); }, N);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: S + 'board.png' });
    await p.evaluate(() => startRace()); await p.waitForTimeout(4000);
    await p.evaluate(() => togglePause(true)); await p.waitForTimeout(300);
    await p.screenshot({ path: S + 'pause.png' });
    console.log('pause:', await p.evaluate(() => ({ abandon: UI.abandonLabel.textContent, restartHidden: UI.restartButton.classList.contains('hidden'), ctx: UI.pauseContext.textContent })));
    await p.evaluate(() => toggleAbandon(true)); await p.waitForTimeout(300);
    await p.screenshot({ path: S + 'abandon.png' });
    console.log('abandon:', await p.evaluate(() => UI.abandonScreen.innerText.replace(/\s+/g, ' ')));
    await p.evaluate(() => toggleAbandon(false));
    // restart: the same race again, the same fleet, still a Race of one
    await p.evaluate(() => UI.restartButton.click()); await p.waitForTimeout(2500);
    console.log('after restart:', await p.evaluate(() => ({ status: state.race.status, venue: state.race.venue, series: Series.active && Series.total(), boats: state.boats.length, paused: state.paused })));
    await b.close();
})();
