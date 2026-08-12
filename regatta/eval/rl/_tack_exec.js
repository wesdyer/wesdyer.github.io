// DOES THE TACK THE TACTICIAN ORDERS EVER GET SAILED? (2026-08-11, arctic push)
//
// `_tack_why` found something the campaign has never looked at: 79.3% of the
// side-changes the strategic layer commands are REVERSED within 0.35s, and the
// dominant transition is score -> cd_hold. The suspected mechanism is structural:
//
//   getStrategicHeading commands a tack and sets `this.tackCooldown = 5.0`.
//   On the NEXT 10Hz tick the cooldown branch tests `targetTackSign !== currentTack`
//   where `currentTack` is read off the HULL's instantaneous heading — and the hull
//   has turned ~5 degrees, nowhere near through head-to-wind. So the branch that
//   exists to stop rapid switching hands the helm straight back to the OLD tack and
//   keeps doing so for the whole 5 s cooldown.
//
// If that is right, the tack ordered by the tactician is never executed at all; the
// boat luffs a few degrees, loses speed, bears away, and repeats. Whatever tacks
// DO happen must be coming from the override layers (avoidance / escape / floe
// trajectory), which write desiredHeading AFTER getStrategicHeading (rule 27).
//
// This measures it on the hull instead of inferring it:
//   * per 10Hz controller tick on a racing leg: what the tactician asked for, which
//     exit produced it, what the helm was finally told, where the hull is, and who
//     last wrote the heading
//   * survival curve of a commanded tack (still commanded 0.3 / 1 / 2 / 3 s later)
//   * for every ACTUAL hull side-change: who owned the helm through the crossing
//
// usage: node _tack_exec.js <venue> <trials> <seed0> <tree>
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

    const ROWS = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            window.__tkLog = { rec: [] }; window.__exLog = [];
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return window.__exLog;
        }, SEED0 + t);
        for (const row of r) ROWS.push(row.concat([SEED0 + t]));
        console.log(`seed ${SEED0 + t}: ${r.length} helm ticks`);
    }
    await br.close();

    // columns: 0 name 1 t 2 stratSide 3 stratKind 4 finalSide 5 hullSide 6 twa 7 spd 8 cd 9 owner 10 seed
    const byBoat = {};
    for (const r of ROWS) (byBoat[r[10] + ':' + r[0]] = byBoat[r[10] + ':' + r[0]] || []).push(r);
    for (const k in byBoat) byBoat[k].sort((a, b) => a[1] - b[1]);

    const own = {}, ownTacks = {};
    let ticks = 0, ordered = 0, hullFlips = 0;
    const surv = { 0.3: 0, 1: 0, 2: 0, 3: 0 };
    let ironsTicks = 0;
    const NOGO = 0.62;
    for (const k in byBoat) {
        const H = byBoat[k];
        for (let i = 0; i < H.length; i++) {
            ticks++;
            own[H[i][9]] = (own[H[i][9]] || 0) + 1;
            if (Math.abs(H[i][6]) < NOGO) ironsTicks++;
            // an ORDER = the tactician's commanded side differs from the hull's side
            if (H[i][2] !== 0 && H[i][2] !== H[i][5]) {
                // dedup: only the first tick of a contiguous order
                if (i > 0 && H[i - 1][2] === H[i][2] && H[i - 1][2] !== H[i - 1][5]) continue;
                ordered++;
                for (const w of [0.3, 1, 2, 3]) {
                    let alive = 0;
                    for (let j = i; j < H.length && H[j][1] - H[i][1] <= w; j++) {
                        if (H[j][1] - H[i][1] >= w - 0.15) alive = (H[j][4] === H[i][2]) ? 1 : 0;
                    }
                    surv[w] += alive;
                }
            }
            // ACTUAL hull side change
            if (i > 0 && H[i][5] !== H[i - 1][5]) {
                hullFlips++;
                // who owned the helm over the 1.0s leading into the crossing?
                const w = {};
                for (let j = i - 1; j >= 0 && H[i][1] - H[j][1] <= 1.0; j--) w[H[j][9]] = (w[H[j][9]] || 0) + 1;
                const top = Object.keys(w).sort((a, b) => w[b] - w[a])[0] || '-';
                ownTacks[top] = (ownTacks[top] || 0) + 1;
            }
        }
    }
    const pc = (x, d) => `${x} (${(100 * x / (d || 1)).toFixed(1)}%)`;
    console.log(`\n=== ${VENUE.toUpperCase()}: IS THE ORDERED TACK EVER SAILED? (${TRIALS} seeds) ===`);
    console.log(`helm ticks on racing legs: ${ticks}   hull side-changes: ${hullFlips}`);
    console.log(`\nWHO OWNS THE HELM (share of ticks):`);
    for (const o of Object.keys(own).sort((a, b) => own[b] - own[a])) console.log(`   ${o.padEnd(10)} ${pc(own[o], ticks)}`);
    console.log(`\nORDERED TACKS (tactician's side != hull's side, first tick of the order): ${ordered}`);
    console.log(`   still ordered 0.3s later: ${pc(surv[0.3], ordered)}`);
    console.log(`   still ordered 1.0s later: ${pc(surv[1], ordered)}`);
    console.log(`   still ordered 2.0s later: ${pc(surv[2], ordered)}`);
    console.log(`   still ordered 3.0s later: ${pc(surv[3], ordered)}`);
    console.log(`\nWHO OWNED THE HELM THROUGH EACH ACTUAL HULL SIDE-CHANGE:`);
    for (const o of Object.keys(ownTacks).sort((a, b) => ownTacks[b] - ownTacks[a])) console.log(`   ${o.padEnd(10)} ${pc(ownTacks[o], hullFlips)}`);
    console.log(`\nticks inside the no-go (|TWA| < ${NOGO} rad, i.e. luffing/in irons): ${pc(ironsTicks, ticks)}`);
    fs.writeFileSync(path.join(__dirname, 'tack_exec_' + VENUE + '.json'), JSON.stringify(ROWS));
    console.log(`saved tack_exec_${VENUE}.json`);
})();
