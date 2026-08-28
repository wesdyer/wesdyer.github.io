// PRESTART BRANCH CENSUS (2026-08-27, THE START PUSH P1b). The ledger says the
// fleet is 179-390u behind the line when it commits, having spawned 400u back
// with 30 s to run — a distance a close-hauled boat covers in ~8 s. So where
// does the pre-start go? This probe attributes every pre-start frame to the
// branch of getStartCommand that produced it, re-deriving the conditions from
// state BEFORE the update (the function is pure in its reads), and traces the
// fleet's distance-to-line second by second.
//   branches: ocs | gun | retreat | commit | stage | luff
//   node _st_branch.js <tree> <venue> <seed0> <nraces>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeRW';
const ROOT = path.join(__dirname, TREE);
const VENUE = process.argv[3] || 'bay';
const SEED0 = parseInt(process.argv[4] || '9400');
const NRACES = parseInt(process.argv[5] || '2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
    }, VENUE);
    const races = [];
    for (let race = 0; race < NRACES; race++) {
        const seed = SEED0 + race;
        const r = await page.evaluate(async ({ seed }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            const pl = state.boats.find(b => b.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false);
            pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(b => b !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90,
                nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const boats = state.boats.slice();
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const cosT = Math.cos(0.7), NOMINAL = 60 / cosT;
            const frames = {}, trace = [];
            for (const b of boats) { const c0 = b.controller; if (c0 && c0.applyAvoidance && !c0.__w) { const o0 = c0.applyAvoidance.bind(c0); c0.applyAvoidance = (dh, sr) => { const r0 = o0(dh, sr); b._avDev = Math.abs(norm(r0 - dh)); return r0; }; c0.__w = 1; } }
            for (const b of boats) frames[b.name] = { ocs: 0, gun: 0, retreat: 0, commit: 0, stage: 0, luff: 0, n: 0, flips: 0, side: 0, thru: 0, slow: 0, avd: 0 };
            const dt = 1 / 60;
            let it = 0;
            while (state.race.status === 'prestart' && it < 60 * 120) {
                const t = state.race.timer;
                const [m0, m1] = startLinePts();
                const snap = [];
                for (const b of boats) {
                    const c = b.controller; if (!c) continue;
                    const pDist = hullLineOffset(b, m0, m1, true);
                    const behind = Math.max(0, -pDist);
                    const BUF = 0.5 + (b.traits ? b.traits.startBufAdj : 0);
                    const tCross = c.getApproachTime(NOMINAL, b.speed, b.stats) + BUF;
                    const STAGE = c.startStageDepth || 60;
                    let br;
                    if (b.raceState && b.raceState.ocs) br = 'ocs';
                    else if (t <= 0) br = 'gun';
                    else if (pDist > 10 && !c.startCommitted) br = 'retreat';
                    else if (c.startCommitted || t <= tCross) br = 'commit';
                    else if (behind > STAGE + 35) br = 'stage';
                    else br = 'luff';
                    const F = frames[b.name];
                    F[br]++; F.n++;
                    const tw = norm(b.heading - getWindAt(b.x, b.y).direction);
                    const sd = tw > 0 ? 1 : -1;
                    if (Math.abs(tw) < 0.40) F.thru++;
                    if (F.side !== 0 && sd !== F.side) F.flips++;
                    F.side = sd;
                    if (b.speed * 4 < 1.5) F.slow++;
                    if ((b._avDev || 0) > 0.12) F.avd++;
                    snap.push({ n: b.name, br, be: +behind.toFixed(0), kt: +(b.speed * 4).toFixed(1),
                                twa: +Math.abs(norm(b.heading - getWindAt(b.x, b.y).direction)).toFixed(2) });
                }
                if (it % 15 === 0) trace.push({ t: +t.toFixed(1), s: snap });
                window.update(dt); it++;
            }
            return { seed, frames, trace };
        }, { seed });
        races.push(r);
        console.log(`  race ${race} seed ${seed}: ${r.trace.length} samples`);
    }
    await browser.close();
    const agg = { ocs: 0, gun: 0, retreat: 0, commit: 0, stage: 0, luff: 0, n: 0, flips: 0, thru: 0, slow: 0, avd: 0 };
    for (const r of races) for (const f of Object.values(r.frames))
        for (const k of Object.keys(agg)) agg[k] += f[k];
    console.log(`\n══ ${VENUE} ${TREE} — pre-start frame ownership (n=${agg.n} boat-frames, ${races.length} races)`);
    for (const k of ['stage', 'luff', 'commit', 'retreat', 'ocs'])
        console.log(`   ${k.padEnd(8)} ${(100 * agg[k] / agg.n).toFixed(1)}%`);
    console.log(`   ⭐ TACK FLIPS through head-to-wind: ${(agg.flips / (agg.n / 3600)).toFixed(1)} per boat-minute  (${agg.flips} in ${(agg.n/60).toFixed(0)} boat-seconds)`);
    console.log(`   frames |TWA| < 0.40 rad (in the no-go band): ${(100*agg.thru/agg.n).toFixed(1)}%   under 1.5 kt: ${(100*agg.slow/agg.n).toFixed(1)}%   avoidance bending: ${(100*agg.avd/agg.n).toFixed(1)}%`);
    // fleet median distance-to-line, second by second
    const byT = {};
    for (const r of races) for (const s of r.trace) {
        (byT[s.t] = byT[s.t] || []).push(...s.s.map(x => x.be));
    }
    const med = a => { const z = [...a].sort((x, y) => x - y); return z[Math.floor(z.length / 2)]; };
    const ts = Object.keys(byT).map(Number).sort((a, b) => b - a);
    console.log(`   fleet median distance behind the line, T-30 → the gun:`);
    console.log('   ' + ts.filter((_, i) => i % 4 === 0).map(t => `T-${t.toFixed(0)}:${med(byT[t])}`).join('  '));
    // median speed the same way
    const spT = {};
    for (const r of races) for (const s of r.trace) (spT[s.t] = spT[s.t] || []).push(...s.s.map(x => x.kt));
    console.log(`   fleet median speed (kt):`);
    console.log('   ' + ts.filter((_, i) => i % 4 === 0).map(t => `T-${t.toFixed(0)}:${(med(spT[t])||0).toFixed(1)}`).join('  '));
    fs.writeFileSync(path.join(__dirname, `_st_branch_${TREE}_${VENUE}_${SEED0}.json`), JSON.stringify(races));
})();
