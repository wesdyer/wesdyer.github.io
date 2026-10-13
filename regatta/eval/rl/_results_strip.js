// The results scorecard in each fleet context — a single race, a series race, a cup race —
// with the player first and mid-fleet. Finishes are stamped, not sailed, so it runs in seconds.
//   node regatta/eval/rl/_results_strip.js <outdir> [width=1600]
const { chromium } = require('playwright'); const path = require('path');
const S = (process.argv[2] || '.') + '/'; const W = +(process.argv[3] || 1600);
const cases = [
    { name: 'single_win', setup: 'one', pos: 1 },
    { name: 'single_7th', setup: 'one', pos: 7, pen: 1 },
    { name: 'series_win', setup: 'series', pos: 1, prior: 3 },
    { name: 'series_3rd', setup: 'series', pos: 3, prior: 1 },
    { name: 'cup_win', setup: 'cup', pos: 1, prior: 1 },
    { name: 'cup_2nd', setup: 'cup', pos: 2, prior: 1 },
];
(async () => {
    const b = await chromium.launch();
    for (const c of cases) {
        const p = await b.newPage({ viewport: { width: W, height: 1000 } });
        p.on('pageerror', e => console.log('PAGE ERROR', c.name, e.message));
        await p.addInitScript(() => { localStorage.setItem('regatta_progress', JSON.stringify({ graduated: true })); });
        await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1200);
        const out = await p.evaluate(c => {
            TimeTrial.active = false;
            if (c.setup === 'one') Series.startSeries(['bay']);
            else if (c.setup === 'series') Series.startSeries(['bay', 'lake', 'otter', 'swamp', 'river', 'ocean']);
            else Series.startCup(CUPS[0].id);
            enterSeriesRace(); startRace();
            // a race already sailed: the player placed `prior`
            if (c.setup !== 'one') {
                const names = state.boats.map(b => b.name), me = state.boats[0].name;
                const order = [...names.filter(n => n !== me)]; order.splice(c.prior - 1, 0, me);
                const fake = order.map((n, i) => ({ name: n, isPlayer: n === me, raceState: { finished: true, finishTime: 200 + i * 2, resultStatus: null, legTimes: [], totalPenalties: 0 } }));
                Series.recordRace(fake);
                Series.advance(); enterSeriesRace(); startRace();
            }
            while (state.race.status === 'prestart') update(1 / 30);
            for (let i = 0; i < 60; i++) update(1 / 30);
            // stamp the finish: the player at c.pos, everyone else around them
            const me = state.boats[0], others = state.boats.slice(1);
            const order = [...others]; order.splice(c.pos - 1, 0, me);
            order.forEach((bt, i) => { bt.raceState.finished = true; bt.raceState.finishTime = 203.491 + i * (i ? 1.7 : 0.6) + (i > 1 ? 0.6 : 0); bt.raceState.resultStatus = null; });
            me.raceState.totalPenalties = c.pen || 0;
            showResults();
            return { kind: Series.active && Series.active.kind, n: Series.total(), hero: document.getElementById('res-hero').innerText.replace(/\s+/g, ' ') };
        }, c);
        console.log(c.name.padEnd(12), JSON.stringify(out));
        await p.waitForTimeout(400);
        const el = await p.$('#res-hero'); await (await el.evaluateHandle(e => e.parentElement)).asElement().screenshot({ path: S + 'strip_' + c.name + '.png' });
        if (process.env.FULL) await p.screenshot({ path: S + 'page_' + c.name + '.png' });
        await p.close();
    }
    await b.close();
})();
