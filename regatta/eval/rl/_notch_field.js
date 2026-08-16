// What does the world look like INSIDE island 8's notch (4254,-3474)?
// Samples the wind field (mean + live), current, clearance field and polar
// achievable speed on a small grid around the trap, plus the no-go cone vs the
// stream direction. Static probe — no race, just the world at t=0 and t=120.
//   node _notch_field.js <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeR15U');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), 'river');
    const out = await p.evaluate(() => {
        window.evalHarness.seed = 9408; window.resetGame(); window.startRace();
        const L = [];
        const TX = 4254, TY = -3474;
        const g = state.course.botGrid;
        if (g && !g._clear && window.SailCheck && window.SailCheck.clearanceField)
            g._clear = window.SailCheck.clearanceField(g);
        const samp = (label) => {
            L.push('== ' + label);
            for (const [dx, dy] of [[0,0],[30,0],[-30,0],[0,30],[0,-30],[60,30],[60,-30],[90,0],[120,0],[150,0],[60,60],[-60,0],[0,-90],[90,-90],[150,-150]]) {
                const x = TX + dx, y = TY + dy;
                const w = getWindAt(x, y);
                const c = (typeof getCurrentAt === 'function') ? getCurrentAt(x, y) : null;
                const cc = g ? g.cell(x, y) : null;
                const open = cc ? (g.at(cc[0], cc[1]) ? 1 : 0) : '-';
                const clr = (cc && g._clear) ? g._clear[cc[1] * g.n + cc[0]] : '-';
                // best achievable through-water speed (u/s) across TWA 0.6..2.8
                let best = 0, bestT = 0;
                for (let t = 0.6; t <= 2.9; t += 0.1) {
                    const s = getTargetSpeed(t, false, w.speed) * 15;
                    if (s > best) { best = s; bestT = t; }
                }
                // net escape-ability upstream: achievable at TWA of the up-current bearing
                const curDir = c ? Math.atan2(c.vx || Math.sin(c.direction || 0), -(c.vy != null ? -c.vy : Math.cos(c.direction || 0))) : null;
                L.push([`d(${String(dx).padStart(4)},${String(dy).padStart(4)})`, 'open', open, 'clr', clr,
                    'wind', w.speed.toFixed(1) + 'kt@' + w.direction.toFixed(2),
                    'cur', c ? ((c.speed || 0).toFixed(1) + 'kt@' + (c.direction != null ? c.direction.toFixed(2) : Math.atan2(c.vx, -c.vy).toFixed(2))) : '-',
                    'bestTW', best.toFixed(0) + 'u/s@twa' + bestT.toFixed(1)].join(' '));
            }
        };
        samp('t=0 (gun)');
        // advance the world two minutes so the oscillator/gusts move
        const dt = 1 / 60;
        for (let i = 0; i < 60 * 120; i++) window.update(dt);
        samp('t=120');
        for (let i = 0; i < 60 * 120; i++) window.update(dt);
        samp('t=240');
        return L;
    });
    for (const l of out) console.log(Array.isArray(l) ? l.join(' ') : l);
    await b.close();
})();
