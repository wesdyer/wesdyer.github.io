// WHICH BOATS ARM THE WAY-ON BRANCH, AND ON WHAT (2026-08-27). The gate is
// (foul set along the run <= -1.5 kt) OR (mean breeze at the lane < 5 kt).
// It is meant to reach river and swamp. Redrock keeps arming it and costing
// boat contacts, so read the two quantities the gate actually tests, per boat,
// at the first pre-start frame — measure the gate, do not infer it.
//   node _st_gate.js <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeSPN';
const ROOT = path.join(__dirname, TREE);
const VENUES = ['river', 'swamp', 'glowtide', 'bay', 'lake', 'lagoon', 'redrock', 'ocean', 'arctic', 'seatrials'];
const SEEDS = { river: 9400, swamp: 9400, glowtide: 9400, bay: 9400, lake: 6100, lagoon: 9400, redrock: 9400, ocean: 9400, arctic: 9100, seatrials: 9400 };
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    console.log('venue        armed   setAlongKt (min/med/max)      meanWindKt at the lane (min/med/max)   instWind med');
    for (const v of VENUES) {
        const r = await page.evaluate(async ({ v, seed }) => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            const pl = state.boats.find(b => b.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            window.update(1 / 60);   // let the controllers exist
            const [m0, m1] = startLinePts();
            const dx = m1.x - m0.x, dy = m1.y - m0.y;
            const rows = [];
            for (const b of state.boats) {
                const c = b.controller; if (!c) continue;
                const pct = Math.max(0.1, Math.min(0.9, c.startLinePct));
                const tx = m0.x + dx * pct, ty = m0.y + dy * pct;
                const wd = getWindAt(tx, ty).direction;
                const cur = getCurrentAt(b.x, b.y);
                const setAlong = cur ? cur.speed * 4 * Math.cos(cur.direction - wd) : 0;
                let mean;
                WIND_MEAN_FIELD = true;
                try { mean = getWindAt(tx, ty).speed; } finally { WIND_MEAN_FIELD = false; }
                rows.push({ setAlong, mean, inst: getWindAt(tx, ty).speed,
                            armed: (setAlong <= -1.5) || (mean < 5.0) });
            }
            return rows;
        }, { v, seed: SEEDS[v] });
        const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
        const sa = r.map(x => x.setAlong), mw = r.map(x => x.mean), iw = r.map(x => x.inst);
        console.log(v.padEnd(12),
            `${r.filter(x => x.armed).length}/${r.length}`.padStart(5), '  ',
            `${q(sa,0).toFixed(2)} / ${q(sa,.5).toFixed(2)} / ${q(sa,1).toFixed(2)}`.padStart(24), '  ',
            `${q(mw,0).toFixed(2)} / ${q(mw,.5).toFixed(2)} / ${q(mw,1).toFixed(2)}`.padStart(26), '  ',
            q(iw,.5).toFixed(2));
    }
    await browser.close();
})();
