// THE PICTURE: where the fleet actually sails, drawn over the wind it sails in, with a
// human recording laid on top of the same water.
//
// Prints one ASCII map per requested layer:
//   WIND   speed bands over navigable water (blank <1 kt ... @ >=9)
//   FLEET  cells the bots occupied, digit = how many boat-samples landed there
//   HUMAN  the same for a recorded human track (pass a traj json)
//   BOTH   H where the human went, o where the fleet went, X where both did
//
//   node _tracks.js <tree> <venue> <seed> [humanTraj.json] [cols]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeHEAD');
const VENUE = process.argv[3] || 'lake';
const SEED = parseInt(process.argv[4] || '9100');
const HUMAN = process.argv[5] && process.argv[5] !== '-' ? process.argv[5] : null;
const COLS = parseInt(process.argv[6] || '92');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(async ({ seed, cols }) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
        const g = state.course.botGrid;
        const ex = window.Arena.extent(state.course.boundary);
        const w = ex.maxX - ex.minX, h = ex.maxY - ex.minY;
        const step = w / cols, rows = Math.max(8, Math.round(h / step / 2)), rowH = h / rows;
        const idx = (x, y) => {
            const i = Math.floor((x - ex.minX) / step), j = Math.floor((y - ex.minY) / rowH);
            return (i < 0 || j < 0 || i >= cols || j >= rows) ? -1 : j * cols + i;
        };
        // wind layer
        const wind = new Array(cols * rows).fill('#');
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const x = ex.minX + (i + 0.5) * step, y = ex.minY + (j + 0.5) * rowH;
            const c = g ? g.cell(x, y) : null;
            if (g && !g.at(c[0], c[1])) continue;
            const s = getWindAt(x, y).speed;
            wind[j * cols + i] = s < 1 ? ' ' : s < 2 ? '.' : s < 3 ? ':' : s < 4 ? '-'
                : s < 5 ? '=' : s < 6 ? '+' : s < 7 ? '*' : s < 8 ? 'o' : s < 9 ? 'O' : '@';
        }
        // run and sample
        const occ = new Int32Array(cols * rows);
        const slowOcc = new Int32Array(cols * rows);   // samples below 1.5 kt
        const dt = 1 / 60; let acc = 0;
        const legT = {};
        for (let it = 0; it < 60 * 940; it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            if (state.race.timer > 900) break;
            if (++acc >= 30) {
                acc = 0;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const k = idx(b.x, b.y);
                    if (k >= 0) { occ[k]++; if (b.speed / 0.25 < 1.5) slowOcc[k]++; }
                }
            }
            if (bots.every(b => b.raceState.finished)) break;
        }
        const fins = bots.filter(b => b.raceState.finished).map(b => Math.round(b.raceState.finishTime));
        return { cols, rows, step, rowH, ex: { minX: ex.minX, minY: ex.minY },
                 wind, occ: Array.from(occ), slowOcc: Array.from(slowOcc),
                 fins: fins.sort((a, b) => a - b),
                 marks: (state.course.marks || []).map(m => [m.id || '', m.x, m.y]) };
    }, { seed: SEED, cols: COLS });

    const put = (arr, i, ch) => { if (i >= 0) arr[i] = ch; };
    const draw = (cells) => {
        const out = [];
        for (let j = 0; j < r.rows; j++) out.push(cells.slice(j * r.cols, (j + 1) * r.cols).join(''));
        return out.join('\n');
    };
    const toIdx = (x, y) => {
        const i = Math.floor((x - r.ex.minX) / r.step), j = Math.floor((y - r.ex.minY) / r.rowH);
        return (i < 0 || j < 0 || i >= r.cols || j >= r.rows) ? -1 : j * r.cols + i;
    };
    // human track
    let hset = null;
    if (HUMAN) {
        const d = JSON.parse(fs.readFileSync(HUMAN, 'utf8'));
        const F = {}; d.format.forEach((n, i) => { F[n.split(/[\[(<]/)[0]] = i; });
        hset = new Set();
        for (const s of d.samples) {
            if (s[F.phase] !== 1) continue;
            const k = toIdx(s[F.x], s[F.y]);
            if (k >= 0) hset.add(k);
        }
    }
    console.log('== WIND (%s seed %d)  cell %du x %du   blank<1 .<2 :<3 -<4 =<5 +<6 *<7 o<8 O<9 @>=9  # land',
        VENUE, SEED, Math.round(r.step), Math.round(r.rowH));
    const windCells = r.wind.slice();
    for (const [id, x, y] of r.marks) put(windCells, toIdx(x, y), 'M');
    console.log(draw(windCells));
    console.log('\n== FLEET OCCUPANCY (digit = boat-samples/4, capped; ! = >=25%% of them below 1.5 kt)');
    const occCells = r.wind.map((c, i) => {
        if (c === '#') return '#';
        const n = r.occ[i];
        if (!n) return ' ';
        if (r.slowOcc[i] >= n * 0.25) return '!';
        const v = Math.min(9, Math.ceil(n / 4));
        return String(v);
    });
    for (const [id, x, y] of r.marks) put(occCells, toIdx(x, y), 'M');
    console.log(draw(occCells));
    if (hset) {
        console.log('\n== HUMAN vs FLEET   H = human only, o = fleet only, X = both, . = neither (water)');
        const bothCells = r.wind.map((c, i) => {
            if (c === '#') return '#';
            const f = r.occ[i] > 0, hh = hset.has(i);
            return hh && f ? 'X' : hh ? 'H' : f ? 'o' : '.';
        });
        for (const [id, x, y] of r.marks) put(bothCells, toIdx(x, y), 'M');
        console.log(draw(bothCells));
    }
    console.log('\nfleet finishes: ' + r.fins.join(','));
    await browser.close();
})();
