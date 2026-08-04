// 1Hz steering-chain trace of ONE bot in a window — the goal/navT/strH/tgt
// format that cracked #11, plus wall/floe context from the grid.
//   node wall_trace.js <seed> <botName> <t0> <t1> [tree=treeA]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9100;
const BOT = process.argv[3] || 'Seam';
const T0 = parseInt(process.argv[4]) || 60, T1 = parseInt(process.argv[5]) || 200;
const ROOT = path.join(__dirname, process.argv[6] || 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = await page.evaluate(async ({ seed, bot, t0, t1 }) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
        const B = state.boats.find(b => !b.isPlayer && b.name.startsWith(bot));
        if (!B) return ['NO SUCH BOT'];
        const deg = r => Math.round(r * 180 / Math.PI);
        const rows = []; const dt = 1 / 60; let last = -999;
        for (let it = 0; it < 60 * (t1 + 40); it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            const t = state.race.timer;
            if (t > t1) break;
            if (t >= t0 && t - last >= 1) {
                last = t;
                const c = B.controller;
                const g = state.course.botGrid;
                // clear water distance along current heading (50u steps)
                let ahead = 0;
                if (g) for (let stp = 1; stp <= 10; stp++) {
                    const cc = g.cell(B.x + Math.sin(B.heading) * stp * 50, B.y - Math.cos(B.heading) * stp * 50);
                    if (!g.at(cc[0], cc[1])) break;
                    ahead += 50;
                }
                const lw = getWindAt(B.x, B.y);
                rows.push([Math.round(t),
                    'p(' + Math.round(B.x) + ',' + Math.round(B.y) + ')',
                    's' + B.speed.toFixed(2),
                    'hdg' + deg(B.heading), 'tgt' + (c.targetHeading != null ? deg(c.targetHeading) : '?'),
                    'twa' + deg(Math.abs(normalizeAngle(B.heading - (lw.direction + Math.PI)))),
                    'nav' + (c._lastNav ? '(' + Math.round(c._lastNav.x) + ',' + Math.round(c._lastNav.y) + ')' : '-'),
                    'ahead' + ahead,
                    'wg' + (c.wiggleActive ? 1 : 0) + ' ice' + (c.iceEscapeTimer > 0 ? c.iceEscapeTimer.toFixed(1) : 0)
                    + ' tf' + (c._trajFloe ? 1 : 0)
                    + ' col' + (B.ai.collisionData ? (B.ai.collisionData.isFloe ? 'F' : 'I') : '-')
                    + ' clT' + (c.clearanceTimer > 0 ? c.clearanceTimer.toFixed(1) : 0)
                    + ' low' + (c.lowSpeedTimer || 0).toFixed(1),
                ].join(' '));
            }
        }
        return rows;
    }, { seed: SEED, bot: BOT, t0: T0, t1: T1 });
    for (const r of rows) console.log(r);
    await browser.close();
})();
