// Bay FAT-TAIL attribution (2026-08-03d residual): the lean half sails
// L3/L5 at ratio 1.18-1.21 while ratio>=1.7 boats sail 60s legs with 5
// gybes. Same 1Hz window attribution as _transit_probe (rec/turn/avoid/
// offrt/sail excess vs DMC progress), applied to bay legs 3 and 5, PLUS
// per-window traffic (rivals within 350u) and rounding-phase flags
// (rulerMode/armed at the window edge) so the tail's excess lands in
// named bins: traffic-avoid vs rounding-approach vs open-water churn.
// Read-only at frame boundaries; races byte-identical.
//   node _bay_tail_probe.js <trials> <seed0> [tree] [label]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeB');
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
            const pl = state.boats.find(b => b.isPlayer); pl.x = 5900; pl.y = -6100;
            const bots = state.boats.filter(b => !b.isPlayer);
            const legs = state.course.dmc.legs;
            const legLen = legs.map(l => Math.round(l.length));
            const mkSeg = () => ({ t: 0, d: 0, ds: 0, weave: 0, lateral: 0,
                exRec: 0, exTurn: 0, exAvoid: 0, exOffrt: 0, exSail: 0,
                exAvBoat: 0, exAvStatic: 0, exAvNone: 0,
                trafW: 0, armW: 0, winN: 0,
                exTraf: 0, exArm: 0, exOpen: 0,
                tacks: 0, gybes: 0 });
            const st = bots.map(b => ({ name: b.name, px: b.x, py: b.y,
                seg: { L3: mkSeg(), L5: mkSeg() },
                fin: null,
                wx: b.x, wy: b.y, wOdo: 0, wAvoid: 0, wFrames: 0, wRec: false, wThreat: 0,
                wFlip: false, wHead0: b.heading, hint: null, sPrev: null, phPrev: null,
                board: 0 }));
            const dt = 1 / 60;
            let frame = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                const t = state.race.timer;
                frame++;
                const windowEdge = (frame % 60 === 0);
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], s = st[k];
                    if (s.fin != null) continue;
                    if (b.raceState.finished) { s.fin = Math.round(t); continue; }
                    let ph = null;
                    if (b.raceState.leg === 3) ph = 'L3';
                    else if (b.raceState.leg === 5) ph = 'L5';
                    if (ph !== s.phPrev) {
                        s.phPrev = ph; s.hint = null; s.sPrev = null;
                        s.wx = b.x; s.wy = b.y; s.wOdo = 0; s.wAvoid = 0; s.wFrames = 0;
                        s.wRec = false; s.wThreat = 0; s.wFlip = false; s.wHead0 = b.heading;
                        s.board = 0;
                    }
                    if (ph == null) { s.px = b.x; s.py = b.y; continue; }
                    const g = s.seg[ph];
                    const step = Math.hypot(b.x - s.px, b.y - s.py);
                    g.t += dt; g.d += step; s.wOdo += step; s.wFrames++;
                    const c = b.controller;
                    if (c) {
                        s.wAvoid += Math.abs(c.lastAvoidDeviation || 0);
                        if (c.threatBoat) s.wThreat++;
                        if (c.wiggleActive || c.clearanceTimer > 0 || c.livenessState !== 'normal') s.wRec = true;
                    }
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
                    const legPath = legs[ph === 'L3' ? 3 : 5];
                    const sNow = CoursePath.project(legPath, b.x, b.y, s.hint);
                    s.hint = sNow;
                    let xp = null;
                    {
                        const cum = legPath.cum, pts = legPath.pts;
                        let kk = 1;
                        while (kk < cum.length - 1 && cum[kk] < sNow) kk++;
                        const tt = (sNow - cum[kk - 1]) / Math.max(1e-6, cum[kk] - cum[kk - 1]);
                        xp = { x: pts[kk - 1].x + (pts[kk].x - pts[kk - 1].x) * tt,
                               y: pts[kk - 1].y + (pts[kk].y - pts[kk - 1].y) * tt };
                    }
                    const xtk = Math.hypot(b.x - xp.x, b.y - xp.y);
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
                        const hadBoat = s.wThreat > 10;
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
                        if (hadBoat) g.exAvBoat += excessW;
                        else if (hadStatic) g.exAvStatic += excessW;
                        else g.exAvNone += excessW;
                    }
                    // traffic + rounding-phase ownership of the window
                    g.winN++;
                    let near = 0;
                    for (const o of state.boats) {
                        if (o === b || o.raceState.finished) continue;
                        if ((o.x - b.x) ** 2 + (o.y - b.y) ** 2 < 350 * 350) near++;
                    }
                    const inRound = !!(c && (c._rulerMode || b.raceState.roundArmed));
                    if (near > 0) g.trafW++;
                    if (inRound) g.armW++;
                    if (near > 0) g.exTraf += excessW;
                    else if (inRound) g.exArm += excessW;
                    else g.exOpen += excessW;
                    s.wx = b.x; s.wy = b.y; s.wOdo = 0; s.wAvoid = 0; s.wFrames = 0;
                    s.wRec = false; s.wThreat = 0; s.wFlip = false; s.wHead0 = b.heading;
                }
            }
            const rnd = o => { const q = {}; for (const kk in o) q[kk] = Math.round(o[kk] * 10) / 10; return q; };
            return { legLen, st: st.map(s => ({ name: s.name, fin: s.fin,
                L3: rnd(s.seg.L3), L5: rnd(s.seg.L5) })) };
        }, seed);
        rows.push(...r.st.map(x => ({ seed, legLen: r.legLen, ...x })));
        console.log(`seed ${seed} done`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    for (const ph of ['L3', 'L5']) {
        const li = ph === 'L3' ? 3 : 5;
        const g0 = rows.filter(r => r[ph].t > 5 && r.legLen[li] > 0);
        const L = rows[0].legLen[li];
        for (const [name, sel] of [['TAIL (d/L>=1.55)', r => r[ph].d / L >= 1.55],
                                   ['LEAN (d/L<1.55)', r => r[ph].d / L < 1.55]]) {
            const g = g0.filter(sel);
            if (!g.length) { console.log(`\n${ph} ${name}: none`); continue; }
            const S = f => mean(g.map(r => r[ph][f]));
            const exTot = S('exRec') + S('exTurn') + S('exAvoid') + S('exOffrt') + S('exSail');
            console.log(`\n${ph} ${name} (n=${g.length}, dmcLen ${L}):`);
            console.log(`  time med ${med(g.map(r => r[ph].t)).toFixed(0)}  ratio med ${med(g.map(r => r[ph].d / L)).toFixed(2)}  tacks ${S('tacks').toFixed(1)} gybes ${S('gybes').toFixed(1)}`);
            console.log(`  EXCESS mean ${exTot.toFixed(0)}u = rec ${S('exRec').toFixed(0)} | turn ${S('exTurn').toFixed(0)} | avoid ${S('exAvoid').toFixed(0)} (boat ${S('exAvBoat').toFixed(0)}/static ${S('exAvStatic').toFixed(0)}/none ${S('exAvNone').toFixed(0)}) | offrt ${S('exOffrt').toFixed(0)} | sail ${S('exSail').toFixed(0)}`);
            console.log(`  ownership: traffic ${S('exTraf').toFixed(0)}u | rounding ${S('exArm').toFixed(0)}u | open ${S('exOpen').toFixed(0)}u   (window shares: traf ${(100 * S('trafW') / Math.max(1, S('winN'))).toFixed(0)}% arm ${(100 * S('armW') / Math.max(1, S('winN'))).toFixed(0)}%)`);
        }
    }
    if (LABEL) {
        fs.writeFileSync(path.join(__dirname, `bay_tail_${LABEL}.json`), JSON.stringify(rows));
        console.log(`\nwrote bay_tail_${LABEL}.json`);
    }
    await browser.close();
})();
