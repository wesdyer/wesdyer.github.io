// BAY START DIAGNOSTIC. The bench says the fleet crosses a median 6s after the
// gun (p90 14s, max 62s) — about 5.0s per boat against a 3s reference, which is
// the largest single measured bin left on this venue. The rub attribution says
// 40% of the remaining boat contacts happen in the first 5.5 seconds of leg 0,
// many of them into boats sitting at 0.1-1.5 u/s. This asks WHY a boat is stopped
// at its own start.
//
// Per boat, sampled at gun-relative times: speed, signed distance to the line
// (positive = course side), lateral error from its assigned lane, nearest rival,
// OCS flag, and which controller mode owns it (wiggle / clearance / escape /
// normal). Then the boats that cross late are profiled against the ones that do not.
//
// node _bay_start_probe.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const VENUE = process.argv[5] || 'bay';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 5900; pl.y = -6100;
            const dt = 1 / 60;
            const WANT = [-6, -3, -1, 0, 1, 3, 6, 10, 15];
            const rows = bots.map(b => ({ name: b.name, lane: b.controller ? b.controller.startLinePct : null,
                                          samples: {}, cross: null, ocs: false }));
            const [m0, m1] = startLinePts();
            const lx = m1.x - m0.x, ly = m1.y - m0.y, ll = Math.hypot(lx, ly) || 1;
            // Line normal, oriented toward the course side (where mark 1 lies).
            let nx = -ly / ll, ny = lx / ll;
            const leg1 = state.course.dmc && state.course.dmc.legs ? state.course.dmc.legs[1] : null;
            if (leg1 && leg1.pts && leg1.pts.length) {
                const end = leg1.pts[leg1.pts.length - 1];
                const mid = { x: (m0.x + m1.x) / 2, y: (m0.y + m1.y) / 2 };
                if ((end.x - mid.x) * nx + (end.y - mid.y) * ny < 0) { nx = -nx; ny = -ny; }
            }
            const snap = (b) => {
                const mid = { x: (m0.x + m1.x) / 2, y: (m0.y + m1.y) / 2 };
                const c = b.controller || {};
                let near = 9e9;
                for (const o of state.boats) {
                    if (o === b || o.raceState.finished) continue;
                    const d = Math.hypot(o.x - b.x, o.y - b.y);
                    if (d < near) near = d;
                }
                const along = ((b.x - m0.x) * lx + (b.y - m0.y) * ly) / (ll * ll);
                return {
                    spd: +(b.speed * 60).toFixed(1),
                    toLine: +(((b.x - mid.x) * nx + (b.y - mid.y) * ny)).toFixed(0),
                    laneErr: c.startLinePct != null ? +((along - c.startLinePct) * ll).toFixed(0) : null,
                    near: +near.toFixed(0),
                    mode: c.wiggleActive ? 'wiggle' : (c.clearanceTimer > 0 ? 'clearance'
                        : (c.iceEscapeTimer > 0 ? 'escape' : (c.penaltySpin ? 'spin' : 'normal'))),
                    risk: c.riskState || '?',
                };
            };
            let wi = 0, started = false;
            for (let it = 0; it < 60 * 200; it++) {
                window.update(dt);
                if (state.race.status === 'prestart') {
                    // prestart timer counts DOWN to the gun
                    const g = -state.race.timer;
                    while (wi < WANT.length && WANT[wi] <= g) {
                        for (let k = 0; k < bots.length; k++) rows[k].samples[WANT[wi]] = snap(bots[k]);
                        wi++;
                    }
                    continue;
                }
                started = true;
                const g = state.race.timer;
                while (wi < WANT.length && WANT[wi] <= g) {
                    for (let k = 0; k < bots.length; k++) rows[k].samples[WANT[wi]] = snap(bots[k]);
                    wi++;
                }
                for (let k = 0; k < bots.length; k++) {
                    if (rows[k].cross == null && bots[k].raceState.leg >= 1) rows[k].cross = g;
                    if (bots[k].raceState.ocs) rows[k].ocs = true;
                }
                if (g > 90) break;
            }
            return rows;
        }, seed);
        all.push(...r.map(x => ({ ...x, seed })));
        console.log(`seed ${seed}: ${r.filter(x => x.cross == null || x.cross > 15).length} late/never of ${r.length}`);
    }
    await browser.close();

    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const late = all.filter(r => r.cross == null || r.cross > 12);
    const good = all.filter(r => r.cross != null && r.cross <= 6);
    console.log(`\nBAY START DIAGNOSTIC — ${TRIALS} seeds, ${all.length} boat-races`);
    console.log(`  crossings: <=6s ${good.length} | >12s or never ${late.length} | OCS ${all.filter(r => r.ocs).length}`);
    for (const t of [-6, -3, -1, 0, 1, 3, 6]) {
        const f = (set, k) => med(set.map(r => r.samples[t] ? r.samples[t][k] : NaN).filter(v => !isNaN(v)));
        const modes = (set) => {
            const m = {};
            for (const r of set) { const s = r.samples[t]; if (s) m[s.mode] = (m[s.mode] || 0) + 1; }
            return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' ');
        };
        console.log(`  t=${String(t).padStart(3)}s  LATE: spd ${String(f(late, 'spd')).padStart(5)} toLine ${String(f(late, 'toLine')).padStart(5)} laneErr ${String(f(late, 'laneErr')).padStart(5)} near ${String(f(late, 'near')).padStart(4)} [${modes(late)}]`);
        console.log(`          GOOD: spd ${String(f(good, 'spd')).padStart(5)} toLine ${String(f(good, 'toLine')).padStart(5)} laneErr ${String(f(good, 'laneErr')).padStart(5)} near ${String(f(good, 'near')).padStart(4)} [${modes(good)}]`);
    }
    fs.writeFileSync(path.join(__dirname, `bay_start_${VENUE}.json`), JSON.stringify(all));
    console.log(`\nwrote bay_start_${VENUE}.json`);
})();
