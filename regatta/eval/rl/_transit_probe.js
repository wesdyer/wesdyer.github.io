// Arctic TRANSIT decomposition (start->ARM, the 257s-vs-human-100 sink):
// per boat: transit time, odometer vs DMC leg length (detour ratio), slow
// time (spd<0.8), grind time (within 1s of a land/floe contact), and the
// same split for the RETURN (leg2->fin). node _transit_probe.js <trials> <seed0> [tree] [label]
//
// 2026-08-03d EXTENSION — 1Hz cause attribution. The totals said ratio ~2.0;
// this build says WHY. Per boat, per 1s window:
//   odoW  = odometer this second (60Hz sum)
//   dispW = straight-line displacement this second
//   dsW   = progress of the boat's projection along the DMC leg path
// so  weave   = odoW - dispW   (curvature burned inside the second)
//     lateral = dispW - max(dsW,0)  (movement that wasn't DMC progress)
// and every window is owned by one mode (priority order):
//     rec   = wiggle / clearance / liveness force|recovery active
//     turn  = board flip (tack/gybe) or >57deg heading swing this second
//     avoid = applyAvoidance bent the heading >0.12 rad on average
//     offrt = >300u cross-track from the DMC line
//     sail  = none of the above: the boat is doing what it means to do
// Plus: tack/gybe counts (hysteresis on TWA sign), falsebeat = sail-mode
// distance sailed close-hauled (|TWA|<0.9) while the DMC tangent right there
// is fetchable on one board (|twaPath|>1.1), carrot jumpiness (_lastNav moved
// >150u between seconds), heading-vs-carrot mean error in sail mode, and a
// static TWA-demand histogram of the DMC legs themselves (does the course
// even ask for tacking?). Sampling is read-only at frame boundaries — the
// race is byte-identical to an uninstrumented run.
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
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => {
        const inner = window.onRaceEvent;
        window.__lastHit = {}; // boat name -> race timer of last island/floe contact
        window.onRaceEvent = (ty, d) => {
            try {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer)
                    window.__lastHit[d.boat.name] = state.race.timer;
            } catch (e) {}
            return inner && inner(ty, d);
        };
    });
    const rows = [];
    let demand = null;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            window.__lastHit = {};
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
            const legs = state.course.dmc.legs;
            const legLen = legs.map(l => Math.round(l.length));

            // Static TWA demand of the DMC legs at t=0 wind (does the course ask
            // for tacking?): walk each leg, tangent vs local wind every ~150u.
            const twaDemand = {};
            for (const li of [1, 2]) {
                const L = legs[li]; if (!L || !L.pts || L.pts.length < 2) continue;
                const h = { up: 0, reach: 0, run: 0, n: 0 };
                for (let k = 0; k < L.pts.length - 1; k++) {
                    const a = L.pts[k], b = L.pts[k + 1];
                    const seg = Math.hypot(b.x - a.x, b.y - a.y);
                    if (seg < 1) continue;
                    const brg = Math.atan2(b.x - a.x, -(b.y - a.y));
                    const wd = getWindAt((a.x + b.x) / 2, (a.y + b.y) / 2).direction;
                    const twa = Math.abs(normalizeAngle(brg - wd));
                    const w = seg;
                    if (twa < 0.96) h.up += w; else if (twa > Math.PI * 0.7) h.run += w; else h.reach += w;
                    h.n += w;
                }
                twaDemand[li] = { up: +(h.up / h.n).toFixed(2), reach: +(h.reach / h.n).toFixed(2), run: +(h.run / h.n).toFixed(2) };
            }

            const mkSeg = () => ({ t: 0, d: 0, slow: 0, grind: 0,
                weave: 0, lateral: 0, ds: 0,
                exRec: 0, exTurn: 0, exAvoid: 0, exOffrt: 0, exSail: 0,
                exAvBoat: 0, exAvStatic: 0, exAvBoth: 0, exAvNone: 0,
                avDevSum: 0, avDevN: 0,
                falsebeat: 0, sailD: 0, tacks: 0, gybes: 0,
                xtkSum: 0, xtkN: 0, xtkFar: 0, carrotJump: 0,
                hvcSum: 0, hvcN: 0 });
            const st = bots.map(b => ({ name: b.name, px: b.x, py: b.y,
                seg: { transit: mkSeg(), ret: mkSeg() },
                tArm: null, fin: null,
                // window state
                wx: b.x, wy: b.y, wOdo: 0, wAvoid: 0, wFrames: 0, wRec: false, wThreat: 0,
                wFlip: false, wHead0: b.heading, hint: null, sPrev: null, phPrev: null,
                board: 0, navPrev: null }));
            const dt = 1 / 60;
            let frame = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                const t = state.race.timer;
                frame++;
                const windowEdge = (frame % 60 === 0);
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], s = st[k];
                    if (s.fin != null) continue;
                    if (b.raceState.finished) { s.fin = Math.round(t); continue; }
                    let ph = null;
                    if (b.raceState.leg === 1 && !b.raceState.roundArmed && s.tArm == null) ph = 'transit';
                    else if (b.raceState.leg === 1 && b.raceState.roundArmed && s.tArm == null) { s.tArm = Math.round(t); }
                    else if (b.raceState.leg === 2) ph = 'ret';
                    if (ph !== s.phPrev) {   // phase change: reset window + projection
                        s.phPrev = ph; s.hint = null; s.sPrev = null;
                        s.wx = b.x; s.wy = b.y; s.wOdo = 0; s.wAvoid = 0; s.wFrames = 0;
                        s.wRec = false; s.wThreat = 0; s.wFlip = false; s.wHead0 = b.heading; s.navPrev = null;
                        s.board = 0;
                    }
                    if (ph == null) { s.px = b.x; s.py = b.y; continue; }
                    const g = s.seg[ph];
                    const step = Math.hypot(b.x - s.px, b.y - s.py);
                    g.t += dt; g.d += step; s.wOdo += step; s.wFrames++;
                    if (b.speed < 0.8) g.slow += dt;
                    const lh = window.__lastHit[b.name];
                    if (lh != null && t - lh < 1.0) g.grind += dt;
                    const c = b.controller;
                    if (c) {
                        s.wAvoid += Math.abs(c.lastAvoidDeviation || 0);
                        if (c.threatBoat) s.wThreat++;
                        if (c.wiggleActive || c.clearanceTimer > 0 || c.livenessState !== 'normal') s.wRec = true;
                    }
                    // board tracking (tack/gybe with hysteresis)
                    const wdB = getWindAt(b.x, b.y).direction;
                    const twaB = normalizeAngle(b.heading - wdB);
                    if (Math.abs(twaB) > 0.2 && Math.abs(twaB) < Math.PI - 0.2) {
                        const nb = twaB > 0 ? 1 : -1;
                        if (s.board !== 0 && nb !== s.board) {
                            s.wFlip = true;
                            if (Math.abs(twaB) < Math.PI / 2) g.tacks++; else g.gybes++;
                        }
                        s.board = nb;
                    }
                    s.px = b.x; s.py = b.y;
                    if (!windowEdge) continue;
                    // ---- 1Hz window close-out ----
                    const legPath = legs[ph === 'transit' ? 1 : 2];
                    const sNow = CoursePath.project(legPath, b.x, b.y, s.hint);
                    s.hint = sNow;
                    // cross-track: distance to path point at sNow
                    let xp = null;
                    {
                        const cum = legPath.cum, pts = legPath.pts;
                        let kk = 1;
                        while (kk < cum.length - 1 && cum[kk] < sNow) kk++;
                        const tt = (sNow - cum[kk - 1]) / Math.max(1e-6, cum[kk] - cum[kk - 1]);
                        xp = { x: pts[kk - 1].x + (pts[kk].x - pts[kk - 1].x) * tt,
                               y: pts[kk - 1].y + (pts[kk].y - pts[kk - 1].y) * tt,
                               tx: pts[kk].x - pts[kk - 1].x, ty: pts[kk].y - pts[kk - 1].y };
                    }
                    const xtk = Math.hypot(b.x - xp.x, b.y - xp.y);
                    g.xtkSum += xtk; g.xtkN++;
                    if (xtk > 300) g.xtkFar++;
                    const dispW = Math.hypot(b.x - s.wx, b.y - s.wy);
                    const dsW = (s.sPrev == null) ? 0 : (sNow - s.sPrev);
                    s.sPrev = sNow;
                    g.ds += Math.max(0, dsW);
                    g.weave += Math.max(0, s.wOdo - dispW);
                    g.lateral += Math.max(0, dispW - Math.max(0, dsW));
                    const excessW = Math.max(0, s.wOdo - Math.max(0, dsW));
                    const headSwing = Math.abs(normalizeAngle(b.heading - s.wHead0));
                    const avoidMean = s.wFrames ? s.wAvoid / s.wFrames : 0;
                    let cls = 'exSail';
                    if (s.wRec) cls = 'exRec';
                    else if (s.wFlip || headSwing > 1.0) cls = 'exTurn';
                    else if (avoidMean > 0.12) cls = 'exAvoid';
                    else if (xtk > 300) cls = 'exOffrt';
                    g[cls] += excessW;
                    if (cls === 'exAvoid') {
                        // sub-bin the avoidance windows by WHAT is being avoided:
                        // a rival boat (threatBoat present) vs static/soft ice ahead
                        // on the PRE-avoidance desired course (prevDesired).
                        g.avDevSum += avoidMean; g.avDevN++;
                        const hadBoat = s.wThreat > 10;   // >10 of ~60 frames
                        let hadStatic = false;
                        const gr = state.course.botGrid;
                        if (gr && c && c.prevDesired != null) {
                            for (const dd of [120, 240, 360]) {
                                const px = b.x + Math.sin(c.prevDesired) * dd;
                                const py = b.y - Math.cos(c.prevDesired) * dd;
                                const cc = gr.cell(px, py);
                                if (!gr.at(cc[0], cc[1])) { hadStatic = true; break; }
                            }
                        }
                        if (hadBoat && hadStatic) g.exAvBoth += excessW;
                        else if (hadBoat) g.exAvBoat += excessW;
                        else if (hadStatic) g.exAvStatic += excessW;
                        else g.exAvNone += excessW;
                    }
                    if (cls === 'exSail') {
                        g.sailD += s.wOdo;
                        const brgT = Math.atan2(xp.tx, -xp.ty);
                        const twaPath = Math.abs(normalizeAngle(brgT - wdB));
                        const twaBoat = Math.abs(normalizeAngle(b.heading - wdB));
                        if (twaBoat < 0.9 && twaPath > 1.1) g.falsebeat += s.wOdo;
                        const nav = c && c._lastNav;
                        if (nav) {
                            const brgN = Math.atan2(nav.x - b.x, -(nav.y - b.y));
                            g.hvcSum += Math.abs(normalizeAngle(b.heading - brgN));
                            g.hvcN++;
                        }
                    }
                    const nav = c && c._lastNav;
                    if (nav && s.navPrev && Math.hypot(nav.x - s.navPrev.x, nav.y - s.navPrev.y) > 150) g.carrotJump++;
                    if (nav) s.navPrev = { x: nav.x, y: nav.y };
                    s.wx = b.x; s.wy = b.y; s.wOdo = 0; s.wAvoid = 0; s.wFrames = 0;
                    s.wRec = false; s.wThreat = 0; s.wFlip = false; s.wHead0 = b.heading;
                }
            }
            const rnd = o => { const q = {}; for (const kk in o) q[kk] = Math.round(o[kk] * 10) / 10; return q; };
            return { legLen, twaDemand, st: st.map(s => ({ name: s.name, tArm: s.tArm, fin: s.fin,
                transit: rnd(s.seg.transit), ret: rnd(s.seg.ret) })) };
        }, seed);
        rows.push(...r.st.map(x => ({ seed, legLen: r.legLen, ...x })));
        if (!demand) demand = r.twaDemand;
        console.log(`seed ${seed} done`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    console.log(`\nDMC TWA demand (t=0 wind, dist share): leg1 up ${demand[1].up} reach ${demand[1].reach} run ${demand[1].run}`
        + ` | leg2 up ${demand[2].up} reach ${demand[2].reach} run ${demand[2].run}`);
    for (const ph of ['transit', 'ret']) {
        const g = rows.filter(r => r[ph].t > 5);
        const L = ph === 'transit' ? rows[0].legLen[1] : rows[0].legLen[2];
        const S = f => mean(g.map(r => r[ph][f]));
        const exTot = S('exRec') + S('exTurn') + S('exAvoid') + S('exOffrt') + S('exSail');
        console.log(`\n${ph.toUpperCase()} (n=${g.length}, dmcLen ${L}):`);
        console.log(`  time   med ${med(g.map(r => r[ph].t)).toFixed(0)} mean ${S('t').toFixed(0)}`);
        console.log(`  dist ratio med ${med(g.map(r => r[ph].d / L)).toFixed(2)}   odo mean ${S('d').toFixed(0)}  dmc-progress mean ${S('ds').toFixed(0)}`);
        console.log(`  slow   med ${med(g.map(r => r[ph].slow))} mean ${S('slow').toFixed(0)}  (share ${(100 * S('slow') / S('t')).toFixed(0)}%)`);
        console.log(`  grind  med ${med(g.map(r => r[ph].grind))} mean ${S('grind').toFixed(0)}  (share ${(100 * S('grind') / S('t')).toFixed(0)}%)`);
        console.log(`  EXCESS mean ${exTot.toFixed(0)}u  =  rec ${S('exRec').toFixed(0)} | turn ${S('exTurn').toFixed(0)} | avoid ${S('exAvoid').toFixed(0)} | offrt ${S('exOffrt').toFixed(0)} | sail ${S('exSail').toFixed(0)}`);
        console.log(`  avoid sub-bins: boat ${S('exAvBoat').toFixed(0)} | static ${S('exAvStatic').toFixed(0)} | both ${S('exAvBoth').toFixed(0)} | none ${S('exAvNone').toFixed(0)}   mean dev ${(57.3 * mean(g.filter(r => r[ph].avDevN > 0).map(r => r[ph].avDevSum / r[ph].avDevN))).toFixed(0)}deg`);
        console.log(`  form: weave ${S('weave').toFixed(0)}u vs lateral ${S('lateral').toFixed(0)}u`);
        console.log(`  tacks med ${med(g.map(r => r[ph].tacks))} mean ${S('tacks').toFixed(1)}  gybes med ${med(g.map(r => r[ph].gybes))} mean ${S('gybes').toFixed(1)}`);
        console.log(`  falsebeat ${(100 * S('falsebeat') / Math.max(1, S('sailD'))).toFixed(0)}% of sail-mode dist  | hdg-vs-carrot mean ${(mean(g.filter(r => r[ph].hvcN > 0).map(r => r[ph].hvcSum / r[ph].hvcN)) * 57.3).toFixed(0)}deg`);
        console.log(`  xtrack mean ${(S('xtkSum') / Math.max(1, S('xtkN'))).toFixed(0)}u  >300u ${(100 * S('xtkFar') / Math.max(1, S('xtkN'))).toFixed(0)}% of samples  | carrotJump ${(60 * S('carrotJump') / Math.max(1, S('t'))).toFixed(1)}/min`);
    }
    if (LABEL) {
        fs.writeFileSync(path.join(__dirname, `transit_attrib_${LABEL}.json`), JSON.stringify(rows));
        console.log(`\nwrote transit_attrib_${LABEL}.json`);
    }
    await browser.close();
})();
