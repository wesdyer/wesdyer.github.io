// DOES THE BOT GRID SEE THE WATER SHE SAILS? (2026-08-08 night, SECTION PUSH P3b)
// _riv_where.js put 90% of river leg 3's slow time in two subsections, and in both the
// human's line is on the opposite side of the river from where the bots stall. The
// clearance sample in _riv_line.js then read ZERO clear cells at her own crossing x —
// which, if true of `grid.at()` and not just of the clearance field, would be the CP1
// class inverted: the grid calling water land, where CP1 had it calling land water.
// That is a model-accuracy question (memory: regatta-model-accuracy) and it is decided
// by overlaying HER RECORDED TRACK on the grid she is not being routed through.
//
// Prints, over each pocket: a fine mesh of grid.at()/clearance, and then every human
// track sample in that pocket labelled with what the grid says about the cell she is
// actually sailing in. A human sample in a cell the grid calls HARD is proof.
//   node _riv_grid.js <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeCP1');
const FROZEN_FP = 'f2b03316:36253';
const POCKETS = [{ name: 'bin4', y0: 1722, y1: 3015 }, { name: 'bin7', y0: 5599, y1: 6891 }];

// Her track through each pocket, from the frozen-river lap.
const track = {};
for (const P of POCKETS) track[P.name] = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_river_'))) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (j.venueFingerprint !== FROZEN_FP) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    for (const s of j.samples) {
        if (gi(s, 'phase') !== 1 || gi(s, 'leg') !== 3) continue;
        const y = gi(s, 'y');
        for (const P of POCKETS) if (y >= P.y0 && y < P.y1) track[P.name].push([Math.round(gi(s, 'x')), Math.round(y), +(gi(s, 'spd') * 60).toFixed(0)]);
    }
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const out = await page.evaluate(async (arg) => {
        const { POCKETS, track } = arg;
        window.evalHarness.seed = 9100;
        window.resetGame(); window.startRace();
        // One update builds the bot grid (refreshBotGrid runs on the first update).
        window.update(1 / 60);
        const g = state.course.botGrid;
        // The clearance field is lazy — only pathSailable builds it. Force it.
        window.SailCheck.pathSailable(g, [0, -3000], [600, 9000]);
        const res = { res: g.res, n: g.n, maps: {}, human: {} };
        const clAt = (x, y) => { const c = g.cell(x, y); return g._clear ? g._clear[c[1] * g.n + c[0]] : null; };
        for (const P of POCKETS) {
            const rows = [];
            for (let y = P.y1 - 50; y >= P.y0; y -= 150) {
                let line = String(Math.round(y)).padStart(6) + ' ';
                for (let x = -900; x <= 1800; x += 75) {
                    const open = g.at(...g.cell(x, y));
                    const c = clAt(x, y);
                    line += !open ? '#' : (c === 0 ? '0' : c <= 2 ? String(c) : c <= 4 ? '+' : '.');
                }
                rows.push(line);
            }
            res.maps[P.name] = rows;
            // Every human sample in the pocket, labelled by the grid's verdict.
            const lab = { onHard: 0, clear0: 0, clear1_2: 0, clear3plus: 0, n: 0, hardPts: [] };
            for (const [x, y, spd] of (track[P.name] || [])) {
                const open = g.at(...g.cell(x, y));
                const c = clAt(x, y);
                lab.n++;
                if (!open) { lab.onHard++; if (lab.hardPts.length < 12) lab.hardPts.push([x, y, spd]); }
                else if (c === 0) lab.clear0++;
                else if (c <= 2) lab.clear1_2++;
                else lab.clear3plus++;
            }
            res.human[P.name] = lab;
        }
        return res;
    }, { POCKETS, track });
    await browser.close();

    console.log(`bot grid: res ${out.res} u/cell, n ${out.n}`);
    console.log(`legend: '#' grid says HARD (unnavigable)  '0' open but 0 clear cells  '1'/'2' clear cells  '+' 3-4  '.' wide\n`);
    for (const P of POCKETS) {
        console.log(`── ${P.name}  y ${P.y0}..${P.y1}   x from -900 (left) to 1800 (right), 75u per column`);
        for (const r of out.maps[P.name]) console.log(r);
        const h = out.human[P.name];
        console.log(`   HER TRACK through this pocket: ${h.n} samples — ` +
            `on cells the grid calls HARD: ${h.onHard} (${(100 * h.onHard / (h.n || 1)).toFixed(0)}%), ` +
            `open/0-clear ${h.clear0}, 1-2 clear ${h.clear1_2}, 3+ clear ${h.clear3plus}`);
        if (h.hardPts.length) console.log(`   she sails these HARD cells at speed: ` + h.hardPts.map(p => `(${p[0]},${p[1]})@${p[2]}`).join(' '));
        console.log('');
    }
})();
