// DOES THE ROUTER'S OWN PATH CROSS THE BOILS? (2026-09-13, the volcano push). Scores the
// saved leg polylines (course.paths == the router's, _pa_paths_eq) and the straight
// chords against Volcano.boilMul at 10 u steps; prints, per leg, the units of path inside
// a boil (mul < 0.88) and the deepest multiplier, plus every vent's distance to the path.
//   node _vo_route_boil.js [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeVO0');
(async () => {
    const browser = await chromium.launch(); const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); });
    const res = await page.evaluate(() => {
        window.evalHarness.seed = 1; window.resetGame(); window.startRace();
        const v = state.volcano; const legs = state.course.dmc.legs; const out = { legs: [], vents: [] };
        const walk = (pts) => { let inB = 0, minMul = 1, len = 0; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b.x - a.x, b.y - a.y); len += L; for (let d = 0; d < L; d += 10) { const x = a.x + (b.x - a.x) * d / L, y = a.y + (b.y - a.y) * d / L; const m = Volcano.boilMul(x, y); if (m < 0.88) inB += 10; if (m < minMul) minMul = m; } } return { len: Math.round(len), inB, minMul: +minMul.toFixed(2) }; };
        for (let lg = 1; lg < legs.length; lg++) {
            const pts = legs[lg].pts; const r = walk(pts); const c = walk([pts[0], pts[pts.length - 1]]);
            out.legs.push({ lg, path: r, chord: c, n: pts.length });
        }
        for (const b of v.vents) {
            let bd = Infinity, bl = 0;
            for (let lg = 1; lg < legs.length; lg++) { const pts = legs[lg].pts; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], q = pts[i + 1]; const ex = q.x - a.x, ey = q.y - a.y, l2 = ex * ex + ey * ey; let t = ((b.x - a.x) * ex + (b.y - a.y) * ey) / l2; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(b.x - (a.x + ex * t), b.y - (a.y + ey * t)); if (d < bd) { bd = d; bl = lg; } } }
            out.vents.push({ kind: b.kind.label, x: Math.round(b.x), y: Math.round(b.y), a: Math.round(b.a), b: Math.round(b.b), strength: b.strength, dPath: Math.round(bd), leg: bl });
        }
        return out;
    });
    await browser.close();
    for (const l of res.legs) console.log(`leg ${l.lg}: route ${l.path.len} u, in-boil ${l.path.inB} u (min mul ${l.path.minMul}) | chord ${l.chord.len} u, in-boil ${l.chord.inB} u (min mul ${l.chord.minMul})`);
    for (const b of res.vents.sort((x, y) => x.dPath - y.dPath)) console.log(`  ${b.kind.padEnd(26)} (${b.x},${b.y}) ${b.a}x${b.b} s${b.strength}  nearest route leg ${b.leg} at ${b.dPath} u`);
})();
