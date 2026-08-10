// THE ARMED-APPROACH CRAWL, read from the argmin's own ledger (P3, 2026-08-09).
// The approach matrix says: dRM 150-900u, armed ~100%, avoid 39-68%, park 64%
// inside 300u, fleet at 3.7-79 u/s where she carries 100-117. The attribution
// says needless 50-53% with rounding 62-64%. This probe asks the ARGMIN WHY:
// treePR2 logs every candidate's {off, cost, sc, bc, rv, px} at armed choices
// with dev>=0.1 and dRM<900. For each choice: which rung won, what the 0-rung
// and the best small rung (|off|<=0.2) cost, and WHICH TERM made them lose.
//   node _crawl_argmin.js <trials> <seed0> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const VENUE = process.argv[4] || 'arctic';
const ROOT = path.join(__dirname, 'treePR2');

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate(async (seed) => {
            window.__avCap = 1; window.__avLog = [];
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
            }
            return window.__avLog;
        }, SEED0 + t);
        console.log(`seed ${SEED0 + t}: ${rows.length} armed-approach choices logged`);
        all.push(...rows);
    }
    await b.close();

    // aggregate: why did 0 and small rungs lose?
    const reasons = {}; const chosen = {}; const slowRows = [];
    let n = 0;
    for (const r of all) {
        const fan = r.fan; if (!fan || !fan.length) continue;
        const f0 = fan.find(c => c.off === 0);
        const win = fan.reduce((a, c) => c.cost < a.cost ? c : a, fan[0]);
        if (!f0) continue;
        n++;
        chosen[win.off] = (chosen[win.off] || 0) + 1;
        // classify the 0-rung's defeat: which flag/term does the 0-rung carry
        // that the winner doesn't (or carries less of)?
        let why;
        if (f0.sc && !win.sc) why = 'STATIC_VETO';
        else if (f0.bc && !win.bc) why = 'BOAT_VETO';
        else if (f0.rv && !win.rv) why = 'RULE_VETO';
        else if (f0.px - win.px > (f0.cost - win.cost) * 0.5) {
            // which half of the proximity sum carries the defeat?
            const dRival = (f0.pxr || 0) - (win.pxr || 0);
            const dStatic = (f0.px - (f0.pxr || 0)) - (win.px - (win.pxr || 0));
            why = dRival > dStatic ? 'PROX_RIVAL' : 'PROX_STATIC';
        }
        else if (f0.sc && win.sc) why = 'BOTH_STATIC';
        else if (f0.bc && win.bc) why = 'BOTH_BOAT';
        else why = 'OTHER_COST';
        reasons[why] = (reasons[why] || 0) + 1;
        if (r.spd < 40) slowRows.push({ why, off: win.off, risk: r.risk, role: r.role, dRM: r.dRM, arc: r.arc });
    }
    console.log(`\n=== ${VENUE}: ${n} armed-approach choices (dev>=5.7deg, dRM<900) ===`);
    console.log('why the 0-rung lost:', JSON.stringify(reasons));
    const co = Object.entries(chosen).sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log('winning rungs:', co.map(([k, v]) => `${k}:${v}`).join(' '));
    const sw = {}; for (const s of slowRows) sw[s.why] = (sw[s.why] || 0) + 1;
    console.log(`SLOW (<40u/s, the parked/crawl subset, n=${slowRows.length}):`, JSON.stringify(sw));
    const roles = {}; for (const s of slowRows) roles[s.role + '/' + s.risk] = (roles[s.role + '/' + s.risk] || 0) + 1;
    console.log('slow subset role/risk:', JSON.stringify(roles));
    const arcAll = all.filter(r => r.arc === 1).length, arcSlow = slowRows.filter(s => s.arc === 1).length;
    console.log(`ARC ACTIVE: all ${arcAll}/${all.length} (${Math.round(100 * arcAll / Math.max(1, all.length))}%)  slow ${arcSlow}/${slowRows.length} (${Math.round(100 * arcSlow / Math.max(1, slowRows.length))}%)`);
})();
