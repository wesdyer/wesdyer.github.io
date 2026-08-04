// Bay L3/L5 run-bulge attribution: 1Hz per-bot sampling on the two run legs.
// Measures WHERE the 1.34 sailed-distance ratio comes from:
//   - east offset of the BOAT vs the DMC line (does the track bulge east?)
//   - east offset of the NAV TARGET vs the DMC line (is navigation aiming east?)
//   - fetch vs zigzag: |TWA to nav target| vs optTWA (is the strategy layer
//     gybe-zigzagging at the polar angle while the human sails deep-straight?)
//   - heated share: the honest planing gate's exact condition re-evaluated
//     (localWind > minTWS && s140*(1+pos140) >= entrySpeed) — 1/cos40 = +31%
//     distance, ratio 1.31 ~ the measured 1.34
//   - TWA-deg histogram of actual sailing, TWS mean, gybes, planing share.
// node _bay_bulge_probe.js <trials> <seed0> [tree] [label]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const LABEL = process.argv[5] || null;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 5900; pl.y = -6100;
            const legs = state.course.dmc.legs;
            const LEGSET = [3, 5];
            const mkL = () => ({ t: 0, d: 0, ds: 0, px: 0, py: 0,
                eBoatSum: 0, eNavSum: 0, eN: 0, eBoatMax: -1e9, eBoatMin: 1e9,
                fetchN: 0, zigN: 0, heatN: 0, planeN: 0, twsSum: 0,
                twaH: [0, 0, 0, 0], gybes: 0 });
            const st = bots.map(b => ({ name: b.name, legs: {}, cur: null,
                px: b.x, py: b.y, hint: null, sPrev: null, board: 0, fin: null }));
            const projPt = (L, s) => {
                const cum = L.cum, pts = L.pts;
                let k = 1;
                while (k < cum.length - 1 && cum[k] < s) k++;
                const t = (s - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
                return { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t,
                         y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t };
            };
            const dt = 1 / 60; let frame = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                frame++;
                const edge = (frame % 60 === 0);
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], s = st[k];
                    if (s.fin != null) continue;
                    if (b.raceState.finished) { s.fin = 1; continue; }
                    const lg = b.raceState.leg;
                    const on = LEGSET.includes(lg) ? lg : null;
                    if (on !== s.cur) {
                        s.cur = on; s.hint = null; s.sPrev = null; s.board = 0;
                        if (on != null && !s.legs[on]) s.legs[on] = mkL();
                    }
                    if (on == null) { s.px = b.x; s.py = b.y; continue; }
                    const g = s.legs[on];
                    g.t += dt;
                    g.d += Math.hypot(b.x - s.px, b.y - s.py);
                    s.px = b.x; s.py = b.y;
                    const lw = getWindAt(b.x, b.y);
                    const twaB = normalizeAngle(b.heading - lw.direction);
                    if (Math.abs(twaB) > 0.2 && Math.abs(twaB) < Math.PI - 0.2) {
                        const nb = twaB > 0 ? 1 : -1;
                        if (s.board !== 0 && nb !== s.board && Math.abs(twaB) >= Math.PI / 2) g.gybes++;
                        s.board = nb;
                    }
                    if (!edge) continue;
                    // ---- 1Hz sample ----
                    const L = legs[on];
                    const sNow = CoursePath.project(L, b.x, b.y, s.hint);
                    s.hint = sNow;
                    if (s.sPrev != null) g.ds += Math.max(0, sNow - s.sPrev);
                    s.sPrev = sNow;
                    const xp = projPt(L, sNow);
                    const eBoat = b.x - xp.x;
                    g.eBoatSum += eBoat; g.eN++;
                    if (eBoat > g.eBoatMax) g.eBoatMax = eBoat;
                    if (eBoat < g.eBoatMin) g.eBoatMin = eBoat;
                    const c = b.controller, nav = c && c._lastNav;
                    if (nav) {
                        const sN = CoursePath.project(L, nav.x, nav.y, null);
                        const xpN = projPt(L, sN);
                        g.eNavSum += nav.x - xpN.x;
                    }
                    g.twsSum += lw.speed;
                    if (b.raceState.isPlaning) g.planeN++;
                    // exact heat-gate recon (matches getStrategicHeading downwind)
                    let heated = false;
                    if (typeof J111_PLANING !== 'undefined' && lw.speed > J111_PLANING.minTWS) {
                        const t140 = (140 - 102.5) / (145 - 102.5);
                        const pos140 = b.stats.reach * 0.018 + t140 * (b.stats.downwind * 0.015 - b.stats.reach * 0.018);
                        const s140 = getTargetSpeed(140 * Math.PI / 180, true, lw.speed) * (1 + pos140);
                        if (s140 >= J111_PLANING.entrySpeed) heated = true;
                    }
                    if (heated) g.heatN++;
                    // fetch vs zigzag: bearing-to-nav TWA vs optTWA (heated or not)
                    if (nav) {
                        const brgN = Math.atan2(nav.x - b.x, -(nav.y - b.y));
                        const twaN = Math.abs(normalizeAngle(brgN - lw.direction));
                        let opt = getCharacterOptimalVMGAngle('downwind', lw.speed, b.stats);
                        if (heated) opt = 140 * Math.PI / 180;
                        if (twaN > Math.PI * 0.7) { (twaN < opt) ? g.fetchN++ : g.zigN++; }
                    }
                    const at = Math.abs(twaB) * 180 / Math.PI;
                    g.twaH[at < 125 ? 0 : at < 145 ? 1 : at < 160 ? 2 : 3]++;
                }
            }
            const rnd = o => { const q = {}; for (const kk in o) q[kk] = Array.isArray(o[kk]) ? o[kk] : Math.round(o[kk] * 10) / 10; return q; };
            const out = [];
            for (const s of st) for (const lg of LEGSET)
                if (s.legs[lg] && s.legs[lg].t > 5) out.push({ name: s.name, leg: lg, ...rnd(s.legs[lg]) });
            return { legLen: legs.map(l => Math.round(l.length)), out };
        }, seed);
        rows.push(...r.out.map(x => ({ seed, legLen: r.legLen, ...x })));
        console.log(`seed ${seed} done`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    for (const lg of [3, 5]) {
        const g = rows.filter(r => r.leg === lg);
        const L = rows[0].legLen[lg];
        const S = f => mean(g.map(r => r[f]));
        console.log(`\nLEG ${lg} (n=${g.length}, dmcLen ${L}):`);
        console.log(`  time med ${med(g.map(r => r.t)).toFixed(0)}  dist ratio med ${med(g.map(r => r.d / L)).toFixed(2)}  TWS mean ${(S('twsSum') / S('eN')).toFixed(1)}`);
        console.log(`  east offset: boat mean ${(S('eBoatSum') / S('eN')).toFixed(0)}u (max med ${med(g.map(r => r.eBoatMax)).toFixed(0)}, min med ${med(g.map(r => r.eBoatMin)).toFixed(0)})  nav mean ${(S('eNavSum') / S('eN')).toFixed(0)}u`);
        console.log(`  fetch ${(100 * S('fetchN') / Math.max(1, S('fetchN') + S('zigN'))).toFixed(0)}% vs zigzag ${(100 * S('zigN') / Math.max(1, S('fetchN') + S('zigN'))).toFixed(0)}%   heated ${(100 * S('heatN') / S('eN')).toFixed(0)}%  planing ${(100 * S('planeN') / S('eN')).toFixed(0)}%`);
        const h = [0, 1, 2, 3].map(i => mean(g.map(r => r.twaH[i])));
        const hn = h.reduce((a, b) => a + b, 0);
        console.log(`  TWA sailed: <125 ${(100 * h[0] / hn).toFixed(0)}% | 125-145 ${(100 * h[1] / hn).toFixed(0)}% | 145-160 ${(100 * h[2] / hn).toFixed(0)}% | 160-180 ${(100 * h[3] / hn).toFixed(0)}%`);
        console.log(`  gybes med ${med(g.map(r => r.gybes))} mean ${S('gybes').toFixed(1)}`);
    }
    if (LABEL) {
        fs.writeFileSync(path.join(__dirname, `bay_bulge_${LABEL}.json`), JSON.stringify(rows));
        console.log(`\nwrote bay_bulge_${LABEL}.json`);
    }
    await browser.close();
})();
