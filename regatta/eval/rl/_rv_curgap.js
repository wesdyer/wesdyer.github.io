// RIVER ENTRY PUSH — THE CURRENT TRUTH GAP (2026-08-26). avoidance.js:1053
// samples getCurrentAt ONCE at the boat and holds it constant over a 4s
// projection (240 frames). In the notch the field varies spatially. This
// probe: at every P1 first-entry site (x,y from _rv_entry JSONs), integrate
// a 4s ground track at 7kt boat speed along the entry's wind-beam heading
// TWO ways — (a) constant at-boat current (the code's model), (b) current
// re-sampled every 0.25s along the track (the physics) — and report the
// endpoint gap in units and in clearance cells (50u each). KILL BAR
// (registered here, before any edit): the mechanism is real iff the median
// endpoint gap >= 25u (half a cell) and >= 50% of sites gap >= 25u.
//   node _rv_curgap.js <tree> <venue> <entryJson...>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeRW';
const ROOT = path.join(__dirname, TREE);
const VENUE = process.argv[3] || 'river';
const FILES = process.argv.slice(4);
(async () => {
    const sites = [];
    for (const f of FILES)
        for (const r of JSON.parse(fs.readFileSync(f, 'utf8')))
            for (const ep of r.eps)
                if (ep.idx === 0 && ep.leg >= 1 && ep.x != null) sites.push({ x: ep.x, y: ep.y });
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
    }, VENUE);
    const out = await page.evaluate((sites) => {
        window.evalHarness.seed = 9400;
        window.resetGame(); window.startRace();
        // freeze at t~gun; the current field is what matters (time-varying parts
        // share the same clock in both integrations, so spatial variation is
        // what the gap isolates)
        const SPD = (7 / 4) * 15;   // 7kt in units/s (rule 31: u/s = kt*15)
        const gaps = [];
        for (const s of sites) {
            const c0 = getCurrentAt(s.x, s.y);
            if (!c0 || c0.speed < 0.5) { gaps.push(0); continue; }
            const wd = getWindAt(s.x, s.y).direction;
            // integrate along BOTH beam headings from a point 300u back along
            // the reciprocal of the entry approach (approximate approach = the
            // beam heading itself; entries came in at speed, direction unknown
            // — use both beams and take the max gap as the site's exposure)
            let worst = 0;
            for (const sd of [1, -1]) {
                const h = wd + sd * 1.75;
                const sx = s.x - Math.sin(h) * 300, sy = s.y + Math.cos(h) * 300;
                const cA = getCurrentAt(sx, sy) || { speed: 0, direction: 0 };
                const cvxA = Math.sin(cA.direction) * (cA.speed / 4) * 15;
                const cvyA = -Math.cos(cA.direction) * (cA.speed / 4) * 15;
                // (a) constant model
                let ax = sx + (Math.sin(h) * SPD + cvxA * 15 / 15) * 4, ay;
                ax = sx + (Math.sin(h) * SPD + cvxA) * 4;
                ay = sy + (-Math.cos(h) * SPD + cvyA) * 4;
                // (b) resampled every 0.25s
                let bx = sx, by = sy;
                for (let i = 0; i < 16; i++) {
                    const cc = getCurrentAt(bx, by) || { speed: 0, direction: 0 };
                    const cvx = Math.sin(cc.direction) * (cc.speed / 4) * 15;
                    const cvy = -Math.cos(cc.direction) * (cc.speed / 4) * 15;
                    bx += (Math.sin(h) * SPD + cvx) * 0.25;
                    by += (-Math.cos(h) * SPD + cvy) * 0.25;
                }
                const gap = Math.hypot(ax - bx, ay - by);
                if (gap > worst) worst = gap;
            }
            gaps.push(+worst.toFixed(1));
        }
        return gaps;
    }, sites);
    out.sort((a, b) => a - b);
    const n = out.length;
    console.log(`tree ${TREE} ${VENUE}: sites ${n}  endpoint gap over 4s @7kt — med ${out[n >> 1]}u p75 ${out[Math.floor(n * .75)]}u p90 ${out[Math.floor(n * .9)]}u max ${out[n - 1]}u  | >=25u: ${(100 * out.filter(g => g >= 25).length / n).toFixed(0)}%  >=50u: ${(100 * out.filter(g => g >= 50).length / n).toFixed(0)}%`);
    console.log(`KILL BAR (med>=25u AND >=50% sites >=25u): ${out[n >> 1] >= 25 && out.filter(g => g >= 25).length / n >= 0.5 ? 'MECHANISM REAL' : 'KILLED'}`);
    await browser.close();
})();
