// POST-LANDING attribution — the m3 DRIFT-STALL (mark 3 at (2802,-469),
// starboard, reqSweep ~171deg): 83% of the cap tree's mark contacts are boats
// ARMED at m3, solo, stalling to <1kt and drifting on. For every pass through
// m3's 250u funnel: did it stall (<1kt)? At the stall onset: TWA vs local
// wind (in irons? luffing?), avoidance deflection, dMark, phase (sweep so
// far), what the argmin context was (rivals near, wall side). Survivor
// contrast: min speed through the funnel for clean passes.
//   node _rr_mstall.js <trials> <seed0> <tree> <markIdx>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4FINAL');
const MIDX = parseInt(process.argv[5] ?? '3');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const passes = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ([seed, MIDX]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const M = state.course.marks[MIDX];
            const st = {}; const out = [];
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const d = Math.hypot(b.x - M.x, b.y - M.y);
                    const s = st[b.name] = st[b.name] || { in: false };
                    if (d < 250) {
                        const kt = b.speed * 4;
                        if (!s.in) {
                            s.in = true;
                            s.p = { seed, name: b.name, leg: b.raceState.leg, t0: +state.race.timer.toFixed(0),
                                minKt: 99, stall: null, hit: 0, entryKt: +kt.toFixed(1),
                                entryBrg: +(Math.atan2(b.x - M.x, -(b.y - M.y)) * 180 / Math.PI).toFixed(0),
                                entrySweep: +((b.raceState.roundSweep || 0) * 180 / Math.PI).toFixed(0) };
                        }
                        if (kt < s.p.minKt) s.p.minKt = +kt.toFixed(2);
                        if (kt < 1 && !s.p.stall) {
                            const w = getWindAt(b.x, b.y);
                            const c = b.controller;
                            const twa = Math.abs(norm(b.heading - w.direction)) * 180 / Math.PI;
                            let nRival = 0;
                            for (const o of bots) if (o !== b && !o.raceState.finished
                                && Math.hypot(o.x - b.x, o.y - b.y) < 250) nRival++;
                            s.p.stall = {
                                dMark: +d.toFixed(0), twa: +twa.toFixed(0), wkt: +w.speed.toFixed(1),
                                defl: +(((c && c.lastAvoidDeviation) || 0) * 180 / Math.PI).toFixed(0),
                                armed: !!b.raceState.roundArmed, sweep: +((b.raceState.roundSweep || 0) * 180 / Math.PI).toFixed(0),
                                tgAge: (c && c._tgLast != null) ? +(state.race.timer - c._tgLast).toFixed(1) : null,
                                nRival, liveness: c && c.livenessState
                            };
                        }
                    } else if (s.in && d > 320) {
                        s.in = false;
                        out.push(s.p);
                    }
                }
            }
            for (const n in st) if (st[n].in) out.push(st[n].p);
            return out;
        }, [seed, MIDX]);
        passes.push(...r);
        console.log('seed', seed, 'm'+MIDX+' passes', r.length, 'stalls', r.filter(p => p.stall).length);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const stalls = passes.filter(p => p.stall);
    const clean = passes.filter(p => !p.stall);
    console.log('\nm'+MIDX+' funnel passes', passes.length, ' stalls(<1kt)', stalls.length,
        `(${(100 * stalls.length / Math.max(1, passes.length)).toFixed(0)}%)`);
    console.log('clean passes: minKt med', med(clean.map(p => p.minKt)), ' entryKt med', med(clean.map(p => p.entryKt)));
    const brgBins = arr => { const h = {}; for (const p of arr) { const k = Math.round(p.entryBrg / 45) * 45; h[k] = (h[k] || 0) + 1; } return h; };
    console.log('entry bearing-from-mark bins CLEAN:', JSON.stringify(brgBins(clean)), ' STALL:', JSON.stringify(brgBins(stalls)));
    console.log('entry sweep med CLEAN', med(clean.map(p => p.entrySweep)), ' STALL', med(stalls.map(p => p.entrySweep)));
    console.log('entry kt STALL med', med(stalls.map(p => p.entryKt)), ' (clean', med(clean.map(p => p.entryKt)) + ')');
    if (stalls.length) {
        const S = stalls.map(p => p.stall);
        console.log('at stall onset:');
        console.log('  dMark med', med(S.map(s => s.dMark)), ' TWA med', med(S.map(s => s.twa)),
            'deg  wind med', med(S.map(s => s.wkt)), 'kt');
        console.log('  defl med', med(S.map(s => s.defl)), 'deg  armed', (100 * S.filter(s => s.armed).length / S.length).toFixed(0) + '%',
            ' sweep med', med(S.map(s => s.sweep)), 'deg');
        console.log('  rivals<250 med', med(S.map(s => s.nRival)), ' 0-rival', (100 * S.filter(s => s.nRival === 0).length / S.length).toFixed(0) + '%');
        const lv = {}; for (const s of S) lv[s.liveness] = (lv[s.liveness] || 0) + 1;
        console.log('  liveness:', JSON.stringify(lv));
        console.log('  by leg:', JSON.stringify(stalls.reduce((a, p) => { a[p.leg] = (a[p.leg] || 0) + 1; return a; }, {})));
        // ⚠️ engine convention: TWA 0 = head-to-wind (the no-go tax fires at
        // twaCand < 0.55 rad) — small TWA is IRONS, large is a run.
        const twaBins = { 'run(>150)': 0, 'broad(100-150)': 0, 'reach(50-100)': 0, 'irons(<50)': 0 };
        for (const s of S) {
            if (s.twa > 150) twaBins['run(>150)']++;
            else if (s.twa > 100) twaBins['broad(100-150)']++;
            else if (s.twa > 50) twaBins['reach(50-100)']++;
            else twaBins['irons(<50)']++;
        }
        console.log('  TWA bins:', JSON.stringify(twaBins));
        const tg = S.filter(s => s.tgAge != null && s.tgAge < 20);
        console.log('  governor fired <20s before stall:', tg.length + '/' + S.length,
            ' age med', med(tg.map(s => s.tgAge)));
    }
    await browser.close();
})();
