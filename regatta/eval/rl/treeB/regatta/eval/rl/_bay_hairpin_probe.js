// Bay L3->L4 (and L5->L6) hairpin entry overshoot: ~10% of leg-3->4
// roundings take >=16s armed-to-advance (p90 16s, max 61) vs median 2-6s.
// Ruler-entry skip is REJECTED; before any new mechanism, watch what the
// slow roundings actually do: per rounding, armed-to-advance duration plus
// a 1Hz trace while armed (dist-to-mark, speed, sweep, bearing progress,
// TWA) dumped for the slow cases. Read-only at frame boundaries.
//   node _bay_hairpin_probe.js <trials> <seed0> [tree] [label]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeB');
const LABEL = process.argv[5] || null;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rounds = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 5900; pl.y = -6100;
            const bots = state.boats.filter(b => !b.isPlayer);
            const st = bots.map(b => ({ name: b.name, legPrev: b.raceState.leg,
                armT: null, armLeg: null, trace: [], out: [] }));
            const dt = 1 / 60;
            let frame = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                const t = state.race.timer;
                frame++;
                const edge = (frame % 60 === 0);
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], s = st[k];
                    const rs = b.raceState;
                    if (rs.finished) continue;
                    // arm detection on legs 3 and 5
                    if ((rs.leg === 3 || rs.leg === 5) && rs.roundArmed && s.armT == null) {
                        s.armT = t; s.armLeg = rs.leg; s.trace = [];
                    }
                    if (edge && s.armT != null && rs.leg === s.armLeg) {
                        const rm = (typeof legRoundMark === 'function' && legRoundMark(rs.leg)) || state.course.roundMark;
                        if (rm) {
                            const dRm = Math.hypot(b.x - rm.x, b.y - rm.y);
                            const brg = Math.atan2(b.y - rm.y, b.x - rm.x);
                            s.trace.push({ t: Math.round(t * 10) / 10,
                                d: Math.round(dRm), z: Math.round(rm.zone),
                                spd: Math.round(b.speed * 100) / 100,
                                sw: Math.round((rs.roundSweep || 0) * 100) / 100,
                                need: rm.reqSweep != null ? Math.round(rm.reqSweep * 100) / 100 : null,
                                brg: Math.round(brg * 100) / 100 });
                        }
                    }
                    if (rs.leg !== s.legPrev) {
                        if (s.armT != null && rs.leg === s.armLeg + 1) {
                            const dur = t - s.armT;
                            s.out.push({ name: s.name, fromLeg: s.armLeg,
                                dur: Math.round(dur * 10) / 10,
                                trace: dur >= 10 ? s.trace : null });
                        }
                        s.armT = null; s.armLeg = null; s.trace = [];
                        s.legPrev = rs.leg;
                    }
                }
            }
            return st.flatMap(s => s.out);
        }, seed);
        rounds.push(...r.map(x => ({ seed, ...x })));
        console.log(`seed ${seed}: ${r.length} armed roundings`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * p)] : NaN; };
    for (const leg of [3, 5]) {
        const g = rounds.filter(r => r.fromLeg === leg);
        const d = g.map(r => r.dur);
        console.log(`\nLEG ${leg}->${leg + 1} armed roundings n=${g.length}: dur med ${med(d)} p90 ${pct(d, 0.9)} max ${Math.max(...d, 0)}  >=10s: ${g.filter(r => r.dur >= 10).length} >=16s: ${g.filter(r => r.dur >= 16).length}`);
    }
    // print the 6 slowest traces for eyeballing
    const slow = rounds.filter(r => r.trace).sort((a, b) => b.dur - a.dur).slice(0, 6);
    for (const r of slow) {
        console.log(`\n--- seed ${r.seed} ${r.name} L${r.fromLeg} dur ${r.dur}s (zone ${r.trace[0] && r.trace[0].z})`);
        console.log(r.trace.map(p => `t${p.t} d${p.d} s${p.spd} sw${p.sw}/${p.need} b${p.brg}`).join(' | '));
    }
    if (LABEL) {
        fs.writeFileSync(path.join(__dirname, `bay_hairpin_${LABEL}.json`), JSON.stringify(rounds));
        console.log(`\nwrote bay_hairpin_${LABEL}.json`);
    }
    await browser.close();
})();
