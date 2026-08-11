// IS ARCTIC'S BREEZE OVERPOWERING THE AI IN A WAY IT DOES NOT OVERPOWER HER?
// (2026-08-10, owner hypothesis.)
//
// Arctic's day-median wind is 25.56 kt — by far the strongest venue (the rest run
// 4-18) — and the speed model charges for being PRESSED:
//     heel  = AWS^2 * sin(|AWA|) / 355          (355 = a beam reach in 18 kt)
//     factor= 1 - min(0.25, (heel - 1) * 0.45 * cope),  cope = 1 - heavyAir*0.08
// So the tax peaks on a BEAM REACH, is cheap close-hauled, and free dead downwind;
// it is capped at 25% and lagged 1.5 s, i.e. a state you sail into and out of.
//
// The hypothesis: in that much breeze the AI sails angles that keep it pressed
// where the human sails angles that do not, and pays a speed tax she avoids. A
// supporting hint is already on record — `_arc_roundlive` reports the fleet's
// "ease" attribution at **0%**: the AI essentially never depowers.
//
// THE TEST IS DIRECT, because her recordings stamp `awa` and `aws` at every
// sample: compute the SAME heel and the SAME factor for her laps and for the live
// fleet, and compare. Also report it per-venue for the fleet, so "arctic is
// special" is measured rather than assumed.
//
// ⚠️ heavyAir is a per-boat STAT, so `cope` varies by roster. The fleet number is
// reported both with each boat's own stat and at cope=1 (stat-neutral), because a
// roster draw must not be mistaken for a venue effect (rule 18b's lesson).
// ⚠️ Her recordings carry no stat; she is scored at cope=1 and compared against the
// fleet's cope=1 column.
//
//   node _overpower.js <trials> <seed0> <tree> [venues...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeDB3');
const VENUES = process.argv.slice(5).length ? process.argv.slice(5)
    : ['arctic', 'ocean', 'lagoon', 'redrock', 'bay', 'lake', 'swamp'];
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

const REF = 355, THRESH = 1.0, COST = 0.45, MAXC = 0.25;
const heelOf = (aws, awa) => (aws * aws * Math.abs(Math.sin(awa))) / REF;
const factorOf = (heel, cope) => { const o = heel - THRESH; return o <= 0 ? 1 : 1 - Math.min(MAXC, o * COST * cope); };

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    console.log(`\n=== OVERPOWERED TAX, FLEET BY VENUE (${TRIALS} seeds from ${SEED0}, ${path.basename(ROOT)}) ===`);
    console.log(`venue      dayWind  heel med  heel p90  | %time pressed | factor(own stat) | factor(cope=1) | speed lost`);
    for (const v of VENUES) {
        await p.addInitScript((vv) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })); }, v);
        await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        const r = await p.evaluate(({ seed, TRIALS }) => {
            const heels = [], fOwn = [], fNeu = []; let n = 0, pressed = 0, wsum = 0;
            for (let s = 0; s < TRIALS; s++) {
                window.evalHarness.seed = seed + s; window.resetGame(); window.startRace();
                state.course.cutoff = 900;
                const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
                const DT = 1 / 60; let tick = 0;
                for (let it = 0; it < 60 * 900; it++) {
                    window.update(DT);
                    if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                    if (++tick % 30) continue;                 // 2 Hz
                    for (const bo of state.boats) {
                        if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg < 1) continue;
                        const aw = bo.apparentWind; if (!aw) continue;
                        const h = (aw.speed * aw.speed * Math.abs(Math.sin(bo.awa != null ? bo.awa : 0))) / 355;
                        const heel = bo.heel != null ? bo.heel : h;
                        heels.push(heel); n++;
                        if (heel > 1) pressed++;
                        const cope = Math.max(0.3, 1 - ((bo.stats && bo.stats.heavyAir) || 0) * 0.08);
                        const o = heel - 1;
                        fOwn.push(o <= 0 ? 1 : 1 - Math.min(0.25, o * 0.45 * cope));
                        fNeu.push(o <= 0 ? 1 : 1 - Math.min(0.25, o * 0.45));
                        wsum += getWindAt(bo.x, bo.y).speed;
                    }
                }
            }
            return { heels: heels.filter((_, i) => i % 11 === 0), fOwn, fNeu, n, pressed, wsum };
        }, { seed: SEED0, TRIALS });
        const mo = mean(r.fOwn), mn = mean(r.fNeu);
        console.log(`${v.padEnd(10)} ${(r.wsum / r.n).toFixed(1).padStart(6)}  ${q(r.heels, 0.5).toFixed(2).padStart(8)}  ${q(r.heels, 0.9).toFixed(2).padStart(8)}  |` +
            `${(100 * r.pressed / r.n).toFixed(0).padStart(13)}% |${mo.toFixed(4).padStart(17)} |${mn.toFixed(4).padStart(15)} |` +
            `${((1 - mo) * 100).toFixed(2).padStart(10)}%`);
    }
    await b.close();

    // ── HER SIDE, from the recordings, scored with the identical formula ──────
    console.log(`\n=== HER OVERPOWERED TAX, from the recordings (cope = 1, stat-neutral) ===`);
    const dir = path.join(__dirname, 'traj');
    const byV = {};
    for (const f of fs.readdirSync(dir).filter(x => x.startsWith('traj_'))) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (!j.format) continue;
        const F = j.format, I = n => F.indexOf(n);
        if (I('awa') < 0 || I('aws') < 0) continue;
        const v = f.slice(5, f.lastIndexOf('_'));
        const rows = j.samples.filter(r => r[I('leg')] >= 1);
        if (!rows.length) continue;
        const o = byV[v] = byV[v] || { heels: [], f: [], n: 0, pressed: 0, laps: 0 };
        o.laps++;
        for (const r of rows) {
            const heel = heelOf(r[I('aws')], r[I('awa')]);
            o.heels.push(heel); o.n++; if (heel > 1) o.pressed++;
            o.f.push(factorOf(heel, 1));
        }
    }
    console.log(`venue      laps   heel med  heel p90  | %time pressed | factor | speed lost`);
    for (const v of Object.keys(byV).sort()) {
        const o = byV[v]; const mf = mean(o.f);
        console.log(`${v.padEnd(10)} ${String(o.laps).padStart(4)}  ${q(o.heels, 0.5).toFixed(2).padStart(8)}  ${q(o.heels, 0.9).toFixed(2).padStart(8)}  |` +
            `${(100 * o.pressed / o.n).toFixed(0).padStart(13)}% |${mf.toFixed(4).padStart(7)} |${((1 - mf) * 100).toFixed(2).padStart(10)}%`);
    }
    console.log(`\n  → compare arctic's fleet row (cope=1) with her arctic row: if the fleet is`);
    console.log(`    pressed far more often, it is sailing PRESSED ANGLES she avoids, and the`);
    console.log(`    tax is an AI deficiency rather than a property of the venue.`);
    console.log(`  → if the two are similar, the breeze charges them equally and this is NOT`);
    console.log(`    where arctic's gap lives. Say so and move on.`);
})();
