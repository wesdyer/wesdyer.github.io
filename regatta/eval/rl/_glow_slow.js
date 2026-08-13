// WHY IS THE FLEET SLOW IN GLOWTIDE'S LEG-3 POCKET? (2026-08-12)
//
// `_gap_grid` per leg — and leg 3, not leg 1, is glowtide's worst:
//     leg 1  42.1 s  (bot 134.0 / his 91.9)  1.46x
//     leg 2  25.7 s  (bot  77.5 / his 51.8)  1.50x
//     leg 3  52.7 s  (bot  80.6 / his 27.9)  ⭐ 2.89x  — 38% of the venue's gap
//     leg 4  15.3 s  (bot  41.0 / his 25.7)  1.60x
//
// Its top cells cluster at x[-1125,-625] y[1875,2375] and they are NOT a grind:
// 89-94% of the time is under NAVIGATION with 0-1% contact, and the fleet makes
// 38-80 u/s where HE makes 95-133 IN THE SAME CELL. Both columns are boat.speed*60
// — the same through-water quantity — so this is not a current artifact and not a
// light-air pocket: it is the same water, sailed at 30-60% of his speed.
//
// A boat is slow through the water for a countable number of reasons. This records
// all of them at once, for the fleet and for HIM, inside the same box:
//   point of sail (TWA), the wind SHE HAD (his recording carries windDir/windSpd),
//   the throttle (speedLimit / forcedLuff), the spinnaker, and the helm's owner.
//   node _glow_slow.js <venue> <trials> <seed0> <tree> [fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGTW');
const FParg = (process.argv[6] || '').startsWith('fp=') ? process.argv[6].slice(3).split(',') : null;
const SOLO = process.argv.includes('--solo');
const BOX = { x0: -1250, x1: -500, y0: 1750, y1: 2500 };
const q = (a, pp) => { const s = a.filter(v => v != null && !isNaN(v)).slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
const D = r => (r * 180 / Math.PI);

// ── HIS SIDE, from the recordings' own wind columns ──────────────────────────
const his = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    for (const s of j.samples) {
        if (gi(s, 'phase') !== 1) continue;
        const x = gi(s, 'x'), y = gi(s, 'y');
        if (x < BOX.x0 || x > BOX.x1 || y < BOX.y0 || y > BOX.y1) continue;
        let d = gi(s, 'hdg') - gi(s, 'windDir');
        while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        his.push({ spd: gi(s, 'spd') * 60, twa: Math.abs(d), w: gi(s, 'windSpd') });
    }
}
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const R = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate(({ seed, BOX, SOLO }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            // DECONFOUND: he sails this pocket 2505u clear of the nearest rival and
            // NEVER within 300u of one, so his 118 u/s is uncontested. --solo parks
            // every rival so the bot's is uncontested too. If a lone bot is still at
            // 59 u/s the AI is genuinely slow here; if it is near 100 the pocket is a
            // CONVERGENCE failure and belongs to the fleet-avoidance family.
            if (SOLO) { const hero = state.boats.find(b => !b.isPlayer);
                for (const b of state.boats) if (b !== hero && !b.isPlayer) { b.x = 1e6; b.y = 1e6; } }
            window.__ownLog = [];            // ⚠️ enables the helm tags in treeGTW
            const out = []; const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (it % 6) continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    if (b.x < BOX.x0 || b.x > BOX.x1 || b.y < BOX.y0 || b.y > BOX.y1) continue;
                    const w = getWindAt(b.x, b.y), cu = getCurrentAt(b.x, b.y);
                    let d = b.heading - w.direction;
                    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
                    const tgt = getTargetSpeed(Math.abs(d), !!b.spinnakerUp, w.speed) * 0.25 * 60;
                    out.push([b.raceState.leg, +(b.speed * 60).toFixed(1), +Math.abs(d).toFixed(3), +w.speed.toFixed(1),
                        cu ? +cu.speed.toFixed(2) : 0,
                        b.controller ? +(b.controller.speedLimit != null ? b.controller.speedLimit : 1).toFixed(2) : 1,
                        b.ai ? +(b.ai.forcedLuff || 0).toFixed(2) : 0,
                        b.spinnakerUp ? 1 : 0, (b.controller && b.controller.__ovOwner) || 'nav',
                        +tgt.toFixed(0), b.heelAngle != null ? +b.heelAngle.toFixed(2) : -1]);
                }
                if (state.race.timer > 895) break;
            }
            return out;
        }, { seed: SEED0 + t, BOX, SOLO });
        R.push(...rows);
        console.log(`seed ${SEED0 + t}: ${rows.length} samples in the box`);
    }
    await br.close();
    // cols: 0 leg 1 spd 2 twa 3 wind 4 cur 5 speedLimit 6 forcedLuff 7 spin 8 owner 9 polarTarget 10 heel
    const L3 = R.filter(r => r[0] === 3);
    const S = L3.length ? L3 : R;
    console.log(`\n=== ${VENUE.toUpperCase()} LEG-3 POCKET${SOLO ? '  [SOLO — every rival parked]' : ''}  x[${BOX.x0},${BOX.x1}] y[${BOX.y0},${BOX.y1}] ===`);
    console.log(`   bot samples ${S.length}   |   his samples ${his.length}`);
    const row = (n, b, h) => console.log(`   ${n.padEnd(26)} bot ${b.padStart(10)}   his ${h.padStart(10)}`);
    row('speed through water', q(S.map(r => r[1]), .5).toFixed(0) + ' u/s', q(his.map(h => h.spd), .5).toFixed(0) + ' u/s');
    row('|TWA| median', D(q(S.map(r => r[2]), .5)).toFixed(0) + ' deg', D(q(his.map(h => h.twa), .5)).toFixed(0) + ' deg');
    row('|TWA| p25 / p75', D(q(S.map(r => r[2]), .25)).toFixed(0) + '/' + D(q(S.map(r => r[2]), .75)).toFixed(0),
        D(q(his.map(h => h.twa), .25)).toFixed(0) + '/' + D(q(his.map(h => h.twa), .75)).toFixed(0));
    row('WIND SPEED there', q(S.map(r => r[3]), .5).toFixed(1) + ' kt', q(his.map(h => h.w), .5).toFixed(1) + ' kt');
    console.log(`\n   --- bot only ---`);
    console.log(`   current there:            med ${q(S.map(r => r[4]), .5).toFixed(2)} kt`);
    console.log(`   POLAR TARGET at its own TWA/wind: med ${q(S.map(r => r[9]), .5).toFixed(0)} u/s  ⇒ she is at ${(100 * q(S.map(r => r[1]), .5) / (q(S.map(r => r[9]), .5) || 1)).toFixed(0)}% of her own polar`);
    console.log(`   speedLimit < 0.9 on:      ${(100 * S.filter(r => r[5] < 0.9).length / S.length).toFixed(1)}% of samples`);
    console.log(`   forcedLuff > 0 on:        ${(100 * S.filter(r => r[6] > 0).length / S.length).toFixed(1)}%`);
    console.log(`   spinnaker up on:          ${(100 * S.filter(r => r[7] === 1).length / S.length).toFixed(1)}%`);
    if (S.some(r => r[10] >= 0)) console.log(`   heel angle:               med ${q(S.map(r => r[10]), .5).toFixed(1)}  p90 ${q(S.map(r => r[10]), .9).toFixed(1)}`);
    const own = {}; for (const r of S) (own[r[8]] = own[r[8]] || []).push(r);
    console.log(`\n   helm owner in the pocket:`);
    for (const o of Object.keys(own).sort((a, b) => own[b].length - own[a].length))
        console.log(`      ${o.padEnd(10)} ${(100 * own[o].length / S.length).toFixed(1).padStart(5)}%   med speed ${q(own[o].map(r => r[1]), .5).toFixed(0)} u/s   med |TWA| ${D(q(own[o].map(r => r[2]), .5)).toFixed(0)} deg`);
})();
