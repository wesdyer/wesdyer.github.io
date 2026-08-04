// Arctic TRANSIT decomposition (start->ARM, the 257s-vs-human-100 sink):
// per boat: transit time, odometer vs DMC leg length (detour ratio), slow
// time (spd<0.8), grind time (within 1s of a land/floe contact), and the
// same split for the RETURN (leg2->fin). node _transit_probe.js <trials> <seed0> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
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
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            window.__lastHit = {};
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
            const legLen = state.course.dmc.legs.map(l => Math.round(l.length));
            const st = bots.map(b => ({ name: b.name, ph: null, px: b.x, py: b.y,
                seg: { transit: { t: 0, d: 0, slow: 0, grind: 0 }, ret: { t: 0, d: 0, slow: 0, grind: 0 } },
                tArm: null, fin: null }));
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                const t = state.race.timer;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], s = st[k];
                    if (s.fin != null) continue;
                    if (b.raceState.finished) { s.fin = Math.round(t); continue; }
                    let ph = null;
                    if (b.raceState.leg === 1 && !b.raceState.roundArmed && s.tArm == null) ph = 'transit';
                    else if (b.raceState.leg === 1 && b.raceState.roundArmed && s.tArm == null) { s.tArm = Math.round(t); }
                    else if (b.raceState.leg === 2) ph = 'ret';
                    if (ph == null) { s.px = b.x; s.py = b.y; continue; }
                    const g = s.seg[ph];
                    g.t += dt;
                    g.d += Math.hypot(b.x - s.px, b.y - s.py);
                    if (b.speed < 0.8) g.slow += dt;
                    const lh = window.__lastHit[b.name];
                    if (lh != null && t - lh < 1.0) g.grind += dt;
                    s.px = b.x; s.py = b.y;
                }
            }
            return { legLen, st: st.map(s => ({ name: s.name, tArm: s.tArm, fin: s.fin,
                transit: { t: +s.seg.transit.t.toFixed(0), d: Math.round(s.seg.transit.d), slow: +s.seg.transit.slow.toFixed(0), grind: +s.seg.transit.grind.toFixed(0) },
                ret: { t: +s.seg.ret.t.toFixed(0), d: Math.round(s.seg.ret.d), slow: +s.seg.ret.slow.toFixed(0), grind: +s.seg.ret.grind.toFixed(0) } })) };
        }, seed);
        rows.push(...r.st.map(x => ({ seed, legLen: r.legLen, ...x })));
        console.log(`seed ${seed} done`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    for (const ph of ['transit', 'ret']) {
        const g = rows.filter(r => r[ph].t > 5);
        const L = ph === 'transit' ? rows[0].legLen[1] : rows[0].legLen[2];
        console.log(`\n${ph.toUpperCase()} (n=${g.length}, dmcLen ${L}):`);
        console.log(`  time   med ${med(g.map(r => r[ph].t))} mean ${mean(g.map(r => r[ph].t)).toFixed(0)}`);
        console.log(`  dist ratio med ${med(g.map(r => r[ph].d / L)).toFixed(2)}`);
        console.log(`  slow   med ${med(g.map(r => r[ph].slow))} mean ${mean(g.map(r => r[ph].slow)).toFixed(0)}  (share ${(100 * mean(g.map(r => r[ph].slow)) / mean(g.map(r => r[ph].t))).toFixed(0)}%)`);
        console.log(`  grind  med ${med(g.map(r => r[ph].grind))} mean ${mean(g.map(r => r[ph].grind)).toFixed(0)}  (share ${(100 * mean(g.map(r => r[ph].grind)) / mean(g.map(r => r[ph].t))).toFixed(0)}%)`);
    }
    await browser.close();
})();
