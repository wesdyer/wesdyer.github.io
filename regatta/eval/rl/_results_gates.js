// PT-026: the results chart must show the course — gates and marks — at a readable size, on the Time Trial
// page and the fleet results. Sails a short stretch headless so there is a track, stamps the finish, and
// shoots the map card.   node regatta/eval/rl/_results_gates.js <outdir> [venue=seatrials]
const { chromium } = require('playwright'); const path = require('path');
const S = (process.argv[2] || '.') + '/'; const V = process.argv[3] || 'seatrials';
(async () => {
    const b = await chromium.launch();
    for (const mode of ['trial', 'fleet']) {
        const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
        p.on('pageerror', e => console.log('PAGE ERROR', e.message));
        await p.addInitScript((V) => { localStorage.setItem('regatta_progress', JSON.stringify({ graduated: true })); localStorage.setItem('regatta_settings', JSON.stringify({ venue: V, musicEnabled: false, soundEnabled: false })); }, V);
        await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
        await p.evaluate(({ mode, V }) => {
            if (mode === 'trial') { TimeTrial.active = true; selectVenue(V); resetGame(); state.boats.length = 1; }
            else { TimeTrial.active = false; Series.startSeries([V]); enterSeriesRace(); }
            startRace();
            const me = state.boats[0]; me.controller = new BotController(me);
            while (state.race.status === 'prestart') update(1 / 30);
            for (let i = 0; i < 30 * 40; i++) { me.controller.update(1 / 30); const dd = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); }
            state.boats.forEach((bt, i) => { bt.raceState.finished = true; bt.raceState.finishTime = state.race.timer + i; bt.raceState.resultStatus = null; });
            showResults();
        }, { mode, V });
        await p.waitForTimeout(1200);
        const card = await p.$('#res-map-card'); await card.screenshot({ path: S + `gates_${V}_${mode}.png` });
        await p.close();
    }
    await b.close();
})();
