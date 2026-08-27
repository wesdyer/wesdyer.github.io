// THE SET AT THE START LINE (2026-08-27, owner note: "some venues have current
// at the start like river and glowtide especially"). A boat parked head-to-wind
// at 0 kt does not hold station in a stream — it IS the stream. So price the set
// where the fleet stages: sample getCurrentAt across the staging box and resolve
// it onto the line normal (positive = pushing the boat TOWARD the course side,
// negative = washing it downwind AWAY from the line) and along the line.
//   node _st_cur.js <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeRW';
const ROOT = path.join(__dirname, TREE);
const VENUES = ['river', 'glowtide', 'swamp', 'lagoon', 'ocean', 'redrock', 'bay', 'lake', 'arctic', 'seatrials'];
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    console.log('venue        wind@line  |set| kt   ACROSS the line (kt, + = toward the course side)   ALONG (kt)   at the fleet (kt)');
    for (const v of VENUES) {
        const r = await page.evaluate(async ({ v }) => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
            window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
            const [m0, m1] = startLinePts();
            const dx = m1.x - m0.x, dy = m1.y - m0.y, L = Math.hypot(dx, dy) || 1;
            const ax = dx / L, ay = dy / L;              // along the line
            const s = (typeof startCrossSign === 'function') ? startCrossSign() : 1;
            const nx = s * dy / L, ny = -s * dx / L;      // toward the course side
            const samples = [];
            for (let f = 0.15; f <= 0.85001; f += 0.1) for (let d = 0; d <= 400; d += 100) {
                const px = m0.x + dx * f - nx * d, py = m0.y + dy * f - ny * d;
                const c = getCurrentAt(px, py) || { speed: 0, direction: 0 };
                // engine convention: current.speed is in the same units the boat's
                // speed uses (knots = speed * 4 — standing rule 31)
                const cx = Math.sin(c.direction) * c.speed, cy = -Math.cos(c.direction) * c.speed;
                samples.push({ across: (cx * nx + cy * ny) * 4, along: (cx * ax + cy * ay) * 4, sp: c.speed * 4, d });
            }
            const fleet = state.boats.map(b => { const c = getCurrentAt(b.x, b.y) || { speed: 0, direction: 0 };
                const cx = Math.sin(c.direction) * c.speed, cy = -Math.cos(c.direction) * c.speed;
                return { across: (cx * nx + cy * ny) * 4, sp: c.speed * 4 }; });
            const med = a => { const z = [...a].sort((x, y) => x - y); return z.length ? z[Math.floor(z.length / 2)] : 0; };
            return { wind: +getWindAt((m0.x + m1.x) / 2, (m0.y + m1.y) / 2).speed.toFixed(1),
                sp: +med(samples.map(x => x.sp)).toFixed(2),
                across: +med(samples.map(x => x.across)).toFixed(2),
                acrossMin: +Math.min(...samples.map(x => x.across)).toFixed(2),
                along: +med(samples.map(x => x.along)).toFixed(2),
                fleetAcross: +med(fleet.map(x => x.across)).toFixed(2),
                fleetSp: +med(fleet.map(x => x.sp)).toFixed(2) };
        }, { v });
        console.log(v.padEnd(12), String(r.wind).padStart(6), '   ', String(r.sp).padStart(6), '     ',
            String(r.across).padStart(6), ' (worst ' + String(r.acrossMin).padStart(6) + ')            ',
            String(r.along).padStart(6), '     ', String(r.fleetAcross).padStart(6), '/', r.fleetSp);
    }
    await browser.close();
})();
