// P0 DISPLACED-POPULATION decomposition — the m5 approach box (−200..0,
// 1000..1400, 1343 boat-s pooled at 4@9400) survived the cap + far-field
// landings. The remaining mass is "displaced-off-plan" boats (15% m5 stalls,
// 78% solo, defl 69° at ~223u). QUESTION, one physical line: when a boat is
// parked in the box (or deflecting hard on the m5 approach), where does it sit
// relative to its OWN plan — and which FF-waiver guard is the one denying it
// the far-field waiver?
//   d0        = dist to gridPath[0] (post-splice ≈ nearest un-passed plan pt;
//               the waiver's guard is d0 < 200)
//   bands     = noPath / on-plan(<200) / displaced(200-400) / fiction(>400)
//               (>400 is nav's own "blown off plan" line — it zeroes gridTimer
//               but does NOT set needFull, so the fiction path can live to
//               gridAge 12)
//   guards    = which term would deny the waiver right now: noPath, d0>200,
//               armed (arc owns the geometry), nogo (plan dir within 0.62 of
//               wind — waiver correctly off), else WAIVER-ACTIVE (the parked
//               boat had the waiver and parked anyway → farland is not the
//               carrier, look elsewhere)
// Also: what displaced it — rolling 6s flags (rival<160u seen, max |defl|).
//   node _rr_mdisp.js <trials> <seed0> <tree> [markIdx=4]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHEAD8');
const MIDX = parseInt(process.argv[5] ?? '4');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const parks = [], defls = [];
    let boxSamples = 0, boxLowKt = 0;
    const bandsBox = { noPath: 0, on: 0, disp: 0, fiction: 0 };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ([seed, MIDX]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const M = state.course.marks[MIDX];
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const st = {}; const parks = [], defls = [];
            let boxSamples = 0, boxLowKt = 0;
            const bandsBox = { noPath: 0, on: 0, disp: 0, fiction: 0 };
            const dt = 1 / 60; let fr = 0;
            const inBox = (b) => b.x > -200 && b.x < 0 && b.y > 1000 && b.y < 1400;
            // The waiver's own reference: d0 + the plan direction 260u along.
            const planRef = (c, b) => {
                if (!c || !c.gridPath || c.gridPath.length < 2) return { d0: null, hPlan: null };
                const p0 = c.gridPath[0];
                const d0 = Math.hypot(p0.x - b.x, p0.y - b.y);
                const pts = c.gridPath;
                let j = 0, acc = 0;
                while (j < pts.length - 1 && acc < 260) {
                    acc += Math.hypot(pts[j + 1].x - pts[j].x, pts[j + 1].y - pts[j].y);
                    j++;
                }
                const p = pts[j];
                return { d0, hPlan: Math.atan2(p.x - b.x, -(p.y - b.y)) };
            };
            const band = (d0) => d0 == null ? 'noPath' : d0 < 200 ? 'on' : d0 < 400 ? 'disp' : 'fiction';
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const c = b.controller;
                    const kt = b.speed * 4;
                    const s = st[b.name] = st[b.name] || { hist: [], parked: null, defl: false };
                    // rolling 6s history (60 samples @0.1s)
                    let rivalNear = false;
                    for (const o of bots) if (o !== b && !o.raceState.finished
                        && Math.hypot(o.x - b.x, o.y - b.y) < 160) { rivalNear = true; break; }
                    const deflNow = Math.abs(((c && c.lastAvoidDeviation) || 0) * 180 / Math.PI);
                    s.hist.push({ rivalNear, defl: deflNow });
                    if (s.hist.length > 60) s.hist.shift();
                    const dM = Math.hypot(b.x - M.x, b.y - M.y);
                    const inRegion = inBox(b) || dM < 250;
                    if (inBox(b)) {
                        boxSamples++;
                        if (kt < 1) {
                            boxLowKt++;
                            const pr = planRef(c, b);
                            bandsBox[band(pr.d0)]++;
                        }
                    }
                    // parked episode: sustained <1kt in region
                    if (inRegion && kt < 1) {
                        if (!s.parked) {
                            const pr = planRef(c, b);
                            const w = getWindAt(b.x, b.y);
                            const nogo = pr.hPlan != null && Math.abs(norm(pr.hPlan - w.direction)) < 0.62;
                            s.parked = { seed, name: b.name, leg: b.raceState.leg,
                                t0: +state.race.timer.toFixed(0), n: 0,
                                x: +b.x.toFixed(0), y: +b.y.toFixed(0), dM: +dM.toFixed(0),
                                d0: pr.d0 == null ? null : +pr.d0.toFixed(0), band: band(pr.d0),
                                gridAge: c ? +(c.gridAge || 0).toFixed(1) : null,
                                armed: !!b.raceState.roundArmed,
                                nogo,
                                defl: +deflNow.toFixed(0),
                                rival6s: s.hist.some(h => h.rivalNear),
                                maxDefl6s: +Math.max(...s.hist.map(h => h.defl)).toFixed(0) };
                        }
                        s.parked.n++;
                    } else if (s.parked) {
                        if (s.parked.n >= 20) parks.push(s.parked);  // ≥2s parked
                        s.parked = null;
                    }
                    // deflection rising edge on the m5 approach (within 600u, leg 2-4)
                    const hard = deflNow > 25 && dM < 600 && b.raceState.leg >= 2 && b.raceState.leg <= 4;
                    if (hard && !s.defl) {
                        s.defl = true;
                        const pr = planRef(c, b);
                        const w = getWindAt(b.x, b.y);
                        defls.push({ seed, name: b.name, kt: +kt.toFixed(1), dM: +dM.toFixed(0),
                            d0: pr.d0 == null ? null : +pr.d0.toFixed(0), band: band(pr.d0),
                            gridAge: c ? +(c.gridAge || 0).toFixed(1) : null,
                            armed: !!b.raceState.roundArmed,
                            nogo: pr.hPlan != null && Math.abs(norm(pr.hPlan - w.direction)) < 0.62,
                            rival6s: s.hist.some(h => h.rivalNear) });
                    } else if (!hard) s.defl = false;
                }
            }
            for (const n in st) if (st[n].parked && st[n].parked.n >= 20) parks.push(st[n].parked);
            return { parks, defls, boxSamples, boxLowKt, bandsBox };
        }, [seed, MIDX]);
        parks.push(...r.parks); defls.push(...r.defls);
        boxSamples += r.boxSamples; boxLowKt += r.boxLowKt;
        for (const k in r.bandsBox) bandsBox[k] += r.bandsBox[k];
        console.log('seed', seed, 'parks', r.parks.length, 'deflEdges', r.defls.length,
            'boxLowKt', (r.boxLowKt / 10).toFixed(0) + 's');
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const pct = (n, d) => (100 * n / Math.max(1, d)).toFixed(0) + '%';
    console.log('\nBOX (−200..0, 1000..1400): samples', (boxSamples / 10).toFixed(0) + ' boat-s,',
        'parked(<1kt)', (boxLowKt / 10).toFixed(0), 'boat-s');
    console.log('  parked-sample d0 bands: noPath', pct(bandsBox.noPath, boxLowKt),
        ' on(<200)', pct(bandsBox.on, boxLowKt), ' disp(200-400)', pct(bandsBox.disp, boxLowKt),
        ' fiction(>400)', pct(bandsBox.fiction, boxLowKt));
    const rep = (label, E) => {
        if (!E.length) { console.log(label, '0 episodes'); return; }
        const bands = {}; for (const e of E) bands[e.band] = (bands[e.band] || 0) + 1;
        console.log(label, E.length, 'episodes  bands', JSON.stringify(bands));
        console.log('   d0 med', med(E.filter(e => e.d0 != null).map(e => e.d0)),
            ' gridAge med', med(E.map(e => e.gridAge)),
            ' armed', pct(E.filter(e => e.armed).length, E.length),
            ' nogo', pct(E.filter(e => e.nogo).length, E.length),
            ' rival6s', pct(E.filter(e => e.rival6s).length, E.length));
        // the money split: of episodes where the boat is OFF-plan, which guard bound?
        const off = E.filter(e => e.band === 'disp' || e.band === 'fiction');
        const waiverHad = E.filter(e => e.band === 'on' && !e.armed && !e.nogo);
        console.log('   off-plan(waiver lost to displacement):', pct(off.length, E.length),
            '  WAIVER-ACTIVE-yet-here:', pct(waiverHad.length, E.length));
    };
    rep('\nPARKED episodes (≥2s, box∪funnel):', parks);
    const p3 = parks.filter(p => p.n >= 100);
    console.log('  long parks (≥10s):', p3.length, ' dur med', p3.length ? med(p3.map(p => p.n / 10)) : '-', 's',
        ' maxDefl6s med', p3.length ? med(p3.map(p => p.maxDefl6s)) : '-');
    rep('\nDEFLECTION edges (>25°, <600u of m'+MIDX+'):', defls);
    await browser.close();
})();
