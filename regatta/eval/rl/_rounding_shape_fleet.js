// FLEET ROUNDING SHAPE — same metrics as _rounding_shape.py's human side.
// Per armed window per bot: closest approach to the leg's rounding mark, approach
// speed (3s before closest), speed at mark, exit speed (3s after), seconds within
// 1.5x zone, tack count, peak turn rate.
//   node _rounding_shape_fleet.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeMETER2');
const VENUE = process.argv[5] || 'bay';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const wins = new Map();   // boat -> current armed window rows
            const done = [];
            const dt = 1 / 60; let acc = 0;
            const closeWin = (b) => {
                const w = wins.get(b);
                wins.delete(b);
                if (!w || w.rows.length < 9) return;
                done.push(w);
            };
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++acc < 6) continue;
                acc = 0;
                for (const b of bots) {
                    if (b.raceState.finished) { closeWin(b); continue; }
                    if (b.raceState.roundArmed) {
                        let w = wins.get(b);
                        if (!w) {
                            const rm = (typeof legRoundMark === 'function' && legRoundMark(b.raceState.leg))
                                || state.course.roundMark;
                            if (!rm) continue;
                            w = { mk: { x: rm.x, y: rm.y, zone: rm.zone || 150 }, rows: [] };
                            wins.set(b, w);
                        }
                        let dh = 0;
                        if (w.rows.length) {
                            dh = Math.abs(b.heading - w.rows[w.rows.length - 1][3]) % (2 * Math.PI);
                            if (dh > Math.PI) dh = 2 * Math.PI - dh;
                        }
                        w.rows.push([state.race.timer, Math.hypot(b.x - w.mk.x, b.y - w.mk.y),
                                     b.speed, b.heading, window.Rules ? window.Rules.getTack(b) : 0,
                                     dh / 0.1 * 57.3]);
                    } else closeWin(b);
                }
            }
            for (const b of bots) closeWin(b);
            return done.map(w => {
                const rows = w.rows;
                let ci = 0;
                for (let k = 1; k < rows.length; k++) if (rows[k][1] < rows[ci][1]) ci = k;
                if (rows[ci][1] > 400) return null;
                const t0 = rows[ci][0];
                const pre = rows.filter(r => r[0] >= t0 - 3 && r[0] < t0).map(r => r[2]);
                const post = rows.filter(r => r[0] > t0 && r[0] <= t0 + 3).map(r => r[2]);
                const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
                let tacks = 0;
                for (let k = 1; k < rows.length; k++)
                    if (rows[k][4] && rows[k - 1][4] && rows[k][4] !== rows[k - 1][4]) tacks++;
                return { minD: Math.round(rows[ci][1]), app: mean(pre), atMark: rows[ci][2],
                         exit: mean(post), near: rows.filter(r => r[1] < w.mk.zone * 1.5).length * 0.1,
                         tacks, peakTurn: Math.max(...rows.map(r => r[5])) };
            }).filter(Boolean);
        }, SEED0 + i);
        all.push(...r);
        console.log(`seed ${SEED0 + i}: ${r.length} roundings`);
    }
    const ok = all.filter(r => r.app && r.app > 0.1);
    const med = k => { const s = ok.map(r => r[k]).sort((a, b) => a - b); return s[s.length >> 1]; };
    console.log(`\n${VENUE} FLEET: ${ok.length} roundings | minD med ${med('minD')}u | ` +
        `approach ${med('app').toFixed(2)} -> at-mark ${med('atMark').toFixed(2)} -> exit ${med('exit').toFixed(2)} kt ` +
        `(carry ${(100 * med('atMark') / Math.max(0.01, med('app'))).toFixed(0)}%) | ` +
        `near-zone ${med('near').toFixed(1)}s | tacks med ${med('tacks')} | peak turn ${med('peakTurn').toFixed(0)} deg/s`);
    console.log('(human: bay minD 47u carry 99% near 4.1s tacks 1 peak 55 | redrock 62u/98%/3.5s/0/56 | lake 48u/97%/5.5s/0/53)');
    await browser.close();
})();
