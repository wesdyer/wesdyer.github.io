// HOW MUCH STREAM DOES EACH VENUE ACTUALLY HAVE? (2026-08-09 night.)
// Two different questions, and the grounding push showed they have different
// answers: how much current a venue carries OVER ITS COURSE, and how much runs
// AT THE ROCKS BOATS ACTUALLY HIT. River is high on both. The second is the one
// that decides whether a ground-frame escape can help.
// Samples getCurrentAt on a grid over the course bounding box, water cells only.
//   node _cur_rank.js <tree> [venues...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeFIN');
const VENUES = process.argv.slice(3).length ? process.argv.slice(3)
    : ['river', 'lagoon', 'redrock', 'lake', 'bay', 'ocean', 'arctic', 'seatrials'];

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    const rows = [];
    for (const v of VENUES) {
        await p.addInitScript((vv) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })); }, v);
        await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        const r = await p.evaluate(async () => {
            window.evalHarness.seed = 9100;
            window.resetGame();
            const ms = state.course.marks || [];
            let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
            for (const m of ms) { x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x); y0 = Math.min(y0, m.y); y1 = Math.max(y1, m.y); }
            const pad = 400; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
            const N = 60, sp = [];
            for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
                const x = x0 + (x1 - x0) * i / N, y = y0 + (y1 - y0) * j / N;
                const c = getCurrentAt(x, y);
                if (c) sp.push(c.speed || 0);
            }
            return { sp, n: sp.length };
        });
        const q = (a, pr) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pr * (s.length - 1))] : NaN; };
        const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
        rows.push({ v, p50: q(r.sp, .5), p90: q(r.sp, .9), max: q(r.sp, 1), mean: mean(r.sp),
                    over1: 100 * r.sp.filter(s => s > 1).length / r.sp.length });
        console.log(`${v} sampled ${r.n}`);
    }
    await b.close();
    rows.sort((a, c) => c.p90 - a.p90);
    console.log(`\n=== CURRENT OVER THE COURSE (knots), by p90 ===`);
    console.log(`venue        mean    p50    p90    max   %cells >1kt`);
    for (const r of rows) console.log(
        `${r.v.padEnd(11)} ${r.mean.toFixed(2).padStart(5)} ${r.p50.toFixed(2).padStart(6)} ` +
        `${r.p90.toFixed(2).padStart(6)} ${r.max.toFixed(2).padStart(6)}   ${r.over1.toFixed(0)}%`);
})();
