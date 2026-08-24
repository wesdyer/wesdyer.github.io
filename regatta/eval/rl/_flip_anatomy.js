// FLIP ANATOMY (2026-08-23 night, the H1b execution push, Phase 1.1).
// THE SPEC's bot autopsy: deviation sign flips med 3/encounter, 73% with
// >=2 — the pass is an avoidance fight. The COMMITMENT family (side-locks,
// flip cooldowns, floe-identity locks) is CLOSED 0-for-7, so the only
// admissible fix class is "change what is MEASURED" (FL1/FL1b/FL1c/D3) —
// WHICH measurement depends on what each flip actually is:
//   RE-TARGET   nearest floe changed between the flip frames (not a real
//               side change on one hull)
//   LAYER-GAP   wiggle/escape/penalty owned any frame between the two
//               deviated frames (the flip is an artifact of a layer gap)
//   REFERENCE   the deviation sign flipped but the COMMAND stayed on the
//               same side of the floe bearing — desiredHeading (nav: carrot
//               hop, fairing update, rejoin slide) moved across the command;
//               the helm never changed its mind
//   CHOICE      the command itself swapped sides of the floe — the argmin's
//               cost landscape flipped. Sub-attributed: grid rebuild within
//               0.5s / rival within 400u / roundArmed / clearance trend.
// Hero applyAvoidance is WRAPPED (probe-side monkey-patch; engine untouched)
// to capture (desiredHeading in, command out) per frame.
//   node _flip_anatomy.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeR1C');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const FLIPS = []; const ENCS = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            // wrap applyAvoidance to see (in, out) each call — controller is
            // created lazily, so install on first sight of it
            let avIn = null, avOut = null, wrapped = false;
            const installWrap = (c) => {
                const orig = c.applyAvoidance.bind(c);
                c.applyAvoidance = (dh, sr) => { avIn = dh; avOut = orig(dh, sr); return avOut; };
                wrapped = true;
            };
            const dt = 1 / 60;
            const floes = () => state.course._floeObjs || [];
            const flips = [], encs = [];
            let enc = null, prev = null, lastRebuildT = -10, prevGridT = null;
            let hitT = -10;
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try { if (d && d.boat === hero && ty === 'collision_island' && d.isFloe) hitT = state.race.timer; } catch (e) { }
                if (inner) inner(ty, d);
            };
            for (let it = 0; it < 60 * 900; it++) {
                avIn = null; avOut = null;
                const c = hero.controller;
                if (c && !wrapped) installWrap(c);
                const gtBefore = c ? c.gridTimer : null;
                window.update(dt);
                if (!c) continue;
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880 || hero.raceState.finished) break;
                const L = hero.raceState.leg;
                if (L !== 1 && L !== 2) continue;
                if (c.gridTimer != null && gtBefore != null && c.gridTimer > gtBefore + 1.0) lastRebuildT = t;
                // nearest floe
                let clr = Infinity, nf = null;
                for (const f of floes()) {
                    if (Math.hypot(hero.x - f.x, hero.y - f.y) > (f.radius || 0) + 600) continue;
                    const cH = floeHullClear(f, hero.x, hero.y, 0);
                    if (cH < clr) { clr = cH; nf = f; }
                }
                if (clr >= 120) {
                    if (enc && t - enc.lastT > 1.0) { encs.push(enc); enc = null; prev = null; }
                    continue;
                }
                if (!enc) enc = { seed, t0: t, lastT: t, min: clr, flips: 0, frames: 0, hit: 0 };
                enc.lastT = t; enc.frames++;
                if (clr < enc.min) enc.min = clr;
                if (hitT >= enc.t0) enc.hit = 1;
                const layer = c.penaltySpin ? 'pen' : c.escActive ? 'esc'
                    : (c.iceEscapeTimer || 0) > 0 ? 'latch' : c.wiggleActive ? 'wig' : 'av';
                const dev = (avIn != null && avOut != null) ? wrapA(avOut - avIn) : null;
                const brgF = nf ? Math.atan2(nf.x - hero.x, -(nf.y - hero.y)) : null;
                const cur = {
                    t, nfId: nf ? (nf.id != null ? nf.id : floes().indexOf(nf)) : null,
                    clr, layer, dev,
                    devSide: dev != null && Math.abs(dev) > 0.09 ? Math.sign(dev) : 0,
                    cmdSide: (avOut != null && brgF != null) ? Math.sign(wrapA(avOut - brgF)) : null,
                    des: avIn, cmd: avOut,
                    gapT: 0,
                };
                if (prev && cur.devSide !== 0 && prev.devSide !== 0 && cur.devSide !== prev.devSide) {
                    // FLIP between prev deviated frame and this one
                    let cls;
                    if (cur.nfId !== prev.nfId) cls = 'RE-TARGET';
                    else if (prev.gapLayer) cls = 'LAYER-GAP';
                    else if (cur.cmdSide != null && prev.cmdSide != null && cur.cmdSide === prev.cmdSide) cls = 'REFERENCE';
                    else cls = 'CHOICE';
                    // rival within 400u?
                    let rival = 0;
                    for (const ob of state.boats) {
                        if (ob === hero || ob.raceState.finished || ob.isPlayer) continue;
                        if (Math.hypot(ob.x - hero.x, ob.y - hero.y) < 400) { rival = 1; break; }
                    }
                    flips.push({ seed, t: +t.toFixed(1), cls, clr: Math.round(clr),
                        rebuild: (t - lastRebuildT) < 0.5 ? 1 : 0, rival,
                        armed: hero.raceState.roundArmed ? 1 : 0,
                        dDes: prev.des != null && cur.des != null ? +Math.abs(wrapA(cur.des - prev.des)).toFixed(2) : null,
                        dCmd: prev.cmd != null && cur.cmd != null ? +Math.abs(wrapA(cur.cmd - prev.cmd)).toFixed(2) : null,
                        gap: +(t - prev.t).toFixed(2) });
                    enc.flips++;
                }
                if (cur.devSide !== 0) {
                    cur.gapLayer = false;
                    prev = cur;
                } else if (prev) {
                    // carry gap info: a non-avoidance layer owned this frame?
                    if (layer !== 'av') prev.gapLayer = true;
                }
            }
            if (enc) encs.push(enc);
            return { flips, encs };
        }, seed);
        FLIPS.push(...r.flips); ENCS.push(...r.encs);
        console.log(`seed ${seed}: ${r.encs.length} encounters, ${r.flips.length} flips`);
    }
    await browser.close();
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
    const sub78 = ENCS.filter(e => e.min < 78);
    console.log(`\n=== FLIP ANATOMY (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`${ENCS.length} encounters (<120u), ${sub78.length} sub-78; flips/enc med ${q(ENCS.map(e => e.flips), .5)} p75 ${q(ENCS.map(e => e.flips), .75)}; hit rate sub-78: ${(100 * sub78.filter(e => e.hit).length / Math.max(1, sub78.length)).toFixed(0)}%`);
    const byCls = {};
    for (const f of FLIPS) byCls[f.cls] = (byCls[f.cls] || 0) + 1;
    console.log(`flip classes: ${Object.entries(byCls).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v} (${(100 * v / FLIPS.length).toFixed(0)}%)`).join('  ')}`);
    for (const cls of Object.keys(byCls)) {
        const F = FLIPS.filter(f => f.cls === cls);
        console.log(`${cls.padEnd(10)} clr med ${q(F.map(f => f.clr), .5)}u  rebuild<0.5s ${(100 * F.filter(f => f.rebuild).length / F.length).toFixed(0)}%  rival ${(100 * F.filter(f => f.rival).length / F.length).toFixed(0)}%  armed ${(100 * F.filter(f => f.armed).length / F.length).toFixed(0)}%  |dDes| med ${q(F.map(f => f.dDes).filter(x => x != null), .5)}  |dCmd| med ${q(F.map(f => f.dCmd).filter(x => x != null), .5)}  gap med ${q(F.map(f => f.gap), .5)}s`);
    }
    const hi = ENCS.filter(e => e.flips >= 2), lo = ENCS.filter(e => e.flips < 2);
    console.log(`encounters flips>=2: ${hi.length} (hit ${(100 * hi.filter(e => e.hit).length / Math.max(1, hi.length)).toFixed(0)}%)  flips<2: ${lo.length} (hit ${(100 * lo.filter(e => e.hit).length / Math.max(1, lo.length)).toFixed(0)}%)`);
    fs.writeFileSync(path.join(__dirname, `_flip_anatomy_${path.basename(ROOT)}_${SEED0}.json`), JSON.stringify({ FLIPS, ENCS }, null, 1));
    console.log(`wrote _flip_anatomy_${path.basename(ROOT)}_${SEED0}.json`);
})();
