// THE DEPTH LADDER (2026-08-30, post-C1). On avoidance-owned out-of-band ticks
// (desired heading in the 30-50 deg band, chosen heading >= 50 deg), how DEEP does
// the fan go, and why? Each tick's fan is sorted by the |TWA| it lands on; we ask:
//   - was a SHALLOWER veto-free candidate available (>= 10 deg shallower than chosen)?
//   - by how much did it lose, and which term carried the gap (prox / riv / base)?
//   - depth chosen by risk class.
// A depth driven by VETO (only the deep candidate is clear) is honest; a depth driven
// by PRICE (shallower clear candidates lose on the proximity gradient) is the C2
// question in its simplest form.
//   node _pa_depth.js <venue> <leg> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay', LEG = parseInt(process.argv[3] || '1');
const TRIALS = parseInt(process.argv[4] || '4'), SEED0 = parseInt(process.argv[5] || '9400');
const ROOT = path.join(__dirname, process.argv[6] || 'treePA');
(async () => {
    const br = await chromium.launch(); const page = await br.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            window.__AVDBG = { full: 1 };
            const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const out = []; const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.__AVLOG = [];
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (const e of window.__AVLOG) {
                    const b = state.boats.find(x => x.name === e.n); if (!b || b.raceState.leg !== LEG || !e.full) continue;
                    const wd = getWindAt(b.x, b.y).direction;
                    const twa0 = Math.abs(nm(e.h0 - wd)) * 180 / Math.PI;
                    const best = e.full.reduce((m, r) => r.cost < m.cost ? r : m, e.full[0]);
                    const twaB = Math.abs(nm(e.h0 + best.off - wd)) * 180 / Math.PI;
                    if (!(twa0 >= 30 && twa0 < 50 && twaB >= 50)) continue;
                    const rows = e.full.map(r => ({ r, twa: Math.abs(nm(e.h0 + r.off - wd)) * 180 / Math.PI, clean: !r.sc && !r.bc && !r.rv }));
                    // shallower = lands at least 10 deg closer to the wind than the chosen one, and outside the pinch (>= 30)
                    const shallow = rows.filter(x => x.twa >= 30 && x.twa <= twaB - 10);
                    const shallowClean = shallow.filter(x => x.clean);
                    let sc = null;
                    if (shallowClean.length) {
                        const c = shallowClean.reduce((m, x) => x.r.cost < m.r.cost ? x : m, shallowClean[0]);
                        const dProx = (c.r.prox || 0) - (best.prox || 0), dRiv = (c.r.riv || 0) - (best.riv || 0);
                        const dBase = (c.r.cost - (c.r.prox || 0) - (c.r.riv || 0)) - (best.cost - (best.prox || 0) - (best.riv || 0));
                        const gap = c.r.cost - best.cost;
                        // base split, _re_why's convention: pre = cost before rival terms (deviation, C1, no-go...),
                        // mk = mark terms, late = land probe / floe / liveness / gap (after prox)
                        const split = (r) => ({ pre: r.pre || 0, mk: (r.mkp != null ? r.mkp - (r.pre || 0) - (r.riv || 0) : 0), late: r.cost - (r.mkp || 0) - (r.prox || 0) });
                        const sC = split(c.r), sB = split(best);
                        const dPre = sC.pre - sB.pre, dMk = sC.mk - sB.mk, dLate = sC.late - sB.late;
                        const parts = { prox: dProx, riv: dRiv, pre: dPre, mk: dMk, late: dLate };
                        const dom = Object.entries(parts).reduce((m, x) => x[1] > m[1] ? x : m, ['?', -Infinity])[0];
                        const s0 = nm(e.h0 - wd) > 0 ? 1 : -1;
                        const board = (nm(e.h0 + c.r.off - wd) > 0 ? 1 : -1) === s0 ? 'same' : 'other';
                        sc = { rowC: c.r, rowB: best, twa: c.twa, off: c.r.off, board, gap, dProx, dRiv, dBase, dPre, dMk, dLate, dom, nShallow: shallow.length, nClean: shallowClean.length };
                    }
                    // veto census over the shallower set
                    const vet = { bc: 0, sc: 0, rv: 0 };
                    for (const x of shallow) { if (x.r.bc) vet.bc++; else if (x.r.sc) vet.sc++; else if (x.r.rv) vet.rv++; }
                    out.push({ twa0, twaB, risk: e.risk || '?', role: e.role || 'NONE', rng: e.rng, sc, nShallow: shallow.length, vet,
                               chosenClean: !best.sc && !best.bc && !best.rv, bestCost: best.cost, bestProx: best.prox || 0 });
                }
                if (state.boats.every(x => x.raceState.finished)) break;
            }
            return out;
        }, { seed: SEED0 + t, LEG });
        all.push(...r);
    }
    await br.close();
    const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
    const p = (n, d) => (100 * n / Math.max(1, d)).toFixed(0) + '%';
    const n = all.length;
    console.log(`\n══ ${VENUE} leg ${LEG} — THE DEPTH LADDER (tree ${path.basename(ROOT)}, ${n} avoidance-owned out-of-band ticks, ${TRIALS} seeds)`);
    console.log(`  chosen |TWA| med ${med(all.map(x => x.twaB)).toFixed(0)} deg (p25 ${med(all.map(x=>x.twaB).sort((a,b)=>a-b).slice(0, Math.max(1, n>>1))).toFixed(0)}, p75 ${med(all.map(x=>x.twaB).sort((a,b)=>a-b).slice(n>>1)).toFixed(0)}); desired med ${med(all.map(x => x.twa0)).toFixed(0)}`);
    const byRisk = {}; for (const x of all) (byRisk[x.risk] = byRisk[x.risk] || []).push(x.twaB);
    console.log('  chosen depth by risk: ' + Object.entries(byRisk).map(([k, v]) => `${k} ${p(v.length, n)} med ${med(v).toFixed(0)}deg`).join(' | '));
    const withShallow = all.filter(x => x.nShallow > 0);
    const shallowClean = all.filter(x => x.sc);
    console.log(`  a >=10deg SHALLOWER candidate existed in the fan on ${p(withShallow.length, n)}; a VETO-FREE shallower one on ${p(shallowClean.length, n)}`);
    const vb = withShallow.reduce((a, x) => a + x.vet.bc, 0), vs = withShallow.reduce((a, x) => a + x.vet.sc, 0), vr = withShallow.reduce((a, x) => a + x.vet.rv, 0), vt = withShallow.reduce((a, x) => a + x.nShallow, 0);
    console.log(`  shallower candidates vetoed: boat ${p(vb, vt)}  static ${p(vs, vt)}  rule ${p(vr, vt)}  clean ${p(vt - vb - vs - vr, vt)}  (of ${vt} shallower slots)`);
    if (shallowClean.length) {
        const g = shallowClean.map(x => x.sc);
        const dom = {}; for (const x of g) dom[x.dom] = (dom[x.dom] || 0) + 1;
        console.log(`  cheapest veto-free shallower: lands at med ${med(g.map(x => x.twa)).toFixed(0)} deg vs chosen ${med(shallowClean.map(x => x.twaB)).toFixed(0)}; loses by med ${med(g.map(x => x.gap)).toFixed(0)} (p25 ${med(g.map(x=>x.gap).sort((a,b)=>a-b).slice(0, Math.max(1, g.length>>1))).toFixed(0)}); gap carried by: ${Object.entries(dom).map(([k, v]) => `${k} ${p(v, g.length)}`).join('  ')}`);
        const big = g.filter(x => x.gap >= 1000); const domB = {}; for (const x of big) domB[x.dom] = (domB[x.dom] || 0) + 1;
        console.log(`  the >=1000 class (${big.length}): carried by ${Object.entries(domB).sort((a,b)=>b[1]-a[1]).map(([k, v]) => `${k} ${p(v, big.length)}`).join('  ')}; med dPre ${med(big.map(x=>x.dPre)).toFixed(0)} dMk ${med(big.map(x=>x.dMk)).toFixed(0)} dLate ${med(big.map(x=>x.dLate)).toFixed(0)} dProx ${med(big.map(x=>x.dProx)).toFixed(0)} dRiv ${med(big.map(x=>x.dRiv)).toFixed(0)}`);
        const hist = {}; for (const x of big) { const k = Math.round(x.dLate / 100) * 100; hist[k] = (hist[k] || 0) + 1; }
        console.log(`  dLate histogram (>=1000 class, rounded to 100): ${Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${v}`).join(' ')}`);
        const hp = {}; for (const x of big) { const k = Math.round(x.dProx / 100) * 100; hp[k] = (hp[k] || 0) + 1; }
        console.log(`  dProx histogram (>=1000 class): ${Object.entries(hp).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${v}`).join(' ')}`);
        for (const x of big.slice(0, 3)) console.log('   sample rows  clean:', JSON.stringify(x.rowC), ' chosen:', JSON.stringify(x.rowB));
        const bd = {}; for (const x of g) bd[x.board] = (bd[x.board] || 0) + 1; const off0 = g.filter(x => x.off === 0).length;
        console.log(`  that candidate is on the ${Object.entries(bd).map(([k, v]) => `${k} board ${p(v, g.length)}`).join(', ')}; it IS the desired heading (offset 0) on ${p(off0, g.length)}`);
        const small = g.filter(x => x.gap < 100); const domS = {}; for (const x of small) domS[x.dom] = (domS[x.dom] || 0) + 1;
        console.log(`  the <100 class (${small.length}): carried by ${Object.entries(domS).sort((a,b)=>b[1]-a[1]).map(([k, v]) => `${k} ${p(v, small.length)}`).join('  ')}; chosen depth there med ${med(small.map(x => x.twa)).toFixed(0)} -> ${med(shallowClean.filter(x => x.sc.gap < 100).map(x => x.twaB)).toFixed(0)} deg`);
        console.log(`  gap decomposition medians: dProx ${med(g.map(x => x.dProx)).toFixed(0)}  dRiv ${med(g.map(x => x.dRiv)).toFixed(0)}  dBase ${med(g.map(x => x.dBase)).toFixed(0)}; chosen cost med ${med(shallowClean.map(x => x.bestCost)).toFixed(0)} prox ${med(shallowClean.map(x => x.bestProx)).toFixed(0)}`);
        const nSmall = g.filter(x => x.gap < 100).length, mid = g.filter(x => x.gap >= 100 && x.gap < 1000).length;
        console.log(`  gap < 100: ${p(nSmall, g.length)}   100-1000: ${p(mid, g.length)}   >= 1000: ${p(g.length - nSmall - mid, g.length)}`);
    }
    console.log(`  role: ${Object.entries(all.reduce((a, x) => (a[x.role] = (a[x.role] || 0) + 1, a), {})).map(([k, v]) => k + ' ' + p(v, n)).join(' ')}; nearest rival med ${med(all.map(x => x.rng).filter(x => x != null))} u`);
})();
