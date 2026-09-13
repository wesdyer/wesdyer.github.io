// Emberfall Isle (volcanic) fleet profiler: full fleet, cutoff raised to 900, per-boat leg
// timestamps + progress sampling. Mirrors bay_bench.js, plus the venue's WEATHER columns:
// fries per boat and seconds fried, seconds in a vent's boil, seconds in plume dead air,
// strikes per race. The player is parked AND marked finished, because the aimed striker
// draws the player three times over — a parked live player would pull strikes off the course.
//   node regatta/eval/rl/volcanic_bench.js <trials> <seed0> <label> [tree]
//   (tree defaults to the working tree; pass a worktree dir relative to eval/rl for A/B)
// Human reference: 5 traj (2026-09-13), see ai-campaign.md Emberfall section.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const crypto = require('crypto');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const LABEL = process.argv[4] || 'x';
const ROOT = path.join(__dirname, process.argv[5] || '../../..');
const venueFingerprint = (v) => {
    try {
        const f = path.resolve(ROOT, 'regatta/assets/venues/' + v + '.venue.js');
        return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
    } catch (e) { return null; }
};
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    if (process.env.NOLIGHTNING === '1') await page.evaluate(() => { window.__noLightning = true; });
    if (process.env.GUNLIGHTNING === '1') await page.evaluate(() => { window.__gunLightning = true; });
    await page.evaluate(() => {
        const inner = window.onRaceEvent;
        window.__cc = {}; window.__ccT = {};
        const mono = () => state.race.status === 'prestart' ? -state.race.timer : state.race.timer;
        window.onRaceEvent = (ty, d) => {
            try {
                if (d && d.boat && !d.boat.isPlayer && !d.boat.raceState.finished
                    && (ty === 'collision_boat' || ty === 'collision_mark'
                        || ty === 'collision_island' || ty === 'collision_boundary')) {
                    const cat = ty === 'collision_boat' ? 'boat' : ty === 'collision_mark' ? 'mark'
                        : ty === 'collision_island' ? (d.isFloe ? 'floe' : 'land') : 'bounds';
                    const k = d.boat.name + ':' + cat, t = mono();
                    if (window.__ccT[k] == null || t - window.__ccT[k] >= 0.5) {
                        window.__ccT[k] = t;
                        const c = window.__cc[d.boat.name] = window.__cc[d.boat.name] || {};
                        c[cat] = (c[cat] || 0) + 1;
                    }
                }
            } catch (e) {}
            return inner && inner(ty, d);
        };
    });
    const out = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            window.__cc = {}; window.__ccT = {};
            const venueCutoff = state.course.cutoff;
            state.course.cutoff = 900;
            // A/B knob: NOLIGHTNING=1 removes the strikers (weather otherwise intact).
            if (window.__noLightning && state.volcano) state.volcano.strikers = [];
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 30000; pl.y = 30000; pl.raceState.finished = true;
            const nLegs = state.course.dmc.legs.length;
            const info = bots.map(b => ({ name: b.name, legT: {}, fin: null, prog: [], hint: null, pen: 0, tArm: {}, ocs: 0,
                                          fries: 0, friedS: 0, boilS: 0, deadS: 0, dodges: 0, _fry: null, _dodgeKey: null }));
            const weather = { strikes: 0, strikeT: new Set(), eruptions: 0 };
            const dt = 1 / 60; let last = -999;
            for (let it = 0; it < 60 * 940; it++) {
                const fr6 = it % 6;
                window.update(dt);
                if (state.race.status === 'finished') break;
                // A/B knob: GUNLIGHTNING=1 holds the strikers until the gun (no prestart strikes).
                if (window.__gunLightning && state.volcano && state.race.status === 'prestart') for (const st of state.volcano.strikers) { st.pending = null; if (st.next < 0.5) st.next = 0.5; }
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                const t = state.race.timer;
                const snap = t - last >= 15;
                if (snap) last = t;
                if (fr6 === 0 && state.volcano) {
                    for (const s of state.volcano.strikes) if (!weather.strikeT.has(s.t0)) { weather.strikeT.add(s.t0); weather.strikes++; }
                }
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], inf = info[k];
                    if (inf.fin != null) continue;
                    if (b.raceState.finished) { inf.fin = Math.round(t); inf.pen = b.raceState.totalPenalties || 0; continue; }
                    if (b.raceState.ocs) inf.ocs = 1;
                    const lg = b.raceState.leg;
                    if (fr6 === 0) {
                        // Weather exposure at 10 Hz: 0.1 s per sample.
                        if (state.volcano) {
                            const f = Volcano.fryOf(b);
                            if (f) { inf.friedS += 0.1; if (inf._fry !== f) { inf._fry = f; inf.fries++; } }
                            if ((b.boil || 0) > 0.1) inf.boilS += 0.1;
                            if (Volcano.windMul(b.x, b.y) < 0.6) inf.deadS += 0.1;
                            const c = b.controller;
                            if (c && c._dodgeGo && c._dodgeKey != null && c._dodgeKey !== inf._dodgeKey) { inf._dodgeKey = c._dodgeKey; inf.dodges++; }
                        }
                        if (lg >= 1) {
                            const lw2 = getWindAt(b.x, b.y);
                            inf.wsum = inf.wsum || {}; inf.wn = inf.wn || {};
                            inf.wsum[lg] = (inf.wsum[lg] || 0) + lw2.speed;
                            inf.wn[lg] = (inf.wn[lg] || 0) + 1;
                        }
                    }
                    if (lg >= 1) {
                        if (inf._oLg !== lg) { inf._oLg = lg; inf._ox = b.x; inf._oy = b.y; }
                        const dStep = Math.hypot(b.x - inf._ox, b.y - inf._oy);
                        inf._ox = b.x; inf._oy = b.y;
                        inf.odo = inf.odo || {}; inf.odo[lg] = (inf.odo[lg] || 0) + dStep;
                    }
                    if (inf.legT[lg] == null) inf.legT[lg] = Math.round(t);
                    if (inf.tArm[lg] == null && b.raceState.roundArmed) inf.tArm[lg] = Math.round(t);
                    if (snap && lg >= 1 && state.course.dmc.legs[lg]) {
                        if (inf.hintLg !== lg) { inf.hint = null; inf.hintLg = lg; }
                        const s = CoursePath.project(state.course.dmc.legs[lg], b.x, b.y, inf.hint);
                        inf.hint = s;
                        inf.prog.push([Math.round(t), lg, Math.round(s), Math.round(b.x), Math.round(b.y), +b.speed.toFixed(2)]);
                    }
                }
                if (info.every(f => f.fin != null)) break;
            }
            for (const [k, b] of bots.entries()) {
                if (info[k].fin == null) info[k].pen = b.raceState.totalPenalties || 0;
                info[k].col = window.__cc[b.name] || {};
                info[k].mans = b.raceState.legManeuvers.slice(1, 7);
                if (info[k].odo) for (const lg in info[k].odo) info[k].odo[lg] = Math.round(info[k].odo[lg]);
                if (info[k].wsum) { info[k].wavg = {}; for (const lg in info[k].wsum) info[k].wavg[lg] = +(info[k].wsum[lg] / info[k].wn[lg]).toFixed(1); }
                for (const key of ['wsum', 'wn', '_ox', '_oy', '_oLg', '_fry', '_dodgeKey', 'hint', 'hintLg']) delete info[k][key];
                info[k].friedS = +info[k].friedS.toFixed(1); info[k].boilS = +info[k].boilS.toFixed(1); info[k].deadS = +info[k].deadS.toFixed(1);
            }
            return { nLegs, venueCutoff, legLens: state.course.dmc.legs.map(l => Math.round(l.length)), info, strikes: weather.strikes };
        }, seed);
        out.push({ seed, ...r });
        const fins = r.info.filter(f => f.fin != null).map(f => f.fin).sort((a, b) => a - b);
        const reached = {};
        for (let lg = 1; lg <= r.nLegs; lg++) reached[lg] = r.info.filter(f => f.legT[lg] != null || f.fin != null).length;
        const fr = r.info.reduce((a, f) => a + f.fries, 0);
        console.log(`seed ${seed}: legs reached ${Object.values(reached).join('/')} finishers ${fins.length} finT ${fins.join(',')} strikes ${r.strikes} fries ${fr}`);
    }
    fs.writeFileSync(path.join(__dirname, 'volcanic_bench_' + LABEL + '.json'), JSON.stringify(out));
    fs.writeFileSync(path.join(__dirname, 'volcanic_bench_' + LABEL + '.meta.json'),
        JSON.stringify({ venue: 'volcanic', fingerprint: venueFingerprint('volcanic'), trials: TRIALS, seed0: SEED0, tree: ROOT }, null, 2));
    console.log('saved volcanic_bench_' + LABEL + '.json  nLegs', out[0].nLegs, 'legLens', out[0].legLens.join(','), 'venueCutoff', out[0].venueCutoff);
    await browser.close();
})();
