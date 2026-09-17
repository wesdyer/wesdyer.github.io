// REPLAY HIS FLATS LAPS THROUGH THE SHIPPING TIDE FIELD (2026-09-16, the flats intake)
// A lap on a tidal venue is only a reference if the WATER he sailed is the water the
// benched doc has: the stamp is a whole-doc hash, so the honest adjudication of a
// retired/unknown stamp is to run every racing sample through the frozen field's own
// depthAt(x, y, t) on the race clock and count the contradictions — samples where the
// field says AGROUND (depth < draft) while the recording has him moving, or where the
// field says the mud takes speed while he sails at full polar. Also prints, per lap, the
// passages he took (nearest `tide.passages` line within riskHalfW while off the channel
// rim), with the level when he entered and left each.
//   node _flats_replay.js <lap.json> [more laps...]   (tree = repo root unless FLATS_TREE)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.env.FLATS_TREE || '../../..');
const LAPS = process.argv.slice(2);
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' }));
        window.evalHarness.seed = 1; window.resetGame(); window.startRace();
    });
    for (const lp of LAPS) {
        const lap = JSON.parse(fs.readFileSync(lp, 'utf8'));
        const r = await page.evaluate((lap) => {
            const F = lap.format; const I = {}; F.forEach((k, i) => I[k] = i);
            const T = state.tide; const doc = state.course.doc;
            const pass = (doc.tide && doc.tide.passages) || [];
            const HW = (window.__TIDE && window.__TIDE.riskHalfW) || 300;
            const dseg = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const L = dx * dx + dy * dy || 1; let u = ((px - a[0]) * dx + (py - a[1]) * dy) / L; u = Math.max(0, Math.min(1, u)); return Math.hypot(px - (a[0] + u * dx), py - (a[1] + u * dy)); };
            const nearPass = (x, y) => { let best = null, bd = 1e9; for (const p of pass) { for (let i = 1; i < p.pts.length; i++) { const d = dseg(x, y, p.pts[i - 1], p.pts[i]); if (d < bd) { bd = d; best = p; } } } return bd <= HW ? best : null; };
            let n = 0, agroundMoving = 0, slowedFast = 0, minD = 1e9, minDt = null, slowN = 0, offChan = 0, agroundAny = 0;
            const segs = []; let cur = null;
            let maxSpd = 0;
            for (const s of lap.samples) {
                if (s[I.phase] !== 1) continue;
                const t = s[I.t], x = s[I.x], y = s[I.y], spd = s[I.spd];
                n++;
                const d = Tide.depthAt(x, y, t); const g = Tide.groundAt(x, y);
                const mul = Tide.mulForDepth(d);
                if (spd > maxSpd) maxSpd = spd;
                if (d < minD) { minD = d; minDt = t; }
                if (d < T.draft) { agroundAny++; if (spd > 0.4) agroundMoving++; }
                if (mul < 1) slowN++;
                if (mul < 0.6 && spd > 1.6) slowedFast++;
                if (g > -1.6) offChan++;
                const p = (g > -1.6) ? nearPass(x, y) : null;
                const id = p ? p.id : null;
                if (cur && cur.id !== id) { segs.push(cur); cur = null; }
                if (id && !cur) cur = { id, risk: p.risk, t0: t, L0: +Tide.levelAt(t).toFixed(2), minD: d, n: 0 };
                if (cur) { cur.t1 = t; cur.L1 = +Tide.levelAt(t).toFixed(2); cur.minD = Math.min(cur.minD, d); cur.n++; }
            }
            if (cur) segs.push(cur);
            const sg = segs.filter(s => s.n >= 20).map(s => `${s.id}(r${s.risk}) ${s.t0.toFixed(0)}-${s.t1.toFixed(0)}s L ${s.L0}->${s.L1} minD ${s.minD.toFixed(2)}`);
            return { n, agroundAny, agroundMoving, slowN, slowedFast, minD: +minD.toFixed(2), minDt, offChan, maxSpd: +maxSpd.toFixed(2), sg, draft: T.draft, period: T.period, phase0: T.phase0 };
        }, lap);
        console.log(`${path.basename(lp)} fp ${lap.venueFingerprint} fin ${lap.finishTime.toFixed(1)}s`);
        console.log(`  racing samples ${r.n}, off-channel ${r.offChan}, slowed(mul<1) ${r.slowN}, AGROUND(d<draft) ${r.agroundAny} (moving>1.6kt ${r.agroundMoving}), slowed<0.6 while >6kt ${r.slowedFast}, minD ${r.minD} m @${r.minDt}s, maxSpd ${r.maxSpd}`);
        for (const s of r.sg) console.log('   ', s);
    }
    await browser.close();
})();
