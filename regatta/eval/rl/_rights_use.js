// RIGHTS-USE LEDGER (2026-08-24 night, the rounding-craft + rights push).
// Owner: "the AI doesn't use its rights enough — STBD v PORT, LEEWARD v
// WINDWARD, earlier entry into the rounding zone v later. Do what you want
// with confidence; if the other boat doesn't do its part, last-moment
// avoidance and let THEM take the penalty." His measured ROW profile:
// 11-23° median deflection at CPA (gw-ledger).
//
// Per PAIR-EPISODE (opens d<250u, closes d>320u or 60s), fleet races:
//   role at onset (Rules.getRightOfWay), markRoom holder if any
//   ROW boat's max |heading - heading@onset| until CPA   (maxDev)
//   minD (CPA), rowHeld (was the rival in the ROW boat's _rowHold at CPA)
//   UNFORCED deflection: maxDev>30° AND minD>=80u (deflection never needed)
//   HELD-YET-DEFLECTED: maxDev>30° while hold active (a lower layer stole it)
//   zone episodes (onset within 2.5*zone of a round mark, both on that leg):
//     markRoom holder at onset; who rounds ahead; who takes the inside line
//   contact (minD<40) and per-boat penalty deltas across the episode
// Episodes not frames (rule 2); roles re-read at CPA (role can flip).
//   node _rights_use.js <venue> <trials> <seed0> <tree>
// Writes _rights_<venue>_<tree>.json.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
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
                if (e && e.kind === 'round' && e.mark) rounds.push({ leg: i, x: e.mark.x, y: e.mark.y, zone: e.mark.zone });
            }
            const DT = 1 / 60;
            const open = {}; const doneEps = [];
            const bots = () => state.boats.filter(x => !x.isPlayer);
            // AVOIDANCE-OWNED deviation, per boat per frame: |command - nav intent|.
            // Heading-from-onset conflates rounding turns and tacks with
            // deflection (the zone numbers would be pure rounding turn); the
            // honest rights statistic is what applyAvoidance ADDS.
            // ⚠️ controllers are created lazily (undefined right after
            // startRace) — wrap lazily, every frame, any unwrapped controller.
            const wrapAll = () => {
                for (const bo of state.boats) {
                    if (bo.isPlayer) continue;
                    const c = bo.controller;
                    if (!c || !c.applyAvoidance || c.__rwrapped) continue;
                    const orig = c.applyAvoidance.bind(c);
                    c.applyAvoidance = (dh, sr) => { const out = orig(dh, sr); bo._avDev = Math.abs(norm(out - dh)); return out; };
                    c.__rwrapped = 1;
                }
            };
            for (let it = 0; it < 60 * 900; it++) {
                // zero BEFORE update: a penalty-spinning boat skips applyAvoidance
                // entirely (standing rule 27b) and a stale _avDev would persist
                for (const bo of state.boats) bo._avDev = 0;
                wrapAll();
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const t = it * DT;
                const bs = bots();
                for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
                    const A = bs[i], B = bs[j];
                    if (A.raceState.finished || B.raceState.finished) continue;
                    if (A.raceState.leg < 1 || B.raceState.leg < 1) continue; // racing legs only, start regime is sacred
                    const d = Math.hypot(A.x - B.x, A.y - B.y);
                    const key = i + '-' + j;
                    let E = open[key];
                    if (!E) {
                        if (d >= 250) continue;
                        let row = null; try { row = Rules.getRightOfWay(A, B); } catch (e) { }
                        const rowIsA = row && row.boat === A;
                        const rowIsB = row && row.boat === B;
                        if (!rowIsA && !rowIsB) continue;
                        const R = rowIsA ? A : B, G = rowIsA ? B : A;
                        let zi = null;
                        for (const rm of rounds) {
                            const dm = Math.hypot(R.x - rm.x, R.y - rm.y);
                            if (dm < rm.zone * 2.5 && A.raceState.leg === rm.leg && B.raceState.leg === rm.leg) { zi = rm; break; }
                        }
                        E = open[key] = { t0: t, rowName: R.name, gwName: G.name, rule: row.rule,
                            mrHolder: row.markRoom != null ? (row.markRoom === A.id ? A.name : (row.markRoom === B.id ? B.name : null)) : null,
                            h0: R.heading, g0: G.heading, minD: d, maxDev: 0, gwMaxDev: 0,
                            avDevAtCPA: 0, maxAvDev: 0, gwAvDevAtCPA: 0,
                            heldAtCPA: 0, devWhileHeld: 0, zone: zi ? zi.leg : null,
                            penA0: A.raceState.totalPenalties, penB0: B.raceState.totalPenalties,
                            aName: A.name, bName: B.name, closestA: 1e9, closestB: 1e9,
                            legA0: A.raceState.leg, advFirst: null };
                    }
                    const R = bs.find(x => x.name === E.rowName), G = bs.find(x => x.name === E.gwName);
                    if (!R || !G) { delete open[key]; continue; }
                    const dev = Math.abs(norm(R.heading - E.h0));
                    const gdev = Math.abs(norm(G.heading - E.g0));
                    const held = R.controller && R.controller._rowHold && R.controller._rowHold.has(G);
                    const avR = R._avDev || 0, avG = G._avDev || 0;
                    if (avR > E.maxAvDev) E.maxAvDev = avR;
                    if (d < E.minD) { E.minD = d; E.heldAtCPA = held ? 1 : 0; E.avDevAtCPA = avR; E.gwAvDevAtCPA = avG; }
                    if (dev > E.maxDev) E.maxDev = dev;
                    if (gdev > E.gwMaxDev) E.gwMaxDev = gdev;
                    if (held && avR > 0.52) E.devWhileHeld = 1;
                    if (E.zone != null) {
                        const rm = rounds.find(x => x.leg === E.zone);
                        const da = Math.hypot(A.x - rm.x, A.y - rm.y), db = Math.hypot(B.x - rm.x, B.y - rm.y);
                        if (da < E.closestA) E.closestA = da;
                        if (db < E.closestB) E.closestB = db;
                        if (E.advFirst == null) {
                            if (A.raceState.leg > E.zone) E.advFirst = A.name;
                            else if (B.raceState.leg > E.zone) E.advFirst = B.name;
                        }
                    }
                    if (d > 320 || t - E.t0 > 60) {
                        E.dur = +(t - E.t0).toFixed(1);
                        E.contact = E.minD < 40 ? 1 : 0;
                        E.penA = A.raceState.totalPenalties - E.penA0;
                        E.penB = B.raceState.totalPenalties - E.penB0;
                        doneEps.push(E);
                        delete open[key];
                    }
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return doneEps.map(E => ({ rule: E.rule, mrHolder: E.mrHolder, rowName: E.rowName, gwName: E.gwName,
                aName: E.aName, bName: E.bName, minD: Math.round(E.minD),
                avDevAtCPA: +(E.avDevAtCPA * 180 / Math.PI).toFixed(0),
                maxAvDev: +(E.maxAvDev * 180 / Math.PI).toFixed(0),
                gwAvDevAtCPA: +(E.gwAvDevAtCPA * 180 / Math.PI).toFixed(0),
                maxDev: +(E.maxDev * 180 / Math.PI).toFixed(0),
                gwMaxDev: +(E.gwMaxDev * 180 / Math.PI).toFixed(0), heldAtCPA: E.heldAtCPA, devWhileHeld: E.devWhileHeld,
                zone: E.zone, closestA: E.closestA < 1e9 ? Math.round(E.closestA) : null,
                closestB: E.closestB < 1e9 ? Math.round(E.closestB) : null, advFirst: E.advFirst,
                dur: E.dur, contact: E.contact, penA: E.penA, penB: E.penB }));
        }, seed);
        for (const row of r) EPS.push({ ...row, seed });
        console.log(`seed ${seed}: ${r.length} episodes`);
    }
    await b.close();
    fs.writeFileSync(path.join(__dirname, `_rights_${VENUE}_${TREE}.json`), JSON.stringify({ VENUE, EPS }));

    const q = (a, pp) => { const v = a.filter(x => x != null && isFinite(x)); if (!v.length) return NaN; const s = v.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const pct = (n, d) => d ? (100 * n / d).toFixed(0) + '%' : '—';
    console.log(`\n=== ${VENUE.toUpperCase()} RIGHTS-USE LEDGER (${EPS.length} episodes, ${TRIALS} seeds) ===`);
    console.log(`ROW avoidance-owned dev AT CPA: med ${q(EPS.map(e => e.avDevAtCPA), .5)}°  p75 ${q(EPS.map(e => e.avDevAtCPA), .75)}°  max-in-episode med ${q(EPS.map(e => e.maxAvDev), .5)}°  (his profile: 11-23°)`);
    console.log(`ROW heading-from-onset maxDev (incl. turns/tacks): med ${q(EPS.map(e => e.maxDev), .5)}°`);
    const unforced = EPS.filter(e => e.maxAvDev > 30 && e.minD >= 80);
    console.log(`UNFORCED ROW deflection (dev>30° & CPA>=80u): ${pct(unforced.length, EPS.length)} of episodes`);
    const held = EPS.filter(e => e.heldAtCPA);
    console.log(`hold active at CPA: ${pct(held.length, EPS.length)};  deflected >30° WHILE held: ${pct(EPS.filter(e => e.devWhileHeld).length, EPS.length)}`);
    console.log(`give-way maxDev med ${q(EPS.map(e => e.gwMaxDev), .5)}°  |  contacts ${EPS.filter(e => e.contact).length}  |  pens in-episode: ROW ${EPS.reduce((s, e) => s + (e.rowName === e.aName ? e.penA : e.penB), 0)}, give-way ${EPS.reduce((s, e) => s + (e.rowName === e.aName ? e.penB : e.penA), 0)}`);
    const byRule = {};
    for (const e of EPS) byRule[e.rule] = (byRule[e.rule] || 0) + 1;
    console.log(`by rule: ${Object.entries(byRule).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join('  ')}`);
    const Z = EPS.filter(e => e.zone != null);
    console.log(`\nZONE EPISODES (onset within 2.5*zone of a round mark): ${Z.length}`);
    const mrZ = Z.filter(e => e.mrHolder);
    const mrInside = mrZ.filter(e => (e.mrHolder === e.aName ? e.closestA < e.closestB : e.closestB < e.closestA));
    const mrAhead = mrZ.filter(e => e.advFirst && e.advFirst === e.mrHolder);
    console.log(`mark-room holder known at onset: ${mrZ.length};  holder took the INSIDE line: ${pct(mrInside.length, mrZ.length)};  holder advanced FIRST: ${pct(mrAhead.length, mrZ.filter(e => e.advFirst).length)}`);
    console.log(`ROW max avoidance-dev in zone episodes: med ${q(Z.map(e => e.maxAvDev), .5)}°  vs open-water med ${q(EPS.filter(e => e.zone == null).map(e => e.maxAvDev), .5)}°`);
    console.log(`give-way avoidance-dev at CPA: med ${q(EPS.map(e => e.gwAvDevAtCPA), .5)}°`);
})();
