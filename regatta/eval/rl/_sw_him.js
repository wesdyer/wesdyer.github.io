// HIS WEED EXPOSURE (2026-08-25, the swamp push) — the human reference for
// the stall-machine mechanism, computed with the SAME field the fleet probes
// use. Per fingerprint-valid lap: time-weighted mean mul, % racing time in
// weed (mul<0.7) and hard weed (<0.35), sub-1kt stall episodes (>=3s), and
// lateral offset off the DMC line. 10Hz samples: t0 phase1 x2 y3 hdg4 spd5.
//   node _sw_him.js [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeSW0');
(async () => {
    const files = fs.readdirSync(path.join(__dirname, 'traj')).filter(f => f.startsWith('traj_swamp'));
    const laps = files.map(f => JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f))));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'swamp' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const out = await page.evaluate((laps) => {
        window.evalHarness.seed = 12345;
        window.resetGame(); window.startRace();
        const mulAt = (x, y) => window.VenueDoc.shoalField(state.course.islands, x, y);
        const L1 = state.course.dmc.legs[1];
        const dmcDist = (x, y) => {
            let best = Infinity;
            for (let k = 0; k < L1.pts.length - 1; k++) {
                const a = L1.pts[k], b = L1.pts[k + 1];
                const ex = b.x - a.x, ey = b.y - a.y, l2 = ex * ex + ey * ey;
                let t = l2 < 1e-6 ? 0 : ((x - a.x) * ex + (y - a.y) * ey) / l2;
                t = t < 0 ? 0 : t > 1 ? 1 : t;
                const dx = x - (a.x + ex * t), dy = y - (a.y + ey * t);
                best = Math.min(best, dx * dx + dy * dy);
            }
            return Math.sqrt(best);
        };
        const rows = [];
        for (const lap of laps) {
            let T = 0, wsum = 0, weedT = 0, hardT = 0, slowRun = 0, stalls = 0, stallT = 0;
            const offs = [];
            for (const s of lap.samples) {
                const leg = s[8];
                if (leg < 1) continue;
                const dt = 0.1;
                const m = mulAt(s[2], s[3]);
                T += dt; wsum += m * dt;
                if (m < 0.7) weedT += dt;
                if (m < 0.35) hardT += dt;
                const kt = s[5] * 4;
                if (kt < 1.0) { slowRun += dt; if (slowRun >= 3 && slowRun - dt < 3) stalls++; if (slowRun >= 3) stallT += dt; }
                else slowRun = 0;
                if (leg === 1) offs.push(dmcDist(s[2], s[3]));
            }
            offs.sort((a, b) => a - b);
            rows.push({ fin: lap.finishTime, T: +T.toFixed(0), meanMul: +(wsum / Math.max(0.01, T)).toFixed(3),
                        weedPct: +(100 * weedT / Math.max(0.01, T)).toFixed(1),
                        hardPct: +(100 * hardT / Math.max(0.01, T)).toFixed(1),
                        stalls, stallT: +stallT.toFixed(0),
                        offP50: Math.round(offs[Math.floor(offs.length / 2)] || 0),
                        offP90: Math.round(offs[Math.floor(offs.length * 0.9)] || 0) });
        }
        return rows;
    }, laps);
    console.log('lap fin(s) | raceT | meanMul | weed% | hard% | stalls | stallT | offDMC p50/p90');
    for (const r of out) console.log(`${String(r.fin).padStart(6)} | ${String(r.T).padStart(5)} | ${r.meanMul} | ${String(r.weedPct).padStart(5)} | ${String(r.hardPct).padStart(5)} | ${r.stalls} | ${String(r.stallT).padStart(4)} | ${r.offP50}/${r.offP90}u`);
    await browser.close();
})();
