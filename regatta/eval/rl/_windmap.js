// WHERE THE GLASS IS. A coarse ASCII map of wind speed over a venue's water, so a
// light-air course can be read the way a sailor reads it: which side has pressure,
// where the holes sit, and whether the rhumb line runs through one.
//   node _windmap.js <tree> [venue] [seed] [cols]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeHEAD');
const VENUE = process.argv[3] || 'lake';
const SEED = parseInt(process.argv[4] || '9100');
const COLS = parseInt(process.argv[5] || '68');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(({ seed, cols }) => {
        window.evalHarness.seed = seed;
        window.resetGame();
        const g = state.course.botGrid;
        const ex = window.Arena.extent(state.course.boundary);
        const w = ex.maxX - ex.minX, h = ex.maxY - ex.minY;
        const step = w / cols, rows = Math.max(8, Math.round(h / step / 2));   // chars are ~2:1
        const grid = [];
        for (let j = 0; j < rows; j++) {
            let line = '';
            for (let i = 0; i < cols; i++) {
                const x = ex.minX + (i + 0.5) * step;
                const y = ex.minY + (j + 0.5) * (h / rows);
                const c = g ? g.cell(x, y) : null;
                if (g && !g.at(c[0], c[1])) { line += '#'; continue; }
                const s = getWindAt(x, y).speed;
                line += s < 1 ? ' ' : s < 2 ? '.' : s < 3 ? ':' : s < 4 ? '-'
                    : s < 5 ? '=' : s < 6 ? '+' : s < 7 ? '*' : s < 8 ? 'o' : s < 9 ? 'O' : '@';
            }
            grid.push(line);
        }
        // mark/gate positions in map coordinates
        const pins = [];
        for (const m of (state.course.marks || [])) {
            pins.push([m.id || m.kind || '?', Math.round((m.x - ex.minX) / step),
                       Math.round((m.y - ex.minY) / (h / rows))]);
        }
        return { grid, pins, ex: { minX: Math.round(ex.minX), minY: Math.round(ex.minY) },
                 step: Math.round(step), rowH: Math.round(h / rows),
                 base: +state.wind.baseSpeed.toFixed(1),
                 baseDir: +(state.wind.baseDirection * 180 / Math.PI).toFixed(0) };
    }, { seed: SEED, cols: COLS });
    // overlay the marks
    const g = r.grid.map(s => s.split(''));
    for (let k = 0; k < r.pins.length; k++) {
        const [, i, j] = r.pins[k];
        if (g[j] && g[j][i] !== undefined) g[j][i] = String.fromCharCode(49 + k);
    }
    console.log('%s  base %s kt  dir %s deg   cell %su x %su   legend: (blank)<1 . <2 : <3 - <4 = <5 + <6 * <7 o <8 O <9 @ >=9   # land',
        VENUE, r.base, r.baseDir, r.step, r.rowH);
    console.log(g.map(a => a.join('')).join('\n'));
    console.log('marks (1..n in map): ' + r.pins.map((p, k) => (k + 1) + '=' + p[0]).join(' '));
    await browser.close();
})();
