// WHO IS HOLDING THE BOAT HEAD TO WIND ON THE ROUNDING? (2026-08-11, arctic push)
//
// `_round_now`: the armed granite-isle rounding is 81.6 s/boat — 59% of arctic's
// whole 137.7 s/lap gap. It is not a routing problem (radius only 1.14x his, and
// he banks MORE sweep, 5.63 rad against 4.88): it is a STOPPING problem.
//     armed seconds        his 31.3   bot 112.9   (3.61x)
//     seconds under 40 u/s his  0.0   bot  30.3
//     seconds head to wind his  1.2   bot  20.0   (16.1x)
// 45% of a bot's armed rounding is spent slow or stopped; he never stops at all.
//
// So: which layer owns the helm while she sits there? The helm is written by
// spin > escape > contact-reflex > mark-reflex > wiggle > clearance > nav (rule
// 27's true order), and each tick's LAST WRITER is tagged in treeTW. This slices
// the armed rounding by that owner and by hull state.
//   node _round_helm.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeTW');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const R = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            window.__exLog = []; window.__tkLog = { rec: [] };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return window.__exLog.filter(r => r[10] === 1);
        }, SEED0 + t);
        R.push(...rows);
        console.log(`seed ${SEED0 + t}: ${rows.length} armed helm ticks`);
    }
    await br.close();
    // cols: 0 name 1 t 2 stratSide 3 stratKind 4 finalSide 5 hullSide 6 twa 7 spd 8 cd 9 owner 10 armed 11 navSrc
    const pc = (x, d) => `${x} (${(100 * x / (d || 1)).toFixed(1)}%)`;
    const n = R.length;
    const NOGO = 0.62;
    console.log(`\n=== ${VENUE.toUpperCase()}: THE ARMED ROUNDING, BY HELM OWNER (${TRIALS} seeds, ${n} ticks = ${(n / 10).toFixed(0)} boat-seconds) ===`);
    const own = {}, ownSlow = {}, ownIrons = {};
    for (const r of R) {
        own[r[9]] = (own[r[9]] || 0) + 1;
        if (r[7] < 40) ownSlow[r[9]] = (ownSlow[r[9]] || 0) + 1;
        if (Math.abs(r[6]) < NOGO) ownIrons[r[9]] = (ownIrons[r[9]] || 0) + 1;
    }
    console.log(`\n owner        ticks            of them UNDER 40 u/s      of them HEAD TO WIND`);
    for (const o of Object.keys(own).sort((a, b) => own[b] - own[a]))
        console.log(`   ${o.padEnd(10)} ${pc(own[o], n).padEnd(18)} ${pc(ownSlow[o] || 0, own[o]).padEnd(18)} ${pc(ownIrons[o] || 0, own[o])}`);
    const slow = R.filter(r => r[7] < 40), irons = R.filter(r => Math.abs(r[6]) < NOGO);
    console.log(`\nOVERALL: under 40 u/s ${pc(slow.length, n)}   head to wind ${pc(irons.length, n)}`);
    console.log(`\n⭐ WHO OWNS THE SLOW TIME (share of the ${slow.length} slow ticks):`);
    const sOwn = {}; for (const r of slow) sOwn[r[9]] = (sOwn[r[9]] || 0) + 1;
    for (const o of Object.keys(sOwn).sort((a, b) => sOwn[b] - sOwn[a])) console.log(`   ${o.padEnd(10)} ${pc(sOwn[o], slow.length)}`);
    console.log(`\n⭐ WHO OWNS THE HEAD-TO-WIND TIME (share of the ${irons.length} ticks):`);
    const iOwn = {}; for (const r of irons) iOwn[r[9]] = (iOwn[r[9]] || 0) + 1;
    for (const o of Object.keys(iOwn).sort((a, b) => iOwn[b] - iOwn[a])) console.log(`   ${o.padEnd(10)} ${pc(iOwn[o], irons.length)}`);
    console.log(`\n   and by NAV SOURCE (what was aiming her) on those head-to-wind ticks:`);
    const nSrc = {}; for (const r of irons) nSrc[r[11]] = (nSrc[r[11]] || 0) + 1;
    for (const o of Object.keys(nSrc).sort((a, b) => nSrc[b] - nSrc[a])) console.log(`   ${o.padEnd(10)} ${pc(nSrc[o], irons.length)}`);
})();
