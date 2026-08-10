// ASCII map of a redrock box: nav grid (#=land/unsailable, .=water), the
// leg polyline (numbers = leg index points), marks (M), and optionally the
// parked-boat cluster from the DNF class. Pure geometry — no race sim.
//   node _rr_map.js <venue> <leg> <x0> <y0> <x1> <y1> [tree] [cell=50]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const LEG = parseInt(process.argv[3]) || 3;
const BOX = process.argv.slice(4, 8).map(Number);
const ROOT = path.join(__dirname, process.argv[8] || 'treeH3');
const CELL = parseInt(process.argv[9]) || 50;
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const out = await p.evaluate(({ BOX, LEG, CELL }) => {
        window.evalHarness.seed = 1;
        window.resetGame(); window.startRace();
        const g = state.course.botGrid;
        const legs = state.course.dmc && state.course.dmc.legs;
        const pts = legs && legs[LEG] ? legs[LEG].pts : [];
        const marks = state.course.marks.map(m => ({ id: m.id, x: m.x, y: m.y, zone: m.zone }));
        const rows = [];
        for (let y = BOX[1]; y <= BOX[3]; y += CELL) {
            let row = '';
            for (let x = BOX[0]; x <= BOX[2]; x += CELL) {
                const cc = g.cell(x, y);
                let ch = g.at(cc[0], cc[1]) ? '.' : '#';
                if (ch === '.') {
                    const id = cc[1] * g.n + cc[0];
                    if (g._soft && g._soft[id]) ch = '~';
                    else if (g._clear) { const cl = g._clear[id]; if (cl > 0 && cl < 3) ch = ','; }
                }
                for (const m of marks) if (Math.hypot(m.x - x, m.y - y) < CELL * 0.7) ch = 'M';
                for (const q of pts) if (Math.hypot(q.x - x, q.y - y) < CELL * 0.6) ch = '*';
                row += ch;
            }
            rows.push(`y=${String(y).padStart(6)} ${row}`);
        }
        return { rows, marks: marks.filter(m => m.x >= BOX[0] - 400 && m.x <= BOX[2] + 400 && m.y >= BOX[1] - 400 && m.y <= BOX[3] + 400), nPts: pts.length };
    }, { BOX, LEG, CELL });
    await b.close();
    console.log(`map ${VENUE} leg ${LEG} box [${BOX}] cell ${CELL} (#land .water ,low-clear ~soft *legpath Mmark)`);
    console.log('x from', BOX[0], 'to', BOX[2]);
    for (const r of out.rows) console.log(r);
    console.log('marks nearby:', JSON.stringify(out.marks));
})();
