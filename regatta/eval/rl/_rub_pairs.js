// WHAT IS THE PAIR GEOMETRY OF RD7's LEG-1 APPROACH RUBS? (2026-08-08, the
// arrival push's second instrumentation question.) _rub_where located them
// (77% leg 1, dRM med 1325u, 74% under 2.7kt, 52% armed) — but "slow-boat
// traffic on the beat approach" admits several mechanisms with different
// fixes: same-tack parallel convergence (laning), opposite-tack crossings
// (rules deflection), or a static cluster-jam pinned by floes/avoidance.
// For every boat-boat contact (pair-deduped 0.5s), log: dRM, leg, both
// speeds, both tacks (sign of TWA, engine convention 0=head-to-wind), the
// relative heading angle between the two hulls, nearest-floe distance from
// the contact midpoint, and the local cluster size (boats within 150u).
//   node _rub_pairs.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9201;
const ROOT = path.join(__dirname, process.argv[4] || 'treeRD7');
// argv[5] 'stat' = leave __CHAR unset so the probe mirrors the fleet benches
// (stat-based bots). Default stays neutral per the owner's solo-probe ruling.
// ⚠️ Rule 18 lesson (2026-08-08): a neutral-flag probe against a tree that
// PREDATES the __CHAR machinery silently runs full-character bots — the flag
// no-ops. Cross-tree probe comparisons must either use 'stat' or verify both
// trees carry the machinery.
const STAT = process.argv[5] === 'stat';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    if (!STAT) await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const RM = state.course.roundMark || { x: 138, y: -3095 };
            const rubs = [];
            const lastT = new Map();
            // frame-level accounting by dRM band — the bench's col-boat statistic
            // is contact FRAMES, so episode counts alone can't attribute it
            const frames = { '<400': 0, '400-900': 0, '900-1800': 0, '>1800': 0 };
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const tackOf = b => {
                const w = getWindAt(b.x, b.y);
                // engine TWA 0 = head-to-wind; sign of the wind-relative angle is the tack
                return norm(b.heading - w.dir) >= 0 ? 1 : -1;
            };
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'collision_boat' && d && d.boat && d.other
                        && !d.boat.isPlayer && !d.other.isPlayer
                        && d.boat.name < d.other.name) {   // one row per pair
                        const t = state.race.timer;
                        {   // every pair-frame, not deduped — mirrors the bench's col-boat count
                            const dF = Math.hypot((d.boat.x + d.other.x) / 2 - RM.x, (d.boat.y + d.other.y) / 2 - RM.y);
                            frames[dF < 400 ? '<400' : dF < 900 ? '400-900' : dF <= 1800 ? '900-1800' : '>1800']++;
                        }
                        const k = d.boat.name + '|' + d.other.name;
                        if (!lastT.has(k) || t - lastT.get(k) >= 0.5) {
                            lastT.set(k, t);
                            const b1 = d.boat, b2 = d.other;
                            const mx = (b1.x + b2.x) / 2, my = (b1.y + b2.y) / 2;
                            let fMin = 1e9;
                            const fl = state.course._floeObjs || [];
                            for (const f of fl) {
                                const dd = Math.hypot(f.x - mx, f.y - my) - (f.radius || 0);
                                if (dd < fMin) fMin = dd;
                            }
                            let cl = 0;
                            for (const ob of state.boats) {
                                if (ob.isPlayer || (ob.raceState && ob.raceState.finished)) continue;
                                if (Math.hypot(ob.x - mx, ob.y - my) < 150) cl++;
                            }
                            rubs.push({ t: +t.toFixed(0),
                                dRM: Math.round(Math.hypot(mx - RM.x, my - RM.y)),
                                leg: b1.raceState.leg,
                                kt1: +(b1.speed * 4).toFixed(1), kt2: +(b2.speed * 4).toFixed(1),
                                tk1: tackOf(b1), tk2: tackOf(b2),
                                relH: +Math.abs(norm(b1.heading - b2.heading)).toFixed(2),
                                floe: Math.round(Math.min(fMin, 9999)),
                                cl,
                                armed: (b1.raceState.roundArmed ? 1 : 0) + (b2.raceState.roundArmed ? 1 : 0) });
                        }
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return { rubs, frames };
        }, seed);
        console.log('seed', seed, 'pair-episodes', r.rubs.length, 'pair-frames', JSON.stringify(r.frames));
        for (const row of r.rubs) rows.push(Object.assign({ seed }, row));
        if (!rows._frames) rows._frames = { '<400': 0, '400-900': 0, '900-1800': 0, '>1800': 0 };
        for (const k in r.frames) rows._frames[k] += r.frames[k];
    }
    fs.writeFileSync(path.join(__dirname, '_rub_pairs_' + path.basename(ROOT) + '_' + SEED0 + (STAT ? '_stat' : '') + '.json'), JSON.stringify(rows, null, 1));
    console.log('TOTAL pair-frames by band', JSON.stringify(rows._frames));
    // summary: the approach band is the question
    const band = rows.filter(r => r.leg === 1 && r.dRM >= 900 && r.dRM <= 1800);
    const pct = (n, d) => d ? Math.round(100 * n / d) + '%' : '-';
    console.log('total pair-episodes', rows.length, ' leg1 900-1800 band', band.length);
    if (band.length) {
        const same = band.filter(r => r.tk1 === r.tk2).length;
        const par = band.filter(r => r.relH < 0.6).length;
        const anti = band.filter(r => r.relH > 2.5).length;
        const bothSlow = band.filter(r => r.kt1 < 2.7 && r.kt2 < 2.7).length;
        const oneSlow = band.filter(r => (r.kt1 < 2.7) !== (r.kt2 < 2.7)).length;
        const floeNear = band.filter(r => r.floe < 120).length;
        const clBig = band.filter(r => r.cl >= 4).length;
        const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
        console.log('same-tack', pct(same, band.length),
            ' parallel(relH<0.6)', pct(par, band.length),
            ' head-on(relH>2.5)', pct(anti, band.length));
        console.log('both<2.7kt', pct(bothSlow, band.length),
            ' one<2.7kt', pct(oneSlow, band.length),
            ' floe<120u', pct(floeNear, band.length),
            ' cluster>=4', pct(clBig, band.length),
            ' med cluster', med(band.map(r => r.cl)),
            ' med floe', med(band.map(r => r.floe)));
    }
    await browser.close();
})();
