// ARCTIC, THE FOURTH HYPOTHESIS: IS THE BOT BEATING A LEG SHE FETCHES?
// (2026-08-08 push P0, step 3.) Three shapes have now died at the measurement:
//   - "the router refuses her leads"  — it refuses 1-3 of 23-40 plans (_arc_clr)
//   - "the PAD demand is the excess"  — the knee made the odometer WORSE (51k/40k)
//   - "the plan churns"               — churn med 30-136u, flips ≤26% (_arc_churn)
// What survives: the router's FIRST leg-1 plan is 15.7-15.9k against her SAILED
// 15.1-15.5k (the route is her line), the boat holds it (d0 med 44-52u), and yet
// it sails 23-32k. The residual is the conversion from route to sailed water —
// and the bot spends HALF its leg-1 odometer with the wind inside 69°, while her
// distance (1.16x rhumb) is too short to contain a real beat at all.
// So compare the two on the same axis: the distribution of |heading - wind| and
// the odometer share inside the no-go band, hers from the recordings and the
// bot's live. Same wind field, same course, same definition.
//   node _arc_beat.js human            (all schema-2 arctic recordings)
//   node _arc_beat.js <trials> <seed0> <tree>
const fs = require('fs'); const path = require('path');
const TRAJ = path.join(__dirname, 'traj');
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const pct = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };

if (process.argv[2] === 'human') {
    const files = fs.readdirSync(TRAJ).filter(f => /^traj_arctic_.*\.json$/.test(f));
    const rows = [];
    for (const f of files) {
        let j; try { j = JSON.parse(fs.readFileSync(path.join(TRAJ, f))); } catch (e) { continue; }
        const F = j.format;
        const idx = (n) => F.findIndex(x => x === n || String(x).startsWith(n));
        // ⚠️ The recorder's heading column is `hdg`, not `heading` (schema 2) — a
        // startsWith('heading') lookup returned -1 on every file and the probe
        // printed "0 laps". Standing rule 4: an exactly-zero statistic is a bug.
        const iX = idx('x'), iY = idx('y'), iPh = idx('phase'), iLeg = idx('leg');
        const iH = F.indexOf('hdg') >= 0 ? F.indexOf('hdg') : idx('heading');
        const iWD = idx('windDir'), iT = idx('t');
        if (iX < 0 || iH < 0 || iWD < 0) continue;
        const S = j.samples.filter(s => s[iPh] === 1);
        if (S.length < 50) continue;
        let odo = 0, beatOdo = 0, prev = null;
        const legOdo = {}, legBeat = {}, angs = [];
        for (const s of S) {
            if (prev) {
                const d = Math.hypot(s[iX] - prev[iX], s[iY] - prev[iY]);
                if (d < 200) {
                    const off = Math.abs(norm(s[iH] - s[iWD]));
                    angs.push(+(off * 180 / Math.PI).toFixed(0));
                    odo += d;
                    const lg = iLeg >= 0 ? s[iLeg] : 0;
                    legOdo[lg] = (legOdo[lg] || 0) + d;
                    if (off < 1.2) { beatOdo += d; legBeat[lg] = (legBeat[lg] || 0) + d; }
                }
            }
            prev = s;
        }
        if (odo < 1000) continue;
        rows.push({ f, fin: j.finishTime, odo: Math.round(odo), beatPct: Math.round(100 * beatOdo / odo),
            angMed: pct(angs, 50),
            leg1: Math.round(legOdo[1] || 0), leg1beat: legOdo[1] ? Math.round(100 * (legBeat[1] || 0) / legOdo[1]) : null });
    }
    console.log('HUMAN arctic laps with heading+windDir columns:', rows.length);
    for (const r of rows) console.log(`  ${r.f.slice(0, 30)} fin ${String(r.fin).slice(0, 6).padStart(7)} odo ${r.odo} BEAT% ${r.beatPct}  |h-w| med ${r.angMed}°  leg1 ${r.leg1} (beat ${r.leg1beat}%)`);
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    if (rows.length) console.log('  MED beat%', med(rows.map(r => r.beatPct)), ' leg1 odo', med(rows.map(r => r.leg1)),
        ' leg1 beat%', med(rows.map(r => r.leg1beat).filter(x => x != null)), ' |h-w| med', med(rows.map(r => r.angMed)));
    process.exit(0);
}

const { chromium } = require('playwright');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHD9');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const races = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            const nz = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const R = { seed, fin: null, odo: 0, beatOdo: 0, legOdo: {}, legBeat: {}, angs: [],
                        planBeatOdo: 0, planAngs: [] };
            let px = hero.x, py = hero.y;
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                const d = Math.hypot(hero.x - px, hero.y - py); px = hero.x; py = hero.y;
                const w = getWindAt(hero.x, hero.y);
                const off = Math.abs(nz(hero.heading - w.direction));
                R.angs.push(Math.round(off * 180 / Math.PI));
                R.odo += d;
                const lg = hero.raceState.leg;
                R.legOdo[lg] = (R.legOdo[lg] || 0) + d;
                if (off < 1.2) { R.beatOdo += d; R.legBeat[lg] = (R.legBeat[lg] || 0) + d; }
                // THE PLAN'S OWN wind angle: where the router is pointing the boat,
                // 260u ahead — the same lookahead the FF waiver uses. If the PLAN is
                // upwind, the beat is the course; if the plan is a fetch and the BOAT
                // is beating, the loss is in the strategic heading, not the route.
                const gp = hero.controller && hero.controller.gridPath;
                if (gp && gp.length) {
                    let acc = 0, j = 0, ax = hero.x, ay = hero.y;
                    while (j < gp.length - 1 && acc < 260) { acc += Math.hypot(gp[j + 1].x - gp[j].x, gp[j + 1].y - gp[j].y); j++; }
                    const hp = Math.atan2(gp[j].x - hero.x, -(gp[j].y - hero.y));
                    const offP = Math.abs(nz(hp - w.direction));
                    R.planAngs.push(Math.round(offP * 180 / Math.PI));
                    if (offP < 1.2) R.planBeatOdo += d;
                }
                if (hero.raceState.finished && R.fin == null) { R.fin = +t.toFixed(1); break; }
            }
            const q = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };
            return { seed: R.seed, fin: R.fin, odo: Math.round(R.odo),
                beatPct: Math.round(100 * R.beatOdo / R.odo), angMed: q(R.angs, 50),
                planBeatPct: Math.round(100 * R.planBeatOdo / R.odo), planAngMed: q(R.planAngs, 50),
                leg1: Math.round(R.legOdo[1] || 0),
                leg1beat: R.legOdo[1] ? Math.round(100 * (R.legBeat[1] || 0) / R.legOdo[1]) : null };
        }, seed);
        races.push(r);
        console.log('seed', r.seed, 'fin', r.fin, 'odo', r.odo,
            ' BOAT beat%', r.beatPct, '|h-w| med', r.angMed + '°',
            ' PLAN beat%', r.planBeatPct, '|plan-w| med', r.planAngMed + '°',
            ' leg1', r.leg1, '(beat', r.leg1beat + '%)');
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    console.log('\nPOOLED', races.length, 'solo races: BOAT beat%', med(races.map(r => r.beatPct)),
        ' PLAN beat%', med(races.map(r => r.planBeatPct)),
        ' leg1 odo', med(races.map(r => r.leg1)), ' leg1 beat%', med(races.map(r => r.leg1beat)));
    console.log('  READ: BOAT beat% >> PLAN beat% means the boat beats water the route fetches.');
    await browser.close();
})();
