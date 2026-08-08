// P0 design measurement — ring clearance profile around each redrock mark.
// For BUILD-2 sizing (orbit-water cap): at each radius, what fraction of a
// 32-point ring is navigable water, and per-sector wall distance. The armed
// orbit's stock allowances (zone*0.85 carrot, zone*1.6 outward cap, zone*1.7
// exit punch) assume the ring is water; this prints what actually is.
//   node _rr_ringclear.js <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeP4FINAL');
const VENUE = process.argv[3] || 'redrock';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(v => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(() => {
        window.evalHarness.seed = 9400;
        window.resetGame(); window.startRace();
        const g = state.course.botGrid;
        const out = [];
        (state.course.marks || []).forEach((m, i) => {
            const rows = [];
            for (const R of [60, 80, 100, 120, 140, 165, 200, 235, 264, 280, 320, 400]) {
                let clear = 0;
                for (let k = 0; k < 32; k++) {
                    const a = k / 32 * Math.PI * 2;
                    const c = g.cell(m.x + Math.cos(a) * R, m.y + Math.sin(a) * R);
                    if (g.at(c[0], c[1])) clear++;
                }
                rows.push(`${R}:${(clear / 32 * 100).toFixed(0)}%`);
            }
            // per-sector wall distance: first non-water radius along each of 16 radials
            const walls = [];
            for (let k = 0; k < 16; k++) {
                const a = k / 16 * Math.PI * 2;
                let w = '>500';
                for (let R = 50; R <= 500; R += 15) {
                    const c = g.cell(m.x + Math.cos(a) * R, m.y + Math.sin(a) * R);
                    if (!g.at(c[0], c[1])) { w = R; break; }
                }
                walls.push(`${Math.round(a * 180 / Math.PI)}°:${w}`);
            }
            out.push({ i, x: m.x, y: m.y, side: m.side, zone: m.zone,
                reqSweep: m.reqSweep != null ? Math.round(m.reqSweep * 180 / Math.PI) : null,
                rings: rows.join(' '), walls: walls.join(' ') });
        });
        return out;
    });
    for (const m of r) {
        console.log(`\nmark ${m.i} (${m.x},${m.y}) side=${m.side} zone=${m.zone} reqSweep=${m.reqSweep}`);
        console.log('  ring clear%: ' + m.rings);
        console.log('  wall dist by radial: ' + m.walls);
    }
    await browser.close();
})();
