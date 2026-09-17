// FLATS CENSUS (2026-09-16, the flats push). Per boat per race, on the ten-bot bench
// protocol (same construction as ocean_bench so the seeds correspond): archetype and
// NERVE (the ladder rung the router may take), finish and leg times, every passage the
// boat used (nearest `tide.passages` line within riskHalfW while off the channel rim,
// with the tide level at entry/exit and the minimum depth), grounding EPISODES and
// seconds aground (`boat.aground`, rule 2: episodes not frames), seconds slowed by the
// mud (tideMul < 1 afloat), seconds holding for the tide (controller.tideWait), ground
// distance (positions, rule 32), tacks + gybes (TWA sign changes with a 3 s debounce),
// OCS and penalties. Then the fleet split BY NERVE, which is the only honest way to read
// a venue whose pack shape is authored (the ladder). Groundings are NOT collision_island
// events — the bench's `land` column is blind to them, hence this probe.
//   node _fl_census.js <trials> <seed0> <tree> [outLabel]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3, SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeFL0');
const OUT = process.argv[5] || null;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => {
        const s = { venue: 'flats', character: AI_CONFIG[0].name };
        localStorage.setItem('regatta_settings', JSON.stringify(s));
    });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false);
            pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(b => b !== pl);
            const meanPct = nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length;
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, meanPct));
            pl.ai.setupDist = 300;
            const bots = state.boats.filter(b => !b.isPlayer);
            const doc = state.course.doc, pass = (doc.tide && doc.tide.passages) || [];
            const HW = 300;
            const dseg = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const L = dx * dx + dy * dy || 1; let u = ((px - a[0]) * dx + (py - a[1]) * dy) / L; u = Math.max(0, Math.min(1, u)); return Math.hypot(px - (a[0] + u * dx), py - (a[1] + u * dy)); };
            const nearPass = (x, y) => { let best = null, bd = 1e9; for (const p of pass) { for (let k = 1; k < p.pts.length; k++) { const d = dseg(x, y, p.pts[k - 1], p.pts[k]); if (d < bd) { bd = d; best = p; } } } return bd <= HW ? best : null; };
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const info = bots.map(b => ({ name: b.name, arch: b.archetype, nerve: b.traits ? b.traits.nerve : null, legT: {}, fin: null, pen: 0, ocs: 0,
                dist: 0, agroundEp: 0, agroundS: 0, slowS: 0, mudS: 0, waitS: 0, waitEp: 0, tacks: 0, gybes: 0, segs: [], cur: null, wasAground: false, wasWait: false, lastTack: 0, lastTackT: -99, px: b.x, py: b.y, minD: 9, offChanS: 0, trk: [] }));
            const dt = 1 / 60;
            let sampleK = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 900) break;
                sampleK++;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], f = info[k];
                    if (b.raceState.finished) { if (f.fin == null) { f.fin = +t.toFixed(1); f.pen = b.raceState.totalPenalties || 0; if (f.cur) { f.segs.push(f.cur); f.cur = null; } } continue; }
                    if (b.raceState.ocs) f.ocs = 1;
                    const lg = b.raceState.leg;
                    if (f.legT[lg] == null) f.legT[lg] = +t.toFixed(1);
                    f.dist += Math.hypot(b.x - f.px, b.y - f.py); f.px = b.x; f.py = b.y;
                    if (b.aground) { f.agroundS += dt; if (!f.wasAground) f.agroundEp++; f.wasAground = true; }
                    else { f.wasAground = false; if (b.tideMul != null && b.tideMul < 1) { f.slowS += dt; if (b.tideMul < 0.6) f.mudS += dt; } }
                    const c = b.controller;
                    const w = !!(c && c.tideWait);
                    if (w) { f.waitS += dt; if (!f.wasWait) f.waitEp++; }
                    f.wasWait = w;
                    // manoeuvres: TWA sign
                    const wd = getWindAt(b.x, b.y).direction;
                    const twa = norm(b.heading - wd);
                    const tk = twa > 0 ? 1 : -1;
                    if (f.lastTack && tk !== f.lastTack && t - f.lastTackT > 3) { if (Math.abs(twa) < Math.PI / 2) f.tacks++; else f.gybes++; f.lastTackT = t; }
                    if (tk !== f.lastTack) f.lastTack = tk;
                    if (sampleK % 30 === 0) f.trk.push([+t.toFixed(1), Math.round(b.x), Math.round(b.y), b.aground ? 1 : 0, +(b.tideMul == null ? 1 : b.tideMul).toFixed(2)]);
                    // passages, sampled at 6 Hz
                    if (sampleK % 10 === 0 && lg >= 2) {
                        const g = Tide.groundAt(b.x, b.y);
                        const d = (b.depth != null) ? b.depth : Tide.depthAt(b.x, b.y);
                        if (d < f.minD) f.minD = d;
                        const off = g > -1.6;
                        if (off) f.offChanS += 10 * dt;
                        const p = off ? nearPass(b.x, b.y) : null;
                        const id = p ? p.id : null;
                        if (f.cur && f.cur.id !== id) { f.segs.push(f.cur); f.cur = null; }
                        if (id && !f.cur) f.cur = { id, risk: p.risk, t0: +t.toFixed(1), L0: +Tide.levelAt(t).toFixed(2), minD: d, n: 0, agr: 0 };
                        if (f.cur) { f.cur.t1 = +t.toFixed(1); f.cur.L1 = +Tide.levelAt(t).toFixed(2); f.cur.minD = Math.min(f.cur.minD, d); f.cur.n++; if (b.aground) f.cur.agr++; }
                    }
                }
                if (info.every(f => f.fin != null)) break;
            }
            for (const [k, b] of bots.entries()) { if (info[k].fin == null) info[k].pen = b.raceState.totalPenalties || 0; if (info[k].cur) { info[k].segs.push(info[k].cur); info[k].cur = null; } }
            return info.map(f => ({ ...f, segs: f.segs.filter(s => s.n >= 12).map(s => ({ id: s.id, risk: s.risk, t0: s.t0, t1: s.t1, L0: s.L0, L1: s.L1, minD: +s.minD.toFixed(2), agr: s.agr })), dist: Math.round(f.dist), agroundS: +f.agroundS.toFixed(1), slowS: +f.slowS.toFixed(1), mudS: +f.mudS.toFixed(1), waitS: +f.waitS.toFixed(1), minD: +f.minD.toFixed(2), offChanS: +f.offChanS.toFixed(1), cur: undefined, px: undefined, py: undefined, wasAground: undefined, wasWait: undefined, lastTack: undefined, lastTackT: undefined }));
        }, seed);
        for (const f of r) all.push({ seed, ...f });
        console.log(`seed ${seed}:`);
        for (const f of r.sort((a, b) => (a.fin || 999) - (b.fin || 999))) {
            const segs = f.segs.map(s => `${s.id}${s.risk ? '(r' + s.risk + ')' : ''}@${s.t0}-${s.t1}s L${s.L0}->${s.L1} d${s.minD}${s.agr ? ' AGR' + s.agr : ''}`).join(' | ');
            console.log(`  ${String(f.fin || 'DNF').padStart(6)} ${(f.arch || '-').padEnd(9)} n${f.nerve} ${f.name.padEnd(10)} legs ${f.legT[1]}/${f.legT[2]} dist ${f.dist} T${f.tacks}/G${f.gybes} agr ${f.agroundEp}ep/${f.agroundS}s slow ${f.slowS}s mud ${f.mudS}s wait ${f.waitEp}ep/${f.waitS}s offCh ${f.offChanS}s minD ${f.minD} pen ${f.pen}${f.ocs ? ' OCS' : ''}  ${segs}`);
        }
    }
    // BY NERVE
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    console.log('\nBY NERVE (boats, fins, fin med/mean, agr ep/boat, agr s/boat, slow s/boat, wait s/boat, dist med, tacks+gybes mean, passages used per boat):');
    for (const nv of [0, 1, 2, 3]) {
        const S = all.filter(f => f.nerve === nv); if (!S.length) continue;
        const fins = S.filter(f => f.fin != null).map(f => f.fin);
        const pc = {}; for (const f of S) for (const s of f.segs) pc[s.id] = (pc[s.id] || 0) + 1;
        console.log(`  nerve ${nv}: ${S.length} boats, ${fins.length} fins, fin med ${med(fins)} mean ${mean(fins).toFixed(1)}, agr ${mean(S.map(f => f.agroundEp)).toFixed(2)} ep / ${mean(S.map(f => f.agroundS)).toFixed(1)} s, slow ${mean(S.map(f => f.slowS)).toFixed(1)} s, wait ${mean(S.map(f => f.waitS)).toFixed(1)} s, dist med ${med(S.map(f => f.dist))}, T+G ${mean(S.map(f => f.tacks + f.gybes)).toFixed(1)}, passages ${Object.entries(pc).map(([k, v]) => `${k}:${(v / S.length).toFixed(2)}`).join(' ')}`);
    }
    if (OUT) fs.writeFileSync(path.join(__dirname, `_fl_census_${OUT}.json`), JSON.stringify(all));
    await browser.close();
})();
