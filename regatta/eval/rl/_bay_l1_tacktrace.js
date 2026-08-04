// Per-tack attribution on bay L1: for each bot tack (close-hauled sign flip),
// record what was true just before — dirty air, own-tracker shift sign vs tack,
// nearest rival, layline proximity. node bay_l1_tacktrace.js <seed> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const RL = '/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/eval/rl';
const SEED = parseInt(process.argv[2]) || 9115;
const ROOT = path.join(RL, process.argv[3] || 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(async (seed) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const pl = state.boats.find(b => b.isPlayer); pl.x = 5900; pl.y = -6100;
        const info = bots.map(b => ({ name: b.name, tacks: [], prev: null, hist: [] }));
        const dt = 1 / 60; let fr = 0;
        for (let it = 0; it < 60 * 940; it++) {
            window.update(dt); fr++;
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            if (state.race.timer > 400) break;
            const t = state.race.timer;
            for (let k = 0; k < bots.length; k++) {
                const b = bots[k], inf = info[k];
                if (b.raceState.leg !== 1 || b.raceState.finished) continue;
                const lw = getWindAt(b.x, b.y);
                const rel = normalizeAngle(b.heading - lw.direction);
                const ch = Math.abs(rel) < Math.PI * 0.42; // close-hauled-ish
                const side = rel > 0 ? 1 : -1;
                // rolling 10Hz history of the pre-tack world
                if (fr % 6 === 0) {
                    const c = b.controller;
                    let shift = null;
                    if (c && c.windTracker && c.windTracker.initialized)
                        shift = normalizeAngle(lw.direction - c.windTracker.meanDirection);
                    let nearest = 1e9;
                    for (const b2 of state.boats) {
                        if (b2 === b || b2.raceState.finished) continue;
                        const d = Math.hypot(b2.x - b.x, b2.y - b.y);
                        if (d < nearest) nearest = d;
                    }
                    // strategic intent (pre-avoidance) vs final command sides
                    const sSide = c && c.prevDesired != null ? (normalizeAngle(c.prevDesired - lw.direction) > 0 ? 1 : -1) : 0;
                    const fSide = c && c.targetHeading != null ? (normalizeAngle(c.targetHeading - lw.direction) > 0 ? 1 : -1) : 0;
                    inf.hist.push({ t: +t.toFixed(1), bad: +b.badAirIntensity.toFixed(2), shift: shift == null ? null : +shift.toFixed(3), near: Math.round(nearest), spd: +b.speed.toFixed(2), sSide, fSide });
                    if (inf.hist.length > 30) inf.hist.shift();
                }
                if (ch) {
                    if (inf.prev != null && side !== inf.prev) {
                        // a tack landed: attribute from the last ~2.5s of history
                        const win = inf.hist.slice(-25);
                        const badMax = Math.max(0, ...win.map(h => h.bad));
                        const last = win[win.length - 1] || {};
                        const near = Math.min(1e9, ...win.map(h => h.near));
                        // did the STRATEGIC layer want the new side, or did
                        // avoidance flip a boat whose strategy wanted to stay?
                        const who = last.sSide === side ? (last.fSide === side ? 'strategic' : 'strat-vs-avoid?') : (last.fSide === side ? 'AVOIDANCE' : 'inertia?');
                        inf.tacks.push({ t: +t.toFixed(0), toSide: side, badMax: +badMax.toFixed(2), shift: last.shift, near, spd: last.spd, who });
                    }
                    inf.prev = side;
                }
            }
        }
        return info.map(i => ({ name: i.name, tacks: i.tacks }));
    }, SEED);
    for (const b of r) {
        console.log(`${b.name}: ${b.tacks.length} L1 tacks`);
        for (const tk of b.tacks) {
            // was the boat tacking ONTO the lifted tack per its own tracker?
            // lift for side s under shift sh: -s*sh > 0
            const lifted = tk.shift == null ? '?' : (-tk.toSide * tk.shift > 0.052 ? 'ontoLift' : (-tk.toSide * tk.shift < -0.052 ? 'ontoHeader' : 'neutral'));
            console.log(`  t${tk.t} to${tk.toSide > 0 ? 'S' : 'P'} ${tk.who.padEnd(15)} badMax ${tk.badMax} ${lifted} shift ${tk.shift} near ${tk.near} spd ${tk.spd}`);
        }
    }
    await browser.close();
})();
