// P2 zoom — WHAT KILLS THE WAY? For every leg-2 pass through the mark-3 cove
// (600u), a 2Hz timeline; for passes that stall (<1 kt), the state in the 6 s
// BEFORE the first sub-1kt sample: TWA (luffing?), local wind (glass?),
// avoidance deflection (deflected up into the stall?), rounding phase.
//   node _lake_stall.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treePH0');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const passes = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const mk = legTargetPoint(2);
            const R = 600;
            const cur = {}; const done = [];
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                if (it % 30 === 0) {
                    for (const b of bots) {
                        if (b.raceState.finished) continue;
                        const dM = Math.hypot(b.x - mk.x, b.y - mk.y);
                        if (dM < R && !cur[b.name] && b.raceState.leg === 2) {
                            cur[b.name] = { seed, name: b.name, tl: [] };
                        }
                        if (cur[b.name]) {
                            const c = b.controller || {};
                            const w = getWindAt(b.x, b.y);
                            const twa = Math.abs(norm(b.heading - w.direction)) * 180 / Math.PI;
                            cur[b.name].tl.push([+ (b.speed * 4).toFixed(2), +twa.toFixed(0), +w.speed.toFixed(1),
                                +((c.lastAvoidDeviation || 0) * 180 / Math.PI).toFixed(1),
                                b.raceState.roundArmed ? 1 : 0, +dM.toFixed(0)]);
                            if (dM > R * 1.2) { done.push(cur[b.name]); delete cur[b.name]; }
                        }
                    }
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            for (const nm of Object.keys(cur)) done.push(cur[nm]);
            return done;
        }, seed);
        passes.push(...r);
        console.log(`seed ${seed}: passes ${r.length}`);
    }
    fs.writeFileSync(path.join(__dirname, 'lake_stall.json'), JSON.stringify(passes));
    const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(1); };
    const dirty = [], clean = [];
    for (const p of passes) {
        const kts = p.tl.map(s => s[0]);
        (Math.min(...kts) < 1.0 ? dirty : clean).push(p);
    }
    console.log(`\npasses ${passes.length}: stall(<1kt) ${dirty.length}, clean ${clean.length}`);
    const pre = { twa: [], wkt: [], av: [], armed: [], dM: [] };
    const at = { twa: [], wkt: [], dM: [] };
    for (const p of dirty) {
        const kts = p.tl.map(s => s[0]);
        const i0 = kts.findIndex(k => k < 1.0);
        const win = p.tl.slice(Math.max(0, i0 - 12), i0);   // 6s before
        if (!win.length) continue;
        pre.twa.push(med(win.map(s => s[1])));
        pre.wkt.push(med(win.map(s => s[2])));
        pre.av.push(med(win.map(s => s[3])));
        pre.armed.push(win.some(s => s[4]) ? 1 : 0);
        pre.dM.push(med(win.map(s => s[5])));
        at.twa.push(p.tl[i0][1]); at.wkt.push(p.tl[i0][2]); at.dM.push(p.tl[i0][5]);
    }
    console.log('6s BEFORE first stall: TWA med', med(pre.twa), ' wind med', med(pre.wkt), 'kt  avDeg med', med(pre.av), ' roundArmed:', (100 * pre.armed.reduce((a, b) => a + b, 0) / pre.armed.length).toFixed(0) + '%', ' dMark med', med(pre.dM));
    console.log('AT stall: TWA med', med(at.twa), ' wind med', med(at.wkt), ' dMark med', med(at.dM));
    const luff = pre.twa.filter(x => x < 55).length, glass = pre.wkt.filter(x => x < 4).length, defl = pre.av.filter(x => x > 15).length;
    console.log(`classes (pre-stall window): LUFF(TWA<55) ${(100 * luff / pre.twa.length).toFixed(0)}%  GLASS(wind<4kt) ${(100 * glass / pre.wkt.length).toFixed(0)}%  DEFLECTED(av>15deg) ${(100 * defl / pre.av.length).toFixed(0)}%`);
    // clean reference at same dMark band
    const cref = { twa: [], wkt: [] };
    for (const p of clean) for (const s of p.tl) if (s[5] < 350) { cref.twa.push(s[1]); cref.wkt.push(s[2]); }
    console.log('clean passes inside 350u: TWA med', med(cref.twa), ' wind med', med(cref.wkt));
    await browser.close();
})();
