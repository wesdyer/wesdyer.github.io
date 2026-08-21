// RIVER LATE-TACK QUANTIFIER (2026-08-21, the wedge push): at every hull
// side-change on a racing leg, how much water was left AHEAD on the old
// course (grid-walked distance to the first blocked cell), and what was
// her speed through the tack? A channel tack taken with <1s of water left,
// slow, is the "late/blocked tack" the wedge discriminator named (~49% of
// river wedge entries). Distribution per venue; his corpus lacks a grid
// walk so this is the BOT-side mechanism quantification.
//   node _tack_trigger.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'river';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGWE');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const rows = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const st = new Map();
            const out = [];
            const aheadWater = (x, y, hdg) => {
                const g = state.course.botGrid || state.course._botGridStatic;
                if (!g) return null;
                for (let d = 20; d <= 800; d += 20) {
                    const c = g.cell(x + Math.sin(hdg) * d, y - Math.cos(hdg) * d);
                    if (!g.at(c[0], c[1])) return d;
                }
                return 800;
            };
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
                if (state.race.status !== 'racing' || (it % 3)) continue;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished || bt.raceState.leg < 1) continue;
                    const side = window.Rules.getTack(bt);
                    if (!side) continue;
                    let s = st.get(bt.id);
                    if (!s) { st.set(bt.id, { side, stable: 0, preH: bt.heading, preSpd: bt.speed, preX: bt.x, preY: bt.y }); continue; }
                    if (side === s.side) {
                        s.stable++;
                        // remember the pre-tack pose while stable
                        if (s.stable >= 10) { s.preH = bt.heading; s.preSpd = bt.speed; s.preX = bt.x; s.preY = bt.y; }
                        continue;
                    }
                    if (s.stable >= 30) {
                        const ahead = aheadWater(s.preX, s.preY, s.preH);
                        const spdU = s.preSpd * 60;
                        out.push({ t: +state.race.timer.toFixed(1), n: bt.name, leg: bt.raceState.leg,
                                   aheadU: ahead, preKt: +(s.preSpd * 4).toFixed(1),
                                   aheadS: ahead != null && spdU > 5 ? +(ahead / spdU).toFixed(1) : null });
                    }
                    s.side = side; s.stable = 0;
                }
            }
            return out;
        }, seed);
        for (const r of rows) { r.seed = seed; all.push(r); }
        console.log(`seed ${seed}: ${rows.length} tacks`);
    }
    await browser.close();
    const q = (a, p) => a[Math.floor(a.length * p)];
    const ah = all.map(r => r.aheadU).filter(x => x != null).sort((a, b) => a - b);
    const as = all.map(r => r.aheadS).filter(x => x != null).sort((a, b) => a - b);
    const kt = all.map(r => r.preKt).sort((a, b) => a - b);
    console.log(`\n${all.length} tacks — water AHEAD at tack (pre-tack course, grid walk):`);
    console.log(`aheadU p10/p25/med/p75: ${q(ah,.1)}/${q(ah,.25)}/${q(ah,.5)}/${q(ah,.75)} u`);
    console.log(`ahead in SECONDS p10/p25/med: ${q(as,.1)}/${q(as,.25)}/${q(as,.5)} s`);
    console.log(`pre-tack speed p25/med: ${q(kt,.25)}/${q(kt,.5)} kt`);
    const late = all.filter(r => r.aheadS != null && r.aheadS < 1.5).length;
    const slow = all.filter(r => r.aheadS != null && r.aheadS < 1.5 && r.preKt < 3).length;
    console.log(`LATE tacks (<1.5s of water left): ${late}/${as.length} (${(100 * late / as.length).toFixed(0)}%); of those already slow (<3kt): ${slow}`);
    fs.writeFileSync(path.join(__dirname, `_tacktrig_${VENUE}.json`), JSON.stringify(all));
    console.log('rows → _tacktrig_' + VENUE + '.json');
})();
