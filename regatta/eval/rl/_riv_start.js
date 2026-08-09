// RIVER START RESEARCH — the gap ledger found the fleet crossing the start
// line med ~32s after the gun in the human's river race (she crossed at ~1s;
// five of nine rivals were 300-550u behind the line at the gun moving ~2kt).
// Hypothesis: the staged-start's crossing-run estimate (getApproachTime on
// boat speed + stats) carries NO current term — in a 3-5kt set the run takes
// 2-3x the estimate. Measure live, per bot: distance behind the line at the
// gun, speed at the gun, current at the boat, gun-to-cross time, OCS.
// Control venue comparison shows what a healthy start looks like.
//   node _riv_start.js <trials> <seed0> <tree> [venue=river]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBP2');
const VENUE = process.argv[5] || 'river';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(v => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            let gun = null;
            const info = bots.map(b => ({ name: b.name, atGun: null, cross: null, ocs: 0 }));
            for (let it = 0; it < 60 * 200; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (gun == null) {
                    gun = t;
                    for (let k = 0; k < bots.length; k++) {
                        const b = bots[k];
                        const cur = (typeof getCurrentAt === 'function') ? getCurrentAt(b.x, b.y) : null;
                        info[k].atGun = {
                            x: +b.x.toFixed(0), y: +b.y.toFixed(0), kt: +(b.speed * 4).toFixed(1),
                            leg: b.raceState.leg,
                            curKt: cur ? +cur.speed.toFixed(1) : 0,
                            curDir: cur ? +cur.direction.toFixed(2) : null
                        };
                    }
                }
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    if (info[k].cross == null && b.raceState.leg >= 1) info[k].cross = +t.toFixed(1);
                    if (b.raceState.ocs) info[k].ocs = 1;
                }
                if (t > 150) break;
            }
            const line = state.course.dmc && state.course.dmc.legs[0]
                ? state.course.dmc.legs[0].pts.map(p => [Math.round(p.x), Math.round(p.y)]) : null;
            return { info, line };
        }, seed);
        for (const x of r.info) rows.push(x);
        const cr = r.info.map(x => x.cross).filter(x => x != null).sort((a, b) => a - b);
        console.log('seed', seed, 'gun-to-cross:', JSON.stringify(r.info.map(x => x.cross)),
            ' line:', JSON.stringify(r.line));
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const crossed = rows.filter(x => x.cross != null);
    console.log(`\n${VENUE}: ${rows.length} bot-starts, crossed in-window ${crossed.length}`);
    console.log('  gun-to-cross med', med(crossed.map(x => x.cross)), ' p90',
        crossed.map(x => x.cross).sort((a, b) => a - b)[Math.floor(crossed.length * 0.9)]);
    console.log('  at gun: kt med', med(rows.map(x => x.atGun.kt)),
        ' current at boat med', med(rows.map(x => x.atGun.curKt)), 'kt');
    const late = rows.filter(x => x.cross == null || x.cross > 20);
    console.log('  late (>20s or never):', late.length, 'of', rows.length);
    if (late.length) {
        console.log('  late at-gun anatomy: kt med', med(late.map(x => x.atGun.kt)),
            ' curKt med', med(late.map(x => x.atGun.curKt)),
            ' sample positions:', JSON.stringify(late.slice(0, 6).map(x => [x.atGun.x, x.atGun.y, x.atGun.kt])));
    }
    console.log('  OCS:', rows.filter(x => x.ocs).length);
    await browser.close();
})();
