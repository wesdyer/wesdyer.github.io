// WRONG-WAY ENTRY DIAGNOSIS (2026-08-24 night, rounding-craft push, F3).
// The census: fleet enters the rounding zone AGAINST the required rotation on
// 17-56% of episodes (him ~0%) on redrock/lagoon. At the moment each bot
// crosses 1.2*zone inbound on a round leg, record who was steering and which
// way the hull was actually moving:
//   vTan   sign of tangential velocity vs required rotation (neg = wrong way)
//   state  rulerMode / entryBrg set / already armed / avoidance dev >20°
//   dBrg   angular distance (required way) from boat bearing to the hunt's
//          chosen entry sector (null if no hunt)
//   node _entry_why.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 2;
const SEED0 = parseInt(process.argv[4]) || 9400;
const TREE = process.argv[5] || 'treeN1';
const ROOT = path.join(__dirname, TREE);
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const ROWS = [];
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
                    if (!c || !c.applyAvoidance || c.__ewrap) continue;
                    const orig = c.applyAvoidance.bind(c);
                    c.applyAvoidance = (dh, sr) => { const out = orig(dh, sr); bo._avDev = Math.abs(norm(out - dh)); return out; };
                    c.__ewrap = 1;
                }
            };
            const DT = 1 / 60; const out = []; const prev = {};
            for (let it = 0; it < 60 * 900; it++) {
                for (const bo of state.boats) bo._avDev = 0;
                wrapAll();
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats.filter(x => !x.isPlayer && !x.raceState.finished)) {
                    for (const rc of rounds) {
                        if (bo.raceState.leg !== rc.leg) continue;
                        const key = bo.name + ':' + rc.leg;
                        const dx = bo.x - rc.m.x, dy = bo.y - rc.m.y;
                        const d = Math.hypot(dx, dy);
                        const was = prev[key]; prev[key] = d;
                        if (was == null || !(was >= rc.m.zone * 1.2 && d < rc.m.zone * 1.2)) continue;
                        const sgn = rc.m.side === 'port' ? -1 : 1;
                        // tangential unit the required way: rotate radial by sgn*90°
                        const rx = dx / d, ry = dy / d;
                        const tx = -ry * sgn, ty = rx * sgn;
                        const sp = (bo.speed || 0) * 60;
                        const vx = Math.sin(bo.heading) * sp, vy = -Math.cos(bo.heading) * sp;
                        const vTan = vx * tx + vy * ty;
                        const c = bo.controller || {};
                        let dBrg = null;
                        if (c._entryBrg != null) {
                            const myBrg = Math.atan2(dy, dx);
                            let da = (c._entryBrg - myBrg) * sgn;
                            while (da < 0) da += Math.PI * 2;
                            while (da >= Math.PI * 2) da -= Math.PI * 2;
                            dBrg = +(da * 180 / Math.PI).toFixed(0);
                        }
                        const wdE = getWindAt(bo.x, bo.y).direction;
                        const twaE = Math.abs(norm(bo.heading - wdE)) * 180 / Math.PI;
                        out.push({ leg: rc.leg, vTan: +vTan.toFixed(0), wrong: vTan < -5 ? 1 : 0,
                            ruler: c._rulerMode ? 1 : 0, hunt: c._entryBrg != null ? 1 : 0,
                            armed: bo.raceState.roundArmed ? 1 : 0, avDev: +( (bo._avDev||0) * 180/Math.PI).toFixed(0),
                            dBrg, sp: Math.round(sp), twa: Math.round(twaE) });
                    }
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return out;
        }, seed);
        ROWS.push(...r);
        console.log(`seed ${seed}: ${r.length} zone entries`);
    }
    await b.close();
    const pct = (n, d) => d ? (100 * n / d).toFixed(0) + '%' : '—';
    console.log(`\n=== ${VENUE.toUpperCase()} ZONE-ENTRY (1.2z inbound crossings, ${ROWS.length}) ===`);
    const legs = [...new Set(ROWS.map(r => r.leg))].sort();
    for (const L of legs) {
        const A = ROWS.filter(r => r.leg === L), W = A.filter(r => r.wrong);
        console.log(`LEG ${L}: entries ${A.length}, wrong-way ${pct(W.length, A.length)}` +
            `  | wrong-way state: ruler ${pct(W.filter(r => r.ruler).length, W.length)} hunt ${pct(W.filter(r => r.hunt).length, W.length)} armed@entry ${pct(W.filter(r => r.armed).length, W.length)} avDev>20 ${pct(W.filter(r => r.avDev > 20).length, W.length)}` +
            `  | right-way state: ruler ${pct(A.filter(r => !r.wrong && r.ruler).length, A.length - W.length)} hunt ${pct(A.filter(r => !r.wrong && r.hunt).length, A.length - W.length)} avDev>20 ${pct(A.filter(r => !r.wrong && r.avDev > 20).length, A.length - W.length)}`);
        const db = (rows) => { const v = rows.map(r => r.dBrg).filter(x => x != null); v.sort((a, b2) => a - b2); return v.length ? v[Math.floor(v.length / 2)] : '—'; };
        console.log(`        dBrg-to-hunt-sector med: wrong ${db(W)}°  right ${db(A.filter(r => !r.wrong))}°  | speed med wrong ${(W.map(r=>r.sp).sort((a,b2)=>a-b2)[Math.floor(W.length/2)]||'—')} right ${(A.filter(r=>!r.wrong).map(r=>r.sp).sort((a,b2)=>a-b2)[Math.floor((A.length-W.length)/2)]||'—')}`);
        const md = (rows, k) => { const v = rows.map(r => r[k]).filter(x => x != null).sort((a, b2) => a - b2); return v.length ? v[Math.floor(v.length / 2)] : '—'; };
        console.log(`        TWA at entry med: wrong ${md(W, 'twa')}°  right ${md(A.filter(r => !r.wrong), 'twa')}°  | wrong upwind(<51°): ${pct(W.filter(r => r.twa < 51).length, W.length)}  reach(51-126°): ${pct(W.filter(r => r.twa >= 51 && r.twa < 126).length, W.length)}  run: ${pct(W.filter(r => r.twa >= 126).length, W.length)}`);
    }
})();
