// WHY DOES THE MARK-ROOM HOLDER GIVE UP THE INSIDE LINE? (2026-08-25, Z1-v2
// research). Z1 (entitlement grants the _rowHold) converted lake (holder-inside
// 27->65%) but not bay (51->44%) or redrock (38->33%). This asks, per zone
// pair-episode where the rules engine names a mark-room holder, what is
// steering the HOLDER at her moment of maximum avoidance-owned deviation:
//   pairRival   the obligated rival is the nearest boat (<200u)
//   thirdBoat   a DIFFERENT boat is nearer than the pair rival
//   landNear    grid clearance at the holder < 3 cells (land dominates)
//   markBerth   holder within 78u + bodyR of the mark (the berth radius)
//   heldPair    was the pair rival in the holder's _rowHold at that frame
//   holderIsRow was the holder also the plain ROW boat of the pair
// plus the outcome (holder took inside / advanced first) so causes correlate
// with conceded lines. Episodes as in _rights_use (zone onset, 2.5z).
//   node _mr_why.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9400;
const TREE = process.argv[5] || 'treeN1';
const ROOT = path.join(__dirname, TREE);
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const EPS = [];
    for (let t = 0; t < TRIALS; t++) {
        const seed = SEED0 + t;
        const r = await p.evaluate((seed) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const rounds = [];
            const route = state.course.route || [];
            for (let i = 0; i < route.length; i++) {
                const e = route[i];
                if (e && e.kind === 'round' && e.mark) rounds.push({ leg: i, m: e.mark });
            }
            const wrapAll = () => {
                for (const bo of state.boats) {
                    if (bo.isPlayer) continue;
                    const c = bo.controller;
                    if (!c || !c.applyAvoidance || c.__mwrap) continue;
                    const orig = c.applyAvoidance.bind(c);
                    c.applyAvoidance = (dh, sr) => { const out = orig(dh, sr); bo._avDev = Math.abs(norm(out - dh)); return out; };
                    c.__mwrap = 1;
                }
            };
            const gG = () => state.course.botGrid;
            const DT = 1 / 60; const open = {}; const done = [];
            for (let it = 0; it < 60 * 900; it++) {
                for (const bo of state.boats) bo._avDev = 0;
                wrapAll();
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const t = it * DT;
                const bs = state.boats.filter(x => !x.isPlayer && !x.raceState.finished);
                for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
                    const A = bs[i], B = bs[j];
                    const d = Math.hypot(A.x - B.x, A.y - B.y);
                    const key = i + '-' + j;
                    let E = open[key];
                    if (!E) {
                        if (d >= 250) continue;
                        let row = null; try { row = Rules.getRightOfWay(A, B); } catch (e) { }
                        if (!row || row.markRoom == null) continue;
                        const H = row.markRoom === A.id ? A : (row.markRoom === B.id ? B : null);
                        if (!H) continue;
                        const O = H === A ? B : A;
                        let zi = null;
                        for (const rm of rounds) {
                            if (A.raceState.leg !== rm.leg || B.raceState.leg !== rm.leg) continue;
                            if (Math.hypot(H.x - rm.m.x, H.y - rm.m.y) < rm.m.zone * 2.5) { zi = rm; break; }
                        }
                        if (!zi) continue;
                        E = open[key] = { t0: t, hName: H.name, oName: O.name, leg: zi.leg,
                            maxDev: 0, at: null, closestH: 1e9, closestO: 1e9, advFirst: null,
                            holderRow: row.boat === H ? 1 : 0 };
                    }
                    const H = bs.find(x => x.name === E.hName), O = bs.find(x => x.name === E.oName);
                    if (!H || !O) { delete open[key]; continue; }
                    const rm = rounds.find(x => x.leg === E.leg);
                    const dH = Math.hypot(H.x - rm.m.x, H.y - rm.m.y), dO = Math.hypot(O.x - rm.m.x, O.y - rm.m.y);
                    if (dH < E.closestH) E.closestH = dH;
                    if (dO < E.closestO) E.closestO = dO;
                    if (E.advFirst == null) {
                        if (H.raceState.leg > E.leg) E.advFirst = 'H';
                        else if (O.raceState.leg > E.leg) E.advFirst = 'O';
                    }
                    const av = H._avDev || 0;
                    if (av > E.maxDev) {
                        E.maxDev = av;
                        // classify the moment
                        let nearest = null, nd = 1e9;
                        for (const ob of bs) {
                            if (ob === H) continue;
                            const dd = Math.hypot(ob.x - H.x, ob.y - H.y);
                            if (dd < nd) { nd = dd; nearest = ob; }
                        }
                        const g = gG();
                        let clr = null;
                        if (g && g._clear) { const cc = g.cell(H.x, H.y); clr = g._clear[cc[1] * g.n + cc[0]]; }
                        E.at = {
                            pairRival: nearest === O && nd < 200 ? 1 : 0,
                            thirdBoat: nearest !== O && nd < 200 ? 1 : 0,
                            landNear: clr != null && clr < 3 ? 1 : 0,
                            markBerth: dH < 78 + (rm.m.bodyR || 12) ? 1 : 0,
                            heldPair: H.controller && H.controller._rowHold && H.controller._rowHold.has(O) ? 1 : 0,
                            dev: +(av * 180 / Math.PI).toFixed(0)
                        };
                    }
                    if (d > 320 || t - E.t0 > 60) {
                        E.inside = E.closestH < E.closestO ? 1 : 0;
                        done.push(E); delete open[key];
                    }
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return done.map(E => ({ leg: E.leg, inside: E.inside, advFirst: E.advFirst,
                holderRow: E.holderRow, maxDev: +(E.maxDev * 180 / Math.PI).toFixed(0), at: E.at }));
        }, seed);
        for (const e of r) EPS.push({ ...e, seed });
        console.log(`seed ${seed}: ${r.length} holder episodes`);
    }
    await b.close();
    fs.writeFileSync(path.join(__dirname, `_mrwhy_${VENUE}_${TREE}.json`), JSON.stringify(EPS));
    const pct = (n, d) => d ? (100 * n / d).toFixed(0) + '%' : '—';
    console.log(`\n=== ${VENUE.toUpperCase()} MARK-ROOM HOLDER ANATOMY (${EPS.length} episodes, ${TREE}) ===`);
    console.log(`holder took inside: ${pct(EPS.filter(e => e.inside).length, EPS.length)};  holder also plain-ROW at onset: ${pct(EPS.filter(e => e.holderRow).length, EPS.length)}`);
    const W = EPS.filter(e => e.at);
    const conceded = W.filter(e => !e.inside), kept = W.filter(e => e.inside);
    const line = (label, rows) => {
        if (!rows.length) { console.log(`${label}: n=0`); return; }
        const s = (k) => pct(rows.filter(e => e.at[k]).length, rows.length);
        const dv = rows.map(e => e.at.dev).sort((a, c) => a - c)[Math.floor(rows.length / 2)];
        console.log(`${label} (n=${rows.length}): maxDev med ${dv}°  @maxDev: pairRival ${s('pairRival')}  thirdBoat ${s('thirdBoat')}  landNear ${s('landNear')}  markBerth ${s('markBerth')}  heldPair ${s('heldPair')}`);
    };
    line('CONCEDED the inside', conceded);
    line('KEPT the inside    ', kept);
})();
